// 包み（rec_*.mjs）が来た源を覚える所。プロセスが終わる時に、SEM_REC_DIR の下へ <SEM_FROM>.<pid>.jsonl で書く。
// 1行目は頭（from・pid・子か・関数ごとの呼ばれた回数・文字列でない入力の数）、2行目からは違う源ごとに {source, n}（n は関数ごとの回数）。
// 子のプロセス（試験が spawnSync で起こす物）は、親の環境を継ぐので、親の pid を SEM_REC_PARENT で見分ける。
import fs from "fs";
import path from "path";

const DIR = process.env.SEM_REC_DIR;
const FROM = process.env.SEM_FROM || "?";
const parent = process.env.SEM_REC_PARENT;
if (!parent) process.env.SEM_REC_PARENT = String(process.pid);
const child = !!parent && parent !== String(process.pid);

const calls = { resolve: 0, interpret: 0, preprocess: 0, preprocessWithLines: 0 };
let nonString = 0;
const seen = new Map();

export function note(fn, source) {
  calls[fn]++;
  if (typeof source !== "string") {
    nonString++;
    return;
  }
  let c = seen.get(source);
  if (!c) seen.set(source, (c = {}));
  c[fn] = (c[fn] || 0) + 1;
}

process.on("exit", () => {
  if (!DIR) return;
  fs.mkdirSync(DIR, { recursive: true });
  const head = { from: FROM, pid: process.pid, child, calls, nonString, distinct: seen.size };
  const lines = [JSON.stringify({ head })];
  for (const [source, n] of seen) lines.push(JSON.stringify({ source, n }));
  fs.writeFileSync(path.join(DIR, `${FROM}.${process.pid}.jsonl`), lines.join("\n") + "\n");
});
