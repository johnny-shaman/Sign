/**
 * **`#` の印が、データの束縛にも届いているか。**
 *
 * 綴りは前から在った（`.st` には `#` 付きのデータが 56 個載る）。届いていなかったのは
 * 後段の1か所——`internBindingImage` がラベルを `.Lbind_…` で作り、`exportLevelOf` を
 * 一度も引いていなかった。結果として **export の印は関数にしか効いていなかった**：
 * `#t` と書いても `.Lbind_t` というローカルラベルで出るので、外から引けない。
 *
 * この枚は**印 × 形の全組**を表で見る。関数だけが出ていた頃の表がそのまま before で、
 * ここに置いてあるのが after である。表で持つのは、1つの組だけ直して他を忘れる形を
 * 捕まえるためで、実際この作業でも「`runsOnce` の束縛だけ印が落ちる」（登録が先に
 * 起きて `hit` の枝を通る）が起きていた。
 *
 * 見るのは:
 *   1. 印 × 形の全組で、出るシンボル（節・`.global`/`.hidden`・ラベルの綴り）
 *   2. `hit` の枝——先に登録された束縛でも印が届くこと
 *   3. `.L` で始まるラベルは公開できないこと（実測: `error: non-local symbol required`）
 *   4. `###` のデータは関数の `.sign.pinned,"ax"` へは行けないこと
 *      （実測: `error: changed section flags for .sign.pinned, expected: 0x6`）
 *   5. 後段が自分で出す綴り（`_sign_main` / `_start`）は公開を断ること
 *
 * 実行: node test/export_symbol.test.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { execFileSync } from "child_process";
import { compile, definedNameOf } from "../compile.js";
import { preprocess } from "../lexer.js";
import { parse } from "../parser.js";
import { generateAsm, RESERVED_SYMBOLS, RESERVED_ORIGIN } from "../pass4.js";
import { generateSignType } from "../st.js";
import { evaluate, newRuntimeEnv, UNIT, observe } from "../interpreter.js";
import { toolPath, toolReport } from "../qemu_run.js";
import { SIGN_DIR, readImport } from "./corpus.js";

let passed = 0;
let total = 0;
function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
	if (!ok) console.log(`     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPT = { target: "aarch64_qemu", charset: "ascii", layer: 1 };
const asmOf = (src) => {
	const { nodes, env } = compile(src, { charset: "ascii" });
	return generateAsm(nodes, env, OPT);
};

/**
 * `name` という束縛が出したシンボルを1行で言う。出ていなければ `像なし`。
 *
 * 見るのは**節・見え方・ラベルの綴り**の3つで、これがそのまま「外から引けるか」である。
 * 節を追うのは `###` が節で配置を言う印だからで、ラベルの綴りを追うのは `.L` が
 * 公開できない（＝公開するなら綴りが変わる）からである。
 */
function symbolOf(text, name) {
	let section = ".text";
	const pending = [];
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		const sec = line.match(/^\.section\s+([^,\s]+)(.*)$/);
		// **節の切り替えで見え方を捨てない。** 関数の `###` は `.global` を出してから
		// 節を切り替える（`symbolDirectives` の並び）ので、ここで捨てると印が消えて見える。
		if (sec) {
			section = sec[1] + (sec[2] ? sec[2].replace(/\s+/g, "") : "");
			continue;
		}
		if (line === ".text") {
			section = ".text";
			continue;
		}
		const vis = line.match(/^\.(global|hidden)\s+(\S+)$/);
		if (vis) {
			pending.push(line);
			continue;
		}
		const lab = line.match(/^([.\w$]+):$/);
		if (lab) {
			const label = lab[1];
			if (label === name || label === `.Lbind_${name}`) {
				return `${section} | ${pending.join(" ") || "（印なし）"} | ${label}`;
			}
			pending.length = 0;
			continue;
		}
	}
	return "像なし";
}

// --- 1. 印 × 形の全組 ------------------------------------------------------
//
// 形ごとに「像が出る書き方」を選んである。スカラーは `$v` が場所を作り、構造体は
// 値として渡すと名前ごとに一つの場所を持つ（`genLoadBinding`）。**書き方を変えると
// 像そのものが出ない**ので、この列は「印が効くか」だけを見るためのものである。
const FORMS = {
	"スカラー": (m) => `${m}v : 42\n$v\nv + 1\n`,
	"文字列": (m) => `${m}v : \`hi\`\nv\n`,
	"名前付き構造体": (m) => `f : s ? s ' a\n${m}v :\n\ta : 1\n\tb : 2\nf v\n`,
	"連番スロット": (m) => `f : s ? s ' 0\n${m}v : 1 , 2 , 3\nf v\n`,
	"効果つきスカラー": (m) => `inc : x ? x + 1\n${m}v : inc 5\nv + v\n`,
	"関数": (m) => `${m}v : x ? x + 1\nv 1\n`,
};
const MARKS = [["無印", ""], ["#", "#"], ["##", "##"], ["###", "###"]];

// **after の表。** 関数の行だけが before から変わっていない——そこだけが効いていた。
const TABLE = {
	"スカラー": {
		"無印": ".data | （印なし） | .Lbind_v",
		"#": ".data | .global v .hidden v | v",
		"##": ".data | .global v | v",
		"###": '.sign.pinned.data,"aw",%progbits | .global v | v',
	},
	// 文字列の中身は名前を持たない像（`.Lstr0`）で、束縛は像を持たない。
	// `$v` は「アドレスを取れるのはフレームに在るものだけです」で断られる——
	// **公開する前に、置く場所が無い**。印の問題ではないので、ここは全組 `像なし` が正しい。
	"文字列": { "無印": "像なし", "#": "像なし", "##": "像なし", "###": "像なし" },
	"名前付き構造体": {
		"無印": ".rodata | （印なし） | .Lbind_v",
		"#": ".rodata | .global v .hidden v | v",
		"##": ".rodata | .global v | v",
		"###": '.sign.pinned.rodata,"a",%progbits | .global v | v',
	},
	// 連番スロットは使うたびにフレームへ並べ直される（`structImageOf` の道に乗らない）。
	// **印より手前で像が無い。** ここが開くのは器の道が場所を持ってからである。
	"連番スロット": { "無印": "像なし", "#": "像なし", "##": "像なし", "###": "像なし" },
	// 効果を持つ束縛は `runsOnce` の道が**先に**像を登録する。印を呼ぶ側から渡す作りだと
	// ここだけ落ちた（実測で `.global` の無い `.Lbind_v` が診断ゼロで出た）。
	"効果つきスカラー": {
		"無印": ".data | （印なし） | .Lbind_v",
		"#": ".data | .global v .hidden v | v",
		"##": ".data | .global v | v",
		"###": '.sign.pinned.data,"aw",%progbits | .global v | v',
	},
	"関数": {
		"無印": ".text | （印なし） | v",
		"#": ".text | .global v .hidden v | v",
		"##": ".text | .global v | v",
		"###": '.sign.pinned,"ax",%progbits | .global v | v',
	},
};

for (const [form, mk] of Object.entries(FORMS)) {
	for (const [mark, m] of MARKS) {
		check(`${form} × ${mark}`, symbolOf(asmOf(mk(m)).text, "v"), TABLE[form][mark]);
	}
}

// --- 2. `hit` の枝にも印が届く ---------------------------------------------
//
// 同じ事実が5か所（`bindingLabel` のリテラルと効果、`structBindingLabel`、器、
// トップレベルの書き戻し）から入ってくる。**印は名前から引く**ので、どの入口を先に
// 通っても答えは同じでなければならない。
{
	const src = "inc : x ? x + 1\n##once : inc 5\nonce + once\n";
	check("先に登録された束縛にも `.global` が出る", symbolOf(asmOf(src).text, "once"), ".data | .global once | once");
}

// --- 3. `.L` で始まるラベルは公開されない ----------------------------------
//
// 実測（clang）: `lbl.s:2:10: error: non-local symbol required` / `.global .Lbind_t`。
// 綴りを変えずに `.global` だけ足す直し方は、アセンブラが止める。
{
	const srcs = [
		"##v : 42\n$v\nv + 1\n",
		"f : s ? s ' a\n#v :\n\ta : 1\n\tb : 2\nf v\n",
		"###v : x ? x + 1\nv 1\n",
	];
	const bad = [];
	for (const s of srcs) {
		for (const line of asmOf(s).text.split("\n")) {
			const m = line.trim().match(/^\.(global|hidden)\s+(\S+)$/);
			if (m && m[2].startsWith(".L")) bad.push(line.trim());
		}
	}
	check("`.L` で始まるシンボルは公開しない", bad, []);
}

// --- 4. `###` のデータは関数の節へ行かない ---------------------------------
//
// 実測（clang）: `sec.s:4:2: error: changed section flags for .sign.pinned, expected: 0x6`。
// 1つの節名は1組の属性しか持てないので、"ax" にデータを混ぜると**同じオブジェクトに
// 同居できない**（混ぜれば W^X も壊れる）。名前で分ける。
{
	const src = "g : s ? s ' a\n###ro :\n\ta : 1\n\tb : 0\n###rw :\n\ta : 1\n\tb : 0\n###fn : x ? x + 1\n$rw\n(g ro) + (fn 1)\n";
	const text = asmOf(src).text;
	const secs = text.split("\n").map((l) => l.trim()).filter((l) => l.startsWith(".section .sign.pinned"));
	check("`###` は3つの節に分かれる", secs, [
		'.section .sign.pinned,"ax",%progbits',
		'.section .sign.pinned.rodata,"a",%progbits',
		'.section .sign.pinned.data,"aw",%progbits',
	]);
	check("読むだけの `###` は `.sign.pinned.rodata`", symbolOf(text, "ro"), '.sign.pinned.rodata,"a",%progbits | .global ro | ro');
	check("書かれる `###` は `.sign.pinned.data`", symbolOf(text, "rw"), '.sign.pinned.data,"aw",%progbits | .global rw | rw');
}

// --- 5. 後段が自分で出す綴りは公開できない ---------------------------------
//
// 無印なら `.Lbind__sign_main` なので当たらなかった。公開が**広げる**穴で、実測の
// `.s` は `error: symbol '_sign_main' is already defined` でアセンブラが止まる。
{
	const src = "##_sign_main : 7\n$_sign_main\n_sign_main + 1\n";
	const r = asmOf(src);
	check(
		"`_sign_main` の公開を断る",
		r.diagnostics.map((d) => `${d.severity}: ${d.message}`),
		["error: `_sign_main` は後段が自分で出す綴りなので公開できません（`##` を外すか、名前を変えてください）"],
	);
	// `_sign_main` はもともと後段が出すラベルなので `symbolOf` では区別が付かない。
	// 見るのは**定義行が何本あるか**で、公開していれば2本（`_sign_main:` が2回）になる。
	const defs = r.text.split("\n").map((l) => l.trim()).filter((l) => /^[.\w$]+:$/.test(l));
	check("断ったので二重定義にならない", defs.filter((l) => l === "_sign_main:").length, 1);
	check("像はローカルラベルのまま", defs.includes(".Lbind__sign_main:"), true);
	const s2 = asmOf("##_start : 7\n$_start\n_start + 1\n");
	check("`_start` も同じ", s2.diagnostics.map((d) => d.severity), ["error"]);
	// 印が無ければ何も言わない（名前そのものを禁じてはいない）。
	check("無印の `_sign_main` には何も言わない", asmOf("_sign_main : 7\n$_sign_main\n_sign_main + 1\n").diagnostics, []);
}

// ---- 予約された綴りは、配置側を読んで覆えているか ----
//
// **同じ事実が2か所に在る。** `RESERVED_SYMBOLS`（pass4.js）と、実際に綴りを定義している
// `qemu/link.ld` / `qemu/start.s` である。片方だけ増やすと、増えた綴りは**黙って公開できて
// しまう**——そしてリンカスクリプトの綴りは**誰も止めない**。実測（2026-09-18）:
//
//   `##_stack_top : 42` を読むと 43 ではなく 9120000090000001（自分の `.text`）
//   診断ゼロ、`ld` の終了コード 0
//
// 後段と起動コードの綴りはアセンブラが `already defined` で止めるので気付ける。
// **止まらない方を、ここが見る。** 配置側を読んで、覆えていない綴りが1つでも在れば赤。
{
	const asset = path.join(__dirname, "..", "qemu");
	const ld = fs.readFileSync(path.join(asset, "link.ld"), "utf8");
	const st = fs.readFileSync(path.join(asset, "start.s"), "utf8");
	// link.ld の代入（`_name = …`）と、start.s のラベル（`name:`）と `.global`。
	const defined = new Set();
	for (const m of ld.matchAll(/^[ 	]*(_[A-Za-z0-9_]*)[ 	]*=/gm)) defined.add(m[1]);
	for (const m of st.matchAll(/^([A-Za-z_][A-Za-z0-9_]*):/gm)) defined.add(m[1]);
	for (const m of st.matchAll(/^[ 	]*.global[ 	]+([A-Za-z_][A-Za-z0-9_]*)/gm)) defined.add(m[1]);
	// `.` で始まる局所ラベルと、外から渡す `__…` は代入の形で拾えるので一緒に見る。
	const missing = [...defined].filter((n) => !RESERVED_SYMBOLS.has(n)).sort();
	check("配置側が定義する綴りは全部、予約集合が覆っている", missing, []);
	check("配置側から綴りを拾えている（拾えていないと上が空で緑になる）", defined.size >= 6, true);
	// 出どころの表も一緒に落ちること（断りの言い分が「後段が出す」に化けない）。
	const noOrigin = [...RESERVED_SYMBOLS].filter((n) => !RESERVED_ORIGIN[n]).sort();
	check("予約した綴りは全部、出どころを言える", noOrigin, []);
}

// =========================================================================
// **引く側は定義を公開しない。**（2026-09-18）
//
// `resolveImports` はインポートを**ソースのまま展開する**ので、印を「公開定義を出す」に
// 繋いだ日から、表を使う枚が全部**同じ表の定義を公開していた**。動機は C の `.h` と `.o` の
// 分け方であり、**ヘッダを include しても定義は増えない**のがその形である。
//
// 直したのは `compile.js` の `resolveImports` 1か所で、撒かれてきた行の印を**字句のまま**
// 落とす。**展開そのものは今までどおり**なので、引く側の `.o` には表の像が `.Lbind_…` で
// 残る——消えるのは**シンボルの重複だけ**で、データの重複は残る（ソース展開をやめる話）。
//
// 門は4枚ある。リンクより手前の3枚（§6〜§8）は compile を1回走らせるだけで、
// リンクするより安く、しかも**どの名前が余ったか**まで言える。§9 がそれを end-to-end で
// 裏書きする——「`.s` に `.global` が無い」と「繋いで重複しない」は別の主張である。
// =========================================================================

/**
 * その `.sn` **自身のソースが** `#`/`##`/`###` した名前。
 *
 * 判じるのは `definedNameOf`（`compile.js`）——**印がどの行に付いているかを決める唯一の
 * 場所**である。ここで自前の正規表現を持つと同じ事実が2か所になり、片方だけ動く。
 * インポート行（`` `x.sn`@~ ``）は束縛ではないので `null` が返る。
 */
const ownExportsOf = (src) => parse(preprocess(src)).map(definedNameOf).filter((d) => d && d.exported).map((d) => d.name.slice(1, -1));

/** `.s` に出た `.global` の綴り。`_sign_main` は後段が自分で出すので別に数える。 */
const globalsOf = (text) => [...text.matchAll(/^[\t ]*\.global[\t ]+(\S+)$/gm)].map((m) => m[1]).filter((n) => n !== "_sign_main").sort();

const asmOfFile = (name) => {
	const c = compile(readImport(name), { readImport });
	return generateAsm(c.nodes, c.env, OPT).text;
};

// --- 6. コーパスの6枚: 自分が定義していない名前の `.global` は出ない ------
//
// **これが目標そのものである。** `own` と `globals` を golden に置くのは「落としすぎて
// いない」側を見るためで、`operator_table.sn` の 13 個が消えたら赤になる。
//
// `strict_infix` が `own` に在って `globals` に無いのは印の話ではない——`operator_table.sn`
// **単独では一度も使われない**平らな器なので、そもそも像が出ない（`corpus.js` の
// `ST_EDGES` の注記と同じ事実）。引く側（`preprocess.sn`）では使われるから像は出るが、
// そちらの印は落ちるので `.global` にはならない。
{
	const N13 = ["asm_enclosure_shape", "asm_enclosure_signed", "asm_infix_shape", "asm_infix_signed", "asm_infix_width", "asm_postfix_shape", "asm_prefix_place", "asm_prefix_shape", "asm_prefix_width", "enclosure", "infix", "postfix", "prefix"];
	const SHAPE = {
		"preprocess.sn": { own: [], globals: [] },
		"lexer.sn": { own: [], globals: [] },
		"parser.sn": { own: [], globals: [] },
		"operator_table.sn": { own: [...N13, "strict_infix"].sort(), globals: N13 },
		"emit.sn": { own: [], globals: [] },
		"target_info.sn": { own: [], globals: [] },
	};
	// 表が `alpha/sign` の全部を覆っていること（増えた日に忘れない）。
	check("表はコーパスの `alpha/sign` を全部覆っている", fs.readdirSync(SIGN_DIR).filter((f) => f.endsWith(".sn")).sort(), Object.keys(SHAPE).sort());

	for (const [name, want] of Object.entries(SHAPE)) {
		const src = readImport(name);
		const own = ownExportsOf(src).sort();
		const got = globalsOf(asmOfFile(name));
		check(`${name}: 自分のソースが \`#\` した名前`, own, want.own);
		check(`${name}: \`.s\` に出た \`.global\``, got, want.globals);
		// **門の芯。** 表を書き換えても、この2行は表から独立に成り立たなければならない。
		check(`${name}: 自分が定義していない名前は公開しない`, got.filter((n) => !own.includes(n)), []);
		check(`${name}: \`.st\` も同じ答えを言う`, (() => {
			const c = compile(src, { readImport });
			const st = generateSignType(c.nodes, c.env, { scope: "st", source: name });
			return st.text.split("\n").filter((l) => l.startsWith("#")).map((l) => l.replace(/^#+/, "").split(" ")[0]).sort();
		})(), own);
	}
}

// --- 7. 入れ子の import と、同じ名前を両方が定義する場合 -------------------
//
// 値は**関数**にしてある。字面の Int も静的に引ける器も畳まれて像が出ないので、
// `.global` が動く所まで測れない（最初に書いた版はスカラーで、3枚とも `.global` が1つしか
// 出ずに「直っている」ように見えた）。
{
	const modsReader = (mods) => (full) => {
		const b = path.basename(full);
		if (!(b in mods)) throw new Error(`知らない枚: ${b}`);
		return mods[b];
	};
	const look = (mods, entry) => {
		const c = compile(entry, { readImport: modsReader(mods) });
		const r = generateAsm(c.nodes, c.env, OPT);
		const labels = r.text.split("\n").map((l) => l.trim()).filter((l) => /^[a-z]\w*:$/.test(l));
		const c2 = compile(entry, { readImport: modsReader(mods) });
		const st = generateSignType(c2.nodes, c2.env, { scope: "st", source: "entry.sn" });
		return {
			globals: globalsOf(r.text),
			labels: labels.sort(),
			stEntries: st.entries,
			pinned: r.text.split("\n").map((l) => l.trim()).filter((l) => l.startsWith(".section .sign.pinned")),
			diagnostics: r.diagnostics.map((d) => `${d.severity}: ${d.message}`),
		};
	};

	// **推移的な import は公開されない。** entry が b を、b が c を引く。
	const nest = look(
		{ "b.sn": "`c.sn`@~\n#bf : x ? (cf x) + 2\nbf 1\n", "c.sn": "#cf : x ? x + 1\ncf 1\n" },
		"`b.sn`@~\n#af : x ? (bf x) + 4\naf 1\n",
	);
	check("入れ子: 公開されるのは入口が自分で書いた名前だけ", nest.globals, ["af"]);
	// **像は3つとも残る**（展開は今までどおり）。ここが空になったら、消えたのは印ではなく
	// 定義そのものである——「印だけを落とした」ことの証拠がこの行である。
	check("入れ子: 像は3つとも残る（消えたのは印だけ）", nest.labels, ["af:", "bf:", "cf:"]);
	check("入れ子: `.st` も入口の1つだけ", nest.stEntries, 1);
	check("入れ子: 診断は出さない", nest.diagnostics, []);

	// **同じ名前を両方が定義する場合は、これでは直らない。** 印の話ではなく
	// 「1つの単位に同じ名前が2つ在る」話である——印を1つも付けなくてもラベルは2つ出るし、
	// アセンブラが `error: symbol 'foo' is already defined` で止める（§9 で原文を見る）。
	// **ソース展開そのものをやめる**まで残るので、直らないことを記録しておく。
	const dup = look({ "m.sn": "#foo : x ? x + 1\nfoo 1\n" }, "`m.sn`@~\n#foo : x ? x + 2\nfoo 1\n");
	check("同名: ラベルが2つ出る（印を落としても直らない）", dup.labels, ["foo:", "foo:"]);
	check("同名: `.global` も2つ出る（env は名前ごとに1つの答えしか持てない）", dup.globals, ["foo", "foo"]);
	check("同名: しかも診断は0件", dup.diagnostics, []);
	// 引いた側だけが `#` で、自分は無印——env は後の定義が勝つので、印は残らない。
	// **印は昔から名前単位で1つしか残らない。** 引く側から旗を渡す作りが危ないのもここと同じ理由。
	const dup2 = look({ "m.sn": "#foo : x ? x + 1\nfoo 1\n" }, "`m.sn`@~\nfoo : x ? x + 2\nfoo 1\n");
	check("同名: 自分が無印なら公開しない", dup2.globals, []);
	// 印が1つも無くてもラベルは2つ出る。**印はこの衝突の原因ではない**ことの証拠。
	const dup3 = look({ "m.sn": "foo : x ? x + 1\nfoo 1\n" }, "`m.sn`@~\nfoo : x ? x + 2\nfoo 1\n");
	check("同名: 印が1つも無くてもラベルは2つ出る", [dup3.labels, dup3.globals], [["foo:", "foo:"], []]);

	// **`###` は「公開」と「置き場所」の2つを言っている。** 印を落とすと置き場所も落ちる
	// ——引いた `###` の像は `.sign.pinned` へ行かない。置き場所は**定義した枚**が持つ、
	// という読みである。今日の `alpha/sign` と `documents` に `###` は1つも無い（`#` が 24 個）。
	const pinIn = look({ "m.sn": "###pv : x ? x + 1\npv 1\n" }, "`m.sn`@~\npv 1\n");
	const pinOwn = look({}, "###pv : x ? x + 1\npv 1\n");
	check("`###`: 引いた側は公開もしないし節にも置かない", [pinIn.globals, pinIn.pinned], [[], []]);
	check("`###`: 自分で書いた側はどちらも今までどおり", [pinOwn.globals, pinOwn.pinned], [["pv"], ['.section .sign.pinned,"ax",%progbits']]);

	// **印を剥がすと行の長さが1つ縮む。** `inlineSoloLambdaBlocks` は「右辺が1行だけの
	// 字下げブロックでラムダなら剥がす」を `line.length !== (d.exported ? 4 : 3)` で見ており、
	// **`resolveImports` の後に走る**。印を剥がしてから渡すので、撒かれてきた定義は
	// 無印の形（長さ 3）で当たらなければならない——剥がし損ねると `go` は値のままになり、
	// `go 4 5` が黙って 5 を返す（`compile.js` の `inlineSoloLambdaBlocks` の注記と同じ形）。
	{
		const mod = "#go :\n\t\tx y\n\t?\n\t\tx * y\ngo 2 3\n";
		const run = (src, text) => {
			const { nodes } = compile(src, { readImport: (full) => { if (path.basename(full) === "m.sn") return text; throw new Error("知らない枚"); } });
			const env = newRuntimeEnv(null);
			let r = UNIT;
			for (const n of nodes) r = evaluate(n, env);
			return observe(r);
		};
		check("撒かれてきた `#` 付きの1行ブロックも剥がれる", run("`m.sn`@~\ngo 4 5\n", mod), 20);
		check("無印で撒かれた同じ形（前から通っていた側）", run("`m.sn`@~\ngo 4 5\n", mod.replace("#go :", "go :")), 20);
	}

	// **印は3種類ある。** コーパスに在るのは `#` だけ（`alpha/sign` と `documents` の
	// `.sn` 全部で `#` が 24 個、`##` と `###` は 0 個）なので、種類ごとに1本ずつ置く
	// ——実測で、`#` だけ落とす変異はコーパスの門を1つも赤くしなかった。
	for (const m of ["#", "##", "###"]) {
		const got = look({ "m.sn": `${m}qv : x ? x + 1\nqv 1\n` }, "`m.sn`@~\nqv 1\n");
		const own = look({}, `${m}qv : x ? x + 1\nqv 1\n`);
		check(`\`${m}\`: 引いた側は公開しない`, got.globals, []);
		check(`\`${m}\`: 自分で書いた側は公開する`, own.globals, ["qv"]);
	}
}

// --- 8. `.st` から落ちた性質を、穴として名指しで残す ---------------------
//
// 引く側の `.st` は 14 エントリ（全部 `operator_table` の素通し）から **0** になった。
// `.s` の `.global` が消えたのと同じ1つの事実で、`own` が空の枚が 14 を公開していた方が
// おかしかった。**ただし落ちた性質がある**——素通しが在った頃は、第三の枚が `parser.st`
// **だけ**を読んで表を引けた。いまは落ちる。しかも:
//
//   前段（`compile`）の診断は **0 件**、名指しするのは pass4 だけ
//
// 「この `.st` では足りない、`operator_table.st` も要る」と言える綴り（C の `#include` に
// 当たるもの）も、前段の診断も、まだ無い。**黙った誤答ではなく遅い断り**なので通すが、
// 忘れないように形そのものを門に置く。ここが緑でなくなる日は、どちらかが出来た日である。
{
	const src = readImport("parser.sn");
	const c = compile(src, { readImport });
	const st = generateSignType(c.nodes, c.env, { scope: "st", source: "parser.sn" });
	check("引く側の `.st` は空になる（素通しを公開しない）", st.entries, 0);

	// `parser.st` **だけ**を読む第三の枚。読み手は `.sn` を求められたら投げる。
	const asked = [];
	const stOnly = (full) => {
		asked.push(path.basename(full));
		if (path.basename(full) === "parser.sn") return { text: st.text, path: "parser.st" };
		throw new Error(`門は \`.sn\` を渡さない（${full}）`);
	};
	const third = "`parser.sn`@~\nzz : infix ' `+`\nzz ' `name`\n";
	const t = compile(third, { readImport: stOnly });
	const r = generateAsm(t.nodes, t.env, OPT);
	check("第三の枚は `parser.st` を引いた", asked, ["parser.sn"]);
	check("前段は何も言わない（穴はここ）", t.diagnostics.map((d) => `${d.severity}: ${d.message}`), []);
	check(
		"名指しするのは pass4 だけ",
		r.diagnostics.map((d) => `${d.severity}: ${d.message}`),
		["error: まだ出せない識別子です（infix）", "error: まだ出せない識別子です（zz）"],
	);
}

// --- 9. ld.lld で2枚繋ぐ（end-to-end） -----------------------------------
//
// §6 は「`.s` に `.global` が出ない」しか言わない。**繋いで重複しない**のは別の主張で、
// 節・可視性・`.o` の中の綴りまで通した後でしか確かめられない。直す前の実測は
// **重複 14 件**（13 個の表＋`_sign_main`）で、5対とも同じだった。
//
// `_sign_main` は**別問題**として数える——2枚とも入口を定義する、という話であり、
// 印とは関わらない（無印でも `_sign_main` は出る）。
{
	const clang = toolPath("clang");
	const lld = toolPath("lld");
	if (!clang || !lld) {
		// **飛ばしたことは大きく言う。** 静かに飛ばすと、道具の無い機械で門が消える。
		console.log(`SKIP リンクの門: 道具が無い（${toolReport()}）——§9 の5対は測っていない`);
	} else {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sign-dup-"));
		const objOf = (name) => {
			const s = path.join(dir, name.replace(/\.sn$/, ".s"));
			const o = path.join(dir, name.replace(/\.sn$/, ".o"));
			fs.writeFileSync(s, asmOfFile(name));
			execFileSync(clang, ["--target=aarch64-unknown-none", "-c", s, "-o", o], { stdio: "pipe" });
			return o;
		};
		const PAIRS = [
			["operator_table.sn", "parser.sn"],
			["operator_table.sn", "emit.sn"],
			["parser.sn", "emit.sn"],
			["preprocess.sn", "emit.sn"],
			["preprocess.sn", "parser.sn"],
		];
		const objs = {};
		for (const n of new Set(PAIRS.flat())) objs[n] = objOf(n);
		for (const [a, b] of PAIRS) {
			let err = "";
			try { execFileSync(lld, ["-o", path.join(dir, "out.elf"), objs[a], objs[b]], { stdio: "pipe" }); }
			catch (e) { err = String(e.stderr || "") + String(e.stdout || ""); }
			const dup = [...err.matchAll(/duplicate symbol: (\S+)/g)].map((m) => m[1]);
			check(`${a} + ${b}: 重複は \`_sign_main\` だけ`, dup, ["_sign_main"]);
		}
		// 同名の衝突は**印では直らない**（§7）。アセンブラの断りを原文のまま見る。
		const dupSrc = compile("`m.sn`@~\n#foo : x ? x + 2\nfoo 1\n", {
			readImport: (full) => { if (path.basename(full) === "m.sn") return "#foo : x ? x + 1\nfoo 1\n"; throw new Error("知らない枚"); },
		});
		const sPath = path.join(dir, "dup.s");
		fs.writeFileSync(sPath, generateAsm(dupSrc.nodes, dupSrc.env, OPT).text);
		let asmErr = "";
		try { execFileSync(clang, ["--target=aarch64-unknown-none", "-c", sPath, "-o", path.join(dir, "dup.o")], { stdio: "pipe" }); }
		catch (e) { asmErr = String(e.stderr || ""); }
		check("同名はアセンブラが止める（印では直らない）", asmErr.includes("symbol 'foo' is already defined"), true);
	}
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
