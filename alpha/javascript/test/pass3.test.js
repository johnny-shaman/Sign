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

console.log(`\n${passed + extraPassed}/${cases.length + extra} passed`);
process.exit(passed === cases.length && extraPassed === extra ? 0 : 1);
