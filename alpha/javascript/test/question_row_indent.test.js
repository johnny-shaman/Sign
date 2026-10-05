/**
 * **`?` の行は、定義の行から1段だけ字下げする**（利用者の裁定 2026-10-05）。
 *
 *     f :                f : x y
 *     		x            	? x + y
 *     		y : 3
 *     	? x + y
 *
 * 仮引数のブロックは2段、`?` は1段、本体をブロックで書くなら本体も2段（深さ k の定義なら k+2・k+1・k+2）。
 * 括りの仮引数のブロック（`[` … `]`）も同じ字下げで書き、`?` は閉じの次の行に置く。形は1つだけである。
 *
 * 門は前処理（`lexer.js` の `refuseMisplacedQuestionRow` と `questionAfterClose`、理由 `question-row-indent`）で、
 * 解釈器と機械の共通の前段 `compile` が投げる。`?` で始まる行は続きの行なので、後の段（Pass 2・parser.sn）には前の行へ
 * つないだ後の1行しか届かない——`y : 3`⏎`\t\t? x + y` と1行に書いた `y : 3 ? x + y` は同じ木である。だから門は字句の
 * 段に置く。Sign 側の同じ門（preprocess.sn の `q_bad`）との突き合わせは preprocess_sn.test.js が同じ表で見る。
 *
 * 表（断る綴り・残る綴り）は question_rows.js の1つ。ここでは:
 *   1. 断る綴りは全部 `compile` が名指しで断る（`question-row-indent`）。門を外すと全部が赤い。
 *      「0桁目だけ」「仮引数と同じ深さだけ」に狭めても、`?` より深い仮引数の行の段を見なくても、仮引数の行が
 *      字下げを深くして開いた段かを見なくても、括りの閉じの行の `?` を見なくても、それぞれ残りの行が赤い。
 *   2. 残る綴りは値が出る（門が広すぎて正しい字下げまで断れば、こちらが赤い）。
 *   3. 断りは何をどこへ置くかを言い、置いた所が何の続きになるかを言い分ける。
 *   4. 取り込んだモジュールの中でも断る（取り込みも同じ前処理を通る）。
 *   5. 深さ2の定義（入れ子の入れ子）でも k+2・k+1・k+2。
 *
 * 実行: node test/question_row_indent.test.js
 */
import { compile } from "../compile.js";
import { newRuntimeEnv, evaluate, UNIT, isUnit, observe } from "../interpreter.js";
import { REFUSED, KEPT, PASSES } from "./question_rows.js";

let passed = 0;
let total = 0;
function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
	if (!ok) console.log(`     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
}

const T = String.fromCharCode(9);
const N = String.fromCharCode(10);
const src = (...lines) => lines.join(N);
const MODS = {
	"old_layout.sn": src("#f :", T + "x", T + "y : 3", "? x + y", ""),
	"canonical.sn": src("#f :", T + T + "x", T + T + "y : 3", T + "? x + y", ""),
};
const readImport = (p) => {
	const name = String(p).split(/[\\/]/).pop();
	if (MODS[name] === undefined) throw new Error(`この試験に無いモジュール: ${name}`);
	return MODS[name];
};
const refusal = (source) => {
	try {
		compile(source, { readImport, charset: "ascii" });
		return "通った";
	} catch (e) {
		return `${e.name} / ${e.reason || "(理由なし)"}`;
	}
};
const messageOf = (source) => {
	try {
		compile(source, { readImport, charset: "ascii" });
		return "";
	} catch (e) {
		return String(e.message);
	}
};
const value = (source) => {
	const { nodes } = compile(source, { readImport, charset: "ascii" });
	const env = newRuntimeEnv();
	let r = UNIT;
	for (const n of nodes) r = evaluate(n, env);
	return isUnit(r) ? "__" : observe(r);
};
const REFUSED_BY_NAME = "OperationError / question-row-indent";

// ---- 1. 断る綴り ----
for (const [note, s] of REFUSED) check(`断る：${note}`, refusal(s), REFUSED_BY_NAME);

// ---- 2. 残る綴り ----
for (const [note, s, want] of KEPT) {
	let got;
	try {
		got = value(s);
	} catch (e) {
		got = `断った：${e.reason || e.message.slice(0, 40)}`;
	}
	// 値が誤読の綴りは、門を通ることだけを見る（question_rows.js の PASSES）。
	if (want === PASSES) check(`通る：${note}`, String(got).startsWith("断った：question-row-indent"), false);
	else check(`通る：${note}`, got, want);
}

// ---- 3. 断りの文面 ----
// 何をどこへ置くか（定義の行から1段）を必ず言い、置いた `?` がどこの続きになるかを言い分ける。
{
	const rule = "`?` で始まる行は、定義の行から1段だけ字下げします";
	for (const [note, s] of REFUSED) check(`断りは置き場所を言う（${note}）`, messageOf(s).includes(rule), true);
	const said = (s) => messageOf(s).split("）。この行")[1] || "";
	check(
		"0桁目の ? は「定義の行の続き」と言う",
		said(src("f :", T + T + "x", "? x", "f 1")).includes("同じ深さに書いた行（定義の行）の続き"),
		true
	);
	check(
		"仮引数と同じ深さの ? は「最後の仮引数の行に付く」と言う",
		said(src("f :", T + T + "x", T + T + "? x", "f 1")).includes("最後の仮引数の行に付きます"),
		true
	);
	check(
		"定義の行から2段の ? は段の数を言う",
		said(src("f :", T + T + T + "x", T + T + "? x", "f 1")).includes("2 段下がっています"),
		true
	);
	check("断りは置いた行を綴りのまま見せる", messageOf(src("f :", T + "x", "? x + 1", "f 1")).includes("`? x + 1`"), true);
	check(
		"仮引数3段の ? は仮引数の行の段の数を言う",
		said(src("f :", T + T + T + "x", T + "? x", "f 1")).includes("仮引数の行が定義の行から 3 段下がっています"),
		true
	);
	check(
		"3段から2段へ戻した仮引数の ? は「2段の所で始まっていない」と言う",
		said(src("f :", T + T + T + "x", T + T + "y", T + "? x", "f 1")).includes("2段の所で始まっていません"),
		true
	);
	check(
		"括りの閉じの行の ? は「閉じの後ろに続けている」と言う",
		said(src("f :", T + T + "[", T + T + T + "x", T + T + "] ? x", "f [1]")).includes("閉じの後ろに `?` を続けています"),
		true
	);
}

// ---- 4. 取り込み ----
check("取り込んだモジュールの古い字下げも断る", refusal(src("`old_layout.sn`@~", "f 1")), REFUSED_BY_NAME);
check("取り込んだモジュールの正しい字下げは通る", value(src("`canonical.sn`@~", "f 1")), 4);

// ---- 5. 深さ2の定義 ----
{
	const at2 = (rows, q, body) => src("h :", T + "g :", T + T + "f :", ...rows, T.repeat(q) + body, T + T + "f 1", T + "g + 0", "h");
	const rows4 = [T.repeat(4) + "x", T.repeat(4) + "y : 3"];
	check("深さ2の定義：仮引数4段・? は3段", value(at2(rows4, 3, "? x + y")), 4);
	check("深さ2の定義：? が定義と同じ2段", refusal(at2(rows4, 2, "? x + y")), REFUSED_BY_NAME);
	check("深さ2の定義：? が仮引数と同じ4段", refusal(at2(rows4, 4, "? x + y")), REFUSED_BY_NAME);
	check("深さ2の定義：? が外の定義の深さ（1段）", refusal(at2(rows4, 1, "? x + y")), REFUSED_BY_NAME);
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
