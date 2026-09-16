/**
 * **`alpha/sign/target_info.sn` が `target_info.js` と同じ答えを出すことを見る門。**
 *
 * `target_info.js` は型システムと Pass 4 の継ぎ目である——Layer 2 の型名を「何バイト幅・
 * 符号あり/なし」へ落とす表と、その1つの還元。自己ホストのために Sign へ移すので、
 * 移した先が同じ答えを出すかを、**コーパスが実際に立てた問いの全部**について見る。
 *
 * 問いの一覧は手で選んでいない（`target_info_reached.js`）。`target_info.js` の関数と表を
 * 1つ残らず包んで、`corpus.js` の .sn を compile + generateAsm したときに**実際に立った問い**を
 * 拾ったものである。手で選ぶと、選んだ人が知っている場所しか見ない門になる。
 *
 * **答えは書かない。** 答えを持っているのは `target_info.js` なので、検査は実行時に JS へ
 * 同じ問いを立てて突き合わせる（`qemu.test.js` の `agree` と同じ規律——期待値を二重に書くと
 * 片方だけ直る）。
 *
 * **両方のエンジンで見る。** 解釈器は値の意味論を、qemu は出した命令が本当にその値を
 * 返すことを見る。命令が出ていることは値が合っていることを意味しない（`qemu.test.js` の頭）。
 *
 * ## この枚が見ているもの（3つ）
 *
 *   1. **答え** ——表の問いを両エンジンへ立て、JS の答えと突き合わせる。
 *   2. **見えているか** ——`target_info.js` の表の行と `match_case` の腕を1本ずつずらし、
 *      表の問いの答えが動くかを見る。動かない行は**誰も問うていない**ので名指しで赤にする。
 *      1 だけだと「問わないから緑」が「合っているから緑」と見分けられない。
 *   3. **移していない枝** ——写さないと決めた所へ、誰かが到達していないか（`NOT_PORTED`）。
 *
 * ## JS の答えと Sign の綴りの対応
 *
 *   JS の数            Int そのもの
 *   JS の文字列        String そのもの（機械の側では長さと1文字ずつで見る）
 *   JS の `null`       `__`（決まらない・表に無い）
 *   JS の `false`      `__`（Sign の偽は `__` だけである）
 *   JS の `true`       **前提そのもの**を返す（`is_supported` はターゲット名を返す）
 *   JS の `NaN`        **負の Int**（`0 - 1`）。`literalParts().width` だけが持つ3つ目の答え
 *                      （「言っていない」＝`null` とは別の「機械にその幅の命令が無い」）で、
 *                      `unicodeWidthError` が両者を区別して断っている。`__` を両方に使うと
 *                      断れなくなるので分けた（`idiom_to_instructions.md`——位置を積んで
 *                      返すときと同じ綴り）。実機で往復することを確かめてある。
 *
 * 実行: node test/target_info_sn.test.js（`npm test` からも呼ばれる）
 */
import fs from "fs";
import path from "path";
import { compile } from "../compile.js";
import { generateAsm } from "../pass4.js";
import * as I from "../interpreter.js";
import { runAsm, asInt, available, toolReport } from "../qemu_run.js";
import * as TI from "../target_info.js";
import { REACHED } from "./target_info_reached.js";
import { SIGN_DIR, ASM_OPT, readImport } from "./corpus.js";

const B = "`";
const q = (s) => B + s + B;

// ---- Sign 側 ----
//
// 移植が入る前は**置き石**（どの問いにも `__` としか答えない .sn）で回していた。門が
// 「無い」と言えること自体を先に確かめるためのもので、実測で 177/310 の赤、落ち方は
// 全部「JS=8 / Sign=`__`」型だった。移植が入った今は**無ければ落ちる**のが正しい
// ——置き石を残すと、ファイルを消した日に門が静かに緑へ戻る道が残る。
const SN = path.join(SIGN_DIR, "target_info.sn");
if (!fs.existsSync(SN)) {
	console.log(`${path.relative(process.cwd(), SN)} が無い——この門は移した先を見るものである`);
	console.log("\n0/1 passed");
	process.exit(1);
}
const SOURCE = fs.readFileSync(SN, "utf8").replace(/\r\n/g, "\n");

let passed = 0;
let total = 0;

// ---- 答えの綴り。JS と Sign の答えを同じ字面へ寄せる ----
const NO_WIDTH = "(機械に無い幅)";
function norm(v) {
	if (v === null || v === undefined) return "__";
	if (typeof v === "number" && Number.isNaN(v)) return NO_WIDTH;
	if (typeof v === "bigint") return v < 0n ? NO_WIDTH : String(v);
	if (typeof v === "number") return v < 0 ? NO_WIDTH : String(v);
	if (typeof v === "string") return q(v);
	if (v === true) return "(真)";
	return JSON.stringify(v);
}

// ---- 問いを Sign の式へ開く ----
//
// 表は**関数越しに引く**。`t ' `Int`` と静的な鍵で書くと、鍵が表に無いとき機械は
// `構造体に Struct というスロットがありません` で**断る**——`__` は返らない（実測）。
// JS 側は `SIGNEDNESS["Struct"]` に `undefined` を返すので、同じ答えになるのは
// 仮引数越し（実行時の鍵、`t ' k~`）で引いたときだけである。
//
// **`kind` は答えの型であって、答えの値ではない。** 機械の側で `__` の姿が違うからである:
// スカラーの `__` は niche（x0 が `0x8000…`）だが、**器の `__` は長さ 0 の器**
// （x0 は番地で、`0` が来る）。同じ問いが `gpr` を返したり `__` を返したりする
// （`mt_class`）ので、値ではなく**問いごと**に読み方を決める必要がある。実測で
// `mt_class \`String\`` は x0=0 を返し、niche を見る読み方では JS の `null` と食い違った。
// 器の側は長さで見る——長さ 0 と空の器は機械では区別が付かないが、到達している問いに
// 空文字列の答えは1つも無い。
function questionsOf(row) {
	const [a0, a1] = row.args;
	switch (row.fn) {
		case "widthsOf": {
			// **`endian` は同じ行に置けない**（実測）。幅の欄は Int、`endian` は String なので、
			// クラスの名前で幅を引く道（`w ' cls~`）が
			// `鍵が実行時に決まる引き方は、全スロットが同じ幅でなければ出せません` で断られる。
			// 行を Int だけにして、`endian` は別の表（`endian_of`）から引く。
			const w = TI.widthsOf(a0);
			return [
				...["gpr", "float", "vector"].map((f) => ({ ask: `(widths_of ${q(a0)}) ' ${f}`, kind: "int", want: w ? w[f] : null })),
				{ ask: `endian_of ${q(a0)}`, kind: "str", want: w ? w.endian : null },
			];
		}
		case "isSupported":
			// 真は**前提そのもの**。`__` でないことしか意味を持たないので、返すのは問うた名前でよい。
			return [{ ask: `is_supported ${q(a0)}`, kind: "str", want: TI.isSupported(a0) ? a0 : null }];
		case "sizeOf":
			return [{ ask: `size_of ${q(a0)} ${q(a1)}`, kind: "int", want: TI.sizeOf(a0, a1) }];
		case "reduceToMachineType": {
			// 3つの欄を3つの問いに分ける。器を返す関数は sret の上界が要るので、
			// 表を引くだけの枚には持たせない（`idiom_to_instructions.md`）。
			const m = TI.reduceToMachineType(a0, a1);
			return [
				{ ask: `mt_size ${q(a0)} ${q(a1)}`, kind: "int", want: m ? m.size : null },
				{ ask: `mt_signed ${q(a0)} ${q(a1)}`, kind: "str", want: m && m.signed ? "signed" : null },
				{ ask: `mt_class ${q(a0)} ${q(a1)}`, kind: "str", want: m ? m.class : null },
			];
		}
		case "charSizeOf":
			return [{ ask: `char_size_of ${q(a0)}`, kind: "int", want: TI.charSizeOf(a0) }];
		case "charLimitOf":
			return [{ ask: `char_limit_of ${q(a0)}`, kind: "int", want: TI.charLimitOf(a0) }];
		case "literalDigits":
			return [{ ask: `literal_digits ${q(a0)}`, kind: "str", want: TI.literalDigits(a0) }];
		case "literalParts": {
			const p = TI.literalParts(a0);
			return [
				{ ask: `lit_family ${q(a0)}`, kind: "str", want: p ? p.family : null },
				{ ask: `lit_digits ${q(a0)}`, kind: "str", want: p ? p.digits : null },
				{ ask: `lit_radix ${q(a0)}`, kind: "int", want: p ? p.radix : null },
				{ ask: `lit_width ${q(a0)}`, kind: "int", want: p ? p.width : null },
			];
		}
		case "SIGNEDNESS[]":
			return [{ ask: `signed_of ${q(a0)}`, kind: "str", want: TI.SIGNEDNESS[a0] ?? null }];
		case "WIDTH_CLASS[]":
			return [{ ask: `class_of ${q(a0)}`, kind: "str", want: TI.WIDTH_CLASS[a0] ?? null }];
		case "CHARSETS[]":
			return [{ ask: `charset_of ${q(a0)}`, kind: "int", want: TI.CHARSETS[a0] ?? null }];
		case "TARGET_WIDTHS[]":
			return [{ ask: `(widths_of ${q(a0)}) ' gpr`, kind: "int", want: TI.TARGET_WIDTHS[a0]?.gpr ?? null }];
		default:
			return [{ ask: null, want: null, unknown: row.fn }];
	}
}

// 定数は問いにならない（関数ではないので記録にも出ない）が、**移すものではある**。
// niche はコーパスの `.s` に実際に出ている——字面の `.quad 0x8000000000000000` が 4 回
// （`.rodata` を持つ4枚に1つずつ）、同じビット列を作る `movz …, #0x8000, lsl #48` が
// 既定で 362 回・最適化を切ると 496 回（実測）。**この枚が持っている数がそこに立っている。**
const CONSTANTS = [
	{ ask: "unit_niche", kind: "str", want: TI.UNIT_NICHE_ASM, from: "定数" },
	{ ask: "default_charset", kind: "str", want: TI.DEFAULT_CHARSET, from: "定数" },
];

/**
 * **移していない枝と、その理由。** 覆っていないことと、忘れていることは別である
 * （`corpus.js` の `NOT_COVERED` と同じ扱い）。
 *
 * `literalDigits` の `String(text ?? "").slice(2)`——プリフィックスが無い字面で呼ばれた
 * ときの落とし所——は Sign へ移していない。同じ関数の但し書き（「プリフィックスは可変長
 * である」）と矛盾していて `16x…` で壊れるうえ、**到達 0 件**だからである。実際 JS 側の
 * 呼び出しは6か所（pass3 ×2 / interpreter ×3 / layout ×1 / pass4 ×1）とも、接頭辞つきの
 * 字面のノードにしか当たらない。Sign 側は「プリフィックスが在れば数字、無ければ `__`」。
 *
 * **差は実在する。** 問えば分かれる（実測、解釈器・機械とも一致してこう答える）:
 *
 *   literal_digits `48`    JS=`` （空の綴り）/ Sign=`__`
 *   literal_digits `1.5`   JS=`5`             / Sign=`__`
 *   literal_digits `1a41`  JS=`41`            / Sign=`__`
 *   literal_digits `120`   JS=`0`             / Sign=`__`
 *
 * **JS の答えの方が意味を持っていない。** `120` の数字が `0` になるのは、`slice(2)` が
 * 「プリフィックスは2文字」という、同じ関数が否定している前提で切っているからである。
 *
 * 門がこれを赤にしないのは、**誰もその問いを立てないから**である。だから下では
 * 「まだ誰も問うていない」ことの方を見張る——呼ぶ側が増えて到達した日に、**移すのか
 * JS 側を直すのかを決めろ**と言わせるためである。理由を書き置くだけだと、到達した日に
 * 門が黙って赤くなり、なぜ移していないのかが失われる。
 *
 * **見張りは一覧ではなく規則で書く。** 「この2つの字面」と並べると、表が増えた日に
 * 3つ目が黙って入る。条件は「`literalParts` が分けられない字面で `literalDigits` を呼ぶ」
 * であり、そこに当たる行が1つでも表に入ったら赤にする。
 */
const NOT_PORTED = [
	{
		what: "literalDigits の slice(2)（プリフィックスが無い字面）",
		why: "同じ関数の但し書き（プリフィックスは可変長）と矛盾していて、`16x…` でも `120` でも壊れる",
		reached: () => REACHED.filter((r) => r.fn === "literalDigits" && TI.literalParts(r.args[0]) === null),
	},
];

// ---- Sign 側へ同じ問いを立てる ----
//
// **駆動の行は落とさない。** 落とすと残りの関数が「呼ばれていない」ことになり、
// 機械の側が出せなくなる。問いは駆動の後ろに足すだけでよい（最後の式の値が x0 に来る）。
const programOf = (ask) => SOURCE + (SOURCE.endsWith("\n") ? "" : "\n") + ask + "\n";

const interpCache = new Map();
function interpAnswer(ask) {
	if (interpCache.has(ask)) return interpCache.get(ask);
	let out;
	try {
		const { nodes } = compile(programOf(ask), { charset: ASM_OPT.charset, readImport });
		const env = I.newRuntimeEnv(null, ASM_OPT.charset);
		let r = I.UNIT;
		for (const n of nodes) r = I.evaluate(n, env);
		// **名前が無いことは、答えが `__` であることとは違う。** 関数の位置の `__` は素通しなので
		// （`__ 5` = 5）、綴りを間違えると Sign 側は**引数をそのまま返す**——`__` ですらない。
		// 解釈器はそこに `未定義識別子` を積むので、黙って別の答えになる前にここで名指しする。
		const miss = env.diagnostics.filter((d) => d.identifier).map((d) => d.identifier);
		out = miss.length ? `(未定義: ${[...new Set(miss)].join(" ")})` : I.isUnit(r) ? "__" : norm(I.observe(r));
	} catch (e) {
		out = "解釈で例外：" + e.message.split("\n")[0].slice(0, 70);
	}
	interpCache.set(ask, out);
	return out;
}

const machineCache = new Map();
let qemuRuns = 0;
// x0 を符号付き64ビットで読む。出せないなら理由を文字列で返す。
function machineInt(ask) {
	if (machineCache.has(ask)) return machineCache.get(ask);
	let out;
	try {
		const { nodes, env } = compile(programOf(ask), { charset: ASM_OPT.charset, readImport });
		const r = generateAsm(nodes, env, ASM_OPT);
		if (r.diagnostics.length) out = { fail: "出せない：" + r.diagnostics[0].message };
		else {
			qemuRuns++;
			out = { v: asInt(runAsm(r.text)[0]) };
		}
	} catch (e) {
		out = { fail: "機械で例外：" + e.message.split("\n")[0].slice(0, 70) };
	}
	machineCache.set(ask, out);
	return out;
}
// 文字列の答えは**長さと1文字ずつ**で見る。x0 は器なら番地なので、そのままでは読めない。
function machineAnswer(ask, kind) {
	if (kind !== "str") {
		const r = machineInt(ask);
		return r.fail ? r.fail : r.v === null ? "__" : norm(r.v);
	}
	const len = machineInt(`||(${ask})||`);
	if (len.fail) return len.fail;
	// **長さ 0 は `__` である。** 器の `__` は「長さ 0 の器」として返るので、機械の上では
	// 空の器と区別が付かない（`||__||` も `||``||` も 0）。到達している問いに空文字列の
	// 答えは1つも無いので、ここでは `__` と読む——区別が要る問いが出たら、その日に分ける。
	if (len.v === null || Number(len.v) === 0) return "__";
	let s = "";
	for (let i = 0; i < len.v; i++) {
		const c = machineInt(`(${ask}) ' ${i}`);
		if (c.fail) return c.fail;
		if (c.v === null) return `(${i} 文字目が __)`;
		s += String.fromCodePoint(Number(c.v));
	}
	return q(s);
}

// ---- 突き合わせ ----
const toolsOk = available();
if (!toolsOk) console.log(`（qemu の道具が無いので機械の側は飛ばす: ${toolReport()}）`);

function ask(note, item) {
	const want = norm(item.want);
	for (const [engine, got] of [
		["解釈", interpAnswer(item.ask)],
		...(toolsOk ? [["機械", machineAnswer(item.ask, item.kind)]] : []),
	]) {
		total++;
		if (got === want) {
			passed++;
			console.log(`ok   ${engine} ${note.padEnd(46)} ${want}`);
		} else {
			console.log(`FAIL ${engine} ${note.padEnd(46)} JS=${want} / Sign=${got}`);
		}
	}
}

const items = [];
for (const row of REACHED) {
	for (const item of questionsOf(row)) {
		if (item.unknown) {
			total++;
			console.log(`FAIL 知らない問い ${item.unknown}（${JSON.stringify(row.args)}）——綴りを決めること`);
			continue;
		}
		items.push({ ...item, from: row.from, note: `${item.ask}` });
	}
}
for (const c of CONSTANTS) items.push({ ...c, note: c.ask });

/**
 * **見えているか——表の行と `match_case` の腕を、1本ずつ名指しで数える。**
 *
 * 門が見ているのは**問うたことだけ**である。表に行があっても誰も問わなければ、Sign 側の
 * その行には何を書いても緑のままになる。数え方は `REACHED_MNEMONICS` と同じ考え方だが、
 * 「出た綴りを並べる」のではなく**出ていない行を名指しさせる**ところが違う。
 *
 * 測り方は**ずらして見る**: JS 側の行を1つだけ別の値へ置き、この表の問いの答えが1つでも
 * 動くかを見る。動かないなら、その行は門の外に居る。行の名前も値も `target_info.js` から
 * 取る——検査の側に一覧を写すと、表が増えた日に**写した方だけが古くなる**。
 *
 * **ずらし方は「意味が変わる値」にする。** 綴りを汚す（`unsigned` → `unsigned!`）のでは
 * 足りない。JS の還元は `SIGNEDNESS[type] === "signed"` としか聞かないので、`unsigned` を
 * どう汚しても答えは `false` のままで、**JS 側でも観測できない**——それは門の穴ではなく
 * 「観測点が無い」だけである。だから符号は `signed` ⇄ `unsigned` と裏返し、クラスは別の
 * クラスへ移し、幅は隣の数へ動かし、腕は落とす。**この工程が実際に踏んだ壊し方**である。
 *
 * これは「Sign 側が正しいか」ではなく「**問いの集合がその行を見ているか**」の検査である。
 * 実測（2026-09-16）で、この検査は移植を入れた直後の表に **15 行の穴**を名指しした
 * ——`aarch64_rpi` の4欄・`aarch64_firmware` の4欄・`Raw` の符号とクラス・`utf32` の上限・
 * `is_access` の 2 / 4 / 8 / 16 の腕。原因は、門の表を作るときに
 * `widthsOf("aarch64_rpi")` を「答えが同じ」で `aarch64_qemu` へ畳み、幅を「数が返る」で
 * 畳んでいたことである（`target_info.test.js` はその問いを実際に立てているのに、である）。
 * **15 行のうち 14 行は、`.sn` を壊す実験でも素通りしていた。**
 *
 * **この検査で足りない所も、測ってある。** 見るのは行と腕であって**腕の順番ではない**。
 * `size_of` の「未対応なら `__`」の見張りを落としても、ここには1行も出ない
 * （`target_info.test.js` の「未対応なら Unit も決まらない」がそれを見ている）。
 */
function wantsSnapshot() {
	return JSON.stringify(REACHED.map((r) => questionsOf(r).map((i) => norm(i.want))));
}

// 行をずらして、戻す手を返す。**戻すのは必ずこの場で**——以降の問いは素の表を見る。
const put = (o, k, v) => () => {
	const was = o[k];
	o[k] = v;
	return () => (o[k] = was);
};
const drop = (set, v) => () => {
	set.delete(v);
	return () => set.add(v);
};
// 同じ表に居る別の値へ移す（クラスを別のクラスにする）。1種類しか無ければ数を動かす。
const other = (o, k) => {
	const vals = [...new Set(Object.values(o))].filter((v) => v !== o[k]);
	return vals.length ? vals[0] : typeof o[k] === "number" ? o[k] + 1 : o[k] + "!";
};

const LINES = [
	...Object.entries(TI.TARGET_WIDTHS).flatMap(([t, w]) =>
		Object.keys(w).map((f) => ({
			what: `target_widths ${q(t)} ' ${f}`,
			perturb: put(w, f, typeof w[f] === "number" ? w[f] + 1 : "big"),
		}))
	),
	...Object.keys(TI.SIGNEDNESS).map((k) => ({
		what: `signedness ${q(k)}`,
		perturb: put(TI.SIGNEDNESS, k, TI.SIGNEDNESS[k] === "signed" ? "unsigned" : "signed"),
	})),
	...Object.keys(TI.WIDTH_CLASS).map((k) => ({ what: `width_class ${q(k)}`, perturb: put(TI.WIDTH_CLASS, k, other(TI.WIDTH_CLASS, k)) })),
	...Object.keys(TI.CHARSETS).map((k) => ({ what: `charsets ${q(k)}`, perturb: put(TI.CHARSETS, k, TI.CHARSETS[k] + 1) })),
	...Object.keys(TI.CHARSET_LIMITS).map((k) => ({ what: `charset_limit ${q(k)}`, perturb: put(TI.CHARSET_LIMITS, k, TI.CHARSET_LIMITS[k] + 1) })),
	...[...TI.ACCESS_WIDTHS].map((n) => ({ what: `is_access の腕 ${n}`, perturb: drop(TI.ACCESS_WIDTHS, n) })),
	...[...TI.LITERAL_FAMILIES].map((f) => ({ what: `fam_ok の腕 \\${f}`, perturb: drop(TI.LITERAL_FAMILIES, f) })),
];

const blind = [];
{
	const base = wantsSnapshot();
	for (const line of LINES) {
		const undo = line.perturb();
		// **戻すのを例外に任せない。** 途中で落ちた表のまま以降の問いを立てると、
		// 門が JS 側の嘘の答えと突き合わせることになる。
		let moved;
		try {
			moved = wantsSnapshot() !== base;
		} finally {
			undo();
		}
		total++;
		if (moved) {
			passed++;
			console.log(`ok   見えている ${line.what}`);
		} else {
			blind.push(line.what);
			console.log(`FAIL 見えない   ${line.what} ——この行は誰も問うていない。Sign 側に何を書いても門は緑である`);
		}
	}
	if (wantsSnapshot() !== base) {
		total++;
		console.log("FAIL ずらした表が戻っていない——以降の問いは信用できない");
	}
}

for (const it of items) ask(it.note, it);

// **移していない枝は、まだ誰も問うていないこと。** 到達したら移植の判断が要る。
for (const d of NOT_PORTED) {
	total++;
	const hits = d.reached();
	if (!hits.length) {
		passed++;
		console.log(`ok   移さず  ${d.what} ——まだ誰も問うていない`);
	} else {
		console.log(`FAIL 移さず  ${d.what} が到達した: ${hits.map((r) => `${r.fn}(${JSON.stringify(r.args)}) [${r.from}]`).join(" / ")}`);
		console.log(`     ${d.why}——移すのか JS 側を直すのか、ここで決めること`);
	}
}

const byFrom = (f) => items.filter((i) => i.from === f).length;
// **`__` と答える問いは、何も書いていない枚でも通る。** その数を一緒に出す
// （`REACHED_MNEMONICS` が「届いている綴り」を出すのと同じ理由——見えていない範囲を数で言う）。
//
// **ただし広さの目安にしかならない。** 「未対応ターゲット × `Unit`」のように、**`__` と答える
// こと自体が見張り**の問いがある（それを落とすと Sign 側は `0` を返す）。そういう問いを足しても
// この数は動かないので、門が広がったかどうかは下の「行と腕」の方で見る。
const said = items.filter((i) => norm(i.want) !== "__").length;
console.log(
	`\n問い ${items.length} 通り（コーパスが立てた ${byFrom("corpus")} / 一式だけが立てた ${byFrom("suite")} / 定数 ${byFrom("定数")}）` +
		`、qemu を ${qemuRuns} 回まわした`
);
console.log(`うち答えが __ でない問いは ${said} 通り——残り ${items.length - said} 通りは、何も書いていない枚でも通る`);
console.log(
	`表の行と腕は ${LINES.length} 本、そのうち門が見ているのは ${LINES.length - blind.length} 本` +
		(blind.length ? `——見えていないのは ${blind.join(" / ")}` : "")
);
console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
