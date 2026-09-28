/**
 * coproduct_resolver.md §5.4（裸のRestパラメータへの~なしList渡しはTypeError）の動作確認。
 * `f : x ~xs ? ...`（ブラケットなし）にList を後置~なしで渡すとTypeErrorになること、
 * 後置~を付けた場合・ブラケット形式（`[x ~xs] ? ...`）の場合はどちらも正しく解決されることを確認する。
 *
 * 実行: node test/rest_param_typecheck.test.js
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { preprocess } from "../lexer.js";
import { reduceAll } from "../pass2.js";
import { buildEnv } from "../pass1.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const grammarPath = path.join(__dirname, "..", "sign.pegjs");
const grammar = fs.readFileSync(grammarPath, "utf8");
const parser = peggy.generate(grammar);

function resolveSource(source) {
	const pre = preprocess(source);
	const lines = parser.parse(pre);
	const env = buildEnv(lines);
	return lines.map((line) => reduceAll(line, env));
}

const cases = [
	{
		source: "f : x ~xs ? x\nf [1 2 3]",
		expectThrow: true,
		note: "裸のrestパラメータ (x ~xs) に ~ なしで List を渡す → TypeError",
	},
	{
		source: "f : x ~xs ? x\nf [1 2 3]~",
		expectThrow: false,
		note: "裸のrestパラメータ (x ~xs) に 後置~ 付きで List を渡す → 正しく解決される",
	},
	{
		source: "get_age : [x ~xs] ? x\nget_age [1 2 3]",
		expectThrow: false,
		note: "ブラケット形式 ([x ~xs], Eager) は ~ なしの List 渡しが正しい呼び方 → 対象外",
	},
	// **文字列も List である**（String ≅ List(Char)、利用者の裁定 2026-09-28）。`~` 無しで渡すと、解釈器は丸ごと x に
	// 束縛し（xs は空）、機械は割って頭を取る——両エンジンで割れていた。
	{
		source: "f : x ~xs ? x\nf `abc`",
		expectThrow: true,
		note: "裸のrestパラメータ (x ~xs) に ~ なしで文字列を渡す → TypeError",
	},
	{
		source: "f : x ~xs ? x\nf (`abc`)",
		expectThrow: true,
		note: "括りで包んだ文字列も同じ → TypeError",
	},
	{
		source: "f : x ~xs ? x\nf `abc`~",
		expectThrow: false,
		note: "文字列に後置~ を付ければ正しく解決される",
	},
	{
		source: "get_age : [x ~xs] ? x\nget_age `abc`",
		expectThrow: false,
		note: "ブラケット形式へ ~ なしの文字列 → 対象外",
	},
	{
		source: "f : x ~xs ? x\nf 0u0061",
		expectThrow: false,
		note: "文字（1つの値）は位置引数そのもの → 対象外",
	},
];

let passed = 0;
for (const c of cases) {
	let threw = false;
	let errMessage = "";
	try {
		resolveSource(c.source);
	} catch (e) {
		threw = e instanceof TypeError;
		errMessage = e.message;
	}
	const ok = threw === c.expectThrow;
	if (ok) {
		console.log(`OK   ${c.note}`);
		passed++;
	} else {
		console.log(`FAIL ${c.note}`);
		console.log(`     source: ${JSON.stringify(c.source)}`);
		console.log(`     expectThrow: ${c.expectThrow}, got threw: ${threw}${errMessage ? ` (${errMessage})` : ""}`);
	}
}

console.log(`\n${passed}/${cases.length} passed`);
process.exit(passed === cases.length ? 0 : 1);
