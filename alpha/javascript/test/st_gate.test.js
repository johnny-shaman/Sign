/**
 * **`.st` 経由で合流する道の門。**
 *
 * `import` はこれまでコンパイル時に**ソースを読んで**合流していた（`compile.js` の
 * `resolveImports`）。つまり依存の実体はソースであって、`.st` は誰にも読まれていない
 * 成果物だった。葉に値を載せ、読む側（`st_read.js`）を置いた今、問うべきは1つである
 * ——**ソースを渡さずに `.st` だけで、同じ `.s` が出るか。**
 *
 * 門は2枚あり、どちらか一方では足りない。実測で、片方が緑のままもう片方だけが赤になる
 * 壊し方が**両向きに**在った（`corpus.js` の `ST_EDGES` に表がある）。
 *
 *   G1 自写  `X.sn` → (a) `.s` ／ `X` の `.st` → 起こした `.sn` → (b) `.s`。(a) と (b) の指紋。
 *            その枚の export を**全部**観測する。引く側が使わない export もここには出る。
 *   G2 境界  引く側（`parser.sn` / `emit.sn` / `preprocess.sn`）を、読み手が
 *            `operator_table.st` **しか**返さない状態で合流させ、素のソース合流と比べる。
 *            使われて初めて出る荷重——**鍵の綴りと連番**——はここにしか出ない。
 *   G3 負の対照  `.st` を1か所ずつ壊して、**赤になるはずのものが赤になる**こと。
 *            そして緑のままのものは、**荷重が無いという事実として**書き留める。
 *
 * ## 緑でも漏れる道を先に塞ぐ
 *
 * **読み手が `.sn` へ落ちたら門は永遠に緑である。** この検査の読み手は fs に触らない
 * ——`operator_table.sn` を求められたときだけ手元の `.st` テキストを返し、それ以外は投げる。
 * 落ちる道が無いことを、道具の側で担保する（§4 の最後でその逆——`.sn` を返す読み手を
 * 渡すと壊した `.st` でも指紋が動かないこと——も測る）。
 *
 * **`.st` が黙って痩せたら2つ赤になること。** `.s` の門だけでは、痩せた場所が
 * どの門にも見えない場合に緑のまま通る。実測: `#strict_infix` を丸ごと落としても
 * 自写・parser・emit は緑で、赤くなるのは `preprocess` だけである。だから `.st` テキスト
 * 自身の sha・エントリ数・未解決数も golden に置く（`ST_BOUNDARY`）。
 *
 * 実行: node test/st_gate.test.js（`npm test` からも呼ばれる）
 */
import peggy from "peggy";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";
import { generateSignType } from "../st.js";
import { readSignType } from "../st_read.js";
import { generateAsm } from "../pass4.js";
import { diffAsm, digestOf, formatDiff, normalizeAsm } from "../asmdiff.mjs";
import { CORPUS, ST_BOUNDARY, ST_EDGES, ROOT, ASM_OPT, readImport } from "./corpus.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = peggy.generate(fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8"));
const parse = parser.parse;

let passed = 0;
let total = 0;
function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
	if (!ok) console.log(`     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
}
function checkTrue(note, cond, extra) {
	check(note, !!cond, true);
	if (!cond && extra) console.log(`     ${extra}`);
}

/** `.st` テキストそのものの指紋。`digestOf` は `.s` を正規化するので、ここでは使えない。 */
const E_LINE = String.fromCharCode(10);
const sha16 = (text) => crypto.createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);

const srcOf = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const baseOf = (rel) => path.basename(rel);

/** `.sn` テキスト → `.st`（`generateSignType` の返り値そのまま）。 */
function stOf(rel, ri = readImport) {
	const c = compile(srcOf(rel), { parse, readImport: ri });
	return generateSignType(c.nodes, c.env, { scope: "st", source: baseOf(rel) });
}

/**
 * `.st` → 起こした `.sn`。**断りは黙って飲まない**——1件でもあれば投げる。
 * 埋めて通すと診断0件のまま値だけが違う（黙った誤答）。
 */
function raise(stText, name) {
	const r = readSignType(stText, { path: name });
	if (r.diagnostics.length > 0) throw new Error(r.diagnostics.join("\n"));
	return r.text;
}

/** `.sn` テキスト → `.s`。層は `ASM_OPT`（= 1。理由は `asm_gate.test.js` の頭）。 */
function asmOf(snText, ri = readImport) {
	const c = compile(snText, { parse, readImport: ri });
	return generateAsm(c.nodes, c.env, ASM_OPT);
}
const digOf = (snText, ri) => digestOf(asmOf(snText, ri).text);

/**
 * **門の読み手。fs に触らない。**
 *
 * `operator_table.sn` を求められたら手元の `.st` テキストを返し、それ以外は投げる。
 * 読み手が `.sn` へ落ちられるなら、`.st` をどれだけ壊しても門は緑のままになる
 * ——落ちる道そのものを持たせない。求められた道は `asked` に貯める（本当に引かれたか
 * を後で見るため。引かれていなければ「`.st` で合流した」とは言えない）。
 */
function stOnly(stText, asked = []) {
	return (full) => {
		asked.push(full);
		if (baseOf(full) === "operator_table.sn") return { text: stText, path: "operator_table.st" };
		throw new Error(`門は \`.sn\` を渡さない（求められた: ${full}）`);
	};
}

const byRel = (rel) => CORPUS.find((e) => e.rel === rel);
const OT = "alpha/sign/operator_table.sn";
/** 引かれる側の `.st`。6枚のうち `#` を持つのはこの1枚だけである。 */
const otSt = stOf(OT).text;
const entryNames = (stText) => stText.split("\n").filter((l) => l.startsWith("#")).map((l) => l.slice(1).split(" ")[0]);

// ---- 1. 道具の自己検査 ----
//
// **両方向で見る。** 「同じと言うべきものを同じと言う」だけなら、何でも同じと言う道具が
// 通ってしまう。`.st` の指紋も、`raise` の断りも、片側だけでは門にならない。
{
	check("`.st` の指紋は同じテキストで同じ", sha16("#a : 1\n"), sha16("#a : 1\n"));
	checkTrue("`.st` の指紋は1文字違えば動く", sha16("#a : 1\n") !== sha16("#a : 2\n"));
	// **`.s` の指紋では `.st` を見られない。** `digestOf` は `.s` の行の正規化であり、
	// `.st` にとって意味のある2つを落とす: 引用符の外の空白を潰すこと（`.st` のスロットの
	// 区切りは**2スペース**である）と、`//` から先を注釈として切ること（`.st` の値は
	// バッククォートで囲まれていて、`"` ではない）。別の道具が要る理由がこの2行である。
	check("`.s` の指紋は `.st` の区切り（2スペース）を潰す", digestOf("#a : Struct{`x` : Int=0 , 2  `y` : Int=1 , 0}"), digestOf("#a : Struct{`x` : Int=0 , 2 `y` : Int=1 , 0}"));
	check("`.s` の指紋はバッククォートの中の `//` を切る", digestOf("#a : `x // y`"), digestOf("#a : `x // z`"));

	// `raise` は断りを投げる。飲み込む作りだと、起こせない `.st` が空のプログラムとして通る。
	let msg = null;
	try { raise("#bump : Int -> Int\n", "x.st"); } catch (e) { msg = String(e.message); }
	checkTrue("関数を持つ `.st` は起こす前に止まる", msg !== null && msg.includes("関数の本体が `.st` にありません"), String(msg));
	msg = null;
	try { raise("#a : Int\n", "x.st"); } catch (e) { msg = String(e.message); }
	checkTrue("値の無い葉も止まる（型だけの `.st` は丸ごとこれ）", msg !== null && msg.includes("値が `.st` にありません"), String(msg));

	// 門の読み手が fs へ落ちないこと。
	let thrown = null;
	try { stOnly("#a : Int=1\n")("alpha/sign/lexer.sn"); } catch (e) { thrown = String(e.message); }
	checkTrue("門の読み手は `.sn` を求められたら投げる", thrown !== null && thrown.includes("門は `.sn` を渡さない"), String(thrown));
	check("門の読み手は `.st` で答える", stOnly("#a : Int=1\n")("operator_table.sn").path, "operator_table.st");
}

// ---- 2. G1 自写の門 ----
//
// `.st` は**関数の本体を持たない**ので、自写が成り立つのは枚が丸ごとデータのときだけである。
// 6枚のうち当たるのは `operator_table.sn` の1枚で、残り5枚は自分の `#` を持たない
// （`.st` は `operator_table` の素通しだけ）。**成り立たない枚も表に残す**——どれかが自分の
// `#` を持った日に、`own` の golden が言う。
for (const e of ST_BOUNDARY) {
	const st = stOf(e.rel);

	// `.st` テキスト自身の golden。`.s` の門と**2つで1組**である（頭の注記）。
	check(`${e.rel}: \`.st\` の指紋`, sha16(st.text), e.st.sha);
	check(`${e.rel}: \`.st\` の大きさ`, Buffer.byteLength(st.text), e.st.bytes);
	check(`${e.rel}: \`.st\` のエントリ数`, st.entries, e.st.entries);
	check(`${e.rel}: \`.st\` の未解決`, st.unresolved, e.st.unresolved);

	// 自分で `#` した名前（素通しは数えない）。**`.st` が何を運ぶかの表**である。
	const names = entryNames(st.text);
	check(`${e.rel}: 自分の \`#\``, e.rel === OT ? names : names.filter((n) => !entryNames(otSt).includes(n)), e.own);

	// 起こして `.s` まで。**断りは黙って飲まない**（`raise` が投げる）。ただし投げたまま
	// 走り切らないと、何件通ったのかも、残りの枚がどうなのかも出ない——ここで受けて
	// 「起こせなかった」という1件の落ちにする。原文はそのまま見せる（要約すると手掛かりが消える）。
	let raised = null;
	let refusal = null;
	try { raised = raise(st.text, baseOf(e.rel).replace(/\.sn$/, ".st")); } catch (err) { refusal = String(err.message); }
	checkTrue(`${e.rel}: \`.st\` から起こせる`, refusal === null, refusal === null ? "" : refusal.split("\n").slice(0, 3).join("\n     "));
	if (refusal !== null) continue;
	const b = asmOf(raised);
	check(`${e.rel}: 起こした \`.sn\` の診断`, b.diagnostics.length, 0);
	check(`${e.rel}: 起こした \`.sn\` が出す \`.s\` の指紋`, digestOf(b.text), e.raised);

	const a = asmOf(srcOf(e.rel));
	if (e.selfCopy) {
		// **自写が成り立つ枚。** 同じ事実を2か所に書かないため、期待値は `CORPUS` から引く。
		check(`${e.rel}: 自写の指紋は \`CORPUS\` と同じ値`, e.raised, byRel(e.rel).digest.full);
		checkTrue(`${e.rel}: G1 自写（ソース合流と \`.st\` 起こしが同じ \`.s\`）`, a.text === b.text, formatDiff(diffAsm(a.text, b.text), "ソース", ".stから"));
		check(`${e.rel}: 行数もそのまま`, normalizeAsm(b.text).length, normalizeAsm(a.text).length);
	} else {
		// **成り立たない枚。** 起こすと別のプログラムになる——それを緑と呼ばないために、
		// 「違うこと」自体を見る。`why` ではなく指紋で置くのは、理由が変わっても値が動くからである。
		checkTrue(`${e.rel}: 自写は成り立たない（自分の \`#\` が無い）`, a.text !== b.text);
		checkTrue(`${e.rel}: 素通しだけなので \`operator_table\` と同じか空になる`, e.raised === byRel(OT).digest.full || st.entries === 0);
	}
}

// ---- 3. G2 境界の門 ----
//
// 引く側3本を `.st` **だけ**で合流させる。`parser.sn` は layer 2 の枚、`emit.sn` は
// layer 1 の枚だが、門が出すのは `ASM_OPT`（layer 1）である——`CORPUS` と同じ条件で
// 比べるためで、条件を分けると「同じ値のはず」と言える相手が消える。
//
// **`preprocess.sn` はここで初めて `.st` 経由が測られた枚である。**
for (const e of ST_EDGES) {
	const want = byRel(e.rel).digest.full;
	const a = asmOf(srcOf(e.rel));
	check(`${e.rel}: ソース合流の指紋は \`CORPUS\` の値`, digestOf(a.text), want);

	// 合流そのものが止まることもある（`.st` が起こせない／読み手が `.sn` を求められた）。
	// **投げたまま走り切らない**と、残りの枚がどうなのかも出ない——1件の落ちにして続ける。
	const asked = [];
	let b = null;
	let stopped = null;
	try { b = asmOf(srcOf(e.rel), stOnly(otSt, asked)); } catch (err) { stopped = String(err.message); }
	checkTrue(`${e.rel}: \`.st\` だけで合流できる`, stopped === null, stopped === null ? "" : stopped.split("\n").slice(0, 3).join("\n     "));
	// **本当に引かれたか。** 引かれていなければ「`.st` で合流した」とは言えない
	// ——import 行が消えても、この検査が無ければ指紋は合ってしまう。
	check(`${e.rel}: 門の読み手が引かれた道`, asked.map(baseOf), [e.via]);
	if (stopped !== null) continue;
	checkTrue(`${e.rel}: G2 境界（\`.st\` だけで同じ \`.s\`）`, a.text === b.text, formatDiff(diffAsm(a.text, b.text), "ソース合流", ".st合流"));
	check(`${e.rel}: \`.st\` 合流の指紋`, digestOf(b.text), want);
	check(`${e.rel}: \`.st\` 合流の診断`, b.diagnostics.length, byRel(e.rel).asm.length);
}

// ---- 4. G3 負の対照 ----
//
// 門は「壊したら赤になる」ことでしか門にならない。**緑のままのものも書き留める**
// ——名前を付けずに落とすと、次に誰かが同じ所を壊したとき「前は見えていたはず」と
// 思い込む。表は `corpus.js` の `ST_EDGES` の上にある。
const otDigest = byRel(OT).digest.full;
const GATES = [{ rel: OT, self: true }, ...ST_EDGES.map((e) => ({ rel: e.rel, self: false }))];

/** 壊した `.st` を、4枚の門それぞれへ通して赤緑を返す。 */
function runGates(stText) {
	return GATES.map((g) => {
		try {
			const got = g.self ? digOf(raise(stText, "operator_table.st")) : digOf(srcOf(g.rel), stOnly(stText));
			return got === byRel(g.rel).digest.full ? "緑" : "赤";
		} catch { return "赤"; } // 断りも投げるのも「気付いた」側である
	});
}

const once = (s, from, to) => {
	const n = s.split(from).length - 1;
	if (n !== 1) throw new Error(`壊す場所が一意でない（${n} 件）: ${from}`);
	return s.replace(from, to);
};

/**
 * 壊し方と、**測った結果**。`want` はそのまま golden である——ここが動いたら、門の
 * 届く範囲が変わったということで、直したのなら値を書き換える。
 *
 * 並びは `[自写, parser, emit, preprocess]`。
 */
const MUTATIONS = [
	{ note: "葉の値（String）", f: (s) => once(s, "String=`coproduct`", "String=`coproductX`"), want: ["赤", "赤", "赤", "赤"] },
	{ note: "葉の値（Int）", f: (s) => once(s, "`tier` : Int=11", "`tier` : Int=12"), want: ["赤", "赤", "赤", "赤"] },
	{ note: "スロットを1つ落とす", f: (s) => once(s, "`assoc` : Int=0 , 2  `name` : String=`coproduct`", "`name` : String=`coproduct`"), want: ["赤", "赤", "赤", "赤"] },
	// **鍵と連番は自写の門から見えない。** 鍵の名前は機械語に残らない（スロットは
	// 番地の隔たりで引く）ので、`operator_table.sn` 単独では荷重が出ない。`' assoc` で
	// 実際に引く `parser.sn` の側で初めて赤になる——境界の門を置く理由そのものである。
	{ note: "鍵の綴りを変える", f: (s) => once(s, "`assoc` : Int=0 , 2  `name` : String=`coproduct`", "`assocX` : Int=0 , 2  `name` : String=`coproduct`"), want: ["緑", "赤", "緑", "緑"] },
	{ note: "外側の鍵の綴りを変える", f: (s) => once(s, "#infix : Struct{` ` :", "#infix : Struct{`  ` :"), want: ["緑", "赤", "緑", "緑"] },
	{ note: "連番を2つ入れ替える", f: (s) => once(s, "`assoc` : Int=0 , 2  `name` : String=`coproduct` , 1", "`assoc` : Int=0 , 1  `name` : String=`coproduct` , 2"), want: ["緑", "赤", "緑", "緑"] },
	// **`strict_infix` を見ているのは `preprocess.sn` の門だけである。** 平らな器なので
	// `operator_table.sn` 単独では `.rodata` にも出ず、引く側も `preprocess.sn` しかいない。
	{ note: "`strict_infix` の値を変える", f: (s) => once(s, "`!=` : Int=1 , 18", "`!=` : Int=2 , 18"), want: ["緑", "緑", "緑", "赤"] },
	{ note: "`strict_infix` のスロットを落とす", f: (s) => once(s, "`!==` : Int=1 , 6  ", ""), want: ["緑", "緑", "緑", "赤"] },
	// ---- ここから下は**荷重が無いことの記録**である ----
	//
	// 並び: `.st` は名前順に書くが、読む側は**連番の順へ並べ直す**。だから字面の並びを
	// 崩しても起こした `.sn` はバイト一致する（下で確かめる）。
	{ note: "名前順の並びを崩す", f: (s) => once(s, "`assoc` : Int=0 , 2  `name` : String=`coproduct` , 1", "`name` : String=`coproduct` , 1  `assoc` : Int=0 , 2"), want: ["緑", "緑", "緑", "緑"] },
	// 型の綴り: 起こす側が書くのは**値の字面だけ**である。Sign に型注釈の構文が無い以上、
	// テキストを通った葉の型は必ず値から推論し直される——この境界では型の綴りは**無荷重**。
	// 綴りが化けたことは `.s` には出ないので、見張るのは `ST_BOUNDARY` の `st.sha` である。
	{ note: "型の綴りだけ変える（Int→Address）", f: (s) => once(s, "`tier` : Int=11", "`tier` : Address=11"), want: ["緑", "緑", "緑", "緑"] },
	{ note: "型の綴りだけ変える（String→Char）", f: (s) => once(s, "String=`coproduct`", "Char=`coproduct`"), want: ["緑", "緑", "緑", "緑"] },
];

/** 起こせなかったら `null`。壊した `.st` は断られることもあるので、投げさせない。 */
const raisedOrNull = (text) => { try { return raise(text, "operator_table.st"); } catch { return null; } };
const baseRaised = raisedOrNull(otSt);
checkTrue("素の `operator_table.st` は起こせる", baseRaised !== null);
for (const m of MUTATIONS) {
	// **壊す場所が消えていたら、それも門の落ちである。** `.st` の綴りが変われば負の対照は
	// 空振りする——「壊せなかったから緑」を通すと、門が在るように見えたまま中身が無くなる。
	let mutated = null;
	let lost = null;
	try { mutated = m.f(otSt); } catch (err) { lost = String(err.message); }
	checkTrue(`${m.note}: 壊す場所が \`.st\` に在る`, lost === null, lost ?? "");
	if (lost !== null) continue;
	checkTrue(`${m.note}: \`.st\` が実際に変わった`, mutated !== otSt);
	check(`${m.note}: [自写, parser, emit, preprocess]`, runGates(mutated), m.want);
	// **緑の理由を取り違えない。** 起こした `.sn` がバイト一致するなら「読む側が落とした」、
	// 変わっているのに緑なら「機械語に残らない」である。前者だけを名指しで確かめる。
	const noLoad = ["名前順の並びを崩す", "型の綴りだけ変える（Int→Address）", "型の綴りだけ変える（String→Char）"].includes(m.note);
	check(`${m.note}: 起こした \`.sn\` がバイト一致する`, raisedOrNull(mutated) === baseRaised, noLoad);
}

// **エントリを1つずつ丸ごと落とす。** どの門がどのエントリを見ているかの表そのもので、
// 「どの門にも見えないエントリが1つも無い」ことがここで出る。`ST_EDGES` の `blind` が
// その golden である——`.st` が黙って痩せたとき赤くなる門が1枚も無ければ、痩せたことが
// 見えない（実測で `strict_infix` がそれで、赤くなるのは `preprocess` だけだった）。
{
	const names = otSt.split("\n").filter((l) => l.startsWith("#")).map((l) => l.slice(1).split(" ")[0]);
	check("`.st` のエントリ名", names, ST_BOUNDARY.find((e) => e.rel === OT).own);
	const blindOf = [[], ...ST_EDGES.map((e) => e.blind)]; // [自写, parser, emit, preprocess]
	// 自写の門が見ないエントリ（実測）。`operator_table.sn` 単独で一度も使われず、
	// 平らな器なので `.rodata` にも出ない。
	blindOf[0] = ["strict_infix"];
	for (const name of names) {
		const dropped = otSt.split("\n").filter((l) => !l.startsWith(`#${name} `)).join("\n");
		const got = runGates(dropped);
		const want = blindOf.map((b) => (b.includes(name) ? "緑" : "赤"));
		check(`\`#${name}\` を落とす: [自写, parser, emit, preprocess]`, got, want);
		checkTrue(`\`#${name}\` はどれかの門に見えている`, got.includes("赤"));
	}
}

// **`.sn` を返す読み手を渡すと門は意味を失う。** 壊した `.st` を持っていても、読み手が
// ソースで答えるなら指紋は1ビットも動かない——`.st` は読まれないからである。門の読み手が
// fs へ落ちられない作りになっている理由が、そのままここに立っている。
{
	let broken = null;
	try { broken = MUTATIONS[0].f(otSt); } catch { /* 上で名指しで落ちている */ }
	check("本物の門: 壊した `.st` は赤", broken === null ? "壊せなかった" : runGates(broken)[1], "赤");
	check("`.sn` を返す読み手: 同じ `.st` でも緑", digOf(srcOf("alpha/sign/parser.sn"), readImport) === byRel("alpha/sign/parser.sn").digest.full ? "緑" : "赤", "緑");
	// 読み手が `.st` を一度も見ないこと（緑の理由が「壊れていない」ではないこと）を名指しで。
	const asked = [];
	digOf(srcOf("alpha/sign/parser.sn"), (p) => { asked.push(p); return readImport(p); });
	check("`.sn` を返す読み手は `.st` を読まない", asked.map(baseOf), ["operator_table.sn"]);
}

// ---- 5. `.st` の往復（鍵の綴りの軸）----
//
// **`.s` は鍵の綴りを運ばない。** スロットは番地の隔たりで引くので、鍵の名前は機械語に残らない。
// だから `.s` の門をいくつ並べても、鍵が化けたことは分からない——実測で `operator_table` の鍵を
// 1つずつ 75 通りリネームすると **23 通りが4枚とも緑**だった（`prefix`/`postfix`/`enclosure` の
// 外側の鍵 18 本、各表の内側の `name`、asm_* の `form` など）。赤くなるのは `parser.sn` が
// **静的に `' 鍵` で引く鍵だけ**である。
//
// `ST_BOUNDARY` の `st.sha` はそこを見張るが、**書く側にしか効かない**——読む側が鍵をいじった
// 場合、`.st` は素のままなので sha は動かない（実測: `st_read.js` が `form` を `formX` と読む
// ようにしても、4枚の門も `.st` の sha も全部緑だった）。
//
// **だから別の軸を置く。** `.st` → 起こした `.sn` → もう一度 `.st'`。鍵は `.st` の中に字面で在るので、
// 読む側が落としても化けさせても割れる。`st_read.test.js` が同じ形の `roundTrip` を持っているが、
// 向いている先は鍵が a/k/n/b の小さい合成例だけで、**本物のモジュールへ向いていなかった**。
for (const e of ST_BOUNDARY) {
	const st = stOf(e.rel).text;
	let again = null;
	try {
		const sn = raise(st, baseOf(e.rel));
		const c = compile(sn, { parse, readImport });
		again = sha16(generateSignType(c.nodes, c.env, { scope: "st", source: baseOf(e.rel) }).text);
	} catch (x) { again = "断る: " + String(x.message).split("\n")[0]; }
	check("往復 " + baseOf(e.rel) + "：起こして取り直した `.st` が一致", again, e.st.sha);
}

// この軸に歯が在ることの確認。**`.s` の門が4枚とも緑のままの位置**を選ぶ——asm_* の内側の鍵
// `form` は、どの `.s` にも出ない（実測 23/75 の1つ）。
{
	const broken = otSt.split("`form`").join("`formX`");
	checkTrue("鍵 `form` を変えると `.st` の字面が動く", broken !== otSt);
	check("鍵を変えても `.s` の門は緑（だからこの軸が要る）", runGates(broken)[0], "緑");
	let again = null;
	try {
		const c = compile(raise(broken, "ot"), { parse, readImport });
		again = sha16(generateSignType(c.nodes, c.env, { scope: "st", source: "operator_table.sn" }).text);
	} catch (x) { again = "断る"; }
	checkTrue("往復の軸は鍵の化けを捕まえる", again !== ST_BOUNDARY.find((x) => x.rel === OT).st.sha, String(again));
}

// **export の印もどの `.s` の門にも見えない。** `resolveImports` は印に関係なく撒くので、
// 1段では誰も気付かず、次の段で引く側の `.st` が 0 エントリになって初めて出る（実測）。
// 往復の軸はここも捕まえる——印が落ちれば起こした `.sn` の `#` が消え、取り直した `.st'` が割れる。
{
	const noMark = otSt.split(E_LINE).map((l) => l.replace(/^#+/, "")).join(E_LINE);
	checkTrue("export の印を落とすと `.st` の字面が動く", noMark !== otSt);
	check("印を落としても `.s` の門は緑", runGates(noMark)[0], "緑");
	let again = null;
	try {
		const c = compile(raise(noMark, "ot"), { parse, readImport });
		again = sha16(generateSignType(c.nodes, c.env, { scope: "st", source: "operator_table.sn" }).text);
	} catch (x) { again = "断る"; }
	checkTrue("往復の軸は export の印の脱落を捕まえる", again !== ST_BOUNDARY.find((x) => x.rel === OT).st.sha, String(again));
}

// ---- 6. 書く側（ドライバ）----
//
// **`.st` を置くのはドライバの仕事である**（`build_system.md` §4.2——`compile.js` は fs に
// 触らない）。だからここだけが `.st` をディスクへ出す場所で、**出た物が門の見ている物と
// 同じであること**を見ないと、「書く」は検査されていない。
//
// `.ist` も書ける（利用者の決定 2026-09-18）。守る線は「書くな」ではなく**「配るな」**で、
// 理由は隣に `.sn` が在ること——内部識別子名も欄もソースにそのまま書いてあるので、
// 普通の配置では `.ist` は新しく漏らすものを持たない。
{
	const out = path.join(os.tmpdir(), "sign_st_gate");
	fs.rmSync(out, { recursive: true, force: true });
	fs.mkdirSync(out, { recursive: true });
	const src = path.join(out, "operator_table.sn");
	fs.writeFileSync(src, srcOf(OT));
	const drv = path.join(__dirname, "..", "emit_st.mjs");
	const run = (extra) => spawnSync(process.execPath, [drv, src, ...extra], { encoding: "utf8" });
	run(["--write"]);
	const wrote = path.join(out, "operator_table.st");
	const onDisk = fs.existsSync(wrote) ? fs.readFileSync(wrote, "utf8") : "（書かれていない）";
	check("ドライバが書いた `.st` は、門が見ている物と同じ", sha16(onDisk), ST_BOUNDARY.find((x) => x.rel === OT).st.sha);
	check("大きさも同じ", Buffer.byteLength(onDisk), ST_BOUNDARY.find((x) => x.rel === OT).st.bytes);
	// 書いた `.st` は、そのまま起こして同じ `.s` になること（ディスクを経由しても変わらない）。
	let dig = null;
	try { dig = digOf(raise(onDisk, "operator_table.sn"), readImport); } catch (x) { dig = "断る: " + String(x.message).split(String.fromCharCode(10))[0]; }
	check("ディスクの `.st` から起こしても同じ `.s`", dig, byRel(OT).digest.full);
	// `.ist` も書ける。**配る物に入れない**という線は、書けることと両立する。
	run(["ist", "--write"]);
	checkTrue("`.ist` も書ける（中間物）", fs.existsSync(path.join(out, "operator_table.ist")));
	fs.rmSync(out, { recursive: true, force: true });
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
