// resolve.js の写しを out/sem/gen/ に作り、前段だけを走らせる口 frontRows(source) を末尾に足す（resolve.js は export しない frontEnd・parseRow を使うため）。
// frontRows は resolve() の頭（frontEnd と行ごとの parseRow、resolve.js の `let lines;` から前段の catch まで）を字のまま写した物で、
// resolve の返す物と同じ形の { rows, lineOf } を返す。種類と読む段の断り（resolve の後の段）は走らせない。
// 置き換えはどれもちょうど1回当たることを確かめ、外れたら止める。写しの名前は resolve.js の中身と genFront の字の sha1 の頭で、どちらも同じなら作り直さない。
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { pathToFileURL, fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
export const JS = path.join(ROOT, "alpha1", "javascript").replace(/\\/g, "/");
const GEN = path.join(ROOT, "formal", "check", "out", "sem", "gen");
export const PEGGY_URL = pathToFileURL(createRequire(JS + "/resolve.js").resolve("peggy")).href;
const url = (f) => pathToFileURL(JS + "/" + f).href;

export const sha1Head = (buf) => crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);

// stages の版の印。dump.mjs と gen/ の fuzz・rawfuzz が終わりの印に書き、gate.mjs が今の物と照らす（stages を作った後に、
// 下のどれかが変われば落とす）。前段の JS の答えを決める alpha1 の file（前段の import の全部）の sha1 の頭（12 字）と peggy の版、
// stages を書く道具（tools、formal/check/sem の下）の sha1 の頭、node の版とスタックの大きさ（node の --stack-size。どちらも JS のスタックの
// 溢れの所を変える）。源の集まりの中身は印に入れない（dump.mjs が終わりの印の sources に書き、gate.mjs が照らす）。
// stack は走っている node の引数から取る。gate.mjs は stages の印の stack を STACK_ARG（gate.mjs が dump.mjs に、gen/all.mjs が fuzz・rawfuzz に
// 付ける物）と照らす（gate.mjs も STACK_ARG を付けた node で自分を走らせ直すが、照らすのは自分の引数でなく子に付ける STACK_ARG）。
export const STACK_ARG = "--stack-size=8000";
export const STAMP_FILES = ["lexer.js", "sign.pegjs", "resolve.js", "operator_table.js", "errors.js"];
export const STAMP_TOOLS = ["dump.mjs", "rowsjson.mjs", "gen_front.mjs", "gen/fuzz.mjs", "gen/rawfuzz.mjs"];
export function frontStamp() {
  const s = {};
  for (const f of STAMP_FILES) s[f] = sha1Head(fs.readFileSync(JS + "/" + f));
  s.peggy = createRequire(JS + "/resolve.js")("peggy/package.json").version;
  s.tools = {};
  for (const f of STAMP_TOOLS) s.tools[f] = sha1Head(fs.readFileSync(path.join(HERE, f)));
  s.node = process.version;
  s.stack = process.execArgv.filter((a) => a.startsWith("--stack-size")).join(" ") || null;
  return s;
}

export function genFront() {
  let text = fs.readFileSync(JS + "/resolve.js", "utf8");
  // 写しの名前は resolve.js の中身とこの関数の字の sha1 の頭（どちらかが変われば作り直す）
  const hash = sha1Head(text + "\n" + genFront.toString());
  const out = path.join(GEN, `resolve_front_${hash}.mjs`);
  if (fs.existsSync(out)) return out;
  const count = (s) => text.split(s).length - 1;
  const once = (from, to) => {
    const n = count(from);
    if (n !== 1) throw new Error(`gen_front: ${JSON.stringify(from)} が ${n} 回当たった（1 回のはず）`);
    text = text.replace(from, () => to);
  };
  once(`import peggy from "peggy";`, `import peggy from ${JSON.stringify(PEGGY_URL)};`);
  once(`import { preprocessWithLines } from "./lexer.js";`, `import { preprocessWithLines } from ${JSON.stringify(url("lexer.js"))};`);
  once(`import { OPERATOR_DICT } from "./operator_table.js";`, `import { OPERATOR_DICT } from ${JSON.stringify(url("operator_table.js"))};`);
  once(`import { OperationError } from "./errors.js";`, `import { OperationError } from ${JSON.stringify(url("errors.js"))};`);
  once(`    const dir = path.dirname(fileURLToPath(import.meta.url));`, `    const dir = ${JSON.stringify(JS)};`);
  // 置き換えの後に、相対の import と import.meta が残っていないこと
  if (/from\s+["']\.\.?\//.test(text) || /\bimport\s*\(/.test(text) || /import\.meta/.test(text)) throw new Error("gen_front: 相対の import か import.meta が残った");
  // resolve() の頭を字のまま取る
  const START = "export function resolve(source) {\n";
  const END = "\n\n  const diagnostics = [];\n";
  for (const a of [START, END]) if (count(a) !== 1) throw new Error(`gen_front: ${JSON.stringify(a)} が ${count(a)} 回当たった（1 回のはず）`);
  const s = text.indexOf(START) + START.length;
  const e = text.indexOf(END, s);
  if (e < 0) throw new Error("gen_front: resolve() の頭の終わりが見つからない");
  const head = text.slice(s, e);
  // 頭が前段（frontEnd と parseRow）だけで、前段の catch で終わること
  const want = ["  let lines;", "const front = frontEnd(source);", "lines = front.rows.map((words) => parseRow(words));", "throw stackRefusal(e) || e;"];
  for (const w of want) if (head.split(w).length - 1 !== 1) throw new Error(`gen_front: resolve() の頭に ${JSON.stringify(w)} が 1 回ない`);
  if (!head.trimEnd().endsWith("}")) throw new Error("gen_front: resolve() の頭が } で終わらない");
  // resolve の返す rows と lineOf がこの形であること（frontRows も同じ物を返す）
  const RET = "  return { trees, diagnostics, rows: lines, lineOf: (row) => rowTreeLine.get(row) };";
  if (count(RET) !== 1) throw new Error(`gen_front: resolve の return が ${count(RET)} 回当たった（1 回のはず）`);
  if (count("frontRows") !== 0) throw new Error("gen_front: frontRows がもうある");
  text += `\n// formal/check/sem/gen_front.mjs が足した口：resolve() の頭（前段）だけを走らせ、resolve と同じ形の rows と lineOf を返す。\nexport function frontRows(source) {\n${head}\n  return { rows: lines, lineOf: (row) => rowTreeLine.get(row) };\n}\n`;
  fs.mkdirSync(GEN, { recursive: true });
  fs.writeFileSync(out, text);
  return out;
}
