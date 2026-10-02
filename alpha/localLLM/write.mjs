/**
 * 「Sign で書く」課題。プログラムから定義を1つ抜き、見出し（名前と仮引数）と周りを見せて書かせる。
 *
 *   node write.mjs harvest                       穴の課題を holes/ に作る（コーパスとセルフホスト）
 *   node write.mjs validate [--kind corpus|self] [--file layout.sn] [--limit N]
 *   node write.mjs ask --url http://127.0.0.1:8080 [--kind corpus|self] [--label 記録名] [--limit N] [--spec core|full]
 *   node write.mjs ask --oracle                  元の定義を流して道具一式を確かめる
 *   node write.mjs ask <穴id> --dry              問いだけを表示する
 *
 * 採点は2通りで、どちらも処理系（JS）は答え合わせにしか使わない：
 *
 *   corpus：codegen_corpus の短いプログラム。書いた定義を戻して走らせ、最後の値が元と同じか。
 *   self  ：セルフホスト（alpha/sign/*.sn）。書いた定義を戻した HEAD の写しで、その枚の門
 *           （JS と1バイト・1値ずつ突き合わせる *_sn.test.js）が全部通るか。
 *
 * **良い穴だけを使う。** 本体を `__` にした定義（`f : x ? __`）で採点が落ちる穴だけが、書いた中身を
 * 見ている。落ちない穴は、門がその定義を見ていない（validate が外す）。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { git, REPO, HERE, RUNS, parseArgs } from "./lib.mjs";
import { grade } from "./grade.mjs";
import { systemPrompt } from "./spec.mjs";

const HOLES = path.join(HERE, "holes");
const CORPUS = path.join(REPO, "alpha", "javascript", "test", "codegen_corpus");
const SIGN = path.join(REPO, "alpha", "sign");

/** セルフホストの枚と、それを JS と突き合わせる門。 */
const SELF_GATES = {
	"lower.sn": "codegen_sn.test.js",
	"codegen.sn": "codegen_sn.test.js",
	"asm_text.sn": "emit_sn.test.js",
	"emit.sn": "emit_sn.test.js",
	"operator_table.sn": "emit_sn.test.js",
	"preprocess.sn": "preprocess_sn.test.js",
	"lexer.sn": "preprocess_sn.test.js",
	"parser.sn": "preprocess_sn.test.js",
	"target_info.sn": "target_info_sn.test.js",
	"layout.sn": "layout_sn.test.js",
};

// ---------------------------------------------------------------------------
// 定義の切り出し
// ---------------------------------------------------------------------------

/** 文字列と文字の字面を空白で潰す（`?` を探すときに中身を数えないため）。長さは保つ。 */
function blank(s) {
	let out = "";
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === "\\" && i + 1 < s.length) { out += "  "; i++; continue; }
		if (c === "`") {
			const j = s.indexOf("`", i + 1);
			const k = j < 0 ? s.length - 1 : j;
			out += " ".repeat(k - i + 1);
			i = k;
			continue;
		}
		out += c;
	}
	return out;
}

const isComment = (l) => /^`.*`\s*$/.test(l);
const DEF = /^(#{0,3}[A-Za-z_][A-Za-z0-9_]*) :(?:\s|$)/;

/**
 * 関数の定義を全部拾う。定義は行頭の `名前 :` から、字下げの行（と、その間に挟まった行頭の注）が
 * 続くところまで。`?` を持たないもの（定数）は拾わない。直前の注は説明として添える。
 */
export function definitions(src) {
	const lines = src.split("\n");
	const defs = [];
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(DEF);
		if (!m) continue;
		let j = i + 1;
		while (j < lines.length) {
			if (lines[j].startsWith("\t")) { j++; continue; }
			if (isComment(lines[j])) {
				let k = j;
				while (k < lines.length && isComment(lines[k])) k++;
				if (k < lines.length && lines[k].startsWith("\t")) { j = k; continue; }
			}
			break;
		}
		const text = lines.slice(i, j).join("\n");
		const q = blank(text).search(/(^|\s)\?(\s|$)/);
		if (q < 0) { i = j - 1; continue; }
		const qAt = blank(text).indexOf("?", q);
		let d = i;
		while (d > 0 && isComment(lines[d - 1])) d--;
		defs.push({ name: m[1], start: i, end: j, text, header: text.slice(0, qAt + 1), desc: lines.slice(d, i).join("\n") });
		i = j - 1;
	}
	return defs;
}

const stubOf = (def) => `${def.header} __`;
const fillHole = (src, def, code) => {
	const lines = src.split("\n");
	return [...lines.slice(0, def.start), ...code.replace(/\s+$/, "").split("\n"), ...lines.slice(def.end)].join("\n");
};

/** 解釈器を別プロセスで走らせる（止まらないコードを時間で切る）。 */
function interpret(program, timeoutSec = 10) {
	const r = spawnSync(process.execPath, ["--stack-size=16000", path.join(HERE, "interp.mjs")], { input: program, encoding: "utf8", timeout: timeoutSec * 1000 });
	if (r.error && r.error.code === "ETIMEDOUT") return "! 時間切れ";
	return (r.stdout || "").trim() || "! " + String(r.stderr || "").trim().split("\n").pop();
}

// ---------------------------------------------------------------------------
// 課題を作る・確かめる
// ---------------------------------------------------------------------------

function holePath(id) { return path.join(HOLES, `${id}.json`); }
function readHole(id) { return JSON.parse(fs.readFileSync(holePath(id), "utf8")); }
function writeHole(h) { fs.mkdirSync(HOLES, { recursive: true }); fs.writeFileSync(holePath(h.id), JSON.stringify(h, null, 1)); }
function listHoles(kind) {
	if (!fs.existsSync(HOLES)) return [];
	return fs.readdirSync(HOLES).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort().filter((id) => !kind || id.startsWith(kind + "-"));
}

function harvest() {
	let corpus = 0, self = 0;
	for (const f of fs.readdirSync(CORPUS).filter((x) => x.endsWith(".sn") && !x.startsWith("rp_")).sort()) {
		const src = fs.readFileSync(path.join(CORPUS, f), "utf8").replace(/\r\n/g, "\n");
		const want = interpret(src);
		if (want.startsWith("!")) continue;
		for (const def of definitions(src)) {
			writeHole({ id: `corpus-${f.replace(/\.sn$/, "")}-${def.name.replace(/#/g, "")}`, kind: "corpus", file: f, src, def, want });
			corpus++;
		}
	}
	const head = git(["rev-parse", "HEAD"]).trim();
	for (const [f, gate] of Object.entries(SELF_GATES)) {
		const src = fs.readFileSync(path.join(SIGN, f), "utf8").replace(/\r\n/g, "\n");
		for (const def of definitions(src)) {
			writeHole({ id: `self-${f.replace(/\.sn$/, "")}-${def.name.replace(/#/g, "")}`, kind: "self", file: f, src, def, gate, head });
			self++;
		}
	}
	console.log(`穴の課題：コーパス ${corpus} 件・セルフホスト ${self} 件を holes/ に書いた`);
}

/** 候補の定義を採点する。 */
function gradeHole(h, code, opts = {}) {
	if (!code.trimStart().startsWith(h.def.name + " :") && !code.trimStart().startsWith(h.def.name + " :\n")) {
		return { ok: false, reason: `定義が ${h.def.name} : で始まっていません` };
	}
	if (h.kind === "corpus") {
		const got = interpret(fillHole(h.src, h.def, code));
		return { ok: got === h.want, got, want: h.want };
	}
	const task = { id: h.id, parent: h.head, test_patch: "", gates: [h.gate] };
	const r = grade(task, { kind: "edits", edits: [{ file: `alpha/sign/${h.file}`, search: h.def.text, replace: code.replace(/\s+$/, "") }] }, { timeoutSec: opts.timeoutSec || 600 });
	return { ok: r.ok, reason: r.reason || null, gates: (r.gates || []).map((g) => ({ gate: g.gate, ok: g.ok, passed: g.passed, total: g.total, fails: g.fails })) };
}

function validate(args) {
	let ids = listHoles(args.kind).filter((id) => args.redo || !readHole(id).validation);
	if (args.file) ids = ids.filter((id) => readHole(id).file === args.file);
	if (args.limit) ids = ids.slice(0, Number(args.limit));
	let good = 0;
	for (const id of ids) {
		const h = readHole(id);
		const t0 = Date.now();
		const answer = gradeHole(h, h.def.text);
		const stub = answer.ok ? gradeHole(h, stubOf(h.def)) : null;
		h.validation = { answer_ok: answer.ok, stub_ok: stub ? stub.ok : null, discriminative: !!(answer.ok && stub && !stub.ok), ms: Date.now() - t0 };
		writeHole(h);
		if (h.validation.discriminative) good++;
		console.log(`${h.validation.discriminative ? "良い" : "外す"}  ${id.padEnd(40)} ${((Date.now() - t0) / 1000).toFixed(0)}s${!answer.ok ? "  ← 元の定義でも落ちる" : stub && stub.ok ? "  ← 中身を __ にしても通る" : ""}`);
	}
	console.log(`\n${ids.length} 件を確かめ、使える穴は ${good} 件`);
}

// ---------------------------------------------------------------------------
// 問う
// ---------------------------------------------------------------------------

const TASK = `次の Sign プログラムの【ここに定義を書く】の所に入る定義を1つ書け。
見出し（名前と仮引数）は示したとおりにし、本体を書く。字下げは TAB。
答えは \`\`\`sign の塊1つに、定義だけを書く（説明は書かない）。`;

export function promptOf(h, opts = {}) {
	const lines = h.src.split("\n");
	const marker = "`【ここに定義を書く】`";
	let shown = [...lines.slice(0, h.def.start), marker, ...lines.slice(h.def.end)];
	const ctx = Number(opts.ctx || 60);
	const at = h.def.start;
	let body = shown.join("\n");
	if (body.length > Number(opts.maxChars || 6000)) {
		body = shown.slice(Math.max(0, at - ctx), at + 1 + ctx).join("\n");
	}
	const user = `${h.kind === "self" ? `セルフホストの枚 ${h.file}（Sign で書いた処理系の一部）` : "短いプログラム"}：\n\n\`\`\`sign\n${body}\n\`\`\`\n\n書く定義の見出し：\n\`\`\`sign\n${h.def.header}\n\`\`\`\n${h.def.desc ? `\n直前の注：\n${h.def.desc}\n` : ""}${h.kind === "corpus" ? `\nプログラム全体の値は ${h.want} になる。\n` : ""}`;
	return [{ role: "system", content: systemPrompt(opts.spec || "core", TASK) }, { role: "user", content: user }];
}

/** 答えから定義を取り出す。4つの空白の字下げは TAB に直す（小さなモデルは TAB を崩しがち）。 */
export function codeOf(text) {
	const m = text.match(/```(?:sign)?\n([\s\S]*?)```/);
	const code = (m ? m[1] : text).replace(/^((?: {4})+)/gm, (s) => "\t".repeat(s.length / 4));
	return code.replace(/\s+$/, "");
}

async function ask(args) {
	let ids = args._.slice(1);
	if (!ids.length) ids = listHoles(args.kind).filter((id) => readHole(id).validation?.discriminative);
	if (args.limit) ids = ids.slice(0, Number(args.limit));
	if (args.dry) {
		for (const m of promptOf(readHole(ids[0]), args)) console.log(`==== ${m.role}\n${m.content}\n`);
		return;
	}
	if (!args.oracle && !args.url) { console.error("--url（モデルの口）か --oracle か --dry を指定してください"); return; }
	fs.mkdirSync(RUNS, { recursive: true });
	const label = `write-${args.oracle ? "oracle" : args.label || args.model || "local"}`;
	const log = path.join(RUNS, `${label}.jsonl`);
	let ok = 0;
	for (const id of ids) {
		const h = readHole(id);
		const t0 = Date.now();
		let text;
		if (args.oracle) text = "```sign\n" + h.def.text + "\n```";
		else {
			const res = await fetch(String(args.url).replace(/\/$/, "") + "/v1/chat/completions", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ model: args.model || "local", messages: promptOf(h, args), temperature: Number(args.temp ?? 0.2), max_tokens: Number(args.maxTokens || 1024) }),
			});
			if (!res.ok) { console.log(`失敗  ${id}  ${res.status}`); continue; }
			text = (await res.json()).choices[0].message.content;
		}
		const askMs = Date.now() - t0;
		const r = gradeHole(h, codeOf(text));
		if (r.ok) ok++;
		fs.appendFileSync(log, JSON.stringify({ id, label, ok: r.ok, ...r, askMs, response: text }) + "\n");
		console.log(`${r.ok ? "書けた" : "外れ  "}  ${id.padEnd(40)} ${r.reason || (h.kind === "corpus" ? `値 ${r.got}（正解 ${r.want}）` : (r.gates || []).map((g) => `${g.gate} ${g.passed}/${g.total}`).join(", "))}`);
	}
	console.log(`\n${ids.length} 件中 ${ok} 件が通った（記録：${path.relative(process.cwd(), log)}）`);
}

if (process.argv[1]?.endsWith("write.mjs")) {
	const args = parseArgs(process.argv.slice(2));
	const cmd = args._[0];
	if (cmd === "harvest") harvest();
	else if (cmd === "validate") validate(args);
	else if (cmd === "ask") await ask(args);
	else console.error("node write.mjs harvest | validate | ask");
}
