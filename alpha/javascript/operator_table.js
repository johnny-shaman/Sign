/**
 * Sign言語 演算子テーブル (正引き・逆引き)
 * documents/ja-jp/impl/syntax/operator_table.js から移植（正式仕様、変更なし）
 */

/**
 * ## `asm` 欄——1つの表が両方のバックエンドを養う
 *
 * pass4（JS）と、これから書く Sign 側のバックエンドは同じ問いを持つ：この演算子はどの
 * 命令で出るのか。答えを2箇所に書けば必ず片方だけ直る。だから**表が持つ**。
 *
 * Sign 側はアセンブリを文字列の連結で吐くので、ここに要るのは**ニーモニックの綴り**だけ
 * である。符号化の表は要らない——それはアセンブラの仕事である。
 *
 * ### 鍵は機械のクラスと符号であって、層ではない
 *
 * `gpr` / `fp` / `simd` は機械のクラスであり、**層はその名前が既に言っている**
 * （`fp` は層2、`simd` は層3）。層の欄を足すと同じ事実が2箇所で決まるので置かない。
 *
 * 符号はそのクラスの**中で**分かれる。`Int` は符号あり、`Address` と `Char` は符号なしで、
 * どちらで出すかはオペランドの型が決める（`SIGNEDNESS`、target_info.js）。符号を型の側
 * だけに持たせて命令を1本にすると、番地の比較が黙って間違う——上位ビットの立った番地
 * （カーネル空間の `0xFFFF…`）を符号ありで比べると負の数として扱われ、低位の番地より
 * 小さいと判定される。OS を書く言語でそこは踏む。
 *
 * ### `+` `-` `*` が同じ綴りを2度持つ理由
 *
 * 2の補数では符号あり・符号なしで同じ命令になる（等価比較の `eq`/`ne` も同じ）。
 * **それでも2度書く**——「分かれるもの」と「分かれないもの」を別の形にすると、引く側が
 * 毎回どちらの形かを判定しなければならず、分岐が1つ増える。同じ形で2度書けば、引く側は
 * 符号を決めて引くだけで済む。
 *
 * ### `form`——綴りだけでは置き場所が分からない
 *
 * `sdiv` は3オペランドの命令として書かれ、`lt` は `cmp`/`ccmp`/`csel` に付く条件コード
 * である。綴りを見ても区別は付かないので表が言う。これは演算子の型の影である——算術は
 * `A × A → A` で返る先が同じ対象、比較は `A × A → Ω` で別の対象である（pass4 の完全性
 * 公理の注記がこの違いを述べている）。
 *
 *     alu   3オペランドの命令（`add xd, xn, xm`）
 *     cond  `cmp` の後に付く条件コード（`csel …, lt`、絶対値なら `cneg …, lt`）
 *     mem   番地を持つ命令（`ldrb w9, [x9]`）——読み書きはここ
 *     adr   番地を作る命令（`add xd, x29, #off` / `adrp` + `add :lo12:`）
 *     それ以外  **列の名前である**（下の「答えは3通りある」）
 *
 * ### `axis`——その行が何で分かれるか
 *
 * 綴りが決まっても命令が1つに決まるとは限らない。**何が残っているかは演算子ごとに違う**：
 *
 *     signed  符号（`sdiv`/`udiv`、`lt`/`lo`）——オペランドの型が決める
 *     width   幅（`ldrb`/`ldrh`/`ldr`）——番地が `NxHHHH` で宣言する
 *     place   場所（フレームか静的か）——どこに在るものの番地かが決める
 *     shape   何も分かれない。綴りに対応する命令が無いから（下）
 *
 * **これは層の欄ではない。** `place` は層の門が読む軸と同じもの（フレームは確保が要るので
 * 層1以上、静的は層0で足りる）だが、層はそこから**導かれる**のであって、行が層を名乗ると
 * 同じ事実が2箇所で決まる。
 *
 * `axis` は**行が落ちる表の名前**でもある。生成器（tools/gen_operator_table.mjs）は
 * `#asm_<位置>_<軸>` へ分けて書き、同じ表の行が違う欄を持っていたら落ちる——実行時の鍵で
 * 引ける条件が「どの行も同じ形」だからである（.sn 側の注記）。
 *
 * ### 答えは3通りある——1命令・列・命令にならない
 *
 * **1命令**（`form` が alu/cond/mem/adr）。綴りと軸で命令が決まる。表が綴りを持つ。
 *
 * **列**（`axis: 'shape'`）。1つのニーモニックでは名前が付かないもの——前置 `!`（不在の
 * 判定と `csel`）、前置 `~`（長さ1の器へ持ち上げる）、後置 `~`（写しループ）、`&`/`|`
 * （短絡）、`'`（範囲検査つきの要素読み）、余積と積（器の構築）、`~`/`~+`（規則の3つ組）、
 * `||…||`（要素数）。
 * **行は在る**——`form` が列の名前で、実際に出る命令はその行のコメントが持つ。列の本体を
 * 表へ入れようとしてはいけない。それはバックエンドそのものであって、表ではない。
 *
 * **命令にならない**（行が無い）。引けば `__` が返り、`__` は唯一の偽である。ただし
 * **無いことは2つの別々の事実を意味する**ので、どちらなのかを下の名簿が言う：
 *
 *     NOT_YET             機械の意味は在るが pass4 がまだ出せない（`-` は `neg` 1命令）
 *     NOT_AN_INSTRUCTION  そもそも命令にならない（`:` は束縛、`@` 後置はコンパイル時）
 *
 * 名簿を1つにすると、`-`（negate）の理由の欄に「機械の意味が無い」と**嘘を書く**ことに
 * なる。2つに分ければ、`-` を実装した日に NOT_YET から表へ移すだけで済み、名簿はそのまま
 * 「今どこまで出せるか」の帳簿になる。
 *
 * どちらにも載っていない綴りは検査が落とす（test/operator_coverage.test.js）——新しい
 * 演算子を足した人に、3つのうちどれなのかを**必ず選ばせる**ためである。
 *
 * ### 欄の値が空の綴り——その軸のその側には命令が無い
 *
 * 行は在るが、軸の片側だけ命令にならないことがある（符号なしの絶対値は恒等）。そこは
 * **欄を消さず、値を空の綴り `''` にする**。3つの綴り方を実測した（.sn の表、実機）：
 *
 *     欄を書かない      静的に「構造体に gpr_unsigned というスロットがありません」で断られる
 *     値を `__` にする  「スロットの幅が合いません（値は 1 本、スロットは 0 byte）」で断られる
 *     値を空の綴りに    引けば `__`（`[] = __`）、隣の行と形が揃ったまま行を実行時の鍵で引ける
 *
 * 欄を書かないと、その行だけ欄の集合が違う——同じ表の行は同じ欄を持つ（`ASM_COLUMNS`）
 * という不変条件が割れ、しかも欄の名前は静的に引くので、表が1行でも断られる。空の綴りは
 * **値としては `__` そのもの**なので、「引けば `__` が返り、それが無い」という読み方は
 * 行の不在と同じまま使える。
 */
export const OPERATOR_BY_PRECEDENCE = [
  { // 1
    '\\n': { position: 'infix', name: 'newline' },
    '#': { position: 'prefix', name: 'export_internal' },
    '##': { position: 'prefix', name: 'export_external' },
    '###': { position: 'prefix', name: 'export_pin' },
  },
  { // 2
    ':': { position: 'infix', name: 'define' , assoc: 'right' },
  },
  { // 3
    '?': { position: 'infix', name: 'lambda' , assoc: 'right' },
  },
  { // 4
    // **書き込みは幅で分かれる。** 番地が `NxHHHH` で宣言した `N` がそのまま命令を選ぶ
    // （`1x9000000 # 0x4b` は `strb w10, [x9]`）。宣言が無ければ語幅で、`str x10, [x9]` に
    // なる——`w8` の欄がその既定である。
    //
    // **幅は型ではなく番地が言う。** 型から決めると `0x… # \a`（Char）が 1 byte になりそう
    // だが、実測すると今日そこは 8 byte を書く（`declaredWidthOf` が `null` を返し、gpr の
    // 幅 8 に落ちる）。表は**出ている命令**を書く。
    '#': { position: 'infix', name: 'output', assoc: 'right', asm: { form: 'mem', axis: 'width', gpr: { w1: 'strb', w2: 'strh', w4: 'str', w8: 'str' } } },
  },
  { // 5
    ';': { position: 'infix', name: 'xor' },
  },
  { // 6
    // 短絡は分岐である。`mov x13, 左` / `movz x12, #0x8000, lsl #48` / `cmp 左, x12` /
    // `b.ne .Lsc`（`|` は「左が `__` でなければ左が結果」）/ `mov x13, 右` / `.Lsc:`。
    // `&` との違いは分岐の向き（`b.eq`）だけで、幅も符号も問わない。
    '|': { position: 'infix', name: 'or', asm: { form: 'short_circuit', axis: 'shape' } },
  },
  { // 7
    '&': { position: 'infix', name: 'and', asm: { form: 'short_circuit', axis: 'shape' } },
  },
  { // 8
    // **`===` は廃止された。** 唯一の役目だった「ねじれ（宣言順の置換）の同定」は、
    // 2つの引き方の差で導出できる——`p ' 0` と `p ' 名前` が一致すれば恒等置換である
    // （type_system.md §6.2 が元からそう書いていた）。しかも宣言順はコンパイル時の性質
    // なので、実行時の演算子では答えられない（呼び出しサイトごとに置換が違うと決まらない）。
    //
    // **表から消しては（字句として）いけない。** 消すと `1 === 1` が `==` + `=` に割れて
    // `construct(1, assign_equal(atom "==", 1))` という別の意味へ黙って化ける。1つの字句
    // として読ませたうえで、使ったら pass3 が名指しする。
    '===': { position: 'infix', name: 'same', removed: "ねじれは `p ' 0` と `p ' 名前` の差で導出できます" },
    // **構造比較も条件コードで終わる。** 段13 の `=`/`!=` と同じ `eq`/`ne` であり、符号には
    // 依らない（等価は2の補数で分かれない）。分かれるのは条件コードではなく**中身の形**で、
    // スカラーなら `cmp` / `movz x12, #0x8000, lsl #48` / `csel x9, x9, x12, eq` の3命令、
    // Struct ならスロットごとに `ldr`+`cmp`+`b.ne`、器なら長さ比較＋要素ループになる。
    // **どの面も最後に置くのはこの綴りである**ので、行は条件コードを持つ（pass4 の
    // `genScalarStructCompare` が直書きしていたのはこれ）。
    '==': { position: 'infix', name: 'equal', asm: { form: 'cond', axis: 'signed', gpr: { signed: 'eq', unsigned: 'eq' } } },
    // 8/6修正: 以前は'!='(tier12)と同じ'not_equal'だったため、operator_table.js自身の
    // 中で.nameが衝突しており、コード側は.op（記号そのもの）で区別する回避策に頼っていた
    // （pass3.js/interpreter.js参照）。operator_table.mdが元々使っていた'xnot_equal'に
    // 改名し、衝突そのものを解消した（既存の.opベースの区別ロジックは引き続き正しく動く
    // ため、この改名による挙動の変化は無い——念のため残してある）。
    '!==': { position: 'infix', name: 'xnot_equal', asm: { form: 'cond', axis: 'signed', gpr: { signed: 'ne', unsigned: 'ne' } } },
  },
  { // 9
    // **積は器を組む列である。** `$(a , 1)` は `sub sp, sp, #16` / `str x9, [sp, #0]` /
    // `str x9, [sp, #8]` / `mov x9, sp`——場所を取って順に置き、その番地を返す。要素の並べ方は
    // 幅が決めるので、1つの綴りには落ちない。
    ',': { position: 'infix', name: 'product', assoc: 'right', asm: { form: 'build', axis: 'shape' } },
  },
  { // 10: 前置 `~`（持ち上げ）。積（`,`）の隣であり、余積（空白）より緩い。
    // system_semantics.md の待機の表が「前置 `~`（持ち上げ）は**余積を一回**待機状態に
    // 入れる（サスペンド）」と述べている通り、被演算子は余積である。したがって余積より
    // 緩くなければ余積を掴めない——以前は他の前置演算子と同じ最内（旧tier23）に置かれて
    // おり、`~1 2 3` が `(~1) 2 3` に切れて型エラーになっていた。
    //
    // `$`/`@` が最内のままなのは、作用する対象が違うからである。`$` は単一の値に作用する
    // ので対象はアトム、前置 `~` は構造に作用するので対象は構造を作る演算子（`,`・空白）の
    // 段にある。「演算子の優先度は、作用対象を構築する演算子の優先度に合わせる」。
    //
    // 後置 `~`（展開）は余積より内側でありさえすればよいので、動かしていない（旧tier22）。
    // `list ' N~`（get-rest）が `'`（tier19）より内側であることに依存しているため、
    // ここまで下げると壊れる。
    //
    // **命令の側から見ると、これは「長さ1の器へ持ち上げる」列である**（pass4 の
    // `emitLiftToContainer`）。スカラー1本に対して
    // `sub sp, sp, #16` / `str x9, [sp, #0]` / `movz x12, #0x8000, lsl #48` / `cmp x9, x12` /
    // `mov x10, #1` / `csel x10, xzr, x10, eq`（`__` なら len = 0）/ `mov x9, sp` の7命令。
    // **既に器なら 0命令である**（恒等）——出る命令は綴りではなく被演算子の本数が決める。
    '~': { position: 'prefix', name: 'continuous', asm: { form: 'lift_to_container', axis: 'shape' } },
  },
  { // 11: 空白演算子（適用、リスト構築等）
    // **余積は適用にもなり構築にもなる**（pass2 が `apply`/`construct`/`concat`/`push`/
    // `unshift` へ改名する）。呼ぶなら `bl`（末尾なら `b`）、器を作るなら要素を並べて写す
    // ループで、1つの綴りには落ちない。どちらへ行くかは綴りではなく左辺が関数かどうかが決める。
    ' ': { position: 'infix', name: 'coproduct', asm: { form: 'apply_or_build', axis: 'shape' } },
  },
  { // 12
    // **規則はメモリに置かない。** `{start, step, end}` の3つ組をスロットへ置くだけで、
    // `~` は歩幅を作るのに `cmp` / `mov x11, #1` / `movn x12, #0` / `csel x11, x11, x12, le`
    // の4命令を足す（昇順なら +1、降順なら −1——向きを歩幅へ畳む）。`~+` は端点を置くだけで
    // 追加の命令が無い。**それでも行は在る**——0命令であることと、命令が無いことは違う。
    '~': { position: 'infix', name: 'range', asm: { form: 'range_triple', axis: 'shape' } },
    '~+': { position: 'infix', name: 'range_arithmetic', asm: { form: 'range_triple', axis: 'shape' } },
    '~-': { position: 'infix', name: 'range_arithmetic_rev' },
    '~*': { position: 'infix', name: 'range_geometric' },
    '~/': { position: 'infix', name: 'range_geometric_rev' },
    '~^': { position: 'infix', name: 'range_power' },
  },
  { // 13
    // `asm` は条件コード（`form: 'cond'`）——`cmp` の後に `csel`/`ccmp` へ付く。
    // 大小は符号で変わり（符号あり `lt`/`le`/`ge`/`gt`、符号なし `lo`/`ls`/`hs`/`hi`）、
    // 等価は符号に依らないので `eq`/`ne` が両側に同じ綴りで立つ。
    '<': { position: 'infix', name: 'less', asm: { form: 'cond', axis: 'signed', gpr: { signed: 'lt', unsigned: 'lo' } } },
    '<=': { position: 'infix', name: 'less_equal', asm: { form: 'cond', axis: 'signed', gpr: { signed: 'le', unsigned: 'ls' } } },
    '=': { position: 'infix', name: 'assign_equal', asm: { form: 'cond', axis: 'signed', gpr: { signed: 'eq', unsigned: 'eq' } } },
    '>=': { position: 'infix', name: 'more_equal', asm: { form: 'cond', axis: 'signed', gpr: { signed: 'ge', unsigned: 'hs' } } },
    '>': { position: 'infix', name: 'more', asm: { form: 'cond', axis: 'signed', gpr: { signed: 'gt', unsigned: 'hi' } } },
    '!=': { position: 'infix', name: 'not_equal', asm: { form: 'cond', axis: 'signed', gpr: { signed: 'ne', unsigned: 'ne' } } },
  },
  { // 14
    // 加減算は2の補数で符号あり・符号なしが同じ命令になる。それでも両側に書く（冒頭の注記）。
    // **番地の加減算は、この綴りの上に溢れの検査が乗る**（旗を立てる `adds`/`subs` と niche の
    // 選択）。検査するかは符号ではなく結果の型が決めるので（`Char` も符号なしだが検査しない）、
    // 欄ではなく pass4 の `CARRY` が持つ——integer_overflow.md §1.1。
    '+': { position: 'infix', name: 'add', asm: { form: 'alu', axis: 'signed', gpr: { signed: 'add', unsigned: 'add' } } },
    '-': { position: 'infix', name: 'sub', asm: { form: 'alu', axis: 'signed', gpr: { signed: 'sub', unsigned: 'sub' } } },
  },
  { // 15
    '*': { position: 'infix', name: 'mul', asm: { form: 'alu', axis: 'signed', gpr: { signed: 'mul', unsigned: 'mul' } } },
    // **除算だけは命令そのものが分かれる。** 商の丈が違うので `sdiv`/`udiv` は別の命令である。
    '/': { position: 'infix', name: 'div', asm: { form: 'alu', axis: 'signed', gpr: { signed: 'sdiv', unsigned: 'udiv' } } },
    // `%`（mod）に `asm` が無いのは、まだ出せないからである（AArch64 に剰余の命令は無く、
    // `sdiv` + `msub` の2命令に開く必要がある）。無いことが「出せない」を意味し、どちらの
    // 「無い」なのかは `NOT_YET` が言う。
    '%': { position: 'infix', name: 'mod' },
  },
  { // 16
    '^': { position: 'infix', name: 'pow', assoc: 'right' },
  },
  { // 17
    // 囲みはここには居ない。自己完結しているので優先順位を持たず、ブロックと同じ段にある。
  },
  { // 18
    // **要素を引くのは範囲検査つきのロードである。** `s ' a` は
    // `cmp x9, #0` / `b.ge`（負なら末尾から）/ `add x9, x9, x10` / `cmp x10, x9`（範囲内か）/
    // `ldrb w14, [x9, x10]`（幅で `lsl #1/2/3` が付く）/ `movz x12, #0x8000, lsl #48` /
    // `csel x9, x14, x12, lo`。範囲外が `__` になることまでが1つの形なので、ロードの綴り
    // だけを取り出しても意味を持たない。Struct のフィールドは静的に畳まれて 0命令になる。
    "'": { position: 'infix', name: 'get_prop', asm: { form: 'index_guard', axis: 'shape' } },
    '@': { position: 'infix', name: 'get_at', assoc: 'right' },
  },
  { // 19
    '<<': { position: 'infix', name: 'bit_shift_left' },
    '>>': { position: 'infix', name: 'bit_shift_right' },
  },
  { // 20
    '||': { position: 'infix', name: 'bit_or' },
  },
  { // 21
    ';;': { position: 'infix', name: 'bit_xor' },
  },
  { // 22
    '&&': { position: 'infix', name: 'bit_and' },
  },
  { // 23
    '!': { position: 'postfix', name: 'factorial' },
    // **展開は写しループである。** 単独で置けば 0命令（中身をそのまま返す）だが、器を組む
    // 位置では `mov x13, #0` / `.Lcp:` / `cmp x13, x15` / `b.ge` / `ldr x14, [x10, x13, lsl #3]` /
    // `add` / 入るかの検査 / `str x14, [x10, #0]` / `add x13, x13, #1` / `b .Lcp` になる。
    // 刻みは要素の幅で変わり（1/2/4/8、参照要素なら `ldr`×2・`str`×2）、**位置でも変わる**
    // ——同じ綴りが 0命令にも10命令にもなるので、1つのニーモニックには落ちない。
    '~': { position: 'postfix', name: 'expand', asm: { form: 'copy_loop', axis: 'shape' } },
  },
  { // 24
    // 前置 `~`（continuous）は tier 10 へ移した（そちらのコメント参照）。
    //
    // **否定は「不在か」を見て選ぶ列である。** `!a` は
    // `movz x12, #0x8000, lsl #48` / `cmp x9, x12` / `mov x9, #0`（不在なら真＝`0`）/
    // `csel x9, x9, x12, eq` の4命令。被演算子が何本で運ばれるかで前半が変わり（器なら
    // `ldr len` + `cmp x, #0`、規則なら歩幅の向きまで見る6命令）、`!__` は定畳みで
    // `mov x0, #0` の1命令になる。**「不在の判定」の綴りは AArch64 に無い**ので列である。
    '!': { position: 'prefix', name: 'not', asm: { form: 'is_unit_select', axis: 'shape' } },
    // **番地の作り方は「どこに在るか」で分かれる**（`axis: 'place'`）。
    //
    //     frame   `add x9, x29, #16`                       仮引数はフレームに在る
    //     static  `adrp x9, .Lbind_k` + `add x9, x9, :lo12:.Lbind_k`   束縛は .rodata に在る
    //
    // 基底が `sp` ではなく `x29` なのは、`$匿名式` が `sub sp` で場所を取るあいだも
    // フレームの底が動かないからである（そこは綴りではなくオペランドなので欄に無い）。
    //
    // **関数のラベルはまだ来ない。** 出るとすれば static と同じ `adrp` + `add :lo12:` で、
    // 違うのはラベルだけである——つまり**軸は増えない**。今日の pass4 は `$g` を
    // 「アドレスを取れるのはフレームに在るものだけです」で断る（関数オブジェクトを返せない
    // のはこれが理由である）。欄を先に作らないのは、断っているものに綴りを書くと表が嘘を
    // つくからで、実装した日にこの行へ `static` を使い回せばよい。
    //
    // `$__`（`movz x9, #0x8000, lsl #48`）と `$匿名式`（`sub sp` の列）はこの軸の外にある
    // ——前者は場所を持たないもの、後者はその場で場所を**作る**もので、どちらも「在る場所
    // の番地を作る」ではない。
    '$': { position: 'prefix', name: 'address', asm: { form: 'adr', axis: 'place', gpr: { frame: 'add', static_page: 'adrp', static_off: 'add' } } },
    // **読み出しは幅で分かれる**（中置 `#` と対）。`@1x9000000` は `ldrb w9, [x9]`。
    // 宣言が無ければ語幅で `ldr x9, [x9]` になる（`w8` が既定）。4 byte が `ldr` なのは
    // 綴りが同じで**レジスタが `w` になる**からで、そこは幅が決めるので欄に無い。
    '@': { position: 'prefix', name: 'input', asm: { form: 'mem', axis: 'width', gpr: { w1: 'ldrb', w2: 'ldrh', w4: 'ldr', w8: 'ldr' } } },
    '!!': { position: 'prefix', name: 'bit_not' },
    '-': { position: 'prefix', name: 'negate' },
    // 【8/6 撤去】'><' (reverse)。documents/ja-jp/impl/syntax/operator_table.js と同時に
    // 撤去——list_model.md §2.5のrest記法の位置一般化で代替できるため不要と判断。
  },
  { // 25: postfix @（import）は単独tier（8/6、documents/ja-jp/impl/syntax/operator_table.js
    // と同時に修正——「importしてからinput」の意図とtier番号の慣習の整合性のため）。
    '@': { position: 'postfix', name: 'import' },
  },
  { // 26（旧24から繰り下げ）
    // **囲みはすべてここに居る。** 自己完結しているので優先順位は参照されない
    // ——`pass2` は囲みの tier を一度も引かない（文法が先にブロックへ畳む）。
    // 絶対値だけ別の段に書かれていたのは帳簿のズレで、実装は最初からここと同じ挙動だった。
    '(...)': { position: 'enclosure', name: 'block_paren' },
    '{...}': { position: 'enclosure', name: 'block_brace' },
    '[...]': { position: 'enclosure', name: 'block_bracket' },
    // **絶対値は「0 より小さければ反転」であり、符号で分かれるのは 0 と比べる条件だけである。**
    //
    // `Int` は `cmp x9, #0` / `cneg x9, x9, lt` の2命令で、分岐が無い。欄が持つのは段13 の
    // `<` と同じ条件コードで、`cneg` は欄に置かない——比較の行が `csel` を置かないのと同じく、
    // どちらの側でも変わらない綴りは引く側が持つ。
    //
    // **符号なしの欄は空の綴りである。** 符号なしの値が 0 より小さくなる条件（`#0` と `lo`）は
    // 決して立たないので、出す命令が無い——恒等である（冒頭「欄の値が空の綴り」）。
    //
    // 符号ビットを落とす形は2の補数では絶対値にならない（`-1 & 0x7FFF…` は
    // 9223372036854775807）。それは IEEE754 の `Float` の fabs で、`Float` は層2なので pass4 に
    // まだ道が無い。1命令の `abs xd, xn` は CSSC 拡張（Armv8.9/9.4）にしか無く、qemu の
    // cortex-a57 には無い——拡張を持つターゲットでは form ごと変わる候補である。
    //
    // `|__|` は零射で、niche（`INT64_MIN`）は `cneg` しても自分自身なので、見張りの命令が要らない。
    '|...|': { position: 'enclosure', name: 'abs', asm: { form: 'cond', axis: 'signed', gpr: { signed: 'lt', unsigned: '' } } },
    // **ノルムは中身の形で別々の列になる。** 器なら `len` を読むだけ（1命令）、Struct と
    // スカラーは `movz x12, #0x8000, lsl #48` / `cmp` / `mov x9, #k` / `csel` の4命令、
    // 規則なら `sub` / `sdiv` / `adds` / `csel …, pl` で段数を数え、`||__||` は 0 である。
    // 「数える」という1つの命令は機械に無い。
    '||...||': { position: 'enclosure', name: 'norm', asm: { form: 'count', axis: 'shape' } },
  },
  { // 27（旧25から繰り下げ）
    '\t': { position: 'prefix', name: 'indent' },
  },
  { // 28（旧26から繰り下げ）
    '\\': { position: 'prefix', name: 'escape' },
  }
];

export const OPERATOR_DICT = {};

// 【修正済み】以前は `prec = 1` から始めていたため、配列index 0（コメント上の優先順位"1"：
// 改行・前置export `#`/`##`/`###`）が一生 OPERATOR_DICT に登録されなかった。しかも
// `precedence: prec` は配列indexをそのまま使っていたため、他の全演算子もコメントの
// 優先順位表記より1つ小さい値で格納されていた（例: `:`はコメント"2"だが precedence=1
// として格納）。tier間の相対順序（どれがどれより先に処理されるか）はズレが一律だった
// ため偶然壊れずに動いていたが、pass2.js の reduceOnce が余積（スペース）を判定する
// ハードコードされた `tier === 10`（コメント通りの優先順位10を前提にしている）が、
// このバグにより実際にはコメント優先順位"11"のレンジ演算子（`~+`等）の格納値と衝突していた。
// `prec`を配列indexそのまま(0始まり)にし、`precedence: prec + 1`でコメント表記と一致させて解消。
for (let prec = 0; prec < OPERATOR_BY_PRECEDENCE.length; prec++) {
  const opsAtPrec = OPERATOR_BY_PRECEDENCE[prec];
  if (!opsAtPrec) continue;

  for (const symbol in opsAtPrec) {
    if (!OPERATOR_DICT[symbol]) {
      OPERATOR_DICT[symbol] = [];
    }
    OPERATOR_DICT[symbol].push({
      precedence: prec + 1,
      symbol: symbol,
      ...opsAtPrec[symbol]
    });
  }
}

// **演算子の名前から AArch64 の命令を引く索引。**
//
// 表の鍵は綴りだが、pass4 が節から持っているのは `name` である（連鎖比較に至っては
// `compareName` しか無く、綴りは持っていない）。Sign 側の表は綴りを鍵にする——**手に在る
// ものが違うだけで、引く表は1つである**。
//
// 名前を鍵にできるのは、この表が名前の衝突を1度解いてあるからである（段8 の `!==` が
// 段13 の `!=` と同じ `not_equal` を名乗っていた——上の注記）。衝突が戻ってくると索引は
// 黙って片方で上書きされるので、ここで止める。
const ASM_BY_NAME = {};
for (const tier of OPERATOR_BY_PRECEDENCE) {
  for (const symbol in tier) {
    const def = tier[symbol];
    if (!def.asm) continue;
    if (ASM_BY_NAME[def.name]) {
      throw new Error(`演算子の名前が衝突しています（${def.name}）——命令を名前で引けません`);
    }
    // **`axis: 'shape'` と「綴りを持たない」は同じ事実の表と裏である。**
    //
    // 軸は「何で分かれるか」なので、分かれる先（`gpr` の欄）が無ければ軸は無い。片方だけ
    // 書けた行は、引く側からは**どちらの答えなのか決まらない**——綴りを探して `undefined`
    // を掴むか、列だと思って中身を無視するかが呼ぶ場所ごとに変わる。ここで止める。
    if (!def.asm.form || !def.asm.axis) {
      throw new Error(`命令の行には form と axis が要ります（${def.name}）`);
    }
    if ((def.asm.axis === 'shape') !== !def.asm.gpr) {
      throw new Error(`axis: 'shape' は綴りを持たない行です（${def.name}）——列なら gpr を書かず、1命令なら軸を名乗ってください`);
    }
    ASM_BY_NAME[def.name] = def.asm;
  }
}

// **同じ表に落ちる行は、同じ欄を持たなければならない。**
//
// Sign 側の表は `#asm_<位置>_<軸>` へ分かれ、鍵（綴り）は実行時に決まりうる——**形が揃って
// いることだけがその引き方の条件である**（.sn 側の注記）。欄が割れた表は「まだ出せない
// 識別子です」で断られるか、もっと悪いことに欄を1つ落としたまま通る。
//
// 軸を分ける意味はここに在る。だから**生成器ではなく表が持つ**——生成器は書き出す側であって、
// 揃っているかどうかは書き出す前から表の性質である。生成器はこの不変条件を前提に、先頭の行の
// 欄をそのまま全部の行へ使う。
const ASM_COLUMNS = {};
for (const tier of OPERATOR_BY_PRECEDENCE) {
  for (const symbol in tier) {
    const def = tier[symbol];
    if (!def.asm || !def.asm.gpr) continue;
    const table = `${def.position}_${def.asm.axis}`;
    const cols = Object.keys(def.asm.gpr).join(" ");
    if (ASM_COLUMNS[table] === undefined) ASM_COLUMNS[table] = cols;
    else if (ASM_COLUMNS[table] !== cols) {
      throw new Error(`asm_${table} の行が違う欄を持っています（${symbol}: ${cols} と ${ASM_COLUMNS[table]}）——同じ軸のものだけを同じ表に置いてください`);
    }
  }
}

/**
 * その演算子が出る命令。**表を引く唯一の口である**（冒頭の `asm` 欄の注記）。
 *
 * 返るのは `{ form, gpr: { signed, unsigned } }`。引けなければ `undefined` で、それは
 * **まだ出せない**という意味である——演算子でない、という意味ではない（それは表そのものを
 * 引けないことが言う）。呼ぶ側はそのまま門に使える。欄の値が空の綴りなら、その側に命令は
 * 無い（冒頭の注記）。
 */
export function asmOf(name) {
  return ASM_BY_NAME[name];
}

/**
 * **機械の意味は在るが、pass4 がまだ出せないもの。**
 *
 * `asm` の行が無いことは「引けば `__`」という1つの答えしか返さないが、**その裏には2つの
 * 別々の事実がある**——`-`（negate）は `neg` 1命令で出るはずのものがまだ書かれていないだけ
 * で、`:`（define）はそもそも命令にならない。名簿を1つにすると、前者の理由の欄に「機械の
 * 意味が無い」と嘘を書くことになる。
 *
 * ここに居るものは**全部、今日 pass4 が名指しで断る**（`まだ出せない式です（名前）`）。
 * 黙って別の命令に化けることはない。実装した日にこの名簿から `asm` の行へ移せばよく、
 * その移動がそのまま「どこまで出せるか」の帳簿になる。
 *
 * 断り文句が出ることは test/operator_coverage.test.js が実際にコンパイルして確かめる
 * ——名簿だけなら、実装済みのものが居残っていても誰も気付かない。
 */
export const NOT_YET = {
  xor: "短絡の兄弟（`|`/`&`）は出せるのに、これだけ pass4 に節が無い",
  mod: "AArch64 に剰余の命令は無く、`sdiv` + `msub` の2命令へ開く必要がある",
  pow: "1命令では出ない（繰り返し二乗の列になる）",
  bit_shift_left: "`lsl` 1命令だが節が無い",
  bit_shift_right: "`asr`（符号あり）/ `lsr`（符号なし）——符号の軸を持つ",
  bit_or: "`orr` 1命令だが節が無い",
  bit_xor: "`eor` 1命令だが節が無い",
  bit_and: "`and` 1命令だが節が無い",
  range_arithmetic_rev: "3つ組では運べるが、添字が `start + i × step` にならない",
  range_geometric: "等比は添字が `start × step^i` なので、等差と同じ引き方ができない",
  range_geometric_rev: "同上（向きが逆なだけで、引き方は等比のまま）",
  range_power: "冪の規則も添字が等差にならない",
  factorial: "1命令では出ない（ループの列になる）",
  bit_not: "`mvn` 1命令だが節が無い",
  negate: "`neg`（`sub xd, xzr, xm`）1命令だが節が無い。負のリテラル `-1` は字句なのでここへ来ない（`movn`）",
};

/**
 * **そもそも命令にならないもの。**
 *
 * 字句（`\\`・`\t`・改行）、構文（`:`・`?`・囲み）、コンパイル時に消えるもの（後置 `@` の
 * import、pass2 が書き換える中置 `@`）。`asm` の行が無いのが正しい状態である。
 *
 * **前置 `#` / `##` / `###` だけは注意が要る。** 命令にはならないが、機械の意味はある
 * ——`.global` / `.hidden` / `.section` という**指令**を出す（pass4 の `symbolDirectives`）。
 * 「機械の意味が無い」とだけ書くと表が嘘をつくので、理由の欄がそれを名指しする。
 *
 * 指令を `asm` の表へ入れないのは、**行の形が揃わない**からである——`#` は2つ（`.global` と
 * `.hidden`）、`##` は1つ、`###` は2つで中身が違う。欄を揃えるには「無い」を値として書く
 * 必要がある。`__` で書くと `.sn` 側で 0 byte のスロットになって行の形を壊し（生成器の注記）、
 * 空の綴りなら形は保てる（冒頭の注記）が、そのとき欄の名前は「何番目の指令か」になって
 * 軸（何で分かれるか）を言わない。揃わない表は実行時の鍵で引けないので、**指令は指令の表を
 * 持つべきで、命令の表に混ぜない**。
 */
export const NOT_AN_INSTRUCTION = {
  newline: "字句・構造（行の区切り）であって演算ではない",
  export_internal: "命令ではなく指令（`.global` + `.hidden`）——pass4 の `symbolDirectives`",
  export_external: "命令ではなく指令（`.global`）——同上",
  export_pin: "命令ではなく指令（`.global` + `.section .sign.pinned,\"ax\",%progbits`）——同上",
  define: "束縛。名前はラベルになるが、綴りが命令へ化ける場所は無い",
  lambda: "関数そのもの。プロローグ／エピローグは `wrapFrame` が作るもので、綴りとは関係が無い",
  get_at: "pass2 が `'` へ書き換える（`x @ p` → `p ' x`）ので pass4 に節が無い。命令列は `'` の行が持つ",
  import: "コンパイル時に済む。pass4 は中身をそのまま出す",
  block_paren: "中身をそのまま出す（`(a+1)` と `{a+1}` は同一のアセンブリ）",
  block_brace: "同上",
  block_bracket: "同上。器を作るのは中の余積・積であって、括りではない（`[x] ≅ x`）",
  indent: "字句・構造（ブロックの深さ）",
  escape: "字句。`\\a` は文字リテラルそのもの（`mov x0, #97`）",
};

export function getStrictInfixOperators() {
  const strictInfix = [];
  for (const [symbol, defs] of Object.entries(OPERATOR_DICT)) {
    // `|` / `||` は囲みにもなる（絶対値・ノルム）ので、中置と決めつけて空白を入れない。
    // 前後へ空白を入れると、`|5|` や `||xs||` が `| 5 |` `|| xs ||` になって囲みが壊れる
    // ——**囲みか中置かは空白の位置が決める**ので、レキサーが空白を足してはいけない。
    if (symbol === ' ' || symbol === '|' || symbol === '||') continue;
    const positions = new Set(defs.map(d => d.position));
    if (positions.size === 1 && positions.has('infix')) {
      strictInfix.push(symbol);
    }
  }
  return strictInfix;
}

export function buildLexerRegex() {
  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const strictInfix = getStrictInfixOperators();
  strictInfix.sort((a, b) => b.length - a.length);
  const infixPattern = strictInfix.map(escapeRegExp).join('|');
  // 【修正済み】ダブルクォート文字列の内側 `(\\.|[^"\r\n])*` が捕捉グループのままだと、
  // 呼び出し側（lexer.jsのseparateInfix）が想定する「1番目=protect、2番目=operator」という
  // グループ番号が1つずれてしまい、operator側が常にundefinedになる（strictInfixによる
  // 演算子前後への自動スペース挿入が事実上一切機能しなくなる）バグがあった。
  // 非捕捉グループ `(?:...)` に変更して解消。
  // 文字リテラルの `\` は直後の1文字を取る——文字の改行（LF）も含めて（preprocessor.md §0）。`.` は LF を
  // 取らないので、`\` + LF の組が守られず、`\` だけが残っていた。
  const regexStr = `(\`[^\`\\r\\n]*\`|\`[^\\r\\n]*|"(?:\\\\.|[^"\\r\\n])*"|\\\\[\\s\\S]|!!)|(${infixPattern})`;
  return new RegExp(regexStr, 'g');
}
