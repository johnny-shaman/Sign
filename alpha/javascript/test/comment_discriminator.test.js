/**
 * **行頭バッククォートの判別子。**
 *
 * string_and_comment.md §2: 行頭のバッククォートは、**閉じの直後が後置演算子（`@` `~` `!`）か
 * 空白のときだけ式になる**。それ以外はすべてコメントである。
 *
 * この規則は7箇所に書かれている——実装の文法、正式仕様の文法（ja-jp / en-us）、案内文書
 * （ja-jp / en-us）、そしてエディタ支援（VS Code / Emacs）。**同じ事実が複数箇所で決まって
 * いる**のがこのリポジトリで繰り返し出るバグの形なので、この試験は同じ表を7本すべてに
 * 当てて、実際に一致していることを見る。散文2本は機械で読めないので、ここで見るのは
 * 実行される5本（文法3本＋正規表現2本）である。
 *
 * 実行: node test/comment_discriminator.test.js（`npm test` からも呼ばれる）
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..", "..");
const B = String.fromCharCode(96), DQ = String.fromCharCode(34), BS = String.fromCharCode(92);

// --- 期待表 ---------------------------------------------------------------
// 「式」は「その行がコメントとして落ちない」の意味であって、意味が通るかは別の話である
// （`` `abc`! `` は後置 `!` が続くので式だが、String の階乗に意味は無い——判別子の仕事は
// 行がコメントかどうかだけを決めることで、そこから先は型が見る）。
const cases = [
	["閉じない",                B + "これはコメント",                              "コメント"],
	["閉じて行末",              B + "これもコメント" + B,                          "コメント"],
	["散文の中でコードを引用",     B + "ここで " + B + "x" + B + " を引用する" + B,   "コメント"],
	["閉じの直後が読点",          B + "綴りは " + B + "+" + B + "、段は 14" + B,     "コメント"],
	["空のコメント（区切り）",     B + B,                                            "コメント"],
	["インポート",              B + "main.sn" + B + "@~",                          "式"],
	["インポート（撒かない）",     B + "main.sn" + B + "@",                          "式"],
	["連結（空白は段10 の余積）",  B + "Hello, " + B + " name",                       "式"],
	["連結（演算子が続く）",       B + "abc" + B + " + 1",                            "式"],
	["後置 ~",                  B + "lib.sn" + B + "~",                            "式"],
	["後置 !",                  B + "abc" + B + "!",                               "式"],
];

let passed = 0, total = 0;
const check = (name, got, want) => {
	total++;
	if (got === want) { console.log("OK   " + name); passed++; }
	else { console.log("FAIL " + name); console.log("     got:  " + got); console.log("     want: " + want); }
};

// --- (1)(2)(3) 文法3本 -----------------------------------------------------
// 実装と、正式仕様の ja-jp / en-us。3本とも peggy に通して、同じ表で同じ答えを返すか見る。
const grammars = {
	"実装 sign.pegjs":       path.join(__dirname, "..", "sign.pegjs"),
	"仕様 ja-jp grammar":    path.join(root, "documents", "ja-jp", "impl", "syntax", "grammar.pegjs"),
	"仕様 en-us grammar":    path.join(root, "documents", "en-us", "impl", "syntax", "grammar.pegjs"),
};
for (const [label, file] of Object.entries(grammars)) {
	let parser;
	try {
		parser = peggy.generate(fs.readFileSync(file, "utf8"));
	} catch (e) {
		check(label + ": peggy が受け付ける", "× " + e.message.split("\n")[0], "生成できる");
		continue;
	}
	for (const [name, src, want] of cases) {
		let got;
		// コメントなら Program は空リストを返す（comment は null を返し、最後に濾される）。
		// 式なら1つ以上の Term 列が残る。構文エラーは「式として読もうとした」ことを意味する。
		try { got = parser.parse(src + "\n").length === 0 ? "コメント" : "式"; }
		catch { got = "式"; }
		check(label + ": " + name, got, want);
	}
}

// --- (4) VS Code: TextMate 文法 -------------------------------------------
// Oniguruma だが、この pattern に限れば JS の正規表現と同じ綴りである。
const tm = JSON.parse(fs.readFileSync(path.join(root, "tools", "vscode", "syntaxes", "sign.tmLanguage.json"), "utf8"))
	.repository.comments.patterns[0].match;
const RT = new RegExp(tm);
for (const [name, src, want] of cases) check("VS Code: " + name, RT.test(src) ? "コメント" : "式", want);

// --- (5) Emacs: font-lock -------------------------------------------------
// Emacs の正規表現には先読みが無いので否定を展開して書いてある。ここでは
// `\\(` → `(` / `\\(?:` → `(?:` / `\\)` → `)` と機械的に写して JS で当てる。
let el = fs.readFileSync(path.join(root, "tools", "emacs", "lisp", "sign-mode.el"), "utf8")
	.split(/\r?\n/).find((x) => x.includes("font-lock-comment-face"));
el = el.slice(el.indexOf(DQ) + 1);
el = el.slice(0, el.lastIndexOf(DQ));
const RE = new RegExp(el.replaceAll(BS + BS + "(?:", "(?:").replaceAll(BS + BS + "(", "(").replaceAll(BS + BS + ")", ")"));
for (const [name, src, want] of cases) check("Emacs: " + name, RE.test(src) ? "コメント" : "式", want);

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
