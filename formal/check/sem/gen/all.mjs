// node formal/check/sem/gen/all.mjs [--only 名前,名前…]（リポジトリの頭で。node v24.16.0 で確かめた）
// 揺さぶりの源の集まりと、前処理を通さない text の stages を、下の引数で1本ずつ順に作り、out/sem に書く。終わりに出力ごとの行の数と sha1 を出す。
// 前に要る物：out/sem/stages.jsonl.gz（record.mjs の後に dump.mjs --out stages.jsonl.gz で作る）。fuzz・rawfuzz がその頭の b1.text を種に使う。
// treerev_fuzz・fuzz・rawfuzz は alpha1 の前処理と文法（peggy）の答えで源を選ぶか書くので、alpha1 が変われば出力も変わる。
//
//   名前          道具と引数                                                              出力（out/sem）
//   lex           gen_lex_sources.mjs lex_sources.jsonl 30000 12345                     lex_sources.jsonl
//   lexrev        gen_lexrev.mjs                                                        lexrev_hand・lexrev_chars・lexrev_lines・lexrev_frames.jsonl
//   lexrev_astral gen_lexrev_astral.mjs（lexrev_lines・lexrev_frames を読む）           lexrev_astral.jsonl
//   peg           peg_sources.mjs                                                       peg_sources.jsonl
//   pegrev        pegrev_sources.mjs                                                    pegrev_sources.jsonl・pegrev_astral_sources.jsonl
//   pegrev_rand   gen_src.mjs pegrev_rand 40000 11                                      pegrev_rand_sources.jsonl
//   pegrev_randastral gen_src.mjs pegrev_randastral 10000 23 --astral                   pegrev_randastral_sources.jsonl
//   tree          tree_src.mjs                                                          tree_sources.jsonl
//   treerev       treerev_src.mjs                                                       treerev_sources.jsonl
//   treerev_fuzz  treerev_fuzz.mjs treerev_fuzz_sources.jsonl 30000 7                   treerev_fuzz_sources.jsonl
//   treerev_fuzz2 treerev_fuzz.mjs treerev_fuzz2_sources.jsonl 60000 99 2               treerev_fuzz2_sources.jsonl
//   treerev_big   treerev_big.mjs                                                       treerev_big_sources.jsonl
//   fuzz          fuzz.mjs peg_fuzz_stages.jsonl --n 100000 --seed 7 --real 20000       peg_fuzz_stages.jsonl
//   rawfuzz       rawfuzz.mjs peg_rawfuzz_stages.jsonl --n 150000 --seed 5 --real 3000 --mut-real-always   peg_rawfuzz_stages.jsonl
//   rawfuzz2      rawfuzz.mjs peg_rawfuzz2_stages.jsonl --n 100000 --seed 99 --real 5000 --mut 0.1   peg_rawfuzz2_stages.jsonl
//
// *_sources.jsonl と lexrev*.jsonl は1行 {id, from, source}。JS の答えは dump.mjs --sources <源の集まり> --out <集まり>_stages.jsonl.gz で作る（組は gate.mjs の SETS。gate.mjs --dump が全部を書く）。
// peg_*_stages.jsonl は stages と同じ形の行（b3 は null）で、最後の行は終わりの印 {end:true, lines:N, complete:true, stamp:S}（S は gen_front.mjs の frontStamp()）。
// treerev_fuzz・fuzz・rawfuzz は gen_front.mjs の STACK_ARG（--stack-size=8000）で走らせる（スタックの溢れで落とす源が、スタックの大きさで変わるため。fuzz・rawfuzz は版の印の stack にそれを書く）。
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { OUT } from "./paths.mjs";
import { STACK_ARG } from "../gen_front.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STACK = [STACK_ARG];
const steps = [
  ["lex", [], "gen_lex_sources.mjs", ["lex_sources.jsonl", "30000", "12345"], ["lex_sources.jsonl"]],
  ["lexrev", [], "gen_lexrev.mjs", [], ["lexrev_hand.jsonl", "lexrev_chars.jsonl", "lexrev_lines.jsonl", "lexrev_frames.jsonl"]],
  ["lexrev_astral", [], "gen_lexrev_astral.mjs", [], ["lexrev_astral.jsonl"]],
  ["peg", [], "peg_sources.mjs", [], ["peg_sources.jsonl"]],
  ["pegrev", [], "pegrev_sources.mjs", [], ["pegrev_sources.jsonl", "pegrev_astral_sources.jsonl"]],
  ["pegrev_rand", [], "gen_src.mjs", ["pegrev_rand", "40000", "11"], ["pegrev_rand_sources.jsonl"]],
  ["pegrev_randastral", [], "gen_src.mjs", ["pegrev_randastral", "10000", "23", "--astral"], ["pegrev_randastral_sources.jsonl"]],
  ["tree", [], "tree_src.mjs", [], ["tree_sources.jsonl"]],
  ["treerev", [], "treerev_src.mjs", [], ["treerev_sources.jsonl"]],
  ["treerev_fuzz", STACK, "treerev_fuzz.mjs", ["treerev_fuzz_sources.jsonl", "30000", "7"], ["treerev_fuzz_sources.jsonl"]],
  ["treerev_fuzz2", STACK, "treerev_fuzz.mjs", ["treerev_fuzz2_sources.jsonl", "60000", "99", "2"], ["treerev_fuzz2_sources.jsonl"]],
  ["treerev_big", [], "treerev_big.mjs", [], ["treerev_big_sources.jsonl"]],
  ["fuzz", STACK, "fuzz.mjs", ["peg_fuzz_stages.jsonl", "--n", "100000", "--seed", "7", "--real", "20000"], ["peg_fuzz_stages.jsonl"]],
  ["rawfuzz", STACK, "rawfuzz.mjs", ["peg_rawfuzz_stages.jsonl", "--n", "150000", "--seed", "5", "--real", "3000", "--mut-real-always"], ["peg_rawfuzz_stages.jsonl"]],
  ["rawfuzz2", STACK, "rawfuzz.mjs", ["peg_rawfuzz2_stages.jsonl", "--n", "100000", "--seed", "99", "--real", "5000", "--mut", "0.1"], ["peg_rawfuzz2_stages.jsonl"]],
];

const args = process.argv.slice(2);
let only = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--only") only = new Set(args[++i].split(","));
  else throw new Error(`知らない引数 ${args[i]}`);
}
if (only) for (const n of only) if (!steps.some((s) => s[0] === n)) throw new Error(`知らない名前 ${n}`);
const todo = steps.filter((s) => !only || only.has(s[0]));
if (todo.some((s) => s[2] === "fuzz.mjs" || s[2] === "rawfuzz.mjs") && !fs.existsSync(path.join(OUT, "stages.jsonl.gz")))
  throw new Error("out/sem/stages.jsonl.gz が無い（record.mjs と dump.mjs --out stages.jsonl.gz を先に）");

const t0 = Date.now();
const done = [];
for (const [name, nodeArgs, script, scriptArgs, outs] of todo) {
  const t = Date.now();
  console.log(`== ${name}：node ${[...nodeArgs, script, ...scriptArgs].join(" ")}`);
  const r = spawnSync(process.execPath, [...nodeArgs, path.join(HERE, script), ...scriptArgs], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`${name} が止まった（status ${r.status}、signal ${r.signal}）`);
    process.exit(1);
  }
  console.log(`   ${((Date.now() - t) / 1000).toFixed(1)} 秒`);
  done.push(...outs);
}
console.log(`== 出力（out/sem）、全部で ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
for (const f of done) {
  const b = fs.readFileSync(path.join(OUT, f));
  let lines = 0;
  for (let i = b.indexOf(10); i >= 0; i = b.indexOf(10, i + 1)) lines++;
  console.log(`${crypto.createHash("sha1").update(b).digest("hex")}  ${String(lines).padStart(7)}  ${f}`);
}
