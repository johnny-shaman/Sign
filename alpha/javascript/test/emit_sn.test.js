/**
 * **`alpha/sign/asm_text.sn` が `pass4.js` と同じ命令の綴りを書くことを見る門。**
 *
 * emit.sn は後段の最初の一枚だが、**これまで答えを誰も見ていなかった**——`sign_programs`
 * が見ているのは診断ゼロ・`blr` が0本・命令数が 500〜700 の範囲だけで、綴りが1文字変わっても
 * 緑のままだった。実際、`put_movz` は `movz xD, #N`（シフト無し）を書いていたが、コーパス
 * 9枚の `movz` 830 本は**すべて** `movz xD, #N, lsl #S` の形で、シフト無しは1本も出ていない。
 *
 * ## 何を見るか
 *
 * **答えは書かない。** `pass4.js` の綴り手をその場で呼び、Sign 側の同じ問いと突き合わせる
 * （`layout_sn.test.js` と同じ規律——答えを門に書くと、綴りの事実が2箇所で決まる）。
 *
 * 解釈器と機械の**両方**へ立てる。機械では綴りを `x0` で受け取れないので、`||問い||` で
 * 長さを訊いてから `問い ' i` を1文字ずつ訊く（1文字につき qemu 1回）。
 *
 * 実行: node test/emit_sn.test.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import peggy from "peggy";
import { compile } from "../compile.js";
import { generateAsm, memMnemonic, storeElem, loadElem, loadAt, storeAt, slotLoadInsn, slotStoreInsn } from "../pass4.js";
import { evaluate, newRuntimeEnv, UNIT, observe, isUnit } from "../interpreter.js";
import { runAsm, asInt, available, toolReport } from "../qemu_run.js";
import { blockingOf } from "../errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const NL = String.fromCharCode(10);
const readImport = (p) => fs.readFileSync(path.join(ROOT, "sign", p), "utf8").replace(/\r\n/g, "\n");
const parser = peggy.generate(fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8"));
const SOURCE = readImport("asm_text.sn");

let passed = 0;
let total = 0;
const check = (note, got, want) => {
	total++;
	const ok = got === want;
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note.padEnd(46)} ${JSON.stringify(got)}`);
	if (!ok) console.log(`     want: ${JSON.stringify(want)}`);
};

// 問いは emit.sn の全文の末尾へ1行足して作る。駆動行（`main 0`）は残す——消すと
// 呼ばれない関数が出なくなり、機械の側で問いが立たない。
const programOf = (ask) => SOURCE + NL + ask + NL;

const interp = (ask) => {
	const { nodes } = compile(programOf(ask), { parse: parser.parse, readImport });
	const env = newRuntimeEnv(null, "ascii");
	let r = UNIT;
	for (const n of nodes) r = evaluate(n, env);
	if (isUnit(r)) return "__";
	const o = observe(r);
	return o === undefined ? "__" : o;
};

// **「そのまま返すので」の12件は偽の理由だった**（2026-09-25）。ln2 / ln4 は仮引数を連結の
// 中で**写す**だけで、参照を返してはいない。本当の理由は、mov_rr などが字面の引数のせいで
// 計画に載れず、置き場をもらわないまま組む関数の結果を返すこと（自分の枠に取って返す形）。
// 偽の理由のまま蓋をしていた形は、蓋を外すと引数と返値を同じ宛先に組んで壊れていた
// （qemu.test.js「置き場の食い違い」の alu_rrr）。rg の1件は、幅で分ける関数が置き場を
// もらわずに rg へ末尾で飛ぶ形を、呼ぶ側の門が名指ししたもの。
const KNOWN_MACHINE = {
	"器の構築はまだ出せません（ln2 の返す器を自分の枠に置いたまま返す": 11,
	"枝の幅が揃いません（2 本と 1 本）——広い方へ揃える持ち上げがま": 2,
	"器の構築はまだ出せません（String——撒いているので要素数が実行": 1,
	"器の構築はまだ出せません（ln4 の返す器を自分の枠に置いたまま返す": 1,
	"器の構築はまだ出せません（rg は返す器の置き場を要りますが、呼ぶ側": 1,
};

// **機械の側は、出せない理由が残っているあいだは立てない。** 断りが1つでも在ると綴りは
// 返ってこないので、問いを全部赤くしても情報が増えない——理由の内訳（下）でだけ覚えておく。
const MACHINE = !process.argv.includes("--no-qemu") && available() && Object.keys(KNOWN_MACHINE).length === 0;
const machineInt = (ask) => {
	const { nodes, env } = compile(programOf(ask), { parse: parser.parse, readImport });
	const r = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii" });
	const bad = blockingOf(r.diagnostics);
	if (bad.length) return "出せない：" + bad[0].message;
	const v = asInt(runAsm(r.text)[0]);
	return v === null ? "__" : v;
};
// 綴りは長さを訊いてから1文字ずつ。`layout_sn.test.js` と同じ手順である。
const machineText = (ask) => {
	const n = machineInt(`||${ask}||`);
	if (typeof n !== "number") return n;
	let s = "";
	for (let i = 0; i < n; i++) {
		const c = machineInt(`(${ask}) ' ${i}`);
		if (typeof c !== "number") return c;
		s += String.fromCodePoint(c);
	}
	return s;
};

console.log("`emit.sn` が書く命令の綴りを、pass4.js の綴り手と突き合わせる" + (MACHINE ? "（解釈器と機械の両方）" : "（機械は飛ばす：" + toolReport() + "）"));

// ---- 10進の綴り。ここが全部の土台で、機械には `Int → 綴り` の道がまだ無い ----
// だから表（`dg`）を引いて桁ごとに綴る。迂回だが、**迂回だと分かる形**で書いてある。
for (const n of [0, 7, 42, 176, 1000, 4660, 65535]) {
	check(`dec ${n}（解釈）`, interp(`dec ${n}`), String(n));
	if (MACHINE) check(`dec ${n}（機械）`, machineText(`dec ${n}`), String(n));
}

// ---- 幅から命令の綴りを引く（表は operator_table.sn が持つ）----
for (const w of [1, 2, 4, 8]) {
	check(`st_mn ${w}（解釈）`, interp(`st_mn ${w}`), memMnemonic("output", w));
	check(`ld_mn ${w}（解釈）`, interp(`ld_mn ${w}`), memMnemonic("input", w));
}
if (MACHINE) {
	check("st_mn 1（機械）", machineText("st_mn 1"), memMnemonic("output", 1));
	check("ld_mn 8（機械）", machineText("ld_mn 8"), memMnemonic("input", 8));
}

// ---- 命令1行。JS の綴り手をその場で呼ぶ ----
const CASES = [
	["storeElem 4byte", "store_elem 9 `x10` 8 4", () => storeElem("x9", "x10", 8, 4)],
	["storeElem 8byte", "store_elem 9 `x10` 16 8", () => storeElem("x9", "x10", 16, 8)],
	["storeElem 1byte", "store_elem 9 `x10` 3 1", () => storeElem("x9", "x10", 3, 1)],
	["storeElem レジスタ位置", "store_elem_at 9 `x10` `x13` 8", () => storeElem("x9", "x10", 0, 8, "x13")],
	["loadElem 8byte", "load_elem 9 `x10` `x11` 8", () => loadElem("x9", "x10", "x11", 8)],
	["loadElem 1byte", "load_elem 9 `x10` `x11` 1", () => loadElem("x9", "x10", "x11", 1)],
	["loadElem 4byte", "load_elem 9 `x10` `x11` 4", () => loadElem("x9", "x10", "x11", 4)],
	["loadAt 2byte", "load_at 9 `x10` 2", () => loadAt("x9", "x10", 2)],
	["loadAt 8byte", "load_at 9 `x10` 8", () => loadAt("x9", "x10", 8)],
	["storeAt 1byte", "store_at 9 `x10` 1", () => storeAt("x9", "x10", 1)],
	["slotLoadInsn Int 4byte", "slot_load 9 `x29` 16 4 `Int`", () => slotLoadInsn({ type: "Int", size: 4 }, "x9", "x29", 16)],
	["slotLoadInsn Char 1byte", "slot_load 9 `x29` 16 1 `Char`", () => slotLoadInsn({ type: "Char", size: 1 }, "x9", "x29", 16)],
	["slotLoadInsn Int 2byte", "slot_load 9 `x29` 8 2 `Int`", () => slotLoadInsn({ type: "Int", size: 2 }, "x9", "x29", 8)],
	["slotLoadInsn Address 8byte", "slot_load 9 `x29` 24 8 `Address`", () => slotLoadInsn({ type: "Address", size: 8 }, "x9", "x29", 24)],
	["slotStoreInsn 2byte", "slot_store 9 `x29` 16 2", () => slotStoreInsn(2, "x9", "x29", 16)],
	["slotStoreInsn 16byte", "slot_store 9 `x29` 16 16", () => slotStoreInsn(16, "x9", "x29", 16)],
];
for (const [note, ask, js] of CASES) {
	check(`${note}（解釈）`, interp(ask), js());
	if (MACHINE) check(`${note}（機械）`, machineText(ask), js());
}

// ---- 形だけの行組み。JS 側に対応する関数が無い（`em.emit` が字面で書く）ので、
// **実際にコーパスへ出ている綴り**を的にする。`movz` はシフト付きしか出ていない。
const SHAPES = [
	["R,R（いちばん多い形）", "mov_rr 0 1", "mov x0, x1"],
	["R,I", "mov_ri 0 42", "mov x0, #42"],
	["R,I,S（movz は全部この形）", "movz_ris 9 4660 16", "movz x9, #4660, lsl #16"],
	["R,R,R", "alu_rrr `add` 0 1 2", "add x0, x1, x2"],
	["R,R,I", "alu_rri `sub` 0 1 8", "sub x0, x1, #8"],
	["R,R,M（ldp/stp）", "pair `stp` 19 20 `x29` 16", "stp x19, x20, [x29, #16]"],
	["R,R,R,C（csel）", "csel_c 0 1 2 `eq`", "csel x0, x1, x2, eq"],
	["L（分岐）", "br `b.eq` `.L3`", "b.eq .L3"],
];
for (const [note, ask, want] of SHAPES) {
	check(`${note}（解釈）`, interp(ask), want);
	if (MACHINE) check(`${note}（機械）`, machineText(ask), want);
}


// ---- 機械がまだ出せない所を、理由の数で覚えておく ----
//
// **この枚はまだ機械へ出ない。** 綴りを返す関数を重ねる形（`ln2` が引数をそのまま返す）は
// 置き場所が呼ぶ側の外（sret のスロット）でなければならず、その道がまだ無い。踏み抜くのでは
// なく**名指しで断っている**ので、ここは「まだ言語ではない」であって誤答ではない。
//
// 数ではなく**理由**で持つ（`doc_fences.test.js` と同じ規律）。直れば golden が減り、
// 新しく生えれば名指しで赤くなる。`emit.sn`（UART へ流す道）はこの枚と分けてあるので、
// 命令数の門（`corpus.js` / `sign_programs`）は巻き込まれない。
{
	const { nodes, env, diagnostics } = compile(SOURCE, { parse: parser.parse, readImport });
	check("前段は断らない", (diagnostics || []).filter((d) => (d.level || d.severity) === "error").length, 0);
	const r = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii" });
	const bad = r.diagnostics.filter((d) => (d.severity || d.level || "error") !== "information");
	const by = {};
	for (const d of bad) {
		const k = String(d.message).slice(0, 34);
		by[k] = (by[k] || 0) + 1;
	}
	// 鍵の並び順は走査の順で動くので、並べ直してから比べる（順序は事実ではない）。
	const sorted = (o) => JSON.stringify(Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])));
	check("機械がまだ出せない理由の内訳", sorted(by), sorted(KNOWN_MACHINE));
	for (const k of Object.keys(KNOWN_MACHINE)) {
		if (!by[k]) console.log(`     出せるようになった——KNOWN_MACHINE から削ること: ${k}`);
	}
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
