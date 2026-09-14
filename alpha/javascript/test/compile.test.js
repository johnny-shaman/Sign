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
// 止まったなら理由（機械可読な `reason`、無ければ文言）を、通れば null を返す。
const refusal = (source) => {
	try { run(source); return null; } catch (e) { return e.reason || e.message; }
};

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
// **番地の域に掛け算・冪・階乗の射は無い**（type_system.md §3.6、利用者の決定 2026-09-14）。零射なので `__` へ
// 収束し、理由を残す。左辺が数なら `Int` の域なので記録しない。`__` を左に置いた形は意図された伝播。
checkReasons("0x10 * 2 → 番地の積は射が無い", "0x10 * 2", ["address-without-arrow"]);
checkReasons("0x10 ^ 2 → 番地の冪も", "0x10 ^ 2", ["address-without-arrow"]);
checkReasons("0x5! → 番地の階乗も", "0x5!", ["address-without-arrow"]);
checkReasons("2 * 0x10 → 診断なし（Int の域）", "2 * 0x10", []);
checkReasons("__ * 0x10 → 診断なし（意図された伝播）", "__ * 0x10", []);
// **実行時に決まる番地どうしの和は意味が無い**ので警告する。片方が字面（か字面を束ねた名前）なら、番地を
// 16進の数でずらす普通の形である。差は距離なので警告しない。
checkReasons("p + q（どちらも仮引数の番地）→ 警告", "f : p q ? p + q\nf 0x10 0x20", ["address-plus-address"]);
checkReasons("p + 0x18 → 診断なし（字面でずらす）", "f : p ? p + 0x18\nf 0x10", []);
checkReasons("base + p（base は字面を束ねた名前）→ 診断なし", "base : 0x1000\nf : p ? base + p\nf 0x18", []);
checkReasons("p - q → 診断なし（距離）", "f : p q ? p - q\nf 0x30 0x10", []);
checkReasons("dst + (e - src) → 診断なし（片方が式ならずらし量）", "f : dst e src ? dst + (e - src)\nf 0x2000 0x1010 0x1000", []);
checkReasons("[p ~* 2] → 番地の等比の規則も射が無い", "f : p i ? [p ~* 2] ' i\nf 0x10 1", ["address-without-arrow"]);
// **`0r` / `0b` は16進・2進で書けるレジスタの即値で、数である**（§3.6 の記法の表）。最初の文法から `Address` と
// 型付けしていて、値は同じなので一致の検査では見えなかった。
check("0r の字面は Int", lastType("0r18"), "Int");
check("0b の字面は Int", lastType("0b1010"), "Int");
check("番地 + 0r は番地（数でずらす）", lastType("0x1000 + 0r18"), "Address");
check("0r + 番地は Int（左辺優先）", lastType("0r18 + 0x1000"), "Int");
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
	// `@ref` を持つジェネリック関数と、その呼び出しサイト2つ。渡す関数はアリティ1——`$add`
	// （アリティ2）だと `@ref 5` が部分適用になり、`apply5` が関数を返す形として名指しされる
	// （type_system.md §3.5「関数を返す関数は、関数オブジェクトの番地で返す」）。
	const { specializations } = run("apply5 : ref ? @ref 5\ninc : x ? x + 1\napply5 $inc\napply5 3");
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

// ---- `$` の実体化が書き換えた値の定義は、束縛も書き換えた後の行を指す ----
//
// 実体化の段（specializeRefCalls）は還元前の行を書き換える。値の定義 `v : ap $dbl 5` は
// `v : dbl 5`（η）になるが、束縛は右辺の字句（`rhsTokens`）を**書き換える前の行から**
// 取っていた。pass2 はそれを遅延で還元してカテゴリとアリティを決める（resolveBindingCategory）
// ——そのまま残すと、消した総称 `ap` への呼び出しを組み立てることになる。
//
// 値には今は出ない（pass3 が書き戻す `valueNode` が先に辿られる）。**同じ事実が行と束縛の
// 2箇所にある**ので、片方だけ書き換えると黙って食い違う——その形になっていないことを見る。
{
	const rhsOf = (source, name) => {
		const b = run(source).env.bindings.get(name);
		return b && b.rhsTokens ? b.rhsTokens.join(" ") : null;
	};
	check("η した値の定義", rhsOf("dbl : n ? n * 2\nap : f x ? @f x\nv : ap $dbl 5\nv * 2", "<v>"), "<dbl> 5");
	check("実体へ付け替えた値の定義", rhsOf("sub : a b ? a - b\nflip : f x y ? @f y x\nv : flip $sub 3 10\nv * 2", "<v>"), "<flip$sub> 3 10");
	// 書き換えていない値の定義は、そのまま（作り直す対象を広げすぎていないこと）
	check("書き換えていない値の定義", rhsOf("dbl : n ? n * 2\nap : f x ? @f x\nv : ap $dbl 5\nw : v\nw * 2", "<w>"), "<v>");
}

// ---- 関数を返す関数は、関数オブジェクトの番地で返す（type_system.md §3.5） ----
//
// 本体の返り値の位置に関数そのものが `$` 無しで居たら止める（OperationError）。そのまま返すと
// 実行時の値を捕まえた閉包を返すことになり、部分適用はコンパイル時の特殊化という前提の外へ出る。
// **自動カリー化とは別である**——呼び出しサイトや束縛で引数が足りない形は返り値の位置ではない。
{
	const NAMED = "function-returned-without-address";
	const A3 = "add3 : a b c ? a + b + c\n";
	const FNS = "inc : n ? n + 1\ndbl : n ? n * 2\n";
	check("部分適用を返す", refusal(`${A3}g : x ? add3 (x + 1)\ng 1`), NAMED);
	check("関数の名前を返す", refusal(`${FNS}k : n ? inc\nk 1`), NAMED);
	check("ラムダを返す", refusal("k : n ? (y ? y + n)\nk 1"), NAMED);
	check("点なしの括りを返す", refusal("k : n ? [+ n]\nk 1"), NAMED);
	check("合成を返す", refusal(`${FNS}k : n ? inc dbl\nk 1`), NAMED);
	check("match の枝で返す", refusal(`${FNS}k : n ?\n\tn > 3 : inc\n\tdbl\nk 1`), NAMED);
	check("選びで返す", refusal(`${FNS}k : n ? (n > 3) & inc | dbl\nk 1`), NAMED);
	// 本体の中の `左 : 右` は左が識別子でも**枝**である（局所の束縛ではない）。`t` が真なら
	// `inc` をそのまま返す——一度「局所の束縛」と読んで取りこぼしていた。
	check("識別子が条件の枝で返す", refusal(`t : 1\n${FNS}f : n ?\n\tt : inc\n\t0\nf 1`), NAMED);
	// `$` で渡した関数が本体の中で関数を返す形になるとき（`@g x` の引数不足）も同じ。多すぎる
	// 引数を名指しするのと対になる。**η がこの実体を消してはいけない**——消すと呼び出しサイトが
	// `add3 1 2 3` になって検査をすり抜け、黙って 6 になる（η をアリティの多い呼び先へ広げた版）。
	check("$ で渡した関数が関数を返す形になる", refusal(`${A3}ap : f x ? @f x\nap $add3 1 2 3`), NAMED);
	// 通るもの
	check("$ で番地を返す", refusal(`${A3}g : x ? $(add3 x + 1)\n@(g 1) 2 3`), null);
	check("名前の番地を返す", refusal(`${FNS}k : n ? $inc\n@(k 1) 5`), null);
	check("!__ は真（恒等射）", refusal("f : n ? !__\nf 1"), null);
	check("@ で読んだものを返す", refusal("f : p ? @p\nf 100"), null);
	check("自動カリー化：束縛", refusal(`${A3}p : add3 1\np 2 3`), null);
	check("自動カリー化：括りに当てる", refusal(`${A3}(add3 1) 2 3`), null);
	check("本体の中で使うだけ", refusal(`${A3}f : x ? (add3 x) 2 3\nf 1`), null);
	check("枝の条件に関数を使うだけ", refusal(`${FNS}f : n ?\n\t(inc n) > 3 : 1\n\t0\nf 1`), null);

	// ---- 敵対的な検証で見つかった取りこぼし ----
	// 返り値の位置：`;` の両辺、1スロットの構造体
	check("`;` の右で返す", refusal(`${FNS}k : n ? n = 0 ; inc\nk 1`), NAMED);
	// 1行で書いた `n = 1 : inc` も、括った `(n = 1 : inc)` も枝ではない（枝が居られるのは
	// `?` 直後の字下げブロックの行だけ）。左辺が名前でない define なので、関数を返すかどうかを
	// 見る前に構文として止まる（下の「`名前 : 値`」の節）。
	check("1行の枝は枝ではない", refusal(`${FNS}k : n ? n = 1 : inc\nk 1`), "define-in-value-position");
	check("括った枝も枝ではない", refusal(`${FNS}k : n ? (n = 1 : inc) | 0\nk 1`), "define-left-not-a-name");
	check("複数行の括りも枝ではない", refusal(`${FNS}k : n ? (\n\tn = 0 : inc\n\t0\n)\nk 1`), "define-left-not-a-name");
	check("1スロットの構造体で返す（[x] ≅ x）", refusal(`${FNS}k : n ? [a : inc]\nk 1`), NAMED);
	// 包み：`@$X` は往復で X、取り込み `@` と `~` は中身
	check("@$ の往復で返す", refusal(`${A3}k : n ? @$(add3 n)\nk 1`), NAMED);
	check("取り込みの @ で包んで返す", refusal(`${FNS}k : n ? inc@\nk 1`), NAMED);
	check("~ で包んで返す", refusal(`${FNS}k : n ? ~inc\nk 1`), NAMED);
	// 仮引数の既定値
	check("既定値が関数の仮引数を返す", refusal(`${FNS}k :\n\t\tn\n\t\tf : inc\n\t? f\nk 1`), NAMED);
	check("既定値の中のラムダが関数を返す", refusal(`${FNS}k :\n\t\tn\n\t\tf : (y ? inc)\n\t? f n\nk 1`), NAMED);
	check("合成の定義の中のラムダが関数を返す", refusal(`${FNS}h : dbl (y ? inc)\nh 1`), NAMED);
	// `$` で渡した関数に当てる数が足りない形——実体を作らない道でも抜けない
	check("渡した関数をそのまま返す（k : f ? @f）", refusal(`${FNS}k : f ? @f\n(k $inc) 5`), NAMED);
	check("負の字面の実引数", refusal("add : a b ? a + b\nap : f x ? @f x\nap $add -1"), NAMED);
	check("実引数が足りない呼び出し", refusal(`${A3}ap : f x ? @f x\nq : ap $add3\nq 1`), NAMED);
	check("値の束縛を $ で渡す", refusal(`${A3}p : add3 1\nap : h x ? @h x\nap $p 2`), NAMED);
	check("別名を $ で渡す", refusal("add : a b ? a + b\ng : add\nap : f x ? @f x\nap $g 1"), NAMED);
	check("吊り上げられない無名の関数", refusal("ap : f x ? @f x\nap $(a b ? (c ? c + a) b) 1"), NAMED);

	// ---- 誤爆していたもの（値の束縛を返すのは値を返すこと） ----
	// 識別子は束縛の右辺の式で判じる。pass2 の分類は値の束縛を Lambda と答えることがある。
	check("飽和した呼び出しに束縛した名前", refusal("first : [x ~xs] ? x\nr : first [1 2 3]\nk : n ? r\nk 0"), null);
	check("!__ に束縛した名前（列挙）", refusal("#RGB : Red | Green | Blue\nRed : !__\nGreen : !__\nBlue : !__\npick : n ?\n\tn = 0 : Red\n\tn = 1 : Green\n\tBlue\npick 1"), null);
	check("読みに束縛した名前", refusal("buf : 0x40011000\nv : @buf\nf : n ? v\nf 1"), null);
	check("別名を $ で渡して足りる", refusal("add : a b ? a + b\ng : add\napp : f x y ? @f x y\napp $g 3 4"), null);

	// ---- 2周目：自分の変更が持ち込んだ誤爆 ----
	// `@a b c` は適用。`comp : f g x ? @f (@g x)` の本体は合成ではない（pass2 が `(@g x)` を
	// 未飽和の Lambda と見て合成に読んでいた）。定義しただけで止まっていた。
	check("合成の高階関数を定義するだけ", refusal(`${FNS}comp : f g x ? @f (@g x)\n5`), null);
	check("twice を定義するだけ", refusal(`${FNS}twice : f x ? @f (@f x)\n5`), null);
	check("S コンビネータを定義するだけ", refusal("S : f g x ? @f x (@g x)\n5"), null);
	// 呼び出しサイトの検査も `$X` を束縛の右辺で判じる。値を読むだけの `f $r` は止めない。
	check("値の束縛を $ で渡して読む", refusal("first : [x ~xs] ? x\nr : first [1 2 3]\nf : p ? @p\nf $r"), null);
	check("!__ の束縛を $ で渡して読む", refusal("Red : !__\nf : p ? @p\nf $Red"), null);
	// 仮引数と同じ名前の `$X` はトップの関数ではない
	check("仮引数と同名の $", refusal(`${FNS}rd : p ? @p\ng : inc ? rd $inc\ng 7`), null);

	// ---- 器に並べた関数を `'` で取り出して返す ----
	// `$` が付いていないので、取り出した瞬間にすぐ当てられる関数である。本体がそれを返せば、
	// 関数を `$` 無しで返すことになる（operator_table.md の後置 `~` の項）。
	check("見える器から関数を取り出して返す", refusal("proc : [+ 2] , [* 4] , 3\nk : n ? proc ' 0\nk 1"), NAMED);
	check("見える器から値を取り出して返す", refusal("proc : [+ 2] , [* 4] , 3\nk : n ? proc ' 2\nk 1"), null);
	check("見える器を本体で撒く", refusal("proc : [+ 2] , [* 4] , 3\nk : n ? proc~\nk 1"), null);

	// ---- 裸の関数の生存期間は、書かれた行の中まで（type_system.md §3.5） ----
	// `$` を付けて初めてオブジェクトになる。器に入れて行を越える使い方——関数へ渡す、本体から
	// 返す——は名指しする。`$` を付けて並べた器（番地の表）は運べる。
	const LEAVES = "bare-function-leaves-line";
	check("裸の関数の器を関数へ渡す（字面）", refusal("run : [~p] ? ||p||\nrun ([+ 2] , [* 4] , 3)"), LEAVES);
	check("裸の関数の器を関数へ渡す（名前）", refusal("proc : [+ 2] , [* 4] , 3\nrun : [~p] ? ||p||\nrun proc"), LEAVES);
	check("$ の器は関数へ渡せる", refusal(`${FNS}run : [~p] ? ||p||\nrun ($inc , $dbl)`), null);
	check("裸の関数の器を返す（積）", refusal("mk : n ? [+ n] , [* 4] , 3\nmk 1"), NAMED);
	check("裸の関数の器を返す（行の並び）", refusal(`${FNS}mk : n ?\n\tinc\n\t3\nmk 1`), NAMED);
	check("裸の関数の器を返す（構造体）", refusal(`${FNS}mk : n ? [\n\tget : inc\n\tv : n\n]\nmk 1`), NAMED);
	check("$ の器は返せる", refusal(`${FNS}mk : n ? $inc , $dbl\nmk 1`), null);
	check("値の器は返せる", refusal("mk : n ? n , n + 1\nmk 1"), null);
	check("同じ行で撒いて使うのは行の中", refusal("mk : n ? ([+ n] , [* 4] , 3)~\nmk 1"), null);

	// ---- 名指しの言葉は利用者の書いたもので ----
	const said = (source) => { try { run(source); return ""; } catch (e) { return e.message; } };
	const checkTrue = (note, cond) => check(note, !!cond, true);
	checkTrue("[+] は点なしの括りと言う", said("k : n ? [+]\nk 1").includes("点なしの括り [+]"));
	checkTrue("穴は `_` による部分適用と言う", said("add : x y ? x + y\nk : n ? add _ n\nk 1").includes("`_` による部分適用"));
	checkTrue("吊り上げた無名の関数はそう言う", said(`${FNS}ap : f x ? @f x\nap $(n ? inc) 1`).includes("ap の仮引数 f へ `$` で渡した無名の関数"));
	checkTrue("当てる数の不足は呼び出しサイトで言う", said(`${A3}ap : f x ? @f x\nap $add3 1`).includes("`@f` に渡した add3 はアリティ 3"));
}

// ---- `:` の定義が書ける場所は3つだけ ----
//
// 束縛は行の頭、構造体の項目は器の行（`[…]` か字下げ）、match の枝は `?` 直後の字下げ
// ブロックの行（match_case.md §概要）。**どれでもない場所に書いた `名前 : 値` は読みが無い。**
//
// `f : x ? x > 0 : 42` の本体はその「どれでもない場所」であり、断っていたのが機械だけだった
// ので、解釈器は束縛として読んで右辺を無条件に返していた（`f -1` が 42）。検査は compile に
// 1つだけ置き、両方のエンジンの手前で止める。
//
// 一行に並べた構造体も同じ形である。`:` は `,` より緩く右結合なので `[x : 1 , y : 2]` は
// `x : ((1 , y) : 2)` と読まれ、**内側の define が値の位置へ落ちる**（実測 `{"x":2}`）。
{
	const LEFT = "define-left-not-a-name";
	const PLACE = "define-in-value-position";
	check("1行の本体は枝ではない（比較）", refusal("f : x ? x > 0 : 42\nf -1"), PLACE);
	check("1行の本体は枝ではない（等号）", refusal("f : x ? x = 1 : 42\nf 2"), PLACE);
	// 左辺が名前でも同じ。1行の本体に `:` を書く読みは無い（解釈器は 42、機械は「まだ出せない
	// 式です（define）」と、ここも3通りのうち2通りが残っていた）
	check("1行の本体は束縛でもない", refusal("t : 1\nf : n ? t : 42\nf 1"), PLACE);
	check("一行に並べた構造体", refusal("[x : 1 , y : 2]"), PLACE);
	check("空白で並べても同じ", refusal("[x : 1 y : 2]"), PLACE);
	check("括りを外しても同じ", refusal("x : 1 , y : 2"), PLACE);
	check("行の頭の左辺は名前", refusal("(1 , 2) : 3"), LEFT);
	// **括弧があると意味が変わる**（括りの中はオブジェクトとして見る）。pass2 は `()` も `[]` も
	// `{}` も同じブロックにするので、括りを1組かぶせただけで枝の綴りが復活していた——実測で
	// 解釈器 42／機械 `__`、再帰に至っては解釈器だけ止まらなくなる（qemu で確認）。
	check("括った1行の枝", refusal("f : x ? (x > 0 : 42)\nf -1"), LEFT);
	check("角括弧でも同じ", refusal("f : x ? [x > 0 : 42]\nf -1"), LEFT);
	check("波括弧でも同じ", refusal("f : x ? {x > 0 : 42}\nf -1"), LEFT);
	check("括ると止まらなくなっていた形", refusal("down : n ? [n > 0 : down (n - 1)]\ndown 3"), LEFT);
	check("`&` の右を括っても同じ", refusal("f : x ? 1 & (x > 0 : 2)\nf -1"), LEFT);
	// `[…]` の行と、`名前 :` の下の構造体ブロックの行は**項目**である（枝ではない）。
	check("[…] に条件の行", refusal("f : x ? [\n\tx > 0 : 1\n\tbar : 2\n]\n(f 3) ' bar"), LEFT);
	check("構造体ブロックに条件の行", refusal("point :\n\t0 < 1 : 5\n\tbaz : 2\npoint ' baz"), LEFT);
	check("値の位置の字下げブロック", refusal("p :\n\t1 > 0 : 42\np"), LEFT);
	// 枝の値を字下げすれば、その行はまた枝である（入れ子の match）。両方のエンジンで動く。
	check("入れ子の枝は通る", refusal("f : x y ?\n\tx < 0 :\n\t\ty > 0 : 1\n\t\t2\n\t3\nf -1 1"), null);
	check("構造体を返す関数は通る", refusal("f : x ? [\n\tfoo : x\n\tbar : x + 1\n]\n(f 3) ' bar"), null);
	check("1スロットの構造体は1行でもよい", refusal("k : n ? [a : 42]\nk 1"), null);
	check("撒いた鍵の行は通る", refusal("p :\n\tbar : 1\n\tbaz~ : 2\np ' bar"), null);
	// 言葉は「場所」と「左辺の形」を言い分ける（括りの中まで見る）
	const said = (source) => { try { run(source); return ""; } catch (e) { return e.message; } };
	check("場所を言う", said("f : x ? x > 0 : 42\nf -1").includes("値の位置"), true);
	check("左辺の形を言う", said("f : x ? (x > 0 : 42)\nf -1").includes("（more）"), true);
	check("括った左辺は中身を言う", said("(1 , 2) : 3").includes("（product）"), true);
	// 通るもの：字下げの枝、ブロックの構造体（qemu.test.js は道具が無いと飛ぶので、ここでも見る）
	check("字下げの枝は通る", refusal("f : x ?\n\tx > 0 : 42\nf -1"), null);
	check("ブロックなら1エントリでも通る", refusal("foo :\n\tbar : 1\n(foo ' bar)"), null);
	check("文字列の鍵も通る", refusal("foo :\n\t`a` : 2\n(foo ' `a`)"), null);
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
