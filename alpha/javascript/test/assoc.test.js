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

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);