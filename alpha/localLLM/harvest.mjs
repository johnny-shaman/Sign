/**
 * 過去のコミットから課題を切り出す。
 *
 *   node harvest.mjs [--since 2026-07-29] [--max 500]
 *
 * 対象は「処理系の中身（alpha/javascript/*.js・alpha/sign/*.sn・sign.pegjs）」と「テスト」の
 * 両方に手が入ったコミットだけである。テストの差分が隠しテストになり、それ以外の差分が答えになる。
 * 門（gate）は、そのコミットが触った *.test.js である。コーパスだけを触ったなら、コーパスを
 * 読む門を足す。
 *
 * 切り出しただけでは「良い課題」かどうか分からない——直さなくても通る課題や、答えでも
 * 落ちる課題がある。それを分けるのは validate.mjs である。
 */
import { git, isTestPath, isSourcePath, writeTask, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const revArgs = ["rev-list", "--no-merges", "HEAD"];
if (args.since) revArgs.push(`--since=${args.since}`);
if (args.max) revArgs.push(`--max-count=${args.max}`);
revArgs.push("--", "alpha/javascript/test");

// コーパスを読む門。コーパスだけが変わったコミットでも門が空にならないように。
const CORPUS_GATES = [
	[/^alpha\/javascript\/test\/codegen_corpus\//, "codegen_sn.test.js"],
];

let made = 0, skipped = 0;
for (const commit of git(revArgs).trim().split("\n").filter(Boolean)) {
	const parents = git(["rev-list", "--parents", "-n", "1", commit]).trim().split(" ").slice(1);
	if (parents.length !== 1) { skipped++; continue; }
	const parent = parents[0];
	const files = git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit]).trim().split("\n").filter(Boolean);
	const tests = files.filter(isTestPath);
	const answers = files.filter((f) => !isTestPath(f));
	if (!tests.length || !answers.some(isSourcePath)) { skipped++; continue; }

	const gate = new Set(tests.filter((f) => /\.test\.js$/.test(f)).map((f) => f.split("/").pop()));
	for (const [re, g] of CORPUS_GATES) if (tests.some((f) => re.test(f))) gate.add(g);
	// 消えたテストは門にならない（c の時点で在るものだけ）
	const present = new Set(git(["ls-tree", "--name-only", commit, "alpha/javascript/test/"]).trim().split("\n").map((f) => f.split("/").pop()));
	const gates = [...gate].filter((g) => present.has(g)).sort();
	if (!gates.length) { skipped++; continue; }

	const subject = git(["log", "-1", "--format=%s", commit]).trim();
	const body = git(["log", "-1", "--format=%b", commit]).trim();
	const date = git(["log", "-1", "--format=%ad", "--date=short", commit]).trim();
	writeTask({
		id: commit.slice(0, 10),
		commit,
		parent,
		date,
		// 問いに見せるのは件名だけ。本文は直し方まで書いてあるので、学習の「なぜ」の側に回す
		subject,
		explanation: body,
		answer_files: answers,
		test_files: tests,
		gates,
		answer_patch: git(["diff", "--binary", parent, commit, "--", ...answers]),
		test_patch: git(["diff", "--binary", parent, commit, "--", ...tests]),
	});
	made++;
}
console.log(`課題 ${made} 件を tasks/ に書いた（対象外 ${skipped} 件）`);
