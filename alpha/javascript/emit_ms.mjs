/**
 * 構文木を `.ms` の形で書き出すドライバ。
 *
 *   node emit_ms.mjs <file.sn>          その枚の木を標準出力へ
 *   node emit_ms.mjs -e "l ' x~"        式を1つだけ
 *
 * **木は .ms で読む**（利用者の裁定 2026-09-22）。`.ms` は Sign の積の記法をそのまま
 * データに使う形式で（option_ms_schema.md）、`parser.sn` が出すのと同じ欄（`op`・`l`・`r`）
 * である——同じ入力に対して2つの前段が同じ木を出すことが `parser.sn` の正しさの定義なので
 * （`sign_programs.test.js`）、こちら側にも同じ字面で見る口が要る。
 *
 *     l ' x~   →   ast :
 *                  	op : `'`
 *                  	l : l
 *                  	r :
 *                  		op : `@`
 *                  		r : x
 *
 * **入れ子は字下げで書く。** `parser.sn` が括りで書くのは、字下げだと各行が深さぶんのタブを
 * 持って出力が入力の二乗に伸び、機械が線形の上界しか言えないからである。読む側にとっては
 * 同じ木で（括りの中の行と字下げの行は同じ並びとして読まれる）、ここは機械で走らせない
 * 道具なので、縛りの無い方＝読みやすい方を採る。
 *
 * **前置・後置は在る側だけを書く。** `parser.sn` は今のところ中置しか書き出さないので、
 * ここが先に決める形になる：前置は `op` と `r`、後置は `op` と `l`。欄の名前は中置と同じで、
 * 無い側の欄は置かない——空の欄を置くと「空の項が在る」と読めてしまう。
 *
 * 出すのは **Pass 2 を通した後の木**である（`compile`）。糖衣は均された後なので、`x @ p` は
 * `p ' x` に、鍵の位置の `x~` は前置 `@` に見える——見たいのは意味の決まった木であって、
 * 字面そのものではない。字面のままの木が要るときは `parser.sn` の側で見る。
 */
import fs from "fs";
import path from "path";
import { compile } from "./compile.js";

const args = process.argv.slice(2);
const expr = args.includes("-e") ? args[args.indexOf("-e") + 1] : null;
const file = args.find((a) => !a.startsWith("-") && a !== expr);
if (expr === null && !file) {
	console.error('使い方: node emit_ms.mjs <file.sn> | node emit_ms.mjs -e "式"');
	process.exit(2);
}

const TAB = String.fromCharCode(9);
const NL = String.fromCharCode(10);
const BQ = String.fromCharCode(96);
const q = (s) => BQ + s + BQ;
// 識別子は `<x>` の形で持っている。葉として書くのは綴りそのものである。
const leafOf = (n) => {
	const v = String(n.value ?? "");
	return v.startsWith("<") && v.endsWith(">") ? v.slice(1, -1) : v;
};

// 仮引数の綴り。書かれたとおりの印を残す（`~t` は器を受ける位置、`[…]` は分解）。
function paramSpelling(e) {
	if (!e) return "__";
	if (e.pattern) return "[" + e.pattern.map(paramSpelling).join(" ") + "]";
	return (e.rest ? "~" : "") + leafOf({ value: e.name });
}

// 1つの節を `欄 : 値` の行の並びにする。葉は行にならない（呼ぶ側が1行で書く）ので null。
function rowsOf(n) {
	if (!n || typeof n !== "object" || n.type === "atom") return null;
	// 仮引数の並びは節ではないが、空でもない——`__` と書くと「仮引数が無い」と読めてしまう。
	// 並べた名前を位置の欄で書く（`bracket` は分解の印なので、その事実も欄に残す）。
	if (n.type === "params") {
		const rows = (n.entries || []).map((e, i) => String(i) + " : " + paramSpelling(e));
		return n.bracket ? ["bracket : 1", ...rows] : rows;
	}
	if (n.type === "block") return (n.lines || []).map((l, i) => field(String(i), l));
	if (n.type !== "operation") return null;
	const rows = ["op : " + q(n.op === " " ? " " : String(n.op ?? n.name ?? ""))];
	if (n.position === "postfix") rows.push(field("l", n.operand));
	else if (n.position === "prefix") rows.push(field("r", n.operand));
	else {
		rows.push(field("l", n.left));
		rows.push(field("r", n.right));
	}
	for (const [i, l] of (n.lines || []).entries()) rows.push(field(String(i), l));
	return rows;
}

// `名前 : 値`。葉なら1行、節なら見出しの行と、1段下げた中身。
function field(name, n) {
	const rows = rowsOf(n);
	if (!rows) return name + " : " + (n && n.type === "atom" ? leafOf(n) : "__");
	const indent = (s) => s.split(NL).map((x) => TAB + x).join(NL);
	return [name + " :", ...rows.map(indent)].join(NL);
}

const source = expr !== null ? expr + NL : fs.readFileSync(path.resolve(file), "utf8");
const { nodes, diagnostics } = compile(source, {});
for (const d of diagnostics || []) console.error(`${d.level || d.severity}: ${d.message}`);
for (const n of nodes) console.log(field("ast", n) + NL);
