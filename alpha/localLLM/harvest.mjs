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
 *
 * **規則に反する直しは課題にしない**（下の `EXCLUDED`）。テストが通ることは、その直しが正しい
 * ことを言わない——混同を型や門として書き込んだコミットも、そのコミットのテストは通る。
 */
import fs from "node:fs";
import path from "node:path";
import { git, isTestPath, isSourcePath, writeTask, listTasks, parseArgs, TASKS } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const revArgs = ["rev-list", "--no-merges", "HEAD"];
if (args.since) revArgs.push(`--since=${args.since}`);
if (args.max) revArgs.push(`--max-count=${args.max}`);
revArgs.push("--", "alpha/javascript/test");

// コーパスを読む門。コーパスだけが変わったコミットでも門が空にならないように。
const CORPUS_GATES = [
	[/^alpha\/javascript\/test\/codegen_corpus\//, "codegen_sn.test.js"],
];

/**
 * **正解として配らないコミット**（2026-10-04 の規則、棚卸し inventory §3 の「置き換え・外す」）。
 *
 *   R1 裸の仮引数に器（String・List・Struct）は来ない（来たら TypeError）
 *   R2 器は括り（`[~xs]`・`[x ~xs]`・`[~this]`）で受け、括りは場所。そのまま返した場所は型が言う
 *   R3 裸のストリーム仮引数（`f : x ~xs ?`・`f : ~this ?`）は廃止
 *   R5 2次元以上は `List(List(T))`。Struct にしない
 *
 * ここに挙げたのは、値と場所の混同（裸の仮引数で器を受ける形）や廃止した形を、型・門・推測として
 * 書き込んだコミットである。そのコミットのテストは通るので、validate.mjs では見分けられない——
 * 課題にすると、混同した直しを正解として採点し、学習してしまう。消すのではなく**理由を添えて名指し**
 * する。規則が変われば、この表を直す。
 *
 * 利用者が残すと答えた裁定（括りへのスカラーの持ち上げ、`String ≅ List(Char)` の `==`、文字と1文字の
 * 文字列の比較、`[* 2,]` が文字列を写す）に依るコミット（58cdb0d1・c0f26380・26ed2bad・64c46989 ほか）は
 * 外さない。仕組みが括りの側でも要るもの（52c07004）や、向きが規則と同じもの（e9c41796）も外さない。
 * 7711afe2・4f247c5f はテストを触っていないので元から課題にならないが、理由の記録として置く。
 */
const EXCLUDED = new Map([
	["beee78a8", "R1：裸の仮引数を本体の ' と ~ から器（Container）と推論する。裸に器は来ないので、推論ではなく TypeError の証拠"],
	["439bca06", "R1：裸の仮引数に Int と List が来たら器へ持ち上げる（joinParamType）。同じ裸の位置に数と器が来ること自体が混同"],
	["2161e260", "R1：後半の liftsInto と隠しテスト（isomorphism の裸の仮引数の合流）が 439bca06 の後始末"],
	["1ef3b3ba", "R1：持ち上げ先を均質な器に限る——裸の仮引数への合流の後始末"],
	["07f7897a", "R1/R2：器の仮引数を括りへ移した 520d17e4 を戻す（向きが逆。e6acea7a ほかでやり直し済み）"],
	["c1ce229b", "R2：どの仮引数が返りうるかを不動点で推す（collectReturnedParams・markEscapes）。返る場所は型が言う"],
	["177eeef6", "R2：返る仮引数の推測の続き（判定していないことと出ていくことを分ける）"],
	["ecd5f2b5", "R2：返る仮引数の推測の続き（場所を取った仮引数と末尾呼び出し）"],
	["93e30976", "R2：そのまま返る仮引数を pass3 と pass4 の2か所で推す（returnsParamAt・handsBack）"],
	["7711afe2", "R2：返す器の中の仮引数も出ていくと推す（collectReturnedParams の拡張）"],
	["da8e5d90", "R2：置き場の食い違いの門と、宛先に届くかもしれない仮引数の推測（collectParamsMaybeAtDest）。例の多くが裸で器を受ける形"],
	["2ff1ea78", "R3：§5.4（裸の rest へ ~ の無い List を渡すと断る）と rest_param_typecheck を入れた。対象ごと廃止"],
	["b0da4da4", "R3：rest の要素型を撒いた先のスロットから決める（sum : x ~xs ?）"],
	["a6ed3ca6", "R3：ストリーム形の仮引数を型と機械の両方で通す"],
	["a49cf7b6", "R3：文字列を位置の仮引数へ文字として撒く（ストリーム形の道）"],
	["0ca9d173", "R3：隠しテストにストリーム形へ文字を撒く行がある（s~ = s の核は残る）"],
	["6b882007", "R3：§5.4 を文字列へ広げた"],
	["2888f801", "R5：揃いの鍵に内側の長さを入れる（1 2 , 3 4 5 が Struct になる）"],
	["bb1cdd07", "R5：余積の join が無ければ Struct へ落とす"],
	["b16c3ab5", "R5：揃わない行を Struct へ落とす枝（行が2次元の行になる、は残る）"],
	["4f247c5f", "R5：積の要素型が join できなければ Struct へ落とす"],
]);
const excludedBy = (commit) => [...EXCLUDED.keys()].find((k) => commit.startsWith(k)) || null;

/**
 * **RTTI の計画の刻みは「RTTI-R1〜R10」と書く。** 規則の名前（R1〜R7、2026-10-04）と同じ綴りなので、
 * 件名・本文のまま課題に載せると、どちらの R1 かを読む側が取り違える。リポジトリのファイルには刻みの
 * 名前が無く、書いているのはこの3本のコミットの文面だけである（推測で置き換えず、綴りを1つずつ挙げる）。
 */
const RTTI_STEP_SPELLING = new Map([
	["b9575b26", [["RTTI の計画 R1", "RTTI の計画 RTTI-R1"]]],
	["d160dd0c", [["RTTI の計画 R1", "RTTI の計画 RTTI-R1"], ["（R1b）", "（RTTI-R1b）"]]],
	["63d1297b", [["RTTI の R2〜R4", "RTTI の RTTI-R2〜RTTI-R4"]]],
]);
const respell = (commit, text) => {
	for (const [k, pairs] of RTTI_STEP_SPELLING) {
		if (!commit.startsWith(k)) continue;
		for (const [from, to] of pairs) text = text.split(from).join(to);
	}
	return text;
};

let made = 0, skipped = 0, ruled = 0;
for (const commit of git(revArgs).trim().split("\n").filter(Boolean)) {
	if (excludedBy(commit)) {
		// 前に切り出したものが残っていれば消す——出力に残っていたら、外したことにならない。
		fs.rmSync(path.join(TASKS, `${commit.slice(0, 10)}.json`), { force: true });
		ruled++;
		continue;
	}
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

	const subject = respell(commit, git(["log", "-1", "--format=%s", commit]).trim());
	const body = respell(commit, git(["log", "-1", "--format=%b", commit]).trim());
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
// **門：外したコミットが出力に1本も残っていないこと。** 表の鍵で直に引く——`excludedBy` を通すと、そこが
// 壊れたときに門も一緒に黙る。表を通らずに課題を書く道が後で増えても、前の出力が残っていても、ここで止まる。
const leaked = listTasks().filter((id) => [...EXCLUDED.keys()].some((k) => id.startsWith(k)));
if (leaked.length) throw new Error(`規則で外したコミットが課題に残っている: ${leaked.join(" ")}`);
console.log(`課題 ${made} 件を tasks/ に書いた（対象外 ${skipped} 件、規則で外した ${ruled} 件）`);
