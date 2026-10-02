/**
 * 標準入力の Sign プログラムを解釈器で走らせ、最後の式の値を1行で出す（採点役）。
 *
 *   node interp.mjs < prog.sn
 *
 * 書かれたコードは止まらないことがある（末尾再帰は平らになるので、スタックは溢れずに回り続ける）。
 * 呼ぶ側が別プロセスにして時間で切る。前段が断ったら `! 理由` を出す。
 */
import fs from "node:fs";
import path from "node:path";
import { REPO } from "./lib.mjs";

const JS = path.join(REPO, "alpha", "javascript");
const { compile } = await import(path.join(JS, "compile.js"));
const I = await import(path.join(JS, "interpreter.js"));
const { show } = await import("./show.mjs");

const src = fs.readFileSync(0, "utf8").replace(/\r\n/g, "\n");
const readImport = (p) => fs.readFileSync(path.join(REPO, "alpha", "sign", path.basename(p)), "utf8");
try {
	const { nodes } = compile(src, { readImport, charset: "ascii" });
	const env = I.newRuntimeEnv();
	let r = I.UNIT;
	for (const n of nodes) r = I.evaluate(n, env);
	process.stdout.write(show(r, I) + "\n");
} catch (e) {
	process.stdout.write("! " + String(e.message).split("\n")[0].slice(0, 200) + "\n");
}
