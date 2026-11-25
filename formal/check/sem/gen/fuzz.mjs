// 文法（sign.pegjs）を peggy で作った parser に、前処理を通さない字の並びを当てて、stages と同じ形の JSONL を書く（peg の確かめの足し）。
// node --stack-size=8000 fuzz.mjs [out.jsonl] [--n N] [--seed S] [--stages stages.jsonl.gz] [--real K]
//   out と --stages は out/sem から解く（既定 peg_fuzz_stages.jsonl と stages.jsonl.gz）。
//   1行 {id, source, b1:{text, lineAt}, b2, b3:null}。lineAt は位置ごとに違う値（k + 1）にして、行の値が位置そのものを確かめるようにする。
//   字の並びは3種：(a) 字の表からの乱れた並び、(b) 文法に沿って作った並びに小さな傷、(c) stages の本物の b1.text に小さな傷（--real K 本）。
//   最後に終わりの印の行 {end:true, units:"utf16", lines:N, complete:true, stamp:S}（N は書いた行の数、S は gen_front.mjs の frontStamp()。dump.mjs の印から sources と
//   gate を除いた形）を書く。位置（at・q・lineAt の添え字）は dump.mjs と同じく UTF-16 の符号単位の番号（peggy の offset）そのまま。
import fs from "fs";
import zlib from "zlib";
import { PEGGY_URL, JS, frontStamp } from "../gen_front.mjs";
const STAMP = frontStamp(); // 走らせ始めの版（alpha1 の前段の file・peggy・道具・node・スタック）
import { outPath } from "./paths.mjs";

const peggy = (await import(PEGGY_URL)).default;
const parser = peggy.generate(fs.readFileSync(JS + "/sign.pegjs", "utf8"));

const args = process.argv.slice(2);
const out = outPath(args[0] && !args[0].startsWith("--") ? args.shift() : "peg_fuzz_stages.jsonl");
const opt = { n: 100000, seed: 1, stages: outPath("stages.jsonl.gz"), real: 0 };
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--n") opt.n = Number(args[++i]);
  else if (args[i] === "--seed") opt.seed = Number(args[++i]);
  else if (args[i] === "--stages") opt.stages = outPath(args[++i]);
  else if (args[i] === "--real") opt.real = Number(args[++i]);
  else throw new Error("知らない引数 " + args[i]);
}

let st = opt.seed >>> 0 || 1;
const rnd = () => {
  st ^= st << 13; st >>>= 0;
  st ^= st >>> 17;
  st ^= st << 5; st >>>= 0;
  return st / 4294967296;
};
const ri = (n) => Math.floor(rnd() * n);
const pick = (a) => a[ri(a.length)];

const ALPHA = [" ", " ", " ", "\r", "\x02", "\x03", "`", "[", "]", "{", "}", "(", ")", "|", "||", "\\", "-", ".", "x", "0", "1", "9", "a", "Z", "_",
  "u", "r", "b", "#", "~", "!", "$", "@", ":", "?", "+", "\n", "\t", "\x1f", "\"", "'", "<", ">", "é", "あ", "\x00", "\x7f", "\x85", ",", ";", "*", "=",
  "^", "%", "&", "/", "f", "A", "F", "G", "…", "\x0b", "\x9f", "\xa0"];

// (b) 文法に沿った並び
function genAtom() {
  switch (ri(12)) {
    case 0: return "`" + pick(["", "ab", "x y", "é", ":"]) + "`";
    case 1: return "\\" + pick(["a", " ", "n", "\n", "`", "\\"]);
    case 2: return ri(100) + "x" + pick(["0", "ff", "A1", ""]);
    case 3: return pick(["0r", "0b"]) + pick(["1", "01", "ff", "2", ""]);
    case 4: return ri(200) + "u" + pick(["41", "3042", "g", ""]);
    case 5: return pick(["", "-"]) + ri(1000) + pick(["", ".", ".5", ".25"]);
    case 6: return pick(["x", "inc", "add", "Foo_1", "a9"]);
    case 7: return pick(["_x", "__", "_1", "_"]);
    default: return pick(["x", "y", "1", "2", "_", "f"]);
  }
}
function genTerm(d) {
  if (ri(6) === 0) return pick([":", "?", "+", "-", "*", "==", "!==", "|", "||", "&", ";", ",", "#", "@", "'", "<", ">=", "~", "$", "!", "?"]);
  let pre = "";
  for (let k = ri(4) === 0 ? 1 + ri(2) : 0; k > 0; k--) pre += pick(["###", "##", "#", "-", "~", "!!", "!", "$", "@"]);
  let core;
  if (d > 0 && ri(4) === 0) core = genBlock(d - 1);
  else core = genAtom();
  let post = "";
  for (let k = ri(5) === 0 ? 1 + ri(2) : 0; k > 0; k--) post += pick(["!", "~", "@"]);
  return pre + core + post;
}
function genExpr(d) {
  let s = genTerm(d);
  for (let k = ri(5); k > 0; k--) s += (ri(8) === 0 ? "  " : " ") + genTerm(d);
  return s;
}
function genExprs(d) {
  let s = genExpr(d);
  for (let k = ri(3) === 0 ? 1 + ri(2) : 0; k > 0; k--) s += "\r" + (ri(3) === 0 ? " " : "") + genExpr(d);
  return s;
}
function genBlock(d) {
  const e = () => (ri(3) === 0 ? pick([" ", "\r", " \r "]) : "");
  switch (ri(8)) {
    case 0: return "[" + e() + genExprs(d) + e() + "]";
    case 1: return "{" + e() + genExprs(d) + e() + "}";
    case 2: return "(" + e() + genExprs(d) + e() + ")";
    case 3: return pick(["[]", "{}", "()", "[ ]", "(\r)"]);
    case 4: return "||" + genExprs(d) + "||";
    case 5: return "|" + genExprs(d) + "|";
    default: return "\x02" + (ri(3) === 0 ? " " : "") + genExprs(d) + (ri(3) === 0 ? " " : "") + "\x03";
  }
}
function genProgram() {
  const lines = [];
  for (let k = 1 + ri(4); k > 0; k--) {
    if (ri(6) === 0) lines.push("`" + pick(["note", "a` b", "x`!", "x` y", "`", "a`@"]) );
    else lines.push((ri(5) === 0 ? " " : "") + genExpr(2) + (ri(5) === 0 ? " " : ""));
  }
  return lines.join(pick(["\r", "\r", "\r\r"]));
}
function mutate(s, times) {
  for (let t = 0; t < times; t++) {
    const p = ri(s.length + 1);
    switch (ri(5)) {
      case 0: s = s.slice(0, p) + s.slice(p + 1); break;
      case 1: s = s.slice(0, p) + pick(ALPHA) + s.slice(p); break;
      case 2: s = s.slice(0, p) + pick(ALPHA) + s.slice(p + 1); break;
      case 3: { const q = ri(s.length + 1); s = s.slice(0, p) + s.slice(Math.min(p, q), Math.max(p, q)) + s.slice(p); break; }
      default: { const q = Math.min(s.length, p + 1 + ri(4)); s = s.slice(0, p) + s.slice(q); }
    }
  }
  return s;
}

// --- JS の答え（dump.mjs の b2Rows と errOf の写し。位置は peggy の offset のまま、lineAt(o) は o + 1。サロゲートは作らない：BMP の外の字と
// 対の無いサロゲートは gen/rawfuzz.mjs が当てる） ---
const TAGS = new Set(['"BRACKET_"', '"ABS_"', '"NORM_"', '"INDENT_"']);
function b2Of(text) {
  for (let k = 0; k < text.length; k++) {
    const c = text.charCodeAt(k);
    if (c >= 0xd800 && c <= 0xdfff) throw new Error("サロゲートを作った");
  }
  const lineAt = (o) => o + 1;
  const rowAt = new WeakMap(), qAt = new WeakMap();
  let parsed;
  try {
    parsed = parser.parse(text, { rowAt, qAt });
  } catch (e) {
    const peg = !!e && typeof e === "object" && !!e.location && !!e.location.start;
    if (!peg) return null; // スタックの溢れなど。書かない
    return { err: { name: e.name, reason: null, line: lineAt(e.location.start.offset), message: String(e.message) } };
  }
  const row = (r) => ({ at: rowAt.get(r), line: lineAt(rowAt.get(r)), q: qAt.get(r) || [], w: r.map(word) });
  const word = (w) => {
    if (typeof w === "string") return w;
    if (!Array.isArray(w) || !TAGS.has(w[0])) throw new Error("知らない語");
    return { tag: w[0], rows: w[1].map(row) };
  };
  return { rows: parsed.map(row) };
}

const fd = fs.openSync(out, "w");
let id = 0, kinds = { rows: 0, err: 0, pegErr: 0, errorFn: 0, dropped: 0 };
const seen = new Set();
function emit(text) {
  if (seen.has(text)) return;
  seen.add(text);
  const b2 = b2Of(text);
  if (!b2) { kinds.dropped++; return; }
  if (b2.err) { kinds.err++; if (/^Expected /.test(b2.err.message)) kinds.pegErr++; else kinds.errorFn++; } else kinds.rows++;
  const lineAt = Array.from({ length: text.length + 1 }, (_, k) => k + 1);
  fs.writeSync(fd, JSON.stringify({ id: id++, source: text, b1: { text, lineAt }, b2, b3: null }) + "\n");
}

for (let k = 0; k < opt.n; k++) {
  const r = ri(10);
  if (r < 3) {
    let s = "";
    for (let j = 1 + ri(24); j > 0; j--) s += pick(ALPHA);
    emit(s);
  } else if (r < 5) emit(genProgram());
  else emit(mutate(genProgram(), 1 + ri(3)));
}
// gz の JSONL の行（LF だけで分ける。JSON.stringify は U+2028・U+2029 を字のまま書くので、それで分ける readline は使わない）。LF（0x0A）は
// UTF-8 の字の途中に来ないので、バイトで分けてから字にする。途中で止めれば（break）流れを閉じる。
async function* gzLines(file) {
  let parts = [];
  for await (const c of fs.createReadStream(file).pipe(zlib.createGunzip())) {
    let start = 0;
    for (let k = c.indexOf(10); k >= 0; k = c.indexOf(10, start)) {
      parts.push(c.subarray(start, k));
      yield Buffer.concat(parts).toString("utf8");
      parts = [];
      start = k + 1;
    }
    if (start < c.length) parts.push(c.subarray(start));
  }
  if (parts.length) yield Buffer.concat(parts).toString("utf8");
}
if (opt.stages && opt.real > 0) {
  let taken = 0;
  for await (const line of gzLines(opt.stages)) {
    if (taken >= opt.real) break;
    const i1 = line.indexOf(',"b1":'), i2 = line.indexOf(',"b2":');
    if (i1 < 0) continue; // 終わりの印の行
    const b1 = JSON.parse(line.slice(i1 + 6, i2));
    if (!b1.text || b1.text.length > 3000) continue;
    taken++;
    for (let m = 0; m < 3; m++) emit(mutate(b1.text, 1 + ri(3)));
  }
}
fs.writeSync(fd, JSON.stringify({ end: true, units: "utf16", lines: id, complete: true, stamp: STAMP }) + "\n");
fs.closeSync(fd);
console.log(JSON.stringify({ written: id, kinds }));
