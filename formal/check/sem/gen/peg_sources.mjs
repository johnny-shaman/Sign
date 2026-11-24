// peg（文法）の受け持ちの手書きの源を formal/check/out/sem/peg_sources.jsonl に書く（dump.mjs --sources peg_sources.jsonl で JS の答えを作る）。
import fs from "fs";
import { outPath } from "./paths.mjs";
const srcs = [
  "x : -|y : 1|",
  "a : 1\nb : ||c : 2|| + 1",
  "x : [1 2",
  "x : 1 ]",
  "f : (a",
  "x : |a|b",
  "x : 1\n\u001f",
  "x : \\",
  "x : 0x",
  "y : -",
  "y : - 1",
  "y : -_ 1",
  "y : -[1] 2",
  "y : -|1| 2",
  "z : 1 ?",
  "k : 0b102",
  "k : 0r1g",
  "k : 12u",
  "s : `ab` `cd`",
  "`a` b\nx : 1",
  "`note` x\nx : 2",
  "q : x ? x + 1 ? 2",
  "n : [\n\t1\n\t2\n]",
  "p : {1 , 2}",
  "e : ()",
  "e : [ ]",
  "u : _x __ _",
  "w : ###a ##b #c ~d !!e !f $g @h",
  "v : a! b~ c@ d!~@",
  "m : |[x : 1] ' x|",
  "m : ||[1 2 3]||",
  "m : |||1|||",
  "r : 1 é 2",
  "t : x\u00a0y",
  "x : 1\n\ny : [2\n",
  "f : x ?\n\tx > 0 : |x : 1|\n\t0",
];
const out = outPath("peg_sources.jsonl");
fs.writeFileSync(out, srcs.map((s, id) => JSON.stringify({ id, from: "peg-hand", source: s })).join("\n") + "\n");
console.log(srcs.length);
