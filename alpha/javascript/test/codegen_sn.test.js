/**
 * **Sign で書いたコード生成（`alpha/sign/lower.sn` ＋ `codegen.sn`）が、pass4.js の素の出力と
 * 1バイトも違わないことを見る。**
 *
 * 段1（lower.sn）は前処理した字面を parser.sn と同じ歩き方で割って後置の語を積み、段2（codegen.sn）は
 * その語を1回畳み込んで命令を連結する。どちらも解釈器の上で走る——コンパイラが動く層は全能力を
 * 使ってよく、吐いたコードが layer 0〜1 で動けばよい（2026-09-24 の裁定）。
 *
 * **段1の入力は3つ**（`lw_prog p ist opt`）：前処理した字面、前段が書いた `.ist`（`generateSignType` の
 * `scope: "ist"`、プロセスの中で作ってディスクへは書かない）、コーパスの身元 `codegen_corpus/option.ms`。
 * 幅は型が決め、型は使われ方（呼ぶ側）が決める——字面だけでは決まらないので、仮引数と返値の型は
 * `.ist` から引く。option.ms は同じ字面を `readOptionMs` で読んで pass4 にも渡す（手で置いた設定は無い）。
 *
 * 門は3つ重ねる：
 *
 *   1. **命令**：段2の出力と pass4 の素の出力（レジスタ割り当てと覗き穴を切ったもの）を `diffAsm` で。
 *   2. **中間語**：段1の語の列と、pass2 の木から作った語の列（`codegen_ref.js`）を。故障が段1に
 *      あるのか段2にあるのかが分かれる。型の出どころも別（段1は `.ist` と局所の規則、参照は pass3 の注釈）。
 *   3. **値**：素の pass4 の出力を実機で走らせ、解釈器と突き合わせる。バイトが同じなので、1回で
 *      Sign の出力も確かめたことになる。**素の出力を実機に掛けた検査はこれまで1本も無かった**
 *      ——初めて掛けたら比較の右辺の `__` を取りこぼす形が出た（pass4 を先に直して Sign が追った）。
 *      見せ方は最後の文の型（pass3）で決める：Char は符号位置、String は長さ（x1）。解釈器の中では
 *      Char と1文字の String が同じ JS の文字列なので、値だけでは見分けられない。**String は長さしか
 *      比べない**——中身は `' i` で数へ畳んだファイルでだけ見える。
 *
 * 断りは golden に置く（ファイルごとに `same` か `! 理由`）。断りが一致や消滅に化けたら落ちる。
 * pass4 が断るものは Sign も断る（逆は今のところ許す——部分集合の外）。
 * **両側に同じ誤りがある形はこの門では見えない**——見るのは 3 の値の突き合わせだけである。
 *
 * `rp_*.sn` は実プログラムの抜き書きで、1行目の `` `from: X.sn` `` の定義を一字一句そのまま写す。
 * 写しが腐ったら落ちるよう、定義のかたまりが元のファイルの字面に在ることを見る。
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
import { generateSignType } from "../st.js";
import { readOptionMs } from "../option_ms.js";
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
	// 9 スロットの呼び出し（Int 7 本と String 1 本）。pass4 は出すが、レジスタで渡せる 8 本を越える。
	"args9.sn": "! args",
	// 枝の型が揃わない（Char の枝と Int の枝）。
	"arm_type.sn": "! arm-type",
	"axioms.sn": "same",
	"big.sn": "same",
	"big10.sn": "same",
	"callcond.sn": "same",
	// 文字の算術は域の検査（charset の外は __）を伴う別の命令列。部分集合の外。
	"chr_alu.sn": "! char-alu +",
	// 文字の字面 \` は最後の字が引用符でも文字列ではない。最後の字だけで文字列と見ていた間は、\` だけの文を
	// 裸のテキストとして読み捨てて前の文の値を返し（chr_bt_stmt）、\`@~ を取り込みとして落としていた（chr_bt_imp）。
	"chr_bt_imp.sn": "! postfix \\`@~",
	"chr_bt_stmt.sn": "same",
	"chr_cmp.sn": "same",
	// 比較の結果（Char）を算術の辺に置く形。結果の型を Int と取り違えると素の add を黙って出す。
	"chr_cmpalu.sn": "! char-alu +",
	// 比較の結果（Char）をもう一度比べる形。結果の型を Int と取り違えると O < へ化ける。
	"chr_cmpcmp.sn": "same",
	// 小文字の 16 進（0u000a・0u006a）。chr_lit は大文字しか持っていなかった。
	"chr_hex.sn": "same",
	// `\_` は文字 `_`（U+005F、裁定 2026-09-28）。pass2 が「\ に穴を渡した部分適用」と読んでいた間は pass4 も断り、
	// 段1は読みが割れる綴りとして名指しで断っていた（! char-hole）。`f \_` を比べて等しいので、値の門は 95 を両側で見る。
	"chr_hole.sn": "same",
	"chr_lit.sn": "same",
	// 数と文字の比較は同種どうしでない（comparison.md §4）。pass4 は出すが、符号の欄の規則を写さずに断る。
	"chr_mix.sn": "! mixed-compare",
	// 0u0000 は __。__ との比較は pass4 も断る（Char と Unit）。
	"chr_nulcmp.sn": "! unit-compare",
	// 0u00 も 0u0000 と同じ __。綴りで見ていた間は mixed-compare の名で断っていた（型で見る）。
	"chr_nulcmp2.sn": "! unit-compare",
	"chr_unit.sn": "same",
	"chr_val.sn": "same",
	"cmpunit.sn": "! unit-compare",
	"cmpunit2.sn": "same",
	// 括った __ を左に置く比較と、__ を返す呼び出しを右に置く比較。pass4 は断るのに、綴りの __ だけを見ていた段1は
	// 命令を出していた（HEAD から）。ほかの unit-compare のファイルは __ がどれも右辺にある。
	"cmpunit3.sn": "! unit-compare",
	"cmpunit4.sn": "! unit-compare",
	"comment.sn": "same",
	"conds.sn": "same",
	"constcall.sn": "! call-in-const",
	"deep46.sn": "same",
	"deep47.sn": "! deep",
	"defonly.sn": "same",
	"div.sn": "same",
	// 同じ名前の定義は先勝ち（compile が後の行を落とす）。段1が両方出していた間は、関数はラベルが2つ、
	// 文字列の定数は文が1つ増えて .Lstr の番号がずれていた。最初の定義が定数なら、同じ名前の関数は呼べない。
	"dup_const.sn": "same",
	"dup_fn.sn": "same",
	"dup_kind.sn": "! head f",
	// 前の定義は先頭の文に限らない（dup_mid_*）。定義より前にその名前で始まる文は定義ではない（dup_use_*：`:` を
	// 見ずに名前だけで重複と読むと、後の定義の文を落とす）。
	"dup_mid_const.sn": "same",
	"dup_mid_fn.sn": "same",
	"dup_use_const.sn": "same",
	"dup_use_fn.sn": "same",
	"edge16.sn": "same",
	"eight.sn": "same",
	"eqeq.sn": "! op ==",
	// export の印（# ## ###）は名前の一部ではない（compile の definedNameOf が剥いで先勝ちを決める）。綴りで比べていた
	// 間は、#k の後の k を別の名前と読んで文を1つ多く出し、定数を後の定義から読んでいた。印の付いた関数は pass4 が
	// .global / .hidden を出すので名指しで断る（後に書いた重複なら先勝ちで出さないので一致する）。
	"export_dup.sn": "same",
	"export_dup2.sn": "same",
	"export_fn.sn": "! export #f",
	"export_fn_dup.sn": "same",
	// 最初の定義が印の付いた定数なら、同じ名前の関数は呼べない（dup_kind と同じ）。印を剥がずに引くと、後の定義を
	// 引数の数に数えて型の断り（! type f）に化ける。
	"export_kind.sn": "! head f",
	"export_marks.sn": "same",
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
	"idx.sn": "same",
	// 定数を2段辿る添字は均す（pass4 の constAddressOf は束縛を1段だけ辿る）。
	"idx_const2.sn": "same",
	"idx_oob.sn": "same",
	// 数を1要素の器として引く形（pass4 は出す）。要素の幅が器の型から決まらないので部分集合の外。
	"idx_scalar.sn": "! index-scalar",
	"idxtype.sn": "! index-type",
	"imm17.sn": "same",
	"imm49.sn": "same",
	"inc.sn": "same",
	"int_chr.sn": "same",
	// 名前に ~ を付けた添字は鍵の位置（中身を取る）。読みを写さずに断る。
	"key.sn": "! key",
	// 1文字を String の仮引数へ渡すと pass4 は持ち上げる（sub sp）＝確保。読むだけの器の外。
	"lift.sn": "! lift n",
	"listparam.sn": "! type f",
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
	// 1本の値のノルムは別の命令列（6本）。pass4 は出すが部分集合の外。
	"normscalar.sn": "! norm-scalar",
	// 空白を挟んだノルムは parser.sn の語の規則では1語にならない（pegjs は読む）。
	"normsplit.sn": "! norm-split",
	"not.sn": "! !n",
	"one.sn": "same",
	"order.sn": "same",
	"over63.sn": "! big 9223372036854775808",
	"over64.sn": "! big 18446744073709551615",
	"overapply.sn": "! arity f",
	// 部分適用でしか呼ばれない仮引数は型が族（Scalar）に留まる。.ist の型が Int・Char・String でなければ定義で断る。
	"partial.sn": "! type g",
	"pattern.sn": "! pattern d",
	// 後置の付いた字面は語の全体で読んで名指しで断る。頭の1字だけ見ていた間は、0u0041~ を 1079、
	// `abc`~ を中身 abc` の文字列として黙って読み、pass4 が断る \a! にも命令を出していた。
	"post_chr.sn": "! postfix \\a!",
	"post_paren.sn": "! postfix (0u0041)~",
	"post_str.sn": "! postfix `abc`~",
	"post_uni.sn": "! postfix 0u0041~",
	// 16 進の桁の範囲の外にある後置（! は pass4 も断る。@ は pass4 が値 65 を出すが、字面の後置は写さずに断る）。
	// 桁の判定の端を1字ずらすと、! を桁と読んで命令を出し、@ を桁と読んで 1049 と読み違える。
	"post_uni_at.sn": "! postfix 0u0041@",
	"post_uni_bang.sn": "! postfix 0u0041!",
	"retunit.sn": "same",
	"rp_lexer_brackets.sn": "same",
	"rp_parser_has.sn": "same",
	"slice.sn": "same",
	// 起点 00 も 0（pass4 は Number(綴り) === 0 を見て命令を出さない）。
	"slice00.sn": "same",
	// 起点が 0 と読めるのは字面の数（N）だけ。スロット 0 の仮引数（P 0 1）や、0 に束縛した定数（N 0 X）を
	// 恒等と読むと、pass4 が出す切り出しの命令が消える。
	"slice_k0.sn": "same",
	"slice_p0.sn": "same",
	"sparam.sn": "same",
	// 器を返す関数は2本の返値（部分集合の外）。定義で断る（width-ret）のと、先に書いた呼ぶ側で断る
	// （width）のは別の門で、どちらか片方を外すともう片方のファイルが赤くなる。
	"sret.sn": "! width-ret f",
	"sret_call.sn": "! width f",
	// \ を含み " を含まない字面（str_byte は " も持つので \ の行が門を通っていなかった）。
	"str_bs.sn": "same",
	"str_byte.sn": "same",
	// .ascii の両端：空白と ~ は素直な字、タブは .byte。
	"str_edge.sn": "same",
	"str_empty.sn": "same",
	"str_lit.sn": "same",
	"str_order.sn": "same",
	"str_ret.sn": "same",
	// 1語だけの文字列の文でも、後置が付けば値（前処理の判別：閉じの直後が後置か空白なら式）。字面に後置を
	// 付けた形は写さずに断る。引用符で始まる1語を全部コメントにしていた間は、~ の文で前の文の値を返し、
	// pass4 が断る ! に命令を出し、@ の文を落としていた。
	"str_stmt_at.sn": "! postfix `abc`@",
	"str_stmt_bang.sn": "! postfix `abc`!",
	"str_stmt_tilde.sn": "! postfix `abc`~",
	// 取り込みは @~ だけ。後置を2つ付けた文（~~ は pass4 が文字列を返す、!~ は pass4 が断る）を取り込みと読むと
	// 黙って落とす。
	"str_stmt_bt.sn": "! postfix `abc`!~",
	// 前置の付いた文字列の文は裸のテキストではない（lw_isstr が最初の字も引用符かを見る。「エスケープでないか」に
	// 弱めると `~` `!` `$` の付いた文を読み捨てていた）。
	"str_stmt_pre.sn": "! ~`abc`",
	"str_stmt_tt.sn": "! postfix `abc`~~",
	// 行頭の文字列でも後ろに語が続けば値（コメントは1語だけの文字列の文）。
	"str_top.sn": "same",
	"streq.sn": "! container-op =",
	"sumacc.sn": "same",
	"sunit.sn": "same",
	// String の仮引数へ __ を渡す形。1本の __ を2本の器へ黙って渡すと、積んだのは1スロットなのに C 2 を出す。
	"sunit_arg.sn": "! arg n",
	"tailgrp.sn": "same",
	"top.sn": "same",
	"twoarg_tail.sn": "same",
	"uncalled.sn": "! type f",
	"unitarm.sn": "same",
	// 括った __ の枝も V（pass4 は括りを剥いで __ そのものかを見る）。綴りの __ だけを見ていた間は U だった。
	"unitarm_paren.sn": "same",
	// 両辺が __ の算術（域が Unit）は pass4 も断る。片側だけの __ は相手の域で出す（左が __ の形は unitalu_one、
	// 右が __ の形は axioms・misc）。断る門が無かった間は、関数の本体でも 0u0000 どうしでも __ を吸収する命令列を出していた。
	"unitalu.sn": "! unit-alu *",
	"unitalu2.sn": "! unit-alu +",
	"unitalu_one.sn": "same",
	// 両辺が __ の算術は演算子によらず断る（1ファイルは最初の断りしか残さないので、演算子ごとに置く）。
	"unitalu_div.sn": "! unit-alu /",
	"unitalu_sub.sn": "! unit-alu -",
	"unitconst.sn": "! unit-const z",
	// 0u00 に束縛した定数も __ に束縛している（綴りの __ と 0u0000 だけを見ていた）。
	"unitconst2.sn": "! unit-const z",
	// 器を返す枝・器を条件に置く枝（2本の値は枝に来ない）。
	"width_arm.sn": "! width arm",
	"width_cond.sn": "! width cond",
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

const call = (fn, ...vs) => {
	let node = { type: "atom", kind: "identifier", value: `<${fn}>` };
	vs.forEach((v, i) => {
		envDefine(env, `<__in${i}__>`, v);
		node = { type: "operation", name: "apply", left: node, right: { type: "atom", kind: "identifier", value: `<__in${i}__>` } };
	});
	return evaluate(node, env);
};

// **コーパスの身元。** 段1へは字面のまま、pass4 へは readOptionMs で読んだ値を渡す。
const OPT = fs.readFileSync(path.join(CORPUS, "option.ms"), "utf8").replace(/\r\n/g, "\n");
const conf = readOptionMs(OPT);
check("コーパスの option.ms が読める（警告 0 件）", [conf.target, conf.layer, conf.charset, conf.warnings], ["aarch64_qemu", 1, "ascii", []]);

// 最後の文の型（pass3）。値の見せ方を決める。
const lastType = (nodes) => {
	const stmts = nodes.filter((n) => !(n.type === "atom" && n.kind === "string") && !(n.type === "operation" && n.name === "define" && n.right && n.right.name === "lambda"));
	const last = stmts[stmts.length - 1];
	if (!last) return null;
	return last.type === "operation" && last.name === "define" ? last.right && last.right.atomType : last.atomType;
};
const interpValue = (src, ty) => {
	const { nodes } = compile(src, { parse: parser.parse, charset: "ascii" });
	const e = newRuntimeEnv(null, "ascii");
	let r = UNIT;
	for (const n of nodes) r = evaluate(n, e);
	if (isUnit(r)) return "__";
	const o = observe(r);
	if (o === undefined || o === null) return "__";
	if (ty === "Char") return typeof o === "number" ? `Char ${o}` : typeof o === "string" && [...o].length === 1 ? `Char ${o.codePointAt(0)}` : `? ${JSON.stringify(o)}`;
	if (ty === "String") return typeof o === "string" ? (o === "" ? "__" : `len ${[...o].length}`) : `? ${JSON.stringify(o)}`;
	return String(o);
};
const machineValue = (regs, ty) => {
	if (ty === "String") {
		const len = asInt(regs[1]);
		return len === 0n ? "__" : `len ${len}`;
	}
	const v = asInt(regs[0]);
	if (v === null) return "__";
	return ty === "Char" ? `Char ${v}` : String(v);
};

const files = fs.readdirSync(CORPUS).filter((f) => f.endsWith(".sn")).sort();
check("コーパスと golden が1対1", files, Object.keys(EXPECT).sort());

const MACHINE = !process.argv.includes("--no-qemu") && available();
if (!MACHINE) console.log(`（値の突き合わせは飛ばす：${toolReport()}）`);

const reached = { kinds: new Set(), ops: new Set(), forms: new Set() };
for (const file of files) {
	const src = fs.readFileSync(path.join(CORPUS, file), "utf8").replace(/\r\n/g, "\n");
	const { nodes, env: cenv } = compile(src, { parse: parser.parse, charset: "ascii" });
	const g4 = generateAsm(nodes, cenv, { target: conf.target, charset: conf.charset, layer: conf.layer, regAlloc: false, peepholes: false });
	const p4refused = blockingOf(g4.diagnostics).length > 0;
	const ist = generateSignType(nodes, cenv, { scope: "ist" }).text;
	const ilv = call("lw_prog", preprocess(src), ist, OPT);
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
			if (t[0] === "O" || t[0] === "K") reached.ops.add(t);
			if ("IH".includes(t[0])) reached.forms.add(t);
			if (t[0] === "P") reached.forms.add(`P ${t.split(" ")[2]}`);
			if (t[0] === "B") reached.forms.add(t === "B" ? "B（空）" : "B");
		}
		if (MACHINE && !NO_VALUE.has(file)) {
			const ty = lastType(nodes);
			let m;
			try {
				m = machineValue(runAsm(g4.text), ty);
			} catch (e) {
				m = "実行で例外：" + e.message.slice(0, 80);
			}
			check(`${file}: 実機の値が解釈器と同じ`, m, interpValue(src, ty));
		}
	} else {
		check(`${file}: 名指しで断る`, errs[0] || "（断らなかった）", want);
	}
	// **pass4 が断るものは Sign も断る。** 黙って命令を出したら、それは門の外の誤答である。
	if (p4refused) check(`${file}: pass4 が断る形は Sign も断る`, errs.length > 0, true);
	// **抜き書きは元の字面のまま。** 定義のかたまり（頭の行と字下げの続き）が元のファイルに在るか。
	if (file.startsWith("rp_")) {
		const from = src.match(/^`from: ([\w.]+)`\n/);
		const orig = from ? readImport(from[1]) : "";
		const blocks = [];
		let cur = null;
		for (const line of src.split("\n").slice(1)) {
			if (cur && line.startsWith("\t")) {
				cur.push(line);
				continue;
			}
			if (cur) blocks.push(cur.join("\n"));
			cur = /^[a-z_][a-z_0-9]* : /.test(line) ? [line] : null;
		}
		if (cur) blocks.push(cur.join("\n"));
		check(`${file}: 抜き書きが ${from ? from[1] : "?"} の字面のまま（${blocks.length} かたまり）`, blocks.length > 0 && blocks.filter((b) => !orig.includes(b)), []);
	}
}

// **届いた範囲。** 語の種類と演算子が一度も出てこなければ、その分岐は門を通っていない。
check("届いた語の種類（25）", [...reached.kinds].sort().join(""), "ABCDEFGHIJKLMNOPQRSTUVWXZ");
check("届いた演算子（O 10・K 6）", [...reached.ops].sort(), ["K !=", "K <", "K <=", "K =", "K >", "K >=", "O !=", "O *", "O +", "O -", "O /", "O <", "O <=", "O =", "O >", "O >="]);
check("届いた器の形", [...reached.forms].sort(), ["B", "B（空）", "H", "H d", "I", "I d", "P 1", "P 2"]);

// **身元が違えば段1は断る。** Char の幅は charset が決めるので、ascii 以外を黙って1バイトで読まない。
{
	const first = (v) => {
		const o = isUnit(v) ? null : observe(v);
		return Array.isArray(o) ? o[0] : o;
	};
	// 空の文字列は __ なので、渡すと呼び出しごと消える（完全性公理）。.ist は見出しの1行を置く。
	const IST0 = "` SignType (ist)\n";
	const opt = (t, l, c) => `target : ${t}\nlayer : ${l}\ncharset : ${c}\n`;
	check("option.ms の charset が ascii でなければ断る", first(call("lw_prog", preprocess("1\n"), IST0, opt("aarch64_qemu", 1, "utf32"))), "! option charset");
	check("option.ms の layer が 1 でなければ断る", first(call("lw_prog", preprocess("1\n"), IST0, opt("aarch64_qemu", 0, "ascii"))), "! option layer");
	check("option.ms の target が aarch64_qemu でなければ断る", first(call("lw_prog", preprocess("1\n"), IST0, opt("riscv64", 1, "ascii"))), "! option target");
	check("option.ms に charset が無ければ断る（既定で埋めない）", first(call("lw_prog", preprocess("1\n"), IST0, "target : aarch64_qemu\nlayer : 1\n")), "! option charset");
	check("option.ms が揃っていれば断らない", first(call("lw_prog", preprocess("1\n"), IST0, OPT)), "G");
}

// **ファイルに置けない形も同じ門に通す。** 行末の空白（エディタが落とす）と、取り込み（compile に読み手が要る）。
// 段1が読み捨てる1語だけの文字列の文はこの2つだけ：裸のテキスト（閉じの後に空白。前処理は式と判別するが、
// pass4 は文として出さない）と、`` `x`@~ ``（compile が定義へ撒く。ここでは空の枚を読ませる）。
{
	const same = (note, src, readImp) => {
		const { nodes, env: cenv } = compile(src, { parse: parser.parse, readImport: readImp, charset: "ascii" });
		const g4 = generateAsm(nodes, cenv, { target: conf.target, charset: conf.charset, layer: conf.layer, regAlloc: false, peepholes: false });
		const ist = generateSignType(nodes, cenv, { scope: "ist" }).text;
		const ilv = call("lw_prog", preprocess(src), ist, OPT);
		const asmv = call("g_run", ilv);
		const d = diffAsm(g4.text, isUnit(asmv) ? "" : String(observe(asmv)));
		check(`${note}: pass4 の素の出力とバイト一致`, d.same ? "一致" : formatDiff(d, "pass4", "sign"), "一致");
		check(`${note}: 段1の語の列が pass2 の木からの語の列と同じ`, isUnit(ilv) ? [] : observe(ilv), lowerReference(nodes));
	};
	same("裸のテキストの文（閉じの後に空白）は読み捨てる", "5\n`abc` \n");
	same("取り込みの行は読み捨てる", "`empty.sn`@~\n5\n", () => "");
}

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
