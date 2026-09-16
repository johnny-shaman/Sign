/**
 * `alpha/sign/` に置いた「Sign 自身で書いたプログラム」の動作確認。
 *
 * 処理系の単体テストと違い、こちらは**まとまった量の実プログラム**が壊れていないかを見る。
 * 8-Queens（documents/ja-jp/guide/examples/n_queens.sn）と同じ役割で、
 * 個別機能のテストでは拾えない相互作用の回帰を検出することを狙っている。
 *
 * 実際、この2本を書く過程で pass2.js の余積解決のバグが1件見つかった
 * （`isListLike` が中身を見ずに括弧を全て List 扱いし、`` `x` (`y`) `` が
 * construct ではなく push へ落ちて String の連結が起きなかった）。
 *
 * 実行: node test/sign_programs.test.js
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";
import { evaluate, newRuntimeEnv, UNIT, isUnit, observe } from "../interpreter.js";
import { generateAsm } from "../pass4.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const grammar = fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8");
const parser = peggy.generate(grammar);
const signDir = path.join(__dirname, "..", "..", "sign");

// **インポートを解く手段は呼ぶ側が渡す**（build_system.md §4.2——`compile.js` は fs に
// 触らない。playground でも同じ道が通る必要があるため）。`parser.sn` が演算子表を
// 読むようになったので、ここでも渡す。
const readImport = (p) => fs.readFileSync(path.join(signDir, p), "utf8").replace(/\r\n/g, "\n");

// .sn ファイルを読んで実行し、最後の行の評価結果を返す。
function runFile(name) {
	const source = fs.readFileSync(path.join(signDir, name), "utf8");
	const { nodes } = compile(source, { parse: parser.parse, readImport });
	const env = newRuntimeEnv(null);
	let result = UNIT;
	for (const node of nodes) result = observe(evaluate(node, env));
	return result;
}

// ファイル本体（最終行の実行例）を差し替えて、別の入力で評価する。
function runWith(name, lastLine) {
	const source = fs.readFileSync(path.join(signDir, name), "utf8");
	const body = source.split("\n").filter((l) => l.trim() !== "");
	body[body.length - 1] = lastLine;
	const { nodes } = compile(body.join("\n"), { parse: parser.parse, readImport });
	const env = newRuntimeEnv(null);
	let result = UNIT;
	for (const node of nodes) result = observe(evaluate(node, env));
	return result;
}

let passed = 0;
let total = 0;

function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) {
		console.log(`OK   ${note}`);
		passed++;
	} else {
		console.log(`FAIL ${note}`);
		console.log(`     got: ${JSON.stringify(got)}, want: ${JSON.stringify(want)}`);
	}
}

// ---- lexer.sn ----
// **トークン列は平坦である。** カンマ（直積）で積むが、再帰の結果に後置 `~` を付けて
// 「相手のスロットを並べる」ので、段は残らない（余積の `~` との双対）。
//
// **型の上では cons、表現は平坦な配列**である（原理8：同型は型では無償、表現では有償）。
// 終端は `__` が signal し、直積の Unit は恒等射なので（`A × __ ≅ A`）末尾にスロットは
// 生まれない。
//
// 以前ここは入れ子（`["foo",["123",…]]`）を期待値に焼き込んでいた。検査の名前は
// 「5トークンへ分割する」と言っているのに、**期待値の方が段の深さを固定していた**
// ——`~` が無いと段が深くなり、大きさが静的に決まらず機械語にできない。
check(
	"lexer.sn: `foo 123 + bar42` を5トークンへ分割する",
	runFile("lexer.sn"),
	["foo", "123", "+", "bar", "42"]
);

check(
	"lexer.sn: 数字と識別子の境界を正しく切る（bar42 → bar , 42）",
	runWith("lexer.sn", "tokens `bar42`"),
	["bar", "42"]
);

check("lexer.sn: 空文字列 → __", isUnit(runWith("lexer.sn", "tokens ``")), true);

check(
	"lexer.sn: 連続する空白を読み飛ばす",
	runWith("lexer.sn", "tokens `a   b`"),
	["a", "b"]
);

// 文字リテラルは直後の1バイトをそのまま取るため、空白・タブ・改行が同じ形で書ける
// （`\n` のようなエスケープシーケンスは存在しない）。lexer.sn の is_space はこの3種を見る。
const TAB = String.fromCharCode(9);
check(
	"lexer.sn: タブ区切りも空白として扱う",
	runWith("lexer.sn", "tokens `a" + TAB + "b`"),
	["a", "b"]
);
check("lexer.sn: is_space がタブに真を返す", runWith("lexer.sn", "is_space tab"), TAB);
check("lexer.sn: is_space が改行に真を返す", runWith("lexer.sn", "is_space newline"), "\n");
check("lexer.sn: is_space は通常文字に __ を返す", isUnit(runWith("lexer.sn", "is_space \\a")), true);

// ---- parser.sn ----
//
// **パース結果はそのまま Sign のプログラムである。** `1 + 2 * 3` は `[[+] 1 [[*] 2 3]]`
// になり、それを走らせると 7 が出る——`[+]` は畳み込みなので、S式がそのまま式である。
// だから中間表現は要らず、後段のコード生成は既にあるコンパイラそのものになる。
//
// 木を持たないので節の寿命という問題も出ない。再帰そのものが木であり、出力は流れる。
// 優先順位・左結合・優先順位跨ぎを、**出した文字列**と**それを評価した値**の両方で見る
// ——形だけ合っていて値が違う、という壊れ方を通さないためである。
function sexpr(lastLine) {
	return runWith("parser.sn", lastLine);
}
function evalSign(src) {
	const { nodes } = compile(src, { parse: parser.parse });
	const env = newRuntimeEnv(null);
	let result = UNIT;
	for (const node of nodes) result = observe(evaluate(node, env));
	return result;
}
function checkParse(note, tokens, want, infix) {
	const got = sexpr("expr " + tokens);
	check(note, got, want);
	check(note + "：走らせると中置と同じ", evalSign(String(got)), evalSign(infix));
}

check("parser.sn: 1 + 2 * 3", runFile("parser.sn"), "[[+] 1 [[*] 2 3]]");
checkParse("parser.sn: 1 * 2 + 3", "[`1` , `*` , `2` , `+` , `3`]", "[[+] [[*] 1 2] 3]", "1 * 2 + 3");
checkParse("parser.sn: 1 - 2 - 3（左結合）", "[`1` , `-` , `2` , `-` , `3`]", "[[-] [[-] 1 2] 3]", "1 - 2 - 3");
checkParse("parser.sn: 1 + 2 * 3 - 4", "[`1` , `+` , `2` , `*` , `3` , `-` , `4`]", "[[-] [[+] 1 [[*] 2 3]] 4]", "1 + 2 * 3 - 4");
check("parser.sn: 単項（7 のみ）", sexpr("expr " + "[`7`]"), "7");

// ---- 8-Queens（guide の例） ----
//
// **結果を固定していなかったので、壊れても気付けなかった。** 実際に一度壊した
// ——余積の規則を直したとき `(col board)` が「盤を1要素として足す」になり、答えが
// `[3 [1 [3 [1 …]]]]` という入れ子になった。テストが無ければ通ってしまう類の壊れ方で、
// 診断も出ない。処理系の単体テストでは拾えない相互作用そのものである。
{
	const p = path.join(__dirname, "..", "..", "..", "documents", "ja-jp", "guide", "examples", "n-queen");
	const runFile = (name) => {
		const source = fs.readFileSync(path.join(p, name), "utf8");
		const { nodes } = compile(source, { parse: parser.parse });
		const env = newRuntimeEnv(null);
		let result = UNIT;
		for (const node of nodes) result = observe(evaluate(node, env));
		return result;
	};
	check("n_queens.sn → 8クイーンの解", runFile("n_queens.sn"), [4, 2, 7, 3, 6, 8, 5, 1]);
	// コメントを落とした版も同じ答えを出す（コメントは命令を出さない）。
	check("コメント除去版も同じ解", runFile("n_queens.nocomment.sn"), [4, 2, 7, 3, 6, 8, 5, 1]);
}

// ---- Pass 3 の型の不動点は上限まで回らない ----
//
// 旗（「この周で書き換えた」）で回していた頃は、状態が数周で止まった後も2つの集め方が同じ欄を
// 書き換え合って旗が立ち続け、3本とも毎回上限（定義の数 + 2）まで回っていた。値は変わらないので
// 他の検査では見えず、ビルドの時間だけが入力に対して急に伸びる（自己ホストの規模では終わらない）。
// parser.sn の3回目は2周期（`end_of` / `end_at`）で、位相をそろえて止まることを見る。
for (const name of ["lexer.sn", "parser.sn", "preprocess.sn"]) {
	const fixpointStats = [];
	compile(fs.readFileSync(path.join(signDir, name), "utf8"), { parse: parser.parse, readImport, fixpointStats });
	check(`${name}: 型の不動点はどの回も上限の前で止まる`, fixpointStats.length > 0 && fixpointStats.every((s) => s.rounds < s.limit), true);
}
// ---- emit.sn：後段を Sign で書く最初の1枚 ----
//
// 自己ホストの後段は「綴りを文字として書き出す」形で書く（idiom_to_instructions.md）。この1枚は
// その形を使い切っている——位置で歩く、出来た端から書き出す、表を実行時の鍵で引く、外れは `__` を
// `|` で受ける、駆動行が全部を呼ぶ。**機械が出せることが要点**なので、値ではなく診断と出方を見る。
// `blr` が 0 なのは、`$` が静的に解けて実行時の関数値が無いことの裏返しである。
{
	const source = fs.readFileSync(path.join(signDir, "emit.sn"), "utf8");
	const { nodes, env, diagnostics } = compile(source, { parse: parser.parse, readImport });
	check("emit.sn: 前段の診断が無い", diagnostics.length, 0);
	const asm = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii", layer: 1 });
	check("emit.sn: 機械の診断が無い", asm.diagnostics.length, 0);
	check("emit.sn: blr を出さない", (asm.text.match(/^\tblr/gm) || []).length, 0);
	// 命令数は後段を直せば動く。桁が変わったら（半分・倍）気づけるだけの幅で見る。
	const count = (asm.text.match(/^\t[a-z]/gm) || []).length;
	check("emit.sn: 命令数はこの桁（500〜700、いまは 576）", count > 500 && count < 700, true);
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
