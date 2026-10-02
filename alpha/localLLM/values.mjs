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
import { REPO, HERE, RUNS, parseArgs } from "./lib.mjs";

const JS = path.join(REPO, "alpha", "javascript");
const CORPUS = path.join(JS, "test", "codegen_corpus");
const OUT = path.join(HERE, "values.jsonl");

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
	const { compile } = await import(path.join(JS, "compile.js"));
	const I = await import(path.join(JS, "interpreter.js"));
	const readImport = (p) => fs.readFileSync(path.join(REPO, "alpha", "sign", path.basename(p)), "utf8");
	const rows = [];
	for (const f of fs.readdirSync(CORPUS).filter((x) => x.endsWith(".sn")).sort()) {
		const src = fs.readFileSync(path.join(CORPUS, f), "utf8").replace(/\r\n/g, "\n");
		try {
			const { nodes } = compile(src, { readImport, charset: "ascii" });
			const env = I.newRuntimeEnv();
			let r = I.UNIT;
			for (const n of nodes) r = I.evaluate(n, env);
			rows.push({ id: f.replace(/\.sn$/, ""), program: src.trim(), value: show(r, I) });
		} catch (e) {
			// 前段が断るプログラムは「値」の課題にならない（断りの課題は別に立てる）
		}
	}
	fs.writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
	console.log(`値の課題 ${rows.length} 件を ${path.relative(process.cwd(), OUT)} に書いた`);
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
