/**
 * 出した命令列を**実際に走らせて値を見る**。
 *
 * Pass 4 のテストは長らく「その命令が出ているか」しか見ていなかった。それだと
 * 降順レンジ（`[5 ~ 1]`）のように**命令は正しいが値が違う**壊れ方をすり抜ける
 * ——実際すり抜けていた。`madd` が出ていることは、`start + n × step` が合っている
 * ことを意味しない。
 *
 * 走らせる先は OS の上ではなく `-M virt` の裸の AArch64 である。Sign が最終的に
 * 降りていく先がそこなので、確かめる場所もそこでよい。返値は x0..x3 を PL011 へ
 * 16進で流して読み取る（qemu/start.s）。
 *
 * ツールチェーンが無い環境では `available()` が false を返す。テストはそのとき
 * 静かに飛ばす——**入っていないことと落ちることは別**である。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSET = path.join(HERE, "qemu");

// Windows の winget は PATH を通さないことがあるので、既定の場所も見る。
const CANDIDATES = {
	clang: ["clang", "C:/Program Files/LLVM/bin/clang.exe"],
	lld: ["ld.lld", "C:/Program Files/LLVM/bin/ld.lld.exe"],
	qemu: ["qemu-system-aarch64", "C:/Program Files/qemu/qemu-system-aarch64.exe"],
};

function which(kind) {
	for (const c of CANDIDATES[kind]) {
		try {
			execFileSync(c, ["--version"], { stdio: "ignore" });
			return c;
		} catch {}
	}
	return null;
}

let cached = null;
function tools() {
	if (cached === null) {
		cached = { clang: which("clang"), lld: which("lld"), qemu: which("qemu") };
		cached.ok = !!(cached.clang && cached.lld && cached.qemu);
	}
	return cached;
}

export function available() {
	return tools().ok;
}

export function toolReport() {
	const t = tools();
	return `clang:${t.clang ? "有" : "無"} ld.lld:${t.lld ? "有" : "無"} qemu:${t.qemu ? "有" : "無"}`;
}

/**
 * 道具1つの実体（無ければ `null`）。**探し方の写しを作らせないために出す。**
 *
 * リンクの門（`test/export_symbol.test.js` の §9）は clang と ld.lld しか要らない
 * ——`available()` は qemu も揃っていることを求めるので、あれを使うと qemu の無い機械で
 * リンクの門まで一緒に飛んでしまう。Windows の既定の置き場所（`CANDIDATES`）は
 * ここ1か所にしか無い、という形を保つ。
 */
export function toolPath(kind) {
	return tools()[kind] || null;
}

/**
 * 外部の道具を1つ走らせる。**失敗したら中身を見せる。**
 *
 * `stdio: "pipe"` で握り潰すと「Command failed」しか残らず、本物の失敗と一時的な失敗の
 * 区別が付かない。実際それで、生成物は正しいのに落ちた回を2度追いかける羽目になった。
 */
function run(bin, args, opts = {}) {
	try {
		return execFileSync(bin, args, { stdio: "pipe", ...opts });
	} catch (e) {
		const err = (e.stderr && String(e.stderr).trim()) || (e.stdout && String(e.stdout).trim()) || "";
		const why = e.code === "ETIMEDOUT" ? "時間切れ" : e.status !== undefined && e.status !== null ? `終了コード ${e.status}` : e.code || "失敗";
		throw new Error(`${path.basename(bin)}：${why}${err ? "：" + err.slice(0, 300) : ""}`);
	}
}

// **開始コードは1度だけ組む。** `start.s` は毎回同じ入力なのに検査ごとに clang を
// 呼んでおり、403 件なら 403 回の無駄——**そのぶん一時的な失敗の機会も増える**。
// 生成物は `.o` なので、この処理の間で使い回せる。
let startObj = null;
function startObjectPath() {
	if (startObj && fs.existsSync(startObj)) return startObj;
	const t = tools();
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sign-start-"));
	const out = path.join(dir, "start.o");
	run(t.clang, ["--target=aarch64-unknown-none", "-c", path.join(ASSET, "start.s"), "-o", out]);
	startObj = out;
	return out;
}

/**
 * **スタックの既定は 16MiB。** Sign にはループが無く再帰しか無いので、素直に書いた
 * コードほど深く積む——`preprocess.sn` は入力1文字あたり 50 バイトを使い、自分自身と
 * 同じ大きさ（13471 バイト）の入力で 659KiB 要る。以前の 64KiB は 1300 文字で尽きていた。
 * 16MiB は約 33 万文字ぶんで、いま書ける `.sn` のどれに対しても 20 倍以上の余裕がある。
 * 置き場所のおかげで（link.ld）大きく取っても代金は番地だけであり、実測でも起動時間は
 * 変わらない。
 */
export const DEFAULT_STACK = 0x1000000;

// start.s が踏み抜きを報せる合図。呼ぶ側はこれを見て「読めない出力」ではなく
// **踏み抜き**として報告できる。
const SIGNALS = {
	"53544b4f56464c54": "スタックを踏み抜いた（STKOVFLT：限界より下の番地へ触った）",
	"53544b534d415348": "スタックを踏み抜いた（STKSMASH：限界の番人が消えていた）",
	"5349474e46414c54": "同期例外（SIGNFALT：踏み抜き以外）",
};

/**
 * `.s` の本文を受けて走らせ、`_.main` の返値レジスタ x0..x3 を BigInt で返す。
 * `__` は niche（0x8000000000000000）なので、そのまま見れば分かる。
 *
 * - `stack`：スタックの大きさ（バイト、16 の倍数）。既定 `DEFAULT_STACK`。**使えるのは
 *   この値から 128 バイト引いた分**——限界の 128 バイトは `start.s` の番人が使う。
 * - `memMB`：qemu の `-m`（MiB）。既定は qemu 任せ（128MiB）。スタックを 100MiB 超に
 *   するときだけ要る——image はスタックの上に載るので、RAM から出るとリンクが落ちる。
 * - `timeout`：qemu の待ち時間（ms）。踏み抜きは例外表が 0.2 秒で報せるので、
 *   ここで待つのは本当に終わらない計算だけになった。
 *
 * 踏み抜きは**返値ではなく例外**で返す。誤答や時間切れと区別が付かない形では意味が無い。
 */
export function runAsm(asmText, { timeout = 20000, stack = DEFAULT_STACK, memMB = null } = {}) {
	const t = tools();
	if (!t.ok) throw new Error(`ツールチェーンがありません（${toolReport()}）`);
	if (!Number.isInteger(stack) || stack % 16 !== 0) throw new Error(`stack は16の倍数の整数で渡すこと（${stack}）`);
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sign-qemu-"));
	try {
		const sPath = path.join(dir, "prog.s");
		fs.writeFileSync(sPath, asmText);
		run(t.clang, ["--target=aarch64-unknown-none", "-c", sPath, "-o", path.join(dir, "prog.o")]);
		const startO = startObjectPath();
		const ldArgs = ["-T", path.join(ASSET, "link.ld"), `--defsym=__stack_size=${stack}`];
		// `-m` を指定するなら、リンカにも同じ大きさを教える。image が RAM の外へ出る
		// 配置を**黙って起動しない**のではなくリンクで落とすため（link.ld の ASSERT）。
		if (memMB) ldArgs.push(`--defsym=__ram_size=${memMB * 1024 * 1024}`);
		ldArgs.push(startO, path.join(dir, "prog.o"), "-o", path.join(dir, "prog.elf"));
		run(t.lld, ldArgs);
		const qemuArgs = ["-M", "virt", "-cpu", "cortex-a57", "-nographic", "-semihosting", "-kernel", path.join(dir, "prog.elf")];
		if (memMB) qemuArgs.push("-m", String(memMB));
		const out = run(t.qemu, qemuArgs, { timeout, encoding: "utf8" });
		const words = out.trim().split(/\s+/).filter((w) => /^[0-9a-f]{16}$/.test(w));
		if (words.length && SIGNALS[words[0]]) {
			const rest = words.slice(1).map((w) => "0x" + w).join(" ");
			throw new Error(`${SIGNALS[words[0]]}：スタック ${stack} バイト${rest ? `（FAR/ESR/ELR ${rest}）` : ""}`);
		}
		if (words.length < 4) throw new Error(`出力が読めません：${JSON.stringify(out.slice(0, 200))}`);
		return words.slice(0, 4).map((w) => BigInt("0x" + w));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

export const NICHE = 0x8000000000000000n;

/** 符号付き 64 ビットとして読む。`__` は null。 */
export function asInt(v) {
	if (v === NICHE) return null;
	return BigInt.asIntN(64, v);
}
