/**
 * **演算子と機械の対応が網羅されていることを見る。**
 *
 * `operator_table.js` の `asm` 欄は「この演算子はどの命令で出るのか」に答える。**答えが無い
 * ことは答えである**——引けば `__` が返り、`__` は唯一の偽である。だが「無い」は2つの別々の
 * 事実を意味する：`-`（negate）は `neg` 1命令で出るはずのものがまだ書かれていないだけで、
 * `:`（define）はそもそも命令にならない。片方の理由の欄にもう片方の言葉を書けば表が嘘をつく。
 *
 * だから答えは3通りあり、**どの綴りもそのどれか1つに居なければならない**：
 *
 *     asm の行            出せる（1命令なら綴り、列なら列の名前）
 *     NOT_YET             機械の意味は在るが pass4 が今日は断る
 *     NOT_AN_INSTRUCTION  そもそも命令にならない（字句・構文・コンパイル時・指令）
 *
 * 網羅とは「ぜんぶ書いた」ではなく**選ばないと通らない**ことである。新しい演算子を足した人は
 * 3つのどれかを選ばされる——どこにも書かなければ、最初の節が落ちる。
 *
 * ## 名簿だけでは足りない
 *
 * 名簿は書いた人の意見であって、実装がそうなっている証拠ではない。だから**実際にコンパイル
 * して確かめる**：
 *
 *     1命令の行   その綴りが本当に出るか（幅・符号・場所の欄ごとに）
 *     列の行      本当に出せるか（断られないか）
 *     NOT_YET     本当に断るか（名指しで）
 *
 * ここが要るのは、**4本の実プログラムでは踏まれない行があるから**である。`ldrh`/`strh`/
 * `sdiv`/`udiv` は lexer.sn・operator_table.sn・parser.sn・preprocess.sn のどれにも1本も
 * 出ていない——アセンブリの全文比較で守れるのは踏まれている道だけで、幅の欄と符号の欄は
 * そこに入っていない。
 *
 * 列（`axis: 'shape'`）の行については「断られないこと」までを見る。行の言明はそこまでで、
 * 実際に出る命令の並びは `.js` 側の行のコメントが持っている——並びをここへ書き写すと、
 * 同じ事実が2箇所になり、最適化のたびに両方を直すことになる。
 *
 * `NOT_AN_INSTRUCTION` は検査できる言明だけ見る。字句・構文のものは「pass4 に節が無い」が
 * そのまま言明なので、探針の書き方そのものが無い。前置 `#` の指令（`.global`/`.hidden`/
 * `.section`）は pass4.test.js の「`#` の段差」が既に見ているので、ここでは繰り返さない。
 *
 * 実行: node test/operator_coverage.test.js（`npm test` からも呼ばれる）
 */
import { compile } from "../compile.js";
import { generateAsm } from "../pass4.js";
import { OPERATOR_BY_PRECEDENCE, NOT_YET, NOT_AN_INSTRUCTION, asmOf } from "../operator_table.js";

let passed = 0;
let total = 0;

function checkTrue(note, cond, detail) {
	total++;
	if (cond) {
		console.log(`OK   ${note}`);
		passed++;
	} else {
		console.log(`FAIL ${note}`);
		if (detail) console.log(`     ${detail}`);
	}
}

const NL = String.fromCharCode(10);
const B = String.fromCharCode(92);
const BQ = String.fromCharCode(96);

// **層は1、割り当ては切る。** 層1は4本の実プログラムと同じ（`~` の持ち上げが場所を取れて、
// 生の番地へも書ける）。割り当てを切るのは、見ているのが命令の選択であって値の居場所では
// ないからである（pass4.test.js の冒頭と同じ理由）。
function emit(src) {
	try {
		const { nodes, env } = compile(src, { charset: "ascii" });
		const r = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii", layer: 1, regAlloc: false });
		return {
			text: r.text,
			// **綴りを見るときはコメントを落とす。** pass4 は命令の後ろに理由を書くので
			// （`csel x9, x11, x12, lt // 真なら値、偽なら __`）、行末まで見る正規表現が
			// コメントに引っかかる。見たいのは綴りとオペランドだけである。
			insns: r.text
				.split(NL)
				.map((l) => l.replace(/\s*\/\/.*$/, ""))
				.join(NL),
			errors: (r.diagnostics || []).filter((d) => (d.severity || d.level) === "error").map((d) => d.message),
		};
	} catch (e) {
		return { text: "", insns: "", errors: [`止まる: ${e.message}`] };
	}
}

const hasInsn = (insns, re) => new RegExp(re, "m").test(insns);

// ---- 1. どの綴りも、3つの答えのどれか1つに居る ----

const bucketsOf = (def) =>
	[
		def.asm ? "asm" : null,
		def.removed ? "廃止" : null,
		NOT_YET[def.name] ? "NOT_YET" : null,
		NOT_AN_INSTRUCTION[def.name] ? "NOT_AN_INSTRUCTION" : null,
	].filter(Boolean);

// **廃止は4つめの名簿ではない。** `removed` は行そのものが持っている印なので、そこに理由が
// 既に書かれている（`===` は「ねじれは `p ' 0` と `p ' 名前` の差で導出できます」）。名簿へ
// 写すと同じ事実が2箇所で決まる。
const allNames = new Set();
for (const tier of OPERATOR_BY_PRECEDENCE) {
	for (const [sym, def] of Object.entries(tier || {})) {
		allNames.add(def.name);
		const b = bucketsOf(def);
		checkTrue(
			`${sym}（${def.position} ${def.name}）の答えが1つに決まっている`,
			b.length === 1,
			b.length === 0 ? "どの名簿にも居ない——出せるなら asm の行を、出せないなら NOT_YET か NOT_AN_INSTRUCTION に理由を書いてください" : `2つ以上に居る: ${b.join(" / ")}`
		);
	}
}

// ---- 2. 名簿の項目は実在する演算子で、理由が1行ある ----

for (const [listName, list] of [["NOT_YET", NOT_YET], ["NOT_AN_INSTRUCTION", NOT_AN_INSTRUCTION]]) {
	for (const [name, reason] of Object.entries(list)) {
		checkTrue(
			`${listName} の ${name} は表に在る名前で、理由が1行`,
			allNames.has(name) && typeof reason === "string" && reason.length > 0 && !reason.includes(NL),
			!allNames.has(name) ? "表にこの名前の演算子が無い（改名か撤去の取り残し）" : "理由が空か、複数行になっている"
		);
	}
}

// ---- 3. 1命令の行は、その綴りが本当に出る ----

// 符号の軸。同じ式を符号ありの型（`Int`）と符号なしの型で呼び分ける——符号はオペランドの型が決める。
//
// **右辺（`R`）は算術と比較で別のものを置く。** 偶然ではなく、どちらも規則から出てくる：
//
//   比較  `unsignedCompare` は「どちらかが符号ありなら符号あり」と決める（`Int` と `Address`
//         を比べる形はそもそも稀である、という判断）。右辺に `2` を置くと `Int` が勝って
//         `lt` が出るので、**番地どうしで比べないと符号なしの欄は踏めない**。
//   算術  符号は結果の型が決める（`reduceToMachineType(n.atomType).signed`）ので右辺は `2`
//         でよい。というより `2` でなければならない——生の番地を算術に使えるのは layer 0
//         だけで、`a + 0x2000` は層の門が断る（番地の捏造を防ぐため）。
//
// **算術の符号なしの欄は `Address` ではなく `Char` で踏む。** 番地の加減算は溢れを見るので、
// 欄の綴りの上に旗を立てる形（`adds`/`subs`）と niche の選択が乗る（pass4 の `CARRY`、
// integer_overflow.md §1.1）——検査するかどうかは符号ではなく結果の型が決める。欄の綴りが
// そのまま命令になるのは、溢れを見ない符号なしの型である。番地の命令は pass4.test.js が綴りを
// 直に書いて留めている（表から引くと、表の嘘に検査が付いて行く）。
const UNSIGNED_OF = { cond: ["Address", "0x1000"], alu: ["Char", `${B}a`] };
const SIGNED_PROBE = {
	add: "a + R",
	sub: "a - R",
	mul: "a * R",
	div: "a / R",
	less: "a < R",
	less_equal: "a <= R",
	assign_equal: "a = R",
	more_equal: "a >= R",
	more: "a > R",
	not_equal: "a != R",
	equal: "a == R",
	xnot_equal: "a !== R",
};

// **比較の条件コードは「偽なら niche」の `csel` から読む。** `csel` はもう1つ出る
// （左辺が算術単位元かを見る段）ので、綴りを探すだけでは当たりが甘い——`eq` はどの比較でも
// 出てしまう。第3オペランドが x12（`__` の niche）のものだけが比較そのものである。
const condOf = (insns) => {
	const m = insns.match(/^\tcsel [^,]+, [^,]+, x12, (\w+)$/m);
	return m ? m[1] : null;
};

for (const [name, template] of Object.entries(SIGNED_PROBE)) {
	const a = asmOf(name);
	for (const [kind, arg] of [["Int", "1"], UNSIGNED_OF[a.form]]) {
		const want = a.gpr[kind === "Int" ? "signed" : "unsigned"];
		const other = a.gpr[kind === "Int" ? "unsigned" : "signed"];
		const expr = template.replace("R", a.form === "cond" && kind === "Address" ? "0x2000" : "2");
		const r = emit(`f : a ? ${expr}${NL}f ${arg}`);
		if (a.form === "cond") {
			checkTrue(`${expr}（${kind}）の条件コードは ${want}`, condOf(r.insns) === want, `出たのは ${condOf(r.insns)} / 診断 ${r.errors.join(" ")}`);
		} else {
			const got = hasInsn(r.insns, `^\\t${want} `);
			// 綴りが分かれる演算（除算だけ）は、**もう片方が出ていないこと**も見る。
			const clean = want === other || !hasInsn(r.insns, `^\\t${other} `);
			checkTrue(`${expr}（${kind}）は ${want} で出る`, got && clean, got ? `${other} も出ている` : `出なかった / 診断 ${r.errors.join(" ")}`);
		}
	}
}

// 囲みの符号の軸。**絶対値は 0 と比べる条件コードを `cneg` に付ける**——比較の行が `csel` に
// 付けるのと同じ欄の読み方で、違うのは付ける先だけである。符号なしの欄は空の綴り（命令が
// 無い）なので、`cneg` そのものが出ないことを見る。
{
	const a = asmOf("abs");
	for (const [kind, arg] of [["Int", "1"], ["Address", "0x1000"]]) {
		const want = a.gpr[kind === "Int" ? "signed" : "unsigned"];
		const r = emit(`f : a ? |a|${NL}f ${arg}`);
		const m = r.insns.match(/^\tcneg [^,]+, [^,]+, (\w+)$/m);
		const got = m ? m[1] : "";
		checkTrue(`|a|（${kind}）の条件コードは ${want || "無い（恒等）"}`, r.errors.length === 0 && got === want, `出たのは ${got || "無し"} / 診断 ${r.errors.join(" ")}`);
	}
}

// 幅の軸。**幅を言うのは番地である**（`NxHHHH` の `N`）。言わなければ語幅になる。
// レジスタまで見る——4 byte と 8 byte は綴りが同じ `ldr` で、`w` か `x` だけが違う。
for (const [name, probe] of [
	["input", (w) => `f : a ? @${w}x9000000`],
	["output", (w) => `f : a ? ${w}x9000000 # 0x4b`],
]) {
	for (const [w, col] of [[1, "w1"], [2, "w2"], [4, "w4"], [8, "w8"], [0, "w8"]]) {
		const want = asmOf(name).gpr[col];
		const wide = col === "w8";
		const r = emit(`${probe(w)}${NL}f 1`);
		checkTrue(
			`${name} の ${w === 0 ? "宣言なし（語幅）" : `${w} byte`} は ${want} ${wide ? "x" : "w"}… で出る`,
			hasInsn(r.insns, `^\\t${want} ${wide ? "x" : "w"}\\d+, \\[`),
			`診断 ${r.errors.join(" ")}`
		);
	}
}

// 場所の軸。フレームは `sp` ではなく **x29 起点**である（`$匿名式` が `sub sp` で場所を
// 取るあいだもフレームの底は動かない）。
{
	const place = asmOf("address").gpr;
	const frame = emit(`f : a ? $a${NL}f 1`);
	checkTrue(`$仮引数 は ${place.frame} …, x29, #… で出る`, hasInsn(frame.insns, `^\\t${place.frame} \\S+, x29, #\\d+`), `診断 ${frame.errors.join(" ")}`);
	const stat = emit(`k : 5${NL}f : a ? $k${NL}f 1`);
	checkTrue(`$束縛 は ${place.static_page} で頁を取る`, hasInsn(stat.insns, `^\\t${place.static_page} \\S+, \\.Lbind_k$`), `診断 ${stat.errors.join(" ")}`);
	checkTrue(`$束縛 は ${place.static_off} …, :lo12: で下位を足す`, hasInsn(stat.insns, `^\\t${place.static_off} \\S+, \\S+, :lo12:\\.Lbind_k$`), `診断 ${stat.errors.join(" ")}`);

	// **関数のラベルはまだ来ない。** 出るとすれば static と同じ `adrp` + `add :lo12:` で、
	// 違うのはラベルだけである（軸は増えない）。表に欄を作っていないのは断っているからで、
	// ここが通らなくなったらそれは実装された日である——行のコメントを直すこと。
	const fn = emit(`g : x ? x + 1${NL}f : a ? $g${NL}f 1`);
	checkTrue("$関数 は今日まだ断られる（関数オブジェクトを返せない理由そのもの）", fn.errors.some((m) => m.includes("アドレスを取れるのはフレームに在るものだけです")), `診断 ${fn.errors.join(" ")}`);
}

// ---- 4. 列の行は、本当に出せる ----

// `want` はその列を名指しできる1本だけにしてある。並び全体は表の側のコメントが持つ。
const SHAPE_PROBE = {
	not: { src: `f : a ? !a${NL}f 1`, want: "^\\tcsel " },
	continuous: { src: `f : a ? ~a${NL}f 1`, want: "^\\tsub sp, sp, #16$" },
	expand: { src: `f : a ? [0 a~]${NL}f [1 2]`, want: "^\\tadd x13, x13, #1$" },
	or: { src: `f : a b ? a | b${NL}f 1 2`, want: "^\\tb\\.ne \\.Lsc" },
	and: { src: `f : a b ? a & b${NL}f 1 2`, want: "^\\tb\\.eq \\.Lsc" },
	product: { src: `f : a b ? [a , b] ' 1${NL}f 1 2`, want: "^\\tstr \\S+, \\[sp, #8\\]$" },
	coproduct: { src: `g : x ? x + 1${NL}f : a ? (g a) + 1${NL}f 1`, want: "^\\tbl g$" },
	range: { src: `f : a ? 1 ~ 5${NL}f 1`, want: "^\\tmovn \\S+, #0$" },
	// `~+` は端点を置くだけで**命令を1つも足さない**。名指しできる綴りが無いので、
	// 見られるのは「断られない」ことだけである——0命令と、出せないことは違う。
	range_arithmetic: { src: `f : a ? 1 ~+ 2${NL}f 1` },
	get_prop: { src: `s : ${BQ}abc${BQ}${NL}f : a ? s ' a${NL}f 1`, want: "^\\tldrb w14, \\[" },
	// ノルムは器なら `len` を読むだけで、その `ldr` は退避の `ldr` と見分けが付かない。
	norm: { src: `f : a ? ||${BQ}abc${BQ}||${NL}f 1` },
};

for (const [name, p] of Object.entries(SHAPE_PROBE)) {
	const r = emit(p.src);
	checkTrue(`列 ${asmOf(name).form}（${name}）は出せる`, r.errors.length === 0, `診断 ${r.errors.join(" ")}`);
	if (p.want) checkTrue(`列 ${asmOf(name).form}（${name}）に ${p.want} が在る`, hasInsn(r.insns, p.want));
}

// ---- 5. NOT_YET は本当に断る ----

// **断り文句は名前を言う**（`まだ出せない式です（negate）`）。黙って別の命令に化けないこと
// ここで見ているのはその一点である。
const NOT_YET_PROBE = {
	xor: `f : a b ? a ; b${NL}f 1 2`,
	mod: `f : a ? a % 2${NL}f 1`,
	pow: `f : a ? a ^ 2${NL}f 1`,
	bit_shift_left: `f : a ? a << 2${NL}f 1`,
	bit_shift_right: `f : a ? a >> 2${NL}f 1`,
	bit_or: `f : a ? a || 2${NL}f 1`,
	bit_xor: `f : a ? a ;; 2${NL}f 1`,
	bit_and: `f : a ? a && 2${NL}f 1`,
	range_arithmetic_rev: `f : a ? 5 ~- 1${NL}f 1`,
	range_geometric: `f : a ? 1 ~* 2${NL}f 1`,
	range_geometric_rev: `f : a ? 8 ~/ 2${NL}f 1`,
	range_power: `f : a ? 2 ~^ 2${NL}f 1`,
	factorial: `f : a ? a!${NL}f 1`,
	bit_not: `f : a ? !!a${NL}f 1`,
	negate: `f : a ? -a${NL}f 1`,
};

for (const [name, src] of Object.entries(NOT_YET_PROBE)) {
	const r = emit(src);
	checkTrue(
		`NOT_YET の ${name} は名指しで断られる`,
		r.errors.some((m) => m.includes(`まだ出せない`) && m.includes(name)),
		`診断 ${r.errors.join(" ")}——出せるようになったなら NOT_YET から asm の行へ移してください`
	);
}

// ---- 6. 探針の側にも穴を空けない ----

// **名簿を増やしたら探針も増える。** ここが無いと、行だけ足して確かめないという抜け道が
// 残る——「選ばないと通らない」を、選んだ後にも効かせる。
{
	const probed = new Set([...Object.keys(SIGNED_PROBE), ...Object.keys(SHAPE_PROBE), "input", "output", "address", "abs"]);
	const missing = [];
	for (const tier of OPERATOR_BY_PRECEDENCE) {
		for (const def of Object.values(tier || {})) {
			if (def.asm && !probed.has(def.name)) missing.push(def.name);
		}
	}
	checkTrue("命令の行はすべて探針を持つ", missing.length === 0, `探針が無い: ${missing.join(" ")}`);

	const notProbed = Object.keys(NOT_YET).filter((n) => !NOT_YET_PROBE[n]);
	checkTrue("NOT_YET の項目はすべて探針を持つ", notProbed.length === 0, `探針が無い: ${notProbed.join(" ")}`);
}

// ---- 7. 命令にならないと言っていることの、検査できる分 ----

{
	// 囲みは中身をそのまま出す。**同じ式なら同じアセンブリ**であって、括りは命令を持たない。
	const paren = emit(`f : a ? (a + 1)${NL}f 1`).text;
	const brace = emit(`f : a ? {a + 1}${NL}f 1`).text;
	checkTrue("(...) と {...} は同一のアセンブリ（括りは命令を持たない）", paren === brace && paren.length > 0);

	// 中置 `@` は pass2 が `'` へ書き換える。**書き換わったのなら、命令列は同じでなければ
	// ならない**——違えば「書き換えている」という理由が嘘になる。
	const at = emit(`s : ${BQ}abc${BQ}${NL}f : a ? a @ s${NL}f 1`).text;
	const quote = emit(`s : ${BQ}abc${BQ}${NL}f : a ? s ' a${NL}f 1`).text;
	checkTrue("a @ s と s ' a は同一のアセンブリ（pass2 が書き換えている）", at === quote && at.length > 0);

	// `\a` は字句であって演算ではない。出るのは文字リテラルそのものである。
	const esc = emit(`f : a ? ${B}a${NL}f 1`);
	checkTrue(`${B}a は文字リテラル（mov …, #97）`, hasInsn(esc.insns, "^\\tmov \\S+, #97$"), `診断 ${esc.errors.join(" ")}`);
}

import fs from "fs";

// ---- 置いてある .sn が、いまの表から生成したものと一致するか ----
//
// `axis` は「落ちる .sn の表の名前」でもある。行を足して生成器を回し忘れると、Sign 側は
// その行へ届かないまま古い表を読む——生成物を版管理に置く形の持病である。生成器は中身を
// `RENDERED` で返すので、ここで突き合わせる（版管理の写しは CRLF、生成器は LF で組むので
// 改行だけ正規化する）。
{
	const { RENDERED } = await import("../../../tools/gen_operator_table.mjs");
	const snPath = new URL("../../sign/operator_table.sn", import.meta.url);
	const onDisk = fs.readFileSync(snPath, "utf8");
	const norm = (x) => x.split(/\r?\n/).join("\n");
	checkTrue("alpha/sign/operator_table.sn は生成物と一致する（node tools/gen_operator_table.mjs を回す）", norm(onDisk) === norm(RENDERED));
}

console.log(`${NL}${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
