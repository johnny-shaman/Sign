/**
 * **文字の字面をエディタが文字として塗るか**（`\` と直後の1文字、sign.pegjs の `charactor`）。
 *
 * `\_` は文字 `_`（U+005F）であって穴ではない（利用者の裁定 2026-09-28）。文法はそう読むのに、VS Code の TextMate
 * 文法は `\\.` を文字列の中でしか持たず、文字列の外では穴の規則（`\b_\b`）が `\_` の `_` を穴・単位の色で塗って
 * いた。Emacs は最上位の `\\.` が穴の規則より先に居るので文字として塗る。**エディタの支援はいつもいちばん古い写し**
 * なので（comment_discriminator.test.js と同じ理由）、実際に当てて見る。
 *
 * VS Code は最上位の pattern を1行に当てる順を真似る：いまの位置から最も左で当たる pattern を採り、同じ位置なら
 * 先に並んだものを採る（TextMate の規則）。`begin`/`end` は行の中で閉じるか行末までを1つとして塗る。この文法の
 * pattern は JS の正規表現と同じ綴りで読める。
 *
 * 実行: node test/editor_char.test.js（`npm test` からも呼ばれる）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..", "..");
const B = String.fromCharCode(96), BS = String.fromCharCode(92);

let passed = 0, total = 0;
const check = (name, got, want) => {
	total++;
	if (got === want) { console.log("OK   " + name); passed++; }
	else { console.log("FAIL " + name); console.log("     got:  " + got); console.log("     want: " + want); }
};

// --- VS Code: TextMate 文法 -------------------------------------------------
const tm = JSON.parse(fs.readFileSync(path.join(root, "tools", "vscode", "syntaxes", "sign.tmLanguage.json"), "utf8"));
const flat = (pats) => pats.flatMap((p) => (p.include ? flat(tm.repository[p.include.slice(1)].patterns) : [p]));
const top = flat(tm.patterns);
// 1行を塗って、各位置の scope 名（塗られなければ null）を返す
function scopesOf(line) {
	const out = new Array(line.length).fill(null);
	let pos = 0;
	while (pos < line.length) {
		let best = null;
		for (const p of top) {
			const re = new RegExp(p.match || p.begin, "g");
			re.lastIndex = pos;
			const m = re.exec(line);
			if (m && (best === null || m.index < best.m.index)) best = { p, m };
		}
		if (!best) break;
		let end = best.m.index + best.m[0].length;
		if (best.p.begin) {
			const e = new RegExp(best.p.end, "g");
			e.lastIndex = end;
			const me = e.exec(line);
			end = me ? me.index + me[0].length : line.length;
		}
		for (let k = best.m.index; k < end; k++) out[k] = best.p.name;
		pos = Math.max(end, best.m.index + 1);
	}
	return out;
}
const scopeAt = (line, i) => String(scopesOf(line)[i]);

check("VS Code: `x : \\_` の `_` は文字", scopeAt("x : " + BS + "_", 5), "constant.character.sign");
check("VS Code: `x : \\_` の `\\` も文字", scopeAt("x : " + BS + "_", 4), "constant.character.sign");
check("VS Code: `\\_ = 0u005F` の `_` は文字", scopeAt(BS + "_ = 0u005F", 1), "constant.character.sign");
// 対照：穴は穴のまま（文字の規則が `_` を広く取っていない）
check("VS Code: `f _ 1` の `_` は穴", scopeAt("f _ 1", 2), "constant.language.unit.sign");
// 文字の字面はバッククォートも取る（`\`` は文字）——文字列を始めない
check("VS Code: `c = \\`` の ` は文字（文字列を始めない）", scopeAt("c = " + BS + B + " + 1", 5), "constant.character.sign");
check("VS Code: `c = \\`` の後ろは文字列ではない", scopeAt("c = " + BS + B + " + 1", 7), "constant.language.sign");

// --- Emacs: font-lock ------------------------------------------------------
// font-lock は先に塗った規則が勝つ（上書きの印 `t` が無ければ）。文字の規則が穴の規則より前に居ることを見る。
const el = fs.readFileSync(path.join(root, "tools", "emacs", "lisp", "sign-mode.el"), "utf8").split(/\r?\n/);
const charRule = el.findIndex((x) => x.includes('("' + BS + BS + BS + BS + '."'));
const holeRule = el.findIndex((x) => x.includes('("' + BS + BS + "_<_" + BS + BS + '_>"'));
check("Emacs: 文字の規則がある", charRule >= 0, true);
check("Emacs: 穴の規則がある", holeRule >= 0, true);
check("Emacs: 文字の規則が穴の規則より先（`\\_` は文字で塗られる）", charRule >= 0 && holeRule >= 0 && charRule < holeRule && !/\bt\)\s*$/.test(el[holeRule]), true);

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
