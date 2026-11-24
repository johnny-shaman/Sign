// node gen_src.mjs <name> <n> <seed> [--astral]：前処理を通る形の乱れた源を formal/check/out/sem/<name>_sources.jsonl に書く（1行 {id, from, source}）。
// 文法の規則に沿った断片（語・数・番地・文字列・"…"・文字・前置・後置・中置・括り・|…|・||…||・字下げ・行頭のコメント・`\` + 改行・空行）に、
// 制御の字・空白の連なり・閉じ忘れ・余った閉じなどの傷を混ぜる。--astral なら BMP の外の字も混ぜる。
import fs from "fs";
import { outPath } from "./paths.mjs";

const [name, nStr, seedStr, flag] = process.argv.slice(2);
const N = Number(nStr), ASTRAL = flag === "--astral";
let st = Number(seedStr) >>> 0 || 7;
const rnd = () => {
  st ^= st << 13; st >>>= 0;
  st ^= st >>> 17;
  st ^= st << 5; st >>>= 0;
  return st / 4294967296;
};
const ri = (n) => Math.floor(rnd() * n);
const pick = (a) => a[ri(a.length)];
let clean = false;
const chance = (p) => rnd() < p;
const noisy = (p) => !clean && rnd() < p;

const ODD = ["\x00", "\x01", "\x02", "\x03", "\t", "\x0b", "\x0c", "\x1f", "\x7f", "\x85", "\x9f", "\xa0", "\u2028", "\ufeff", "é", "あ", "…", '"', "'", "\\", "`", "%", "^", "&", "*", "=", "<", ">", "/", ";", ","];
const ASTRALS = ["\u{1F600}", "\u{10000}", "\u{1D11E}", "\u{20BB7}"];
const odd = () => (ASTRAL && chance(0.3) ? pick(ASTRALS) : pick(ODD));

function atom() {
  // clean の時は文法が通す形だけ（"…" は文法では演算子なので除く）
  const C = clean;
  switch (ri(16)) {
    case 0: return "`" + pick(["", "a", "x y", "[", "]", "|", ":", "\"", "é", ASTRAL ? pick(ASTRALS) : "b"]) + "`";
    case 1: return "\\" + pick(C ? ["a", "`", "\\", "[", "|", ":", "x"] : ["a", " ", "`", "\\", "[", "|", ":", "x", "\n", ASTRAL ? pick(ASTRALS) : "q"]);
    case 2: return ri(40) + "x" + pick(C ? ["0", "ff", "A1", "8f"] : ["0", "ff", "A1", "", "g", "8f"]);
    case 3: return pick(["0r", "0b"]) + pick(C ? ["1", "01", "10"] : ["1", "01", "ff", "2", "", "z", "10"]);
    case 4: return ri(300) + "u" + pick(C ? ["41", "3042", "000D"] : ["41", "3042", "000D", "g", ""]);
    case 5: return pick(["", "-", "-"]) + ri(1000) + pick(C ? ["", ".", ".5", ".25"] : ["", ".", ".5", ".25", ".0.1"]);
    case 6: return pick(["x", "inc", "add", "Foo_1", "a9", "f", "n", "xs"]);
    case 7: return pick(["_x", "__", "_1", "_", "_ab", "___"]);
    case 8: if (!C) return '"' + pick(["", "a", "`", "[", "x y"]) + (!noisy(0.2) ? '"' : "");
    default: return pick(["x", "y", "1", "2", "_", "f", "0", "3.14"]);
  }
}
const OPS = [":", "?", "+", "-", "*", "/", "==", "!==", "|", "||", "&", ";", ",", "#", "##", "###", "@", "'", "<", ">=", "~", "$", "!", "!!", "%", "^", "=", ":=", "->", "<>"];
function term(d) {
  if (chance(0.18)) return pick(OPS);
  let pre = "";
  if (chance(0.25)) for (let k = 1 + ri(2); k > 0; k--) pre += pick(["###", "##", "#", "-", "-", "~", "!!", "!", "$", "@"]);
  const core = d > 0 && chance(0.3) ? block(d - 1) : atom();
  let post = "";
  if (chance(0.15)) for (let k = 1 + ri(2); k > 0; k--) post += pick(["!", "~", "@"]);
  let t = pre + core + post;
  if (noisy(0.03)) t += odd();
  return t;
}
function expr(d) {
  let s = term(d);
  for (let k = ri(5); k > 0; k--) s += (chance(0.1) ? pick(clean ? ["  ", "   "] : ["  ", "   ", ""]) : " ") + term(d);
  if (chance(0.04)) s += pick([" ", "  ", "\t"]);
  return s;
}
function exprs(d) {
  let s = expr(d);
  for (let k = chance(0.3) ? 1 + ri(2) : 0; k > 0; k--) s += "\n" + (chance(0.3) ? pick([" ", "  ", "\t"]) : "") + expr(d);
  return s;
}
function block(d) {
  const e = () => (chance(0.25) ? pick([" ", "\n", " \n "]) : "");
  const close = (c) => (!noisy(0.07) ? c : pick(["", "]", ")", "}", "|"]));
  switch (ri(10)) {
    case 0: case 1: return "[" + e() + exprs(d) + e() + close("]");
    case 2: return "{" + e() + exprs(d) + e() + close("}");
    case 3: return "(" + e() + exprs(d) + e() + close(")");
    case 4: return pick(["[]", "{}", "()", "[ ]", "( )", "{\n}"]);
    case 5: return "||" + exprs(d) + close("||");
    case 6: case 7: return "|" + exprs(d) + close("|");
    case 8: return "\x02" + pick(["", " "]) + exprs(d) + pick(["", " "]) + (chance(0.9) ? "\x03" : "");
    default: return "[" + expr(d) + close("]");
  }
}
function line(d) {
  switch (ri(14)) {
    case 0: return "`" + pick(["c", "note", "", "a b"]) + "`" + pick(["", " x", "d", "@", "~ y", "! z", "`e`"]);
    case 1: return pick(["a", "f", "x"]) + " : " + expr(d) + "\n\t" + expr(d) + (chance(0.5) ? "\n\t" + expr(d) : "") + "\n";
    case 2: return pick(["f", "g"]) + " : x ?\n\t" + expr(d) + "\n\t" + expr(d) + "\n";
    case 3: return expr(d) + " \\\n" + pick(["", "\t", "  "]) + expr(d);
    case 4: return 'a " `" [ "` " b';
    default: return pick(["x", "y", "f", "_", "zs"]) + " : " + exprs(d);
  }
}
function source() {
  clean = chance(0.6);
  let s = line(2);
  for (let k = ri(4); k > 0; k--) s += pick(["\n", "\n", "\n\n", "\r\n", "\r"]) + line(2);
  if (noisy(0.05)) s = s.slice(0, ri(s.length + 1));
  if (noisy(0.05)) { const p = ri(s.length + 1); s = s.slice(0, p) + odd() + s.slice(p); }
  if (noisy(0.03)) { const p = ri(s.length + 1); s = s.slice(0, p) + s.slice(p + 1); }
  return s;
}
const seen = new Set();
const out = [];
while (out.length < N) {
  const s = source();
  if (seen.has(s)) continue;
  seen.add(s);
  out.push(JSON.stringify({ id: out.length, from: name, source: s }));
}
fs.writeFileSync(outPath(`${name}_sources.jsonl`), out.join("\n") + "\n");
console.log(out.length);
