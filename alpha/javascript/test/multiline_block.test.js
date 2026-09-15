/**
 * 複数行ブロックの動作確認。
 * grammar.pegjs の根本修正（Term/Expression/Blockの3点、pass2.js冒頭コメント参照）以前は、
 * 単一行ブロックだけがたまたま正しく見えていたが、複数行ブロックは各行がバラバラの
 * 独立したブロックとして誤解釈されていた可能性があった（未検証のまま埋もれていた懸念）。
 * 修正後、複数行が正しく「1つのブロック内の複数の文」として解決されることを確認する。
 *
 * 実行: node test/multiline_block.test.js
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { reduceAll } from "../pass2.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const grammarPath = path.join(__dirname, "..", "sign.pegjs");
const grammar = fs.readFileSync(grammarPath, "utf8");
const parser = peggy.generate(grammar);

function show(node) {
	if (node.type === "atom") return `${node.kind}(${node.value})`;
	if (node.type === "operation") {
		if (node.position === "prefix" || node.position === "postfix") return `${node.name}(${show(node.operand)})`;
		return `${node.name}[${show(node.left)}, ${show(node.right)}]`;
	}
	if (node.type === "block") return `${node.kind}{${node.lines.map(show).join("; ")}}`;
	return JSON.stringify(node);
}

// (1 + 2↵3 * 4) という、括弧内に改行区切りで2文ある入力
// lexer.jsのpreprocess()を通さず直接渡す。行の区切りは CR である（preprocessor.md §0——
// 前処理の最初の走査が処理の改行を CR にする。LF は `\` と組んだ文字の改行）
const source = "(1 + 2\r3 * 4)";
const want = "paren{add[number(1), number(2)]; mul[number(3), number(4)]}";

const ast = parser.parse(source);
const got = show(reduceAll(ast[0]));

const passed = got === want ? 1 : 0;
if (passed) {
	console.log("OK   複数行ブロックが1つのブロック内の2つの文として正しく解決される");
} else {
	console.log("FAIL 複数行ブロック");
	console.log("     got: ", got);
	console.log("     want:", want);
}

console.log(`\n${passed}/1 passed`);
process.exit(passed === 1 ? 0 : 1);
