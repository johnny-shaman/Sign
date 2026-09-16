/**
 * ターゲットごとの幅クラスと、Layer 2 型から「何バイト幅・符号あり/なし」への還元。
 *
 * `compiler_pipeline.md` §3 は、Pass 1〜3（帳簿係）が Pass 4 へ渡すのは
 * 「このビット列を**何バイト幅・符号あり/なし**として扱うか」に還元した情報だと定める。
 * Pass 3 が出すのは型の**名前**（`Int` / `Address` / `Float` / `Struct{…}`）なので、
 * その名前を幅へ落とすのがここである。型システムと Pass 4 の継ぎ目にあたる。
 *
 * ## 幅は方針ではなく事実である
 *
 * `type_system.md` §2 は `Address` を「GPR 幅」、`Float` を「ターゲットの FPU が持つ最高
 * 精度」と定める。どちらの語もレジスタファイルを名指ししており、幅はハードウェアが既に
 * 決めている——原理1 の言う通り、Sign は型を押し付けているのではなく**ハードウェアが
 * 既に持っている型を書き写している**。だからこの表は設計判断の置き場ではなく、ISA の
 * 転記である。
 *
 * ## `Int` の幅は GPR 幅である（C の `int` を引き継がない）
 *
 * C は 64bit 環境でも `int` を 32bit に留めたが、それは歴史的な互換の都合であって
 * ハードウェアの事実ではない。AArch64 の整数レジスタは X（64bit）であり、W（32bit）は
 * その部分ビューである。原理1 に従えば書き写すべきは X の方なので、`Int` は GPR 幅を採る。
 *
 * その結果、AArch64 では `Int` と `Address` が**同じ幅**になる。これは両者を統合する理由に
 * ならない——§3.6 が言う通り、分けた根拠はビット幅ではなく**溢れ方**（`Address` は `__` へ
 * 収束、`Int` はラップアラウンド）だからである。同じ幅の別の型であって構わない。
 *
 * ## AArch64 以外は未対応（意図的）
 *
 * Sign の初期構想は AArch64 を対象とする。他のターゲットは ISA としての幅こそ自明でも、
 * FPU の有無（Cortex-M は品種による）や `Int` を GPR 幅に揃えるかどうかが実機に触れて
 * みないと決められない。**憶測で表を埋めると、間違った幅で通ってしまう方が危ない**ので、
 * 未対応のターゲットは `null` を返して「まだ決まっていない」と言う（原理4 の線引きと同じ
 * 考え方——分からないことを分かった顔で通さない）。
 */

/**
 * 幅クラス（byte 数）。`endian` は Pass 4 が多バイト値を並べるのに要る。
 *
 * AArch64:
 *   gpr    8  X レジスタ（64bit）。`Address` と `Int` がここに乗る
 *   float  8  倍精度（D レジスタ）。AArch64 の FPU は倍精度を持つので「最高精度」は 8
 *   vector 16 NEON の Q レジスタ（128bit）
 *   endian little  AArch64 は原則リトルエンディアン（EE ビットで切替可能だが既定は LE）
 */
const TARGET_WIDTHS = {
  aarch64_rpi: { gpr: 8, float: 8, vector: 16, endian: "little" },
  aarch64_qemu: { gpr: 8, float: 8, vector: 16, endian: "little" },
  aarch64_firmware: { gpr: 8, float: 8, vector: 16, endian: "little" },
};

// 型ごとの符号の扱い（compiler_pipeline.md §3 の「符号あり/なし」）。
//
//   Address  符号なし。§2 の値域が「0以上」と定めている。アドレスに負は無い
//   Int      符号あり。十進は符号を書ける唯一の記法であり（§3.6）、`-1` はここに来る。
//            uint を含むのは値域の話であって、幅と符号の帳簿としては signed を採る
//   Float    符号あり（IEEE 754）
const SIGNEDNESS = { Address: "unsigned", Int: "signed", Char: "unsigned", Float: "signed", Vector: "signed", Raw: "unsigned" };

/**
 * `__`（Unit）の niche。GPR 幅の型で「値の不在」を表すビットパターン
 * （value_representation.md §3.5）。
 *
 * **`0` を使ってはいけない。** Sign では `__` だけが偽であり `0` は真である
 * ——`0 = 0` は真で、そのとき返せるオペランドは `0` しかない（comparison.md §2.1）。
 * `0` を不在の印にすると、この真が偽と区別できなくなる。
 *
 * 根拠はハードウェアの側にある。`Int` では `INT_MIN`（2の補数で唯一、正の対応物を
 * 持たない値）であり、`Address` では AArch64 の非正準領域（上位16ビットが全0でも
 * 全1でもない）——そもそも有効なアドレスになりえない。
 *
 * `Float` はこの値を使えない（負のゼロという正当な値である）。浮動小数の niche は未定。
 */
const UNIT_NICHE_ASM = "0x8000000000000000";

// 幅クラスへの割り当て。`String` は `List(0u)` と同型なので要素は Char。
// `Char` は符号位置という整数なので、レジスタ上は GPR である。**記憶上の幅だけが
// charset で決まる**（1 or 4 byte、`charSizeOf`）——比較や添字の計算はレジスタで行う。
// `Identity`（`!__`）は Layer 1 の恒等射だが、**値として運ばれる**ときは GPR 1本である。
// 機械の上で恒等射に対してやることは「`__` かどうか見る」しかなく、Sign では `0` が真な
// ので、置くのは `0` でよい。呼ぶのではなく運ぶだけなので、単相化とは衝突しない
// （`conflict : … : !__` が真を返して呼び出し側が条件に使う、という形がこれである）。
const WIDTH_CLASS = { Address: "gpr", Int: "gpr", Char: "gpr", Float: "float", Vector: "vector", Identity: "gpr", Raw: "gpr" };

/**
 * Char（`0u`）1個の幅。`option.ms` の `charset` で選ぶ。
 *
 * **どちらも固定幅である。** `type_system.md` は `List` を「固定幅要素の連続領域」と定め、
 * `String ≅ List(0u)` の根拠を「要素幅が同じなら同一のビット表現」と書いている。可変長の
 * 表現を選ぶとこの同型が崩れ、`s ' i` を `base + i × sizeof(T)` の1命令で出せなくなる。
 * だから選択肢は固定幅に限る。
 *
 *   ascii  1 byte  既定。layer 0 の組み込み向け。UART 出力やブートログに Unicode は要らない
 *   utf32  4 byte  全 Unicode を表現でき、添字は O(1) のまま
 *
 * UTF-8 はここに無い。`value_representation.md` が UTF-8 を採る理由——先頭バイトの
 * ビットパターンが「何バイト列か」を自己記述するので boxing が無償になる——は、
 * 同文書 §4 のタイトルが言う通り**外部から届いた Byte 列を Char 列へ変換する境界**の
 * 話である。転送・保存の形式であって、メモリ上の String 表現である必然は無い。
 */
const CHARSETS = { ascii: 1, utf32: 4 };
// **既定は `ascii`。** Sign が最初に書くのは OS カーネルであり、そこは `layer: 0` の
// 世界である——UART 出力やブートログに Unicode は要らない（option_ms_schema.md §4.2）。
// 1文字1バイトなら `.rodata` もそのままバイト列になる。
//
// 全 Unicode が要る場面では `option.ms` で `charset : `utf32`` と書く。IO 境界は
// charset に関わらず常に UTF-8 なので（value_representation.md §4）、この選択が
// 決めるのは**メモリ上の Char 1個の幅**だけである。
const DEFAULT_CHARSET = "ascii";

function charSizeOf(charset) {
  return CHARSETS[charset] ?? CHARSETS[DEFAULT_CHARSET];
}

/**
 * **その charset で書ける符号位置の上限。**
 *
 * 幅（バイト数）とは別の話である。`ascii` は1バイトだが書けるのは 0x7F までで、
 * 0x80〜0xFF は「入るが charset の外」である。
 *
 * 文字の算術（`c + 1`、`c1 + c2`）はここを越えたら `__` になる——**足せることと、
 * 足した先が文字であることは別**だからである。型検査・インタプリタ・コード生成の
 * 3箇所が同じ数を引く必要がある。別々に書くと片方だけが正しい答えを出す。
 *
 * **表で持つ。** 以前は `charset === "utf32" ? 0x10ffff : 0x7f` と三項で書いており、
 * 知らない charset が `ascii` の上限に落ちるのは `DEFAULT_CHARSET` に従った結果ではなく
 * **三項の else に居合わせた結果**だった。`charSizeOf` は `CHARSETS[DEFAULT_CHARSET]` を
 * 見るので、既定を `utf32` へ変えた日に幅は 4 になり上限は 0x7F のまま——**同じ「既定」が
 * 2か所にあって片方だけ動く**という、この工程が何度も踏んでいる形である。今の値では
 * どちらの書き方も同じ答えを出すので、これは**振る舞いの変更ではなく写しの削除**である。
 */
const CHARSET_LIMITS = { ascii: 0x7f, utf32: 0x10ffff };

function charLimitOf(charset) {
  return CHARSET_LIMITS[charset] ?? CHARSET_LIMITS[DEFAULT_CHARSET];
}

/**
 * ターゲットの幅クラスを返す。未対応なら null。
 */
function widthsOf(target) {
  return TARGET_WIDTHS[target] || null;
}

function isSupported(target) {
  return Object.prototype.hasOwnProperty.call(TARGET_WIDTHS, target);
}

/**
 * Layer 2 型 1 つ分のサイズ（byte）を返す。
 *
 * 決まらないものは null を返す。`List`/`Struct` は要素や並びが分からないと決まらないので、
 * それらは形（shape）を持つノードから計算する Pass 3.5 の仕事であり、ここでは扱わない
 * ——スカラーの幅がこの関数の責務である。
 *
 * @param type Layer 2 型名（`Int` / `Address` / `Float` / `Vector` / `String` / `Unit`）
 * @param target ターゲット名
 */
function sizeOf(type, target) {
  const w = widthsOf(target);
  if (!w) return null;
  // `Unit` は零対象。値を持たないので 0 byte——場所を占めない（unit.md）。
  if (type === "Unit") return 0;
  // `String` は `List(0u)` と同型だが、**長さ**が型に入っていないので単体では決まらない。
  // 要素1個の幅は charset が決めるので `charSizeOf` を使う——全体の大きさを出すのは
  // 並びを持つノードから計算する側（形の解決）の仕事である。
  if (type === "String") return null;
  const cls = WIDTH_CLASS[type];
  return cls ? w[cls] : null;
}

/**
 * 型を Pass 4 が要る形（幅と符号）へ還元する。決まらなければ null。
 */
// **`Raw` は「値は在るが型が無い」**。生の番地から読んだビット列がこれである
// （`@0x40200000`）——`__` は値が無いのに対し、こちらは在る。格子の底の1段上に居て、
// **どの具体型にも負ける**（`arithmeticResultType`）。
//
// 単体で出すときは GPR 1語として運ぶ。**符号は主張しない**——ビットはビットであり、
// 符号ありと読むかどうかは相手が決める。
function reduceToMachineType(type, target) {
  const size = sizeOf(type, target);
  if (size === null) return null;
  return { size, signed: SIGNEDNESS[type] === "signed", class: WIDTH_CLASS[type] || null };
}

/**
 * **リテラルのプリフィックスを、幅と数字に分ける。**
 *
 * `NxHHHH` / `NuHHHH` の先頭の数がその幅である（value_representation.md §5）。
 * `x` は byte、`u` は bit で書く——それぞれの族の世界共通の呼び名（UTF-8/16/32）に
 * 合わせているだけなので、**ここで byte へ揃える**。以降のパスは byte しか見ない。
 *
 * `0` は「幅 0」ではなく「**言っていない**」である。`width` に `null` を返し、呼ぶ側が
 * `option.ms`（`target` の語幅 / `charset`）から埋める（§5.4）。
 *
 * 機械にその幅の命令が無いもの（`3x`、`12u` のような割り切れない指定）は `width` が
 * `NaN` になる。そこは診断で弾く——**分からないことを分かったことにしない**（原理4）。
 *
 * **プリフィックスは可変長である。** `16x` や `32u` は3文字なので、`.slice(2)` で数字を
 * 取ると壊れる。数字を欲しい側は `digits` を使う。
 */
// **腕を1本ずつ名指しできるように export する。** 移植の門は「表の行と `match_case` の腕が
// 1本ずつ問われているか」を見る（`target_info_sn.test.js` の「見えているか」）。数を検査の
// 側へ写すと2つ目の綴りができるので、名前を渡して数えるのはこちらの表からにする。
const ACCESS_WIDTHS = new Set([1, 2, 4, 8, 16]);

// 族の綴り。**表にする理由は腕と同じ**——`[xurb]` と正規表現へ畳み込むと、門は
// 「`r` の枝が一度も問われていない」と言えない。文字クラスを `[a-z]` へ広げて所属で
// 断るので、通る字面は1つも変わらない（`1a41` は前も後も `null`）。
const LITERAL_FAMILIES = new Set(["x", "u", "r", "b"]);
const PREFIX_RE = /^([0-9]+)([a-z])(.*)$/;

function literalParts(text) {
  const m = PREFIX_RE.exec(String(text ?? ""));
  if (!m || !LITERAL_FAMILIES.has(m[2])) return null;
  const n = Number(m[1]);
  const family = m[2];
  const bytes = family === "u" ? n / 8 : n;
  return {
    family,
    digits: m[3],
    radix: family === "b" ? 2 : 16,
    // 機械が持っている幅だけが幅である（1/2/4/8 と、SIMD の 16）。3 byte の読み書きは
    // 命令が無いので NaN——呼ぶ側が名指しで断る。
    width: n === 0 ? null : ACCESS_WIDTHS.has(bytes) ? bytes : NaN,
  };
}

/** リテラルの数字部分（プリフィックスの後ろ）。可変長プリフィックスに耐える。 */
function literalDigits(text) {
  const p = literalParts(text);
  return p ? p.digits : String(text ?? "").slice(2);
}
export { TARGET_WIDTHS, SIGNEDNESS, UNIT_NICHE_ASM, WIDTH_CLASS, CHARSETS, CHARSET_LIMITS, DEFAULT_CHARSET, ACCESS_WIDTHS, LITERAL_FAMILIES, charSizeOf, charLimitOf, widthsOf, isSupported, sizeOf, reduceToMachineType, literalParts, literalDigits };
