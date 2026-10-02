/**
 * モデルに課題を解かせて採点する。
 *
 *   node ask.mjs [課題id ...] --url http://127.0.0.1:8080 [--model 名前] [--label 記録名]
 *                [--limit N] [--all] [--ctx 30] [--maxChars 8000] [--temp 0.2]
 *   node ask.mjs <課題id> --dry      問いだけを表示する（モデル不要）
 *   node ask.mjs <課題id> --oracle   正解を答えの形に直して流す（道具一式の自己検査）
 *
 * 相手は OpenAI 互換の口（llama.cpp の llama-server など）である。既定では validate.mjs が
 * 「判別できる」とした課題だけを解かせる（--all で全部）。
 *
 * **問いに見せるもの。** 症状（コミットの件名）と、直す場所の周りの行（変更前）だけである。
 * 小さなモデルは何千行も読めないので、場所は教える——「どこを」ではなく「どう直すか」を見る
 * 設定である（場所を探す力は、次の段で別に測る）。
 *
 * **答えの形。** unified diff は小さなモデルが崩しやすいので、探して置き換える塊で受ける：
 *
 *   FILE: alpha/javascript/pass2.js
 *   <<<<<<< SEARCH
 *   （変更前の行。ファイルの中でちょうど1か所に当たること）
 *   =======
 *   （変更後の行）
 *   >>>>>>> REPLACE
 */
import fs from "node:fs";
import path from "node:path";
import { grade } from "./grade.mjs";
import { git, readTask, listTasks, parseArgs, hunkRanges, isSourcePath, RUNS } from "./lib.mjs";

const SYSTEM = `あなたは Sign 言語の処理系の保守を手伝う。Sign の常識は他の言語と違う。推論の土台は仕様だけにすること。
- null / false / if は無い。定義されていない識別子と偽はすべて __（Unit）で、__ は関数適用の吸収元である。
- & と | は短絡評価で、条件分岐は match_case（? のブロック）か論理演算で書く。
- 器（List・String・Struct）を受ける仮引数は [~x]・[x ~xs]・[foo ~this] と書く。裸の x ~xs はストリーム。
- 鍵の ~：s ' 1~ は切り出し、s ' i~ は i の中身で1つ引く、s ' i~~ は i の位置から後ろ。
処理系は JavaScript（alpha/javascript）と Sign 自身（alpha/sign）で書かれている。
答えは次の形の塊だけを、必要な数だけ並べること（説明は書かない）：
FILE: パス
<<<<<<< SEARCH
変更前の行（見せた行からそのまま写す。ファイルの中でちょうど1か所に当たる長さにする）
=======
変更後の行
>>>>>>> REPLACE`;

/** 直す場所の周りの行を、変更前のファイルから切り出す。重なる窓はまとめる。 */
export function contextOf(task, ctx = 30, maxChars = 8000) {
	const ranges = hunkRanges(task.answer_patch).filter((r) => isSourcePath(r.file));
	const byFile = new Map();
	for (const r of ranges) {
		const w = [Math.max(1, r.start - ctx), r.start + Math.max(r.count, 1) + ctx];
		const list = byFile.get(r.file) || [];
		const last = list[list.length - 1];
		if (last && w[0] <= last[1] + 1) last[1] = Math.max(last[1], w[1]);
		else list.push(w);
		byFile.set(r.file, list);
	}
	let out = "";
	for (const [file, wins] of byFile) {
		const lines = git(["show", `${task.parent}:${file}`]).split("\n");
		for (const [a, b] of wins) {
			const piece = `--- ${file}（${a}〜${Math.min(b, lines.length)} 行目）\n${lines.slice(a - 1, b).join("\n")}\n\n`;
			if (out.length + piece.length > maxChars) return out + "（ここから先は字数の上限で省いた）\n";
			out += piece;
		}
	}
	return out;
}

export function promptOf(task, opts = {}) {
	return [
		{ role: "system", content: SYSTEM },
		{ role: "user", content: `症状：${task.subject}\n\n直す場所の周り（変更前）：\n\n${contextOf(task, opts.ctx, opts.maxChars)}\nこの症状を直す変更を、SEARCH/REPLACE の塊で答えよ。` },
	];
}

/** 答えの文から塊を読む。 */
export function parseEdits(text) {
	const edits = [];
	const re = /FILE:\s*(\S+)\s*\n<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n?>>>>>>> REPLACE/g;
	for (const m of text.matchAll(re)) edits.push({ file: m[1].trim(), search: m[2], replace: m[3] });
	return edits;
}

/** 正解の差分を答えの形に直す（道具一式の自己検査用）。 */
export function oracleText(task) {
	let out = "", file = null;
	const lines = task.answer_patch.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const f = lines[i].match(/^\+\+\+ b\/(.+)$/);
		if (f) { file = f[1]; continue; }
		if (!lines[i].startsWith("@@") || !file || !isSourcePath(file)) continue;
		const before = [], after = [];
		for (i++; i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("diff --git"); i++) {
			const l = lines[i];
			if (l.startsWith("\\")) continue;
			if (l.startsWith("-")) before.push(l.slice(1));
			else if (l.startsWith("+")) after.push(l.slice(1));
			else { before.push(l.slice(1)); after.push(l.slice(1)); }
		}
		i--;
		while (before.length && before[before.length - 1] === "" && after[after.length - 1] === "") { before.pop(); after.pop(); }
		out += `FILE: ${file}\n<<<<<<< SEARCH\n${before.join("\n")}\n=======\n${after.join("\n")}\n>>>>>>> REPLACE\n\n`;
	}
	return out;
}

async function callModel(messages, args) {
	const url = String(args.url).replace(/\/$/, "") + "/v1/chat/completions";
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ model: args.model || "local", messages, temperature: Number(args.temp ?? 0.2), max_tokens: Number(args.maxTokens || 2048) }),
	});
	if (!res.ok) throw new Error(`モデルの口が ${res.status} を返しました: ${await res.text()}`);
	const j = await res.json();
	return j.choices[0].message.content;
}

const args = parseArgs(process.argv.slice(2));
let ids = args._.length ? args._ : listTasks().filter((id) => args.all || readTask(id).validation?.discriminative);
if (args.limit) ids = ids.slice(0, Number(args.limit));
const opts = { ctx: Number(args.ctx || 30), maxChars: Number(args.maxChars || 8000) };

if (args.dry) {
	for (const m of promptOf(readTask(ids[0]), opts)) console.log(`==== ${m.role}\n${m.content}\n`);
	process.exit(0);
}
if (!args.oracle && !args.url) {
	console.error("--url（モデルの口）か --oracle か --dry を指定してください");
	process.exit(2);
}

fs.mkdirSync(RUNS, { recursive: true });
const label = args.label || (args.oracle ? "oracle" : String(args.model || "local"));
const log = path.join(RUNS, `${label}.jsonl`);
let ok = 0;
for (const id of ids) {
	const task = readTask(id);
	const t0 = Date.now();
	let text;
	try { text = args.oracle ? oracleText(task) : await callModel(promptOf(task, opts), args); }
	catch (e) { console.log(`失敗  ${id}  ${e.message}`); continue; }
	const askMs = Date.now() - t0;
	const edits = parseEdits(text);
	const r = edits.length ? grade(task, { kind: "edits", edits }) : { ok: false, applied: false, reason: "答えの形の塊がありません" };
	if (r.ok) ok++;
	fs.appendFileSync(log, JSON.stringify({ id, label, ok: r.ok, applied: r.applied, reason: r.reason || null, gates: (r.gates || []).map((g) => ({ gate: g.gate, ok: g.ok, passed: g.passed, total: g.total })), askMs, response: text }) + "\n");
	console.log(`${r.ok ? "解けた" : "外れ  "}  ${id}  問い ${(askMs / 1000).toFixed(1)}s  ${r.reason || (r.gates || []).filter((g) => !g.ok).map((g) => `${g.gate} ${g.passed}/${g.total}`).join(", ")}`);
}
console.log(`\n${ids.length} 件中 ${ok} 件が門を通った（記録：${path.relative(process.cwd(), log)}）`);
