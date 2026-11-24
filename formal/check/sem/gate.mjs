// node formal/check/sem/gate.mjs [--dump] [--exe 道] [--fail-fast] [--max-diffs N] [--only 名前,名前…] [--update-expect]（リポジトリの頭で）
// 前段の Lean の写し（formal/sem の signsem）を、out/sem の stages の集まりの全部に当てる門。終わりに表を出し、どれかが落ちれば 1 で終わる。
// 順に：
//   1. 組み立て：--exe が無ければ formal/sem で lake build --no-build を走らせ、signsem が今の Lean の源から組んだ物かを見る。
//   2. --dump：全部を書き直す。main（sources.jsonl → stages.jsonl.gz）を dump.mjs で書き、gen/all.mjs で源の集まりと前処理を通さない
//      text の集まりを作り直し、残りの源の集まりを dump.mjs で書く。dump.mjs は自分の門（本物の resolve との照らし）が崩れたら 1 で終わる。
//      record.mjs（main の源の集め直し）は走らせない。
//   3. 自己試験（毎回）：種の集まりの行から、期待を1か所だけ壊した行を作り、同じ集まりのほかの行の頭と終わりに置いて signsem check に流し、
//      壊した段にちょうど1つの違いが出て、壊した欄を使わない段は合い、1 を返すかを見る。壊さない同じ並びは 0 を返すかも見る。
//      壊す所は16種：前処理の lineAt、文法の行、文法の断りの文、木の行、木の断りの文、前処理の断りの文、b2 の断りの文の対の無いサロゲート
//      （出る側の U+FFFD）、前処理を通さない text に対の無いサロゲートがある行の文法の行（b3 が null・入る側の U+FFFD）、源に対の無い
//      サロゲートがある行の前処理の断りの文（入る側の U+FFFD）、文法が引かない lineAt、文法の後ろの行の at、文法の ? の位置、木の後ろの行の
//      奥の葉、木の行を空に、木の空の行に足す、b3 が null の行の文法の行を空に。終わりの印も、行を1つ落とす・印を消す・complete を偽に・印の後に行・
//      行が 0 の5つで、狙った知らせだけが出て 1 を返すかを見る。
//   4. 集まりごと：stages を流す途中で、でたらめに選んだ MIX 個の位置で、行の期待を1か所だけ壊して混ぜ（壊すのは、どの段の入力にも
//      ならない欄で、行ごとに種類をでたらめに選び、その中の葉をでたらめに選ぶ。種類は breakForMix の頭）、壊した段にちょうど混ぜた数の
//      違いが出て、ほかに違いが無いかを見る。混ぜた行の元（壊す前の行）は別に当てて、合うことを見る（元が合わない行に混ぜると、その違いが
//      混ぜた分に紛れるので）。位置は走らせるたびに変わるので、何行目から先は比べない（期待を返す）写しも、どの段でも捕まえる。
//      そして終わりの印について、本数と complete（signsem とは別に）、版（stamp）が今の物と同じか、源の集まり（sources）が今の file と
//      同じか、dump.mjs の門の数が 0 かを見る。
//      最後に指紋（行の数・U+FFFD に寄せた行の数・段ごとの走らせた数・通った数・断りの数・外した id・写しの答えのハッシュ、と dump.mjs が
//      許したスタックの溢れの id。混ぜた行は壊す前の期待で数え直す）が gate_expect.json と同じかを見る。数は期待の形だけで決まるので、
//      写しの答えが変わったことはハッシュ（digest）で見る。混ぜた行は写しの答えを変えないので、ハッシュは混ぜても同じ。
//      alpha1 が変わって数が変わったら、--dump --update-expect で書き直し、出た指紋の差を見てから commit する。
//   --exe：当てる signsem（変異の試験では壊した写し。組み立ての確かめは飛ばす）。--fail-fast：落ちた所で止める。--max-diffs N：集まりの
//   signsem check に、混ぜた行の分を足して渡す（自己試験には渡さない）。--only：当てる集まりを絞る（--dump はいつも全部を書き直す）。
//   --update-expect：通った集まりの指紋を書く。組み立て・書き直し・自己試験のどれかが落ちた時は何も書かない。--max-diffs とは一緒に使えない。
// 並びは軽い集まりが先で、main が最後。
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import { Transform } from "stream";
import { spawn, spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { frontStamp, sha1Head, STACK_ARG } from "./gen_front.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const OUT = path.resolve(HERE, "..", "out", "sem");
const SEM = path.join(ROOT, "formal", "sem");

// [名前, 源の集まり（dump.mjs の --sources）か null, stages の file]。源が null の物は gen/all.mjs が stages を直に書く（b3 は null）。
const SETS = [
  ["lexrev_hand", "lexrev_hand.jsonl", "lexrev_hand_stages.jsonl.gz"],
  ["peg", "peg_sources.jsonl", "peg_stages.jsonl.gz"],
  ["pegrev", "pegrev_sources.jsonl", "pegrev_stages.jsonl.gz"],
  ["pegrev_astral", "pegrev_astral_sources.jsonl", "pegrev_astral_stages.jsonl.gz"],
  ["tree", "tree_sources.jsonl", "tree_stages.jsonl.gz"],
  ["treerev", "treerev_sources.jsonl", "treerev_stages.jsonl.gz"],
  ["treerev_big", "treerev_big_sources.jsonl", "treerev_big_stages.jsonl.gz"],
  ["lex", "lex_sources.jsonl", "lex_stages.jsonl.gz"],
  ["lexrev_frames", "lexrev_frames.jsonl", "lexrev_frames_stages.jsonl.gz"],
  ["pegrev_rand", "pegrev_rand_sources.jsonl", "pegrev_rand_stages.jsonl.gz"],
  ["pegrev_randastral", "pegrev_randastral_sources.jsonl", "pegrev_randastral_stages.jsonl.gz"],
  ["treerev_fuzz", "treerev_fuzz_sources.jsonl", "treerev_fuzz_stages.jsonl.gz"],
  ["treerev_fuzz2", "treerev_fuzz2_sources.jsonl", "treerev_fuzz2_stages.jsonl.gz"],
  ["lexrev_chars", "lexrev_chars.jsonl", "lexrev_chars_stages.jsonl.gz"],
  ["lexrev_lines", "lexrev_lines.jsonl", "lexrev_lines_stages.jsonl.gz"],
  ["lexrev_astral", "lexrev_astral.jsonl", "lexrev_astral_stages.jsonl.gz"],
  ["peg_fuzz", null, "peg_fuzz_stages.jsonl"],
  ["peg_rawfuzz", null, "peg_rawfuzz_stages.jsonl"],
  ["peg_rawfuzz2", null, "peg_rawfuzz2_stages.jsonl"],
  ["main", "sources.jsonl", "stages.jsonl.gz"],
];
// 集まりごとに選ぶ混ぜる位置の数（行がそれより少なければ全部）。位置が壊せない行に当たれば次の壊せる行に回し、終わりの印の後には
// 行が無いので、混ぜる行は MIX 本まで（終わりの近くの位置の分だけ少なくなる）。
const MIX = 8;

const args = process.argv.slice(2);
const opt = { update: false, dump: false, exe: null, failFast: false, maxDiffs: 0, only: null };
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--dump") opt.dump = true;
  else if (args[i] === "--exe") opt.exe = path.resolve(args[++i]);
  else if (args[i] === "--fail-fast") opt.failFast = true;
  else if (args[i] === "--max-diffs") opt.maxDiffs = Number(args[++i]);
  else if (args[i] === "--only") opt.only = new Set(args[++i].split(","));
  else if (args[i] === "--update-expect") opt.update = true;
  else throw new Error(`知らない引数 ${args[i]}`);
}
if (opt.update && opt.maxDiffs) throw new Error("--update-expect と --max-diffs は一緒に使えない（途中で止めた数を期待にしてしまう）");
if (opt.only) for (const n of opt.only) if (!SETS.some(([name]) => name === n)) throw new Error(`知らない集まり ${n}`);
const sets = SETS.filter(([name]) => !opt.only || opt.only.has(name));
const exe = opt.exe || path.join(SEM, ".lake", "build", "bin", process.platform === "win32" ? "signsem.exe" : "signsem");

const rows = [];
let failed = 0;
const t0 = Date.now();
const fail = (name, ...lines) => {
  rows.push([name, ...lines]);
  failed++;
};
function report() {
  for (const [name, ...lines] of rows) {
    if (name) console.log(`== ${name}`);
    for (const l of lines) console.log(`  ${l}`);
  }
  console.log(`集まり ${sets.length}・落ちた ${failed}・${Math.round((Date.now() - t0) / 1000)} 秒`);
}
function stop() {
  report();
  process.exit(1);
}

const STAGES = ["pre", "peg", "tree", "front"];
const NAMES = { pre: "前処理", peg: "文法", tree: "木", front: "通し" };
// 期待が JS のスタックの溢れか（Main.lean の jsStackOverflow と同じ）
const stackish = (e) => !!e && ((e.name === "RangeError" && e.message === "Maximum call stack size exceeded") || e.reason === "resolve-stack-limit");

// 1行ごとに分け、targets（0 からの行の番号、昇順で重ならない）の位置か、その後の最初の壊せる行の期待を breakLine で壊して流す。
// 1つの位置で壊すのは1行で、まだ使っていない位置が今の行より前にあれば、次の壊せる行に回す。ほかの行は字のまま。
class Mixer extends Transform {
  constructor(targets, breakLine) {
    super();
    this.targets = targets;
    this.ti = 0;
    this.lineIdx = 0;
    this.parts = [];
    this.breakLine = breakLine;
    this.mixed = [];
  }
  _transform(chunk, enc, cb) {
    try {
      let start = 0;
      for (;;) {
        const nl = chunk.indexOf(10, start);
        if (nl < 0) {
          if (start < chunk.length) this.parts.push(chunk.subarray(start));
          break;
        }
        let out = null;
        if (this.ti < this.targets.length && this.lineIdx >= this.targets[this.ti]) {
          const line = Buffer.concat([...this.parts, chunk.subarray(start, nl)]).toString("utf8");
          const m = this.breakLine(line);
          if (m) {
            this.mixed.push(m);
            out = Buffer.from(m.line + "\n", "utf8");
            this.ti++;
          }
        }
        if (out) this.push(out);
        else {
          for (const p of this.parts) this.push(p);
          this.push(chunk.subarray(start, nl + 1));
        }
        this.parts = [];
        this.lineIdx++;
        start = nl + 1;
      }
      cb();
    } catch (e) {
      cb(e);
    }
  }
  _flush(cb) {
    for (const p of this.parts) this.push(p);
    cb();
  }
}

const isObj = (x) => x !== null && typeof x === "object";
const pickOf = (xs) => xs[crypto.randomInt(xs.length)];
// 壊せる葉（数・文字列・真偽・null）の {o, k}（o[k] が葉）。入れ子が深くてもスタックを使わない。数は足しても丸まらない物だけ。
function leavesOf(root) {
  const out = [];
  const st = [root];
  while (st.length) {
    const o = st.pop();
    for (const k of Array.isArray(o) ? o.keys() : Object.keys(o)) {
      const v = o[k];
      if (isObj(v)) st.push(v);
      else if (typeof v !== "number" || Math.abs(v) < 2 ** 52) out.push({ o, k });
    }
  }
  return out;
}
// 葉を1つ壊す：数は d を足し、文字列は c を足し、真偽は返し、null は d にする
function bump({ o, k }, d, c) {
  const v = o[k];
  o[k] = typeof v === "number" ? v + d : typeof v === "string" ? v + c : typeof v === "boolean" ? !v : d;
}
// b2 の語の行（囲みの中の行も）の at と q の葉、と at の値の集まり。木の段は行の at と q を使わない（Tree.lean の parseRow は
// `.mk _ line _ words`）ので、b2 が通る行でも、ここを壊すと違いが出るのは文法だけ。
function wrowSlots(rows0) {
  const slots = [];
  const ats = new Set();
  const st = [rows0];
  while (st.length) {
    const rows = st.pop();
    for (const r of rows) {
      if (!isObj(r)) continue;
      if (typeof r.at === "number") slots.push({ o: r, k: "at" }), ats.add(r.at);
      if (Array.isArray(r.q)) r.q.forEach((_, i) => slots.push({ o: r.q, k: i }));
      if (Array.isArray(r.w)) for (const w of r.w) if (isObj(w) && Array.isArray(w.rows)) st.push(w.rows);
    }
  }
  return { slots, ats };
}

// 混ぜる行の壊し方。どの段の入力にもならない欄だけを壊すので、写しの答え（と digest）は変わらない。行ごとに、違いが出る段の組を
// でたらめに1つ選び、その組の種類をでたらめに1つ選び、その中の葉をでたらめに1つ壊す。種類（[違いが出るはずの段, 名前, 壊す関数]）：
//   b3 が null の行（前処理を通さない text）：b2 の葉、b2 の行を空に、b2 の行に足す（文法だけ）。
//   b1 が断る行（文法と木は走らず、通しは b1 の断りと比べる）：b1 の断りの葉（前処理と通し）。
//   b1 が通る行：b3 の葉、b3 の行を空に、b3 の行に足す（b2 が通れば木と通し、断れば通しだけ）と、文法が引かない位置の lineAt
//     （前処理だけ。文法が lineAt を引くのは、返す行の書き始めの位置と、断りの位置だけ。b2 が通れば行の at でない位置、断れば lineAt の
//     値が断りの line と違う位置）。b2 が通れば b2 の行の at・q の葉、断れば b2 の断りの葉（文法だけ。木は走らない）。
// 返す物：{id, line, orig（壊す前の行）, must, kind, isErr（段ごとに、壊した期待が断りか）} か null（壊せない行）。
function breakForMix(line) {
  let j;
  try {
    j = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isObj(j) || j.end) return null;
  const errs = () => [j.b1, j.b2, j.b3].map((b) => isObj(b) && b.err);
  if (errs().some(stackish)) return null;
  const d = 1 + crypto.randomInt(9);
  const c = "×※¤§"[crypto.randomInt(4)];
  const hasText = isObj(j.b1) && typeof j.b1.text === "string" && Array.isArray(j.b1.lineAt);
  const b2rows = isObj(j.b2) && Array.isArray(j.b2.rows);
  const kinds = [];
  const leafKind = (must, name, root) => {
    const ls = leavesOf(root);
    if (ls.length) kinds.push([must, name, () => bump(pickOf(ls), d, c)]);
  };
  const rowsKinds = (must, b, what) => {
    if (!Array.isArray(b.rows)) return;
    if (b.rows.length) kinds.push([must, `${what}の行を空に`, () => (b.rows = [])]);
    kinds.push([must, `${what}の行に足す`, () => b.rows.push(null)]);
  };
  if (j.b3 === null) {
    if (hasText && isObj(j.b2)) {
      leafKind(["peg"], "b2 の葉（b3 が null）", j.b2);
      rowsKinds(["peg"], j.b2, "b2（b3 が null）");
    }
  } else if (isObj(j.b1) && isObj(j.b1.err)) {
    leafKind(["pre", "front"], "b1 の断りの葉", j.b1.err);
  } else if (hasText && isObj(j.b3) && isObj(j.b2)) {
    const la = j.b1.lineAt;
    // 文法が引かない lineAt の位置か
    let free = null;
    if (b2rows) {
      const { slots, ats } = wrowSlots(j.b2.rows);
      if (slots.length) kinds.push([["peg"], "b2 の行の at・q", () => bump(pickOf(slots), d, c)]);
      free = (k) => !ats.has(k);
    } else if (isObj(j.b2.err)) {
      leafKind(["peg"], "b2 の断りの葉", j.b2);
      const el = j.b2.err.line;
      if (typeof el === "number") free = (k) => la[k] !== el;
    }
    if (free && la.every((x) => typeof x === "number")) {
      let n = 0;
      for (let k = 0; k < la.length; k++) if (free(k)) n++;
      if (n > 0)
        kinds.push([["pre"], "文法が引かない lineAt", () => {
          // 引かない位置のうち r 番目
          let r = crypto.randomInt(n);
          for (let k = 0; k < la.length; k++)
            if (free(k) && r-- === 0) {
              la[k] += d;
              break;
            }
        }]);
    }
    const m3 = b2rows ? ["tree", "front"] : ["front"];
    leafKind(m3, "b3 の葉", j.b3);
    rowsKinds(m3, j.b3, "b3 ");
  }
  if (!kinds.length) return null;
  // 段の組を選んでから、その組の種類を選ぶ
  const groups = [...new Set(kinds.map(([m]) => m.join("+")))];
  const g = pickOf(groups);
  const [must, kind, doIt] = pickOf(kinds.filter(([m]) => m.join("+") === g));
  doIt();
  // 壊した断りが JS のスタックの溢れに見えれば（外す物が変わるので）壊さない
  if (errs().some(stackish)) return null;
  const expectOf = { pre: j.b1, peg: j.b2, tree: j.b3, front: isObj(j.b1) && j.b1.err ? { err: j.b1.err } : j.b3 };
  const isErr = Object.fromEntries(must.map((s) => [s, isObj(expectOf[s]) && "err" in expectOf[s]]));
  // 入れ子が深い行（treerev_big）は、JSON.stringify が gate.mjs のスタック（--stack-size を付けない）で溢れることがある。その行は壊さない。
  let out;
  try {
    out = JSON.stringify(j);
  } catch {
    return null;
  }
  return { id: j.id, line: out, orig: line, must, kind, isErr };
}

// file の行の数（改行の数）
function countLines(file) {
  return new Promise((resolve, reject) => {
    const src = fs.createReadStream(file);
    const s = file.endsWith(".gz") ? src.pipe(zlib.createGunzip()) : src;
    let n = 0;
    s.on("data", (d) => {
      for (let k = d.indexOf(10); k >= 0; k = d.indexOf(10, k + 1)) n++;
    });
    s.on("end", () => resolve(n));
    src.on("error", reject);
    s.on("error", reject);
  });
}

// signsem check に、file か Buffer を流す。流した物の最後の行（終わりの印）と、file の時は混ぜた行の一覧も返す。
// signsem が先に終わった時（--max-diffs）も、残りを読み切って終わりの印を取る。file が読めない時は readErr に入れて、stdin を閉じる。
function runCheck(input, extra = [], mixer = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, ["check", "--show", "40", ...extra], { stdio: ["pipe", "pipe", "ignore"] });
    child.stdout.setEncoding("utf8");
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("error", reject);
    let tail = Buffer.alloc(0);
    let readErr = null;
    let last$ = null; // 流す物の最後の段（file の時）
    const keep = (d) => {
      tail = Buffer.concat([tail, d]);
      if (tail.length > 65536) tail = tail.subarray(tail.length - 65536);
    };
    let finishLater = null; // signsem が閉じた後、流す物を読み切るのを待っている間の finish
    child.on("close", (code) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        const ls = tail.toString("utf8").split("\n").filter(Boolean);
        let last = null;
        try {
          last = ls.length ? JSON.parse(ls[ls.length - 1]) : null;
        } catch {}
        const resLine = out.split("\n").find((l) => l.startsWith("結果 "));
        resolve({ code, out, last, res: resLine ? JSON.parse(resLine.slice("結果 ".length)) : null, readErr, mixed: mixer ? mixer.mixed : [] });
      };
      if (last$ && !last$.readableEnded && !readErr) {
        // 残りを読み切る。stdin への pipe を外してから流す（後で stdin の close が pipe を外す時に、流れを止めないように）。
        // 読み切る前に読めなくなれば onErr が finish を呼ぶ（pipe は error を後ろへ運ばない）。
        finishLater = finish;
        last$.on("end", finish);
        last$.on("error", finish);
        last$.unpipe();
        last$.resume();
      } else finish();
    });
    child.stdin.on("error", () => {}); // signsem が先に閉じた時
    if (Buffer.isBuffer(input)) {
      keep(input);
      child.stdin.end(input);
    } else {
      const src = fs.createReadStream(input);
      const streams = [src];
      let s = src;
      if (input.endsWith(".gz")) streams.push((s = s.pipe(zlib.createGunzip())));
      if (mixer) streams.push((s = s.pipe(mixer)));
      last$ = s;
      const onErr = (e) => {
        if (!readErr) readErr = e;
        for (const x of streams) x.unpipe?.();
        child.stdin.end();
        finishLater?.();
      };
      for (const x of streams) x.on("error", onErr);
      s.on("data", keep);
      s.pipe(child.stdin);
    }
  });
}

// 1. 組み立て
if (!opt.exe) {
  // lake は elan の置き場（~/.elan/bin）にあればそれを、無ければ PATH の物を使う
  const elan = path.join(os.homedir(), ".elan", "bin", process.platform === "win32" ? "lake.exe" : "lake");
  const r = spawnSync(fs.existsSync(elan) ? elan : "lake", ["build", "--no-build"], { cwd: SEM, encoding: "utf8" });
  if (r.status !== 0) {
    fail("組み立て", "formal/sem の組み立てが今の Lean の源より古いか、lake が無い（formal/sem で lake build）", ...(r.stdout || r.stderr || "").split("\n").slice(-3));
    stop();
  }
}
if (!fs.existsSync(exe)) {
  fail("組み立て", `signsem が無い：${exe}`);
  stop();
}

// 2. 書き直し
// 照らす版：stack は、gate.mjs 自身の引数でなく、子（dump.mjs・gen/all.mjs の fuzz・rawfuzz）に付ける STACK_ARG
const STAMP = { ...frontStamp(), stack: STACK_ARG };
if (opt.dump) {
  const node = (file, a) => spawnSync(process.execPath, [STACK_ARG, file, ...a], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  const dump = ([name, sources, stages]) => {
    const t = Date.now();
    const r = node(path.join(HERE, "dump.mjs"), ["--sources", sources, "--out", stages]);
    if (r.status !== 0) fail(name, `dump.mjs が ${r.status} で止まった`);
    else rows.push([name, `書き直した・${Math.round((Date.now() - t) / 1000)} 秒`]);
    return r.status === 0;
  };
  const main = SETS.find(([n]) => n === "main");
  if (!dump(main) && opt.failFast) stop();
  const g = node(path.join(HERE, "gen", "all.mjs"), []);
  if (g.status !== 0) {
    fail("gen/all.mjs", `${g.status} で止まった`);
    if (opt.failFast) stop();
  }
  for (const s of SETS) if (s[1] && s[0] !== "main" && !dump(s) && opt.failFast) stop();
}

// 3. 自己試験
const readLines = (stages) => {
  const buf = fs.readFileSync(path.join(OUT, stages));
  return (stages.endsWith(".gz") ? zlib.gunzipSync(buf) : buf).toString("utf8").split("\n").filter(Boolean);
};
// 大きい file は頭の n バイトの、終わりまで揃った行だけ
const headLines = (stages, n) => {
  const fd = fs.openSync(path.join(OUT, stages), "r");
  const b = Buffer.alloc(n);
  const k = fs.readSync(fd, b, 0, n, 0);
  fs.closeSync(fd);
  return b.subarray(0, k).toString("utf8").split("\n").slice(0, -1);
};
const endOf = (n) => JSON.stringify({ end: true, lines: n, complete: true });
const asInput = (ls) => Buffer.from(ls.join("\n") + "\n", "utf8");
// 対の無いサロゲートの escape（`\\` の並びの後ろの物も。Main.lean の hasLoneSurrogateEscape と同じ見方）。1 つ目の組は前の `\\` の並び。
const LONE = /(?<!\\)((?:\\\\)*)\\u[dD][89a-fA-F][0-9a-fA-F]{2}/;
const b1At = (raw) => raw.indexOf(',"b1":');
const b2At = (raw) => raw.indexOf(',"b2":');
const b3At = (raw) => raw.indexOf(',"b3":');
const NCTX = 100; // 壊した行の前後に置く、同じ集まりのほかの行の数
// 文法が引かない lineAt の位置（b2 の行の書き始めでない位置の、いちばん後ろ）か -1
const freeLineAt = (j) => {
  const { ats } = wrowSlots(j.b2.rows);
  for (let k = j.b1.lineAt.length - 1; k >= 0; k--) if (!ats.has(k)) return k;
  return -1;
};
let nCanaries = 0;
async function selfTest() {
  const errs = [];
  const seeds = {};
  try {
    const noEnd = (ls) => ls.filter((l) => !JSON.parse(l).end);
    seeds.peg = noEnd(readLines("peg_stages.jsonl.gz"));
    seeds.hand = noEnd(readLines("lexrev_hand_stages.jsonl.gz"));
    seeds.raw = noEnd(headLines("peg_rawfuzz_stages.jsonl", 1 << 20));
    seeds.astral = noEnd(readLines("pegrev_randastral_stages.jsonl.gz"));
  } catch (e) {
    return [`自己試験の種が読めない（peg・lexrev_hand・peg_rawfuzz・pegrev_randastral の stages）：${e.message}`];
  }
  const pick = (set, ok, what) => {
    const l = seeds[set].find((x) => ok(JSON.parse(x), x));
    if (!l) errs.push(`自己試験の種（${set}）に ${what} の行が無い`);
    return l;
  };
  // 出る側：id・源・b1 に対の無いサロゲートの escape が無く、b2 の断りの文にある行（b3 の同じ escape は残す）
  const loneInB2 = (j, raw) => {
    const i = b2At(raw), k = b3At(raw);
    if (!j.b2.err || i < 0 || k < 0 || LONE.test(raw.slice(0, i))) return false;
    const m = raw.slice(i).match(LONE);
    return !!m && i + m.index < k;
  };
  // 入る側：b1（前処理を通さない text）か源に、対の無いサロゲートの escape がある行
  const loneInText = (raw) => b1At(raw) >= 0 && LONE.test(raw.slice(b1At(raw), b2At(raw)));
  const loneInSource = (raw) => b1At(raw) >= 0 && LONE.test(raw.slice(0, b1At(raw)));
  // [名前, 種の集まり, 種の行, 壊し方, 違いが出るはずの段（ちょうど1つずつ）, 合うはずの段]。壊し方は JSON を直すか（json）、生の字を直すか（raw）。
  // 壊した欄を入力に使う後ろの段（b1 → 文法、b2 → 木）は、壊した所が答えに届くかが行で変わるので、どちらとも決めない。
  const canaries = [
    ["前処理", "peg", pick("peg", (j) => j.b1.lineAt && j.b1.lineAt.length > 0, "b1 が通る"), { json: (j) => ((j.b1.lineAt[0] += 1000), j) }, ["pre"], ["tree", "front"]],
    ["文法", "peg", pick("peg", (j) => j.b2.rows && j.b2.rows.length > 0, "b2 が通る"), { json: (j) => ((j.b2.rows[0].line += 1000), j) }, ["peg"], ["pre", "front"]],
    ["文法の断り", "peg", pick("peg", (j) => j.b2.err && typeof j.b2.err.message === "string" && !stackish(j.b2.err) && /^Expected /.test(j.b2.err.message), "b2 が peggy の Expected で断る"),
      { json: (j) => ((j.b2.err.message += "×"), j) }, ["peg"], ["pre", "tree", "front"]],
    ["木", "peg", pick("peg", (j) => j.b3.rows && j.b3.rows.length > 0 && typeof j.b3.rows[0].line === "number", "b3 が通る"), { json: (j) => ((j.b3.rows[0].line += 1000), j) }, ["tree", "front"], ["pre", "peg"]],
    ["木の断り", "peg", pick("peg", (j) => j.b1.lineAt && Array.isArray(j.b2.rows) && j.b3.err && typeof j.b3.err.message === "string" && !stackish(j.b3.err), "b2 が通り b3 が断る"),
      { json: (j) => ((j.b3.err.message += "×"), j) }, ["tree", "front"], ["pre", "peg"]],
    ["通し（b1 の断り）", "hand", pick("hand", (j) => j.b1.err && typeof j.b1.err.message === "string", "b1 が断る"), { json: (j) => ((j.b1.err.message += "×"), j) }, ["pre", "front"], ["peg", "tree"]],
    ["出る側の U+FFFD（b2 の断りの文）", "hand", pick("hand", loneInB2, "源・b1 に無く b2 の断りの文に対の無いサロゲート"),
      { raw: (raw) => raw.slice(0, b2At(raw)) + raw.slice(b2At(raw)).replace(LONE, "$1X") }, ["peg"], ["pre", "tree", "front"]],
    ["入る側の U+FFFD（前処理を通さない text・b3 が null）", "raw", pick("raw", (j, raw) => j.b3 === null && j.b2.rows && j.b2.rows.length > 0 && loneInText(raw), "b3 が null で text に対の無いサロゲートがあり b2 が通る"),
      { json: (j) => ((j.b2.rows[0].line += 1000), j) }, ["peg"], ["pre", "tree", "front"]],
    ["入る側の U+FFFD（源）", "astral", pick("astral", (j, raw) => j.b1.err && typeof j.b1.err.message === "string" && loneInSource(raw), "源に対の無いサロゲートがあり b1 が断る"),
      { json: (j) => ((j.b1.err.message += "×"), j) }, ["pre", "front"], ["peg", "tree"]],
    // 混ぜる行の壊し方のうち、上に無い物（行の頭の line でない所と、行を空にする所）。入力にならないと決めた欄（文法が引かない lineAt、
    // b2 の行の at・q）を壊して後ろの段が合うことも、ここで見る。
    ["前処理（文法が引かない lineAt）", "peg", pick("peg", (j) => Array.isArray(j.b2.rows) && j.b2.rows.length > 0 && Array.isArray(j.b1.lineAt) && freeLineAt(j) >= 0, "b2 が通り、文法が引かない lineAt がある"),
      { json: (j) => ((j.b1.lineAt[freeLineAt(j)] += 1000), j) }, ["pre"], ["peg", "tree", "front"]],
    ["文法（後ろの行の at）", "peg", pick("peg", (j) => Array.isArray(j.b2.rows) && j.b2.rows.length >= 2 && isObj(j.b3), "b2 が2行以上で通る"),
      { json: (j) => ((j.b2.rows[j.b2.rows.length - 1].at += 1000), j) }, ["peg"], ["pre", "tree", "front"]],
    ["文法（? の位置）", "peg", pick("peg", (j) => Array.isArray(j.b2.rows) && j.b2.rows.some((r) => Array.isArray(r.q) && r.q.length) && isObj(j.b3), "b2 の行に ? の語がある"),
      { json: (j) => {
        const r = j.b2.rows.findLast((r) => Array.isArray(r.q) && r.q.length);
        r.q[r.q.length - 1] += 1000;
        return j;
      } }, ["peg"], ["pre", "tree", "front"]],
    ["木（後ろの行の奥）", "peg", pick("peg", (j) => Array.isArray(j.b2.rows) && isObj(j.b3) && Array.isArray(j.b3.rows) && j.b3.rows.length >= 2, "b3 が2行以上で通る"),
      { json: (j) => {
        const ls = leavesOf(j.b3.rows[j.b3.rows.length - 1]);
        bump(ls[ls.length - 1], 1000, "×");
        return j;
      } }, ["tree", "front"], ["pre", "peg"]],
    ["木（空の行）", "peg", pick("peg", (j) => Array.isArray(j.b2.rows) && isObj(j.b3) && Array.isArray(j.b3.rows) && j.b3.rows.length > 0, "b2 が通り b3 に行がある"),
      { json: (j) => ((j.b3.rows = []), j) }, ["tree", "front"], ["pre", "peg"]],
    ["木（空の行に足す）", "hand", pick("hand", (j) => Array.isArray(j.b2.rows) && isObj(j.b3) && Array.isArray(j.b3.rows) && j.b3.rows.length === 0, "b2 が通り b3 の行が空"),
      { json: (j) => (j.b3.rows.push(null), j) }, ["tree", "front"], ["pre", "peg"]],
    ["文法（空の行・b3 が null）", "raw", pick("raw", (j) => j.b3 === null && Array.isArray(j.b2.rows) && j.b2.rows.length > 0, "b3 が null で b2 に行がある"),
      { json: (j) => ((j.b2.rows = []), j) }, ["peg"], ["pre", "tree", "front"]],
  ];
  nCanaries = canaries.length;
  const differsOf = (r) => (r.res ? Object.fromEntries(STAGES.map((s) => [s, r.res[s].differ])) : null);
  for (const [what, set, line, breakIt, must, clean] of canaries) {
    if (!line) continue;
    const ctx = seeds[set].filter((l) => l !== line).slice(0, NCTX);
    const bad = breakIt.json ? JSON.stringify(breakIt.json(JSON.parse(line))) : breakIt.raw(line);
    if (bad === line) {
      errs.push(`${what}：壊し方が行を変えなかった`);
      continue;
    }
    const good = await runCheck(asInput([...ctx, line, endOf(ctx.length + 1)]));
    if (good.code !== 0) errs.push(`${what}：壊さない並び（${ctx.length + 1} 行）で signsem check が ${good.code} を返した（0 のはず）`);
    for (const [where, ls] of [["頭", [bad, ...ctx]], ["終わり", [...ctx, bad]]]) {
      const r = await runCheck(asInput([...ls, endOf(ls.length)]));
      const d = differsOf(r);
      if (r.code !== 1 || !d) errs.push(`${what}（${where}）：壊した期待で signsem check が ${r.code} を返した（1 のはず）`);
      else if (!must.every((s) => d[s] === 1) || !clean.every((s) => d[s] === 0))
        errs.push(`${what}（${where}）：段ごとの違いが ${JSON.stringify(d)}（${JSON.stringify(must)} はちょうど 1、${JSON.stringify(clean)} は 0 のはず）`);
    }
  }
  // 終わりの印を崩す。[名前, 入力の行, 出るはずの知らせ]
  const d = seeds.hand;
  const n = d.length;
  const marks = [
    ["印のとおり", [...d, endOf(n)], null],
    ["行を1つ落とす", [...d.slice(0, n >> 1), ...d.slice((n >> 1) + 1), endOf(n)], "[本数が違う]"],
    ["印を消す", [...d], "[終わりの印が無い]"],
    ["complete を偽に", [...d, JSON.stringify({ end: true, lines: n, complete: false })], "[部分の書き出し]"],
    ["印の後に行", [...d.slice(0, n - 1), endOf(n), d[n - 1]], "[印の後に行がある]"],
    ["行が 0", [endOf(0)], "[行が 0]"],
  ];
  for (const [what, ls, note] of marks) {
    const r = await runCheck(asInput(ls));
    const notes = r.out.split("\n").filter((l) => l.startsWith("["));
    if (note === null) {
      if (r.code !== 0) errs.push(`終わりの印（${what}）：signsem check が ${r.code} を返した（0 のはず）`);
    } else if (r.code !== 1 || !notes.some((l) => l.startsWith(note)) || notes.length !== 1) errs.push(`終わりの印（${what}）：exit ${r.code}・知らせ ${JSON.stringify(notes)}（1 と ${note} だけのはず）`);
  }
  return errs;
}
{
  const errs = await selfTest();
  if (errs.length) {
    fail("自己試験", ...errs);
    if (opt.failFast) stop();
  } else rows.push(["自己試験", `期待を1か所壊した行 ${nCanaries} 種（頭と終わりに置いて）と、終わりの印の崩し 5 種は、どれも狙いどおりに落ちた`]);
}
const runFailed = failed; // 組み立て・書き直し・自己試験で落ちた数（0 でなければ --update-expect は書かない）

// 4. 集まり
const EXPECT = path.join(HERE, "gate_expect.json");
const expect = fs.existsSync(EXPECT) ? JSON.parse(fs.readFileSync(EXPECT, "utf8")) : {};
const fresh = {};
// 指紋：signsem check の「結果 」の行と終わりの印から、時間に依らない物だけを取る。混ぜた行は、壊す前の期待で合った物として数え直す。
function fingerprint(r, last, mixed) {
  const st = (x) => ({ run: x.run, ok: x.ok, err: x.err, excluded: x.excluded, digest: x.digest });
  const fp = { lines: r.lines, lossy: r.lossy, pre: st(r.pre), peg: st(r.peg), tree: st(r.tree), front: st(r.front) };
  for (const m of mixed) for (const s of m.must) fp[s][m.isErr[s] ? "err" : "ok"]++; // 元が合うことは「混ぜた行の元」で見る
  if (last && last.gate) fp.dumpExcused = last.gate.frontErrExcused;
  return fp;
}
for (const [name, sources, stages] of sets) {
  const t = Date.now();
  const file = path.join(OUT, stages);
  if (!fs.existsSync(file)) {
    fail(name, `${stages} が無い`);
    if (opt.failFast) stop();
    continue;
  }
  // 混ぜる位置：0..行の数 の、重ならないでたらめな MIX 個（行がそれより少なければ全部）
  let nLines = 0;
  try {
    nLines = await countLines(file);
  } catch (e) {
    fail(name, `[読めない] ${stages}：${e.message}`);
    if (opt.failFast) stop();
    continue;
  }
  const pos = new Set();
  while (pos.size < Math.min(MIX, nLines)) pos.add(crypto.randomInt(nLines));
  const targets = [...pos].sort((a, b) => a - b);
  const mixer = new Mixer(targets, breakForMix);
  const { code, out, last, res, readErr, mixed } = await runCheck(file, opt.maxDiffs ? ["--max-diffs", String(opt.maxDiffs + 2 * MIX)] : [], mixer);
  const mixedIds = new Set(mixed.map((m) => m.id));
  // 混ぜた行の元（壊す前の行）だけを別に当てる。元が合わない行に混ぜると、その違いが混ぜた分の違いに紛れるので、元が合うことを確かめる。
  // checkLine は行の間で数のほかに何も持ち越さないので、元をここで当てるのは、集まりの中で当てるのと同じ。
  const orig = mixed.length ? await runCheck(asInput([...mixed.map((m) => m.orig), endOf(mixed.length)])) : null;
  const head = out.split("\n").find((l) => l.startsWith("行 ")) || "";
  const stageLines = out.split("\n").filter((l) => /^  (前処理|文法|木|通し)：/.test(l)).map((l) => l.trim());
  const notes = out.split("\n").filter((l) => l.startsWith("["));
  const extra = [];
  if (readErr) extra.push(`[読めない] ${stages}：${readErr.message}`);
  // 混ぜた行：段ごとに、ちょうど混ぜた数だけ違い、ほかに違い・読めない行・InternalError が無いこと
  const want = Object.fromEntries(STAGES.map((s) => [s, mixed.filter((m) => m.must.includes(s)).length]));
  if (mixed.length === 0) extra.push(`[混ぜる行が無い] 選んだ位置 ${JSON.stringify(targets)} の後に壊せる行が無かった`);
  if (res && !res.stopped) {
    const got = Object.fromEntries(STAGES.map((s) => [s, res[s].differ]));
    if (STAGES.some((s) => got[s] !== want[s])) extra.push(`[混ぜた行] 段ごとの違いが ${JSON.stringify(got)}（混ぜた行の分は ${JSON.stringify(want)}）`);
    if (res.bad) extra.push(`[読めない行] ${res.bad}`);
    if (STAGES.some((s) => res[s].internal)) extra.push(`[InternalError] ${JSON.stringify(Object.fromEntries(STAGES.map((s) => [s, res[s].internal])))}`);
    if (mixed.length && code !== 1) extra.push(`[混ぜた行] 違いがあるのに signsem check が ${code} を返した`);
  }
  if (orig && (orig.code !== 0 || !orig.res || orig.res.bad || STAGES.some((s) => orig.res[s].differ || orig.res[s].internal))) {
    const ol = orig.out.split("\n");
    extra.push(`[混ぜた行の元] 壊す前の行を当てると exit ${orig.code}（0 のはず）`, ...ol.filter((l) => l.startsWith("  ") && /：/.test(l)).map((l) => l.trim()),
      ...ol.flatMap((l, k) => (/^(前処理|文法|木|通し) id /.test(l) ? [l, ol[k + 1] || ""] : [])).slice(0, 8));
  }
  if (res && res.stopped) extra.push("[途中で止めた] --max-diffs");
  if (!last || !last.end) extra.push("[終わりの印が読めない]");
  else {
    if (res && !res.stopped && last.lines !== res.lines) extra.push(`[本数が違う] 印は ${last.lines}、signsem が読んだのは ${res.lines}`);
    if (last.complete !== true) extra.push("[部分の書き出し] 印の complete が真でない");
    if (JSON.stringify(last.stamp) !== JSON.stringify(STAMP)) extra.push(`[版が違う] stages は ${JSON.stringify(last.stamp)}、今は ${JSON.stringify(STAMP)}（--dump で書き直す）`);
    if (sources) {
      const buf = fs.existsSync(path.join(OUT, sources)) ? fs.readFileSync(path.join(OUT, sources)) : null;
      const cur = buf && { name: sources, lines: buf.toString("utf8").split("\n").filter(Boolean).length, sha1: sha1Head(buf) };
      if (JSON.stringify(last.sources) !== JSON.stringify(cur)) extra.push(`[源が違う] stages は ${JSON.stringify(last.sources)}、今の源は ${JSON.stringify(cur)}（--dump で書き直す）`);
      const g = last.gate;
      if (!g) extra.push("[dump の門] 終わりの印に門の結果が無い");
      else if (g.rowsDiffer || g.resolveOkButFrontErr || g.rowCountDiffer || g.frontErrUnexcused) extra.push(`[dump の門] ${JSON.stringify(g)}`);
    }
  }
  if (!res) extra.push("[指紋] 結果の行が無い");
  else {
    const fp = fingerprint(res, last, mixed);
    const passed = extra.length === 0 && notes.length === 0;
    if (passed) fresh[name] = fp;
    if (!opt.update) {
      if (!expect[name]) extra.push("[指紋] gate_expect.json にこの集まりが無い（--update-expect で書く）");
      else if (JSON.stringify(expect[name]) !== JSON.stringify(fp)) extra.push(`[指紋が違う] 期待 ${JSON.stringify(expect[name])}、今 ${JSON.stringify(fp)}`);
    }
  }
  const mixLine = `混ぜた壊した行 ${mixed.length}（${mixed.map((m) => `id ${m.id} ${m.kind}`).join("・")}）`;
  const line1 = `exit ${code}・${Math.round((Date.now() - t) / 1000)} 秒・${head}`;
  if (extra.length || notes.length) {
    // 見せる違いは、混ぜた行のでない物だけ
    const shown = [];
    const ls = out.split("\n");
    for (let k = 0; k < ls.length; k++) {
      const m = ls[k].match(/^(前処理|文法|木|通し) id (\d+) /);
      if (m && !mixedIds.has(Number(m[2]))) shown.push(ls[k], ls[k + 1] || "");
    }
    fail(name, line1, mixLine, ...stageLines, ...notes, ...extra, ...shown.slice(0, 8));
    if (opt.failFast) stop();
  } else rows.push([name, line1, mixLine, ...stageLines]);
}
report();
if (opt.update && runFailed) console.log("組み立て・書き直し・自己試験のどれかが落ちたので、gate_expect.json は書かない");
else if (opt.update) {
  for (const [name, fp] of Object.entries(fresh))
    if (!expect[name]) console.log(`  ${name}：指紋を新しく書く`);
    else if (JSON.stringify(expect[name]) !== JSON.stringify(fp)) console.log(`  ${name}：指紋が変わる\n    前 ${JSON.stringify(expect[name])}\n    今 ${JSON.stringify(fp)}`);
  const merged = { ...expect, ...fresh };
  const sorted = Object.fromEntries(SETS.map(([n]) => n).filter((n) => merged[n]).map((n) => [n, merged[n]]));
  fs.writeFileSync(EXPECT, JSON.stringify(sorted, null, 1) + "\n");
  console.log(`gate_expect.json に ${Object.keys(fresh).length} 個の集まりの指紋を書いた（落ちた集まりは書かない）`);
}
process.exit(failed ? 1 : 0);
