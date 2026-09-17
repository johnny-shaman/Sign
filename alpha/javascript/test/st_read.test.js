/**
 * `.st` を**読む**側（`st_read.js`）の動作確認。
 *
 * `.st` は長らく誰にも読まれていなかった。読む側を作るときに一番危ないのは
 * **知らないものを埋めて通してしまうこと**である——雛形は型ごとの既定値（`Int` なら `0`）
 * で埋めていたが、それだと「道が無い所」が永久に緑になる。実測では型だけの `.st` から
 * 起こした `operator_table` は**診断0件で通り**、命令は出て値だけが違った（824行 → 156行、
 * `.ascii` が 85 本消えたまま）。
 *
 * だからここは**白名簿式**である。起こせるのは葉に値が載っているものだけで、
 * 関数（`->`）・穴（`_`）・器（`List(T)` / `Implicit(T)`）・知らない綴りは**名指しで断る**。
 * 断りは**読む側が**出すこと——下流（pass4）の「まだ出せない識別子です」に頼ると、
 * そこまで行かない綴り（値の無い葉）が黙って通る。
 *
 * 実行: node test/st_read.test.js
 */
import { compile } from "../compile.js";
import { generateSignType } from "../st.js";
import { readSignType } from "../st_read.js";

let passed = 0;
let total = 0;
function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
	if (!ok) console.log(`     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
}

// `.st` のヘッダ（行頭バッククォートのコメント）は読む側が飛ばすので、本文だけ渡してよい。
const read = (st) => readSignType(st);
// 断りの原文（1行目）。**要約しない**——何が断られたのかは綴りに書いてある。
const refusal = (st) => read(st).diagnostics;
// 起こした `.sn` を行の配列で。
const lines = (st) => read(st).text.split("\n").filter((l) => l !== "");

// ---- 断る4つの形 ----
//
// (a) 関数。`.st` にあるのは**シグネチャだけ**で本体が無い。埋めようが無いのだから、
//     読む側が断らなければならない——下流に任せると、呼ばれない関数は黙って消える。
check(
	"関数は読む側が名指しで断る（本体が `.st` に無い）",
	refusal("#bump : Int -> Int\n"),
	["`.st` から起こせません（関数の本体が `.st` にありません: Int -> Int）: bump"]
);
check(
	"多引数でも同じ",
	refusal("#add : Scalar Scalar -> Scalar\n"),
	["`.st` から起こせません（関数の本体が `.st` にありません: Scalar Scalar -> Scalar）: add"]
);

// (b) 穴（`_`）。型が決まっていないという印であり、`.st` の存在理由そのものである
//     （伏せずに出す）。読む側がそれを `__` で埋めたら、出した意味が消える。
check("穴は断る", refusal("#x : _\n"), ["`.st` から起こせません（型が決まっていません（`_`）: _）: x"]);
// 入れ子でも**どのスロットか**まで名指しする。名前だけで断ると「`operator_table` が
// 読めません」としか言えず、14エントリのうちどの葉が欠けているのか探す所から始まる。
check(
	"入れ子の穴は、どのスロットかまで名指しする",
	refusal("#p : Struct{`h` : _ , 0}\n"),
	["`.st` から起こせません（型が決まっていません（`_`）: _）: p ' h"]
);

// (c) 器（`List(T)` / `Iterator(T)` / `Implicit(T)`）。型は「器である」と言うが、
//     **何個あってどんな値なのかは書かれていない**。空の器を作って通すのが一番悪い。
check("List(T) は断る", refusal("#l : List(Int)\n"), ["`.st` から起こせません（器の中身が `.st` にありません: List(Int)）: l"]);
check(
	"Implicit(T) も断る",
	refusal("#p : Implicit(Char)\n"),
	["`.st` から起こせません（器の中身が `.st` にありません: Implicit(Char)）: p"]
);
check(
	"Iterator(T) も断る",
	refusal("#a : Iterator(Int)\n"),
	["`.st` から起こせません（器の中身が `.st` にありません: Iterator(Int)）: a"]
);

// (d) 知らない綴り。白名簿に無いものは全部ここへ落ちる。
check("知らない綴りは断る", refusal("#q : Widget\n"), ["`.st` から起こせません（知らない型の綴りです: Widget）: q"]);
check(
	"知らない器の綴りも断る",
	refusal("#q : Bag(Int)\n"),
	["`.st` から起こせません（知らない型の綴りです: Bag(Int)）: q"]
);
// 族（`Atom` / `Scalar`）と `Struct` 単体は**綴りは知っている**。「知らない」と言うのは
// 嘘なので理由を分ける——族は呼び出しサイトで具体化されるまでの暫定形であり、
// `Struct` 単体はスロットが書かれなかった印である。
check("族は「知らない」ではなく「値が決まらない」", refusal("#x : Atom\n"), [
	"`.st` から起こせません（値の決まらない型です: Atom）: x",
]);
check("スロットの無い Struct も同じ", refusal("#x : Struct\n"), [
	"`.st` から起こせません（値の決まらない型です: Struct）: x",
]);

// 綴りは白名簿にあるが**値が書かれていない**場合。型だけの `.st`（今までの形）が
// 丸ごとこれである。ここを埋めて通していたのが、黙った誤答の出どころだった。
check("値の無い葉は断る", refusal("#a : Int\n"), ["`.st` から起こせません（値が `.st` にありません: Int）: a"]);
check(
	"入れ子の葉に値が無くても断る（`h : $f` はこの形になる）",
	refusal("#t : Struct{`h` : Address , 0  `k` : Int=0 , 1}\n"),
	["`.st` から起こせません（値が `.st` にありません: Address）: t ' h"]
);

// 断っても**残りは読む**。1本の綴りが読めないことと、他の束縛が読めることは別である。
check(
	"断った行だけが落ち、残りは起こる",
	read("#a : Int=1\n#f : Int -> Int\n#b : Int=2\n").text,
	"#a : 1\n#b : 2\n"
);

// ---- 起こせる形 ----
check("整数・実数・番地・文字・ユニット", lines("#a : Int=1\n#b : Float=3.14\n#c : Address=0x40011000\n#d : Char=\\d\n#e : Unit=__\n"), [
	"#a : 1",
	"#b : 3.14",
	"#c : 0x40011000",
	"#d : \\d",
	"#e : __",
]);
check("負の数", lines("#a : Int=-1\n"), ["#a : -1"]);
check("export 記号は保たれる", lines("##a : Int=1\n###b : Int=2\nc : Int=3\n"), ["##a : 1", "###b : 2", "c : 3"]);

// **並べ直す。** `.st` の並びは名前順（物理配置）で、宣言順は連番が言う。起こすときに
// 連番の順へ戻さないと `p : [x y]` と `p : [y x]` が同じ字面になり、ねじれが消える。
check("名前付きの器は宣言順（連番）へ並べ直す", lines("#p : Struct{`x` : Int=1 , 1  `y` : Int=2 , 0}\n"), [
	"#p :",
	"\t`y` : 2",
	"\t`x` : 1",
]);
check("連番スロットは `,` で並べる", lines("#t : Struct(Int=1 String=`abc` Float=2.5)\n"), [
	"#t : 1 , `abc` , 2.5",
]);

// ---- 割れ方が一意であること（鍵と値の囲い） ----
//
// 鍵が区切りと同じ綴りを含んでも、バッククォートで囲んであるので取り違えない。
// `st.test.js` の生成側と対になっている（あちらは出す形、ここは読み戻す形）。
check("鍵が `:` を含んでも読み戻せる", lines("#am : Struct{`a : b` : Int=1 , 0}\n"), ["#am :", "\t`a : b` : 1"]);
check("鍵が `,` と2スペースを含んでも読み戻せる", lines("#am : Struct{`Int , 0  q` : Int=2 , 0  `z` : Int=3 , 1}\n"), [
	"#am :",
	"\t`Int , 0  q` : 2",
	"\t`z` : 3",
]);
// 値の側も同じ。String は字面が既に囲まれていて、中にバッククォートも改行も入らない。
check("文字列の値が区切りを含んでも読み戻せる", lines("#am : Struct{`k` : String=`a , b  c` , 0  `z` : Int=3 , 1}\n"), [
	"#am :",
	"\t`k` : `a , b  c`",
	"\t`z` : 3",
]);
// **字面の検索では足りない。** 値の中の `->` を関数と読むと、読めるものを断ってしまう。
check("文字列の値の中の `->` は関数ではない", lines("#s : String=`a -> b`\n"), ["#s : `a -> b`"]);
// Char は `\` の直後1文字と決まっているので、空白そのものを値にしても割れない。
check("空白の文字も値になる", lines("#am : Struct{`k` : Char=\\  , 0  `z` : Int=3 , 1}\n"), [
	"#am :",
	"\t`k` : \\ ",
	"\t`z` : 3",
]);

// ---- 往復（実際に `.st` を作って読み戻す） ----
//
// **オラクルを生成側の副産物にしない。** 比べるのは「起こした `.sn` を再びコンパイルして
// 得た `.st`」と「元の `.st`」——途中で値が落ちれば `.st` が短くなるので必ず割れる。
function roundTrip(source) {
	const a = compile(source);
	const st = generateSignType(a.nodes, a.env, { scope: "ist" }).text;
	const r = readSignType(st);
	if (r.diagnostics.length > 0) return { diagnostics: r.diagnostics };
	const b = compile(r.text);
	return { same: generateSignType(b.nodes, b.env, { scope: "ist" }).text === st, sn: r.text };
}
check("整数の器は往復する", roundTrip("p : [\n\tx : 1\n\ty : 2\n]").same, true);
check("宣言順のねじれも往復する", roundTrip("p : [\n\ty : 2\n\tx : 1\n]").same, true);
check("記号の鍵も往復する", roundTrip("am : [\n\t`+` : 1\n\t`*` : 2\n]").same, true);
check("区切りを含む鍵も往復する", roundTrip("am : [\n\t`a : b` : 1\n\t`Int , 0  q` : 2\n]").same, true);
check("入れ子の器も往復する", roundTrip("t : [\n\ta : [\n\t\tk : `x , y`\n\t\tn : -3\n\t]\n\tb : 0x40011000\n]").same, true);
check("連番スロットも往復する", roundTrip("t : 1 , `abc` , 2.5").same, true);

// ---- 受け口（`compile.js` の `resolveImports`） ----
//
// **import 行の綴りは変えない。** 引く側は `` `operator_table.sn`@~ `` と書いたまま、
// ドライバが `.st` で答えられる。読み手が文字列を返す今までの形は `.sn` 扱いである
// （`import.test.js` が1行も直さずに通ることがその確認）。
const OT = "m/ot.sn";
const otSource = "#tier : 11\n#name : `coproduct`\n";
const otSt = (() => {
	const c = compile(otSource);
	return generateSignType(c.nodes, c.env, { scope: "st" }).text;
})();
const names = (readImport) =>
	compile("`ot.sn`@~\ntier\n", { charset: "ascii", sourcePath: "m/main.sn", readImport }).nodes.map((n) =>
		n && n.name === "define" && n.left ? String(n.left.value) : "(式)"
	);
check("読み手が文字列を返せば今まで通り `.sn`", names(() => otSource), ["<tier>", "<name>", "(式)"]);
check("`{ text, path }` で `.st` を返しても同じ束縛が撒かれる", names(() => ({ text: otSt, path: "m/ot.st" })), [
	"<tier>",
	"<name>",
	"(式)",
]);
check("`{ text, path }` の `.sn` も今まで通り", names(() => ({ text: otSource, path: OT })), ["<tier>", "<name>", "(式)"]);
// 起こせない `.st` を渡されたら**黙って空のモジュールにしない**。
{
	total++;
	let msg = null;
	try {
		names(() => ({ text: "#bump : Int -> Int\n", path: "m/ot.st" }));
	} catch (e) {
		msg = String(e.message);
	}
	const ok = msg !== null && msg.includes("関数の本体が `.st` にありません");
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} 起こせない \`.st\` は import が名指しで止まる`);
	if (!ok) console.log(`     got: ${msg === null ? "（止まらなかった）" : msg}`);
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
