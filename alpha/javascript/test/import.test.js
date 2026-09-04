/**
 * **インポートはコンパイル時に解ける**（build_system.md §4.2）。
 *
 * `` `lib/x.sn`@~ `` は「そのファイルを読んで（`@`）、束縛をここへ撒く（`~`）」で
 * あり、後置演算子2つの意味そのままである。専用の構文は要らないし、走らせる側には何も
 * 残らない——読むのはビルド時である（Zig の `@import` と同じ立場で、layer 4 の話ではない）。
 *
 * 読み手（`readImport`）は呼ぶ側が渡す。`compile.js` は fs に触らない——playground でも
 * 同じ道が通る必要があるからで、ファイルを読むのはドライバの仕事である。
 *
 * 実行: node test/import.test.js
 */
import { compile } from "../compile.js";

let passed = 0;
let total = 0;
function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
	if (!ok) console.log(`     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
}
function checkThrows(note, fn, needle) {
	total++;
	let msg = null;
	try { fn(); } catch (e) { msg = String(e.message); }
	const ok = msg !== null && msg.includes(needle);
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
	if (!ok) console.log(`     got: ${msg === null ? "（止まらなかった）" : msg}`);
}

// ファイルはメモリの上に置く。**読むのはドライバの仕事**なので、テストがその役をやれる。
const FILES = {
	"m/lib.sn": "double : n ? n * 2\n\n#inc : n ? n + 1\n\n`実行例`\ninc 100\n",
	"m/deep/x.sn": "x : 5\n",
	"m/uses_deep.sn": "`deep/x.sn`@~\n\ny : x + 1\n",
	"m/a.sn": "`b.sn`@~\n\na : 1\n",
	"m/b.sn": "`a.sn`@~\n\nb : 2\n",
};
const opts = (self) => ({
	charset: "ascii",
	sourcePath: self,
	readImport: (f) => {
		if (!(f in FILES)) throw new Error("no such file");
		return FILES[f];
	},
});
const names = (src, self) =>
	compile(src, opts(self)).nodes.map((n) => (n && n.name === "define" && n.left ? String(n.left.value) : "(式)"));

// **撒かれるのは束縛である。** モジュールの末尾にある実行例まで持ってくると、最後の式が
// 入れ替わる——`_sign_main` が返すのはそれなので、**黙って別の値になる**。
check("束縛が撒かれる", names("`lib.sn`@~\ninc (double 20)\n", "m/main.sn"), ["<double>", "<inc>", "(式)"]);

// **同じファイルは一度だけ撒く。** 定義が2つになると後の定義が勝つので、黙って別物になる。
check("同じものを2回書いても1度", names("`lib.sn`@~\n`lib.sn`@~\ninc 1\n", "m/main.sn"), ["<double>", "<inc>", "(式)"]);

// 相対パスは**そのファイルから**見る。撒いた先がさらに撒いても同じ規則である。
check("相対パスはそのファイルから", names("`uses_deep.sn`@~\ny\n", "m/main.sn"), ["<x>", "<y>", "(式)"]);

// **循環は通してよい。** 同じファイルは一度しか撒かないので定義はそれぞれ1つになり、
// トップレベルの定義は順序に依らない——循環するインポートはファイルを跨いだ相互再帰
// でしかない（`sep` と `in_quote` が同じファイルで呼び合えるのと同じ話）。
check("循環しても定義は1つずつ", names("`a.sn`@~\na + b\n", "m/main.sn"), ["<b>", "<a>", "(式)"]);

// **入口のファイル自身も「撒き済み」として数える。** 循環したときに入口が自分を撒き直し、
// 同じ定義が2つになる。
check("入口は自分を撒き直さない", names(FILES["m/a.sn"], "m/a.sn"), ["<b>", "<a>"]);

// 名指しして止める。**黙って空のモジュールにしない。**
checkThrows("読めないファイルは名指しで止まる", () => names("`nope.sn`@~\n1\n", "m/main.sn"), "インポートが読めません");
checkThrows(
	"読み手が無ければ名指しで止まる",
	() => compile("`lib.sn`@~\n1\n", { charset: "ascii" }),
	"インポートを解決する手段がありません"
);

// `@` だけ（撒かない）はインポートではない。裸のテキスト1つはコメントである。
//
// **この検査は名前と食い違っていた。** 「コメントである」と言いながら、期待値は式2つ
// ——つまりコメントとして落ちていなかった。行頭のバッククォートは「閉じたか」ではなく
// 「閉じたうえで後続があるか」で式になる（string_and_comment.md §2）。`` `lib.sn` `` は
// 後続が無いのでコメントであり、残る式は `1` だけである。
check("撒かなければインポートではない（裸のテキストはコメント）", names("`lib.sn`\n1\n", "m/main.sn"), ["(式)"]);
// 後続があれば式になる——それが唯一「行頭から文字列を始める」形である（インポート）。
check("後続があればインポートとして読む", names("`lib.sn`@~\ninc 1\n", "m/main.sn"), ["<double>", "<inc>", "(式)"]);

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
