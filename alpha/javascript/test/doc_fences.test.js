/**
 * **仕様とガイドの ```sign は、写したまま通るか。**
 *
 * `documents/**\/*.md` の ```sign フェンスを抜き出して compile する。読者が写して踏む所を、
 * 人の目ではなく門が数える——実測で **265 本中 88 本（33%）が写したままでは通らなかった**
 * （2026-09-23）。人が目で追う限り、写しの多い en 側は必ずまた遅れる。
 *
 * ## 何を見るか
 *
 * 見るのは「**写したまま compile が通るか**」だけである。値の突き合わせはまだしない——値の注記が
 * 今は行末のバックティック（＝閉じていない文字列）に埋まっていて、フェンス自身が通らないからで、
 * 綴りを直した後に足す（注記の綴りは「行の**上**に列0のコメントで `` ` 評価結果: 20 ``」にする。
 * 列0のコメントは字下げブロックの中でも通るが、器（`[ … ]`）の中では文字列になるので置けない）。
 *
 * ## 断りは「0件」ではなく既知の1件ずつを書く
 *
 * `corpus.js` と同じ規律である。**通らない所を消すのではなく、既知として記録して覆う**——
 * 直れば golden が減るし、新しく生えれば名指しで赤くなる。数ではなく**理由**で持つのは、
 * 数が動かないまま理由が変わることがあるからで、実際 `===` の廃止と行末バックティックは
 * 同じファイルの同じ行数で起きていた。
 *
 * 行番号は持たない。文書を直すと全部ずれるが、**理由の多重集合**は編集で動かない
 * ——動いたときだけ「何が増えた／減った」を言えばよい。
 *
 * 実行: node test/doc_fences.test.js（`--golden` で今の実測を golden の形で出す）
 */
import fs from "fs";
import path from "path";
import peggy from "peggy";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..", "..");
const DOCS = path.join(ROOT, "documents");
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const parser = peggy.generate(fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8"));

/**
 * **通らないことが分かっている所**（2026-09-23 の実測）。ファイルごとに「理由 → 件数」で持つ。
 *
 * 理由は診断か例外の頭を短く畳んだ鍵である。掃除で消えたら golden から削る——**減るのは良い
 * 知らせなので、門は「減った」も名指しする**（黙って通すと、次に生えたとき気づけない）。
 */
const KNOWN = {
	"documents/en-us/guide/README.md": {"coproduct_resolver.md §5":1},
	"documents/en-us/guide/function_guide.md": {"仮引数 '<x>' のデフォルト式に '#'（O":1},
	"documents/en-us/guide/list_cheat_sheet.md": {"stack_abi.md §7.1違反: 名前付":1},
	"documents/en-us/guide/pattern_guide.md": {"パラメータ '<x>' のデフォルト式が、まだ束":1},
	"documents/en-us/guide/reference.md": {"パース":1,"解決できない式です: <F> (式)（演算子の位":1},
	"documents/en-us/impl/build/preprocessor.md": {"パース":1},
	"documents/en-us/impl/core/execution_model.md": {"インポートを解決する手段がありません（add.s":1},
	"documents/en-us/impl/type/list_model.md": {"`名前 : 値` を値の位置に書けません——束縛":1},
	"documents/ja-jp/guide/README.md": {"coproduct_resolver.md §5":1},
	"documents/ja-jp/guide/function_guide.md": {"仮引数 '<x>' のデフォルト式に '#'（O":1,"分解の形・rest 形の仮引数にデフォルト値は書":1},
	"documents/ja-jp/guide/list_cheat_sheet.md": {"stack_abi.md §7.1違反: 名前付":1},
	"documents/ja-jp/guide/pattern_guide.md": {"パラメータ '<x>' のデフォルト式が、まだ束":1},
	"documents/ja-jp/guide/reference.md": {"行末の ` が閉じていない":1,"パース":2},
	"documents/ja-jp/impl/build/build_system.md": {"パース":1},
	"documents/ja-jp/impl/build/entry_point.md": {"インポートを解決する手段がありません（main.":3},
	"documents/ja-jp/impl/build/preprocessor.md": {"パース":3},
	"documents/ja-jp/impl/build/system_architecture.md": {"行末の ` が閉じていない":1},
	"documents/ja-jp/impl/core/coproduct_resolver.md": {"coproduct_resolver.md §5":1},
	"documents/ja-jp/impl/idiom_to_instructions.md": {"インポートを解決する手段がありません（opera":1},
	"documents/ja-jp/impl/layer_relations.md": {"`名前 : 値` の左辺は名前でなければなりませ":1},
	"documents/ja-jp/impl/memory/stack_abi.md": {"行末の ` が閉じていない":3},
	"documents/ja-jp/impl/type/type_system.md": {"スロット 'tier' が同じ構造体の中で2回定":1,"インポートを解決する手段がありません（add.s":2},
	"documents/manifesto/manifesto.en-us.md": {"`名前 : 値` の左辺は名前でなければなりませ":1},
	"documents/manifesto/manifesto.ja-jp.md": {"`名前 : 値` の左辺は名前でなければなりませ":1},
};

let passed = 0;
let total = 0;
function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
	if (!ok) console.log(`     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
}

const walk = (dir, out = []) => {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (e.name.endsWith(".md")) out.push(p);
	}
	return out;
};

/**
 * フェンスを抜き出す。**共通の字下げを外す**——markdown のリストの中に置かれたフェンスは
 * 項目ぶんの空白を持っており、レンダリングされた姿はそれを外したものである。Sign は行頭の
 * 空白を「前の行の続き」と読むので、外さないと全部が行頭空白の断りになる。
 */
const fencesOf = (text) => {
	const lines = text.split(CR).join("").split(NL);
	const out = [];
	for (let i = 0; i < lines.length; i++) {
		// **引用（`> `）の中のフェンスも読む。** 見落としていた間は 36 本が門の外に居て、そこに
		// 行末バックティックが 59 行残っていた（41 行は1つのファイル）。引用の印は markdown の
		// 飾りであって、剥がした姿が読者の写すコードである——門が見ない所に腐りが溜まる。
		// 引用は入れ子になる（`> > ```sign` が1本あった）ので、印が無くなるまで剥がす。
		const depth = (lines[i].match(/>/g) || []).length && /^\s*>/.test(lines[i]) ? (lines[i].match(/^(?:\s*>\s?)+/) || [""])[0] : "";
		const strip = (l) => {
			if (!depth) return l;
			let s = l;
			for (let k = 0; k < depth.split(">").length - 1; k++) s = s.replace(/^\s*>\s?/, "");
			return s;
		};
		const m = strip(lines[i]).match(/^(\s*)```([A-Za-z]*)\s*$/);
		if (!m) continue;
		const [, indent, tag] = m;
		const close = new RegExp("^" + indent + "```\\s*$");
		let j = i + 1;
		const body = [];
		while (j < lines.length && !close.test(strip(lines[j]))) body.push(strip(lines[j])), j++;
		out.push({ tag, line: i + 1, body });
		i = j;
	}
	return out;
};
const dedent = (body) => {
	const ws = body.filter((l) => l.trim()).map((l) => (l.match(/^[ ]*/) || [""])[0].length);
	const n = ws.length ? Math.min(...ws) : 0;
	return body.map((l) => l.slice(n));
};

// 断りの理由を短い鍵へ畳む。**同じ穴を同じ鍵にする**のが要で、鍵が細かすぎると文書を1文字
// 直すたびに golden が動く。
const reasonOf = (src) => {
	try {
		const { diagnostics } = compile(src, { parse: parser.parse });
		const bad = (diagnostics || []).filter((d) => (d.level || d.severity) === "error");
		return bad.length ? String(bad[0].message).slice(0, 24) : null;
	} catch (e) {
		const m = String(e.message);
		if (/文字列が行の終わりまでに閉じていません/.test(m)) return "行末の ` が閉じていない";
		if (/行頭の空白/.test(m)) return "行頭の空白";
		if (/Expected/.test(m)) return "パース";
		return m.slice(0, 24);
	}
};

const rows = [];
for (const f of walk(DOCS)) {
	const rel = path.relative(ROOT, f).split(path.sep).join("/");
	for (const fence of fencesOf(fs.readFileSync(f, "utf8"))) {
		if (!/^sign$/i.test(fence.tag)) continue;
		rows.push({ rel, line: fence.line, reason: reasonOf(dedent(fence.body).join(NL) + NL) });
	}
}
const bad = rows.filter((r) => r.reason);
const got = {};
for (const r of bad) {
	got[r.rel] ??= {};
	got[r.rel][r.reason] = (got[r.rel][r.reason] || 0) + 1;
}

if (process.argv.includes("--golden")) {
	const keys = Object.keys(got).sort();
	console.log("const KNOWN = {");
	for (const k of keys) console.log(`\t"${k}": ${JSON.stringify(got[k])},`);
	console.log("};");
	process.exit(0);
}

// **ファイルごとに突き合わせる。** 増えた／減った／理由が変わったのを名指しする。
for (const rel of [...new Set([...Object.keys(KNOWN), ...Object.keys(got)])].sort()) {
	check(`${rel}: 通らないフェンスの理由`, got[rel] || {}, KNOWN[rel] || {});
}
// 直った所は「golden を減らすこと」を言う（黙って通すと次に生えたとき気づけない）。
for (const rel of Object.keys(KNOWN).sort()) {
	if (!got[rel]) console.log(`     ${rel} は全部通るようになった——KNOWN から削ること`);
}

const files = new Set(rows.map((r) => r.rel)).size;
console.log(
	`\n\`\`\`sign のフェンス ${rows.length} 本（${files} ファイル）、写したまま通るのは ${rows.length - bad.length} 本、` +
		`通らないのは ${bad.length} 本`
);
const byReason = {};
for (const r of bad) byReason[r.reason] = (byReason[r.reason] || 0) + 1;
console.log("理由の内訳: " + Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" / "));
if (bad.length) {
	console.log("（値の突き合わせはまだしない——注記が行末のバックティックに埋まっているので、綴りを直した後に足す）");
}
console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
