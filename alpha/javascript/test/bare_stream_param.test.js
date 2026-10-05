/**
 * **裸のストリーム仮引数は名指しで断る**（利用者の裁定 2026-10-04）。
 *
 * 括りの外の `~名前`——`f : x ~xs ?`・`f : ~this ?`・仮引数のブロックの `~xs` の行——は廃止した。
 * 器を受けるのは括りだけである：丸ごと受けるなら `[~xs]`、頭と残りに割るなら `[x ~xs]`
 * （並べた実引数も括り1つの器になる——`f 1 2 3` は `f (1 2 3)`）。
 *
 * 門は pass2 の `buildParameterList`（仮引数の並びを組む所）の1か所で、解釈器と機械（Pass 4）の
 * 共通の前段 `compile` が投げる。だから綴りを compile に掛ければ、両方のエンジンの入口を見たことに
 * なる。表は**書ける置き場の全部**で引く：1行・ブロック・既定値つき（`~` が行の頭でなくても）・括りや
 * 丸括弧と同じ行・字下げを深くした続きの行・二段の字下げ・解けない形の行と同じブロック・ラムダの中・
 * 枝の中・`$` で物にした形・export・取り込み。門を1行の形だけにしても、ブロックの形だけにしても、
 * ここが赤くなる。
 *
 * 括りの形（残るもの）は通って値が出ることも見る——門が広すぎて括りまで断れば、こちらが赤くなる。
 *
 * 前の試験 rest_param_typecheck.test.js（coproduct_resolver.md §5.4：裸の rest へ `~` の無い List を
 * 渡すと TypeError）は、対象の形ごと無くなったので消した。
 *
 * 実行: node test/bare_stream_param.test.js
 */
import { compile } from "../compile.js";
import { newRuntimeEnv, evaluate, UNIT, isUnit, observe } from "../interpreter.js";

let passed = 0;
let total = 0;
function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
	if (!ok) console.log(`     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
}

// 取り込み：裸のストリーム仮引数を export するモジュール、内側の補助に書いたモジュール、括りで書いたモジュール
const MODS = {
	"bs_mod.sn": "#f : x ~xs ? x\n",
	"bs_helper_blk.sn": "g :\n\t\tx ~xs : 3\n\t? x\n#f : y ? g y 2\n",
	"ok_mod.sn": "#f : [x ~xs] ? x\n",
};
const readImport = (p) => {
	const name = String(p).split(/[\\/]/).pop();
	if (MODS[name] === undefined) throw new Error(`この試験に無いモジュール: ${name}`);
	return MODS[name];
};
const NL = String.fromCharCode(10);
const TB = String.fromCharCode(9);
const src = (...lines) => lines.join(NL);

// 断りの理由（reason）と、断った名前。通ったら「通った」。
const refusal = (source) => {
	try {
		compile(source, { readImport, charset: "ascii" });
		return "通った";
	} catch (e) {
		return `${e.name} / ${e.reason || "(理由なし)"}`;
	}
};
const value = (source) => {
	const { nodes } = compile(source, { readImport, charset: "ascii" });
	const env = newRuntimeEnv();
	let r = UNIT;
	for (const n of nodes) r = evaluate(n, env);
	return isUnit(r) ? "__" : observe(r);
};

const REFUSED = "OperationError / bare-stream-param";

// ---- 断る綴り（置き場ごと） ----
const BAD = [
	["1行", src("f : x ~xs ? x", "f 1 2 3")],
	["1行・~this だけ", src("f : ~this ? this", "f 1")],
	["1行・頭が2つ", src("f : a b ~cs ? a", "f 1 2 3")],
	["1行・rest の後ろに仮引数", src("k : y ~ys z ? z", "k 1 2 3")],
	["1行・rest が2つ（rest の数より先に形で断る）", src("f : x ~xs ~ys ? xs", "f 1 2 3")],
	["1行・撒いて呼ぶ", src("f : x ~xs ? ||xs||", "f [1 2 3]~")],
	["1行・混在形の後ろ", src("f : a [h ~t] ~r ? h", "f 0 [5 6] 7")],
	["ブロック", src("f :", TB + TB + "x", TB + TB + "~xs", TB + "? x", "f 1 2 3")],
	["ブロック・~xs だけ", src("f :", TB + TB + "~xs", TB + "? xs", "f 1")],
	["ブロック・1行に x ~xs", src("f :", TB + TB + "x ~xs", TB + "? x", "f 1 2")],
	["ブロック・括りの行の後ろ", src("f :", TB + TB + "[a b]", TB + TB + "~xs", TB + "? a", "f [1 2] 3")],
	["ブロック・既定値（平ら）", src("f :", TB + TB + "x", TB + TB + "~xs : 1", TB + "? x", "f 1")],
	["ブロック・既定値（括り）", src("f :", TB + TB + "x", TB + TB + "~xs : [1 2]", TB + "? x", "f 1")],
	["ブロック・既定値の後ろ", src("f :", TB + TB + "y : 3", TB + TB + "x ~xs", TB + "? x", "f 1 2")],
	// 行の頭でない `~名前` の後ろに既定値——`:` の枝が頭の1語だけを名前にして `~xs` を黙って捨てていた
	// （解釈器は 0、機械は「出せない識別子」で割れていた）。
	["ブロック・x ~xs : 3", src("f :", TB + TB + "x ~xs : 3", TB + "? ||xs||", "f 1")],
	["ブロック・a ~this : 0", src("f :", TB + TB + "a ~this : 0", TB + "? this", "f 1")],
	["export のブロック・x ~xs : 3", src("#f :", TB + TB + "x ~xs : 3", TB + "? ||xs||", "f 1")],
	["取り込んだモジュールの内側の補助（x ~xs : 3）", src("`bs_helper_blk.sn`@~", "f 1")],
	// 名前が括りの `~[a b]`、括り・丸括弧と同じ行の `~r`、字下げを深くした続きの行——行を文の並びと
	// 読み違えて内部エラー（`lines.flatMap is not a function`）で落ちていた形。
	["ブロック・~[a b]", src("f :", TB + TB + "~[a b]", TB + "? a", "f 1")],
	["ブロック・~[a b] に既定値", src("f :", TB + TB + "x", TB + TB + "~[a b] : 1", TB + "? x", "f 1")],
	["ブロック・括りの後ろの ~r", src("f :", TB + TB + "[h ~t] ~r", TB + "? h", "f [1 2] 3")],
	["ブロック・混在形の後ろの ~r", src("f :", TB + TB + "a [h ~t] ~r", TB + "? h", "f 0 [1 2] 3")],
	["ブロック・丸括弧の後ろの ~xs", src("f :", TB + TB + "(x) ~xs", TB + "? x", "f 1 2")],
	["ブロック・字下げを深くした続きの行", src("f :", TB + TB + "x", TB + TB + TB + "~xs", TB + "? x", "f 1 2")],
	// 二段に字下げした仮引数のブロックは括りではない（括りの中で字句は字下げを INDENT にしない）。
	// 括り `[x ~xs]` と読んで門を素通りしていた。
	["ブロック・二段の字下げ", src("f :", TB + TB + "x", TB + TB + "~xs", "? x", "f 1 2")],
	// `:` の無い続きの行（`x`⏎`\t\ty`）は `~` が無くても前から内部エラーで落ちる形で、行を順に解いていた頃は
	// `~` の行の前に在っても後ろに在っても先に落ちて、名指しの前に止まっていた。
	["ブロック・:の無い続きの行の前の ~zs", src("f :", TB + TB + "~zs", TB + TB + "x", TB + TB + TB + "y", TB + "? x", "f 1 2 3")],
	["ブロック・:の無い続きの行の後ろの ~zs", src("f :", TB + TB + "x", TB + TB + TB + "y", TB + TB + "~zs", TB + "? x", "f 1 2 3")],
	// 1行の仮引数の続きの行——字下げのブロックを括りとして剥がせずに `~xs` ごと黙って捨てていた。
	["1行・字下げを深くした続きの行", src("f : x", TB + "~xs", "? x", "f 1 2")],
	// 1行の形に既定値の書き方は無く `:` も名前として並ぶだけなので、`:` の後ろの続きの行も見る。
	["1行・: の後ろの続きの行", src("f : x : 3", TB + "~y", "? x", "f 1")],
	["1行・rest の後ろに : と既定値", src("f : x ~xs : 3 ? x", "f 1")],
	["1行・後ろに演算子", src("r : ~x + 1 ? x", "r 1")],
	["1行・~[a b]", src("f : ~[a b] ? a", "f 1")],
	["1行・~~xs", src("f : x ~~xs ? x", "f 1")],
	["1行・~@u", src("f : ~@u ? u", "f 1")],
	["本体に書いたラムダ", src("f : x ? g ~y ? y", "f 1")],
	["名前の無いラムダ", src("g : y ? (x ~xs ? x) y", "g 1")],
	["枝の中", src("g : y ?", TB + "y > 0 : (x ~xs ? x) y", TB + "0", "g 1")],
	["既定値に書いたラムダ", src("g :", TB + TB + "h : x ~xs ? x", TB + "? h 1 2", "g")],
	["$ で物にした形", src("h : $(x ~xs ? x)", "@h 1 2")],
	["$ で名前を物にする", src("f : x ~xs ? x", "h : $f", "@h 1 2")],
	["export", src("#f : x ~xs ? x", "f 1 2")],
	["export ##", src("##f : x ~xs ? x", "f 1 2")],
	["取り込み", src("`bs_mod.sn`@~", "f 1 2")],
	["演算子を潰す見本の旧綴り", src("[+] : ~x ? __", "1 + 2")],
];
for (const [note, s] of BAD) check(`断る：${note}`, refusal(s), REFUSED);

// 断りは名前を言う（どの `~名前` が廃止された形なのか）。
{
	let msg = "";
	try {
		compile(src("walk : line ~rest ? line", "walk 1 2"), { charset: "ascii" });
	} catch (e) {
		msg = String(e.message);
	}
	check("断りは名前を言う（`~rest`）", msg.includes("`~rest`"), true);
	check("断りは括りの綴りを示す", msg.includes("`[line ~rest]`"), true);
}
// 断りは書いた綴りで名指す——内部の字句（`~_`・`@_`・`<a>,<b>`）を文面にもヒントにも出さない。
for (const [note, s, want] of [
	["~[a b]", src("f : ~[a b] ? a", "f 1"), "`~[a b]`"],
	["~~xs", src("f : x ~~xs ? x", "f 1"), "`~~xs`"],
	["~@u", src("f : ~@u ? u", "f 1"), "`~@u`"],
	["ブロックの ~[a b] : 1", src("f :", TB + TB + "x", TB + TB + "~[a b] : 1", TB + "? x", "f 1"), "`~[a b]`"],
]) {
	let msg = "";
	try {
		compile(s, { charset: "ascii" });
	} catch (e) {
		msg = String(e.message);
	}
	check(`断りは書いた綴りで名指す（${note}）`, msg.includes(want), true);
	check(`断りに内部の字句が出ない（${note}）`, /~_|@_|[<>]/.test(msg), false);
}

// ---- 残る綴り（括りの中の rest・点なし・区間・範囲・値の前置 `~`・位置へ撒く） ----
const GOOD = [
	["括り", src("f : [x ~xs] ? x", "f [1 2 3]"), 1],
	["括り・並べた実引数は括り1つの器", src("f : [x ~xs] ? ||xs||", "f 1 2 3"), 2],
	["括り・丸ごと", src("g : [~xs] ? ||xs||", "g 1 2 3"), 3],
	["混在形", src("f : a [h ~t] ? h", "f 0 [5 6]"), 5],
	["ブロックの括り", src("f :", TB + TB + "[", TB + TB + TB + "x", TB + TB + TB + "~y", TB + TB + "]", TB + "? x", "f [4 5]"), 4],
	["括りで受けた場所を括りへ渡す", src("f : [x ~xs] ? x", "g : [~s] ? f s", "g [7 8]"), 7],
	["括りの取り込み", src("`ok_mod.sn`@~", "f [1 2]"), 1],
	["点なし（貪欲）", "[+] 1 2 3", 6],
	["区間", "[+ 1] 2", 3],
	["範囲", "||[1 ~+ 2 ~ 9]||", 5],
	["値の前置 ~", src("f : x ? x", "f ~5"), 5],
	// 撒いた器を何個の実引数と数えるか（`f : a b ?` へ `f [1 2]~`）は別の片で決める。ここは既定値で
	// 埋まる形だけを見る（仮引数のブロックに `~` が無ければ門は当たらない）。
	["位置の仮引数へ撒く", src("m :", TB + TB + "a", TB + TB + "b : 5", TB + "? a + b", "m [1 2]~"), 3],
	// 既定値の式の中の前置 `~` は値の側である（`~@` の Reader・`~5`）。門が見るのは `:` より前だけ。
	["既定値の Reader（~@番地）", src("f :", TB + TB + "x", TB + TB + "r : ~@0x8000", TB + "? x", "f 1"), 1],
	["既定値の値の前置 ~", src("f :", TB + TB + "x", TB + TB + "y : ~5", TB + "? y", "f 1"), 5],
	["既定値を続きの行に書いた前置 ~", src("f :", TB + TB + "x", TB + TB + "y :", TB + TB + TB + "~5", TB + "? y", "f 1"), 5],
	["ブロック・括りの行と名前の行", src("f :", TB + TB + "[x ~xs]", TB + TB + "y", TB + "? y", "f [1 2] 3"), 3],
	// 二段に字下げしても仮引数のブロックである（括り1つではない）——`x`・`y` の2つを受ける。
	["ブロック・二段の字下げは仮引数2つ", src("f :", TB + TB + "x", TB + TB + "y", TB + "? x + y", "f 1 2"), 3],
];
for (const [note, s, want] of GOOD) {
	let got;
	try {
		got = value(s);
	} catch (e) {
		got = `断った：${e.reason || e.message.slice(0, 40)}`;
	}
	check(`通る：${note}`, got, want);
}
// `~` の無い並びはこの門の持ち物ではない——`:` の無い続きの行だけのブロックは前からの内部エラーのままで、
// 廃止した形の断りに数えない（行の形を解く前に拾うのは、`~` の行が在るときだけ）。
check("門は ~ の無い並びを断りに数えない（:の無い続きの行）", refusal(src("f :", TB + TB + "x", TB + TB + TB + "y", TB + "? x", "f 1 2")) !== REFUSED, true);
// 演算子を潰す見本の新しい綴り（利用者の裁定 2026-10-04、AGENTS.md と unit.md §0.3 の見本）にこの門は当たらない。
// 見るのは「この門で断らない」ことだけである——alpha はこの行を演算子の定義として読んでおらず
// （仮引数 `[+]`・`:`・`a`・`b` の名前の無いラムダになり、`1 + 2` は 3 のまま）、通ることを
// 正解として書き置くと、その誤読まで golden になる。
check("この門は演算子を潰す見本の新綴り `[+] : a b ? __` に当たらない", refusal(src("[+] : a b ? __", "1 + 2")) !== REFUSED, true);

// ---- 括りの rest の既定値は今も断るが、`~xs` を stream と呼ばない ----
for (const [note, s] of [
	["1行", src("f : [~xs : 1] ? xs", "f [2]")],
	["ブロック", src("f :", TB + TB + "[", TB + TB + TB + "x", TB + TB + TB + "~xs : 1", TB + TB + "]", TB + "? x", "f [2]")],
	// rest が頭でなくても——頭の1語だけを見ていたので `x` を名前にして `~xs` を黙って捨てていた。
	["rest が頭でない", src("f : [x ~xs : 3] ? x", "f [2]")],
]) {
	let e0 = null;
	try {
		compile(s, { charset: "ascii" });
	} catch (e) {
		e0 = e;
	}
	check(`括りの rest に既定値は断る（${note}）`, e0 && e0.name, "SyntaxError");
	check(`その断りは括りの rest と言う（${note}）`, !!e0 && String(e0.message).includes("括りの rest"), true);
	check(`その断りは stream と言わない（${note}）`, !!e0 && /stream|ストリーム/.test(String(e0.message)), false);
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
