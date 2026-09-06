/**
 * Pass 4（AArch64 コード生成）の動作確認。
 *
 * `compiler_pipeline.md` §3 が定める Pass 4 の責務は「固定幅レジスタ操作とジャンプ命令
 * テンプレートの選択のみ」である。したがってここで固定するのは**どの命令が選ばれるか**と
 * **値がどこに置かれるか**であって、最適化の質ではない。
 *
 * 手元にアセンブラが無いため、出力は組み立てずにテキストとして検証する。命令列を読んで
 * 確かめられることは原理1（ソースを読めば命令列が読める）がそもそも要求している性質なので、
 * これは妥協ではなく本来の観測手段でもある。
 *
 * 実行: node test/pass4.test.js（`npm test` からも呼ばれる）
 */
import { compile } from "../compile.js";
import { generateAsm } from "../pass4.js";

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

function checkTrue(note, cond, detail) {
	total++;
	if (cond) {
		console.log(`OK   ${note}`);
		passed++;
	} else {
		console.log(`FAIL ${note}`);
		if (detail) console.log(`     ${detail}`);
	}
}

// **既定では割り当てを切って読む。**
//
// ここの検査が語っているのは `genExpr` の決めごと——どの命令を選ぶか、器を何本で受けるか、
// 要素を何 byte で読むか——であって、その値がフレームに置かれるかレジスタに残るかではない。
// `slotsToRegisters` を入れた日に28本が落ちたが、落ちた理由は全部「値の居場所が変わった」
// だけだった。パスが違うものを同じ本文で読もうとしていたのが誤りなので、切って読む。
//
// 割り当てそのものは `regAlloc: true` で呼ぶ検査（下）と、qemu の403本が見ている。
function asm(source, target = "aarch64_qemu", regAlloc = false) {
	const { nodes, env } = compile(source);
	return generateAsm(nodes, env, { target, regAlloc });
}

// ラベル1つ分の本文を、コメントを落とした命令の並びとして取り出す。
function body(source, label, regAlloc = false) {
	const r = asm(source, "aarch64_qemu", regAlloc);
	const lines = r.text.split("\n");
	const i = lines.findIndex((l) => l.startsWith(`${label}:`));
	if (i < 0) return null;
	const j = lines.findIndex((l, k) => k > i && l === "");
	return lines
		.slice(i + 1, j < 0 ? undefined : j)
		.map((l) => l.replace(/\/\/.*$/, "").trim())
		.filter(Boolean);
}

// ---- 命令の選択 ----
//
// 型は「使い捨ての帳簿」として消費される（§3）。`Int` は符号ありなので除算は `sdiv`
// である（target_info.js の SIGNEDNESS）。ここで型の名前が命令に化けて、以降どこにも
// 残らない。
// **見るのは選ばれた命令と、組み合わせる2本である。** 結果をどの register へ置くかは
// 見ない——完全性公理を `csel` で足したとき置き先が変わったが、型が命令に化けるという
// ここの主題は何も動いていない。
const arith = (src, mn) =>
	body(src, "f")
		.filter((l) => l.startsWith(mn + " "))
		.map((l) => l.replace(/^(\w+)\s+x\d+,/, "$1"));
check("加算は add", arith("f : a ? a + 1\nf 1", "add"), ["add x9, x10"]);
check("減算は sub", arith("f : a ? a - 1\nf 1", "sub"), ["sub x9, x10"]);
check("乗算は mul", arith("f : a ? a * 2\nf 1", "mul"), ["mul x9, x10"]);
check("除算は sdiv（Int は符号あり）", arith("f : a ? a / 2\nf 1", "sdiv"), ["sdiv x9, x10"]);

// ---- AAPCS64 ----
//
// 引数は x0〜x7、返値は x0（stack_abi.md §4.2）。
{
	// 呼び出しの直前に並ぶロードが引数の積み込みである（末尾の「返値を x0 へ」と混ぜない）。
	// `g x x x` は末尾位置なので `b` になる（tco.md §6）。積み込みの順は変わらない。
	const ls = body("g : a b c ? a\nadd3 : x ? g x x x\nadd3 1", "add3");
	const call = ls.findIndex((l) => l === "b g");
	const loads = [];
	for (let k = call - 2; k >= 0 && /^ldr x[0-7],/.test(ls[k]); k--) loads.unshift(ls[k].split(",")[0]);
	check("引数は x0 から順に積む", loads, ["ldr x0", "ldr x1", "ldr x2"]);
}
// 末尾でない呼び出しは `bl` のままである——結果を使うので戻ってこなければならない。
checkTrue("末尾でない呼び出しは bl", (body("g : a ? a\nf : x ? (g x) + 1\nf 1", "f") || []).some((l) => l === "bl g"));
checkTrue("返値は x0 へ載せて ret", (body("f : a ? a + 1\nf 1", "f") || []).includes("ret"));

// ---- 式の途中の値はフレームに置く ----
//
// **`bl` は x0〜x7 も x9〜x15 も壊す。** 途中の値をレジスタに置いたままにすると、次の
// 呼び出しで消える——`add (sq n) (sq n)` は1つ目の結果も仮引数 `n` 自身も壊れていた。
//
// だから呼び出しを跨ぐ値は必ずフレームのスロットにある。ここで固定するのは
// 「レジスタに置きっぱなしにしない」という一点であって、命令数ではない。
{
	const src = "sq : x ? x * x\nadd : a b ? a + b\nf : n ? add (sq n) (sq n)\nf 3";
	const ls = body(src, "f");
	const firstCall = ls.findIndex((l) => l === "bl sq");
	const secondCall = ls.findIndex((l, k) => k > firstCall && l === "bl sq");
	const between = ls.slice(firstCall, secondCall);
	// 1つ目の結果は2つ目の呼び出しの前にストアされている。
	checkTrue("呼び出しの結果はスロットへ退避する", between.some((l) => l.startsWith("str x0,")), between.join(" / "));
	// 2つ目の引数は x0 からではなくスロットから読む（x0 は既に潰れている）。
	checkTrue(
		"仮引数は呼び出しの後もスロットから読む",
		between.some((l) => l.startsWith("ldr x9, [x29,")),
		between.join(" / ")
	);
}
// 仮引数は入口で退避される。引数レジスタは最初の呼び出しで壊れるからである。
//
// **並びが意味を持つ。** フレーム確保 → 飛び先 → 仮引数の退避 → 完全性公理の検査、の順で
// なければならない。飛び先が検査より後ろに来ると、末尾自己再帰でフレームを使い回した
// ときに検査が初回しか通らず、終端が消える。
{
	const ls = body("f : a b ? a + b\nf 1 2", "f");
	const at = (re) => ls.findIndex((l) => re.test(l));
	const frame = at(/^stp x29/);
	const loop = at(/^\.Lloop/);
	const save = at(/^str x0, \[x29,/);
	const test = at(/^b\.eq \.Lunit/);
	checkTrue("フレーム確保は飛び先の外", frame >= 0 && frame < loop, ls.join(" / "));
	checkTrue("仮引数を入口でスロットへ写す", loop < save, ls.join(" / "));
	checkTrue("完全性公理の検査は飛び先の中", loop < test && save < test, ls.join(" / "));
}

// ---- フレーム ----
//
// AArch64 のスタックは16バイト境界を要求する。大きさは式の深さで決まるので、本体を
// 出してみるまで分からない——だから本文を先に作って後から包む。
{
	const ls = body("f : a ? a + 1\nf 1", "f");
	const open = ls.find((l) => l.startsWith("stp x29, x30"));
	const size = Number((open.match(/#-(\d+)/) || [])[1]);
	checkTrue("フレームは16の倍数", size % 16 === 0, `size=${size}`);
	checkTrue("閉じる大きさが開く大きさと一致する", ls.some((l) => l === `ldp x29, x30, [sp], #${size}`));
}


// ---- 分岐（match_case） ----
//
// **`__` の判定は niche との比較であり、`cbz` ではない。** Sign では `0` は真であり、
// `0 = 0` は真で `0` を返す（comparison.md §2.1）ので、0 を偽と読むと評価器と食い違う。
// niche は `0x8000000000000000`（value_representation.md §3.5）——`Int` では `INT_MIN`、
// `Address` では AArch64 の非正準領域で、どちらも有効な値になりえない点である。
{
	const ls = body("f : x ?\n\tx > 3 : 1\n\t2\nf 5", "f");
	checkTrue("条件は niche と比べる（cbz ではない）", ls.some((l) => l === "movz x12, #0x8000, lsl #48"));
	checkTrue("__ なら次の枝へ飛ぶ", ls.some((l) => /^b\.eq \.Larm/.test(l)));
	checkTrue("枝を通ったら末尾へ飛ぶ", ls.some((l) => /^b \.Lend/.test(l)));
	checkTrue("どの枝も同じスロットへ書く", ls.filter((l) => /^str x9, \[x29, #24\]$/.test(l)).length >= 2, ls.join(" / "));
}
// 比較は値を返す。真ならオペランド、偽なら `__`。どちらのオペランドかは**左辺の値**が
// 決めるので（0 か 1 なら右辺）、実行時に見る必要がある——`csel` を2段重ねる。
{
	const ls = body("f : x ? x > 3\nf 5", "f");
	checkTrue("左辺が単位元かを見る", ls.some((l) => l === "cmp x9, #0") && ls.some((l) => /^ccmp x9, #1, #4, ne$/.test(l)));
	checkTrue("単位元なら右辺を候補にする", ls.some((l) => l === "csel x11, x10, x9, eq"));
	checkTrue("真なら候補、偽なら __", ls.some((l) => l === "csel x9, x11, x12, gt"));
}
check("比較の条件コード", body("f : a ? a < 3\nf 1", "f").filter((l) => /^csel x9, x11, x12,/.test(l)), [
	"csel x9, x11, x12, lt",
]);
// 再帰は分岐があって初めて書ける（Sign にはループが無い）。
check("再帰が出せる", asm("fact : n ?\n\tn > 1 : n * (fact (n - 1))\n\t1\nfact 5").diagnostics.length, 0);
check(
	"相互再帰も出せる",
	asm("even : n ?\n\tn = 0 : 1\n\todd (n - 1)\nodd : n ?\n\tn = 0 : 0\n\teven (n - 1)\neven 4").diagnostics.length,
	0
);
check("枝が1つでも分岐（尽きたら __）", asm("f : x ?\n\tx > 10 : 1\nf 7").diagnostics.length, 0);
// **`__` は幅を持たない。** 零対象なので、置く場所の広さに合わせて空を書く——1本なら
// niche、参照なら `len = 0` である。枝の値として置くときは合流先のスロットへ直接書くので
// （転送レジスタを1つ経由しない）、`x12` から出る。
checkTrue("__ は niche を積む", (body("f : x ?\n\tx > 3 : __\n\t1\nf 5", "f") || []).some((l) => l === "movz x12, #0x8000, lsl #48"));
// 器を返す枝と合流するなら `__` は空の参照である。**ここが「1本と2本」で落ちていた**
// ——型は既に `Unit` だと言っているのに、幅を1本に決め打ちしていた。
{
	const b2 = body("f : s ?\n\t(s ' 0) = ` ` : __\n\ts ' 1~\nf `ab`", "f") || [];
	checkTrue("器と合流する __ は空の参照", b2.includes("mov x12, #0"), b2.join(" / "));
	check("器と合流しても診断は出ない", asm("f : s ?\n\t(s ' 0) = ` ` : __\n\ts ' 1~\nf `ab`").diagnostics.length, 0);
}

// ---- `$匿名式` はその場に置いてアドレスを返す（alloca） ----
//
// 演算子表がそう言っている——「その場で生成された**オブジェクト本体のアドレス**を取得
// する。C++ の `&(new [](x){x})` に相当」。つまり確保の記法は最初から在った。置く先は
// 自分のスタックで、`sp` を下げれば1命令で場所が取れる——フリーリストも管理情報も要らない。
// **`alloca` であって `malloc` ではない**ので、返せないという制約もそのままである。
{
	const b = body("f : n ? @($(n + 1))\nf 1", "f");
	checkTrue("場所を取る", b.includes("sub sp, sp, #16"), b.join(" / "));
	// **どのレジスタに載るかは見ない。** $__ = __ を出すようになってから、アドレスは
	// 候補として別のレジスタへ載り csel で選ばれる。ここの主題は「sp から取る」ことで
	// あって、置き先ではない。
	checkTrue("そのアドレスを返す", b.some((l) => /^mov x\d+, sp$/.test(l)), b.join(" / "));
	// `sp` を動かしたら、戻すのは `x29` からである（`ldp` は sp が底のままを前提にしている）。
	checkTrue("sp を戻す", b.includes("mov sp, x29"), b.join(" / "));
	// 動かしていない関数には出さない——使っていない機能の代金を払わない。
	checkTrue("動かさなければ出さない", !body("f : n ? n + 1\nf 1", "f").includes("mov sp, x29"));
	// **積は `$` で場所を得る。** `h , t` はそれだけでは置き場所を持たない。
	const c = body("cons : h t ? $(h , t)\ncons 1 2", "cons");
	checkTrue("組は2語ぶん取る", c.includes("sub sp, sp, #16") && c.includes("str x9, [sp, #8]"), c.join(" / "));
	// `$__` は niche のまま（記憶が無いものにアドレスは無い）。場所は取らない。
	checkTrue("$__ は場所を取らない", !body("f : n ? @($__)\nf 1", "f").includes("sub sp"));
	// 名前付き識別子はフレームに在るので、そのアドレスでよい（新しい場所は要らない）。
	checkTrue("仮引数は場所を取らない", !body("f : n ? @($n)\nf 1", "f").includes("sub sp"));
}

// ---- 恒等射（`!__`）は値として運べる ----
//
// `Identity` は Layer 1 の射だが、**呼ぶのではなく運ぶ**ぶんには GPR 1本である。機械の
// 上で恒等射に対してやることは「`__` かどうか見る」しかなく、Sign では `0` が真なので、
// 置くのは `0` でよい。単相化とは衝突しない（跳び先の話ではない）。
{
	checkTrue("!__ は 0 を置く", body("f : n ? !__\nf 1", "f").includes("mov x9, #0"));
	check("恒等射を返す枝は出る", asm("f : n ?\n\tn > 3 : !__\n\t__\nf 5").diagnostics.length, 0);
	// `!値` は niche を見て反転する。中身ではなく不在かどうかを見ている。
	const bn = body("f : n ? !n\nf 5", "f");
	checkTrue("!値 は niche を見る", bn.includes("csel x9, x9, x12, eq"), bn.join(" / "));
	// 器でも同じ規則で見る（幅ごとに判定が違うだけ）。
	check("器の否定も出る", asm("f : s ? !s\nf `ab`").diagnostics.length, 0);
}

// **裸の文字列リテラルはコメントである**（string_and_comment.md）。命令は出ないし、
// 診断にもしない——コメントの数だけ「出せない」が並ぶと本当の穴が埋もれる。
check("コメントは診断にならない", asm("`これはコメント`\nf : a ? a + 1\nf 1").diagnostics.length, 0);


// ---- 単相化（compiler_pipeline.md §3 の IMPORTANT） ----
//
// `@p x` は「どこへ跳ぶか」が実行時にしか分からない形だが、Sign はそこへ実行時
// ディスパッチを置かない——**呼び出しサイト単位で具体化する**。Rust の単相化と同じで、
// `dyn` の側は採らない。
//
// 具体化すると**関数ポインタの引数は消える**。アドレスが命令へ焼き込まれるので、
// レジスタで運ぶ必要が無くなる——`stack_abi.md` の比較表が Sign の欄に
// 「コンパイル時特殊化（コストゼロ）」と書いているのはこのことである。
{
	const src =
		"is_digit : c ? c + 0\nis_alpha : c ? c + 1\ntake_while : p s ? @p s\n" +
		"f : s ? take_while $is_digit s\ng : s ? take_while $is_alpha s\nf 1\ng 2";
	const r = asm(src);
	checkTrue("呼ばれた組み合わせのぶんだけ実体が出る", r.text.includes("take_while$is_digit:") && r.text.includes("take_while$is_alpha:"));
	checkTrue("多相なままの実体は出ない", !r.text.includes("\ntake_while:"));
	// 実体の中では `@p` が直接の呼び先になる（ここでは末尾位置なので `b`）。
	checkTrue("`@p` は直接の呼び先になる", (body(src, "take_while$is_digit") || []).includes("b is_digit"));
	checkTrue("別の実体は別の呼び先", (body(src, "take_while$is_alpha") || []).includes("b is_alpha"));
	// 呼び出し側では関数ポインタを渡さない。引数は s だけ。
	// **立つ引数レジスタの数を見る。** `s` だけなら x0 の1本、関数ポインタも渡すなら
	// 2本になる——それが「消える」の中身である。**載せ方は見ない**：スロットから
	// `ldr` するか直前の値を `mov` で渡すかは覗き穴が決めることで、渡すものの数は
	// それで変わらない。以前ここは `ldr x0` という*形*を数えていて、往復を畳んだ
	// だけで落ちた。
	const ls = body(src, "f");
	const call = ls.findIndex((l) => l === "b take_while$is_digit");
	checkTrue("具体化した実体へ直接飛ぶ", call >= 0);
	const argRegs = new Set();
	for (let k = 0; k < call; k++) {
		const m = /^(?:mov|movz|movn|ldr|add|sub|orr)\s+(x[0-7]),/.exec(ls[k]);
		if (m) argRegs.add(m[1]);
	}
	check("関数ポインタは引数として渡らない", [...argRegs].sort(), ["x0"]);
	check("診断は出ない", r.diagnostics.length, 0);
}
// `$名前` 以外では具体化できない。式で作ったアドレスは静的に決まらない。
checkTrue(
	"式で作ったアドレスは名指しする",
	asm("g : x ? x\ntake_while : p s ? @p s\nf : s ? take_while (g 1) s\nf 1").diagnostics.length > 0
);


// ---- 文字は符号位置というスカラー ----
//
// `String ≅ List(0u)`（§2）であり、1要素のリストはスカラーと同型（`[5]` は `Int`）。
// したがって**1文字の文字列は符号位置そのもの**であり、レジスタに乗る。
// `is_digit : c ? \0 <= c <= \9` が `cmp` で書けるのはこれが理由である。
checkTrue("文字リテラルは符号位置", (body("f : x ? x\nf \\a", "f") || []) && asm("c : \\a\nf : x ? x\nf c").diagnostics.length === 0);
check("文字の比較は診断なし", asm("f : c ? c = \\0\nf \\5").diagnostics.length, 0);
// **比較は同種同士でしか成立しない**ので、片側が1文字ならもう片側も文字である
// ——レンジの端点が「両端とも点」であるのと同じ形の推論。仮引数のように中身が
// 見えない側もここで決まる。
checkTrue("片側が文字なら相手も文字として比べる", (body("f : c ? c = \\0\nf \\5", "f") || []).some((l) => l.startsWith("cmp ")));
// 連鎖比較は範囲判定の書き方そのもの。真のとき返るのは**必ず中央**である
// （二項と違い 0/1 の規則は効かない）。
{
	const ls = body("is_digit : c ? \\0 <= c <= \\9\nis_digit \\5", "is_digit");
	check("連鎖比較は診断なし", asm("is_digit : c ? \\0 <= c <= \\9\nis_digit \\5").diagnostics.length, 0);
	// **boolean を作らないこと**が守りたい性質である。値と真偽が同じ対象なので、
	// `cset` で1ビットを起こして `and` してまた値へ戻す必要が無い——`csel` で中央か
	// `__` を直接選ぶ。以前ここは `and x11, x11, x13` という*形*を数えていて、
	// 条件の繋ぎ方を変えただけで落ちた。
	checkTrue("boolean を作らない（cset を出さない）", !ls.some((l) => l.startsWith("cset ")), ls.join(" / "));
	checkTrue("真なら中央、偽なら __ を選ぶ", ls.some((l) => /^csel x\d+, x\d+, x12, \w+$/.test(l)), ls.join(" / "));
	// 両端が定数なら符号なしの範囲検査に畳む——比較は1つで済む。
	// 数えるのは**即値との比較**だけである。入口の完全性検査（`cmp x9, x12`）も `cmp`
	// なので、そちらまで数えると畳めていても 2 になる。
	checkTrue("定数の両端は比較1つに畳む", ls.filter((l) => /^cmp x\d+, #\d+$/.test(l)).length === 1, ls.join(" / "));
}
// ---- ブラケット分割代入 `[h ~t]` ----
//
// **コピーは起きない。** 要素の並びは `{ptr, len}` で渡ってくる（stack_abi.md §4.6）ので、
// 先頭は指す先の1要素、残りは**同じ領域を指したまま ptr を1要素進めて len を1減らしたもの**
// である。`t` のスロットは容器のスロットをそのまま使い回す。
{
	const src = "conflict : col d [h ~t] ?\n\th = col : 1\n\tconflict col (d + 1) t\nconflict 1 1 [1 2 3]";
	const ls = body(src, "conflict");
	// 検査が先、取り出しが後。空の容器から先頭を読むと指す先の外を触る。
	const test = ls.findIndex((l, i) => /^b\.eq \.Lunit/.test(l) && ls[i - 1] === "cmp x9, #0");
	const load = ls.findIndex((l) => l === "ldr x10, [x9]");
	checkTrue("検査してから先頭を読む", test >= 0 && test < load, ls.join(" / "));
	// `List(Int)` の要素は 8 byte。
	checkTrue("要素の幅ぶん進める", ls.some((l) => l === "add x9, x9, #8"), ls.join(" / "));
	// 残りは長さを1減らすだけ。0 になれば `__` そのものなので、次の呼び出しが崩壊する
	// ——これが終端である（function_guide.md「ブラケット分解でなければ完全性公理が
	// 終端を与えられない」）。
	checkTrue("残りは長さを1減らす", ls.some((l) => l === "sub x10, x10, #1"), ls.join(" / "));
	checkTrue("容器を作り直さない", !ls.some((l) => /^(bl|b) (malloc|_sign_alloc)/.test(l)), ls.join(" / "));
}
// 要素の幅は型が言う。`String` の要素は `charset` 幅（既定の ascii なら 1 byte）で、
// `List(Int)` の 8 byte とは別の命令になる。
{
	const ls = body("f : [c ~rest] ?\n\tc = 0u61 : 1\n\tf rest\nf `abc`", "f");
	checkTrue("String の要素は 1 byte で読む", ls.some((l) => l === "ldrb w10, [x9]"), ls.join(" / "));
	checkTrue("String は 1 byte ぶん進める", ls.some((l) => l === "add x9, x9, #1"), ls.join(" / "));
}
// 仮引数リスト全体がブラケットでも、混在形でも同じ形として扱う（書かれ方が違うだけ）。
{
	const lone = body("f : [c ~rest] ?\n\tc = 0u61 : 1\n\tf rest\nf `abc`", "f");
	const mixed = body("g : a [c ~rest] ?\n\tc = 0u61 : a\n\tg a rest\ng 1 `abc`", "g");
	checkTrue("単独ブラケットも分解する", lone.some((l) => l === "ldrb w10, [x9]"), lone.join(" / "));
	checkTrue("混在形も分解する", mixed.some((l) => l === "ldrb w10, [x9]"), mixed.join(" / "));
}
// **`[~x]` は切り出さず丸ごと受ける形である**（n_queens.sn「分解の形には2つある」）。
// 受け取り方は裸の仮引数と同じ1つの値であり、違うのは型の宣言の方——器であることを
// 言っているので `__` がそこを通れない。それは Pass 3 の仕事なので、機械の上ですることは
// 裸の仮引数と変わらない（分解の命令は出ない）。
{
	const mixed = "f : n [~xs] ?\n\tn = 0 : 9\n\tf (n - 1) xs\nf 2 `abc`";
	check("混在形の `[~x]` は出る", asm(mixed).diagnostics.length, 0);
	const ls = body(mixed, "f");
	checkTrue("器は2本で受ける", ls.some((l) => l === "str x1, [x29, #24]") && ls.some((l) => l === "str x2, [x29, #32]"), ls.join(" / "));
	checkTrue("分解の命令は出ない", !ls.some((l) => l === "add x9, x9, #1"), ls.join(" / "));
	// 単独ブラケットも同じ形として扱う（書かれ方が違うだけ）。
	// 単独ブラケットだけの関数は、器の**要素型**を語る証拠がどこにも無いので添字は引けない
	// （宣言が言うのは「器である」までで、何の器かは言っていない）。受け取り自体は出る。
	check("単独の `[~x]` も出る", asm("f : [~xs] ?\n\t9\nf `abc`").diagnostics.length, 0);
}
// **ストリーム形（`x ~xs`）は、実体化された器が渡る限り器形と同じ機械である。**
//
// 違うのは laziness——`~xs` は残りを包む遅延ストリームとしてサスペンドされる
// （list_model.md §2.4①）——であって、渡ってくるのが `l~` のように実体化された
// `{ptr, len}` なら、頭を読んで ptr を進め len を1減らす操作は変わらない。
// サスペンドが効くのは相手が生成器のときだけで、そちらはカーソルの道である。
{
	check("ストリーム形は出る", asm("f : x ~xs ? x\nl : [1 2 3]\nf l~").diagnostics.length, 0);
	// `~` 無しの List 渡しは §5.4 が禁じている（構文の側で弾かれる）ので、ここへは来ない。
	const ls = body("f : x ~xs ? x\nl : [1 2 3]\nf l~", "f") || [];
	checkTrue("頭を読んで ptr を進める", ls.some((l) => /^add x\d+, x\d+, #8$/.test(l)), ls.join(" / "));
	checkTrue("残りの長さを1減らす", ls.some((l) => /^sub x\d+, x\d+, #1$/.test(l)), ls.join(" / "));
}
// ---- デフォルト引数 ----
//
// **検査・デフォルトの充填・分解は宣言順に混ぜて出す。** 評価器が仮引数を1つずつ順に
// 見るのと同じ順序でなければならない——デフォルト式は前の仮引数を参照でき（`let*`）、
// かつ Input（前置 `@`）を含みうるので、**どの順で何回読むかが観測できる**。
{
	const src = "f :\n\tn\n\tas : 7\n?\n\tn + as\nf 3";
	const r = asm(src);
	check("デフォルト付きは出る", r.diagnostics.length, 0);
	const ls = body(src, "f");
	// 渡されていれば（`__` でなければ）そのまま。渡されていなければ埋める。
	checkTrue("渡されたかを見る", ls.some((l) => /^b\.ne \.Lhave/.test(l)), ls.join(" / "));
	checkTrue("埋める値はデフォルト式", ls.some((l) => l === "mov x9, #7"), ls.join(" / "));
	// **デフォルトを持つ仮引数は完全性公理の対象外。** `as` の検査は `b.eq .Lunit` にならない。
	check("公理の検査は n の分だけ", ls.filter((l) => /^b\.eq \.Lunit/.test(l)).length, 1);
	// **省略された引数には呼ぶ側が `__` を置く。** AAPCS64 は使わないレジスタを初期化
	// しないので、伝えないと前の呼び出しの残骸をデフォルトの判定に使うことになる。
	const main = body(src, "_sign_main");
	checkTrue("呼ぶ側が __ を置く", main.some((l) => l === "movz x1, #0x8000, lsl #48"), main.join(" / "));
	// 全部渡せば埋めない。
	checkTrue("全部渡せば埋めない", !body("f :\n\tn\n\tas : 7\n?\n\tn + as\nf 3 5", "_sign_main").some((l) => /^movz x1,/.test(l)));
}
// デフォルト式は前の仮引数を読める（`let*`）。
{
	const ls = body("f :\n\tn\n\ta : n + 1\n?\n\tn + a\nf 3", "f");
	// 前の仮引数と足し合わせている（置き先は問わない）。
	checkTrue("前の仮引数を読む", ls.some((l) => /^add x\d+, x9, x10$/.test(l)), ls.join(" / "));
}
// **`: __` のデフォルトは命令ゼロである。** 埋めるのは値が `__` のときだけなので、そこへ
// `__` を置いても何も変わらない。宣言の内容は「この引数について完全性公理を働かせない」
// の一点であり、検査を飛ばせば足りる——定義域の持ち上げは機械の上では何も無い。
{
	const src = "f :\n\tn\n\ts : __\n?\n\tn + 1\nf 3 5";
	const ls = body(src, "f");
	check("公理の検査は n の分だけ", ls.filter((l) => /^b\.eq \.Lunit/.test(l)).length, 1);
	checkTrue("埋める命令は出ない", !ls.some((l) => /^b\.ne \.Lhave/.test(l)), ls.join(" / "));
}
// ---- 末尾呼び出し最適化（tco.md） ----
//
// **これは最適化ではなく言語仕様としての保証である**（tco.md §6）。Sign にループは
// 無いので、`bl` のままだと再帰の深さがそのままスタックの深さになる。
{
	const src = "down : n acc ?\n\tn = 0 : acc\n\tdown (n - 1) (acc + 1)\ndown 5 0";
	const ls = body(src, "down");
	// 自己末尾再帰はフレームを使い回す——`bl` も `ldp` も出さずに飛び先へ戻るだけ。
	checkTrue("自己末尾再帰は飛び先へ戻る", ls.some((l) => /^b \.Lloop/.test(l)), ls.join(" / "));
	checkTrue("自己末尾再帰に bl は出ない", !ls.some((l) => l.startsWith("bl ")), ls.join(" / "));
	// **飛び先は仮引数の写しより前。** 後ろだと完全性公理の検査が初回しか通らない。
	const loop = ls.findIndex((l) => /^\.Lloop/.test(l));
	const back = ls.findIndex((l) => /^b \.Lloop/.test(l));
	const test = ls.findIndex((l) => /^b\.eq \.Lunit/.test(l));
	checkTrue("飛び先は検査より前", loop < test && test < back, ls.join(" / "));
	// 新しい引数は飛ぶ前に x0.. へ載っている（フレームはまだ生きている）。
	// **スロット番号は書かない。** それは生成の都合であって、ここで見たいのは「飛ぶ直前に
	// 引数がレジスタへ載っている」ことである（番号を書くと、置き場所を変える改良のたびに
	// 目的と関係なく落ちる——枝を合流スロットへ直に置く変更で実際に落ちた）。
	check(
		"引数を載せてから飛ぶ",
		ls.slice(back - 2, back).map((l) => l.replace(/#\d+/, "#N")),
		["ldr x0, [x29, #N]", "ldr x1, [x29, #N]"],
	);
}
// **枝は互いに排他なので、通らなかった枝で取った場所は畳めない理由にならない。**
//
// `$匿名式` は `sub sp` で場所を取るため、そのフレームは呼び先が走っている間も生きて
// いなければならない——末尾呼び出しでは畳めない。だが判定を**関数まるごと**で見ていた
// ので、別の枝に `$匿名式` があるだけで末尾自己再帰の枝まで `bl` になっていた。
// Sign にループは無く再帰しかないので、ここは深さがそのままスタックの深さになる。
{
	const tail = (src, fname = "f") => (body(src, fname) || []).map((l) => l.replace(/\/\/.*/, "").trim());
	// 別の枝で場所を取る——この枝は通らないので畳める。
	const other = tail("f : n ?\n\tn > 100 : ($(n + 1)) ' 0\n\tf (n + 1)\nf 0");
	checkTrue("別の枝の $匿名式は畳めない理由にならない", other.some((l) => /^b \.Lloop/.test(l)), other.join(" / "));
	// 末尾の枝そのものが場所を取るなら畳めない（呼び先が読む前に消える）。
	const here = tail("f : n ?\n\tn > 100 : n\n\tf (($(n + 1)) ' 0)\nf 0");
	checkTrue("末尾の枝で取ったら畳まない", here.some((l) => l === "bl f") && !here.some((l) => /^b \.Lloop/.test(l)), here.join(" / "));
	// **場所を取ったことは、畳めない理由ではない。** 理由になるのは、その場所への参照が
	// 呼び先へ渡ることである。条件で取っても、渡すのが数なら呼び先は触れない——`sp` を
	// `x29` から戻してから飛べばよい（エピローグがやっているのと同じことである）。
	// 戻さずに回すと毎周 `sub sp` が積み上がって伸び続けるので、そこが本当の条件である。
	const cond = tail("f : n ?\n\t(($(n + 1)) ' 0) > 100 : n\n\tf (n + 1)\nf 0");
	checkTrue("条件で取っても畳める", cond.some((l) => /^b \.Lloop/.test(l)), cond.join(" / "));
	checkTrue("畳む前に sp を戻す", cond.indexOf("mov sp, x29") < cond.findIndex((l) => /^b \.Lloop/.test(l)), cond.join(" / "));
	// 参照そのものが渡るなら畳まない（呼び先が読む前に捨ててしまう）。
	const ref = tail("f : n p ?\n\tn > 3 : (@p) ' 0\n\tf (n + 1) ($(n , n))\nf 0 ($(0 , 0))");
	checkTrue("参照が渡るなら畳まない", ref.some((l) => l === "bl f") && !ref.some((l) => /^b \.Lloop/.test(l)), ref.join(" / "));
	// **呼び先の引数域が自分より広ければ畳まない。** 畳んだ先の `sp` は自分が受け取った
	// 域であり、そこを超えて書くと呼び出し元の領分へはみ出す。
	const wide = tail(
		"g : a b c d e h i j k l m n o ?\n\ta > 5 : o\n\ta\n" +
			"f : a b c d e h i j k ?\n\ta > 5 : k\n\tg a b c d e h i j k 1 2 3 4\nf 0 1 2 3 4 5 6 7 8"
	);
	checkTrue("広い呼び先へは畳まない", wide.some((l) => l === "bl g") && !wide.some((l) => l === "b g"), wide.join(" / "));
}

// **構造体は名前で分ける。** 名前はコンパイル時にオフセットへ解決され Pass 4 には残らない
// ——入口ですることは固定オフセットからのロードだけである（function_guide.md の言う
// 「辞書の意味論を構造体のコストで得ている」がこの一点）。渡ってくるのは `{ptr}` 1本で、
// 構造体は形が型にあるので長さが要らない（stack_abi.md §4.6）。
{
	const ls = body("calc_diff : [foo bar ~obj] ? foo - bar\ncalc_diff [\n\tbar : 20\n\tfoo : 100\n]", "calc_diff") || [];
	// 受けるのは1本（`{ptr}`）。`len` は来ない。
	// 数えるのは**引数レジスタ**の退避だけ（本体の一時置き場と混ぜない）。
	checkTrue("構造体は ptr 1本で受ける", ls.filter((l) => /^str x[0-7], \[x29/.test(l)).length === 1, ls.join(" / "));
	// 名前は正規順（名前でソート）へ解決される——`bar` が +0、`foo` が +8。
	checkTrue("bar は +0 から読む", ls.some((l) => /^ldr x\d+, \[x\d+, #0\]$/.test(l)), ls.join(" / "));
	checkTrue("foo は +8 から読む", ls.some((l) => /^ldr x\d+, \[x\d+, #8\]$/.test(l)), ls.join(" / "));
}

// 相互末尾再帰は自分のフレームを畳んでから飛ぶ（tco.md §3）。どちらもスタックを積まない。
{
	const src = "is_odd : n ?\n\tn = 0 : __\n\tis_even (n - 1)\nis_even : n ?\n\tn = 0 : 1\n\tis_odd (n - 1)\nis_even 4";
	const ls = body(src, "is_even");
	const jump = ls.findIndex((l) => l === "b is_odd");
	checkTrue("相互末尾再帰は b で飛ぶ", jump >= 0, ls.join(" / "));
	checkTrue("飛ぶ前にフレームを畳む", /^ldp x29, x30, \[sp\], #\d+$/.test(ls[jump - 1]), ls[jump - 1]);
	checkTrue("畳む大きさは開いた大きさと同じ", ls[jump - 1] === ls[0].replace(/^stp x29, x30, \[sp, #-(\d+)\]!$/, "ldp x29, x30, [sp], #$1"), ls[0] + " / " + ls[jump - 1]);
}
// `&` / `|` の右辺も末尾位置である（tco.md §2）。左辺は違う——結果を見てから飛び先を
// 決めるので、評価しきる必要がある。
{
	const ls = body("f : n ? n = 0 | f (n - 1)\nf 3", "f");
	checkTrue("`|` の右辺は末尾", ls.some((l) => /^b \.Lloop/.test(l)), ls.join(" / "));
}
// 末尾でない呼び出しは `bl` のまま。結果を使うので戻ってこなければならない。
{
	const ls = body("g : a ? a\nf : x ? (g x) + 1\nf 1", "f");
	checkTrue("末尾でなければ bl", ls.some((l) => l === "bl g"), ls.join(" / "));
	checkTrue("末尾でなければフレームを畳まない", !ls.slice(0, -2).some((l) => l.startsWith("ldp ")), ls.join(" / "));
}
// ---- 完全性公理（`f __ = __`） ----
//
// **これは最適化ではなく終端そのものである。** Sign にループは無く再帰しかないので
// （0_design_principles.md 原理5）、ここを出さないと「命令は出ているのに止まらない」
// ——診断も出ない一番たちの悪い形になる。
{
	const fb = body("f : x ? x + 1\nf 2", "f");
	// 検査は**仮引数をスロットへ写した後**。TCO でフレームを使い回すとき、飛び先が
	// この検査より後ろにあると初回しか通らず、ループが終わらない。
	const store = fb.findIndex((l) => l === "str x0, [x29, #16]");
	const test = fb.findIndex((l) => l.startsWith("b.eq .Lunit"));
	checkTrue("仮引数を写してから検査する", store >= 0 && test > store, fb.join(" / "));
	// 本体へ入る前に飛ぶ（`add` は検査より後ろ）。
	const work = fb.findIndex((l) => /^add x\d+,/.test(l));
	checkTrue("本体へ一歩も入らない", work > test, fb.join(" / "));
	checkTrue("崩壊したら __ を返す", fb.some((l) => l === "movz x0, #0x8000, lsl #48"), fb.join(" / "));
}
// **判定の仕方は幅で違う。** 1本なら niche、2本なら `len = 0`——`emitUnit` の裏返しで
// あって、新しい規則ではない。
{
	const gb = body("g : s ? s\ng `hello`", "g");
	checkTrue("2本なら len を見る", gb.some((l) => l === "cmp x9, #0"), gb.join(" / "));
	checkTrue("2本なら __ も2本で返す", gb.some((l) => l === "mov x1, #0"), gb.join(" / "));
}
// 引数が複数なら**どれか1つでも** `__` で崩壊する（unit.md「所有の引数に有効値が揃って
// 初めて呼び出しは真」）。
{
	const hb = body("h : a b ? a + b\nh 1 2", "h");
	check("引数の数だけ検査する", hb.filter((l) => l.startsWith("b.eq .Lunit")).length, 2);
	check("飛び先は1つ", new Set(hb.filter((l) => l.startsWith("b.eq .Lunit"))).size, 1);
}
// ---- 要素の並びは参照で運ぶ（stack_abi.md §4.6） ----
//
// 2文字以上は `String` であり、中身は `.rodata` に置いて `{ptr, len}` の2本で渡す。
// 1文字が `Char` としてレジスタ1本に乗るのと**同じ型が2通りの運ばれ方をしない**のは、
// 1文字と2文字以上が別の型だからである（type_system.md §2）。
{
	const src = "f : s ? s\nf `hello`";
	const r = asm(src);
	check("文字列は診断なしで出る", r.diagnostics.length, 0);
	checkTrue("中身は .rodata へ置く", r.text.includes(".section .rodata"), r.text);
	checkTrue("1 byte 幅なら .ascii で書ける", r.text.includes('.ascii "hello"'), r.text);
	// アドレスは `adrp` + `:lo12:` で作る。PC 相対なので位置独立のまま。
	const main = body(src, "_sign_main");
	checkTrue("adrp でラベルの頁を取る", main.some((l) => l === "adrp x9, .Lstr0"), main.join(" / "));
	checkTrue(":lo12: で下位12ビットを足す", main.some((l) => l === "add x9, x9, :lo12:.Lstr0"));
	// **`len` は文字数であってバイト数ではない。** `String ≅ List(Char)` の要素数なので、
	// charset を変えても同じ値でなければ添字がずれる。
	checkTrue("len は文字数", main.some((l) => l === "mov x10, #5"), main.join(" / "));
	// 引数は2本使う。器を1本に詰めない。
	const call = main.findIndex((l) => l === "bl f");
	check("ptr は x0、len は x1", main.slice(call - 2, call), ["ldr x0, [x29, #16]", "ldr x1, [x29, #24]"]);
	// 返値も2本。AAPCS64 が16バイトの複合型を x0/x1 で返すのと同じ置き方。
	const fb = body(src, "f");
	// 崩壊の出口へ飛ぶ直前が、本体を通ったときの返値の積み込みである。
	const ret = fb.findIndex((l) => l.startsWith("b .Ldone"));
	check("返値も x0/x1 の2本", fb.slice(ret - 2, ret), ["ldr x0, [x29, #32]", "ldr x1, [x29, #40]"]);
}
// 中身が同じ文字列は1つに畳む（キーは符号位置の並び）。
{
	const r = asm("f : s ? s\nf `ab`\nf `ab`\nf `cd`");
	check("同じ中身は1つに畳む", (r.text.match(/^\.Lstr\d+:$/gm) || []).length, 2);
}
// `charset` は**要素の幅だけ**を決める。文字数は変わらない。
{
	const { nodes, env } = compile("f : s ? s\nf `ab`", { charset: "utf32" });
	const r = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "utf32", regAlloc: false });
	checkTrue("utf32 では 4 byte 要素で置く", r.text.includes(".balign 4") && r.text.includes(".word 0x61, 0x62"), r.text);
	checkTrue("len は charset に依らず文字数", r.text.includes("mov x10, #2"), r.text);
}
// ---- 添字（`'`） ----
//
// **どちらもメモリを要求しない。** 要素を1つ読むのはアドレス計算1つ、部分列は同じ領域を
// 指したまま頭と長さをずらすだけである（`[h ~t]` の分解とまったく同じ機械）。
{
	const one = body("f : s ? s ' 0\nf `abc`", "f");
	checkTrue("要素は位置つきで読む", one.some((l) => l === "ldrb w14, [x9, x10]"), one.join(" / "));
	checkTrue("範囲外は __", one.some((l) => l === "csel x9, x14, x12, lo"), one.join(" / "));
	const rest = body("f : s ? s ' 1~\nf `abc`", "f");
	checkTrue("部分列は ptr をずらす", rest.some((l) => l === "add x9, x9, x10"), rest.join(" / "));
	checkTrue("長さは引く", rest.some((l) => l === "subs x9, x9, x10"), rest.join(" / "));
	// **尽きたら `len = 0`** であり、それが `__` である。負にはしない。
	checkTrue("負の長さにはしない", rest.some((l) => l === "csel x9, x9, xzr, pl"), rest.join(" / "));
	checkTrue("部分列にコピーは無い", !rest.some((l) => /^(bl|b) [a-z_]/.test(l)), rest.join(" / "));
}
// ---- 恒等射は命令を持たない ----
//
// **1要素リストとスカラーは同型である**（`[5]` は `Int`）ので、その 0 番目は自分自身で
// ある。`x ' 0~`（0 番目から末尾まで）も丸ごとであり、器でも規則でも変わらない
// （`ptr + 0×幅` は `ptr`、`start + 0×step` は `start`）。
//
// **添字がリテラルなら、どちらになるかはコンパイル時に決まっている。** それでも 0 を積んで
// 0 と比べて選ぶ命令を出していた——問いになっていない問いを実行時に訊いていたことになる。
// `$__ = __ = @__` が機械語の不動点であるのと同じ形で、型の上では別のものでも機械の上では
// 同じビットでなければならない。
{
	const same = (a, b) => JSON.stringify(body(a, "f")) === JSON.stringify(body(b, "f"));
	checkTrue("scalar ' 0 は恒等射", same("f : n ? n ' 0\nf 5", "f : n ? n\nf 5"));
	checkTrue("scalar ' 0~ も恒等射", same("f : n ? n ' 0~\nf 5", "f : n ? n\nf 5"));
	checkTrue("器 ' 0~ も恒等射", same("f : s ? s ' 0~\nf `abc`", "f : s ? s\nf `abc`"));
	checkTrue("規則 ' 0~ も恒等射", same("f : n ? [1 ~ 5] ' 0~\nf 1", "f : n ? [1 ~ 5]\nf 1"));
	// 式の中でも同じ命令列になる。
	checkTrue("式の中でも同じ", same("f : n ? (n ' 0) + 1\nf 5", "f : n ? n + 1\nf 5"));
	// 1要素の器の範囲外は `__`。これもコンパイル時に決まる。
	const out = body("f : n ? n ' 1\nf 5", "f");
	checkTrue("1要素の外は __", out.includes("movz x9, #0x8000, lsl #48") && !out.includes("csel x9, x9, x12, eq"), out.join(" / "));
	// **実行時の添字は畳めない。** そこは比べて選ぶ（畳んでよいのはリテラルだけである）。
	const dyn = body("f : n i ? n ' i\nf 5 0", "f");
	checkTrue("実行時の添字は比べる", dyn.includes("csel x9, x9, x12, eq"), dyn.join(" / "));
}
// 要素の幅は charset が決める。utf32 なら 4 byte 単位でずらす。
{
	const { nodes, env } = compile("f : s ? s ' 1~\nf `abc`", { charset: "utf32" });
	const t = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "utf32", regAlloc: false }).text;
	checkTrue("utf32 は 4 byte ぶんずらす", t.includes("add x9, x9, x10, lsl #2"), t);
}
// **具体化された実体の中では、仮引数の関数ポインタも決まっている。** 再帰が `$名前` では
// なく仮引数をそのまま渡す形（`take_while p (s ' 1~)`）でも、同じ実体へ結び直す
// ——そうしないと再帰だけが多相なまま取り残される。
{
	const src =
		"is_digit : c ? c + 0\n" +
		"take_while : p s ?\n\t(@p (s ' 0)) : take_while p (s ' 1~)\n\ts\n" +
		"f : s ? take_while $is_digit s\nf `12`";
	const r = asm(src);
	check("再帰も具体化される", r.diagnostics.length, 0);
	const ls = body(src, "take_while$is_digit");
	checkTrue("自己再帰は飛び先へ戻る", ls.some((l) => /^b \.Lloop/.test(l)), ls.join(" / "));
	// 引数は器の2本だけ（x0/x1）。関数ポインタの分は増えない。
	const back = ls.findIndex((l) => /^b \.Lloop/.test(l));
	check(
		"引数は器の2本だけ",
		ls.slice(back - 2, back).map((l) => l.replace(/#\d+/, "#N")),
		["ldr x0, [x29, #N]", "ldr x1, [x29, #N]"],
	);
}
// ---- 器どうしの等価（段8 の `==` / `!==`）（中身の比較） ----
//
// **メモリは要らない。読むだけである。** 真のときに返すのは左辺そのもの、偽のときは
// `len = 0`（＝`__`）なので、新しい `{ptr, len}` を作る必要がない。
{
	const src = "f : s ?\n\ts == `ab` : 1\n\t0\nf `cd`";
	const r = asm(src);
	check("器どうしの等価は出る", r.diagnostics.length, 0);
	const ls = body(src, "f");
	// 長さが違えば中身を見るまでもない。
	const lenCmp = ls.findIndex((l) => l === "cmp x9, x10");
	checkTrue("先に長さを比べる", lenCmp >= 0 && ls[lenCmp + 1].startsWith("b.ne "), ls.join(" / "));
	// 要素の幅は charset が決める（`String ≅ List(Char)` の要素幅そのもの）。
	checkTrue("1 byte 要素なら ldrb で走る", ls.some((l) => l === "ldrb w14, [x10, x13]"), ls.join(" / "));
	checkTrue("位置を1つずつ進める", ls.some((l) => l === "add x13, x13, #1"), ls.join(" / "));
	// 比較は値を返す（comparison.md §2.1）。真なら左辺、偽なら `__`。
	checkTrue("偽は len = 0 で表す", ls.some((l) => l === "mov x10, #0"), ls.join(" / "));
	// 条件の位置に器が来ても分岐できる——`__` かどうかの判定は幅ごとに決まっている。
	checkTrue("器の条件は len で判定する", ls.filter((l) => l === "cmp x9, #0").length >= 1, ls.join(" / "));
}
// 順序（`<` `>`）は辞書式の規則が要るのでまだ出さない。**名指しする。**
checkTrue(
	"器の順序比較は名指しする",
	asm("f : s ? s < `ab`\nf `cd`").diagnostics.some((d) => d.message.includes("等価だけを出せます"))
);
// utf32 なら要素は 4 byte。同じ命令列が幅だけ変わる。
{
	const { nodes, env } = compile("f : s ?\n\ts == `ab` : 1\n\t0\nf `cd`", { charset: "utf32" });
	const t = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "utf32", regAlloc: false }).text;
	checkTrue("4 byte 要素なら lsl #2 で引く", t.includes("ldr w14, [x10, x13, lsl #2]"), t);
}
// ---- 幅のある値を返す分岐 ----
//
// どの枝を通っても同じ場所に値がある、という一点は幅が2本でも変わらない。
{
	const src = "f : c ?\n\tc = 0u61 : `yes`\n\t`no`\nf 0u61";
	const r = asm(src);
	check("器を返す分岐は出る", r.diagnostics.length, 0);
	const fb = body(src, "f");
	// **どの枝も同じ場所へ置く。** かつてここは「出力スロットへ**写す**回数」を数えて
	// いたが、写しは手段であって目的ではない——枝を合流用スロットへ**直に置く**ように
	// なったので、写しは0回になった。見るべきは「同じ場所に在る」ことの方である。
	//
	// 2つの枝が同じ ptr スロットと同じ len スロットへ書いていることを確かめる。
	check("どの枝も同じ ptr へ置く", fb.filter((l) => l === "str x9, [x29, #24]").length, 2);
	check("どの枝も同じ len へ置く", fb.filter((l) => l === "str x10, [x29, #32]").length, 2);
	// 合流のための写しはもう出ない（枝が最初からそこへ置いている）。
	check("写しは出ない", fb.filter((l) => l === "ldr x9, [x29, #24]").length, 0);
}
// **どの枝も通らなかったときの `__` は、幅ごとに表し方が違う。**
//
//   1本  上位ビットの niche（value_representation.md §3.5）
//   2本  `len = 0`——空文字列・空リストが `__` そのものだから（`__ = []`、unit.md）
//
// 新しい表現を足したのではなく、元からある同一視をそのまま命令にしている。
{
	const one = body("f : c ?\n\tc = 0u61 : 1\nf 0u61", "f");
	checkTrue("1本なら niche", one.some((l) => l === "movz x12, #0x8000, lsl #48"), one.join(" / "));
	const two = body("f : c ?\n\tc = 0u61 : `yes`\nf 0u61", "f");
	checkTrue("2本なら len = 0", two.some((l) => l === "mov x12, #0"), two.join(" / "));
}
// **幅の違う枝の直和は広い方へ揃える**（type_system.md §2）。
//
// `Char | String` は「1本の枝と2本の枝」であり、型の側に1つの答えは無い。置き方の話
// なので決めるのは `passingOf` で、広い方（参照）を採る。**狭い枝を広げるのに確保は
// 要らない**——リテラルの1文字は `.rodata` に置き場所があるので `{ptr, 1}` になる。
// 1文字を「長さ1の文字列」として扱うのは `String ≅ List(0u)` の言い換えでしかない。
{
	const ds = asm("f : c ?\n\tc = 0u61 : `yes`\n\t0u62\nf 0u61").diagnostics.map((d) => d.message);
	check("直和の枝は揃う", ds, []);
	const b = body("f : c ?\n\tc = 0u61 : `yes`\n\t0u62\nf 0u61", "f");
	// 狭い枝も器として置かれる——`.rodata` の頁を取って長さ1を積む。
	checkTrue("狭い枝は .rodata へ置く", b.some((l) => /^adrp x9, \.Lstr/.test(l)) && b.includes("mov x10, #1"), b.join(" / "));
	// 確保の命令は出ない（`bl` も `sub sp` も無い）。
	checkTrue("確保は出ない", !b.some((l) => /^bl |^sub sp/.test(l)), b.join(" / "));
}

// **トップレベルの定数はその場で畳む。** `名前 : 値` は束縛であって場所ではないので、
// 値そのものを書けば済む——ロードは要らない。
check("定数参照は畳まれる", asm("one : 1\nf : x ? x + one\nf 2").diagnostics.length, 0);
checkTrue("畳んだ結果はリテラルと同じ命令", (body("one : 1\nf : x ? x + one\nf 2", "f") || []).some((l) => l === "mov x9, #1"));


// ---- 短絡（`&` と `|`） ----
//
// どちらも「左を見て、右を評価するかどうかを決める」形である。
//
//   &   左が `__` なら全体が `__`（右は評価しない）
//   |   左が `__` でなければ左が結果（右は評価しない）
//
// **評価しないことは意味論の一部である。** Sign は副作用と非停止を持つので、
// `__ & ($UART # x)` で書き込みが起きるかどうかが変わる（operator_table.md
// 「Unit 欄の読み方」）。命令の節約ではなく、評価するかしないかを出している。
{
	const ls = body("f : a b ? a > 0 & b > 0\nf 1 2", "f");
	checkTrue("左が __ なら右へ行かず飛ぶ", ls.some((l) => /^b\.eq \.Lsc/.test(l)), ls.join(" / "));
	checkTrue("飛び先は右辺の後ろ", ls.some((l) => /^\.Lsc\d+:$/.test(l)));
}
{
	const ls = body("f : a b ? a > 0 | b > 0\nf 1 2", "f");
	checkTrue("`|` は左が __ でなければ飛ぶ", ls.some((l) => /^b\.ne \.Lsc/.test(l)), ls.join(" / "));
}
check("入れ子でも出る", asm("f : a b c ? (a > 0 & b > 0) | c > 0\nf 1 2 3").diagnostics.length, 0);
// `|` はバックトラックの書き方でもある（n_queens.sn の try_col がこの形）。
check("バックトラックの形", asm("g : x ? x\nf : a ? (g a) | (f (a - 1))\nf 3").diagnostics.length, 0);

// ---- 出せないものは名指しする ----
//
// 黙って落とすと、命令の無い関数ができあがって「動いたように見える」——型が値より
// 狭いときと同じ種類の嘘である。
checkTrue("族のままなら出せない（GPR か FPU か決まらない）", asm("f : a b ? a + b").diagnostics.length > 0);
checkTrue("浮動小数はまだ出せない", asm("f : a ? 0.0 + a\nf 1.0").diagnostics.length > 0);

checkTrue("未対応ターゲットは名指しする", asm("f : a ? a + 1\nf 1", "cortex_m").diagnostics.length > 0);
// 出せるものは診断が出ない。
check("通る形は診断ゼロ", asm("sq : x ? x * x\nadd : a b ? a + b\nf : n ? add (sq n) (sq n)\nf 3").diagnostics.length, 0);

// ---- 全体の形 ----
//
// トップレベルの式は `_sign_main` に入る（entry_point.md の生成スタブが `bl _sign_main`
// で呼ぶ）。
{
	const r = asm("sq : x ? x * x\nsq 7");
	checkTrue("_sign_main が出る", r.text.includes("_sign_main:"));
	checkTrue("トップレベルの式は _sign_main の中", r.text.split("_sign_main:")[1].includes("bl sq"));
}

// **名前が外から見えるかどうかは `#` の段数が決める**（system_architecture.md §2.1 の
// 随伴ペアを ELF に写したもの）。ここで守るのは「`.global` が出るか」ではなく段差である
// ——以前は全部の関数に `.global` が付いていて、`#` は機械語に何の意味も持っていなかった。
{
	const vis = (m) => asm(`${m}sq : x ? x * x\nsq 7`).text;
	checkTrue("無印は外に名前を出さない", !vis("").includes(".global sq"));
	checkTrue("# はプロジェクト内だけ（hidden）", vis("#").includes(".global sq") && vis("#").includes(".hidden sq"));
	checkTrue("## は共有物の外から見える", vis("##").includes(".global sq") && !vis("##").includes(".hidden sq"));
	checkTrue("### は自分のセクションを持つ", vis("###").includes(".section .sign.pinned"));
	checkTrue("### の後は .text に戻る", vis("###").split(".section .sign.pinned")[1].includes(".text"));
}


// ---- 器を作る式と layer ----
//
// **記憶を確保できる layer でしか器は作れない。** `layer: 0` には確保の手段が無い
// （前置 `#` はコンパイルエラー、memory_management.md §2 の表）。あるのは `alloca` と
// `.rodata` だけで、`alloca` は自分のフレームなので返せない。
//
// 切り出し（`s ' i~`）は別の話である——既にある記憶を指し直すだけで、新しい場所を
// 要求しない。だから layer: 0 でも使える。
{
	const at = (src, layer) => {
		const { nodes, env } = compile(src, { charset: "ascii" });
		return generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii", layer }).diagnostics.map((d) => d.message);
	};
	const build = "f : s ?\n\ts (s ' 0)\nf `ab`";
	checkTrue("layer 0 は「作れません」と言う", at(build, 0).some((m) => /layer: 0 では器を作れません/.test(m)), JSON.stringify(at(build, 0)));
	// **門番は場所を取る式ぜんぶに掛かる。**
	//
	// `option_ms_schema.md` §4 の表が `layer: 0` を「RAM 未初期化。alloca ✗」と定めて
	// いる。`sub sp` はまさにその alloca なので、layer 0 では出してはいけない——BIOS/UEFI
	// の初期フェーズに相当する層で、未初期化のハードウェアへ触ることを構造的に防ぐのが
	// 層の役目である（`build_system.md` §4.1）。
	//
	// かつて判定は sret の枝にしか入っておらず、**器の構築も `$匿名式` も持ち上げも
	// layer 0 で素通りしていた**。場所を取る式は6通りあるので、判定を散らすと必ずどれかが
	// 漏れる——`allocaAllowed` の1箇所へ集めてある。
	const gated = (src) => at(src, 0).some((m) => /layer: 0 では場所を取れません/.test(m));
	checkTrue("layer 0: 器を組み立てられない", gated("||1 2 3||"));
	checkTrue("layer 0: `$匿名式` で場所を取れない", gated("f : x ? ($(x , x)) ' 0\nf 5"));
	checkTrue("layer 0: 前置 `~` の持ち上げも場所である", gated("f : [~o] ? ||o||\nf ~5"));
	checkTrue("layer 0: 参照越しの書き込みも場所が要る", gated("l : [1 2 3]\n$[l ' 0] # 9\nl ' 0"));
	// **確保が要らないものは layer 0 でも通る。** 切り出しは同じ領域を指し直すだけ、
	// MMIO は既に在る場所を読み書きするだけである。
	checkTrue("layer 0: 切り出しは通る", at("s : `abcde`\n||s ' 2~||", 0).length === 0);
	checkTrue("layer 0: MMIO は通る", at("0x40800000 # 65\n@0x40800000", 0).length === 0);
	// **フレームも確保である。** `stp x29, x30, [sp, #-N]!` はプリインデックスで `sp` を
	// 下げて書く——`sub sp` という*形*をしていないだけで、やっていることは同じである
	// （`layer_relations.md` §4.1）。門番が `sub sp` だけを探していたので当たっていなかった。
	//
	// **呼び出しは必ずフレームを要求する。** `bl` は戻り番地 `x30` を上書きするので、
	// 呼ぶ側は自分の戻り先を記憶へ退避しなければならない。したがって layer 0 では関数が
	// 呼べない——それは正しい姿で、boot は直列のハード操作だけで書ける（同 §4.1）。
	const callGated = (src) => at(src, 0).some((m) => /layer: 0 では関数を呼べません/.test(m));
	checkTrue("layer 0: 関数を呼べない", callGated("f : n ? n + 1\nf 41"));
	checkTrue("layer 0: 合成も呼び出しである", callGated("f : n ? n + 1\ng : n ? n * 2\n(f g) 5"));
	// **判定は形ではなく要求で行う。** 止めるのは「`?` を書いたこと」ではなく「フレームが
	// 要ったこと」である。`f : n ? n + 1` の `f` 自身は覗き穴と割り付けの後にフレームが
	// 消えるので、名指しされるのは呼ぶ側（`_sign_main`）だけになる。
	checkTrue(
		"layer 0: フレームの要らない `?` は名指ししない",
		at("f : n ? n + 1\nf 41", 0).every((m) => !/では f がフレームを/.test(m))
	);
	// **切り出しは呼び出しの中でも確保を要求しない。** layer 0 で出る診断は呼ぶ側の
	// ぶんだけで、`f` 自身は名指しされない——`s ' 1~` は同じ領域を指し直すだけである。
	checkTrue(
		"layer 0: 仮引数の切り出しも確保ではない",
		at("f : s ?\n\ts ' 1~\nf `abc`", 0).every((m) => !/では f が/.test(m))
	);
	// **末尾再帰が積まないのは「繰り返しごとに」であって、「まったく」ではない。**
	// 自己末尾再帰は `b .Lloop` で同じフレームへ戻るので深さは増えないが、その1つの
	// フレームは入口で確保される。かつてここは「layer 0 でも通る」と書いてあり、実際
	// `f` は 32 バイトのフレームを取っていた——**誰も見ていなかったので通っていた**。
	checkTrue(
		"layer 0: 末尾再帰も入口のフレームは確保である",
		at("f : a n ?\n\tn > 0 : f (a + n) (n - 1)\n\ta\nf 0 5", 0).some((m) => /では f がフレームを要求します/.test(m))
	);
	checkTrue(
		"layer 1: 末尾再帰は通る",
		at("f : a n ?\n\tn > 0 : f (a + n) (n - 1)\n\ta\nf 0 5", 1).length === 0
	);
	// **層の禁止と実装の穴は別である。** `Float` は layer 2 以上（同 §4）。実装が無い
	// ことを理由に落とすと、実装したときに layer 0 で通ってしまう。
	checkTrue(
		"layer 0: Float は層が禁じる（未実装ではなく）",
		at("x : 1.5\nx", 0).some((m) => /layer: 0 では Float を使えません/.test(m)),
		JSON.stringify(at("x : 1.5\nx", 0)),
	);
	checkTrue(
		"layer 2: Float は「まだ」である",
		at("x : 1.5\nx", 2).some((m) => /浮動小数はまだ出せません/.test(m)),
		JSON.stringify(at("x : 1.5\nx", 2)),
	);

	// ---- 層には上限もある（機能を積み上げるだけではない） ----
	//
	// **同じ演算子が層によって意味を反転させる。** MMIO のレジスタを選ぶには `uart + 4` が
	// 要るので layer 0 では番地の算術が必要だが、上の層では同じ式が「任意の番地を捏造する
	// 手段」になる。`$` が作った番地は前から守られていたのに、リテラル由来だけが素通り
	// していた——`p : 0x40800000 + 8` と書けば user land から任意の場所を踏めた。
	//
	// これが閉じると、上の層で番地として存在できるのは**自分が持っているもの**だけになる
	// ——`$名前`・下の層から受け取った参照・分解した先。捏造した番地は型として作れないので、
	// 層の境界を越えて渡されるポインタを受け側が検証する必要が無い。
	const forged = (src, layer) => at(src, layer).some((m) => /生の番地を算術に使えません/.test(m));
	checkTrue("layer 0: 生番地の算術は通る（MMIO に要る）", at("p : (0x40800000) + 8\np", 0).length === 0);
	checkTrue("layer 1: 生番地の算術は閉じる", forged("p : (0x40800000) + 8\np", 1));
	checkTrue("layer 4: 生番地の算術は閉じる", forged("p : (0x40800000) + 8\np", 4));
	// 生の番地へ**直に書く**のはハードウェアを触る層まで（0〜1）。
	const rawWrite = (layer) => at("0x9000000 # 0x4b", layer);
	checkTrue("layer 0: MMIO へ直に書ける", rawWrite(0).length === 0);
	checkTrue("layer 1: MMIO へ直に書ける（kernel まで）", rawWrite(1).length === 0);
	checkTrue(
		"layer 2 以上: 生番地へ直に書けない",
		rawWrite(2).some((m) => /生の番地へ直に書けません/.test(m)),
		JSON.stringify(rawWrite(2)),
	);
	// **自分が持っている番地への書き込みは層に依らない。** そこが捏造でないことは、
	// 番地の出どころ（`$名前`・器の要素）が保証している。
	checkTrue("どの層でも `$名前` へは書ける", at("n : 5\n$n # 9\nn", 4).length === 0);
	checkTrue("どの層でも器の要素へは書ける", at("l : [1 2 3]\n$[l ' 0] # 9\nl ' 0", 4).length === 0);
	// **同じ「出せない」でも中身が違った。** 上は設計上の結論（記憶を確保する手段が無い）、
	// 下は実装の穴だった。穴の方は塞がった——撒いた器は返値スロットへ写せるので、layer 1
	// では出る。層の側の結論は変わらない。
	checkTrue("layer 1 では出る", at(build, 1).length === 0, JSON.stringify(at(build, 1)));
	// **フレームから出ないなら、自分のフレームに置ける。** 出るかどうかは呼び先が引数を
	// 返しうるかまで見て決まる（`collectReturnedParams`）——直近の呼び出しだけでは足りない。
	{
		const inFrame = "g : x ? 1\nf : [c ~rest] ?\n\tg ((c (rest ' 0)) ' 0) : 7\n\t0\nf `abc`";
		check("出ない器は置ける", at(inFrame, 1), []);
		const b = body(inFrame, "f");
		checkTrue("sub sp で場所を取る", b.some((l) => /^sub sp, sp, #/.test(l)), b.join(" / "));
		checkTrue("sp を戻す", b.includes("mov sp, x29"), b.join(" / "));
	}
	// 切り出しは layer 0 でも通る。**名指しされるのは呼ぶ側だけ**である——`f` 自身は
	// フレームを取らない（`s ' 1~` は同じ領域を指し直すだけ）ので、layer 0 で出るのは
	// `_sign_main` の呼び出しに対する診断1件だけになる（`layer_relations.md` §4.1）。
	check("切り出し自体は確保を要求しない", at("f : s ?\n\ts ' 1~\nf `abc`", 0).filter((m) => /では f が/.test(m)).length, 0);
	// layer を渡さなければ検査しない（他の門番と同じ方針）。
	checkTrue("layer 未指定なら layer の話をしない", !at(build, undefined).some((m) => /layer: /.test(m)), JSON.stringify(at(build, undefined)));
}

// ---- `$` `@` `#`（アドレス・ロード・ストア） ----
//
// **3つとも niche を動かせない。** `$__ = __ = @__` は機械語の側の不動点である——記憶が
// 無いものにアドレスは無く、無いアドレスから読めるものも無い。同じビット列であり、区別して
// いるのは型だけ（`__` は `Unit`、`$__` は `Address`）。原理2「型はゼロコストの帳簿」が
// そのまま出る場所で、`f $__` が完全性公理で崩壊しないのに1命令も余分に要らない。
{
	// 前置 `$`——仮引数はフレームに在るのでアドレスが取れる。
	const a = body("f : n ? $n\nf 1", "f");
	checkTrue("フレーム内のアドレスは add 1命令", a.some((l) => /^add x9, x29, #\d+$/.test(l)), a.join(" / "));
	// `$__` は niche そのもの。型は `Address` だがビットは `__` と同じ。
	const u = body("f : n ? $__\nf 1", "f");
	checkTrue("`$__` は niche", u.some((l) => l === "movz x9, #0x8000, lsl #48"), u.join(" / "));
	// 前置 `@`——niche なら読まない。
	const ld = body("f : p ? @p\nf 100", "f");
	checkTrue("読む前に niche を見る", ld.some((l) => /^b\.eq \.Lnoaddr/.test(l)), ld.join(" / "));
	checkTrue("読むのは1命令", ld.some((l) => l === "ldr x9, [x9]"), ld.join(" / "));
	// 中置 `#`——**守るのは左辺**。不正なアドレスへは書かない。
	const st = body("f : p v ? p # v\nf 100 5", "f");
	checkTrue("書く前に niche を見る", st.some((l) => /^b\.eq \.Lnowrite/.test(l)), st.join(" / "));
	checkTrue("書くのは1命令", st.some((l) => l === "str x10, [x9]"), st.join(" / "));
	// 成功したらアドレス、書けなければ `__`（演算子表 tier 4）。
	checkTrue("書けなければ __ を返す", st.some((l) => l === "mov x9, x12"), st.join(" / "));
	check("診断は出ない", asm("f : p v ? p # v\nf 100 5").diagnostics.length, 0);
}
// **右辺の `__` は書ける。** 書けないと場所を空にできない——ストリームが尽きたときに
// カーソルへ「もう無い」を書き込めない。だから右辺には niche の検査を入れない。
{
	const st = body("f : p ? p # __\nf 100", "f");
	check("右辺を検査する分岐は出ない", st.filter((l) => /^b\.eq \.Lnowrite/.test(l)).length, 1);
}

// ---- 規則（レンジ）は場所ではない ----
//
// 置かれているのは `{start, step, end}` という固定サイズの3つ組だけで、要素列はどこにも
// 無い（list_model.md §2.3）。だからレジスタに乗り、**無限でも 24 バイトで済む**。
{
	const asmL = (src, layer) => { const { nodes, env } = compile(src, { charset: "ascii" }); return generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii", layer }); };
	check("無限カウンタは出る", asmL("f : n ? [0 ~+ 1]\nf 1", 1).diagnostics.length, 0);
	check("有界レンジも出る", asmL("f : n ? [1 ~ 5]\nf 1", 1).diagnostics.length, 0);
	check("歩幅つきも出る", asmL("f : n ? [2 ~+ 3 ~ 9]\nf 1", 1).diagnostics.length, 0);
	// 等比・冪は同じ3つ組で運べるが、添字が `start + i × step` にならない。名指しする。
	checkTrue("等比は名指しする", asmL("f : n ? [2 ~* 2 ~ 8]\nf 1", 1).diagnostics.length > 0);
}
// **添字はロードではない。** `start + n × step` という算術で出る（type_system.md §2 の
// アクセス表「添字は必ずしもロードではない」）。だから無限でも引ける——これがループ
// カウンタを成立させている。ここを場所と同じ経路へ流すと、`start` をポインタ・`step` を
// 長さとして読む命令が出る（実際に出ていた）。
{
	const has = (src, ins) => body(src, "f").includes(ins);
	checkTrue("無限を引くのは madd", has("f : n ? [0 ~+ 1] ' 3\nf 1", "madd x9, x10, x11, x9"));
	checkTrue("ロードは出ない", !body("f : n ? [0 ~+ 1] ' 3\nf 1", "f").some((l) => /^ldr w14|^ldrb/.test(l)));
	// 仮引数で受けても、束縛を経ても同じ。`repr` が束縛から辿れる。
	checkTrue("仮引数で受けても算術", has("f : c ? c ' 3\nf [0 ~+ 1]", "madd x9, x10, x11, x9"));
	checkTrue("束縛を経ても算術", body("c : [0 ~+ 1]\nf : n ? c ' 3\nf 1", "f").includes("madd x9, x10, x11, x9"));
	// **場所はロードのまま。** 型が同じ `List` でも、実体が違えば命令が違う。
	checkTrue("場所はロード", has("f : s ? s ' 0\nf `abc`", "ldrb w14, [x9, x10]"));
	// **終端があるなら範囲を見る。向きは歩幅の符号が持つ。**
	//
	// `[5 ~ 1]` は 5,4,3,2,1 なので歩幅は −1 である。端点の並びから読み直すのでは足りない
	// ——切った規則（`[0 ~ 3] ' 5~`）は起点が終端を越えているので、並びで見ると降順に
	// 化ける。構築のときに符号へ畳んでおけば、切っても向きは動かない。
	const b5 = body("f : n ? [1 ~ 5] ' 3\nf 1", "f");
	checkTrue("有界は範囲を見る", b5.includes("csel x15, x15, x11, ge"), b5.join(" / "));
	checkTrue("無限は範囲を見ない", !body("f : n ? [0 ~+ 1] ' 3\nf 1", "f").includes("csel x15, x15, x11, ge"));
	// 歩幅を書かない形は、端点の並びから ±1 を作る。書いてある形は触らない。
	checkTrue("向きは構築時に畳む", body("f : n ? [5 ~ 1] ' 3\nf 1", "f").includes("csel x11, x11, x12, le"));
	checkTrue("書いた歩幅は触らない", !body("f : n ? [2 ~+ 3 ~ 9] ' 1\nf 1", "f").includes("csel x11, x11, x12, le"));
}

// ---- 16ビットを超える即値は movz/movk の連なりになる ----
//
// 桁を落として黙って通さない——`0x40000000` のような番地は、下位16ビットだけ置くと
// 別の番地を触ることになる。負の値は `movn` の方が短い。
{
	// **即値だけを見る**（`, #` を要求する）。レジスタ間の `mov x9, x0` まで拾うと、
	// 覗き穴がスロットの往復を `mov` に畳んだ瞬間に、符号化を何も変えていないのに
	// 落ちる——ここで守りたいのは「桁を落とさずに置くこと」であって命令の数ではない。
	const ins = (src) => body(src, "f").filter((l) => /^(mov|movz|movk|movn) x9, #/.test(l));
	check("16ビットまでは mov 1つ", ins("f : a ? a + 65535\nf 1"), ["mov x9, #65535"]);
	check("超えたら movz と movk", ins("f : a ? a + 70000\nf 1"), ["movz x9, #0x1170", "movk x9, #0x1, lsl #16"]);
	check("上位だけなら movz 1つ", ins("f : a ? a + 0x40000000\nf 1"), ["movz x9, #0x4000, lsl #16"]);
	checkTrue("超える即値でも診断は出ない", asm("f : a ? a + 70000\nf 1").diagnostics.length === 0);
}

// ---- 分解したものを組み直すのは恒等射である ----
//
// `[c ~rest]` は器をその場で分解する（コピーはしない）ので、`rest` は同じ領域の頭を1つ
// 進めた参照であり、`c` はその手前の1要素である。組み直した結果は
// `{rest.ptr − 幅, rest.len + 1}` で、**確保は要らない**——切り出しの逆向きである。
{
	const b = (src) => body(src, "f");
	const LS = "f : [c ~rest] ?\n\tc = ` ` : f rest\n\tc rest\n";
	checkTrue("組み直しに確保は要らない", asm(LS + "f `  ab`").diagnostics.length === 0);
	checkTrue("頭を1要素ぶん戻す", b(LS + "f `  ab`").includes("sub x9, x9, #1"));
	checkTrue("長さを1つ戻す", b(LS + "f `  ab`").includes("add x9, x9, #1"));
	// **撒くかどうかで意味が違う。** 器の側に後置 `~` が要るのが仕様である（分解の
	// `[c ~rest]` と対称）。`String` だけは撒かない形もテキスト連結になるので同じ答えに
	// なるが、`List` では `c rest` は `[c, rest]` という**別の器**である——そこで恒等射を
	// 当てると、入れ子であるべきものを平らにしてしまう。
	checkTrue("撒く形も組み直し", b("f : [c ~rest] ? c rest~\nf `abcd`").includes("sub x9, x9, #1"));
	checkTrue(
		"List の撒かない形は組み直しではない",
		!body("f : [c ~rest] ? c rest\nf [1 2 3 4]", "f").includes("sub x9, x9, #1"),
	);
	checkTrue("List でも撒けば組み直し", body("f : [c ~rest] ? c rest~\nf [1 2 3 4]", "f").includes("sub x9, x9, #8"));
	// 順序が逆なら別の器である（`rest c` は「残りのうしろへ頭を足す」）。**組み直しでは
	// ないが、出せないわけでもない**——撒いた器を返値スロットへ写して、そのうしろへ頭を
	// 足せばよい。かつてここは「診断が出ること」を見ていたが、写せるようになった今、
	// 見るべきは「組み直しの命令を出していないこと」である。
	checkTrue(
		"逆順は組み直しではない",
		!body("f : [c ~rest] ?\n\tc = ` ` : f rest\n\trest c\nf `  ab`", "f").includes("sub x9, x9, #1"),
	);
	// 別の分解の組み合わせも組み直しではない。
	checkTrue(
		"別の組は組み直しではない",
		asm("g : [a ~b] [c ~d] ?\n\ta = ` ` : g b d\n\ta d\ng `x` `y`").diagnostics.length > 0,
	);
	// 4 byte の charset なら戻す幅も変わる。
	const u = generateAsm(compile(LS + "f `  ab`", { charset: "utf32" }).nodes, compile(LS + "f `  ab`", { charset: "utf32" }).env,
		{ target: "aarch64_qemu", charset: "utf32", layer: 1, regAlloc: false });
	checkTrue("幅は charset が決める", u.text.split("\n").map((l) => l.replace(/\/\/.*/, "").trim()).includes("sub x9, x9, #4"), u.diagnostics.map((d) => d.message).join(" / "));
}

// ---- 括弧はスライスの判定を変えない ----
//
// `s ' (1 ~+ 1)` は `s ' 1~` と同じ部分列である（優先順位のために括っただけ）。pass3 の
// `sliceIndexNode` は括弧を剥いでいたので、pass4 が剥がないと型は「部分列」と言うのに命令は
// 「要素1つ」を出そうとして幅が合わなくなる——同じ式について2つのパスが違うことを言う。
{
	// 部分列は「頭と長さをずらす」——長さを詰めて負にしない `csel` がその印である。
	const slice = (src) => body(src, "f").includes("csel x9, x9, xzr, pl");
	checkTrue("裸のスライス", slice("f : s ? s ' 1~\nf `abc`"));
	checkTrue("括ったスライス", slice("f : s ? s ' (1 ~+ 1)\nf `abc`"));
	checkTrue("二重に括っても", slice("f : s ? s ' ((1 ~+ 1))\nf `abc`"));
}

// **射は鍵ではない。**
//
// 恒等射（`!__`）は「何もしない射」であって鍵ではない。ところが恒等射は**機械の上では
// `0`** で表され、`' 0` は正当な添字なので、`x ' !__` が黙って `x ' 0` に化けていた
// ——`[1 2 3] ' !__` が実機で 1（先頭要素）、``abc` ' !__` が 97（先頭の文字）を返す。
// 解釈器は `__` を返すので、診断ゼロで食い違っていた。
//
// かつて仕様は `x ' !__` に「コンストラクタ由来の確認」という役目を与え、`===` と対で
// 同一性を担うと書いていた。その `===` を廃止した（ねじれは2つの引き方の差で導出できる）
// ので、この構文も役目を失っている。
checkTrue(
	"射で器を引くのは名指しする（リスト）",
	asm("l : [1 2 3]\nl ' !__").diagnostics.some((d) => d.message.includes("射で器を引くことはできません"))
);
checkTrue(
	"射で器を引くのは名指しする（文字列）",
	asm("s : `abc`\ns ' !__").diagnostics.some((d) => d.message.includes("射で器を引くことはできません"))
);
checkTrue(
	"射で器を引くのは名指しする（積）",
	asm("p :\n\tx : 3\n\ty : 4\np ' !__").diagnostics.some((d) => d.message.includes("射で器を引くことはできません"))
);
// 連番と名前は今まで通り引ける（射だけを断っている）。
check("連番は引ける", asm("l : [1 2 3]\nl ' 0").diagnostics.length, 0);
check("名前は引ける", asm("p :\n\tx : 3\np ' x").diagnostics.length, 0);

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
