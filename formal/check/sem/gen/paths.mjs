// gen の道具の書き先 formal/check/out/sem（この file から相対）。道具が受ける出力の名前と dir は OUT から解く（絶対の道はそのまま）。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "out", "sem");
export const outPath = (p) => path.resolve(OUT, p);
fs.mkdirSync(OUT, { recursive: true });
