/**
 * **同じ名前の定義は、先に書いた方が勝つ**——その1つの規則を、2つの実装で見る門。
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
 * 実行: node test/first_wins.test.js
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

if (skipped > 0) console.log(`（実機の ${skipped} 件は飛ばした）`);
console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
