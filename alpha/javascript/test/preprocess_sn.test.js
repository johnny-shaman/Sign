/**
 * Sign 自身で書いた前処理器（`alpha/sign/preprocess.sn`）が、JS 実装（`lexer.js` の
 * `preprocess`）と**同じ仕事**をすることを確認する。
 *
 * 比較はバイト一致ではなく**パース結果の一致**で行う。前処理の仕事はパーサが読める形に
 * することであり、空行やマーカーの細かい位置は、同じ木を渡す限り違っていてよい。
 * （実際 `.sn` 側は空行を落とすが、空行は意味を持たないので木は変わらない。）
 *
 * 実行: node test/preprocess_sn.test.js（`npm test` からも呼ばれる）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";
import * as I from "../interpreter.js";
import { preprocess } from "../lexer.js";
import { parse } from "../parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snPath = path.join(__dirname, "..", "..", "sign", "preprocess.sn");
// **インポートを解く手段は呼ぶ側が渡す**（build_system.md §4.2）。`preprocess.sn` が
// 演算子表を読むようになったので、ここでも渡す——渡さないと `compile` が投げ、この
// ファイルは1件も報告しないまま終わる（「29/31 ファイル」で気づいた）。
const readImport = (p) => fs.readFileSync(path.join(__dirname, "..", "..", "sign", p), "utf8").replace(/\r\n/g, "\n");

let passed = 0;
let total = 0;

function check(note, ok, detail) {
	total++;
	if (ok) {
		console.log(`OK   ${note}`);
		passed++;
	} else {
		console.log(`FAIL ${note}`);
		if (detail) console.log(detail);
	}
}

// `preprocess.sn` を読み込み、末尾の実行例を落として関数群だけを環境へ束縛する。
const src = fs.readFileSync(snPath, "utf8").replace(/\r\n/g, "\n");
const base = src.split("\n").filter((l) => !l.startsWith("preprocess `")).join("\n");
const { nodes, env } = compile(base, { readImport });
const renv = I.newRuntimeEnv(env);
for (const n of nodes) I.evaluate(n, renv);

// 入力は識別子経由で渡す。Sign の文字列リテラルに改行やバッククォートは書けないため。
function runSn(text) {
	I.envDefine(renv, "<__in__>", text);
	return String(
		I.evaluate(
			{
				type: "operation",
				name: "apply",
				left: { type: "atom", kind: "identifier", value: "<preprocess>" },
				right: { type: "atom", kind: "identifier", value: "<__in__>" },
			},
			renv
		)
	);
}

const astOf = (s) => {
	try {
		return JSON.stringify(parse(s));
	} catch (e) {
		return "PARSE_FAIL: " + e.message.slice(0, 60);
	}
};
const show = (s) => JSON.stringify(s).replace(/\u0002/g, "→").replace(/\u0003/g, "←");

function same(note, input) {
	const sn = runSn(input);
	const js = preprocess(input);
	const a = astOf(sn);
	const b = astOf(js);
	check(`${note}: ${show(input)}`, a === b, `     sn: ${show(sn)}\n     js: ${show(js)}`);
}

// ---- 1. 中置演算子の両側へ空白を入れる ----
same("1文字の中置演算子", "a+b*c");
same("定義とラムダ", "f : x ? x + 1");
same("2文字の中置演算子", "a==b");
same("3文字の中置演算子", "a===b");
// 多義的な演算子には空白を入れない。`-` は負号、`|` は絶対値、`~` は残余にもなる。
same("多義的な演算子は区切らない", "-1 |x| ~xs");
// 文字列・エスケープ・コメントの中身は保護する。
same("文字列の中は保護する", "s : `a+b`");
same("エスケープの中も保護する", "c : \\+");
// `!!` は1つの記号（前置の bitNOT）。二重否定は要らないので `!` 2つには読まず、後ろの `=` と組んで `!=` にもしない。
same("!! は1つの記号", "a : !!=b");
same("!! は前置の bitNOT", "x : 5\n!!x");

// ---- 2. タブ深さから INDENT / DEDENT を作る ----
same("1段深くなる", "a\n\tb");
same("深くなって戻る", "a\n\tb\nc");
same("2段深くなる", "a\n\t\tb\nc");
// 末尾の DEDENT はファイル末尾で閉じる。空判定は否定演算子で行う——`|x| = 0` は
// 裸の仮引数（`Atom`）では型が決まらず吸収元へ倒れるので使えない（unit.md）。
same("末尾のインデントを閉じる", "f : x ?\n\tx + 1");
same("空行は深さに影響しない", "a\n\nb");
same("空行を挟んでも DEDENT は直前の内容行に付く", "a\n\tb\n\nc");

// ---- 括弧の中ではインデントを無効化する ----
//
// 括弧の中で見やすさのためにタブを深くする書き方があるため、深さの変化を INDENT/DEDENT に
// してはいけない。文法上、開き括弧の直後と閉じ括弧の直前に改行を置けないので、
// 開いた直後の行と閉じる行は前の行へ直結させる。
same("ブラケットの中はインデントしない", "p : [\n\tx : 1\n\ty : 2\n]");
same("括弧でも同じ", "f : (\n\ta\n\tb\n)");

// ---- 継続行 ----
//
// 行頭が中置演算子で始まる行は、前の行の続きとして空白で繋ぐ。
same("行頭の中置演算子は前の行へ繋ぐ", "x\n+ 1");
same("インデントの中でも繋ぐ", "f : x ?\n\tx\n\t+ 1");

// ---- 改行の2つの役割（preprocessor.md §0） ----
//
// 最初の走査で、エスケープの直後の改行を LF（文字の改行）に、それ以外を CR（処理の区切り）に分ける。
// 以前は両方の前処理が同じように間違っていた（一致だけでは見えない）ので、ここは形も並べる。
same("CRLF をそろえずに通す", "a : 1\r\nb : 2\r\na + b");
same("裸の CR も改行1個", "a : 1\rb : 2");
same("文字の改行の後の空白は余積", "t : `L1` \\\n `L2`");
same("CRLF の文字の改行も LF 1個", "t : `L1` \\\r\n `L2`");
same("文字の改行の次の行は同じ処理行（行頭の + でもつながない）", "a : \\\n+ 1");
same("ブロックの中の続きの TAB は揃えとして落とす","f : x ?\n\tx = 1 : `a` \\\n\t `b`\n\t`c`");
same("コメント行の末尾のエスケープは改行を食わない", "`note \\\na : 5");
same("ブロックの中の空行は読み捨てる", "f : x ?\n\tx = 1 : 10\n\n\t20");
same("文字列の中のエスケープの記号はただの文字", "s : `a\\`\nb");

// 行頭のコメントは最初の走査が判別して読み捨てる。**括弧の中と TAB の後はコメントにならない**——文法が
// `comment` を試さない場所で最初の走査だけがコメントと見ると、`\` + 改行が CR のまま文字に食われていた。
// 両方の前処理が同じように間違っていたので、ここはパースできることも確かめる。
function sameParsed(note, input) {
	same(note, input);
	const js = astOf(preprocess(input));
	check(`${note}: パースできる`, !js.startsWith("PARSE_FAIL"), `     js: ${js}`);
}
sameParsed("括弧の中の TAB の後の文字列はコメントにならない", "xs : [\n\t`a`, `b` \\\n\t `c`\n]");
sameParsed("括弧の中は0列目でもコメントにならない", "xs : [(\n`a`) , \\\n `b`\n]");
sameParsed("ブロックの中の文字列はコメントにならない", "f : x ?\n\t`abc`'0 = x : `y` \\\n\t `z`\n\t0");
sameParsed("同じ処理行で開いた括弧の中の続きは TAB をすべて落とす", "msg : [`Line 1` \\\n\t `Line 2`]");
sameParsed("括弧が閉じた後の \\ + 改行の続きの TAB も揃えとして落とす", "a : [1\n2] \\\n\t\t\t 3");
sameParsed("ブロックの中で深く揃えた \\ + 改行の続き", "f : x ?\n\tx = 1 : `a` \\\n\t\t\t `b`\n\t`c`");
sameParsed("行頭のコメントは生のテキストで判別する", "x : 5\n`a`,`b`\nx");
sameParsed("行頭のコメントの末尾の \\ は後の段が判別し直さない", "x : 5\n`a`,\\\n");
sameParsed("コメント行の次の字下げは前のコードの行へ付く", "f : x ?\n`note\n\tx + 1");
sameParsed("空白だけの行は空の行", "a\n  \nb");
sameParsed("ブロックの中の空白だけの行も空の行", "f : x ?\n\tx = 1 : 10\n \t \n\t20");

// 行頭の空白は前の行の続き（preprocessor.md §0）。括弧の中でも同じで、演算子で始まる行も括弧の中でつなぐ。
sameParsed("1 + の次の行頭の空白", "1 +\n 1");
sameParsed("括弧が閉じた後の行頭の空白", "[\n 1 + 1\n]\n * 2");
sameParsed("行末の空白と演算子で始まる行", "[\n 1 + 1\n] \n* 2");
sameParsed("\\ + 改行の後の行頭の空白", "t :\n `Hello` \\\n `World!`");
sameParsed("ブロックの後の0列目の続き", "m : x ?\n\tx\n\tx + 1\n * 10");
sameParsed("TAB の後の空白は最後の行の続き", "f : x ?\n\tx = 1 : 10\n\t + 1\n\t20");
sameParsed("括弧の中の行頭の空白", "(1\n + 1)");
sameParsed("括弧の中の演算子で始まる行", "xs : [1\n, 2\n, 3]");
sameParsed("括弧の中の TAB で揃えた行は別の要素", "m : [\n\t1 2 3\n\t4 5 6\n]");
sameParsed("行頭の | は空白が続くときだけ続き（括弧の中）", "xs : [\n\ta\n\t| b\n\t||c||\n]");
sameParsed("コメント行を越えてつなぐ", "x : 1\n`note\n 2");

// ---- 実ファイルを一巡させる ----
//
// 合成した例ではなく、実際に書かれている Sign のコード全体で一致すること。
// **`preprocess.sn` 自身を含む**——前処理器が自分のソースを処理できないなら、
// 自己ホストへの道が最初の一段で途切れていることになる。
for (const rel of [
	["sign", "lexer.sn"],
	["sign", "parser.sn"],
	["sign", "preprocess.sn"],
]) {
	const p = path.join(__dirname, "..", "..", ...rel);
	// **改行はそろえずに渡す。** 以前はここで CRLF を LF に直してから渡していて、preprocess.sn が CRLF を
	// 読めないことを隠していた（CR が行に残ってパースに落ちる）。改行を分けるのは前処理の仕事である。
	const text = fs.readFileSync(p, "utf8");
	const lines = text.split("\n").length;
	const sn = runSn(text);
	const js = preprocess(text);
	check(
		`${rel[1]}（${lines} 行 / ${text.length} 文字）`,
		astOf(sn) === astOf(js),
		`     sn: ${astOf(sn).slice(0, 90)}\n     js: ${astOf(js).slice(0, 90)}`
	);
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
