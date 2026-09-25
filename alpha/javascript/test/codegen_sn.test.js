/**
 * **Sign で書いたコード生成（`alpha/sign/lower.sn` ＋ `codegen.sn`）が、pass4.js の素の出力と
 * 1バイトも違わないことを見る。**
 *
 * 段1（lower.sn）は前処理した字面を parser.sn と同じ歩き方で割って後置の語を積み、段2（codegen.sn）は
 * その語を1回畳み込んで命令を連結する。どちらも解釈器の上で走る——コンパイラが動く層は全能力を
 * 使ってよく、吐いたコードが layer 0〜1 で動けばよい（2026-09-24 の裁定）。
 *
 * 門は3つ重ねる：
 *
 *   1. **命令**：段2の出力と pass4 の素の出力（レジスタ割り当てと覗き穴を切ったもの）を `diffAsm` で。
 *   2. **中間語**：段1の語の列と、pass2 の木から作った語の列（`codegen_ref.js`）を。故障が段1に
 *      あるのか段2にあるのかが分かれる。
 *   3. **値**：素の pass4 の出力を実機で走らせ、解釈器と突き合わせる。バイトが同じなので、1回で
 *      Sign の出力も確かめたことになる。**素の出力を実機に掛けた検査はこれまで1本も無かった**
 *      ——初めて掛けたら比較の右辺の `__` を取りこぼす形が出た（pass4 を先に直して Sign が追った）。
 *
 * 断りは golden に置く（ファイルごとに `same` か `! 理由`）。断りが一致や消滅に化けたら落ちる。
 * pass4 が断るものは Sign も断る（逆は今のところ許す——部分集合の外）。
 * **両側に同じ誤りがある形はこの門では見えない**——見るのは 3 の値の突き合わせだけである。
 *
 * 前処理だけは JS の `preprocess` を借りる（preprocess.sn は lexer.sn と名前がぶつかるので、
 * 1つの環境に同居させる段取りがまだ無い）。
 *
 * 実行: node test/codegen_sn.test.js
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";
import { generateAsm } from "../pass4.js";
import { blockingOf } from "../errors.js";
import { preprocess } from "../lexer.js";
import { diffAsm, formatDiff } from "../asmdiff.mjs";
import { evaluate, newRuntimeEnv, envDefine, UNIT, observe, isUnit } from "../interpreter.js";
import { runAsm, asInt, available, toolReport } from "../qemu_run.js";
import { lowerReference } from "./codegen_ref.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIGN = path.join(__dirname, "..", "..", "sign");
const CORPUS = path.join(__dirname, "codegen_corpus");
const parser = peggy.generate(fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8"));
const readImport = (p) => fs.readFileSync(path.join(SIGN, p), "utf8").replace(/\r\n/g, "\n");

let passed = 0;
let total = 0;
function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
	if (!ok) console.log(`     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
}

// **ファイルごとの類。** `same` は pass4 の素の出力とバイト一致、`! 理由` は段1か段2が名指しで断る。
// 並びは codegen_corpus のファイルと1対1（増えても減っても落ちる）。
const EXPECT = {
	"axioms.sn": "same",
	"big.sn": "same",
	"big10.sn": "same",
	"callcond.sn": "same",
	"cmpunit.sn": "! unit-compare",
	"cmpunit2.sn": "same",
	"comment.sn": "same",
	"conds.sn": "same",
	"constcall.sn": "! call-in-const",
	"deep46.sn": "same",
	"deep47.sn": "! deep",
	"defonly.sn": "same",
	"div.sn": "same",
	"edge16.sn": "same",
	"eight.sn": "same",
	"eqeq.sn": "! op ==",
	"evenodd.sn": "same",
	"fact.sn": "same",
	"ffff48.sn": "same",
	"fib.sn": "same",
	"gcd.sn": "same",
	"ge_r.sn": "same",
	// 頭が塊（`g * g (n - 1)`）で最初の語が既知の関数。`noparen.sn` は頭の `n` が仮引数なので
	// 別の検査が断ってしまい、「頭が1語か」を外しても赤くならなかった（変異で確かめた）。
	"headchunk.sn": "! head g",
	"hi32.sn": "same",
	"imm17.sn": "same",
	"imm49.sn": "same",
	"inc.sn": "same",
	"lits.sn": "same",
	"mainmulti.sn": "same",
	"max63.sn": "same",
	"misc.sn": "same",
	"mod.sn": "! op %",
	"movn1.sn": "same",
	"movn2.sn": "same",
	"movn3.sn": "same",
	"mutual.sn": "same",
	"neq_l.sn": "same",
	"neq_pp.sn": "same",
	"neq_r.sn": "same",
	"nest.sn": "same",
	"nest1.sn": "same",
	"nest2.sn": "same",
	"nest3.sn": "same",
	"nest4.sn": "same",
	"nestcall.sn": "same",
	"noparen.sn": "! head n",
	"not.sn": "! !n",
	"one.sn": "same",
	"order.sn": "same",
	"over63.sn": "! big 9223372036854775808",
	"over64.sn": "! big 18446744073709551615",
	"overapply.sn": "! arity f",
	"partial.sn": "! arity g",
	"retunit.sn": "same",
	"sumacc.sn": "same",
	"tailgrp.sn": "same",
	"top.sn": "same",
	"twoarg_tail.sn": "same",
	"unitarm.sn": "same",
};
// 値を観測できないもの（最後の行が定義で、返るのは関数そのもの）。命令の一致だけを見る。
const NO_VALUE = new Set(["defonly.sn", "one.sn"]);

// ---- 段1と段2を1つの環境に読む ----
const t0 = performance.now();
const lib = compile(readImport("lower.sn") + "\n" + readImport("codegen.sn") + "\n", { parse: parser.parse, readImport, charset: "ascii" });
const env = newRuntimeEnv(null, "ascii");
for (const n of lib.nodes) evaluate(n, env);
console.log(`lower.sn + codegen.sn を読んだ（${Math.round(performance.now() - t0)}ms）`);
// **診断は information まで 0 件。** 先勝ちの衝突（取り込んだ名前と同じ名前を書く）は黙って挙動を
// 変えるので、1件でも出たら見る。
check("段1・段2の compile の診断が 0 件", lib.diagnostics.map((d) => d.message.slice(0, 60)), []);

const call = (fn, v) => {
	envDefine(env, "<__in__>", v);
	return evaluate(
		{ type: "operation", name: "apply", left: { type: "atom", kind: "identifier", value: `<${fn}>` }, right: { type: "atom", kind: "identifier", value: "<__in__>" } },
		env
	);
};

const interpValue = (src) => {
	const { nodes } = compile(src, { parse: parser.parse, charset: "ascii" });
	const e = newRuntimeEnv(null, "ascii");
	let r = UNIT;
	for (const n of nodes) r = evaluate(n, e);
	if (isUnit(r)) return "__";
	const o = observe(r);
	return o === undefined || o === null ? "__" : String(o);
};

const files = fs.readdirSync(CORPUS).filter((f) => f.endsWith(".sn")).sort();
check("コーパスと golden が1対1", files, Object.keys(EXPECT).sort());

const MACHINE = !process.argv.includes("--no-qemu") && available();
if (!MACHINE) console.log(`（値の突き合わせは飛ばす：${toolReport()}）`);

const reached = { kinds: new Set(), ops: new Set() };
for (const file of files) {
	const src = fs.readFileSync(path.join(CORPUS, file), "utf8").replace(/\r\n/g, "\n");
	const { nodes, env: cenv } = compile(src, { parse: parser.parse, charset: "ascii" });
	const g4 = generateAsm(nodes, cenv, { target: "aarch64_qemu", charset: "ascii", layer: 1, regAlloc: false, peepholes: false });
	const p4refused = blockingOf(g4.diagnostics).length > 0;
	const ilv = call("lw_prog", preprocess(src));
	const il = isUnit(ilv) ? [] : observe(ilv);
	const asmv = call("g_run", ilv);
	const out = isUnit(asmv) ? "" : String(observe(asmv));
	const errs = out.split("\n").filter((l) => l.trim().startsWith(".err")).map((l) => l.trim().replace(/^\.err\s*/, ""));
	const want = EXPECT[file];
	if (want === "same") {
		const d = diffAsm(g4.text, out);
		check(`${file}: pass4 の素の出力とバイト一致`, d.same ? "一致" : formatDiff(d, "pass4", "sign"), "一致");
		let ref;
		try {
			ref = lowerReference(nodes);
		} catch (e) {
			ref = e.message;
		}
		check(`${file}: 段1の語の列が pass2 の木からの語の列と同じ`, il, ref);
		for (const t of il) {
			reached.kinds.add(t[0]);
			if (t[0] === "O") reached.ops.add(t.slice(2));
		}
		if (MACHINE && !NO_VALUE.has(file)) {
			let m;
			try {
				const v = asInt(runAsm(g4.text)[0]);
				m = v === null ? "__" : String(v);
			} catch (e) {
				m = "実行で例外：" + e.message.slice(0, 80);
			}
			check(`${file}: 実機の値が解釈器と同じ`, m, interpValue(src));
		}
	} else {
		check(`${file}: 名指しで断る`, errs[0] || "（断らなかった）", want);
	}
	// **pass4 が断るものは Sign も断る。** 黙って命令を出したら、それは門の外の誤答である。
	if (p4refused) check(`${file}: pass4 が断る形は Sign も断る`, errs.length > 0, true);
}

// **届いた範囲。** 語の種類と演算子が一度も出てこなければ、その分岐は門を通っていない。
check("届いた語の種類（20）", [...reached.kinds].sort().join(""), "ACDEFGJMNOPQRSTUVWXZ");
check("届いた演算子（10）", [...reached.ops].sort(), ["!=", "*", "+", "-", "/", "<", "<=", "=", ">", ">="]);

// **断りは組めない。** `.err` の行はアセンブラが落とすので、断りが黙ったバイナリに化けない。
if (MACHINE) {
	let threw = false;
	try {
		runAsm(".text\n.global _.main\n_.main:\n\t.err ! op %\n\tret\n");
	} catch {
		threw = true;
	}
	check(".err の行はアセンブラが落とす", threw, true);
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
