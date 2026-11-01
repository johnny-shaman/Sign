/**
 * **字下げのブロックの置き場所と、定義の終わりの空行**（利用者 2026-10-17、lexer.js の markBlock）。
 *
 * - 字下げのブロックは、演算子（`:`・`?`・中置の演算子）の右にだけ置ける。値や語のすぐ後ろの字下げは
 *   名指しで断る（`block-after-value`）。前の行の余積を続けるなら TAB の後に空白を置く。
 * - いちばん外の定義が字下げのブロックで終わったら、空行を1行置いてから次の行を書く。無ければ名指しで断る
 *   （`definition-end-blank-line`）。ブロックの途中の深さの変わり目、ブロックの中の定義の終わり、1行の定義、
 *   `?` の行が続く所、ファイルの終わりには要らない。行頭のコメントの行は空行に数えない。
 *
 * 通るものは前処理と構文が最後まで通ることを、断るものは断りの理由（`reason`）を見る。
 *
 * 実行: node test/block_rules.test.js（`npm test` からも呼ばれる）
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { preprocess } from "../lexer.js";
import { resolve, show } from "../resolve.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = peggy.generate(fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8"));
const L = (...rows) => rows.join("\n");

const passes = [
	["`?` の右の字下げ（match_case の本体）", L("abs : x ?", "\tx < 0 : 0 - x", "\tx", "", "abs -3")],
	["`:` の右の字下げ（構造体）", L("p :", "\tx : 1", "\ty : 2", "", "p ' x")],
	["中置演算子の右の字下げ", L("n : 1 +", "\t2", "", "n")],
	["枝の `:` の右の字下げ、入れ子の終わりは深さで分かる", L("sgn : x ?", "\tx < 0 :", "\t\t`negative`", "\t`non-negative`", "", "sgn -1")],
	["TAB の後に空白は前の行の続き（余積）", L("inc : x ? x + 1", "inc", "\t 5")],
	["構造体の中の関数の終わりには空行が要らない", L("counter :", "\tinc : x ?", "\t\tx + 1", "\ttick : inc", "", "counter ' tick")],
	["仮引数のブロックの後の `?` の行は定義の続き", L("add :", "\t\tx", "\t\ty", "\t? x + y", "", "add 1 2")],
	["1行の定義どうしには空行が要らない", L("inc : x ? x + 1", "dbl : x ? x * 2", "inc 1")],
	["`?` の行で書き終えた定義（ブロックが無い）", L("f : x y", "\t? x + y", "g : 1")],
	["ファイルの終わりは定義の終わり", L("f : x ?", "\tx")],
	["空行の後のコメントの行", L("f : x ?", "\tx", "", "` コメント", "g : 1")],
	["ブロックの後の0列目の続きの行は定義の続き", L("x : 1 +", "\t2", " * 3", "", "x")],
	["ブロックの中の空行は読み捨てる", L("p :", "\tx : 1", "", "\ty : 2", "", "p ' y")],
	["前置にもなる中置の演算子（`-`・`~`）の右の字下げ", L("n : 1 -", "\t2", "", "xs : 1 ~", "\t5", "", "n")],
];

const refuses = [
	["値のすぐ後ろの字下げ", L("k : 7", "k", "\t1 2"), "block-after-value"],
	["語（関数の名前）のすぐ後ろの字下げ", L("inc : x ? x + 1", "inc", "\t5"), "block-after-value"],
	["ブロックの中の語の後ろの字下げ", L("g : 5", "h :", "\tg", "\t\t1 2", "", "h"), "block-after-value"],
	["文字列で終わる行の後ろの字下げ", L("s : `a`", "s", "\t`b`"), "block-after-value"],
	["定義のブロックの後に空行が無い", L("abs : x ?", "\tx < 0 : 0 - x", "\tx", "abs -3"), "definition-end-blank-line"],
	["構造体のブロックの後に空行が無い", L("p :", "\tx : 1", "p ' x"), "definition-end-blank-line"],
	["仮引数のブロックと本体の後に空行が無い", L("add :", "\t\tx", "\t\ty", "\t? x + y", "add 1 2"), "definition-end-blank-line"],
	["コメントの行は空行に数えない", L("f : x ?", "\tx", "` コメント", "g : 1"), "definition-end-blank-line"],
	["続きの行の後も、定義の終わりには空行が要る", L("x : 1 +", "\t2", " * 3", "x"), "definition-end-blank-line"],
	["前置にしかならない演算子（`$`）の下の字下げ", L("f : $", "\t[1 2]", "", "f"), "block-after-value"],
	["前置・後置にしかならない演算子（`!`）の下の字下げ", L("f : !", "\tx", "", "f"), "block-after-value"],
	["括りを閉じた行の後ろの `:` も定義", L("[a", "b] : 1 +", "\t2", "m : 1"), "definition-end-blank-line"],
];

// 前置にもなる綴りは、行末で空白に区切られていれば中置である（ブロックに密着して前置にならない）。
const treeCases = [
	["行末の `-` は中置（`1 - {2}`）", L("n : 1 -", "\t2"), ["<n>", ":", "1", "-", [`"INDENT_"`, [["2"]], `"_DEDENT"`]]],
];

// 続きの印は改行か TAB の後の空白だけ（利用者 2026-11-01）。いちばん外の空行（問28）とコメントの行は越えない。
// 期待は解決器まで通した木か、断りの理由。構文エラーは "SyntaxError"。
const CUT = "infix-missing-operand";
const continuation = [
	["0列目の空白は続き", L("width : 640", " + 16"), "(: width (+ 640 16))"],
	["0列目の演算子は続きでない", L("width : 640", "+ 16"), CUT],
	["行末の演算子の次の行も、空白が無ければ続きでない", L("1 +", "1"), CUT],
	["閉じ括りの次の空白は続き", L("[", " 1 + 1", "]", " * 2"), "(* [1 + 1] 2)"],
	["閉じ括りの次の演算子は続きでない", L("[", " 1 + 1", "]", "* 2"), CUT],
	["TAB の後の空白は続き", L("f : x ?", "\tx", "\t + 1", "", "f 1"), "(apply f 1)"],
	["TAB の後の演算子は続きでない", L("f : x ?", "\tx", "\t+ 1", "", "f 1"), CUT],
	["`,` で始まる行も続きでない", L("x : 1 , 2", ", 3"), CUT],
	["括りの中の空白は続き", L("a : [", "\t1", "\t + 2", "]"), "(: a [1 + 2])"],
	["いちばん外の空行の後の演算子", L("width : 640", "", "+ 16"), CUT],
	["いちばん外の空行の後の空白", L("width : 640", "", " + 16"), "SyntaxError"],
	["いちばん外の空行の後の TAB と空白", L("qq : 1", "", "\t + 2"), "SyntaxError"],
	["いちばん外の空行の後の TAB と演算子", L("qq : 1", "", "\t+ 2"), "SyntaxError"],
	["いちばん外の空行の後の `?` の行", L("f : x", "", "\t? x", "", "f 1"), "SyntaxError"],
	["いちばん外の空行の後の0列目の `?` の行", L("f : x", "", "? x", "", "f 1"), CUT],
	["`?` の右の空行の後のブロック", L("f : x ?", "", "\tx + 1", "", "f 1"), "SyntaxError"],
	["行末の演算子の右の空行の後のブロック", L("n : 1 +", "", "\t2", "", "n"), "SyntaxError"],
	["`:` の右の空行の後のブロック", L("p :", "", "\tx : 1", "", "p"), "SyntaxError"],
	["`?` の右のコメントの行の後のブロック", L("f : x ?", "` 本体", "\tx + 1", "", "f 1"), "SyntaxError"],
	["行末の演算子の右のコメントの行の後のブロック", L("n : 1 +", "` 足す", "\t2", "", "n"), "SyntaxError"],
	["ブロックの中の `:` の右のコメントの行の後のブロック", L("f : x ?", "\ty :", "` 中身", "\t\t1", "\ty", "", "f 1"), "SyntaxError"],
	["文字の改行の後の演算子はこの規則の外", L("x : 1 \\", ", 2"), "(: x (, (construct 1 \\\n) 2))"],
	["括りの中の演算子の行は2行の括り（値は未決）", L("y : (1", "+ 2) * 3"), "(: y (* [1 ⏎ + 2] 3))"],
	["ブロックの後の空行の後の空白", L("f : x ?", "\tx", "", " * 2"), "SyntaxError"],
	["ブロックの中の空行は越える", L("f : x ?", "\tx", "", "\t + 1", "", "f 1"), "(apply f 1)"],
	["括りの中の空行は越える", L("a : [", "\t1", "", "\t + 2", "]"), "(: a [1 + 2])"],
	["仮引数のブロックの中の空行は越える", L("f :", "\t\tx", "", "\t? x", "", "f 1"), "(apply f 1)"],
	["コメントの行の後の空白", L("width : 640", "` 幅", " + 16"), "SyntaxError"],
	["行末の演算子とコメントの行の後の空白", L("1 +", "` 足す", " 1"), "SyntaxError"],
	["コメントの行の後の `?` の行", L("f : x", "` 本体", "\t? x", "", "f 1"), "SyntaxError"],
	["仮引数のブロックとコメントの行の後の `?` の行", L("f :", "\t\tx", "` 本体", "\t? x", "", "f 1"), "SyntaxError"],
	["空行とコメントの行の後の空白", L("qq : 1", "", "` 足す", " 2"), "SyntaxError"],
	["文の間のコメントの行は通る", L("f : x ?", "\tx", "` 次の行", "\tx + 1", "", "f 1"), "(apply f 1)"],
	["式の上のコメントの行は通る", L("` 幅に余白を足す", "width : 640", " + 16"), "(: width (+ 640 16))"],
	["`?` の行は定義の行", L("f : x", "\t? x", "", "f 1"), "(apply f 1)"],
	["文字の改行の後の空白は続き", L("hello : `hello` \\", " `world`"), "(: hello (construct `hello` \\\n `world`))"],
];

let passed = 0;
let total = 0;
const ok = (name) => { console.log(`OK   ${name}`); passed++; };
const fail = (name, why) => console.log(`FAIL ${name}\n     ${why}`);

for (const [name, src] of passes) {
	total++;
	try {
		parser.parse(preprocess(src));
		ok(name);
	} catch (e) {
		fail(name, `通るはずが断られた: ${e.reason || e.name}: ${e.message}`);
	}
}

for (const [name, src, reason] of refuses) {
	total++;
	try {
		parser.parse(preprocess(src));
		fail(name, `断るはずが通った（期待した理由: ${reason}）`);
	} catch (e) {
		if (e.reason === reason) ok(name);
		else fail(name, `理由が違う: ${e.reason || e.name}: ${e.message}`);
	}
}

for (const [name, src, want] of continuation) {
	total++;
	let got;
	try {
		const r = resolve(src + "\n");
		got = show(r.trees.at(-1));
	} catch (e) {
		got = e.reason || e.name;
	}
	if (got === want) ok(`続きの行 ${name}`);
	else fail(`続きの行 ${name}`, `got: ${got}\n     want: ${want}`);
}

for (const [name, src, want] of treeCases) {
	total++;
	try {
		const got = JSON.stringify(parser.parse(preprocess(src))[0]);
		if (got === JSON.stringify(want)) ok(name);
		else fail(name, `got: ${got}\n     want: ${JSON.stringify(want)}`);
	} catch (e) {
		fail(name, `通るはずが断られた: ${e.reason || e.name}: ${e.message}`);
	}
}

// 行頭のコメントの行は行の番号で数える。ソースに生の U+001F だけの行があっても、コメントの行と取り違えて黙って
// 読み捨てない（以前は印の文字と見分けが付かなかった）。
total++;
try {
	parser.parse(preprocess(L("x : 1", "\u001f", "y : 2")));
	fail("生の U+001F の行は読み捨てない", "通った（コメントの行の印と取り違えている）");
} catch (e) {
	if (e.name === "SyntaxError") ok("生の U+001F の行は読み捨てない");
	else fail("生の U+001F の行は読み捨てない", `${e.reason || e.name}: ${e.message}`);
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
