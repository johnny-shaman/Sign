// node --stack-size=8000 rawfuzz.mjs [out.jsonl] [--n N] [--seed S] [--real K] [--mut P] [--mut-real-always] [--stages stages.jsonl.gz]
//   out と --stages は out/sem から解く（既定 peg_rawfuzz_stages.jsonl と stages.jsonl.gz）。
//   傷を付ける割合は (b) と (c) が P、(d) が P / 2。--mut-real-always は (c) にいつも傷を付ける（割合の乱数を引かない）。
// 前処理を通さない字の並び（text）を、alpha1 の peggy で作った parser（resolve.js と同じ peggy.generate）に当てて、stages と同じ形の行を書く：
//   {id, source:"", b1:{text, lineAt}, b2, b3:null}。最後に終わりの印の行 {end:true, units:"utf16", lines:N, complete:true, stamp:S}（N は書いた行の数、S は gen_front.mjs の
//   frontStamp()。dump.mjs の印から sources と gate を除いた形）。
// 位置（at・q・lineAt の添え字）は dump.mjs と同じく UTF-16 の符号単位の番号（peggy の offset）そのまま。lineAt は単位の位置ごとに違う値
// （lineAt(o) = o + 1、o は 0..text.length に切り詰める。gen/fuzz.mjs と同じ）で、行の値が位置そのものを確かめる（対の後ろの半分を指す
// 断りの位置も、前の半分と分かれる）。b2 の形は dump.mjs の b2Rows・errOf と同じ。
// 字の並びは4種：(a) 字の表からの乱れた並び（BMP の外の字・対にならないサロゲートも）、(b) 文法に沿って作った並びに傷、
// (c) stages の本物の b1.text に傷（--real K 本を頭から取る）、(d) 括りと `-` の先読みと |…| の入れ子を深めに組んだ並び。
import fs from "fs";
import zlib from "zlib";
import { StringDecoder } from "string_decoder";
import { PEGGY_URL, JS, frontStamp } from "../gen_front.mjs";
const STAMP = frontStamp(); // 走らせ始めの版（alpha1 の前段の file・peggy・道具・node・スタック）
import { outPath } from "./paths.mjs";

const peggy = (await import(PEGGY_URL)).default;
const parser = peggy.generate(fs.readFileSync(JS + "/sign.pegjs", "utf8"));

const args = process.argv.slice(2);
const out = outPath(args[0] && !args[0].startsWith("--") ? args.shift() : "peg_rawfuzz_stages.jsonl");
const opt = { n: 100000, seed: 5, real: 3000, mut: 0.6, mutRealAlways: false, stages: outPath("stages.jsonl.gz") };
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--n") opt.n = Number(args[++i]);
  else if (args[i] === "--seed") opt.seed = Number(args[++i]);
  else if (args[i] === "--real") opt.real = Number(args[++i]);
  else if (args[i] === "--mut") opt.mut = Number(args[++i]);
  else if (args[i] === "--mut-real-always") opt.mutRealAlways = true;
  else if (args[i] === "--stages") opt.stages = outPath(args[++i]);
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
const chance = (p) => rnd() < p;

const ASTRAL = ["\u{1F600}", "\u{10000}", "\u{1D11E}", "\u{20BB7}", "\u{10FFFF}"];
const LONE = ["\uD83D", "\uDE00", "\uDBFF", "\uDC00"];
const ALPHA = [" ", " ", " ", " ", "\r", "\r", "\x02", "\x03", "`", "[", "]", "{", "}", "(", ")", "|", "||", "\\", "-", ".", "x", "0", "1", "9", "a", "Z", "_",
  "u", "r", "b", "#", "##", "###", "~", "!", "!!", "$", "@", ":", "?", "+", "\n", "\t", "\x00", "\x1f", "\x7f", "\x85", "\x9f", "\xa0", "\"", "'", ",", ";",
  "=", "^", "%", "&", "/", "*", "<", ">", "f", "A", "F", "G", "é", "あ", "\u2028", "\ufeff", "\ufffd", ...ASTRAL, ...LONE];

function atom() {
  switch (ri(12)) {
    case 0: return "`" + pick(["", "ab", "x y", "é", ":", "\u{1F600}", "\uD83D", "|", "["]) + "`";
    case 1: return "\\" + pick(["a", " ", "n", "\n", "`", "\\", "\u{1F600}", "\uDE00", "\r", "\x03"]);
    case 2: return ri(100) + "x" + pick(["0", "ff", "A1", "", "g"]);
    case 3: return pick(["0r", "0b"]) + pick(["1", "01", "ff", "2", ""]);
    case 4: return ri(200) + "u" + pick(["41", "3042", "g", ""]);
    case 5: return pick(["", "-"]) + ri(1000) + pick(["", ".", ".5", ".25"]);
    case 6: return pick(["x", "inc", "add", "Foo_1", "a9"]);
    case 7: return pick(["_x", "__", "_1", "_", "_ab"]);
    default: return pick(["x", "y", "1", "2", "_", "f"]);
  }
}
function term(d) {
  if (ri(6) === 0) return pick([":", "?", "+", "-", "*", "==", "!==", "|", "||", "&", ";", ",", "#", "@", "'", "<", ">=", "~", "$", "!", "?", "\""]);
  let pre = "";
  for (let k = ri(4) === 0 ? 1 + ri(2) : 0; k > 0; k--) pre += pick(["###", "##", "#", "-", "-", "~", "!!", "!", "$", "@"]);
  const core = d > 0 && ri(3) === 0 ? block(d - 1) : atom();
  let post = "";
  for (let k = ri(5) === 0 ? 1 + ri(2) : 0; k > 0; k--) post += pick(["!", "~", "@"]);
  return pre + core + post;
}
function expr(d) {
  let s = term(d);
  for (let k = ri(5); k > 0; k--) s += (ri(8) === 0 ? pick(["  ", "", "\x02"]) : " ") + term(d);
  return s;
}
function exprs(d) {
  let s = expr(d);
  for (let k = ri(3) === 0 ? 1 + ri(2) : 0; k > 0; k--) s += "\r" + (ri(3) === 0 ? pick([" ", "  "]) : "") + expr(d);
  return s;
}
function block(d) {
  const e = () => (ri(3) === 0 ? pick([" ", "\r", " \r "]) : "");
  switch (ri(9)) {
    case 0: return "[" + e() + exprs(d) + e() + "]";
    case 1: return "{" + e() + exprs(d) + e() + "}";
    case 2: return "(" + e() + exprs(d) + e() + ")";
    case 3: return pick(["[]", "{}", "()", "[ ]", "{\r}", "( \r )"]);
    case 4: return "||" + exprs(d) + "||";
    case 5: return "|" + exprs(d) + "|";
    case 6: return "\x02" + pick(["", " "]) + exprs(d) + pick(["", " "]) + "\x03";
    case 7: return "-" + block(Math.max(0, d - 1));
    default: return "|" + pick(["a : 1", "b", "[c : 2] ' c", "x ? y"]) + "|";
  }
}
function lineOf(d) {
  if (ri(7) === 0) return "`" + pick(["c", "", "a b", "\u{1F600}"]) + pick(["`", "`x", "` y", "`@", "`~", "", "`!"]) + pick(["", " z", "\n", "`"]);
  return pick(["", " ", "  "]) + exprs(d) + pick(["", " ", "  "]);
}
function program() {
  let s = lineOf(2);
  for (let k = ri(4); k > 0; k--) s += pick(["\r", "\r", "\r\r", "\n"]) + lineOf(2);
  return s;
}
function mutate(s) {
  const ops = 1 + ri(3);
  for (let k = 0; k < ops; k++) {
    const p = ri(s.length + 1);
    switch (ri(4)) {
      case 0: s = s.slice(0, p) + pick(ALPHA) + s.slice(p); break;
      case 1: s = s.slice(0, p) + s.slice(p + 1 + ri(2)); break;
      case 2: s = s.slice(0, p) + pick(ALPHA) + s.slice(p + 1); break;
      default: s = s.slice(0, p) + pick(ASTRAL) + s.slice(p); break;
    }
  }
  return s;
}
function deep() {
  // 括り・`-` の先読み・|…|・||…|| の入れ子（error() が深い所で出る物も）
  const d = 3 + ri(6);
  let s = "";
  const stack = [];
  for (let k = 0; k < d; k++) {
    const o = pick(["[", "(", "{", "|", "||", "-[", "-|", "-||", "\x02", "-(", "["]);
    s += o + pick(["", " ", "a ", "a : ", "1 ", "\r"]);
    stack.push(o);
  }
  if (chance(0.5)) s += pick(["x : 1", "y", "_", ":", "?", "\u{1F600}"]);
  while (stack.length) {
    const o = stack.pop();
    const c = o.endsWith("||") ? "||" : o.endsWith("|") ? "|" : o.endsWith("[") ? "]" : o.endsWith("(") ? ")" : o.endsWith("{") ? "}" : "\x03";
    s += pick(["", " ", "\r"]) + (chance(0.92) ? c : pick(["", "]", "|", ")"])) + pick(["", " ", " b", "!", ""]);
  }
  return s;
}

// (c) の本物の text
const real = [];
if (opt.real > 0) {
  const gz = fs.readFileSync(opt.stages);
  // 頭の塊だけほどく（全部はほどかない）
  const z = zlib.createGunzip();
  const dec = new StringDecoder("utf8"); // 塊の境で割れた字を繋ぐ
  let buf = "";
  await new Promise((resolve) => {
    z.on("data", (c) => {
      buf += dec.write(c);
      const parts = buf.split("\n");
      buf = parts.pop();
      for (const l of parts) {
        if (real.length >= opt.real) break;
        const i1 = l.indexOf(',"b1":'), i2 = l.indexOf(',"b2":', i1);
        if (i1 < 0) continue; // 終わりの印の行
        const b1 = JSON.parse(l.slice(i1 + 6, i2));
        if (b1.text !== undefined && b1.text.length < 2000) real.push(b1.text);
      }
      if (real.length >= opt.real) { z.destroy(); resolve(); }
    });
    z.on("end", resolve);
    z.on("close", resolve);
    z.end(gz);
  });
}

// 位置 o が対の後ろの半分（上の半分の直後の下の半分）を指すか
const midPair = (text, o) => o > 0 && o < text.length && (text.charCodeAt(o - 1) & 0xfc00) === 0xd800 && (text.charCodeAt(o) & 0xfc00) === 0xdc00;
const TAGS = new Set(['"BRACKET_"', '"ABS_"', '"NORM_"', '"INDENT_"']);
function b2Rows(rows, rowAt, qAt, lineAt) {
  const row = (r) => {
    const o = rowAt.get(r);
    return { at: o, line: lineAt(o), q: qAt.get(r) || [], w: r.map(word) };
  };
  const word = (w) => {
    if (typeof w === "string") return w;
    if (!Array.isArray(w) || !TAGS.has(w[0]) || !Array.isArray(w[1])) throw new Error("語の形");
    return { tag: w[0], rows: w[1].map(row) };
  };
  return rows.map(row);
}

// 書く文を UTF-8 のバイトに（JSON.stringify は対の無いサロゲートを escape で書く。字のままの物があれば、UTF-8 で U+FFFD に替わるので止める）
const utf8Of = (s) => {
  if (!s.isWellFormed()) throw new Error("書く行に字のままの対の無いサロゲートがある");
  return Buffer.from(s, "utf8");
};
const fd = fs.openSync(out, "w");
const C = { n: 0, rows: 0, err: 0, errorCall: 0, astral: 0, lone: 0, midPairErr: 0, kinds: { a: 0, b: 0, c: 0, d: 0 } };
const seen = new Set();
let tries = 0;
while (C.n < opt.n && tries < opt.n * 5) {
  tries++;
  const kind = ri(10);
  let text, kd;
  if (kind < 2) { kd = "a"; text = ""; for (let k = ri(25); k > 0; k--) text += pick(ALPHA); }
  else if (kind < 6) { kd = "b"; text = program(); if (chance(opt.mut)) text = mutate(text); }
  else if (kind < 8 && real.length) { kd = "c"; text = opt.mutRealAlways || chance(opt.mut) ? mutate(pick(real)) : pick(real); }
  else { kd = "d"; text = deep(); if (chance(opt.mut / 2)) text = mutate(text); }
  if (seen.has(text)) continue;
  seen.add(text);
  const lineAt = (o) => Math.max(0, Math.min(o, text.length)) + 1;
  const la = Array.from({ length: text.length + 1 }, (_, k) => k + 1);
  const rowAt = new WeakMap(), qAt = new WeakMap();
  let b2;
  try {
    const parsed = parser.parse(text, { rowAt, qAt });
    b2 = { rows: b2Rows(parsed, rowAt, qAt, lineAt) };
    C.rows++;
  } catch (e) {
    if (!(e && e.location)) throw e;
    const o = e.location.start.offset;
    if (midPair(text, o)) C.midPairErr++;
    b2 = { err: { name: e.name, reason: null, line: lineAt(o), message: String(e.message) } };
    C.err++;
    if (!e.expected) C.errorCall++;
  }
  if (/[\uD800-\uDFFF]/.test(text)) {
    if (/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(text)) C.astral++;
    if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text)) C.lone++;
  }
  C.kinds[kd]++;
  fs.writeSync(fd, utf8Of(JSON.stringify({ id: C.n, source: "", b1: { text, lineAt: la }, b2, b3: null }) + "\n"));
  C.n++;
}
fs.writeSync(fd, utf8Of(JSON.stringify({ end: true, units: "utf16", lines: C.n, complete: true, stamp: STAMP }) + "\n"));
fs.closeSync(fd);
console.log(JSON.stringify(C));
