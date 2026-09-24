/**
 * **自己ホストの門の土台。**
 *
 * 後段は1関数ずつ Sign へ移す。移した1枚が正しいかを決めるのは「JS の pass4 が出した
 * 命令列と、Sign の後段が出した命令列が、注釈を除いて同じか（最適化は切って）」である。
 * この門は**まだ片側しか無い**——Sign の後段が1枚も出していないので、ここで固めるのは
 * 比べる側の道具（`asmdiff.mjs`）と、比べられる側（JS）が**毎回同じものを出すこと**である。
 * 出すたびに揺れるなら、差が出たときそれが移植のせいなのか揺れなのか言えない。
 *
 * 見るのは:
 *   1. 診断が既知のものであること（`corpus.js` の表。重さと言い分まで）
 *   2. 同じ木から2度出してバイト一致（出す側が状態を持ち越していないこと）
 *   3. 読み直した木から出してバイト一致（木の同一性に寄りかかっていないこと）
 *   4. 最適化を切った側（`{regAlloc:false, peepholes:false}`）でも 2・3 が成り立つこと
 *   5. 命令数と**命令列の指紋**の golden（`corpus.js`）
 *   6. 門が届く範囲（出た綴りの一覧）と、覆っていない2本がまだ通らないこと
 *
 * **指紋が要る理由。** 2・3 は「同じ入力なら同じものが出る」しか言わない——pass4 を書き換えて
 * 別のものを出すようにしても、それが安定して出るなら通る。数の golden はそこを見張るが、
 * 数は長さだけなので、命令数を変えずに中身を変える直し方は素通りする。pass4 を1か所ずつ
 * 壊して測った。**数だけで見張っていたとき、次の7つは全部緑のまま通った**:
 * 退避するレジスタを `x30`→`x28`／フレームを戻す幅を `#frame`→`#frame+16`／`mov x29, sp` を
 * `add x29, sp, #0`／`.rodata` の並びを逆／`.ascii` を `.byte`／`.section .rodata` を `.data`／
 * `.balign w` を `2w`。どれも自己ホストの比較なら一発で落ちる違いである。ラベルの綴りを
 * `.L`→`.M` にした分だけは数でも落ちたが、あれは**覗き穴が `.L` を見ているから**で、
 * 門がラベルを見ていたからではない。指紋（`digestOf`）は正規化後の行を並びごと束ねるので、
 * 7つとも捕まえる。
 *
 * **層は 1 以上でしか見られない。** `{regAlloc:false}` は中立ではない——式の途中の値が
 * スロットへ落ち、スロットには場所が要り、layer 0 は場所を取れない
 * （`layer: 0 では _.main がフレームを要求します`）。門が覆うのは layer 1 以上である
 * （`idiom_to_instructions.md §1`。そこで「別形」と呼んでいるのが `{regAlloc:false}` で、
 * `peepholes` はその対である——覗き穴を切る口が無いあいだ、門は開けられなかった）。
 *
 * 実行: node test/asm_gate.test.js（`npm test` からも呼ばれる）
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";
import { generateAsm } from "../pass4.js";
import { diffAsm, digestOf, formatDiff, normalizeAsm, mnemonicCounts } from "../asmdiff.mjs";
import { CORPUS, NOT_COVERED, ROOT, ASM_OPT, SELF_OPTION_WARNINGS, REACHED_MNEMONICS, readImport, sourceOf, countInstructions } from "./corpus.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = peggy.generate(fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8"));

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

// ---- 1. 比べる側の自己検査 ----
//
// **両方向で見る。** 「同じと言うべきものを同じと言う」だけだと、何でも同じと言う比較器が
// 通ってしまう——門が緑のまま中身が違う、という一番まずい壊れ方がそれである。
{
	const withComments = "\t.text\n\tmov x0, #1    // 何かの説明\n\n\tret // 戻る\n";
	const without = "\t.text\n\t\tmov  x0,\t#1\n\tret\n";
	checkTrue("注釈と空白だけ違う2つは一致する", diffAsm(withComments, without).same, formatDiff(diffAsm(withComments, without)));

	// **引用符の中の `//` は文字である。** ここを注釈として落とすと、下の2つは
	// `.ascii "a` までしか残らず一致してしまう（中身の違う .rodata が同じに見える）。
	const dataA = '\t.section .rodata\n\t.ascii "a // b"\n';
	const dataB = '\t.section .rodata\n\t.ascii "a // c"\n';
	const dd = diffAsm(dataA, dataB);
	checkTrue("引用符の中だけ違う2つは一致しない", !dd.same, formatDiff(dd));
	check("食い違う場所を指す", [dd.index, dd.left, dd.right], [1, '.ascii "a // b"', '.ascii "a // c"']);
	// 空白も同じ轍。引用符の外だけ潰す。
	checkTrue("引用符の中の空白は潰さない", !diffAsm('\t.ascii "a  b"', '\t.ascii "a b"').same);
	checkTrue("引用符の外の空白は潰す", diffAsm("\tadd x0, x1, x2", "  add  x0,  x1,  x2  ").same);

	// ディレクティブとラベルは落とさない。落とせば `.rodata` を見ない門になる。
	checkTrue("ディレクティブの違いは差である", !diffAsm("\t.quad 0x1", "\t.quad 0x2").same);
	checkTrue("ラベルの違いは差である", !diffAsm("f:\n\tret", "g:\n\tret").same);

	// 長さが違うときは、短いほうの終わりを指す（そこから先は読めない）。
	const short = diffAsm("\tret\n", "\tret\n\tret\n");
	check("片方が先に終わったら終わりを指す", [short.same, short.index, short.left, short.right], [false, 1, null, "ret"]);

	// **1か所だけ違う対**。どれも移植で起きる間違いそのもので、比べる側が「同じ」と言ったら
	// その時点で門は無い。命令の数が変わらないものを並べてあるのは、数の golden では
	// 捕まらない側を比較器が受け持つからである。
	const P = (...L) => L.join("\n") + "\n";
	checkTrue("即値が違えば差", !diffAsm(P("\tmov x0, #1"), P("\tmov x0, #2")).same);
	checkTrue("レジスタが違えば差", !diffAsm(P("\tmov x0, x1"), P("\tmov x0, x2")).same);
	checkTrue("綴りだけ違っても差（add/sub）", !diffAsm(P("\tadd x0, x1, x2"), P("\tsub x0, x1, x2")).same);
	checkTrue("条件が違えば差（eq/ne）", !diffAsm(P("\tb.eq .L0"), P("\tb.ne .L0")).same);
	checkTrue("命令が1つ増えれば差", !diffAsm(P("\tmov x0, #1", "\tret"), P("\tmov x0, #1", "\tnop", "\tret")).same);
	checkTrue("命令が1つ減れば差", !diffAsm(P("\tmov x0, #1", "\tnop", "\tret"), P("\tmov x0, #1", "\tret")).same);
	// 飛び先。ラベルは名前でしか繋がっていないので、名前が動けば別のプログラムである。
	checkTrue("飛び先のラベル名が変われば差", !diffAsm(P("\tb .L1", ".L0:", "\tret"), P("\tb .L0", ".L0:", "\tret")).same);
	checkTrue(".rodata のバイトが違えば差", !diffAsm(P("\t.byte 0x41, 0x42"), P("\t.byte 0x41, 0x43")).same);
	// **順序だけ違う対**。綴りごとの数で比べる作りにすると、ここだけがすり抜ける
	// ——数は完全に同じだからである。並びごと見ていることの証拠として置く。
	const swapped = diffAsm(P("\tmov x0, #1", "\tmov x1, #2"), P("\tmov x1, #2", "\tmov x0, #1"));
	checkTrue("順序だけ違っても差", !swapped.same, formatDiff(swapped));
	check("順序の差では綴りごとの数が動かない", swapped.counts, []);
	// 注釈の中に命令らしい綴りがあっても、それは注釈である。
	checkTrue("注釈の中の命令らしい文字列は数えない", diffAsm(P("\tret // mov x0, #99"), P("\tret")).same);
	checkTrue("注釈の中の開いたままの引用符に釣られない", diffAsm(P('\tret // "開いたまま'), P("\tret")).same);

	// 指紋。**注釈では動かず、中身が変われば動く**——golden をこれで置くための性質である。
	check("指紋は注釈で動かない", digestOf("\tret // あれ"), digestOf("\tret"));
	checkTrue("指紋は中身が変われば動く", digestOf("\tmov x0, #1") !== digestOf("\tmov x0, #2"));
	checkTrue("指紋は順序が変われば動く", digestOf(P("\tmov x0, #1", "\tret")) !== digestOf(P("\tret", "\tmov x0, #1")));
	checkTrue("指紋はディレクティブも見る", digestOf("\t.balign 1\n\tret") !== digestOf("\t.balign 2\n\tret"));

	// 綴りごとの数の要約。どこが増えたかを1行で言うためのものである。
	const counts = diffAsm("\tmov x0, #1\n\tret", "\tmov x0, #1\n\tmov x1, #2\n\tret").counts;
	check("綴りごとの数の差を出す", counts, [{ mnemonic: "mov", left: 1, right: 2 }]);
	check("ラベルはまとめて数える", [...mnemonicCounts("f:\n\tret\n.L0:\n")].sort(), [["(ラベル)", 2], ["ret", 1]]);
	check("注釈だけの行と空行は列に入らない", normalizeAsm("// 全部注釈\n\n\tret\n"), ["ret"]);
}

// ---- 1b. 身元はファイルが言う ----
//
// 機械へ落とす条件（的・層・文字幅）は `alpha/sign/option.ms` から来る。長らくここの
// 門は `{ layer: 1 }` を手で持っていたが、それはファイルが宣言していない仮定だった。
// **読めたが妥当でない**（未知の的・範囲外の層）なら黙って既定へ落ちるので、0件を見る。
check("option.ms は警告なしで読める", SELF_OPTION_WARNINGS, []);
check("セルフホストの身元：層", ASM_OPT.layer, 1);
check("セルフホストの身元：的", ASM_OPT.target, "aarch64_qemu");

// ---- 2. コーパス：診断・出し直しの安定・命令数 ----
//
// `emit` を2度呼ぶのは同じ木から。**出す側が状態を持ち越していれば2度目が変わる**ので、
// ここが揺れると、後で Sign 側と比べたときの差が移植のせいだと言えなくなる。
const PLAIN = { regAlloc: false, peepholes: false };
const textOf = (nodes, env, extra) => generateAsm(nodes, env, { ...ASM_OPT, ...extra }).text;
const reached = new Set(); // 門が届く範囲を測るため、出た綴りを拾っておく

for (const entry of CORPUS) {
	const source = sourceOf(entry);
	const first = compile(source, { parse: parser.parse, readImport });
	check(`${entry.rel}: 前段の診断`, first.diagnostics.length, entry.front);

	const asm = generateAsm(first.nodes, first.env, ASM_OPT);
	// **数だけでは足りない。** 別の理由で断っていても数は合う。実測: 既知の1件を積まない
	// ように `em.fail` を変えると、同じ節の下の `まだ出せない式です` が代わりに積まれて
	// **数は 1 のまま**だった——止まった場所が動いたのに数は動かない。重さと言い分まで見る。
	check(`${entry.rel}: 機械の診断（重さの並び）`, asm.diagnostics.map((d) => d.severity), entry.asm.map((d) => d.severity));
	for (const [i, want] of entry.asm.entries()) {
		// `String()` で包むのは、message が文字列でない診断でも**検査として落ちる**ため
		// （素で `.includes` を呼ぶと TypeError で走り切らず、何件通ったのかも出ない）。
		checkTrue(`${entry.rel}: 断る理由（${want.includes}）`, String(asm.diagnostics[i]?.message ?? "").includes(want.includes), asm.diagnostics.map((d) => d.message).join(" / "));
	}

	// 読み直した木。同じソースから作り直しても同じ `.s` が出ること。
	const again = compile(source, { parse: parser.parse, readImport });

	for (const [label, extra] of [["既定", {}], ["最適化を切った側", PLAIN]]) {
		const a = textOf(first.nodes, first.env, extra);
		const b = textOf(first.nodes, first.env, extra);
		const c = textOf(again.nodes, again.env, extra);
		checkTrue(`${entry.rel}: 2度出して同じ（${label}）`, a === b, formatDiff(diffAsm(a, b), "1度目", "2度目"));
		checkTrue(`${entry.rel}: 読み直しても同じ（${label}）`, a === c, formatDiff(diffAsm(a, c), "最初の木", "読み直し"));
		check(`${entry.rel}: 命令数（${label}）`, countInstructions(a), extra === PLAIN ? entry.insn.plain : entry.insn.full);
		// **中身の golden。** 数が長さを見るのに対し、指紋は並びと綴りを見る（ディレクティブと
		// ラベルも入る）。落ちたら「後段を直した」か「壊した」かのどちらかで、直したのなら
		// got の値を `corpus.js` へ写す。どこが動いたかは両側の `.s` を出して比べる:
		//   node emit_asm.mjs <file.sn> > new.s  /  node asmdiff.mjs old.s new.s
		check(`${entry.rel}: 命令列の指紋（${label}）`, digestOf(a), extra === PLAIN ? entry.digest.plain : entry.digest.full);
		for (const line of a.split("\n")) {
			const m = line.match(/^\t([a-z][a-z0-9.]*)\s/);
			if (m) reached.add(m[1]);
		}
	}
}

// ---- 3. 門が届く範囲 ----
//
// **門が捕まえられる上限は、コーパスが出す綴りで決まる。** 一度も出ない命令は、pass4 の
// 側をどう壊しても門は緑のままである——`udiv` の後の `csel` の条件を `eq`→`ne` に裏返して
// 確かめた（100/100 のまま通る）。門の穴ではなく**道が無い**ので、塞ぐには道を足す
// （その命令を踏む `.sn` をコーパスへ入れる）しかない。届く範囲そのものを golden にして、
// 広がったら言わせる。
check("届いている綴り", [...reached].sort(), [...REACHED_MNEMONICS].sort());

// 覆っていない2本も、**覆っていない理由が今も生きているか**だけ見る。前段が直って通る
// ようになった日に誰も表を書き換えなければ、この2本は永久に門の外へ置かれたままになる。
for (const e of NOT_COVERED) {
	let thrown = null;
	try { compile(fs.readFileSync(path.join(ROOT, e.rel), "utf8"), { parse: parser.parse, readImport }); }
	catch (err) { thrown = String(err.message); }
	checkTrue(`${e.rel}: まだ通らない（${e.why}）`, thrown !== null && thrown.includes(e.throws), thrown === null ? "通るようになった——コーパスへ入れること" : thrown);
}

// ---- 4. 注釈は命令を出さない ----
//
// 比べる側が注釈を落とすのは、**注釈が命令を持たない**からである。その根拠を Sign の側でも
// 見る——同じプログラムの注釈あり・なしが、バイトまで同じ `.s` になること。
{
	const byName = (s) => CORPUS.find((e) => e.rel.endsWith(s));
	const withC = byName("n_queens.sn");
	const noC = byName("n_queens.nocomment.sn");
	const emit = (e) => {
		const { nodes, env } = compile(sourceOf(e), { parse: parser.parse, readImport });
		return generateAsm(nodes, env, ASM_OPT).text;
	};
	const a = emit(withC);
	const b = emit(noC);
	checkTrue("注釈のあるなしで同じ .s が出る", a === b, formatDiff(diffAsm(a, b), "注釈あり", "注釈なし"));
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
