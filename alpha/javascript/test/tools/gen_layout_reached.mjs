/**
 * **`test/layout_reached.js` を作り直す。** layout.js が実際に問われた問いのうち、型の名前
 * （と数・綴り）だけで答えが決まるものを拾い、`target_info_reached.js` と同じ規律で並べる。
 *
 *   cd alpha/javascript
 *   node test/tools/gen_layout_reached.mjs [<一式の記録のディレクトリ> …] [--out <file>]
 *
 * 1. **コーパス1巡はここで走らせる**（数秒）。子プロセスを `layout_trace_hooks.mjs` 付きで
 *    起こし、`corpus.js` の各 `.sn` を compile して、`ASM_OPT` と最適化を切った側
 *    （asm_gate の `PLAIN`）の2通りで generateAsm する。
 * 2. **一式の記録は読むだけ**である（1時間近くかかるので、ここでは走らせない）。採り方:
 *
 *      LAYOUT_TRACE=1 LAYOUT_TRACE_DIR=<dir> node --import ./test/tools/layout_trace_hooks.mjs test/run.js
 *
 *    記録の1枚1枚に、採ったときの layout.js の指紋が入っている。**今の layout.js と違う記録は
 *    読まない**（落とす）——古い layout.js への問いを今の表に載せると、誰も立てていない問いが混ざる。
 * 3. 畳んで、`test/layout_reached.js` を書く。ディレクトリを渡さなければコーパスの行だけになる。
 *
 * 畳み方の規律と、行の形は、生成する側の頭の注記（下の `header`）に書く——読む人が見るのは
 * そちらなので、説明は1か所に置く。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const JS = path.resolve(HERE, "..", "..");
const SELF = fileURLToPath(import.meta.url);
const HOOKS = pathToFileURL(path.join(HERE, "layout_trace_hooks.mjs")).href;

// asm_gate.test.js の `PLAIN` と同じもの。あちらは export していないので、ここに書く
// ——門が見ている2通りの `.s` を、同じ2通りで出すためである。
const PLAIN = { regAlloc: false, peepholes: false };

// ---------------------------------------------------------------------------------------------
// コーパス1巡（子プロセスの側）。フックが layout.js を包んでいる前提で走る。
// ---------------------------------------------------------------------------------------------
if (process.argv[2] === "--corpus-pass") {
	const out = process.argv[3];
	const peggy = (await import("peggy")).default;
	const { compile } = await import(pathToFileURL(path.join(JS, "compile.js")).href);
	const { generateAsm } = await import(pathToFileURL(path.join(JS, "pass4.js")).href);
	const { digestOf } = await import(pathToFileURL(path.join(JS, "asmdiff.mjs")).href);
	const { CORPUS, ASM_OPT, readImport, sourceOf, countInstructions } = await import(pathToFileURL(path.join(JS, "test", "corpus.js")).href);
	if (!globalThis.__LAYOUT_TRACE) throw new Error("layout.js が包まれていません（LAYOUT_TRACE とフックが要る）");
	const parser = peggy.generate(fs.readFileSync(path.join(JS, "sign.pegjs"), "utf8"));
	const started = Date.now();
	const drift = [];
	for (const entry of CORPUS) {
		const { nodes, env } = compile(sourceOf(entry), { parse: parser.parse, readImport });
		// **記録が機械語を変えていないかを、コーパスの golden で見る。** 包んだ関数は答えを
		// 変えないはずだが、`deref` には副作用がある（束縛の repr を値の節点へ写す）。記録の側が
		// 余計に辿って答えが動けば、拾った問いは門が見ている `.s` の問いではなくなる。
		for (const [label, opt, want, digest] of [
			["既定", ASM_OPT, entry.insn.full, entry.digest.full],
			["最適化を切った側", { ...ASM_OPT, ...PLAIN }, entry.insn.plain, entry.digest.plain],
		]) {
			const text = generateAsm(nodes, env, opt).text;
			if (countInstructions(text) !== want || digestOf(text) !== digest) drift.push(`${entry.rel}（${label}）`);
		}
	}
	if (drift.length) {
		console.error(`コーパスの .s が corpus.js の golden と合いません: ${drift.join(" / ")}`);
		console.error("記録が答えを動かしたか、corpus.js が古い（asm_gate.test.js も落ちているはず）。");
		process.exit(1);
	}
	fs.writeFileSync(out, JSON.stringify({ meta: globalThis.__LAYOUT_TRACE.meta, rows: globalThis.__LAYOUT_TRACE.rows(), entries: CORPUS.length, ms: Date.now() - started }));
	process.exit(0);
}

// ---------------------------------------------------------------------------------------------
// 生成（親の側）。layout.js は包まずに読む——畳むときに JS へ問い直すのは素の layout.js である。
// ---------------------------------------------------------------------------------------------
delete process.env.LAYOUT_TRACE;
const { layoutShaOf } = await import(HOOKS);
const L = await import(pathToFileURL(path.join(JS, "layout.js")).href);
const TI = await import(pathToFileURL(path.join(JS, "target_info.js")).href);

const argv = process.argv.slice(2);
let outFile = path.join(JS, "test", "layout_reached.js");
const suiteDirs = [];
for (let i = 0; i < argv.length; i++) {
	if (argv[i] === "--out") outFile = path.resolve(argv[++i]);
	else suiteDirs.push(path.resolve(argv[i]));
}

const layoutSrc = fs.readFileSync(path.join(JS, "layout.js"), "utf8");
const tiSrc = fs.readFileSync(path.join(JS, "target_info.js"), "utf8");
const SHA = layoutShaOf(layoutSrc);

// ---- 1. コーパス1巡 ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "layout-reached-"));
const corpusFile = path.join(tmp, "corpus.json");
const env = { ...process.env, LAYOUT_TRACE: "1" };
delete env.LAYOUT_TRACE_DIR;
const run = spawnSync(process.execPath, ["--stack-size=16000", "--import", HOOKS, SELF, "--corpus-pass", corpusFile], { cwd: JS, env, stdio: ["ignore", "inherit", "inherit"] });
if (run.status !== 0) {
	console.error(`コーパス1巡が落ちました（終了コード ${run.status}）`);
	process.exit(1);
}
const corpus = JSON.parse(fs.readFileSync(corpusFile, "utf8"));
fs.rmSync(tmp, { recursive: true, force: true });
if (corpus.meta.layoutSha !== SHA) throw new Error("コーパス1巡の layout.js の指紋が合いません（読み込みの途中で書き換わった？）");

// ---- 2. 一式の記録 ----
const suiteFiles = [];
const stale = [];
for (const dir of suiteDirs) {
	for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
		const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
		if (!j.meta || j.meta.layoutSha !== SHA) stale.push(path.join(path.basename(dir), f));
		else suiteFiles.push({ name: f, meta: j.meta, rows: j.rows });
	}
}
if (stale.length) {
	console.error(`今の layout.js で採っていない記録があります（${stale.length} 枚）:\n  ${stale.join("\n  ")}`);
	console.error("一式を採り直してください（このファイルの頭の注記を見よ）。");
	process.exit(1);
}
// **門自身が立てる問いは数えない。** `layout_sn.test.js` は この表から問いを立てて JS に訊く。
// その記録を次の表へ入れると、足した問い（`added`）がそのまま「一式が立てた」に化け、
// 誰も立てない行が見えなくなる——表が自分を根拠にする輪になる。
const GATE_TESTS = new Set(["layout_sn.test.js"]);
const gateFiles = suiteFiles.filter((s) => GATE_TESTS.has(path.basename(s.meta.argv1 || "")));
const usedFiles = suiteFiles.filter((s) => !gateFiles.includes(s));
const recs = [...corpus.rows.map((r) => ({ ...r, from: "corpus" })), ...usedFiles.flatMap((s) => s.rows.map((r) => ({ ...r, from: "suite" })))];

// ---------------------------------------------------------------------------------------------
// 行の名前。**JS の表と腕から取る**——畳み方の側へ写すと、表に行を足した日に片方だけ古くなる。
// ---------------------------------------------------------------------------------------------
// `type === "Char"` のように、型の名前で分かれる腕も行である（表に居なくても Sign 側では別の腕を読む）。
const armsOf = (src) => [...src.matchAll(/\b(?:type|atomType|el)\s*===\s*"([A-Za-z_]\w*)"/g)].map((m) => m[1]);
const TYPE_ROWS = new Set([
	...Object.keys(L.REF_SLOTS),
	...Object.keys(L.REG_SLOTS),
	...L.UNIT_TYPES,
	...Object.keys(L.RULE_SLOTS),
	...Object.keys(TI.SIGNEDNESS),
	...Object.keys(TI.WIDTH_CLASS),
	...armsOf(layoutSrc),
	...armsOf(tiSrc),
]);
const TARGET_ROWS = new Set(Object.keys(TI.TARGET_WIDTHS));
const CS_ROWS = new Set(Object.keys(TI.CHARSETS));
// 行に無い鍵は Sign 側でも「鍵が無いので `__`」の1本道なので畳んでよい。`null`（conf に無い）は
// 別に置く——`__` を引くのと、表に無い綴りを引くのとは、Sign 側では別の道でありうる。
const rowOf = (set, v) => {
	if (v === null || v === undefined) return "(無い)";
	if (set.has(v)) return v;
	if (typeof v === "string" && v.includes(" | ")) return `(直和:${v.split(" | ").map((p) => (set.has(p.trim()) ? p.trim() : "(行に無い)")).join("|")})`;
	return "(行に無い)";
};
// 綴りの包み方（`bareName` の腕）。
const wrapKind = (v) => (typeof v !== "string" ? "非文字列" : v.length < 2 ? "短い" : v[0] === "<" && v.at(-1) === ">" ? "<>" : v[0] === "`" && v.at(-1) === "`" ? "``" : "素");

// ---------------------------------------------------------------------------------------------
// **表の行のことは、素の layout.js に問い直して数える。** 2つに使う: 番地の問いの道（どの行を
// 引いて当たったか外れたか）と、行が見えているか（行をずらして答えが動くか）。
// ---------------------------------------------------------------------------------------------
const SET_TABLES = ["UNIT_TYPES", "ADDRESS_FACTORIAL_OPS", "ADDRESS_OPS", "WEAK_LEFT_TYPES", "ADDRESS_DOMAIN", "ADDRESS_PARTNERS"];
const OBJ_TABLES = ["REF_SLOTS", "REG_SLOTS", "RULE_SLOTS"];
let reads = null;
for (const t of SET_TABLES) {
	// 表の Set 自身に `has` を生やす。layout.js は同じ Set を `T.has(v)` で引くので、ここを通る。
	Object.defineProperty(L[t], "has", {
		value(v) {
			const hit = Set.prototype.has.call(this, v);
			if (reads) reads.push([t, hit ? v : null]);
			return hit;
		},
		configurable: true,
	});
}
const readsOf = (f) => {
	reads = [];
	try {
		f();
	} catch {
		// 答えが例外でも、そこまでに読んだ行は読んだ行である。
	}
	const r = reads;
	reads = null;
	return r;
};
const u = (v) => (v === null ? undefined : v);
// 行を JS へ問い直した答え（JSON）。`measureRule` は `measure` の入口から入る（門と同じ入口）。
// `slotCellSize` は export されているときだけ問い直す。表を引かない問い（`alignUp` / `packSlots` /
// `nameLt` / `bareName`）は `null` で、行が見えるかの勘定に入らない。
const answerOf = (r) => {
	const conf = { target: u(r.target), charset: u(r.charset) };
	try {
		switch (r.fn) {
			case "passingOf": return JSON.stringify(L.passingOf({ atomType: u(r.type) }, conf) ?? null);
			case "slotCellSize": return L.slotCellSize ? JSON.stringify(L.slotCellSize({ atomType: u(r.type) }, conf) ?? null) : null;
			case "measure": return JSON.stringify(L.measure({ atomType: u(r.type) }, conf) ?? null);
			case "measureRule": return JSON.stringify(L.measure({ atomType: u(r.type), elementType: u(r.el), repr: "rule" }, conf) ?? null);
			case "addressWithoutArrow": return JSON.stringify(L.addressWithoutArrow(...r.args));
			default: return null; // 表を引かない問い
		}
	} catch (e) {
		return "(例外) " + e.message;
	}
};
const replay = (r) => readsOf(() => answerOf(r));

/**
 * **行が見えているか**——表の行を1本ずらして、どれかの問いの答えが動くか。
 *
 * 「引いた」では足りない。`mul Unit Int` は `WEAK_LEFT_TYPES` の `Unit` を引くが、`Unit` を
 * 表から抜いても答えは `false` のまま（域が `Int` でも `Unit` でも番地ではない）——その行を
 * Sign 側でどう書いても、この問いは緑のままである。門（`layout_sn.test.js` の「見えているか」）と
 * 同じ測り方をここでもする。ずらし方は Set なら抜く（所属）、オブジェクトなら値をずらすのと
 * 抜くの2通り。並びは元に戻す（`first` が Set の並びを使う）。
 */
const SHIFTS = (t, k) => {
	const tab = L[t];
	if (tab instanceof Set) {
		const saved = [...tab];
		return [["所属", () => tab.delete(k), () => (tab.clear(), saved.forEach((x) => tab.add(x)))]];
	}
	const saved = Object.entries(tab);
	const restore = () => {
		for (const key of Object.keys(tab)) delete tab[key];
		for (const [key, v] of saved) tab[key] = v;
	};
	return [
		// 門と同じずらし方（1 なら 2、それ以外は 1 減らす）。上へずらすと、本数が欄の綴りの数
		// （`REF_FIELD_NAMES` は2つ）で頭打ちになって答えが動かない行がある。
		["値", () => (tab[k] = typeof tab[k] === "number" ? (tab[k] === 1 ? 2 : tab[k] - 1) : "(ずらした)"), restore],
		["所属", () => delete tab[k], restore],
	];
};
const rowsOfTable = (t) => (L[t] instanceof Set ? [...L[t]] : Object.keys(L[t]));
const seenBy = (rows, t, k) => {
	const base = rows.map(answerOf);
	const out = [];
	for (const [how, shift, restore] of SHIFTS(t, k)) {
		shift();
		try {
			if (rows.some((r, i) => base[i] !== null && answerOf(r) !== base[i])) out.push(how);
		} finally {
			restore();
		}
	}
	return { out, all: SHIFTS(t, k).map(([how]) => how) };
};
// 番地の問いは、**読んだ行の並び**が道である（引かなかった引数は畳んでよい。引いて外れたのは `-`）。
const awKey = (args) => "addressWithoutArrow|" + replay({ fn: "addressWithoutArrow", args }).map(([t, v]) => `${t}:${v ?? "-"}`).join("|");

// ---------------------------------------------------------------------------------------------
// 問いを行へ。行にならない呼び出しは OUTSIDE へ数える（理由つき）。
// ---------------------------------------------------------------------------------------------
const outside = { corpus: {}, suite: {} };
const why = {};
const tally = (r, reason) => {
	const o = outside[r.from];
	o[r.fn] = (o[r.fn] || 0) + r.cnt;
	why[r.fn] ??= {};
	why[r.fn][reason] = (why[r.fn][reason] || 0) + r.cnt;
};
const calls = { corpus: 0, suite: 0 };
const cands = []; // { row, from, key, sort }

const sizeKey = (...xs) => xs.map((x) => (typeof x === "number" ? String(x).padStart(12, "0") : String(x))).join("\u0000");

for (const r of recs) {
	calls[r.from] += r.cnt;
	switch (r.fn) {
		case "passingOf":
		case "slotCellSize":
		case "measure": {
			if (!r.type) { tally(r, "型が無い"); break; }
			if (r.walked.length) { tally(r, `木を歩いた（${r.walked.join("・")}）`); break; }
			// 名前だけの節点で問い直しても木へ入る（`measure` の `List` / `String` / `Struct`）なら、
			// JS はその問いに名前では答えていない。
			if (r.synWalked.length) { tally(r, `名前だけでも木へ入る（${r.synWalked.join("・")}）`); break; }
			if (!r.typeOnly) { tally(r, "型の名前だけでは答えが違う"); break; }
			const row = { fn: r.fn, type: r.type, target: r.target, charset: r.charset };
			cands.push({ row, from: r.from, key: `${r.fn}|${rowOf(TYPE_ROWS, r.type)}|${rowOf(TARGET_ROWS, r.target)}|${rowOf(CS_ROWS, r.charset)}`, sort: sizeKey(r.type.length, r.type, String(r.target), String(r.charset)) });
			break;
		}
		case "measureRule": {
			// 型の無い規則（辿った先が型を名乗らない）は、名前で問い直す入口が無い。
			if (!r.type) { tally(r, "型が無い"); break; }
			if (!r.nameOnly) { tally(r, "型と要素型だけでは答えが違う"); break; }
			const row = { fn: "measureRule", type: r.type, el: r.el, target: r.target, charset: r.charset };
			cands.push({ row, from: r.from, key: `measureRule|${rowOf(TYPE_ROWS, r.type)}|el=${rowOf(TYPE_ROWS, r.el)}|${rowOf(TARGET_ROWS, r.target)}|${rowOf(CS_ROWS, r.charset)}`, sort: sizeKey(String(r.type), String(r.el)) });
			break;
		}
		case "alignUp": {
			const [n, a] = r.args;
			const arm = typeof a === "number" && a > 0 ? (n % a === 0 ? (n === 0 ? "零" : "割り切れる") : "切り上げる") : "境界なし";
			cands.push({ row: { fn: "alignUp", args: r.args }, from: r.from, key: `alignUp|${arm}|a=${a}`, sort: sizeKey(n, a) });
			break;
		}
		case "packSlots": {
			if (!r.cells) { tally(r, "並べられない（測れないスロットがある）"); break; }
			const n = r.cells.length;
			let end = 0, pad = false, max = 1, up = false, keep = false;
			r.cells.forEach(([size, align], i) => {
				if (r.offsets[i] !== end) pad = true;
				end = r.offsets[i] + size;
				if (align > max) { up = true; max = align; } else keep = true;
			});
			const shape = [n === 0 ? "0本" : n === 1 ? "1本" : "複数", pad ? "詰め物あり" : "詰め物なし", r.size !== end ? "末尾を切り上げる" : "末尾そのまま", `境界:${[up && "上げる", keep && "据え置く"].filter(Boolean).join("+") || "なし"}`];
			const row = { fn: "packSlots", kind: r.kind, target: r.target, charset: r.charset, cells: r.cells };
			cands.push({ row, from: r.from, key: `packSlots|${r.kind}|${shape.join("|")}|${rowOf(TARGET_ROWS, r.target)}|${rowOf(CS_ROWS, r.charset)}`, sort: sizeKey(n, r.cells.reduce((s, c) => s + c[0], 0), JSON.stringify(r.cells)) });
			break;
		}
		case "packNamed": {
			// **並べ替えは隣り合う対へ開く。** Sign 側が持つのは比較子（`名前 < 名前`）だけで、
			// 並べ替えの正しさは隣どうしの比較が全部正しいことと同じである。
			for (let i = 0; i + 1 < r.names.length; i++) {
				const a = r.names[i], b = r.names[i + 1];
				let arm;
				if (a === b) arm = "等しい";
				else if (typeof a !== "string" || typeof b !== "string") arm = "非文字列";
				else {
					let k = 0;
					while (k < a.length && k < b.length && a[k] === b[k]) k++;
					arm = k >= a.length || k >= b.length ? "片方が先に尽きる" : "文字で決まる";
				}
				cands.push({ row: { fn: "nameLt", args: [a, b] }, from: r.from, key: `nameLt|${arm}|${wrapKind(a)}${wrapKind(b)}`, sort: sizeKey(String(a).length + String(b).length, JSON.stringify([a, b])) });
			}
			break;
		}
		case "bareName": {
			const [v] = r.args;
			cands.push({ row: { fn: "bareName", args: r.args }, from: r.from, key: `bareName|${wrapKind(v)}`, sort: sizeKey(String(v).length, JSON.stringify(v)) });
			break;
		}
		case "addressWithoutArrow": {
			cands.push({ row: { fn: "addressWithoutArrow", args: r.args }, from: r.from, key: awKey(r.args), sort: sizeKey(JSON.stringify(r.args).length, JSON.stringify(r.args)) });
			break;
		}
		default:
			// 構文木を歩く関数と、器の形を訊く関数。名前では答えられない。
			tally(r, "構文木か形が要る");
	}
}

// ---------------------------------------------------------------------------------------------
// 畳む。**コーパスの行は畳まない**（同じ問いが2度立っただけのものを1つにするだけ）。
// **一式の行は道で畳む**——コーパスの行と同じ道なら載せず、残りは道ごとに最小の代表1つ。
// ---------------------------------------------------------------------------------------------
const qid = (row) => JSON.stringify(row);
const corpusRows = new Map();
const corpusKeys = new Set();
for (const c of cands.filter((c) => c.from === "corpus")) {
	corpusKeys.add(c.key);
	if (!corpusRows.has(qid(c.row))) corpusRows.set(qid(c.row), c);
}
const suiteRows = new Map();
for (const c of cands.filter((c) => c.from === "suite")) {
	if (corpusKeys.has(c.key)) continue;
	const had = suiteRows.get(c.key);
	if (!had || c.sort < had.sort || (c.sort === had.sort && qid(c.row) < qid(had.row))) suiteRows.set(c.key, c);
}
const reached = [...corpusRows.values(), ...suiteRows.values()];

// ---------------------------------------------------------------------------------------------
// **誰も見ていない行を見えるようにする**——名前だけで答えが決まる所に限って、問いを足す
// （`from: "added"`、理由つき）。コーパスか一式の問いで行が見えていれば足さない。
// ---------------------------------------------------------------------------------------------
const added = [];
{
	// 番地の表。どの行も「演算・左辺・右辺」の名前だけで答えが決まる。問いは他の表の先頭の行で組む。
	const first = (t) => [...L[t]][0];
	const build = {
		ADDRESS_FACTORIAL_OPS: (v) => [v, first("ADDRESS_DOMAIN")],
		ADDRESS_OPS: (v) => [v, first("ADDRESS_DOMAIN"), first("ADDRESS_PARTNERS")],
		WEAK_LEFT_TYPES: (v) => [first("ADDRESS_OPS"), v, first("ADDRESS_DOMAIN")],
		ADDRESS_DOMAIN: (v) => [first("ADDRESS_OPS"), v, first("ADDRESS_PARTNERS")],
		ADDRESS_PARTNERS: (v) => [first("ADDRESS_OPS"), first("ADDRESS_DOMAIN"), v],
	};
	const reachedRows = reached.map((c) => c.row);
	for (const [t, mk] of Object.entries(build)) {
		// 並びの写しを回る。`seenBy` が Set を抜いて入れ直すので、Set そのものを回ると入れ直した行を
		// もう一度訪ねて終わらない。
		for (const v of rowsOfTable(t)) {
			if (seenBy(reachedRows, t, v).out.length) continue;
			const row = { fn: "addressWithoutArrow", args: mk(v) };
			// 組んだ問いで本当に行が見えるかを、JS に問い直して確かめる（表の形が変われば組み方も変わる）。
			if (!seenBy([row], t, v).out.length) throw new Error(`足す問い ${JSON.stringify(row.args)} で ${t} の ${v} が見えません`);
			// 1つの問いが2つの行を見せることもある（`mul Address Int` は ADDRESS_DOMAIN の Address と
			// ADDRESS_PARTNERS の Int の両方）。問いは1つにして、理由に行を並べる。
			const same = added.find((c) => qid(c.row) === qid(row));
			if (same) same.rowsFor.push(`${t} の \`${v}\``);
			else added.push({ row, from: "added", key: awKey(row.args), rowsFor: [`${t} の \`${v}\``] });
		}
	}
	for (const c of added) {
		c.why = `${c.rowsFor.join("・")} の行は、コーパスも一式も見ていない（表から抜いても誰の答えも動かない）。演算・左辺・右辺の名前だけで答えが決まるので、見える問いを1つ置く。`;
		delete c.rowsFor;
	}
}
{
	// 切り上げる腕（割り切れない n）。一式が通っていれば足さない。
	const aligns = reached.filter((c) => c.row.fn === "alignUp");
	if (!aligns.some((c) => c.key.startsWith("alignUp|切り上げる|"))) {
		const a = Math.max(0, ...aligns.map((c) => c.row.args[1]).filter((x) => typeof x === "number"));
		if (a > 1) added.push({ row: { fn: "alignUp", args: [a + 1, a] }, from: "added", key: `alignUp|切り上げる|a=${a}`, why: "切り上げる腕（割り切れない n）を誰も通らない。詰め物と末尾の切り上げはこの腕でしか起きないので、問いを1つ置く。" });
	}
}

{
	// **剥いだ後も包みに見える名前。** `packNamed` が並べるのは `bareName` を通した後の綴りで、
	// `<z>`（字面では `` `<z>` ``）は `<z>` のまま `a` より前に来る（`<` は `a` より小さい）。
	// 比較子の側でもう一度剥ぐと `z` として後ろへ回り、スロットのオフセットが黙って入れ替わる
	// ——`layout.sn` の最初の `name_lt` がそうだった。コーパスも一式もこの形の名前を並べないので、
	// 2つの読みで答えが割れる対を1つ置く。
	const looksWrapped = (v) => wrapKind(v) === "<>" || wrapKind(v) === "``";
	if (!reached.some((c) => c.row.fn === "nameLt" && c.row.args.some(looksWrapped))) {
		const row = { fn: "nameLt", args: ["<z>", "a"] };
		added.push({ row, from: "added", key: `nameLt|文字で決まる|${wrapKind("<z>")}${wrapKind("a")}`, why: "剥いだ後も包みに見える名前（<z>）を誰も並べない。比べるのは剥いだ後の綴りそのもので、もう一度剥ぐと並びが入れ替わる。" });
	}
}

// ---------------------------------------------------------------------------------------------
// 並べて書く。
// ---------------------------------------------------------------------------------------------
const FN_ORDER = ["passingOf", "slotCellSize", "measure", "measureRule", "alignUp", "packSlots", "nameLt", "bareName", "addressWithoutArrow"];
const byOrder = (x, y) => FN_ORDER.indexOf(x.row.fn) - FN_ORDER.indexOf(y.row.fn) || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0) || (qid(x.row) < qid(y.row) ? -1 : qid(x.row) > qid(y.row) ? 1 : 0);
const groups = { corpus: [...corpusRows.values()].sort(byOrder), suite: [...suiteRows.values()].sort(byOrder), added: added.sort(byOrder) };
const all = [...groups.corpus, ...groups.suite, ...groups.added];

const lit = (v) => JSON.stringify(v);
const rowText = (c) => {
	const o = { ...c.row, from: c.from, key: c.key, ...(c.why ? { why: c.why } : {}) };
	// 行の欄の並びは門が読む形に揃える（fn / 問いの欄 / from / key / why）。
	return "\t{ " + Object.entries(o).map(([k, v]) => `${k}: ${lit(v)}`).join(", ") + " },";
};

const countBy = (xs, f) => xs.reduce((o, x) => ((o[f(x)] = (o[f(x)] || 0) + 1), o), {});
const byFn = countBy(all, (c) => c.row.fn);
const byFrom = countBy(all, (c) => c.from);
const OUTSIDE = {};
for (const o of [outside.corpus, outside.suite]) for (const [k, v] of Object.entries(o)) OUTSIDE[k] = (OUTSIDE[k] || 0) + v;

// 表の行をずらしても答えが動かない所（門の「見えているか」と同じ測り方）。ここに残るのは、
// 名前だけでは問いを足さなかった表の行である——足すかどうかは門の側で決める。
const unseen = [];
for (const t of [...OBJ_TABLES, ...SET_TABLES]) {
	for (const k of rowsOfTable(t)) {
		const { out, all: hows } = seenBy(all.map((c) => c.row), t, k);
		for (const how of hows) if (!out.includes(how)) unseen.push(`${t} \`${k}\`（${how}）`);
	}
}

const TRACE_INFO = {
	date: new Date().toISOString().slice(0, 10),
	layoutSha: SHA,
	corpus: { entries: corpus.entries, calls: calls.corpus, distinct: corpus.rows.length, ms: corpus.ms },
	suite: {
		dirs: suiteDirs.map((d) => path.basename(d)),
		files: usedFiles.length,
		skippedGate: gateFiles.map((s) => s.name),
		calls: calls.suite,
		distinct: usedFiles.reduce((s, f) => s + f.rows.length, 0),
	},
	rows: { total: all.length, byFn, byFrom },
	outside: { corpus: outside.corpus, suite: outside.suite, why },
	unseen,
};

const fnList = (o) => FN_ORDER.filter((f) => o[f]).map((f) => `${f} ${o[f]}`).join(" / ");
const header = `/**
 * **\`layout.js\` が実際に問われた問いのうち、名前だけで答えが決まるものの全部。**
 *
 * 手で選んだ一覧ではない。\`layout.js\` の関数を1つ残らず包んで、**コーパスを1巡させたときと
 * JS 側のテスト一式を走らせたときに立った問いだけ**を拾ってある（\`test/tools/\` の2本で作る。
 * 作り方は末尾）。門が捕まえられる上限はここで決まる——誰も立てない問いは、Sign 側をどう
 * 書いても門は緑のままである（\`target_info_reached.js\` と同じ考え方）。
 *
 * \`from\` はその問いを誰が立てたか:
 *   corpus  コーパス（\`corpus.js\` の ${corpus.entries} 枚）を compile し、\`ASM_OPT\` と最適化を切った側の
 *           2通りで generateAsm したときに立った（${byFrom.corpus || 0} 行）。**1つも畳まない**——同じ問いが
 *           2度立ったものを1つにするだけである。
 *   suite   コーパスでは立たないが、JS 側のテスト一式が立てた（${byFrom.suite || 0} 行）。**Sign 側が同じ道を
 *           通る問いだけ**を畳んだ代表で、道ごとに最小のもの1つを置く。
 *   added   誰も立てないが、表の行を見えるようにするために足した（${byFrom.added || 0} 行）。\`why\` に理由がある。
 *           答えが名前だけで決まる所に限る（番地の表の行と、\`alignUp\` の切り上げる腕と、剥いだ後も包みに
 *           見える名前の \`nameLt\`）。「見える」は
 *           門と同じ測り方で、行を表から抜いてどれかの問いの答えが動くこと——引いただけでは足りない
 *           （\`mul Unit Int\` は \`WEAK_LEFT_TYPES\` の \`Unit\` を引くが、抜いても答えは \`false\` のまま）。
 *           コーパスか一式の問いで見えるようになれば、生成器は足さない。
 *
 * 関数ごと（${all.length} 行）: ${fnList(byFn)}。
 *
 * ## 名前だけで答えが決まる、とは
 *
 * \`passingOf\` / \`slotCellSize\` / \`measure\` は節点を受けるが、行に載せるのは**型の名前と
 * ターゲットと charset だけで同じ答えが出た**問いに限る。確かめ方は3つで、全部を要る:
 *
 *   1. 同じ関数へ \`{ atomType: 型 }\` だけの節点で問い直して、答えが JSON で一致する。
 *   2. 呼び出しの間に構文木を歩いていない。歩く関数（\`listItems\` / \`stringLength\` /
 *      \`layoutOfStruct\` / \`cursorParts\`、要素型を読む \`measureRule\` / \`measureImplicit\`、
 *      型が節点に無く束縛を辿って分かった \`deref\`、前置 \`~\` の中身）に入ったら、
 *      **いちばん内側の問い**に印が付く。答えをそのまま返した問いは、内側の印を引き継ぐ。
 *   3. 1 の問い直しの側も歩いていない。\`measure({ atomType: "List" })\` は \`measureList\` に入り、
 *      数える中身が無いので \`null\` を返す——JS はその問いに名前では答えていない。実測で、
 *      入れ子の見張り（\`MAX_NEST\` を越えた深さ）で辿る前に \`null\` を返した \`measure\` が、
 *      1 と 2 だけではすり抜けて \`measure List\` の行になっていた。
 *
 * 1 だけでは足りない。\`measure\` は \`[…]\` の中身を数えて \`null\` を返すことがあり、名前だけの
 * 節点も（数える中身が無いので）\`null\` を返す——答えは同じだが、前者は中身で決まっている。
 * 逆に \`passingOf\` が中で \`measure\` を呼んで器の中身を数えても、印は内側の \`measure\` に付く。
 * \`passingOf\` が使うのはその答えの \`repr\` だけで、\`List\` なら何が入っていても \`{ptr, len}\` である。
 *
 * \`measureRule\` は型と要素型とターゲットしか読まないので、要素型（\`el\`）も行に載せる。
 * 名前だけで答えられない呼び出しは \`OUTSIDE\` に数だけ置く（理由は \`TRACE_INFO.outside.why\`）。
 *
 * ## 畳んでよいのは道であって、答えではない
 *
 * \`target_info_reached.js\` の規律をそのまま使う。**表の鍵と腕は畳まない**——答えが同じでも
 * Sign 側では別の行・別の腕を読むからである。行の名前は JS から取る: 型は \`REF_SLOTS\` /
 * \`REG_SLOTS\` / \`UNIT_TYPES\` / \`RULE_SLOTS\` と \`target_info.js\` の \`SIGNEDNESS\` / \`WIDTH_CLASS\`、
 * それに \`layout.js\` / \`target_info.js\` のソースにある \`type === "…"\` の腕。ターゲットは
 * \`TARGET_WIDTHS\`、charset は \`CHARSETS\`。行に無い鍵（\`Scalar\` / \`cortex_m\` …）は Sign 側でも
 * 「鍵が無い」の1本道なので畳む。直和は枝ごとに行を見て、**並びは畳まない**（広さが同じ枝は
 * 先の枝が勝つので、並びが答えを決める）。
 *
 *   passingOf / slotCellSize / measure  関数 × 型の行 × ターゲットの行 × charset の行
 *   measureRule          同じく、要素型の行も
 *   alignUp              腕（零 / 割り切れる / 切り上げる / 境界なし）× 境界の値
 *   packSlots            種 × 本数（0 / 1 / 複数）× 詰め物 × 末尾の切り上げ × 境界の上がり方
 *                        × ターゲット × charset。\`cells\` は詰めた順の [幅, 境界] で、オフセットと
 *                        全体の大きさ・境界は門が JS から出し直す
 *   nameLt               \`packNamed\` の並べ替えを、並べた後の隣り合う対へ開いたもの（a が先）。
 *                        どこで決まるか（文字 / 片方が先に尽きる / 等しい）× 両方の包み方
 *   bareName             包み方（\`<…>\` / \`\\\`…\\\`\` / 素 / 短い / 非文字列）
 *   addressWithoutArrow  **実際に読んだ表の行の並び**（素の layout.js に問い直して数える）。
 *                        読まなかった引数は畳み、引いて外れた行は \`-\` と書く
 *
 * ## 載せない表
 *
 * \`REF_FIELD_NAMES\` / \`REF_FIELD_TYPES\` / \`RULE_FIELD_NAMES\` は答えの \`fields\` にしか効かず、
 * pass4 は \`fields\` を読まない。門はそこを外と宣言するので、ここにも問いを足さない。
 * 表の行をずらしてもここの問いの答えが動かない所は \`TRACE_INFO.unseen\` に名指しする
 * （素の layout.js へ問い直して数えた。門の「見えているか」と同じ測り方）。
 *
 * ## 答えはここに書かない
 *
 * 答えを持っているのは \`layout.js\` なので、門は実行時に JS へ同じ問いを立てて突き合わせる
 * ——二重に書くと片方だけ直る。**\`null\` は「無かった」**（conf に \`charset\` が無い、など）。
 * ここで確かめた問い直しは \`undefined\` で渡しているが、\`target\` / \`charset\` は \`null\` で渡しても
 * 同じ答えになる（\`widthsOf\` も \`charSizeOf\` も既定へ落ちる）。\`measureRule\` の \`el\` だけは
 * \`undefined\` で渡す——\`null\` だと答えの \`fields\` に \`type: null\` が載って JSON が変わる。
 *
 * ## 測り直す
 *
 * \`layout.js\` を変えたら、一式の記録から採り直す。記録には layout.js の指紋（\`export {\` より前の
 * sha256）が入っていて、生成器は今の layout.js と違う記録を読まない——export を1つ足しただけ
 * なら指紋は動かない。\`alpha/javascript\` で:
 *
 *   LAYOUT_TRACE=1 LAYOUT_TRACE_DIR=<dir> node --import ./test/tools/layout_trace_hooks.mjs test/run.js
 *   node test/tools/gen_layout_reached.mjs <dir>
 *
 * 1行目は一式を1巡させる（\`qemu.test.js\` が重いので1時間ほど）。フックは \`LAYOUT_TRACE\` が
 * 無ければ何もしない。2行目はコーパス1巡を自分で走らせ（数秒）、\`<dir>\` の記録と合わせて
 * このファイルを書き直す。コーパス1巡は \`.s\` が \`corpus.js\` の golden（命令数と指紋）と
 * 合うことを確かめてから記録を使う——記録の側が答えを動かしていたら、拾った問いは門が見ている
 * \`.s\` の問いではなくなるからである。
 *
 * **門（\`layout_sn.test.js\`）の記録は読まない。** 門はこの表から問いを立てるので、その記録を
 * 次の表へ入れると \`added\` の問いが「一式が立てた」に化けて、誰も立てない行が見えなくなる。
 *
 * 今回: ${TRACE_INFO.date}、layout.js ${SHA.slice(0, 12)}。コーパス ${corpus.entries} 枚で ${calls.corpus} 回、
 * 一式 ${usedFiles.length} 枚で ${calls.suite} 回の呼び出しを見た（一式の asm_gate もコーパスを回すので重なる。
 * 門の記録 ${gateFiles.length} 枚は読んでいない）。
 */
`;

const out =
	header +
	"export const REACHED = [\n" +
	"\t// ---- コーパスが立てた問い（これが移植の仕様である） ----\n" +
	groups.corpus.map(rowText).join("\n") +
	"\n\n\t// ---- コーパスは立てないが一式が立てる問い（道ごとに代表1つ） ----\n" +
	groups.suite.map(rowText).join("\n") +
	"\n\n\t// ---- 誰も立てないが、表の行を見えるようにするために足した問い ----\n" +
	groups.added.map(rowText).join("\n") +
	"\n];\n\n" +
	"/** 名前だけでは答えられない呼び出しの回数（コーパス1巡と一式の和）。理由は `TRACE_INFO.outside.why`。 */\n" +
	`export const OUTSIDE = ${JSON.stringify(OUTSIDE, null, "\t")};\n\n` +
	`export const TRACE_INFO = ${JSON.stringify(TRACE_INFO, null, "\t")};\n`;

fs.writeFileSync(outFile, out);
console.error(`${path.relative(JS, outFile)}: ${all.length} 行（${Object.entries(byFrom).map(([k, v]) => `${k} ${v}`).join(" / ")}）`);
console.error(`  ${fnList(byFn)}`);
console.error(`  OUTSIDE: ${JSON.stringify(OUTSIDE)}`);
