// tree の確かめ（tree-review）：語の並びの組み合わせを乱数で作り、前処理と文法を通る源だけを JSONL に書く。1行 {id, from, source}。
// 使い方：node treerev_fuzz.mjs [出力.jsonl] [本数] [種] [mode]（出力は out/sem から解く。既定 treerev_fuzz_sources.jsonl）
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { JS, PEGGY_URL } from "../gen_front.mjs";
import { outPath } from "./paths.mjs";

const { preprocessWithLines } = await import(pathToFileURL(JS + "/lexer.js").href);
const peggy = (await import(PEGGY_URL)).default;
const parser = peggy.generate(fs.readFileSync(path.join(JS, "sign.pegjs"), "utf8"));

const [out, want, seed0, mode] = [outPath(process.argv[2] || "treerev_fuzz_sources.jsonl"), Number(process.argv[3] || 30000), Number(process.argv[4] || 1), Number(process.argv[5] || 1)];
// mode 2：行の頭と尻の中置を括りの中だけにほぼ寄せ、中置の続きを減らす（通る行を増やす）。
const EDGE_TOP = mode === 2 ? 0.01 : 0.15, EDGE_IN = mode === 2 ? 0.3 : 0.15, DOUBLE = mode === 2 ? 0.01 : 0.05, LOWP = mode === 2 ? 0.85 : 0.97;
let seed = seed0 >>> 0 || 1;
const rnd = () => {
  // xorshift32
  seed ^= seed << 13;
  seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed >>>= 0;
  return seed / 4294967296;
};
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const chance = (p) => rnd() < p;

const ATOMS = ["a", "b", "x", "y", "f", "1", "2", "3", "_", "_", "`s`", "0x1F", "1.5", "_x", "0r1", "\\c"];
const PREFIX = ["-", "!", "!", "!!", "$", "@", "~", "#", "##", "###"];
const POSTFIX = ["!", "~", "@"];
const HIGH = ["~", "~+", "~-", "~*", "~/", "~^", "<", "<=", "=", ">=", ">", "!=", "<", ">", "+", "-", "*", "/", "%", "^", "^", "'", "@", "'", "@", "<<", ">>", "||", ";;", "&&"];
const LOW = [":", "?", "#", ";", "|", "&", "==", "!==", "==", ",", ","];
const ODD = ["===", "!", "$", "++", "<>", "!!", "**"];
const SEATS = ["[-_]", "[!_]", "[!!_]", "[_!]", "[-_ ,]", "[!_ ,]", "[_! ,]", "(-_)", "{!_}", "[!!_ ,]"];

function term(d) {
  let s;
  if (d > 0 && chance(0.25)) s = block(d - 1);
  else if (chance(0.05)) s = pick(SEATS);
  else s = pick(ATOMS);
  if (chance(0.25)) {
    const n = chance(0.7) ? 1 : 2;
    let p = "";
    for (let i = 0; i < n; i++) p += pick(PREFIX);
    s = p + s;
  }
  if (chance(0.15)) {
    const n = chance(0.8) ? 1 : 2;
    for (let i = 0; i < n; i++) s += pick(POSTFIX);
  }
  return s;
}
function op() {
  const r = rnd();
  if (r < 0.6) return pick(HIGH);
  if (r < LOWP) return pick(LOW);
  return pick(ODD);
}
// 1行の語の並び。項と中置を交互に置き、ときどき項を続け（余積）、ときどき頭か尻に中置を置く（区間）。
function expr(d, inner = true) {
  const edge = inner ? EDGE_IN : EDGE_TOP;
  const parts = [];
  if (chance(edge)) parts.push(op());
  const n = 1 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    parts.push(term(d));
    if (i < n - 1) {
      if (chance(0.7)) parts.push(op());
      if (chance(DOUBLE)) parts.push(op());
    }
  }
  if (chance(edge)) parts.push(op());
  return parts.join(" ");
}
function block(d) {
  const k = pick(["[]", "[]", "[]", "()", "{}", "||", "||||"]);
  const open = k.slice(0, k.length / 2), close = k.slice(k.length / 2);
  if (open === "[" && chance(0.05)) return "[]";
  const rows = [];
  const n = open.startsWith("|") ? 1 : chance(0.8) ? 1 : 2;
  for (let i = 0; i < n; i++) rows.push(expr(d));
  return open + rows.join("\n") + close;
}
function source() {
  const r = rnd();
  if (r < 0.15) {
    // 字下げのブロック
    const head = expr(1, false) + " " + pick([":", "?", "+", "<", "==", ",", "'", "|"]);
    const rows = [];
    const n = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) rows.push("\t" + expr(1, false));
    return head + "\n" + rows.join("\n");
  }
  const lines = [];
  const n = chance(0.8) ? 1 : 2;
  for (let i = 0; i < n; i++) lines.push(expr(2, false));
  return lines.join("\n");
}

const seen = new Set();
const keep = [];
let tried = 0, b1err = 0, b2err = 0;
while (keep.length < want && tried < want * 50) {
  tried++;
  const s = source();
  if (seen.has(s)) continue;
  seen.add(s);
  let pre;
  try {
    pre = preprocessWithLines(s);
  } catch {
    b1err++;
    continue;
  }
  try {
    parser.parse(pre.text, { rowAt: new WeakMap(), qAt: new WeakMap() });
  } catch {
    b2err++;
    continue;
  }
  keep.push(s);
}
fs.writeFileSync(out, keep.map((source, id) => JSON.stringify({ id, from: "treerev-fuzz", source })).join("\n") + "\n");
console.log(JSON.stringify({ kept: keep.length, tried, b1err, b2err }));
