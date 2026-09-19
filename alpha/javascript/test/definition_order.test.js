/**
 * **トップレベルの定義の「順序」の規則を、2つの実装で見る門。**
 *
 * 規則は2つで、どちらも「**同じ列を両方に読ませる**」ことで揃えてある:
 *
 *   先勝ち      同じ名前が2つ定義されたら、先に書いた方が勝つ（§1〜§4）
 *   順序非依存  定義は使う行より先へ並べ直される（§5。`1_definition.md` §6.3）
 *
 * 2つは衝突しない。順序非依存は**参照がいつ解けるか**の話で、先勝ちは**同じ名前が2つ
 * 書かれたときどちらか**の話である。
 *
 * ## 先勝ち
 *
 * 利用者の決定（2026-09-19）：「include のひし形は、先勝ちルールに統一。後からのものは
 * infomation だけ出す」。動機はひし形である——A が B と C を引き、B と C が同じ名前を
 * 自分で定義していると、展開された列に同じ名前が2つ並ぶ。後勝ちだと**引く順番を変えた
 * だけで答えが変わる**。
 *
 * ## ここが見るのは「揃っていること」である
 *
 * 決めるまで、2つの実装は同じ入力に**2つの答え**を持っていた:
 *
 *     a : 1 / b : a + 10 / a : 2 / b + a      解釈器 13 / 機械 14   （診断は0件）
 *
 * 解釈器は上から走らせるので `b` を作る時点の `a` は 1（b=11）、その後 `a` が 2 になって
 * 11+2=13。機械は束縛を名前で late に引くので b=12、12+2=14。**どちらも「後勝ち」なのに
 * 値が違う**——束縛は置換であり、名前がいつ解けるかで答えが変わるからである。
 * 先勝ちなら2つ目の定義がそもそも無いので、割れようが無い（両方 12）。
 *
 * ## 直す場所は束縛表ではない
 *
 * pass1 の束縛表だけを先勝ちにしても**機械は 14 のまま**である。pass3 がノード列を歩いて
 * `binding.valueNode` を書き戻すので、表と列で答えが割れる。落とすのは
 * **`compile` が作るノード列そのもの**でなければならない——そうすれば解釈器と Pass 4 が
 * 同じ列を読む（`interpreter.js` は無改造で済んだ）。
 *
 * ## 代金
 *
 *   関数の再定義をアセンブラが止めなくなる   昔は `symbol 'foo' is already defined` で
 *                                            止まっていた。**止まるのは検査ではなかった**
 *                                            ——解釈器は後の定義で走っていたのだから、
 *                                            同じ入力に2つの答えが在ったままである
 *   `#` は勝った定義のもの                   無印→`#` の順だと公開されない（information は出る）
 *   糖衣が置き換える名前は除外               ストリームの均しは元の名前をわざと再定義して
 *                                            後の方を入口にする（`markCursorEntries`）
 *
 * 実行: node test/definition_order.test.js
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";
import { generateAsm } from "../pass4.js";
import { evaluate, newRuntimeEnv, UNIT, observe, isUnit } from "../interpreter.js";
import { runAsm, asInt, available, toolReport } from "../qemu_run.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = peggy.generate(fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8"));

let passed = 0;
let total = 0;
let skipped = 0;

// **入っていないことと落ちることは別。** 走らせる検査だけ飛ばす——診断を見る側は
// コンパイルしか要らないので、ツールチェーンが無くても見られる。
const HW = available();
if (!HW) console.log(`実機は飛ばす（${toolReport()}）——診断だけ見る`);

const ASM = { target: "aarch64_qemu", charset: "ascii", layer: 1 };
const T = String.fromCharCode(9);
const L = (...xs) => xs.join(String.fromCharCode(10)) + String.fromCharCode(10);
const modsReader = (mods) => (full) => {
	const b = path.basename(full);
	if (!(b in mods)) throw new Error(`知らない枚: ${b}`);
	return mods[b];
};

function interp(source, mods) {
	const { nodes } = compile(source, { parse: parser.parse, charset: "ascii", readImport: modsReader(mods || {}) });
	const env = newRuntimeEnv(null, "ascii");
	let r = UNIT;
	for (const node of nodes) r = evaluate(node, env);
	if (isUnit(r)) return "__";
	const o = observe(r);
	if (o === undefined || o === null) return "__";
	if (typeof o === "string" && [...o].length === 1) return String(o.codePointAt(0));
	return String(o);
}

function machine(source, mods) {
	const { nodes, env } = compile(source, { charset: "ascii", readImport: modsReader(mods || {}) });
	const r = generateAsm(nodes, env, ASM);
	if (r.diagnostics.length) return "出せない：" + r.diagnostics[0].message;
	const v = asInt(runAsm(r.text)[0]);
	return v === null ? "__" : String(v);
}

/** 同じソースを両方へ通し、**一致すること**だけを見る。期待値は書かない。 */
function agree(note, source, mods) {
	if (!HW) {
		skipped++;
		return;
	}
	total++;
	let a, b;
	try { a = interp(source, mods); } catch (e) { a = "解釈で例外：" + e.message; }
	try { b = machine(source, mods); } catch (e) { b = "機械で例外：" + e.message; }
	if (a === b) {
		passed++;
		console.log(`ok   ${note.padEnd(40)} ${a}`);
	} else {
		console.log(`FAIL ${note.padEnd(40)} 解釈=${a} / 機械=${b}`);
	}
}

function check(note, got, want) {
	total++;
	const g = JSON.stringify(got);
	const w = JSON.stringify(want);
	if (g === w) {
		passed++;
		console.log(`ok   ${note}`);
	} else {
		console.log(`FAIL ${note}\n       期待 ${w}\n       実際 ${g}`);
	}
}

const front = (source, mods) =>
	compile(source, { charset: "ascii", readImport: modsReader(mods || {}) }).diagnostics;

// --- 1. 2つの実装が揃う ---------------------------------------------------
//
// **どれも先勝ちの前は割れていたか、アセンブラで止まっていた形である。**

agree("再定義：束縛が late に解けても揃う", "a : 1\nb : a + 10\na : 2\nb + a\n");
agree("再定義：関数（昔はアセンブラが止めた）", "f : x ? x + 1\nf : x ? x + 2\nf 1\n");
agree("再定義：最後の文が断られる形", "a : 1\na : 2\n");
agree("再定義：3つ並ぶ", "a : 1\na : 2\na : 3\na\n");
agree("再定義：器", "p : [1 2 3]\np : [4 5 6]\np ' 1\n");
agree("ひし形：B と C が同じ名前を定義する", "`b.sn`@~\n`c.sn`@~\nv 1\n", {
	"b.sn": "`d.sn`@~\nv : x ? x + w\n",
	"c.sn": "`d.sn`@~\nv : x ? x + 100\n",
	"d.sn": "w : 7\n",
});
agree("ひし形：引く順を入れ替える（先勝ちは並べ方で決まる）", "`c.sn`@~\n`b.sn`@~\nv 1\n", {
	"b.sn": "`d.sn`@~\nv : x ? x + w\n",
	"c.sn": "`d.sn`@~\nv : x ? x + 100\n",
	"d.sn": "w : 7\n",
});
agree("引いた側が先：自分の定義が断られる", "`m.sn`@~\nfoo : x ? x + 2\nfoo 1\n", {
	"m.sn": "foo : x ? x + 1\nfoo 1\n",
});
agree("自分が先：引いた側が断られる", "foo : x ? x + 2\n`m.sn`@~\nfoo 1\n", {
	"m.sn": "foo : x ? x + 1\nfoo 1\n",
});

// --- 2. 断りは information で出る -----------------------------------------
//
// **止めはしない。書けるが、気付ける**（利用者：「後からのものは infomation だけ出す」）。

{
	const d = front("a : 1\na : 2\na\n");
	check("断り：1件だけ出る", d.length, 1);
	check("断り：重さは information", d[0].level, "information");
	check("断り：理由を名指しする", d[0].reason, "redefinition-refused");
	check("断り：名前を言う", d[0].message.includes("'a'"), true);

	// **出所の枚と、その枚の何番目の文かを言う。** 行番号は言えない——パーサーはコメントを
	// 落とし、字句は位置を持たない。ひし形で知りたいのは「**どちらの枚か**」なので、
	// 枚と文の順番で足りる。
	const dia = front("`b.sn`@~\n`c.sn`@~\nv 1\n", {
		"b.sn": "v : x ? x + 1\n",
		"c.sn": "v : x ? x + 2\n",
	});
	check("断り：ひし形は両方の枚を名指しする", [dia.length, dia[0].message.includes("b.sn の 1 番目の文"), dia[0].message.includes("c.sn の 1 番目の文")], [1, true, true]);
}

// --- 3. 空振りしていないこと（否定対照） ----------------------------------
//
// 「1件出た」は、**出ない入力で出ないこと**と対でしか意味を持たない。

check("否定対照：再定義が無ければ0件", front("a : 1\nb : 2\na + b\n").length, 0);
check("否定対照：別々の名前は断らない", front("f : x ? x + 1\ng : x ? x + 2\nf 1\n").length, 0);
// **仮引数・局所の束縛は定義ではない。** 見るのはトップレベルの文だけである。
check("否定対照：同じ綴りの仮引数は断らない", front("f : x ? x + 1\ng : x ? x + 2\nf 1 + g 1\n").length, 0);
check("否定対照：同じ枚を2回引いても断らない（撒くのは1度だけ）", front("`m.sn`@~\n`m.sn`@~\nfoo 1\n", { "m.sn": "foo : x ? x + 1\n" }).length, 0);

// --- 4. 糖衣が置き換える名前は除く ----------------------------------------
//
// ストリームの均しは**元の名前をわざと再定義**して、後の方をカーソルの入口にする
// （`markCursorEntries`）。そこは「2つ書かれた」のではなく「1つを書き換えた」である。
// 先勝ちで落とすと均しが効かない——実測で qemu 17 件と stream_desugar 1 件が落ちた。

{
	const src = "sep : [~s] ?\n\t!s : __\n\t(s ' 0) , (sep (s ' 1~))\nsep [1 2 3]\n";
	const plain = compile(src, { charset: "ascii" });
	const sugar = compile(src, { charset: "ascii", desugarStreams: true });
	const defsOf = (c, name) =>
		c.nodes.filter((n) => n && n.type === "operation" && n.name === "define" && n.left && n.left.value === `<${name}>`).length;
	check("糖衣：均さなければ定義は1つ", defsOf(plain, "sep"), 1);
	// 均した側は元の名前が2つ残る（前が元の関数、後がカーソルの入口）。先勝ちで落として
	// いたらここが 1 になり、入口が消える。
	check("糖衣：均すと定義は2つ残る（除外が効いている）", defsOf(sugar, "sep") > 1, true);
	check("糖衣：除外した名前は断らない", sugar.diagnostics.filter((d) => d.reason === "redefinition-refused").length, 0);
}

// --- 5. 定義は使う行より先へ並べ直される -----------------------------------
//
// `1_definition.md` §6.3：「関数本体・トップレベル宣言は Pass 1 の前方参照解決
// （順序非依存）により真に宣言的である」。機械は元から満たしていた——束縛を名前で遅く
// 解くからである。**解釈器だけが満たしていなかった**：上から1文ずつ走らせるので、
// `b : a + 10` を評価する時点で `a` がまだ束縛されておらず `__` を読む。しかも
// 「未定義識別子」と名乗る——`a` は2行下に在るので、言っていることが嘘だった。
//
//   b : a + 10 / a : 1 / b        解釈器 10 / 機械 11
//   p : [q 2 3] / q : 1 / p ' 0   解釈器 2  / 機械 1   ← 器の**長さ**が割れる
//
// 後者が重い。`q` が `__` になると構築がそれを落とすので、同じ器が長さ 2 と 3 になる。
// 直したのは `compile` の `orderDefinitions`——列の側で並べ直すので、解釈器も Pass 4 も
// 同じ列を読む（`interpreter.js` は無改造）。

agree("前方参照：値", L("b : a + 10", "a : 1", "b"));
agree("前方参照：器は要素まで揃う", L("p : [q 2 3]", "q : 1", "p ' 0"));
agree("前方参照：器の長さそのもの", L("p : [q 2 3]", "q : 1", "||p||"));
agree("前方参照：2段", L("c : b + 1", "b : a + 1", "a : 1", "c"));
agree("前方参照：ラムダは元から無事（相互再帰）", L("even : n ?", T + "n = 0 : 1", T + "odd (n - 1)", "odd : n ?", T + "n = 0 : 0", T + "even (n - 1)", "even 4"));
agree("前方参照：ラムダが後ろの値を引く", L("f : x ? x + k", "k : 5", "f 1"));

// **最後の文は動かさない。** プログラムの値だからである（`_.main` が返す）。
// 引っぱり上げの対象から外してあることを、その最後の文が参照される形で見る。
agree("並べ直し：最後の文が定義でも値は変わらない", L("b : a + 1", "b", "a : 1"));
agree("並べ直し：順に書いた形は今までどおり", L("a : 1", "b : a + 10", "b + a"));

// **ラムダの並びは動かない。** 辺を張るのは値の定義と式からだけで、ラムダの本体からは
// 辿らない——ラムダは両方の実装で名前を呼び出し時に解くので、動かす必要がそもそも無い。
//
// **動かすと壊れる所が在った。** ストリームの糖衣は群の名前を `funcs[0].name`、つまり
// **並びの先頭の仲間**から採る（`stream_desugar.js`）。相互再帰の対が入れ替わると
// 生成される名前が `p_adv` から `q_adv` へ動き、呼ぶ側（pass3 が `cursorGroup` から
// 組み立てる）と食い違って、リンクが `undefined symbol: p_adv` で落ちた（実測 qemu 5件）。
{
	// `k` は値の定義なので `p` を引っぱり上げる。そこで `p` の本体まで辿ると `q` が
	// 先に積まれ、対が入れ替わる——辿らないので入れ替わらない。
	const src = L("k : p 1", "p : n ?", T + "n = 0 : 1", T + "q (n - 1)", "q : n ?", T + "n = 0 : 0", T + "p (n - 1)", "k");
	const c = compile(src, { charset: "ascii" });
	const names = c.nodes
		.filter((n) => n && n.type === "operation" && n.name === "define" && n.left && n.left.value)
		.map((n) => n.left.value)
		.filter((x) => x === "<p>" || x === "<q>");
	check("並べ直し：相互再帰の対は並びが変わらない", names, ["<p>", "<q>"]);
	check("並べ直し：値の定義は引っぱり上げられている", c.nodes[0].left.value !== "<k>", true);
}
agree("並べ直し：ラムダを引く値も揃う", L("k : p 1", "p : n ?", T + "n = 0 : 1", T + "q (n - 1)", "q : n ?", T + "n = 0 : 0", T + "p (n - 1)", "k"));

// **循環は繕わない**（`a : b + 1` と `b : a + 1`）。並べ直しでは決着しないので元の順に
// 任せる。機械はそこを断るので、値の一致ではなく「断られること」で覆う。
{
	const cyc = compile(L("a : b + 1", "b : a + 1", "a"), { charset: "ascii" });
	const r = generateAsm(cyc.nodes, cyc.env, ASM);
	check("循環：機械は断る（並べ直しは手を出さない）", r.diagnostics.length > 0, true);
}

// --- 6. 構造体の上書きとマージ ---------------------------------------------
//
// **マージは先勝ちの話ではない。** 器へ入れる形（`a~ b~`）は受け手が違うので規則が違って
// よく、そちらは**後勝ち**である（`interpreter.js` の `器へ入れる形` の注記、`pass3.js` の
// 同項）。先勝ちが効くのは「**同じ名前をトップレベルでもう一度定義した**」ときだけで、
// マージそのものには手を出していない。
//
// **検査の穴が在った。** マージの検査（`layout.test.js`・`interpreter.test.js`）は全部
// **左辺の名前が違う**形（`s : q~ r~` / `q : p~ [...]~`）で、`p : p~ ...` という
// 自分を束縛し直す形が1本も無かった。そこが先勝ちで意味の変わる唯一の場所である。
//
// そして**その形は先勝ちの前から割れていた**：`p : p~ q~` は解釈器が 20 を返し、機械は
// 「器の構築はまだ出せません」と断って、**前段の診断は0件**だった。今は両方が同じ値を返し、
// information が1件出る。

{
	const P = L("p : [", T + "x : 1", T + "y : 2", "]");
	const Q = L("q : [", T + "y : 20", "]");

	// 自分を束縛し直す形——2つ目の定義は断られるので、`p` は最初のままである。
	agree("構造体：自分を束縛し直すマージ", P + Q + L("p : p~ q~", "p ' 1"));
	agree("構造体：自分を束縛し直すマージ（字面）", P + L("p : p~ [", T + "y : 20", "]~", "p ' 1"));
	agree("構造体：丸ごと再定義", P + L("p : [", T + "x : 7", T + "y : 8", "]", "p ' 0"));
	check("構造体：自分を束縛し直すと断りが1件", front(P + Q + L("p : p~ q~", "p ' 1")).map((d) => d.reason), ["redefinition-refused"]);

	// **名前を変えれば今までどおり。** ここが動いたらマージ自体を壊している。
	agree("構造体：別名マージ", P + Q + L("r : p~ q~", "r ' 1"));
	agree("構造体：別名マージ（字面）", P + L("r : p~ [", T + "y : 20", "]~", "r ' 1"));
	agree("構造体：別名マージしても元は無事", P + Q + L("r : p~ q~", "p ' 1"));
	check("構造体：別名マージは断らない", front(P + Q + L("r : p~ q~", "r ' 1")).length, 0);

	// **マージの中は後勝ちのまま。** 受け手が違うので規則が違ってよい。
	agree("構造体：マージの中は後勝ち", L("a : [", T + "k : 1", "]", "b : [", T + "k : 9", "]", "s : a~ b~", "s ' 0"));
	agree("構造体：マージの中は後勝ち（3枚）", L("a : [", T + "k : 1", "]", "b : [", T + "k : 9", "]", "c : [", T + "k : 7", "]", "s : a~ b~ c~", "s ' 0"));

	// **後勝ちが要るなら中置 `#`**（利用者の裁定 2026-09-18）。逃げ道が残っていること。
	agree("構造体：`#` で上書きする道は残っている", P + L("($p) # 99", "p ' 0"));

	// **スロットの鍵はトップレベルの名前ではない。** 見るのはトップの文だけである。
	agree("構造体：スロット名がトップの名前と同じでも触らない", L("x : 100", "p : [", T + "x : 1", "]", "p ' 0"));
	agree("構造体：別々の器が同じ鍵を持っても断らない", L("a : [", T + "k : 1", "]", "b : [", T + "k : 9", "]", "a ' 0 + b ' 0"));
	check("構造体：同じ鍵を持つ別の器は断りを出さない", front(L("a : [", T + "k : 1", "]", "b : [", T + "k : 9", "]", "a ' 0 + b ' 0")).length, 0);
}

if (skipped > 0) console.log(`（実機の ${skipped} 件は飛ばした）`);
console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
