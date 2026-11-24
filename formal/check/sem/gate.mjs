// node formal/check/sem/gate.mjs [--dump] [--exe 道] [--fail-fast] [--max-diffs N] [--only 名前,名前…] [--update-expect]（リポジトリの頭で）
// 前段の Lean の写し（formal/sem の signsem）を、out/sem の stages の集まりの全部に当てる門。終わりに表を出し、どれかが落ちれば 1 で終わる。
// gate.mjs は、STACK_ARG（gen_front.mjs。dump.mjs と同じ --stack-size）を付けた node で自分を走らせ直す（入れ子の深い行の JSON.stringify のため）。
// 順に：
//   1. 組み立て：--exe が無ければ formal/sem で lake build --no-build を走らせ、signsem が今の Lean の源から組んだ物かを見る。
//   2. --dump：全部を書き直す。main（sources.jsonl → stages.jsonl.gz）を dump.mjs で書き、gen/all.mjs で源の集まりと前処理を通さない
//      text の集まりを作り直し、残りの源の集まりを dump.mjs で書く。dump.mjs は自分の門（本物の resolve との照らし）が崩れたら 1 で終わる。
//      record.mjs（main の源の集め直し）は走らせない。
//   3. 自己試験（毎回）：種の集まり（peg・lexrev_hand・peg_rawfuzz の頭と、main・treerev_big のいちばん長い LONG_K 本）の行から、期待を
//      壊した行を作り、同じ集まりのほかの行の頭と終わりに置いて signsem check に流し、1 を返し、違いが出るはずの段にちょうど1つの違いが出て、
//      合うはずの段は合い、読めない行が無く、InternalError がそのとおりの段にだけ1つ出るかを見る。壊さない同じ並びは 0 を返すかも見る。壊した欄を
//      入力に使う後ろの段（b1 → 文法、b2 → 木）は、壊した所が答えに届くかが行で変わるので、どちらの組にも入れない（届くと決まった種の行では、
//      違いが出るはずの組に入れる）。壊し方は 46 種：
//        前処理：lineAt の頭、文法が引かない lineAt の全部（囲みのある複数行の行で）、text の単位1つ。前処理と通し：b1 の断りの文。
//        文法：行の line、後ろの行の at、? の位置、後ろの行の語、peggy の断りの文、b3 が null の行の行を空に。
//        木と通し：行の line、断りの文、後ろの行の奥の葉、行を空に、空の行に足す。
//        対の無いサロゲート（上の半分と下の半分の、それぞれで7つ）：
//          出る側：b2 の断りの文の対の無いサロゲート（源の対の片方）を U+FFFD に、対のもう片方に。
//          入る側：b3 が null の行の text の対の無いサロゲート（b2 の答えに届く物）を同じ半分の別の値に。
//          源から：源の対の無いサロゲート（b1 の text・b2 の語・b3 に届く物）を、源・b1 の text・b2 の語・b3 のどれか1つで同じ半分の別の値に
//            （違いが出るのは、源なら前処理と通し、b1 の text なら前処理と文法、b2 の語なら文法と木、b3 なら木と通し）。
//        対の向き：対の上と下の半分を入れ替える（b1 の text、b2 の語、b3 の、どれか1つで）。
//        形：期待の rows と err を入れ替える（b3 で2向き、b3 が null の行の b2 で2向き）。
//        InternalError：signsem check --force-internal で、その行の走る段の答えを InternalError にする（4つの段が走る行と、b3 が null の行）。
//        長い行（main と treerev_big の、それぞれ当たる中でいちばん長い行で4つ）：後ろの段が入力に使う欄（混ぜる行では壊さない欄）を、行の後ろの
//          方で壊す。後ろの行の書き始めの lineAt と text の単位1つ（前処理）、後ろの行の line と語（文法）。
//      対の無いサロゲートを U+FFFD や対のもう片方や同じ半分の別の値と分けない読み（段に渡す入力でも、4つの段のどの比べでも、上の半分か下の
//      半分の片方だけでも）は対の無いサロゲートの壊し方で、対の2つの単位の順を取り違える写しは対の向きで、写しの答えの形が期待と違う行や
//      InternalError の行で期待を返す写しは形と InternalError で、長い行でだけ後ろの段が入力に使う欄を比べない写しは長い行の壊し方で落ちる。
//      綴りの試し：lexrev_hand の全部と peg_rawfuzz の頭の 200 行を、値を変えずに綴りだけ替えて（物の鍵の順、文字列の単位の書き方、空白）流し、
//      0 を返し、結果の行（数と digest）が元の綴りの物と同じかを見る。
//      終わりの印も、行を1つ落とす・印を消す・complete を偽に・印の後に行・行が 0 の5つで、狙った知らせだけが出て 1 を返すかを見る。
//   4. 集まりごと：stages を流す途中で、でたらめに選んだ MIX 個の位置と、いちばん長い（バイトの多い）MIX_BIG 本の行の位置で、行の期待を
//      壊して混ぜ（壊すのは、どの段の答えも依らない欄。でたらめな位置の行は、違いが出る段の組を1つでたらめに選び、その組の種類と葉を
//      でたらめに選んで1か所だけ壊す。いちばん長い行は、段の組の全部で1か所ずつ壊す。組と種類は breakForMix の頭）、壊した段にちょうど
//      混ぜた数の違いが出て、ほかに違いが無いかを見る。混ぜた行の元（壊す前の行）は別に当てて、合うことを見る（元が合わない行に混ぜると、
//      その違いが混ぜた分に紛れるので）。位置は走らせるたびに変わるので、何行目から先は比べない（期待を返す）写しも、どの段でも捕まえる。
//      いちばん長い行はいつも、どの段の組でも壊して混ぜるので、長い行でだけ、どれかの段の比べを飛ばす写しも、走らせるたびに捕まえる
//      （後ろの段が入力に使う欄だけを長い行で比べない写しは、自己試験の長い行の壊し方で）。
//      そして終わりの印について、本数と complete（signsem とは別に）、版（stamp）が今の物と同じか、源の集まり（sources）が今の file と
//      同じか、dump.mjs の門の数が 0 かを見る。
//      最後に指紋（行の数・対の無いサロゲートのある行の数（段の入力にある loneIn と、答えにだけある loneOut）・段ごとの走らせた数・通った数・
//      断りの数・外した id・写しの答えのハッシュ、と dump.mjs が許したスタックの溢れの id。混ぜた行は壊す前の期待で数え直す）が
//      gate_expect.json と同じかを見る。数は期待の形だけで決まるので、写しの答えが変わったことはハッシュ（digest）で見る。混ぜた行は写しの
//      答えを変えないので、ハッシュは混ぜても同じ。混ぜる時は loneIn・loneOut の数え方が変わる行を壊さない。
//      alpha1 が変わって数が変わったら、--dump --update-expect で書き直し、出た指紋の差を見てから commit する。
//   --exe：当てる signsem（変異の試験では壊した写し。組み立ての確かめは飛ばす）。--fail-fast：落ちた所で止める。--max-diffs N：集まりの
//   signsem check に、混ぜた行の違いの数の上を足して渡す（自己試験には渡さない）。--only：当てる集まりを絞る（--dump はいつも全部を書き直す）。
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

// 入れ子の深い行（treerev_big の深さ 5,008）の JSON.stringify は node の既定のスタックを溢れるので、STACK_ARG を付けて走らせ直す
if (!process.execArgv.includes(STACK_ARG)) {
  const r = spawnSync(process.execPath, [STACK_ARG, ...process.execArgv, fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: "inherit" });
  if (r.error) console.error(`${STACK_ARG} を付けて走らせ直せない：${r.error.message}`);
  process.exit(r.status ?? 1);
}

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
// 集まりごとに混ぜる位置：でたらめに選ぶ MIX 個と、いちばん長い（バイトの多い）MIX_BIG 本の行（重なれば1つ。行がそれより少なければ全部）。
// 位置が壊せない行に当たれば次の壊せる行に回し、終わりの印の後には行が無いので、混ぜる行は位置の数まで（終わりの近くの位置の分だけ少なくなる）。
const MIX = 8;
const MIX_BIG = 3;

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
// big（いちばん長い行の位置の集まり）の位置に当たった行そのものは、breakLine(line, true) で段の組の全部で壊す（壊せなければ組の1つで）。
// 壊した行には、壊した行の番号（at）と、その行に当てた位置（target）を持たせる。
class Mixer extends Transform {
  constructor(targets, big, breakLine) {
    super();
    this.targets = targets;
    this.big = big;
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
          // 組の全部で壊すと対の無いサロゲートの数え方が変わる行もあるので（壊す種類はでたらめ）、3回まで試す
          let m = null;
          if (this.lineIdx === this.targets[this.ti] && this.big.has(this.lineIdx)) for (let t = 0; t < 3 && !m; t++) m = this.breakLine(line, true);
          if (!m) m = this.breakLine(line, false);
          if (m) {
            m.at = this.lineIdx;
            m.target = this.targets[this.ti];
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

// サロゲート（UTF-16 の単位）。JS の文字列は単位の並びで、対の無いサロゲートも1つの単位として持てる。
const isHi = (c) => c >= 0xd800 && c <= 0xdbff;
const isLo = (c) => c >= 0xdc00 && c <= 0xdfff;
// s の対の無いサロゲートの位置（単位の番号）
function loneUnits(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (isHi(c) && i + 1 < s.length && isLo(s.charCodeAt(i + 1))) i++;
    else if (isHi(c) || isLo(c)) out.push(i);
  }
  return out;
}
// s の最初の対（上の半分と、続く下の半分）の位置か -1
function pairAt(s) {
  for (let i = 0; i + 1 < s.length; i++) if (isHi(s.charCodeAt(i)) && isLo(s.charCodeAt(i + 1))) return i;
  return -1;
}
// JSON の値のどこか（文字列と物の鍵）に対の無いサロゲートがあるか（SignSem/JV.lean の hasLone と同じ）。入れ子が深くてもスタックを使わない。
function hasLone(v) {
  const st = [v];
  while (st.length) {
    const x = st.pop();
    if (typeof x === "string") {
      if (!x.isWellFormed()) return true;
    } else if (Array.isArray(x)) {
      for (const y of x) st.push(y);
    } else if (isObj(x)) {
      for (const [k, y] of Object.entries(x)) {
        if (!k.isWellFormed()) return true;
        st.push(y);
      }
    }
  }
  return false;
}
// 行の対の無いサロゲートの数え方（Main.lean の loneIn・loneOut と同じ見方）：段の入力（源、b3 が null の行では b1 の text）にあれば "in"、
// ほかで b1・b2・b3 のどこかにあれば "out"、どこにも無ければ null
function loneClass(j) {
  const raw = j.b3 === null || j.b3 === undefined;
  if ((typeof j.source === "string" && !j.source.isWellFormed()) || (raw && isObj(j.b1) && !Array.isArray(j.b1) && hasLone(j.b1.text))) return "in";
  return hasLone(j.b1) || hasLone(j.b2) || hasLone(j.b3) ? "out" : null;
}

// 混ぜる行の壊し方。どの段の答えも依らない欄だけを壊すので、写しの答え（と digest）は変わらない。行ごとに、違いが出る段の組を
// でたらめに1つ選び（every なら組の全部）、選んだ組ごとに種類をでたらめに1つ選び、その中の葉をでたらめに1つ壊す。組どうしは違いが出る段が
// 重ならず、壊す欄も別なので、組の全部で壊した行は、どの組の段にもちょうど1つの違いを出す。種類（[違いが出るはずの段, 名前, 壊す関数]）：
//   b3 が null の行（前処理を通さない text）：b2 の葉、b2 の行を空に、b2 の行に足す、b2 の形を返す（行を断りに、断りを行に）（文法だけ）。
//   b1 が断る行（文法と木は走らず、通しは b1 の断りと比べる）：b1 の断りの葉（前処理と通し）。
//   b1 が通る行：b3 の葉、b3 の行を空に、b3 の行に足す、b3 の形を返す（b2 が通れば木と通し、断れば通しだけ）と、文法が引かない位置の lineAt
//     （前処理だけ。文法が lineAt を引くのは、返す行の書き始めの位置と、断りの位置だけ。b2 が通れば行の at でない位置、断れば lineAt の
//     値が断りの line と違う位置）。b2 が通れば b2 の行の at・q の葉、断れば b2 の断りの葉（文法だけ。木は走らない）。
// 壊すと対の無いサロゲートの数え方（loneClass）が変わる行（消した所にだけ対の無いサロゲートがあった時）と、壊した断りが JS のスタックの
// 溢れに見える行は壊さない（指紋の loneIn・loneOut と外す物を変えないため）。
// 返す物：{id, line, orig（壊す前の行）, must, kind, isErr（段ごとに、壊す前の期待が断りか）} か null（壊せない行）。
function breakForMix(line, every) {
  let j;
  try {
    j = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isObj(j) || j.end) return null;
  const errs = () => [j.b1, j.b2, j.b3].map((b) => isObj(b) && b.err);
  if (errs().some(stackish)) return null;
  // 段ごとに、壊す前の期待が断りか（Main.lean の compare が数える通った・断りの、どちらに入るか）
  const expectOf = { pre: j.b1, peg: j.b2, tree: j.b3, front: isObj(j.b1) && j.b1.err ? { err: j.b1.err } : j.b3 };
  const isErr0 = Object.fromEntries(STAGES.map((s) => [s, isObj(expectOf[s]) && !Array.isArray(expectOf[s]) && "err" in expectOf[s]]));
  const lone0 = loneClass(j);
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
  // 期待の形（rows か err）を返す
  const flipKind = (must, key, what) => {
    const b = j[key];
    if (!isObj(b)) return;
    if (Array.isArray(b.rows)) kinds.push([must, `${what}の形を返す（行を断りに）`, () => (j[key] = { err: { name: "SyntaxError", reason: null, line: d, message: c } })]);
    else if (isObj(b.err)) kinds.push([must, `${what}の形を返す（断りを行に）`, () => (j[key] = { rows: [] })]);
  };
  if (j.b3 === null) {
    if (hasText && isObj(j.b2)) {
      leafKind(["peg"], "b2 の葉（b3 が null）", j.b2);
      rowsKinds(["peg"], j.b2, "b2（b3 が null）");
      flipKind(["peg"], "b2", "b2（b3 が null）");
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
    flipKind(m3, "b3", "b3 ");
  }
  if (!kinds.length) return null;
  // 段の組を選んでから（every なら組の全部）、組ごとにその組の種類を選ぶ
  const groups = [...new Set(kinds.map(([m]) => m.join("+")))];
  const chosen = (every ? groups : [pickOf(groups)]).map((g) => pickOf(kinds.filter(([m]) => m.join("+") === g)));
  for (const [, , doIt] of chosen) doIt();
  const must = STAGES.filter((s) => chosen.some(([m]) => m.includes(s)));
  const kind = chosen.map(([, k]) => k).join("＋");
  // 壊した断りが JS のスタックの溢れに見えれば（外す物が変わるので）、対の無いサロゲートの数え方が変われば、壊さない
  if (errs().some(stackish) || loneClass(j) !== lone0) return null;
  const isErr = Object.fromEntries(must.map((s) => [s, isErr0[s]]));
  // gate.mjs は STACK_ARG で走るので treerev_big の深さでも JSON.stringify は溢れないが、溢れた行は壊さない
  let out;
  try {
    out = JSON.stringify(j);
  } catch {
    return null;
  }
  // JSON.stringify は対の無いサロゲートを escape で書くので、UTF-8 にしても単位は替わらない
  if (!out.isWellFormed()) throw new Error(`id ${j.id}：壊した行に字のままの対の無いサロゲートがある`);
  return { id: j.id, line: out, orig: line, must, kind, isErr };
}

// file のいちばん長い（改行を除いたバイトの多い）K 本の行の文（長い順）
function longestLines(file, K) {
  return new Promise((resolve, reject) => {
    const src = fs.createReadStream(file);
    const s = file.endsWith(".gz") ? src.pipe(zlib.createGunzip()) : src;
    const top = []; // [長さ, 行のバイト]、長い順
    let parts = []; // 今の行の、ここまでの塊
    let len = 0;
    s.on("data", (d) => {
      let start = 0;
      for (let k = d.indexOf(10); k >= 0; k = d.indexOf(10, start)) {
        parts.push(d.subarray(start, k));
        len += k - start;
        if (top.length < K || len > top[top.length - 1][0]) {
          top.push([len, Buffer.concat(parts)]);
          top.sort((a, b) => b[0] - a[0]);
          if (top.length > K) top.pop();
        }
        parts = [];
        len = 0;
        start = k + 1;
      }
      if (start < d.length) {
        parts.push(d.subarray(start));
        len += d.length - start;
      }
    });
    s.on("end", () => resolve(top.map(([, b]) => b.toString("utf8"))));
    src.on("error", reject);
    s.on("error", reject);
  });
}

// file の行の数（改行の数）と、いちばん長い（改行を除いたバイトの多い）K 本の行の番号（0 から、長い順）
function scanLines(file, K) {
  return new Promise((resolve, reject) => {
    const src = fs.createReadStream(file);
    const s = file.endsWith(".gz") ? src.pipe(zlib.createGunzip()) : src;
    let n = 0;
    let len = 0; // 今の行の、ここまでのバイトの数
    const top = []; // [長さ, 番号]、長い順
    s.on("data", (d) => {
      let start = 0;
      for (let k = d.indexOf(10); k >= 0; k = d.indexOf(10, start)) {
        len += k - start;
        if (top.length < K || len > top[top.length - 1][0]) {
          top.push([len, n]);
          top.sort((a, b) => b[0] - a[0]);
          if (top.length > K) top.pop();
        }
        n++;
        len = 0;
        start = k + 1;
      }
      len += d.length - start;
    });
    s.on("end", () => resolve({ n, top: top.map(([, i]) => i) }));
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
// 行を signsem に渡すバイトにする。行は JSON の文で、対の無いサロゲートは escape で書く。字のままの対の無いサロゲートは UTF-8 にすると
// U+FFFD に替わるので、あれば止める。
const asInput = (ls) => {
  const s = ls.join("\n") + "\n";
  if (!s.isWellFormed()) throw new Error("signsem に渡す行に、字のままの対の無いサロゲートがある");
  return Buffer.from(s, "utf8");
};
const NCTX = 100; // 壊した行の前後に置く、同じ集まりのほかの行の数
const LONG_K = 3; // 長い行の壊し方の種に読む、main と treerev_big のいちばん長い行の数（集まりごと）
const FFFD = String.fromCharCode(0xfffd);
const BS = String.fromCharCode(92);
// s の i 番目の単位を u に
const setUnit = (s, i, u) => s.slice(0, i) + u + s.slice(i + 1);
// s の i 番目と i+1 番目の単位を入れ替える
const swapAt = (s, i) => s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
// 文法が引かない lineAt の位置（b2 の行（囲みの中の行も）の書き始めでない位置）の全部
const freeLineAts = (j) => {
  const { ats } = wrowSlots(j.b2.rows);
  return j.b1.lineAt.flatMap((_, k) => (ats.has(k) ? [] : [k]));
};
// root の文字列の葉のうち、対のある最初の物（{o, k, i}：o[k] の i 番目の単位から対）か null
const pairSlot = (root) => {
  for (const s of leavesOf(root))
    if (typeof s.o[s.k] === "string") {
      const i = pairAt(s.o[s.k]);
      if (i >= 0) return { ...s, i };
    }
  return null;
};
// root のどこかの文字列に、単位 u が対の無いサロゲートとしてあるか
const hasLoneUnit = (root, u) => isObj(root) && leavesOf(root).some(({ o, k }) => typeof o[k] === "string" && loneUnits(o[k]).some((i) => o[k].charCodeAt(i) === u));
// src の対のうち、単位 u を半分に持つ物の、もう片方の単位か -1
const partnerIn = (src, u) => {
  for (let i = 0; i + 1 < src.length; i++) {
    const a = src.charCodeAt(i), b = src.charCodeAt(i + 1);
    if (isHi(a) && isLo(b)) {
      if (a === u) return b;
      if (b === u) return a;
      i++;
    }
  }
  return -1;
};
// JSON の値 v を、値を変えずに別の綴りで書く（綴りの試し）。物の鍵は逆の順に、`{`・`[` の後に TAB、`:`・`,` の後に空白を置き、文字列の単位は
// 数えて 4 つごとに書き方を回す：字のまま（書ける字だけ）、短い escape（ある字だけ。`/` は BS と `/`）、BS・u と小文字の 16 進4桁、大文字の 16 進
// 4桁。対は2つの単位を一緒に、字のままか、2つとも16 進で書く。対の無いサロゲートと、字のままで書けない字は、いつも 16 進で書く。
function respell(v) {
  const SHORT = new Map([[34, '"'], [92, BS], [47, "/"], [8, "b"], [12, "f"], [10, "n"], [13, "r"], [9, "t"]]);
  const hex = (c, up) => BS + "u" + (up ? c.toString(16).toUpperCase() : c.toString(16)).padStart(4, "0");
  let n = 0;
  const str = (s) => {
    let out = '"';
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      const m = n++ % 4;
      if (isHi(c) && i + 1 < s.length && isLo(s.charCodeAt(i + 1))) {
        out += m === 0 ? s.slice(i, i + 2) : hex(c, m === 3) + hex(s.charCodeAt(i + 1), m !== 3);
        i++;
      } else if (m === 0 && c >= 0x20 && c !== 34 && c !== 92 && !isHi(c) && !isLo(c)) out += s[i];
      else if (m === 1 && SHORT.has(c)) out += BS + SHORT.get(c);
      else out += hex(c, m === 3);
    }
    return out + '"';
  };
  const TAB = String.fromCharCode(9);
  const val = (x) =>
    typeof x === "string" ? str(x)
    : Array.isArray(x) ? "[" + TAB + x.map(val).join(", ") + "]"
    : isObj(x) ? "{" + TAB + Object.entries(x).reverse().map(([k, y]) => str(k) + ": " + val(y)).join(", ") + "}"
    : JSON.stringify(x);
  return val(v);
}
// 自己試験の signsem check を同じ時に走らせる数（どの回も入力は小さく、時のほとんどは Main.lean の readLine が入力の終わりで待つ 1 秒）
const POOL = 4;
// 仕事（Promise を返す関数）を、同じ時に k 本まで走らせ、結果を仕事の順に返す
async function inPool(tasks, k) {
  const out = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      out[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(k, tasks.length) }, worker));
  return out;
}
let nCanaries = 0;
async function selfTest() {
  const errs = [];
  const seeds = {};
  try {
    const noEnd = (ls) => ls.filter((l) => !JSON.parse(l).end);
    seeds.peg = noEnd(readLines("peg_stages.jsonl.gz"));
    seeds.hand = noEnd(readLines("lexrev_hand_stages.jsonl.gz"));
    seeds.raw = noEnd(headLines("peg_rawfuzz_stages.jsonl", 1 << 22));
    // 長い行の種：main と treerev_big の、いちばん長い LONG_K 本（長い順。壊し方ごとに、当たる中でいちばん長い行を使う）
    seeds.main = noEnd(await longestLines(path.join(OUT, "stages.jsonl.gz"), LONG_K));
    seeds.treerev_big = noEnd(await longestLines(path.join(OUT, "treerev_big_stages.jsonl.gz"), LONG_K));
  } catch (e) {
    return [`自己試験の種が読めない（peg・lexrev_hand・peg_rawfuzz・main・treerev_big の stages）：${e.message}`];
  }
  const pick = (set, ok, what) => {
    const l = seeds[set].find((x) => ok(JSON.parse(x), x));
    if (!l) errs.push(`自己試験の種（${set}）に ${what} の行が無い`);
    return l;
  };
  const b1ok = (j) => isObj(j.b1) && typeof j.b1.text === "string" && Array.isArray(j.b1.lineAt);
  const b2rows = (j) => isObj(j.b2) && Array.isArray(j.b2.rows);
  const b3rows = (j) => isObj(j.b3) && Array.isArray(j.b3.rows);
  const raw = (j) => j.b3 === null;
  // b2 の断りの文の最初の対の無いサロゲートの位置か -1
  const loneMsgAt = (j) => (isObj(j.b2) && isObj(j.b2.err) && typeof j.b2.err.message === "string" ? (loneUnits(j.b2.err.message)[0] ?? -1) : -1);
  // 出る側の種：対の無いサロゲートが源・b1 に無く（数え方が "out"）、b2 の断りの文にあり、その単位が源の対の片方（hi なら上の半分）の行
  const loneOutSeed = (hi) => (j) => {
    const i = loneMsgAt(j);
    if (!b1ok(j) || i < 0 || loneClass(j) !== "out" || hasLone(j.b1)) return false;
    const u = j.b2.err.message.charCodeAt(i);
    return isHi(u) === hi && partnerIn(j.source, u) >= 0;
  };
  // 入る側の種：b3 が null で、text に対の無いサロゲートが1つだけあり（hi なら上の半分、でなければ下の半分）、その単位が b2 の行（の語）に
  // 届いている行
  const loneInSeed = (hi) => (j) => {
    if (!raw(j) || !b1ok(j) || !b2rows(j)) return false;
    const ls = loneUnits(j.b1.text);
    if (ls.length !== 1) return false;
    const u = j.b1.text.charCodeAt(ls[0]);
    return isHi(u) === hi && hasLoneUnit(j.b2, u);
  };
  // 源の対の無いサロゲートの種：b1・b2・b3 が通り、源に対の無いサロゲートが1つだけあり（hi なら上の半分、でなければ下の半分）、その単位が
  // b1 の text・b2 の語・b3 に対の無いまま届いている行
  const loneSrcUnit = (j) => j.source.charCodeAt(loneUnits(j.source)[0]);
  const loneSrcSeed = (hi) => (j) => {
    if (!b1ok(j) || !b2rows(j) || !b3rows(j) || typeof j.source !== "string" || loneUnits(j.source).length !== 1) return false;
    const u = loneSrcUnit(j);
    return isHi(u) === hi && hasLoneUnit(j.b1, u) && hasLoneUnit(j.b2, u) && hasLoneUnit(j.b3, u);
  };
  // 対の無いサロゲート u と同じ半分の別の値（u の下の1ビットを返した物。対の無いままで、隣と対にならない）
  const otherLone = (u) => String.fromCharCode(u ^ 1);
  // root の文字列の葉にある、対の無いサロゲート u の全部を otherLone(u) に
  const flipLone = (root, u) => {
    for (const { o, k } of leavesOf(root))
      if (typeof o[k] === "string") for (const i of loneUnits(o[k])) if (o[k].charCodeAt(i) === u) o[k] = setUnit(o[k], i, otherLone(u));
  };
  // text の最後の、サロゲートでない単位を替える
  const breakTextUnit = (j) => {
    const t = j.b1.text;
    let k = t.length - 1;
    while (k > 0 && (isHi(t.charCodeAt(k)) || isLo(t.charCodeAt(k)))) k--;
    j.b1.text = setUnit(t, k, t[k] === "×" ? "※" : "×");
    return j;
  };
  const lastRow = (j) => j.b2.rows[j.b2.rows.length - 1];
  const HALVES = [[true, "上の半分"], [false, "下の半分"]];
  // 対の向きの種：b1 の text・b2 の語・b3 のどれにも対がある行
  const pairSeed = (j) => b1ok(j) && b2rows(j) && b3rows(j) && pairAt(j.b1.text) >= 0 && !!pairSlot(j.b2) && !!pairSlot(j.b3);
  const swapIn = (root) => {
    const { o, k, i } = pairSlot(root);
    o[k] = swapAt(o[k], i);
  };
  const flipErr = () => ({ err: { name: "SyntaxError", reason: null, line: 1, message: "×" } });
  // [名前, 種の集まり, 種の行, 壊し方, 違いが出るはずの段（ちょうど1つずつ）, 合うはずの段, InternalError が出るはずの段（ちょうど1つずつ）]。
  // 壊し方は、JSON を直すか（json）、signsem check に渡す引数（args）。InternalError は、違いが出るはずの段と合うはずの段のうち、
  // 最後の組に無い段では 0 のはず。
  const canaries = [
    ["前処理", "peg", pick("peg", (j) => b1ok(j) && j.b1.lineAt.length > 0, "b1 が通る"), { json: (j) => ((j.b1.lineAt[0] += 1000), j) }, ["pre"], ["tree", "front"]],
    ["文法", "peg", pick("peg", (j) => b2rows(j) && j.b2.rows.length > 0, "b2 が通る"), { json: (j) => ((j.b2.rows[0].line += 1000), j) }, ["peg"], ["pre", "front"]],
    ["文法の断り", "peg", pick("peg", (j) => isObj(j.b2.err) && typeof j.b2.err.message === "string" && !stackish(j.b2.err) && /^Expected /.test(j.b2.err.message), "b2 が peggy の Expected で断る"),
      { json: (j) => ((j.b2.err.message += "×"), j) }, ["peg"], ["pre", "tree", "front"]],
    ["木", "peg", pick("peg", (j) => b3rows(j) && j.b3.rows.length > 0 && typeof j.b3.rows[0].line === "number", "b3 が通る"), { json: (j) => ((j.b3.rows[0].line += 1000), j) }, ["tree", "front"], ["pre", "peg"]],
    ["木の断り", "peg", pick("peg", (j) => b1ok(j) && b2rows(j) && isObj(j.b3.err) && typeof j.b3.err.message === "string" && !stackish(j.b3.err), "b2 が通り b3 が断る"),
      { json: (j) => ((j.b3.err.message += "×"), j) }, ["tree", "front"], ["pre", "peg"]],
    ["通し（b1 の断り）", "hand", pick("hand", (j) => isObj(j.b1.err) && typeof j.b1.err.message === "string", "b1 が断る"), { json: (j) => ((j.b1.err.message += "×"), j) }, ["pre", "front"], ["peg", "tree"]],
    // 混ぜる行の壊し方のうち、上に無い物（行の頭の line でない所、行を空にする所、形を返す所）と、どの段の答えも依らないと決めた欄
    // （文法が引かない lineAt、b2 の行の at・q）を壊して後ろの段が合うことも、ここで見る。
    ["前処理（文法が引かない lineAt の全部）", "peg",
      pick("peg", (j) => b1ok(j) && b2rows(j) && isObj(j.b3) && j.b2.rows.some((r) => r.w.some((w) => isObj(w) && Array.isArray(w.rows) && w.rows.length > 0)) &&
        new Set(j.b1.lineAt).size >= 2 && freeLineAts(j).length > 0, "b2 が囲みの中の行を持って通り、lineAt が2行以上に渡る"),
      { json: (j) => {
        for (const k of freeLineAts(j)) j.b1.lineAt[k] += 1000;
        return j;
      } }, ["pre"], ["peg", "tree", "front"]],
    ["前処理（text の単位）", "peg", pick("peg", (j) => b1ok(j) && b2rows(j) && isObj(j.b3) && j.b1.text.length > 0, "b1 が通り text が空でない"),
      { json: breakTextUnit }, ["pre"], ["tree", "front"]],
    ["文法（後ろの行の at）", "peg", pick("peg", (j) => b2rows(j) && j.b2.rows.length >= 2 && isObj(j.b3), "b2 が2行以上で通る"),
      { json: (j) => ((j.b2.rows[j.b2.rows.length - 1].at += 1000), j) }, ["peg"], ["pre", "tree", "front"]],
    ["文法（? の位置）", "peg", pick("peg", (j) => b2rows(j) && j.b2.rows.some((r) => Array.isArray(r.q) && r.q.length) && isObj(j.b3), "b2 の行に ? の語がある"),
      { json: (j) => {
        const r = j.b2.rows.findLast((r) => Array.isArray(r.q) && r.q.length);
        r.q[r.q.length - 1] += 1000;
        return j;
      } }, ["peg"], ["pre", "tree", "front"]],
    ["文法（後ろの行の語）", "peg", pick("peg", (j) => b2rows(j) && j.b2.rows.length >= 2 && j.b2.rows[j.b2.rows.length - 1].w.some((w) => typeof w === "string") && isObj(j.b3), "b2 が2行以上で通る"),
      { json: (j) => {
        const w = j.b2.rows[j.b2.rows.length - 1].w;
        const k = w.findLastIndex((x) => typeof x === "string");
        w[k] += "×";
        return j;
      } }, ["peg"], ["pre", "front"]],
    ["木（後ろの行の奥）", "peg", pick("peg", (j) => b2rows(j) && b3rows(j) && j.b3.rows.length >= 2, "b3 が2行以上で通る"),
      { json: (j) => {
        const ls = leavesOf(j.b3.rows[j.b3.rows.length - 1]);
        bump(ls[ls.length - 1], 1000, "×");
        return j;
      } }, ["tree", "front"], ["pre", "peg"]],
    ["木（空の行）", "peg", pick("peg", (j) => b2rows(j) && b3rows(j) && j.b3.rows.length > 0, "b2 が通り b3 に行がある"),
      { json: (j) => ((j.b3.rows = []), j) }, ["tree", "front"], ["pre", "peg"]],
    ["木（空の行に足す）", "hand", pick("hand", (j) => b2rows(j) && b3rows(j) && j.b3.rows.length === 0, "b2 が通り b3 の行が空"),
      { json: (j) => (j.b3.rows.push(null), j) }, ["tree", "front"], ["pre", "peg"]],
    ["文法（空の行・b3 が null）", "raw", pick("raw", (j) => raw(j) && b2rows(j) && j.b2.rows.length > 0, "b3 が null で b2 に行がある"),
      { json: (j) => ((j.b2.rows = []), j) }, ["peg"], ["pre", "tree", "front"]],
    // 対の無いサロゲート（上の半分と下の半分の、それぞれで）：U+FFFD に寄せる読み、対の片方どうしを分けない読み、同じ半分の値どうしを
    // 分けない読みでは見えない違い。入る側（段に渡す源・text・語）でも、比べ（4つの段のどれか）でも。
    ...HALVES.flatMap(([hi, h]) => [
      [`出る側の対の無いサロゲート（${h}を U+FFFD に）`, "hand", pick("hand", loneOutSeed(hi), `b2 の断りの文にだけ対の無いサロゲート（源の対の${h}）がある`),
        { json: (j) => ((j.b2.err.message = setUnit(j.b2.err.message, loneMsgAt(j), FFFD)), j) }, ["peg"], ["pre", "tree", "front"]],
      [`出る側の対の無いサロゲート（${h}を対のもう片方に）`, "hand", pick("hand", loneOutSeed(hi), `b2 の断りの文にだけ対の無いサロゲート（源の対の${h}）がある`),
        { json: (j) => {
          const m = j.b2.err.message;
          const i = loneMsgAt(j);
          j.b2.err.message = setUnit(m, i, String.fromCharCode(partnerIn(j.source, m.charCodeAt(i))));
          return j;
        } }, ["peg"], ["pre", "tree", "front"]],
      [`入る側の対の無いサロゲート（b3 が null の text の${h}）`, "raw", pick("raw", loneInSeed(hi), `b3 が null で、text の対の無いサロゲートが1つだけ（${h}）で b2 の行に届く`),
        { json: (j) => {
          const t = j.b1.text;
          const i = loneUnits(t)[0];
          j.b1.text = setUnit(t, i, otherLone(t.charCodeAt(i)));
          return j;
        } }, ["peg"], ["pre", "tree", "front"]],
      // 源の対の無いサロゲートを、源・b1 の text・b2 の語・b3 のどれか1つで同じ半分の別の値に。源なら前処理と通しの答えが、b1 の text なら
      // 前処理の比べと文法の答えが、b2 の語なら文法の比べと木の答えが、b3 なら木と通しの比べが違う
      ...[
        ["源", ["pre", "front"], ["peg", "tree"], (j, u) => (j.source = setUnit(j.source, loneUnits(j.source)[0], otherLone(u)))],
        ["b1 の text", ["pre", "peg"], ["tree", "front"], (j, u) => flipLone(j.b1, u)],
        ["b2 の語", ["peg", "tree"], ["pre", "front"], (j, u) => flipLone(j.b2, u)],
        ["b3", ["tree", "front"], ["pre", "peg"], (j, u) => flipLone(j.b3, u)],
      ].map(([where, must, clean, f]) => [`源の対の無いサロゲート（${h}を別の値に：${where}）`, "hand",
        pick("hand", loneSrcSeed(hi), `源の対の無いサロゲートが1つだけ（${h}）で、b1 の text・b2 の語・b3 に届く`),
        { json: (j) => (f(j, loneSrcUnit(j)), j) }, must, clean]),
    ]),
    // 対の向き：対の2つの単位の順を取り違える写しが落ちる
    ["対の向き（b1 の text）", "hand", pick("hand", pairSeed, "b1 の text・b2 の語・b3 に対がある"),
      { json: (j) => ((j.b1.text = swapAt(j.b1.text, pairAt(j.b1.text))), j) }, ["pre"], ["tree", "front"]],
    ["対の向き（b2 の語）", "hand", pick("hand", pairSeed, "b1 の text・b2 の語・b3 に対がある"), { json: (j) => (swapIn(j.b2), j) }, ["peg"], ["pre", "front"]],
    ["対の向き（b3）", "hand", pick("hand", pairSeed, "b1 の text・b2 の語・b3 に対がある"), { json: (j) => (swapIn(j.b3), j) }, ["tree", "front"], ["pre", "peg"]],
    // 形：写しの答えの形（rows か err）が期待と違う行で期待を返す写しが落ちる。返すのは、どの段の入力にもならない期待（b3、b3 が null の行の b2）
    ["木の形（行を断りに）", "peg", pick("peg", (j) => b1ok(j) && b2rows(j) && b3rows(j), "b2 と b3 が通る"), { json: (j) => ((j.b3 = flipErr()), j) }, ["tree", "front"], ["pre", "peg"]],
    ["木の形（断りを行に）", "peg", pick("peg", (j) => b1ok(j) && b2rows(j) && isObj(j.b3) && isObj(j.b3.err), "b2 が通り b3 が断る"),
      { json: (j) => ((j.b3 = { rows: [] }), j) }, ["tree", "front"], ["pre", "peg"]],
    ["文法の形（行を断りに・b3 が null）", "raw", pick("raw", (j) => raw(j) && b2rows(j), "b3 が null で b2 が通る"), { json: (j) => ((j.b2 = flipErr()), j) }, ["peg"], ["pre", "tree", "front"]],
    ["文法の形（断りを行に・b3 が null）", "raw", pick("raw", (j) => raw(j) && isObj(j.b2) && isObj(j.b2.err), "b3 が null で b2 が断る"),
      { json: (j) => ((j.b2 = { rows: [] }), j) }, ["peg"], ["pre", "tree", "front"]],
    // InternalError：写しの InternalError はどの入力でも起きないので、signsem check --force-internal で起こす。InternalError の行で期待を返す写しや、
    // InternalError を数えない写しが落ちる。
    ["InternalError（4つの段）", "peg", pick("peg", (j) => b1ok(j) && b2rows(j) && b3rows(j), "b2 と b3 が通る"), { args: (j) => ["--force-internal", String(j.id)] },
      ["pre", "peg", "tree", "front"], [], ["pre", "peg", "tree", "front"]],
    ["InternalError（b3 が null）", "raw", pick("raw", (j) => raw(j) && b2rows(j), "b3 が null で b2 が通る"), { args: (j) => ["--force-internal", String(j.id)] },
      ["peg"], ["pre", "tree", "front"], ["peg"]],
    // 長い行：main と treerev_big の、それぞれいちばん長い行（その壊し方が当たる中で）で、後ろの段が入力に使う欄（混ぜる行では壊さない欄）を
    // 壊す。長い行でだけ、その欄を比べない写しが落ちる。壊すのは行の後ろの方（後ろの行）で、頭の方だけを比べる写しも落ちる。
    ...["main", "treerev_big"].flatMap((set) => [
      [`長い行（${set}）：後ろの行の書き始めの lineAt`, set,
        pick(set, (j) => b1ok(j) && b2rows(j) && j.b2.rows.length > 0 && isObj(j.b3) && Number.isInteger(lastRow(j).at) && lastRow(j).at < j.b1.lineAt.length, "b2 が通る"),
        { json: (j) => ((j.b1.lineAt[lastRow(j).at] += 1000), j) }, ["pre"], ["tree", "front"]],
      [`長い行（${set}）：text の単位`, set, pick(set, (j) => b1ok(j) && b2rows(j) && isObj(j.b3) && j.b1.text.length > 0, "b1 が通り text が空でない"),
        { json: breakTextUnit }, ["pre"], ["tree", "front"]],
      [`長い行（${set}）：後ろの行の line`, set, pick(set, (j) => b1ok(j) && b2rows(j) && j.b2.rows.length > 0 && isObj(j.b3) && typeof lastRow(j).line === "number", "b2 が通る"),
        { json: (j) => ((lastRow(j).line += 1000), j) }, ["peg"], ["pre", "front"]],
      [`長い行（${set}）：後ろの行の語`, set,
        pick(set, (j) => b1ok(j) && b2rows(j) && j.b2.rows.length > 0 && isObj(j.b3) && lastRow(j).w.some((w) => typeof w === "string"), "b2 の最後の行に語がある"),
        { json: (j) => {
          const w = lastRow(j).w;
          w[w.findLastIndex((x) => typeof x === "string")] += "×";
          return j;
        } }, ["peg"], ["pre", "front"]],
    ]),
  ];
  nCanaries = canaries.length;
  const differsOf = (r) => (r.res ? Object.fromEntries(STAGES.map((s) => [s, r.res[s].differ])) : null);
  // 1つの壊し方を当てる（壊さない並びと、壊した行を頭に置いた並びと、終わりに置いた並び）。落ちた所の文を返す。
  const checkCanary = async ([what, set, line, breakIt, must, clean, internal = []]) => {
    const out = [];
    const ctx = seeds[set].filter((l) => l !== line).slice(0, NCTX);
    const bad = breakIt.json ? JSON.stringify(breakIt.json(JSON.parse(line))) : line;
    const extra = breakIt.args ? breakIt.args(JSON.parse(line)) : [];
    if (bad === line && !extra.length) return [`${what}：壊し方が行を変えなかった`];
    const good = await runCheck(asInput([...ctx, line, endOf(ctx.length + 1)]));
    if (good.code !== 0) out.push(`${what}：壊さない並び（${ctx.length + 1} 行）で signsem check が ${good.code} を返した（0 のはず）`);
    for (const [where, ls] of [["頭", [bad, ...ctx]], ["終わり", [...ctx, bad]]]) {
      const r = await runCheck(asInput([...ls, endOf(ls.length)]), extra);
      const d = differsOf(r);
      if (r.code !== 1 || !d) {
        out.push(`${what}（${where}）：壊した期待で signsem check が ${r.code} を返した（1 のはず）`);
        continue;
      }
      const ints = Object.fromEntries(STAGES.map((s) => [s, r.res[s].internal]));
      const okD = must.every((s) => d[s] === 1) && clean.every((s) => d[s] === 0);
      const okI = [...must, ...clean].every((s) => ints[s] === (internal.includes(s) ? 1 : 0));
      if (!okD || !okI || r.res.bad !== 0)
        out.push(`${what}（${where}）：段ごとの違いが ${JSON.stringify(d)}・InternalError が ${JSON.stringify(ints)}・読めない ${r.res.bad}（` +
          `${JSON.stringify(must)} は違いがちょうど 1、${JSON.stringify(clean)} は 0、InternalError は ${JSON.stringify(internal)} がちょうど 1 でほかは 0、読めない 0 のはず）`);
    }
    return out;
  };
  // 綴りの試し：値を変えずに綴りだけを替えた行は、元の綴りの行と同じ結果（数と digest）で 0 を返す
  const checkRespell = async ([what, ls]) => {
    const re = ls.map((l) => respell(JSON.parse(l)));
    const reEnd = respell(JSON.parse(endOf(ls.length)));
    const all = re.join("\n");
    // 綴りが替わったこと：どの行も字が違い、`/` の短い escape と、16 進で書いた対（上の半分と下の半分の escape の続き）がある
    const escPair = new RegExp(BS + BS + "u[dD][89abAB][0-9a-fA-F]{2}" + BS + BS + "u[dD][c-fC-F][0-9a-fA-F]{2}");
    const forms = [all.includes(BS + "/"), escPair.test(all)];
    if (!re.every((l, k) => l !== ls[k]) || forms.some((x) => !x)) return [`綴りの試し（${what}）：綴りが替わっていない（${JSON.stringify(forms)}）`];
    const a = await runCheck(asInput([...ls, endOf(ls.length)]));
    const b = await runCheck(asInput([...re, reEnd]));
    if (a.code !== 0 || b.code !== 0 || !a.res || !b.res || JSON.stringify(a.res) !== JSON.stringify(b.res))
      return [`綴りの試し（${what}）：元の綴りで exit ${a.code}、替えた綴りで exit ${b.code}（どちらも 0 で、結果の行が同じはず）・元 ${JSON.stringify(a.res)}・替えた ${JSON.stringify(b.res)}`];
    return [];
  };
  const respells = [["lexrev_hand の全部", seeds.hand], ["peg_rawfuzz の頭の 200 行", seeds.raw.slice(0, 200)]];
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
  const checkMark = async ([what, ls, note]) => {
    const r = await runCheck(asInput(ls));
    const notes = r.out.split("\n").filter((l) => l.startsWith("["));
    if (note === null) return r.code !== 0 ? [`終わりの印（${what}）：signsem check が ${r.code} を返した（0 のはず）`] : [];
    if (r.code !== 1 || !notes.some((l) => l.startsWith(note)) || notes.length !== 1) return [`終わりの印（${what}）：exit ${r.code}・知らせ ${JSON.stringify(notes)}（1 と ${note} だけのはず）`];
    return [];
  };
  const tasks = [...canaries.filter((c) => c[2]).map((c) => () => checkCanary(c)), ...respells.map((x) => () => checkRespell(x)), ...marks.map((x) => () => checkMark(x))];
  for (const e of await inPool(tasks, POOL)) errs.push(...e);
  return errs;
}
{
  const errs = await selfTest().catch((e) => [`自己試験が止まった：${e.message}`]);
  if (errs.length) {
    fail("自己試験", ...errs);
    if (opt.failFast) stop();
  } else rows.push(["自己試験", `期待を壊した行 ${nCanaries} 種（頭と終わりに置いて）と、綴りの試し 2 つと、終わりの印の崩し 5 種は、どれも狙いどおりだった`]);
}
const runFailed = failed; // 組み立て・書き直し・自己試験で落ちた数（0 でなければ --update-expect は書かない）

// 4. 集まり
const EXPECT = path.join(HERE, "gate_expect.json");
const expect = fs.existsSync(EXPECT) ? JSON.parse(fs.readFileSync(EXPECT, "utf8")) : {};
const fresh = {};
// 指紋：signsem check の「結果 」の行と終わりの印から、時間に依らない物だけを取る。混ぜた行は、壊す前の期待で合った物として数え直す。
function fingerprint(r, last, mixed) {
  const st = (x) => ({ run: x.run, ok: x.ok, err: x.err, excluded: x.excluded, digest: x.digest });
  const fp = { lines: r.lines, loneIn: r.loneIn, loneOut: r.loneOut, pre: st(r.pre), peg: st(r.peg), tree: st(r.tree), front: st(r.front) };
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
  // 混ぜる位置：0..行の数 の、いちばん長い MIX_BIG 本と、重ならないでたらめな MIX 個（行がそれより少なければ全部）
  let nLines = 0;
  let big = [];
  try {
    ({ n: nLines, top: big } = await scanLines(file, MIX_BIG));
  } catch (e) {
    fail(name, `[読めない] ${stages}：${e.message}`);
    if (opt.failFast) stop();
    continue;
  }
  const bigSet = new Set(big);
  const pos = new Set(big);
  const nPos = Math.min(nLines, big.length + MIX);
  while (pos.size < nPos) pos.add(crypto.randomInt(nLines));
  const targets = [...pos].sort((a, b) => a - b);
  const mixer = new Mixer(targets, bigSet, breakForMix);
  // --max-diffs に足す、混ぜた行の違いの数の上（でたらめな位置の行は2つまで、いちばん長い行は4つの段の全部まで）
  const mixPad = targets.reduce((a, t) => a + (bigSet.has(t) ? STAGES.length : 2), 0);
  const { code, out, last, res, readErr, mixed } = await runCheck(file, opt.maxDiffs ? ["--max-diffs", String(opt.maxDiffs + mixPad)] : [], mixer);
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
  else if (typeof res.loneIn !== "number" || typeof res.loneOut !== "number") extra.push("[指紋] 結果の行に loneIn・loneOut が無い");
  else {
    const fp = fingerprint(res, last, mixed);
    const passed = extra.length === 0 && notes.length === 0;
    if (passed) fresh[name] = fp;
    if (!opt.update) {
      if (!expect[name]) extra.push("[指紋] gate_expect.json にこの集まりが無い（--update-expect で書く）");
      else if (JSON.stringify(expect[name]) !== JSON.stringify(fp)) extra.push(`[指紋が違う] 期待 ${JSON.stringify(expect[name])}、今 ${JSON.stringify(fp)}`);
    }
  }
  // 長い行（MIX_BIG 本の位置に当たった行そのもの）を混ぜた所には「長い行」と書く
  const mixLine = `混ぜた壊した行 ${mixed.length}（${mixed.map((m) => `id ${m.id} ${m.kind}${m.at === m.target && bigSet.has(m.target) ? "・長い行" : ""}`).join("・")}）`;
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
