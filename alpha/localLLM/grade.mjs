/**
 * 候補の直しを採点する。
 *
 *   node grade.mjs <課題id> --answer          正解の差分で（課題が解けることの確認）
 *   node grade.mjs <課題id> --empty           何も直さずに（課題が直しを要求することの確認）
 *   node grade.mjs <課題id> --diff 候補.patch  unified diff で
 *   node grade.mjs <課題id> --edits 候補.json  [{file, search, replace}] で
 *
 * 手順：親コミットを一時的な作業木（git worktree）へ取り出す → 候補を当てる → 隠しテストを当てる
 * → 門を1本ずつ走らせる → 作業木を消す。リポジトリ本体の作業木には触らない。
 *
 * **速い門で採点する。** 機械の側（clang・qemu）は飛ばし、解釈器と命令の比較だけで見る。
 * 1課題を数十秒で回すためで、qemu は最後の確認に回す（--qemu で入れられる）。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { git, REPO, readTask, isTestPath, parseArgs } from "./lib.mjs";

const NODE_MODULES = path.join(REPO, "alpha", "javascript", "node_modules");

/** 候補を作業木へ当てる。テストを書き換える候補は断る（隠しテストと衝突し、採点をすり抜けうる）。 */
function applyCandidate(wt, cand) {
	if (cand.kind === "empty") return null;
	if (cand.kind === "diff") {
		const touched = [...cand.text.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1]);
		if (touched.some(isTestPath)) return "候補がテストを書き換えています";
		try { git(["apply", "--whitespace=nowarn", "-"], { cwd: wt, input: cand.text }); }
		catch (e) { return "差分を当てられません: " + String(e.stderr || e.message).slice(0, 300); }
		return null;
	}
	if (cand.kind === "edits") {
		for (const e of cand.edits) {
			if (isTestPath(e.file)) return "候補がテストを書き換えています";
			const p = path.join(wt, e.file);
			// SEARCH が空なら新しいファイルを作る（Sign の枚を新しく足すコミットもある）
			if (!fs.existsSync(p) && e.search.trim() === "") {
				fs.mkdirSync(path.dirname(p), { recursive: true });
				fs.writeFileSync(p, e.replace.endsWith("\n") ? e.replace : e.replace + "\n");
				continue;
			}
			if (!fs.existsSync(p)) return `ファイルがありません: ${e.file}`;
			const src = fs.readFileSync(p, "utf8");
			const at = src.indexOf(e.search);
			if (at < 0) return `探す文字列が見つかりません: ${e.file}`;
			if (src.indexOf(e.search, at + 1) >= 0) return `探す文字列が2か所以上あります: ${e.file}`;
			fs.writeFileSync(p, src.slice(0, at) + e.replace + src.slice(at + e.search.length));
		}
		return null;
	}
	return "候補の形が分かりません";
}

/**
 * 古いコミットの qemu_run.js は SIGN_NO_QEMU を知らないので、作業木の写しにだけ同じ入口を足す。
 * 見つからなければ何もしない（その時代の門は機械を回すかもしれないが、値は同じである）。
 */
function disableMachine(wt) {
	const p = path.join(wt, "alpha", "javascript", "qemu_run.js");
	if (!fs.existsSync(p)) return;
	const src = fs.readFileSync(p, "utf8");
	if (src.includes("SIGN_NO_QEMU")) return;
	const out = src.replace(/function tools\(\) \{/, 'function tools() {\n\tif (process.env.SIGN_NO_QEMU === "1") return { ok: false };');
	if (out !== src) fs.writeFileSync(p, out);
}

export function grade(task, cand, opts = {}) {
	const wt = fs.mkdtempSync(path.join(os.tmpdir(), `sign-llm-${task.id}-`));
	fs.rmSync(wt, { recursive: true, force: true });
	git(["worktree", "add", "--detach", "--quiet", wt, task.parent]);
	const started = Date.now();
	try {
		const why = applyCandidate(wt, cand);
		if (why) return { id: task.id, applied: false, reason: why, ok: false, ms: Date.now() - started };
		// セルフホストの穴の課題は HEAD の門で採点するので、隠しテストを持たない
		if (task.test_patch) try { git(["apply", "--whitespace=nowarn", "-"], { cwd: wt, input: task.test_patch }); }
		catch (e) { return { id: task.id, applied: false, reason: "隠しテストを当てられません: " + String(e.stderr || e.message).slice(0, 300), ok: false, ms: Date.now() - started }; }
		if (!opts.qemu) disableMachine(wt);
		const js = path.join(wt, "alpha", "javascript");
		if (!fs.existsSync(path.join(js, "node_modules"))) fs.symlinkSync(NODE_MODULES, path.join(js, "node_modules"), "junction");
		// parser.js は生成物で git に無い。候補が文法を変えうるので、当てた後の sign.pegjs から作る
		const peg = spawnSync(process.execPath, [path.join(NODE_MODULES, "peggy", "bin", "peggy.js"), "-o", "parser.js", "--format", "es", "sign.pegjs"], { cwd: js, encoding: "utf8" });
		if (peg.status !== 0) return { id: task.id, applied: true, ok: false, reason: "文法を組めません: " + String(peg.stderr || "").slice(0, 300), ms: Date.now() - started };
		const gates = task.gates.map((g) => {
			const t0 = Date.now();
			const r = spawnSync(process.execPath, ["--stack-size=16000", path.join("test", g)], {
				cwd: js,
				encoding: "utf8",
				timeout: (opts.timeoutSec || 600) * 1000,
				env: { ...process.env, ...(opts.qemu ? {} : { SIGN_NO_QEMU: "1" }) },
				maxBuffer: 1 << 26,
			});
			const out = (r.stdout || "") + (r.stderr || "");
			const sum = [...out.matchAll(/^(\d+)\/(\d+) passed$/gm)].pop();
			const fails = out.split("\n").filter((l) => l.startsWith("FAIL")).slice(0, 5);
			// 集計行が無いのは門そのものが立たなかったとき。末尾を残して原因を見えるようにする
			if (!sum && !fails.length) fails.push(out.trim().split("\n").slice(-4).join(" / ").slice(0, 400));
			return {
				gate: g,
				ok: r.status === 0 && !r.error,
				passed: sum ? Number(sum[1]) : null,
				total: sum ? Number(sum[2]) : null,
				timedOut: !!(r.error && r.error.code === "ETIMEDOUT"),
				fails,
				ms: Date.now() - t0,
			};
		});
		return { id: task.id, applied: true, ok: gates.every((g) => g.ok), gates, ms: Date.now() - started };
	} finally {
		try { git(["worktree", "remove", "--force", wt]); } catch { fs.rmSync(wt, { recursive: true, force: true }); git(["worktree", "prune"]); }
	}
}

export function candidateFromArgs(task, args) {
	if (args.answer) return { kind: "diff", text: task.answer_patch };
	if (args.empty) return { kind: "empty" };
	if (args.diff) return { kind: "diff", text: fs.readFileSync(args.diff, "utf8") };
	if (args.edits) return { kind: "edits", edits: JSON.parse(fs.readFileSync(args.edits, "utf8")) };
	throw new Error("--answer / --empty / --diff / --edits のどれかを指定してください");
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("grade.mjs")) {
	const args = parseArgs(process.argv.slice(2));
	const task = readTask(args._[0]);
	const res = grade(task, candidateFromArgs(task, args), { qemu: !!args.qemu });
	console.log(JSON.stringify(res, null, 1));
	process.exit(res.ok ? 0 : 1);
}
