// lex の点検（lex-review）で足す源。node gen_lexrev.mjs [out の dir]（既定 out/sem、相対の道は out/sem から解く）
//   lexrev_hand.jsonl   ：手で書いた枝の例（JS の被覆で 0 回だった枝・境目の字・BMP の外の字）
//   lexrev_chars.jsonl  ：字の並びの総当たり（2つの字の組で、長さ 5 まで・長さ 4 まで）
//   lexrev_lines.jsonl  ：行の型の総当たり（TAB の数 × 行の中身、3行まで）
//   lexrev_frames.jsonl ：括りの中の `?` の行（R135）の形の総当たりと乱数
import fs from "fs";
import path from "path";
import { outPath } from "./paths.mjs";
const outDir = outPath(process.argv[2] || ".");
const write = (name, from, list) => {
  const seen = new Set();
  const rows = [];
  for (const s of list) {
    if (seen.has(s)) continue;
    seen.add(s);
    rows.push(JSON.stringify({ id: rows.length, from, source: s }));
  }
  fs.writeFileSync(path.join(outDir, name), rows.join("\n") + "\n");
  console.log(`${name}: ${rows.length}`);
};

// ---- 手で書いた例 ----
const E = "\u{1F600}";
const hand = [
  // questionBeforeBracket の `\` の枝（:447）と、`?` の数え方
  "s : \\a [m :\n\t\ty\n\t? y\n]",
  "s : \\? [m :\n\t\ty\n\t? y\n]",
  "s : x \\a ? [m :\n\t\ty\n\t? y\n]",
  "s : \\[ [m :\n\t\ty\n\t? y\n]",
  "s : \\\\ ? [m :\n\t\ty\n\t? y\n]",
  "s : ? \\] [m :\n\t\ty\n\t? y\n]",
  "s : (a ?) [m :\n\t\ty\n\t? y\n]",
  "s : ] ? [m :\n\t\ty\n\t? y\n]",
  "s : ? ] [m :\n\t\ty\n\t? y\n]",
  "s : ( ? [m :\n\t\ty\n\t? y\n]",
  "s : \"?\" [m :\n\t\ty\n\t? y\n]",
  "s : `?` [m :\n\t\ty\n\t? y\n]",
  "s : `a` \\? ? [m :\n\t\ty\n\t? y\n]",
  "s : x ? \\\n [m :\n\t\ty\n\t? y\n]",
  // choose の note があって1行の案が無い枝（:489）
  "f : x ?\n\tx : [\n\t\t\ty : 1\n\t\t? y\n\t]\n",
  "f : x ?\n\tx : [\n\t\t\ty\n\t\t?\n\t]\n",
  "f : x ?\n\tx : $[\n\t\t\ty : 1\n\t\t? y\n\t]\n",
  "f :\n\t\tx :\n\t\t\t\ty : [\n\t\t\t\t\t\tz : 1\n\t\t\t\t\t? z\n\t\t\t\t]\n\t? x\n",
  "f :\n\t\tx :\n\t\t\ty : [\n\t\t\t\t\tz : 1\n\t\t\t\t? z\n\t\t\t]\n\t? x\n",
  "f : x ?\n\tx : [\n\t\t\ty : 1\n\t\t?\n\t]\n",
  // BMP の外の字（JS は UTF-16 で数え、ここは符号位置で数える）
  `x : ${E} + 1`,
  `x : \`${E}\` + 1\ny : 2`,
  `x : "${E}\\${E}" + 1`,
  `\\${E}`,
  `a\\${E}`,
  `x : ${E}\n\t5`,
  `s : [m :\n\t\t${E}\n\t? ${E}\n]`,
  `f : [\n\t\t${E} : 1\n\t? ${E}\n]`,
  `f : [\n\t\t${E}\n\t? ${E} + 1\n]`,
  `${E} :\n\t1\n${E}`,
  `x : "${E}" ?\n\t${E}${E} + 1\n`,
  `\`${E} comment\`\nx : 1 + ${E}`,
  `x : 1 +\n ${E} + 2\n\t?3`,
  `x : \`${E}\ny`,
  ` ${E}`,
  `x : ${E}${E}${E}\\\n\t${E} : ${E}`,
  `f :\n\t\t${E}\n\t? ${E}`,
  `f :\n\t\t${E}\n\t\t? ${E}`,
  `x : [${E}\n\t? ${E}\n]`,
  `x : ${E}\n\n\t${E}`,
  `${E}\n\t${E}`,
  `x : "${E}\\"" + "${E}"`,
  `x : "\\${E}" + 1`,
  `x : ${E}!!${E}!==${E}`,
  `f : x ?\n\tx : [\n\t\t\t${E} : 1\n\t\t? ${E}\n\t]\n`,
  `|${E}| :\n\t1\ny`,
  `x : [\n\t${E}\n] ? ${E}`,
  `${E}${E} : ${E} ? ${E}\n\t${E}\n\n${E} 1`,
  // 控えの字（\x02・\x03）と BOM
  "x : 1\x02 + 2",
  "x : \x03\n\t1",
  "\x02x\n\x03y",
  "\ufeffx : 1",
  "\ufeff x",
  // `\` と改行の境目
  "x : 1 \\\n",
  "x : 1 \\\r\n",
  "x : 1 \\\r",
  "x :\\\n\t\t1",
  "x\\\n\n y",
  "\\\n x",
  "\\\n\tx\n\ty",
  "x : [\\\n\t? y\n]",
  "x :\n\t1 \\\n\t\t+ 2\n\ny",
  "x :\n\t1 \\\n\n\ty",
  "`c`\\\nx",
  "x\n`c`\\\n y",
  "x : \"a\\\nb\" + 1",
  "x : \"a\\\r\nb\" + 1",
  "x : `a\\\nb` + 1",
  // Object.prototype の名前（TypeError）
  ...["hasOwnProperty", "isPrototypeOf", "__lookupGetter__", "__lookupSetter__", "propertyIsEnumerable", "toLocaleString",
    "__defineSetter__", "__defineGetter__", "length", "prototype", "hasOwn", "__proto__x", "valueOf "].map((w) => `x : ${w}\n\t5`),
  "x : 1 ?toString\n\t5",
  "x : [\n\ttoString\n\t\t5\n]",
  "toString :\n\t5",
  "x : a toString \n\t5",
  // trimEnd が空白と見る字・見ない字
  ...["\t", "\u3000", "\u00a0", "\u2028", "\u2029", "\ufeff", "\u180e", "\u200b", "\u0085", "\u000b", "\u000c", "\u001c", "\u001f",
    "\u1680", "\u2000", "\u200a", "\u202f", "\u205f", "\u00ad"].map((c) => `x : +${c}\n\t5`),
  ...["\u3000", "\u0085", "\u001c", "\u2028"].map((c) => `f : [\n\tx\n${c}\n\t? x\n]`),
  ...["\u3000", "\u0085", "\u001c", "\u00a0"].map((c) => `f : [${c}\n\t\tx\n\t? x\n]`),
  ...["\u3000", "\u0085", "\u001c"].map((c) => `f : [\n\t\tx\n\t? ${c}x${c}\n]`),
  // JSON.stringify の戻し方
  " \x00\x01\x08\x09\x0a\x0c\x0d\x1f\x7f\u2028\u2029\"\\\ud7ff\ue000\uffff",
  " \x00\x01\x08\x09\x0c\x1f\x7f\u2028\u2029\"\\\ud7ff\ue000\uffff",
  "x\n\n \x00\x1b\x7f",
  "x : `\x00\x1b\"\\",
  // quoted（空白の重なりと LF）
  "x : a  b\\\nc\n\t5",
  "x : a   b\\\n\\\nc\n\t5",
  "x :\n\t1\ny  z\\\n w",
  // hasTopLevelDefine の境目
  "a \"x :\n\t1\ny",
  "a `x :\n\t1\ny",
  "||a|| : b\n\t1\ny",
  "|a :| :\n\t1\ny",
  "| : a\n\t1\ny",
  "|||a : b\n\t1\ny",
  "a| : b\n\t1\ny",
  "|a| |b : c\n\t1\ny",
  "a \\: b +\n\t1\ny",
  "a `:` :\n\t1\ny",
  "a \":\" :\n\t1\ny",
  "[a : b] :\n\t1\ny",
  "(a : b) +\n\t1\ny",
  "a : b ] +\n\t1\ny",
  "] a : b +\n\t1\ny",
  "a ] : b\n\t1\ny",
  "x:\n\t1\ny",
  "x :: y\n\t1\ny",
  "x\\\n: y\n\t1\ny",
  // separateInfix の正規表現
  "a!!!b", "a!!!=b", "a!!==b", "\"a\\\"", "\"\\\"", "``x", "`x``y`", "x`y", "a\\", "\\\\", "a\\\\:b", "a ~+~- b", "a=:=b",
  "<<<", ">>=", "a;;;b", "&&&", "a===b==c", "x\\n y", "a====b", "a!===b", "a!!!!b", "\"\"\"", "\"a\"b\"", "\"\\\\\"\\\"",
  "\"a\\\u2028\\\"\"", "\"a\\\u2029\"", "\"\\\u2028\"\"", "a'b'c", "a\\'b", "\"a:b\":c", "`a:b`:c", "a\\\"b\"c",
];
write("lexrev_hand.jsonl", "lexrev_hand", hand);

// ---- 字の並びの総当たり ----
const chars = [];
function allStrings(alpha, maxLen, out) {
  const rec = (s, k) => {
    if (s.length > 0) out.push(s);
    if (k === maxLen) return;
    for (const c of alpha) rec(s + c, k + 1);
  };
  rec("", 0);
}
allStrings(["\n", "\t", " ", "?", ":", "[", "]", "x", "`", "\"", "\\", "|", "\r"], 5, chars);
allStrings(["!", "=", "~", "+", "-", "#", "'", "x", " ", "\"", "\\", "`", "\u2028", "\n", ":"], 4, chars);
write("lexrev_chars.jsonl", "lexrev_chars", chars);

// ---- 行の型の総当たり ----
const bodies = ["x", "f :", "x : 1", "? x", " x", " ? x", "x +", "x ?", "[", "]", "x [", "] x", "m :", "`c`", "", "x : [", "] ? x",
  "toString", "|a| :", "x \\", "?"];
const lineChoices = [];
for (const b of bodies) for (let t = 0; t <= 3; t++) {
  if (b === "" && t > 1) continue;
  lineChoices.push("\t".repeat(t) + b);
}
const lines = [];
for (const a of lineChoices) {
  lines.push(a);
  for (const b of lineChoices) {
    lines.push(a + "\n" + b);
    for (const c of lineChoices) lines.push(a + "\n" + b + "\n" + c);
  }
}
write("lexrev_lines.jsonl", "lexrev_lines", lines);

// ---- 括りの中の `?` の行 ----
let seed = 20261124;
const rnd = () => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 4294967296;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ctx = [[], ["f : x ?"], ["s :"], ["f :", "\t\tx :"], ["f :", "\t\tx :", "\t\t\ty :"], ["f :", "\t\tx :", "\t\t\t\ty :"], ["x :"], ["\tm :"]];
const heads = ["f : [", "s : [m :", "x : $[", "f : x ? [", "f [", "[", "f : [a [", "#g : [", "f :  [", "m : (", "f : `a?` [",
  "f : \\? [", "f : x \\a ? [m :", "m : [", "x : [y", "f : [ ]  [", "f : ( [", "f : [x (", "f : {"];
const rowsC = ["x", "y : 1", "m :", "[", "]", "a ]", "(b", "c)", "x  y", " z", "n :", "]]", "w : [", "`s` \"t\"", "\\[", ""];
const qs = ["? x", "?", " ? x", "? x ]", "? ] x", "?  x  +  y", "? x\t", "?x"];
const frames = [];
for (const h of heads) for (const r of rowsC) for (const q of qs) for (const tr of [1, 2]) for (const tq of [0, 1]) {
  frames.push([h, "\t".repeat(tr) + r, "\t".repeat(tq) + q, "]"].join("\n"));
}
for (let n = 0; n < 60000; n++) {
  const c = pick(ctx);
  const base = c.length ? c[c.length - 1].match(/^\t*/)[0].length + 1 : 0;
  const ls = [...c];
  const k = Math.max(0, base + Math.floor(rnd() * 3) - 1);
  ls.push("\t".repeat(k) + pick(heads));
  const nr = Math.floor(rnd() * 4);
  for (let i = 0; i < nr; i++) ls.push("\t".repeat(k + Math.floor(rnd() * 4)) + pick(rowsC));
  ls.push("\t".repeat(k + Math.floor(rnd() * 3)) + pick(qs));
  if (rnd() < 0.7) ls.push("\t".repeat(k) + "]");
  frames.push(ls.join(rnd() < 0.9 ? "\n" : "\r\n"));
}
write("lexrev_frames.jsonl", "lexrev_frames", frames);
