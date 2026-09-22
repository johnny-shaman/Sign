/**
 * **`layout.js` が実際に問われた問いのうち、名前だけで答えが決まるものの全部。**
 *
 * 手で選んだ一覧ではない。`layout.js` の関数を1つ残らず包んで、**コーパスを1巡させたときと
 * JS 側のテスト一式を走らせたときに立った問いだけ**を拾ってある（`test/tools/` の2本で作る。
 * 作り方は末尾）。門が捕まえられる上限はここで決まる——誰も立てない問いは、Sign 側をどう
 * 書いても門は緑のままである（`target_info_reached.js` と同じ考え方）。
 *
 * `from` はその問いを誰が立てたか:
 *   corpus  コーパス（`corpus.js` の 9 枚）を compile し、`ASM_OPT` と最適化を切った側の
 *           2通りで generateAsm したときに立った（293 行）。**1つも畳まない**——同じ問いが
 *           2度立ったものを1つにするだけである。
 *   suite   コーパスでは立たないが、JS 側のテスト一式が立てた（85 行）。**Sign 側が同じ道を
 *           通る問いだけ**を畳んだ代表で、道ごとに最小のもの1つを置く。
 *   added   誰も立てないが、表の行を見えるようにするために足した（4 行）。`why` に理由がある。
 *           答えが名前だけで決まる所に限る（番地の表の行と、`alignUp` の切り上げる腕と、剥いだ後も包みに
 *           見える名前の `nameLt`）。「見える」は
 *           門と同じ測り方で、行を表から抜いてどれかの問いの答えが動くこと——引いただけでは足りない
 *           （`mul Unit Int` は `WEAK_LEFT_TYPES` の `Unit` を引くが、抜いても答えは `false` のまま）。
 *           コーパスか一式の問いで見えるようになれば、生成器は足さない。
 *
 * 関数ごと（382 行）: passingOf 29 / slotCellSize 17 / measure 19 / measureRule 7 / alignUp 40 / packSlots 30 / nameLt 97 / bareName 92 / addressWithoutArrow 51。
 *
 * ## 名前だけで答えが決まる、とは
 *
 * `passingOf` / `slotCellSize` / `measure` は節点を受けるが、行に載せるのは**型の名前と
 * ターゲットと charset だけで同じ答えが出た**問いに限る。確かめ方は3つで、全部を要る:
 *
 *   1. 同じ関数へ `{ atomType: 型 }` だけの節点で問い直して、答えが JSON で一致する。
 *   2. 呼び出しの間に構文木を歩いていない。歩く関数（`listItems` / `stringLength` /
 *      `layoutOfStruct` / `cursorParts`、要素型を読む `measureRule` / `measureImplicit`、
 *      型が節点に無く束縛を辿って分かった `deref`、前置 `~` の中身）に入ったら、
 *      **いちばん内側の問い**に印が付く。答えをそのまま返した問いは、内側の印を引き継ぐ。
 *   3. 1 の問い直しの側も歩いていない。`measure({ atomType: "List" })` は `measureList` に入り、
 *      数える中身が無いので `null` を返す——JS はその問いに名前では答えていない。実測で、
 *      入れ子の見張り（`MAX_NEST` を越えた深さ）で辿る前に `null` を返した `measure` が、
 *      1 と 2 だけではすり抜けて `measure List` の行になっていた。
 *
 * 1 だけでは足りない。`measure` は `[…]` の中身を数えて `null` を返すことがあり、名前だけの
 * 節点も（数える中身が無いので）`null` を返す——答えは同じだが、前者は中身で決まっている。
 * 逆に `passingOf` が中で `measure` を呼んで器の中身を数えても、印は内側の `measure` に付く。
 * `passingOf` が使うのはその答えの `repr` だけで、`List` なら何が入っていても `{ptr, len}` である。
 *
 * `measureRule` は型と要素型とターゲットしか読まないので、要素型（`el`）も行に載せる。
 * 名前だけで答えられない呼び出しは `OUTSIDE` に数だけ置く（理由は `TRACE_INFO.outside.why`）。
 *
 * ## 畳んでよいのは道であって、答えではない
 *
 * `target_info_reached.js` の規律をそのまま使う。**表の鍵と腕は畳まない**——答えが同じでも
 * Sign 側では別の行・別の腕を読むからである。行の名前は JS から取る: 型は `REF_SLOTS` /
 * `REG_SLOTS` / `UNIT_TYPES` / `RULE_SLOTS` と `target_info.js` の `SIGNEDNESS` / `WIDTH_CLASS`、
 * それに `layout.js` / `target_info.js` のソースにある `type === "…"` の腕。ターゲットは
 * `TARGET_WIDTHS`、charset は `CHARSETS`。行に無い鍵（`Scalar` / `cortex_m` …）は Sign 側でも
 * 「鍵が無い」の1本道なので畳む。直和は枝ごとに行を見て、**並びは畳まない**（広さが同じ枝は
 * 先の枝が勝つので、並びが答えを決める）。
 *
 *   passingOf / slotCellSize / measure  関数 × 型の行 × ターゲットの行 × charset の行
 *   measureRule          同じく、要素型の行も
 *   alignUp              腕（零 / 割り切れる / 切り上げる / 境界なし）× 境界の値
 *   packSlots            種 × 本数（0 / 1 / 複数）× 詰め物 × 末尾の切り上げ × 境界の上がり方
 *                        × ターゲット × charset。`cells` は詰めた順の [幅, 境界] で、オフセットと
 *                        全体の大きさ・境界は門が JS から出し直す
 *   nameLt               `packNamed` の並べ替えを、並べた後の隣り合う対へ開いたもの（a が先）。
 *                        どこで決まるか（文字 / 片方が先に尽きる / 等しい）× 両方の包み方
 *   bareName             包み方（`<…>` / `\`…\`` / 素 / 短い / 非文字列）
 *   addressWithoutArrow  **実際に読んだ表の行の並び**（素の layout.js に問い直して数える）。
 *                        読まなかった引数は畳み、引いて外れた行は `-` と書く
 *
 * ## 載せない表
 *
 * `REF_FIELD_NAMES` / `REF_FIELD_TYPES` / `RULE_FIELD_NAMES` は答えの `fields` にしか効かず、
 * pass4 は `fields` を読まない。門はそこを外と宣言するので、ここにも問いを足さない。
 * 表の行をずらしてもここの問いの答えが動かない所は `TRACE_INFO.unseen` に名指しする
 * （素の layout.js へ問い直して数えた。門の「見えているか」と同じ測り方）。
 *
 * ## 答えはここに書かない
 *
 * 答えを持っているのは `layout.js` なので、門は実行時に JS へ同じ問いを立てて突き合わせる
 * ——二重に書くと片方だけ直る。**`null` は「無かった」**（conf に `charset` が無い、など）。
 * ここで確かめた問い直しは `undefined` で渡しているが、`target` / `charset` は `null` で渡しても
 * 同じ答えになる（`widthsOf` も `charSizeOf` も既定へ落ちる）。`measureRule` の `el` だけは
 * `undefined` で渡す——`null` だと答えの `fields` に `type: null` が載って JSON が変わる。
 *
 * ## 測り直す
 *
 * `layout.js` を変えたら、一式の記録から採り直す。記録には layout.js の指紋（`export {` より前の
 * sha256）が入っていて、生成器は今の layout.js と違う記録を読まない——export を1つ足しただけ
 * なら指紋は動かない。`alpha/javascript` で:
 *
 *   LAYOUT_TRACE=1 LAYOUT_TRACE_DIR=<dir> node --import ./test/tools/layout_trace_hooks.mjs test/run.js
 *   node test/tools/gen_layout_reached.mjs <dir>
 *
 * 1行目は一式を1巡させる（`qemu.test.js` が重いので1時間ほど）。フックは `LAYOUT_TRACE` が
 * 無ければ何もしない。2行目はコーパス1巡を自分で走らせ（数秒）、`<dir>` の記録と合わせて
 * このファイルを書き直す。コーパス1巡は `.s` が `corpus.js` の golden（命令数と指紋）と
 * 合うことを確かめてから記録を使う——記録の側が答えを動かしていたら、拾った問いは門が見ている
 * `.s` の問いではなくなるからである。
 *
 * **門（`layout_sn.test.js`）の記録は読まない。** 門はこの表から問いを立てるので、その記録を
 * 次の表へ入れると `added` の問いが「一式が立てた」に化けて、誰も立てない行が見えなくなる。
 *
 * 今回: 2026-09-22、layout.js dbcab59586b8。コーパス 9 枚で 378249 回、
 * 一式 34 枚で 390343563 回の呼び出しを見た（一式の asm_gate もコーパスを回すので重なる。
 * 門の記録 0 枚は読んでいない）。
 */
export const REACHED = [
	// ---- コーパスが立てた問い（これが移植の仕様である） ----
	{ fn: "passingOf", type: "Address | Int", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "passingOf|(直和:Address|Int)|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "Address", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "passingOf|Address|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "Char", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "passingOf|Char|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "Identity", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "passingOf|Identity|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "Int", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "passingOf|Int|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "List", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "passingOf|List|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "String", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "passingOf|String|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "Struct", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "passingOf|Struct|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "Unit", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "passingOf|Unit|aarch64_qemu|ascii" },
	{ fn: "slotCellSize", type: "Address", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "slotCellSize|Address|aarch64_qemu|ascii" },
	{ fn: "slotCellSize", type: "Int", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "slotCellSize|Int|aarch64_qemu|ascii" },
	{ fn: "slotCellSize", type: "String", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "slotCellSize|String|aarch64_qemu|ascii" },
	{ fn: "slotCellSize", type: "Struct", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "slotCellSize|Struct|aarch64_qemu|ascii" },
	{ fn: "measure", type: "Address | Int", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "measure|(直和:Address|Int)|aarch64_qemu|ascii" },
	{ fn: "measure", type: "Address", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "measure|Address|aarch64_qemu|ascii" },
	{ fn: "measure", type: "Char", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "measure|Char|aarch64_qemu|ascii" },
	{ fn: "measure", type: "Int", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "measure|Int|aarch64_qemu|ascii" },
	{ fn: "measure", type: "Unit", target: "aarch64_qemu", charset: "ascii", from: "corpus", key: "measure|Unit|aarch64_qemu|ascii" },
	{ fn: "alignUp", args: [1,1], from: "corpus", key: "alignUp|割り切れる|a=1" },
	{ fn: "alignUp", args: [104,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [112,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [120,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [128,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [136,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [144,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [152,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [16,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [160,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [168,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [176,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [184,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [192,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [200,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [208,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [216,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [224,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [232,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [24,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [240,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [248,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [256,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [264,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [272,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [280,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [32,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [40,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [48,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [56,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [64,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [72,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [8,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [80,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [88,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [96,8], from: "corpus", key: "alignUp|割り切れる|a=8" },
	{ fn: "alignUp", args: [0,1], from: "corpus", key: "alignUp|零|a=1" },
	{ fn: "alignUp", args: [0,8], from: "corpus", key: "alignUp|零|a=8" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[16,8]], from: "corpus", key: "packSlots|named|1本|詰め物なし|末尾そのまま|境界:上げる|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[8,8]], from: "corpus", key: "packSlots|named|1本|詰め物なし|末尾そのまま|境界:上げる|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[16,8],[16,8],[16,8],[16,8],[16,8],[16,8],[16,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[16,8],[16,8],[16,8],[16,8],[16,8],[16,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[16,8],[16,8],[16,8],[16,8],[16,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[16,8],[16,8],[16,8],[16,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[16,8],[16,8],[16,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[16,8],[8,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[8,8],[16,8],[8,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[8,8],[8,8],[8,8],[8,8],[8,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[8,8],[8,8],[8,8],[8,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[8,8],[8,8],[8,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[8,8],[8,8]], from: "corpus", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "nameLt", args: [" ","&"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["!","@"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["!","~"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["#","%"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["$","-"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["%","&"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["&","'"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["'","*"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["'",","], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["*","+"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["+",","], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["+","-"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: [",","-"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: [",","/"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: [",","|"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["-","/"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["-","@"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["/",":"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["/","<"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: [":",";"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["?","@"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["?","^"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["@","\\"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["@","^"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["@","~"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["\\","~"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["^","|"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: ["|","~"], from: "corpus", key: "nameLt|文字で決まる|短い短い" },
	{ fn: "nameLt", args: [" ","!="], from: "corpus", key: "nameLt|文字で決まる|短い素" },
	{ fn: "nameLt", args: ["^","~*"], from: "corpus", key: "nameLt|文字で決まる|短い素" },
	{ fn: "nameLt", args: ["!!","#"], from: "corpus", key: "nameLt|文字で決まる|素短い" },
	{ fn: "nameLt", args: ["!==","#"], from: "corpus", key: "nameLt|文字で決まる|素短い" },
	{ fn: "nameLt", args: ["!==","%"], from: "corpus", key: "nameLt|文字で決まる|素短い" },
	{ fn: "nameLt", args: ["!==","*"], from: "corpus", key: "nameLt|文字で決まる|素短い" },
	{ fn: "nameLt", args: ["###","$"], from: "corpus", key: "nameLt|文字で決まる|素短い" },
	{ fn: "nameLt", args: ["&&","'"], from: "corpus", key: "nameLt|文字で決まる|素短い" },
	{ fn: "nameLt", args: [";;","<"], from: "corpus", key: "nameLt|文字で決まる|素短い" },
	{ fn: "nameLt", args: ["<=","="], from: "corpus", key: "nameLt|文字で決まる|素短い" },
	{ fn: "nameLt", args: ["==",">"], from: "corpus", key: "nameLt|文字で決まる|素短い" },
	{ fn: "nameLt", args: ["===",">"], from: "corpus", key: "nameLt|文字で決まる|素短い" },
	{ fn: "nameLt", args: [">>","?"], from: "corpus", key: "nameLt|文字で決まる|素短い" },
	{ fn: "nameLt", args: ["||","~"], from: "corpus", key: "nameLt|文字で決まる|素短い" },
	{ fn: "nameLt", args: ["(...)","[...]"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["<<","<="], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: [">=",">>"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["Address","Char"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["Char","Float"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["Char","Int"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["Container","List"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["Float","Identity"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["Float","Int"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["Identity","Int"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["Int","Raw"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["List","String"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["Raw","Unit"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["Raw","Vector"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["String","Struct"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["[...]","{...}"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["aarch64_firmware","aarch64_qemu"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["aarch64_qemu","aarch64_rpi"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["ascii","utf32"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["assoc","name"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["bit_shift_left","mul"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["float","gpr"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["form","gpr_frame"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["form","gpr_signed"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["form","gpr_w1"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["gpr","vector"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["gpr_frame","gpr_static_off"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["gpr_signed","gpr_unsigned"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["gpr_static_off","gpr_static_page"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["gpr_w1","gpr_w2"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["gpr_w2","gpr_w4"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["gpr_w4","gpr_w8"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["mul","pow"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["name","tier"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["{...}","|...|"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["|...|","||...||"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["~*","~+"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["~+","~-"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["~-","~/"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["~/","~^"], from: "corpus", key: "nameLt|文字で決まる|素素" },
	{ fn: "nameLt", args: ["!","!!"], from: "corpus", key: "nameLt|片方が先に尽きる|短い素" },
	{ fn: "nameLt", args: ["#","##"], from: "corpus", key: "nameLt|片方が先に尽きる|短い素" },
	{ fn: "nameLt", args: ["&","&&"], from: "corpus", key: "nameLt|片方が先に尽きる|短い素" },
	{ fn: "nameLt", args: [";",";;"], from: "corpus", key: "nameLt|片方が先に尽きる|短い素" },
	{ fn: "nameLt", args: ["<","<<"], from: "corpus", key: "nameLt|片方が先に尽きる|短い素" },
	{ fn: "nameLt", args: ["<","<="], from: "corpus", key: "nameLt|片方が先に尽きる|短い素" },
	{ fn: "nameLt", args: ["=","=="], from: "corpus", key: "nameLt|片方が先に尽きる|短い素" },
	{ fn: "nameLt", args: [">",">="], from: "corpus", key: "nameLt|片方が先に尽きる|短い素" },
	{ fn: "nameLt", args: ["|","||"], from: "corpus", key: "nameLt|片方が先に尽きる|短い素" },
	{ fn: "nameLt", args: ["~","~*"], from: "corpus", key: "nameLt|片方が先に尽きる|短い素" },
	{ fn: "nameLt", args: ["~","~+"], from: "corpus", key: "nameLt|片方が先に尽きる|短い素" },
	{ fn: "nameLt", args: ["!=","!=="], from: "corpus", key: "nameLt|片方が先に尽きる|素素" },
	{ fn: "nameLt", args: ["##","###"], from: "corpus", key: "nameLt|片方が先に尽きる|素素" },
	{ fn: "nameLt", args: ["==","==="], from: "corpus", key: "nameLt|片方が先に尽きる|素素" },
	{ fn: "bareName", args: ["<assoc>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<float>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<form>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<gpr>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<gpr_frame>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<gpr_signed>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<gpr_static_off>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<gpr_static_page>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<gpr_unsigned>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<gpr_w1>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<gpr_w2>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<gpr_w4>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<gpr_w8>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<i>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<k>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<name>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<o>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<tier>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["<vector>"], from: "corpus", key: "bareName|<>" },
	{ fn: "bareName", args: ["` `"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`!!`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`!==`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`!=`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`!`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`###`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`##`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`#`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`$`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`%`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`&&`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`&`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`'`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`(...)`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`*`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`+`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`,`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`-`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`/`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`:`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`;;`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`;`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`<<`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`<=`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`<`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`===`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`==`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`=`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`>=`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`>>`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`>`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`?`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`@`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`Address`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`Char`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`Container`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`Float`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`Identity`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`Int`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`Iterator`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`List`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`Raw`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`Reader`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`String`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`Struct`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`Unit`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`Vector`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`[...]`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`\\`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`^`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`aarch64_firmware`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`aarch64_qemu`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`aarch64_rpi`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`ascii`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`bit_shift_left`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`factorial`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`mul`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`pow`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`signed`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`utf32`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`{...}`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`|...|`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`|`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`||...||`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`||`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`~*`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`~+`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`~-`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`~/`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`~^`"], from: "corpus", key: "bareName|``" },
	{ fn: "bareName", args: ["`~`"], from: "corpus", key: "bareName|``" },
	{ fn: "addressWithoutArrow", args: ["add","Int","Char"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["add","Int","Int"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["add","Int","Scalar"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["add","Int","Unit"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["add","Int",null], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["add","Scalar","Int"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["add","Scalar","Scalar"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["add","Scalar","Unit"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["add","Unit","Int"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["add","Unit","Scalar"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["add","Unit","Unit"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["add","Unit",null], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["add",null,"Unit"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["div","Int","Int"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["div","Scalar","Int"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["div","Scalar","Scalar"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["sub","Atom","Int"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["sub","Char","Char"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["sub","Int","Int"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["sub","Int","Scalar"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["sub","Scalar","Int"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["sub","Scalar","Scalar"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["sub","Unit","Int"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["sub",null,"Char"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["sub",null,null], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:-" },
	{ fn: "addressWithoutArrow", args: ["mul","Int","Container"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:-" },
	{ fn: "addressWithoutArrow", args: ["mul","Int","Int"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:-" },
	{ fn: "addressWithoutArrow", args: ["mul","Scalar","Int"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:-" },
	{ fn: "addressWithoutArrow", args: ["mul","Scalar","Scalar"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:-" },
	{ fn: "addressWithoutArrow", args: ["mul","Unit","Container"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:Unit|ADDRESS_DOMAIN:-" },
	{ fn: "addressWithoutArrow", args: ["mul","Unit","Int"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:Unit|ADDRESS_DOMAIN:-" },
	{ fn: "addressWithoutArrow", args: ["mul","Unit","Scalar"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:Unit|ADDRESS_DOMAIN:-" },
	{ fn: "addressWithoutArrow", args: ["mul","Unit","Unit"], from: "corpus", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:Unit|ADDRESS_DOMAIN:-" },

	// ---- コーパスは立てないが一式が立てる問い（道ごとに代表1つ） ----
	{ fn: "passingOf", type: "Char | List", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "passingOf|(直和:Char|List)|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "Int | List", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "passingOf|(直和:Int|List)|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "String | Struct", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "passingOf|(直和:String|Struct)|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "Atom", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "passingOf|(行に無い)|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "Address", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "passingOf|Address|aarch64_qemu|utf32" },
	{ fn: "passingOf", type: "Char", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "passingOf|Char|aarch64_qemu|utf32" },
	{ fn: "passingOf", type: "Container", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "passingOf|Container|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "Float", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "passingOf|Float|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "Float", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "passingOf|Float|aarch64_qemu|utf32" },
	{ fn: "passingOf", type: "Int", target: "cortex_m", charset: null, from: "suite", key: "passingOf|Int|(行に無い)|(無い)" },
	{ fn: "passingOf", type: "Int", target: "aarch64_qemu", charset: "unicode", from: "suite", key: "passingOf|Int|aarch64_qemu|(行に無い)" },
	{ fn: "passingOf", type: "Int", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "passingOf|Int|aarch64_qemu|utf32" },
	{ fn: "passingOf", type: "List", target: "aarch64_qemu", charset: "unicode", from: "suite", key: "passingOf|List|aarch64_qemu|(行に無い)" },
	{ fn: "passingOf", type: "List", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "passingOf|List|aarch64_qemu|utf32" },
	{ fn: "passingOf", type: "Raw", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "passingOf|Raw|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "Reader", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "passingOf|Reader|aarch64_qemu|ascii" },
	{ fn: "passingOf", type: "String", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "passingOf|String|aarch64_qemu|utf32" },
	{ fn: "passingOf", type: "Struct", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "passingOf|Struct|aarch64_qemu|utf32" },
	{ fn: "passingOf", type: "Unit", target: "aarch64_qemu", charset: "unicode", from: "suite", key: "passingOf|Unit|aarch64_qemu|(行に無い)" },
	{ fn: "passingOf", type: "Unit", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "passingOf|Unit|aarch64_qemu|utf32" },
	{ fn: "slotCellSize", type: "Atom", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "slotCellSize|(行に無い)|aarch64_qemu|ascii" },
	{ fn: "slotCellSize", type: "Address", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "slotCellSize|Address|aarch64_qemu|utf32" },
	{ fn: "slotCellSize", type: "Char", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "slotCellSize|Char|aarch64_qemu|ascii" },
	{ fn: "slotCellSize", type: "Char", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "slotCellSize|Char|aarch64_qemu|utf32" },
	{ fn: "slotCellSize", type: "Container", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "slotCellSize|Container|aarch64_qemu|ascii" },
	{ fn: "slotCellSize", type: "Float", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "slotCellSize|Float|aarch64_qemu|ascii" },
	{ fn: "slotCellSize", type: "Float", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "slotCellSize|Float|aarch64_qemu|utf32" },
	{ fn: "slotCellSize", type: "Int", target: "cortex_m", charset: null, from: "suite", key: "slotCellSize|Int|(行に無い)|(無い)" },
	{ fn: "slotCellSize", type: "Int", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "slotCellSize|Int|aarch64_qemu|utf32" },
	{ fn: "slotCellSize", type: "List", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "slotCellSize|List|aarch64_qemu|ascii" },
	{ fn: "slotCellSize", type: "List", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "slotCellSize|List|aarch64_qemu|utf32" },
	{ fn: "slotCellSize", type: "String", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "slotCellSize|String|aarch64_qemu|utf32" },
	{ fn: "slotCellSize", type: "Unit", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "slotCellSize|Unit|aarch64_qemu|ascii" },
	{ fn: "measure", type: "Char | List", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "measure|(直和:Char|List)|aarch64_qemu|ascii" },
	{ fn: "measure", type: "Int | List", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "measure|(直和:Int|List)|aarch64_qemu|ascii" },
	{ fn: "measure", type: "String | Struct", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "measure|(直和:String|Struct)|aarch64_qemu|ascii" },
	{ fn: "measure", type: "Atom", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "measure|(行に無い)|aarch64_qemu|ascii" },
	{ fn: "measure", type: "Address", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "measure|Address|aarch64_qemu|utf32" },
	{ fn: "measure", type: "Char", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "measure|Char|aarch64_qemu|utf32" },
	{ fn: "measure", type: "Container", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "measure|Container|aarch64_qemu|ascii" },
	{ fn: "measure", type: "Float", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "measure|Float|aarch64_qemu|ascii" },
	{ fn: "measure", type: "Float", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "measure|Float|aarch64_qemu|utf32" },
	{ fn: "measure", type: "Int", target: "cortex_m", charset: null, from: "suite", key: "measure|Int|(行に無い)|(無い)" },
	{ fn: "measure", type: "Int", target: "aarch64_qemu", charset: "unicode", from: "suite", key: "measure|Int|aarch64_qemu|(行に無い)" },
	{ fn: "measure", type: "Int", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "measure|Int|aarch64_qemu|utf32" },
	{ fn: "measure", type: "Raw", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "measure|Raw|aarch64_qemu|ascii" },
	{ fn: "measure", type: "Unit", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "measure|Unit|aarch64_qemu|utf32" },
	{ fn: "measureRule", type: "Iterator", el: "Address", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "measureRule|Iterator|el=Address|aarch64_qemu|ascii" },
	{ fn: "measureRule", type: "Iterator", el: "Int", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "measureRule|Iterator|el=Int|aarch64_qemu|ascii" },
	{ fn: "measureRule", type: "Iterator", el: "Int", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "measureRule|Iterator|el=Int|aarch64_qemu|utf32" },
	{ fn: "measureRule", type: "List", el: "Address", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "measureRule|List|el=Address|aarch64_qemu|ascii" },
	{ fn: "measureRule", type: "List", el: "Float", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "measureRule|List|el=Float|aarch64_qemu|utf32" },
	{ fn: "measureRule", type: "List", el: "Int", target: "aarch64_qemu", charset: "ascii", from: "suite", key: "measureRule|List|el=Int|aarch64_qemu|ascii" },
	{ fn: "measureRule", type: "List", el: "Int", target: "aarch64_qemu", charset: "utf32", from: "suite", key: "measureRule|List|el=Int|aarch64_qemu|utf32" },
	{ fn: "alignUp", args: [1,8], from: "suite", key: "alignUp|切り上げる|a=8" },
	{ fn: "alignUp", args: [8,4], from: "suite", key: "alignUp|割り切れる|a=4" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "utf32", cells: [[8,8]], from: "suite", key: "packSlots|named|1本|詰め物なし|末尾そのまま|境界:上げる|aarch64_qemu|utf32" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[1,1]], from: "suite", key: "packSlots|named|1本|詰め物なし|末尾そのまま|境界:据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[1,1],[8,8]], from: "suite", key: "packSlots|named|複数|詰め物あり|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "utf32", cells: [[8,8],[4,4],[8,8]], from: "suite", key: "packSlots|named|複数|詰め物あり|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|utf32" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[1,1],[8,8],[1,1]], from: "suite", key: "packSlots|named|複数|詰め物あり|末尾を切り上げる|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "utf32", cells: [[8,8],[8,8]], from: "suite", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|utf32" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[1,1],[1,1]], from: "suite", key: "packSlots|named|複数|詰め物なし|末尾そのまま|境界:据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "named", target: "aarch64_qemu", charset: "ascii", cells: [[8,8],[1,1]], from: "suite", key: "packSlots|named|複数|詰め物なし|末尾を切り上げる|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "positional", target: "aarch64_qemu", charset: "ascii", cells: [[8,8]], from: "suite", key: "packSlots|positional|1本|詰め物なし|末尾そのまま|境界:上げる|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "positional", target: "aarch64_qemu", charset: "ascii", cells: [[8,8],[8,8]], from: "suite", key: "packSlots|positional|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "packSlots", kind: "positional", target: "aarch64_qemu", charset: "utf32", cells: [[16,8],[16,8]], from: "suite", key: "packSlots|positional|複数|詰め物なし|末尾そのまま|境界:上げる+据え置く|aarch64_qemu|utf32" },
	{ fn: "packSlots", kind: "positional", target: "aarch64_qemu", charset: "ascii", cells: [[16,8],[1,1]], from: "suite", key: "packSlots|positional|複数|詰め物なし|末尾を切り上げる|境界:上げる+据え置く|aarch64_qemu|ascii" },
	{ fn: "bareName", args: ["+"], from: "suite", key: "bareName|短い" },
	{ fn: "bareName", args: ["zz"], from: "suite", key: "bareName|素" },
	{ fn: "addressWithoutArrow", args: ["bit_shift_left","Int","Int"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:bit_shift_left|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:-" },
	{ fn: "addressWithoutArrow", args: ["bit_shift_left","Address","Int"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:bit_shift_left|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:Address|ADDRESS_PARTNERS:Int" },
	{ fn: "addressWithoutArrow", args: ["bit_shift_left","Address","Unit"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:bit_shift_left|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:Address|ADDRESS_PARTNERS:Unit" },
	{ fn: "addressWithoutArrow", args: ["bit_shift_left","Unit","Int"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:bit_shift_left|WEAK_LEFT_TYPES:Unit|ADDRESS_DOMAIN:-" },
	{ fn: "addressWithoutArrow", args: ["mul","Address","Address"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:Address|ADDRESS_PARTNERS:Address" },
	{ fn: "addressWithoutArrow", args: ["mul","Address","Int"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:Address|ADDRESS_PARTNERS:Int" },
	{ fn: "addressWithoutArrow", args: ["mul","Address","Unit"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:Address|ADDRESS_PARTNERS:Unit" },
	{ fn: "addressWithoutArrow", args: ["mul","Unit","Address"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:Unit|ADDRESS_DOMAIN:Address|ADDRESS_PARTNERS:Address" },
	{ fn: "addressWithoutArrow", args: ["pow","Int",null], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:pow|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:-" },
	{ fn: "addressWithoutArrow", args: ["pow","Address","Int"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:pow|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:Address|ADDRESS_PARTNERS:Int" },
	{ fn: "addressWithoutArrow", args: ["pow","Address","Unit"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:pow|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:Address|ADDRESS_PARTNERS:Unit" },
	{ fn: "addressWithoutArrow", args: ["pow","Unit","Int"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:pow|WEAK_LEFT_TYPES:Unit|ADDRESS_DOMAIN:-" },
	{ fn: "addressWithoutArrow", args: ["pow","Unit","Address"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:pow|WEAK_LEFT_TYPES:Unit|ADDRESS_DOMAIN:Address|ADDRESS_PARTNERS:Address" },
	{ fn: "addressWithoutArrow", args: ["factorial",null], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:factorial|ADDRESS_DOMAIN:-" },
	{ fn: "addressWithoutArrow", args: ["factorial","Address"], from: "suite", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:factorial|ADDRESS_DOMAIN:Address" },

	// ---- 誰も立てないが、表の行を見えるようにするために足した問い ----
	{ fn: "nameLt", args: ["<z>","a"], from: "added", key: "nameLt|文字で決まる|<>短い", why: "剥いだ後も包みに見える名前（<z>）を誰も並べない。比べるのは剥いだ後の綴りそのもので、もう一度剥ぐと並びが入れ替わる。" },
	{ fn: "addressWithoutArrow", args: ["mul","Address","Char"], from: "added", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:Address|ADDRESS_PARTNERS:Char", why: "ADDRESS_PARTNERS の `Char` の行は、コーパスも一式も見ていない（表から抜いても誰の答えも動かない）。演算・左辺・右辺の名前だけで答えが決まるので、見える問いを1つ置く。" },
	{ fn: "addressWithoutArrow", args: ["mul","Address","Raw"], from: "added", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:-|ADDRESS_DOMAIN:Address|ADDRESS_PARTNERS:Raw", why: "ADDRESS_PARTNERS の `Raw` の行は、コーパスも一式も見ていない（表から抜いても誰の答えも動かない）。演算・左辺・右辺の名前だけで答えが決まるので、見える問いを1つ置く。" },
	{ fn: "addressWithoutArrow", args: ["mul","Raw","Address"], from: "added", key: "addressWithoutArrow|ADDRESS_FACTORIAL_OPS:-|ADDRESS_OPS:mul|WEAK_LEFT_TYPES:Raw|ADDRESS_DOMAIN:Address|ADDRESS_PARTNERS:Address", why: "WEAK_LEFT_TYPES の `Raw` の行は、コーパスも一式も見ていない（表から抜いても誰の答えも動かない）。演算・左辺・右辺の名前だけで答えが決まるので、見える問いを1つ置く。" },
];

/** 名前だけでは答えられない呼び出しの回数（コーパス1巡と一式の和）。理由は `TRACE_INFO.outside.why`。 */
export const OUTSIDE = {
	"layoutOfStruct": 30690419,
	"elementShapeOfList": 6955431,
	"stringLength": 16576302,
	"measure": 24479273,
	"measureList": 549735,
	"commonSlotShape": 287538,
	"itemShapeOfListAt": 443,
	"packSlots": 726,
	"passingOf": 933,
	"slotCellSize": 186,
	"measureCursor": 297
};

export const TRACE_INFO = {
	"date": "2026-09-22",
	"layoutSha": "dbcab59586b8fd0abf5c33d2f97bbc21b865d0da3dd7ef6817612fd22ff1cc75",
	"corpus": {
		"entries": 9,
		"calls": 378249,
		"distinct": 246,
		"ms": 3137
	},
	"suite": {
		"dirs": [
			"suite_trace"
		],
		"files": 34,
		"skippedGate": [],
		"calls": 390343563,
		"distinct": 4837
	},
	"rows": {
		"total": 382,
		"byFn": {
			"passingOf": 29,
			"slotCellSize": 17,
			"measure": 19,
			"alignUp": 40,
			"packSlots": 30,
			"nameLt": 97,
			"bareName": 92,
			"addressWithoutArrow": 51,
			"measureRule": 7
		},
		"byFrom": {
			"corpus": 293,
			"suite": 85,
			"added": 4
		}
	},
	"outside": {
		"corpus": {
			"layoutOfStruct": 39542,
			"elementShapeOfList": 13381,
			"stringLength": 22206,
			"measure": 28126,
			"measureList": 1852,
			"commonSlotShape": 497
		},
		"suite": {
			"layoutOfStruct": 30650877,
			"elementShapeOfList": 6942050,
			"stringLength": 16554096,
			"measure": 24451147,
			"measureList": 547883,
			"commonSlotShape": 287041,
			"itemShapeOfListAt": 443,
			"packSlots": 726,
			"passingOf": 933,
			"slotCellSize": 186,
			"measureCursor": 297
		},
		"why": {
			"layoutOfStruct": {
				"構文木か形が要る": 30690419
			},
			"elementShapeOfList": {
				"構文木か形が要る": 6955431
			},
			"stringLength": {
				"構文木か形が要る": 16576302
			},
			"measure": {
				"木を歩いた（stringLength）": 16245563,
				"木を歩いた（layoutOfStruct）": 7667599,
				"木を歩いた（listItems・measureList）": 547058,
				"木を歩いた（listItems・measureList・stringLength）": 2677,
				"名前だけでも木へ入る（listItems・measureList）": 15433,
				"型が無い": 182,
				"木を歩いた（measureRule(el/repr)）": 448,
				"木を歩いた（continuous・listItems・measureList）": 2,
				"木を歩いた（continuous・stringLength）": 1,
				"木を歩いた（continuous・layoutOfStruct）": 1,
				"木を歩いた（continuous）": 10,
				"木を歩いた（deref）": 2,
				"木を歩いた（cursorParts・measureCursor）": 297
			},
			"measureList": {
				"構文木か形が要る": 549735
			},
			"commonSlotShape": {
				"構文木か形が要る": 287538
			},
			"itemShapeOfListAt": {
				"構文木か形が要る": 443
			},
			"packSlots": {
				"並べられない（測れないスロットがある）": 726
			},
			"passingOf": {
				"木を歩いた（deref）": 8,
				"型が無い": 194,
				"型の名前だけでは答えが違う": 731
			},
			"slotCellSize": {
				"木を歩いた（deref）": 8,
				"型が無い": 178
			},
			"measureCursor": {
				"構文木か形が要る": 297
			}
		}
	},
	"unseen": []
};
