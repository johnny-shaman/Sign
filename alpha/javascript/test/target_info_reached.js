/**
 * **`target_info.js` が実際に問われた問いの全部。**
 *
 * 手で選んだ一覧ではない。`target_info.js` の関数と表を1つ残らず包んで、
 * **コーパス（`corpus.js`）を1巡させたときに立った問いだけ**を拾ってある。
 * 門が捕まえられる上限はここで決まる——コーパスが一度も問わない問いは、Sign 側を
 * どう書いても門は緑のままである（`corpus.js` の `REACHED_MNEMONICS` と同じ考え方）。
 *
 * `from` はその問いを誰が立てたか:
 *   corpus  コーパスの .sn を compile + generateAsm したときに立った（41 通り）。
 *           1つも畳まない。
 *   suite   コーパスでは立たないが、JS 側のテスト一式が立てた（40 通り）。
 *           **Sign 側が同じ道を通る問いだけ**を畳んだ代表である。
 *
 * **畳んでよいのは道であって、答えではない。** `0x1234` と `0x5678` は字面の中身が違う
 * だけなので畳んでよいが、**表の鍵と `match_case` の腕は畳んではいけない**——答えが同じでも
 * Sign 側では別の行・別の腕を読むからである。実測でそこが穴になっていた（2026-09-16）:
 *
 *   - `widthsOf("aarch64_rpi")` を `widthsOf("aarch64_qemu")` へ畳むと、`.sn` の
 *     `aarch64_rpi` の行を壊しても門は緑のまま通った。`target_info.test.js` はその問いを
 *     実際に立てているのに、である（同じ落ち方が1本のテストだけで 12 通り）。
 *   - `literalParts(…).width` を「数が返る」で畳むと、`is_access` の 1/2/4/8/16 の
 *     5本の腕が1本になる。16（SIMD）の腕は **JS 側でも Sign 側でも**落として緑だった。
 *
 * だから畳み方は、鍵が**表の行かどうか**で決める（行の名前は `target_info.js` の表から取る
 * ——畳み方の側へ写さない）。行に無い鍵（`Struct` / `List(Int)` / `Address | Int` /
 * `rust`）は Sign 側でも「鍵が無いので `__`」の1本道なので、そこは畳んでよい。
 *
 * **畳みすぎを機械が見る。** この規律は散文だけでは守れない（上の2件がそれである）。
 * `target_info_sn.test.js` の「見えているか」が、`target_info.js` の**表の行と腕を1本ずつ
 * ずらして**、この表の問いの答えが動くかを見る。動かない行は名指しで赤になるので、
 * 行を足したのに問う人が居ない日も、畳みすぎた日も、その場で言われる。
 *
 * **それでもコーパスの外は見えない。** コーパスが一度も問わない問いは、Sign 側をどう書いても
 * 門は緑である（`corpus.js` の `REACHED_MNEMONICS` と同じ考え方）。実測では、コーパスの外の
 * 綴り（`Float` / `Raw` / `utf32` / 幅つき字面 / `aarch64_rpi`）を 25 本コンパイルすると
 * 20 通りの新しい問いが立った。そこを覆いたければ、**問う人を増やす**こと——この表は
 * 「誰かが実際に問うたこと」しか載せないので、`target_info.test.js` に検査を足せばここも広がる。
 *
 * **答えはここに書かない。** 答えを持っているのは `target_info.js` なので、検査は実行時に
 * JS へ同じ問いを立てて突き合わせる——二重に書くと片方だけ直る（`qemu.test.js` と同じ規律）。
 *
 * 測り直す（スクラッチで）: `target_info.js` の export を記録する Proxy／ラッパで包み、
 * `node ti_trace.mjs`（コーパス1巡）と `TI_TRACE_DIR=… TI_TRACE_DEDUPE=1 node test/run.js`
 * （一式）を走らせて `node ti_gen_reached.mjs > test/target_info_reached.js`。
 */
export const REACHED = [
	// ---- コーパスが立てた問い（これが移植の仕様である） ----
	{ fn: "widthsOf", args: ["aarch64_qemu"], from: "corpus" },
	{ fn: "sizeOf", args: ["Int", "aarch64_qemu"], from: "corpus" },
	{ fn: "sizeOf", args: ["Address", "aarch64_qemu"], from: "corpus" },
	{ fn: "sizeOf", args: ["Address | Int", "aarch64_qemu"], from: "corpus" },
	{ fn: "reduceToMachineType", args: ["Int", "aarch64_qemu"], from: "corpus" },
	{ fn: "reduceToMachineType", args: ["String", "aarch64_qemu"], from: "corpus" },
	{ fn: "reduceToMachineType", args: ["Struct", "aarch64_qemu"], from: "corpus" },
	{ fn: "reduceToMachineType", args: ["Char", "aarch64_qemu"], from: "corpus" },
	{ fn: "reduceToMachineType", args: ["Address", "aarch64_qemu"], from: "corpus" },
	{ fn: "reduceToMachineType", args: ["List", "aarch64_qemu"], from: "corpus" },
	{ fn: "reduceToMachineType", args: ["Identity", "aarch64_qemu"], from: "corpus" },
	{ fn: "reduceToMachineType", args: ["Address | Int", "aarch64_qemu"], from: "corpus" },
	{ fn: "charSizeOf", args: ["ascii"], from: "corpus" },
	{ fn: "charLimitOf", args: ["ascii"], from: "corpus" },
	{ fn: "literalDigits", args: ["0u000D"], from: "corpus" },
	{ fn: "literalDigits", args: ["0u000A"], from: "corpus" },
	{ fn: "literalParts", args: ["1"], from: "corpus" },
	{ fn: "literalParts", args: ["0"], from: "corpus" },
	{ fn: "literalParts", args: ["8"], from: "corpus" },
	{ fn: "literalParts", args: ["2"], from: "corpus" },
	{ fn: "literalParts", args: ["10"], from: "corpus" },
	{ fn: "literalParts", args: ["16"], from: "corpus" },
	{ fn: "literalParts", args: ["4"], from: "corpus" },
	{ fn: "literalParts", args: ["0u000D"], from: "corpus" },
	{ fn: "literalParts", args: ["0x7F"], from: "corpus" },
	{ fn: "literalParts", args: ["0u000A"], from: "corpus" },
	{ fn: "literalParts", args: ["22"], from: "corpus" },
	{ fn: "literalParts", args: ["-1"], from: "corpus" },
	{ fn: "literalParts", args: ["9"], from: "corpus" },
	{ fn: "literalParts", args: ["0x9000000"], from: "corpus" },
	{ fn: "literalParts", args: ["48"], from: "corpus" },
	{ fn: "literalParts", args: ["11"], from: "corpus" },
	{ fn: "literalParts", args: ["32"], from: "corpus" },
	{ fn: "literalParts", args: ["42"], from: "corpus" },
	{ fn: "literalParts", args: ["12"], from: "corpus" },
	{ fn: "literalParts", args: ["120"], from: "corpus" },
	{ fn: "literalParts", args: ["35"], from: "corpus" },
	{ fn: "SIGNEDNESS[]", args: ["Char"], from: "corpus" },
	{ fn: "SIGNEDNESS[]", args: ["Int"], from: "corpus" },
	{ fn: "SIGNEDNESS[]", args: ["Struct"], from: "corpus" },
	{ fn: "SIGNEDNESS[]", args: ["Address"], from: "corpus" },

	// ---- コーパスは立てないが一式が立てる問い（答えの形ごとに代表1つ） ----
	{ fn: "widthsOf", args: ["cortex_m"], from: "suite" },
	{ fn: "widthsOf", args: ["aarch64_firmware"], from: "suite" },
	{ fn: "widthsOf", args: ["aarch64_rpi"], from: "suite" },
	{ fn: "isSupported", args: ["aarch64_qemu"], from: "suite" },
	{ fn: "isSupported", args: ["cortex_m"], from: "suite" },
	{ fn: "sizeOf", args: ["Float", "aarch64_qemu"], from: "suite" },
	{ fn: "sizeOf", args: ["Raw", "aarch64_qemu"], from: "suite" },
	{ fn: "sizeOf", args: ["Int", "cortex_m"], from: "suite" },
	{ fn: "sizeOf", args: ["Unit", "aarch64_qemu"], from: "suite" },
	// **腕の順番も畳めない。** `Unit` × 未対応ターゲットは、`size_of` の中で「未対応なら `__`」と
	// 「`fixed_size` に在れば その値」のどちらが先かを分ける唯一の問いである。`Int` × 未対応に
	// 畳むと、見張りを落としても門が緑になる（実測）。還元の側も同じで、`mt_signed` /
	// `mt_class` の見張りは `Int` × 未対応でしか分かれない。
	{ fn: "sizeOf", args: ["Unit", "cortex_m"], from: "suite" },
	{ fn: "reduceToMachineType", args: ["Unit", "cortex_m"], from: "suite" },
	{ fn: "reduceToMachineType", args: ["Int", "cortex_m"], from: "suite" },
	{ fn: "sizeOf", args: ["Address", "aarch64_rpi"], from: "suite" },
	{ fn: "sizeOf", args: ["Int", "aarch64_rpi"], from: "suite" },
	{ fn: "reduceToMachineType", args: ["Raw", "aarch64_qemu"], from: "suite" },
	{ fn: "reduceToMachineType", args: ["Float", "aarch64_qemu"], from: "suite" },
	{ fn: "reduceToMachineType", args: ["Unit", "aarch64_qemu"], from: "suite" },
	{ fn: "reduceToMachineType", args: ["Vector", "aarch64_qemu"], from: "suite" },
	{ fn: "reduceToMachineType", args: ["Address", "aarch64_rpi"], from: "suite" },
	{ fn: "reduceToMachineType", args: ["Int", "aarch64_rpi"], from: "suite" },
	{ fn: "charSizeOf", args: ["utf32"], from: "suite" },
	{ fn: "charSizeOf", args: ["utf16"], from: "suite" },
	{ fn: "charLimitOf", args: ["nosuch"], from: "suite" },
	{ fn: "charLimitOf", args: ["utf32"], from: "suite" },
	{ fn: "literalDigits", args: ["16u3042"], from: "suite" },
	{ fn: "literalParts", args: ["1x9000000"], from: "suite" },
	{ fn: "literalParts", args: ["2x9000000"], from: "suite" },
	{ fn: "literalParts", args: ["4x9000000"], from: "suite" },
	{ fn: "literalParts", args: ["8x9000000"], from: "suite" },
	{ fn: "literalParts", args: ["0b1010"], from: "suite" },
	{ fn: "literalParts", args: ["0r18"], from: "suite" },
	{ fn: "literalParts", args: ["03x40810028"], from: "suite" },
	{ fn: "literalParts", args: ["12u0041"], from: "suite" },
	{ fn: "literalParts", args: ["8u3042"], from: "suite" },
	{ fn: "literalParts", args: ["16u3042"], from: "suite" },
	{ fn: "literalParts", args: ["16x00"], from: "suite" },
	// 数字の後ろが**族ではない綴り**。`48` の「族の字が無い」とは別の道である
	// （Sign 側は `fam_ok` の腕がどれも当たらない方を通る）。
	{ fn: "literalParts", args: ["1a41"], from: "suite" },
	{ fn: "literalParts", args: ["32u0041"], from: "suite" },
	{ fn: "CHARSETS[]", args: ["ascii"], from: "suite" },
	{ fn: "CHARSETS[]", args: ["utf32"], from: "suite" },
];
