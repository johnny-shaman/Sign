// node formal/check/sem/record.mjs [--only <file.test.js>]... [--merge-only]
// 試験一式（alpha1/javascript/test/*.test.js の全部。npm test の run.js と同じ並び・同じ --stack-size=8000・同じ cwd）と仕様の例
// （formal/check/ex.mjs で alpha1/docs/coproduct_spec.md から取り出し、std.mjs の withStd で STD を前に付けた源）から、
// resolve・interpret・preprocess・preprocessWithLines に来た源を集め、重複を除いて out/sem/sources.jsonl に書く（1行 {id, from, source}）。
// 試験は hook.mjs を NODE_OPTIONS の --import で入れて走らせる（試験が起こす子のプロセスにも入る）。試験の file は変えない。
// from は源が最初に出た所（"spec" か試験の file の名前）。id は 0 から、先に仕様の例の順（試験にも出る例も "spec"）、その後に試験の file の並び
// （各 file の中は親のプロセスで最初に来た順、子のプロセスの源はその後に字の順）。
// 数は out/sem/sources_counts.json に書き、標準出力にも出す。--merge-only は試験を走らせず、前に覚えた out/sem/rec/ を合わせ直すだけ。
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";
import { withStd } from "./std.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const JS = path.join(ROOT, "alpha1", "javascript");
const TEST = path.join(JS, "test");
const OUT = path.join(ROOT, "formal", "check", "out", "sem");
const REC = path.join(OUT, "rec");
const SPEC_MD = path.join(ROOT, "alpha1", "docs", "coproduct_spec.md");
const HOOK = pathToFileURL(path.join(HERE, "hook.mjs")).href;

const args = process.argv.slice(2);
const only = [];
let mergeOnly = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--only") only.push(args[++i]);
  else if (args[i] === "--merge-only") mergeOnly = true;
  else throw new Error(`知らない引数 ${args[i]}`);
}
const RUNS = path.join(REC, "runs.json");

fs.mkdirSync(REC, { recursive: true });
if (!mergeOnly) for (const f of fs.readdirSync(REC)) if (f.endsWith(".jsonl") || f === "runs.json") fs.unlinkSync(path.join(REC, f));

// --- 試験一式（run.js と同じ並び） ---
const files = mergeOnly ? [] : fs.readdirSync(TEST).filter((f) => f.endsWith(".test.js")).sort().filter((f) => !only.length || only.includes(f));
const runs = mergeOnly ? JSON.parse(fs.readFileSync(RUNS, "utf8")) : [];
for (const file of files) {
  const started = Date.now();
  const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --import=${HOOK}`.trim(), SEM_REC_DIR: REC, SEM_FROM: file };
  delete env.SEM_REC_PARENT;
  const r = spawnSync(process.execPath, ["--stack-size=8000", path.join(TEST, file)], { cwd: JS, env, encoding: "utf8", maxBuffer: 1 << 30 });
  const output = (r.stdout || "") + (r.stderr || "");
  const summary = [...output.matchAll(/^(\d+)\/(\d+) passed$/gm)].pop();
  const run = { file, status: r.status, error: r.error ? String(r.error.message) : null, passed: summary ? Number(summary[1]) : null, total: summary ? Number(summary[2]) : null, ms: Date.now() - started };
  runs.push(run);
  console.log(`${run.status === 0 && !run.error ? "OK  " : "FAIL"} ${file}  ${summary ? `${run.passed}/${run.total}` : "集計行なし"}  ${run.ms}ms`);
  if (run.status !== 0 || run.error) console.log(output.split(/\r?\n/).filter((l) => /^FAIL|Error|error/.test(l)).slice(0, 20).join("\n"));
}
if (!mergeOnly) fs.writeFileSync(RUNS, JSON.stringify(runs, null, 2) + "\n");

// --- 仕様の例（ex.mjs の取り出し方、STD を前に付ける） ---
const exOut = path.join(OUT, "ex.json");
const ex = spawnSync(process.execPath, [path.join(ROOT, "formal", "check", "ex.mjs"), SPEC_MD, exOut], { encoding: "utf8" });
if (ex.status !== 0) throw new Error(`ex.mjs が落ちた: ${ex.stderr}`);
const specSources = JSON.parse(fs.readFileSync(exOut, "utf8")).map(withStd);

// --- 合わせる ---
const recs = fs.readdirSync(REC).filter((f) => f.endsWith(".jsonl")).map((f) => {
  const lines = fs.readFileSync(path.join(REC, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { head: lines[0].head, items: lines.slice(1) };
});
const ids = new Map(); // source → id
const order = [];
const add = (source, from) => {
  if (ids.has(source)) return false;
  ids.set(source, order.length);
  order.push({ id: order.length, from, source });
  return true;
};
const FNS = ["resolve", "interpret", "preprocess", "preprocessWithLines"];
const zero = () => Object.fromEntries(FNS.map((f) => [f, 0]));
let specFresh = 0;
for (const s of specSources) if (add(s, "spec")) specFresh++;
const perFile = [];
for (const run of runs) {
  const mine = recs.filter((r) => r.head.from === run.file);
  const parents = mine.filter((r) => !r.head.child);
  const children = mine.filter((r) => r.head.child);
  const calls = zero(), childCalls = zero();
  let nonString = 0;
  for (const r of parents) for (const f of FNS) calls[f] += r.head.calls[f];
  for (const r of children) for (const f of FNS) childCalls[f] += r.head.calls[f];
  for (const r of mine) nonString += r.head.nonString;
  const distinct = new Set();
  let fresh = 0;
  for (const r of parents) for (const it of r.items) {
    distinct.add(it.source);
    if (add(it.source, run.file)) fresh++;
  }
  const childSources = [...new Set(children.flatMap((r) => r.items.map((it) => it.source)))].sort();
  for (const s of childSources) {
    distinct.add(s);
    if (add(s, run.file)) fresh++;
  }
  perFile.push({ file: run.file, test: { status: run.status, passed: run.passed, total: run.total }, processes: parents.length, childProcesses: children.length, calls, childCalls, nonString, distinct: distinct.size, fresh });
}
const inTests = new Set(recs.flatMap((r) => r.items.map((it) => it.source)));
const specInTests = new Set(specSources.filter((s) => inTests.has(s))).size;

const stray = recs.filter((r) => !runs.some((x) => x.file === r.head.from));
if (stray.length) throw new Error(`試験の file に当たらない記録 ${stray.map((r) => r.head.from).join(", ")}`);

fs.writeFileSync(path.join(OUT, "sources.jsonl"), order.map((o) => JSON.stringify(o)).join("\n") + "\n");
const totalCalls = zero();
for (const p of perFile) for (const f of FNS) totalCalls[f] += p.calls[f] + p.childCalls[f];
const counts = {
  sources: order.length,
  calls: totalCalls,
  callsAll: FNS.reduce((a, f) => a + totalCalls[f], 0),
  fromTests: order.length - specFresh,
  spec: { examples: specSources.length, distinct: specFresh, alsoInTests: specInTests },
  sourceChars: order.reduce((a, o) => a + o.source.length, 0),
  maxSourceChars: order.reduce((a, o) => Math.max(a, o.source.length), 0),
  files: perFile,
};
fs.writeFileSync(path.join(OUT, "sources_counts.json"), JSON.stringify(counts, null, 2) + "\n");
console.log(JSON.stringify({ ...counts, files: undefined }));
for (const p of perFile) console.log(JSON.stringify(p));
