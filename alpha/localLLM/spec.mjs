/**
 * 問いの前置き（system）を組む。見せるのは Sign の仕様だけで、処理系（JS）のコードは見せない。
 *
 *   core：core.md（核。数 KB）
 *   full：core.md ＋ 演算子の表（guide/operator_table.md から問うたびに切り出す）
 *
 * 表を写して置かないのは、仕様が裁定で動くからである。写しは古くなる（鍵の `' i~` の読みが
 * 注や仕様書に残っていたのと同じことが起きる）。
 */
import fs from "node:fs";
import path from "node:path";
import { HERE, REPO } from "./lib.mjs";

const CORE = path.join(HERE, "core.md");
const OPS = path.join(REPO, "documents", "ja-jp", "guide", "operator_table.md");

/** 演算子の表（優先順位・記号・位置・機能・操作的意味論）を仕様書から切り出す。 */
export function operatorTable() {
	const rows = fs.readFileSync(OPS, "utf8").split(/\r?\n/).filter((l) => /^\|\s*[\d.]+[^|]*\|\s*`/.test(l));
	const cells = rows.map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
	return ["| 段 | 記号 | 位置 | 機能 | 意味 |", "|---|---|---|---|---|", ...cells.map((c) => `| ${c[0]} | ${c[1]} | ${c[2]} | ${c[3]} | ${c[5]} |`)].join("\n");
}

export function systemPrompt(level = "core", task = "") {
	let s = fs.readFileSync(CORE, "utf8");
	if (level === "full") s += "\n\n## 演算子の表（数が小さいほど緩く結合する）\n\n" + operatorTable() + "\n";
	return task ? `${s}\n---\n\n${task}` : s;
}
