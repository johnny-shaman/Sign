/**
 * 「このプログラムの値は何か」を当てる課題。答えは解釈器が出す。
 *
 *   node values.mjs harvest                         values.jsonl を作る
 *   node values.mjs ask --url http://127.0.0.1:8080 [--model 名前] [--label 記録名] [--limit N]
 *
 * 直しの課題（ask.mjs）より軽い。小さなモデルが Sign の意味（__ の伝わり方・~ の読み・
 * 短絡評価）をどこで取り違えるかを、まずここで測る。間違いの形が分かれば、そこを狙って
 * 解釈器で合成データを作れる。
 *
 * 出どころは codegen_corpus（短い完結したプログラム）である。値の見せ方は1つに決める：
 * __ は `__`、器は `[a b c]`、構造体は `[k : v ...]`、文字列と数はそのまま。
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO, HERE, RUNS, parseArgs } from "./lib.mjs";

const JS = path.join(REPO, "alpha", "javascript");
const CORPUS = path.join(JS, "test", "codegen_corpus");
const OUT = path.join(HERE, "values.jsonl");

/**
 * **規則が変わると答えが変わる課題**（2026-10-04 の R1・R3）。消さずに `changes` の印を付ける。
 *
 * R1 は裸の仮引数に器（String・List・Struct）が来たら TypeError にする（まだ入っていない）。下の 24 本は
 * 裸の仮引数で文字列を受けているので、R1 が入ると値ではなく断りになる（書き換えるなら `[~s]` で受ける）。
 * `uncalled` は呼ばれないので値は 3 のままだが、R1 の断りの見本へ書き換える予定の1本である。
 * R3（裸のストリーム仮引数の廃止）に当たる課題は無い——コーパスに `f : x ~xs ?` の形は 0 個。
 *
 * 一覧は棚卸し（inventory §2、裸の仮引数に器が来る所の全件）から写した。推測で足さない。
 */
const CHANGES_UNDER = new Map(
	[
		"args9", "chr_cmpalu", "dup_fn", "idx", "idx_oob", "idxtype", "key", "lift", "normsplit", "post_str",
		"slice", "slice00", "slice_k0", "slice_p0", "sparam", "sret", "sret_call", "str_edge", "str_empty",
		"streq", "sunit", "sunit_arg", "uncalled", "width_cond",
	].map((id) => [id, "R1"])
);

export function show(v, I) {
	if (I.isUnit(v)) return "__";
	const o = I.observe(v);
	const go = (x) => {
		if (x === undefined || x === null) return "__";
		if (Array.isArray(x)) return `[${x.map(go).join(" ")}]`;
		if (typeof x === "object") return `[${Object.entries(x).map(([k, y]) => `${k} : ${go(y)}`).join(" ")}]`;
		return String(x);
	};
	return go(o);
}

async function harvest() {
	// `import()` は絶対パスを URL として読む——Windows の `C:\…` は読めないので file URL で渡す。
	const { compile } = await import(pathToFileURL(path.join(JS, "compile.js")).href);
	const I = await import(pathToFileURL(path.join(JS, "interpreter.js")).href);
	const readImport = (p) => fs.readFileSync(path.join(REPO, "alpha", "sign", path.basename(p)), "utf8");
	const rows = [];
	for (const f of fs.readdirSync(CORPUS).filter((x) => x.endsWith(".sn")).sort()) {
		const src = fs.readFileSync(path.join(CORPUS, f), "utf8").replace(/\r\n/g, "\n");
		try {
			const { nodes } = compile(src, { readImport, charset: "ascii" });
			const env = I.newRuntimeEnv();
			let r = I.UNIT;
			for (const n of nodes) r = I.evaluate(n, env);
			const id = f.replace(/\.sn$/, "");
			const row = { id, program: src.trim(), value: show(r, I) };
			if (CHANGES_UNDER.has(id)) row.changes = CHANGES_UNDER.get(id);
			rows.push(row);
		} catch (e) {
			// 前段が断るプログラムは「値」の課題にならない（断りの課題は別に立てる）
		}
	}
	// **門：印の表の課題が全部ここに在り、印が付いていること。** コーパスの名前が変わったり、規則が入って前段が
	// 断るようになったりすると、表が黙って空振りする——そのときは表を直す（推測で足さない）。
	const unmarked = [...CHANGES_UNDER.keys()].filter((id) => !rows.some((r) => r.id === id && r.changes));
	if (unmarked.length) throw new Error(`changes の表に在るのに印の付いた課題が無い: ${unmarked.join(" ")}`);
	fs.writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
	const marked = rows.filter((r) => r.changes).length;
	console.log(`値の課題 ${rows.length} 件を ${path.relative(process.cwd(), OUT)} に書いた（うち ${marked} 件は規則が変わると答えが変わる：changes）`);
}

const SYSTEM = `あなたは Sign 言語のプログラムの値を当てる。Sign の常識は他の言語と違う。
- null / false / if は無い。定義されていない識別子と偽はすべて __（Unit）。比較が成り立たなければ __。
- __ は関数適用の吸収元。& と | は短絡評価。
- 最後の式の値を、次の形だけで1行に答える：__ は __、器は [a b c]、文字列と数はそのまま。`;

async function ask(args) {
	const rows = fs.readFileSync(OUT, "utf8").trim().split("\n").map((l) => JSON.parse(l));
	const pick = args.limit ? rows.slice(0, Number(args.limit)) : rows;
	fs.mkdirSync(RUNS, { recursive: true });
	const label = `values-${args.label || args.model || "local"}`;
	const log = path.join(RUNS, `${label}.jsonl`);
	let ok = 0;
	for (const r of pick) {
		const res = await fetch(String(args.url).replace(/\/$/, "") + "/v1/chat/completions", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				model: args.model || "local",
				temperature: 0,
				max_tokens: 64,
				messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `\`\`\`sign\n${r.program}\n\`\`\`\n値は？` }],
			}),
		});
		const text = (await res.json()).choices[0].message.content.trim();
		const got = text.split("\n").filter(Boolean).pop()?.replace(/^`+|`+$/g, "").trim() ?? "";
		const hit = got === r.value;
		if (hit) ok++;
		fs.appendFileSync(log, JSON.stringify({ id: r.id, want: r.value, got, hit, response: text }) + "\n");
		console.log(`${hit ? "当たり" : "外れ  "}  ${r.id.padEnd(20)} 正解 ${r.value.slice(0, 30).padEnd(30)} 答え ${got.slice(0, 30)}`);
	}
	console.log(`\n${pick.length} 件中 ${ok} 件が当たった（記録：${path.relative(process.cwd(), log)}）`);
}

const args = parseArgs(process.argv.slice(2));
if (args._[0] === "harvest") await harvest();
else if (args._[0] === "ask" && args.url) await ask(args);
else console.error("node values.mjs harvest | node values.mjs ask --url ...");
