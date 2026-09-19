/**
 * **どの演算が「和のまま」の値を受けるのか。その表を、2つの実装で見る門。**
 *
 * 同じ枡に収まる直和（`Address | Int` はどちらも GPR 1語）は `layout.js` の join を通るので、
 * **和のまま演算へ流れ込む**。そのとき演算は「どの枝か分からない値」を受け取ることになる。
 * 受けてよい演算と、受けてはいけない演算が在る。
 *
 * ## `@` の域が書かれていなかった（2026-09-20 に直した）
 *
 * `+` は `pass4.js` で「GPR 幅の整数演算だけを出せます（Address | Int）」、`=` は「GPR 幅の値の
 * 比較だけを出せます」と名指しして断っていた。ところが前置 `@`（番地から読む）は
 * **オペランドの型を1度も見ずに `ldr` を出していた**——見ていたのは指す先の幅・幅プリフィックス・
 * 番地が定数に畳めるか の3つで、どれも「**その値が番地なのか**」を問うていない。
 *
 * 実測（この門の §1 がそのまま再現する）：
 *
 *     f : x ?
 *     	x > 3 : 42          ` Int
 *     	0x40000000          ` Address       → f の型は Address | Int
 *     g : y ? @(f y)
 *
 * 実機が **42 を番地として読んでスタックを踏み抜いた**。前段の診断は0件。C の型混同
 * （int をポインタとして逆参照）と同じ形である。
 *
 * **これは門を足したのではなく、域が広く書かれていたのを直した。** 演算は「左辺が選ぶ域 →
 * 結果 | `__`」の射で決まるので、`@` の域は `Address` であって `Address | Int` ではない。
 * `+` と `=` は域を正しく書いていて、`@` だけが広く書いていた。
 *
 * ## 断るのは和のときだけである
 *
 * 型が決まっていない（`null`・`Atom`）ものには手を出さない。分からないことに答えないのは
 * 原理4 の側であり、そこを断ると**通っていたプログラムが止まる**。§3 の否定対照がそれを見る。
 *
 * ## `&` / `|` / `!` が通るのは、まだ裁定が無い
 *
 * 値は両エンジンで一致するので穴ではない。ただし `+` / `=` / `@` と非対称である。
 * 「爆発律＝try/catch/finally」を採れば `|` は域を選ばないのが正しいし、逆に `+` が過剰に
 * 断っている筋も立つ。**いまの姿を記録して覆う**——裁定が出て振る舞いが変わった日に、
 * この節が落ちて書き換えを促す（`corpus.js` の「既知の1件を除外せず記録して覆う」と同じ作法）。
 *
 * 実行: node test/coproduct_domain.test.js
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

// **入っていないことと落ちることは別。** 断りの言い分はコンパイルだけで見られる。
const HW = available();
if (!HW) console.log(`実機は飛ばす（${toolReport()}）——断りの言い分だけ見る`);

const ASM = { target: "aarch64_qemu", charset: "ascii", layer: 1 };
const T = String.fromCharCode(9);
const L = (...xs) => xs.join(String.fromCharCode(10)) + String.fromCharCode(10);

// **和を作る種。** 真の枝が `Int`（42）、偽の枝が `Address`（0x40000000）。
// どちらも GPR 1語なので layout の join を通り、`f` の返り値が `Address | Int` になる。
const F = L("f : x ?", T + "x > 3 : 42", T + "0x40000000");

function interp(source) {
	const { nodes } = compile(source, { parse: parser.parse, charset: "ascii" });
	const env = newRuntimeEnv(null, "ascii");
	let r = UNIT;
	for (const node of nodes) r = evaluate(node, env);
	if (isUnit(r)) return "__";
	const o = observe(r);
	if (o === undefined || o === null) return "__";
	if (typeof o === "string" && [...o].length === 1) return String(o.codePointAt(0));
	return String(o);
}

function asmOf(source) {
	const { nodes, env } = compile(source, { charset: "ascii" });
	return generateAsm(nodes, env, ASM);
}

function machine(source) {
	const r = asmOf(source);
	if (r.diagnostics.length) return "断る：" + r.diagnostics[0].message;
	const v = asInt(runAsm(r.text)[0]);
	return v === null ? "__" : String(v);
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

/** その綴りは**名指しで断られる**か。理由の言い分まで見る（別の理由で止まっても「断った」にはなる）。 */
function refuses(note, source, needle) {
	total++;
	let msg = "（診断が出なかった）";
	try {
		const r = asmOf(source);
		if (r.diagnostics.length === 0) {
			msg = "（診断が出なかった）";
		} else if (!r.diagnostics[0].message.includes(needle)) {
			msg = "別の理由：" + r.diagnostics[0].message;
		} else {
			passed++;
			console.log(`ok   ${note.padEnd(38)} ${r.diagnostics[0].message.replace(/（.*/, "").slice(0, 34)}`);
			return;
		}
	} catch (e) {
		msg = "例外：" + e.message;
	}
	console.log(`FAIL ${note.padEnd(38)} ${msg}`);
}

/** その綴りは**出せる**か（断られないこと）。 */
function emits(note, source) {
	total++;
	try {
		const r = asmOf(source);
		if (r.diagnostics.length === 0) {
			passed++;
			console.log(`ok   ${note}`);
			return;
		}
		console.log(`FAIL ${note}\n       断られた：${r.diagnostics[0].message}`);
	} catch (e) {
		console.log(`FAIL ${note}\n       例外：${e.message}`);
	}
}

/** 同じソースを両方へ通し、**一致すること**だけを見る。期待値は書かない。 */
function agree(note, source) {
	if (!HW) {
		skipped++;
		return;
	}
	total++;
	let a, b;
	try { a = interp(source); } catch (e) { a = "解釈で例外：" + e.message; }
	try { b = machine(source); } catch (e) { b = "機械で例外：" + e.message; }
	if (a === b) {
		passed++;
		console.log(`ok   ${note.padEnd(38)} ${a}`);
	} else {
		console.log(`FAIL ${note.padEnd(38)} 解釈=${a} / 機械=${b}`);
	}
}

// --- 0. 種が本当に和になっているか ----------------------------------------
//
// **ここが崩れると、以下の全部が空振りする。** 和を作れていないのに「断った」を見ても
// 意味が無い（[[project_sign_parasitic_oracle]]——オラクルが副産物だと黙って空振りする）。
{
	const { nodes } = compile(F + L("g : y ? @(f y)", "g 5"), { charset: "ascii" });
	let found = null;
	const walk = (n) => {
		if (!n || typeof n !== "object" || found) return;
		if (n.type === "operation" && n.position === "prefix" && n.name === "input") { found = n.operand && n.operand.atomType; return; }
		for (const k of ["left", "right", "operand", "middle"]) walk(n[k]);
		for (const l of n.lines || []) walk(l);
	};
	for (const n of nodes) walk(n);
	check("種：`@` のオペランドは和である", found, "Address | Int");
}

// --- 1. 和を受けない演算（域が書かれている） ------------------------------

refuses("`@`：和は番地として読まない", F + L("g : y ? @(f y)", "g 5"), "番地から読めるのは番地だけです");
refuses("`@`：低い枝でも同じ", F + L("g : y ? @(f y)", "g 1"), "番地から読めるのは番地だけです");
refuses("`+`：和は算術に乗らない", F + L("g : y ? (f y) + 1", "g 5"), "GPR 幅の整数演算だけを出せます");
refuses("`=`：和は比較に乗らない", F + L("g : y ? (f y) = 1", "g 5"), "GPR 幅の値の比較だけを出せます");
// 言い分に**型がそのまま載る**こと。載らないと、どの和で止まったのか言えない。
check(
	"`@`：断り文句に和の綴りが載る",
	asmOf(F + L("g : y ? @(f y)", "g 5")).diagnostics[0].message.includes("Address | Int"),
	true
);

// --- 2. 和を受ける演算（いまの姿。裁定が出たら書き換える） ------------------
//
// 値が両エンジンで一致するので穴ではない。ただし §1 と非対称であり、裁定待ちである。

emits("`&`：和を受ける（断らない）", F + L("g : y ? (f y) & 1", "g 5"));
emits("`|`：和を受ける（断らない）", F + L("g : y ? (f y) | 1", "g 5"));
emits("そのまま返す：和を受ける（断らない）", F + L("g : y ? f y", "g 5"));
agree("`&`：値は揃う", F + L("g : y ? (f y) & 1", "g 5"));
agree("`|`：値は揃う", F + L("g : y ? (f y) | 1", "g 5"));
agree("そのまま返す：値は揃う", F + L("g : y ? f y", "g 5"));
agree("そのまま返す：低い枝も揃う", F + L("g : y ? f y", "g 1"));

// --- 3. 否定対照：断るのは和のときだけである ------------------------------
//
// **ここが一番大事な節である。** 域の門は「分からないもの」まで断ってはいけない
// ——型が決まらない値の `@` は今まで通り通らなければ、動いていたプログラムが止まる。

emits("否定対照：番地だけなら `@` は通る", L("p : [", T + "x : 7", "]", "@$p"));
emits("否定対照：仮引数（型が決まらない）の `@` は通る", L("h : q ? @q", "p : [", T + "x : 7", "]", "h $p"));
emits("否定対照：定数の番地の `@` は通る", L("@0x40000000"));
emits("否定対照：和でない返り値の `@` は通る", L("k : z ?", T + "z > 3 : $z", T + "$z", "h : y ? @(k y)", "h 5"));
// **値を突き合わせる形は選ぶ。** 解釈器は参照をセル（getter/setter）でモデルし、機械は整数
// である——器を指す `@$p` をそのまま観測すると、片方はセル・片方は1語の中身になって、
// 割れているように見えるだけになる（`qemu.test.js` の `machineIs` の注記と同じ境界）。
// スカラーか、スロットまで降りた形で見る。
agree("否定対照：番地だけの `@` は値も揃う（スカラー）", L("p : 7", "q : @$p", "q"));
agree("否定対照：番地だけの `@` は値も揃う（スロットまで降りる）", L("p : [", T + "x : 7", "]", "(@$p) ' 0"));

// --- 4. 和そのものは作れる（門が和を殺していないこと） ---------------------
//
// `@` を断るのは「番地として読むこと」であって、和を作ること・運ぶことではない。

emits("和は作れる（返り値として）", F + L("f 5"));
agree("和は運べる（高い枝）", F + L("f 5"));
agree("和は運べる（低い枝）", F + L("f 1"));

if (skipped > 0) console.log(`（実機の ${skipped} 件は飛ばした）`);
console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
