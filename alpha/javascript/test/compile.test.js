/**
 * compile.js（Pass 1〜3 の単一ドライバ）の動作確認。
 *
 * pass3 はかつて自身のテストからしか呼ばれておらず、実行経路に載っていなかった。
 * ここでは compile() が全ノードへ Layer 2 型を注釈できていること、および
 * type_system.md §3.2 の族別規則・数値の昇格格子が識別子経由でも効くことを確認する。
 *
 * 型の消費先は評価器だけではない。リテラルのサイズ・レジスタクラス・命令テンプレートを
 * コンパイル時に決めるのが本来の消費先であり（type_system.md）、評価器が atomType を
 * 読むのはその一部にすぎない（`5 / 2` は 3、`5.0 / 2` は 2.5 のような判断）。
 *
 * 実行: node test/compile.test.js
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const grammar = fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8");
const parser = peggy.generate(grammar);

const run = (source) => compile(source, { parse: parser.parse });

let passed = 0;
let total = 0;

function check(note, got, want) {
	total++;
	if (got === want) {
		console.log(`OK   ${note}`);
		passed++;
	} else {
		console.log(`FAIL ${note}`);
		console.log(`     got: ${JSON.stringify(got)}, want: ${JSON.stringify(want)}`);
	}
}

// 最終行のトップレベルノードの atomType を取る
function lastType(source) {
	const { nodes } = run(source);
	return nodes[nodes.length - 1].atomType;
}

// ---- 全ノードへの注釈（§5 Pass 3 の出力＝「完全型付きAST」） ----
{
	const { nodes } = run("5 + 2");
	const add = nodes[0];
	check("トップレベルノードに atomType が載る", add.atomType, "Int");
	check("左の子にも載る", add.left.atomType, "Int");
	check("右の子にも載る", add.right.atomType, "Int");
}

// ---- 数値の昇格格子（§3.2） ----
check("Int ⊕ Int → Int", lastType("5 + 2"), "Int");
check("Int ⊕ Float → Float（昇格、降格しない）", lastType("5 + 1.5"), "Float");
check("Float ⊕ Int → Float", lastType("1.5 + 5"), "Float");
check("Float ⊕ Float → Float", lastType("1.5 + 2.5"), "Float");
// 識別子を経由しても昇格が効くこと（pass1a が読んだ atomType が伝播する）
check("識別子経由でも昇格する（a:5 / b:1.5 / a + b → Float）", lastType("a : 5\nb : 1.5\na + b"), "Float");

// ---- 算術族の型不一致（§3.2、両方向とも __） ----
check("Int ⊕ String → Unit", lastType("1 + `abc`"), "Unit");
check("String ⊕ Int → Unit", lastType("`abc` + 1"), "Unit");

// ---- List 左辺の算術（§3.2 算術族テーブル） ----
check("List * Int → List（repeat）", lastType("[1 2] * 2"), "List");
check("List ^ Int → List（lift）", lastType("[1 2] ^ 2"), "List");
check("List / Int → List（split）", lastType("[1 2 3 4] / 2"), "List");
check("List + List → Unit（+ - % はList左辺で型エラー）", lastType("[1 2] + [3 4]"), "Unit");

// ---- 余積族（§3.2） ----
check("String 左辺の余積 → String（テキスト連結）", lastType("`ab` 1"), "String");
check("String 以外の余積 → List", lastType("1 2"), "List");

// ---- 論理・圏論族（§3.2、`&` だけ右辺の型） ----
check("`&` は右辺の型を返す（§4: (L -> R) -> (R | __)）", lastType("1 & `abc`"), "String");
check("`|` は左辺の型を返す", lastType("1 | `abc`"), "Int");

// ---- define / lambda / Struct の判定 ----
check("define の型は束縛される値の型", lastType("x : 5"), "Int");
check("Lambda は Layer 2 型を持たない（Layer 1 のカテゴリなので null）", lastType("f : x ? x + 1"), null);
check("改行区切りの構造体リテラル → Struct", lastType("d :\n\tfoo : 1\n\tbar : 2"), "Struct");
check("単一エントリの構造体も Struct", lastType("d : [foo : 1]"), "Struct");
check(
	"match_case（左辺が識別子でない define 行）は Struct ではない",
	lastType("f : x ?\n\tx < 0 : `neg`\n\t`pos`"),
	null // Lambda なので Layer 2 型なし
);

// ---- Pass 3b: `__` へ収束する経路の静的記録（§5 Pass 3b） ----
// 実行前に「この式は __ になる」と、その理由が帳簿へ載ることを確認する。
// reason は機械可読なコード（形式手法へ橋を架けるとき読むのはこちら）、message は人間向け。
function reasons(source) {
	return run(source).diagnostics.map((d) => d.reason);
}
function checkReasons(note, source, want) {
	total++;
	const got = reasons(source);
	if (JSON.stringify(got) === JSON.stringify(want)) {
		console.log(`OK   ${note}`);
		passed++;
	} else {
		console.log(`FAIL ${note}`);
		console.log(`     got: ${JSON.stringify(got)}, want: ${JSON.stringify(want)}`);
	}
}

checkReasons("1 + `abc` → 算術族の型不一致を記録", "1 + `abc`", ["arithmetic-type-mismatch"]);
checkReasons("`abc` + 1 → 同上（両方向とも）", "`abc` + 1", ["arithmetic-type-mismatch"]);
checkReasons("識別子経由でも追える（x : `abc` / x * 2）", "x : `abc`\nx * 2", ["arithmetic-type-mismatch"]);
checkReasons("[1 2] + [3 4] → List左辺の算術が未定義", "[1 2] + [3 4]", ["list-arithmetic-undefined"]);
checkReasons("5 + 2 → 診断なし", "5 + 2", []);
// 範囲族（§4）: 端点が「点」でないとき。停止させず `__` へ落とし、理由を帳簿に残す
// ——型が合わないことは「射が無い」ことであり、零対象を経由する射（零射）が常に
// 存在する以上、結果は `__` である。停止するのは構文が壊れているときだけ。
checkReasons("[1 2] ~ [3 4] → 端点が点でないことを記録", "[1 2] ~ [3 4]", ["range-endpoint-not-a-point"]);
checkReasons("[x : 1] ~ [y : 2] → 同上（Struct）", "[x : 1] ~ [y : 2]", ["range-endpoint-not-a-point"]);
checkReasons("1 ~+ 2 ~ [3 4] → 3項形式の終端も端点として見る", "1 ~+ 2 ~ [3 4]", ["range-endpoint-not-a-point"]);
checkReasons("1 ~ 5 → 診断なし", "1 ~ 5", []);
checkReasons("\\a ~ \\e → 診断なし（文字は点）", "\\a ~ \\e", []);
checkReasons("__ ~ 5 → 診断なし（Unit は零射であって型の不一致ではない）", "__ ~ 5", []);
// **`'` の鍵に立つ `名前~` は範囲ではない。** 鍵が実行時に決まる引き方は後置 `~` の空きを
// 借りて綴られており、節点としては `range_arithmetic(k, 1)` になる。範囲として読むと端点が
// String なので上の診断に当たっていたが、**この形は実機で正しく動く**（`.rodata` の名前表を
// 線形に探す）——正しいコードについて「`__` に収束します」と言っていた。
checkReasons(
	"t ' k~（実行時の鍵）→ 診断なし。範囲ではないので端点の話にならない",
	"t :\n\t`ab` : 14\ng : k ? t ' k~\ng `ab`\n",
	[],
);
checkReasons("s ' 1~（切り出し）→ 診断なし", "s : [10 , 20 , 30]\n||s ' 1~||", []);
// 書く側（`[ 名前~ : 値 ]`）は保留。**禁止ではない**——新しい器を作るだけで既存の型は
// 変わらないので、layer_relations.md §3.3.1 の「鍵が増えるマージ」とは別件である。
// 名前を付けておかないと「まだ出せない式です（define）」という総括の診断に落ちて、
// 何が保留なのか読み取れない。
checkReasons(
	"[k~ : v]（鍵が実行時の構造体構築）→ 保留として名指しする",
	"f : [~k] v ? [k~ : v]\nf `ab` 7\n",
	["dynamic-slot-key"],
);
checkReasons("鍵を静的に書けば診断なし", "f : v ? [\n`ab` : v\n]\n(f 7) ' `ab`\n", []);
checkReasons("撒く行（`p~`）は鍵ではないので対象外", "p : [\nfoo : 1\n]\n[\nbar : 2\np~\n]\n", []);
// 持ち上げた結果に演算を書いてしまう形（`~xs + 1`）。要素型を決める演算は持ち上げの
// **内側**に置く（`~(x + 1)`）。
//
// 記録される理由は素の `xs + 1` と**同じ**である。以前は前置 `~` が「場所（`Implicit`）」
// を作り、場所は Scalar ではないので算術の対象外、という別の規則で `__` にしていた。
// `~` が長さ1の器（`List`）を作ると読み直したので、これは §3.2 の List 算術の規則から
// そのまま落ちてくる——特別扱いが1つ減って、結論は変わっていない。
checkReasons("~xs + 1 → 器への算術として記録", "xs : [1 2 3]\n~xs + 1", ["list-arithmetic-undefined"]);
checkReasons("素の xs + 1 と同じ理由", "xs : [1 2 3]\nxs + 1", ["list-arithmetic-undefined"]);
checkReasons("~(x + 1) → 診断なし（演算が持ち上げの内側にある）", "x : 1\n~(x + 1)", []);
// §3.3 の非対称Unit伝播則は「意図された伝播」であって型の不一致ではないので診断しない
// （再帰の底打ちがこれに乗っている——原理5。ここで鳴らすとログのゴミ山になる）。
checkReasons("__ + 5 → 診断なし（§3.3の吸収則は意図された伝播）", "__ + 5", []);
checkReasons("5 + __ → 診断なし（右辺Unitは単位元）", "5 + __", []);

// ---- ブロックの子スコープが注釈時にも使われること ----
{
	const { nodes } = run("d :\n\ta : 5\n\tb : 1.5\n\ta + b");
	const block = nodes[0].right;
	const add = block.lines[block.lines.length - 1];
	check("ブロック内で定義した識別子の型が解決する（a → Int）", add.left.atomType, "Int");
	check("同（b → Float）", add.right.atomType, "Float");
	check("ブロック内の演算にも昇格格子が効く（a + b → Float）", add.atomType, "Float");
	check("ブロックの値＝最終行の型", block.atomType, "Float");
}

// ---- Pass 1b がパイプラインに載っていること ----
{
	// `@ref` を持つジェネリック関数と、その呼び出しサイト2つ。
	const { specializations } = run("apply5 : ref ? @ref 5\nadd : x y ? x + y\napply5 $add\napply5 3");
	total++;
	const entry = specializations.get("<apply5>");
	const ok = !!entry && entry.has("<ref>") && entry.get("<ref>").callsiteCount === 2;
	if (ok) {
		console.log("OK   Pass 1b が呼ばれ、ジェネリック仮引数の呼び出しサイトが収集される");
		passed++;
	} else {
		console.log("FAIL Pass 1b が呼ばれ、ジェネリック仮引数の呼び出しサイトが収集される");
		console.log(`     specializations: ${JSON.stringify([...specializations].map(([k, v]) => [k, [...v]]))}`);
	}
}


// ポイントフリーの適用も呼び先の返値型が伝わる（演算子表がシグネチャを持つため）。
check("[+ 1] の適用は Int", lastType("inc : [+ 1]\ninc 3"), "Int");
check("[+ 1.0] の適用は Float", lastType("fl : [+ 1.0]\nfl 3"), "Float");
// **別名越しの呼び出しサイトも証拠である。** `add : [+]` は合成が作った畳み込みへの
// 別名であり、`add 1 2` はその畳み込みを呼んでいる。かつてここは族（`Scalar`）までしか
// 言えなかった——名前を1つ挟むと実引数が見えなくなっていたためで、族に留まったのは
// 「分からない」の言い換えだった。今は Int のリテラルで呼ばれていることが届く。
check("別名越しでも実引数まで狭まる", lastType("add : [+]\nadd 1 2"), "Int");

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
