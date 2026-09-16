// Sign のコードを裸の AArch64 で走らせるための最小の入口。
//
// `-M virt` の RAM は 0x40000000 から。UART（PL011）は 0x9000000 に居るので、
// 返値をそこへ16進で書き出してから semihosting で抜ける。OS は要らない——
// Sign が最終的に降りていく先がここなので、確かめる場所もここでよい。
//
// ## 踏み抜きを名指しで報告する
//
// スタックは image の下に置いてあり（link.ld）、使い切ると RAM の外へ出て外部
// アボートになる。何もしなければ VBAR は 0 のままで、0 番地の未定義命令を踏んで
// 永久に回る——呼ぶ側からは**時間切れ**としか見えない。実測で 6〜20 秒。
// そこで表を1枚立てておき、落ちた理由を1行流して抜ける（実測 0.2 秒）。
//
// 表だけでは足りない。踏み抜きは**疎**で、`sub sp, sp, xN` で飛び越した先の数語しか
// 書かないことがある。sp が限界を割っても、たまたま一度も未実装の番地へ触らずに
// 戻ってくる経路があるということである。そのため限界に番人を 16 語敷き、戻ってきた
// ところで見る（"STKSMASH"）。
	.text
	.global _start
_start:
	// 例外の受け口を立てる。これが無いと踏み抜きは「止まらない」としか見えない。
	adrp x0, vectors
	add x0, x0, :lo12:vectors
	msr vbar_el1, x0
	isb
	ldr x0, =_stack_top
	mov sp, x0
	// 限界に番人を敷く。16語＝128B は、生成される素の枠の最大（96B）より広い。
	ldr x0, =_stack_limit
	ldr x1, =0xC0DEC0DEC0DEC0DE
	mov x2, #16
1:	str x1, [x0], #8
	subs x2, x2, #1
	b.ne 1b
	bl _sign_main
	mov x20, x0
	mov x21, x1
	mov x22, x2
	mov x23, x3
	// 番人が生きているか。落ちずに戻ってきた踏み抜きはここで捕まる。
	ldr x4, =_stack_limit
	ldr x5, =0xC0DEC0DEC0DEC0DE
	mov x6, #16
1:	ldr x7, [x4], #8
	cmp x7, x5
	b.ne .Lsmashed
	subs x6, x6, #1
	b.ne 1b
	mov x0, x20
	bl put_hex
	mov x0, x21
	bl put_hex
	mov x0, x22
	bl put_hex
	mov x0, x23
	bl put_hex
	b .Lhalt

// 番人が消えていた——sp は限界を割ったが、未実装の番地には触れずに戻ってきた。
.Lsmashed:
	ldr x0, =0x53544B534D415348	// "STKSMASH"
	bl put_hex
	b .Lhalt

// 同期例外の受け口。スタックは使えないので、レジスタだけで合図を流して抜ける。
// 触ろうとした番地がスタックの限界より下なら踏み抜き、そうでなければそれ以外の例外。
.Lfault:
	mrs x1, far_el1
	ldr x2, =_stack_limit
	cmp x1, x2
	ldr x0, =0x53544B4F56464C54	// "STKOVFLT"（スタックを踏み抜いた）
	ldr x3, =0x5349474E46414C54	// "SIGNFALT"（それ以外の同期例外）
	csel x0, x0, x3, lo
	bl put_hex
	mrs x0, far_el1
	bl put_hex
	mrs x0, esr_el1
	bl put_hex
	mrs x0, elr_el1
	bl put_hex

.Lhalt:
	// semihosting で終了する。x1 は {理由, 終了コード} の組。
	adrp x1, .Lexit
	add x1, x1, :lo12:.Lexit
	mov x0, #0x18
	hlt #0xF000
1:	b 1b

// x0 を16進16桁＋改行で UART へ流す。**スタックを使わない**——踏み抜いた後にも
// ここを通るため。
put_hex:
	mov x2, #0x9000000
	mov x3, #60
1:	lsr x4, x0, x3
	and x4, x4, #0xf
	cmp x4, #10
	add x5, x4, #48
	add x6, x4, #87
	csel x5, x5, x6, lo
	str w5, [x2]
	subs x3, x3, #4
	b.pl 1b
	mov w5, #10
	str w5, [x2]
	ret

	// 例外ベクタ表。1枠 128B × 8。SPSel=1 なので実際に使われるのは
	// 「Current EL, SPx」の4枠だが、全部同じ受け口へ送る。
	.balign 2048
vectors:
	.balign 128
	b .Lfault		// Current EL, SP0, Synchronous
	.balign 128
	b .Lfault		// Current EL, SP0, IRQ
	.balign 128
	b .Lfault		// Current EL, SP0, FIQ
	.balign 128
	b .Lfault		// Current EL, SP0, SError
	.balign 128
	b .Lfault		// Current EL, SPx, Synchronous
	.balign 128
	b .Lfault		// Current EL, SPx, IRQ
	.balign 128
	b .Lfault		// Current EL, SPx, FIQ
	.balign 128
	b .Lfault		// Current EL, SPx, SError

	.section .rodata
	.balign 8
.Lexit:
	.quad 0x20026        // ADP_Stopped_ApplicationExit
	.quad 0
