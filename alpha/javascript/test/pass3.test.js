/**
 * Pass3（型伝播、type_system.md §2〜§3.2）の動作確認。
 * Pass2が返す二分木ASTに対し、Layer 2 Atom内部型（Address/Float/String/List/Unit等）を
 * 左辺優先ルール（typeof(L op R) = typeof(L)）で推論できることを確認する。
 *
 * 実行: node test/pass3.test.js
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { preprocess } from "../lexer.js";
import { reduceAll } from "../pass2.js";
import { buildEnv } from "../pass1.js";
import { inferAtomType } from "../pass3.js";
// 二重定義の検査は Pass 3 の駆動側が内側のブロックまで降りて初めて効くので、
// そこだけは単一パスではなく実パイプライン（compile）へ通して見る。
import { compile } from "../compile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const grammarPath = path.join(__dirname, "..", "sign.pegjs");
const grammar = fs.readFileSync(grammarPath, "utf8");
const parser = peggy.generate(grammar);

function resolveLines(source) {
	const pre = preprocess(source);
	const lines = parser.parse(pre);
	const env = buildEnv(lines);
	return { nodes: lines.map((line) => reduceAll(line, env)), env };
}

const cases = [
	{
		source: "5 + x",
		pick: (nodes) => nodes[0],
		want: "Int",
		note: "5 + x → Int（左辺の数値リテラル、小数点なし＝Int、右辺は無関係）",
	},
	{
		source: "3.14 + x",
		pick: (nodes) => nodes[0],
		want: "Float",
		note: "3.14 + x → Float（左辺のリテラルに小数点あり）",
	},
	{
		source: "`123` + 0",
		pick: (nodes) => nodes[0],
		want: "Unit",
		note: "`123` + 0 → Unit（§3.2 NOTE: String左辺への算術演算子は型エラーで__に収束）",
	},
	{
		source: "x : 5\nx + 3",
		pick: (nodes) => nodes[1],
		want: "Int",
		note: "x : 5 という定義から x の atomType(Int) が Pass1a で静的に解決され、x + 3 に伝播する",
	},
	{
		source: "[1 2] * 2",
		pick: (nodes) => nodes[0],
		want: "List",
		note: "[1 2] * 2 → List（左辺のブロックをListとして扱い、左辺優先ルールで結果もList）",
	},
	{
		source: "__",
		pick: (nodes) => nodes[0],
		want: "Unit",
		note: "__ 単体 → Unit",
	},
	{
		// 均質なら `base + i × stride` が書けるので、§2 の基準（1つの命令テンプレートで
		// 済むか）では `List` である。多相なら `Struct`（下）。
		source: "[1, 2, 3]",
		pick: (nodes) => nodes[0],
		want: "List",
		note: "[1, 2, 3] → List（カンマは次元を上げるが、上げた結果が均質なら List）",
	},
	{
		source: "[\n\tfoo : 1\n\tbar : 2\n]",
		pick: (nodes) => nodes[0],
		want: "Struct",
		note: "改行区切りのkey:valの並び → Struct（list_model.md §5.3 / pattern_guide.mdのdict例）",
	},
	{
		source: "[foo : 1]",
		pick: (nodes) => nodes[0],
		want: "Struct",
		note: "単一のkey:valペアもStructとして扱う",
	},
	{
		source: "f : y ?\x02x : 1\n2\x03",
		pick: (nodes) => nodes[0].right.right,
		want: "Int",
		note: "関数本体（複数行だが全行がdefineではない: define→numberの並び）は構造体化せず、最後の文(2)の型に委譲する",
	},
	// ---- §3.2 族別テーブル（「左辺優先」＝結果型ではなく規則の選択） ----
	{
		source: "`ab` 1",
		pick: (nodes) => nodes[0],
		want: "String",
		note: "余積族: 左辺がStringならテキスト連結でString（interpreter.jsの`ab` 1 → \"ab1\"と一致）",
	},
	{
		source: "1 2",
		pick: (nodes) => nodes[0],
		want: "List",
		note: "余積族: 左辺がString以外ならList構築（Stringが勝つのは左辺のときだけ）",
	},
	{
		source: "1 2.5",
		pick: (nodes) => nodes[0],
		want: "List",
		note: "§2 要素型のjoin: Int ⊕ Float は Float へ昇格するので List のまま（エラーにならない）",
	},
	{
		source: "1 & `abc`",
		pick: (nodes) => nodes[0],
		want: "String",
		note: "論理・圏論族: `&`は§4のシグネチャ`(L -> R) -> (R | __)`通り右辺の型を返す（左辺優先の反例）",
	},
	{
		source: "1 | `abc`",
		pick: (nodes) => nodes[0],
		want: "Int",
		note: "論理・圏論族: `|`は左辺が非Unitなら左辺を返すため左辺の型",
	},
];

let passed = 0;
for (const c of cases) {
	const { nodes, env } = resolveLines(c.source);
	const target = c.pick(nodes);
	const got = inferAtomType(target, env);
	if (got === c.want) {
		console.log(`OK   ${c.note}`);
		passed++;
	} else {
		console.log(`FAIL ${c.note}`);
		console.log(`     source: ${JSON.stringify(c.source)}`);
		console.log(`     got: ${JSON.stringify(got)}, want: ${JSON.stringify(c.want)}`);
	}
}

// ---- §2「Listは同一型」: join が存在しない要素の混在はコンパイルエラー ----
// 混在させたい場合はカンマ区切りの Struct（tuple）にする、という設計（原理3）。
let extra = 0;
let extraPassed = 0;
function checkThrows(note, source) {
	extra++;
	try {
		const { nodes, env } = resolveLines(source);
		const got = inferAtomType(nodes[0], env);
		console.log(`FAIL ${note}`);
		console.log(`     例外が投げられず ${JSON.stringify(got)} が返った`);
	} catch (e) {
		console.log(`OK   ${note}`);
		extraPassed++;
	}
}
function checkNoThrow(note, source, want) {
	extra++;
	const { nodes, env } = resolveLines(source);
	const got = inferAtomType(nodes[0], env);
	if (got === want) {
		console.log(`OK   ${note}`);
		extraPassed++;
	} else {
		console.log(`FAIL ${note}`);
		console.log(`     got: ${JSON.stringify(got)}, want: ${JSON.stringify(want)}`);
	}
}

// 書き込み先の仮引数へ値を渡したときの断り（pass3 の collectWriteThroughValue）。
function checkWriteArg(note, source, want) {
	extra++;
	const ds = (compile(source, { parse: parser.parse }).diagnostics || []).filter((d) => d.reason === "write-through-value-arg");
	if (ds.length === want) {
		console.log(`OK   ${note}`);
		extraPassed++;
	} else {
		console.log(`FAIL ${note}`);
		console.log(`     診断 ${ds.length} 件（期待 ${want}）: ${JSON.stringify(ds.map((d) => d.message))}`);
	}
}

// 書き込みの左辺が番地でないときの断り。診断は pass3 が付ける（reason: write-to-non-address）。
function checkWrite(note, source, want) {
	extra++;
	const ds = (compile(source, { parse: parser.parse }).diagnostics || []).filter((d) => d.reason === "write-to-non-address");
	if (ds.length === want) {
		console.log(`OK   ${note}`);
		extraPassed++;
	} else {
		console.log(`FAIL ${note}`);
		console.log(`     診断 ${ds.length} 件（期待 ${want}）: ${JSON.stringify(ds.map((d) => d.message))}`);
	}
}

// Stringは余積の吸収元（あらゆる値がテキスト表現を持つのでjoinが常に存在する）。
// 左右どちらに来てもテキスト連結になり、要素型のjoin判定には入らない。
checkNoThrow("`ab` 1 → String（String左辺）", "`ab` 1", "String");
checkNoThrow("1 `ab` → String（String右辺でも同じ。引数の順序で挙動を変えない）", "1 `ab`", "String");
checkNoThrow("[1 `abc`] → String（ブラケットでも同じ）", "[1 `abc`]", "String");
// join が存在しない組み合わせ（数値と Struct/List）は**不正ではなく `Struct`** である
// ——幅が揃わない連続領域はスロットごとに別命令で引くもので、それが `Struct` の定義である。
checkNoThrow("1 [x : 1] → Struct（揃わない余積は Struct になる）", "1 [x : 1]", "Struct");
checkNoThrow("1 , `abc` → Struct（カンマなら混在は正当）", "1 , `abc`", "Struct");

// 範囲族（type_system.md §4: `~` は `(Scalar -> Scalar) -> Iterator -> List`）。
// 結果は端点の型ではなく「列」なので、左辺優先ルール（§3.2）の対象外である
// ——以前は `1 ~ 5` の型が値（[1,2,3,4,5]）と食い違って Address になっていた。
checkNoThrow("1 ~ 5 → List（結果は列であり端点の型ではない）", "1 ~ 5", "List");
checkNoThrow("\\a ~ \\e → String（文字の範囲は文字の並び、String ≅ List(0u)）", "\\a ~ \\e", "String");
checkNoThrow("2 ~+ 2 ~ 10 → List（3項形式。端点は内側の左辺と外側の右辺）", "2 ~+ 2 ~ 10", "List");
checkNoThrow("1 ~+ 2 → Iterator（終端の無い2項形式はPull型ストリームそのもの）", "1 ~+ 2", "Iterator");
// 端点になれるのは「点」だけ。点でなければ射が無い＝零射なので、停止せず `__` になる。
// 型が合わないことは停止理由ではない（停止するのは構文が壊れているときだけ）。
checkNoThrow("[1 2] ~ [3 4] → Unit（List は点ではない。停止せず零射へ）", "[1 2] ~ [3 4]", "Unit");
checkNoThrow("[x : 1] ~ [y : 2] → Unit（Struct も同様）", "[x : 1] ~ [y : 2]", "Unit");
checkNoThrow("1 ~+ 2 ~ [3 4] → Unit（3項形式の終端も端点）", "1 ~+ 2 ~ [3 4]", "Unit");

// ---- 名前付きスロットの二重定義（原理4） ----
// 物理配置は名前順で決まるので（stack_abi.md §7.1）、同じ名前が2つあると位置が決まらない。
// **決めていたのは実装の都合だった**——`[tier : 14 / tier : 24]` を引くと解釈器は 24
// （後勝ち）、機械語は 14（先勝ち）を返し、診断は1件も出ていなかった。静的に判定できる
// 違反なので `__` へ落とさず止める。
//
// 名前は綴りではなく中身で比べる（`bareKey`）。`foo` と `` `foo` `` は同じスロットである。
//
// **見るのは `compile()` である。** `inferAtomType` を1ノードに当てるだけでは外側の
// ブロックが「全行が `鍵 : 値`」で `Struct` を返して確定し、内側のブロックへ降りない
// ——降りるのは Pass 3 の駆動側（`compile.js`）だからである。内側の二重定義を見たい
// のに外側しか見ない試験になっていては意味が無いので、実パイプラインへ通す。
function checkDuplicateSlot(note, source) {
	extra++;
	try {
		const { nodes } = compile(source, { charset: "ascii" });
		console.log(`FAIL ${note}`);
		console.log(`     例外が投げられず ${nodes.length} ノードが返った`);
	} catch (e) {
		if (e.reason === "duplicate-slot-name") {
			console.log(`OK   ${note}`);
			extraPassed++;
		} else {
			console.log(`FAIL ${note}`);
			console.log(`     別の理由で止まった: ${e.name} / reason=${JSON.stringify(e.reason)} / ${e.message.slice(0, 70)}`);
		}
	}
}
// 通るべき側も同じ入り口で見る。止まらないことと、構造体として型が付くことの両方。
function checkStructOk(note, source) {
	extra++;
	try {
		const { nodes } = compile(source, { charset: "ascii" });
		const last = nodes[nodes.length - 1];
		if (last) {
			console.log(`OK   ${note}`);
			extraPassed++;
		} else {
			console.log(`FAIL ${note}`);
			console.log(`     ノードが返らなかった`);
		}
	} catch (e) {
		console.log(`FAIL ${note}`);
		console.log(`     止まってはいけないのに止まった: ${e.name} / ${e.message.slice(0, 70)}`);
	}
}
checkDuplicateSlot("同じ名前を2回", "[\ntier : 14\ntier : 24\n]");
checkDuplicateSlot("識別子と綴りは同じ名前", "[\nfoo : 1\n`foo` : 2\n]");
checkDuplicateSlot("綴りの鍵を2回", "[\n`*` : 14\n`*` : 24\n]");
checkDuplicateSlot("3回", "[\nk : 1\nk : 2\nk : 3\n]");
checkDuplicateSlot("入れ子の内側で2回（括弧）", "[\nb : [\nk : 1\nk : 2\n]\n]");
checkDuplicateSlot("入れ子の内側で2回（インデント）", "a :\n\tb :\n\t\tk : 1\n\t\tk : 2\na\n");
checkDuplicateSlot("関数が返す構造体の内側で2回", "f : v ? [\nb : [\nk : 1\nk : 2\n]\nz : v\n]\n(f 1) ' b\n");
checkDuplicateSlot("省略記法（裸の識別子）で2回", "x : 1\n[\nx\nx\n]");
// 通るべきもの。
checkStructOk("名前が違えば通る", "[\ntier : 14\nright : 0\n]");
checkStructOk("入れ子で外と内が同じ名前は別のスロット", "[\nk : 1\nb : [\nk : 2\n]\n]");
checkStructOk("別の構造体なら同じ名前でよい", "a : [\nk : 1\n]\nb : [\nk : 2\n]\n(a ' k) + (b ' k)\n");
// 撒いた行との衝突は**上書き**であって二重定義ではない（`newContainerSlots`
// 「書いた行には勝てない」）。上書きは撒くことの目的そのものである。
checkStructOk("撒いた行との衝突は上書き（止めない）", "p : [\nfoo : 1\nbar : 2\n]\n[\nfoo : 9\np~\n]");
// 連番スロットには名前が無いので、同じ値が並んでもこの規則は関与しない。
checkStructOk("連番スロットは対象外（名前が無い）", "[1 , 1 , 1]");
// `match_case` は `条件 : 結果` の形をしているが構造体ではない。同じ条件を2度書いても
// この規則の対象外である（左辺が識別子でも文字列でもないので `isSlotKeyNode` に外れる）。
checkStructOk("match_case は対象外", "f : n ?\n\tn = 1 : 10\n\tn = 1 : 20\n\t0\nf 1\n");

// ---- rest がふたつある分割（切れ目が決まらない）----
//
// カッコの仮引数は器をどの位置で切るかを選ぶ宣言である。**固定スロットは器の端から数えて
// 位置が決まる**ので、rest がひとつならその長さも決まる：
//
//     [a ~b]     a は左端の1個、b は終端まで
//     [~u v]     v は右端の1個、u はその手前まで
//     [a ~b c]   両端が固定、b は挟まれたぶん
//
// rest がふたつあると、その間の境界がどこにも書かれない。`[~u ~v]` は境目が自由だし、
// `[~l x ~r]` も **`l` が i 個なら `x` は i 番目**で、その i が決まらない。後者は
// 「左文脈・焦点・右文脈」に見えるが**焦点の位置を書いていない**のでジッパーにならない
// ——ジッパーは `[a ~b]` と再帰でできる（左文脈は呼び出しの側に在る）。
//
// 実際これまでは先に出てきた rest だけが効いていて、`[~u ~v]` に `[1 2 3 4]` を渡すと
// `u=[1,2,3] v=4`、つまり **`[~u v]` と1文字も違わない答え**が診断ゼロで返っていた。
// 決めていたのは書かれた形ではなく実装の貪欲さだったので、二重定義と同じ強さで止める。
function checkMultipleRest(note, source) {
	extra++;
	try {
		compile(source, { charset: "ascii" });
		console.log(`FAIL ${note}`);
		console.log(`     例外が投げられなかった`);
	} catch (e) {
		if (e.reason === "multiple-rest-params") {
			console.log(`OK   ${note}`);
			extraPassed++;
		} else {
			console.log(`FAIL ${note}`);
			console.log(`     別の理由で止まった: ${e.name} / reason=${JSON.stringify(e.reason)} / ${e.message.slice(0, 70)}`);
		}
	}
}
checkMultipleRest("[~u ~v] は境目が決まらない", "f : [~u ~v] ? v\nf [1 2 3 4]");
checkMultipleRest("[~l x ~r] も焦点の位置が決まらない", "f : [~l x ~r] ? x\nf [1 2 3 4]");
checkMultipleRest("裸の可変引数でも同じ", "f : x ~xs ~ys ? xs\nf 1 2 3");
checkMultipleRest("3つ並んでも止まる", "f : [~a ~b ~c] ? a\nf [1 2 3]");
checkMultipleRest("器を2つ受ける形でも、その並びの中で見る", "g : [a ~b] [~c ~d] ? b\ng [1 2] [3 4]");
// 端から数えて決まる形は通す。
checkStructOk("[a ~b] は通る", "f : [a ~b] ? b\nf [1 2 3 4]");
checkStructOk("[~u v] は通る（右端が錨）", "f : [~u v] ? v\nf [1 2 3 4]");
checkStructOk("[a ~b c] は通る（両端が錨）", "f : [a ~b c] ? b\nf [1 2 3 4]");
checkStructOk("[~a] は通る（rest ひとつ）", "f : [~a] ? a\nf [1 2 3]");
checkStructOk("[a ~b] [c ~d] は別の並びなので通る", "g : [a ~b] [c ~d] ? b\ng [1 2] [3 4]");
checkStructOk("裸の可変引数 1つは通る", "f : x ~xs ? xs\nf 1 2 3");
// **ジッパーの綴りは `[~l] x [~r]` である**——ひとつの並びの中ではなく、**3つの別々の
// 仮引数**として書く。各グループの rest はひとつずつなので上の規則をそのまま通り、
// そして肝心なのは**焦点をどこに置くかを呼ぶ側が決める**ことである。受ける側の宣言には
// 焦点の位置が書かれていない（書けない）——それは適用の側の情報だからで、器への持ち上げも
// 同じく呼ぶ側が払う（原理8、`emitLiftToContainer` の「払うのは呼ぶ側である」）。
//
// 同じ列に対して `z [1] 2 [3 4]` と `z [1 2] 3 [4]` はどちらも `[1 2 3 4]` に組み直る。
// 焦点だけが違う。これが「1つの余積の項を選ぶ」ということである。
checkStructOk("ジッパーは [~l] x [~r]（3つの仮引数）", "z : [~l] x [~r] ?\n\t[l~ x r~]\nz [1 2] 3 [4 5]");
checkStructOk("焦点は呼ぶ側が決める（別の切り方）", "z : [~l] x [~r] ?\n\t[l~ x r~]\nz [1] 2 [3 4]");
checkStructOk("スカラーは器へ持ち上がる", "z : [~l] x [~r] ?\n\tl\nz 1 2 [3 4]");
// 焦点を動かすのは再帰そのもので、余結合律がその歩きを保証している
// （どこで先に切っても同じ所に着く）。左文脈は呼び出しの側に在る。
checkStructOk("焦点を進めるのは再帰", "at : n [a ~b] ?\n\tn = 0 : a\n\tat (n - 1) b\nat 2 [1 2 3 4]");


// ---- 書き込み（中置 `#`）の左辺は番地である（operator_table.md 段4、利用者の裁定 2026-09-23） ----
//
// 左辺の型が**番地でないと分かっている**ときだけ名指しで断る。黙って通すと、解釈器は
// 「書き込み先を持たない左辺へは書かない」で `__` を返し、**機械は値を番地と読んで
// 書きに行く**——同じ字面で片方が黙り、片方が踏み抜く形だった。
//
// 断らないのは `$x`・`$(l ' 1)`・MMIO の生番地・仮引数（型は呼び出しサイトから届く）で、
// つまり「番地だと分かっている」「まだ分からない」はどちらも通る。
checkWrite("Int の束縛へ書くと断る", "x : 5\nx # 7", 1);
checkWrite("String の束縛へ書くと断る", "s : `ab`\ns # 7", 1);
checkWrite("List の束縛へ書くと断る", "l : 1 2 3\nl # 7", 1);
checkWrite("`$x` は通る", "x : 5\n$x # 7", 0);
checkWrite("番地を束ねた名前は通る", "x : 5\np : $x\np # 7", 0);
checkWrite("器の要素の場所は通る", "l : 1 2 3\n$(l ' 1) # 9", 0);
checkWrite("MMIO の生番地は通る", "0x9000000 # 65", 0);
checkWrite("仮引数は通る（型は呼び出しサイトから）", "f : p ? p # 7\nx : 5\nf $x", 0);

// **呼び出しを1つ挟んだ同じ穴。** `f : p ? p # 7` の `p` は使われ方から `Address` になるので、
// `f x`（`x : 5`）は上の門に掛からない——実測で解釈器は `__`、機械はスタックを踏み抜いていた。
// 渡す所で見る（reason: write-through-value-arg）。
checkWriteArg("番地を受ける仮引数へ値を渡すと断る", "f : p ? p # 7\nx : 5\nf x", 1);
checkWriteArg("字面で渡しても断る", "f : p ? p # 7\nf 5", 1);
checkWriteArg("式の結果でも断る", "g : n ? n + 1\nf : p ? p # 7\nf (g 4)", 1);
checkWriteArg("場所を渡せば通る", "f : p ? p # 7\nx : 5\nf $x", 0);
checkWriteArg("器の要素の場所でも通る", "f : p ? p # 7\nl : 1 2 3\nf $(l ' 1)", 0);
checkWriteArg("MMIO の番地でも通る", "f : p ? p # 65\nf 0x9000000", 0);
checkWriteArg("番地でない仮引数は見ない（右辺）", "out : 0x9000000\nput : c ?\n\tout # c\nput 65", 0);
checkWriteArg("2番目のスロットも位置で見る", "f : p q ? q # p\nx : 5\nf 7 x", 1);
checkWriteArg("その位置に場所が来ていれば通る", "f : p q ? q # p\nx : 5\nf 7 $x", 0);

// **転送を1つ挟んでも同じ規則で当たる。** `g : n ? f n` の `n` は字面では書き込み先でないが、
// 型は `f` の仮引数から伝わって `Address` になる——書かれ方だけを見ていたときは、名前を1つ
// 挟むたびに穴が奥へ逃げていた（実測で `g 5` は踏み抜いていた）。
checkWriteArg("転送を挟んでも断る", "f : p ? p # 7\ng : n ? f n\ng 5", 1);
checkWriteArg("転送でも場所を渡せば通る", "f : p ? p # 7\ng : q ? f q\nx : 5\ng $x", 0);
// 実引数の型は**書かれた場所**でしか引けない（`s` は `g` のスコープに居る）。
checkWriteArg("サイトのスコープで実引数を読む", "f : p ? p # 7\ng : s ? f (s ' 0)\ng `ab`", 1);
checkWriteArg("その要素の場所なら通る", "f : p ? p # 7\ng : s ? f $(s ' 0)\ng `ab`", 0);

// **位置が1対1にならない受け方は見ない。** `~y` は残りをまとめて受けるので、3番目の実引数と
// 3番目のスロットは同じものではない——器を受ける位置の型は `Address` になりうるので、ここを
// 外すと可変引数の関数が軒並み断られる（実測：`preprocessor.md` の `map` の例）。
checkWriteArg("可変引数の位置は見ない", "map : f x ~y ? @f x , map y~\nmap $[* 2] 1 2 3 4 5", 0);
checkWriteArg("分解で受ける位置も見ない", "f : p [h ~t] ? p # h\nx : 5\nf $x [1 2 3]", 0);

console.log(`\n${passed + extraPassed}/${cases.length + extra} passed`);
process.exit(passed === cases.length && extraPassed === extra ? 0 : 1);
