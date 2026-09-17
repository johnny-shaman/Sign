/* Sign のプログラムを `-M virt` の裸の AArch64 へ置く配置図。
 *
 * ## スタックは image の「下」に置く——伸びる先を、プログラム自身から外す
 *
 * 以前はスタックを image の**直後**に積み（`. = . + 0x10000; _stack_top = .`）、
 * そこから下へ伸ばしていた。伸びる先が `.rodata` と `.text`——つまり**プログラム自身**
 * である。Sign にはループが無く再帰しか無いので、素直に書いたコードほど深く積む。
 * `preprocess.sn` は入力1文字あたり 50 バイトを使うため、1300 文字で 64KiB を使い切り、
 * そこから先は**自分の命令列を書き換えながら走る**。実測では 1300 文字で `.rodata` が
 * 壊れているのに答えは正しく、1400 文字で入力長を返し（誤答）、1425 文字で止まらなくなり、
 * 1500 文字では `.text` が壊れているのに答えが正しい。診断は1件も出ない。
 *
 * なので**踏み抜いた先が未実装の番地になる**ように置き直す。スタックは RAM の下端
 * （0x40000000）から始まり、image はその上に載る。スタックは image 基底から下へ伸び、
 * 使い切ると 0x40000000 より下——`-M virt` では PCIe ECAM の窓——へ出て外部アボートを
 * 起こす。image には**どうやっても届かない**。start.s の例外ベクタがそれを名指しで
 * 報告する（"STKOVFLT"）。
 *
 * RAM の上へ置く案（`_stack_top` を 0x48000000 にする）は、踏み抜いても 120MiB の
 * 空き RAM を静かに歩くだけで落ちない。image に届かないという点だけ見れば同じだが、
 * **黙って走り続ける**ので今回の壊れ方と同じ性質である。採らない。
 *
 * ## 大きさは呼ぶ側が決める
 *
 * `--defsym=__stack_size=<bytes>` で渡す。省略時は 16MiB。`__ram_size` も同様に
 * 渡せる（qemu の `-m` に合わせる）——image が RAM の外へ出る配置は、黙って起動
 * しないのではなく**リンクで落とす**。
 */
ENTRY(_start)

/* `-M virt` の RAM は 0x40000000 から。`-m` を省いたときの大きさは 128MiB。 */
_ram_base   = 0x40000000;
_ram_size   = DEFINED(__ram_size)   ? __ram_size   : 0x8000000;
_stack_size = DEFINED(__stack_size) ? __stack_size : 0x1000000;

SECTIONS {
	/* スタックの領域は [_stack_limit, _stack_top)。sp は _stack_top から下へ伸び、
	   _stack_limit（＝RAM の下端）を割ると RAM の外に出る。 */
	_stack_limit = _ram_base;
	_stack_top   = _ram_base + _stack_size;

	. = _stack_top;
	.text  : { *(.text*) }
	/* ### (Pin) が出す固定配置セクション。本来は option.ms の `base` が住所を決める
	   （system_architecture.md §2.2）——ここは検証用なので .text の直後に置くだけ。
	 *
	 * **3本を1本へ束ねてはいけない。** `*(.sign.pinned*)` の1行で受けると、出力節の
	 * 属性は入力の OR になる——実測で `Flags [ (0x7) SHF_ALLOC, SHF_EXECINSTR, SHF_WRITE`。
	 * アセンブラまでは "ax" / "a" / "aw" に分かれているのに、リンクで消える（W^X も消える）。
	 * 名前で分けた以上、受ける側も分ける。 */
	.sign.pinned        : { *(.sign.pinned) }
	.sign.pinned.rodata : { *(.sign.pinned.rodata) }
	.sign.pinned.data   : { *(.sign.pinned.data) }
	.rodata : { *(.rodata*) }
	.data  : { *(.data*) }
	.bss   : { *(.bss*) }
	. = ALIGN(16);
	_image_end = .;

	/* sp は 16 の倍数でなければならない。 */
	ASSERT((_stack_size & 0xf) == 0, "スタックの大きさは16の倍数で渡すこと")
	/* start.s が限界に敷く番人（16語＝128B）より狭いスタックは意味を持たない。 */
	ASSERT(_stack_size >= 0x1000, "スタックが狭すぎる（最低 4KiB）")
	/* image が RAM の外へ出ると qemu は黙って起動しない。ここで落とす。 */
	ASSERT(_image_end <= _ram_base + _ram_size, "スタックが大きすぎて image が RAM の外へ出る（__stack_size を減らすか -m を増やす）")
}
