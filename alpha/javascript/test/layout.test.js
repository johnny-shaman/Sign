/**
 * 形の解決（Pass 3.5）——大きさとバイトオフセット。
 *
 * Pass 3 が型の**名前**を、`target_info.js` がスカラーの**幅**を出す。ここはその2つを
 * 合わせて「各スロットがどこに在るか」を確定させる。`compiler_pipeline.md` §3 が Pass 4 へ
 * 渡すと定めた情報の最後の一片である。
 *
 * 実行: node test/layout.test.js（`npm test` からも呼ばれる）
 */
import { compile } from "../compile.js";
import { measure, layoutOfStruct, alignUp, passingOf } from "../layout.js";

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
		console.log(`     got:  ${JSON.stringify(got)}`);
		console.log(`     want: ${JSON.stringify(want)}`);
	}
}

const A64 = { target: "aarch64_qemu", charset: "utf32" };

function rhs(source) {
	return compile(source).nodes[0].right;
}
function sizeOf(source, conf = A64) {
	const m = measure(rhs(source), conf);
	return m && m.size;
}
// スロットを `名前@オフセット`（連番なら `[n]@オフセット`）の並びにする。
function slotsOf(source, conf = A64) {
	const l = layoutOfStruct(rhs(source), conf);
	return l && l.slots.map((s) => `${s.name !== undefined ? s.name : `[${s.ordinal}]`}@${s.offset}`);
}

// ---- スカラー ----
check("Int は 8 byte", sizeOf("x : 42"), 8);
check("Float も 8 byte", sizeOf("x : 3.14"), 8);
check("Address も 8 byte", sizeOf("p : 0x40011000"), 8);
check("Unit は場所を占めない", sizeOf("u : __"), 0);

// ---- String は `List(0u)`。要素幅は charset が決める ----
check("utf32 なら 1文字 4 byte", sizeOf("s : `abc`"), 12);
check("ascii なら 1文字 1 byte", sizeOf("s : `abc`", { target: "aarch64_qemu", charset: "ascii" }), 3);
check("コードポイント単位で数える（サロゲートペアも1文字）", sizeOf("s : `𝄞`"), 4);

// ---- List は要素幅 × 個数 ----
check("整数3個なら 24 byte", sizeOf("l : [1 2 3]"), 24);
check("実数2個なら 16 byte", sizeOf("l : [1.0 2.0]"), 16);

// ---- 名前付きスロットは名前ソート順に並ぶ（stack_abi.md §7.1） ----
//
// `==` で等しい構造体が同じ物理配置を持つための規則である。宣言順は型が (型, 連番) の形で
// 別に保存しているので情報は失われない。**詰め込み効率のための並べ替えはしない**
// ——並びを決めるのは名前であって、コンパイラの裁量ではない。
check("名前順に並ぶ", slotsOf("p : [\n\tx : 1\n\ty : 2\n]"), ["x@0", "y@8"]);
check("宣言順が逆でも物理配置は名前順で同じ", slotsOf("p : [\n\ty : 2\n\tx : 1\n]"), ["x@0", "y@8"]);
// 宣言順と物理配置がねじれる例。宣言は CR→SR→DR だが、名前順では CR→DR→SR になる。
// ねじれ自体は型の側（`Struct{CR : Address , 0  DR : String , 2  SR : Int , 1}`）に保存される。
check(
	"ねじれてもオフセットは名前順で決まる",
	slotsOf("uart : [\n\tCR : 0x40011000\n\tSR : 3\n\tDR : `d`\n]"),
	["CR@0", "DR@8", "SR@16"]
);

// ---- 連番スロットは宣言順がそのまま物理配置 ----
//
// ソートの鍵となる名前が無いためである。MMIO・FFI・シリアライズはこちらで書く
// ——「N番目は offset N×幅」の確約が得られるのは連番スロットだけである（§7.1 の CAUTION）。
// 均質なカンマは `List` になるので、連番スロットの例は型が混ざるものを使う
// ——同一幅なら `base + i × stride` が書け、それは `List` の定義そのものである。
// **スロットに置かれるのは「運ぶ姿」である。** 多文字の ``String`` は ``{ptr, len}`` の 16 バイト
// で置かれる——中身を埋め込もうにも長さが型に無いので、そもそも埋め込めない。
//
// ここは長らく ``measure``（中身の長さ）から訊いていた。**リテラルのときだけ成功する**ので
// ```ab``` は 2 バイトと答え、レイアウトは次のスロットを 2 バイト目に置くのに、出す側は
// ptr と len の 16 バイトを書く——**次のスロットが ptr を踏み潰していた**。同じ事実を
// 二箇所が別々に決めていた形である。
check("宣言順に並ぶ", slotsOf("t : 1 , `ab` , 2.5"), ["[0]@0", "[1]@8", "[2]@24"]);
check("均質なカンマは List（ストライドで引ける）", sizeVia("t : 1 , 2 , 3"), 24);
check("型が混ざっても宣言順", slotsOf("t : 1 , `ab` , 2.5"), ["[0]@0", "[1]@8", "[2]@24"]);

// ---- アラインメントは自然境界 ----
//
// 各スロットは自分の幅の境界に置く。AArch64 の Device メモリ（MMIO）は境界を跨いだ
// アクセスでフォールトし、`ldp`/`stp` も境界を要求するため、詰めると動かない。
// 全体を境界へ切り上げるのは `List(Struct)` の各要素が同じ境界に載るためである
// ——ストライドが揃わないと `base + i × size` が壊れる。
const packed = { target: "aarch64_qemu", charset: "ascii" };
check("1 byte の次の 8 byte は境界まで送られる", slotsOf("m : [\n\ta : `x`\n\tb : 1\n]", packed), ["a@0", "b@8"]);
check("全体の大きさは最大境界へ切り上げる", measure(rhs("m : [\n\ta : `x`\n\tb : 1\n]"), packed).size, 16);
check("構造体の境界は最大スロットの境界", measure(rhs("m : [\n\ta : `x`\n\tb : 1\n]"), packed).align, 8);
check("alignUp の単体動作", [alignUp(0, 8), alignUp(1, 8), alignUp(8, 8), alignUp(9, 8)], [0, 8, 8, 16]);
// 要素のストライドも境界へ切り上がる（`List(Struct)` が壊れないため）。
check("List の stride は要素境界へ切り上げた大きさ", measure(rhs("l : [1 2 3]"), A64).stride, 8);

// ---- 決まらないものは null ----
//
// 幅が決まっていないターゲットではレイアウトも出せない。憶測で 0 や 8 を返すより、
// 「まだ決まっていない」と言う方が安全である（原理4 と同じ線引き）。
check("未対応ターゲットでは出せない", layoutOfStruct(rhs("p : [\n\tx : 1\n]"), { target: "cortex_m" }), null);
check("スカラーも同じ", measure(rhs("x : 42"), { target: "cortex_m" }), null);
check("Struct でないものに layoutOfStruct は null", layoutOfStruct(rhs("x : 42"), A64), null);

// ---- 規則裏打ち（レンジ）は要素を置かない ----
//
// list_model.md §2.3:「レンジ式は**リストに見えるだけ**であり、実体は常に
// `{start, step, end}` という固定サイズの構造体である」。置かれるのは要素ではなく規則で、
// したがって**大きさは要素数に依らない**。
//
// ここで `Iterator` と `List` の差がバイト単位で現れる——**差は `end` フィールド1つ**。
// 型が「`|.|` が答えられるか」で2つを分けているのと、レイアウトがフィールド1つで
// 分けているのが同じ線になっている。型と実体は別の話でありながら食い違っていない。
function reprOf(source, conf = A64) {
	const m = measure(rhs(source), conf);
	return m && m.repr;
}
function fieldsOf(source, conf = A64) {
	const { node, conf: c } = A64env(source);
	const m = measure(node, conf === A64 ? c : { ...c, ...conf });
	return m && m.fields && m.fields.map((f) => `${f.name}@${f.offset}`);
}
check("終端の無いレンジは {start, step}", fieldsOf("c : [0 ~+ 1]"), ["start@0", "step@8"]);
check("終端のあるレンジは {start, step, end}", fieldsOf("r : [1 ~ 5]"), ["start@0", "step@8", "end@16"]);
check("Iterator は 16 byte", sizeOf("c : [0 ~+ 1]"), 16);
check("List（規則裏打ち）は 24 byte", sizeOf("r : [1 ~ 5]"), 24);
// **大きさは要素数に依らない。** これが「展開しない」ということの意味である。
check("100万要素でも 24 byte のまま", sizeOf("r : [1 ~ 1000000]"), 24);
// 同じ値の並びでも、リテラルは要素が置かれるので要素数ぶんの場所を取る。
check("リテラルの [1 2 3 4 5] は 40 byte（要素が置かれる）", sizeOf("l : [1 2 3 4 5]"), 40);
check("リテラルの実体は要素の並び", reprOf("l : [1 2 3 4 5]"), "cells");
check("レンジの実体は規則", reprOf("r : [1 ~ 5]"), "rule");
// 添字はロードではなく算術になる（type_system.md §2 のアクセス表、`Iterator(T)` の行）。
check("規則裏打ちの添字は算術", measure(rhs("r : [1 ~ 5]"), A64).access, "start + i × step");
// 要素の幅はターゲットが決める。Float のレンジなら FPU 幅で並ぶ。
check("Float のレンジも同じ形", fieldsOf("f : [1.5 ~+ 0.5 ~ 9.0]"), ["start@0", "step@8", "end@16"]);

// ---- 名前・関数を経由しても形は決まる ----
//
// **名前は場所を持たない。** `s : r` の `s` が何バイト要るかは `r` にしか無く、
// それは識別子テーブルの中にある。ここを辿らないと名前を1つ挟んだだけで大きさが
// 出せず、Pass 4 は命令を選べない。
function A64env(source) {
	const { nodes, env } = compile(source);
	const node = nodes.filter((n) => n && n.type === "operation" && n.name === "define").pop().right;
	return { node, conf: { ...A64, env } };
}
function sizeVia(source) {
	const { node, conf } = A64env(source);
	const m = measure(node, conf);
	return m && m.size;
}
function sizeVia2(source, charset) {
	const { node, conf } = A64env(source);
	const m = measure(node, { ...conf, charset });
	return m && m.size;
}
function slotsVia(source) {
	const { node, conf } = A64env(source);
	const l = layoutOfStruct(node, conf);
	return l && l.slots.map((s) => `${s.name}@${s.offset}`);
}
function reprVia(source) {
	const { node, conf } = A64env(source);
	const m = measure(node, conf);
	return m && m.repr;
}
check("名前を1つ経由（レンジ）", sizeVia("r : [1 ~ 5]\ns : r"), 24);
check("名前を2つ経由", sizeVia("r : [1 ~ 5]\ns : r\nt : s"), 24);
check("名前を経由しても実体の種類は残る", reprVia("r : [1 ~ 5]\ns : r"), "rule");
check("名前を経由（リテラルのリスト）", sizeVia("l : [1 2 3]\ns : l"), 24);
check("名前を経由（構造体）", sizeVia("p : [\n\tx : 1\n\ty : 2.5\n]\np2 : p"), 16);
// 相互参照は解けないので諦める。無限に辿って落ちてはいけない。
check("循環する束縛でも止まる", sizeVia("a : b\nb : a"), null);
// 適用の結果は呼び先の返値である。返値の**ノード**を辿らないと大きさが出ない。
check("関数の戻り値を経由", sizeVia("f : _ ? [1 ~ 5]\ng : f __"), 24);

// **終端が実行時変数でも形は決まる**（list_model.md §2.3:「終端値 `n` が実行時変数で
// あっても静的型付け原則は完全に維持される——イテレータ構造体の型もサイズも、常に
// コンパイル時に確定している」）。規則裏打ちの大きさは要素数に依らないので、終端の
// 値が分からなくても `{start, step, end}` の形は変わらない。
check("終端が仮引数でも 24 byte", sizeVia("mk : n ? [1 ~ n]\ng : mk 5"), 24);
check("2段の関数越しでも決まる", sizeVia("mk : n ? [1 ~ n]\nvia : n ? mk n\ng : via 5"), 24);

// ---- 列は伸びても数えられる（String ≅ List(0u)） ----
//
// 文字列は余積で伸びる文字の列である（type_system.md §2）。両辺の長さが分かれば全体の
// 長さも分かる——`[1 2] 3` の要素数が数えられるのと同じことである。ここを数えないと
// 同型が片側だけ成立していることになる（型は `String` と言えるのに大きさが言えない）。
check("文字列の連結は足し算", sizeVia("s : `ab` `cd`"), 16);
check("名前を経由した連結", sizeVia("t : `hi`\ns : t `!`"), 12);
check("名前だけでも数えられる", sizeVia("t : `abc`\ns : t"), 12);
check("charset が1文字の幅を決める（ascii なら1 byte）", sizeVia2("s : `ab` `cd`", "ascii"), 4);
// List も同じ規則で伸びる。pass2 が空白の解決結果として出す4つの名前
// （construct / concat / push / unshift）は、どれも「1段の中で列が伸びる」ことを言っている。
check("push で伸びた List", sizeVia("l : [1 2] 3"), 24);
check("unshift で伸びた List", sizeVia("l : 0 [1 2]"), 24);
check("名前を経由した余積", sizeVia("a : [1 2]\nb : [3 4]\nl : a b"), 32);
// **長さが実行時に決まるものは決まらないと言う。** 嘘の数を返してはいけない
// ——場所を先に取れない値は参照として渡すしかない（return_value_addressing.md）。
check("実行時に伸びる連結は決まらない", sizeVia("f : x ? x `!`\ng : f `hi`"), null);
// マージの結果もレイアウトを持つ（list_model.md §5.3）。元の宣言は2つ以上の構造体へ
// 散っているので並べられるのは畳んだ後のスロットだけだが、物理配置の規則は変わらない
// ——名前順である（stack_abi.md §7.1）。マージで作ったかどうかは配置に影響しない。
// **鍵の違う器を1つにまとめる綴りは、いまのところ無い。** `q~ r~` は q の器へ入れる形
// なので、r にしか無い鍵があれば q の型が変わる——それは弾く（下の節）。だから「新しい器」
// の側は、書いた行と撒く行を並べたブロックで書く。
//
// **構造体だけが上書きの道を持つ理由**は実測にある: 在る器へ書くのは 2スロットでも
// 8スロットでも 13 命令・確保ゼロ（O(1)）だが、新しい器は 15 → 28 命令・写しが
// スロット数ぶん要る（O(スロット数)）。リストは長さが型に無いので merge の結果を
// 遅延できる（実装もまだ実体化しない）が、構造体は名前で引くのに並びがいま要るので
// 遅延する先が無い。だから在る場所へ書く道が要る。
check("撒いてまとめても名前順に並ぶ", slotsVia("q : [\n\ty : 2.5\n]\ns : [\n\tx : 1\n\tq~\n]"), ["x@0", "y@8"]);
check("撒いてまとめた器の大きさ", sizeVia("q : [\n\ty : 2.5\n]\ns : [\n\tx : 1\n\tq~\n]"), 16);

// ---- 鍵が増えるマージは**弾く**（層の話ではない） ----
//
// `p~ [ zzz : 1 ]~` は「p の器へ入れる」形だが鍵が1本増える。増えると p の**型が変わる**。
// 名前はプログラムの語彙であり、プログラムは自分の語彙を実行時に増やせない——それが
// 静的型付けの中身で、`option.ms` の `link: static` が記号の集合をビルド時に閉じるのと
// 同じことを鍵でやっている。
//
// 理由は性能でも安全性でもない（測ったらどちらも根拠にならなかった。鍵が増えるマージも
// 型が変わらない上書きも 10 命令・確保ゼロで**同数**、閉じる CWE はゼロ）。根拠は1つ、
// **鍵が増えると型に対する関数が書けなくなる**こと——同じ形の2つの値に同じ取り出し関数を
// 当てたとき、片方だけ別の並びを持てば、それは型の関数ではなく束縛の関数である。
// 詳しくは documents/ja-jp/impl/layer_relations.md §3.3.1。
{
	const MG = "p : [\n\tfoo : 10\n\tbar : 20\n]\n";
	const rejects = (src) => {
		try {
			compile(src);
			return "通ってしまった";
		} catch (e) {
			return /鍵は増やせません/.test(e.message) ? "弾いた" : "別の理由: " + e.message.slice(0, 40);
		}
	};
	check("鍵が増えるマージ：後ろに増える鍵", rejects(MG + "q : p~ [\n\tzzz : 1\n]~"), "弾いた");
	check("鍵が増えるマージ：前に増える鍵", rejects(MG + "q : p~ [\n\taa : 1\n]~"), "弾いた");
	// **左が名前どうしでも同じ。** `q~ r~` は q の器へ r を入れる形なので、r にしか無い鍵が
	// あれば q の型が変わる。新しい器が欲しいならブロック形（`[ q~ / r~ ]`）で書く。
	check("鍵が増えるマージ：名前どうし", rejects("a : [\n\tx : 1\n]\nb : [\n\ty : 2\n]\nc : a~ b~"), "弾いた");
	// 鍵が増えなければ通る。**マージが書いてあることではなく、鍵が増えることが問い**である。
	check("重なる鍵だけなら通る", slotsOf(MG + "q : p~ [\n\tfoo : 99\n]~"), ["bar@0", "foo@8"]);
	check("自分を撒いても通る", slotsOf(MG + "q : p~ p~"), ["bar@0", "foo@8"]);
	// **代わりに枠を宣言する。** 型は初期値が決まる（Sign の既存規則）ので、新しい構文は要らない。
	const DECL = "p : [\n\tfoo : 10\n\tbar : 20\n\tzzz : 0\n]\n";
	check("枠を宣言すれば通る", slotsOf(DECL + "q : p~ [\n\tzzz : 1\n]~"), ["bar@0", "foo@8", "zzz@16"]);
	check("枠を宣言した器の大きさ", sizeOf(DECL + "q : p~ [\n\tzzz : 1\n]~"), 24);
	// 連番（宣言順）は宣言の順そのまま。`p ' 0` は宣言順の0番目であって物理配置の0番目ではない。
	const ord = (src) => {
		const l = layoutOfStruct(rhs(src), A64);
		return l && l.slots.slice().sort((a, b) => a.ordinal - b.ordinal).map((s) => s.name);
	};
	check("枠を宣言しても連番は宣言順", ord(DECL + "q : p~ [\n\tzzz : 1\n]~"), ["foo", "bar", "zzz"]);
}

// ---- 前置 `~`（持ち上げ）は長さ1の器を作る ----
//
// 以前ここは「場所（`Implicit`）＝参照」を測る節だった。前置 `~` が `Implicit(T)` を
// 作り、スカラーへの参照は `{ptr}` 8 byte、列への参照は `{ptr, len}` 16 byte、という
// 読みである。だがその後**番地は表に出さないと決めた**——`$` が作った番地は算術に
// 使えず、読むなら `@`、列を辿るなら `[h ~t]` の分解で語る。観測できないものを名指す型
// には仕事が残っておらず、観測できる姿は「長さ1の器」＝ `List` だけである（`~x ≅ [x]`）。
//
// **器に当てれば恒等、スカラーに当てたときだけ表現が変わる。** `~` は η（持ち上げ）で
// あり、`[x] ≅ x` の潰れが効くので器に当てても何も増えない（冪等：`~~n` は `~n`）。
// 型では無償、表現では有償（原理8）。
check("器に当てれば恒等（列）", sizeVia("l : [1 2 3]\na : ~l"), 24);
// 文字3つ。この節の既定は utf32 なので1文字 4 byte である。
check("器に当てれば恒等（文字列）", sizeVia("s : `abc`\na : ~s"), 12);
check("器に当てれば恒等（構造体）", sizeVia("p : [\n\tx : 1\n]\na : ~p"), 8);
check("スカラーは要素1つの器になる", sizeVia("n : 42\na : ~n"), 8);
check("その実体は要素の並び", reprVia("n : 42\na : ~n"), "cells");
check("持ち上げは冪等", sizeVia("n : 42\na : ~~n"), 8);

// 参照そのものの形（`{ptr}` / `{ptr, len}`）を測る規則は `measureImplicit` に残っている
// ——**型が語らないものだけを運ぶ**（列は要素数を型に持たないので `len` が要り、スカラーや
// 構造体は大きさが型で決まるのでアドレス1つで足りる）。今それを生むものは無く、`'` と
// 前置 `#` が参照を返すようになったときに出番が来る（type_system.md §4）。

// ---- 呼び出しをどう渡るか（stack_abi.md §4.6） ----
//
// **参照で渡すのは「メモリに置かれているもの」だけである。** 規則（レンジ・`Iterator`）は
// メモリ上に無いので、指す先が無く参照を作れない——§5 のまとめが `c : [0 ~+ 1]` を
// 「ゼロ（レジスタのみ）」と書いているのはこのことである。
//
// 要素の並びは常にメモリを占める。そして `List(T)` は要素数を型に持たないので、値渡しに
// すると同じ型でも呼び出しごとに渡し方が変わる。参照で揃えることで**渡し方が型だけで
// 決まる**という性質が保たれる。
function passVia(source) {
	const { node, conf } = A64env(source);
	const p = passingOf(node, conf);
	return p && `${p.mode}/${p.size}${p.fields ? " {" + p.fields.map((f) => f.name).join(",") + "}" : ""}`;
}
check("スカラーは値渡し", passVia("n : 42"), "register/8");
check("実数も値渡し（幅は FPU）", passVia("x : 1.5"), "register/8");
check("規則は値渡し（メモリ上に無い）", passVia("r : [1 ~ 5]"), "register/24 {start,step,end}");
check("終端の無い規則も同じ", passVia("c : [0 ~+ 1]"), "register/16 {start,step}");
// 参照が何を運ぶかは `Implicit` と同じ規則——型が語らないものだけを運ぶ。
check("List は要素数が型に無いので {ptr, len}", passVia("l : [1 2 3]"), "reference/16 {ptr,len}");
check("String も同じ", passVia("s : `abc`"), "reference/16 {ptr,len}");
check("Struct は形が型にあるので {ptr} だけ", passVia("p : [\n\tx : 1\n\ty : 2.5\n]"), "reference/8 {ptr}");
// 零対象は何も渡らない。
check("Unit は何も渡らない", passVia("u : __"), "register/0");

// ---- 底に着かない型は「測れない」と答える（落ちない） ----
//
// 器の要素がまた同じ器になる形（`List(List(List(…)))`）は大きさが存在しない。ここを
// 見ていなかったため、推論がそういう型を作った瞬間にスタックを食い潰して落ちていた
// ——**落ちるのと「測れない」は別**である（原理4）。測れないと答えれば呼び出し側が
// 名指しできるし、どこで壊れたのかも追える。
//
// 見るのは深さであってノードの同一性ではない。要素のノードは段ごとに作られるので
// 「同じものを2度通ったか」では捕まらない——底に着かないことの観測可能な形は
// 「いくら降りても終わらない」である。
{
	const deep = (n) => {
		let t = { type: "atom", kind: "number", value: "1", atomType: "Int" };
		for (let i = 0; i < n; i++) t = { type: "block", kind: "bracket", atomType: "List", elementType: "List", lines: [t] };
		return t;
	};
	total++;
	let ok = false;
	try {
		measure(deep(500), { target: "aarch64_qemu", charset: "ascii" });
		ok = true; // 落ちないことが要件（`null` を返すのが正しい答え）
	} catch (e) {
		console.log(`     ${e.constructor.name}: ${String(e.message).slice(0, 60)}`);
	}
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} 深すぎる入れ子でも落ちない`);
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
