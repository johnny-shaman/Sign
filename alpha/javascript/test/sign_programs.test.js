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
// **語 ＝ 次の空白まで。** ただし文字列の中と括りの中の空白は数えない。
//
// Sign は中置演算子を必ず空白で区切る（`operator_table.md` の基本原則「全ての空白を余積
// 演算子と見なせる」）ので、文字クラスの最長一致は要らない——`is_digit` も `<=` も `!==` も、
// 空白に挟まれて最初から1語である。**空白で割ることが、余積の項を取り出すことそのもの**。
//
// だから `bar42` は切らない。以前は数字と英字を別クラスとして `bar` / `42` に割っていたが、
// それは**字句解析器が文法より細かく切っていた**ということで、識別子が壊れる。
//
// 括りは中へ降りずに丸ごと1語で返す。中身を字句へ投げ返すのは構文解析の仕事で、そこで
// 相互再帰する（**相互再帰は余積の入れ子そのもの**）。文字列だけは中を保護して二度と掛けない。
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
	"lexer.sn: `foo 123 + bar42` を4語へ分割する",
	runFile("lexer.sn"),
	["foo", "123", "+", "bar42"]
);

check(
	"lexer.sn: 識別子は数字を含んでも1語（bar42 を切らない）",
	runWith("lexer.sn", "tokens `bar42`"),
	["bar42"]
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

// ---- 字句解析器は、自分のソースを自分で割れる ----
//
// **語 ＝ 次の空白まで。ただし文字列の中と括りの中の空白は数えない。** その規則を JS でも
// 書いて、`lexer.sn` の各行で突き合わせる——**同じ規則の独立した2つの実装**であり、
// 期待値を書き置くのではなく、そのつど導く（書き置いた証人は腐る）。
//
// 括りが1語のまま返るのが要点である。`(s ' 0)` を `(s` / `'` / `0)` に割らないのは、
// **括りの中の空白は次の段の余積**だからで、中身を字句へ投げ返すのは構文解析の仕事になる。
//
// バッククォートを含む行は除く——この検査自身が行を Sign の文字列リテラルへ包むので、
// 中の `` ` `` が閉じてしまう（字句の側の問題ではない）。
{
	const BS = String.fromCharCode(92);
	const TB = String.fromCharCode(9);
	const BQ = String.fromCharCode(96);
	const raw = fs.readFileSync(path.join(signDir, "lexer.sn"), "utf8").replace(/\r\n/g, "\n");
	const body = raw.split("\n").filter((l) => !l.startsWith("tokens " + BQ)).join("\n");
	// 同じ規則の、もう一つの実装。
	const words = (s) => {
		const out = [];
		let cur = "";
		let d = 0;
		for (let i = 0; i < s.length; i++) {
			const ch = s[i];
			if (ch === BS) {
				cur += ch + (s[i + 1] || "");
				i++;
				continue;
			}
			if ("([{".includes(ch)) d++;
			if (")]}".includes(ch)) d--;
			if (d === 0 && (ch === " " || ch === TB)) {
				if (cur) out.push(cur);
				cur = "";
				continue;
			}
			cur += ch;
		}
		if (cur) out.push(cur);
		return out;
	};
	const run = (line) => {
		const { nodes } = compile(body + "\ntokens " + BQ + line + BQ, { parse: parser.parse, readImport });
		const env = newRuntimeEnv(null);
		let r = UNIT;
		for (const node of nodes) r = evaluate(node, env);
		const o = observe(r);
		return (Array.isArray(o) ? o : o === undefined || o === null ? [] : [o]).map(String);
	};
	let lines = 0;
	let toks = 0;
	let bad = 0;
	for (const line of raw.split("\n")) {
		const s = line.replace(/\r/g, "");
		if (!s.trim() || s.includes(BQ)) continue;
		lines++;
		const got = run(s);
		toks += got.length;
		if (JSON.stringify(got) !== JSON.stringify(words(s))) {
			bad++;
			console.log(`     ${JSON.stringify(s)}`);
			console.log(`       got: ${JSON.stringify(got)}`);
			console.log(`      want: ${JSON.stringify(words(s))}`);
		}
	}
	check("lexer.sn: 自分のソースの全行を語に割る（食い違い 0）", bad, 0);
	// **前提も見る。** 行が拾えていなければ比較は1度も走らず、緑は何も意味しない。
	check("lexer.sn: 語に割った行数と語数（前提）", lines >= 40 && toks >= 180, true);
}

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

// **並置は綴りを持たない段である。**
//
// 適用・連接・合成はどれも「間に何も無いこと」が演算子で（表の 10.0〜10.5）、表は綴りを
// 鍵に引くので、この段だけは引けない。**空白が余積演算子そのもの**なので、字句がそれを
// 食った後に構文へ残るのは**隣接という事実だけ**になる——他の段が「その綴りが来たか」で
// 進むのに対し、この段は「演算子が来なかったか」で進む。
//
// 段は 11（表の 10.x）で、**算術より弱い**。`1 + f 1` は `(1 + f) 1` であって `1 + (f 1)`
// ではない。ここを取り違えて「並置が一番強い」と置くと、規則そのものを作り変えてしまう
// ——実測で解釈器と割れて気づいた（解釈器 1 ／ 作り変えた側 3）。
//
// **同じ段の中の結び方は Sign に任せ、連なりは平らなまま出す。** 最初は左結合で2つずつ括って
// いた（`h 5 2` → `((h 5) 2)`）。関数の適用ならそれで同じ値だが、値どうしの並置は**構築**で
// 平らな器になる——`1 2 3` が `((1 2) 3)` = `[[1 2] 3]` に、`1 d 2` が `[10 2]`（中置は
// `[1 20]`）に化けていた。Sign の並置は連なりごと型とアリティで解くので、`(h 5 2)` と
// そのまま渡せば中置と同じになる。
{
	const D = "f : x ? x + 1\nh : x y ? x - y\nd : n ? n * 10\n";
	const pj = (note, toks, want, infix) => {
		const got = sexpr("expr " + toks);
		check(note, got, want);
		check(note + "：走らせると中置と同じ", evalSign(D + String(got)), evalSign(D + infix));
	};
	pj("parser.sn: 適用 f 1", "[`f` , `1`]", "(f 1)", "f 1");
	pj("parser.sn: 連なりは平らに h 5 2", "[`h` , `5` , `2`]", "(h 5 2)", "h 5 2");
	pj("parser.sn: 値の並置は構築 1 2 3", "[`1` , `2` , `3`]", "(1 2 3)", "1 2 3");
	pj("parser.sn: 型で決まる並置 1 d 2", "[`1` , `d` , `2`]", "(1 d 2)", "1 d 2");
	pj("parser.sn: 算術は適用より強い f 1 + 1", "[`f` , `1` , `+` , `1`]", "(f [[+] 1 1])", "f 1 + 1");
	pj("parser.sn: 括りは1語のまま項になる", "[`f` , `(h 5 2)`]", "(f (h 5 2))", "f (h 5 2)");
}

// **止まること、読めない演算子を項にしないこと。**
//
// 末尾が演算子（`1 +`・`a :`）だと、並置の段が長さを跨いで回り続けていた（両エンジンとも
// 停止しない）。演算子の字だけでできた語（`===`・`!`・`><`）は、表に中置として無ければ読めない
// 演算子であって項ではない——項として数えると `((1 ===) 2)` という誤った木が黙って出た。
check("parser.sn: 末尾の演算子で止まる 1 +", isUnit(sexpr("expr [`1` , `+`]")), true);
check("parser.sn: 廃止された綴りを項にしない 1 === 2", isUnit(sexpr("expr [`1` , `===` , `2`]")), true);
check("parser.sn: 前置だけの ! を項にしない a ! b", isUnit(sexpr("expr [`a` , `!` , `b`]")), true);

// **結合の向きが違う演算子を、括らずに1つの連なりへ混ぜない。** 同じ段で向きが割れているのは
// get の `'`（左）と `@`（右）だけで、`s @ r ' t` は `(s @ r) ' t` とも `s @ (r ' t)` とも
// 読める。pass2 は名指しで断る（`assoc.test.js`）。parser.sn は向きが変わった所で連なりを止め、
// 入口の長さの検査が `__` を返す——知らない綴りを断るのと同じ道である。
check("parser.sn: 向きの違う get を混ぜない s @ r ' t", isUnit(sexpr("expr [`s` , `@` , `r` , `'` , `t`]")), true);
check("parser.sn: 向きの違う get を混ぜない s ' r @ t", isUnit(sexpr("expr [`s` , `'` , `r` , `@` , `t`]")), true);
check("parser.sn: 同じ向きの連なりは右から a @ b @ c", sexpr("expr [`a` , `@` , `b` , `@` , `c`]"), "[[@] a [[@] b c]]");
check("parser.sn: 弱い段で切れていれば混在ではない", sexpr("expr [`a` , `'` , `b` , `+` , `c` , `@` , `d`]"), "[[+] [['] a b] [[@] c d]]");
check("parser.sn: 並置で切れていれば混在ではない", sexpr("expr [`f` , `0` , `@` , `l` , `l` , `'` , `2`]"), "(f [[@] 0 l] [['] l 2])");
check("parser.sn: 並置の中でも1つの連なりなら混ぜない", isUnit(sexpr("expr [`g` , `0` , `@` , `m` , `'` , `1`]")), true);

// **`[[op] L R]` ≡ `L op R`——区間は位置で被演算子を取る。**
//
// parser の出力はこの同値に乗っている（だから中間表現が要らない）。以前は両辺が値のときだけ
// 成り立ち、片方が関数だと割れていた:
//
//     1 + d      = __     中置：算術の相手が `Lambda` なので零射（表の ※1）
//     [[+] 1 d]  = 10     器の中で `1 d` が先に逆適用へ解決されてから畳まれていた
//
// 区間 `[op]` にアリティが無く、被演算子どうしが**型で**先に結び付いていたのが根だった。
// Lisp の `(+ 1 d)` と同じく、頭の区間が連なりの残りを**位置で**取るようにした（pass2 の
// `foldHeadSections`）。`[:]` と `[?]` も同じ木——`[:] f [?] y [*] y y` は `f : y ? y * y`
// （`kan_extensions.md` §3.7）で、こちらは字句の段で中置へ脱糖する（`desugarSections`）。
//
// 壊してはいけない読みも並べる：被演算子が1つなら器の要素を歩く／区間どうしは合成が先。
{
	const D = "d : x ? x * 10\n";
	const show = (src) => { const v = evalSign(src); return isUnit(v) ? "__" : Array.isArray(v) ? JSON.stringify(v) : String(v); };
	check("中置と区間：両辺が値なら同じ", [show("1 + 2"), show("[[+] 1 2]")], ["3", "3"]);
	check("中置と区間：`__` でも同じ", [show("1 + __"), show("[[+] 1 __]")], ["1", "1"]);
	check("中置と区間：片方が関数でも同じ（以前は 10 に割れていた）", [show(D + "1 + d"), show(D + "[[+] 1 d]")], ["__", "__"]);
	check("区間：被演算子が1つなら器の要素を歩く", show("[+] [1 2 3]"), "6");
	check("区間：区間どうしは合成が先（写像と畳み込み）", show("[* 2,] [+] 1 2 3 4 5"), "30");
	// **3項からも同じ木。** 畳む向きは表が言い（右結合は右から）、比較の3項は連鎖比較である。
	// 左畳みで決め打ちしていたので `[^] 2 3 2` が 64、`[<] 5 7 10` が 5 と、中置から割れていた。
	const M = "m : [10 20] , [30 40]\n";
	const both = (note, sec, inf, pre = "") => check(note, show(pre + sec), show(pre + inf));
	both("区間：右結合は右から畳む（冪）", "[^] 2 3 2", "2 ^ 3 ^ 2");
	both("区間：右結合は右から畳む（積）", "[,] 1 2 3", "1 , 2 , 3");
	both("区間：右結合は右から畳む（get の @）", "[@] 0 1 m", "0 @ 1 @ m", M);
	both("区間：左結合は左から畳む", "[-] 10 3 2", "10 - 3 - 2");
	both("区間：比較の3項は連鎖比較（中央が返る）", "[<] 5 7 10", "5 < 7 < 10");
	both("区間：比較の3項は連鎖比較（偽）", "[<] 0 5 3", "0 < 5 < 3");
	const why = (src) => { try { evalSign(src); return "通った"; } catch (e) { return e.message; } };
	check("区間：推移的でない比較は中置と同じく断る", why("[!=] 1 2 3"), why("1 != 2 != 3"));
	check("区間：4項の比較は中置と同じく断る", why("[<] 1 2 3 4"), why("1 < 2 < 3 < 4"));

	// `[:]` と `[?]`。中置の同じ形と、使い方（部分適用まで）ごとに値が同じであること。
	const same = (note, sec, inf, use) => check(note, show(sec + "\n" + use), show(inf + "\n" + use));
	same("[:] x 20 は x : 20", "[:] x 20", "x : 20", "x");
	same("[:] f [?] y [*] y y は f : y ? y * y（仕様の例）", "[:] f [?] y [*] y y", "f : y ? y * y", "f 7");
	same("[?] x y B は2引数（部分適用）", "f : [?] x y (x - y)", "f : x y ? x - y", "g : f 10\ng 3");
	same("[?] [x y] B は器1つ（部分適用）", "f : [?] [x y] (x - y)", "f : [x y] ? x - y", "g : f 10\ng 3");
	same("[:] の右辺のラムダ", "[:] f ([?] x (x + 1))", "f : x ? x + 1", "f 5");
}

// ---- 字句 → 構文 → S式 → 走らせる：定義とラムダ ----
//
// **S式は構文木の表現で、そのまま走る。** `[:] f [[?] x y [[-] x y]]` は
// `(define f (lambda (x y) (- x y)))` と同じ木である（`kan_extensions.md` §3.7——`[:]` は環境を
// 拡張する射、`[?]` はカリー化の随伴）。
//
// 出し方の決まりは2つ：**文の頭の定義は外括りを付けない**（Sign の括りはスコープなので、
// `[[:] x 20]` は構造体の欄 `{x: 20}` になって外から見えない）。**`?` の仮引数は並べて出す**
// （`(x y)` と `[x y]` は字句で区別されず、括ると器を分解する仮引数に変わる——`x y ?` は
// 2引数、`[x y] ?` は器1つで、部分適用の値が違う）。
//
// 往復した値が、ソースを直に走らせた値と同じことを見る。部分適用で2引数と器1つが割れる形まで。
{
	const BQ = String.fromCharCode(96);
	const noExample = (name, re) => fs.readFileSync(path.join(signDir, name), "utf8").replace(/\r\n/g, "\n").split("\n").filter((l) => !re.test(l)).join("\n");
	const CHAIN = noExample("lexer.sn", new RegExp("^tokens " + BQ)) + "\n" + noExample("parser.sn", /^expr \[/) + "\n";
	const run = (src) => {
		const { nodes } = compile(src, { parse: parser.parse, readImport });
		const env = newRuntimeEnv(null);
		let r = UNIT;
		for (const node of nodes) r = evaluate(node, env);
		const o = observe(r);
		return isUnit(r) || o === undefined || o === null ? "__" : typeof o === "object" ? (o.__lambda__ ? "(関数)" : JSON.stringify(o)) : String(o);
	};
	const toSexpr = (src) => run(CHAIN + "expr (tokens " + BQ + src + BQ + ")");
	check("字句→構文：定義は外括り無しで出す", toSexpr("x : 20"), "[:] x 20");
	check("字句→構文：2引数のラムダは仮引数を並べる", toSexpr("f : x y ? x - y"), "[:] f [[?] x y [[-] x y]]");
	check("字句→構文：器1つの仮引数はそのまま", toSexpr("f : [x y] ? x - y"), "[:] f [[?] [x y] [[-] x y]]");
	const roundTrip = (note, src, use) => check(note, run(toSexpr(src) + "\n" + use), run(src + "\n" + use));
	roundTrip("往復：定義", "x : 20", "x + 1");
	roundTrip("往復：1引数", "f : x ? x + 1", "f (f 1)");
	roundTrip("往復：2引数", "f : x y ? x - y", "f 10 3");
	roundTrip("往復：2引数の部分適用", "f : x y ? x - y", "g : f 10\ng 3");
	roundTrip("往復：器1つの部分適用", "f : [x y] ? x - y", "g : f 10\ng 3");
	roundTrip("往復：部分適用を束ねる", "g : 1 + 2", "g");
}

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

// ---- sret の計画は上界の不動点で止まる ----
//
// 計画は「載った名前の数」と `needsSlot` の旗が動かなくなったら止めていたので、上界そのものが
// まだ伸びている途中で止まっていた。parser.sn の輪は周ごとに 28 → 1792 と倍々で伸びており、
// 外側（`expr`）ほど1〜2周前の小さい値のまま残る。外側で包むと置き場所が足りず、容量の照合が
// 返す `__` が連結の中で吸われて、**機械は黙って短い綴りを返した**（AST 版で 30 文字が 6 文字）。
// S式の版は1節4文字なので、遅れた見積もりでも足りていて表に出なかった。
//
// もう1周回しても何も動かないこと（本当に不動点であること）、上限の前に止まること、外した
// 名前が無いことを見る。輪の上界は1つ——輪の全員が同じ係数を持つ（倍々の増え方は係数が割れる）。
for (const name of ["lexer.sn", "parser.sn", "preprocess.sn", "emit.sn"]) {
	const { nodes, env } = compile(fs.readFileSync(path.join(signDir, name), "utf8"), { readImport });
	const stats = [];
	generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii", layer: 1, sretPlanStats: stats });
	const st = stats[0];
	check(`${name}: sret の計画は上界の不動点で止まる`, !!st && st.stable && st.rounds < st.limit && st.banned.length === 0, true);
	if (name === "parser.sn" && st) {
		const ring = [...st.plan].filter(([k]) => /^out/.test(k)).map(([, v]) => v.terms.filter((t) => t.measure === "len").map((t) => t.coef).join("/"));
		check("parser.sn: 輪の上界は1つ（out の輪の全員が同じ係数）", ring.length > 1 && new Set(ring).size === 1, true);
	}
}
console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
