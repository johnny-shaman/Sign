/**
 * **2つの `.s` を命令列として比べる。**
 *
 * 自己ホストは後段を1関数ずつ Sign へ移す。移した1枚が正しいかを決めるのは
 * 「JS の pass4 が出した命令列と、Sign で書いた後段が出した命令列が同じか」であり、
 * 比べる前に落としてよいのは**注釈と空行と字下げだけ**である。最適化の差は
 * `regAlloc` / `peepholes` を切って消す（門は素の命令列どうしで見る）。
 *
 * **引用符の中の `//` は文字である。** `.ascii "a // b"` の `//` を注釈として落とすと、
 * 中身の違う `.rodata` が同じに見える——**門が緑のままデータだけ違う**という、一番まずい
 * 壊れ方になる。だから走査は1本にして、引用符の内と外を同じ場所で数える。空白を潰すのも
 * 同じ走査の中（引用符の外だけ）——潰す側だけ別に書くと `.ascii "a  b"` が同じ轍を踏む。
 *
 * **ディレクティブとラベルは落とさない。** `idiom_to_instructions.md §1` の数え方は
 * ディレクティブと `名前:` を捨てるが、あれは**命令を数える**ための規則である。比べる側で
 * 同じことをすると `.ascii` / `.quad` に載ったデータが消える——`operator_table.sn` は命令が
 * `ret` 1つきりで中身がぜんぶ `.rodata` にあり、落とせば何とでも一致する。落とすのは注釈と
 * 空行だけ、という一線をここで引く（ラベルも同じで、飛び先が違えば別のプログラムである）。
 *
 * 道具としても使える:  node asmdiff.mjs a.s b.s
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * 1行を比べられる形にする。注釈を落とし、引用符の**外**の空白の連なりを1つに潰す。
 * 空行・注釈だけの行は空文字列が返る。
 */
export function normalizeAsmLine(line) {
	let out = "";
	let quoted = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (quoted) {
			// 引用符の中はそのまま写す。`\"` では閉じない——pass4 は `"` を含む綴りを
			// `.byte` の並びへ落とすので今は出ないが、手で書いた `.s` には出る。
			out += c;
			if (c === "\\" && i + 1 < line.length) out += line[++i];
			else if (c === '"') quoted = false;
			continue;
		}
		if (c === '"') {
			out += c;
			quoted = true;
			continue;
		}
		if (c === "/" && line[i + 1] === "/") break; // ここから先は注釈
		if (c === " " || c === "\t" || c === "\r") {
			if (out !== "" && !out.endsWith(" ")) out += " ";
			continue;
		}
		out += c;
	}
	return out.trim();
}

/** `.s` のテキストを、意味を持つ行だけの列にする。 */
export function normalizeAsm(text) {
	return String(text).split("\n").map(normalizeAsmLine).filter((l) => l !== "");
}

/** 行の頭の綴り。命令はニーモニック、ディレクティブは `.xxx`、ラベルはまとめて1つ。 */
function kindOf(line) {
	return /^\S+:$/.test(line) ? "(ラベル)" : line.split(/[ ,]/)[0];
}

/** 綴りごとの数。どこが増えた・減ったを一目で見るための要約である。 */
export function mnemonicCounts(textOrLines) {
	const lines = Array.isArray(textOrLines) ? textOrLines : normalizeAsm(textOrLines);
	const counts = new Map();
	for (const l of lines) {
		const k = kindOf(l);
		counts.set(k, (counts.get(k) || 0) + 1);
	}
	return counts;
}

/**
 * 命令列の**指紋**。`normalizeAsm` が残した行——命令・ディレクティブ・ラベル——を
 * 並びごと束ねた値である。
 *
 * **数だけの golden は中身を見ない。** 命令数を変えずに中身を変える直し方はいくらでもあり
 * （即値・レジスタ・条件・`add`→`sub`・`.rodata` の並び・`.section`・`.balign`）、数で
 * 見張っているとどれも緑のまま通る。実測: コーパスの正規化後 10899 行のうち命令は 6355 行で、
 * 残り 4544 行＝**41.7% が数の外**にある。`operator_table.sn` は 824 行のうち命令が `ret` 1つで、
 * 数の golden が見ているのはその 1 行きりである。指紋は行の**順序ごと**束ねるので、
 * 並べ替え（数も綴りも変わらない）も捕まえる。
 *
 * 注釈は入らない（`normalizeAsm` が落とす）。CR も入らない——引用符の外の空白は潰れるので、
 * 改行の綴りが CRLF でも LF でも同じ値になる。16 桁に切るのは表に並べて読むためで、
 * 取り違えを防ぐには 64 bit で足りる（衝突を作るには pass4 を狙って壊す必要がある）。
 */
export function digestOf(textOrLines) {
	const lines = Array.isArray(textOrLines) ? textOrLines : normalizeAsm(textOrLines);
	return crypto.createHash("sha256").update(lines.join("\n"), "utf8").digest("hex").slice(0, 16);
}

/**
 * 2つを比べる。**最初に食い違った所**の位置と両側の行、それと綴りごとの数の差を返す。
 * 位置を返すのは、そこから先の食い違いは最初の1つの結果かもしれないからである。
 */
export function diffAsm(a, b) {
	const left = normalizeAsm(a);
	const right = normalizeAsm(b);
	let i = 0;
	while (i < left.length && i < right.length && left[i] === right[i]) i++;
	const same = left.length === right.length && i === left.length;
	const ca = mnemonicCounts(left);
	const cb = mnemonicCounts(right);
	const counts = [];
	for (const k of new Set([...ca.keys(), ...cb.keys()])) {
		const x = ca.get(k) || 0;
		const y = cb.get(k) || 0;
		if (x !== y) counts.push({ mnemonic: k, left: x, right: y });
	}
	counts.sort((p, q) => Math.abs(q.left - q.right) - Math.abs(p.left - p.right));
	return { same, index: same ? -1 : i, left: left[i] ?? null, right: right[i] ?? null, lengths: [left.length, right.length], counts };
}

/** 人が読む形。通ったときは何も言わない（落ちたときだけ出す）。 */
export function formatDiff(d, nameL = "左", nameR = "右") {
	// 数えるのは「意味を持つ行」——命令だけでなくラベルとディレクティブも入っている。
	if (d.same) return `一致（${d.lengths[0]} 行）`;
	const head = `${d.index} 番目で食い違う（${nameL} ${d.lengths[0]} 行 / ${nameR} ${d.lengths[1]} 行）\n     ${nameL}: ${d.left === null ? "（ここで終わり）" : d.left}\n     ${nameR}: ${d.right === null ? "（ここで終わり）" : d.right}`;
	if (d.counts.length === 0) return head;
	return head + "\n     綴りごとの数: " + d.counts.map((c) => `${c.mnemonic} ${c.left}→${c.right}`).join(" / ");
}

// 道具として直に呼ばれたときだけ走る。import されたときは何もしない。
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	const [a, b] = process.argv.slice(2);
	if (!a || !b) {
		console.error("使い方: node asmdiff.mjs <a.s> <b.s>");
		process.exit(2);
	}
	const d = diffAsm(fs.readFileSync(a, "utf8"), fs.readFileSync(b, "utf8"));
	console.log(formatDiff(d, path.basename(a), path.basename(b)));
	process.exit(d.same ? 0 : 1);
}
