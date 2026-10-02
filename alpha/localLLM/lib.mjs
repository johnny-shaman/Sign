/**
 * 練習場の共通部品。git の操作・課題の読み書き・パスの分け方だけを持つ。
 *
 * 課題は SWE-bench と同じ形である：コミット c を「親 c^ の状態」と「症状（件名）」に戻し、
 * c が足したテストを**採点のときにだけ**入れる（隠しテスト）。答えはテスト以外の差分である。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, "..", "..");
export const TASKS = path.join(HERE, "tasks");
export const RUNS = path.join(HERE, "runs");

export function git(args, opts = {}) {
	return execFileSync("git", args, { cwd: opts.cwd || REPO, encoding: "utf8", maxBuffer: 1 << 28, input: opts.input, stdio: opts.input !== undefined ? ["pipe", "pipe", "pipe"] : undefined });
}

/** 隠しテストに回すもの。コーパスや golden もテストの側である（答えを見せないため）。 */
export const isTestPath = (p) => p.startsWith("alpha/javascript/test/");

/** Sign で書いたもの。課題の答えはこれだけにする（モデルに覚えさせるのは Sign であって JS ではない）。 */
export const isSignPath = (p) => /^alpha\/sign\/[^/]+\.sn$/.test(p);

/** JS の処理系そのもの。ここに手が入ったコミットは課題にしない（JS は採点役で、教材ではない）。 */
export const isJsSourcePath = (p) => !isTestPath(p) && /^alpha\/javascript\/[^/]+\.(js|mjs|pegjs)$/.test(p);

export function readTask(id) {
	return JSON.parse(fs.readFileSync(path.join(TASKS, `${id}.json`), "utf8"));
}

export function writeTask(task) {
	fs.mkdirSync(TASKS, { recursive: true });
	fs.writeFileSync(path.join(TASKS, `${task.id}.json`), JSON.stringify(task, null, 1));
}

export function listTasks() {
	if (!fs.existsSync(TASKS)) return [];
	return fs.readdirSync(TASKS).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
}

/** `--key value` と `--flag` だけの素朴な引数読み。 */
export function parseArgs(argv) {
	const out = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith("--")) {
			const k = a.slice(2);
			if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
			else out[k] = true;
		} else out._.push(a);
	}
	return out;
}

/**
 * 差分の塊（hunk）が触る行の範囲を、変更前のファイルについて返す。
 * 問いに見せる文脈（その周りの行）を切り出すのに使う。
 */
export function hunkRanges(patch) {
	const ranges = [];
	let file = null;
	for (const line of patch.split("\n")) {
		const f = line.match(/^--- a\/(.+)$/);
		if (f) { file = f[1]; continue; }
		if (line.startsWith("--- /dev/null")) { file = null; continue; }
		const h = line.match(/^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/);
		if (h && file) ranges.push({ file, start: Number(h[1]), count: h[2] === undefined ? 1 : Number(h[2]) });
	}
	return ranges;
}
