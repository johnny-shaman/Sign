/**
 * **同型は機械語で無償でなければならない。**
 *
 * `$__ = __ = @__` が機械語の不動点であるように——型の上では別のものでも、機械の上では
 * 同じビットでなければならない——仕様が同型だと言っているものは、値も型も命令列も一致する
 * はずである。一致しないなら、**型が値より広い**か、**問いになっていない問いを実行時に
 * 訊いている**かのどちらかである。実際どちらも見つかった。
 *
 * ここは同型の表そのものである。成り立つものだけでなく、**わざと成り立たないもの**も
 * 理由つきで置く——「同型に見えるが違う」ことこそ、あとで踏みやすい。
 *
 * 実行: node test/isomorphism.test.js
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";
import { generateAsm } from "../pass4.js";
import { evaluate, newRuntimeEnv, UNIT, observe, isUnit } from "../interpreter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = peggy.generate(fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8"));

let passed = 0;
let total = 0;
function checkTrue(note, cond, extra) {
	total++;
	if (cond) passed++;
	console.log(`${cond ? "OK  " : "FAIL"} ${note}`);
	if (!cond && extra) console.log(`     ${extra}`);
}

// 値（観測境界を通した姿）。`Char` は符号位置で見る——機械の側にあるのは数である。
function value(source) {
	const { nodes } = compile(source, { parse: parser.parse });
	const env = newRuntimeEnv(null);
	let r = UNIT;
	for (const node of nodes) r = evaluate(node, env);
	if (isUnit(r)) return "__";
	const o = observe(r);
	if (typeof o === "string" && [...o].length === 1) return String(o.codePointAt(0));
	if (o && typeof o === "object" && o.__identity__) return "0";
	return JSON.stringify(o);
}
function type(source) {
	const { nodes } = compile(source, { charset: "ascii" });
	return String(nodes[nodes.length - 1].atomType);
}
// `f` の本体の命令列（コメントは落とす）。出せなければ null。
// `f` の仮引数 `a` の型（呼び出しサイトを見て合流させた結果）。
function paramType(source) {
	const { nodes } = compile(source, { charset: "ascii" });
	let t = null;
	const walk = (n) => {
		if (!n || typeof n !== "object" || t !== null) return;
		if (n.type === "atom" && n.kind === "identifier" && String(n.value) === "<a>") { t = n.atomType; return; }
		for (const k of ["left", "right", "operand"]) walk(n[k]);
		for (const l of n.lines || []) walk(l);
	};
	for (const n of nodes) walk(n);
	return String(t);
}
function body(source) {
	const { nodes, env } = compile(source, { charset: "ascii" });
	const r = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii", layer: 1 });
	if (r.diagnostics.length) return null;
	const t = r.text.split("\n");
	const i = t.findIndex((l) => l.startsWith("f:"));
	if (i < 0) return null;
	const j = t.findIndex((l, k) => k > i && l.trim() === "ret");
	return t.slice(i, j + 1).map((l) => l.replace(/\/\/.*/, "").trim()).filter(Boolean);
}

/** 同型：値・型・命令列のすべてが一致する。命令列は関数の形で書かれたときだけ見る。 */
function iso(note, a, b) {
	const [va, vb] = [value(a), value(b)];
	const [ta, tb] = [type(a), type(b)];
	const [ba, bb] = [body(a), body(b)];
	const insSame = !ba || !bb ? true : JSON.stringify(ba) === JSON.stringify(bb);
	const why = [];
	if (va !== vb) why.push(`値 ${va} / ${vb}`);
	if (ta !== tb) why.push(`型 ${ta} / ${tb}`);
	if (!insSame) why.push(`命令 ${ba.length} / ${bb.length}`);
	checkTrue(note, why.length === 0, why.join(" · "));
}

// ---- 1要素の器は存在しない（`[x] ≅ x`） ----
iso("[x] ≅ x", "[5]", "5");
iso("[x ~ x] ≅ x", "[3 ~ 3]", "3");
iso("x ' 0 ≅ x", "f : n ? n ' 0\nf 5", "f : n ? n\nf 5");
iso("x ' 0 ' 0 ≅ x", "f : n ? (n ' 0) ' 0\nf 5", "f : n ? n\nf 5");
iso("式の中でも", "f : n ? (n ' 0) + 1\nf 5", "f : n ? n + 1\nf 5");

// ---- 0 番目から末尾まで、は丸ごと（器でも規則でも） ----
iso("x ' 0~ ≅ x", "f : n ? n ' 0~\nf 5", "f : n ? n\nf 5");
iso("s ' 0~ ≅ s", "f : s ? s ' 0~\nf `abc`", "f : s ? s\nf `abc`");
iso("s ' 0~ ' 0~ ≅ s", "f : s ? (s ' 0~) ' 0~\nf `abc`", "f : s ? s\nf `abc`");
iso("規則 ' 0~ ≅ 規則", "f : n ? [1 ~ 5] ' 0~\nf 1", "f : n ? [1 ~ 5]\nf 1");

// ---- 記憶（`$` / `@`） ----
//
// `$名前` は束縛の番地なので、そこから読めば束縛の値そのものである。番地を作って読み直す
// 意味は無く、フレームの中に在るものは niche にもなりえない（`@` の分岐も要らない）。
iso("@$x ≅ x", "f : n ? @($n)\nf 5", "f : n ? n\nf 5");
iso("@$x を使っても", "f : n ? (@($n)) + 1\nf 5", "f : n ? n + 1\nf 5");

// ---- 余積の単位元（`__` は落ちる） ----
iso("__ x ≅ x", "f : n ? __ n\nf 5", "f : n ? n\nf 5");
iso("x __ ≅ x", "f : n ? n __\nf 5", "f : n ? n\nf 5");

// ---- 撒いても1つは1つ ----
iso("scalar~ ≅ scalar", "f : n ? n~\nf 5", "f : n ? n\nf 5");

// ---- 同型に見えて、そうでないもの ----
//
// **`!` は対合ではない。** 「`__` かどうか」を見る述語であり、値を反転する演算ではない
// ——`!5` は `__`（偽）、`!__` は恒等射（真）なので、`!!5` は 5 ではなく真である。
checkTrue("!!x は x ではない（`!` は述語）", value("f : n ? !(!n)\nf 5") !== value("f : n ? n\nf 5"));
checkTrue("!!x は真である", value("f : n ? !(!n)\nf 5") === "0");

// ---- 絶対値とノルムは別の囲みである ----
//
// **1要素の器は存在しない**ので、`|x|` に絶対値と要素数を兼ねさせると長さ1で意味が
// 変わる——`count : xs ? |xs|` は `[7]` に対して 7 を返していた（`[7] ≅ 7` なので
// 絶対値と読めてしまう）。囲みを分ければ、どちらも曖昧さなく書ける。
//
//   |x|        絶対値（数）／数え上げ（器）——兼ねているので長さ1で不連続
//   ||x||      ノルム（要素数）。常に数え上げ
//
// 2文字なのは `|` が中置 `or`（tier 6）で埋まっているからである。`|[...]|` にすると
// `a | [1 2] | b` と区別がつかず、**空白の有無で意味が変わって**しまう。
checkTrue("|scalar| は絶対値", value("|5|") === "5" && value("|0 - 5|") === "5");
checkTrue("|[x]| も絶対値のまま", value("|[5]|") === value("|5|"));
checkTrue("ノルムは要素数", value("||5||") === "1" && value("||[7 8]||") === "2");
checkTrue("長さ1でも1", value("||[7]||") === "1" && value("||[0 - 7]||") === "1");
checkTrue("汎用の数え上げが壊れない", value("count : xs ? ||xs||\ncount [7]") === "1");
checkTrue("器も数える", value("||`abc`||") === "3" && value("||[1 ~ 5]||") === "5");
checkTrue("空は 0 要素", value("||__||") === "0" && value("||[]||") === "0");
checkTrue("無限は数えられない", value("||[0 ~+ 1]||") === "__");
// `|` が中置 or として使われる形は無傷である（2文字にした理由そのもの）。
checkTrue("or は無傷", value("f : n ? __ | n\nf 7") === "7");
checkTrue("or の連鎖も無傷", value("__ | __ | 3") === "3");
// **囲みか中置かは空白の位置が決める。** 絶対値とまったく同じ規則である——密着していれば
// 囲み、空白で区切られていれば中置演算子（`|` は `or`、`||` は `bit_or`）。だから
// レキサーは `|` / `||` の前後に空白を入れてはいけない（多義的な演算子として扱う）。
checkTrue("密着なら囲み", value("||[1 2 3]||") === "3" && value("|5|") === "5");
checkTrue("空白があれば中置", value("12 || 10") === "14" && value("1 || 2 || 4") === "7");
checkTrue("or も無傷", value("__ | 7") === "7");
checkTrue("&& との対称も無傷", value("12 && 10") === "8");
// **ノルムと切り出しは噛み合う。** `||s ' i~|| = ||s|| - i`——ただし長さは負にならない
// ので、器を越えて切れば 0 で頭打ちになる。
checkTrue("切り出すと縮む", value("f : s ? ||s ' 2~||\nf `abcde`") === "3");
checkTrue("引き算と一致する", value("f : s ? (||s ' 2~||) - ((||s||) - 2)\nf `abcde`") === "0");
checkTrue("越えて切れば 0", value("f : s ? ||s ' 9~||\nf `abcde`") === "0");

// ---- 囲みはすべて同じ段にある ----
//
// 自己完結しているので優先順位を持たない——`pass2` は囲みの tier を一度も引かない
// （文法が先にブロックへ畳む）。絶対値だけ tier 16 に書かれていたのは帳簿のズレで、
// 実装は最初からブロックと同じ挙動だった。**振る舞いで確かめる。**
checkTrue("絶対値は括弧のように結合する", value("|0 - 5| + 1") === "6" && value("1 + |0 - 5|") === "6");
checkTrue("ノルムも同じ", value("||[1 2]|| + 1") === "3" && value("1 + ||[1 2]||") === "3");

// **空の器は値としては `__` だが、型は器のままである。** 型が `String` なのは「以降を
// テキストとして連結する」という宣言であり、落とすと型が String と言っているのに値が
// List になる（interpreter.js の `isTextSeed`）。値だけでは決まらないので型で決める。
// **空文字列は束縛の右辺で測る。** 行頭のバッククォートは、閉じたうえで後続がある
// ときだけ式になる（string_and_comment.md §2）。`` `` `` を桁0へ裸で置くと後続が無い
// のでコメントであり、式として測れない——実際 `preprocess.sn` などが「空けるための行」
// として使っているのはこの形である。測りたいのは値と型なので、式の位置へ置く。
checkTrue("空文字列の値は __", value("s : ``\ns") === "__");
checkTrue("空文字列の型は String", type("s : ``\ns") === "String");
checkTrue("空リストの値は __", value("[]") === "__");

	// **持ち上がる先は均質な器だけである。**
	//
	// `Scalar ⇒ [Scalar, __]` が言えるのは「長さ1の器はその要素と同型」だからで、これは
	// **要素が並ぶ**器の話である。`Struct` はスロット配置が型の側にあるので `[x] ≅ x` が
	// 成り立たない——Char は「同じ形の Struct」ではない。
	//
	// **同型に見えて違う**のがここで、実際に踏んだ。parser.sn の `mul_go` の `acc` は
	// `mul_lv` からは Char（葉のトークン）、再帰からは Struct（枝）で来る。仮引数の合流が
	// これを `Struct` へ潰していたため、**Char の値がポインタとして参照される**ところ
	// だった。どちらも1レジスタなので幅の検査も通り、診断も出ない。
	//
	// 葉と枝が別の形をしているのは本当なので、決めない（`Atom`）のが正しい（原理4）。
	checkTrue("Char と List は合流して List", paramType("f : a ? a\nf \\x\nf [1 2]") === "List");
	// **`String` へ上がれるのは `Char` だけである。**
	//
	// `String ≅ List(Char)` なので、`[x] ≅ x` で `Int` を上げた先は `List(Int)` であって
	// `String` ではない。ここは長く `String` へ寄せていたが、それは実機で値を壊す規則
	// だった——呼ぶ側は 8 byte で持ち上げ（`emitLiftToContainer`）、呼ばれる側は `Char` の
	// 1 byte で読むので、`g `ab`` と `g 300` を混ぜると 300 が **44**（300 & 0xFF）になる。
	// 診断はゼロだった。
	//
	// 葉と枝が別の型なのは本当なので、決めない（`Atom`）のが正しい（原理4）。要素の型が
	// 名前に出ない器（`List` / `Iterator` / `Implicit`）は、どのスカラーでも上がる。
	checkTrue("Int は String へは上がらない（String ≅ List(Char)）", paramType("f : a ? a\nf 1\nf `ab`") === "Atom");
	checkTrue("Char は String へ上がる", paramType("f : a ? a\nf \\x\nf `ab`") === "String");
	checkTrue("Int は List へは上がる（要素の型が名前に無い）", paramType("f : a ? a\nf 1\nf [1 2]") === "List");
	checkTrue("Char と Struct は合流しない", paramType("f : a ? a\nf `x`\nf (1 , `x`)") === "Atom");

	// **撒いた文字は文字列へ戻る**（原理7——`String` の μ は強制である）。
	//
	// `List` の μ は任意なので `~` を書いて初めて平らになるが、`String` のそれは書かなくても
	// 効く。だから `s~` と `s` は**同じ値**でなければならない——機械はそう出している
	// （`~` は 0 命令、器はもう並んでいるので置き直すものが無い）。解釈器だけが
	// `["a","b"]` のまま持っており、**型は String、値は列**という食い違いだった。
	//
	// ここが揃っていないと、機械の答えを解釈器で照合できない——**正しい方を疑う**羽目になる。
	checkTrue("撒いた文字列は元の文字列", value("s : `ab`\ns~ = s") === value("s : `ab`\ns"));
	checkTrue("撒いても長さは変わらない", value("s : `ab`\n||s~||") === value("s : `ab`\n||s||"));
	checkTrue("撒いた先の添字も同じ", value("s : `ab`\n(s~) ' 1") === value("s : `ab`\ns ' 1"));
	// **ただし撒く印は消えない。** 構築の位置では `~` の有無が要素数を変える——
	// `x , s~` は文字を並べ、`x , s` は文字列1つを置く（`words `ab`` が語数ではなく
	// 文字数を返したのがこの取り違えだった）。μ が効くのは**値として見るとき**だけである。
	checkTrue("構築では撒きが効く", value("s : `ab`\n||`Z` , s~||") === "3");
	checkTrue("撒かなければ1つ", value("s : `ab`\n||`Z` , s||") === "2");

	// **`String` は中身の長さで分かれない。** スロットに置かれるのは常に `{ptr, len}` の
	// 16 バイトであり、中身が何文字かは配置に効かない。ここを長さで比べていたので、
	// **長さの違う文字列が並ぶだけ**で「揃わない」と読まれ、`List` ではなく `Struct` に
	// なっていた——`measure`（中身の長さ）と `passingOf`（運ぶ幅）の取り違えの6例目である。
	checkTrue("長さの違う文字列も同じ器", type("[`ab` , `abc`]") === "List");
	checkTrue("同じ長さでももちろん器", type("[`ab` , `cd`]") === "List");
	// **`Char` と `String` も同じ器に並ぶ。** 1文字は長さ1の文字列であり（原理7）、型の
	// 上では `Char ∨ String = String` が既に成り立っている。表現は 1 本と 2 本で違うので
	// 持ち上げの代金は要るが（原理8）、払えば済む話である——トークン列（`[`10` , `+`]`）が
	// まさにその形で、実機で作れて引けるところまで確かめてある。
	checkTrue("Char と String も同じ器", type("[`ab` , `c`]") === "List");

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
