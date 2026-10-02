/**
 * 課題が「良い課題」かを確かめ、結果を課題に書き戻す。
 *
 *   node validate.mjs [課題id ...] [--limit N] [--maxGateSec 120] [--redo] [--qemu]
 *
 * 良い課題とは、**何も直さなければ落ち、正解を当てれば通る**ものである（判別できる課題）。
 *   - 直さなくても通る：隠しテストが直しを見ていない（注だけの変更など）。採点に使えない
 *   - 正解でも落ちる：その時代の門が他の理由で赤い（環境の違い・後で直った別の不具合）
 * 門が qemu の検査だけの課題は、速い門（機械を飛ばす）では「直さなくても通る」になる。
 * そういう課題は --qemu を付けて実機込みで確かめる。
 * 時間のかかる門の課題は、まず --maxGateSec で外して数を稼ぐ（後で回せばよい）。
 */
import { grade } from "./grade.mjs";
import { listTasks, readTask, writeTask, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
let ids = args._.length ? args._ : listTasks();
ids = ids.filter((id) => !readTask(id).validation || args.redo);
if (args.limit) ids = ids.slice(0, Number(args.limit));

let good = 0, done = 0;
for (const id of ids) {
	const task = readTask(id);
	const timeoutSec = Number(args.maxGateSec || 300);
	const opt = { timeoutSec, qemu: !!args.qemu };
	const answer = grade(task, { kind: "diff", text: task.answer_patch }, opt);
	const empty = answer.ok ? grade(task, { kind: "empty" }, opt) : null;
	task.validation = {
		answer_ok: answer.ok,
		empty_ok: empty ? empty.ok : null,
		discriminative: answer.ok && empty && !empty.ok,
		answer_ms: answer.ms,
		reason: !answer.ok ? (answer.reason || (answer.gates || []).filter((g) => !g.ok).map((g) => `${g.gate}${g.timedOut ? "（時間切れ）" : ""}`).join(", ")) : empty.ok ? "直さなくても通る" : "",
	};
	writeTask(task);
	done++;
	if (task.validation.discriminative) good++;
	console.log(`${task.validation.discriminative ? "良い" : "外す"}  ${id}  ${(answer.ms / 1000).toFixed(0)}s  ${task.subject.slice(0, 50)}${task.validation.reason ? "  ← " + task.validation.reason : ""}`);
}
console.log(`\n${done} 件を確かめ、判別できる課題は ${good} 件`);
