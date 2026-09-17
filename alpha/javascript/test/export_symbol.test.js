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
import { compile } from "../compile.js";
import { generateAsm, RESERVED_SYMBOLS, RESERVED_ORIGIN } from "../pass4.js";

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

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
