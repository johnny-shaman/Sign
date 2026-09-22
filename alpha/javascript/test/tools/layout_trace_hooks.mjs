/**
 * **layout.js が実際に問われた問いを拾うための読み込みフック。**
 *
 * `LAYOUT_TRACE` が立っているときだけ効く。立っていなければ何も登録しないので、
 * `--import` で読んでも layout.js はそのまま読まれる——普段の実行には何も起きない。
 *
 * 効いているときは、layout.js を読み込む瞬間にソースを書き換えて渡す（リポジトリの
 * ファイルは触らない）。関数を名前ごと包み、`layout_trace_runtime.js` を `export {` の直前へ
 * 差し込む。包むのは定義の側なので、pass3 / pass4 / interpreter から引いても、layout.js の
 * 中で呼び合っても、全部が記録を通る。
 *
 * 環境変数:
 *   LAYOUT_TRACE=1          包む（これが無ければフックは何もしない）
 *   LAYOUT_TRACE_DIR=<dir>  プロセスが終わるときに <dir>/<argv1の名前>.<pid>.<n>.json へ書く。
 *                           無ければ書かず、`globalThis.__LAYOUT_TRACE.rows()` で読むだけ
 *                           （`gen_layout_reached.mjs` のコーパス1巡がこちら）
 *
 * **子プロセスへも渡す。** `test/run.js` は検査を1本ずつ別のプロセスで起こす
 * （`spawnSync(process.execPath, …)`）ので、`--import` は子へ引き継がれない。ここで
 * `NODE_OPTIONS` に自分を足しておけば、環境変数と一緒に子へ届く。一式を測るときの形:
 *
 *   cd alpha/javascript
 *   LAYOUT_TRACE=1 LAYOUT_TRACE_DIR=<dir> node --import ./test/tools/layout_trace_hooks.mjs test/run.js
 *
 * 環境を自分で組んで子を起こす検査（`env: {…}` を渡すもの）には届かない。今の一式には無い。
 */
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";

// 包む関数。どの組に入れるかで記録の仕方が変わる（`layout_trace_runtime.js` の同名の関数を見よ）。
//   ASK   問いの枠を積み、型の名前だけで答えが出るかを確かめる
//   RULE  規則の大きさ。型と要素型で答えが決まる
//   PLAIN 引数（と並び）だけ残す
//   WALK  構文木を歩く。いちばん内側の問いの枠に印を付ける
//   COUNT 名前では答えられない問い。回数だけ数える
const GROUPS = {
	__ask: ["passingOf", "slotCellSize", "measure"],
	__rule: ["measureRule"],
	__plain: ["alignUp", "bareName", "addressWithoutArrow", "packSlots", "packNamed"],
	__walk: ["cursorParts", "listItems", "stringLength", "layoutOfStruct", "measureList", "measureCursor", "measureImplicit"],
	__count: ["elementShapeOfList", "itemShapeOfListAt", "commonSlotShape"],
};

const LAYOUT_PATH = fileURLToPath(new URL("../../layout.js", import.meta.url));
const RUNTIME = fs.readFileSync(new URL("./layout_trace_runtime.js", import.meta.url), "utf8");

// **同じファイルかは道で比べる。** Windows ではドライブ文字の大小が起動のしかたで揺れる
// （`C:\…` と `c:\…`）ので、URL の文字列どうしを比べると取りこぼす。
const norm = (p) => (process.platform === "win32" ? p.toLowerCase() : p);
const isLayout = (url) => {
	if (!url.startsWith("file:")) return false;
	try {
		return norm(fileURLToPath(url)) === norm(LAYOUT_PATH);
	} catch {
		return false;
	}
};

/**
 * 書き換える前のソースの指紋。一式の記録が今の layout.js から採ったものかを、生成器が確かめる。
 *
 * **見るのは `export {` より前だけである。** 問いの答えと、中で誰が誰を呼ぶかは関数と表が
 * 決めていて、export の並びは決めない。門のために窓口を1つ出しただけで1時間の記録が
 * 使えなくなるのは、指紋が見るべきでないものを見ているからである。
 */
export const layoutShaOf = (src) => {
	const s = String(src).replace(/\r\n/g, "\n");
	const at = s.lastIndexOf("export {");
	return crypto.createHash("sha256").update(at < 0 ? s : s.slice(0, at)).digest("hex");
};

function transform(src) {
	let s = src;
	const tail = [];
	for (const [wrap, names] of Object.entries(GROUPS)) {
		for (const f of names) {
			const re = new RegExp(`^function ${f}\\(`, "m");
			// **見つからなければ落とす。** 黙って包まずに進むと、その関数の問いが記録から消えたまま
			// 表が「誰も問わない」と言う——layout.js で関数の名前が変わった日に、ここで言われる。
			if (!re.test(s)) throw new Error(`layout_trace_hooks: layout.js に function ${f}( が見つかりません`);
			s = s.replace(re, `function __o_${f}(`);
			tail.push(wrap === "__ask" || wrap === "__plain" || wrap === "__walk" || wrap === "__count" ? `const ${f} = ${wrap}(${JSON.stringify(f)}, __o_${f});` : `const ${f} = ${wrap}(__o_${f});`);
		}
	}
	const at = s.lastIndexOf("export {");
	if (at < 0) throw new Error("layout_trace_hooks: layout.js に export { が見つかりません");
	const head = `const __LAYOUT_SHA = ${JSON.stringify(layoutShaOf(src))};\n`;
	return s.slice(0, at) + head + RUNTIME + "\n" + tail.join("\n") + "\n" + s.slice(at);
}

if (process.env.LAYOUT_TRACE) {
	const self = `--import=${import.meta.url}`;
	const cur = process.env.NODE_OPTIONS || "";
	if (!cur.includes(self)) process.env.NODE_OPTIONS = cur ? `${cur} ${self}` : self;
	registerHooks({
		load(url, context, nextLoad) {
			const r = nextLoad(url, context);
			if (!isLayout(url)) return r;
			return { ...r, source: transform(String(r.source)), shortCircuit: true };
		},
	});
}
