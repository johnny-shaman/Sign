// **結合の向きは、表が言うことと実装が一致していなければならない。**
//
// `operator_table.md` の凡例は「右結合は位置表記内に※あり」と決めている（`中置※`）。
// ところが実装（pass2 の `reduceOnce`）は**演算子ごとにベタ書き**で、`@` と `,` だけ
// 手で書いてあった。表が同じく右結合と言っている `^`（冪）と `#`（出力）は左結合のまま
// で、`2 ^ 3 ^ 2` が 512 ではなく **64**（`(2^3)^2`）になっていた——もっともらしい数が
// 返るので長く見つからなかった。
//
// **同じ事実が2箇所にある形**なので、表（`operator_table.js` の `assoc`）へ寄せて実装は
// 引くだけにした。この試験は、その2箇所が**また割れたら落ちる**ためにある。
import { compile } from "../compile.js";
import { OPERATOR_BY_PRECEDENCE } from "../operator_table.js";
import fs from "fs";
import path from "path";

let passed = 0, total = 0;
const check = (note, got, want) => {
	total++;
	if (got === want) { passed++; console.log(`ok   ${note.padEnd(40)} ${got}`); }
	else console.log(`FAIL ${note.padEnd(40)} got: ${got} / want: ${want}`);
};

// md が「中置※」＝右結合と言っている演算子を、md そのものから読む。
const MD = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "../../../documents/ja-jp/impl/syntax/operator_table.md");
const md = fs.readFileSync(MD, "utf8");
const rightInMd = new Set();
for (const line of md.split(/\r?\n/)) {
	const m = line.match(/^\|\s*[\d.]+[^|]*\|\s*`([^`]+)`\s*\|\s*中置※/);
	if (m) rightInMd.add(m[1]);
}

// 表（js）が assoc: 'right' と言っているもの。
const rightInJs = new Set();
for (const tier of OPERATOR_BY_PRECEDENCE) {
	for (const [op, e] of Object.entries(tier || {})) {
		if (e.position === "infix" && e.assoc === "right") rightInJs.add(op);
	}
}

// **`:` と `?` は二項の畳みを通らない**（束縛とラムダは構文そのもの）ので、この対応の外。
const STRUCTURAL = new Set([":", "?"]);
for (const op of rightInMd) {
	if (STRUCTURAL.has(op)) continue;
	check(`md が右結合と言う ${op} は表にも書いてある`, rightInJs.has(op), true);
}
for (const op of rightInJs) {
	check(`表が右結合と言う ${op} は md にも書いてある`, rightInMd.has(op), true);
}

// 実測。`a OP b OP c` がどちらに切れるか。
const shape = (n) => {
	if (!n || typeof n !== "object") return String(n);
	if (n.type === "atom") return String(n.value).replace(/[<>]/g, "");
	if (n.type === "operation") {
		if (n.position === "postfix") return shape(n.operand) + (n.op || "");
		if (n.position === "prefix") return (n.op || "") + shape(n.operand);
		return "(" + shape(n.left) + (n.op || n.name) + shape(n.right) + ")";
	}
	return n.type;
};
const cut = (op) => {
	try {
		const src = ["a : 2", "b : 3", "c : 2", `s : a ${op} b ${op} c`].join(String.fromCharCode(10));
		const { nodes } = compile(src);
		const s = shape(nodes[nodes.length - 1].right);
		return /^\(a[^(]*\(b/.test(s) ? "右" : "左";
	} catch { return "例外"; }
};
// 冪は数で見るのが一番確か。右結合なら 2^(3^2) = 512。
check("冪は右から: 2 ^ 3 ^ 2 の切れ方", cut("^"), "右");
check("積は右から: 1 , 2 , 3 の切れ方", cut(","), "右");
check("出力は右から: a # b # c の切れ方", cut("#"), "右");
check("足し算は左から", cut("+"), "左");
check("引き算は左から", cut("-"), "左");
check("合成は左から", cut(";"), "左");
check("余積（空白）は左から", cut(" "), "左");

// **1つの連なりの結合の向きは1つである。**
//
// 同じ段に向きの違う演算子が居ると、括らずに並べた形に読みが2つある——`s @ r ' t` は
// `(s @ r) ' t` とも `s @ (r ' t)` とも読める。以前の `reduceOnce` は左から畳み、右結合は
// 「右に同じ綴りが居る」ときだけ待っていたので、`a @ b ' c @ d` が `a @ ((b ' c) @ d)` と
// いう表からは読めない形になっていた。いまは名指しで断る（原理4、連鎖比較の混在と同じ）。
//
// **段は表から引く。** 向きの割れた段を手で書くと、段が増えたときにこちらが古くなる。
const mixedTiers = [];
for (const [tier, row] of OPERATOR_BY_PRECEDENCE.entries()) {
	const ops = Object.entries(row || {}).filter(([, e]) => e.position === "infix");
	const right = ops.filter(([, e]) => e.assoc === "right").map(([op]) => op);
	const left = ops.filter(([, e]) => e.assoc !== "right").map(([op]) => op);
	if (right.length && left.length) mixedTiers.push({ tier, left, right });
}
// 今それに当たるのは get の2つだけ。増えたら下の検査がそのまま新しい組も見る。
check("向きが割れている段は get だけ", JSON.stringify(mixedTiers.map((t) => [...t.left, ...t.right].sort())), JSON.stringify([["'", "@"]]));
const refused = (src) => {
	try { compile(src); return "通った"; } catch (e) { return /結合の向きが違う演算子は括らずに並べられません/.test(e.message) ? "断る" : "別の理由：" + e.message; }
};
const G = "m : [10 20] , [30 40]\nk : 0\n";
for (const { left, right } of mixedTiers) {
	for (const l of left) for (const r of right) {
		check(`括らずに混ぜると断る k ${r} m ${l} 1`, refused(G + `k ${r} m ${l} 1`), "断る");
		check(`括らずに混ぜると断る m ${l} 0 ${r} m`, refused(G + `m ${l} 0 ${r} m`), "断る");
		check(`括りの中でも同じ (k ${r} m ${l} 1)`, refused(G + `(k ${r} m ${l} 1)`), "断る");
		check(`関数の本体でも同じ`, refused(G + `f : i ? i ${r} m ${l} 1\nf 0`), "断る");
		check(`3つ以上でも最初の割れ目で断る k ${r} 1 ${r} m ${l} 0`, refused(G + `k ${r} 1 ${r} m ${l} 0`), "断る");
	}
}
// **字句の段の書き換えも抜け道にならない。** 関数を並べた器の `p ' 1` は pass2 より前に
// スロットへ貼られる（compile.js の `pasteVisiblePipelines`）。隣を見ずに貼っていたので、
// データだけの器なら断る `1 @ d ' 0` が、関数を持つ器では `1 @ p ' 1` のまま 8 を返していた。
check("関数を並べた器でも断る 1 @ p ' 1", refused("p : [+ 2] , [7 8 9] , 3\n1 @ p ' 1"), "断る");
check("データだけの器でも断る 1 @ d ' 0", refused("d : [7 8 9] , [1 2] , 3\n1 @ d ' 0"), "断る");
// **撒いた字句が混在を作らない。** 積の中で撒くとき、スロットを裸で並べると書いてもいない
// `' 0 @` が字句の段で生まれていた。スロットは括って置く（断るなら混在以外の理由で）。
check("撒いたスロットが混在を作らない", refused("m : [10 20] , [30 40]\np : 0 @ m , [+ 1]\nm ' p~ , 3") !== "断る", true);
// **並置も連なりを切る。** get は並置より強いので `f 0 @ l l ' 2` は `f (0 @ l) (l ' 2)`——
// 読みは1つである。隣り合う2つの項を切れ目と見ていなかったので断っていた。
const F = "l : [1 2 3]\nf : x y ? x + y\ng : x ? x\n";
check("並置で切れていれば通る f 0 @ l l ' 2", refused(F + "f 0 @ l l ' 2"), "通った");
check("並置の中でも1つの連なりなら断る g 0 @ l ' 1", refused(F + "g 0 @ l ' 1"), "断る");
// 読みが1つに決まる形は通る。括りは順序を明示し、弱い段の演算子は連なりを切る。
check("括れば通る (0 @ m) ' 1", refused(G + "(0 @ m) ' 1"), "通った");
check("括れば通る 0 @ (m ' 1)", refused(G + "0 @ (m ' 1)"), "通った");
check("綴りを揃えれば通る m ' 0 ' 1", refused(G + "m ' 0 ' 1"), "通った");
check("綴りを揃えれば通る 1 @ 0 @ m", refused(G + "1 @ 0 @ m"), "通った");
check("弱い段で切れていれば通る m ' 0 ' 1 + 1 @ 0 @ m", refused(G + "m ' 0 ' 1 + 1 @ 0 @ m"), "通った");

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);