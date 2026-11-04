/**
 * **余積（空白）の解決**（resolve.js、仕様は alpha1/docs/coproduct_spec.md）。
 *
 * §6.3 の「通る」表の全部の行を、木の文字列と（決まっている行は）根の種類で、「断られる」表の全部の行を、門の
 * reason と枝（`gate`）で確かめる。値の列は確かめない——値の段はまだ無い（§6.4 の7）。断られる行は「今は断る」
 * 試験で、§5 の問いの答えが出たら通る側へ移す（§6.4 の8）。
 *
 * 定義は §6.3 の「定義」をそのまま使う。ただし次の3か所は、仕様のほかの規則（P2：隠し）と両立しないので直した。
 * - `adder : n ? [+ n]` の仮引数 `n` は、同じ表の `n : [~x] ? x`（ファイルの定義）を隠すので `m` にした（2026-10-22 から §6.3 も
 *   `adder : m ? $[+ m]` と書く）。
 * - 「`x : add 1` の後で `x 5`」は、ファイルの定義 `x` が `inc` や `add` の仮引数 `x` を隠すので、名前を `add1` にした。
 * - `map : f [x ~y] ? …` の本体は書かれていないので、門に当たらない `x` を置いた（`@f x , map y~` は G3）。
 * 定義を足すと別の門に当たる行（隠し・同名）は、その行に要る定義だけで書いた。
 *
 * 木の書き方は resolve.js の頭の注のとおり。括りは前段が種類を残さないので、いつも `[…]` で書く（§6.3 の
 * `(f3 1)` は `[f3 1]`）。
 *
 * §6.3 の表の後ろに、表の外の規則の見本（「追加」）、実装を確かめた2つの workflow（仕様どおりか・反証）の指摘を
 * 当てた所（「確かめ」）、変異試験で壊しても落ちなかった所を見分ける入力（「穴」）を置く。「確かめ」の行は、直す
 * 前の実装では黙って通るか、別の読みになっていた。
 *
 * 最後に §5 Q1 の答え（2026-10-19、R24・R25・R26）の行（「答え」）と、期待値ではなく同じ射の綴りどうしを比べる
 * 試験（「法則」）を置く。§6.3 の「断られる」表の2行（`f : [x ~xs] ? [f xs] x` の本体・`hello : [say] ? say Hello World`
 * の本体）は、R25 で通る側（「答え」の R25 の行）へ移した。標準の定義の `map : f [x ~y] ? x` と `n : [~x] ? x` は
 * 括りの関数なので、R25 で定義の行の木が `(defer {x})` になる（試験は最後の行の木だけを見るので、期待値は変わらない）。
 * その後ろに、R24〜R26 の実装を確かめた2つの workflow の指摘を当てた行（「確かめ」の直した・穴・守り）を置く。
 * 最後に、反証の続きで直した2つ（分け合った実体の描き方・合成の鍵）の行と法則、合成の中の括りの関数（§5 Q24）の確かめ、
 * 合成を適用の畳み込みにした所（2026-10-19。(g∘f) x = g (f x) で答えが変わった行と、その法則）を置く。
 * その後ろに、値を含む輪（§5 Q30、2026-10-20。どこから入っても name-cycle で、言い分に輪の道筋）の行を置く。
 * いちばん後ろに、裸の関数を返す形（§5 Q21 の答え、2026-10-21、R33。本体の根が L か区間の綴りの `?` は G16。`$` で包んだ
 * 入れ子の `?` は、G17 で断っていたが、2026-10-21 22:46 の答えで通る（§5 Q35））の行を置く。標準の定義の adder は、この答えで
 * `$[+ m]` を返すように直した（前は `[+ m]` で本体の根が L）。
 * その後ろに左からの畳み込み（2026-10-23、R40〜R43）とその確かめの直しの行を、口の外の恒等射と `,` の単位（同じ日、R44〜R46）の
 * 行を置き、最後に逆適用の廃止（2026-10-24、R47・R48）の行を置く。逆適用の廃止で答えの変わった上の節の行は、行の注と名前に規則の番号と
 * 前の答えを書き、門が無くなった行は最後の節の norevPasses へ移した。いちばん後ろに、その片の確かめの指摘を当てた行（値の後ろに積まれた
 * 関数の並びの穴の規則・恒等射で消えた `,` の後の G3・括りの関数の末尾の `_`・診断も門も無く未知の根で通る所）を置く。
 * その後ろに、同じ日の試し（R49〜R51。2026-10-25 に決定にし、口が1つの関数への流れを写像から書き下しに直した）の行を置き、いちばん後ろに、
 * 評価する所の外で余ったラムダ（2026-10-24、R52）の行を置く。R52 で答えの
 * 変わった上の節の行は、行の注と名前に規則の番号と前の答えを書き、門が無くなった行（恒等射の直しの `(5 !_ f2) 3` の G7 の6行）は
 * いちばん後ろの節の r52Passes へ移した。
 * 2026-10-26 の R62・R63（§5 Q59・Q64 の答え：番地の点と差・書いた `_` と分かる値を実体へ渡しても `$` は零射の番地）の行は、いちばん後ろの
 * 「R62・R63」の節に置く。答えの変わった上の節の行は、行の注と名前に前の答えと理由を書いて直し（値を読む参照を中置の外の綴りで値の演算子に
 * 置く形は G7 から G21）、通る側へ移った行（`$vs - $vs`・`$vs == $vs`・`hb [s : _]`）は、元の所に注を残してその節へ移した。
 * 同じ日の R64〜R72（2026-10-25 の答えの片：括りの名前は射影・`f 1 , 2 , 3` は `f (1 , 2 , 3)`・仮引数の裸の `~xs` は G22・既定値の無い口の内側の `_` は
 * カリー化・前から n 個の外の `!_` は恒等射・空の流れは余ったラムダ・`_ , !_` は `_`・`$[5 !_]` は `$5`）の行は、いちばん後ろの「R64〜R72」の節に置く。
 * 通る側へ移った行は元の所に注を残してその節へ移し、答えの変わった行（`inc 1 !_` を本体に置いた守りの行・`kk [1 2]` の診断の数・gx の鍵の行）は、行の
 * 注に前の答えと理由を書いて直した。
 * 同じ日の R80〜R82（2026-10-25 の §5 Q10・Q45 の答え：枝の無い関数の本体の局所の定義はどの使い方でも右辺の種類で読む・素の関数も実引数の印で実体を作る・
 * 前置 `@` の値の定義の名前も右辺の印を読む）の行は、いちばん後ろの「R80〜R82」の節に置く。通る側・断る側へ移った行は元の所に注を残してその節へ移し、
 * 答えの変わった行（`use $inc 5` の未知の根が A・局所の名前を通した本体の根が A・札で見ていた Reader の言い分が実体の名指し）は、行の注に前の答えと理由を
 * 書いて直した。今のまま断る形の見本は、局所の定義として読めない所（枝のある本体・同じ範囲に2つ）と、本体の根が未知の uu に替えた。
 * 同じ日の R28 の書き直し（末尾の書いた `_` は消えて、部分適用も合成も関数のまま残る。U〔答え〕[2026-10-26 10:15 c8ccdd69] のボタン「8 でいい」と §5 Q18 の答え）の行は、
 * いちばん後ろの「R28」の節に置く。前の R28（「ここで終わる」）で断っていて通る側へ移した行は、元の所に注を残してその節へ移し、答えの変わった行は、行の注と名前に
 * 前の答えと理由を書いて直した。門に当たる本体の見本 `[+ 1] _ _`（BAD・Q24・Q25・bb・Q30 の輪）は `[+ 1]`（G16）になるので、内側の `_` で G5 に当たる `[+ 1] _ 1`
 * に替え、実体の鍵を分ける見本の本体 `f 1 _` は `f vs~` に替えた（どちらも見る目的は同じ）。2026-10-28 の R105 で `[+ 1] _ 1` も `[+ 1] 1` になって門に当たらないので、
 * 括りの関数の口に穴を書いた `[[g5] ? g5] !_ 1`（G5）に替えた。
 * 2026-10-27 の片7 の R96〜R98（算術の中の `0x…` は差・幅の倍数でない差は断る・`差 / 数` は数。§5 Q66 の算術の所と Q67 の答え）の行は、いちばん後ろの
 * 「R96〜R98」の節に置く。答えの変わった上の節の行（`$vs + 8x00FF`・`($vs - $five) / 8`・`$vs + (0x10 + 0x8)`・`0x10 - ($vs - $five)` と、§5 Q67 を名指しした言い分）は、
 * 行の注に前の答えと理由を書いて、同じ所を見る別の見本に替えるか、その節へ移した。
 * 2026-10-27 の片8 の R99〜R104（`$` は必ず持ち上げ・関数以外は警告・書いた `,` の積の `$` は断る・`$x ' 0` は x・下ろす所を通る輪だけ断る・`$[]~` は `$_`。§5 Q60 と
 * Q75 (d) を閉じた）の行は、いちばん後ろの「R99〜R104」の節に置く。答えの変わった上の節の行（書いた積の `$(n , 99)`・`$(inc , 1)`・`$(1 , 2) + 0x3`）は名前を通した積の
 * 綴りに替え、通る側・断る側を変えた行（先の種類の分からない `$`・形の見えない値の `$`・`$v` の輪の v が関数）は、元の所に注を残してその節へ移した。
 * 2026-10-28 の片9 の R105〜R110（値の口の書いた `_` は単位律で消える・実行時の `_` も値の口では消える（値の段）・既定値の口だけが開いた部分適用は評価する所で埋める・
 * `(!_ _)` は書いた項どおり・空は `_` と書く・評価する所では種類の未知な項の後ろの `_` も消える。§5 Q7・Q74・Q75 (f)(g) を閉じ、Q79・Q80 を足した）の行は、いちばん後ろの
 * 「R105〜R110」の節に置く。答えの変わった上の節の行（R16・R38・R68・R86 のカリー化と穴、`[]` の読み直し、既定値の埋め）は、行の注と名前に前の答えと理由を書いて直し、
 * 通る側・断る側を変えた行（書いた `_` の G5・G13・G15、`(!_ _)` の G7、評価する所の `(gq 1) _` の G7、`(go _ 3) 5`）は、元の所に注を残してその節へ移した。
 * 2026-10-28 の片9b の R111〜R116（未定義の名前は `_`・値の口に着いた `_` と分かる名前と括りは書いた `_` と同じ・`x : _` は書かなかったことと同じ・既定値に書いた `_` の
 * 仮引数は断る・無い欄は `_`・`#` の右の被演算子は評価する所）の行は、いちばん後ろの「R111〜R116」の節に置く。未定義の名前を「中身の見えない値」の代わりに使っていた行は、
 * 意図を保つ定義した名前（仮引数・素の関数の答え・STD の vs）に替えるか、行の中で新しい答えに直し、行ごとに注で理由を書いた。無い欄（`[nope] ? nope 21`）で門を作っていた
 * 行は、欄の関数から引いた物（`(say ' k) 21`）で門を保った。通る側へ変わった行（構造体に無い名前・`[say ~r] ? r ' say`）は、元の所に注を残してその節へ移した。
 *
 * 実行: node test/coproduct.test.js（`npm test` からも呼ばれる）
 */
import { resolve, show, kindOf } from "../resolve.js";

const STD = [
	"inc : x ? x + 1",
	"double : x ? x * 2",
	"d : x ? x * 10",
	"g : x ? x * 10",
	"add : x y ? x + y",
	"f2 : x y ? x - y",
	"k1 : x y ? x",
	"mul : a b ? a * b",
	"use : f x ? @f x",
	"f3 : a b c ? a + b + c",
	"f4 : a b c e ? a + b + c + e",
	"adder : m ? $[+ m]",
	"map : f [x ~y] ? x",
	"n : [~x] ? x",
	// 片イ（R123、2026-11-03）：関数を積の要素にするのは `$` を付けた綴り。前の `inc , double , 3` は、関数に `,` を直接充てた形で inc と double が `_` になる
	// （leftover-lambda）ので、関数の器の意図を保つ綴りに替えた。
	"fs : $inc , $double , 3",
	"vs : 1 , 2 , 3",
];

// 標準の定義の後ろに行を足す。omit は外す定義の名前（その行の仮引数が定義を隠すとき）。
const std = (lines, { omit = [] } = {}) =>
	[...STD.filter((d) => !omit.includes(d.split(" ")[0])), ...[].concat(lines)].join("\n");
// 最後の行の木。body なら `(: t (? […] 本体))` の本体。at なら、その番号の行の木（0 から、負なら後ろから）。
const lastTree = (r, body, at) => {
	const t = at === undefined ? r.trees[r.trees.length - 1] : r.trees[at < 0 ? r.trees.length + at : at];
	return body ? t.right.body : t;
};

// 通る：[名前, ソース, 木, 種類（null は見ない）, 追加の確かめ]
const passes = [
	// 逆適用の廃止（2026-10-24、R47）：値の後ろの inc は積まれて、後ろの 3 を受ける（`5 (inc 3)`。U〔答え〕[2026-10-23 15:32 ebf18260]
	// 「合ってる。 それでOK！」）。2026-10-23 は左からの畳み込みの逆適用で `(inc 5) 3`（`(construct (apply inc 5 ·rev) 3)`。U〔答え〕10-22 11:24
	// 「そう、合ってる。」は逆適用がある前提の答えで、R47 で上書きされた）。その前は強さの順（R6）で、今と同じ `(construct 5 (apply inc 3))`。
	["5 inc 3（R47。前は `(inc 5) 3`）", std("5 inc 3"), "(construct 5 (apply inc 3))", "A"],
	// `1 2 [+] 3 4` は、R47 で `1 2 ([+] 3 4)`（2026-10-23 は逆適用で `1 ([+] 2 3 4)`）。下の「左からの畳み込み」の pfReversePasses にある。
	["double inc 5", std("double inc 5"), "(apply (compose double inc) 5)", "A"],
	["[+] inc 5 6", std("[+] inc 5 6"), "(apply (compose [+] inc) (construct 5 6))", "A"],
	["[< 3,] [* 2,] 1 5 2", std("[< 3,] [* 2,] 1 5 2"), "(apply (compose [< 3,] [* 2,]) (construct 1 5 2))", "A"],
	// R31（2026-10-21）で `[+]` に数1つは値になった（`[+] 5` は 5、§5 Q17 は閉じた）。ここの後ろの `[+]` が受けるのは `[* 2,]` の結果
	// （中身の見えない A）で、器なら要素に関数が見えるかもしれないので、今までどおり未知（R31 の1項、2026-10-21 の確かめで直した。
	// R31 の最初の版は A にしていた）。
	["[* 2,] [+] 1 2 3 4 5（未知の根）", std("[* 2,] [+] 1 2 3 4 5"), "(apply (compose [* 2,] [+]) (construct 1 2 3 4 5))", "未知"],
	["k1 1 2", std("k1 1 2"), "(apply k1 (construct 1 2))", "A", { leftover: false }],
	// §5 Q11 の答え（U〔答え〕2026-10-21 23:10「余った引数は後ろに積んでいい。」、R35）：実引数がアリティより多い適用は、前から n 個を
	// 当てた適用の後ろに余りを並べた構築。前は `(apply d (construct 1 2))` に印 excess（根でだけ通る）だった。
	["d 1 2（余りは後ろに積む、R35）", std("d 1 2"), "(construct (apply d 1) 2)", "A", { leftover: true }],
	["[+ 1] 1 2 3（余りは後ろに積む、R35。値は U〔答え〕09-28 00:58 の [2 2 3]）", std("[+ 1] 1 2 3"), "(construct (apply [+ 1] 1) 2 3)", "A", { leftover: true }],
	// R51（2026-10-25 の決定）：撒いた並びは流れの1項で、口が1つの `[+ 1]` は書き下し。流れの頭に当てて残りを積む `([+ 1] 1) 2 3` で、値は
	// U〔答え〕09-28 00:58 の [2 2 3]（U [2026-10-25 07:27 2772473e]「…[+ 1] [1 2 3]~ は [2 2 3] になるはずだと答えたつもりだった。…」）。
	// 2026-10-24 の試しの版は写像（値は [2 3 4]）、その前は撒く項で k を数えないので未知の根。種類はどちらも A で、木は同じ。
	["[+ 1] [1 2 3]~（R51 の書き下し。値は [2 2 3]。前は未知の根）", std("[+ 1] [1 2 3]~"), "(apply [+ 1] [1 2 3]~)", "A"],
	// 畳む点なしは最後の口が可変長なので、流れを丸ごと受ける（R51）。種類は今までどおり未知（試しの R51 の文面のまま、§5 Q46）。
	["[+] [1 2 3]~（未知の根。R51 でも丸ごと受けて今のまま）", std("[+] [1 2 3]~"), "(apply [+] [1 2 3]~)", "未知"],
	// 畳む2項の点なしに List 1つは、要素を並びとして畳む（R31。U〔答え〕10-07 05:10 は `[+] ([< 3,] 1 5 2)` を 3）。ここの括りの中は
	// `[< 3,]` の結果（中身の見えない A）なので、要素が全部 A とは見えず、今までどおり未知（R31 の1項。R31 の最初の版は A にしていた）。
	["[|] ([< 3,] 5 1 2)（未知の根）", std("[|] ([< 3,] 5 1 2)"), "(apply [|] [[< 3,] 5 1 2])", "未知"],
	["[+] ([< 3,] 1 5 2)（未知の根）", std("[+] ([< 3,] 1 5 2)"), "(apply [+] [[< 3,] 1 5 2])", "未知"],
	// 2026-10-26 の R81（§5 Q45 の答え）：素の関数も実引数の印で実体を作り、`@f` は inc なので A（前は、素の関数の仮引数に印が届かず未知の根）。印の無い実引数の
	// `use 5 5` は今のまま本体を1回だけ解いて未知の根。
	["use $inc 5（R81 で A。前は未知の根）", std("use $inc 5"), "(apply use (construct $inc 5))", "A"],
	["use 5 5（印の無い実引数は今のまま未知の根）", std("use 5 5"), "(apply use (construct 5 5))", "未知"],
	// 根に残った関数は `_`（R42。木は `(unit …)` で包む）。前は L の根。値は U 09-12 00:15 の「行末で `_`」と同じ。
	["use inc 5（根に残った関数は `_`、R42）", std("use inc 5"), "(unit (apply (compose use inc) 5))", "A"],
	["use 5 inc（同じ、R42）", std("use 5 inc"), "(unit (compose (apply use 5) inc))", "A"],
	// 2026-10-28 の片9b の確かめの直し：a・b・c は未定義の名前で、R111 から `_` と分かる値（前の行の名前の「b, c は値」は R21 の読み）。前置 `@` の先は覗かない
	// （R82 の peekDesc は未定義の名前を覗かない）ので、木と種類は今のまま。
	["@a b c（a・b・c は未定義の名前で R111 の `_` と分かる値。`@a` の先は覗かず、未知の根）", std("@a b c"), "(apply @a (construct b c))", "未知"],
	["本体 g x（g, x は裸の仮引数）", std("t : g x ? g x", { omit: ["g"] }), "(construct g x)", "A", { body: true }],
	["本体 @g x（未知の根）", std("t : g x ? @g x", { omit: ["g"] }), "(apply @g x)", "未知", { body: true }],
	["@(procs ' 0) 5（未知の根）", std("@(procs ' 0) 5"), "(apply @[procs ' 0] 5)", "未知"],
	["本体 mul x + 1 y", std("t : x y ? mul x + 1 y"), "(apply mul (construct (+ x 1) y))", "A", { body: true }],
	["inc 1 + 2", std("inc 1 + 2"), "(apply inc (+ 1 2))", "A"],
	["[* 2,] `ab` == `aabb`", std("[* 2,] `ab` == `aabb`"), "(== (apply [* 2,] `ab`) `aabb`)", null],
	["1 2 , 3 4", std("1 2 , 3 4"), "(, (construct 1 2) (construct 3 4))", null],
	["vs~ 4", std("vs~ 4"), "(construct vs~ 4)", "A"],
	// R47：値の後ろの関数は積まれて 5 を取らない。根に余って `_` になり、構築の中で消える（R42・R15）。余ったことは leftover-lambda で
	// 知らせる（R48）。前（2026-10-23 まで）は逆適用で `(apply inc 5 ·rev)`・`(apply (compose inc inc) 5 ·rev)`。
	["5 inc（R47・R48。前は逆適用）", std("5 inc"), "(construct 5 (unit inc))", "A"],
	["5 inc inc（R47・R48）", std("5 inc inc"), "(construct 5 (unit (compose inc inc)))", "A"],
	// `5 inc [* 2]`（§5 Q23 の答えで通っていた）は、強さの順（R6）が無くなり、`[* 2]` が `5 inc` の値を逆適用で取る（R40）。答えは
	// Q23 の答えと同じ `[* 2] (inc 5)`。下の「左からの畳み込み」の pfReversePasses へ移した（R13 は廃止、§5 Q36）。
	["add1 : add 1 の後で add1 5", std(["add1 : add 1", "add1 5"]), "(apply add1 5)", "A"],
	["g3 : f3 1 の後で g3 2 3", std(["g3 : f3 1", "g3 2 3"]), "(apply g3 (construct 2 3))", "A"],
	["(f3 1) 2 3", std("(f3 1) 2 3"), "(apply [f3 1] (construct 2 3))", "A"],
	["(f2 10) g 3", std("(f2 10) g 3"), "(apply (compose [f2 10] g) 3)", "A"],
	// 2026-10-28 の R105（値の口の書いた `_` は単位律 `f _ = f` で消える）：`add _ 10` は `add 10`。前は R16 のカリー化の穴 `(unit (? [$p0] (apply add (construct $p0 10))))`。
	["add _ 10（R105 で `add 10`。根なので `_`、R42。前は R16 の穴）", std("add _ 10"), "(unit (apply add 10))", "A"],
	// §5 Q31 の答え（R34）：余った xs が穴に入る。前は G13（下の refused にあった）。
	["go !_ xs（前は G13）", std(["go : ys ? ys", "xs : 1 , 2", "go !_ xs"]), "(apply go xs)", "A"],
	["f4 _ 2 _ 3（R105 で `f4 2 3`。根なので `_`、R42。前は穴2つ `(unit (? [$p0 $p1] (apply f4 (construct $p0 2 $p1 3))))`）", std("f4 _ 2 _ 3"), "(unit (apply f4 (construct 2 3)))", "A"],
	["[add _ 10] 5", std("[add _ 10] 5"), "(apply [add _ 10] 5)", "A"],
	["_ \\a", std("_ \\a"), "\\a", "A"],
	["_ 1 2", std("_ 1 2"), "(construct 1 2)", "A"],
	["_ _", std("_ _"), "_", "A"],
	// 書いた `_` はいつも印（利用者 2026-10-21。穴の綴りは `!_`）。前は §3.5 の3つの形の外で G5 だった行（下の「印と穴」も）。
	// 2026-10-26 の R28 の書き直し（末尾の書いた `_` は消えて、関数のまま残る。U〔答え〕[2026-10-26 10:15 c8ccdd69] のボタン「8 でいい」）：`inc _` は `inc` で、根なので
	// 余ったラムダの `_`（R42・R48）。前は「終わり」で `(apply inc _)`。`([+ 1] _) 5` は `([+ 1]) 5` で値は 6（前は括りの中で終わって `_ 5` の 5、`(construct …)`）。
	["inc _（R28 で消える。前は終わりの `(apply inc _)`）", std("inc _"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["([+ 1] _) 5（R28 で `([+ 1]) 5`、値は 6。前は括りの中で終わって `(construct [[+ 1] _] 5)`）", std("([+ 1] _) 5"), "(apply [[+ 1] _] 5)", "A"],
	["[!_] _（R28 で `[!_]`。前は否定の点なしの終わり `(apply [!_] _)`）", std("[!_] _"), "(unit [!_])", "A", { leftoverDiag: ["[!_]"] }],
	["1 _ 2（値だけの並びの印は消える）", std("1 _ 2"), "(construct 1 2)", "A"],
	["\\a _", std("\\a _"), "\\a", "A"],
	["_ inc 5（適用の実引数でない構築の印は消える）", std("_ inc 5"), "(apply inc 5)", "A"],
	["add 1 _（R28 で `add 1` が残り、根なので `_`。前は終わりの `(apply add (construct 1 _))`）", std("add 1 _"), "(unit (apply add 1))", "A", { leftoverDiag: ["(apply add 1)"] }],
	// 左からの畳み込み（R40・R43）：`inc 1` は口が埋まって値になり、その後ろの `_` は値の隣の並びの単位として消える（R15）。前は
	// `(apply inc (construct 1 _))`（R28 の k' ≥ n で `_` を木に残した）。値は同じ 2。
	["inc 1 _（飽和の後ろの `_` は消える、R43）", std("inc 1 _"), "(apply inc 1)", "A", { leftover: false }],
	["f _ _（f は未定義の名前で、R111 から `_` と分かる値。片9b の確かめの直しで行の名前を直した。前の名前は R21 の「未定義の名前＝値」）", std("f _ _"), "f", "A", { diag: "f" }],
	// 2026-10-28 の片9b（R111・R112）：未定義の名前は `_` で、評価する所（行の根）の値の隣では同じ位置に書いた `_` と同じに消える（`_ + 1 _` は `(+ _ 1)`、`_ 5` は 5）。
	// 前は「未定義の名前＝値」で、`(construct (+ _ 1) f)`・`(construct say 5)`。information の undefined-name は今のまま。
	["_ + 1 f（R112 で f は根の値の隣の未定義の名前で消える。前は `(construct (+ _ 1) f)`）", std("_ + 1 f"), "(+ _ 1)", "A", { diag: "f" }],
	["say 5（say は未定義。R112 で `_ 5` と同じ 5。前は `(construct say 5)`）", std("say 5"), "5", "A", { diag: "say" }],
	["[x ? x + 1] 5", std("[x ? x + 1] 5"), "(apply [x ? x + 1] 5)", "A"],
	["map $[* 2] 1 2 3 4 5（最後の括りが残りの並びを受ける。R24、2026-10-19）", std("map $[* 2] 1 2 3 4 5"), "(apply map (construct $[* 2] 1 2 3 4 5))", "A"],
	["n 1 2 3（括り1つの関数は並び全体を受ける。R24、2026-10-19）", std("n 1 2 3"), "(apply n (construct 1 2 3))", "A"],
	// §5 Q21 の答え（2026-10-21、R33）：関数を返すなら `$` を明示する（利用者 2026-10-21「adder が返すべきは [+ m] じゃなくて $[+ m]」）。前の
	// `adder : m ? [+ m]` は G16（下の「裸の関数を返す」）で、`$[+ m]` の adder の本体の根は A。前は未知の根。
	["adder 5（前は未知の根）", std("adder 5"), "(apply adder 5)", "A"],
	["adder 5 3（余りは後ろに積む、R35。前は G12(b)、その後は excess）", std("adder 5 3"), "(construct (apply adder 5) 3)", "A", { leftover: true }],
	// §6.3 の「断られる」表から移した行（2026-10-22）。`f2 1 g 2` は §5 Q4 の答え（R36：合成は流れとして左から畳む）で `g (f2 1 2)`、
	// `5 inc 3 4` は Q11 の答え（R35）で `5 (inc 3) 4`、`1 2 inc` は Q6 の答え（R37：一番近い1項だけを取る）で `1 (2 inc)`。
	["f2 1 g 2（前は G2(b)、R36）", std("f2 1 g 2"), "(apply (compose (apply f2 1) g) 2)", "A"],
	// R47 で `5 (inc 3) 4`（2026-10-22 の強さの順と同じ木。2026-10-23 は逆適用で `(inc 5) 3 4`）。
	["5 inc 3 4（R47。前は G12(a)、その後 `5 (inc 3) 4`・`(inc 5) 3 4`）", std("5 inc 3 4"), "(construct 5 (apply inc 3) 4)", "A", { leftover: false }],
	// R47：inc は 2 を取らず積まれて、根に余って `_`（R42・R48）。Q6 の答え（U〔答え〕10-21 23:23 の `1 (2 inc)`）は逆適用がある前提の答えで、
	// R47 で上書きされた。
	["1 2 inc（R47。前は G1、その後 R37 で `1 (inc 2)`）", std("1 2 inc"), "(construct 1 2 (unit inc))", "A"],
	["inc adder 5（前は未知の根、§5 Q13）", std("inc adder 5"), "(apply (compose inc adder) 5)", "A"],
	["f : x y ? x + y（解くのは x + y だけ）", "f : x y ? x + y", "(: f (? [x y] (+ x y)))", null],
	// 片イ（R120・R121・R126、2026-11-03）から、下の「断られる」表の G2(a)・G6・G3 と種類の未知な項の G7 の行は通る。木は畳みの予想（R118）で、
	// 種類の未知な項の後ろの項は積む予想、`,` の辺の終わりに余った関数は `_`（R121、leftover-lambda）。fs は R123 で要素が関数の番地（値）になり、撒いても
	// 関数は見えない（§5 Q20 の G7 は下の「R73〜R79」の節で構造体の m を撒いて見る）。
	["[,] 5 g 3（前は [+] 5 g 3）（前は G2(a)）", std("[,] 5 g 3"), "(construct (apply [,] 5) (apply g 3))", "未知"],
	["uu 5 3（前は use $inc 5 3、その前は adder 5 3。G12(b) → G2(a)、R40）（前は G2(a)）", std(["uu : x ? [,] x", "uu 5 3"]), "(construct (apply uu 5) 3)", "未知"],
	["y @x（前は G6）", std("y @x"), "@x", "未知"],
	["@f g 5（前は G6）", std("@f g 5"), "(construct @f (apply g 5))", "未知"],
	["inc 1 , inc 2（前は G3）", std("inc 1 , inc 2"), "(, (apply inc 1) (apply inc 2))", "A"],
	["本体 @f x , map y（前は G3）", std("t : f x y ? @f x , map y"), "(, (apply @f x) (unit (apply map y)))", "A", { body: true, leftoverDiag: ["(apply map y)"] }],
	["fs~（片イの R123 で fs の要素は番地）（前は G7）", std("fs~"), "fs~", "A"],
	["fs~ 5（片イの R123 で fs の要素は番地）（前は G7）", std("fs~ 5"), "(construct fs~ 5)", "A"],
	["t : m ? (m ' k) 5（m は仮引数。前は未定義の名前 m の `(m ' k) 5`）（前は G7）", std("t : m ? (m ' k) 5"), "(construct [m ' k] 5)", "未知", { body: true }],
	["@procs ' 0 5（前は G7）", std("@procs ' 0 5"), "(construct (' @procs 0) 5)", "未知"],
];

// 断られる：[名前, ソース, 門]
const GO_DEFAULT = ["go :", "\t\tys", "\t\tzs : 3", "\t? ys", "", "xs : 1 , 2"];
const refused = [
	// §6.3 の `f2 1 g 2`（G2(b)）・`5 inc 3 4`（G12(a)）・`1 2 inc`（G1）は、2026-10-22 に通る側（上の表）へ移した（R35〜R37）。
	// §6.3 の `[+] 5 g 3`（G2(a)）は、R31 で `[+] 5` が値になって通る側（下の「畳む2項の点なし」）へ移した。G2(a) の見本は、
	// アリティの分からない点なし `[,]` に1項の `[,] 5 g 3` にした（畳まない `[<<] 5 g 3` は R32 で足りない適用になり、R36 で流れとして通る）。
	// 片イ（R120、2026-11-03）から `[,] 5 g 3` は通る（G2(a) は廃止）。上の表へ移した。
	// `inc 1 2 inc`（G12(a)）は、左からの畳み込み（R40）で `(inc 1) (inc 2)` に決まった（G12(a) は廃止）。下の「左からの畳み込み」へ移した。
	// §6.3 の `adder 5 3`（G12(b)）は、adder が `$[+ m]` を返すようになって通る側へ移した（R33）。G12(b) の見本は、本体の根が
	// 未知の use にした。2026-10-23 から、種類の未知な `use $inc 5` の後ろに項が来る形として G2(a)（R40 の読み6。G12 は廃止）。
	// 2026-10-26 の R81 で `use $inc 5` が A になり `use $inc 5 3` は通る側（いちばん後ろの「R80〜R82」の節）へ移したので、本体の根が未知の uu にした。
	// 片イ（R120）から `uu 5 3` も通る。上の表へ移した。
	// §6.3 の `5 f2 1`（G8）と `xs~ inc`（G9）は、逆適用の廃止（2026-10-24、R47。G8・G9 も廃止）で通る側へ移した（いちばん後ろの
	// 「逆適用の廃止」の norevPasses）。`5 f2`・`5 (f2 1)` は下の「左からの畳み込み」の通る行にある。
	// §6.3 の `5 [+ 1]`・`5 [* 2] inc`（G10）は、2026-10-23 に R13 を廃止して通る。下の「左からの畳み込み」の pfReversePasses へ移した。
	// §6.3 の `~1 2 3`（G4）は、2026-10-26 の R79（§5 Q14 の答え：前置 `~` は単一の対象を要素1つの List に持ち上げる）で `[1] 2 3` と同じく通る側（いちばん
	// 後ろの「R73〜R79」の節）へ移した。G4 に残るのは `~_`。→ 2026-10-27 の R88（§5 Q14 の残りの答え）で G4 は廃止し、`~_` は書いた `[_]` と同じ項（R79。`_` と分かる値、
	// 値の口では `inc [_]` と同じ A）として通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	// 片イ（R126）から `y @x`・`@f g 5` は通る（G6 は廃止。先の分からない `@x` は種類の未知な項と同じに畳む）。上の表へ移した。
	// `add _ _`（G5）は、2026-10-26 の R28 の書き直し（末尾の `_` は消える）で `add` と同じく通る側（いちばん後ろの「R28」の節）へ移した。
	// §6.3 の `[+] 1 _ 3`（G5）は、R31 で `_` が被演算子の印になって通る側（下の「畳む2項の点なし」）へ移した。
	// `go _ xs`（既定値のある go の、既定値の無い口 ys の内側の `_`。G15）は、2026-10-26 の R68（§5 Q8 の答え：カリー化）で通る側（いちばん後ろの
	// 「R64〜R72」の節）へ移した。
	// §6.3 の `go !_ xs`（G13）は、§5 Q31 の答え（R34）で通る側（下の「穴と実引数の数」）へ移した。
	// 片イ（R121）から `inc 1 , inc 2`・本体 `@f x , map y` は通る（G3 は廃止）。上の表へ移した。
	// §6.3 の「`f : [x ~xs] ? [f xs] x` の本体」と「`hello : [say] ? say Hello World` の本体」（G7）は、§5 Q1 の答え
	// （R24・R25）で通る側へ移した。呼ばれない括りの関数は本体を読まず、断らない（下の「答え」の R25 の行）。
	// 片イ（R123）から fs の要素は関数の番地（値）なので、`fs~`・`fs~ 5` は通る。上の表へ移した。
	["[:] x 20（前は G7、R119）", std("[:] x 20"), "pointfree-tree-notation"],
	// 2026-10-28 の片9b：m を未定義の名前で書いた `(m ' k) 5` は、R111・R115 で m が `_`、`m ' k` が無い欄の `_` で通る（いちばん後ろの「R111〜R116」の節）。
	// この行の意図（中身の見えない値から引いた物は種類が決まらない）を保つため、m を仮引数（中身の見えない A）にした。
	// 片イ（R120）から、種類の未知な項の後ろの項は積む予想で通る（`t : m ? (m ' k) 5`・`@procs ' 0 5`）。上の表へ移した。
	// §6.3 の `-inc 5`・`inc + 1 5`（G7：値の演算子に関数、§5 Q22）は、2026-10-27 の R87（§5 Q73 の答え：値の演算子の被演算子は評価する所）で inc が `_` になり、
	// 通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	// §6.3 の `5 !_ 3`（G7）は、口の外の `!_` が恒等射になって（R44、2026-10-23）通る側（下の「口の外の恒等射」の idPasses）へ移した。
	["a : b 1 と b : a 2", "a : b 1\nb : a 2", "name-cycle"],
	["inc : x ? x + 1 と h : inc ? inc 5", "inc : x ? x + 1\nh : inc ? inc 5", "name-shadow"],
];

const GATE_REASON = {
	// G1（coproduct-reverse-of-many）は 2026-10-22 に廃止（答えは U〔答え〕10-21 23:23、UTC。resolve.js の写しと同じ）。
	G2: "coproduct-partial-neighbor",
	G3: "coproduct-beside-product",
	// G4（coproduct-prefix-tilde）は 2026-10-27 に廃止（R88、§5 Q14 の残りの答え。resolve.js の写しと同じ）。
	G5: "coproduct-unit-position",
	G6: "coproduct-input-position",
	G7: "coproduct-unknown-kind",
	G8: "coproduct-reverse-arity",
	G9: "coproduct-reverse-spread",
	// G10（coproduct-reverse-pointfree）は 2026-10-23 に廃止（R13 の廃止、§5 Q36。resolve.js の写しと同じ）。
	G11: "coproduct-no-reading",
	// G12（coproduct-excess-neighbor）は 2026-10-23 に廃止（左からの畳み込み、R40。resolve.js の写しと同じ）。
	G13: "coproduct-hole-arity",
	// G14（coproduct-pointfree-unit）は 2026-10-21 に廃止（resolve.js の写しと同じ）。
	G15: "coproduct-default-unit",
	G16: "coproduct-bare-function-return",
	// G17（coproduct-manual-curry）は 2026-10-22 に廃止（答えは U〔答え〕10-21 22:46、UTC。resolve.js の写しと同じ）。
	G18: "coproduct-identity-row",
	// G19 は 2026-10-24 の R51（2026-10-25 に決定。撒いた流れを受ける口の数が決まらない・書き下しで答えが割れる・合成に来た流れの読みが割れる。resolve.js の写しと同じ）。
	G19: "coproduct-stream-arity",
	// G20 は 2026-10-24（R53。`$` の先が関数でない。resolve.js の写しと同じ）。
	G20: "coproduct-dollar-value",
	// G21 は 2026-10-26（R62。番地の点と差の算術・比べで、決まって断る組と決まっていない組。resolve.js の写しと同じ）。
	G21: "coproduct-address-arith",
	// G22 は 2026-10-26（R67。仮引数の裸の `~xs`。resolve.js の写しと同じ）。
	G22: "coproduct-bare-rest-param",
};


let passed = 0;
let total = 0;
const ok = (name) => {
	console.log(`OK   ${name}`);
	passed++;
};
const fail = (name, ...lines) => console.log(`FAIL ${name}\n${lines.map((l) => `     ${l}`).join("\n")}`);

// 通る行を確かめる。extra：body（本体の木を見る）・at（見る行の番号）・leftover（根が、余りを後ろに積んだ構築か。R35。前の印
// excess の行は、2026-10-22 にこの印へ移した。2026-10-23 の左からの畳み込み（R40）で節の印 leftover は無くなったので、木の形で見る：
// 根が構築で、最初の子が適用の節（前から n 個を当てた適用の後ろに余りが並ぶ形）・diag（undefined-name が出る名前）・
// diagText（その名前の undefined-name のどれかの文面に含まれる文字列）・diagCount（出る診断の数）・pfInfo（pointfree-not-folded
// の information が出る点なしの綴り。R32）・leftoverDiag（leftover-lambda の warning が出る、余ったラムダの木の綴りの並び。出ない
// ことを見るなら []。R48、2026-10-24。重さは同じ日の §5 Q44 の答えで information から warning に上げた）・severities（出る診断の
// 「重さ/reason」を並べ替えた並び。重さの1か所 DIAG_SEVERITY を見る）。
const checkPass = (name, src, want, kind, extra = {}) => {
	total++;
	let r;
	try {
		r = resolve(src);
	} catch (e) {
		fail(name, `断られた: ${e.reason || e.name} ${e.gate || ""} ${e.message}`);
		return;
	}
	const t = lastTree(r, extra.body, extra.at);
	const got = show(t);
	const problems = [];
	if (got !== want) problems.push(`木   got:  ${got}`, `     want: ${want}`);
	if (kind !== null && kindOf(t) !== kind) problems.push(`種類 got: ${kindOf(t)}  want: ${kind}`);
	const leftover = !!t && t.t === "construct" && t.items[0].t === "apply";
	if ("leftover" in extra && leftover !== extra.leftover) problems.push(`leftover got: ${leftover}  want: ${extra.leftover}`);
	if (extra.diag && !r.diagnostics.some((d) => d.reason === "undefined-name" && d.severity === "information" && d.name === extra.diag)) {
		problems.push(`undefined-name（${extra.diag}）が出ていない: ${JSON.stringify(r.diagnostics)}`);
	}
	if (extra.diagText && !r.diagnostics.some((d) => d.reason === "undefined-name" && d.name === extra.diag && d.message.includes(extra.diagText))) {
		problems.push(`undefined-name（${extra.diag}）の文面に「${extra.diagText}」が無い: ${JSON.stringify(r.diagnostics)}`);
	}
	if (extra.pfInfo && !r.diagnostics.some((d) => d.reason === "pointfree-not-folded" && d.severity === "information" && d.name === extra.pfInfo && d.message.includes("おすすめはしません"))) {
		problems.push(`pointfree-not-folded（${extra.pfInfo}）が出ていない: ${JSON.stringify(r.diagnostics)}`);
	}
	if ("diagCount" in extra && r.diagnostics.length !== extra.diagCount) {
		problems.push(`診断の数 got: ${r.diagnostics.length}  want: ${extra.diagCount}  ${JSON.stringify(r.diagnostics)}`);
	}
	if ("leftoverDiag" in extra) {
		const left = r.diagnostics.filter((d) => d.reason === "leftover-lambda");
		const names = left.map((d) => d.name);
		if (JSON.stringify(names) !== JSON.stringify(extra.leftoverDiag)) problems.push(`leftover-lambda got: ${JSON.stringify(names)}  want: ${JSON.stringify(extra.leftoverDiag)}`);
		for (const d of left) {
			if (d.severity !== "warning" || !d.message.includes(`\`${d.name}\``) || !d.message.includes("R48")) problems.push(`leftover-lambda の重さか文面が違う: ${JSON.stringify(d)}`);
		}
	}
	if ("severities" in extra) {
		const got = r.diagnostics.map((d) => `${d.severity}/${d.reason}`).sort();
		if (JSON.stringify(got) !== JSON.stringify(extra.severities)) problems.push(`診断の重さ got: ${JSON.stringify(got)}  want: ${JSON.stringify(extra.severities)}`);
	}
	if (problems.length) fail(name, ...problems);
	else ok(name);
};

// 断られる行を確かめる。want が `G…` なら門の reason と枝（`gate`）を、それ以外なら reason だけを比べる。
// inst があれば、括りの関数の実体で当たった門（R25）で、呼んだ行が名指しした関数と形の並び（[[関数, 形], …]）も比べる。
const checkRefused = (name, src, want, inst) => {
	total++;
	try {
		const r = resolve(src);
		fail(name, `断るはずが通った: ${show(r.trees[r.trees.length - 1])}`);
	} catch (e) {
		const isName = !/^G/.test(want);
		const wantReason = isName ? want : GATE_REASON[want.replace(/\(.\)$/, "")];
		const gotInst = e.instances ? JSON.stringify(e.instances.map((i) => [i.fn, i.shape])) : "なし";
		const instOk = !inst || gotInst === JSON.stringify(inst);
		if (e.reason === wantReason && (isName || e.gate === want) && instOk) ok(`${name} → ${want}`);
		else {
			fail(
				name,
				`got: ${e.reason} ${e.gate || ""}  want: ${wantReason} ${isName ? "" : want}`,
				...(inst ? [`実体 got: ${gotInst}  want: ${JSON.stringify(inst)}`] : []),
				e.message
			);
		}
	}
};

for (const [name, src, want, kind, extra] of passes) checkPass(name, src, want, kind, extra);
for (const [name, src, want] of refused) checkRefused(name, src, want);

// §6.3 の外：仕様の規則（§4・§3.4・P2）の見本で、上の表に無いもの。
const extraPasses = [
	// R12 の見本は `|x| f`。`f` は標準の定義に無い（`use` の仮引数を隠す）ので、アリティ1の `inc` で書く。R12 は 2026-10-24 に廃止
	// （R47）：inc は `|x|` の後ろに積まれて余り、根で `_`（R42・R48）。前は `(apply inc |x| ·rev)`。
	["R12 |x| inc（R47。前は逆適用）", std("|x| inc"), "(construct |x| (unit inc))", "A"],
	// R47 で `1 (d 2)`（2026-10-22 の強さの順と同じ木）。2026-10-23 は逆適用で `(d 1) 2`。
	["R7 1 d 2（R47。前は `(d 1) 2`）", std("1 d 2"), "(construct 1 (apply d 2))", "A"],
	// `5 [+ 1] 3` は、左からの畳み込みでは `[+ 1]` が 5 を逆適用で取って `([+ 1] 5) 3`（R40。R13 は廃止）。下の「左からの畳み込み」の
	// pfReversePasses へ移した。
	["R19 (inc 1) , (inc 2)", std("(inc 1) , (inc 2)"), "(, [inc 1] [inc 2])", null],
	["R1 x * 2 y * 2", std("t : x y ? x * 2 y * 2"), "(construct (* x 2) (* y 2))", "A", { body: true }],
	// 再帰は A と仮置きして一巡する（§3.4）。仮置きと合えば A のまま。
	["再帰：仮置きが合う", std(["fact : k ? k * [fact k - 1]", "fact 5"]), "(apply fact 5)", "A"],
	// 仮置きと食い違えば未知（本体の根は、仮置き A から引いた物で未知）。根の k = n は未知で通り、k > n は G12(b)。
	// この行は、根が仮置きのままでも未知になるので、仮置きを取り消す仕組みは見ていない（寄生したオラクル）。
	// 取り消しは下の「相互再帰」の2行で見る。前の本体は `[+ [r k]]`（仮置き A の上で区間 L）だったが、区間の綴りの本体は
	// G16（R33、2026-10-22）なので、`(r k) ' 0` にした。
	["再帰：仮置きが外れる", std(["r : k ? (r k) ' 0", "r 1"]), "(apply r 1)", "未知"],
	// 字下げのブロックの本体：全部の行（枝なら値の側）の根が A のときだけ A。
	["字下げの本体", std(["sgn : v ?", "\tv < 0 : 0 - v", "\tv", "", "sgn 5"]), "(apply sgn 5)", "A"],
	// 種類の未知な `r 1` の後ろに 2 が来る（R40 の読み6。前は G12(b)、G12 は廃止）。片イ（R120）から、2 は積む予想で通る。
	["再帰：仮置きが外れて k > n（G2(a)、R40）（前は G2(a)）", std(["r : k ? (r k) ' 0", "r 1 2"]), "(construct (apply r 1) 2)", "未知"],
];
const extraRefused = [
	["同じ名前の定義が2つ", "p : 1\np : 2", "name-duplicate"],
	["入れ子の関数の仮引数が外の仮引数を隠す", "f : x ? [x ? x] x", "name-shadow"],
	["取り込みのある範囲の未定義の名前は未知", "io@\nsay 5", "G7"],
];
for (const [name, src, want, kind, extra] of extraPasses) checkPass(`追加 ${name}`, src, want, kind, extra);
for (const [name, src, want] of extraRefused) checkRefused(`追加 ${name}`, src, want);

// 2つの確かめ（仕様どおりか・反証）の指摘を当てた所。それぞれ、直す前は黙って通っていたか、別の読みになっていた。
const GO = ["go : ys ? ys", "xs : 1 , 2"];
const fixPasses = [
	// 前の R18（括らない `!_` を取り除く）の行 `go !_ vs~` は、R18 を廃止して G13（下の fixRefused）へ移した。
	// 前は貪欲な2項が `[+]` だけで、`[*]` などは種類が未知だった。R31（2026-10-21）で算術・ビット・論理・比較の両側の欠けた点なしは
	// 畳む（`[op] x1 … xn` は `x1 op … op xn`）ので A。畳まない点なし（`[<<]` など）は R32 で素の2引数の関数になった（下の「畳まない
	// 2項の点なし」）。アリティの分からない点なしで残るのは `[,]` だけで、今までどおり種類が未知で、根なら通る。
	// `[+]` が並びを受けている間に来た inc は合成の後ろ（R41）。木は入れ子の適用（2026-10-24、R47 で `·rev` の綴りが無くなった。
	// 前は `(apply inc (apply [+] (construct 5 6)) ·rev)`）。
	["[+] 5 6 inc（畳む2項）", std("[+] 5 6 inc"), "(apply inc (apply [+] (construct 5 6)))", "A"],
	["R31 で変わった [-] 5 3 1（前は未知の根）", std("[-] 5 3 1"), "(apply [-] (construct 5 3 1))", "A"],
	["R31 で変わった [*] inc 2 3（前は未知の根）", std("[*] inc 2 3"), "(apply (compose [*] inc) (construct 2 3))", "A"],
	["[,] 5 3 1（アリティの分からない点なしは未知の根）", std("[,] 5 3 1"), "(apply [,] (construct 5 3 1))", "未知"],
	["[,] inc 2 3（未知の根）", std("[,] inc 2 3"), "(apply (compose [,] inc) (construct 2 3))", "未知"],
	// 段18 の点なしの適用は、k = 1 なら `fs ' 0` と同じ desc（R26。2026-10-19 に §2 Q1 の答えで決まった）。`[' 0] fs 5` は k = 2 で未知の根だったが、
	// 2026-10-26 の R77（§5 Q39 の答え：口1つ）で `([' 0] fs) 5` になり、fs の要素に関数が見えて引いた物が未知なので、その後ろの 5 で G2(a)。いちばん後ろの
	// 「R73〜R79」の節へ移した。
	// 中置の右のブロックは前段が置く場所なので通る。
	["中置の右のブロック", std(["v : 1 +", "\t2"]), "(: v (+ 1 (block 2)))", null],
	// 合成の最初の関数の本体の根が値でなければ、k = n でも未知。前は本体の根が L の adder（§5 Q21）で見ていたが、根が L の関数は
	// G16 になった（R33）ので、根が未知の uu で見る。adder は `$[+ m]` を返すので A。
	["uu inc 5（未知の根。前は adder inc 5）", std(["uu : x ? [,] x", "uu inc 5"]), "(apply (compose uu inc) 5)", "未知"],
	["adder inc 5（前は未知の根）", std("adder inc 5"), "(apply (compose adder inc) 5)", "A"],
	["use inc 5 6（未知の根）", std("use inc 5 6"), "(apply (compose use inc) (construct 5 6))", "未知"],
	// 器の中の器まで見て、関数が無ければ撒ける。
	["[vs 1]~ 5", std("[vs 1]~ 5"), "(construct [vs 1]~ 5)", "A"],
	// 別名の適用の種類は生まれた関数で決める。値の後ろの pq は、2026-10-23 までは逆適用の右に置けた（`(apply pq 5 ·rev)`）。R47 で
	// 積まれて余り、根で `_`（R42・R48）。
	["pq : [x ? x + 1] の後で 5 pq（R47。前は逆適用）", std(["pq : [x ? x + 1]", "5 pq"]), "(construct 5 (unit pq))", "A"],
	["p : inc の後で p 5", std(["p : inc", "p 5"]), "(apply p 5)", "A"],
	// `||_||` は値の単位のまま A。
	["||_|| 5", std("||_|| 5"), "(construct ||_|| 5)", "A"],
	// 括りの仮引数の `:` の右は既定値で、仮引数ではない（隠しに数えない）。
	["ff : [z : inc] ? z（inc を仮引数に数えない）", std("ff : [z : inc] ? z"), "(: ff (? [[z : inc]] z))", null],
	// 括りの中の `:` の左の名前は、その括りの外では局所の名前にしない。
	["[qq : 1] は information を出さない", std("[qq : 1]"), "[qq : 1]", "A", { diagCount: 0 }],
	// P2 の文面どおり：本体の `:` の左が仮引数なら、その名前は仮引数のまま。寄せ1（R128、2026-11-04）から本体の `:` の行は枝で、条件 a は仮引数、
	// 値の inc は返す所（R125）に残った裸の関数で `(unit inc)`（R129 で最後でない枝は消えて次へ）。前は局所の定義か枝か決まらず `(: a inc)`。
	["本体 a : inc ⏎ a 5（a は仮引数）", std(["hh : a ?", "\ta : inc", "\ta 5"]), "(block (: a (unit inc)) (construct a 5))", null, { body: true, severities: ["information/bare-function-return"] }],
	// 片イ（R120・R126、2026-11-03）から、下の fixRefused の G2(a) と種類の未知な項の G7 の行は通る。木は畳みの予想（R118）で、種類の未知な項の後ろの
	// 項は積む予想、根に余った関数は `_`（R42・R48）。`[' 0] fs` は R123 で fs の要素が関数の番地（値）なので A。
	["[,] 2 3 inc（前は [*] 2 3 inc）（前は G2(a)）", std("[,] 2 3 inc"), "(construct (apply [,] (construct 2 3)) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	["[' 0] fs inc（片イの R123 で fs の要素は番地）（前は G2(a)）", std("[' 0] fs inc"), "(construct (apply [' 0] fs) (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["[@ 0] fs inc（前は G2(a)）", std("[@ 0] fs inc"), "(construct (apply [@ 0] fs) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	["[@] fs 0 inc（前は G2(a)）", std("[@] fs 0 inc"), "(construct (apply [@] (construct fs 0)) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	["vs~ + 1 5（前は G7）", std("vs~ + 1 5"), "(construct (+ vs~ 1) 5)", "未知"],
	["[+ vs~] 1（前は G7）", std("[+ vs~] 1"), "(construct [+ vs~] 1)", "未知"],
	["q : uu 5 の後で q~ 5（前は q : use $inc 5）（前は G7）", std(["uu : x ? [,] x", "q : uu 5", "q~ 5"]), "(construct q~ 5)", "未知"],
	["uu inc 5 double（前は adder inc 5 double）（前は G2(a)）", std(["uu : x ? [,] x", "uu inc 5 double"]), "(construct (apply (compose uu inc) 5) (unit double))", "未知", { leftoverDiag: ["double"] }],
	["uu inc 5 6（前は adder inc 5 6。G12(b) → G2(a)、R40）（前は G2(a)）", std(["uu : x ? [,] x", "uu inc 5 6"]), "(construct (apply (compose uu inc) 5) 6)", "未知"],
	["|inc| 5（前は G7）", std("|inc| 5"), "(construct |inc| 5)", "未知"],
	["-|inc| 5（前は G7）", std("-|inc| 5"), "(construct -|inc| 5)", "未知"],
	["|vs~| 5（撒く項だけの囲み）（前は G7）", std("|vs~| 5"), "(construct |vs~| 5)", "未知"],
];
const fixRefused = [
	// 括らない `!_` は穴（§3.5）。読めるのは、素の関数の実引数の並び（k = n は R16、k ≠ n は R34）・`!_` 1つ・`||!_||` だけで、
	// ほかは G7 か G13。前の R18（すぐ左が L・すぐ右が A なら取り除く）は廃止した（2026-10-21）。`!_` 1つの行（`x2 : !_` など）は
	// 下の「印と穴」で通る。R34（§5 Q31 の答え）でも、撒く項があれば k が数えられないので G13 のまま（下の「穴と実引数の数」）。
	["R18 を廃止した go !_ vs~（k ≠ n、撒く項）", std([...GO, "go !_ vs~"]), "G13"],
	["!_ + 1", std("!_ + 1"), "G7"],
	["[+ !_] 1", std("[+ !_] 1"), "G7"],
	["[+ !_]（1項でも）", std("[+ !_]"), "G7"],
	// `inc !_ inc`（G7）は、口が1つだけ残った inc の口の `!_` で、穴と読んでも恒等射と読んでも同じ関数（R46、2026-10-23）なので、
	// 通る側（下の「口の外の恒等射」の idPasses）へ移した。
	// アリティの分からない点なし `[,]` は、種類が未知の適用になる。前の `[*] 2 3 inc`・`1 [*] 2 3 4`（G2(a)）は、R31 で畳んで通る側
	// （下の「畳む2項の点なし」）へ移した。
	// 片イ（R120）から `[,] 2 3 inc` は通る。上の fixPasses へ移した。
	// `1 [,] 2 3 4`（2026-10-23 は G8：`[,]` が 1 を逆適用で取り、主語の口が決まらないまま 2 が来る）は、逆適用の廃止（R47）で
	// `1 ([,] 2 3 4)` に決まり、通る側（いちばん後ろの「逆適用の廃止」の norevPasses）へ移した。
	// `5 [*]`・`5 [' 0]`（G10）は、R13 を廃止して通る（R40）。下の「左からの畳み込み」の pfReversePasses へ移した。
	// 段18 の点なし。`[@] fs 0` は R32 で素の2引数の関数の足りた適用になり、get なので種類は未知（対に入れば G2(a)）。
	// 片イ（R120）から `[' 0] fs inc`・`[@ 0] fs inc`・`[@] fs 0 inc` は通る。上の fixPasses へ移した。
	// §3.3 の「他の読みと割れる所」の `5 inc 3 inc` は、前は G1（左が構築の節）だった。2026-10-22 から R37 で一番近い1項（`inc 3`）を
	// 取って通る（下の「余りと流れ」の行）。2026-10-24 の R47 からは `5 (inc 3)` の後ろに inc が余る。
	// 撒く項を中置・点なしにどう渡すかは仕様に無いので未知（2項以上の並びで G7）。
	// 片イ（R120）から、未知の項は2項以上の並びでも断らない（`vs~ + 1 5`・`[+ vs~] 1`）。上の fixPasses へ移した。
	// 種類の未知な名前を撒く項は未知の葉。中身の見える名前は位置に依らず G7。
	// 2026-10-26 の R81 で `use $inc 5` が A になった（`q~` は撒く項で通る。いちばん後ろの「R80〜R82」の節）ので、種類の未知な `uu 5` にした。
	// 片イ（R120）から、未知の葉の `q~ 5` は通る（上の fixPasses）。中身の見える `q : [uu 5]` の `q~` は §5 Q20 の G7 のまま。
	["q : [uu 5] の後で q~（前は q : [use $inc 5]）", std(["uu : x ? [,] x", "q : [uu 5]", "q~"]), "G7"],
	// 穴の頭は、`?` の定義を直に指す名前か `?` の括りだけ（別名は断る側に揃えた）。逆適用の右の `5 [inc]`・`5 q`・`5 p` は、口が1つだけ
	// 残った関数なので、2026-10-23 からその口を埋めた（R40 の読み3。2026-10-24 の R47 からは値の後ろに積まれて余る）。下の「左からの畳み込み」の
	// 通る行へ移した。
	// `p2 : add` の後で `p2 _ 3`（G5、別名の頭の内側の `_`）は、2026-10-28 の R105（値の口の `_` は消える）で `p2 3` と同じく通る側（いちばん後ろの「R105〜R110」の節）へ移した。
	// 字下げのブロックは並びの項にならない（§2）。中置の右でない所のブロックは断る。
	["ブロックが並びの項", std(["v :", "\tinc", " 5"]), "indent-block-position"],
	["ブロックが中置の左", std(["v :", "\t1", " + 1"]), "indent-block-position"],
	["ブロックが , の左", std(["v :", "\t1", " , 2"]), "indent-block-position"],
	["ブロックが == の左", std(["v :", "\t1", " == 2"]), "indent-block-position"],
	["本体のブロックが並びの項", std(["t : a ?", "\ta", "\tinc", " 5", "", "t 1 inc"]), "indent-block-position"],
	// 合成の最初の関数の本体の根が値でない。前は adder（§5 Q21）で見ていた。根が L の関数は G16 になった（R33）ので、根が未知の uu で見る。
	// `1 uu inc 5`（G2(a)：逆適用で uu が 1 を取って未知になり、後ろに 5 が来た）は、R47 で `1 (uu inc 5)` に決まり、通る側（norevPasses）へ移した。
	// 片イ（R120）から `uu inc 5 double`・`uu inc 5 6` は通る。上の fixPasses へ移した。
	// 器の中の器に関数が見える（構築を平らにするかは §5 Q12 で未決）。
	// 片イ（R123）から fs の要素は関数の番地（値）で関数が見えないので、関数の見える器は構造体の m（欄 say が関数）にした（前は fs。m は adder の仮引数を
	// 隠さないように adder を外す。下の「答え」の M と同じ綴りを、この行の所で書く）。
	["[m 1]~ 5（前は [fs 1]~ 5）", std(["m :", "\tsay : x ? x * 2", "\tother : 1", "", "[m 1]~ 5"], { omit: ["adder"] }), "G7"],
	["gs : m 1 の後で gs~ 5（前は gs : fs 1）", std(["m :", "\tsay : x ? x * 2", "\tother : 1", "", "gs : m 1", "gs~ 5"], { omit: ["adder"] }), "G7"],
	["[vs , m]~ 5（前は [vs , fs]~ 5）", std(["m :", "\tsay : x ? x * 2", "\tother : 1", "", "[vs , m]~ 5"], { omit: ["adder"] }), "G7"],
	["[k : inc]~ 5", std("[k : inc]~ 5"), "G7"],
	["構造体の欄に関数", std(["st :", "\tk : inc", "\tj : 2", "", "st~ 5"]), "G7"],
	// 関数の本体の外の括りでも、`:` の左の名前は局所の定義か欄か決まらない（§5 Q10）。
	["[sq : z ? z * z ⏎ sq 5]", std(["[sq : z ? z * z", "sq 5]"]), "G7"],
	["ブロックの中の sq : … ⏎ sq 5", std(["pp :", "\tsq : z ? z * z", "\tsq 5"]), "G7"],
	// 片側の欠けた `?` は `[?]` の点なし（§2 Q19）。名前を通しても関数にしない。
	// 片イ（R119）から、1行の括りの片側の欠けた `?` は読む段の pointfree-tree-notation（定義の行で止める）。
	["ff : [z ?] の後で ff 5（前は G7、R119）", std(["ff : [z ?]", "ff 5"]), "pointfree-tree-notation"],
	["ff : [z ?] の後で 5 ff（前は G7、R119）", std(["ff : [z ?]", "5 ff"]), "pointfree-tree-notation"],
	["ff : [? z] の後で ff 5（前は G7、R119）", std(["ff : [? z]", "ff 5"]), "pointfree-tree-notation"],
	// 囲みの中が関数（§5 Q22）。片イ（R120）から、囲みは種類の未知な項として通る（`|inc| 5`・`-|inc| 5`・`|vs~| 5`）。上の fixPasses へ移した。
	// 前の R15 の「`_` を含まない A の項」の行 `_ [_ 1]` は、値だけの並びの印が消える（2026-10-21）ので通る側（「印と穴」）へ移した。
];
for (const [name, src, want, kind, extra] of fixPasses) checkPass(`確かめ ${name}`, src, want, kind, extra);
for (const [name, src, want] of fixRefused) checkRefused(`確かめ ${name}`, src, want);

// 試験の穴：変異試験で壊しても落ちなかった所と、それを見分ける入力。
const gapPasses = [
	// R47：値の後ろの `?` の括りも積まれて余る（R42・R48）。前は逆適用で `(apply [x ? x + 1] 5 ·rev)`。
	["5 [x ? x + 1]（R47。前は逆適用）", std("5 [x ? x + 1]"), "(construct 5 (unit [x ? x + 1]))", "A"],
	// 貪欲な単項は excess にしない（§3.4）。並びを受けている間に来た inc は合成の後ろ（R41）。木は入れ子の適用（R47 で `·rev` の綴りが
	// 無くなった。前は `(apply inc (apply [* 2,] (construct 1 2 3)) ·rev)`）。
	["[* 2,] 1 2 3 inc", std("[* 2,] 1 2 3 inc"), "(apply inc (apply [* 2,] (construct 1 2 3)))", "A"],
	// 前は `double adder 5`（adder の根が L、§5 Q21）。根が L の関数は G16（R33）なので、根が未知の uu で見る。
	["double uu 5（未知の根）", std(["uu : x ? [,] x", "double uu 5"]), "(apply (compose double uu) 5)", "未知"],
	// 前は未知（§5 Q13）。R36 の流れで `add (inc 5)` の足りない適用（L）。
	["inc add 5（根に残った関数は `_`、R42。前は L の根、その前は未知）", std("inc add 5"), "(unit (apply (compose inc add) 5))", "A"],
	// §5 Q4 の答え（R36）で、足りない適用を含む合成も流れとして読む。前は G2(b)（下の gapRefused にあった）。
	["add inc 1 double 5（前は G2(b)）", std("add inc 1 double 5"), "(apply (compose (apply (compose add inc) 1) double) 5)", "A"],
	["pc : use 5 inc の後で pc double 3（前は G2(b)。use の本体の根が未知なので未知）", std(["pc : use 5 inc", "pc double 3"]), "(apply (compose pc double) 3)", "未知"],
	// 既定値の無い素の関数の内側の `_` は、k ≠ n でも `!_` と同じ（R38）。前は G5（下の gapRefused にあった）。
	// 2026-10-28 の R105 で、値の口の `_` は消えて口を使わないので `add 10 5`（R38 の `add 5 10` から変わった）。
	["add _ 10 5（R105 で `add 10 5`。前は R38 の穴で `add 5 10`、その前は G5）", std("add _ 10 5"), "(apply add (construct 10 5))", "A"],
	["R31 で変わった [+] inc 5（`[+] 5` は 5、前は未知の根）", std("[+] inc 5"), "(apply (compose [+] inc) 5)", "A"],
	["[,] inc 5（未知の根）", std("[,] inc 5"), "(apply (compose [,] inc) 5)", "未知"],
	["use 5 inc double（R8 で開く。根なので `_`、R42）", std("use 5 inc double"), "(unit (compose (apply use 5) inc double))", "A"],
	// `[f3 _ _ 3]` は口が2つの穴の関数で、1 2 で閉じて値になる。後ろの inc は積まれて余る（R47・R42・R48）。前は逆適用で
	// `(apply inc (apply [f3 _ _ 3] (construct 1 2)) ·rev)`。
	["[f3 _ _ 3] 1 2 inc（R47）", std("[f3 _ _ 3] 1 2 inc"), "(construct (apply [f3 _ _ 3] (construct 1 2)) (unit inc))", "A"],
	// 穴の生成名はソースの名前と衝突しない綴りにする。2026-10-28 の R105 で書いた `_` は穴にならない（`add _ p0` は `add p0`）ので、見本の穴を `!_` に替えた（見る目的は同じ）。
	["p0 : 1 の後で add !_ p0（根なので `_`、R42。前の見本は `add _ p0`）", std(["p0 : 1", "add !_ p0"]), "(unit (? [$p_0] (apply add (construct $p_0 p0))))", "A"],
	["[] 5", std("[] 5"), "(construct [] 5)", "A"],
	// R47：括りの値の後ろの inc は積まれて余る。前は逆適用で `(apply inc [1 ⏎ 2] ·rev)`。
	["[1 ⏎ 2] inc（R47）", std(["[1", "2] inc"]), "(construct [1 ⏎ 2] (unit inc))", "A"],
	["#ff : y ? y の後で ff 5", std(["#ff : y ? y", "ff 5"]), "(apply ff 5)", "A"],
	["ff : [y ? ff y]（輪にしない）", std(["ff : [y ? ff y]", "ff 5"]), "(apply ff 5)", "A"],
	["$!_ 5", std("$!_ 5"), "(construct $!_ 5)", "A"],
	// undefined-name は名前ごとに1回だけ出す。2026-10-28 の片9b から、根の `say say` は R112 で2つとも `_` と同じに消える（木は `say`）ので、名前の残る括りの中で見る。
	["[say say]（前は根の `say say` で `(construct say say)`）", std("[say say]"), "[say say]", "A", { diag: "say", diagCount: 1 }],
	// 片イ（R120、2026-11-03）から、下の gapRefused の G2(a) と種類の未知な項の G7 の行は通る（木は畳みの予想、R118）。仮置きの取り消しと本体の根が
	// 未知なことは、根の種類（未知）で見る（仮置きの A が残れば根は A になる）。
	["[+ inc] 5（前は G7）", std("[+ inc] 5"), "(construct [+ inc] 5)", "未知"],
	["相互再帰：仮置きの取り消し（前は G2(a)）", std(["fq : k ? (gq k) ' 0", "gq : k ? fq k", "gq 1 inc"]), "(construct (apply gq 1) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	["相互再帰：依っている答えを戻す（前は G2(a)）", std(["fq : k ? ([gq k] * [hq k]) ' 0", "gq : k ? fq k", "hq : k ? gq k", "hq 1 inc"]), "(construct (apply hq 1) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	["字下げの本体の最後の行の根が未知（前は G2(a)）", std(["t : a ?", "\ta", "\t[,] a", "", "t 1 inc"]), "(construct (apply t 1) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	// 寄せ1（R128）から `⇥yy : 5` は条件 yy（未定義の名前で `_`）の枝で、本体の根は A（前は定義か枝か決まらず未知）。
	["枝のある字下げの本体の名前1つの条件の行（前は枝の無い本体の yy : 5）（前は G2(a)）", std(["t : a ?", "\ta > 0 : 1", "\tyy : 5", "\ta", "", "t 1 inc"]), "(construct (apply t 1) (unit inc))", "A", { leftoverDiag: ["inc"] }],
	// 寄せ1（R128）：括りの欄の名前は外からは引かない（local-field）ので、本体の括りの外の yy は未定義の名前（前は本体の局所の名前で G7）。
	["本体の括りの欄の名前を括りの外で書く [yy : a] yy（前は G7）", std("h : a ? [yy : a] yy"), "(construct [yy : a] yy)", "A", { body: true, diag: "yy" }],
	["-_ 5（前は G7）", std("-_ 5"), "(construct -_ 5)", "未知"],
	["say@ 5（前は G7）", std("say@ 5"), "(construct say@ 5)", "未知"],
	["本体 [@h] 5（前は G7）", std("t : h ? [@h] 5"), "(construct [@h] 5)", "未知", { body: true }],
];
const gapRefused = [
	// 足りない適用を含む合成が逆適用の右（`5 use 5 inc`）：前は G2(b)、2026-10-23 は G8（`5 use` の主語の口が決まらないまま 5 が来る）。
	// 逆適用の廃止（R47）で `5 (use 5 inc)` に決まり、通る側（norevPasses）へ移した。
	// `5 add1`・`5 add inc`・`double inc 5 6 inc` は、2026-10-23 から通る（R40・R42。2026-10-24 から R47 の答え）。下の「左からの畳み込み」の
	// 通る行へ移した。
	// `g3 : f3 1` の後で `g3 _ 3`（G5）と `add _ vs~`（G5）は、2026-10-28 の R105（値の口の `_` は消える）で `g3 3`・`add vs~` と同じく通る側（いちばん後ろの
	// 「R105〜R110」の節）へ移した。
	// `add _ inc`（G5、終わりの後ろに関数が続く形）は、2026-10-26 の R28 の書き直し（引数の並びの終わりの `_` は消える）で `add inc` と同じく通る側（いちばん
	// 後ろの「R28」の節）へ移した。
	["inc~", std("inc~"), "G7"],
	["[inc double]~", std("[inc double]~"), "G7"],
	// 片イ（R120）から `[+ inc] 5` は通る。上の gapPasses へ移した。
	// `[~_] 5`（G7）は、2026-10-27 の R88（§5 Q14 の残りの答え：`~_` は書いた `[_]` と同じ項。同じ日の確かめの直しの前は「書いた `[]` と同じ」）で通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	// `[inc == 2] 5`（G7：辺が関数の `==` は未知）は、2026-10-26 の R76（§5 Q37 の答え：比べの被演算子は評価する所）で inc が `_` になり、通る側（いちばん後ろの
	// 「R73〜R79」の節）へ移した。
	// 2026-10-26 の R80（§5 Q10 の答え）で、枝の無い本体の局所の定義 `yy : inc` ⏎ `yy a` は右辺の種類で読んで通った。寄せ1（R128、2026-11-04）で R80 をやめ、
	// 本体の `:` の行は枝なので、`yy : inc` ⏎ `yy : double` ⏎ `yy a` は条件 yy の枝2つと既定の行で通る（同じ条件の枝が2つでも断らない。いちばん後ろの
	// 「R80〜R82」の節）。本体 `[yy : a] yy` の括りの行は器の欄（local-field）で、外からは引かない。寄せ1（R128）で関数の本体の範囲は局所の名前を数えなく
	// なったので、括りの外の yy は未定義の名前（`_`、R111）で通る（上の gapPasses。前は括りの欄の名前を本体の範囲の局所の名前にも数えて G7）。
	["仮引数の重複", std("ff : x x ? x"), "name-duplicate"],
	["括りの中の取り込み", std(["[io@]", "say 5"]), "G7"],
	// 仮置きを取り消す仕組み：gq の根は fq の仮置き A の上で A と出るが、fq の根は gq から引いた物で未知なので、仮置きが外れて
	// gq も未知。外れた仮置きに頼った答え（A）が残ると `gq 1 inc` が通る。前の fq は `[+ [gq k]]`（仮置き A の上で区間 L）だったが、
	// 区間の綴りの本体は G16（R33、2026-10-22）なので、`(gq k) ' 0` にした（古いと印を付けないように変えると、どちらの行も通る）。
	// 片イ（R120）から、相互再帰の2行は G2(a) で断らず、上の gapPasses で根の種類（未知）を見る。
	// 字下げの本体が A にならない形。最後の行が関数の `t : a ?` ⏎ `⇥a` ⏎ `⇥inc` は、2026-10-26 の R76（§5 Q37 の答え：字下げの本体の行は評価する所）で行の inc が
	// `_` になり本体の根が A なので、通る側（いちばん後ろの「R73〜R79」の節）へ移した。行の根が未知の形（`⇥[,] a`）で同じ G2(a) を見る。
	// 2026-10-26 の R80 で、枝の無い本体の局所の定義の行は値の行に数えず（定義）、`⇥yy : 5` ⏎ `⇥a` の本体の根は A（いちばん後ろの「R80〜R82」の節）。枝のある
	// 本体の左が名前1つの行は今のまま定義か枝か決まらないので、本体の根は未知。
	// 片イ（R120）から、この2行も G2(a) で断らず、上の gapPasses で根の種類（未知）を見る。`-_ 5`・`say@ 5`・本体 `[@h] 5` も種類の未知な項として通る。
	["#z 5（前は G7、R119）", std("#z 5"), "export-mark-position"],
	["a ' b @ c", std("a ' b @ c"), "infix-mixed-assoc"],
	["5 +", std("5 +"), "infix-missing-operand"],
	["1 === 1", std("1 === 1"), "operator-removed"],
	// 本体の根を先に解くとき（§6.4 の1）は門で止めず、行を解くときに行の順に断る。本体は段4〜8 の中置の被演算子の `!_`（G7、§5 Q15）。
	// 前の本体 `!_` だけは、2026-10-21 に恒等射で通るようになった。前の1行目 `1 2 inc`（G1）は R37 で通るようになったので、G12(a) の
	// `inc 1 2 inc` にした。その `inc 1 2 inc` も 2026-10-23 に通るようになった（R40）ので、G8 の `5 f2 1` にした。前の本体の頭の `!_`
	// （`!_ 5`、G7）は、同じ日に恒等射で通るようになった（R44）ので、`!_ == 5` にした。`5 f2 1` も 2026-10-24 に通るようになった（R47、
	// G8 の廃止）ので、1行目を G2(a) の `use $inc 5 3` にした。
	// 2026-10-26 の R81 で `use $inc 5 3` が通るので、1行目を本体の根が未知の `uu 5 3` にした。
	// 片イ（R120、2026-11-03）で G2(a) が無くなり `uu 5 3` は通るので、いちばん先に当たる門は本体の穴の G7（カの片に残る門）。
	["門は行の順に断る", std(["uu : x ? [,] x", "uu 5 3", "tt : a ? !_ == 5"]), "G7"],
];
for (const [name, src, want, kind, extra] of gapPasses) checkPass(`穴 ${name}`, src, want, kind, extra);
for (const [name, src, want] of gapRefused) checkRefused(`穴 ${name}`, src, want);

// ---------------------------------------------------------------------------
// 穴は `!_`、書いた `_` はいつも印（利用者 2026-10-21、§3.5・R16・R27、G13〜G15）
// ---------------------------------------------------------------------------
//
// 利用者 2026-10-21 03:19「この表で仕様と実装を書き直して。未決の3つ（go !_ xs、点なしの前置・後置の綴り、既定値のある関数の
// 種類）は名指しで断っておいて。」の表の行と、その3つの門（G13 `go !_ xs`・G14 点なしの前置・後置・G15 既定値のある関数の `_`）。
// G14 は同じ日に廃止した（下の「前置・後置の点なし」）。`go !_ xs` は §5 Q31 の答え（2026-10-21 22:51・22:55、R34）で通り、G13 は
// 撒く項と前から n 個の外の `!_` だけに狭まった（下の「穴と実引数の数」）。
// 書いた `_` は穴にならない（U 10-21 03:06、U〔答え〕03:11）。既定値の無い素の関数の `f _ 3` は今までどおりカリー化（U 10-21 03:14）。
// 並びの最後の `_` は、2026-10-26 の R28 の書き直しから消える印：消した後の部分適用・合成は関数のまま残り、評価する所で何も受けずに残れば `_`
// （U〔答え〕[2026-10-26 10:15 c8ccdd69] のボタン「8 でいい」）。前は「ここで終わる」：足りなければ印、飽和なら評価（U〔答え〕10-14 03:14）。括りの関数の
// 実引数の `_` は消える（U〔答え〕10-14 22:23）。`||f||` は合成（U〔答え〕10-21 03:01）。

const S3 = "s3 : [p] [q] [r] ? p"; // 括りの仮引数が3つ（`(s 1 _ 3) 2` は `(s 1 3) 2`）
const IO1 = "io1 : [say] ? say 21";
const PB = "pb : [a] [b] ? a";
const unitPasses = [
	// 書いた形（既定値の無い素の関数）：カリー化 `a ? f a 3`（R16 の木のまま）。行の根に残った穴の関数は `_`（R42。木は `(unit …)` で包む。
	// 下の穴の行も同じ）。
	// 2026-10-28 の R105 から、書いた `_` は値の口で消える（カリー化しない）：`f3 _ 2 3` は `f3 2 3` で、口が1つ残った部分適用（根なので `_`）。前は R16 のカリー化
	// `(unit (? [$p0] (apply f3 (construct $p0 2 3))))`。
	["f3 _ 2 3（R105 で `f3 2 3`。根なので `_`、R42。前はカリー化）", std("f3 _ 2 3"), "(unit (apply f3 (construct 2 3)))", "A"],
	// 穴 `!_`：位置どおりに仮引数。最後の項でもよい（η）
	["f3 !_ 2 3（穴。R42）", std("f3 !_ 2 3"), "(unit (? [$p0] (apply f3 (construct $p0 2 3))))", "A"],
	["add 1 !_（穴、η で add 1。R42）", std("add 1 !_"), "(unit (? [$p0] (apply add (construct 1 $p0))))", "A"],
	["inc !_（穴、η で inc。R42）", std("inc !_"), "(unit (? [$p0] (apply inc $p0)))", "A"],
	// 2026-10-28 の R105：`_` が消えて `f4 2 !_ 3`、R34 の k < n（`a [~c] ? f4 2 a 3 c~`）。前は `_` も穴で `(unit (? [$p0 $p1] (apply f4 (construct $p0 2 $p1 3))))`。
	["f4 _ 2 !_ 3（R105 で `f4 2 !_ 3` の R34。R42。前は印の穴と !_ が混ざる穴2つ）", std("f4 _ 2 !_ 3"), "(unit (? [$p0 [~$p1]] (apply f4 (construct 2 $p0 3 $p1~))))", "A"],
	["[add 1 !_] 5", std("[add 1 !_] 5"), "(apply [add 1 !_] 5)", "A"],
	["go !_ 3（既定値があっても穴。R42）", std([...GO_DEFAULT, "go !_ 3"]), "(unit (? [$p0] (apply go (construct $p0 3))))", "A"],
	// 末尾の `_`：2026-10-26 の R28 の書き直しから消える印。足りない適用は関数のまま残り、根なら `_`（R42・R48）、飽和なら評価。前（2026-10-21〜26）は
	// 「ここで終わり」で、足りなければ印（`(apply add (construct 3 _))`、値は `_`）だった。
	["add 3 _（R28 で `add 3` が残り、根なので `_`。前は終わりの印 `(apply add (construct 3 _))`）", std("add 3 _"), "(unit (apply add 3))", "A", { leftoverDiag: ["(apply add 3)"] }],
	// 括りの中の `add 3 _` は `add 3` で関数（L）。後ろの inc は合成になり、根に余って `_`。前は括りが印（値）で、inc は積まれて余った
	// （`(construct [add 3 _] (unit inc))`。その前は逆適用で `(apply inc [add 3 _] ·rev)`）。
	["(add 3 _) inc（R28 で括りは関数 `add 3`、inc と合成。前は括りが印で `(construct [add 3 _] (unit inc))`）", std("(add 3 _) inc"), "(unit (compose [add 3 _] inc))", "A"],
	// 飽和なら評価：左からの畳み込み（R40・R43）では `add 2 3` で口が埋まって値になり、後ろの `_` は値の隣の並びの単位として消える（R15）。
	// 前は R28 の k' = n で `_` を木に残した（`(apply add (construct 2 3 _))`）。値は同じ 5。
	["add 2 3 _（飽和なら評価。`_` は消える、R43）", std("add 2 3 _"), "(apply add (construct 2 3))", "A", { leftover: false }],
	// k' > n は、最後の `_` を除いた `d 1 2` と同じ（R28）で、余りを後ろに積む（R35）。構築の中の `_` は手順8で消えるので、木に書かない。
	["d 1 2 _（k' > n は余りを後ろに積む）", std("d 1 2 _"), "(construct (apply d 1) 2)", "A", { leftover: true }],
	["[+ 1] _（R28 で `[+ 1]`、根なので `_`。前は終わりの `(apply [+ 1] _)`）", std("[+ 1] _"), "(unit [+ 1])", "A", { leftoverDiag: ["[+ 1]"] }],
	// U〔答え〕[2026-10-26 10:15 c8ccdd69]（ボタン「8 でいい」）：`(add 3 _) 5` は `(add 3) 5` で値は 8。前は括りの中で終わって `_ 5` の 5（`(construct [add 3 _] 5)`）。
	["(add 3 _) 5（R28 で `(add 3) 5`、値は 8。前は括りの中で終わって `(construct [add 3 _] 5)`）", std("(add 3 _) 5"), "(apply [add 3 _] 5)", "A"],
	// `5 add 3 _` は、2026-10-23 は add が 5 を逆適用で取り、口が決まらない（§5 Q5）まま 3 が来るので G8（R40）だった。逆適用の廃止（R47）で
	// `5 (add 3 _)` に決まり、通る側（norevPasses）へ移した。
	// 印が単位として消える
	["[1 _ 3]", std("[1 _ 3]"), "[1 _ 3]", "A"],
	["_ + 1", std("_ + 1"), "(+ _ 1)", "A"],
	["1 * _", std("1 * _"), "(* 1 _)", "A"],
	["_ [_ 1]（前は G5）", std("_ [_ 1]"), "[_ 1]", "A"],
	["_ $!_（前は G5）", std("_ $!_"), "$!_", "A"],
	["[_ +] 5（点なしの被演算子の印も A、前は G5）", std("[_ +] 5"), "(apply [_ +] 5)", "A"],
	["_（印は値）", std("_"), "_", "A"],
	// 2026-10-28 の片9b：`xu : _` は書かなかったことと同じ（R113）で、xu は未定義の名前（R111）。値の口では書いた `_` と同じ（R112）で、`inc _` と同じく inc が残る。前は `(apply inc xu)`。
	["xu : _ の後で inc xu（R112・R113 で `inc _` と同じ。前は `(apply inc xu)`）", std(["xu : _", "inc xu"]), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	// ノルムの囲み（R27）
	["||_||", std("||_||"), "||_||", "A"],
	// `||$_||`（U〔答え〕10-21 03:01「||$_|| = 1」）は、2026-10-24 の R53 で `$_` が G20 になり、2026-10-25 の R56 で `$_` は零射 `$[x ? _]` の番地
	// （U [2026-10-25 00:08 8dfc006e]「…$_ は $[x ? _]」）として通るので、1つの値で A に戻った。
	["R56 ||$_||（R53 では G20、その前は A）", std("||$_||"), "||$_||", "A"],
	["||$!_||", std("||$!_||"), "||$!_||", "A"],
	["||!_||（ノルムの口の穴。根なので `_`、R42）", std("||!_||"), "(unit ||!_||)", "A"],
	["||!_|| 1 2 3（並び全体を受けて数える）", std("||!_|| 1 2 3"), "(apply ||!_|| (construct 1 2 3))", "A"],
	["||inc||（合成。根なので `_`、R42）", std("||inc||"), "(unit ||inc||)", "A"],
	["||inc|| 3", std("||inc|| 3"), "(apply ||inc|| 3)", "A"],
	["||add 1|| 2（足りない適用の残りを待つ）", std("||add 1|| 2"), "(apply ||add 1|| 2)", "A"],
	["double ||inc|| 3（合成の中の合成）", std("double ||inc|| 3"), "(apply (compose double ||inc||) 3)", "A"],
	// `$!_` は値（恒等射を物にした番地）。`$_ 5` は、2026-10-24 の R53 で G20（書いた `_` は印＝値で、`$` は関数だけを運ぶ）になり、2026-10-25 の
	// R56 で `$_` が零射の番地（値）になって、前の `(construct $_ 5)` の A に戻った。
	["R56 $_ 5（R53 では G20、その前も A）", std("$_ 5"), "(construct $_ 5)", "A"],
	// `!_` 1つ：穴だけ＝恒等射（並び全体を受ける）。恒等射は括らずに書く（U 10-21 08:24「恒等射なら括らなくていい。」）。括った
	// `[!_]` は否定の点なし（下の「前置・後置の点なし」）。前は `[!_]` を恒等射と読み、`[!_] 5`・`[!_] 1 2 3` をここで試していた。
	["!_ 1つ（恒等射。行の根なので `_`、R42）", std("!_"), "(unit !_)", "A"],
	["x2 : !_（前は G7）", std("x2 : !_"), "(: x2 !_)", null],
	["x2 : !_ の後で x2 5", std(["x2 : !_", "x2 5"]), "(apply x2 5)", "A"],
	["i : !_ の後で i 5", std(["i : !_", "i 5"]), "(apply i 5)", "A"],
	["i : !_ の後で i 1 2 3（並び全体を受ける。excess にしない）", std(["i : !_", "i 1 2 3"]), "(apply i (construct 1 2 3))", "A", { leftover: false }],
	// R28 の書き直し（2026-10-26）で `i _` は `i`：根に残った恒等射は `_` で、知らせない（R48）。前は終わりの `(apply i _)`。
	["i : !_ の後で i _（R28 で i、根なので `_`。前は終わりの `(apply i _)`）", std(["i : !_", "i _"]), "(unit i)", "A", { leftoverDiag: [] }],
	// 並び全体を受けた結果（A）の後ろの逆適用 `i 1 2 inc` は、2026-10-22 の確かめから G12(a)（下の unitRefused）。前はここで
	// `(apply inc (apply i (construct 1 2)) ·rev)` と通していた。
	// 本体が `!_` だけの関数（`tt : a ? !_`）も行は恒等射（L）と読むが、本体の根が裸の関数なので G16（R33、下の unitRefused）。前は
	// ここで通っていた（その前は G7）。
	// 行が `!_` だけなら、2行以上の括りの中の行・構造体の欄でも恒等射（R29 の R の所）。中置の被演算子の `!_` は下の G7。
	["[!_ ⏎ 1]（前は G7）", std(["[!_", "1]"]), "[!_ ⏎ 1]", "A"],
	["構造体の欄 a : !_ を引く（引いた恒等射は L。行の根なので `_`、R42）", std(["st :", "\ta : !_", "", "st ' a"]), "(unit (' st a))", "A"],
	// 括りの関数の実引数の `_` は、括りが受ける並びの中の印で、消える。最後の `_` は、2026-10-26 の R28 の書き直しから足りなくても消える（前は `_` を除いた
	// 実引数がアリティ以上のときだけ消し、足りなければ終わりの読みと割れて G5 だった。その行はいちばん後ろの「R28」の節へ移した）
	["(s3 1 _ 3) 2", std([S3, "(s3 1 _ 3) 2"]), "(apply [s3 1 _ 3] 2)", "A"],
	["s3 1 2 3 _（_ を除いてアリティどおりなら消える）", std([S3, "s3 1 2 3 _"]), "(apply s3 (construct 1 2 3))", "A"],
	["(s3 1 _ 3) 2 の実体は (s3 1 3) 2 と同じ", std([S3, "(s3 1 _ 3) 2"]), "(: s3 (? [[p] [q] [r]] (inst N N N p)))", null, { at: -2 }],
	["(s3 1 3) 2 の実体", std([S3, "(s3 1 3) 2"]), "(: s3 (? [[p] [q] [r]] (inst N N N p)))", null, { at: -2 }],
	// 既定値のある口（go の zs）に書いた `_` は、既定値という値（R39、U〔答え〕10-21 23:42）。木では実引数のまま残し、種類は `go 1 3` と
	// 同じ（既定値のある関数の適用は未知）。前は G15（下の unitRefused にあった）。
	["go 1 _（既定値のある口の _、前は G15）", std([...GO_DEFAULT, "go 1 _"]), "(apply go (construct 1 _))", "未知"],
	// 足りない適用を含む合成を囲んだノルムも、括りの `[use 5 inc] 3` と同じく流れで読む（R36）。use の本体の根が未知なので未知。前は G2(b)。
	["||use 5 inc|| 3（前は G2(b)）", std("||use 5 inc|| 3"), "(apply ||use 5 inc|| 3)", "未知"],
	// 片イ（R125、2026-11-03）：本体の返す所の裸の関数は `(unit …)` で、恒等射は知らせない（G16 は廃止）。
	["本体が !_ だけ（前は通る）（前は G16）", std("tt : a ? !_"), "(unit !_)", "A", { body: true, diagCount: 0 }],
	// 片イ（R126）：G18 は単位律の側に決まり、恒等射を消した `1 2 inc` と同じ木で畳み直す。
	["G18 i 1 2 inc（恒等射の並びの後ろに関数。G12(a) → G18）（前は G18）", std(["i : !_", "i 1 2 inc"]), "(construct 1 2 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	// 片イ（R120）：囲みは種類の未知な項として通る。
	["G7 |!_| 5（絶対値の囲みに関数）（前は G7）", std("|!_| 5"), "(construct |!_| 5)", "未知"],
	["G7 |inc| 5（前は G7）", std("|inc| 5"), "(construct |inc| 5)", "未知"],
	// 片イ（R126）：G15 は廃止で、本体の `f 1 2 _ 5` は go でも gq でも `_` の消えた予想で通る。鍵を分けたことは、ap の定義の行の実体が2つあることで見る
	// （分け合えば実体は1つ）。前は go の行の G15 で見ていた。
	["鍵 ap [f : gq] の行と ap [f : go] の行は実体を分ける（gq が先。前は go の行が G15）", std(["gq :", "\t\ta b", "\t? a", "", ...GO_DEFAULT, "ap : [f] ? f 1 2 _ 5", "w : y ? ap [f : gq]", "w2 : ap [f : go]"]), "(: ap (? [[f]] (inst {f:L} (apply f (construct 1 2 5))) (inst {f:L} (apply f (construct 1 2 5)))))", null, { at: -3 }],
	["鍵 ap [f : go] の行と ap [f : gq] の行は実体を分ける（go が先。前は go の行が G15）", std(["gq :", "\t\ta b", "\t? a", "", ...GO_DEFAULT, "ap : [f] ? f 1 2 _ 5", "w2 : ap [f : go]", "w : y ? ap [f : gq]"]), "(: ap (? [[f]] (inst {f:L} (apply f (construct 1 2 5))) (inst {f:L} (apply f (construct 1 2 5)))))", null, { at: -3 }],
];
const unitRefused = [
	// 2026-10-24 の R53 の `||$_||`・`$_ 5`（G20）は、2026-10-25 の R56（`$_` は零射 `$[x ? _]` の番地）で上の unitPasses へ戻した。
	// 本体が `!_` だけ：行は恒等射（L、R29）なので、本体の根が裸の関数（G16、R33）。前は `!_` の L で通っていた。
	// 片イ（R125）で G16 は廃止し、上の unitPasses へ移した。
	// G15：既定値のある関数の実引数に書いた `_` が、既定値の無い口（go の ys）に当たる（R39 の残り、§5 Q8）。既定値のある口に当たる
	// `go 1 _` は、2026-10-22 から通る（上の unitPasses）。
	// `go _ 3`・`5 go _ 3`（内側の `_` が既定値の無い口 ys に当たる。G15）は、2026-10-26 の R68（§5 Q8 の答え：カリー化）で通る側（いちばん後ろの
	// 「R64〜R72」の節）へ移した。2026-10-23 の `5 go _ 3` は、go が 5 を逆適用で取り、口が決まらない（§5 Q5）まま `_` が来て G8、その前は G15。
	// 最後の項の `_` が既定値の無い口に当たる形（`go _`）は今のまま G15（下の「R64〜R72」の節）。
	// 合成は左から実行する（R11）。積まれた go に inc を合成し、`_` は go の最初の口（ys）に当たる。`5 go inc _`（G15。2026-10-23 は G8、その前は G15）は、
	// 2026-10-26 の R28 の書き直し（既定値の無い口の末尾の `_` は消える）で通る側（いちばん後ろの「R28」の節）へ移した。
	// 前の G13 の行（`inc !_ 5`・`add !_ 1 2`・既定値のある go の `go !_ 3 4`・`go !_`）は、§5 Q31 の答え（R34）で通る側（下の
	// 「穴と実引数の数」）へ移した。
	// 字下げの仮引数のブロックの1行に名前が2つあると、仮引数の数が数えられないので穴にしない（前は行の数 2 を n にして、
	// 仮引数3つの関数の `gz !_ 3` を黙って穴にした）。
	["G7 gz !_ 3（仮引数のブロックの行 a b）", std(["gz :", "\t\ta b", "\t\tc : 3", "\t? a", "", "gz !_ 3"]), "G7"],
	// G14（`[-_] 5`・`[_!] 5`・`[!!_] 5`・`[-_]`）は廃止して、下の「前置・後置の点なし」で通る。
	// G5：書いた `_` の読みが決まらない位置
	// `f3 _ 2 _`（内側の `_` と終わりの `_`）・`add _ inc`（終わりの後ろに関数）は、2026-10-26 の R28 の書き直し（末尾の `_` は消える）で、`f3 _ 2` の R38 の
	// 穴の関数・`add inc` の合成と同じく通る側（いちばん後ろの「R28」の節）へ移した。
	// `inc 5 _ inc`・`_ inc`・`5 _ inc`・`1 2 _ inc` は、2026-10-23 から通る：畳み込みは並びの単位から始まり、値の隣と空の並びの `_` は
	// その場で消える（R15・R43）ので、逆適用の主語にならない（決定から外れた所。§7.18）。下の「左からの畳み込み」の通る行へ移した。
	// 2026-10-24 の R47 からは、後ろの inc は値の後ろに積まれて余る。
	// 恒等射が2項以上の並び全体を受けて、後ろに関数が続く（左からの畳み込みでは、開いた恒等射の後ろに inc が合成される）。結果全体を
	// 1つの値で渡す読み（R29）と、単位律で `i 1 2` を `1 2` と同じに見る読み（2026-10-23 は逆適用で `1 (inc 2)`、2026-10-24 の R47 からは
	// inc が積まれて `1 2` の後ろに余る）で割れる（G18。前は G12(a)）。片イ（R126）で単位律の側に決まり、上の unitPasses へ移した。
	// 前の `G5 [+] 1 _（貪欲な頭の終わり）` は、R31 で `_` が被演算子の印（`1 + _`）になって通る側（下の「畳む2項の点なし」）へ移した。
	// `[* 2,] 1 _`（貪欲な単項の頭の終わり）・`inc inc _`（合成の頭の終わり、§5 Q18）は、2026-10-26 の R28 の書き直し（末尾の `_` はどの頭でも消えるので、
	// 頭のアリティを数えない）で通る側（いちばん後ろの「R28」の節）へ移した。
	["G5 io1 !_（括りの関数に穴）", std([IO1, "io1 !_"]), "G5"],
	// 括りの関数の実引数の最後の `_` で、`_` を除いた実引数がアリティに足りない形（`io1 _`・`(io1 _) 5`・`io1 _ inc`・`pb 1 _ inc`・`pb 1 _`）は、終わり（R28）と
	// 消える印（U〔答え〕10-14 22:23）で種類が割れるので G5 だった（その前は消えて、`io1 _` は io1、`(io1 _) 5` は io1 を 5 で呼び、`io1 _ inc` は合成）。
	// 2026-10-26 の R28 の書き直しで、R28 も R15 も「消える」になり、割れが無くなった。通る側（いちばん後ろの「R28」の節）へ移した。
	// 残りの仮引数に裸の物がある括りの関数：`_` を消して詰めると、後ろの実引数が裸の口へずれる（3 が a に入る）。カリー化
	// （U 10-21 03:14）とも読めるので断る。前（2026-10-21 の直しの途中）は消して `mx 3` と読んでいた。
	// 2026-10-28 の R105（値の口の書いた `_` も単位律で消える。U〔答え〕[2026-10-27 15:59 58a809c9] の「mx _ 1 は mx 1」）で、裸の口でも括りの口でも消えるので
	// 割れが無くなった。`G5 mx _ 3` と `G5 (mx 1) _ 3`（mx3 は `[a] b [c]`）は、`mx 3`・`(mx3 1) 3` と同じく通る側（いちばん後ろの「R105〜R110」の節）へ移した。
	// `mx 1 _ 3` は、`_` が残りの括りの口 [b] に当たる（裸の口は 1 で埋まった）ので消える（R15・R43）。下の「左からの畳み込み」へ移した。
	// G7：`!_` の位置の外。口の外の `!_ 5`・`5 !_`（G7）は恒等射（R44）、`,` の被演算子の `!_ , 1`（G7）は積の単位（R45）、
	// `inc !_ inc`（G7）は口が1つだけ残った inc の口（R46）で、2026-10-23 に通る側（下の「口の外の恒等射」の idPasses）へ移した。
	// 段4〜8 の中置の被演算子の `!_` 1つ（§3.5 の決定の「中置の被演算子」。行が `!_` だけではない）は G7 のまま（§5 Q15）。
	["G7 !_ == 1", std("!_ == 1"), "G7"],
	["G7 1 & !_", std("1 & !_"), "G7"],
	// 囲みの `|!_| 5`・`|inc| 5`（G7）は、片イ（R120）で種類の未知な項として通る。上の unitPasses へ移した。
	// 既定値のある関数と、ほかのアリティの分からない関数は、実体の鍵を分ける（fnKey）。前は鍵が `other` 1つで、括りの関数に
	// 欄で渡すと実体を分け合い、先に解いた方の門が言い分になった：gx の行（G5 のはず）が、後ろの go の行の G15 で断られた。
	// 2026-10-26 の R67 で、前の gx（`gx : a ~y ? a`。裸の `~y` の仮引数）は定義の所で G22 になったので、既定値の無いアリティの分からない関数を、仮引数の
	// ブロックの行に名前が2つある gq（`gq :` ⏎ `⇥⇥a b` ⏎ `⇥? a`）にした。gx の行は下の「R64〜R72」の節の G22 の行。
	// 2026-10-28 の R105 で、本体の `f _ 3` は gq でも go でも `_` が消えて通る（gq は既定値の無い口、go は既定値の無い ys）ので、2つの関数で答えの割れる本体に替えた：
	// `f 1 2 _ 5` は、go（仮引数2つ）では仮引数の外の内側の `_` で G15、gq（既定値の無いアリティの分からない関数）では消えて通る。鍵を分け合えば、先に解いた gq の
	// 実体（通る）を go の行が使って黙って通る。前の見本の名前は「gq の行は G5」。
	// 片イ（R126）で G15 は廃止し、この2行は上の unitPasses で、実体が2つあることで鍵を分けたことを見る。
];
for (const [name, src, want, kind, extra] of unitPasses) checkPass(`印と穴 ${name}`, src, want, kind, extra);
for (const [name, src, want] of unitRefused) checkRefused(`印と穴 ${name}`, src, want);

// ---------------------------------------------------------------------------
// 穴と実引数の数が合わないとき（§5 Q31 の答え、2026-10-21 22:51・22:55、R34）
// ---------------------------------------------------------------------------
//
// k > n：余った実引数が前から穴に入る（主の Claude の問いの (B)「`go !_` は穴で `a ? go a`、後ろの xs がその穴を埋めて `go xs`。
// `f !_ 3 4`（f は2引数）は `(a ? f a 3) 4` で `f 4 3`。括った `[f !_ 3] 4` と同じ答え」に、利用者 2026-10-21 22:51「合ってる。Bだね」）。
// 穴より残りが多ければ、埋めた適用の余り（素の関数の余り）。穴が残れば、残った穴を待つ関数。木は埋めた所を値に替えた形。
// k < n：書いていない後ろの口を、最後の括りの仮引数で受けて撒く関数（利用者 2026-10-21 22:55「`a [~c] ? f3 a 2 c~` / という、
// 足りない分は全部後ろへっていう変換がかかる。」）。最後の括りが残りの並び全体を受ける（R24）。
// 前は k ≠ n の全部を G13 で断っていた。G13 に残るのは、撒く項がある並びと、前から n 個の外に `!_` がある並びと、k < n で作った
// 関数の最後の括りに、数と分からない実引数がちょうど1つで入る適用（R24 では括りがその List を受けて撒き、位置どおりに数えれば
// 口を1つ埋める。直す人の読み、断る側）。書いた `_` の混ざった k ≠ n は今のまま G7。同じ射の綴りどうしの比べは
// coproduct_laws.test.js の法則6。
const holeCountPasses = [
	// k > n
	["inc !_ 5（前は G13）", std("inc !_ 5"), "(apply inc 5)", "A"],
	["add !_ 1 2（`add 2 1`、前は G13）", std("add !_ 1 2"), "(apply add (construct 2 1))", "A"],
	["f2 !_ 3 4（`f2 4 3`）", std("f2 !_ 3 4"), "(apply f2 (construct 4 3))", "A"],
	["[f2 !_ 3] 4（括っても同じ答え）", std("[f2 !_ 3] 4"), "(apply [f2 !_ 3] 4)", "A"],
	["f3 !_ 2 3 4 5（埋めた後の余りは f3 の余りで、後ろに積む、R35）", std("f3 !_ 2 3 4 5"), "(construct (apply f3 (construct 4 2 3)) 5)", "A", { leftover: true }],
	// 行の根に残った穴の関数は `_`（R42。木は `(unit …)` で包む。下の L の行も同じ）。
	["f3 !_ !_ 5 6（穴が残る。R42）", std("f3 !_ !_ 5 6"), "(unit (? [$p0] (apply f3 (construct 6 $p0 5))))", "A"],
	["f4 !_ 2 !_ 3 9（前の穴から埋める。R42）", std("f4 !_ 2 !_ 3 9"), "(unit (? [$p0] (apply f4 (construct 9 2 $p0 3))))", "A"],
	["f3 !_ !_ 5 6 7（穴を全部埋める）", std("f3 !_ !_ 5 6 7"), "(apply f3 (construct 6 7 5))", "A", { leftover: false }],
	["use !_ 5 3（埋めた適用は本体の根が未知）", std("use !_ 5 3"), "(apply use (construct 3 5))", "未知"],
	["go !_ 3 4（既定値のある go、n = 2。前は G13）", std([...GO_DEFAULT, "go !_ 3 4"]), "(apply go (construct 4 3))", "未知"],
	["本体 t : y ? inc !_ y", std("t : y ? inc !_ y"), "(apply inc y)", "A", { body: true }],
	// 値の括りの後ろの inc は積まれて余る（R47・R42・R48）。前は逆適用で `(apply inc [add !_ 1 2] ·rev)`。
	["(add !_ 1 2) inc（値の括り。R47）", std("(add !_ 1 2) inc"), "(construct [add !_ 1 2] (unit inc))", "A"],
	// k < n
	["f3 !_ 2（`a [~c] ? f3 a 2 c~`。R42）", std("f3 !_ 2"), "(unit (? [$p0 [~$p1]] (apply f3 (construct $p0 2 $p1~))))", "A"],
	["add !_（η で add。前は G13。R42）", std("add !_"), "(unit (? [$p0 [~$p1]] (apply add (construct $p0 $p1~))))", "A"],
	["f4 !_ !_（穴2つと残りの括り。R42）", std("f4 !_ !_"), "(unit (? [$p0 $p1 [~$p2]] (apply f4 (construct $p0 $p1 $p2~))))", "A"],
	["f4 2 !_（穴が後ろでも、残りの口は最後の括り。R42）", std("f4 2 !_"), "(unit (? [$p0 [~$p1]] (apply f4 (construct 2 $p0 $p1~))))", "A"],
	["(f3 !_ 2) 1 3（`f3 1 2 3`）", std("(f3 !_ 2) 1 3"), "(apply [f3 !_ 2] (construct 1 3))", "A", { leftover: false }],
	// 最後の括りは1つも受けていないので閉じず、L のまま（R41）。行の根なので `_`（R42）。
	["(f3 !_ 2) 1（足りない適用。R41・R42）", std("(f3 !_ 2) 1"), "(unit (apply [f3 !_ 2] 1))", "A"],
	["((f3 !_ 2) 1) 3", std("((f3 !_ 2) 1) 3"), "(apply [[f3 !_ 2] 1] 3)", "A"],
	// 最後の括りの仮引数 `[~c]` が残りの並び全体を受ける（R24。可変長の口、R41）ので、この関数の所では木を切らない（f3 の余りとして、
	// 関数の本体の中で f3 の後ろに積まれる。restCloseKind）。2026-10-23 から節の印 leftover は無く、根は1つの適用（leftover の形でない）。
	["(f3 !_ 2) 1 3 4（f3 の余り。最後の括りが受けるので、木は切らない。R41）", std("(f3 !_ 2) 1 3 4"), "(apply [f3 !_ 2] (construct 1 3 4))", "A", { leftover: false }],
	["(add !_) 1 2（add 1 2）", std("(add !_) 1 2"), "(apply [add !_] (construct 1 2))", "A"],
	// 最後の括り `[~c]` が受けている間に来た inc は合成の後ろ（R41）。木は入れ子の適用（R47 で `·rev` の綴りが無くなった。前は
	// `(apply inc (apply [f3 !_ 2] (construct 1 3)) ·rev)` で、名前は「逆適用の左」）。
	["(f3 !_ 2) 1 3 inc（最後の括りが受けている間の合成）", std("(f3 !_ 2) 1 3 inc"), "(apply inc (apply [f3 !_ 2] (construct 1 3)))", "A"],
	// `(f3 !_ 2) vs~`（前は「撒く項は数えない」で未知の根）は、2026-10-24 の R51 で、固定の口の後ろに可変長の口 `[~c]` があって流れを
	// 受ける口の数が決まらない G19。下の holeCountRefused へ移した。
	// 最後の括りに入る物が数1つ（`[x]≅x`、R24）か2つ以上なら、括りが受けて撒いても、位置どおりに数えても同じ答え。最後の括りに
	// 入り始めた後（`(f3 !_) 1 5` の後）は、位置どおりに f3 の口へ並ぶ。
	["(f3 !_ 2) 1 [3]（数を括った物は数）", std("(f3 !_ 2) 1 [3]"), "(apply [f3 !_ 2] (construct 1 [3]))", "A"],
	["(f3 !_) 1 vs 3（最後の括りに2つ）", std("(f3 !_) 1 vs 3"), "(apply [f3 !_] (construct 1 vs 3))", "A"],
	["((f3 !_) 1 5) vs（最後の括りに入り始めた後）", std("((f3 !_) 1 5) vs"), "(apply [[f3 !_] 1 5] vs)", "A"],
	["鍵 h [f : [f4 !_ 2]]（f 1 2 vs は最後の括りに2つ）", std(["h : [f] ? f 1 2 vs", "h [f : [f4 !_ 2]]"]), "(apply h [f : [f4 !_ 2]])", "A"],
	["go !_（既定値のある go、n = 2。前は G13。R42）", std([...GO_DEFAULT, "go !_"]), "(unit (? [$p0 [~$p1]] (apply go (construct $p0 $p1~))))", "A"],
	["(go !_) 1（既定値のある関数の適用は未知）", std([...GO_DEFAULT, "(go !_) 1"]), "(apply [go !_] 1)", "未知"],
	// 実体の鍵は、同じアリティの穴の関数と分けても、k = n の穴の関数なら答えは同じ。2026-10-26 の R28 の書き直しで、前の本体 `f 1 _`（k = n の穴の関数なら終わりで A、
	// R34 の k < n の関数なら G5）は、末尾の `_` が消えて `f 1` になり、どちらの関数でも足りない適用で G16 になる（分ける目的の見本にならない。いちばん後ろの「R28」の
	// 節に置いた）。だから本体を撒いた流れ `f vs~` に替えた：口が2つの穴の関数は畳み込みで A、R34 の k < n の関数は固定の口の後ろに可変長の口で G19（R51）。
	["鍵 h [f : [f3 !_ !_ 3]]（k = n の穴の関数に撒いた流れ。前の本体は `f 1 _`）", std(["h : [f] ? f vs~", "h [f : [f3 !_ !_ 3]]"]), "(apply h [f : [f3 !_ !_ 3]])", "A"],
	// 既定値の無い素の関数の内側の `_` は、k ≠ n でも `!_` と同じ（R38）なので、`_` と `!_` を混ぜてよい。前は G7（下の holeCountRefused にあった）。
	// 2026-10-28 の R105：書いた `_` は穴にならず消えるので、`add !_ _ 3` は `add !_ 3`（k = n の穴の関数 `a ? add a 3`）。前（R38）は `_` も穴で k > n、3 が前の穴に
	// 入って `(unit (? [$p0] (apply add (construct 3 $p0))))`。
	["add !_ _ 3（R105 で `add !_ 3`。R42。前は R38 で `_` と `!_` を混ぜた k > n、その前は G7）", std("add !_ _ 3"), "(unit (? [$p0] (apply add (construct $p0 3))))", "A"],
	// R34 の k < n の G13（最後の括りに1つで入る数でない値）は 2026-10-23 に無くなった：1つで入った物は [x] ≅ x で中身の並び（規則の文面、
	// `(f3 !_) 1 [1 2]` は `f3 1 1 2`）。数えられる器なら元の関数の口を埋め、数えられない物（中身の見えない A・番地）なら未知（R41、restCloseKind）。
	["(f3 !_) 1 vs（vs を撒いて `f3 1 1 2 3`、R41。前は G13）", std("(f3 !_) 1 vs"), "(apply [f3 !_] (construct 1 vs))", "A"],
	["(f3 !_) 1 [1 2]（`f3 1 1 2`、規則の文面。前は G13）", std("(f3 !_) 1 [1 2]"), "(apply [f3 !_] (construct 1 [1 2]))", "A"],
	["(f3 !_ 2) 1 vs（f3 の余り、R41。前は G13）", std("(f3 !_ 2) 1 vs"), "(apply [f3 !_ 2] (construct 1 vs))", "A"],
	["(add !_) 1 vs（R41。前は G13）", std("(add !_) 1 vs"), "(apply [add !_] (construct 1 vs))", "A"],
	["((f3 !_ 2) 1) vs（部分適用の後でも、R41。前は G13）", std("((f3 !_ 2) 1) vs"), "(apply [[f3 !_ 2] 1] vs)", "A"],
	["本体 k : y ? (f3 !_ 2) 1 y（中身の見えない A は数えられないので未知、R41。前は G13）", std("k : y ? (f3 !_ 2) 1 y"), "(apply [f3 !_ 2] (construct 1 y))", "未知", { body: true }],
	["(f3 !_ 2) 1 $inc（番地は数えられないので未知、R41。前は G13）", std("(f3 !_ 2) 1 $inc"), "(apply [f3 !_ 2] (construct 1 $inc))", "未知"],
	["p : (f3 !_ 2) 1 の後の inc p 5（流れてきた値は中身が見えないので未知、R41。前は G13）", std(["p : (f3 !_ 2) 1", "inc p 5"]), "(apply (compose inc p) 5)", "未知"],
	// 実体の鍵は、最後の括りの前に残る裸の口の数（fnKey の restAt）でも分ける。分けないと、先に解いた `[f4 !_ 2]` の実体（A：最後の括りに
	// 2 と y の2つ）を、`[f4 !_ !_ 2]` の行（最後の括りに中身の見えない y が1つで入るので未知）が黙って使う。2026-10-23 に G13 の行から
	// この形へ替えた（G13 が無くなったので、未知と A の違いで見る）。
	// 2026-10-26 の R81 の確かめの直しで、穴の関数に後から当てた印は頭の実体で読む（`[f4 !_ 2]` に 1 2 `$inc` を当てると `f4 1 2 2 $inc` で、`e + …` の関数の番地の G7。
	// いちばん後ろの「R80〜R82 の確かめの直し」の節）。だから y に渡す物を、中身の見えない値の `(inc 5)` に替えた（前は `$inc` も最後の括りでは中身の見えない値で、
	// `w` の行は A、後の行は未知だった。鍵の分け方を見る目的は同じ）。
	["鍵 w : h [f : [f4 !_ 2]] (inc 5) の後の h [f : [f4 !_ !_ 2]] (inc 5)（R41）", std(["h : [f] y ? f 1 2 y", "w : h [f : [f4 !_ 2]] (inc 5)", "h [f : [f4 !_ !_ 2]] (inc 5)"]), "(apply h (construct [f : [f4 !_ !_ 2]] [inc 5]))", "未知"],
	// 片イ（R120、2026-11-03）：種類の未知な、埋めた適用の後ろの項は積む予想で通る（G2(a) は廃止）。
	["use !_ 5 3 4（埋めた後の余りで、本体の根が未知。G2(a)）（前は G2(a)）", std("use !_ 5 3 4"), "(construct (apply use (construct 3 5)) 4)", "未知"],
	["[use !_] 5 5 3（同じ。G2(a)）（前は G2(a)）", std("[use !_] 5 5 3"), "(apply [use !_] (construct 5 5 3))", "未知"],
	// 片イ（R125）：本体の返す所の裸の関数は `(unit …)` と information の bare-function-return（G16 は廃止）。
	["本体の根が穴の関数 q : x ? add !_（前は G16）", std("q : x ? add !_"), "(unit (? [$p0 [~$p1]] (apply add (construct $p0 $p1~))))", "A", { body: true, severities: ["information/bare-function-return"] }],
	["G16 q : x ? (f4 !_) 7 xs（撒いて足りない適用、R41。G13 → G16）（前は G16）", std(["xs : 1 , 2", "q : x ? (f4 !_) 7 xs"]), "(unit (apply [f4 !_] (construct 7 xs)))", "A", { body: true, severities: ["information/bare-function-return"] }],
];
const holeCountRefused = [
	// 種類の未知な、埋めた適用の後ろに項が来る（R40 の読み6。G12(b) → G2(a)、G12 は廃止）。
	// 2026-10-26 の R81 の確かめの直しで、穴の関数に後から当てた `$inc` は頭の実体で読み、`[use !_] $inc 5 3` は `use $inc 5 3` と同じく余りを積んで通る（いちばん
	// 後ろの「R80〜R82 の確かめの直し」の節）。本体の根が未知のまま余る形は、印の無い実引数で見る。
	// 片イ（R120・R125）で `use !_ 5 3 4`・`[use !_] 5 5 3`（G2(a)）と `q : x ? add !_`（G16）は通る。上の holeCountPasses へ移した。
	// R34 の k < n で作った関数に書いた末尾の `_`（`(f3 !_ 2) 1 _`・`(f3 !_ 2) _`・`((f3 !_ 2) 1) _`）は、括りが受ける並びの中の消える印か、最後の括りに入る値
	// （終わり）かで割れる G5 だった。2026-10-26 の R28 の書き直しで、どちらも「消える」になり、通る側（いちばん後ろの「R28」の節）へ移した。内側の `_`
	// （後ろに値が続く）は今のまま G5。→ 2026-10-28 の R105 で、内側の `_` も穴の口（値の口）でも最後の括り（括りの口）でも消えるので、`(f3 !_ 2) _ 1` は
	// `(f3 !_ 2) 1` と同じく通る側（いちばん後ろの「R105〜R110」の節）へ移した。
	// R51（2026-10-24）：撒いた流れを受ける口が、固定の口1つの後ろに可変長の口 `[~c]`（流れを口 a に入れるか、`[~c]` が丸ごと受けるか
	// 決まらない）。前は撒く項で k を数えないので未知の根で通っていた。
	["(f3 !_ 2) vs~（R51 の G19。前は未知の根）", std("(f3 !_ 2) vs~"), "G19"],
	// 実体の鍵は、同じアリティの穴の関数と分ける（fnKey の "+rest"）。分けないと、先に解いた `[f3 !_ !_ 3]` の実体（A）を
	// `[f3 !_ 2]` の行が黙って使う。2026-10-26 の R28 の書き直しで、前の本体 `f 1 _` はどちらの関数でも G16 になったので、本体を `f vs~` に替えた（上の
	// holeCountPasses の鍵の行の注。前は後の行が G5）。
	["鍵 w : h [f : [f3 !_ !_ 3]] の後の h [f : [f3 !_ 2]]（前の本体は `f 1 _` で G5）", std(["h : [f] ? f vs~", "w : h [f : [f3 !_ !_ 3]]", "h [f : [f3 !_ 2]]"]), "G19"],
	// G13 に残る形：撒く項（k が数えられない）と、前から n 個の外の `!_`
	["G13 f3 !_ vs~（撒く項、k < n）", std("f3 !_ vs~"), "G13"],
	// `inc 5 !_`（前から 1 個の外の `!_`、G13）は、2026-10-26 の R69（§5 Q40 の答え：閉じた後ろの恒等射）で通る側（いちばん後ろの「R64〜R72」の節）へ
	// 移した。外に値がある `inc 5 !_ 6`（G13、§5 Q40 の残り）も、2026-10-27 の R89（§5 Q40 の残りの答え）で通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	["G13 add !_ 1 !_（前から 2 個の外の !_）", std("add !_ 1 !_"), "G13"],
	// R34 の k < n の G13（最後の括りに1つで入る数でない値）は 2026-10-23 に無くなり、上の holeCountPasses へ移した（R41）。
	// `(f4 !_) 7 xs` は、xs（`1 , 2`）を撒いて `f4 7 1 2` の足りない適用（L）なので、本体の根が裸の関数で G16（R33。前は G13）。片イ（R125）で上の holeCountPasses へ移した。
	// 実体の鍵の行（`[f4 !_ 2]` と `[f4 !_ !_ 2]`）は、G13 が無くなったので上の holeCountPasses へ移した。
	// 今のまま：k = n の撒く項・括りの関数の頭・n の数えられない頭は G7 か G5。
	// 内側の `_` の混ざった `add !_ _ 3` は、R38 で通る側（上の holeCountPasses）へ移した。
	// 最後の項が `_` の k ≠ n（`f3 !_ _`、G7。最後の `_` は終わり、R28）は、2026-10-26 の R28 の書き直し（末尾の `_` は消えてから穴の規則を見る）で `f3 !_` の R34 と
	// 同じく通る側（いちばん後ろの「R28」の節）へ移した。
	["G7 add !_ vs~（k = n の撒く項）", std("add !_ vs~"), "G7"],
	["G5 io1 !_ 5（括りの関数の頭）", std([IO1, "io1 !_ 5"]), "G5"],
	["G7 gz !_（n の数えられない既定値のある関数）", std(["gz :", "\t\ta b", "\t\tc : 3", "\t? a", "", "gz !_"]), "G7"],
];
for (const [name, src, want, kind, extra] of holeCountPasses) checkPass(`穴と実引数の数 ${name}`, src, want, kind, extra);
for (const [name, src, want] of holeCountRefused) checkRefused(`穴と実引数の数 ${name}`, src, want);

// ---------------------------------------------------------------------------
// 前置・後置の点なしは `_` の綴り（2026-10-21 08:20、R30 と G14 を廃止）
// ---------------------------------------------------------------------------
//
// 前置・後置の点なしは、括りの中が1行で、その行が項1つで、項が値の前置の印1つ（`-`・`!`・`!!`）か後置の `!` 1つと、書いた `_`
// だけの物（`[-_]`・`[!_]`・`[!!_]`・`[_!]`）。種類は単項の点なし（L）。同じ日に、`_` を被演算子の印に使う綴りを G14 で断り、
// 未定義の名前を被演算子に書く R30（`[-a]`）にしたが、主の Claude の3つの道の2つ目（前の `_` の綴りに戻して R30 を外す）への
// U〔答え〕2026-10-21 08:20「これがよさそうだね。 / その方が統一的に扱えると思う。」で戻した。括った `[!_]` は恒等射ではなく
// 否定の点なし（U 08:24「[!_] は否定の点無しにしないの？ 恒等射なら括らなくていい。」、残す理由は U 08:26）。恒等射は括らない
// `!_`（上の「印と穴」）。`[-a]` は R30 の前と同じく、値の印を当てた項の括り（a が未定義なら A で、information は R21 の文面）。
// 2026-10-28 の片9b（R111）から、R21 の文面は「定義が無い名前は `_` で、使う所で読みます」（前は「値として読み」）。見るのは R30 の文面でなく R21 の文面であること。
const VALUE_TEXT = "定義が無い名前は";
const unaryPasses = [
	// 通る：前置・後置の点なしの単項（前は G14）
	["[-_] 5", std("[-_] 5"), "(apply [-_] 5)", "A", { diagCount: 0 }],
	["[_!] 5", std("[_!] 5"), "(apply [_!] 5)", "A"],
	["[!!_] 5", std("[!!_] 5"), "(apply [!!_] 5)", "A"],
	["[!_] (2 < 3)（否定の点なし）", std("[!_] (2 < 3)"), "(apply [!_] [2 < 3])", "A"],
	["[!_] 2 < 3（`2 < 3` は項の中）", std("[!_] 2 < 3"), "(apply [!_] (< 2 3))", "A"],
	["[-_]（1項は関数。行の根なので `_`、R42）", std("[-_]"), "(unit [-_])", "A"],
	["[!_]（1項は関数。行の根なので `_`、R42）", std("[!_]"), "(unit [!_])", "A"],
	["[!_] 5", std("[!_] 5"), "(apply [!_] 5)", "A"],
	// 否定の点なしは単項なので、2項以上は余り（恒等射 `i : !_` の `i 1 2 3` は並び全体を受けて excess にしない、上の「印と穴」）
	["[!_] 1 2 3（余りは後ろに積む、R35）", std("[!_] 1 2 3"), "(construct (apply [!_] 1) 2 3)", "A", { leftover: true }],
	["(!_) 5（丸い括りも同じ括り）", std("(!_) 5"), "(apply [!_] 5)", "A"],
	["inc [-_] 5（合成の後ろ）", std("inc [-_] 5"), "(apply (compose inc [-_]) 5)", "A"],
	["inc [!_] 5（合成の後ろ）", std("inc [!_] 5"), "(apply (compose inc [!_]) 5)", "A"],
	["[-_] inc 5（合成の頭）", std("[-_] inc 5"), "(apply (compose [-_] inc) 5)", "A"],
	["[-_] [!_] 5（点なしどうしの合成）", std("[-_] [!_] 5"), "(apply (compose [-_] [!_]) 5)", "A"],
	["[* 2,] [-_] 1 2 3", std("[* 2,] [-_] 1 2 3"), "(apply (compose [* 2,] [-_]) (construct 1 2 3))", "A"],
	["[-_] 5 6（余りは後ろに積む、R35）", std("[-_] 5 6"), "(construct (apply [-_] 5) 6)", "A", { leftover: true }],
	// `[-_] 5` は口が埋まって値になり、後ろの inc は積まれて余る（R47・R42・R48）。前は逆適用で `(apply inc (apply [-_] 5) ·rev)`。
	["[-_] 5 inc（R47。前は逆適用の左）", std("[-_] 5 inc"), "(construct (apply [-_] 5) (unit inc))", "A"],
	// `5 inc [-_]`（§5 Q23 の答えで通っていた）は、2026-10-23 は `[-_]` が `5 inc` の値を逆適用で取った（R40）。R47 では inc と `[-_]` が
	// 5 の後ろに積まれた合成で余る。下の「左からの畳み込み」の pfReversePasses にある。
	["[-_] _（R28 で `[-_]`、根なので `_`。前は終わり（n = 1）の `(apply [-_] _)`）", std("[-_] _"), "(unit [-_])", "A", { leftoverDiag: ["[-_]"] }],
	["本体 t : y ? [-_] y", std("t : y ? [-_] y"), "(apply [-_] y)", "A", { body: true }],
	["括りの関数の実体の本体 t : [y] ? [-_] y", std(["t : [y] ? [-_] y", "t 1"]), "(: t (? [[y]] (inst N (apply [-_] y))))", null, { at: -2 }],
	["p : [-_] の後で p 5", std(["p : [-_]", "p 5"]), "(apply p 5)", "A"],
	// 名前を書かないので、取り込みのある範囲でも同じ（R30 では名前が未定義か分からず、使えなかった）
	["io@ の後で [-_] 5", std(["io@", "[-_] 5"]), "(apply [-_] 5)", "A"],
	// R30 を廃止した：`[-a]` は値の印を当てた項の括り（R30 の前と同じ）。information は未定義の名前の文面（片9b の R111 から「定義が無い名前は `_`」。a は `_` と分かる値）
	["[-a] 5（値の括りと 5 の構築）", std("[-a] 5"), "(construct [-a] 5)", "A", { diag: "a", diagText: VALUE_TEXT, diagCount: 1 }],
	["(-a) 5（丸い括りも同じ）", std("(-a) 5"), "(construct [-a] 5)", "A", { diag: "a", diagText: VALUE_TEXT, diagCount: 1 }],
	["[-a]（値）", std("[-a]"), "[-a]", "A", { diag: "a", diagText: VALUE_TEXT, diagCount: 1 }],
	["[a!] 5", std("[a!] 5"), "(construct [a!] 5)", "A", { diag: "a", diagText: VALUE_TEXT, diagCount: 1 }],
	["[!a] (2 < 3)", std("[!a] (2 < 3)"), "(construct [!a] [2 < 3])", "A", { diag: "a", diagText: VALUE_TEXT, diagCount: 1 }],
	// 今のまま：定義した値に印・中置の区間。値 `$_` の括り `[$_] 5` は、2026-10-24 の R53 で中の `$_` が G20 になり、2026-10-25 の R56 で
	// `$_` が零射の番地（値）になって、前の `(construct [$_] 5)` の A に戻った（§5 Q33 の答えの「`[$_]` は値 `$_` の括り」）。
	["R56 [$_] 5（R53 では G20、その前は A）", std("[$_] 5"), "(construct [$_] 5)", "A", { diagCount: 0 }],
	["今のまま v : 3 の後で [-v] 5（値に印）", std(["v : 3", "[-v] 5"]), "(construct [-v] 5)", "A", { diagCount: 0 }],
	["今のまま [- a] 5（中置の区間。a は未定義の名前で、R111 から `_` と分かる値）", std("[- a] 5"), "(apply [- a] 5)", "A", { diag: "a", diagText: VALUE_TEXT, diagCount: 1 }],
	// 片イ（R120、2026-11-03）：印の項の括り（Q33）と作らない写像の括りは、種類の未知な項として通る（後ろの項は積む予想）。前は2項以上の並びで G7。
	["Q33 の答え [@_] 5（前置 `@` の項の括り、Q9）（前は G7）", std("[@_] 5"), "(construct [@_] 5)", "未知"],
	["Q33 の答え [_@] 5（後置 `@` の項の括り、Q10）（前は G7）", std("[_@] 5"), "(construct [_@] 5)", "未知"],
	["R56 [$_,] 1 2 3（作らない。R53 では中の `$_` が G20、その前は G7）（前は G7）", std("[$_,] 1 2 3"), "(construct [$_,] 1 2 3)", "未知"],
	["Q33 の答え [@_,] 1 2 3（作らない）（前は G7）", std("[@_,] 1 2 3"), "(construct [@_,] 1 2 3)", "未知"],
	// 片イ（R120）：取り込みのある範囲の名前に値の印を当てた `-a` は、名前ではないので R120 の例外（名前の読みが決まらない項）に入らない。a の読みに依らず
	// 値か `_`（関数に演算子を充てた所、R123 の線）なので、積む予想で通る（§5 Q85 (i)）。前は種類の未知な項の G7。
	["io@ の後で [-a] 5（取り込みのある範囲の名前に印。積む予想）（前は G7）", std(["io@", "[-a] 5"]), "(construct [-a] 5)", "未知", { diagCount: 0 }],
];
const unaryRefused = [
	// 前は点なしなので、逆適用の右で主語を直に受ける所では G10 だった（`5 [-_]`・`5 [!_]`・`5 [-_] inc`）。2026-10-23 に R13 を廃止して
	// 通る（R40）。下の「左からの畳み込み」の pfReversePasses へ移した。
	// 否定の点なしは単項なので、`[!_] 1` の後ろに 2 が積まれる。inc は 2026-10-23 はいちばん上の 2 を取った（R40。前は G12(a)）が、R47 では
	// 積まれて余る。下の「左からの畳み込み」へ移した。
	// 今のまま：関数に印（Q22）・取り込みのある範囲の名前に印（Q10）
	// `[-inc] 5`（関数に印、G7）は、2026-10-27 の R87 で `-inc` が `-_` の値になり、通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	// `io@` の後の `[-a] 5`（取り込みのある範囲の名前に印、G7）は、片イ（R120）で上の unaryPasses へ移した。
	// §5 Q33 の答え（U〔答え〕2026-10-21 09:21「良いと思う。」）：`$`・`@`・`#`・`~` の印には点なしを作らない。`[@_]`・`[#_]`・`[_@]`・
	// `[_~]`・`[~_]` は点なしではなく、ふつうの括りの項で、その印の項の読み（前置 `@` は Q9、前置 `~` は Q14、後置 `@`・前置 `#` は
	// Q10）に従う。今の解決器ではどれも未知（G7）。`[$_]` は値 `$_` の括りで A、`[$_,]` は作らない（未知）。2026-10-24 の R53 で `$_` そのものが
	// G20 になり（`[$_]`・`[$_,]` も G20）、2026-10-25 の R56（`$_` は零射の番地）で前の答えに戻った（`[$_] 5` は上の unaryPasses）。
	// `[~_] 5`（前置 `~` の項の括り、Q14。G7）は、2026-10-27 の R88 で `~_` が書いた `[_]` と同じ項になり、通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	// 片イ（R120）から `[@_] 5`・`[_@] 5` は種類の未知な項として通る（上の unaryPasses）。`[#_] 5` は読む段の export-mark-position（R119）。
	["Q33 の答え [#_] 5（前置 `#` の項の括り、Q10）（前は G7、R119）", std("[#_] 5"), "export-mark-position"],
	// `[_~] 5`（撒く `_~` の項の括り。G7）は、2026-10-27 の R84（`_~ = _`）で通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	// 片イ（R120）から `[$_,] 1 2 3`・`[@_,] 1 2 3` も通る（上の unaryPasses）。
	// 前置・後置の点なしの写像は `[* 2,]` と同じ（下の mapPasses）。末尾の `_`（`[-_,] 1 _`）は `[* 2,] 1 _` と同じくアリティの数えられない頭の終わりで
	// G5 だったが、2026-10-26 の R28 の書き直し（末尾の `_` はどの頭でも消える）で通る側（いちばん後ろの「R28」の節）へ移した。逆適用の右の `5 [-_,]`
	// （前は G10）は、R13 を廃止して通る（下の「左からの畳み込み」の pfReversePasses）。
];
// 前置・後置の点なしの写像（U〔答え〕2026-10-21 10:09「前置・後置の点なしにも , を付けて、[* 2,] と同じ要素ごとの写像と読む。」）。
// 前は §5 Q33 で未知（G7）だった。種類は貪欲な単項（`[* 2,]` の行）：k ≥ 1 で A、`excess` にしない。
const mapPasses = [
	["[-_,] 1 2 3（前は G7）", std("[-_,] 1 2 3"), "(apply [-_,] (construct 1 2 3))", "A", { leftover: false }],
	["[!_,] 1 2 3", std("[!_,] 1 2 3"), "(apply [!_,] (construct 1 2 3))", "A"],
	["[!!_,] 1 2 3", std("[!!_,] 1 2 3"), "(apply [!!_,] (construct 1 2 3))", "A"],
	["[_!,] 1 2 3", std("[_!,] 1 2 3"), "(apply [_!,] (construct 1 2 3))", "A"],
	["[-_,]（1項は関数。行の根なので `_`、R42）", std("[-_,]"), "(unit [-_,])", "A"],
	["[-_,] 5", std("[-_,] 5"), "(apply [-_,] 5)", "A"],
	["[-_,] [1 2 3]", std("[-_,] [1 2 3]"), "(apply [-_,] [1 2 3])", "A"],
	// excess にしない。並びを受けている間に来た inc は合成の後ろ（R41、`[* 2,] 1 2 3 inc` と同じ）。木は入れ子の適用（R47 で `·rev` の
	// 綴りが無くなった。前は `(apply inc (apply [-_,] (construct 1 2)) ·rev)` で、名前は「逆適用の左」）。
	["[-_,] 1 2 inc（受けている間の合成）", std("[-_,] 1 2 inc"), "(apply inc (apply [-_,] (construct 1 2)))", "A"],
	["inc [-_,] 5（合成の後ろ）", std("inc [-_,] 5"), "(apply (compose inc [-_,]) 5)", "A"],
	["[!_,] [* 2,] 1 2 3（合成の頭）", std("[!_,] [* 2,] 1 2 3"), "(apply (compose [!_,] [* 2,]) (construct 1 2 3))", "A"],
	// R51（2026-10-24）：貪欲な単項は流れを丸ごと受け、写した結果は List（流れはいくつでも1項）。前は撒く項で k を数えないので未知の根。
	["[-_,] vs~（R51。前は未知の根）", std("[-_,] vs~"), "(apply [-_,] vs~)", "A"],
];
for (const [name, s, want, kind, extra] of unaryPasses) checkPass(`点なし ${name}`, s, want, kind, extra);
for (const [name, s, want] of unaryRefused) checkRefused(`点なし ${name}`, s, want);
for (const [name, s, want, kind, extra] of mapPasses) checkPass(`点なし 写像 ${name}`, s, want, kind, extra);

// ---------------------------------------------------------------------------
// 畳む2項の点なし（R31、2026-10-21）
// ---------------------------------------------------------------------------
//
// 括りの中が1行で、項1つが両側の被演算子の欠けた中置で、記号が算術（`+`・`-`・`*`・`/`・`%`・`^`）・ビット（`||`・`;;`・`&&`）・
// 論理（`|`・`&`・`;`）・比較（`<`・`<=`・`=`・`>=`・`>`・`==`）なら、`[op] x1 … xn` は `x1 op … op xn` を演算子表の結合の向き
// どおりに並べた物と同じ（U〔答え〕2026-10-21 09:15「[^] は中置と同じく右から畳む。[op] x1 … xn は演算子表の結合の向きどおりに
// 並べた物と同じ。」）。U 08:47「2項演算は左から畳んでいい、この時、畳んじゃいけないものは、モノイドの域になってない。」、
// U 08:50「[&] a b c / で c が返る。」、U 08:55「比較点無しは一番右を返すか _」。種類は、実引数が2項以上なら A（中置の値の演算子の
// 被演算子が全部 A のときと同じ）。1項なら、数（`[+] 5` は 5 で §5 Q17 は閉じた）か、要素が全部 A と見える List（要素を畳む）の
// ときだけ A で、要素に関数か未知が見える器・中身の見えない A・構造体は未知（2026-10-21 の確かめで見つかった黙った誤答を直した。
// R31 の最初の版は1項ならいつも A で、`z : [&] gs`（gs は `1 , inc`）の `z 5` を構築と読んでいた）。撒く項があれば未知。書いた `_` は
// 中置の被演算子と同じく印で A（R15）、末尾の `_` も「終わり」（R28）にしない（`[+] 1 _` は `1 + _`）。値は値の段（演算子表の Unit の
// 欄）が読むので、ここでは木と種類だけを見る。値の列（`[^] 2 3 2` は 512 など）は確かめない。
// 畳まない2項の点なし（`<<`・`>>`・get・set・範囲・`!=`・`!==`・中置の `#`）は、下の「畳まない2項の点なし」（R32）。
const foldPfPasses = [
	["[+] 5（1項はその項そのもの、前は未知）", std("[+] 5"), "(apply [+] 5)", "A", { leftover: false }],
	["[+] 1 2 3", std("[+] 1 2 3"), "(apply [+] (construct 1 2 3))", "A", { leftover: false }],
	["[-] 5 3 1", std("[-] 5 3 1"), "(apply [-] (construct 5 3 1))", "A"],
	["[-] 10 3 2（§6.3 の行）", std("[-] 10 3 2"), "(apply [-] (construct 10 3 2))", "A"],
	["[*] 2 3（前は未知）", std("[*] 2 3"), "(apply [*] (construct 2 3))", "A"],
	["[/] 12 3 2", std("[/] 12 3 2"), "(apply [/] (construct 12 3 2))", "A"],
	["[%] 7 3", std("[%] 7 3"), "(apply [%] (construct 7 3))", "A"],
	["[^] 2 3 2（右から畳む）", std("[^] 2 3 2"), "(apply [^] (construct 2 3 2))", "A"],
	["[||] 1 2 4", std("[||] 1 2 4"), "(apply [||] (construct 1 2 4))", "A"],
	["[;;] 1 3", std("[;;] 1 3"), "(apply [;;] (construct 1 3))", "A"],
	["[&&] 3 1", std("[&&] 3 1"), "(apply [&&] (construct 3 1))", "A"],
	["[|] 0 5（前は未知）", std("[|] 0 5"), "(apply [|] (construct 0 5))", "A"],
	["[&] 1 2 3（c が返る）", std("[&] 1 2 3"), "(apply [&] (construct 1 2 3))", "A"],
	["[;] 1 0（前は G7、Q19）", std("[;] 1 0"), "(apply [;] (construct 1 0))", "A"],
	["[<] 1 2 3", std("[<] 1 2 3"), "(apply [<] (construct 1 2 3))", "A"],
	["[<] 1 3 2（外れれば値は _、種類は A）", std("[<] 1 3 2"), "(apply [<] (construct 1 3 2))", "A"],
	["[<=] 1 1 2", std("[<=] 1 1 2"), "(apply [<=] (construct 1 1 2))", "A"],
	["[=] 1 1", std("[=] 1 1"), "(apply [=] (construct 1 1))", "A"],
	["[>=] 3 3 1", std("[>=] 3 3 1"), "(apply [>=] (construct 3 3 1))", "A"],
	["[>] 3 2 1", std("[>] 3 2 1"), "(apply [>] (construct 3 2 1))", "A"],
	["[==] 1 1（前は G7、Q19）", std("[==] 1 1"), "(apply [==] (construct 1 1))", "A"],
	["[&] a b c（a b c は未定義の名前で、R111 から `_` と分かる値。可変長の口なので木は今のまま、§5 Q83。前の名前は R21 の「未定義の名前＝値」）", std("[&] a b c"), "(apply [&] (construct a b c))", "A", { diag: "a" }],
	// List 1つは要素を並びとして畳む（`[+] [1 2 3]` は 6、案内の `[+] [1 __ 3]` は 4）。前は未知。
	["[+] [1 2 3]（前は未知）", std("[+] [1 2 3]"), "(apply [+] [1 2 3])", "A"],
	["[+] [1 _ 3]（前は未知）", std("[+] [1 _ 3]"), "(apply [+] [1 _ 3])", "A"],
	["[+] vs（List の名前）", std("[+] vs"), "(apply [+] vs)", "A"],
	["[+] (vs)（括り1つでも中の行の形が見える）", std("[+] (vs)"), "(apply [+] [vs])", "A"],
	["[+] [[1 2] [3 4]]（要素の List も中身が全部 A）", std("[+] [[1 2] [3 4]]"), "(apply [+] [[1 2] [3 4]])", "A"],
	["[+] -5（値の印を当てた数）", std("[+] -5"), "(apply [+] -5)", "A"],
	["[' 0] [+] [[1 2] [3 4]]（引いた List の形を受ける、R26）", std("[' 0] [+] [[1 2] [3 4]]"), "(apply (compose [' 0] [+]) [[1 2] [3 4]])", "A"],
	["[+] [1 2 3] は information を出さない", std("[+] [1 2 3]"), "(apply [+] [1 2 3])", "A", { diagCount: 0 }],
	// 1項で、要素が全部 A とは見えない物は未知（R31 の1項。R31 の最初の版はどれも A）。根なら通る。
	// 片イ（R123、2026-11-03）から fs の要素は関数の番地（値）と 3 で、要素が全部 A と見えるので A（前は要素に関数が見えて未知の根）。
	["[|] fs（片イの R123 で fs の要素は番地。前は要素に関数が見える未知の根）", std("[|] fs"), "(apply [|] fs)", "A"],
	["[==] (inc , inc)（未知の根）", std("[==] (inc , inc)"), "(apply [==] [inc , inc])", "未知"],
	["[+] (inc 5)（括りの中が適用の結果で中身が見えない、未知の根）", std("[+] (inc 5)"), "(apply [+] [inc 5])", "未知"],
	["sv（構造体）の後で [+] sv（欄を畳む読みは無い、未知の根）", std(["sv :", "\tk : 1", "\tother : 2", "", "[+] sv"]), "(apply [+] sv)", "未知"],
	["本体 t : y ? [&] y（裸の仮引数は中身が見えない、未知の根）", std("t : y ? [&] y"), "(apply [&] y)", "未知", { body: true }],
	["本体 t : y ? [&] (y)（`[x]≅x` なので y と同じ）", std("t : y ? [&] (y)"), "(apply [&] [y])", "未知", { body: true }],
	// 書いた `_` は中置の被演算子と同じく印で A。木は `_` を残す（前は G5）。
	["[+] 1 _（1 + _、前は G5）", std("[+] 1 _"), "(apply [+] (construct 1 _))", "A"],
	["[+] 1 _ 3（前は G5）", std("[+] 1 _ 3"), "(apply [+] (construct 1 _ 3))", "A"],
	["[+] _（前は G5）", std("[+] _"), "(apply [+] _)", "A"],
	["[|] _ 5（前は G5）", std("[|] _ 5"), "(apply [|] (construct _ 5))", "A"],
	["[&] 1 _ 3（前は G5）", std("[&] 1 _ 3"), "(apply [&] (construct 1 _ 3))", "A"],
	// 終わりではないので、`[+] 5 6 inc` と同じく `[+]` が受けている間に来た inc は合成の後ろ（R41）。木は入れ子の適用（R47 で `·rev` の
	// 綴りが無くなった。前は `(apply inc (apply [+] (construct 1 _)) ·rev)`）。
	["[+] 1 _ inc（終わりではないので、`[+] 5 6 inc` と同じ合成）", std("[+] 1 _ inc"), "(apply inc (apply [+] (construct 1 _)))", "A"],
	// `5 [+] _` は、2026-10-23 は `[+]` が 5 を逆適用で取った（R31・R40）。R47 では `5 ([+] _)`。下の「左からの畳み込み」の pfReversePasses にある。
	["[+] inc 1 _（合成の最初が畳む頭なら、`_` はその実引数、前は G5）", std("[+] inc 1 _"), "(apply (compose [+] inc) (construct 1 _))", "A"],
	// 合成・畳み込みの中は、今までの `[+]` と同じ。
	["[+] inc 5 6（12 の木のまま）", std("[+] inc 5 6"), "(apply (compose [+] inc) (construct 5 6))", "A"],
	// 後ろの `[+]` が受けるのは前の結果（中身の見えない A）なので、今までどおり未知（R31 の1項。R31 の最初の版は A）。
	["inc [+] 5（後ろの [+] に中身の見えない A、未知の根）", std("inc [+] 5"), "(apply (compose inc [+]) 5)", "未知"],
	// `5 inc [+]`（§5 Q23 の答えで通っていた）と `1 [*] 2 3 4` は、2026-10-23 は点なしが前の値を逆適用で取った（R40）。R47 では積まれて
	// 後ろの項を受ける。下の「左からの畳み込み」の pfReversePasses にある。
	// `[*]` が受けている間に来た inc は合成の後ろ（R41）。木は入れ子の適用（前は `·rev` の綴り、R47 で無くなった）。
	["[*] 2 3 inc（前は G2(a)）", std("[*] 2 3 inc"), "(apply inc (apply [*] (construct 2 3)))", "A"],
	// `[+]` の口は並びの終わりまで受ける（R41）ので、g は開いた `[+]` の後ろに合成され、3 も `[+]` が受ける：`g ([+] 5 3)`（規則の文面の
	// `[+] 1 2 inc 3` は `inc ([+] 1 2 3)` と同じ形）。前は強さの順で `([+] 5) (g 3)`。
	["[+] 5 g 3（`g ([+] 5 3)`、R41。前は G2(a)、その後 `([+] 5) (g 3)`）", std("[+] 5 g 3"), "(apply g (apply [+] (construct 5 3)))", "A"],
	["[<] [* 2,] 1 2 3（合成の頭）", std("[<] [* 2,] 1 2 3"), "(apply (compose [<] [* 2,]) (construct 1 2 3))", "A"],
	["本体 t : y ? [&] y 1", std("t : y ? [&] y 1"), "(apply [&] (construct y 1))", "A", { body: true }],
	["p : [+] の後で p 1 2", std(["p : [+]", "p 1 2"]), "(apply p (construct 1 2))", "A"],
	// 撒く項があれば今までどおり未知。
	["[&] [1 2 3]~（撒く項は未知の根）", std("[&] [1 2 3]~"), "(apply [&] [1 2 3]~)", "未知"],
	// `[,]` は今のまま：アリティの分からない点なしで、適用は未知（根なら通る）。
	["今のまま [,] 1 2", std("[,] 1 2"), "(apply [,] (construct 1 2))", "未知"],
	// 片イ（R120・R123、2026-11-03）：下の foldPfRefused の G7 の行は通る。`1 , inc` の inc は `,` の被演算子に丸ごと残った関数で `_`（R123、leftover-lambda）
	// なので、gs は要素1つの 1 で `[&] gs` は A（前は要素に関数が見えて1項で畳んだ物が関数かもしれない G7）。裸の仮引数を畳む t の根は未知のままで、`w 5` は
	// 種類の未知な w の後ろに 5 を積む予想（R120）。段1〜9 の片側の欠けた点なし（Q19）も種類の未知な項として通る。
	["G7 gs : 1 , inc の後で z : [&] gs ⏎ z 5（前は G7）", std(["gs : 1 , inc", "z : [&] gs", "z 5"]), "(construct z 5)", "A", { leftoverDiag: ["inc"] }],
	["G7 gs : 1 , inc の後で z : [&] gs ⏎ 5 z（前は G7）", std(["gs : 1 , inc", "z : [&] gs", "5 z"]), "(construct 5 z)", "A", { leftoverDiag: ["inc"] }],
	["G7 ([|] (inc , 1)) 5（前は G7）", std("([|] (inc , 1)) 5"), "(construct [[|] [inc , 1]] 5)", "A", { leftoverDiag: ["inc"] }],
	["G7 t : y ? [&] y の後で w : t gs ⏎ w 5（前は G7）", std(["gs : 1 , inc", "t : y ? [&] y", "w : t gs", "w 5"]), "(construct w 5)", "未知", { leftoverDiag: ["inc"] }],
	["今のまま [| 5] 1（Q19）（前は G7）", std("[| 5] 1"), "(construct [| 5] 1)", "未知"],
	["今のまま [== 3] 1（Q19）（前は G7）", std("[== 3] 1"), "(construct [== 3] 1)", "未知"],
];
const foldPfRefused = [
	// 前は点なしなので、逆適用の右で主語を直に受ける所では G10 だった（`5 [&]`・`5 [<]`・`5 [+]`・`5 [+] inc`）。2026-10-23 に R13 を
	// 廃止して通る（R40。2026-10-24 から R47 で積まれる）。下の「左からの畳み込み」の pfReversePasses へ移した。
	// 穴 `!_` は畳む頭の実引数でも穴の位置の外（G7）。
	["G7 [+] 1 !_", std("[+] 1 !_"), "G7"],
	["G7 [+] !_ 5（§6.3 の行）", std("[+] !_ 5"), "G7"],
	// 畳む2項の点なしでない頭の `_` は今までどおり G5（§6.3 の行。前の見本の `[+] 1 _ 3`・`[+] 1 _` は R31 で通る）。
	// → 2026-10-28 の R105 で、貪欲な単項の内側の `_` も並びの単位で消える。`G5 [* 2,] 1 _ 3` は `[* 2,] 1 3` と同じく通る側（いちばん後ろの「R105〜R110」の節）へ
	// 移した（畳む2項の点なしの `[+] 1 _ 3` は R31 の被演算子の印のまま）。
	// `[,] 1 _`（G5、アリティの数えられない頭の末尾の `_`）は、2026-10-26 の R28 の書き直しで `[,] 1` と同じく通る側（いちばん後ろの「R28」の節）へ移した。
	// 1項で要素に関数が見える器を畳んだ結果は未知（R31 の1項）。R31 の最初の版は、どれも A にして黙って構築や逆適用の左に
	// 読んでいた（確かめ 2026-10-21。z は inc なので `z 5` は inc を 5 に当てる形）。HEAD（R31 の前）も G7 か未知で断っていた。
	// 片イ（R120・R123）から、この3行は上の foldPfPasses へ移した。
	// `[|] fs inc` は、`[|]` の口が並びの終わりまで受ける（R41）ので、inc は合成されて閉じた値（未知）を受ける。下の「左からの畳み込み」へ移した。
	// 裸の仮引数（中身の見えない A）を1項で畳む本体の根は未知。器を受ければ要素に関数が見えるかもしれない。片イ（R120）から `w 5` も上の foldPfPasses へ移した。
	// `[:]`・`[?]` は今のまま外す（Q19）。片イ（R119）から読む段の pointfree-tree-notation。
	["今のまま [?] 1 2（Q19）（前は G7、R119）", std("[?] 1 2"), "pointfree-tree-notation"],
	// 片側の欠けた段1〜9 の点なしは R31 の外（Q19）。片イ（R120）から種類の未知な項として通る（上の foldPfPasses）。
];
for (const [name, s, want, kind, extra] of foldPfPasses) checkPass(`畳む ${name}`, s, want, kind, extra);
for (const [name, s, want] of foldPfRefused) checkRefused(`畳む ${name}`, s, want);

// ---------------------------------------------------------------------------
// 畳まない2項の点なし（R32、§5 Q34 の答え、2026-10-21）
// ---------------------------------------------------------------------------
//
// 括りの中が1行で、項1つが両側の被演算子の欠けた中置で、記号が畳まない物（段12〜22 の `<<`・`>>`・`'`・`@`・範囲の `~`・`~+`・
// `~-`・`~*`・`~/`・`~^`・`!=` と、段1〜9 の `!==`・中置の `#`）なら、素の2引数の関数と同じに読む（主の Claude の問い「素の2引数の
// 関数と同じに読む、でいい？」に、U〔答え〕2026-10-21 10:52「同じに読んでいいけど、おすすめは出来ないという方向で良いと思う。」）。
// 口は左から埋まる：k = 2 は適用、k = 1 は右の口を待つ足りない適用（L）、k > 2 は余り、末尾の `_` は消える（R28、2026-10-26 に書き直した。前は n = 2 の終わり）。足りた適用の
// 種類は、値を返す演算（`<<`・`>>`・`!=`・`!==`・範囲）は A、get・set（`'`・`@`・中置の `#`）は何を引いたか・何をしたかが決まらない
// ので未知（決定の規則、主の Claude の案）。「おすすめは出来ない」は断らずに information `pointfree-not-folded` で見せる（書いた
// 点なし1つにつき1回）。前は段12〜22 の物がアリティの分からない点なし（適用は未知）、段1〜9 の物が未知の葉（G7）だった。
const binPfPasses = [
	["[<<] 1 2（前は未知の根）", std("[<<] 1 2"), "(apply [<<] (construct 1 2))", "A", { leftover: false, pfInfo: "[<<]", diagCount: 1 }],
	["[>>] 4 1", std("[>>] 4 1"), "(apply [>>] (construct 4 1))", "A", { pfInfo: "[>>]" }],
	["[~] 1 5（範囲）", std("[~] 1 5"), "(apply [~] (construct 1 5))", "A", { pfInfo: "[~]" }],
	["[~+] 1 5", std("[~+] 1 5"), "(apply [~+] (construct 1 5))", "A", { pfInfo: "[~+]" }],
	["[!=] 1 2", std("[!=] 1 2"), "(apply [!=] (construct 1 2))", "A", { pfInfo: "[!=]" }],
	["[!==] 1 2（段1〜9、前は G7）", std("[!==] 1 2"), "(apply [!==] (construct 1 2))", "A", { pfInfo: "[!==]" }],
	// get・set の足りた適用は未知（根なら通る）。
	["['] fs 0（get は未知の根）", std("['] fs 0"), "(apply ['] (construct fs 0))", "未知", { pfInfo: "[']" }],
	["[@] fs 0（未知の根）", std("[@] fs 0"), "(apply [@] (construct fs 0))", "未知", { pfInfo: "[@]" }],
	["[#] 1 2（中置の # は set、未知の根。前は G7）", std("[#] 1 2"), "(apply [#] (construct 1 2))", "未知", { pfInfo: "[#]" }],
	// 口は左から埋まる。
	// 足りない適用は L。行の根に残ったので `_`（R42。木は `(unit …)` で包む。下の L の根の行も同じ）。
	["[<<] 1（右の口を待つ足りない適用。R42）", std("[<<] 1"), "(unit (apply [<<] 1))", "A"],
	["['] fs（get も同じく L。R42）", std("['] fs"), "(unit (apply ['] fs))", "A"],
	["[<<] 1 4 2（余りは後ろに積む、R35）", std("[<<] 1 4 2"), "(construct (apply [<<] (construct 1 4)) 2)", "A", { leftover: true }],
	["[<<] 1 _（R28 で `[<<] 1` と同じ足りない適用、根なので `_`。前は n = 2 の終わり `(apply [<<] (construct 1 _))`）", std("[<<] 1 _"), "(unit (apply [<<] 1))", "A", { leftoverDiag: ["(apply [<<] 1)"] }],
	// k' = n：`[<<] 1 2` で口が埋まって値になり、後ろの `_` は並びの単位として消える（R43。前は `_` を木に残した）。
	["[<<] 1 2 _（k' = n。`_` は消える、R43）", std("[<<] 1 2 _"), "(apply [<<] (construct 1 2))", "A", { leftover: false }],
	// 口が2つとも埋まって値になり、後ろの inc は積まれて余る（R47・R42・R48）。前（2026-10-23 まで）は逆適用で
	// `(apply inc (apply [<<] (construct 1 2)) ·rev)` など、その前は G2(a)。
	["[<<] 1 2 inc（R47。前は G2(a)、その後 逆適用）", std("[<<] 1 2 inc"), "(construct (apply [<<] (construct 1 2)) (unit inc))", "A"],
	["[!=] 1 2 inc（R47。前は G2(a)、その後 逆適用）", std("[!=] 1 2 inc"), "(construct (apply [!=] (construct 1 2)) (unit inc))", "A"],
	["[~] 1 5 inc（R47。前は G2(a)、その後 逆適用）", std("[~] 1 5 inc"), "(construct (apply [~] (construct 1 5)) (unit inc))", "A"],
	// 部分適用と合成は、素の2引数の関数（`add`）と同じ。
	["q : [<<] 1 の後で q 2", std(["q : [<<] 1", "q 2"]), "(apply q 2)", "A"],
	["([<<] 1) 2", std("([<<] 1) 2"), "(apply [[<<] 1] 2)", "A"],
	["([<<] 1) _（R28 で `([<<] 1)`、根なので `_`。前は終わりの `(apply [[<<] 1] _)`）", std("([<<] 1) _"), "(unit [[<<] 1])", "A"],
	["p : [<<] の後で p 1 2", std(["p : [<<]", "p 1 2"]), "(apply p (construct 1 2))", "A"],
	["[<<] inc 2 3（前は未知の根）", std("[<<] inc 2 3"), "(apply (compose [<<] inc) (construct 2 3))", "A"],
	["[<<] inc 5（`add inc 5` と同じく足りない。根なので `_`、R42）", std("[<<] inc 5"), "(unit (apply (compose [<<] inc) 5))", "A"],
	// 後ろの足りない適用は、`[<<] (inc 5)` の足りない適用（L）。`inc add 5` と同じ。前は未知。根なので `_`（R42）。
	["inc [<<] 5（後ろの足りない適用、`inc add 5` と同じ。R42）", std("inc [<<] 5"), "(unit (apply (compose inc [<<]) 5))", "A"],
	// `[<<] (inc 5) 6`。後ろの関数が並びの 6 を受けたので、木は各関数が受けた物の見える入れ子の適用（R40、§1.3）。
	["inc [<<] 5 6（`[<<] (inc 5) 6`。木は入れ子、R40）", std("inc [<<] 5 6"), "(apply [<<] (construct (apply inc 5) 6))", "A"],
	// 足りない適用を含む合成が適用の頭（`f2 1 g 2` と同じ）：流れで `g ([<<] 5 3)`（R36）。前は G2(b)（下の binPfRefused にあった）。
	["[<<] 5 g 3（前は G2(b)）", std("[<<] 5 g 3"), "(apply (compose (apply [<<] 5) g) 3)", "A", { pfInfo: "[<<]" }],
	// `1 [<<] 2 3 4`・`5 inc ([<<] 1)`・`q : [<<] 1 ⏎ 5 inc q`・`5 inc [<<]` は、2026-10-23 は点なしが前の値を逆適用で取った（R40）。R47 では
	// 素の2引数の関数と同じく値の後ろに積まれる。下の「左からの畳み込み」へ移した。
	// 素の2引数の関数の部分適用の同じ形（下の「比べ」）。R47 で、5 の後ろに積まれた合成が余り、根で `_`（R42・R48）。前は逆適用で
	// `(apply (compose inc [add 1]) 5 ·rev)`・`(apply (compose inc q2) 5 ·rev)`。
	["比べ 5 inc (add 1)（R47）", std("5 inc (add 1)"), "(construct 5 (unit (compose inc [add 1])))", "A"],
	["比べ q2 : add 1 ⏎ 5 inc q2（R47）", std(["q2 : add 1", "5 inc q2"]), "(construct 5 (unit (compose inc q2)))", "A"],
	// information は書いた点なし1つにつき1回。本体を何度読んでも、同じ書いた所なら1回。
	["[<<] 1 2 ⏎ [<<] 3 4（書いた所が2つ）", std(["[<<] 1 2", "[<<] 3 4"]), "(apply [<<] (construct 3 4))", "A", { diagCount: 2 }],
	["t : y ? [<<] y 1 ⏎ t 2 ⏎ t 3（書いた所が1つ）", std(["t : y ? [<<] y 1", "t 2", "t 3"]), "(apply t 3)", "A", { pfInfo: "[<<]", diagCount: 1 }],
	["h : [f] ? f 1 2 ⏎ h [f : [<<]]（括りの関数の欄）", std(["h : [f] ? f 1 2", "h [f : [<<]]"]), "(apply h [f : [<<]])", "A", { pfInfo: "[<<]", diagCount: 1 }],
	// 種類は記号に依らず root で決まるので、欄で渡した `[<<]`（A）と `[']`（未知）は実体を分け合わない。
	["h [f : [<<]] ⏎ h [f : [']]（get の欄は未知）", std(["h : [f] ? f 1 2", "h [f : [<<]]", "h [f : [']]"]), "(apply h [f : [']])", "未知"],
	// 読まない本体（R25）では出さない。
	["t : [y] ? [<<] y だけ（呼ばれない本体は information を出さない）", std("t : [y] ? [<<] y"), "(: t (? [[y]] (defer {[<<] y})))", null, { diagCount: 0 }],
	// 片イ（R120、2026-11-03）：get・set の足りた適用（未知）の後ろの項は積む予想で通る（G2(a) は廃止）。
	["G2(a) ['] fs 0 1（G12(b) → G2(a)、R40）（前は G2(a)）", std("['] fs 0 1"), "(construct (apply ['] (construct fs 0)) 1)", "未知", { pfInfo: "[']" }],
	["G2(a) ['] fs 0 inc（前は G2(a)）", std("['] fs 0 inc"), "(construct (apply ['] (construct fs 0)) (unit inc))", "未知", { pfInfo: "[']", leftoverDiag: ["inc"] }],
	["G2(a) [#] 1 2 inc（前は G2(a)）", std("[#] 1 2 inc"), "(construct (apply [#] (construct 1 2)) (unit inc))", "未知", { pfInfo: "[#]", leftoverDiag: ["inc"] }],
];
const binPfRefused = [
	// 前の `G2(b) [<<] 5 g 3` と `G12(a) 1 [<<] 2 3 4` は、R36・R35 で通る側（上の binPfPasses）へ移した。2026-10-23 からは、`[<<]` が 1 を
	// 逆適用で取り、口が2つなので主語の口が決まらないまま 2 が来て G8 だった（§5 Q5。前は余りを積んだ構築の後ろの逆適用で G12(a)、
	// 作り直しの最初の版は R13 の G10）。`1 [<<] 2 3 4 inc` は、逆適用の廃止（R47、G8 も廃止）で `1 ([<<] 2 3) 4` の後ろに inc が余る形に
	// 決まり、通る側（norevPasses）へ移した。
	// get・set の足りた適用は未知なので、後ろに項が来れば G2(a)（R40 の読み6。前は余りなら G12(b)）。片イ（R120）で G2(a) は廃止し、上の binPfPasses へ移した。
	// 内側の `_`（カリー化）と穴 `!_`（R16）は、名前の定義と `?` の括りの頭だけ。点なしの括りは別名の頭（`p : add` の `p _ 2`）と同じ。
	// → 2026-10-28 の R105 で、書いた `_` は値の口で消える（カリー化しない）ので、`G5 [<<] _ 2` は `[<<] 2` と同じく通る側（いちばん後ろの「R105〜R110」の節）へ
	// 移した。穴 `!_` は今のまま（`[<<] !_ 2` は G7）。
	["G7 [<<] !_ 2", std("[<<] !_ 2"), "G7"],
	// 前は点なしなので、逆適用の右で主語を直に受ける所では G10 だった（`5 [<<]`・`5 ([<<] 1)`・`q : [<<] 1 ⏎ 5 q` と、その後ろに inc の
	// ある形）。1つ当てた部分適用も同じで、そこが素の2引数の関数と違っていた。2026-10-23 に R13 を廃止して、素の2引数の関数と同じに
	// 読む（`5 (add 1)` と同じく `5 ([<<] 1)` は口が1つの関数の逆適用で通り、`5 [<<]` は `5 add` と同じく行の終わりで `_`、R40・R42）。
	// 2026-10-24 の R47 からは、どれも素の2引数の関数と同じく値の後ろに積まれて余る。下の「左からの畳み込み」の pfReversePasses へ移した。
];
for (const [name, s, want, kind, extra] of binPfPasses) checkPass(`畳まない ${name}`, s, want, kind, extra);
for (const [name, s, want] of binPfRefused) checkRefused(`畳まない ${name}`, s, want);
// G12(b) の言い分は、欄で渡した記号と行の順に依らない。実体の鍵（fnKey）は記号を分けないので、前は言い分に書いた記号が、
// 先に解いた方（値の定義が先）の物になった（`h [f : [@]]` ⏎ `bv : h [f : [']]` が `[']` と名指しした。2回目の確かめ）。
// 2026-10-23 から、種類の未知な適用の後ろに項が来る形は G2(a)（R40 の読み6、G12 は廃止）。言い分が記号と行の順に依らないことは同じ。
// 片イ（R120、2026-11-03）で G2(a) は廃止し、どの順でも後ろの項を積む予想で通る。言い分の比べは外し、記号と行の順に依らず通ることを見る。
{
	total++;
	const msgOf = (lines) => {
		try {
			resolve(std(lines));
			return "通った";
		} catch (e) {
			return `${e.gate || e.reason} ${e.message}`;
		}
	};
	const H3 = "h : [f] ? f 1 2 3";
	const got = [
		msgOf([H3, "h [f : [@]]", "bv : h [f : [']]"]),
		msgOf([H3, "h [f : [']]", "bv : h [f : [@]]"]),
		msgOf([H3, "bv : h [f : [@]]", "h [f : [']]"]),
	];
	const name = "畳まない 欄の記号と行の順に依らず通る（前は G2(a) の言い分が、欄の記号と行の順に依らない）";
	if (got.every((m) => m === "通った")) ok(name);
	else fail(name, ...got);
}

// ---------------------------------------------------------------------------
// 逆適用の右の合成の後ろの点なし（R13、§5 Q23 の答え、2026-10-21）
// ---------------------------------------------------------------------------
//
// 主の Claude の「逆適用の右の合成の後ろに点なしがある `5 inc [* 2]` は、`[* 2] (inc 5)` と読んでいい？」に、U〔答え〕2026-10-21
// 11:46「関数合成の方が優先では？」。並びの読みは合成 > 適用 > 逆適用（R6）なので、`inc [* 2]` がまず合成になり、その合成に 5 を
// 逆適用する。主語を受けるのは合成の最初の inc。G10（R13、U 2026-08-06 05:06「ポイントフリーであれば、apply-reverceから除外する
// のがいいと思う。」）は、主語を直に受ける関数が点なしのときだけ断る：右が合成なら最初の関数、ほかは右そのもの（点なしの部分
// 適用も点なし）。この形は決定の規則（主の Claude の案）。前は合成のどこかに点なしがあれば断っていた。§6.3 の行と、点なしの
// 種類ごとの行は、上の各節に置いた。
// 逆適用と前から書いた適用が同じ読みであることは、2026-10-23 まで coproduct_laws.test.js の法則5 が見ていた。2026-10-24 からの法則5 は
// 「値の後ろの関数は、値を取らない」（R47）。
//
// 2026-10-23 の左からの畳み込み（R40）で、この答えの前提の強さの順（R6）が無くなった。`5 inc [* 2]` は `(5 inc) [* 2]` で、`[* 2]` が
// `5 inc` の値を逆適用で主語に取った。答えは Q23 の答えと同じ `[* 2] (inc 5)`。R13（点なしは逆適用しない）は、決定の文面の
// `1 2 [+] 3 4`（`1 ([+] 2 3 4)`）と割れるので同じ日に廃止した（§4 R13・§5 Q36、§7.19）。
//
// 2026-10-24 に逆適用そのものを廃止した（R47。U [2026-10-23 13:12 ebf18260]「…逆適用は廃止しよう」）。Q23 の答えも逆適用がある前提の
// 答えで、R47 で上書きされた：値の後ろの関数は積まれて値を取らない（関数は右からだけ受ける）。`5 inc [* 2]` は 5 の後ろに合成
// `inc [* 2]` が積まれて余り、根で `_`（R42。余ったことは leftover-lambda で知らせる、R48）。下の行は、前の答え（括弧の中）からの変わり方。
const q23Passes = [
	["5 (inc [* 2])（R47。前は逆適用、その前は G8）", std("5 (inc [* 2])"), "(construct 5 (unit [inc [* 2]]))", "A"],
	["5 (inc inc)（R47。前は逆適用、その前は G8）", std("5 (inc inc)"), "(construct 5 (unit [inc inc]))", "A"],
	["h : inc [* 2] ⏎ 5 h（R47。前は逆適用、その前は G8）", std(["h : inc [* 2]", "5 h"]), "(construct 5 (unit h))", "A"],
	["5 add [* 2]（R47。前は主語の口が決まらない逆適用で `_`、その前は G8）", std("5 add [* 2]"), "(construct 5 (unit (compose add [* 2])))", "A"],
	["5 ([* 2] inc)（R47。前は逆適用、その前は G10）", std("5 ([* 2] inc)"), "(construct 5 (unit [[* 2] inc]))", "A"],
	["h : [* 2] inc ⏎ 5 h（R47。前は逆適用、その前は G10）", std(["h : [* 2] inc", "5 h"]), "(construct 5 (unit h))", "A"],
	// Q23 の答え（R6 で合成が先）で通っていた形。2026-10-23 は、点なしが前の値（前の逆適用の結果）を主語に取った（`inc ([* 2] (inc 5))`）。
	["5 inc [* 2] inc（R47。前は `inc ([* 2] (inc 5))`）", std("5 inc [* 2] inc"), "(construct 5 (unit (compose inc [* 2] inc)))", "A"],
	["5 inc [* 2] [+ 1]（R47）", std("5 inc [* 2] [+ 1]"), "(construct 5 (unit (compose inc [* 2] [+ 1])))", "A"],
	["5 double [+ 1]（R47）", std("5 double [+ 1]"), "(construct 5 (unit (compose double [+ 1])))", "A"],
	["5 inc [* 2,]（R47）", std("5 inc [* 2,]"), "(construct 5 (unit (compose inc [* 2,])))", "A"],
	["5 inc [-_,]（R47）", std("5 inc [-_,]"), "(construct 5 (unit (compose inc [-_,])))", "A"],
	// 前は `[' 0]` が `inc 5` の値（中身の見えない A）を受けて、引いた物は未知（R26）。R47 では何も受けずに余る（根で `_`）ので A。
	["5 inc [' 0]（R47。前は未知の根）", std("5 inc [' 0]"), "(construct 5 (unit (compose inc [' 0])))", "A"],
	// 本体は評価する所でない（R42 の読み1）が、2026-10-24 の R52 から、本体の中でも、値の上に積まれて何も受けずに閉じた合成は余ったラムダで
	// `_` になり、知らせる。R47 の最初の版は、ラムダのまま残って値と関数の並んだ構築が種類を決めなかった（未知、§5 Q38 の断る側）。その前は
	// 逆適用で `(apply (compose inc [* 2]) y ·rev)`、A。
	["本体 t : y ? y inc [* 2]（R52。R47 では未知（Q38）、その前は A）", std("t : y ? y inc [* 2]"), "(construct y (unit (compose inc [* 2])))", "A", { body: true, leftoverDiag: ["(compose inc [* 2])"] }],
	// R47：5 の後ろに積まれた合成 `inc [+]` が 3 を受ける（`[+] (inc 3)`）。`[+]` の1項は中身の見えない A なので未知（R31 の1項）。前は
	// `[+]` が `5 inc` の値を逆適用で取って 3 も受けた `[+] (inc 5) 3`（A）、その前は G2(a)。
	["5 inc [+] 3（R47。前は `[+] (inc 5) 3`）", std("5 inc [+] 3"), "(construct 5 (apply (compose inc [+]) 3))", "未知"],
];
for (const [name, s, want, kind, extra] of q23Passes) checkPass(`Q23 ${name}`, s, want, kind, extra);

// ---------------------------------------------------------------------------
// §5 Q1 の答え（2026-10-19）：R24・R25・R26
// ---------------------------------------------------------------------------
//
// R24：括りで受けた名前の種類は、呼ぶ側が渡した物の生まれで決まる（形ごとの実体）。
// R25：括りの関数の本体は、実体を作るときにだけ読む。呼ばれない関数は `(defer …)` で、断らない。門に当たった実体は
//      呼んだ行で断る。
// R26：`x ' k`（と `[' k] x`）で引いた物の種類は、引かれた物の生まれで決まる。
// 実体の形の綴りは resolve.js の頭の注（`{say:L other:N}`・`[N…]`・`A`、仮引数ごとに空白で並べる）。

const src = (lines) => lines.join("\n");
// pattern_guide.md「IO Reader Writer」の m と a・b・c（3つとも 42 を返す、同じ射の3つの綴り）。
const M = ["m :", "\tsay : x ? x * 2", "\tother : 1", ""];
const IO = [...M, "a : [say] ? say 21", "b : [say ~rest] ? say 21", "c : [~rest] ? (rest ' say) 21"];
// example.sn の myGreet。欄 greet は構造体。FN は欄 welcome を関数にしたもの、STR は example.sn のまま（文字列）。
const GREETING = "greeting : [greet world] ? (greet ' welcome) world";
const MY_GREET_FN = ["myGreet :", "\tgreet :", "\t\thello : x ? x", "\t\twelcome : x ? x", "\tworld : ` world`", ""];
const MY_GREET_STR = ["myGreet :", "\tgreet :", "\t\thello : `hello,`", "\t\twelcome : `welcome,`", "\tworld : ` world`", ""];
const REC = "f : [x ~xs] ? [f xs] x";
// 受けた名前 x を並びの頭に置く。x が数なら構築、中身の見えない A を受けて未知なら呼んだ行で G7（名指しは f と形）。
const X1 = "f : [x ~xs] ? x 1";
const X1_INST = "(: f (? [[x ~xs]] (inst N (construct x 1))))";
// 構築の行を並べた字下げのブロック（括りなら `w : [1 2 ⏎ 3 4]`）と、欄の値が2行のブロックの構造体（括りなら
// `w : [k : [1 ⏎ 2] ⏎ other : 3]`）。
const BLOCK_ROWS = ["f : [x ~xs] ? (x ' 0) 1", "w :", "\t1 2", "\t3 4", "", "f w"];
const BLOCK_NESTED = ["g : [k] ? h k", "h : [x ~xs] ? x 1", "w :", "\tk :", "\t\t1", "\t\t2", "\tother : 3", "", "g w"];
// 当てた物の違う括りの関数の部分適用を、欄に入れて同じ括りの関数に渡す（R24。部分適用の確かめ 2026-10-19 の TG1）。
const PAIR_FIELDS = ["inc : x ? x + 1", "pair : [a ~as] [b ~bs] ? a b", "call : [f ~r] ? f [2]", "s :", "\ta : inc", "", "m1 :", "\tf : pair [1]", "", "m2 :", "\tf : pair s", ""];
const PAIR_FIELDS_INST = "(: pair (? [[a ~as] [b ~bs]] (inst N N (construct a b)) (inst {a:L} N (apply a b))))";
// 2026-10-28 の片9b：s2 の欄は前は `z : 1`（pair の a が無い欄で未知になって門）だったが、R115 で無い欄は `_` になって通るので、a の欄に種類の決まらない物
// （数から名前で引いた `(1 ' k)`、R26）を置いて門を保った。
// 片イ（R120、2026-11-03）：pair の本体は前の `a 1`（種類の未知な a の後ろの 1 で G7）が通るようになったので、`$a == $a`（a の種類が未知なら G21）にした。
const PAIR_GATE = ["pair : [a ~as] [b ~bs] ? $a == $a", "call : [f ~r] ? f [2]", "s2 :", "\ta : (1 ' k)", "", "m1 :", "\tf : pair [1]", "", "m2 :", "\tf : pair s2", ""];
// 実体の深さの守り（resolve.js の INSTANCE_DEPTH_MARGIN の注の1、2026-10-20 の自己点検の SC-1・SC-2）。深さは作る実体の鍵（渡した
// 形）の入れ子の深さで、上限は（32 × 書いた括りの関数の数 + 1）× 書いたいちばん深い形。HB_CHAIN(n) は、素の関数 f0 … f(n−1) が、括りの関数 hb に次の関数を欄で渡す鎖（f(n−1) は
// 値を返す）。hb の形はどれも {s:L}（深さ 2）。NEST(d) は `[a : …]` を d 重にした字面（形の深さ d + 1）、NEST_SHAPE(d) はその
// 形の綴り。`p : [a] ? p a` に渡すと、入れ子を1段ずつ剥がす（減っていく形の再帰）ので、実体は d + 1 個が入れ子になる（いちばん
// 内は数 N で、同じ形で自分を呼ぶ）。断るかは、初めの形の深さで決まる。
const HB_CHAIN = (n) => ["hb : [s] ? s 1", ...[...Array(n - 1).keys()].map((i) => `f${i} : x ? hb [s : f${i + 1}]`), `f${n - 1} : x ? x + 1`];
const NEST = (d) => `${"[a : ".repeat(d)}1${"]".repeat(d)}`;
const NEST_SHAPE = (d) => `${"{a:".repeat(d)}N${"}".repeat(d)}`;
// 輪と入れ子の鎖：r は a と b を入れ替えて自分を呼び（形の違う2つの実体の輪）、a を剥がしても自分を呼ぶ。ROT_NEST(d) は
// 欄 a に d − 1 段を入れ、欄 b を数にした構造体の字面（行に分けた括り）。形の深さは d + 1（入れ替えても同じ）。前の守りは
// 実体の入れ子を数えたので、いちばん長い道（剥がす鎖の d − 1 個と、下の入れ替えの実体・数の実体2つで d + 2 個）で数えた。
const ROT = ["r : [a b] ? (r [a : b", "\tb : a]) , (r a)"];
const ROT_NEST = (d) => (d === 0 ? ["1"] : ((inner) => [`[a : ${inner[0]}`, ...inner.slice(1), "\tb : 1]"])(ROT_NEST(d - 1)));
const ROT_SHAPE = (d) => (d === 0 ? "N" : `{a:${ROT_SHAPE(d - 1)} b:N}`);
const ROT_DEF = (name, d) => ((s) => [`${name} : r ${s[0]}`, ...s.slice(1)])(ROT_NEST(d));
// 欄の並べ替え：r は n 個の欄を1つずつずらし、前の2つを入れ替えて自分を呼ぶ。欄の値はどれも形が違うので、形は n! 通りで、
// どれも深さは同じ（深くならない）。実体はどれも n 個の欄の構造体で、入れ子は深さ優先で長くなる。
const PERM_VALS = ["1", "[1 2]", "[z : 1]", "[y : 1]", "[x : 1]", "[[1 2] [3 4]]", "[w : 1]"];
// PERM_RING(n, m) は、同じ並べ替えを m 個の関数 r0 … r(m−1) が順に呼び合う物（r(m−1) は r0 を呼ぶ）。
const PERM_RING = (n, m) => {
	const ns = "abcdefg".slice(0, n).split("");
	const rows = (f) => ns.map((x, i) => `${x} : ${f(x, i)}`);
	const block = (rs) => [`[${rs[0]}`, ...rs.slice(1, -1).map((r) => `\t${r}`), `\t${rs[rs.length - 1]}]`];
	const cyc = block(rows((x, i) => ns[(i + 1) % n]));
	const swp = block(rows((x, i) => (i === 0 ? ns[1] : i === 1 ? ns[0] : x)));
	const name = (k) => (m === 1 ? "r" : `r${k % m}`);
	const defs = [...Array(m).keys()].flatMap((k) => {
		const nx = name(k + 1);
		return [`${name(k)} : [${ns.join(" ")}] ? (${nx} ${cyc[0]}`, ...cyc.slice(1, -1), `${cyc[cyc.length - 1]}) , (${nx} ${swp[0]}`, ...swp.slice(1, -1), `${swp[swp.length - 1]})`];
	});
	const call = block(rows((x, i) => PERM_VALS[i]));
	return [...defs, `${name(0)} ${call[0]}`, ...call.slice(1)];
};
const PERM = (n) => PERM_RING(n, 1);
// 括りの関数 f の実体を n 個（欄の名前 k0 … の違う構造体）作る積と、それだけの行。
const PS_CALLS = (f, k, n) => [...Array(n).keys()].map((i) => `(${f} [${k}${i} : 1])`).join(" , ");
const PS_LINE = (n) => PS_CALLS("p", "k", n);
// 値だけを渡す別々の関数 p1 … pn の鎖（`pi : [a ~r] ? p(i+1) r`、pn は値を返す）。
const VALUE_CHAIN = (n) => [...Array(n).keys()].map((i) => `p${i + 1} : [a ~r] ? ${i + 1 < n ? `p${i + 2} r` : "a"}`);
// hb の本体が門に当たる実体（欄 s が無い）を n 個作る積と、通る実体（欄 s が関数）を n 個作る行。
// 2026-10-28 の片9b：hb の本体は前は `s 1` で、s の欄の無い HB_GATED の実体が未知の s で門に当たった。R115 で無い欄は `_` になって通るので、本体を
// `([' 0] s) 1`（s から字面の整数で引く。List なら要素、無い欄の `_` からは種類が決まらない、R26）にし、HB_PASS の s を `[1 2]` にした（前は `[s : inc]`）。
// 2026-11-03 の片イ（R120）：`([' 0] s) 1` は、種類の未知な引いた物の後ろに 1 を積む予想で通るので、本体を `$s == $s` にした。s の無い HB_GATED の実体は
// s が `_` で `$s` が零射の番地になり、値の演算子 `==` の被演算子で G7。HB_PASS の s = `[1 2]` は値を読む参照の比べで通る（dollar-non-function の warning）。
const HB_GATED = (n) => [...Array(n).keys()].map((i) => `(hb [k${i} : 1] [z : 1])`).join(" , ");
const HB_PASS = (n) => [...Array(n).keys()].map((i) => `(hb [s : [1 2]] [k${i} : 1])`).join(" , ");
const HB_BODY = "hb : [s] [t] ? $s == $s";
// 同じ形で自分を引いてから枝ごとに形が増える再帰（作った実体の数の守りに当たる）。
const GROW_SELF = "g : [x ~xs] ? (g xs) , (g [[a : xs] [a : xs]]) , (g [[b : xs] [b : xs]])";
// 閉包を欄に入れて次の関数へ渡す、別々の関数 p0 … p(n−1) の鎖（p(n−1) は欄の関数を呼ぶ）。
const CLOSURE_CHAIN = (n) => [...[...Array(n - 1).keys()].map((i) => `p${i} : [s] ? p${i + 1} [s : [y ? s y]]`), `p${n - 1} : [s] ? s 1`, "inc : x ? x + 1", "p0 [s : inc]"];
// 外れた仮置きの世界：f は q に (g x) と (h x) を欄で渡し、q は p の実体を n 個作る。g は f を呼んで最後の行 `[+ 1]`（L）で仮置きが
// 外れ、h は f と g を呼ぶ。g → h → f の順に解くと、f は g の仮置きの上・h の仮置きの上・確定した値の上の3回解かれる。
const WORLDS = (n) => [
	"g : x ?",
	"\tf x",
	"\t[+ 1]",
	"",
	"h : x ?",
	"\tf x",
	"\tg x",
	"",
	"f : x ? q [s : (g x)",
	"\tt : (h x)]",
	`q : [s t] ? ${[...Array(n).keys()].map((i) => `(p [w : s] [v : t] [k${i} : 1])`).join(" , ")}`,
	"p : [w] [v] [k] ? 1",
	"f 5",
];

// この表の `g 5 inc`・`f0 5 inc` の形（「隣と結べる」）は、閉じた適用の節が値（A）かを、後ろに関数を置いて見る行。2026-10-23 までは
// 後ろの inc が逆適用でその節を取り（`(apply inc (apply g 5) ·rev)`）、2026-10-24 の逆適用の廃止（R47）からは、inc は節の後ろに積まれて
// 余る（`(construct (apply g 5) (unit inc))`、根で `_`、R42・R48）。節が未知なら、どちらでも後ろの関数で G2(a)（R40 の読み6）なので、
// 見ている物は変わらない。最後の括りが受けている間に来た関数（`h 1 2 3 inc`）は合成の後ろで、木は入れ子の適用（`·rev` の綴りは無くなった）。
const answerPasses = [
	// R24 の例1（pattern_guide.md「IO Reader Writer」）。木の行は m・a・b・c・呼ぶ行の順。
	["R24 a m", src([...IO, "a m"]), "(apply a m)", "A"],
	["R24 a m の実体（本体は (apply say 21)）", src([...IO, "a m"]), "(: a (? [[say]] (inst {say:L other:N} (apply say 21))))", null, { at: 1 }],
	["R24 b m", src([...IO, "b m"]), "(apply b m)", "A"],
	["R24 b m の実体", src([...IO, "b m"]), "(: b (? [[say ~rest]] (inst {say:L other:N} (apply say 21))))", null, { at: 2 }],
	["R26 c m（rest ' say は欄 say の生まれ）", src([...IO, "c m"]), "(apply c m)", "A"],
	["R26 c m の実体", src([...IO, "c m"]), "(: c (? [[~rest]] (inst {say:L other:N} (apply [rest ' say] 21))))", null, { at: 3 }],
	// R24 の例2：利用者の基本の再帰。§6.3 では本体が G7 だった。xs は同じ要素の List なので、自分を同じ形で呼ぶ。
	["R24 f [1 2 3]", src([REC, "f [1 2 3]"]), "(apply f [1 2 3])", "A"],
	["R24 f [1 2 3] の実体（本体は (construct [f xs] x)）", src([REC, "f [1 2 3]"]), "(: f (? [[x ~xs]] (inst [N…] (construct [f xs] x))))", null, { at: 0 }],
	// 文字列の字面は List（String ≅ List(Char)）なので、同じ再帰で分解できる。形は [1 2 3] と同じ。
	["R24 f `abc`（文字列を List として分解する再帰）", src([REC, "f `abc`"]), "(apply f `abc`)", "A"],
	["R24 f `abc` の実体は [1 2 3] と同じ形", src([REC, "f `abc`"]), "(: f (? [[x ~xs]] (inst [N…] (construct [f xs] x))))", null, { at: 0 }],
	// R24 の例3：括りは1つで1と数える（function_guide.md「参照の取り方」）。
	["R24 pair [1 2 3] [10 20]", src(["pair : [a ~as] [b ~bs] ? a + b", "pair [1 2 3] [10 20]"]), "(apply pair (construct [1 2 3] [10 20]))", "A"],
	["R24 pair の実体（形は仮引数ごとに並べる）", src(["pair : [a ~as] [b ~bs] ? a + b", "pair [1 2 3] [10 20]"]), "(: pair (? [[a ~as] [b ~bs]] (inst [N…] [N…] (+ a b))))", null, { at: 0 }],
	// 最後の仮引数が括りの関数は、k > n なら前の仮引数に1つずつ当てて、残りの並び全体を最後の括りが受ける（R24、利用者
	// 2026-10-19「最後の仮引数が括りの関数は、前の仮引数に1つずつ当てて、残りの並び全体を最後の括りが受ける。」）。
	["R24 pair [1] [2] [3]（a は [1]、[b ~bs] は [2] [3]）", src(["pair : [a ~as] [b ~bs] ? a + b", "pair [1] [2] [3]"]), "(: pair (? [[a ~as] [b ~bs]] (inst N [N…] (+ a b))))", null, { at: 0 }],
	["R24 h 1 2 3（v は 1、[x ~xs] は 2 3）", src(["h : v [x ~xs] ? v 1", "h 1 2 3"]), "(: h (? [v [x ~xs]] (inst A [N…] (construct v 1))))", null, { at: 0 }],
	// R49（2026-10-24）：裸の仮引数 f に渡った `$[* 2]` は関数を指す番地で、印ごと実体の鍵に入り、形は `$L`（前は `A`）。
	["R24 map $[* 2] 1 2 3 4 5 は map $[* 2] [1 2 3 4 5] と同じ実体", src(["map : f [x ~y] ? x", "map $[* 2] 1 2 3 4 5", "map $[* 2] [1 2 3 4 5]"]), "(: map (? [f [x ~y]] (inst $L [N…] x)))", null, { at: 0 }],
	// 最後の括りが受けている間に来た inc は合成の後ろ（R41）。木は入れ子の適用（2026-10-24 の R47 で `·rev` の綴りが無くなった。前は
	// `(apply inc (apply h (construct 1 2 3)) ·rev)`。下の `pair [1] [2] inc`・`f 1 2 3 inc` も同じ）。
	["R24 h 1 2 3 inc（残りを受けた節は隣と結べる）", src(["inc : x ? x + 1", "h : v [x ~xs] ? v 1", "h 1 2 3 inc"]), "(apply inc (apply h (construct 1 2 3)))", "A"],
	// 前の仮引数が2つ以上でも、左から1つずつ当てる（[a] は 1、[b ~bs] は [2 3]、[c ~cs] は 4 5）。残りを括った
	// `p3 1 [2 3] [4 5]` と同じ実体で、実体は1つ。前の当て方を逆にしたり、前に1つしか当てないと形が変わる。
	["R24 p3 1 [2 3] 4 5 は p3 1 [2 3] [4 5] と同じ実体（前の仮引数に左から1つずつ）", src(["p3 : [a] [b ~bs] [c ~cs] ? a + c", "p3 1 [2 3] 4 5", "p3 1 [2 3] [4 5]"]), "(: p3 (? [[a] [b ~bs] [c ~cs]] (inst N [N…] [N…] (+ a c))))", null, { at: 0 }],
	["R24 p3 1 [2 3] 4 5", src(["p3 : [a] [b ~bs] [c ~cs] ? a + c", "p3 1 [2 3] 4 5"]), "(apply p3 (construct 1 [2 3] 4 5))", "A"],
	// k < n は、素の関数と同じく部分適用（残り n − k の L）。残りが来た所で、当てた物と合わせて実体を作る（R24、利用者
	// 2026-10-19「括りの関数に実引数が足りないときも、素の関数と同じく部分適用（残りの仮引数を待つ関数）にする。」）。
	["R24 pair [1]（k < n は部分適用の L。行の根なので `_`、R42）", src(["pair : [a ~as] [b ~bs] ? a + b", "pair [1]"]), "(unit (apply pair [1]))", "A"],
	["R24 pair [1] だけでは実体を作らない", src(["pair : [a ~as] [b ~bs] ? a + b", "pair [1]"]), "(: pair (? [[a ~as] [b ~bs]] (defer {a + b})))", null, { at: 0 }],
	["R24 (pair [1]) [2] は pair [1] [2] と同じ実体", src(["pair : [a ~as] [b ~bs] ? a + b", "(pair [1]) [2]", "pair [1] [2]"]), "(: pair (? [[a ~as] [b ~bs]] (inst N N (+ a b))))", null, { at: 0 }],
	["R24 (pair [1]) [2]", src(["pair : [a ~as] [b ~bs] ? a + b", "(pair [1]) [2]"]), "(apply [pair [1]] [2])", "A"],
	["R24 名前を付けた部分適用 p1 : pair [1] の p1 [2]", src(["pair : [a ~as] [b ~bs] ? a + b", "p1 : pair [1]", "p1 [2]"]), "(apply p1 [2])", "A"],
	["R24 t3 1 2（n = 3 の k < n は部分適用の L。R42）", src(["t3 : u v [~r] ? u", "t3 1 2"]), "(unit (apply t3 (construct 1 2)))", "A"],
	["R24 t3 1 2 だけでは実体を作らない", src(["t3 : u v [~r] ? u", "t3 1 2"]), "(: t3 (? [u v [~r]] (defer {u})))", null, { at: 0 }],
	["R24 (t3 1 2) 3 4 は t3 1 2 3 4 と同じ実体（部分適用の残りも最後の括りが受ける）", src(["t3 : u v [~r] ? u", "(t3 1 2) 3 4", "t3 1 2 3 4"]), "(: t3 (? [u v [~r]] (inst A A [N…] u)))", null, { at: 0 }],
	["R24 ((t3 1) 2) [3]（部分適用の部分適用）", src(["t3 : u v [~r] ? u", "((t3 1) 2) [3]"]), "(apply [[t3 1] 2] [3])", "A"],
	["R24 pair [1] inc（部分適用の節は素の関数と同じく合成に入る。R42）", src(["inc : x ? x + 1", "pair : [a ~as] [b ~bs] ? a + b", "pair [1] inc"]), "(unit (compose (apply pair [1]) inc))", "A"],
	// 部分適用の行だけで、残りが来た所に実体を作る（直の行を並べると、その行が実体を作るので、部分適用の側が何もしなくても
	// 上の「同じ実体」の行は合ってしまう。部分適用の確かめ 2026-10-19 の TG2・TG3）。
	["R24 (pair [1]) [2] だけで実体を作る", src(["pair : [a ~as] [b ~bs] ? a + b", "(pair [1]) [2]"]), "(: pair (? [[a ~as] [b ~bs]] (inst N N (+ a b))))", null, { at: 0 }],
	["R24 p1 [2] だけで実体を作る（名前を付けた部分適用）", src(["pair : [a ~as] [b ~bs] ? a + b", "p1 : pair [1]", "p1 [2]"]), "(: pair (? [[a ~as] [b ~bs]] (inst N N (+ a b))))", null, { at: 0 }],
	["R24 (t3 1 2) 3 4 だけで、残りを最後の括りが受ける実体を作る", src(["t3 : u v [~r] ? u", "(t3 1 2) 3 4"]), "(: t3 (? [u v [~r]] (inst A A [N…] u)))", null, { at: 0 }],
	["R24 (t3 1 2) 3 4", src(["t3 : u v [~r] ? u", "(t3 1 2) 3 4"]), "(apply [t3 1 2] (construct 3 4))", "A"],
	["R24 (pair [1]) [2] [3] だけで、残りを最後の括りが受ける実体を作る", src(["pair : [a ~as] [b ~bs] ? a + b", "(pair [1]) [2] [3]"]), "(: pair (? [[a ~as] [b ~bs]] (inst N [N…] (+ a b))))", null, { at: 0 }],
	// 部分適用の部分適用は、元の関数に当てた物を前から足していく（[~r] は [3 4] を受ける）。
	["R24 ((t3 1) 2) [3 4] の実体", src(["t3 : u v [~r] ? u", "((t3 1) 2) [3 4]"]), "(: t3 (? [u v [~r]] (inst A A [N…] u)))", null, { at: 0 }],
	// 当てた物の違う部分適用（`pair [1]` と `pair s`）を欄に入れて同じ括りの関数に渡したら、別の関数なので call の実体も
	// 別で、pair の実体は2つ。行の順に依らない（鍵に当てた物を入れないと、先に呼んだ方の実体を後の行が黙って使い回し、
	// pair の実体は1つになる。部分適用の確かめ 2026-10-19 の TG1）。
	["R24 当てた物の違う部分適用を欄で渡す（m1 が先）", src([...PAIR_FIELDS, "call m1", "call m2"]), PAIR_FIELDS_INST, null, { at: 1 }],
	["R24 当てた物の違う部分適用を欄で渡す（m2 が先）", src([...PAIR_FIELDS, "call m2", "call m1"]), PAIR_FIELDS_INST, null, { at: 1 }],
	// 裸の仮引数に当てた物は形に数えない（R24「裸の仮引数の位置は、形に数えない」）。`t2 1` と `t2 [1 2]` は同じ関数なので、
	// h の実体は1つ。括りの仮引数に当てた物は数えるので、`[u]` なら別の関数で2つ（部分適用の確かめ 2026-10-19 の F2）。
	["R24 裸の仮引数に当てた物の違う部分適用は同じ関数", src(["t2 : u [v] ? v", "h : [f] ? f [2]", "h [f : t2 1]", "h [f : t2 [1 2]]"]), "(: h (? [[f]] (inst {f:L} (apply f [2]))))", null, { at: 1 }],
	["R24 括りの仮引数に当てた物の違う部分適用は別の関数", src(["t2 : [u] [v] ? v", "h : [f] ? f [2]", "h [f : t2 1]", "h [f : t2 [1 2]]"]), "(: h (? [[f]] (inst {f:L} (apply f [2])) (inst {f:L} (apply f [2]))))", null, { at: 1 }],
	// 裸の仮引数に自分の欄を当て直す再帰は、同じ形で自分を呼ぶので有限（部分適用の鍵で裸の位置を A にしないと、鍵が1段ずつ
	// 深くなって G7）。
	["R24 裸の仮引数に部分適用を当て直す再帰", src(["inc : x ? x + 1", "t2 : u [v] ? v", "g : [f] ? g [f : t2 [f : f]]", "g [f : inc]"]), "(apply g [f : inc])", "A"],
	// 最後の仮引数が裸の k > n は、素の関数と同じく前から n 個を当てて余り（excess）。本体の根が A でなければ G12(b)（R24、
	// 利用者 2026-10-19「最後の仮引数が裸の括りの関数に多く渡したときは、素の関数と同じく前から n 個を当てて、余り（excess）にする。」）。
	["R24 tl 1 2 3（最後の仮引数が裸の k > n は余りを後ろに積む、R35）", src(["tl : [x ~xs] y ? x + y", "tl 1 2 3"]), "(construct (apply tl (construct 1 2)) 3)", "A", { leftover: true }],
	["R24 tl 1 2 3 の実体（前から n 個を当てる）", src(["tl : [x ~xs] y ? x + y", "tl 1 2 3"]), "(: tl (? [[x ~xs] y] (inst N A (+ x y))))", null, { at: 0 }],
	["R24 (tl 1) 2 3（部分適用の残りが多い）", src(["tl : [x ~xs] y ? x + y", "(tl 1) 2 3"]), "(construct (apply [tl 1] 2) 3)", "A", { leftover: true }],
	["R24 (tl 1) 2 3 の実体", src(["tl : [x ~xs] y ? x + y", "(tl 1) 2 3"]), "(: tl (? [[x ~xs] y] (inst N A (+ x y))))", null, { at: 0 }],
	["R24 [tl 1 2 3]（余りの節も括りの中の根なら通る）", src(["tl : [x ~xs] y ? x + y", "[tl 1 2 3]"]), "[tl 1 2 3]", "A"],
	// 当てるのは前から n 個（余りの確かめ 2026-10-19 の TG1・TG2・TG4）。実引数が全部数だと、どこから当てても鍵が `N A` に
	// 揃うので、形の違う実引数で見る。後ろから当てても1つずらしても、`tl [1 2] 3 4` の実体は `N A`、`h 1 [2 3] 4 5` の
	// 実体は `A N A` になる。部分適用は、当てた物（bound）を前に置いて元の関数の実体を作る。
	["R24 tl [1 2] 3 4 の実体（前から n 個）", src(["tl : [x ~xs] y ? x + y", "tl [1 2] 3 4"]), "(: tl (? [[x ~xs] y] (inst [N…] A (+ x y))))", null, { at: 0 }],
	["R24 h 1 [2 3] 4 5 の実体（前から n 個）", src(["h : u [x] v ? u + x + v", "h 1 [2 3] 4 5"]), "(: h (? [u [x] v] (inst A [N…] A (+ (+ u x) v))))", null, { at: 0 }],
	["R24 (tl [1 2]) 3 4 の実体（当てた物が前）", src(["tl : [x ~xs] y ? x + y", "(tl [1 2]) 3 4"]), "(: tl (? [[x ~xs] y] (inst [N…] A (+ x y))))", null, { at: 0 }],
	// k > n なら k の大きさに依らず同じ読み（素の関数の d 1 2 と同じ）。
	["R24 tl 1 2 3 4（k = n + 2 も余り）", src(["tl : [x ~xs] y ? x + y", "tl 1 2 3 4"]), "(construct (apply tl (construct 1 2)) 3 4)", "A", { leftover: true }],
	// k = n の括りの関数の節は余りではない（TG5。excess は k > n だけ）。最後の括りが受けている間に来た inc は合成の後ろ（R41）。
	// 前（2026-10-23 まで）は「逆適用の左に置ける」と見ていて、木は `·rev` の綴り。
	["R24 pair [1] [2] inc（k = n の節は余りでない）", src(["inc : z ? z + 1", "pair : [a ~as] [b ~bs] ? a + b", "pair [1] [2] inc"]), "(apply inc (apply pair (construct [1] [2])))", "A", { leftover: false }],
	// 括りが1つの関数は、並び全体を1つの List として受ける（R24、利用者 2026-10-19「それでいいよ」）。
	["R24 n 1 2 3 は n [1 2 3] と同じ実体", src(["n : [~x] ? x", "n 1 2 3", "n [1 2 3]"]), "(: n (? [[~x]] (inst [N…] x)))", null, { at: 0 }],
	["R24 f 1 2 3（x は頭の数）", src(["f : [x ~xs] ? x 1", "f 1 2 3"]), "(: f (? [[x ~xs]] (inst [N…] (construct x 1))))", null, { at: 0 }],
	["R24 Zipper の f 1 2 3（pattern_guide）", src(["f : [~a] ? a ' 0 + a ' 2 + a ' 3", "f 1 2 3"]), "(apply f (construct 1 2 3))", "A"],
	["R24 f 1 2 3 inc（並び全体を受けた節は隣と結べる）", src(["inc : x ? x + 1", "f : [x ~xs] ? x 1", "f 1 2 3 inc"]), "(apply inc (apply f (construct 1 2 3)))", "A"],
	// 並び全体を受けても、実体の本体の根が A でなければ適用の節は未知（R24。k = n と同じ読みで、G12(b) にしない）。前は本体の根が
	// L の `gi : [x ~xs] ? inc` で見ていたが、根が L の実体は G16（R33）になったので、根が未知の `[,] x` で見る。
	["R24 gi 1 2（実体の本体の根が A でなければ未知の根）", src(["gi : [x ~xs] ? [,] x", "gi 1 2"]), "(apply gi (construct 1 2))", "未知"],
	["R24 gi 1 2 の実体（本体の根は未知）", src(["gi : [x ~xs] ? [,] x", "gi 1 2"]), "(: gi (? [[x ~xs]] (inst [N…] (apply [,] x))))", null, { at: 0 }],
	// 撒く項を含む並びは k を数えない（R24）ので、括り1つの関数でも並び全体を受けず、未知の根で実体を作らない。括った
	// `n [vs~ 1]` は撒く項を含む器を1つ渡す形で、別の読み（R24 の「構造体とも List とも読めないが中身の見える器」）。
	["R24 n vs~ 1（撒く項を含む並びは未知の根）", src(["n : [~x] ? x", "vs : 1 , 2", "n vs~ 1"]), "(apply n (construct vs~ 1))", "未知"],
	["R24 n 4 vs~ 5 では実体を作らない", src(["n : [~x] ? x", "vs : 1 , 2", "n 4 vs~ 5"]), "(: n (? [[~x]] (defer {x})))", null, { at: 0 }],
	// R25：呼ばれない括りの関数は、本体を書いたまま残して断らない。読まないので、本体の未定義の名前も information を出さない。
	// §6.3 の「hello : [say] ? say Hello World の本体」「f : [x ~xs] ? [f xs] x の本体」（G7）をここへ移した。
	["R25 hello : [say] ? say Hello World だけ", "hello : [say] ? say Hello World", "(: hello (? [[say]] (defer {say Hello World})))", null, { diagCount: 0 }],
	["R25 #hello（公開しても同じ）", "#hello : [say] ? say Hello World", "(: #hello (? [[say]] (defer {say Hello World})))", null, { diagCount: 0 }],
	["R25 f : [x ~xs] ? [f xs] x だけ", REC, "(: f (? [[x ~xs]] (defer {[f xs] x})))", null],
	["R25 標準の定義と hello（§6.3 の行）", std("hello : [say] ? say Hello World"), "(: hello (? [[say]] (defer {say Hello World})))", null, { diagCount: 0 }],
	["R25 字下げの本体の defer", src(["t : [a] ?", "\ta", "\t5", ""]), "(: t (? [[a]] (defer {a ⏎ 5})))", null],
	// 実体の本体の中の未定義の名前は、今までどおり1回だけ information を出す。
	["R25 実体の本体の未定義の名前", src(["k : [x ~xs] ? zz x", "k [1 2]", "k `ab`"]), "(apply k `ab`)", "A", { diag: "zz", diagCount: 1 }],
	// Zipper の map（pattern_guide.md）。f は裸の仮引数なので A、[x ~y] は List。map f y は同じ形で自分を呼ぶ。
	["R24 map $[* 2] [1 2 3 4 5]", src(["map : f [x ~y] ? (@f x) , (map f y)", "map $[* 2] [1 2 3 4 5]"]), "(apply map (construct $[* 2] [1 2 3 4 5]))", "A"],
	// R49（2026-10-24）：f は `$[* 2]` を指す番地の印を持つ（形 `$L`。前は `A`）。`@f x` は `[* 2] x` で A、`map f y` は同じ印の f で
	// 同じ実体（前は `@f x` が前置 `@` の項で未知）。
	["R24 map の実体", src(["map : f [x ~y] ? (@f x) , (map f y)", "map $[* 2] [1 2 3 4 5]"]), "(: map (? [f [x ~y]] (inst $L [N…] (, [@f x] [map f y]))))", null, { at: 0 }],
	// D 97749496 の greeting。欄 greet は構造体で、その欄 welcome が関数なら (greet ' welcome) world は適用、文字列なら構築。
	["R24・R26 greeting myGreet（welcome が関数）", src([...MY_GREET_FN, GREETING, "greeting myGreet"]), "(apply greeting myGreet)", "A"],
	[
		"R24・R26 greeting の実体（welcome が関数）",
		src([...MY_GREET_FN, GREETING, "greeting myGreet"]),
		"(: greeting (? [[greet world]] (inst {greet:{hello:L welcome:L} world:[N…]} (apply [greet ' welcome] world))))",
		null,
		{ at: 1 },
	],
	[
		"R24・R26 greeting の実体（example.sn のまま、welcome が文字列）",
		src([...MY_GREET_STR, GREETING, "greeting myGreet"]),
		"(: greeting (? [[greet world]] (inst {greet:{hello:[N…] welcome:[N…]} world:[N…]} (construct [greet ' welcome] world))))",
		null,
		{ at: 1 },
	],
	// R26：裸の名前の鍵の鎖（example.sn）。引いた物は文字列なので、`==` の両辺が A。
	["R26 myGreet ' greet ' hello == `hello,`", src([...MY_GREET_STR, "myGreet ' greet ' hello == `hello,`"]), "(== (' (' myGreet greet) hello) `hello,`)", "A"],
	// 括った `?` も括りの関数。
	["R24 [[say] ? say 21] m", src([...M, "[[say] ? say 21] m"]), "(apply [[say] ? say 21] m)", "A"],
	// 入れ子の関数の本体の中の括りの関数。外の仮引数 v は、実体の範囲の外側から引く。
	["R24 素の関数の本体の中の括りの関数", src([...M, "outer : v ? [[say] ? say v] m", "outer 21"]), "(apply outer 21)", "A"],
	[
		"R24 実体の本体の中の括りの関数",
		src([...M, "a : [say] ? [[other] ? say other] m", "a m"]),
		"(: a (? [[say]] (inst {say:L other:N} (apply [[other] ? say other] m))))",
		null,
		{ at: 1 },
	],
	// 標準の定義の n（`n : [~x] ? x`）は、k = n なら実体を作る（§6.3 の n 1 2 3 も、括りが1つなので並び全体を受けて A）。
	["R24 n vs（標準の定義の n、k = n）", std("n vs"), "(apply n vs)", "A"],
	// 構造体の ~rest は受けなかった欄の構造体。そこから欄を引ける（R26）。
	["R24・R26 [say ~r] ? r ' other", src([...M, "h2 : [say ~r] ? r ' other", "h2 m"]), "(: h2 (? [[say ~r]] (inst {say:L other:N} (' r other))))", null, { at: 1 }],
	// List の要素の形は長さに依らない。
	["R24 要素の List の長さは形に入らない", src(["f : [x ~xs] ? x", "f [[1 2] [3 4 5]]"]), "(: f (? [[x ~xs]] (inst [[N…]…] x)))", null, { at: 0 }],
	// R26：引いた物が関数なら L。点なしの [' k] も同じ（下の法則で両方の綴りを比べる）。
	// 裸の名前の鍵は欄の名前で、名前として引かない（say はファイルの定義に無いが、information を出さない）。
	// 引いた関数は L。行の根に残ったので `_`（R42。木は `(unit …)` で包む）。
	// 診断は、根に余った引いた関数の leftover-lambda（R48、2026-10-24）の1つだけ。鍵の say の undefined-name は出さない（前は diagCount 0 で見ていた）。
	["R26 m ' say は L（R42）", src([...M, "m ' say"]), "(unit (' m say))", "A", { diagCount: 1, leftoverDiag: ["(' m say)"] }],
	["R26 [' say] m は L（R42）", src([...M, "[' say] m"]), "(unit (apply [' say] m))", "A", { diagCount: 1, leftoverDiag: ["(apply [' say] m)"] }],
	["R26 (m ' say) 21", src([...M, "(m ' say) 21"]), "(apply [m ' say] 21)", "A"],
	["R26 vs ' 0", std("vs ' 0"), "(' vs 0)", "A"],
	// R26 の外の鍵は今までどおり未知（根なら通る）。
	["R26 m ' 0（構造体に整数の鍵）は未知", src([...M, "m ' 0"]), "(' m 0)", "未知"],
	["R26 vs ' say（List に名前の鍵）は未知", std("vs ' say"), "(' vs say)", "未知"],
	["R26 m @ say は未知", src([...M, "m @ say"]), "(@ m say)", "未知"],
	// 数と、数だけを括った `[3]` は、長さ1の List として受ける（R24、利用者 2026-10-19「それでいいはずだよ」）。
	// 名前はその数、`~rest` は同じ要素の List。数でない中身の見えない A（裸の仮引数・`$` の番地・範囲）は持ち上げない。
	["R24 f [3]（長さ1の括りは長さ1の List）", src(["f : [x ~xs] ? x 1", "f [3]"]), "(apply f [3])", "A"],
	["R24 f [3] の実体", src(["f : [x ~xs] ? x 1", "f [3]"]), "(: f (? [[x ~xs]] (inst N (construct x 1))))", null, { at: 0 }],
	["R24 f 3（数は長さ1の List）", src(["f : [x ~xs] ? x 1", "f 3"]), "(apply f 3)", "A"],
	["R24 f -3（負の数の字面）", src(["f : [x ~xs] ? x 1", "f -3"]), "(apply f -3)", "A"],
	["R24 f 1 + 2（数どうしの値の演算子は数）", src(["f : [x ~xs] ? x 1", "f 1 + 2"]), "(apply f (+ 1 2))", "A"],
	// 値の印を当てた数（数の確かめ 2026-10-19 の F5）。前置 `-` は括り・名前・`_` の前でだけ印になる（`-3` は数の字面）。
	["R24 f -y（名前の数に値の印）", src(["y : 3", X1, "f -y"]), X1_INST, null, { at: 1 }],
	["R24 f -[3]（数だけの括りに値の印）", src([X1, "f -[3]"]), X1_INST, null, { at: 0 }],
	["R24 f !!1（ビット反転）", src([X1, "f !!1"]), X1_INST, null, { at: 0 }],
	["R24 f 3!（後置 !）", src([X1, "f 3!"]), X1_INST, null, { at: 0 }],
	// 値の演算子の段ごとの代表（数の確かめ 2026-10-19 の F6）。段14 は上の `f 1 + 2`。
	["R24 f 1 < 2（段13）", src([X1, "f 1 < 2"]), X1_INST, null, { at: 0 }],
	["R24 f 2 * 3（段15）", src([X1, "f 2 * 3"]), X1_INST, null, { at: 0 }],
	["R24 f 2 ^ 3（段16）", src([X1, "f 2 ^ 3"]), X1_INST, null, { at: 0 }],
	["R24 f 1 << 2（段19）", src([X1, "f 1 << 2"]), X1_INST, null, { at: 0 }],
	["R24 f 1 && 2（段22）", src([X1, "f 1 && 2"]), X1_INST, null, { at: 0 }],
	// 文字は Int と同じ扱いの数（README の法則 B）、`0r`・`0b` は符号なしの数（UInt）。名前の定義の右辺が数なら、名前を
	// 通して数（§2「名前を通して中身を見る」。数の確かめ 2026-10-19 の F8）。
	["R24 f \\a（文字の字面）", src([X1, "f \\a"]), X1_INST, null, { at: 0 }],
	["R24 f 0u0041（文字の字面）", src([X1, "f 0u0041"]), X1_INST, null, { at: 0 }],
	["R24 f 0r18（符号なしの数の字面）", src([X1, "f 0r18"]), X1_INST, null, { at: 0 }],
	["R24 f x0（x0 : 3）", src(["x0 : 3", X1, "f x0"]), X1_INST, null, { at: 1 }],
	["R24 f x0（x0 : [3]）", src(["x0 : [3]", X1, "f x0"]), X1_INST, null, { at: 1 }],
	["R24 f x0（x0 : -y）", src(["y : 3", "x0 : -y", X1, "f x0"]), X1_INST, null, { at: 2 }],
	["R24 g 3 の再帰（数と、残りの List の2つの実体）", src(["g : [x ~xs] ? [g xs] x", "g 3"]), "(: g (? [[x ~xs]] (inst N (construct [g xs] x)) (inst [N…] (construct [g xs] x))))", null, { at: 0 }],
	["R24 数の要素をもう一度括りで受ける", src(["p : [x ~xs] ? q x", "q : [y] ? y 5", "p [1 2]"]), "(apply p [1 2])", "A"],
	// 数を `~rest` で受けた物は R24 の List なので、R26 で要素を引ける（数そのものから引く形は断る側、下の「答え」の断る行）。
	["R26 数の ~rest から引く", src(["h : [~r] ? (r ' 0) 1", "h 5"]), "(apply h 5)", "A"],
	// 2行以上の値の字下げのブロックは、括りと同じ List（1行が1要素。利用者 2026-10-19「それでいいよ」）。
	["R24 2行の値の字下げのブロックは List", src(["sh : [x ~xs] ? x 1", "w :", "\t1", "\t2", "", "sh w"]), "(apply sh w)", "A"],
	["R24 2行の値の字下げのブロックの実体", src(["sh : [x ~xs] ? x 1", "w :", "\t1", "\t2", "", "sh w"]), "(: sh (? [[x ~xs]] (inst [N…] (construct x 1))))", null, { at: 0 }],
	// 1行が1要素：構築の行は平らにせず、その行が要素（要素は数の List）。下の「法則」で括りの綴りと比べる。
	["R24 構築の行の字下げのブロック", src(BLOCK_ROWS), "(apply f w)", "A"],
	["R24 構築の行の字下げのブロックの実体（1行が1要素）", src(BLOCK_ROWS), "(: f (? [[x ~xs]] (inst [[N…]…] (construct [x ' 0] 1))))", null, { at: 0 }],
	// 欄の値の2行のブロックも List（構造体の欄 k は、その生まれの数の List）。
	["R24 欄の値の2行の字下げのブロック", src(BLOCK_NESTED), "(apply g w)", "A"],
	["R24 欄の値の2行の字下げのブロックの実体", src(BLOCK_NESTED), "(: g (? [[k]] (inst {k:[N…] other:N} (apply h k))))", null, { at: 0 }],
	// 合成の中の括りの関数も実体を作る（§5 Q24 の案1、利用者 2026-10-19「とりあえず案1を採用して、強化したり追跡できるなら、
	// また考えてみよう。」）。合成は左から実行する（R11）ので、最初の関数が並びを受け、後ろの関数は前の結果（中身の見えない A）を受ける。
	["Q24 head inc [5 6 7]（合成の頭の括りの関数）", src(["inc : x ? x + 1", "head : [x ~xs] ? x", "head inc [5 6 7]"]), "(apply (compose head inc) [5 6 7])", "A"],
	["Q24 head inc [5 6 7] の実体", src(["inc : x ? x + 1", "head : [x ~xs] ? x", "head inc [5 6 7]"]), "(: head (? [[x ~xs]] (inst [N…] x)))", null, { at: 1 }],
	["Q24 head inc [5 6 7] と head [5 6 7] は同じ実体", src(["inc : x ? x + 1", "head : [x ~xs] ? x", "head inc [5 6 7]", "head [5 6 7]"]), "(: head (? [[x ~xs]] (inst [N…] x)))", null, { at: 1 }],
	["Q24 head inc [5 6 7] double（合成の適用の節は隣と結べる）", src(["inc : x ? x + 1", "double : x ? x * 2", "head : [x ~xs] ? x", "head inc [5 6 7] double"]), "(apply double (apply inc (apply head [5 6 7])))", "A"],
	["Q24 [pair [1]] inc [2]（合成の頭の部分適用）", src(["inc : x ? x + 1", "pair : [a ~as] [b ~bs] ? a + b", "(pair [1]) inc [2]"]), "(: pair (? [[a ~as] [b ~bs]] (inst N N (+ a b))))", null, { at: 1 }],
	["Q24 inc head [5 6 7]（後ろの括りの関数は前の結果を受ける）", src(["inc : x ? x + 1", "head : [x ~xs] ? x", "inc head [5 6 7]"]), "(: head (? [[x ~xs]] (inst A x)))", null, { at: 1 }],
	["Q24 inc head [5 6 7] の根は未知（head の本体の根が未知）", src(["inc : x ? x + 1", "head : [x ~xs] ? x", "inc head [5 6 7]"]), "(apply (compose inc head) [5 6 7])", "未知"],
	// 合成の後ろの部分適用（§5 Q26 の案1、利用者 2026-10-19「合成の後ろの素の関数の部分適用も、残り1つで本体の根が A なら
	// A に数える。」）。括りの関数の部分適用と同じ読みにする。
	["Q26 inc (pr 1) 5（素の部分適用が合成の後ろ）", src(["inc : x ? x + 1", "pr : x y ? y", "inc (pr 1) 5"]), "(apply (compose inc [pr 1]) 5)", "A"],
	["Q26 inc (pr 1) 5 inc", src(["inc : x ? x + 1", "pr : x y ? y", "inc (pr 1) 5 inc"]), "(construct (apply (compose inc [pr 1]) 5) (unit inc))", "A"],
	["Q26 名前を付けた部分適用 p1 : pr 1 の inc p1 5 inc", src(["inc : x ? x + 1", "pr : x y ? y", "p1 : pr 1", "inc p1 5 inc"]), "(construct (apply (compose inc p1) 5) (unit inc))", "A"],
	["Q26 inc (pr [1]) 5（括りの部分適用が合成の後ろ）", src(["inc : x ? x + 1", "pr : [x ~xs] y ? y", "inc (pr [1]) 5"]), "(apply (compose inc [pr [1]]) 5)", "A"],
	["Q26 inc (pr [1]) 5 の実体", src(["inc : x ? x + 1", "pr : [x ~xs] y ? y", "inc (pr [1]) 5"]), "(: pr (? [[x ~xs] y] (inst N A y)))", null, { at: 1 }],
	// 残りが2つ以上の部分適用は、前は合成の後ろで未知（§5 Q13）。流れ（R36）では、残りの口が流れに足りれば A、足りなければ L。
	["Q26 inc (f3 1) 5（残り2つで足りない、L。前は未知。根なので `_`、R42）", src(["inc : x ? x + 1", "f3 : a b c ? c", "inc (f3 1) 5"]), "(unit (apply (compose inc [f3 1]) 5))", "A"],
	// 後ろの `(f3 1)` が並びの 6 を受けたので、木は各関数が受けた物の見える入れ子の適用（R40、§1.3）。
	["Q26 inc (f3 1) 5 6（`f3 1 (inc 5) 6`。木は入れ子、R40）", src(["inc : x ? x + 1", "f3 : a b c ? c", "inc (f3 1) 5 6"]), "(apply [f3 1] (construct (apply inc 5) 6))", "A"],
	// 穴の書き換えとその部分適用を後ろに置く形は、Q26 の答えの時は決めずに未知にしていた（利用者の言葉ではなく、表を作った
	// 側の慎重さ）。合成を適用の畳み込みにした（(g∘f) x = g (f x)、R11。2026-10-19「その方向でお願い」）ので、直接書いた
	// `[add _ 10] (inc 5)` と同じく A。穴の部分適用も、同じ関数を穴で直接書いた `[f3 1 _ 3] (inc 5)` と同じ読みで A。
	["法則で変わった inc [add _ 10] 5（穴、前は未知）", src(["inc : x ? x + 1", "add : x y ? x + y", "inc [add _ 10] 5"]), "(apply (compose inc [add _ 10]) 5)", "A"],
	["法則で変わった inc ([f3 _ _ 3] 1) 5（穴の部分適用、前は未知）", src(["inc : x ? x + 1", "f3 : a b c ? c", "inc ([f3 _ _ 3] 1) 5"]), "(apply (compose inc [[f3 _ _ 3] 1]) 5)", "A"],
	["法則で変わった h2 : h1 1（h1 : f3 _ _ 3）の inc h2 5（前は未知）", src(["inc : x ? x + 1", "f3 : a b c ? c", "h1 : f3 _ _ 3", "h2 : h1 1", "inc h2 5"]), "(apply (compose inc h2) 5)", "A"],
	// 前は未知の節で、隣と結べば G2(a) だった。後ろの inc は、2026-10-23 までは逆適用で節を取り、R47 から積まれて余る（表の頭の注）。
	["法則で変わった inc [add _ 10] 5 inc（前は G2(a)）", src(["inc : x ? x + 1", "add : x y ? x + y", "inc [add _ 10] 5 inc"]), "(construct (apply (compose inc [add _ 10]) 5) (unit inc))", "A"],
	["法則で変わった inc ([f3 _ _ 3] 1) 5 inc（前は G2(a)）", src(["inc : x ? x + 1", "f3 : a b c ? c", "inc ([f3 _ _ 3] 1) 5 inc"]), "(construct (apply (compose inc [[f3 _ _ 3] 1]) 5) (unit inc))", "A"],
	["法則で変わった h2 : h1 1 の inc h2 5 inc（前は G2(a)）", src(["inc : x ? x + 1", "f3 : a b c ? c", "h1 : f3 _ _ 3", "h2 : h1 1", "inc h2 5 inc"]), "(construct (apply (compose inc h2) 5) (unit inc))", "A"],
	// 穴の本体の根は元の関数のもの。根が A でなければ、直接書いた `[pq _ 1] (inc 5)` と同じく未知のまま。
	// 前は根が L の `pq : x y ? inc` で見ていたが、根が L の関数は G16（R33）なので、根が未知の `[,] y` で見る。
	["守り inc [pq _ 1] 5（穴の元の関数の根が未知なら未知）", src(["inc : x ? x + 1", "pq : x y ? [,] y", "inc [pq _ 1] 5"]), "(apply (compose inc [pq _ 1]) 5)", "未知"],
	// 最初の関数が余れば印 `excess`（後ろに素の部分適用があっても落とさない）。確かめ 2026-10-19 の T2。
	["Q26 inc (pr 1) 5 6（流れの余りは後ろに積む、R36）", src(["inc : x ? x + 1", "pr : x y ? y", "inc (pr 1) 5 6"]), "(construct (apply (compose inc [pr 1]) 5) 6)", "A", { leftover: true }],
	// 後ろの関数が2つ以上でも、全部を見る（位置に依らない）。確かめ 2026-10-19 の T3。
	["Q26 inc double (pr 1) 5 inc（後ろの2つ目）", src(["inc : x ? x + 1", "double : x ? x * 2", "pr : x y ? y", "inc double (pr 1) 5 inc"]), "(construct (apply (compose inc double [pr 1]) 5) (unit inc))", "A"],
	["Q26 inc (pr 1) double 5 inc（後ろの1つ目）", src(["inc : x ? x + 1", "double : x ? x * 2", "pr : x y ? y", "inc (pr 1) double 5 inc"]), "(construct (apply (compose inc [pr 1] double) 5) (unit inc))", "A"],
	// 元の関数の根が仮置きで決まる再帰の部分適用（§3.4 の再帰の仮置き）。確かめ 2026-10-19 の F3。
	["Q26 自己再帰 r1 : x y ? inc (r1 1) y の r1 1 2", src(["inc : x ? x + 1", "r1 : x y ? inc (r1 1) y", "r1 1 2"]), "(apply r1 (construct 1 2))", "A"],
	["Q26 相互再帰 a1・b1 の a1 1 2", src(["inc : x ? x + 1", "a1 : x y ? inc (b1 1) y", "b1 : x y ? inc (a1 1) y", "a1 1 2"]), "(apply a1 (construct 1 2))", "A"],
	["Q26 名前を通す再帰 p1 : rp 1 の rp 1 2", src(["inc : x ? x + 1", "p1 : rp 1", "rp : x y ? inc p1 y", "rp 1 2"]), "(apply rp (construct 1 2))", "A"],
	// 2026-10-26 の R76（§5 Q37 の答え：字下げの本体の行は評価する所）で、行 `⇥inc` は `_` になり本体の根が A に決まって仮置きが当たる（前の綴りの r2 1 2 は A、
	// いちばん後ろの「R73〜R79」の節）。仮置きが外れる形は、根が未知の行 `⇥[,] y` で見る（HEAD でも同じ答え）。
	["Q26 仮置きが外れる再帰 r2 1 2 は未知（行の根が未知）", src(["inc : x ? x + 1", "r2 : x y ?", "\tinc (r2 1) y", "\t[,] y", "", "r2 1 2"]), "(apply r2 (construct 1 2))", "未知"],
	// 合成の後ろの根は、ここまでが A のときだけ引く。使わない根を引くと、仮置き（解いている途中の f）が外れたとき、それに
	// 依らない g の根まで未知に替わり、定義の順で答えが割れていた。どちらの順でも A。確かめ 2026-10-19 の F1（反証）。
	// 前は根が L の `adder : m ? [+ m]`（§5 Q21）で見ていたが、根が L の関数は G16（R33）なので、根が未知の uu で見る。
	["Q26 g : y ? (uu (f 1) y) , 1（f が先）の g 5 inc", src(["inc : x ? x + 1", "uu : m ? [,] m", "f : x y ?", "\tg y", "\tinc", "", "g : y ? (uu (f 1) y) , 1", "g 5 inc"]), "(construct (apply g 5) (unit inc))", "A"],
	["Q26 g : y ? (uu (f 1) y) , 1（g が先）の g 5 inc", src(["inc : x ? x + 1", "uu : m ? [,] m", "g : y ? (uu (f 1) y) , 1", "f : x y ?", "\tg y", "\tinc", "", "g 5 inc"]), "(construct (apply g 5) (unit inc))", "A"],
	// `inc y` は中身の見えない A なので、後ろの `[+]` に1項で未知になり、f1 の根を引かない（R31 の1項。R31 の前は `[+]` に1項が
	// いつも未知、Q17）。
	["Q26 g : y ? (inc [+] f1 y) , 1（f1 が先、素の関数）の g 5 inc", src(["inc : x ? x + 1", "f1 : y ?", "\tg y", "\tinc", "", "g : y ? (inc [+] f1 y) , 1", "g 5 inc"]), "(construct (apply g 5) (unit inc))", "A"],
	// 畳まない `[<<]` に1項は足りない適用（R32）で、同じく f1 の根を引かない。
	["R32 g : y ? (inc [<<] f1 y) , 1（f1 が先）の g 5 inc", src(["inc : x ? x + 1", "f1 : y ?", "\tg y", "\tinc", "", "g : y ? (inc [<<] f1 y) , 1", "g 5 inc"]), "(construct (apply g 5) (unit inc))", "A"],
	// §5 Q28（2026-10-20、外れた仮置きに頼った答えは未知に替えず、確定した値で解き直す）。並べ方で割れた形は法則の試験
	// （coproduct_laws.test.js の Q28_FORMS）が見る。ここに置くのは、並べ方では割れないのに、前は同じ割れの悪い側に倒れていた
	// 形（どれも前は断るか未知。確かめ 2026-10-20 の並べ替えの確かめで見つかった）。g の根は積なので f の根に依らず A。
	// 値の定義（§6.4 の1 の2：値の名前を先に解く）が f を先に解かせるので、行の順に依らず前は G2(a)。
	["Q28 v : f 1 が f を先に解かせても g の根は積で A", src(["inc : x ? x + 1", "v : f 1", "f : x ?", "\tg x", "\tinc", "", "g : x ? (f x) , 1", "g 5 inc"]), "(construct (apply g 5) (unit inc))", "A"],
	// 呼ばれない素の関数 f の本体の根を先に解く（§6.4 の1 の3）と、h の実体が輪（h → k → g → h）の頭になって仮置きが外れ、
	// それに頼った g の実体（形 N）の根が未知に替わっていた（f を消すと前も A。呼ばれない定義が、ほかの行の答えを変えていた）。
	// k の本体は前は `[+ [g x]]`（g の仮置きの上で根が L）だったが、根が L の実体は G16（R33）なので、g を引いて根が未知の
	// `[,] [g x]` にした（h の実体の根が A でないのは同じ）。
	["Q28 呼ばれない f : x ? (g x) , 1 があっても g [5] inc は A", src(["inc : x ? x + 1", "f : x ? (g x) , 1", "g : [x ~xs] ? (h [s : k]) , 1", "h : [s] ? s 1", "k : [x ~xs] ? [,] [g x]", "g [5] inc"]), "(apply inc (apply g [5]))", "A"],
	// 合成と、直接書いた入れ子（`inc (f [1 2])`、前も A）が同じ読み（R11）。前は合成の側だけ未知だった。
	// g の本体は前は `[+ [f x]]`（根が L）だったが、根が L の関数は G16（R33）なので、f を引いて根が未知の `[,] [f x]` にした。
	["Q28 inc f [1 2] は inc (f [1 2]) と同じく A", src(["inc : x ? x + 1", "h : [s] ? s 1", "f : [x ~xs] ? (h [s : g]) , 1", "g : x ? [,] [f x]", "inc f [1 2]"]), "(apply (compose inc f) [1 2])", "A"],
	// 実体の深さの守り（SC-1）：素の関数を挟む鎖。hb の形はどれも {s:L}（f1 … はファイルの定義なので深さ 1 の葉）で、深く
	// ならない。前は f0 を先に置くと、f0 → hb の実体 → f1 → … と積んだ枠の hb の実体を全部数え、34 個の関数で 32 段に達して
	// f0 の根が黙って未知になり、`f0 5 inc` が G2(a) だった（逆順なら A。逆順と並べ替えは法則の試験が見る）。
	["深さ 素の関数を挟む hb の 34 個の鎖（f0 が先）", src(["inc : x ? x + 1", ...HB_CHAIN(34), "f0 5 inc"]), "(construct (apply f0 5) (unit inc))", "A"],
	// 入れ子の数の守りも、素の関数の本体を解く間は数え直す（INSTANCE_DEPTH_MARGIN の注の4。df43d0d7 の stretchOf と同じ所で切る）。
	// 前（2026-10-20 のまとめ直しから dde5ec8d まで）は、hb の実体が 257 個入れ子になる所で instance-nest-limit だった（確かめ
	// 2026-10-20 の6回目）。df43d0d7 も通す（hb の確定した実体が 512 個を超えると総数の G7）。
	["深さ 素の関数を挟む hb の 300 個の鎖", src(["inc : x ? x + 1", ...HB_CHAIN(300), "f0 5 inc"]), "(construct (apply f0 5) (unit inc))", "A"],
	// 守り：31 段の入れ子の字面（形の深さ 32）は、浅い呼び出しが先でも通る（上限を固定の 32 にしていた間の、上限ちょうど）。
	["深さ 31 段の入れ子の字面（形の深さ 32）は浅い呼び出しが先でも通る", src(["p : [a] ? p a", "a2 : p [a : 1]", `b : p ${NEST(31)}`, "b"]), "b", "A"],
	// 守り：輪と入れ子の鎖（ROT）の 30 段・31 段（形の深さ 31・32）は通る。31 段は、前の守り（実体の入れ子のいちばん長い道
	// 33 個）では G7 だった。形は深くならず、実体は有限に収まる（入れ替えの輪は2つの形を行き来し、剥がす鎖は1段ずつ浅くなる）
	// ので、通るのが鍵の深さの守りの答え（2026-10-20）。
	["深さ 輪と入れ子の鎖の 30 段は通る", src([...ROT, ...ROT_DEF("bb", 30), ...ROT_DEF("cc", 15), "bb"]), "bb", "A"],
	["深さ 輪と入れ子の鎖の 31 段（形の深さ 32）は通る", src([...ROT, ...ROT_DEF("bb", 31), ...ROT_DEF("cc", 15), "bb"]), "bb", "A"],
	["深さ 輪と入れ子の鎖の 31 段（形の深さ 32、浅い呼び出しが先）は通る", src([...ROT, ...ROT_DEF("cc", 15), ...ROT_DEF("bb", 31), "bb"]), "bb", "A"],
	// 欄 5 つの並べ替え（形 120 通り、深さは同じ）は、実体が有限に収まるので通る。前の守り（同じ `?` の実体の入れ子 32）では、
	// 深さ優先の入れ子が 32 段を超えて G7 だった。
	["深さ 欄 5 つの並べ替えの再帰は通る", src(PERM(5)), "(apply r [a : 1 ⏎ b : [1 2] ⏎ c : [z : 1] ⏎ d : [y : 1] ⏎ e : [x : 1]])", "A"],
	// 門で見る深さは括りに当てた物だけ（関数を書いた所の深さは入れない）。31 段の字面（深さ 32）を受けた実体の中で書いた括りの
	// 関数に数を渡すのは、深さ 1（確かめ 2026-10-20。書いた所の深さを入れると 33 段で断っていた）。
	["深さ 深い実体の中で書いた括りの関数に数を渡す", src(["p : [a] ? [[b] ? b] [1]", `p ${NEST(31)}`]), `(apply p ${NEST(31)})`, "A"],
	// 閉包を欄に入れて次の関数へ渡す別々の関数の鎖：閉包は書いた所の実体と同じ段なので、関数1つごとに欄の1段だけ深くなる。
	// 上限は括りの関数の数で上がるので何個でも通る（上限を固定の 32 にしていた間は、32 個で G7。下の「答え」の 40 個の行）。
	["深さ 閉包を欄で渡す別々の関数の 31 個の鎖", src(CLOSURE_CHAIN(31)), "(apply p0 [s : inc])", "A"],
	// 作った実体の数の守り（INSTANCE_DEPTH_MARGIN の注の3）は、外れた仮置きの上で作った実体を、外れたときに数から外す。f が g の
	// 仮置き・h の仮置き・確定した値の3つの世界で p の実体を 342 個ずつ作る形は、g → h → f の順に解くと 1026 個を作るが、外れた
	// 2つの世界の分は外すので通る（前はこの並べ方だけ断った。確かめ 2026-10-20。全部の並べ方は確かめで見た）。
	["Q25 外れた仮置きの世界ごとの実体は積み増さない（g → h → f）", src(WORLDS(342)), "(apply f 5)", "A"],
	// 同じ綴りの2つの関数は実体を分け合うが、総数は呼んだ `?` ごとに数える（300 個ずつで通る。確かめ 2026-10-20 の反証。綴りで
	// 数えると 600 個で断った）。
	// 書いた形は、どの深さでも断らない（書いた深さまでしか届かない。上限は（32 × 書いた括りの関数の数 + 1）× 書いたいちばん深い形、確かめ 2026-10-20 の後、
	// 利用者の承認で直した）。前（2026-10-20 の守りのまとめ直し）は、書いた 32 段の入れ子の字面や、書いた部分適用・合成の鎖を
	// G7 で断った。減っていく形の再帰（入れ子の字面を1段ずつ剥がす）も、浅い呼び出しの置き場所に依らず通る。
	["深さ 33 段の入れ子の字面（浅い呼び出しが先）", src(["p : [a] ? p a", "a2 : p [a : 1]", `b : p ${NEST(33)}`, "a2", "b"]), "b", "A"],
	["深さ 33 段の入れ子の字面（浅い呼び出しが後）", src(["p : [a] ? p a", `b : p ${NEST(33)}`, "a2 : p [a : 1]", "a2", "b"]), "b", "A"],
	["深さ 33 段の入れ子の字面（先に b inc）", src(["inc : x ? x + 1", "p : [a] ? p a", "b inc", `b : p ${NEST(33)}`, "a2 : p [a : 1]"]), "(construct b (unit inc))", "A", { at: 2 }],
	["深さ 輪と入れ子の鎖の 32 段（浅い呼び出しが後）", src([...ROT, ...ROT_DEF("bb", 32), ...ROT_DEF("cc", 15), "bb"]), "bb", "A"],
	["深さ 輪と入れ子の鎖の 32 段（浅い呼び出しが先）", src([...ROT, ...ROT_DEF("cc", 15), ...ROT_DEF("bb", 32), "bb"]), "bb", "A"],
	["深さ 再帰でない関数に 60 段の入れ子の字面", src(["k : [a] ? 1", `k ${NEST(60)}`]), `(apply k ${NEST(60)})`, "A"],
	// `x @ k` の右と、鍵でない `x ' k` の右（裸の名前・字面の整数でない物）は解くので、そこに書いた形も書いた形に数える（確かめ
	// 2026-10-20 の6回目。前は右を数えず、上限がほかの所に書いた形だけで決まって G7 で断った。df43d0d7 は通す）。
	["深さ `@` の右に書いた 70 段の字面", src(["f : [a] ? 1", `1 @ [f ${NEST(70)}]`]), `(@ 1 [f ${NEST(70)}])`, "未知"],
	["深さ 鍵でない `'` の右に書いた 200 段の字面", src(["f : [a] ? 1", "w : [z : 1]", `g : x ? w ' [f ${NEST(200)}]`, "g 1"]), "(apply g 1)", "未知"],
	// 閉包を欄で渡す別々の関数の鎖は、関数1つごとに1段深くなるが、関数の数で上限も上がる（再帰しない計算は、括りの関数を1つ通る
	// たびに、書いたいちばん深い形の分までしか深くならない）ので、何個でも通る。前（まとめ直しの後）は 32 個で G7 だった。
	["深さ 閉包を欄で渡す別々の関数の 40 個の鎖", src(CLOSURE_CHAIN(40)), "(apply p0 [s : inc])", "A"],
	// 値だけを渡す別々の関数の鎖は、入れ子の数の守りに数えない（数えるのは同じ `?` の入れ子だけ。注の4）。前（まとめ直しの後）は
	// 257 個で instance-nest-limit だった。
	["深さ 値だけを渡す別々の関数の 300 個の鎖", src([...VALUE_CHAIN(300), "p1 [1 2 3]"]), "(apply p1 [1 2 3])", "A"],
	["Q25 同じ綴りの関数の総数は呼んだ ? ごと", src(["p : [s] ? 1", "p2 : [s] ? 1", `a : ${PS_CALLS("p", "k", 300)}`, `b : ${PS_CALLS("p2", "j", 300)}`, "a"]), "a", "A"],
	// 片イ（R120・R126、2026-11-03）：下の answerRefused の、種類の未知な項（実体の本体の `h 5`・`x 1` の名前、引いた物）の G7 と G2(a) の行は通る。木は畳みの
	// 予想（R118）で、種類の未知な項の後ろの項は積む予想。数でない物を渡した実体の根は未知のままなので、数と読まないこと（行の元の狙い）は根の種類で見る
	// （数なら `h 5` は構築で A）。仮置きの取り消し（Q28）と根が A でない部分適用（Q26）も根の種類（未知）で見る。
	["R24 g fs（h は未知）（片イの R123 で fs の inc・double は `_`）（前は G7）", src(["inc : x ? x + 1", "double : x ? x * 2", "fs : inc , double", "g : [h ~hs] ? h 5", "g fs"]), "(apply g fs)", "未知"],
	["R24 a m m（関数の見える構造体の List を並びで渡す）（前は G7）", src([...IO, "a m m"]), "(apply a (construct m m))", "未知"],
	["R24 p 1 $inc（形の混ざった並び）（前は G7）", src(["inc : x ? x + 1", "p : [x ~xs] ? q x", "q : [y] ? y 5", "p 1 $inc"]), "(apply p (construct 1 $inc))", "未知"],
	["R24 tg 1 2 3（本体の根が未知で k > n。G12(b) → G2(a)、R40）（前は G2(a)）", src(["tg : [x ~xs] y ? [,] y", "tg 1 2 3"]), "(construct (apply tg (construct 1 2)) 3)", "未知"],
	["R24 (tg 1) 2 3（部分適用で本体の根が未知、k > n。G12(b) → G2(a)、R40）（前は G2(a)）", src(["tg : [x ~xs] y ? [,] y", "(tg 1) 2 3"]), "(construct (apply [tg 1] 2) 3)", "未知"],
	["R26 数から名前の鍵で引く（前は G7）", src(["(5 ' say) 1"]), "(construct [5 ' say] 1)", "未知"],
	["R24 前置 ! を当てた物は数でない（前は G7）", src(["f : [h ~hs] ? h 5", "f !(1 < 0)"]), "(apply f ![1 < 0])", "未知"],
	["R24 前置 ! を当てた数の字面も数でない（前は G7）", src(["f : [h ~hs] ? h 5", "f !3"]), "(apply f !3)", "未知"],
	["R24 裸の仮引数は数と決まらない（前は G7）", src(["f : [x ~xs] ? x 1", "k : v ? f v", "k 3"]), "(apply k 3)", "未知"],
	["R24 $ の番地は数と決まらない（前は G7）", src(["inc : x ? x + 1", "f : [x ~xs] ? x 1", "f $inc"]), "(apply f $inc)", "未知"],
	["R24 範囲は数でない（前は G7）", src(["f : [x ~xs] ? x 1", "f 1 ~ 3"]), "(apply f (~ 1 3))", "未知"],
	["R24 番地の字面は数でない（前は G7）", src([X1, "f 0x10"]), "(apply f 0x10)", "未知"],
	["R24 幅つきの番地の字面（前は G7）", src([X1, "f 8x00FF"]), "(apply f 8x00FF)", "未知"],
	["R24 番地だけの括り（前は G7）", src([X1, "f [0x10]"]), "(apply f [0x10])", "未知"],
	["R24 番地の名前（前は G7）", src(["uart : 0x09000000", "g : [h ~hs] ? h 5", "g uart"]), "(apply g uart)", "未知"],
	["R24 番地のずらし（前は G7）", src([X1, "f 0x10 + 1"]), "(apply f (+ 0x10 1))", "未知"],
	["R24 番地に値の印（前は G7）", src([X1, "f !!0x10"]), "(apply f !!0x10)", "未知"],
	["R26 番地から引く（前は G7）", src(["(0x10 ' 0) 1"]), "(construct [0x10 ' 0] 1)", "未知"],
	["R26 数から整数の鍵で引く（前は G7）", src(["(5 ' 0) 1"]), "(construct [5 ' 0] 1)", "未知"],
	["R26 [' 0] で数から引く（前は G7）", src(["([' 0] 3) 1"]), "(construct [[' 0] 3] 1)", "未知"],
	["R26 数の名前から引く（前は G7）", src(["y : 3", "(y ' 0) 1"]), "(construct [y ' 0] 1)", "未知"],
	["R24 裸の仮引数に値の印（前は G7）", src([X1, "k : v ? f -v", "k 3"]), "(apply k 3)", "未知"],
	["R24 器に値の印（前は G7）", src([X1, "f -[1 2]"]), "(apply f -[1 2])", "未知"],
	["R24 数と裸の仮引数の値の演算子（前は G7）", src([X1, "k : v ? f 1 + v", "k 3"]), "(apply k 3)", "未知"],
	["R24 裸の仮引数と数の値の演算子（前は G7）", src([X1, "k : v ? f v + 1", "k 3"]), "(apply k 3)", "未知"],
	// 数の実体（A）を先に作っても、適用の結果を渡した行は数の答えに化けない（行の順を入れ替えても、`f (inc 3)` の行の根は未知）。
	["R24 f 3 の後の f (inc 3)（前は G7）", src(["inc : x ? x + 1", X1, "f 3", "f (inc 3)"]), "(apply f [inc 3])", "未知"],
	["R24 f (inc 3) の後の f 3（f (inc 3) の行を見る。前は G7）", src(["inc : x ? x + 1", X1, "f (inc 3)", "f 3"]), "(apply f [inc 3])", "未知", { at: -2 }],
	["R26 (m ' 0) 21（前は G7）", src([...M, "(m ' 0) 21"]), "(construct [m ' 0] 21)", "未知"],
	["R26 (m ' say~) 21（前は G7）", src([...M, "(m ' say~) 21"]), "(construct [m ' say~] 21)", "未知"],
	// fs の要素は片イの R123 で関数の番地（値）なので、引いた物は A（前は L の見える List から引いた物で未知）。
	["R26 ([' 0] fs) 5（片イの R123 で fs の要素は番地。前は L の見える List から引いた物は未知）（前は G7）", std("([' 0] fs) 5"), "(construct [[' 0] fs] 5)", "A"],
	["R24 関数の行のある字下げのブロック（前は G7）", src(["inc : x ? x + 1", "sh : [h ~hs] ? h 1", "w :", "\tinc", "\t2", "", "sh w"]), "(apply sh w)", "未知"],
	["Q24 tg inc 1 2 3（本体の根が未知で k > n。G12(b) → G2(a)、R40）（前は G2(a)）", src(["inc : x ? x + 1", "tg : [x ~xs] y ? [,] y", "tg inc 1 2 3"]), "(construct (apply (compose tg inc) (construct 1 2)) 3)", "未知"],
	["Q24 inc h2 [5 6 7]（後ろの括りの関数の名前は未知）（前は G7）", src(["inc : x ? x + 1", "h2 : [x ~xs] ? x 1", "inc h2 [5 6 7]"]), "(apply (compose inc h2) [5 6 7])", "未知"],
	["Q26 inc (pq 1) 5 inc（本体の根が未知の部分適用）（前は G2(a)）", src(["inc : x ? x + 1", "pq : x y ? [,] y", "inc (pq 1) 5 inc"]), "(construct (apply (compose inc [pq 1]) 5) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	["Q26 inc (pr 1) (pq 1) 5 inc（前は G2(a)）", src(["inc : x ? x + 1", "pr : x y ? y", "pq : x y ? [,] y", "inc (pr 1) (pq 1) 5 inc"]), "(construct (apply (compose inc [pr 1] [pq 1]) 5) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	["Q26 仮置きが外れる再帰 r2 1 2 inc（行の根が未知）（前は G2(a)）", src(["inc : x ? x + 1", "r2 : x y ?", "\tinc (r2 1) y", "\t[,] y", "", "r2 1 2 inc"]), "(construct (apply r2 (construct 1 2)) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	["Q28 外れた仮置きの上で閉じた枠に頼る（h → f → g）（前は G2(a)）", src(["inc : x ? x + 1", "h : x ?", "\tf x", "\t[,] x", "", "f : x ?", "\tg x", "\th x", "", "g : x ? f x", "g 5 inc"]), "(construct (apply g 5) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	["Q28 例外で抜けた枠の仮置きに頼る（前は G2(a)）", src(["inc : x ? x + 1", "w : 1 , [[x : v 2] ? 5]", "v : h 1", "h : x ?", "\tk x", "\tw", "\t[,] x", "", "k : x ? h x", "k 5 inc"]), "(construct (apply k 5) (unit inc))", "未知"],
	["Q28 無名の関数の解き直しが外の枠の仮置きに頼る（前は G2(a)）", src(["inc : x ? x + 1", "hh : [s] ? s 1", "f1 : x ?", "\tf2 x", "\tg x", "\t[,] x", "", "f2 : x ?", "\tg x", "\t[,] x", "", "g : y ? hh [s : [w ? f1 ((f2 w) , 1)]]", "g 5 inc"]), "(construct (apply g 5) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
];
const answerRefused = [
	// R24 の例4：List の要素に L が見えるので名前は未知。呼んだ行で G7、関数と形を名指しする（R25）。
	// 片イ（R120・R123）で、要素の名前の種類が未知な `h 5` は断らない（上の answerPasses へ移した）。
	// 構造体に同じ名前の欄が無い。→ 2026-10-28 の片9b（R115）から、無い欄の名前は `_` で通る（いちばん後ろの「R111〜R116」の節へ移した）。
	// 呼ぶ行が素の関数の本体なら、その定義の行で断る。2026-10-28 の片9b：門を作っていた無い欄（`a2 : [nope] ? nope 21`）は R115 で `_` になって通るので、
	// 実体の本体の門を、欄の関数から引いた物（`(say ' k) 21`。L から引いた物は種類が決まらない、R26）に替えた。
	// 片イ（R120）で、引いた物の後ろの 21 は積む予想で通るので、本体を `$say + 21` に替えた（say は関数の実体で、関数を指す番地を値の演算子に置いて G7。
	// 下の NAMING の a2・b2 と同じ綴り）。
	["R25 素の関数の本体から呼んで門（前の本体は無い欄の `nope 21`、その後 `(say ' k) 21`）", src([...M, "a2 : [say] ? $say + 21", "p : v ? a2 m"]), "G7", [["a2", "{say:L other:N}"]]],
	// 実体の本体の中で別の括りの関数を呼んで門に当たったら、通った実体を呼んだ順に名指しする。
	// 要素が中身の見えない A なので、q の y は未知。要素が数なら通る（「数の要素をもう一度括りで受ける」）。2026-10-28 の片9b：前の要素は未定義の名前 zz だったが、
	// R111 で zz は `_`（R90 で本体を読まない）になるので、中身の見えない A（素の関数の適用の答え `(inc 5)`）に替えた。
	// 片イ（R120）で q の本体 `y 5` は種類の未知な y の後ろに 5 を積む予想で通るので、本体を `$y == $y`（下の HB_BODY と同じ綴り）に替えた。y は中身の見えない
	// A なので、`$y` は先の種類の分からない持ち上げで、値の演算子 `==` の被演算子で G21。名指しする実体の並びは同じ。
	["R25 実体の中の実体で門（前の要素は未定義の名前 zz。前の q の本体は `y 5` で G7）", src(["inc : x ? x + 1", "p : [x ~xs] ? q x", "q : [y] ? $y == $y", "p [(inc 5) (inc 5)]"]), "G21", [["p", "[A…]"], ["q", "A"]]],
	// 括り1つの関数は並び全体を List として受ける（R24）。要素に L が見えるので say は未知で、呼んだ行で G7。
	// 片イ（R120）で `a m m`・`p 1 $inc`（G7）は通る。上の answerPasses へ移した。
	// 括りの関数の部分適用の節は、素の関数の部分適用と同じ門に当たる。合成に入って頭になる形（`pair [1] inc 5`）は、前は G2(b) だったが、
	// `f2 1 g 2` と同じく流れで読む（R36、下の「余りと流れ」の行）。値の後ろの `5 t3 1 2`（2026-10-23 は逆適用の右で G8、`5 f2 1` と同じ、
	// §5 Q5）は、逆適用の廃止（R47）で `5 (t3 1 2)` に決まり、通る側（norevPasses）へ移した。
	// 部分適用で作った実体が門に当たれば、残りを渡して呼んだ行で断る（R25。部分適用の確かめ 2026-10-19 の TG2）。
	// 片イ（R120）で本体 `a 1` は種類の未知な a の後ろに 1 を積む予想で通るので、本体を `$a == $a`（下の HB_BODY と同じ綴り）に替えた。a は `$inc`（中身の
	// 見えない A）なので、`$a` は先の種類の分からない持ち上げで、値の演算子 `==` の被演算子で G21。名指しする実体は同じ。
	["R24 (pair $inc) [2]（部分適用で作った実体の門。前の本体は `a 1` で G7）", src(["inc : x ? x + 1", "pair : [a ~as] [b ~bs] ? $a == $a", "(pair $inc) [2]"]), "G21", [["pair", "A N"]]],
	// 当てた物の違う部分適用を欄で渡すと call の実体は別なので、m1 の実体を先に作っても、m2 の行は m2 の形で門に当たる
	// （部分適用の確かめ 2026-10-19 の TG1）。片イ（R120）から PAIR_GATE の本体は `$a == $a`（m1 の a は数で値を読む参照の比べで通り、m2 の a は種類が未知で G21）。
	["R24 当てた物の違う部分適用を欄で渡す（m2 の実体が門。前の s2 は `z : 1` で形 `{z:N} N`。前の本体は `a 1` で G7）", src([...PAIR_GATE, "call m1", "call m2"]), "G21", [["call", "{f:L}"], ["pair", "{a:U} N"]]],
	// 1項の `:` の左と既定値は解かない（R25・P3）ので、名前を付けた部分適用を既定値の中で呼ぶ形も、別名（`p : t`）と同じく
	// 実体が作れず G7（部分適用の確かめ 2026-10-19 の TG5）。片イ（R126）の作る途中の版で外したが、確かめの指摘で戻した（§5 Q85 (j)）。
	["R25 既定値の中で、名前を付けた部分適用を呼ぶ", src(["pair : [a ~as] [b ~bs] ? a + b", "p1 : pair [1]", "o : [x : p1 [2]] ? 5"]), "G7"],
	// 余りの節の後ろの逆適用（前は G12(a)）は、左からの畳み込み（R40）でいちばん上の余りを取って通った（2026-10-24 の R47 からは、後ろの関数が
	// 積まれて通る。下の「左からの畳み込み」）。
	// 本体の根が A でない k > n は、種類の未知な適用の後ろに項が来る形で G2(a)（R40 の読み6。前は G12(b)、§5 Q11）。前は本体の根が L の
	// `tg : [x ~xs] y ? inc` で見ていたが、根が L の実体は G16（R33）なので、根が未知の `[,] y` で見る。
	// 部分適用の残りが多いときも同じ（余りの確かめ 2026-10-19 の TG3）。片イ（R120）で、この2行は上の answerPasses へ移した。
	// 並び全体を受けた未知の節の後ろの関数（前は G2(a)）は、最後の括りが並びの終わりまで受ける（R41）ので合成になり、未知を受けて通る
	// （根なので）。下の「左からの畳み込み」へ移した。
	// 逆適用は、口が1つだけ残った関数ならその口を埋めた（R40 の読み3）。括りの関数 `a : [say] ? say 21`（口は括り1つ）・分解した名前（欄の
	// 関数）の逆適用も、2026-10-23 から通った（前は R12 の形でないので G8。2026-10-24 の R47 からは、値の後ろに積まれる）。下の「左からの
	// 畳み込み」へ移した。穴は今までどおり素の関数だけ。
	["R16 a !_（括りの関数に穴）", src([...IO, "a !_"]), "G5"],
	// 数でない物は持ち上げない（R24 の「数」は字面と、それに値の印・値の演算子を当てた物だけ）。
	// 前置 `!` は数を保たない：`!_` は恒等射（穴、§3.5）なので、`!(1 < 0)` は関数になりうる。数と読むと `h 5` を黙って構築と読む。
	// 番地の字面（`0x…`・`NxHHHH`）は数でない（数の確かめ 2026-10-19 の F1）。§2 の字面の行は番地を数と別に挙げ、型は `$` の
	// 番地と同じ Address なので、`$` の番地と同じく中身の見えない A。
	// R26 は x の形を「R24 の構造体か List」と書くので、数そのものからは引かない（数の確かめ 2026-10-19 の F2。`[x]≅x` から
	// 引けると読むかは決めていない）。
	// 中身の見えない A に値の印・値の演算子を当てても数にならない。値の演算子は両辺が数のときだけ数（数の確かめ 2026-10-19
	// の F5・F6）。
	// 片イ（R120）で、ここの「数でない」行（G7）は通る。数と読まないことは根の種類（未知）で見る（上の answerPasses へ移した）。
	// 2026-10-25 の R60（`$` は Reader と Writer を作る接頭辞）から、`$inc + 1` は Reader を値の演算子に当てる形で、項の所で G7（§5 Q59）。前は `$inc + 1` が
	// 中身の見えない A で、f の実体の本体で G7（実体 `[["f", "A"]]`）だった。数にならないこと（この行の元の狙い）は変わらない。
	["R24 $ の番地と数の値の演算子（R60 から項の所で G7、§5 Q59）", src(["inc : x ? x + 1", X1, "f $inc + 1"]), "G7"],
	// 数と中身の見えない A は別の実体（鍵が N と A。数の確かめ 2026-10-19 の F7）。数の実体を先に作っても、適用の結果を渡した
	// 行は数の答えに化けない。行の順を入れ替えても同じ所で断る。片イ（R120）で、この2行は上の answerPasses へ移した（根の種類で見る）。
	// 形を変えながら自分を呼び続ける再帰は、実体が有限に収まらないので断る。
	["R24 形が深くなり続ける再帰", src(["f : [x ~xs] ? f [xs xs]", "f [1 2]"]), "G7"],
	// R26 の外の鍵で引いた物は未知なので、並びでは G7。片イ（R120）から通る（上の answerPasses へ移した）。
	// 行に関数が見えるブロックは、括りと同じく要素に L が見えるので名前は未知。片イ（R120）から通る（上の answerPasses へ移した）。
	// 合成の頭に置いても、括りの関数の本体の門と G12(b) はすり抜けない（Q24 の案1）。
	// 門に当たる本体は、2026-10-26 の R28 の書き直し（末尾の `_` は消える）で、前の `[+ 1] _ _`（`[+ 1]` になって G16）から、内側の `_` で G5 に当たる
	// `[+ 1] _ 1` に替えた（この節の下の Q25 の2行と、確かめの BAD・bb も同じ。門に当たる本体を置く目的は同じ）。
	// 2026-10-28 の R105（値の口の書いた `_` は消える）で `[+ 1] _ 1` は `[+ 1] 1` になって門に当たらないので、括りの関数に穴 `!_` を書いて G5 に当たる
	// `[[g5] ? g5] !_ 1` に替えた（試験の一式で、門に当たる本体の見本は全部同じに替えた。門は G5 のまま）。
	["Q24 bad inc [1 2]（本体の門は呼んだ行で）", src(["inc : x ? x + 1", "bad : [x ~xs] ? [[g5] ? g5] !_ 1", "bad inc [1 2]"]), "G5", [["bad", "[N…]"]]],
	// 片イ（R120）で `tg inc 1 2 3`（G2(a)）・`inc h2 [5 6 7]`（G7）は通る。上の answerPasses へ移した。
	// 合成の後ろの部分適用でも、本体の根が A でなければ A に数えない（Q26 は根が A のときだけ）。
	// 前は根が L の `pq : x y ? inc` で見ていたが、根が L の関数は G16（R33）なので、根が未知の `[,] y` で見る。
	// 後ろの部分適用の後ろに根が A でない部分適用があれば未知（後ろの全部を見る）。確かめ 2026-10-19 の T3。
	// 片イ（R120）で、Q26 の2行は G2(a) で断らず、上の answerPasses で根の種類（未知）を見る。
	// 余りの印は後ろに素の部分適用があっても残る（G12(a)）。確かめ 2026-10-19 の T2。2026-10-23 から、余りの後ろの逆適用はいちばん上の
	// 余りを取って通る（R40）ので、`inc (pr 1) 5 6 inc` は下の「左からの畳み込み」へ移した。
	// 穴と穴の部分適用の `… 5 inc` は、合成を適用の畳み込みにして通る側（上の「法則で変わった」の行）へ移した。
	// 仮置きが外れる再帰の部分適用は未知、隣と結べば G2(a)。確かめ 2026-10-19 の F3。2026-10-26 の R76 から、行 `⇥inc` は `_` で仮置きが外れないので、行の根が
	// 未知の `⇥[,] y` で見る（前の綴りは「R73〜R79」の節で通る）。
	// 片イ（R120）で `r2 1 2 inc` も上の answerPasses へ移した。
	// 形が枝ごとに増える再帰は、深さの上限の内でも実体が 2^深さ になる（上限が無いと解決が止まらなかった。確かめ 2026-10-20）。
	// 最初の枝を深さ優先で降りると、形が1回に2段ずつ深くなって深さの門に当たるので、最後の木はそこで呼んだ行ごと断る形で、その
	// 手前の残りの枝の実体は最後の木に無い（確定した実体に数えない。resolve.js の INSTANCE_DEPTH_MARGIN の注の2）。根の種類を解く所の
	// 増え方は資源の守り（作った実体の数か入れ子の数、注の3・4）で止まる。最後の木の門（深さの G7）は、守りに当たった答えを読んだ所（汚れた
	// 計算、注の5）で出るので作り物と見分けられず、資源の守りを言う（refusalOf）。前は作った実体の全部を数えた総数の G7 だった。
	["Q25 枝ごとに形が増える再帰（合成の頭の引き）", src(["g : [x ~xs] ? ([' 0] g [[a : xs] [a : xs]]) , ([' 0] g [[b : xs] [b : xs]])", "g [1 2]"]), "instance-work-limit"],
	["Q25 枝ごとに形が増える再帰（直接）", src(["g : [x ~xs] ? (g [[a : xs] [a : xs]]) , (g [[b : xs] [b : xs]])", "g [1 2]"]), "instance-work-limit"],
	// 門に当たる実体を呼んだ後ろで作った実体は、最後の木に無いので確定した実体に数えない（確かめ 2026-10-20 の反証）。t の本体は
	// bad の実体の門（G5）の後ろで p の実体を作る。数えると、p の呼び出し 512 個の行が t の行より先なら総数の G7、後なら G5 に
	// 割れた（前の版も割れた）。今はどの並べ方でも G5。
	["Q25 門に当たる実体の後ろの実体は数えない（行が先）", src(["p : [s] ? 1", "bad : [y] ? [[g5] ? g5] !_ 1", PS_LINE(512), "t : x ? (bad [y : 1]) , (p [m : 1])"]), "G5", [["bad", "{y:N}"]]],
	["Q25 門に当たる実体の後ろの実体は数えない（t が先）", src(["p : [s] ? 1", "bad : [y] ? [[g5] ? g5] !_ 1", "t : x ? (bad [y : 1]) , (p [m : 1])", PS_LINE(512)]), "G5", [["bad", "{y:N}"]]],
	// 総数と作った実体の数の両方に当たるファイルは、どちらから先に当たっても総数を言う（守りに当たった `?` だけを止めるので、
	// 両方とも見つかる。全部を止めると、先に当たった方を言った。確かめ 2026-10-20）。
	["Q25 総数と作った実体の数の両方（総数が先の行）", src(["p : [s] ? 1", `a : ${PS_LINE(513)}`, GROW_SELF, "v : g [1 2]"]), "G7", [["p", ""]]],
	["Q25 総数と作った実体の数の両方（作った実体の数が先の行）", src(["p : [s] ? 1", GROW_SELF, "v : g [1 2]", `a : ${PS_LINE(513)}`]), "G7", [["p", ""]]],
	// 本体が門に当たる実体だけで作った実体の数の守りに当たる形は、最後の木の門（最初の hb の本体の G7）を言う。資源の守りより
	// 行の門を先に言い（refusalOf）、守りに当たって実体を作らせなかった行の断りより、ほかの行の断りを先に覚える（確かめ
	// 2026-10-20 の反証。前は資源の守りの名前を言うか、行の順で割れた）。
	["Q25 門に当たる実体だけで作った実体の数の守りに当たる（本体は片9b で HB_BODY）", src([HB_BODY, `v : ${HB_GATED(1025)}`]), "G7", [["hb", "{k0:N} {z:N}"]]],
	["Q25 門に当たる実体と通る実体で作った実体の数の守りに当たる（通る行が先。本体は片9b で HB_BODY）", src([HB_BODY, HB_PASS(500), `v : ${HB_GATED(600)}`, "inc : x ? x + 1"]), "G7", [["hb", "{k0:N} {z:N}"]]],
	// 資源の守りで未知になった根から出た門は作り物かもしれないので、資源の守りを言う（汚れ、resolve.js の INSTANCE_DEPTH_MARGIN の
	// 注の5）。fz の根は入れ子の数の守り（欄 7 つの並べ替え）に当たって未知で、`fz 5 inc` の G2(a) はそこから出る（確かめ 2026-10-20 の3回目）。
	["Q25 資源の守りで未知になった根から出た門より資源の守りを言う", src([...PERM(7).map((l) => (l.startsWith("r [") ? `fz : x ? ${l}` : l)), "inc : x ? x + 1", "fz 5 inc"]), "instance-nest-limit", [["r", ""]]],
	// 前段の門でない断り（素の関数の本体の字下げのブロックの置き場所）でも止めないので、総数を超えるかは定義の順に依らない
	// （確かめ 2026-10-20 の3回目。前は t が g より先なら indent-block-position）。
	["Q25 前段の門でない断りと総数（t が先）", src(["p : [s] ? 1", "inc : x ? x + 1", "t : a ?", "\ta", "\tinc", " 5", "", `g : x ? ${PS_LINE(513)}`]), "G7", [["p", ""]]],
	["Q25 前段の門でない断りと総数（g が先）", src(["p : [s] ? 1", "inc : x ? x + 1", `g : x ? ${PS_LINE(513)}`, "t : a ?", "\ta", "\tinc", " 5", ""]), "G7", [["p", ""]]],
	// 書いた深さ（writtenDepth）を数える所でスタックが溢れても、内部の例外にしない（確かめ 2026-10-20 の6回目。前は値の定義の
	// 鎖を逆順に書くと、名前を辿る再帰が RangeError を投げた。正順なら記録を引くので溢れない）。
	["Q25 値の定義の 10000 個の鎖を逆順に書く", src([...[...Array(10001).keys()].reverse().map((i) => (i ? `v${i} : [a : v${i - 1}]` : "v0 : 1")), "v10000"]), "resolve-stack-limit"],
	// 読む段の名前でない仮引数と使う所の `#` を探す所（checkParamNames・refuseExportMarkUse）で溢れても同じ（2026-11-03 の片イの再確かめ。守りの外にあり、HEAD でも温めた
	// プロセスでは RangeError が出ることがあった。行を指す inRowLine で入れ子1段のフレームが増え、ここで溢れやすくなっていた）。
	["Q25 括りの 20000 段の入れ子", src(["zq : 5", `v : ${"[".repeat(20000)}1${"]".repeat(20000)}`]), "resolve-stack-limit"],
	// 同じ形で自分を引いてから枝ごとに形が増える再帰：後ろの実体はどれも g の仮置きに頼って作るので、根の種類を解く所では確定した
	// 実体に数えず、作った実体の数の守り（資源の守り、注の3）で止まる。上と同じく、資源の守りを言う。
	["Q25 同じ形で自分を引いてから枝ごとに形が増える再帰", src(["g : [x ~xs] ? (g xs) , (g [[a : xs] [a : xs]]) , (g [[b : xs] [b : xs]])", "g [1 2]"]), "instance-work-limit"],
	// 欄の並べ替え（輪と入れ替え）で形が深くならないまま、同じ関数の実体が長く入れ子になる再帰（欄 7 つで 5040 通り）。前の深さの
	// 守り（同じ `?` の実体の入れ子 32）を外した後、守りが無いと内部の例外（スタックの溢れ）だった（2026-10-20）。解いている途中の
	// 再帰の入れ子が 256 を超えるので、入れ子の数の守り（資源の守り、INSTANCE_DEPTH_MARGIN の注の4）で断る。
	["Q25 欄 7 つの並べ替えの再帰", src(PERM(7)), "instance-nest-limit"],
	// 関数を跨いで同じ並べ替えを呼び合う再帰（r0 → r1 → r2 → r3 → r0）は、関数ごとの数では止まらず、解いている途中の実体の
	// 入れ子が JS のスタックを溢れさせた（確かめ 2026-10-20）。入れ子の数の守り（資源の守り、注の4）で断る。
	["Q25 欄 7 つの並べ替えを4つの関数で呼び合う再帰", src(PERM_RING(7, 4)), "instance-nest-limit"],
	// §5 Q28 の解き直し（2026-10-20）で、外れた仮置きに頼った答えに古いと印を付ける所（resolve.js の「仮置きの記録」の注）。
	// どれも、印が欠けると、この並べ方で呼ぶ行が黙って A になる（確かめ 2026-10-20）。ほかの並べ方でも同じ答えなのは、法則の
	// 試験（coproduct_laws.test.js の Q28_REFUSE_FORMS）が見る。値の定義の記録の行は、値を含む輪なので、§5 Q30（2026-10-20）
	// から name-cycle で断る。
	// 注の2（F1）：当たった枠の名簿の答えは、その枠が頼った仮置きを引き継ぐ。h のブロックの最後の行の根が未知なので h は
	// 未知、f の行 `h x` も未知なので f も未知、g = f x も未知。2026-10-26 の R76（§5 Q37 の答え）で、前の行 `⇥inc` は `_` になって h が A に決まり、
	// この仕組みを通らなくなったので、根が未知の行 `⇥[,] x` にした（HEAD でも同じ答え。前の綴りは「R73〜R79」の節で通る）。下の2行も同じ。
	// 片イ（R120）で G2(a) は廃止し、Q28 の3行は上の answerPasses で根の種類（未知）を見る。
	// 括りの関数の実体の根が未知に解き直されることを、前は隣の inc と結ぶ G2(a) で見ていた。2026-10-23 から hb の最後の括りは並びの終わり
	// まで受ける（R41）ので inc は合成され、未知を受けて通る。根の種類（未知）で見る行を、下の「左からの畳み込み」へ移した。
	// 注の3（Q28V-3）：例外で抜けた枠の仮置き。w の既定値の `v 2` から v → h と解き、h の行 `w` が名前の輪で抜ける（namesPattern
	// が握りつぶす）。k の根は h の根で未知。この輪は既定値を覗いた所（w → v）を通るので、種類の輪ではなく（既定値は解かない、
	// P3）、§5 Q30 でも断らない（resolve.js の namesPattern の注）。
	// 無名の関数の解き直し（collectedRoot、Q28V-5）：外の枠（f1）がまだ解いている途中なら、その仮置きにも頼る。g の根＝hh の
	// 実体の根＝無名の関数の根＝f1 の根で、未知。
	// 値の定義の記録も解き直す（freshMemo、Q28V-4）形。v の値は f 1 で、f の本体の行 `v` が v を引く。前は、v を a より先に
	// 置くと名前の輪（name-cycle）、a を先に置くと f の仮置きで輪が閉じ、v は f の未知を受けて G7 に割れた（§5 Q30）。この輪は
	// 値を含む（v → f の本体 → v）ので、2026-10-20 から、どの並べ方でも name-cycle で断る（下の「§5 Q30」の行）。
	["Q28 値の定義が外れた仮置きに頼る（a が v より先）", src(["inc : x ? x + 1", "a : f 1", "v : f 1", "f : x ?", "\tv", "\tinc", "", "v inc"]), "name-cycle"],
	// 実体の深さの守り：上限は（32 × 書いた括りの関数の数（2026-10-26 から実体を作る素の関数も） + 1）× 書いたいちばん深い形で、解く前にソースから
	// 決める（resolve.js の INSTANCE_DEPTH_MARGIN の注の1、writtenDepth）。形が深くなり続ける再帰は、書いた形が浅ければ深さの門で、上限が大きければ入れ子の数の守りで断る。
	// 鍵の深さは、閉包が書いた所の実体の鍵まで見る（fnDepth）。形の綴りはどれも {s:L} だが、欄に入れた関数は書いた所（前の実体の
	// 中）の鍵を持つので、鍵は1段ずつ深くなる。数えないと、どれも止まらなかった（綴りが同じでも鍵は違う）。
	// 2026-10-26 の R81 の確かめの直しから、上限は実体を作る素の関数（ここでは inc と閉包の `[y ? s y]`）も数えるので上がり、先に入れ子の数の守りで断る（前は G7）。
	["深さ 閉包が前の実体の中で書かれる再帰（素の関数）", src(["inc : x ? x + 1", "f : [s] ? f [s : [y ? s y]]", "f [s : inc]"]), "instance-nest-limit"],
	["深さ 閉包が前の実体の中で書かれる再帰（括りの関数）", src(["inc : x ? x + 1", "f : [s] ? f [s : [[x] ? s x]]", "f [s : inc]"]), "instance-nest-limit"],
	["深さ 部分適用に前の欄を当てる再帰", src(["inc : x ? x + 1", "pp : [a] [b] ? 1", "f : [s] ? f [s : pp [s : s]]", "f [s : inc]"]), "G7"],
	// 形が1段ずつ深くなる再帰は、別の所に深い形を書いても（上限が上がっても）断る。
	["深さ 形が1段ずつ深くなる再帰", src(["f : [x ~xs] ? f [xs xs]", "f [1 2]"]), "G7"],
	["深さ 形が1段ずつ深くなる再帰（別の所に 40 段の字面）", src(["f : [x ~xs] ? f [xs xs]", `w : ${NEST(40)}`, "f [1 2]"]), "instance-nest-limit", [["f", ""]]],
	// 上限が大きい（書いた形が深いか、括りの関数が多い）と、1段ずつ深くなる再帰は、深さの門より先に入れ子の数の守り（再帰の
	// 入れ子 256）に当たる。断るのは変わらない（確かめ 2026-10-20 の4回目）。
	["深さ 形が1段ずつ深くなる再帰（別の所に 200 段の字面）", src(["f : [x ~xs] ? f [xs xs]", `w : ${NEST(200)}`, "f [1 2]"]), "instance-nest-limit", [["f", ""]]],
];
for (const [name, s, want, kind, extra] of answerPasses) checkPass(`答え ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of answerRefused) checkRefused(`答え ${name}`, s, want, inst);

// ---- 法則（期待値ではなく、同じ射の綴りどうしを比べる） ----

const law = (name, test) => {
	total++;
	try {
		const problems = test();
		if (problems.length) fail(`法則 ${name}`, ...problems);
		else ok(`法則 ${name}`);
	} catch (e) {
		fail(`法則 ${name}`, `断られた: ${e.reason || e.name} ${e.gate || ""} ${e.message}`);
	}
};
const lastKind = (s) => {
	const r = resolve(s);
	return kindOf(r.trees[r.trees.length - 1]);
};
const instCount = (s, at) => (show(resolve(s).trees[at]).match(/\(inst /g) || []).length;

// R24・R26：IO Reader Writer の a・b・c は同じ射（3つとも 42）なので、m に当てた種類は同じで、どれも A。
law("a m・b m・c m は同じ種類（A）", () => {
	const ks = ["a m", "b m", "c m"].map((line) => lastKind(src([...IO, line])));
	return ks.every((k) => k === "A") ? [] : [`種類 got: ${ks.join(" ")}  want: A A A`];
});
// R26：点なしの [' k] は x ' k と同じ射なので、[' k] x と x ' k は同じ種類（A・L・未知のどれでも）。
// 2026-10-23 から、根に残った未評価のラムダは `_`（R42、木では `(unit …)` で包む）なので、根で包んだ物は包みの中の種類で比べ、
// 包んだことも比べる（どちらか一方だけが包まれたら食い違い）。
law("[' k] x と x ' k は同じ種類", () => {
	const lastKind = (s) => {
		const r = resolve(s);
		const t = r.trees[r.trees.length - 1];
		return t.t === "unit" ? `${kindOf(t.inner)}（根で _）` : kindOf(t);
	};
	const pairs = [
		[std("[' 0] vs"), std("vs ' 0"), "A"],
		// 片イ（R123）で STD の fs は `$inc , $double , 3` で、要素は番地（値）なので A（前は未知）。
		[std("[' 0] fs"), std("fs ' 0"), "A"],
		[src([...M, "[' say] m"]), src([...M, "m ' say"]), "L（根で _）"],
		[src([...M, "[' other] m"]), src([...M, "m ' other"]), "A"],
		[src([...M, "([' say] m) 21"]), src([...M, "(m ' say) 21"]), "A"],
		[src([...MY_GREET_STR, "[' greet] myGreet"]), src([...MY_GREET_STR, "myGreet ' greet"]), "A"],
		[src([...MY_GREET_FN, "([' welcome] ([' greet] myGreet)) 5"]), src([...MY_GREET_FN, "(myGreet ' greet ' welcome) 5"]), "A"],
	];
	const out = [];
	for (const [p, q, want] of pairs) {
		const kp = lastKind(p);
		const kq = lastKind(q);
		if (kp !== kq || kp !== want) out.push(`${p.split("\n").pop()}: ${kp}  ${q.split("\n").pop()}: ${kq}  want: ${want}`);
	}
	return out;
});
// R24：同じ形なら同じ実体。2か所から（並びの行と、素の関数の本体から）呼んでも、長さの違う List や文字列で呼んでも1つ。
law("同じ形で2か所から呼んでも実体は1つ", () => {
	const out = [];
	const n1 = instCount(src([...IO, "a m", "p : v ? a m", "a m"]), 1);
	if (n1 !== 1) out.push(`a の実体の数 got: ${n1}  want: 1`);
	const n2 = instCount(src([REC, "f [1 2 3]", "f [4 5]", "f `abc`"]), 0);
	if (n2 !== 1) out.push(`f の実体の数 got: ${n2}  want: 1`);
	// 形が違えば別の実体（List と構造体）。
	const n3 = instCount(src([...M, "k : [x ~xs] ? 1", "k m", "k [1 2]"]), 1);
	if (n3 !== 2) out.push(`k の実体の数 got: ${n3}  want: 2`);
	return out;
});
// R24：同じ綴り {say:L other:N} でも、本体の根が違う関数を渡したら別の実体（鍵に関数の出どころが入る）。m3 の say は
// 本体の根が未知（`[,] x`）なので、`say 21` は未知になる。m の実体を先に作っても、m3 の答えが m の答えに化けない。前は本体の
// 根が点なし（L）の `say : x ? [+ x]` で見ていたが、根が L の関数は G16（R33）になった。
law("本体の根が違う関数は別の実体", () => {
	const M3 = ["m3 :", "\tsay : x ? [,] x", "\tother : 1", ""];
	const out = [];
	const s = src([...M, ...M3, "a : [say] ? say 21", "a m", "a m3"]);
	const k3 = lastKind(s);
	if (k3 !== "未知") out.push(`a m3 の種類 got: ${k3}  want: 未知`);
	const n = instCount(s, 2);
	if (n !== 2) out.push(`a の実体の数 got: ${n}  want: 2`);
	const alone = lastKind(src([...M3, "a : [say] ? say 21", "a m3"]));
	if (alone !== k3) out.push(`m3 だけのファイルと種類が違う: ${alone} と ${k3}`);
	return out;
});
// R25：呼ぶ行を定義の前に置いても後に置いても、全部の木と診断が同じ（行の順は違うので、並べ替えて比べる）。
law("呼ぶ行を定義の前に置いても後に置いても、全部の木が同じ", () => {
	// 2026-10-28 の片9b：a の本体は前は `say zz`（未定義の名前 zz を値の口に）。R111・R112 で zz は値の口の `_` で消え、本体の根に say が残る G16 になるので、
	// 未定義の名前を括りの中に置いた `say [zz 7]`（括りの中の値の隣は今のまま、§5 Q83。知らせ undefined-name は残る）に替えた。
	const defs = [...M, "a : [say] ? say [zz 7]", REC, "c : [~rest] ? (rest ' say) 21"];
	const calls = ["a m", "f [1 2 3]", "f `ab`", "c m", "outer : v ? [[say] ? say v] m"];
	const look = (s) => {
		const r = resolve(s);
		return {
			trees: r.trees.map((t) => `${show(t)} : ${kindOf(t)}`).sort(),
			diag: r.diagnostics.map((d) => `${d.reason}/${d.name}`).sort(),
		};
	};
	const after = look(src([...defs, ...calls]));
	const before = look(src([...calls, ...defs]));
	const out = [];
	if (JSON.stringify(after.trees) !== JSON.stringify(before.trees)) out.push(`後: ${after.trees.join(" | ")}`, `前: ${before.trees.join(" | ")}`);
	if (JSON.stringify(after.diag) !== JSON.stringify(before.diag)) out.push(`診断 後: ${after.diag}  前: ${before.diag}`);
	if (!after.trees.some((t) => t.includes("(inst {say:L other:N} (apply say [zz 7]))"))) out.push(`a の実体が無い: ${after.trees.join(" | ")}`);
	return out;
});
// R25：呼ばれるまでは defer、呼ぶ行を足すと同じ定義の行が inst になる（定義の行そのものは断らない）。
law("呼ぶ行を足すと defer が inst になる", () => {
	const alone = show(resolve(src([...M, "a : [say] ? say 21"])).trees[1]);
	const called = show(resolve(src([...M, "a : [say] ? say 21", "a m"])).trees[1]);
	const out = [];
	if (alone !== "(: a (? [[say]] (defer {say 21})))") out.push(`呼ばない got: ${alone}`);
	if (called !== "(: a (? [[say]] (inst {say:L other:N} (apply say 21))))") out.push(`呼ぶ got: ${called}`);
	return out;
});
// R24：値の行を並べた字下げのブロックは、同じ行を並べた括りと同じ List（1行が1要素）。同じ関数に渡したら、w の行の
// ほかは木と種類が同じで、断るなら門と名指しも同じ。行は数・構築の並び・文字列・括り・関数、入れ子のブロック（欄の値）。
law("値の行の字下げのブロックと括りは同じ読み", () => {
	const look = (s) => {
		try {
			const r = resolve(s);
			return r.trees.map((t) => `${show(t)} : ${kindOf(t)}`).filter((t) => !t.startsWith("(: w ")).join(" | ");
		} catch (e) {
			return `断り ${e.reason} ${e.gate || ""} ${JSON.stringify((e.instances || []).map((i) => [i.fn, i.shape]))}`;
		}
	};
	// [定義, ブロックの行（`w :` の下）, 括りの綴り, 呼ぶ行, 括りの最後の行の種類か門]
	const pairs = [
		[["f : [x ~xs] ? x 1"], ["\t1", "\t2"], ["w : [1", "\t2]"], "f w", "A"],
		[["f : [x ~xs] ? (x ' 0) 1"], ["\t1 2", "\t3 4"], ["w : [1 2", "\t3 4]"], "f w", "A"],
		[["f : [x ~xs] ? x 1"], ["\t`ab`", "\t`cd`"], ["w : [`ab`", "\t`cd`]"], "f w", "A"],
		[["f : [x ~xs] ? (x ' 0) 1"], ["\t[1 2]", "\t[3 4]"], ["w : [[1 2]", "\t[3 4]]"], "f w", "A"],
		// 片イ（R120）：形の違う要素の List から引いた h は種類の未知な項で、`h 1` は積む予想で通る（前は G7）。
		[["inc : x ? x + 1", "sh : [h ~hs] ? h 1"], ["\tinc", "\t2"], ["w : [inc", "\t2]"], "sh w", "未知"],
		[["g : [k] ? h k", "h : [x ~xs] ? x 1"], ["\tk :", "\t\t1", "\t\t2", "\tother : 3"], ["w : [k : [1", "\t2]", "\tother : 3]"], "g w", "A"],
	];
	const out = [];
	for (const [defs, rows, bracket, call, want] of pairs) {
		const b = look(src([...defs, "w :", ...rows, "", call]));
		const k = look(src([...defs, ...bracket, call]));
		if (b !== k) out.push(`${bracket.join(" ⏎ ")}`, `  ブロック: ${b}`, `  括り: ${k}`);
		const got = k.startsWith("断り") ? k.split(" ")[2] : k.split(" : ").pop();
		if (got !== want) out.push(`${bracket.join(" ⏎ ")} の括り got: ${got}  want: ${want}`);
	}
	return out;
});
// R24：最後の仮引数が括りの関数は、k > n なら前の仮引数に1つずつ当てて、残りの並び全体を最後の括りが1つの List
// として受ける（`f 1 2 3` は `f [1 2 3]`、`map $[* 2] 1 2 3 4 5` は `map $[* 2] [1 2 3 4 5]` と同じ。利用者 2026-10-19
// 「それでいいよ」、続けて「最後の仮引数が括りの関数は、前の仮引数に1つずつ当てて、残りの並び全体を最後の括りが受ける。」）。
// 前の実引数を同じにして、残りの値の並び（項が全部 A）を並びで渡しても括って渡しても、呼ぶ行の木のほかは全部の木と
// 種類と診断が同じで、呼ぶ行の種類も同じ。断るなら門と名指しも同じ。関数は括り1つ（n = 1）、前の仮引数が裸か括りの
// n = 2、前の括りが2つで受ける形の違う n = 3（左から1つずつ当てないと実体の形が変わる）。並びには形の混ざった物
// （`1 [2 3]`・`1 $inc` の要素は中身の見えない A）と、4項以上の物も入れる。撒く項（k を数えない）と `_` は R24 の文で
// 読みが違うので入れない（上の「答え」の `n vs~ 1` の行）。関数で始まる並び（`f inc 1`）は合成になるので、この法則の外。
law("最後の仮引数が括りの関数に、残りを並びで渡しても括って渡しても同じ読み", () => {
	const DEFS = ["inc : x ? x + 1", ...M, "pt :", "\tk : 1", "\tother : 2", ""];
	// [定義, 前の仮引数に当てる実引数]
	const FNS = [
		[["f : [x ~xs] ? x 1"], ""],
		[["n : [~x] ? x"], ""],
		[["p : [x ~xs] ? q x", "q : [y] ? y 5"], ""],
		[[REC], ""],
		[["s : [h ~hs] ? (h ' 0) 1"], ""],
		[["map : f [x ~y] ? x"], "$inc"],
		[["h : v [x ~xs] ? v 1"], "1"],
		[["pair : [a ~as] [b ~bs] ? a + b"], "[1 2]"],
		[["pf : [say] [x ~xs] ? say x"], "m"],
		[["p3 : [a] [b ~bs] [c ~cs] ? a + c"], "1 [2 3]"],
		[["pm : [say] [b ~bs] [c ~cs] ? say b"], "m [2 3]"],
	];
	const ARGS = ["1 2", "1 2 3 4", "`ab` `cd`", "\\a \\b", "[1 2] [3 4]", "1 [2 3]", "1 $inc", "$inc $inc", "m m", "pt pt", "zz zz", "(inc 1) 2"];
	const look = (s) => {
		try {
			const r = resolve(s);
			const ts = r.trees.map((t) => `${show(t)} : ${kindOf(t)}`);
			ts[ts.length - 1] = `呼ぶ行 : ${kindOf(r.trees[r.trees.length - 1])}`;
			return `${ts.join(" | ")} || ${r.diagnostics.map((d) => `${d.reason}/${d.name}`).sort().join(" ")}`;
		} catch (e) {
			return `断り ${e.reason} ${e.gate || ""} ${JSON.stringify((e.instances || []).map((i) => [i.fn, i.shape]))}`;
		}
	};
	const out = [];
	let nPass = 0;
	let nRefused = 0;
	for (const [fn, front] of FNS) {
		const head = [fn[0].split(" ")[0], front].filter(Boolean).join(" ");
		for (const a of ARGS) {
			const seq = look(src([...DEFS, ...fn, `${head} ${a}`]));
			const br = look(src([...DEFS, ...fn, `${head} [${a}]`]));
			if (seq !== br) out.push(`${head} ${a}`, `  並び: ${seq}`, `  括り: ${br}`);
			if (br.startsWith("断り")) nRefused++;
			else nPass++;
		}
	}
	// 比べる組が全部同じ理由で断られていたら、法則は何も見ていない。
	if (!nPass || !nRefused) out.push(`通る組 ${nPass}・断る組 ${nRefused}（どちらも1つ以上のはず）`);
	return out;
});

// ---------------------------------------------------------------------------
// R24〜R26 の実装の確かめ（2026-10-19、仕様どおりか・反証の2つ）
// ---------------------------------------------------------------------------
//
// 「直した」行は、直す前の実装では黙って通るか、断りすぎるか、行の順で答えが割れていた。「穴」の行は、実装は
// 合っていたが、壊しても落ちる試験が無かった所（変異で確かめた）。「守り」の行は、直す前も通っていて、直しが
// 断りすぎていないこと（中身が全部値の器・1行のブロック・2項の条件）を見る。

// 別々の括りの関数の鎖 p1 → p2 → … → pN（再帰しない）。
const chain = (N) => {
	const ls = [];
	for (let i = 1; i < N; i++) ls.push(`p${i} : [a ~r] ? p${i + 1} r`);
	ls.push(`p${N} : [a ~r] ? a`);
	return ls;
};
const MIX = ["inc : x ? x + 1", "q :", "\tk : inc", "\t5", ""]; // 欄と値の混ざったブロック。中身に関数が見える
const SPREAD_REST = "f : [~r] ? r~";
// f の本体は字下げのブロック（下の「直した 仮置きの上の無名の関数」の注）。2026-10-26 の R76（§5 Q37 の答え：字下げの本体の行は評価する所）で、前の行
// `⇥[z ? hh1 z]`（丸ごとの関数）は `_` になってブロックの根が A に決まり、この道を通らなくなったので、行の根が未知で無名の関数を解く `⇥[,] $[z ? hh1 z]` にした
// （HEAD でも同じ答え。前の綴りは「R73〜R79」の節で通る）。
const AF1 = ["g : [say] ? say 1", "f : [x ~xs] ?", "\t[,] $[z ? hh1 z]", ""];
const AF1_HH1 = "hh1 : y ? (g [say : [w ? f [1 2]]]) y";
const AF1_KK = "kk : y ? f [1 2]";

const checkPasses = [
	// 直した（F1・F5）：別々の関数の 33 段・40 段の鎖は有限で通る（その頃の深さの門は、同じ `?` の実体の入れ子だけを数える
	// 形に直した。2026-10-20 からは鍵の深さで、値だけを渡す鎖は深くならない）。
	["直した 括りの関数の 33 段の鎖", src([...chain(33), "p1 [1 2 3]"]), "(apply p1 [1 2 3])", "A"],
	["直した 括りの関数の 40 段の鎖", src([...chain(40), "p1 [1 2 3]"]), "(apply p1 [1 2 3])", "A"],
	// 直した（F2・F3）：構造体とも List とも読めない器でも、中身が全部値なら `~rest` で撒ける（A）。
	["守り 中身が全部値の混ざったブロックの ~rest を撒く", src(["q0 :", "\tk : 1", "\t5", "", SPREAD_REST, "f q0"]), "(: f (? [[~r]] (inst A r~)))", null, { at: 1 }],
	// 直した（反証 F2）：同じ綴りの括りの関数は答えを共有するが、呼ばれていない方の行は defer のまま（R25）。
	[
		"直した 同じ綴りの呼ばれない関数は defer",
		src([...M, "a : [say] ? say 21", "b : [say] ? say 21", "a m"]),
		"(: b (? [[say]] (defer {say 21})))",
		null,
		{ at: 2 },
	],
	["守り 同じ綴りの関数を呼んだ方は inst", src([...M, "a : [say] ? say 21", "b : [say] ? say 21", "a m"]), "(: a (? [[say]] (inst {say:L other:N} (apply say 21))))", null, { at: 1 }],
	["直した 括った ? を呼んでも、同じ綴りの名前の定義は defer", src([...M, "a : [say] ? say 21", "v : [[say] ? say 21] m"]), "(: a (? [[say]] (defer {say 21})))", null, { at: 1 }],
	// 穴（F4 (a)）：中身の見えない A の `~rest` は A。数の字面は 2026-10-19 から R24 の数（`~rest` は数の List）になった
	// ので、中身の見えない A は `$` の番地で見る（数の確かめ 2026-10-19 の F3。`ro 5` だけでは、この枝を壊しても落ちない）。
	["穴 ro $inc の ~rest は A", src(["inc : x ? x + 1", "ro : [~r] ? r 1", "ro $inc"]), "(: ro (? [[~r]] (inst A (construct r 1))))", null, { at: 1 }],
	["穴 ro $inc", src(["inc : x ? x + 1", "ro : [~r] ? r 1", "ro $inc"]), "(apply ro $inc)", "A"],
	["穴 ro 5 の ~rest は数の List",src(["ro : [~r] ? r 1", "ro 5"]), "(: ro (? [[~r]] (inst N (construct r 1))))", null, { at: 0 }],
	["穴 ro 5", src(["ro : [~r] ? r 1", "ro 5"]), "(apply ro 5)", "A"],
	// 穴（F5 (e)）：`[' 0]` に2項は、`x ' k` の形でないので未知の根だった。2026-10-26 の R77（§5 Q39 の答え：口1つ）から、`([' 0] vs) 5` で、引いた 1 の後ろに 5 を
	// 積む（R35）。
	["穴 [' 0] vs 5（R77 で口1つ。前は k = 2 で未知）", src(["vs : 1 , 2", "[' 0] vs 5"]), "(construct (apply [' 0] vs) 5)", "A"],
	// 読まない所（既定値）に括りの関数を1項で書いただけ（値として書いた）なら、呼んでいないので断らない。
	// 寄せ1（R128、2026-11-04）から本体の枝の条件は1項でも `&` の左と同じに解く（P3 を変えた）ので、1項の条件に書いた括りの関数は評価する所に残った関数で
	// `_`（細目4。知らせは `&` の左に置いた時と同じ leftover-lambda）。前は読まない所で `(: [t] 1)`。
	["守り 既定値に括りの関数を値として書く", src(["inc : [x] ? x + 1", "ff : [z : inc] ? z"]), "(: ff (? [[z : inc]] z))", null],
	["1項の条件に括りの関数を値として書く（寄せ1 から `_`）", src(["t : [a ~r] ? 5 a", "u : x ?", "\t(t) : 1", "\t2", ""]), "(: u (? [x] (block (: (unit [t]) 1) 2)))", null, { leftoverDiag: ["[t]"] }],
	// 寄せ1（R128）から1項の条件も解いて実体を作るので、条件の中で括りの関数を呼ぶ形は通る（§5 Q85 (j) の枝の条件の分が閉じた。前は読まない所で実体が作れず
	// G7、下の checkRefusedRows にあった）。実体が作られたことは t の定義の行の木（`inst [N…]`）で見る。
	["寄せ1 1項の条件の中で括りの関数を呼ぶ（前は G7）", src(["inc : x ? x + 1", "t : [a ~r] ? 5 inc 3 inc", "u : x ?", "\t(t [1 2]) : 1", "\t2", ""]), "(: u (? [x] (block (: [t [1 2]] 1) 2)))", null],
	["寄せ1 その条件で t の実体が作られる", src(["inc : x ? x + 1", "t : [a ~r] ? 5 inc 3 inc", "u : x ?", "\t(t [1 2]) : 1", "\t2", ""]), "(: t (? [[a ~r]] (inst [N…] (construct 5 (apply inc 3) (unit inc)))))", null, { at: 1 }],
	["寄せ1 1項の条件の中で括りの関数の別名を呼ぶ（前は G7）", src(["inc : x ? x + 1", "t : [a ~r] ? 5 inc 3 inc", "p : t", "u : x ?", "\t(p [1 2]) : 1", "\t2", ""]), "(: u (? [x] (block (: [p [1 2]] 1) 2)))", null],
	["寄せ1 1項の条件の中の括った ?（前は G7）", src([...M, "u : x ?", "\t([[a] ? a 1] m) : 1", "\t2", ""]), "(: u (? [x] (block (: [[[a] ? a 1] m] 1) 2)))", null],
	// 括った `?` を呼ばずに1項の条件に書いた物は、評価する所に残った関数で `_`（細目4）。
	["寄せ1 1項の条件の中の関数の本体で括りの関数を呼ぶ（前は G7）", src(["inc : x ? x + 1", "t : [a ~r] ? 5 inc 3 inc", "u : x ?", "\t([q ? t [q q]]) : 1", "\t2", ""]), "(: u (? [x] (block (: (unit [[q ? t [q q]]]) 1) 2)))", null, { leftoverDiag: ["inc", "[[q ? t [q q]]]"] }],
	// 字下げのブロックでも、1行なら中の行の形（構築の並びは List）。
	["守り 1行の字下げのブロックは中の行の形", src(["sh : [x ~xs] ? x 1", "w :", "\t1 2", "", "sh w"]), "(apply sh w)", "A"],
	// 片イ（R123、2026-11-03）：`inc , vs~` の inc は `,` の被演算子に丸ごと残った関数で `_`（leftover-lambda）なので、fs2 の中身は vs の値だけで、撒いても
	// 関数は見えない（前は G7）。
	["直した 撒く項を含む並びの ~rest を撒く（片イの R123 で inc は `_`）（前は G7）", src(["inc : x ? x + 1", "vs : 1 2", "fs2 : inc , vs~", "g : [x ~xs] ? 5 xs~", "g fs2"]), "(apply g fs2)", "A", { leftoverDiag: ["inc"] }],
	// 片イ（R120）：仮置きの上の無名の関数の2行は、hh1 の行の G7 で断らず、hh1 の本体の根の種類（未知）で見る（F1 の直しを戻して仮置きの答えが残れば
	// 根が変わる）。f の中の行は、本体の根が括った `?`（裸の関数）なので R125 で `_` を返し、bare-function-return を知らせる（前は G7）。
	["直した 仮置きの上の無名の関数（kk が先）（前は G7）", src([...AF1, AF1_KK, AF1_HH1]), "(construct [g [say : [w ? f [1 2]]]] y)", "未知", { body: true }],
	["守り 仮置きの上の無名の関数（hh1 が先。直す前も G7。hh1 の行を見る）（前は G7）", src([...AF1, AF1_HH1, AF1_KK]), "(construct [g [say : [w ? f [1 2]]]] y)", "未知", { body: true, at: -2 }],
	["直した 仮置きの上の無名の関数（f の中）（前は G7）", src(["g : [say] ? say 1", "f : [x ~xs] ? [z ? (g [say : [y ? f [1 2]]]) z]", "f [1 2]"]), "(apply f [1 2])", "A", { severities: ["information/bare-function-return"] }],
	// 片イ（R120）：裸の仮引数・行の混ざったブロック・入れ子の分解・形の違う要素の List から引いた物は種類の未知な項のままで、後ろの項は積む予想で通る。
	// 引いた物が中身の見えない A なことは根の種類（未知）で見る。
	["穴 裸の仮引数から引く（前は G7）", src([...M, "mp : f [x ~y] ? (f ' say) 1", "mp m [1 2]"]), "(apply mp (construct m [1 2]))", "未知"],
	["穴 行の混ざったブロックは構造体でない（前は G7）", src(["inc : x ? x + 1", "sa : [say] ? say 21", "w :", "\tsay : inc", "\t5", "", "sa w"]), "(apply sa w)", "未知"],
	["穴 入れ子の分解の名前は未知（前は G7）", src(["nd : [[a b] c] ? a 1", "nd [[1 2] 3]"]), "(apply nd [[1 2] 3])", "未知"],
	["穴 形の違う要素の List から引く（前は G7）", src(["f : [x ~xs] ? (x ' 0) 1", "f [[1 2] 3]"]), "(apply f [[1 2] 3])", "未知"],
];
const checkRefusedRows = [
	// 直した（F2・反証 F3）：行の混ざったブロック・同じ名前の欄・欄の混ざった括り・撒く項を含む並びは、形は中身の見えない
	// A だが中身に関数が見える。`~rest` は中身を持ち越すので、撒けば呼んだ行で G7（直に撒く `q~` と同じ）。
	["直した 混ざったブロックの ~rest を撒く", src([...MIX, SPREAD_REST, "f q"]), "G7", [["f", "A(U)"]]],
	["直した 同じ名前の欄の ~rest を撒く", src(["inc : x ? x + 1", "q3 :", "\tk : inc", "\tk : 5", "", SPREAD_REST, "f q3"]), "G7", [["f", "A(U)"]]],
	["直した 欄の混ざった括りの ~rest を撒く", src(["inc : x ? x + 1", "g : [~r] ? 5 r~", "g [a : inc", "5]"]), "G7", [["g", "A(U)"]]],
	// 撒く項を含む並びの行は、片イ（R123）で inc が `_` になって通る（上の checkPasses へ移した）。
	// 中身の見えない A（`$inc`）の実体を先に作っても、中身に関数の見える器は別の実体（鍵が A(U)）。数の字面は 2026-10-19
	// から数（鍵が N）なので、`f 5` ではこの鍵の分け方を踏まない（数の確かめ 2026-10-19 の F4）。
	["直した f $inc の後の f q", src([...MIX, SPREAD_REST, "f $inc", "f q"]), "G7", [["f", "A(U)"]]],
	// 直した（F3）：1項の `:` の左は解かない（P3）ので、そこで括りの関数を呼ぶと実体が作れない。defer にせず断る。
	// 片イ（R126）の作る途中の版で外したが、枝の条件と既定値は値の段で走るので本体の門が黙って消えると確かめの指摘があり、戻した（§5 Q85 (j)）。
	// 寄せ1（R128、2026-11-04）から本体の枝の条件は1項でも解く（P3 を変えた）ので、条件の中の4行は実体を作って通る（上の checkPasses へ移した）。
	// 既定値（`?` の左）は今のまま解かない（P3）ので、同じ理由で断る（F3 と同じ穴、§5 Q85 (j) の残り）。
	["直した 括りの既定値の中で括りの関数を呼ぶ", src(["inc : x ? x + 1", "t : [a ~r] ? 5 inc 3 inc", "o : [x : t [1 2]] ? 5"]), "G7"],
	["直した 仮引数のブロックの既定値の中で括りの関数を呼ぶ", src(["inc : x ? x + 1", "t : [a ~r] ? 5 inc 3 inc", "o :", "\t\tx : t [1 2]", "\t? 5"]), "G7"],
	// 本体の門が黙って消える形そのもの（片イの確かめの指摘。bad の本体は穴の G5）：括弧の無い2項の条件 `bad [x] : 1` は解いて実体を作るので G5 で、括った1項も G7 で断る。
	// 寄せ1（R128）から括った1項の条件も解いて実体を作るので、2項の条件と同じく実体の本体の門（G5）で断る（§5 Q85 (j) の枝の条件の分が閉じた。前は G7）。
	["寄せ1 1項の条件の中の括りの関数の本体が門に当たる形は G5（前は G7）", src(["bad : [y] ? [[g5] ? g5] !_ 1", "t : x ?", "\t(bad [x]) : 1", "\t2", "", "t 5"]), "G5", [["bad", "A"]]],
	["直した 既定値の中の括りの関数の本体が門に当たる形も G7（片イの確かめ）", src(["bad : [y] ? [[g5] ? g5] !_ 1", "o : [x : bad [1]] ? x", "o 5"]), "G7"],
	// 2項以上の条件は今までどおり解くので、実体の本体の門で名指しする。前の本体 `5 inc 3 inc`（G1）は R37 で通るようになった
	// （2026-10-22）ので、門に当たる本体を `inc 1 2 inc`（G12(a)）にした。
	// 実体の本体の門は、前は G12(a) の `inc 1 2 inc` で見ていた。2026-10-23 からそれは通る（R40）ので、G13 の `inc 1 !_` にした。
	// 2026-10-26 の R69（§5 Q40 の答え）で `inc 1 !_` も通る（閉じた後ろの恒等射）ので、外に値のある `inc 1 !_ 2`（G13 のまま）にした。
	// 本体の門の見本は、2026-10-27 の R89（§5 Q40 の残りの答え）で `inc 1 !_ 2` が `(inc 1) (!_ 2)` で通るようになったので、前から n 個に穴のある `add !_ 1 !_`（G13 のまま）に替えた。
	["守り 2項の条件は実体を作る", src(["inc : x ? x + 1", "add : x y ? x + y", "t : [a ~r] ? add !_ 1 !_", "u : x ?", "\tt [1 2] : 1", "\t2", ""]), "G13", [["t", "[N…]"]]],
	// 直した（反証 F1）：無名の素の関数の本体の根が、外の関数の仮置きの上で決まり、欄として別の実体へ渡っても、仮置きが
	// 外れたら直る。行の順（kk と hh1）に依らず hh1 の行で G7。前の f は `f : [x ~xs] ? [z ? hh1 z]` だったが、実体の本体の根が
	// 裸の関数なので G16（R33）に当たり、F1 の直しを戻しても G16 で断られて、この2行は空振りしていた（確かめ 2026-10-22。
	// `[,] [z ? hh1 z]` も合成で L なので G16）。だから f の本体を字下げのブロックにした：ブロックの本体の根は L にならない（今は、
	// R33 の R の所・§5 Q35）ので G16 に当たらず、前と同じ道（f の実体が仮置きを読まれて外れる）を通る。F1 の直しを戻すと、kk が
	// 先の行が通る（確かめた）。ブロックの本体の根の読みが決まって G16 に当たるようになったら、この2行は別の形に替える。
	// 片イ（R120・R125）で、この3行は上の checkPasses へ移した（hh1 の本体の根の種類と、f の本体の bare-function-return で見る）。
	// 直した（反証 F2）：断る行で使った関数を名指しする（同じ綴りの別の関数が先に実体を作っていても）。
	// 2026-10-28 の片9b：門を作っていた無い欄（`[nope] ? nope 21`）は R115 で `_` になって通るので、本体を欄の関数から引いた物（`(say ' k) 21`）に替えた。
	// 片イ（R120）で `(say ' k) 21` も通るので、本体を `$say + 21`（下の NAMING と同じ綴り。関数を指す番地を値の演算子に置いて G7）に替えた。
	["直した 同じ綴りの関数の名指し（前の本体は無い欄の `nope 21`、その後 `(say ' k) 21`）", src([...M, "a2 : [say] ? $say + 21", "b2 : [say] ? $say + 21", "b2 m", "v : a2 m"]), "G7", [["b2", "{say:L other:N}"]]],
	// 穴（F4 (b)〜(d)）：構造体の `~rest` に受けた欄は残らない／裸の仮引数は A／行の混ざったブロックは構造体でない。
	// `[say ~r] ? r ' say` は 2026-10-28 の片9b（R115）から、r に say が残らないので無い欄の `_` で通る（いちばん後ろの「R111〜R116」の節。r に say が残る壊れ方なら
	// 引いた物が L で、木が `(apply [r ' say] 21)` になって落ちる）。
	// 片イ（R120）で、この2行は上の checkPasses へ移した（根の種類で見る）。
	// 穴（F5 (f)〜(h)）：引いた欄の中身の関数を撒く／入れ子の分解の名前は未知／形の違う要素の List の要素は中身の見えない A。
	// 片イ（R123）で欄の `inc , inc` は両方 `_` になり関数が見えないので、欄の中身を関数そのもの（`fs : inc`）にした。撒けば §5 Q20 の G7。
	["穴 引いた欄の中身の関数を撒く（前の欄は `fs : inc , inc`）", src(["inc : x ? x + 1", "w :", "\tfs : inc", "", "[w ' fs]~ 1"]), "G7"],
	// 入れ子の分解・形の違う要素の List の2行は、片イ（R120）で上の checkPasses へ移した。
];
for (const [name, s, want, kind, extra] of checkPasses) checkPass(`確かめ ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of checkRefusedRows) checkRefused(`確かめ ${name}`, s, want, inst);

// 直した（F1・F5）：鎖の途中の実体を先に作る行があってもなくても、同じ答え（行の順に依らない）。
law("括りの関数の鎖は、途中を先に呼んでも後に呼んでも同じ", () => {
	const look = (s) => {
		try {
			return resolve(s).trees.map((t) => `${show(t)} : ${kindOf(t)}`).sort().join(" | ");
		} catch (e) {
			return `断る ${e.reason} ${e.gate}`;
		}
	};
	const first = look(src([...chain(33), "p20 [1 2 3]", "p1 [1 2 3]"]));
	const last = look(src([...chain(33), "p1 [1 2 3]", "p20 [1 2 3]"]));
	return first === last && !first.startsWith("断る") ? [] : [`途中が先: ${first.slice(0, 200)}`, `途中が後: ${last.slice(0, 200)}`];
});
// 直した（反証 F4）：同じ物を2つの欄に置く構造体（DAG）の鍵は、深さに比例する手間で作る。木として辿ると深さ 24 で
// 10 秒、形が倍々に深くなる再帰は 61 秒の後に内部の例外（文字列の長さの上限）だった。1本 5 秒の上限で見る。
law("欄どうしで同じ物を指す形の鍵は速い", () => {
	const out = [];
	const dag = ["m0 : [z : 1]"];
	for (let i = 1; i <= 24; i++) dag.push(`m${i} : [p : m${i - 1}`, `q : m${i - 1}]`);
	dag.push("g : [p] ? 1", "g m24");
	let t0 = Date.now();
	const r = resolve(src(dag));
	const ms1 = Date.now() - t0;
	if (ms1 > 5000) out.push(`DAG の深さ 24：${ms1}ms`);
	const gLine = show(r.trees[r.trees.length - 2]);
	if (gLine.length > 1000 || !gLine.includes("⋯")) out.push(`形の綴りを切っていない（${gLine.length} 字）`);
	t0 = Date.now();
	let got = "通った";
	try {
		resolve(src(["f : [x ~r] ? f [p : r", "q : r]", "f [z : 1]"]));
	} catch (e) {
		got = `${e.reason} ${e.gate || ""}`;
	}
	const ms2 = Date.now() - t0;
	if (ms2 > 5000) out.push(`倍々の再帰：${ms2}ms`);
	if (got !== "coproduct-unknown-kind G7") out.push(`倍々の再帰 got: ${got}  want: G7`);
	return out;
});
// 直した（部分適用の確かめ 2026-10-19 の F1）：前の部分適用を2つの欄に当てた部分適用の鎖（`q1 : pp [f : q0] [f : q0]`）
// の鍵も、深さに比例する手間で作る。当てた物を葉の文字列に綴ると段ごとに倍になり、22 段で内部の例外（文字列の長さの
// 上限）、呼ぶ行を足すとヒープの上限でプロセスごと落ちた。形が倍々に深くなる再帰は、内部の例外ではなく深さの門（G7）
// で断る。1本 5 秒の上限で見る。
// 書いた 24 段の鎖は、h に渡す鍵の深さが 52 段（q の1段ごとに部分適用と欄で2段）になるが、書いた分なので断らない（深さの上限は
// （32 × 書いた括りの関数の数 + 1）× 書いたいちばん深い形。resolve.js の INSTANCE_DEPTH_MARGIN の注の1。前（深さを固定の 32 にしていた間）は G7）。
const ppChain = (n) => {
	const ls = ["inc : x ? x + 1", "pp : [a] [b] [c] ? a", "q0 : pp [f : inc] [f : inc]"];
	for (let i = 1; i <= n; i++) ls.push(`q${i} : pp [f : q${i - 1}] [f : q${i - 1}]`);
	ls.push("h : [f] ? f [1]", `h [f : q${n}]`);
	return src(ls);
};
law("部分適用を当てた部分適用の鎖の鍵は速い", () => {
	const out = [];
	let t0 = Date.now();
	const r = resolve(ppChain(24));
	const ms1 = Date.now() - t0;
	if (ms1 > 5000) out.push(`部分適用の鎖の深さ 24：${ms1}ms`);
	const hLine = show(r.trees[r.trees.length - 2]);
	if (hLine !== "(: h (? [[f]] (inst {f:L} (apply f [1]))))") out.push(`h の行 got: ${hLine}`);
	t0 = Date.now();
	let got = "通った";
	try {
		resolve(src(["inc : x ? x + 1", "pp : [a] [b] [c] ? a", "g : [f] ? g [f : pp [f : f] [f : f]]", "g [f : inc]"]));
	} catch (e) {
		got = `${e.reason} ${e.gate || ""}`;
	}
	const ms2 = Date.now() - t0;
	if (ms2 > 5000) out.push(`倍々の部分適用の再帰：${ms2}ms`);
	if (got !== "coproduct-unknown-kind G7") out.push(`倍々の部分適用の再帰 got: ${got}  want: G7`);
	return out;
});

// ---------------------------------------------------------------------------
// 分け合った実体の描き方（2026-10-19、反証の続き）
// ---------------------------------------------------------------------------
//
// 同じ綴りの括りの関数（pair と pair2）は実体の答えを分け合う（R25）。直す前は、分け合った実体を使い回すと、その本体の
// 中の呼び出しを、実体を最初に作った側の物（欄の関数）で一度だけ記録していた。だから欄で pair2 を渡した行の分が記録
// されず、どちらの定義の行に inst が出るかが行の順で入れ替わった。値の定義が先に作った実体を別の行が木にすると、門の
// 名指しも作った側の名前になった。直した後は、呼んだ側の物ごとに本体を歩き、呼んだ `?` に inst を描く。

const SAME_PAIRS = ["pair : [a ~as] [b ~bs] ? a + b", "pair2 : [a ~as] [b ~bs] ? a + b"];
const H_PAIR = "h : [f] ? f [1] [2]";
const H_NESTED = "h : [f] ? [[x] ? f x [2]] [1]"; // 実体の本体の中の括った `?` から、欄の関数を呼ぶ
const PAIR_INST = (name, shape) => `(: ${name} (? [[a ~as] [b ~bs]] (inst ${shape} (+ a b))))`;
// 2026-10-28 の片9b：前の本体は無い欄の `[nope] ? nope 21`（R115 で `_` になって通る）。欄の関数から引いた物（`(say ' k) 21`）で門を保った。
// 2026-11-03 の片イ（R120）：`(say ' k) 21` は、種類の未知な引いた物の後ろに 21 を積む予想で通るので、本体を `$say + 21` にした。say は関数の実体で、
// 関数を指す番地を値の演算子 `+` の被演算子に置いて G7（`$` の先の値の演算子の門、ウの片に残る）。
const NAMING = [...M, "a2 : [say] ? $say + 21", "b2 : [say] ? $say + 21", "hh : [f] ? f m"];
const PP2 = ["pp2 : [g] [x] ? g [1] [2]", "k : [f] ? f [9]"];

const sharePasses = [
	["直した 欄で pair・pair2 の順に渡すと pair2 の行も inst", src([...SAME_PAIRS, H_PAIR, "h [f : pair]", "h [f : pair2]"]), PAIR_INST("pair2", "N N"), null, { at: 1 }],
	["直した 欄で pair2・pair の順に渡すと pair の行も inst", src([...SAME_PAIRS, H_PAIR, "h [f : pair2]", "h [f : pair]"]), PAIR_INST("pair", "N N"), null, { at: 0 }],
	["直した 部分適用を欄で渡す（pair が先）", src([...SAME_PAIRS, H_PAIR, "h [f : pair [1]]", "h [f : pair2 [1]]"]), PAIR_INST("pair2", "N [N…]"), null, { at: 1 }],
	["直した 部分適用を欄で渡す（pair2 が先）", src([...SAME_PAIRS, H_PAIR, "h [f : pair2 [1]]", "h [f : pair [1]]"]), PAIR_INST("pair", "N [N…]"), null, { at: 0 }],
	["直した 実体の中の括った ? から呼ぶ（pair が先）", src([...SAME_PAIRS, H_NESTED, "h [f : pair]", "h [f : pair2]"]), PAIR_INST("pair2", "N N"), null, { at: 1 }],
	["直した 実体の中の括った ? から呼ぶ（pair2 が先）", src([...SAME_PAIRS, H_NESTED, "h [f : pair2]", "h [f : pair]"]), PAIR_INST("pair", "N N"), null, { at: 0 }],
	// 部分適用に当てた物の中の関数も、呼んだ物に数える（pp2 の実体を通って pair か pair2 を呼ぶ）。
	["直した 部分適用に当てた欄の関数", src([...SAME_PAIRS, ...PP2, "k [f : pp2 [g : pair]]", "k [f : pp2 [g : pair2]]"]), PAIR_INST("pair2", "N N"), null, { at: 1 }],
	// 値の定義の種類は、行を解く前に出す（実体はそこで作る）。素の関数の本体から pair2 を渡す行が、その実体を使い回す。
	["直した 値の定義が先に作った実体を素の関数の本体が使う", src([...SAME_PAIRS, H_PAIR, "v : h [f : pair]", "p : y ? h [f : pair2]"]), PAIR_INST("pair2", "N N"), null, { at: 1 }],
	["守り 分け合った実体は h の行に1つ", src([...SAME_PAIRS, H_PAIR, "h [f : pair]", "h [f : pair2]"]), "(: h (? [[f]] (inst {f:L} (apply f (construct [1] [2])))))", null, { at: 2 }],
	["守り 呼ばれない pair2 は defer のまま", src([...SAME_PAIRS, H_PAIR, "h [f : pair]"]), "(: pair2 (? [[a ~as] [b ~bs]] (defer {a + b})))", null, { at: 1 }],
];
const shareRefused = [
	// 断る行で書いた関数を名指しする。直す前は、値の定義 v が先に作った実体（欄は a2）で木にしたので、b2 の行で a2 と言った。
	["直した 値の定義が先に作った実体を、別の綴りの関数で呼んで門", src([...NAMING, "hh [f : b2]", "v : hh [f : a2]"]), "G7", [["hh", "{f:L}"], ["b2", "{say:L other:N}"]]],
	["守り 値の定義の行が先なら、その行で名指し", src([...NAMING, "v : hh [f : a2]", "hh [f : b2]"]), "G7", [["hh", "{f:L}"], ["a2", "{say:L other:N}"]]],
];
for (const [name, s, want, kind, extra] of sharePasses) checkPass(`確かめ ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of shareRefused) checkRefused(`確かめ ${name}`, s, want, inst);

// 単位（1つの定義か1つの呼ぶ行。字下げのブロックは1単位）の並べ方。5単位までは全部、それより多ければ回転と、その逆順。
const orders = (units) => {
	const out = [];
	if (units.length <= 5) {
		const go = (rest, acc) => {
			if (!rest.length) out.push(acc);
			rest.forEach((u, i) => go([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, u]));
		};
		go(units, []);
		return out;
	}
	for (let i = 0; i < units.length; i++) out.push([...units.slice(i), ...units.slice(0, i)]);
	return [...out, ...out.map((o) => [...o].reverse())];
};
// R25：行の順を入れ替えても、全部の木・種類・診断が同じ。断るなら門と名指しも同じ。called の関数は、どの並べ方でも
// 定義の行が inst（defer のまま揃っているだけなら、法則は何も見ていない）。
law("分け合った実体があっても、行の順を入れ替えて全部の木・種類・診断・門が同じ", () => {
	const look = (s) => {
		try {
			const r = resolve(s);
			const trees = r.trees.map((t) => `${show(t)} : ${kindOf(t)}`).sort();
			return { text: `${trees.join(" | ")} || ${r.diagnostics.map((d) => `${d.reason}/${d.name}`).sort().join(" ")}`, trees };
		} catch (e) {
			return { text: `断り ${e.reason} ${e.gate || ""} ${JSON.stringify((e.instances || []).map((i) => [i.fn, i.shape]))}`, trees: [] };
		}
	};
	const P = SAME_PAIRS.map((d) => [d]);
	// [名前, 単位, 定義の行が inst になるはずの関数, 断る門（通るなら null）]
	const groups = [
		["欄で渡す", [...P, [H_PAIR], ["h [f : pair]"], ["h [f : pair2]"]], ["pair", "pair2", "h"], null],
		["部分適用を欄で渡す", [...P, [H_PAIR], ["h [f : pair [1]]"], ["h [f : pair2 [1]]"]], ["pair", "pair2", "h"], null],
		["実体の中の括った ? から呼ぶ", [...P, [H_NESTED], ["h [f : pair]"], ["h [f : pair2]"]], ["pair", "pair2", "h"], null],
		["値の定義と素の関数の本体から呼ぶ", [...P, [H_PAIR], ["v : h [f : pair]"], ["p : y ? h [f : pair2]"]], ["pair", "pair2", "h"], null],
		["部分適用に当てた欄の関数", [...P, PP2, ["k [f : pp2 [g : pair]]"], ["k [f : pp2 [g : pair2]]"]], ["pair", "pair2", "pp2", "k"], null],
		["当て方の違う部分適用（括りと数）", [["t3 : [a] [b] [c] ? a + c"], ["t4 : [a] [b] [c] ? a + c"], ["k : [f] ? f [2] [3]"], ["k [f : t3 [1]]"], ["k [f : (t4 1)]"]], ["t3", "t4", "k"], null],
		[
			"門（断る行は1つ）",
			// 2026-10-28 の片9b：門の a2 の本体は前は無い欄の `[nope] ? nope 21`（R115 で `_` になって通る）。欄の関数から引いた物で門を保った。
			// 片イ（R120）で引いた物の `(say ' k) 21` も通るので、`$say + 21`（関数を指す番地を値の演算子に置いて G7。NAMING と同じ）にした。
			[...P, [H_PAIR], ["h [f : pair]"], ["h [f : pair2]"], M, ["a2 : [say] ? $say + 21"], ["hh : [f] ? f m"], ["v : hh [f : a2]"]],
			[],
			"G7",
		],
	];
	const out = [];
	for (const [name, units, called, gate] of groups) {
		const all = orders(units);
		const first = look(src(all[0].flat()));
		for (const o of all.slice(1)) {
			const got = look(src(o.flat()));
			if (got.text !== first.text) {
				out.push(`${name}：並べ方で割れた`, `  ${all[0].map((u) => u[0]).join(" ⏎ ")}`, `    ${first.text}`, `  ${o.map((u) => u[0]).join(" ⏎ ")}`, `    ${got.text}`);
				break;
			}
		}
		if (gate && !first.text.startsWith(`断り ${GATE_REASON[gate]} ${gate} `)) out.push(`${name}：got ${first.text}  want: ${gate}`);
		for (const c of called) {
			const line = first.trees.find((t) => t.startsWith(`(: ${c} (? `));
			if (!line || !line.includes("(inst ") || line.includes("(defer ")) out.push(`${name}：${c} の定義の行が inst でない: ${line}`);
		}
	}
	return out;
});

// ---------------------------------------------------------------------------
// 合成の鍵（2026-10-19、反証の続き）
// ---------------------------------------------------------------------------

// 直した（反証の続き）：合成の鍵も、形と部分適用の鍵と同じく番号に寄せて綴る（canonKey）。同じ部分適用を2つ並べた
// 合成（`c1 : q1 q1`）を当てた部分適用の鎖は、合成の鍵を子の鍵の文字列でつなぐと段ごとに倍になり、24 段で内部の例外
// （文字列の長さの上限）だった。形が倍々に深くなる再帰は、内部の例外ではなく深さの門（G7）で断る。1本 5 秒の上限で見る。
// 部分適用の鎖と同じく、書いた 24 段の鎖は h に渡す鍵の深さが 75 段（1段ごとに合成・部分適用・欄で3段）になるが、書いた分なので
// 断らない（前、深さを固定の 32 にしていた間は G7）。
const ccChain = (n) => {
	const ls = ["inc : x ? x + 1", "pp : [a] [b] [c] ? a", "c0 : inc inc"];
	for (let i = 1; i <= n; i++) ls.push(`q${i} : pp [f : c${i - 1}] [f : c${i - 1}]`, `c${i} : q${i} q${i}`);
	ls.push("h : [f] ? f [1]", `h [f : c${n}]`);
	return src(ls);
};
law("合成を当てた部分適用の鎖の鍵は速い", () => {
	const out = [];
	let t0 = Date.now();
	const r = resolve(ccChain(24));
	const ms1 = Date.now() - t0;
	if (ms1 > 5000) out.push(`合成を当てた部分適用の鎖の深さ 24：${ms1}ms`);
	const hLine = show(r.trees[r.trees.length - 2]);
	if (hLine !== "(: h (? [[f]] (inst {f:L} (apply f [1]))))") out.push(`h の行 got: ${hLine}`);
	t0 = Date.now();
	let got = "通った";
	try {
		resolve(src(["inc : x ? x + 1", "pp : [a] [b] [c] ? a", "g : [f] ? g [f : pp [f : f f] [f : f f]]", "g [f : inc]"]));
	} catch (e) {
		got = `${e.reason} ${e.gate || ""}`;
	}
	const ms2 = Date.now() - t0;
	if (ms2 > 5000) out.push(`倍々の合成の再帰：${ms2}ms`);
	if (got !== "coproduct-unknown-kind G7") out.push(`倍々の合成の再帰 got: ${got}  want: G7`);
	return out;
});
// 合成の鍵を番号に寄せても、鍵は合成の中身で分かれる：並びの違う合成は別の実体、同じ綴りの合成は同じ実体。
law("合成の鍵は中身で分かれる", () => {
	const defs = ["inc : x ? x + 1", "double : x ? x * 2", "ca : inc double", "cb : double inc", "ca2 : inc double", "k : [f] ? f 1"];
	const n = instCount(src([...defs, "k [f : ca]", "k [f : cb]", "k [f : ca2]"]), 5);
	return n === 2 ? [] : [`k の実体の数 got: ${n}  want: 2`];
});
// 合成の鍵は、足りない適用の節を含むか（partial）でも分かれる。前は、partial の合成が適用の頭になると G2(b) で断っていたので、
// 分けないと、括りの部分適用 `[add 1]` で始まる合成の実体を先に作った行の後で、`add 1 inc`（足りない適用の節を含む）を渡した行が
// 黙って通った。2026-10-22 から、合成は流れとして読む（R36）ので、`[add 1] inc` と `add 1 inc` は同じ流れ（`inc (add 1 1)`）で、
// どちらの行も A。鍵は今も印で分けている（分け合っても答えは同じ）。
checkPass(
	"確かめ 守り 合成の足りない適用の印は、流れの答えを変えない（前は G2(b)）",
	src(["inc : x ? x + 1", "add : x y ? x + y", "k : [f] ? f 1", "k [f : [add 1] inc]", "k [f : add 1 inc]"]),
	"(apply k [f : add 1 inc])",
	"A"
);

// ---------------------------------------------------------------------------
// 合成の中の括りの関数（§5 Q24 の案1、2026-10-19、確かめ）
// ---------------------------------------------------------------------------
//
// 直した：合成の最初の関数が足りた適用で、結果が A でないとき（括りの関数の実体の根が A でない・素の関数の本体の根が
// A でない k = n・`[' 0]` に1項）、直す前は後ろの関数を見ずに未知で返していた。だから後ろの括りの関数の実体を作らず、
// 本体の門をすり抜け、定義の行は defer のままだった。前に `inc` を1つ足した `inc pa bad [1 2]` は断るのに、
// `pa bad [1 2]` は通っていた。最初の関数は足りた適用なので、後ろの関数はその結果を受けて呼ばれる（R11）。だから後ろの
// 括りの関数は未知を受けて実体を作り（§3.4 の合成の行「前に未知があれば未知」）、門に当たれば呼んだ行で断る（R25）。
// 最初の関数に足りたか決まらない形（`[+]` に1項 Q17・既定値のある関数 Q8）は、Q24 の直しの時は「後ろが呼ばれるかも
// 決まらない」として実体を作らなかった。合成を適用の畳み込みにした（2026-10-19）ので、最初の関数の適用が未知なだけで、
// 後ろの括りの関数は同じく未知を受けて実体を作る（§5 Q27 の断る側。`[+] bad 5` と `inc [+] bad 5` が割れていた）。
// 2026-10-21 に R31 で `[+]` に数1つは値になった（Q17 は閉じた）ので、足りたか決まらない頭の見本は、アリティの分からない点なし
// `[,]` に替えた。`[+] tl 5` の tl は A を受ける（下の「R31 で変わった」の行）。同じ日に、畳まない点なし（`[<<]` など）は素の2引数の
// 関数になった（R32）ので、`[<<] tl 5` は `add tl 5` と同じく足りない適用で、tl は呼ばれない（defer）。中身の見えない A を1項で
// 畳む頭（`[&] tl (inc 5)`、R31 の1項）は未知で、後ろは未知を受ける。
//
// 穴：変異で壊しても落ちなかった所（途中で未知になった後の括りの関数・合成の頭の括りの関数の根が A でない k = n・
// k > n・足りない・後ろの括りの関数のアリティが2以上）。

// 頭の根が A でない関数は、前は本体の根が L の物（`pa : [x ~xs] ? [+ x]`・`hl : [x ~xs] ? inc`・`adder : m ? [+ m]`・
// `pu : [x ~xs] ? [+ x]`）で見ていた。根が L の関数と実体は G16（R33）になったので、根が未知の `[,] …` で見る。pa と hl は
// 未知を受けても（`inc pa bad [1 2]`）根が未知のままで門に当たらないよう、仮引数を並びに置かない（`[,] x` は x が未知なら G7）。
const PA = "pa : [x ~xs] ? [,] 1"; // 実体の根が未知
const HL = "hl : [x ~xs] ? [,] 2"; // 実体の根が未知
// 呼べば本体が門（G5）に当たる括りの関数。2026-10-26 の R28 の書き直し（末尾の `_` は消える）で、前の本体 `[+ 1] _ _` は `[+ 1]` になり G16 に替わるので、
// 内側の `_` で G5 に当たる `[+ 1] _ 1` にした（どの行でも、門に当たる本体を置く目的は同じ。答えの G5 は変わらない）。
// 2026-10-28 の R105 で `[+ 1] _ 1` は `[+ 1] 1` になるので、括りの関数の口に穴 `!_` を書いた `[[g5] ? g5] !_ 1`（G5、§3.5）に替えた。
const BAD ="bad : [y ~ys] ? [[g5] ? g5] !_ 1";
const TL = "tl : [y ~ys] ? ys";
const TR = "tr : [x ~xs] ? xs 1";
const INC = "inc : x ? x + 1";
const DOUBLE = "double : x ? x * 2";
const UU = "uu : m ? [,] m"; // 本体の根が未知（前は adder : m ? [+ m]、§5 Q21）

const composePasses = [
	["直した pa tl [1 2] の根は未知", src([PA, TL, "pa tl [1 2]"]), "(apply (compose pa tl) [1 2])", "未知"],
	["直した pa tl [1 2] の tl は未知を受けて実体を作る", src([PA, TL, "pa tl [1 2]"]), "(: tl (? [[y ~ys]] (inst U ys)))", null, { at: 1 }],
	["直した uu tl 1 の tl は未知を受けて実体を作る（前は adder tl 1）", src([UU, TL, "uu tl 1"]), "(: tl (? [[y ~ys]] (inst U ys)))", null, { at: 1 }],
	["穴 inc uu tl 1（途中で未知になった後の括りの関数は未知を受ける）", src([INC, UU, TL, "inc uu tl 1"]), "(: tl (? [[y ~ys]] (inst U ys)))", null, { at: 2 }],
	["穴 inc uu tl 1 の根は未知", src([INC, UU, TL, "inc uu tl 1"]), "(apply (compose inc uu tl) 1)", "未知"],
	["穴 pu inc [1]（合成の頭の括りの関数の実体の根が A でない k = n）", src([INC, "pu : [x ~xs] ? [,] x", "pu inc [1]"]), "(apply (compose pu inc) [1])", "未知"],
	["穴 pr inc [1] 2 3（合成の頭の最後の仮引数が裸の k > n は、流れの余りを後ろに積む）", src([INC, "pr : [x ~xs] y ? y", "pr inc [1] 2 3"]), "(construct (apply (compose pr inc) (construct [1] 2)) 3)", "A", { leftover: true }],
	// 並びの項を全部書いた後に合成した double は、並びから何も受けていない。木は入れ子の適用（2026-10-24 の R47 で `·rev` の綴りが無くなった。
	// 前は `(apply double (apply (compose head inc) (construct 5 6 7)) ·rev)`）。
	["穴 head inc 5 6 7 double（合成の頭の最後の括りが残りを受ける）", src([INC, DOUBLE, "head : [x ~xs] ? x", "head inc 5 6 7 double"]), "(apply double (apply inc (apply head (construct 5 6 7))))", "A"],
	["穴 pair inc [1]（合成の頭の括りの関数に足りない。根なので `_`、R42）", src([INC, "pair : [a ~as] [b ~bs] ? a + b", "pair inc [1]"]), "(unit (apply (compose pair inc) [1]))", "A"],
	// 後ろの pb は前の結果を最初の口に受け、もう1つの口を待つ L（左からの畳み込み、R40。前は後ろの関数が前の結果だけを受けて未知）。根なので `_`（R42）。
	["穴 inc pb [1]（後ろの括りの関数のアリティが2）の根は `_`（R40・R42。前は未知）", src([INC, "pb : [a] [b] ? [+ 1] _ _", "inc pb [1]"]), "(unit (apply (compose inc pb) [1]))", "A"],
	["穴 inc pb [1] の pb は呼ばれないので defer", src([INC, "pb : [a] [b] ? [+ 1] _ _", "inc pb [1]"]), "(: pb (? [[a] [b]] (defer {[+ 1] _ _})))", null, { at: 1 }],
	["穴 inc pair [1]（後ろの括りの関数のアリティが2、Q13。もう1つの口を待つ L で、根なので `_`、R40・R42。前は未知）", src([INC, "pair : [a ~as] [b ~bs] ? a + b", "inc pair [1]"]), "(unit (apply (compose inc pair) [1]))", "A"],
	// 最初の関数に足りたか決まらない（前は `[+]` に1項、§5 Q17。今はアリティの分からない点なし `[,]` に1項）。前は「後ろが呼ばれる
	// かも決まらない」として実体を作らず、この行を「今は defer」として置いていた（§5 Q27）。合成を適用の畳み込みにして裏返した：
	// 後ろの括りの関数は未知を受ける。
	["Q27 で裏返した [,] tl 5 の tl は未知を受けて実体を作る（前は [+] tl 5 で defer）", src([TL, "[,] tl 5"]), "(: tl (? [[y ~ys]] (inst U ys)))", null, { at: 0 }],
	["Q27 [,] tl 5 の根は未知のまま", src([TL, "[,] tl 5"]), "(apply (compose [,] tl) 5)", "未知"],
	// R31 で `[+]` に数1つは値（`[+] 5` は 5）になったので、`[+] tl 5` の tl は、`inc tl 5` と同じく中身の見えない A を受ける（前は U）。
	["R31 で変わった [+] tl 5 の tl は A を受ける（前は U）", src([TL, "[+] tl 5"]), "(: tl (? [[y ~ys]] (inst A ys)))", null, { at: 0 }],
	["R31 で変わった [|] tl 5 の tl は A を受ける（前は U）", src([TL, "[|] tl 5"]), "(: tl (? [[y ~ys]] (inst A ys)))", null, { at: 0 }],
	// 中身の見えない A を1項で畳む頭は未知（R31 の1項）で、後ろの括りの関数は未知を受ける。
	["R31 の1項 [&] tl (inc 5) の tl は未知を受けて実体を作る", src([INC, TL, "[&] tl (inc 5)"]), "(: tl (? [[y ~ys]] (inst U ys)))", null, { at: 1 }],
	// 畳まない `[<<]` に1項は、素の2引数の関数（`add tl 5`）と同じく足りない適用で L（R32）。後ろは呼ばれないので defer。
	["R32 [<<] tl 5 は足りない適用（L）で、tl は呼ばれない", src([TL, "[<<] tl 5"]), "(: tl (? [[y ~ys]] (defer {ys})))", null, { at: 0 }],
	["R32 [<<] tl 5 の根は L（根なので `_`、R42）", src([TL, "[<<] tl 5"]), "(unit (apply (compose [<<] tl) 5))", "A"],
	// ほかの足りたか決まらない頭も同じ：アリティの分からない点なし（`[,]`。前の見本の `[|]`・`[*]` は R31 で畳むようになった）・
	// 既定値のある関数（Q8）・撒く項を含む並び（k を数えない）。撒く項は、合成も最初の関数への適用から畳む（applyKind の頭）ので、
	// 前は合成ごと未知で返していた。2026-10-24 の R51 から、撒く項は流れの1項で、口が1つの関数（inc）は値を返す（試しの版は写像、
	// 2026-10-25 の決定から書き下し）ので、数の見える流れなら撒く項は「足りたか決まらない頭」ではなくなった（下の2行。合成の頭に置いた
	// `inc tl vs~` は、同じ日の確かめの直しから合成に来た流れの G19、§5 Q58）。
	["Q27 [,] tl 2 3 の tl は未知を受けて実体を作る（前は [*] tl 2 3）", src([TL, "[,] tl 2 3"]), "(: tl (? [[y ~ys]] (inst U ys)))", null, { at: 0 }],
	["Q27 go tl xs（既定値のある関数）の tl は未知を受けて実体を作る", src([...GO_DEFAULT, TL, "go tl xs"]), "(: tl (? [[y ~ys]] (inst U ys)))", null, { at: 2 }],
	// `inc tl vs~`（2026-10-24 の試しの版は写像の List を tl が受けて実体 `A`、2026-10-25 の作る途中の版は書き下しの頭と余りを tl の最後の括りが
	// 受けて `[A…]`、その前は U）は、同じ日の確かめの直しで、合成に来た流れの G19（§5 Q58。下の composeRefused）。撒いた流れの書き下しの結果を
	// 括って渡せば、tl は書いた `(inc 1) 2` と同じ `[A…]` を受ける（法則1 の右辺の綴り）。
	["Q27 tl (inc vs~)（書き下しの結果を括って渡す）の tl は [A…] を受けて実体を作る", src([INC, "vs : 1 , 2", TL, "tl (inc vs~)"]), "(: tl (? [[y ~ys]] (inst [A…] ys)))", null, { at: 2 }],
	["Q27 tl (inc vs~) の根は A", src([INC, "vs : 1 , 2", TL, "tl (inc vs~)"]), "(apply tl [inc vs~])", "A"],
	// 今は：撒く項を受ける最初の関数そのものが括りの関数なら、実体を作らない（R24「撒く項があれば k は数えない（未知）」。
	// 合成でない頭の「R24 n 4 vs~ 5 では実体を作らない」と同じ）。だから `bad inc vs~` は bad の本体を読まずに通り、後ろに
	// 置いた `inc bad vs~` は未知を受けた bad の実体で G5（下の composeRefused の Q27 の行）。Q27 が問題にした非対称（頭に
	// 置くだけで本体の門をすり抜ける）が、撒く項を受ける括りの関数に残っている。撒く項を受けた括りの関数の当て方（どの
	// 仮引数に何が入るか）は k が数えられないので決まらず、未知を受けて作るか・名指しの門で断るかは決めていない（§5 の未決、
	// 合成の畳み込みの確かめの F3）。決まったら、この2行を裏返す。
	// 2026-10-26 の R64（括りの口は撒いた流れ1つを撒いた器そのものとして受ける）で、`bad inc vs~` の bad は流れ1つだけを最後の括りに受けるので、`bad inc vs`
	// と同じく vs の形 `[N…]` で実体を作り、本体の G5 に当たる（呼んだ行で断る、R25）。いちばん後ろの「R64〜R72」の節の断る側へ移した。撒く項と書いた実引数の
	// 混ざった `bad 1 vs~` は今のまま（§5 Q29）。
	["今は bad 1 vs~（合成でない頭）も実体を作らない", src(["vs : 1 , 2", BAD, "bad 1 vs~"]), "(: bad (? [[y ~ys]] (defer {[[g5] ? g5] !_ 1})))", null, { at: 1 }],
	// 後ろに素の関数だけなら、根を引かずに未知のまま（Q28）。前は `[+] inc 5` で見ていた（R31 で A になった）。
	["守り [,] inc 5（後ろが素の関数なら未知のまま）", src([INC, "[,] inc 5"]), "(apply (compose [,] inc) 5)", "未知"],
	// 片イ（R120）：途中で未知になった後の括りの関数 tr は未知（U）を受けて実体を作り、本体の `xs 1` は種類の未知な項の後ろに積む予想で通る（前は G7）。
	["穴 inc uu tr 1 の tr は未知を受けて実体を作る（前は G7）", src([INC, UU, TR, "inc uu tr 1"]), "(: tr (? [[x ~xs]] (inst U (construct xs 1))))", null, { at: 2 }],
	["穴 inc uu tr 1 の根は未知（前は G7）", src([INC, UU, TR, "inc uu tr 1"]), "(apply (compose inc uu tr) 1)", "未知"],
];
const composeRefused = [
	["直した pa bad [1 2]（頭の括りの関数の実体の根が未知）", src([PA, BAD, "pa bad [1 2]"]), "G5", [["bad", "U"]]],
	["直した hl bad [1 2]（頭の括りの関数の実体の根が未知）", src([INC, HL, BAD, "hl bad [1 2]"]), "G5", [["bad", "U"]]],
	["直した uu bad 1（頭の素の関数の本体の根が未知、k = n。前は adder bad 1）", src([UU, BAD, "uu bad 1"]), "G5", [["bad", "U"]]],
	// 2026-10-23 の左からの畳み込みでは `(5 uu) bad`：種類の未知な `5 uu` の後ろに bad が来る G2(a)（R40 の読み6）だった。前は強さの順で
	// `uu bad` の合成が先にでき、bad が未知を受けた実体で G5。逆適用の廃止（R47）で、uu は 5 を取らず、合成 `uu bad` が 5 の後ろに積まれて
	// 余る（bad は呼ばれない）。通る側（norevPasses）へ移した。
	["直した t : y ? uu bad y（素の関数の本体の中）", src([UU, BAD, "t : y ? uu bad y"]), "G5", [["bad", "U"]]],
	["直した [' 0] bad fs（頭が段18 の点なしに1項）", src([INC, DOUBLE, "fs : inc , double", BAD, "[' 0] bad fs"]), "G5", [["bad", "U"]]],
	// `inc uu tr 1` は、片イ（R120）で tr の本体の `xs 1` が積む予想で通る（上の composePasses へ移した）。
	// `pu inc [1] double`（最後の括りの後ろに合成が続き、未知を受けて通る、R41）と `pr inc [1] 2 3 double`（いちばん上の余り 3 を取る、
	// R40）は、2026-10-23 から通る。下の「左からの畳み込み」へ移した。
	// 前の `穴 pair inc [1] double 5`（足りない合成が適用の頭、G2(b)）は、R36 で流れとして通る（下の「余りと流れ」の行）。
	// 足りたか決まらない頭でも、後ろの括りの関数は未知を受けて実体を作る（§5 Q27。前は実体を作らずに通していた）。
	["Q27 で裏返した [,] bad 5（前は [+] bad 5 で通っていた）", src([BAD, "[,] bad 5"]), "G5", [["bad", "U"]]],
	// R31 で `[+] 5` は値になったので、bad は A を受ける（前は U）。本体の門は受けた物に依らず G5。
	["R31 で変わった [+] bad 5 は bad を形 A で名指し（前は U）", src([BAD, "[+] bad 5"]), "G5", [["bad", "A"]]],
	["Q27 go bad xs（既定値のある関数、前は通っていた）", src([...GO_DEFAULT, BAD, "go bad xs"]), "G5", [["bad", "U"]]],
	// 合成に来た流れ（2026-10-25 の確かめの直し、§5 Q58）：inc の後ろの tl・bad は最後の口が可変長で、合成全体の口の数が流れを受けた inc の口（1つ）と
	// 違うので、流れを最初の段で受けるか合成全体で受けるかで答えが割れる。作る途中の版は、書き下しの頭と余りを最後の括りが受けて `inc tl vs~` は A、
	// `inc bad vs~` は bad の実体 `[A…]` の G5。2026-10-24 の試しの版は写像の List を受けて A と G5（bad は `A`）、その前は U を受けた。
	["Q27 inc tl vs~（合成に来た流れ、§5 Q58。作る途中の版は A）", src([INC, "vs : 1 , 2", TL, "inc tl vs~"]), "G19"],
	["Q27 inc bad vs~（同じ G19。作る途中の版は bad の実体 [A…] の G5、その前も G5）", src([INC, "vs : 1 , 2", BAD, "inc bad vs~"]), "G19"],
	// 括って渡せば、bad は書き下しの結果の `[A…]` を受けて本体の門に当たる（`bad (inc 1 2)` と同じ）。
	["Q27 bad (inc vs~)（書き下しの結果を括って渡す。bad は [A…] を受けて G5）", src([INC, "vs : 1 , 2", BAD, "bad (inc vs~)"]), "G5", [["bad", "[A…]"]]],
];
for (const [name, s, want, kind, extra] of composePasses) checkPass(`確かめ ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of composeRefused) checkRefused(`確かめ ${name}`, s, want, inst);

// 最初の関数の結果が未知なら、その前に関数を足しても、後ろの括りの関数が受ける物は同じ（未知）。だから `h g a` と
// `inc h g a` で、後ろの括りの関数 g の答え（定義の行の木、断るなら門と名指し）は同じ。直す前は、h が頭のときだけ g の
// 実体を作らなかった。
law("頭の結果が未知なら、h g a と inc h g a で後ろの括りの関数の答えが同じ", () => {
	const gs = [["bad", BAD], ["tl", TL], ["tr", TR]];
	const heads = [
		["pa", [PA], "[1 2]"],
		["hl", [HL], "[1 2]"],
		["uu", [UU], "1"],
		["[' 0]", [DOUBLE, "fs : inc , double"], "fs"],
		// 足りたか決まらない頭（§5 Q27。合成を適用の畳み込みにして、ほかの頭と同じになった）。前は `[+]`・`[|]` に1項で見ていたが、
		// R31 で数1つは値になったので、アリティの分からない `[,]` と、中身の見えない A を1項で畳む `[&]`（R31 の1項で未知）に替えた。
		["[,]", [], "5"],
		["[&]", [], "(inc 5)"],
		["inc", ["vs : 1 , 2"], "vs~"],
	];
	const look = (s, g) => {
		try {
			const r = resolve(s);
			return show(r.trees.find((t) => show(t).startsWith(`(: ${g} (? `)));
		} catch (e) {
			return `断り ${e.gate || e.reason} ${JSON.stringify((e.instances || []).map((i) => [i.fn, i.shape]))}`;
		}
	};
	const out = [];
	for (const [g, gDef] of gs) {
		for (const [h, hDefs, a] of heads) {
			const defs = [INC, ...hDefs, gDef];
			const x = look(src([...defs, `${h} ${g} ${a}`]), g);
			const y = look(src([...defs, `inc ${h} ${g} ${a}`]), g);
			if (x !== y) out.push(`${h} ${g} ${a}：${x}`, `inc ${h} ${g} ${a}：${y}`);
			else if (x.includes("(defer ")) out.push(`${h} ${g} ${a}：どちらも実体を作っていない ${x}`);
		}
	}
	return out;
});

// ---------------------------------------------------------------------------
// 合成は適用の畳み込み（2026-10-19）
// ---------------------------------------------------------------------------
//
// 合成の適用は適用の繰り返しである：(g∘f) x = g (f x)。合成は左から実行する（R11）ので、`f1 f2 … fm x` は
// fm (… (f2 (f1 x)) …)。前は合成の行（§3.4）を適用とは別の表として育て、後ろの関数を名簿（本体の根が A のアリティ1の
// 素の関数・その部分適用・貪欲な単項・アリティ1の括りの関数）で数えていたので、直接書いた g (f x) と答えが割れていた
// （§5 Q13・Q24・Q26・Q27 は、その割れが表に出た物）。主の Claude の提案「合成の適用を、適用を左から畳む形に作り直して
// 合成用の表を消す」に、利用者 2026-10-19「質問が続いてたから気付いてたよ。その方向でお願い」。
// 法則から決まり直した所（前の答えから変わった所）：
// - 後ろの非貪欲の点なしの単項（`inc [+ 1] 5`）：前は未知（§5 Q13 の行。Q13 の出どころ U 09-28 22:07「inc [+]」は `[+]` と
//   アリティ2以上の話で、非貪欲の単項は表を作った側の慎重さだった）→ A。
// - 後ろの穴の書き換えとその部分適用：前は未知（Q26 の注）→ A（上の「答え」の Q26 の行）。
// - 最初が段18 の点なし（`[' 0] inc [1 2 3]`）：前は未知 → 引いた物の生まれ（R26）で A になりうる。
// - 最初が足りたか決まらない頭（Q27）：後ろの括りの関数も未知を受けて実体を作る（上の「確かめ」の Q27 の行）。
// - 後ろの関数は、前の結果の形を受ける（前が括りの関数の実体や素の関数なら中身の見えない A なので今までと同じ。前が
//   点なしの引きなら形が付く）。
// 前の結果が L か未知なら、そこから先は未知（関数を値として次へ渡す読みは決めていない）。直接書いた g (f x) は、f x が
// 未知なら未知の項を並びに置くので G7 だが、合成は節ごと未知にして根なら通す。だから下の法則は、f x が A の所で比べる。

const FOLD_DEFS = [
	INC,
	DOUBLE,
	"add : x y ? x + y",
	"pr : x y ? y",
	"pq : x y ? [,] y", // 本体の根が未知（前は `? inc` で根が L。根が L の関数は G16、R33）
	"f3 : a b c ? c",
	UU, // 前は ADDER（本体の根が L）
	"head : [x ~xs] ? x",
	TL,
	BAD,
	"pb : [a] [b] ? a + b",
	"pt : [a ~as] y ? y",
	"i : !_",
];
const foldPasses = [
	["Q13 で変わった inc [+ 1] 5（後ろの非貪欲の単項、前は未知）", src([INC, "inc [+ 1] 5"]), "(apply (compose inc [+ 1]) 5)", "A"],
	// 後ろの inc は、2026-10-23 までは逆適用で節を取り（`(apply inc (apply (compose inc [+ 1]) 5) ·rev)`）、R47 から積まれて余る（R42・R48）。
	["Q13 で変わった inc [+ 1] 5 inc（前は G2(a)、その後 逆適用）", src([INC, "inc [+ 1] 5 inc"]), "(construct (apply (compose inc [+ 1]) 5) (unit inc))", "A"],
	// 前置の点なしの単項 `[-_]`（2026-10-21 に一度 G14・R30 の `[-a]` にして、同じ日に戻した）。
	["Q13 で変わった inc [-_] 5（前置の点なしの単項）", src([INC, "inc [-_] 5"]), "(apply (compose inc [-_]) 5)", "A"],
	// 後ろの恒等射（括らない `!_` の名前 `i : !_`）は前の結果を desc ごと通す。前は括った `[!_]` で試していたが、`[!_]` は
	// 否定の点なしになった（U 2026-10-21 08:24）。否定の点なしは単項の点なしと同じく中身の見えない A を返すので、形を運ばない。
	["後ろの恒等射 inc i 5（i : !_）", src([INC, "i : !_", "inc i 5"]), "(apply (compose inc i) 5)", "A"],
	["後ろの恒等射は形を運ぶ [' 0] i head [[1 2] [3 4]]（i : !_）", src(["head : [x ~xs] ? x", "i : !_", "[' 0] i head [[1 2] [3 4]]"]), "(: head (? [[x ~xs]] (inst [N…] x)))", null, { at: 0 }],
	["否定の点なしは形を運ばない [' 0] [!_] head [[1 2] [3 4]]", src(["head : [x ~xs] ? x", "[' 0] [!_] head [[1 2] [3 4]]"]), "(: head (? [[x ~xs]] (inst A x)))", null, { at: 0 }],
	["Q13 で変わった inc [+ 1] 5 6（流れの余りは後ろに積む、R36。前は余りの印 excess）", src([INC, "inc [+ 1] 5 6"]), "(construct (apply (compose inc [+ 1]) 5) 6)", "A", { leftover: true }],
	// R31 で `[+]` に数1つは値（§5 Q17 は閉じた）が、`inc 5` は中身の見えない A なので、後ろの `[+]` は今までどおり未知（R31 の1項）。
	["守り inc [+] 5（後ろの [+] に中身の見えない A は未知のまま、R31）", src([INC, "inc [+] 5"]), "(apply (compose inc [+]) 5)", "未知"],
	["守り [' 0] [+] [[1 2] [3 4]]（引いた List は要素が全部 A と見えるので A）", src(["[' 0] [+] [[1 2] [3 4]]"]), "(apply (compose [' 0] [+]) [[1 2] [3 4]])", "A"],
	["守り inc [<<] 5（後ろの畳まない点なしに1項は足りない適用で L、R32。前は未知。根なので `_`、R42）", src([INC, "inc [<<] 5"]), "(unit (apply (compose inc [<<]) 5))", "A"],
	["R26 で変わった [' 0] inc [1 2 3]（最初が段18 の点なし、前は未知）", src([INC, "[' 0] inc [1 2 3]"]), "(apply (compose [' 0] inc) [1 2 3])", "A"],
	// `[' 0] inc [1 2 3] double`（前は G2(a)、2026-10-23 は通る）は、2026-10-24 から G2(a)（下の foldRefused）。
	// 片イ（R123）：STD の fs は `$inc , $double , 3` で、引いた物は番地（値）なので inc に当てて A（前は未知）。
	["守り [' 0] inc fs（片イの R123 で fs の要素は番地）（前は未知）", std("[' 0] inc fs"), "(apply (compose [' 0] inc) fs)", "A"],
	["守り [' say] inc m（引いた物が関数なら未知のまま）", src([...M, INC, "[' say] inc m"]), "(apply (compose [' say] inc) m)", "未知"],
	["形を受ける [' 0] head [[1 2] [3 4]]（head は引いた物の形を受ける）", src(["head : [x ~xs] ? x", "[' 0] head [[1 2] [3 4]]"]), "(: head (? [[x ~xs]] (inst [N…] x)))", null, { at: 0 }],
	["形を受ける [' 0] head [[1 2] [3 4]] は A（前は未知）", src(["head : [x ~xs] ? x", "[' 0] head [[1 2] [3 4]]"]), "(apply (compose [' 0] head) [[1 2] [3 4]])", "A"],
	["形を受ける [' 0] [' 0] [[1 2] [3 4]]（前は未知）", src(["[' 0] [' 0] [[1 2] [3 4]]"]), "(apply (compose [' 0] [' 0]) [[1 2] [3 4]])", "A"],
	// 合成の節の種類は、最後の結果の desc を形ごと持つ（直接書いた `head ([' 0] ([' 0] …))` の head が受ける物と同じ、R11・
	// R26）。根に置くと「A」としか見えないので、desc を読む head に渡して見る。合成の畳み込みの確かめの F1：最後の desc を中身の
	// 見えない A に潰しても、前の試験は全部通っていた（head が `(inst A x)` で、根が未知になる）。
	["形を運ぶ head ([' 0] [' 0] [[1 2] [3 4]]) の head は数を受ける", src(["head : [x ~xs] ? x", "head ([' 0] [' 0] [[1 2] [3 4]])"]), "(: head (? [[x ~xs]] (inst N x)))", null, { at: 0 }],
	["形を運ぶ head ([' 0] [' 0] [[1 2] [3 4]]) は A", src(["head : [x ~xs] ? x", "head ([' 0] [' 0] [[1 2] [3 4]])"]), "(apply head [[' 0] [' 0] [[1 2] [3 4]]])", "A"],
	["形を運ぶ v : [' 0] [' 0] [[1 2] [3 4]] を名前で渡す head v の head は数を受ける", src(["head : [x ~xs] ? x", "v : [' 0] [' 0] [[1 2] [3 4]]", "head v"]), "(: head (? [[x ~xs]] (inst N x)))", null, { at: 0 }],
	["形を運ぶ v : [' 0] [' 0] [[1 2] [3 4]] の後の head v は A", src(["head : [x ~xs] ? x", "v : [' 0] [' 0] [[1 2] [3 4]]", "head v"]), "(apply head v)", "A"],
	["守り inc head [5 6 7]（前が素の関数なら中身の見えない A を受ける）", src([INC, "head : [x ~xs] ? x", "inc head [5 6 7]"]), "(: head (? [[x ~xs]] (inst A x)))", null, { at: 1 }],
];
const foldRefused = [
	["形を受ける [' 0] bad [[1 2] [3 4]] は形 [N…] で名指し（前は U）", src([BAD, "[' 0] bad [[1 2] [3 4]]"]), "G5", [["bad", "[N…]"]]],
	// 段18 の点なしが [1 2 3] を受けた後に関数（double・head）が来る。点なしの口の数は決まっていない（§5 Q39、R41 の読み8）。2026-10-23
	// までは、引いた物が値なら、閉じた読み（閉じて値になり、後ろの関数が逆適用でそれを取る）と開いた読み（まだ受けていて、後ろの関数は
	// 合成）が同じ答えなので通していた（`[' 0] inc [1 2 3] double` は `double (inc 1)`、`… head` は未知）。逆適用の廃止（R47）で、閉じた読みの
	// 後ろの関数は値の後ろに積まれて値を取らない（`(inc 1) double` で double が余る）ので、2つの読みが割れる。`[,] 5 g 3` と同じく G2(a)。
	// 2026-10-26 の R77（§5 Q39 の答え：`[' 0]` は口1つ）で閉じた読みに決まり、`[' 0] inc [1 2 3] double`・`… head` は引いた値の後ろに関数が積まれて余る形で通る
	// （いちばん後ろの「R73〜R79」の節へ移した）。
];
for (const [name, s, want, kind, extra] of foldPasses) checkPass(`合成 ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of foldRefused) checkRefused(`合成 ${name}`, s, want, inst);

// 合成は適用の繰り返し：f x が A なら、`f g x` と直接書いた `g (f x)` は、根が A かどうかと、定義の行の木（括りの関数の
// 実体）と、断るなら門と名指しが同じ。後ろが2つの `f g h x` と `h (g (f x))` も、g (f x) が A なら同じ。前の実装では、後ろの
// 非貪欲の単項・穴・最初の `[' k]` で割れていた。g (f x) が足りない適用（L）のとき、比べるのは A かどうかだけにする。
// 2026-10-22 から、合成は流れとして左から畳む（R36、§5 Q4 の答え U〔答え〕10-21 23:18）。直接書く側も流れの読みで書く：f は x の
// 前から自分のアリティ分 x1 … xn だけを取り、g は `g (f x1 … xn)` の後ろに流れの次の物を（g のアリティ − 1 個）取る。最後に残った
// 物は後ろに積む（`(… ) xm`、R35）。アリティは下の表で、試験の側が自分で数える（実装の flowArity を使わない）。並び全体を受ける
// 関数（アリティ null）に流れの余りが残ったまま届く形は、合成が G12(c) で断ることだけを見る（§5 Q13 の残り）。最後の結果が値でない
// のに余りが残る形は、合成が G12(b) で断ることを見る（直接書いた側は、未知の括りの葉を並びに置くので G7）。
// 段18 の点なし `[' 0]` は "pick"：前にある流れが1項のときだけ 1 と数え、2項以上なら null（直に当てた `[' 0] x y` の k ≠ 1 が未知
// なのと同じ。確かめ 2026-10-22。前は 1 で、流れの中でだけ口を1つと数えていた）。最初の恒等射 i が2項以上を受けて、後ろに恒等射・
// 貪欲な単項でない関数が続く形も、合成が G12(c) で断ることだけを見る（R29 の「並び全体を受ける」と単位律が割れる。確かめ 2026-10-22）。
// 2026-10-23 の左からの畳み込み（R40・R41）で、流れは畳み込みの1歩そのもの（後から来る物は最初の関数から順に流れ込む）になった。
// 変わったのは2つ：並び全体を受ける関数（アリティ null）は、流れの余りが残っていても並びの終わりまで受ける（R41。前の G12(c) の
// 枝は、直接書いた `g (f x1 … xn) xn+1 …` と比べる枝になる）。最後の結果が値でないのに余りが残る形は G2(a)（R40 の読み6、前は
// G12(b)）。恒等射の割れは G18（前は G12(c)）で、恒等射が続くならその先の最初の恒等射でない関数で見る（試験の側も同じに数える）。
const FLOW_ARITY = new Map([
	["inc", 1], ["double", 1], ["[+ 1]", 1], ["[-_]", 1], ["i", null], ["[* 2,]", null], ["[+]", null], ["add", 2], ["uu", 1], ["pq", 2],
	["(pr 1)", 1], ["(pq 1)", 1], ["[add _ 10]", 1], ["([f3 _ _ 3] 1)", 1], ["head", null], ["tl", null], ["bad", null], ["pb", null],
	// 2026-10-26 の R77（§5 Q39 の答え：`[' k]` は口1つ）から、段18 の点なしはいつも 1（"pick" は使わない）。
	["(pt [1])", 1], ["[' 0]", 1], ["pt", 2],
]);
// 前に n 項の流れがあるときの、関数 f が流れから取る数。
const flowArityAt = (f, n) => {
	const a = FLOW_ARITY.get(f);
	return a === "pick" ? (n === 1 ? 1 : null) : a;
};
law("合成は左から畳む（R40。前は R36 の流れ）：f g x と、流れを括りで書いた g (f x1 … xn) xn+1 …", () => {
	const look = (s) => {
		try {
			const r = resolve(s);
			const ts = r.trees.map((t) => show(t));
			const last = r.trees[r.trees.length - 1];
			return { a: kindOf(last) === "A", defs: ts.slice(0, -1).join(" | ") };
		} catch (e) {
			return { refused: `${e.reason} ${e.gate || ""} ${JSON.stringify((e.instances || []).map((i) => [i.fn, i.shape]))}` };
		}
	};
	const same = (p, q) => JSON.stringify(p) === JSON.stringify(q);
	const isA = (expr) => {
		const r = look(src([...FOLD_DEFS, expr]));
		return !r.refused && r.a;
	};
	// [最初の関数, 実引数の項の並び]。余りの残る物（`inc 5 6`・`pt [1] 2 3`）を混ぜる。
	const FIRSTS = [
		["inc", ["5"]],
		["inc", ["5", "6"]],
		["inc", ["5", "6", "7"]],
		["[+ 1]", ["5"]],
		["[* 2,]", ["1", "2", "3"]],
		["[+]", ["5", "6"]],
		["(pr 1)", ["5"]],
		["[add _ 10]", ["5"]],
		["head", ["[5 6 7]"]],
		["head", ["5", "6", "7"]],
		["[' 0]", ["[1 2 3]"]],
		["[' 0]", ["[[1 2] [3 4]]"]],
		["pt", ["[1]", "2"]],
		["pt", ["[1]", "2", "3"]],
		// 恒等射（確かめ 2026-10-22）。2項を受けた i の後ろに、恒等射・貪欲な単項でない関数が続けば G12(c)（2026-10-23 から G18）。
		["i", ["5"]],
		["i", ["5", "6"]],
	];
	const LATER = ["inc", "double", "[+ 1]", "[-_]", "i", "[* 2,]", "[+]", "add", "uu", "pq", "(pr 1)", "(pq 1)", "[add _ 10]", "([f3 _ _ 3] 1)", "head", "tl", "bad", "pb", "(pt [1])", "[' 0]"];
	// 2026-10-26 の R74 で頭の恒等射は単位律で消える（G18 の枝に当たらない）ので、合成の途中の恒等射（`inc i h 5 6`）で G18 の枝を見るように i を足した。
	const LATER2 = ["inc", "[+ 1]", "(pr 1)", "[add _ 10]", "head", "tl", "bad", "[' 0]", "add", "i"];
	const out = [];
	const count = {
		A: 0,
		"A でない": 0,
		断る: 0,
		"余りを積んで比べた": 0,
		"並び全体を受ける関数が流れの余りまで受けた（R41、前は G12(c)）": 0,
		"恒等射が2項以上を受けて後ろに関数（片イ R126 で恒等射を消して畳み直す、前は G18）": 0,
		"余りの前の結果が値でない（片イ R120 で予想を積む、前は G2(a)、その前は G12(b)）": 0,
	};
	// 流れ（R40）を括りで書く。steps は途中の括りの綴り（最後が g の適用）、left は最後に残って後ろに積む項。並び全体を受ける関数は、
	// 流れの余りも並びの終わりまで受ける（R41。wide はその数）。恒等射が2項以上を受けて、その先の最初の恒等射でない関数が貪欲な単項で
	// なければ cut（G18）。
	const flow = (fs, xs) => {
		const a0 = flowArityAt(fs[0], xs.length);
		let cur = a0 === null || xs.length <= a0 ? `${fs[0]} ${xs.join(" ")}` : `${fs[0]} ${xs.slice(0, a0).join(" ")}`;
		let rest = a0 === null || xs.length <= a0 ? [] : xs.slice(a0);
		const steps = [cur];
		let wide = 0;
		const idCut = (j, got) => {
			if (fs[j] !== "i" || got < 2) return false;
			const next = fs.slice(j + 1).find((g) => g !== "i");
			return next !== undefined && next !== "[* 2,]";
		};
		if (idCut(0, a0 === null ? xs.length : Math.min(xs.length, a0))) return { steps, cut: true };
		for (let j = 1; j < fs.length; j++) {
			const g = fs[j];
			const b = flowArityAt(g, 1 + rest.length);
			if (b === undefined) throw new Error(`FLOW_ARITY に ${g} が無い`);
			const take = b === null ? rest : rest.slice(0, b - 1);
			if (b === null && rest.length) wide++;
			if (idCut(j, 1 + take.length)) return { steps, cut: true };
			rest = rest.slice(take.length);
			cur = `${g} (${cur})${take.length ? ` ${take.join(" ")}` : ""}`;
			steps.push(cur);
		}
		return { steps, direct: rest.length ? `(${cur}) ${rest.join(" ")}` : cur, left: rest.length, wide };
	};
	const check = (fs, xs) => {
		const composed = `${fs.join(" ")} ${xs.join(" ")}`;
		const c = look(src([...FOLD_DEFS, composed]));
		// R74（2026-10-26、§5 Q13 の答え）：恒等射で始まる合成は、単位律で頭の恒等射が消える（`i inc 5 6` は `inc 5 6`）ので、頭の i を外した合成の流れで
		// 比べる（前は、頭の i が2項以上を受けて後ろに関数が続けば G18 の cut）。合成の途中の i は今までどおり flow の cut が見る。
		const lead = fs.findIndex((g) => g !== "i");
		const fl = flow(lead > 0 ? fs.slice(lead) : fs, xs);
		// 片イ（R126）：恒等射が2項以上を受けて後ろに関数が続く割れは単位律の側に決まり、恒等射を消した並びで畳み直す（`inc i add 5 6` は
		// `inc add 5 6` と同じ木）ので、i を消した合成と比べる（前は G18 で断ることを見た）。
		if (fl.cut) {
			count["恒等射が2項以上を受けて後ろに関数（片イ R126 で恒等射を消して畳み直す、前は G18）"]++;
			const unit = `${fs.filter((g) => g !== "i").join(" ")} ${xs.join(" ")}`;
			const u = look(src([...FOLD_DEFS, unit]));
			if (!same(c, u)) out.push(`${composed}  ⇔  ${unit}`, `  合成: ${JSON.stringify(c)}`, `  恒等射を消した合成: ${JSON.stringify(u)}`);
			return;
		}
		// 片イ（R120）：余りの前の結果が値でない形も、木は余りを後ろに積む予想で通るので、直接書いた側と比べる（前は G2(a) で断ることを見た）。
		const lastStep = look(src([...FOLD_DEFS, fl.steps[fl.steps.length - 1]]));
		if (fl.left && !lastStep.refused && !lastStep.a) count["余りの前の結果が値でない（片イ R120 で予想を積む、前は G2(a)、その前は G12(b)）"]++;
		if (fl.wide) count["並び全体を受ける関数が流れの余りまで受けた（R41、前は G12(c)）"]++;
		const d = look(src([...FOLD_DEFS, fl.direct]));
		if (!same(c, d)) out.push(`${composed}  ⇔  ${fl.direct}`, `  合成: ${JSON.stringify(c)}`, `  直接: ${JSON.stringify(d)}`);
		if (fl.left) count["余りを積んで比べた"]++;
		if (c.refused) count.断る++;
		else if (c.a) count.A++;
		else count["A でない"]++;
	};
	for (const [f, xs] of FIRSTS) {
		const n1 = flow([f], xs).steps[0];
		if (!isA(n1)) {
			out.push(`前提が崩れた：${n1} が A でない`);
			continue;
		}
		for (const g of LATER) {
			check([f, g], xs);
			const fl = flow([f, g], xs);
			if (!LATER2.includes(g) || fl.cut || !isA(fl.steps[1])) continue;
			for (const h of LATER2) check([f, g, h], xs);
		}
	}
	// 比べる組が全部同じ読みなら、法則は何も見ていない。
	for (const [k, v] of Object.entries(count)) if (!v) out.push(`「${k}」の組が無い（法則がその枝を見ていない）`);
	return out;
});

// ---------------------------------------------------------------------------
// §5 Q30：値を含む輪（2026-10-20）
// ---------------------------------------------------------------------------
//
// 値の定義を含む輪は、どこから入っても名前の輪（name-cycle）で断り、言い分に輪の道筋を書く（resolve.js の「値を含む輪」）。
// 前は、値の定義から入れば断り、関数から入れば仮置きで閉じて黙って通った（`a : f 1`・`v : f 1`・`f : x ? v` は、v が先なら
// name-cycle、a が先なら A）。v = f 1 = v で、値はいつまでもできない（主の Claude「本当の欠陥は a が先だと通ってしまうほう」、
// 利用者 2026-10-20「明らかにそうだと思う」）。解決器の役目は、意味を決めることではなく、書いた人が見落とした輪（長い輪）を、
// 入口に依らずに必ず見つけて、輪の道筋を名指しすることである。
// 輪に値の定義が無い物（関数どうしの再帰・括りの関数の実体の輪）は、今までどおり仮置きで閉じて通る。`$` で遅らせた名前は
// 種類を引かない（touchName）ので輪に数えない（今のまま。利用者「$で書くことになればそれはそれで何か起こりそうだけど…」、
// この片では扱わない）。既定値を覗いた所（namesPattern）を通る輪も、既定値は解かない（P3）ので輪に数えない（HEAD のまま）。
// どの形も、文の並べ方を全部回す。断る形は、どの並べ方でも name-cycle で、道筋（e.cycle と言い分）が同じ輪であること。道筋の
// 書き始めは、輪の中の値の定義のうち先に書いた物（resolve.js の cycleError）なので、値の定義が2つ以上の輪は、輪を回した物
// の中で、その並べ方で先に書いた値の定義から始まる物と比べる。通る形は、どの並べ方でも同じ木と種類であること。

const Q30_PERMS = (n) => {
	const out = [];
	const go = (rest, acc) => {
		if (!rest.length) out.push(acc);
		rest.forEach((u, i) => go([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, u]));
	};
	go([...Array(n).keys()], []);
	return out;
};
// [名前, 文（1文は行の配列）, 輪の道筋（書き始めは問わない。値の定義は `名前` だけ）]
const Q30_CYCLES = [
	["a・v・f（§5 Q30 の例）", [["a : f 1"], ["v : f 1"], ["f : x ? v"]], ["`v`", "`f` の本体"]],
	["a・v・f と f を呼ぶ行", [["a : f 1"], ["v : f 1"], ["f : x ? v"], ["f 2"]], ["`v`", "`f` の本体"]],
	["3つ以上の輪（v → g → h → v）", [["v : g 1"], ["g : x ? h x"], ["h : y ? v"]], ["`v`", "`g` の本体", "`h` の本体"]],
	["3つ以上の輪に外から入る（a が g を呼ぶ）", [["a : g 1"], ["v : g 1"], ["g : x ? h x"], ["h : y ? v"]], ["`v`", "`g` の本体", "`h` の本体"]],
	["括りの関数の実体を通る輪", [["a : p [1]"], ["v : p [1]"], ["p : [x] ? v"], ["p [2]"]], ["`v`", "`p` を形 N で呼んだ実体の本体"]],
	["欄で渡した関数を通る輪", [["a : hb [s : f]"], ["hb : [s] ? s 1"], ["v : hb [s : f]"], ["f : x ? v"]], ["`v`", "`hb` を形 {s:L} で呼んだ実体の本体", "`f` の本体"]],
	["無名の関数の本体を通る輪", [["a : f 1"], ["v : [w ? f w] 1"], ["f : x ? v"], ["f 2"]], ["`v`", "無名の関数 `[w ? f w]` の本体", "`f` の本体"]],
	["根に使わない所で引く輪（積の中）", [["inc : x ? x + 1"], ["a : inc f 1"], ["v : (f 1) , 1"], ["f : x ? v"]], ["`v`", "`f` の本体"]],
	["値の定義が2つの輪（関数を挟む）", [["a : f 2"], ["v : f 1"], ["w : v"], ["f : x ? w"]], ["`v`", "`f` の本体", "`w`"]],
	["値の定義だけの輪", [["v : w"], ["w : v"]], ["`v`", "`w`"]],
	// 輪を値の定義の無い所（g → k → g）で先に閉じ、閉じた k の答えが未知の形。未知の記録は仮置きの依りを持たないので、輪の
	// 依り（resolve.js の「値を含む輪」の注）が無いと、a が先なら vk が k の記録を読んでも g を通ったことが見えず、黙って通った
	// （1つ目、HEAD からある）か、k の本体の門で断った（2つ目）。vk が先なら name-cycle。
	// 2026-10-26 の R76（§5 Q37 の答え：字下げの本体の行は評価する所）で、行 `⇥inc` は `_` になって仮置きが外れなくなったので、この輪の形（下の2つも）は、
	// 行の根が未知の `⇥[,] x` で未知の記録を作る（HEAD でも同じ答え）。
	["未知で閉じた関数の記録を通る輪（仮置きが外れて未知）", [["inc : x ? x + 1"], ["a : g 1"], ["g : x ?", "\tk x", "\tvk", ""], ["k : x ?", "\tg x", "\tk x", "\t[,] x", ""], ["vk : k 1"]], ["`vk`", "`k` の本体", "`g` の本体"]],
	// 2026-10-26 の R28 の書き直し（末尾の `_` は消える）で、行 `⇥[+ 1] _ _` は `[+ 1]`（評価する所で `_`）になって門に当たらないので、内側の `_` で G5 に当たる
	// `⇥[+ 1] _ 1` にした（下の2つも。門で未知にする目的は同じ）。2026-10-28 の R105 で `⇥[+ 1] _ 1` は `[+ 1] 1` になって門に当たらないので、`⇥[[g5] ? g5] !_ 1`
	// （括りの関数の口の `!_` の G5）に替えた。
	["未知で閉じた関数の記録を通る輪（門で未知）", [["a : g 1"], ["g : x ?", "\tk x", "\tvk", ""], ["k : x ?", "\tg x", "\t[[g5] ? g5] !_ 1", ""], ["vk : k 1"]], ["`vk`", "`k` の本体", "`g` の本体"]],
	// 記録を通して見つけた輪の道筋に、記録の中の段を書く（確かめ 2026-10-20 の Q30-V2）。前は記録の持ち主の1歩しか書かず、a が
	// 先なら「`vk` → `m` の本体 → `g` の本体」（m の本体は g を引かない）、vk が先なら k まで書いて、並べ方の半分ずつに割れた。
	["記録の中の段を道筋に書く（m → k → g）", [["a : g 1"], ["g : x ?", "\tm x", "\tvk", ""], ["m : x ? k x"], ["k : x ? g x"], ["vk : m 1"]], ["`vk`", "`m` の本体", "`k` の本体", "`g` の本体"]],
	// 未知の記録が、閉じた枠（m）の輪の依り（g）を引き継ぐ形（確かめ 2026-10-20 の Q30-V3）。引き継ぎ（finishFrame）が無いと、
	// a が先なら黙って通った。
	["未知の記録が閉じた枠の輪の依りを引き継ぐ", [["inc : x ? x + 1"], ["a : g 1"], ["g : x ?", "\tm x", "\tvk", ""], ["m : x ?", "\tr x", "\tg x", ""], ["r : x ?", "\tm x", "\t[,] x", ""], ["vk : r 1"]], ["`vk`", "`r` の本体", "`m` の本体", "`g` の本体"]],
	// 未知の記録（r）を読んだ関数（y）がまた未知で閉じ、それを値が読む2段の形（確かめ 2026-10-20 の Q30-V4）。記録を通るときに
	// 上の枠へ依りを足す所（passThrough）が無いと、a が先なら黙って通った。
	["未知の記録を読んだ関数がまた未知で閉じる（2段）", [["inc : x ? x + 1"], ["a : g 1"], ["g : x ?", "\tr x", "\ty x", "\tvk", ""], ["r : x ?", "\tg x", "\t[,] x", ""], ["y : x ? r x"], ["vk : y 1"]], ["`vk`", "`y` の本体", "`r` の本体", "`g` の本体"]],
	// 既定値を覗いた v の計算の中だけで閉じる輪（vk → k → h → vk）。覗いた所を通らない本物の輪なので、namesPattern は投げ直す。
	// 例外で抜けた枠の印（下の行）が無い作りで、覗きの名前の輪を全部握りつぶすと、a が先なら黙って通った（resolve.js の
	// namesPattern の注。今は全部を握りつぶしても印が同じ輪を見つけ直すので、この行は、どの並べ方でも断ることだけを見る）。
	["既定値を覗いた定義の中だけで閉じる輪", [["a : g 1"], ["g : x ? [[y : v 2] ? 5] x"], ["v : h 1"], ["h : x ?", "\tk x", "\tvk", ""], ["k : x ?", "\th x", "\t[[g5] ? g5] !_ 1", ""], ["vk : k 1"]], ["`vk`", "`k` の本体", "`h` の本体"]],
	// 覗いた v の中で、h の行 `g x` が覗いた所を通る輪（h → g → 覗き → v）で抜ける。k は h を読んで未知で閉じた記録として残るので、
	// 例外で抜けた h の枠を輪の依りに持つ記録に古いと印を付けないと、a が先なら、vk が k の記録を読んでも h を通ったことが
	// 見えず、黙って通った（resolve.js の「値を含む輪」の注の、例外で抜けた枠）。
	["既定値の覗きが抜けた後の記録を通る輪", [["a : g 1"], ["g : x ? [[y : v 2] ? 5] x"], ["v : h 1"], ["h : x ?", "\tk x", "\tg x", "\tvk", ""], ["k : x ?", "\th x", "\t[[g5] ? g5] !_ 1", ""], ["vk : k 1"]], ["`vk`", "`k` の本体", "`h` の本体"]],
	// 1項の `:` の左（枝の条件）を覗いた所を通る輪。枝の条件は解かない（P3）が、本体を実行すれば評価するので、値は本当に
	// できない。断る側に置いている（§5 Q30 の未決。関数を1つ挟むと覗かないので通る。resolve.js の namesPattern の注）。
	["1項の `:` の左を覗いた所を通る輪（未決、断る側）", [["v : (g 1) , 1"], ["g : x ?", "\t(v 2) : 1", ""]], ["`v`", "`g` の本体"]],
	// `$` の先の名前の輪（2026-10-24、R53）：`$v` は v が関数かを見るので v の種類を引き、v = f 1 の種類は f の本体の `$v` に依る。前は `$` で
	// 遅らせた名前は種類を引かず、どの並べ方でも通った（下の Q30_PASSES にあった。v は積の A）。
	// 2026-10-26 の R73（§5 Q60 の答え：Reader は v をその場で評価しない）で、輪を閉じる辺が `$v` の所だけなら、v の種類を引かずに値を読む参照として通す
	// （下の Q30_PASSES へ戻した）。断る側に残るのは、輪の中で参照を `@` で開く形（v の値が自分に依る）・`$` の無い v も輪にある形・v が値でない形（仮に
	// 置いた値の参照の読みが外れる）。
	["`$v` の輪の中で参照を `@` で開く（R73 の外。v = f 1 = @$v）", [["v : f 1"], ["f : x ? @[$v]"]], ["`v`", "`f` の本体"]],
	["`$v` の輪に `$` の無い v もある（R73 の外）", [["v : f 1"], ["f : x ? x , $v , v"]], ["`v`", "`f` の本体"]],
	// 「`$v` の輪の v が関数になる（R73 の外。値の参照の読みが外れる）」（`add : x y ? x + y` ⏎ `v : add (f 1)` ⏎ `f : x ? x , $v`）は、2026-10-27 の片8 の R103
	// （`$` は必ず持ち上げで、持ち上げだけを通る輪は値の輪ではない。v の種類は警告を出すかだけを決める）で、下の Q30_PASSES へ移した。
];
// [名前, 文]。輪はあるが値の定義を挟まない（または既定値を覗いた所を通る）ので、どの並べ方でも通る。`$` で遅らせた名前の2つは、2026-10-24 の
// R53 で上の Q30_CYCLES へ移した。
const Q30_PASSES = [
	["関数どうしの再帰に値の定義から入る", [["a : f 1"], ["f : x ? g x"], ["g : y ? f y"], ["f 2"]]],
	// 2026-10-26 の R76（§5 Q37 の答え：字下げの本体の行は評価する所）で、行 `⇥inc` は `_` になり仮置きが外れなくなったので、行の根が未知の `⇥[,] x` にした
	// （下の Q28V-3 の形も同じ）。
	["関数どうしの再帰の仮置きが外れる（値の定義は輪の外）", [["inc : x ? x + 1"], ["a : f 1"], ["f : x ?", "\tg x", "\t[,] x", ""], ["g : y ? (f y) , 1"]]],
	["括りの関数の実体どうしの輪に値の定義から入る", [["a : ev [1 2 3]"], ["ev : [x ~xs] ? od xs"], ["od : [x ~xs] ? ev xs"], ["od 5"]]],
	// `$` で遅らせた自分の名前（`f : x ? x , $v`）は、前は種類を引かないので輪に数えず、どの並べ方でも通った。2026-10-24 の R53（`$` は関数だけを
	// 運ぶ）で `$v` が v の種類を引くようになったので、上の Q30_CYCLES へ移した。2026-10-26 の R73（§5 Q60 の答え）で、輪を閉じる辺が `$v` の所だけなら
	// v の種類を引かずに値を読む参照として通すので、ここへ戻した（どの並べ方でも同じ木と種類）。
	["`$` の先の自分の名前（R73。前は name-cycle、その前は通る）", [["v : f 1"], ["f : x ? x , $v"]]],
	["`$` の先の自分の名前に外から入る（R73。前は name-cycle、その前は通る）", [["a : f 1"], ["v : f 1"], ["f : x ? x , $v"], ["v"]]],
	["`$` の先の自分の名前を右辺に直に持つ値（R73）", [["v : 1 , $v"], ["v"]]],
	["`$` の先の自分の名前が括りの関数の実体を通る（R73）", [["v : h [1]"], ["h : [x] ? x , $v"], ["v"]]],
	// 2026-10-27 の片8 の R103：v が関数でも、持ち上げだけを通る輪は通る（前は R73 の外で name-cycle。`$v` は木を残す段で関数の番地）。
	["`$` の先の自分の名前の v が関数（R103。前は name-cycle）", [["add : x y ? x + y"], ["v : add (f 1)"], ["f : x ? x , $v"], ["v 3"]]],
	// 既定値を覗いた所を通る輪は、種類の輪ではない（既定値は解かず、値の無で呼ばれたときにだけ評価する。P3・§3.7）ので、HEAD の
	// まま通る（resolve.js の namesPattern の注）。前（2026-10-20 の作り直し）は、どれも全部の並べ方で name-cycle だった（確かめ
	// 2026-10-20 の Q30-V1・ADV-1）。v = g 1 = 5 で、値はできる。
	["既定値を覗いた所を通る輪（値はできる）", [["v : g 1"], ["g : x ? [[y : v 2] ? 5] x"]]],
	["既定値を覗いた所を通る輪（1文）", [["v : 1 , [[x : v 2] ? 5]"]]],
	["既定値が関数で、値の定義を呼ぶ", [["w : 1 , [[z : [u ? v u]] ? z]"], ["v : w"]]],
	// Q28V-3 の5文（`k 5 inc` の無い形）。HEAD 8fba397e でも、どの並べ方でも通った（確かめ 2026-10-20 の Q30-ADV-2）。
	["既定値を覗いた所を通る輪（Q28V-3 の5文）", [["inc : x ? x + 1"], ["w : 1 , [[x : v 2] ? 5]"], ["v : h 1"], ["h : x ?", "\tk x", "\tw", "\t[,] x", ""], ["k : x ? h x"]]],
	// 覗いた v の中の枠（h・v）が、覗いた所を通る輪で抜ける。抜けた後で、どの並べ方でも同じ木と種類になる。
	["既定値を覗いた所を通る輪に外から入る（覗いた中の枠が抜ける）", [["inc : x ? x + 1"], ["a : g 1"], ["g : x ? [[y : v 2] ? 5] x"], ["v : h 1"], ["h : x ?", "\tk x", "\tg x", "\t[,] x", ""], ["k : x ?", "\th x", "\t[,] x", ""]]],
];
// 書いた並べ方で、言い分の道筋の書き始め（輪の中の値の定義のうち先に書いた物）。
const q30Head = (units, order, ring) => {
	for (const u of order) {
		const name = units[u][0].split(" ")[0];
		const at = ring.indexOf(`\`${name}\``);
		if (at >= 0) return at;
	}
	return 0;
};
for (const [name, units, ring] of Q30_CYCLES) {
	total++;
	const problems = [];
	const orders = Q30_PERMS(units.length);
	for (const order of orders) {
		const s = src(order.flatMap((i) => units[i]));
		let e = null;
		try {
			resolve(s);
		} catch (err) {
			e = err;
		}
		const at = q30Head(units, order, ring);
		const want = [...ring.slice(at), ...ring.slice(0, at)];
		const path = [...want, want[0]].join(" → ");
		if (!e) problems.push(`通った: ${JSON.stringify(s)}`);
		else if (e.reason !== "name-cycle") problems.push(`${e.reason} ${e.gate || ""}: ${JSON.stringify(s)}`, e.message);
		else if (JSON.stringify(e.cycle) !== JSON.stringify(want) || !e.message.includes(`輪：${path}`)) {
			problems.push(`道筋 got: ${JSON.stringify(e.cycle)}  want: ${JSON.stringify(want)}: ${JSON.stringify(s)}`, e.message);
		}
		if (problems.length) break;
	}
	if (problems.length) fail(`Q30 値を含む輪 ${name}`, ...problems);
	else ok(`Q30 値を含む輪 ${name} → name-cycle（並べ方 ${orders.length}）`);
}
for (const [name, units] of Q30_PASSES) {
	total++;
	const problems = [];
	const orders = Q30_PERMS(units.length);
	let first = null;
	for (const order of orders) {
		const s = src(order.flatMap((i) => units[i]));
		let got;
		try {
			const r = resolve(s);
			const byUnit = [];
			order.forEach((u, j) => (byUnit[u] = `${show(r.trees[j])} : ${kindOf(r.trees[j])}`));
			got = byUnit.join(" | ");
		} catch (e) {
			got = `断り ${e.reason} ${e.gate || ""} ${e.message}`;
		}
		if (got.startsWith("断り")) problems.push(`${got}: ${JSON.stringify(s)}`);
		else if (first === null) first = got;
		else if (got !== first) problems.push(`並べ方で割れた: ${JSON.stringify(s)}`, `  ${first}`, `  ${got}`);
		if (problems.length) break;
	}
	if (problems.length) fail(`Q30 値を挟まない輪 ${name}`, ...problems);
	else ok(`Q30 値を挟まない輪 ${name} は通る（並べ方 ${orders.length}）`);
}
// 前からある直接の輪（`a : b 1`・`b : a 2`、§6.3 の「断られる」表）の言い分にも道筋が入る。
checkRefused("Q30 直接の輪の言い分", "a : b 1\nb : a 2", "name-cycle");
total++;
try {
	resolve("a : b 1\nb : a 2");
	fail("Q30 直接の輪の道筋", "通った");
} catch (e) {
	if (e.message.includes("輪：`a` → `b` → `a`")) ok("Q30 直接の輪の道筋（`a` → `b` → `a`）");
	else fail("Q30 直接の輪の道筋", e.message);
}

// ---------------------------------------------------------------------------
// §5 Q21：裸の関数を返す（2026-10-21、R33・G16）
// ---------------------------------------------------------------------------
//
// `?` で作る関数（名前の定義の右辺・括った `[x ? …]`・本体の中の局所の定義や欄の `?`）の本体の根が裸の関数（L）なら、その
// `?` の所で G16 で断る。呼ばれない定義でも断る（本体そのものがコードにできない）。関数を返すなら `$` を明示する（利用者
// 2026-10-21「adder が返すべきは [+ m] じゃなくて $[+ m]」、`$` は書く人が書く）。カリー化はシステムの側が持つので、入れ子の
// `?` も断る（主の Claude の「入れ子の `?`（`add : x ? y ? x + y`）も、裸の関数を返す形として断る？」に、利用者 2026-10-21
// 「実際には断る形なんだよ。 / 理由は、カリー化はシステムの側で持つべき。」）。
// 括りの関数は、実体の本体の根が L なら、呼んだ行で関数と形を名指しする（R25 と同じ）。呼ばれない括りの関数は本体を読まない。
// 根は解き終えた所で見る（resolve.js の bareReturnGate の注）：仮置きの上でだけ根が L になる関数は断らず、どの定義から解いても
// 同じ答えになる。根の綴りが区間なら、被演算子の種類が未知で根の種類が未知でも断る（綴りは仮置きに依らない。2026-10-22）。
// `$` で包んだ入れ子の `?`（`add : x ? $[y ? x + y]`）は、`$[+ m]` と同じく `$` で値にした関数を返す形で、本体の根は A で通る
// （主の Claude の「断ったままでいい？」に、利用者 2026-10-21 22:46「通して不都合がないなら通していいよ。」。前は G17 で断っていた。
// 下の「Q35 答え」の行）。
const BARE = [
	// 当たる形
	["区間の点なし adder : m ? [+ m]", ["adder : m ? [+ m]"]],
	["区間の点なしを呼ぶ行が先", ["adder 5", "adder : m ? [+ m]"]],
	["貪欲な点なし f : x ? [* 2,]", ["f : x ? [* 2,]"]],
	["前置の点なし f : x ? [-_]", ["f : x ? [-_]"]],
	["畳む点なし f : x ? [+]", ["f : x ? [+]"]],
	["関数の名前 f : x ? inc", [INC, "f : x ? inc"]],
	["自分の名前 f : x ? f", ["f : x ? f"]],
	["足りない適用 f : x ? add x", ["add : a b ? a + b", "f : x ? add x"]],
	["合成 f : x ? inc double", [INC, DOUBLE, "f : x ? inc double"]],
	// 恒等射の2行（`f : x ? !_`・`i : !_` の `f : x ? i`）は、片イ（R125）で知らせないので、下の checkBareUnit の後で見る。
	["穴 f : x ? add !_ x（穴の書き換えは関数）", ["add : a b ? a + b", "f : x ? add !_ x"]],
	["入れ子の ? add : x ? y ? x + y", ["add : x ? y ? x + y"]],
	["入れ子の ? を呼ぶ add 1 2", ["add : x ? y ? x + y", "add 1 2"]],
	["括りで包んだ定義 f : [x ? inc]", [INC, "f : [x ? inc]"]],
	["括った ? を行で呼ぶ [x ? inc] 5", [INC, "[x ? inc] 5"]],
	["本体の中の局所の定義の ?", [INC, "f : x ?", "\tg : y ? inc", "\tx", ""]],
	["構造体の欄の ?", [INC, "m :", "\tsay : x ? inc", "\tother : 1", ""]],
	["既定値のある関数 go : … ? inc", [INC, "go :", "\t\tys", "\t\tzs : 3", "\t? inc"]],
	["相互再帰 f : x ? g（g : y ? f y）", ["f : x ? g", "g : y ? f y", "g 1"]],
	["相互再帰（g が先）", ["g : y ? f y", "f : x ? g", "g 1"]],
	// 自分を呼ぶ再帰で仮置きが外れた関数（§3.4 の根は未知）でも、解き終えた木の根が裸の関数なら断る（実装する人の読み、断る側）。
	["仮置きが外れても木の根が L f : x ? [y ? f y]", ["f : x ? [y ? f y]"]],
	// 区間の綴り（2026-10-22、確かめで見つかった）：被演算子が A でない区間は種類が未知（pointfreeOf。当てた結果は §5 Q22）だが、
	// §2 の表では区間は被演算子に依らず L で、綴りは関数。前は根の種類が未知で黙って通っていた。
	["区間の被演算子の種類が未知 ww : x ? [+ [uu x]]", ["uu : x ? [,] x", "ww : x ? [+ [uu x]]"]],
	["区間の被演算子が関数 q : x ? [+ inc]", [INC, "q : x ? [+ inc]"]],
	["左の被演算子の区間 q : x ? [inc *]", [INC, "q : x ? [inc *]"]],
	["貪欲な区間 q : x ? [+ inc ,]", [INC, "q : x ? [+ inc ,]"]],
	["1行の括りに包んだ区間 q : x ? [[+ inc]]", [INC, "q : x ? [[+ inc]]"]],
	// 前は「仮置きの上でだけ根が L」で通していた形（h は k の仮置き A の上で `[+ A]` の L、確定した値の上では未知）。綴りで断るので、
	// どの定義から解いても G16。
	["区間の相互再帰（h が先）", ["h : x ? [+ [k x]]", "k : x ? h x", "k 1"]],
	["区間の相互再帰（k が先）", ["k : x ? h x", "h : x ? [+ [k x]]", "k 1"]],
	["区間の自己再帰 r : k ? [+ [r k]]（前は通っていた）", ["r : k ? [+ [r k]]"]],
	// 素の関数の本体で、名前の欄の関数を引いて返す（R26 で引いた物は L）。括りの関数の実体の `c : [~r] ? r ' say`（BARE_INST）と同じく、
	// 構造体に入った関数を返す形は利用者に確かめていない（U 2026-10-18 は構造体に入った関数を「完全な裸」と分ける。R33 の R の所）。
	// 断る側に置いた。番号で引いた物・List の要素で受けた物は、形の見え方で未知になって通る（下の「今は」）。
	["名前の欄の関数を引いて返す q : x ? m ' say", [...M, "q : x ? m ' say"]],
	["値の定義の欄の関数を引いて返す q : x ? st ' g", [INC, "st : [g : inc]", "q : x ? st ' g"]],
];
const BARE_INST = [
	// 括りの関数の実体（呼んだ行で、関数と形を名指しする）
	["括りの関数の実体 gi 1 2", [INC, "gi : [x ~xs] ? inc", "gi 1 2"], [["gi", "[N…]"]]],
	["括りの関数の実体を呼ぶ行が定義より先", ["gi 1 2", INC, "gi : [x ~xs] ? inc"], [["gi", "[N…]"]]],
	["括りの関数の部分適用 (tg 1) 2 3", [INC, "tg : [x ~xs] y ? inc", "(tg 1) 2 3"], [["tg", "N A"]]],
	["欄の関数を返す h [g : inc]", [INC, "h : [g] ? g", "h [g : inc]"], [["h", "{g:L}"]]],
	["素の関数の本体から呼ぶ t : y ? gi [y]", [INC, "gi : [x ~xs] ? inc", "t : y ? gi [y]"], [["gi", "A"]]],
	["実体の中の実体 p : [x] ? [y ? p [y]]", ["p : [x] ? [y ? p [y]]", "p [1]"], [["p", "N"], ["p", "A"]]],
	["' で欄の関数を引いて返す c : [~r] ? r ' say", [...M, "c : [~r] ? r ' say", "c m"], [["c", "{say:L other:N}"]]],
];
// 片イ（R125、2026-11-02。U〔答え〕[2026-10-30 17:58 159479c9]「全部 _」）から G16 は廃止：上の2つの表は断らずに通り、本体の返す所に残った裸の関数は
// `_` になって、書いた所に information の bare-function-return が出る（重さは U [2026-10-30 15:28 159479c9]「…まぁinfomationは出そう。」）。
// 表の行は前の G16 の当たる形の記録として残し、通ることと知らせが出ることを見る。括りの関数の実体（BARE_INST）の名指しは、断らないので比べない。
const checkBareUnit = (name, s) => {
	total++;
	let r;
	try {
		r = resolve(s);
	} catch (e) {
		fail(name, `断られた: ${e.reason || e.name} ${e.gate || ""} ${e.message}`);
		return;
	}
	const bare = r.diagnostics.filter((d) => d.reason === "bare-function-return");
	if (!bare.length) fail(name, `bare-function-return が出ていない: ${JSON.stringify(r.diagnostics)}`);
	else if (bare.some((d) => d.severity !== "information" || !d.message.includes("R125"))) fail(name, `bare-function-return の重さか文面が違う: ${JSON.stringify(bare)}`);
	else ok(`${name} → _ と知らせ`);
};
for (const [name, lines] of BARE) checkBareUnit(`Q21 ${name}（前は G16）`, src(lines));
for (const [name, lines] of BARE_INST) checkBareUnit(`Q21 ${name}（前は G16）`, src(lines));
// 片イ（R125）：本体の返す所の恒等射は `(unit …)` で、知らせない（前は G16）。
checkPass("Q21 恒等射 f : x ? !_ は知らせない（前は G16）", src(["f : x ? !_"]), "(: f (? [x] (unit !_)))", null, { diagCount: 0 });
checkPass("Q21 恒等射の名前 f : x ? i（i : !_）も知らせない（前は G16）", src(["i : !_", "f : x ? i"]), "(: f (? [x] (unit i)))", null, { diagCount: 0, at: 1 });
// §5 Q35 の答え（2026-10-21 22:46、G17 は廃止）：`$` で包んだ入れ子の `?` は、`$[+ m]` と同じく本体の根が A で通る。括りの関数の
// 実体でも、呼ぶ行が先でも同じ。呼ぶ行は adder と同じく、足りた適用は A、k > n は A（根、`excess`）、合成の後ろでも A。
const CURRY_PASSES = [
	["$ で包んだ入れ子の ? add : x ? $[y ? x + y]", src(["add : x ? $[y ? x + y]"]), "(: add (? [x] $[y ? x + y]))", null],
	["$ で包んだ入れ子の ? の add 1", src(["add : x ? $[y ? x + y]", "add 1"]), "(apply add 1)", "A"],
	["$ で包んだ入れ子の ? の inc add 1", src([INC, "add : x ? $[y ? x + y]", "inc add 1"]), "(apply (compose inc add) 1)", "A"],
	["$ で包んだ入れ子の ? を呼ぶ行が先", src(["add 1 2", "add : x ? $[y ? x + y]"]), "(construct (apply add 1) 2)", "A", { at: 0, leftover: true }],
	["$ で包んだ括りの関数の ? q : x ? $[[y] ? y]", src(["q : x ? $[[y] ? y]", "q 1"]), "(apply q 1)", "A"],
	["括った ? の本体の $ で包んだ入れ子の ?", src(["[x ? $[y ? x + y]] 5"]), "(apply [x ? $[y ? x + y]] 5)", "A"],
	["括りの関数の実体の根が $ で包んだ入れ子の ?", src(["gi : [x ~xs] ? $[y ? y]", "gi 1 2"]), "(apply gi (construct 1 2))", "A"],
	["括りの関数の実体の木", src(["gi : [x ~xs] ? $[y ? y]", "gi 1 2"]), "(: gi (? [[x ~xs]] (inst [N…] $[y ? y])))", null, { at: 0 }],
];
for (const [name, s, want, kind, extra] of CURRY_PASSES) checkPass(`Q35 答え ${name}`, s, want, kind, extra);
// 入れ子の `?` で断ったときの言い分は、`$` を勧めず、仮引数を並べる書き方だけを勧める（U〔答え〕10-21 16:02「理由は、カリー化は
// システムの側で持つべき。 / ユーザーが明示はね…」）。ほかの裸の関数は `$` を先に勧める（U 10-21 12:50）。
// 片イ（R125）で G16 は廃止、（R120）で G2(a) も廃止したので、言い分は本体の返す所の bare-function-return の知らせの文面で見る（勧め方は前の G16 と同じ）。
{
	const infoOf = (lines) => {
		try {
			const r = resolve(src(lines));
			const d = r.diagnostics.find((x) => x.reason === "bare-function-return");
			return d ? { line: d.line, m: d.message } : { m: `知らせ無し ${JSON.stringify(r.diagnostics)}` };
		} catch (e) {
			return { m: `断られた ${e.gate || e.reason} ${e.message}` };
		}
	};
	const rows = [
		["入れ子の ? の知らせは仮引数を並べる書き方だけ（前は G16 の言い分）", infoOf(["add : x ? y ? x + y"]), (d) => d.m.includes("仮引数を並べて書きます") && !d.m.includes("`$` を付けて")],
		["区間の知らせは $ を先に勧める（前は G16 の言い分）", infoOf(["adder : m ? [+ m]"]), (d) => d.m.includes("`$` を付けて持ち上げます（`$[+ m]`") && d.m.indexOf("`$` を付けて") < d.m.indexOf("仮引数を並べて")],
		// 定義より前の行の G12(b)（下の「今は」）は、根が L なら定義の行の G16 を指す（確かめ 2026-10-22）。
		// 2026-10-23 から G12(b) は G2(a)（R40 の読み6、G12 は廃止）。定義の行の G16 を指すことは同じ。
		// 片イ（R120・R125・R127）からその行は通り、知らせが定義の行（2 行目）を `line` で指す。
		["定義より前の adder 5 3 の知らせは定義の行を指す（前は G2(a) の言い分が G16 を指す、その前は G12(b)）", infoOf(["adder 5 3", "adder : m ? [+ m]"]), (d) => d.line === 2 && d.m.includes("R125")],
	];
	for (const [name, d, good] of rows) {
		total++;
		if (good(d)) ok(`Q21 言い分 ${name}`);
		else fail(`Q21 言い分 ${name}`, JSON.stringify(d));
	}
}
// 数え方（INSTANCE_DEPTH_MARGIN の注の2）：G16 に当たる入れ子の `?` の後ろで呼んだ括りの関数の実体は、最後の木に無いので、確定した
// 実体の総数に数えない。前は前段（根の種類を解く所）で G16 を見ないので数えてしまい、p の実体がちょうど上限（512）のとき、G16 の
// 代わりに総数の G7 を言った（確かめ 2026-10-22。どちらの行の順でも）。素の関数の本体・値の定義・実体の本体のどこでも同じ。
// 片イ（R125）で G16 は廃止：入れ子の `?`・区間の綴りは本体の返す所の `_` と知らせになって断らないので、後ろの `p [m : 1]` も最後の木にあり、
// 下の `$` の行と同じく 512 と合わせて 513 で総数の G7（前は G16）。
{
	const P512 = `a : ${[...Array(512).keys()].map((i) => `(p [k${i} : 1])`).join(" , ")}`;
	const P = "p : [s] ? 1";
	const rows = [
		["素の関数の本体（t が先）（前は G16）", [P, INC, "t : x ? ([z ? inc] 1) , (p [m : 1])", P512], "G7", [["p", ""]]],
		["素の関数の本体（a が先）（前は G16）", [P, INC, P512, "t : x ? ([z ? inc] 1) , (p [m : 1])"], "G7", [["p", ""]]],
		["値の定義（前は G16）", [P, INC, "v : ([z ? inc] 1) , (p [m : 1])", P512], "G7", [["p", ""]]],
		["局所の定義（前は G16）", [P, INC, "t : x ?", "\tk : y ? inc", "\t(p [m : 1]) , 1", "", P512], "G7", [["p", ""]]],
		["実体の本体の入れ子の ?（前は G16 で bad を名指し）", [P, INC, "bad : [y] ? ([z ? inc] 1) , 1", "t : x ? (bad [y : 1]) , (p [m : 1])", P512], "G7", [["p", ""]]],
		["入れ子の ? の本体が区間の綴り（前は G16）", [P, INC, "t : x ? ([z ? [+ inc]] 1) , (p [m : 1])", P512], "G7", [["p", ""]]],
		// 綴りで断る実体の根（区間）は、根の種類が未知でも門に当たる実体に数える（instRootOf）。
		["実体の本体が区間の綴り（前は G16 で bad を名指し）", [P, INC, "bad : [y] ? [+ inc]", "t : x ? (bad [y : 1]) , (p [m : 1])", P512], "G7", [["p", ""]]],
		// `$` で包んだ入れ子の `?` の実体は通る（§5 Q35 の答え、G17 は廃止）ので、後ろの `p [m : 1]` も最後の木にあり、数える（512 と
		// 合わせて 513 で総数の G7）。
		["実体の本体が $ で包んだ入れ子の ?（通るので後ろも数える）", [P, "bad : [y] ? $[z ? z]", "t : x ? (bad [y : 1]) , (p [m : 1])", P512], "G7", [["p", ""]]],
	];
	for (const [name, lines, want, inst] of rows) checkRefused(`Q21 数え方 ${name}`, src(lines), want, inst || undefined);
	// 同じ形で、k の数を 1 つ減らせば、p の実体はちょうど 512 で通る（どちらの行の順でも）。
	const P511 = `a : ${[...Array(511).keys()].map((i) => `(p [k${i} : 1])`).join(" , ")}`;
	const passes = [
		["t が先", [P, "bad : [y] ? $[z ? z]", "t : x ? (bad [y : 1]) , (p [m : 1])", P511]],
		["a が先", [P, "bad : [y] ? $[z ? z]", P511, "t : x ? (bad [y : 1]) , (p [m : 1])"]],
	];
	for (const [name, lines] of passes) {
		checkPass(`Q35 答え 数え方 実体の本体が $ で包んだ入れ子の ?、ちょうど 512（${name}）`, src(lines), "(: bad (? [[y]] (inst {y:N} $[z ? z])))", null, { at: 1 });
	}
}
// 今は：断る行が2つ以上なら行の順に言う（今までどおり）ので、G16 の定義より前の行で根が L の関数を k > n で呼ぶと、その行の
// G12(b) を言う。定義が先なら G16。呼ぶ行を根に置く（`adder 5`）なら、断るのは定義の行だけで、行の順に依らず G16（上の行）。
// 2026-10-23 から、その行の門は G2(a)（種類の未知な適用の後ろに項が来る、R40 の読み6。G12 は廃止）。
// 片イ（R120・R125）から、どちらの行の順でも通り、adder の本体の返す所の `[+ m]` が `_` と知らせになる。
checkPass("Q21 今は 定義より前の adder 5 3（前は G2(a)、その前は G12(b)）", src(["adder 5 3", "adder : m ? [+ m]"]), "(construct (apply adder 5) 3)", "A", { at: 0, severities: ["information/bare-function-return"] });
checkPass("Q21 定義が先なら adder 5 3（前は G16）", src(["adder : m ? [+ m]", "adder 5 3"]), "(construct (apply adder 5) 3)", "A", { severities: ["information/bare-function-return"] });
// 当たらない形
const BARE_PASSES = [
	["$ で値にした関数 adder : m ? $[+ m]", src(["adder : m ? $[+ m]", "adder 5"]), "(apply adder 5)", "A"],
	["$ で値にした関数の定義の行", src(["adder : m ? $[+ m]"]), "(: adder (? [m] $[+ m]))", null],
	["$inc を返す f : x ? $inc", src([INC, "f : x ? $inc", "f 5"]), "(apply f 5)", "A"],
	// 本体の根が未知の関数は G16 に当たらない（足りた適用は未知、k > n は G12(b)。2026-10-23 から G2(a)、R40）。
	["本体の根が未知 use : f x ? @f x", src(["use : f x ? @f x"]), "(: use (? [f x] (apply @f x)))", null],
	// inc を定義する（前は定義が無く、未定義の inc は値なので、2026-10-24 の R53 から `$inc` が G20 になる。この行が見るのは use の本体の根）。
	// 2026-10-26 の R81（§5 Q45 の答え）から、印のある実引数（`$inc`）で呼ぶと実体を作り `@f` は inc で A（下の行）。本体の根が未知のままなのは印の無い実引数で
	// 呼んだ所（`use 5 5`）。
	["本体の根が未知の use $inc 5（R81 で A。前は未知）", src([INC, "use : f x ? @f x", "use $inc 5"]), "(apply use (construct $inc 5))", "A"],
	["本体の根が未知の use 5 5（印の無い実引数は今のまま本体の根で未知）", src(["use : f x ? @f x", "use 5 5"]), "(apply use (construct 5 5))", "未知"],
	// 値の定義は関数を返す本体ではない。
	["値の定義 p : inc", src([INC, "p : inc"]), "(: p inc)", null],
	["値の定義 x2 : !_", src(["x2 : !_"]), "(: x2 !_)", null],
	["値の定義の欄 st : [g : inc]", src([INC, "st : [g : inc]"]), "(: st [g : inc])", null],
	// 呼ばれない括りの関数は本体を読まない（R25）。
	["呼ばれない括りの関数 gi : [x ~xs] ? inc", src([INC, "gi : [x ~xs] ? inc"]), "(: gi (? [[x ~xs]] (defer {inc})))", null],
	// 括りの関数は渡された物で根が決まる：数を渡せば根は値。
	["数を受けた h [g : 1]", src(["h : [g] ? g", "h [g : 1]"]), "(: h (? [[g]] (inst {g:N} g)))", null, { at: 0 }],
	// 関数を本体の中で呼んだ結果は関数でない。
	["本体で関数を呼ぶ f : x ? inc x", src([INC, "f : x ? inc x"]), "(: f (? [x] (apply inc x)))", null],
	// 今は：字下げのブロックの本体は、全部の行（枝なら値の側）の根が A のときだけ A で、ほかは未知（§3.4）。根が L になることは
	// 無いので、最後の行や枝の値が裸の関数でも G16 に当たらない。ブロックの本体の根を行からどう決めるか（手続きの最後の行・枝の
	// 値）は §3.4 の外で、決まっていない（R33 の R の所）。決まったら、この行を見直す。
	// 2026-10-26 の R76（§5 Q37 の答え：2行以上の手続きの行は評価する所）で、行の丸ごとの関数は余ったラムダで `_`（知らせる）。前は `(block x inc)`。
	// 手続きは `l1 & … & ln` なので、最後の行も1行の `f : x ? x & inc` の右の被演算子と同じ。1行だけの本体 `f : x ?` ⏎ `⇥inc` は、同じ日の確かめの直しから
	// 1行の本体の根と同じ所で G16（いちばん後ろの「R73〜R79」の節の断られる側。R76 の最初の版は `(block (unit inc))` で通していた）。
	["R76 字下げの手続きの最後の行が関数（前は `(block x inc)`）", src([INC, "f : x ?", "\tx", "\tinc", ""]), "(: f (? [x] (block x (unit inc))))", null, { leftoverDiag: ["inc"] }],
	// `$` で値にした部分適用（D type_system.md の `g : x ? $(add3 x + 1)` と同じ形）は G16 に当たらない。
	["$ で値にした部分適用 q : x ? $[add x]", src(["add : a b ? a + b", "q : x ? $[add x]", "q 1"]), "(apply q 1)", "A"],
	// 今は（§5 Q35）：次の形は、裸の関数を返すのに根が L にならないので G16 に当たらない。どれも通すか決まっていない。決まったら、
	// この行を見直す。
	// - 仮置きの上でだけ根が L になる関数（h は k の仮置き A の上では引いた区間で L、確定した値の上では未知。区間を欄に入れて引くと、
	//   引いた物は被演算子が未知の区間で、種類が未知になる）。どの定義から解いても断らない（仮置きの途中で断ると、解く順で割れる）。
	// 片イ（R125）：引いた区間は本体の返す所の裸の関数なので `(unit …)` と知らせになり、h は `_` を返して `k 1` は A（前は未知）。
	["今は 区間を欄に入れて引いて返す（h が先）（前は未知）", src(["h : x ? [s : [+ [k x]]] ' s", "k : x ? h x", "k 1"]), "(apply k 1)", "A", { severities: ["information/bare-function-return"] }],
	["今は 区間を欄に入れて引いて返す（k が先）（前は未知）", src(["k : x ? h x", "h : x ? [s : [+ [k x]]] ' s", "k 1"]), "(apply k 1)", "A", { severities: ["information/bare-function-return"] }],
	["今は 区間を欄に入れて引いて返す h の行（k が先）（前は `(unit …)` 無し）", src(["k : x ? h x", "h : x ? [s : [+ [k x]]] ' s", "k 1"]), "(: h (? [x] (unit (' [s : [+ [k x]]] s))))", null, { at: 1 }],
	// - 1行の条件の値が関数（段4〜8 の中置は、被演算子が全部 A でなければ未知。§2）。2026-10-26 の R76（§5 Q37 の答え：論理の被演算子は評価する所）で、
	//   被演算子の丸ごとの関数は `_` になって知らせる（前は `(| (& (= x 0) inc) double)` で未知）。
	["R76 1行の条件の値が関数 q : x ? x = 0 & inc | double（前は被演算子が L のまま）", src([INC, DOUBLE, "q : x ? x = 0 & inc | double"]), "(: q (? [x] (| (& (= x 0) (unit inc)) (unit double))))", null, { leftoverDiag: ["inc", "double"] }],
	// - 関数を並べた器を返す（`,` は A。D type_system.md は止める側、U 2026-10-18 は構造体に入った関数を「完全な裸」と分ける）。
	// 片イ（R123）：`,` の被演算子に丸ごと残った関数は `_`（木は `(unit …)`）と leftover-lambda（前は `(, inc double)`）。
	["今は 関数を並べた器を返す q : x ? inc , double（前は `(, inc double)`）", src([INC, DOUBLE, "q : x ? inc , double"]), "(: q (? [x] (, (unit inc) (unit double))))", null, { leftoverDiag: ["inc", "double"] }],
	// - 番号で引いた関数を返す（要素が混ざった器から番号で引くと、R26 で未知。名前の欄を引くと L で G16）。
	["今は 番号で引いた関数を返す q : x ? fs ' 0", src([INC, DOUBLE, "fs : inc , double , 3", "q : x ? fs ' 0"]), "(: q (? [x] (' fs 0)))", null],
	// - 解かない位置（P3：既定値・1項の `:` の左）に書いた `?`。
	["今は 既定値の中の ? o : [x : [y ? inc]] ? 5", src([INC, "o : [x : [y ? inc]] ? 5"]), "(: o (? [[x : [y ? inc]]] 5))", null],
];
for (const [name, s, want, kind, extra] of BARE_PASSES) checkPass(`Q21 ${name}`, s, want, kind, extra);

// ---------------------------------------------------------------------------
// 余りと流れ（2026-10-22、R35〜R39。§5 Q11・Q4・Q6・Q8 の答え）
// ---------------------------------------------------------------------------
//
// - R35（Q11 の答え、U〔答え〕10-21 23:10「余った引数は後ろに積んでいい。」）：実引数がアリティより多い適用は、前から n 個を当てた
//   適用の後ろに、余りを値として並べる（構築）。`f1 3 4` は `(construct (apply f1 3) 4)`。印 excess と、余りの節が対に入る G12(a) は
//   無くなった。頭の本体の根が A でない k > n（G12(b)、`use $inc 5 3`）と get・set の k > 2 は今のまま断る。
// - R36（Q4 の答え、U〔答え〕10-21 23:18「合ってる。」）：括らない余積の並びの合成は、実引数の並びを流れとして左から畳む。
//   `f2 3 f2 5 6` は `f2 (f2 3 5) 6`、`inc f2 5 6` は `f2 (inc 5) 6`、`inc inc 5 6` は `(inc (inc 5)) 6`。G2(b) は要らなくなった。
// - R37（Q6 の答え、U〔答え〕10-21 23:23「合ってる。」）：逆適用の左が2項以上なら、一番近い1項だけを取り、残りは前に積む。
//   `1 2 inc` は `1 (2 inc)`。G1 は廃止した。余りを積んだ構築の後ろの逆適用（`inc 1 2 inc`）は、R37 の `(inc 1) (inc 2)` と、R36 の
//   流れ（`inc 1` の結果を流れの頭に戻して次の関数が取る）の `inc (inc 1)` の後ろに 2 で割れるので、G12(a) で断る（主の Claude の読み、R）。
// - R38（主の Claude が法則から書いた物、R）：既定値の無い素の関数の内側の `_` は、k ≠ n でも `!_` と同じ（`f _ 3 4` は `f 4 3`）。
// - R39（Q8 の一部の答え、U〔答え〕10-21 23:42「そうなるね。」）：既定値のある口に書いた `_` は既定値という値（木では実引数のまま残す）。
// 2026-10-23 の左からの畳み込み（R40〜R43）で、R36 の流れと R37 の「一番近い1項」は、畳み込みの1歩（後から来る物は最初の関数から順に
// 流れ込む・逆適用はいちばん上の値を取る）そのものになり、一度まとめた並びをほどき直す仕組み（take・leftover・流れの組み立て直し）と
// G12 は要らなくなった。答えの変わった行は、行の注に規則の番号を書いた。後ろの関数が並びの項を受けた合成は、各関数が受けた物の
// 見える入れ子の適用で書く（R40 の読み9、§1.3）。
// 2026-10-24 の逆適用の廃止（R47）で、R37（一番近い1項）も廃止した：値の後ろの関数は積まれて、値を取らない（関数は右からだけ受ける）。
// 根に余った関数は `_`（R42）で、構築の中で消え、余ったことは leftover-lambda で知らせる（R48）。行の名前の「前は」に、2026-10-23 の逆適用の
// 答えを足した。
const ADEF =["sub : x y ? x - y", "pt : [a ~as] y ? y", "kf : [f] ? f 1"];
const GF = "gf : [x : 1] y ? y"; // 既定値のある口が前（位置 0）
const GB = "gb : [x : 1] [y : 2] ? x"; // 口が2つとも既定値
const GZ = ["gz :", "\t\ta b", "\t\tc : 3", "\t? a", ""]; // 仮引数の数が数えられない既定値のある関数
const flowPasses = [
	// R35
	["R35 inc 3 4", std("inc 3 4"), "(construct (apply inc 3) 4)", "A", { leftover: true }],
	["R35 f2 5 6 7", std("f2 5 6 7"), "(construct (apply f2 (construct 5 6)) 7)", "A", { leftover: true }],
	// U〔答え〕10-21 23:10 の前の問いの例（主の Claude の言葉）：`f1 3 4 f2 5 6 f1 6` は `(f1 3) 4 (f2 5 6) (f1 6)`。前は G12(a)。2026-10-23
	// は、f2 が 4 を逆適用で取り、口が決まらない（§5 Q5）まま 5 が来るので G8（R40）。R47 で、問いの例の答えの `(inc 3) 4 (f2 5 6) (inc 6)`
	// に戻った（norevPasses）。
	// `5 d 1 2 _` は、R47 で `5 (d 1) 2`（2026-10-22 の強さの順と同じ木。2026-10-23 は逆適用で `(d 5) 1 2`）。後ろの `_` は値の隣で消える（R43）。
	// 根は最初の項が 5 の構築なので、leftover の形（最初の子が適用）でない。
	["R35 5 d 1 2 _（`5 (d 1) 2`、R47。前は G12(a)、その後 `5 (d 1) 2`・`(d 5) 1 2`）", std("5 d 1 2 _"), "(construct 5 (apply d 1) 2)", "A", { leftover: false }],
	["R35 [add !_ 10] 5 6（穴の関数）", std("[add !_ 10] 5 6"), "(construct (apply [add !_ 10] 5) 6)", "A", { leftover: true }],
	["R35 pt [1] 2 3（最後の仮引数が裸の括りの関数）", std([...ADEF, "pt [1] 2 3"]), "(construct (apply pt (construct [1] 2)) 3)", "A", { leftover: true }],
	// R34 の k < n で作った関数は、最後の括りが残りの並び全体を受ける（R24。可変長の口、R41）ので、その関数の所では木を切らない（f3・add
	// の余りは、関数の本体の中で後ろに積まれる）。2026-10-23 から節の印 leftover は無く、根は1つの適用（leftover の形でない）。
	["R35 (add !_) 1 2 3（最後の括りが受ける。R41）", std("(add !_) 1 2 3"), "(apply [add !_] (construct 1 2 3))", "A", { leftover: false }],
	["R35 (f3 !_ 2) 1 vs 4（最後の括りに2つ入るので G13 にならない）", std("(f3 !_ 2) 1 vs 4"), "(apply [f3 !_ 2] (construct 1 vs 4))", "A"],
	// 積んだ構築は値（名前や括りで包めば1つの項）。2026-10-23 までは後ろの逆適用がそれを受けた（`(apply inc v ·rev)`）。R47 で、後ろの inc は
	// 積まれて余る（R42・R48）。
	["R35 v : inc 3 4 ⏎ v inc（R47）", std(["v : inc 3 4", "v inc"]), "(construct v (unit inc))", "A"],
	["R35 (inc 3 4) inc（R47）", std("(inc 3 4) inc"), "(construct [inc 3 4] (unit inc))", "A"],
	// R36
	// 後ろの f2 が並びの 6 を受けたので、木は各関数が受けた物の見える入れ子の適用（R40 の読み9。前は `(apply (compose (apply f2 3) f2)
	// (construct 5 6))` で、流れが木に出なかった）。
	["R36 f2 3 f2 5 6（`f2 (f2 3 5) 6`。木は入れ子、R40）", std("f2 3 f2 5 6"), "(apply f2 (construct (apply f2 (construct 3 5)) 6))", "A"],
	["R36 sub 3 sub 5 6（`sub (sub 3 5) 6`、ポーランドの `sub 3 (sub 5 6)` ではない。木は入れ子、R40）", std([...ADEF, "sub 3 sub 5 6"]), "(apply sub (construct (apply sub (construct 3 5)) 6))", "A"],
	["R36 inc f2 5 6（`f2 (inc 5) 6`。前は未知。木は入れ子、R40）", std("inc f2 5 6"), "(apply f2 (construct (apply inc 5) 6))", "A"],
	["R36 inc inc 5 6（`(inc (inc 5)) 6`。前は excess）", std("inc inc 5 6"), "(construct (apply (compose inc inc) 5) 6)", "A", { leftover: true }],
	["R36 [f2 3 f2] 5 6（括っても同じ）", std("[f2 3 f2] 5 6"), "(apply [f2 3 f2] (construct 5 6))", "A"],
	["R36 f2 3 f2 5（流れが足りない、L。根なので `_`、R42）", std("f2 3 f2 5"), "(unit (apply (compose (apply f2 3) f2) 5))", "A"],
	["R36 (f2 3 f2 5) 6（足りない合成に後から当てる）", std("(f2 3 f2 5) 6"), "(apply [f2 3 f2 5] 6)", "A"],
	["R36 f2 3 f2 5 6 7（流れの余りは後ろに積む。木は入れ子、R40）", std("f2 3 f2 5 6 7"), "(construct (apply f2 (construct (apply f2 (construct 3 5)) 6)) 7)", "A", { leftover: true }],
	["R36 (inc add 5) 3（前は G7）", std("(inc add 5) 3"), "(apply [inc add 5] 3)", "A"],
	["R36 q : inc add 5 ⏎ q 3 4", std(["q : inc add 5", "q 3 4"]), "(construct (apply q 3) 4)", "A", { leftover: true }],
	["R36 inc add 5 g 3（`g (add (inc 5) 3)`。前は G2(a)。木は入れ子、R40）", std("inc add 5 g 3"), "(apply g (apply add (construct (apply inc 5) 3)))", "A"],
	["R36 inc add add 5 3 4（木は入れ子、R40）", std("inc add add 5 3 4"), "(apply add (construct (apply add (construct (apply inc 5) 3)) 4))", "A"],
	["R36 inc add add 5 3（流れが足りない、L。根なので `_`、R42。木は入れ子、R40）", std("inc add add 5 3"), "(unit (apply add (apply add (construct (apply inc 5) 3))))", "A"],
	["R36 inc pt [5] 6（後ろの括りの関数も流れから取る。木は入れ子、R40）", std([...ADEF, "inc pt [5] 6"]), "(apply pt (construct (apply inc [5]) 6))", "A"],
	// 段18 の点なしは、流れの前が1項のときだけ口を1つと数える（直に当てた `[' 0] [1 2] 3` の k ≠ 1 は未知のまま、R35 の R の所）。
	// 前（2026-10-22 の確かめの前）は流れの中でだけ 1 と数え、`[' 0] add [1 2] 3` を A にしていた（同じ関数の口の数が2か所で割れる）。
	// 2026-10-26 の R77（§5 Q39 の答え：`[' 0]` は口1つ）から、流れの前が何項でも口1つで、後ろの関数が余りを取る（下の3行。前は2項なら未知）。
	["R36 [' 0] add [1 2] 3（R77 で `add ([' 0] [1 2]) 3`。前は流れが2項なので未知）", std("[' 0] add [1 2] 3"), "(apply add (construct (apply [' 0] [1 2]) 3))", "A"],
	["R36 [' 0] add [1 2]（流れが1項なら口を1つと数える、L。根なので `_`、R42）", std("[' 0] add [1 2]"), "(unit (apply (compose [' 0] add) [1 2]))", "A"],
	["R36 ([' 0] add [1 2]) 3（流れの足りない合成に後から当てる）", std("([' 0] add [1 2]) 3"), "(apply [[' 0] add [1 2]] 3)", "A"],
	["R36 [' 0] inc [1 2] 5（R77 で `(inc ([' 0] [1 2])) 5`。前は流れが2項なので未知）", std("[' 0] inc [1 2] 5"), "(construct (apply (compose [' 0] inc) [1 2]) 5)", "A"],
	// 後ろの段18 の点なしも、流れの余りが無ければ口を1つと数える。流れの足りない合成を畳み直すときは、作った時に1項を取った段18 の
	// 点なし（括りの中で、前の結果1項を前にした物）を、後から来た実引数に依らず 1 と数える（変異で確かめた）。
	["R36 [' 0] [' 0] add [[1 2] [3 4]]（後ろの段18 も、余りが無ければ口を1つ、L。根なので `_`、R42）", std("[' 0] [' 0] add [[1 2] [3 4]]"), "(unit (apply (compose [' 0] [' 0] add) [[1 2] [3 4]]))", "A"],
	["R36 ([' 0] [' 0] add [[1 2] [3 4]]) 5（括りの中で取った数は変わらない）", std("([' 0] [' 0] add [[1 2] [3 4]]) 5"), "(apply [[' 0] [' 0] add [[1 2] [3 4]]] 5)", "A"],
	["R36 [' 0] [' 0] add [[1 2] [3 4]] 5（R77 で add が 5 を取る。前は最初の段18 の前に2項で未知）", std("[' 0] [' 0] add [[1 2] [3 4]] 5"), "(apply add (construct (apply [' 0] (apply [' 0] [[1 2] [3 4]])) 5))", "A"],
	["R36 ||inc add 5|| 3（ノルムの合成に包んだ足りない合成）", std("||inc add 5|| 3"), "(apply ||inc add 5|| 3)", "A"],
	["R36 kf [f : inc add 5]（欄で渡した足りない合成）", std([...ADEF, "kf [f : inc add 5]"]), "(apply kf [f : inc add 5])", "A"],
	["R36 kf [f : pt2 inc [5]]（先に当てた物の形で実体を作る）", src(["inc : x ? x + 1", "pt2 : [a ~as] y ? a 1", "kf : [f] ? f 1", "kf [f : pt2 inc [5]]"]), "(: pt2 (? [[a ~as] y] (inst N A (construct a 1))))", null, { at: 1 }],
	["R36 pair [1] inc 5（前は G2(b)）", src(["inc : x ? x + 1", "pair : [a ~as] [b ~bs] ? a + b", "pair [1] inc 5"]), "(apply (compose (apply pair [1]) inc) 5)", "A"],
	["R36 pair inc [1] double 5（前は G2(b)）", src([INC, DOUBLE, "pair : [a ~as] [b ~bs] ? a + b", "pair inc [1] double 5"]), "(apply (compose (apply (compose pair inc) [1]) double) 5)", "A"],
	// R47：5 の後ろに inc が積まれ、add はその合成の後ろに入る。根に余って `_`（R42・R48）。2026-10-23 は `5 inc` が逆適用で値になり、
	// add がそれを逆適用で取って主語の口が決まらないまま行の終わりで `_`（`(unit (apply add (apply inc 5 ·rev) ·rev))`）、その前は合成
	// `inc add` に 5 を逆適用した L。
	["R36 5 inc add（R47。前は L、その後 逆適用の `_`）", std("5 inc add"), "(construct 5 (unit (compose inc add)))", "A"],
	// 並び全体を受ける関数は、並びの終わりまで受ける（R41）。
	["R36 add [+] 5 6（`[+]` は前の結果だけを受ける）", std("add [+] 5 6"), "(apply (compose add [+]) (construct 5 6))", "未知"],
	// 最初の `[+]` が 5 6 を受けて閉じ、結果が add の最初の口に入る。add はもう1つの口を待つ L で、根なので `_`（R41・R42。前は、`[+]` の後ろの
	// 関数は前の結果だけを受けて未知）。
	["R36 [+] add 5 6（最初の `[+]` は並び全体を受ける。add は残りの口を待つ、R41・R42。前は未知）", std("[+] add 5 6"), "(unit (apply (compose [+] add) (construct 5 6)))", "A"],
	// R37（2026-10-24 に廃止、R47）。前は一番近い1項を逆適用で取って、残りを前に積んだ（`1 2 3 inc` は `1 2 (inc 3)`）。R47 では、値の後ろの
	// 関数は値を取らずに積まれ、根に余れば `_`（R42・R48）。行の名前の頭の R37 は、前の規則の見本だった印として残す。
	["R37 1 2 3 inc（R47。前は `1 2 (inc 3)`）", std("1 2 3 inc"), "(construct 1 2 3 (unit inc))", "A"],
	// R47 で `5 (inc 3)` の後ろに inc が余る。2026-10-23 は逆適用で `(inc 5) (inc 3)`、その前は強さの順で `5 (inc (inc 3))`、その前は G1。
	["R37 5 inc 3 inc（R47。前は G1、その後 `5 (inc (inc 3))`・`(inc 5) (inc 3)`）", std("5 inc 3 inc"), "(construct 5 (apply inc 3) (unit inc))", "A"],
	["R37 vs~ 1 inc（R47。前は `vs~ (inc 1)`）", std("vs~ 1 inc"), "(construct vs~ 1 (unit inc))", "A"],
	["R37 1 2 inc inc（R47。前は `1 (inc (inc 2))`）", std("1 2 inc inc"), "(construct 1 2 (unit (compose inc inc)))", "A"],
	["R37 1 2 inc 3 double（R47。前は `1 2 (double (inc 3))`・`1 (inc 2) (double 3)`）", std("1 2 inc 3 double"), "(construct 1 2 (apply inc 3) (unit double))", "A"],
	// 本体は評価する所でない（R42 の読み1）が、2026-10-24 の R52 から、値の上に積まれて何も受けずに閉じた inc は余ったラムダで `_`。R47 の最初の
	// 版は、ラムダのまま残って値と関数の並んだ構築が種類を決めなかった（未知、§5 Q38）。その前は逆適用で `(construct 1 (apply inc y ·rev))`、A。
	["R37 本体 1 y inc（R52。R47 では未知（Q38）、その前は A）", std("t : y ? 1 y inc"), "(construct 1 y (unit inc))", "A", { body: true, leftoverDiag: ["inc"] }],
	// R38（2026-10-28 の R105 で廃止：書いた `_` は値の口で消え、穴にならない。下の4行は R105 の答えに直した。前の答えは名前の「前は」に書いた）
	["R38 f3 _ 2（R105 で `f3 2`。根なので `_`、R42。前は `a [~c] ? f3 a 2 c~`）", std("f3 _ 2"), "(unit (apply f3 2))", "A"],
	["R38 f2 _ 3 4（R105 で `f2 3 4`。前は `f2 4 3`）", std("f2 _ 3 4"), "(apply f2 (construct 3 4))", "A"],
	["R38 add _ 3 4 5（R105 で `add 3 4` の後ろに 5 を積む。前は `add 4 3` の後ろに 5）", std("add _ 3 4 5"), "(construct (apply add (construct 3 4)) 5)", "A", { leftover: true }],
	["R38 inc _ 5", std("inc _ 5"), "(apply inc 5)", "A"],
	["R38 add 1 _ 5", std("add 1 _ 5"), "(apply add (construct 1 5))", "A"],
	["R38 f3 _ 2 _ 9（R105 で `f3 2 9`。根なので `_`、R42。前は穴が残る `(unit (? [$p0] (apply f3 (construct 9 2 $p0))))`）", std("f3 _ 2 _ 9"), "(unit (apply f3 (construct 2 9)))", "A"],
	["R38 (f3 _ 2) 1 3", std("(f3 _ 2) 1 3"), "(apply [f3 _ 2] (construct 1 3))", "A"],
	// R39
	["R39 gf _ 3（既定値のある口の _）", std([GF, "gf _ 3"]), "(apply gf (construct _ 3))", "未知"],
	["R39 gb _ _（口が2つとも既定値）", std([GB, "gb _ _"]), "(apply gb (construct _ _))", "未知"],
	["R39 g2 : gf ⏎ g2 _ 3（別名の頭でも同じ関数）", std([GF, "g2 : gf", "g2 _ 3"]), "(apply g2 (construct _ 3))", "未知"],
	["R39 go !_ _（既定値のある口の _ と穴。根なので `_`、R42）", std([...GO_DEFAULT, "go !_ _"]), "(unit (? [$p0] (apply go (construct $p0 _))))", "A"],
	["R39 go !_ _ 5（`!_` も口を1つ占めて数える）", std([...GO_DEFAULT, "go !_ _ 5"]), "(apply go (construct 5 _))", "未知"],
	// 2026-10-23 の左からの畳み込み（R40）で、前は G12(a)・G12(c)・G13・G8 で断っていた形が通る。
	// 余りの後ろの関数は、2026-10-23 はいちばん上の余りを逆適用で取った（R40。前は R37 と R36 で割れる G12(a)）。R47 で、積まれて余る
	// （R42・R48）。`inc 1 2 inc` は `(inc 1) 2`（U〔答え〕[2026-10-23 15:32 ebf18260] の前に主の Claude が示した表の形）。
	["R40 inc 1 2 inc（`(inc 1) 2`、R47。前は G12(a)、その後 `(inc 1) (inc 2)`）", std("inc 1 2 inc"), "(construct (apply inc 1) 2 (unit inc))", "A"],
	["R40 5 inc 3 4 inc（R47。前は G12(a)、その後 `(inc 5) 3 (inc 4)`）", std("5 inc 3 4 inc"), "(construct 5 (apply inc 3) 4 (unit inc))", "A"],
	["R40 inc 1 2 3 inc（R47。前は G12(a)、その後 `(inc 1) 2 (inc 3)`）", std("inc 1 2 3 inc"), "(construct (apply inc 1) 2 3 (unit inc))", "A"],
	["R40 inc inc 5 6 inc（R47。前は G12(a)、その後 `… (inc 6)`）", std("inc inc 5 6 inc"), "(construct (apply (compose inc inc) 5) 6 (unit inc))", "A"],
	// 最後の括りは並びの終わりまで受ける（R41）ので、後ろの inc は合成の後ろに入り、閉じた値を受ける（前は、中で積んだ余りの後ろの逆適用・
	// 合成の次の関数で G12(a)・G12(c)）。並びを全部受けてから後ろに関数が来る形の木は入れ子の適用（2026-10-23 までは値の後ろの逆適用と
	// 同じ `·rev` の綴り、renderEntry の trailingFrom。R47 で無くなった）。
	["R41 [f3 !_ 3] 7 8 9 inc（`inc (f3 7 3 8 9)`。前は G12(a)）", std("[f3 !_ 3] 7 8 9 inc"), "(apply inc (apply [f3 !_ 3] (construct 7 8 9)))", "A"],
	["R41 [f3 !_ 3] inc 7 8 9（前は G12(c)）", std("[f3 !_ 3] inc 7 8 9"), "(apply (compose [f3 !_ 3] inc) (construct 7 8 9))", "A"],
	// 値の後ろの f2 は積まれて、根に余って `_`（R47・R42・R48）。構築の中に残ったラムダは R15 で消える（`1 2 f2` の値は `1 2`。2026-10-23 は
	// f2 が 2 を逆適用で取って主語の口が決まらないまま `_` で、値は 1）。前は G8。
	["R42 1 2 f2（R47。前は G8、その後 `1 (2 f2)`）", std("1 2 f2"), "(construct 1 2 (unit f2))", "A"],
	["R42 1 5 inc add（R47。前は G8、その後 `1 (add (inc 5))`）", std("1 5 inc add"), "(construct 1 5 (unit (compose inc add)))", "A"],
	// 流れの余りが並び全体を受ける関数に届く：その関数は並びの終わりまで受ける（R41。前は G12(c)、§5 Q13 の残り）。
	["R41 inc [+] 5 6（`[+] (inc 5) 6`。前は G12(c)）", std("inc [+] 5 6"), "(apply [+] (construct (apply inc 5) 6))", "A"],
	["R41 inc [* 2,] 5 6（前は G12(c)）", std("inc [* 2,] 5 6"), "(apply [* 2,] (construct (apply inc 5) 6))", "A"],
	// 恒等射が2項以上を受けても、後ろに関数が続かなければ割れない（R29 でも単位律でも `(inc 5) 6` の並び）。前は G12(c)。
	["R41 inc i 5 6（恒等射。前は G12(c)）", std(["i : !_", "inc i 5 6"]), "(apply i (construct (apply inc 5) 6))", "A"],
	["R41 add [+] 5 6 7（`[+] (add 5 6) 7`。前は G12(c)）", std("add [+] 5 6 7"), "(apply [+] (construct (apply add (construct 5 6)) 7))", "A"],
	// R34 の k < n で作った関数の最後の括りに1つで入った物は、[x] ≅ x で中身の並び（規則の文面。前は G13）。
	["R41 (f3 _ 2) 1 vs（vs を撒いて f3 の余り。前は G13）", std("(f3 _ 2) 1 vs"), "(apply [f3 _ 2] (construct 1 vs))", "A"],
	["Q31 (f3 !_) 1 [1 2]（`f3 1 1 2`、規則の文面。前は G13）", std("(f3 !_) 1 [1 2]"), "(apply [f3 !_] (construct 1 [1 2]))", "A"],
	// 片イ（R120）：種類の未知な適用・値でない結果の後ろの項は、木では積む予想で通る（前は G2(a)、その前は G12(b)）。
	["R35 uu 5 3（本体の根が未知。前は use $inc 5 3）（前は G2(a)、その前は G12(b)）", std(["uu : x ? [,] x", "uu 5 3"]), "(construct (apply uu 5) 3)", "未知"],
	["R35 ['] fs 0 1（get の k > 2）（前は G2(a)、その前は G12(b)）", std("['] fs 0 1"), "(construct (apply ['] (construct fs 0)) 1)", "未知", { severities: ["information/pointfree-not-folded"] }],
	["R36 inc uu 5 6（余りの前の結果が値でない）（前は G2(a)、その前は G12(b)）", std(["uu : x ? [,] x", "inc uu 5 6"]), "(construct (apply (compose inc uu) 5) 6)", "未知"],
	// 鍵の行は、片イ（R120）で pt2 の `a 1` が積む予想で通る（前は G7）。先に当てた物の形が鍵に入ることは、pt2 の実体が `[5]` の N と `[$inc]` の A で
	// 2つに分かれることで見る（鍵に入れなければ、後の行は先の実体を黙って使う）。
	[
		"R36 鍵 w : kf [f : pt2 inc [5]] の後の kf [f : pt2 inc [$inc]] の pt2 は実体が2つ（前は G7）",
		src(["inc : x ? x + 1", "pt2 : [a ~as] y ? a 1", "kf : [f] ? f 1", "w : kf [f : pt2 inc [5]]", "kf [f : pt2 inc [$inc]]"]),
		"(: pt2 (? [[a ~as] y] (inst A A (construct a 1)) (inst N A (construct a 1))))",
		null,
		{ at: 1 },
	],
	// 片イ（R125）：流れで足りない適用になる本体の根は裸の関数なので `(unit …)` と知らせ（前は G16）。
	["R36 ff : x ? inc add x（本体の根が L）（前は G16）", std("ff : x ? inc add x"), "(: ff (? [x] (unit (apply (compose inc add) x))))", null, { at: -1, severities: ["information/bare-function-return"] }],
	// 片イ（R126）：G15 は廃止。書いた `_` は木では消える予想で、既定値のある口に当たるかは値の段が並びを読んで決める（前は G15）。
	["R39 go 1 2 _ 3（仮引数の外の内側の `_`）（前は G15）", std([...GO_DEFAULT, "go 1 2 _ 3"]), "(apply go (construct 1 2 3))", "未知"],
	["R39 gz _ 3（仮引数の数が数えられない）（前は G15）", std([...GZ, "gz _ 3"]), "(apply gz 3)", "未知"],
];
const flowRefused = [
	// R35 の残り：種類の未知な適用の後ろに項が来る（R40 の読み6。G12(b) → G2(a)、G12 は廃止）。
	// 2026-10-26 の R81 で `use $inc 5` が A になった（`use $inc 5 3` は余りを積んで通る、いちばん後ろの「R80〜R82」の節）ので、本体の根が未知の uu にした。
	// 片イ（R120）で、この2行は上の flowPasses へ移した。
	// 前の R37 と R36 の割れ（G12(a)）・R36 の残り（G12(c)）は、左からの畳み込みで答えが1つに決まり、上の flowPasses の R40・R41 の行へ移した。
	// `inc 3 4 f2 5 6 inc 6`（2026-10-23 は G8：f2 が 4 を逆適用で取り、5 が来る）と、逆適用の主語の門の `1 vs~ inc`（G9、R14）は、
	// 逆適用の廃止（R47。G8・G9 も廃止）で通る側（norevPasses）へ移した。
	// `1 2 [+ 1]`（右が点なし。前は G10）は、R13 を廃止して `1 ([+ 1] 2)`（R40）、R47 から `1 2` の後ろに余る。下の「左からの畳み込み」の
	// pfReversePasses へ移した。
	// 結果が値でない関数の後ろに項が来る（R40 の読み6。G12(b) → G2(a)）。
	// 片イ（R120）で、`inc uu 5 6` は上の flowPasses へ移した。
	// `5 use 5 inc`（逆適用の右の足りない合成は R12 の形でない、G8）は、R47 で通る側（norevPasses。上の「穴」の同じ行と1つにした）へ移した。
	// 流れの足りない合成の鍵には、先に当てた物の形を入れる（括りの関数の部分適用の鍵と同じ）。入れないと、先に解いた `[5]` の実体
	// （A）を、`[$inc]`（中身の見えない A。pt2 の a が未知で G7）の行が黙って使う（変異で確かめた）。
	// 片イ（R120）で、鍵の行は上の flowPasses へ移した（pt2 の実体の数で見る）。
	// 流れで足りない適用になる本体の根は裸の関数（R33）。前は未知の根で通っていた。片イ（R125）で上の flowPasses へ移した。
	// R38 の残り（R34 の G13 と同じ）
	// `inc 1 _ 2`（前から n 個の外の `_`、G13。その前は G5）は、2026-10-27 の R89（§5 Q40 の残りの答え：閉じた `inc 1` の後ろの `_` は値の隣で消える）で
	// 通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	// 2026-10-28 の R105 で、`_` が消えて `f3 vs~`（口が3つ残る関数に撒いた流れ、R51 の G19）・`go vs~`（口が1つで書き下し、通る）と同じになった。`go _ vs~` は通る側
	// （いちばん後ろの「R105〜R110」の節）へ移した。
	["R38 f3 _ vs~（R105 で `f3 vs~` と同じ G19。前は R38 の G13、その前は G5）", std("f3 _ vs~"), "G19"],
	// `(f3 _ 2) 1 vs`（前は G13）は、R34 の k < n の G13 が無くなって通る（上の flowPasses の R41 の行）。
	// `(f3 _ 2) 1 _`（R34 の関数に書いた末尾の `_`、G5）と `f4 _ 2 _`（最後の項が `_`、G5）は、2026-10-26 の R28 の書き直し（末尾の `_` は消えてから穴の
	// 規則を見る）で、`(f3 _ 2) 1`・`f4 _ 2` と同じく通る側（いちばん後ろの「R28」の節）へ移した。
	// 今のまま：k = n の撒く項 → `add _ vs~`（G5）は、2026-10-28 の R105 で `add vs~`（R51 の畳み込み）と同じく通る側（いちばん後ろの「R105〜R110」の節）へ移した。
	// R39 の残り（G15）。内側の `_` が既定値の無い口に当たる `go _ 3`（G15）は、2026-10-26 の R68（§5 Q8 の答え：カリー化）で通る側（いちばん後ろの
	// 「R64〜R72」の節）へ移した。仮引数の外の末尾の `_`（`go 1 2 _`、G15）は、同じ日の R28 の書き直し（既定値の無い口・仮引数の外の末尾の `_` は消える）で
	// 通る側（いちばん後ろの「R28」の節）へ移した。仮引数の外の内側の `_` は今のまま G15。
	// 片イ（R126）で G15 は廃止。`go 1 2 _ 3` と下の `gz _ 3` は上の flowPasses へ移した。
	// R51（2026-10-24）：既定値のある go は口の数が分からないので、撒いた流れ xs~ が来た所で G19（前は `_` の所で G15。どちらも断る）。
	["R39 go xs~ _（前に撒く項。R51 の G19。前は G15）", std([...GO_DEFAULT, "go xs~ _"]), "G19"],
	// `go _ !_`（既定値の無い口の `_` と穴、G15）は、R68 で `_` がカリー化の穴になり、穴2つの関数で通る（いちばん後ろの「R64〜R72」の節）。
	// `5 gf inc _`（2026-10-23 は G8：gf が 5 を逆適用で取り、口が決まらない（§5 Q5）まま、合成の後に `_` が来る。その前は G2(a)）は、R47 で
	// `5 (gf inc _)` に決まり（`_` は gf の最初の口で、既定値のある口、R39）、通る側（norevPasses）へ移した。
	// 口の外の `!_` は G7 のまま断っていた（§5 Q15。U〔答え〕10-21 23:47「合ってる」、仕様 §7.16 の決定の D6。D は決定の番号で、証拠の
	// 印 D（文書）ではない）。2026-10-22 23:48 の答え（U〔答え〕「5 !_ / 5 , !_ も追加で、 全部5になるはず…」）で、`!_ 5`・`5 !_`・`5 !_ 3` は
	// 恒等射（R44）、`inc !_ inc` は口が1つだけ残った inc の口で穴と恒等射が同じ関数（R46）になり、下の「口の外の恒等射」の idPasses へ移した。
	// R34 の k < n の割れ（§7.16 の決定の D7、G13）は、2026-10-23 の規則の文面（`(f3 !_) 1 [1 2]` は `f3 1 1 2`）で無くなった。上の flowPasses へ移した。
];
for (const [name, s, want, kind, extra] of flowPasses) checkPass(`余りと流れ ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of flowRefused) checkRefused(`余りと流れ ${name}`, s, want, inst);

// 確かめ 2026-10-22（R35〜R39 を確かめた2人の指摘を当てた行。§7.17）。
const recheckPasses = [
	// 2026-10-23 までは、逆適用の主語は一番近い1項（R37）で、前に積む項の `_` は根の構築の中で消えた（手順8・R15。その前は左の構築の
	// どこかに `_` があれば G5）。R47 で、inc は値の後ろに積まれて余る（R42・R48）。`_` は値の隣と空の所で消える（R43）。
	["R37 _ 1 inc（R47。前は G5、その後 `inc 1`）", std("_ 1 inc"), "(construct 1 (unit inc))", "A"],
	["R37 1 _ 2 inc（R47。前は G5、その後 `1 (inc 2)`）", std("1 _ 2 inc"), "(construct 1 2 (unit inc))", "A"],
	// 恒等射が並びを受けた後ろが恒等射・貪欲な単項・ノルムなら、R29 と単位律のどちらで読んでも同じなので通す。
	["R29 i i 1 2（後ろも恒等射）", std(["i : !_", "i i 1 2"]), "(apply (compose i i) (construct 1 2))", "A"],
	// 2026-10-26 の R74（§5 Q13 の答え）から、恒等射で始まる合成は単位律で恒等射が消える（前は `(compose i [* 2,])` の木）。
	["R29 i [* 2,] 1 2（後ろが貪欲な単項。R74 で i が消える）", std(["i : !_", "i [* 2,] 1 2"]), "(apply [* 2,] (construct 1 2))", "A"],
	["R29 i 1 2 3（根なら通す）", std(["i : !_", "i 1 2 3"]), "(apply i (construct 1 2 3))", "A"],
	// 括れば1つの項（値）。後ろの inc は、2026-10-23 までは逆適用でそれを取り、R47 から積まれて余る（R42・R48）。
	["R29 [i 1 2] inc（括れば1つの項。R47）", std(["i : !_", "[i 1 2] inc"]), "(construct [i 1 2] (unit inc))", "A"],
	// ノルムは R27 で「1つ受けて A を返す関数」なので、流れでも口を1つと数え、余りは後ろに積む。R27 の等式 `||f|| x` ＝ `||f x||` は、
	// x が f のアリティ分のときの言い換え（確かめ 2026-10-22 に文面を狭めた）。
	["R27 ||add|| 1 2", std("||add|| 1 2"), "(apply ||add|| (construct 1 2))", "A"],
	// 後ろの組 `||add||` が並びの 2 を受けたので、木は各組が受けた物の見える入れ子の適用（R40 の読み9。意味は前と同じ `||add (inc 1) 2||`）。
	["R27 inc ||add|| 1 2（余りはノルムに届く前に add が取る。木は入れ子、R40）", std("inc ||add|| 1 2"), "(apply ||add|| (construct (apply inc 1) 2))", "A"],
	["R27 ||inc|| 1 2（`||inc 1||` の後ろに 2 を積む）", std("||inc|| 1 2"), "(construct (apply ||inc|| 1) 2)", "A", { leftover: true }],
	["R27 ||inc|| add 1 2（ノルムの後ろの add が余りを取る。木は入れ子、R40）", std("||inc|| add 1 2"), "(apply add (construct (apply ||inc|| 1) 2))", "A", { leftover: false }],
	// 2026-10-23 の左からの畳み込み（R40・R41）で、前は G12(a)・G12(c)・G8 で断っていた形が通る。
	// 余りの後ろの関数は、2026-10-23 はいちばん上の余りを逆適用で取った（R40）。R47 では積まれて、根に余って `_`（R42・R48）、構築の中の
	// `_` は消える（R15）。
	["R40 inc 1 2 f2（`(inc 1) 2`、R47。前は G12(a)、その後 G8・`(inc 1) _`）", std("inc 1 2 f2"), "(construct (apply inc 1) 2 (unit f2))", "A"],
	["R40 ||inc|| 1 2 inc（`||inc 1|| 2`、R47。前は G12(a)、その後 `||inc 1|| (inc 2)`）", std("||inc|| 1 2 inc"), "(construct (apply ||inc|| 1) 2 (unit inc))", "A"],
	// 段18 の点なしは並びの終わりまで受ける（R41、R41 の読み8）。2項以上を受けた `[' 0]` は、直に当てた `[' 0] [1 2] 5` と同じく未知
	// （前は G12(c)。流れの中だけで k ≠ 1 を断る理由が無くなった）。
	// 2026-10-26 の R77（§5 Q39 の答え：口1つ）から、`inc [' 0] [1 2] 5`・`add [' 0] 1 2 3` は `[' 0]` が前の結果1つで閉じ、引いた物（中身の見えない A から引くので
	// 未知）の後ろに項が来るので G2(a)。いちばん後ろの「R73〜R79」の節へ移した。
	// 片イ（R126）：恒等射を途中に置いた並びの割れ（前は G18）は単位律の側に決まり、木は恒等射を消した並びで畳み直す（`inc i double 1 2` は
	// `inc double 1 2`、`i i 1 2 inc`・`5 i 1 2 inc` は `1 2 inc`・`5 1 2 inc` で、根に余った inc は `_` と leftover-lambda）。
	["G18 inc i double 1 2（合成の途中の恒等射が2項を受けて後ろに関数。R74 の外）（前は G18）", std(["i : !_", "inc i double 1 2"]), "(construct (apply (compose inc double) 1) 2)", "A"],
	["G18 i i 1 2 inc（恒等射だけの合成も並びを持ち越す）（前は G18、その前は G12(a)）", std(["i : !_", "i i 1 2 inc"]), "(construct 1 2 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["G18 5 i 1 2 inc（主語が恒等射の並び）（前は G18、その前は G12(a)）", std(["i : !_", "5 i 1 2 inc"]), "(construct 5 1 2 (unit inc))", "A", { leftoverDiag: ["inc"] }],
];
const recheckRefused = [
	// 余りを積んだ値の後ろの逆適用でも、右だけで決まる門（G8）が先だった（左をどう読んでも当たるので、R37 と R36 の割れではない）。
	// `inc 1 2 f2`（前は G12(a)、その後 G8）は、後ろに実引数が来ないので行の終わりで `_`（R40・R42。上の recheckPasses）。
	// `inc 1 2 [+ 1]`（前は G12(a)、その後 G10）は、R13 を廃止して `(inc 1) ([+ 1] 2)`（R40。下の pfReversePasses）。
	// `inc 1 2 f2 3`（前は G12(a)、その後 G8）は、逆適用の廃止（R47、G8 も廃止）で `(inc 1) 2 (f2 3)` に決まり、通る側（norevPasses）へ移した。
	// 恒等射が2項以上を受けた後ろの関数・逆適用（R29 の「並び全体を受ける」と単位律が割れる）。2026-10-23 から G18（G12 は廃止）：逆適用の
	// `i 1 2 inc` も、畳み込みでは恒等射が並びの終わりまで受ける口に inc が合成で入るので、同じ1つの門になる。恒等射が続くなら、その先の
	// 最初の恒等射でない関数で見る（`i i 1 2 inc`）。2026-10-24 の R47 からも同じ門（単位律の読みの `1 2 inc` は、inc が積まれて余る）。
	// 2026-10-26 の R74（§5 Q13 の答え：恒等射で始まる合成は単位律で恒等射が消える）で、`i inc 1 2`・`i f2 1 2`・`i ||inc|| 1 2` は `inc 1 2`・`f2 1 2`・
	// `||inc|| 1 2` と同じく通る（いちばん後ろの「R73〜R79」の節へ移した）。G18 に残るのは、恒等射が合成の途中にある形（`inc i double 1 2`）と、恒等射が
	// 受けた後に関数が来る形（下の2行）。
	// 片イ（R126）で G18 の割れは単位律の側に決まり、この3行は上の recheckPasses へ移した。
	// 段18 の点なしに前の結果と余りの2項以上が届く形（前は G12(c)）・ノルムの合成の余りを積んだ値の後ろの逆適用（前は G12(a)）は、
	// 2026-10-23 から通る（上の recheckPasses の R40・R41 の行）。
];
for (const [name, s, want, kind, extra] of recheckPasses) checkPass(`確かめ ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of recheckRefused) checkRefused(`確かめ ${name}`, s, want, inst);
{
	const msgOf = (s) => {
		try {
			resolve(s);
			return "通った";
		} catch (e) {
			return `${e.gate || e.reason} ${e.message}`;
		}
	};
	const rows = [
		// 2026-10-26 の R69 で `inc 1 !_` は通る（閉じた後ろの恒等射）ので、外に値のある `inc 1 !_ 2`（G13 のまま）で見ていた。2026-10-27 の R89 で `inc 1 !_ 2` も
		// 通る（§5 Q40 の残りの答え）ので、前から n 個に穴のある `add !_ 1 !_`（G13 のまま）で見る。
		["G13 の穴の綴りの後ろに空白（add !_ 1 !_）", msgOf(std("add !_ 1 !_")), (m) => m.startsWith("G13 ") && m.includes("並びに穴 `!_` があり")],
		// 合成の頭の末尾の `_`（`inc inc _`）の G5 の言い分（合成の頭に「ここで終わる」を当てるか）は、2026-10-26 の R28 の書き直し（§5 Q18 の答え：`inc inc` の関数の
		// まま残る）で通る形になって無くなった。内側の `_` の G5 は、後ろに値か `!_` が続くことと、引数の並びの終わりの `_` は消えることを言う。
		// 同じ日の確かめの直しから、関数を挟んで値が続く `_`（`f2 _ inc 5`）も内側なので「後ろのどこかに」と言い、§5 Q74 を名指しする。
		// 2026-10-28 の R105（値の口の書いた `_` は消える）で、内側の `_` の G5（前の見本の2行）は通る形になって無くなった（`_` を消した綴りと同じ）。
		// 書いた `_` の G5 に残るのは、既定値のある関数から作った穴の関数の、穴を全部埋めた後ろの `_` だけなので、その言い分を見る。
		["穴の関数の穴の外の `_` の G5 は、既定値のある口に当たるか数えられないことを言う（(go !_ 2) 1 _ 5、§5 Q8。前の見本の2本は R105 で通るので替えた）", msgOf(std([...GO_DEFAULT, "(go !_ 2) 1 _ 5"])), (m) => m.startsWith("G5 ") && m.includes("穴を全部埋めた後ろに書いた `_`") && m.includes("R39") && m.includes("R105") && m.includes("§5 Q8")],
		// 2026-10-28 の R110 で、評価する所（行の根）の `(gq 1) _` は通る（`_` を消しても既定値で埋めても値は同じ）ので、括りの中で見る。
		// 片イ（R120）で種類の未知な項の G7 は廃止し、括りの中の `[(gq 1) _]` も後ろの `_` を消す予想で通るので、この言い分の行は外した（通ることは
		// いちばん後ろの「R110 の外」の行で見る）。
		// 2026-10-28 の R108（§5 Q74 (c) を閉じた）で `(!_ _)` は書いた項どおり恒等射で通るので、今のまま G7 の `(-_ _) 5` で見る。同じ日の確かめの直しで、言い分は
		// 閉じた Q74 でなく、残りの形を受け持つ §5 Q81 を指し、R108 の形を添える（前は §5 Q74）。
		["括りの点なしの形の項の後ろの `_` の G7 は、2つの読みと点なしの書き方を言う（(-_ _) 5、§5 Q81。前は §5 Q74、前の見本は (!_ _) 5）", msgOf(std("(-_ _) 5")), (m) => m.startsWith("G7 ") && m.includes("点なしの形 `[-_]`") && m.includes("§5 Q81") && !m.includes("§5 Q74") && m.includes("§4 R108") && m.includes("`_` を書かずに `[-_]` と書きます")],
		// 2026-10-23：段18 の点なしに余りが届く形は通る（前は G12(c) で k ≠ 1 を名指し。上の recheckPasses）。恒等射の2つの行は G18 で、
		// 言い分は R29 と単位律を名指しし、後ろの関数を名指しする（前は G12(c) と G12(a)）。
		// 2026-10-26 の R74 で `i inc 1 2` は通るので、合成の途中の恒等射の `inc i double 1 2` で見る。
		// 片イ（R126）で G18 の割れは単位律の側に決まって外へ出ないので、恒等射の2つの言い分の行は外した（通ることは上の recheckPasses の G18 の行で見る）。
	];
	for (const [name, m, good] of rows) {
		total++;
		if (good(m)) ok(`確かめ 言い分 ${name}`);
		else fail(`確かめ 言い分 ${name}`, m);
	}
}

// ---------------------------------------------------------------------------
// 左からの畳み込み（2026-10-23、R40〜R43）
// ---------------------------------------------------------------------------
//
// 余積は1つの演算子で、左結合（R40）。並びは左から1項ずつ畳み、次の項はいちばん上の項とだけ結ぶ。可変長の口は並びの終わりまで
// 受けて閉じる（R41）。評価する所（定義でない行の根）の終わりに残った未評価のラムダは `_`（R42。木は `(unit …)`）。書いた `_` と `!_` は
// 口を1つ埋める所で読む（R43）。根拠：規則の文面に答えのボタン「作り直す」（U〔答え〕10-22 22:15）。
// 畳み込みの1歩は、2026-10-23 は4行（A A は積む、L A は口を1つ埋める、L L は合成、A L は逆適用で L がいちばん上の A を取る）で、
// 2026-10-24 の逆適用の廃止（R47）から3行：L A は口を1つ埋める、L L は合成、いちばん上が A か空なら次の項を積む（L も積み、積まれた L は
// 後ろの項を右から受ける）。根拠：U [2026-10-23 13:12 ebf18260]「…逆適用は廃止しよう」と、主の Claude の問い「A の後の L は積む（関数は
// 右からだけ受ける）。根でラムダが余って `_` になったら診断で知らせる。これでいい？」への U〔答え〕[2026-10-23 15:32 ebf18260]「合ってる。
// それでOK！」。2026-10-23 の根拠だった主の Claude の問い「左結合なら、`5 inc 3` は `(inc 5) 3`（値は [6 3]）でいい？」への U〔答え〕
// 10-22 11:24「そう、合ってる。」は、逆適用がある前提の答えで、R47 で上書きされた（`5 inc 3` は `5 (inc 3)`）。
// ここには、上の節で断る・通るが入れ替わった行を移した（行の注に、どの規則で変わったかを書く）。行の名前の「前は」は、2026-10-23 の
// 左からの畳み込みより前の答え、「その後」は 2026-10-23 の答え。
const leftFoldPasses = [
	// 値の後ろの関数は積まれて、根に余って `_`（R47・R42。余ったことは leftover-lambda で知らせる、R48）。2026-10-23 は逆適用で、口が2つ以上
	// 残った関数は主語の口が決まらないまま行の終わりで `_`、口が1つだけ残った関数はその口を埋めた（`5 (f2 1)` は `f2 1 5`）。前は G8。
	["5 f2（R47。前は G8、その後 主語の口が決まらない逆適用で `_`）", std("5 f2"), "(construct 5 (unit f2))", "A"],
	["5 (f2 1)（R47。前は G8、その後 `f2 1 5`）", std("5 (f2 1)"), "(construct 5 (unit [f2 1]))", "A"],
	// 余りを積んだ値の後ろの関数も積まれて余る（R47）。2026-10-23 はいちばん上の値（余り）を逆適用で取った。前は R37 と R36 で割れるので G12(a)。
	["inc 1 2 inc（`(inc 1) 2`、R47。前は G12(a)、その後 `(inc 1) (inc 2)`）", std("inc 1 2 inc"), "(construct (apply inc 1) 2 (unit inc))", "A"],
	// 口が1つだけ残った関数（括り・別名・部分適用の名前）も、値の後ろでは積まれて余る（R47）。2026-10-23 は逆適用でその口を埋めた（R40 の
	// 読み3）。前は R12 の形（`?` の定義を直に指すアリティ1の素の関数か `?` の括り）でないので G8。
	["5 [inc]（R47。前は G8、その後 逆適用）", std("5 [inc]"), "(construct 5 (unit [inc]))", "A"],
	["q : [inc] の後で 5 q（R47。前は G8、その後 逆適用）", std(["q : [inc]", "5 q"]), "(construct 5 (unit q))", "A"],
	["p : inc の後で 5 p（R47。前は G8、その後 逆適用）", std(["p : inc", "5 p"]), "(construct 5 (unit p))", "A"],
	["add1 : add 1 の後で 5 add1（R47。前は G8、その後 逆適用）", std(["add1 : add 1", "5 add1"]), "(construct 5 (unit add1))", "A"],
	["5 add inc（R47。前は G8、その後 主語の口が決まらない逆適用で `_`）", std("5 add inc"), "(construct 5 (unit (compose add inc)))", "A"],
	["double inc 5 6 inc（R47。前は G12(a)、その後 6 を逆適用で取る）", std("double inc 5 6 inc"), "(construct (apply (compose double inc) 5) 6 (unit inc))", "A"],
	// 書いた `_` は、値の隣と空の並びでは並びの単位としてその場で消える（R15・R43。畳み込みは単位から始まる）。U〔答え〕10-21 03:19 の表の
	// `_ inc 5`（印が単位として消える）を、左からの畳み込みで `_ inc` にも当てた（決定から外れた所：読み4 は G5 のままとしていた。§7.18）。
	// 前は G5（`_ f` の読み、§5 Q7）。2026-10-23 は、`_` が消えた後の inc が値を逆適用で取った（`5 _ inc` は `inc 5`）。R47 で inc は積まれて余る。
	["_ inc（`_` は消える。根なので `_`、R42・R43。前は G5）", std("_ inc"), "(unit inc)", "A"],
	["5 _ inc（R43・R47。前は G5、その後 `inc 5`）", std("5 _ inc"), "(construct 5 (unit inc))", "A"],
	["1 2 _ inc（R43・R47。前は G5、その後 `1 (inc 2)`）", std("1 2 _ inc"), "(construct 1 2 (unit inc))", "A"],
	["inc 5 _ inc（`inc 5` の後ろの `_` は消える、R43・R47。前は G5、その後 `inc (inc 5)`）", std("inc 5 _ inc"), "(construct (apply inc 5) (unit inc))", "A"],
	// 括りの関数の `_` は、残りの口が全部括りなら消える（R15）。裸の口 a は 1 で埋まった後なので、`_` は [b] に当たる（R43）。前は G5。
	["mx 1 _ 3（R43。前は G5）", std(["mx : a [b] ? a", "mx 1 _ 3"]), "(apply mx (construct 1 3))", "A"],
	["[!_] 1 2 inc（`([!_] 1) 2`、R47。前は G12(a)、その後 `([!_] 1) (inc 2)`）", std("[!_] 1 2 inc"), "(construct (apply [!_] 1) 2 (unit inc))", "A"],
	// 余りの後ろの関数は積まれて余る（R47）。2026-10-23 はいちばん上の余りを逆適用で取った。前は R37 と R36 で割れる G12(a)。
	["R24 tl 1 2 3 inc（R47。前は G12(a)、その後 `… (inc 3)`）", src(["inc : x ? x + 1", "tl : [x ~xs] y ? x + y", "tl 1 2 3 inc"]), "(construct (apply tl (construct 1 2)) 3 (unit inc))", "A"],
	["R24 (tl 1) 2 3 inc（R47。前は G12(a)、その後 `… (inc 3)`）", src(["inc : z ? z + 1", "tl : [x ~xs] y ? x + y", "(tl 1) 2 3 inc"]), "(construct (apply [tl 1] 2) 3 (unit inc))", "A"],
	["Q26 inc (pr 1) 5 6 inc（R47。前は G12(a)、その後 `… (inc 6)`）", src(["inc : x ? x + 1", "pr : x y ? y", "inc (pr 1) 5 6 inc"]), "(construct (apply (compose inc [pr 1]) 5) 6 (unit inc))", "A"],
	["pr inc [1] 2 3 double（R47。前は G12(a)、その後 `… (double 3)`）", src([INC, DOUBLE, "pr : [x ~xs] y ? y", "pr inc [1] 2 3 double"]), "(construct (apply (compose pr inc) (construct [1] 2)) 3 (unit double))", "A"],
	// 最後の括りは並びの終わりまで受ける（R41）ので、後ろの関数は合成になり、閉じた値（未知）を受けて未知（根なので通る）。前は、未知の
	// 節が隣の関数と結ぶ G2(a)。後ろの関数が並びから何も受けていない木は入れ子の適用（2026-10-23 までは書いた向きのまま逆適用と同じ
	// `·rev` の綴り、renderEntry の trailingFrom。R47 で無くなった）。
	["R24 gi 1 2 inc（R41。前は G2(a)）", src(["gi : [x ~xs] ? [,] x", "inc : y ? y + 1", "gi 1 2 inc"]), "(apply inc (apply gi (construct 1 2)))", "未知"],
	["R24 n vs~ 1 inc（R41。前は G2(a)）", src(["inc : y ? y + 1", "n : [~x] ? x", "vs : 1 , 2", "n vs~ 1 inc"]), "(apply inc (apply n (construct vs~ 1)))", "未知"],
	["pu inc [1] double（R41。前は G2(a)）", src([INC, DOUBLE, "pu : [x ~xs] ? [,] x", "pu inc [1] double"]), "(apply double (apply inc (apply pu [1])))", "未知"],
	// 実体の根が、外れた仮置きの上で閉じた枠に頼って未知に解き直される（§5 Q28）。前は隣の inc と結ぶ G2(a) で見ていた。根の種類で見る。
	// 2026-10-26 の R76（§5 Q37 の答え：字下げの本体の行は評価する所）で、f の前の行 `⇥inc` は `_` になり f が A に決まってこの道を通らなくなったので、行の根が
	// 未知の `⇥[,] x` にした（HEAD でも同じ答え）。
	["Q28 外れた仮置きの上で閉じた枠に頼る（括りの関数の実体。根が未知、R41）", src(["inc : x ? x + 1", "hb : [s] ? s 1", "f : x ?", "	[,] x", "	k x", "", "k : x ?", "	f x", "	hb [s : k]", "", "hb [s : k] inc"]), "(apply inc (apply hb [s : k]))", "未知"],
	// `[|]` の口は並びの終わりまで受ける（R41）ので、inc は合成されて閉じた値を受ける。`[|] fs` は fs の要素に関数が見えるので未知（R31）
	// で、inc は未知を受けて未知（根なので通る）。前は強さの順で `[|] fs` が先に未知の節になり、inc と結ぶ G2(a)。
	// 片イ（R123）：STD の fs は `$inc , $double , 3` で要素は番地（値）なので、`[|] fs` は値で、inc に当てて A（前は未知）。
	["[|] fs inc（R41。前は G2(a)）（片イの R123 で fs の要素は番地）（前は未知）", std("[|] fs inc"), "(apply inc (apply [|] fs))", "A"],
	// 可変長の口の後ろの点なしは、合成の後ろに入る（R40・R41）ので R13 に当たらない（前は `n 1 2` を先に縮めた値への逆適用で G10）。
	["n 1 2 [+ 1]（R41。前は G10）", std("n 1 2 [+ 1]"), "(apply [+ 1] (apply n (construct 1 2)))", "A"],
	["[* 2,] 1 2 3 [+ 1]（R41。前は G10）", std("[* 2,] 1 2 3 [+ 1]"), "(apply [+ 1] (apply [* 2,] (construct 1 2 3)))", "A"],
	// 2026-10-23 は、口が1つだけ残った関数の逆適用がその口を埋めた（R40 の読み3。括りの関数 a・実体の中の欄の関数 say。前は G8）。R47 で、
	// 値の後ろの関数は積まれて余る：根の `m a` は `_`（a は呼ばれず、R42・R48）。a3 の本体 `21 say` は評価する所でない（R42 の読み1）が、
	// 2026-10-24 の R52 から、値の上に積まれて何も受けずに閉じた say は余ったラムダで `_` になり、実体の本体の根は A。だから `a3 m` は A。
	// R47 の最初の版は、say がラムダのまま残って値と関数の並んだ構築が種類を決めず（未知、§5 Q38）、`a3 m` は未知だった。
	["R12 m a（R47。前は G8、その後 括りの関数の逆適用）", src([...IO, "m a"]), "(construct m (unit a))", "A"],
	["R12 実体の中の 21 say（R52。R47 では未知（Q38）、その前は G8、その後 欄の関数の逆適用で A）", src([...M, "a3 : [say] ? 21 say", "a3 m"]), "(apply a3 m)", "A", { leftoverDiag: ["say"] }],
];
const leftFoldRefused = [
	// 2026-10-23 は、add が 5 を逆適用で取り、口が決まらない（§5 Q5）まま 3 が来る G8 だった（`5 add 3 _`）。`[<<]` も素の2引数の関数と同じ
	// （R32）で、`1 [<<] 2 3 4` は G8 だった。逆適用の廃止（R47、G8 も廃止）で `5 (add 3 _)`・`1 ([<<] 2 3) 4` に決まり（前の強さの順の答えと
	// 同じ）、通る側（norevPasses）へ移した。断る行は無くなった。
];
for (const [name, s, want, kind, extra] of leftFoldPasses) checkPass(`畳み込み ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of leftFoldRefused) checkRefused(`畳み込み ${name}`, s, want, inst);

// ---------------------------------------------------------------------------
// 値の後ろの点なし（2026-10-23、R13 の廃止・§5 Q36）
// ---------------------------------------------------------------------------
//
// 決定の文面（U〔答え〕2026-10-22 22:15 で承認された、主の Claude の文面）は「今と答えが変わる形」に「`1 2 [+] 3 4` は `1 ([+] 2 3 4)`」を
// 挙げ、A·L を「逆適用。L が、いちばん上の A を取る」とだけ書く。点なしは、ほかの関数と同じに主語を取る。R13（U 2026-08-06 05:06
// 「ポイントフリーであれば、apply-reverceから除外するのがいいと思う。」）は、強さの順で縮めていた頃に `1 2 [+] 3 4` の読みの崩れを
// 直すために入れた物で、左からの畳み込みでは、文面の例そのものと割れるので廃止した（§4 R13、§7.19）。作り直しの最初の版は R13 を
// 残して、ここの行を G10 で断っていた。
// 2026-10-23 は、主語の口がほかの関数と同じ形で決まった（R40 の読み3）：口が1つ（単項の点なし・前置・後置の点なし・1つ当てた部分適用）か
// 可変長の口だけ（畳む点なし・貪欲な単項）なら主語はその口に入り、段18 の点なし（`[' 0]`）は書いていない左の被演算子の口に入り（R26）、
// 口が2つ（畳まない2項の点なし `[<<]`、R32）か数が分からない（`[,]`）なら、主語の口が決まらなかった（§5 Q5）。
//
// 2026-10-24 の逆適用の廃止（R47）で、点なしもほかの関数と同じく、値の後ろに積まれて値を取らない。後ろの項を右から受け、根に余れば `_`
// （R42、構築の中で消える。余ったことは leftover-lambda で知らせる、R48）。決定の文面の `1 2 [+] 3 4` は `1 2 ([+] 3 4)`（主の Claude が示した
// 表の形。U〔答え〕[2026-10-23 15:32 ebf18260]「合ってる。 それでOK！」）。行の名前の「前は」は 2026-10-23 より前、「その後」は 2026-10-23 の答え。
const pfReversePasses = [
	// 決定の文面の例。R47 で `[+]` は 2 を取らず、後ろの 3 4 を可変長の口で受ける（R41）。
	["1 2 [+] 3 4（`1 2 ([+] 3 4)`、R47。前は `1 2 ([+] 3 4)`、その後 G10・`1 ([+] 2 3 4)`）", std("1 2 [+] 3 4"), "(construct 1 2 (apply [+] (construct 3 4)))", "A"],
	// §5 Q23 の答え（`[* 2] (inc 5)`）は逆適用がある前提の答えで、R47 で上書きされた：合成 `inc [* 2]` が 5 の後ろに積まれて余る。
	["5 inc [* 2]（R47。前は Q23 の答えの `[* 2] (inc 5)`、作り直しの最初の版は G10）", std("5 inc [* 2]"), "(construct 5 (unit (compose inc [* 2])))", "A"],
	["5 inc [-_]（R47。前は Q23 の答え、作り直しの最初の版は G10）", std("5 inc [-_]"), "(construct 5 (unit (compose inc [-_])))", "A"],
	// 前は `[+]` が `inc 5` の値（中身の見えない A）を受けて未知（R31）。R47 では何も受けずに余るので、根は A。
	["5 inc [+]（R47。前は未知の根）", std("5 inc [+]"), "(construct 5 (unit (compose inc [+])))", "A"],
	// R13 の前の見本。前は G10、2026-10-23 は逆適用。
	["5 [+ 1]（R47。前は G10、その後 逆適用）", std("5 [+ 1]"), "(construct 5 (unit [+ 1]))", "A"],
	["5 [* 2] inc（R47。前は G10、その後 `inc ([* 2] 5)`）", std("5 [* 2] inc"), "(construct 5 (unit (compose [* 2] inc)))", "A"],
	// R47：`[+ 1]` は 5 を取らず、後ろの 3 を受ける（2026-10-22 の強さの順と同じ木）。2026-10-23 は `([+ 1] 5) 3`。
	["5 [+ 1] 3（`5 ([+ 1] 3)`、R47。前は `5 ([+ 1] 3)`、その後 `([+ 1] 5) 3`）", std("5 [+ 1] 3"), "(construct 5 (apply [+ 1] 3))", "A"],
	["1 2 [+ 1]（R47。前は G10、その後 `1 ([+ 1] 2)`）", std("1 2 [+ 1]"), "(construct 1 2 (unit [+ 1]))", "A"],
	["inc 1 2 [+ 1]（R47。前は G12(a)・G10、その後 `(inc 1) ([+ 1] 2)`）", std("inc 1 2 [+ 1]"), "(construct (apply inc 1) 2 (unit [+ 1]))", "A"],
	["5 [-_]（R47。前は G10、その後 逆適用）", std("5 [-_]"), "(construct 5 (unit [-_]))", "A"],
	["5 [!_]（R47。前は G10、その後 逆適用）", std("5 [!_]"), "(construct 5 (unit [!_]))", "A"],
	["5 [-_] inc（R47。前は G10、その後 逆適用）", std("5 [-_] inc"), "(construct 5 (unit (compose [-_] inc)))", "A"],
	["5 [-_,]（R47。前は G10、その後 逆適用）", std("5 [-_,]"), "(construct 5 (unit [-_,]))", "A"],
	// 畳む2項の点なしも、5 を取らずに余る。
	["5 [+]（R47。前は G10（§6.3 の行）、その後 逆適用）", std("5 [+]"), "(construct 5 (unit [+]))", "A"],
	["5 [*]（R47。前は G10、その後 逆適用）", std("5 [*]"), "(construct 5 (unit [*]))", "A"],
	["5 [&]（R47。前は G10、その後 逆適用）", std("5 [&]"), "(construct 5 (unit [&]))", "A"],
	["5 [<]（R47。前は G10、その後 逆適用）", std("5 [<]"), "(construct 5 (unit [<]))", "A"],
	// `[+]` に合成した inc も一緒に余る（2026-10-23 は `[+]` が 5 を取って `inc ([+] 5)`）。
	["5 [+] inc（R47。前は G10、その後 `inc ([+] 5)`）", std("5 [+] inc"), "(construct 5 (unit (compose [+] inc)))", "A"],
	// `_` は積まれた `[+]` の実引数の印（R31）。2026-10-23 は `[+] 5 _`。
	["5 [+] _（`5 ([+] _)`、R47・R31。前は G10、その後 `[+] 5 _`）", std("5 [+] _"), "(construct 5 (apply [+] _))", "A"],
	["1 [*] 2 3 4（`1 ([*] 2 3 4)`、R47。前は G10、その後 `[*] 1 2 3 4`）", std("1 [*] 2 3 4"), "(construct 1 (apply [*] (construct 2 3 4)))", "A"],
	// 段18 の点なしも積まれる。2026-10-23 は書いていない左の被演算子の口に主語が入り（`vs [' 0]` は `[' 0] vs`）、`5 [' 0]` は数から引かないので
	// 未知だった。R47 では何も受けずに余るので A。
	["5 [' 0]（R47。前は G10、その後 未知の根）", std("5 [' 0]"), "(construct 5 (unit [' 0]))", "A"],
	["vs [' 0]（R47。前は `[' 0] vs`）", std("vs [' 0]"), "(construct vs (unit [' 0]))", "A"],
	["vs [' 0] inc（R47。前は `inc ([' 0] vs)`）", std("vs [' 0] inc"), "(construct vs (unit (compose [' 0] inc)))", "A"],
	// 1つ当てた畳まない2項の点なし（口が1つ）も、素の2引数の関数の部分適用（`5 (add 1)`）と同じく積まれて余る。
	["5 ([<<] 1)（R47。前は G10、その後 `[<<] 1 5`）", std("5 ([<<] 1)"), "(construct 5 (unit [[<<] 1]))", "A", { pfInfo: "[<<]" }],
	["q : [<<] 1 ⏎ 5 q（R47。前は G10、その後 逆適用）", std(["q : [<<] 1", "5 q"]), "(construct 5 (unit q))", "A", { pfInfo: "[<<]" }],
	["5 ([<<] 1) inc（R47。前は G10、その後 逆適用）", std("5 ([<<] 1) inc"), "(construct 5 (unit (compose [[<<] 1] inc)))", "A", { pfInfo: "[<<]" }],
	["q : [<<] 1 ⏎ 5 q inc（R47。前は G10、その後 逆適用）", std(["q : [<<] 1", "5 q inc"]), "(construct 5 (unit (compose q inc)))", "A", { pfInfo: "[<<]" }],
	["5 inc ([<<] 1)（R47。前は Q23 の答えの `[<<] 1 (inc 5)`）", std("5 inc ([<<] 1)"), "(construct 5 (unit (compose inc [[<<] 1])))", "A", { pfInfo: "[<<]" }],
	["q : [<<] 1 ⏎ 5 inc q（R47。前は Q23 の答え）", std(["q : [<<] 1", "5 inc q"]), "(construct 5 (unit (compose inc q)))", "A", { pfInfo: "[<<]" }],
	// 口が2つの `[<<]` も積まれて余る（2026-10-23 は主語の口が決まらない逆適用で、行の終わりで `_`）。
	["5 [<<]（R47。前は G10、その後 主語の口が決まらない `_`）", std("5 [<<]"), "(construct 5 (unit [<<]))", "A", { pfInfo: "[<<]" }],
	["5 inc [<<]（R47。前は 作り直しの最初の版の G10、その後 `_`）", std("5 inc [<<]"), "(construct 5 (unit (compose inc [<<])))", "A", { pfInfo: "[<<]" }],
];
const pfReverseRefused = [
	// 2026-10-23 の G8（`1 [<<] 2 3 4 inc`・`1 [,] 2 3 4`：主語の口が決まらないまま実引数が来る）と G2(a)（`vs [' 0] inc 4`：段18 の点なしが
	// 主語を取った後に関数が合成され、さらに値が同じ点なしの口に入る）は、逆適用の廃止（R47）で `1 ([<<] 2 3) 4` の後ろに inc が余る形・
	// `1 ([,] 2 3 4)`・`vs ([' 0] inc 4)` に決まり、通る側（norevPasses）へ移した。断る行は無くなった。
];
for (const [name, s, want, kind, extra] of pfReversePasses) checkPass(`値の後ろの点なし ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of pfReverseRefused) checkRefused(`値の後ろの点なし ${name}`, s, want, inst);

// ---------------------------------------------------------------------------
// §7.18 の確かめの指摘を当てた直し（2026-10-23、§7.19）
// ---------------------------------------------------------------------------
const GQ = "gq : x [y : 1] ? x + y"; // 既定値のある関数（口は2つ、後ろが既定値のある口）
const fixFoldPasses = [
	// 2026-10-23 は、主語の口が決まらない逆適用の後の、並びの最後の `_` を、頭が素の関数なら R28 の「ここで終わる」で A にした（主語が
	// どの口に入っても、`_` を除いた実引数（主語1つ）は足りない。前は G8）。R47 では値の後ろの関数は積まれて口が全部開いているので、`_` は
	// その関数の最初の口に当たる R28 の終わり（`5 (f2 _)`、値は 5）だった。2026-10-26 の R28 の書き直しで、末尾の `_` は消えて f2 は関数のまま値の上に
	// 積まれて余り、`_` で知らせる（`5 f2` と同じ、R52・R48）。
	["5 f2 _（R28 で `5 f2` と同じ。前は `5 (f2 _)`、その前は G8・`(apply f2 (construct 5 _) ·rev)`）", std("5 f2 _"), "(construct 5 (unit f2))", "A", { leftoverDiag: ["f2"] }],
	["5 add _（同じ。前は `(construct 5 (apply add _))`）", std("5 add _"), "(construct 5 (unit add))", "A", { leftoverDiag: ["add"] }],
	["1 2 f2 _（同じ。前は `(construct 1 2 (apply f2 _))`）", std("1 2 f2 _"), "(construct 1 2 (unit f2))", "A", { leftoverDiag: ["f2"] }],
	["5 [<<] _（同じ。前は n = 2 の終わり `(construct 5 (apply [<<] _))`、R32・R47）", std("5 [<<] _"), "(construct 5 (unit [<<]))", "A", { pfInfo: "[<<]", leftoverDiag: ["[<<]"] }],
	// 2026-10-23 は、主語の口が決まらない逆適用で、頭が口の数の分からない関数（既定値のある関数・`[,]`）なら、主語がどの口に入ったかで
	// 足りたかが変わる（§5 Q8）ので未知にした（その前は `_`）。R47 では何も受けずに積まれて余り、根で `_`（R42・R48）なので A。
	["gq : x [y : 1] ? x + y ⏎ 5 gq（R47。前は `_`、その後 未知の根）", src([GQ, "5 gq"]), "(construct 5 (unit gq))", "A"],
	["5 gq inc（R47。前は `_`、その後 未知の根）", src([GQ, INC, "5 gq inc"]), "(construct 5 (unit (compose gq inc)))", "A"],
	["5 [,]（R47。前は 未知の根）", std("5 [,]"), "(construct 5 (unit [,]))", "A"],
	// 口の数が数えられる関数も、余ったラムダは今までどおり `_`（R42）。2026-10-23 は逆適用の `(unit (apply f2 5 ·rev))` で行の値が `_`、
	// R47 では f2 が 5 の後ろに積まれて余り、`_` になるのは f2 だけで、行の値は 5。
	["5 f2（R47：f2 が積まれて余り、値は 5。前は行の値が `_`）", std("5 f2"), "(construct 5 (unit f2))", "A"],
	["5 map（R47：map が積まれて余り、値は 5。前は行の値が `_`）", std("5 map"), "(construct 5 (unit map))", "A"],
	// 名前の右辺の器の数は、ファイルの値の定義を直に指す名前の葉にだけ付ける（valueCountOf）。括りの関数の実体の中の仮引数（`[~r]`）は
	// 数えないので未知（実体は長さを書かない形で共有される、R24）。前は、器の数が desc に乗って仮引数に入り、行の順で答えが変わった。
	["ap : [~r] ? (f4 !_) 1 r ⏎ ap vs（未知。前は A で、ap ws と並べる順で割れた）", std(["ws : 1 , 2", "ap : [~r] ? (f4 !_) 1 r", "ap vs"]), "(apply ap vs)", "未知"],
	["ap ws（未知。前は単独なら G16）", std(["ws : 1 , 2", "ap : [~r] ? (f4 !_) 1 r", "ap ws"]), "(apply ap ws)", "未知"],
	["ap2 : [x ~xs] ? (f4 !_) 1 xs ⏎ ap2 vs（尾の数は数えない。前は器全体の数 3 で A）", std(["ap2 : [x ~xs] ? (f4 !_) 1 xs", "ap2 vs"]), "(apply ap2 vs)", "未知"],
	// ファイルの値の定義を直に指す名前は、今までどおり数える（[x] ≅ x、R41 の読み5）。
	["(f4 !_) 1 vs（`f4 1 1 2 3`）", std("(f4 !_) 1 vs"), "(apply [f4 !_] (construct 1 vs))", "A"],
	["ws : 1 , 2 ⏎ (f4 !_) 1 ws（足りない、根で `_`）", std(["ws : 1 , 2", "(f4 !_) 1 ws"]), "(unit (apply [f4 !_] (construct 1 ws)))", "A"],
	["zs : ws ⏎ (f4 !_) 1 zs（名前の名前も数える）", std(["ws : 1 , 2 , 3", "zs : ws", "(f4 !_) 1 zs"]), "(apply [f4 !_] (construct 1 zs))", "A"],
	// 段18 の点なしが1つ受けて引いた物が値なら、後ろに関数だけが続く形は通していた（`[' 0] [1 2 3] inc`・`[' 0] [1 2 3] inc inc`）。R47 で
	// 断る側（下の fixFoldRefused）へ移した。
	// 部分適用の名前の末尾の `_`（素の関数の部分適用、名前と括り）は、R28 の終わりで A だった。2026-10-26 の R28 の書き直しで、`_` は消えて部分適用が関数のまま
	// 残り、根なので `_`（R42・R48）。
	["a1 : add 5 ⏎ a1 _（R28 で a1、根なので `_`。前は終わりの `(apply a1 _)`）", std(["a1 : add 5", "a1 _"]), "(unit a1)", "A", { leftoverDiag: ["a1"] }],
	["(add 5) _（同じ。前は終わりの `(apply [add 5] _)`）", std("(add 5) _"), "(unit [add 5])", "A", { leftoverDiag: ["[add 5]"] }],
];
const fixFoldRefused = [
	// 段18 の点なしが1つ受けた後に関数が来る（§5 Q39）。2026-10-23 は、引いた物が値なら、閉じた読み（閉じて値になり、後ろの関数が逆適用で
	// それを取る）と開いた読み（まだ受けていて、後ろの関数は合成）が同じ答えなので通し、後ろから値が同じ点なしの口に入った所で G2(a) に
	// した（`[' 0] [1 2 3] inc 4`。前は開いた読みを黙って選んでいた）。逆適用の廃止（R47）で、閉じた読みの後ろの関数は値の後ろに積まれて
	// 値を取らない（`([' 0] [1 2 3]) inc` は 1 の後ろに inc が余る）ので、関数が来た所で2つの読みが割れる。`[,] 5 g 3` と同じく G2(a)
	// （resolve.js の foldStep）。下の5行は、門は同じで、当たる所が後ろの関数に移った。
	// 2026-10-26 の R77（§5 Q39 の答え：`[' 0]` は口1つ）で閉じた読みに決まり、5行とも通る（`[' 0] [1 2 3] inc` は 1 の後ろに inc が余る、`… inc 4` は `1 (inc 4)`）。
	// いちばん後ろの「R73〜R79」の節へ移した。
	// 合成を名前や括りで包んだ物の末尾の `_`（`q : inc add 5` ⏎ `q _`・`(inc add 5) _`・`inc add 5 _`・`r : inc f3 5` ⏎ `r 1 _`・`(r 1) _`）は、書いたままの合成と
	// 同じ G5（§5 Q18 の残り。`:` はメタで、名前は式を指す。その前は名前と括りだけが R28 で通っていた）。2026-10-26 の R28 の書き直し（§5 Q18 の答え：合成は関数
	// のまま残る）で、5行とも通る側（いちばん後ろの「R28」の節）へ移した。名前・括り・書いたままの合成が同じ答えなのは今までどおり。
	// 2026-10-23 は、主語の口が決まらない逆適用の後で、並びの最後でない `_`・既定値のある関数・括りの関数は G8 だった。逆適用の廃止（R47、
	// G8 も廃止）で、値の後ろの関数は積まれて口が全部開いているので、`_` はほかの関数の口と同じ規則で読む：`5 (gq _)` の `_` は gq の最初の口
	// （x、既定値の無い口）で G15、`1 (hh _)` は括りの関数の末尾の `_` で、`_` を除いた実引数がアリティに足りないので G5（`io1 _` と同じ）。
	// `5 f2 _ 3` は、R47 の最初の版では並びの頭でない素の関数の内側の `_` として G5 だったが、同じ日の確かめで、積まれた f2 の後ろの並びにも
	// 穴の規則を当てるよう直した（`5 (f2 _ 3)` と同じ。いちばん後ろの「逆適用の廃止の確かめ」の norevFixPasses）。
	// `5 gq _`（G15）と `1 hh _`（G5）は、2026-10-26 の R28 の書き直し（既定値の無い口の末尾の `_`・括りの関数の頭で足りない形の末尾の `_` は消える）で、`5 gq`・
	// `1 hh` と同じく通る側（いちばん後ろの「R28」の節）へ移した。
];
for (const [name, s, want, kind, extra] of fixFoldPasses) checkPass(`確かめの直し ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of fixFoldRefused) checkRefused(`確かめの直し ${name}`, s, want, inst);

// ---------------------------------------------------------------------------
// 口の外の恒等射・恒等射は `,` の単位（2026-10-23、R44〜R46、§7.20）
// ---------------------------------------------------------------------------
//
// U [2026-10-22 23:42 ebf18260]「!_ 5 とか !_ , 5 とかも確かめておいた方が良いね。」、U〔答え〕[2026-10-22 23:48 ebf18260]「5 !_ / 5 , !_
// も追加で、 全部5になるはず…」（主の Claude の問い「`!_ 5` は `i 5` に合わせて 5、でいい？」への答え。`!_ , 5` を 5 にしたのは利用者で、
// 主の Claude の案1は `(, !_ 5)` だった）。
// - R44：括らない `!_` が口の外（並びの頭・値の後ろ）にあれば、`i : !_` の i（R29 の恒等射）と同じ。`:` はメタなので、並びの頭と `5` の
//   後ろの `!_ X` と `i X` は同じ答え（法則11）。同じにならない所は名指しで断る：頭の関数の口を値で埋めた後ろ（`inc 5 !_` の G13、§5 Q40）と
//   中置の被演算子（`!_ == 1` の G7、§5 Q15）。前は G7（U〔答え〕10-21 23:47）。
// - R45：恒等射は `,` の単位。`,` の被演算子にあれば消え、もう片方の被演算子が答え（木も、もう片方の木そのもの）。片方が恒等射なら G3 の
//   割れも消える。根の `,` が消えて並びだけが残れば、その並びは評価する所（R42）。
// - R46：口の中で穴の規則（R16・R34）が読まない `!_` は、穴と読んでも恒等射と読んでも同じ関数になる所（口の数の決まった関数に口が
//   1つだけ残った所）だけ通し、ほかは G7（括りの関数の口は G5）。
const idPasses = [
	// R44：口の外
	["!_ 5（前は G7）", std("!_ 5"), "(apply !_ 5)", "A"],
	// 値の後ろの恒等射は、2026-10-23 は逆適用で 5 を取った（`(apply !_ 5 ·rev)`・`(apply !_ (construct 5 3) ·rev)`）。2026-10-24 の R47 から
	// 積まれて、何も受けなければ余って `_`（R42）。余ったのが恒等射なので知らせない（R48）。値は今までどおり 5 と `5 3`（U〔答え〕10-22 23:48
	// 「…全部5になるはず…」）。
	["5 !_（R47。前は G7、その後 逆適用）", std("5 !_"), "(construct 5 (unit !_))", "A", { diagCount: 0 }],
	["5 !_ 3（`5 (!_ 3)`、`5 i 3` と同じ。R47。前は G7、その後 逆適用）", std("5 !_ 3"), "(construct 5 (apply !_ 3))", "A"],
	["!_ 5 6（`i 5 6` と同じ、並び全体を受ける。前は G7）", std("!_ 5 6"), "(apply !_ (construct 5 6))", "A"],
	// 2026-10-26 の R74（§5 Q13 の答え）で、恒等射で始まる合成は単位律で恒等射が消える（`i inc` と同じく inc が余る。前は `(unit (compose !_ inc))`）。
	["!_ inc（`i inc` と同じく、R74 で inc が余る。根なので `_`、R42。前は G7、その後 `(compose !_ inc)`）", std("!_ inc"), "(unit inc)", "A"],
	// 2026-10-26 の R28 の書き直しで、`!_ _` は末尾の `_` が消えて `!_` 1つ（根なので `_`、恒等射なので知らせない）、`5 !_ _` は `5 !_` と同じ。前は `i _` と同じ
	// 終わりの `(apply !_ _)`・`(construct 5 (apply !_ _))`。
	["!_ _（R28 で `!_`、根なので `_`。前は `i _` と同じ終わり、その前は G7）", std("!_ _"), "(unit !_)", "A", { diagCount: 0 }],
	["5 !_ _（R28 で `5 !_` と同じ。前は `5 (!_ _)` の終わり、その前は G7・逆適用）", std("5 !_ _"), "(construct 5 (unit !_))", "A", { diagCount: 0 }],
	// inc 5 が閉じた後ろの口の外の恒等射に inc を合成して余る（R47・R42・R48）。2026-10-23 は `inc (!_ (inc 5))`。
	["inc 5 !_ inc（inc 5 が閉じた後ろの口の外。R47。前は G7、その後 逆適用。R74 で恒等射が消える、前は `(compose !_ inc)`）", std("inc 5 !_ inc"), "(construct (apply inc 5) (unit inc))", "A"],
	["本体 t : y ? !_ y（前は G7）", std("t : y ? !_ y"), "(apply !_ y)", "A", { body: true }],
	// 本体は評価する所でない（R42 の読み1）が、2026-10-24 の R52 から、y の上に積まれて何も受けずに閉じた恒等射は余って `_` で消える（恒等射
	// なので知らせない、R48）。R47 の最初の版は、ラムダのまま残って値と関数の並んだ構築が種類を決めなかった（未知、§5 Q38）。2026-10-23 は
	// 逆適用で `(apply !_ y ·rev)`、A。
	["本体 t : y ? y !_（R52。R47 では未知（Q38）、その前は G7、その後 A）", std("t : y ? y !_"), "(construct y (unit !_))", "A", { body: true, leftoverDiag: [] }],
	// R46：口の中で、口の数の決まった関数に口が1つだけ残った所（穴の λ は η でその部分適用そのもの）
	["inc !_ inc（`inc inc` と同じ関数。前は G7）", std("inc !_ inc"), "(unit (compose inc !_ inc))", "A"],
	["inc !_ inc 5（前は G7）", std("inc !_ inc 5"), "(apply (compose inc !_ inc) 5)", "A"],
	["[+ 1] !_（`[+ 1]` と同じ関数。前は G7）", std("[+ 1] !_"), "(unit (compose [+ 1] !_))", "A"],
	["[+ 1] !_ 5（前は G7）", std("[+ 1] !_ 5"), "(apply (compose [+ 1] !_) 5)", "A"],
	["[<<] 1 !_（`[<<] 1` と同じ関数。前は G7）", std("[<<] 1 !_"), "(unit (compose (apply [<<] 1) !_))", "A", { pfInfo: "[<<]" }],
	["go2 : go ⏎ go2 !_ 3（別名の頭。穴なら `go 3`、恒等射でも `go 3`。前は G7）", std([...GO, "go2 : go", "go2 !_ 3"]), "(apply (compose go2 !_) 3)", "A"],
	// R45：`,` の単位
	["!_ , 5（前は G7）", std("!_ , 5"), "5", "A"],
	["5 , !_（前は G7）", std("5 , !_"), "5", "A"],
	["i , 5（前は (, i 5)）", std(["i : !_", "i , 5"]), "5", "A"],
	["5 , i（前は (, 5 i)）", std(["i : !_", "5 , i"]), "5", "A"],
	["(i) , 5（括った恒等射も）", std(["i : !_", "(i) , 5"]), "5", "A"],
	["1 , !_ , 2（`,` は右結合なので `1 , 2`。前は G7）", std("1 , !_ , 2"), "(, 1 2)", "A"],
	["!_ , !_（1 × 1 ≅ 1。根なので `_`、R42。前は G7）", std("!_ , !_"), "(unit !_)", "A"],
	["!_ , !_ , 5（前は G7）", std("!_ , !_ , 5"), "5", "A"],
	["(!_ , !_) , 5（括りの中で消えた恒等射も単位）", std("(!_ , !_) , 5"), "5", "A"],
	// `!_ , _`（R45 では恒等射が消えて `_` が残った）は、2026-10-25 の R61（`,` の被演算子の書いた `_` も積の単位）から、どちらの単位が消えるかで
	// 残る物が割れるので G7（§5 Q61）。下の「R58〜R61」の節へ移した。
	["!_ , 1 2（前は G7）", std("!_ , 1 2"), "(construct 1 2)", "A"],
	["inc , !_（根なので `_`、R42。前は G7）", std("inc , !_"), "(unit inc)", "A"],
	// 片イ（R123）：`,` の被演算子に丸ごと残った関数は `_`（木は `(unit …)`）と leftover-lambda（前は `(, inc double)`・`(, inc (, $!_ double))`）。
	["inc , !_ , double（器の長さが変わる。前は G7）（片イの R123 で inc・double は `_`）", std("inc , !_ , double"), "(, (unit inc) (unit double))", "A", { leftoverDiag: ["inc", "double"] }],
	["inc , $!_ , double（器に残すなら `$!_`）（片イの R123 で inc・double は `_`）", std("inc , $!_ , double"), "(, (unit inc) (, $!_ (unit double)))", "A", { leftoverDiag: ["double", "inc"] }],
	["x2 : !_ , !_ ⏎ x2 5（定義の右辺の `,` も消える）", std(["x2 : !_ , !_", "x2 5"]), "(apply x2 5)", "A"],
	["cc : !_ , inc ⏎ cc 5", std(["cc : !_ , inc", "cc 5"]), "(apply cc 5)", "A"],
	["[!_ , 5] 3（括りの中の `!_ , 5` は 5）", std("[!_ , 5] 3"), "(construct [!_ , 5] 3)", "A"],
	// R45：片方が恒等射なら G3 の割れも消える（`(f x) , !_` と `f (x , !_)` はどちらも `f x`）。残った並びは、根なら評価する所（R42）。
	["inc 1 , !_（前は G3）", std("inc 1 , !_"), "(apply inc 1)", "A"],
	["!_ , inc 1（前は G3）", std("!_ , inc 1"), "(apply inc 1)", "A"],
	["!_ 5 , !_（前は G3）", std("!_ 5 , !_"), "(apply !_ 5)", "A"],
	["inc add 5 , !_（根の並びと同じ `_`。前は G3）", std("inc add 5 , !_"), "(unit (apply (compose inc add) 5))", "A"],
	// 行 `1 2 f2` と同じ（R47 で f2 は積まれて余り、根で `_`。2026-10-23 は `1 (2 f2)`）。
	["1 2 f2 , !_（根の並びと同じ。前は G3）", std("1 2 f2 , !_"), "(construct 1 2 (unit f2))", "A"],
	// §5 Q41 の答え（2026-10-25、R61）：`,` の被演算子の書いた `_` も積の単位で消える（U [2026-10-25 08:41 533071da]「Q41 / _ , 5 も 5 , _ も 5 に
	// なるはずだ。」）。前（R45 の片）は今の答えのまま `(, _ 5)` だった。
	["_ , 5（R61、§5 Q41 の答え。前は `(, _ 5)`）", std("_ , 5"), "5", "A"],
	// 片イ（R126）：`!_ X` は `i X` と同じく、恒等射を消した並びで畳み直す（`!_ 1 2 inc` は `1 2 inc`、`5 !_ 3 inc` は `5 3 inc` で、根に余った inc は `_`）。
	["!_ 1 2 inc（`i 1 2 inc` と同じ）（前は G18、その前は G7）", std("!_ 1 2 inc"), "(construct 1 2 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["5 !_ 3 inc（`5 i 3 inc` と同じ）（前は G18、その前は G7）", std("5 !_ 3 inc"), "(construct 5 3 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	// 片イ（R121）：G3 は廃止。`,` の辺も左から畳む（`inc 1 , !_ , 2` は右結合で `inc 1 , 2`）。
	["inc 1 , !_ , 2（右結合で `inc 1 , 2`）（前は G3）", std("inc 1 , !_ , 2"), "(, (apply inc 1) 2)", "A"],
	["!_ 5 , 6（`!_ 5` は恒等射ではない）（前は G3）", std("!_ 5 , 6"), "(, (apply !_ 5) 6)", "A"],
];
const idRefused = [
	// R44 の帰結：`!_ X` は `i X` と同じ門
	// `!_ 1 2 inc`・`5 !_ 3 inc`（前は G18）は、片イ（R126）で上の idPasses へ移した。
	// `!_ inc 1 2`（`i inc 1 2` と同じ G18）と `!_ inc _`（`i inc _` と同じ G5、§5 Q18）は、2026-10-26 の R74（§5 Q13 の答え）で恒等射が消えて `inc 1 2`・`inc _` と
	// 同じく通る（いちばん後ろの「R73〜R79」の節へ移した）。
	// `vs~ !_`（`vs~ i` と同じ G9、R14）と `5 uu !_`（uu が 5 を逆適用で取って未知になり、その後ろの恒等射で G2(a)）は、逆適用の廃止（R47、
	// G9 も廃止）で、値の後ろに恒等射・合成 `uu !_` が積まれて余る形に決まり、通る側（norevPasses）へ移した。
	// R46：口の中で、穴と恒等射が同じ関数と言えない所は G7 のまま
	["[<<] !_ 2（口が2つ残る）", std("[<<] !_ 2"), "G7"],
	// `add !_ _`（口が2つ残る、G7）は、2026-10-26 の R28 の書き直し（末尾の `_` は消えてから穴の規則を見る）で `add !_` の R34 と同じく通る側（いちばん後ろの
	// 「R28」の節）へ移した。口が2つ残る形の見本は `[<<] !_ 2`（上）と `add !_ vs~`（R46 の表）。
	["[+ 1,] !_（可変長の口）", std("[+ 1,] !_"), "G7"],
	["i !_（恒等射の口は可変長）", std(["i : !_", "i !_"]), "G7"],
	["!_ !_（同じ）", std("!_ !_"), "G7"],
	// 値の後ろに積まれた点なしの口が2つ残る（R47。2026-10-23 は主語の口が決まらない逆適用の口で G7）。素の関数の `5 f2 !_` は、R47 の最初の
	// 版ではここで G7 だったが、同じ日の確かめで、積まれた f2 の後ろの並びにも穴の規則（R34 の k < n）を当てるよう直した（`5 (f2 !_)` と
	// 同じ。norevFixPasses）。穴の規則の頭は名前の定義か `?` の括りだけなので、点なしの `[<<]` は今のまま。
	["5 [<<] !_ 2（積まれた点なしの口が2つ残る。前は 主語の口が決まらない逆適用）", std("5 [<<] !_ 2"), "G7"],
	// `inc !_ _`（R46 で通った `inc !_` の合成に末尾の `_`、`inc i _` と同じ G5、§5 Q18。その前は G7）は、2026-10-26 の R28 の書き直し（末尾の `_` は消えてから
	// 穴の規則を見る）で `inc !_` の穴の関数と同じく通る側（いちばん後ろの「R28」の節）へ移した。
	["io1 inc !_（口に入る段が括りの関数。前は G7）", std([IO1, "io1 inc !_"]), "G5"],
	// 口の中の `!_` で、穴の規則が並び全体で断る形は今のまま（G5・G13、§5 Q40）
	["io1 !_ 5（今のまま G5）", std([IO1, "io1 !_ 5"]), "G5"],
	// `inc 5 !_`（G13）は、2026-10-26 の R69（§5 Q40 の答え）で通る（いちばん後ろの「R64〜R72」の節）。外に値のある `inc 5 !_ 6`（G13）も、2026-10-27 の R89
	// （§5 Q40 の残りの答え）で通る（いちばん後ろの「R83〜R93」の節）。
	// 中置の被演算子の `!_` は今のまま（§5 Q15、U 10-14 03:28）
	["!_ + 1（今のまま G7）", std("!_ + 1"), "G7"],
	["!_ == 1（今のまま G7）", std("!_ == 1"), "G7"],
	["[+ !_]（今のまま G7）", std("[+ !_]"), "G7"],
	// R45：G3 が消えるのは片方が恒等射のときだけ
	// 片イ（R121）で G3 は廃止。この2行は上の idPasses へ移した。
];
for (const [name, s, want, kind, extra] of idPasses) checkPass(`恒等射 ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of idRefused) checkRefused(`恒等射 ${name}`, s, want, inst);

// ---------------------------------------------------------------------------
// 恒等射の確かめの直し（2026-10-23、R44〜R46 の確かめ、§7.20 の「確かめの直し」）
// ---------------------------------------------------------------------------
//
// - 括りの関数の G5 は、`!_` が入る段で見る（holeStep）。`!_` のすぐ前の関数が括りの関数でも、`!_` が入るのが前の関数の口なら、その口で
//   見る（`inc io1 !_` は inc の口で R46。`(inc io1) !_` と同じ）。並び全体で断るのは、括りの関数の頭の口を値で埋めた後ろの `!_` だけ
//   （`pq 1 2 !_`。素の関数の頭の `inc 5 !_`（G13）と同じ問い、§5 Q40）。
// - 単位律（恒等射を消した並び）と、R29 の流れ（恒等射が受けた物を流れとして後ろへ渡す）が割れる所は G18：恒等射が1つ受けた後に合成した、
//   主語の口が1つに決まらない関数（`(5 !_ f2) 3`。単位律では `(5 f2) 3` の G8。根だけなら、どちらも行の終わりで `_`）、2つ以上受けた後に
//   合成した貪欲な単項・ノルム（`!_ 1 2 [* 2,]`。単位律では `1 ([* 2,] 2)`）、単位律では逆適用が断られる所（撒く項の主語・種類の決まらない
//   値の後ろの関数・主語を取った段18 の点なしの後ろの関数）。法則13 が、恒等射を消した並びと比べる。
// - 2026-10-24 の逆適用の廃止（R47）で、単位律の読みの後ろの関数は値の後ろに積まれて値を取らない。だから恒等射が受けた後に合成された関数は、
//   どれも流れの読み（その関数が受ける）と割れて G18（`i 5 inc`・`!_ 5 f2`・`i 1 [* 2,] 2`。前は主語の口が1つに決まる関数なら通していた）。
//   恒等射が何も受けていない形（`5 !_ f2`・`(5 !_ f2) 3`・`5 !_ uu inc`）は、`5 f2` と同じく関数が積まれて余るだけで割れない：根なら通り、
//   括りの中なら値と関数の並んだ構築（未知、§5 Q38）で、後ろに当てれば G7。恒等射が受けた物を、口の数の分からない関数が受けて、その後に
//   関数が合成された形（`i [,] 5 inc`）も G18（単位律では G2(a)。HEAD では通っていた）。
// - 両方とも恒等射の `,` は `!_` を残す（`!_ , i == 1` と `i , !_ == 1` が同じ G7、§5 Q15）。
const PQ = "pq : [a] y ? y"; // UU（本体の根が未知の uu）は上の定義を使う
const idFixPasses = [
	["inc io1 !_（`!_` は inc の口、R46。`(inc io1) !_` と同じ。前は G5）", std([IO1, "inc io1 !_"]), "(unit (compose inc io1 !_))", "A"],
	["inc n !_（同じ。前は G5）", std("inc n !_"), "(unit (compose inc n !_))", "A"],
	// 閉じた値の後ろの口の外の恒等射は積まれて余る（R47・R42。恒等射なので知らせない、R48）。2026-10-23 は逆適用で `!_ (pq 1 2)` など。
	["(pq 1) 2 !_（括りの頭でない。`(add 1) 2 !_` と同じ口の外。R47。前は G5、その後 逆適用）", std([PQ, "(pq 1) 2 !_"]), "(construct (apply [pq 1] 2) (unit !_))", "A"],
	["(add 1) 2 !_（口の外。R47）", std("(add 1) 2 !_"), "(construct (apply [add 1] 2) (unit !_))", "A"],
	["(pq 1 2) !_（括りで閉じた値の後ろ。R47）", std([PQ, "(pq 1 2) !_"]), "(construct [pq 1 2] (unit !_))", "A"],
	// 恒等射は何も受けず、合成 `!_ f2` が 5 の後ろに積まれて余る（R47。`5 f2` と同じ）。2026-10-23 は恒等射が 5 を取り、印 idSplit で残した。
	// 2026-10-26 の R74（§5 Q13 の答え）から、恒等射で始まる合成は単位律で恒等射が消える（下の3行。前の木は `(compose !_ …)`）。
	["5 !_ f2（根だけなら、`5 f2` と同じく余って `_`。R47。R74 で恒等射が消える）", std("5 !_ f2"), "(construct 5 (unit f2))", "A"],
	["(i f2 5) 3（f2 は恒等射が受ける前に合成。単位律でも `(f2 5) 3`）", std(["i : !_", "(i f2 5) 3"]), "(apply [i f2 5] 3)", "A"],
	// `i 1 [* 2,] 2`（1つ受けた後の貪欲な単項。2026-10-23 は単位律でも `1 [* 2,] 2` が逆適用で全部を受けたので通していた）は、R47 で G18（下の
	// idFixRefused）。
	["!_ [* 2,] 1 2（受ける前に合成した貪欲な単項。R74 で恒等射が消える）", std("!_ [* 2,] 1 2"), "(apply [* 2,] (construct 1 2))", "A"],
	// `||!_||` の中の恒等射は消さない。`||!_||` は 5 を取らずに積まれて、後ろの 6 を受ける（R47。2026-10-23 は `||!_|| 5 6`）。
	["5 ||!_|| 6（`5 (||!_|| 6)`、R47。前は `||!_|| 5 6`）", std("5 ||!_|| 6"), "(construct 5 (apply ||!_|| 6))", "A"],
	// 恒等射は何も受けず、合成 `!_ [' 0] inc` が積まれて余る（R47）。2026-10-23 は恒等射が [1 2 3] を逆適用で取り、`[' 0]` が引いた物を inc が受けた。
	["[1 2 3] !_ [' 0] inc（R47。前は `inc ([1 2 3] ' 0)`。R74 で恒等射が消える）", std("[1 2 3] !_ [' 0] inc"), "(construct [1 2 3] (unit (compose [' 0] inc)))", "A"],
	["!_ , i（両方とも恒等射なら `!_` を残す）", std(["i : !_", "!_ , i"]), "(unit !_)", "A"],
	// 片イ（R126）：恒等射が受けた後に合成した関数の割れ（前は G18）は単位律の側に決まり、木は恒等射を消した並びで畳み直す。値の後ろの関数は積まれて
	// 余り（R47）、根なら `_` と leftover-lambda。`i [,] 5 inc` は単位律の `[,] 5 inc` で、種類の未知な `[,] 5` の後ろに積む予想（R120、前は G2(a)）。
	["tq : !_ 5 f2 ⏎ tq 3（同じ）（前は G18）", std(["tq : !_ 5 f2", "tq 3"]), "(construct tq 3)", "A", { leftoverDiag: ["f2"] }],
	["(inc !_ 5 f2) 3（R46 で通した恒等射でも。単位律・穴の読みでは `(inc 5 f2) 3`）（前は G18）", std("(inc !_ 5 f2) 3"), "(construct [inc !_ 5 f2] 3)", "A", { leftoverDiag: ["f2"] }],
	["i 5 inc（単位律では `5 inc` で inc は 5 を取らない）（前は G18、その前は `inc 5` で通る）", std(["i : !_", "i 5 inc"]), "(construct 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["!_ 5 f2（前は G18、その前は行の終わりで `_`）", std("!_ 5 f2"), "(construct 5 (unit f2))", "A", { leftoverDiag: ["f2"] }],
	["i 1 [* 2,] 2（単位律では `1 ([* 2,] 2)`）（前は G18）", std(["i : !_", "i 1 [* 2,] 2"]), "(construct 1 (apply [* 2,] 2))", "A", { leftoverDiag: [] }],
	["inc !_ 5 inc（単位律の `inc 5 inc` は inc が余る）（前は G18）", std("inc !_ 5 inc"), "(construct (apply inc 5) (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["i [,] 5 inc（単位律の `[,] 5 inc`）（前は G2(a)、その前は G18）", std(["i : !_", "i [,] 5 inc"]), "(construct (apply [,] 5) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	["!_ 1 2 [* 2,]（単位律では `1 2 [* 2,]` で `[* 2,]` が余る）（前は G18）", std("!_ 1 2 [* 2,]"), "(construct 1 2 (unit [* 2,]))", "A", { leftoverDiag: ["[* 2,]"] }],
	["i 1 2 [* 2,]（同じ）（前は G18）", std(["i : !_", "i 1 2 [* 2,]"]), "(construct 1 2 (unit [* 2,]))", "A", { leftoverDiag: ["[* 2,]"] }],
	["5 !_ 6 [* 2,]（同じ）（前は G18）", std("5 !_ 6 [* 2,]"), "(construct 5 6 (unit [* 2,]))", "A", { leftoverDiag: ["[* 2,]"] }],
	["!_ 1 2 ||!_||（ノルムも）（前は G18）", std("!_ 1 2 ||!_||"), "(construct 1 2 (unit ||!_||))", "A", { leftoverDiag: ["||!_||"] }],
	["add 1 !_ 5 6 [* 2,]（R46 で通した恒等射でも）（前は G18）", std("add 1 !_ 5 6 [* 2,]"), "(construct (apply add (construct 1 5)) 6 (unit [* 2,]))", "A", { leftoverDiag: ["[* 2,]"] }],
	["inc !_ 5 6 ||!_||（同じ）（前は G18）", std("inc !_ 5 6 ||!_||"), "(construct (apply inc 5) 6 (unit ||!_||))", "A", { leftoverDiag: ["||!_||"] }],
	["!_ vs~ inc（恒等射が撒く項を受けた後に inc を合成）（前は G18）", std("!_ vs~ inc"), "(construct vs~ (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["i vs~ [* 2,] 5（同じ）（前は G18）", std(["i : !_", "i vs~ [* 2,] 5"]), "(construct vs~ (apply [* 2,] 5))", "A", { leftoverDiag: [] }],
];
const idFixRefused = [
	// 括りの関数の頭の口を値で埋めた後ろの `!_`（§5 Q40、素の関数の頭の `inc 5 !_` と同じ問い）。外が `!_` だけの `pq 1 2 !_`（G5）は、2026-10-26 の
	// R69（§5 Q40 の答え）で通る（いちばん後ろの「R64〜R72」の節）。外に値のある `pq 1 2 !_ 5`（G5）も、2026-10-27 の R89 で通る（いちばん後ろの「R83〜R93」の節）。
	// 括りの関数の口に入る `!_` は、畳み込みの1歩で G5
	["5 io1 !_（`!_` は io1 の口）", std([IO1, "5 io1 !_"]), "G5"],
	["inc io1 5 !_（inc が閉じて、`!_` は io1 の口）", std([IO1, "inc io1 5 !_"]), "G5"],
	["pq 1 !_（pq の口）", std([PQ, "pq 1 !_"]), "G5"],
	// `!_` が入るのが前の関数の口なら、その口で見る（R46）
	["add io1 !_（add の口が2つ残る。前は G5）", std([IO1, "add io1 !_"]), "G7"],
	// 2026-10-26 の R74 から、頭の恒等射が消えて `io1 !_`（括りの関数の口の穴）と同じ G5（前は G7：恒等射の口は可変長）。
	["!_ io1 !_（R74 で `io1 !_` と同じ G5。前は G7、その前は G5）", std([IO1, "!_ io1 !_"]), "G5"],
	// 恒等射が受けた後に合成した関数（2026-10-23 は、主語の口が1つに決まらない関数だけを断っていた。単位律では `5 f2`、§5 Q5）。
	// R47 で、恒等射が 5 を受けるのは並びの頭の `!_ 5 f2` の形だけで、そこは後ろの関数が何でも G18（単位律では f2 は 5 を取らない）。
	// 片イ（R126）で、この行から下の G18 の行（と G2(a) の `i [,] 5 inc`）は上の idFixPasses へ移した。
	// 恒等射が受けた物を口の数の分からない関数が受け、その後に関数が合成された形（R47 の確かめで足した。HEAD では通っていた）。単位律の
	// 読みでは、その関数が受けた後に関数が来て G2(a)（`[,] 5 inc`・`f2 vs~ inc`）。
	// 2026-10-26 の R74 から、頭の恒等射が消えて単位律の `[,] 5 inc` と同じ G2(a)（前は G18）。
	// 2026-10-24 の R51 から、f2 は恒等射が渡した撒いた流れを畳み込みで受けて閉じ、単位律の `f2 vs~ inc` では inc が畳み込みの値の
	// 後ろに積まれて値を取らない（流れの読みでは受ける）ので、「受けた後に合成された関数」の G18。前は、撒く項を受けた f2 は口の数が
	// 数えられず、単位律では `f2 vs~ inc` の G2(a) で、口の数の分からない関数の G18 だった（答えは同じ G18）。
	// `i f2 vs~ inc`（R51 から G18：畳み込みの値の後ろの inc）は、2026-10-26 の R74 で頭の恒等射が消えて単位律の `f2 vs~ inc` と同じく通る（いちばん後ろの
	// 「R73〜R79」の節へ移した）。
	// 2026-10-23 は G18 だった `(5 !_ f2) 3` の形（`(5 !_ f2) 3`・`(5 i f2) 3`・`(5 !_ inc f2) 3`・`(5 !_ add f2) 3`・`(5 c9) 3`・`3 (5 !_ f2)`）は、
	// R47 で恒等射が 5 を受けず（合成 `!_ f2` が 5 の後ろに積まれる）、括りの中が値と関数の並んだ構築（未知、§5 Q38）で G7 だった。2026-10-24 の
	// R52 から、何も受けない合成は括りの中でも余って消えるので通り、いちばん後ろの「評価する所の外で余ったラムダ」の節（r52Passes）へ移した。
	// 単位律の `(5 f2) 3` も同じく通り、割れない。
	// 恒等射が受けた後に合成した貪欲な単項・ノルム（2026-10-23 は、単位律では一番近い1項だけを逆適用で取るので割れた。R47 では、単位律の
	// 読みの後ろの関数は値を取らずに積まれるので、やはり割れる）
	// 2026-10-23 に、単位律では逆適用が断られる所として断っていた形。R47 では、恒等射が受けた後に合成した関数は全部 G18 なので、`!_ vs~ inc`・
	// `i vs~ [* 2,] 5` は今までどおり G18（理由は「受けた後に合成」に移った）。恒等射が何も受けていない `5 !_ uu inc`・`5 !_ [' 0] inc` は、
	// 合成が 5 の後ろに積まれて余るだけで割れず（単位律の `5 uu inc`・`5 [' 0] inc` も同じく余る）、通る側（norevPasses）へ移した。
	// 両方とも恒等射の `,` は、並べた順に依らない
	["!_ , i == 1（`!_` を残して G7。前は通っていた）", std(["i : !_", "!_ , i == 1"]), "G7"],
	["i , !_ == 1（同じ G7）", std(["i : !_", "i , !_ == 1"]), "G7"],
	// R45 が G3 の前に名前を解くので、値の定義を含む輪は name-cycle（§5 Q30。前は G3 が先で輪に届かなかった）
	["aa : inc 1 , bb ⏎ bb : aa（輪）", std(["aa : inc 1 , bb", "bb : aa"]), "name-cycle"],
	["bb : aa ⏎ aa : inc 1 , bb（行の順に依らない）", std(["bb : aa", "aa : inc 1 , bb"]), "name-cycle"],
];
for (const [name, s, want, kind, extra] of idFixPasses) checkPass(`恒等射の直し ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of idFixRefused) checkRefused(`恒等射の直し ${name}`, s, want, inst);

// ---------------------------------------------------------------------------
// 逆適用の廃止（2026-10-24、R47・R48、§7.21）
// ---------------------------------------------------------------------------
//
// 経緯：逆適用の狙いは UFCS だった（U 08-05 07:25「apply reverse はUFCSのように書けたらと思った狙い」、§5 Q5）。U [2026-10-23 12:23 ebf18260]
// 「…構造体もリストも参照渡しで、仮引数で括りを作った中で渡し方を指定するようになった。 という事を考えると、実は逆適用の必要性がなくなった
// のではないか？…」。主の Claude が残る形・断る形の表を出して「`5 f2` のように、口が2つ以上の関数への逆適用は、根で `_` になる形も含めて
// 断る、でいい？」と訊き、U [2026-10-23 13:12 ebf18260]「いやこれ、むしろ2引数を断るなら逆適用の意味が余計に薄い上に構文が乱れる元だから、
// 廃止だね。 逆適用は廃止しよう」。続く主の Claude の問い「A の後の L は積む（関数は右からだけ受ける）。根でラムダが余って `_` になったら
// 診断で知らせる。これでいい？」に、U〔答え〕[2026-10-23 15:32 ebf18260]「合ってる。 それでOK！」。
// - R47：畳み込みの1歩は3行。L·A は適用、L·L は合成、いちばん上が A か空なら次の項を積む（L も積み、積まれた L は後ろの項を右から受ける）。
// - R48：評価する所で余ったラムダは今までどおり `_`（R42、並びの中では消える、R15）で、leftover-lambda で知らせる（重さは 2026-10-24 の
//   §5 Q44 の答えで information から warning に上げた）。余ったのが恒等射（`!_`・`i : !_` の i・恒等射どうしの合成）なら知らせない。括りの中・
//   `:` の右辺・本体は評価する所でないので知らせない（同じ日の R52 と §5 Q50 の答えから、値の上に積まれて閉じた関数はそこでも知らせる）。
// 上の節の行のうち、門が無くなって通る側へ移った行と、主の Claude が示した表の行をここに置く。法則は coproduct_laws.test.js の法則5
// （値の後ろの関数は、値を取らない）。
const UU_DEF = "uu : x ? [,] x";
const norevPasses = [
	// 主の Claude が示した、答えが変わる形の表（U〔答え〕10-23 15:32 の前）。行の名前の「前は」は 2026-10-23 の答え。
	["表 5 inc 3（`5 (inc 3)`。前は `(inc 5) 3`）", std("5 inc 3"), "(construct 5 (apply inc 3))", "A", { leftoverDiag: [] }],
	["表 1 2 inc（`1 2`、inc は余って `_`。前は `1 (inc 2)`）", std("1 2 inc"), "(construct 1 2 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["表 1 2 [+] 3 4（`1 2 ([+] 3 4)`。前は `1 ([+] 2 3 4)`）", std("1 2 [+] 3 4"), "(construct 1 2 (apply [+] (construct 3 4)))", "A", { leftoverDiag: [] }],
	["表 inc 1 2 inc（`(inc 1) 2`。前は `(inc 1) (inc 2)`）", std("inc 1 2 inc"), "(construct (apply inc 1) 2 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["表 5 f2 1（`5 (f2 1)`、足りないので根で `_`。前は G8）", std("5 f2 1"), "(construct 5 (unit (apply f2 1)))", "A", { leftoverDiag: ["(apply f2 1)"] }],
	["表 vs (map $inc)（`vs`、map の部分適用が余る）", std("vs (map $inc)"), "(construct vs (unit [map $inc]))", "A", { leftoverDiag: ["[map $inc]"] }],
	["表 5 !_（5 のまま。余った恒等射は知らせない。前は逆適用）", std("5 !_"), "(construct 5 (unit !_))", "A", { leftoverDiag: [] }],
	["表 5 !_ 3（`5 3` のまま。前は逆適用）", std("5 !_ 3"), "(construct 5 (apply !_ 3))", "A", { leftoverDiag: [] }],
	// 門が無くなって通る側へ移った行（元の節と、前の門）。G8（主語の口が決まらない逆適用の後に実引数か `_` が来る）・G9（撒く項の後ろの関数、
	// R14）は廃止した。ほかの門から移った行は、その門の前提だった逆適用が無くなった物。
	// 2026-10-28 の片9b：§6.3 の表の G9 の見本の行（撒く xs は STD に無い未定義の名前）は、R111 から xs が `_` で、撒けば長さ 0 の流れになり、見本の意図（撒いた器の
	// 後ろに積まれた関数）を見なくなったので外した。その意図は次の行（余りと流れ）と、R49〜R51 の試しの節の「いちばん上が値なら今までどおり積む」の行が見る。
	// 片9b の最初の版は、行の中で撒く名前を STD の vs に替えていたが、それは値の後ろに関数を置いた字面を新しく書くことになる（R47。確かめの指摘）。
	["G9 1 vs~ inc（余りと流れ。前は G9）", std("1 vs~ inc"), "(construct 1 vs~ (unit inc))", "A"],
	["G9 vs~ !_（恒等射。前は `vs~ i` と同じ G9）", std("vs~ !_"), "(construct vs~ (unit !_))", "A", { leftoverDiag: [] }],
	["G8 1 [,] 2 3 4（確かめ・値の後ろの点なし。前は G8、その前は G2(a)）", std("1 [,] 2 3 4"), "(construct 1 (apply [,] (construct 2 3 4)))", "未知"],
	["G8 5 use 5 inc（穴・余りと流れ。前は G2(b)、その後 G8）", std("5 use 5 inc"), "(construct 5 (unit (compose (apply use 5) inc)))", "A"],
	// 2026-10-26 の R28 の書き直しで、`5 add 3 _` は `5 (add 3)`：add 3 は値の上で何も受けずに閉じて `_`（R52）。前は `5 (add 3 _)` の終わり。
	["G8 5 add 3 _（R28 で `5 (add 3)`、R52 の `_`。前は `5 (add 3 _)` の終わり、その前は G8）", std("5 add 3 _"), "(construct 5 (unit (apply add 3)))", "A", { leftoverDiag: ["(apply add 3)"] }],
	["G8 1 [<<] 2 3 4（畳み込み。前は `1 ([<<] 2 3) 4`、その後 G8）", std("1 [<<] 2 3 4"), "(construct 1 (apply [<<] (construct 2 3)) 4)", "A", { pfInfo: "[<<]" }],
	["G8 1 [<<] 2 3 4 inc（畳まない・値の後ろの点なし。前は G12(a)、その後 G8）", std("1 [<<] 2 3 4 inc"), "(construct 1 (apply [<<] (construct 2 3)) 4 (unit inc))", "A"],
	["G8 5 t3 1 2（答え。部分適用の節が逆適用の右だった）", src(["t3 : u v [~r] ? u", "5 t3 1 2"]), "(construct 5 (unit (apply t3 (construct 1 2))))", "A"],
	["G8 inc 3 4 f2 5 6 inc 6（余りと流れ。問いの例の答え `(inc 3) 4 (f2 5 6) (inc 6)` に戻った。前は G12(a)、その後 G8）", std("inc 3 4 f2 5 6 inc 6"), "(construct (apply inc 3) 4 (apply f2 (construct 5 6)) (apply inc 6))", "A"],
	["G8 5 gf inc _（余りと流れ。`_` は gf の既定値のある口、R39。前は G2(a)、その後 G8）", std([GF, "5 gf inc _"]), "(construct 5 (apply (compose gf inc) _))", "未知"],
	["G8 inc 1 2 f2 3（確かめ。前は G12(a)、その後 G8）", std("inc 1 2 f2 3"), "(construct (apply inc 1) 2 (unit (apply f2 3)))", "A"],
	["G2(a) 1 uu inc 5（確かめ。uu が 1 を逆適用で取って未知になっていた）", std([UU_DEF, "1 uu inc 5"]), "(construct 1 (apply (compose uu inc) 5))", "未知"],
	["G2(a) vs [' 0] inc 4（値の後ろの点なし。`[' 0]` が vs を逆適用で取っていた）", std("vs [' 0] inc 4"), "(construct vs (apply (compose [' 0] inc) 4))", "未知"],
	// `5 uu !_` は、R47 の最初の版では合成 `uu !_`（R46）が余る `(construct 5 (unit (compose uu !_)))` だった。同じ日の確かめで、積まれた uu の
	// 後ろの並びにも穴の規則を当てるよう直し、`uu !_` は穴の関数（R16。`5 (uu !_)` と同じ。η で同じ関数）。
	["G2(a) 5 uu !_（穴の関数が余る。前は uu が 5 を逆適用で取って未知になっていた）", std([UU_DEF, "5 uu !_"]), "(construct 5 (unit (? [$p0] (apply uu $p0))))", "A"],
	["G2(a) 5 uu bad（確かめ。前は G5、その後 G2(a)。bad は呼ばれない）", src([UU, BAD, "5 uu bad"]), "(construct 5 (unit (compose uu bad)))", "A"],
	// 2026-10-26 の R74（§5 Q13 の答え）で、頭の恒等射は単位律で消える（下の3行。前の木は `(compose !_ …)`）。
	["G18 5 !_ uu inc（恒等射の直し。恒等射は何も受けず、単位律の `5 uu inc` と同じく余る。R74 で恒等射が消える）", std([UU_DEF, "5 !_ uu inc"]), "(construct 5 (unit (compose uu inc)))", "A"],
	["G18 5 !_ [' 0] inc（恒等射の直し。同じ）", std("5 !_ [' 0] inc"), "(construct 5 (unit (compose [' 0] inc)))", "A"],
	// R48 の診断：出る形（評価する所の終わりに、恒等射でないラムダが余る）。
	["R48 5 inc", std("5 inc"), "(construct 5 (unit inc))", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	["R48 5 (inc)（括った関数も）", std("5 (inc)"), "(construct 5 (unit [inc]))", "A", { leftoverDiag: ["[inc]"] }],
	["R48 5 !_ inc（恒等射に合成した関数は恒等射でない。R74 で恒等射が消え、知らせるのは inc）", std("5 !_ inc"), "(construct 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["R48 inc add 5（流れの足りない合成。R42 の前からの形）", std("inc add 5"), "(unit (apply (compose inc add) 5))", "A", { leftoverDiag: ["(apply (compose inc add) 5)"] }],
	// 2026-10-28 の R105 で `add _ 10` は `add 10`（部分適用）なので、根に余るのは `(apply add 10)`。前は穴の関数 `(? [$p0] (apply add (construct $p0 10)))`。
	["R48 add _ 10（根に余った部分適用。R105 で `add 10`、前は穴の関数）", std("add _ 10"), "(unit (apply add 10))", "A", { leftoverDiag: ["(apply add 10)"] }],
	["R48 inc add 5 , !_（根の `,` が恒等射で消えた行も評価する所、R45）", std("inc add 5 , !_"), "(unit (apply (compose inc add) 5))", "A", { leftoverDiag: ["(apply (compose inc add) 5)"] }],
	["R48 inc 1 _（足りた適用は余らない）", std("inc 1 _"), "(apply inc 1)", "A", { diagCount: 0 }],
	// 出ない形：余ったのが恒等射（落としても当てても値が同じ）。
	["R48 !_（根に1つの恒等射。U 10-22 23:41「…!_ だけを評価したら _ に戻るのは都合がいいね」）", std("!_"), "(unit !_)", "A", { diagCount: 0, leftoverDiag: [] }],
	["R48 i : !_ ⏎ 5 i（名前の恒等射）", std(["i : !_", "5 i"]), "(construct 5 (unit i))", "A", { diagCount: 0, leftoverDiag: [] }],
	["R48 i : !_ ⏎ 5 i i（恒等射どうしの合成も恒等射）", std(["i : !_", "5 i i"]), "(construct 5 (unit (compose i i)))", "A", { diagCount: 0, leftoverDiag: [] }],
	["R48 !_ , !_（`,` の単位で消えて残った恒等射）", std("!_ , !_"), "(unit !_)", "A", { diagCount: 0, leftoverDiag: [] }],
	// R48 の片では出ない形だった：`:` の右辺は式を指すだけ（R52 の外）で、v は未知。2026-10-24 の §5 Q50 の答えから、右辺は閉じた1つの項で
	// R52 を当てるので、定義の行で知らせ、v は 5（closedRhsPasses）。
	["R48 v : 5 inc（Q50 の答えから定義の行で知らせる。前は `(construct 5 inc)` で知らせなかった）", std("v : 5 inc"), "(: v (construct 5 (unit inc)))", null, { diagCount: 1, leftoverDiag: ["inc"] }],
	["R48 v : 5 inc ⏎ v（v は 5 で、根でも余らない。知らせるのは定義の行の1回。前は v が未知）", std(["v : 5 inc", "v"]), "v", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	// 2026-10-24 の R52 から出る形：評価する所の外（括りの中・本体）でも、値の上に積まれて何も受けずに閉じた関数は余ったラムダで `_` になり、
	// 知らせる。R47 の最初の版（R48）は、評価する所でないので知らせず、値と関数の並んだ構築は種類を決めなかった（未知、§5 Q38）。
	["R52 (5 inc)（括りの中。R48 では未知で知らせなかった）", std("(5 inc)"), "[5 inc]", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	["R52 t : y ? y inc（本体。R48 では未知で知らせなかった）", std("t : y ? y inc"), "(construct y (unit inc))", "A", { body: true, diagCount: 1, leftoverDiag: ["inc"] }],
	// 片イ（R126）：恒等射が受けた後に関数が来る割れは単位律の側に決まり（恒等射を消して `5 inc`）、G15 の `_` は木では消える予想。（R120）種類の未知な
	// `uu 5` の後ろの関数は積む予想。根に余った関数は `_` と leftover-lambda。
	["通る：!_ 5 inc（単位律では `5 inc` で inc が余る）（前は G18）", std("!_ 5 inc"), "(construct 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["通る：i 5 inc（単位律では 5 の後ろに inc が余る）（前は G18）", std(["i : !_", "i 5 inc"]), "(construct 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["通る：5 uu 5 inc（種類の未知な `uu 5` の後ろに関数）（前は G2(a)）", std([UU_DEF, "5 uu 5 inc"]), "(construct 5 (apply uu 5) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	["通る：5 go 1 2 _ 3（仮引数の外の内側の `_`）（前は G15）", std([...GO_DEFAULT, "5 go 1 2 _ 3"]), "(construct 5 (apply go (construct 1 2 3)))", "未知"],
];
const norevRefused = [
	// R47 から断る側へ移った行は、元の節に置いた（`[' 0] [1 2 3] inc` の G2(a)・`i 5 inc` の G18 など）。ここには、逆適用が無くなっても
	// 残る門の見本を置く。
	// `i inc 1 2`（流れでは `inc [1 2]`、単位律では `(inc 1) 2` で G18）は、2026-10-26 の R74（§5 Q13 の答え）で単位律の `(inc 1) 2` に決まった（いちばん後ろの
	// 「R73〜R79」の節）。G18 は、恒等射が受けた後に関数が来る形で残る。
	// 片イ（R126・R120）で、G18 の2行（`!_ 5 inc`・`i 5 inc`）・G2(a) の `5 uu 5 inc`・G15 の `5 go 1 2 _ 3` は門が無くなり、上の norevPasses へ移した。
	["G7 は残る：5 [<<] !_ 2（積まれた点なしの口が2つ残る、R46。素の関数の `5 f2 !_` は穴の規則が読む、norevFixPasses）", std("5 [<<] !_ 2"), "G7"],
	// `5 go _ 3`（G15。積まれた go の最初の口は既定値が無い）は、2026-10-26 の R68（§5 Q8 の答え）でカリー化して通る（いちばん後ろの「R64〜R72」の節）。
	// 最後の項の `_` が既定値の無い口に当たる形（`5 go _`、G15）は、2026-10-26 の R28 の書き直し（既定値の無い口の末尾の `_` は消える）で `5 go` と同じく通る側
	// （いちばん後ろの「R28」の節）へ移した。G15 に残るのは、位置が数えられない形と内側の `_`（`gd inc _ 3`・`5 go 1 2 _ 3`）。
];
for (const [name, s, want, kind, extra] of norevPasses) checkPass(`逆適用の廃止 ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of norevRefused) checkRefused(`逆適用の廃止 ${name}`, s, want, inst);

// ---- 逆適用の廃止の確かめ（2026-10-24、R47 の片の確かめの指摘を当てた行） ----
//
// (1) 値の後ろに積まれた関数の並び（§3.3 の手順2・4、R47）：積まれた関数 F は後ろの並び Y を右から受け、前の値は取らないので、`X F Y` の
//     F Y は括った `(F Y)` と同じ1つの並び（法則5）。穴の規則（R16・R34・R38）と、その断り（G13、括りの関数の頭の G5）も、F を頭にした並びで
//     見る。R47 の最初の版は並び全体の頭だけを見ていて、`5 inc _ 7` が G5・`5 (inc _ 7)` が `5 (inc 7)`、`5 add 1 2 !_` が通り・
//     `5 (add 1 2 !_)` が G13 と割れていた（反証の指摘。断りすぎの側と、§5 Q40 の片方を黙って選ぶ側の両方）。
// (2) 恒等射で消えた `,` の後の並びにも、外の `,` の G3 が当たる（R45 の単位律で `2 , !_ , inc 1` は `2 , inc 1`）。HEAD fc638712 から前からの
//     穴で、R47 の値と関数の並び（`1 , !_ , 5 inc`）もこの抜け道に乗っていた（確かめの指摘）。
// (3) 括りの関数の末尾の `_` で、`_` を除いた実引数が足りない形は、値の後ろでも G5（`io1 _` と同じ）。2026-10-23 は逆適用で通っていた
//     （`5 io1 _` は `(apply io1 5 ·rev)`）。仕様の記録は「前は G8」と書いていて、通る→断るの変化が読めなかった（確かめの指摘）。
// (4) 黒い芽のうち、評価する所の外で、診断も門も無いまま未知の根で通っていた所（§5 Q35・Q38・Q44 に名指しした）。2026-10-24 の R52 から、
//     値の上に積まれて何も受けずに閉じた関数は、どこでも（`:` の右辺を除く）余ったラムダで `_` になり、知らせる（後ろの R52 の節）。同じ日の
//     §5 Q50 の答えから、`:` の右辺も除かない（除くのは `$[…]` の中身の並びだけ、いちばん後ろの節）。
const IO1_FIX = "io1 : [say] ? say 21";
const norevFixPasses = [
	// (1) 穴の規則が F の並びで読む（`5 (F Y)` と同じ）
	["5 inc _ 7（`inc _ 7` は R38 で `inc 7`。R47 の最初の版は G5、2026-10-23 は `(inc 5) 7`）", std("5 inc _ 7"), "(construct 5 (apply inc 7))", "A", { leftoverDiag: [] }],
	// 2026-10-28 の R105：`f2 _ 3` は `f2 3`（部分適用）で、余って `_`。前は R16 のカリー化の穴 `(? [$p0] (apply f2 (construct $p0 3)))` が余っていた。
	["5 f2 _ 3（`f2 _ 3` は R105 で `f2 3`、余って `_`。前は R16 のカリー化、R47 の最初の版は G5、2026-10-23 は G8）", std("5 f2 _ 3"), "(construct 5 (unit (apply f2 3)))", "A", { leftoverDiag: ["(apply f2 3)"] }],
	["5 f2 !_（`f2 !_` は R34 の k < n。R47 の最初の版は G7）", std("5 f2 !_"), "(construct 5 (unit (? [$p0 [~$p1]] (apply f2 (construct $p0 $p1~)))))", "A", { leftoverDiag: ["(? [$p0 [~$p1]] (apply f2 (construct $p0 $p1~)))"] }],
	["5 add !_ 3 4（`add !_ 3 4` は R34 の k > n で `add 4 3`。R47 の最初の版は G7）", std("5 add !_ 3 4"), "(construct 5 (apply add (construct 4 3)))", "A"],
	["5 add 3 _ 4（`add 3 _ 4` は R38 で `add 3 4`。R47 の最初の版は G5）", std("5 add 3 _ 4"), "(construct 5 (apply add (construct 3 4)))", "A"],
	["5 inc !_ 3（`inc !_ 3` は R34 で `inc 3`。R47 の最初の版は合成 `(apply (compose inc !_) 3)`、値は同じ）", std("5 inc !_ 3"), "(construct 5 (apply inc 3))", "A"],
	["5 inc !_（`inc !_` は R16 の穴。R47 の最初の版は合成 `inc !_`（R46）で、η で同じ関数）", std("5 inc !_"), "(construct 5 (unit (? [$p0] (apply inc $p0))))", "A", { leftoverDiag: ["(? [$p0] (apply inc $p0))"] }],
	// 2026-10-28 の R105 で `add _ 10` は `add 10`（下の2行も。前は R16 の穴の関数）。
	["5 inc 3 add _ 10（閉じた `inc 3` の後ろに積まれた add も同じ。R105 で `add 10`）", std("5 inc 3 add _ 10"), "(construct 5 (apply inc 3) (unit (apply add 10)))", "A"],
	["_ add _ 10（頭の `_` は消え（R43）、`add _ 10` と同じ。R105 で `add 10`。前は穴の関数、その前は G5）", std("_ add _ 10"), "(unit (apply add 10))", "A"],
	// 後ろに関数があれば穴の規則は読まない（穴でない項が全部 A ではない）ので、畳み込みの1歩のまま（`inc 5 !_ inc` と同じ）。
	["5 inc 5 !_ inc（今までどおり口の外の恒等射、R44。R74 で頭の恒等射が消える、前は `(compose !_ inc)`）", std("5 inc 5 !_ inc"), "(construct 5 (apply inc 5) (unit inc))", "A"],
	["5 inc _（R28 の書き直しで `5 inc` と同じ。前は R28 の終わり `(construct 5 (apply inc _))`）", std("5 inc _"), "(construct 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	// (2) 恒等射どうしなら、残るのはもう片方の並び（`!_ , inc 1` と同じ）
	["!_ , !_ , inc 1（今までどおり）", std("!_ , !_ , inc 1"), "(apply inc 1)", "A"],
	// (4) 黒い芽。R47 の片では、段4〜8 の辺は評価する所でないので値と関数の並びが未知で、R48 は知らせなかった（未知の根で通る、診断なし。
	// §5 Q38・Q44）。2026-10-24 の R52 から、辺でも、値の上に積まれて何も受けずに閉じた関数は余ったラムダで `_` になり、知らせる。
	// 主の Claude が 06:01（UTC）の返事で「`5 inc == 6` は、`inc 5 == 6` のつもりで書いても黙って通る（Q38・Q44）」と書き（03:03 の逆適用の
	// 廃止の報告にも同じ趣旨の行）、利用者がその文を引いて U [2026-10-24 06:29 ebf18260]「困ったね…逆適用はすべて廃止だと言ってるのに～」（§7.24）。
	["5 inc == 5（R52 で `5 == 5`、知らせる。R47 では未知の根で診断なし、2026-10-23 は `(inc 5) == 5` で A）", std("5 inc == 5"), "(== (construct 5 (unit inc)) 5)", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	["inc 1 == 2 inc（R52 で `inc 1 == 2`、知らせる。R47 では未知の根で診断なし）", std("inc 1 == 2 inc"), "(== (apply inc 1) (construct 2 (unit inc)))", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	// (4) 本体の根が値と関数の並び。R47 の片では未知（G16 は根が L の本体だけ、§5 Q35）で、診断なし。2026-10-23 は `y add` が逆適用で口の
	// 決まらない L になり G16、`y inc` は `inc y` で A だった。R52 から、本体の根の add・inc は余って消え、根は A（知らせるのは定義の行の本体）。
	["t2 : y ? y add ⏎ t2 5（R52 で A、知らせる。R47 では未知の根で診断なし、2026-10-23 は G16）", std(["t2 : y ? y add", "t2 5"]), "(apply t2 5)", "A", { diagCount: 1, leftoverDiag: ["add"] }],
	["t : y ? y inc ⏎ t 3（R52 で A、知らせる。R47 では未知の根で診断なし、2026-10-23 は A）", std(["t : y ? y inc", "t 3"]), "(apply t 3)", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	// (2) 片イ（R121）で G3 は廃止：恒等射で消えた `,` の後の並びも、`,` の辺を左から畳んで通る（`2 , !_ , inc 1` は `2 , inc 1`）。
	["2 , !_ , inc 1（`2 , inc 1` と同じ）（前は G3、その前は `(, 2 (apply inc 1))` で通っていた）", std("2 , !_ , inc 1"), "(, 2 (apply inc 1))", "A"],
	["2 , inc 1 , !_（同じ）（前は G3）", std("2 , inc 1 , !_"), "(, 2 (apply inc 1))", "A"],
	["1 , !_ , 5 inc（`1 , 5 inc` と同じ）（前は G3）", std("1 , !_ , 5 inc"), "(, 1 (construct 5 (unit inc)))", "A", { leftoverDiag: ["inc"] }],
	["i : !_ ⏎ 2 , i , inc 1（名前の恒等射も同じ）（前は G3）", std(["i : !_", "2 , i , inc 1"]), "(, 2 (apply inc 1))", "A"],
];
const norevFixRefused = [
	// (1) 穴の断りも F の並びで見る（`5 (F Y)` と同じ。§5 Q40・Q31 の問いのまま断る側）
	// 外が `!_` だけの `5 add 1 2 !_`・`5 inc 7 !_`・`inc 3 add 1 2 !_`（G13）と `5 pq 1 2 !_`（G5）は、2026-10-26 の R69（§5 Q40 の答え：閉じた後ろの
	// 恒等射）で通る（いちばん後ろの「R64〜R72」の節。積まれた F の並びで見るのは今までどおりで、並びの頭の `add 1 2 !_` と同じ答え）。外に値のある形で
	// F の並びで見ることを確かめる行に替えた。
	// 外に値のある `5 add 1 2 !_ 3`・`5 inc 7 !_ 3`・`5 inc 7 _ 3`・`inc 3 add 1 2 !_ 3`（G13）・`5 pq 1 2 !_ 3`（G5）は、2026-10-27 の R89（§5 Q40 の残りの答え）で
	// 通る（いちばん後ろの「R83〜R93」の節。積まれた F の並びで見るのは今までどおりで、並びの頭の `add 1 2 !_ 3` と同じ答え）。
	["5 inc !_ vs~（`inc !_ vs~` は撒く項で k が数えられない G13。R47 の最初の版は通っていた）", std("5 inc !_ vs~"), "G13"],
	// (2) 恒等射で消えた `,` の後の並びの G3
	// 片イ（R121）で G3 は廃止。この4行は上の norevFixPasses へ移した。
	// (3) 括りの関数の末尾の `_` で足りない形（`5 io1 _`・`5 n _`）は、値の後ろでも `io1 _`・`n _` と同じ G5 だった（2026-10-23 は逆適用で通っていた、G8 ではない）。
	// 2026-10-26 の R28 の書き直しで、`io1 _`・`n _` と同じく通る側（いちばん後ろの「R28」の節）へ移した。
];
for (const [name, s, want, kind, extra] of norevFixPasses) checkPass(`逆適用の廃止の確かめ ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of norevFixRefused) checkRefused(`逆適用の廃止の確かめ ${name}`, s, want, inst);
// (2) の直しの守り：中の `,` が恒等射で消えたかを見るとき、`,` の辺を丸ごと解くと、名前の `,` の鎖で1段ごとに残りの鎖を解き直して
// 倍々になる（直しの最初の版は、名前 32 個の鎖で 5 秒、40 個で 4 分）。辺は両辺が恒等射のときだけ恒等射なので、辺ごとに見る。
// 1本 5 秒の上限で見る（今は数十 ms）。答えも見る：名前の鎖はそのままの `,`、恒等射の鎖の後ろの `inc 1` は G3、恒等射だけの鎖は消える。
// 片イ（R121）で G3 は廃止したので、恒等射の鎖の後ろの `inc 1` は鎖が消えて `2 , inc 1` の木で通ることを見る（前は G3）。
law("恒等射で消えた , の後の G3 の確かめは、名前の , の鎖でも速い", () => {
	const out = [];
	const names = Array.from({ length: 40 }, (_, k) => `a${k}`);
	const defs = names.map((x, k) => `${x} : ${k}`);
	let t0 = Date.now();
	const r = resolve(src([...defs, `r : ${names.join(" , ")}`]));
	const ms1 = Date.now() - t0;
	if (ms1 > 5000) out.push(`名前 40 個の鎖：${ms1}ms`);
	const rLine = show(r.trees[r.trees.length - 1]);
	if (!rLine.startsWith("(: r (, a0 (, a1 ") || !rLine.includes("(, a38 a39)")) out.push(`鎖の行 got: ${rLine.slice(0, 120)}`);
	const ids = Array(40).fill("i").join(" , ");
	t0 = Date.now();
	let got;
	try {
		got = show(resolve(src(["i : !_", "inc : x ? x + 1", `2 , ${ids} , inc 1`])).trees.at(-1));
	} catch (e) {
		got = `断り ${e.reason} ${e.gate || ""}`;
	}
	const ms2 = Date.now() - t0;
	if (ms2 > 5000) out.push(`恒等射 40 個の鎖の後ろの並び：${ms2}ms`);
	if (got !== "(, 2 (apply inc 1))") out.push(`恒等射の鎖の後ろの inc 1 got: ${got}  want: (, 2 (apply inc 1))（前は G3）`);
	const only = show(resolve(src(["i : !_", `${ids} , 5`])).trees.at(-1));
	if (only !== "5") out.push(`恒等射だけの鎖の後ろの 5 got: ${only}  want: 5`);
	return out;
});

// ---------------------------------------------------------------------------
// R49〜R51（2026-10-24 に試しで入れ、2026-10-25 に決定）：番地は指す関数を運ぶ・`[F,]` の写像・撒いた並びは流れの1項
// ---------------------------------------------------------------------------
//
// 利用者「試しにやってみよう！ ちょっと別のセッションとも議論してくるけど、おそらくやれることは何でもやってみて、悪ければロールバックしよう。」
// （U〔答え〕[2026-10-24 04:30 ebf18260]）で試しとして入れた。2026-10-25 に、口が1つの関数への流れを写像から書き下しに直して決定にした：主の Claude
// の問い「撒いた流れは、口2つなら畳み込み、口1つなら書き下し（写像は `[f,]` だけ）。R51 をこう直して試しの印を外し、Q56 は `$!_` が `[x ? x]` を
// 指す、でいい？」（07:29 UTC）に U〔答え〕[2026-10-25 07:34 2772473e]「そうか分かった！ map : f [~l] ? [@f,] l~ に対して、 map $!_ .. と
// map $[!_] .. で分かれる。 安心した。」（仕様 §7.31）。試しの版と答えの変わった行は、名前と注に試しの版の答えを書いた。
// - R49：`$名前`（名前が関数）・`$[…]`（括りが関数）は、指す関数を印に持つ番地（A）。`@x` の x に印があれば、`@x` はその関数（L、口の数が
//   分かる）。括りの関数の実体で裸の仮引数に渡れば、印を持ち越し、実体の鍵に入る（形は `$L`）。素の関数の仮引数には届かない（§5 Q45）。
// - R50：`[F,]` の F が口の1つ残った関数の項なら、F の写像（`[* 2,]` と同じ貪欲な単項）。口が2つ以上か分からなければ今のまま未知（G7）。
// - R51：いちばん上が L で次が撒く項なら、撒いた並びは流れの1項で、いちばん最初の閉じていない段の残りの口の数で受ける：2つなら左からの
//   畳み込み、1つなら書き下し（流れの頭を当てて段を閉じ、残りは後ろに積む。数えられない流れは未知、空の流れは G19）、最後の口が可変長なら
//   丸ごと、ほか（3つ以上・分からない・固定の口の後ろに可変長の口）は G19。段の結果は次の段へ流れる（R11）。写像は `[f,]` だけ。
//   書き並べた実引数は今までどおり（R35 で余りを積む）：`add vs~` は畳み込み、`add 1 2 3` は `(add 1 2) 3`、`inc vs~` は `inc 1 2 3` と同じ。
const MAPS = ["vs : 1 , 2 , 3", "uu : x ? [,] x", "map : f [~t] ? [@f,] t~", "map2 : f [~t] ? @f t~", "fold : f [~h] ? @f h~"];
const trial = (lines) => src([INC, DOUBLE, "add : x y ? x + y", "f3 : a b c ? a + b + c", ...MAPS, ...[].concat(lines)]);
const trialPasses = [
	// 仕様 §4 R51 の例の `map`・`map2`・`fold`（map の値は [2 3 4]、fold は 6。種類は A）
	["map $inc vs（R49・R50・R51）", trial("map $inc vs"), "(apply map (construct $inc vs))", "A"],
	["map $inc vs の map の実体（f は `$L`、本体は `[@f,]` の写像）", trial("map $inc vs"), "(: map (? [f [~t]] (inst $L [N…] (apply [@f,] t~))))", null, { at: 6 }],
	// `map2 : f [~t] ? @f t~` はもう写像ではない（2026-10-25）：口が1つの `@f` が受けた流れは書き下し（値は `(inc 1) 2 3`）で、実体の中の t は
	// 長さが見えない（R24：実体の中では長さを書かない）ので、頭があるか（空の流れか）が決まらず未知。試しの版は写像で A。
	["map2 $inc vs（`@f t~` は書き下し。t の数が見えないので未知。試しの版は写像で A）", trial("map2 $inc vs"), "(apply map2 (construct $inc vs))", "未知"],
	["fold $add vs（`@f h~` は口が2つの畳み込み）", trial("fold $add vs"), "(apply fold (construct $add vs))", "A"],
	["fold $add vs の fold の実体", trial("fold $add vs"), "(: fold (? [f [~h]] (inst $L [N…] (apply @f h~))))", null, { at: 8 }],
	["inc (fold $add vs)（G7 にならずに A）", trial("inc (fold $add vs)"), "(apply inc [fold $add vs])", "A"],
	// 撒いた流れと書き並べ：口が2つなら別の物（畳み込みと R35 の余り）、口が1つなら同じ物（書き下し、2026-10-25）。木は撒く項を書いたまま。
	["inc vs~（書き下し：`(inc 1) 2 3`。試しの版は写像）", trial("inc vs~"), "(apply inc vs~)", "A"],
	["add vs~（畳み込み）", trial("add vs~"), "(apply add vs~)", "A"],
	["add 1 2 3（書き並べは今までどおり R35。`(add 1 2) 3`）", trial("add 1 2 3"), "(construct (apply add (construct 1 2)) 3)", "A", { leftover: true }],
	["add 1 vs~（口が1つ残った add 1 の書き下し：`(add 1 1) 2 3`。試しの版は写像）", trial("add 1 vs~"), "(apply add (construct 1 vs~))", "A"],
	["(add 1) vs~（同じ）", trial("(add 1) vs~"), "(apply [add 1] vs~)", "A"],
	["f3 1 vs~（口が2つ残った f3 1 の畳み込み）", trial("f3 1 vs~"), "(apply f3 (construct 1 vs~))", "A"],
	// 2026-10-25 の決定で足した行。写像は `[f,]` だけ（U [2026-10-25 07:27 2772473e]「飽くまで、[+ 1,] [1 2 3]~ が [2 3 4] であるべきで、 [+ 1] [1 2 3]~ は
	// [2 2 3] になるはずだと答えたつもりだった。…」、U [2026-10-25 07:37 2772473e]「[ink,] [1 2 3]~ が [2 3 4] になるのも大事だと思う。」）。
	["[+ 1,] [1 2 3]~（`[f,]` の写像。値は [2 3 4]）", trial("[+ 1,] [1 2 3]~"), "(apply [+ 1,] [1 2 3]~)", "A"],
	// 同じ日の確かめの直しで足した行（主の Claude の 07:38 UTC「着地したら、`[inc,] [1 2 3]~` がそのまま試験の行にあるかを確かめる。無ければ1行足して…」）。
	["[inc,] [1 2 3]~（`[f,]` の写像。値は [2 3 4]）", trial("[inc,] [1 2 3]~"), "(apply [inc,] [1 2 3]~)", "A"],
	["inc [5]~（要素1つの流れの書き下しは `inc 5`）", trial("inc [5]~"), "(apply inc [5]~)", "A"],
	// 要素1つの流れを口が2つの関数が受けると、畳み込み（foldl1）は関数を当てずに要素を返して段を閉じる（書き下せば `add 5 3` の 8）。要素1つの所に
	// 畳み込みを当てるのは作る側の読み（R。2026-10-25 の答えは要素の数に触れていない、§5 Q46）。
	["add [5]~ 3（要素1つの畳み込みは 5、後ろに 3。値は `5 3`。R、§5 Q46）", trial("add [5]~ 3"), "(construct (apply add [5]~) 3)", "A"],
	// `inc add vs~`（作る途中の版は書き並べの `add (inc 1) 2` の後ろに 3 で A、試しの版は写像の List を add が受けて根で余った）は、同じ日の確かめの
	// 直しで合成に来た流れの G19（§5 Q58）になり、§5 Q58 の答え（R58）で合成全体の畳み込みの A になった（下の「R58〜R61」の節）。
	["w : vs~ ⏎ inc w（名前は撒いた器の数も持ち越す）", trial(["w : vs~", "inc w"]), "(apply inc w)", "A"],
	["s1 : 5 ⏎ inc s1~（数は長さ1の List）", trial(["s1 : 5", "inc s1~"]), "(apply inc s1~)", "A"],
	["inc `ab`~（文字列の字面の文字の数）", trial("inc `ab`~"), "(apply inc `ab`~)", "A"],
	// 数の見えない流れ（素の関数の裸の仮引数・適用の結果）は、頭があるか（空の流れか）・余りがあるかが決まらないので未知（試しの版は写像で A）。
	["z : xs ? inc xs~ ⏎ z vs（数の見えない流れの書き下しは未知。試しの版は A）", trial(["z : xs ? inc xs~", "z vs"]), "(apply z vs)", "未知"],
	// 恒等射は並び全体を受ける（R29）ので、撒いた流れを丸ごと受ける（今までどおり未知。値は 1 2 3）。
	["!_ vs~（恒等射は流れを丸ごと受ける。今までどおり未知）", trial("!_ vs~"), "(apply !_ vs~)", "未知"],
	["i : !_ ⏎ i add vs~（恒等射が渡した流れを add が畳む。単位律の `add vs~` と同じ。R74 で頭の i が消える、前は `(compose i add)`）", trial(["i : !_", "i add vs~"]), "(apply add vs~)", "A"],
	["[inc,] vs（R50。1つで入った器の要素を写す）", trial("[inc,] vs"), "(apply [inc,] vs)", "A"],
	["[inc,] 1 2 3（R50）", trial("[inc,] 1 2 3"), "(apply [inc,] (construct 1 2 3))", "A"],
	["[inc,] vs~（貪欲な単項は流れを丸ごと受ける）", trial("[inc,] vs~"), "(apply [inc,] vs~)", "A"],
	["[(add 1),] vs（部分適用の写像）", trial("[(add 1),] vs"), "(apply [[add 1],] vs)", "A"],
	["[add 1,] vs（括らない部分適用も同じ）", trial("[add 1,] vs"), "(apply [add 1,] vs)", "A"],
	["[x ? x + 1,] vs（括りの関数の写像）", trial("[[x ? x + 1],] vs"), "(apply [[x ? x + 1],] vs)", "A"],
	// 2026-10-27 の R84（§5 Q69 の答え：`[]~ = _~ = _`）から、空の流れは書いた `_` と同じで、末尾の `_` は消えて add が残り、根で `_` と知らせる（R28・R42）。
	// 前は空の流れの畳み込みで閉じた `_` の `(apply add []~)`（A、知らせない）。
	["add []~（空の流れは書いた `_` と同じで add が残る、R84。前は畳み込みの `(apply add []~)`）", trial("add []~"), "(unit add)", "A", { leftoverDiag: ["add"] }],
	// `inc []~`（試しの版は空の流れの写像で空の List、A）は、2026-10-25 の書き下しで G19（下の trialRefused、§5 Q57）。
	["inc vs~ 5（書き下しの余りの後ろに積む）", trial("inc vs~ 5"), "(construct (apply inc vs~) 5)", "A"],
	["5 inc vs~（値の後ろに積まれた inc も同じ、R47）", trial("5 inc vs~"), "(construct 5 (apply inc vs~))", "A"],
	["vs~ inc（いちばん上が値なら今までどおり積む）", trial("vs~ inc"), "(construct vs~ (unit inc))", "A", { leftoverDiag: ["inc"] }],
	// 合成：§5 Q58 の答え（R58、2026-10-25）から、合成は1つの関数なので、流れは合成全体の残りの口の数で受ける。`inc double vs~` は合成全体の口が1つの
	// 書き下し（値は `double (inc 1)` の後ろに 2 3）、`add inc vs~` は口が2つの合成全体 g(x, y) = inc (add x y) の畳み込み（値は 8）。答えの前（確かめの
	// 直し）は、合成全体の口が最初の段の口と同じなら3つの読みの木と種類が同じなので通し、値は読みで割れていた（`add inc vs~` は 7 と 8）。木と種類は同じ。
	["inc double vs~（合成全体の口が1つの書き下し、R58）", trial("inc double vs~"), "(apply (compose inc double) vs~)", "A"],
	["add inc vs~（合成全体の口が2つの畳み込み、R58。値は 8）", trial("add inc vs~"), "(apply (compose add inc) vs~)", "A"],
	// `inc add vs~ 5`（作る途中の版は `add (inc 1) 2` の後ろに 3 5 の `(construct (apply (compose inc add) vs~) 5)`、試しの版は写像の List が add の最初の口に
	// 入る `(apply add (construct (apply inc vs~) 5))`）は、同じ日の確かめの直しで G19（§5 Q58）になり、R58 で畳み込みの値の後ろに 5 を積む形になった
	// （下の「R58〜R61」の節）。
	["i : !_ ⏎ i inc vs~（恒等射が受けた流れは、そのまま次の段へ。`inc vs~` と同じ。R74 で頭の i が消える、前は `(compose i inc)`）", trial(["i : !_", "i inc vs~"]), "(apply inc vs~)", "A"],
	// 根が A でない関数の写像・畳み込みは未知（書き下しは、余りがあれば下の trialRefused の G2(a)）
	["uu [5]~（根が未知の関数の、要素1つの流れの書き下しは `uu 5` と同じ未知）", trial("uu [5]~"), "(apply uu [5]~)", "未知"],
	["map $uu vs（同じ）", trial("map $uu vs"), "(apply map (construct $uu vs))", "未知"],
	["[uu,] vs（同じ）", trial("[uu,] vs"), "(apply [uu,] vs)", "未知"],
	// 番地の印の持ち越し（R49）
	["p : $inc ⏎ map p vs（`:` はメタで、名前は印を持ち越す）", trial(["p : $inc", "map p vs"]), "(apply map (construct p vs))", "A"],
	["(map $inc) vs（括りの関数の部分適用も印を持つ）", trial("(map $inc) vs"), "(apply [map $inc] vs)", "A"],
	["map [$inc] vs（[x] ≅ x）", trial("map [$inc] vs"), "(apply map (construct [$inc] vs))", "A"],
	["map $[x ? x + 1] vs（括りの関数の番地）", trial("map $[x ? x + 1] vs"), "(apply map (construct $[x ? x + 1] vs))", "A"],
	["hh : [f] ? [@f,] vs ⏎ hh [f : $inc]（欄の番地）", trial(["hh : [f] ? [@f,] vs", "hh [f : $inc]"]), "(apply hh [f : $inc])", "A"],
	// 実体の鍵：番地の印が違えば実体を分け合わない（分け合うと、先に解いた方の答えを後の方が黙って使う）
	["鍵 map $inc vs ⏎ map $uu vs の2行目は未知", trial(["map $inc vs", "map $uu vs"]), "(apply map (construct $uu vs))", "未知"],
	["鍵 map $uu vs ⏎ map $inc vs の2行目は A", trial(["map $uu vs", "map $inc vs"]), "(apply map (construct $inc vs))", "A"],
	["鍵 map $inc vs ⏎ map $double vs の map の実体は2つ（同じ綴りの `$L [N…]`）", trial(["map $inc vs", "map $double vs"]), "(: map (? [f [~t]] (inst $L [N…] (apply [@f,] t~)) (inst $L [N…] (apply [@f,] t~))))", null, { at: 6 }],
	["鍵 hh [f : $inc] ⏎ hh [f : $uu] の2行目は未知（欄の番地も鍵に入る）", trial(["hh : [f] ? [@f,] vs", "hh [f : $inc]", "hh [f : $uu]"]), "(apply hh [f : $uu])", "未知"],
	["鍵 hh [f : $uu] ⏎ hh [f : $inc] の2行目は A", trial(["hh : [f] ? [@f,] vs", "hh [f : $uu]", "hh [f : $inc]"]), "(apply hh [f : $inc])", "A"],
	// `[F,]` の写像は、写す関数ごとに鍵を分ける（fnKey。type だけだと `[inc,]` と `[uu,]` を欄で渡したときに実体を分け合う）
	["鍵 kk [f : [inc,]] ⏎ kk [f : [uu,]] の2行目は未知", trial(["kk : [f] ? f [1 2]", "kk [f : [inc,]]", "kk [f : [uu,]]"]), "(apply kk [f : [uu,]])", "未知"],
	["鍵 kk [f : [uu,]] ⏎ kk [f : [inc,]] の2行目は A", trial(["kk : [f] ? f [1 2]", "kk [f : [uu,]]", "kk [f : [inc,]]"]), "(apply kk [f : [inc,]])", "A"],
	// 畳み込みの2歩目の左は前の結果（中身の見えない A）。括りの関数はそれで答えが変わりうるので、2歩目まで見る（foldOver）：pp の実体の
	// [a] に数が入れば A、中身の見えない A なら a は未知で未知。
	["pp : [a] y ? a + y ⏎ pp vs~（2歩目の [a] は中身の見えない A なので未知）", trial(["pp : [a] y ? a + y", "pp vs~"]), "(apply pp vs~)", "未知"],
	["pp : [a] y ? a + y ⏎ pp vs~ の実体（1歩目 N N と2歩目 A N）", trial(["pp : [a] y ? a + y", "pp vs~"]), "(: pp (? [[a] y] (inst A A (+ a y)) (inst N A (+ a y))))", null, { at: 9 }],
	// 括りの仮引数に直に渡った番地は、中身の見えない A と同じに受ける（印は本体から見えない）ので、鍵と綴りは今までどおり `A`
	["ro : [~r] ? r 1 ⏎ ro $inc の実体の形は今までどおり A", trial(["ro : [~r] ? r 1", "ro $inc"]), "(: ro (? [[~r]] (inst A (construct r 1))))", null, { at: 9 }],
	// 試しの確かめ（2026-10-24）で直した所。
	// - 可変長の口だけの関数も `[F,]` で写す（R50。`[F,] a b` は `F a , F b` で、`F a` は1つの行なので可変長の口は a 1つを受けて閉じる。最初の版は
	//   口の数の分からない物と一緒に G7 にしていた）。
	["hd : [y ~ys] ? y ⏎ [hd,] ws（最後の仮引数が括りの関数の写像。前は G7）", trial(["hd : [y ~ys] ? y", "ws : [1 2] , [3 4]", "[hd,] ws"]), "(apply [hd,] ws)", "A"],
	["h1 : [a] ? a + 1 ⏎ [h1,] vs（同じ）", trial(["h1 : [a] ? a + 1", "[h1,] vs"]), "(apply [h1,] vs)", "A"],
	["pq : x [b] ? x + b ⏎ [(pq 1),] vs（その部分適用）", trial(["pq : x [b] ? x + b", "[(pq 1),] vs"]), "(apply [[pq 1],] vs)", "A"],
	["[[+],] ws（畳む点なしの写像。要素ごとに R31 の1項）", trial(["ws : [1 2] , [3 4]", "[[+],] ws"]), "(apply [[+],] ws)", "A"],
	["[[' 0],] ws（段18 の点なしの写像。要素ごとに `w ' 0`）", trial(["ws : [1 2] , [3 4]", "[[' 0],] ws"]), "(apply [[' 0],] ws)", "A"],
	["i : !_ ⏎ [i,] vs（恒等射の写像）", trial(["i : !_", "[i,] vs"]), "(apply [i,] vs)", "A"],
	["hd : [y ~ys] ? y ⏎ map $hd ws（`[@f,]` の f も同じ）", trial(["hd : [y ~ys] ? y", "ws : [1 2] , [3 4]", "map $hd ws"]), "(apply map (construct $hd ws))", "A"],
	["map $[* 2,] vs（貪欲な単項の写像。前は G7）", trial("map $[* 2,] vs"), "(apply map (construct $[* 2,] vs))", "A"],
	// - 畳み込みは、撒いた器が数か中身の見える List（深く見て要素が全部 A）か空の括りのときだけ値と言える（R31 の1項の読みと同じ線）。
	//   中身の見えない器は、要素に関数があるかもしれず、要素が1つなら関数を当てずにその要素を返すので未知（前は A で、`first (tl fs)~ 5` を黙って
	//   構築と読んだ）。写像は結果がいつも List なので A のまま。
	["tl ⏎ fs2 ⏎ fold $add (tl fs2)（中身の見えない器の畳み込みは未知）", trial(["tl : [y ~ys] ? ys", "fs2 : inc , double", "fold $add (tl fs2)"]), "(apply fold (construct $add [tl fs2]))", "未知"],
	["tl ⏎ add (tl vs)~（同じ。`[|] (tl vs)` と同じ未知）", trial(["tl : [y ~ys] ? ys", "add (tl vs)~"]), "(apply add [tl vs]~)", "未知"],
	// 2026-10-25 の書き下しで未知に変わった：適用の結果を撒いた流れは数が見えない（試しの版は写像で、結果がいつも List なので A）。
	["tl ⏎ inc (tl vs)~（数の見えない流れの書き下しは未知。試しの版は写像で A）", trial(["tl : [y ~ys] ? ys", "inc (tl vs)~"]), "(apply inc [tl vs]~)", "未知"],
	["tl ⏎ [inc,] (tl vs)~（写像は `[f,]` で、結果がいつも List なので A）", trial(["tl : [y ~ys] ? ys", "[inc,] (tl vs)~"]), "(apply [inc,] [tl vs]~)", "A"],
	["z : xs ? add xs~ ⏎ z vs（素の関数の裸の仮引数を畳む本体の根は未知）", trial(["z : xs ? add xs~", "z vs"]), "(apply z vs)", "未知"],
	// - 畳まない2項の点なしの部分適用は口が1つの書き下し（試しの版は写像）で、畳まないので通す（口が2つの `[<<] vs~` は下で G19）。
	["([<<] 1) vs~（口が1つの書き下し）", trial("([<<] 1) vs~"), "(apply [[<<] 1] vs~)", "A", { pfInfo: "[<<]" }],
	// 片イ（R120）：種類の未知な項（口が3つの f の `[@f,]`・頭から引いた物・未知の書き下し・中身の見えない器の畳み込み）は断らず、後ろの項は積む予想で通る
	// （前は G7・G2(a)）。中身の見えない器の畳み込みの後ろの 5 を黙って構築の A と読まないことは、根の種類（未知）で見る。fs2・fs3 の要素の関数は、
	// （R123）で `,` の被演算子に丸ごと残った関数なので `_` と leftover-lambda。
	["map $f3 vs（`[@f,]` の f の口が3つなので未知）（前は G7）", trial("map $f3 vs"), "(apply map (construct $f3 vs))", "未知"],
	["[' 0] vs~（R77 で口1つの書き下し、頭から引いた物が未知）（前は G2(a)、その前は G19）", trial("[' 0] vs~"), "(apply [' 0] vs~)", "未知"],
	["uu vs~ 5（未知の書き下しの後ろに項）（前は G2(a)）", trial("uu vs~ 5"), "(construct (apply uu vs~) 5)", "未知"],
	["uu vs~（書き下した `uu 1 2 3` と同じ。試しの版は未知の根）（前は G2(a)）", trial("uu vs~"), "(apply uu vs~)", "未知"],
	["tl ⏎ inc (tl vs)~ 5（未知の書き下しの後ろに項。試しの版は A）（前は G2(a)）", trial(["tl : [y ~ys] ? ys", "inc (tl vs)~ 5"]), "(construct (apply inc [tl vs]~) 5)", "未知"],
	["first ⏎ tl ⏎ fs3 ⏎ first (tl fs3)~ 5（前は G2(a)、その前は構築の A）", trial(["first : x y ? x", "tl : [y ~ys] ? ys", "fs3 : inc , double , inc", "first (tl fs3)~ 5"]), "(construct (apply first [tl fs3]~) 5)", "未知", { leftoverDiag: ["double", "inc", "inc"] }],
	["tl ⏎ fs2 ⏎ add (tl fs2)~ 5（要素1つなら add は当たらず要素を返す）（前は G2(a)）", trial(["tl : [y ~ys] ? ys", "fs2 : inc , double", "add (tl fs2)~ 5"]), "(construct (apply add [tl fs2]~) 5)", "未知", { leftoverDiag: ["inc", "double"] }],
	["first ⏎ z : xs ? first xs~ ⏎ z fs2 5（素の関数の本体で畳む）（前は G2(a)）", trial(["first : x y ? x", "z : xs ? first xs~", "fs2 : inc , double", "z fs2 5"]), "(construct (apply z fs2) 5)", "未知", { leftoverDiag: ["inc", "double"] }],
	// 未知の括りを inc が受けた結果は A の予想で、後ろの 5 は積む（前は G7）。
	["tl ⏎ fs2 ⏎ inc (fold $add (tl fs2)) 5（未知の括りが並びの中）（前は G7）", trial(["tl : [y ~ys] ? ys", "fs2 : inc , double", "inc (fold $add (tl fs2)) 5"]), "(construct (apply inc [fold $add [tl fs2]]) 5)", "A", { leftoverDiag: ["inc", "double"] }],
	// 片イ（R120）：写像にしない `[F,]`（口が2つの関数・固定の口の後ろに可変長の口・素の関数の本体の `[@g,]`）は種類の未知な項で、後ろの項は積む予想
	// （§4 R120 の1つ目の箇条。後ろが書いた `_` だけでなければ、頭でも当てる予想にしない）。前は種類の未知な項の G7。
	["[add,] vs（口が2つの関数は写像にしない。積む予想）（前は G7）", trial("[add,] vs"), "(construct [add,] vs)", "未知"],
	["nn : a [~c] ? a ⏎ [nn,] vs（固定の口の後ろに可変長の口。積む予想）（前は G7）", trial(["nn : a [~c] ? a", "[nn,] vs"]), "(construct [nn,] vs)", "未知"],
	["tg : g ? [@g,] vs（素の関数の本体の `[@g,]` は未知。積む予想）（前は G7）", trial("tg : g ? [@g,] vs"), "(: tg (? [g] (construct [@g,] vs)))", "A"],
];
const trialRefused = [
	["f3 vs~（口が3つ。G19）", trial("f3 vs~"), "G19"],
	["fold $f3 vs（実体の中の `@f h~` で口が3つ。G19）", trial("fold $f3 vs"), "G19", [["fold", "$L [N…]"]]],
	// `map $f3 vs` は片イ（R120）で上の trialPasses へ移した。
	// `[add,] vs` と、固定の口の後ろに可変長の口の `[nn,] vs` は、片イ（R120）で上の trialPasses へ移した（前は G7）。
	// 前は `map $[* 2,] vs`（可変長の口の関数も写像にしない、G7）をここに置いていた。試しの確かめで、可変長の口だけの関数は要素1つで閉じるので
	// 写す側へ移した（上）。
	// 2026-10-26 の R77（§5 Q39 の答え：`[' 0]` は口1つ）から、流れは書き下し（`([' 0] 1) 2 3`）で、数から引いた物の種類が決まらず余りがあるので G2(a)（前は
	// 口の数が分からない点なしで G19）。
	// `[' 0] vs~` は片イ（R120）で上の trialPasses へ移した。
	["go vs~（既定値のある関数は口の数が分からない。G19）", trial([...GO_DEFAULT, "go vs~"]), "G19"],
	["pb2 : [a] [b] ? a + b ⏎ pb2 vs~（固定の口の後ろに最後の括り。G19）", trial(["pb2 : [a] [b] ? a + b", "pb2 vs~"]), "G19"],
	// 素の関数の仮引数には印が届かない（呼ぶたびに実体を作らない。§5 Q45）：`@g` は今までどおり前置 `@` の項で、口の数が分からない
	["tg : g ? @g vs~（素の関数の本体。G19）", trial("tg : g ? @g vs~"), "G19"],
	// `tg : g ? [@g,] vs`（素の関数の本体の `[@g,]` は未知、G7）は、片イ（R120）で上の trialPasses へ移した。
	// 書き下した `uu 1 2 3` と同じく、頭の `uu 1` の種類が決まらないので余りの 2 3 を当てるか積むかが決まらない（G2(a)、2026-10-25。試しの版は写像で
	// 未知の根、その前も撒く項で k を数えないので未知の根）。
	// `uu vs~ 5`・`uu vs~` は片イ（R120）で上の trialPasses へ移した。
	// 2026-10-25 の書き下しで足した行（§5 Q57）。
	// - 空の流れを口が1つの関数が受ける：書き下すと何も当てない関数のまま（L）とも、空の流れを単位 `_` と読む（口が2つの `add []~` は `_`）とも
	//   読める（試しの版は空の List の写像で A）。`inc []~`・`[+ 1] []~`（G19）は、2026-10-26 の R70（§5 Q57 (a) の答え：何も当たらずラムダが余るので
	//   `_`、知らせる）で通る（いちばん後ろの「R64〜R72」の節）。
	// - 合成に来た流れ（2026-10-25 の確かめの直し、§5 Q58）：合成全体の口の数が、流れを受けた最初の段の口の数と違えば、流れを最初の段で受けるか
	//   合成全体で受けるかで答えが割れるので G19 にしていた。§5 Q58 の答え（R58）で合成全体の口で受けるので、ここに残るのは合成全体の口が3つ以上か
	//   分からない形（G19、言い分は §5 Q46）だけ。合成全体の口が2つの形（`inc add vs~`・`inc add [1 2]~`・`inc add vs~ 5`・`[x ? x] add [5]~`・
	//   `[x ? x] add vs~`・`kk $i 0`・`kk $!_ 0`・`fold $cm vs`・`i inc add vs~`）は、下の「R58〜R61」の節の通る側へ移した。
	["inc f3 vs~（合成全体の口が3つ。G19、R58・§5 Q46。試しの版は余って通った）", trial("inc f3 vs~"), "G19"],
	["inc f3 [1 2]~（同じ。G19）", trial("inc f3 [1 2]~"), "G19"],
	["add f3 vs~（合成全体の口が4つ。G19。作る途中の版は畳んだ後の f3 が根で余った）", trial("add f3 vs~"), "G19"],
	["inc [+] vs~（後ろの段が可変長の口で、合成全体の口が分からない。G19。作る途中の版は A）", trial("inc [+] vs~"), "G19"],
	// - 数の見えない流れの書き下しは未知なので、後ろに項が来れば G2(a)（試しの版は写像の A で、後ろに積んで通った）。
	// `inc (tl vs)~ 5` は片イ（R120）で上の trialPasses へ移した。
	// 写す器・撒く器の中身に関数（§5 Q20 の G7、オの片）。片イ（R123）で行の `fs : inc , double` の要素は `_`（`,` の被演算子に丸ごと残った関数）になり、
	// 中身に関数が見えなくなったので、今も関数が見える構造体 m（欄 say が関数）に替えた（前の器は `fs : inc , double`）。
	["[inc,] m（写す器の中身に関数。G7）（前の器は `fs : inc , double`）", trial([...M, "[inc,] m"]), "G7"],
	["inc m~（撒く器の中身に関数。今のまま G7）（前の器は `fs : inc , double`）", trial([...M, "inc m~"]), "G7"],
	["map $inc m（同じ。実体の中で G7）（前の器は `fs : inc , double` で形 `$L [U…]`）", trial([...M, "map $inc m"]), "G7", [["map", "$L {say:L other:N}"]]],
	// 試しの確かめ（2026-10-24）で直した所。
	// - 写す関数の無い貪欲な単項も、写す器の中身に関数が見えれば G7（`[[* 2],] fs` と同じ写像。前は `[* 2,] fs` だけ A）。
	["[[* 2],] m（G7）（前の器は `fs : inc , double`）", trial([...M, "[[* 2],] m"]), "G7"],
	["[* 2,] m（同じ写像なので G7。前は A）（前の器は `fs : inc , double`）", trial([...M, "[* 2,] m"]), "G7"],
	["[-_,] m（同じ。前は A）（前の器は `fs : inc , double`）", trial([...M, "[-_,] m"]), "G7"],
	// - 中身の見えない器の畳み込みは未知（上の通る側）。後ろに項が来れば G2(a)（前は構築の A：`tl fs` は `[double inc]` なので first の値は
	//   double で、5 はそれに当たる。黙った誤答だった）。
	// 片イ（R120）で、この3行と `inc (fold $add (tl fs2)) 5`（G7）は上の trialPasses へ移した（根の種類で見る）。
	// - 畳まない2項の点なし（R32。利用者「ビットシフトとget set は 畳めないね。」）は、撒いた流れを畳まない（G19、§5 Q49。前は畳んで A）。
	["[<<] vs~（G19）", trial("[<<] vs~"), "G19"],
	["[!=] vs~（G19）", trial("[!=] vs~"), "G19"],
	["[~] vs~（範囲。G19）", trial("[~] vs~"), "G19"],
	["fold $[<<] vs（実体の中の `@f h~`。G19）", trial("fold $[<<] vs"), "G19", [["fold", "$L [N…]"]]],
	["g : xs ? [<<] xs~（素の関数の本体。G19）", trial("g : xs ? [<<] xs~"), "G19"],
	// - 値の定義の名前の番地（`$cc`）には印が届かなかった（§5 Q45）ので、`cc : add inc` ⏎ `fold $cc vs` は G19 だった。2026-10-25 の R55（別名の `$p` にも
	//   指す関数の印を付ける）で通る（下の「`$` の先は1つの関数」の節の oneFnPasses。`cc vs~`・`fold $[add inc] vs` と同じ答え）。恒等射の別名 `i : !_`
	//   の `$i` と `$!_` は、R55 の片では印を持たず `map2 $!_ vs` は G19 だったが、同じ日の §5 Q56 の答えで1引数の恒等射の印を持つ（下の節）。
];
// 試験の名前の頭「試し」は、2026-10-24 に試しで入れた行の目印として残す（2026-10-25 に決定）。
for (const [name, s, want, kind, extra] of trialPasses) checkPass(`試し ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of trialRefused) checkRefused(`試し ${name}`, s, want, inst);

// R51 の決定の片の確かめの直し（2026-10-25、仕様 §7.32）。合成に来た流れ（§5 Q58）の行は上の trialRefused に置いた。
// - 書いた空の括り `[]` は、R51 の撒いた流れでは空の流れと読むので、実体の鍵を中身の見えない A と分ける（形 `A[]`）。前は同じ鍵 `A` で、
//   `k2 []` と `k2 (tl vs)`（・`map2 $inc []` と `map2 $inc (tl vs)`）の答えが行の順で変わった。`fold $first []` の後ろの `fold $first (tl fs3)` が
//   空の流れの `_` の実体を使って A になるのも同じ穴（HEAD 41f144af から）。
// - 数の見えない流れの書き下しも、頭の要素の desc で段の関数を当てる（括りの関数なら実体を作って本体を読む、R25）。前は当てずに未知で閉じ、
//   本体の G5 を読まずに通った（HEAD は写像で当てて G5）。
// - 文字列を右辺に持つ名前（`:` はメタ）と括った文字列（[x] ≅ x）も、字面と同じく文字の数で数える。前は字面だけを数えた。R34 の最後の括りの数
//   （`(f4 !_) 1 st`）には入れない（字面の (f4 !_) 1 `abc` も数えない）。
// - 書き下しで頭が段を閉じ、余りを積んだ項の形は、書いた `inc 1 2 3` と同じ `[A…]`（前は形の見えない A で、`io1 (inc vs~)` が G7、書いた
//   `io1 (inc 1 2 3)` が A と割れた）。合成に来た流れ（`inc double vs~`）は §5 Q58 の読みで形が割れるので、形の見えない A のまま（断る側）。
const SEVEN = "tl : [y ~ys] ? ys";
const writeOutFixPasses = [
	["空の括りの鍵 k2 (tl vs) は未知（数の見えない流れ）", trial([SEVEN, "k2 : [~t] ? inc t~", "k2 (tl vs)"]), "(apply k2 [tl vs])", "未知"],
	// `fold $add (tl vs)` ⏎ `fold $add []` の2行目（A、空の流れの畳み込み）と `fold $add []` ⏎ `fold $add (tl vs)` の2行目（未知）は、2026-10-27 の R84（§5 Q69 の答え：
	// 空の流れは書いた `_` と同じ）で `fold $add []` の実体の本体 `@f h~` が `@f _` と同じ、末尾の `_` が消えて関数 add が本体の根に残る G16（R33）になったので、
	// 下の writeOutFixRefused へ移した。鍵を分けることは、空の List でも G16 にならない本体の k3（下の writeOutFixKeys）で見る。
	// `map $inc []` の map の実体 `$L A[]`（`(: map (? [f [~t]] (inst $L A[] (apply [@f,] t~))))`）は、2026-10-27 の片6 の R95（§5 Q75 (b) の点なしの所の答え：写像の可変長の口に
	// 来た空の流れは書いた `_` と同じで、点なしの関数が残る）で、実体の本体 `[@f,] t~` が `[@f,] _` と同じく本体の根に `[@f,]` の残る G16（R33）になったので、下の
	// writeOutFixRefused へ移した（実体の鍵 `$L A[]` は門の名指しで見る）。
	["文字列の名前 st : `abc` ⏎ inc st~ 5（字面の inc `abc`~ 5 と同じ。前は G2(a)）", trial(["st : `abc`", "inc st~ 5"]), "(construct (apply inc st~) 5)", "A"],
	["文字列の名前の別名 st2 : st ⏎ inc st2~ 5（同じ）", trial(["st : `abc`", "st2 : st", "inc st2~ 5"]), "(construct (apply inc st2~) 5)", "A"],
	["括った文字列 inc [`abc`]~ 5（[x] ≅ x。前は G2(a)）", trial("inc [`abc`]~ 5"), "(construct (apply inc [`abc`]~) 5)", "A"],
	["文字列の名前は R34 の最後の括りの数には入れない（字面と同じ未知）", trial(["st : `abc`", "f4 : a b c e ? a + b + c + e", "(f4 !_) 1 st"]), "(apply [f4 !_] (construct 1 st))", "未知"],
	["余りを積んだ項の形 io1 (inc vs~) は A（`io1 (inc 1 2 3)` と同じ。前は G7）", trial(["io1 : [say] ? say 21", "io1 (inc vs~)"]), "(apply io1 [inc vs~])", "A"],
	["その io1 の実体は `[A…]`", trial(["io1 : [say] ? say 21", "io1 (inc vs~)"]), "(: io1 (? [[say]] (inst [A…] (construct say 21))))", null, { at: 9 }],
	["hh (inc [1 2 3]~) は A（`hh (inc 1 2 3)` と同じ。前は未知）", trial(["hh : [y ~ys] ? y + 1", "hh (inc [1 2 3]~)"]), "(apply hh [inc [1 2 3]~])", "A"],
];
// 空の括りの鍵の3行（`k2 []` の実体の空の流れの書き下しで G19）は、2026-10-26 の R70（§5 Q57 (a) の答え：空の流れを口1つへ渡すと余ったラムダで `_`）で
// 通る。鍵を分けることは、`k2 []` の行が A（空の流れ）で `k2 (tl vs)` の行が未知（数の見えない流れ）と、行の順に依らず分かれることで見る（下の writeOutFixKeys）。
// 2026-10-27 の R84（§5 Q69 の答え：空の流れは書いた `_` と同じ）から、`k2 []`・`map2 $inc []` の実体の本体 `inc t~`・`@f t~` は `inc _`・`@f _` と同じで、末尾の
// `_` が消えて関数が本体の根に残る G16（R33）になった（下の writeOutFixRefused へ移した）。鍵を分けることは、空の List でも本体の根に関数が残らない
// `k3 : [~t] ? 5 + (inc t~)`（空なら `(inc _)` が値の演算子の被演算子で `_`、R87。数の見えない流れなら未知）で、行の順に依らず分かれることで見る。
const K3 = "k3 : [~t] ? 5 + (inc t~)";
const writeOutFixKeys = [
	["空の括りの鍵 k3 (tl vs) ⏎ k3 [] の2行目は A（R84・R87。k2 の前の行は R70 で A）", trial([SEVEN, K3, "k3 (tl vs)", "k3 []"]), "(apply k3 [])", "A"],
	["空の括りの鍵 k3 [] ⏎ k3 (tl vs) の2行目は未知", trial([SEVEN, K3, "k3 []", "k3 (tl vs)"]), "(apply k3 [tl vs])", "未知"],
	["空の括りの鍵 k3 の定義の行は実体が2つ（`A` と `A[]`）", trial([SEVEN, K3, "k3 []", "k3 (tl vs)"]), "(: k3 (? [[~t]] (inst A (+ 5 [inc t~])) (inst A[] (+ 5 (unit [inc t~])))))", null, { at: -3 }],
	// 片イ（R125）で G16 は廃止：空の List を受けた実体の本体の根に残った関数は `_` と bare-function-return（R125 の文面の「`fold $add []`（R109）も `_`」）。
	// 鍵を分けることは、`fold $first []` の後の2行目が空の流れの実体を使わずに未知のままなことで見る。（R123）fs3 の要素は `_` と leftover-lambda。
	// 文字列の名前の `uu st~` は（R120）種類の未知な書き下しで、断らずに未知（前は G2(a)）。
	["空の括りの鍵 fold $first [] ⏎ (fold $first (tl fs3)) 5 の2行目は未知（前は1行目の G16、その前は2行目の G7）", trial(["first : x y ? x", SEVEN, "fs3 : inc , double , inc", "fold $first []", "(fold $first (tl fs3)) 5"]), "(construct [fold $first [tl fs3]] 5)", "未知", { severities: ["information/bare-function-return", "warning/leftover-lambda", "warning/leftover-lambda", "warning/leftover-lambda"] }],
	["空の List fold $add []（R84 で本体 `@f _`）（前は G16、その前は空の流れの畳み込みで A）", trial("fold $add []"), "(apply fold (construct $add []))", "A", { severities: ["information/bare-function-return"] }],
	["空の List map2 $inc []（R84 で本体 `@f _`）（前は G16、その前は R70 の余ったラムダで A）", trial("map2 $inc []"), "(apply map2 (construct $inc []))", "A", { severities: ["information/bare-function-return"] }],
	["空の List k2 []（R84 で本体 `inc _`）（前は G16、その前は R70 の余ったラムダで A）", trial(["k2 : [~t] ? inc t~", "k2 []"]), "(apply k2 [])", "A", { severities: ["information/bare-function-return"] }],
	["空の List map $inc []（片6 の R95 で本体 `[@f,] _`）（前は G16、その前は空の List の写像で A）", trial("map $inc []"), "(apply map (construct $inc []))", "A", { severities: ["information/bare-function-return"] }],
	["文字列の名前 st : `abc` ⏎ uu st~（字面の uu `abc`~ と同じ）（前は G2(a)、その前は未知）", trial(["st : `abc`", "uu st~"]), "(apply uu st~)", "未知"],
];
for (const [name, s, want, kind, extra] of writeOutFixKeys) checkPass(`確かめ（2026-10-25） ${name}`, s, want, kind, extra);
const writeOutFixRefused = [
	// `fold $first []` ⏎ `(fold $first (tl fs3)) 5` は、前（2026-10-25〜26）は2行目の G7（空の流れの実体を分け合わない）。2026-10-27 の R84 から1行目の `fold $first []` が
	// 実体の本体 `@f _` の G16（R33）で、鍵の見本は上の k3 に替えた。同じ所で移した空の List の行も、ここに置く。
	// 片イ（R125）で G16 は廃止。この5行は上の writeOutFixKeys へ移した。
	// 門に当たる本体は、2026-10-26 の R28 の書き直し（末尾の `_` は消える）で、前の `[+ 1] _ _`（`[+ 1]` になって G16）から `[+ 1] _ 1`（内側の `_` の G5）に替えた。
	// 2026-10-28 の R105 で `[+ 1] _ 1` は `[+ 1] 1` になるので、`[[g5] ? g5] !_ 1`（括りの関数の口の `!_` の G5）に替えた。
	["数の見えない流れ (bb [1]) (tl vs)~ も頭に当てて本体の G5（前は未知で通った）", trial(["bb : [a] y ? [[g5] ? g5] !_ 1", SEVEN, "(bb [1]) (tl vs)~"]), "G5", [["bb", "N A"]]],
	["数の見えない流れ map2 $(bb [1]) vs（同じ G5）", trial(["bb : [a] y ? [[g5] ? g5] !_ 1", "map2 $(bb [1]) vs"]), "G5", [["map2", "$L [N…]"], ["bb", "N A"]]],
	["数の見えない流れ z : xs ? (bb [1]) xs~ ⏎ z vs（同じ G5）", trial(["bb : [a] y ? [[g5] ? g5] !_ 1", "z : xs ? (bb [1]) xs~", "z vs"]), "G5", [["bb", "N A"]]],
	// `uu st~` は片イ（R120）で上の writeOutFixKeys へ移した。
	// 合成に来た流れの形 `io1 (inc double vs~)`（読みで形が割れるので形の見えない A で G7 だった）は、§5 Q58 の答え（R58）で合成全体の書き下しの `[A…]` に
	// なり、通る（下の「R58〜R61」の節）。
];
for (const [name, s, want, kind, extra] of writeOutFixPasses) checkPass(`確かめ（2026-10-25） ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of writeOutFixRefused) checkRefused(`確かめ（2026-10-25） ${name}`, s, want, inst);

// 試しの確かめ（2026-10-24）で直した所の言い分と資源の守り。
const refusalOfSrc = (s) => {
	try {
		resolve(s);
		return null;
	} catch (e) {
		return e;
	}
};
// 印の届かない `@x` は、2026-10-25 の R55 と Q56 の答えから素の関数の仮引数（`tg : g ? @g vs~`）だけ（前は別名の番地 `cc : add inc` ⏎ `fold $cc vs`、
// R55 の片では恒等射の番地 `$!_`・`i : !_` の `$i` も。§5 Q45 の別名の分と §5 Q56 は閉じた）。
law("試し：G19 の言い分は、印の届かない `@x` で §5 Q45 を名指しする", () => {
	const out = [];
	for (const s of [trial("tg : g ? @g vs~")]) {
		const e = refusalOfSrc(s);
		if (!e || e.gate !== "G19" || !e.message.includes("§5 Q45") || e.message.includes("Q56")) out.push(`got: ${e ? `${e.gate} ${e.message}` : "通った"}`);
	}
	// 恒等射の番地 `$!_` は、§5 Q56 の答えから1引数の恒等射の印を持つので、`map2 $!_ vs` は G19 に当たらない（書き下しで、t の数が見えないので未知）。
	const id = refusalOfSrc(trial("map2 $!_ vs"));
	if (id) out.push(`map2 $!_ vs got: ${id.gate} ${id.message}`);
	// 口の数が分からない関数（印の問題でない）の言い分は Q45 を言わない。
	const g = refusalOfSrc(trial([...GO_DEFAULT, "go vs~"]));
	if (!g || g.gate !== "G19" || g.message.includes("Q45")) out.push(`go vs~ got: ${g ? `${g.gate} ${g.message}` : "通った"}`);
	// 書き下しで答えが割れる所（2026-10-25）の言い分は §5 Q57 を名指しする。口が3つ以上の関数の言い分は §5 Q46 を名指しする（同じ日の確かめの直し）。
	// 合成に来た流れは、同じ日の確かめの直しでは §5 Q58 を名指ししていた。Q58 の答え（R58）から、断るのは合成全体の口が3つ以上か分からない所だけで、
	// 言い分は R58 と §5 Q46 を名指しし、閉じた Q58 は言わない。
	// 空の流れの書き下し（`inc []~`、§5 Q57 を名指ししていた）は、2026-10-26 の R70 で G19 でなくなった（余ったラムダで `_`）ので外した。
	for (const [line, q0] of [["inc f3 vs~", "§5 Q46"], ["inc [+] vs~", "§5 Q46"], ["f3 vs~", "§5 Q46"]]) {
		const q = refusalOfSrc(trial(line));
		if (!q || q.gate !== "G19" || !q.message.includes(q0) || q.message.includes("Q58")) out.push(`${line} got: ${q ? `${q.gate} ${q.message}` : "通った"}`);
	}
	for (const line of ["inc f3 vs~", "inc [+] vs~"]) {
		const q = refusalOfSrc(trial(line));
		if (!q || !q.message.includes("R58")) out.push(`${line} の言い分が R58 を名指ししない: ${q ? q.message : "通った"}`);
	}
	return out;
});
// 2026-10-26 の R74（§5 Q13 の答え：恒等射で始まる合成は単位律で恒等射が消える）から、頭の恒等射の形（`i inc vs~ double`）は単位律の側と同じ答えで通る
// （前は「受けた後に合成された関数」の G18）。G18 に残るのは、恒等射が流れそのものを受けた後に関数が合成される形（`i vs~ double`）。合成の途中の恒等射に流れが
// 来る形（`double i inc vs~ double`）は、今までどおり合成全体の口が数えられない G19（R58）。
// 片イ（R126）で、恒等射が流れそのものを受けた後に関数が合成される形（`i vs~ double`）も単位律の側に決まり、恒等射を消した並び（`vs~ double`）と
// 同じ木と種類で通る（前は G18）。
law("試し：恒等射が流れを受けた後の関数も、片イ（R126）で恒等射を消した並びと同じ（前は G18、R51）。頭の恒等射は R74 で単位律の側と同じ", () => {
	const out = [];
	for (const line of ["5 i inc vs~ double", "5 i add vs~ double", "5 i f2 vs~ inc"]) {
		const e = refusalOfSrc(trial(["i : !_", "f2 : x y ? x - y", line]));
		if (e) out.push(`${line}（頭の恒等射、R74） got: ${e.gate} ${e.message}`);
	}
	for (const [line, unit] of [["i vs~ double", "vs~ double"], ["i vs~ add", "vs~ add"], ["!_ vs~ inc", "vs~ inc"]]) {
		const e = refusalOfSrc(trial(["i : !_", "f2 : x y ? x - y", line]));
		if (e) {
			out.push(`${line} got: ${e.gate} ${e.message}（前は G18）`);
			continue;
		}
		const a = resolve(trial(["i : !_", "f2 : x y ? x - y", line])).trees.at(-1);
		const b = resolve(trial(["i : !_", "f2 : x y ? x - y", unit])).trees.at(-1);
		if (show(a) !== show(b) || kindOf(a) !== kindOf(b)) out.push(`${line} ⇔ ${unit}: ${show(a)} : ${kindOf(a)} / ${show(b)} : ${kindOf(b)}`);
	}
	// 頭の恒等射を消した並び（R74）と、消さずに書いた並びは同じ答え。
	for (const line of ["inc vs~ double", "add vs~ double", "f2 vs~ inc"]) {
		const a = resolve(trial(["i : !_", "f2 : x y ? x - y", `i ${line}`]));
		const b = resolve(trial(["i : !_", "f2 : x y ? x - y", line]));
		const ta = a.trees[a.trees.length - 1];
		const tb = b.trees[b.trees.length - 1];
		if (show(ta) !== show(tb) || kindOf(ta) !== kindOf(tb)) out.push(`i ${line} ⇔ ${line}: ${show(ta)} : ${kindOf(ta)} / ${show(tb)} : ${kindOf(tb)}`);
	}
	// 恒等射を消した並び（単位律の側）は、書き下し・畳み込みの値の後ろに関数が積まれて余る。
	for (const line of ["inc vs~ double", "f2 vs~ inc"]) {
		const r = resolve(trial(["f2 : x y ? x - y", line]));
		const t = r.trees[r.trees.length - 1];
		if (!(t.t === "construct" && kindOf(t) === "A")) out.push(`${line} got: ${show(t)} : ${kindOf(t)}`);
	}
	return out;
});
// 合成の幅の資源の守り（COMPOSE_WIDTH_LIMIT。§5 Q25 の前からの穴）：同じ合成を並べて渡す再帰は、合成の中の関数が倍々になっても鍵の深さが
// 増えないので、前はヒープが尽きてプロセスごと落ちた（欄の道は HEAD d78ce73c でも、番地の道は試しの R49 から。前の番地の道は `@f` が頭以外で
// G6）。1本 5 秒の上限で見る。
law("試し：合成を倍々にする再帰は、合成の幅の資源の守りで断る", () => {
	const out = [];
	const cases = [
		trial(["deep7 : f [~t] ? deep7 $[@f @f] t", "deep7 $inc vs"]),
		trial(["deep : f [x ~t] ? (deep $[@f @f] t) , x", "deep $inc vs"]),
		trial(["dg : [f] [~t] ? dg [f : f f] t", "dg [f : inc] vs"]),
		trial(["fq : [g] ? fq [g : g g]", "fq [g : inc]"]),
	];
	for (const s of cases) {
		const t0 = Date.now();
		const e = refusalOfSrc(s);
		const ms = Date.now() - t0;
		if (ms > 5000) out.push(`${s.split("\n").slice(-2).join(" ⏎ ")}：${ms}ms`);
		if (!e || e.reason !== "compose-width-limit") out.push(`${s.split("\n").slice(-2).join(" ⏎ ")} got: ${e ? `${e.reason} ${e.gate || ""}` : "通った"}  want: compose-width-limit`);
	}
	// 幅が1ずつ増えるだけの再帰は、今までどおり入れ子の数の守りで止まる。
	const e = refusalOfSrc(trial(["deep8 : f [~t] ? deep8 $[@f inc] t", "deep8 $inc vs"]));
	if (!e || e.reason !== "instance-nest-limit") out.push(`deep8 got: ${e ? e.reason : "通った"}  want: instance-nest-limit`);
	return out;
});

// ---------------------------------------------------------------------------
// 評価する所の外で余ったラムダ（2026-10-24、R52、§7.24）
// ---------------------------------------------------------------------------
//
// 経緯：主の Claude が 2026-10-24 06:01（UTC）の返事で「`5 inc == 6` は、`inc 5 == 6` のつもりで書いても黙って通る（Q38・Q44）」と書き
// （03:03 の逆適用の廃止の報告にも同じ趣旨の行）、利用者がその文を引いて U [2026-10-24 06:29 ebf18260]「困ったね…逆適用はすべて廃止だと
// 言ってるのに～」。主の Claude の問い「値の後ろで何も受けずに閉じた関数は、`:` の右辺を除くどこでも、余ったラムダとして `_` にして知らせる、
// でいい？」に U〔答え〕[2026-10-24 06:32 ebf18260]「もちろん！」。
// - R52：左が名前1つの `:`（定義・欄・局所の定義）の右辺の並びを除く、どの並びでも（行の根・括りの中・段4〜8 と `,` の辺・字下げの本体の
//   各行・`?` の本体の根・枝の条件と値・囲み）、値の上に積まれた関数が、並びが閉じるまでに何も受けなければ、余ったラムダとして `_` になり、
//   構築の中では消える（R15）。leftover-lambda で知らせる（R48 と同じ。重さは同じ日の §5 Q44 の答えで information から warning に上げた。
//   恒等射なら知らせない）。合成は受けたことに数えない。§5 Q50 の答えから、`:` の右辺の並びも除かない（下の注、closedRhsPasses）。
// - 並び全体が1つの関数（`(inc add 5)`・`(f3 !_ 2)`・辺の `inc`）は今のまま（括りの中は後から当てられる、§5 Q37）。
// - 確かめの直し（§7.25）：値の上に積まれた後に受けた関数（`(5 add 1)`）と穴の関数（`(5 f2 !_)`）にも当てる。値の上に積まれたのは `(F Y)` の
//   1項で、括った `(5 (add 1))`・名前の `5 p1` と同じ（法則5）。最初の版は外に置いていて（未知）、括った綴りと割れていた。`:` の右辺の `,` が
//   恒等射で消えて残った並び（`v : 5 inc , !_`）は、右辺の並びとして R52 の外（R45。最初の版は v を 5 と読んでいた）。
// - 主の Claude の訂正：同じ答えの中で主の Claude は「`v : 5 inc` ⏎ `v 3` は `5 (inc 3)` で、inc がちゃんと受ける」と書いたが、名前は右辺を1つの
//   項として指し（R42 の読み7）、字面への置き換えではないので、v は未知で `v 3` は G7。字面どおりに読むかは §5 Q50。
// - 2026-10-24 の §5 Q50 の答え（下の closedRhsPasses）：右辺は閉じた1つの項で、`:` の右辺にも R52 を当てる（v は 5、`v 3` は `5 3`）。この節の
//   `:` の右辺の行は、答えを今の物に直した。
// 法則は coproduct_laws.test.js の法則16（`C[(X F)]` と `C[X]`）。
const r52Passes = [
	// 規則の例（上の問いの答えの後に主の Claude が挙げた物）
	["例 5 inc == 6（`5 == 6`。R47 では未知の辺で診断なし）", std("5 inc == 6"), "(== (construct 5 (unit inc)) 6)", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	["例 (5 inc) 3（`5 3`。括りの中の inc は二度と受けない。R47 では G7）", std("(5 inc) 3"), "(construct [5 inc] 3)", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	["例 t : y ? y inc の本体（`y`。R47 では未知）", std("t : y ? y inc"), "(construct y (unit inc))", "A", { body: true, diagCount: 1, leftoverDiag: ["inc"] }],
	["例 [1 2 inc]（`[1 2]`。R47 では未知）", std("[1 2 inc]"), "[1 2 inc]", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	// 例の `5 inc , 1` は G3 のまま（r52Refused）。括った `(5 inc) , 1` は `,` の辺の括りの中で R52（R47 では、`,` の値は A なので、未知の括りを
	// 器に入れたまま診断なしで通っていた）。
	["(5 inc) , 1（`5 , 1`。R47 では未知の括りを器に入れて診断なし）", std("(5 inc) , 1"), "(, [5 inc] 1)", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	// 当てる所：段4〜8 の右の辺・`,` の辺の恒等射で残った並び・囲み・撒く項の括り・本体の括り・括りの関数の実引数
	["6 == 5 inc（右の辺も）", std("6 == 5 inc"), "(== 6 (construct 5 (unit inc)))", "A", { leftoverDiag: ["inc"] }],
	["(5 inc , !_) 3（括りの中の `,` が恒等射で消えて残った並び）", std("(5 inc , !_) 3"), "(construct [5 inc , !_] 3)", "A", { leftoverDiag: ["inc"] }],
	["||5 inc||（囲みの中）", std("||5 inc||"), "||5 inc||", "A", { leftoverDiag: ["inc"] }],
	["[5 inc]~（撒く括りの中。R47 では中身の未知な器を撒く G7）", std("[5 inc]~"), "[5 inc]~", "A", { leftoverDiag: ["inc"] }],
	["inc (5 inc)（`inc 5`。R47 では G7）", std("inc (5 inc)"), "(apply inc [5 inc])", "A", { leftoverDiag: ["inc"] }],
	["n (1 2 inc)（`n [1 2]`。R47 では G7）", std("n (1 2 inc)"), "(apply n [1 2 inc])", "A", { leftoverDiag: ["inc"] }],
	["(5 inc) inc（括りの中の inc と、根に余った inc。書いた所ごとに1つずつ）", std("(5 inc) inc"), "(construct [5 inc] (unit inc))", "A", { leftoverDiag: ["inc", "inc"] }],
	["t : y ? (5 inc)（本体の根の括り）", std("t : y ? (5 inc)"), "(: t (? [y] [5 inc]))", "A", { leftoverDiag: ["inc"] }],
	["t : y ? (y inc) 3（本体の中の括り）", std("t : y ? (y inc) 3"), "(construct [y inc] 3)", "A", { body: true, leftoverDiag: ["inc"] }],
	["t : y ? y inc ⏎ t 3 4（本体の根が A なので、余りを積む。R47 では未知の後ろに 4 で G2(a)）", std(["t : y ? y inc", "t 3 4"]), "(construct (apply t 3) 4)", "A", { leftoverDiag: ["inc"] }],
	// 字下げの本体の各行・枝の値と条件
	["字下げの本体の行 x inc", std(["w : x ?", "\tx inc", "\tx", ""]), "(block (construct x (unit inc)) x)", "A", { body: true, leftoverDiag: ["inc"] }],
	// 左が名前でない1項の `:`（`x > 1`）は、P3 では左を解かない1項だが、定義ではなく枝なので、右辺は枝の値（R52 の R の所）。
	["枝の値 x > 1 : x inc（左が名前でない1項の `:` は枝）", std(["q : x ?", "\tx > 1 : x inc", "\tx", ""]), "(block (: (> x 1) (construct x (unit inc))) x)", "A", { body: true, leftoverDiag: ["inc"] }],
	["枝の値 inc x : x inc（左が2項以上）", std(["q : x ?", "\tinc x : x inc", "\tx", ""]), "(block (: (apply inc x) (construct x (unit inc))) x)", "A", { body: true, leftoverDiag: ["inc"] }],
	["枝の条件 x inc == x : 1", std(["q : x ?", "\tx inc == x : 1", "\tx", ""]), "(block (: (== (construct x (unit inc)) x) 1) x)", "A", { body: true, leftoverDiag: ["inc"] }],
	// `:` の右辺の並びの中の括り（右辺の並びそのものではない）
	["v : (5 inc) ⏎ v 3（右辺の括りの中は R52。v は値）", std(["v : (5 inc)", "v 3"]), "(construct v 3)", "A", { leftoverDiag: ["inc"] }],
	["st : ⏎ k : (5 inc)（欄の右辺の括りの中も）", src([INC, "st :", "\tk : (5 inc)", "\tj : 2", ""]), "(: st (block (: k [5 inc]) (: j 2)))", "A", { at: 1, leftoverDiag: ["inc"] }],
	// 合成・名前の合成・恒等射に合成した関数（受けたことに数えない）
	["(5 inc double) 1（合成も何も受けていない）", std("(5 inc double) 1"), "(construct [5 inc double] 1)", "A", { leftoverDiag: ["(compose inc double)"] }],
	// 2026-10-26 の R74（§5 Q13 の答え：恒等射で始まる合成は単位律で恒等射が消える）から、余ったのは恒等射の後ろの関数で、知らせる名前もその関数（下の7行。
	// 前は `(compose !_ inc)` などの合成の名前）。
	["5 !_ inc == 1（恒等射に合成した関数は恒等射でない。R74 で知らせるのは inc）", std("5 !_ inc == 1"), "(== (construct 5 (unit inc)) 1)", "A", { leftoverDiag: ["inc"] }],
	// 恒等射の直しの節から移した行（R47 では、括りの中が値と関数の並びで G7。単位律の `(5 f2) 3` も同じく通る）
	["(5 !_ f2) 3（R47 では G7、その前は G18、f2 5 3）", std("(5 !_ f2) 3"), "(construct [5 !_ f2] 3)", "A", { leftoverDiag: ["f2"] }],
	["(5 i f2) 3（同じ）", std(["i : !_", "(5 i f2) 3"]), "(construct [5 i f2] 3)", "A", { leftoverDiag: ["f2"] }],
	["(5 !_ inc f2) 3（同じ）", std("(5 !_ inc f2) 3"), "(construct [5 !_ inc f2] 3)", "A", { leftoverDiag: ["(compose inc f2)"] }],
	["(5 !_ add f2) 3（同じ）", std("(5 !_ add f2) 3"), "(construct [5 !_ add f2] 3)", "A", { leftoverDiag: ["(compose add f2)"] }],
	["c9 : !_ f2 ⏎ (5 c9) 3（同じ）", std(["c9 : !_ f2", "(5 c9) 3"]), "(construct [5 c9] 3)", "A", { leftoverDiag: ["c9"] }],
	["3 (5 !_ f2)（同じ）", std("3 (5 !_ f2)"), "(construct 3 [5 !_ f2])", "A", { leftoverDiag: ["f2"] }],
	// 消えた後の形：構築の中の `(unit …)` は値の形・数に入らない（`[1 2 inc]` は `[1 2]` と同じ形で、括りの関数は同じ実体を使う）
	["tl [1 2 inc] ⏎ tl [1 2]（実体は1つ。形は `[1 2]` と同じ）", std(["tl : [a ~r] ? r", "tl [1 2 inc]", "tl [1 2]"]), "(: tl (? [[a ~r]] (inst [N…] r)))", "A", { at: -3, leftoverDiag: ["inc"] }],
	// 本体を実体ごとに読み直しても、書いた所ごとに1回だけ知らせる
	// 2026-10-26 の R64 から、`kk [1 2]` は括り `[y]`（名前1つ）に要素2つの List を渡すので、名前の無い要素を information の bracket-excess で知らせる
	// （診断の数は 1 → 2。余ったラムダの知らせは今までどおり1回）。
	["kk : [y] ? y inc ⏎ kk 1 ⏎ kk [1 2]（実体は2つ、知らせるのは1回）", std(["kk : [y] ? y inc", "kk 1", "kk [1 2]"]), "(apply kk [1 2])", "A", { diagCount: 2, leftoverDiag: ["inc"], severities: ["information/bracket-excess", "warning/leftover-lambda"] }],
	// 出ない所：恒等射（消えるが知らせない）
	["(5 !_)（恒等射は知らせない）", std("(5 !_)"), "[5 !_]", "A", { diagCount: 0, leftoverDiag: [] }],
	["(5 i i)（恒等射どうしの合成も）", std(["i : !_", "(5 i i)"]), "[5 i i]", "A", { diagCount: 0, leftoverDiag: [] }],
	// 出ない所：並び全体が1つの関数（今のまま。§5 Q37）
	["(inc add 5) 3（括りの中身が丸ごと関数は、後から当てられる）", std("(inc add 5) 3"), "(apply [inc add 5] 3)", "A", { diagCount: 0 }],
	["(f3 !_ 2) 1 3（同じ）", std("(f3 !_ 2) 1 3"), "(apply [f3 !_ 2] (construct 1 3))", "A", { diagCount: 0 }],
	// `inc == 5`（辺が関数だけは未知、知らせない）は、2026-10-26 の R76（§5 Q37 の答え：比べの被演算子は評価する所）で `(== (unit inc) 5)` になり知らせる
	// （いちばん後ろの「R73〜R79」の節へ移した）。
	// 左が名前1つの `:` の右辺の並び：R52 の片では出ない所（式を指すだけ）だった。2026-10-24 の §5 Q50 の答えから、右辺は閉じた1つの項で
	// R52 を当てる（closedRhsPasses）。下の行は答えを今の物に直した（名前の「前は」が R52 の片の答え）。
	["v : 5 inc（Q50 の答えから知らせる。前は `(construct 5 inc)` で知らせなかった）", std("v : 5 inc"), "(: v (construct 5 (unit inc)))", null, { diagCount: 1, leftoverDiag: ["inc"] }],
	["st : ⏎ k : 5 inc（欄の右辺も。前は知らせなかった）", src([INC, "st :", "\tk : 5 inc", "\tj : 2", ""]), "(: st (block (: k (construct 5 (unit inc))) (: j 2)))", "A", { at: 1, diagCount: 1, leftoverDiag: ["inc"] }],
	// 2026-10-26 の R80（§5 Q10 の答え）から、局所の名前 y は右辺（x の後ろに inc が余り、x）の種類で、局所の定義の行は値の行に数えないので本体は A（前は、局所の
	// 名前が未知で本体も未知）。寄せ1（R128、2026-11-04）から `⇥y : x inc` は条件 y（未定義の名前で `_`、undefined-name）の枝で、右辺は枝の値の並び（inc が余る）。
	["q : x ? ⏎ y : x inc ⏎ y（枝の値の並びも。前は知らせなかった。寄せ1 から y は未定義の名前、前は R80 の局所の定義）", std(["q : x ?", "\ty : x inc", "\ty", "", "q 3"]), "(apply q 3)", "A", { diag: "y", diagCount: 2, leftoverDiag: ["inc"] }],
	// `:` の右辺の `,` が恒等射で消えて残った並びも、右辺の並び（R45）なので、`v : 5 inc` と同じく R52（前は、`v : 5 inc` と同じく R52 の外）
	["v : 5 inc , !_（`v : 5 inc` と同じ右辺の並び。前は知らせなかった）", std("v : 5 inc , !_"), "(: v (construct 5 (unit inc)))", null, { diagCount: 1, leftoverDiag: ["inc"] }],
	["st : ⏎ k : 5 inc , !_（欄の右辺も。前は知らせなかった）", src([INC, "st :", "\tk : 5 inc , !_", "\tj : 2", ""]), "(: st (block (: k (construct 5 (unit inc))) (: j 2)))", "A", { at: 1, diagCount: 1, leftoverDiag: ["inc"] }],
	["v : (5 inc) , !_ ⏎ v 3（`,` の辺の括りの中は R52。v は値）", std(["v : (5 inc) , !_", "v 3"]), "(construct v 3)", "A", { leftoverDiag: ["inc"] }],
	["v : 5 inc == 6 , !_（`,` で残ったのは `==` で、その辺は R52）", std("v : 5 inc == 6 , !_"), "(: v (== (construct 5 (unit inc)) 6))", null, { leftoverDiag: ["inc"] }],
	// 値の上に積まれた後に受けた関数と、穴の関数（確かめの直し、§7.25。法則5 で括った `(5 (add 1))`・名前の `5 p1` と同じ。最初の版は未知・G7）
	["(5 add 1)（受けた後の部分適用も消える。最初の版は未知）", std("(5 add 1)"), "[5 add 1]", "A", { diagCount: 1, leftoverDiag: ["(apply add 1)"] }],
	["(5 add 1) 3（最初の版は G7）", std("(5 add 1) 3"), "(construct [5 add 1] 3)", "A", { leftoverDiag: ["(apply add 1)"] }],
	["(5 (add 1)) 3（括った綴りも同じ、法則5）", std("(5 (add 1)) 3"), "(construct [5 [add 1]] 3)", "A", { leftoverDiag: ["[add 1]"] }],
	["5 add 1 == 6（辺でも。最初の版は未知で診断なし）", std("5 add 1 == 6"), "(== (construct 5 (unit (apply add 1))) 6)", "A", { diagCount: 1, leftoverDiag: ["(apply add 1)"] }],
	["p1 : add 1 ⏎ 5 p1 == 6（名前の部分適用も同じ）", std(["p1 : add 1", "5 p1 == 6"]), "(== (construct 5 (unit p1)) 6)", "A", { leftoverDiag: ["p1"] }],
	["5 add 1 inc == 6（受けた後に合成した関数も）", std("5 add 1 inc == 6"), "(== (construct 5 (unit (compose (apply add 1) inc))) 6)", "A", { leftoverDiag: ["(compose (apply add 1) inc)"] }],
	["t : y ? y add 1 ⏎ t 5（本体の根の受けた後の関数も。最初の版は未知）", std(["t : y ? y add 1", "t 5"]), "(apply t 5)", "A", { diagCount: 1, leftoverDiag: ["(apply add 1)"] }],
	["[1 2 add 3]（器の中も）", std("[1 2 add 3]"), "[1 2 add 3]", "A", { leftoverDiag: ["(apply add 3)"] }],
	["(5 f2 !_)（穴の関数も消える。最初の版は未知）", std("(5 f2 !_)"), "[5 f2 !_]", "A", { diagCount: 1, leftoverDiag: ["(? [$p0 [~$p1]] (apply f2 (construct $p0 $p1~)))"] }],
	["(5 f2 !_) 3（最初の版は G7）", std("(5 f2 !_) 3"), "(construct [5 f2 !_] 3)", "A", { leftoverDiag: ["(? [$p0 [~$p1]] (apply f2 (construct $p0 $p1~)))"] }],
	["(5 inc !_) 3（`inc !_` は η で inc。`(5 inc i) 3` と同じく A。最初の版は G7）", std("(5 inc !_) 3"), "(construct [5 inc !_] 3)", "A", { leftoverDiag: ["(? [$p0] (apply inc $p0))"] }],
	["i : !_ ⏎ (5 inc i) 3（同じ）", std(["i : !_", "(5 inc i) 3"]), "(construct [5 inc i] 3)", "A", { leftoverDiag: ["(compose inc i)"] }],
	["5 f2 _ 3 == 1（部分適用も。2026-10-28 の R105 で `f2 3`、前はカリー化した穴の関数）", std("5 f2 _ 3 == 1"), "(== (construct 5 (unit (apply f2 3))) 1)", "A", { leftoverDiag: ["(apply f2 3)"] }],
	// 片イ（R121）で G3 は廃止：`,` の辺も左から畳み、辺の終わりに余った inc は `_` と leftover-lambda（`(5 inc) , 1` の側）。
	["5 inc , 1（前は G3、§5 Q3）", std("5 inc , 1"), "(, (construct 5 (unit inc)) 1)", "A", { leftoverDiag: ["inc"] }],
];
const r52Refused = [
	// 例の `5 inc , 1` は G3 のまま：`(5 inc) , 1` と `5 (inc , 1)` のどちらで読むか（§5 Q3）は R52 では決まらない（前者は `5 , 1`、後者は
	// 関数を器に入れた `5 [inc 1]` で、値が割れる）。
	// 片イ（R121）で `,` の辺も左から畳むので、上の r52Passes へ移した。
	// 主の Claude の訂正の行（名前は右辺を1つの項として指すので、v は未知で `v 3` は G7）と、`,` が恒等射で消えて残った右辺の並び・受けた後の
	// 関数の右辺の並びの G7 の行（R52 の片と §7.25）は、2026-10-24 の §5 Q50 の答え（v は閉じた1つの項で 5）で通る側へ移した（closedRhsPasses）。
];
for (const [name, s, want, kind, extra] of r52Passes) checkPass(`余ったラムダ ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of r52Refused) checkRefused(`余ったラムダ ${name}`, s, want, inst);

// ---------------------------------------------------------------------------
// `:` の右辺は閉じた1つの項・`$[…]` の中身は遅延・余ったラムダの知らせは warning（2026-10-24、§5 Q50〜Q52・Q44 の答え、§7.26）
// ---------------------------------------------------------------------------
//
// 経緯：R52 の片で残した §5 Q50〜Q52・Q44 に、利用者 U [2026-10-24 09:46 ebf18260]「Q50は迷うので、そう読むことで生じるデメリットを先に
// 教えて / Q51は具体例がある方が良いね… / Q52は最初からそのつもりだったしその方が良いと考えてたけど…違うなら違うと言って / Q44は知らせが
// 届かないってだけかい？」。主の Claude は 09:48（UTC）に材料と見立てを出した（Q50：閉じた1つの項として読むに傾いてる。Q51：今のまま当てる
// のがいい。Q52：`$` は物にする＝遅延なので、書いた所では判定せず、`@p` で開いた所で。Q44：本題は重さで、warning に上げるのが筋）。
// U〔答え〕[2026-10-24 09:49 ebf18260]「全てその方向で良いと思う。」。
// - Q50：左が名前1つの `:`（定義・欄・局所の定義）の右辺にも R52 を当てる。名前は右辺を閉じた1つの項として指す：`v : 5 inc` の右辺は
//   `(construct 5 (unit inc))` で、定義の行で知らせ、v は 5（`v 3` は `5 3`）。右辺が丸ごと関数（`c1 : inc inc`・`a1 : add 1`）は今のまま L。
// - Q51：枝の値にも当てる（今のまま。r52Passes の枝の行）。
// - Q52：`$[…]` の中身は遅延した式で、R52 の判定をしない（`_` にせず、知らせない）。中身の項の中（入れ子の括り・`?` の本体・段4〜8 の辺）は
//   今のまま当てる（遅延が中まで及ぶかは §5 Q53）。中身の行が段2 の `:`（欄・枝）なら、右辺はほかの `:` の右辺と同じく当てる（これも
//   §5 Q53。欄は Q50 の答えから新しく知らせる）。`@p` で中身を開けない形（中身が関数でない `$[5 inc]`）は今のまま未知（§5 Q9）で、知らせは
//   どこにも出ない（§5 Q44 の残り）。同じ日の R53（`$` は関数だけを運ぶ）で、中身が関数でない `$[…]` は G20 になり、Q44 の残り その2 は
//   閉じた（中身の並びに余るラムダが無くなった。上の答えの行のうち、中身が関数でない物は closedRhsRefused へ移した）。Q53 は狭まって残る：
//   中身が関数の `$[…]` の中の項（`$[add (5 inc)]`）と `?` の本体（`$[x ? x inc]`）は、今のまま当てて書いた所で知らせる。
// - Q44：leftover-lambda の重さは warning（断らない）。ほかの診断（undefined-name・pointfree-not-folded）は information のまま。
// 法則は coproduct_laws.test.js の法則10・12・13・16（名前と、括った右辺 `(P)` が同じ答え）。
const closedRhsPasses = [
	// Q50：右辺は閉じた1つの項
	["Q50 v : 5 inc（定義の行で知らせる）", std("v : 5 inc"), "(: v (construct 5 (unit inc)))", null, { diagCount: 1, leftoverDiag: ["inc"] }],
	["Q50 v : 5 inc ⏎ v 3（`5 3`。前は v が未知で G7）", std(["v : 5 inc", "v 3"]), "(construct v 3)", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	["Q50 v : 5 inc ⏎ (v) 3（括っても同じ）", std(["v : 5 inc", "(v) 3"]), "(construct [v] 3)", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	["Q50 v : 5 inc ⏎ inc v（v は 5。前は G7）", std(["v : 5 inc", "inc v"]), "(apply inc v)", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	["Q50 v : 5 inc ⏎ v == 5（前は未知）", std(["v : 5 inc", "v == 5"]), "(== v 5)", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	["Q50 v : 5 inc ⏎ v inc（v の後ろの inc は根で余る。知らせるのは書いた所ごとに1つ）", std(["v : 5 inc", "v inc"]), "(construct v (unit inc))", "A", { diagCount: 2, leftoverDiag: ["inc", "inc"] }],
	["Q50 v : 5 add 1 ⏎ v 3（受けた後の関数も。前は G7）", std(["v : 5 add 1", "v 3"]), "(construct v 3)", "A", { leftoverDiag: ["(apply add 1)"] }],
	["Q50 v : 5 inc double ⏎ v 3（合成も）", std(["v : 5 inc double", "v 3"]), "(construct v 3)", "A", { leftoverDiag: ["(compose inc double)"] }],
	["Q50 v : 5 f2 !_ ⏎ v 3（穴の関数も）", std(["v : 5 f2 !_", "v 3"]), "(construct v 3)", "A", { leftoverDiag: ["(? [$p0 [~$p1]] (apply f2 (construct $p0 $p1~)))"] }],
	["Q50 i : !_ ⏎ v : 5 i ⏎ v 3（恒等射は知らせない）", std(["i : !_", "v : 5 i", "v 3"]), "(construct v 3)", "A", { diagCount: 0, leftoverDiag: [] }],
	// `,` が恒等射で消えて残った右辺の並びも、右辺の並びそのもの（R45）なので同じ
	["Q50 v : 5 inc , !_ ⏎ v 3（前は G7）", std(["v : 5 inc , !_", "v 3"]), "(construct v 3)", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	["Q50 v : !_ , 5 inc ⏎ v 3（前は G7）", std(["v : !_ , 5 inc", "v 3"]), "(construct v 3)", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	["Q50 i : !_ ⏎ v : 5 inc , i ⏎ v 3（前は G7）", std(["i : !_", "v : 5 inc , i", "v 3"]), "(construct v 3)", "A", { leftoverDiag: ["inc"] }],
	["Q50 v : 5 inc , !_ , !_ ⏎ v 3（前は G7）", std(["v : 5 inc , !_ , !_", "v 3"]), "(construct v 3)", "A", { leftoverDiag: ["inc"] }],
	// 消えた後の形：名前を通しても `[1 2]` と同じ形で、括りの関数は同じ実体を使う
	["Q50 v : 1 2 inc ⏎ tl v ⏎ tl [1 2]（実体は1つ）", std(["tl : [a ~r] ? r", "v : 1 2 inc", "tl v", "tl [1 2]"]), "(: tl (? [[a ~r]] (inst [N…] r)))", "A", { at: -4, leftoverDiag: ["inc"] }],
	// 欄・局所の定義（R52 の片では外だった）
	["Q50 st : ⏎ k : 5 inc（欄）", src([INC, "st :", "\tk : 5 inc", "\tj : 2", ""]), "(: st (block (: k (construct 5 (unit inc))) (: j 2)))", "A", { at: 1, diagCount: 1, leftoverDiag: ["inc"] }],
	// 寄せ1（R128）から本体の `⇥y : x inc` は条件 y（未定義の名前）の枝で、右辺は枝の値の並び（前は R80 の局所の定義で、局所の名前は右辺の種類）。
	["Q50 q : x ? ⏎ y : x inc ⏎ y（枝の値。寄せ1 から y は未定義の名前、前は R80 の局所の定義）", std(["q : x ?", "\ty : x inc", "\ty", "", "q 3"]), "(apply q 3)", "A", { diag: "y", diagCount: 2, leftoverDiag: ["inc"] }],
	// 括りの欄も（主の Claude が 09:48 の Q51 の表で「対象外、知らせない」と挙げた形。2026-10-24 の確かめの指摘で足した）
	["Q50 [a : 5 inc]（括りの欄。R52 の片では知らせなかった）", std("[a : 5 inc]"), "[a : 5 inc]", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	// 右辺が丸ごと関数は今のまま L で、後から当てられる（10-22 22:14 のボタンの文の形）
	["Q50 c1 : inc inc ⏎ c1 5（丸ごと関数は L のまま）", std(["c1 : inc inc", "c1 5"]), "(apply c1 5)", "A", { diagCount: 0 }],
	["Q50 a1 : add 1 ⏎ a1 5（同じ）", std(["a1 : add 1", "a1 5"]), "(apply a1 5)", "A", { diagCount: 0 }],
	["Q50 c1 : inc inc（定義の行も知らせない）", std("c1 : inc inc"), "(: c1 (compose inc inc))", null, { diagCount: 0 }],
	["Q50 q : inc add 5 ⏎ q 3（流れの足りない合成も丸ごと関数）", std(["q : inc add 5", "q 3"]), "(apply q 3)", "A", { diagCount: 0 }],
	["Q50 s : [+] 1 ⏎ s 2（並びの終わりで閉じる可変長の口は今のまま、R41 の読み5）", std(["s : [+] 1", "s 2"]), "(construct s 2)", "A", { diagCount: 0 }],
	// Q52：`$[…]` の中身は遅延した式。中身が値と関数の積み上げの `$[5 inc]` の行（前は通り、知らせなかった）は、2026-10-24 の R53（`$` は関数
	// だけを運ぶ）で G20 になった（下の closedRhsRefused）。§5 Q44 の残り その2（開けない `@p` で知らせが出ない）は、書けなくなって閉じた。
	// 2026-10-26 の R81 から、番地を運ぶ p を use に渡すと印で実体を作り、`@f 3` は `inc add 5` の合成に 3 を当てた A（前は use の本体の根が未知）。
	["Q52 p : $[inc add 5]（丸ごと関数の中身は今までどおり L で、番地が運ぶ。R81 から use の実体で A、前は未知）", std(["p : $[inc add 5]", "use p 3"]), "(apply use (construct p 3))", "A", { diagCount: 0 }],
	// `?` の本体と、中身が関数の `$[…]` の中の項は、今のまま当てて書いた所で知らせる（`$` の無い `[x ? x inc]`・`[add (5 inc)]` と同じ。§5 Q53 の
	// 残りで、今の答えは実装する人の読み (1)）。§5 Q53 の形のうち中身が値の物（`$[(5 inc) 3]`・`$[(5 inc)]`・`$[5 inc == 6]`・`$[k : 5 inc]`・
	// `$[5 > 1 : 5 inc]`）は G20（下の closedRhsRefused）。R53 の片では「Q53 は閉じた」と書いたが、R53 が保証するのは中身の根が関数であることだけで、
	// 中身の項の中には値の上に積まれて閉じた関数を書ける（2026-10-24 の確かめの指摘）。
	// 2026-10-25 の §5 Q53 の答え（R59）から、中身のどこかで余る関数があれば G20（中身は2つの関数を括った形で、1つの関数と言い切れない）。前は通って
	// 知らせていた `p : $[x ? x inc]`・`p : $[add (5 inc)]`・`use $[add (5 inc)] 3` は、下の「R58〜R61」の節の断る側へ移した。
	["Q52 @[5 inc] 3（`@` は開く所なので当てる）", std("@[5 inc] 3"), "(apply @[5 inc] 3)", "未知", { leftoverDiag: ["inc"] }],
	// Q44：重さ（DIAG_SEVERITY の1か所）。warning でも断らない
	["Q44 5 inc（leftover-lambda は warning）", std("5 inc"), "(construct 5 (unit inc))", "A", { severities: ["warning/leftover-lambda"] }],
	["Q44 (5 inc) 3（R52 の知らせも warning）", std("(5 inc) 3"), "(construct [5 inc] 3)", "A", { severities: ["warning/leftover-lambda"] }],
	// 2026-10-28 の片9b：根の値の隣の未定義の名前 zz は R112 で書いた `_` と同じに消える（前は `(construct zz 5 (unit inc))`。行の中で直した。知らせの重さは今のまま）。
	["Q44 zz 5 inc（undefined-name は information のまま。片9b で zz は根の値の隣で消える）", std("zz 5 inc"), "(construct 5 (unit inc))", "A", { severities: ["information/undefined-name", "warning/leftover-lambda"] }],
	["Q44 [<<] 3 4 inc（pointfree-not-folded は information のまま）", std("[<<] 3 4 inc"), "(construct (apply [<<] (construct 3 4)) (unit inc))", "A", { severities: ["information/pointfree-not-folded", "warning/leftover-lambda"] }],
	// 名前が 5 になったので、5 を置いた並びと同じ答え（`go 5 i`・`!_ 5 inc` と同じ）。片イ（R120）で種類の未知な `go v` の後ろの i は積む予想、（R126）で
	// `!_ v inc` は恒等射を消した `v inc` で、根に余った inc は `_`（v の右辺の inc は定義の行で知らせる）。
	["Q50 既定値のある go で v : 5 inc ⏎ go v i（`go 5 i` と同じ）（前は G2(a)、その前は G7）", std([...GO_DEFAULT, "i : !_", "v : 5 inc", "go v i"]), "(construct (apply go v) (unit i))", "未知", { leftoverDiag: ["inc"] }],
	["Q50 v : 5 inc ⏎ !_ v inc（`!_ 5 inc` と同じ）（前は G18、その前は G7）", std(["v : 5 inc", "!_ v inc"]), "(construct v (unit inc))", "A", { leftoverDiag: ["inc", "inc"] }],
];
const closedRhsRefused = [
	// 名前が 5 になったので、5 を置いた並びと同じ門に当たる（`gd 5 i`・`!_ 5 inc` と同じ）
	// 片イ（R120・R126）で、この2行は上の closedRhsPasses へ移した。
	// R53（2026-10-24、`$` は関数だけを運ぶ）：中身が関数でない `$[…]` は G20。前は Q52 の答えで中身を遅延した式として通し（知らせない）、
	// 中身の項の中は今のまま当てていた（§5 Q53）。行の名前の「前は」が前の答え。
	["R53 p : $[5 inc]（前は通り、知らせなかった。Q52）", std("p : $[5 inc]"), "G20"],
	["R53 p : $[5 inc] ⏎ @p 3（前は開けないので未知で、知らせはどこにも出なかった。§5 Q44 の残り その2）", std(["p : $[5 inc]", "@p 3"]), "G20"],
	["R53 p : $[5 inc] ⏎ inc @p 3（前は `@p` が頭以外で G6）", std(["p : $[5 inc]", "inc @p 3"]), "G20"],
	["R53 p : $[5 inc , !_]（前は `,` の恒等射で残った中身の並びも遅延で通った）", std("p : $[5 inc , !_]"), "G20"],
	["R53 adder2 : m ? $[m inc]（前は本体の根の `$[…]` も遅延で通った）", std("adder2 : m ? $[m inc]"), "G20"],
	["R53 use $[5 inc] 3（前は未知の根で通った）", std("use $[5 inc] 3"), "G20"],
	["R53 [$[5 inc]]（前は括りの中の `$[…]` も A で通った）", std("[$[5 inc]]"), "G20"],
	["R53 p : $[(5 inc) 3]（前は入れ子の括りの中で知らせた。§5 Q53）", std("p : $[(5 inc) 3]"), "G20"],
	["R53 p : $[5 inc == 6]（前は段4〜8 の辺で知らせた。§5 Q53）", std("p : $[5 inc == 6]"), "G20"],
	["R53 p : $[(5 inc)]（前は1項の括りを重ねた中身で知らせ、`$[5 inc]` と知らせが割れた。§5 Q53）", std("p : $[(5 inc)]"), "G20"],
	["R53 p : $[k : 5 inc]（前は中身の欄の右辺で知らせた。§5 Q53）", std("p : $[k : 5 inc]"), "G20"],
	["R53 p : $[5 > 1 : 5 inc]（前は中身の枝の値で知らせた。§5 Q53）", std("p : $[5 > 1 : 5 inc]"), "G20"],
];
for (const [name, s, want, kind, extra] of closedRhsPasses) checkPass(`閉じた右辺 ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of closedRhsRefused) checkRefused(`閉じた右辺 ${name}`, s, want, inst);

// ---------------------------------------------------------------------------
// `$` は関数だけを運ぶ（2026-10-24、R53・G20、§7.28）
// ---------------------------------------------------------------------------
//
// 経緯：Q52 の答えの片の後、中身が値の `$[5 inc]` は `@p` で開く道が無く、余った inc の知らせがどこにも出なくなった（§5 Q44 の残り その2）。
// 利用者 U [2026-10-24 12:25 ebf18260]「そもそも $ は必ず関数だけ運ぶというくらいの縛りがあっていい！」。主の Claude の問い「`$` の縛りは、全部の
// `$` にかける？ それとも `$[…]` の中身だけ？」（12:26 UTC。09-30 の番地の裁定とのぶつかりを添えた）に、U〔答え〕[2026-10-24 12:34 ebf18260]
// 「そもそも、識別子で名前がついているものも関数か否かについては区分可能。 / だから全部の$で良いはずだ。」。
// - `$名前`：名前の種類が L なら今までどおり A（R49 の印もそのまま。値の定義の名前には付けない、§5 Q45）。A（値・番地）・未知なら G20。
//   値の定義の名前は、右辺を解いた種類で見る（別名 `p : inc` は L で通る）。未定義の名前は値（R21。2026-10-28 の片9b の R111 から `_` で、`$` は零射の番地）、取り込みのある範囲の未定義は未知。
// - `$[…]`・`$(…)`：中身の種類が L なら今までどおり、値・構築・未知なら G20。`$!_` は恒等射で通り、`$_`（書いた `_` は印）は G20。
// - 番地を受けた仮引数を先へ渡すときは `$` を付けずにそのまま渡す（`tw : f [~t] ? map f t`）。`$f` は番地の番地で G20。
// - 法則は coproduct_laws.test.js の法則17（`$名前` と `$[名前]` と `$[右辺]`、`$[B]` と `[B]`）。
const dollarPasses = [
	["R53 $inc", std("$inc"), "$inc", "A"],
	["R53 map $inc vs（番地が指す関数を運ぶ、R49）", std("map $inc vs"), "(apply map (construct $inc vs))", "A"],
	["R53 $[+ 1]（点なしの関数）", std("$[+ 1]"), "$[+ 1]", "A"],
	["R53 $[x ? x + 1]（括った ?）", src(["$[x ? x + 1]"]), "$[x ? x + 1]", "A"],
	["R53 $[inc double]（合成）", std("$[inc double]"), "$[inc double]", "A"],
	["R53 $(add 1)（部分適用。丸い括りも同じ）", std("$(add 1)"), "$[add 1]", "A"],
	["R53 $[f3 !_ 2]（穴の関数）", std("$[f3 !_ 2]"), "$[f3 !_ 2]", "A"],
	["R53 $[inc , !_]（`,` の恒等射で残った中身も関数）", std("$[inc , !_]"), "$[inc , !_]", "A"],
	["R53 $!_（恒等射）", std("$!_"), "$!_", "A"],
	["R53 i : !_ ⏎ $i（恒等射の名前）", std(["i : !_", "$i"]), "$i", "A"],
	["R53 p : inc ⏎ $p（別名は右辺を解いた種類で L。2026-10-25 の R55 から指す関数の印も付く、§5 Q45 の別名の分）", std(["p : inc", "$p"]), "$p", "A"],
	["R53 $adder（`$[+ m]` を返す関数も関数）", std("$adder"), "$adder", "A"],
	["R53 $[,]（口の数の分からない点なしも関数）", std("$[,]"), "$[,]", "A"],
	// 括りの仮引数が関数を受けた実体（R24）：名前の種類は渡された物の生まれで L。
	["R53 hb : [s] ? use $s 1 ⏎ hb [s : inc]（欄で関数を受けた s）", std(["hb : [s] ? use $s 1", "hb [s : inc]"]), "(: hb (? [[s]] (inst {s:L} (apply use (construct $s 1)))))", null, { at: -2 }],
	// 番地を受けた裸の仮引数は、`$` を付けずにそのまま渡す（`$f` は下の G20）。
	["R53 tw : f [~t] ? map f t ⏎ tw $inc vs（番地はそのまま渡す）", std(["tw : f [~t] ? map f t", "tw $inc vs"]), "(apply tw (construct $inc vs))", "A"],
	// この行は R49 の印（実体の中の `@f` が指す関数そのもの）に頼る。印が無ければ、前置 `@` の項が頭以外にあるので G6 になる（`$[@f]` 1つなら
	// 種類が未知で G20。仕様 §7.23 の戻す道の R53 の箇条。R49 は 2026-10-25 に決定）。
	["R53 tw : f [~t] ? map $[@f @f] t ⏎ tw $inc vs（`@f` で開いた関数の合成は関数）", std(["tw : f [~t] ? map $[@f @f] t", "tw $inc vs"]), "(apply tw (construct $inc vs))", "A"],
];
// 2026-10-25 の R60（§5 Q54 の答え：`$` は Reader と Writer を作る接頭辞）から、先が値の `$`（値の定義・未定義の名前・仮引数・番地の名前・値の括り・
// 字面・値の印の項）は値を読む参照として通る。R53 の片でここにあった、先が値の行は、下の「R58〜R61」の節の通る側へ移した（行の名前に R53 の前の答えと
// R53 の答え（G20）を書いた）。ここに残るのは、R60 の後も1つの Reader と言い切れない物（取り込みのある範囲の名前・中身の見えない物を受けた名前・
// 根の未知な適用・関数に値の印を当てた項・前置 `~` の項・印の無い前置 `@` の項・後置の印の付いた形）と、R60 の細かい所で断る形（`$vs - $vs`）。
// 2026-10-27 の片8（R99〜R104：`$` は必ず持ち上げ）で、種類の決まらない先（取り込みのある範囲の名前・中身の見えない物を受けた名前・根の未知な適用・印の無い前置
// `@` の項）は、先の種類の分からない持ち上げ（印 lift）で通る。ここにあった4行（`io@` ⏎ `$zz`・`kk [inc 1]` の `$f`・`$[uu 5]`・`$@f`）は、いちばん後ろの
// 「R99〜R104」の節の通る側へ移した（行の名前に前の答え G20 を書いた）。
const dollarRefused = [
	// `[sq : z ? z * z ⏎ $sq]`（R53 では局所の名前が未知で G20）は、2026-10-25 の R54 の作る途中の版で通したが、同じ日の確かめの直しで括りの中の名前は
	// G20 に戻した（言い分は「括りは器で、行は欄かもしれない」。下の「`$` の先は1つの関数」の節）。
	// 場所どうしの距離の形（09-30 の裁定）は、R53 では `$vs` が先に G20 だった。R60 で `$vs` は通るが、Reader は数ではないので、値の演算子の被演算子に
	// 置くと G7（R60 の細かい所、§5 Q59）だった。2026-10-26 の R62（§5 Q59 の答え）で、点 − 点は番地の差（A）として通るので、下の「R62・R63」の節の
	// 通る側へ移した。
	// `$-inc`（関数に値の印を当てた項は未知、Q22。G20）は、2026-10-27 の R87（§5 Q73 の答え）で `-inc` が `-_` の値になり、`$` の先が値なので値を読む参照で
	// 通る（いちばん後ろの「R83〜R93」の節）。
	// `$~vs`（前置 `~` の項は未知で G20）は、2026-10-26 の R79（§5 Q14 の答え：`~vs` は `[vs]`）で `$[vs]` と同じ値を読む参照として通る（いちばん後ろの
	// 「R73〜R79」の節へ移した）。
	// 後置の印のある形は、`$` と後置の印のどちらが先に結ぶ読みでも先が関数でないときだけ。
	["R53 $vs~（`($vs)~` でも `$(vs~)` でも先は値）", std("$vs~"), "G20"],
	["R53 q : $vs~（前は A）", std("q : $vs~"), "G20"],
	["R53 $5!（どちらの読みでも先は値）", std("$5!"), "G20"],
	["R53 $[5 inc]~（前は未知の根）", std("$[5 inc]~"), "G20"],
];
// R53 の片で今のまま未知（§5 Q55）にした4つ（`$||inc||`・`$inc~`・`$inc!`・`$fs~`）は、2026-10-25 の R57 で決まった（下の「`$` の先は1つの関数」の
// 節。`$||inc||` は通り、後置の印の付いた3つは G20）。
for (const [name, s, want, kind, extra] of dollarPasses) checkPass(`番地は関数だけ ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of dollarRefused) checkRefused(`番地は関数だけ ${name}`, s, want, inst);
// G20 の言い分（2026-10-24 の確かめの指摘）：先が名前1つなら、なぜその種類かを添える。
// 本体の中の局所の名前（R53 では「局所の定義か欄・枝の条件か決まっていない」で §5 Q10 を言っていた `tt : x ?` ⏎ `\tsq : z ? z * z` ⏎ `\tmap $sq x`）は、
// 2026-10-25 の R54 で通る。局所の名前の言い分は、下の節の dollarOneMessages（言い切れない理由ごと）。
// 先が値の行（「未定義の名前は R21 を言う」の `$incc`・「値の定義は Q54 を言う」の `$vs`）は、2026-10-25 の R60 で通る（`$incc` は値を読む参照で、
// undefined-name の information は今までどおり出る。下の「R58〜R61」の節）。データの番地の綴り（§5 Q54）は閉じたので、どの言い分も言わない。
// 「取り込みのある範囲の名前は §5 Q10 を言う」（`io@` ⏎ `$zz`）は、2026-10-27 の片8 の R99 で通る（先の種類の分からない持ち上げ）ので外した。
const dollarMessages = [];
for (const [name, s, must, mustNot] of dollarMessages) {
	total++;
	try {
		resolve(s);
		fail(`番地は関数だけ 言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if (e.gate === "G20" && !missing.length && !extra.length) ok(`番地は関数だけ 言い分 ${name}`);
		else fail(`番地は関数だけ 言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}

// ---------------------------------------------------------------------------
// `$` の先は1つの関数（2026-10-25、R54〜R57・G20、§7.29）
// ---------------------------------------------------------------------------
//
// 経緯：R53 の片の後、本体の局所の `?` 定義 `sq : z ? z * z` ⏎ `map $sq x` が G20 で断られ（局所の名前を未知にしていた）、`$_` を断ると前の答え
// `||$_|| = 1`（10-21 03:01）とぶつかっていた。U [2026-10-24 16:52 8dfc006e]「そもそも、$が指定できるのは、一つの関数だと言い切れることが条件。」。
// U [2026-10-25 00:08 8dfc006e]「_は、実は、 / [x ? _] と同じだから / $_ は $[x ? _]」。主の Claude の問い「この読みで、`$` の条件（1つの関数と
// 言い切れること）と一緒に入れていい？」（00:09 UTC）に、U〔答え〕[2026-10-25 00:25 8dfc006e]「正確にはそうなるね。…$!_ も同じ理屈で、$に渡せる。
// / 後はすべて君の言う通り。」。
// - R54 局所の定義：関数の本体の行の `:` の左の名前1つは、その本体にちょうど1つなら右辺の種類（`sq : z ? z * z`・別名・合成・部分適用・閉包は通る）。
//   入れ子の括りの中だけ・同じ範囲に2つ・右辺の中から `$` で自分を指す輪は G20。裸で呼ぶ `sq x` は今のまま未知（§5 Q10）。同じ日の確かめの直しから、
//   括り・関数の本体でない字下げのブロックの中の名前（局所の定義か欄か決まっていない）・枝の行のある本体・外の名前と同じ名前の行（隠し）・
//   局所の名前を裸で書いた別名も G20（§5 Q10）。
// - R55 別名の印：`p : inc` の `$p` も指す関数の印（R49）を持つ（§5 Q45 の別名の分）。恒等射の別名 `i : !_` の `$i` は、R55 の片では持たず、
//   同じ日の §5 Q56 の答えから `$!_` と同じ1引数の恒等射 `[x ? x]` の印を持つ（下の Q56 の行）。
// - R56 `$_` は零射 `$[x ? _]` の番地（値）。`$[_]`・`_` を右辺に持つファイルの名前も同じ。並びの中の `_` は今までどおり単位（R15）。
//   `$!_` は、R55 の片では印を持たなかった（恒等射が並び全体を受ける物か1引数の `[x ? x]` か決まっていなかった、§5 Q56）。同じ日の Q56 の答え
//   （U〔答え〕[2026-10-25 07:34 2772473e]「そうか分かった！ map : f [~l] ? [@f,] l~ に対して、 map $!_ .. と map $[!_] .. で分かれる。 安心した。」）で、
//   1引数の恒等射 `[x ? x]` の印を持つ（`$_` の `[x ? _]` と対）。
// - R57 `$` とほかの印：後置の印の付いた形（`$inc~`・`$fs~`・`$inc!`・`$inc@`）は G20。前置の印の組み合わせと囲みは先で決める（`$||inc||`・印のある `$@f` は通る）。
// - 法則は coproduct_laws.test.js の法則18（`$N`・`$[右辺]`・本体の行の後に置いた `$N`）と法則17（`$N`・`$[N]`）。
// - 2026-11-04 の寄せ1（R128〜R130）：本体の字下げの `:` の行は、左が名前1つでも枝（match_case）で、本体に局所の定義は無い（R80 は廃止。R54 の本体の局所の所も
//   消えた）。下の「R54 本体の …」の行は、1行目が条件の名前（未定義の名前で `_`）の枝で、値の `z ? z * z` などは返す所に残った裸の関数で `(unit …)`（R125）。
//   `$sq` は本体の行を見ず、未定義の名前の零射の番地（R56・R111）なので、map の実体は `map $un x` と同じ（細目7）。前に G20・name-cycle・G7 で断った本体の行の
//   形は、ファイルに同じ形を書いた時と同じ答えで通る（`$[sq double]` は R59 の G20 のまま）。使う行を枝の前に置いた形は R130 で断る。
const oneFnPasses = [
	// R54：局所の定義（前はどれも G20。局所の名前は種類が未知だった）→ 寄せ1（R128）から枝の行で、`$sq` は未定義の名前の零射の番地。
	["R54 本体の ? の値の枝の後で map $sq x（寄せ1 から sq は未定義の名前。前は G20、R80 の局所の定義）", trial(["tt : x ?", "\tsq : z ? z * z", "\tmap $sq x"]), "(: tt (? [x] (block (: sq (unit (? [z] (* z z)))) (apply map (construct $sq x)))))", null, { diag: "sq", severities: ["information/bare-function-return", "information/undefined-name"] }],
	["R54 その map の実体（`$sq` は零射の番地で、`map $un x` と同じ）", trial(["tt : x ?", "\tsq : z ? z * z", "\tmap $sq x", "", "tt vs"]), "(: map (? [f [~t]] (inst $L A (apply [@f,] t~))))", null, { at: 6 }],
	// 「使う行を定義の行より前に置いても同じ（順序に依らない）」は R80 の読みの比べで、寄せ1 で比べる相手が無くなった。使う行を枝の前に置いた形は R130 で断る（下の oneFnRefused）。
	["R54 本体の2引数の ? の値の枝の後で fold $pl x（寄せ1 から pl は未定義の名前）", trial(["tt : x ?", "\tpl : a b ? a + b", "\tfold $pl x", "", "tt vs"]), "(: fold (? [f [~h]] (inst $L A (apply @f h~))))", null, { at: 8 }],
	["R54 外の仮引数を書いた ? の値の枝 k : z ? z + x の後で map $k vs（寄せ1 から k は未定義の名前。前は閉包）", trial(["tt : x ?", "\tk : z ? z + x", "\tmap $k vs", "", "tt 1"]), "(: map (? [f [~t]] (inst $L [N…] (apply [@f,] t~))))", null, { at: 6 }],
	["R54 本体の q : inc の枝の後で map2 $q x（寄せ1 から q は未定義の名前。前は局所の別名）", trial(["tt : x ?", "\tq : inc", "\tmap2 $q x", "", "tt vs"]), "(: map2 (? [f [~t]] (inst $L A (apply @f t~))))", null, { at: 7 }],
	["R54 本体の c : inc double の枝の後で map $c x（前は局所の合成）", trial(["tt : x ?", "\tc : inc double", "\tmap $c x", "", "tt vs"]), "(: map (? [f [~t]] (inst $L A (apply [@f,] t~))))", null, { at: 6 }],
	["R54 本体の a : add 1 の枝の後で map $a x（前は局所の部分適用）", trial(["tt : x ?", "\ta : add 1", "\tmap $a x", "", "tt vs"]), "(: map (? [f [~t]] (inst $L A (apply [@f,] t~))))", null, { at: 6 }],
	// 括りの中の局所の名前（`[sq : z ? z * z ⏎ $sq]`・`[sq : z ? z * z ⏎ map $sq vs]`）は、作る途中の版では通したが、確かめの直しで G20 に戻した（下の断る側）。
	["R54 $[sq]（[x] ≅ x で `$sq` と同じ先。寄せ1 から sq は未定義の名前）", std(["tt : x ?", "\tsq : z ? z * z", "\t$[sq]"]), "(: tt (? [x] (block (: sq (unit (? [z] (* z z)))) $[sq])))", null],
	["R54 本体の w0 : 0 と sq : z ? z * z の枝を並べる（寄せ1 からどちらも枝。前は局所の定義の行で枝ではない）", trial(["tt : x ?", "\tw0 : 0", "\tsq : z ? z * z", "\tmap $sq x"]), "(: tt (? [x] (block (: w0 0) (: sq (unit (? [z] (* z z)))) (apply map (construct $sq x)))))", null],
	// R55：別名の印（前は印が無く、実体の `@f` が開けなかった）
	["R55 cc : add inc ⏎ fold $cc vs（前は G19）", trial(["cc : add inc", "fold $cc vs"]), "(apply fold (construct $cc vs))", "A"],
	["R55 その fold の実体（`fold $[add inc] vs` と同じ）", trial(["cc : add inc", "fold $cc vs"]), "(: fold (? [f [~h]] (inst $L [N…] (apply @f h~))))", null, { at: 8 }],
	["R55 p : inc ⏎ map $p vs の実体（前は G7）", trial(["p : inc", "map $p vs"]), "(: map (? [f [~t]] (inst $L [N…] (apply [@f,] t~))))", null, { at: 6 }],
	// 恒等射の別名 `i : !_` ⏎ `map $i vs` は、作る途中の版では並び全体を受ける恒等射の印で通し、確かめの直しで G7 に戻した。同じ日の §5 Q56 の
	// 答えで、1引数の恒等射の印で通る（下の Q56 の行）。
	// R56：`$_` は零射 `$[x ? _]` の番地（R53 では G20）
	["R56 $_", std("$_"), "$_", "A"],
	["R56 map $_ vs（`$[x ? _]` と同じ実体の形）", trial("map $_ vs"), "(: map (? [f [~t]] (inst $L [N…] (apply [@f,] t~))))", null, { at: 6 }],
	["R56 $[_]（[x] ≅ x）", std("$[_]"), "$[_]", "A"],
	["R56 $(_)", std("$(_)"), "$[_]", "A"],
	["R56 $[[_]]", std("$[[_]]"), "$[[_]]", "A"],
	// `$[_ , !_]`（R56 の片では `,` の恒等射が消えて `_` が残り、零射の番地で A）は、2026-10-25 の R61 から書いた `_` も積の単位なので、どちらが消えるかで
	// 残る物が割れて G7（§5 Q61）。下の「R58〜R61」の節の断る側へ移した。`$[_ _]` は今のまま零射（下の節）。
	["R56 un : _ ⏎ $un（名前は右辺を指す）", std(["un : _", "$un"]), "$un", "A"],
	["R56 un : _ ⏎ $[un]", std(["un : _", "$[un]"]), "$[un]", "A"],
	// 寄せ1（R128・R129）から本体の `⇥w : _` は値が `_` の枝で消え、何も定義しない。`$w` は未定義の名前の零射の番地（前は R80 の局所の定義の右辺 `_`、答えは同じ）。
	["R56 本体の w : _ ⏎ map $w x", trial(["tt : x ?", "\tw : _", "\tmap $w x"]), "(: tt (? [x] (block (: w _) (apply map (construct $w x)))))", null],
	// 括りの中の `[w : _ ⏎ $w]` は、作る途中の版では通したが、確かめの直しで G20 に戻した（括りの中の名前、下の断る側）。
	// §5 Q56 の答え（2026-10-25）：`$!_` は1引数の恒等射 `[x ? x]` を指す印を持つ。開いた所の `@f` は口が1つの関数で、`$[x ? x]` を渡したときと
	// 同じ答え（R55 の片では印が無く、tw の実体は `(apply @f (construct 1 2))` で形は `A [N…]`。作る途中の版は並び全体を受ける恒等射の印を付けて
	// いて、同じ `(apply @f (construct 1 2))` のまま `$L` だった）。恒等射の別名 `i : !_` の `$i`・`$[i]`・本体の局所の `h : !_` の `$h` も同じ印。
	["$!_ は A で通る（今までどおり）", std("$!_"), "$!_", "A"],
	["Q56 $!_ を tw : f [~r] ? @f 1 2 に渡すと、実体の @f は1引数の恒等射（`$[x ? x]` と同じ `(construct (apply @f 1) 2)`。前は印が無く `(apply @f (construct 1 2))`）", trial(["tw : f [~r] ? @f 1 2", "tw $!_ vs"]), "(: tw (? [f [~r]] (inst $L [N…] (construct (apply @f 1) 2))))", null, { at: -2 }],
	["Q56 tw $[x ? x] vs も同じ実体の木", trial(["tw : f [~r] ? @f 1 2", "tw $[x ? x] vs"]), "(: tw (? [f [~r]] (inst $L [N…] (construct (apply @f 1) 2))))", null, { at: -2 }],
	// 利用者の答えの2つの綴り：`map $!_ vs` は恒等射の写像（値は vs）、`map $[!_] vs` は否定の点なし `[!_]` の写像（否定の写像。値に意味は無いが答えは
	// 決まる。U [2026-10-14 09:58 c7037102]「Signだと [!_,] 1 _ 3 4 みたいな関数を書く意味が無いと思っててね。…」）。前は `map $!_ vs` が G7。
	["Q56 map $!_ vs（恒等射の写像。前は G7）", trial("map $!_ vs"), "(apply map (construct $!_ vs))", "A"],
	["Q56 map $!_ vs の実体（`[@f,]` の f は口が1つの恒等射）", trial("map $!_ vs"), "(: map (? [f [~t]] (inst $L [N…] (apply [@f,] t~))))", null, { at: 6 }],
	["Q56 map $[!_] vs（否定の写像。今までどおり）", trial("map $[!_] vs"), "(apply map (construct $[!_] vs))", "A"],
	["Q56 i : !_ ⏎ map $i vs（別名も同じ印。前は G7）", trial(["i : !_", "map $i vs"]), "(apply map (construct $i vs))", "A"],
	["Q56 i : !_ ⏎ map $[i] vs（`$[i]` は `$i` と同じ先。R55 の片は G7、HEAD b08feb4f は括りの中身の印で A）", trial(["i : !_", "map $[i] vs"]), "(apply map (construct $[i] vs))", "A"],
	// 寄せ1（R128）から本体の `⇥h : !_` は条件 h（未定義の名前）の枝で、値の `!_` は返す所に残った関数で `(unit !_)`。`$h` は零射の番地（前は R80 の局所の恒等射の別名）。
	["Q56 本体の h : !_ の枝の後で map $h vs（寄せ1 から h は未定義の名前。前は G7、その後 R80 の局所の別名）", trial(["tt : x ?", "\th : !_", "\tmap $h vs"]), "(: tt (? [x] (block (: h (unit !_)) (apply map (construct $h vs)))))", null, { diag: "h" }],
	// `map2 $!_ vs`・`fold $!_ vs`・`fold $i vs`（前は G19）は、口が1つの `@f` が受けた流れの書き下し（R51、2026-10-25）で、実体の中の t の数が見えない
	// ので未知（`map2 $[x ? x] vs` と同じ）。
	["Q56 map2 $!_ vs（書き下しで未知。前は G19）", trial("map2 $!_ vs"), "(apply map2 (construct $!_ vs))", "未知"],
	["Q56 map2 $[x ? x] vs も同じ未知", trial("map2 $[x ? x] vs"), "(apply map2 (construct $[x ? x] vs))", "未知"],
	["Q56 i : !_ ⏎ fold $i vs（同じ。前は G19）", trial(["i : !_", "fold $i vs"]), "(apply fold (construct $i vs))", "未知"],
	// R57：前置の印の組み合わせと囲みで、先が関数（R53 では表に無い組み合わせの未知、§5 Q55）
	["R57 $||inc||（前は未知）", std("$||inc||"), "$||inc||", "A"],
	["R57 map $||inc|| vs（前は G7。`$[||inc||]` と同じ）", trial("map $||inc|| vs"), "(: map (? [f [~t]] (inst $L [N…] (apply [@f,] t~))))", null, { at: 6 }],
	["R57 $||!_||（前は未知）", std("$||!_||"), "$||!_||", "A"],
	// この行は R49 の印（実体の中の `@f` が指す関数そのもの）に頼る。印が無ければ `$@f` は先の種類が未知で G20（§7.23 の戻す道。R49 は 2026-10-25 に決定）。
	["R57 tw : f [~r] ? map $@f r ⏎ tw $inc vs（呼ばれた所の実体で f の指す関数が分かる）", trial(["tw : f [~r] ? map $@f r", "tw $inc vs"]), "(: tw (? [f [~r]] (inst $L [N…] (apply map (construct $@f r)))))", null, { at: -2 }],
	// 片イ（R120）：写す関数の所が値（`$v` の 5）・口が2つの関数（pl）の `[@f,]` は種類の未知な項で、map の実体で断らない（前は G7）。`$v` の warning は R60 のまま。
	// 寄せ1（R128）から `⇥v : 5`・`⇥pl : a b ? a + b` は枝で、`$v`・`$pl` は未定義の名前の零射の番地（1引数の関数なので dollar-non-function も出ず、map の実体は
	// A）。前は R60 の局所の値の参照（dollar-non-function）と、局所の2引数の関数の `map $add vs` と同じ未知。
	["R54 本体の v : 5 の枝の後で map $v x（寄せ1 から v は未定義の名前。R60 から局所の値の参照、R54 の片では G20）（前は map の実体で G7）", trial(["tt : x ?", "\tv : 5", "\tmap $v x"]), "(: tt (? [x] (block (: v 5) (apply map (construct $v x)))))", null, { severities: ["information/undefined-name"] }],
	["R54 本体の pl : a b ? a + b の枝の後で map $pl x（寄せ1 から零射の番地で A。前は `map $add vs` と同じ未知）（前は G7）", trial(["tt : x ?", "\tpl : a b ? a + b", "\tmap $pl x", "", "tt vs"]), "(apply tt vs)", "A"],
	// 前に「R54：局所の名前で言い切れない所」として G20・name-cycle・G7 で断った本体の行の形（下の oneFnRefused にあった）。寄せ1（R128）から本体の行は枝で、
	// 名前は未定義の名前（`$` は零射の番地）か、ファイルの定義・仮引数なので、ファイルに同じ形を書いた時と同じ答えで通る（細目7）。
	["寄せ1 自分を `$` で指す ? の値の枝（前は局所の輪で G20）", trial(["tt : x ?", "\tsq : z ? map $sq z", "\tmap $sq x"]), "(: tt (? [x] (block (: sq (unit (? [z] (apply map (construct $sq z))))) (apply map (construct $sq x)))))", null],
	["寄せ1 互いを `$` で指す ? の値の枝2つ（前は局所の定義どうしの輪で G20）", trial(["tt : x ?", "\ts1 : z ? map $s2 z", "\ts2 : z ? map $s1 z", "\tmap $s1 x"]), "(: tt (? [x] (block (: s1 (unit (? [z] (apply map (construct $s2 z))))) (: s2 (unit (? [z] (apply map (construct $s1 z))))) (apply map (construct $s1 x)))))", null],
	["寄せ1 同じ条件 sq の枝が2つ（本体の行の順に意味があり、断らない。前は同じ範囲に2つで G20）", trial(["tt : x ?", "\tsq : z ? z", "\tsq : z ? z * z", "\tmap $sq x"]), "(: tt (? [x] (block (: sq (unit (? [z] z))) (: sq (unit (? [z] (* z z)))) (apply map (construct $sq x)))))", null],
	// 括りの行は欄（local-field）で外からは引かないので、括りの外の `$sq` は未定義の名前（前は入れ子の括りの中だけで G20）。
	["寄せ1 本体の行の括り [sq : z ? z * z] の外の map $sq x（前は G20）", trial(["tt : x ?", "\t[sq : z ? z * z]", "\tmap $sq x"]), "(: tt (? [x] (block [sq : z ? z * z] (apply map (construct $sq x)))))", null, { diag: "sq" }],
	// 枝の値のブロックの `:` の行も枝（細目1）。
	["寄せ1 枝の値の字下げのブロックの中の ? の値の枝（前は G20）", trial(["tt : x ?", "\tx > 0 :", "\t\tsq : z ? z * z", "\t\tmap $sq x", "\t_ : 0"]), "(: tt (? [x] (block (: (> x 0) (block (: sq (unit (? [z] (* z z)))) (apply map (construct $sq x)))) (: _ 0))))", null],
	["寄せ1 枝の行のある本体の sq : inc（前は G20）", trial(["tt : x ?", "\tx > 0 : 1", "\tsq : inc", "\tmap $sq vs"]), "(: tt (? [x] (block (: (> x 0) 1) (: sq (unit inc)) (apply map (construct $sq vs)))))", null],
	["寄せ1 枝の値の中の map $sq vs（後の行の sq は条件。前は G20）", trial(["tt : x ?", "\tx > 0 : map $sq vs", "\tsq : inc", "\tvs"]), "(: tt (? [x] (block (: (> x 0) (apply map (construct $sq vs))) (: sq (unit inc)) vs)))", null],
	// 条件の inc はファイルの関数で、評価する所に残った関数として `_`（細目4、leftover-lambda）。`$inc` はファイルの inc の番地（前は隠しで G20、その前は黙ってファイルの inc）。
	["寄せ1 本体の行の条件がファイルの定義の名前 inc（前は隠しで G20）", trial(["tt : x ?", "\tinc : z ? z * z", "\tmap $inc x"]), "(: tt (? [x] (block (: (unit inc) (unit (? [z] (* z z)))) (apply map (construct $inc x)))))", null, { leftoverDiag: ["inc"] }],
	// 条件の x は仮引数で、`$x` は仮引数の持ち上げ（値なので dollar-non-function）。
	["寄せ1 本体の行の条件が仮引数 x（前は G20）", trial(["tt : x ?", "\tx : inc", "\tmap $x vs"]), "(: tt (? [x] (block (: x (unit inc)) (apply map (construct $x vs)))))", null, { severities: ["information/bare-function-return", "warning/dollar-non-function"] }],
	["寄せ1 同じ条件 w の枝2つと v : w の枝（前は局所の名前を裸で書いた別名で G20）", trial(["tt : x ?", "\tw : inc", "\tw : double", "\tv : w", "\tmap $v x"]), "(: tt (? [x] (block (: w (unit inc)) (: w (unit double)) (: v w) (apply map (construct $v x)))))", null],
	["寄せ1 w : v ⏎ v : w ⏎ $v は輪でない（どちらも枝。前は R80 で name-cycle、その前は G20）", trial(["tt : x ?", "\tw : v", "\tv : w", "\t$v"]), "(: tt (? [x] (block (: w v) (: v w) $v)))", null],
	["寄せ1 w : [w] ⏎ $w も輪でない（前は R80 で name-cycle、その前は G20）", trial(["tt : x ?", "\tw : [w]", "\t$w"]), "(: tt (? [x] (block (: w [w]) $w)))", null],
	["寄せ1 枝のある本体で sq x（sq は未定義の名前。前は G7）", trial(["tt : x ?", "\tx > 0 : 1", "\tsq : z ? z * z", "\tsq x"]), "(: tt (? [x] (block (: (> x 0) 1) (: sq (unit (? [z] (* z z)))) (construct sq x))))", null],
	// 片イ（R125）：実体の `@f` が関数として開き、本体の返す所に残った裸の関数は `_` と bare-function-return（前は G16）。
	["R55 p : inc ⏎ tw : f [~r] ? @f ⏎ tw $p vs（`tw $inc vs` と同じ）（前は G16、その前は通る・未知）", trial(["p : inc", "tw : f [~r] ? @f", "tw $p vs"]), "(apply tw (construct $p vs))", "A", { severities: ["information/bare-function-return"] }],
];
const oneFnRefused = [
	// R57：後置の印の付いた形（R53 では `$inc~`・`$inc!`・`$fs~` は未知で、根・`,` の辺・`:` の右辺では通っていた）
	["R57 $inc~（撒いた形。前は未知）", std("$inc~"), "G20"],
	["R57 $inc~ , 1（前は A）", std("$inc~ , 1"), "G20"],
	["R57 $fs~（前は未知）", std("$fs~"), "G20"],
	["R57 $inc!（値の印。前は未知）", std("$inc!"), "G20"],
	["R57 $[inc]~（前は未知）", std("$[inc]~"), "G20"],
	["R57 $!_~（前は表に無い組み合わせの未知）", std("$!_~"), "G20"],
	["R57 $inc@（取り込み。前は未知）", std("$inc@"), "G20"],
	["R57 $x@（x は未定義。R53 の確かめの直しから G20 で、答えは前と同じ）", std("$x@"), "G20"],
	// R57：印の無い前置 `@` の項は先が未知（素の関数の仮引数には印が届かない、§5 Q45）
	// 「R57 tg : g ? use $@g 5（印の無い `@g`）」（G20）は、2026-10-27 の片8 の R99 で、先の種類の分からない持ち上げとして通る（いちばん後ろの「R99〜R104」の節）。
	// R54：局所の名前で言い切れない所。寄せ1（R128）から本体の行の分（自分を `$` で指す局所の関数・局所の定義どうしの輪・同じ範囲に2つ・入れ子の括りの中だけ）は
	// 通る（上の oneFnPasses の「寄せ1」の行）。残るのは括りと構造体のブロックの中の名前（local-field）。
	// 使う行を枝の前に置いた本体（前は R80 で「順序に依らない」の比べ）は、枝の前の裸の行で R130 の断り（寄せ1）。
	["寄せ1 使う行 map $sq x を枝 sq : z ? z * z の前に置く（R130。前は R80 で後に置いたのと同じ）", trial(["tt : x ?", "\tmap $sq x", "\tsq : z ? z * z", "", "tt vs"]), "body-bare-row-between"],
	// 局所の値 `v : 5` の `$v` は、2026-10-25 の R60 から値を読む参照として通り（下の「R58〜R61」の節）、写す関数の所が値なので map の実体の `[@f,]` で
	// G7（`map $vs vs` と同じ）。R54 の片では `$v` が G20。
	// 片イ（R120）で、この行は上の oneFnPasses へ移した。
	// 確かめの直し（2026-10-25）で断る側に決めた物（どれも §5 Q10）。作る途中の版は、括りと字下げのブロックの中・枝のある本体の名前を通し、
	// 外の名前と同じ名前の行は黙ってファイルの定義を指していた。
	["R54 括りの中の局所の名前 [sq : z ? z * z ⏎ $sq]（括りは器で、行は欄かもしれない。R53 と同じ G20）", std(["[sq : z ? z * z", "$sq]"]), "G20"],
	["R54 括りの中の [sq : z ? z * z ⏎ map $sq vs]", trial(["[sq : z ? z * z", "map $sq vs]"]), "G20"],
	["R54 括りの中の [w : _ ⏎ $w]", std(["[w : _", "$w]"]), "G20"],
	["R54 本体が括り tt : x ? [sq : z ? z * z ⏎ map $sq x]（`? [ … ]` は器）", trial(["tt : x ? [sq : z ? z * z", "map $sq x]"]), "G20"],
	["R54 名前のブロック pp : ⏎ sq : z ? z * z ⏎ $sq（行の列）", std(["pp :", "\tsq : z ? z * z", "\t$sq"]), "G20"],
	// 枝の値の字下げのブロックの中・枝の行のある本体・枝の値の中で指す・ファイルの定義と同じ名前の行（隠し）・仮引数と同じ名前の行（どれも G20）は、寄せ1（R128）で
	// 本体の行が枝になって通る（上の oneFnPasses の「寄せ1」の行）。
	// 2026-10-26 の R80（§5 Q10 の答え）で、読める局所の名前を裸で書いた別名（`w : inc` ⏎ `v : w`・`w : _` ⏎ `v : w`・`v : [w]`）は右辺の種類で通った（いちばん後ろの
	// 「R80〜R82」の節）。G20 のまま断った「w が同じ範囲に2つ」と、R80 で name-cycle にした局所の別名どうしの輪（`w : v` ⏎ `v : w`・`w : [w]`）も、寄せ1 で
	// 本体の行が枝になって通る（上の oneFnPasses）。
	["R54 括りの中の [w : w ⏎ $w]", std(["[w : w", "$w]"]), "G20"],
	// 恒等射の別名と `$!_`（R55 の片では印が無く、`map $i vs`・`map $!_ vs`・`map $[i] vs`・本体の局所の `map $h vs` は G7、`map2 $!_ vs`・`fold $i vs` は
	// G19 だった）は、§5 Q56 の答えで通る側へ移した（上の Q56 の行）。
	// 空の流れは書き下しで G19（R51、§5 Q57）。`$[x ? x]` と同じ。
	// 実体の形 `A[]` は書いた空の括り（2026-10-25 の確かめの直しから、中身の見えない `A` と別の実体。resolve.js の internDesc の注）。
	// `map2 $!_ []`（G19）は、2026-10-26 の R70（§5 Q57 (a) の答え）で、実体の本体の `@f t~` が余ったラムダで `_` になり通る（いちばん後ろの「R64〜R72」の節）。
	// R55 で別名が印を持つと、実体の `@f` が関数として開き、裸の関数を返す形が G16 に当たる（`tw $inc vs` と同じ。前は通り、根が未知）。
	// 片イ（R125）で、この行は上の oneFnPasses へ移した。
	// 括りの行を解く所を通る値の輪：`w : [sq : z ? w ⏎ 5]` も同じに断る（HEAD b08feb4f から同じ。括りの行 `sq : z ? w` の右辺の本体が w を引く）。
	// ファイルに置いた `sq : z ? w` ⏎ `w : [$sq]` は通る（`?` の定義は本体を解かずに L）。R54 から出た物ではない。
	["w : [sq : z ? w ⏎ $sq]（値を含む輪。HEAD から同じ）", std(["w : [sq : z ? w", "$sq]"]), "name-cycle"],
	// 2026-10-26 の R80（§5 Q10 の答え）で、枝の無い本体の局所の関数を裸で書いた所（`sq x`・`$[sq double]`）は右辺の種類で通った（いちばん後ろの「R80〜R82」の節）。
	// 局所の定義として読めない所（枝のある本体・同じ範囲に2つ）は未知で G7 だった。寄せ1（R128）から sq は未定義の名前（`_`）で、枝のある本体の `sq x` は通る
	// （上の oneFnPasses）。`$[sq double]` は値 `_` の上に積まれて余った double で、ファイルに書いた `$[zz double]`（zz は未定義の名前）と同じ R59 の G20。
	["寄せ1 同じ条件 sq の枝2つの後の $[sq double]（ファイルの `$[zz double]` と同じ R59 の G20。前は G7）", trial(["tt : x ?", "\tsq : z ? z * z", "\tsq : inc", "\t$[sq double]"]), "G20"],
	["寄せ1 その比べの相手（ファイルの $[zz double]、zz は未定義の名前）", trial("$[zz double]"), "G20"],
	// 2引数の局所の関数を map に渡すのは、ファイルの `map $add vs` と同じく実体の `[@f,]` で G7（R50）
	// 片イ（R120）で、この行は上の oneFnPasses へ移した。
];
for (const [name, s, want, kind, extra] of oneFnPasses) checkPass(`1つの関数 ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of oneFnRefused) checkRefused(`1つの関数 ${name}`, s, want, inst);
// G20 の言い分：局所の名前は言い切れない理由を言う。後置の印の形はデータの番地（§5 Q54）を言わない。
const dollarOneMessages = [
	// 「局所の輪は右辺を解く途中と §5 Q10 を言う」「同じ範囲に2つ」「入れ子の括りの中だけ」「枝のある本体は match_case と §5 Q10 を言う」「外の名前と同じ名前の
	// 行は隠しと §5 Q10 を言う」「局所の名前を裸で書いた別名は §5 Q10 を言う」（どれも関数の本体の行の局所の名前の言い分）は、2026-11-04 の寄せ1（R128）で
	// 本体に局所の定義が無くなり、どの形も通る（上の oneFnPasses の「寄せ1」の行）ので外した。
	// 「局所の値は Q54 を言う」（`\tv : 5` ⏎ `\tmap $v x`）は、2026-10-25 の R60 で `$v` が通るので外した（上の oneFnRefused の行と、下の「R58〜R61」の節）。
	["括りの中の名前は欄かもしれないと §5 Q10 を言う", std(["[sq : z ? z * z", "$sq]"]), ["括り", "欄", "§5 Q10"], ["§5 Q54", "右辺を解いている途中"]],
	["後置の印は R57 を言い、Q54 は言わない", std("$vs~"), ["後置の印", "R57"], ["§5 Q54"]],
	// 括った名前も名前の理由を言う。前の綴り `$[zz]`（未定義の名前は値、R21）は 2026-10-25 の R60 で値を読む参照として通るので、取り込みのある範囲の名前で見ていた。
	// 2026-10-27 の片8 の R99 から、取り込みのある範囲の名前も持ち上げで通るので、名前の読みが決まらない所（隠し）を括った綴りで見ていた。寄せ1（R128）で本体の
	// 隠しの行は無くなった（枝の条件）ので、名前の読みが決まらない所に残る括りの中の名前（local-field）を括った綴りで見る。
	["括った名前も名前の理由を言う", std(["[sq : z ? z * z", "$[sq]]"]), ["括り", "欄", "§5 Q10", "Q78"], ["`null`", "1つの Reader"]],
];
for (const [name, s, must, mustNot] of dollarOneMessages) {
	total++;
	try {
		resolve(s);
		fail(`1つの関数 言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if (e.gate === "G20" && !missing.length && !extra.length) ok(`1つの関数 言い分 ${name}`);
		else fail(`1つの関数 言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}

// ---------------------------------------------------------------------------
// R58〜R61（2026-10-25、§7.33）：合成に来た流れは合成全体の口で受ける・`$[…]` の中で余る関数は G20・`$` は Reader と Writer を作る接頭辞・`,` の中の `_`
// ---------------------------------------------------------------------------
//
// sid は 533071da。U の時刻は UTC。答えの変わった上の節の行は、行の注と名前に前の答えを書いて、ここへ移した。
// - R58（§5 Q58 の答え）：主の Claude の問い「合成に入った流れは、合成全体を1つの関数として口の数で受ける、でいい？」（10:06 UTC）に、利用者は主の Claude が
//   用意したボタン「合成全体で受ける」を選んだ（U〔答え〕[2026-10-25 14:39 533071da]。ボタンの文は主の Claude の物：「合成は1つの関数なので、撒いた流れは
//   合成全体の口の数で受ける（2つなら畳み込み、1つなら書き下し、3つ以上は G19）。」）。`inc add vs~` は g(x, y) = add (inc x) y の畳み込み（値は 8）、
//   `add inc vs~` は g(x, y) = inc (add x y)（値は 8）、`inc double vs~` は書き下し、`inc f3 vs~` は G19。書き並べた `inc add 1 2 3` は今までどおり。
// - R59（§5 Q53 の答え）：U [2026-10-25 07:42 533071da]「Q53は、逆適用が無くなったから危険な形式になったと思う。多分2つの関数を$で括ってるよね？」。
//   主の Claude の案「`$[…]` の中のどこかで値の上に積まれて余る関数があれば、中身は1つの関数と言い切れないので G20」に、U〔答え〕[2026-10-25 07:48
//   533071da]「Q53はそれで閉じれる。大丈夫！」。名前を通した `$p`（p の右辺・本体に余る関数）も断るのは、断る側に倒した細かい所（§5 Q62）。
// - R60（§5 Q54 の答え）：U [2026-10-25 07:51 533071da]「…$ は Reader と Writer のための単なる接頭辞として、それが偶々アドレスを渡すと読むと同じ読みが
//   出来るだけと読み替えるとおもしろいはずだ。」。主の Claude の問い「`$` を Reader と Writer を作る接頭辞と読み替えて、`$値` も参照として通す（Q54 は
//   これで閉じる）、でいい？」に、U〔答え〕[2026-10-25 08:37 533071da]「それで不都合が起きなければ。 / 細かい問題が起きるなら、もう一度圏論的な視点を。」。
//   `$値` は値を読む参照（A、指す値の印 vref）。Reader を値の演算子に置く形は断る（G7、§5 Q59）。`$v` の輪は今のまま name-cycle（§5 Q60）。
// - R61（§5 Q41 の答え）：U [2026-10-25 08:41 533071da]「Q41 / _ , 5 も 5 , _ も 5 になるはずだ。」。書いた `_` と恒等射の積（`_ , !_`）は残る物が割れる
//   ので G7（§5 Q61）。
// - 法則は coproduct_laws.test.js の法則19（R58：`g : F G` ⏎ `g X~` と `F G X~`）、法則17・18（R60：値の先）、法則12（R61：`X , _`・`_ , X`）。
const QR = ["f2 : x y ? x - y", "io1 : [say] ? say 21", "tl : [y ~ys] ? ys"];
const r58Passes = [
	["R58 inc add vs~（合成全体の口が2つの畳み込み、値は 8。前は G19、§5 Q58）", trial("inc add vs~"), "(apply (compose inc add) vs~)", "A"],
	["R58 inc add [1 2]~（値は add (inc 1) 2 の 4。前は G19）", trial("inc add [1 2]~"), "(apply (compose inc add) [1 2]~)", "A"],
	["R58 inc add vs~ 5（畳み込みの値の後ろに 5 を積む。前は G19）", trial("inc add vs~ 5"), "(construct (apply (compose inc add) vs~) 5)", "A"],
	["R58 g2 : inc add ⏎ g2 vs~（名前にした合成も同じ答え）", trial(["g2 : inc add", "g2 vs~"]), "(apply g2 vs~)", "A"],
	["R58 (inc add) vs~（括った合成も同じ答え）", trial("(inc add) vs~"), "(apply [inc add] vs~)", "A"],
	["R58 inc add 1 2 3（書き並べた実引数は今までどおり流れる。値は 4 3）", trial("inc add 1 2 3"), "(construct (apply add (construct (apply inc 1) 2)) 3)", "A", { leftover: true }],
	["R58 [x ? x] add [5]~（単位律：`add [5]~` と同じ、要素1つの畳み込みで 5。前は G19）", trial("[x ? x] add [5]~"), "(apply (compose [x ? x] add) [5]~)", "A"],
	["R58 [x ? x] add vs~（前は G19）", trial("[x ? x] add vs~"), "(apply (compose [x ? x] add) vs~)", "A"],
	["R58 kk : g [~l] ? @g add [5]~ 3 ⏎ kk $i 0（前は G19）", trial(["i : !_", "kk : g [~l] ? @g add [5]~ 3", "kk $i 0"]), "(: kk (? [g [~l]] (inst $L N (construct (apply (compose @g add) [5]~) 3))))", null, { at: -2 }],
	["R58 kk : g [~l] ? @g add vs~ ⏎ kk $!_ 0（`!_ add vs~` と同じく畳み込み。前は G19）", trial(["kk : g [~l] ? @g add vs~", "kk $!_ 0"]), "(: kk (? [g [~l]] (inst $L N (apply (compose @g add) vs~))))", null, { at: -2 }],
	["R58 cm : inc add ⏎ fold $cm vs（実体の中の `@f h~` の合成も合成全体で畳む。前は G19）", trial(["cm : inc add", "fold $cm vs"]), "(apply fold (construct $cm vs))", "A"],
	["R58 fold $[inc add] vs（同じ）", trial("fold $[inc add] vs"), "(apply fold (construct $[inc add] vs))", "A"],
	// 2026-10-26 の R74（§5 Q13 の答え）から、頭の恒等射は単位律で消えて、木も `inc add vs~` と同じ（前は `(compose i inc add)`）。
	["R58 i : !_ ⏎ i inc add vs~（恒等射が渡した流れも合成全体で受ける。単位律の `inc add vs~` と同じ。前は G19。R74 で i が消える）", trial(["i : !_", "i inc add vs~"]), "(apply (compose inc add) vs~)", "A"],
	["R58 !_ inc add vs~（同じ）", trial("!_ inc add vs~"), "(apply (compose inc add) vs~)", "A"],
	["R58 io1 (inc double vs~)（合成全体の書き下しの余りを積んだ形は `[A…]`。前は形の見えない A で G7）", trial([...QR, "io1 (inc double vs~)"]), "(apply io1 [inc double vs~])", "A"],
	["R58 その io1 の実体は `[A…]`", trial(["io1 : [say] ? say 21", "io1 (inc double vs~)"]), "(: io1 (? [[say]] (inst [A…] (construct say 21))))", null, { at: -2 }],
	// 流れを受ける段が後ろの組（前の組が閉じた後）でも、合成全体が流れを受けたので、木は流れを合成全体に当てた書いた順の綴り（closeWhole の印 whole）。
	["R58 inc add 5 f2 vs~（受ける段 add の後ろに f2。合成全体の口は 2。前は G19）", trial([...QR, "inc add 5 f2 vs~"]), "(apply (compose (apply (compose inc add) 5) f2) vs~)", "A"],
	["R58 f3 1 inc add 2 vs~（受ける段 f3 の残りの口1つと add の口で、合成全体の口は 2）", trial("f3 1 inc add 2 vs~"), "(apply (compose (apply f3 1) inc add) (construct 2 vs~))", "A"],
	// 空の流れと要素1つの流れの畳み込み（R51 の R の所と同じ読み）。
	// 空の流れは 2026-10-27 の R84 から書いた `_` と同じ（末尾の `_` は消えて合成が残り、根で `_` と知らせる）。前は合成全体の畳み込みで `(apply (compose inc add) []~)`。
	["R58 inc add []~（空の流れは書いた `_` と同じ、R84。前は畳み込みの `_`）", trial("inc add []~"), "(unit (compose inc add))", "A", { leftoverDiag: ["(compose inc add)"] }],
	["R58 inc add [5]~（要素1つの畳み込みは関数を当てずに 5、R51 の R の所）", trial("inc add [5]~"), "(apply (compose inc add) [5]~)", "A"],
	["R58 uu add vs~（頭の根が未知の合成の畳み込みは未知）", trial("uu add vs~"), "(apply (compose uu add) vs~)", "未知"],
	["R58 inc ([<<] 1) vs~（1つ当てた畳まない点なしは口1つ。合成全体の口も1つの書き下し）", trial("inc ([<<] 1) vs~"), "(apply (compose inc [[<<] 1]) vs~)", "A", { pfInfo: "[<<]" }],
	// 片イ（R120）：未知の畳み込みの後ろの項は積む予想（前は G2(a)）。
	["R58 uu add vs~ 5（未知の畳み込みの後ろに項）（前は G2(a)）", trial("uu add vs~ 5"), "(construct (apply (compose uu add) vs~) 5)", "未知"],
];
const r58Refused = [
	["R58 add add vs~（合成全体の口が3つ。G19、§5 Q46）", trial("add add vs~"), "G19"],
	["R58 inc tl vs~（後ろの段が可変長の口。G19）", trial([...QR, "inc tl vs~"]), "G19"],
	["R58 inc [<<] vs~（合成全体を畳むと畳まない2項の点なしで畳む。G19、§5 Q49）", trial("inc [<<] vs~"), "G19"],
	// `uu add vs~ 5`（G2(a)）は片イ（R120）で上の r58Passes へ移した。
	// `inc double []~`（合成全体の書き下しの空の流れ。G19、§5 Q57 の (a)）は、2026-10-26 の R70 で余ったラムダの `_` になり通る（いちばん後ろの「R64〜R72」の節）。
];
for (const [name, s, want, kind, extra] of r58Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r58Refused) checkRefused(name, s, want, inst);

const r59Passes = [
	// 括りの関数の本体は呼ばれるまで読まない（R25）ので、書いた所では余る関数を見ない（呼んだ所の実体で知らせる）。
	["R59 $[[x] ? x inc]（括りの関数の本体は読まない、R25）", std("$[[x] ? x inc]"), "$[[x] ? x inc]", "A"],
	// 恒等射は余っても落としても値が同じなので拾わない（R48 の知らせと同じ）。
	["R59 $[add (5 !_)]（余るのが恒等射なら通る）", std("$[add (5 !_)]"), "$[add [5 !_]]", "A"],
	["R59 p : add (5 inc) ⏎ p 3（`$` の無い名前は今までどおり、定義の行で知らせる）", std(["p : add (5 inc)", "p 3"]), "(apply p 3)", "A", { leftoverDiag: ["inc"] }],
	// 2026-11-04 の寄せ1（R128）：本体の `⇥lf : …` は条件 lf（未定義の名前）の枝で、`$lf` は本体の行を見ずに零射の番地（細目7）。右辺は枝の値（返す所）で、
	// 残った関数は `(unit …)` と bare-function-return（中で余る inc は leftover-lambda）。前は R80 の局所の定義の右辺を辿って G20（下の r59Refused にあった）。
	["R59 本体の lf : add (5 inc) の枝の後の $lf（寄せ1 から零射の番地。前は G20）", trial(["tt : x ?", "\tlf : add (5 inc)", "\t$lf"]), "(: tt (? [x] (block (: lf (unit (apply add [5 inc]))) $lf)))", null, { leftoverDiag: ["inc"], severities: ["information/bare-function-return", "information/undefined-name", "warning/leftover-lambda"] }],
	["R59 本体の lf : z ? z inc の枝の後の $lf（寄せ1 から零射の番地。前は G20）", trial(["tt : x ?", "\tlf : z ? z inc", "\t$lf"]), "(: tt (? [x] (block (: lf (unit (? [z] (construct z (unit inc))))) $lf)))", null, { leftoverDiag: ["inc"], severities: ["information/bare-function-return", "information/undefined-name", "warning/leftover-lambda"] }],
];
const r59Refused = [
	["R59 $[add (5 inc)]（前は通って inc を知らせた。§5 Q53）", std("$[add (5 inc)]"), "G20"],
	["R59 p : $[add (5 inc)]（前は通って知らせた）", std("p : $[add (5 inc)]"), "G20"],
	["R59 p : $[f3 (5 inc)]", std("p : $[f3 (5 inc)]"), "G20"],
	["R59 p : $[add ||5 inc||]（囲みの中）", std("p : $[add ||5 inc||]"), "G20"],
	["R59 p : $[add [k : 5 inc]]（欄の右辺）", std("p : $[add [k : 5 inc]]"), "G20"],
	["R59 use $[add (5 inc)] 3（前は未知の根で通って知らせた）", std("use $[add (5 inc)] 3"), "G20"],
	["R59 $[x ? x inc]（`?` の本体。前は通って知らせた）", std("$[x ? x inc]"), "G20"],
	["R59 p : $[x ? x inc]（前は通って知らせた）", std("p : $[x ? x inc]"), "G20"],
	["R59 p : $[x ? 5 inc]", std("p : $[x ? 5 inc]"), "G20"],
	// 名前を通した `$`（§5 Q62。名前は右辺を指すので `$[右辺]` と同じ先。断る側に倒した細かい所）。
	["R59 p : add (5 inc) ⏎ $p（右辺に余る関数。前は通った。§5 Q62）", std(["p : add (5 inc)", "$p"]), "G20"],
	["R59 p : add (5 inc) ⏎ $[p]（[x] ≅ x）", std(["p : add (5 inc)", "$[p]"]), "G20"],
	["R59 p : add (5 inc) ⏎ q : p ⏎ $q（別名は右辺の名前の物を引き継ぐ）", std(["p : add (5 inc)", "q : p", "$q"]), "G20"],
	["R59 sq : x ? x inc ⏎ $sq（本体に余る関数。前は通った）", std(["sq : x ? x inc", "$sq"]), "G20"],
	// 本体の局所の `lf : add (5 inc)`・`lf : z ? z inc` の `$lf`（G20）は、寄せ1（R128）で本体に局所の定義が無くなり、上の r59Passes へ移した。
];
for (const [name, s, want, kind, extra] of r59Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r59Refused) checkRefused(name, s, want, inst);

// R60：先が値の `$` は値を読む参照（R53〜R57 では G20、その前は A。行の名前の「前は」は R53 の前の答え、「R53 は」は R53〜R57 の答え）。
const r60Passes = [
	["R60 $vs（値の定義。R53 は G20、前は A）", std("$vs"), "$vs", "A"],
	// 2026-10-28 の片9b の確かめの直し：R111 から未定義の名前は `_` で、`$zz` は `$un` と同じ零射の番地（R100 の警告を出さない）。行の名前の前の「値で、その参照」は R21・R60 の
	// 読みで、R111 の行（`$no`）と逆を言っていたので直し、警告が出ないこと（診断は undefined-name の1つ）も見る。
	["R60 の行だった $zz（R111 で `$un` と同じ零射の番地。information は今までどおり、警告は出さない。R53 は G20）", std("$zz"), "$zz", "A", { diag: "zz", diagCount: 1 }],
	["R60 [$vs,]（写す F が値なので写像にならず未知の根。R53 は G20）", std("[$vs,]"), "[$vs,]", "未知"],
	["R60 p : $inc ⏎ $p（番地を読む参照。R53 は G20、前は A）", std(["p : $inc", "$p"]), "$p", "A"],
	["R60 tw : f [~t] ? map $f t ⏎ tw $inc vs（STD の map の本体は x で、`$f` は番地を読む参照。R53 は G20、前は G7）", std(["tw : f [~t] ? map $f t", "tw $inc vs"]), "(apply tw (construct $inc vs))", "A"],
	["R60 gg : f ? $f（素の関数の裸の仮引数の参照。R53 は G20、前は通った）", std("gg : f ? $f"), "(: gg (? [f] $f))", "A"],
	// 2026-10-26 の R81 から、use は値を読む参照 `$s` の印で実体を作り、`@f 1` は 5 と 1 の構築で A（前は use の本体の根が未知で未知の根）。
	["R60 hb : [s] ? use $s 1 ⏎ hb [s : 5]（欄で数を受けた s の参照。R81 で A。前は未知の根、R53 は G20）", std(["hb : [s] ? use $s 1", "hb [s : 5]"]), "(apply hb [s : 5])", "A"],
	["R60 その hb の実体", std(["hb : [s] ? use $s 1", "hb [s : 5]"]), "(: hb (? [[s]] (inst {s:N} (apply use (construct $s 1)))))", null, { at: -2 }],
	["R60 $[1 2]（構築の参照。R53 は G20）", std("$[1 2]"), "$[1 2]", "A"],
	// 書いた `$(n , 99)`（積の参照、A）は、2026-10-27 の片8 の R101（書いた `,` の積の `$` は断る）で G20（いちばん後ろの「R99〜R104」の節）。名前を通した積は、
	// 名前の先の値の持ち上げで通る（R100 の警告）ので、その綴りで積の参照を見る。
	["R60 pq9 : 5 , 99 ⏎ $pq9（積の参照。書いた `$(n , 99)` は片8 の R101 で G20）", std(["pq9 : 5 , 99", "$pq9"]), "$pq9", "A"],
	["R60 $[vs]（[x] ≅ x で `$vs` と同じ）", std("$[vs]"), "$[vs]", "A"],
	["R60 $[inc 5]（足りた適用の値の参照）", std("$[inc 5]"), "$[inc 5]", "A"],
	["R60 $[zz 5]（zz は未定義の名前で R111 の `_` と分かる値。`$[…]` の中身は評価する所でないので、値の隣でも消えずに構築の参照のまま、§5 Q83）", std("$[zz 5]"), "$[zz 5]", "A", { diag: "zz" }],
	["R60 $[]（空の括りの参照）", std("$[]"), "$[]", "A"],
	// 字面の `$5`・`$[1 2]`：置き場所の無い値の Reader（定数のサンク）として通す（R60 の細かい所。主の Claude の 08:38 UTC の見当のとおり）。
	["R60 $5（字面の参照。R53 は G20、前は未知の根）", std("$5"), "$5", "A"],
	["R60 $5 , 1（R53 は G20、前は A）", std("$5 , 1"), "(, $5 1)", "A"],
	["R60 p : $5 ⏎ p", std(["p : $5", "p"]), "p", "A"],
	["R60 $5 1（参照は1つの値。R53 は G20、前は G7）", std("$5 1"), "(construct $5 1)", "A"],
	["R60 $0x10", std("$0x10"), "$0x10", "A"],
	["R60 $`ab`", std("$`ab`"), "$`ab`", "A"],
	["R60 $$inc（番地を読む参照。R53 は G20）", std("$$inc"), "$$inc", "A"],
	["R60 q : $$inc", std("q : $$inc"), "(: q $$inc)", "A"],
	["R60 $$vs", std("$$vs"), "$$vs", "A"],
	["R60 $|5|", std("$|5|"), "$|5|", "A"],
	["R60 $-5", std("$-5"), "$-5", "A"],
	["R60 $!5", std("$!5"), "$!5", "A"],
	// `#` は書く（Writer の tell・State の put）。09-30 の項目9（構造体の番地へ Int を書く形は断る）は構造体の話で、ここは数を数へ書く形。
	["R60 p5 : 5 ⏎ q : $p5 ⏎ q # 7（参照へ書く。R53 は G20、前は通った）", std(["p5 : 5", "q : $p5", "q # 7"]), "(# q 7)", "A"],
	// `@p`（p は値の参照）で開いた形は、指す値を読む。開いた後の並びは今の規則のまま。
	["R60 rd : f [~t] ? @f ⏎ rd $vs 0（`@f` は vs を読む）", trial(["rd : f [~t] ? @f", "rd $vs 0"]), "(apply rd (construct $vs 0))", "A"],
	["R60 その rd の実体（形 `$[N…]`。指す値の形が鍵に入る）", trial(["rd : f [~t] ? @f", "rd $vs 0"]), "(: rd (? [f [~t]] (inst $[N…] N @f)))", null, { at: -2 }],
	["R60 rd : f [~t] ? @f 1 ⏎ rd $vs 0（開いた後の並びは今の規則のまま。vs と 1 の構築）", trial(["rd : f [~t] ? @f 1", "rd $vs 0"]), "(apply rd (construct $vs 0))", "A"],
	// 実体の鍵：指す値の形が鍵に入る（入らないと `rd2 $st 0` と `rd2 $vs 0` が実体を分け合い、先に解いた方の答えを後の方が黙って使う）。
	["R60 鍵 rd2 $st 0 ⏎ rd2 $vs 0 の2行目は未知（List からは名前の鍵で引けない）", trial(["rd2 : f [~t] ? @f ' k", "st : [k : 1]", "rd2 $st 0", "rd2 $vs 0"]), "(apply rd2 (construct $vs 0))", "未知"],
	["R60 鍵 rd2 $vs 0 ⏎ rd2 $st 0 の2行目は A（構造体の欄 k）", trial(["rd2 : f [~t] ? @f ' k", "st : [k : 1]", "rd2 $vs 0", "rd2 $st 0"]), "(apply rd2 (construct $st 0))", "A"],
	["R60 本体の局所の v : 5 ⏎ $v（局所の値の参照。R54 の片は G20）", trial(["tt : x ?", "\tv : 5", "\t$v"]), "(: tt (? [x] (block (: v 5) $v)))", "A"],
	["R60 $[_ , 5]（中身は R61 で 5、その参照）", std("$[_ , 5]"), "$[_ , 5]", "A"],
	// 片イ（R120）：写す関数の所が値を読む参照（`@f` が vs・`$f` の番地）の `[@f,]` は種類の未知な項で、map の実体で断らない（前は G7）。`$` の warning は今のまま。
	["R60 map $vs vs（R53 は G20）（前は実体の `[@f,]` で G7）", trial("map $vs vs"), "(apply map (construct $vs vs))", "未知", { severities: ["warning/dollar-non-function"] }],
	["R60 tw : f [~t] ? map $f t ⏎ tw $inc vs（番地を読む参照を写す関数に置く。R53 は G20）（前は G7）", trial(["tw : f [~t] ? map $f t", "tw $inc vs"]), "(apply tw (construct $inc vs))", "未知", { severities: ["warning/dollar-non-function"] }],
];
const r60Refused = [
	// 細かい所（§5 Q59）：Reader は数ではない。項の `$` も、`$` を指す名前（`:` はメタ）も。
	// 2026-10-26 の R62（§5 Q59 の答え）から、関数を指す番地は今のまま G7（1つの関数と言い切れる番地を動かす・比べるのは R53 の外）。値を読む参照は
	// 番地の点で、`$vs == $vs`（点どうしの比べ）は通る（下の「R62・R63」の節の通る側へ移した）。数と混ぜた `$5 < 3`・`q * 2` は G21（Address と Int は
	// 混ぜない。前は G7）。
	["R60 $inc + 1（前は A）", std("$inc + 1"), "G7"],
	["R60 $inc == $inc（前は A）", std("$inc == $inc"), "G7"],
	["R62 $5 < 3（数と混ぜた比べ。R60 の片は G7）", std("$5 < 3"), "G21"],
	["R62 p : $vs ⏎ q : p ⏎ q * 2（名前を通した点に数を掛ける。R60 の片は G7）", std(["p : $vs", "q : p", "q * 2"]), "G21"],
	// `map $vs xs`：`@f` が値なので、写像の所で断る（今のまま G7 でよい、の見当のとおり）。
	// 片イ（R120）で、`map $vs vs` と `tw $inc vs` の2行は上の r60Passes へ移した。
	// 言い切れない物は今のまま G20。
	["R60 w : vs~ ⏎ $w（撒いた形を指す名前）", std(["w : vs~", "$w"]), "G20"],
	["R60 $[vs~]（[x] ≅ x で `$vs~` と同じ。R57）", std("$[vs~]"), "G20"],
	["R60 $[5!]（[x] ≅ x で `$5!` と同じ。R57）", std("$[5!]"), "G20"],
	// `$v` の輪（§5 Q60）：Reader は v をその場で評価しないので輪にならない読みもあるが、`$v` が v の種類（関数か・値か・未知か）を引く今の作りでは、
	// 通すのが一意に言えないので、今のまま name-cycle。
	// 名前は §5 Q30 の `v : f 1`・`f : x ? x , $v` と同じ形（STD の仮引数 f と重ならないように f9 にした）。
	// `v : f9 1` ⏎ `f9 : x ? x , $v`（今のまま name-cycle、§5 Q60）は、2026-10-26 の R73（§5 Q60 の答え：Reader は v をその場で評価しない）で通る（いちばん後ろの
	// 「R73〜R79」の節へ移した）。
];
for (const [name, s, want, kind, extra] of r60Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r60Refused) checkRefused(name, s, want, inst);

const r61Passes = [
	["R61 5 , _（前は `(, 5 _)`）", std("5 , _"), "5", "A"],
	["R61 1 , _ , 2（前は `(, 1 (, _ 2))`）", std("1 , _ , 2"), "(, 1 2)", "A"],
	["R61 _ , _（両方とも書いた `_`。前は `(, _ _)`）", std("_ , _"), "_", "A"],
	["R61 _ , _ , 5", std("_ , _ , 5"), "5", "A"],
	["R61 _ , inc 1（片方が `_` なら G3 の割れも消える。前は G3）", std("_ , inc 1"), "(apply inc 1)", "A"],
	["R61 inc 1 , _（前は G3）", std("inc 1 , _"), "(apply inc 1)", "A"],
	["R61 v : 5 , _ ⏎ v 3（名前の右辺の `,` も）", std(["v : 5 , _", "v 3"]), "(construct v 3)", "A"],
	// 消えるのは書いた `_`（印）だけで、名前や括りを通した `_` は閉じた1つの項（R56 の R の所の並びの中と同じ）。
	["R61 un : _ ⏎ un , 5（名前の `_` は消えない）", std(["un : _", "un , 5"]), "(, un 5)", "A"],
	["R61 (_) , 5（括った `_` は消えない）", std("(_) , 5"), "(, [_] 5)", "A"],
	["R61 $[_ _]（中の行が `_` に縮む。零射、R56）", std("$[_ _]"), "$[_ _]", "A"],
	["R61 $[_ , _]（同じ）", std("$[_ , _]"), "$[_ , _]", "A"],
	// 片イ（R121）で G3 は廃止：`2 , _ , inc 1` は `2 , inc 1` と同じく左から畳んで通る（前は G3）。
	["R61 2 , _ , inc 1（`2 , inc 1` と同じ）（前は G3）", std("2 , _ , inc 1"), "(, 2 (apply inc 1))", "A"],
	// 片イ（R120）：io1 の本体の `say 21` は種類の未知な say の後ろに積む予想で通る（前は G7）。流れの数が 1 なことは、io1 の実体の形 `A`（`[1 _ 2]~` なら `[A…]`）で見る。
	["R61 io1 (inc [1 , _]~) の io1 の実体は A（流れの数は 1。前は2つで `[A…]`）（前は G7）", trial([...QR, "io1 (inc [1 , _]~)"]), "(: io1 (? [[say]] (inst A (construct say 21))))", null, { at: 10 }],
];
const r61Refused = [
	// 書いた `_` と恒等射の積は、どちらが消えるかで残る物が割れる（§5 Q61、圏論の視点で見直す所）。R45 の片では恒等射が消えて `_`。
	// `_ , !_`・`!_ , _`・`_ , i`・`$[_ , !_]`（G7）は、2026-10-26 の R71（§5 Q61 の答え：`_` に落とす）で通る（いちばん後ろの「R64〜R72」の節）。
	// 中の `,` の `_` が消えて残った並びにも、外の `,` の G3 が当たる（R45 の `2 , !_ , inc 1` と同じ）。
	// 流れの数は木に付いてくる：`[1 , _]` は `[1]` と同じ1つなので、書き下しの余りが無く、`io1 (inc 1)` と同じ G7（`[1 _ 2]~` は余りがあって `[A…]` で通る）。
	// 片イ（R121・R120）で、`2 , _ , inc 1`（G3）と `io1 (inc [1 , _]~)`（G7）は上の r61Passes へ移した。
];
for (const [name, s, want, kind, extra] of r61Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r61Refused) checkRefused(name, s, want, inst);
// 言い分：R58 の G19 は R58 と §5 Q46、R59 の G20 は §5 Q53（名前の先は Q62 も）、R60 の G7 は §5 Q59、R61 の G7 は §5 Q61 を名指しする。
// 2026-10-26 の R62 から、R60 の G7 は関数を指す番地だけで、R62 を名指しする（`$vs - $vs` は差で通るので、関数を指す番地 `$inc - 1` に替えた）。
const r58to61Messages = [
	["R58 合成全体の口が3つ", trial("inc f3 vs~"), "G19", ["合成全体", "R58", "§5 Q46"], ["Q58"]],
	["R59 中身に余る関数", std("$[add (5 inc)]"), "G20", ["`inc`", "R59", "§5 Q53"], ["Q62"]],
	["R59 名前の先に余る関数", std(["p : add (5 inc)", "$p"]), "G20", ["名前 `p`", "Q62"], []],
	["R60 関数を指す番地を値の演算子に（R62 の片から。前は `$vs - $vs` の Reader の言い分）", std("$inc - 1"), "G7", ["関数を指す番地", "§4 R53", "§4 R62"], ["Q54", "Q59"]],
	// 「R61 書いた `_` と恒等射の積」（`_ , !_` の G7 の言い分）は、2026-10-26 の R71 で `_ , !_` が通るので外した。
];
for (const [name, s, gateId, must, mustNot] of r58to61Messages) {
	total++;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if (e.gate === gateId && !missing.length && !extra.length) ok(`言い分 ${name}`);
		else fail(`言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}

// ---------------------------------------------------------------------------
// R58〜R61 の確かめの直し（2026-10-25、§7.34）：Reader の門は綴りに依らない・`$[…]` の中身は単位律で縮めて見る・括りの関数の本体の仮引数を含まない行・
// 枝で選ぶ括り・実体で渡された形の見えない値・撒いた Reader・名前の先の本体を覗くのは木を残す段だけ
// ---------------------------------------------------------------------------
//
// 確かめる人と反証する人（2026-10-25）の指摘を1つずつ走らせて、本当だった物を直した。決まらない所は断る側に倒し、§5 Q59・Q62・Q64・Q65 に書いた。
// - Reader を値の演算子に置く形（§5 Q59）：前は中置の項の所だけで断り、区間・点なし・絶対値・値の印・素の関数の口（β で `inc $5` は `$5 + 1`）は通った。
//   素の関数の口は、本体を解く所で裸の仮引数に札を付け、値の演算子に届くかを覚えて見る（resolve.js の paramTag）。届かない所（返した値・器の中身・
//   括りの関数の口へ本体から渡した物）は §5 Q59 に名指しした。
// - `$[…]` の中身が単位律（R44・R45・R61）と [x] ≅ x で1項に縮むなら、その項で R57（後置の印・撒いた形）と R59（名前の先の余る関数）を見る。
// - 括りの関数の本体（R25 で読まない）のうち、仮引数を含まない行は、どの実体でも同じ読みなので R59 で読む（§5 Q65 に残りの形）。
// - 枝で選ぶ括り `$[5 > 1 : inc]`（形の綴り `A(U)`）は、`&`・`|` の綴りと同じく G20。
// - 括りの関数の実体で渡された形の見えない値の `$s`（`h [s : _]`）は、R56 の R の所が断る側に残した G20 に戻す（§5 Q64）。
// - 撒く物が Reader（`[$vs]~`・`[$inc]~`・`p : $inc` ⏎ `p~`）は、[x] ≅ x と `:` はメタで `$vs~`・`$inc~` と同じ G20（R57）。
// - 名前の先の本体を覗く所（R59、§5 Q62）は、解いている途中の種類が無い所（木を残す段）だけ：途中で覗くと `p : $sq` ⏎ `sq : x ? use p x` が name-cycle に
//   なった（R59 の片の書く人の版の断りすぎ。HEAD は通す）。行の名前の「前の版」は、この片の書く人の版。
// 嘘か、今のままにした指摘：名前を通した `_` の積（`un , 5`）は R15・R56 の「顔が位置で違う」の線で今のまま（§5 Q61 の注）。合成の途中の恒等射
// （`inc !_ add vs~`）は、書き並べの `inc !_ add 1 2` も G18 なので、断る側のまま（§5 Q58 の注）。
const reviewPasses = [
	// 2026-10-26 の R81 から、`$vs` の印で use の実体を作り、`@f 5` は vs と 5 の構築で A（前は use の本体の根が未知）。
	["確かめ use $vs 5（use の f は `@f` だけで、値の演算子に届かない。R81 で A、前は未知）", std("use $vs 5"), "(apply use (construct $vs 5))", "A"],
	["確かめ k1 $5 1（k1 の x は返すだけ）", std("k1 $5 1"), "(apply k1 (construct $5 1))", "A"],
	["確かめ [!_] $5（否定の点なしは値の演算子でない）", std("[!_] $5"), "(apply [!_] $5)", "A"],
	["確かめ [|] $5 1（論理の畳み込みは値の演算子でない。中置の `$5 | 1` と同じ）", std("[|] $5 1"), "(apply [|] (construct $5 1))", "A"],
	["確かめ p : $vs ⏎ !p（前置 `!` だけは否定）", std(["p : $vs", "!p"]), "!p", "A"],
	["確かめ ||$vs||（ノルムは今のまま）", std("||$vs||"), "||$vs||", "A"],
	["確かめ [' 0] $vs（段18 の点なしは値の演算子でない）", std("[' 0] $vs"), "(apply [' 0] $vs)", "未知"],
	// 届かない所（§5 Q59）。器の中身は、関数を器に入れた `(inc , 1) + 1` と同じく、値の演算子が直に見ない。
	["確かめ ($5 , 1) + 1（器の中身は届かない、§5 Q59）", std("($5 , 1) + 1"), "(+ [$5 , 1] 1)", "A"],
	["確かめ ff : x ? x ⏎ ff $5（返した値は届かない、§5 Q59）", std(["ff : x ? x", "ff $5"]), "(apply ff $5)", "A"],
	// 括りの関数の口へ本体から渡した物（`ff : x ? pq [1] x` ⏎ `ff $5`）は、2026-10-26 の R81 で ff が `$5` の印で実体を作るので届き、pq の実体の `y + a` が点と数の
	// G21（β の `pq [1] $5` と同じ。前は届かずに A で黙って通った）。断る側（いちばん後ろの「R80〜R82」の節）へ移した。
	["確かめ $[5 > 1 : 3]（枝で値を選ぶ括りは値を読む参照）", std("$[5 > 1 : 3]"), "$[5 > 1 : 3]", "A"],
	// 書いた `$(inc , 1)`（A）は、2026-10-27 の片8 の R101 で G20（いちばん後ろの「R99〜R104」の節）。名前を通した同じ器で見る。
	["確かめ fi : inc , 1 ⏎ $fi（形の見える器は値を読む参照。書いた `$(inc , 1)` は片8 の R101 で G20）", std(["fi : inc , 1", "$fi"]), "$fi", "A"],
	["確かめ $fs", std("$fs"), "$fs", "A"],
	// 2026-10-26 の R81 から、use は `$s` の印で実体を作るので A（前は use の本体の根が未知）。
	["確かめ hb : [s] ? use $s 1 ⏎ hb [s : vs]（実体で渡された形の見える値は通る。R81 で A、前は未知）", std(["hb : [s] ? use $s 1", "hb [s : vs]"]), "(apply hb [s : vs])", "A"],
	["確かめ hb : [s] ? use $s 1 ⏎ hb [s : $inc]（R81 で A、前は未知）", std(["hb : [s] ? use $s 1", "hb [s : $inc]"]), "(apply hb [s : $inc])", "A"],
	["確かめ $[[x] ? x inc]（仮引数を含む行は読まない、§5 Q65）", std("$[[x] ? x inc]"), "$[[x] ? x inc]", "A"],
	["確かめ bq : [x] ? f2 (5 inc) 1 ⏎ bq [1]（`$` の無い呼び出しは実体で知らせる）", std(["bq : [x] ? f2 (5 inc) 1", "bq [1]"]), "(apply bq [1])", "A", { leftoverDiag: ["inc"] }],
	// 名前の先の本体を覗くのは木を残す段だけ（R59 の片の書く人の版は、値の定義の右辺を解く途中で覗いて name-cycle にした）。
	// 2026-10-26 の R81 から、p の印（sq を指す番地）で use の実体を作り、`@f x` は sq の再帰（仮置き A で閉じる）で A（前は use の本体の根が未知）。
	["確かめ p : $sq ⏎ sq : x ? use p x ⏎ sq 1（`$` で自分を指す表を持つ再帰。前の版は name-cycle。R81 で A、前は未知）", std(["p : $sq", "sq : x ? use p x", "sq 1"]), "(apply sq 1)", "A"],
	["確かめ sq : x ? use p x ⏎ p : $sq ⏎ sq 1（並べ方を替えても同じ）", std(["sq : x ? use p x", "p : $sq", "sq 1"]), "(apply sq 1)", "A"],
	["確かめ hs : $h1 , 3 ⏎ h1 : x ? use (hs ' 1) x ⏎ h1 2（関数の表。前の版は name-cycle）", std(["hs : $h1 , 3", "h1 : x ? use (hs ' 1) x", "h1 2"]), "(apply h1 2)", "未知"],
	// 名前を通した `_` は、並びの中と同じく閉じた1つの項（R61 の R の所、R56 の「顔が位置で違う」）。今のまま。
	["確かめ un : _ ⏎ un , 5（今のまま、R61 の R の所）", std(["un : _", "un , 5"]), "(, un 5)", "A"],
	["確かめ un : _ ⏎ $[un , !_]（恒等射が消えて un、`$un` と同じ零射。今のまま）", std(["un : _", "$[un , !_]"]), "$[un , !_]", "A"],
	["確かめ add inc vs~（木と種類は前の版と同じ。値 8 は評価の段で決まる、§3.7）", trial("add inc vs~"), "(apply (compose add inc) vs~)", "A"],
	["確かめ [+] $5（畳む点なしに1項だけは演算を当てない、R31）", std("[+] $5"), "(apply [+] $5)", "未知"],
	// 並べ方で割れない（P2）：素の関数の裸の仮引数の札は実体に持ち込まない（持ち込むと、分け合った実体の本体を先に解いた本体の札だけに覚え、`gg $5` が
	// 並べ方で G7 と A に割れる。今は届かない所で、どちらも A、§5 Q59）。値の演算子の点なしかは実体の鍵に入れる（入れないと `$[|]` と `$[+]` が実体を
	// 分け合い、先に呼んだ方の答えを後の方が使う。下の断る側の2行）。
	// 2026-10-26 の R81 から、`gg $5` は gg が `$5` の印で実体を作り、hq の実体の `s + 1` が点と数の G21（β の `hq [s : $5]` と同じ。前は届かない所で A）。並べ方で
	// 割れないことは、断る側（いちばん後ろの「R80〜R82」の節の2行）で見る。
	["確かめ 並べ方 hf [1] $[|] だけ（論理の畳み込みは Reader を受けても通る）", std(["hf : [k] f ? @f $5 1", "hf [1] $[|]"]), "(apply hf (construct [1] $[|]))", "A"],
	// 片イ（R126）：合成の途中の恒等射は単位律で消え、書き並べの `inc !_ add 1 2` は `inc add 1 2`（`add (inc 1) 2`）と同じ木（前は G18）。
	["確かめ inc !_ add 1 2（書き並べ。`inc add 1 2` と同じ）（前は G18）", trial("inc !_ add 1 2"), "(apply add (construct (apply inc 1) 2))", "A"],
	// 2026-11-04 の寄せ1（R128）：本体の `⇥lq : p , !_` は条件 lq（未定義の名前）の枝で、`$lq` は本体の行を見ずに零射の番地（細目7）。枝の値に残った p は
	// 返す所の裸の関数で `(unit p)`。前は R80 の局所の定義の右辺を辿って p の余る関数で G20（下の reviewRefused にあった）。
	["確かめ 本体の lq : p , !_ の枝の後の map $lq x（寄せ1 から零射の番地。前は G20）", trial(["p : add (5 inc)", "tt : x ?", "\tlq : p , !_", "\tmap $lq x"]), "(: tt (? [x] (block (: lq (unit p)) (apply map (construct $lq x)))))", null, { diag: "lq" }],
];
const reviewRefused = [
	// Reader を値の演算子に置く形は、綴りに依らず G7（§5 Q59）。前の版は中置の項だけ。
	// 2026-10-26 の R62（§5 Q59 の答え）から、値を読む参照（`$vs`・`$5`・`p : $5` の p）は番地の点で、中置の外の綴り（区間・点なし・絶対値・値の印・
	// 素の関数の口・写像）で値の演算子に置けば G21（答えに点・差の印を持たせられないので、中置なら通る組も断る。§5 Q66）。行の門だけを G7 から G21 に
	// 替えた。関数を指す番地（`$inc`）の行は今のまま G7（R53 の外）。
	["確かめ [+ 1] $vs（前の版は A。R60 の確かめの片は G7）", std("[+ 1] $vs"), "G21"],
	["確かめ [1 +] $vs", std("[1 +] $vs"), "G21"],
	["確かめ [+] $vs 1", std("[+] $vs 1"), "G21"],
	["確かめ [-] $vs $vs（中置の `$vs - $vs` は差で通る。点なしは §5 Q66）", std("[-] $vs $vs"), "G21"],
	["確かめ [==] $5 $5（中置の `$5 == $5` は通る。点なしは §5 Q66）", std("[==] $5 $5"), "G21"],
	["確かめ [<<] $5 1", std("[<<] $5 1"), "G21"],
	["確かめ [-_] $vs", std("[-_] $vs"), "G21"],
	["確かめ [!!_] $5", std("[!!_] $5"), "G21"],
	["確かめ [_!] $5", std("[_!] $5"), "G21"],
	["確かめ [* 2,] $vs", std("[* 2,] $vs"), "G21"],
	["確かめ [-_,] $vs", std("[-_,] $vs"), "G21"],
	["確かめ [+ $5] 1（区間の被演算子）", std("[+ $5] 1"), "G21"],
	["確かめ [$5 +] 1", std("[$5 +] 1"), "G21"],
	["確かめ [- $5,] vs", std("[- $5,] vs"), "G21"],
	["確かめ $[+ $5]", std("$[+ $5]"), "G21"],
	["確かめ p : $5 ⏎ [+ 1] p", std(["p : $5", "[+ 1] p"]), "G21"],
	["確かめ |$vs|（絶対値）", std("|$vs|"), "G21"],
	["確かめ p : $vs ⏎ -p（値の印）", std(["p : $vs", "-p"]), "G21"],
	["確かめ p : $vs ⏎ !!p", std(["p : $vs", "!!p"]), "G21"],
	["確かめ p : $vs ⏎ p!", std(["p : $vs", "p!"]), "G21"],
	["確かめ [+ 1] $inc（HEAD から A だった）", std("[+ 1] $inc"), "G7"],
	["確かめ [+] $inc 1（HEAD から A だった）", std("[+] $inc 1"), "G7"],
	// 素の関数の口（β）。2026-10-26 から、番地の点は G21（素の関数の本体は裸の仮引数を番地と見ずに1回だけ解く。§5 Q66）。
	["確かめ inc $vs（素の関数の口）", std("inc $vs"), "G21"],
	["確かめ inc $5", std("inc $5"), "G21"],
	["確かめ inc $inc（HEAD から A だった）", std("inc $inc"), "G7"],
	["確かめ add $5 1", std("add $5 1"), "G21"],
	["確かめ add 1 $5（後ろの口）", std("add 1 $5"), "G21"],
	["確かめ [x ? x + 1] $5（無名の素の関数）", std("[x ? x + 1] $5"), "G21"],
	["確かめ p : $5 ⏎ inc p", std(["p : $5", "inc p"]), "G21"],
	["確かめ pa : b c ? b + c ⏎ pa $vs $vs", std(["pa : b c ? b + c", "pa $vs $vs"]), "G21"],
	["確かめ g9 : y ? inc y ⏎ g9 $5（別の素の関数の口を通って届く）", std(["g9 : y ? inc y", "g9 $5"]), "G21"],
	["確かめ ff : x ? [+ x] 1 ⏎ ff $5（本体の区間）", std(["ff : x ? [+ x] 1", "ff $5"]), "G21"],
	["確かめ ff : x ? $[y ? x + y] ⏎ ff $5（本体の中の `$` の中）", std(["ff : x ? $[y ? x + y]", "ff $5"]), "G21"],
	["確かめ p : add $5 ⏎ p 1（部分適用は足りた所で見る）", std(["p : add $5", "p 1"]), "G21"],
	["確かめ (add $5) 1", std("(add $5) 1"), "G21"],
	["確かめ f3 $5 !_ 2（穴の関数の実引数）", std("f3 $5 !_ 2"), "G21"],
	["確かめ [inc,] $5（Reader は [x] ≅ x で1つの要素）", std("[inc,] $5"), "G21"],
	["確かめ r9 : x ? r9 (x + 1) ⏎ r9 $5（再帰）", std(["r9 : x ? r9 (x + 1)", "r9 $5"]), "G21"],
	// 実体の本体の `[+] $5 1` で、点なしが受けた番地の点（2026-10-26 から G21）。行が見るのは実体を分け合わないこと（門は替えただけ）。
	["確かめ 並べ方 hf [1] $[|] ⏎ hf [1] $[+]（`$[+]` の実体は `$[|]` と分け合わない）", std(["hf : [k] f ? @f $5 1", "hf [1] $[|]", "hf [1] $[+]"]), "G21", [["hf", "N $L"]]],
	["確かめ 並べ方 hf [1] $[+] ⏎ hf [1] $[|]", std(["hf : [k] f ? @f $5 1", "hf [1] $[+]", "hf [1] $[|]"]), "G21", [["hf", "N $L"]]],
	// R59：括りの関数の本体の、仮引数を含まない行。
	["確かめ $[[x] ? f2 (5 inc) 1]（仮引数を含まない本体。前の版は通った）", std("$[[x] ? f2 (5 inc) 1]"), "G20"],
	["確かめ $[[x] ? f2 (5 inc) x]（仮引数を含まない括り）", std("$[[x] ? f2 (5 inc) x]"), "G20"],
	["確かめ bq : [x] ? f2 (5 inc) 1 ⏎ $bq", std(["bq : [x] ? f2 (5 inc) 1", "$bq"]), "G20"],
	["確かめ ub : [k] f x ? @f x ⏎ ub [1] $[[x] ? f2 (5 inc) 1] 5", std(["ub : [k] f x ? @f x", "ub [1] $[[x] ? f2 (5 inc) 1] 5"]), "G20"],
	["確かめ bq : [x] ? f2 (5 inc) 1 ⏎ hb : [k] ? $bq ⏎ hb [1]（実体の本体の `$bq`）", std(["bq : [x] ? f2 (5 inc) 1", "hb : [k] ? $bq", "hb [1]"]), "G20", [["hb", "N"]]],
	// R59：単位律で名前1つに縮む中身・右辺は、その名前の先の物を引き継ぐ（§5 Q62）。
	["確かめ p : add (5 inc) ⏎ $[p , !_]（前の版は通った）", std(["p : add (5 inc)", "$[p , !_]"]), "G20"],
	["確かめ p : add (5 inc) ⏎ $[!_ , p]", std(["p : add (5 inc)", "$[!_ , p]"]), "G20"],
	["確かめ p : add (5 inc) ⏎ $[_ , p]", std(["p : add (5 inc)", "$[_ , p]"]), "G20"],
	["確かめ p : add (5 inc) ⏎ $[p !_]", std(["p : add (5 inc)", "$[p !_]"]), "G20"],
	["確かめ p : add (5 inc) ⏎ $[!_ p]", std(["p : add (5 inc)", "$[!_ p]"]), "G20"],
	["確かめ p : add (5 inc) ⏎ i : !_ ⏎ $[i p]", std(["p : add (5 inc)", "i : !_", "$[i p]"]), "G20"],
	["確かめ p : add (5 inc) ⏎ q : p , !_ ⏎ $q", std(["p : add (5 inc)", "q : p , !_", "$q"]), "G20"],
	["確かめ p : add (5 inc) ⏎ q : _ , p ⏎ $q", std(["p : add (5 inc)", "q : _ , p", "$q"]), "G20"],
	["確かめ p : add (5 inc) ⏎ q : p !_ ⏎ $q", std(["p : add (5 inc)", "q : p !_", "$q"]), "G20"],
	// 「本体の局所の lq : p , !_ ⏎ $lq」（G20）は、寄せ1（R128）で本体に局所の定義が無くなり、上の reviewPasses へ移した。
	["確かめ sq : x ? x inc ⏎ $[_ , sq]", std(["sq : x ? x inc", "$[_ , sq]"]), "G20"],
	["確かめ sq : x ? x inc ⏎ $[sq , !_]", std(["sq : x ? x inc", "$[sq , !_]"]), "G20"],
	["確かめ p : $sq ⏎ sq : x ? x inc ⏎ p（値の定義の行で断る）", std(["p : $sq", "sq : x ? x inc", "p"]), "G20"],
	// R57：単位律で後置の印の付いた項・撒いた形の名前に縮む中身。撒く物が Reader。
	["確かめ $[_ , vs~]（前の版は通った）", std("$[_ , vs~]"), "G20"],
	["確かめ $[vs~ , _]", std("$[vs~ , _]"), "G20"],
	["確かめ $[vs~ , !_]", std("$[vs~ , !_]"), "G20"],
	["確かめ $[!_ , vs~]", std("$[!_ , vs~]"), "G20"],
	["確かめ $[5! , _]", std("$[5! , _]"), "G20"],
	["確かめ $[5! , !_]", std("$[5! , !_]"), "G20"],
	["確かめ $[[vs~] , _]", std("$[[vs~] , _]"), "G20"],
	["確かめ w : vs~ ⏎ $[w , !_]", std(["w : vs~", "$[w , !_]"]), "G20"],
	["確かめ w : vs~ ⏎ $[_ , w]", std(["w : vs~", "$[_ , w]"]), "G20"],
	["確かめ [$vs]~（前の版は通った）", std("[$vs]~"), "G20"],
	["確かめ [$inc]~（HEAD から A だった）", std("[$inc]~"), "G20"],
	["確かめ p : $inc ⏎ p~", std(["p : $inc", "p~"]), "G20"],
	// 枝で選ぶ括り（形の綴り `A(U)`）。`$[1 > 0 & inc | double]` と同じ G20 だった。括りの関数の実体で渡された形の見えない値（§5 Q64。R56 の R の所が断る側に
	// 残した形に戻す）も G20 だった（2026-10-26 の R63 から、欄の右辺の書いた `_` は零射の番地で通り、印の無い形の見えない値は G20 のまま）。
	// 2026-10-27 の片8 の R99・R100 で、どちらも持ち上げ（印 lift）で通り、形の見えない値は実体で値と分かるので警告する。ここにあった7行のうち6行（`$[5 > 1 : inc]`・
	// `$[5 > 1 : inc ⏎ _ : double]`・`p : $[5 > 1 : inc] ⏎ p`・`rd [1] $[5 > 1 : inc] 3`・`hb [s : (inc 5)]`・`kk 5 [1]`）は、いちばん後ろの「R99〜R104」の節の通る側へ
	// 移した。`hd2 [un 5]` は `un : _` に寄る（片9 で答えが変わる）ので、移さずに外した（2026-10-28 の確かめの直し：前はこの注が7行とも移したと書き、
	// `$[5 > 1 : inc ⏎ _ : double]` の行はどこにも無かった）。
	// 今のまま断る（合成の途中の恒等射。書き並べも G18 なので、流れだけ通すと割れる。§5 Q58 の注）。
	["確かめ inc !_ add vs~（今のまま G19）", trial("inc !_ add vs~"), "G19"],
	// 書き並べの `inc !_ add 1 2`（G18）は、片イ（R126）で恒等射を消した `inc add 1 2` に畳み直して通る（上の reviewPasses へ移した）。
];
for (const [name, s, want, kind, extra] of reviewPasses) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of reviewRefused) checkRefused(name, s, want, inst);
// 2026-10-26 の R62・R63 から、値を読む参照の言い分は G21 で R62 と §5 Q66 を名指しし（前は G7 で §5 Q59）、実体で渡された形の見えない値の言い分は R63 を
// 名指しする（前は `hb [s : _]` で §5 Q64。`[s : _]` は R63 で通るので `[s : (inc 5)]` に替えた）。
const reviewMessages = [
	["点なしが受けた Reader", std("[+ 1] $vs"), "G21", ["値の演算子の点なし", "番地", "§4 R62", "§5 Q66"], ["Q59"]],
	["区間の被演算子の Reader", std("[+ $5] 1"), "G21", ["値の演算子 `+` の被演算子", "§5 Q66"], ["Q59"]],
	// 2026-10-26 の R81 から、Reader を受けた素の関数は印で実体を作り、本体の `x + 1` を点と数の規則で断る（言い分は実体の名指しと本体の門。前は札で見て「前から
	// 1 番目の口」「β」と言った）。
	["素の関数の口の Reader", std("inc $5"), "G21", ["素の関数", "`inc` を形 $N で呼んだ実体", "R81", "Address と Int は混ぜません"], ["Q59"]],
	["写した要素の Reader", std("[inc,] $5"), "G21", ["`inc` を形 $N で呼んだ実体", "R81"], []],
	// 「枝で選ぶ括り」（`$[5 > 1 : inc]`）と「実体で渡された形の見えない値」（`hb [s : (inc 5)]`）の G20 の言い分は、2026-10-27 の片8 の R99・R100 でどちらも通るので外した
	// （形の見えない値の警告の言い分は、いちばん後ろの「R99〜R104」の節）。
	// 2026-10-28 の片8 の確かめの直しから、言い分は R99 の語（持ち上げ）で言う（前は「`$` が作った Reader」「1つの Reader と言い切れません」）。
	["撒く物が Reader", std("[$vs]~"), "G20", ["撒く物は `$` で持ち上げた物", "R57・R99"], ["1つの Reader"]],
	["縮んだ中身の後置の印", std("$[vs~ , _]"), "G20", ["括りの中の `vs~`", "R57"], []],
	["縮んだ中身の名前の先", std(["p : add (5 inc)", "$[p , !_]"]), "G20", ["`inc`", "R59"], []],
	["括りの関数の本体の余る関数", std("$[[x] ? f2 (5 inc) 1]"), "G20", ["`inc`", "R59"], []],
];
for (const [name, s, gateId, must, mustNot] of reviewMessages) {
	total++;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if (e.gate === gateId && !missing.length && !extra.length) ok(`言い分 ${name}`);
		else fail(`言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}

// ---------------------------------------------------------------------------
// R62・R63（2026-10-26、§7.35）：番地の点と差（§5 Q59 の答え）・書いた `_` と分かる値を括りの関数の実体へ渡しても `$` は零射の番地（§5 Q64 の答え）
// ---------------------------------------------------------------------------
//
// R62：`$` の値の参照（R60）と点として置いた `0x…` は番地の点、点どうしの差と点に足し引きする `0x…` は番地の差。どちらも Address 型で、Int・UInt と
// 混ぜない。点 ± 差は点、点 − 点は差、差 ± 差は差、点 + 点は断る。Address と数を混ぜた算術・比べは断る（言い分「ずらしは `0x…` で書く」）。番地どうしの
// 比べ（点どうし・差どうし・点と `0x…`）は通る（R の印）。関数を指す番地は今のまま G7（R53 の外）。決まっていない組と中置の外の綴りは G21（§5 Q66）。
// 主の Claude の表に U〔答え〕[2026-10-25 21:15 c8ccdd69]「その表のとおりで良い。 / 0x...はアドレス型を決め打ちで良いと思う。 / 0u...は文字コードの決め打ち。」。
// R63：U [2026-10-25 00:08 8dfc006e]「_は、実は、 / [x ? _] と同じだから / $_ は $[x ? _]」から、`$_` が運ぶのは零射 `[x ? _]` で、`@f 1` は `_`（零射を当てた
// 答え）。欄の右辺の書いた `_`・`_` だけの括り・`_` を右辺に持つ名前は印 zero を持ち、括りの関数の実体に渡しても `$s` は零射の番地（実体の形は `_`）。
// 読みは主の Claude の物（R）。印の無い形の見えない値（`(inc 5)`・要素の混ざった List の要素）は今のまま G20。
// 同じ日の確かめの直し（確かめる人・反証する人の指摘）：番地の算術で作った点・差が印を落とす所（関数の答え・素の関数の口・論理と `#` の被演算子・要素の
// 形の揃わない器・括りの仮引数に直に渡した物）に入れば G21（§5 Q66。前の版は、包んだ物に数を混ぜる形が黙って通った）。本体の `:` の行がファイルの定義の名前を
// 隠す所では、ファイルの定義の読みの番地の顔を使わない（§5 Q10）。消えた余りのラムダの残り1項（`(($x + 0x10) !_)`）は印を持ち越す。点 − `0x…`・点 ± 差・
// 差 ± 差の答えの顔を見分ける行を足した。差を返さない括りの関数 hc（本体 `f == $vs`）は、印を持ち越す実体の見本（hk は差を返すので G21 になった）。
const R62 = ["five : 5", "nx : 0x10", "nx2 : nx", "hk : [k] f ? f - $vs", "rd : [k] f ? @f", "rd1 : f [~t] ? @f 1", "hc : [k] f ? f == $vs"];
const r62 = (lines) => std([...R62, ...[].concat(lines)]);
const r62Passes = [
	// 決まった組（主の Claude の表、21:15 の答え）。
	["R62 $vs - $vs（点 − 点は差。R60 の片は G7、R53 では G20、その前は A）", r62("$vs - $vs"), "(- $vs $vs)", "A"],
	["R62 $vs + 0x10（点 + 差は点。R60 の片は G7）", r62("$vs + 0x10"), "(+ $vs 0x10)", "A"],
	["R62 $vs - 0x10（点 − 差は点）", r62("$vs - 0x10"), "(- $vs 0x10)", "A"],
	// 幅つきの字面の見本は、2026-10-27 の片7 の R97（幅の倍数でない差は断る）で `8x00FF`（値 0xFF は Int の幅 8 byte の倍数でない）が断る側へ移った（下の「R96〜R98」の節）
	// ので、倍数の `8x00F8` に替えた。
	["R62 $vs + 8x00F8（幅つきの番地の字面も差。前の見本 `8x00FF` は片7 の R97 で G21）", r62("$vs + 8x00F8"), "(+ $vs 8x00F8)", "A"],
	["R62 $5 + 0x10（字面の参照も点）", r62("$5 + 0x10"), "(+ $5 0x10)", "A"],
	["R62 $vs + ($five - $vs)（点 + 点どうしの差は点）", r62("$vs + ($five - $vs)"), "(+ $vs [$five - $vs])", "A"],
	["R62 $vs - ($five - $vs)（点 − 差は点）", r62("$vs - ($five - $vs)"), "(- $vs [$five - $vs])", "A"],
	["R62 ($vs - $five) + ($five - $vs)（差 + 差は差）", r62("($vs - $five) + ($five - $vs)"), "(+ [$vs - $five] [$five - $vs])", "A"],
	["R62 ($vs - $five) - ($five - $vs)（差 − 差は差）", r62("($vs - $five) - ($five - $vs)"), "(- [$vs - $five] [$five - $vs])", "A"],
	["R62 $vs + 0x10 - $vs（点 + 差 − 点は差。torsor）", r62("$vs + 0x10 - $vs"), "(- (+ $vs 0x10) $vs)", "A"],
	// `0x…` は位置で顔が決まる：点の右に足し引きするなら差。括り1つ（[x] ≅ x）・名前（`:` はメタ）・名前の別名を通しても同じ。
	["R62 $vs + (0x10)（括った字面）", r62("$vs + (0x10)"), "(+ $vs [0x10])", "A"],
	["R62 nx : 0x10 ⏎ $vs + nx（字面を右辺に持つ名前）", r62("$vs + nx"), "(+ $vs nx)", "A"],
	["R62 nx2 : nx ⏎ $vs - nx2（名前の別名）", r62("$vs - nx2"), "(- $vs nx2)", "A"],
	// 点・差の印は名前と括りに持ち越す（`:` はメタ、[x] ≅ x）。
	["R62 q : $vs + 0x10 ⏎ q - $vs（ずらした点を指す名前は点）", r62(["q : $vs + 0x10", "q - $vs"]), "(- q $vs)", "A"],
	["R62 dq : $vs - $five ⏎ $vs + dq（差を指す名前は差）", r62(["dq : $vs - $five", "$vs + dq"]), "(+ $vs dq)", "A"],
	["R62 ($vs + 0x10) - $vs（括ったずらした点）", r62("($vs + 0x10) - $vs"), "(- [$vs + 0x10] $vs)", "A"],
	// 比べ（R の印）：点どうし・点と `0x…`・差どうし。
	["R62 $vs == $vs（点どうしの比べ。R60 の片は G7、R53 は G20）", r62("$vs == $vs"), "(== $vs $vs)", "A"],
	["R62 $vs !== $five", r62("$vs !== $five"), "(!== $vs $five)", "A"],
	["R62 $vs < $five", r62("$vs < $five"), "(< $vs $five)", "A"],
	["R62 $vs <= 0x1000（点と字面の比べ）", r62("$vs <= 0x1000"), "(<= $vs 0x1000)", "A"],
	["R62 0x0 == $vs（左の字面も比べの相手なら点）", r62("0x0 == $vs"), "(== 0x0 $vs)", "A"],
	["R62 $vs != $vs", r62("$vs != $vs"), "(!= $vs $vs)", "A"],
	["R62 ($vs - $five) == ($five - $vs)（差どうしの比べ）", r62("($vs - $five) == ($five - $vs)"), "(== [$vs - $five] [$five - $vs])", "A"],
	["R62 q : $vs + 0x10 ⏎ q == $vs", r62(["q : $vs + 0x10", "q == $vs"]), "(== q $vs)", "A"],
	// 番地の顔の無い組は今までの読み（解決器は `0x…` を中身の見えない A のまま持つ。字面どうし・字面と数の型は型の段の話）。
	["R62 0x10 + 1（点の無い所は今のまま）", r62("0x10 + 1"), "(+ 0x10 1)", "A"],
	["R62 0x10 + 0x20（同じ）", r62("0x10 + 0x20"), "(+ 0x10 0x20)", "A"],
	// ずらした点・差を `$` で指す（Reader の Reader）・器に入れる・値の演算子でない口に渡すのは今までどおり。
	["R62 $($vs + 0x10)（ずらした点を読む参照）", r62("$($vs + 0x10)"), "$[$vs + 0x10]", "A"],
	["R62 q : $vs + 0x10 ⏎ $q", r62(["q : $vs + 0x10", "$q"]), "$q", "A"],
	// （2026-10-26 の確かめの直しで、`[$vs + 0x10 , $vs]`（器の中、要素の形が `$+` と `$[N…]` で揃わない）と `use ($vs + 0x10) 1`（素の関数の口）は G21 に
	// なった：印を落とす所。下の r62Refused の「印を落とす所」へ移した。）
	// 括りの関数の実体の裸の仮引数に、ずらした点の印を持ち越す（鍵 `$+`）。
	// （2026-10-26 の確かめの直しで、`hk [1] ($five + 0x10)`（hk の本体 `f - $vs` は差を返す）は G21 になった：関数の答えは点・差の印を持たない。下の
	// r62Refused へ移し、印を持ち越す実体の見本は、差を返さない hc（本体 `f == $vs`）にした。）
	["R62 hc [1] ($five + 0x10)（実体の f は点で、f == $vs は点どうしの比べ）", r62("hc [1] ($five + 0x10)"), "(apply hc (construct [1] [$five + 0x10]))", "A"],
	["R62 その hc の実体（形 `N $+`。hc は R62 の定義の7つ目の行）", r62("hc [1] ($five + 0x10)"), "(: hc (? [[k] f] (inst N $+ (== f $vs))))", null, { at: STD.length + 6 }],
	// R63（§5 Q64 の答え）：書いた `_` と分かる値を実体に渡しても、`$s` は `$_` と同じ零射の番地。
	// 2026-10-26 の R81 から、use は零射の番地 `$s` の印で実体を作り、`@f 1` は零射を当てた `_` で A（前は use の本体の根が未知で未知。下の3行も同じ）。
	["R63 hb : [s] ? use $s 1 ⏎ hb [s : _]（R60 の確かめの片は G20、その前は通った。R81 で A、前は未知）", r62(["hb : [s] ? use $s 1", "hb [s : _]"]), "(apply hb [s : _])", "A"],
	// 2026-10-28 の片9b：欄の `s : _` は書かなかったことと同じ（R113）で `[s : _]` は `[]`（R90 で実体を作らない）。上の行の答え（A）は同じ。実体の形を見る行は、
	// 欄の値を `_` と分かる括り `[_]` に替えて R63 の意図（`_` を指す印は実体の鍵に入る）を保った（前は `hb [s : _]`）。
	["R63 その hb の実体（形 `{s:_}`。`_` を指す印は実体の鍵に入る。片9b で欄の値を `[_]` に）", r62(["hb : [s] ? use $s 1", "hb [s : [_]]"]), "(: hb (? [[s]] (inst {s:_} (apply use (construct $s 1)))))", null, { at: -2 }],
	["R63 un : _ ⏎ hb [s : un]（`_` を右辺に持つ名前。R81 で A）", r62(["un : _", "hb : [s] ? use $s 1", "hb [s : un]"]), "(apply hb [s : un])", "A"],
	["R63 hb [s : [_]]（`_` だけの括り。R81 で A）", r62(["hb : [s] ? use $s 1", "hb [s : [_]]"]), "(apply hb [s : [_]])", "A"],
	["R63 hz : [s] ? $s ⏎ hz [s : _]", r62(["hz : [s] ? $s", "hz [s : _]"]), "(apply hz [s : _])", "A"],
	["R63 hz : [s] ? $[s , !_] ⏎ hz [s : _]（単位律で縮む中身も）", r62(["hz : [s] ? $[s , !_]", "hz [s : _]"]), "(apply hz [s : _])", "A"],
	["R63 hz : [s] ? $[s , !_] ⏎ hz [s : vs]（形の見える値は値を読む参照で、今のまま）", r62(["hz : [s] ? $[s , !_]", "hz [s : vs]"]), "(apply hz [s : vs])", "A"],
	// `@f 1` は零射を当てた `_`（`(apply @f 1)`）で、`_ 1` の並びではない：`rd1 $_ 0` と同じ実体（`$L N`）を分け合う。
	["R63 hr : [s] ? rd1 $s 0 ⏎ hr [s : [_]]（rd1 の実体は `$_` を渡したときと同じ。rd1 は R62 の定義の6つ目の行。片9b で欄の値を `[_]` に、前は `[s : _]`）", r62(["hr : [s] ? rd1 $s 0", "hr [s : [_]]"]), "(: rd1 (? [f [~t]] (inst $L N (apply @f 1))))", null, { at: STD.length + 5 }],
	["R63 rd1 $_ 0（同じ実体）", r62("rd1 $_ 0"), "(: rd1 (? [f [~t]] (inst $L N (apply @f 1))))", null, { at: STD.length + 5 }],
	// 2026-10-28 の片9b：un は kk の裸の口（値の口）に着くので、R112 で書いた `_` と同じく消え、`kk [1]` の部分適用で実体を作らない（行の中で直した。前は形 `_ N` の実体）。
	// 裸の仮引数へ印 zero を持ち越す道は、値の口では R112 で無くなった（括りの関数の欄・要素では今のまま、上の行）。
	["R63 un : _ ⏎ kk : g9 [~l] ? use $g9 2 ⏎ kk un [1]（片9b：un は値の口で消えて実体を作らない。前は形 `_ N` の実体）", r62(["un : _", "kk : g9 [~l] ? use $g9 2", "kk un [1]"]), "(: kk (? [g9 [~l]] (defer {use $g9 2})))", null, { at: -2 }],
	["R63 un : _ ⏎ hd2 [un un]（要素が全部 `_` の List の要素。形 `[_…]`。R81 で A）", r62(["un : _", "hd2 : [x ~xs] ? use $x 0", "hd2 [un un]"]), "(apply hd2 [un un])", "A"],
	// 2026-10-26 の確かめの直し：答えの顔（点か差か）を見分ける（前は点 − `0x…`・点 − 差・差 ± 差の答えを入れ替えても試験が落ちなかった）。どれも、顔が違えば
	// 外側の組が断られる。
	["R62 顔 ($vs - 0x10) - $vs（点 − `0x…` は点）", r62("($vs - 0x10) - $vs"), "(- [$vs - 0x10] $vs)", "A"],
	["R62 顔 ($vs - ($five - $vs)) - $vs（点 − 差は点）", r62("($vs - ($five - $vs)) - $vs"), "(- [$vs - [$five - $vs]] $vs)", "A"],
	["R62 顔 ($vs + ($five - $vs)) - $vs（点 + 差は点）", r62("($vs + ($five - $vs)) - $vs"), "(- [$vs + [$five - $vs]] $vs)", "A"],
	["R62 顔 $vs + (($vs - $five) - ($five - $vs))（差 − 差は差）", r62("$vs + (($vs - $five) - ($five - $vs))"), "(+ $vs [[$vs - $five] - [$five - $vs]])", "A"],
	["R62 ($vs + 0x10) + 0x8（ずらした点をもう一度ずらす）", r62("($vs + 0x10) + 0x8"), "(+ [$vs + 0x10] 0x8)", "A"],
	// 印を落とさずに運べる所は今のまま通る：揃った器の要素（`' 0`）・消えた余りのラムダの残り1項（vanishedOne）・比べの答え（印を持たない A）を返す本体。
	["R62 ([($vs + 0x10) ($vs + 0x10)] ' 0) - $vs（揃った器の要素は印を持つ）", r62("([($vs + 0x10) ($vs + 0x10)] ' 0) - $vs"), "(- [[[$vs + 0x10] [$vs + 0x10]] ' 0] $vs)", "A"],
	["R62 (($vs + 0x10) !_) + 0x8（消えた余りの後の点。前の版は印が落ちて、+ 1 も通った）", r62("(($vs + 0x10) !_) + 0x8"), "(+ [[$vs + 0x10] !_] 0x8)", "A"],
	["R62 q : ($vs + 0x10) !_ ⏎ q - $vs", r62(["q : ($vs + 0x10) !_", "q - $vs"]), "(- q $vs)", "A"],
	["R62 tt : y ? ⏎ ($vs + 0x10) == $five（本体の根は比べの A）", r62(["tt : y ?", "\t($vs + 0x10) == $five"]), "(: tt (? [y] (block (== [$vs + 0x10] $five))))", "A"],
	// 2026-11-04 の寄せ1（R128）から本体の `⇥nx : 5` は条件 nx の枝で、名前を隠さない（nx はファイルの nx）。下の「隠し」の行も同じで、答えはファイルに書いた
	// `tt : y ? (nx + 1) == 6` などと同じ。名前の「隠し」は R80 の時の読みの記録。
	["R62 隠し tt : y ? ⏎ nx : 5 ⏎ (nx + 1) == 6（番地の無い所は今のまま。寄せ1 から `⇥nx : 5` は枝）", r62(["tt : y ?", "\tnx : 5", "\t(nx + 1) == 6"]), "(: tt (? [y] (block (: nx 5) (== [nx + 1] 6))))", "A"],
	// 寄せ1（R128）：本体の行は名前を隠さないので、nx・pp0 はファイルの定義（nx の 0x10、pp0 の `$vs`）。点 + 差の点どうしの比べ・点どうしの比べで通る（前は本体の行の
	// 隠しで G21、下の r62Refused にあった）。
	["R62 隠し tt : y ? ⏎ nx : $vs ⏎ ($vs + nx) == $five（寄せ1 から nx はファイルの 0x10。前は G21）", r62(["tt : y ?", "\tnx : $vs", "\t($vs + nx) == $five"]), "(: tt (? [y] (block (: nx $vs) (== [$vs + nx] $five))))", "A"],
	["R62 隠し pp0 : $vs ⏎ tt : y ? ⏎ pp0 : 5 ⏎ ((pp0) + 0x10) == $five（寄せ1 から pp0 はファイルの点。前は G21）", r62(["pp0 : $vs", "tt : y ?", "\tpp0 : 5", "\t((pp0) + 0x10) == $five"]), "(: tt (? [y] (block (: pp0 5) (== [[pp0] + 0x10] $five))))", "A"],
	["R62 隠し pp0 : $vs ⏎ tt : y ? ⏎ pp0 : 5 ⏎ pp0 == $vs（寄せ1 から pp0 はファイルの点。前は G21）", r62(["pp0 : $vs", "tt : y ?", "\tpp0 : 5", "\tpp0 == $vs"]), "(: tt (? [y] (block (: pp0 5) (== pp0 $vs))))", "A"],
	// 値を読む参照（`$` が作った点）は、印を落とす所でも R60 の届かない所のまま通る（§5 Q66。算術で作った点と割れる。圏論の視点で見直す所）。
	["R62 gi : y ? y ⏎ gi $vs（値を読む参照は今のまま。`gi ($vs + 0x10)` は G21）", r62(["gi : y ? y", "gi $vs"]), "(apply gi $vs)", "A"],
	["R62 $vs # 5（参照へ書く。R60 のまま）", r62("$vs # 5"), "(# $vs 5)", "A"],
	["R62 [+] ($vs + 0x10)（1項の点そのものは畳まない。今のまま未知）", r62("[+] ($vs + 0x10)"), "(apply [+] [$vs + 0x10])", "未知"],
];
const r62Refused = [
	// 決まって断る組。
	["R62 $vs + $vs（点 + 点）", r62("$vs + $vs"), "G21"],
	["R62 $vs + 1（Address と Int を混ぜた算術。R60 の片は G7）", r62("$vs + 1"), "G21"],
	["R62 $vs - 8", r62("$vs - 8"), "G21"],
	["R62 $vs + 0u41（`0u…` は文字コードで数）", r62("$vs + 0u41"), "G21"],
	["R62 $vs + 0r3（`0r…` は UInt）", r62("$vs + 0r3"), "G21"],
	["R62 $vs == 5（番地と数の比べ）", r62("$vs == 5"), "G21"],
	["R62 $vs * 2", r62("$vs * 2"), "G21"],
	// `($vs - $five) / 8`（差を幅で割る道、§5 Q67）は、2026-10-27 の片7 の R98（§5 Q67 の答え）で数として通る（下の「R96〜R98」の節）。決まって断る組の見本は、
	// 残りの `差 % 数`（§5 Q76）に替えた。
	["R62 ($vs - $five) % 8（差 % 数は §5 Q76。前の見本 `($vs - $five) / 8` は片7 の R98 で数）", r62("($vs - $five) % 8"), "G21"],
	["R62 ($vs - $five) + 1（差と数）", r62("($vs - $five) + 1"), "G21"],
	["R62 q : $vs + 0x10 ⏎ q + 1（名前を通したずらした点と数）", r62(["q : $vs + 0x10", "q + 1"]), "G21"],
	// 決まっていない組（§5 Q66）。`($vs - $five) + 0x10`（差に `0x…`）・`0x10 + $vs`（点の左の `0x…`）・`($vs - $five) + $vs`（差 + 点）は、2026-10-27 の R92
	// （§5 Q66 の答え：どちらも番地と言える物の中で、顔が1つに決まる組）で通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	["R62 0x1000 - $vs", r62("0x1000 - $vs"), "G21"],
	["R62 ($vs - $five) - $vs（差 − 点）", r62("($vs - $five) - $vs"), "G21"],
	["R62 $vs == ($vs - $five)（点と差の比べ）", r62("$vs == ($vs - $five)"), "G21"],
	["R62 ($vs - $five) == 0x10（差と字面の比べ）", r62("($vs - $five) == 0x10"), "G21"],
	["R62 $vs + _（書いた `_`）", r62("$vs + _"), "G21"],
	["R62 $vs + zz（顔の分からない値）", r62("$vs + zz"), "G21"],
	["R62 $vs ~ $five（範囲）", r62("$vs ~ $five"), "G21"],
	["R62 $vs << 0x1", r62("$vs << 0x1"), "G21"],
	["R62 hk [1] 5（実体の裸の仮引数は顔が分からない）", r62("hk [1] 5"), "G21", [["hk", "N A"]]],
	// 中置の外の綴り（答えに点・差の印を持たせられない。§5 Q66）。
	["R62 [+ 0x10] $vs（中置の `$vs + 0x10` は通る）", r62("[+ 0x10] $vs"), "G21"],
	["R62 sh : x ? x + 0x10 ⏎ sh $vs（素の関数の口、β）", r62(["sh : x ? x + 0x10", "sh $vs"]), "G21"],
	["R62 |$vs - $five|", r62("|$vs - $five|"), "G21"],
	["R62 -($vs - $five)", r62("-($vs - $five)"), "G21"],
	// ずらした点・差を `@` で開く（指す物は型の段で決まる）。
	["R62 @($vs + 0x10)", r62("@($vs + 0x10)"), "G21"],
	["R62 q : $vs + 0x10 ⏎ @[q]", r62(["q : $vs + 0x10", "@[q]"]), "G21"],
	["R62 rd [1] ($vs + 0x10)（実体の `@f`）", r62("rd [1] ($vs + 0x10)"), "G21", [["rd", "N $+"]]],
	["R62 ($vs + 0x10)~（撒く物が番地）", r62("($vs + 0x10)~"), "G20"],
	// 関数を指す番地は今のまま G7（R53 の外）。
	["R62 $inc + 0x10", r62("$inc + 0x10"), "G7"],
	["R62 $vs - $inc", r62("$vs - $inc"), "G7"],
	// R63：印の無い形の見えない値は G20 だった（`hz [s : (inc 5)]` の `$s`、単位律で名前1つに縮む `$[s , !_]`・`$[_ , s]`、数を受けた裸の仮引数の `$[g9 , !_]`）。
	// 2026-10-27 の片8 の R99・R100 で、どれも持ち上げ（印 lift）で通って警告する。ここにあった4行は、いちばん後ろの「R99〜R104」の節の通る側へ移した。
	// 並べ方で割れない（実体の鍵）：ずらした点（`$+`）と `_` を指す値（`_`）は、中身の見えない A と実体を分け合わない。分け合うと、先に解いた方の答えを
	// 後の方が黙って使い、後の行が通ってしまう。
	// （2026-10-26 の確かめの直しで、hq の本体を `(f + 0x10) - $vs`（差を返す。関数の答えは点・差の印を持たないので G21）から、点どうしの比べ
	// `(f + 0x10) == $vs` に替えた。見る物は同じ：`hq [1] ($vs + 0x10)` は通り、`hq [1] 5` の実体は別。）
	["R62 並べ方 hq [1] ($vs + 0x10) ⏎ hq [1] 5（`hq [1] 5` の実体は別）", r62(["hq : [k] f ? (f + 0x10) == $vs", "hq [1] ($vs + 0x10)", "hq [1] 5"]), "G21", [["hq", "N A"]]],
	// 「R63 並べ方 hz [s : _] ⏎ hz [s : (inc 5)]（`{s:A}` の実体は別）」（G20）は、2026-10-27 の片8 で `{s:A}` の実体も通る（警告）ので、いちばん後ろの「R99〜R104」の
	// 節で、2つの実体の木が別（零射の番地と持ち上げ）であることを見る形にした。
	// 番地の算術で作った点・差も、素の関数の口と区間で値の演算子に届けば G21（印 addr は `$` が作った Reader と同じ道で見る）。
	["R62 inc ($vs + 0x10)（素の関数の口）", r62("inc ($vs + 0x10)"), "G21"],
	["R62 [+ 1] ($vs - $five)（点なしが受けた差）", r62("[+ 1] ($vs - $five)"), "G21"],
	// 2026-10-26 の確かめの直し（確かめる人・反証する人の指摘）：番地の算術で作った点・差が、印を落とす所に入れば G21（§5 Q66）。前の版は、中で作った点・差の
	// 印が落ちて中身の見えない A になり、数と混ぜる形が黙って通った（HEAD は中の算術を G7 で断っていた）。どれも `(包んだ物) + 1` は通っていた。
	["R62 印を落とす所 hk [1] ($five + 0x10)（hk の本体 `f - $vs` は差を返す。前の版は通った）", r62("hk [1] ($five + 0x10)"), "G21", [["hk", "N $+"]]],
	["R62 印を落とす所 gw : y ? $vs + 0x10 ⏎ gw 1（素の関数の答え）", r62(["gw : y ? $vs + 0x10", "gw 1"]), "G21"],
	["R62 印を落とす所 gi : y ? y ⏎ gi ($vs + 0x10)（素の関数の口。gi は返すだけ）", r62(["gi : y ? y", "gi ($vs + 0x10)"]), "G21"],
	["R62 印を落とす所 use ($vs + 0x10) 1（use の f は値の演算子に届かないが、答えに印を持たせられない。前の版は未知で通った）", r62("use ($vs + 0x10) 1"), "G21"],
	["R62 印を落とす所 k1 ($vs - $five) 1", r62("k1 ($vs - $five) 1"), "G21"],
	["R62 印を落とす所 [y ? y] ($vs + 0x10)（無名の素の関数）", r62("[y ? y] ($vs + 0x10)"), "G21"],
	["R62 印を落とす所 gi : y ? y ⏎ (gi gi) ($vs + 0x10)（合成）", r62(["gi : y ? y", "(gi gi) ($vs + 0x10)"]), "G21"],
	["R62 印を落とす所 gi : y ? y ⏎ [gi,] ($vs + 0x10)（写像）", r62(["gi : y ? y", "[gi,] ($vs + 0x10)"]), "G21"],
	["R62 印を落とす所 gi : y ? y ⏎ gi [($vs + 0x10) ($vs + 0x10)]（器の要素の点も）", r62(["gi : y ? y", "gi [($vs + 0x10) ($vs + 0x10)]"]), "G21"],
	["R62 印を落とす所 pi : [k] y ? y ⏎ pi [1] ($vs + 0x10)（括りの関数の答え）", r62(["pi : [k] y ? y", "pi [1] ($vs + 0x10)"]), "G21", [["pi", "N $+"]]],
	["R62 印を落とす所 pw : [y] ? $vs - $five ⏎ pw [1]", r62(["pw : [y] ? $vs - $five", "pw [1]"]), "G21", [["pw", "N"]]],
	["R62 印を落とす所 he : [x ~xs] ? x ⏎ he [($vs + 0x10) ($vs + 0x10)]（揃った要素は印を持つが、答えで落ちる）", r62(["he : [x ~xs] ? x", "he [($vs + 0x10) ($vs + 0x10)]"]), "G21", [["he", "[$+…]"]]],
	["R62 印を落とす所 tt : y ? ⏎ ww : $vs + 0x10 ⏎ ww + 1（本体の局所の定義の右辺。局所の名前は種類が未知、P2。前の版は未知で通った）", r62(["tt : y ?", "\tww : $vs + 0x10", "\tww + 1"]), "G21"],
	["R62 印を落とす所 tt : y ? ⏎ ww : [ ⏎ $vs + 0x10 ⏎ ] ⏎ ww * 2（字下げのブロック）", r62(["tt : y ?", "\tww : [", "\t\t$vs + 0x10", "\t]", "\tww * 2"]), "G21"],
	["R62 印を落とす所 tt : y ? ⏎ y > 1 : $vs + 0x10 ⏎ 5（枝の値）", r62(["tt : y ?", "\ty > 1 : $vs + 0x10", "\t5"]), "G21"],
	["R62 印を落とす所 (1 & ($vs + 0x10) | $vs) + 1（論理の枝）", r62("(1 & ($vs + 0x10) | $vs) + 1"), "G21"],
	["R62 印を落とす所 _ | ($vs - $five)", r62("_ | ($vs - $five)"), "G21"],
	["R62 印を落とす所 1 ; ($vs + 0x10)", r62("1 ; ($vs + 0x10)"), "G21"],
	["R62 印を落とす所 [($vs + 0x10) 5]（要素の形の揃わない器）", r62("[($vs + 0x10) 5]"), "G21"],
	["R62 印を落とす所 [$vs + 0x10 , $vs]（積。前の版は通った）", r62("[$vs + 0x10 , $vs]"), "G21"],
	["R62 印を落とす所 (($vs + 0x10) 5) ' 0", r62("(($vs + 0x10) 5) ' 0"), "G21"],
	["R62 印を落とす所 he : [x ~xs] ? x + 1 ⏎ he [($vs + 0x10) 5]", r62(["he : [x ~xs] ? x + 1", "he [($vs + 0x10) 5]"]), "G21"],
	["R62 印を落とす所 he : [x ~xs] ? x + 1 ⏎ he [($vs - $five)]（括りの仮引数に直に渡した差。前の版は未知で通った）", r62(["he : [x ~xs] ? x + 1", "he [($vs - $five)]"]), "G21"],
	["R62 印を落とす所 hr : [s] ? s + 1 ⏎ hr [$vs + 0x10]", r62(["hr : [s] ? s + 1", "hr [$vs + 0x10]"]), "G21"],
	["R62 印を落とす所 ($vs - $five) # 5（差に書く。`@` で開く形と同じ）", r62("($vs - $five) # 5"), "G21"],
	["R62 印を落とす所 q : $vs + 0x10 ⏎ q # 5（ずらした点に書く）", r62(["q : $vs + 0x10", "q # 5"]), "G21"],
	["R62 印を落とす所 $vs # ($vs + 0x10)（書いた物）", r62("$vs # ($vs + 0x10)"), "G21"],
	["R62 印を落とす所 pi : [k] y ? y ⏎ pi [1] [($vs + 0x10) ($vs + 0x10)]（器を受けた裸の仮引数は形を見ない）", r62(["pi : [k] y ? y", "pi [1] [($vs + 0x10) ($vs + 0x10)]"]), "G21"],
	["R62 印を落とす所 既定値のある関数の口", r62(["gd :", "\t\tys", "\t\tzs : 3", "\t? ys", "", "gd ($vs + 0x10)"]), "G21"],
	["R62 印を落とす所 [|] ($vs + 0x10) $vs（論理の記号の畳み込み）", r62("[|] ($vs + 0x10) $vs"), "G21"],
	// 点・差を中に持つ器に値の演算子を当てる形（器の中の番地の顔は答えに残らない）。
	["R62 器 [($vs + 0x10) ($vs + 0x10)] + 1", r62("[($vs + 0x10) ($vs + 0x10)] + 1"), "G21"],
	["R62 器 [+ 1] [($vs + 0x10) ($vs + 0x10)]（区間の綴り）", r62("[+ 1] [($vs + 0x10) ($vs + 0x10)]"), "G21"],
	["R62 器 [+] [($vs + 0x10) ($vs + 0x10)]（1項の器を畳む）", r62("[+] [($vs + 0x10) ($vs + 0x10)]"), "G21"],
	// 後置の `!_`（構築の中の余ったラムダは消え、残った1項の印を持ち越す。vanishedOne）：中置の数と混ぜれば G21。
	["R62 (($vs + 0x10) !_) + 1（消えた余りの後の点と数。前の版は印が落ちて通った）", r62("(($vs + 0x10) !_) + 1"), "G21"],
	["R62 q : ($vs + 0x10) !_ ⏎ q + 1（名前でも同じ）", r62(["q : ($vs + 0x10) !_", "q + 1"]), "G21"],
	// 本体の `:` の行がファイルの定義の名前を隠す所（§5 Q10）：ファイルの定義の読みの番地の顔は使わない（`$名前` の隠しの G20 と同じ線）。前の版は
	// ファイルの定義の読みで、点 + 差・点 − 点として黙って通した。
	// → 2026-11-04 の寄せ1（R128）で本体の行は枝になり、名前を隠さない（隠しは R80 の時の読みの記録）。名前はファイルの定義で読み、答えはファイルに書いた形と同じ：
	// `$vs + nx` は点 + 差の点が関数の答えに落ちる所で G21、`(pp0 - $vs) == $five` は差と点の比べ（§5 Q66）で G21。通るようになった3行は上の r62Passes へ移した。
	["R62 隠し tt : y ? ⏎ nx : 5 ⏎ $vs + nx（寄せ1 から nx はファイルの 0x10 で、点が関数の答えに落ちる G21。前は本体の行の隠しの G21）", r62(["tt : y ?", "\tnx : 5", "\t$vs + nx"]), "G21"],
	["R62 隠し pp0 : $vs ⏎ tt : y ? ⏎ pp0 : 5 ⏎ (pp0 - $vs) == $five（寄せ1 から pp0 はファイルの点で、差と点の比べの G21。前は点の名前の隠し）", r62(["pp0 : $vs", "tt : y ?", "\tpp0 : 5", "\t(pp0 - $vs) == $five"]), "G21"],
	// 点 − `0x…`・点 ± 差・差 ± 差の答えの顔（点か差か）を見分ける（2026-10-26 の確かめの指摘：前は顔を入れ替えても試験が落ちなかった）。
	// 2026-10-27 の R92 で差 + `0x…` は差で通るので、差 + 差の顔は点との比べで見る（差なら点と差の比べで G21、点なら点どうしの比べで通る）。
	["R62 顔 $vs == (($vs - $five) + ($five - $vs))（差 + 差は差なので、点と差の比べは §5 Q66。前の見本は差 + `0x…`）", r62("$vs == (($vs - $five) + ($five - $vs))"), "G21"],
	["R62 顔 (($vs - $five) - ($five - $vs)) - $vs（差 − 差は差なので、差 − 点は §5 Q66）", r62("(($vs - $five) - ($five - $vs)) - $vs"), "G21"],
	["R62 顔 $vs + ($vs - 0x10)（点 − `0x…` は点なので、点 + 点）", r62("$vs + ($vs - 0x10)"), "G21"],
	// 作用の結合：`0x…` どうしの和は点が無いので今までの読み（中身の見えない A）で、点に足すと顔が分からない（§5 Q66。`($vs + 0x10) + 0x8` は通る）。
	// → 2026-10-27 の片7 の R96（§5 Q66 の算術の所の答え）で `0x… ± 0x…` は差になり、`$vs + (0x10 + 0x8)` は点 + 差で通る（下の「R96〜R98」の節へ移した）。ここには、
	// 字面のどれかが幅の倍数でない和（R97 の門で断る）を置く。
	["R62 $vs + (0x4 + 0x4)（`0x…` どうしの和の字面 `0x4` が幅の倍数でない。片7 の R97、前は顔が分からない §5 Q66）", r62("$vs + (0x4 + 0x4)"), "G21"],
];
for (const [name, s, want, kind, extra] of r62Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r62Refused) checkRefused(name, s, want, inst);
const r62Messages = [
	["R62 数と混ぜた算術", r62("$vs + 1"), "G21", ["Address と Int は混ぜません", "ずらしは `0x…` で書きます", "§4 R62"], ["§5 Q66"]],
	["R62 点 + 点", r62("$vs + $vs"), "G21", ["点どうしを足す", "§4 R62"], ["§5 Q66"]],
	// 見本の `($vs - $five) + 0x10` は 2026-10-27 の R92 で差として通るので、今のまま決まっていない `($vs - $five) - $vs`（差 − 点）で見る。
	["R62 決まっていない組", r62("($vs - $five) - $vs"), "G21", ["左は番地の差", "§5 Q66"], []],
	// 差を幅で割る道（`($vs - $five) / 8`、§5 Q67）は、2026-10-27 の片7 の R98 で数として通る。言い分の見本は、残りの `差 % 数`（§5 Q76）と、点を割る形に替えた。
	["R62 差 % 数（片7 の R98 の残り。前の見本 `($vs - $five) / 8` は §5 Q67 を名指しした）", r62("($vs - $five) % 8"), "G21", ["差 % 数は決まっていません", "§5 Q76"], ["§5 Q67"]],
	["R62 点を割る（片7 の R98）", r62("$vs / 8"), "G21", ["点は割れません", "§4 R98"], ["§5 Q67"]],
	["R62 ずらした点を開く", r62("@($vs + 0x10)"), "G21", ["型の段", "§5 Q66"], []],
	["R62 関数を指す番地", r62("$inc + 0x10"), "G7", ["関数を指す番地", "§4 R53", "§4 R62"], ["§5 Q59"]],
	// 2026-10-26 の確かめの直しの言い分。
	["R62 印を落とす所（関数の答え）", r62(["gw : y ? $vs + 0x10", "gw 1"]), "G21", ["関数の本体が返す値", "§5 Q66"], []],
	// 2026-10-26 の R81 から、ずらした点を受けた素の関数は印で実体を作り、本体が返す点は関数の答え（印を落とす所）で断る（前は札で「前から 1 番目の口」と言った）。
	// 器に入れて渡した点・差は、今のまま札で見る（下の行）。
	["R62 印を落とす所（素の関数の答え）", r62(["gi : y ? y", "gi ($vs + 0x10)"]), "G21", ["`gi` を形 $+ で呼んだ実体", "関数の本体が返す値", "§5 Q66"], []],
	["R62 印を落とす所（素の関数の口に器で）", r62(["gi : y ? y", "gi (($vs + 0x10) , ($vs + 0x10))"]), "G21", ["素の関数 `gi` の前から 1 番目の口", "器の中を見ずに", "§5 Q66"], []],
	["R62 印を落とす所（要素の混ざった器）", r62("[($vs + 0x10) 5]"), "G21", ["要素の形の揃わない器", "$+ N", "§5 Q66"], []],
	["R62 差に書く", r62("($vs - $five) # 5"), "G21", ["差は位置ではない", "§5 Q66"], []],
	// 「R62 隠し」（`⇥pp0 : 5` ⏎ `⇥pp0 == $vs` の言い分が隠しを言う）は、2026-11-04 の寄せ1（R128）で本体の行が名前を隠さなくなり、その形が通るので外した。
	["R62 関数と混ぜた組（関数を名指しする）", r62("$vs + inc"), "G21", ["右は関数（番地でも数でもない）", "§5 Q66"], ["数か分からない"]],
	["R62 器に当てた値の演算子", r62("[($vs + 0x10) ($vs + 0x10)] + 1"), "G21", ["器の中身に値の演算子を当てる形", "§5 Q66"], ["区間・点なし"]],
	["R62 器を受けた裸の仮引数", r62(["pi : [k] y ? y", "pi [1] [($vs + 0x10) ($vs + 0x10)]"]), "G21", ["裸の仮引数", "R24", "§5 Q66"], []],
];
for (const [name, s, gateId, must, mustNot] of r62Messages) {
	total++;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if (e.gate === gateId && !missing.length && !extra.length) ok(`言い分 ${name}`);
		else fail(`言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}

// ---------------------------------------------------------------------------
// R64〜R72（2026-10-26、§7.36）：2026-10-25 の答えの片（sid c8ccdd69・e20e5341。U の時刻は UTC）
// ---------------------------------------------------------------------------
//
// R64：括りの名前は射影。括りの口（参照の口）は行の残りを1つの List として受け、`f 1 2 3 4`・`f 1 , 2 , 3 , 4`・`f [1 2 3 4]` は同じ List。名前は前からの
// 射影で、足りなければ後ろの名前が `_`（値の段、§3.7。木は今のまま）。余った要素は受けず（積み直さない）、書いた時点で数が名前より多いと分かる形は
// information の bracket-excess で名指しする（残りが欲しければ `[a b ~c]`）。撒いた流れ1つだけを括りの口に渡す `f vs~` は `f vs` と同じ（前は未知）。
// 主の Claude の案に U〔答え〕[2026-10-25 23:41 c8ccdd69]「キレイにまとまったね！」、足りない方は U [23:33]「f _ 1 2 / f 1 _ 2 / f 1 2 _ / は、全て、c が _」・
// U [23:52]「f 1,2 / f[1 2] / の時も、c が _」。
// R66（§5 Q3）：最後の口が参照の口なら `f 1 , 2 , 3` は `f (1 , 2 , 3)`。値の口は今のまま G3。U〔答え〕[2026-10-25 22:45 c8ccdd69]「その方向でお願い。」。
// R67：仮引数の裸の `~xs` は G22（2026-10-04 に廃止。U [2026-10-25 22:45 c8ccdd69]「後、仮引数リスト上で括りのない ~xs という表記、多分もう使ってないんじゃないかな…？」）。
// R68〜R72（§5 Q8・Q40・Q57 (a)・Q61・Q63）：主の Claude の問いの表に U〔答え〕[2026-10-25 21:56 c8ccdd69]「Q61 / _ に落としていい」「Q63 / 自明な恒等射が残る場合、
// 即時評価して消してもいい（終対象と始対象は随伴）だから $5と結果は同じだと思う。」「他は全部、君の傾き通り。」。
const R64D = [
	"fp : [a b c] ? a + b * c", "fh : [x ~xs] ? x", "fl : [~xs] ? xs", "fy : [x ~xs] y ? y", "pb2 : [a] [b] ? a", "fab : [a b] ? a + b", "fabc : [a b ~c] ? a",
	"mp : h [~l] ? [@h,] l~", "mq : h [~l] ? @h l~", "ws : 1 , 2 , 3 , 4", "e0 : []", "i : !_", PQ,
];
const r64 = (lines) => std([...R64D, ...[].concat(lines)]);
const r64Passes = [
	// R64：射影・余り
	["R64 fp 1 2 3", r64("fp 1 2 3"), "(apply fp (construct 1 2 3))", "A", { diagCount: 0 }],
	["R64 fp 1 2 3 4（名前の無い要素は受けない。知らせる）", r64("fp 1 2 3 4"), "(apply fp (construct 1 2 3 4))", "A", { severities: ["information/bracket-excess"] }],
	["R64 fp [1 2 3 4]（字面の List も同じ）", r64("fp [1 2 3 4]"), "(apply fp [1 2 3 4])", "A", { severities: ["information/bracket-excess"] }],
	["R64 fp ws（数えられるファイルの値の名前も同じ）", r64("fp ws"), "(apply fp ws)", "A", { severities: ["information/bracket-excess"] }],
	["R64 fp [1 2 3 4]~（数えられる撒いた流れも同じ）", r64("fp [1 2 3 4]~"), "(apply fp [1 2 3 4]~)", "A", { severities: ["information/bracket-excess"] }],
	["R64 fabc 1 2 3 4（`~rest` のある括りは知らせない）", r64("fabc 1 2 3 4"), "(apply fabc (construct 1 2 3 4))", "A", { diagCount: 0 }],
	["R64 pb2 [1 2 3] [4]（最後でない括りも、字面の List が名前より多ければ知らせる）", r64("pb2 [1 2 3] [4]"), "(apply pb2 (construct [1 2 3] [4]))", "A", { severities: ["information/bracket-excess"] }],
	["R64 io1 m（構造体は欄の名前で受けるので数えない）", std([IO1, ...M, "io1 m"], { omit: ["adder"] }), "(apply io1 m)", "A", { diagCount: 0 }],
	["R64 fp vs（数えられて名前と同じ数なら知らせない）", r64("fp vs"), "(apply fp vs)", "A", { diagCount: 0 }],
	// 足りない方：後ろの名前が `_`（値の段）。木は今のまま
	["R64 fp 1 2（c は `_`、値の段）", r64("fp 1 2"), "(apply fp (construct 1 2))", "A", { diagCount: 0 }],
	["R64 fp _ 1 2（書いた `_` は消える、R15。c は `_`）", r64("fp _ 1 2"), "(apply fp (construct 1 2))", "A"],
	["R64 fp 1 _ 2（同じ）", r64("fp 1 _ 2"), "(apply fp (construct 1 2))", "A"],
	["R64 fp 1 2 _（同じ）", r64("fp 1 2 _"), "(apply fp (construct 1 2))", "A"],
	["R64 fp [1 2]（同じ List）", r64("fp [1 2]"), "(apply fp [1 2])", "A"],
	["R64 (fp 1 2) 3（括りの口はカリー化しない、今のまま）", r64("(fp 1 2) 3"), "(construct [fp 1 2] 3)", "A"],
	// 2026-10-27 の R90（§5 Q70 の答え）から、頭の名前がある括りに空の List が来たら木の段でも分解が立たず、本体を読まずに `_`（A）。前は `[]` が中身の見えない A で未知。
	["R64 fp []（空の List で分解が立たない、R90。前は未知）", r64("fp []"), "(apply fp [])", "A"],
	// 撒いた流れ1つを括りの口へ（前は未知）
	["R64 fp vs~（`fp vs` と同じ。前は未知）", r64("fp vs~"), "(apply fp vs~)", "A"],
	["R64 fp vs~ の実体は `fp vs` と同じ `[N…]`（実体は1つ）", r64(["fp vs", "fp vs~"]), "(: fp (? [[a b c]] (inst [N…] (+ a (* b c)))))", null, { at: STD.length }],
	["R64 fh vs~（前は未知）", r64("fh vs~"), "(apply fh vs~)", "A"],
	["R64 fl vs~（前は未知）", r64("fl vs~"), "(apply fl vs~)", "A"],
	["R64 mp $inc vs~（前の仮引数の後ろの最後の括り。前は未知）", r64("mp $inc vs~"), "(apply mp (construct $inc vs~))", "A"],
	["R64 i fl vs~（恒等射が渡した流れも同じ、単位律。前は未知。R74 で i が消える、前の木は `(compose i fl)`）", r64("i fl vs~"), "(apply fl vs~)", "A"],
	["R64 fl 1 vs~（流れと書いた実引数の混ざった形は今のまま未知、§5 Q29）", r64("fl 1 vs~"), "(apply fl (construct 1 vs~))", "未知"],
	// R66（§5 Q3）：最後の口が参照の口なら、積で List を組んでその口に渡す
	["R66 fp 1 , 2 , 3（`fp (1 , 2 , 3)` と同じ）", r64("fp 1 , 2 , 3"), "(apply fp [1 , 2 , 3])", "A", { diagCount: 0 }],
	["R66 fp (1 , 2 , 3)（括って書いた形）", r64("fp (1 , 2 , 3)"), "(apply fp [1 , 2 , 3])", "A"],
	["R66 fh 1 , 2 , 3", r64("fh 1 , 2 , 3"), "(apply fh [1 , 2 , 3])", "A"],
	["R66 mp $inc 1 , 2 , 3（map の最後の口 `[~l]`）", r64("mp $inc 1 , 2 , 3"), "(apply mp (construct $inc [1 , 2 , 3]))", "A"],
	["R66 fp 1 , 2 , 3 , 4（余りは知らせる、R64）", r64("fp 1 , 2 , 3 , 4"), "(apply fp [1 , 2 , 3 , 4])", "A", { severities: ["information/bracket-excess"] }],
	["R66 fp 1 , 2（c は `_`、値の段）", r64("fp 1 , 2"), "(apply fp [1 , 2])", "A"],
	["R66 5 fp 1 , 2（値の後ろに積まれた fp も同じ）", r64("5 fp 1 , 2"), "(construct 5 (apply fp [1 , 2]))", "A"],
	["R66 w : fp 1 , 2 , 3 ⏎ w（名前の右辺も）", r64(["w : fp 1 , 2 , 3", "w"]), "w", "A"],
	["R66 inc (fh 1 , 2)（括りの中も）", r64("inc (fh 1 , 2)"), "(apply inc [fh 1 , 2])", "A"],
	["R66 1 , fh 2 , 3（右結合の右の `,` の中で読む）", r64("1 , fh 2 , 3"), "(, 1 (apply fh [2 , 3]))", "A"],
	["R66 fp [1 2] , 3（List も1項）", r64("fp [1 2] , 3"), "(apply fp [[1 2] , 3])", "A"],
	["R66 fp 1 , _ , 2（積の中の `_` は消える、R61）", r64("fp 1 , _ , 2"), "(apply fp [1 , _ , 2])", "A"],
	["R66 fab 1 , (2 3)（右の要素を括った1項は書いた形どおり1要素）", r64("fab 1 , (2 3)"), "(apply fab [1 , [2 3]])", "A"],
	["R66 fab 1 , [2 3]（同じ）", r64("fab 1 , [2 3]"), "(apply fab [1 , [2 3]])", "A"],
	// R64 の知らせを、同じ実体のどの綴りでも同じに出す（2026-10-26 の確かめの直し。最初の版は、文字列の字面・文字列の名前・合成の段の後ろ・部分適用で
	// 当てた括りでは出さず、撒いた `` fp `abcd`~ ``・書き並べた `pb2 [1 2 3] [4]`・括った `fp (inc 1) 2 3 4` だけが知らせていた）
	["R64 fp `abcd`（文字列の字面は文字の数で数える、String ≅ List(Char)）", r64("fp `abcd`"), "(apply fp `abcd`)", "A", { severities: ["information/bracket-excess"] }],
	["R64 fp `abc`（ちょうどなら知らせない）", r64("fp `abc`"), "(apply fp `abc`)", "A", { diagCount: 0 }],
	["R64 st : `abcd` ⏎ fp st（文字列を指す名前も同じ）", r64(["st : `abcd`", "fp st"]), "(apply fp st)", "A", { severities: ["information/bracket-excess"] }],
	["R64 inc fp 1 2 3 4（合成の段の後ろの括りの関数も数える）", r64("inc fp 1 2 3 4"), "(apply fp (construct (apply inc 1) 2 3 4))", "A", { severities: ["information/bracket-excess"] }],
	["R64 (pb2 [1 2 3]) [4]（部分適用で当てた括りも、当てた所で知らせる）", r64("(pb2 [1 2 3]) [4]"), "(apply [pb2 [1 2 3]] [4])", "A", { severities: ["information/bracket-excess"] }],
	["R64 pa : pb2 [1 2 3] ⏎ pa [4] ⏎ pa [5]（名前を通しても、書いた所ごとに1回）", r64(["pa : pb2 [1 2 3]", "pa [4]", "pa [5]"]), "(apply pa [5])", "A", { severities: ["information/bracket-excess"] }],
	// R68（§5 Q8）：既定値のある関数の、既定値の無い口の内側の `_` はカリー化
	// 2026-10-28 の R105 で R68 は廃止：既定値の無い口の `_` は単位律で消える（口を使わない）。評価する所で既定値の口だけが開いていれば既定値で埋める（R107）。
	// 下の行は R105・R107 の答えに直した（前の答えは名前の「前は」に書いた）。`(go _ 3) 5` は `(go 3) 5` と同じ G7（既定値のある関数の部分適用の項は種類が決まらない、
	// §5 Q8・Q80）で、断る側（いちばん後ろの「R105〜R110」の節）へ移した。
	["R68 go _ xs（R105 で `go xs`、根なので R107 で zs を既定値で埋める。前は R68 のカリー化、その前は G15）", std([...GO_DEFAULT, "go _ xs"]), "(apply go (construct xs _))", "未知"],
	["R68 go _ 3（R105・R107 で `go 3 _`。前は R68 のカリー化、その前は G15）", std([...GO_DEFAULT, "go _ 3"]), "(apply go (construct 3 _))", "未知"],
	["R68 5 go _ 3（積まれた go も同じ。R105・R107：根では値の上に積まれた関数も評価する所の終わりに残った関数で埋まる。評価する所の外の値の上は §5 Q80 (e)。前は R68 のカリー化、その前は G15、2026-10-23 は G8）", std([...GO_DEFAULT, "5 go _ 3"]), "(construct 5 (apply go (construct 3 _)))", "未知"],
	["R68 go _ !_（R105 で `go !_`、R34 の k < n。前は `_` と穴で穴2つ、その前は G15）", std([...GO_DEFAULT, "go _ !_"]), "(unit (? [$p0 [~$p1]] (apply go (construct $p0 $p1~))))", "A"],
	["R68 go _ _（R105 で左から読んで2つとも ys の口で消え、go。前は後ろの `_` が zs の既定値で `go !_ _` と同じ木、§5 Q74 (d)）", std([...GO_DEFAULT, "go _ _"]), "(unit go)", "A"],
	["R68 go !_ _（比べ。HEAD から同じ）", std([...GO_DEFAULT, "go !_ _"]), "(unit (? [$p0] (apply go (construct $p0 _))))", "A"],
	["R68 go _ 3 4（R105 で `go 3 4`。前は余りが穴に入る `go 4 3`）", std([...GO_DEFAULT, "go _ 3 4"]), "(apply go (construct 3 4))", "未知"],
	["R68 gl _ 1 2（gl : x [y : 5] z。R105 で `gl 1 2`、z が開いているので埋めない。前は内側の既定値の無い口 x の `_` は穴）", std(["gl : x [y : 5] z ? x", "gl _ 1 2"]), "(apply gl (construct 1 2))", "未知"],
	["R68 gl 1 _ 2（既定値のある口 y の `_` は既定値、R39 のまま）", std(["gl : x [y : 5] z ? x", "gl 1 _ 2"]), "(apply gl (construct 1 _ 2))", "未知"],
	// R69（§5 Q40）：前から n 個の外の `!_` は閉じた後ろの恒等射
	["R69 inc 5 !_（前は G13）", std("inc 5 !_"), "(construct (apply inc 5) (unit !_))", "A", { leftoverDiag: [] }],
	["R69 (inc 5) !_（比べ。HEAD から同じ）", std("(inc 5) !_"), "(construct [inc 5] (unit !_))", "A"],
	["R69 pq 1 2 !_（前は G5）", r64("pq 1 2 !_"), "(construct (apply pq (construct 1 2)) (unit !_))", "A"],
	["R69 5 inc 7 !_（積まれた inc も同じ。前は G13）", std("5 inc 7 !_"), "(construct 5 (apply inc 7) (unit !_))", "A"],
	["R69 5 add 1 2 !_（前は G13）", std("5 add 1 2 !_"), "(construct 5 (apply add (construct 1 2)) (unit !_))", "A"],
	["R69 5 pq 1 2 !_（前は G5）", r64("5 pq 1 2 !_"), "(construct 5 (apply pq (construct 1 2)) (unit !_))", "A"],
	["R69 (inc 5 !_) inc（括りの中も。前は G13）", std("(inc 5 !_) inc"), "(construct [inc 5 !_] (unit inc))", "A", { leftoverDiag: ["inc"] }],
	// R70（§5 Q57 (a)）：空の流れを口1つの関数へ渡すと、何も当たらずラムダが余って `_`（知らせる）。
	// 2026-10-27 の R84（§5 Q69 の答え：`[]~ = _~ = _`）から、空の流れは書いた `_` と同じ印で、並びの終わりなら消えて関数が残る（R28）。根なら `_` で知らせるのは
	// 同じで、木と知らせの名前が `_` を外した並びのもの（`inc []~` は `(unit inc)`）に変わった。前の木は `(unit (apply inc []~))`。
	["R70 inc []~（R84 で `inc _` と同じ。前は `(unit (apply inc []~))`、その前は G19）", std("inc []~"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R70 [+ 1] []~（R84 で `[+ 1] _` と同じ。前は G19）", std("[+ 1] []~"), "(unit [+ 1])", "A", { leftoverDiag: ["[+ 1]"] }],
	["R70 inc e0~（e0 : []。R84 で `inc _` と同じ。前は G19）", r64("inc e0~"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R70 inc double []~（R84 で `inc double _` と同じ。前は G19）", std("inc double []~"), "(unit (compose inc double))", "A", { leftoverDiag: ["(compose inc double)"] }],
	["R70 add 1 []~（R84 で `add 1 _` と同じ、`add 1` が余る。前は G19）", std("add 1 []~"), "(unit (apply add 1))", "A", { leftoverDiag: ["(apply add 1)"] }],
	// 2026-10-26 の確かめの直し：閉じるのは、2つの読み（受けた所で閉じる・空の流れが並びの単位として消えて関数が開いたまま残る）が同じ答えになる所だけ
	// （後ろに何も続かず、評価する所・本体の根・値の上に積まれた所）。最初の版が通していた `inc []~ 5`（閉じた `_` の後ろの 5）・`w : inc []~` ⏎ `w` は、
	// 下の r64Refused の G19 へ移した（§5 Q69）。
	// 本体の根の空の流れ（`mq $!_ []`・`t : y ? inc []~`・`k2 []`）は、2026-10-27 の R84 から書いた `_` と同じで、末尾の `_` が消えて関数が本体の根に残るので G16（R33。
	// `t : y ? inc _` と同じ）。下の r64Refused へ移した（前は余ったラムダの `_` で通っていた）。
	["R70 5 inc []~（値の上に積まれた inc は `_`、R52。R84 で `5 inc _` と同じ木）", std("5 inc []~"), "(construct 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["R70 (5 inc []~) 3（括りの中でも値の上なら同じ）", std("(5 inc []~) 3"), "(construct [5 inc []~] 3)", "A", { leftoverDiag: ["inc"] }],
	["R70 w : 5 inc []~ ⏎ w（`:` の右辺でも値の上なら同じ、R52・§5 Q50）", std(["w : 5 inc []~", "w"]), "w", "A", { leftoverDiag: ["inc"] }],
	["R70 i inc []~（R74 で i が消え、R84 で `inc _` と同じ）", r64("i inc []~"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	// 口が2つの `add []~` は、2026-10-27 の R84 から `add _` と同じ（add が残り、根で `_` と知らせる）。前は R51 の畳み込みで閉じた `(apply add []~)`（知らせない）。
	["R70 add []~（R84 で `add _` と同じ。前は畳み込みの `_`、§5 Q69）", std("add []~"), "(unit add)", "A", { leftoverDiag: ["add"] }],
	// R71（§5 Q61）：`_ , !_` は `_`
	["R71 _ , !_（前は G7）", std("_ , !_"), "_", "A"],
	["R71 !_ , _（前は G7）", std("!_ , _"), "_", "A"],
	["R71 i : !_ ⏎ _ , i（前は G7）", r64("_ , i"), "_", "A"],
	["R71 $[_ , !_]（零射の番地、R56。前は G7）", std("$[_ , !_]"), "$[_ , !_]", "A"],
	["R71 ||$[_ , !_]||（`||$_||` と同じ 1 の側。前は G7）", std("||$[_ , !_]||"), "||$[_ , !_]||", "A"],
	["R71 inc 1 , _ , !_（`_ , !_` が `_` で、`inc 1 , _` と同じ。前は G3）", std("inc 1 , _ , !_"), "(apply inc 1)", "A"],
	// R72（§5 Q63）：`$[…]` の中身で値の上に余った恒等射は即時に消える
	["R72 $[5 !_]（`$5` と同じ 5 を読む参照。前は G20）", std("$[5 !_]"), "$[5 !_]", "A"],
	["R72 $[5 i]（前は G20）", r64("$[5 i]"), "$[5 i]", "A"],
	["R72 $[5 !_] + 0x10（`$5 + 0x10` と同じ点、R62）", std("$[5 !_] + 0x10"), "(+ $[5 !_] 0x10)", "A"],
	["R72 $[(5 !_)] + 0x10（比べ。HEAD から同じ）", std("$[(5 !_)] + 0x10"), "(+ $[[5 !_]] 0x10)", "A"],
	["R72 $[5 6 !_]（前は G20）", std("$[5 6 !_]"), "$[5 6 !_]", "A"],
	// 片イ（R121）で G3 は廃止：`,` の辺も左から畳み、辺の終わりに余った関数（`f3 1`・`fy 1`・`pb2 1`）は `_` と leftover-lambda。
	["R66 inc 1 , 2（値の口）（前は G3）", std("inc 1 , 2"), "(, (apply inc 1) 2)", "A", { leftoverDiag: [] }],
	["R66 f3 1 , 2（値の口）（前は G3）", std("f3 1 , 2"), "(, (unit (apply f3 1)) 2)", "A", { leftoverDiag: ["(apply f3 1)"] }],
	["R66 fy 1 , 2（最後の口が裸）（前は G3）", r64("fy 1 , 2"), "(, (unit (apply fy 1)) 2)", "A", { leftoverDiag: ["(apply fy 1)"] }],
	["R66 pb2 1 , 2（`,` の左の値が最後でない括りに入る）（前は G3）", r64("pb2 1 , 2"), "(, (unit (apply pb2 1)) 2)", "A", { leftoverDiag: ["(apply pb2 1)"] }],
	["R66 fp inc 1 , 2（`,` の左の値が合成の最初の inc の口に入る、§5 Q68 の残り）（前は G3）", r64("fp inc 1 , 2"), "(, (apply (compose fp inc) 1) 2)", "A", { leftoverDiag: [] }],
	["R66 fp vs~ , 4（撒く項、§5 Q68 の残り）（前は G3）", r64("fp vs~ , 4"), "(, (apply fp vs~) 4)", "A", { leftoverDiag: [] }],
	// 片イ（R125）で G16 は廃止：空の流れ（R84 で書いた `_` と同じ）を受けた本体の返す所に残った関数は `_` と bare-function-return。
	["R70 k2 : [~t] ? (inc t~) ⏎ k2 []（本体の根の括りの中。R84 で `(inc _)` と同じ）（前は G16、その前は G19）", std(["k2 : [~t] ? (inc t~)", "k2 []"]), "(apply k2 [])", "A", { severities: ["information/bare-function-return"] }],
	["R70 k2 : [~t] ? inc t~ ⏎ k2 []（本体の根。R84 で `inc _` と同じ）（前は G16、その前は余ったラムダの `_` で通った）", std(["k2 : [~t] ? inc t~", "k2 []"]), "(apply k2 [])", "A", { severities: ["information/bare-function-return"] }],
	["R70 mq $!_ []（実体の本体の根 `@h l~` が `@h _` と同じ）（前は G16、その前は余ったラムダの `_` で通った）", r64("mq $!_ []"), "(apply mq (construct $!_ []))", "A", { severities: ["information/bare-function-return"] }],
	["R70 t : y ? inc []~（本体の根。R84 で `t : y ? inc _` と同じ）（前は G16、その前は余ったラムダの `_` で通った）", std("t : y ? inc []~"), "(: t (? [y] (unit inc)))", null, { severities: ["information/bare-function-return"] }],
];
const r64Refused = [
	["R64 bad inc vs~（流れ1つを受けた bad は vs の形で実体を作り、本体の G5。前は実体を作らずに通った、§5 Q29）", src([INC, "vs : 1 , 2", BAD, "bad inc vs~"]), "G5", [["bad", "[N…]"]]],
	["R64 bad vs~（`bad vs` と同じ G5。前は実体を作らずに通った）", src(["vs : 1 , 2", BAD, "bad vs~"]), "G5", [["bad", "[N…]"]]],
	// `fp _`（書いた `_` だけを括りの関数に、G5、§5 Q7）は、2026-10-26 の R28 の書き直し（括りの関数の末尾の `_` も消える）で `fp` と同じく通る側（いちばん後ろの
	// 「R28」の節）へ移した。
	// R66：値の口・ほかの形は今のまま G3
	// 片イ（R121）で G3 は廃止。R66 の6行は上の r64Passes へ移した。
	// `fp 1 2 , 3`（最後の括りがもう前の項を受けている、§5 Q68）は、2026-10-27 の R93（§5 Q68 の答え：書いた形のまま `[[1 2] 3]`）で通る側（いちばん後ろの「R83〜R93」の
	// 節）へ移した。
	// 2026-10-26 の確かめの直しで G3 に戻した、`,` の右の要素が2項以上の並びの形（`fab 1 , 2 3`・`fp 1 , 2 , 3 4`・`fab 1 , 2 3 , 4`）と、`,` のすぐ左が書いた `_` の
	// `fp _ , 1 , 2` は、2026-10-27 の R93 で書いた形のまま通る（いちばん後ろの「R83〜R93」の節）。
	// R70：2つの読みで答えが割れる所は G19（§5 Q69。2026-10-26 の確かめの直し。最初の版は受けた所で閉じて通していた）。2026-10-27 の R84（§5 Q69 の答え：`[]~ = _~ = _`）
	// で、どれも書いた `_` と同じ所の答えになり、通る側（いちばん後ろの「R83〜R93」の節）へ移した：`inc []~ 5`・`inc e0~ 5`・`add 1 []~ 3`・`inc []~ inc`・`(inc []~) 5`・
	// `[inc []~]`・`w : inc []~` ⏎ `w`・`$[inc []~]`。本体の根の括りの中の `k2 : [~t] ? (inc t~)` ⏎ `k2 []` は、`(inc _)` の関数が本体の根に残るので G16（R33）。
	// 片イ（R125）で G16 は廃止。R70 の4行は上の r64Passes へ移した。
	// R67：仮引数の裸の `~xs`
	["R67 gx : a ~y ? a（前は口の数の分からない関数で通った）", std(["gx : a ~y ? a", "gx 1 2 3"]), "G22"],
	["R67 呼ばれない定義でも断る", std("gz2 : ~y ? y"), "G22"],
	["R67 仮引数のブロックの行 ~y", std(["gw :", "\t\ta", "\t\t~y", "\t? a", ""]), "G22"],
	["R67 括った `?` の裸の ~y", std("[a ~y ? a] 1 2"), "G22"],
	["R67 括りの仮引数の後ろの裸の ~y", std("gv : [a] ~y ? a"), "G22"],
	// 2026-10-26 の確かめの直し：既定値と組んだ前置 `~`（既定値の括りは残りを受ける括りではない）も同じ。最初の版は素通しし、`gd2 _ 2` に R68 のカリー化を当てた。
	["R67 仮引数のブロックの行 ~y : 3（既定値と組んでも）", std(["gw :", "\t\ta", "\t\t~y : 3", "\t? a", ""]), "G22"],
	["R67 既定値の括り [~y : 5]", std(["gd2 : x [~y : 5] ? x", "gd2 _ 2"]), "G22"],
	// R68：残る G15。最後の項の `_` が既定値の無い口に当たる `go _`・穴と混ざった `gl !_ 1 _`（gl の z は既定値が無い）は、2026-10-26 の R28 の書き直し（既定値の
	// 無い口の末尾の `_` は消える）で、`go`・`gl !_ 1` と同じく通る側（いちばん後ろの「R28」の節）へ移した（§5 Q8 の残りは閉じた）。
	// `R68 go inc _ 3`（合成の段の go、G15）は、2026-10-28 の R105 で既定値の無い ys の口の `_` が消えて `go inc 3` と同じになり、通る側（いちばん後ろの
	// 「R105〜R110」の節）へ移した。残る G15 は、位置の数えられない `_` と仮引数の外の内側の `_`（`go 1 2 _ 3`）だけ。
	// R69：残る形
	// 外に値がある `inc 5 !_ 6`（G13）・`pq 1 2 !_ 5`（G5）は、2026-10-27 の R89（§5 Q40 の残りの答え）で通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	["R69 go 1 2 !_（既定値のある関数の頭は閉じたと言えない。今のまま G13）", std([...GO_DEFAULT, "go 1 2 !_"]), "G13"],
	// R72：恒等射でない関数は今のまま
	["R72 $[5 inc]（今のまま G20）", std("$[5 inc]"), "G20"],
	["R72 $[5 inc , !_]（今のまま G20）", std("$[5 inc , !_]"), "G20"],
	["R72 $[5 !_] + 1（`$5 + 1` と同じ数と混ぜた形、R62）", std("$[5 !_] + 1"), "G21"],
];
for (const [name, s, want, kind, extra] of r64Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r64Refused) checkRefused(name, s, want, inst);
const r64Messages = [
	["R64 名前の無い要素の知らせ", r64("fp 1 2 3 4"), "bracket-excess", ["`fp`", "`[a b c]`", "要素は 4 つ", "§4 R64", "`[a b ~c]`"]],
	// 2026-10-27 の R84 から、空の流れは書いた `_` と同じなので、知らせも `inc _` と同じ（評価する所で余ったラムダ、R42・R48）。前は空の流れの知らせ（R70、§5 Q57）。
	["R84 空の流れの知らせは書いた `_` と同じ", std("inc []~"), "leftover-lambda", ["`inc`", "評価する所", "R42・R48"]],
];
for (const [name, s, reason, must] of r64Messages) {
	total++;
	try {
		const r = resolve(s);
		const d = r.diagnostics.find((x) => x.reason === reason);
		const missing = d ? must.filter((w) => !d.message.includes(w)) : must;
		if (d && !missing.length) ok(`知らせ ${name}`);
		else fail(`知らせ ${name}`, `無い語: ${missing.join("・")}`, JSON.stringify(r.diagnostics));
	} catch (e) {
		fail(`知らせ ${name}`, `断られた: ${e.gate} ${e.message}`);
	}
}
const r64GateMessages = [
	["R67 裸の ~xs", std("gz2 : ~y ? y"), "G22", ["`~y`", "`[x ~xs]` と括って書きます", "§4 R24・R67"], []],
	// 「R66 値の口の G3」（`inc 1 , 2`）は、片イ（R121）で G3 が無くなったので外した（通ることは上の r64Passes の R66 の行で見る）。
	["R64 口が3つの流れの G19 は参照の口を案内する", std("f3 vs~"), "G19", ["仮引数を括り（`[a b c]`）にして参照で受けます", "§5 Q46"], []],
	["R64 合成全体の口が3つの G19 も", std("inc f3 vs~"), "G19", ["仮引数を括り（`[a b c]`）にして参照で受けます", "§4 R58"], []],
	// 2026-10-26 の確かめの直し：案内は口が3つ以上と数えられる所だけ（もう括りで受けている pb2・口の数の分からない既定値のある関数には付けない）。
	["R64 固定の口の後ろに可変長の口の G19 は案内しない", r64("pb2 vs~"), "G19", ["§5 Q46"], ["参照で受けます"]],
	["R64 口の数の分からない関数の G19 は案内しない", std([...GO_DEFAULT, "go vs~"]), "G19", ["§5 Q46"], ["参照で受けます"]],
	["R67 既定値と組んだ ~y", std("gd2 : x [~y : 5] ? x"), "G22", ["`~y`", "既定値と組んでいますが", "`[x ~xs]` と括って書きます", "§5 Q72"], []],
	// R70 の G19 の2つの言い分（後ろに項が続く空の流れ・評価する所の外の空の流れ）は、2026-10-27 の R84 で `inc []~ 5`・`(inc []~) 5` が通るので無くなった。
	// R66 の右の要素が2項の並びの G3（`fab 1 , 2 3`）は、2026-10-27 の R93 で通るので、残りの形（最後でない括りの `pb2 1 , 2`）で今の言い分を見る。
	// 片イ（R121）で G3 が無くなったので、「R93 残りの形の G3（最後でない括り）」（`pb2 1 , 2`）の行は外した（上の r64Passes の R66 の行で見る）。
	// G15 の言い分（2026-10-26 の確かめの直し。R68 で内側の `_` の読みは決まったので、ここに来た訳を名指しする）
	// 別名の頭の `g2 _ 3`（`g2 : go`、G15）は、2026-10-28 の R105 で既定値の無い口の `_` が消えて通る（`g2 3`）ので、この言い分は無くなった。仮引数の外の内側の `_` の
	// 言い分で見る（前の見本は `g2 _ 3`）。
	// 最後の項の `_` の G15 の言い分（R28 の終わりの問い、§5 Q8）は、2026-10-26 の R28 の書き直しで `go _` が通って無くなった。位置が数えられない形の言い分で見る。
	// 片イ（R126）で G15 は廃止したので、G15 の言い分の2行（`go 1 2 _ 3`・`gz _ 3`）は外した（通ることは「余りと流れ」の R39 の行で見る）。
];
for (const [name, s, gateId, must, mustNot] of r64GateMessages) {
	total++;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if (e.gate === gateId && !missing.length && !extra.length) ok(`言い分 ${name}`);
		else fail(`言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}

// ---------------------------------------------------------------------------
// R73〜R79（2026-10-26、§7.38）：2026-10-25 の答えの2つ目の片（sid c8ccdd69。U の時刻は UTC）
// ---------------------------------------------------------------------------
//
// 主の Claude の問いの表（2026-10-25 21:23 UTC の「問い：僕の傾き」）に U〔答え〕[2026-10-25 21:56 c8ccdd69]「Q62,65 incに$を付けるというアサーションをしてもいい。
// 逆適用の事はいい加減忘れて欲しい。泣くぞｗ」「Q39 アリティ1という意味なら合ってる。」「他は全部、君の傾き通り。」。Q9・Q14 は 21:58 の詳細に U〔答え〕[22:42]
// 「Q9 提案受理」「Q14 …前置演算子のルールは前にも述べたが、カッコ付きの式か単一の対象。つまり単一の対象と言えるものだけが範囲。」、22:43 の言い直しに U〔答え〕
// [22:45]「その方向でお願い。」。
// R73（§5 Q60）：`$v` の輪は、Reader が v をその場で評価しないので通す。輪の中で参照を `@` で開く・`$` の無い v も輪にある・v が値でない形は今のまま name-cycle。
// R74（§5 Q13）：恒等射で始まる合成は、単位律で恒等射が消える（`i inc 1 2` は `inc 1 2`）。恒等射が受けた後に関数が来る形・合成の途中の恒等射は今のまま G18。
// R75（§5 Q62・Q65）：`$` で物にした括りの関数を呼んだ実体の本体で、値の上に余る関数があれば G20。言い分で `$inc` と書く道を案内する。`$` を通さずに呼べば R52 の知らせ。
// R76（§5 Q37）：比べと論理の被演算子・2行以上の手続きの本体の行は評価する所（丸ごとの関数は `_` で知らせる）。`:` の右辺・`$[…]` の中身・器の要素・値の演算子の
// 被演算子（§5 Q22・Q73）・`#` の被演算子（§5 Q73）・`?` の本体の根の丸ごとの関数（G16）は今のまま。
// R77（§5 Q39）：段18 の点なし `[' k]` は口1つ。R78（§5 Q9）：先の分かる `@x` は位置に依らない（実装は前から。G6 の言い分）。
// R79（§5 Q14）：前置 `~` は単一の対象を要素1つの List に持ち上げる（`~1 2 3` は `[1] 2 3`）。`~_` は今のまま G4。→ 2026-10-27 の R88 で G4 は廃止し、`~_` は書いた
// `[_]` と同じ項（いちばん後ろの「R83〜R93」の節）。
// 同じ日の確かめの直し（§7.39）：字下げの本体の返す所（1行だけの本体の行・枝の値・枝の後の既定の行）は G16、手続きの `!_` だけの行は G7、裸のラムダの行は `_`、
// R76 の所の丸ごとの関数は R59・R75 で拾わない、`~$x` は `[$x]`、`$v` の輪の v の右辺の門はその門（最初の版はプロセスが落ちた）、輪の中で `'` で引けば name-cycle。
const R73D = ["i : !_", "mp2 : h [~l] ? [@h,] l~", "bq : [x] ? x inc", "kq : g9 [~t] ? inc @g9 2"];
const r73 = (lines) => std([...R73D, ...[].concat(lines)]);
const r73Passes = [
	// R73（§5 Q60）：`$v` の輪
	["R73 v : f9 1 ⏎ f9 : x ? x , $v ⏎ v（前は name-cycle）", std(["v : f9 1", "f9 : x ? x , $v", "v"]), "v", "A"],
	["R73 f9 が先でも同じ（前は name-cycle）", std(["f9 : x ? x , $v", "v : f9 1", "v"]), "v", "A"],
	["R73 f9 の定義の行の木は輪の無い `$v` と同じ", std(["v : f9 1", "f9 : x ? x , $v"]), "(: f9 (? [x] (, x $v)))", "A"],
	["R73 v : 1 , $v ⏎ v（自分を読む参照を含む値。前は name-cycle）", std(["v : 1 , $v", "v"]), "v", "A"],
	["R73 v : hv [1] ⏎ hv : [x] ? x , $v（括りの関数の実体を通る輪。前は name-cycle）", std(["v : hv [1]", "hv : [x] ? x , $v", "v"]), "v", "A"],
	["R73 v : $v（自分を読む参照。前は name-cycle）", std(["v : $v", "v"]), "v", "A"],
	["R73 輪の外で開くのは通る（`@[$v]`）", std(["v : f9 1", "f9 : x ? x , $v", "@[$v]"]), "@[$v]", "A"],
	// R74（§5 Q13）：恒等射で始まる合成
	["R74 i inc 1 2（`inc 1 2` と同じ。前は G18）", r73("i inc 1 2"), "(construct (apply inc 1) 2)", "A"],
	["R74 !_ inc 1 2（同じ。前は G18）", std("!_ inc 1 2"), "(construct (apply inc 1) 2)", "A"],
	["R74 i f2 1 2（前は G18）", r73("i f2 1 2"), "(apply f2 (construct 1 2))", "A"],
	["R74 i ||inc|| 1 2（前は G18）", r73("i ||inc|| 1 2"), "(construct (apply ||inc|| 1) 2)", "A"],
	["R74 5 i inc 1 2（値の上に積まれた恒等射も。前は G18）", r73("5 i inc 1 2"), "(construct 5 (apply inc 1) 2)", "A"],
	["R74 i i inc 1 2（恒等射どうしも消える。前は G18）", r73("i i inc 1 2"), "(construct (apply inc 1) 2)", "A"],
	["R74 i inc（余るのは inc。前は `(compose i inc)`）", r73("i inc"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	// 2026-10-26 の R28 の書き直しで、`i inc _` は `inc _` と同じく末尾の `_` が消えて inc が残り、根なので `_`（§5 Q13 の残りが閉じた）。R74 の片では `inc _` の
	// R28 の終わり `(apply inc _)` だった。
	["R74 i inc _（R28 で `inc` が残り `_`。R74 の片では終わりの `(apply inc _)`、その前は合成の頭の G5）", r73("i inc _"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R74 !_ inc _（同じ。R74 の片では `(apply inc _)`、その前は G5）", std("!_ inc _"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R74 c8 : i inc ⏎ c8 1 2（名前で包んでも同じ。前は G18）", r73(["c8 : i inc", "c8 1 2"]), "(construct (apply c8 1) 2)", "A"],
	["R74 (i inc) 1 2（括りで包んでも同じ。前は G18）", r73("(i inc) 1 2"), "(construct (apply [i inc] 1) 2)", "A"],
	["R74 i f2 vs~ inc（`f2 vs~ inc` と同じ。前は G18）", r73("i f2 vs~ inc"), "(construct (apply f2 vs~) (unit inc))", "A", { leftoverDiag: ["inc"] }],
	// R75（§5 Q62・Q65）：`$` を通さずに呼ぶ所は今までどおり R52 の知らせ
	["R75 bq 5（`$` を通さずに呼べば R52 の知らせのまま）", r73("bq 5"), "(apply bq 5)", "A", { leftoverDiag: ["inc"] }],
	["R75 mp2 $[[x] ? x + 1] vs（余る関数が無ければ通る）", r73("mp2 $[[x] ? x + 1] vs"), "(apply mp2 (construct $[[x] ? x + 1] vs))", "A"],
	// `mp2 $[[x] ? x inc] []`（呼ばれなければ見ない、A）は、2026-10-27 の片6 の R95（写像の可変長の口に来た空の流れは書いた `_` と同じで、点なしの関数が残る）で、
	// 実体の本体 `[@h,] l~` が本体の根に `[@h,]` の残る G16（R33）になったので、断る側（下の r73Refused）へ移した。呼ばれない本体を見ないことは今のまま（G20 ではない）。
	// R76（§5 Q37）：評価する所を広げる
	["R76 inc == 5（前は `(== inc 5)` の未知）", std("inc == 5"), "(== (unit inc) 5)", "A", { leftoverDiag: ["inc"] }],
	["R76 5 == inc（右の被演算子も）", std("5 == inc"), "(== 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["R76 inc add 5 == 5（並び全体が1つの関数）", std("inc add 5 == 5"), "(== (unit (apply (compose inc add) 5)) 5)", "A", { leftoverDiag: ["(apply (compose inc add) 5)"] }],
	["R76 (inc add 5) == 5（被演算子の括りも丸ごとの関数）", std("(inc add 5) == 5"), "(== (unit [inc add 5]) 5)", "A", { leftoverDiag: ["[inc add 5]"] }],
	["R76 1 & inc | double（論理の被演算子）", std("1 & inc | double"), "(| (& 1 (unit inc)) (unit double))", "A", { leftoverDiag: ["inc", "double"] }],
	["R76 i == 1（恒等射は知らせない）", r73("i == 1"), "(== (unit i) 1)", "A", { diagCount: 0 }],
	["R76 inc []~ == 1（2026-10-27 の R84 で `inc _ == 1` と同じ木。前は R70 の `(unit (apply inc []~))`、その前は G19）", std("inc []~ == 1"), "(== (unit inc) 1)", "A", { leftoverDiag: ["inc"] }],
	["R76 [inc == 2] 5（括りの中の比べ。前は G7）", std("[inc == 2] 5"), "(construct [inc == 2] 5)", "A", { leftoverDiag: ["inc"] }],
	["R76 t : y ? inc == y ⏎ t 3 4（本体の根が A に。前は G2(a)）", std(["t : y ? inc == y", "t 3 4"]), "(construct (apply t 3) 4)", "A", { leftoverDiag: ["inc"] }],
	["R76 字下げの本体の最後が関数（前は G2(a)）", std(["t : a ?", "\ta", "\tinc", "", "t 1 inc"]), "(construct (apply t 1) (unit inc))", "A", { leftoverDiag: ["inc", "inc"] }],
	// 確かめの直し（2026-10-26）：手続きの最後の行は `&` の右の被演算子なので、1行の `y & add y` と同じ答え。枝の値・1行だけの本体・枝の後の既定の行は返す所で
	// G16（下の断られる側）。最初の版の「枝の値が関数」は `(block (: (> y 0) (unit inc)) y)` で通し、「本体の行の恒等射」は `(block (unit !_) y)` で黙って通していた。
	["R76 手続きの最後の行 ⇥y ⏎ ⇥add y の t 1 2（1行の `y & add y` と同じ。前は G2(a)）", std(["t : y ?", "\ty", "\tadd y", "", "t 1 2"]), "(construct (apply t 1) 2)", "A", { leftoverDiag: ["(apply add y)"] }],
	["R76 1行の t : y ? y & add y の t 1 2（上と同じ。前は G2(a)）", std(["t : y ? y & add y", "t 1 2"]), "(construct (apply t 1) 2)", "A", { leftoverDiag: ["(apply add y)"] }],
	["R76 裸のラムダの行は括った行と同じく `_`（[x] ≅ x。前は L のまま）", std(["t : y ?", "\tz ? z + y", "\ty", ""]), "(: t (? [y] (block (unit (? [z] (+ z y))) y)))", "A", { leftoverDiag: ["(? [z] (+ z y))"] }],
	["R76 括ったラムダの行（上と同じ答え）", std(["t : y ?", "\t[z ? z + y]", "\ty", ""]), "(: t (? [y] (block (unit [z ? z + y]) y)))", "A", { leftoverDiag: ["[z ? z + y]"] }],
	["R76 手続きの行の名前の恒等射は知らせない（1行の `i & y` と同じ、§5 Q15）", r73(["t7 : y ?", "\ti", "\ty", ""]), "(: t7 (? [y] (block (unit i) y)))", "A", { diagCount: 0 }],
	["R76 1行の i & y（上と同じ）", r73(["t7 : y ? i & y"]), "(: t7 (? [y] (& (unit i) y)))", "A", { diagCount: 0 }],
	["R76 枝の値の値の上に積まれた関数は R52 のまま", std(["t : y ?", "\ty > 0 : 5 inc", "\ty", ""]), "(: t (? [y] (block (: (> y 0) (construct 5 (unit inc))) y)))", "A", { leftoverDiag: ["inc"] }],
	// 2026-11-04 の寄せ1（R128）から本体の `⇥w : inc inc` は条件 w（未定義の名前）の枝で、右辺は枝の値（返す所、R125）。合成は返す所に残った裸の関数で
	// `(unit …)` と bare-function-return（前は R80 の局所の定義の右辺で、評価する所から除いて `(compose inc inc)` のまま知らせなかった）。
	["R76 本体の w : inc inc は枝の値で返す所（寄せ1。前は局所の定義の右辺は除く、Q50）", std(["t : y ?", "\tw : inc inc", "\ty", ""]), "(: t (? [y] (block (: w (unit (compose inc inc))) y)))", "A", { severities: ["information/bare-function-return", "information/undefined-name"] }],
	["R76 名前の定義の右辺は今のまま L（Q50）", std(["c1 : inc inc", "c1 5"]), "(apply c1 5)", "A"],
	// 片イ（R123）：`,` の被演算子に丸ごと残った関数は `_`（木は `(unit inc)`）と leftover-lambda（前は `(, inc 3)` で、器の要素は関数を値として持った）。
	["R76 器の要素（片イの R123 で inc は `_`）（前は `(, inc 3)`）", std("inc , 3"), "(, (unit inc) 3)", "A", { diagCount: 1, leftoverDiag: ["inc"] }],
	// 2026-10-28 の片9b（R116、§5 Q73 の `#` の答え）：`#` の右の被演算子は評価する所になり、裸の inc は `_` で知らせる（行の中で直した。前は `(# 5 inc)` の未知）。
	["R76 `#` の右の被演算子（片9b の R116 で評価する所。前は今のままの `(# 5 inc)`）", std("5 # inc"), "(# 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	// 確かめの直し（2026-10-26）：R76 の所に丸ごと残った関数は、R59・R75 の受け皿（値の上に積まれて余る関数）に拾わない。最初の版は G20 で断っていた。
	["R76 $[x ? inc == x]（`$` の先は1つの関数。最初の版は G20）", std("$[x ? inc == x]"), "$[x ? inc == x]", "A", { leftoverDiag: ["inc"] }],
	["R76 t9 : x ? inc == x ⏎ $t9（名前の先も同じ。最初の版は G20）", std(["t9 : x ? inc == x", "$t9"]), "$t9", "A", { leftoverDiag: ["inc"] }],
	["R76 mp2 $[[x] ? inc == x] vs（R75 の実体も同じ。最初の版は G20）", r73("mp2 $[[x] ? inc == x] vs"), "(apply mp2 (construct $[[x] ? inc == x] vs))", "A", { leftoverDiag: ["inc"] }],
	["R76 bq2 : [x] ? x == inc ⏎ @[$bq2] 5（最初の版は G20）", r73(["bq2 : [x] ? x == inc", "@[$bq2] 5"]), "(apply @[$bq2] 5)", "A", { leftoverDiag: ["inc"] }],
	// 前の綴りの守り（R76 の前は、行 `⇥inc` で本体の根を未知にしていた。同じ形の守りは、上の節で行の根が未知の `⇥[,] x` に替えた）
	["R76 r2 1 2（前の綴り。前は未知）", src(["inc : x ? x + 1", "r2 : x y ?", "\tinc (r2 1) y", "\tinc", "", "r2 1 2"]), "(apply r2 (construct 1 2))", "A"],
	["R76 r2 1 2 inc（前の綴り。前は G2(a)）", src(["inc : x ? x + 1", "r2 : x y ?", "\tinc (r2 1) y", "\tinc", "", "r2 1 2 inc"]), "(construct (apply r2 (construct 1 2)) (unit inc))", "A"],
	["R76 Q28 h → f → g（前の綴り。前は G2(a)）", src(["inc : x ? x + 1", "h : x ?", "\tf x", "\tinc", "", "f : x ?", "\tg x", "\th x", "", "g : x ? f x", "g 5 inc"]), "(construct (apply g 5) (unit inc))", "A"],
	// 前の綴りの AF1（`f : [x ~xs] ?` ⏎ `⇥[z ? hh1 z]`）は、確かめの直し（2026-10-26）から1行だけの本体の返す所で G16（下の断られる側。1行の
	// `f : [x ~xs] ? [z ? hh1 z]` と同じ）。最初の版は行の `[z ? hh1 z]` を `_` にして通していた。
	// R77（§5 Q39）：段18 の点なしは口1つ
	["R77 [' 0] [1 2] 5（`([' 0] [1 2]) 5`。前は未知）", std("[' 0] [1 2] 5"), "(construct (apply [' 0] [1 2]) 5)", "A"],
	["R77 [' 0] [1 2 3] inc（引いた値の後ろに inc が余る。前は G2(a)）", std("[' 0] [1 2 3] inc"), "(construct (apply [' 0] [1 2 3]) (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["R77 [' 0] [1 2 3] inc inc（前は G2(a)）", std("[' 0] [1 2 3] inc inc"), "(construct (apply [' 0] [1 2 3]) (unit (compose inc inc)))", "A"],
	["R77 [' 0] [1 2 3] inc 4（`1 (inc 4)`。前は G2(a)）", std("[' 0] [1 2 3] inc 4"), "(construct (apply [' 0] [1 2 3]) (apply inc 4))", "A"],
	["R77 [' 0] [1 2 3] f2 5（前は G2(a)）", std("[' 0] [1 2 3] f2 5"), "(construct (apply [' 0] [1 2 3]) (unit (apply f2 5)))", "A"],
	["R77 [' 0] [1 2 3] add 5 6（前は G2(a)）", std("[' 0] [1 2 3] add 5 6"), "(construct (apply [' 0] [1 2 3]) (apply add (construct 5 6)))", "A"],
	["R77 [' 0] inc [1 2 3] double（前は G2(a)）", src([INC, DOUBLE, "[' 0] inc [1 2 3] double"]), "(construct (apply (compose [' 0] inc) [1 2 3]) (unit double))", "A"],
	["R77 [' 0] inc [1 2 3] head（前は G2(a)）", src([INC, "head : [x ~xs] ? x", "[' 0] inc [1 2 3] head"]), "(construct (apply (compose [' 0] inc) [1 2 3]) (unit head))", "A"],
	["R77 [' 0] [[1 2] [3 4]]~（口1つの書き下し。前は G19）", std("[' 0] [[1 2] [3 4]]~"), "(apply [' 0] [[1 2] [3 4]]~)", "A"],
	["R77 [' 0] !_（口が1つ残った関数の `!_` は恒等射、R46。前は G7）", std("[' 0] !_"), "(unit (compose [' 0] !_))", "A"],
	// R78（§5 Q9）：先の分かる `@x` は位置に依らない（実装は R49・R60 の片から。HEAD と同じ答え）
	["R78 5 @[$inc] 3", std("5 @[$inc] 3"), "(construct 5 (apply @[$inc] 3))", "A"],
	["R78 inc @[$inc] 5", std("inc @[$inc] 5"), "(apply (compose inc @[$inc]) 5)", "A"],
	["R78 @[$inc] inc 5（頭で右が関数でも）", std("@[$inc] inc 5"), "(apply (compose @[$inc] inc) 5)", "A"],
	["R78 5 @[$vs]（値を読む参照）", std("5 @[$vs]"), "(construct 5 @[$vs])", "A"],
	["R78 kq : g9 [~t] ? inc @g9 2 ⏎ kq $inc vs（実体の中の `@g9`）", r73("kq $inc vs"), "(apply kq (construct $inc vs))", "A"],
	// R79（§5 Q14）：前置 `~`
	["R79 ~1 2 3（`[1] 2 3`。前は G4）", std("~1 2 3"), "(construct ~1 2 3)", "A"],
	["R79 inc ~5（前は G4）", std("inc ~5"), "(apply inc ~5)", "A"],
	["R79 ~5（1項。前は未知の根）", std("~5"), "~5", "A"],
	["R79 ~vs 1（前は G4）", std("~vs 1"), "(construct ~vs 1)", "A"],
	["R79 ~(1 2 3) 4（括りの式に係る。前は G4）", std("~(1 2 3) 4"), "(construct ~[1 2 3] 4)", "A"],
	["R79 ~inc 5（`[inc] 5` と同じ。前は G4）", std("~inc 5"), "(apply ~inc 5)", "A"],
	["R79 kk : [~x] ? x ⏎ kk ~5（括りの仮引数の `[~x]` は今のまま）", std(["kk : [~x] ? x", "kk ~5"]), "(apply kk ~5)", "A"],
	["R79 $~vs（`$[vs]` と同じ値を読む参照。前は G20）", std("$~vs"), "$~vs", "A"],
	["R79 $[~vs]（前は G20）", std("$[~vs]"), "$[~vs]", "A"],
	// 確かめの直し（2026-10-26）：前置の印は核に近い物から結ぶ（R53・R57）ので `~$inc` は `~($inc)`、つまり `[$inc]`（前は表に無い組み合わせで未知）
	["R79 ~$inc 5（`[$inc] 5`。前は G7）", std("~$inc 5"), "(construct ~$inc 5)", "A"],
	["R79 ~$vs（`[$vs]`。前は未知）", std("~$vs"), "~$vs", "A"],
	["R79 [$inc] 5（上と同じ答え）", std("[$inc] 5"), "(construct [$inc] 5)", "A"],
	// R73 の確かめの直し（2026-10-26）：ノルムは数えるだけで参照の先を読まない（`||$_||` は 1、R56）ので、輪の中でも通る
	["R73 v : 1 , ||$v||", src(["v : 1 , ||$v||", "v"]), "v", "A"],
	// 閉じる問い（答えの記録。今の実装がもう答えどおり）
	["Q46 add [5]~ 3（要素1つの流れは要素そのもので `5 3`）", std("add [5]~ 3"), "(construct (apply add [5]~) 3)", "A"],
	["Q47 add [0 vs~]~（新しい綴りは足さない。初期値を流れの頭に置く）", std("add [0 vs~]~"), "(apply add [0 vs~]~)", "未知"],
	// 片イ（R123）：inc・double は `,` の被演算子に丸ごと残った関数なので `_` と leftover-lambda（前は `(, inc double)`・`(, inc (, $!_ double))`）。
	["Q42 inc , !_ , double（器の中の恒等射は消えて2つ）（片イの R123 で inc・double は `_`）", std("inc , !_ , double"), "(, (unit inc) (unit double))", "A", { leftoverDiag: ["inc", "double"] }],
	["Q42 inc , $!_ , double（残したいなら `$!_`）（片イの R123 で inc・double は `_`）", std("inc , $!_ , double"), "(, (unit inc) (, $!_ (unit double)))", "A", { leftoverDiag: ["double", "inc"] }],
	// 片イ（R126）：恒等射が受けた後の関数・合成の途中の恒等射は単位律の側に決まり、恒等射を消した並びで畳み直す（前は G18）。`i [,] 5 inc` は `[,] 5 inc` で、
	// 種類の未知な `[,] 5` の後ろに積む予想（R120、前は G2(a)）。根に余った inc は `_` と leftover-lambda。
	["R74 i 5 inc（恒等射が受けた後に関数）（前は G18）", r73("i 5 inc"), "(construct 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["R74 inc i double 1 2（合成の途中の恒等射）（前は G18）", r73("inc i double 1 2"), "(construct (apply (compose inc double) 1) 2)", "A", { leftoverDiag: [] }],
	["R74 i 1 2 inc（前は G18）", r73("i 1 2 inc"), "(construct 1 2 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["R74 i [,] 5 inc（`[,] 5 inc` と同じ）（前は G2(a)、その前は G18）", r73("i [,] 5 inc"), "(construct (apply [,] 5) (unit inc))", "未知", { leftoverDiag: ["inc"] }],
	// 片イ（R125）：G16 は廃止。本体の返す所（1行の本体の根・1行だけの本体の行・枝の値・枝の後の既定の行）に残った裸の関数は `(unit …)` と
	// bare-function-return、恒等射は知らせない。括りの関数の実体（mp2 の `[@h,] _`・gi・AF1 の前の綴り）も同じ。
	["R75 mp2 $[[x] ? x inc] []（写像は呼ばれず G20 ではない。片6 の R95 で本体 `[@h,] _`）（前は G16、その前は A）", r73("mp2 $[[x] ? x inc] []"), "(apply mp2 (construct $[[x] ? x inc] []))", "A", { severities: ["information/bare-function-return"] }],
	["R76 t : y ? inc（`?` の本体の根の丸ごとの関数、R33）（前は G16）", std("t : y ? inc"), "(: t (? [y] (unit inc)))", null, { severities: ["information/bare-function-return"] }],
	["R76 1行だけの本体 ⇥inc（1行の `t : y ? inc` と同じ。最初の版は `_` で通した）（前は G16）", std(["t : y ?", "\tinc", ""]), "(: t (? [y] (block (unit inc))))", null, { severities: ["information/bare-function-return"] }],
	["R76 1行だけの本体 ⇥[+ m] の adder2 5 3（1行の `adder2 : m ? [+ m]` と同じ。最初の版は A）（前は G16）", std(["adder2 : m ?", "\t[+ m]", "", "adder2 5 3"]), "(construct (apply adder2 5) 3)", "A", { severities: ["information/bare-function-return"] }],
	["R76 1行だけの本体 ⇥add y（最初の版は A）（前は G16）", std(["t : y ?", "\tadd y", "", "t 1 2"]), "(construct (apply t 1) 2)", "A", { severities: ["information/bare-function-return"] }],
	["R76 1行だけの本体 ⇥(inc)（前は G16）", std(["t : y ?", "\t(inc)", ""]), "(: t (? [y] (block (unit [inc]))))", null, { severities: ["information/bare-function-return"] }],
	["R76 1行だけの本体 ⇥!_（1行の `t : y ? !_` と同じ。恒等射は知らせない）（前は G16）", std(["t : y ?", "\t!_", ""]), "(: t (? [y] (block (unit !_))))", null, { diagCount: 0 }],
	["R76 1行だけの本体 ⇥z ? z + y（裸のラムダ）（前は G16）", std(["t : y ?", "\tz ? z + y", ""]), "(: t (? [y] (block (unit (? [z] (+ z y))))))", null, { severities: ["information/bare-function-return"] }],
	["R76 1行だけの本体 ⇥[z ? z + y]（括ったラムダ、上と同じ）（前は G16）", std(["t : y ?", "\t[z ? z + y]", ""]), "(: t (? [y] (block (unit [z ? z + y]))))", null, { severities: ["information/bare-function-return"] }],
	["R76 枝の値が関数（最初の版は `_` で通した）（前は G16）", std(["t : y ?", "\ty > 0 : inc", "\ty", ""]), "(: t (? [y] (block (: (> y 0) (unit inc)) y)))", null, { severities: ["information/bare-function-return"] }],
	["R76 枝の値が恒等射（知らせない）（前は G16）", std(["t : y ?", "\ty > 0 : !_", "\ty", ""]), "(: t (? [y] (block (: (> y 0) (unit !_)) y)))", null, { diagCount: 0 }],
	["R76 枝の値が裸のラムダ（前は G16）", std(["t : y ?", "\ty > 0 : z ? z + y", "\ty", ""]), "(: t (? [y] (block (: (> y 0) (unit (? [z] (+ z y)))) y)))", null, { severities: ["information/bare-function-return"] }],
	["R76 枝の後の既定の行が関数（前は G16）", std(["t : y ?", "\ty > 0 : 1", "\tinc", ""]), "(: t (? [y] (block (: (> y 0) 1) (unit inc))))", null, { severities: ["information/bare-function-return"] }],
	["R76 1行だけの本体 ⇥[+ inc]（区間の綴りは種類が未知でも、1行の `q : x ? [+ inc]` と同じ）（前は G16）", std(["q : x ?", "\t[+ inc]", ""]), "(: q (? [x] (block (unit [+ inc]))))", null, { severities: ["information/bare-function-return"] }],
	["R76 枝の値の区間の綴り（前は G16）", std(["q : x ?", "\tx > 0 : [+ inc]", "\tx", ""]), "(: q (? [x] (block (: (> x 0) (unit [+ inc])) x)))", null, { severities: ["information/bare-function-return"] }],
	["R76 括りの関数の実体の1行だけの本体の区間の綴り（前は G16）", std(["gi : [x ~xs] ?", "\t[+ inc]", "", "gi 1 2"]), "(apply gi (construct 1 2))", "A", { severities: ["information/bare-function-return"] }],
	["R76 括りの関数の実体の1行だけの本体（AF1 の前の綴り）（前は G16）", src(["g : [say] ? say 1", "f : [x ~xs] ?", "\t[z ? hh1 z]", "", "kk : y ? f [1 2]", "hh1 : y ? (g [say : [w ? f [1 2]]]) y"]), "(: hh1 (? [y] (construct [g [say : [w ? f [1 2]]]] y)))", null, { severities: ["information/bare-function-return"] }],
	// 片イ（R120）：口1つで閉じた `[' 0]` が引いた物（種類の未知な項）の後ろの項は積む予想（前は G2(a)）。STD の fs は `$inc , $double , 3` で、
	// `[' 0] fs` は番地（値）なので A（R123）。
	["R77 inc [' 0] [1 2] 5（引いた物が未知で、後ろに項。前は未知の根）（前は G2(a)）", std("inc [' 0] [1 2] 5"), "(construct (apply (compose inc [' 0]) [1 2]) 5)", "未知"],
	["R77 add [' 0] 1 2 3（同じ。前は未知の根）（前は G2(a)）", std("add [' 0] 1 2 3"), "(construct (apply (compose add [' 0]) (construct 1 2)) 3)", "未知"],
	["R77 [' 0] fs 5（片イの R123 で fs の要素は番地）（前は G2(a)、その前は未知の根）", std("[' 0] fs 5"), "(construct (apply [' 0] fs) 5)", "A"],
	["R77 [@ 0] [1 2] 5（`@` で引いた物は未知。前は未知の根）（前は G2(a)）", std("[@ 0] [1 2] 5"), "(construct (apply [@ 0] [1 2]) 5)", "未知"],
	["R77 [' 0] vs~（書き下しの頭から引いた物が未知で余りがある）（前は G2(a)、その前は G19）", std("[' 0] vs~"), "(apply [' 0] vs~)", "未知"],
	// 片イ（R126）：G6 は廃止。先の分からない `@x` は種類の未知な項と同じに畳み、値の後ろに積む予想（x は未定義で undefined-name）。
	["R78 5 @x（前は G6）", std("5 @x"), "(construct 5 @x)", "未知", { severities: ["information/undefined-name"] }],
];
const r73Refused = [
	// R73：今のまま name-cycle の形
	["R73 輪の中で参照を `@` で開く（v = f9 1 = @$v）", std(["v : f9 1", "f9 : x ? @[$v]", "v"]), "name-cycle"],
	["R73 輪に `$` の無い v もある", std(["v : f9 1", "f9 : x ? x , $v , v", "v"]), "name-cycle"],
	// 「R73 v が関数（値を読む参照の読みが外れる）」（`v : add (f9 1)` ⏎ `f9 : x ? x , $v` ⏎ `v 3`、name-cycle）は、2026-10-27 の片8 の R103（持ち上げだけを通る輪は
	// 値の輪ではない）で通る（いちばん後ろの「R99〜R104」の節）。
	// 確かめの直し（2026-10-26）：v の右辺が輪の外の門に当たる形。最初の版は、最後の見直しが v を解き直すたびに見直しの所を足し続け、プロセスがヒープを使い
	// 切って落ちた（HEAD は name-cycle）。`$v` を輪の外の値の `$u` に替えた形と同じ門で断る。
	["R73 v : $v + 1（`$u + 1` と同じ G21。最初の版は落ちた）", src(["v : $v + 1", "v"]), "G21"],
	["R73 v : 1 + $v", src(["v : 1 + $v", "v"]), "G21"],
	["R73 v : $v == 1", src(["v : $v == 1", "v"]), "G21"],
	["R73 v : |$v|", src(["v : |$v|", "v"]), "G21"],
	["R73 v : [$v]~", src(["v : [$v]~", "v"]), "G20"],
	["R73 v : 1 , $v ⏎ w : $w + 1（別の定義でも）", src(["v : 1 , $v", "w : $w + 1", "w"]), "G21"],
	// 輪の中で仮に通した参照から `'` で引く形：`'` が参照の先を読むかは決まっていない（`$vs ' 0` は未知）。読むなら v の値が自分に依るので、`@[$v]` と同じ
	// name-cycle に倒す（§5 Q60 の残り。最初の版は通していた）
	["R73 v : 1 , ($v ' 0)", src(["v : 1 , ($v ' 0)", "v"]), "name-cycle"],
	["R73 v : f9 1 ⏎ f9 : x ? x , ($v ' 1)", std(["v : f9 1", "f9 : x ? x , ($v ' 1)", "v"]), "name-cycle"],
	// R74：今のまま G18・G2(a)
	// 片イ（R126・R120）で、R74 の4行は上の r73Passes へ移した。
	// R75（§5 Q62・Q65）
	// `mp2 $[[x] ? x inc] []`（G16）は、片イ（R125）で上の r73Passes へ移した。
	["R75 mp2 $[[x] ? x inc] vs（呼んだ実体で inc が値の上に余る。前は知らせて通る）", r73("mp2 $[[x] ? x inc] vs"), "G20", [["mp2", "$L [N…]"]]],
	["R75 mp2 $bq vs（名前の括りの関数も。前は知らせて通る）", r73("mp2 $bq vs"), "G20", [["mp2", "$L [N…]"]]],
	["R75 @[$[[x] ? x inc]] 5（開いて直に呼んでも。前は知らせて通る）", r73("@[$[[x] ? x inc]] 5"), "G20"],
	["R75 pp2 の部分適用を `$` で（前は知らせて通る）", r73(["pp2 : [a] [b] ? a inc", "mp2 $(pp2 [1]) vs"]), "G20", [["mp2", "$L [N…]"]]],
	["R75 p : add (5 inc) ⏎ $p（今のまま G20、§5 Q62）", std(["p : add (5 inc)", "$p"]), "G20"],
	// R76：今のまま
	["R76 !_ == 1（中置の被演算子の `!_` は今のまま G7、§5 Q15）", std("!_ == 1"), "G7"],
	// `inc + 1 5`（値の演算子の被演算子は今のまま G7、§5 Q22）は、2026-10-27 の R87（§5 Q73 の答え）で通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	// `t : y ? inc`（G16）は、片イ（R125）で上の r73Passes へ移した。
	// `$[x ? inc == x]` は、最初の版では R59 の受け皿が R76 の所の丸ごとの関数も拾って G20 だった（言い分も「値の上に積まれた」と事実と違った）。確かめの直し
	// （2026-10-26）から、R59・R75 が断るのは値の上に積まれて余る関数だけで、通る側（上の r73Passes）。
	// 返す所（確かめの直し、2026-10-26）：1行の本体の根と同じく G16
	// 片イ（R125）で G16 は廃止。返す所の15行は上の r73Passes へ移した。
	// 2行以上の手続きの `!_` だけの行は、`!_ & a`（中置の被演算子の `!_`、§5 Q15）と同じ G7（最初の版は `(unit !_)` で黙って通した）
	["R76 手続きの行の !_（`!_ & y` と同じ G7）", std(["t : y ?", "\t!_", "\ty", ""]), "G7"],
	["R76 手続きの最後の行の !_（`y & !_` と同じ G7）", std(["t : y ?", "\ty", "\t!_", ""]), "G7"],
	["R76 1行の t : y ? y & !_（上と同じ）", std(["t : y ? y & !_"]), "G7"],
	// R77：口1つで閉じた後ろ
	// 片イ（R120）で G2(a) は廃止。R77 の5行は上の r73Passes へ移した。
	// R78：先の分からない `@x` は今のまま G6
	// 片イ（R126）で G6 は廃止。`5 @x` は上の r73Passes へ移した。
	// 値の定義の名前の `@p`（`p : $inc` ⏎ `5 @p 3`）は、2026-10-26 の R82（§5 Q45 の残りの答え）から右辺の印を読み、`5 @[p] 3` と同じく通る（いちばん後ろの
	// 「R80〜R82」の節。前は印を読まない入力の項で G6）。
	// R79：仮引数の裸の `~xs` は G22。`~_ 5`（`[_]` の読みが決まらない、G4）は、2026-10-27 の R88（§5 Q14 の残りの答え）で通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	["R79 gx : a ~y ? a（仮引数の裸の `~xs` は今のまま G22）", std(["gx : a ~y ? a", "gx 1 2 3"]), "G22"],
	// 閉じる問い（今のまま断る）
	["Q49 [<<] vs~（今のまま G19）", std("[<<] vs~"), "G19"],
	["Q46 f3 vs~（口が3つ以上は今のまま G19）", std("f3 vs~"), "G19"],
	// 片イ（R123）で STD の fs は `$inc , $double , 3`（要素は番地で値）になり、`fs~ 5` は撒いた値の後ろに 5 を積んで通るので、中身に関数が見える
	// 構造体 m（欄 say が関数）を撒く形にした（前は `fs~ 5`）。
	["Q20 m~ 5（今のまま G7）（前は `fs~ 5`）", std([...M, "m~ 5"], { omit: ["adder"] }), "G7"],
];
for (const [name, s, want, kind, extra] of r73Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r73Refused) checkRefused(name, s, want, inst);
const r73Messages = [
	["R76 評価する所の知らせ", std("inc == 5"), "leftover-lambda", ["`inc`", "評価する所", "R76", "§5 Q37", "`$`"]],
	// 確かめの直し（2026-10-26）：比べの被演算子では `$inc == 5` が G7（R62）なので、`$` を付ける案内をしない。論理の被演算子・手続きの行では案内する
	["R76 比べの被演算子の知らせは `$` を案内しない", std("inc == 5"), "leftover-lambda", ["比べの被演算子", "§4 R62"], ["番地にします"]],
	["R76 論理の被演算子の知らせは `$` を案内する", std("1 & inc"), "leftover-lambda", ["論理の被演算子", "`$` を付けて番地にします"], ["比べの被演算子"]],
];
for (const [name, s, reason, must, mustNot = []] of r73Messages) {
	total++;
	try {
		const r = resolve(s);
		const d = r.diagnostics.find((x) => x.reason === reason);
		const missing = d ? must.filter((w) => !d.message.includes(w)) : must;
		const extra = d ? mustNot.filter((w) => d.message.includes(w)) : [];
		if (d && !missing.length && !extra.length) ok(`知らせ ${name}`);
		else fail(`知らせ ${name}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, JSON.stringify(r.diagnostics));
	} catch (e) {
		fail(`知らせ ${name}`, `断られた: ${e.gate} ${e.message}`);
	}
}
const r73GateMessages = [
	["R75 呼んだ実体の余る関数の G20 は `$inc` を案内し、Q65 を名指す", r73("mp2 $[[x] ? x inc] vs"), "G20", ["`$` を付けて `$inc` と書きます", "§5 Q65 の答え", "R75"], ["逆適用"]],
	// 確かめの直し（2026-10-26）
	// 「R76 字下げの本体の返す所の G16 は置かれた所を言う」（`t : y ?` ⏎ `⇥inc`）は、片イ（R125）で G16 が無くなったので外した（知らせは上の r73Passes の行で見る）。
	["R76 手続きの行の `!_` の G7 は `!_ & a` と同じ所だと言う", std(["t : y ?", "\t!_", "\ty", ""]), "G7", ["2行以上の手続きの本体の行", "`!_ & a`", "§5 Q15"], []],
	["R73 v の右辺の門は、その門の言い分", src(["v : $v + 1", "v"]), "G21", ["`$v + 1`"], ["輪："]],
	["R75 名前の先の余る関数の G20 も `$inc` を案内し、Q62 を名指す", std(["p : add (5 inc)", "$p"]), "G20", ["`$inc`", "Q62 の答え", "R75"], ["逆適用"]],
	["R75 余ったのが受けた後の関数なら括って案内する", std(["p : add (5 add 1)", "$p"]), "G20", ["括って `$[…]` と書きます"], ["`$[(apply"]],
	// 「R78 先の分からない `@x` の G6」（`5 @x`）は、片イ（R126）で G6 が無くなったので外した（通ることは上の r73Passes の R78 の行で見る）。
	// `~_` の G4 の言い分は、2026-10-27 の R88 で G4 が無くなったので外した。
	["R73 輪の中で開いた所の言い分は輪の道筋", std(["v : f9 1", "f9 : x ? @[$v]", "v"]), null, ["輪：`v` → `f9` の本体 → `v`"], []],
];
for (const [name, s, gateId, must, mustNot] of r73GateMessages) {
	total++;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if ((gateId === null || e.gate === gateId) && !missing.length && !extra.length) ok(`言い分 ${name}`);
		else fail(`言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}

// ---------------------------------------------------------------------------
// R80〜R82（2026-10-26。2026-10-25 の §5 Q10・Q45 の答え：主の Claude の問いの表の傾き「Q10 | … | 枝の無い本体なら局所の定義、で今のまま」「Q45 | … | 単相化
// する（引数で決まる多相は単相化の線）」に U〔答え〕[2026-10-25 08:44 c8ccdd69]「Q10 と Q45 は、君の傾きを採用できそうだと思う。」）
// ---------------------------------------------------------------------------
// R80：枝の無い関数の本体の、左が名前1つの `:` の行は局所の定義で、どの使い方でも右辺の種類で読む（R54 は `$名前` の先だけ）。局所の定義の行は手続きの行に
// 数えない。局所の値の輪は name-cycle、局所の関数の再帰は今のまま未知。R81：素の関数も実引数の印で実体を作る（印の無い実引数は今のまま本体を1回だけ）。
// R82：前置 `@` の値の定義の名前も右辺の印を読む（`@p` は `@[p]` と同じ）。
// 2026-11-04 の寄せ1（R128〜R130）で R80 は廃止：本体の字下げの `:` の行は、左が名前1つでも枝（match_case）で、本体に局所の定義は無い。下の「R80」の行は、
// 1行目が条件の名前（未定義の名前で `_`、undefined-name）の枝で、`$名前` は本体の行を見ずに零射の番地（細目7）、値の `z ? z * z` などは返す所に残った裸の
// 関数で `(unit …)`（R125・R129）。答えはファイルに同じ形を書いた時と同じ（局所の値の輪・局所の関数の番地は通り、`$[sq double]`・番地の字面の n9 と ww は
// ファイルの未定義の名前と同じく G20・G21）。使う行を枝の前に置いた形は R130 で断る。名前の「局所の …」は R80 の時の読みの記録。
const r80Passes = [
	// R80
	["R80 局所の関数を裸で呼ぶ sq x（寄せ1 から sq は未定義の名前。前は G7）", trial(["tt : x ?", "\tsq : z ? z * z", "\tsq x", "", "tt 3"]), "(apply tt 3)", "A"],
	["R80 その定義の行の木（寄せ1 から sq : z ? z * z は枝、sq x は既定の行）", trial(["tt : x ?", "\tsq : z ? z * z", "\tsq x"]), "(: tt (? [x] (block (: sq (unit (? [z] (* z z)))) (construct sq x))))", "A", { diag: "sq", severities: ["information/bare-function-return", "information/undefined-name"] }],
	// 「使う行が定義の行の前（順序非依存）」と `$[sq double]` は、寄せ1 で R130 と R59 の G20 に変わった（下の r80Refused）。
	["R80 $||sq||（寄せ1 から sq は未定義の名前で、`$||_||` は値の持ち上げ。前は G20）", trial(["tt : x ?", "\tsq : z ? z * z", "\t$||sq||"]), "(: tt (? [x] (block (: sq (unit (? [z] (* z z)))) $||sq||)))", "A", { severities: ["information/bare-function-return", "information/undefined-name", "warning/dollar-non-function"] }],
	["R80 局所の名前を裸で書いた別名 r : sq ⏎ map $r x（寄せ1 から r は未定義の名前。前は G20）", trial(["tt : x ?", "\tsq : z ? z * z", "\tr : sq", "\tmap $r x", "", "tt vs"]), "(apply tt vs)", "A"],
	["R80 局所の名前を括った別名 q : [sq] ⏎ map $q x（寄せ1 から q は未定義の名前。前は G20）", trial(["tt : x ?", "\tsq : z ? z * z", "\tq : [sq]", "\tmap $q x", "", "tt vs"]), "(apply tt vs)", "A"],
	["R80 w : inc ⏎ v : w ⏎ map $v x（寄せ1 から枝が2つ。前は G20）", trial(["tt : x ?", "\tw : inc", "\tv : w", "\tmap $v x"]), "(: tt (? [x] (block (: w (unit inc)) (: v w) (apply map (construct $v x)))))", "A"],
	["R80 w : _ ⏎ v : w ⏎ map $v x（前は G20）", trial(["tt : x ?", "\tw : _", "\tv : w", "\tmap $v x"]), "(: tt (? [x] (block (: w _) (: v w) (apply map (construct $v x)))))", "A"],
	["R80 その map の実体（`$v` は `$_` と同じ零射の番地 `$L`。寄せ1 から v は未定義の名前）", trial(["tt : x ?", "\tw : _", "\tv : w", "\tmap $v x"]), "(: map (? [f [~t]] (inst $L A (apply [@f,] t~))))", null, { at: 6 }],
	["R80 v : [w] ⏎ w : inc ⏎ $v（寄せ1 から枝が2つ。前は G20）", trial(["tt : x ?", "\tv : [w]", "\tw : inc", "\t$v"]), "(: tt (? [x] (block (: v [w]) (: w (unit inc)) $v)))", "A"],
	["R80 本体の局所の定義 yy : inc ⏎ yy a（寄せ1 から条件 yy の枝と既定の行。前は G7）", std(["t : a ?", "\tyy : inc", "\tyy a"]), "(: t (? [a] (block (: yy (unit inc)) (construct yy a))))", "A", { diag: "yy" }],
	// 同じ条件の枝が2つでも断らない（R128：本体の行の順には意味がある）。前は局所の定義として読めない所（同じ範囲に2つ）で G7（上の gapRefused にあった）。
	["寄せ1 yy : inc ⏎ yy : double ⏎ yy a（同じ条件の枝2つ。前は G7）", std(["t : a ?", "\tyy : inc", "\tyy : double", "\tyy a"]), "(: t (? [a] (block (: yy (unit inc)) (: yy (unit double)) (construct yy a))))", "A", { diag: "yy" }],
	["R80 局所の定義の行は値の行に数えない ⇥yy : 5 ⏎ ⇥a の t 1 inc（寄せ1 から yy : 5 は消える枝。前は G2(a)）", std(["t : a ?", "\tyy : 5", "\ta", "", "t 1 inc"]), "(construct (apply t 1) (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["R80 外の仮引数を書いた k : z ? z + x ⏎ k 5（寄せ1 から k は未定義の名前で `_ 5`。前は閉包）", trial(["tt : x ?", "\tk : z ? z + x", "\tk 5", "", "tt 1"]), "(apply tt 1)", "A"],
	["R80 局所の値 v : 5 ⏎ v + y（寄せ1 から v は未定義の名前）", std(["t : y ?", "\tv : 5", "\tv + y", "", "t 1"]), "(apply t 1)", "A"],
	["R80 局所の器を撒く v : 1 , 2 ⏎ add v~（寄せ1 から v は未定義の名前）", std(["t : y ?", "\tv : 1 , 2", "\tadd v~", "", "t 1"]), "(apply t 1)", "A"],
	// 局所の名前の番地の字面の n9・ずらした点の ww は、寄せ1 で未定義の名前になり、ファイルの `($vs + zz) == $vs` と同じ G21（下の r80Refused）。
	["R80 局所の w : _ の $w は零射の番地（hx の実体 `N $L`。寄せ1 から w は未定義の名前）", std(["hx : [k] f ? @f 1", "t : y ?", "\tw : _", "\thx [1] $w"]), "(: hx (? [[k] f] (inst N $L (apply @f 1))))", null, { at: -2 }],
	["R80 局所の w : 5 の $w（寄せ1 から零射の番地で hx の実体 `N $L`。前は値を読む参照の `N $N`）", std(["hx : [k] f ? @f 1", "t : y ?", "\tw : 5", "\thx [1] $w"]), "(: hx (? [[k] f] (inst N $L (apply @f 1))))", null, { at: -2 }],
	// 局所の値の輪・局所の関数を挟む値の輪（name-cycle）と局所の関数の番地（G7）は、寄せ1 で本体の行が枝になって輪も番地も無くなり、通る（前は下の r80Refused）。
	["寄せ1 w : v ⏎ v : w ⏎ v + 1（輪でない。前は R80 で name-cycle）", std(["t : y ?", "\tw : v", "\tv : w", "\tv + 1"]), "(: t (? [y] (block (: w v) (: v w) (+ v 1))))", "A"],
	["寄せ1 v : f9 1 ⏎ f9 : z ? v ⏎ v（輪でない。前は R80 で name-cycle）", std(["t : y ?", "\tv : f9 1", "\tf9 : z ? v", "\tv"]), "(: t (? [y] (block (: v (construct f9 1)) (: f9 (unit (? [z] v))) v)))", "A"],
	["寄せ1 lf : $inc ⏎ lf + 1（lf は未定義の名前で `_ + 1`。前は G7）", std(["t : y ?", "\tlf : $inc", "\tlf + 1"]), "(: t (? [y] (block (: lf $inc) (+ lf 1))))", "A", { diag: "lf" }],
	// R81
	["R81 use $inc 5 3（余りを積む。前は G2(a)）", std("use $inc 5 3"), "(construct (apply use (construct $inc 5)) 3)", "A"],
	["R81 q : use $inc 5 ⏎ q~ 5（前は G7）", std(["q : use $inc 5", "q~ 5"]), "(construct q~ 5)", "A"],
	["R81 q : [use $inc 5] ⏎ q~（前は G7）", std(["q : [use $inc 5]", "q~"]), "q~", "A"],
	["R81 部分適用 p : use $inc ⏎ p 5（前は未知）", std(["p : use $inc", "p 5"]), "(apply p 5)", "A"],
	["R81 括った部分適用 (use $inc) 5（前は未知）", std("(use $inc) 5"), "(apply [use $inc] 5)", "A"],
	["R81 use [$inc] 5（括り1つも印を運ぶ。前は未知）", std("use [$inc] 5"), "(apply use (construct [$inc] 5))", "A"],
	["R81 q : $inc ⏎ use q 5（名前も印を運ぶ。前は未知）", std(["q : $inc", "use q 5"]), "(apply use (construct q 5))", "A"],
	["R81 use $_ 5（零射の番地。前は未知）", std("use $_ 5"), "(apply use (construct $_ 5))", "A"],
	["R81 use $!_ 5（1引数の恒等射。前は未知）", std("use $!_ 5"), "(apply use (construct $!_ 5))", "A"],
	["R81 use !_ 5 $inc（穴を全部埋めた適用、R34。前は未知）", std("use !_ 5 $inc"), "(apply use (construct $inc 5))", "A"],
	["R81 use2 : f x ? use f x ⏎ use2 $inc 5（素の関数の実体から素の関数へ印を渡す。前は未知）", std(["use2 : f x ? use f x", "use2 $inc 5"]), "(apply use2 (construct $inc 5))", "A"],
	["R81 rv : f x ? @f ⏎ rv $vs 0（値を読む参照。前は未知）", std(["rv : f x ? @f", "rv $vs 0"]), "(apply rv (construct $vs 0))", "A"],
	// 2026-10-28 の片9b：`gz un` の un は値の口（gz の裸の口）の `_` と分かる名前で、R112 で書いた `_` と同じく消える（`gz _` は gz）。印 zero の実引数で作る実体
	// （`N $L`）は無くなり、定義の行の読み（`N $A`）だけが残る（行の中で直した。値の口の印 zero で実体を作る道は R112 で無くなった、§7.51）。
	["R81 gz : f ? hx [1] $f ⏎ gz un の hx の実体（片9b：un は値の口で消えるので定義の行の `$A` だけ。前は `N $L` も）", std(["hx : [k] f ? @f 1", "un : _", "gz : f ? hx [1] $f", "gz un"]), "(: hx (? [[k] f] (inst N $A (construct @f 1))))", null, { at: -4 }],
	["R81 k2 ($vs + 0x10) 5（使わない口のずらした点。前は札で G21）", std(["k2 : x y ? y", "k2 ($vs + 0x10) 5"]), "(apply k2 (construct [$vs + 0x10] 5))", "A"],
	["R81 印の違う2つの呼び出し use $inc 5 ⏎ use $double 5（別の実体）", std(["use $inc 5", "use $double 5"]), "(apply use (construct $double 5))", "A"],
	["R81 印の無い実引数は今のまま use 5 5", std("use 5 5"), "(apply use (construct 5 5))", "未知"],
	// 部分適用の鍵は当てた物の印を入れる（入れないと `use $inc` と `use $uu` の部分適用を欄に入れて渡した hq2 の実体を分け合い、先に呼んだ方の答えを後の方が使う。
	// 作る途中の変異で見つけた）。どちらの並べ方でも、`hq2 [f : use $inc]` は A、`hq2 [f : use $uu]` は未知。
	["R81 部分適用を欄で渡す hq2 [f : use $uu] が後（未知）", std(["uu : x ? [,] x", "hq2 : [f] ? f 5", "hq2 [f : use $inc]", "hq2 [f : use $uu]"]), "(apply hq2 [f : use $uu])", "未知"],
	["R81 部分適用を欄で渡す hq2 [f : use $inc] が後（A）", std(["uu : x ? [,] x", "hq2 : [f] ? f 5", "hq2 [f : use $uu]", "hq2 [f : use $inc]"]), "(apply hq2 [f : use $inc])", "A"],
	// 2026-10-26 の確かめの直しで、穴の関数も頭と書いた実引数を持ち越し、口が埋まった所で頭の実体を作る（`use $inc 5` と同じ A。法則6）。前の行は「穴の関数は当てた物を
	// 持ち越さない、今のまま未知」だった。
	["R81 穴の関数も書いた印で実体を作る (use $inc !_) 5（`use $inc 5` と同じ。前の版は未知）", std("(use $inc !_) 5"), "(apply [use $inc !_] 5)", "A"],
	// R82
	["R82 p : $inc ⏎ 5 @p 3（前は G6）", std(["p : $inc", "5 @p 3"]), "(construct 5 (apply @p 3))", "A"],
	["R82 p : $vs ⏎ @p 3（`@[p] 3` と同じ構築。前は未知）", std(["p : $vs", "@p 3"]), "(construct @p 3)", "A"],
	["R82 p : $vs ⏎ @[p] 3（上と同じ）", std(["p : $vs", "@[p] 3"]), "(construct @[p] 3)", "A"],
	["R82 p : $inc ⏎ @p vs~（書き下し。前は G19）", std(["p : $inc", "@p vs~"]), "(apply @p vs~)", "A"],
	// 寄せ1（R128）から p は未定義の名前で、`@p 3` はファイルの `t : y ? @zz 3` と同じ未知（前は R80 の局所の定義の印で A）。
	["R82 局所の p : $inc ⏎ @p 3（寄せ1 から未知。前は A）", std(["t : y ?", "\tp : $inc", "\t@p 3", "", "t 1"]), "(apply t 1)", "未知"],
	["R82 p : 5 ⏎ @p 3（印の無い値は今のまま入力の項）", std(["p : 5", "@p 3"]), "(apply @p 3)", "未知"],
	// 片イ（R120）：局所の関数の再帰は、ファイルの再帰と同じく読みが決まっているので通る（R120 の文面の例。前は G7）。
	// 寄せ1（R128）から sq は未定義の名前で、本体の `sq z`・`sq y` は `_ z`・`_ y`（前は R120 で局所の関数の再帰として通り、diagnostics は無かった）。
	["R80 局所の関数の再帰 sq : z ? sq z（寄せ1 から sq は未定義の名前。前は G7）", std(["t : y ?", "\tsq : z ? sq z", "\tsq y"]), "(: t (? [y] (block (: sq (unit (? [z] (construct sq z)))) (construct sq y))))", null, { diag: "sq", severities: ["information/bare-function-return", "information/undefined-name"] }],
	// 片イ（R125）：本体の返す行に残った局所の関数は `_` と bare-function-return（前は G16）。寄せ1（R128）から最後の行の sq は未定義の名前の `_`（関数でない）で、
	// bare-function-return は枝の値の `z ? z * z` の分。
	["R80 値の行が局所の関数1つ ⇥sq（寄せ1 から sq は未定義の名前。前は 1行の `t : y ? sq` と同じ、その前は G16）", std(["t : y ?", "\tsq : z ? z * z", "\tsq"]), "(: t (? [y] (block (: sq (unit (? [z] (* z z)))) sq)))", null, { severities: ["information/bare-function-return", "information/undefined-name"] }],
	// 局所の定義の覚えの2行は、h の定義の行の `uu (p [x])`（種類の未知な項の G7）で見ていたが、片イ（R120）でその G7 が無くなり通る。今は、並べ方に依らず
	// 同じ根（`p [zz]` の zz は未定義で、括りの口には空の器が届き、最後の括りなので本体を読まずに `_`、R122）で通ることだけを見る（前は G7）。
	// 寄せ1（R128）から `⇥v : h 1` は条件 v の枝で、v も未定義の名前（undefined-name が v と zz の2つ）。
	["R80 局所の定義の覚えは解き直しで消す（p が先）（前は G7）", src(["uu : x ? [,] x", "p : [k] ?", "\tv : h 1", "\tv", "", "h : x ? uu (p [x])", "p [zz]"]), "(apply p [zz])", "A", { severities: ["information/undefined-name", "information/undefined-name"] }],
	["R80 局所の定義の覚えは解き直しで消す（h が先）（前は G7）", src(["uu : x ? [,] x", "h : x ? uu (p [x])", "p : [k] ?", "\tv : h 1", "\tv", "", "p [zz]"]), "(apply p [zz])", "A", { severities: ["information/undefined-name", "information/undefined-name"] }],
	// 片イ（R125）：実体の本体の根の `@f x`（add の部分適用）は `_` と bare-function-return（R125 の文面の `use $add 5 3` の例と同じ。前は G16）。
	["R81 use $add 5（実体の本体の根が口の開いた関数、括りの関数の実体と同じ）（前は G16、その前は未知の根）", std("use $add 5"), "(apply use (construct $add 5))", "A", { severities: ["information/bare-function-return"] }],
];
const r80Refused = [
	// R80：今のまま断る所と、局所の値の輪。局所の値の輪（`w : v` ⏎ `v : w`・`v : f9 1` ⏎ `f9 : z ? v`）の name-cycle と局所の関数の番地（`lf : $inc` ⏎ `lf + 1`）の
	// G7 は、2026-11-04 の寄せ1（R128）で本体の行が枝になり、通る（上の r80Passes の「寄せ1」の行）。
	// 局所の関数の再帰（G7）と値の行が局所の関数1つ（G16）は、片イ（R120・R125）で上の r80Passes へ移した。
	// 寄せ1 から `⇥ww : $vs + 0x10` は枝で、その値（返す所）の点が関数の答えに落ちる所で G21（前は局所の名前 ww の点 + 1 で、ファイルの定義と同じ G21）。
	["R80 局所のずらした点 ww : $vs + 0x10 ⏎ ww + 1（寄せ1 から枝の値の点が関数の答えに落ちる G21）", std(["t : y ?", "\tww : $vs + 0x10", "\tww + 1"]), "G21"],
	// 寄せ1（R130）：使う行を枝の前に置いた本体は、枝の前の裸の行でファイルごと止める（前は R80 で「順序非依存」として通った）。
	["寄せ1 使う行 sq x を枝 sq : z ? z * z の前に置く（R130。前は R80 で順序非依存）", trial(["tt : x ?", "\tsq x", "\tsq : z ? z * z", "", "tt 3"]), "body-bare-row-between"],
	// 寄せ1（R128）から sq は未定義の名前で、`$[sq double]` は値 `_` の上に積まれて余った double（ファイルの `$[zz double]` と同じ R59 の G20。前は R80 で A、その前は G7）。
	["寄せ1 $[sq double]（R59 の G20。前は R80 で A）", trial(["tt : x ?", "\tsq : z ? z * z", "\t$[sq double]"]), "G20"],
	// 番地の字面の n9 とずらした点の ww は、寄せ1 から未定義の名前（`_`）で、ファイルに書いた `($vs + zz) == $vs`・`(zz - $vs) == ($vs - $vs)` と同じ G21（右か左が
	// 点か差か数か分からない値。前は R80 の局所の定義の右辺の顔で通った）。
	["寄せ1 n9 : 0x10 ⏎ ($vs + n9) == $vs（n9 は未定義の名前で G21。前は R80 で通った）", std(["t : y ?", "\tn9 : 0x10", "\t($vs + n9) == $vs", "", "t 1"]), "G21"],
	["寄せ1 その比べの相手（ファイルの ($vs + zz) == $vs）", std(["t : y ? ($vs + zz) == $vs", "t 1"]), "G21"],
	["寄せ1 ww : $vs + 0x10 ⏎ (ww - $vs) == ($vs - $vs)（ww は未定義の名前で G21。前は R80 で通った）", std(["t : y ?", "\tww : $vs + 0x10", "\t(ww - $vs) == ($vs - $vs)", "", "t 1"]), "G21"],
	// 局所の定義の覚えは、範囲の本体を解き始めるたびに消す（resolve.js の localInfo の注）。消さないと、h の仮置き（A）の上で解いた p の実体の局所の名前 v が
	// 覚えに残り、仮置きが外れて p の実体を解き直しても v は A のまま、`(p [x])` が A に固まって h の `uu (p [x])` を黙って通した（作る途中の変異で見つけた）。
	// 正しくは `(p [x])` は未知で、h の定義の行で G7。並べ方に依らない。
	// 片イ（R120）でその G7 が無くなったので、この2行は上の r80Passes へ移した。
	// R81
	["R81 pq : [a] y ? y + a ⏎ ff : x ? pq [1] x ⏎ ff $5（β の `pq [1] $5` と同じ G21。前は届かずに A）", std(["pq : [a] y ? y + a", "ff : x ? pq [1] x", "ff $5"]), "G21", [["ff", "$N"], ["pq", "N $N"]]],
	["R81 並べ方 gg が先 ⏎ gg $5（hq の実体で G21。前は届かずに A）", std(["gg : y ? hq [s : y]", "ff : x ? hq [s : x]", "hq : [s] ? s + 1", "gg $5"]), "G21", [["gg", "$N"], ["hq", "{s:$N}"]]],
	["R81 並べ方 ff が先 ⏎ gg $5（同じ）", std(["ff : x ? hq [s : x]", "gg : y ? hq [s : y]", "hq : [s] ? s + 1", "gg $5"]), "G21", [["gg", "$N"], ["hq", "{s:$N}"]]],
	// `use $add 5`（G16）は、片イ（R125）で上の r80Passes へ移した。
	["R81 inc $inc（実体の本体の `x + 1` で関数を指す番地を値の演算子に。前は札で G7）", std("inc $inc"), "G7", [["inc", "$L"]]],
	["R81 sh : x ? x + 0x10 ⏎ sh $vs（本体の中は点 + 差だが、返す点は関数の答えで落ちるので G21、§5 Q66）", std(["sh : x ? x + 0x10", "sh $vs"]), "G21", [["sh", "$[N…]"]]],
	["R81 tg : g9 ? @g9 vs~ ⏎ tg $add（定義の行は印の無い読みで今のまま G19、§5 Q45 の残り）", std(["tg : g9 ? @g9 vs~", "tg $add"]), "G19"],
	["R81 r2 : f ? r2 $f ⏎ r2 $vs（印が深くなり続ける再帰は実体の守り。前は A）", std(["r2 : f ? r2 $f", "r2 $vs"]), "instance-nest-limit"],
	// R82
	["R82 q : $vs + 0x10 ⏎ @q（`@[q]` と同じ G21。前は入力の項で未知）", std(["q : $vs + 0x10", "@q"]), "G21"],
	["R82 v : f9 1 ⏎ f9 : x ? @v ⏎ v（`@[v]` と同じ name-cycle。前は通った）", std(["v : f9 1", "f9 : x ? @v", "v"]), "name-cycle"],
];
for (const [name, s, want, kind, extra] of r80Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r80Refused) checkRefused(name, s, want, inst);
const r80GateMessages = [
	// 「R80 局所の値の輪は局所の定義の道筋と R80 を言う」は、2026-11-04 の寄せ1（R128）で本体の行が枝になって輪が無くなり（その形は通る）、外した。
	["R81 素の関数の実体の門は素の関数と形を名指す", std("inc $5"), "G21", ["素の関数（印のある実引数で実体を作る所、R81）", "`inc` を形 $N で呼んだ実体", "R25"], ["括りの関数 `inc`"]],
	["R81 定義の行の印の無い `@g9` の G19 は §5 Q45 の残りを言う", std(["tg : g9 ? @g9 vs~", "tg $add"]), "G19", ["素の関数の定義の行の読み", "§5 Q45 の残り"], []],
	// 2026-10-26 の確かめの直しで、G6 の言い分はその `@x` に印が届かない本当の理由を言う（前は未定義の名前にも R81 と §5 Q45 を挙げた）。
	// 片イ（R126）で G6 は廃止したので、G6 の言い分の4行（`5 @x`・`t7 : f ? 5 @f 1`・`hy [s : 5]`・`p : 5` ⏎ `5 @p 1`）は外した。
];
for (const [name, s, gateId, must, mustNot] of r80GateMessages) {
	total++;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if ((gateId === null || e.gate === gateId) && !missing.length && !extra.length) ok(`言い分 ${name}`);
		else fail(`言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}

// ---------------------------------------------------------------------------
// R80〜R82 の確かめの直し（2026-10-26。確かめる2人の指摘を走らせて、90% を超えて確かな所だけ直した）
// ---------------------------------------------------------------------------
// - 穴の関数（R16・R34）も、頭の素の関数と書いた実引数と穴の位置を持ち越し、口が埋まった所で頭の適用として実体を作る（法則6）。前は穴の関数が印を持ち越さず、
//   `(ff !_) $5` が A で `ff $5`（G21）と割れた。`(inc !_) $5` も HEAD から A で `inc $5` の G21 と割れていた。
// - 局所の定義の右辺が仮引数・実体の中で渡された物の名前1つに縮むなら、その名前と同じ物（`:` はメタ）：札・零射の印・形の見えない値をそのまま持つ。
// - 素の関数の単相化の実体で、印の無い実引数の裸の仮引数は定義の行の読みと同じ（`$x` は値を読む参照）。前は括りの関数の実体と同じ形の見えない値で G20。
// - 実体の深さの上限は、実体を作る素の関数も数える。素の関数の部分適用・穴の関数の印の鍵は番号の DAG（前は綴りを書き写して RangeError）。
// - 外の関数の局所の名前と同じ名前の、内の関数の局所の定義は、外の名前を隠す行として今のまま断る（local-shadow）。
// - `$` で入った辺のある局所の定義の輪は、どの名前から解き始めても R54 の local-cycle（G20）。
// - G6 の言い分は、`@x` に印が届かない本当の理由を言う。
const r80FixPasses = [
	["直し 穴の関数 (use !_ 5) $inc（`use $inc 5` と同じ A。前の版は未知）", std("(use !_ 5) $inc"), "(apply [use !_ 5] $inc)", "A"],
	["直し 穴の関数の名前 p : use $inc !_ ⏎ p 5（前の版は未知）", std(["p : use $inc !_", "p 5"]), "(apply p 5)", "A"],
	["直し R34 の k < n の穴 (use !_) $inc 5（前の版は未知）", std("(use !_) $inc 5"), "(apply [use !_] (construct $inc 5))", "A"],
	["直し R34 の k < n の穴の余り [use !_] $inc 5 3（`use $inc 5 3` と同じく積む。前の版は G2(a)）", std("[use !_] $inc 5 3"), "(apply [use !_] (construct $inc 5 3))", "A"],
	["直し 穴の関数の鍵は書いた印を入れる：ht [h : (use $inc !_)] が後（A）", std(["uu : x ? [,] x", "ht : [h] ? h 5", "ht [h : (use $uu !_)]", "ht [h : (use $inc !_)]"]), "(apply ht [h : [use $inc !_]])", "A"],
	["直し 穴の関数の鍵は書いた印を入れる：ht [h : (use $uu !_)] が後（未知）", std(["uu : x ? [,] x", "ht : [h] ? h 5", "ht [h : (use $inc !_)]", "ht [h : (use $uu !_)]"]), "(apply ht [h : [use $uu !_]])", "未知"],
	["直し 穴の関数の使わない口のずらした点 (k2 ($vs + 0x10) !_) 5（`k2 ($vs + 0x10) 5` と同じ A。前は札で G21）", std(["k2 : x y ? y", "(k2 ($vs + 0x10) !_) 5"]), "(apply [k2 [$vs + 0x10] !_] 5)", "A"],
	["直し 単相化の実体の印の無い仮引数の $x：pz $inc 5（`pz 1 5`・β の `$5` と同じ A。前の版は G20）", std(["pz : f x ? $x", "pz $inc 5"]), "(apply pz (construct $inc 5))", "A"],
	["直し 同じ x , $x の pz $inc vs（前の版は G20）", std(["pz : f x ? x , $x", "pz $inc vs"]), "(apply pz (construct $inc vs))", "A"],
	["直し 同じ @f $x の gq $!_ 5（前の版は G20）", std(["gq : f x ? @f $x", "gq $!_ 5"]), "(apply gq (construct $!_ 5))", "A"],
	["直し 同じ部分適用 p2 : pz $inc ⏎ p2 5（前の版は G20）", std(["pz : f x ? $x", "p2 : pz $inc", "p2 5"]), "(apply p2 5)", "A"],
	["直し 括りの関数の無いファイルの `$` で包む4段の鎖 a1 $inc（前の版は深さの門で G7）", src(["inc : x ? x + 1", "a1 : f ? a2 $f", "a2 : g ? a3 $g", "a3 : h ? a4 $h", "a4 : h ? 5", "a1 $inc"]), "(apply a1 $inc)", "A"],
	// 2026-10-28 の片9b：`gq un` の un は値の口で消える（R112）ので、印 zero の実体（`N $L`・`N _`）は無くなり、定義の行の読みだけ（行の中で直した）。
	// 2026-11-04 の寄せ1（R128）から本体の `⇥w : f`・`⇥w : s` は条件 w（未定義の名前）の枝で、別名を作らない。`$w` は零射の番地（`N $L`）、裸の w は `_` で、
	// `hx [1] w` は `hx [1]`（部分適用が返す所に残って `_`、hx は呼ばれず defer）。前は R80 の局所の別名で `$f`・`f` と同じ。
	["直し 仮引数の別名 w : f の $w（寄せ1 から零射の番地で `N $L`。片9b から寄せ1 までは `$f` と同じ `N $A`）", std(["hx : [k] f ? @f 1", "un : _", "gq : f ?", "\tw : f", "\thx [1] $w", "", "gq un"]), "(: hx (? [[k] f] (inst N $L (apply @f 1))))", null, { at: -4 }],
	["直し 仮引数の別名を裸で w（寄せ1 から w は `_` で hx は呼ばれず defer。片9b から寄せ1 までは `N A`）", std(["hx : [k] f ? @f 1", "un : _", "gq : f ?", "\tw : f", "\thx [1] w", "", "gq un"]), "(: hx (? [[k] f] (defer {@f 1})))", null, { at: -4 }],
	["直し 括りの関数の実体の欄の別名 w : s ⏎ hx [1] $w の hb5 [s : [_]]（`N $L`。寄せ1 から w は未定義の名前で零射の番地、前は `$s` と同じ。前の版は `N $A`。片9b で欄の値を `[_]` に、前は `[s : _]`）", std(["hx : [k] f ? @f 1", "hb5 : [s] ?", "\tw : s", "\thx [1] $w", "", "hb5 [s : [_]]"]), "(: hx (? [[k] f] (inst N $L (apply @f 1))))", null, { at: -3 }],
	// 寄せ1（R128）から、外の `⇥sq : z ? inc z` も内の `⇥⇥sq : z ? z * z` も枝で何も定義せず、`⇥in2 : y ? …` も条件 in2 の枝なので、最後の `in2 x` は `_ x` で A。
	["直し 外の局所の名前を隠す内の行 ⇥⇥sq y（寄せ1 から A。前は枝のある本体の読みで未知、前の版は内の定義が黙って隠して A）", std(["tt : x ?", "\tsq : z ? inc z", "\tin2 : y ?", "\t\tsq : z ? z * z", "\t\tsq y", "\tin2 x", "", "tt 3"]), "(apply tt 3)", "A"],
	// 寄せ1 から `⇥w : a` は枝で、`w + b` の w は未定義の名前（`_`）。札の付いた a は届かず、通る（前は仮引数の別名の札で G21、下の r80FixRefused にあった）。
	["直し 仮引数の別名の札 ⇥w : a ⏎ ⇥w + b の (g4 $5 !_) 1（寄せ1 から w は未定義の名前で通る。前は G21、前の版は A）", std(["g4 : a b ?", "\tw : a", "\tw + b", "", "(g4 $5 !_) 1"]), "(apply [g4 $5 !_] 1)", "A"],
	// `$` で入った辺のある局所の輪（G20）と外の局所の名前を隠す内の行の `$sq`（local-shadow の G20）も、寄せ1 で本体の行が枝になって通る（前は下の r80FixRefused）。
	["寄せ1 ⇥v : f9 1 ⏎ ⇥f9 : z ? z , $v（v が先。輪でない。前は G20、前の版は name-cycle）", std(["tt : x ?", "\tv : f9 1", "\tf9 : z ? z , $v", "\tv", "", "tt 1"]), "(apply tt 1)", "A"],
	["寄せ1 同じ形で f9 が先（前は G20）", std(["tt : x ?", "\tf9 : z ? z , $v", "\tv : f9 1", "\tv", "", "tt 1"]), "(apply tt 1)", "A"],
	["寄せ1 内の本体の ⇥⇥map $sq y（sq は未定義の名前で零射の番地。前は local-shadow の G20）", std(["tt : x ?", "\tsq : z ? inc z", "\tin2 : y ?", "\t\tsq : z ? z * z", "\t\tmap $sq y", "\tin2 x", "", "tt 3"]), "(apply tt 3)", "A"],
];
const r80FixRefused = [
	["直し 穴の関数に後から当てた印 (ff !_) $5（`ff $5` と同じ G21。前の版は A）", std(["pq : [a] y ? y + a", "ff : x ? pq [1] x", "(ff !_) $5"]), "G21", [["ff", "$N"], ["pq", "N $N"]]],
	["直し 穴の関数の名前 p : ff !_ ⏎ p $5（同じ）", std(["pq : [a] y ? y + a", "ff : x ? pq [1] x", "p : ff !_", "p $5"]), "G21", [["ff", "$N"], ["pq", "N $N"]]],
	["直し 穴に書いた印 (gw $5 !_) 1（`gw $5 1` と同じ G21。前の版は A）", std(["pq : [a] y ? y + a", "gw : x y ? pq [1] x", "(gw $5 !_) 1"]), "G21", [["gw", "$N A"], ["pq", "N $N"]]],
	["直し (inc !_) $5（`inc $5` と同じ G21。HEAD から A）", std("(inc !_) $5"), "G21", [["inc", "$N"]]],
	["直し 穴の関数の部分適用も頭を持ち越す p : f3 !_ !_ 3 ⏎ (p $5) 1（`f3 $5 1 3` と同じ G21。HEAD から A）", std(["p : f3 !_ !_ 3", "(p $5) 1"]), "G21", [["f3", "$N A A"]]],
	["直し 同じ q : (f3 !_ !_ 3) 1 ⏎ q $5（`f3 1 $5 3` と同じ G21。HEAD から A）", std(["q : (f3 !_ !_ 3) 1", "q $5"]), "G21", [["f3", "A $N A"]]],
	["直し R34 の k < n の穴 (f3 !_ 2) $5 1（`f3 $5 2 1` と同じ G21。HEAD から A）", std("(f3 !_ 2) $5 1"), "G21", [["f3", "$N A A"]]],
	["直し 最後の括りを開いた要素の印 (f3 !_) 1 [2 $5]（`f3 1 2 $5` と同じ G21。HEAD から A）", std("(f3 !_) 1 [2 $5]"), "G21", [["f3", "A A $N"]]],
	["直し 最後の括りの名前の中身が見えないのに印がある (use !_) $inc ws（G7、§5 Q45 の残り）", std(["ws : 2 , 3", "(use !_) $inc ws"]), "G7"],
	// 「直し 仮引数の別名の札 ⇥w : a ⏎ ⇥w + b の (g4 $5 !_) 1」（その場に書いた `a + b` と同じ G21）は、2026-11-04 の寄せ1（R128）で `⇥w : a` が枝になり、上の
	// r80FixPasses へ移した。
	// 「直し 形の見えない値の別名 w : s ⏎ use $w 1 の hb7 [s : (inc 5)]」（`use $s 1` と同じ G20）は、2026-10-27 の片8 で `use $s 1` と同じく持ち上げで通る（いちばん
	// 後ろの「R99〜R104」の節）。
	["直し 部分適用の鍵の印を当て続ける再帰 r8b [1] $inc（守りで断る。前の版は JS の RangeError）", std(["r8b : [k] h ? r8b [k] $(f3 h h)", "r8b [1] $inc"]), "instance-nest-limit"],
	["直し 同じ素の関数 r8 : h ? r8 $(f3 h h)（前の版は JS の RangeError）", std("r8 : h ? r8 $(f3 h h)"), "instance-nest-limit"],
	// 鍵の深さは当てた印の深さに 1 を足す（internPlainMarks）ので、実体を作る関数の少ないファイルでは深さの門に届く（数えないと入れ子の数の守りまで回る）。
	["直し 同じ r8 で関数の少ないファイル（深さの門）", src(["f3 : a b c ? a + b + c", "r8 : h ? r8 $(f3 h h)"]), "G7"],
	// `$` で入った辺のある局所の輪（v が先・f9 が先、G20）と外の局所の名前を隠す内の行の `$sq`（local-shadow の G20）は、2026-11-04 の寄せ1（R128）で本体の行が
	// 枝になって通る（上の r80FixPasses の「寄せ1」の行）。
	// 自分の仮引数の `$` を自分に渡す再帰（印が段ごとに深くなる多相の再帰）は、定義の行の印の無い読みの中でも実体を作り続けるので、呼ばれない定義でも断る（今のまま。
	// 定義の行の読みの中で、仮引数から作った印で実体を作るかは §5 Q45 の残り）。
	["今のまま 自分の仮引数の `$` を自分に渡す再帰 cnt : h m ? … cnt $h (m - 1)（§5 Q45 の残り）", std("cnt : h m ? m == 0 & 0 | cnt $h (m - 1)"), "instance-nest-limit"],
];
for (const [name, s, want, kind, extra] of r80FixPasses) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r80FixRefused) checkRefused(name, s, want, inst);
const r80FixMessages = [
	["直し 最後の括りの中身が見えない印は、並べ直せないことと §5 Q45 の残りを言う", std(["ws : 2 , 3", "(use !_) $inc ws"]), "G7", ["最後の括りに入った物の中身の木が見えない", "§4 R34・R81", "§5 Q45 の残り"], []],
	// 「直し `$` で入った辺のある局所の輪は、輪の道筋と R54・R80 を言う」と「直し 外の局所の名前を隠す行の $sq は、外の範囲の局所の名前を言う」（G20 の言い分）は、
	// 2026-11-04 の寄せ1（R128）でどちらの形も通るので外した。
	// 「直し 形の見えない値の別名の $w は、右辺の名前を言う」（G20 の言い分）は、2026-10-27 の片8 で通るので外した。
	["直し 深さの門は実体を作る関数（括りの関数と素の関数）の上限を言う", src(["f : [x ~xs] ? f [xs xs]", "f [1 2]"]), "G7", ["実体を作る関数（括りの関数と素の関数）"], ["括りの関数をそれぞれ"]],
];
for (const [name, s, gateId, must, mustNot] of r80FixMessages) {
	total++;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if ((gateId === null || e.gate === gateId) && !missing.length && !extra.length) ok(`言い分 ${name}`);
		else fail(`言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}

// ---------------------------------------------------------------------------
// R28 の書き直し（2026-10-26。末尾の書いた `_` は消えて、関数のまま残る）
// ---------------------------------------------------------------------------
// 根拠：主の Claude の問い「`(add 3 _) 5` も Q18 と同じく `_` が消えて `add 3` が残り、8 でいい？」（最初に訊いたのは 2026-10-26 00:27 UTC）に、利用者は主の Claude が
// 用意したボタン「8 でいい」を選んだ（U〔答え〕[2026-10-26 10:15 c8ccdd69]。ボタンの文「8 でいい。末尾の書いた `_` は消えて、部分適用も合成も関数のまま残る。最後まで
// 評価されなければ初めて `_`（R42）。R28 をそう直して、次の片に入れて。」は主の Claude の物）。合成（§5 Q18）は U〔答え〕[2026-10-25 21:56 c8ccdd69]「Q18 まだ inc inc の
// 関数として残し、最後の結果で inc inc が評価されなければ初めて _」。
// - 並びの最後の書いた `_` は R15 と同じく消える印。消した後の部分適用・合成・関数は関数のまま残り（L）、括りで閉じても評価しない（`(add 3 _) 5` は 8）。評価する所
//   （R42・R76）か値の上（R52）で何も受けずに残れば `_` で、知らせる（R48。恒等射は知らせない）。口が全部埋まった後の `_` は今までどおり消える（`add 2 3 _` は 5）。
// - 前の R28 が「終わり」だったせいで断っていた形のうち、この答えから1つに決まる物を読む：合成の頭（§5 Q18）・アリティの数えられない頭（`[* 2,]`・`[,]`・前置 `@`）・
//   後ろが並びの終わりまで関数だけの `_`（`add _ inc` は `add inc`、決定の文。ほかの頭へ広げたのは R）・括りの関数の頭で足りない形（R15 と R28 がどちらも「消える」）・
//   既定値の無い口と仮引数の外の末尾の `_`（既定値のある口に当たる `_` は R39 のまま既定値）・§5 Q13 の残り（`i inc _` は `inc`）。
// - 手順2 の穴の規則は、末尾の `_` を消してから見る（R15 の「数える前に取り除く」と同じ。`add _ 3 _` は `add _ 3` のカリー化、`inc 5 !_ 6 _` は `inc 5 !_ 6` の G13）。
// - 当たらない所（今のまま）：畳む2項の点なしの実引数の `_`（R31、`[+] 1 _` は `1 + _`）・既定値のある口の `_`（R39）・内側の `_`（R16・R38・R68・R15・G5）。
// - 2026-10-26 の確かめの直しで断る側に倒した所（§5 Q74。どれも HEAD 154cf275 と同じ門）：関数を挟んで値が続く `_`（`f2 _ inc 5`）・種類の決まらない項の後ろの
//   `_`（`(gq 1) _`・`5 + inc _`）・1行の括りの点なしの形の項の後ろの `_`（`(!_ _)`。HEAD は `!_` の終わりの A で通していた。今は G7）。
// 前の R28 の行の答えは、上の各節の行の注に書いた（前の答えと、変わった理由）。前の答えで断っていて通る側へ移した行は、ここに置く。
const R28D = ["io1 : [say] ? say 21", "pb : [a] [b] ? a", "hh : [a] [b] ? a", "gq : x [y : 1] ? x + y", "fp : [a b c] ? a + b * c", "gl : x [y : 5] z ? x", "mx : a [b] ? a", "pq : [a] y ? y", "q : inc add 5", "r : inc f3 5", "i : !_"];
const r28 = (lines) => std([...R28D, ...[].concat(lines)]);
const r28Passes = [
	// 決定の例（U〔答え〕10-26 10:15）
	["決定 (add 3 _) 5 は `(add 3) 5` で 8（前は 5）", r28("(add 3 _) 5"), "(apply [add 3 _] 5)", "A"],
	["決定 (inc inc _) 5 は `(inc inc) 5` で 7（前は G5、§5 Q18）", r28("(inc inc _) 5"), "(apply [inc inc _] 5)", "A"],
	["決定 根の inc inc _ は `_` と知らせ（前は G5、§5 Q18）", r28("inc inc _"), "(unit (compose inc inc))", "A", { leftoverDiag: ["(compose inc inc)"] }],
	["決定 名前の右辺 q3 : add 3 _ は `add 3`（L）で q3 5 は当たる（前は A の値 `_`）", r28(["q3 : add 3 _", "q3 5"]), "(apply q3 5)", "A"],
	["決定 q3 : add 3 _ の定義の行は部分適用のまま（R42：右辺は評価する所でない）", r28("q3 : add 3 _"), "(: q3 (apply add 3))", "A", { leftoverDiag: [] }],
	["決定 add 2 3 _ は今までどおり 5（口が全部埋まった後の `_` は消える）", r28("add 2 3 _"), "(apply add (construct 2 3))", "A", { leftoverDiag: [] }],
	// 合成の頭（§5 Q18）：名前・括り・書いたままの合成で同じ答え（`:` はメタ）
	["Q18 q : inc add 5 ⏎ q _（前は G5）", r28("q _"), "(unit q)", "A", { leftoverDiag: ["q"] }],
	["Q18 (inc add 5) _（前は G5）", r28("(inc add 5) _"), "(unit [inc add 5])", "A", { leftoverDiag: ["[inc add 5]"] }],
	["Q18 inc add 5 _（前は G5）", r28("inc add 5 _"), "(unit (apply (compose inc add) 5))", "A", { leftoverDiag: ["(apply (compose inc add) 5)"] }],
	["Q18 f2 3 f2 5 _（前は G5）", r28("f2 3 f2 5 _"), "(unit (apply (compose (apply f2 3) f2) 5))", "A", { leftoverDiag: ["(apply (compose (apply f2 3) f2) 5)"] }],
	["Q18 r : inc f3 5 ⏎ r 1 _（前は G5）", r28("r 1 _"), "(unit (apply r 1))", "A", { leftoverDiag: ["(apply r 1)"] }],
	["Q18 r : inc f3 5 ⏎ (r 1) _（前は G5）", r28("(r 1) _"), "(unit [r 1])", "A", { leftoverDiag: ["[r 1]"] }],
	// §5 Q13 の残り：恒等射で始まる合成は R74 で恒等射が消え、末尾の `_` も消える
	["Q13 i inc _ ⏎ (i inc _) 5 は `inc 5` で 6（R74 の片では `(construct [i inc _] 5)` で 5）", r28("(i inc _) 5"), "(apply [i inc _] 5)", "A"],
	// アリティの数えられない頭（消えるだけなので数えない）
	["数えない [* 2,] 1 _（前は G5）", r28("[* 2,] 1 _"), "(apply [* 2,] 1)", "A"],
	["数えない [-_,] 1 _（前は G5）", r28("[-_,] 1 _"), "(apply [-_,] 1)", "A"],
	["数えない [,] 1 _（前は G5）", r28("[,] 1 _"), "(apply [,] 1)", "未知"],
	["数えない 前置 @f _ は `@f` 1つと同じ未知（前は G5）", r28("@f _"), "@f", "未知", { diag: "f" }],
	// 後ろが関数の `_`（引数の並びの終わり）
	["終わりの後ろに関数 add _ inc は `add inc`（前は G5）", r28("add _ inc"), "(unit (compose add inc))", "A", { leftoverDiag: ["(compose add inc)"] }],
	["終わりの後ろに関数 io1 _ inc（前は G5）", r28("io1 _ inc"), "(unit (compose io1 inc))", "A", { leftoverDiag: ["(compose io1 inc)"] }],
	["終わりの後ろに関数 pb 1 _ inc（前は G5）", r28("pb 1 _ inc"), "(unit (compose (apply pb 1) inc))", "A", { leftoverDiag: ["(compose (apply pb 1) inc)"] }],
	// 括りの関数の頭で足りない形（R15 と R28 がどちらも消える）
	["括りの関数 io1 _（前は G5）", r28("io1 _"), "(unit io1)", "A", { leftoverDiag: ["io1"] }],
	["括りの関数 (io1 _) 5 は io1 を 5 で呼ぶ（前は G5）", r28("(io1 _) 5"), "(apply [io1 _] 5)", "A"],
	["括りの関数 pb 1 _（前は G5）", r28("pb 1 _"), "(unit (apply pb 1))", "A", { leftoverDiag: ["(apply pb 1)"] }],
	["括りの関数 1 hh _（前は G5）", r28("1 hh _"), "(construct 1 (unit hh))", "A", { leftoverDiag: ["hh"] }],
	["括りの関数 5 io1 _（前は G5）", r28("5 io1 _"), "(construct 5 (unit io1))", "A", { leftoverDiag: ["io1"] }],
	["括りの関数 5 n _（前は G5）", r28("5 n _"), "(construct 5 (unit n))", "A", { leftoverDiag: ["n"] }],
	["括りの関数 fp _（前は G5、§5 Q7）", r28("fp _"), "(unit fp)", "A", { leftoverDiag: ["fp"] }],
	["括りの関数 mx _（裸の口でも、後ろに何も無ければ詰める物が無い。前は G5）", r28("mx _"), "(unit mx)", "A", { leftoverDiag: ["mx"] }],
	["括りの関数 mx _ inc（後ろの inc は合成で口に入らない。`add _ inc` と同じ線、R。前は G5）", r28("mx _ inc"), "(unit (compose mx inc))", "A", { leftoverDiag: ["(compose mx inc)"] }],
	["R34 の k < n の関数 (f3 !_ 2) 1 _（前は G5）", r28("(f3 !_ 2) 1 _"), "(unit (apply [f3 !_ 2] 1))", "A", { leftoverDiag: ["(apply [f3 !_ 2] 1)"] }],
	["R34 の k < n の関数 (f3 !_ 2) _（前は G5）", r28("(f3 !_ 2) _"), "(unit [f3 !_ 2])", "A", { leftoverDiag: ["[f3 !_ 2]"] }],
	["R34 の k < n の関数 ((f3 !_ 2) 1) _（前は G5）", r28("((f3 !_ 2) 1) _"), "(unit [[f3 !_ 2] 1])", "A", { leftoverDiag: ["[[f3 !_ 2] 1]"] }],
	["R34 の k < n の関数 (f3 _ 2) 1 _（前は G5）", r28("(f3 _ 2) 1 _"), "(unit (apply [f3 _ 2] 1))", "A", { leftoverDiag: ["(apply [f3 _ 2] 1)"] }],
	// 既定値のある関数：既定値の無い口・仮引数の外の末尾の `_` は消える（既定値のある口は R39 のまま）
	["既定値 go _（前は G15、§5 Q8 の残り）", std([...GO_DEFAULT, "go _"]), "(unit go)", "A", { leftoverDiag: ["go"] }],
	["既定値 5 go _（前は G15）", std([...GO_DEFAULT, "5 go _"]), "(construct 5 (unit go))", "A", { leftoverDiag: ["go"] }],
	["既定値 5 go inc _（前は G15）", std([...GO_DEFAULT, "5 go inc _"]), "(construct 5 (unit (compose go inc)))", "A", { leftoverDiag: ["(compose go inc)"] }],
	["既定値 go 1 2 _（仮引数の外。前は G15）", std([...GO_DEFAULT, "go 1 2 _"]), "(apply go (construct 1 2))", "未知"],
	["既定値 5 gq _（前は G15）", r28("5 gq _"), "(construct 5 (unit gq))", "A", { leftoverDiag: ["gq"] }],
	["既定値 gl !_ 1 _（z は既定値の無い口。`gl !_ 1` と同じ。前は G15）", r28("gl !_ 1 _"), "(unit (? [$p0 [~$p1]] (apply gl (construct $p0 1 $p1~))))", "A"],
	["既定値 go 1 _（既定値のある口は R39 のまま既定値）", std([...GO_DEFAULT, "go 1 _"]), "(apply go (construct 1 _))", "未知"],
	// 2026-10-28 の R105 で、`go _ _` は左から読んで前の `_` が ys の口で消え、後ろの `_` も ys の口に着いて消えるので go（§5 Q74 (d) を閉じた）。前は右から見て後ろの
	// `_` が zs の既定値、前の `_` が R68 のカリー化で `(unit (? [$p0] (apply go (construct $p0 _))))`。
	["既定値 go _ _（R105 で2つとも ys の口で消え go。前は後ろの `_` が zs の既定値、前の `_` は R68 のカリー化）", std([...GO_DEFAULT, "go _ _"]), "(unit go)", "A"],
	// 手順2 の穴の規則は、末尾の `_` を消してから見る
	["穴 add _ _ は `add`（前は G5）", r28("add _ _"), "(unit add)", "A", { leftoverDiag: ["add"] }],
	["穴 add 3 _ _ は `add 3`（前は G5）", r28("add 3 _ _"), "(unit (apply add 3))", "A", { leftoverDiag: ["(apply add 3)"] }],
	// 2026-10-28 の R105 で、内側の `_` も消えるので、下の3行は `add 3`・`f3 2`・`f4 2`（部分適用）。前はカリー化（R16）か R38 の穴の関数。
	["穴 add _ 3 _ は R105 で `add 3`（前は `add _ 3` のカリー化、その前は G5）", r28("add _ 3 _"), "(unit (apply add 3))", "A"],
	["穴 f3 _ 2 _ は R105 で `f3 2`（前は `f3 _ 2` の R38、その前は G5）", r28("f3 _ 2 _"), "(unit (apply f3 2))", "A"],
	["穴 f4 _ 2 _ は R105 で `f4 2`（前は `f4 _ 2` の R38、その前は G5）", r28("f4 _ 2 _"), "(unit (apply f4 2))", "A"],
	["穴 add !_ _ は `add !_` の R34（前は G7）", r28("add !_ _"), "(unit (? [$p0 [~$p1]] (apply add (construct $p0 $p1~))))", "A"],
	["穴 f3 !_ _ は `f3 !_` の R34（前は G7）", r28("f3 !_ _"), "(unit (? [$p0 [~$p1]] (apply f3 (construct $p0 $p1~))))", "A"],
	["穴 inc !_ _ は `inc !_` の穴（前は G5、§5 Q18）", r28("inc !_ _"), "(unit (? [$p0] (apply inc $p0)))", "A"],
	["穴 pq 1 2 !_ _ は `pq 1 2 !_` の R69（前は G5）", r28("pq 1 2 !_ _"), "(construct (apply pq (construct 1 2)) (unit !_))", "A", { leftoverDiag: [] }],
	// R70：後ろに書いた `_` しか続かない空の流れは、後ろに何も続かないのと同じ
	["R70 inc []~ _ は `inc []~` と同じ（2026-10-27 の R84 で `inc _ _` と同じ木。前は `(unit (apply inc []~))`、その前は G19）", r28("inc []~ _"), "(unit inc)", "A"],
	// 評価する所（R76）・値の演算子の被演算子（§5 Q73 の外、今の `inc + 1` と同じ）
	["R76 inc _ == 2 は `inc == 2` と同じ（前は `(apply inc _)` の A）", r28("inc _ == 2"), "(== (unit inc) 2)", "A", { leftoverDiag: ["inc"] }],
	// 2026-10-26 の確かめの直し：前のここの行「Q73 5 + inc _ は `5 + inc` と同じ未知（前は `(+ 5 (apply inc _))` の A）」は記録が違っていた。中置は空白より強く
	// 結ぶので `5 + inc _` は `(5 + inc) _` で、HEAD 154cf275 も G7（種類の決まらない項の後ろの `_`）。今も G7 で、下の断る行へ移した。被演算子の中に括って書いた
	// `5 + (inc _)` は `5 + (inc)` と同じ未知（前は `[inc _]` が終わりの A で A）。
	// 2026-10-27 の R87（§5 Q73 の答え）から、被演算子の丸ごとの関数 `(inc _)` は評価する所で `_` になり、A で知らせる（`5 + (inc)` と同じ）。
	["Q73 5 + (inc _) は `5 + (inc)` と同じ（R87 で `(+ 5 (unit [inc _]))` の A。前は未知、その前は `(+ 5 [inc _])` の A）", r28("5 + (inc _)"), "(+ 5 (unit [inc _]))", "A", { leftoverDiag: ["[inc _]"] }],
	// 括りの関数の残りの口が全部括りなら、関数を挟んで値が続いても R15 で消える（前は R28 の終わりと割れて G5）
	["括りの関数 io1 _ inc 5 は `io1 inc 5`（R15。前は G5）", r28("io1 _ inc 5"), "(apply (compose io1 inc) 5)", "A"],
	["後ろが関数だけ add _ inc inc は `add inc inc`（前は G5）", r28("add _ inc inc"), "(unit (compose add inc inc))", "A", { leftoverDiag: ["(compose add inc inc)"] }],
	// 既定値が後ろの口だけにある関数で、末尾の `_` が2つ続く（右から見る）
	["既定値 gy _ _ は gy（後ろの `_` が y で消え、前の `_` も x で消える。前は G15）", r28(["gy : x y [z : 1] ? x", "gy _ _"]), "(unit gy)", "A", { leftoverDiag: ["gy"] }],
	// 2026-10-28 の R105 で、`gy 1 _ _` は左から読んで2つの `_` が y の口で消え、`gy 1`（y・z が開いた既定値のある関数の部分適用。z の前に既定値の無い y が開いて
	// いるので R107 では埋めない。適用は未知、§5 Q8）。前は右から見て後ろの `_` が z の既定値、前の `_` が R68 のカリー化で `(unit (? [$p0] (apply gy (construct 1 $p0 _))))`。
	["既定値 gy 1 _ _ は R105 で `gy 1`（前は後ろの `_` が z の既定値で、前の `_` は R68 のカリー化）", r28(["gy : x y [z : 1] ? x", "gy 1 _ _"]), "(apply gy 1)", "未知"],
	["$[add 3 _] は `$[add 3]`：関数を指す番地（前は値を読む参照）", r28("$[add 3 _]"), "$[add 3 _]", "A"],
	// 今のまま（R31）
	["今のまま [+] 1 _ は `1 + _`（R31）", r28("[+] 1 _"), "(apply [+] (construct 1 _))", "A"],
	// 2026-10-28 の R105（値の口の書いた `_` は単位律で消える）で、下の r28Refused にあった行（G5・G15）が通るので、この節の通る側へ移した（行の綴りは前のまま。
	// 答えは `_` を消した綴りと同じ）。
	["R105 で通る add _ 3 inc（前は G5、§5 Q7 の残り）", r28("add _ 3 inc"), "(unit (compose (apply add 3) inc))", "A", { leftoverDiag: ["(compose (apply add 3) inc)"] }],
	["R105 で通る 5 go inc _ _（左から読んで2つとも ys の口で消える。前は G15）", std([...GO_DEFAULT, "5 go inc _ _"]), "(construct 5 (unit (compose go inc)))", "A", { leftoverDiag: ["(compose go inc)"] }],
	["R105 で通る [<<] _ inc 5（§5 Q74 (a)。前は G5）", r28("[<<] _ inc 5"), "(unit (apply (compose [<<] inc) 5))", "A", { pfInfo: "[<<]", leftoverDiag: ["(apply (compose [<<] inc) 5)"] }],
	["R105 で通る (f3 !_ 2) _ inc 5（前は G5）", r28("(f3 !_ 2) _ inc 5"), "(unit (apply (compose [f3 !_ 2] inc) 5))", "A", { leftoverDiag: ["(apply (compose [f3 !_ 2] inc) 5)"] }],
	["R105 で通る [* 2,] 1 _ inc 5（前は G5）", r28("[* 2,] 1 _ inc 5"), "(apply inc (apply [* 2,] (construct 1 5)))", "A"],
	["R105 で通る go _ inc 5（既定値のある関数。R107 で zs を埋める。前は G15）", std([...GO_DEFAULT, "go _ inc 5"]), "(apply (compose go inc) (construct 5 _))", "未知"],
	["R105 で通る i _ inc 5（恒等射。R74 で恒等射が消える。前は G5）", r28("i _ inc 5"), "(apply inc 5)", "A"],
	// 片イ（R126）で G6 は廃止。`@f` の f は未定義で種類の未知な項、後ろの関数は積む予想で余ったラムダの `_`（R120・R42・R52。leftover-lambda を予想の上で出すかは
	// §5 Q85 (l)）。`_` が消えて `@f inc` と同じ（前は G6、その前は G5）。
	["@f _ inc は `@f inc` と同じ（前は G6、その前は G5）", r28("@f _ inc"), "(construct @f (unit inc))", "未知", { severities: ["information/undefined-name", "warning/leftover-lambda"] }],
	// 片イ（R125）で G16 は廃止。末尾の `_` が消えて関数を返す本体は `_` と bare-function-return（下の4行。前は G16）。
	["fz : x ? add x _ は本体の根が `add x`（前は G16、その前は終わりの A）", r28("fz : x ? add x _"), "(: fz (? [x] (unit (apply add x))))", "A", { severities: ["information/bare-function-return"] }],
	["h : [f] ? f 1 _ ⏎ h [f : [f3 !_ !_ 3]] は実体の本体の根が `f 1`（前は G16、その前は終わりの A）", r28(["h : [f] ? f 1 _", "h [f : [f3 !_ !_ 3]]"]), "(apply h [f : [f3 !_ !_ 3]])", "A", { severities: ["information/bare-function-return"] }],
	["前の門の見本 bad : [y ~ys] ? [+ 1] _ _ は `[+ 1]` を返す本体（前は G16、その前は G5）", r28(["bad : [y ~ys] ? [+ 1] _ _", "bad [1]"]), "(apply bad [1])", "A", { severities: ["information/bare-function-return"] }],
	["R49 の試しの ap5 : f [x] ? @f x _ ⏎ ap5 $add 5 は `add 5` を返す本体（前は G16、R49 の試しでは終わりの A）", r28(["ap5 : f [x] ? @f x _", "ap5 $add 5"]), "(apply ap5 (construct $add 5))", "A", { severities: ["information/bare-function-return"] }],
];
const r28Refused = [
	// 末尾の `_` を消した並びと同じ門（手順2・前検査）
	// `inc 5 !_ 6 _`・`inc 1 _ 2 _`（`inc 5 !_ 6`・`inc 1 _ 2` と同じ G13）は、2026-10-27 の R89（§5 Q40 の残りの答え）で、末尾の `_` を外した並びと一緒に通る側
	// （いちばん後ろの「R83〜R93」の節）へ移した。
	["1 & !_ _ は `1 & !_` と同じ G7（§5 Q15。前は `(apply !_ _)` で通っていた）", r28("1 & !_ _"), "G7"],
	// `@f _ inc`（G6）と、末尾の `_` が消えて関数を返す本体の4行（R33 の G16。前の門の見本は `[+ 1] _ 1` に替え、2026-10-28 の R105 でさらに `[[g5] ? g5] !_ 1`
	// に替えた）は、片イ（R125・R126）で上の r28Passes の終わりへ移した。
	// 今のまま断る所（内側の `_`・位置の数えられない `_`・R39 の口）
	// 2026-10-28 の R105（値の口の書いた `_` は単位律で消える）で、ここにあった内側の `_` の G5 の2行と、合成の段の既定値の無い口の G15 の1行（左から読むと2つの `_` が
	// go の ys の口で消える）は割れが無くなり、`_` を消した綴りと同じく通る側（上の r28Passes の終わり。`mx _ 3` はいちばん後ろの「R105〜R110」の節）へ移した。
	// 2026-10-26 の確かめの直し（§5 Q74）。関数を挟んで値が続く `_` は内側の `_`：5 が `_` の口に入る読み（`f2 inc 5`）と、`_` の次の口に入る穴の読み
	// （`a ? f2 a inc 5`）で割れる。最初の版は次の項が関数なら消して通していた。HEAD 154cf275 と同じ門
	// `f2 _ inc 5`・`mx _ inc 5`（G5）は、2026-10-27 の R86（§5 Q74 (a) の答え：穴で位置を保つ）で通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	// 2026-10-28 の R105 で、関数を挟んで値が続く `_` も消える読みに決まった（§5 Q74 (a) は R86 の穴の読みから消える読みへ変わった）。ここに残っていた5行（G5 の4行・
	// G15 の1行）は、`_` を消した綴りと同じく通る側（上の r28Passes の終わり）へ移した。
	// 種類の決まらない項の後ろの `_`：既定値のある関数の部分適用なら、後ろの `_` は既定値（R39）とも読める。最初の版は前検査で `_` を落として未知で通していた
	// 2026-10-28 の R110 で、評価する所（行の根）の `(gq 1) _`・`w : gq 1` ⏎ `w _`（G7）は、`_` を消しても既定値で埋めても値が同じ（R107）なので通る側（いちばん後ろの
	// 「R105〜R110」の節）へ移した。評価する所の外（`[(gq 1) _]`）は G7 のまま（同じ節、§5 Q80）。
	// `5 + inc _`（`(5 + inc) _`、G7）は、2026-10-27 の R87 で `5 + inc` が A になり、後ろの `_` が値の隣で消えて通る側（いちばん後ろの「R83〜R93」の節）へ移した。
	// 1行の括りの点なしの形の項の後ろの `_`：末尾の `_` を消してから括りの形を見れば点なし、書いた項で見れば中の並びの読み。最初の版は `(!_ _)` を恒等射にしていた
	// 2026-10-28 の R108（§5 Q74 (c) を閉じた）で、`!_` の後ろの `_` は書いた項どおり読む（恒等射）。`(!_ _) 5`・`double (!_ _) 5`・根の `(!_ _)`・`w : [!_ _]` ⏎ `w 5 6`・
	// `map $[!_ _] vs`（G7）は通る側（いちばん後ろの「R105〜R110」の節）へ移した。`,` を付けた `[!_ _ ,]` と、ほかの点なしの形（`(-_ _)`・`(+ 1 _)`）は今のまま G7。
	["Q74 [!_ _ ,] vs（G7。`[!_ ,] vs` は否定の写像。R108 は `,` の無い括りだけで、今のまま）", r28("[!_ _ ,] vs"), "G7"],
	["Q74 根の (-_ _)（G7。最初の版は根で未知のまま通していた）", r28("(-_ _)"), "G7"],
	// 片イ（R119）から、`+ 1 _` は区間の後ろに項が並ぶので点なしの形ではなく、中置の左の被演算子が欠けた形として読む段で止める。
	["Q74 根の (+ 1 _)（前は G7、R119）", r28("(+ 1 _)"), "infix-missing-operand"],
];
for (const [name, s, want, kind, extra] of r28Passes) checkPass(`R28 ${name}`, s, want, kind, extra);
for (const [name, s, want, inst] of r28Refused) checkRefused(`R28 ${name}`, s, want, inst);

// ---------------------------------------------------------------------------
// R83〜R93（2026-10-27。`_` は置かれた演算の単位・空の流れ・§5 の A と B の答え）
// ---------------------------------------------------------------------------
// 根拠（U の時刻は UTC、sid c8ccdd69。Q68 の答えは同じ会話が再起動した後の 29bed94e）：
// - R83・R84（§5 Q69）：U [2026-10-26 10:18]「[]~ = _~ だと思っていいとなると。 _~ は展開しても _ として考え直していいわけ。」、主の Claude の読み「`_` は置かれた
//   演算の単位（括りの口では連結の単位で詰まり、値の口では「その段に当てない」＝穴で位置を保つ）」に U〔答え〕[2026-10-26 11:35]「という事は、 sub の場合は括られない
//   はずだから、位置を覚えるね。 / []~ = _~ = _ / [] = _ / をきちんと念頭に」。
// - R87〜R90（と G22 のままの Q72）：主の Claude の 2026-10-26 11:57 の表の A（今日の裁定から答えが出せそうな物。Q73・Q14 の残り・Q40 の残り・Q70・Q72 の5行）。利用者は
//   B の行と R39 にだけ答え（U [2026-10-26 23:35]）、A の行には異議を言わなかったので、主の Claude はこれまでの取り決め（傾きと違う物だけ言う）どおり傾きで受けた（R）。
//   Q73 の裏付けは U [2026-10-25 22:11 e20e5341]「x + sum _ = x + sum = x + _ だから x だけが返る…と言いたいな。」。
// - R86（§5 Q74 (a)）は A の表に無い。根拠は決定の文と、値の口の読み（R83）への U〔答え〕[2026-10-26 11:35]「…位置を覚えるね。…」。
// - 2026-10-27 の確かめの直し（§7.45）：R86 は `_` より前に関数がある並び（合成の頭）を今のまま断る。`~_` は書いた `[_]` と同じ項（R79。最初の版は書いた `[]` にして
//   `[_]` と割れた）。`_` と分かる値・長さ 0 と分かる List を撒けば空の流れ（R84）、中置の被演算子の空の流れも `_`。空の文字列も R90。実体の中の残りの名前は長さを
//   持たない（最初の版は List 全体の長さを持たせて、長さの違う呼び出しが答えを分け合った）。
// - R91（§5 Q71）：U〔答え〕[2026-10-26 23:35]「Q71 / 傾きで良い」。R92（§5 Q66）：同じ発言の「アドレス同士の計算は、きちんとアドレス値だと言いえるものだけに限定する
//   原則が重要！」。R93（§5 Q68）：U〔答え〕[2026-10-26 23:39 29bed94e]「その読みでいい。書いた形のまま `[[1 2] 3]` を渡し、付けた括りの形（`[a b c]` か `[[a b] c]`
//   か）が受けられるかを決める。次の片に入れて。」（ボタンの文は主の Claude の物）。
// 前の答えで断っていて通る側へ移した行は、元の所に注を残して、ここに置く。
const R83D = [
	"fp : [a b c] ? a + b * c", "fh : [x ~xs] ? x", "fl : [~xs] ? xs", "pb2 : [a] [b] ? a", "fab : [a b] ? a + b", "mx : a [b] ? a", "e0 : []", "un : _", "i : !_", PQ,
	"sub : x y ? x - y", "fe : [a b c] ? $c == $c", "fq : [a b c] ? a", "sum : y ? y", "go :", "\t\tys", "\t\tzs : 3", "\t? ys", "",
];
const r83 = (lines) => std([...R83D, ...[].concat(lines)]);
const r83a = (lines) => std(["five : 5", ...[].concat(lines)]); // 番地の組（R92）
const r83Passes = [
	// R84：空の流れは書いた `_` と同じ印。値の口は穴（R16・R38）か、並びの終わりなら消える（R28）。前は R51 の流れの1項（口2つは畳み込みの `_`、口1つは R70）。
	["R84 inc []~ 5 は `inc _ 5` と同じ 6（R38。前は G19、§5 Q69）", r83("inc []~ 5"), "(apply inc 5)", "A"],
	// 2026-10-28 の R105 で、値の口の書いた `_`（と同じ印の空の流れ）は単位律で消える（下の2行と `go []~ 2`・`f3 []~ 1 2` も）。前は R16 の穴で位置を保っていた。
	["R84 add []~ 3 は `add _ 3` と同じ `add 3`（R105。前は R16 の `a ? add a 3`、その前は閉じた `_` の後ろに 3）", r83("add []~ 3"), "(unit (apply add 3))", "A", { leftoverDiag: ["(apply add 3)"] }],
	["R84 sub []~ 3 は `sub 3`（R105。前は位置を保つ `a ? sub a 3`、U〔答え〕10-26 11:35 の sub）", r83("sub []~ 3"), "(unit (apply sub 3))", "A", { leftoverDiag: ["(apply sub 3)"] }],
	["R84 書いた _~ は `_`（前は未知）", r83("_~"), "_~", "A"],
	["R84 inc _~ 5 は `inc _ 5` と同じ（前は G7）", r83("inc _~ 5"), "(apply inc 5)", "A"],
	["R84 括りの口の流れ1つは撒いた器そのもの：fq []~ は `fq []`（R64 のまま、R90 で A。前は未知）", r83("fq []~"), "(apply fq []~)", "A"],
	["R84 括りの受ける並びの中では消える：fq []~ 1 2 は `fq 1 2`（R15。前は未知）", r83("fq []~ 1 2"), "(apply fq (construct 1 2))", "A"],
	["R84 fq 1 []~ 2 も `fq 1 2`（前は未知）", r83("fq 1 []~ 2"), "(apply fq (construct 1 2))", "A"],
	["R84 最後でない括りの口：pb2 []~ 1 は `pb2 _ 1` と同じ（R15 で消えて詰まる。前は G19、§5 Q75）", r83("pb2 []~ 1"), "(unit (apply pb2 1))", "A", { leftoverDiag: ["(apply pb2 1)"] }],
	["R84 既定値のある関数：go []~ は `go _` と同じ go（前は G19）", r83("go []~"), "(unit go)", "A", { leftoverDiag: ["go"] }],
	["R84 既定値のある口：go 1 []~ は `go 1 _` と同じ既定値（R39。前は G19）", r83("go 1 []~"), "(apply go (construct 1 []~))", "未知"],
	["R84 既定値の無い口：go []~ 2 は `go _ 2` と同じ `go 2`、根なので R107 で zs を既定値で埋める（R105。前は R68 のカリー化、その前は G19）", r83("go []~ 2"), "(apply go (construct 2 _))", "未知", { leftoverDiag: [] }],
	["R84 口3つ：f3 []~ 1 2 は `f3 _ 1 2` と同じ `f3 1 2`（R105。前はカリー化、その前は G19）", r83("f3 []~ 1 2"), "(unit (apply f3 (construct 1 2)))", "A", { leftoverDiag: ["(apply f3 (construct 1 2))"] }],
	["R84 inc e0~ 5（名前を撒いても同じ。前は G19）", r83("inc e0~ 5"), "(apply inc 5)", "A"],
	["R84 add 1 []~ 3 は `add 1 _ 3` と同じ（R43。前は G19）", r83("add 1 []~ 3"), "(apply add (construct 1 3))", "A"],
	["R84 inc []~ inc は `inc _ inc` と同じ合成（R28。前は G19）", r83("inc []~ inc"), "(unit (compose inc inc))", "A", { leftoverDiag: ["(compose inc inc)"] }],
	["R84 (inc []~) 5 は `(inc _) 5` と同じ 6（前は G19）", r83("(inc []~) 5"), "(apply [inc []~] 5)", "A"],
	["R84 [inc []~] は括りの関数で、根で `_`（前は G19）", r83("[inc []~]"), "(unit [inc []~])", "A", { leftoverDiag: ["[inc []~]"] }],
	["R84 w : inc []~ ⏎ w（w は inc、根で `_`。前は G19）", r83(["w : inc []~", "w"]), "(unit w)", "A", { leftoverDiag: ["w"] }],
	["R84 w : inc []~ ⏎ w 3 は 4", r83(["w : inc []~", "w 3"]), "(apply w 3)", "A"],
	["R84 $[inc []~] は `$inc` と同じ先（前は G19）", r83("$[inc []~]"), "$[inc []~]", "A"],
	["R84 [_~] 5（前は G7）", r83("[_~] 5"), "(construct [_~] 5)", "A"],
	["R84 []~ 5 は 5（値の隣で消える、R43。前は `(construct []~ 5)`）", r83("[]~ 5"), "5", "A"],
	["R84 5 []~ は 5（前は `(construct 5 []~)`）", r83("5 []~"), "5", "A"],
	["R84 inc [[]]~ 5（[x] ≅ x で空の流れ。前は G19）", r83("inc [[]]~ 5"), "(apply inc 5)", "A"],
	// 点なしの可変長の口の流れ1つ（片5 は R51 の丸ごとで `(apply i []~)` の未知・`(apply [* 2,] []~)` の A）は、2026-10-27 の片6 の R95（§5 Q75 (b) の点なしの所の答え：
	// U〔答え〕[2026-10-27 09:25 df447414]「4. それは点無しの関数が残るはず。」）で、書いた `_` と同じく点なしの関数が残る。
	["R84・R95 恒等射の流れ1つ：i []~ は `i _` と同じ i（恒等射なので知らせない）", r83("i []~"), "(unit i)", "A", { diagCount: 0 }],
	["R84・R95 貪欲な単項の流れ1つ：[* 2,] []~ は `[* 2,] _` と同じ", r83("[* 2,] []~"), "(unit [* 2,])", "A", { leftoverDiag: ["[* 2,]"] }],
	// 2026-10-27 の確かめの直し：`_` と分かる値（印 zero）・長さ 0 と分かる List を撒いた流れも空の流れ（`_~ = _`）。中置の被演算子の空の流れも書いた `_`。
	["R84 inc [_]~ 5（前は G2(a)）", r83("inc [_]~ 5"), "(apply inc 5)", "A"],
	["R84 inc un~ 5（un : _。前は G2(a)）", r83("inc un~ 5"), "(apply inc 5)", "A"],
	["R84 fat : [a b c] ? inc c~ 5 ⏎ fat 1 2（足りない c を撒く。前は G2(a)）", r83(["fat : [a b c] ? inc c~ 5", "fat 1 2"]), "(apply fat (construct 1 2))", "A"],
	["R84 []~ + 1 は `_ + 1`（前は未知）", r83("[]~ + 1"), "(+ []~ 1)", "A"],
	["R84 inc ([]~ + 1) は `inc (_ + 1)` と同じ（前は G7）", r83("inc ([]~ + 1)"), "(apply inc [[]~ + 1])", "A"],
	["R84 _~ + 1", r83("_~ + 1"), "(+ _~ 1)", "A"],
	// R85（片5：書いた `[]` は値の口では断る）は、2026-10-27 の片6 の R94 で廃止（値の口では同じ位置に書いた `_` と同じ。下の「R94・R95」の節）。口でない所・器を受ける
	// 口は、R85 でも R94 でも今のまま。
	["R85・R94 閉じた値の後ろの [] は口でない：inc 5 []", r83("inc 5 []"), "(construct (apply inc 5) [])", "A"],
	["R85・R94 頭の名前の無い括りの口：fl [] は本体を読む（R64）", r83("fl []"), "(apply fl [])", "A"],
	["R85・R94 可変長の口：[* 2,] []", r83("[* 2,] []"), "(apply [* 2,] [])", "A"],
	// R86（§5 Q74 (a)）：関数を挟んで値が続く `_` は穴で位置を保つ（前は G5）。
	// 2026-10-28 の R105 で R86 は廃止：値の口の書いた `_` は単位律で消える（U〔答え〕[2026-10-27 15:59 58a809c9]）。`f2 _ inc 5` は `f2 inc 5`（合成 `(compose f2 inc)` に
	// 5 が入り、5 は x）。下の行は R105 の答えに直した（前の答えは名前の「前は」に書いた。前は穴 `(? [$p0] (apply (compose (apply f2 $p0) inc) 5))` で 5 は y）。
	["R86 f2 _ inc 5 は R105 で `f2 inc 5`（5 は x。前は `a ? f2 a inc 5` で 5 は y）", r83("f2 _ inc 5"), "(unit (apply (compose f2 inc) 5))", "A", { leftoverDiag: ["(apply (compose f2 inc) 5)"] }],
	["R86 mx _ inc 5 は R105 で `mx inc 5`（括りの関数の裸の口。前は穴）", r83("mx _ inc 5"), "(unit (apply (compose mx inc) 5))", "A", { leftoverDiag: ["(apply (compose mx inc) 5)"] }],
	["R86 add _ inc 5 は R105 で `add inc 5`（前は穴）", r83("add _ inc 5"), "(unit (apply (compose add inc) 5))", "A", { leftoverDiag: ["(apply (compose add inc) 5)"] }],
	["R86 f2 3 _ inc 5 は R105 で `_` を消した綴りと同じ（y の口の `_` が消え、5 は合成の流れで y へ。前は穴は y、閉じた f2 の後ろに inc 5 が積まれる）", r83("f2 3 _ inc 5"), "(apply (compose (apply f2 3) inc) 5)", "A", { leftoverDiag: [] }],
	["R86 5 f2 _ inc 5（値の後ろに積まれた頭も同じ。R105 で `_` が消え、積まれた f2 の並びは `_` を消した綴りと同じ。前は穴）", r83("5 f2 _ inc 5"), "(construct 5 (unit (apply (compose f2 inc) 5)))", "A", { leftoverDiag: ["(apply (compose f2 inc) 5)"] }],
	["R86 (f2 _ inc 5) 7 は R105 で `(f2 inc 5) 7` で `inc (5 - 7)`（前は R86 の穴で `inc (7 - 5)`）", r83("(f2 _ inc 5) 7"), "(apply [f2 _ inc 5] 7)", "A"],
	["R86 f2 []~ inc 5 は `f2 _ inc 5` と同じ（R84。R105 で `f2 inc 5`、前は穴）", r83("f2 []~ inc 5"), "(unit (apply (compose f2 inc) 5))", "A", { leftoverDiag: ["(apply (compose f2 inc) 5)"] }],
	["R86 f2 _ inc 5 _（末尾の `_` は消える。R105 で `f2 inc 5`、前は穴）", r83("f2 _ inc 5 _"), "(unit (apply (compose f2 inc) 5))", "A", { leftoverDiag: ["(apply (compose f2 inc) 5)"] }],
	// R87（§5 Q73）：値の演算子の被演算子は評価する所。丸ごとの関数は `_` になり知らせる（前は項が未知、並びの中は G7。§5 Q22）。
	["R87 inc + 1 は `_ + 1`", r83("inc + 1"), "(+ (unit inc) 1)", "A", { leftoverDiag: ["inc"] }],
	["R87 5 + inc", r83("5 + inc"), "(+ 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["R87 inc + 1 5（前は G7）", r83("inc + 1 5"), "(construct (+ (unit inc) 1) 5)", "A", { leftoverDiag: ["inc"] }],
	["R87 -inc 5（値の印も同じ。前は G7）", r83("-inc 5"), "(construct -inc 5)", "A", { leftoverDiag: ["inc"] }],
	["R87 [-inc] 5（前は G7）", r83("[-inc] 5"), "(construct [-inc] 5)", "A", { leftoverDiag: ["inc"] }],
	["R87 x + sum _ は `(x + sum) _` で x + _（U [2026-10-25 22:11 e20e5341] の式）", r83("x + sum _"), "(+ x (unit sum))", "A", { leftoverDiag: ["sum"] }],
	["R87 5 + inc _（前は G7、§5 Q74 (b)）", r83("5 + inc _"), "(+ 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["R87 i + 1（恒等射は知らせない）", r83("i + 1"), "(+ (unit i) 1)", "A", { diagCount: 0 }],
	["R87 $-inc は `-_` を読む参照（前は G20）", r83("$-inc"), "$-inc", "A", { leftoverDiag: ["inc"] }],
	["R87 (add 1) + 2（括った部分適用も丸ごとの関数）", r83("(add 1) + 2"), "(+ (unit [add 1]) 2)", "A", { leftoverDiag: ["[add 1]"] }],
	["R87 inc * inc（両方の被演算子）", r83("inc * inc"), "(* (unit inc) (unit inc))", "A", { leftoverDiag: ["inc", "inc"] }],
	["R87 !!inc", r83("!!inc"), "!!inc", "A", { leftoverDiag: ["inc"] }],
	["R87 5 # inc（片9b の R116 で右の被演算子も評価する所。前は今のままの `(# 5 inc)`、§5 Q73 の残り）", r83("5 # inc"), "(# 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	// R88（§5 Q14 の残り）：`~_` は書いた `[_]` と同じ項（R79。`_` と分かる値、R63。前は G4・未知）。2026-10-27 の確かめの直しで、最初の版の「書いた `[]` と同じ項」から
	// 書き直した（`inc ~_` は G5 だったが、`inc [_]` は A で割れていた）。
	["R88 ~_", r83("~_"), "~_", "A"],
	["R88 ~_ 5（前は G4。`[_] 5` と同じ）", r83("~_ 5"), "(construct ~_ 5)", "A"],
	["R88 [~_] 5（前は G7）", r83("[~_] 5"), "(construct [~_] 5)", "A"],
	["R88 fh ~_ は `fh [_]` と同じ（R90 の印 zero）", r83("fh ~_"), "(apply fh ~_)", "A"],
	// 値の口の `inc ~_`・`add ~_ 3`・`inc [~_]`（片5 は `inc [_]` と同じ A の `(apply inc ~_)` など）は、2026-10-27 の片6 の R94（§5 Q75 (a) の答え）で、中身が詰まって `[]` に
	// なる書いた括りとして、同じ位置に書いた `_` と同じになった（`inc [_]` も同じ）。
	["R88・R94 inc ~_ は `inc _` と同じ（片5 は A、確かめの直しの前は G5）", r83("inc ~_"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R88・R94 add ~_ 3 は `add _ 3` と同じ（2026-10-28 の R105 で `add 3`、前は R16 の穴。片5 は `(apply add (construct ~_ 3))`）", r83("add ~_ 3"), "(unit (apply add 3))", "A", { leftoverDiag: ["(apply add 3)"] }],
	["R88・R94 inc [~_]（[x] ≅ x。片5 は A）", r83("inc [~_]"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R88 e6 : ~_ ⏎ fh e6（名前を通しても `fh [_]` と同じ。確かめの直しの前は未知）", r83(["e6 : ~_", "fh e6"]), "(apply fh e6)", "A"],
	["R88 e8 : ~[] ⏎ fh e8（`fh [[]]` と同じ。確かめの直しの前は未知）", r83(["e8 : ~[]", "fh e8"]), "(apply fh e8)", "A"],
	["R88 inc ~_~ 5 の形：e6 : ~_ ⏎ inc e6~ 5 は空の流れ（確かめの直しの前は G2(a)）", r83(["e6 : ~_", "inc e6~ 5"]), "(apply inc 5)", "A"],
	// R89（§5 Q40 の残り）：閉じた頭の後ろの口の外の `!_` と `_` は並びの単位（前は G13・G5）。
	["R89 inc 5 !_ 6 は `(inc 5) (!_ 6)`（値は `(inc 5) 6`）", r83("inc 5 !_ 6"), "(construct (apply inc 5) (apply !_ 6))", "A"],
	["R89 inc 5 _ 6 は `(inc 5) 6`", r83("inc 5 _ 6"), "(construct (apply inc 5) 6)", "A"],
	["R89 inc 1 _ 2", r83("inc 1 _ 2"), "(construct (apply inc 1) 2)", "A"],
	["R89 pq 1 2 !_ 5（括りの関数の頭も同じ）", r83("pq 1 2 !_ 5"), "(construct (apply pq (construct 1 2)) (apply !_ 5))", "A"],
	["R89 5 add 1 2 !_ 3（値の後ろに積まれた頭も同じ）", r83("5 add 1 2 !_ 3"), "(construct 5 (apply add (construct 1 2)) (apply !_ 3))", "A"],
	["R89 5 inc 7 !_ 3", r83("5 inc 7 !_ 3"), "(construct 5 (apply inc 7) (apply !_ 3))", "A"],
	["R89 5 inc 7 _ 3", r83("5 inc 7 _ 3"), "(construct 5 (apply inc 7) 3)", "A"],
	["R89 inc 3 add 1 2 !_ 3", r83("inc 3 add 1 2 !_ 3"), "(construct (apply inc 3) (apply add (construct 1 2)) (apply !_ 3))", "A"],
	["R89 5 pq 1 2 !_ 3", r83("5 pq 1 2 !_ 3"), "(construct 5 (apply pq (construct 1 2)) (apply !_ 3))", "A"],
	["R89 inc 5 !_ 6 _（末尾の `_` を外した並びと同じ）", r83("inc 5 !_ 6 _"), "(construct (apply inc 5) (apply !_ 6))", "A"],
	["R89 inc 1 _ 2 _", r83("inc 1 _ 2 _"), "(construct (apply inc 1) 2)", "A"],
	// R90（§5 Q70）：頭の名前がある括りに空の List か `_` と分かる値が来たら、本体を読まずに `_`（A。前は未知）。
	["R90 fh []", r83("fh []"), "(apply fh [])", "A"],
	["R90 fh e0（名前を通しても同じ）", r83("fh e0"), "(apply fh e0)", "A"],
	["R90 fq un（`_` と分かる値も、参照の口では空の器）", r83("fq un"), "(apply fq un)", "A"],
	["R90 (fh []) 5（前は G7）", r83("(fh []) 5"), "(construct [fh []] 5)", "A"],
	// 2026-10-27 の確かめの直し：空の文字列（String ≅ List(Char) の空の List）も同じ（前は R91 の長さ 0 の実体で本体を読んだ）。
	["R90 fe に空の文字列（前は G7）", r83("fe ``"), "(apply fe ``)", "A"],
	["R90 len : [x ~xs] ? 1 + len xs ⏎ len に空の文字列（本体を読まない。前は本体の余ったラムダを知らせた）", r83(["len : [x ~xs] ? 1 + len xs", "len ``"]), "(apply len ``)", "A", { diagCount: 0 }],
	// R91（§5 Q71）：書いた時点で長さの分かる List で足りない名前は `_`。名前が足りる長さは今のまま。
	["R91 fe 1 2 3（足りる長さは今のまま）", r83("fe 1 2 3"), "(apply fe (construct 1 2 3))", "A"],
	["R91 fq 1 2（足りない c は `_`、本体は a だけを読む）", r83("fq 1 2"), "(apply fq (construct 1 2))", "A"],
	// 2026-10-27 の確かめの直し：実体の中の残りの名前は長さを持たない（実体は長さで分けない、R24 の線）。書いた所で長さの分からない `fe xs` は R91 に当たらず、
	// 呼んだ順に依らず同じ答え（最初の版は List 全体の長さを残りの名前に持たせ、`g1 [1 2]` は G7、`g1 [1 2 3 4]` の後なら A だった）。
	["R91 g1 : [x ~xs] ? fe xs ⏎ g1 [1 2]", r83(["g1 : [x ~xs] ? fe xs", "g1 [1 2]"]), "(apply g1 [1 2])", "A"],
	["R91 g1 [1 2 3 4] の後の g1 [1 2]（呼んだ順に依らない）", r83(["g1 : [x ~xs] ? fe xs", "g1 [1 2 3 4]", "g1 [1 2]"]), "(apply g1 [1 2])", "A"],
	["R91 g1 [1 2] の後の g1 [1 2 3 4]", r83(["g1 : [x ~xs] ? fe xs", "g1 [1 2]", "g1 [1 2 3 4]"]), "(apply g1 [1 2 3 4])", "A"],
	// R92（§5 Q66）：どちらも番地と言える物の中で、顔が1つに決まる組（前は G21）。答えの顔は後ろの演算で見分ける。
	["R92 ($vs - $five) + 0x10 は差", r83a("($vs - $five) + 0x10"), "(+ [$vs - $five] 0x10)", "A"],
	["R92 0x10 + $vs は点", r83a("0x10 + $vs"), "(+ 0x10 $vs)", "A"],
	["R92 ($vs - $five) + $vs は点", r83a("($vs - $five) + $vs"), "(+ [$vs - $five] $vs)", "A"],
	["R92 0x10 + ($vs - $five) は差", r83a("0x10 + ($vs - $five)"), "(+ 0x10 [$vs - $five])", "A"],
	["R92 ($vs - $five) - 0x10 は差", r83a("($vs - $five) - 0x10"), "(- [$vs - $five] 0x10)", "A"],
	["R92 顔 (0x10 + $vs) - $vs（点 − 点で差）", r83a("(0x10 + $vs) - $vs"), "(- [0x10 + $vs] $vs)", "A"],
	["R92 顔 (($vs - $five) + 0x10) + $vs（差 + 点で点）", r83a("(($vs - $five) + 0x10) + $vs"), "(+ [[$vs - $five] + 0x10] $vs)", "A"],
	["R92 顔 $vs == (0x10 + $vs)（点どうしの比べ）", r83a("$vs == (0x10 + $vs)"), "(== $vs [0x10 + $vs])", "A"],
	// R93（§5 Q68）：書いた形のまま実引数の形（前は G3）。
	["R93 fp 1 2 , 3 は `fp (1 2 , 3)`（`[[1 2] 3]`）", r83("fp 1 2 , 3"), "(apply fp [1 2 , 3])", "A"],
	["R93 fab 1 , 2 3 は `fab (1 , 2 3)`（`[1 [2 3]]`）", r83("fab 1 , 2 3"), "(apply fab [1 , 2 3])", "A"],
	["R93 括った fab 1 , (2 3) は今のまま", r83("fab 1 , (2 3)"), "(apply fab [1 , [2 3]])", "A"],
	["R93 fp 1 , 2 , 3 4", r83("fp 1 , 2 , 3 4"), "(apply fp [1 , 2 , 3 4])", "A"],
	["R93 fab 1 , 2 3 , 4（要素は 3 つで知らせる、R64）", r83("fab 1 , 2 3 , 4"), "(apply fab [1 , 2 3 , 4])", "A"],
	["R93 fp _ , 1 , 2 は `fp (_ , 1 , 2)` で `fp (1 , 2)`（R61）", r83("fp _ , 1 , 2"), "(apply fp [_ , 1 , 2])", "A"],
	["R93 fl 1 2 , 3（残りだけの括りも同じ）", r83("fl 1 2 , 3"), "(apply fl [1 2 , 3])", "A"],
	["R93 mx 1 2 3 , 4（前の裸の口を埋めた後ろの括り。要素は 2 つで知らせる）", r83("mx 1 2 3 , 4"), "(apply mx (construct 1 [2 3 , 4]))", "A"],
	["R93 5 fp 1 2 , 3（値の後ろに積まれた頭も同じ）", r83("5 fp 1 2 , 3"), "(construct 5 (apply fp [1 2 , 3]))", "A"],
	// 2026-10-28 の R105 で、下の r83Refused にあった R86 の残り（G5）が通るので、この節の通る側へ移した（行の綴りは前のまま。答えは `_` を消した綴りと同じ）。
	["R105 で通る f2 _ inc _ 5（前は G5）", r83("f2 _ inc _ 5"), "(unit (apply (compose f2 inc) 5))", "A", { leftoverDiag: ["(apply (compose f2 inc) 5)"] }],
	["R105 で通る f2 inc _ inc 5（合成の頭の内側。前は G5）", r83("f2 inc _ inc 5"), "(unit (apply (compose f2 inc inc) 5))", "A", { leftoverDiag: ["(apply (compose f2 inc inc) 5)"] }],
	["R105 で通る double f2 _ inc 5（前は G5）", r83("double f2 _ inc 5"), "(unit (apply (compose double f2 inc) 5))", "A", { leftoverDiag: ["(apply (compose double f2 inc) 5)"] }],
	["R105 で通る add inc _ inc 5（前は G5）", r83("add inc _ inc 5"), "(unit (apply (compose add inc inc) 5))", "A", { leftoverDiag: ["(apply (compose add inc inc) 5)"] }],
	["R105 で通る mx inc _ inc 5（前は G5）", r83("mx inc _ inc 5"), "(unit (apply (compose mx inc inc) 5))", "A", { leftoverDiag: ["(apply (compose mx inc inc) 5)"] }],
	["R105 で通る f2 [* 2,] _ inc 5（前は G5）", r83("f2 [* 2,] _ inc 5"), "(unit (apply (compose f2 [* 2,] inc) 5))", "A", { leftoverDiag: ["(apply (compose f2 [* 2,] inc) 5)"] }],
	// 片イ（R120）から、R87 の残り（区間の欠けた口・否定・段18 の `'`）は `_` にせず書いたままで、種類の未知な項として後ろの項を積む予想で通る（前は G7）。
	["R87 [+ inc] 5（区間の被演算子は今のまま）（前は G7）", r83("[+ inc] 5"), "(construct [+ inc] 5)", "未知", { diagCount: 0 }],
	["R87 !inc 5（否定は値の演算子でない、今のまま）（前は G7）", r83("!inc 5"), "(construct !inc 5)", "未知", { diagCount: 0 }],
	["R87 inc ' 0 5（段18、今のまま）（前は G7）", r83("inc ' 0 5"), "(construct (' inc 0) 5)", "未知", { diagCount: 0 }],
	// 片イ（R121・R123）で G3 は廃止。`,` の辺も左から畳み、辺の終わりに余った関数は `_` と leftover-lambda（前は G3）。
	["R93 pb2 1 , 2（最後でない括り）（前は G3）", r83("pb2 1 , 2"), "(, (unit (apply pb2 1)) 2)", "A", { leftoverDiag: ["(apply pb2 1)"] }],
	["R93 fp inc 1 , 2（合成の最初の関数の口）（前は G3）", r83("fp inc 1 , 2"), "(, (apply (compose fp inc) 1) 2)", "A", { diagCount: 0 }],
	["R93 fp vs~ , 4（撒く項）（前は G3）", r83("fp vs~ , 4"), "(, (apply fp vs~) 4)", "A", { diagCount: 0 }],
	["R93 fp 1 inc , 2（後ろに関数）（前は G3）", r83("fp 1 inc , 2"), "(, (apply inc (apply fp 1)) 2)", "A", { diagCount: 0 }],
	["R93 f3 1 , 2 , 3（値の口だけの関数、R121 の文面の例）（前は G3）", r83("f3 1 , 2 , 3"), "(, (unit (apply f3 1)) (, 2 3))", "A", { leftoverDiag: ["(apply f3 1)"] }],
];
const r83Refused = [
	// R85（片5：書いた `[]` が値の口に来たら G5）の行（`inc []`・`add [] 3`・`add 3 []`・`[+ 1] []`・`inc e0`・`inc ~[]`・`e8 : ~[]` ⏎ `inc e8`・`add _ []`・`(add !_ 3) []`・
	// `5 inc []`）は、2026-10-27 の片6 の R94（§5 Q75 (a) の答え：U〔答え〕[2026-10-27 09:25 df447414]「1. _ と読んで断らない方向で問題無ければどうぞ」）で、同じ位置に
	// 書いた `_` と同じに通る（名前の `inc e0`・`inc e8` は R63 の A）ので、通る側（下の「R94・R95」の節）へ移した。`mx [] 1` は `mx _ 1` と同じく G5 のまま（言い分が変わった）。
	// 2026-10-28 の R105（値の口の書いた `_` は単位律で消える）で、`mx [] 1`（`mx _ 1` と同じ G5）と、R86 の残りの G5・G15 の11行は、どれも `_` を消した綴りと同じく
	// 通る側へ移した：関数を挟んで値が続く `_`・合成の頭の内側の6行は上の r83Passes の終わり、`mx [] 1` はいちばん後ろの「R105〜R110」の節（恒等射・括った頭・既定値のある
	// 関数・すぐ後ろが値の内側の `_` の5行は、同じ綴りの行が「R28」の節と「R105〜R110」の節にあるので外した）。§5 Q7 の残り（詰めるか位置を保つか）と §5 Q74 (a) の残りは、
	// どちらも消える読みに決まって閉じた。
	// R87 の残り：区間の欠けた口・否定・段18 の `'` は今のまま（§5 Q73 の残り）。この3行（G7）は、片イ（R120）で種類の未知な項の G7 が無くなり、
	// 上の r83Passes の終わりへ移した。
	// R89 の残り：前から n 個に穴か撒く項がある形・既定値のある関数の頭は今のまま。
	["R89 add !_ 1 !_（前から n 個に穴）", r83("add !_ 1 !_"), "G13"],
	["R89 go 1 2 !_（既定値のある関数の頭）", r83("go 1 2 !_"), "G13"],
	// 2026-10-28 の R105 で、書いた `_` は穴に数えないので手順2 が読まず、`f3 vs~ 3 4 6` と同じく畳み込みの撒いた流れの G19（口が3つ残る、R51）。前は `_` が R38 の穴で G13。
	["R89 f3 vs~ 3 4 _ 6（前から n 個に撒く項。R105 で `f3 vs~ 3 4 6` と同じ G19、前は G13）", r83("f3 vs~ 3 4 _ 6"), "G19"],
	// R91：足りない c が `_` なので、`$c == $c` は `$_ == $_`（関数を指す番地の比べ、G7。`fe un un un` と同じ）。実体は長さで分ける。
	["R91 fe 1 2（実体の形 `[N…](2)`）", r83("fe 1 2"), "G7", [["fe", "[N…](2)"]]],
	["R91 fe 5（数は長さ1）", r83("fe 5"), "G7", [["fe", "N(1)"]]],
	["R91 fe [1 2]", r83("fe [1 2]"), "G7", [["fe", "[N…](2)"]]],
	["R91 fe [1 2]~（撒いた流れ1つも同じ）", r83("fe [1 2]~"), "G7", [["fe", "[N…](2)"]]],
	["R91 fe un un un（R63 と同じ線）", r83("fe un un un"), "G7"],
	// R92 の残り（§5 Q66 の残り）
	["R92 顔 $vs == (($vs - $five) + 0x10)（差 + `0x…` は差なので、点と差の比べ）", r83a("$vs == (($vs - $five) + 0x10)"), "G21"],
	// 2026-10-27 の片7 の R96 から、`0x… − 点` は「`0x…` を差と読むと差 − 点で行が無く、点としか読めない」所として断る（答えは同じ G21、言い分が変わった）。
	// `0x10 - ($vs - $five)`（`0x… − 差`）は R96 で差として通る（下の「R96〜R98」の節へ移した）。
	["R92 0x1000 - $vs（`0x…` − 点は点としか読めない。片7 の R96）", r83a("0x1000 - $vs"), "G21"],
	["R92 ($vs - $five) - $vs（差 − 点）", r83a("($vs - $five) - $vs"), "G21"],
	["R92 $vs == ($vs - $five)（点と差の比べ）", r83a("$vs == ($vs - $five)"), "G21"],
	["R92 ($vs - $five) == 0x10（差と `0x…` の比べ）", r83a("($vs - $five) == 0x10"), "G21"],
	["R92 (0x10 + $vs) + 1（点と数）", r83a("(0x10 + $vs) + 1"), "G21"],
	["R92 _ + $vs（書いた `_`）", r83a("_ + $vs"), "G21"],
	["R92 ($vs - $five) * 0x2（`*`）", r83a("($vs - $five) * 0x2"), "G21"],
	// R93 の残り（§5 Q68 の残り）の5行（G3）は、片イ（R121）で G3 が無くなり、上の r83Passes の終わりへ移した。
];
for (const [name, s, want, kind, extra] of r83Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r83Refused) checkRefused(name, s, want, inst);
const r83Messages = [
	// R85 の言い分（`inc []` の G5 が2つの読みを名指しする）は、片6 の R94 で `inc []` が通るので外した。G5 に当たる `mx [] 1` は、書いた `[]` を `_` と読んだことを言い分に添える。
	// 2026-10-28 の R105 で `mx [] 1` は `mx _ 1` と同じく `mx 1` で通る。書いた `[]` を `_` と読み直すのは値の口だけで、値の口の `_` はいつも消えるので、読み直した `_` が
	// 門に当たる所は無くなった（前の見本 `mx [] 1` の G5 と、下の R94 の G15 の言い分の行は外した。言い分の添え書き writtenEmptyNote は解決器に残る）。
	["R87 値の演算子の被演算子の知らせ", r83("inc + 1"), null, ["値の演算子の被演算子", "§4 R42・R48・R87", "§5 Q73 の答え"], []],
];
for (const [name, s, gateId, must, mustNot] of r83Messages) {
	total++;
	let text;
	try {
		const r = resolve(s);
		if (gateId) {
			fail(`言い分 ${name}`, "断るはずが通った");
			continue;
		}
		text = r.diagnostics.filter((d) => d.reason === "leftover-lambda").map((d) => d.message).join("\n");
	} catch (e) {
		if (!gateId || e.gate !== gateId) {
			fail(`言い分 ${name}`, `gate: ${e.gate}`, String(e.message));
			continue;
		}
		text = String(e.message);
	}
	const missing = must.filter((w) => !text.includes(w));
	const extra = mustNot.filter((w) => text.includes(w));
	if (!missing.length && !extra.length) ok(`言い分 ${name}`);
	else fail(`言い分 ${name}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, text);
}

// ---------------------------------------------------------------------------
// R94・R95（2026-10-27 の片6。値の口の書いた `[]`・点なしの可変長の口の空の流れ）
// ---------------------------------------------------------------------------
// 根拠（U の時刻は UTC、sid df447414。片5 の会話が再起動した続き）：主の Claude の問い（2026-10-27 02:35 UTC。片5 の確かめで増えた4つ）に、U〔答え〕[2026-10-27 09:25 df447414]
// 「1. _ と読んで断らない方向で問題無ければどうぞ / 2. そもそも、なんでコード中にからの[]を書かなければならない場面があるのかの方が問題かも / 3. その加法に保証が出来るかが鍵 /
// 4. それは点無しの関数が残るはず。」。
// - R94（問い1、§5 Q75 (a)）：書いた `[]` と、中身が詰まって `[]` になる書いた括り（`[[]]`・`~[]`・`[_]`・`~_`）は、値の口（既定値のある関数の口も）では同じ位置に書いた `_` と
//   同じ。名前（`inc e0`・`inc un`）は R63 の A のまま。参照の口・可変長の口・口でない所は器のまま。
// - R95（問い4、§5 Q75 (b) の点なしの所）：点なしの可変長の口（`[* 2,]`・`[inc,]`・`[+]`・恒等射）に来た長さ 0 の流れも、書いた `_` と同じ（点なしの関数が残る）。元の流れで読むのは
//   括りの関数の最後の括り（参照の口）だけ。本体の根に点なしの関数が残る形は G16（問い2 の線でそのまま受ける）。
// - 問い2・問い3 は記録だけ（`fold $add []` の G16 と、R92 の差の隣の `0x…` は今のまま）。
// 書いた `_` と同じ答えであることは、法則（coproduct_laws.test.js の 31・34）が両側の比べで見る。ここは決定の例を書く。
const R94D = ["gq : x [y : 1] ? x + y", "hd : [a b] [y : 1] ? a", "fold : f [~h] ? @f h~", "tl : [y ~ys] ? ys"];
const r94 = (lines) => r83([...R94D, ...[].concat(lines)]);
const r94Passes = [
	// R94：値の口
	["R94 inc [] は `inc _` と同じ（inc が残り、根で `_`。片5 は G5）", r94("inc []"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	// 2026-10-28 の R105 で、値の口の書いた `_`（と同じに読む `[]`）は単位律で消える：`add [] 3` は `add 3`（下の `add [] !_`・関数を挟んで値が続く `[]`・`use [] 5`・`go [] 2`・`go [] !_`・
	// `gq [] 2` も、R105 の答えに直した。前の答えは名前の「前は」に書いた）。
	["R94 add [] 3 は `add _ 3` と同じ `add 3`（R105。前は `a ? add a 3`、片5 は G5）", r94("add [] 3"), "(unit (apply add 3))", "A", { leftoverDiag: ["(apply add 3)"] }],
	["R94 (add [] 3) 5 は 8（片5 は G5）", r94("(add [] 3) 5"), "(apply [add [] 3] 5)", "A"],
	["R94 add 3 [] は `add 3`（末尾で消える、R28。片5 は G5）", r94("add 3 []"), "(unit (apply add 3))", "A", { leftoverDiag: ["(apply add 3)"] }],
	["R94 add _ []（手順2 の穴の規則が組んだ口も同じ。片5 は G5）", r94("add _ []"), "(unit add)", "A", { leftoverDiag: ["add"] }],
	["R94 add [] !_（穴と一緒でも `add _ !_` と同じ。R105 で `add !_` の R34。前は穴2つ）", r94("add [] !_"), "(unit (? [$p0 [~$p1]] (apply add (construct $p0 $p1~))))", "A", { leftoverDiag: ["(? [$p0 [~$p1]] (apply add (construct $p0 $p1~)))"] }],
	["R94 add !_ 1 []（R34 で余りが前の穴に入る。`add !_ 1 _` と同じ）", r94("add !_ 1 []"), "(unit (? [$p0] (apply add (construct $p0 1))))", "A", { leftoverDiag: ["(? [$p0] (apply add (construct $p0 1)))"] }],
	["R94 inc [] 5 は `inc _ 5` と同じ 6", r94("inc [] 5"), "(apply inc 5)", "A"],
	["R94 f2 [] inc 5 は `f2 _ inc 5` と同じ `f2 inc 5`（R105。前は R86 の穴）", r94("f2 [] inc 5"), "(unit (apply (compose f2 inc) 5))", "A", { leftoverDiag: ["(apply (compose f2 inc) 5)"] }],
	["R94 [+ 1] []（単項の点なしの口。片5 は G5）", r94("[+ 1] []"), "(unit [+ 1])", "A", { leftoverDiag: ["[+ 1]"] }],
	["R94 [* 2] []", r94("[* 2] []"), "(unit [* 2])", "A", { leftoverDiag: ["[* 2]"] }],
	["R94 map inc [] は `map inc _` と同じく `(compose map inc)` が残る（片5 は G5）", r94("map inc []"), "(unit (compose map inc))", "A", { leftoverDiag: ["(compose map inc)"] }],
	["R94 inc double []（合成の中の値の口）", r94("inc double []"), "(unit (compose inc double))", "A", { leftoverDiag: ["(compose inc double)"] }],
	["R94 use [] 5（素の関数の、関数を受ける裸の口も値の口。R105 で `use 5`、前は穴）", r94("use [] 5"), "(unit (apply use 5))", "A", { leftoverDiag: ["(apply use 5)"] }],
	["R94 (add !_ 3) []（穴の関数の口。片5 は G5）", r94("(add !_ 3) []"), "(unit [add !_ 3])", "A", { leftoverDiag: ["[add !_ 3]"] }],
	["R94 (f3 !_ 2) []（R34 の穴の関数の裸の口。片5 は G5）", r94("(f3 !_ 2) []"), "(unit [f3 !_ 2])", "A", { leftoverDiag: ["[f3 !_ 2]"] }],
	["R94 5 inc []（値の後ろに積まれた頭も同じ。片5 は G5）", r94("5 inc []"), "(construct 5 (unit inc))", "A", { leftoverDiag: ["inc"] }],
	// 中身が詰まって `[]` になる書いた括り（List の中の `_` は連結の単位で消える、[x] ≅ x、前置 `~` は書いた `[x]`）
	["R94 inc [_]（片5 は A）", r94("inc [_]"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R94 inc [[]]（片5 は G5）", r94("inc [[]]"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R94 inc ~[]（片5 は G5）", r94("inc ~[]"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R94 inc [_ _]（片5 は A）", r94("inc [_ _]"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R94 inc ([])", r94("inc ([])"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	// 既定値のある関数（裸の仮引数と既定値のある口が値の口。片5 の R85 は外していた）
	["R94 go [] は `go _` と同じ go（片5 は未知の適用）", r94("go []"), "(unit go)", "A", { leftoverDiag: ["go"] }],
	["R94 go [] 2 は `go _ 2` と同じ `go 2`、根なので R107 で zs を既定値で埋める（R105。前は R68 のカリー化、片5 は未知の適用）", r94("go [] 2"), "(apply go (construct 2 _))", "未知"],
	["R94 go 1 [] は zs の既定値（R39。葉の綴りは書いたまま）", r94("go 1 []"), "(apply go (construct 1 []))", "未知"],
	["R94 go [] !_ は `go _ !_` と同じ `go !_` の R34（R105。前は穴2つ、片5 は `[]` を ys に入れた穴の関数）", r94("go [] !_"), "(unit (? [$p0 [~$p1]] (apply go (construct $p0 $p1~))))", "A", { leftoverDiag: ["(? [$p0 [~$p1]] (apply go (construct $p0 $p1~)))"] }],
	["R94 gq [] 2（`[y : 1]` の前の裸の x。R105 で `gq 2`、根なので R107 で y を既定値で埋める。前は R68 のカリー化）", r94("gq [] 2"), "(apply gq (construct 2 _))", "未知"],
	["R94 hd [1 2] []（`[y : 1]` は既定値のある口で、既定値）", r94("hd [1 2] []"), "(apply hd (construct [1 2] []))", "未知"],
	// 今のまま（R94 の外）
	// 2026-10-28 の片9b（R112、§5 Q75 (e) の値の口の所を閉じた）：`_` と分かる名前も値の口では書いた `_` と同じ（`inc _` と同じく inc が残る）。行の中で直した
	// （前は R63 の A で `(apply inc e0)`・`(apply inc e8)`・`(apply inc un)`、片5 は G5）。
	["R112 名前 inc e0 は `inc _` と同じ（前は R94 の外で R63 の A、片5 は G5）", r94("inc e0"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R112 名前 e8 : ~[] ⏎ inc e8 は `inc _` と同じ（前は R94 の外の A、片5 は G5）", r94(["e8 : ~[]", "inc e8"]), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R112 名前 inc un は `inc _` と同じ（前は R94 の外の A）", r94("inc un"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R94 の外：空でない器 inc [1 2] は木の段では A（10-04 の TypeError は型の段の話）", r94("inc [1 2]"), "(apply inc [1 2])", "A"],
	["R94 の外：最後でない括りの口 pb2 [] 1 は空の器", r94("pb2 [] 1"), "(apply pb2 (construct [] 1))", "A"],
	["R94 の外：R34 の穴の関数の最後の括り (f3 !_ 2) 1 []", r94("(f3 !_ 2) 1 []"), "(unit (apply [f3 !_ 2] (construct 1 [])))", "A", { leftoverDiag: ["(apply [f3 !_ 2] (construct 1 []))"] }],
	["R94 の外：既定値のある関数の括りの仮引数 hd [] 1", r94("hd [] 1"), "(apply hd (construct [] 1))", "未知"],
	// 2026-10-28 の R105 の片から、既定値のある関数から作った穴の関数は穴の数を持ち（holeOf）、穴の口は値の口に数える（`(go !_ 2) _` と同じく `[go !_ 2]` が残る、
	// 法則40。§5 Q75 (a) の残りのうち、この形は閉じた）。前は口の数を数えない関数で器のまま `(apply [go !_ 2] [])` の未知。
	["R94 穴の関数 (go !_ 2) [] は `(go !_ 2) _` と同じ（R105 の片の holeOf。前は R94 の外で器の未知、§5 Q75 (a) の残り）", r94("(go !_ 2) []"), "(unit [go !_ 2])", "A", { leftoverDiag: ["[go !_ 2]"] }],
	["R94 の外：恒等射 i [] は器を受ける", r94("i []"), "(apply i [])", "A"],
	["R94 の外：値の隣 [] 5", r94("[] 5"), "(construct [] 5)", "A"],
	["R94 の外：$[[]] は `[]` を読む参照（$[_] は R56 の零射の番地、§5 Q75 (d)）", r94("$[[]]"), "$[[]]", "A"],
	// R95：点なしの可変長の口の空の流れ（片5 は R51 の丸ごと）
	["R95 [inc,] []~ は `[inc,] _` と同じ（片5 は A）", r94("[inc,] []~"), "(unit [inc,])", "A", { leftoverDiag: ["[inc,]"] }],
	["R95 [+] []~ は `[+] _` と同じ R31 の A（片5 は未知）", r94("[+] []~"), "(apply [+] []~)", "A"],
	["R95 [+] inc []~ は `[+] inc _` と同じ（片5 は未知）", r94("[+] inc []~"), "(apply (compose [+] inc) []~)", "A"],
	["R95 inc ([+] inc []~) は `inc ([+] inc _)` と同じ（片5 は G7）", r94("inc ([+] inc []~)"), "(apply inc [[+] inc []~])", "A"],
	["R95 [* 2,] inc []~（点なしを頭にした合成）", r94("[* 2,] inc []~"), "(unit (compose [* 2,] inc))", "A", { leftoverDiag: ["(compose [* 2,] inc)"] }],
	["R95 5 [* 2,] []~", r94("5 [* 2,] []~"), "(construct 5 (unit [* 2,]))", "A", { leftoverDiag: ["[* 2,]"] }],
	["R95 i []~ inc は `i _ inc` と同じ inc（片5 は G18）", r94("i []~ inc"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R95 $[i []~] は `$[i _]` と同じ（片5 は G20）", r94("$[i []~]"), "$[i []~]", "A"],
	["R95 k4 : [~t] ? [+] t~ ⏎ k4 []（本体は R31 の `_`。片5 は未知）", r94(["k4 : [~t] ? [+] t~", "k4 []"]), "(apply k4 [])", "A"],
	["R95 の外：括りの関数の最後の括り fq []~ は `fq []`（R64）", r94("fq []~"), "(apply fq []~)", "A"],
	["R95 の外：R34 の穴の関数の最後の括り (f3 !_ 2) 1 []~ も元の流れ", r94("(f3 !_ 2) 1 []~"), "(apply [f3 !_ 2] (construct 1 []~))", "未知"],
	// 問い2 の記録（`fold $add []` の G16 は今のまま）：G16 は書いた時点で長さ 0 と分かる List を畳む形にだけ当たり、実行時に空になる List では当たらない。
	["問い2 g1 : [x ~xs] ? fold $add xs ⏎ g1 [1]（xs は実行時に空。実体の中の残りの名前は長さを持たない、R91）", r94(["g1 : [x ~xs] ? fold $add xs", "g1 [1]"]), "(apply g1 [1])", "A"],
	["問い2 lz : [x ~xs] ? 1 + (lz xs) ⏎ lz [1]（再帰の終わりの空も同じ）", r94(["lz : [x ~xs] ? 1 + (lz xs)", "lz [1]"]), "(apply lz [1])", "A"],
	["問い2 g3 : [~xs] ? fold $add xs ⏎ g3 [1]", r94(["g3 : [~xs] ? fold $add xs", "g3 [1]"]), "(apply g3 [1])", "A"],
	["問い2 fold $add (tl [1])（関数の結果の空は長さが見えない）", r94("fold $add (tl [1])"), "(apply fold (construct $add [tl [1]]))", "未知"],
	// 片6 の確かめの直し（2026-10-27）：書いた `_` の後ろの書いた `[]` は、着く口を先に数える（writtenEmptyAhead）。最初の版は `[]` を器の値に数えたまま `_` の門（G5・G15）が
	// 先に当たり、同じ位置に書いた `_` の答えと割れていた（`add [_] [_] inc` は HEAD で通っていた形）。
	["R94 add _ [] inc は `add _ _ inc` と同じ（確かめの直しの前は G5）", r94("add _ [] inc"), "(unit (compose add inc))", "A", { leftoverDiag: ["(compose add inc)"] }],
	["R94 add [] [] inc は `add _ _ inc` と同じ（直しの前は G5）", r94("add [] [] inc"), "(unit (compose add inc))", "A", { leftoverDiag: ["(compose add inc)"] }],
	["R94 add [_] [_] inc は `add _ _ inc` と同じ（直しの前は G5、HEAD は通った）", r94("add [_] [_] inc"), "(unit (compose add inc))", "A", { leftoverDiag: ["(compose add inc)"] }],
	["R94 add _ [] [] inc（2つ目の `[]` は R34 で前の穴に入る値の口）", r94("add _ [] [] inc"), "(unit (compose add inc))", "A", { leftoverDiag: ["(compose add inc)"] }],
	["R94 add _ [] _ inc（最後の葉の後ろの `_` は、どちらの読みでも消えるので数えない）", r94("add _ [] _ inc"), "(unit (compose add inc))", "A", { leftoverDiag: ["(compose add inc)"] }],
	["R94 f3 1 _ [[]] inc", r94("f3 1 _ [[]] inc"), "(unit (compose (apply f3 1) inc))", "A", { leftoverDiag: ["(compose (apply f3 1) inc)"] }],
	["R94 use _ [] inc", r94("use _ [] inc"), "(unit (compose use inc))", "A", { leftoverDiag: ["(compose use inc)"] }],
	["R94 (f3 1) [] []（括った頭）", r94("(f3 1) [] []"), "(unit [f3 1])", "A", { leftoverDiag: ["[f3 1]"] }],
	["R94 (add !_ !_) _ []（穴の関数）", r94("(add !_ !_) _ []"), "(unit [add !_ !_])", "A", { leftoverDiag: ["[add !_ !_]"] }],
	["R94 [<<] _ []（畳まない2項の点なし）", r94("[<<] _ []"), "(unit [<<])", "A", { leftoverDiag: ["[<<]"], pfInfo: "[<<]" }],
	["R94 double add _ []（合成の段を越えた口）", r94("double add _ []"), "(unit (compose double add))", "A", { leftoverDiag: ["(compose double add)"] }],
	["R94 add inc _ []（合成の頭の口）", r94("add inc _ []"), "(unit (compose add inc))", "A", { leftoverDiag: ["(compose add inc)"] }],
	["R94 double f3 [] [] []（後ろの葉はまとめて読み直す）", r94("double f3 [] [] []"), "(unit (compose double f3))", "A", { leftoverDiag: ["(compose double f3)"] }],
	["R94 gq _ inc []（既定値のある関数。直しの前は G15）", r94("gq _ inc []"), "(unit (compose gq inc))", "A", { leftoverDiag: ["(compose gq inc)"] }],
	["R94 go _ inc []（直しの前は G15）", r94("go _ inc []"), "(unit (compose go inc))", "A", { leftoverDiag: ["(compose go inc)"] }],
	// 片6 の確かめの直し：括りの中の長さ 0 と分かる流れも連結の単位で消える（`[]~ = _~ = _`）ので、`[_~]`・`[[]~]`・`([]~)`・`[e0~]` も中身が詰まって `[]` になる書いた括り。
	// 最初の版は書いた `_` だけを消し、`inc [_~]` は器の A で `inc [_]` と割れていた（片5 までは同じ答え）。
	["R94 inc [_~] は `inc [_]` と同じ（直しの前は A）", r94("inc [_~]"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R94 inc [[]~]", r94("inc [[]~]"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R94 inc ([]~)（[x] ≅ x で `inc []~` と同じ）", r94("inc ([]~)"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R94 inc [e0~]（中の `e0~` は R84 の長さ 0 の流れ）", r94("inc [e0~]"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R94 (add [_~] 3) 5 は 8（直しの前は `(construct [add [_~] 3] 5)`）", r94("(add [_~] 3) 5"), "(apply [add [_~] 3] 5)", "A"],
	["R94 inc [_~] 5 は 6", r94("inc [_~] 5"), "(apply inc 5)", "A"],
	["R94 map inc [_~]", r94("map inc [_~]"), "(unit (compose map inc))", "A", { leftoverDiag: ["(compose map inc)"] }],
	// 合成の中で値の口に入る所は、いちばん上の関数の今の段（合成の頭から順）の口：頭が可変長の口なら器を受ける（§5 Q75 (b)）。
	["R94 mx inc [] は mx の裸の口で `mx inc _` と同じ", r94("mx inc []"), "(unit (compose mx inc))", "A", { leftoverDiag: ["(compose mx inc)"] }],
	["R94 の外：[* 2,] inc [] は頭の可変長の口で器", r94("[* 2,] inc []"), "(apply (compose [* 2,] inc) [])", "A"],
	// 2026-10-28 の R105 で、下の r94Refused にあった行（G5・G15）が通るので、この節の通る側へ移した（行の綴りは前のまま。値の口の `[]` は書いた `_` と同じく消える）。
	["R105 で通る double f2 [] inc 5（同じ位置に書いた `_` と同じ。前は G5）", r94("double f2 [] inc 5"), "(unit (apply (compose double f2 inc) 5))", "A", { leftoverDiag: ["(apply (compose double f2 inc) 5)"] }],
	["R105 で通る go [] inc 5（同じ位置に書いた `_` と同じ。前は G15）", r94("go [] inc 5"), "(apply (compose go inc) (construct 5 _))", "未知"],
	["R105 で通る Q75 (g) mx _ [] inc（`[]` は a の値の口で `_` と同じく消える。前は G5）", r94("mx _ [] inc"), "(unit (compose mx inc))", "A", { leftoverDiag: ["(compose mx inc)"] }],
	// 片イ（R125）で G16 は廃止。R95 の帰結の本体の根に残る点なしの関数は `_` と bare-function-return、恒等射は知らせない（前は G16）。
	// `[~t]` だけの括りは空でも本体を読む（R122）。
	["R95 k3 : [~t] ? [* 2,] t~ ⏎ k3 []（前は G16、片5 は A）", r94(["k3 : [~t] ? [* 2,] t~", "k3 []"]), "(apply k3 [])", "A", { severities: ["information/bare-function-return"] }],
	["R95 k5 : [~t] ? i t~ ⏎ k5 []（恒等射は知らせない）（前は G16、片5 は未知）", r94(["k5 : [~t] ? i t~", "k5 []"]), "(apply k5 [])", "A", { diagCount: 0 }],
	["R95 k6 : [~t] ? [inc,] t~ ⏎ k6 []（前は G16、片5 は A）", r94(["k6 : [~t] ? [inc,] t~", "k6 []"]), "(apply k6 [])", "A", { severities: ["information/bare-function-return"] }],
	// 問い2 の記録：書いた時点で長さ 0 と分かる List を畳む形も、片イ（R125）から `_` と bare-function-return（R125 の文面の `fold $add []`。前は G16）。
	["問い2 fold $add []（R84・R125）（前は G16）", r94("fold $add []"), "(apply fold (construct $add []))", "A", { severities: ["information/bare-function-return"] }],
	["問い2 fold $add e0（`e0 : []` の名前も長さ 0 と分かる）（前は G16）", r94("fold $add e0"), "(apply fold (construct $add e0))", "A", { severities: ["information/bare-function-return"] }],
	["問い2 g3 : [~xs] ? fold $add xs ⏎ g3 []（書いた `[]` を残りだけの括りで受けて渡しても）（前は G16）", r94(["g3 : [~xs] ? fold $add xs", "g3 []"]), "(apply g3 [])", "A", { severities: ["information/bare-function-return"] }],
];
const r94Refused = [
	// R94：書いた `_` と同じ門
	// 2026-10-28 の R105 で、ここにあった3行（G5 の2行・G15 の1行）は、同じ位置に書いた `_` と同じく消えて通る側へ移した（関数を挟んだ2行は上の r94Passes の終わり、
	// `[<<] [] 2` はいちばん後ろの「R105〜R110」の節）。
	// R95 の帰結：本体の根に点なしの関数が残る（R33 の G16。片5 は A か未知）。この3行は、片イ（R125）で上の r94Passes の終わりへ移した。
	// R95：綴りで並びの形を見る門も、長さ 0 の流れを書いた `_` に数える
	["R95 !_ []~ == 1 は `!_ _ == 1` と同じ G7（片5 は `(== (unit !_) 1)`）", r94("!_ []~ == 1"), "G7"],
	// `(!_ []~) 7`・`[!_ []~]`（`(!_ _) 7` と同じ G7、§5 Q74 (c)）は、2026-10-28 の R108（§5 Q74 (c) を閉じた：書いた項どおり恒等射）で、`(!_ _) 7` と同じく通る側
	// （いちばん後ろの「R105〜R110」の節）へ移した（片5 の恒等射の括りの答えに戻った）。
	// 問い2 の記録：書いた時点で長さ 0 と分かる List を畳む形。この3行（G16）は、片イ（R125）で上の r94Passes の終わりへ移した。
	// 片6 の確かめの直し：R34 が読まない並び（余りに穴）でも、前から n 個の値の口の `[]` は先に読み直す（直しの前は G13 で、`gq _ 1 !_` の G15 と門が割れた）。
	// 2026-10-28 の R105 で `gq _ 1 !_` は `gq 1 !_`（R16 の穴）で通るので、`gq [] 1 !_`（G15）も同じく通る側（いちばん後ろの「R105〜R110」の節）へ移した。
	// 今のまま（§5 Q75 (g)）：`_` の後ろの `[]` が、`_` を穴と読むと値の口でない所に着く（器の読みも成り立つ）か、数えられない所。器の葉で、`_` の門が名指しする。
	// 2026-10-28 の R105 で、値の口の `_` はいつも消えて口を使わないので、`_` の読みで `[]` の着く口が変わる所は無くなった（§5 Q75 (g) を閉じた）。ここにあった5行
	// （G5・G13）は、`[]` が着いた口で読まれる答えで通る側へ移した（括りの関数の裸の口の1行は上の r94Passes の終わり、ほかの4行はいちばん後ろの「R105〜R110」の節）：
	// `pq _ []` は `pq []`（`[]` は括りの口 [a] で器）、`(f3 !_ 2) _ []` は `(f3 !_ 2)`（`[]` は穴の口で `_`）、`(add 3) _ [] []` は `(add 3)`、`inc _ _ []` は inc。
];
for (const [name, s, want, kind, extra] of r94Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r94Refused) checkRefused(name, s, want, inst);
// 2026-10-28 の R105 で、書いた `[]` を `_` と読んで G15 に当たる形（既定値のある関数の前の見本）と、`_` の後ろの `[]` を器のまま数えた G5・書いた `_` だけの G5
// （括りの関数の裸の口の前の見本）は通る形になったので、その3行は外した。綴りの門の言い分は、R108 で `(!_ …)` が通るので、今のまま G7 の `(-_ …)` で見る（前の見本は `(!_ []~) 7`・`(!_ _) 7`）。
// 位置の数えられない既定値のある関数の G15 は、後ろの書いた `[]` を器のまま数えたことを添える（emptyAheadNote）。
const r94Messages = [
	["R95 綴りの門の言い分は長さ 0 の流れを名指しする（(-_ []~) 7。前の見本は (!_ []~) 7。2026-10-28 の確かめの直しで、指す問いは §5 Q81、前は Q74）", r94("(-_ []~) 7"), "G7", ["長さ 0 の流れも同じ、§4 R84・R95", "§5 Q81"], ["§5 Q74"]],
	["R95 書いた `_` だけの綴りの門の言い分は流れを名指ししない（(-_ _) 7。前の見本は (!_ _) 7。指す問いは §5 Q81、前は Q74）", r94("(-_ _) 7"), "G7", ["§5 Q81"], ["長さ 0 の流れ", "§5 Q74"]],
	// 片イ（R126）で G15 は廃止したので、G15 の言い分の行（gz _ []）は外した。
];
for (const [name, s, gateId, must, mustNot] of r94Messages) {
	total++;
	let text;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
		continue;
	} catch (e) {
		if (e.gate !== gateId) {
			fail(`言い分 ${name}`, `gate: ${e.gate}`, String(e.message));
			continue;
		}
		text = String(e.message);
	}
	const missing = must.filter((w) => !text.includes(w));
	const extra = mustNot.filter((w) => text.includes(w));
	if (!missing.length && !extra.length) ok(`言い分 ${name}`);
	else fail(`言い分 ${name}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, text);
}

// ---------------------------------------------------------------------------
// R96〜R98（2026-10-27 の片7。算術の中の `0x…` は差・幅の倍数でない差は断る・差 / 数は数）
// ---------------------------------------------------------------------------
// R96（§5 Q66 の算術の所の答え）：主の Claude の問い「算術の中の `0x…` は差と読める所ではいつも差、点としか読めない所は断る、でいい？」に U〔答え〕[2026-10-27 09:53
// 58a809c9]「それでいい。算術の中の `0x…` は差と読める所ではいつも差（ずらし量で、生の番地じゃないのでどの層でも書ける）、点としか読めない所は断る。`0x… − 差` も差で
// 通して。片 6 の次に入れて。」（ボタンの文で、文は主の Claude の物）。判断の基準は U〔答え〕[2026-10-27 09:25 df447414]「3. その加法に保証が出来るかが鍵」。
// R97：主の Claude の文「幅の倍数でない差（`$vs + 0x3` が今は通る）」に U〔答え〕[2026-10-27 12:46 58a809c9]「これが通るのはダメだと思う。」。数の要素の幅を Int の語の
// 8 byte と置くこと・字面の最大公約数で見ること（値は倍数で字面のどれかが倍数でない所は §5 Q77 の言い分）は R（§5 Q77）。
// 同じ日の確かめの直し（行の注に「確かめ」と書いた）：`0x…` どうしの和は差の印を持たず、字面と同じく点か差の隣で書いた綴りから字面の和として読む（R96。和を仮引数・器・欄に
// 渡すと顔が分からないので、幅の倍数の門を素通りしない。比べ・数と混ぜる所・関数の口・`@`・`#` では `0x18` と同じ今までの答え）。点の幅は、点の顔と同じく仮引数・揃った器の
// 要素・欄に運び、実体の鍵に入れる（R97）。割る数が Int と書いた所から分からない `差 / 数`（小数・文字・`0u`・`0r`・`0b`）は今までどおり断る（R98、§5 Q76）。Int と書いた所
// から分かる値に、`-(5)`・`!!5`・`5!`・`|-5|`・`1 << 3`・`~5` を足した（R97）。値を読む参照の印は、消えた余りのラムダの残り1項（`($vs !_)`）からも持ち越す（HEAD からの穴）。
// R98（§5 Q67 の答え）：主の Claude の文「Q67：番地の差を幅で割って数にする道。層0だけで許すのかどうか。」に同じ時刻の U〔答え〕「レイヤに依らず許せると思ってるけど…」。
// 綴りを `差 / 数` にするのは R（前の主の Claude の傾きは `差 ÷ 差`、§5 Q76）。
// 上の節で答えの変わった行（`$vs + 8x00FF`・`($vs - $five) / 8`・`$vs + (0x10 + 0x8)`・`0x10 - ($vs - $five)`）は、行の注に前の答えと理由を書いて直した。
const R96 = ["five : 5", "v : 5", "st : `abc`", "ch : \\a", "nx : 0x10", "n3 : 0x3", "w8 : 0x10 + 0x8", "w4 : 0x4 + 0x4", "gi : y ? y", "hb : [k] f ? (f + 0x3) == $vs", "pr : [a b] ? (a + 0x3) == $vs"];
const r96 = (lines) => std([...R96, ...[].concat(lines)]);
const r96Passes = [
	// R96：`0x…` は差と読める所ではいつも差
	// 確かめ：`0x…` どうしの和は字面の和で、和そのものは字面と同じ中身の見えない A（点か差の隣で差と読む）。最初の版は和に差の印を付けた。
	["R96 0x10 + 0x8 は字面の和（点か差の隣で差と読む。木と種類は前と同じ）", r96("0x10 + 0x8"), "(+ 0x10 0x8)", "A"],
	["R96 $vs + (0x10 + 0x8) は点 + 差で点（前は顔の分からない値で G21、§5 Q66）", r96("$vs + (0x10 + 0x8)"), "(+ $vs [0x10 + 0x8])", "A"],
	["R96 $vs - (0x10 - 0x8)（前は G21）", r96("$vs - (0x10 - 0x8)"), "(- $vs [0x10 - 0x8])", "A"],
	["R96 (0x10 + 0x8) + $vs は差 + 点で点（R92 の行。前は G21）", r96("(0x10 + 0x8) + $vs"), "(+ [0x10 + 0x8] $vs)", "A"],
	["R96 0x10 - ($vs - $five) は `0x… − 差` で差（前は G21）", r96("0x10 - ($vs - $five)"), "(- 0x10 [$vs - $five])", "A"],
	["R96 0x18 - (0x10 - 0x8)", r96("0x18 - (0x10 - 0x8)"), "(- 0x18 [0x10 - 0x8])", "A"],
	["R96 w8 : 0x10 + 0x8 ⏎ $vs + w8（名前で包んだ和。前は G21）", r96("$vs + w8"), "(+ $vs w8)", "A"],
	["R96 顔 ($vs + (0x10 + 0x8)) - $vs は点 − 点で差", r96("($vs + (0x10 + 0x8)) - $vs"), "(- [$vs + [0x10 + 0x8]] $vs)", "A"],
	["R96 顔 (0x10 - ($vs - $five)) == ($vs - $five) は差どうしの比べ", r96("(0x10 - ($vs - $five)) == ($vs - $five)"), "(== [0x10 - [$vs - $five]] [$vs - $five])", "A"],
	["R96 今のまま (0x10 + 0x8) == (0x8 + 0x10)（比べの相手の字面の和は見ない。確かめ：最初の版は差どうしの比べ）", r96("(0x10 + 0x8) == (0x8 + 0x10)"), "(== [0x10 + 0x8] [0x8 + 0x10])", "A"],
	["R96 今のまま 0x10 + 1（点も差も無い `0x…` と数、§5 Q66 の残り）", r96("0x10 + 1"), "(+ 0x10 1)", "A"],
	["R96 今のまま 0x10 == 0x10（`0x…` の比べ、§5 Q66 の残り）", r96("0x10 == 0x10"), "(== 0x10 0x10)", "A"],
	["R96 今のまま 5 * 0x10", r96("5 * 0x10"), "(* 5 0x10)", "A"],
	// 確かめ：`0x…` どうしの和は字面と同じ今までの答え（最初の版は差の印の帰結で G21。`0x18 + 1`・`inc 0x18` などと割れた）。
	["R96 今のまま (0x10 + 0x8) + 1（`0x18 + 1` と同じ。最初の版は G21）", r96("(0x10 + 0x8) + 1"), "(+ [0x10 + 0x8] 1)", "A"],
	["R96 今のまま (0x10 + 0x8) == 0x18（最初の版は G21）", r96("(0x10 + 0x8) == 0x18"), "(== [0x10 + 0x8] 0x18)", "A"],
	["R96 今のまま (0x10 + 0x8) + _（最初の版は G21）", r96("(0x10 + 0x8) + _"), "(+ [0x10 + 0x8] _)", "A"],
	["R96 今のまま inc (0x10 + 0x8)（`inc 0x18` と同じ。最初の版は G21）", r96("inc (0x10 + 0x8)"), "(apply inc [0x10 + 0x8])", "A"],
	["R96 今のまま gi (0x10 + 0x8)（最初の版は G21）", r96("gi (0x10 + 0x8)"), "(apply gi [0x10 + 0x8])", "A"],
	["R96 今のまま [(0x10 + 0x8) 5]（最初の版は G21）", r96("[(0x10 + 0x8) 5]"), "[[0x10 + 0x8] 5]", "A"],
	["R96 今のまま fb : y ? 0x10 + 0x8 ⏎ fb 1（関数が返す字面の和。最初の版は G21）", r96(["fb : y ? 0x10 + 0x8", "fb 1"]), "(apply fb 1)", "A"],
	["R96 今のまま (0x40000000 + 0x100) # 5（`0x40000100 # 5` と同じ。最初の版は G21）", r96("(0x40000000 + 0x100) # 5"), "(# [0x40000000 + 0x100] 5)", "A"],
	["R96 今のまま @(0x40000000 + 0x100)（印の無い前置 `@`。最初の版は G21）", r96("@(0x40000000 + 0x100)"), "@[0x40000000 + 0x100]", "未知"],
	["R96 今のまま (0x10 + 0x8) / 0x8（点も差も無い。最初の版は差 / 差で G21）", r96("(0x10 + 0x8) / 0x8"), "(/ [0x10 + 0x8] 0x8)", "A"],
	["R96 確かめ $vs + (nx + 0x8)（字面の名前と字面の和）", r96("$vs + (nx + 0x8)"), "(+ $vs [nx + 0x8])", "A"],
	// 「R96 確かめ tt : y ? ⏎ n5 : 0x10 + 0x8 ⏎ ($vs + n5) == $vs（局所の名前の和）」は、2026-11-04 の寄せ1（R128）で `⇥n5 : 0x10 + 0x8` が枝になり n5 が未定義の名前に
	// なったので、ファイルの `($vs + zz) == $vs` と同じ G21（下の r96Refused へ移した）。
	// R97：幅の倍数の差・幅を見ない所
	["R97 $vs + 0x8（幅の倍数）", r96("$vs + 0x8"), "(+ $vs 0x8)", "A"],
	["R97 $v + 0x8（1つの要素の領域の外は値の段。倍数なので断らない）", r96("$v + 0x8"), "(+ $v 0x8)", "A"],
	["R97 $vs + 8x00F8", r96("$vs + 8x00F8"), "(+ $vs 8x00F8)", "A"],
	["R97 $vs + 0x0", r96("$vs + 0x0"), "(+ $vs 0x0)", "A"],
	["R97 ($vs + 0x8) + 0x10（幅の倍数でずらした点も幅を持つ）", r96("($vs + 0x8) + 0x10"), "(+ [$vs + 0x8] 0x10)", "A"],
	["R97 $st + 0x3（文字列は幅を見ない）", r96("$st + 0x3"), "(+ $st 0x3)", "A"],
	["R97 $ch + 0x3（文字は幅を見ない）", r96("$ch + 0x3"), "(+ $ch 0x3)", "A"],
	["R97 v4 : [1 2] , [3 4] ⏎ $v4 + 0x3（要素が List の器は幅を見ない）", r96(["v4 : [1 2] , [3 4]", "$v4 + 0x3"]), "(+ $v4 0x3)", "A"],
	["R97 f15 : 1.5 ⏎ $f15 + 0x3（小数は幅を見ない、§5 Q77）", r96(["f15 : 1.5", "$f15 + 0x3"]), "(+ $f15 0x3)", "A"],
	["R97 $0u41 + 0x3（文字コードは幅を見ない）", r96("$0u41 + 0x3"), "(+ $0u41 0x3)", "A"],
	["R97 r3 : 0r3 ⏎ $r3 + 0x3（`0r` は幅を見ない、§5 Q77）", r96(["r3 : 0r3", "$r3 + 0x3"]), "(+ $r3 0x3)", "A"],
	["R97 ($vs + ($vs - $five)) + 0x3（値の決まらない差でずらした点は幅を見ない）", r96("($vs + ($vs - $five)) + 0x3"), "(+ [$vs + [$vs - $five]] 0x3)", "A"],
	["R97 $vs + (($vs - $five) + 0x3)（値の決まらない差は断らない、§5 Q77）", r96("$vs + (($vs - $five) + 0x3)"), "(+ $vs [[$vs - $five] + 0x3])", "A"],
	// 確かめ：仮引数と器は点の幅を運ぶ（下の断る側）。幅を見ない点を渡せば通る。最初の版はどれも幅を運ばず、`hb [1] $vs` も通った。
	["R97 hb [1] $st（文字列を指す点を仮引数で受けた）", r96("hb [1] $st"), "(apply hb (construct [1] $st))", "A"],
	["R97 pr [$st $st]", r96("pr [$st $st]"), "(apply pr [$st $st])", "A"],
	["R97 ([($vs + 0x8) ($vs + ($five - $vs))] ' 0) + 0x3（幅の違う点の器は幅を外して揃える）", r96("([($vs + 0x8) ($vs + ($five - $vs))] ' 0) + 0x3"), "(+ [[[$vs + 0x8] [$vs + [$five - $vs]]] ' 0] 0x3)", "A"],
	["R97 dd : 0x10 / 2 ⏎ $dd + 0x3（差 / 数の答えは Int に数えない、§5 Q77）", r96(["dd : 0x10 / 2", "$dd + 0x3"]), "(+ $dd 0x3)", "A"],
	["R97 v : ||5|| ⏎ $v + 0x3（ノルムは Int に数えない、§5 Q77）", r96(["vn : ||5||", "$vn + 0x3"]), "(+ $vn 0x3)", "A"],
	["R97 v : -(1.5) ⏎ $v + 0x3（Int でない物に値の印を当てても Int でない）", r96(["vf : -(1.5)", "$vf + 0x3"]), "(+ $vf 0x3)", "A"],
	["R97 v : !5 ⏎ $v + 0x3（前置 `!` は否定で数の演算でない）", r96(["vb : !5", "$vb + 0x3"]), "(+ $vb 0x3)", "A"],
	// 確かめ：値を読む参照の印は、消えた余りのラムダの残り1項からも持ち越す（`$vs == $vs` と同じ点どうしの比べ。HEAD は顔の分からない値で G21）。
	["R62 確かめ ($vs !_) == $vs（`$vs !_` は単位律で `$vs`）", r96("($vs !_) == $vs"), "(== [$vs !_] $vs)", "A"],
	// R98：差 / 数 は数
	["R98 ($vs - $five) / 8 は数（前は G21、§5 Q67）", r96("($vs - $five) / 8"), "(/ [$vs - $five] 8)", "A"],
	["R98 0x10 / 2 は数（`0x…` は差と読める所）", r96("0x10 / 2"), "(/ 0x10 2)", "A"],
	["R98 顔 (($vs - $five) / 8) + 1 は数どうし（前は G21）", r96("(($vs - $five) / 8) + 1"), "(+ [[$vs - $five] / 8] 1)", "A"],
	["R98 (0x10 + 0x8) / 8", r96("(0x10 + 0x8) / 8"), "(/ [0x10 + 0x8] 8)", "A"],
	["R98 ($vs - $five) / 0（0 で割る所は数の割り算と同じ。木の段では数）", r96("($vs - $five) / 0"), "(/ [$vs - $five] 0)", "A"],
	["R98 今のまま 0x10 / 0x8（点も差も無い。差 / 差は §5 Q76）", r96("0x10 / 0x8"), "(/ 0x10 0x8)", "A"],
	["R98 今のまま 0x10 % 2", r96("0x10 % 2"), "(% 0x10 2)", "A"],
	// 確かめ：割る数は Int と書いた所から分かる物（名前・数の演算・前置 `-`）。
	["R98 ($vs - $five) / five（Int を右辺に持つ名前）", r96("($vs - $five) / five"), "(/ [$vs - $five] five)", "A"],
	["R98 ($vs - $five) / (2 + 2)", r96("($vs - $five) / (2 + 2)"), "(/ [$vs - $five] [2 + 2])", "A"],
	["R98 ($vs - $five) / -8", r96("($vs - $five) / -8"), "(/ [$vs - $five] -8)", "A"],
	["R98 今のまま 0x10 / 1.5（点も差も無い組。数にはしない、§5 Q76。最初の版は数）", r96("0x10 / 1.5"), "(/ 0x10 1.5)", "A"],
];
const r96Refused = [
	// 寄せ1（R128）から本体の `⇥n5 : 0x10 + 0x8` は枝で、n5 は未定義の名前（右は点か差か数か分からない値）。前は R80 の局所の名前の和で通った。
	["寄せ1 tt : y ? ⏎ n5 : 0x10 + 0x8 ⏎ ($vs + n5) == $vs（n5 は未定義の名前で G21。前は局所の名前の和で通った）", r96(["tt : y ?", "\tn5 : 0x10 + 0x8", "\t($vs + n5) == $vs"]), "G21"],
	// R96：点としか読めない所
	["R96 0x1000 - $vs は点としか読めない（前も G21、言い分が変わった）", r96("0x1000 - $vs"), "G21"],
	["R96 (0x10 + 0x8) - $vs（字面の和 − 点も点としか読めない。確かめ：最初の版は差 − 点の §5 Q66）", r96("(0x10 + 0x8) - $vs"), "G21"],
	// 確かめ：`0x…` を含む比べは今まで（比べの相手の字面の和は見ない。最初の版は差どうしの比べで通した）。
	["R96 今のまま (0x10 + 0x8) == ($vs - $five)（`0x18 == ($vs - $five)` と同じ G21）", r96("(0x10 + 0x8) == ($vs - $five)"), "G21"],
	["R96 今のまま ($vs - $five) < (0x10 - 0x8)", r96("($vs - $five) < (0x10 - 0x8)"), "G21"],
	["R96 今のまま w8 == ($vs - $five)（名前で包んだ和）", r96("w8 == ($vs - $five)"), "G21"],
	["R96 今のまま (0x10 + 0x8) == $vs（HEAD も G21。`0x18 == $vs` は A、§5 Q66 の残り）", r96("(0x10 + 0x8) == $vs"), "G21"],
	// 確かめ：字面の和を仮引数・器・欄に渡すと、字面と同じく顔が分からない（最初の版は差の印だけ運んで値を落とし、幅の門を素通りした）。
	["R96 hd [1] (0x3 + 0x0)（`hd [1] 0x3` と同じ。hd は `[k] e ? ($vs + e) == $vs`）", r96(["hd : [k] e ? ($vs + e) == $vs", "hd [1] (0x3 + 0x0)"]), "G21", [["hd", "N A"]]],
	["R96 hd [1] (0x10 + 0x8)（`hd [1] 0x18` と同じ）", r96(["hd : [k] e ? ($vs + e) == $vs", "hd [1] (0x10 + 0x8)"]), "G21", [["hd", "N A"]]],
	["R96 lst : (0x3 + 0x0) , (0x3 + 0x0) ⏎ ($vs + (lst ' 0)) == $vs", r96(["lst : (0x3 + 0x0) , (0x3 + 0x0)", "($vs + (lst ' 0)) == $vs"]), "G21"],
	["R96 ms : [a : 0x3 + 0x0] ⏎ ($vs + (ms ' a)) == $vs", r96(["ms : [a : 0x3 + 0x0]", "($vs + (ms ' a)) == $vs"]), "G21"],
	// R97：幅の倍数でない差
	["R97 $vs + 0x3（前は点で通った）", r96("$vs + 0x3"), "G21"],
	["R97 $five + 0x1", r96("$five + 0x1"), "G21"],
	["R97 $5 + 0x3（字面の参照）", r96("$5 + 0x3"), "G21"],
	["R97 $[1 2] + 0x3（Int を並べた括り）", r96("$[1 2] + 0x3"), "G21"],
	// 書いた `$(1 , 2) + 0x3`（G21）は、2026-10-27 の片8 の R101 で `$(1 , 2)` が先に G20（書いた `,` の積の `$`）。名前を通した積で、幅の門を見る。
	["R97 w2 : 1 , 2 ⏎ $w2 + 0x3（積。書いた `$(1 , 2)` は片8 の R101 で G20）", r96(["w2 : 1 , 2", "$w2 + 0x3"]), "G21"],
	["R97 v2 : 2 + 3 ⏎ $v2 + 0x3（数の演算の答え）", r96(["v2 : 2 + 3", "$v2 + 0x3"]), "G21"],
	["R97 v3 : -1 ⏎ $v3 + 0x3", r96(["v3 : -1", "$v3 + 0x3"]), "G21"],
	["R97 $vs - 0x3", r96("$vs - 0x3"), "G21"],
	["R97 $vs + 8x00FF（前は R62 の例で通った）", r96("$vs + 8x00FF"), "G21"],
	["R97 $vs + n3（字面を右辺に持つ名前）", r96("$vs + n3"), "G21"],
	["R97 $vs + (0x3)（括った字面）", r96("$vs + (0x3)"), "G21"],
	["R97 p : $vs ⏎ p + 0x3（点を指す名前）", r96(["p : $vs", "p + 0x3"]), "G21"],
	["R97 q : $vs + 0x8 ⏎ q + 0x3（幅の倍数でずらした点を指す名前）", r96(["q : $vs + 0x8", "q + 0x3"]), "G21"],
	["R97 0x3 + $vs（`0x…` + 点）", r96("0x3 + $vs"), "G21"],
	["R97 (0x3 + 0x5) + $vs（値 0x8 でも、字面の最大公約数は 0x1。前は G21、§5 Q66）", r96("(0x3 + 0x5) + $vs"), "G21"],
	["R97 $vs + (0x4 + 0x4)（値 0x8 でも、字面 0x4 が倍数でない）", r96("$vs + (0x4 + 0x4)"), "G21"],
	["R97 $vs + w4（同じ和を名前で）", r96("$vs + w4"), "G21"],
	["R97 ($vs + 0x4) + 0x4（畳み込みの順に依らず断る。前は通った）", r96("($vs + 0x4) + 0x4"), "G21"],
	["R97 ($vs + 0x3) + ($vs - $five)（§5 Q77 の順の割れの片側。`$vs + (0x3 + ($vs - $five))` は通る）", r96("($vs + 0x3) + ($vs - $five)"), "G21"],
	["R97 tt : y ? ⏎ lp : $vs ⏎ (lp + 0x3) == $vs（局所の名前の点）", r96(["tt : y ?", "\tlp : $vs", "\t(lp + 0x3) == $vs"]), "G21"],
	["R97 tt : y ? ⏎ n5 : 0x3 ⏎ ($vs + n5) == $vs（局所の名前の字面）", r96(["tt : y ?", "\tn5 : 0x3", "\t($vs + n5) == $vs"]), "G21"],
	["R97 $vs + (0x13 - 0x13)（値 0x0 でも字面 0x13 が倍数でない、§5 Q77）", r96("$vs + (0x13 - 0x13)"), "G21"],
	["R97 $vs + (nx + 0x3)（字面の名前と字面の和、値 0x13）", r96("$vs + (nx + 0x3)"), "G21"],
	// 確かめ：点の幅は、点の顔と同じく仮引数・揃った器の要素・欄に運び、実体の鍵に入れる（最初の版は運ばず、β で割れた）。
	["R97 hb [1] $vs（括りの関数の実体の裸の仮引数。最初の版は通った）", r96("hb [1] $vs"), "G21", [["hb", "N $[N…]"]]],
	["R97 hb [1] $st ⏎ hb [1] $vs（幅は実体の鍵に入る：先の $st の実体を分け合わない）", r96(["hb [1] $st", "hb [1] $vs"]), "G21", [["hb", "N $[N…]"]]],
	["R97 pr [$vs $vs]（括りの仮引数で受けた要素。最初の版は通った）", r96("pr [$vs $vs]"), "G21", [["pr", "[$[N…]…]"]]],
	["R97 ([$vs $vs] ' 0) + 0x3（揃った器の要素。最初の版は通った）", r96("([$vs $vs] ' 0) + 0x3"), "G21"],
	["R97 cc : [$vs $vs] ⏎ ((cc ' 0) + 0x3) == $vs", r96(["cc : [$vs $vs]", "((cc ' 0) + 0x3) == $vs"]), "G21"],
	["R97 mf : [a : $vs] ⏎ ((mf ' a) + 0x3) == $vs（欄）", r96(["mf : [a : $vs]", "((mf ' a) + 0x3) == $vs"]), "G21"],
	["R97 ([($vs + 0x8) ($vs + 0x8)] ' 0) + 0x3（幅の倍数でずらした点の器）", r96("([($vs + 0x8) ($vs + 0x8)] ' 0) + 0x3"), "G21"],
	// 確かめ：Int と書いた所から分かる値を足した（前置 `-` は名前の外にも、`!!`・`!`・`|x|`・ビット・`~x`）。最初の版はどれも通った。
	["R97 v6 : -(5) ⏎ $v6 + 0x3", r96(["v6 : -(5)", "$v6 + 0x3"]), "G21"],
	["R97 v6 : -(five) ⏎ $v6 + 0x3", r96(["v6 : -(five)", "$v6 + 0x3"]), "G21"],
	["R97 v6 : -(2 + 3) ⏎ $v6 + 0x3", r96(["v6 : -(2 + 3)", "$v6 + 0x3"]), "G21"],
	["R97 $-(5) + 0x3", r96("$-(5) + 0x3"), "G21"],
	["R97 v6 : !!5 ⏎ $v6 + 0x3", r96(["v6 : !!5", "$v6 + 0x3"]), "G21"],
	["R97 v6 : 5! ⏎ $v6 + 0x3", r96(["v6 : 5!", "$v6 + 0x3"]), "G21"],
	["R97 v6 : |-5| ⏎ $v6 + 0x3", r96(["v6 : |-5|", "$v6 + 0x3"]), "G21"],
	["R97 v6 : 1 << 3 ⏎ $v6 + 0x3", r96(["v6 : 1 << 3", "$v6 + 0x3"]), "G21"],
	["R97 v6 : 1 && 3 ⏎ $v6 + 0x3", r96(["v6 : 1 && 3", "$v6 + 0x3"]), "G21"],
	["R97 $~5 + 0x3（`~5` は `[5]`、R79）", r96("$~5 + 0x3"), "G21"],
	["R97 v6 : ~5 ⏎ $v6 + 0x3", r96(["v6 : ~5", "$v6 + 0x3"]), "G21"],
	// 確かめ：値を読む参照の印は、消えた余りのラムダの残り1項からも持ち越す（HEAD から黙って通っていた）。
	["R62 確かめ ($vs !_) + 1（`$vs + 1` と同じ）", r96("($vs !_) + 1"), "G21"],
	["R62 確かめ ($vs !_) == 5", r96("($vs !_) == 5"), "G21"],
	["R62 確かめ w : $vs !_ ⏎ w + 1", r96(["w : $vs !_", "w + 1"]), "G21"],
	["R97 確かめ ($vs !_) + 0x3（`$vs + 0x3` と同じ）", r96("($vs !_) + 0x3"), "G21"],
	// R98 の残り（§5 Q76）と、答えの顔
	["R98 ($vs - $five) * 2（差と数を掛ける形、§5 Q76）", r96("($vs - $five) * 2"), "G21"],
	["R98 2 * ($vs - $five)", r96("2 * ($vs - $five)"), "G21"],
	["R98 8 / ($vs - $five)（数 / 差）", r96("8 / ($vs - $five)"), "G21"],
	["R98 ($vs - $five) / ($vs - $five)（差 / 差）", r96("($vs - $five) / ($vs - $five)"), "G21"],
	["R98 $vs / 8（点は割れない）", r96("$vs / 8"), "G21"],
	["R98 顔 (($vs - $five) / 8) + $vs は数と点", r96("(($vs - $five) / 8) + $vs"), "G21"],
	// 確かめ：割る数が Int と書いた所から分からない 差 / 数 は、今までどおり断る（§5 Q76。最初の版は数の desc で見て、小数・文字でも数にした）。
	["R98 ($vs - $five) / 1.5（小数）", r96("($vs - $five) / 1.5"), "G21"],
	["R98 ($vs - $five) / \\a（文字）", r96("($vs - $five) / \\a"), "G21"],
	["R98 ($vs - $five) / 0u41（文字コード）", r96("($vs - $five) / 0u41"), "G21"],
	["R98 ($vs - $five) / 0r3（UInt）", r96("($vs - $five) / 0r3"), "G21"],
	["R98 ($vs - $five) / 0b101", r96("($vs - $five) / 0b101"), "G21"],
	["R98 (($vs - $five) / 1.5) + 1", r96("(($vs - $five) / 1.5) + 1"), "G21"],
];
for (const [name, s, want, kind, extra] of r96Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r96Refused) checkRefused(name, s, want, inst);
const r96Messages = [
	["R97 幅と差の値を書く", r96("$vs + 0x3"), "G21", ["8 byte", "`0x3`（値 0x3）", "§4 R97", "これが通るのはダメだと思う。"], ["最大公約数"]],
	// 確かめ：値は幅の倍数で字面のどれかが倍数でない和は、決まっていない所（§5 Q77）として断り、利用者の答えを根拠に引かない（最初の版は R97 の言い分で
	// 「幅の倍数でない差」「要素の途中を指す点」と言い、12:46 の答えを引いていた）。
	["R97 値は倍数の和は §5 Q77", r96("$vs + (0x4 + 0x4)"), "G21", ["値 0x8 は幅の倍数", "最大公約数は 0x4", "§5 Q77"], ["これが通るのはダメだと思う。", "要素の途中", "幅の倍数でない差"]],
	["R97 値 0x0 の和も §5 Q77", r96("$vs + (0x13 - 0x13)"), "G21", ["値 0x0 は幅の倍数", "最大公約数は 0x13", "§5 Q77"], ["これが通るのはダメだと思う。"]],
	["R97 値が倍数でない和は R97", r96("$vs + (0x4 + 0x7)"), "G21", ["幅の倍数でない差", "値 0xB", "§4 R97", "これが通るのはダメだと思う。"], ["§5 Q77"]],
	["R97 仮引数で受けた点（確かめ）", r96("hb [1] $vs"), "G21", ["形 N $[N…]", "8 byte", "§4 R97"], []],
	["R96 `0x…` − 点は保証の言い分", r96("0x1000 - $vs"), "G21", ["差（ずらし量）", "層0", "§4 R96"], ["§5 Q66"]],
	["R96 字面の和 − 点も同じ言い分（確かめ）", r96("(0x10 + 0x8) - $vs"), "G21", ["差（ずらし量）", "層0", "§4 R96"], ["§5 Q66"]],
	["R98 差と数を掛ける形は §5 Q76", r96("($vs - $five) * 2"), "G21", ["差と数を掛ける形", "§5 Q76"], ["Q67"]],
	["R98 数 / 差は §5 Q76", r96("8 / ($vs - $five)"), "G21", ["数 / 差", "§5 Q76"], ["Q67"]],
	["R98 小数で割る 差 / 数 は §5 Q76（確かめ）", r96("($vs - $five) / 1.5"), "G21", ["割る数が Int と書いた所から分かる形", "§5 Q76"], ["Q67"]],
	["R98 `0x… / Int` の答えは数", r96("(0x10 / 2) + $vs"), "G21", ["Address と Int は混ぜません", "左は数"], []],
	["R98 `0x… / 小数` は数にしない（確かめ）", r96("(0x10 / 1.5) + $vs"), "G21", ["左は点か差か数か分からない値", "§5 Q66"], ["左は数"]],
];
for (const [name, s, gateId, must, mustNot] of r96Messages) {
	total++;
	let text;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
		continue;
	} catch (e) {
		if (e.gate !== gateId) {
			fail(`言い分 ${name}`, `gate: ${e.gate}`, String(e.message));
			continue;
		}
		text = String(e.message);
	}
	const missing = must.filter((w) => !text.includes(w));
	const extra = mustNot.filter((w) => text.includes(w));
	if (!missing.length && !extra.length) ok(`言い分 ${name}`);
	else fail(`言い分 ${name}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, text);
}

// ---------------------------------------------------------------------------
// R99〜R104（2026-10-27 の片8。`$` は必ず持ち上げ・関数以外は警告・書いた `,` の積は断る・`$x ' 0` は x・下ろす所を通る輪だけ断る・`$[]~` は `$_`）
// ---------------------------------------------------------------------------
// 出どころ（sid 58a809c9。U の時刻は UTC）：U [2026-10-27 10:11]「$が関数以外のものを運んでいたら警告クラスだｗ」「…$は必ず持ち上げだと読んでごらん。 / 筋が通る」、
// U [10:24]「この段階で,がついてるので無し。 / [$v , 1] なら、その意味になりそうだと理解できる」（主の Claude の 10:17 の行「`f : x ? x , $[v , 1]`：通して、中身が値なので
// 警告する。」（太字の印は除いた）の `$[v , 1]` を引いて）、U [10:51]「heavyは関数
// じゃない / 非同期なら / @heavy / だと思うけどね…」、主の Claude のまとめに U〔答え〕[10:56]「それでいい。async も例外なしで、`$` が関数以外を運んだら警告、書いた `,` の積の
// `$` は断って `[$v , 1]` を案内。`$v ' 0` は v、下ろす所を通る輪だけ断る。片 7 の次に片 8 として入れて。」（ボタンの文で、文は主の Claude の物）。
// R99：`$` は必ず持ち上げ。下ろすのは `@` と `' i`。先の種類では断らない（先の種類の分からない先は、印 lift の持ち上げで通る）。
// R100：関数以外を持ち上げたら warning の dollar-non-function（書いた `$` の項ごとに1回。async に例外は作らない。実体でしか種類の分からない所は実体で決める）。
// R101：単位律の後にも `,` の残る書いた積の `$` は G20。言い分で `[$v , 1]` を案内する。名前を通した積（`p : 5 , 99` ⏎ `$p`）は R100 の警告。
// R102：`$x ' 0` は x（関数なら関数、値なら値）。字面の `' k` の k が 0 でなければ `_`。
// R103：持ち上げだけを通る輪は値の輪ではないので通す（R73 を広げた）。定義の時に下ろす所（`@`・`' i`）を通る輪は name-cycle。
// R104：長さ 0 と分かる流れに後置 `~` を付けた `$[]~`・`$[[]~]` は `$_` と同じ零射の番地（§5 Q75 (d)）。
// 上の節で答えの変わった行は、行の注に前の答えと理由を書いて、通る側・断る側を変えた物はここへ移した（元の所に注を残した）。片9 で答えの変わる形（値の口の内側に
// 書いた `_`・未定義の名前・`x : _` の名前・欄の `[y : _]`）には寄りかからない（`hd2 [un 5]` の行は `un : _` に寄るので、移さずに外した。2026-10-28 の確かめの直しで、
// 欄の `[s : _]` に寄っていた `hz` の実体の行も、`[s : inc]` の実体に替えた）。
// 2026-10-28 の確かめの直し（行の名前に「確かめ」）：持ち上げを通る輪で、輪の定義から定義の時に下ろす所が見えれば name-cycle（関数の返値を通った持ち上げ・名前に
// 置いた持ち上げ。前は黙って通った）、輪の中の書いた積の判定を resolve と同じ読み（長さ 0 の流れの単位律・R66 の適用・G3）にした、輪の中の撒いた形は R57 の G20、
// 局所の定義の輪が持ち上げを通れば G20、実体で渡された `A(U)` は知らせない、`$[$[]~]` は `$[$_]` と同じ、R101 の案内の綴りがそれ自体断られない。
const R99D = ["five : 5", "g9 : r ? @r", "hb : [s] ? use $s 1", "hz : [s] ? $s", "hw : [s] ? s ' 0", "heavy : x ? x * 2", "i : !_", "e0 : []", "uu : x ? [,] x"];
const r99 = (lines) => std([...R99D, ...[].concat(lines)]);
const WARN = ["warning/dollar-non-function"];
const r99Passes = [
	// R99・R100：関数以外の持ち上げは通って警告（前は R60 で黙って通った。R53 の片では G20）
	["R100 $vs（値の持ち上げは警告）", r99("$vs"), "$vs", "A", { severities: WARN }],
	["R100 $5（字面）", r99("$5"), "$5", "A", { severities: WARN }],
	["R100 $[1 2]（値の器）", r99("$[1 2]"), "$[1 2]", "A", { severities: WARN }],
	["R100 $[inc 5]（足りた適用。まだ走っていない計算も関数ではない）", r99("$[inc 5]"), "$[inc 5]", "A", { severities: WARN }],
	["R100 $[heavy 5]（非同期の手形も例外なし）", r99("$[heavy 5]"), "$[heavy 5]", "A", { severities: WARN }],
	["R100 $$inc（関数の番地は値）", r99("$$inc"), "$$inc", "A", { severities: WARN }],
	["R100 $[_ , 5]（単位律で 5、値）", r99("$[_ , 5]"), "$[_ , 5]", "A", { severities: WARN }],
	["R100 t : y ? $y ⏎ t 1（素の関数の裸の仮引数は値）", r99(["t : y ? $y", "t 1"]), "(apply t 1)", "A", { severities: WARN }],
	["R100 hb [s : 5]（実体で値と分かる所は実体で決める）", r99("hb [s : 5]"), "(apply hb [s : 5])", "A", { severities: WARN }],
	["R100 hb [s : 5] ⏎ hb [s : 6]（書いた所ごとに1回）", r99(["hb [s : 5]", "hb [s : 6]"]), "(apply hb [s : 6])", "A", { severities: WARN }],
	["R100 $vs , $vs（書いた所が2つなら2回）", r99("$vs , $vs"), "(, $vs $vs)", "A", { severities: [...WARN, ...WARN] }],
	["R100 p : $vs ⏎ @p（下ろした所は警告しない。警告は `$vs` の所の1回）", r99(["p : $vs", "@p"]), "@p", "A", { severities: WARN }],
	// R100：関数の持ち上げは警告しない
	["R100 $inc", r99("$inc"), "$inc", "A", { diagCount: 0 }],
	["R100 $[add 1]（部分適用は関数）", r99("$[add 1]"), "$[add 1]", "A", { diagCount: 0 }],
	["R100 $_（零射は関数、R56）", r99("$_"), "$_", "A", { diagCount: 0 }],
	["R100 $!_（恒等射）", r99("$!_"), "$!_", "A", { diagCount: 0 }],
	["R100 $[inc , !_]（単位律で inc）", r99("$[inc , !_]"), "$[inc , !_]", "A", { diagCount: 0 }],
	["R100 $[inc , i]（名前で包んだ恒等射も単位）", r99("$[inc , i]"), "$[inc , i]", "A", { diagCount: 0 }],
	["R100 hb [s : inc]（実体で関数）", r99("hb [s : inc]"), "(apply hb [s : inc])", "A", { diagCount: 0 }],
	// R99：先の種類の分からない持ち上げ（印 lift）で通り、警告しない（前は G20。上の「`$` は関数だけ」「R58〜R61 の確かめ」の節から移した）
	["R99 io@ ⏎ $zz（取り込みのある範囲の名前。前は G20）", std(["io@", "$zz"]), "$zz", "A", { diagCount: 0 }],
	["R99 uu : x ? [,] x ⏎ $[uu 5]（根の未知な適用。前は G20）", r99("$[uu 5]"), "$[uu 5]", "A", { diagCount: 0 }],
	["R99 tw : f ? $@f（印の無い前置 `@` の項。前は G20）", std("tw : f ? $@f"), "(: tw (? [f] $@f))", null, { diagCount: 0 }],
	["R99 tg : g ? use $@g 5（前は G20）", std("tg : g ? use $@g 5", { omit: ["g"] }), "(: tg (? [g] (apply use (construct $@g 5))))", null],
	["R99 $[5 > 1 : inc]（枝で選ぶ括り。前は G20）", r99("$[5 > 1 : inc]"), "$[5 > 1 : inc]", "A", { diagCount: 0 }],
	["R99 p : $[5 > 1 : inc] ⏎ p（前は G20）", std(["p : $[5 > 1 : inc]", "p"]), "p", "A", { diagCount: 0 }],
	["R99 rd : [k] f x ? @f x ⏎ rd [1] $[5 > 1 : inc] 3（前は G20）", std(["rd : [k] f x ? @f x", "rd [1] $[5 > 1 : inc] 3"]), "(apply rd (construct [1] $[5 > 1 : inc] 3))", null],
	// R100：括りの関数の実体で渡された形の見えない値は、実体で値と分かるので警告する（`_` か値かは分からないので印 lift の持ち上げ。前は G20、§5 Q64）。
	// 持ち上げを `use` の実体の `@f` で開いても先を読まない（印の無い前置 `@` と同じ）ので、実体の根は未知。
	["R100 hb [s : (inc 5)]（前は G20）", r99("hb [s : (inc 5)]"), "(apply hb [s : [inc 5]])", "未知", { severities: WARN }],
	// `[inc 1]` の頭を受けた f は種類が未知（形の見えない値ではない）ので、持ち上げで通り、警告しない。
	["R99 kk : [f ~r] ? use $f 2 ⏎ kk [inc 1]（中身の見えない物を受けた f。前は G20）", std(["kk : [f ~r] ? use $f 2", "kk [inc 1]"]), "(apply kk [inc 1])", "未知", { diagCount: 0 }],
	["R100 kk : g8 [~l] ? use $g8 2 ⏎ kk 5 [1]（値を受けた裸の仮引数。前は G20）", std(["kk : g8 [~l] ? use $g8 2", "kk 5 [1]"]), "(apply kk (construct 5 [1]))", "未知", { severities: WARN }],
	["R100 hz [s : (inc 5)]（前は G20）", r99("hz [s : (inc 5)]"), "(apply hz [s : [inc 5]])", "A", { severities: WARN }],
	["R100 hz2 : [s] ? $[s , !_] ⏎ hz2 [s : (inc 5)]（単位律で `$s`。前は G20）", r99(["hz2 : [s] ? $[s , !_]", "hz2 [s : (inc 5)]"]), "(apply hz2 [s : [inc 5]])", "A", { severities: WARN }],
	["R100 hz3 : [s] ? $[_ , s] ⏎ hz3 [s : (inc 5)]（前は G20）", r99(["hz3 : [s] ? $[_ , s]", "hz3 [s : (inc 5)]"]), "(apply hz3 [s : [inc 5]])", "A", { severities: WARN }],
	["R100 kk2 : g8 [~l] ? $[g8 , !_] ⏎ kk2 5 [1]（前は G20）", std(["kk2 : g8 [~l] ? $[g8 , !_]", "kk2 5 [1]"]), "(apply kk2 (construct 5 [1]))", "A", { severities: WARN }],
	// 2026-11-04 の寄せ1（R128）から `⇥w : s` は条件 w（未定義の名前）の枝で、`$w` は零射の番地なので `use $w 1` は A で警告しない（前は局所の別名で `$s` と同じ
	// 警告と未知）。
	["R100 hb7 : [s] ? ⏎ ⇥w : s ⏎ ⇥use $w 1 の hb7 [s : (inc 5)]（寄せ1 から零射の番地で A。前は局所の別名で警告、その前は G20）", std(["hb7 : [s] ?", "\tw : s", "\tuse $w 1", "", "hb7 [s : (inc 5)]"]), "(apply hb7 [s : [inc 5]])", "A", { severities: ["information/undefined-name"] }],
	// 実体の鍵は分かれる：関数を受けた実体は指す関数の番地（知らせない）、形の見えない値を受けた実体は持ち上げ（知らせる。前は `{s:A}` の実体が G20）。
	// （前の版は `hz [s : _]`（零射の番地）で見ていたが、欄の `[s : _]` は片9 で答えが変わるので、2026-10-28 の確かめの直しで `[s : inc]` に替えた。）
	["R100 hz [s : inc] ⏎ hz [s : (inc 5)] の hz の実体は2つ", std(["hz : [s] ? $s", "hz [s : inc]", "hz [s : (inc 5)]"]), "(: hz (? [[s]] (inst {s:A} $s) (inst {s:L} $s)))", null, { at: -3, severities: WARN }],
	// 2026-10-28 の確かめの直し：実体で渡された形の見えない値でも、中身に関数か未知が見える物（`A(U)`。枝で選ぶ括り）は、直に書いた `$[5 > 1 : inc]` と同じく知らせない
	// （前は「関数ではありません」と知らせ、包み方で割れた）。
	["確かめ R100 hz [s : [5 > 1 : inc]]（`A(U)` は知らせない）", r99("hz [s : [5 > 1 : inc]]"), "(apply hz [s : [5 > 1 : inc]])", "A", { diagCount: 0 }],
	["確かめ R100 q : [5 > 1 : inc] ⏎ hz [s : q]", r99(["q : [5 > 1 : inc]", "hz [s : q]"]), "(apply hz [s : q])", "A", { diagCount: 0 }],
	["確かめ R99 $[5 > 1 : inc ⏎ _ : double]（枝の行の括り。前は G20、上の確かめの節から移した）", r99(["$[5 > 1 : inc", "_ : double]"]), "$[5 > 1 : inc ⏎ _ : double]", "A", { diagCount: 0 }],
	// R102：`$x ' 0` は x（前は未知）
	["R102 $vs ' 0（値）", r99("$vs ' 0"), "(' $vs 0)", "A", { severities: WARN }],
	["R102 ($inc ' 0) 5（関数を下ろして当てる。前は G7）", r99("($inc ' 0) 5"), "(apply [$inc ' 0] 5)", "A", { diagCount: 0 }],
	["R102 inc ($five ' 0)（前は G7）", r99("inc ($five ' 0)"), "(apply inc [$five ' 0])", "A", { severities: WARN }],
	["R102 $vs ' 1（1つの物の領域の外で `_`）", r99("$vs ' 1"), "(' $vs 1)", "A", { severities: WARN }],
	["R102 p : $vs ⏎ p ' 0（名前で運んでも同じ）", r99(["p : $vs", "p ' 0"]), "(' p 0)", "A", { severities: WARN }],
	["R102 hw [s : $vs]（仮引数で運んでも同じ。本体の根は値）", r99("hw [s : $vs]"), "(apply hw [s : $vs])", "A", { severities: WARN }],
	// k ≠ 0 は領域の外の `_`（値）で、下ろした関数ではない：本体の根に置いても裸の関数（G16）にならない（変異 n8 で見つけた穴。`$inc ' 0` を根に置けば G16、下の断る側）
	["R102 t : y ? $inc ' 1（領域の外の `_` は値）", r99("t : y ? $inc ' 1"), "(: t (? [y] (' $inc 1)))", null, { diagCount: 0 }],
	// R103：持ち上げだけを通る輪は通す（前は name-cycle）
	["R103 v : add (f9 1) ⏎ f9 : x ? x , $v ⏎ v 3（v が関数）", std(["v : add (f9 1)", "f9 : x ? x , $v", "v 3"]), "(apply v 3)", "A", { diagCount: 0 }],
	["R103 wk : r ? $[g9 r] ⏎ v : 1 , (wk $v)（持ち上げの中で下ろす）", r99(["wk : r ? $[g9 r]", "v : 1 , (wk $v)", "v"]), "v", "A", { severities: [...WARN, ...WARN] }],
	["R103 v : 1 , $[v + 1]（持ち上げの中身が自分を読む）", std(["v : 1 , $[v + 1]", "v"]), "v", "A", { severities: WARN }],
	["R103 v : f9 1 ⏎ f9 : x ? x , $[v 1]（`$[v 1]` は v を解いた後に中身が決まる）", std(["v : f9 1", "f9 : x ? x , $[v 1]", "v"]), "v", "A", { severities: WARN }],
	// 名前に置いた持ち上げ（下ろさない）は、どの並べ方でも通る
	["確かめ R103 w : $[v + 1] ⏎ v : 1 , w", std(["w : $[v + 1]", "v : 1 , w", "v"]), "v", "A", { severities: WARN }],
	["確かめ R103 v : 1 , w ⏎ w : $[v + 1]", std(["v : 1 , w", "w : $[v + 1]", "v"]), "v", "A", { severities: WARN }],
	// 輪の持ち上げを下ろさない下ろし（輪へ届かない物・名前で運んだ積から字面を引く・持ち上げの持ち上げを1段下ろす）は、輪の定義にあっても通る
	["確かめ R103 v : 1 , $v , (vs ' 0)（輪へ届かない物の下ろし。HEAD と同じ）", std(["v : 1 , $v , (vs ' 0)", "v"]), "v", "A", { severities: WARN }],
	["確かめ R103 v : 1 , $[v + 1] , (use $inc 1)（HEAD は name-cycle）", std(["v : 1 , $[v + 1] , (use $inc 1)", "v"]), "v", "A", { severities: WARN }],
	["確かめ R103 w : 1 , $v ⏎ v : 1 , (w ' 0)（1 を引くだけ。HEAD と同じ）", std(["w : 1 , $v", "v : 1 , (w ' 0)", "v"]), "v", "A", { severities: WARN }],
	["確かめ R103 w : $[$v] ⏎ v : 1 , @w（`$v` に下ろすだけ）", std(["w : $[$v]", "v : 1 , @w", "v"]), "v", "A", { severities: [...WARN, ...WARN] }],
	// 輪の中の書いた積の判定は、輪の外と同じ読み：長さ 0 の流れは単位（R84・R104。前は書いた積の G20）、`,` のすぐ左の並びが参照の口に入れば適用（R66。前は直の輪で
	// G20、関数の本体の輪で G3）。v :: A と、`$` の警告（輪の外の `u : 1 , 2` に替えた綴りと同じ）。
	["確かめ R101 v : 1 , $[[]~ , v]（長さ 0 の流れは単位）", r99(["v : 1 , $[[]~ , v]", "v"]), "v", "A", { severities: WARN }],
	["確かめ R101 v : 1 , $[_~ , v]", r99(["v : 1 , $[_~ , v]", "v"]), "v", "A", { severities: WARN }],
	["確かめ R101 v : 1 , $[e0~ , v]", r99(["v : 1 , $[e0~ , v]", "v"]), "v", "A", { severities: WARN }],
	["確かめ R101 v : f9 1 ⏎ f9 : x ? x , $[[]~ , v]（前は v が未知で知らせも無かった）", r99(["v : f9 1", "f9 : x ? x , $[[]~ , v]", "v"]), "v", "A", { severities: WARN }],
	["確かめ R101 fl : [x ~xs] ? x ⏎ v : 1 , $[fl v , 2]（R66 の適用）", r99(["fl : [x ~xs] ? x", "v : 1 , $[fl v , 2]", "v"]), "v", "A", { severities: WARN }],
	["確かめ R101 fl : [x ~xs] ? x ⏎ v : f9 1 ⏎ f9 : x ? x , $[fl v , 2]（前は G3）", r99(["fl : [x ~xs] ? x", "v : f9 1", "f9 : x ? x , $[fl v , 2]", "v"]), "v", "A", { severities: WARN }],
	// `$` の項の後置の印は、その `$` の項の物（R104 の `$[]~` は `$_`）。`$[$_]` と同じ、零射の番地の持ち上げ（値なので知らせる）。前は外側の R57 の G20。
	["確かめ R104 $[$[]~]", r99("$[$[]~]"), "$[$[]~]", "A", { severities: WARN }],
	["確かめ R104 $[$[]~ , !_]", r99("$[$[]~ , !_]"), "$[$[]~ , !_]", "A", { severities: WARN }],
	// R104：長さ 0 と分かる流れの `$`（前は R57 の G20）
	["R104 $[]~", std("$[]~"), "$[]~", "A", { diagCount: 0 }],
	["R104 $[[]~]", std("$[[]~]"), "$[[]~]", "A", { diagCount: 0 }],
	["R104 $_~", std("$_~"), "$_~", "A", { diagCount: 0 }],
	["R104 e0 : [] ⏎ $e0~", r99("$e0~"), "$e0~", "A", { diagCount: 0 }],
	// 書いた積の `$` でない形（今までどおり通る）
	["R101 [$five , 1]（要素ごとに持ち上げる。案内の綴り）", r99("[$five , 1]"), "[$five , 1]", "A", { severities: WARN }],
	["R101 [$inc , $double]", r99("[$inc , $double]"), "[$inc , $double]", "A", { diagCount: 0 }],
	["R101 pq9 : 5 , 99 ⏎ $pq9（名前を通した積は値の持ち上げで警告）", r99(["pq9 : 5 , 99", "$pq9"]), "$pq9", "A", { severities: WARN }],
	// 片イ（R125）で G16 は廃止。下ろした関数を本体の根に返す形は `_` と bare-function-return（前は G16）。
	["R102 hw [s : $inc]（前は G16）", r99("hw [s : $inc]"), "(apply hw [s : $inc])", "A", { severities: ["information/bare-function-return"] }],
	["R102 t : y ? $inc ' 0（下ろした関数を本体の根に返す）（前は G16）", r99("t : y ? $inc ' 0"), "(: t (? [y] (unit (' $inc 0))))", null, { severities: ["information/bare-function-return"] }],
	// 2026-11-04 の寄せ1（R128）：本体の `⇥p : 1 , $[p + 1]` は条件 p（未定義の名前）の枝で、持ち上げの中の p も未定義の名前なので輪は無い（前は局所の定義の輪で
	// G20、下の r99Refused にあった。§5 Q78 (b) の本体の分は消えた）。
	["確かめ R103 t : y ? ⏎ ⇥p : 1 , $[p + 1] ⏎ ⇥p（寄せ1 から輪でない。前は局所の定義の輪で G20）", std(["t : y ?", "\tp : 1 , $[p + 1]", "\tp", "", "t 1"]), "(apply t 1)", "A", { diag: "p" }],
];
const r99Refused = [
	// R101：書いた `,` の積の `$`（前は値を読む参照で通った）
	["R101 v : 1 ⏎ $[v , 1]", r99(["v : 1", "$[v , 1]"]), "G20"],
	["R101 $[inc , double]", r99("$[inc , double]"), "G20"],
	["R101 $(five , 99)（上の「R58〜R61」の節の `$(n , 99)` と同じ形）", r99("$(five , 99)"), "G20"],
	["R101 $(inc , 1)（上の確かめの節から移した）", r99("$(inc , 1)"), "G20"],
	["R101 $[(five , 1)]（[x] ≅ x）", r99("$[(five , 1)]"), "G20"],
	["R101 $[five , 1 , _]（単位律の後にも残る）", r99("$[five , 1 , _]"), "G20"],
	["R101 $[inc , double , !_]", r99("$[inc , double , !_]"), "G20"],
	["R101 $[inc , (!_)]（括った `[!_]` は否定の点なしで単位ではない、R29）", r99("$[inc , (!_)]"), "G20"],
	["R101 q : $[five , 1]（名前の右辺に置いても）", r99("q : $[five , 1]"), "G20"],
	["R101 t : y ? $[y , 1]（本体に置いても）", r99("t : y ? $[y , 1]"), "G20"],
	["R101 $(1 , 2) + 0x3（前は R97 の G21）", r99("$(1 , 2) + 0x3"), "G20"],
	["R101 v : f9 1 ⏎ f9 : x ? x , $[v , 1] ⏎ v（輪の中でも同じ。前は name-cycle）", std(["v : f9 1", "f9 : x ? x , $[v , 1]", "v"]), "G20"],
	// R103：定義の時に下ろす所を通る輪（今のまま name-cycle）
	["R103 v : 1 , (g9 $v)（関数の本体の `@` で下ろす）", r99(["v : 1 , (g9 $v)", "v"]), "name-cycle"],
	["R103 v : 1 , @[$[v + 1]]（持ち上げを `@` で開く）", std(["v : 1 , @[$[v + 1]]", "v"]), "name-cycle"],
	// 2026-10-28 の確かめの直し：関数の返値・名前を通った持ち上げを、定義の時に下ろす輪（前は黙って通った。HEAD は name-cycle、`f8` と `w : $v` の片方の並べ方は HEAD も通った）
	["確かめ R103 wk : r ? $[g9 r] ⏎ v : 1 , @(wk $v)（持ち上げを返す関数の返値を開く）", r99(["wk : r ? $[g9 r]", "v : 1 , @(wk $v)", "v"]), "name-cycle"],
	["確かめ R103 wk : r ? $[g9 r] ⏎ v : 1 , ((wk $v) ' 0)", r99(["wk : r ? $[g9 r]", "v : 1 , ((wk $v) ' 0)", "v"]), "name-cycle"],
	["確かめ R103 f9 : x ? $[v + x] ⏎ v : 1 , @(f9 1)", std(["f9 : x ? $[v + x]", "v : 1 , @(f9 1)", "v"]), "name-cycle"],
	["確かめ R103 h5 : [s] ? $[v + s] ⏎ v : 1 , @(h5 [s : 1])", std(["h5 : [s] ? $[v + s]", "v : 1 , @(h5 [s : 1])", "v"]), "name-cycle"],
	["確かめ R103 f8 : x ? $v ⏎ v : 1 , @(f8 1)（HEAD から通っていた）", std(["f8 : x ? $v", "v : 1 , @(f8 1)", "v"]), "name-cycle"],
	["確かめ R103 w : $[v + 1] ⏎ v : 1 , @w", std(["w : $[v + 1]", "v : 1 , @w", "v"]), "name-cycle"],
	["確かめ R103 v : 1 , @w ⏎ w : $[v + 1]（並べ方に依らない）", std(["v : 1 , @w", "w : $[v + 1]", "v"]), "name-cycle"],
	["確かめ R103 w : $[v + 1] ⏎ v : 1 , (w ' 0)", std(["w : $[v + 1]", "v : 1 , (w ' 0)", "v"]), "name-cycle"],
	["確かめ R103 w : $v ⏎ v : 1 , @w（HEAD はこの並べ方だけ通った）", std(["w : $v", "v : 1 , @w", "v"]), "name-cycle"],
	["確かめ R103 v : 1 , g9 $v（利用者の綴り。括らない形も、輪が先に断る）", r99(["v : 1 , g9 $v", "v"]), "name-cycle"],
	["確かめ R103 w : $v ⏎ v : 1 , (w ' 0)（HEAD はこの並べ方だけ通った）", std(["w : $v", "v : 1 , (w ' 0)", "v"]), "name-cycle"],
	["確かめ R103 w : 1 , $v ⏎ v : 1 , ((w ' 1) ' 0)（引いた要素を下ろす。HEAD は通った）", std(["w : 1 , $v", "v : 1 , ((w ' 1) ' 0)", "v"]), "name-cycle"],
	["確かめ R103 id : x ? x ⏎ v : 1 , @(id $v)（受けた物を返す関数。HEAD は通った）", std(["id : x ? x", "v : 1 , @(id $v)", "v"]), "name-cycle"],
	["確かめ R103 w : f9 1 ⏎ f9 : x ? $[v + x] ⏎ v : 1 , @w（関数の返値を名前に置く）", std(["w : f9 1", "f9 : x ? $[v + x]", "v : 1 , @w", "v"]), "name-cycle"],
	["確かめ R103 v : 1 , @w ⏎ w : f9 1 ⏎ f9 : x ? $[v + x]（並べ方に依らない）", std(["v : 1 , @w", "w : f9 1", "f9 : x ? $[v + x]", "v"]), "name-cycle"],
	// 実体は鍵で分け合われる：輪の外で同じ鍵の実体（u は形の見えない値で `$u` と `$v` の仮の参照の鍵が同じ）を先に作ると、本体の `@r` を読み直さない（HEAD はこの並べ方で通った）
	["確かめ R103 u : g8 1 ⏎ x1 : g9 $u ⏎ v : 1 , (g9 $v)（実体の分け合い）", std(["g9 : r ? @r", "g8 : y ? y , 7", "u : g8 1", "x1 : g9 $u", "v : 1 , (g9 $v)", "v"]), "name-cycle"],
	// 断る側に倒した所（§5 Q78 (h)）：関数の返値は輪の持ち上げかを綴りで見分けられない（fst は $five を返すが断る。HEAD は通った）
	["確かめ R103 fst : a b ? a ⏎ v : 1 , @(fst $five $v)（断る側に倒した）", r99(["fst : a b ? a", "v : 1 , @(fst $five $v)", "v"]), "name-cycle"],
	["確かめ R103 v : 1 , (g9 $[$v])（関数の本体の中の下ろしは数える。断る側に倒した）", r99(["v : 1 , (g9 $[$v])", "v"]), "name-cycle"],
	// 輪の中の撒いた形は、輪の外と同じ R57 の G20（前は探りで作った輪の断りが残り、name-cycle）
	["確かめ R57 v : 1 , $v~", std(["v : 1 , $v~", "v"]), "G20"],
	["確かめ R57 v : 1 , $[v~]", std(["v : 1 , $[v~]", "v"]), "G20"],
	["確かめ R57 v : f9 1 ⏎ f9 : x ? x , $v~", std(["v : f9 1", "f9 : x ? x , $v~", "v"]), "G20"],
	// 輪の中の書いた積の G3 は、輪の外の `$[inc u , 2]` と同じ（前は書いた積の G20）
	// 片イ（R121）で G3 は廃止したので、書いた `,` の積の `$`（R101 の G20）に当たる（前は G3）。
	["確かめ R101 v : 1 , $[inc v , 2]（G20）（前は G3）", std(["v : 1 , $[inc v , 2]", "v"]), "G20"],
	// 関数の本体の局所の定義の輪が持ち上げを通る：局所の `$名前` の輪と同じ G20（前は値の輪の name-cycle）。→ 2026-11-04 の寄せ1（R128）で `⇥p : 1 , $[p + 1]` は
	// 条件 p の枝になり、p は未定義の名前で輪が無いので通る（上の r99Passes の終わり。§5 Q78 (b) の本体の分は消えた）。
	// 持ち上げの中で始まって中で閉じる輪（輪のいちばん下の枠が持ち上げより後）は、持ち上げを通らない本物の輪なので今までどおり name-cycle
	["R103 p : $[q1 2] ⏎ q1 : q2 , 1 ⏎ q2 : q1 , 1（持ち上げの中で閉じる本物の輪）", std(["p : $[q1 2]", "q1 : q2 , 1", "q2 : q1 , 1"]), "name-cycle"],
	// R102：下ろした関数を本体の根に返すと裸の関数（R33 の G16。前は未知の根で通った）。この2行は、片イ（R125）で上の r99Passes の終わりへ移した。
	// G20 に残る物：中で余る関数（R59。中身の並びそのものの積み上げも）・後置の印（R57）
	["R59 $[5 inc]（前は種類が未知の G20）", r99("$[5 inc]"), "G20"],
	["R57 $!_~（今のまま）", r99("$!_~"), "G20"],
	// 先の種類の分からない持ち上げ：値の演算子に置けば G21、撒けば R57 と同じ G20
	["R99 $[uu 5] + 0x8（前は G20）", r99("$[uu 5] + 0x8"), "G21"],
	["R99 io@ ⏎ $zz == $zz（前は G20）", std(["io@", "$zz == $zz"]), "G21"],
	["R99 [$[uu 5]]~（前は G20）", r99("[$[uu 5]]~"), "G20"],
];
for (const [name, s, want, kind, extra] of r99Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r99Refused) checkRefused(name, s, want, inst);
const r99Messages = [
	["R101 `$[v , 1]` は `[$v , 1]` を案内する", r99(["v : 1", "$[v , 1]"]), "G20", ["`[$v , 1]`", "§4 R101"], ["1つの Reader"]],
	["R101 `$[inc , double]` は `[$inc , $double]` を案内する", r99("$[inc , double]"), "G20", ["`[$inc , $double]`", "§4 R101"], []],
	["R59 `$[5 inc]` は余る関数を言う", r99("$[5 inc]"), "G20", ["`inc`", "R59"], ["種類が決まらない"]],
	["R99 先の種類の分からない持ち上げの算術", r99("$[uu 5] + 0x8"), "G21", ["先の種類が書いた所で分からない持ち上げ", "R99"], []],
	["R57 後置の印の G20 は持ち上げで言う", std("$vs~"), "G20", ["持ち上げる物が1つに決まりません", "§4 R57・R99"], ["1つの Reader"]],
	// 2026-10-28 の確かめの直し：案内した綴りがそれ自体断られない（要素の積は要素ごとに持ち上げた括り・後置の印の付いた要素はそのまま・単位律で消えた要素は書かない）
	["確かめ R101 `$[(five , 1) , 2]` は `[[$five , 1] , 2]` を案内する", r99("$[(five , 1) , 2]"), "G20", ["`[[$five , 1] , 2]`"], ["`[$[five , 1] , 2]`"]],
	["確かめ R101 `$[five , (inc , double)]` は `[$five , [$inc , $double]]`", r99("$[five , (inc , double)]"), "G20", ["`[$five , [$inc , $double]]`"], []],
	["確かめ R101 `$[five , vs~]` は `[$five , vs~]`", r99("$[five , vs~]"), "G20", ["`[$five , vs~]`"], ["$[vs~]"]],
	["確かめ R101 `$[five , i , 1]` は `[$five , 1]`", r99("$[five , i , 1]"), "G20", ["`[$five , 1]`"], ["$i"]],
	["確かめ R103 関数の返値を下ろす輪は下ろす所を名指しする", r99(["wk : r ? $[g9 r]", "v : 1 , @(wk $v)", "v"]), "P2", ["定義の時に下ろす所 `@[wk $v]`", "§4 R103", "§5 Q78 (h)"], []],
	["確かめ R103 名前で辿った本体の下ろす所", std(["g9 : r ? @r", "w : $[v + 1]", "v : 1 , (g9 w)", "v"]), "P2", ["名前で辿った `g9` に", "`@r`"], []],
	// 「確かめ R103 局所の定義の輪は Q78 (b) を名指しする」は、2026-11-04 の寄せ1（R128）でその形が通る（本体の行は枝）ので外した。
];
for (const [name, s, gateId, must, mustNot] of r99Messages) {
	total++;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if (e.gate === gateId && !missing.length && !extra.length) ok(`言い分 ${name}`);
		else fail(`言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}
const r99Notes = [
	["R100 警告の言い分", r99("$vs"), ["`$vs` の `$` は持ち上げ", "先 `vs` は関数ではありません", "`$` を外して `vs`", "`@` で下ろします", "§4 R99・R100"]],
	["R100 実体で渡された形の見えない値の警告", r99("hb [s : (inc 5)]"), ["括りの関数の実体で渡された値", "§5 Q64"]],
];
for (const [name, s, must] of r99Notes) {
	total++;
	try {
		const r = resolve(s);
		const d = r.diagnostics.find((x) => x.reason === "dollar-non-function");
		const missing = d ? must.filter((w) => !d.message.includes(w)) : must;
		if (d && d.severity === "warning" && !missing.length) ok(`知らせ ${name}`);
		else fail(`知らせ ${name}`, `無い語: ${missing.join("・")}`, JSON.stringify(r.diagnostics));
	} catch (e) {
		fail(`知らせ ${name}`, `断られた: ${e.gate} ${e.message}`);
	}
}

// ---------------------------------------------------------------------------
// R105〜R110（2026-10-28 の片9。値の口の書いた `_` は単位律 `f _ = f`・実行時に来た `_` も値の口では消える（値の段）・既定値の口だけが開いた部分適用は評価する所で
// 既定値で埋める・`(!_ _)` は書いた項どおり・空は `_` と書く・評価する所では種類の未知な項の後ろの `_` も消える）
// ---------------------------------------------------------------------------
// 出どころ（sid 58a809c9。U の時刻は UTC）：U [2026-10-27 15:50]「sub _ 1 2 / が / なぜ新しいラムダを生成しているそぶりを前提にしているの？」、主の Claude の問い
// 「値の口の書いた `_` も単位律で消える（穴は `!_` だけ）を、片9 の初めに入れていい？」のボタンの答え U〔答え〕[15:59]「それでいい。値の口の書いた _ も単位律 f _ = f で
// 消えて、sub _ 1 2 は -1。書いた・名前・計算の _ は値の口でどれも同じ。穴は !_ だけ。mx _ 1 は mx 1。片9 の初めに入れて。」（ボタンの文は主の Claude の物）。
// U [15:43]「(((sub (< 3 2)) 1) 2)」・U [15:44]「余積は、必ず、左結合」（R106、値の段）。主の Claude の問い「Q74 (b)：gq 1 のように既定値の口を開けたまま部分適用した物は、
// 関数なのか、既定値で埋めた値なのか。Q8 の残りと同じ問い。」に U〔答え〕[12:46]「既定値で埋める。 / 埋めないなら、 !_ で穴であると明示」（R107）。同じ返事の Q74 (c) への
// 「これ、本質的じゃないって理解できてる？」（R108）、Q75 (f) への「_ で書くしかないけれども、即時リスト化したいなら , を明示で組む」（R109）。
// R105：値の口（素の関数の口・括りの関数の裸の口・点なしの口・既定値のある関数の既定値の無い口）に置いた書いた `_`（と同じに読む `[]`・長さ 0 の流れ）は消えて口を使わない。
// 書いた `_` の穴（R16・R38・R68・R86）は廃止、穴は `!_` だけ。既定値のある口は R39 の既定値、畳む2項の点なしの被演算子は R31 の印のまま。
// R106：実行時に来た `_` も値の口では消える（値の段。木は `_` でない読みの予測のまま。割れる所は §5 Q79）。参照の口は今のまま（R15・R65）。
// R107：評価する所で、既定値の口だけが開いた部分適用は既定値で埋める（`gq 1` は `gq 1 _` と同じ木）。並びの中で後ろに実引数が続けばその口に入る。
// R108：`(!_ _)` は書いた項どおり恒等射。否定の点なしは裸の `[!_]` だけ。R109：G16 の空の List の言い分に「空は `_` と書く」を足す。
// R110：評価する所では、種類の未知な項の後ろの `_` も消える（R107 で既定値の読みと同じ値になる所だけ。評価する所の外は G7 のまま、§5 Q80）。
// 上の節で答えの変わった行は、行の注と名前に前の答えと理由を書いて直し、通る側・断る側を変えた物はここへ移した（元の所に注を残した）。ただし、値の後ろに関数を置いた
// 字面の前からある行（16 本）は、逆適用の廃止（R47）でここには置かず、元の R28・R83・R94 の節の通る側の終わりに「R105 で通る」の名前で置いた。片9b で答えの変わる形（未定義の名前・
// `x : _` の名前・欄の `[y : _]`）には寄りかからない。門に当たる本体の見本 `[+ 1] _ 1` は `[+ 1] 1` で通るので、`[[g5] ? g5] !_ 1`（G5）に替えた。
const r105 = (lines) => r94(lines);
const r105Passes = [
	// R105：値の口の書いた `_` は消える（決定の例）
	["R105 sub _ 1 2 は `sub 1 2`（値は -1。前は R83 の穴で `sub 2 1`）", r105("sub _ 1 2"), "(apply sub (construct 1 2))", "A"],
	["R105 add _ 3 は `add 3`（前は R16 の穴）", r105("add _ 3"), "(unit (apply add 3))", "A", { leftoverDiag: ["(apply add 3)"] }],
	["R105 mx _ 1 は `mx 1`（括りの関数の裸の口。前は G5）", r105("mx _ 1"), "(unit (apply mx 1))", "A", { leftoverDiag: ["(apply mx 1)"] }],
	["R105 (sub _) 1 2 は `sub 1 2`（括りの中の末尾の `_` も消える）", r105("(sub _) 1 2"), "(apply [sub _] (construct 1 2))", "A"],
	["R105 inc _ 5 は `inc 5`", r105("inc _ 5"), "(apply inc 5)", "A"],
	["R105 add _ は add（後ろが無ければ関数が残る、R28 と同じ）", r105("add _"), "(unit add)", "A", { leftoverDiag: ["add"] }],
	["R105 sub _ _ 1 2 は `sub 1 2`（続けて書いても口を使わない）", r105("sub _ _ 1 2"), "(apply sub (construct 1 2))", "A"],
	["R105 本体 t : y ? sub _ y 2 ⏎ t 1", r105(["t : y ? sub _ y 2", "t 1"]), "(apply t 1)", "A"],
	["R105 名前 w : sub _ 1 ⏎ w 2", r105(["w : sub _ 1", "w 2"]), "(apply w 2)", "A"],
	["R105 1 + (sub _ 1 2)（中置の被演算子の中）", r105("1 + (sub _ 1 2)"), "(+ 1 [sub _ 1 2])", "A"],
	// 参照の口は変えない（決定3）：書いた `_` は R15 で詰まる（実行時の `_` は R65 で空の器が席を取る、値の段。U〔答え〕[2026-10-27 12:40]「これで正しいように見える。」）
	["R105 の外：pb2 _ 1 は `pb2 1`（最後でない括りの口、R15 のまま）", r105("pb2 _ 1"), "(unit (apply pb2 1))", "A", { leftoverDiag: ["(apply pb2 1)"] }],
	// R106：計算の項の木は今のまま（`_` でない読みの予測）。値の段では `(3 < 2)` が `_` なら値の口で消える（`sub 1 2` で -1、`add 1 5` で 6）。割れは §5 Q79
	["R106 sub (3 < 2) 1 2 の木は今のまま（値の段では -1、§5 Q79）", r105("sub (3 < 2) 1 2"), "(construct (apply sub (construct [3 < 2] 1)) 2)", "A"],
	["R106 (add (3 < 2) 1) 5 の木は今のまま（値の段では `add 1 5` で 6、§5 Q79）", r105("(add (3 < 2) 1) 5"), "(construct [add [3 < 2] 1] 5)", "A"],
	// R107：評価する所で既定値の口だけが開いた部分適用は既定値で埋める（`gq 1 _` と同じ木。種類は既定値のある関数の適用で未知、§5 Q8）
	["R107 gq 1 は `gq 1 _` と同じ（前は `(apply gq 1)`）", r105("gq 1"), "(apply gq (construct 1 _))", "未知"],
	["R107 gq 1 5 は y が 5（並びの中は評価する所でない）", r105("gq 1 5"), "(apply gq (construct 1 5))", "未知"],
	["R107 gq 1 !_ は穴を明示した関数（埋めない。根なので R42 の余ったラムダ）", r105("gq 1 !_"), "(unit (? [$p0] (apply gq (construct 1 $p0))))", "A", { leftoverDiag: ["(? [$p0] (apply gq (construct 1 $p0)))"] }],
	["R107 w : gq 1 !_ ⏎ w 5（定義の右辺は評価する所でないので閉じない）", r105(["w : gq 1 !_", "w 5"]), "(apply w 5)", "未知"],
	["R107 w : gq 1 !_ ⏎ w（根に余ったラムダの `_`）", r105(["w : gq 1 !_", "w"]), "(unit w)", "A", { leftoverDiag: ["w"] }],
	["R107 gq 1 == 2（比べの被演算子も評価する所、R76）", r105("gq 1 == 2"), "(== (apply gq (construct 1 _)) 2)", "未知"],
	["R107 inc gq 1（合成の後ろの段の既定値のある関数も）", r105("inc gq 1"), "(apply gq (construct (apply inc 1) _))", "未知"],
	["R107 go 1 は `go 1 _`", r105("go 1"), "(apply go (construct 1 _))", "未知"],
	["R107 hd [1 2] は `hd [1 2] _`（括りの仮引数の後ろの既定値のある口）", r105("hd [1 2]"), "(apply hd (construct [1 2] _))", "未知"],
	["R107 gd2 1 は2つの既定値で埋める", r105(["gd2 : x [y : 2] [zs : 3] ? x", "gd2 1"]), "(apply gd2 (construct 1 _ _))", "未知"],
	["R107 gd2 1 _ も残りの zs を埋める", r105(["gd2 : x [y : 2] [zs : 3] ? x", "gd2 1 _"]), "(apply gd2 (construct 1 _ _))", "未知"],
	["R107 gl 1 は既定値の無い z が開いているので埋めない", r105(["gl : x [y : 5] z ? x", "gl 1"]), "(apply gl 1)", "未知"],
	["R107 括りの中は評価する所でない：[gq 1]", r105("[gq 1]"), "[gq 1]", "未知"],
	["R107 何も受けていない gf は部分適用でないので埋めない（R42 の余ったラムダ、§5 Q80）", r105(["gf : [y : 1] ? y", "gf"]), "(unit gf)", "A", { leftoverDiag: ["gf"] }],
	// R110：評価する所では、種類の未知な項の後ろの `_` も消える（前は G7、§5 Q74 (b)）
	["R110 (gq 1) _ は [gq 1]（前は G7）", r28("(gq 1) _"), "[gq 1]", "未知"],
	["R110 w : gq 1 ⏎ w _ は w（前は G7）", r28(["w : gq 1", "w _"]), "w", "未知"],
	["R110 (gq 1) _ == 2（比べの被演算子も評価する所。前は G7）", r28("(gq 1) _ == 2"), "(== [gq 1] 2)", "未知"],
	// R108：`!_` の後ろに書いた `_` だけが続く括りは書いた項どおり恒等射（前は G7、§5 Q74 (c)）
	["R108 根の (!_ _) は恒等射の括り（根では R42 の余ったラムダで、木は (unit [!_ _])。恒等射なので知らせない。前は G7）", r28("(!_ _)"), "(unit [!_ _])", "A", { leftoverDiag: [] }],
	["R108 [!_ _] 5 は 5（前は G7）", r28("[!_ _] 5"), "(apply [!_ _] 5)", "A"],
	["R108 (!_ _) 5（前は G7）", r28("(!_ _) 5"), "(apply [!_ _] 5)", "A"],
	["R108 double (!_ _) 5（前は G7）", r28("double (!_ _) 5"), "(apply (compose double [!_ _]) 5)", "A"],
	["R108 w : [!_ _] ⏎ w 5 6（恒等射が並びを受ける。前は G7）", r28(["w : [!_ _]", "w 5 6"]), "(apply w (construct 5 6))", "A"],
	["R108 map $[!_ _] vs（前は G7）", r28("map $[!_ _] vs"), "(apply map (construct $[!_ _] vs))", "A"],
	["R108 (!_ []~) 7 は `(!_ _) 7` と同じ（前は G7、片5 は同じ答え）", r94("(!_ []~) 7"), "(apply [!_ []~] 7)", "A"],
	["R108 [!_ []~]（前は G7）", r94("[!_ []~]"), "(unit [!_ []~])", "A"],
	["R108 の外：[!_] 5 は否定の点なし（今のまま）", r28("[!_] 5"), "(apply [!_] 5)", "A"],
	// 決定7：帰結として閉じた所
	["Q74 (d) gd2 _ _ は gd2（左から読んで2つとも x の口で消える。前は後ろの `_` が y の既定値、前の `_` が R68 のカリー化）", r105(["gd2 : x [y : 2] [zs : 3] ? x", "gd2 _ _"]), "(unit gd2)", "A", { leftoverDiag: ["gd2"] }],
	["穴の関数の穴の口：(go !_ 2) _ は `(go !_ 2)`", r105("(go !_ 2) _"), "(unit [go !_ 2])", "A", { leftoverDiag: ["[go !_ 2]"] }],
	["穴の関数の穴の口：(go !_ 2) []~ も同じ", r105("(go !_ 2) []~"), "(unit [go !_ 2])", "A", { leftoverDiag: ["[go !_ 2]"] }],
	["穴の関数の最後の括り：(go !_) 1 _ 5 は `(go !_) 1 5`（括りの口で詰まる、R15）", r105("(go !_) 1 _ 5"), "(apply [go !_] (construct 1 5))", "未知"],
	// 上の節から移した行（前は G5・G7・G13・G15）
	["移した p2 : add ⏎ p2 _ 3（別名の頭。前は G5）", std(["p2 : add", "p2 _ 3"]), "(unit (apply p2 3))", "A", { leftoverDiag: ["(apply p2 3)"] }],
	["移した g3 : f3 1 ⏎ g3 _ 3（前は G5）", std(["g3 : f3 1", "g3 _ 3"]), "(unit (apply g3 3))", "A", { leftoverDiag: ["(apply g3 3)"] }],
	["移した add _ vs~ は `add vs~`（R51 の畳み込み。前は G5）", std("add _ vs~"), "(apply add vs~)", "A"],
	["移した mx _ 3（裸と括りの混ざった関数。前は G5）", std(["mx : a [b] ? a", "mx _ 3"]), "(unit (apply mx 3))", "A", { leftoverDiag: ["(apply mx 3)"] }],
	["移した (mx3 1) _ 3（部分適用の残りの裸の口。前は G5）", std(["mx3 : [a] b [c] ? a", "(mx3 1) _ 3"]), "(unit (apply [mx3 1] 3))", "A", { leftoverDiag: ["(apply [mx3 1] 3)"] }],
	["移した (f3 !_ 2) _ 1（R34 の k < n の穴の口。前は G5）", std("(f3 !_ 2) _ 1"), "(unit (apply [f3 !_ 2] 1))", "A", { leftoverDiag: ["(apply [f3 !_ 2] 1)"] }],
	["移した [* 2,] 1 _ 3（貪欲な単項の並びの単位。前は G5）", std("[* 2,] 1 _ 3"), "(apply [* 2,] (construct 1 3))", "A"],
	["移した [<<] _ 2（畳まない2項の点なしの値の口。前は G5）", std("[<<] _ 2"), "(unit (apply [<<] 2))", "A", { pfInfo: "[<<]", leftoverDiag: ["(apply [<<] 2)"] }],
	["移した go : ys ? ys ⏎ go _ vs~ は `go vs~`（前は R38 の G13）", std(["go : ys ? ys", "go _ vs~"]), "(apply go vs~)", "A"],
	["移した go inc _ 3（合成の段の go。R107 で zs を埋める。前は G15）", std([...GO_DEFAULT, "go inc _ 3"]), "(apply (compose go inc) (construct 3 _))", "未知"],
	["移した mx [] 1（`mx _ 1` と同じ。前は G5）", r83("mx [] 1"), "(unit (apply mx 1))", "A", { leftoverDiag: ["(apply mx 1)"] }],
	["移した [<<] [] 2（`[<<] _ 2` と同じ。前は G5）", r94("[<<] [] 2"), "(unit (apply [<<] 2))", "A", { pfInfo: "[<<]", leftoverDiag: ["(apply [<<] 2)"] }],
	["移した gq [] 1 !_（`gq _ 1 !_` と同じ `gq 1 !_` の穴。前は G15）", r94("gq [] 1 !_"), "(unit (? [$p0] (apply gq (construct 1 $p0))))", "A", { leftoverDiag: ["(? [$p0] (apply gq (construct 1 $p0)))"] }],
	// §5 Q75 (g) を閉じた：`_` の読みで `[]` の着く口が変わる所は無くなった（`_` はいつも消える）
	["移した Q75 (g) pq _ [] は `pq []`（`[]` は括りの口 [a] で器。前は G5）", r94("pq _ []"), "(unit (apply pq []))", "A", { leftoverDiag: ["(apply pq [])"] }],
	["移した Q75 (g) (f3 !_ 2) _ [] は `(f3 !_ 2)`（`[]` は穴の口で `_`。前は G5）", r94("(f3 !_ 2) _ []"), "(unit [f3 !_ 2])", "A", { leftoverDiag: ["[f3 !_ 2]"] }],
	["移した Q75 (g) (add 3) _ [] [] は `(add 3)`（前は G5）", r94("(add 3) _ [] []"), "(unit [add 3])", "A", { leftoverDiag: ["[add 3]"] }],
	["移した Q75 (g) inc _ _ [] は inc（前は G13）", r94("inc _ _ []"), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	// 片イ（R120）で種類の未知な項の G7 は廃止（§5 Q79・Q80 を閉じた）。評価する所の外の、適用の結果の後ろの `_` は消す予想（R120 の文面の `[(gq 1) _]` は
	// `[[gq 1] _]` の葉）、既定値のある関数の部分適用の項の後ろの値は積む予想（`(gq 1) 5` の値は 6、R120）で通る（前は G7）。
	["R110 の外：[(gq 1) _]（括りの中、§5 Q80）（前は G7）", r28("[(gq 1) _]"), "[[gq 1] _]", "未知", { diagCount: 0 }],
	["R110 の外：v : (gq 1) _（名前の右辺、§5 Q80）（前は G7）", r28(["v : (gq 1) _", "v"]), "v", "未知", { diagCount: 0 }],
	["R107 の外：(gq 1) 5（括った部分適用に後から当てる、§5 Q80）（前は G7）", r105("(gq 1) 5"), "(construct [gq 1] 5)", "未知", { diagCount: 0 }],
	["R107 の外：w : gq 1 ⏎ w 5（§5 Q80）（前は G7）", r105(["w : gq 1", "w 5"]), "(construct w 5)", "未知", { diagCount: 0 }],
	["移した (go _ 3) 5（`(go 3) 5` と同じ）（前は G7、その前は R68 のカリー化で `(apply [go _ 3] 5)` の未知）", std([...GO_DEFAULT, "(go _ 3) 5"]), "(construct [go _ 3] 5)", "未知", { diagCount: 0 }],
	// 片イ（R126）で G15 は廃止。木では `_` が消える予想（R126 の文面の `gd 1 2 _ 3` と同じ形。上の「R39」の節の同じ綴りの行と同じ答え）。
	["R105 の残り：go 1 2 _ 3（仮引数の外の内側の `_`）（前は G15）", std([...GO_DEFAULT, "go 1 2 _ 3"]), "(apply go (construct 1 2 3))", "未知", { diagCount: 0 }],
	// 片イ（R125）で G16 は廃止。R109 の空の List を畳む本体は `_` と bare-function-return（R125 の文面の例。前は G16）。
	["R109 fold $add []（前は G16）", r105("fold $add []"), "(apply fold (construct $add []))", "A", { severities: ["information/bare-function-return"] }],
];
const r105Refused = [
	// 評価する所の外の、種類の未知な項の後ろの `_` は今のまま G7（`_` を既定値と読めば埋まった値、消えると読めば部分適用で割れる。§5 Q80）
	// 既定値のある関数の部分適用の項（括り・名前）は今のまま種類が決まらない（§5 Q8・Q80）
	// この5行（G7）は、片イ（R120）で上の r105Passes の終わりへ移した。
	// R108 の外：ほかの点なしの形と `,` を付けた形は今のまま G7（§5 Q74）
	["R108 の外：根の (-_ _)", r105("(-_ _)"), "G7"],
	// 片イ（R119）から、`+ 1 _` は区間の後ろに項が並ぶので点なしの形ではなく、中置の左の被演算子が欠けた形として読む段で止める。
	["R108 の外：根の (+ 1 _)（前は G7、R119）", r105("(+ 1 _)"), "infix-missing-operand"],
	["R108 の外：[!_ _ ,] vs", r28("[!_ _ ,] vs"), "G7"],
	// 書いた `_` の門の残り：既定値のある関数の口が数えられない所（G15）と、既定値のある関数から作った穴の関数の穴の外（G5）
	// G15 の `go 1 2 _ 3` は、片イ（R126）で上の r105Passes の終わりへ移した。
	["R105 の残り：(go !_ 2) 1 _ 5（穴を全部埋めた後ろの `_`）", std([...GO_DEFAULT, "(go !_ 2) 1 _ 5"]), "G5"],
	// R109：空の List を畳む本体（今のまま G16。言い分は下の r105Messages）。片イ（R125）で上の r105Passes の終わりへ移した。
];
for (const [name, s, want, kind, extra] of r105Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r105Refused) checkRefused(name, s, want, inst);
// 片イ（R125・R126）で G16・G15 は廃止したので、R109 の G16 の言い分の3行（`fold $add []`・`g16 []`・`k7 [1]`）と G15 の言い分の1行（`go 1 2 _ 3`）は外した。
// 今の bare-function-return の文面には、R109 の「空は `_` と書く」の案内は無い（空の List でも同じ文面）。
const r105Messages = [
	["R105 の残りの G5 は穴の外を言う（(go !_ 2) 1 _ 5）", std([...GO_DEFAULT, "(go !_ 2) 1 _ 5"]), "G5", ["穴を全部埋めた後ろに書いた `_`", "§4 R39", "§4 R105", "§5 Q8"], ["カリー化"]],
];
for (const [name, s, gateId, must, mustNot] of r105Messages) {
	total++;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if (e.gate === gateId && !missing.length && !extra.length) ok(`言い分 ${name}`);
		else fail(`言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}

// ---------------------------------------------------------------------------
// 片9 の確かめの直し（2026-10-28）：R110 は適用の結果と分かる項だけ・評価する所の `,` の解き直しを R76 の所にも
// ---------------------------------------------------------------------------
// R110 の R の所「種類の決まらない項は適用の結果なので、何も受けていない既定値だけの関数の値には当たらない」は、`@$名前`（持ち上げを下ろした、指す関数そのもの）で
// 崩れる：`gf : [y : 1] ? y` の `@$gf _` は、`_` を消せば何も受けない gf（R107 で埋めない、§5 Q80 (c)）、既定値の口に当てれば `gf _` の 1 で、値が割れる。
// 最初の版は通していた（HEAD は G7）。R110 を、中が適用の括り・右辺が適用の名前（と、それを中身・右辺に持つ括り・名前）の後ろだけに狭め、ほかは HEAD の G7 に戻した。
// 評価する所の `,`：根の `,` が恒等射か書いた `_` で消えて残った並びは根として解く（R107 の R の所）が、比べ・論理の被演算子と2行以上の手続きの本体の行
// （R76 の所）では解き直していなかった。`gq 1 , !_ == 2` が埋めない木、`gq 1 == 2` が埋めた木と割れていた（余ったラムダの `add 1 , !_ == 2` と `add 1 == 2` は
// HEAD から割れていた）。法則12 にも比べ・論理の被演算子の包みを足した。
const GF9C = "gf : [y : 1] ? y"; // 既定値の口だけの関数（上の R39 の節の GF とは別）
const r9cPasses = [
	["R110 右辺が適用の名前を右辺に持つ名前：w2 : gq 1 ⏎ w : w2 ⏎ w _ は w", r105(["w2 : gq 1", "w : w2", "w _"]), "w", "未知"],
	["R110 右辺が括った適用の名前：w : (gq 1) ⏎ w _ は w", r105(["w : (gq 1)", "w _"]), "w", "未知"],
	["R110 論理の被演算子：1 & (gq 1) _", r105("1 & (gq 1) _"), "(& 1 [gq 1])", "未知"],
	["R76 の `,`：gq 1 , !_ == 2 は gq 1 == 2 と同じく埋める（前は `(apply gq 1)`）", r105("gq 1 , !_ == 2"), "(== (apply gq (construct 1 _)) 2)", "未知"],
	["R76 の `,`：!_ , gq 1 == 2 も同じ（前は `(apply gq 1)`）", r105("!_ , gq 1 == 2"), "(== (apply gq (construct 1 _)) 2)", "未知"],
	["R76 の `,`：1 & gq 1 , _ も埋める（書いた `_` も `,` の単位、R61。前は `(apply gq 1)`）", r105("1 & gq 1 , _"), "(& 1 (apply gq (construct 1 _)))", "未知"],
	["R76 の `,`：add 1 , !_ == 2 は add 1 == 2 と同じ余ったラムダ（HEAD から割れていた）", r105("add 1 , !_ == 2"), "(== (unit (apply add 1)) 2)", "A", { leftoverDiag: ["(apply add 1)"] }],
	["R76 の `,`：手続きの行 add 1 , !_ も add 1 の行と同じく知らせる（前は知らせなかった）", r105(["t : a ?", "\tadd 1 , !_", "\ta", "", "t 1"]), "(apply t 1)", "A", { leftoverDiag: ["(apply add 1)"] }],
	["R76 の `,` の外：_ , !_ == 1 は今のまま `_`（残る側も単位になりうる綴りは `,` として解く、R71）", r105("_ , !_ == 1"), "(== _ 1)", "A"],
	// 片イ（R120）で種類の未知な項の G7 は廃止（§5 Q80 を閉じた）。適用の結果と分からない項の後ろの `_` は、頭が種類の未知な項で後ろが1項なので当てる予想
	// （R120 の文面の `@$gf _` は `(apply @$gf _)`、値は 1）で通る（前は G7）。
	["R110 の外：@$gf _（何も受けていない gf を指す、§5 Q80 (a)）（前は G7、最初の版は通していた）", r105([GF9C,"@$gf _"]), "(apply @$gf _)", "未知", { diagCount: 0 }],
	["R110 の外：(@$gf) _（§5 Q80 (a)）（前は G7）", r105([GF9C,"(@$gf) _"]), "(apply [@$gf] _)", "未知", { diagCount: 0 }],
	["R110 の外：w : @$gf ⏎ w _（§5 Q80 (a)）（前は G7）", r105([GF9C,"w : @$gf", "w _"]), "(apply w _)", "未知", { diagCount: 0 }],
	["R110 の外：@$gf _ == 1（比べの被演算子でも、§5 Q80 (a)）（前は G7）", r105([GF9C,"@$gf _ == 1"]), "(== (apply @$gf _) 1)", "未知", { diagCount: 0 }],
	["R110 の外：1 & @$gf _（論理の被演算子でも、§5 Q80 (a)）（前は G7）", r105([GF9C,"1 & @$gf _"]), "(& 1 (apply @$gf _))", "未知", { diagCount: 0 }],
	["R110 の外：@$inc _（割れない形も同じ）（前は G7、HEAD と同じ）", r105("@$inc _"), "(apply @$inc _)", "未知", { diagCount: 0 }],
	["R110 の外：||gq 1|| _（囲みは見ない）（前は G7、HEAD と同じ）", r105("||gq 1|| _"), "(apply ||gq 1|| _)", "未知", { diagCount: 0 }],
];
const r9cRefused = [
	// R110 の外の7行（G7）は、片イ（R120）で上の r9cPasses の終わりへ移した。
	["R76 の `,` の外：!_ , i == 1 は今のまま G7（残る側が恒等射の綴り、R44）", r105("!_ , i == 1"), "G7"],
];
for (const [name, s, want, kind, extra] of r9cPasses) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r9cRefused) checkRefused(name, s, want, inst);
// 片イ（R120）で R110 の外の G7 は廃止したので、その言い分の2行（`@$gf _`・`[(gq 1) _]`）は外した。
const r9cMessages = [];
for (const [name, s, gateId, must, mustNot] of r9cMessages) {
	total++;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if (e.gate === gateId && !missing.length && !extra.length) ok(`言い分 ${name}`);
		else fail(`言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}

// ---------------------------------------------------------------------------
// R111〜R116（2026-10-28 の片9b。未定義の名前は `_`・値の口に着いた `_` と分かる名前と括りは書いた `_` と同じ・`x : _` は書かなかったことと同じ・
// 既定値に書いた `_` の仮引数は断る・無い欄は `_`・`#` の右の被演算子は評価する所）
// ---------------------------------------------------------------------------
// 出どころ（sid 58a809c9 は 2026-10-27、sid 444eeb3c は 2026-10-15。U の時刻は UTC）：U [13:44]「…un : _ / と / 定義しない no / は / no = un / が成り立つことを
// 考慮すれば答えは自明だと思う。」、U [14:02]「…「定義が無い」という事と、「解が無い」という事は、同値関係に当たる。」、U [14:06]「…使われればどちらも _ だね」、
// U [14:07]「つまり、 / un : _ / は書かなかったことに出来る。」、U [15:48]「…un : _ / は書かなかったことと同じ。」。主の Claude の問いへのボタンの答え（文は主の Claude の物）：
// U〔答え〕[14:49]「席を取らないでいい。x : _ はどこでも書かなかったことにして、外の x が見えてしまう所だけ information で知らせる。片9 に入れて。」、
// U〔答え〕[14:49]「それでいい。既定値の [y : _] は [~rest : _] と同じく断って、y か [y] と書くよう案内する。片9 に入れて。」、U〔答え〕[15:21] の後半「…値の口では un も
// 未定義の名前も書いた _ と同じ形で、(inc un) 5 は 6。参照の口は R90 のまま。片9 に入れて。」、U〔答え〕[15:59]「…書いた・名前・計算の _ は値の口でどれも同じ。穴は !_ だけ。…」、
// U〔答え〕[12:54]「A でいい。p # inc の inc は評価する所で _ になって、知らせて $inc を案内する。」。10-15 の U〔答え〕[23:16]「nop : _ を書いてなくても、 nop を表現できる
// ことにもなる。undefinedなら _ だからだ。」。欄の読み（`[s : _]` は `[]`・無い欄は `_`）は主の Claude の 14:46・14:50 UTC の文（R）。
// 期待値の木は、同じ位置に書いた `_` の綴りの答え（法則42〜44 が期待値を書かずに両側を比べる）。値の後ろに関数を置いた字面は足さない（R47）。
const R111D = ["sub : x y ? x - y", "mx : a [b] ? a", "fq : [a b c] ? a", "pb2 : [a] [b] ? a", "gq : x [y : 1] ? x + y", "e0 : []", "q : [_]", "e6 : ~_", "e8 : ~[]", "cc : (_ , _)", "has : [a s] ? s"];
const r111 = (lines) => std([...R111D, ...[].concat(lines)]);
const BOX = ["box : 0", "pp : $box"]; // `#` の左（書き込む先の番地）。`$box` は R100 の警告を出す
const OB = ["ob :", "\ta : 1", "\tb : 2", ""]; // 欄 a・b の構造体
const r111Passes = [
	// R111・R112：値の口の未定義の名前と `_` と分かる名前は、同じ位置に書いた `_` と同じ（決定の例）
	["R112 un : _ ⏎ sub un 1 2 は `sub 1 2`（値は -1。前は `(construct (apply sub (construct un 1)) 2)`）", r111(["un : _", "sub un 1 2"]), "(apply sub (construct 1 2))", "A", { diagCount: 0 }],
	["R111・R112 sub no 1 2 も `sub 1 2`（no は未定義の名前。知らせは今のまま）", r111("sub no 1 2"), "(apply sub (construct 1 2))", "A", { diag: "no", diagCount: 1 }],
	["R112 un : _ ⏎ (inc un) 5 は `(inc _) 5` と同じ（値は 6。前は `(construct [inc un] 5)`）", r111(["un : _", "(inc un) 5"]), "(apply [inc un] 5)", "A", { diagCount: 0 }],
	["R111・R112 (inc no) 5 も同じ", r111("(inc no) 5"), "(apply [inc no] 5)", "A", { diag: "no" }],
	["R112 inc no 5 は `inc 5`", r111("inc no 5"), "(apply inc 5)", "A", { diag: "no" }],
	["R112 mx no 1 は `mx 1`（括りの関数の裸の口）", r111("mx no 1"), "(unit (apply mx 1))", "A", { diag: "no", leftoverDiag: ["(apply mx 1)"] }],
	["R112 gq no 2 は `gq 2`（既定値のある関数の既定値の無い口。根なので R107 で埋める）", r111("gq no 2"), "(apply gq (construct 2 _))", "未知", { diag: "no" }],
	["R112 gq 1 no は既定値（既定値のある口、R39。葉の綴りは書いたまま）", r111("gq 1 no"), "(apply gq (construct 1 no))", "未知", { diag: "no" }],
	["R112 `_` と分かる名前 inc e0 5（e0 : []）は `inc 5`", r111("inc e0 5"), "(apply inc 5)", "A", { diagCount: 0 }],
	["R112 inc q 5（q : [_]）", r111("inc q 5"), "(apply inc 5)", "A", { diagCount: 0 }],
	["R112 inc e6 5（e6 : ~_）", r111("inc e6 5"), "(apply inc 5)", "A", { diagCount: 0 }],
	["R112 inc e8 5（e8 : ~[]）", r111("inc e8 5"), "(apply inc 5)", "A", { diagCount: 0 }],
	["R112 inc cc 5（cc : (_ , _)。R61 で `_` に縮む積の名前）", r111("inc cc 5"), "(apply inc 5)", "A", { diagCount: 0 }],
	["R112 inc [no] 5（名前を括った物）", r111("inc [no] 5"), "(apply inc 5)", "A", { diag: "no" }],
	["R112 inc ~no 5（前置 `~` で持ち上げた物、R79）", r111("inc ~no 5"), "(apply inc 5)", "A", { diag: "no" }],
	["R112 inc (_ , _) 5 は `inc 5`（§5 Q82 を閉じた。前は閉じた1つの値で `(construct (apply inc [_ , _]) 5)`）", r111("inc (_ , _) 5"), "(apply inc 5)", "A", { diagCount: 0 }],
	["R112 w : no ⏎ inc w 5（`:` はメタ）", r111(["w : no", "inc w 5"]), "(apply inc 5)", "A", { diag: "no" }],
	// R112 の根の読み：評価する所の値の隣の未定義の名前
	["R112 根の no 5 は `_ 5` と同じ 5（前は `(construct no 5)`）", r111("no 5"), "5", "A", { diag: "no" }],
	["R112 根の 5 no は 5", r111("5 no"), "5", "A", { diag: "no" }],
	["R112 w : no ⏎ w 5 は 5（右辺が未定義の名前1つの名前）", r111(["w : no", "w 5"]), "5", "A", { diag: "no" }],
	["R112 v : _ , !_ ⏎ v 3 は 3（右辺が単位律で書いた `_` に縮む名前。`v : _` と同じ、法則12）", r111(["v : _ , !_", "v 3"]), "3", "A", { diagCount: 0 }],
	["R112 の根の読みの外：根の e0 5 は `[] 5` と同じく消えない（R94 の線）", r111("e0 5"), "(construct e0 5)", "A"],
	// 値の口でない所は今のまま（§5 Q83）
	["R112 の外：参照の口の fq no は `fq un` と同じ A（R90）", r111("fq no"), "(apply fq no)", "A", { diag: "no" }],
	["R112 の外：参照の口の pb2 no 1 は a が no で席を取る（R65・R90）", r111("pb2 no 1"), "(apply pb2 (construct no 1))", "A", { diag: "no" }],
	["R112 の外：`,` の被演算子の no , 5（R61 の R の所、§5 Q83）", r111("no , 5"), "(, no 5)", "A", { diag: "no" }],
	["R112 の外：括りの中の値の隣 [no 5]（§5 Q83）", r111("[no 5]"), "[no 5]", "A", { diag: "no" }],
	["R112 の外：名前の右辺の値の隣 w : no 5（§5 Q83）", r111(["w : no 5", "w"]), "(: w (construct no 5))", "A", { diag: "no", at: -2 }],
	// R111：`$no`・撒く所
	["R111 $no は `$un` と同じ零射の番地（R100 の警告を出さない。前は値を読む参照で警告）", r111("$no"), "$no", "A", { diag: "no", diagCount: 1 }],
	["R111 inc no~ は `inc _` と同じ（no~ は長さ 0 の流れ、R84。前は未知）", r111("inc no~"), "(unit inc)", "A", { diag: "no", leftoverDiag: ["inc"] }],
	// 計算の `_` は今のまま（R106 の値の段、§5 Q79）。U [2026-10-27 23:01 438d5b1a]「例えば、 sub (4 < 6) 1 2 であれば 3 2 と積まれるべきだね。」
	["R106 sub (4 < 6) 1 2 は `(sub (4 < 6) 1) 2`（木は今のまま。値は 3 と 2 が積まれる）", r111("sub (4 < 6) 1 2"), "(construct (apply sub (construct [4 < 6] 1)) 2)", "A", { diagCount: 0 }],
	// R113：`x : _` は書かなかったことと同じ
	["R113 zz : _ ⏎ zz : 5 ⏎ inc zz は zz が 5（前は name-duplicate）", r111(["zz : _", "zz : 5", "inc zz"]), "(apply inc zz)", "A", { diagCount: 0 }],
	["R113 zz : 5 ⏎ zz : _ ⏎ inc zz（順を逆にしても同じ）", r111(["zz : 5", "zz : _", "inc zz"]), "(apply inc zz)", "A", { diagCount: 0 }],
	["R113 zz : _ ⏎ zz : _ ⏎ inc zz は zz が未定義の名前（知らせは出さない）", r111(["zz : _", "zz : _", "inc zz"]), "(unit inc)", "A", { leftoverDiag: ["inc"] }],
	["R113 x : _ ⏎ g2 : x ? x + 1 ⏎ g2 2 は仮引数の隠しにならない（前は name-shadow）", r111(["x : _", "g2 : x ? x + 1", "g2 2"]), "(apply g2 2)", "A", { diagCount: 0 }],
	// 2026-11-04 の寄せ1（R128・R129）：本体の `⇥x : _` は枝で、値が書いた `_` なので消えて次へ進み、何も定義しない（細目5）。外の名前を隠さないので、本体の
	// erased-unit-shadow は無い（構造体の欄の分は残る、下の fix9bPasses）。R113 は本体にも当たる（「枝の無い本体と構造体に限る」を外した）。
	["R113 本体の zz : _ ⏎ zz : 3（寄せ1 から条件 zz の枝2つで、zz は未定義の名前。前は R80 の局所の定義1つ、その前は同じ範囲に2つで未知）", r111(["t : y ?", "\tzz : _", "\tzz : 3", "\tzz + y", "", "t 1"]), "(apply t 1)", "A", { diag: "zz", diagCount: 1 }],
	["R113 本体の y : _ は枝で消え、仮引数 y を隠さない（寄せ1 から知らせない。前は erased-unit-shadow）", r111(["t : y ?", "\ty : _", "\ty + 1", "", "t 1"]), "(: t (? [y] (block (: y _) (+ y 1))))", "A", { at: -2, diagCount: 0 }],
	// 条件の inc はファイルの関数で、評価する所に残った関数として `_`（細目4、leftover-lambda）。
	["R113 本体の inc : _ は枝で消え、ファイルの inc を隠さない（寄せ1 から条件の inc は `_` と leftover-lambda。前は erased-unit-shadow）", r111(["t : y ?", "\tinc : _", "\tinc y", "", "t 1"]), "(: t (? [y] (block (: (unit inc) _) (apply inc y))))", "A", { at: -2, severities: ["warning/leftover-lambda"] }],
	["R113 ファイルの zz : _ と本体の zz : 5 の枝（寄せ1 から `$zz` は零射の番地で警告なし。前は R80 の局所の 5 の持ち上げで警告、その前は G20）", r111(["zz : _", "t : y ?", "\tzz : 5", "\t$zz", "", "t 1"]), "(: t (? [y] (block (: zz 5) $zz)))", "A", { at: -2, diagCount: 0 }],
	["R113 枝のある本体の zz : _ も消える枝（寄せ1 の R129。前は R113 の外で今のまま、§5 Q10）", r111(["t : y ?", "\ty > 1 : 5", "\tzz : _", "\tzz", "", "t 1"]), "(: t (? [y] (block (: (> y 1) 5) (: zz _) zz)))", "A", { at: -2, diag: "zz", diagCount: 1 }],
	["R113 欄の [s : _] は `[]` と同じ（fq は R90 で A）", r111(["w : [s : _]", "fq w"]), "(apply fq w)", "A"],
	["R113 has [a : 1 ⏎ s : _] は `[a : 1]` と同じ実体（形 `{a:N}`。s は無い欄で `_`、R115）", r111(["has [a : 1", "\ts : _]"]), "(: has (? [[a s]] (inst {a:N} s)))", null, { at: STD.length + R111D.length - 1 }],
	["R113・R115 w : [a : 1 ⏎ s : _] ⏎ w ' s は `_`（印 zero の A）", r111(["w : [a : 1", "\ts : _]", "w ' s"]), "(' w s)", "A"],
	// 既定値が `_` と分かる括りの `[y : [_]]` は、片9b の確かめの直しで断る側に倒した（§5 Q84。下の「片9b の確かめの直し」の節）。
	// R115：無い欄は `_`
	["R115 構造体に無い名前（前は G7 で断っていた、R24）", src([...M, "a2 : [nope] ? nope 21", "a2 m"]), "(: a2 (? [[nope]] (inst {say:L other:N} (construct nope 21))))", null, { at: -2 }],
	["R115 [say ~r] ? (r ' say) 21 ⏎ b m（r に say は残らないので無い欄の `_`。前は G7）", src([...M, "b : [say ~r] ? (r ' say) 21", "b m"]), "(: b (? [[say ~r]] (inst {say:L other:N} (construct [r ' say] 21))))", null, { at: -2 }],
	["R115 ob ' c は `_`（印 zero の A。前は未知）", r111([...OB, "ob ' c"]), "(' ob c)", "A"],
	["R115・R112 inc (ob ' c) 5 は `inc 5`（前は G7）", r111([...OB, "inc (ob ' c) 5"]), "(apply inc 5)", "A"],
	["R115 書いた `_` を名前で引いても `_`（_ ' s）", r111("_ ' s"), "(' _ s)", "A"],
	["R115 [] ' s も `_`", r111("[] ' s"), "(' [] s)", "A"],
	["R115 未定義の名前 m の (m ' k) 5（前の G7 の行の綴り。m は `_`、m ' k は `_`）", r111("(m ' k) 5"), "(construct [m ' k] 5)", "A", { diag: "m" }],
	// R116：`#` の右の被演算子は評価する所
	["R116 pp # inc は `(# pp (unit inc))`（知らせて `$inc` を案内する。前は `(# pp inc)` の未知）", r111([...BOX, "pp # inc"]), "(# pp (unit inc))", "A", { leftoverDiag: ["inc"] }],
	["R116 pp # 5 は今のまま", r111([...BOX, "pp # 5"]), "(# pp 5)", "A"],
	["R116 pp # inc 5 は今のまま", r111([...BOX, "pp # inc 5"]), "(# pp (apply inc 5))", "A"],
	["R116 pp # $inc は今のまま", r111([...BOX, "pp # $inc"]), "(# pp $inc)", "A"],
	["R116 pp # gq 1 は評価する所なので R107 で埋める（前は部分適用）", r111([...BOX, "pp # gq 1"]), "(# pp (apply gq (construct 1 _)))", "未知"],
	["R116 pp # inc , !_ は pp # inc と同じ（評価する所の `,`）", r111([...BOX, "pp # inc , !_"]), "(# pp (unit inc))", "A", { leftoverDiag: ["inc"] }],
];
const r111Refused = [
	["R114 gz : x [y : _] ? x は G22", r111("gz : x [y : _] ? x"), "G22"],
	["R114 仮引数のブロックの y : _ も G22", r111(["gz :", "\t\tx", "\t\ty : _", "\t? x", ""]), "G22"],
	["R114 呼ばれない無名の関数 [x [y : _] ? x] も G22", r111("[x [y : _] ? x]"), "G22"],
	["R113 の外：取り込みのある範囲の zz : _ は消すと未知（取り込み先の zz が見えうる、§5 Q10。前は `_` と分かる値で通った）", r111(["io@", "zz : _", "inc zz"]), "G7"],
];
for (const [name, s, want, kind, extra] of r111Passes) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of r111Refused) checkRefused(name, s, want, inst);
const r111Messages = [
	["R114 の G22 は `y` と `[y]` を案内する", r111("gz : x [y : _] ? x"), "G22", ["`[y : _]`", "既定値に書いた `_`", "`[~rest : _]` と同じく断ります", "`y`（値の口）", "`[y]`（参照の口）", "§4 R114"], ["`[x ~xs]`"]],
];
for (const [name, s, gateId, must, mustNot] of r111Messages) {
	total++;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if (e.gate === gateId && !missing.length && !extra.length) ok(`言い分 ${name}`);
		else fail(`言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}
// 知らせの文面（断らない所）
const r111Notes = [
	["R111 undefined-name の文面は「定義が無い名前は `_`」と R111 を言う", r111("sub no 1 2"), "undefined-name", ["定義が無い名前は `_`", "§4 R21・R111"]],
	// 「R113 erased-unit-shadow の文面は外の名前が見えることと R113 を言う」（本体の `⇥y : _`）は、2026-11-04 の寄せ1（R128・R129）で本体の erased-unit-shadow が
	// 無くなったので外した。構造体の欄の文面は下の fix9bNotes で見る。
	["R116 `#` の右に残った関数の知らせは `$inc` を案内する", r111([...BOX, "pp # inc"]), "leftover-lambda", ["書き込み `#` の右の被演算子", "`$inc`", "§4 R42・R48・R116"]],
];
for (const [name, s, reason, must] of r111Notes) {
	total++;
	try {
		const r = resolve(s);
		const d = r.diagnostics.find((x) => x.reason === reason);
		const missing = d ? must.filter((w) => !d.message.includes(w)) : must;
		if (d && !missing.length) ok(`知らせ ${name}`);
		else fail(`知らせ ${name}`, d ? `無い語: ${missing.join("・")}` : `${reason} が出ていない`, JSON.stringify(r.diagnostics));
	} catch (e) {
		fail(`知らせ ${name}`, `断られた: ${e.reason} ${e.gate || ""} ${e.message}`);
	}
}

// ---------------------------------------------------------------------------
// 片9b の確かめの直し（2026-10-28。確かめる2人の指摘と、片9a の直しの確かめの指摘を、片9b の作業木で走らせて本当だった物。§7.51 の「確かめの直し」と
// 「片9a の直しの確かめ」）
// ---------------------------------------------------------------------------
// 期待値の木は、比べる相手の綴り（名前を挟まずに書いた綴り・欄を消した綴り・`wz` の綴り・`i , !_` の綴り）の答え。値の後ろに関数を置いた字面は足さない（R47）。
const GF9 = ["w : gq 1", "gf : [y : 1] ? y"]; // 片9a の R110 の見本：ファイルの値の定義の w（適用の結果）と、既定値だけの関数 gf
const fix9bPasses = [
	// R112・R115：名前を挟んでも印 zero を持ち越す（`:` はメタ。valueOfRoot の zeroOf(root.kind)）。前は名前で印が落ち、直に書いた綴りと割れていた。
	["確かめ w : ob ' c ⏎ inc w 5 は inc (ob ' c) 5 と同じ `inc 5`（前は `(construct (apply inc w) 5)`）", r111([...OB, "w : ob ' c", "inc w 5"]), "(apply inc 5)", "A"],
	["確かめ w : ob ' c ⏎ $w は `$(ob ' c)` と同じ零射の番地で警告なし（前は値を読む参照で警告）", r111([...OB, "w : ob ' c", "$w"]), "$w", "A", { diagCount: 0 }],
	["確かめ w : $5 ' 1 ⏎ inc w 5 は `inc ($5 ' 1) 5` と同じ `inc 5`（R102 の領域の外の `_`。警告は `$5` の1つ）", r111(["w : $5 ' 1", "inc w 5"]), "(apply inc 5)", "A", { severities: ["warning/dollar-non-function"] }],
	["確かめ w : ob ' c ⏎ w ' d は `(ob ' c) ' d` と同じ `_`（前は未知）", r111([...OB, "w : ob ' c", "w ' d"]), "(' w d)", "A"],
	// R113 の欄：消すのは書いた行で見て、括りの中の名前にも外の範囲の名前にも数えない
	["確かめ ob : [a : s ⏎ s : _] ⏎ inc (ob ' a) 5 は `ob : [a : s]` と同じ `inc 5`（前は s が括りの中の名前で G7）", r111(["ob : [a : s", "\ts : _]", "inc (ob ' a) 5"]), "(apply inc 5)", "A"],
	["確かめ has [a : s ⏎ s : _] は `has [a : s]` と同じ A（前は未知）", r111(["has [a : s", "\ts : _]"]), "(apply has [a : s ⏎ s : _])", "A"],
	["確かめ ob : [s : _ , _ ⏎ s : 5] の `s : _ , _` は消えない（同じ名前の欄が2つで ob ' s は未知。前は消えて A）", r111(["ob : [s : _ , _", "\ts : 5]", "ob ' s"]), "(' ob s)", "未知"],
	// 2026-11-04 の寄せ1（R128）で本体の `⇥s : 5`・`⇥ob : [...]` は枝になり、外の局所の名前にならない。外の局所の名前の残る所（外の構造体のブロックの欄）で見る
	// （前の綴りは `t : y ?` ⏎ `⇥s : 5` ⏎ `⇥ob : [a : s ⏎ s : _]` ⏎ `⇥ob ' a` で、R80 の局所の定義 s が外の名前だった）。
	["確かめ 外の局所の s が見える欄の s : _ は知らせる（erased-unit-shadow。外は構造体のブロックの欄 s。前は括りの中の名前で未知）", r111(["w :", "\ts : 5", "\tob : [a : s", "\t\ts : _]", "", "inc ((w ' ob) ' a)"]), "(apply inc [[w ' ob] ' a])", "A", { severities: ["information/erased-unit-shadow"] }],
	["確かめ 同じ括りに s : 3 の欄が残る s : _ は知らせない（括りの中の s はその欄で、外は見えない）", r111(["w :", "\ts : 5", "\tob : [s : _", "\t\ts : 3]", "", "(w ' ob) ' s"]), "(' [w ' ob] s)", "A", { diagCount: 0 }],
	// 寄せ1 から `⇥ob : [...]` は条件 ob（未定義の名前）の枝なので、undefined-name の ob だけが出る（erased-unit-shadow は出ない）。
	["確かめ 仮引数の s と同じ名前の欄の s : _ は知らせない（仮引数の名前は前から括りの中の名前に数えない）", r111(["t : s ?", "\tob : [a : s", "\t\ts : _]", "\tob ' a", "", "t 1"]), "(apply t 1)", "A", { diag: "ob", severities: ["information/undefined-name"] }],
	["確かめ 本体の中の has [s : _] の s は本体の局所の名前に数えない（`has []` と同じく s は未定義の名前。前は未知）", r111(["t : y ?", "\thas [s : _]", "\ts", "", "t 1"]), "(apply t 1)", "A", { diag: "s" }],
	// R114 と §5 Q84 の外は今のまま
	["確かめ Q84 の外：既定値がこの関数の仮引数の [y : x] は既定値のある口", r111(["gz : x [y : x] ? x + y", "gz 5"]), "(apply gz (construct 5 _))", "未知"],
	["確かめ Q84 の外：既定値が数の名前の [y : fv]（fv : 5）", r111(["fv : 5", "gz : x [y : fv] ? x + y", "gz 5"]), "(apply gz (construct 5 _))", "未知"],
	["確かめ Q84 の外：取り込みのある範囲の [y : no] は no が未知なので今のまま（§5 Q10）", r111(["io@", "gz : x [y : no] ? x + y", "gz 5"]), "(apply gz (construct 5 _))", "未知"],
	["確かめ Q84 の外：既定値が `!_` の [y : !_] は今のまま", r111(["gz : x [y : !_] ? x + y", "gz 5"]), "(apply gz (construct 5 _))", "未知"],
	// 片9a の直しの確かめ：R110 の「適用の結果と分かる項」に、枝の無い本体の局所の定義（R80）も入る（法則27）。→ 2026-11-04 の寄せ1（R128）で R80 と法則27 は
	// 廃止。本体の `⇥wl : gq 1` ⏎ `⇥wl _` ⏎ `⇥a` は、最後の枝の後に裸の行が2つの本体で R130 の断り（下の fix9bRefused）。ファイルの `wl : gq 1` の形は今のまま通る。
	["片9a 確かめ ファイルの wl : gq 1 ⏎ 本体の wl _ ⏎ a（前は本体の局所の定義の比べの相手）", r111(["wl : gq 1", "t : a ?", "\twl _", "\ta", "", "t 1"]), "(apply t 1)", "未知"],
	// 片9a の直しの確かめ：`(!_ _)` は R108 で恒等射なので、`,` の単位の解き方は名前の恒等射 i と同じ
	["片9a 確かめ (!_ _) , i == 2 は `i , i == 2` と同じ（どちらも名前の側の恒等射が残る）", r111(["i : !_", "(!_ _) , i == 2"]), "(== i 2)", "未知"],
	// 片イ（R125）で G16 は廃止。名前を挟んでも本体の根の裸の関数は `inc (ob ' c)` と同じく `_` と bare-function-return（前は G16）。
	// 寄せ1（R128）から `⇥w : ob ' c` は条件 w（未定義の名前）の枝で、`inc w` は `inc _` と同じ（w は名前を挟まない）。返す所の inc は bare-function-return。
	["確かめ g2 : y ? ⏎ w : ob ' c ⏎ inc w は `inc (ob ' c)` の本体と同じ（寄せ1 から w は未定義の名前。前は G16、その前は名前1つ挟むと通った）", r111([...OB, "g2 : y ?", "\tw : ob ' c", "\tinc w", "", "g2 1"]), "(apply g2 1)", "A", { severities: ["information/bare-function-return", "information/undefined-name"] }],
	// 片イ（R120）で種類の未知な項の G7 は廃止。外の名前を隠す行の無い本体の局所の wz は局所の定義として読めるので、`wz _` は通った（前は G7）。
	// 片イ（R120）：外の名前を隠しうる行のある本体の w は R120 の例外（局所の名前）に入らず、ファイルの定義で読んだ（§5 Q85 (h)）。
	// → 2026-11-04 の寄せ1（R128）で、この2つの3行の本体（`⇥wz : @$gf` ⏎ `⇥wz _` ⏎ `⇥a`・`⇥w : @$gf` ⏎ `⇥w _` ⏎ `⇥a`）は最後の枝の後に裸の行が2つで R130 の断り
	// （下の fix9bRefused）。§5 Q85 (h) は閉じた（細目8）：`⇥w : @$gf` は条件 w の枝で名前を隠さないので、2行の本体 `⇥w : @$gf` ⏎ `⇥w _` の w はファイルの w で、
	// 既定の行 `w _` は1行の本体 `t : a ? w _` と同じ `(apply w _)`。
	["寄せ1 Q85 (h) 本体の w : @$gf ⏎ w _ の w はファイルの w（既定の行は `t : a ? w _` と同じ `(apply w _)`）", r111([...GF9, "t : a ?", "\tw : @$gf", "\tw _", "", "t 1"]), "(: t (? [a] (block (: w @$gf) (apply w _))))", "A", { at: -2, diagCount: 0 }],
	["寄せ1 Q85 (h) その比べの相手（1行の t : a ? w _）", r111([...GF9, "t : a ? w _", "t 1"]), "(: t (? [a] (apply w _)))", "A", { at: -2, diagCount: 0 }],
	["寄せ1 Q85 (h) その t 1 は1行の本体と同じ未知", r111([...GF9, "t : a ?", "\tw : @$gf", "\tw _", "", "t 1"]), "(apply t 1)", "未知", { diagCount: 0 }],
];
const fix9bRefused = [
	// R114：括りを重ねた既定値の括りと、仮引数のブロックの括りの行（[x] ≅ x。解決器も既定値の口に数える）
	["確かめ R114 gz : x [[y : _]] ? x + y（括りを重ねた既定値の括り）も G22（前は既定値のある口で通った）", r111(["gz : x [[y : _]] ? x + y", "gz 5"]), "G22"],
	["確かめ R114 丸い括りの ([y : _]) も G22", r111("gz : x ([y : _]) ? x"), "G22"],
	["確かめ R114 仮引数のブロックの括りの行 [y : _] も G22", r111(["gz :", "\t\tx", "\t\t[y : _]", "\t? x", ""]), "G22"],
	// §5 Q84：既定値が書いた `_` でない `_` と分かる値なら、断る側に倒す
	["確かめ Q84 既定値が未定義の名前の [y : no] は G22（前は既定値のある口）", r111("gz : x [y : no] ? x"), "G22"],
	["確かめ Q84 [y : un]（un : _ は R113 で未定義の名前）", r111(["un : _", "gz : x [y : un] ? x"]), "G22"],
	["確かめ Q84 w : no ⏎ [y : w]（右辺が未定義の名前1つの名前）", r111(["w : no", "gz : x [y : w] ? x"]), "G22"],
	["確かめ Q84 [y : e0]（e0 : []）", r111("gz : x [y : e0] ? x"), "G22"],
	["確かめ Q84 [y : [_]]（前の片9b の行は今のまま通していた）", r111(["gz : x [y : [_]] ? x", "gz 1"]), "G22"],
	["確かめ Q84 [y : []]", r111("gz : x [y : []] ? x"), "G22"],
	["確かめ Q84 [y : _~]（R84 の空の流れ）", r111("gz : x [y : _~] ? x"), "G22"],
	["確かめ Q84 [y : _ , _]（R61 で `_` に縮む積）", r111("gz : x [y : _ , _] ? x"), "G22"],
	["確かめ Q84 仮引数のブロックの y : no の行", r111(["gz :", "\t\tx", "\t\ty : no", "\t? x", ""]), "G22"],
	// R112・R115：名前を挟んでも本体の根の G16 は抜けない。片イ（R125）で G16 は廃止し、この行は上の fix9bPasses の終わりへ移した。
	// 片9a の直しの確かめの、本体の行が外の名前を隠しうる `w _`（前は G7）と比べの相手の `wz _` は、片イ（R120、§5 Q85 (h)）で通る側へ移した。
	// 2026-11-04 の寄せ1（R130）：その2行と本体の局所の `wl _`（法則27 の族）は、最後の枝の後に裸の行が2つ（`w _` と `a`）の本体で、最初の裸の行を名指しして断る。
	["寄せ1 R130 本体の wl : gq 1 ⏎ wl _ ⏎ a（前は R80 で通った、法則27）", r111(["t : a ?", "\twl : gq 1", "\twl _", "\ta", "", "t 1"]), "body-bare-row-between"],
	["寄せ1 R130 本体の wz : @$gf ⏎ wz _ ⏎ a（前は通った、その前は G7）", r111([...GF9, "t : a ?", "\twz : @$gf", "\twz _", "\ta", "", "t 1"]), "body-bare-row-between"],
	["寄せ1 R130 本体の w : @$gf ⏎ w _ ⏎ a（前は §5 Q85 (h) でファイルの定義で読んで通った、その前は G7）", r111([...GF9, "t : a ?", "\tw : @$gf", "\tw _", "\ta", "", "t 1"]), "body-bare-row-between"],
	// 片9a の直しの確かめ：`(!_ _)` を `,` の単位に数える（i と同じく、恒等射×恒等射は断る側の `!_`）
	["片9a 確かめ (!_ _) , !_ == 2 は `i , !_ == 2` と同じ G7（前は通った）", r111("(!_ _) , !_ == 2"), "G7"],
	["片9a 確かめ その比べの相手 i , !_ == 2", r111(["i : !_", "i , !_ == 2"]), "G7"],
	["片9a 確かめ 1 & (!_ _) , !_ も G7", r111("1 & (!_ _) , !_"), "G7"],
	// 片9a の直しの確かめ：手続きの行の `,` が恒等射どうしで `!_` に縮めば、`!_` の行と同じ G7
	["片9a 確かめ 手続きの行の !_ , !_ は `!_` の行と同じ G7（前は `(block !_ a)` で通った）", r111(["t : a ?", "\t!_ , !_", "\ta", "", "t 1"]), "G7"],
	["片9a 確かめ 手続きの行の i , !_ も G7", r111(["i : !_", "t : a ?", "\ti , !_", "\ta", "", "t 1"]), "G7"],
	["片9a 確かめ 手続きの行の (!_ _) , !_ も G7", r111(["t : a ?", "\t(!_ _) , !_", "\ta", "", "t 1"]), "G7"],
];
for (const [name, s, want, kind, extra] of fix9bPasses) checkPass(name, s, want, kind, extra);
for (const [name, s, want, inst] of fix9bRefused) checkRefused(name, s, want, inst);
const fix9bMessages = [
	["確かめ Q84 の G22 は Q84 を名指しして `y` と `[y]` を案内する", r111("gz : x [y : no] ? x"), "G22", ["`[y : no]`", "既定値 `no`", "`_` と分かる値", "§4 R114", "§5 Q84", "`y`（値の口）", "`[y]`（参照の口）"], ["`[~rest : _]` と同じく断ります"]],
	["確かめ R114 の括りを重ねた綴りも R114 の言い分", r111("gz : x [[y : _]] ? x"), "G22", ["`[[y : _]]`", "既定値に書いた `_`", "§4 R114"], ["§5 Q84"]],
];
for (const [name, s, gateId, must, mustNot] of fix9bMessages) {
	total++;
	try {
		resolve(s);
		fail(`言い分 ${name}`, "断るはずが通った");
	} catch (e) {
		const missing = must.filter((w) => !String(e.message).includes(w));
		const extra = mustNot.filter((w) => String(e.message).includes(w));
		if (e.gate === gateId && !missing.length && !extra.length) ok(`言い分 ${name}`);
		else fail(`言い分 ${name}`, `gate: ${e.gate}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
	}
}
const fix9bNotes = [
	// 2026-11-04 の寄せ1（R128）から、外の局所の名前は外の構造体のブロックの欄で見る（前は本体の `⇥s : 5`、R80 の局所の定義）。
	["確かめ 欄の erased-unit-shadow の文面は外の局所の名前を指すことと R113 を言う", r111(["w :", "\ts : 5", "\tob : [a : s", "\t\ts : _]", "", "inc ((w ' ob) ' a)"]), "erased-unit-shadow", ["構造体の欄 `s : _`", "書かなかったのと同じ", "外の `s`（外の局所の名前）", "§4 R113"]],
];
for (const [name, s, reason, must] of fix9bNotes) {
	total++;
	try {
		const r = resolve(s);
		const d = r.diagnostics.find((x) => x.reason === reason);
		const missing = d ? must.filter((w) => !d.message.includes(w)) : must;
		if (d && !missing.length) ok(`知らせ ${name}`);
		else fail(`知らせ ${name}`, d ? `無い語: ${missing.join("・")}` : `${reason} が出ていない`, JSON.stringify(r.diagnostics));
	} catch (e) {
		fail(`知らせ ${name}`, `断られた: ${e.reason} ${e.gate || ""} ${e.message}`);
	}
}

// 片イの確かめの直し（2026-11-03、確かめる人2人の指摘）。
// (1) 読む段の断り（R119）の理由ごとの試験：比べの連鎖と名前でない仮引数は1本も無かった。使う所の `#` と名前でない仮引数は、既定値の中と枝の条件まで見る
// （前は通った。HEAD も通っていた）。
const readStagePasses = [
	["R119 括らない3項の `<` の連鎖は通る（木は今のまま、median は値の段）", src(["1 < 2 < 3"]), "(< (< 1 2) 3)", "A"],
	["R119 括らない3項の `>` の連鎖も通る", src(["3 > 2 > 1"]), "(> (> 3 2) 1)", "A"],
	["R119 括った比べは葉で、連鎖に数えない", src(["(1 < 2) < 3"]), "(< [1 < 2] 3)", "A"],
	["R119 定義する名前の `#` は公開の印で止めない", src(["#zq : 5", "zq + 1"]), "(+ zq 1)", "A"],
	["R119 構造体の欄の名前の `#` も止めない", src(["s :", "\t#a : 1", "\tb : 2", "", "s ' a"]), "(' s a)", "未知"],
];
const readStageRefused = [
	["R119 4項の比べの連鎖", src(["1 < 2 < 3 < 4"]), "compare-chain"],
	["R119 向きの揃わない比べの連鎖", src(["5 > 0 < 10"]), "compare-chain"],
	["R119 `==` を混ぜた比べの連鎖", src(["1 == 2 < 3"]), "compare-chain"],
	["R119 `<=` の連鎖（§5 Q85 (a)）", src(["1 <= 2 <= 3"]), "compare-chain"],
	["R119 `=` の連鎖（向きの無い比べ）", src(["1 = 2 = 3"]), "compare-chain"],
	["R119 `!=` の連鎖", src(["1 != 2 != 3"]), "compare-chain"],
	["R119 `!==` の連鎖", src(["1 !== 2 !== 3"]), "compare-chain"],
	["R119 名前でない仮引数", src(["g : x 3 ? x"]), "param-not-name"],
	["R119 本体のブロックの中の関数の名前でない仮引数", src(["t : y ?", "\tz : 1", "\tg : x 3 ? x", "\tg y", "", "t 1"]), "param-not-name"],
	["R119 既定値の中の関数の名前でない仮引数（前は通った）", src(["p : x [z : [w : x 3 ? x]] ? x"]), "param-not-name"],
	["R119 既定値の中の使う所の `#`（前は通った）", src(["zq : 5", "p : x [z : #zq] ? x + z"]), "export-mark-position"],
	["R119 仮引数のブロックの既定値の使う所の `#`（前は通った）", src(["zq : 5", "p :", "\t\tx", "\t\tz : #zq", "\t? x", ""]), "export-mark-position"],
	["R119 枝の条件（名前でない1項の `:` の左）の使う所の `#`（前は通った）", src(["zq : 5", "t : y ?", "\t(#zq 1) : 1", "\t2", "", "t 1"]), "export-mark-position"],
];
for (const [name, s, want, kind, extra] of readStagePasses) checkPass(name, s, want, kind, extra);
for (const [name, s, want] of readStageRefused) checkRefused(name, s, want);

// (2) 断りの元の行（R127）：断りの e.line を見る試験が無かった。括りの中の行・字下げのブロックの行は、読む段のどの理由もその中の行（前は `#` と名前でない仮引数
// だけ外の行を名指しし、比べの連鎖などは中の行で割れていた）。解決器の門は解いていた行（括りの関数の実体の中は呼んだ行、素の関数を前もって解く所は定義の行）。
const refusalLines = [
	["いちばん外の行", src(["a : 1", "b : 1 < 2 < 3 < 4"]), "compare-chain", 2],
	["空行とコメントの行の後も元の行", src(["a : 1", "", "`メモ", "b : 1 < 2 < 3 < 4"]), "compare-chain", 4],
	["続きの行に分かれた式は書き始めの行", src(["x : 1", "y : 1 <", " 2 < 3 < 4"]), "compare-chain", 2],
	["字下げのブロックの行の比べの連鎖はその行", src(["t : y ?", "\tz : 1", "\tz < 2 < 3 < 4", "", "t 1"]), "compare-chain", 3],
	["字下げのブロックの行の使う所の `#` もその行（前は定義の行）", src(["zq : 5", "t : y ?", "\tz : 1", "\t#zq y", "", "t 1"]), "export-mark-position", 4],
	["括りの中の行の使う所の `#` もその行（前は括りの書き始めの行）", src(["zq : 5", "w : [1", "#zq]"]), "export-mark-position", 3],
	["字下げのブロックの行の名前でない仮引数もその行（前は定義の行）", src(["t : y ?", "\tz : 1", "\tg : x 3 ? x", "\tg y", "", "t 1"]), "param-not-name", 3],
	["仮引数のブロックの既定値の `#` はその行", src(["zq : 5", "p :", "\t\tx", "\t\tz : #zq", "\t? x", ""]), "export-mark-position", 4],
	["閉じていない文字列は前処理が読んでいた行", src(["a : 1", "b : `abc"]), "SyntaxError", 2],
	["前処理の字下げの断りは読んでいた行", src(["k : 7", "k", "\t1 2"]), "block-after-value", 3],
	["P2 は定義の行", src(["a : 1", "f : x x ? x"]), "name-duplicate", 2],
	["括りの関数の実体の中の門は呼んだ行", src(["inc : x ? x + 1", "p : [x ~xs] ? q x", "q : [y] ? $y == $y", "", "p [(inc 5) (inc 5)]"]), "G21", 5],
	// 2026-11-04 の寄せ1（R128）から枝の条件は1項でも解いて実体を作るので、条件から括りの関数を呼ぶ形の G7 は無くなった（前の行は `(t [1 2]) : 1` の G7 line 3）。
	// 実体の本体の門（G5）も、前もって解く素の関数の定義の行。G7 の残る既定値の中も同じ。
	["枝の条件から括りの関数を呼んで実体の門に当たる G5 は、前もって解く素の関数の定義の行（寄せ1。前は G7）", src(["bad : [y] ? [[g5] ? g5] !_ 1", "u : x ?", "\t(bad [x]) : 1", "\t2", ""]), "G5", 2],
	["仮引数のブロックの既定値から括りの関数を呼ぶ G7 は、前もって解く素の関数の定義の行", src(["inc : x ? x + 1", "t : [a ~r] ? 5 inc 3 inc", "o :", "\t\tx : t [1 2]", "\t? 5", ""]), "G7", 3],
	// 再確かめ（2026-11-03）：仮引数のブロックの行の名前でない仮引数も、その行（前は `p :` の定義の行で、同じブロックの既定値の行の断りと割れた）。
	["仮引数のブロックの行の名前でない仮引数はその行（前は定義の行）", src(["a : 1", "p :", "\t\tx", "\t\t3", "\t? x", ""]), "param-not-name", 4],
	["本体のブロックの中の仮引数のブロックの行もその行", src(["t : y ?", "\tp :", "\t\t\tx", "\t\t\t3", "\t\t? x", "\tp y", "", "t 1"]), "param-not-name", 4],
];
for (const [name, s, want, line] of refusalLines) {
	total++;
	const e = refusalOfSrc(s);
	const got = !e ? "通った" : `${e.gate || e.reason || e.name} line ${e.line}`;
	if (e && (e.gate === want || e.reason === want || e.name === want) && e.line === line) ok(`行 ${name} → ${want} line ${line}`);
	else fail(`行 ${name}`, `got: ${got}  want: ${want} line ${line}`, e ? String(e.message) : "");
}

// (3) 読みの決まらない名前（R120 の例外）に、名前の読みを種類に持ち越す印（後置 `~`・前置 `@`・`'` の左）を付けた項も G7（§5 Q85 (k)。前は種類の未知な項として
// 通った。HEAD は G7 か G6）。値の印（`-w`・`!w`・`||w||`）は読みに依らず値か `_` なので通る（§5 Q85 (i)）。
// 2026-11-04 の寄せ1（R128）で関数の本体の行は枝になり、本体の名前は読みが決まる（前の UW は `t : y ?` ⏎ `⇥w : inc` ⏎ `⇥w : 6` ⏎ `⇥行` で、w は R80 の局所の
// 定義として読めない名前だった）。読みの決まらない名前に残るのは、括りと構造体のブロックの行の名前（local-field）と取り込みのある範囲の名前なので、同じ行を
// 関数の本体でない字下げのブロック（`ob :` のブロック。w は欄かもしれない名前）に置いて見る。答えは前の UW と同じ（通る行は ob の定義の行の木で見る）。
const UW = (row) => src(["inc : x ? x + 1", "ob :", "\tw : inc", "\tw : 6", `\t${row}`, "", "ob"]);
const undecidedMarkPasses = [
	["Q85 (i) 値の印の -w 2 は通る", UW("-w 2"), "(: ob (block (: w inc) (: w 6) (construct -w 2)))", null, { at: -2 }],
	["Q85 (i) !w 2 も通る", UW("!w 2"), "(: ob (block (: w inc) (: w 6) (construct !w 2)))", null, { at: -2 }],
	["Q85 (i) ||w|| 2 も通る", UW("||w|| 2"), "(: ob (block (: w inc) (: w 6) (construct ||w|| 2)))", null, { at: -2 }],
	["Q85 (k) 1項の w~ は並びでないので通る", UW("w~"), "(: ob (block (: w inc) (: w 6) w~))", null, { at: -2 }],
	// 寄せ1（R128）から本体の `⇥w : 2` は枝で、`w~ 2` の w は未定義の名前（読みは決まっている）。前は R80 の局所の定義で読みが決まっていた。
	["Q85 (k) 読みの決まった w の w~ 2 は通る（寄せ1 から w は未定義の名前）", src(["t : y ?", "\tw : 2", "\tw~ 2", "", "t 1"]), "(apply t 1)", "A"],
];
const undecidedMarkRefused = [
	["Q85 (k) w~ 2", UW("w~ 2"), "G7"],
	["Q85 (k) (w ' 0) 2", UW("(w ' 0) 2"), "G7"],
	["Q85 (k) inc @w 5（HEAD は G6）", UW("inc @w 5"), "G7"],
	["Q85 (k) 1行の括りの [w~] 2", UW("[w~] 2"), "G7"],
	["Q85 (k) 取り込みのある範囲の a~ 5", src(["io@", "a~ 5"]), "G7"],
	["Q85 (k) 取り込みのある範囲の 5 @a（HEAD は G6）", src(["io@", "5 @a"]), "G7"],
	["Q85 (k) 取り込みのある範囲の a ' 0 5", src(["io@", "a ' 0 5"]), "G7"],
	// 再確かめ（2026-11-03）：前置 `~`（`~w` は書いた `[w]` と同じ項、R79）と印の付いた括り（`@[w]` は `@w`、R82）は G7 の形と同じ項（前は通った。HEAD は G7 か G6 で、
	// 頭の位置の `@(w) 5` は HEAD でも通った）。
	["Q85 (k) 前置の ~w 2（HEAD は G7）", UW("~w 2"), "G7"],
	["Q85 (k) inc ~w（HEAD は G7）", UW("inc ~w"), "G7"],
	["Q85 (k) inc @[w] 5（HEAD は G6）", UW("inc @[w] 5"), "G7"],
	["Q85 (k) 頭の @(w) 5（HEAD は通った）", UW("@(w) 5"), "G7"],
	["Q85 (k) 20 段の括りの [[…w…]] 2（上限 16 の版は通った、HEAD は G7）", UW(`${"[".repeat(20)}w${"]".repeat(20)} 2`), "G7"],
	["Q85 (k) 取り込みのある範囲の ~a 5", src(["io@", "~a 5"]), "G7"],
	["Q85 (k) 取り込みのある範囲の 5 @[a]（HEAD は G6）", src(["io@", "5 @[a]"]), "G7"],
	// 印の組み合わせ・中置 `@` の左・印の付いた括りの中の持ち越す形は、答えが名指ししていない所で断る側に倒した（HEAD も G7 か G6。§5 Q85 (k)）。
	["Q85 (k) 断る側 @w~ 2", UW("@w~ 2"), "G7"],
	["Q85 (k) 断る側 w~~ 2", UW("w~~ 2"), "G7"],
	["Q85 (k) 断る側 (w @ 0) 2", UW("(w @ 0) 2"), "G7"],
	["Q85 (k) 断る側 inc @[w ' 0] 5", UW("inc @[w ' 0] 5"), "G7"],
	["Q85 (k) 断る側 @@w 2", UW("@@w 2"), "G7"],
	["Q85 (k) 断る側 ~@w 2", UW("~@w 2"), "G7"],
	["Q85 (k) 断る側 inc @(w~) 5", UW("inc @(w~) 5"), "G7"],
	// 2回目の再確かめ（2026-11-03）：`@$w` も組み合わせ（`$w`・`@($w)` は G20 なのに、種類の未知な項で通っていた。HEAD は G7）。
	["Q85 (k) 断る側 @$w 2", UW("@$w 2"), "G7"],
	["Q85 (k) 断る側 inc @$w 5", UW("inc @$w 5"), "G7"],
	["Q85 (k) 断る側 取り込みのある範囲の @$a 5", src(["io@", "@$a 5"]), "G7"],
	["Q85 (k) `$w 2` は今のまま G20", UW("$w 2"), "G20"],
];
undecidedMarkPasses.push(
	["Q85 (k) 読みの決まった vs の ~vs 2 は通る", src(["vs : 1 2", "t : y ?", "\t~vs 2", "", "t 1"]), "(apply t 1)", "A"],
	["Q85 (k) 読みの決まった v の inc @[v] 5 は通る", src(["inc : x ? x + 1", "v : $inc", "t : y ?", "\tinc @[v] 5", "", "t 1"]), "(apply t 1)", "A"],
	["Q85 (k) 読みの決まった vs の vs~~ 2 は種類の未知な項で通る（R120）", src(["vs : 1 2", "t : y ?", "\tvs~~ 2", "", "t 1"]), "(apply t 1)", "未知"]
);
for (const [name, s, want, kind, extra] of undecidedMarkPasses) checkPass(name, s, want, kind, extra);
for (const [name, s, want] of undecidedMarkRefused) checkRefused(name, s, want);

// (4) 読まない所（枝の条件・既定値）から、1行の括りに包んだ名前で括りの関数を呼ぶ形も G7（2026-11-03 の再確かめ。HEAD から通り、本体の G5 が黙って消えた。
// [x] ≅ x で、読む所に置けば `bad [x]` と同じく実体を作って G5）。
// 2026-11-04 の寄せ1（R128）から枝の条件は1項でも `&` の左と同じに解く（読む所）ので、枝の条件の形は包んでも実体を作って G5（§5 Q85 (j) の枝の条件の分が
// 閉じた。前は G7）。既定値の中は今のまま読まない所で G7（Q85 (j) の残り）。
const BAD_G5 = "bad : [y] ? [[g5] ? g5] !_ 1";
const unreadWrapped = [
	["F3 枝の条件の ([bad] [x]) : 1（寄せ1 から G5。前は G7）", src([BAD_G5, "u : x ?", "\t([bad] [x]) : 1", "\t2", "", "u 1"]), "G5"],
	["F3 枝の条件の ((bad) [x]) : 1（寄せ1 から G5。前は G7）", src([BAD_G5, "u : x ?", "\t((bad) [x]) : 1", "\t2", "", "u 1"]), "G5"],
	["F3 既定値の [bad] [1]", src([BAD_G5, "p : x [z : [bad] [1]] ? x", "p 1"]), "G7"],
	["F3 読む所の [bad] [x] : 1 は実体を作って G5", src([BAD_G5, "u : x ?", "\t[bad] [x] : 1", "\t2", "", "u 1"]), "G5"],
	// 2回目の再確かめ（2026-11-03）：前置 `~` だけの項（`~x` は `[x]`、R79）と、上限 16 を超える入れ子も同じ。
	["F3 枝の条件の (~bad [x]) : 1（寄せ1 から G5。前は G7）", src([BAD_G5, "u : x ?", "\t(~bad [x]) : 1", "\t2", "", "u 1"]), "G5"],
	["F3 枝の条件の (~[bad] [x]) : 1（寄せ1 から G5。前は G7）", src([BAD_G5, "u : x ?", "\t(~[bad] [x]) : 1", "\t2", "", "u 1"]), "G5"],
	["F3 既定値の ~bad [1]", src([BAD_G5, "p : x [z : ~bad [1]] ? x", "p 1"]), "G7"],
	["F3 既定値の [~bad] [1]", src([BAD_G5, "p : x [z : [~bad] [1]] ? x", "p 1"]), "G7"],
	["F3 枝の条件の 20 段の括りの名前（寄せ1 から G5。前は G7）", src([BAD_G5, "u : x ?", `\t(${"[".repeat(20)}bad${"]".repeat(20)} [x]) : 1`, "\t2", "", "u 1"]), "G5"],
	["F3 読む所の ~bad [x] : 1 は実体を作って G5", src([BAD_G5, "u : x ?", "\t~bad [x] : 1", "\t2", "", "u 1"]), "G5"],
];
for (const [name, s, want] of unreadWrapped) checkRefused(name, s, want);

// ---------------------------------------------------------------------------
// 寄せ1 の R130（2026-11-04。U〔答え〕「入って」で承認した文面。出どころは戻7（11-01、09-28 の match_case §5 と問2「ファイルごと止める」））
// ---------------------------------------------------------------------------
// 枝のある本体（R128 で本体の字下げの `:` の行は左が何でも枝）で、裸の行を置けるのは最後の1行（既定の行）だけ。枝の前か間に裸の行がある本体と、既定の行が
// 2つ以上ある本体は、読む段でファイルごと止め、最初に当たった裸の行を名指しする（reason は body-bare-row-between、元の行は R127）。枝の値のブロック（括らない、
// 枝の行の下の字下げのブロック）にも同じ規則が当たる（細目1・6）。`x : _` の行も枝の行に数える（R129、右辺の中身で本体の形を変えない）。枝の無いブロックは
// 手続き（R76）で、今のまま通る。括りの中の行と構造体のブロックの行は欄なので当たらない。
const r130Lines = [
	["枝の前の裸の行", src(["t : x ?", "\tx + 1", "\tx > 0 : 1", "\t2", "", "t 1"]), "body-bare-row-between", 2],
	["枝の間の裸の行", src(["t : x ?", "\tx > 0 : 1", "\tx + 1", "\tx < 0 : 2", "\t3", "", "t 1"]), "body-bare-row-between", 3],
	["最後の枝の後の裸の行2つ（最初の裸の行を名指す）", src(["t : x ?", "\tx > 0 : 1", "\tx + 1", "\tx", "", "t 1"]), "body-bare-row-between", 3],
	["最後の枝の後の裸の行3つも最初の裸の行", src(["t : x ?", "\tx > 0 : 1", "\tx + 1", "\tx", "\tx", "", "t 1"]), "body-bare-row-between", 3],
	["左が名前1つの枝（R128）の後の裸の行2つ", src(["t : x ?", "\ty : 1", "\tx", "\tx", "", "t 1"]), "body-bare-row-between", 3],
	["左が名前1つの枝（R128）の前の裸の行", src(["t : x ?", "\tx", "\ty : 1", "\tx", "", "t 1"]), "body-bare-row-between", 2],
	["`x : _` の行も枝の行に数える（R129）", src(["t : y ?", "\tzz : _", "\ty", "\ty", "", "t 1"]), "body-bare-row-between", 3],
	["枝の値のブロックの中の枝の前の裸の行", src(["t : x ?", "\tx > 0 :", "\t\tx + 1", "\t\tx > 5 : 1", "\t\t2", "\t3", "", "t 1"]), "body-bare-row-between", 3],
	["枝の値のブロックの中の最後の枝の後の裸の行2つ", src(["t : x ?", "\tx > 0 :", "\t\tx > 5 : 1", "\t\tx", "\t\t2", "\t3", "", "t 1"]), "body-bare-row-between", 4],
	["枝の値に置いた関数の本体の中も同じ", src(["t : x ?", "\tg : y ?", "\t\ty", "\t\tz : 1", "\t\ty", "\tx", "", "t 1"]), "body-bare-row-between", 3],
	// 呼ばない括りの関数の本体も、素の関数と同じく定義の行で止める（R119 の線。確かめ2人目の変異 M5 が素通りした所の守り）。
	["呼ばない括りの関数の本体の枝の前の裸の行", src(["bf : [a] ?", "\tinc a", "\ta > 0 : 1", "\t0", ""]), "body-bare-row-between", 2],
	// 案内の example.sn の「コンストラクタのような記述」を括らずに書いた形。括らない本体なので `@etc : x` は枝（R128）で、前の裸の行2つが R130 に当たる
	// （寄せ1 の前も木は `(block name age (: @etc x))` で、構造体ではなかった）。構造体を返すなら括る（下の bracketBodyPasses の Person）。
	["括らないコンストラクタの本体（構造体にならない）", src(["Person : name age etc x ?", "\tname", "\tage", "\t@etc : x", "", "john : Person `john` 18 $`Like` `Sushi`"]), "body-bare-row-between", 2],
];
for (const [name, s, want, line] of r130Lines) {
	total++;
	const e = refusalOfSrc(s);
	const got = !e ? "通った" : `${e.gate || e.reason || e.name} line ${e.line}`;
	if (e && e.reason === want && e.line === line) ok(`R130 ${name} → ${want} line ${line}`);
	else fail(`R130 ${name}`, `got: ${got}  want: ${want} line ${line}`, e ? String(e.message) : "");
}
const r130Passes = [
	// 枝の無い本体は手続き（R76）で、裸の行がいくつあっても今のまま通る。
	["枝の無い本体の手続きの行3つは通る", src(["t : x ?", "\tx + 1", "\tx * 2", "\tx", "", "t 1"]), "(apply t 1)", "A"],
	["枝と既定の行1つは通る", src(["t : x ?", "\tx > 0 : 1", "\tx < 0 : 2", "\t3", "", "t 1"]), "(apply t 1)", "A"],
	["既定の行の無い枝だけの本体も通る", src(["t : x ?", "\tx > 0 : 1", "\tx < 0 : 2", "", "t 1"]), "(apply t 1)", "A"],
	["枝の無い枝の値のブロックは手続きで通る", src(["t : x ?", "\tx > 0 :", "\t\tx + 1", "\t\tx", "\t3", "", "t 1"]), "(apply t 1)", "A"],
	// 構造体のブロックと括りの行は欄（細目2）で、R130 は当たらない。いちばん外の行も本体ではない。
	["構造体のブロックの行の混ざり（ob : ⏎ w : 1 ⏎ 5 ⏎ 6）は当たらない", src(["ob :", "\tw : 1", "\t5", "\t6", "", "ob"]), "ob", "A"],
	["括りの行の混ざり（[y : 1 ⏎ x ⏎ z : 2 ⏎ x]）は当たらない", src(["t : x ? [y : 1", "x", "z : 2", "x]", "t 1"]), "(apply t 1)", "A"],
	["いちばん外の行の混ざりは当たらない", src(["a : 1", "a", "b : 2", "b"]), "b", "A"],
	// R128 の文面の例（値は interpret.test.js）：`⇥y : x + 1` は条件 y（未定義の名前で `_`）の枝、`⇥sq : z ? z * z` は条件 sq の枝で値は返す所の裸の関数。
	["R128 の例 pr : x ? ⏎ y : x + 1 ⏎ y * 2 の本体（y は未定義の名前）", src(["pr : x ?", "\ty : x + 1", "\ty * 2", "", "pr 3"]), "(: pr (? [x] (block (: y (+ x 1)) (* y 2))))", "A", { at: 0, diag: "y", diagCount: 1 }],
	["R128 の例 t : x ? ⏎ sq : z ? z * z ⏎ sq x の本体", src(["t : x ?", "\tsq : z ? z * z", "\tsq x", "", "t 3"]), "(: t (? [x] (block (: sq (unit (? [z] (* z z)))) (construct sq x))))", "A", { at: 0, diag: "sq", severities: ["information/bare-function-return", "information/undefined-name"] }],
	// 条件は `&` の左と同じに解く（P3 を変えた）：仮引数・ファイルの値・ファイルの関数（細目4 で `_`、leftover-lambda）・未定義の名前（undefined-name）。
	["R128 条件が仮引数・ファイルの値・ファイルの関数・未定義の名前", src(["inc : x ? x + 1", "five : 5", "t : x ?", "\tx : 1", "\tfive : 2", "\tinc : 3", "\tno : 4", "\t5", "", "t 1"]), "(: t (? [x] (block (: x 1) (: five 2) (: (unit inc) 3) (: no 4) 5)))", "A", { at: 2, diag: "no", leftoverDiag: ["inc"], diagCount: 2 }],
];
for (const [name, s, want, kind, extra] of r130Passes) checkPass(`寄せ1 ${name}`, s, want, kind, extra);
const r130Messages = [
	["枝の前か間の裸の行は、その行と R130 を言う", src(["t : x ?", "\tx > 0 : 1", "\tx + 1", "\tx < 0 : 2", "\t3", "", "t 1"]), ["`x + 1`", "枝の前か間", "最後の1行（既定の行）だけ", "§4 R130"], ["既定の行が2つ以上"]],
	["既定の行が2つ以上なら、そう言う", src(["t : x ?", "\tx > 0 : 1", "\tx + 1", "\tx", "", "t 1"]), ["`x + 1`", "既定の行が2つ以上", "§4 R130"], ["枝の前か間"]],
];
for (const [name, s, must, mustNot] of r130Messages) {
	total++;
	const e = refusalOfSrc(s);
	if (!e) {
		fail(`言い分 R130 ${name}`, "断るはずが通った");
		continue;
	}
	const missing = must.filter((w) => !String(e.message).includes(w));
	const extra = mustNot.filter((w) => String(e.message).includes(w));
	if (e.reason === "body-bare-row-between" && !missing.length && !extra.length) ok(`言い分 R130 ${name}`);
	else fail(`言い分 R130 ${name}`, `reason: ${e.reason}`, `無い語: ${missing.join("・")}`, `余計な語: ${extra.join("・")}`, String(e.message));
}

// 寄せ1 の R128（細目3・4）：本体の枝の条件は1項でも `&` の左と同じに解くので、`&` の左で断る形は条件に書いても同じ断り（前は1項の条件を解かず、どれも通った）。
// 確かめ2人目の変異（M8・M9・M10）が素通りした所の守りで、比べる相手の `&` の形も並べる。
const yose1ConditionRefused = [
	["寄せ1 1項の条件の括らない !_ は G7（前は通った）", src(["t : x ?", "\t!_ : 1", "\t2", "", "t 1"]), "G7"],
	["寄せ1 比べる相手：`&` の左の括らない !_ は G7", src(["t : x ?", "\t(!_ & 1) | 2", "", "t 1"]), "G7"],
	["寄せ1 条件の番地の算術 $vs + 0x8 は G21（前は通った）", src(["vs : 1 , 2 , 3", "t : x ?", "\t$vs + 0x8 : 1", "\t2", "", "t 1"]), "G21"],
	["寄せ1 括った条件の番地の算術 ($vs + 0x8) は G21（前は通った）", src(["vs : 1 , 2 , 3", "t : x ?", "\t($vs + 0x8) : 1", "\t2", "", "t 1"]), "G21"],
	["寄せ1 条件の名前 p がファイルの番地の算術の値なら G21（前は R80 の局所の名前で通った）", src(["vs : 1 , 2 , 3", "p : $vs + 0x8", "t : x ?", "\tp : 1", "\t2", "", "t 1"]), "G21"],
	["寄せ1 比べる相手：`&` の左の番地の算術は G21", src(["vs : 1 , 2 , 3", "t : x ?", "\t(($vs + 0x8) & 1) | 2", "", "t 1"]), "G21"],
	["寄せ1 条件の使う所の #x は export-mark-position（前は通った）", src(["t : x ?", "\t#x : 5", "\t3", "", "t 1"]), "export-mark-position"],
	["寄せ1 比べる相手：`&` の左の #x は export-mark-position", src(["t : x ?", "\t(#x & 5) | 3", "", "t 1"]), "export-mark-position"],
];
for (const [name, s, want] of yose1ConditionRefused) checkRefused(name, s, want);

// 寄せ1 の R129 の代金：最後でない枝の値の裸の関数は「この枝は消えて次へ進みます」と言い、最後の枝と既定の行は今のまま「関数は `_` を返します」（R125）。
// 確かめ2人目の変異 M6（bareReturnUnit で最後でない枝を見ない）が素通りした所の守り。
{
	const bfrCases = [
		["最後でない枝2つと既定の行", src(["inc : x ? x + 1", "t : x ?", "\tx > 0 : inc", "\tx < 0 : inc", "\tinc", "", "t 1"]), 2, 1],
		["既定の行の無い本体の最後の枝は返す所", src(["inc : x ? x + 1", "t : x ?", "\tx > 0 : inc", "\tx < 0 : inc", "", "t 1"]), 1, 1],
	];
	for (const [name, s, goesOn, returns] of bfrCases) {
		total++;
		const msgs = resolve(s).diagnostics.filter((d) => d.reason === "bare-function-return").map((d) => d.message);
		const g = msgs.filter((m) => m.includes("この枝は消えて次へ進みます") && m.includes("R129")).length;
		const r = msgs.filter((m) => m.includes("関数は `_` を返します") && !m.includes("次へ進みます")).length;
		if (msgs.length === goesOn + returns && g === goesOn && r === returns) ok(`言い分 寄せ1 bare-function-return ${name}`);
		else fail(`言い分 寄せ1 bare-function-return ${name}`, `次へ ${g}/${goesOn}・返す ${r}/${returns}`, ...msgs);
	}
}

// 寄せ1 の R128 の外：括った関数の本体（`? [` ⏎ 字下げの行 ⏎ `]`）の行は枝でなく、返す構造体の欄（細目2。match_case.md「`?` 直後のトークンが Indent か `[` か
// でどちらの構文かを一意に判定する」、function_guide.md のフィールド名の省略記法）。木は括りのまま（`[…]`、枝の節 `(: c v)` を作らない）で、裸の行（省略記法）と
// `:` の行が混ざっても R130 に当たらない。値の段は器の片で「まだ」（interpret.test.js）。木は寄せ1 の前と同じ。利用者の問い（2026-11-04）「括った function body 内
// では、枝ではなく返すべき構造体の定義になる。これは大丈夫？」から足した守りで、前はこの形の試験が1本も無かった。
const bracketBodyPasses = [
	["括った本体の省略記法だけ（function_guide.md の f 1 2）", src(["f : x y ? [", "\tx", "\ty", "]", "", "f 1 2"]), "(: f (? [x y] [x ⏎ y]))"],
	["括った本体の省略記法と欄（裸の行が `:` の行の前）", src(["f : x y ? [", "\tx", "\tb : x + y", "]", "", "f 1 2"]), "(: f (? [x y] [x ⏎ b : x + y]))"],
	["括った本体の裸の行が `:` の行の前後に3つ（本体なら R130）", src(["f : x y ? [", "\tx", "\tb : x + y", "\ty", "\tx", "]", "", "f 1 2"]), "(: f (? [x y] [x ⏎ b : x + y ⏎ y ⏎ x]))"],
	["括った本体の欄だけ（match_case.md の Point）", src(["Point : x y ? [", "\tx : x", "\ty : y", "]", "", "Point 1 2"]), "(: Point (? [x y] [x : x ⏎ y : y]))"],
	["括った本体の欄が隣の欄を引く", src(["g : x ? [", "\ty : x + 1", "\tz : y * 2", "]", "", "g 1"]), "(: g (? [x] [y : x + 1 ⏎ z : y * 2]))"],
	["括った本体の欄の後ろに撒く行（list_model.md の set_foo）", src(["set_foo : v [~this] ? [", "\tfoo : v", "\tthis~", "]", "", "set_foo 1 [foo : 0]"]), "(: set_foo (? [v [~this]] (inst A {foo:N} [foo : v ⏎ this~])))"],
	["括った本体の欄の値に括りを入れ子（example.sn の regreet）", src(["regreet : [~this] ? [", "\tgreet : [", "\t\twelcome : `w`", "\t\t(this ' greet)~", "\t]", "\tworld : `m`", "\tthis~", "]", "", "regreet [greet : [hi : `h`]]"]), "(: regreet (? [[~this]] (inst {greet:{hi:[N…]}} [greet : [welcome : `w` ⏎ [this ' greet]~] ⏎ world : `m` ⏎ this~])))"],
	["括ったコンストラクタの本体（example.sn の Person を括った形）", src(["Person : name age etc x ? [", "\tname", "\tage", "\t@etc : x", "]", "", "john : Person `john` 18 $`Like` `Sushi`"]), "(: Person (? [name age etc x] [name ⏎ age ⏎ @etc : x]))"],
	["括った本体の比べを左に置いた行も欄の行（枝の節にしない）", src(["g : x ? [", "\tx > 0 : 1", "\ty : 2", "]", "", "g 1"]), "(: g (? [x] [x > 0 : 1 ⏎ y : 2]))"],
	["括らない本体の行に置いた括りの中の行は欄", src(["g : x ?", "\t[", "\t\ty : x + 1", "\t\tz : 2", "\t]", "", "g 1"]), "(: g (? [x] (block [y : x + 1 ⏎ z : 2])))"],
	["枝の値に置いた括りの中の行は欄（外の行は枝）", src(["g : x ?", "\tx > 0 : [", "\t\ty : x + 1", "\t\tz : 2", "\t]", "\t0", "", "g 1"]), "(: g (? [x] (block (: (> x 0) [y : x + 1 ⏎ z : 2]) 0)))"],
];
for (const [name, s, want] of bracketBodyPasses) checkPass(`寄せ1 ${name}`, s, want, null, { at: 0 });

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
