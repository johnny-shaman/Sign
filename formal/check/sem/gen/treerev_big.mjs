// tree の確かめ（tree-review）：長い行と深い入れ子の源（燃料と再帰の深さを見る）。1行 {id, from, source}。
// node treerev_big.mjs [出力]（out/sem から解く。既定 treerev_big_sources.jsonl）
import fs from "fs";
import { outPath } from "./paths.mjs";
const rep = (s, n) => s.repeat(n);
const srcs = [
  "x : " + rep("1 + ", 5000) + "1",
  rep("a ^ ", 3000) + "a",
  rep("a , ", 3000) + "a",
  rep("a : ", 2000) + "a",
  rep("a ? ", 2000) + "a",
  rep("a ' ", 3000) + "a",
  rep("a @ ", 3000) + "a",
  rep("a == ", 2000) + "a",
  rep("a = ", 2000) + "a",
  rep("a ", 5000) + "a",
  rep("[", 300) + "1" + rep("]", 300),
  rep("(", 200) + "1 +" + rep(")", 200),
  rep("[", 100) + "+ 1 2" + rep("]", 100),
  rep("!", 1000) + "x",
  rep("$", 500) + "_",
  "x" + rep("!", 500),
  rep("a ~^ ", 1000) + "a",
  rep("a ^ ", 1500) + "a +",
  "[" + rep("a ^ ", 1500) + "]",
  "[" + rep("^ a ", 1500) + "]",
  "[" + rep("a ^ ", 1500) + "a ^]",
  rep("a ^ - ", 1000) + "a",
  rep("a < ", 1000) + "a",
  rep("a ; b | c & d == e , ", 800) + "a",
  rep("x : [\n", 50) + "1" + rep("\n]", 50),
  Array.from({ length: 2000 }, (_, i) => `x${i} : ${i}`).join("\n"),
];
fs.writeFileSync(outPath(process.argv[2] || "treerev_big_sources.jsonl"), srcs.map((source, id) => JSON.stringify({ id, from: "treerev-big", source })).join("\n") + "\n");
console.log(srcs.length);
