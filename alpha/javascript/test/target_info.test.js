/**
 * ターゲットごとの幅クラスと、Layer 2 型から「何バイト幅・符号あり/なし」への還元
 * （compiler_pipeline.md §3、type_system.md §2）。
 *
 * Pass 3 が出すのは型の**名前**だが、Pass 4 が要るのは幅と符号である。その継ぎ目がここ。
 * 幅は設計判断ではなく ISA の転記である——`Address` は「GPR 幅」、`Float` は「ターゲットの
 * FPU が持つ最高精度」と型システムが定めており、どちらもレジスタファイルを名指ししている。
 *
 * 実行: node test/target_info.test.js（`npm test` からも呼ばれる）
 */
import { widthsOf, isSupported, sizeOf, reduceToMachineType, charSizeOf, charLimitOf, literalParts, literalDigits, CHARSETS, CHARSET_LIMITS, DEFAULT_CHARSET, ACCESS_WIDTHS, LITERAL_FAMILIES } from "../target_info.js";
import { readOptionMs } from "../option_ms.js";

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

// ---- AArch64 の幅（ISA の転記） ----
//
// X レジスタが 64bit、FPU は倍精度、NEON の Q レジスタが 128bit。
// この3つが Layer 2 の幅クラス（GPR / FPU / SIMD）にそのまま対応する。
check("GPR は 8 byte（X レジスタ）", widthsOf("aarch64_qemu").gpr, 8);
check("FPU の最高精度は 8 byte（倍精度）", widthsOf("aarch64_qemu").float, 8);
check("SIMD は 16 byte（NEON の Q レジスタ）", widthsOf("aarch64_qemu").vector, 16);
check("エンディアンはリトル", widthsOf("aarch64_rpi").endian, "little");
check("aarch64 の3ターゲットは同じ幅", widthsOf("aarch64_firmware"), widthsOf("aarch64_qemu"));

// ---- 型から幅と符号への還元 ----
check("Int は GPR 幅・符号あり", reduceToMachineType("Int", "aarch64_qemu"), { size: 8, signed: true, class: "gpr" });
check("Address は GPR 幅・符号なし", reduceToMachineType("Address", "aarch64_qemu"), { size: 8, signed: false, class: "gpr" });
check("Float は FPU 幅", reduceToMachineType("Float", "aarch64_qemu"), { size: 8, signed: true, class: "float" });
check("Vector は SIMD 幅", reduceToMachineType("Vector", "aarch64_qemu"), { size: 16, signed: true, class: "vector" });
// 零対象は値を持たないので場所を占めない（unit.md）。
check("Unit は 0 byte", sizeOf("Unit", "aarch64_qemu"), 0);

// **`Int` と `Address` は同じ幅で別の型である。**
//
// AArch64 では両方 X レジスタに乗るので幅が一致する。それは統合の理由にならない
// ——分けた根拠はビット幅ではなく**溢れ方**（`Address` は `__` へ収束、`Int` はラップ
// アラウンド）だからである（type_system.md §3.6）。帳簿の上では符号で分かれる。
check(
	"幅は同じだが符号が違う",
	[
		sizeOf("Int", "aarch64_rpi") === sizeOf("Address", "aarch64_rpi"),
		reduceToMachineType("Int", "aarch64_rpi").signed !== reduceToMachineType("Address", "aarch64_rpi").signed,
	],
	[true, true]
);
// C の `int` は 64bit 環境でも 32bit だが、それは歴史的互換であってハードウェアの事実では
// ない。AArch64 の整数レジスタは X（64bit）で W はその部分ビューなので、原理1 に従えば
// 書き写すべきは X の方である。
check("Int は 4 byte ではない（C の int を引き継がない）", sizeOf("Int", "aarch64_qemu"), 8);

// ---- 単体では決まらないもの ----
//
// 長さや並びが型名だけでは決まらないものは null を返す。これらは形（shape）を持つノードから
// 計算する仕事であり、スカラーの幅を答えるこのモジュールの責務ではない。
check("String は単体では決まらない（`List(0u)` と同型で長さが型に無い）", sizeOf("String", "aarch64_qemu"), null);
check("List も決まらない", sizeOf("List", "aarch64_qemu"), null);
check("Struct も決まらない", sizeOf("Struct", "aarch64_qemu"), null);

// ---- 未対応ターゲットは「まだ決まっていない」と言う ----
//
// Sign の初期構想は AArch64 が対象である。他のターゲットは ISA としての幅こそ自明でも、
// FPU の有無（Cortex-M は品種による）や `Int` を GPR 幅に揃えるかが実機に触れないと
// 決められない。**憶測で埋めると間違った幅で通ってしまう方が危ない**ので null を返す
// ——分からないことを分かった顔で通さないのは原理4 と同じ線引きである。
check("aarch64 は対応済み", isSupported("aarch64_qemu"), true);
check("cortex_m はまだ未対応", isSupported("cortex_m"), false);
check("未対応なら幅も null", widthsOf("cortex_m"), null);
check("未対応なら sizeOf も null", sizeOf("Int", "cortex_m"), null);
check("未知のターゲットも同じ", widthsOf("nosuch"), null);

// **「未対応」は零対象より先に立つ。** `Unit` は幅が型名だけで決まる唯一の型なので、
// ターゲットを見ずに 0 を返す道がある。その順番を間違えると「幅も分からないターゲットで
// `Unit` だけ 0 が返る」——**分からないことを分かった顔で通す**形になる（原理4）。
// 移植の門を攻めていて見つけた（2026-09-16）: `target_info.sn` の `size_of` から未対応の
// 見張りを落としても、**この問いを誰も立てていなかったので門は緑のまま**だった。
// 同じことが還元の側にもある（`mt_signed` / `mt_class` の見張り）ので、そちらも問う。
check("未対応なら Unit も決まらない（零対象より「未対応」が先）", sizeOf("Unit", "cortex_m"), null);
check("未対応なら還元も null（Unit でも）", reduceToMachineType("Unit", "cortex_m"), null);
check("未対応なら還元は符号もクラスも言わない", reduceToMachineType("Int", "cortex_m"), null);

// ---- option.ms との接続 ----
//
// 幅の根拠はターゲットであり、ターゲットの入口は `option.ms` である。この2つが繋がって
// はじめて「型名 → 何バイト幅・符号あり/なし」の還元が成立する。
const conf = readOptionMs("target : aarch64_qemu\nlayer : 2");
check("option.ms が読んだ target から幅が引ける", sizeOf("Float", conf.target), 8);
check("既定の target（rust）はまだ幅を持たない", sizeOf("Int", readOptionMs("").target), null);


// ---- Char の幅は `charset` が決める（option_ms_schema.md §4.2） ----
//
// **選択肢は固定幅に限る。** `type_system.md` は `List` を「固定幅要素の連続領域」と定め、
// `String ≅ List(0u)` の根拠を「要素幅が同じなら同一のビット表現」と書いている。可変長を
// 選ぶとこの同型が崩れ、`s ' i` を `base + i × sizeof(T)` の1命令で出せなくなる。
//
// UTF-8 が選択肢に無いのはそのためである。`value_representation.md` が UTF-8 を採る理由
// （先頭バイトの自己記述で boxing が無償）が効くのは、同文書 §4 が扱う**外部から届いた
// Byte 列を Char 列へ変換する境界**であって、メモリ上の表現ではない。
check("既定は utf32（全 Unicode・添字は O(1)）", charSizeOf("utf32"), 4);
check("ascii は 1 byte（layer 0 の組み込み向け）", charSizeOf("ascii"), 1);
check("どちらも固定幅なので `String ≅ List(0u)` が保たれる", Object.values(CHARSETS).every((n) => Number.isInteger(n) && n > 0), true);
check("可変長（utf8）は選択肢に無い", Object.prototype.hasOwnProperty.call(CHARSETS, "utf8"), false);
check("既定値は ascii（OS カーネルが初歩の対象なので）", DEFAULT_CHARSET, "ascii");


// ---- 書ける符号位置の上限は、幅とは別の話である ----
//
// **この枚の export のうち `charLimitOf` / `literalParts` / `literalDigits` の3つは、
// ここで一度も問われていなかった。** 型検査・インタプリタ・コード生成の3箇所が同じ数を
// 引くと書いてあるのに、その数を見る所が無い。移植の門（`target_info_sn.test.js`）は
// **実際に問われた問いだけ**を Sign 側へ立てるので、ここで問わないものは Sign 側でも
// 誰も見ない——実測で、`charLimitOf("utf32")` を Sign 側で ascii の上限に書き換えても
// 門は緑のまま通った。問う所を足すと、門はその分だけ広がる。
//
// `ascii` は1バイトだが書けるのは 0x7F までである。0x80〜0xFF は「入るが charset の外」で、
// 文字の算術（`c + 1`）がそこを越えたら `__` になる——**足せることと、足した先が文字で
// あることは別**だからである。
check("ascii の上限は 0x7F（1 byte 入るが、書けるのはここまで）", charLimitOf("ascii"), 0x7f);
check("utf32 の上限は 0x10FFFF（Unicode の全域）", charLimitOf("utf32"), 0x10ffff);
check("知らない charset は既定（ascii）の上限を使う", charLimitOf("nosuch"), 0x7f);

// **「既定」は1か所にある。** `charLimitOf` は以前 `charset === "utf32" ? … : 0x7f` という
// 三項で、知らない charset が ascii の上限に落ちるのは `DEFAULT_CHARSET` に従った結果では
// なく**三項の else に居合わせた結果**だった。幅は `CHARSETS[DEFAULT_CHARSET]` を見るので、
// 既定を変えた日に幅だけが動く。表にして根拠を1本にしたので、鍵が揃っていることを見る
// ——揃っていない charset は「幅は在るが上限が無い」という答えを返す。
check("幅の表と上限の表は同じ charset を並べる", Object.keys(CHARSETS).sort(), Object.keys(CHARSET_LIMITS).sort());
check("既定はどちらの表にも在る", [DEFAULT_CHARSET in CHARSETS, DEFAULT_CHARSET in CHARSET_LIMITS], [true, true]);

// ---- リテラルのプリフィックスは、幅と数字に分かれる（value_representation.md §5） ----
//
// `x` は byte、`u` は bit で書く——それぞれの族の世界共通の呼び名（UTF-8/16/32）に
// 合わせているだけなので、**ここで byte へ揃える**。以降のパスは byte しか見ない。
check("x は byte で書く（1x → 1 byte）", literalParts("1x41").width, 1);
check("2x → 2 byte", literalParts("2x4142").width, 2);
check("4x → 4 byte", literalParts("4x41424344").width, 4);
check("8x → 8 byte", literalParts("8x4142434445464748").width, 8);
check("16x → 16 byte（SIMD の幅）", literalParts("16x00").width, 16);
check("u は bit で書く（8u → 1 byte）", literalParts("8u3042").width, 1);
check("16u → 2 byte", literalParts("16u3042").width, 2);
check("32u → 4 byte", literalParts("32u0041").width, 4);

// **`0` は「幅 0」ではなく「言っていない」である。** 呼ぶ側が `option.ms`（`target` の
// 語幅 / `charset`）から埋める（§5.4）。`NaN` とは別の答えでなければならない
// ——`unicodeWidthError`（pass4.js）が両者を区別して断っているからである。
check("0 は幅 0 ではなく「言っていない」", literalParts("0u000D").width, null);
check("0x も同じ（幅を言っていない）", literalParts("0x7F").width, null);
check("機械にその幅の命令が無いものは NaN（3 byte の読み書きは無い）", Number.isNaN(literalParts("3x40810028").width), true);
check("8 で割り切れない bit 幅も NaN（12u）", Number.isNaN(literalParts("12u0041").width), true);

check("b は2進", literalParts("0b1010").radix, 2);
check("r 族は16進", literalParts("0r18").radix, 16);
check("族はそのまま取り出せる", [literalParts("0u000D").family, literalParts("0x7F").family], ["u", "x"]);

// **族も腕である。** 4つの綴りは文字クラスへ畳まず表に置いてある——畳むと、移植の門は
// 「`r` の枝が一度も問われていない」と言えなくなる（`target_info_sn.test.js` の「見えているか」）。
// 表に在る綴りは全部通り、無い綴りは通らない、の両方を見る。
check("族の表に在る綴りは全部プリフィックスとして通る", [...LITERAL_FAMILIES].map((f) => literalParts("1" + f + "41").family), [...LITERAL_FAMILIES]);
check("族の表に無い綴りは通らない（`1a41`）", literalParts("1a41"), null);
check("機械が持つ幅はこの5本だけ", [...ACCESS_WIDTHS], [1, 2, 4, 8, 16]);

// **プリフィックスは可変長である。** `16x` や `32u` は3文字なので、`.slice(2)` で数字を
// 取ると壊れる。数字が欲しい側は `digits` を使う。
check("プリフィックスが可変長でも数字は正しく取れる（16x）", literalDigits("16x00"), "00");
check("32u も同じ", literalDigits("32u0041"), "0041");
check("プリフィックスが無ければ分けられない", literalParts("48"), null);

// ---- `Raw` は「値は在るが型が無い」 ----
//
// 生の番地から読んだビット列がこれである（`@0x40200000`）——`__` は値が無いのに対し、
// こちらは在る。単体で出すときは GPR 1語として運び、**符号は主張しない**
// （ビットはビットであり、符号ありと読むかどうかは相手が決める）。
check("Raw は GPR 1語・符号を主張しない", reduceToMachineType("Raw", "aarch64_qemu"), { size: 8, signed: false, class: "gpr" });

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
