/**
 * **`.snt`（Sign の契約）を、解釈器と機械の両方で走らせる。**
 *
 * `alpha/sign/*.snt` は、隣の `.sn` を取り込んで条文を並べた Sign のファイルである
 * （利用者の決定 2026-09-26）。条文は `名前 : 実際 == 期待`——`==` は真なら左辺、偽なら `__`
 * なので、条文の値が `__` でなければ通る。`__` を期待するときは `名前 : !(実際)`。
 * 条文には必ず名前を付ける（どんなに短くても名前がある方がよい、同）。`?` を持つ定義は
 * 条文ではなく補助の関数として扱う。
 *
 * **テストは契約の条文で、書かれた意図が型を決める。** 解釈器は動的型付けで条文を回し、
 * 機械は条文の使われ方から静的に型を決めて出す。ここが見たいのは **動的型付け == 静的型付け**
 * であること：
 *
 *   1. 解釈器（動的）：全条文が `__` でない。
 *   2. 機械（静的、pass4）：条文ごとに「取り込み＋補助＋その条文だけ」で1本出して実機で走らせ、
 *      値が解釈器と同じ。器を返す条文は `実際 == 期待` の比較そのものが機械の上で走っているので、
 *      `__` でないことが一致である。**他の条文を同じプログラムに入れない**——1つの条文の断りが
 *      全部を巻き込むので、どの条文がまだ言語でないのかが見えなくなる。
 *
 * 機械が断る条文は理由ごと golden に置く（`MACHINE_REFUSED`）。断りは「まだ言語ではない」の
 * 印で、黙った誤答ではない。断りが消えたら落として「golden から削る」と言わせ、増えても落ちる。
 *
 * 実行: node test/snt.test.js
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile, definedNameOf } from "../compile.js";
import { preprocess } from "../lexer.js";
import { generateAsm } from "../pass4.js";
import { blockingOf } from "../errors.js";
import { evaluate, newRuntimeEnv, observe, isUnit } from "../interpreter.js";
import { runAsm, asInt, available, toolReport } from "../qemu_run.js";
import { ASM_OPT } from "./corpus.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIGN = path.join(__dirname, "..", "..", "sign");
const parser = peggy.generate(fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8"));
const readImport = (p) => fs.readFileSync(path.join(SIGN, p), "utf8").replace(/\r\n/g, "\n");

let passed = 0;
let total = 0;
function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
	if (!ok) console.log(`     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
}

// **機械がまだ出せない条文**（ファイル → 条文 → 断りの理由の頭）。消えても増えても落ちる。
const MACHINE_REFUSED = {
	"lexer.snt": {
		// 字面の文字列と文字をトップレベルで連結する形（`` `ab` quote `cd` ``）。
		quote_taken: "器の構築はまだ出せません（String——撒いているので要素数が",
		quote_dropped: "器の構築はまだ出せません（String——撒いているので要素数が",
		word_keeps_string: "器の構築はまだ出せません（String——撒いているので要素数が",
		word_keeps_escape: "器の構築はまだ出せません（String——撒いているので要素数が",
		// `List(String)` どうしの `==`（要素を1段辿って比べる道がまだ無い）。
		four_words: "要素が参照で運ばれる器どうしの比較はまだ出せません",
		group_is_one_word: "要素が参照で運ばれる器どうしの比較はまだ出せません",
		string_is_one_word: "要素が参照で運ばれる器どうしの比較はまだ出せません",
		block_is_one_word: "要素が参照で運ばれる器どうしの比較はまだ出せません",
	},
};

// ---- 条文を拾う ----
// 前処理してから構文の行に割る（コメント行は前処理が落とす）。取り込みの行は飛ばし、名前の
// 付いた定義のうち `?` を持たないものが条文、持つものが補助の関数。名前の無い行は断る。
const isImportLine = (l) => Array.isArray(l) && l.length === 3 && typeof l[0] === "string" && l[0][0] === "`" && l[1] === "_@" && l[2] === "_~";
function clausesOf(src) {
	const clauses = [];
	const unnamed = [];
	for (const line of parser.parse(preprocess(src))) {
		if (isImportLine(line)) continue;
		const d = definedNameOf(line);
		if (!d) unnamed.push(JSON.stringify(line).slice(0, 60));
		else if (!line.includes("?")) clauses.push(d.name.slice(1, -1));
	}
	return { clauses, unnamed };
}

// 機械へは「その条文だけ」を渡す。行頭から始まる塊（続く字下げの行を含む）ごとに、
// 別の条文の定義を落とす。
function onlyClause(src, clauses, keep) {
	const out = [];
	let drop = false;
	for (const line of src.split("\n")) {
		if (line !== "" && !/^[ \t]/.test(line)) {
			const m = /^#?([^\s:`]+)\s*:/.exec(line);
			drop = !!(m && clauses.includes(m[1]) && m[1] !== keep);
		}
		if (!drop) out.push(line);
	}
	return out.join("\n") + "\n" + keep + "\n";
}

// 解釈器の値を、機械の x0 と同じ見え方へ揃える（`Char` は符号位置、恒等射は 0）。
const show = (o) => {
	if (o === undefined || o === null) return "__";
	if (typeof o === "string" && [...o].length === 1) return String(o.codePointAt(0));
	if (o && typeof o === "object" && o.__identity__) return "0";
	return typeof o === "string" || typeof o === "object" ? JSON.stringify(o) : String(o);
};
const isBox = (o) => Array.isArray(o) || (typeof o === "string" && [...o].length !== 1);

const MACHINE = !process.argv.includes("--no-qemu") && available();
if (!MACHINE) console.log(`（機械の側は飛ばす：${toolReport()}）`);

const files = fs.readdirSync(SIGN).filter((f) => f.endsWith(".snt")).sort();
check("golden に載っている .snt が在る", Object.keys(MACHINE_REFUSED).filter((f) => !files.includes(f)), []);

for (const file of files) {
	const src = fs.readFileSync(path.join(SIGN, file), "utf8").replace(/\r\n/g, "\n");
	const { clauses, unnamed } = clausesOf(src);
	console.log(`\n${file}：条文 ${clauses.length}`);
	check(`${file}: 名前の無い行が無い`, unnamed, []);
	check(`${file}: 条文が1つ以上ある`, clauses.length > 0, true);

	const { nodes } = compile(src, { parse: parser.parse, readImport, charset: ASM_OPT.charset });
	const env = newRuntimeEnv(null, ASM_OPT.charset);
	for (const n of nodes) evaluate(n, env);
	const refusedWant = MACHINE_REFUSED[file] || {};
	const refusedGot = {};
	for (const c of clauses) {
		const v = evaluate({ type: "atom", kind: "identifier", value: `<${c}>` }, env);
		const iv = isUnit(v) ? undefined : observe(v);
		check(`${file} ${c}: 解釈器で通る`, !isUnit(v), true);
		if (!MACHINE) continue;
		let m;
		try {
			const cc = compile(onlyClause(src, clauses, c), { readImport, charset: ASM_OPT.charset });
			const r = generateAsm(cc.nodes, cc.env, ASM_OPT);
			const bad = blockingOf(r.diagnostics);
			if (bad.length) {
				refusedGot[c] = bad[0].message;
				continue;
			}
			const words = runAsm(r.text);
			if (isBox(iv)) {
				// **器の `__` は長さ 0 である**（x0 の niche ではない）。x0 だけ見ていたので、比較が
				// 機械の上で偽になっても `{ptr 0, len 0}` の ptr を「__ でない値」と読んでいた（変異で確かめた）。
				m = words[1] === 0n ? "__" : "長さ " + String(words[1]);
			} else {
				const x = asInt(words[0]);
				m = x === null ? "__" : String(x);
			}
		} catch (e) {
			m = "例外：" + e.message.slice(0, 80);
		}
		// 器を返す条文は `実際 == 期待` の比較そのものが機械の上で走っているので、真になって
		// 左辺の器が返ること、その長さが解釈器と同じことが一致である。
		if (isBox(iv)) check(`${file} ${c}: 機械でも通り、長さが解釈器と同じ`, m, "長さ " + (Array.isArray(iv) ? iv.length : [...iv].length));
		else check(`${file} ${c}: 機械の値が解釈器と同じ`, m, show(iv));
	}
	if (MACHINE) {
		for (const [c, why] of Object.entries(refusedWant)) {
			if (!refusedGot[c]) console.log(`     出せるようになった——MACHINE_REFUSED から削ること: ${file} ${c}`);
		}
		const got = Object.fromEntries(Object.entries(refusedGot).map(([c, msg]) => [c, Object.values(refusedWant).find((w) => msg.startsWith(w)) || msg]));
		check(`${file}: 機械が断る条文と理由`, got, refusedWant);
	}
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
