// lex の受け持ちの、足りない枝の源を作る。手で書いた例と、乱数の例（字下げ・括り・引用符・改行の組み合わせ）。
// node gen_lex_sources.mjs [出力の .jsonl] [乱数の本数] [種]（出力は out/sem から解く。既定 lex_sources.jsonl）
import fs from "fs";
import { outPath } from "./paths.mjs";

const out = outPath(process.argv[2] || "lex_sources.jsonl");
const nRandom = Number(process.argv[3] || 20000);
let seed = Number(process.argv[4] || 12345);
const rnd = () => {
  // xorshift32
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 4294967296;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];

const T = "\t";
const hand = [
  // 行頭の空白（ファイルの先頭）
  " x",
  " x\ny",
  "\t x",
  // `?` の行の字下げの門の5つの言い分
  "f : x\n? x",
  "f : x\n\t? x",
  "\tf : x\n? x",
  "f : x\n\t\t? x",
  "f :\n\t\t\tx\n\t? x",
  "f :\n\t\t\tx\n\t\ty\n\t? x",
  "f :\n\t\tx\n\t\t? x",
  "f :\n\t\tx\n\t? x + 1\n",
  "f :\n\t\tx\n\t\ty : 3\n\t? x + y\n",
  "f :\n\tg :\n\t\t\tx\n\t\t? x\n",
  "f :\n\tg :\n\t\t\tx\n\t\t\t? x\n",
  "f :\n\t\tx\n\t ? x\n",
  "f : x\n ? x",
  // 閉じの後ろの `?`
  "f : [\n\tx\n] ? x",
  "f : [\n\tx\n\ty\n] ? x + y",
  "f : (\n\tx\n) ? x",
  // 括りの中の `?` の行（R135）の言い分の枝
  "f : [\n\t? x\n]",
  "f : [\n\t\tx\n\t? x\n]",
  "f : [\n\t\tx\n\t\ty\n\t? x + y\n]",
  "f : [x\n\t\ty\n\t? x + y\n]",
  "f : [\n\t\tx : 1\n\t? x\n]",
  "f : [\n\tm : x\n\t? x\n]",
  "s : [m :\n\t\ty\n\t? y\n]",
  "s : [m :\n\t\ty : 1\n\t? y\n]",
  "s : [m :\n\t\ty\n\t?\n]",
  "f : x ? [m :\n\t\ty\n\t? y\n]",
  "f : x ?\n\tx : [m :\n\t\t\ty\n\t\t? y\n\t]\n",
  "s :\n\tm : [\n\t\t\tx\n\t\t? x\n\t]\n",
  "s :\n\tm : [\n\t\t\tx : 2\n\t\t? x\n\t]\n",
  "f : x ?\n\tx : [\n\t\t\ty\n\t\t? y\n\t]\n",
  "f : x ?\n\tx : $[\n\t\t\ty\n\t\t? y\n\t]\n",
  "f :\n\t\tx :\n\t\t\t\ty : [\n\t\t\t\t\t\tz\n\t\t\t\t\t? z\n\t\t\t\t]\n\t? x\n",
  "f :\n\t\tx :\n\t\t\ty : [\n\t\t\t\t\tz\n\t\t\t\t? z\n\t\t\t]\n\t? x\n",
  "f [\n\tx\n\t? x\n]",
  "f [\n\tx\n\t?\n]",
  "f : [\n\t\tx\n\t ? x\n]",
  "f : [\n\t\tx\n   ? x\n]",
  "[\n\t[\n\t\ta\n\t\tb\n\t]\n\t? a\n]",
  "f : [a [\n\t\tb\n\t]\n\t? b\n]",
  "f : [a (b\n\t\tc)\n\t? c\n]",
  "f : [`s` \"t\" \\[\n\t\tx\n\t? x\n]",
  "f : [x  y\n\t\tz   w\n\t? x  +  y\n]",
  "#g : [\n\t\tx\n\t? x\n]",
  "##g : [\n\t\tx\n\t? x\n]",
  "g1_x : [\n\t\tx\n\t? x\n]",
  "f :  [\n\t\tx\n\t? x\n]",
  "f :[\n\t\tx\n\t? x\n]",
  "f : x ? [\n\t\ty\n\t? y\n]",
  "f : x ? (g [\n\t\ty\n\t? y\n])",
  "f : `a?` [\n\t\ty\n\t? y\n]",
  "f : [\n\t\tx\n\t\t[\n\t\t\ty\n\t\t]\n\t? x\n]",
  "f : [\n\t\tx (\n\t\t\ty\n\t\t)\n\t? x\n]",
  "f : [\n\t\tx (\n\t\t\ty\n\t\t) z\n\t? x\n]",
  // TypeError（Object.prototype の名前）
  "x : toString\n\t5",
  "x : __proto__\n\t5",
  "x : constructor\n\t5",
  "x : valueOf\n\t5\n",
  "toString\n\t5",
  "x : toStrin\n\t5",
  // 字下げのブロックと値
  "inc\n\t5",
  "x : 1 +\n\t2",
  "x : 1 -\n\t2",
  "x : $\n\t2",
  "x : !!\n\t2",
  "x : \\n\n\t2",
  "x : a  b   c\n\t\td  e",
  "x : |a|\n\t1\n\ny : 2",
  "x : [a : b]\n\t1\n\ny : 2",
  "x :\n\t1\ny : 2",
  "x :\n\t1\n`c`\ny : 2",
  "x :\n\t1\n\ny : 2",
  "|x : 1| :\n\t1\ny : 2",
  "x : |y| :\n\t1\ny : 2",
  "x |: 1\n\t2\ny",
  // 空行・コメント
  "x :\n\n\t1",
  "x\n\n y",
  "x\n`c`\n y",
  "x\n`c`\n\ty",
  "`c`\nx",
  "`c` x",
  "`c`@ x",
  "`c`! x",
  "`c`~ x",
  "`c`",
  "`c",
  "x : `abc\ny",
  "x : `abc\r\ny",
  "x : \"abc\ny",
  "x : \"a\\\"b\" + 1",
  "x : \"a\\\" + 1",
  "x : \"\\\"\" + 1",
  "x : \"a\\\\\" + \"b\"",
  "x : \"a\\\n\" + 1",
  "x : \"\u2028\" + 1",
  "x : \"a\\\u2028\" + 1",
  "x : \"a\\\u2028b\" + \"c\"",
  "x : \"a\\\\\\\" + \"b\\\" + c\"",
  "x : \"\\\\\\\\\\\\\\\\\" + 1",
  "x : \"\\\\\\\\\\\\\\\\ + 1",
  "a\\\n\tb",
  "a\\\r\n\t\tb",
  "a\\\rb",
  "a\\",
  "a \\",
  "!!=1",
  "a!!==b",
  "a!==b",
  "a===b",
  "a~+b~-c~*d~/e~^f",
  "a<=b>=c!=d<<e>>f;;g&&h",
  "a:b?c;d&e,f<g=h>i+j*k/l%m^n'o",
  "a||b|c#d@e-f~g$h",
  "x\r\ny\r\n\tz",
  "x :\r\n\t1\r\n\r\ny : 2",
  "x\ry\r\r\tz",
  "x : 1\u3000+ 2",
  "x : 1\u00a0+ 2",
  "日本 : 語 + 1\n\t2",
  "\u3000x",
  "x\n\u3000\ny",
  "x\n\t\n y",
  "x\n \ny",
  "f : x ?\n\tx > 0 : x\n\t-x\n",
  "f : [\n\tx\n\t]\n? x",
  "f : [\n\tx\n] y\n? x",
  "f : (x\n\t)\n\t? x",
  "a : [\n\t1\n\t2\n]\nb",
  "a : (\n\t1\n\t\t2\n)\nb",
  "]\n[\n\tx\n\t? x\n]",
  ")\n(\n\t? x\n)",
  "a ]]\n[[\n\t? x",
  "x\n\t\t\ty\n\tz\n\t\tw\n",
  "x :\n\t\t\ty\n\tz :\n\t\tw\n",
  "x :\n\ty :\n\t\tz :\n\t\t\tw\n\ta\nb",
  "x :\n\ty :\n\t\tz :\n\t\t\tw\n\na\n\nb",
];

const rows = [];
let id = 0;
for (const s of hand) rows.push({ id: id++, from: "lex_hand", source: s });

// 乱数の行の組み立て
const atoms = ["x", "y", "f", "g", "1", "2", "m", "toString", "_", "!_", "$x", "@y", "~x", "x~", "-x", "|x|", "||x||",
  "[x]", "(y)", "{z}", "`s`", "\"t\"", "\\a", "\\", "!!", "日", "\u3000", "\u2028"];
const ops = [":", "?", "+", "-", "*", "==", "!=", "!==", "===", "|", "||", "&", "&&", ";", ";;", ",", "~", "~+", "'", "@", "#", "$", "!", "<", ">", "<=", ">=", "<<", ">>", "^", "%", "/", "=", "\\n"];
const pieces = ["[", "]", "(", ")", "{", "}", "`", "\"", "\\", " ", "  ", "?", ":", "|", "#", "!", "\t"];
function randLine() {
  const n = 1 + Math.floor(rnd() * 6);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const r = rnd();
    if (r < 0.45) parts.push(pick(atoms));
    else if (r < 0.8) parts.push(pick(ops));
    else parts.push(pick(pieces));
  }
  const sep = rnd() < 0.8 ? " " : "";
  let s = parts.join(sep);
  if (rnd() < 0.15) s = s.replace(/ /g, "");
  return s;
}
function randSource() {
  const nLines = 1 + Math.floor(rnd() * 8);
  const lines = [];
  for (let i = 0; i < nLines; i++) {
    const r = rnd();
    if (r < 0.08) { lines.push(""); continue; }
    if (r < 0.12) { lines.push("`" + pick(["c", "note", "c` x", "c`@", "a?b"]) ); continue; }
    const depth = Math.floor(rnd() * rnd() * 5);
    let lead = T.repeat(depth);
    const q = rnd();
    if (q < 0.12) lead += " ";
    else if (q < 0.24) lead += "? ";
    else if (q < 0.28) lead += " ? ";
    lines.push(lead + randLine());
  }
  const nl = () => { const r = rnd(); return r < 0.9 ? "\n" : r < 0.95 ? "\r\n" : "\r"; };
  let s = "";
  for (let i = 0; i < lines.length; i++) {
    s += lines[i];
    if (i < lines.length - 1) s += (rnd() < 0.05 ? "\\" : "") + nl();
  }
  if (rnd() < 0.1) s += "\n";
  return s;
}
const seen = new Set(hand);
let made = 0;
while (made < nRandom) {
  const s = randSource();
  if (seen.has(s)) continue;
  seen.add(s);
  rows.push({ id: id++, from: "lex_random", source: s });
  made++;
}
fs.writeFileSync(out, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`${rows.length} 本（手 ${hand.length}・乱数 ${made}）を ${out} に書いた`);
