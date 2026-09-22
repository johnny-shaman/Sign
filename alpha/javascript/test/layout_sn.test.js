/**
 * **`alpha/sign/layout.sn` が `layout.js` と同じ答えを出すことを見る門。**
 *
 * `layout.js` は値の置き方と渡し方を決める。そのうち**型の名前と数だけで答えが決まる問い**
 * ——渡し方の表（stack_abi.md §4.6）・構造体の詰め方（§7.1・§7.2）・番地の域の表
 * （type_system.md §3.6）——を Sign へ移した。構文木を歩いてスロットの一覧を作る所は
 * 呼ぶ側に残る。
 *
 * 作りは `target_info_sn.test.js` と同じ3本立てである:
 *
 *   1. **答え** ——`layout_reached.js`（コーパスと試験一式が実際に立てた問い）を両エンジンへ
 *      立て、JS の答えと突き合わせる。**答えは書かない**——JS をその場で呼ぶ。
 *   2. **見えているか** ——`layout.js` の表の行を1本ずつずらし、問いの答えが動くかを見る。
 *      動かない行は誰も問うていないので、Sign 側に何を書いても門は緑である——名指しで赤にする。
 *   3. **移していない枝** ——移さないと決めた所へ、問いが届いていないこと。
 *
 * ## JS の答えと Sign の綴りの対応（`target_info_sn.test.js` と同じ）
 *
 *   JS の数            Int そのもの
 *   JS の文字列        String そのもの（機械の側では長さと1文字ずつで見る）
 *   JS の `null`       `__`
 *   JS の `false`      `__`（Sign の偽は `__` だけである）
 *   JS の `true`       `1`（番地の域に射が無い、の答え）
 *
 * 実行: node test/layout_sn.test.js（`npm test` からも呼ばれる）
 */
import fs from "fs";
import path from "path";
import os from "os";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { compile } from "../compile.js";
import { generateAsm } from "../pass4.js";
import * as I from "../interpreter.js";
import { runAsm, asInt, available, toolReport } from "../qemu_run.js";
import * as L from "../layout.js";
import { REACHED, OUTSIDE } from "./layout_reached.js";
import { SIGN_DIR, ASM_OPT, readImport } from "./corpus.js";

const B = "`";
const q = (s) => B + s + B;

const SN = path.join(SIGN_DIR, "layout.sn");
if (!fs.existsSync(SN)) {
	console.log(`${path.relative(process.cwd(), SN)} が無い——この門は移した先を見るものである`);
	console.log("\n0/1 passed");
	process.exit(1);
}
const SOURCE = fs.readFileSync(SN, "utf8").replace(/\r\n/g, "\n");

let passed = 0;
let total = 0;

// ---- 答えの綴り。JS と Sign の答えを同じ字面へ寄せる ----
function norm(v) {
	if (v === null || v === undefined || v === false) return "__";
	if (v === true) return "1";
	if (typeof v === "bigint") return String(v);
	if (typeof v === "number") return String(v);
	if (typeof v === "string") return q(v);
	return JSON.stringify(v);
}

// **バッククォートを含む綴りは字面に書けない**（囲みがそこで閉じる）。`bq_ch`（`layout.sn` の
// 文字）を挟んで並べると、文字と文字列の並置が連結になって同じ綴りに戻る。
//
// **組むのは関数の中で。** 問いの行でそのまま連結すると、機械は入口のフレームに器を組めず
// 「器の構築はまだ出せません」で断る（実測）。関数で包めば返す器の置き場所が決まる。だから
// 綴りごとに組む関数を1つ定義し、問いはそれを呼ぶ（`sx` は定義の行と呼ぶ式を返す）。
const sx = (s, tag) => {
	if (!s.includes(B)) return { defs: [], expr: q(s) };
	const pieces = [];
	s.split(B).forEach((p, i) => {
		if (i > 0) pieces.push("bq_ch");
		if (p) pieces.push(q(p));
	});
	const fn = `spell_${tag}`;
	return { defs: [`${fn} : _ ? ${pieces.join(" ")}`], expr: `(${fn} 0)` };
};
const withDefs = (defs, expr) => [...defs, expr].join("\n");

// 数の列。Sign の並置は Int どうしなら構築なので、そのまま器になる。
const ints = (xs) => "[" + xs.join(" ") + "]";

// ---- 問いを Sign の式へ開く ----
//
// `kind` は答えの型である。スカラーの `__` は niche、器の `__` は長さ 0 の器と、機械の上で
// 姿が違う（`target_info_sn.test.js` の `questionsOf` の注）。`char` は1文字の答えで、機械は
// 符号位置を、解釈器は長さ1の文字列を返すので、両方とも符号位置へ寄せる。
function questionsOf(row) {
	const conf = { target: row.target, charset: row.charset };
	switch (row.fn) {
		case "passingOf": {
			const p = L.passingOf({ atomType: row.type }, conf);
			const t = `${q(row.type)} ${q(row.target)}`;
			return [
				{ ask: `passing_mode ${t}`, kind: "str", want: p ? p.mode : null },
				{ ask: `passing_slots ${t}`, kind: "int", want: p ? p.slots : null },
				{ ask: `passing_size ${t}`, kind: "int", want: p ? p.size : null },
			];
		}
		case "slotCellSize": {
			const c = L.slotCellSize({ atomType: row.type }, conf);
			const t = `${q(row.type)} ${q(row.charset)} ${q(row.target)}`;
			return [
				{ ask: `cell_size ${t}`, kind: "int", want: c ? c.size : null },
				{ ask: `cell_align ${t}`, kind: "int", want: c ? c.align : null },
			];
		}
		case "measure": {
			const m = L.measure({ atomType: row.type }, conf);
			const t = `${q(row.type)} ${q(row.charset)} ${q(row.target)}`;
			return [
				{ ask: `meas_size ${t}`, kind: "int", want: m ? m.size : null },
				{ ask: `meas_align ${t}`, kind: "int", want: m ? m.align : null },
			];
		}
		case "measureRule": {
			// 要素の幅は呼ぶ側が引いて渡す（`rule_size_w`）。要素型が無ければ GPR の幅（`rule_size`）。
			const m = L.measure({ atomType: row.type, repr: "rule", elementType: row.el || undefined }, conf);
			const ask = row.el
				? `rule_size_w ${q(row.type)} (size_of ${q(row.el)} ${q(row.target)})`
				: `rule_size ${q(row.type)} ${q(row.target)}`;
			return [{ ask, kind: "int", want: m ? m.size : null }];
		}
		case "alignUp": {
			const [n, a] = row.args;
			return [{ ask: `align_up ${n} ${a}`, kind: "int", want: L.alignUp(n, a) }];
		}
		case "packSlots": {
			const entries = row.cells.map(([size, align], i) => ({ cell: { size, align }, ordinal: i }));
			const p = L.packSlots(entries, conf, row.kind);
			const sz = ints(row.cells.map((c) => c[0]));
			const al = ints(row.cells.map((c) => c[1]));
			return [
				{ ask: `pack_size ${sz} ${al}`, kind: "int", want: p ? p.size : null },
				{ ask: `pack_align ${sz} ${al}`, kind: "int", want: p ? p.align : null },
				...row.cells.map((_, k) => ({ ask: `nth_off ${sz} ${al} ${k} 0 0`, kind: "int", want: p ? p.slots[k].offset : null })),
			];
		}
		case "nameLt": {
			// 並べ替えの比較子（`packNamed` の `a.name < b.name`）を、隣り合う対の両向きで訊く。
			const [a, b] = row.args;
			const A = sx(a, "a");
			const Bq = sx(b, "b");
			const defs = [...A.defs, ...Bq.defs];
			return [
				{ ask: withDefs(defs, `name_lt ${A.expr} ${Bq.expr} 0`), kind: "int", want: a < b ? 1 : null },
				{ ask: withDefs(defs, `name_lt ${Bq.expr} ${A.expr} 0`), kind: "int", want: b < a ? 1 : null },
			];
		}
		case "bareName": {
			const [s] = row.args;
			const bare = L.bareName(s);
			const S = sx(s, "s");
			return [
				{ ask: withDefs(S.defs, `bare_len ${S.expr}`), kind: "int", want: typeof bare === "string" ? [...bare].length : null },
				...[...String(bare)].map((ch, i) => ({ ask: withDefs(S.defs, `bare_at ${S.expr} ${i}`), kind: "char", want: ch.codePointAt(0) })),
			];
		}
		case "addressWithoutArrow": {
			const [nm, lt, rt] = row.args;
			return [{ ask: `addr_no_arrow ${q(nm)} ${q(lt)} ${q(rt)}`, kind: "int", want: L.addressWithoutArrow(nm, lt, rt) }];
		}
		default:
			return [{ ask: null, want: null, unknown: row.fn }];
	}
}

/**
 * **移していない枝と、その理由。** 覆っていないことと、忘れていることは別である。
 *
 * - `Implicit`（`measureImplicit`）：場所の型。コーパスも試験一式も型の名前だけでは一度も
 *   問わない。移すなら、何を運ぶか（`pointee`・`fields`）ごと決める日に。
 * - 欄の綴り（`REF_FIELD_NAMES` / `REF_FIELD_TYPES` / `RULE_FIELD_NAMES`）：答えの `fields`
 *   にしか流れず、pass4 は `fields` を読まない。渡し方の境界（`align`）も同じで訊かない。
 * - カーソル（`measureCursor`）とスロットの一覧（`layoutOfStruct` など）：構文木を歩く。
 *   `layout_reached.js` の `OUTSIDE` がそれらの呼び出しを数えている。
 */
const NOT_PORTED = [
	{
		what: "Implicit（measureImplicit）",
		why: "場所の型は何を運ぶかごと決める必要がある",
		reached: () => REACHED.filter((r) => r.type === "Implicit" || r.el === "Implicit"),
	},
];

// **表の欄の綴りは門の外に置く。** 答えの `fields` にしか流れず、pass4 は読まない
// ——ずらしても答え（mode・本数・大きさ）は動かないので、下の「見えているか」には並べない。
const OUTSIDE_ROWS = ["REF_FIELD_NAMES", "REF_FIELD_TYPES", "RULE_FIELD_NAMES"];

// ---- Sign 側へ同じ問いを立てる ----
//
// **駆動の行は落とさない。** 落とすと残りの関数が「呼ばれていない」ことになり、機械の側が
// 出せなくなる。問いは駆動の後ろに足すだけでよい（最後の式の値が x0 に来る）。
const programOf = (ask) => SOURCE + (SOURCE.endsWith("\n") ? "" : "\n") + ask + "\n";

const interpCache = new Map();
function interpAnswer(ask, kind) {
	const key = kind + "\u0000" + ask;
	if (interpCache.has(key)) return interpCache.get(key);
	let out;
	try {
		const { nodes } = compile(programOf(ask), { charset: ASM_OPT.charset, readImport });
		const env = I.newRuntimeEnv(null, ASM_OPT.charset);
		let r = I.UNIT;
		for (const n of nodes) r = I.evaluate(n, env);
		// 名前が無いことは、答えが `__` であることとは違う（関数の位置の `__` は素通し）。
		const miss = env.diagnostics.filter((d) => d.identifier).map((d) => d.identifier);
		if (miss.length) out = `(未定義: ${[...new Set(miss)].join(" ")})`;
		else if (I.isUnit(r)) out = "__";
		else {
			const o = I.observe(r);
			out = kind === "char" && typeof o === "string" && [...o].length === 1 ? String(o.codePointAt(0)) : norm(o);
		}
	} catch (e) {
		out = "解釈で例外：" + e.message.split("\n")[0].slice(0, 70);
	}
	interpCache.set(key, out);
	return out;
}

const machineCache = new Map();
let qemuRuns = 0;
function machineInt(ask) {
	if (machineCache.has(ask)) return machineCache.get(ask);
	let out;
	try {
		const { nodes, env } = compile(programOf(ask), { charset: ASM_OPT.charset, readImport });
		const r = generateAsm(nodes, env, ASM_OPT);
		if (r.diagnostics.length) out = { fail: "出せない：" + r.diagnostics[0].message };
		else {
			qemuRuns++;
			out = { v: asInt(runAsm(r.text)[0]) };
		}
	} catch (e) {
		out = { fail: "機械で例外：" + e.message.split("\n")[0].slice(0, 70) };
	}
	machineCache.set(ask, out);
	return out;
}
function machineAnswer(ask, kind) {
	if (kind !== "str") {
		const r = machineInt(ask);
		return r.fail ? r.fail : r.v === null ? "__" : norm(r.v);
	}
	const len = machineInt(`||(${ask})||`);
	if (len.fail) return len.fail;
	// 長さ 0 は `__` である（器の `__` は長さ 0 の器として返る）。
	if (len.v === null || Number(len.v) === 0) return "__";
	let s = "";
	for (let i = 0; i < len.v; i++) {
		const c = machineInt(`(${ask}) ' ${i}`);
		if (c.fail) return c.fail;
		if (c.v === null) return `(${i} 文字目が __)`;
		s += String.fromCodePoint(Number(c.v));
	}
	return q(s);
}

// ---- 突き合わせ ----
const toolsOk = available();

/**
 * **問いはワーカーへ分けて立てる。** 1問ごとに compile・generateAsm・clang/lld/qemu を回すので、
 * 1本の糸では 1224 回の qemu で約 20 分かかった。問いどうしは何も共有しない（どちらのエンジンも
 * 問いごとに compile し直し、キャッシュが効くのは同じ問いの言い直しだけ）ので、分けても立てる問いと
 * 答えは同じで、変わるのは壁時計だけである。並べるのは4本まで——qemu を回す検査を積みすぎない。
 */
const WORKERS = Math.max(1, Math.min(4, (os.availableParallelism ? os.availableParallelism() : os.cpus().length) - 2));

if (isMainThread) await main();
else {
	const out = workerData.items.map(({ ask, kind }) => ({
		interp: interpAnswer(ask, kind),
		machine: toolsOk ? machineAnswer(ask, kind) : null,
	}));
	parentPort.postMessage({ out, qemuRuns });
}

// 問いを WORKERS 本へ配り、答えを元の並びで返す。配り方は飛び飛び（i % n）——同じ関数の問いが
// 並んでいるので、塊で切ると1本だけが重い問い（綴りを1文字ずつ訊くもの）を抱える。
function answersOf(list) {
	const n = Math.min(WORKERS, list.length);
	if (n === 0) return Promise.resolve([]);
	const slices = Array.from({ length: n }, () => []);
	list.forEach((it, i) => slices[i % n].push({ ask: it.ask, kind: it.kind }));
	const run = (items) =>
		new Promise((resolve, reject) => {
			// 再帰の深い compile を回すので、ワーカーの糸にも親と同じだけの深さを渡す。
			const w = new Worker(new URL(import.meta.url), { workerData: { items }, resourceLimits: { stackSizeMb: 64 } });
			let got = null;
			w.once("message", (m) => (got = m));
			w.once("error", reject);
			w.once("exit", (code) => (got && code === 0 ? resolve(got) : reject(new Error(`ワーカーが答えを返さずに終わった（終了コード ${code}）`))));
		});
	return Promise.all(slices.map(run)).then((parts) => {
		qemuRuns += parts.reduce((s, p) => s + p.qemuRuns, 0);
		const answers = new Array(list.length);
		parts.forEach((p, k) => p.out.forEach((a, j) => (answers[j * n + k] = a)));
		return answers;
	});
}

function report(note, item, got) {
	const want = item.kind === "char" && item.want !== null ? String(item.want) : norm(item.want);
	for (const [engine, g] of [["解釈", got.interp], ...(toolsOk ? [["機械", got.machine]] : [])]) {
		total++;
		if (g === want) {
			passed++;
			console.log(`ok   ${engine} ${note.padEnd(46)} ${want}`);
		} else {
			console.log(`FAIL ${engine} ${note.padEnd(46)} JS=${want} / Sign=${g}`);
		}
	}
}

async function main() {
	if (!toolsOk) console.log(`（qemu の道具が無いので機械の側は飛ばす: ${toolReport()}）`);

	const items = [];
	for (const row of REACHED) {
		for (const item of questionsOf(row)) {
			if (item.unknown) {
				total++;
				console.log(`FAIL 知らない問い ${item.unknown}（${JSON.stringify(row)}）——綴りを決めること`);
				continue;
			}
			items.push({ ...item, from: row.from, note: item.ask });
		}
	}
	// 同じ問いは1度だけ立てる（行が違っても、開いた問いが同じことがある）。
	const seen = new Set();
	const uniq = items.filter((it) => (seen.has(it.ask + it.kind) ? false : (seen.add(it.ask + it.kind), true)));

	/**
	 * **見えているか——表の行を、1本ずつ名指しで数える。**
	 *
	 * 測り方は `target_info_sn.test.js` と同じ：JS 側の行を1つだけ意味の変わる値へ置き、問いの
	 * 答えが1つでも動くかを見る。鍵のある表は「値」と「所属」を別々にずらす（値を変える／行を
	 * 落とす）。行の名前も値も `layout.js` から取る——一覧を写すと、表が増えた日に写した方だけが
	 * 古くなる。
	 */
	function wantsSnapshot() {
		return JSON.stringify(REACHED.map((r) => questionsOf(r).map((i) => norm(i.want))));
	}
	const put = (o, k, v) => () => {
		const was = o[k];
		o[k] = v;
		return () => (o[k] = was);
	};
	const del = (o, k) => () => {
		const was = o[k];
		delete o[k];
		return () => (o[k] = was);
	};
	const drop = (set, v) => () => {
		set.delete(v);
		return () => set.add(v);
	};
	const keyed = (name, o) =>
		Object.keys(o).flatMap((k) => [
			{ what: `${name} ${q(k)} の値`, perturb: put(o, k, o[k] === 1 ? 2 : o[k] - 1) },
			{ what: `${name} ${q(k)} の所属`, perturb: del(o, k) },
		]);
	const members = (name, set) => [...set].map((v) => ({ what: `${name} ${q(v)}`, perturb: drop(set, v) }));
	const LINES = [
		...keyed("REF_SLOTS", L.REF_SLOTS),
		...keyed("REG_SLOTS", L.REG_SLOTS),
		...keyed("RULE_SLOTS", L.RULE_SLOTS),
		...members("UNIT_TYPES", L.UNIT_TYPES),
		...members("ADDRESS_OPS", L.ADDRESS_OPS),
		...members("ADDRESS_FACTORIAL_OPS", L.ADDRESS_FACTORIAL_OPS),
		...members("ADDRESS_PARTNERS", L.ADDRESS_PARTNERS),
		...members("WEAK_LEFT_TYPES", L.WEAK_LEFT_TYPES),
		...members("ADDRESS_DOMAIN", L.ADDRESS_DOMAIN),
	];

	const blind = [];
	{
		const base = wantsSnapshot();
		for (const line of LINES) {
			const undo = line.perturb();
			let moved;
			try {
				moved = wantsSnapshot() !== base;
			} finally {
				undo();
			}
			total++;
			if (moved) {
				passed++;
				console.log(`ok   見えている ${line.what}`);
			} else {
				blind.push(line.what);
				console.log(`FAIL 見えない   ${line.what} ——この行は誰も問うていない。Sign 側に何を書いても門は緑である`);
			}
		}
		if (wantsSnapshot() !== base) {
			total++;
			console.log("FAIL ずらした表が戻っていない——以降の問いは信用できない");
		}
	}

	const answers = await answersOf(uniq);
	uniq.forEach((it, i) => report(it.note, it, answers[i]));

	for (const d of NOT_PORTED) {
		total++;
		const hits = d.reached();
		if (!hits.length) {
			passed++;
			console.log(`ok   移さず  ${d.what} ——まだ誰も問うていない`);
		} else {
			console.log(`FAIL 移さず  ${d.what} が到達した: ${hits.map((r) => JSON.stringify(r)).join(" / ")}`);
			console.log(`     ${d.why}——移すのか JS 側を直すのか、ここで決めること`);
		}
	}

	const byFrom = (f) => uniq.filter((i) => i.from === f).length;
	const said = uniq.filter((i) => norm(i.want) !== "__").length;
	console.log(
		`\n問い ${uniq.length} 通り（コーパスが立てた ${byFrom("corpus")} / 一式だけが立てた ${byFrom("suite")} / 足した ${byFrom("added")}）` +
			`、qemu を ${qemuRuns} 回まわした`
	);
	console.log(`うち答えが __ でない問いは ${said} 通り——残り ${uniq.length - said} 通りは、何も書いていない枚でも通る`);
	console.log(
		`表の行は ${LINES.length} 本、そのうち門が見ているのは ${LINES.length - blind.length} 本` +
			(blind.length ? `——見えていないのは ${blind.join(" / ")}` : "") +
			`（欄の綴り ${OUTSIDE_ROWS.join(" / ")} は門の外）`
	);
	if (OUTSIDE) console.log(`構文木を歩くので移さない呼び出し: ${JSON.stringify(OUTSIDE)}`);
	console.log(`\n${passed}/${total} passed`);
	process.exit(passed === total ? 0 : 1);
}
