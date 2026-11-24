// BMP の外の字の源（lex-review）。node gen_lexrev_astral.mjs [out の dir]（既定 out/sem、相対の道は out/sem から解く。gen_lexrev.mjs の後に）
//   lexrev_astral.jsonl：lexrev_chars の1つ目の字の組の `x` を U+1F600 に替えた総当たり（長さ 5 まで）と、
//   lexrev_lines・lexrev_frames の `x`・`y` を U+1F600・U+20000 に替えた物。JS は UTF-16 で数え、Lean は符号位置で数える所を当てる。
import fs from "fs";
import path from "path";
import { outPath } from "./paths.mjs";
const outDir = outPath(process.argv[2] || ".");
const A = "\u{1F600}", B = "\u{20000}";
const out = [];
const seen = new Set();
const add = (s) => {
  if (seen.has(s)) return;
  seen.add(s);
  out.push(s);
};
const rec = (alpha, s, k, maxLen) => {
  if (s.length > 0) add(s);
  if (k === maxLen) return;
  for (const c of alpha) rec(alpha, s + c, k + 1, maxLen);
};
rec(["\n", "\t", " ", "?", ":", "[", "]", A, "`", "\"", "\\", "|", "\r"], "", 0, 5);
for (const f of ["lexrev_lines.jsonl", "lexrev_frames.jsonl"]) {
  for (const l of fs.readFileSync(path.join(outDir, f), "utf8").split("\n")) {
    if (!l) continue;
    const { source } = JSON.parse(l);
    if (!/[xy]/.test(source)) continue;
    add(source.replace(/x/g, A).replace(/y/g, B));
  }
}
fs.writeFileSync(path.join(outDir, "lexrev_astral.jsonl"), out.map((s, id) => JSON.stringify({ id, from: "lexrev_astral", source: s })).join("\n") + "\n");
console.log(`lexrev_astral.jsonl: ${out.length}`);
