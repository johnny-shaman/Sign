/**
 * **機械の上で、どこまで深く積めるか。積み切ったら何が起きるか。**
 *
 * Sign にはループが無く再帰しか無いので、素直に書いたコードほど深く積む。末尾再帰は
 * TCO（トランポリン）で平らになるが、余積の中の再帰は末尾位置に無いため入力の大きさ
 * ぶんフレームを使う。つまり**スタックの大きさはこの言語では意味論の一部**である。
 *
 * ここが無かった間、スタックは image の直後に置かれ 64KiB しか無かった。`preprocess.sn`
 * は入力1文字あたり 50 バイトを使うので 1300 文字で尽き、そこから先は**自分の命令列を
 * 書き換えながら走る**——1400 文字で入力長を返し（誤答）、1425 文字で止まらなくなり、
 * 1500 文字では `.text` が壊れているのに答えが正しかった。診断は1件も出ない。
 * 2300 文字を超えるとまた全部正しくなる（行き過ぎて image を飛び越すため）ので、
 * 「大きい入力が通った」は証拠にならない。
 *
 * ## オラクルは lexer.js の `preprocess`——インタプリタではない
 *
 * インタプリタは JS のスタックに載っているので、ここで見たい深さまで届かない。そして
 * **期待値が入力長と一致する入力を選んではいけない**：この壊れ方は「入力長を返す」なので、
 * 識別子だけの入力（前処理で長さが変わらない）を使うと誤答が緑で通る。入力は `a+b*c ` で、
 * 前処理が演算子の両側に空白を入れるため出力長は入力長と一致しない。
 *
 * 一致は**長さ**と**位置つきの指紋**（`acc * 31 + 文字` を先頭から畳んだ 64 ビット）で見る。
 * 指紋は1文字でも違えば変わるので、qemu の実行1回で出力全体をバイト単位で比べたことになる。
 * 畳む関数は末尾再帰なので TCO で平らになり、それ自身はスタックを積まない。
 *
 * 実行: node test/stack_depth.test.js（`npm test` からも呼ばれる）
 */
import fs from "fs";
import { blockingOf } from "../errors.js";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";
import { generateAsm } from "../pass4.js";
import { preprocess } from "../lexer.js";
import { runAsm, asInt, available, toolReport, DEFAULT_STACK } from "../qemu_run.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// **インポートを解く手段は呼ぶ側が渡す**（build_system.md §4.2）。`preprocess.sn` は
// 演算子表を読む。
const readImport = (p) => fs.readFileSync(path.join(__dirname, "..", "..", "sign", p), "utf8").replace(/\r\n/g, "\n");

if (!available()) {
	console.log(`ツールチェーンが無いので飛ばす（${toolReport()}）`);
	console.log("\n0/0 passed");
	process.exit(0);
}

let passed = 0;
let total = 0;

function check(note, ok, detail) {
	total++;
	if (ok) {
		console.log(`OK   ${note}`);
		passed++;
	} else {
		console.log(`FAIL ${note}`);
		if (detail) console.log("     " + detail);
	}
}

// 機械側の答え。`_.main` の x0 を符号付き64ビットで読む。踏み抜きは `runAsm` が
// 例外にして投げてくる（start.s の合図を読む）ので、ここでは素通しする。
function machine(source, opts = {}) {
	const { nodes, env } = compile(source, { readImport });
	const r = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii", layer: 1 });
	// **止める診断だけを見る。** information（上界が見積もりである、など）は出力が在るので走らせる。
	const bad = blockingOf(r.diagnostics);
	if (bad.length) throw new Error("出せない：" + bad[0].message);
	return asInt(runAsm(r.text, opts)[0]);
}

// ---- 1. `preprocess.sn` を機械の上で走らせる ----

// 末尾の実行例を落として関数群だけを残す。
const snPath = path.join(__dirname, "..", "..", "sign", "preprocess.sn");
const preprocessBody = fs
	.readFileSync(snPath, "utf8")
	.replace(/\r\n/g, "\n")
	.split("\n")
	.filter((l) => !l.startsWith("preprocess `"))
	.join("\n");

// 入力は `a+b*c ` の繰り返し。バッククォート・バックスラッシュ・改行を含まず、
// **前処理で長さが変わる**（演算子の両側に空白が入る）。
function makeInput(n) {
	let s = "";
	while (s.length < n) s += "a+b*c ";
	return s.slice(0, n);
}

// JS 側の指紋。機械側の `fingerprint` と同じ畳み方（64 ビットで回る）。
function fingerprintJs(text) {
	let h = 0n;
	for (const c of text) h = BigInt.asIntN(64, h * 31n + BigInt(c.codePointAt(0)));
	return h;
}

const FINGERPRINT = ["fingerprint : acc i t ?", "\ti = ||t|| : acc", "\tfingerprint (acc * 31 + (t ' i)) (i + 1) t"].join("\n");

// 以前の 64KiB で壊れていた大きさ。1403 は誤答（入力長を返した）、1523・1763・2243 は
// qemu が返ってこなくなっていた帯の中。
const SIZES = [1403, 1523, 1763, 2243];

for (const n of SIZES) {
	const input = makeInput(n);
	const want = preprocess(input);
	// `fingerprint` は使う側の式にだけ足す。呼ばれない関数として置くと `t ' i` の
	// 型が call site から決まらず pass4 が出せない（ここで見たいものとは別の話）。
	const src = (expr, defs = "") => preprocessBody + defs + "\n\ns : `" + input + "`\n\n" + expr + "\n";

	let got;
	try {
		got = machine(src("||preprocess s||"));
	} catch (e) {
		got = "例外：" + e.message;
	}
	check(`${n} 文字：出力の長さ`, String(got) === String(want.length), `got=${got} want=${want.length}（入力長は ${n}）`);

	const wantFp = fingerprintJs(want);
	let fp;
	try {
		fp = machine(src("fingerprint 0 0 (preprocess s)", "\n\n" + FINGERPRINT));
	} catch (e) {
		fp = "例外：" + e.message;
	}
	check(`${n} 文字：出力の指紋（1文字でも違えば変わる）`, String(fp) === String(wantFp), `got=${fp} want=${wantFp}`);
}

// ---- 2. 末尾でない再帰の深さ ----

// 余積の中の再帰呼び出しは末尾位置に無いので、段ごとに枠を取る（実測 32B/段）。
// 以前の 64KiB では 2046 段で限界に達し、2047 段から黙って壊れていた。
const sumTo = (d) => `f : n ?\n\tn = 0 : 0\n\tn + (f (n - 1))\nf ${d}\n`;

for (const d of [3000, 20000]) {
	const want = (BigInt(d) * BigInt(d + 1)) / 2n;
	let got;
	try {
		got = machine(sumTo(d));
	} catch (e) {
		got = "例外：" + e.message;
	}
	check(`末尾でない再帰 ${d} 段`, String(got) === String(want), `got=${got} want=${want}`);
}

// 末尾再帰は TCO で平らになるので、スタックの大きさに関係しない。以前の 64KiB でも
// 通っていた——**ここが通ることは上の2件の証拠にならない**ので、両方置いておく。
{
	const d = 200000;
	const src = `g : acc n ?\n\tn = 0 : acc\n\tg (acc + n) (n - 1)\ng 0 ${d}\n`;
	const want = (BigInt(d) * BigInt(d + 1)) / 2n;
	let got;
	try {
		got = machine(src, { stack: 0x10000 });
	} catch (e) {
		got = "例外：" + e.message;
	}
	check(`末尾再帰 ${d} 段は 64KiB でも平ら`, String(got) === String(want), `got=${got} want=${want}`);
}

// ---- 3. 踏み抜きは黙らない ----

// 足りないスタックを**わざと**渡す。以前ならここは誤答か時間切れだった。いまは
// スタックが image の下にあるので、踏み抜いた先は RAM の外——外部アボートになり、
// start.s の例外表が名指しで報せる。
{
	let why = "落ちなかった";
	try {
		const got = machine(sumTo(20000), { stack: 0x10000, timeout: 8000 });
		why = `返ってきた：${got}`;
	} catch (e) {
		why = e.message;
	}
	check("足りないスタックは名指しで落ちる（誤答でも時間切れでもなく）", /踏み抜/.test(why), why);
}

// image が RAM の外へ出る配置は、黙って起動しないのではなく**リンクで**落ちる。
{
	let why = "落ちなかった";
	try {
		machine("1 + 1\n", { stack: 0x8000000 });
	} catch (e) {
		why = e.message;
	}
	check("RAM に収まらないスタックはリンクで断る", /RAM の外/.test(why), why);
}

// `memMB` を渡せば同じ大きさが通る。
{
	let got;
	try {
		got = machine("1 + 1\n", { stack: 0x8000000, memMB: 256 });
	} catch (e) {
		got = "例外：" + e.message;
	}
	check("memMB を増やせば 128MiB のスタックも載る", String(got) === "2", String(got));
}

console.log(`\n既定のスタックは ${DEFAULT_STACK} バイト（${DEFAULT_STACK / 1024 / 1024}MiB）`);
console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
