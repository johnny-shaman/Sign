/**
 * Lambda定義行（トップレベルに `?` を持つ行）の仮引数部専用処理の動作確認。
 *
 * 背景: `:`(define, precedence=1)と`?`(lambda, precedence=2)は演算子テーブル上もっとも
 * 低い優先度で処理されるため、仮引数部を総当たり縮約に素通しすると、`?`が処理される前に
 * 仮引数部の中身が既存の汎用ルールで誤って確定してしまう（`g x` → construct[g,x]、
 * `y : x + 1` → define[y, add[x,1]]）。pass2.js の reduceAll に追加した専用分岐
 * （resolveLambdaLine / buildParameterList）が、これを正しく「パラメータの宣言」として
 * 扱えることを確認する。
 *
 * 実行: node test/param_list.test.js
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

function show(node) {
	if (node === null) return "null";
	if (node.type === "atom") return `${node.kind}(${node.value})`;
	if (node.type === "operation") {
		if (node.position === "prefix" || node.position === "postfix") return `${node.name}(${show(node.operand)})`;
		return `${node.name}[${show(node.left)}, ${show(node.right)}]`;
	}
	if (node.type === "block") return `${node.kind}{${node.lines.map(show).join("; ")}}`;
	if (node.type === "params") {
		return `params[${node.entries.map((e) => (e.rest ? `~${e.name}` : e.default ? `${e.name}:${show(e.default)}` : e.name)).join(", ")}]`;
	}
	if (node.type === "unresolved") return `UNRESOLVED[${node.items.map((x) => (typeof x === "string" ? x : show(x))).join(", ")}]`;
	return JSON.stringify(node);
}

function resolveSource(source) {
	const pre = preprocess(source);
	const lines = parser.parse(pre);
	const env = buildEnv(lines);
	return lines.map((line) => show(reduceAll(line, env)));
}

const cases = [
	{
		// 関数名を「apply」にしなかったのは意図的: `g` は `@` を付けない限り Atom 扱いのため、
		// 本体 `g x` は関数適用ではなく construct[g,x]（ただのタプル作成）にしかならない
		// （type_system.md §3.5）。実際に g を x に適用する正しい書き方は次のケース（@g x）。
		source: "pair : g x ? g x",
		want: ["define[identifier(<pair>), lambda[params[<g>, <x>], construct[identifier(<g>), identifier(<x>)]]]"],
		note: "裸の複数仮引数 (g x) が params[] として構造化される（以前は construct[g,x] に誤って縮約されていた）",
	},
	{
		source: "apply : g x ? @g x",
		want: ["define[identifier(<apply>), lambda[params[<g>, <x>], apply[input(identifier(<g>)), identifier(<x>)]]]"],
		note: "@g x（前置@で明示的に呼び出す）は正しく apply[g, x] に解決される。g x（@無し）とは違う挙動になることの確認",
	},
	{
		source: "f : x ~xs ? x",
		want: ["define[identifier(<f>), lambda[params[<x>, ~<xs>], identifier(<x>)]]"],
		note: "裸のrestパラメータ (x ~xs) も params[] 内で正しく分割される",
	},
	{
		source: "get_age : [x ~xs] ? x",
		want: ["define[identifier(<get_age>), lambda[params[<x>, ~<xs>], identifier(<x>)]]"],
		note: "ブラケット形式 [x ~xs]（1行に複数の裸パラメータが同居）でも正しく分割される",
	},
	{
		source: "f :\n\tx\n\ty : x + 1\n\tz : y + 1\n\t~rest\n? x y z rest~",
		want: [
			"define[identifier(<f>), lambda[params[<x>, <y>:add[identifier(<x>), number(1)], <z>:add[identifier(<y>), number(1)], ~<rest>], construct[construct[construct[identifier(<x>), identifier(<y>)], identifier(<z>)], expand(identifier(<rest>))]]]",
		],
		note: "インデントブロック形のデフォルト引数: y:x+1 は add[x,1] として（define扱いされずに）解決され、z:y+1 は let* 的にひとつ前の y を正しく参照する",
	},
	{
		source: "f :\n\t[\n\t\tx\n\t\t~y\n\t]\n? x",
		want: ["define[identifier(<f>), lambda[params[<x>, ~<y>], identifier(<x>)]]"],
		note: "ブラケットを定義行より深くインデントして複数行で書いても（lexer.jsのbracketDepth対応）正しくパースされる",
	},
	{
		source: "func_mixed :\n\t[\n\t\tx\n\t\ty : x + 1\n\t\t~z\n\t]\n? x",
		want: [
			"define[identifier(<func_mixed>), lambda[params[<x>, <y>:add[identifier(<x>), number(1)], ~<z>], identifier(<x>)]]",
		],
		note: "function_guide.mdのfunc_mixed例: ブラケット形式（複数行）とデフォルト引数の組み合わせが正しく解決される",
	},
];

let passed = 0;
let total = 0;

for (const c of cases) {
	total++;
	const got = resolveSource(c.source);
	const ok = JSON.stringify(got) === JSON.stringify(c.want);
	if (ok) {
		console.log(`OK   ${c.note}`);
		passed++;
	} else {
		console.log(`FAIL ${c.note}`);
		console.log(`     source: ${JSON.stringify(c.source)}`);
		console.log(`     got:  ${JSON.stringify(got)}`);
		console.log(`     want: ${JSON.stringify(c.want)}`);
	}
}

// let*的な逐次スコープの強制: 前方参照・自己参照はReferenceErrorになる
const throwCases = [
	{
		source: "f :\n\tx\n\ty : z + 1\n\tz : 1\n? x y z",
		note: "前方参照: y のデフォルト式が、まだ束縛されていない後ろの z を参照 → ReferenceError",
	},
	{
		source: "f :\n\tx\n\ty : y + 1\n? x y",
		note: "自己参照: y のデフォルト式が自分自身の y を参照 → ReferenceError",
	},
];

for (const c of throwCases) {
	total++;
	let threw = false;
	try {
		resolveSource(c.source);
	} catch (e) {
		threw = e instanceof ReferenceError;
	}
	if (threw) {
		console.log(`OK   ${c.note}`);
		passed++;
	} else {
		console.log(`FAIL ${c.note}`);
		console.log(`     source: ${JSON.stringify(c.source)}`);
		console.log(`     expected ReferenceError, got threw=${threw}`);
	}
}

// requiredArity: デフォルト・rest以外の仮引数の数が正しく計算されること
{
	total++;
	const pre = preprocess("f :\n\tx\n\ty : x + 1\n\tz : y + 1\n\t~rest\n? x y z rest~");
	const lines = parser.parse(pre);
	const env = buildEnv(lines);
	const defineNode = reduceAll(lines[0], env);
	const requiredArity = defineNode.right.left.requiredArity;
	const note = "requiredArity: x のみデフォルト・rest無しなので 1 になる（y,z はデフォルト、rest は rest）";
	if (requiredArity === 1) {
		console.log(`OK   ${note}`);
		passed++;
	} else {
		console.log(`FAIL ${note}`);
		console.log(`     got requiredArity: ${requiredArity}, want: 1`);
	}
}

// 原理4 ルール3: 仮引数部のデフォルト式での `#`（Output）を静的に拒否する。
//
// これは「型が合わない」違反ではない——`ptr # 42` は式として正当である。位置が許されて
// いない。今日の方針では型の不一致は停止させず `__` へ収束させるため、`TypeError` では
// なく `OperationError` を使い、停止する違反と `__` へ落ちる収束を種別で見分けられるようにする。
//
// 禁じる根拠は評価が条件付きであること。デフォルト式はその引数が省略されたときにだけ
// 評価されるため、Store を書くと書き込みが起きるか否かが呼び出し側の引数の個数で決まる。
// 同じ `name : 値` の形をしていても、構造体リテラルのスロットは無条件に1回だけ評価される
// ので、そちらでは禁じてはならない（評価が条件付きかどうかが正反対）。
function checkOperationError(note, source, shouldThrow) {
	total++;
	let threw = false;
	let name = null;
	try {
		const env = buildEnv(parser.parse(preprocess(source)));
		for (const node of parser.parse(preprocess(source))) reduceAll(node, env);
	} catch (e) {
		threw = true;
		name = e.name;
	}
	const ok = shouldThrow ? threw && name === "OperationError" : !threw;
	if (ok) {
		console.log(`OK   ${note}`);
		passed++;
	} else {
		console.log(`FAIL ${note}`);
		console.log(`     threw: ${threw}（${name}）, shouldThrow: ${shouldThrow}`);
	}
}

checkOperationError("デフォルト式の `#` は OperationError", "ptr : 0x40011000\nbad :\n\tx : ptr # 42\n? x", true);
checkOperationError("デフォルト式の `@`（Input）は許可（状態の初期化）", "ptr : 0x40011000\ng :\n\tx : @ptr\n? x", false);
checkOperationError("本体の `#` は許可（無条件に評価される）", "ptr : 0x40011000\ng :\n\tx\n? ptr # x", false);
checkOperationError("構造体リテラルの `#` は許可（スロットは無条件に1回評価）", "ptr : 0x40011000\ns : [\n\tx : ptr # 5\n\ty : 2\n]", false);
checkOperationError("入れ子の式に隠れた `#` も見つける", "ptr : 0x40011000\nbad :\n\tx : ptr # 42 + 1\n? x", true);
checkOperationError("括弧で包んだ `#` も見つける", "ptr : 0x40011000\nbad :\n\tx : 1 + (ptr # 42)\n? x", true);

// デフォルト式の中で括弧・ブラケットが使えること。
//
// pass1 の countStatements は「全要素が文字列」でなければ行ではなく文の並びと判断し、
// 中身へ降りていた。デフォルト式に括弧が入ると中に配列が現れて平坦でなくなるため、
// 最終的に**文字列**トークンを受け取る。文字列に対する `for...of` は1文字ずつ回るので、
// そこから自分自身を呼び直して無限再帰していた——デフォルト引数の中で括弧が一切
// 使えず、スタックオーバーフローになっていた。デフォルト引数は仕様上ローカル変数の
// 置き場（function_guide.md「仮引数リストは関数の状態ベクタである」）なので、
// そこで括弧が書けないのは実用上かなり痛い。
function checkDefaultValue(note, source, want) {
	total++;
	let got;
	try {
		const env = buildEnv(parser.parse(preprocess(source)));
		const nodes = parser.parse(preprocess(source)).map((n) => reduceAll(n, env));
		got = nodes.length > 0 ? "ok" : "empty";
	} catch (e) {
		got = `${e.name}: ${e.message.slice(0, 40)}`;
	}
	if (got === want) {
		console.log(`OK   ${note}`);
		passed++;
	} else {
		console.log(`FAIL ${note}`);
		console.log(`     got: ${got}, want: ${want}`);
	}
}

checkDefaultValue("デフォルト式のカッコ（`x : (2 + 3)`）が縮約できる", "f :\n\ta\n\tx : (2 + 3)\n? a + x", "ok");
checkDefaultValue("デフォルト式のブラケット（`x : [2 + 3]`）も同様", "f :\n\ta\n\tx : [2 + 3]\n? a + x", "ok");
checkDefaultValue("let* で前のパラメータを括弧越しに参照できる", "f :\n\ta\n\tx : a + (a * 2)\n? x", "ok");

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
