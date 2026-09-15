/**
 * **改行の2つの役割**（preprocessor.md §0、利用者の決定 2026-09-15）。
 *
 * 前処理の最初の走査が、エスケープ（`\`）の直後の改行を LF（文字の改行）に、それ以外の改行を
 * CR（処理の区切り）に分ける。ディスク上の CRLF・LF・CR はどれも改行1個である。
 *
 * 以前は改行が1種類の符号で、後の段が「この改行はどちらの役割か」を推測していた。下の多くは、
 * JS と Sign の前処理が**同じように**間違っていた形（一致を見る preprocess_sn.test.js では見えない）
 * なので、ここは値そのものを書く。
 *
 * 実行: node test/newline_channels.test.js
 */
import { compile } from "../compile.js";
import { evaluate, newRuntimeEnv, UNIT, observe, isUnit } from "../interpreter.js";
import { preprocess, classifyNewlines } from "../lexer.js";
import { parse } from "../parser.js";

let passed = 0;
let total = 0;
const BS = "\\";

function check(note, got, want) {
	total++;
	if (got === want) {
		passed++;
		console.log(`OK   ${note}`);
	} else {
		console.log(`FAIL ${note}\n     got:  ${got}\n     want: ${want}`);
	}
}

function run(source) {
	try {
		const { nodes } = compile(source, { charset: "ascii" });
		const env = newRuntimeEnv(null, "ascii");
		let r = UNIT;
		for (const n of nodes) r = evaluate(n, env);
		return isUnit(r) ? "__" : JSON.stringify(observe(r));
	} catch (e) {
		return "止:" + (e.reason || e.message).split("\n")[0].slice(0, 60);
	}
}

// ---- ディスク上の改行はどれも改行1個 ----
check("LF のソース", run("a : 1\nb : 2\na + b"), "3");
check("CRLF のソース", run("a : 1\r\nb : 2\r\na + b"), "3");
check("裸の CR のソース", run("a : 1\rb : 2\ra + b"), "3");

// ---- 最初の走査の出力：改行は CR、LF はエスケープの直後にだけある ----
const cls = classifyNewlines("a : `x`\r\nb : " + BS + "\r\n c\nd : " + BS + "\n");
check("CRLF の処理の区切りは CR 1個", cls.includes("\r\n"), false);
check("エスケープの直後の CRLF は LF 1個", cls.includes(BS + "\n c"), true);
check("エスケープの直後以外に LF は無い", /(^|[^\\])\n/.test(cls), false);
check("前処理の出力も同じ", /(^|[^\\])\n/.test(preprocess("f : x ?\n\tx = 1 : `a` " + BS + "\n\t `b`\n\t`c`")), false);

// ---- 文字の改行（string_and_comment.md §5 の例） ----
check("エスケープ + LF の後の空白は余積", run("text : `Line 1` " + BS + "\n `Line 2`\ntext"), JSON.stringify("Line 1\nLine 2"));
check("エスケープ + CRLF でも同じ値", run("text : `Line 1` " + BS + "\r\n `Line 2`\r\ntext"), JSON.stringify("Line 1\nLine 2"));
check("0u000A はエスケープ + 改行と同じ文字", run("c : 0u000A\nd : " + BS + "\n\nc = d"), JSON.stringify("\n"));

// ---- 文字の改行の次の行は、0列目から始まっても同じ処理行 ----
// 以前は区切りにもなって、`L2` が黙ってコメントになり値は "L1\n" だった。今は密着した2つの項なので構文エラー。
check("文字の改行の次の0列目の文字列は黙ってコメントにならない", run("t : `L1` " + BS + "\n`L2`\nt").startsWith("止:"), true);
// 以前は次の行へつなぐ処理が LF を空白に替えて `!` になっていた。今は文字の改行（10）に 1 を足した文字。
check("文字の改行の次の + 1 は同じ処理行", run("a : " + BS + "\n+ 1\na"), JSON.stringify(""));

// ---- ブロックの中の続き：深さぶんの TAB は字下げ ----
check("ブロックの中で式を折り返す（腕1）", run("f : x ?\n\tx = 1 : `a` " + BS + "\n\t `b`\n\t`c`\nf 1"), JSON.stringify("a\nb"));
check("ブロックの中で式を折り返す（腕2）", run("f : x ?\n\tx = 1 : `a` " + BS + "\n\t `b`\n\t`c`\nf 2"), JSON.stringify("c"));

// ---- コメントと空行 ----
check("コメント行の末尾のエスケープは改行を食わない", run("`note " + BS + "\na : 5\na"), "5");
check("ブロックの中の空行は読み捨てる", run("f : x ?\n\tx = 1 : 10\n\n\t20\nf 2"), "20");
check("空白だけの行も空の行", run("a : 1\n  \na"), "1");

// ---- 行頭のコメントは最初の走査が判別して読み捨てる（後の段は判別し直さない） ----
check("コメントの行は最初の走査で消える", classifyNewlines("`c`x\na"), "\ra");
// 判別は生のテキストの上（string_and_comment.md §2）。以前は文法が separateInfix の後で判別し直し、
// `,` の前後に空白が入るので式に読んでいた。エディタの色（生のテキスト）とも食い違っていた。
check("閉じの直後が , ならコメント", run("x : 5\n`a`,`b`"), "5");
check("コメントの末尾の \\ + 改行はファイル末尾でも断らない", run("x : 5\n`a`," + BS + "\n"), "5");
// 以前は字下げの行がコメントの行に付いて、コメントに飲まれて黙って消えていた。
check("コメント行の次の字下げは前のコードの行へ付く", run("f : x ?\n`note\n\tx + 1\nf 2"), "3");

// ---- 括弧の中と TAB の後はコメントにならない（string_and_comment.md §3） ----
// 以前は最初の走査だけがコメントと見て `\` + 改行を CR のまま渡し、文法の文字が CR を食って値に入った。
check("括弧の中の TAB の後の文字列", run("xs : [\n\t`a`, `b` " + BS + "\n\t `c`\n]\nxs"), JSON.stringify(["a", "b\nc"]));
check("括弧の中の0列目の文字列", run("xs : [(\n`a`) , " + BS + "\n `b`\n]\nxs"), JSON.stringify(["a", "\nb"]));
check("ブロックの中の文字列", run("f : x ?\n\t`abc`'0 = x : `y` " + BS + "\n\t `z`\n\t0\nf " + BS + "a"), JSON.stringify("y\nz"));
// 前処理を通すと `\` + CR は LF になるので、文法だけを直接見る。前処理と文法がまた食い違っても、CR は値に入らず構文エラーで止まる。
const parses = (s) => { try { parse(s); return true; } catch { return false; } };
check("文法の文字は CR を取らない（CR は区切り）", parses("c : " + BS + "\r"), false);
check("文法の文字は LF を取る（文字の改行）", parses("c : " + BS + "\n"), true);

// ---- `\` + 改行の後の TAB は揃えとしてすべて落とす ----
// CR の後の続きの行で深い TAB を読み捨てるのと同じ扱い。以前は処理行の頭の深さで1回だけ決めていたので同じ行で
// 開いた括弧の中の TAB が残って構文エラーになり、その後は物理行の頭の TAB の数で決めていたので、揃えた続きの行の
// 後だけ多く落ちた。
check("同じ処理行で開いた括弧の中の続き", run("msg : [`Line 1` " + BS + "\n\t `Line 2`]\nmsg"), JSON.stringify("Line 1\nLine 2"));
check("括弧が閉じた後の続きの TAB も揃え", run("a : [1\n2] " + BS + "\n\t\t\t 3\na"), run("a : [1\n2] " + BS + "\n 3\na"));
check("\\ + 改行の後と改行の後で TAB の扱いが同じ", run("x : `a` " + BS + "\n\t `b`\nx"), JSON.stringify("a\nb"));
check("ブロックの中で深く揃えた \\ + 改行の続き", run("f : x ?\n\tx = 1 : `a` " + BS + "\n\t\t\t `b`\n\t`c`\nf 1"), JSON.stringify("a\nb"));

// ---- 文字列は行をまたがない ----
// 以前は続きの行がつながった後の段で閉じが見つかり、2行にまたがる文字列が黙ってできた（`a  b`）。
check("閉じない文字列は断る", run("s : `a\n b`\ns").startsWith("止:文字列が行の終わりまでに閉じていません"), true);
check("続きの行で閉じても断る（括弧の外の数え方も狂わない）", run("s : `a\n [b`\nf : x ?\n\tx + 1\nf 1").startsWith("止:文字列が行の終わりまでに閉じていません"), true);

// ---- 行頭の | || ~ が続きなのは空白（U+0020）が続くときだけ ----
// 値ではどちらも構文エラーになる（行の途中の TAB）ので、前処理が区切りを残すかで見る。
check("| の後が TAB なら続きではない", preprocess("x : 0\n|\t3").includes("\r"), true);
check("|| の後が TAB なら続きではない", preprocess("x : 0\n||\t3").includes("\r"), true);
check("| の後が空白なら続き", preprocess("x : 0\n| 3").includes("\r"), false);

// ---- 行頭の空白は前の行の続き（利用者の決定 2026-09-15、preprocessor.md §0） ----
// 空白は余積（あるいは中置演算子の前の空白）で、その左辺は前の行にある。字下げは TAB だけ。
// 以前は「空白インデント」として断っていた（その前は `\` + 改行の後だけ許していた）。
check("1 + の次の行頭の空白", run("1 +\n 1"), "2");
check("括弧が閉じた後の行頭の空白", run("[\n 1 + 1\n]\n * 2"), "4");
check("行末の空白ではなく演算子で始まる行", run("[\n 1 + 1\n] \n* 2"), "4");
check("行頭の空白は余積", run("x : 1\n 2\nx"), JSON.stringify([1, 2]));
check("\\ + 改行の後の行頭の空白（InEnter の形）", run("t :\n `Hello` " + BS + "\n `World!`\nt"), JSON.stringify("Hello\nWorld!"));
// 行末の空白は意味を持たない（画面で見えないので、次の行へ続く印にしない）。
check("行末の空白は続きの印ではない", run("x : 1 \n2\nx"), "1");
// 左辺が無い。空白は字下げではないので断る。コメント行は最初の走査で消えるので、その次でも同じ。
check("ファイル先頭の行頭の空白は断る", run(" 1").startsWith("止:行頭の空白は前の行の続き"), true);
check("コメント行だけの後の行頭の空白も断る", run("`note " + BS + "\n a : 5").startsWith("止:行頭の空白は前の行の続き"), true);

// ---- 続きの行とブロック：浅くなったぶんを閉じてからつなぐ ----
// 0列目の ` * 10` はブロック全体に掛かり（括弧の `]` の次と同じ）、`\t * 10` は最後の行に掛かる。
check("ブロックの後の0列目の続きはブロック全体に掛かる", run("m : x ?\n\tx + 1\n * 10\nm 1"), "20");
check("TAB の後の空白は最後の行の続き", run("f : x ?\n\tx = 1 : 10\n\t + 1\n\t20\nf 1"), "11");
check("TAB の後の空白の続きは枝を増やさない", run("f : x ?\n\tx = 1 : 10\n\t + 1\n\t20\nf 2"), "20");

// ---- 括弧の中でも同じ読み ----
// 以前は括弧の中だけ行頭の空白を黙って削り、演算子で始まる行もつながなかったので、`(1` の次の ` + 1` や `+ 1` は
// `1` と部分適用 `(+ 1)` の組になった。
check("括弧の中の行頭の空白", run("(1\n + 1)"), "2");
check("括弧の中の演算子で始まる行", run("(1\n+ 1)"), "2");
check("括弧の中の , で始まる行", run("xs : [1\n, 2\n, 3]\nxs"), JSON.stringify([1, 2, 3]));
check("括弧の中の TAB で揃えた行は別の要素のまま", run("m : [\n\t1 2 3\n\t4 5 6\n]\nm ' 1"), JSON.stringify([4, 5, 6]));

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
