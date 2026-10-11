/**
 * **返値の事実と仮引数の要素型は、過渡値から最後の型へ残らない**（pass3 の `annotateAll` の作り直しの相）。
 *
 * 3相目は返値の型と仮引数の要素型を底へ戻して回すが、返値の事実（要素型・指す先・実体の種類）は戻さず、
 * `collectReturns` はそこを「読めたときだけ書く」だった。1相目の途中の値が輪の返値の事実に残り、輪が互いに
 * それを言い返して固める。HEAD（d317c0ca）では、裸の `ts` をそのまま返す `rt` と `row` の輪で `(row s 1) ' 2` が
 * 解釈 99 ／実機 0（診断ゼロ）。lower.sn の `lw_row` → `lw_rowe` → `lw_rowt` は返値の要素型が `Struct` で、
 * そこから `lw_allok` の `ts`・`lw_sig3` の `pt` へ `Struct` が入り、`lw_optv` の返値も `Struct` だった。
 *
 * 作り直しの相（3相目の後）は3つ：
 *
 *   1. 返値：仮引数の型を止め、返値の事実を底から、本体の今の注釈を写して回す。3相目が止まって終わったなら返値の
 *      型も底から作り直す。2周期・上限で終わったなら型は止める（動かすと pass4 の判断が変わる、下の 3）。
 *   2. 仮引数の要素型：返値の型と事実を止め、底から回す。トップレベルの名前だけでできた呼び出しの実引数の要素型が
 *      読めないサイトは、食い違いとして運ぶ（決めない）。
 *   3. 揃える：3相目が止まって終わったなら一緒に回し、そうでなければ返値の事実だけをもう一度写す。
 *
 * 作り直しの相から先は、そのまま返される実引数と呼び先の要素型の合流を狭くする（構造体の実引数・`NO_JOIN` なら
 * その呼び出しの要素型を決めない）。返値の指す先は `@` と同じ口（`pointeeOfNode`）で読む。
 *
 * ここで固定すること：
 *
 *   1. 輪の返値の要素型は、輪の外から来た実引数の要素型（`List(Char)`・`List(String)`）で、`Struct` ではない。
 *      束縛の返値の要素型は、本体の最後の注釈と同じ（写しが残らない）。
 *   2. 括り（`[~ts]`）で返す輪と、3相目が2周期で止まる輪（`ts ' 0~` を返す輪）は、pass4 が今までどおり名指しで断る。
 *   3. 指す先は呼び出しの本体からも運ぶ：`$s` を返す `f` を中継する `g` の返値は `f` と同じ指す先。
 *   4. 要素型の読めない呼び出しの実引数があるサイトから、仮引数の要素型を決めない（`f (g p)` の `g` が指す先経由で
 *      構造体を返す形・族の切片）。
 *   5. 構造体の実引数・合流しない実引数をそのまま返す呼び出しは、要素型を決めない（名指しの断り）。
 *   6. 束（lower.sn＋codegen.sn）：`lw_row` 一家の返値の要素型は `String`、`lw_optv` の返値は `String`、
 *      `lw_allok`・`lw_sig2`・`lw_sig3` の仮引数は `String` の並び、parser.sn の `has`・`count_op` は元の型のまま。
 *      作り直しの3回はどれも上限の前で止まり、2周期で止まらない。
 *
 * 実機の答え（輪が解釈器と一致する・名指しで断る）は qemu.test.js の「返値の事実のラッチ」が見る。
 *
 * 実行: node test/return_fact_latch.test.js（`npm test` からも呼ばれる）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";
import { generateSignType } from "../st.js";
import { evaluate, newRuntimeEnv, isUnit, observe, UNIT } from "../interpreter.js";
import { generateAsm } from "../pass4.js";
import { blockingOf } from "../errors.js";
import { envLookup } from "../pass1.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIGN = path.join(__dirname, "..", "..", "sign");
const readImport = (p) => fs.readFileSync(path.join(SIGN, p), "utf8").split("\r\n").join("\n");

let passed = 0;
let total = 0;

function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) {
		console.log(`OK   ${note}`);
		passed++;
	} else {
		console.log(`FAIL ${note}`);
		console.log(`     got:  ${JSON.stringify(got)}`);
		console.log(`     want: ${JSON.stringify(want)}`);
	}
}

// `.ist` の行を名前ごとに（メモリの中だけ。ディスクへは書かない）。
function istRows(nodes, env) {
	const out = {};
	for (const l of generateSignType(nodes, env, { scope: "ist" }).text.split("\n")) {
		const m = l.match(/^#*([A-Za-z_][A-Za-z_0-9]*) : (.* -> .*)$/);
		if (m && !(m[1] in out)) out[m[1]] = m[2];
	}
	return out;
}
const pick = (r, names) => names.map((n) => `${n} : ${r[n]}`);

function pass4Of(source) {
	const { nodes, env } = compile(source, { charset: "ascii" });
	const r = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii", layer: 1 });
	const bad = blockingOf(r.diagnostics);
	return { refusal: bad.length ? bad[0].message : null, estimate: r.diagnostics.some((d) => /上界は見積もり/.test(d.message)) };
}
const refusal = (source) => pass4Of(source).refusal;
const refusedWith = (source, why) => {
	const r = refusal(source);
	return r !== null && r.includes(why);
};

// 解釈器の答え（最後の文の値）。1文字は符号位置で。
function value(source) {
	const { nodes } = compile(source, { charset: "ascii" });
	const env = newRuntimeEnv(null, "ascii");
	let r = UNIT;
	for (const n of nodes) r = evaluate(n, env);
	if (isUnit(r)) return "__";
	const o = observe(r);
	return typeof o === "string" && [...o].length === 1 ? o.codePointAt(0) : o;
}

const bind = (scope, name) => envLookup(scope, `<${name}>`) || envLookup(scope, name);
// トップレベルの関数 `fn` の仮引数 `p` の束縛。
function paramOf(nodes, fn, p) {
	const n = nodes.find((x) => x && x.type === "operation" && x.name === "define" && x.left && x.left.value === `<${fn}>`);
	return n && n.right && n.right.scope ? bind(n.right.scope, p) : null;
}

// 束縛の返値の要素型が、本体の最後の注釈と食い違うトップレベルの関数（名前だけ）。
function stale(nodes, env) {
	const out = [];
	for (const n of nodes) {
		if (!n || n.type !== "operation" || n.name !== "define" || !n.right || n.right.name !== "lambda") continue;
		const b = envLookup(env, n.left.value);
		if (!b || b.returns === null || b.returns === undefined) continue;
		const body = n.right.right && n.right.right.elementType;
		if ((b.returnsElementType || null) !== (body || null)) out.push(String(n.left.value).replace(/^<|>$/g, ""));
	}
	return out;
}

const P = "p :\n\tfoo : 10\n\tbar : 20\n\tbaz : 30\n";
const REC = "mk : [~s] ?\n\t!s : __\n\t(s ' 0) , (mk (s ' 1~))~\n";
const LIT3 = "mk : [~s] ? `ab` , `cde` , s\n";
const TWO = (form) => `row : [~s] n ? rt (mk s) s n\nrt : ${form} [~s] n ?\n\tn = 0 : ts\n\trow s (n - 1)\n`;
const THREE = "row : [~s] n ? mid s n\nmid : [~s] n ? rt (mk s) s n\nrt : ts [~s] n ?\n\tn = 0 : ts\n\trow s (n - 1)\n";
const COND = "row : [~s] n ? rt (mk s) s n\nrt : ts [~s] n ?\n\t||ts|| > n : ts\n\trow s (n - 1)\n";

// ---- 1. 輪の返値の要素型は、輪の外から来た実引数の要素型 ----
{
	const src = REC + TWO("ts") + "top : [~s] ? (row s 1) ' 2\ntop `abcd`\n";
	const { nodes, env } = compile(src, { charset: "ascii" });
	check("2本の輪（裸の ts を返す）：row・rt の返値の要素型は Char（HEAD は Struct）", ["row", "rt"].map((n) => bind(env, n).returnsElementType), ["Char", "Char"]);
	check("2本の輪：.ist の row・rt は List(Char)", pick(istRows(nodes, env), ["row", "rt"]), ["row : String Int -> List(Char)", "rt : List(Char) String Int -> List(Char)"]);
	check("2本の輪：束縛の返値の要素型は本体の最後の注釈と同じ", stale(nodes, env), []);
	check("2本の輪：値は変わらない（解釈器）", value(src), 99);
	check("2本の輪：pass4 が出せる", refusal(src), null);
}
{
	const src = REC + THREE + "top : [~s] ? ((row s 1) ' 1) ' 0\ntop `abcd`\n";
	const { nodes, env } = compile(src, { charset: "ascii" });
	check("3本の輪：row・mid・rt の返値の要素型は Char", ["row", "mid", "rt"].map((n) => bind(env, n).returnsElementType), ["Char", "Char", "Char"]);
	check("3本の輪：束縛の返値の要素型は本体の最後の注釈と同じ", stale(nodes, env), []);
}
{
	const src = REC + COND + "top : [~s] ? (row s 1) ' 2\ntop `abcd`\n";
	const { env } = compile(src, { charset: "ascii" });
	check("条件で抜ける輪：rt の返値の要素型は Char", bind(env, "rt").returnsElementType, "Char");
}
{
	const src = LIT3 + TWO("ts") + "top : [~s] ? ||row s 1||\ntop `abcd`\n";
	const { nodes, env } = compile(src, { charset: "ascii" });
	check("ab , cde , s を返す輪：row・rt の返値の要素型は String", ["row", "rt"].map((n) => bind(env, n).returnsElementType), ["String", "String"]);
	check("ab , cde , s を返す輪：束縛の返値の要素型は本体の最後の注釈と同じ", stale(nodes, env), []);
	// 上界は見積もり（HEAD と同じ information）。短い入力で外れたときに踏み抜かないことは qemu.test.js が見る。
	check("ab , cde , s を返す輪：上界が見積もりであることを information で名指しする", pass4Of(src).estimate, true);
}
{
	// 輪の外から rt を直に呼ぶサイト（長さの揃わない入れ子の並び）がもう1つある形。HEAD は解釈 121 ／実機は並びを
	// Struct として引いた別の数。
	const src = REC + TWO("ts") + "z : rt [[1 2] , [3 4 5]] `ab` 0\ntop : [~s] ? ((row s 1) ' 1) ' 0\ntop `xy`\n";
	const { env } = compile(src, { charset: "ascii" });
	check("rt を入れ子の並びで直に呼ぶサイトもある輪：row の返値の要素型は Char", bind(env, "row").returnsElementType, "Char");
	check("rt を入れ子の並びで直に呼ぶサイトもある輪：値は変わらない（解釈器）", value(src), 121);
}

// ---- 2. 括りで返す輪・3相目が2周期で止まる輪は、名指しで断ったまま ----
{
	const src = REC + TWO("[~ts]") + "top : [~s] ? (row s 1) ' 2\ntop `abcd`\n";
	const { env } = compile(src, { charset: "ascii" });
	check("括りの ts を返す輪：rt の返値の要素型は Char", bind(env, "rt").returnsElementType, "Char");
	check("括りの ts を返す輪：pass4 は名指しで断る（第1引数の場所）", refusedWith(src, "第1引数の場所が足りません"), true);
}
for (const [label, mk, top] of [
	["ab , cde , s", LIT3, "top : [~s] ? ||row s 1||\ntop `xy`\n"],
	["s , s", "mk : [~s] ? s , s\n", "top : [~s] ? (row s 1) ' 2\ntop `abcd`\n"],
]) {
	// `n = 0 : ts ' 0~` を返す輪は、3相目の型が2周期で止まる。作り直しの相が返値の型を動かすと、row の返値の型が
	// `Container` から `List` へ入れ替わり、pass4 は上界を見積もりにして出した——短い入力で解釈 3 ／実機 0（information だけ）。
	const src = mk + "row : [~s] n ? rt (mk s) s n\nrt : [~ts] [~s] n ?\n\tn = 0 : ts ' 0~\n\trow s (n - 1)\n" + top;
	const stats = [];
	const { env } = compile(src, { charset: "ascii", fixpointStats: stats });
	check(`${label} の切り出しを返す輪：3相目は2周期で止まる（前提）`, !!(stats[2] && stats[2].cycled), true);
	check(`${label} の切り出しを返す輪：row の返値の型は3相目のまま（Container）`, bind(env, "row").returns, "Container");
	check(`${label} の切り出しを返す輪：pass4 は名指しで断る（第1引数の場所）`, refusedWith(src, "第1引数の場所が足りません"), true);
}

// ---- 3. 指す先は呼び出しの本体からも運ぶ ----
{
	const src = "f : [~s] ? $s\ng : [~t] ? f t\nx : f [1 2 3]\n(@(g [4 5 6])) ' 1\n";
	const { env } = compile(src, { charset: "ascii" });
	check("$s を返す f を中継する g：返値の指す先は f と同じ（HEAD の g は指す先を持たない）", [bind(env, "f").returnsPointee, bind(env, "g").returnsPointee], ["List", "List"]);
	// HEAD は `@(g …)` を Raw（機器の番地）として読み、解釈 5 ／実機 `__`（診断ゼロ）。
	check("$s を返す f を中継する g：`(@(g …)) ' 1` は名指しで断る", refusedWith(src, "get_prop"), true);
	const poly = "sl : [~w] ? w ' (1 ~ 3)\nf : [~s] ? $s\ng : [~t] ? f t\nx : f [1 2 3]\n(@(g (sl `wxyz`))) ' 1\n";
	check("f を List(Int) と切片の両方で呼ぶ形：名指しで断る（要素の幅、HEAD と同じ）", refusedWith(poly, "要素の幅が合いません"), true);
}

// ---- 3b. 違う器で呼ばれる仮引数は3相目の値のまま・止まらない回は相ごと戻す ----
{
	// f の s は List(Int) と文字列の切片で呼ばれ、作り直しの相では決まらない。3相目の値（Int）を持ち続けるので、
	// 中継 g の呼び出しで pass4 の門が要素の幅の食い違いを名指しする。
	const poly = "sl : [~w] ? w ' (1 ~ 3)\nf : [~s] ? $s\ng : [~t] ? f t\nx : f [1 2 3]\n(@(g (sl `wxyz`))) ' 1\n";
	const { nodes } = compile(poly, { charset: "ascii" });
	check("違う器で呼ばれる f の s：要素型は3相目の値（Int）のまま", (paramOf(nodes, "f", "s") || {}).elementType || null, "Int");
	// f の s の型は String と Container の2周期。作り直しの相の回が止まらなければ相ごと戻す（3相目の String のまま）。
	const cyc = "id : t ? t\nf : [~s] ? id s\nap : h v ? @h v\nx : f `abcd`\n(ap $f [1 2 3]) ' 1\n";
	const stats = [];
	const r = compile(cyc, { charset: "ascii", fixpointStats: stats });
	check("止まらない作り直しの回は相ごと戻す：f の s は3相目の String のまま", (paramOf(r.nodes, "f", "s") || {}).atomType, "String");
	check("止まらない作り直しの回は相ごと戻す：最後の回は2周期か上限（前提）", stats.slice(3).some((s) => s.cycled || s.rounds >= s.limit), true);
	check("止まらない作り直しの回は相ごと戻す：pass4 は名指しで断る（要素の幅）", refusedWith(cyc, "要素の幅が合いません"), true);
}

// ---- 4. 要素型の読めない呼び出しの実引数があるサイトから、仮引数の要素型を決めない ----
{
	const src = P + "f : s ? s ' 1\nap : h v ? @h v\ni2 : [~t] ? t\ng : [~t] ? ap $i2 t\nx : f ([1 2 3])\nf (g p)\n";
	const { nodes } = compile(src, { charset: "ascii" });
	check("f (g p) の g は指す先経由で構造体を返す：f の s の要素型は決めない", (paramOf(nodes, "f", "s") || {}).elementType || null, null);
	check("f (g p)：名指しで断る", refusedWith(src, "get_prop"), true);
	// 族の切片（`fa`）を渡すサイト。HEAD は List(Int) で決めて、文字列の3バイトを Int として読んだ（解釈 97 ／実機 6513249）。
	const lt2 = "f : [~s] ? s ' 0\nfa : [~w] ? w ' (0 ~ 1)\nx : f [1 2]\nz : fa \\x\nf (fa `abc`)\n";
	check("族の切片を渡すサイト：名指しで断る（HEAD は黙った誤答）", refusal(lt2) !== null, true);
}

// ---- 5. 合流しない実引数をそのまま返す呼び出しは、要素型を決めない ----
{
	const alias = P + "mk : [~s] ? s\nf : [~s] n ?\n\tn = 0 : s\n\tr2 s (n - 1)\nr2 : [~s] n ? f (mk s) n\ng : f\nx : g [1 2 3 4] 1\n(f p 1) ' 1\n";
	check("構造体を渡す呼び出し（別名のサイトがある輪）：名指しで断る", refusedWith(alias, "get_prop"), true);
	const id = P + "f : s ? s ' 1\nid : t ? t\nx : f [1 2 3]\nf (id p)\n";
	check("恒等の中継で構造体を渡す：名指しで断る", refusedWith(id, "get_prop"), true);
	const two = P + "f : [~s] [~t] n ?\n\tn = 0 : s\n\tt\nx : f [1 2 3] p 0\n(f p [1 2 3] 0) ' 1\n";
	// HEAD は返す位置の順で先に来た List(Int) を採り、構造体の欄を並びとして引いた（解釈 20 ／実機 `__`）。
	check("2つの位置を返す呼び出し：名指しで断る（HEAD は黙った誤答）", refusedWith(two, "get_prop"), true);
}

// ---- 6. 束 ----
{
	const SRC = readImport("lower.sn") + "\n" + readImport("codegen.sn") + "\ng_run (lw_prog `1` `x` `y`)\n";
	const stats = [];
	const { nodes, env } = compile(SRC, { readImport, charset: "ascii", fixpointStats: stats });
	const retEl = (n) => (bind(env, n) || {}).returnsElementType || null;
	check("束：lw_row・lw_rowe・lw_rowt の返値の要素型は String（HEAD は Struct）", ["lw_row", "lw_rowe", "lw_rowt"].map(retEl), ["String", "String", "String"]);
	check("束：lw_row の返値の型は List（HEAD は輪が言い返した Container）", (bind(env, "lw_row") || {}).returns, "List");
	check("束：lw_optv の返値は String（HEAD は Struct）", (bind(env, "lw_optv") || {}).returns, "String");
	const el = (fn, p) => (paramOf(nodes, fn, p) || {}).elementType || null;
	check("束：lw_allok の ts・lw_sig2 の r・lw_sig3 の pt の要素型は String（HEAD は Struct）", [el("lw_allok", "ts"), el("lw_sig2", "r"), el("lw_sig3", "pt")], ["String", "String", "String"]);
	const r = istRows(nodes, env);
	check("束：parser.sn の has・count_op は元の型のまま", pick(r, ["has", "count_op"]), ["has : Char String -> Char", "count_op : String -> Int"]);
	check("束：束縛の返値の要素型は本体の最後の注釈と同じ", stale(nodes, env), []);
	check("束：3相の後に作り直しの回が回る", stats.length >= 6, true);
	check("束：3相の後の回はどれも上限の前で止まり、2周期で止まらない", stats.slice(3).every((s) => s.rounds < s.limit && !s.cycled), true);
}

// ---- 7. 投げた compile の旗が、次の compile へ漏れない ----
{
	// 毒：作り直しの相で構造体のマージの型が衝突して投げる（foo が Struct と Char、list_model §5.3）。
	const POISON = "q :\n\ta : 1\np :\n\tfoo : q\n\tbar : 20\nmk : [~s] ? `ab` , `cde` , s\nrow : [~s] n ? rt (mk s) s n\n" +
		"rt : [~ts] [~s] n ?\n\tn = 0 : ts\n\trow s (n - 1)\nuse : u ? (p~ [foo : u ' 0]~) ' bar\ntop : [~s] ? use (row s 1)\ntop `abcd`\n";
	let threw = false;
	try {
		compile(POISON, { charset: "ascii" });
	} catch (e) {
		threw = true;
	}
	check("毒：作り直しの相で構造体のマージの型の衝突を投げる（前提）", threw, true);
	// 犠牲：lexer.sn の tokens を返す輪。HEAD でも、毒の後でも、名指しで断る（第1引数の場所）。
	const LEX = readImport("lexer.sn").replace(/\ntokens `[^`]*`\n$/, "\n");
	const RING = "mk : [~s] ? tokens s\nrow : [~s] n ? rt (mk s) s n\nrt : [~ts] [~s] n ?\n\tn = 0 : ts\n\trow s (n - 1)\n";
	check("犠牲の前提：lexer.sn の最後の呼び出しを外せた", LEX.endsWith("\n") && !/\ntokens `[^`]*`\n$/.test(LEX), true);
	for (const [label, top] of [
		["||row s 1||", "top : [~s] ? ||row s 1||\ntop `ab cd ef`\n"],
		["((row s 1) ' 1) ' 0", "top : [~s] ? ((row s 1) ' 1) ' 0\ntop `ab cd ef`\n"],
		["||(row s 1) ' 2||", "top : [~s] ? ||(row s 1) ' 2||\ntop `ab cd ef`\n"],
	]) {
		try {
			compile(POISON, { charset: "ascii" });
		} catch (e) {
			// 投げるのが毒の役目
		}
		check(`毒の後の tokens の輪 ${label}：pass4 は名指しで断る（第1引数の場所）`, refusedWith(LEX + RING + top, "第1引数の場所が足りません"), true);
	}
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
