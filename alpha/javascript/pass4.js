/**
 * Pass 4（バックエンド）——AArch64 の命令列を出す。
 *
 * `compiler_pipeline.md` §3 が定める責務は「Pass 1〜3で確定した型情報を**使い捨ての
 * 帳簿**として消費し尽くし、struct名・enum名等の意味論的な型情報は一切引き継がない。
 * 固定幅レジスタ操作とジャンプ命令テンプレートの選択のみを行う」である。
 *
 * したがってここは**型の名前で分岐しない**。見るのは還元済みの情報だけである。
 *
 *   幅と符号        `reduceToMachineType`（target_info.js）
 *   大きさとオフセット  `measure` / `layoutOfStruct`（layout.js）
 *   ロードか算術か     `node.repr`
 *   渡し方           `passingOf`（layout.js、stack_abi.md §4.6）
 *
 * ## 式の途中の値はフレームに置く
 *
 * **`bl` は `x0`〜`x7` も `x9`〜`x15` も壊す**（AAPCS64、stack_abi.md §4.2 の表）。
 * 途中の値をレジスタに置いたままにすると、次の呼び出しで消える——`add (sq n) (sq n)`
 * の1つ目の結果も、仮引数 `n` 自身も壊れる。実際にそういう命令列が出た。
 *
 * だから**式の途中の値は必ずフレームのスロットへ置く**。レジスタは「ロードして演算して
 * ストアする」間だけ使い、呼び出しを跨がない。素朴だが常に正しく、出した命令列を
 * 読んで確かめられる。呼び出しが挟まらない区間でレジスタに留める最適化は、正しさを
 * 確かめてからで足りる（原理1：ソースを読めば命令列が読めること）。
 *
 * ## いま出せる範囲
 *
 *   - 整数リテラル（16ビットまでの即値）
 *   - `+` `-` `*` `/`（GPR 幅の整数）
 *   - 裸の仮引数を持つ関数定義と、その飽和した呼び出し
 *   - トップレベルの式（`_.main` へ入る）
 *   - 2文字以上の文字列（`.rodata` へ置いて `{ptr, len}` を積む）
 *
 * 集約値・浮動小数・分岐・再帰はまだ出さない。出せないものは黙って落とさず診断として
 * 名指しする——落とすと「命令が無いのに動いたように見える」が起きる。
 */

import { reduceToMachineType, widthsOf, UNIT_NICHE_ASM, charSizeOf, charLimitOf, DEFAULT_CHARSET, SIGNEDNESS, literalDigits, literalParts } from "./target_info.js";
import { envLookup } from "./pass1.js";
import { isBareComment } from "./pass3.js";
import { passingOf, measure, layoutOfStruct, elementShapeOfList, itemShapeOfListAt, commonSlotShape, flattenProduct, productSlotNodes, isExpandNode, mergeBaseIdentifier, isIdentifierNode, isDefineNode, isSlotKeyNode as isSlotKeyAtom, bareName as slotName, addressWithoutArrow } from "./layout.js";
import { CURSOR_SUFFIXES } from "./stream_desugar.js";
import { asmOf } from "./operator_table.js";

// AAPCS64（stack_abi.md §4.2）。引数は x0〜x7、返値は x0、一時は x9〜x15。
const ARG_REGS = ["x0", "x1", "x2", "x3", "x4", "x5", "x6", "x7"];
// 演算のあいだだけ使う。呼び出しを跨がないので caller-saved で足りる。
const SCRATCH = ["x9", "x10"];
// **返値スロットに入る個数を渡す口。** AAPCS64 の外にある Sign の取り決めで、x8 と対に
// なる（`CALL_ARGS`）。一時としても使うが、値は呼ばれた側が入口でスロットへ写すので、
// そこから先で潰しても構わない——渡す直前に組み立て、受けた直後に仕舞う。
const SRET_LIMIT = "x15";
// フレームに置ける式の深さ。超えたら診断（深い式は稀なので、まず名指しする）。
//
// **仮引数もここを使う。** 器を受ける仮引数は2本使うので、引数が多い関数は本体を
// 出す前に枠を食う——`walk` は9個で13本である。16 では仮引数だけでほぼ埋まって
// しまい、本体が「式が深すぎます」で落ちていた。
//
// 上げても命令は変わらない。`ldr`/`str` の符号なしオフセットは 64 ビット幅で
// 32760 まで届くので、この程度のフレームは1命令で引ける。
const MAX_SLOTS = 48;

// 器を作る余積の演算（記憶の確保を要求する）。
const COPRODUCT_BUILD_OPS = new Set(["construct", "concat", "push", "unshift", "product"]);
// **蓄積子になれるのは余積だけで、積（`,`）は入らない。** 解釈器の `COPRODUCT_OPS`
// （`interpreter.js` の `isAccumulator`）と同じ並びである——同じ規則を2つの綴りで書かない。
const COPRODUCT_ACC_OPS = new Set(["construct", "concat", "push", "unshift"]);
// 積の連鎖（`,` は右結合なので、開くのは右だけ）。`interpreter.js` の `isChain` と同じ。
const PRODUCT_OPS = new Set(["product"]);

/**
 * **引数をレジスタとスタックへ割り振る**（AAPCS64 §6.4）。
 *
 * x0〜x7 が尽きたら残りはスタックへ積む。**またぐことはできない**——2本要る引数に1本
 * しか残っていなければ、その引数から先は全部スタックである（レジスタ側を半端に埋めて
 * 器を分断しない）。一度スタックへ回ったら、それ以降も全部スタックである。
 *
 * 呼ぶ側と受ける側が**同じ計算**を使う必要がある。2箇所で別々に数えると、片方だけが
 * 正しい命令列を出す——省略された引数の位置と同じ理由である。
 *
 * @param widths 引数ごとのレジスタ本数
 * @returns `{ slots, stackBytes }`。`slots[i].reg` が null ならスタック渡しで、
 *   置き場所は `slots[i].stackOff`（呼び出し時点の `sp` からの相対）。
 */
function assignArgSlots(widths) {
	const slots = [];
	let reg = 0;
	let stack = 0;
	let onStack = false;
	for (const w of widths) {
		if (!onStack && reg + w <= ARG_REGS.length) {
			slots.push({ reg, stackOff: null, w });
			reg += w;
			continue;
		}
		onStack = true;
		slots.push({ reg: null, stackOff: stack, w });
		stack += w * 8;
	}
	return { slots, stackBytes: Math.ceil(stack / 16) * 16 };
}

// 演算子名 → ニーモニック。**表が持つ**（operator_table.js の `asm` 欄、`asmOf`）。
//
// ここには `INT_OPS` / `DIV_FOR` / `CMP_COND` / `CMP_COND_UNSIGNED` の4本の手写しが在った。
// pass4 と、これから書く Sign 側のバックエンドは**同じ問い**を持つ——この演算子はどの命令で
// 出るのか——ので、答えを2箇所に書けば必ず片方だけ直る。表が答える。
//
// **符号で引き分けるのはここである。** `Int` は符号あり、`Address` と `Char` は符号なしで
// （`SIGNEDNESS`、target_info.js）、除算は命令そのものが分かれ（`sdiv`/`udiv`）、大小の
// 比較は条件コードが分かれる（`lt`/`lo` など）。番地を符号ありで比べると、**上位ビットの
// 立った番地**——カーネル空間の `0xFFFF…`——が負の数として扱われ、低位の番地より小さいと
// 判定される。OS を書く言語でそれは踏む。加減乗と等価（`eq`/`ne`）は2の補数で符号に依らない
// が、表は**同じ綴りを両側に置いている**ので、ここに「分かれるものだけ特別扱い」の分岐は無い。
//
// `form` は綴りの置き場所である——`alu` なら3オペランドの命令、`cond` なら `cmp` の後の
// `csel`/`ccmp` に付く条件コード。綴りを見ても区別は付かないので表が言う。
// `assign_equal` が `cond` に居るのは、`:` が定義なので `=` を比較に使えるからである。
function isAsmForm(n, form) {
	if (!n || n.type !== "operation" || n.position !== "infix") return false;
	const a = asmOf(n.name);
	return !!a && a.form === form;
}

// `ccmp` が「前の条件が偽だったとき」に置くフラグ。**その条件自身が偽になる並び**を選ぶ
// ——そうすれば連鎖の最後で条件を1つ見るだけで全体の判定になる。
// nzcv のビットは N=8 / Z=4 / C=2 / V=1。
//
// **これは表の写しではないので、ここに残る。** 鍵が演算子の綴りでも名前でもなく**条件コード**
// であり（`lt` は `<` からも連鎖比較からも来る）、答えは AArch64 のフラグの定義そのもので
// あって、どの演算子がその条件を使うかとは関係が無い。表へ移すと、同じ条件コードを持つ演算子
// の数だけ同じ値を書くことになる——そちらが「同じ事実が2箇所で決まる」形である。
const FALSE_NZCV = {
	eq: 0, // Z=0 なら eq は偽
	ne: 4, // Z=1 なら ne は偽
	lt: 0, // N==V なら lt は偽
	le: 0, // Z=0 かつ N==V なら le は偽
	gt: 4, // Z=1 なら gt は偽
	ge: 8, // N!=V なら ge は偽
	lo: 2, // C=1 なら lo は偽
	ls: 2, // C=1 かつ Z=0 なら ls は偽
	hi: 0, // C=0 なら hi は偽
	hs: 0, // C=0 なら hs は偽
};

// **番地の加減算で溢れを見る命令。** 鍵は**表が返した命令**（`add`/`sub`）であって演算子では
// ない。`FALSE_NZCV` と同じ理由で表の写しではなく、答えは AArch64 の命令の定義そのものである
// ——旗を立てる形は `S` を付けた綴り、上の語を運ぶ形は桁を足し込む `adc`/`sbc` で、桁上がりの
// 旗 C は足し算では「溢れた」、引き算では「借りが無かった」を言う。だから両辺の上の語が 0 の
// とき、溢れの条件は足し算で `hs`（C=1）、引き算で `lo`（C=0）になる。
//
// **検査するかどうかは命令でも符号でもなく、結果の型が決める**（integer_overflow.md §1——
// 溢れが致命的な `Address` だけが払う）。表の符号の軸へ `adds` を置けないのはこのためで、
// `Char` と `Raw` も符号なしだが溢れを見ない。軸に置くと、旗を読まない `adds` が文字の算術に
// 出るか、pass4 が欄を上書きするかのどちらかになる。
//
// 除算は桁上がりの旗では見られないので、この表ではなく `addressCheckOf` が別の形を選ぶ（割る数が
// 0 以下かを見る）。番地の乗算はここへ来ない——番地の域に射が無いので pass3 が `Unit` と型付けする。
const CARRY = {
	add: { flags: "adds", carryIn: "adcs", over: "hs" },
	sub: { flags: "subs", carryIn: "sbcs", over: "lo" },
};

/**
 * **その辺は負になりうるか。** 番地の算術の検査が、辺を符号で伸ばすかどうかを決める。
 *
 * 十進の字面は `Int` なので、64 ビットで回ってから符号を見る。字面のまま見ると
 * `18446744073709551615` を非負と読むが、`Int` としては -1 である——上の語を 0 と決めつけて、
 * `p + 18446744073709551615` を `p - 1` の番地のまま通していた（実測、解釈器は `__`）。
 * 番地の字面は符号なしなので字面のままでよい。
 *
 * 型の無い辺は符号なしと読む。そこへ来るのは `__`（`Unit`）で、その値は後ろの完全性公理が
 * 上書きするので、どちらに読んでも答えは変わらない（実測では、実プログラム4本と検査の全体で
 * それ以外は来なかった）。
 */
function mayBeNegative(side, em) {
	const u = unwrap(side);
	if (u && u.type === "atom" && (u.kind === "number" || u.kind === "address" || u.kind === "register")) {
		try {
			const v = literalBigInt(u.value);
			if ((u.kind === "address" ? v : BigInt.asIntN(64, v)) >= 0n) return false;
		} catch {
			// 読めないのは浮動小数だが、片側が浮動小数なら結果は `Float` なのでここへは来ない。
		}
	}
	const m = reduceToMachineType(side && side.atomType, em.conf.target);
	return !!(m && m.signed);
}

/**
 * **番地の算術で、溢れを見る形を選ぶ。** 見ないでよければ null。見るのは加減算と同じく
 * 「数学の値が 0 以上 2^64 未満か」である（integer_overflow.md §1.1）。
 *
 * - `+` / `-`：桁を運ぶ（`CARRY` と `emitAddressCarry`）。
 * - `/`：割る数が 0 以下になりうるときだけ見る（`emitAddressDiv`）。正の数で割る商は被除数を超えない
 *   ので溢れない。
 *
 * 番地の `*` はここへ来ない（番地の域に射が無いので pass3 が `Unit` と型付けし、`genExpr` が `__` を置く）。
 * 結果が番地なら左辺は番地（か `__`・生の値）なので、符号を見るのは割る数だけでよい
 * （§3.6 の左辺優先——`8 / p` は `Int`）。
 */
function addressCheckOf(mn, n, em) {
	if (CARRY[mn]) return (dst) => emitAddressCarry(n, CARRY[mn], dst, em);
	if (mn === "udiv" && (mayBeNegative(n.right, em) || mayBeZero(n.right))) return (dst) => emitAddressDiv(n, dst, em);
	return null;
}

/**
 * **番地の域では、0 以下の数で割ると `__` へ落とす**（利用者の決定、2026-09-14）。
 *
 * 商は `udiv` そのままで、割る数を見て `csel` で niche を選ぶ——`udiv` の後に2命令。割る数が `Int` なら
 * 符号ありで 0 以下（`le`）、番地なら 0（`eq`）を見る。`udiv` は負の数 `-n` を 2^64 − n と読むので商は
 * 0 か 1（被除数が 2^64 − n 以上のときだけ 1）になり、0 で割れば 0 を返す。どれも意味の無い小さな番地を
 * 黙って出す形であり、0 番地は layer 0 では読める記憶である（integer_overflow.md §1 の物差し）。以前は
 * 負の数で割ったときだけ絶対値で割ってから商が 0 かを見ていた（`cneg`・`ccmp` を含む形）が、枠の番号として
 * 負の数に意味は無いので、まとめて `__` にする。
 *
 * 呼ぶ側が `x12` に niche を置いておくこと。割る数のレジスタは `udiv` で書き換わらない。
 */
function emitAddressDiv(n, dst, em) {
	const [a, b] = SCRATCH;
	em.emit(`udiv ${dst}, ${a}, ${b}`, `${n.op}`);
	em.emit(`cmp ${b}, #0`, mayBeNegative(n.right, em) ? "割る数は 0 以下か" : "0 で割ったか");
	em.emit(`csel ${dst}, x12, ${dst}, ${mayBeNegative(n.right, em) ? "le" : "eq"}`, "0 以下で割った番地は __");
}

// その辺は 0 になりうるか。0 でない字面だけが「ならない」と言える。
function mayBeZero(side) {
	const v = literalValue(unwrap(side));
	return v === null || v === 0n;
}

/**
 * **番地の規則の n 番目は、番地の算術そのものである。** `start + n × step` を、溢れたら `__` へ落とす。
 *
 * 規則の添字はロードではなく算術なので（`genIndex` の規則の枝）、同じ物差し——数学の値が 0 以上
 * 2^64 未満か——が当たる。`madd` 1命令のままだと `[p ~+ k] ' i` は下の 64 ビットの番地を返していた
 * （実測で `f 0x10 4 2^62` が機械 0x10、解釈器 `__`）。
 *
 * **検査は作る所に置く。** 読む所（`@`）だけで見ると、作った値を名前へ置いて別の関数で読んだとき、
 * もう溢れたことが分からない——回った番地は正しい番地と同じビットだからである。
 *
 * 積は 128 ビットで取る。両辺とも符号ありで読んでよければ上の語は `smulh` そのもので、64 ビット
 * 全部を使う番地（`Address`）が混じるときだけ `umulh` から相手を引く——128 ビットで見た符号ありの積の上の語は
 * `umulh(a, b) - (b < 0 ? a : 0) - (a < 0 ? b : 0)` だからである。
 * 起点を足して上の語が 0 なら収まっている。
 *
 * 入口: x9 = start、x10 = step、x11 = 添字、x12 = niche。出口: x9。x13–x15 を壊す。
 */
function emitAddressAffine(stepSide, idxSide, startMaybeUnit, em) {
	const [s, k] = SCRATCH;
	// 64 ビット全部を使う番地か。字面が 2^63 未満なら符号ありで読んでも同じ値である。
	const wide = (side) => {
		if (!side || side.atomType !== "Address") return false;
		const v = literalValue(unwrap(side));
		return !(v !== null && v !== NICHE_VALUE && v < NICHE_VALUE);
	};
	em.emit(`mul x13, ${k}, x11`, "n × step の下の語");
	if (!wide(stepSide) && !wide(idxSide)) {
		em.emit(`smulh x14, ${k}, x11`, "上の語（符号ありで見た）");
	} else {
		em.emit(`umulh x14, ${k}, x11`, "上の語（符号なしで見た）");
		for (const [side, reg, other] of [[stepSide, k, "x11"], [idxSide, "x11", k]]) {
			if (wide(side) || (side && !mayBeNegative(side, em))) continue;
			em.emit(`asr x15, ${reg}, #63`, "負なら全部のビット");
			em.emit(`and x15, x15, ${other}`, "負なら相手、そうでなければ 0");
			em.emit("sub x14, x14, x15", "符号ありで見た上の語");
		}
	}
	const sum = startMaybeUnit ? "x13" : s;
	em.emit(`adds ${sum}, ${s}, x13`, "start + n × step（旗を立てる）");
	em.emit("adcs x14, x14, xzr", "上の語");
	em.emit(`csel ${sum}, x12, ${sum}, ne`, "上の語が 0 でなければ番地の外——__");
	if (startMaybeUnit) {
		em.emit(`cmp ${s}, x12`, "起点が __ か");
		em.emit(`csel ${s}, x12, x13, eq`, "起点が __ なら __（番地の算術は吸収する）");
	}
}

/**
 * **番地の加減算は、溢れたら `__` へ落とす**（integer_overflow.md §1.1）。
 *
 * 見るのは「数学の値が 0 以上 2^64 未満か」である。両辺をそれぞれの符号で1語伸ばし、上の語を
 * 同じ演算で運ぶ（`adcs`/`sbcs`）と、収まったときだけ上の語が 0 になる。伸ばした上の語は、
 * 符号なしの辺と非負のリテラルでは 0（`xzr`）、符号ありの辺では `asr #63`（0 か -1）である。
 *
 * **両辺とも 0 なら上の語は桁上がりそのもの**なので、`asr` と `adcs` を畳んで旗を直に読む
 * ——C の `__builtin_add_overflow(u64, u64)` を clang -O2 で落とした形と同じ2命令になる。
 * 畳めないのは符号ありの辺があるとき（`p + n` の `n` が `Int`）で、負の数を足して正しく戻る
 * 番地は符号なしで見ると必ず桁が上がる——`hs` で見ると `p + -4` がいつも `__` になる。
 *
 * 呼ぶ側が `x12` に niche を置いておくこと。`asr` を旗の命令より前に置くのは、`dst` が左辺の
 * レジスタそのもの（`x9`）であり得るからで、`asr` は旗を壊さない。
 */
function emitAddressCarry(n, carry, dst, em) {
	const upper = (side, reg, scratch) => {
		if (!mayBeNegative(side, em)) return "xzr";
		em.emit(`asr ${scratch}, ${reg}, #63`, "符号で伸ばした上の語");
		return scratch;
	};
	const hL = upper(n.left, SCRATCH[0], "x14");
	const hR = upper(n.right, SCRATCH[1], "x13");
	em.emit(`${carry.flags} ${dst}, ${SCRATCH[0]}, ${SCRATCH[1]}`, `${n.op}（旗を立てる）`);
	if (hL === "xzr" && hR === "xzr") {
		em.emit(`csel ${dst}, x12, ${dst}, ${carry.over}`, "溢れたら __");
		return;
	}
	em.emit(`${carry.carryIn} x13, ${hL}, ${hR}`, "上の語");
	em.emit(`csel ${dst}, x12, ${dst}, ne`, "上の語が 0 でなければ溢れた——__");
}

/**
 * **番地と数の比較は、数学の値で比べる**（利用者の決定 2026-09-15）。番地は 0 以上 2^64 未満、`Int` は符号ありなので、
 * 番地は負の数より常に大きい。以前は片方が符号ありなら符号ありで比べていて（`unsignedCompare`）、上半分の番地を
 * 負の数と読んでいた——`0xFFFF800000000000 > -1` が解釈器では真、機械では偽。
 *
 * 数が負になり得なければ、符号なしで比べれば数学どおりである。負になり得るなら、符号なしの比較に「数が負なら
 * 答えは決まっている」を `ccmp` 1命令で繋ぐ。負だと真になる向き（番地が左の `>` `>=` `!=`、数が左の `<` `<=` `!=`）
 * は「符号なしで真 または 数が負」、それ以外は「符号なしで真 かつ 数が 0 以上」である。`ccmp` が比べないときに置く
 * 旗 `#8`（N だけ立つ）は `lt` を真、`ge` を偽にする。
 *
 * 呼ぶ直前に `cmp x9, x10` を出しておくこと。番地と `Int` の組でなければ null（呼ぶ側の規則で出す）。
 */
const INVERSE_UNSIGNED_COND = { lo: "hs", hs: "lo", ls: "hi", hi: "ls", eq: "ne", ne: "eq" };
function emitAddressIntCondition(n, em) {
	const lt = n.left && n.left.atomType;
	const rt = n.right && n.right.atomType;
	const intLeft = lt === "Int" && rt === "Address";
	if (!intLeft && !(lt === "Address" && rt === "Int")) return null;
	const cu = asmOf(n.name).gpr.unsigned;
	if (!INVERSE_UNSIGNED_COND[cu]) return null;
	if (!mayBeNegative(intLeft ? n.left : n.right, em)) return cu;
	const negTrue = intLeft ? ["less", "less_equal", "not_equal"].includes(n.name) : ["more", "more_equal", "not_equal"].includes(n.name);
	const reg = intLeft ? SCRATCH[0] : SCRATCH[1];
	if (negTrue) {
		em.emit(`ccmp ${reg}, #0, #8, ${INVERSE_UNSIGNED_COND[cu]}`, "符号なしで偽なら、数が負か（番地は負の数より大きい）");
		return "lt";
	}
	em.emit(`ccmp ${reg}, #0, #8, ${cu}`, "符号なしで真なら、数が 0 以上か");
	return "ge";
}

// その比較を符号なしで出すか。オペランドの型が決める（結果の型ではない——結果は真偽である）。
function unsignedCompare(node, conf, env) {
	const t = (x) => {
		const u = unwrap(x);
		if (!u) return null;
		if (u.atomType) return u.atomType;
		return null;
	};
	const lt = t(node.left);
	const rt = t(node.right);
	const uns = (x) => x && SIGNEDNESS[x] === "unsigned";
	const sgn = (x) => x && SIGNEDNESS[x] === "signed";
	// どちらかが符号ありなら符号あり（`Int` と `Address` を比べる形は、そもそも稀である）。
	if (sgn(lt) || sgn(rt)) return false;
	return uns(lt) || uns(rt);
}

/**
 * 末尾呼び出しを出したという印。**値を積まない**——制御がそこから戻らないからである。
 *
 * `genExpr` は普段「積んだスロットの本数」を返すが、末尾呼び出しだけは本数を持たない。
 * `0` にすると「幅ゼロの値を積んだ」と読めてしまうので、別のものにしてある。
 */
const TAIL = Symbol("tail");

// フレームの大きさは本体を出し切るまで決まらないので、相互末尾呼び出しの
// 「フレームを畳む」命令には印だけ置いて `wrapFrame` で埋める。
const FRAME_MARK = "@@FRAME@@";

// 比較が偽のときに返す値＝`__` の niche（value_representation.md §3.5）。
// **`0` ではない。** Sign では `0` は真であり、`0 = 0` は真で `0` を返す。

// `isIdentifierNode` / `isDefineNode` / `isSlotKeyAtom` / `slotName` は layout.js から
// 引く（ファイル冒頭の import）。下の `bareName` は**別の規則**——山括弧だけを剥ぎ、
// 非文字列を綴りへ潰す——なので同名で共存させず、layout.js のものは `slotName` で受ける。
function bareName(v) {
	return typeof v === "string" && v.startsWith("<") && v.endsWith(">") ? v.slice(1, -1) : String(v);
}

// 1行だけのブロックは括りでしかない（`(a + b)` の外側）。
// 1行だけのブロックは括りでしかない（`(a + b)` の外側）。ただし**その1行が定義なら
// 剥がさない**——`x > 10 : 1` は括りではなく枝が1つの match_case である。
function unwrap(node) {
	let n = node;
	for (;;) {
		if (n && Array.isArray(n.lines) && n.lines.length === 1 && n.kind !== "abs" && n.kind !== "norm" && !isDefineNode(n.lines[0])) {
			n = n.lines[0];
			continue;
		}
		// **後置 `@`（import）も括りと同じである。** 同一オブジェクト内では「その名前を
		// 指す」以上のことをしないので（`system_architecture.md` §2.1）、剥がしてよい。
		//
		// ここで剥がすと全部の経路が一度に通る——呼び先の解決（`(inc@) 5`）、定数構造体の
		// 畳み（`DR @ (uart@)`）、添字。個々の枝で `import` を数えて回ると必ずどれかが
		// 漏れる、というのは層の門番で踏んだのと同じ形である。
		if (n && n.type === "operation" && n.position === "postfix" && n.name === "import" && n.operand) {
			n = n.operand;
			continue;
		}
		return n;
	}
}

// 文字・文字列リテラルの符号位置の並び。読めなければ null。
// サロゲートペアを2文字と数えないため `[...s]` で回す。
// **1文字かどうかは型が言う。** `Char` は Layer 2 の型であり（type_system.md §2）、
// `String` の要素である。文字列は長さによらず `String` である——`[5]` が `Int` なのは
// 1要素のリテラルの話で、文字列の長さは型を変えない。
//
// リテラルの形を見るのをやめたのは、**表現が実行時の長さで変わってはいけない**からで
// ある。`Char` はレジスタに乗る符号位置、`String` は `{ptr, len}` の参照なので、同じ型が
// 両方を指すと実行時に見分ける必要が出る——それは動的型付けである。
/**
 * 値がスロットを何本占めるか。**「渡し方」がそのまま「スタックマシンの幅」である**
 * （stack_abi.md §4.6）——スカラーは1本、要素の並びは `{ptr}` / `{ptr, len}` で1〜2本。
 *
 * ただし `__` だけは §4.6 の表と食い違う。あちらは「零対象は何も渡らない」（0本）と
 * 言うが、Pass 4 の `__` は**直和 `L | R | __` の一員としてレジスタに乗る niche**
 * であって「引数が無い」ことではない（value_representation.md §3.5）。比較が偽のとき
 * 返るのはこの値なので、幅を 0 にすると置き場所が消える。
 *
 * 直和や族（`Char | String` など）は渡し方が決まらないので `null` を返す。呼ぶ側は
 * 黙って1本と決めつけず、名指しで落とす。
 */
function slotsOf(type, conf) {
	// 型しか手元に無いときの入口。答えは下の `slotsOfNode` と同じ規則なので、型注釈だけの
	// ノードに包んでそちらへ渡す（型注釈が無いものを1本として扱うのも向こうが持つ）。
	return slotsOfNode({ atomType: type }, conf);
}

/**
 * ノードから幅を引く。**型だけでは場所か規則か決まらない。**
 *
 * `[1 ~ 5]` の型は `List` だが実体は規則であり（`repr: "rule"`）、運ぶのは `{ptr, len}` の
 * 2本ではなく `{start, step, end}` の3本である（stack_abi.md §4.6 の「規則」の行）。
 * 型だけを渡していたので、レンジが参照として数えられていた——`layout.js` は最初から
 * 正しく答えていて、こちらが訊き方を間違えていた。
 *
 * 「型は何ができるかしか語らない。どう置かれているかは `repr` に印として残す」という
 * pass3 の設計を、ここで使い切る。
 */
function slotsOfNode(node, conf, env) {
	if (!node) return null;
	if (!node.atomType || node.atomType === "Unit") return 1;
	// `env` を渡すと `deref` が束縛まで辿り、`repr` と要素型を引き継ぐ——`c : [0 ~+ 1]`
	// と束縛してから `c ' 3` と書いたとき、識別子ノード自身は実体の種類を知らないが
	// 束縛は知っている（pass3 が書き戻している）。
	const pass = passingOf(node, { target: conf.target, charset: conf.charset, env });
	return pass ? Math.max(pass.slots, 1) : null;
}

/**
 * **`Nu` の幅も、言ったなら守らせる。**
 *
 * `literalParts` は `u` の幅をちゃんと計算している（`8u` なら 1 byte、`12u` なら機械に
 * 無いので NaN）。ところが `unicode` リテラルの利用者は**全員 `literalDigits` しか読んで
 * いなかった**——幅は計算されて、誰にも引かれていなかった。
 *
 * 実測（どちらも診断ゼロ）：`8u3042` が「あ」を返す（0x3042 は 1 byte に入らない）。
 * `12u41` が「A」を返す（12 ビット幅の読み書きは機械に無い）。`Nx` の側（`@`/`#`）は
 * 同じ問いを3箇所で立てているのに、`u` の側には一度も無かった。
 *
 * **1箇所で決めたのに誰も引かない**、という形である。今日ずっと出てきた「同じ事実が
 * 2箇所」のちょうど裏返しで、片方は食い違い、こちらは素通りになる。
 *
 * `0u` は「幅を言っていない」なので何も言わない（`option.ms` へ落ちる）。
 */
function unicodeWidthError(n) {
	if (!n || n.type !== "atom" || n.kind !== "unicode") return null;
	const p = literalParts(n.value);
	if (!p || p.family !== "u") return null;
	if (Number.isNaN(p.width)) return "その幅の命令が機械にありません（プリフィックスの数を見直してください）";
	if (p.width === null) return null; // `0u` は幅を言っていない
	const cp = parseInt(p.digits, 16);
	if (!Number.isFinite(cp)) return null;
	// 8 byte 以上は符号位置の側が先に尽きるので、問う意味が無い。
	if (p.width < 8 && cp >= 2 ** (p.width * 8))
		return `符号位置がプリフィックスの幅に入りません（0x${p.digits} は ${p.width} byte に収まりません——幅を上げるか 0u と書いてください）`;
	return null;
}

function codePointsOf(n) {
	if (n.kind === "char") return [...n.value.slice(1)].map((c) => c.codePointAt(0));
	if (n.kind === "string") return [...n.value.slice(1, -1)].map((c) => c.codePointAt(0));
	if (n.kind === "unicode") {
		const cp = parseInt(literalDigits(n.value), 16);
		// U+0000 は niche であって文字ではない（value_representation.md §3）。
		return Number.isNaN(cp) ? null : cp === 0 ? [] : [cp];
	}
	return null;
}

function applyChain(node) {
	const args = [];
	// **根は剥がしてから返す。** 括りも後置 `@`（import）も「その名前を指す」だけなので、
	// `(inc@) 5` の呼び先は `inc` である。ここを剥がさないと呼び先が識別子に見えず、
	// 「まだ出せない識別子です」で止まる。
	let n = unwrap(node);
	while (n && n.type === "operation" && (n.name === "apply" || n.name === "partial_apply")) {
		args.unshift(n.right);
		n = unwrap(n.left);
	}
	return { base: n, args };
}

/**
 * **単相化**（compiler_pipeline.md §3 の IMPORTANT）。
 *
 * `@p x` は「どこへ跳ぶか」が実行時にしか分からない形だが、Sign はそこへ実行時
 * ディスパッチを置かない——**呼び出しサイト単位で具体化する**（type_system.md §4 の
 * 前置 `@`）。Rust の単相化と同じで、`dyn` の側は採らない。
 *
 * 具体化すると**関数ポインタの引数は消える**。アドレスが命令へ焼き込まれるので、
 * レジスタで運ぶ必要が無くなる——`stack_abi.md` の比較表が Sign の欄に
 * 「コンパイル時特殊化（コストゼロ）」と書いているのはこのことである。
 *
 *   take_while : p s ? @p s
 *   take_while $is_digit s   →  bl take_while$is_digit   （引数は s だけ）
 *
 * @returns Map<関数名, { ptrParams: string[], instances: Map<鍵, {callees, label}> }>
 */
/** 仮引数 `name` に書かれたデフォルト式（無ければ null）。 */
function defaultOfParam(lambdaNode, name) {
	const p = lambdaNode && lambdaNode.left;
	if (!p || p.type !== "params") return null;
	const e = (p.entries || []).find((x) => x && x.name === name);
	return (e && e.default) || null;
}

/**
 * ラムダが**外の関数の束縛**を捕まえているか。
 *
 * 自分の仮引数は**仮引数の並びから**取る。スコープの深さでは決まらない——多引数の
 * ラムダはスコープがカリー化されて入れ子になり、`p q ? p * q` の一番内側は `q` しか
 * 持たず、`p` はその親（同じラムダの外側の段）に居る。深さで見ると自分の仮引数を外の
 * 関数の束縛と取り違える（実際に取り違えて、2引数の無名ラムダだけ吊り上がらなかった）。
 *
 * 仮引数でも本体の局所でもない名前は、上へ辿って最初に見つかった所で判定する——
 * トップ（親の無いスコープ）なら大域で捕獲ではなく、途中なら外の関数の束縛である。
 * 迷った側は「捕まえる」に倒れる——吊り上げないだけなので安全側である。
 */
function capturesFreeVars(lam) {
	const own = lam && lam.scope;
	if (!own) return true;
	const mine = new Set();
	const collect = (pn) => {
		if (!pn) return;
		if (isIdentifierNode(pn)) { mine.add(pn.value); return; }
		if (pn.type !== "params") return;
		for (const en of pn.entries || []) {
			if (en.name) mine.add(en.name);
			if (en.pattern) collect(en.pattern);
		}
	};
	collect(lam.left);
	const ids = [];
	const walk = (n) => {
		if (!n || typeof n !== "object") return;
		if (n.type === "atom" && n.kind === "identifier") ids.push(n.value);
		for (const k of ["left", "right", "operand", "middle"]) walk(n[k]);
		for (const l of n.lines || []) walk(l);
		for (const en of n.entries || []) walk(en.default);
	};
	walk(lam.right);
	for (const id of ids) {
		if (mine.has(id) || (own.bindings && own.bindings.has(id))) continue;
		for (let s = own.parent; s; s = s.parent) {
			if (s.bindings && s.bindings.has(id)) {
				if (s.parent) return true;
				break;
			}
		}
	}
	return false;
}

function collectMonomorphs(nodes) {
	const table = new Map();
	// デフォルトに直接書かれたラムダへ与えた名前。呼び出しサイトの走査で埋まる。
	const hoisted = new Map();
	table.hoisted = hoisted;
	// 呼び出しサイトで `$` を付けた無名のラムダへ与えた名前（節 → ラベル）。同じ節は同じ名前。
	const anonLabels = new Map();
	// まず「アドレス経由で呼ばれる仮引数」を持つ関数を見つける。
	for (const node of nodes) {
		if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
		const rhs = node.right;
		if (!rhs || rhs.type !== "operation" || rhs.name !== "lambda") continue;
		// **名前を持たない仮引数があっても具体化はできる。** 関数ポインタになれるのは裸の
		// 仮引数だけだが、同じ仮引数リストに `[~s]` のような分解の形が混ざることはある
		// ——以前はそこで諦めていたので、器を宣言の形で受けた瞬間に単相化が効かなくなり、
		// `@p` が「呼び先が静的に決まりません」になっていた。位置は保つ（`indexOf` が
		// 実引数の位置と対応する必要があるため）。
		const params = paramShapesOf(rhs.left).map((sh) => (sh && sh.kind === "bare" ? sh.name : null));
		const ptrParams = [];
		const visit = (n) => {
			if (!n || typeof n !== "object") return;
			// `@p` が適用の根に来ている＝アドレス経由の呼び出しである。
			if (n.type === "operation" && (n.name === "apply" || n.name === "partial_apply")) {
				const { base } = applyChain(n);
				if (base && base.type === "operation" && base.position === "prefix" && base.name === "input" && isIdentifierNode(base.operand)) {
					const v = base.operand.value;
					if (params.includes(v) && !ptrParams.includes(v)) ptrParams.push(v);
				}
			}
			for (const k of ["left", "right", "operand"]) visit(n[k]);
			for (const l of n.lines || []) visit(l);
			for (const e of n.entries || []) visit(e.default);
		};
		visit(rhs.right);
		// **デフォルトにラムダを書いた仮引数は、関数内関数である。** そこは `@p` ではなく
		// `p x` と直接呼ぶ——`p` は関数であってアドレスではないからである。`@p` の形だけを
		// 見ていたので、この書き方が単相化の網から丸ごと漏れていた。
		// **判定は pass2 が済ませている。** Layer 1 のカテゴリがそこで決まる——ラムダも
		// ポイントフリー（`[+ 2]` / `[* 2,]`）も「書かれた形」から `Lambda` になる。
		// ここで形を見直すと2箇所で別々に数えることになり、片方だけが当たる。
		for (const e of (rhs.left && rhs.left.entries) || []) {
			if (!e.name || !e.default || !params.includes(e.name) || ptrParams.includes(e.name)) continue;
			const b = rhs.scope ? envLookup(rhs.scope, e.name) : null;
			if (b && b.category === "Lambda") ptrParams.push(e.name);
		}
		if (ptrParams.length > 0) table.set(bareName(node.left.value), { params, ptrParams, instances: new Map(), lambda: rhs });
	}
	if (table.size === 0) return table;
	// 次に呼び出しサイトを歩いて、どの関数が渡されているかを集める。
	const visitSites = (n) => {
		if (!n || typeof n !== "object") return;
		if (n.type === "operation" && (n.name === "apply" || n.name === "partial_apply")) {
			const { base, args } = applyChain(n);
			if (isIdentifierNode(base)) {
				const entry = table.get(bareName(base.value));
				if (entry) {
					const callees = {};
					let ok = true;
					for (const pn of entry.ptrParams) {
						const i = entry.params.indexOf(pn);
						// **省略されたなら、デフォルトが渡している。** `g : $dbl` と書いた
						// 仮引数は、実引数が無ければその `$dbl` が入る——呼び出しサイトに
						// 書いていないだけで、渡す先は決まっている。ここを見ていなかった
						// ので、デフォルトで関数を渡す形が「具体化できる呼び出しサイトが
						// 無い」になっていた。仮引数リストは関数の状態ベクタであり
						// （function_guide.md）、デフォルトはその初期値である。
						const a = args[i] || defaultOfParam(entry.lambda, pn);
						// **デフォルトに書いたラムダは関数内関数の定義である。** 関数を
						// 定義するのに `$` は要らない——トップレベルの `dbl : y ? y * 2` と
						// 同じことを仮引数リストの中でしているだけである（`$` はアドレスを
						// 取る側の話であって、定義とは別）。名前が無いので、ここで名前を
						// 与えて実体として出す。具体化は名前で結ぶので、名前さえ在れば
						// `$名前` を書いたのと同じ道に乗る。
						// ポイントフリー（`[+ 2]` / `[* 2,]`）もここへ来る。判定は pass2 の
						// カテゴリを読む——書かれた形から決まっているので、形を見直さない。
						const pb = entry.lambda.scope ? envLookup(entry.lambda.scope, pn) : null;
						const inline = a && pb && pb.category === "Lambda" && !(a.position === "prefix" && a.name === "address") ? a : null;
						if (inline) {
							const label = `${bareName(base.value)}$${bareName(pn)}`;
							if (!hoisted.has(label)) hoisted.set(label, inline);
							callees[pn] = label;
							continue;
						}
						// **無名のラムダに `$` を付けたものも、名前を与えれば `$名前` と同じ道に乗る。**
						// 上のデフォルトの吊り上げと同じ理屈で、名前が無いぶんをここで作る。名前には `$` を
						// 含めるので利用者の識別子と衝突しない（Sign の字句では `$` は演算子であり、名前に
						// 書けない）。アセンブリのラベルは `$` を普通に使えるので、`app$add` と同じ慣習に乗る。
						//
						// **捕獲するものは吊り上げない。** 自由変数を持つラムダをトップへ出すと、捕まえた
						// 変数の置き場が無い——それは仮引数へ足して通すリフティングの仕事で、まだ無い。
						// 吊り上げずに通すと ok = false のまま下の診断へ落ちる（黙って壊れた実体は出さない）。
						if (a && a.type === "operation" && a.position === "prefix" && a.name === "address") {
							const lam = unwrap(a.operand);
							if (lam && lam.type === "operation" && lam.name === "lambda" && !capturesFreeVars(lam)) {
								let label = anonLabels.get(lam);
								if (!label) {
									label = `${bareName(base.value)}$${bareName(pn)}$${anonLabels.size}`;
									anonLabels.set(lam, label);
									hoisted.set(label, lam);
								}
								callees[pn] = label;
								continue;
							}
						}
						// `$名前` だけを具体化できる。式で作ったアドレスは静的に決まらない。
						if (a && a.type === "operation" && a.position === "prefix" && a.name === "address" && isIdentifierNode(a.operand)) {
							callees[pn] = bareName(a.operand.value);
						} else ok = false;
					}
					if (ok) {
						const key = entry.ptrParams.map((pn) => callees[pn]).join("$");
						if (!entry.instances.has(key)) {
							entry.instances.set(key, { callees, label: `${bareName(base.value)}$${key}` });
						}
						n.monoLabel = entry.instances.get(key).label;
						n.monoDrop = entry.ptrParams.map((pn) => entry.params.indexOf(pn));
					}
				}
			}
			args.forEach(visitSites);
			return;
		}
		for (const k of ["left", "right", "operand"]) visitSites(n[k]);
		for (const l of n.lines || []) visitSites(l);
		for (const e of n.entries || []) visitSites(e.default);
	};
	for (const n of nodes) visitSites(n);
	return table;
}

/**
 * 仮引数の形を宣言順で返す。
 *
 *   { kind: "bare", name }              裸の仮引数
 *   { kind: "destructure", head, rest } ブラケット分割代入 `[h ~t]`
 *   null                                まだ出せない形（rest・デフォルト）
 *
 * 名前だけが要る場所（単相化＝`collectMonomorphs`）は、ここから `kind === "bare"` の
 * 名前を拾って使う。単相化が見るのは「名前で呼べる仮引数」だけであり、分割代入された
 * 仮引数は関数ポインタになりえないためである。
 */
// スロットのキーになれるノード＝`isSlotKeyAtom` は layout.js の `isSlotKeyNode`
// （冒頭で別名 import）。かつてここにも写しがあり、片方だけ広げると**同じソースが
// 解釈器では構造体・機械語では match_case になる**——その壊れ方は layout.js のコメントへ。

/**
 * **構造体ブロックか。** `p : / foo : 10 / …` は match の並びと**同じ形**をしている
 * ので、`lines` の並びでは見分けられない。見分けているのは Pass 3 で、構造体には
 * `atomType: "Struct"` が付き、match の並びには枝の結果型が付く。
 *
 * ここを形だけで見ていたため、値として使われた構造体が genMatch に吸われ、フィールド名を
 * 枝の条件式として出そうとしていた。**フィールド名がたまたまトップレベル定数へ束縛されて
 * いると診断が消え、機械語だけが別の答えを返す**——`q : 7` があるところで
 * `p : / q : 10 / r : 20` を値として使うと、解釈器は `{q:10, r:20}`、機械語は 7 を条件に
 * 使った match_case を出して 10 を返していた（診断0件）。
 *
 * **`atomType` だけでは足りない。** 括弧の中身も1行のブロックとして現れ、枝の結果が余積に
 * なった match の並びも `Struct` 型になる——実測で `(dup s)` と `c = `a` : c c (v rest)` の
 * 両方が `atomType: "Struct"` の block だった。**全行が「スロット名 : 値」であること**まで
 * 見て、はじめて構造体である（Pass 3 の slotKey 判定と同じ基準）。
 */
function isStructBlock(n) {
	if (!n || !Array.isArray(n.lines) || n.lines.length === 0) return false;
	if (n.atomType !== "Struct") return false;
	if (n.slotKind === "named" || n.mergedSlots) return true;
	// 撒く行を含む形（`[zz : 1 / p~]`）には Pass 3 が slotKind を立てないが、構造体である。
	// **撒く行が現に在ること**を要求する——要求しないと、スロット名の形をした枝を持つ
	// match の並び（`a : (1,2)` のような形）まで構造体に見えてしまう。
	let sawExpand = false;
	for (const line of n.lines) {
		const l = unwrap(line);
		if (l && l.type === "operation" && l.name === "expand") { sawExpand = true; continue; }
		if (isDefineNode(l) && isSlotKeyAtom(l.left)) continue;
		return false;
	}
	return sawExpand;
}

function paramShapesOf(paramNode) {
	if (isIdentifierNode(paramNode)) return [{ kind: "bare", name: paramNode.value }];
	if (!paramNode || paramNode.type !== "params") return [];
	// 仮引数が `[h ~t]` **だけ**のときは、括弧が仮引数リスト全体に付く（`bracket: true`）。
	// 入れ子の `pattern` にはならないので、ここで拾う——同じ形の別の書かれ方である。
	if (paramNode.bracket) {
		const es = paramNode.entries || [];
		if (es.length === 2 && !es[0].rest && es[1].rest && !es[0].default && !es[1].default) {
			return [{ kind: "destructure", head: es[0].name, rest: es[1].name }];
		}
		// `[~x]` は**切り出さず丸ごと受ける**形である（n_queens.sn の「分解の形には2つある」）。
		// 受け取り方は裸の仮引数と同じ1つの値であり、違うのは**型の宣言**の方——器である
		// ことを言っているので `__` がそこを通れない。それは Pass 3 の仕事であって、
		// 機械の上ですることは裸の仮引数と変わらない。
		if (es.length === 1 && es[0].rest && !es[0].default && es[0].name) {
			return [{ kind: "bare", name: es[0].name, defaultNode: null, whole: true }];
		}
		// **名前で分ける形**（`[foo bar ~obj]`）。構造体を名前で分解する
		// （function_guide.md「構造体メンバーの一致による自動バインディング」）。渡って
		// くるのは `{ptr}` 1本で、名前はコンパイル時にオフセットへ解決されるので
		// （名前でソートした正規順）、機械の上ですることは固定オフセットからのロードである。
		// `~obj` は器そのもの＝その `ptr` を指す。
		if (es.length >= 2 && es[es.length - 1].rest && es[es.length - 1].name && es.slice(0, -1).every((e) => e.name && !e.rest && !e.pattern && !e.default)) {
			// **構文だけでは読み方が決まらない。** 名前で分けるのは器が構造体のときで、
			// List / String なら位置で取る（そちらには名前が無いので位置しか残らない）。
			// どちらか一方しか成立しない、というだけのことなので、決めるのは型である
			// ——`paramRegWidths` が並びを引けたら名前、引けなければ位置として読む。
			// 先頭たちは `names` と `heads` の両方で持たせておく。
			const heads = es.slice(0, -1).map((e) => e.name);
			return [{ kind: "fields", names: heads, heads, rest: es[es.length - 1].name }];
		}
		return [null];
	}
	// **ストリーム形（`x ~xs`）は、実体化された器が渡る限り器形と同じ機械である。**
	//
	// 違うのは laziness——`~xs` は残りを包む遅延ストリームとしてサスペンドされる
	// （list_model.md §2.4①）——であって、渡ってくるのが `l~` のように実体化された
	// `{ptr, len}` なら、頭を読んで ptr を進め len を1減らすという操作は変わらない。
	// **サスペンドが効くのは相手が生成器のときだけ**であり、そちらはカーソルの道である。
	//
	// §5.4 が `~` 無しの List 渡しを禁じているので、ここへ来るのは展開された形だけである。
	if (
		!paramNode.bracket &&
		(paramNode.entries || []).length === 2 &&
		paramNode.entries[1] &&
		paramNode.entries[1].rest &&
		paramNode.entries[1].name &&
		paramNode.entries[0] &&
		paramNode.entries[0].name &&
		!paramNode.entries[0].rest &&
		!paramNode.entries[0].pattern &&
		!paramNode.entries[0].default &&
		!paramNode.entries[1].default
	) {
		return [{ kind: "destructure", head: paramNode.entries[0].name, rest: paramNode.entries[1].name, stream: true }];
	}
	return (paramNode.entries || []).map((e) => {
		if (e.pattern) {
			// いま出せるのは `[h ~t]`——先頭と残りの2つに割る形だけである。
			const p = e.pattern;
			// `[~x]`（混在形）。丸ごと受けるので裸の仮引数と同じ扱いになる。
			// **デフォルトは付きえない**——参照が指すのは呼び出し側が置いた記憶なので、
			// 既定値を作る場所が無い（pass2.js が構文エラーで弾く）。
			if (p.length === 1 && p[0].rest && !p[0].defaultTokens && p[0].name) {
				return { kind: "bare", name: p[0].name, defaultNode: null, whole: true };
			}
			if (p.length === 2 && !p[0].rest && p[1].rest && !p[0].defaultTokens && !p[1].defaultTokens) {
				return { kind: "destructure", head: p[0].name, rest: p[1].name };
			}
			return null;
		}
		if (e.rest) return null;
		// **デフォルトを持つ仮引数も裸である。** 違うのは「渡されなかったとき何を置くか」
		// だけであり、受け取り方は同じ1つの値である。デフォルト式はここでは持ち回るだけで、
		// 生成するのは `genFunction`——`let*` の順で、前の仮引数が既に置かれた後に評価する
		// 必要があるためである（1_definition.md §6.1）。
		return e.name ? { kind: "bare", name: e.name, defaultNode: e.default || null } : null;
	});
}

/**
 * ブラケット分割代入 `[h ~t]` を、渡ってきた `{ptr, len}` から作る。
 *
 * **コピーは起きない。** 要素の並びは参照で渡ってくる（stack_abi.md §4.6）ので、
 * 先頭は指す先の1要素、残りは**同じ領域を指したまま `ptr` を1要素進めて `len` を1
 * 減らしたもの**である。`t` のスロットは容器のスロットをそのまま使い回せる。
 *
 *   h = ptr[0]
 *   t = { ptr + sizeof(要素), len - 1 }
 *
 * **これが終端になる。** 残りが尽きると `len` が 0 になり、`len = 0` は `__` そのもの
 * （`__ = []`、unit.md）なので、次の呼び出しは完全性公理で崩壊する
 * ——`function_guide.md` が「ブラケット分解でなければ完全性公理が終端を与えられない」と
 * 書いているのは、この形のことである。
 */
/**
 * **スカラー1つを、長さ1の器へ持ち上げる。**
 *
 * `[x] ≅ x` は型の上では無償だが、表現では有償である（原理8）。スカラーはレジスタ1本、
 * 器は `{ptr, len}` の2本なので、器の表現が要る場所では場所を取って値を置くしかない。
 *
 * これは前置 `~`（`continuous`）そのものである。呼ぶ側が仮引数の形に合わせて払う費用と、
 * 書き手が `~x` と書いて求める持ち上げは、同じ1つの操作である——だから同じ命令を出す。
 *
 * 幅は 8 byte で置く。要素が 1/2/4 byte でも読む側は下位から読むので（LE）値は一致し、
 * 残り（`len = 0`）は誰も辿らない。
 *
 * @param valueOff スカラーが載っているフレームのオフセット
 * @returns 器の ptr スロットのオフセット。スロットが尽きたら null。
 */
/**
 * **その層で場所を取れるか**（門番）。取れないなら理由を名指しして false を返す。
 *
 * `option_ms_schema.md` §4 の表が `layer: 0` を「RAM 未初期化。alloca ✗」と定めている。
 * `sub sp` はまさにその alloca なので、layer 0 では出してはいけない——BIOS/UEFI の初期
 * フェーズに相当する層で、未初期化のハードウェアへ触ることを構造的に防ぐのが層の役目で
 * ある（`build_system.md` §4.1）。
 *
 * **判定はここ1箇所に集める。** 場所を取る式は6通りあり（持ち上げ・sret・匿名式・器の
 * 構築…）、それぞれの枝で書くと必ずどれかが漏れる——実際、判定は sret の枝にしか入って
 * おらず、`layer: 0` で器の構築も `$匿名式` も素通りしていた。
 *
 * これは「まだ出せない」とは**別の種類の拒否**である。実装の穴ではなく設計上の結論なので、
 * 文面もそう書く。
 */
function allocaAllowed(em, n, what) {
	if (em.conf.layer === undefined || em.conf.layer >= 1) return true;
	em.fail(
		n,
		`layer: ${em.conf.layer} では場所を取れません（${what}）。` +
			"alloca が使えるのは layer: 1 以上です（option_ms_schema.md §4）——" +
			"切り出しと MMIO は確保が要らないので layer: 0 でも使えます"
	);
	return false;
}

function emitLiftToContainer(em, node, valueOff, why) {
	if (!allocaAllowed(em, node, "長さ1の器へ持ち上げる")) return false;
	em.emit(`sub sp, sp, #16`, why || "1要素ぶんの場所を取る（同型の持ち上げ）");
	em.movedSp = true;
	em.load(SCRATCH[0], valueOff);
	em.emit(`str ${SCRATCH[0]}, [sp, #0]`, "長さ1の器として置く");
	// **`__` は長さ1の器ではなく、空の器である**（`__ = []`、unit.md）。持ち上げても
	// 空のままでなければならない。ここで無条件に `len = 1` を置くと、受ける側の完全性
	// 公理（`cmp len, #0`）が発火せず、`f __` で本体が走ってしまう——実際 `f : [~a] ? 99`
	// に `__` を渡すと機械は `99` を返していた（解釈器は `__`）。
	//
	// **`__ = []` を決める場所はここ1箇所にする。** 持ち上げる側と受ける側の2箇所で
	// 別々に決めていたのが原因で、片方だけが `__` を知っている状態になっていた。
	em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
	em.emit(`cmp ${SCRATCH[0]}, x12`);
	em.emit(`mov ${SCRATCH[1]}, #1`, "len は 1");
	em.emit(`csel ${SCRATCH[1]}, xzr, ${SCRATCH[1]}, eq`, "ただし __ なら len = 0（__ = []）");
	em.emit(`mov ${SCRATCH[0]}, sp`, "ptr");
	const [po, lo] = pushPair(em);
	if (lo === null) return null;
	em.store(SCRATCH[0], po, "ptr");
	em.store(SCRATCH[1], lo, "len");
	return po;
}

/**
 * **代金を払わない持ち上げ。**
 *
 * 要素が参照で運ばれる器（`List(String)`、1要素 16 byte）へ、元の器の中に居る値を
 * 積む。`A ' i` の指す1つは既にどこかに在るので、`{A.ptr + i×幅, 1}` がそのまま
 * 長さ1の器である——確保は1バイトも起きない。
 *
 * **`emitLiftToContainer` はここでは使えない。** あれは `sub sp` で場所を取るので、
 * 再帰の中で使うと**返った後の枠を指した器**を返すことになる。字句解析器の
 * `(s ' 0) , (tokens (s ' 1~))~` がまさにその形で、1文字のトークンだけが壊れる。
 * 元の器は呼ぶ側が持っているので、そこを指すぶんには寿命の問題が無い。
 *
 * 原理8 は「同型は型では無償、表現では有償」と言うが、**元の器の中に居る値に限って
 * は表現でも無償である**——`String ≅ List(Char)` の Char はもともと器の中の1要素だから。
 *
 * 積んだ結果は 2 スロット（ptr, len）。持ち上げられない形なら null を返す。
 */
function emitSliceLift(em, node, env, scope) {
	const u = unwrap(node);
	if (!u || u.type !== "operation" || u.name !== "get_prop") return null;
	const base = unwrap(u.left);
	if (!base) return null;
	// 参照で運ばれる器の中の値であること。規則（`{start, step, end}`）は要素がどこにも
	// 置かれていない（`start + n × step` の算術で出る）ので、指せる場所が無い。
	if (slotsOfNode(base, em.conf, env) !== 2) return null;
	if (isRuleNode(base, em.conf, env)) return null;
	const ec = elementCellSize(elementTypeOfNode(base, env), em.conf);
	if (!ec || !ec.size) return null;
	// 要素そのものが参照で運ばれるなら、それは既に器である（持ち上げは要らない）。
	if (ec.size === 16) return null;
	const shift = ec.size === 8 ? 3 : ec.size === 4 ? 2 : ec.size === 2 ? 1 : 0;
	const bw = genExpr(base, env, em, scope);
	if (bw === false) return false;
	if (bw !== 2) { em.pop(bw === TAIL ? 0 : bw); return null; }
	const bo = (em.slot - 2) * 8;
	const iw = genScalar(u.right, env, em, scope, "添字はレジスタ1本の値です");
	if (iw === false) return false;
	const io = (em.slot - 1) * 8;
	em.load(SCRATCH[0], bo, "元の器の ptr");
	em.load(SCRATCH[1], io, "添字");
	em.load("x11", bo + 8, "元の器の len");
	if (shift) em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}, lsl #${shift}`, "ptr + i×幅（確保は起きない）");
	else em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}`, "ptr + i×幅（確保は起きない）");
	em.emit(`cmp ${SCRATCH[1]}, x11`, "範囲内か");
	em.emit("mov x12, #1");
	em.emit("mov x13, #0");
	em.emit(`csel ${SCRATCH[1]}, x12, x13, lo`, "長さは 1（範囲外なら 0 ＝ __）");
	em.pop(3);
	const [po2, lo2] = pushPair(em);
	if (lo2 === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
	em.store(SCRATCH[0], po2, "長さ1の器の ptr（元の器の中を指す）");
	em.store(SCRATCH[1], lo2, "len");
	return po2;
}

/**
 * **実行時に `__` になった要素は、並べない**（連結の単位元）。
 *
 * `__` は連結の単位元なので `1 __ 3` は `[1 3]` である。書かれた `__` は
 * 既に落としてある（`parts` のフィルタ）が、**走らせてみないと分からない** `__`
 * ——範囲外の添字、尽きた選択写像、`__` を返す呼び出し、偽の比較、既定の引数——
 * が残る。**法は書かれたか計算されたかを問わない**ので、そちらも同じく落とす。
 *
 * 見分け方は運び方で決まる。スカラーは niche（`INT64_MIN`）そのもの、器は `len = 0`
 * である。niche は定数を置かずに見分けられる——**0 から引いて溢れるのは `INT64_MIN`
 * だけ**だから、`negs xzr, x` の V がそのまま答えになる（実機で確認：niche→1、
 * `0`/`1`/`-1`/`0x7FFF…FF`/`0x8000…01`/`0x4000…`→0）。定数を組む綴り
 * （`movz` + `cmp` + `b.eq`）より1本短く、しかも**レジスタを1本も食わない**
 * ——写す枝の中で使えるのはそのためである。
 *
 * **飛び先は照合より手前に置く。** `__` は場所を消費しないので、器がちょうど
 * 満杯のときに `__` が来ても器ごと `__` に落としてはならない。
 *
 * 払うのは `__` になり得る要素だけである（`cannotBeUnit`）。リテラルの並びは
 * 今まで通り静的なオフセットと静的な長さで出る。
 *
 * @param reg  スカラーなら値そのもの、器なら `len` を持つレジスタ
 * @param kind `"scalar"`（niche を見る）か `"len"`（0 を見る）
 * @returns 飛び先のラベル。払わないなら null（呼ぶ側は `em.label` を出さない）
 */
function emitUnitSkip(em, node, env, scope, reg, kind) {
	if (cannotBeUnit(node, env, scope)) return null;
	const skip = em.newLabel("nofill");
	if (kind === "len") {
		em.emit(`cbz ${reg}, ${skip}`, "len = 0 は __（連結の単位元）");
	} else {
		em.emit(`negs xzr, ${reg}`, "この要素は __ か（niche だけが 0 から引くと溢れる）");
		em.emit(`b.vs ${skip}`, "__ は並べない（連結の単位元）");
	}
	return skip;
}

/**
 * `[x1 … xn ~r]` を出す。**先頭を n 個読んで、残りは同じ領域を指したまま頭をずらす。**
 *
 * 分解は受け取った器を指し直すだけであり、確保は起きない
 * （`layer_relations.md` の「分解 `[c ~r]` … 受け取った器を指し直すだけ」）。n 個でも
 * 同じで、`ptr` を n 要素ぶん進めて `len` を n 減らすだけである——1個のときの繰り返し
 * でしかないので、`[h ~t]` と `[a b c ~d]` の間に段差は無い。
 *
 * @param headOffs 先頭たちを置くスロットのオフセット（宣言順）
 */
function emitDestructure(em, containerOff, headOffs, elemSize, signed, name) {
	const offs = Array.isArray(headOffs) ? headOffs : [headOffs];
	em.load(SCRATCH[0], containerOff, `${name} の先頭を取り出す`);
	em.load("x11", containerOff + 8, "器の長さ");
	// 要素の幅ぶんだけ読む。符号ありで 8 byte 未満なら符号拡張が要る。
	const mnemonic = (base) =>
		elemSize === 8 ? `ldr ${SCRATCH[1]}, [${base}]`
		: elemSize === 4 ? `ldr${signed ? "sw " + SCRATCH[1] : " w10"}, [${base}]`
		: elemSize === 2 ? `ldr${signed ? "sh " + SCRATCH[1] : "h w10"}, [${base}]`
		: `ldr${signed ? "sb " + SCRATCH[1] : "b w10"}, [${base}]`;
	// **器より多くの頭は取れない。** 足りないスロットは `__` であって、器の外に在った値
	// ではない。検査が無かったので `f : [a b c ~d] ? c` に `[7 8]` を渡すと `0` が、
	// `d ' 0` に至っては RAM の番地がそのまま返っていた。
	//
	// **器の外は読まない**（`emitSafeReadAddress`）。以前は「高々数要素ぶんの先読みにしかならない」として
	// 読んでから選んでいたが、layer 0 では器のすぐ後ろが MMIO のレジスタでありうる。
	if (offs.length > 1) em.emit("movz x12, #0x8000, lsl #48", "範囲外は __");
	offs.forEach((headOff, i) => {
		// **1個目は検査が要らない。** 入口の門番が `len = 0`（＝`__`）を弾いているので、
		// ここへ来た時点で器は少なくとも1要素ある——門番が証明したことを本体で払い直さない。
		if (i === 0) {
			em.emit(mnemonic(SCRATCH[0]), `${elemSize} byte の要素1つ（${i + 1} 個目）`);
		} else {
			em.emit(`cmp x11, #${i}`, `${i + 1} 個目は器の中か`);
			emitSafeReadAddress(em, "x13", SCRATCH[0], "hi", "x14");
			em.emit(mnemonic("x13"), `${elemSize} byte の要素1つ（${i + 1} 個目）`);
			em.emit(`csel ${SCRATCH[1]}, ${SCRATCH[1]}, x12, hi`, "器の外なら __");
		}
		em.store(SCRATCH[1], headOff, offs.length === 1 ? "先頭" : `先頭から ${i + 1} 個目`);
		em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, #${elemSize}`, "1要素ぶん進める");
	});
	em.store(SCRATCH[0], containerOff, "残りの ptr");
	em.emit(`subs x11, x11, #${offs.length}`, "残りの長さ");
	// **負にはしない。** 長さは自然数で、下限の 0 が `__`（空の器）である。切り出し側の
	// `csel …, xzr, pl` と同じ規準——ここに無かったので `||残り||` が -1 を返していた。
	em.emit("csel x11, x11, xzr, pl", "尽きたら 0（__ = []）");
	em.store("x11", containerOff + 8, "残りの len（0 なら __）");
}
/**
 * **`n` バイトを置くディレクティブ。**
 *
 * スカラーの束縛・器の束縛・構造体の像が、どれも同じ問いを持つ。かつては
 * `rodataLines` の中のローカル関数だったので、構造体のスロットを置く側は同じ表を
 * 書き直すしかなかった——**同じ事実を2箇所で決めない**（今日のバグはほぼ全部この形）。
 */
function dataDirective(size) {
	return size === 8 ? ".quad" : size === 4 ? ".word" : size === 2 ? ".hword" : ".byte";
}

/**
 * 命令列を組み立てる器。
 *
 * 診断は**捨てない**。出せなかった場所を黙って飛ばすと、命令の無い関数ができあがって
 * 「動いたように見える」——型が値より狭いときと同じ種類の嘘である。
 */
class Emitter {
	constructor(conf) {
		this.conf = conf;
		this.lines = [];
		this.diagnostics = [];
		this.slot = 0; // 使用中のフレームスロット数
		this.maxSlot = 0;
		// 本体が `sp` を動かしたか。動かしたなら戻すのは `x29` からである。
		this.movedSp = false;
		this.labelSeq = 0;
		// `.rodata` に置いた文字列。中身が同じなら1つに畳む（キーは符号位置の並び）。
		this.rodata = new Map();
		// `$名前` が指す先。名前ごとに1つ（演算子表の「binding ごとに一意・安定」）。
		// 名前を持たない像（入れ子の内側）も同じ表に載るが、そちらの鍵は内容そのもので
		// あり、ラベルは `.Lanon<連番>`——利用者の識別子と棚を分ける（`internAnonImage`）。
		this.namedData = new Map();
		this.anonSeq = 0;
	}

	/**
	 * 文字列の中身を `.rodata` へ置き、その先頭のラベルを返す。
	 *
	 * 幅は `charset` が決める（`ascii` = 1 byte / `utf32` = 4 byte、option_ms_schema.md
	 * §4.2）。どちらも固定幅なので `s ' i` は `base + i × sizeof(Char)` のままである。
	 */
	intern(cps) {
		const key = cps.join(",");
		const hit = this.rodata.get(key);
		if (hit) return hit.label;
		const label = `.Lstr${this.rodata.size}`;
		this.rodata.set(key, { label, cps });
		return label;
	}

	/**
	 * **名前付きの束縛に、一意で安定した場所を与える。**
	 *
	 * 演算子表が `$名前` を「binding（変数）自体のアドレス。C++ の `&b` に相当。binding
	 * ごとに一意・安定したアドレスが保証される」と定めている。ところがトップレベルの
	 * 定数は命令へ畳まれる（`space : ` のような束縛は値そのものを書けば済む）ので、
	 * 指す先が無かった——`$関数` は単相化が、`$匿名式` は `alloca` が扱えるのに、
	 * **値の束縛だけが場所を持たない**という穴だった。
	 *
	 * 置く先は**書き込まれるかどうかで決まる**。`$名前 # 値` が書く先なら `.data`
	 * （書き込み可）、読むだけなら `.rodata` でよい。かつてここは一律 `.rodata` で、
	 * 理由に「畳まれる定数は書き換えない」と書いてあったが、`$` が場所を作れる以上その
	 * 前提は成り立たない——読み取り専用の節へ書いても黙って落ちるだけである。
	 *
	 * 同じ名前は1つに畳む——「binding ごとに一意」がそのまま識別子になる。
	 */
	internBinding(name, value, size, writable = false) {
		return this.internBindingImage(name, [`	${dataDirective(size)} ${value}`], size, writable);
	}

	/**
	 * **同じことを「バイト列で」置く。**
	 *
	 * `internBinding` は「1つの値＋1つの幅」しか持てなかった——`.quad 5` や、要素幅の
	 * 揃った `.quad 1, 2, 3` は書けるが、**幅の違うスロットが並ぶ構造体が置けない**。
	 * そのせいで構造体だけが「一つの場所」を持てず、`$p` は断られ、値として使うたびに
	 * フレームへ組み直されていた（実測で `(f p) + (f p) + (f p)` に `sub sp` が3回）。
	 *
	 * 置き場所の決まりは値のときと同じ——書かれるなら `.data`、読むだけなら `.rodata`。
	 * 違うのは中身が**行の並び**であることだけなので、名前ごとに1つという性質も、
	 * 節の振り分けも `internBinding` と共有する。
	 *
	 * **`#` の段数はここで引く。呼ぶ側から渡してはいけない。** 印がシンボルの見え方を
	 * 決めるのは関数と同じだが、データの像は5か所（`bindingLabel` のリテラルと効果、
	 * `structBindingLabel`、器、トップレベルの書き戻し）から入ってくる。渡す形にすると
	 * 1つ忘れたときに**黙って落ちる**——実測で、`##once : inc 5` は `runsOnce` の道が
	 * 先に登録するので `hit` の枝だけを通り、`.global` の無い `.Lbind_once` が診断ゼロで
	 * 出た。名前から引けば `hit` の枝も同じ答えになる（鍵が名前そのものだから）。
	 */
	internBindingImage(name, body, align, writable = false) {
		const key = `b:${name}`;
		const hit = this.namedData.get(key);
		// 一度でも書かれるなら書ける場所でなければならない。
		if (hit) {
			if (writable) hit.writable = true;
			return hit.label;
		}
		// 公開する像のラベルは**裸の識別子**である。`.L` で始まる綴りは公開できない
		// ——実測（clang）: `error: non-local symbol required` / `.global .Lbind_t`。
		const level = exportLevelOf(name, this.env);
		const sane = name.replace(/[^\w]/g, "_");
		const label = level ? symbolOf(sane) : `.Lbind_${sane}`;
		this.namedData.set(key, { label, body, align, writable, level });
		return label;
	}

	/**
	 * **名前を持たない像を置く。鍵は内容そのものである。**
	 *
	 * 入れ子の内側の構造体には名前が無い。`internBindingImage` は「名前ごとに一意」で
	 * 畳むので、名前の代わりに内容の要約（ハッシュ）を渡すと**要約が同じ別物が同じ像に
	 * なる**——しかも鍵が当たった時点で新しい body を捨てるため、後から来たほうが黙って
	 * 先客の中身を読む。実際に踏んだ：
	 *
	 *   `{a:1, b:48, c:54}` と `{a:3, b:210, c:80}` は 32 ビット FNV-1a がどちらも
	 *   `3dea029b` で、後者を引くと 3 ではなく 1 が返った（診断ゼロ）。幅の違う像
	 *   （16 byte と 24 byte）まで衝突すると、読む側は本当の大きさで引くので**像の外**を
	 *   読み、生の番地が値として出た。衝突は乱数的にばらけず族をなし、その値域
	 *   （`.quad 14` / `.quad 7` など）は演算子表そのものの値域と重なっていた。
	 *
	 * **だから要約は使わない。** `intern`（文字列）が `cps.join(",")` を鍵にしているのと
	 * 同じで、内容そのものを鍵にすれば衝突は原理的に起きない。整列も鍵に入れる——同じ行の
	 * 並びでも整列が違えば別の像である。
	 *
	 * ラベルは連番で振る。**利用者の識別子と同じ棚に載せない**のも要点で、`anon_<hex>` の
	 * ような綴りを名前にすると利用者が同じ名前を書けてしまい、そこでも像を共有していた。
	 */
	internAnonImage(body, align) {
		const key = `a:${align}:${body.join("\n")}`;
		const hit = this.namedData.get(key);
		if (hit) return hit.label;
		const label = `.Lanon${this.anonSeq++}`;
		// 名前が無いのだから印も無い（`#` は書かれた名前に付く）。
		this.namedData.set(key, { label, body, align, writable: false, level: null });
		return label;
	}

	// `.rodata` セクションを組み立てる。1つも無ければ空を返す（節ごと出さない）。
	rodataLines() {
		if (this.rodata.size === 0 && this.namedData.size === 0) return [];
		const w = charSizeOf(this.conf.charset);
		// 幅ごとのディレクティブ。`String ≅ List(Char)` の要素幅そのものである。
		const dir = w === 1 ? ".byte" : w === 2 ? ".hword" : ".word";
		const out = ["", "	.section .rodata"];
		for (const { label, cps } of this.rodata.values()) {
			out.push(`	.balign ${w}`);
			out.push(`${label}:`);
			// 1 byte 幅で中身が素直な ASCII なら `.ascii` で書く——読めるほうが良い。
			// `"` と `\` を含むもの・印字できないものは `.byte` の並びへ落とす。
			const plain = w === 1 && cps.every((c) => c >= 0x20 && c <= 0x7e && c !== 0x22 && c !== 0x5c);
			if (plain) out.push(`	.ascii "${cps.map((c) => String.fromCharCode(c)).join("")}"`);
			else out.push(`	${dir} ${cps.map((c) => "0x" + c.toString(16)).join(", ")}`);
			out.push(`	// ${cps.length} 文字`);
		}
		// 像を1つ置く。公開する印を持つなら、ラベルの直前で見え方を宣言する。
		const put = (x) => {
			out.push(...dataSymbolDirectives(x));
			out.push(`	.balign ${x.align}`);
			out.push(`${x.label}:`);
			out.push(...x.body);
		};
		const inBucket = (name) => [...this.namedData.values()].filter((x) => dataBucketOf(x) === name);
		for (const x of inBucket("rodata")) put(x);
		// **書かれる束縛は `.data` へ。** `$名前 # 値` の書き先が読み取り専用の節に在ると、
		// 書き込みは黙って落ちる（あるいはフォールトする）。どちらに置くかは「書かれるか」
		// が決めるのであって、定数として書かれたかどうかではない。
		//
		// **`###` は自分の節を持つ（`symbolDirectives` の表）。** ただし関数の
		// `.sign.pinned,"ax"` へデータを混ぜることはできない——1つの節名は1組の属性しか
		// 持てず、実測（clang）で `error: changed section flags for .sign.pinned, expected: 0x6`。
		// "ax" は実行可能でもあるので、混ぜれば W^X も壊れる。名前で分ける。
		for (const [bucket, header] of [
			["data", "	.section .data"],
			["pinned.rodata", '	.section .sign.pinned.rodata,"a",%progbits'],
			["pinned.data", '	.section .sign.pinned.data,"aw",%progbits'],
		]) {
			const xs = inBucket(bucket);
			if (xs.length === 0) continue;
			out.push("", header);
			for (const x of xs) put(x);
		}
		return out;
	}

	emit(text, comment) {
		// 26桁を超える命令でもコメントの前に1つは空きが要る（詰まると読めない）。
		const pad = text.length >= 26 ? text + " " : text.padEnd(26);
		this.lines.push(comment ? `\t${pad}// ${comment}` : `\t${text}`);
	}

	label(name) {
		this.lines.push(`${name}:`);
	}

	blank() {
		this.lines.push("");
	}

	// ローカルラベル。アセンブラの慣習に合わせて `.L` 始まりにする。
	newLabel(tag) {
		return `.L${tag}${this.labelSeq++}`;
	}

	fail(node, message) {
		this.diagnostics.push({ severity: "error", message, node });
		this.emit(`// 出せない: ${message}`);
		return false;
	}

	// スロットを1つ借りる。フレーム先頭からのバイトオフセットを返す。
	push() {
		if (this.slot >= MAX_SLOTS) return null;
		const off = this.slot * 8;
		this.slot++;
		if (this.slot > this.maxSlot) this.maxSlot = this.slot;
		return off;
	}

	pop(n = 1) {
		this.slot -= n;
	}

	// スロットへ書く／から読む。フレームポインタ相対で、呼び出しを跨いでも残る。
	store(reg, off, comment) {
		this.emit(`str ${reg}, [x29, #${16 + off}]`, comment);
	}

	load(reg, off, comment) {
		this.emit(`ldr ${reg}, [x29, #${16 + off}]`, comment);
	}
}

/**
 * 器の2本（`{ptr, len}`）をまとめて借りる。**借りるなら両方、取れなければ両方 null。**
 *
 * 1本目が取れなかったら2本目は取りに行かない。器は2本で1つの値なので、片方だけ持って
 * 先へ進む道は無い——呼ぶ側は `len` だけを見れば足りる。
 *
 * **診断はここでは出さない。** 何が深すぎるのか（式か、束縛か）はここからは見えず、
 * 名指しの文言は現場にしか書けない。呼ぶ側はそれぞれ自分のノードで落とす。
 */
function pushPair(em) {
	const ptr = em.push();
	const len = ptr === null ? null : em.push();
	return len === null ? [null, null] : [ptr, len];
}

/**
 * 式を評価して、結果をフレームのスロットへ積む。
 *
 * @returns 積んだ**スロットの本数**。出せなければ `false`。
 *
 * 本数が返るのは、値が1本とは限らないからである——スカラーは1本だが、要素の並びは
 * `{ptr, len}` の2本で運ぶ（stack_abi.md §4.6）。呼ぶ側は使い終わったらその本数だけ
 * `pop()` する。式の入れ子はそのままスロットの深さになる。
 */
/**
 * 式を出して、**スカラー1本**であることを要求する。
 *
 * `cmp` も `add` もレジスタ1本の値にしか当たらない。器（`{ptr, len}`）が来たら
 * 中身の比較・連結になるので、黙って先頭のスロットだけ見ずに名指しで落とす。
 */
function genScalar(node, env, em, scope, why) {
	const w = genExpr(node, env, em, scope);
	if (w === false) return false;
	if (w !== 1) {
		em.pop(w);
		return em.fail(node, `${why}（${node && node.atomType} は ${w} 本の参照で運ぶ値）`);
	}
	return 1;
}

function genExpr(node, env, em, scope, tail = false) {
	const n = unwrap(node);
	if (!n) return false;

	// **match_case の並び**（関数本体）。各行は `条件 : 結果`、最後の1行だけ条件無しの
	// フォールバックでありうる。条件が `__` でなければその結果を返す（function_guide.md）。
	//
	// 判定は niche との比較である——**`cbz` は使えない**。Sign では `0` は真であり、
	// `0 = 0` は真で `0` を返すので、0 を偽と読むと評価器と食い違う
	// （value_representation.md §3.5、unit.md §5.1 の CAUTION）。
	// 1行でも `条件 : 結果` なら分岐である（枝が尽きれば `__`）。ブロックの行数ではなく
	// **定義行かどうか**で決まる——`名前 : 値` の構造体と区別が要るのは複数行のときだけで、
	// 関数本体では `識別子 : 値` も match_case である（function_guide.md）。
	// **ノルム（`||...||`）は要素数である。数えることと並べることは別なので、走査しない。**
	//
	// 器（`{ptr, len}`）なら `len` がそのまま答え——ロード1つ。規則（`{start, step, end}`）
	// なら `(end - start) / step + 1` で割り算1つ（list_model.md §2.3「規則が一次なら
	// `|.|` が走査すらせずに答えられる」）。**スカラーは1要素の器**なので 1、`__` は 0。
	// 終端の無い規則は数えられないので `__`——「無限の要素数」という値は無い。
	if (n.kind === "norm") {
		const inner = n.lines && n.lines.length > 0 ? n.lines[n.lines.length - 1] : null;
		if (!inner) return em.fail(n, "ノルムの中身が空です");
		const iw = genExpr(inner, env, em, scope);
		if (iw === false) return false;
		const io = (em.slot - iw) * 8;
		const rule = isRuleNode(inner, em.conf, env);
		if (rule && iw >= 3) {
			em.load(SCRATCH[0], io, "start");
			em.load(SCRATCH[1], io + 8, "step");
			em.load("x11", io + 16, "end");
			em.emit(`sub x11, x11, ${SCRATCH[0]}`, "end - start");
			em.emit(`sdiv x11, x11, ${SCRATCH[1]}`, "歩幅で割る（走査は要らない）");
			em.emit(`adds ${SCRATCH[0]}, x11, #1`, "+1（端点を含む）");
			em.emit(`csel ${SCRATCH[0]}, ${SCRATCH[0]}, xzr, pl`, "負にはしない");
		} else if (rule) {
			em.emit(`movz ${SCRATCH[0]}, #0x8000, lsl #48`, "終端が無い＝無限は数えられない");
		} else if (iw === 2) {
			// **`len` がそのまま要素数である。** 空の器は 0 で、`[] = __`（unit.md）は同一なので
			// `||__||` も 0 でなければならない——同型から降りてくるのであって、潰れた写像を逆に
			// 辿っているのではない。以前はここで `len = 0` を `__` へ倒しており、cmp/movz/csel の
			// 3命令を数えるたびに払っていた。**規則を直すと命令が減る。**
			em.load(SCRATCH[0], io + 8, "len");
		} else if (iw === 1 && structSlots(inner, em, env) !== null) {
			// **`Struct` の要素数はスロット数である。** 形が型にあるので数える必要が無く、
			// `{ptr}` の1本で運ばれる——だが**スカラーも1本**なので、ここを幅だけで見ると
			// 「スカラーは1要素」に落ちて、いくつスロットがあっても 1 を返していた。
			// 器と同じで「長さを取りたいならスロット数」でなければならない。
			const k = structSlots(inner, em, env);
			em.load(SCRATCH[0], io, "Struct の ptr");
			em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
			em.emit(`cmp ${SCRATCH[0]}, x12`);
			em.emit(`mov ${SCRATCH[0]}, #${k}`, "スロット数（形は型にある）");
			em.emit(`csel ${SCRATCH[0]}, xzr, ${SCRATCH[0]}, eq`, "__ は 0");
		} else if (iw === 1) {
			em.load(SCRATCH[0], io, "中身");
			em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
			em.emit(`cmp ${SCRATCH[0]}, x12`);
			em.emit(`mov ${SCRATCH[0]}, #1`, "スカラーは1要素の器");
			em.emit(`csel ${SCRATCH[0]}, xzr, ${SCRATCH[0]}, eq`, "__ は 0");
		} else {
			em.pop(iw);
			return em.fail(n, `${iw} 本で運ぶ値の要素数はまだ出せません（${n.atomType}）`);
		}
		em.pop(iw);
		const no = em.push();
		if (no === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		em.store(SCRATCH[0], no, "要素数");
		return 1;
	}

	// **絶対値（`|...|`）は数えない。** 囲みは `name` を持たないので `kind` で拾う（ノルムと同じ）。
	//
	// 命令は表が言い（`asmOf("abs")` の条件コード、命令列はその行のコメント）、符号だけをここで
	// 決める——算術の行と同じく `reduceToMachineType` の `signed` で、ここは**オペランドの型**を
	// 見る（結果の型は、恒等になる `Address` だけがオペランドの型を保ち、残りは `Int` と
	// 名乗る——pass3 の絶対値の節。だから結果の型ではオペランドの符号が分からない）。欄が空の
	// 綴りなら命令は無く、中身を積んだスロットがそのまま答えになる。
	//
	// 出さずに断るものは3つで、どれも `abs` と名指しする：
	//
	//     2本以上で運ぶ値・Struct   器に絶対値は無い（解釈器は `__`）。数えるのはノルムである
	//     Float                    fabs になるが、pass4 に浮動小数の道が無い（リテラルは手前で断られる）
	//     Char                     解釈器と答えが割れる（下）
	//
	// **Char は符号なしなので機械では恒等だが、出さない。** 解釈器は1文字を文字列として持ち、
	// 器の枝へ落として `__` を返す。どちらが正しいかは仕様の問いで、黙って恒等を出すと診断ゼロで
	// 答えが割れる。
	if (n.kind === "abs") {
		const inner = n.lines && n.lines.length > 0 ? n.lines[n.lines.length - 1] : null;
		if (!inner) return em.fail(n, "絶対値の中身が空です");
		const iw = genExpr(inner, env, em, scope);
		if (iw === false) return false;
		const ty = inner.atomType;
		if (iw !== 1 || ty === "Struct") {
			em.pop(iw);
			return em.fail(n, `器に絶対値はありません（abs、${ty}）——数えるのはノルム \`||x||\` です`);
		}
		// **Unit と Identity の型は、どちらの顔でも答えが `__` である。** 字面の `|__|` は中身が
		// 既に niche なので足す命令が無い。だが型が Unit／Identity の値は、実行時には `__` か
		// 恒等射（真、機械の上では `0`）のどちらかで、恒等射の `0` は整数の `0` と同じビットに
		// なる——素通しすると機械は `0` を返し、解釈器は射に絶対値が無いので `__` を返す。
		// 実測で `|!__|`・`t : !__` の後の `|t|`・`|!(a < b)|` が割れていた（HEAD は断っていた）。
		// 型がそう言うなら、値を見ずに niche を置く。
		if (ty === "Unit" || ty === "Identity") {
			if (isUnitNode(unwrap(inner))) return 1;
			const uo = (em.slot - 1) * 8;
			em.emit(`movz ${SCRATCH[0]}, #0x8000, lsl #48`, "射に絶対値は無い——__");
			em.store(SCRATCH[0], uo, "絶対値");
			return 1;
		}
		const m = reduceToMachineType(ty, em.conf.target);
		if (!m || m.class !== "gpr" || ty === "Char" || ty === "Raw") {
			em.pop(1);
			// `WIDTH_CLASS` の浮動小数は "float" である（"fp" と書いていて、この枝は死んでいた）。
			if (m && m.class === "float") return em.fail(n, `浮動小数の絶対値はまだ出せません（abs、${ty}）——fabs になるが、pass4 に浮動小数の道が無い`);
			// **Char は文字か数かが決まっていない。** 字面の `\a` なら解釈器は `__`、`c - 200` の
			// ように算術を通すと Char と型付けされたまま負の数になる（実測 -103）。恒等を出すと
			// `|c - 200|` で -103 が黙って出るので、決まるまで出さない。
			if (ty === "Char") return em.fail(n, "Char の絶対値はまだ出せません（abs）——Char は文字か数かが決まっていない（算術を通すと負になる）");
			// **Raw は符号を主張しない型である**（MMIO から読んだビット列）。符号なしとして恒等を
			// 選ぶと、書き込んだ `-5` を読み戻して `|…|` が -5 になる。どちらと読むかは書いた側の話。
			if (ty === "Raw") return em.fail(n, "Raw の絶対値は出せません（abs）——符号を主張しないビット列なので、読み方を型で言ってください");
			return em.fail(n, `絶対値を出せるのは GPR 幅の整数だけです（abs、${ty}）`);
		}
		const cond = asmOf("abs").gpr[m.signed ? "signed" : "unsigned"];
		if (!cond) return 1;
		const io = (em.slot - 1) * 8;
		em.load(SCRATCH[0], io, "中身");
		em.emit(`cmp ${SCRATCH[0]}, #0`);
		em.emit(`cneg ${SCRATCH[0]}, ${SCRATCH[0]}, ${cond}`, "負なら反転（niche は反転しても niche）");
		em.store(SCRATCH[0], io, "絶対値");
		return 1;
	}

	if (!isStructBlock(n) && Array.isArray(n.lines) && (n.lines.length > 1 || (n.lines.length === 1 && isDefineNode(n.lines[0])))) {
		return genMatch(n, env, em, scope, tail);
	}

	// 整数リテラル・アドレスリテラル。16ビットを超える値は `movz`/`movk` の連なりになる。
	if (n.type === "atom" && (n.kind === "number" || n.kind === "address" || n.kind === "register")) {
		// **生の番地の字面は、層2以上では書けない**（利用者の裁定 2026-09-21——「任意のアドレス
		// からの読み込みと書き込みは一考する必要があるが、無ければ IO が全く動かなくなる。
		// セルフホストで必要が無いなら一先ず断る」）。
		//
		// 門は算術（`p + 1`、layer > 0）と書き込み（`p # 5`、layer > 1）には在ったが、
		// **読み（`@p`）には無く、しかも仮引数を1つ挟むと2つとも素通りしていた**。実測（層ごと）:
		//
		//                         L0     L1     L2 以上
		//   直書き `p # 5`        通る   通る   断り      ← 門あり
		//   直書き `@p`           通る   通る   **通る**  ← 門が無い
		//   `f : n ? n # 5`        —     通る   **通る**  ← 素通り
		//   `f : n ? @n`           —     通る   **通る**  ← 素通り
		//   算術 `p + 1`          通る   断り   断り      ← 門あり
		//
		// `f : n ? n # 5` に `f 0x40810000` は layer 4 で**診断ゼロ**、出る命令は
		// `str x14, [x0]` 1本だった。`rawAddressNode` は名前を辿るが、**仮引数は値ノードを
		// 持たない**ので辿れない——来歴を運ぶには pass3 の仮引数の欄を1本増やすことになる。
		//
		// ## 断るのは**字面だけ**である。仮引数で番地を受ける形は通す
		//
		// **仮引数は漏れではない。正当な道である。** 利用者の言い分（2026-09-21）：
		// 「なんで仮引数にアドレスを取る関数越しのポインタ（IO 含む）は、裸のものと違って
		// 許可されるのか…**バリデーションチェックが出来るから**」。
		//
		// 裸の字面は**無から捏造**されるので、検査する材料そのものが無い。仮引数で来た番地は
		// 使う前に検査できる（`n = 0 : __` のように枝を1本置けばよい）——だから通してよい。
		// IO は仮引数の道でしか書けないので、この線を引いても IO は動く。
		//
		// **字面そのものを断れば、捏造の道は全部閉じる。** 番地はどこかで字面として現れる
		// しかないので、来歴を運ぶ必要が無い（`layer_relations.md` §4「上の層で番地として
		// 存在できるのは自分が持っているものだけ」）。実測（層ごと、字面を書かない形）:
		//
		//   `f : n ? n # 5`（定義だけ）   L1 通る  L2 通る  L4 通る
		//   `g : x ? f $x`（`$x` を渡す）  L1 通る  L2 通る  L4 通る
		//   検査してから書く               L1 通る  L2 通る  L4 通る
		//   `f 0x40810000`（字面＝捏造）   L1 通る  L2 断り  L4 断り
		//
		// **16進の字面は全部 `Address` である**（`0xFF` も `kind: "address"`）。Sign には
		// 「16進の整数」という綴りが無いので、この門は層2以上で 16 進そのものを断ることになる。
		// 算術は元から層1以上で断っているので、失うのは非算術の道だけである。
		//
		// **セルフホストは無傷。** `emit.sn` の `out : 0x9000000`（UART）はコーパスが**層1**で
		// 回しており（`test/corpus.js` の `ASM_OPT`）、この門は層2以上にしか当たらない。
		if (n.kind === "address" && em.conf.layer !== undefined && em.conf.layer > 1) {
			return em.fail(n, `layer: ${em.conf.layer} では生の番地の字面を書けません（番地の捏造を防ぐため）。MMIO は layer 0/1 で書くこと`);
		}
		// `Number` を経由しない——`0x123456789abcdef` のような番地は倍精度に載らず、
		// 下の桁が黙って丸まる。文字列のまま `BigInt` へ渡せば桁は落ちない。
		//
		// **プリフィックスは `literalParts` が剥がす**（`literalBigInt`）。`BigInt` が読めるのは `0x` / `0b` の
		// 綴りだけなので、`04x…` をそのまま渡すと投げる——そして下の `catch` は「浮動小数か、
		// 層が足りないか」だと決めつけているので、**幅を書いただけで「layer: 0 では Address を
		// 使えません」という無関係な診断が出ていた**。catch が原因を1つに決めつけるのは、
		// 今日何度も踏んだ形である。
		let v;
		try {
			v = literalBits(n);
		} catch {
			// **層の禁止と実装の穴を区別する。** `option_ms_schema.md` §4 が `Float` を
			// layer 2 以上、`Vector` を layer 3 以上と定めている。layer が足りないなら
			// 設計上の結論であって「まだ」ではない——実装したときに `layer: 0` で通って
			// しまわないよう、門番を先に置く。
			const need = n.atomType === "Vector" ? 3 : 2;
			if (em.conf.layer !== undefined && em.conf.layer < need) {
				return em.fail(
					n,
					`layer: ${em.conf.layer} では ${n.atomType || "浮動小数"} を使えません（${n.value}）。` +
						`必要なのは layer: ${need} 以上です（option_ms_schema.md §4）`
				);
			}
			return em.fail(n, `浮動小数はまだ出せません（${n.value}）`);
		}
		const off = em.push();
		if (off === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		emitImm(em, SCRATCH[0], v, `リテラル ${n.value}`);
		em.store(SCRATCH[0], off);
		return 1;
	}

	// **1文字はスカラーである。**
	//
	// `String ≅ List(0u)`（type_system.md §2）であり、1要素のリストはスカラーと同型
	// （`[5]` は `Int`、list_model.md）。したがって1文字の文字列は符号位置そのもので
	// あり、レジスタに乗る——`is_digit : c ? 0 <= c <= 9` が `cmp` 1命令で書けるのは
	// これが理由である（§4 の NOTE「文字は符号位置で数える点」）。
	//
	// 2文字以上は要素の並びなので `.rodata` へ置いて `{ptr, len}` で渡す
	// （stack_abi.md §4.6）。
	if (n.type === "atom" && (n.kind === "char" || n.kind === "string" || n.kind === "unicode")) {
		const wErr = unicodeWidthError(n);
		if (wErr) return em.fail(n, wErr);
		const cps = codePointsOf(n);
		if (cps === null) return em.fail(n, "文字列の中身が読めません");
		// **U+0000 は文字ではなく `__` である**（value_representation.md §3）。Char の
		// 符号位置範囲から除外されている唯一の点で、そのビットパターンが niche に充てられて
		// いる——`0u0000` と書いたら `__` が出なければならない。
		//
		// ここが 0 を出していた。**Sign では `0` は真**（加法単位元・id 射の観測）なので、
		// 偽であるべきものが真として出てくる。解釈器は `__` を返しており、値だけが食い違う。
		if (isUnitAtom(n)) {
			const off0 = em.push();
			if (off0 === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.emit("movz x9, #0x8000, lsl #48", "U+0000 は __ の niche（文字ではない）");
			em.store(SCRATCH[0], off0);
			return 1;
		}
		const w = charSizeOf(em.conf.charset);
		// 1本に置くのは型が `Char` と言う1文字だけである。`` `a` `` は1文字でも `String` なので下の参照の道へ行く。
		if (n.atomType === "Char" && cps.length === 1) {
			const off = em.push();
			if (off === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			// 16ビットを超える符号位置（`utf32` の面1以降）は `movz`/`movk` の連なりになる。
			// ここが `mov` 1つだったため 0xFFFF より上を名指しで断っていたが、断る理由は
			// **命令の作り方**であって符号位置の側には無い——`emitImm` が後から入った時に
			// 更新され忘れていた。絵文字は U+1F600 台なので、素直に踏む。
			emitImm(em, SCRATCH[0], cps[0], `文字 U+${cps[0].toString(16).toUpperCase().padStart(4, "0")}（${w} byte 幅）`);
			em.store(SCRATCH[0], off);
			return 1;
		}
		// **空文字列は `{ptr, len}` の `len = 0` である。** 値としては `__` そのものだが
		// （`__ = []`、unit.md）、型は `String` なので幅2本で置く——型が言う本数と実際に
		// 置く本数が食い違うと、呼び出し側が読む本数が決まらない。`.rodata` は要らない
		// （指す先が無いので `ptr` は 0 でよい）。
		if (cps.length === 0) {
			const [po0, lo0] = pushPair(em);
			if (lo0 === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.emit(`mov ${SCRATCH[0]}, #0`, "空文字列は __（len = 0）");
			em.store(SCRATCH[0], po0, "ptr");
			em.store(SCRATCH[0], lo0, "len = 0 が __");
			return 2;
		}


		// **`len` は文字数であってバイト数ではない。** `String ≅ List(Char)` であり
		// （type_system.md §2）、添字は `base + i × sizeof(Char)` で引く。バイト数で持つと
		// charset を変えた瞬間に添字がずれる——`charset` が決めるのは要素の幅だけで、
		// **要素数は charset に依らない**という一点をここで守る。
		const label = em.intern(cps);
		const [po, lo] = pushPair(em);
		if (lo === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		// AArch64 でラベルのアドレスを作る決まり文句。`adrp` が 4KB 単位の頁を取り、
		// `:lo12:` が下位12ビットを足す。PC 相対なので位置独立のまま。
		em.emit(`adrp ${SCRATCH[0]}, ${label}`, `${label} の頁（${w} byte 幅 × ${cps.length} 文字）`);
		em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, :lo12:${label}`);
		em.store(SCRATCH[0], po, "ptr");
		// 長さも 16ビットに収まるとは限らない（65535 文字を超える文字列リテラル）。
		emitImm(em, SCRATCH[1], cps.length, "len は文字数（バイト数ではない）");
		em.store(SCRATCH[1], lo, "len");
		return 2;
	}

	// `__`（Unit）。niche を積む（value_representation.md §3.5）。
	if (n.type === "atom" && n.kind === "unit") {
		const off = em.push();
		if (off === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		em.emit("movz x9, #0x8000, lsl #48", "__ の niche");
		em.store(SCRATCH[0], off);
		return 1;
	}

	// 仮引数。入口でスロットへ写してあるので、そこから読む。
	if (isIdentifierNode(n)) {
		const slot = scope && scope.params ? scope.params.indexOf(n.value) : -1;
		if (slot >= 0) {
			// 仮引数も幅を持つ——`{ptr, len}` で受けた仮引数は2本まとめて写す。
			const w = scope.paramSlots ? scope.paramSlots[slot] : 1;
			const base = em.slot;
			for (let k = 0; k < w; k++) {
				if (em.push() === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
				em.load(SCRATCH[0], scope.paramOffsets[slot] + k * 8, k === 0 ? `仮引数 ${bareName(n.value)}` : undefined);
				em.store(SCRATCH[0], (base + k) * 8);
			}
			return w;
		}
		// **トップレベルの定数はその場で畳む。** `space :  ` のような `名前 : 値` は
		// 束縛であって場所ではない——値そのものを書けば済むので、ロードは要らない。
		// Pass 3 が値ノードを識別子テーブルへ書き戻しているので（`binding.valueNode`）、
		// そこを辿って生成し直す。
		if (env) {
			const b = envLookup(env, n.value);
			const v = b && b.valueNode;
			// **番地を取られた束縛は畳まない。** そこには書き込める場所があるので、読みは
			// その場所を辿らなければならない——畳むと、書いた後の読みが古い定数を返す。
			//
			// **構造体は番地を取られていなくても畳まない。** 畳むというのは「使うたびに
			// 組み直す」ことであり、スカラーなら同じ値でも、構造体では**同じ名前が呼び
			// 出しごとに別の実体になる**（実測で `sub sp` が3回出ていた）。名前ごとに一つ
			// の場所を持つのは binding の性質であって `$` の副作用ではない。
			// `runsOnce` も同じ理由でここに並ぶ——**畳むというのは「使うたびに出し直す」
			// ことであり、効果を持つ値では観測が使った回数だけ走る**。場所を辿れば1回になる。
			if (b && (b.addressTaken || b.runsOnce || isStructBlock(unwrap(b.valueNode)))) {
				const loaded = genLoadBinding(n, b, env, em);
				if (loaded !== null) return loaded;
			}
			// **在る器へのマージは畳んではいけない。書き込みだからである。**
			//
			// `q : p~ [ … ]~` の `q` は「p の器へ入れた結果」＝**p そのもの**である
			// （解釈器も同じオブジェクトを返す）。ところが識別子の畳み込みは `q` を使うたびに
			// 値ノードを出し直すので、**マージが使った回数だけ走る**。同じ値を書くだけなら
			// 結果は変わらないが、右辺が自分を読む形では二重に効く——
			//
			//     p : / n : 0 ／ q : p~ [ n : (p ' n) + 1 ]~ ／ q ' n
			//     解釈器 1 に対し、機械語は**診断ゼロで 2**（使用回数を増やすと壊れ方が育つ）
			//
			// 畳まずに**左の器そのもの**へ解決する。マージ自体は定義の行で一度だけ出ている。
			if (v) {
				const mb = v.slotOrigins && v.mergeBase === "name" ? mergeBaseNode(v) : null;
				if (mb && !(scope && scope.folding && scope.folding.has(n.value))) {
					const folding = new Set(scope && scope.folding ? scope.folding : []);
					folding.add(n.value);
					return genExpr(mb, env, em, { ...(scope || {}), folding }, tail);
				}
			}
			// 自分自身へ戻らないようにする（`a : a` のような形は解けない）。
			if (v && v !== n && !(scope && scope.folding && scope.folding.has(n.value))) {
				const folding = new Set(scope && scope.folding ? scope.folding : []);
				folding.add(n.value);
				return genExpr(v, env, em, { ...(scope || {}), folding }, tail);
			}
		}
		return em.fail(n, `まだ出せない識別子です（${bareName(n.value)}）`);
	}

	// **番地の域に、掛け算・冪・階乗の射は無い**（layout.js の `addressWithoutArrow`、利用者の決定 2026-09-14）。
	// pass3 はこれを `Unit` と型付けする。射が無いので零射を通る（原理4）——`__` を置くだけで、命令表の
	// どの形も要らない。辺は評価してから捨てる（解釈器と同じく両辺を評価する道）。層の門より前に置くのは、
	// 結果が `__` なので番地を捏造する道にも、置き場所を漏らす道にもならないからである。
	// **型は `Address` のままである**（裁定 2026-09-21）。pass3 が域を保つようになったので、
	// ここも `Unit` ではなく `Address` で見る——見ないと下の「番地の掛け算は出せません」へ
	// 落ちて、**通っていたものが断りに化ける**。
	if (n.type === "operation" && n.atomType === "Address" && (n.name === "mul" || n.name === "pow" || n.name === "bit_shift_left" || n.name === "factorial")) {
		const operands = n.name === "factorial" ? [n.operand] : [n.left, n.right];
		if (addressWithoutArrow(n.name, operands[0] && operands[0].atomType, operands[1] && operands[1].atomType)) {
			const why = "番地の域に射の無い演算の辺";
			if (!genScalar(operands[0], env, em, scope, why)) return false;
			const at = (em.slot - 1) * 8;
			if (operands[1] && !genScalar(operands[1], env, em, scope, why)) return false;
			if (operands[1]) em.pop(1);
			em.emit(`movz ${SCRATCH[0]}, #0x8000, lsl #48`, `番地の '${n.op}' は射が無い——__`);
			em.store(SCRATCH[0], at);
			return 1;
		}
	}

	if (isAsmForm(n, "alu")) {
		// **`$` が作った番地は表に出てはいけない。**
		//
		// インタプリタは `$` の結果への算術を一律 `__` にしている——参照セルであって数では
		// ないからである。機械の側だけが生の番地を返していた（`($a) + 0` が 1074266336）。
		// 番地が値として観測できると、置き場所という実装の都合がプログラムの意味に漏れる。
		//
		// **列の走査には要らない。** 持ち上げ（`~x`）と持ち下げ（`[x ~xs]` の分解）の対で
		// 書けており、ポインタの加減算は分解の中にしか存在しない——実プログラム4本はどれも
		// 番地の算術を1度も書いていない。速い命令のために開くかどうかは、生成したマシン語が
		// C より速いかを測ってから決める。
		if (addressFromDollar(n.left, env) || addressFromDollar(n.right, env)) {
			return em.fail(n, `\`$\` が作った番地は算術に使えません（番地は表に出ません。読むなら \`@\`、列を辿るなら \`[h ~t]\` の分解を使ってください）`);
		}
		// **恒等射を算術の片側に置くと、結果は値ではなく射である。**
		//
		// `__` は零対象で、初対象と終対象が一致している。対象としての顔（`__`）は単位元
		// として通り抜けて値を返すが、射としての顔（`!__`）は演算そのものを射へ持ち上げる
		// ——`!__ + 1` は `[+ 1]` であり、置いた位置がそのまま穴になる（interpreter.js の
		// `isIdentityMorphism` の注記）。
		//
		// **機械は射を値として運べない。** `[1 !__ 2]` が長さ2になる（器に入れると消える）
		// のと同じ理由で、レジスタに載せられるのは「`__` でない」ことだけである。ここは
		// 静的に分かるので、黙って数として計算せずに名指しで断る——実際これまでは `!__` を
		// 数の 0 として扱っており、`!__ * 7` が解釈器の射に対して **0** を返していた。
		const identityOperand = (q) => {
			const u = unwrap(q);
			if (!u) return false;
			if (u.atomType === "Identity") return true;
			if (!env || !isIdentifierNode(u)) return false;
			const b = envLookup(env, u.value);
			const v = b && b.valueNode ? unwrap(b.valueNode) : null;
			return !!(b && (b.atomType === "Identity" || (v && v.atomType === "Identity")));
		};
		if (identityOperand(n.left) || identityOperand(n.right)) {
			return em.fail(
				n,
				`恒等射（\`!__\`）は算術に運べません。射を演算子の片側に置くと結果は値ではなく` +
					`**射**になり（\`!__ + 1\` は \`[+ 1]\`、置いた位置が穴）、機械はレジスタに射を載せられません` +
					`——書きたいのが部分適用なら \`[+ 1]\` / \`[1 -]\` と綴ってください。` +
					`単位元として通したいのなら、射の顔ではなく対象の顔 \`__\` を置いてください`
			);
		}
		// **生の番地の算術は layer 0 だけの特権である。**
		//
		// 層は機能を積み上げるだけではない——**上へ行くほど禁じられるものがある**。
		// MMIO のレジスタを選ぶには `uart + 4` が要るので layer 0 では算術が必要だが、
		// 同じ式が上の層では「任意の番地を捏造する手段」になる。`$` が作った番地は既に
		// 守られているのに、リテラル由来だけが素通りしていた。
		//
		// これが閉じると、上の層で番地として存在できるのは**自分が持っているもの**だけに
		// なる——`$自分の束縛`・下の層から受け取った参照・分解した先。捏造した番地は型と
		// して作れないので、境界を越えて渡されるポインタを受け側が検証する必要が無い。
		if (em.conf.layer !== undefined && em.conf.layer > 0 && (rawAddressNode(n.left, env) || rawAddressNode(n.right, env))) {
			return em.fail(
				n,
				`layer: ${em.conf.layer} では生の番地を算術に使えません（番地の捏造を防ぐため）。` +
					"番地の算術が要るのは MMIO を扱う layer: 0 だけです——上の層では `$名前`・受け取った参照・分解した先だけが番地になります"
			);
		}
		const machine = reduceToMachineType(n.atomType, em.conf.target);
		if (!machine || machine.class !== "gpr") {
			return em.fail(n, `GPR 幅の整数演算だけを出せます（${n.atomType}）`);
		}
		// 番地の掛け算が番地のまま来るのは、相手の型が決まらなかったときだけである（`addressWithoutArrow` は
		// 分からないことに答えない）。検査の無い `mul` を番地として出すと黙って間違うので、名指しで断る。
		if (n.name === "mul" && n.atomType === "Address") {
			return em.fail(n, "番地の掛け算は出せません（番地の域に射がありません。相手の型が決まっていないので __ とも言えません）");
		}
		const why = "GPR 幅の整数演算だけを出せます";
		if (!genScalar(n.left, env, em, scope, why)) return false;
		const lo = (em.slot - 1) * 8;
		if (!genScalar(n.right, env, em, scope, why)) return false;
		const ro = (em.slot - 1) * 8;
		em.load(SCRATCH[0], lo);
		em.load(SCRATCH[1], ro);
		// 命令は表が言い、符号だけをここで決める。`add`/`sub`/`mul` は両側に同じ綴りが
		// 置いてあるので、除算を特別扱いする分岐が要らない。
		const mn = asmOf(n.name).gpr[machine.signed ? "signed" : "unsigned"];

		// **完全性公理**（`operator_table.md` の算術行）。
		//
		// | 結果の型 | 左辺が `__` | 右辺が `__` |
		// | --- | --- | --- |
		// | `Address` 以外 | **右辺値** | **左辺値** |
		// | `Address` | **`__`** | **`__`** |
		//
		// **`__` は両側で単位元である**（爆発律）。算術は `A × A → A`——積を食って同じ
		// 対象を返すので、片方が始対象なら返せる値は残った方しか無い（始対象からの射は
		// 一意）。型で言えば `__` は強さの**底**で、`Unit ⊕ T → T` である。
		//
		// **結果が番地なら `__` は両側で吸収する**（同じ欄の例外、解釈器の `absorbsUnit`）。
		// 爆発律を当てると溢れた番地が次の演算で生き返り、足す数の側が失われたときに左辺を
		// 返せば意図と違う番地が黙って出る——どちらも任意の記憶を指すので致命的である。命令は
		// 同じ `csel` で、選ぶ先を残った辺から niche（`x12`）へ替えるだけである。
		//
		// 比較は違う。`A × A → Ω` で返す先が別の対象なので、相手の値を通しても行き先の
		// 型にならない——爆発しようがなく `__` のままである。**積関手か冪関手が絡むか
		// どうか**が分かれ目になる。
		//
		// これを出していなかったので `1 + __` が niche を数として足していた
		// （-9223372036854775807）。**黙って間違う**——`1 * __` に至っては niche×1 が
		// niche のままなので、それらしく見えてしまう。
		//
		// `sum : [x ~xs] ? x + (sum xs)` ——公理だけで終端する Sign で最も素直な
		// 畳み込み——はこの1行に乗っている。関数の入口の `__` 検査はどの形でも必ず
		// 出るので、その形は追加の代金がゼロで済む。明示的に `!xs` と書く形は、
		// 同じことをもう一度検査していることになる。
		//
		// **分岐ではなく `csel` で出す。** ラベルを増やすと覗き穴が全部そこで降参する
		// ので、直線のまま置ける方が後段に効く（`Char` の範囲検査と同じ形）。
		//
		// **`__` になり得ない辺は検査しない。** 両辺とも分かっていれば命令は1つのまま
		// で、公理は本当にタダになる。
		//
		// **番地の算術だけは溢れを見る**（`addressCheckOf`）。溢れた番地は任意の
		// 記憶を指すので払う。`Int` は回ってよい——間違った数は番地にならない。検査は完全性公理の
		// 前に置く：公理の `cmp` が旗を壊すうえ、`__` の辺を足した値は公理が上書きするので、
		// その値が溢れたかどうかは答えに関係しない。
		//
		// **番地の辺は `Int` の嘘を信じない**（`cannotBeUnit` の `critical`）。門を通った仮引数
		// どうしの `Int` の和でも、回った先がちょうど niche なら `__` である。`Int` の算術が続く
		// だけならその niche を数として足してよい（致命的でない）が、番地へ足すと別の番地が出る。
		const absorb = n.atomType === "Address";
		const lMaybe = !cannotBeUnit(n.left, env, scope, absorb);
		const rMaybe = !cannotBeUnit(n.right, env, scope, absorb);
		const check = absorb ? addressCheckOf(mn, n, em) : null;
		if (!lMaybe && !rMaybe && !check) {
			em.emit(`${mn} ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}`, `${n.op}`);
		} else if (!lMaybe && !rMaybe) {
			em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
			check(SCRATCH[0]);
		} else {
			em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
			if (check) check("x11");
			else em.emit(`${mn} x11, ${SCRATCH[0]}, ${SCRATCH[1]}`, `${n.op}`);
			if (rMaybe) {
				em.emit(`cmp ${SCRATCH[1]}, x12`, "右辺が __ か");
				if (absorb) em.emit("csel x11, x12, x11, eq", "右が __ なら __（番地は吸収する）");
				else em.emit(`csel x11, ${SCRATCH[0]}, x11, eq`, "右が __ なら左辺値（完全性公理）");
			}
			if (lMaybe) {
				em.emit(`cmp ${SCRATCH[0]}, x12`, "左辺が __ か");
				if (absorb) em.emit("csel x11, x12, x11, eq", "左が __ なら __（番地は吸収する）");
				else em.emit(`csel x11, ${SCRATCH[1]}, x11, eq`, "左が __ なら右辺値（爆発律）");
			}
			em.emit(`mov ${SCRATCH[0]}, x11`);
		}
		// **足せることと、書けることは別である。** 文字の算術は符号位置の算術であり、
		// 値としてはそれで全部である——charset に収まるかどうかは**書き出すときの話**
		// なので、`#` の出口（`emitWritableGuard`）が見る。
		//
		// 以前はここで上限を見ていた。判定が半端で（サロゲートが通る）、`__` を誤りの
		// 印として使うことになり、演算のたびに3命令払っていた。`Char` は `Int` と同じ
		// 値であり、算術の道も同じでよい。
		em.pop(1); // 右辺のスロットを返す。結果は左辺のスロットへ書く。
		em.store(SCRATCH[0], lo);
		return 1;
	}

	// **比較は値を返す。**（comparison.md §2.1）真ならオペランド、偽なら `__`。
	// どちらのオペランドを返すかは**左辺の値**が決める——左辺が算術単位元（0 か 1）なら
	// 右辺、そうでなければ左辺。値で決まるので実行時に見る必要がある。
	//
	// `csel` を2段重ねる。1段目で「左辺が単位元か」を見て返す候補を選び、2段目で
	// 「比較が真か」を見て候補と `__` を選ぶ。分岐は出さない。
	// **器の比較は `==` / `!==` である。**（operator_table.md 段8「構造内比較演算」、
	// reference.md「`==` は構造比較専用の演算子であり、List・Struct などの構造を対象とする」）
	//
	// 段12 の `=` / `!=` はスカラーの比較演算で、`{0,1}` の左辺優先ルールを持つ。段8 の
	// `==` / `!==` はそのルールの適用外で（comparison.md §2.1 の最後）、常に「真なら左辺、
	// 偽なら `__`」である。**Pass 4 にはその枝が1つも無かった**——器を実際に比べていたのは
	// スカラー用の `=` の方で、役割が入れ替わったまま両方が動いていた。
	if (n.type === "operation" && (n.name === "equal" || n.name === "xnot_equal") && n.position === "infix") {
		const lS = slotsOfNode(n.left, em.conf, env);
		const rS = slotsOfNode(n.right, em.conf, env);
		// **積は名前で突き合わせる。** `==` は Hom集合の一致なので宣言順を見ない
		// （type_system.md §6.2）。物理配置は名前順に揃っているので、鍵の集合が同じなら
		// 並びも同じ——スロットを順に見ればよい。
		if (n.left && n.right && n.left.atomType === "Struct" && n.right.atomType === "Struct") {
			return genStructCompare(n, env, em, scope);
		}
		// 両方が1本で運ばれるなら、構造は無いので中身をそのまま比べる（`5 == 5`）。
		if (lS === 1 && rS === 1) {
			const mL = reduceToMachineType(n.left && n.left.atomType, em.conf.target);
			const mR = reduceToMachineType(n.right && n.right.atomType, em.conf.target);
			if (!(mL && mL.class === "gpr" && mR && mR.class === "gpr")) {
				return em.fail(n, `GPR 幅の値の構造比較だけを出せます（${n.left && n.left.atomType} と ${n.right && n.right.atomType}）`);
			}
			return genScalarStructCompare(n, env, em, scope);
		}
		return genStringCompare(n, env, em, scope);
	}
	if (isAsmForm(n, "cond")) {
		const machine = reduceToMachineType(n.atomType, em.conf.target);
		// 比較の結果型は `L | R | __` なので、それ自体は還元できない。両辺が GPR 幅の
		// 整数であることを見る。
		const lt = reduceToMachineType(n.left && n.left.atomType, em.conf.target);
		const rt = reduceToMachineType(n.right && n.right.atomType, em.conf.target);
		// **1文字は符号位置というスカラーなので、整数と同じく `cmp` で比べられる**
		// （§4 の NOTE「文字は符号位置で数える点」）。器としての `String` は比べられない
		// ——中身の比較になるので、`.rodata` と長さが要る。
		// **`Char` は符号位置という整数なので GPR に乗る**（target_info.js の WIDTH_CLASS）。
		// 型がそう言っているので、リテラルの形を見る必要はない。
		const cmpOk = (side) => {
			const m = reduceToMachineType(side && side.atomType, em.conf.target);
			return !!m && m.class === "gpr";
		};
		// **器どうしの等価は中身の比較である。** `String` は `{ptr, len}` で来るので、
		// 長さを見てから要素を1つずつ見る。メモリは要らない——読むだけである。
		// **門は型名ではなく「何本で運ばれるか」で決める。**
		//
		// ここは両辺の `atomType` が `String` かどうかだけを見ていた。ところが型が `String` でも
		// 1本で運ばれる値が在る——呼び出しサイトが `Char` を渡した仮引数は `paramRegWidths` が
		// 1本で受けると決める。門を通ってしまうと `genStringCompare` は「2本ある」つもりで
		// `lo` と `lo+8` を読み、左辺の `len` を右辺の `ptr` として使う——診断ゼロで違う値が
		// 返る（`f : s ? `ab` != s` に1文字を渡すと 解釈 98／実機 0）。
		//
		// **同じ `Char` × `String` が、直に書けば断られ、仮引数を経由すると黙って通っていた。**
		// 狭い側は確保ゼロで広げられる（リテラルは `.rodata`、器の中の1つはスライス）ので、
		// 断るのではなく広げてから比べる（仕様 §2「Char の枝は境界で1要素の連続領域へ持ち上げる」）。
		const cmpBoxish = (t) => t === "String" || t === "Char";
		const lWid = slotsOfNode(n.left, em.conf, env);
		const rWid = slotsOfNode(n.right, em.conf, env);
		// **器の比較に段12 を使ってはいけない。**
		//
		// `=` / `!=` は段12 の比較演算（スカラー）で、器の比較は段8 の `==` / `!==` である
		// （operator_table.md「構造内比較演算」、reference.md「`==` は構造比較専用」）。
		// ここは長く `=` で器を比べていたが、**解釈器がそう見えていたのは JS の偶然**だった
		// ——`assign_equal` は `l === r` で JS へ委ねており、JS は文字列を値で・配列を参照で
		// 比べる。だから `` `ab` = `ab` `` は真、`[1 2] = [1 2]` は偽、という不整合が出ていた。
		// 器の比較は「決めていなかった」のであって、`=` の意味だったわけではない。
		// **空の器との比較は吸収則である。** 空文字列は型が String・値が `__` なので、
		// 中身を突き合わせる話にはならない（`!s` と同じことを言っている）。
		const emptyLit = (x) => {
			const u = unwrap(x);
			if (!u) return false;
			if (u.type === "atom" && u.kind === "string") return String(u.value).length <= 2;
			return !!(u.type === "block" && Array.isArray(u.lines) && u.lines.length === 0);
		};
		if (n.left && n.right && cmpBoxish(n.left.atomType) && cmpBoxish(n.right.atomType) && (lWid === 2 || rWid === 2)) {
			// 空との比較は吸収則なので、長さを見るだけで答えが出る（`len 0` 対 `len n`）。
			// 中身を突き合わせる話にならないので、ここは通す。
			if (emptyLit(n.left) || emptyLit(n.right)) return genStringCompare(n, env, em, scope);
			// 順序（`<` `<=` `>` `>=`）は `==` では代われない——辞書式の規則そのものが無い。
			if (n.name !== "assign_equal" && n.name !== "not_equal") {
				return em.fail(n, `器どうしは等価だけを出せます（${n.op}）——順序を出すには辞書式の規則が要る`);
			}
			return em.fail(
				n,
				`器の比較に '${n.op}' は使えません（段12 はスカラーの比較演算です）——中身を比べるなら ` +
					"'==' / '!==' を使ってください（operator_table.md 段8「構造内比較演算」）"
			);
		}
		if (!cmpOk(n.left) || !cmpOk(n.right)) {
			return em.fail(n, `GPR 幅の値の比較だけを出せます（${n.left && n.left.atomType} と ${n.right && n.right.atomType}）`);
		}
		const whyCmp = "GPR 幅の値の比較だけを出せます";
		if (!genScalar(n.left, env, em, scope, whyCmp)) return false;
		const lo = (em.slot - 1) * 8;
		if (!genScalar(n.right, env, em, scope, whyCmp)) return false;
		const ro = (em.slot - 1) * 8;
		em.load(SCRATCH[0], lo);
		em.load(SCRATCH[1], ro);
		// **`=` は 0/1 の規則を出さなくてよい。**
		//
		// 真のとき返る候補は「左辺が 0 か 1 なら右辺、でなければ左辺」である
		// （comparison.md §2.1——`0 < 5` が 5、`2 < 5` が 2 になるのはこれ）。だが `=` が
		// 真になるのは**両辺が同じ値のとき**だけで、そのとき左辺と右辺は区別が付かない。
		// 規則が無くなったのではなく、**この演算子では観測できない**。
		//
		// 実プログラムで比較の 72 箇所中このぶんが 3 命令ずつ減る。
		const eqOnly = n.name === "assign_equal";
		if (!eqOnly) {
			// 左辺が 0 か 1 か（算術単位元、comparison.md §2.1）。
			em.emit(`cmp ${SCRATCH[0]}, #0`, "左辺は加法単位元か");
			em.emit(`ccmp ${SCRATCH[0]}, #1, #4, ne`, "違えば乗算単位元か");
			em.emit(`csel x11, ${SCRATCH[1]}, ${SCRATCH[0]}, eq`, "単位元なら右辺、でなければ左辺");
		}
		// 比較そのもの。真なら選んだ候補、偽なら `__`。
		// 64ビット即値は `mov` に載らない。niche は上位16ビットだけが立っているので
		// `movz` 1命令で作れる（0x8000 << 48）。
		em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
		em.emit(`cmp ${SCRATCH[0]}, ${SCRATCH[1]}`, `${n.op}`);
		const cond = emitAddressIntCondition(n, em) || asmOf(n.name).gpr[unsignedCompare(n, em.conf, env) ? "unsigned" : "signed"];
		em.emit(`csel ${SCRATCH[0]}, ${eqOnly ? SCRATCH[0] : "x11"}, x12, ${cond}`, "真なら値、偽なら __");
		em.pop(1);
		em.store(SCRATCH[0], lo);
		return 1;
	}

	// **連鎖比較**（`0 <= c <= 9`）。二項と違い、真のとき返るのは**必ず中央**である
	// ——0/1 の規則（comparison.md §2.1）は効かない。範囲判定の書き方そのものなので、
	// これが出せないと文字の分類が1つも書けない。
	//
	// **boolean を作らない。** 値と真偽が同じ対象である以上（Sign に `Bool` は無い）、
	// `cset` で1ビットを作って `and` してまた値へ戻すのは、**言語から消したものを機械語で
	// 作り直している**ことになる。AArch64 には条件を繋ぐ命令がそのまま在る。
	//
	//   両端が定数    `sub`/`cmp`/`csel`   —— 符号なしの範囲検査に畳む（3命令）
	//   それ以外      `cmp`/`ccmp`/`csel`  —— 条件を繋ぐ（4命令）
	//
	// 以前は `cset`×2 + `and` + `cmp` + `csel` の8命令だった（`0 <= c <= 9` 全体で 30、
	// 同じ意味論を書いた C の -O2 は 4）。読みやすさのために選んだ形だったが、**畳んだ方
	// が短いだけでなく、出す側のコードも短い**。
	if (n.type === "operation" && n.name === "chain_compare") {
		// 連鎖も同じ規則で符号を選ぶ（中央と両端が同じ型なので、左辺で決まる）。
		// **連鎖できるのは条件コードを持つ演算子だけ**なので、表を引けたかどうかが門になる
		// ——ここには節が無く名前しか無いので、`isAsmForm` ではなく `asmOf` を直に引く。
		const chainAsm = asmOf(n.compareName);
		const cond =
			chainAsm && chainAsm.form === "cond"
				? chainAsm.gpr[unsignedCompare({ left: n.left, right: n.middle }, em.conf, env) ? "unsigned" : "signed"]
				: null;
		if (!cond) return em.fail(n, `連鎖できない比較です（${n.compareName}）`);
		const sides = [n.left, n.middle, n.right];
		const ok = (side) => {
			const m = reduceToMachineType(side && side.atomType, em.conf.target);
			return !!m && m.class === "gpr";
		};
		if (!sides.every(ok)) {
			return em.fail(n, `GPR 幅の値の連鎖比較だけを出せます（${sides.map((x) => x && x.atomType).join(" ")}）`);
		}
		// **端が文字リテラルでも定数である。** 文字の比較は符号位置の比較なので、`\0` は
		// 48 という定数と同じに畳める——**文字クラスの判定こそがこの形の本命**であり
		// （lexer.sn はこれしか書かない）、そこで畳めないと入れた意味が無い。
		const constEnd = (side) => {
			const v = constAddressOf(side, env);
			if (v !== null) return v;
			const cps = codePointsOf(unwrap(side));
			return cps && cps.length === 1 ? BigInt(cps[0]) : null;
		};
		const lo = constEnd(n.left);
		const hi = constEnd(n.right);
		const rangeCond = cond === "le" || cond === "ls";
		// **両端が定数なら、両端は出さない。** 幅は即値になるので、値として持つ必要が無い
		// ——出してから畳むと `mov`/`str` が残る。畳めると分かってから出す。
		const asRange = lo !== null && hi !== null && rangeCond && hi >= lo && hi - lo < 4096n;
		const offs = [];
		for (const side of asRange ? [n.middle] : sides) {
			if (!genScalar(side, env, em, scope, "GPR 幅の値の連鎖比較だけを出せます")) return false;
			offs.push((em.slot - 1) * 8);
		}
		em.load(SCRATCH[1], asRange ? offs[0] : offs[1], "中央");
		em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
		if (asRange) {
			// **`lo <= x <= hi` は「`x - lo` を符号なしで見て `hi - lo` 以下か」である。**
			// 2の補数では範囲外がそのまま巨大な符号なし値になるので、下側の検査が要らない
			// ——比較が1つで済む。文字の分類（`0 <= c <= 9`）はすべてこの形である。
			const base = lo === 0n ? SCRATCH[1] : SCRATCH[0];
			if (lo !== 0n) em.emit(`sub ${SCRATCH[0]}, ${SCRATCH[1]}, #${lo}`, `下端 ${lo} を引く`);
			em.emit(`cmp ${base}, #${hi - lo}`, `幅 ${hi - lo} に収まるか（符号なし）`);
			em.emit(`csel ${SCRATCH[0]}, ${SCRATCH[1]}, x12, ls`, "収まれば中央、外れれば __");
		} else {
			// 一般の形。**`ccmp` は「前が真のときだけ実際に比較し、偽なら決め打ちのフラグを
			// 置く」命令**である。置くフラグは「その条件が偽になる並び」を選ぶ——そうすれば
			// 最後の `csel` を1つ見るだけで両方の判定になる。
			em.load(SCRATCH[0], offs[0], "左");
			em.load("x11", offs[2], "右");
			em.emit(`cmp ${SCRATCH[0]}, ${SCRATCH[1]}`, `左 ${n.op} 中央`);
			em.emit(`ccmp ${SCRATCH[1]}, x11, #${FALSE_NZCV[cond]}, ${cond}`, `真のときだけ 中央 ${n.op} 右`);
			em.emit(`csel ${SCRATCH[0]}, ${SCRATCH[1]}, x12, ${cond}`, "両方真なら中央、でなければ __");
		}
		em.pop(asRange ? 0 : 2);
		em.store(SCRATCH[0], offs[0]);
		return 1;
	}

	// **短絡**（`&` と `|`）。どちらも「左を見て、右を評価するかどうかを決める」形である。
	//
	//   &   左が `__` なら全体が `__`（右は評価しない）。そうでなければ右がそのまま結果
	//   |   左が `__` でなければ左がそのまま結果（右は評価しない）。`__` なら右
	//
	// 評価しないことは意味論の一部である。Sign は副作用と非停止を持つので、
	// `__ & ($UART # x)` で書き込みが起きるかどうかが変わる（operator_table.md
	// 「Unit 欄の読み方」）。命令の節約ではなく、**評価するかしないか**を出している。
	//
	// 結果は左のスロットに揃える——どちらの経路を通っても同じ場所に値がある。
	if (n.type === "operation" && (n.name === "and" || n.name === "or") && n.position === "infix") {
		const isAnd = n.name === "and";
		// **幅は問わない。** 見るのは「`__` かどうか」だけで、その判定は幅ごとに決まって
		// いる。左右の幅が揃っていることだけが要る——どちらの経路を通っても同じ場所に
		// 同じ本数の値がある、が結果の置き方だからである。
		const lw = genExpr(n.left, env, em, scope);
		if (lw === false) return false;
		if (lw === TAIL) return em.fail(n.left, "短絡の左辺に末尾呼び出しは置けません（結果を見て飛び先を決めるため）");
		const lo = (em.slot - lw) * 8;
		const end = em.newLabel("sc");
		emitIsUnit(em, lo, lw, "左辺");
		em.emit(
			`b.${isAnd ? "eq" : "ne"} ${end}`,
			isAnd ? "左が __ なら全体が __（右を評価しない）" : "左が __ でなければ左が結果（右を評価しない）"
		);
		// **右辺は末尾位置である**（tco.md §2「`then` と `else` の両方が末尾位置」）。
		// 左辺は違う——結果を見てから飛び先を決めるので、評価しきる必要がある。
		const rw = genExpr(n.right, env, em, scope, tail);
		if (rw === false) return false;
		if (rw === TAIL) {
			// 右辺は飛んで行った。ここへ落ちてくるのは左辺の経路だけである。
			em.label(end);
			return lw;
		}
		// **`&` の左辺は条件であって結果にならない。** `a & b` は `a` が `__` なら `__`、
		// そうでなければ `b` である（operator_table.md の Unit 欄：左右どちらが `__` でも
		// 零射）。左辺は「通るかどうか」しか語らないので、**幅が揃う必要は無い**。
		// `xs & x + (s xs~) | x` の `xs` は器（2本）で右辺は数（1本）という、畳み込みの
		// 素直な書き方がここで止まっていた。
		//
		// `|` は違う。`a | b` はどちらか非 `__` の方が結果になる（恒等射）ので、左辺も
		// 結果になりうる——そちらは揃っていなければ置き場所が決まらない。
		if (isAnd && rw !== lw) {
			// 結果は右辺の幅で置く。左辺のスロットは条件を見るためだけに使ったので返す。
			const rbase0 = em.slot - rw;
			const outs = [];
			for (let k = 0; k < rw; k++) {
				em.load(SCRATCH[0], (rbase0 + k) * 8);
				outs.push(SCRATCH[0]);
				em.store(SCRATCH[0], lo + k * 8, k === 0 ? "右辺が結果（左辺は条件）" : undefined);
			}
			em.pop(rw);
			// 左辺のスロットが右辺より狭ければ足りない。そこは名指しする。
			if (rw > lw) {
				return em.fail(n.right, `短絡の結果が左辺より広い形はまだ出せません（${lw} 本と ${rw} 本、${n.op}）`);
			}
			em.pop(lw - rw);
			const skip = em.newLabel("scv");
			em.emit(`b ${skip}`);
			em.label(end);
			emitUnitRegs(em, rw, null);
			for (let k = 0; k < rw; k++) em.store(ARG_REGS[k], lo + k * 8, k === 0 ? "左が __ なので全体が __" : undefined);
			em.label(skip);
			return rw;
		}
		if (rw !== lw) {
			em.pop(rw);
			return em.fail(n.right, `短絡の両辺は同じ幅でなければ出せません（${lw} 本と ${rw} 本、${n.op}）`);
		}
		const rbase = em.slot - rw;
		for (let k = 0; k < rw; k++) {
			em.load(SCRATCH[0], (rbase + k) * 8);
			em.store(SCRATCH[0], lo + k * 8, k === 0 ? "右辺が結果" : undefined);
		}
		em.pop(rw);
		em.label(end);
		return lw;
	}

	// 飽和した呼び出し。引数をスロットで作ってから x0〜x7 へ積んで `bl`。
	if (n.type === "operation" && n.name === "apply") {
		const { base, args } = applyChain(n);
		// **アドレス経由の呼び出しは具体化されている。** 本体を出しているのは特定の実体
		// なので、`@p` の `p` が何を指すかはこの実体の中では決まっている
		// （compiler_pipeline.md §3 の IMPORTANT）。
		let callee = null;
		let baseName = null;
		if (isIdentifierNode(base)) {
			// **具体化された仮引数は、直接呼んでも名前が変わる。** `@p` の形だけが
			// `scope.callees` を引いていたので、デフォルトにラムダを書いて `g x` と
			// 直接呼ぶ形が素の名前のまま `b g` を出していた——存在しないラベルである。
			// `$` を書いたなら `@` で呼ぶ、書かないならそのまま呼ぶ。どちらの側も
			// 同じ表を引かなければ対にならない。
			// **別名は名前の言い換えでしかない。** `g : f` と書いて `g 5` と呼んだら、
			// 飛ぶ先は `f` である。ここを辿らないと存在しないラベルへ `bl` を出すか、
			// 「まだ出せない識別子です」で止まる——名前を1つ挟んだだけで呼べなくなる。
			//
			// 型の側は `callsitesOf` が同じ連なりを辿っており（別名越しの呼び出しも
			// その関数の呼び出しサイトである）、両側が同じ表を引いて初めて対になる。
			// ポイントフリーに名前を付けた形（`g : [* 2,]`）がちょうどこれで、合成が
			// 作った定義への別名になる。
			const aliased = aliasTargetOf(base.value, env);
			callee = (scope && scope.callees && scope.callees[base.value]) || bareName(aliased);
			baseName = callee;
		} else if (
			base && base.type === "operation" && base.position === "prefix" && base.name === "input" &&
			isIdentifierNode(base.operand) && scope && scope.callees && scope.callees[base.operand.value]
		) {
			callee = scope.callees[base.operand.value];
			baseName = callee;
		}
		if (!callee) {
			return em.fail(n, "呼び先が静的に決まりません（`$名前` で渡されたものだけ具体化できます）");
		}
		// 単相化された呼び出しでは、関数ポインタの引数は**命令へ焼き込まれている**ので
		// レジスタで渡さない。ここが「コンパイル時特殊化（コストゼロ）」の実体である。
		let drop = n.monoDrop || [];
		if (n.monoLabel) callee = n.monoLabel;
		else if (scope && scope.callees && Object.keys(scope.callees).length > 0) {
			// **具体化された実体の中では、仮引数の関数ポインタも既に決まっている。**
			// `take_while : p s ? … take_while p (s ' 1~)` の再帰は `$名前` ではなく `p` を
			// そのまま渡すので、呼び出しサイトの走査（`collectMonomorphs`）からは具体化
			// できない。だがこの実体の中では `p` が何を指すかは決まっているので、ここで
			// 同じ実体へ結び直す——そうしないと再帰だけが多相なまま取り残される。
			const passing = [];
			args.forEach((a, i) => {
				if (isIdentifierNode(a) && scope.callees[a.value]) passing.push({ i, to: scope.callees[a.value] });
			});
			if (passing.length > 0) {
				callee = `${callee}$${passing.map((x) => x.to).join("$")}`;
				drop = passing.map((x) => x.i);
			}
		}
		const passed = args.filter((_, i) => !drop.includes(i));
		// **数えるのは引数の個数ではなくレジスタの本数である。** 器を渡す引数は
		// `{ptr, len}` で2本使う（stack_abi.md §4.6）。
		// **透過な呼び先の向こうへスロットを渡す。** 呼び先が器を組まず引数の切片を返すなら
		// （`strip_head`）、返る器は**引数の場所**に在る。自分がもらったスロットをその引数の
		// 生産者へ渡せば、場所は最も外側で一度取るだけで済む——渡さなければ引数は自分の
		// フレームに置かれ、返した先では死んでいる（`mark : s ? strip_head (walk s …)`）。
		// **呼び先がその引数をそのまま返すなら、その引数の場所は「自分がもらった場所」で
		// なければならない。** 呼び先は受け取った器をそのまま返すので、自分のフレームに
		// 取って渡すと、返ってきた器は**自分のフレームの中**を指す——エピローグの
		// `mov sp, x29` が捨てた場所である。1回呼ぶだけなら偶然読めてしまい、2回呼ぶと
		// 2回目が1回目を上書きする（**診断も出ず、値だけが違う**）。
		const handsBack = em.returnedParams ? em.returnedParams.get(baseName) || em.returnedParams.get(callee) : null;
		const through = [];
		if (tail && em.sretDest !== null && em.sretDest !== undefined) {
			const ce = em.sretPlan && (em.sretPlan.get(callee) || em.sretPlan.get(baseName));
			if (handsBack && handsBack.size) {
				for (let i = 0; i < passed.length; i++) {
					if (!handsBack.has(i) || !appendableCallee(passed[i], em)) continue;
					const t = stripExpand(passed[i]);
					t._sretInto = em.sretDest;
					through.push(t);
				}
			}
			if (ce && !ce.needsSlot && through.length === 0) {
				for (const a of passed) {
					if (!appendableCallee(a, em)) continue;
					// **印は括りの中の呼び出しに付ける。** `(walk s bottom 0 0)` は括弧の節で
					// あり、そこに付けても呼び出しを出す側（genExpr の apply 分岐）が見るのは中の `apply` である。
					const t = stripExpand(a);
					t._sretInto = em.sretDest;
					through.push(t);
					break;
				}
			}
		}
		const parts = [];
		for (const a of passed) {
			// **この引数を作る途中で場所を取ったか**を引数ごとに覚える。器を返す呼び出しは
			// sret のスロットを sub sp で取り、返るのはそこを指す ptr である——つまり
			// 引数そのものがフレームの場所への参照になる。関数まるごとの旗では
			// 「どの引数が」が落ちるので、ここで帰属させる。
			const spWas = em.movedSp;
			em.movedSp = false;
			const w = genExpr(a, env, em, scope);
			const took = em.movedSp;
			em.movedSp = spWas || took;
			if (w === false) return false;
			parts.push({ off: (em.slot - w) * 8, w, took });
		}
		for (const a of through) a._sretInto = undefined;
		// **逃がす先が無いなら止める。** 自分のフレームに取った器を「そのまま返す」位置へ
		// 渡していて、通す先（もらったスロット）が無い形である。ここを黙って出すと、返った
		// 器は捨てられた場所を指す。
		// **問題になるのは、その値が自分の返値になるときだけである。** 途中の値なら自分の
		// フレームは生きているので、呼び先が返した器も読める。
		if (tail && handsBack && handsBack.size && through.length === 0) {
			// **見るのは器だけである。** 番地（`$匿名式` で取った場所）を渡して返される形は
			// 層0の話で、そこは書いた人が持ち場を決めている。ここで止めたいのは、組んだ器を
			// 「そのまま返す」位置へ渡す形——`go (node ar n n) (n - 1)` である。
			const bad = parts.findIndex((pp, i) => pp.took && handsBack.has(i) && isBoxType(unwrap(passed[i]) && unwrap(passed[i]).atomType));
			if (bad >= 0)
				return em.fail(
					n,
					"第" + (bad + 1) + "引数の場所が足りません（" + callee + " はこの引数をそのまま返すので、置き場所は呼ぶ側の外——sret のスロット——でなければなりません）"
				);
		}
		let total = parts.reduce((acc, x) => acc + x.w, 0);
		// **幅は署名が言う。** 省略された位置まで含めて全部数えないと、スタックへ積む
		// 位置が決まらない——`walk s bottom 0 0` は9個の仮引数のうち4個しか渡さないが、
		// 残り5個も引数域の場所を占める。
		const sigAll = em.signatures ? em.signatures.get(baseName) : null;
		const sigW = sigAll
			? sigAll.filter((_, i) => !drop.includes(i)).map((x) => (x.error || !x.regs ? null : x.regs))
			: null;
		// **同型は型では無償、表現では有償**（0_design_principles.md 原理8）。
		//
		// `[7]` は型の上では `7` であり（`[x] ≅ x`）、`unwrap` はそれを畳んでレジスタ1本の
		// 値にする。だが受け側の仮引数が `[x ~xs]` なら要るのは器の表現——`{ptr, len}` の
		// 2本である。ここを黙って1本のまま呼ぶと、呼び先は x1 に残っていた別の値を len と
		// して読む。`f : [x ~xs] ? x` に `f [7]` で `__` が返っていたのがこれである。
		//
		// **払うのは呼ぶ側である。** 同型を渡り歩く費用は、どちらの表現が要るかを知って
		// いる側が負う。長さ1ぶんの場所を取って値を置き、ptr と len = 1 を作る。
		//
		// 幅は 8 byte で置く。要素が 1/2/4 byte でも呼び先は下位から読むので（LE）値は
		// 一致し、残り（len = 0）は誰も辿らない。
		let promoted = false;
		if (sigW) {
			parts.forEach((p, i) => {
				if (sigW[i] !== 2 || p.w !== 1) return;
				const po = emitLiftToContainer(em, n, p.off);
				if (po === false) {
					promoted = null; // 層が許さない（名指し済み）
					return;
				}
				if (po === null) {
					em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
					promoted = null;
					return;
				}
				p.off = po;
				p.w = 2;
				total += 2;
				promoted = true;
			});
			if (promoted === null) return false;
		}
		// **幅が食い違ったまま呼ばない。** 署名が「この位置は N 本」と言っているのに実引数が
		// 別の本数を出したなら、呼び先は自分の読み方で読む——足りなければ前の呼び出しの残骸を、
		// 多ければ渡したはずの片割れを落とす。どちらも黙って違う値になる。
		//
		// 1本→2本は上で持ち上げて払える（原理8）。逆（2本→1本）は捨てる操作であり、何を
		// 捨てるかは呼ぶ側には決められないので、名指しして止める。
		if (sigW) {
			const bad = parts.findIndex((p, i) => sigW[i] !== null && sigW[i] !== undefined && sigW[i] !== p.w);
			if (bad >= 0) {
				em.pop(total);
				return em.fail(n, `${callee} の第${bad + 1}引数の幅が合いません（渡す側 ${parts[bad].w} 本／受ける側 ${sigW[bad]} 本）`);
			}
		}
		const widths =
			sigW && sigW.length >= parts.length && sigW.every((x) => x !== null) && parts.every((p, i) => p.w === sigW[i])
				? sigW
				: parts.map((p) => p.w);
		const plan = assignArgSlots(widths);
		// **レジスタで渡すぶんは、末尾呼び出しの判定より前に置く。** 末尾なら `b` で
		// 飛んでしまうので、後ろに置くと引数を積まないまま飛ぶ——テストが捕まえた。
		// スタックで渡すぶんは `sp` を下げてからでないと書けないので下で置く（そちらは
		// 末尾呼び出しにしないので、この分岐には来ない）。
		const place = (onStack, base = "sp") => {
			widths.forEach((w, i) => {
				const s = plan.slots[i];
				if ((s.reg === null) !== onStack) return;
				const part = parts[i];
				for (let k = 0; k < w; k++) {
					const what = k === 0 ? `第${i + 1}引数${w > 1 ? "の ptr" : ""}` : "その len";
					if (part) {
						if (!onStack) em.load(ARG_REGS[s.reg + k], part.off + k * 8, what);
						else {
							em.load(SCRATCH[0], part.off + k * 8);
							em.emit(`str ${SCRATCH[0]}, [${base}, #${s.stackOff + k * 8}]`, `${what}（スタック渡し）`);
						}
						continue;
					}
					// **省略された引数には呼ぶ側が `__` を置く。** AAPCS64 は使われない
					// レジスタを初期化しない。デフォルトを持つ仮引数は「渡されていなければ
					// 埋める」形で出しているので（`genFunction`）、渡されなかったことを
					// `__` で伝えないと**前の呼び出しの残骸をデフォルトの判定に使う**。
					// 幅ごとに `__` の表し方が違う（1本なら niche、2本なら len = 0）。
					const one = w === 1;
					if (!onStack) {
						if (one) em.emit(`movz ${ARG_REGS[s.reg]}, #0x8000, lsl #48`, "省略された引数は __");
						else em.emit(`mov ${ARG_REGS[s.reg + k]}, #0`, k === 0 ? "省略された引数は __" : "（len = 0）");
						continue;
					}
					if (one) em.emit(`movz ${SCRATCH[0]}, #0x8000, lsl #48`, "省略された引数は __");
					else em.emit(`mov ${SCRATCH[0]}, #0`, k === 0 ? "省略された引数は __" : "（len = 0）");
					em.emit(`str ${SCRATCH[0]}, [${base}, #${s.stackOff + k * 8}]`, "（スタック渡し）");
				}
			});
		};
		place(false);
		em.pop(total);

		// **末尾呼び出しは `bl` ではなく `b` である**（tco.md §6——最適化ではなく
		// 言語仕様としての保証）。Sign にループは無く再帰しかないので、ここを `bl` の
		// ままにすると再帰の深さがそのままスタックの深さになる。
		// **場所を取った関数は末尾呼び出しにできない。**
		//
		// 末尾呼び出しは自分のフレームを畳んでから飛ぶ（自己再帰なら使い回す）。ところが
		// `$匿名式` で取った場所はそのフレームの中にあるので、畳んだ瞬間に死ぬ——呼び先が
		// 読む前に消える。`bl` にして戻ってから畳めば生きている。
		//
		// **TCO と、フレームに置いたデータは引っ張り合う。** 末尾再帰はフレームを1つに
		// 畳むのが仕事であり、そのフレームに寿命を預けているものとは両立しない。
		// **自己末尾再帰はフレームを畳まない。** `b .Lloop` は同じフレームの中へ戻る
		// だけなので、スタックで渡す引数があっても成立する——書き先は自分の引数域
		// （`x29 + フレーム`）であり、レジスタを上書きするのとまったく同じことである。
		//
		// 相互末尾呼び出しはフレームを畳んでから飛ぶので、そちらは話が別である。畳んだ
		// 先にある引数域は**呼び出し元のもの**で、大きさが合う保証が無い（合えば書ける
		// が、まだそこは見ていない）。積むものがあるなら `bl` にして戻ってから畳む。
		// **場所を取ったことは、畳めない理由ではない。** 理由になるのは、その場所への
		// 参照が**呼び先へ渡る**ことである——渡らなければ呼び先は触れないので、置いた
		// ものごと捨ててよい。`($(n , n)) ' 0` は場所を取るが渡るのは要素である。
		//
		// 一方 `sp` が動いていることは別の話で、そちらは畳む前に `x29` から戻せば済む
		// （エピローグがやっているのと同じことである）。2つを1つの旗で見ていたため、
		// 「参照は渡らないが場所は取った」形がまとめて止まっていた。
		// **持ち上げた器も「呼び先へ渡る参照」である。** `sub sp` で取った場所を指す ptr を
		// 渡すので、フレームを畳んでから飛ぶと呼び先が読む前に消える。`bl` で戻ってから
		// 畳めば生きている——`carriesFrameStorage` と同じ理由、同じ扱いである。
		// **内側の sret スロットも「呼び先へ渡る参照」である。** 器を返す呼び出しを引数に
		// 書くと、その結果は自分のフレームに取った場所を指す。畳んでから飛べば呼び先が
		// 読む前に消える——carriesFrameStorage と同じ理由だが、あちらは `$匿名式` しか
		// 見ていないので、**入れ子の sret がここを素通りしていた**。
		//
		// 型で絞るのは同じである。`($(n , n)) ' 0` は場所を取るが渡るのは要素（スカラー）
		// なので、畳んでよい。
		// **この呼び出しの値が自分の返値になるか。** 末尾かどうかの旗がそれを言っている——
		// 下で `b` にできるかを判定するのに使うが、その前に「場所は誰のものか」の答えでも
		// ある。だから畳めるかを決める前に控えておく。
		const returnsHere = tail;
		const sretCarries = parts.some((p, i) => p.took && mayCarryReference(passed[i]));
		const argCarries = promoted || sretCarries || passed.some(carriesFrameStorage);
		// 静的な旗は `$匿名式` しか見ないので、実際に動かした旗も併せて見る。
		const spMoved = !!((scope && scope.holdsFrameStorage) || em.movedSp);
		const selfTail = !!(tail && scope && callee === scope.selfLabel && !argCarries);
		// **相互末尾呼び出しも、収まるなら積める。** フレームを畳むと `sp` は
		// `x29 + フレーム`——**ちょうど自分が受け取った引数域**へ戻る。呼び先はそこを
		// `[sp]` として読むので、畳む前に自分の域へ書いておけばよい。収まるかどうかだけが
		// 条件である（呼び先の方が広ければ、呼び出し元の領分へはみ出す）。
		const mutualFits = !!(scope && plan.stackBytes <= (scope.incomingStackBytes || 0));
		if (tail && plan.stackBytes > 0 && !selfTail && !mutualFits) tail = false;
		if (tail && scope && !argCarries) {
			// **`sp` を動かしたなら戻してから飛ぶ。** 自己再帰でそのままにすると毎周
			// `sub sp` が積み上がって伸び続け、相互では畳む命令が前提を失う。
			if (spMoved) em.emit("mov sp, x29", "取った場所を捨てる（sp を戻す）");
			if (callee === scope.selfLabel) {
				// 自己末尾再帰。フレームをそのまま使い回す。飛び先は**仮引数を写す前**
				// なので、完全性公理の検査も毎回通る——ここが終端である。
				// スタックで渡すぶんは自分の引数域へ書き直してから戻る。
				if (plan.stackBytes > 0) {
					em.emit(`add ${SCRATCH[1]}, x29, #${FRAME_MARK}`, "自分の引数域（スタック渡し）");
					place(true, SCRATCH[1]);
				}
				// **x8 と x15 は戻さなくてよい。** 返値スロットの退避は飛び先（`.Lloop`）より
				// 前に置いてあるので、スロットは入口の値を持ったままである——周ごとに変わる
				// ものではない。以前は退避が中に在ったため、`bl` で壊れた残骸を書き戻さない
				// よう、ここで読み直して埋め合わせていた。**置き場所を直したら埋め合わせが
				// 要らなくなった。**
				em.emit(`b ${scope.loopLabel}`, "末尾自己再帰（フレーム再利用）");
				return TAIL;
			}
			// 相互末尾再帰。自分のフレームはもう死んでいるので畳んでから飛ぶ。
			// 大きさは本体を出し切るまで決まらないので印だけ置く。
			//
			// **スタックで渡すぶんは畳む前に自分の引数域へ書く。** 畳んだ後の `sp` が
			// そこなので、呼び先は `[sp]` として読める。`x29` は畳むと呼び出し元のものに
			// 戻るため、順序を逆にはできない。
			if (plan.stackBytes > 0) {
				em.emit(`add ${SCRATCH[1]}, x29, #${FRAME_MARK}`, "自分の引数域（スタック渡し）");
				place(true, SCRATCH[1]);
			}
			// **飛ぶ先も返値スロットを要るなら、畳む前に渡し直す。**
			//
			// 末尾なので飛んだ先の返値が自分の返値である——書く場所は自分がもらったスロット
			// で、残りももらったままでよい。ところが x8 も x15 も**途中の `bl` で壊れている**
			// （呼び出しは caller-saved を守らない）ので、レジスタに残っているものは信用でき
			// ない。畳むと `x29` が呼び出し元のものへ戻るので、順序を逆にはできない。
			//
			// x8 の方は前からこの穴を持っていた——`close_all` が `mov x21, x8` で受けている
			// のに、飛ばす側は `bl walk` を挟んだ後の残骸を渡していた。同じ事実なので一緒に直す。
			{
				const ce = em.sretPlan && (em.sretPlan.get(callee) || em.sretPlan.get(baseName));
				if (ce && ce.needsSlot && em.sretDest !== null && em.sretDest !== undefined) {
					em.load("x8", em.sretDest, "返値スロットを渡し直す（末尾呼び出し）");
					if (em.sretLimit !== null && em.sretLimit !== undefined) em.load(SRET_LIMIT, em.sretLimit, "残りも渡し直す");
				}
			}
			em.emit(`ldp x29, x30, [sp], #${FRAME_MARK}`, "自分のフレームを畳む");
			// **飛んだ先が返す本数が、この関数が返す本数である。** 型が答えない形（具体化した
			// `@p`）でも、飛び先の名前は決まっている——`genFunction` がここを読む。
			em.tailCallee = callee;
			em.emit(`b ${symbolOf(callee)}`, "末尾呼び出し");
			return TAIL;
		}

		// **返す器の場所は呼ぶ側が用意する（sret）。** 呼ばれた側は自分のフレームに
		// 置けないので（`mov sp, x29` が捨てる）、こちらの `sub sp` で取った場所を
		// x8 で渡す。大きさは `returnSizeBound` の上界であり、両側が同じ表を引く。
		// 具体化された実体は名前が変わる（`take_while$is_digit`）が、返す器の形は同じ
		// なので、素の名前で引き直す。
		// **場所を用意する基準は「組むか」ではなく「器を返すか」である。** 組まずに下の
		// 呼び出しの結果をそのまま返す関数（`mark : s ? strip_head (walk s bottom 0 0)`）
		// も、その器は**どこかのフレームに取られている**——自分のなら、返した先では死んで
		// いる。x8 をもらっていれば下へ渡せるので、もらう側に回す。
		// **旗は呼び出しごとに消す。** 同じ木から2度出すことがあるので、前回の判断が
		// 残っていると、場所を取らなかった回にまで断りが出る。
		n._sretFreshSlot = null;
		const sp0raw = em.sretPlan ? em.sretPlan.get(callee) || em.sretPlan.get(baseName) : null;
		const sp = sp0raw && sp0raw.needsSlot ? sp0raw : null;
		// **追記なら、場所は既に決まっている。** `(s ' 0) (f (s ' 1~))` の `f` は自分の
		// 器の**続き**を書くので、新しく取るのではなく渡された宛先をそのまま使う。印は
		// ノードに付いている——引数の中に別の呼び出しがあっても取り違えないためである。
		//
		// **番地と残りは対で渡す。** x8 だけでは、そこがどこまで自分のものかを呼ばれた側が
		// 知りようがない——`emitSretCapacityGuard` が読むのはこの x15 である。組み立てるのは
		// `bl` の直前（下）で、ここでは何を渡すかだけを決める。
		let limit = null;
		if (sp && n._sretInto !== undefined && n._sretInto !== null) {
			em.load("x8", n._sretInto, "続きを書く場所（追記）");
			// **追記は器を割る。** 自分が先に k 個書いたぶん、呼び先の取り分はそれだけ狭い。
			// **どこで割れているかは呼ぶ側の情報**なので、ここでしか出せない。
			const adv = n._sretAdvance || 0;
			// **割れ目は実行時に決まることもある。** 器を2つ並べる形（`(out …) \` \` (out …)`）
			// では、2つ目の宛先は「1つ目が**何個書いたか**」で決まる——静的には言えない。
			// そのときは個数の入ったスロットを渡してもらう。
			const advSlot = n._sretAdvanceSlot;
			const mine = em.sretLimit;
			if (mine !== null && mine !== undefined)
				limit = () => {
					em.load(SRET_LIMIT, mine, "自分がもらった残り");
					if (advSlot !== null && advSlot !== undefined) {
						em.load(SCRATCH[0], advSlot, "先に置いた個数（実行時）");
						em.emit(`sub ${SRET_LIMIT}, ${SRET_LIMIT}, ${SCRATCH[0]}`, "そのぶん狭い");
					} else if (adv) em.emit(`sub ${SRET_LIMIT}, ${SRET_LIMIT}, #${adv}`, `先に置いた ${adv} 要素ぶん狭い`);
				};
		} else if (sp && returnsHere && em.sretDest !== null && em.sretDest !== undefined) {
			// **場所は最も外側で一度だけ取る。** この呼び出しの値がそのまま自分の返値なら、
			// 書く先は**自分がもらったスロット**である。ここで新しく取ると、自分のフレームの
			// 中に置いて返すことになり、エピローグの `mov sp, x29` が捨てた場所を指す。
			//
			// 収まることは上界が言っている——呼ぶ側の上界はこの呼び出しを**合成して**
			// 求めた式（`k₂ + c₂k₁ + c₂c₁||p||`）なので、内側のぶんを必ず覆う。
			em.load("x8", em.sretDest, "返値スロットは自分がもらったもの（sret を下へ渡す）");
			// 場所ごと渡すのだから、残りもそのまま渡る。
			const mine = em.sretLimit;
			if (mine !== null && mine !== undefined) limit = () => em.load(SRET_LIMIT, mine, "残りももらったまま渡す");
		} else if (sp && n._sretContentInto !== undefined && n._sretContentInto !== null) {
			// **中身は呼び手のスロットの続きへ書く。** 自分の枠に取ると、返った先では
			// `mov sp, x29` が捨てた場所を器が指す。残りはバイト数で渡す（要素が値の並び
			// なので、呼ばれた側の照合はそのまま効く）。
			em.load("x8", n._sretContentInto, "中身の置き場（呼び手のスロットの続き）");
			const room = n._sretContentRoom;
			limit = () => em.load(SRET_LIMIT, room, "置き場の残り（バイト）");
		} else if (sp) {
			// 返値スロットも `sub sp` で取る場所である（門番）。
			if (!allocaAllowed(em, n, callee + " の返値スロット（sret）")) return false;
			if (sp.terms && sp.terms.length > 0) {
				// 上界が引数の要素数に依る形。**器ごとに測って足す**——上界は
				// `konst + Σ coef_i × ||器_i||` である。
				//
				// **具体化で消えた引数のぶん位置がずれる。** 関数ポインタは命令へ焼き込ま
				// れていて渡らないので（`drop`）、計画表が言う仮引数の位置と、ここで実際に
				// 積んだ位置は同じではない。`take_while $is_digit s` の `s` は仮引数では
				// 2番目だが、渡すのは1本目である。
				// **中身の置き場も同じスロットに取る。**
				//
				// 要素を `{ptr, len}` で運ぶ器は、記述子の並びだけでは足りない——指す先の中身が
				// 器と同じだけ生きなければ、返った先で番地だけが残る。記述子の**後ろ**に置き場を
				// 付け、その頭に「次に書く場所」と「終わり」を2語で置く:
				//
				//   [ 記述子 16L ][ 次に書く場所 ][ 終わり ][ 中身 M ]
				//
				// **輪のどの段からも同じ番地が出る。** 追記は宛先を `16×個数` 進めて残りを同じ
				// 個数だけ狭めるので（`add x10, x19, x24, lsl #4` と `sub x15, x20, x24`）、
				// `宛先 + 16×残り` が不変だからである。だから継ぎ足し位置を段の間で渡す必要が
				// 無い——レジスタも引数も増えない。
				let mslot = null;
				if (sp.content) {
					em.emit(`mov x11, #0`, "中身の総量（バイト）を測る");
					for (const t of sp.content) {
						const shifted = t.sizeOfIndex - drop.filter((i) => i < t.sizeOfIndex).length;
						const src = parts[shifted];
						if (!src || src.w !== 2) { mslot = false; break; }
						// **測り方は実引数が決める。** `String` の中身の総量は `len` そのもので、
						// `List(String)` なら μ（各要素の `len` の和）である。
						const a = unwrap(passed[shifted]);
						emitTermMeasure(em, src.off, a && a.atomType === "String" ? "len" : "chars", SCRATCH[0]);
						if (t.coef !== 1) {
							em.emit(`mov ${SCRATCH[1]}, #${t.coef}`, "段ごとの個数");
							em.emit(`mul ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}`, "係数を掛ける");
						}
						em.emit(`add x11, x11, ${SCRATCH[0]}`, "この器の中身ぶんを足す");
					}
					if (mslot !== false) {
						mslot = em.push();
						if (mslot === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
						em.store("x11", mslot, "中身の上界を退避");
					}
				}
				em.emit(`mov x11, #${sp.konst}`, "定数の枝ぶん");
				for (const t of sp.terms) {
					const shifted = t.sizeOfIndex - drop.filter((i) => i < t.sizeOfIndex).length;
					const src = parts[shifted];
					if (!src || src.w !== 2) return em.fail(n, `返値スロットの大きさが測れません（${callee} の第${t.sizeOfIndex + 1}引数が器ではない）`);
					emitTermMeasure(em, src.off, t.measure, SCRATCH[0]);
					if (t.coef !== 1) {
						em.emit(`mov ${SCRATCH[1]}, #${t.coef}`, "段ごとの個数");
						em.emit(`mul ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}`, "係数を掛ける");
					}
					em.emit(`add x11, x11, ${SCRATCH[0]}`, "この器のぶんを足す");
				}
				em.emit(`mov ${SCRATCH[0]}, x11`, "上界（個数）");
				if (sp.width !== 1) {
					em.emit(`mov ${SCRATCH[1]}, #${sp.width}`, "要素の幅");
					em.emit(`mul ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}`, "バイト数へ");
				}
				if (mslot !== null && mslot !== false) {
					em.load(SCRATCH[1], mslot, "中身の上界");
					em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}`, "中身の置き場ぶん");
					em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, #16`, "頭の2語（次に書く場所・終わり）");
				}
				em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, #15`, "16 バイトへ丸める");
				em.emit(`and ${SCRATCH[0]}, ${SCRATCH[0]}, #0xfffffffffffffff0`);
				em.emit(`sub sp, sp, ${SCRATCH[0]}`, "返値スロットを取る（sret）");
				if (mslot !== null && mslot !== false) {
					// 置き場の頭は `底 + 16×個数`。ここは輪のどの段でも同じ番地になる。
					em.emit(`add ${SCRATCH[0]}, sp, x11, lsl #4`, "中身の置き場の頭");
					em.load(SCRATCH[1], mslot, "中身の上界");
					em.emit(`add ${SCRATCH[1]}, ${SCRATCH[0]}, ${SCRATCH[1]}`);
					em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, #16`, "中身の終わり");
					em.emit(`str ${SCRATCH[1]}, [${SCRATCH[0]}, #8]`, "終わりを置く");
					em.emit(`add ${SCRATCH[1]}, ${SCRATCH[0]}, #16`, "次に書く場所（最初は中身の先頭）");
					em.emit(`str ${SCRATCH[1]}, [${SCRATCH[0]}]`);
					em.pop(1);
				}
				// x11 は個数のまま残っている（丸めもバイト換算も x9 の側でやった）。
				limit = () => em.emit(`mov ${SRET_LIMIT}, x11`, "入る個数を渡す（sret）");
			} else {
				// 返値スロットも `sub sp` で取る場所である（門番）。
				const bytes = sretBytesConst(sp);
				if (bytes > 0) em.emit(`sub sp, sp, #${bytes}`, `返値スロット ${bytes} バイトを取る（sret）`);
				// 丸める前の個数が上界である（丸めたぶんは余りであって、約束ではない）。
				limit = () => em.emit(`mov ${SRET_LIMIT}, #${sp.konst}`, "入る個数を渡す（sret）");
			}
			// **この場所は自分の枠の中である。** エピローグの `mov sp, x29` が捨てるので、
			// ここへ書かせた結果の**番地**を外へ出すことはできない（値を写すのは構わない）。
			// 印を呼び出しノードに付けて、番地で置く側（器の要素）に見させる。
			n._sretFreshSlot = callee;
			em.movedSp = true;
			em.emit("mov x8, sp", "返値スロットのアドレスを渡す");
		}
		// **引数を置くのは全部作り終えてから。** 先に x0 へ書くと、2つ目の引数を作る
		// 途中で潰れる（式の中に呼び出しがあれば必ず潰れる）。スタック側は sret の
		// スロットより**上**に積む——`bl` の時点で `[sp]` から始まっている必要がある
		// （AAPCS64 §6.4）ので、確保の順序がそのまま意味を持つ。
		if (plan.stackBytes > 0) {
			em.emit(`sub sp, sp, #${plan.stackBytes}`, "スタック渡しの引数域");
			em.movedSp = true;
			place(true);
		}
		// **残りは最後に組み立てる。** 途中の式は x15 を一時に使うので、`bl` の直前でなければ
		// 潰れる。x8 と違って計算で作るものなので、置く場所そのものが規約の一部である。
		if (limit) limit();
		em.emit(`bl ${symbolOf(callee)}`, n.monoLabel ? "呼び出し（具体化済み）" : "呼び出し");
		// 引数域はもう要らない。sret のスロットは返値が指しているので**畳まない**。
		if (plan.stackBytes > 0) em.emit(`add sp, sp, #${plan.stackBytes}`, "引数域を戻す");
		// 返値の幅も型が決める。器を返す関数は x0/x1 で `{ptr, len}` を返す
		// （AAPCS64 が16バイトの複合型をそう返すのと同じ置き方）。
		// **返値の幅もノードが言う。** 規則（レンジ）は `{start, step, end}` で3本になる
		// ので、型だけを見ると参照（2本）と取り違える。
		// **型が付いていない呼び出しは、呼ばれる側に訊く。** `slotsOfNode` の既定（1本）を
		// 当てると、呼び先が2本書いていても x1 を読まない——`{ptr, len}` の len が落ちる。
		// 型が付いているならそちらが正しい（規則は `{start, step, end}` で3本になるので、
		// 型名だけでは参照と取り違える）。
		let rw = slotsOfNode(n, em.conf, em.env);
		// **型が付いていない呼び出しは、呼ばれる側に訊く。**
		//
		// `slotsOfNode` の既定（1本）を当てると、呼び先が `{ptr, len}` を書いていても x1 を
		// 読まず、器が生番地1本になる（診断ゼロ）。具体化した `@p` の呼び出しは pass3 が型を
		// 付けられないので、ちょうどこの形だった：
		//
		//     f : [~s] ? s
		//     g : p ? @p `abc`
		//     ||g $f||               解釈 3 ／実機 1
		//
		// 表は**出したときの本数**を持っている（`genFunction` が書き戻す）ので、そちらが
		// 静的な見積もりより正確である。答えが無いときだけ既定に落ちる。
		if (!n.atomType && em.returnWidths) {
			const cw = em.returnWidths.has(callee) ? em.returnWidths.get(callee) : em.returnWidths.get(baseName);
			if (cw !== undefined && cw !== null) rw = cw;
		}
		if (rw === null) return em.fail(n, `返値の渡し方が決まりません（${n.atomType}）`);
		// **返値も引数と同じくレジスタで運ぶ。** AAPCS64 は16バイトを超える複合型を sret へ
		// 送るが、Sign の関数は全て `main` の内部関数なので（execution_model）呼ぶ側と
		// 呼ばれる側の両方をこちらが決められる。規則は3本まで在るので x0〜x7 の範囲で運ぶ。
		if (rw > ARG_REGS.length) return em.fail(n, `返値が ${rw} 本の関数はまだ出せません（${n.atomType}）`);
		const rbase = em.slot;
		for (let k = 0; k < rw; k++) {
			if (em.push() === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.store(ARG_REGS[k], (rbase + k) * 8, k === 0 ? (rw > 1 ? "返値の ptr" : "返値") : "返値の len");
		}
		return rw;
	}

	// **展開（後置 `~`）は、器をストリームとして渡すという指示である。**
	//
	// 機械の上ですることは無い——`l~` が渡すのは `l` と同じ `{ptr, len}` であり、違うのは
	// 受け側がそれを実体のリストとして分解するか（`[x ~xs]`）、遅延ストリームとして
	// 受けるか（`x ~xs`）だけである（list_model.md §2.4）。**同型はコストを持たない**
	// （原理8：無償なのは型の上での持ち上げであって、ここは表現が変わらないので本当に
	// 0命令である）。
	//
	// 余積を組む位置の `~`（`d st~` の連接）は別の道で、そちらは要素を並べる。
	// **後置 `@`（import）は、同一オブジェクト内では 0 命令である。**
	//
	// `#` と `@` は随伴ペアであり（`system_architecture.md` §2.1）、`#foo` の段では
	// 「静的に解決（インライン化または同一オブジェクト内）」と定められている——名前が
	// 既にこのオブジェクトの中に在るなら、要求は**その名前を指すこと**でしかない。
	//
	// だから確保もローダーも要らず、`layer: 0` から使える。Zig の `@import` と同じく
	// コンパイル時の構文であり、実行時に何かが起きるわけではない（`layer_relations.md`）。
	//
	// 別のオブジェクトから取り込む形はここへ来ない——名前がこのスコープに無いので、
	// 識別子の解決の側で決まる。そこは `link` 戦略の話であり、まだ実装していない。
	if (n.type === "operation" && n.position === "postfix" && n.name === "import" && n.operand) {
		return genExpr(n.operand, env, em, scope, tail);
	}

	// **撒くのは 0 命令である。** 器はもう並んでいるので、撒けと言われても置き直すものが
	// 無い——後置 `~` が要求するのは型の側の「1要素として足すな」であって、値の側の操作
	// ではない。
	//
	// **スカラーも同じである。** `Scalar ⇒ [Scalar, __]`——スカラーは1要素の器なので、
	// 撒けばその要素そのもの、つまり恒等射である。解釈系は既にそう振る舞っていた
	// （`5~` は 5、`1 5~` は `1 5` と同じ `[1, 5]`）が、出す側は 2 本で運ぶ器しか見て
	// おらず、スカラーは素通りして「まだ出せない式です（expand）」に落ちていた
	// ——preprocess.sn の `push : [~st] d ? d st~` がそれで、深さが1つだけのスタックは
	// 1要素の器＝スカラーだからここへ来る。
	if (n.type === "operation" && n.position === "postfix" && n.name === "expand" && n.operand) {
		const w = slotsOfNode(n.operand, em.conf, em.env);
		if (w === 1 || w === 2) return genExpr(n.operand, env, em, scope);
	}

	// **前置 `~` は持ち上げ（`continuous`）である。** `~x` は `[x]` と同じ長さ1の器で
	// あり、後置 `~`（撒く）とは逆向きの操作である。
	//
	// 器がそのまま来たなら 0 命令——既に器なのだから、持ち上げるものが無い。スカラーが
	// 来たときだけ場所を取って値を置く。これは呼ぶ側が仮引数の形に合わせて払う費用と
	// 同じ操作であり、同じ関数（`emitLiftToContainer`）が出す。
	//
	// **`~@番地` はこの規則から出てくる。** `@p` は場所から値を読み、`~` がそれを器に
	// する——番地そのものは表に出ない（`$` が作った番地を算術に使えないのと同じ理由）。
	if (n.type === "operation" && n.position === "prefix" && n.name === "continuous" && n.operand) {
		// **入力は読まずに番地だけを置く。** `~@X` の型が `Reader` のとき、ここで `@X` を生成すると
		// その場で1回読んでしまう。読むのは分解したとき（頭）であり、ストリームそのものは番地で
		// ある——`@` の中の X（番地）だけを置けば、それが Reader の実体になる。器は作らないので
		// layer 0 でも通る（以前は1回読んだ値を長さ1の器へ包むので確保が要り、layer 0 が断っていた）。
		if (n.atomType === "Reader") {
			const src = n.operand && n.operand.type === "operation" && n.operand.name === "input" ? n.operand.operand : null;
			if (!src) return em.fail(n, "入力（Reader）の番地が読み取れません");
			const aw = genExpr(src, env, em, scope);
			if (aw === false) return false;
			if (aw !== 1) { em.pop(aw === TAIL ? 0 : aw); return em.fail(n, `入力の番地はレジスタ1本の値でなければなりません（${aw} 本）`); }
			return 1;
		}
		const w = genExpr(n.operand, env, em, scope);
		if (w === false) return false;
		if (w === 2) return 2; // 既に器
		if (w !== 1) {
			em.pop(w === TAIL ? 0 : w);
			return em.fail(n, `\`~\` で持ち上げられるのはレジスタ1本の値か器だけです（${w} 本）`);
		}
		const off = (em.slot - 1) * 8;
		const po = emitLiftToContainer(em, n, off, "`~` で長さ1の器へ持ち上げる");
		if (po === false) return false; // 層が許さない（名指し済み）
		if (po === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		// 元のスカラーのスロットは要らない。器の2本だけを残す。
		em.load(SCRATCH[0], po);
		em.load(SCRATCH[1], po + 8);
		em.pop(3);
		const [p2, l2] = pushPair(em);
		if (l2 === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		em.store(SCRATCH[0], p2, "ptr");
		em.store(SCRATCH[1], l2, "len");
		return 2;
	}

	// **添字。** 器は `{ptr, len}` で来るので、引くのはアドレス計算1つである
	// （type_system.md §2 のアクセス表：`base + i × sizeof(T)`）。
	//
	//   s ' i    要素1つを読む     → 要素型（`Char` / `Int` …）
	//   s ' i~   そこから末尾まで   → 器と同じ型（`{ptr + i×幅, len - i}`）
	//
	// **どちらもメモリを要求しない。** 後者は同じ領域を指したまま頭と長さをずらすだけで、
	// `[h ~t]` の分解とまったく同じ機械である——`~` の意味が1つになったので、分解と
	// スライスが同じ規則の別の書き方であることが命令の上でも見えるようになった。
	// **レンジは規則である。** 置かれているのは `{start, step, end}` という固定サイズの
	// 3つ組だけで、要素列はどこにも無い（list_model.md §2.3）。だからレジスタに乗り、
	// 無限でも 24 バイトで済む。3つを連続したスロットへ積む——順に積めば連続する。
	if (n.type === "operation" && (n.name === "range" || n.name === "range_arithmetic")) {
		const parts = rangeParts(n);
		if (!parts) return em.fail(n, `等差のレンジだけを出せます（${n.op}——添字が start + i × step にならない）`);
		const want = slotsOfNode(n, em.conf, em.env);
		if (want === null) return em.fail(n, `レンジの渡し方が決まりません（${n.atomType}）`);
		const pieces = [parts.start, parts.step, ...(parts.end ? [parts.end] : [])];
		if (pieces.length !== want) return em.fail(n, `レンジの本数が合いません（${pieces.length} と ${want}）`);
		const base = em.slot;
		const names = ["start", "step", "end"];
		for (let i = 0; i < pieces.length; i++) {
			const w = genScalar(pieces[i], env, em, scope, "レンジの端点と歩幅はレジスタ1本の値です");
			if (w === false) return false;
			// 端点は積んだ順に並ぶ。連続しているので、そのまま `{start, step, end}` になる。
			if ((em.slot - 1) * 8 !== (base + i) * 8) {
				em.load(SCRATCH[0], (em.slot - 1) * 8);
				em.pop(1);
				em.push();
				em.store(SCRATCH[0], (base + i) * 8, names[i]);
			} else {
				em.emit(`// ${names[i]}`, i === 0 ? "規則（メモリ上に無い）" : undefined);
			}
		}
		// **歩幅か終端が `__` の規則は `__` である**（解釈器も `__`）。規則を引く側は起点が `__` かしか見ない
		// （`ruleStartMaybeUnit`）ので、ここで起点を niche に倒しておく。見ていなかったので、歩幅が
		// 射の無い積（`[p ~+ (q * 2)] ' i`）の規則で、機械だけが `start + i × niche` を番地として返していた。
		const unitPieces = pieces.map((p, i) => i > 0 && !cannotBeUnit(p, env, scope)).map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
		if (unitPieces.length) {
			em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
			em.load(SCRATCH[0], base * 8, "start");
			for (const i of unitPieces) {
				em.load(SCRATCH[1], (base + i) * 8, names[i]);
				em.emit(`cmp ${SCRATCH[1]}, x12`, `${names[i]} が __ か`);
				em.emit(`csel ${SCRATCH[0]}, x12, ${SCRATCH[0]}, eq`, `${names[i]} が __ なら規則も __`);
			}
			em.store(SCRATCH[0], base * 8, "start");
		}
		// 歩幅を書かない形なら、置いた `1` を端点の並びで符号付きに直す。ここで畳んで
		// おけば、この先どれだけ切っても向きは動かない。
		if (parts.signedByEnds && pieces.length === 3) {
			em.load(SCRATCH[0], base * 8, "start");
			em.load(SCRATCH[1], (base + 2) * 8, "end");
			em.emit(`cmp ${SCRATCH[0]}, ${SCRATCH[1]}`);
			em.emit("mov x11, #1");
			em.emit("movn x12, #0", "−1");
			// 番地の端点は符号なしで並べる（`0x7FFF…F0 ~ 0x8000…10` は昇順である）。
			const ascend = elementTypeOfNode(n, env) === "Address" ? "ls" : "le";
			em.emit(`csel x11, x11, x12, ${ascend}`, "昇順なら +1、降順なら −1");
			em.store("x11", (base + 1) * 8, "歩幅（向きを持つ）");
		}
		return want;
	}

	// **カーソルを組む。** `(arm s) , 0 , s` は積に見えるが、置かれるのは
	// `{arm, k, 入力}` の3つ組であってメモリ上の並びではない（stream_desugar.js）。
	// レンジと同じ機械で、順に積めば連続する。
	if (n.type === "operation" && n.name === "product" && n.repr === "cursor") {
		const want = slotsOfNode(n, em.conf, env);
		if (want === null) return em.fail(n, "カーソルの渡し方が決まりません");
		// **結合の向きに依存しない歩き方をする**（`flattenProduct`）。片方へ降りる while
		// ループは「左結合で積まれている」を前提にしていた。
		const parts = flattenProduct(n) || [];
		if (parts.length !== 3) return em.fail(n, `カーソルは {arm, k, 入力} の3つです（${parts.length} つ来ました）`);
		const base = em.slot;
		const names = ["arm", "k", "入力"];
		for (let i = 0; i < parts.length; i++) {
			const w = genExpr(parts[i], env, em, scope);
			if (w === false) return false;
			if ((em.slot - w) * 8 !== (base + (i === 2 ? 2 : i)) * 8) {
				// 隙間ができたら詰める（前の項が複数本だった場合）。
				for (let k = 0; k < w; k++) {
					em.load(SCRATCH[0], (em.slot - w + k) * 8);
					em.store(SCRATCH[0], (base + (i === 2 ? 2 : i) + k) * 8, k === 0 ? names[i] : undefined);
				}
			} else {
				em.emit(`// ${names[i]}`, i === 0 ? "カーソル（メモリ上に無い）" : undefined);
			}
			if (i < 2 && w !== 1) return em.fail(parts[i], `カーソルの ${names[i]} はレジスタ1本の値です（${w} 本）`);
		}
		const got = em.slot - base;
		if (got !== want) return em.fail(n, `カーソルの本数が合いません（${got} と ${want}）`);
		return want;
	}

	// **`$` `@` `#` は niche を動かせない。**
	//
	// `$__ = __ = @__` は機械語の側の不動点である——記憶が無いものにアドレスは無く、
	// 無いアドレスから読めるものも無い。3つとも同じビット列（niche）であり、区別している
	// のは型だけである（`__` は `Unit`、`$__` は `Address`）。原理2「型はゼロコストの帳簿」
	// がそのまま出る場所で、`f $__` が完全性公理で崩壊しないのに1命令も余分に要らない。
	//
	// guide の演算子表が `$__ # expr` を「致命的なエラー（不正なアドレスへの書き込み）」と
	// 呼ぶのも同じことで、niche は書き込み先ではない。

	// **前置 `!` は「`__` かどうか」を反転する。**
	//
	// `!__` は恒等射（真）、`!x` は `x` が値なら `__`（偽）である（pass3 の型規則）。
	// つまり見ているのは中身ではなく**不在かどうか**で、それは幅ごとに決まっている
	// （`emitIsUnit`）。`0` が真なので、真は `0`・偽は niche を置けばよい。
	//
	// `!__` はこの規則の定数畳み込みにすぎない——`__` は必ず不在なので必ず `0` になる。
	if (n.type === "operation" && n.position === "prefix" && n.name === "not") {
		const t = unwrap(n.operand);
		const off0 = em.push();
		if (off0 === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		if (isUnitNode(t)) {
			em.emit(`mov ${SCRATCH[0]}, #0`, "!__ は恒等射——`0` が真");
			em.store(SCRATCH[0], off0);
			return 1;
		}
		em.pop(1);
		const w = genExpr(n.operand, env, em, scope);
		if (w === false) return false;
		const o = (em.slot - w) * 8;
		const opBase = unwrap(n.operand);
		emitIsUnit(em, o, w, "`__` か", isRuleNode(opBase, em.conf, env), opBase && opBase.repr === "cursor");
		em.emit(`mov ${SCRATCH[0]}, #0`, "不在なら真（`0`）");
		em.emit("movz x12, #0x8000, lsl #48", "在るなら偽（`__`）");
		em.emit(`csel ${SCRATCH[0]}, ${SCRATCH[0]}, x12, eq`);
		em.pop(w);
		const off1 = em.push();
		if (off1 === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		em.store(SCRATCH[0], off1, "!");
		return 1;
	}

	// 前置 `$`——アドレスを取る。
	if (n.type === "operation" && n.position === "prefix" && n.name === "address") {
		const t = unwrap(n.operand);
		const off = em.push();
		if (off === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		// `$__` は niche そのもの。型は `Address` だがビットは `__` と同じ。
		if (t && t.type === "atom" && t.kind === "unit") {
			em.emit(`movz ${SCRATCH[0]}, #0x8000, lsl #48`, "$__ は niche（記憶が無いものにアドレスは無い）");
			em.store(SCRATCH[0], off);
			return 1;
		}
		// 仮引数はフレームに在るので、そのアドレスが取れる。
		if (isIdentifierNode(t) && scope && scope.params) {
			const i = scope.params.indexOf(t.value);
			if (i >= 0) {
				em.emit(`add ${SCRATCH[0]}, x29, #${16 + scope.paramOffsets[i]}`, `$${bareName(t.value)}（フレーム内）`);
				em.store(SCRATCH[0], off);
				return 1;
			}
		}
		em.pop(1);

		// **`$[器 ' 添字]` は要素の場所である。**
		//
		// `器 ' 添字` が要素を**読む**のに対し、`$` を被せたものは同じ計算の途中で止まる
		// ——`base + i × sizeof(T)` を出して、辿らずに返す。だから型が語る幅がそのまま
		// 番地の刻みになり、読みと書きが同じ場所を指すことが命令の上で保証される。
		//
		// ここが無いと `$[l ' 0]` は下の「匿名式」へ落ち、**その場でコピーを置いて**その
		// 番地を返していた。書き込みは通るのに元へ届かない、という黙って違う値になる形で
		// ある（解釈側では届くので、同じプログラムが2つの意味を持っていた）。
		//
		// 範囲外は `__` を返す。書き込み側（`#`）が niche を書き込み先ではないと見て弾く
		// ので、不正な番地へ書くことにはならない。
		// **名前付きスロットへ書く道はまだ無い。**
		//
		// type_system.md は `'`（添字・フィールド）が「書き込める場所」（`Implicit`）を生むと
		// 書いているが、実装が受け取れるのは器の要素だけである。ここを素通りさせると下の
		// 「匿名式」へ落ちて**その場のコピー**へ書く——書き込みは通るのに元へ届かない。
		// 解釈器は Unit を返して何も起きないので、**同じソースが両側で違う落ち方をして、
		// どちらも診断ゼロ**だった。
		//
		// 構造体を書き換えられるようにするかはまだ決めていない。決まらないことは言う（原理4）。
		if (t && t.type === "operation" && t.name === "get_prop") {
			const bt = unwrap(t.left);
			if (bt && bt.atomType === "Struct") {
				return em.fail(n, "構造体のスロットへは書けません（`$[p ' foo] # 値`）。書ける先は名前の束縛と器の要素だけです");
			}
		}
		if (t && t.type === "operation" && t.name === "get_prop" && t.left && t.right) {
			const et = t.atomType;
			const m1 = et ? measure({ atomType: et }, { target: em.conf.target, charset: em.conf.charset }) : null;
			if (m1 && m1.size) {
				const cw = genExpr(t.left, env, em, scope);
				if (cw === false) return false;
				if (cw === 2) {
					const co = (em.slot - 2) * 8;
					const iw = genScalar(t.right, env, em, scope, "添字はレジスタ1本の値です");
					if (iw === false) return false;
					em.load(SCRATCH[1], (em.slot - 1) * 8, "添字");
					em.pop(1);
					em.load(SCRATCH[0], co + 8, "len");
					em.emit(`cmp ${SCRATCH[1]}, ${SCRATCH[0]}`, "範囲内か");
					em.load(SCRATCH[0], co, "ptr");
					const shift = m1.size === 8 ? 3 : m1.size === 4 ? 2 : m1.size === 2 ? 1 : 0;
					if (shift) em.emit(`add x14, ${SCRATCH[0]}, ${SCRATCH[1]}, lsl #${shift}`, `base + i × ${m1.size}`);
					else em.emit(`add x14, ${SCRATCH[0]}, ${SCRATCH[1]}`, "base + i");
					em.emit("movz x12, #0x8000, lsl #48", "範囲外は __（書き込み先にならない）");
					em.emit(`csel ${SCRATCH[0]}, x14, x12, lo`);
					em.pop(2);
					const ao = em.push();
					if (ao === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
					em.store(SCRATCH[0], ao, "要素の場所");
					return 1;
				}
				em.pop(cw === TAIL ? 0 : cw);
			}
		}

		// **`$匿名式` は「その場で置いて、そのアドレスを返す」。**
		//
		// 演算子表がそう言っている——「その場で生成された**オブジェクト本体のアドレス**を
		// 取得する。C++ の `&(new [](x){x})` に相当」。つまり確保の記法は最初から在った。
		//
		// 置く先は**自分のスタック**である。`sp` を下げれば1命令で場所が取れる——フリー
		// リストも管理情報も要らない。`x29` はフレームの底を指したままなので、スロットの
		// 読み書きは何も変わらない（`wrapFrame` が戻すのは `x29` から）。
		//
		// **これは `alloca` であって `malloc` ではない。** 返せないという制約もそのまま
		// ——自分のフレームなので、呼び出し側へ返すと死んだ場所を指す。返す規約（sret）は
		// まだ決まっていない（memory_management.md §2）。
		if (isIdentifierNode(t)) {
			// 関数のアドレス（`$is_digit`）は単相化が扱うのでここへ来ない。
			//
			// **名前付きの束縛には場所を与える。** 演算子表が `$名前` を「binding 自体の
			// アドレス。binding ごとに一意・安定」と定めている。トップレベルの定数は命令へ
			// 畳まれるので指す先が無かった——`$関数` は単相化が、`$匿名式` は `alloca` が
			// 扱えるのに、**値の束縛だけが場所を持たない**という穴だった。`.rodata` に
			// 置いて、そのラベルのアドレスを作る。
			//
			// **構造体もここへ来る。** かつて `bindingLabel` は「1つの値＋1つの幅」しか
			// 置けなかったので、幅の違うスロットが並ぶ構造体は場所を持てず、`$p` は
			// 「アドレスを取れるのはフレームに在るものだけです」で断られていた。置き方は
			// `structBindingLabel` が知っている——並びは `layoutOfStruct` のものである。
			const nb = env ? envLookup(env, t.value) : null;
			const got = nb ? bindingLabel(t.value, nb, env, em) || structBindingLabel(t.value, nb, env, em) : null;
			if (got) {
				const label = got.label;
				const off = em.push();
				if (off === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
				em.emit(`adrp ${SCRATCH[0]}, ${label}`, `${bareName(t.value)} の場所（$名前）`);
				em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, :lo12:${label}`);
				em.store(SCRATCH[0], off, "binding のアドレス");
				return 1;
			}
			return em.fail(n, `アドレスを取れるのはフレームに在るものだけです（${bareName(t.value)}）`);
		}
		// **積は `$` で場所を得る。** `h , t` はそれだけでは置き場所を持たないが、
		// `$(h , t)` は「その場で生成されたオブジェクト本体」そのものである。ここで
		// スカラーを順に置けば、それが cons セルになる——`{ptr, len}` の器ではなく、
		// 幅の決まった組である（`list_model.md` の List は連続領域、こちらは組）。
		// 同上——組の要素も向きに依存せず開く。
		const parts = t && t.type === "operation" && t.name === "product" ? flattenProduct(t) || [] : [];
		if (parts.length > 1) {
			const base = em.slot;
			for (const p of parts) {
				const pw = genScalar(p, env, em, scope, "組の要素はレジスタ1本の値です");
				if (pw === false) return false;
			}
			const got = em.slot - base;
			if (!allocaAllowed(em, n, "`$` で組を置く")) return false;
			const bytes0 = Math.ceil((got * 8) / 16) * 16;
			em.emit(`sub sp, sp, #${bytes0}`, `${got} 語の組を置く（$匿名式）`);
			em.movedSp = true;
			for (let k = 0; k < got; k++) {
				em.load(SCRATCH[0], (base + k) * 8);
				em.emit(`str ${SCRATCH[0]}, [sp, #${k * 8}]`, k === 0 ? "置く" : undefined);
			}
			em.emit(`mov ${SCRATCH[0]}, sp`, "そのアドレス");
			em.pop(got);
			const po0 = em.push();
			if (po0 === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.store(SCRATCH[0], po0, "$匿名式（組）");
			return 1;
		}
		const vw = genExpr(n.operand, env, em, scope);
		if (vw === false) return false;
		if (vw === TAIL) return em.fail(n, "末尾呼び出しのアドレスは取れません");
		const vo = (em.slot - vw) * 8;
		if (!allocaAllowed(em, n, "`$` で値を置く")) return false;
		// AArch64 の `sp` は16バイト境界を要求する。
		const bytes = Math.ceil((vw * 8) / 16) * 16;
		em.emit(`sub sp, sp, #${bytes}`, `${vw} 本ぶんの場所を取る（$匿名式）`);
		em.movedSp = true;
		for (let k = 0; k < vw; k++) {
			em.load(SCRATCH[0], vo + k * 8);
			em.emit(`str ${SCRATCH[0]}, [sp, #${k * 8}]`, k === 0 ? "置く" : undefined);
		}
		// **`$__ = __`。** 置く値が `__` なら、場所を作っても指すものが無い——`@__ = __`
		// と対である。門番は既に「`__` は書かない」を出していたが、**書かずにアドレスは
		// 返していた**ので `$@__` や `$__` が場所を指していた（`@__` は `__` なのだから
		// `$@__` は `$__` ＝ `__` でなければならない）。
		//
		// **これは型の側の足場である。** `Scalar ⇒ [Scalar, __]` という持ち上げ——1要素の
		// 器はスカラーと同型、という主張を昇る方向へ読むこと——が観測を壊さないと言える
		// のは、機械の上で `$__ = __ = @__` が成り立つときだけである。単位元が持ち上げで
		// 動かないことが、持ち上げそのものの根拠になっている。
		//
		// `__` になり得ない値には出さない（`cannotBeUnit`）——boot で「番地が定数なら
		// 全域性はタダ」だったのと同じ形である。
		if (vw === 1 && !cannotBeUnit(n.operand, env, scope)) {
			em.emit(`mov ${SCRATCH[1]}, sp`, "そのアドレス");
			em.load(SCRATCH[0], vo, "置いた値");
			em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
			em.emit(`cmp ${SCRATCH[0]}, x12`, "置いたのは __ か");
			em.emit(`csel ${SCRATCH[0]}, x12, ${SCRATCH[1]}, eq`, "__ を置いた場所は __（$__ = __）");
		} else {
			em.emit(`mov ${SCRATCH[0]}, sp`, "そのアドレス");
		}
		em.pop(vw);
		const ao = em.push();
		if (ao === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		em.store(SCRATCH[0], ao, "$匿名式");
		return 1;
	}

	// 前置 `@`——アドレスから読む。niche なら読まずに `__`。
	if (n.type === "operation" && n.position === "prefix" && n.name === "input") {
		// **`@$x` は恒等射である。**
		//
		// `$名前` は束縛の番地であり（演算子表 tier 23）、そこから読めば束縛の値そのもの
		// である——番地を作って読み直す意味が無い。フレームの中に在るものは niche にも
		// なりえないので、`@` が出す「記憶が無いか」の分岐も要らない。10命令が 0 になる。
		//
		// `$匿名式` は別である（その場に置いた**新しい**場所なので、読むまで中身が無い）。
		const src0 = unwrap(n.operand);
		if (src0 && src0.type === "operation" && src0.position === "prefix" && src0.name === "address") {
			const named = unwrap(src0.operand);
			if (isIdentifierNode(named) && scope && scope.params && scope.params.indexOf(named.value) >= 0) {
				return genExpr(named, env, em, scope);
			}
		}
		// **`@` の域は番地である。和のまま来たら断る。**
		//
		// `+` は「GPR 幅の整数演算だけを出せます（Address | Int）」、`=` は「GPR 幅の値の
		// 比較だけを出せます」で同じ形を名指ししているのに、ここだけ**オペランドの型を1度も
		// 見ずに** `ldr` を出していた。見ているのは指す先の幅（`slotsOfNode`）・幅プリフィックス・
		// 番地が定数に畳めるか の3つで、どれも「**その値が番地なのか**」を問うていない。
		//
		// 結果、`Int` を番地として読む命令が**診断ゼロで出る**。実測（`f : x ? x > 3 : 42` の
		// 下に `0x40000000` を置いた `Address | Int` を `@` する）で、実機はスタックを踏み抜いた
		// ——C の型混同（int をポインタとして逆参照）と同じ形である。
		//
		// **これは門を足す話ではなく、域が広く書かれているのを直す話である。** 演算は
		// 「左辺が選ぶ域 → 結果 | `__`」の射で決まる（設計根拠）。`@` の域は `Address` であって
		// `Address | Int` ではない。断るのは**和のときだけ**である——型が決まっていない
		// （`null`・`Atom`）ものは断らない。分からないことに答えないのは原理4 の側である。
		{
			const ot = n.operand && n.operand.atomType;
			if (typeof ot === "string" && ot.includes(" | ")) {
				return em.fail(
					n,
					`番地から読めるのは番地だけです（${ot}）——どの枝かが決まらないので、` +
						"その値が番地かどうかも決まりません"
				);
			}
		}

		// **`@` が読むのは1語である。**
		//
		// 指す先が器（`{ptr, len}`）や組（`{h, t}`）なら、1語では足りない——そこは
		// 読むのではなく**指したまま引く**必要がある（Struct のフィールド addressing）。
		// `widthOfType` は決まらない型に 8 を返すので、ここで見ないと2語の値を1語で
		// 読んで**幅が黙って食い違う**。型は既に何本か言っているのだから、そこを見る。
		const rw0 = slotsOfNode(n, em.conf, env);
		if (rw0 !== null && rw0 !== 1) {
			// **1語より広い指す先は、読むのではなく指したまま引く。**
			//
			// 器（`{ptr, len}`）を指すアドレスは、そのアドレスが既に `ptr` である——
			// 要るのは `len` だけで、それは形（`layoutOfStruct` / `measure`）が知っている。
			// **ロードは1つも出ない**：アドレスを参照として読み替えるだけである。
			// `.rodata` の文字列で `{ptr, len}` を積むのとまったく同じ形になる。
			const shape = n.pointeeNode ? measure(n.pointeeNode, { target: em.conf.target, charset: em.conf.charset, env }) : null;
			if (rw0 === 2 && shape && shape.count) {
				if (!genScalar(n.operand, env, em, scope, "アドレスはレジスタ1本の値です")) return false;
				const ao0 = (em.slot - 1) * 8;
				const lo0 = em.push();
				if (lo0 === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
				em.emit(`mov ${SCRATCH[1]}, #${shape.count}`, `len は形が知っている（${shape.count} 要素・ロードは出ない）`);
				em.store(SCRATCH[1], lo0, "len");
				em.emit(`// ptr はアドレスそのもの`, "指したまま引く");
				return 2;
			}
			return em.fail(n, `${rw0} 本で運ぶ値を指すアドレスはまだ読めません（${n.atomType}——指したまま引く必要があります）`);
		}
		// 書き込み側と同じ畳み。読む番地が定数なら「記憶が無い」検査は答えが出ているし、
		// 番地そのものもスロットを経由せずレジスタへ作れる——`genScalar` を通すと同じ
		// 定数を作って置いて読み戻すので、**そこを丸ごと飛ばす**。
		const declared = declaredWidthOf(n.operand);
		if (Number.isNaN(declared)) return em.fail(n, "その幅の命令が機械にありません（プリフィックスの数を見直してください）");
		const w = declared ?? widthOfType(n.atomType, em.conf);
		const fixedSrc = constAddressOf(n.operand, env);
		if (fixedSrc !== null && fixedSrc !== NICHE_VALUE) {
			const off0 = em.push();
			if (off0 === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			emitImm(em, SCRATCH[0], fixedSrc, "アドレス（定数——niche ではない）");
			em.emit(loadAt(SCRATCH[0], SCRATCH[0], w), `${w} byte を読む`);
			em.store(SCRATCH[0], off0);
			return 1;
		}
		if (!genScalar(n.operand, env, em, scope, "アドレスはレジスタ1本の値です")) return false;
		const po = (em.slot - 1) * 8;
		{
			const none = em.newLabel("noaddr");
			const done = em.newLabel("loaded");
			em.load(SCRATCH[0], po, "アドレス");
			em.emit("movz x12, #0x8000, lsl #48", "niche なら記憶が無い");
			em.emit(`cmp ${SCRATCH[0]}, x12`);
			em.emit(`b.eq ${none}`, "@__ = __（読まない）");
			em.emit(loadAt(SCRATCH[0], SCRATCH[0], w), `${w} byte を読む`);
			em.emit(`b ${done}`);
			em.label(none);
			em.emit(`mov ${SCRATCH[0]}, x12`, "__");
			em.label(done);
		}
		em.store(SCRATCH[0], po);
		return 1;
	}

	// 中置 `#`——アドレスへ書く。**守るのは左辺**（不正なアドレスへ書かない）。
	// 右辺の `__` は書ける——書けないと場所を空にできない。
	if (n.type === "operation" && n.name === "output" && n.position === "infix") {
		// **生の番地へ直に書けるのは、ハードウェアを触る層だけである。**
		//
		// `0x9000000 # 0x4b`（UART へ1文字）は layer 0〜1 の仕事であり、上の層で同じ式を
		// 許すと**任意の番地へ書ける**ことになる。書き込み先が `$名前`・受け取った参照・
		// 分解した先なら、それは自分が持っているものなので層に関わらず書ける。
		//
		// これは alloca の門番と逆向きである（下限ではなく上限）。層は機能を積み上げる
		// だけではない、という一点がここに出る。
		if (em.conf.layer !== undefined && em.conf.layer > 1 && rawAddressNode(n.left, env)) {
			return em.fail(
				n,
				`layer: ${em.conf.layer} では生の番地へ直に書けません（番地の捏造を防ぐため）。` +
					"MMIO を扱えるのは layer: 0〜1 です——上の層では `$名前`・受け取った参照・分解した先へ書きます"
			);
		}
		// **定数はスロットを経由する理由が無い。**
		//
		// `genExpr` の規約は「どの式も新しいスロットへ置く」で、合成が閉じるためにそれで
		// よい。だが定数は**その場でレジスタに作れる**ので、書いて読み戻す往復は丸ごと
		// 無駄である。MMIO の書き込みは書き込み先も値も定数なので、boot コードはここに
		// 全部落ちる。
		//
		// 値が定数でないときも、**書き込み先だけは**直接置ける。ただし順番が要る——値を
		// 先に出さないと `genExpr` がスクラッチを壊す。
		const cDst = constAddressOf(n.left, env);
		const cVal = constAddressOf(n.right, env);
		const declOut = declaredWidthOf(n.left);
		if (Number.isNaN(declOut)) return em.fail(n, "その幅の命令が機械にありません（プリフィックスの数を見直してください）");
		const wOut = declOut ?? widthOfType(n.right && n.right.atomType, em.conf);
		if (cDst !== null && cDst !== NICHE_VALUE) {
			const off = em.push();
			if (off === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			// **0 は作らなくてよい。** AArch64 は 0 を読み出す register を持っている
			// （`xzr` / `wzr`）ので、材料化する命令に意味が無い。MMIO の初期化は
			// 「レジスタを 0 にして黙らせる」から始まるので、ここは毎回通る。
			let srcReg = SCRATCH[1];
			if (cVal !== null) {
				emitImm(em, SCRATCH[0], cDst, "書き込み先（定数——niche ではない）");
				if (cVal === 0n) srcReg = "xzr";
				else emitImm(em, SCRATCH[1], cVal, "書く値（定数）");
			} else {
				const vw2 = genExpr(n.right, env, em, scope);
				if (vw2 === false) { em.pop(1); return false; }
				if (vw2 !== 1) { em.pop(vw2 + 1); return em.fail(n.right, `書ける値はレジスタ1本ぶんです（${vw2} 本の参照で運ぶ値）`); }
				em.load(SCRATCH[1], (em.slot - 1) * 8, "書く値");
				em.pop(1);
				emitImm(em, SCRATCH[0], cDst, "書き込み先（定数——niche ではない）");
			}
			const skipC = em.newLabel("unwritable");
			const guardedC = emitWritableGuard(em, srcReg, n.right, env, skipC, scope);
			em.emit(storeAt(srcReg, SCRATCH[0], wOut), `${wOut} byte を書く`);
			if (guardedC) em.label(skipC);
			em.store(SCRATCH[0], off);
			return 1;
		}
		if (!genScalar(n.left, env, em, scope, "書き込み先はレジスタ1本のアドレスです")) return false;
		const po = (em.slot - 1) * 8;
		const vw = genExpr(n.right, env, em, scope);
		if (vw === false) return false;
		if (vw !== 1) { em.pop(vw); return em.fail(n.right, `書ける値はレジスタ1本ぶんです（${vw} 本の参照で運ぶ値）`); }
		const vo = (em.slot - 1) * 8;
		const decl2 = declaredWidthOf(n.left);
		if (Number.isNaN(decl2)) return em.fail(n, "その幅の命令が機械にありません（プリフィックスの数を見直してください）");
		const w = decl2 ?? widthOfType(n.right && n.right.atomType, em.conf);
		// **番地が分かっているなら、守る相手はもう居ない。**
		// 検査は「書き込み先が niche か」だけなので、定数なら今答えが出る。
		const fixedDst = constAddressOf(n.left, env);
		if (fixedDst !== null && fixedDst !== NICHE_VALUE) {
			em.load(SCRATCH[0], po, "書き込み先（定数——niche ではない）");
			em.load(SCRATCH[1], vo, "書く値");
			em.emit(storeAt(SCRATCH[1], SCRATCH[0], w), `${w} byte を書く`);
		} else {
			const skip = em.newLabel("nowrite");
			const done = em.newLabel("wrote");
			em.load(SCRATCH[0], po, "書き込み先");
			em.emit("movz x12, #0x8000, lsl #48", "niche は書き込み先ではない");
			em.emit(`cmp ${SCRATCH[0]}, x12`);
			em.emit(`b.eq ${skip}`, "不正なアドレスへは書かない");
			em.load(SCRATCH[1], vo, "書く値");
			const skipG = em.newLabel("unwritable");
			const guardedG = emitWritableGuard(em, SCRATCH[1], n.right, env, skipG, scope);
			em.emit(storeAt(SCRATCH[1], SCRATCH[0], w), `${w} byte を書く`);
			if (guardedG) em.label(skipG);
			em.emit(`b ${done}`, "成功したらアドレスを返す");
			em.label(skip);
			em.emit(`mov ${SCRATCH[0]}, x12`, "書けなければ __");
			em.label(done);
		}
		em.pop(1);
		em.store(SCRATCH[0], po);
		return 1;
	}

	// **名前が静的に綴れなくても、探せば引ける。**
	//
	// 名前付きスロットの物理配置は名前順で決まるので、鍵が静的に綴れれば引く場所は 0 命令で
	// 決まる。決まらないときは `genNameSearch` が `.rodata` の名前表を舐める——「決まって
	// いることは実行時に訊かない」という形はそのままに、決まらない場合の答えを持たせた。
	//
	// ここは以前この形を丸ごと断っていた。解釈器は値を返すので、断りのままだと**言語には
	// 在るのに実機だけが答えられない**状態が残る。
	if (n.type === "operation" && n.name === "get_prop" && !n.runtimeIndexProblem) {
		const out = genIndex(n, env, em, scope);
		if (out !== null) return out;
		// 出せない形（`Struct` のスロット・型が決まらない器）は下の診断へ落ちる。
	}

	// **多相な器を実行時の添字で引くのは、Sign が持たないと決めた唯一の場所である。**
	//
	// 他の言語が `dyn` や仮想テーブルで解くのがここであり、Sign は実行時ディスパッチを
	// 持たない（compiler_pipeline.md §3「コンパイル時のシミュレーション実行で解決
	// できなければ、それは単純にコンパイルエラーであり、実行時フォールバック経路を
	// 言語として持たない」）。「まだ実装していない」と読まれないよう言い分ける。
	if (n.type === "operation" && n.name === "get_prop" && n.runtimeIndexProblem) {
		return em.fail(
			n,
			n.runtimeIndexProblem === "named"
				? "名前付きスロットへ実行時の添字は引けません（物理配置は名前順、stack_abi.md §7.1）"
				: "多相な器へ実行時の添字は引けません——ここが動的型付けの要る唯一の場所であり、" +
					"Sign は実行時ディスパッチを持たない（compiler_pipeline.md §3）。スロットの型を揃えれば List になります"
		);
	}
	// **器を作る式は、記憶を確保できる layer でしか成立しない。**
	//
	// `layer: 0` には確保の手段が無い（前置 `#` はコンパイルエラー、memory_management.md
	// §2 の表）。あるのは `alloca` と `.rodata` だけで、`alloca` は自分のフレームなので
	// 返せない。切り出し（`s ' i~`）がコピー無しで作れるのとは別の話である——あちらは
	// 既にある記憶を指し直すだけで、新しい場所を要求しない。
	//
	// layer が上がっても今は出せないが、そのときの理由は「確保の規約が未定」であって
	// 「この layer では書けない」ではない。**同じ「出せない」でも中身が違う**ので分ける。
	// **分解したものを組み直すのは恒等射である。**
	//
	// `body_of : [c ~rest] ? … c rest` の `c rest` は、渡された器そのものである。
	// `[c ~rest]` は器をその場で分解する形（コピーはしない）なので、`rest` は同じ領域の
	// 頭を1つ進めた参照であり、`c` はその手前の1要素である。したがって組み直した結果は
	// `{rest.ptr − 幅, rest.len + 1}`——**確保は要らない**。切り出しの逆向きであり、
	// 「作られた器は規則である」という答えの、いちばん小さい形にあたる。
	//
	// 見るのは形だけである（同じ分解の頭と残りが、その順で並んでいるか）。`c` が本体で
	// 書き換えられていたら別の値なので、そこは束縛が動いていないことを確かめる。
	if (COPRODUCT_BUILD_OPS.has(n.name)) {
		const pair = rejoinPair(n, scope);
		if (pair) {
			const off = em.slot;
			if (em.push() === null || em.push() === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			const w = pair.elemSize || 1;
			em.load(SCRATCH[0], pair.restOff, "残りの ptr");
			em.emit(`sub ${SCRATCH[0]}, ${SCRATCH[0]}, #${w}`, `頭を1要素ぶん戻す（${w} byte）`);
			em.store(SCRATCH[0], off * 8, "組み直した ptr（確保は要らない）");
			em.load(SCRATCH[0], pair.restOff + 8, "残りの len");
			em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, #1`, "長さを1つ戻す");
			em.store(SCRATCH[0], (off + 1) * 8, "組み直した len");
			return 2;
		}
	}
	// **フレームから出ない器は、自分のフレームに置ける。**
	//
	// `sub sp` で場所を取って要素を並べるだけ——`$匿名式` と同じ機械である（`alloca`）。
	// 出て行くかどうかは `markEscapes` が先に決めている。出るなら sret が要るので、
	// そこは下で名指しする。
	//
	// 並べるものが全部スカラーの場合だけ出せる。器が混じると要素数が実行時に決まり、
	// 写す側もループになる——それは別の命令列である。
	// フレームから出るなら、書く先は呼び出し側が用意したスロットである（`em.sretDest`）。
	// 置き方は同じ——要素を順に並べて `{ptr, len}` を返す。違うのは**底が誰のものか**
	// だけである。
	const sretHere = n.escapesFrame !== false && em.sretDest !== null && em.sretDest !== undefined;

	// **スロットごとに幅が違う並びは `Struct` である。**
	//
	// `1 , [2 3]` は「数1つ」と「器1つ」の並びで、要素の幅が揃っていない——一様な並び
	// （`List`、`{ptr, len}` の2本）の道には乗らない。だから下の枝は `slotsOfNode === 2`
	// で弾いており、**`Struct` は素通りして「まだ出せない式です（product）」に落ちて
	// いた**。lexer.sn と parser.sn が止まっていたのはここである。
	//
	// 形は `layoutOfStruct` が既に出している（どのスロットが何バイト目か）。**スロットの
	// 分解も同じ関数を使う**——2箇所で同じものを計算すると必ずズレる。
	//
	// **運ぶのは `{ptr}` の1本。** 形が型に入っているので長さを添える必要が無い
	// （stack_abi.md §4.6）——`List` が2本なのと対になる。
	// **積（`,`）の連番スロットだけを見る。** 余積（空白）の `unshift`/`construct` も
	// 同じ `Struct` 型になりうるが、`flattenProduct` は括りの中の余積まで割ってしまう
	// ——`1 [2 3]` が3スロットになり、「`[2 3]` は1要素である」（右辺を1要素として足す、
	// operator_table.md 10.1）が消える。連番スロットの表を引いてよいのは、積として
	// 書かれた形だけである。
	if (n.name === "product" && n.atomType === "Struct" && n.slotKind === "positional" && !sretHere && n.escapesFrame === false) {
		const lay = layoutOfStruct(n, { target: em.conf.target, charset: em.conf.charset, env });
		const slotNodes = productSlotNodes(n);
		if (lay && lay.slots && slotNodes && lay.slots.length === slotNodes.length && slotNodes.length > 1) {
			if (!allocaAllowed(em, n, "Struct を組み立てる")) return false;
			// **先に全スロットを評価する。** 確保してから評価すると、`sp` が動いた後で
			// スロットの番地がずれる。
			const base = em.slot;
			const widths = [];
			for (const part of slotNodes) {
				const w = genExpr(part, env, em, scope);
				if (w === false) return false;
				widths.push(w);
			}
			const bytes = Math.ceil(lay.size / 16) * 16;
			em.emit(`sub sp, sp, #${bytes}`, `${slotNodes.length} スロットの Struct（${lay.size} byte）`);
			em.movedSp = true;
			let at = base;
			for (let k = 0; k < slotNodes.length; k++) {
				if (emitSlotWrite(em, n, lay.slots[k], widths[k], at, "sp", `スロット ${k}（+${lay.slots[k].offset}、${lay.slots[k].size} byte）`) === false) return false;
				at += widths[k];
			}
			em.pop(at - base);
			const po = em.push();
			if (po === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.emit(`mov ${SCRATCH[0]}, sp`, "ptr（Struct は形が型にあるので1本）");
			em.store(SCRATCH[0], po);
			return 1;
		}
	}
	// **名前付きスロットの構造体を実体化する。** 連番（`product`）と同じ置き方だが、場所を
	// 決めるのは宣言順ではなく**名前のソート順**である（stack_abi.md §7.1）。`lay.slots` が
	// その並びで、各スロットの `ordinal` が宣言順の何行目かを指す——**評価は宣言順、格納は
	// 名前順**で、両者を結ぶのが `ordinal` である。ここを取り違えると値が黙って別のスロット
	// へ入るので、連番側と同じくスロット数の照合を先に置く。
	// **「新しい器を作る」マージを実体化する。**
	//
	//     q : [ foo : 99 / p~ ]     ブロック形——書いた行が仕様、撒く行が残りを埋める
	//     q : [ foo : 99 ]~ p~      左がリテラルの余積形——後が勝つ
	//
	// どちらも新しい器なので、置き方は上の名前付きブロックと同じ（名前のソート順、
	// 場所はフレームか sret）。違うのは**スロットの値がどこから来るか**だけで、それは
	// Pass 3 が `slotOrigins` に畳んである——書いた行はその式を評価して入れ、撒いた器は
	// その場所から `ldr`／`str` で写す。**勝ち負けもそこで決まっている**ので、ここで
	// もう一度決め直さない（同じ事実を2箇所で決めない）。
	//
	// 写しは**浅い**。スロットに載っているのは運ぶ姿（入れ子の構造体なら `{ptr}` の
	// 8 byte、器なら `{ptr, len}` の 16 byte）なので、それをそのまま写せば子は共有される
	// ——`~obj` は渡ってきた器そのもので、名前を挙げても器から何も減らない、という
	// 分割代入の側と同じ扱いである。
	if (n.slotOrigins && n.atomType === "Struct" && (sretHere || n.escapesFrame === false)) {
		// **左が名前のマージは上書きであって、新しい器ではない。** `a~ b~` は「a の器へ
		// b の器の中を入れる」形で、結果は a そのものである。だから上書きになるか複写に
		// なるかは**左が何かで決まる**——左が名前なら既に在る器なので上書き、左がその場の
		// リテラルならその器はいま作られたものなので、入れることがそのまま複写になる。
		//
		// 上書きの側を黙って新しい器で出すと、`a` を見ている他の誰かに変更が見えない
		// ——**意味が変わる**。出せないことは名指しする（原理4）。
		// 左が名前なら**在る器へ書く**。確保が要らないので層の門も通る（layer_relations.md
		// §3.3.1）——`#` 出力（`$名前`）が layer 0 で通るのと同じ理由である。
		const inPlace = !Array.isArray(n.lines) && n.mergeBase === "name";
		if (!Array.isArray(n.lines) && n.mergeBase !== "literal" && !inPlace) {
			return em.fail(n, "マージの左が何か決まりません（名前でもその場のリテラルでもない）");
		}
		const sconf = { target: em.conf.target, charset: em.conf.charset, env };
		const lay = layoutOfStruct(n, sconf);
		if (!lay || !lay.slots || !lay.slots.length) return em.fail(n, "構造体の並びが決まりません（新しい器のスロットが引けません）");
		// 名前は綴りではなく中身で引く（layout.js の `bareName` と同じ規則）。
		const origins = new Map();
		for (const [k, o] of n.slotOrigins) origins.set(slotName(k), o);
		for (const sl of lay.slots) if (!origins.has(sl.name)) return em.fail(n, `スロット ${sl.name} の出どころが引けません`);
		// **在る器へ書けるのは、並びが1バイトも変わらないときだけ。** 鍵が増えると名前
		// ソート順で位置が動く——`bar@0 foo@8` に `aa` を足すと `aa@0 bar@8 foo@16` で
		// 既存が全部ずれるので、在る場所には収まらない。そこは定義の側で鍵の和集合ぶんを
		// 取る話（layer_relations.md §3.3.1）であって、ここで場所を作り直す話ではない。
		let baseNode = null;
		let baseShape = null;
		if (inPlace) {
			baseNode = mergeBaseNode(n);
			baseShape = baseNode ? structShapeOf(baseNode, env, sconf) : null;
			if (!baseNode || !baseShape || baseShape.slotKind !== "named") {
				return em.fail(n, "マージの左の器の並びが引けません");
			}
			// **在る器へ書けるのは、並びが1バイトも変わらないときだけ。** 鍵が増える形は
			// Pass 3 が弾いている（型が変わるので——layer_relations.md §3.3.1）ので、ここへは
			// 来ないはずである。来たなら Pass 3 の判定と食い違っているということなので、
			// 黙って別の場所へ書かずに止める。比べるのは名前と位置と幅。
			const place = (ss) => ss.map((x) => x.name + "@" + x.offset + ":" + x.size).join(" ");
			if (place(baseShape.slots) !== place(lay.slots)) {
				return em.fail(n, "マージの左の器と結果の並びが一致しません（鍵が増える形は Pass 3 が弾いているはずです）");
			}
		}
		// **上書きは確保しない。** だから門も通らない——`sub sp` を出さないので layer 0 でも
		// 書ける（在る場所へ書くだけ、が層の要求そのものである）。
		if (!inPlace && !sretHere && !allocaAllowed(em, n, "Struct を組み立てる")) return false;
		// 返値スロットの中では自分の枠を先に取る（下の名前付きブロックと同じ理由）。
		const mOff = !inPlace && sretHere ? em.sretBump || 0 : 0;
		if (!inPlace && sretHere) em.sretBump = mOff + Math.ceil(lay.size / 16) * 16;
		// **先に全部を評価する。** 確保してから評価すると `sp` が動いた後で番地がずれる。
		// 撒く元は**器ごとに一度だけ**評価する——同じ器から何スロット引いても場所は1つで、
		// スロットごとに評価し直すと式なら二度動く。
		const mbase = em.slot;
		const lineAt = new Map(); // スロット名 -> { at, width }
		const srcAt = new Map(); // 撒く元のノード -> { at, shape }
		// 上書きなら左の器が**宛先**である。撒く元としても同じ場所なので、下のループが
		// もう一度評価しないよう先に登録しておく（式なら二度動く）。
		let baseAt = null;
		if (inPlace) {
			baseAt = em.slot;
			const bw = genExpr(baseNode, env, em, scope);
			if (bw === false) return false;
			if (bw !== 1) return em.fail(n, "マージの左の器が ptr 1本で運ばれていません");
			srcAt.set(baseNode, { at: baseAt, shape: baseShape });
		}
		for (const sl of lay.slots) {
			const o = origins.get(sl.name);
			if (o.kind === "line") {
				const at = em.slot;
				const w = genExpr(o.node, env, em, scope);
				if (w === false) return false;
				lineAt.set(sl.name, { at, width: w });
				continue;
			}
			if (srcAt.has(o.node)) continue;
			// 撒く元の並びが引けなければ、どのバイトを写すか決まらない。名前は Pass 3 が
			// 解決したときのスコープで引く（仮引数の並びはそこにしか無い）。
			const oenv = o.env || env;
			const shape = structShapeOf(o.node, oenv, oenv === env ? sconf : { ...sconf, env: oenv });
			if (!shape || shape.slotKind !== "named" || !Array.isArray(shape.slots)) {
				return em.fail(n, "撒く器の並びが引けません（名前付きスロットの構造体だけを撒けます）");
			}
			const at = em.slot;
			const w = genExpr(o.node, env, em, scope);
			if (w === false) return false;
			// 構造体は形が型にあるので `{ptr}` の1本で運ばれる（stack_abi.md §4.6）。
			if (w !== 1) return em.fail(n, "撒く器が ptr 1本で運ばれていません");
			srcAt.set(o.node, { at, shape });
		}
		const MDST = "x11";
		if (inPlace) {
			em.load(MDST, baseAt * 8, "左の器（ここへ入れる）");
		} else if (sretHere) {
			em.load(MDST, em.sretDest, "返値スロット（sret）");
			if (mOff > 0) em.emit(`add ${MDST}, ${MDST}, #${mOff}`, `入れ子ぶん後ろへ（+${mOff}）`);
		} else {
			const mbytes = Math.ceil(lay.size / 16) * 16;
			em.emit(`sub sp, sp, #${mbytes}`, `${lay.slots.length} スロットの Struct（${lay.size} byte、名前順、撒く行を含む）`);
			em.movedSp = true;
			em.emit(`mov ${MDST}, sp`, "組む先");
		}
		for (const sl of lay.slots) {
			const o = origins.get(sl.name);
			// **上書きで、左から来るスロットは書かなくていい。** 宛先が左の器そのものなので、
			// その値は既にそこに在る——同じ場所へ同じ値を写すだけの命令になる。
			if (inPlace && o.kind !== "line" && o.node === baseNode) continue;
			if (o.kind === "line") {
				const v = lineAt.get(sl.name);
				for (let r = 0; r < v.width; r++) {
					em.load(SCRATCH[0], (v.at + r) * 8);
					em.emit(`str ${SCRATCH[0]}, [${MDST}, #${sl.offset + r * 8}]`, r === 0 ? `スロット ${sl.name}（+${sl.offset}、書いた行）` : undefined);
				}
				continue;
			}
			const src = srcAt.get(o.node);
			const ss = src.shape.slots.find((x) => x.name === sl.name);
			if (!ss) return em.fail(n, `撒く器に ${sl.name} がありません`);
			// **幅が合わなければ写せない。** 型が一致していれば合うはずのもので、合わない
			// ときは並びのどちらかが違うものを見ている——黙って詰めると隣を踏む。
			if (ss.size !== sl.size) return em.fail(n, `撒く器の ${sl.name} と幅が合いません（${ss.size} と ${sl.size}）`);
			em.load(SCRATCH[1], src.at * 8, `撒く器の ptr（${sl.name} を写す）`);
			// 読むのも書くのも `slot.size` の幅で。8 byte 固定だと 1 byte のスロットが隣を
			// 踏み、境界を跨いだ書き込みは実機で止まる。
			for (let r = 0; r * 8 < sl.size; r++) {
				const wsz = Math.min(8, sl.size - r * 8);
				em.emit(slotLoadInsn({ ...sl, size: wsz }, SCRATCH[0], SCRATCH[1], ss.offset + r * 8));
				em.emit(slotStoreInsn(wsz, SCRATCH[0], MDST, sl.offset + r * 8), r === 0 ? `スロット ${sl.name}（+${sl.offset}、${sl.size} byte、撒いた器の +${ss.offset} から浅く写す）` : undefined);
			}
		}
		em.pop(em.slot - mbase);
		const mpo = em.push();
		if (mpo === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		em.emit(`mov ${SCRATCH[0]}, ${MDST}`, "ptr（Struct は形が型にあるので1本）");
		em.store(SCRATCH[0], mpo);
		return 1;
	}
	if (isStructBlock(n) && (sretHere || n.escapesFrame === false)) {
		const lines = (n.lines || []).map(unwrap);
		// マージ（`mergedSlots`）の ordinal は Map の反復順であって宣言行を指さないので、
		// 行から値を引くこの手は使えない。決まらないことは言う（原理4）。
		if (n.mergedSlots) return em.fail(n, "マージした構造体はまだ置けません（スロットの並びが宣言行に対応しません）");
		const lay = layoutOfStruct(n, { target: em.conf.target, charset: em.conf.charset, env });

		if (!lay || !lay.slots || lay.slots.length !== lines.length) {
			return em.fail(n, "構造体の並びが決まりません（撒く行を含む形はまだ場所を持てません）");
		}
		// 場所は2通り。フレームから出ないなら自分のフレーム、出るなら呼び出し側が用意した
		// スロット（`em.sretDest`）である——**置き方は同じで、違うのは底が誰のものかだけ**。
		if (!sretHere && !allocaAllowed(em, n, "Struct を組み立てる")) return false;
		// **返値スロットの中では、自分の枠を先に取る。** 取ってからスロットの値を評価する
		// ので、その途中で組まれる入れ子は自分の後ろを取る。ここを取らずに評価すると、
		// 内側も `em.sretDest`（＝親の先頭）を自分の宛先だと読み、**親のスロットを踏んで**
		// ptr として親自身の番地を書く——実測で `str x11, [x8, #0]` の次が `str x0, [x8, #0]`、
		// さらに `str x8, [x8, #8]` になり、解釈器 99 に対し診断ゼロで 1 を返していた。
		const myOff = sretHere ? em.sretBump || 0 : 0;
		if (sretHere) em.sretBump = myOff + Math.ceil(lay.size / 16) * 16;
		// **先に全スロットを評価する。** 確保してから評価すると、`sp` が動いた後でスロットの
		// 番地がずれる（連番側と同じ理由）。
		const sbase = em.slot;
		const at = [];
		const widths = [];
		for (const line of lines) {
			at.push(em.slot);
			const w = genExpr(isDefineNode(line) ? line.right : line, env, em, scope);
			if (w === false) return false;
			widths.push(w);
		}
		const SDST = "x11";
		if (sretHere) {
			em.load(SDST, em.sretDest, "返値スロット（sret）");
			if (myOff > 0) em.emit(`add ${SDST}, ${SDST}, #${myOff}`, `入れ子ぶん後ろへ（+${myOff}）`);
		} else {
			const sbytes = Math.ceil(lay.size / 16) * 16;
			em.emit(`sub sp, sp, #${sbytes}`, `${lines.length} スロットの Struct（${lay.size} byte、名前順）`);
			em.movedSp = true;
			em.emit(`mov ${SDST}, sp`, "組む先");
		}
		for (const sl of lay.slots) {
			const k = sl.ordinal;
			if (!(k >= 0 && k < widths.length)) return em.fail(n, "スロットの宣言順が引けません");
			if (emitSlotWrite(em, n, sl, widths[k], at[k], SDST, `スロット ${sl.name}（+${sl.offset}、${sl.size} byte）`) === false) return false;
		}
		em.pop(em.slot - sbase);
		const spo = em.push();
		if (spo === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		em.emit(`mov ${SCRATCH[0]}, ${SDST}`, "ptr（Struct は形が型にあるので1本）");
		em.store(SCRATCH[0], spo);
		return 1;
	}
	if (COPRODUCT_BUILD_OPS.has(n.name) && (n.escapesFrame === false || sretHere) && slotsOfNode(n, em.conf, env) === 2) {
		// **括弧の中が連接なら剥いではいけない。** `a (b c) d` は `[a, "bc", d]` であり、
		// 括弧が「ここまでで1つの要素」と言っている（余積は右辺を1要素として足す）。
		// 剥ぐと要素数が変わる——実際 `((c (rest'0)) (rest'1)) ' 2` が `__` ではなく
		// 3番目を返していた。優先順位のための括弧（中が連接でないもの）だけを剥ぐ。
		const peel = (x) => peelGroup(x, n.elementType === "Char");
		// **結合の向きに依存しない歩き方をする。** 片方へ降りる while ループは「左結合で
		// 積まれている」を前提にしており、`,` を仕様どおり右結合にした瞬間に、連鎖の残りが
		// 「器が1つ」に見えて「要素数が実行時に決まる」へ落ちていた。左右とも再帰で開く。
		//
		// **開いてよい側は演算が決める。** 解釈器は2つの問いを分けている——「この位置は
		// **組み立ての途中**か」（構文、`isAccumulator`）と「書き手が**撒け**と言ったか」
		// （値、後置 `~`）。ここは前者にあたる。
		//
		// 余積（空白・`+`）は左結合なので、左が余積なら**それが組み立て中の器**であり
		// 開く。右は開かない。積（`,`）は右結合なので逆で、**左は常に1要素**、右は
		// 連鎖（`,` が続く）のときだけ開く（`interpreter.js` の `isAccumulator` と
		// `isChain`）。
		//
		// ここが左右とも無条件に開いていたので、`1 2 , 9~` が `[[1,2], 9]`（長さ2）では
		// なく `[1, 2, 9]`（長さ3）になっていた——**7149efc が捨てた「左辺は常に撒く」が、
		// 機械の側では木の歩き方として残っていた**。
		const parts = [];
		const isCoprod = (x, names) => {
			const u = peel(x);
			return u && u.type === "operation" && names.has(u.name) ? u : null;
		};
		const walkParts = (u) => {
			const openL = u.name === "product" ? null : isCoprod(u.left, COPRODUCT_ACC_OPS);
			const openR = u.name === "product" ? isCoprod(u.right, PRODUCT_OPS) : isCoprod(u.right, COPRODUCT_BUILD_OPS);
			if (openL) walkParts(openL);
			else parts.push(peel(u.left));
			if (openR) walkParts(openR);
			else parts.push(peel(u.right));
		};
		walkParts(n);
		// **構築は `__` を落とす。** `1 __ 3` は `[1 3]` である（operator_table.md の
		// 構築行、Unit は単位元）。ここで落とさないと `||1 __ 3||` が 3 を返し、解釈器の
		// 2 と食い違う——**診断も出ず、長さだけが違う**。
		//
		// 落とせるのは**書いた時点で `__` と分かる要素だけ**である。実行時に `__` に
		// なる要素（選択写像の落ちた要素）は、長さが実行時に決まる器が要るので別の話に
		// なる——そこはまだ食い違ったままで、`compile.js` の写像の展開が比較を避けて
		// いるのはそのためである。
		for (let k = parts.length - 1; k >= 0; k--) {
			if (isUnitAtom(peel(parts[k]))) parts.splice(k, 1);
		}
		const et = n.elementType || (n.atomType === "String" ? "Char" : null);
		const em1 = elementCellSize(et, em.conf);
		// **部分ごとに「1要素ぶんの幅」を見る。** 撒けば相手の**要素**が、撒かなければ
		// 相手**そのもの**が1要素になる。どちらも置き場所の幅（`w`）と揃っていなければ、
		// 診断も出ないまま別の値が返る——生の番地が要素として出たり、`{ptr, len}` の
		// 片割れだけが読まれたりする。
		const atomOfPart = (p) => {
			const q = stripExpand(p);
			return q ? q.atomType : undefined;
		};
		// **名前は要素型を持ち歩かないが、束縛は知っている。**
		//
		// `f : l m ? … m~` の `<m>` に載っているのは器の型（`List`）だけで、要素型は
		// 束縛の側にある（`pass3.js` の `containerElementType` がそこを引いている）。
		// 注釈として節点へ載せると**関数の署名にも出る**ので、そちらへは書けない
		// ——呼び出しサイトで決まった要素型を署名に書くと、`.st` が多相の関数に
		// 「`List(Int)` を返す」と言い張ることになる（`st.test.js`「呼び出し側から決まる」）。
		// ここは命令を出す場で、いま目の前の呼び出しに対する幅を知りたいだけなので、
		// 束縛を直に引く。
		const elemTypeOfPart = (q) => {
			if (q.elementType) return q.elementType;
			if (q.atomType === "String") return "Char";
			if (q.type === "atom" && q.kind === "identifier" && env) {
				const b = envLookup(env, q.value);
				if (b && b.elementType) return b.elementType;
			}
			return null;
		};
		const cellOfPart = (p) => {
			const q = stripExpand(p);
			if (!q) return null;
			return elementCellSize(elemTypeOfPart(q), em.conf);
		};
		// **文字列に並べられるのは文字と文字列だけである。**
		//
		// 解釈器の側は `stringifyForConcat` が数を綴りへ直すので、`` `abc` 9 `` は "abc9"
		// ——4文字目は `'9'`（符号位置 57）である。機械はその道を持っていないので、
		// `storeElem` が 1 byte を書くだけで**値 9 のバイト**が並んでいた。長さは合うので
		// **長さだけ見ている検査は全部素通りする**。
		//
		// これは「まだ出していない射」であって型の誤りではない（原理4 の区分表の2行目）。
		// だから `__` へ収束させるのではなく、名指しで断る。
		//
		// **`Unit` は数えない。** 余積の単位元なので、実行時に `__` になった要素は置かずに
		// 飛ばすだけである（`emitUnitSkip`）——静的に `__` と分かるぶんは既に上で落として
		// あり、ここへ来るのは「落ちるかもしれない呼び出し」である。
		if (em1 && em1.size && n.atomType === "String") {
			for (const p of parts) {
				const a = atomOfPart(p);
				if (a === "Char" || a === "String" || a === "Unit") continue;
				// **層の禁止が先に立つ。** `Float` は layer 2 以上、`Vector` は layer 3 以上と
				// `option_ms_schema.md` §4 が定めている。段が足りないなら**設計上の結論**であって
				// 「まだ」ではない（上の `literalBits` の門が同じ区別を持っている）。ここで先に
				// 「綴りへ直す道が無い」と断ると、**直す当てのある言い分（段を上げろ）が、当ての
				// 無い言い分に置き換わる**。だから段で止まるものは譲って、下の門に言わせる。
				const need = a === "Vector" ? 3 : a === "Float" ? 2 : 0;
				if (need && em.conf.layer !== undefined && em.conf.layer < need) continue;
				return em.fail(
					n,
					`器の構築はまだ出せません（String——文字列に並べられるのは文字と文字列だけです。` +
						`${a || "型の分からない値"} を綴りへ直す道（10進の文字列にする）はまだ出していません）`
				);
			}
		}
		// **末尾が器を返す呼び出しなら、そこへ追記する。**
		//
		// `(s ' 0) (f (s ' 1~))` は「要素 ＋ 再帰の結果」であり、後者は器なので「並べる
		// のは1本の値」の道には乗らない。だが写す必要は無い——**呼ばれた側に、自分の器の
		// 続きを直接書かせればよい**。先頭 k 個を書いてから `宛先 + k×幅` を次の宛先として
		// 渡す。段が深くなっても同じ領域の中でカーソルが進むだけで、確保も複写も起きない。
		//
		// 上界は呼ぶ側が確保している（`returnSizeBound` の `konst + Σ coef×||器|| + Σ coef×μ||器||`）。
		// **ただしそれは見積もりであって証明ではない。** だから書く前に照合し、外れたら `__` へ
		// 落ちる（`emitSretCapacityNeed` / `emitSretCapacityGuard`）。**呼び先の取り分は k 個ぶん
		// 狭い**ので、そのぶん引いた残りを x15 で渡す——どこで割れているかは呼ぶ側の情報で、
		// 呼ばれた側は自分の仮引数からは復元できない（仮引数は段が下がっても同じままである）。
		// 長らくここには照合が無く、添字で回る再帰が `__` ではなくスタックを踏んでいた
		// （実測：上界3に対し41要素書いて qemu が止まった）。
		//
		// **器は末尾にしか来られない。** 途中に置くと、その長さが決まるまで後ろを書けない
		// ——1回の走査で書くにはそこが条件である。
		//
		// 相手の後置 `~` はここで剥がす（`stripExpand`）。列の μ は任意なので写像は
		// `(…) (m rest)~` と書くしかないが、追記の位置では平らに書かれるので命令は要らない。
		//
		// **器は末尾でなくてもよい。** 一度は「途中に置くとその長さが決まるまで後ろを
		// 書けない」と諦めていたが、決まらないのは**静的に**であって、呼び先は自分が書いた
		// 個数を `len` で返す。後ろの要素はそれを足した位置へ書けばよい——1回の走査で
		// 書き切るという条件はそのまま満たされる。
		//
		// `gap : st d ? … (closers st d) newline` がこの形で、器が先頭・スカラーが後ろに
		// 来る。器が2つ以上あると和が要るので、そこはまだ扱わない。
		const contIdx = parts.findIndex((p) => sretHere && appendableCallee(stripExpand(p), em));
		const lead = contIdx < 0 ? parts.slice(0, -1) : parts.slice(0, contIdx);
		const trail = contIdx < 0 ? [] : parts.slice(contIdx + 1);
		const tailPart = contIdx >= 0 ? stripExpand(parts[contIdx]) : parts.length > 1 ? stripExpand(parts[parts.length - 1]) : null;
		const appendTo = tailPart && sretHere ? appendableCallee(tailPart, em) : null;
		const oneScalar = (p) => slotsOfNode(p, em.conf, env) === 1;
		// **持ち上げの代金は、ここでも払えない。** 要素が参照で運ばれる器（`List(String)`、
		// 1要素 16 byte）へスカラーを1つ置くと、`{ptr, len}` の ptr 半分だけが書かれて
		// len は前の値のまま残る——**診断ゼロで生番地や 0 が返る**。下の走査の枝は同じ形を
		// ちゃんと断っているのに、追記の枝だけが素通りしていた（同じ判定が2箇所にあって
		// 片方だけ狭い、いつもの壊れ方である）。断れば下の枝へ落ち、そこが理由を言う。
		//
		// `emitLiftToContainer` は在るが、あれは `sub sp` で場所を取る——**再帰の中で
		// 使うと、返った後の枠を指した器を返すことになる**。だから追記の道では使えない。
		// 代金を払わずに済むのはスライス（`{ptr + i×幅, 1}`）の道だけである（原理8）。
		// 要素が参照で運ばれる器（1要素 16 byte）へスカラーを置くと、`{ptr, len}` の ptr 半分
		// だけが書かれて len は前の値のまま残る——**診断ゼロで生番地や 0 が返る**。走査の枝は
		// 同じ形をちゃんと断っているのに、追記の枝だけが素通りしていた。
		//
		// 断るのではなく**払わずに済む道**を通す：積むものが `A ' i` なら、その1つは元の器の
		// 中に在るので `{A.ptr + i×幅, 1}` がそのまま長さ1の器である（`emitSliceLift`）。
		const per = em1 && em1.size === 16 ? 2 : 1;
		const pushElem = (p) => {
			if (per === 1) return genScalar(p, env, em, scope, "追記に並べる要素はレジスタ1本の値です");
			const r = emitSliceLift(em, p, env, scope);
			if (r === false) return false;
			if (r === null) {
				// 元の器の中に居ない値（計算で作った1文字など）は、置く場所そのものが無い。
				// `sub sp` で取ると再帰から返った後の枠を指すので、そこは断るのが正しい。
				return em.fail(
					n,
					`器の構築はまだ出せません（${n.atomType}——要素が参照で運ばれる器へ積めるスカラーは ` +
						"元の器の中に居るもの（`A ' i`）だけです。それ以外は `{ptr, len}` を置く場所が要ります）"
				);
			}
			return 2;
		};
		if (em1 && em1.size && appendTo && lead.every(oneScalar) && trail.every(oneScalar) && !trail.some((p) => appendableCallee(stripExpand(p), em))) {
			const base = em.slot;
			for (const p of lead) {
				if (pushElem(p) === false) return false;
			}
			const k = (em.slot - base) / per;
			const w = em1.size;
			const wShift = w === 16 ? 4 : w === 8 ? 3 : w === 4 ? 2 : w === 2 ? 1 : 0;
			// **実行時に `__` になる先頭が居るなら、置いた個数も実行時である。**
			// 静的なオフセットでは `__` の跡が1つぶん空いたままになり、長さだけが伸びる。
			const dynK = lead.some((p) => !cannotBeUnit(p, env, scope));
			// 個数が実行時に決まるなら、その置き場所。静的なら null（今まで通り即値）。
			let kSlot = null;
			em.load(SCRATCH[1], em.sretDest, "返値スロット（sret）");
			// **先頭のぶんも書く前に照合する。** 個数は静的なので、いちばん後ろの1つだけ
			// 見れば足りる（前が入らないなら後ろも入らない）。`__` を落とすと実際に書く数は
			// これより減りうるが、**上界のままでよい**——確保の見積もりも同じ数で取っている。
			emitSretCapacityNeed(em, k);
			if (dynK) em.emit("mov x13, #0", "先頭で書けた個数（バイト）");
			for (let i = 0; i < k; i++) {
				if (per === 2) {
					if (!dynK) {
						em.load(SCRATCH[0], (base + i * 2) * 8);
						em.emit(`str ${SCRATCH[0]}, [${SCRATCH[1]}, #${i * 16}]`, i === 0 ? "先頭を並べる（要素の ptr）" : undefined);
						em.load(SCRATCH[0], (base + i * 2 + 1) * 8);
						em.emit(`str ${SCRATCH[0]}, [${SCRATCH[1]}, #${i * 16 + 8}]`, i === 0 ? "その len" : undefined);
						continue;
					}
					em.load(SCRATCH[0], (base + i * 2 + 1) * 8);
					const skip2 = emitUnitSkip(em, lead[i], env, scope, SCRATCH[0], "len");
					em.emit(`add x11, ${SCRATCH[1]}, x13`, i === 0 ? "書けた位置へ" : undefined);
					em.emit(`str ${SCRATCH[0]}, [x11, #8]`, i === 0 ? "その len" : undefined);
					em.load(SCRATCH[0], (base + i * 2) * 8);
					em.emit(`str ${SCRATCH[0]}, [x11]`, i === 0 ? "先頭を並べる（要素の ptr）" : undefined);
					em.emit("add x13, x13, #16", i === 0 ? "書けたぶんだけ進む" : undefined);
					if (skip2) em.label(skip2);
					continue;
				}
				em.load(SCRATCH[0], (base + i) * 8);
				if (!dynK) {
					em.emit(storeElem(SCRATCH[0], SCRATCH[1], i * w, w), i === 0 ? "先頭を並べる" : undefined);
					continue;
				}
				const skip1 = emitUnitSkip(em, lead[i], env, scope, SCRATCH[0], "scalar");
				em.emit(storeElem(SCRATCH[0], SCRATCH[1], null, w, "x13"), i === 0 ? "先頭を並べる" : undefined);
				em.emit(`add x13, x13, #${w}`, i === 0 ? "書けたぶんだけ進む" : undefined);
				if (skip1) em.label(skip1);
			}
			em.pop(k * per);
			if (dynK) {
				kSlot = em.push();
				if (kSlot === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
				if (wShift) em.emit(`lsr x13, x13, #${wShift}`, `バイトから個数へ（1要素 ${w} byte）`);
				em.store("x13", kSlot, "先頭で置いた個数（実行時）");
			}
			// **自分自身への追記はループになる。**
			//
			// 追記は器の**続き**を書くので、段が下がるたびに宛先だけが進む。ならば段を下げず
			// に宛先だけ進めれば同じことである——呼び出しの後に残るのが「定数 k を足す」
			// だけだから成り立つ（蓄積子）。clang が `1 + f(…)` をループへ均すのと同じ変換で、
			// Sign には既に自己末尾再帰の `b .Lloop` がある。**機械は在って、繋がっていなかった。**
			//
			// **飛ぶかどうかは自分で判定しない。** 末尾にできるかは呼び出しの側が引数を出して
			// から決める（`argCarries`——フレームに取った場所への参照が渡るか）。ここで同じ
			// 判定を書き直すと**2箇所が食い違う**ので、実際に出させて、飛んだかどうかを見る。
			// 飛ばなければ出したものを捨てて、従来の追記の道をやり直す。
			if (scope && tail && trail.length === 0 && appendTo === scope.selfLabel && em.sretTotal !== null && em.sretTotal !== undefined) {
				const lineMark = em.lines.length;
				const slotMark = em.slot;
				const diagMark = em.diagnostics.length;
				const spWas = em.movedSp;
				const tw0 = genExpr(tailPart, env, em, scope, true);
				const jumped = tw0 === TAIL && em.lines.slice(lineMark).some((l) => l.includes(`b ${scope.loopLabel}`));
				if (jumped) {
					// カーソルと合計を進める命令は、飛ぶ手前——つまり引数を積む前——へ差し込む。
					// どちらもスロットしか触らないので、引数の組み立てとは干渉しない。
					const before = em.lines.length;
					// **進む量は「置いた数」であって「並べた数」ではない。** `__` を落とすと
					// 両者は食い違うので、実行時の個数を読んで進める（周ごとに書き直される）。
					if (kSlot !== null) {
						em.load(SCRATCH[0], kSlot, "この周で置いた個数");
						em.load(SCRATCH[1], em.sretDest);
						em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, ${SCRATCH[0]}${wShift ? `, lsl #${wShift}` : ""}`, "置いたぶんカーソルを進める");
						em.store(SCRATCH[1], em.sretDest, "次の周はここから書く");
						em.load(SCRATCH[1], em.sretTotal);
						em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, ${SCRATCH[0]}`, "置いたぶんを足す");
						em.store(SCRATCH[1], em.sretTotal, "周を跨ぐ合計");
						// **残りも同じだけ狭くする。**（下の静的な枝と同じ理由）
						em.load(SCRATCH[1], em.sretLimit);
						em.emit(`sub ${SCRATCH[1]}, ${SCRATCH[1]}, ${SCRATCH[0]}`, "置いたぶん狭い");
						em.store(SCRATCH[1], em.sretLimit, "次の周の残り");
					} else {
						em.load(SCRATCH[1], em.sretDest);
						if (k * w) em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, #${k * w}`, `${k} 要素ぶんカーソルを進める`);
						em.store(SCRATCH[1], em.sretDest, "次の周はここから書く");
						em.load(SCRATCH[0], em.sretTotal);
						if (k) em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, #${k}`, `書いた ${k} を足す`);
						em.store(SCRATCH[0], em.sretTotal, "周を跨ぐ合計");
						// **残りも同じだけ狭くする。** そうすれば照合は今まで通り「この周の位置 vs 残り」
						// で済み、位置に合計を足す必要が無い——足すと**もう1本レジスタが要る**ことに
						// なり、写す枝が持っている値（x14 に読んだ1文字）を潰していた。
						em.load(SCRATCH[0], em.sretLimit);
						if (k) em.emit(`sub ${SCRATCH[0]}, ${SCRATCH[0]}, #${k}`, `置いた ${k} ぶん狭い`);
						em.store(SCRATCH[0], em.sretLimit, "次の周の残り");
					}
					em.lines.splice(lineMark, 0, ...em.lines.splice(before, em.lines.length - before));
					if (kSlot !== null) em.pop(1); // 先頭で置いた個数
					em.sretLooped = true;
					return TAIL;
				}
				em.lines.length = lineMark;
				em.slot = slotMark;
				em.diagnostics.length = diagMark;
				em.movedSp = spWas;
			}
			// 続きの宛先はスロットへ置く。引数を作る途中で `bl` が挟まればレジスタは壊れる。
			const destSlot = em.push();
			if (destSlot === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.load(SCRATCH[1], em.sretDest);
			if (kSlot !== null) {
				em.load(SCRATCH[0], kSlot, "先頭で置いた個数");
				em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, ${SCRATCH[0]}${wShift ? `, lsl #${wShift}` : ""}`, "置いたぶん進める");
			} else if (k * w) em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, #${k * w}`, `${k} 要素ぶん進める`);
			em.store(SCRATCH[1], destSlot, "続きを書く場所");
			tailPart._sretInto = destSlot;
			// **呼び先の取り分は k 個ぶん狭い。** 器を割ったのはこちらなので、割れ目を伝える
			// のもこちらである（genExpr の apply 分岐が x15 を組み立てる）。`__` を落とすと
			// 割れ目は実行時にしか分からないので、そのときは個数の入ったスロットを渡す。
			if (kSlot !== null) tailPart._sretAdvanceSlot = kSlot;
			else tailPart._sretAdvance = k;
			const tw = genExpr(tailPart, env, em, scope);
			tailPart._sretInto = undefined;
			tailPart._sretAdvance = undefined;
			tailPart._sretAdvanceSlot = undefined;
			if (tw === false) return false;
			if (tw !== 2) {
				em.pop(tw === TAIL ? 0 : tw);
				return em.fail(n, `追記の相手が器ではありません（${tw} 本）`);
			}
			// 長さは「自分が書いた数 ＋ 続きが書いた数」。ptr は自分の宛先のままである。
			em.load(SCRATCH[0], (em.slot - 1) * 8, "続きの len");
			if (kSlot !== null) {
				em.load(SCRATCH[1], kSlot, "先頭で置いた個数");
				em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}`, "先頭のぶんを足す");
			} else if (k) em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, #${k}`, `先頭の ${k} を足す`);
			em.pop(2);
			em.pop(1); // 続きの宛先
			if (kSlot !== null) em.pop(1); // 先頭で置いた個数
			// **後ろの要素は、書かれた個数を足した位置へ置く。** 呼び先が何個書いたかは
			// `len` で返ってきているので、静的に決まらないだけで実行時には決まっている。
			if (trail.length > 0) {
				const cnt = em.push();
				if (cnt === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
				em.store(SCRATCH[0], cnt, "ここまでに書いた個数");
				const tbase = em.slot;
				for (const p of trail) {
					if (pushElem(p) === false) return false;
				}
				const t = (em.slot - tbase) / per;
				em.load(SCRATCH[1], em.sretDest, "返値スロット（sret）");
				em.load(SCRATCH[0], cnt);
				// **後ろのぶんも書く前に照合する。** 位置は実行時（呼び先が書いた個数）に
				// 決まるので、いちばん後ろを計算して見る。
				if (t > 0) {
					em.emit(`add x14, ${SCRATCH[0]}, #${t - 1}`, "後ろで書く最後の位置");
					emitSretCapacityGuard(em, "x14");
				}
				const shift = w === 16 ? 4 : w === 8 ? 3 : w === 4 ? 2 : w === 2 ? 1 : 0;
				if (shift) em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, ${SCRATCH[0]}, lsl #${shift}`, "書かれた個数ぶん進める");
				else em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, ${SCRATCH[0]}`, "書かれた個数ぶん進める");
				// 後ろにも `__` になり得るものが混ざるなら、位置はカーソルで決める。
				const dynT = trail.some((p) => !cannotBeUnit(p, env, scope));
				if (dynT) em.emit("mov x13, #0", "後ろで書けた個数（バイト）");
				for (let i = 0; i < t; i++) {
					if (per === 2) {
						if (!dynT) {
							em.load("x14", (tbase + i * 2) * 8);
							em.emit(`str x14, [${SCRATCH[1]}, #${i * 16}]`, i === 0 ? "後ろを並べる（要素の ptr）" : undefined);
							em.load("x14", (tbase + i * 2 + 1) * 8);
							em.emit(`str x14, [${SCRATCH[1]}, #${i * 16 + 8}]`, i === 0 ? "その len" : undefined);
							continue;
						}
						em.load("x14", (tbase + i * 2 + 1) * 8);
						const skipT2 = emitUnitSkip(em, trail[i], env, scope, "x14", "len");
						em.emit(`add x11, ${SCRATCH[1]}, x13`, i === 0 ? "書けた位置へ" : undefined);
						em.emit(`str x14, [x11, #8]`, i === 0 ? "その len" : undefined);
						em.load("x14", (tbase + i * 2) * 8);
						em.emit(`str x14, [x11]`, i === 0 ? "後ろを並べる（要素の ptr）" : undefined);
						em.emit("add x13, x13, #16", i === 0 ? "書けたぶんだけ進む" : undefined);
						if (skipT2) em.label(skipT2);
						continue;
					}
					em.load("x14", (tbase + i) * 8);
					if (!dynT) {
						em.emit(storeElem("x14", SCRATCH[1], i * w, w), i === 0 ? "後ろを並べる" : undefined);
						continue;
					}
					const skipT1 = emitUnitSkip(em, trail[i], env, scope, "x14", "scalar");
					em.emit(storeElem("x14", SCRATCH[1], null, w, "x13"), i === 0 ? "後ろを並べる" : undefined);
					em.emit(`add x13, x13, #${w}`, i === 0 ? "書けたぶんだけ進む" : undefined);
					if (skipT1) em.label(skipT1);
				}
				em.pop(t * per);
				em.load(SCRATCH[0], cnt);
				if (dynT) {
					if (shift) em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, x13, lsr #${shift}`, "後ろに置いたぶんを足す");
					else em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, x13`, "後ろに置いたぶんを足す");
				} else em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, #${t}`, `後ろの ${t} を足す`);
				em.pop(1);
			}
			const [po2, lo2] = pushPair(em);
			if (lo2 === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.store(SCRATCH[0], lo2, "len");
			em.load(SCRATCH[1], em.sretDest);
			em.store(SCRATCH[1], po2, "ptr は自分の宛先");
			return 2;
		}
		// **撒いた器は写す。**
		//
		// `push : [~st] d ? d st~` は「値1つ ＋ 器の中身」であり、器の方は**呼び先が書いて
		// くれるわけではない**——既に在る要素を自分の返値スロットへ運ぶしかない。追記
		// （`(s ' 0) (f rest)`）が写さずに済むのは、続きを書くのが呼び先だからで、値として
		// 手元に在る器はそこが違う。
		//
		// 個数は実行時に決まるので走査する。上界は呼ぶ側が確保している
		// （`returnSizeBound` が撒いた仮引数を `coef` として数えている）——ただし見積もりなので、
		// 写す枝では書く前に照合する（`emitSretCapacityGuard`）。
		//
		// 位置は「ここまでに書いた個数」で決まる。スカラーは1つ、器は自分の `len` ぶん
		// 進める——前に来ようが後ろに来ようが同じ規則で、順に置くだけである。
		//
		// **層は先に見る。** `layer: 0` には記憶を確保する手段が無い、というのは設計上の
		// 結論であって実装の穴ではない（下の判定と同じ線）。sret は呼ぶ側が場所を用意する
		// ので確保には当たらないが、その規約自体が layer 1 以上の話である。
		const widths = parts.map((p) => slotsOfNode(p, em.conf, env));
		const layerOk = !(em.conf.layer !== undefined && em.conf.layer < 1);
		if (layerOk && em1 && em1.size && sretHere && widths.some((w) => w === 2) && widths.every((w) => w === 1 || w === 2)) {
			const w = em1.size;
			const shift = w === 8 ? 3 : w === 4 ? 2 : w === 2 ? 1 : 0;
			const cnt = em.push();
			if (cnt === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.emit(`mov ${SCRATCH[0]}, #0`, "ここまでに書いた個数");
			em.store(SCRATCH[0], cnt);
			for (let i = 0; i < parts.length; i++) {
				if (widths[i] === 1) {
					// **持ち上げの代金は、まだ払えない。** 要素が参照で運ばれる器（`List(String)`）に
					// スカラーを1つ積むには、その値を `{ptr, len}` にしなければならない——型の上では
					// 無償でも、表現では有償である（原理8）。`s ` i` のように元の器の中に居るものは
					// スライス `{ptr + i×幅, 1}` で済む（確保が要らない）が、そこはまだ出していない。
					// **黙って幅の合わない値を置くよりは断る。**
					if (w === 16) {
						return em.fail(
							n,
							`器の構築はまだ出せません（${n.atomType}——要素が参照で運ばれる器へスカラーを積むには ` +
								"`{ptr, len}` へ持ち上げる必要がある。原理8 の表現の代金が未実装）"
						);
					}
					const pw = genScalar(parts[i], env, em, scope, "並べる要素はレジスタ1本の値です");
					if (pw === false) return false;
					em.load("x14", (em.slot - 1) * 8, "置く値");
					em.pop(1);
					// **niche は幅で消える。** `storeElem` は `String` なら `strb` を出すので、
					// `__` の下位バイト（0）だけが並んで**長さ1の NUL** になっていた。見るのは
					// 幅を切る前の 64 ビットである。
					const skipA = emitUnitSkip(em, parts[i], env, scope, "x14", "scalar");
					em.load(SCRATCH[1], em.sretDest, "返値スロット（sret）");
					em.load(SCRATCH[0], cnt);
					if (shift) em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, ${SCRATCH[0]}, lsl #${shift}`, "書いた個数ぶん進める");
					else em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, ${SCRATCH[0]}`, "書いた個数ぶん進める");
					emitSretCapacityGuard(em, SCRATCH[0]);
					em.emit(storeElem("x14", SCRATCH[1], 0, w), `${w} byte を1つ`);
					em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, #1`, "1つぶん進む");
					em.store(SCRATCH[0], cnt);
					if (skipA) em.label(skipA);
					continue;
				}
				// 撒いているか（後置 `~`）。剥がす前に見ておく。
				const spreadHere = (() => {
					const u = unwrap(parts[i]);
					return !!(u && u.type === "operation" && u.position === "postfix" && u.name === "expand");
				})();
				// **器が2つ以上あっても、順に書かせればよい。**
				//
				// ここは長らく「作らせてから写す」だけだった。作らせるとは呼び先が `sub sp` で
				// 自分のスロットを取ることで、その大きさは `μ||ts|| + 6×||ts||` ——つまり O(n)。
				// `out_one` は器を返す呼び出しを**2つ**持つので段ごとに 2 つ取り、段が O(n) ある
				// ので**空間が O(n²)** になっていた（実測：83 語まで通り、85 語でスタックを
				// 踏み抜く。時間は語数によらず一定なので、遅いのではなく回っている）。
				//
				// 追記の道は「末尾の器1つ」しか見ていなかったが、位置が実行時に決まるだけで
				// 話は同じである——**いま書いた個数のぶん進めた場所**を宛先として渡し、残りも
				// そのぶん狭めて渡す。呼び先はそこへ直に書き、こちらは返ってきた個数を足す。
				// 写しも確保も消える。
				//
				// 幅が違う器は混ぜられない（呼び先の要素幅が自分と同じときだけ）。1要素として
				// 置く形（`w === 16` で撒いていない）も別の話で、そちらは要素を1つ書くだけである。
				const appendHere = (() => {
					if (w === 16 && !spreadHere) return null;
					const nm = appendableCallee(parts[i], em);
					if (!nm) return null;
					const e = em.sretPlan && em.sretPlan.get(nm);
					return e && e.width === w ? stripExpand(parts[i]) : null;
				})();
				if (appendHere) {
					const destSlot = em.push();
					if (destSlot === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
					// **この枝の `shift` は 16 を答えない。** 写す側は 16 のとき `lsl #4` を直に
					// 書いているので、共有の `shift` には 16 の場合が無い（0 になる）。それを
					// そのまま使うと宛先が `底 + 個数` バイトになり、**16 分の1の位置**を指す。
					const sh = w === 16 ? 4 : shift;
					em.load(SCRATCH[1], em.sretDest, "返値スロット（sret）");
					em.load(SCRATCH[0], cnt);
					if (sh) em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, ${SCRATCH[0]}, lsl #${sh}`, "書いた個数ぶん進める");
					else em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, ${SCRATCH[0]}`, "書いた個数ぶん進める");
					em.store(SCRATCH[1], destSlot, "続きを書く場所");
					appendHere._sretInto = destSlot;
					appendHere._sretAdvanceSlot = cnt;
					const aw = genExpr(appendHere, env, em, scope);
					appendHere._sretInto = undefined;
					appendHere._sretAdvanceSlot = undefined;
					if (aw === false) return false;
					if (aw !== 2) {
						em.pop(aw === TAIL ? 0 : aw);
						return em.fail(n, `並べる器が ${aw} 本です`);
					}
					em.load(SCRATCH[1], (em.slot - 1) * 8, "呼び先が書いた個数");
					em.load(SCRATCH[0], cnt);
					em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}`, "書いた個数を足す");
					em.store(SCRATCH[0], cnt);
					em.pop(2);
					em.pop(1);
					continue;
				}
				// **要素を番地で置くなら、指す先も呼び手のスロットの中へ書かせる。**
				//
				// 呼び先に自分の枠を取らせると、返るときの `mov sp, x29` が捨てた所を器が指す。
				// 記述子の並びの後ろに置いた中身の置き場（`emitContentArena`）の「次に書く場所」
				// を宛先として渡し、返ってきた長さぶん継ぎ足す。
				//
				// **値の並びを返す呼び先だけ**（`e.width === 1`）。入れ子の器はその中身にもまた
				// 置き場が要るので、そちらは下の門が断る。
				let arenaSlot = null;
				if (w === 16 && !spreadHere) {
					const srcNode = stripExpand(parts[i]);
					const nm = appendableCallee(srcNode, em);
					const e = nm && em.sretPlan ? em.sretPlan.get(nm) : null;
					if (e && e.width === 1) {
						const aSlot = em.push();
						const cSlot = em.push();
						const rSlot = em.push();
						if (aSlot === null || cSlot === null || rSlot === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
						if (emitContentArena(em, SCRATCH[0])) {
							em.store(SCRATCH[0], aSlot, "中身の置き場の頭");
							em.emit(`ldr ${SCRATCH[1]}, [${SCRATCH[0]}]`, "次に書く場所");
							em.store(SCRATCH[1], cSlot);
							em.emit(`ldr ${SCRATCH[0]}, [${SCRATCH[0]}, #8]`, "置き場の終わり");
							em.emit(`sub ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}`, "残り（バイト）");
							em.store(SCRATCH[0], rSlot);
							srcNode._sretContentInto = cSlot;
							srcNode._sretContentRoom = rSlot;
							arenaSlot = aSlot;
						} else em.pop(3);
					}
				}
				const cw = genExpr(stripExpand(parts[i]), env, em, scope);
				if (arenaSlot !== null) {
					const srcNode = stripExpand(parts[i]);
					srcNode._sretContentInto = undefined;
					srcNode._sretContentRoom = undefined;
				}
				if (cw === false) return false;
				if (cw !== 2) {
					em.pop(cw === TAIL ? 0 : cw);
					return em.fail(n, `並べる器が ${cw} 本です`);
				}
				const so = (em.slot - 2) * 8;
				// **撒いていない器は1要素である。** `a , b~` は「a を1つ置いて、b の要素を並べる」
				// であり、`~` の有無がその境目である。ここで `stripExpand` を無条件に掛けていたので、
				// 左辺の `take_while` の結果まで要素ごとに写していた——`words `ab`` が語数 1 では
				// なく文字数 2 を返したのはこれである。**型は通るのに数が違う**形だった。
				// **同じ規則が片方の枝にしか無かった。** 上の一文は「撒いていない器は1要素で
				// ある」と言っているのに、それを実装した枝が `w === 16`（要素が参照で運ばれる
				// 器）でしか立っていない。要素が `Int`/`Char` のときはこの門を素通りして下の
				// 写しループへ落ち、`~` を一度も見ずに**相手の要素を全部写す**——`f : l ? l 9`
				// が `[[5,6,7], 9]`（長さ 2）ではなく `[5,6,7,9]`（長さ 4）を返していたのは
				// これである。**診断は出ない。長さだけが違う。**
				//
				// 要素の幅が 16 未満の器に器を1つ置くには、その `{ptr, len}` を要素の幅へ
				// 収めなければならない——入れ子の器は未実装なので、**黙って撒くよりは断る**
				// （原理4 の区分表「ターゲットに存在しない → 停止（命令を出せない）」）。
				//
				// 文字列の中の文字列だけは除く。**`String` の μ は強制**（原理7、
				// `String ≅ List(Char)`）なので、括ろうが名前を通そうが入れ子は生き残らず、
				// 平らに写すのが正しい——解釈器も `constructValues` の手前で `textAbsorb` を
				// 通してそう畳んでいる。`List` の μ は任意なので、そちらは1要素のままである。
				const strAbsorb = n.atomType === "String" && atomOfPart(parts[i]) === "String";
				if (w !== 16 && !spreadHere && !strAbsorb) {
					return em.fail(
						n,
						`器の構築はまだ出せません（${n.atomType}——撒いていない ${atomOfPart(parts[i]) || "器"} は1要素だが、` +
							`要素の幅が ${w} byte なので \`{ptr, len}\` が入らない。入れ子の器は未実装）`
					);
				}
				// **撒くなら、相手の要素の幅がこちらの置き場と揃っていなければならない。**
				// 写しループは `w` byte 刻みで読む。`w === 16` は「要素は `{ptr, len}` で
				// 運ぶ」という意味なので、相手の要素が `Int` のような値だと**生の番地を
				// 要素として読む**——`f : l m ? l , m~` の `' 0` が 1090518944 を返していた。
				//
				// 撒く相手の要素の型が書いていないことは、それ自体では悪くない（仮引数の
				// `[~a]` は中身が見えない）。悪いのは**この器の要素の型が、撒く相手の型
				// そのもの**になっている場合で、それは型の合流が撒いた側を開けずに「器を
				// 要素と数えた」ということである——`l~ , m~`（どちらも `List(Int)`）が
				// `List(List)` と型付き、16 byte 刻みで 8 byte の並びを読んでいた。
				if (spreadHere && w === 16) {
					const c = cellOfPart(parts[i]);
					const a = atomOfPart(parts[i]);
					if (c && c.size !== 16)
						return em.fail(
							n,
							`器の構築はまだ出せません（${n.atomType}——要素を \`{ptr, len}\` で運ぶ器なのに、` +
								`撒く ${a || "器"} の要素は ${c.size} byte の値です。幅の違う要素は混ぜられません）`
						);
					if (!c && (!a || a === n.elementType))
						return em.fail(
							n,
							`器の構築はまだ出せません（${n.atomType}——撒く ${a || "器"} の要素が` +
								`また ${n.elementType} だと言っている。型の合流が撒いた側を開けていないので要素の幅が決まらない。` +
								"入れ子の器は未実装）"
						);
				}
				if (w === 16 && !spreadHere) {
					// **要素を番地で置く器は、指す先の寿命まで引き受ける。**
					//
					// 下の `str x14, [x11]` は呼び先が書いた場所の**番地をそのまま**器へ入れる。
					// その場所が自分の枠の中（`sub sp` で取った sret のスロット）だと、返るときの
					// `mov sp, x29` が捨てた所を器が指す——次に誰かが枠を取った瞬間に中身が消える。
					//
					// **これは長さを測っても見えない。** `len` は正しく書かれるので `||…||` は合い、
					// 中身だけが死ぬ。`lexer.sn` の `tokens` がまさにこの形で、`expr` を後ろに繋ぐと
					// `[[+] 1 2]` が `[[+] \x00 \x01]` になっていた（門は緑のまま）。
					//
					// **直し方は上の `emitContentArena` である**——記述子の並びの後ろに中身の置き場を
					// 取り、呼び先にそこへ書かせる。届いていないのは、置き場の中でさらに置き場が要る形
					// （要素がまた器）と、字面で置く要素を含む形（`konst` の枝は引数から測れない）。
					// そこは**黙って踏むより断る**。
					{
						const src = stripExpand(parts[i]);
						if (src && src._sretFreshSlot)
							return em.fail(
								n,
								`器の構築はまだ出せません（要素を \`{ptr, len}\` で運ぶ器に、${src._sretFreshSlot} が` +
									"この枠で取った場所へ書いた結果を置こうとしました。返るときに捨てる場所なので、" +
									"番地だけが残って中身が死にます。この形の置き場はまだ取れません）"
							);
					}
					// 器の `__` は `{0, 0}`（添字の枝が既にそう出している）。1要素として
					// 置くときも単位元なので、置かずに個数も進めない。
					em.load("x14", so + 8, "この要素の len");
					const skipB = emitUnitSkip(em, parts[i], env, scope, "x14", "len");
					em.load(SCRATCH[0], cnt);
					emitSretCapacityGuard(em, SCRATCH[0]);
					em.load("x11", em.sretDest);
					em.emit(`add x11, x11, ${SCRATCH[0]}, lsl #4`, "書く先の位置へ");
					em.emit("str x14, [x11, #8]", "この要素の len");
					em.load("x14", so, "この要素の ptr");
					em.emit("str x14, [x11]");
					if (arenaSlot !== null) {
						// 中身を書いたぶん、置き場の「次に書く場所」を進める。ここを忘れると
						// 2つ目の要素が1つ目を踏む（長さは合うので、また中身だけが壊れる）。
						em.load(SCRATCH[1], so + 8, "この要素の len");
						em.emit(`add x14, x14, ${SCRATCH[1]}`, "次に書く場所");
						em.load(SCRATCH[1], arenaSlot, "中身の置き場の頭");
						em.emit(`str x14, [${SCRATCH[1]}]`);
					}
					em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, #1`, "1つぶん進む");
					em.store(SCRATCH[0], cnt);
					em.pop(2);
					if (arenaSlot !== null) em.pop(3);
					if (skipB) em.label(skipB);
					continue;
				}
				const top = em.newLabel("cp");
				const end = em.newLabel("cpe");
				em.emit(`mov x13, #0`, "写す位置");
				em.label(top);
				em.load("x15", so + 8, "写す器の len");
				em.emit(`cmp x13, x15`);
				em.emit(`b.ge ${end}`, "写し終えたら抜ける");
				em.load(SCRATCH[1], so, "写す器の ptr");
				// `loadElem` は 8 byte 未満を `w` レジスタで読む（`ldrb`/`ldrh` は 32 ビット
				// 側しか取らない）。書く側も同じ幅で書くので、上半分は使わない。
				if (w === 16) {
					// **参照で運ぶ要素は2語である。** `loadElem`/`storeElem` は 8 byte で頭打ちで、
					// 16 はその枝に落ちて**刻み 8 で半分だけ**写していた。ここは一度も走ったことの
					// 無い道で（`em1` が `String` に対して常に `null` だった）、蓋を開けた瞬間に
					// `tokens `ab`` が回った。
					//
					// 8 byte を2回で写す——1本のレジスタしか使わないので、この場の割り当てを変えずに
					// 済む（`ldp`/`stp` は組で2本要る）。
					em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, x13, lsl #4`, "写す元の位置へ");
					em.load(SCRATCH[0], cnt);
					em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, x13`, "書いた個数 ＋ 写した位置");
					emitSretCapacityGuard(em, SCRATCH[0]);
					em.load("x11", em.sretDest);
					em.emit(`add x11, x11, ${SCRATCH[0]}, lsl #4`, "書く先の位置へ");
					em.emit(`ldr x14, [${SCRATCH[1]}]`, "ptr");
					em.emit("str x14, [x11]");
					em.emit(`ldr x14, [${SCRATCH[1]}, #8]`, "len");
					em.emit("str x14, [x11, #8]");
				} else {
					// `loadElem` は 8 byte 未満を `w` レジスタで読む（`ldrb`/`ldrh` は 32 ビット側しか
					// 取らない）。書く側も同じ幅で書くので、上半分は使わない。
					em.emit(loadElem("w14", SCRATCH[1], "x13", w), `${w} byte を1つ読む`);
					em.load(SCRATCH[1], em.sretDest);
					em.load(SCRATCH[0], cnt);
					em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, x13`, "書いた個数 ＋ 写した位置");
					// **見積もりで通すなら、照合は付属品ではなく前提条件である。**
					//
					// 上界は証明ではなく見積もりなので（`returnSizeBound` の「食いながら撒く枝」）、
					// 外れうる。外れても壊れないのは書く前に照合して `__` へ落ちるからで、
					// **照合が無ければ外れた瞬間にスタックを踏む**——`__` ではなく踏み抜きになる。
					//
					// 兄弟枝（`w === 16`）には在るのにここ（`w < 16`＝要素が `Char` の1バイト写し）
					// には無かった。`parser.sn` の `out_one` が通るのはまさにこちらである。
					// 同じ規則が片方の枝にしか無い形で、上界を伸ばすほど効いてくる。
					//
					// 壊すのは `x15` だけで、`x15` はループ頭で毎周読み直す（写す器の len）。
					// 読んだ要素の `x14` と、宛先の `SCRATCH[1]` には触らない。
					emitSretCapacityGuard(em, SCRATCH[0]);
					if (shift) em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, ${SCRATCH[0]}, lsl #${shift}`);
					else em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, ${SCRATCH[0]}`);
					em.emit(storeElem("x14", SCRATCH[1], 0, w), "写す");
				}
				em.emit(`add x13, x13, #1`);
				em.emit(`b ${top}`);
				em.label(end);
				em.load(SCRATCH[0], cnt);
				em.load("x15", so + 8);
				em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, x15`, "写した個数ぶん進む");
				em.store(SCRATCH[0], cnt);
				em.pop(2);
			}
			em.load(SCRATCH[0], cnt, "len は書いた個数");
			em.load(SCRATCH[1], em.sretDest, "ptr は自分の宛先");
			em.pop(1);
			const [po3, lo3] = pushPair(em);
			if (lo3 === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.store(SCRATCH[1], po3, "ptr");
			em.store(SCRATCH[0], lo3, "len");
			return 2;
		}
		// **器の要素も、個数が書いてあるなら並べられる。**
		//
		// 個数が実行時に決まるのは**撒いた**ときであって、要素が器であること自体ではない
		// ——`[`10` , `+` , `2`]` は3要素だと書いてある。ここを「並べるものが器なら実行時」
		// と読んでいたので、要素が参照で運ばれる器はフレームの中で作れなかった。**器が
		// 並ぶことと、個数が実行時に決まることは別の問いである。**
		//
		// 一つ置くのは `{ptr, len}` の 16 バイトである。置き先が違うだけで、sret の枝と
		// やることは同じ——底が呼ぶ側のスロットか、自分の `sub sp` かの違いしかない。
		const spreadPart = (x) => {
			const u = unwrap(x);
			return !!(u && u.type === "operation" && u.position === "postfix" && u.name === "expand");
		};
		if (
			em1 &&
			em1.size === 16 &&
			parts.length > 0 &&
			parts.every((p) => !spreadPart(p) && [1, 2].includes(slotsOfNode(p, em.conf, env)))
		) {
			const base16 = em.slot;
			// 要素ごとの `{ptr, len}` が置かれたスロット。
			const cells = [];
			for (const q of parts) {
				const pw = genExpr(q, env, em, scope);
				if (pw === false) return false;
				if (pw === 2) {
					cells.push((em.slot - 2) * 8);
					continue;
				}
				if (pw !== 1) {
					em.pop(pw === TAIL ? 0 : pw);
					return em.fail(n, `並べる器が ${pw} 本です`);
				}
				// **要素が参照で運ばれる器へスカラーを積むには、持ち上げの代金を払う**
				// （原理8——同型は型では無償、表現では有償）。1文字は長さ1の文字列である。
				const po = emitLiftToContainer(em, q, (em.slot - 1) * 8, "長さ1の器へ持ち上げる（原理8）");
				if (po === false) return false;
				if (po === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
				cells.push(po);
			}
			const count16 = parts.length;
			let into16 = "sp";
			if (sretHere) {
				em.load(SCRATCH[1], em.sretDest, "返値スロット（sret）");
				into16 = SCRATCH[1];
			} else {
				if (!allocaAllowed(em, n, n.atomType + " を組み立てる")) return false;
				em.emit(`sub sp, sp, #${count16 * 16}`, `${count16} 要素ぶんの場所を取る（1要素 16 byte）`);
				em.movedSp = true;
			}
			// **実行時に `__` になる要素が居るなら、位置も個数も実行時である。**
			// 居ないなら今まで通り静的なオフセットと静的な長さで出る（リテラルの並びは
			// ここに乗るので、1命令も増えない）。
			const dynamic16 = parts.some((q) => !cannotBeUnit(q, env, scope));
			if (!dynamic16) {
				for (let k = 0; k < count16; k++) {
					em.load(SCRATCH[0], cells[k]);
					em.emit(`str ${SCRATCH[0]}, [${into16}, #${k * 16}]`, k === 0 ? "要素の ptr" : undefined);
					em.load(SCRATCH[0], cells[k] + 8);
					em.emit(`str ${SCRATCH[0]}, [${into16}, #${k * 16 + 8}]`, k === 0 ? "その len" : undefined);
				}
			} else {
				em.emit("mov x13, #0", "書けた個数（バイト）");
				for (let k = 0; k < count16; k++) {
					// 持ち上げた1要素も器なので、見るのは同じ `len` である
					// （`emitLiftToContainer` が `__` に `len = 0` を置いている）。
					em.load(SCRATCH[0], cells[k] + 8);
					const skip = emitUnitSkip(em, parts[k], env, scope, SCRATCH[0], "len");
					em.emit(`add x11, ${into16}, x13`, k === 0 ? "書けた位置へ" : undefined);
					em.emit(`str ${SCRATCH[0]}, [x11, #8]`, k === 0 ? "その len" : undefined);
					em.load(SCRATCH[0], cells[k]);
					em.emit(`str ${SCRATCH[0]}, [x11]`, k === 0 ? "要素の ptr" : undefined);
					em.emit("add x13, x13, #16", k === 0 ? "書けたぶんだけ進む" : undefined);
					if (skip) em.label(skip);
				}
			}
			em.emit(`mov ${SCRATCH[0]}, ${into16}`, "ptr");
			em.pop(em.slot - base16);
			const [po16, lo16] = pushPair(em);
			if (lo16 === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.store(SCRATCH[0], po16, "ptr");
			if (dynamic16) em.emit(`lsr ${SCRATCH[1]}, x13, #4`, "len は書けた個数（1要素 16 byte）");
			else em.emit(`mov ${SCRATCH[1]}, #${count16}`, "len は要素数");
			em.store(SCRATCH[1], lo16, "len");
			return 2;
		}
		if (em1 && em1.size && parts.every((p) => slotsOfNode(p, em.conf, env) === 1)) {
			const base = em.slot;
			for (const p of parts) {
				const pw = genScalar(p, env, em, scope, "並べる要素はレジスタ1本の値です");
				if (pw === false) return false;
			}
			const count = em.slot - base;
			const w = em1.size;
			let into = "sp";
			if (sretHere) {
				// 呼び出し側のスロットへ書く。底は x8 で渡ってきている。
				em.load(SCRATCH[1], em.sretDest, "返値スロット（sret）");
				into = SCRATCH[1];
			} else {
				if (!allocaAllowed(em, n, n.atomType + " を組み立てる")) return false;
				const bytes = Math.ceil((count * w) / 16) * 16;
				em.emit(`sub sp, sp, #${bytes}`, `${count} 要素ぶんの場所を取る（フレームから出ない）`);
				em.movedSp = true;
			}
			// **実行時に `__` になる要素は、並べない。**
			//
			// 構築の `__` は単位元なので `1 __ 3` は `[1 3]` である。静的に `__` と分かる
			// 要素は既に落としてあるが（`parts` のフィルタ）、選択写像が落とした要素の
			// ように**走らせてみないと分からない**ものが残る。
			//
			// そこはカーソルで書く：書けた個数をバイトで持ち、通った要素だけをカーソルの
			// 位置へ置いて進める。長さは最後にカーソルから作る。上界は要素数なので確保は
			// 変わらない——**溢れないまま短くなる**だけである。
			//
			// **払うのは `__` になり得る要素だけである。** リテラルの並びは全部が
			// `cannotBeUnit` なので、今まで通り静的なオフセットと静的な長さで出る
			// （実プログラムはここに乗る）。番地が定数なら全域性がタダだったのと同じ形。
			const maybeUnit = parts.map((q) => !cannotBeUnit(q, env, scope));
			if (!maybeUnit.some(Boolean)) {
				for (let k = 0; k < count; k++) {
					em.load(SCRATCH[0], (base + k) * 8);
					em.emit(storeElem(SCRATCH[0], into, k * w, w), k === 0 ? (sretHere ? "呼び出し側のスロットへ並べる" : "並べる") : undefined);
				}
				em.emit(`mov ${SCRATCH[0]}, ${into}`, "ptr");
				em.pop(count);
				const [po, lo] = pushPair(em);
				if (lo === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
				em.store(SCRATCH[0], po, "ptr");
				em.emit(`mov ${SCRATCH[1]}, #${count}`, "len は要素数");
				em.store(SCRATCH[1], lo, "len");
				return 2;
			}
			em.emit("mov x13, #0", "書けた個数（バイト）");
			for (let k = 0; k < count; k++) {
				em.load(SCRATCH[0], (base + k) * 8);
				// **見分け方は1箇所で決める**（`emitUnitSkip`）。ここには定数を組んで
				// 比べる綴りが別に在ったが、同じ問いに答え方が2つあると片方だけが古くなる
				// ——追記と器の並びが `__` を落とせていなかったのは、まさにそれである。
				const skip = emitUnitSkip(em, parts[k], env, scope, SCRATCH[0], "scalar");
				em.emit(storeElem(SCRATCH[0], into, null, w, "x13"), k === 0 || skip ? "並べる" : undefined);
				em.emit(`add x13, x13, #${w}`, skip ? "書けたぶんだけ進む" : undefined);
				if (skip) em.label(skip);
			}
			em.emit(`mov ${SCRATCH[0]}, ${into}`, "ptr");
			em.pop(count);
			const [po, lo] = pushPair(em);
			if (lo === null) return em.fail(n, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.store(SCRATCH[0], po, "ptr");
			em.emit(`mov ${SCRATCH[1]}, x13`, "len は書けた個数");
			if (w !== 1) em.emit(`lsr ${SCRATCH[1]}, ${SCRATCH[1]}, #${Math.log2(w)}`, `バイトから個数へ（1要素 ${w} byte）`);
			em.store(SCRATCH[1], lo, "len");
			return 2;
		}
	}
	if (COPRODUCT_BUILD_OPS.has(n.name) && slotsOf(n.atomType, em.conf) === 2) {
		if (em.conf.layer !== undefined && em.conf.layer < 1) {
			return em.fail(
				n,
				`layer: ${em.conf.layer} では器を作れません（${n.atomType} の記憶を確保する手段が無い）。` +
					`切り出し（\`s ' i~\`）は確保が要らないので使えます`
			);
		}
		if (n.escapesFrame === false) {
			// **理由は「並べるものが器だから」ではない。** 要素が器（16 byte）の並びは、
			// フレームの中でも上の枝がちゃんと出す。ここへ落ちるのは**撒いている**ときで、
			// 要素が Int でも来る——走査して写す枝が sret の道にしか無いのが実際の理由。
			return em.fail(
				n,
				`器の構築はまだ出せません（${n.atomType}——撒いているので要素数が実行時に決まるが、` +
					`自分のフレームに取る道には走査して写す枝が無い。sret の枝にしかない）`
			);
		}
		// **状態を取り違えて名指ししない。** ここは「sret の規約が未定」と言っていたが、
		// 規約は在って動いている。実際に起きているのは**返す器の上界が出せなかった**ことで、
		// 上界が無いと計画に載らず、載らないと `em.sretDest` が付かず、付かないと上の枝へ
		// 一歩も入れずにここへ落ちる。名前が状態を指していないと、読んだ人は無い規約を
		// 作りに行く（実際そうなった）。上界がどの部分で出せなかったかは
		// `returnSizeBound` が知っているので、そこを見る手がかりだけ渡す。
		return em.fail(
			n,
			`器の構築はまだ出せません（${n.atomType}——**フレームから出る**ので置き場所は呼ぶ側が用意する（sret）が、` +
				`返す器の上界が出せなかったので計画に載っていない。上界は konst + Σ coef×||仮引数|| と ` +
				`coef×μ||仮引数|| しか書けない）`
		);
	}
	return em.fail(n, `まだ出せない式です（${n.name || n.type}）`);
}

/**
 * `__` を幅ぶん置く。**表し方は幅ごとに違う。**
 *
 *   1本（レジスタ上の値）  上位ビットの niche（value_representation.md §3.5）
 *   2本（`{ptr, len}`）    `len = 0`
 *
 * 2本目が `len = 0` なのは、**空文字列・空リストが `__` そのものだから**である
 * （`__ = []`、unit.md §値としての性質 / type_system.md §空文字列）。零対象は一つしか
 * ないので、器の側にも既に `__` の置き場所がある——新しい表現を足したのではなく、
 * 元からある同一視をそのまま命令にしている。`String` は2文字以上、`Char` は1文字
 * なので、`len = 0` は他の値と衝突しない。
 */
function emitUnit(em, offs, kind = null) {
	if (offs.length === 1) {
		em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
		em.store("x12", offs[0]);
		return;
	}
	// カーソルは先頭の `arm` が niche であることが「尽きた」である。
	if (kind === "cursor") {
		em.emit("movz x12, #0x8000, lsl #48", "__ の niche（arm）");
		em.store("x12", offs[0], "arm");
		em.emit("mov x12, #0");
		for (let k = 1; k < offs.length; k++) em.store("x12", offs[k]);
		return;
	}
	em.emit("mov x12, #0", "__ は空（`__ = []`）");
	em.store("x12", offs[0], "ptr");
	em.store("x12", offs[1], "len = 0 が __");
	for (let k = 2; k < offs.length; k++) em.store("x12", offs[k]);
}

/**
 * 添字（`'`）を出す。出せない形なら `null` を返して呼び出し元の診断へ渡す。
 *
 * **1要素リストとスカラーは同型である**（`[5]` は `Int`、list_model.md）。だから器の幅が
 * 1本のときも同じ規則で引ける——`x ' 0` は `x` 自身、`x ' 1` は範囲外で `__` である。
 * 器が2本（`{ptr, len}`）のときだけアドレス計算になる。
 */
// 左辺が規則か（レンジ・イテレータ）。規則はレジスタに乗り、添字は算術で出る。
/** `Struct` のスロット数（形が型にあるので静的に出る）。Struct でなければ null。 */
/**
 * **構造体の実体が要るバイト数の総和（自分＋入れ子の子たち）。**
 *
 * スロットに置かれるのは `{ptr}` の 8 byte なので、`lay.size` は**自分の枠だけ**を
 * 数えている。フレームに置くならそれでよい（子は子で `sub sp` する）が、**返す**ときは
 * 場所を用意するのは呼ぶ側なので、子のぶんまで含めて渡さなければならない。
 *
 * 置き方は「親のすぐ後ろに、名前順で前順に並べる」。**上界を数える側とバイトを書く側が
 * 同じ歩き方をする**ことが要で、ここを2箇所で決めると必ずズレる。
 */
function structFootprint(lay) {
	if (!lay) return 0;
	let n = Math.ceil(lay.size / 16) * 16;
	for (const sl of lay.slots || []) if (sl.shape) n += structFootprint(sl.shape);
	return n;
}

function structSlots(node, em, env) {
	const u = unwrap(node);
	if (!u || u.atomType !== "Struct") return null;
	// 仮引数として受けた構造体も数えられなければならない。`layoutOfStruct` だけでは
	// 値ノードの無い束縛で null になり、幅1本＝スカラー扱いへ落ちて **1** を返していた
	// ——`f : [~this] ? ||this||` が、解釈器 3 に対して診断ゼロで 1。
	const lay = structShapeOf(u, env, { target: em.conf.target, charset: em.conf.charset, env });
	return lay && lay.slots && lay.slots.length > 0 ? lay.slots.length : null;
}

function isRuleNode(node, conf, env) {
	const p = node ? passingOf(node, { target: conf.target, charset: conf.charset, env }) : null;
	return !!p && p.mode === "register" && p.slots >= 2;
}

/**
 * **その規則は番地を並べるか。** 並べるなら、歩幅の節点（分かれば）と、起点が `__` になりうるかを
 * 返す。そうでなければ null。
 *
 * 要素の型は規則の節点が持つ（`elementType`）。添字の側（`typed`）は引いた結果の型も見られるので
 * それで決める。起点が字面の規則なら起点の節点を訊き、名前などで運ばれてきた規則は起点が
 * `__` でありうる（切った規則の起点は溢れていれば `__`）。
 */
function addressRuleOf(node, env, scope, typed = false) {
	const u = unwrap(node);
	if (!typed && elementTypeOfNode(node, env) !== "Address") return null;
	const parts = u && u.type === "operation" && (u.name === "range" || u.name === "range_arithmetic") ? rangeParts(u) : null;
	return {
		step: parts && !parts.signedByEnds ? parts.step : null,
		startMaybeUnit: ruleStartMaybeUnit(node, env, scope),
	};
}

// 規則の起点は `__` でありうるか。字面の規則なら起点の節点に、門を通った仮引数なら「ならない」と訊ける。
// 切った規則などは、起点が `__` でありうる（終端の無い規則を負の位置から切れば `__`）。
function ruleStartMaybeUnit(node, env, scope) {
	const u = unwrap(node);
	const parts = u && u.type === "operation" && (u.name === "range" || u.name === "range_arithmetic") ? rangeParts(u) : null;
	// 歩幅・終端が `__` になりうる字面の規則も、組むときに起点が `__` へ倒れる（`genExpr` のレンジの節）。
	if (parts) return !cannotBeUnit(parts.start, env, scope, true) || [parts.step, parts.end].some((p) => p && !cannotBeUnit(p, env, scope));
	if (!isIdentifierNode(u)) return true;
	if (cannotBeUnit(u, env, scope, true)) return false;
	// 字面の規則へ束縛した名前（`c : [0 ~+ 1]`）は、その字面に訊く。
	const b = env ? envLookup(env, u.value) : null;
	const v = b && b.valueNode ? unwrap(b.valueNode) : null;
	return v && v !== u && v.type === "operation" && (v.name === "range" || v.name === "range_arithmetic") ? ruleStartMaybeUnit(v, env, scope) : true;
}

/**
 * **規則の負の添字を均す。** 呼ぶ前に x9 = start、x10 = step、x11 = 添字を置いておくこと。
 *
 * 終端のある規則は器と同じく**末尾から数える**——レンジは「リストに見えるだけ」で、リストと同じ
 * インターフェースを持つ（list_model.md §2.3）。要素数は `(end - start) / step + 1` なので、負のときだけ
 * 割り算を払う（器の均しと同じく、負でない添字の道は比べて跳ぶ2命令）。
 *
 * **終端の無い規則には末尾が無い**ので、負の添字は `__` である（利用者の決定、2026-09-13）。均しは
 * 要らず、呼ぶ側が後で「負なら __」を見る。
 *
 * 添字が負になりえなければ何も出さず false を返す。
 */
function emitRuleNegativeIndex(cw, co, idxNode, em) {
	if (!mayBeNegative(idxNode, em)) return false;
	if (cw >= 3) {
		const nonneg = em.newLabel("nonneg");
		em.emit("cmp x11, #0", "負なら末尾から数える");
		em.emit(`b.ge ${nonneg}`);
		em.load("x13", co + 16, "end");
		em.emit(`sub x13, x13, ${SCRATCH[0]}`, "end - start");
		em.emit(`sdiv x13, x13, ${SCRATCH[1]}`, "÷ step");
		em.emit("add x13, x13, #1", "要素数");
		em.emit("add x11, x11, x13", "要素数 + 添字");
		em.label(nonneg);
	}
	return true;
}
// カーソルかどうか。「どう置かれているか」の帳簿を見る（`repr`）。
function cursorGroupOf(node, env) {
	if (!node) return null;
	if (node.cursorGroup) return node.cursorGroup;
	if (isIdentifierNode(node) && env) {
		const b = envLookup(env, node.value);
		if (b && b.cursorGroup) return b.cursorGroup;
		if (b && b.returnsCursorGroup) return b.returnsCursorGroup;
	}
	return null;
}

/**
 * **カーソルを引く・進める。**
 *
 * `cur ' 0` が k 番目の要素、`cur ' 1~` が1つ進めたカーソルである。どちらも生成された
 * Sign の関数（`<g>_at` / `<g>_adv`）を呼ぶだけで済む——分岐や次の枝の選び方は Sign の
 * 側に書いてあるので、命令の側へ持ち込む必要が無い（stream_desugar.js）。
 *
 * `cur ' i`（i が 0 以外）は出せない。枝をいくつ跨ぐかは実行時にしか分からないので、
 * 走らせる命令列になる——それは `' 1~` を繰り返すことであって、添字の算術ではない。
 * 黙って別の答えを出さず名指しする。
 */
function genCursorIndex(node, env, em, scope, group, cbase) {
	const conf = em.conf;
	// 幅も命令も**剥いだ先**で測る。括弧のノードは「どう置かれているか」を持たない。
	const cw = slotsOfNode(cbase, conf, env);
	if (cw === null || cw < 3) return em.fail(node, `カーソルの本数が決まりません（${cw}）`);
	const idx = unwrap(node.right);
	const isSlice = !!idx && idx.type === "operation" && idx.name === "range_arithmetic";
	const start = isSlice ? unwrap(idx.left) : idx;
	const isLiteral = (n, v) => !!n && n.kind === "number" && literalValue(n) === BigInt(v);
	if (isSlice) {
		if (!isLiteral(start, 1) || !isLiteral(unwrap(idx.right), 1)) {
			return em.fail(node, "カーソルは1つずつしか進められません（`cur ' 1~` だけ出せます）");
		}
	} else if (!isLiteral(start, 0)) {
		return em.fail(node, "カーソルは先頭しか引けません（`cur ' 0` だけ出せます——途中を引くのは進めることの繰り返しです）");
	}
	// カーソルの3つ組（か4つ組）をそのまま引数へ載せる。`{arm, k, 入力…}` の並びが
	// `<g>_at` / `<g>_adv` の仮引数の並びと同じなので、詰め替えは要らない。
	const w = genExpr(cbase, env, em, scope);
	if (w === false) return false;
	if (w !== cw) { em.pop(w); return em.fail(node, `カーソルの本数が合いません（${w} と ${cw}）`); }
	const base = em.slot - cw;
	if (cw > ARG_REGS.length) return em.fail(node, `カーソルが ${cw} 本でレジスタに載りません`);
	for (let k = 0; k < cw; k++) em.load(ARG_REGS[k], (base + k) * 8, k === 0 ? "カーソルをそのまま渡す" : undefined);
	const callee = group + (isSlice ? CURSOR_SUFFIXES.adv : CURSOR_SUFFIXES.at);
	em.emit(`bl ${symbolOf(callee)}`, isSlice ? "1つ進めたカーソル" : "先頭の要素");
	em.pop(cw);
	// 引いた結果は要素1つ、進めた結果はカーソルそのもの。
	const outw = isSlice ? cw : 1;
	const off = [];
	for (let k = 0; k < outw; k++) {
		const o = em.push();
		if (o === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		off.push(o);
	}
	for (let k = 0; k < outw; k++) em.store(ARG_REGS[k], off[k], k === 0 ? (isSlice ? "進めたカーソル" : "要素") : undefined);
	return outw;
}

/** 添字が定数 0 か（`$x ' 0` の判定に使う）。 */
/**
 * その式は `$` が作った番地か（識別子なら束縛まで辿る）。
 *
 * 生の番地リテラル（`0x40000000`、MMIO）とは区別する——**そちらは本当に数である番地**で
 * あり、算術が要る。区別しているのは「置き場所として作られたもの」だけである。
 */
function addressFromDollar(node, env) {
	const t = unwrap(node);
	if (!t) return false;
	if (t.type === "operation" && t.position === "prefix" && t.name === "address") return true;
	if (isIdentifierNode(t) && env) {
		const b = envLookup(env, t.value);
		const v = b && b.valueNode ? unwrap(b.valueNode) : null;
		return !!(v && v.type === "operation" && v.position === "prefix" && v.name === "address");
	}
	return false;
}

// **`#` の段数はシンボルの見え方そのものである。**
//
// `system_architecture.md` §2.1 の随伴ペア（エクスポート側 `#`／デマンド側 `@`）は
// project-arena / shared-heap / pinned-area の3段を持つ。ELF にはこの3段がそのまま
// 揃っている——だから写すだけでよく、リンカスクリプトが要らない（§2.2）。
//
// | Sign | ELF | 意味 |
// | --- | --- | --- |
// | （無印） | local（`.global` を出さない） | 外に名前が出ない |
// | `#` (Rc) | `.global` + `.hidden` | プロジェクト内では結合できるが共有物からは出ない |
// | `##` (Arc) | `.global` | 共有オブジェクトの外から見える |
// | `###` (Pin) | `.global` + 専用セクション | 配置を option.ms が決められる |
//
// **無印を local にするのが本題である。** ここまで Pass 4 は全部の関数に `.global` を
// 付けていた——`#` を書いても書かなくても同じで、つまり `#` は機械語に何の意味も
// 持っていなかった。内部関数の名前がシンボル表に載るのは、`.ist` を書き出さない理由
// （内部識別子名を外に出さない）と同じものが `.s` 側から漏れていたということでもある。
/**
 * **Sign の名前をアセンブリの綴りへ。** 名前はそのままシンボルになるが、アセンブラが
 * レジスタと読む綴りだけは引用符で囲む——`bl h1` は半精度レジスタ h1 への分岐と読まれ、
 * `expected label or encodable integer pc offset` で落ちる。囲んでも**字句だけの話**で、
 * ELF のシンボル名は `h1` のまま（llvm-nm で `T h1`）。だから公開した名前は C からも同じ
 * 綴りで呼べるし、`.st` の名前とシンボル表の名前も一致したままである。
 *
 * 一覧は clang 22 で測った（英字1〜4字と、英字1〜3字＋0〜40を `bl` に置いて総当たり）。
 * 大文字小文字を問わない。`x00`・`x32`・`z0`・`p0`・`pn0`・`za`・`pc`・`midr_el1`・`lsl` は
 * 記号として読まれる。**漏れても黙らない**——囲み損ねた綴りはアセンブラが名指しで落とす。
 * 囲みすぎても害は無い（シンボル表の綴りは変わらない）。
 *
 * 名前の中の綴りをレジスタとして読まないことは、字面を読む側（`maskSymbols`）が持つ。
 */
const ASM_REGISTER_SPELLING = /^(?:[xwbhsdqv](?:[0-9]|[12][0-9]|3[01])|sp|wsp|xzr|wzr|lr|fp|nzcv|fpcr|fpsr|fpmr|vg|vgx2|vgx4|ffr|zt0)$/i;
function symbolOf(name) {
	return ASM_REGISTER_SPELLING.test(name) ? `"${name}"` : name;
}

function symbolDirectives(name, env, label = name) {
	const level = exportLevelOf(name, env);
	label = symbolOf(label);
	if (level === "###") return [`	.global ${label}`, `	.section .sign.pinned,"ax",%progbits`];
	if (level === "##") return [`	.global ${label}`];
	if (level === "#") return [`	.global ${label}`, `	.hidden ${label}`];
	return [];
}

// `###` は自分のセクションへ出るので、次の関数のために `.text` へ戻す。
function symbolDirectivesAfter(name, env) {
	return exportLevelOf(name, env) === "###" ? ["	.text"] : [];
}

/**
 * **データの像を置く節。** 決めるのは「書かれるか」と「`###` か」の2つだけである。
 *
 * `#` と `##` は節を分けない——見え方はシンボルの側（`.global` / `.hidden`）が持つので、
 * 節を分ける理由が無い。分けるのは `###` だけで、あれは**配置**を言う印だからである
 * （system_architecture.md §2.2——住所は option.ms が決める）。
 */
function dataBucketOf(x) {
	if (x.level === "###") return x.writable ? "pinned.data" : "pinned.rodata";
	return x.writable ? "data" : "rodata";
}

/** データのラベルの見え方。節は `dataBucketOf` が持つので、ここは `.global` / `.hidden` だけ。 */
function dataSymbolDirectives(x) {
	if (!x.level) return [];
	const g = `	.global ${x.label}`;
	return x.level === "#" ? [g, `	.hidden ${x.label}`] : [g];
}

/**
 * **後段が自分で出す綴りは公開できない。**
 *
 * 無印なら名前は `.Lbind_…` か local なので当たらなかった——`#` を書いた瞬間に裸の識別子
 * になり、後段の出す綴りと同じ棚へ載る。実測で `##_.main : 7` の `.s` は
 * `error: symbol '_.main' is already defined` でアセンブラが止まる。
 *
 * 載せるのは**この後段と、その入口が自分で出す綴りだけ**である。リンカスクリプトの記号
 * （`_stack_top` など）は的ごとに違うので、ここではなく配置を決める側が持つ。
 */
/**
 * **公開できない綴り。** 後段と、後段の外側（起動コードとリンカスクリプト）が自分で出す名前である。
 *
 * 後段の綴りとぶつかると**アセンブラが止める**（`symbol '_.main' is already defined`）が、
 * **リンカスクリプトの綴りとぶつかっても誰も止めない**——スクリプトの代入が勝ち、診断ゼロ・
 * `ld` の終了コード 0 のまま、プログラム自身の参照が別の場所へ行く。実測（2026-09-18）:
 *
 *   `##_stack_top : 42` を公開して読むと 43 ではなく 9120000090000001（自分の `.text`）
 *   `##_image_end` は 1、`##_ram_base` は c0dec0dec0dec0df
 *
 * **だから断る側がここしか無い。** 一覧は `qemu/link.ld` と `qemu/start.s` から取ったもので、
 * **同じ事実が2か所に在る**——`test/export_symbol.test.js` が両方を読んで、ここが覆えていない
 * 綴りが出たら赤くなる。片方を増やしたらもう片方が落ちる、という形にしてある。
 */
const RESERVED_SYMBOLS = new Set([
	// **入口の綴りはここに要らない。** `_.main` は `.` を含むので、Sign の識別子の字集合
	// （`[a-zA-Z][a-zA-Z0-9_]*` か `_[a-zA-Z0-9_]+`）では**書けない**——構文が先に落とす。
	// 予約するのは「利用者が書けてしまう綴り」だけでよい（下の2つは書ける）。
	// qemu/start.s
	"_start", "put_hex", "vectors",
	// qemu/link.ld（代入。ぶつかっても誰も言わない側）
	"_ram_base", "_ram_size", "_stack_size", "_stack_limit", "_stack_top", "_image_end",
	// --defsym で外から渡す
	"__ram_size", "__stack_size",
]);

// 環境の鍵は `<f>` の形（トークンのまま）だが、ラベルは剥がした `f`。両方で引く。
function exportLevelOf(name, env) {
	const b = envLookup(env, name) || envLookup(env, `<${bareName(name)}>`);
	const level = b ? b.exported || null : null;
	// 予約された綴りは**公開しない**。名指しは `checkExportedNames` が1度だけする
	// ——引く側は5か所あるので、ここで黙らせて診断をそちらに置くと同じ言い分が5回出る。
	if (level && RESERVED_SYMBOLS.has(bareName(name))) return null;
	return level;
}

/**
 * **引く側は定義を公開しない。**（2026-09-18 に直した。直す前の実測が下にある）
 *
 * `resolveImports` はインポートを**ソースのまま展開する**ので、直す前は `#` の印が
 * 引く側にも付いてきた。印を「公開定義を出す」に繋いだ日（c37e4bce）から、表を使う枚が
 * 全部、同じ表の定義を公開していた——実測で `operator_table.o` と `parser.o` を繋ぐと
 * 重複シンボルが **13 件**（infix / prefix / postfix / enclosure / asm_* 9本）。
 * parser+emit、preprocess+emit、preprocess+parser も同じ。動機（C の `.h` と `.o` の
 * 分け方）と逆で、**ヘッダを include しても定義は増えない**のがその形である。
 *
 * **`exportLevelOf` は直す場所ではなかった。** ここは名前と env しか持っておらず、
 * 合流後の define ノードのキーは `type,op,name,position,left,right,exported,atomType` で
 * **ファイルを名指しする欄が1つも無い**。印は `resolveImports` が撒いた行を積む所で、
 * **字句のまま**落とす（`compile.js`）——印の元は「行頭の `#_` トークン」1つで、そこから
 * 導く3か所も読む6か所も、トークンが無ければ**構造的に**同じ答えになる。
 *
 * 後段へ「撒かれてきた」旗を渡す作りは採らなかった。印を読む所は**6か所**ある
 * （`pass3` の総称の道、`pass1b` の具体化、`st.js` の `generateSignType`、`compile.js` の
 * `specializeRefCalls`、ここ、`checkExportedNames`）。旗を足す形だと**そのうち1本を
 * 忘れたときに黙って落ちる**——c37e4bce で実際に踏んだ形がそれで、あのときは
 * `runsOnce` の道だけが印を落とした。
 *
 * **像までは消えない。** 展開は今までどおりなので、引く側の `.o` には表の像が
 * `.Lbind_…` で残る。消えたのは**シンボルの重複だけ**で、データの重複はソース展開そのものを
 * やめるまで残る。門は `test/export_symbol.test.js` の §6〜§8 にある。
 */

/**
 * 予約された綴りの**出どころ**。断るときの言い分に入れる。
 *
 * 出どころで壊れ方が違う——後段と起動コードの綴りは**アセンブラが止める**
 * （`symbol '_.main' is already defined`）が、**リンカスクリプトの綴りは誰も止めない**
 * ——代入が勝って、診断ゼロ・`ld` の終了コード 0 のまま別の場所を指す。
 * **止まらない方こそ言い分が要る。**
 */
const RESERVED_ORIGIN = {
	_start: "起動コード（qemu/start.s）が出す",
	put_hex: "起動コード（qemu/start.s）が出す",
	vectors: "起動コード（qemu/start.s）が出す",
	_ram_base: "リンカスクリプト（qemu/link.ld）が決める",
	_ram_size: "リンカスクリプト（qemu/link.ld）が決める",
	_stack_size: "リンカスクリプト（qemu/link.ld）が決める",
	_stack_limit: "リンカスクリプト（qemu/link.ld）が決める",
	_stack_top: "リンカスクリプト（qemu/link.ld）が決める",
	_image_end: "リンカスクリプト（qemu/link.ld）が決める",
	__ram_size: "リンクのときに外から渡す（--defsym）",
	__stack_size: "リンクのときに外から渡す（--defsym）",
};

/** 公開できない綴りを名指しする。`exportLevelOf` が黙って下ろした分の言い分である。 */
function checkExportedNames(nodes, env, em) {
	if (!env) return;
	for (const node of nodes) {
		if (!isDefineNode(node)) continue;
		const l = unwrap(node.left);
		if (!isIdentifierNode(l)) continue;
		const name = bareName(l.value);
		if (!RESERVED_SYMBOLS.has(name)) continue;
		const b = envLookup(env, l.value) || envLookup(env, `<${name}>`);
		if (!b) continue;
		// **関数は印に関わらず裸のラベルを出す。** だから予約された綴りを関数の名前にすると、
		// 後段や起動コードが出す同じ綴りと**二重定義**になる（実測: `put_hex : n ? n + 1` で
		// `put_hex:` が2つ）。アセンブラは止めるが、言い分は綴りの話しかしない——ここで名指しする。
		// データは `.Lbind_…` のローカルラベルなのでぶつからない（実測）。だから関数だけを見る。
		if (!b.exported && b.category !== "Lambda") continue;
		em.diagnostics.push({
			severity: "error",
			message: b.exported
				? `\`${name}\` は${RESERVED_ORIGIN[name] || "後段が自分で出す"}綴りなので公開できません` +
					`（\`${b.exported}\` を外すか、名前を変えてください）`
				: `\`${name}\` は${RESERVED_ORIGIN[name] || "後段が自分で出す"}綴りなので、関数の名前には使えません` +
					`（後段が出す同じ綴りと二重定義になります。名前を変えてください）`,
			node,
		});
	}
}

/**
 * 別名の連なりを辿って、実体の名前を返す（`h : g` / `g : f` なら `f`）。
 *
 * 辿るのは**名前だけ**である。部分適用（`g : f 1`）は実引数の位置がずれるので辿らない
 * ——飛ぶ先は同じでも、渡すものが違う。
 */
function aliasTargetOf(name, env) {
	let cur = name;
	const seen = new Set();
	while (env && !seen.has(cur)) {
		seen.add(cur);
		const b = envLookup(env, cur);
		// 由来は Pass 3 が束縛へ書き戻している（`名前 : 別名` の `aliasOf`）。ラムダの
		// 束縛には値ノードが無いので、そちらを覗くだけでは辿れない。
		const to = b && b.aliasOf ? b.aliasOf : null;
		if (!to || to === cur) break;
		cur = to;
	}
	return cur;
}

/**
 * その式は**生の番地**（`0x40800000` のようなリテラル由来）か。名前は辿る。
 *
 * `$` が作った番地（`addressFromDollar`）とは区別する——あちらは「置き場所として作られた
 * もの」で、こちらは**本当に数である番地**である。MMIO はこれでしか書けないので layer 0
 * では要るが、上の層では番地の捏造そのものになる。
 */
function rawAddressNode(node, env) {
	const t = unwrap(node);
	if (!t) return false;
	if (t.type === "atom" && t.kind === "address") return true;
	if (isIdentifierNode(t) && env) {
		const b = envLookup(env, t.value);
		const v = b && b.valueNode ? unwrap(b.valueNode) : null;
		if (v && v !== t) return rawAddressNode(v, env);
	}
	return false;
}

/**
 * 番地を取られた束縛の置き場所（ラベル）。無ければ null。
 *
 * **場所を作る側と読む側で同じ答えが要る。** `$名前` が場所を作り、`名前` がそこを読む
 * ——2つが別々に判断すると、片方だけ場所を使って片方が畳む形になる。
 */
function bindingLabel(name, b, env, em) {
	// **効果を持つ束縛の場所は、中身が実行時に決まる。** 定義の行が書き、使う側は読む
	// だけなので、置くのは 0 で初期化した書ける語ひとつでよい。幅は必ず 8 byte にする
	// ——狭く置くと `__`（niche）が入らず、**尽きたことを表せなくなる**。
	if (b && b.runsOnce) return { label: em.internBinding(bareName(name), "0", 8, true), size: 8 };
	const vn = b && b.valueNode ? unwrap(b.valueNode) : null;
	const lit = vn && vn.type === "atom" && (vn.kind === "number" || vn.kind === "address") ? vn : null;
	const m = b && b.atomType ? measure({ atomType: b.atomType }, { target: em.conf.target, charset: em.conf.charset }) : null;
	if (!lit || !m || !m.size) return null;
	return { label: em.internBinding(bareName(name), literalDataText(lit), m.size, !!b.addressTaken), size: m.size };
}

/**
 * **スロット1つを、そのまま置ける形で書き出す。** 置けなければ null。
 *
 * 幅は `layoutOfStruct` が言うもの（`slot.size`）をそのまま使う——**1バイトも違っては
 * いけない**。読む側（`slotLoadInsn` / `genIndex`）が同じ表を引くので、ここで独自に
 * 幅を決め直すと「置いた場所」と「読む場所」がずれる。
 *
 * 参照で運ぶ型は運ぶ姿を置く——文字列は `{ptr, len}` の 16 byte で、`ptr` は
 * `.rodata` の中身を指すラベルである（`layout.js` の `slotCellSize` がそう数えている）。
 */
function slotImageLines(slot, value, env, em) {
	const v = unwrap(value);
	// **スロットが構造体なら、その中身も静的に置ける。**
	//
	// 入れ子は `{ptr}` 1本で運ばれる（`passingOf(Struct)` が reference/8）ので、内側を
	// `.rodata` へ置いてそのラベルを指すだけでよい。ここを見ていなかったため、値が全部
	// 定数でも**入れ子というだけでフレームへ組み直していた**——実測で、中置35本の演算子表を
	// 1回引くのに平らなら 3 命令・確保ゼロのところ、入れ子は 995 命令・1696 byte の確保に
	// なっていた。読む側は既に `ldr` 2本で最適なので、高いのは組み直しのほうだった。
	//
	// 内側が置けなければ（実行時に決まる値を含むなら）null を返して、これまで通り
	// フレームへ組む道へ譲る。**置けないことと黙って別の答えを出すことは違う**（原理4）。
	//
	// 畳むのは `internAnonImage`——鍵は内容そのものである。要約（ハッシュ）で畳むと
	// 別物が同じ像を共有する（そちらの注記を参照）。
	if (v && v.type === "block" && slot.type === "Struct" && slot.size === 8) {
		const inner = structImageOf(v, env, em);
		if (!inner) return null;
		return [`	.quad ${em.internAnonImage(inner.body, inner.align)}`];
	}
	if (!v || v.type !== "atom") return null;
	if (v.kind === "number" || v.kind === "address") {
		// **整数として書けるものだけ。** `.quad 2.5` はアセンブラが受け取らない
		// ——浮動小数はまだ出せない（`genExpr` の数リテラルも同じところで断っている）。
		let n;
		try {
			n = BigInt(String(v.value));
		} catch {
			return null;
		}
		if (![1, 2, 4, 8].includes(slot.size)) return null;
		// **その幅に収まる数だけ。** 収まらない数をそのまま書くと、Sign は診断ゼロのまま
		// アセンブルできない `.s` を出す（`.quad 18446744073709551616` を clang が
		// `literal value out of range` で撥ねる）。**止めているのがツールチェーンだけ**という
		// のは名指ししていないのと同じである（原理4）。ここで置くのをやめれば、値を命令へ
		// 組む道へ譲る——そちらは数の幅を自分で見る。
		//
		// 上下界は符号付きと符号無しの合併である。アセンブラは `.quad` に
		// `-2^63` も `2^64-1` も受け取り、どちらも同じ 64 ビットの並びになる。
		const bits = BigInt(slot.size * 8);
		if (n >= 1n << bits || n < -(1n << (bits - 1n))) return null;
		return [`	${dataDirective(slot.size)} ${n}`];
	}
	if (v.kind === "string" || v.kind === "char" || v.kind === "unicode") {
		const cps = codePointsOf(v);
		if (cps === null) return null;
		// `{ptr, len}` で運ぶ幅（16 byte）なら中身を `.rodata` へ置いてラベルを指す。
		// 1文字は符号位置そのもの（スカラー）なので、数と同じ置き方になる。
		if (slot.size === 16) {
			// **空文字列は `{0, 0}` をそのまま置く。** 指す先が無いので `.rodata` の中身は要らず、
			// `genExpr` が式の位置で組むのと同じ2語である（`len = 0` が `__`）。以前はここで
			// 置くのを諦めていたので、空の綴りを1つ持つだけで表全体がフレームへ組み直された
			// ——命令の表の「欄の値が空の綴り」（operator_table.js 冒頭）がそれを踏む。
			if (cps.length === 0) return ["	.quad 0", "	.quad 0"];
			return [`	.quad ${em.intern(cps)}`, `	.quad ${cps.length}`];
		}
		if (cps.length !== 1 || ![1, 2, 4, 8].includes(slot.size)) return null;
		return [`	${dataDirective(slot.size)} ${cps[0]}`];
	}
	return null;
}


/**
 * **構造体を「一つの場所」として書き出す**バイト列。置けなければ null。
 *
 * 並びを決めるのは `layoutOfStruct` であって、ここではない——各スロットを
 * `slot.offset` の位置へ置き、隙間は `.zero` で埋めるだけである。**offset を数え直さ
 * ない**のが肝で、数え直した瞬間に「置いた場所」と `genIndex` が「読む場所」が
 * 別々の答えを持つ（今日のバグはほぼ全部この形だった）。
 *
 * 物理配置は名前のソート順、評価（宣言）順は `slot.ordinal`——`lines[ordinal]` が
 * そのスロットの値である。組み立ての枝（`genExpr` の名前付きスロット）と同じ結び方で
 * なければならない。
 *
 * 置けるのはスロットが全部リテラルに畳めるものだけである。実行時に決まる値があるなら
 * 「一つの場所」を静的には作れないので、これまで通りフレームへ組む道へ返す。
 */
function structImageOf(node, env, em) {
	const n = unwrap(node);
	if (!isStructBlock(n) || n.mergedSlots) return null;
	// **諦めたら、置きかけたものも引き上げる。**
	//
	// スロットは順に見ていくので、途中まで置けて最後の1つで諦めることがある。`em.intern`
	// も `em.internAnonImage` も**呼んだ時点で登録される**ので、そのままだと誰も指さない
	// データが `.rodata` に残る——実測で、実行時の値を1つ混ぜた35本の表が、命令列は
	// 譲る道と1命令も違わないのに 560 byte の死んだ像を積んでいた。裸の機械へ降ろす
	// 言語で、指されないバイトを黙って増やしてはいけない。
	//
	// 巻き戻すのは登録の**数**でよい。Map は挿入順を保つので、境界より後ろを消せば
	// この呼び出しが足したものだけが消える（内側の再帰が足したぶんも含めて）。
	const mark = { rodata: em.rodata.size, named: em.namedData.size, anon: em.anonSeq };
	const rollback = () => {
		for (const k of [...em.rodata.keys()].slice(mark.rodata)) em.rodata.delete(k);
		for (const k of [...em.namedData.keys()].slice(mark.named)) em.namedData.delete(k);
		em.anonSeq = mark.anon;
		return null;
	};
	const lay = layoutOfStruct(n, { target: em.conf.target, charset: em.conf.charset, env });
	const lines = (n.lines || []).map(unwrap);
	// スロットは宣言順の `ordinal` で行と1対1である。1つでも欠けていれば置かない。
	if (!lay || !lay.slots || lay.slots.length !== lines.length) return rollback();
	const body = [];
	let at = 0;
	for (const sl of lay.slots) {
		const line = lines[sl.ordinal];
		if (!isDefineNode(line)) return rollback();
		const piece = slotImageLines(sl, line.right, env, em);
		if (!piece) return rollback();
		// 重なったら置かない。決まらないことは黙って別の答えにせず、道を譲る（原理4）。
		if (sl.offset < at) return rollback();
		if (sl.offset > at) body.push(`	.zero ${sl.offset - at}`);
		body.push(...piece);
		at = sl.offset + sl.size;
	}
	if (lay.size < at) return rollback();
	if (lay.size > at) body.push(`	.zero ${lay.size - at}`);
	return { body, align: lay.align, size: lay.size };
}

/**
 * **構造体の束縛の置き場所（ラベル）。** 無ければ null。
 *
 * スカラーの `bindingLabel` と対になる。`$p` が場所を作り、`p` がそこを読む——2つが
 * 別々に判断すると片方だけ場所を使う形になるので、どちらもここを通す。
 */
function structBindingLabel(name, b, env, em) {
	const img = b && b.valueNode ? structImageOf(b.valueNode, env, em) : null;
	if (!img) return null;
	return { label: em.internBindingImage(bareName(name), img.body, img.align, !!b.addressTaken), size: img.size };
}

/**
 * 番地を取られた**器**の束縛を、1つの置き場所として出す。出せなければ null。
 *
 * `l : [1 2 3]` は普段、使うたびにフレームへ並べ直される——読むだけなら同じ値なので
 * 区別が付かない。だが `$[l ' 0] # 99` が書くなら話が別で、**書いた先と読む先が同じ実体で
 * なければならない**。`.data` へ一度だけ置いて、どの参照も同じ `{ptr, len}` を積む。
 *
 * 出せるのは中身がリテラルの並びに畳める器だけである。実行時に決まる要素があるなら
 * 「1つの場所」を静的には作れないので、名指しして止める側へ回す。
 */
function genLoadListBinding(node, b, env, em) {
	const vn = b && b.valueNode ? unwrap(b.valueNode) : null;
	if (!vn) return null;
	// 余積の連なりを平らな要素の並びへ均す。
	const parts = [];
	const flat = (x) => {
		const u = unwrap(x);
		if (u && u.type === "operation" && COPRODUCT_BUILD_OPS.has(u.name)) {
			flat(u.left);
			flat(u.right);
			return;
		}
		parts.push(u);
	};
	flat(vn);
	if (parts.length < 2) return null;
	const vals = parts.map((p) => (p && p.type === "atom" && (p.kind === "number" || p.kind === "address") ? literalDataText(p) : null));
	if (vals.some((v) => v === null)) return null;
	const el = b.elementType || "Int";
	const m = measure({ atomType: el }, { target: em.conf.target, charset: em.conf.charset });
	if (!m || !m.size) return null;
	const label = em.internBinding(bareName(node.value), vals.join(", "), m.size, true);
	const [po, lo] = pushPair(em);
	if (lo === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
	em.emit(`adrp ${SCRATCH[0]}, ${label}`, `${bareName(node.value)} の場所（番地を取られている）`);
	em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, :lo12:${label}`);
	em.store(SCRATCH[0], po, "ptr");
	em.emit(`mov ${SCRATCH[1]}, #${parts.length}`, "len は要素数");
	em.store(SCRATCH[1], lo, "len");
	return 2;
}

/** 番地を取られた束縛を、その置き場所から読む。出せなければ null。 */
function genLoadBinding(node, b, env, em) {
	// 器か単体かは**束縛の型**が言う。ノード側の幅は識別子には載っていないことがある。
	const asList = genLoadListBinding(node, b, env, em);
	if (asList !== null) return asList;
	// **構造体は名前ごとに一つの場所を持つ。**
	//
	// かつては使うたびにフレームへ組み直していた——`f : s ? s ' foo` に対して
	// `(f p) + (f p) + (f p)` が `sub sp` を3回出し、**同じ名前が3つの別の実体**に
	// なっていた。読むだけなら値が同じなので見えないが、`$p` の指す先も、マージが
	// 書き込む先も「どの実体か」で変わる。運ぶのは `{ptr}` の1本である（`passingOf`）。
	const st = structBindingLabel(node.value, b, env, em);
	if (st) {
		const so = em.push();
		if (so === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		em.emit(`adrp ${SCRATCH[0]}, ${st.label}`, `${bareName(node.value)} の場所（構造体は名前ごとに一つ）`);
		em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, :lo12:${st.label}`);
		em.store(SCRATCH[0], so, "ptr（Struct は形が型にあるので1本）");
		return 1;
	}
	const got = bindingLabel(node.value, b, env, em);
	if (!got) return null;
	const off = em.push();
	if (off === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
	em.emit(`adrp ${SCRATCH[0]}, ${got.label}`, `${bareName(node.value)} の場所を辿る（番地を取られている）`);
	em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, :lo12:${got.label}`);
	// 幅ぶんを1つ読む。束縛は符号ありの数なので、8 byte 未満は符号拡張する。
	const ld =
		got.size === 8 ? `ldr ${SCRATCH[0]}, [${SCRATCH[0]}]`
		: got.size === 4 ? `ldrsw ${SCRATCH[0]}, [${SCRATCH[0]}]`
		: got.size === 2 ? `ldrsh ${SCRATCH[0]}, [${SCRATCH[0]}]`
		: `ldrsb ${SCRATCH[0]}, [${SCRATCH[0]}]`;
	em.emit(ld, `${got.size} byte を読む`);
	em.store(SCRATCH[0], off, bareName(node.value));
	return 1;
}

/**
 * **番地を取られた束縛を、命令へ畳む前に洗い出す。**
 *
 * トップレベルの `名前 : 値` は普段その場で畳んでよい——束縛であって場所ではないので、
 * 値そのものを書けばロードは要らない。だが `$名前` が書かれていれば話が別で、そこには
 * **書き込める場所**がある。畳んだまま読むと、書いた後の読みが古い定数を返す
 * ——`n : 5` / `$n # 99` / `n` が 99 ではなく 5 を返していた（診断も出ずに）。
 *
 * **走査が先に要る理由は順序である。** 場所を作るのは `$名前` を出すときだが、読みは
 * その前に来ることもある（`n` / `$n # 99` / `n`）。書かれた場所が意味を決めるのであって、
 * 行の順序が決めるのではない。だから命令を出す前に一度全部見る。
 */
/**
 * **効果を持つトップレベルの束縛は、畳まずに場所を持つ。**
 *
 * `名前 : 値` は普段その場で畳んでよい——束縛であって場所ではないので、使う所へ値ノードを
 * 出し直せば済む。**ただし値ノードが効果を持つなら、出し直すたびに効果が走る。**
 *
 *     p : 0x40100000 ／ a : @p ／ a + a + a + a + a
 *     読みが 5 回出る（1回使えば 1 回）——**使うたびに世界を観測し直している**
 *
 *     rd : q ? @q ／ a : rd p ／ a + a + a
 *     `bl` が使用回数ぶん増える（関数の向こうに隠れているだけで、同じ壊れ方）
 *
 * `名前 : @p` は bind であって代入ではない。モナドの左単位則 `return a >>= f ≡ f a` は
 * **効果がちょうど1回**であることを要求するので、これはその違反である。同じ形でも
 * デフォルト引数（`f : / p / s : @p / ? …`）は最初から1回で、そちらは正しい
 * ——**同じ「束縛」という事実が、置かれた場所で2通りに決まっていた**。
 *
 * 定義の行は `_.main` で既に値を出している（`isDefineNode(node) ? node.right : node`）
 * ので、**捨てずに場所へ書けば済む**。使う側はその場所を読む（`genLoadBinding`）。
 *
 * **走査が先に要る理由は順序である。** 関数定義のほうが先に出るので、本体の中の `a` は
 * トップレベルの行を見る前に解決される。印はここで先に付ける（`markAddressTaken` と同じ）。
 *
 * 対象は**1本で運ぶ値だけ**に絞る。器（`{ptr, len}`）や構造体は畳み方そのものが別で、
 * そちらは `addressTaken` / `isStructBlock` の道が既に持っている。
 */
function marksRunOnce(v) {
	let found = false;
	const seen = new Set();
	const walk = (n) => {
		if (!n || typeof n !== "object" || found || seen.has(n)) return;
		seen.add(n);
		// `@`/`#` は世界を触る。適用は、その先で触るかもしれない（呼び先まで辿らずに
		// 「触りうる」で止める——**触らないことを証明できないなら1回に寄せる**ほうが安全で、
		// 誤って1回にしても値は変わらない。誤って何度も走らせるほうは値が変わる）。
		if (n.type === "operation" && (n.name === "input" || n.name === "output" || n.name === "apply")) {
			found = true;
			return;
		}
		for (const k of ["left", "right", "operand"]) walk(n[k]);
		for (const k of ["elements", "lines", "args"]) if (Array.isArray(n[k])) n[k].forEach(walk);
	};
	walk(v);
	return found;
}

function markRunOnceBindings(nodes, env) {
	if (!env) return;
	for (const node of nodes) {
		if (!isDefineNode(node) || !isIdentifierNode(unwrap(node.left))) continue;
		const b = envLookup(env, unwrap(node.left).value);
		if (!b) continue;
		const v = unwrap(node.right);
		// 関数定義は畳むのが正しい（畳み込みが呼び出しそのものである）。
		if (!v || v.type === "lambda" || v.type === "block") continue;
		// 1本で運ぶ値だけ。器・構造体は別の道が持っている。
		if (b.atomType === "String" || b.atomType === "List" || b.atomType === "Struct") continue;
		if (marksRunOnce(v)) b.runsOnce = true;
	}
}

function markAddressTaken(nodes, env) {
	if (!env) return;
	const seen = new Set();
	const visit = (n) => {
		if (!n || typeof n !== "object" || seen.has(n)) return;
		seen.add(n);
		if (n.type === "operation" && n.position === "prefix" && n.name === "address") {
			// **添字の根まで辿る。** `$[l ' 0]` は `l` の要素の場所であり、それが在るには
			// `l` 自身が場所を持っていなければならない——器が使うたびに組み直されると、
			// 書いた先と読む先が別の実体になる。
			let t = unwrap(n.operand);
			while (t && t.type === "operation" && t.name === "get_prop") t = unwrap(t.left);
			if (isIdentifierNode(t)) {
				const b = envLookup(env, t.value);
				if (b) b.addressTaken = true;
			}
		}
		// **マージの左辺にも場所が要る。** `a~ b~` は「a の器に b の器の中を入れる」で
		// あり、結果は a そのもの——**書き先が a の器**である。左が名前ならその器は既に
		// 在るものなので上書きになり、書ける場所を持っていなければならない。使うたびに
		// 組み直される実体では、書いた先と後で読む先が別になる（`$` の対象・ブラケット
		// 仮引数と同じ理由で、印を付ける場所も同じここである）。
		//
		// **形を見分けるのは `mergeBaseIdentifier` 1箇所である**（layout.js）。同じ形を
		// 「場所が要る」と「場所の大きさが要る」の2箇所で別々に判定すると、片方だけが
		// 広い／狭いという形で必ず食い違う。
		{
			const t = mergeBaseIdentifier(n);
			const b = t ? envLookup(env, t.value) : null;
			if (b) b.addressTaken = true;
		}
		// **ブラケット仮引数へ渡した束縛にも場所が要る。** カッコは参照を取るという意味
		// なので（C の `f(&x)`）、呼び先はそこへ書ける。呼ぶ側が呼び出しごとに組み直すと、
		// 書いた先と後で読む先が別の実体になる——`f : [~o] ? $[o ' 0] # 99` を通した後に
		// `l ' 0` が 1 を返していた。
		if (n.type === "operation" && n.name === "apply") {
			const args = [];
			let head = n;
			while (head && head.type === "operation" && head.name === "apply") {
				args.unshift(unwrap(head.right));
				head = unwrap(head.left);
			}
			//
			// 判定は束縛の `restParam` で行う（Pass 1a が仮引数の形から記録している）。
			// どの位置がブラケットかまでは持っていないので、**識別子の実引数を一律に
			// 印す**——余分に印しても「場所を1つ持つ」だけで意味は変わらず、足りないと
			// 黙って違う値になる。安全側はこちらである。
			if (isIdentifierNode(head)) {
				const cb = envLookup(env, head.value);
				if (cb && cb.restParam === "bracket") {
					for (const a of args) {
						if (!isIdentifierNode(a)) continue;
						const ab = envLookup(env, a.value);
						if (ab) ab.addressTaken = true;
					}
				}
			}
		}
		for (const k of ["left", "right", "operand"]) visit(n[k]);
		for (const l of n.lines || []) visit(l);
		for (const e of n.entries || []) visit(e.default);
	};
	for (const n of nodes) visit(n);
}


/**
 * **中身が定数だけの構造体は、実行時に存在しなくてよい。**
 *
 * MMIO のレジスタ束はこの形をしている——`uart : / CR : 0x9000000 / DR : 0x9000004` は
 * 「配置の記述」であって「値の確保」ではない。フィールドを名前で引いた結果は**その番地
 * そのもの**なので、畳んでしまえば構造体はどこにも置かれない。`n : 5` を `mov x9, #5` へ
 * 畳むのと同じ話である。
 *
 * これが効くと**構造体で書いたレジスタ束が layer 0 で使える**。確保が起きないので、
 * 「Struct は単一の alloca で確保する」（stack_abi.md §7.1）に当たらない——確保が要るのは
 * 値として作るときであって、定数の記述はその手前で消える。
 *
 * @returns 畳めるならフィールドの値ノード。畳めなければ null。
 */
/** その定義は「全行が `名前 : 定数`」の構造体か（＝命令を持たない配置の記述）。 */
function constStructDefine(node) {
	const v = node && node.right ? unwrap(node.right) : null;
	// フィールドが1つでも配置の記述である（`uart : / DR : 0x9000000` は普通に書く形）。
	// 型が `Struct` と決まっているかは Pass 3 が言うので、ここは形だけを見る。
	if (!v || !Array.isArray(v.lines) || v.lines.length < 1) return false;
	return v.lines.every((line) => {
		const l = unwrap(line);
		if (!isDefineNode(l) || !isSlotKeyAtom(l.left)) return false;
		const val = unwrap(l.right);
		return !!val && val.type === "atom" && (val.kind === "number" || val.kind === "address");
	});
}

// niche（`__`）の実体。**番地としては決して有効でない値**であり、`#` / 前置 `@` の
// 全域性はこの1つの値を避けることでできている。
const NICHE_VALUE = 0x8000000000000000n;

/**
 * **書けない値は書かない**（`#` の出口）。
 *
 * 2つある。
 *
 *   `__`          仕様は「何もしないがアドレス値は返ってくる」（operator_table.md の
 *                 `#` 中置行）。書き込んでいたので、`p # __` がメモリを niche で
 *                 潰していた。
 *   charset の外   `Char` は符号位置なので、charset が受け取れない値は**文字として
 *                 書き出せない**。ascii なら 0x7F まで、utf32 なら 0x10FFFF まで
 *                 ——かつ**サロゲート（D800–DFFF）は単独では文字ではない**。
 *
 * **算術ではなく出口で見る。** 値としての `Char` は Int と同じもので、違うのは
 * 書き出すときだけである。算術の途中で見ると、(1) 判定が半端になり（上限しか見て
 * いなかったのでサロゲートが通っていた）、(2) `__` を「誤りの印」として使うことに
 * なり、(3) 演算のたびに払う。出口なら1回で、完全に、要るときだけ見られる。
 *
 * **要るときだけ出す。** 値が `__` になり得ないと構文で分かるなら前者は要らず、
 * `Char` でないなら後者も要らない——MMIO の書き込み（`0x9000000 # 72`）はどちらも
 * 当たらないので、命令は1つも増えない。
 *
 * @returns 門を出したか（出したなら呼ぶ側が `skip` のラベルを置く）
 */
function emitWritableGuard(em, valReg, node, env, skip, scope) {
	let guarded = false;
	if (valReg !== "xzr" && !cannotBeUnit(node, env, scope)) {
		em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
		em.emit(`cmp ${valReg}, x12`, "書く値が __ か");
		em.emit(`b.eq ${skip}`, "__ は書かない（何も起きない）");
		guarded = true;
	}
	if (node && node.atomType === "Char") {
		emitImm(em, "x13", charLimitOf(em.conf.charset), `charset の上限（${em.conf.charset || DEFAULT_CHARSET}）`);
		em.emit(`cmp ${valReg}, x13`);
		em.emit(`b.hi ${skip}`, "charset の外は書かない");
		if (charSizeOf(em.conf.charset) > 1) {
			emitImm(em, "x13", 0xd800, "サロゲートの下端");
			em.emit(`sub x13, ${valReg}, x13`);
			em.emit("cmp x13, #0x7ff");
			em.emit(`b.ls ${skip}`, "サロゲートは単独では文字ではない");
		}
		guarded = true;
	}
	return guarded;
}

// **これは `__` そのものを書いたリテラルか。**
//
// 書き方が2つある。`__` と、`0u0000` である——U+0000 は Char の符号位置範囲から除外
// された唯一の点で、そのビットパターンが niche に充てられている
// （value_representation.md §3）。**同じ値の別の綴り**なので、片方だけ知っている場所が
// あると食い違う（`\|\|1 0u0000 3\|\|` が 3、`0u0000 + 5` が niche+5 になっていた）。
function isUnitAtom(node) {
	const n = unwrap(node);
	if (!n || n.type !== "atom") return false;
	if (n.kind === "unit") return true;
	if (n.kind !== "unicode") return false;
	const cps = codePointsOf(n);
	return !!cps && cps.length === 0;
}

// **その式が `__` になり得ないと、構文だけで分かるか。**
//
// 分かるなら完全性公理の検査を出さなくてよい——boot で「番地が定数なら全域性はタダ」
// だったのと同じことが、演算子の側でも成り立つ。ここは**構文だけ**で答える：型が
// `Int` でも実行時の値は `__` になり得るので、型は答えにならない。
//
// リテラルは `__` ではない。算術の結果は、両辺が `__` でなければ `__` ではない
// ——公理自身がそう言っている（`__` の辺は、相手の値で埋まるか、番地なら `__` のまま運ぶ）。
// ただし `Char` は別で、charset の外へ出た結果は `__` になる。除算も別で、0 で
// 割った結果をここでは決めていない。`Address` も別で、溢れた加減算は `__` になる
// （`emitAddressCarry`）——ここで「`__` になり得ない」と答えると、次の演算が公理の検査を
// 省き、niche を番地として足してしまう。溢れの検査がそのまま無駄になる。
//
// **`Int` は別にしない。これは嘘を承知で選んでいる。** `Int` の和・差・積も回った先がちょうど
// niche なら `__` だが（integer_overflow.md §1.2）、それは溢れた `Int` の話で致命的でないので、
// 検査を払わない（同 §1 の基準）。代わりに、続く算術がその niche を数として足しうる——解釈器と
// 答えが割れる形は同 §1.2 の WARNING が書いている。別にしても実プログラム4本の命令数は
// 変わらなかった（実測）が、算術の連なりには1段ごとに4命令が乗る。
//
// **ただし番地の算術の辺として訊かれたら（`critical`）、嘘をつかない。** niche に落ちた `Int` を
// 番地へ足すと、`__` ではなく別の、正しく見える番地が出る——致命的なので払う
// （integer_overflow.md §1.3）。そのときは算術の結果をすべて「`__` になり得る」と答える。
// 再帰の先（`' 0` / `~` / `@$` の恒等射）も同じ問いなので、`critical` を持ち回る。
//
// **数のリテラルでも、ビットが niche なら `__` である**（integer_overflow.md §1.2）。
// `-9223372036854775808` と `0x8000000000000000` は、`0u0000` と同じく綴りが違うだけの `__`
// であり、置く命令は niche をそのまま作る。
// 溢れて niche（`__`）になりうる `Int` の算術。割り算は溢れない（`MIN / -1` は別の道で断る）。
const OVERFLOWS_TO_NICHE = new Set(["add", "sub", "mul", "pow", "bit_shift_left", "factorial"]);
function cannotBeUnit(node, env, scope, critical = false) {
	const n = unwrap(node);
	if (!n) return false;
	if (isUnitAtom(n)) return false; // `0u0000` は綴りが違うだけの `__` である
	if (n.type === "atom") {
		if (n.kind === "identifier") return !!(scope && scope.total && scope.total.has(n.value));
		if (n.kind === "number" || n.kind === "address" || n.kind === "register") {
			try {
				return literalBits(n) !== BigInt(UNIT_NICHE_ASM);
			} catch {
				return true; // 浮動小数。GPR の niche とは別の話である（負のゼロは正当な値）
			}
		}
		return n.kind === "char" || n.kind === "unicode";
	}
	if (isAsmForm(n, "alu")) {
		// `Unit` と型付けされた算術（番地の `*` は射が無く、`genExpr` が niche を置く）は必ず `__` である。
		// 辺が `__` になり得ないことからは何も言えない——ここを辺で答えると、外の `Int` の算術が
		// niche を数として足していた（`(0x10 * 2) + 1` が解釈器 1、機械 0x8000000000000001）。
		if (critical || n.atomType === "Unit" || n.atomType === "Char" || n.atomType === "Address" || n.name === "div") return false;
		// **`Int` の算術も溢れて `__` になる**（利用者の裁定 2026-09-21）。
		//
		// 上の行は `Unit` と型付けされた算術（番地の射の無い積）を見ていたが、**溢れた `Int` は
		// `Int` のままである**。`Int` の域は `INT64_MIN` を含まない（そのビットが niche）ので、
		// 溢れた結果は `__` であって数ではない。ところが辺を再帰で見ると `max` も `1` も
		// `__` になり得ないので「この辺は `__` にならない」と答え、**外の算術が検査を出さずに
		// niche をそのまま足していた**:
		//
		//   max + 1         解釈 __ ／ 機械 __            ← 1段目は元から一致
		//   (max + 1) + 5   解釈  5 ／ 機械 -9223372036854775803  ← **診断ゼロで割れる**
		//   (max + 1) * 2   解釈  2 ／ 機械 0
		//
		// 直すのは**完全性公理を機械にも出させる**ことであって、`__` を吸収させることではない。
		// 吸収させると `1 + (d rest)` で終端する畳み込みが全部 `__` に潰れる（実測：`preprocess.sn`
		// が 88/88 → 38/88）。利用者：「**`||rest|| = 0 : x` という match_case を書くのは滑稽**」
		// ——基底は公理が与えるものであって、手で書き直すものではない。
		//
		// 代価はコーパス全体で **+2 命令**。検査が出るのは「溢れうる算術を辺に持つ所」だけで、
		// 素の `Int + Int` は今までどおり `add` 1命令である（`critical か否かで検査を払う`）。
		if (n.atomType === "Int" && OVERFLOWS_TO_NICHE.has(n.name)) return false;
		return cannotBeUnit(n.left, env, scope) && cannotBeUnit(n.right, env, scope);
	}
	// **スカラーへの `' 0` は恒等射である**（`[x] ≅ x`——スカラーは1要素の器として引ける）。
	//
	// 値を出す道は左辺をそのまま返すので、「`__` になり得るか」も左辺と同じでなければ
	// ならない。片方だけが知っていると、**同じものが綴りによって違う命令数になる**
	// ——`(n ' 0) + 1` が 16 命令、`n + 1` が 13 命令、というふうに
	// （`isomorphism.test.js` が見ているのはその性質である）。
	//
	// 添字が 0 のときだけである。器の範囲外は `__` であり（`[5] ' 9` は `__`）、
	// スカラーも1要素の器なので同じ規則に従う。
	if (n.type === "operation" && n.name === "get_prop") {
		const i = unwrap(n.right);
		const zero = !!i && i.kind === "number" && literalValue(i) === 0n;
		const lt = n.left && unwrap(n.left) ? unwrap(n.left).atomType : null;
		if (zero && SCALAR_ATOM_TYPES.has(lt)) return cannotBeUnit(n.left, env, scope, critical);
	}
	// **後置 `~`（撒く）はスカラーでは恒等射である。** 出す側も 0 命令で素通ししている
	// （`genExpr` の `expand` の枝）ので、ここも同じ答えでなければならない。
	if (n.type === "operation" && n.position === "postfix" && n.name === "expand" && n.operand) {
		if (SCALAR_ATOM_TYPES.has(unwrap(n.operand) ? unwrap(n.operand).atomType : null))
			return cannotBeUnit(n.operand, env, scope, critical);
	}
	// **`@$名前` も恒等射である。** 仮引数の番地を作って読み直しても、束縛の値そのもの
	// にしかならない——出す側は 10 命令を 0 に畳んでいる（`genExpr` の `input` の枝）。
	// 条件はそちらと**同じもの**でなければならない：`$` の対象が仮引数の名前であること。
	if (n.type === "operation" && n.position === "prefix" && n.name === "input" && n.operand) {
		const src = unwrap(n.operand);
		if (src && src.type === "operation" && src.position === "prefix" && src.name === "address") {
			const named = unwrap(src.operand);
			if (isIdentifierNode(named) && scope && scope.params && scope.params.indexOf(named.value) >= 0)
				return cannotBeUnit(named, env, scope, critical);
		}
	}
	return false;
}

// レジスタ1本で運ばれる型。器（`List` / `String` / `Struct` / `Iterator` / `Implicit`）は
// 入っていない——そちらは `' 0` が本当に要素を引く操作であり、恒等射ではない。
const SCALAR_ATOM_TYPES = new Set(["Int", "Char", "Address", "Float"]);

// **その番地はコンパイル時に決まるか。** 決まるなら値（BigInt）、決まらないなら null。
//
// これがあると `#` と前置 `@` の niche 検査が畳める——検査の中身は「niche か否か」
// でしかないので、番地が分かっていれば答えも分かっている。MMIO の書き込みは全部この形
// （`0x9000000 # 72`、レジスタ束のフィールド、定数へ束縛した名前）なので、boot コードは
// 丸ごとこの道に乗る。
//
// **全域性はタダになる。** 番地が分からないときだけ実行時に払う。
function constAddressOf(node, env) {
	const n = unwrap(node);
	if (!n) return null;
	const lit = literalValue;
	const direct = lit(n);
	if (direct !== null) return direct;
	// レジスタ束のフィールド（`DR @ uart` / `uart ' DR`）。畳んだ先が定数なら同じこと。
	const field = constStructField(n, env);
	if (field) return lit(field);
	// 定数へ束縛した名前（`base : 0x9000000` の `base`）。
	if (isIdentifierNode(n) && env) {
		const b = envLookup(env, n.value);
		const v = b && b.valueNode ? unwrap(b.valueNode) : null;
		if (v && v !== n) return lit(v);
	}
	return null;
}

/**
 * 名前で引く形の鍵を、綴りとして取り出す。**`obj ' k~` は `k` の中身を名前として使う**
 * （Pass 2 が残した `desugaredFrom: "index-rest"` の印で見分ける）。`k` が定数の文字列へ
 * 束縛されていれば、その綴りがそのまま名前になるので、静的に畳める。
 * 実行時に決まる鍵は畳めない——そこは null を返して呼び出し側の判断へ渡す。
 */
// スロット名の綴りから区切りを剥がす＝`slotName` は layout.js の `bareName`
// （冒頭で別名 import）。同じ規則でなければならない——名前付きスロットの物理配置は
// 名前順で決まるので、片方だけ区切りを残すと「レイアウトが言う場所」と
// 「pass4 が探す名前」がずれる。

function slotKeySpelling(key, env) {
	if (isSlotKeyAtom(key)) return slotName(key.value);
	if (key && key.desugaredFrom === "index-rest" && env) {
		const inner = unwrap(key.left);
		if (isSlotKeyAtom(inner) && inner.kind === "string") return slotName(inner.value);
		if (isIdentifierNode(inner)) {
			const b = envLookup(env, inner.value);
			const v = b && b.valueNode ? unwrap(b.valueNode) : null;
			if (v && v.type === "atom" && v.kind === "string") return slotName(v.value);
		}
	}
	return null;
}

function constStructField(node, env) {
	if (!node || node.type !== "operation" || node.name !== "get_prop") return null;
	const key = unwrap(node.right);
	const spelling = slotKeySpelling(key, env);
	if (spelling === null) return null; // 名前で引く形だけ（添字は別の道）。名前は識別子でも文字列でもよい
	const base = unwrap(node.left);
	if (!isIdentifierNode(base) || !env) return null;
	const b = envLookup(env, base.value);
	// **番地を取られた束縛は畳まない。** そこには場所があり、書き換えられうる——畳むと
	// 書いた後の読みが古い定数を返す。スカラーの `$n # 99` で開いていたのと同じ穴が、
	// 構造体が場所を持てるようになった途端にこちらにも開く（マージの左辺が書き先である）。
	if (b && b.addressTaken) return null;
	const v = b && b.valueNode ? unwrap(b.valueNode) : null;
	if (!v || !Array.isArray(v.lines)) return null;
	for (const line of v.lines) {
		const l = unwrap(line);
		if (!isDefineNode(l) || !isSlotKeyAtom(l.left)) return null; // 全行が `名前 : 値` でなければ構造体ではない
		if (slotName(l.left.value) !== spelling) continue;
		const val = unwrap(l.right);
		// 定数だけ畳む。式なら実行時に決まるので、そこは通常の道へ返す。
		return val && val.type === "atom" && (val.kind === "number" || val.kind === "address") ? val : null;
	}
	return null;
}

/**
 * **スロット1つを読む命令。** 幅と符号でニーモニックが変わる（1/2/4/8 byte）。
 *
 * 入口の `fields` 分解と `genIndex` の両方がここを通る——**2箇所で同じものを計算すると
 * 必ずズレる**。実際ズレていて、連番添字の道は幅を見ずに常に `ldr`（8 byte）を出して
 * いたので、1 byte のスロットを読むと隣のスロットまで巻き込んでいた。
 */
function slotLoadInsn(slot, dst, base, off) {
	const sg = SIGNEDNESS[slot.type] === "signed";
	const w = dst.replace(/^x/, "w");
	const at = `[${base}, #${off}]`;
	if (slot.size === 1) return `${sg ? "ldrsb" : "ldrb"} ${sg ? dst : w}, ${at}`;
	if (slot.size === 2) return `${sg ? "ldrsh" : "ldrh"} ${sg ? dst : w}, ${at}`;
	if (slot.size === 4) return `${sg ? "ldrsw" : "ldr"} ${sg ? dst : w}, ${at}`;
	return `ldr ${dst}, ${at}`;
}

/**
 * **スロット1つを書く命令。** `slotLoadInsn` の対である。
 *
 * 読む側は幅でニーモニックを選んでいたのに、**書く側にはこれが無かった**——器を組む
 * 3か所（名前付き・連番・撒くマージ）はどれも「レジスタ何本か」の粒度で `str`（8 byte）
 * を出し、`slot.size` を一度も見ていない。1 byte のスロットが2つ隣り合う器
 * （`[ a : `x` / b : `y` ]`）は offset 0 と 1 へ8バイトずつ書くので、2本目が境界を跨ぐ
 * ——MMU を立てない実機（qemu/start.s）では Device-nGnRnE なのでフォールトし、例外
 * ベクタも無いので**止まる**。診断はゼロだった。
 *
 * 同じ器を定数として `.rodata` へ置く道（`slotImageLines`）は `slot.size` を見ているので
 * 正しく通る——**同じ器が、定数なら動いて実行時に組むと止まる**という形で出ていた。
 * `slotLoadInsn` の説明が自分で「2箇所で同じものを計算すると必ずズレる」と書いている、
 * その8度目である。
 */
function slotStoreInsn(size, src, base, off) {
	return storeElem(src, base, off, size >= 8 ? 8 : size);
}

/**
 * **スロット1つぶんを書き出す。** 値は `words` 本のレジスタとしてスロットに積まれている。
 *
 * 幅が合わなければ黙って詰めない（原理4）——合わないときは並びのどちらかが違うものを
 * 見ており、詰めれば隣を踏む。撒くマージ（`ss.size !== sl.size`）が既に持っている検査を、
 * 出す側にも置く。
 */
function emitSlotWrite(em, n, slot, valueSlots, atSlot, dst, label) {
	const words = Math.ceil(slot.size / 8);
	if (valueSlots !== words) {
		return em.fail(n, `スロット ${slot.name ?? slot.ordinal} の幅が合いません（値は ${valueSlots} 本、スロットは ${slot.size} byte）`);
	}
	for (let r = 0; r < words; r++) {
		em.load(SCRATCH[0], (atSlot + r) * 8);
		em.emit(slotStoreInsn(slot.size - r * 8, SCRATCH[0], dst, slot.offset + r * 8), r === 0 ? label : undefined);
	}
	return true;
}

/**
 * **仮引数として受けた構造体の並び。** 仮引数そのものには値が無いので `layoutOfStruct`
 * は並びを起こせない——起こせるのは呼び出しサイトの実引数だけである。Pass 3 がそこから
 * 起こした並びを束縛へ置いてあるので（`binding.shape`）、名前で引くときはそこを見る。
 */
function bindingShapeOf(node, env) {
	if (!isIdentifierNode(node) || !env) return null;
	const b = envLookup(env, node.value);
	const sh = b && b.shape;
	return sh && sh.slotKind === "named" && Array.isArray(sh.slots) ? sh : null;
}

/**
 * **構造体を返す式の並び。**
 *
 * 3通りある。リテラル（や名前を経由したリテラル）なら `layoutOfStruct` が起こす。
 * 仮引数なら値ノードが無いので起こせず、呼び出しサイトから起こしたものを Pass 3 が
 * 束縛へ置いてある（`binding.shape`）。そして `x ' k` のように**別の構造体から取り出した
 * もの**なら、その並びは x の並びの中のスロットが持っている（`slot.shape`）。
 *
 * 3つとも「この式が返す構造体はどこに何を持つか」という同じ問いなので、入口を1つに
 * まとめる。別々に書くと、辿れる書き方と辿れない書き方が並ぶ——実際そうなっていて、
 * `[foo bar ~o] ? foo` は通るのに `s ? s ' foo` が通らない、という非対称が残っていた。
 */
function structShapeOf(node, env, conf, depth = 0) {
	const u = unwrap(node);
	if (!u || depth > 8) return null;
	// **Pass 3 が決めた並びを先に読む。** `layoutOfStruct` は与えられた `conf.env` で
	// 名前を引くので、**呼び先の本体をここで起こすと外側のスコープで起こすことになる**
	// ——`wrap : s ? [ x : 1 / inner : s ]` の `s` は外側に無いので `inner` の内側の並び
	// だけが黙って落ちる。名前も鍵も揃った「もっともらしい並び」が返るので、`w ' inner`
	// までは通って `(w ' inner) ' a` で初めて折れていた。
	//
	// 同じ問いを2箇所が別々のスコープで答えていた形である。**答えを持っているのは
	// Pass 3**（呼び出しサイトとラムダのスコープの両方を見ている）なので、ここは引くだけ
	// にして、起こすのは最後の手段に回す。
	const bound = bindingShapeOf(u, env);
	if (bound) return bound;
	// 名前が式に束縛されているなら、その式へ降りる（`w : wrap p` の `w`）。
	if (isIdentifierNode(u) && env) {
		const b = envLookup(env, u.value);
		const vn = b && b.valueNode ? unwrap(b.valueNode) : null;
		if (vn && vn !== u) {
			const via = structShapeOf(vn, env, conf, depth + 1);
			if (via) return via;
		}
	}
	// **呼び出しの結果も構造体でありうる。** `f (mk 7)` のように関数の返す器をそのまま
	// 渡す形は、AST を組む書き方そのものである（`ev (bin 1 (num 3) (num 4))`）。返す形は
	// 呼び先の本体が決めているので、そこから引く——本体が仮引数のことがある（`id : s ? s`）
	// ので、`layoutOfStruct` を直に当てず**同じ入口を再帰で呼ぶ**。
	if (u.type === "operation" && (u.name === "apply" || u.name === "partial_apply") && env) {
		let base = u;
		while (base && base.type === "operation" && (base.name === "apply" || base.name === "partial_apply")) base = unwrap(base.left);
		// 返す並びは Pass 3 が束縛へ置いてある（`returnShape`）。**束縛には `valueNode` が
		// 無い**——ラムダは畳む値ではないので、ここから本体へ辿り着く道は無い。
		if (isIdentifierNode(base)) {
			const fb = envLookup(env, base.value);
			if (fb && fb.returnShape && fb.returnShape.slotKind === "named") return fb.returnShape;
		}
	}
	if (u.type === "operation" && u.name === "get_prop") {
		// 器の要素を引いた形（`l ' 0`）。要素はどれも同じ形なので、添字が何であれ
		// 並びは同じ——添字が実行時に決まっても構わない、というのがここの違いである。
		const bl = unwrap(u.left);
		if (bl && (bl.atomType === "List" || bl.atomType === "Iterator")) {
			// **添字がリテラルなら、要素の形が揃っている必要は無い。** どれを引くかが静的に
			// 書かれているので、他の要素がどんな形でも関係が無い——演算子表がこの形で、
			// 段ごとに綴り（鍵）が違うため形は揃わないが、段は番号で引く。
			// 判定は Pass 3 と同じ関数（`itemShapeOfListAt`）に置いてある。
			const ik = constAddressOf(u.right, env);
			if (ik !== null && ik >= 0n) {
				const at = itemShapeOfListAt(bl, conf, Number(ik));
				if (at && at.slotKind === "named") return at;
			}
			const direct = elementShapeOfList(bl, conf);
			if (direct) return direct;
			// 仮引数として受けた器には値ノードが無い。呼び出しサイトから起こしたものが束縛に在る。
			if (isIdentifierNode(bl) && env) {
				const eb = envLookup(env, bl.value);
				if (eb && eb.elementShape && eb.elementShape.slotKind === "named") return eb.elementShape;
			}
			return null;
		}
		// **連番スロットの中の形も引ける。** 下の分岐は連番（`ordinal`）でも名前でも辿るので、
		// ここで名前付きに限る理由が無い——限っていたため、直積で並べた器
		// （`by_precedence : tier1 , tier2 , …`）から取り出した要素の形が出ず、
		// `(by_precedence ' 1) ' \`:\`` が「まだ出せない式です（get_prop）」で止まっていた。
		// Pass 3 の `structShapeOfNode` にも同じ緩和が要る（片方だけだと型か命令のどちらかが欠ける）。
		const base = structShapeOf(u.left, env, conf, depth + 1);
		if (!base || !Array.isArray(base.slots)) return null;
		const si = constAddressOf(u.right, env);
		let slot = null;
		if (si !== null && si >= 0n) {
			// 連番は宣言順（stack_abi.md §7.1）——引く側と同じ規則で辿る。
			slot = base.slots.find((sl) => sl.ordinal === Number(si));
		} else {
			const spell = slotKeySpelling(unwrap(u.right), env);
			if (spell !== null) slot = base.slots.find((sl) => sl.name === spell);
		}
		if (slot && slot.shape) return slot.shape;
		// **鍵が実行時に決まっても、どのスロットも同じ形なら引いた結果の形は決まる。**
		// `genNameSearch` が「全スロットが同じ幅かつ同じ型」を要求しているのと同じ規準で、
		// あちらが値を、こちらが形を出す。判定は `commonSlotShape`（layout.js）1箇所。
		return commonSlotShape(base);
	}
	// 最後にリテラルを起こす。ここまで来たものは束縛にも呼び先にも答えが無い形である。
	return layoutOfStruct(u, conf) || null;
}

/**
 * **マージの左の器。** `a~ b~` の a、`a~ b~ c~` なら一番左の a である。
 *
 * Pass 3 が `mergeBase`（name / literal / unknown）で**何であるか**は畳んで
 * いるが、**どのノードか**は畳んでいない。書き先にするには節点そのものが要る。
 */
function mergeBaseNode(x) {
	// **形の判定は `mergeBaseIdentifier`（layout.js）1箇所である。** ここがするのは
	// **降りること**だけ——書いた行が2つ以上なら節点が入れ子になる（`p~ [foo : 1 / bar : 2]~`
	// は `concat` の下にもう1段ある）ので、左の端まで降りてから同じ判定を当てる。
	//
	// `markAddressTaken` は木を再帰で歩くので降りる必要が無く、節点ごとに判定を当てれば
	// 足りる。**問いが違う**——あちらは「この節点はマージか」、こちらは「この式全体の
	// 左の端は何か」である。判定を共有しているので、片方だけ広い／狭いにはならない。
	let u = unwrap(x);
	while (u && u.type === "operation" && COPRODUCT_BUILD_OPS.has(u.name)) {
		const t = mergeBaseIdentifier(u);
		if (t) return unwrap(t);
		if (!u.left) break;
		u = unwrap(u.left);
	}
	return null;
}

/**
 * **鍵が実行時にしか決まらないときは、名前を探す。**
 *
 * 名前付きスロットの物理配置は名前順で決まるので、鍵が静的に綴れれば引く場所は 0 命令で
 * 決まる（`p ' x` はオフセット1つ）。決まらないときだけ探す——「決まっていることは実行時に
 * 訊かない」という Sign の一貫した形である。
 *
 * 名前はコンパイル時にオフセットへ解決されて Pass 4 に残らない（type_system.md §2）ので、
 * 探すには名前を**値として**置く必要がある。`.rodata` へ `{名前の場所, 文字数, オフセット}` の
 * 表を1つ出し、共通のループで舐める——スロットごとに展開すると 34 個の表で 400 命令になる。
 *
 * **全スロットが同じ幅でなければ断る。** 引いた結果の型が通る枝で変わることになり、それは
 * 実行時ディスパッチ＝動的型付けである（compiler_pipeline.md §3、Sign は持たない）。
 *
 * @returns 積んだ本数 / 出せないなら null / 診断を出したなら false
 */
function genNameSearch(node, env, em, scope, shape) {
	const slots = shape.slots || [];
	if (slots.length === 0) return null;
	const w = slots[0].size;
	const ty = slots[0].type;
	if (!slots.every((x) => x.size === w && x.type === ty)) {
		return em.fail(node, `鍵が実行時に決まる引き方は、全スロットが同じ幅でなければ出せません（引いた結果の型が枝で変わります）`);
	}
	// **参照で運ぶスロット（`{ptr, len}` の 16 byte）も同じ探し方で引ける。** 名前の表が指すのは
	// スロットの先頭なので、見つかったら 2 語を読むだけでよい。演算子表の命令の欄（`asm_…`）は
	// 全部が文字列で揃っているので、型が欄を選ぶ引き方（`(表 ' 綴り~) ' 欄~`）がこの道に乗る。
	const regs = w <= 8 ? 1 : w === 16 && slotsOf(ty, em.conf) === 2 ? 2 : null;
	if (regs === null) return em.fail(node, "鍵が実行時に決まる引き方は、参照で運ぶスロットではまだ出せません");
	// 鍵は `obj ' k~` の `k`。`~` は添字の糖衣として畳まれているので、その左辺が鍵である。
	let key = unwrap(node.right);
	if (key && key.desugaredFrom === "index-rest") key = unwrap(key.left);
	if (!key) return null;
	// 器の ptr（1本）を積む。
	const bw = genScalar(node.left, env, em, scope, "積は {ptr} の1本で運びます");
	if (bw === false) return false;
	const objOff = (em.slot - 1) * 8;
	// 鍵を `{ptr, len}` にする。1文字なら確保ゼロで広げられる。
	const kb = genBoxOperand(key, env, em, scope);
	if (kb === false) return false;
	if (kb === null) return em.fail(node, `鍵を長さ1の器へ広げられません（${key.atomType}）`);
	const kPtr = (em.slot - 2) * 8;
	const kLen = (em.slot - 1) * 8;
	// 名前の表。`{名前の場所, 文字数, スロットのオフセット}` を1組 24 byte で並べる。
	const cw = charSizeOf(em.conf.charset);
	const body = [];
	for (const sl of slots) {
		const cps = [...String(sl.name)].map((c) => c.codePointAt(0));
		body.push(`	.quad ${em.intern(cps)}`, `	.quad ${cps.length}`, `	.quad ${sl.offset}`);
	}
	const tab = em.internBindingImage(`nametab_${slots.map((x) => x.name).join("_")}_${w}`, body, 8);
	const loop = em.newLabel("nsloop");
	const next = em.newLabel("nsnext");
	const byte = em.newLabel("nsbyte");
	const hit = em.newLabel("nshit");
	const miss = em.newLabel("nsmiss");
	const end = em.newLabel("nsend");
	em.emit(`adrp x9, ${tab}`, "名前の表（鍵が実行時に決まるので探す）");
	em.emit(`add x9, x9, :lo12:${tab}`);
	em.emit(`mov x11, #${slots.length * 24}`);
	em.emit("add x11, x9, x11", "表の終わり");
	em.label(loop);
	em.emit("cmp x9, x11");
	em.emit(`b.ge ${miss}`, "最後まで見つからなければ __");
	em.emit("ldr x14, [x9, #8]", "この名前の文字数");
	em.load("x10", kLen, "鍵の文字数");
	em.emit("cmp x14, x10");
	em.emit(`b.ne ${next}`, "長さが違えば中身を見るまでもない");
	em.emit("ldr x13, [x9, #0]", "この名前の場所");
	em.load("x12", kPtr, "鍵の場所");
	em.label(byte);
	em.emit(`cbz x14, ${hit}`, "末尾まで一致した");
	em.emit("sub x14, x14, #1");
	em.emit(loadElem("w10", "x13", "x14", cw), `${cw} byte の要素`);
	em.emit(loadElem("w15", "x12", "x14", cw));
	em.emit("cmp w10, w15");
	em.emit(`b.ne ${next}`);
	em.emit(`b ${byte}`);
	em.label(next);
	em.emit("add x9, x9, #24", "次の名前へ");
	em.emit(`b ${loop}`);
	em.label(hit);
	em.emit("ldr x14, [x9, #16]", "そのスロットのオフセット");
	em.load("x10", objOff, "器の ptr");
	if (regs === 2) {
		em.emit("add x10, x10, x14", "スロットの場所");
		em.emit("ldr x11, [x10, #8]", "len");
		em.emit("ldr x10, [x10]", "ptr");
		em.emit(`b ${end}`);
		em.label(miss);
		// 器の `__` は空の器（長さ 0）である（`__ = []`、unit.md）。
		em.emit("mov x10, xzr", "見つからなければ __（空の器）");
		em.emit("mov x11, xzr");
		em.label(end);
		em.pop(3); // 器の ptr と鍵の 2 本
		const [po, lo] = pushPair(em);
		if (lo === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		em.store("x10", po, "引いた値の ptr");
		em.store("x11", lo, "引いた値の len");
		return 2;
	}
	const sg = SIGNEDNESS[ty] === "signed";
	const mn = w === 1 ? (sg ? "ldrsb x10" : "ldrb w10") : w === 2 ? (sg ? "ldrsh x10" : "ldrh w10") : w === 4 ? (sg ? "ldrsw x10" : "ldr w10") : "ldr x10";
	em.emit(`${mn}, [x10, x14]`, `スロットの中身（${w} byte）`);
	em.emit(`b ${end}`);
	em.label(miss);
	em.emit("movz x10, #0x8000, lsl #48", "見つからなければ __");
	em.label(end);
	em.pop(3); // 器の ptr と鍵の 2 本
	const out = em.push();
	if (out === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
	em.store("x10", out, "引いた値");
	return 1;
}

function genIndex(node, env, em, scope) {
	const conf = em.conf;
	// **射は鍵ではない。** 恒等射（`!__`）は機械の上では `0` なので、そのまま通すと
	// `' 0`（先頭）と区別が付かない——`[1 2 3] ' !__` が 1 を、``abc` ' !__` が 97 を返して
	// いた（解釈器は `__`）。`===` を廃止したことでこの構文は役目も失っている。
	if (node.right && node.right.atomType === "Identity") {
		return em.fail(node, "射で器を引くことはできません（'" + node.op + "' の右辺が恒等射です）——鍵は名前・文字列・連番のいずれかで書きます");
	}
	// **定数の構造体は畳む**（レジスタ束はここで消える）。
	const folded = constStructField(node, env);
	if (folded) return genExpr(folded, env, em, scope);
	// **`Struct` のスロットは形が知っている。**
	//
	// 一様な並び（`List`）は「幅 × 添字」で場所が出るが、`Struct` はスロットごとに幅が
	// 違うので**表を引く**（`layoutOfStruct`）。だから添字は定数でなければならない
	// ——実行時に決まる添字ではどのスロットか決まらず、それは `dyn` を持たないという
	// 決定そのものである（compiler_pipeline.md §3）。
	//
	// 運ばれてくるのは `{ptr}` の1本。取り出したスロットは、その型の本数で返る
	// （数なら1本、器なら `{ptr, len}` の2本）。
	{
		const sb = unwrap(node.left);
		// **ポインタ1本で運ばれてくるものだけがこの道である。** `Struct` 型でも運ぶ本数が
		// 1本とは限らない——カーソル（`{arm, k, ptr, len}`）は 4 本である。以前は形が出な
		// かったので素通りしていたが、スロットの幅を `passingOf` で埋めるようにした途端、
		// カーソルがここへ落ちて「1本で運びます」と断られた。前提は明示して確かめる。
		const carried = sb ? slotsOfNode(sb, conf, env) : null;
		const slay = sb && sb.atomType === "Struct" && carried === 1 ? structShapeOf(sb, env, { target: conf.target, charset: conf.charset, env }) : null;
		// 引き方は2つ——連番と名前。**どちらもスロットを1つ決めるだけ**で、読み出しの命令は
		// 同じである。決めるところだけ分けて、出すところは1本にまとめる。
		let slot = null;
		let what = null;
		const si = slay && slay.slots ? constAddressOf(node.right, env) : null;
		if (slay && si !== null && si >= 0n && si < BigInt(slay.slots.length)) {
			// **`p ' N` は宣言順のN番目である**（stack_abi.md §7.1「`uart ' 2` と書いても
			// 「offset 8」の意味にはならない——3番目に**宣言した**フィールドが返る」）。
			// 物理配置は名前順なので `slots` の並びで引くと別のスロットを読む：
			// `foo : 10 / bar : 2.5` では pass3 も解釈器も `p ' 0` を foo（Int）と読むのに、
			// `slots[0]` は offset 0 の bar（Float）である。宣言順は各スロットが `ordinal`
			// として持っているので、名前付きはそれで引く（連番は並びがそのまま宣言順）。
			slot = slay.slotKind === "named" ? slay.slots.find((sl) => sl.ordinal === Number(si)) : slay.slots[Number(si)];
			if (!slot) return em.fail(node, `スロット ${si} が引けません`);
			what = String(si);
		} else if (slay && slay.slotKind === "named") {
			// **名前で引く。** 名前はコンパイル時にオフセットへ解決され、Pass 4 には残らない
			// （type_system.md）。定数の構造体は上の `constStructField` が畳んで消えるので、
			// ここへ来るのは実行時に運ばれてくる構造体——仮引数で受けたものである。
			const spell = slotKeySpelling(unwrap(node.right), env);
			if (spell !== null) {
				slot = (slay.slots || []).find((sl) => sl.name === spell);
				if (!slot) return em.fail(node, `構造体に ${spell} というスロットがありません`);
				what = spell;
			}
		}
		// 静的に綴れる鍵が無いなら、名前を探す（`obj ' k~`）。
		if (!slot && slay && slay.slotKind === "named" && !(si !== null && si >= 0n)) {
			const found = genNameSearch(node, env, em, scope, slay);
			if (found !== null) return found;
		}
		if (slot) {
			const regs = Math.max(1, Math.ceil(slot.size / 8));
			if (!genScalar(node.left, env, em, scope, "Struct は {ptr} の1本で運びます")) return false;
			const bo = (em.slot - 1) * 8;
			em.load(SCRATCH[0], bo, "Struct の ptr");
			em.pop(1);
			const outs = [];
			for (let r = 0; r < regs; r++) {
				const o = em.push();
				if (o === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
				outs.push(o);
			}
			// **`__` は番地ではない。** 器が無ければ引いた結果も `__` である（完全性公理）——
			// ところが `__` は niche（`0x8000_0000_0000_0000`）という**具体的なビット列**なので、
			// 検査せずに `ldr [x9]` を出すと**それを番地として読む**。
			//
			// 実測では、鍵が実行時に決まる引き方で綴りが表に無かったとき（`genNameSearch` が
			// `__` を返す枝）にそのまま field を引き、qemu がフォールトして時間切れになっていた
			// ——診断でも `__` でもなく**クラッシュ**である。パーサは未知の綴りを必ず引くので、
			// ここは通る道である。
			const nul = em.newLabel("nofield");
			const fin = em.newLabel("field");
			em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
			em.emit(`cmp ${SCRATCH[0]}, x12`, "器が __ なら引かない");
			em.emit(`b.eq ${nul}`);
			for (let r = 0; r < regs; r++) {
				em.emit(
					regs === 1 ? slotLoadInsn(slot, SCRATCH[1], SCRATCH[0], slot.offset) : `ldr ${SCRATCH[1]}, [${SCRATCH[0]}, #${slot.offset + r * 8}]`,
					r === 0 ? `スロット ${what}（+${slot.offset}、${slot.type}）` : undefined
				);
				em.store(SCRATCH[1], outs[r]);
			}
			em.emit(`b ${fin}`);
			em.label(nul);
			// 1本で運ぶ値の `__` は niche、2本（`{ptr, len}`）なら `len = 0` である
			// （`genMatch` の「1本なら niche、2本なら len = 0」と同じ規則）。
			for (let r = 0; r < regs; r++) {
				if (regs === 1) em.emit(`mov ${SCRATCH[1]}, x12`, "器が無ければ結果も __");
				else em.emit(`mov ${SCRATCH[1]}, #0`, r === 0 ? "器が無ければ結果も __（len = 0）" : undefined);
				em.store(SCRATCH[1], outs[r]);
			}
			em.label(fin);
			return regs;
		}
	}

	// **カーソルは器でも規則でもない。** 引き方が違うので、先に振り分ける。
	// 括弧は剥ぐ——`(dup s) ' 0` のように括った形が普通である。
	const cbase = unwrap(node.left);
	const cgroup = cbase && cbase.repr === "cursor" ? cursorGroupOf(cbase, env) : null;
	if (cgroup) return genCursorIndex(node, env, em, scope, cgroup, cbase);
	const cw = slotsOfNode(node.left, conf, env);
	const rw = slotsOfNode(node, conf, env);
	// 規則は3本（`{start, step, end}`）まで在る。場所は2本まで。
	if (cw === null || rw === null || cw > 3 || rw > 3) return null;
	// **持ち上げは `~` の仕事であって `$` の仕事ではない。**
	//
	// 前置 `~`（`continuous`）が「連続リスト構築（持ち上げ）」——`~x` が `[x]` である。
	// `$x` は束縛の場所を取るだけで、器としては振る舞わない（剥がせるのは `@` だけ）。
	// 一度この2つを同一視して `($x) ' 0` を通したが、それは `~` の役割を `$` に
	// 押し付けることになり、**生の番地が表へ出る道を開いてしまう**。
	//
	// 番地はプログラムから観測できてはいけない。列の走査はすでに持ち上げ（`~x`）と
	// 持ち下げ（`[x ~xs]` の分解）の対で書けており、**ポインタの加減算は分解の中にしか
	// 存在しない**——実プログラム4本はどれも番地の算術を1度も書いていない。触れない以上、
	// 不正な番地を構成しようがない。速い命令のために開くかどうかは、生成したマシン語が
	// C より速いかを測ってから決める（それまでは閉じておく方が安い）。
	// スライスかどうかは**添字の形**で決まる。`s ' i~` は Pass 2 が `s ' (i ~+ 1)` へ
	// 均しているので（`desugarIndexRest`）、ここで見るのは終端の無い等差レンジである。
	// **括弧は剥ぐ。** `s ' (1 ~+ 1)` のように優先順位のために括った形も同じスライスで
	// ある。pass3 の `sliceIndexNode` は剥いでいたので、型は「部分列」と言うのに命令は
	// 「要素1つ」を出そうとして幅が合わなくなっていた——同じ式について2つのパスが違う
	// ことを言う、いつもの壊れ方である。
	const idx = unwrap(node.right);
	// **切り出しには終端の有る形と無い形がある。**
	//
	//   s ' i~            i から末尾まで（`i ~+ 1` へ均されている）
	//   s ' (i ~+ 1 ~ j)  i から j まで（長さが決まっている）
	//
	// どちらも同じ機械である——頭をずらして長さを決めるだけで、コピーは起きない。
	// 終端の有る形は、入力の連続した位置を切り出すときに出る（`sep` の枝が3文字を
	// 並べているのは、入力のその3文字そのものである）。
	const bounded = !!idx && idx.type === "operation" && idx.name === "range" ? boundedSlice(idx) : null;
	const isSlice = (!!idx && idx.type === "operation" && idx.name === "range_arithmetic") || !!bounded;
	const ruleLeft = isRuleNode(node.left, conf, env);
	if (isSlice) {
		// 歩幅1の切り出しだけを出せる。飛ばし読みは別の命令列になる。ここで見ているのは
		// **添字の歩幅**であって器の歩幅ではない——`[0 ~+ 2] ' 1~` の添字は `1 ~+ 1`
		// （1番目から全部）で、器の歩幅 2 とは別物である。
		if (!bounded) {
			const step = idx.right;
			if (!(step && step.kind === "number" && literalValue(step) === 1n)) return null;
		}
		// 部分列は器と同じ型である——**長さが 1 でも 0 でも**（切り出しは入れ子の段を変えない）。
		// 以前は長さ1のときだけ要素（1本）を許していたが、型と表現が別々に潰れるので、
		// 要素が2本で運ばれる `List(String)` では器の番地を文字として読んでいた。
		if (rw !== cw) return null;
	}

	// **`x ' 0~` は恒等射である。**
	//
	// 0 番目から末尾までは丸ごとであり、器でも規則でも変わらない（`ptr + 0×幅` は `ptr`、
	// `start + 0×step` は `start`）。**添字がリテラルならコンパイル時に決まっている**ので、
	// 命令は1つも要らない——`$__ = __ = @__` が機械語の不動点であるのと同じ形である。
	if (isSlice && !bounded) {
		const st0 = unwrap(idx.left);
		if (st0 && st0.type === "atom" && st0.kind === "number" && Number(st0.value) === 0) {
			const w0 = genExpr(node.left, env, em, scope);
			if (w0 === false) return false;
			if (w0 !== cw) { em.pop(w0); return null; }
			return w0;
		}
	}

	// **規則を切っても規則である。**
	//
	// `{start, step, end}` から i 番目以降を取るのは `{start + i × step, step, end}` で、
	// 要素はどこにも現れない——`[h ~t]` が参照の頭と長さをずらすのと同じ機械が、規則の
	// 側では起点をずらす算術1つになる。切っても向きが動かないのは step が符号を持つから
	// である（`rangeParts` の `signedByEnds`）。
	//
	// これはカーソルを進める操作の原型でもある。`cur ' 1~` が次の状態そのものなので、
	// 状態を持ち回るのに記憶は要らない。
	if (isSlice && ruleLeft && cw >= 2) {
		// **終端の有る切り出しは、起点をずらすだけでは足りない。** 終端も縮めなければならず、
		// その命令はまだ無い——ずらすだけだと `||[0 ~ 9] ' [2 ~ 3]||` が 2 ではなく 8 になる。
		if (bounded) return em.fail(node, "終端の有る切り出しを規則に当てる形はまだ出せません（起点はずらせるが、終端を縮める命令が無い）");
		const cvw0 = genExpr(node.left, env, em, scope);
		if (cvw0 === false) return false;
		if (cvw0 !== cw) { em.pop(cvw0); return null; }
		const co0 = (em.slot - cw) * 8;
		const iw0 = genScalar(idx.left, env, em, scope, "規則の起点はレジスタ1本の値です");
		if (iw0 === false) return false;
		const io0 = (em.slot - 1) * 8;
		em.load(SCRATCH[0], co0, "start");
		em.load(SCRATCH[1], co0 + 8, "step");
		em.load("x11", io0, "起点");
		// 負の起点：終端のある規則は末尾から数え、それでも負なら先頭から（器の `' -9~` と同じ）。
		const neg0 = emitRuleNegativeIndex(cw, co0, idx.left, em);
		if (neg0 && cw >= 3) {
			em.emit("cmp x11, #0");
			em.emit("csel x11, xzr, x11, lt", "それでも負なら先頭から");
		}
		em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
		// 番地の規則なら、ずらした起点も番地の算術である（`emitAddressAffine`）。
		const rule0 = addressRuleOf(node.left, env, scope);
		if (rule0) {
			emitAddressAffine(rule0.step, idx.left, rule0.startMaybeUnit, em);
		} else if (ruleStartMaybeUnit(node.left, env, scope)) {
			// 起点が `__` の規則を切っても `__` である。ずらすと niche が数として回る（niche + niche は 0）。
			em.emit(`madd x13, ${SCRATCH[1]}, x11, ${SCRATCH[0]}`, "start + i × step（ずらすだけ）");
			em.emit(`cmp ${SCRATCH[0]}, x12`, "起点が __ か");
			em.emit(`csel ${SCRATCH[0]}, x12, x13, eq`, "起点が __ なら切った規則も __");
		} else em.emit(`madd ${SCRATCH[0]}, ${SCRATCH[1]}, x11, ${SCRATCH[0]}`, "start + i × step（ずらすだけ）");
		// 終端の無い規則を負の位置から切ることはできない——切った規則は `__`（起点を niche にする）。
		if (neg0 && cw === 2) {
			em.emit("cmp x11, #0");
			em.emit(`csel ${SCRATCH[0]}, x12, ${SCRATCH[0]}, lt`, "終端の無い規則の負の位置は __");
		}
		em.pop(1);
		em.store(SCRATCH[0], co0, "切った先の start");
		return cw;
	}
	// 要素の幅。`String` なら charset 幅、`List(T)` なら T の大きさ。
	//
	// **先に訊くのは「どう運ぶか」である**（`elementCellSize`）。ここが `measure`（中身の
	// 長さ）を直に呼んでいたので、要素が参照で運ばれる器——`List(String)`——では答えが
	// 出ず、`base + i × 幅` を書けないまま「まだ出せない式です」で止まっていた。中身の
	// 長さが型に無いことと、そこに何バイト置かれるかは別の問いである。
	//
	// `measure` と `passingOf` の取り違えは、これで7度目である。
	const elemType = isSlice ? node.elementType || elementTypeOfNode(node.left, env) : node.atomType;
	const elem = elementCellSize(elemType, conf);
	// 要素の幅が要るのは**場所**を引くときだけである（`base + i × sizeof(T)`）。規則は
	// `start + i × step` なので、要素が何バイトかを知らなくても引ける——`step` が既に
	// 要素の単位で書かれているからである。
	if (cw === 2 && !ruleLeft && (!elem || !elem.size)) return null;

	const cvw = genExpr(node.left, env, em, scope);
	if (cvw === false) return false;
	if (cvw !== cw) { em.pop(cvw); return null; }
	const co = (em.slot - cw) * 8;

	// **規則の添字はロードではない。**
	//
	// 置かれているのは `{start, step, end}` だけで要素列はどこにも無いので、n 番目は
	// `start + n × step` という**算術**で出る（type_system.md §2 のアクセス表「添字は
	// 必ずしもロードではない」）。だから無限でも引ける——これがループカウンタを成立させて
	// いる。ここを場所と同じ経路へ流すと、`start` をポインタ・`step` を長さとして読む
	// 命令が出る（実際に出ていた）。
	if (ruleLeft && cw >= 2) {
		const iw2 = genScalar(node.right, env, em, scope, "規則の添字はレジスタ1本の値です");
		if (iw2 === false) return false;
		const io2 = (em.slot - 1) * 8;
		em.load(SCRATCH[0], co, "start");
		em.load(SCRATCH[1], co + 8, "step");
		em.load("x11", io2, "添字");
		const neg2 = emitRuleNegativeIndex(cw, co, node.right, em);
		const rule2 = node.atomType === "Address" ? addressRuleOf(node.left, env, scope, true) : null;
		const startMaybeUnit2 = ruleStartMaybeUnit(node.left, env, scope);
		if (rule2 || neg2 || startMaybeUnit2) em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
		if (rule2) {
			emitAddressAffine(rule2.step, node.right, rule2.startMaybeUnit, em);
		} else if (startMaybeUnit2) {
			// 起点が `__` の規則（切れなかった規則）の要素は `__` である。
			em.emit(`madd x13, ${SCRATCH[1]}, x11, ${SCRATCH[0]}`, "start + n × step（ロードではない）");
			em.emit(`cmp ${SCRATCH[0]}, x12`, "起点が __ か");
			em.emit(`csel ${SCRATCH[0]}, x12, x13, eq`, "起点が __ なら __");
		} else em.emit(`madd ${SCRATCH[0]}, ${SCRATCH[1]}, x11, ${SCRATCH[0]}`, "start + n × step（ロードではない）");
		if (neg2) {
			// 均しても負なら（終端の無い規則はいつも）要素は無い。
			em.emit("cmp x11, #0");
			em.emit(`csel ${SCRATCH[0]}, x12, ${SCRATCH[0]}, lt`, "負の添字の要素は無い——__");
		}
		if (cw >= 3) {
			// 終端があるなら範囲を見る。**向きは歩幅の符号が持つ**——端点の並びを読み直す
			// のではない。切った規則（`[0 ~ 3] ' 5~`）は起点が終端を越えているので、
			// 並びから読むと降順に見えてしまう。
			em.load("x13", co + 16, "end");
			em.load("x14", co + 8, "step");
			em.emit(`cmp ${SCRATCH[0]}, x13`);
			// 番地は符号なしで比べる——上半分の番地を負と読むと、範囲の内と外が入れ替わる。
			em.emit(`cset x15, ${rule2 ? "hi" : "gt"}`, "昇順なら end を越えたら外");
			em.emit(`cset x11, ${rule2 ? "lo" : "lt"}`, "降順なら end を下回ったら外");
			em.emit("cmp x14, #0");
			em.emit("csel x15, x15, x11, ge", "歩幅の符号で選ぶ");
			em.emit("movz x12, #0x8000, lsl #48", "範囲外は __");
			em.emit("cmp x15, #0");
			em.emit(`csel ${SCRATCH[0]}, x12, ${SCRATCH[0]}, ne`);
		}
		em.pop(cw + 1);
		const off2 = em.push();
		if (off2 === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		em.store(SCRATCH[0], off2, "n 番目");
		return 1;
	}
	// **`scalar ' 0` は恒等射である。**
	//
	// 1要素の器とスカラーは同型なので（`[5]` は `Int`、list_model.md）、その 0 番目は
	// 自分自身である。添字がリテラルなら**どちらになるかはコンパイル時に決まっている**
	// ——0 なら器そのもの、それ以外は範囲外で `__`。それでも 0 を積んで 0 と比べて選ぶ
	// 命令を出していた（8命令）。**問いになっていない問いを実行時に訊いていた**ことになる。
	//
	// `$__ = __ = @__` が機械語の不動点であるのと同じ形である：型の上では別のものでも、
	// 機械の上では同じビットでなければならない。

	if (cw === 1 && !isSlice) {
		const lit = unwrap(idx);
		if (lit && lit.kind === "number" && literalValue(lit) !== null) {
			if (literalValue(lit) === 0n) {
				// 器そのもの。命令は1つも要らない。
				return cvw;
			}
			em.pop(cvw);
			const uo = em.push();
			if (uo === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.emit(`movz ${SCRATCH[0]}, #0x8000, lsl #48`, "1要素の器の範囲外は __");
			em.store(SCRATCH[0], uo);
			return 1;
		}
	}
	// 1要素の器を 1 番目から切れば空である。空は `__` そのものなので、幅ぶん置く。
	if (cw === 1 && isSlice && !bounded) {
		const st = unwrap(idx.left);
		if (st && st.kind === "number" && literalValue(st) !== null && literalValue(st) > 0n) {
			em.pop(cvw);
			const uo = em.push();
			if (uo === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.emit(`movz ${SCRATCH[0]}, #0x8000, lsl #48`, "1要素の器を越えて切れば __");
			em.store(SCRATCH[0], uo);
			return 1;
		}
	}

	// 添字そのもの（スライスなら起点）を積む。終端の有る形は起点がリテラルなので直に置く
	// ——`(i ~+ 1)` をそのまま出すと規則（2本）になってしまう。
	let iw;
	if (bounded) {
		const bo = em.push();
		if (bo === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		emitImm(em, SCRATCH[0], bounded.start, "切り出しの起点");
		em.store(SCRATCH[0], bo);
		iw = 1;
	} else {
		iw = genExpr(isSlice ? idx.left : idx, env, em, scope);
	}
	if (iw === false) return false;
	if (iw !== 1) { em.pop(iw + cw); return null; }
	const io = (em.slot - 1) * 8;

	// **負の添字は末尾から数える**（list_cheat_sheet.md「末尾要素の取得 `list ' -1`」
	// ——`[1 2 3] ' -1` は 3）。解釈器は最初からそうしているが、機械の側が見ていなかった。
	//
	// 見ていないと何が起きるか、実測：
	//
	//   l ' (0 - 1)          解釈 30 ／ 機械 __      符号なしの範囲検査で弾かれる
	//   ||l ' (0 - 2)~||     解釈 2  ／ 機械 5       len - (-2) で長さが増える
	//   (l ' (0 - 2)~) ' 0   解釈 20 ／ 機械 0       ptr + (-2)×幅 で**器の手前**を読む
	//
	// 切り出しのほうが重い——`__` ではなく、器の外から読んだ値がもっともらしく返る。
	//
	// **均すのはここ1箇所である。** 以降の枝（要素の読み・切り出し・範囲検査）は非負の
	// 添字だけを見ればよく、同じ規則を枝ごとに書かなくて済む。行き過ぎた負（`l ' -4`）は
	// 均しても負のままなので、既存の符号なし比較がそのまま `__` にする。
	// **静的に非負と分かるなら均さない。** 添字がリテラル（または終端の有る切り出しの起点）
	// なら符号はコンパイル時に決まっている——実プログラムはほとんどこちらで、均しを一律に
	// 出すと lexer.sn が 510 → 599 命令に膨らんだ。決まっていることは実行時に訊かない。
	const staticIdx = bounded ? BigInt(bounded.start) : constAddressOf(isSlice ? idx.left : idx, env);
	const knownNonNegative = staticIdx !== null && staticIdx >= 0n;
	if ((cw === 1 || cw === 2) && !knownNonNegative) {
		const neg = em.newLabel("nonneg");
		em.load(SCRATCH[0], io, "添字");
		em.emit(`cmp ${SCRATCH[0]}, #0`, "負なら末尾から数える");
		em.emit(`b.ge ${neg}`);
		if (cw === 2) em.load(SCRATCH[1], co + 8, "器の長さ");
		else em.emit(`mov ${SCRATCH[1]}, #1`, "スカラーは1要素の器");
		em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}`, "len + i");
		em.store(SCRATCH[0], io, "均した添字");
		em.label(neg);
	}

	if (cw === 1) {
		// **1本で運ばれるからといってスカラーとは限らない。**
		//
		// `Struct` は形が型にあるので `{ptr}` の1本で運ばれる（`passingOf`）。ここを幅だけで
		// 見ると「スカラーは1要素の器」の規則が当たり、**添字が 0 のときだけ器そのもの、
		// それ以外は `__`** という答えを黙って返す。実測では 28 スロットの
		// `by_precedence` に対し、`f : t ? by_precedence ' t` が t=0 で先頭、
		// t=13 で `__` を返していた——解釈器は段14の表を返すのに、診断はゼロだった。
		//
		// 同じ間違いはノルム（`||…||`）側で既に直してある（そちらのコメント：「スカラーも
		// 1本なので、ここを幅だけで見ると…いくつスロットがあっても 1 を返していた」）。
		// 添字の側が取り残されていた。
		//
		// **実行時の添字で `Struct` を引くのは原理的に出せない。** スロットごとに型が違って
		// よいのが直積の意味なので、どの命令を出すか決まらない（Pass 3 の
		// `runtimeIndexProblem` が同じことを言っている）。静的に綴れる添字なら上の
		// `constStructField` が既に畳んでいるので、ここへ来るのは実行時の添字だけである。
		if (structSlots(node.left, em, env) !== null) {
			em.pop(1 + cw);
			return em.fail(
				node,
				`実行時に決まる添字で直積を引くことは出せません（スロットごとに型が違ってよいので、どの命令を出すか決まりません）。` +
					`添字を静的に書くか、名前で引く形（\`obj ' 名前\` / 鍵が実行時なら \`obj ' k~\`）にしてください`
			);
		}
		// **スカラーは1要素の器である。** 0 番目は自分自身、それ以外は範囲外で `__`。
		em.load(SCRATCH[0], io, "添字");
		em.emit(`cmp ${SCRATCH[0]}, #0`);
		em.load(SCRATCH[0], co, "0 番目は器そのもの");
		em.emit("movz x12, #0x8000, lsl #48", "範囲外は __");
		em.emit(`csel ${SCRATCH[0]}, ${SCRATCH[0]}, x12, eq`);
		em.pop(1);
		em.store(SCRATCH[0], co);
		// スライス（`x ' 0~`）の結果も同じ——1要素の器を切っただけである。
		return 1;
	}

	const w = elem.size;
	if (isSlice) {
		// `{ptr + i×幅, len - i}`。**同じ領域を指したまま頭と長さをずらす**——コピー無し。
		em.load(SCRATCH[0], co, "ptr");
		em.load(SCRATCH[1], io, "起点");
		em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}${w === 1 ? "" : `, lsl #${Math.log2(w)}`}`, `${w} byte × 起点`);
		em.store(SCRATCH[0], co, "残りの ptr");
		em.load(SCRATCH[0], co + 8);
		em.emit(`subs ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}`, "残りの長さ");
		// 負にはしない。**尽きたら `len = 0`** であり、それが `__` である。
		em.emit(`csel ${SCRATCH[0]}, ${SCRATCH[0]}, xzr, pl`);
		// 終端が有るなら、そこまでで頭打ちにする。**足りなければ足りないまま**——
		// 器が短ければ短い切り出しになるだけで、範囲外を読むことはない。
		if (bounded) {
			emitImm(em, "x11", bounded.count, `終端まで ${bounded.count} 要素`);
			em.emit(`cmp ${SCRATCH[0]}, x11`);
			em.emit(`csel ${SCRATCH[0]}, ${SCRATCH[0]}, x11, ls`, "短い方を採る");
		}
		em.pop(1);
		em.store(SCRATCH[0], co + 8, "残りの len（0 なら __）");
		return 2;
	}

	// **参照で運ぶ要素は2語である。** `List(String)` の1つは `{ptr, len}` の 16 バイトで
	// あり、`loadElem` は 8 byte で頭打ちなのでそこは通れない。丸ごと引いて2本返す。
	//
	// 範囲外は **`len = 0`** である——器の `__` は niche ではなく長さ0だからで、1本で運ぶ
	// 値（niche）とは表し方が違う（`genMatch` の「1本なら niche、2本なら len = 0」と同じ）。
	if (w === 16) {
		em.load(SCRATCH[1], io, "添字");
		em.load("x11", co + 8, "len");
		em.emit(`cmp ${SCRATCH[1]}, x11`, "範囲内か");
		em.load(SCRATCH[0], co, "ptr");
		em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, ${SCRATCH[1]}, lsl #4`, "16 byte × 添字");
		emitSafeReadAddress(em, SCRATCH[0], SCRATCH[0], "lo");
		em.emit(`ldr x14, [${SCRATCH[0]}]`, "要素の ptr");
		em.emit(`ldr x15, [${SCRATCH[0]}, #8]`, "その len");
		em.emit("mov x12, #0", "範囲外は len = 0（器の __）");
		em.emit("csel x14, x14, x12, lo");
		em.emit("csel x15, x15, x12, lo");
		em.pop(cw + 1);
		const [po16, lo16] = pushPair(em);
		if (lo16 === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		em.store("x14", po16, "要素の ptr");
		em.store("x15", lo16, "その len");
		return 2;
	}

	// 要素1つ。範囲外は `__`（niche）で、器の外は読まない（`emitGuardedElementLoad`）。
	em.load(SCRATCH[1], io, "添字");
	em.load(SCRATCH[0], co + 8, "len");
	em.emit(`cmp ${SCRATCH[1]}, ${SCRATCH[0]}`, "範囲内か");
	em.load(SCRATCH[0], co, "ptr");
	emitGuardedElementLoad(em, "x14", SCRATCH[0], SCRATCH[1], w);
	if (w === 8) {
		// 8 byte なら置き場から読んだ値がそのまま niche である。
		em.emit(`mov ${SCRATCH[0]}, x14`);
	} else {
		em.emit("movz x12, #0x8000, lsl #48", "範囲外は __");
		em.emit(`csel ${SCRATCH[0]}, x14, x12, lo`);
	}
	// 器（cw 本）と添字（1本）を返してから、要素1本を積む。
	em.pop(cw + 1);
	const off = em.push();
	if (off === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
	em.store(SCRATCH[0], off, "要素");
	return 1;
}

/**
 * `head rest` が**同じ分解の組み直し**かを見る。そうなら参照を戻すだけで済む。
 *
 * 順序も見る——`rest c` は「残りのうしろへ頭を足す」であって別の器である。
 */
function rejoinPair(node, scope) {
	if (!scope || !scope.bracketPairs || scope.bracketPairs.length === 0) return null;
	const l = unwrap(node.left);
	let r = unwrap(node.right);
	if (!isIdentifierNode(l)) return null;
	// **撒くかどうかで意味が違う。**
	//
	//   c rest~   撒いて繋ぐ  → 渡された器そのもの（組み直し）
	//   c rest    1要素として足す → `[c, rest]` という**別の器**
	//
	// 器の側に後置 `~` が要るのが仕様である（分解の `[c ~rest]` と対称）。ただし
	// `String` だけは撒かない形もテキスト連結になる（余積族の規則「左辺が String なら
	// テキスト連結」）ので、そこは同じ答えになる。**そこ以外で撒かない形に当てると、
	// 入れ子であるべきものを平らにしてしまう**——List で実際にそうなる。
	const spread = !!r && r.type === "operation" && r.position === "postfix" && r.name === "expand";
	if (spread) r = unwrap(r.operand);
	if (!isIdentifierNode(r)) return null;
	if (!spread && node.atomType !== "String") return null;
	for (const p of scope.bracketPairs) {
		if (l.value === p.head && r.value === p.rest) return p;
	}
	return null;
}

/**
 * 終端の有る切り出し `(i ~+ 1 ~ j)` から `{起点, 長さ}` を取り出す。歩幅1の等差で、
 * 両端がリテラルの形だけを読む——それ以外は長さが実行時に決まるので別の命令列になる。
 */
function boundedSlice(idx) {
	const l = unwrap(idx.left);
	const r = unwrap(idx.right);
	// 数として足し引きするので、倍精度に正確に載る値だけを読む。載らない（niche を含む）なら実行時の道へ譲る。
	const num = (n) => {
		const v = n && n.kind === "number" ? literalValue(n) : null;
		return v !== null && v !== NICHE_VALUE && v >= -(1n << 53n) && v <= 1n << 53n ? Number(v) : null;
	};
	const end = num(r);
	if (end === null) return null;
	// `i ~+ 1 ~ j`（歩幅を書いた形）と `i ~ j`（歩幅は暗黙の 1）の両方。
	if (l && l.type === "operation" && l.name === "range_arithmetic") {
		const st = num(unwrap(l.left));
		const sp = num(unwrap(l.right));
		if (st === null || sp !== 1) return null;
		return end < st ? null : { start: st, count: end - st + 1 };
	}
	const st = num(l);
	if (st === null || end < st) return null;
	return { start: st, count: end - st + 1 };
}

// 器の要素型。`elementType` はレンジ・List に付く（pass3.js）。
function elementTypeOfNode(n, env) {
	if (!n) return null;
	if (n.elementType) return n.elementType;
	// **束縛が知っていることを、識別子ノードは持っていない。**
	//
	// Pass 3 は仮引数の型を束縛へ書き戻すが、要素型はノードには載らない。`st ' 1~` の
	// `st` がそれで、束縛は `elementType = Int` だと知っているのに引く側から見えず、
	// **要素の幅が決まらないから切り出せない**という所まで落ちていた
	// （value_representation.md §5.10）。
	if (env && n.type === "atom" && n.kind === "identifier") {
		const b = envLookup(env, n.value);
		if (b && b.elementType) return b.elementType;
	}
	return n.atomType === "String" ? "Char" : null;
}

/**
 * **器どうしの等価**（`s = t` / `s != t`）。`{ptr, len}` を2本ずつ受けて、真なら左辺、
 * 偽なら `__` を積む（comparison.md §2.1「比較は値を返す」）。
 *
 * 返すのが左辺なのは、0/1 の規則（左辺が算術単位元なら右辺）が `String` には効かない
 * からである——器は加法単位元でも乗法単位元でもない。
 *
 * **メモリは要らない。** 読むだけであり、新しい `{ptr, len}` も作らない。真のときに返す
 * のは左辺そのものであり、偽のときは `len = 0`（＝`__`、unit.md）である。
 *
 * 長さが違えば中身を見るまでもない。同じなら要素を1つずつ見る——要素の幅は `charset` が
 * 決める（`String ≅ List(Char)` の要素幅そのもの）。
 */
/**
 * **両辺をちょうど `{ptr, len}` の2本にしてから比べる。**
 *
 * 以前は `genExpr` の返した本数を捨てて `em.slot - 2` を読んでいたので、1本で運ばれて
 * 来た値（`Char` を渡された仮引数）が混ざると左辺の `len` を右辺の `ptr` として使って
 * いた。狭い側は確保ゼロで広げられる——リテラルは `.rodata`、器の中の1つはスライス。
 */
function genBoxOperand(x, env, em, scope) {
	const wid = slotsOfNode(x, em.conf, env);
	if (wid === 2) {
		const w2 = genExpr(x, env, em, scope);
		if (w2 === false) return false;
		if (w2 !== 2) { em.pop(w2 === TAIL ? 0 : w2); return null; }
		return 2;
	}
	let po = emitSliceLift(em, x, env, scope);
	if (po === false) return false;
	if (po === null) {
		po = emitCharLiteralBox(x, env, em);
		if (po === false) return false;
	}
	if (po !== null) return 2;
	// **計算した値も広げられる。ただし代金が要る。**
	//
	// ここまでの2つは確保ゼロで広げる道である——リテラルは `.rodata` に置き場所があり、
	// 器の中の1つはその器を指し直せば済む。**残るのは「レジスタに載っている値」**で、
	// これは置き場所を持たないので場所を取るしかない（layout.js の `passingOf` が
	// 「要るとすれば計算した値だけで、それは Pass 4 が名指しする」と書いていた枝）。
	//
	// これが無いと、直和の狭い方が実行時に来た瞬間に比較が出せなかった——`ops` が
	// `Char` の器で `c` が `String` の仮引数、という自己ホストの継ぎ目がまさにこれである。
	// 原理8 の「広い方は狭い場合を長さ1として運べる」は**両方の綴りで**成り立たなければ
	// ならず、リテラルだけが広がるのでは片手落ちになる。
	if (wid !== 1) return null;
	const sw = genExpr(x, env, em, scope);
	if (sw === false) return false;
	if (sw !== 1) { em.pop(sw === TAIL ? 0 : sw); return null; }
	const lifted = emitLiftToContainer(em, x, (em.slot - 1) * 8, "長さ1の器へ広げる（原理8——計算した値なので場所が要る）");
	if (lifted === false) return false;
	if (lifted === null) return null;
	// **呼ぶ側はちょうど2本を期待する**（比較は `em.pop(2)` で右辺だけを捨てる）。
	// 持ち上げの下にスカラーの1本を残すと、その勘定がずれて別のスロットが答えになる。
	em.load(SCRATCH[0], lifted, "ptr");
	em.load(SCRATCH[1], lifted + 8, "len");
	em.pop(3);
	const [pOff, lOff] = pushPair(em);
	if (lOff === null) return null;
	em.store(SCRATCH[0], pOff, "ptr");
	em.store(SCRATCH[1], lOff, "len");
	return 2;
}

/**
 * **スカラー同士の構造比較（`==` / `!==`）。**
 *
 * 段12 の `=` は「左辺が算術単位元（0 か 1）なら右辺を返す」という選択規則を持つが、
 * 段8 の構造比較はその適用外である（comparison.md §2.1——単位元そのものが `__` に
 * なりうるため）。常に「真なら左辺、偽なら `__`」の単純規則で出す。
 */
/**
 * **積どうしの構造比較（`==` / `!==`）。**
 *
 * `==` は Hom集合の一致であって同一性ではない——**宣言順を見ない**（type_system.md §6.2:
 * `point : [x : 3 / y : 4]` と `point2 : [y : 4 / x : 3]` は等しい）。物理配置は名前順に
 * 揃えてあるので（stack_abi.md §7.1）、鍵の集合が同じなら並びも同じであり、スロットを
 * 順に突き合わせるだけでよい。宣言順（`ordinal`）は**見ない**のが要点である。
 *
 * **鍵の集合が違えば静的に偽である。** Hom集合が違うので、実行時に見るものが無い
 * ——命令を1本も出さずに答えが決まる。
 */
function genStructCompare(node, env, em, scope) {
	const conf = { target: em.conf.target, charset: em.conf.charset, env };
	const ls = structShapeOf(node.left, env, conf);
	const rs = structShapeOf(node.right, env, conf);
	if (!ls || !rs || ls.slotKind !== "named" || rs.slotKind !== "named") {
		return em.fail(node, "積の並びが決まらないので比べられません");
	}
	const wantEqual = node.name === "equal";
	// **中身をもう一段辿るスロットはまだ出せない。** 器のスロット（`{ptr, len}` の 16 byte）と
	// 入れ子の積は、ポインタを比べても同一性になってしまい構造比較にならない（原理4）。
	for (const sl of ls.slots) {
		if (sl.shape || sl.size === 16) {
			return em.fail(node, `スロット ${sl.name} は中身をもう一段辿る必要があるので、積の比較はまだ出せません`);
		}
	}
	// 鍵（名前と幅）が揃っているか。宣言順は見ない——`==` が見ていない性質である。
	const keyOf = (sh) => sh.slots.map((x) => x.name + ":" + x.size).join(",");
	const sameKeys = keyOf(ls) === keyOf(rs);
	const lw = genScalar(node.left, env, em, scope, "積は {ptr} の1本で運びます");
	if (lw === false) return false;
	const lo = (em.slot - 1) * 8;
	const rw = genScalar(node.right, env, em, scope, "積は {ptr} の1本で運びます");
	if (rw === false) return false;
	const ro = (em.slot - 1) * 8;
	const diff = em.newLabel("stne");
	const end = em.newLabel("stend");
	if (sameKeys) {
		for (const [i, sl] of ls.slots.entries()) {
			const sr = rs.slots[i];
			em.load(SCRATCH[0], lo, i === 0 ? "左の積の ptr" : undefined);
			em.emit(slotLoadInsn(sl, "x14", SCRATCH[0], sl.offset), `スロット ${sl.name}（+${sl.offset}、${sl.size} byte）`);
			em.load(SCRATCH[0], ro);
			em.emit(slotLoadInsn(sr, "x15", SCRATCH[0], sr.offset));
			em.emit("cmp x14, x15");
			em.emit(`b.ne ${diff}`);
		}
	} else {
		// 鍵が違う＝ Hom集合が違う。実行時に見るものは無い。
		em.emit(`b ${diff}`, "鍵の集合が違うので偽（静的に決まる）");
	}
	const put = (isTrue) => {
		if (isTrue) em.load(SCRATCH[0], lo, "真なら左辺");
		else em.emit(`movz ${SCRATCH[0]}, #0x8000, lsl #48`, "偽は __");
		em.store(SCRATCH[0], lo);
	};
	put(wantEqual);
	em.emit(`b ${end}`);
	em.label(diff);
	put(!wantEqual);
	em.label(end);
	em.pop(1); // 右辺の1本を返す。結果は左辺のスロットにある。
	return 1;
}

function genScalarStructCompare(node, env, em, scope) {
	const why = "GPR 幅の値の構造比較だけを出せます";
	if (!genScalar(node.left, env, em, scope, why)) return false;
	const lo = (em.slot - 1) * 8;
	if (!genScalar(node.right, env, em, scope, why)) return false;
	const ro = (em.slot - 1) * 8;
	em.load(SCRATCH[0], lo);
	em.load(SCRATCH[1], ro);
	em.emit(`cmp ${SCRATCH[0]}, ${SCRATCH[1]}`, "構造比較（左辺優先ルールは無い）");
	em.emit("movz x12, #0x8000, lsl #48", "偽は __");
	// 条件コードは表が言う（段8 の `==`/`!==` は `eq`/`ne`）。等価は2の補数で符号に依らない
	// ので両側に同じ綴りが置いてあり、ここに分岐は要らない——引き方は段13 の比較と同じである。
	const cond = asmOf(node.name).gpr[unsignedCompare(node, em.conf, env) ? "unsigned" : "signed"];
	em.emit(`csel ${SCRATCH[0]}, ${SCRATCH[0]}, x12, ${cond}`, "真なら左辺");
	em.pop(2);
	const o = em.push();
	if (o === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
	em.store(SCRATCH[0], o);
	return 1;
}

function genStringCompare(node, env, em, scope) {
	// **比べる刻みは、器の要素が決める。**
	//
	// ここは `charSizeOf`（文字1つぶん）で決め打ちしていた。文字列しか通っていなかった
	// 間は合っていたが、`==` を通して `List(Int)` が来た瞬間に嘘になる——8 byte 離れて
	// 並ぶ要素を 1 byte 刻みで読むので、`[1 2] == [1 3]` が先頭要素の下位2バイトを見て
	// 「等しい」と答える（診断ゼロ）。今日ずっと直してきた「要素の幅を別の場所が決めて
	// いる」の、比較における形である。
	const cmpElem = elementTypeOfNode(node.left, env) || elementTypeOfNode(node.right, env) || "Char";
	const cmpCell = elementCellSize(cmpElem, em.conf);
	if (!cmpCell || !cmpCell.size) return em.fail(node, `比べる器の要素の幅が決まりません（${cmpElem}）`);
	// 要素そのものが参照で運ばれる器（`List(String)`）は、中身をもう一段辿らないと比べ
	// られない。黙って ptr どうしを比べるより断る（原理4）。
	if (cmpCell.size === 16) return em.fail(node, "要素が参照で運ばれる器どうしの比較はまだ出せません（もう一段辿る必要があります）");
	const w = cmpCell.size;
	const lb = genBoxOperand(node.left, env, em, scope);
	if (lb === false) return false;
	if (lb === null) return em.fail(node, `比べる左辺を長さ1の器へ広げられません（${node.left && node.left.atomType}）`);
	const lo = (em.slot - 2) * 8;
	const rb = genBoxOperand(node.right, env, em, scope);
	if (rb === false) return false;
	if (rb === null) return em.fail(node, `比べる右辺を長さ1の器へ広げられません（${node.right && node.right.atomType}）`);
	const ro = (em.slot - 2) * 8;
	// `=`（段12）と `==`（段8）はどちらも「等しい」を問う。違うのは左辺優先ルールの有無で、
	// 器の中身を見る手続きそのものは同じである。
	const wantEqual = node.name === "assign_equal" || node.name === "equal";
	const same = em.newLabel("streq");
	const diff = em.newLabel("strne");
	const end = em.newLabel("strend");
	const loop = em.newLabel("strloop");

	em.load(SCRATCH[0], lo + 8, "左辺の len");
	em.load(SCRATCH[1], ro + 8, "右辺の len");
	em.emit(`cmp ${SCRATCH[0]}, ${SCRATCH[1]}`, "長さが違えば中身を見るまでもない");
	em.emit(`b.ne ${diff}`);
	// 位置を進めながら1要素ずつ比べる。x13 が位置、x14/x15 が読んだ要素。
	em.emit("mov x13, #0", "位置");
	em.label(loop);
	em.emit(`cmp x13, ${SCRATCH[0]}`);
	em.emit(`b.ge ${same}`, "末尾まで一致した");
	em.load(SCRATCH[1], lo, "左辺の ptr");
	em.emit(loadElem("w14", SCRATCH[1], "x13", w), `${w} byte の要素`);
	em.load(SCRATCH[1], ro, "右辺の ptr");
	em.emit(loadElem("w15", SCRATCH[1], "x13", w));
	em.emit("cmp w14, w15");
	em.emit(`b.ne ${diff}`);
	em.emit("add x13, x13, #1");
	em.emit(`b ${loop}`);

	// 真なら左辺、偽なら `__`（`len = 0`）。どちらの枝も左辺のスロットへ揃える。
	const put = (isTrue) => {
		if (isTrue) {
			em.load(SCRATCH[0], lo);
			em.load(SCRATCH[1], lo + 8);
		} else {
			em.emit(`mov ${SCRATCH[0]}, #0`, "__ は空（len = 0）");
			em.emit(`mov ${SCRATCH[1]}, #0`);
		}
		em.store(SCRATCH[0], lo, isTrue ? "真なら左辺" : "偽なら __");
		em.store(SCRATCH[1], lo + 8);
	};
	em.label(same);
	put(wantEqual);
	em.emit(`b ${end}`);
	em.label(diff);
	put(!wantEqual);
	em.label(end);
	em.pop(2); // 右辺の2本を返す。結果は左辺のスロットにある。
	return 2;
}

/**
 * match_case の並びを分岐へ落とす。結果は呼び出し元が使うスロットへ揃える
 * ——どの枝を通っても同じ場所に値がある、という一点を守る。
 */
function genMatch(node, env, em, scope, tail = false) {
	// **どの枝も同じ幅でなければ、置き場所が決まらない。** `Char | String` のような直和は
	// 「1本の枝と2本の枝」を1つの場所へ揃えろと言っていることになる。仕様は答えを持って
	// いる——「表現の違う枝の直和は広い方に揃え、`Char` の枝は境界で1要素の連続領域へ
	// 持ち上げる」（type_system.md §2）——が、その持ち上げにはメモリの確保が要るので
	// ここではまだ出さない。黙って先頭だけ置かず名指しする。
	// **幅が型から決まらないなら、枝から決める。**
	//
	// `Char | String` のような直和は「1本の枝と2本の枝」であり、型の側に答えは無い。
	// 仕様は「表現の違う枝の直和は広い方に揃える」と言っているので（type_system.md §2）、
	// 広い方を取る。`__` は幅を持たないので数えない（置く場所の広さで書く）。
	// 揃えられるかどうかは枝ごとに `move` が見る——確保が要るなら、そこで名指しされる。
	let width = slotsOfNode(node, em.conf, em.env);
	const armNodes = (node.lines || [])
		.map((line) => (isDefineNode(line) ? line.right : line))
		.filter((v) => !isUnitNode(v));
	const armWidths = armNodes.map((v) => slotsOfNode(v, em.conf, em.env));
	const knownW = armWidths.filter((w) => w !== null && w !== undefined);
	const armMax = knownW.length > 0 && knownW.length === armWidths.length ? Math.max(...knownW) : null;
	// **広い方へ揃えるのだから、ノード自身の幅より広い枝があればそちらである。** ここを
	// 「ノードの幅が決まらないときだけ枝を見る」としていたので、型が `Char` と言う分岐に
	// `String` を返す枝が混ざると「2 本と 1 本」で止まっていた——広い方に揃えると
	// 言っておきながら、狭い方で場所を決めていたことになる。
	if (width === null) {
		if (armMax !== null && armMax <= 2) width = armMax;
	} else if (armMax !== null && armMax > width && armMax <= 2) {
		width = armMax;
	}
	if (width === null) {
		return em.fail(node, `枝の幅が揃いません（${node.atomType}）——広い方へ揃える持ち上げがまだ出せません（type_system.md §2）`);
	}
	// レジスタに載る幅なら合流できる。**カーソルは4本**（`{arm, k, ptr, len}`）なので、
	// 2本で打ち切っていると枝の合流ができない。載らない幅はメモリの確保が要るので、
	// そこは名指しする。
	if (width > ARG_REGS.length) return em.fail(node, `${width} 本で運ぶ値を返す分岐はまだ出せません（${node.atomType}）`);

	// **「2本」が同じでも、中身が同じとは限らない。**
	//
	// ここは長らくスロットの本数だけを揃えていた。だが 2本には少なくとも3種類ある：
	// 参照の器（`{ptr, len}`）、規則（`{start, step}`——要素はどこにも置かれていない）、
	// そして同じ参照でも**枡が何 byte か**が違うもの（`List(String)` は 16、`String` は
	// 文字1つぶん）。どれも `slotsOfNode` は 2 と答えるので合流は「揃った」と言って通し、
	// 引く側は合流の型どおりの刻みで読む——診断ゼロで違う値が返る：
	//
	//     r : [~s] ?
	//     	`x` = `y` : s , s        List(String)、枡 16 byte
	//     	s                         String、枡 1 byte
	//     ||(r `ab`) ' 0||          解釈 1 ／実機 0
	//
	//     y :
	//     	1 = 1 : a
	//     	[0 ~+ 1]                  規則
	//     y ' 0                      解釈 97 ／実機 生番地
	//
	// **本数は「何本運ぶか」しか言わない。** 何を運ぶかは別の問いなので、別に訊く。
	// 揃わないなら片方を組み直さないと合流できない——それは持ち上げ（同じものを別の姿で
	// 置く）ではなく作り直しなので、黙って通さず名指しする（原理4）。
	if (width === 2) {
		const carryOf = (v) => {
			if (!v || slotsOfNode(v, em.conf, em.env) !== 2) return null; // 狭い枝は持ち上げの話
			if (v.repr === "rule" || isRuleNode(v, em.conf, em.env)) return "規則";
			if (v.repr === "cursor" || v.cursorGroup) return "カーソル";
			const et = v.elementType || (v.atomType === "String" ? "Char" : null);
			const c = elementCellSize(et, em.conf);
			return c && c.size ? `枡 ${c.size} byte` : null;
		};
		const carries = armNodes.map(carryOf).filter((x) => x !== null);
		const uniq = [...new Set(carries)];
		if (uniq.length > 1) {
			return em.fail(node, `枝の運び方が揃いません（${uniq.join(" と ")}）——本数は同じでも中身が違うので、合流するには組み直しが要ります`);
		}
	}

	// **狭い枝の持ち上げ先は、枝の外で一度取る。**
	//
	// 同型は型では無償、表現では有償である（原理8）——1本で出た枝を `{ptr, len}` の2本へ
	// 揃えるには、その1つを置く場所が要る。だが**枝の中で `sub sp` してはいけない**：
	// 通る枝によって合流点の `sp` が変わり、フレームが枝ごとに違うことになる。
	//
	// 通るのは1本だけなので、場所は共有してよい。ここでも「場所は最も外側で一度だけ取る」
	// である——外側が、この分岐そのものになっただけである。
	// **持ち上げ先を自分の枠に取ってはいけない。**
	//
	// ここは以前 `sub sp, sp, #16` で場所を取り、狭い枝の1つをそこへ書いて `{その sp, 1}`
	// を返していた。**返った瞬間にその枠は畳まれる**（`mov sp, x29`）ので、呼ぶ側は死んだ
	// 場所を指した器を読む——次の呼び出しが上書きすると値が変わる：
	//
	//     f : s ?
	//     	||s|| > 0 : s ' 1
	//     	`xy`
	//     pick : r q ? r ' 0
	//     pick (f `ab`) (f `zw`)      解釈 98（`b`）／実機 119（`w`）
	//
	// 代金を払わずに済む道が2つ在る（原理8——元の器の中に居る値は表現でも無償）。
	// リテラルの1文字は `.rodata`（`genWidened`）、器の中の1つ（`A ' i`）はスライス
	// （`emitSliceLift`）である。どちらでもない狭い枝——計算で作った1文字——には置き場所が
	// 無いので、黙って死んだ番地を返すより断る（原理4）。
	const outs = [];
	for (let k = 0; k < width; k++) {
		const o = em.push();
		if (o === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
		outs.push(o);
	}
	// **合流先の枡は何 byte か。** 狭い枝を広げるとき、置くのは「器1つ」ではなく
	// 「枡1つ」である——`List(String)` なら 16 byte、`String` なら文字1つぶんである。
	const mergeElem = node.elementType || (node.atomType === "String" ? "Char" : null);
	const mergeCellSize = elementCellSize(mergeElem, em.conf);
	const mergeCell = mergeCellSize && mergeCellSize.size ? mergeCellSize.size : null;
	// 合流した値がカーソルなら、`__` の書き方が違う（`arm` が niche）。
	const matchKind = node.repr === "cursor" || node.cursorGroup ? "cursor" : null;
	// 枝の値を出力スロットへ写す。幅が合わない枝は上と同じ持ち上げの話なので落とす。
	//
	// **枝の値は末尾位置である。** 分岐の結果がそのまま関数の返値になるので、そこにある
	// 呼び出しは末尾呼び出しである（interpreter.js の `evaluateTail` も同じ規則で
	// ブロックの各行を辿る）。飛んで行った枝は値を置かないので `TAIL` を返す。
	// **枝ごとに「場所を取ったか」を決める。** 通らなかった枝で取った場所はこの道には
	// 存在しないので、そこを理由に末尾呼び出しを止めてはいけない。
	const armScope = (line) =>
		scope && !scope.holdsFrameStorage && takesFrameStorage(line, true) ? { ...scope, holdsFrameStorage: true } : scope;
	const move = (line) => {
		// **`__` は幅を持たない。** 零対象なので、置く場所の広さに合わせて空を書けばよい
		// ——1本なら niche、参照なら `len = 0`、カーソルなら `arm` が niche である。
		// ここを「1本の値」として出していたので、`__` を返す枝と器を返す枝の合流が
		// すべて「1本と2本」で落ちていた。**型は既に `Unit` だと言っている**のだから、
		// 幅の話は合流の側で決まる。
		if (isUnitNode(line)) {
			emitUnit(em, outs, matchKind);
			return true;
		}
		// **広い方へ揃えるのは、確保が要らないなら先に試す。** リテラルの1文字は
		// `.rodata` に置き場所があるので、器として置ける（`genWidened`）。
		const wide = width === 2 ? genWidened(line, width, env, em, scope, mergeCell) : null;
		if (wide === false) return false;
		// **枝そのものが追記できる呼び出しなら、自分の返値スロットをそのまま渡す。**
		//
		// 選択写像の「落ちたら並べずに再帰」がこれである。構築の末尾ではないので追記の道に
		// 乗っていなかったが、書く先は同じ器の続きであって、要素を1個書いてから渡すか0個で
		// 渡すかの違いしかない——飛ばす枝は「0 個書いた」だけである。
		//
		// 印はノードに付ける。引数の中に別の呼び出しがあっても取り違えないためで、追記の
		// 相手（構築の末尾）と同じ扱いである。
		const stripped = width === 2 && em.sretDest !== null && em.sretDest !== undefined ? stripExpand(line) : null;
		const armAppend = stripped && appendableCallee(stripped, em) ? stripped : null;
		if (armAppend) armAppend._sretInto = em.sretDest;
		// **枝を合流用スロットへ直に置く。**
		//
		// スロットはスタック規律なので、生成の直前に `outs` ぶんを空けておけば、枝の最初の
		// `push` がちょうど `outs[0]` に乗る——同じ場所なので写しが要らない。「どの枝を
		// 通っても同じ場所に値がある」という合流の条件は、**写して揃える**のではなく
		// **最初からそこへ置く**ことでも満たされる。
		//
		// `genWidened` は既に値を置いてしまっているので、そちらは従来どおり写す。
		const direct = wide === null;
		if (direct) em.pop(width);
		// **器の中の1つは、指し直すだけで長さ1の器になる。** `A ' i` なら
		// `{A.ptr + i×幅, 1}`——確保ゼロ、範囲外なら len 0（＝`__`）まで正しい。
		// ちょうど `outs` の位置へ積まれるので、写しも要らない。
		if (direct && width === 2 && slotsOfNode(line, em.conf, env) === 1) {
			const sliced = emitSliceLift(em, line, env, scope);
			if (sliced === false) return false;
			if (sliced !== null) return true;
		}
		// **幅が違うと分かっている枝は、末尾に畳まない。**
		//
		// 飛んでしまうと値はこの関数を素通りするので、`w === TAIL` の道は幅の照合を
		// まるごと飛ばす——1本しか書かない関数へ `b` で飛び、呼ぶ側は x1 の残骸を `len`
		// として読む（`h : n ? `b`` は 1文字＝1本、合流は2本）。畳まなければ普通の呼び出し
		// になり、下の持ち上げ（スライス／`.rodata`）か名指しの断りに落ちる。
		const lineW = slotsOfNode(line, em.conf, env);
		const armTail = tail && !(lineW !== null && lineW !== width);
		const w = wide === null ? genExpr(line, env, em, armScope(line), armTail) : wide;
		if (armAppend) armAppend._sretInto = undefined;
		if (w === false) return false;
		if (w === TAIL) {
			// 飛んで行った枝は値を置かない。空けた分を戻して帳尻を合わせる。
			if (direct) for (let k = 0; k < width; k++) em.push();
			// 幅が読めない枝を飛ばしたなら、呼ぶ側が読む本数を誰も保証していない。
			if (lineW === null) return em.fail(line, `末尾で飛ぶ枝の返す本数が決まりません（${line.atomType}）`);
			return TAIL;
		}
		if (direct && w === width) return true; // 既に `outs` に在る
		if (direct) for (let k = w; k < width; k++) em.push(); // 幅が違う——下で名指しする
		if (w !== width) {
			em.pop(w);
			return em.fail(line, `枝の幅が揃いません（${w} 本と ${width} 本）——広い方へ揃える持ち上げがまだ出せません（type_system.md §2）`);
		}
		const base = em.slot - w;
		for (let k = 0; k < w; k++) {
			em.load(SCRATCH[0], (base + k) * 8);
			em.store(SCRATCH[0], outs[k], k === 0 ? "枝の値" : undefined);
		}
		em.pop(w);
		return true;
	};

	const end = em.newLabel("end");
	const lines = node.lines;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const isArm = isDefineNode(line);
		if (!isArm) {
			// フォールバック。条件を見ずにここへ来たら必ず値になる。
			if (!move(line)) return false;
			break;
		}
		const next = em.newLabel("arm");
		// **条件の幅は問わない。** 見るのは「`__` かどうか」だけであり、その判定は幅ごとに
		// 決まっている（1本なら niche、2本なら `len = 0`）。比較は値を返すので
		// （comparison.md §2.1）、`s = \`abc\`` のように条件が器になることがある。
		const cw = genExpr(line.left, env, em, scope);
		if (cw === false) return false;
		if (cw === TAIL) return em.fail(line.left, "条件の位置に末尾呼び出しは置けません");
		// 規則かどうかを見るのは**条件の式**である（`node` は分岐そのもので `left` を持たない）。
		emitIsUnit(em, (em.slot - cw) * 8, cw, "条件", isRuleNode(line.left, em.conf, em.env));
		em.pop(cw);
		em.emit(`b.eq ${next}`, "__ なら次の枝へ");
		const armResult = move(line.right);
		if (armResult === false) return false;
		// 飛んで行った枝は合流点へ戻ってこないので、`b` を出す意味が無い。
		if (armResult !== TAIL) em.emit(`b ${end}`);
		em.label(next);
		// 最後の行が条件付きなら、どの枝も通らない場合がある。そのときの値は `__`。
		if (i === lines.length - 1) emitUnit(em, outs);
	}
	em.label(end);
	return width;
}

/**
 * 値が `__` かどうかを見て、フラグを立てる（真なら `eq`）。
 *
 * **判定の仕方は幅で違う。** `emitUnit` の裏返しである——1本ならレジスタ上の niche と
 * 比べ、2本なら `len` が 0 かを見る（空文字列・空リストが `__` そのもの、unit.md）。
 */
// **幅からニーモニックへの梯子は、機械の事実が1つあるだけである。**
//
// AArch64 の素のロード／ストアは幅で綴りが変わる（`ldrb`/`ldrh`/`ldr`）。この事実は表の
// 前置 `@`（input）と中置 `#`（output）の行が `axis: 'width'` として持っている——`gpr_w1`
// から `gpr_w8` の4欄がそれである。同じ梯子がこのファイルに4本（`loadAt`/`storeAt`/
// `loadElem`/`storeElem`）書かれていたので、表を引く1本へ寄せる。
//
// **番地の付け方は引く側のものである。** 素の `[base]` か、添字つきの `[base, idx, lsl #n]`
// か、ずれつきの `[base, #off]` かは呼ぶ場所が決める——機械の側では同じ命令の同じ綴りで、
// 分かれるのは幅だけである。要素1つを位置つきで読み書きする道（`'`・構築・比較が使う）も
// 同じ行を引く。幅を言うのは、番地なら `NxHHHH` の `N`、要素なら `charset`（`String ≅
// List(Char)`）か要素型である。
//
// **符号拡張つきのロード（`ldrsb`/`ldrsh`）はここに無い。** 今日出しているのは零拡張だけで
// 足りている（`Char` は符号なし、target_info.js）。要る日に足すのは幅の欄の値ではなく
// **符号の軸**である——幅と符号は別の軸で、掛け合わせになる。
//
// 1/2/4 以外は語幅で出る（`w8` の欄）。参照で運ぶ要素（16 byte）もここへ来るが、呼ぶ側が
// 2回に分けて渡してくるので、1回ぶんは語幅である。
const memNarrow = (size) => size === 1 || size === 2 || size === 4;
function memMnemonic(name, size) {
	const gpr = asmOf(name).gpr;
	return gpr[`w${size}`] || gpr.w8;
}

/**
 * 器の k 番目へ書く。
 *
 * `byteReg` を渡すと**バイト位置をレジスタで**指す（`str x9, [x10, x13]`）。要素を
 * 落としながら並べるとき、書ける位置が実行時にしか決まらないためである——静的な
 * `offset` の道は、落ちる要素が1つも無いと分かっているときだけ通る。
 */
function storeElem(src, base, offset, size, byteReg = null) {
	const reg = memNarrow(size) ? src.replace(/^x/, "w") : src;
	const at = byteReg ? `[${base}, ${byteReg}]` : `[${base}, #${offset}]`;
	return `${memMnemonic("output", size)} ${reg}, ${at}`;
}

function loadElem(dst, base, idx, size) {
	// 刻みは幅の対数である（1 byte なら `lsl` そのものが出ない）。
	const shift = size === 1 ? 0 : size === 2 ? 1 : size === 4 ? 2 : 3;
	const at = `[${base}, ${idx}${shift ? `, lsl #${shift}` : ""}]`;
	// **8 byte は 64 ビットのレジスタで読む。** `w` のままだと上半分が落ち、しかも
	// ストライドが 4 になるので隣の要素を跨いで読む。ここが 4 byte で頭打ちだったのは、
	// これまで通っていたのが `String` の1 byte 要素と規則（算術で引くのでロードしない）
	// だけだったからで、`List(Int)` を実際に引くまで表に出なかった。
	const reg = memNarrow(size) ? dst : dst.replace(/^w/, "x");
	return `${memMnemonic("input", size)} ${reg}, ${at}`;
}

// 幅ぶんのロード／ストア。`layer: 0` は volatile だが、Pass 4 は並べ替えも削除もしないので
// 素の `ldr`/`str` がそのまま volatile の意味を満たす（memory_management.md §2）。
/**
 * レンジ式から `{start, step, end}` を取り出す。書き方は3つあるが実体は1つである。
 *
 *   [0 ~+ 1]      range_arithmetic(0, 1)              終端なし → 無限
 *   [1 ~ 5]       range(1, 5)                         歩幅は暗黙の 1
 *   [2 ~+ 3 ~ 9]  range(range_arithmetic(2, 3), 9)    全部書いた形
 *
 * 出せるのは**等差**（`~` / `~+`）だけである。等比・冪（`~*` `~^`）は同じ3つ組で運べるが
 * 添字が `start + i × step` にならないので、命令が別になる（type_system.md §2 のアクセス表）。
 */
function rangeParts(node) {
	const ONE = { type: "atom", kind: "number", value: "1", atomType: "Int" };
	if (node.name === "range_arithmetic") {
		if (node.op !== "~+") return null;
		return { start: node.left, step: node.right, end: null };
	}
	if (node.name !== "range") return null;
	const l = node.left;
	if (l && l.type === "operation" && l.name === "range_arithmetic") {
		if (l.op !== "~+") return null;
		return { start: l.left, step: l.right, end: node.right };
	}
	// **歩幅を書かない形（`[a ~ b]`）の向きは、端点の並びが決める。**
	//
	// `[5 ~ 1]` は 5,4,3,2,1 なので歩幅は −1 である（interpreter.js の `delta`）。
	// ところが端点は実行時の値かもしれないので、符号はここでは決まらない——`signedByEnds`
	// を立てて、置くときに `start <= end` を見て ±1 を作らせる。
	//
	// 向きを step へ畳むのが要なのは、**規則を切ったあとも向きが残る**からである。
	// `[0 ~ 3] ' 5~` の起点は 5 で終端は 3 だから、並びから向きを読み直すと降順に見えて
	// しまう。step が符号を持っていれば、切っても向きは動かない。
	return { start: l, step: ONE, end: node.right, signedByEnds: true };
}
// 数のリテラルの値。**プリフィックスは `literalParts` が剥がす**（`BigInt` が読めるのは `0x` /
// `0b` の綴りだけ）。読めなければ投げる——浮動小数である。値を置く道（`genExpr`）と、niche の
// ビットかを見る道（`cannotBeUnit`）が同じ読み方でなければ、`04x8000…` の答えが割れる。
function literalBigInt(text) {
	const lit = literalParts(text);
	return lit ? BigInt((lit.radix === 2 ? "0b" : "0x") + lit.digits) : BigInt(text);
}

/**
 * **字面がレジスタに置くビット列。** 十進の字面は `Int` なので 64 ビットで回る。
 *
 * **番地の字面が 2^64 以上なら、置くのは `__` である。** そういう番地は存在しない——溢れた番地は
 * `__`（integer_overflow.md §1）であり、解釈器も `__` を返す。下の 64 ビットだけ置いていたので、
 * `0x10000000000000010` が診断ゼロのまま 0x10 番地になっていた。`0x8000000000000000` が綴りの
 * 違うだけの `__` であるのと同じく、これも `__` の別の綴りである。
 */
function literalBits(n) {
	const v = literalBigInt(n.value);
	if (n.kind === "address" && v >> 64n !== 0n) return BigInt(UNIT_NICHE_ASM);
	return BigInt.asUintN(64, v);
}

/**
 * **字面が表す値。** 整数の字面でなければ null。
 *
 * 置く命令（`literalBits`）と同じ読み方で、**値として見る所**——定数へ畳む番地・添字・歩幅——が
 * 使う。十進の字面は `Int` なので 64 ビットの符号付きで回り、番地の字面は符号なしで読む。
 * ビットが niche なら綴りによらず `NICHE_VALUE`（`__`）を返す——`INT64_MIN` は `Int` の値ではなく
 * （integer_overflow.md §1.2）、2^64 以上の番地は存在しない。
 *
 * **読む所ごとに読み方が違っていた。** 置く命令は `literalBits` を通るのに、定数へ畳む道
 * （`constAddressOf`）は `BigInt(String(v))`、添字や歩幅は `Number(v)` で読んでいた。実測で
 * `@0x10000000040800000` は番地 0x40800000 を読み、`0x10000000040800000 # 65` はそこへ書いた
 * ——置く命令だけ直しても、畳む道が下の 64 ビットの番地を作っていた（解釈器はどちらも `__`）。
 * 十進の `l ' 18446744073709551615` も `-1` と読まれず `__` になっていた。
 */
function literalValue(n) {
	if (!n || n.type !== "atom" || (n.kind !== "number" && n.kind !== "address" && n.kind !== "register")) return null;
	let bits;
	try {
		bits = literalBits(n);
	} catch {
		return null; // 浮動小数
	}
	if (bits === NICHE_VALUE) return NICHE_VALUE;
	return n.kind === "address" ? bits : BigInt.asIntN(64, bits);
}

/**
 * 字面を `.quad` などへそのまま書く綴り。**64 ビットに収まらない綴りは、置く命令と同じビットに
 * 直す**——`.quad 0x10000000000000010` はアセンブラが `literal value out of range` で撥ね、
 * Sign は診断ゼロのまま止まっていた。収まる綴りは書いたまま残す。
 */
function literalDataText(n) {
	try {
		const v = BigInt(String(n.value));
		if (!(n.kind === "address" && v >> 64n !== 0n) && v < 1n << 64n && v >= -(1n << 63n)) return String(n.value);
	} catch {
		// 幅の前置きのある綴り（`04x…`）は下で数へ直す
	}
	return "0x" + literalBits(n).toString(16);
}

/**
 * 64ビットの即値をレジスタへ置く。
 *
 * AArch64 の `mov` に載る即値は16ビットまでなので、超える値は `movz` で最下位の非零な
 * 16ビットを置き、残りを `movk` で埋める。**桁を落として黙って通さない**——`0x40000000`
 * のような MMIO のアドレスは、下位16ビットだけ置くと別の番地を触ることになる。
 *
 * 負の値は2の補数のビット列をそのまま置く。`movn` を使えば命令が減る場合もあるが、
 * `movz`/`movk` は常に正しい——短くするのは、正しさを確かめてからで足りる。
 */
function emitImm(em, reg, value, comment) {
	const u = BigInt.asUintN(64, BigInt(value));
	const chunks = (fill) => {
		const out = [];
		for (let shift = 0; shift < 64; shift += 16) {
			const c = (u >> BigInt(shift)) & 0xffffn;
			if (c !== fill) out.push([shift, c]);
		}
		return out;
	};
	const zeros = chunks(0n); // 0 で埋まらない桁
	const ones = chunks(0xffffn); // 0xffff で埋まらない桁
	const lsl = (shift) => (shift === 0 ? "" : `, lsl #${shift}`);

	// 16ビットに収まる正の値は `mov` 1つ。これは `movz` の別名なので出る機械語は同じで、
	// 読むときに桁を数えなくて済む。
	if (u <= 0xffffn) {
		em.emit(`mov ${reg}, #${u}`, comment);
		return;
	}

	// 負の値は上の桁が 0xffff で埋まる。`movn` は反転を置くので、そちらが短い。
	// `-1` は `movn reg, #0` の1命令で済む。
	if (ones.length < zeros.length) {
		if (ones.length === 0) {
			em.emit(`movn ${reg}, #0`, comment);
			return;
		}
		const [s0, c0] = ones[0];
		em.emit(`movn ${reg}, #0x${(0xffffn ^ c0).toString(16)}${lsl(s0)}`, comment);
		for (const [s, c] of ones.slice(1)) em.emit(`movk ${reg}, #0x${c.toString(16)}${lsl(s)}`);
		return;
	}
	if (zeros.length === 0) {
		em.emit(`mov ${reg}, #0`, comment);
		return;
	}
	const [s0, c0] = zeros[0];
	em.emit(`movz ${reg}, #0x${c0.toString(16)}${lsl(s0)}`, comment);
	for (const [s, c] of zeros.slice(1)) em.emit(`movk ${reg}, #0x${c.toString(16)}${lsl(s)}`);
}
/**
 * **範囲外の添字では、器の外を読まない**（2026-09-15）。
 *
 * 以前の範囲検査は「比べる → 無条件に読む → 範囲外なら値を `__` に替える」だった。値は正しくなるが、
 * `ptr + i` は範囲外でも読まれていた——layer 0 で MMIO のレジスタに当たれば読むだけで副作用が起き、
 * 「範囲外は記憶を読むから検査する」（integer_overflow.md §1 の物差し）という理由とも食い違う。
 *
 * 分岐は足さない。読む番地そのものを `csel` で選び、範囲外なら `.rodata` に置いた `__` の置き場を指させる。
 * 置き場は `{niche, 0}` の 16 byte で、8 byte の要素なら読んだ値がそのまま `__`、参照で運ぶ要素なら
 * ptr が niche・len が 0（器の `__`）になる。狭い幅は下の byte が 0 なので、呼ぶ側が niche に替える。
 *
 * 旗は呼ぶ前の比較のまま（`inCond` が範囲内）。`adrp`/`add` は旗を壊さない。`tmp` を壊す。
 */
function emitSafeReadAddress(em, out, addr, inCond, tmp = "x13") {
	const cell = em.internAnonImage(["\t.quad 0x8000000000000000", "\t.quad 0"], 8);
	em.emit(`adrp ${tmp}, ${cell}`, "範囲外なら読む先（.rodata に置いた __）");
	em.emit(`add ${tmp}, ${tmp}, :lo12:${cell}`);
	em.emit(`csel ${out}, ${addr}, ${tmp}, ${inCond}`, "範囲外は器の外を読まない");
}

// 添字で要素を読む。`base` を要素の番地へ進め、範囲外なら置き場へ差し替えてから読む（`emitSafeReadAddress`）。
function emitGuardedElementLoad(em, dst, base, idx, size, inCond = "lo") {
	const shift = size === 1 ? 0 : size === 2 ? 1 : size === 4 ? 2 : 3;
	em.emit(`add ${base}, ${base}, ${idx}${shift ? `, lsl #${shift}` : ""}`, `${size} byte × 添字`);
	emitSafeReadAddress(em, base, base, inCond);
	em.emit(loadAt(dst, base, size), `${size} byte の要素`);
}

// 前置 `@` と中置 `#` そのもの（番地1つ、添字なし）。幅の欄を引くのは上の梯子と同じである。
function loadAt(dst, base, size) {
	const reg = memNarrow(size) ? dst.replace("x", "w") : dst;
	return `${memMnemonic("input", size)} ${reg}, [${base}]`;
}
function storeAt(src, base, size) {
	const reg = memNarrow(size) ? src.replace("x", "w") : src;
	return `${memMnemonic("output", size)} ${reg}, [${base}]`;
}

// 型が言う幅（決まらなければ GPR 幅）。
/**
 * **その番地が宣言している幅**（value_representation.md §5）。
 *
 * `NxHHHH` の `N` がその番地に居るものの幅である（`x` は byte、`u` は bit。正規化は
 * `literalParts` が済ませている）。宣言していなければ `null` を返し、呼ぶ側は型から決める。
 *
 * **実測すると、そこは必ず語幅（8）になる。** `widthOfType` が引くのは
 * `reduceToMachineType().size` で、`Char` も `Int` も gpr クラスの 8 だからである
 * （target_info.js の `WIDTH_CLASS`）——`0x… # \\a` は 1 byte ではなく 8 byte を書き、
 * `1x… # \\a` と書いたときだけ `strb` が出る。**幅を言うのは番地であって値の型ではない。**
 * 表の幅の欄（`@`/`#` の `gpr_w*`）も同じ読み方をする——宣言された `N`、無ければ `w8`。
 *
 * 機械にその幅の命令が無いもの（`3x`、割り切れない `12u`）は `NaN` で返る。呼ぶ側が
 * 名指しで断る——分からないものを既定へ倒さない（原理4）。
 */
function declaredWidthOf(node) {
	const a = unwrap(node);
	if (!a || a.type !== "atom" || (a.kind !== "address" && a.kind !== "unicode")) return null;
	const parts = literalParts(a.value);
	return parts && parts.width !== null ? parts.width : null;
}

function widthOfType(type, conf) {
	const m = type ? reduceToMachineType(type, conf.target) : null;
	return m && m.class === "gpr" ? m.size : 8;
}
function emitIsUnit(em, off, width, comment, isRule = false, isCursor = false) {
	// カーソルは先頭の `arm` だけ見る。空の入力から枝は選べないので、`_arm` が
	// 完全性公理で `__` を返し、それがそのまま先頭に立つ。
	if (isCursor) {
		em.load(SCRATCH[0], off, comment);
		em.emit("movz x12, #0x8000, lsl #48", "__ の niche（arm）");
		em.emit(`cmp ${SCRATCH[0]}, x12`);
		return;
	}
	if (width === 1) {
		em.load(SCRATCH[0], off, comment);
		em.emit("movz x12, #0x8000, lsl #48", "__ の niche");
		em.emit(`cmp ${SCRATCH[0]}, x12`);
		return;
	}
	// **規則が尽きているかは `len` では分からない。** 置かれているのは
	// `{start, step, end}` であって、2本目は長さではなく歩幅である。ここを場所と同じ
	// 経路へ流すと「歩幅が 0 か」を見ることになり、歩幅は 0 にならないので**規則は
	// 決して尽きない**ことになる。カーソルを1歩多く回していたのはこれである。
	if (isRule) {
		if (width < 3) {
			// 終端が無い＝無限。尽きない。呼ぶ側は直後に `b.eq` を置くので、`eq` が
			// 立たない形にしておく。2命令とも消せるが、消すのは正しさを確かめてからで足りる。
			em.emit("mov x12, #1", `${comment}（終端が無いので尽きない）`);
			em.emit("cmp x12, #0");
			return;
		}
		em.load(SCRATCH[0], off, comment);
		em.load("x10", off + 8, "step");
		em.load("x13", off + 16, "end");
		em.emit(`cmp ${SCRATCH[0]}, x13`);
		em.emit("cset x14, gt", "昇順なら end を越えていたら空");
		em.emit("cset x15, lt", "降順なら end を下回っていたら空");
		em.emit("cmp x10, #0");
		em.emit("csel x14, x14, x15, ge", "歩幅の符号で選ぶ");
		em.emit("cmp x14, #1", "空が __");
		return;
	}
	// 2本のときは `len` を見る。`ptr` は何を指していても関係ない。
	em.load(SCRATCH[0], off + 8, comment);
	em.emit(`cmp ${SCRATCH[0]}, #0`, "len = 0 が __");
}

// 返値レジスタへ `__` を置く。幅は返値と同じ（呼ぶ側が読む本数を変えない）。
/**
 * **足りない幅を、確保せずに埋める。**
 *
 * 枝の合流で `Char`（1本）と `String`（2本）が並ぶことがある（`gap : … : indent` と
 * `(closers st d) newline`）。仕様は「表現の違う枝の直和は広い方に揃える」と言っている
 * が、素直に読むと1文字ぶんの領域を確保することになる——ところが**リテラルなら既に
 * 置き場所がある**。`.rodata` へ1文字置けば `{ptr, 1}` で、確保は要らない。
 *
 * これは文字列リテラルでやっていることそのものである。1文字を「長さ1の文字列」として
 * 扱うのは `String ≅ List(0u)` の言い換えでしかない。
 *
 * 広げられなければ `null` を返す（呼ぶ側が名指しする）。
 */
/**
 * @param cell 合流先の器の**枡1つが何 byte か**（分からなければ null）。
 *
 * **枝自身の型から測ってはいけない。** 以前はここが `node.atomType`（枝の型）だけを見て
 * いたので、合流先が `List(String)`（枡 16 byte）でも `Char` の枝を 1 byte で書き、
 * `{ptr, 1}` を返していた。引く側は器の型どおり 16 byte 刻みで `{ptr, len}` を読むので、
 * 文字の並びをポインタとして読む——診断ゼロで `__` が返る：
 *
 *     f : n ?
 *     	n = 1 : `xy` , `zw`      枡 16 byte の器
 *     	\b                       1文字
 *     (f 0) ' 0 ' 0              解釈 98／実機 __
 *
 * 追記の道（`emitSliceLift` を呼ぶ側）は同じ形をちゃんと断っている。ここだけが
 * 素通りしていた——同じ問いを2箇所が別々に答えている、いつもの形である。
 */
function genWidened(node, want, env, em, scope, cell = null) {
	if (want !== 2) return null;
	// **枡が参照で運ぶ器（16 byte）なら、置くのは「値1つ」ではなく `{ptr, len}` の組である。**
	//
	// `List(String)` の枝と1文字の枝が合流する形がこれ。1文字を長さ1の器にするのは確保ゼロ
	// で済む（リテラルは `.rodata`、器の中の1つはスライス）ので、その組をそのまま返値スロット
	// へ 16 byte 書けば「枡1つぶんの器」になる。**代金は生成後のコードでは払わない**（原理8）。
	if (cell === 16 && em.sretDest !== null && em.sretDest !== undefined) {
		let pair = emitSliceLift(em, node, env, scope);
		if (pair === false) return false;
		if (pair === null) {
			pair = emitCharLiteralBox(node, env, em);
			if (pair === false) return false;
		}
		if (pair !== null) {
			em.load(SCRATCH[1], em.sretDest, "返値スロット（sret）");
			em.load(SCRATCH[0], (em.slot - 2) * 8);
			em.emit(`str ${SCRATCH[0]}, [${SCRATCH[1]}, #0]`, "枡の ptr（要素1つ）");
			em.load(SCRATCH[0], (em.slot - 1) * 8);
			em.emit(`str ${SCRATCH[0]}, [${SCRATCH[1]}, #8]`, "その len");
			em.pop(2);
			const [po16, lo16] = pushPair(em);
			if (lo16 === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
			em.store(SCRATCH[1], po16, "ptr は返値スロット");
			em.emit(`mov ${SCRATCH[0]}, #1`, "len は 1（枡1つぶんの器）");
			em.store(SCRATCH[0], lo16, "len");
			return 2;
		}
	}
	// **返値スロットが在るなら、確保は要らない。**
	//
	// 器を返す関数の枝が全部器を組むとは限らない——`gap : st d ? d > (top st) : indent /
	// …` の `indent` のように、片方が値1つで済む形は普通である。そこは `[x] ≅ x` で
	// 長さ1の器だが、**表現では有償**なので（原理8）1本と2本で幅が揃わず、枝が合流でき
	// なかった。
	//
	// sret の位置では払い方が一番安い。呼ぶ側が用意したスロットへ要素を1つ書き、
	// `{そのスロット, 1}` を返せばよい——器を組む枝がやっているのと同じことである。
	// `sub sp` も `.rodata` も要らない。
	if (em.sretDest !== null && em.sretDest !== undefined) {
		const el = node.atomType;
		const m1 = el && !isBoxType(el) ? measure({ atomType: el }, { target: em.conf.target, charset: em.conf.charset }) : null;
		// 枡の幅と、書こうとしている値の幅が同じでなければ広げない（原理4）。
		if (m1 && m1.size && (cell === null || cell === m1.size)) {
			const vw = genExpr(node, env, em, scope);
			if (vw === false) return false;
			if (vw === 1) {
				em.load(SCRATCH[0], (em.slot - 1) * 8, "1つの値を器として返す");
				em.load(SCRATCH[1], em.sretDest, "返値スロット（sret）");
				em.emit(storeElem(SCRATCH[0], SCRATCH[1], 0, m1.size), `${m1.size} byte を1つ書く`);
				em.pop(1);
				const [po0, lo0] = pushPair(em);
				if (lo0 === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
				em.store(SCRATCH[1], po0, "ptr は返値スロット");
				em.emit(`mov ${SCRATCH[0]}, #1`, "len は 1");
				em.store(SCRATCH[0], lo0, "len");
				return 2;
			}
			em.pop(vw === TAIL ? 0 : vw);
		}
	}
	const boxed = emitCharLiteralBox(node, env, em, cell);
	if (boxed === false) return false;
	return boxed === null ? null : 2;
}

/**
 * **1文字のリテラルを、確保ゼロで長さ1の器にする。**
 *
 * `.rodata` に1文字置けば `{ptr, 1}` である——`String ≅ List(Char)` の言い換えでしかない
 * ので、新しい概念も確保も要らない（原理8 の「表現の代金」がここでは 0 になる）。
 *
 * @param cell 置き先の枡が何 byte か（null なら問わない）。1文字ぶんと違えば置けない。
 * @returns 積んだ ptr スロット（2スロット消費）／置けなければ null
 */
function emitCharLiteralBox(node, env, em, cell = null) {
	let t = unwrap(node);
	// 名前で書かれていても中身はリテラルである（`indent : \t`）。束縛先まで辿る——
	// **置き場所があるかどうかは名前ではなく中身が決める**。
	if (isIdentifierNode(t) && env) {
		const b = envLookup(env, t.value);
		const v = b && b.valueNode;
		if (v && v !== t) t = unwrap(v);
	}
	if (!t || t.type !== "atom") return null;
	if (t.kind !== "char" && t.kind !== "string" && t.kind !== "unicode") return null;
	const cps = codePointsOf(t);
	if (cps === null || cps.length !== 1) return null;
	const w = charSizeOf(em.conf.charset);
	// 置くのは1文字ぶん（`w` byte）なので、枡がそれより広い器へは入れられない。
	if (cell !== null && cell !== w) return null;
	const label = em.intern(cps);
	const [po, lo] = pushPair(em);
	if (lo === null) return em.fail(node, `式が深すぎます（スロットは ${MAX_SLOTS} まで）`);
	em.emit(`adrp ${SCRATCH[0]}, ${label}`, `${label} の頁（1文字を器として置く——確保は要らない）`);
	em.emit(`add ${SCRATCH[0]}, ${SCRATCH[0]}, :lo12:${label}`);
	em.store(SCRATCH[0], po, "ptr");
	em.emit(`mov ${SCRATCH[1]}, #1`, `len は文字数（${w} byte 幅 × 1 文字）`);
	em.store(SCRATCH[1], lo, "len");
	return po;
}

// `__`（零射）そのものを書いたノードか。値ではなく**書かれ方**を見る。
function isUnitNode(n) {
	const u = unwrap(n);
	return !!u && u.type === "atom" && (u.value === "_" || u.value === "__");
}

function emitUnitRegs(em, width, kind = null) {
	if (width <= 1) {
		em.emit("movz x0, #0x8000, lsl #48", "__ を返す（完全性公理）");
		return;
	}
	// **カーソルが尽きているかは `arm` が niche かで分かる。** 入力が空になれば枝を
	// 選ぶ関数が完全性公理で `__` を返すので、そのまま先頭のフィールドに現れる——
	// 空を別に表す必要が無い。
	if (kind === "cursor") {
		em.emit("movz x0, #0x8000, lsl #48", "__ を返す（arm が niche）");
		for (let k = 1; k < width; k++) em.emit(`mov x${k}, #0`);
		return;
	}
	em.emit("mov x0, #0", "__ を返す（完全性公理）");
	em.emit("mov x1, #0", "len = 0 が __");
	for (let k = 2; k < width; k++) em.emit(`mov x${k}, #0`);
}

/**
 * 本体を組み立ててから、必要なフレームの大きさを決めて前後を付ける。
 *
 * フレームの大きさは**本体を出してみるまで分からない**（式の深さで決まる）ので、
 * 本文を先に作って後から包む。AArch64 のスタックは16バイト境界を要求するので
 * 切り上げる。
 */
/**
 * その式は**フレームに取った場所への参照を運ぶ**か。
 *
 * **場所を取ったことと、その場所が呼び先から見えることは別である。**
 * `($(n , n)) ' 0` は `sub sp` で場所を取るが、渡るのは要素（スカラー）であって参照では
 * ない——呼び先はその場所に触れないので、畳んで構わない。触れるのは参照を運べる型
 * （器・アドレス）で渡したときだけである。
 *
 * 型が読めない位置は運びうると見なす（`markEscapes` と同じ倒し方）。
 */
function carriesFrameStorage(node) {
	return takesFrameStorage(node, true) && mayCarryReference(node);
}

/**
 * その値は**参照を運びうるか**。
 *
 * 場所を取ったことと、その場所が呼び先から見えることは別である。運べるのは参照を
 * 運べる型（器・アドレス）だけで、要素を1つ取り出したなら呼び先はその場所に触れない。
 * 型が読めない位置は運びうると見なす（`markEscapes` と同じ倒し方）。
 */
function mayCarryReference(node) {
	const u = unwrap(node);
	const t = u && u.atomType;
	return CONTAINER_TYPES.has(t) || t === "Address" || t === undefined || t === null;
}

/** match の並びか（`genExpr` の分岐と同じ判定を使う——別々に書くと片方だけ当たる）。 */
function isMatchBlock(n) {
	if (isStructBlock(n)) return false;
	return !!(n && Array.isArray(n.lines) && (n.lines.length > 1 || (n.lines.length === 1 && isDefineNode(n.lines[0]))));
}

/**
 * `$匿名式` が場所を取るか。取るなら、そのフレームは呼び先が走っている間も生きて
 * いなければならないので、末尾呼び出しで畳めない。
 *
 * `pathOnly` を立てると**この道の上にあるか**を見る。**枝は互いに排他である**——
 * 別の枝で取った場所は、この枝を通るときには存在しない。条件は全部通るので数えるが、
 * 枝の値は数えない。
 *
 * ここを関数まるごとで見ていたため、`n > 100 : ($(n , n)) ' 0` という**別の枝**が
 * あるだけで、末尾自己再帰の枝まで `bl` になっていた——畳めるはずのものを畳めないと
 * 言っていたことになる。Sign にループは無く再帰しかないので、ここは深さがそのまま
 * スタックの深さになる（tco.md）。
 */
function takesFrameStorage(node, pathOnly = false) {
	if (!node || typeof node !== "object") return false;
	if (node.type === "operation" && node.position === "prefix" && node.name === "address") {
		const t = unwrap(node.operand);
		if (t && !isIdentifierNode(t) && !(t.type === "atom" && t.kind === "unit")) return true;
	}
	if (pathOnly && isMatchBlock(node)) {
		// 条件だけを見る。枝の値は `genMatch` が枝ごとに足す。
		return (node.lines || []).some((l) => (isDefineNode(l) ? takesFrameStorage(l.left, true) : false));
	}
	for (const k of ["left", "right", "operand"]) if (takesFrameStorage(node[k], pathOnly)) return true;
	for (const l of node.lines || []) if (takesFrameStorage(l, pathOnly)) return true;
	for (const e of node.entries || []) if (takesFrameStorage(e.default, pathOnly)) return true;
	return false;
}

/**
 * 末尾位置に `$匿名式` があるか。あるならその値は**自分のフレームの場所**であり、
 * 返すと死んだ場所を指す。分岐なら枝それぞれが末尾位置である。
 */
function frameAddressInTail(node) {
	const n = unwrap(node);
	if (!n) return null;
	if (Array.isArray(n.lines)) {
		for (const line of n.lines) {
			const v = isDefineNode(line) ? line.right : line;
			const hit = frameAddressInTail(v);
			if (hit) return hit;
		}
		return null;
	}
	if (n.type === "operation" && n.position === "prefix" && n.name === "address") {
		const t = unwrap(n.operand);
		// 名前付き識別子と `__` は場所を取らない（既にある所を指すだけ）。
		if (!t || isIdentifierNode(t) || (t.type === "atom" && t.kind === "unit")) return null;
		return n;
	}
	return null;
}

/**
 * **作った器はフレームより長生きするか。**
 *
 * `$匿名式` は `sub sp` で自分のフレームに場所を取るので、返すと死んだ場所を指す
 * （memory_management.md §2）。だから器を作ってよいのは**フレームの外へ出ない**ときだけ
 * であり、出るなら sret（呼び出し側がスロットを提供する）が要る。
 *
 * 判定は**直近の呼び出しだけを見ても足りない**。n_queens の `col board~` は `place` の
 * 引数なので一見「下へ流すだけ」に見えるが、
 *
 *     place : row n [~board] ?
 *         row > n : board          ← 引数をそのまま返す
 *         try_col 1 row n board
 *
 * `place` が `board` を返すので、`try_col` のフレームに置いた器が上へ抜ける。**どの
 * 仮引数が返値になりうるか**を先に求めてから、引数の位置ごとに判定する必要がある。
 *
 * 走る先が分からない呼び出し（アドレス経由）は「返しうる」と見なす——決まらないものを
 * 「安全だ」と決めてはいけない（原理4は安全側にだけ倒す）。
 */
function collectReturnedParams(nodes) {
	// 関数名 → 返値になりうる仮引数の位置の集合
	const table = new Map();
	const bodies = new Map();
	for (const node of nodes) {
		if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
		const rhs = node.right;
		if (!rhs || rhs.type !== "operation" || rhs.name !== "lambda") continue;
		const name = bareName(node.left.value);
		bodies.set(name, rhs);
		table.set(name, new Set());
	}
	const paramsOf = (lam) => paramShapesOf(lam.left).map((sh) => (sh && sh.kind === "bare" ? sh.name : sh && sh.head ? sh.head : null));

	// 末尾位置の式を集める（分岐なら枝それぞれ、`|` なら両辺）。
	const tails = (n, out = []) => {
		const u = unwrap(n);
		if (!u) return out;
		if (Array.isArray(u.lines)) {
			for (const line of u.lines) tails(isDefineNode(line) ? line.right : line, out);
			return out;
		}
		if (u.type === "operation" && u.name === "or") {
			tails(u.left, out);
			tails(u.right, out);
			return out;
		}
		out.push(u);
		return out;
	};

	let changed = true;
	let guard = 0;
	while (changed && guard++ < 50) {
		changed = false;
		for (const [name, lam] of bodies) {
			const params = paramsOf(lam);
			const set = table.get(name);
			for (const t of tails(lam.right)) {
				// 仮引数そのものを返している。
				if (isIdentifierNode(t)) {
					const i = params.indexOf(t.value);
					if (i >= 0 && !set.has(i)) { set.add(i); changed = true; }
					continue;
				}
				// **返す器の中に居る仮引数も出て行く。** `mul_go : … ? acc , i` は `acc` を組の
				// 中へ入れて返すので、`acc` として渡した器は呼ぶ側のフレームより長生きしなければ
				// ならない。ここが「そのまま返す」形だけを見ていたため、**組んで返す形が漏れて**
				// いた——出て行かないと判定された器は自分のフレームに置かれ、返した先で死ぬ。
				//
				// 見るのは参照を運べる位置だけである。`i`（数）は場所を持たない。
				if (t.type === "operation" && COPRODUCT_BUILD_OPS.has(t.name)) {
					const seen = [];
					const dig = (x) => {
						const u = unwrap(x);
						if (!u) return;
						if (u.type === "operation" && COPRODUCT_BUILD_OPS.has(u.name)) {
							dig(u.left);
							dig(u.right);
							return;
						}
						seen.push(u);
					};
					dig(t);
					for (const q of seen) {
						if (!isIdentifierNode(q) || !mayCarryReference(q)) continue;
						const i = params.indexOf(q.value);
						if (i >= 0 && !set.has(i)) {
							set.add(i);
							changed = true;
						}
					}
					continue;
				}
				// 呼び出しの結果を返している。呼び先が j 番目を返すなら、その実引数を辿る。
				if (t.type === "operation" && (t.name === "apply" || t.name === "partial_apply")) {
					const { base, args } = applyChain(t);
					if (!isIdentifierNode(base)) continue;
					const callee = table.get(bareName(base.value));
					if (!callee) continue;
					for (const j of callee) {
						const a = unwrap(args[j]);
						if (!isIdentifierNode(a)) continue;
						const i = params.indexOf(a.value);
						if (i >= 0 && !set.has(i)) { set.add(i); changed = true; }
					}
				}
			}
		}
	}
	return table;
}

/**
 * 器を作るノードに「フレームより長生きするか」の印を付ける（`node.escapesFrame`）。
 * 印が無い＝出ないので、自分のフレームに置ける（`alloca`）。
 */
// 参照を運べる型。これ以外（数・文字・恒等射）は器を外へ持ち出せない。
const CONTAINER_TYPES = new Set(["String", "List", "Struct", "Iterator", "Implicit", "Address"]);

function markEscapes(nodes, returnedParams) {
	const visit = (n, escaping) => {
		const u = n;
		if (!u || typeof u !== "object") return;
		if (u.type === "operation" && COPRODUCT_BUILD_OPS.has(u.name)) u.escapesFrame = escaping;
		// 構造体ブロックも器である。`COPRODUCT_BUILD_OPS` は operation しか拾わないので、
		// ここで印を付けないと `escapesFrame` が undefined のまま残る——**判定していない
		// ことを「出て行く」と決めたことにしてしまい**、フレームに置ける形すら置けない。
		if (isStructBlock(u)) u.escapesFrame = escaping;
		// 呼び出しの引数は、呼び先がその位置を返すときだけ出て行く。
		if (u.type === "operation" && (u.name === "apply" || u.name === "partial_apply")) {
			const { base, args } = applyChain(u);
			const callee = isIdentifierNode(base) ? returnedParams.get(bareName(base.value)) : null;
			// 呼び先が分からないなら、安全側に倒して「出て行く」と見なす。
			const unknown = !isIdentifierNode(base) || !returnedParams.has(bareName(base.value));
			args.forEach((a, i) => visit(a, escaping && (unknown || (callee ? callee.has(i) : true))));
			visit(base, false);
			return;
		}
		// `|`（or）は値をそのまま通す。
		if (u.type === "operation" && u.name === "or") {
			visit(u.left, escaping);
			visit(u.right, escaping);
			return;
		}
		// 分岐は枝それぞれが結果になる。条件は結果にならない。
		if (Array.isArray(u.lines)) {
			const pass = u.kind === "norm" || u.kind === "abs" ? false : escaping;
			for (const line of u.lines) {
				if (isDefineNode(line)) { visit(line.left, false); visit(line.right, pass); }
				else visit(line, pass);
			}
			return;
		}
		// **結果が参照を運べないなら、そこで止まる。** 数え上げ（`||x||`）や添字（`x ' 0`）や
		// 算術は、器を受け取っても数や要素しか返さない——器そのものは外へ出ない。
		// 器を返しうる形（切り出し・組み直し・撒き）だけが値を通す。
		const carries = CONTAINER_TYPES.has(u.atomType) || u.atomType === undefined || u.atomType === null;
		for (const k of ["left", "right", "operand"]) visit(u[k], escaping && carries);
	};
	for (const node of nodes) {
		if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
		const rhs = node.right;
		if (!rhs || rhs.type !== "operation" || rhs.name !== "lambda") continue;
		visit(rhs.right, true); // 本体そのものが返値である
	}
	// **トップレベルは返さない。** ここに置いた器は `_.main` のフレームに在り、
	// 呼び出し元はエントリのスタブだけである——`bl _.main` の次は `wfe` で、返値を
	// 辿らない（entry_point.md）。フレームより長生きする先が無いので `sub sp` で置ける。
	//
	// ここを訪れていなかったため `escapesFrame` が `undefined` のまま残り、`!== false`
	// が「出て行く」と読んでいた。**判定していないことと、出て行くと判定したことは別**
	// である——前者を後者として扱うと、決めていないことを決めたことにしてしまう。
	for (const node of nodes) {
		if (isDefineNode(node) && isIdentifierNode(node.left)) {
			const rhs = node.right;
			if (rhs && rhs.type === "operation" && rhs.name === "lambda") continue;
			visit(rhs, false);
			continue;
		}
		visit(node, false);
	}
}

/**
 * **返す器の大きさの上界を、引数から求める。**
 *
 * 正確な個数は実行時に決まるが、**上界は静的に書ける**ことが多い——`d st~` は
 * `1 + ||st||`、`col board~` は `1 + ||board||` である。スロットは上界で足りるので、
 * これが分かれば呼び出し側が場所を用意できる（sret）。
 *
 * 「実行時にしか決まらない」で止まらず、**上界を疑う**のが要である。個数と上界は別の
 * 問いであり、後者の方がずっとよく決まる。
 *
 * @returns `{ konst, terms }`——`terms` は `{ sizeOf, coef, measure }` の並びで、上界は
 *   `konst + Σ coef×||sizeOf||`（`measure` が `chars` の項は `||·||` ではなく μ、つまり
 *   要素の長さの総和で測る）。`terms` が空なら定数。求まらなければ null。
 *   **再帰は扱う**——器を食う形も、器の中を指す添字で回る形も上界が出る。
 */
/** 直和に器が混じっていれば器である（`Int | List` は器になりうる）。 */
function isBoxType(t) {
	return String(t || "")
		.split(" | ")
		.map((x) => x.trim())
		.some((x) => ["String", "List", "Struct", "Iterator", "Implicit"].includes(x));
}

/**
 * **自己呼び出しが器の仮引数を食っているなら、その仮引数を返す。**
 *
 * `take_while p (s ' 1~)` は `s` を食っている——毎段1つずつ短くなるので、段数は
 * `||s||` で頭打ちになる。原理5（完全性公理）が言う「器を尽くすことで止まる」形が、
 * そのまま上界になっている。
 *
 * **そのまま渡しているだけは食っていない。** `try_col (col + 1) row n board` の
 * `board` は毎段同じなので、止まる理由が器の側に無い——段数は `board` からは出ない
 * （止めているのは `col > n` である）。ここを区別しないと、器から出ない再帰に器由来の
 * 有限な上界を付けてしまう。
 */
/**
 * **呼び合う塊を出す**（相互再帰の群）。
 *
 * `sep` と `in_quote` はお互いを呼ぶので、どちらの上界も相手が決まらなければ決まらない
 * ——一方向に流すと永久に起動しない。だが**器から見れば自己再帰と同じ**である：どちらの
 * 枝も「1つ食って、短くなった器で誰かを呼ぶ」でしかない。自分か相手かは呼び先の名前の
 * 違いであって、器の減り方は変わらない。
 *
 * だから群の中の呼び出しは自己呼び出しと同じに数える。`T(n) = k + T(n-1)` という漸化式は
 * 群全体で1つであり、解も1つである。
 */
function mutualGroups(nodes) {
	const calls = new Map(); // 名前 → 呼んでいる名前の集合
	for (const node of nodes) {
		if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
		const lam = node.right;
		if (!lam || lam.type !== "operation" || lam.name !== "lambda") continue;
		const to = new Set();
		const seen = new Set();
		const visit = (n) => {
			if (!n || typeof n !== "object" || seen.has(n)) return;
			seen.add(n);
			if (n.type === "operation" && n.name === "apply") {
				let h = n;
				while (h && h.type === "operation" && h.name === "apply") h = unwrap(h.left);
				if (isIdentifierNode(h)) to.add(bareName(h.value));
			}
			for (const k of ["left", "right", "operand"]) visit(n[k]);
			for (const l of n.lines || []) visit(l);
			for (const e of n.entries || []) visit(e.default);
		};
		visit(lam.right);
		calls.set(bareName(node.left.value), to);
	}
	// 到達可能性を推移閉包で出し、互いに到達できる名前を1つの群にする。
	const reach = new Map([...calls].map(([k, v]) => [k, new Set(v)]));
	for (let grew = true; grew; ) {
		grew = false;
		for (const [k, set] of reach) {
			for (const m of [...set]) {
				for (const x of reach.get(m) || []) {
					if (!set.has(x)) {
						set.add(x);
						grew = true;
					}
				}
			}
		}
	}
	const group = new Map();
	for (const k of calls.keys()) {
		const g = new Set([k]);
		for (const m of reach.get(k) || []) if ((reach.get(m) || new Set()).has(k)) g.add(m);
		group.set(k, g);
	}
	return group;
}

// **`apply` の鎖を、呼び先と実引数に分ける。** 左へ降りながら実引数を前から積む。
//
// `applyChain`（ファイル上部）とは**わざと**別である。あちらは `partial_apply` も同じ
// 鎖として読み、実引数を剥がさずに返す——出す側（部分適用の畳み）が括りごと要るから
// である。こちらは読む側（上界と sret の計画）で、`apply` だけを鎖と認め、実引数は
// `unwrap` して返す。**2つの綴りであって、1つではない。**
function applyParts(node) {
	const args = [];
	let head = node;
	while (head && head.type === "operation" && head.name === "apply") {
		args.unshift(unwrap(head.right));
		head = unwrap(head.left);
	}
	return { head, args };
}

function selfConsumes(part, name, params, restNames, group, defaults = null, indexedBy = null) {
	const bare = (s) => String(s).replace(/[<>]/g, "");
	const { head, args } = applyParts(part);
	// 自分か、呼び合う塊の中の誰かなら「食っている」。器の減り方は同じである。
	const isSelf = isIdentifierNode(head) && (bare(head.value) === bare(name) || (group && group.has(bare(head.value))));
	if (!args.length || !isSelf) return null;
	for (const arg of args) {
		// 裸の仮引数はそのまま渡しているだけ。式になっていて初めて「食った」と言える。
		//
		// **ただし分解した残りは違う。** `f : [c ~rest] ?` の `rest` は渡ってきた器の
		// 2要素目以降であり、`f rest` は名前1つでも**1要素食って進んでいる**。ここを
		// 「そのまま渡しただけ」と読んでいたため、ブラケットで分解して残りへ再帰する形
		// （`preprocess.sn` の大半）が上界を出せなかった。
		if (arg && isIdentifierNode(arg) && restNames && restNames.has(arg.value)) return arg.value;
		// **デフォルトを持つ名前は、その定義の側を見る。**
		//
		// `walk rest st bd jo` の `rest` は名前1つに見えるが、`rest : tail_line s` である
		// ——渡しているのは `s` を食った結果であって、そのまま素通ししているのではない。
		// ここを「裸の仮引数だから素通し」と読んでいたため、`walk` だけが上界を出せず
		// sret に乗らなかった。
		if (arg && isIdentifierNode(arg) && defaults && defaults.has(arg.value)) {
			let found = null;
			const dig = (x) => {
				if (!x || typeof x !== "object" || found) return;
				// **デフォルト式のノードには型が付いていない**（Pass 3 は根にしか付けない）ので、
				// 器かどうかでは選べない。**渡された仮引数**——自分がデフォルトを持たないもの
				// ——であることで選ぶ。器でなければ計画の側（幅 2 本の検査）が弾く。
				if (isIdentifierNode(x) && params.includes(x.value) && !defaults.has(x.value)) {
					found = x.value;
					return;
				}
				for (const k of ["left", "right", "operand"]) dig(x[k]);
				if (Array.isArray(x.lines)) x.lines.forEach(dig);
			};
			dig(defaults.get(arg.value));
			if (found) return found;
		}
		if (!arg || isIdentifierNode(arg)) continue;
		// **組んで渡す引数は「食う」のではなく「伸びる」。** 蓄積子がそれで、
		// `go (acc~ , (ts ' 0)) (ts ' 1~)` の第1引数は `acc` を**長くして**渡している。
		// ここを式の中の最初の器で選んでいたため `acc` を「食っている器」と読み、段数が
		// `||acc||` に比例すると見積もっていた——実際に段数を決めているのは短くして渡す方
		// （`ts`）である。**短くする方が食う方**であり、長くする方は結果の底になる。
		//
		// 伸びるぶんは撒いた器として別に数えられる（`refs`）ので、ここで拾う必要は無い。
		{
			const u = unwrap(arg);
			if (u && u.type === "operation" && COPRODUCT_BUILD_OPS.has(u.name)) continue;
		}
		let found = null;
		const walk = (x) => {
			if (!x || typeof x !== "object" || found) return;
			if (isIdentifierNode(x) && params.includes(x.value) && isBoxType(x.atomType)) {
				found = x.value;
				return;
			}
			for (const k of ["left", "right", "operand"]) walk(x[k]);
			if (Array.isArray(x.lines)) x.lines.forEach(walk);
		};
		walk(arg);
		if (found) return found;
	}
	// **添字で回る再帰の段数は、その添字が走る器が抑えている。**
	//
	// `mul_out ts i (j - 2)` は器を短くして渡さない——`ts` はそのままで、動くのは添字の
	// 方である。だが `j` は `ts` の中を指す添字なので、段数は `||ts||` を超えない。器を
	// 尽くす形（原理5）と同じことを、添字の側から言っているだけである。
	//
	// **これは証明ではなく見積もりである。** 呼ぶ側が上界の個数を x15 で渡し、呼ばれた側は
	// 書く直前にそれと比べる。証明を要求すると、添字で書いた再帰が丸ごと出せないままになる。
	//
	// **外れても壊れず `__` になる。** 照合（`emitSretCapacityGuard`）は写す枝と追記の枝の
	// 両方に入っている。この段落が守ろうとしている添字再帰は、要素がスカラーで末尾が自己
	// 呼び出しならまさに追記の枝へ落ちる——長らくそこに照合が無く、踏み抜いていた。
	// **根拠は「動く添字がその器を指していること」である。** `f (n + 1) s` のように器を
	// そのまま渡すだけの再帰は、止めているのが別の条件なので器からは上界が出ない
	// ——ここを緩めると、**止まらない再帰に有限のスロットを割り当ててしまう**。
	// `mul_out ts i (j - 2)` が通るのは `ts ' (j - 2)` と本体が書いているからである。
	if (!indexedBy || indexedBy.size === 0) return null;
	let moved = null;
	const movesInt = args.some((arg) => {
		if (!arg || arg.type !== "operation" || !["add", "sub"].includes(arg.name)) return false;
		const l = unwrap(arg.left);
		const r = unwrap(arg.right);
		const isParam = (x) => isIdentifierNode(x) && params.includes(x.value);
		const isConst = (x) => x && x.type === "atom" && x.kind === "number";
		if (isParam(l) && isConst(r)) moved = l.value;
		else if (isConst(l) && isParam(r)) moved = r.value;
		return moved !== null;
	});
	if (movesInt && moved) {
		for (const arg of args) {
			if (!arg || !isIdentifierNode(arg) || !params.includes(arg.value)) continue;
			if (!isBoxType(arg.atomType)) continue;
			if (indexedBy.has(arg.value + String.fromCharCode(0) + moved)) return arg.value;
		}
	}
	return null;
}

/**
 * その枝は「自分を呼んで、器の引数はそのまま渡している」形か。
 *
 * そうなら上界には何も足さない——返るものは自分の上界そのものだからである。器の位置が
 * 素の仮引数のままであることだけを見る（入れ替えや式になっていれば大きさが動きうる）。
 */
function selfCallSameArgs(part, name, params) {
	const bare = (s) => String(s).replace(/[<>]/g, "");
	const { head, args } = applyParts(part);
	if (!args.length || !isIdentifierNode(head) || bare(head.value) !== bare(name)) return false;
	// 器を受ける位置が、同じ仮引数そのものか、**その切り出し**であること。
	//
	// 切り出し（`s ' 1~`）を渡す自己呼び出しも上界を上げない。返るものは「より短い器に
	// 対する自分の上界」であり、`konst + coef × ||s||` から `coef` を引いた値以下だから
	// である。選択写像の「落ちたら並べずに再帰」がこの形で、ここを見ていなかったために
	// **上界が出せず sret に乗らなかった**——「同じ実引数」より広い、正しい条件はこちら。
	const sliceOf = (arg, p) => {
		let v = arg;
		while (v && v.type === "operation" && v.name === "get_prop") v = unwrap(v.left);
		return !!(p && isIdentifierNode(v) && v.value === p);
	};
	return args.every((arg, i) => {
		if (!arg) return false;
		if (isIdentifierNode(arg)) return !isBoxType(arg.atomType) || arg.value === params[i];
		if (isBoxType(arg.atomType)) return sliceOf(arg, params[i]);
		return true; // 式ならスカラーだけ許す
	});
}

/**
 * 上界を測るときに「その位置の器」を指す名前。位置ごとに1つ。
 *
 * **分解した残りは、同じ器の続きである。** `f : [c ~rest] ?` の `rest` は渡ってきた器の
 * 2要素目以降であり、そこへ再帰する形（`c (f rest)`）は「同じ器を食いながら進む」ことに
 * ほかならない。ここを見ていなかったため、**ブラケットで分解して残りへ再帰する形だけが
 * 上界を出せなかった**——`preprocess.sn` の `sep` / `in_quote` / `head_line` / `gap` /
 * `walk` がどれもこの形である。
 *
 * 測るのは呼ぶ側なので、渡された器の `len` で測る。`||rest||` は `||器|| - 1` なので
 * 1要素ぶん多く見積もることになるが、**上界なので安全側**である。
 */
function boundParamNames(lam) {
	return paramShapesOf(lam.left).map((sh) =>
		sh && (sh.kind === "bare" || sh.whole) ? sh.name : sh && sh.kind === "destructure" ? sh.rest : null
	);
}

/**
 * **上界には測り方が2つある。**
 *
 * いままで項は `coef × ||p||`（要素数）しか書けなかった。だが `String` を組むときに要る
 * のは中身の総量である——`ts` が語の並び（`List(String)`）なら、`ts ' o` を平らへ写す
 * ぶんは `||ts||`（語の個数）では抑えられない。要るのは **μ||ts||**（平らにしてからの
 * 個数＝全語の文字数の和）である。
 *
 * どちらで測るかは**返す器の μ が決める**（原理7：`String` の μ は強制、`List` は任意）。
 * 要素が終端（`Char`/`Int`）なら μ||p|| = ||p|| で今までのまま、要素が器なら
 * `{ptr, len}` の並びを走査して `len` を足す。
 *
 * 印は**名前に付けて Map の鍵にする**。合流（`addRef` の和・`addTerm` の max）は文字列を
 * 鍵にしているので、印を鍵の一部にすれば同じ規則がそのまま効く——測り方が違う項は別物
 * として扱われ、混ざらない。計画へ入れる直前に落として `measure` の欄にする。
 */
const MU_MARK = "μ:";
const muKey = (nm) => MU_MARK + nm;
const bareMeasureName = (nm) => (typeof nm === "string" && nm.startsWith(MU_MARK) ? nm.slice(MU_MARK.length) : nm);
const measureOfKey = (nm) => (typeof nm === "string" && nm.startsWith(MU_MARK) ? "chars" : "len");

/**
 * その部分は**仮引数の器の「要素そのもの」**か。だとしたら底の仮引数の名前を返す。
 *
 * `ts ' o` は語1つであり、その文字数は `||ts||` では言えない。だが**どの要素も μ||ts||
 * を超えない**ので、μ の項1つで抑えられる。同じ節に k 回現れれば k×μ||ts||——並置は
 * 直積なので和である（`addRef`）。
 *
 * 切片（`ts ' o~`、添字が `Iterator`）は要素ではなく器そのものなので、今まで通り `len`
 * で測る。底が `String` の `s ' i` は `Char`（スカラー）なので、そもそもここへ来ない。
 */
// **実引数の底にある仮引数を探す歩き**（μ と `len` で共有）。後置 `~`（撒く）と添字を
// 剥がしながら左へ降り、着いた名前が仮引数で器ならそれを返す。
//
// **違いは `slicesOnly` だけである。** `len` で測るときに限り、添字は切片（`Iterator`）で
// なければならない——同じ形でも測り方が違えば別の話で、その理由は下の2つに書いてある。
function dominatingParam(a0, params, slicesOnly) {
	let a = unwrap(a0);
	for (let i = 0; i < 16 && a; i++) {
		if (a.type === "operation" && a.position === "postfix" && a.name === "expand" && a.operand) {
			a = unwrap(a.operand);
			continue;
		}
		if (a.type === "operation" && a.name === "get_prop" && a.left) {
			if (slicesOnly) {
				const idx = unwrap(a.right);
				if (!idx || idx.atomType !== "Iterator") return null; // 切片だけ。要素は器を跨ぐ
			}
			a = unwrap(a.left);
			continue;
		}
		break;
	}
	if (!isIdentifierNode(a) || !params.includes(a.value)) return null;
	return isBoxType(a.atomType) ? a.value : null;
}

/**
 * **その実引数の μ を抑える仮引数**（無ければ null）。
 *
 * μ は「平らにしたときの総量」であり、**選び出しでは増えない**——`p ' 1~` は要素を後ろから
 * 取るだけ、`p ' i` は1つ取るだけで、どちらも中身の総量は `μ||p||` を超えない。後置 `~`
 * （撒く）も並べ方を変えるだけで総量は同じである。
 *
 * だから実引数がそれらで組まれているなら、呼び先の μ の項は**底の仮引数の μ へ言い換え
 * られる**。ここが無かったので、μ で上界を持つ関数へ切片を渡した瞬間に「上界が出せない」
 * になっていた（`out (ts ' 1~) …` の形）。
 *
 * **`len` の側と同じ言い換えではない。** `||p ' 1~||` は `||p||` より小さいが1つ減るだけで、
 * 定数の引き算が要る——μ にはそれが要らない（総量は単調に減るだけ）ぶん、こちらの方が
 * 素直に言える。
 */
function muDominatingParam(a0, params) { return dominatingParam(a0, params, false); }

/**
 * **その実引数の要素数を抑える仮引数**（無ければ null）。`muDominatingParam` の `len` 版。
 *
 * **切片は要素を増やさない**——`p ' 1~` は後ろから取るだけなので `||p ' 1~|| ≤ ||p||` である。
 * 定数を引けばもっと締まるが、上界なのでそのままでよい。
 *
 * **要素の取り出し（`p ' i`）はここに入れてはならない。** `List(String)` の要素は文字列で
 * あり、その `len` は文字数——`||p||`（語の個数）とは何の関係も無い。μ の側なら「どの要素も
 * μ||p|| を超えない」と言えるが、`len` では言えない。**同じ形でも測り方が違えば別の話**である。
 */
function lenDominatingParam(a0, params) { return dominatingParam(a0, params, true); }

function flatBaseParam(q0, params) {
	const q = unwrap(q0);
	if (!q || q.type !== "operation" || q.name !== "get_prop") return null;
	const base = unwrap(q.left);
	const idx = unwrap(q.right);
	if (!isIdentifierNode(base) || !params.includes(base.value)) return null;
	if (!isBoxType(base.atomType)) return null; // 底が器でなければ要素を取れない
	if (idx && idx.atomType === "Iterator") return null; // 切片は要素ではない
	if (!isBoxType(q.atomType)) return null; // 要素が器でなければ len で足りる
	return base.value;
}

/** その節が指しうる**値ノードの候補**（決まらなければ null）。実行時の鍵なら全行が候補である。 */
function staticValueNodes(node, env, seen) {
	const u = unwrap(node);
	if (!u || !env) return null;
	if (isIdentifierNode(u)) {
		if (seen.has(u.value)) return null; // 名前が輪になっている
		seen.add(u.value);
		const b = envLookup(env, u.value);
		if (!b || b.addressTaken) return null; // 仮引数（値ノードが無い）・場所を持つ束縛
		const v = b.valueNode || b.rhsNode;
		return v ? staticValueNodes(v, env, seen) : null;
	}
	if (u.type === "operation" && u.name === "get_prop") {
		const bases = staticValueNodes(u.left, env, seen);
		if (!bases) return null;
		const key = unwrap(u.right);
		const spelling = slotKeySpelling(key, env); // 実行時に決まる鍵なら null
		const out = [];
		for (const base of bases) {
			if (!Array.isArray(base.lines) || base.slotKind !== "named") return null;
			let hit = false;
			for (const line of base.lines) {
				const l = unwrap(line);
				if (!isDefineNode(l) || !isSlotKeyAtom(l.left)) return null; // 全行が `名前 : 値` でなければ表ではない
				if (spelling !== null && slotName(l.left.value) !== spelling) continue;
				hit = true;
				const vs = staticValueNodes(l.right, env, new Set(seen));
				if (!vs) return null;
				out.push(...vs);
			}
			if (!hit) return null;
		}
		return out.length ? out : null;
	}
	return [u];
}

/**
 * その部分の**中身の総量（μ）が静的に測れる**なら、その上界。測れなければ null。
 *
 * 呼び出しの結果は辿らない——辿れば「その関数が返す値」を一つに決めたことになる。
 */
function staticMuBound(q0, env, seen = new Set()) {
	if (!env) return null;
	const vs = staticValueNodes(q0, env, seen);
	if (!vs) return null;
	let m = 0;
	for (const u of vs) {
		let one = null;
		if (u.type === "atom" && (u.value === "_" || u.value === "__")) one = 0;
		else if (u.type === "atom" && u.kind === "string") one = [...String(u.value).replace(/^`|`$/g, "")].length;
		// **スカラーは数えない。** 何要素になるかは**落ちる先の器が決める**——`List` なら
		// 1つだが、`String` は吸って**綴りにする**（解釈器は `51` を `` `51` `` と2文字に
		// 綴る）。ここからは落ちる先が見えないので、1と決め打つと短く見積もる。
		// 実測：`a : 51` を `` `\t` b a `` へ置くと、解釈器 6・機械 5 になった。
		if (one === null) return null; // 字面の綴りだけ。組んだ列もスカラーも数えない
		m = Math.max(m, one); // 実行時に選ばれうる行の最大
	}
	return m;
}

/**
 * その部分が「上界の分かっている関数の呼び出し」なら、その上界を**こちらの仮引数で
 * 言い換えて**返す。言い換えられなければ null。
 *
 * 呼び先の上界は `konst + coef × ||第 i 引数||` の形をしている。第 i 引数としてこちらの
 * 仮引数をそのまま渡しているなら、測るのはどちらも呼ぶ側なので同じ `len` を見ればよい。
 * 式にして渡している形（`closers (pop st) d`）は、長さが変わりうるので言い換えられない
 * ——そこは諦める。
 */
function boundedCallOf(part, known, params) {
	const u = unwrap(part);
	if (!u || u.type !== "operation" || u.name !== "apply") return null;
	const { head, args } = applyParts(u);
	if (!isIdentifierNode(head)) return null;
	const p = known.get(bareName(head.value));
	if (!p) return null;
	// **呼び先も器ごとの項を持つ。** ここが `sizeOfIndex` を読んだままだと、計画が項の
	// 並びになった時点で `undefined` に落ち、**器の項を黙って捨てる**——上界が痩せて
	// 確保が足りなくなり、照合が `__` を返す。実際それで preprocess が回った。
	// **引数が式なら、その上界と合成する。**
	//
	// 上界はどれも `konst + Σ coef×||器||` の形なので、合成しても同じ形に閉じる：
	//
	//     ||f x|| ≤ k₂ + c₂×||x||、||x|| ≤ k₁ + c₁×||p||
	//     ⇒ ||f x|| ≤ (k₂ + c₂k₁) + (c₂c₁)×||p||
	//
	// `close_all (next_st st d)` がこれで、辿らないと「引数が仮引数ではない」で諦める
	// ——だが呼ぶ側は `st` を持っているのだから、`st` の式へ言い換えれば測れる。
	// **同じ器へ2回書くなら、要る場所は2倍である。**
	//
	// ここは長らく max だった——呼び先の上界が c1×||a|| + c2×||b|| のとき、同じ実引数を
	// 2つの位置へ渡すと（f s s）本当は (c1+c2)×||s|| 要るのに、max(c1,c2)×||s|| と見積もって
	// いた。実測：f : a b ? a b と g : s ? f s s で、||g "abc"|| が 6 ではなく __ になる。
	// **踏み抜かないのは照合が効いているからで、上界が正しいからではない。**
	//
	// 枝の中は和・枝どうしは max、という規則は addRef 側で既に効いている。ここは1つの
	// 呼び出しの引数どうし——つまり直積なので、和である。
	const merged = new Map();
	const addMerged = (k, c) => merged.set(k, (merged.get(k) || 0) + c);
	let konstAcc = p.konst;
	for (const t of p.terms || []) {
		const a = args[t.sizeOfIndex];
		// **測り方も一緒に運ぶ。** 呼び先が μ で測る項を持つなら、こちらの仮引数を渡した
		// ときの項も μ である——測るのはどちらも同じ器だからである。
		if (isIdentifierNode(a) && params.includes(a.value)) {
			const key = t.measure === "chars" ? muKey(a.value) : a.value;
			addMerged(key, t.coef);
			continue;
		}
		// **μ の項は μ の言葉で言い換える。** 下の2つの道——長さの分かる実引数を定数へ畳む、
		// 内側の上界と合成する——はどちらも「要素数」の言葉で書かれているので、そのままでは
		// 使えない。μ には μ 用の言い換えが要る：
		//
		//   選び出しで組んだ実引数（`p ' 1~`、`p ' i`、後置 `~`）→ μ は `μ||p||` を超えない
		//   書いた時点で中身が分かる実引数（リテラル・スカラー・`__`）→ 定数へ畳む
		//
		// **残るのは「呼び出しの結果を渡す」形だけ**である。そこは `μ||f x||` を `μ||x||` と
		// `||x||` で書く法——上界の言語をスカラーから2つ組へ上げること——が要るので、まだ
		// 諦める（諦めれば上界を持たないと言うだけで、痩せた上界を黙って使うことにはならない）。
		if (t.measure === "chars") {
			const mb = muDominatingParam(a, params);
			if (mb) {
				const key = muKey(mb);
				addMerged(key, t.coef);
				continue;
			}
			const km = knownLengthOf(a);
			if (km !== null) {
				konstAcc += t.coef * km;
				continue;
			}
			return null;
		}
		// **長さが分かっている実引数は定数に畳む。** `walk s bottom 0 0` の `bottom` は
		// `0`——スカラーである。器の位置へ渡すと**長さ1の器へ持ち上がる**（原理8）ので
		// `||bottom|| = 1` と言える。ここで諦めると `mark` が計画に載らず、器を自分の
		// フレームに置いて返す——エピローグが捨てた場所を指したまま返っていた。
		const fixed = knownLengthOf(a);
		if (fixed !== null) {
			konstAcc += t.coef * fixed;
			continue;
		}
		// **切片で組んだ実引数は、底の仮引数で抑えられる**（`lenDominatingParam`）。μ の側と
		// 同じ規則だが、こちらは切片だけ——要素の取り出しは器を跨ぐので言えない。
		const lb = lenDominatingParam(a, params);
		if (lb) {
			addMerged(lb, t.coef);
			continue;
		}
		const inner = boundedCallOf(a, known, params);
		if (!inner) return null;
		konstAcc += t.coef * inner.konst;
		for (const it of inner.terms) {
			const c = t.coef * it.coef;
			addMerged(it.sizeOf, c);
		}
	}
	return { konst: konstAcc, terms: [...merged].map(([sizeOf, coef]) => ({ sizeOf, coef })) };
}

/**
 * その実引数の**長さは分かるか**。分からないなら null。
 *
 * 器の位置へスカラーを渡すと長さ1の器になる（`emitLiftToContainer`——同型は型では
 * 無償、表現では有償）。`__` は長さ0である。リテラルは書いてある通りの長さを持つ。
 * それ以外（名前で来た器）は中身が見えないので分からないと言う（原理4）。
 *
 * **μ（平らにしたときの総量）も、今はここへ訊く。** 別名 `knownMuOf` が同じ本文の写し
 * として在ったが、答えは1字も違わなかった——「要素が何個か」と「中身が何文字か」が
 * 分かれるのは要素がまた器のときだけで、その答えはここには無い（名前で来た器は null）。
 * **分けるなら設計であって、写しではない。**
 */
function knownLengthOf(node) {
	const u = unwrap(node);
	if (!u) return null;
	if (u.type === "atom" && u.kind === "unit") return 0;
	const t = u.atomType;
	if (t && !isBoxType(t)) return 1; // スカラーは持ち上がって長さ1
	return null;
}

/**
 * その部分は**リテラルとして何要素置くか**。分からなければ null。
 *
 * 要素が `Char` の器へ `` `[[` `` を並べれば2要素である——器だからといって「個数が
 * 決まらない」わけではない。**書いてあるものは数えられる。** 要素の側が器なら、文字列は
 * 1つの要素なのでここでは答えない（その道は別にある）。
 */
function literalElemCount(q, elemType) {
	if (!q || q.type !== "atom" || q.kind !== "string") return null;
	if (!elemType || isBoxType(elemType)) return null;
	return [...String(q.value || "").replace(/^`|`$/g, "")].length;
}

function returnSizeBound(lam, name, known, group, env = null) {
	const params = boundParamNames(lam);
	// 要素の型。**要素が器なら、器を1つ置くのは1要素である**——並べるものが器だから
	// といって個数が決まらないわけではない（幅は `passingOf` が答える）。
	const elemType = (() => {
		const body = lam.right;
		const ls = Array.isArray(body && body.lines) ? body.lines.map((l) => (isDefineNode(l) ? l.right : l)) : [body];
		for (const l of ls) {
			const u = unwrap(l);
			if (u && u.elementType) return u.elementType;
		}
		return null;
	})();
	// 分解した残りの名前。`f rest` は名前1つでも1要素食っている。
	const restNames = new Set(paramShapesOf(lam.left).filter((sh) => sh && sh.kind === "destructure").map((sh) => sh.rest));
	// デフォルトを持つ名前 → その定義。名前1つに見えても、渡しているのは式の結果である。
	const defaults = new Map(
		((lam.left && lam.left.entries) || []).filter((e) => e.name && e.default).map((e) => [e.name, e.default])
	);
	const arms = Array.isArray(lam.right && lam.right.lines) ? lam.right.lines.map((l) => (isDefineNode(l) ? l.right : l)) : [lam.right];
	// **本体に現れる「器 ' 添字」の組。** 添字で回る再帰の段数をその器で抑えてよいかの
	// 根拠であり、書いていないなら抑えられない（原理4）。
	const indexedBy = new Set();
	const digNames = (y, out) => {
		if (!y || typeof y !== "object") return;
		if (isIdentifierNode(y) && params.includes(y.value)) out.push(y.value);
		for (const kk of ["left", "right", "operand"]) digNames(y[kk], out);
		// **括りの中も見る。** `ts ' (j - 2)` の添字は括弧の中にある。
		for (const l of y.lines || []) digNames(l, out);
	};
	const scanIdx = (x) => {
		if (!x || typeof x !== "object") return;
		if (x.type === "operation" && x.name === "get_prop") {
			const c = unwrap(x.left);
			if (isIdentifierNode(c) && params.includes(c.value)) {
				const ns = [];
				digNames(x.right, ns);
				for (const nm of ns) indexedBy.add(c.value + String.fromCharCode(0) + nm);
			}
		}
		for (const kk of ["left", "right", "operand"]) scanIdx(x[kk]);
		for (const l of x.lines || []) scanIdx(l);
	};
	scanIdx(lam.right);
	// **輪の中で器をそのまま渡す呼び出しは、輪の再帰である。**
	//
	// 相互再帰の輪では、器を食う（動く添字で引く）のは輪の誰か1人で、残りは器をそのまま
	// 次へ渡す。parser.sn の `out_jk` がそれで、本体に `ts ' …` を書いていないので自分の節
	// だけでは「食う」と言えず、`out` への2回の呼び出しを**既知の上界**で足していた。輪の
	// 全員はその最大を拾うので、次の周に `out` が 2 倍になり、`out_jk` がまた 2 倍にする
	// ——上界が周ごとに倍々に伸び、計画は伸びている途中の値で止まっていた（外側ほど古い）。
	//
	// **根拠は輪の側に在る。** 輪の誰かが器を動く添字で引いているなら（`selfConsumes` が
	// そう言った器）、同じ器をそのまま渡す輪の呼び出しも同じ再帰の段である。1周ぶんの
	// 上界は輪の中で決まり、足し込まないので伸びない。根拠を持たない輪は今まで通りで、
	// 上界が収束しなければ計画から外れる（`collectSretPlan`）。
	//
	// **これも見積もりである**（上の `selfConsumes` の段落と同じ）。根拠にするのは本物の
	// 「食う」だけで、この規則で数えた呼び出しは根拠に足さない——輪が自分で自分を支えない。
	const ownEats = new Set();
	const scanCalls = (x) => {
		if (!x || typeof x !== "object") return;
		if (x.type === "operation" && x.name === "apply") {
			const e = selfConsumes(x, name, params, restNames, group, defaults, indexedBy);
			if (e) ownEats.add(e);
		}
		for (const kk of ["left", "right", "operand"]) scanCalls(x[kk]);
		for (const l of x.lines || []) scanCalls(l);
	};
	scanCalls(lam.right);
	const ringEvidence = new Set(ownEats);
	if (group && known) for (const m of group) for (const e of (known.get(m) || {}).eats || []) ringEvidence.add(e);
	const ringEaten = (q) => {
		const { head, args } = applyParts(q);
		if (!isIdentifierNode(head) || !group || !group.has(bareName(head.value))) return null;
		for (const a of args) {
			if (a && isIdentifierNode(a) && params.includes(a.value) && isBoxType(a.atomType) && ringEvidence.has(a.value)) return a.value;
		}
		return null;
	};
	let konst = 0;
	// **器ごとに係数を持つ。** 上界は `konst + Σ coef_i × ||器_i||` である。
	//
	// 1変数（`konst + coef × ||sizeOf||`）では `walk` が書けない——各段が「続きを歩く」
	// （入力 `s` に比例）か「残りの段を閉じる」（スタック `st` に比例）かを選ぶので、
	// **2つの器を同時に食っている**。選択なので実際には片方だが、和で抑えれば線形のまま
	// 上から押さえられる（`max(a,b) ≤ a + b`）。
	const terms = new Map();
	const addTerm = (nm, c) => { if (nm) terms.set(nm, Math.max(terms.get(nm) || 0, c)); };
	for (const arm of arms) {
		const a = unwrap(arm);
		if (!a) return null;
		// `__` を返す枝は 0 要素。上界には効かない。
		if (a.type === "atom" && (a.value === "_" || a.value === "__")) continue;
		// 文字列リテラルの枝は、その文字数ぶん。空文字列（`` ` ` ``）は 0 要素であり、
		// これが構造的再帰の底になっている——`take_while` の「尽きたら空を返す」枝である。
		if (a.type === "atom" && a.kind === "string") {
			konst = Math.max(konst, [...String(a.value || "").replace(/^`|`$/g, "")].length);
			continue;
		}
		// **同じものを渡す自己呼び出しは、上界に何も足さない。** `f (n + 1) a b` は
		// 器の引数を素通しするので、返るものの大きさは自分の上界そのものである
		// （`T = T`）——上界は他の枝で決まる。ここで諦めていたため、`n > 3 : a b` の
		// ような**定数の底を持つ形**まで sret に乗らなかった。
		//
		// 器の位置が同じ仮引数のままであることを見る。入れ替えたり式にしたりしていれば
		// 大きさが動きうるので、そこは諦める。
		if (selfCallSameArgs(a, name, params)) continue;
		// **組まない枝も、同じ歩き方に通す。**
		//
		// 以前ここで「器を組まない枝が器を返すなら諦める」としていたが、下の `walkBound`
		// は組まない節点を**1要素の並び**として扱えるので、通せば同じ規則で数えられる
		// ——仮引数そのものを返す枝（`strip_head` の `rest`）は「撒いた仮引数」と同じ、
		// 上界の分かっている呼び出しは `boundedCallOf` と同じである。
		//
		// スカラーを返す枝が長さ1の器（`[x] ≅ x`）になるのも、歩いた先の `k += 1` が
		// そのまま言っている。手前で分ける理由が無い。
		// 連なりを平らにする（括弧の中が連接なら1要素——剥いではいけない）。
		const parts = [];
		let cur = a;
		const peel = (x) => peelGroup(x, elemType === "Char");
		// **結合の向きに依存しない歩き方をする。** 片方へ降りるループは「左結合で積まれて
		// いる」を前提にしており、右結合の連鎖（`a , (b , c)`）を1要素と数えて上界を
		// 少なく見積もる。左右とも再帰で開く。
		const walkBound = (x) => {
			const v = peel(x);
			if (v && v.type === "operation" && COPRODUCT_BUILD_OPS.has(v.name)) {
				walkBound(v.left);
				walkBound(v.right);
				return;
			}
			parts.push(v);
		};
		// **選択の上界は、両辺の大きい方である。**
		//
		// `a | b` はどちらかを返すので、出る要素数は多い方を超えない——**足し算ではない**。
		// `walk` は各段で「続きを歩く」か「残りの段を閉じる」かを選ぶので、ここが無いと
		// 上界が出ない（`or` は呼び出しではないので `boundedCallOf` が答えられず、器を
		// 返すぶんだけ「幅が決まらない」に落ちていた）。
		//
		// 部分1つの寄与は `{k, ref, rec}`——定数の個数、比例する器、食っている器である。
		// 選択では `k` を max で合流し、器は同じものでなければ諦める（和になる）。
		const contributionOf = (q0) => {
			const q = unwrap(q0);
			if (!q) return null;
			if (q.type === "operation" && q.name === "or") {
				const l = contributionOf(q.left);
				const r = contributionOf(q.right);
				if (!l || !r) return null;
				if (l.rec && r.rec && l.rec !== r.rec) return null;
				const m = new Map(l.refs);
				for (const [nm, c] of r.refs) m.set(nm, Math.max(m.get(nm) || 0, c));
				return { k: Math.max(l.k, r.k), refs: m, rec: l.rec || r.rec };
			}
			if (isIdentifierNode(q) && params.includes(q.value)) {
				const t = q.atomType;
				return t && !isBoxType(t)
					? { k: 1, refs: new Map(), rec: null }
					: { k: 0, refs: new Map([[q.value, 1]]), rec: null };
			}
			const eaten0 = selfConsumes(q, name, params, restNames, group, defaults, indexedBy) || ringEaten(q);
			if (eaten0) return { k: 0, refs: new Map(), rec: eaten0 };
			const b0 = known ? boundedCallOf(q, known, params) : null;
			if (b0) return { k: b0.konst, refs: new Map(b0.terms.map((t) => [t.sizeOf, t.coef])), rec: null };
			const lit0 = literalElemCount(q, elemType);
			if (lit0 !== null) return { k: lit0, refs: new Map(), rec: null };
			if (isBoxType(q.atomType) && !(elemType && isBoxType(elemType))) {
				// **器の要素を平らへ写すぶんは μ で測れる。** ここで諦めていたので、語の並びを
				// 受け取って文字列を組む形（parser.sn の `out_one`）が上界を持てなかった。
				const mu0 = flatBaseParam(q, params);
				if (mu0) return { k: 0, refs: new Map([[muKey(mu0), 1]]), rec: null };
				const kn0 = staticMuBound(q, env);
				if (kn0 !== null) return { k: kn0, refs: new Map(), rec: null };
				return null;
			}
			return { k: 1, refs: new Map(), rec: null };
		};

		walkBound(cur);
		let k = 0;
		// **撒く器は1つとは限らない。** 呼び先が複数の器に比例する形（`walk`）があるので、
		// 名前1つでは足りない。
		const refs = new Map();
		// **枝の中は和、枝どうしは max。** `parts` は1つの節の連接を平らにしたもの、つまり
		// 直積である——`s s` は `s` を2回書くので上界は `2×||s||` になる。定数 `k` は
		// 既に `+=` で足しているのに器の参照だけ `max` で潰していたので、同じ器を2回
		// 並べる形の上界が半分になっていた（実測：`h : s ? s s` は24文字で実機が
		// スタックを踏み抜く。4/8/12 文字は16バイト丸めが隠す）。
		//
		// max が正しいのは**選択の合流**だけである——節どうしを束ねる `addTerm` と、
		// 部分の中の `a | b`（`contributionOf` の or 枝）。どちらかしか返らないので
		// 多い方で抑えれば足りる。
		const addRef = (nm, c) => { if (nm) refs.set(nm, (refs.get(nm) || 0) + c); };
		let rec = null; // 自己呼び出しが食っている仮引数
		// **静的な綴りの項と、「それ以外は1要素」の数え方を同じ節で混ぜない。**
		//
		// 末尾の `k += 1` は**落ちる先が `List` なら**正しいが、`String` は数を吸って
		// 綴りにする（解釈器は `51` を2文字に綴る）ので、そこでは足りない。これは前から
		// ある数え違いで、`a : 51` を返す形は HEAD でも解釈器 3・機械 2 と食い違う。
		//
		// 直せば筋は通るが、それは**この変更の外**の話である。ここで要るのは
		// 「断りが誤答に化けない」ことだけなので、**新しい項が効いた節では混ぜない**。
		// 実測：`a : 51` / `b : ``add`` ` の `` `\t` b a `` が、混ぜると 5（正しくは 6）を
		// 返した——断りが誤答へ化ける唯一の道だった。
		let usedStatic = false;
		let looseScalar = false;
		for (const p of parts) {
			// 撒いた仮引数（`st~`）と裸の仮引数は、その器の要素数ぶん。
			const q = p && p.type === "operation" && p.position === "postfix" && p.name === "expand" ? unwrap(p.operand) : p;
			if (isIdentifierNode(q) && params.includes(q.value)) {
				const t = q.atomType;
				// **直和に器が混じっていれば器である**（`Int | List` は器になりうる）。
				// 広い方へ揃えるのと同じ理由で、大きさも広い方で見なければ足りない。
				if (t && !isBoxType(t)) {
					k += 1; // スカラーの仮引数は1要素
					continue;
				}
				addRef(q.value, 1);
				continue;
			}
			// **自己呼び出しは、食っている器の要素数ぶん。** ここで諦めていたのが、
			// 器を返す関数のほとんどが再帰である以上そのまま sret を塞いでいた。
			const eaten = selfConsumes(q, name, params, restNames, group, defaults, indexedBy) || ringEaten(q);
			if (eaten) {
				if (rec && rec !== eaten) return null; // 1枝で2つ食う形はまだ扱わない
				rec = eaten;
				continue;
			}
			// **上界が分かっている関数の呼び出しは、その上界ぶん。**
			//
			// `gap : st d ? … (closers st d) newline` の `closers` は自分では無いので
			// 自己呼び出しには当たらないが、上界は既に出ている。渡している器がこちらの
			// 仮引数そのものなら、その上界を**自分の仮引数で言い換えられる**——測るのは
			// どちらも呼ぶ側なので、同じ `len` を見ればよい。
			//
			// 定義の順序で決まらないよう、計画は不動点で回している（`collectSretPlan`）。
			const bounded = known ? boundedCallOf(q, known, params) : null;
			if (bounded) {
				// 定数のぶんは要素数として数える。器に比例するぶんは「撒く器」と同じ扱い。
				k += bounded.konst;
				for (const t of bounded.terms) addRef(t.sizeOf, t.coef);
				continue;
			}
			// それ以外は1要素とみなせるものだけ。
			//
			// **器でも、それが要素そのものなら1つである。** 要素の型が器のとき
			// （`List(String)` のトークン列がそれ）、並べるものが器なのは当たり前で
			// あって「個数が決まらない」わけではない——並ぶ幅は `passingOf` が答える
			// （`{ptr, len}` の2語）。ここで諦めていたため、**要素が `String` の器を
			// 返す関数**が丸ごと sret に乗らなかった（lexer.sn の `tokens`）。
			//
			// 撒いた器（`st~`）はこの手前で拾われている。ここへ来るのは撒いていない
			// ——つまり1要素として置かれるものである。
			if (!q) return null;
			// 選択は両辺の大きい方（上の `contributionOf`）。
			if (q.type === "operation" && q.name === "or") {
				const c = contributionOf(q);
				if (!c) return null;
				k += c.k;
				for (const [nm, cc] of c.refs) addRef(nm, cc);
				if (c.rec) {
					if (rec && rec !== c.rec) return null;
					rec = c.rec;
				}
				continue;
			}
			const lit = literalElemCount(q, elemType);
			if (lit !== null) {
				k += lit;
				continue;
			}
			if (isBoxType(q.atomType) && !(elemType && isBoxType(elemType))) {
				// **器の要素を平らへ写すぶんは μ で測れる**（`flatBaseParam`）。並置は直積
				// なので、同じ節に k 回現れれば k×μ||p||——`addRef` が和で足す。
				const mu = flatBaseParam(q, params);
				if (mu) { addRef(muKey(mu), 1); continue; }
				const kn = staticMuBound(q, env);
				if (kn === null) return null;
				usedStatic = true;
				k += kn;
				continue;
			}
			looseScalar = true;
			k += 1;
		}
		if (usedStatic && looseScalar) return null;
		// **食いながら撒く枝は、証明ではなく見積もりで通す。**
		//
		// `(take_while p s) , (tokens (drop_while p s))~` は撒き（`ref`）と食い（`rec`）が
		// 同居しており、線形の漸化式にならない——一般には `s , (f (s ' 1~))~` のように
		// 二次になりうる形である。ここで諦めていたので lexer.sn の `tokens` が sret に
		// 乗らなかった。
		//
		// **この形が線形なのは `take_while` と `drop_while` が `s` を分割するから**であって、
		// 本体を読んでも出てこない事実である。片側だけで正しさを決めようとしていたのが誤り
		// だった——確保の正しさは呼ぶ側と呼ばれた側の**関係**が定める。
		//
		// 同じ器を撒いて食っているなら、段ごとの寄与はその段で消えたぶんを超えないと
		// **見積もる**。証明ではないので外れうるが、**外れても壊れない**——呼ばれた側が
		// 同じ式を計算して照合し（`emitSretCapacityGuard`）、越えたら `__` を返す。
		if (rec) {
			// `T(n) = k + T(n-1)`、底は `konst`。解くと `konst + k × ||p||` である。
			// **段ごとの定数が係数になる**——`c c (dup rest)` なら 2 である。
			//
			// **1周の費用は輪が言う。** 相互再帰では「1段」が自分の節で閉じない——
			// parser.sn は `out → out_at → out_as → out_one → out` と回り、7文字を書くのは
			// `out_one` だけである。自分の `k` だけで係数を決めると `out` は 0（→ 1）に
			// なり、`out_at` も `expr` も小さい方を引き継ぐ。**同じ器を返す輪なのに上界が
			// 2種類**あり、一番外側が一番小さいのを使って `sub sp` していた
			// （実測：n=5 で 6 バイト要求に対し 17 文字を書き、n≥7 で qemu が踏み抜く）。
			//
			// 輪の誰か1人が払う定数は、輪の全員が払う。だから段の費用は輪の最大を採る。
			// 計画は不動点で回っているので、1周目に `out_one` が出した 8 を2周目に `out`
			// が読む——**上界がどこか1箇所で決まる**という形はここで閉じている。
			let step = Math.max(k, 1);
			if (group && known)
				for (const m of group) {
					if (m === name) continue;
					const e = known.get(m);
					for (const tm of (e && e.terms) || []) step = Math.max(step, tm.coef);
				}
			addTerm(rec, step);
			// 食いながら撒く枝は、撒く器のぶんも項として持つ。**別々の器でも和で書ける**
			// ——1変数しか持てなかったので、ここで諦めていた。
			for (const [nm, c] of refs) if (nm !== rec) addTerm(nm, c);
			continue;
		}
		konst = Math.max(konst, k);
		for (const [nm, c] of refs) addTerm(nm, c);
	}
	// **項の相手は「渡された引数」でなければならない。**
	//
	// 容量は呼ぶ側と呼ばれた側が同じ式を独立に計算する法則である。呼ぶ側は `line` や `b`
	// を持っていない——それを埋めるのは呼ばれた側だからである。だからデフォルトを持つ名前は、
	// その定義を辿って渡された引数の式へ言い換える。
	//
	// 上界はどれも `konst + coef × ||x||` の形なので、**合成しても同じ形に閉じる**：
	//
	//     ||f x|| ≤ k₂ + c₂×||x||、||x|| ≤ k₁ + c₁×||p||
	//     ⇒ ||f x|| ≤ (k₂ + c₂k₁) + (c₂c₁)×||p||
	//
	// `walk` の `b : body_of line` / `line : head_line s` がこれで、辿らないと「第7引数が
	// 器ではない」——呼ぶ側に無いものを測れと言うことになる。
	const resolved = new Map();
	// 同じ理由で和である（addMerged を参照）。
	const addResolved = (k, c) => resolved.set(k, (resolved.get(k) || 0) + c);
	let extra = 0;
	const resolveTerm = (nm, c, depth) => {
		if (depth > 8) return false; // デフォルトが輪になっている
		const bare = bareMeasureName(nm);
		if (!defaults.has(bare)) {
			addResolved(nm, c);
			return true;
		}
		// **μ の項もデフォルトの式へ言い換える**（`boundedCallOf` と同じ規則）。デフォルトは
		// 呼ぶ側に無いものを測れと言っている形なので、その定義まで辿って底の仮引数へ戻す。
		if (nm !== bare) {
			const d = defaults.get(bare);
			const mb = d ? muDominatingParam(d, params) : null;
			if (mb) {
				const key = muKey(mb);
				addResolved(key, c);
				return true;
			}
			const km = d ? knownLengthOf(d) : null;
			if (km !== null) {
				extra += c * km;
				return true;
			}
			return false;
		}
		// **`len` の側も同じ規則で辿る。** ここは長らく「デフォルトが呼び出しなら合成する」
		// しか見ておらず、`b : ts` のように**仮引数そのものを既定にした**形で諦めていた
		// ——上界が出ないので計画に載らず、スロットが取られないまま `b expr` で飛んで、
		// 呼び先が**ゴミの x8** を宛先として読んでいた（診断ゼロで `__`）。
		const lb = lenDominatingParam(defaults.get(nm), params);
		if (lb) {
			addResolved(lb, c);
			return true;
		}
		const fixedD = knownLengthOf(defaults.get(nm));
		if (fixedD !== null) {
			extra += c * fixedD;
			return true;
		}
		const bb = known ? boundedCallOf(defaults.get(nm), known, params) : null;
		if (!bb) return false;
		extra += c * bb.konst;
		for (const t of bb.terms) if (!resolveTerm(t.sizeOf, c * t.coef, depth + 1)) return false;
		return true;
	};
	for (const [nm, c] of terms) if (!resolveTerm(nm, c, 0)) return null;
	return { konst: konst + extra, terms: [...resolved].map(([sizeOf, coef]) => ({ sizeOf, coef })), eats: [...ownEats] };
}

// **覗き穴の家族が共有する読み方。** 行から命令だけを取り出す（行末の注記を落とす）、
// ラベルか、スロットの読み書きの形か——同じ字面を関数ごとに書き直していた。
//
// `isBranch`/`isBreak` はここに置かない。**跨いでよい分岐が覗き穴ごとに違う**ので、
// 3つの正規表現は同じに見えて別物である（`blr` まで見るもの・`br` まで・`bl` だけ）。
const insOf = (l) => l.trim().replace(/\s*\/\/.*$/, "");
const isLabel = (t) => /^[.\w]+:$/.test(t);
// スロットは `x29` からの固定オフセット——読み書きの形はこの2つしかない。
const SLOT_ST = /^str\s+(x\d+),\s*\[x29,\s*#(\d+)\]$/;
const SLOT_LD = /^ldr\s+(x\d+),\s*\[x29,\s*#(\d+)\]$/;

/**
 * **書いた直後に同じレジスタへ読み戻す対を消す**（覗き穴）。
 *
 *     str x9, [x29, #32]
 *     ldr x9, [x29, #32]   ← 消せる。x9 は既にその値である
 *
 * `genExpr` の規約は「どの式も値をスロットへ置いて返す」で、呼ぶ側は「スロットから読む」
 * で始まる——**生産と消費が隣り合っていても必ずメモリを経由する**。規約そのものは合成が
 * 正しく閉じるために要るので、崩さずに出た命令の側で畳む。
 *
 * **ラベルを跨がない。** 間にラベルがあると別の経路から飛び込んで来られるので、直前の
 * `str` が実行されたとは限らない。分岐・呼び出しも跨がない（`bl` はレジスタを壊す）。
 *
 * 消すのは `ldr` の側だけである。`str` はスロットの中身を作っており、後で別の場所から
 * 読まれうる——「今この瞬間レジスタにも在る」ことしか使わない。
 */
/**
 * **近い定数番地は、ベースを1つ作って ±offset で届かせる**（覗き穴）。
 *
 *     movz x9, #0x30             movz x9, #0x30
 *     movk x9, #0x900, lsl #16   movk x9, #0x900, lsl #16
 *     str  x10, [x9]             str  x10, [x9]
 *     movz x9, #0x44         →   （消える）
 *     movk x9, #0x900, lsl #16   （消える）
 *     str  x11, [x9]             stur x11, [x9, #20]
 *
 * MMIO のレジスタ束は同じページに固まっている——PL011 の CR と DR は 0x30 離れて
 * いるだけである。番地を毎回2命令で作り直すのは、**同じ上位ビットを何度も書いて
 * いる**ということでしかない。
 *
 * 畳んでよいのは、次に同じ register が書かれるまでの間、**それが番地としてしか
 * 使われない**ときだけである。データとして読まれていたら（`str x9, [x10]` の x9）
 * 値そのものが要るので消せない。ラベル・分岐・`bl` はベースを捨てる（別経路から
 * 飛び込まれる、呼んだ先で壊れる）。
 *
 * オフセットの入れ方は2つある。幅の倍数で収まるなら `str`（スケール済み、
 * 0〜4095×幅）、収まらないなら `stur`（符号付き9ビット、-256〜255）である。MMIO の
 * レジスタは 4 byte 刻みで並ぶので 8 byte アクセスでは倍数にならないことが多く、
 * **`stur` が要る**——ここを持たないと畳めない組み合わせが半分残る。
 */
function peepholeShareAddressBase(lines) {
	// 即値は 16 進でも 10 進でも出る（`movz x9, #0x30` と `mov x10, #0`）。
	const MOVZ = /^(?:movz|mov)\s+(x\d+),\s*#(0x[0-9a-fA-F]+|[0-9]+)(?:,\s*lsl\s*#(\d+))?$/;
	const MOVK = /^movk\s+(x\d+),\s*#(0x[0-9a-fA-F]+|[0-9]+),\s*lsl\s*#(\d+)$/;
	// 運ぶ側は `xzr`/`wzr` にもなる（0 を書くとき）。番地の側は普通の register だけ。
	const MEM = /^(strb|strh|str|ldrb|ldrh|ldr)\s+([wx](?:\d+|zr)),\s*\[(x\d+)\]$/;
	const isBranch = (t) => /^(b|b\.\w+|cbz|cbnz|tbz|tbnz|bl|br|blr|ret)\b/.test(t);
	const NOWRITE = /^(str|strb|strh|stur|sturb|sturh|stp|cmp|cmn|tst)\b/;
	const FIRSTREG = /^[a-z.]+\s+([wx]\d+)/;
	const UNSCALED = { str: "stur", strb: "sturb", strh: "sturh", ldr: "ldur", ldrb: "ldurb", ldrh: "ldurh" };

	const widthOf = (mn, reg) => (mn.endsWith("b") ? 1 : mn.endsWith("h") ? 2 : reg[0] === "w" ? 4 : 8);
	// その register を書く命令か。ストアと比較は書かない——それ以外は第1オペランドを書く。
	const writesReg = (t, reg) => {
		if (NOWRITE.test(t)) return false;
		const m = FIRSTREG.exec(t);
		return !!m && m[1].replace("w", "x") === reg;
	};
	const mentions = (t, reg) => new RegExp("\\b" + reg + "\\b").test(t);

	// 定数の材料化を読む（`movz`/`mov` に `movk` が続く並び）。
	const readMat = (i) => {
		const z = MOVZ.exec(insOf(lines[i]));
		if (!z) return null;
		let val = BigInt(z[2]) << BigInt(z[3] || 0);
		let len = 1;
		for (let m = i + 1; m < lines.length; m++) {
			const k = MOVK.exec(insOf(lines[m]));
			if (!k || k[1] !== z[1]) break;
			val |= BigInt(k[2]) << BigInt(k[3]);
			len++;
		}
		return { reg: z[1], val, len };
	};

	// 次にその register が書かれるまでの間、番地としてしか使われないなら使用箇所を返す。
	// 一度でも番地以外で出てきたら null（畳めない）。
	const collectUses = (from, reg) => {
		const uses = [];
		for (let m = from; m < lines.length; m++) {
			const t = insOf(lines[m]);
			if (!t) continue;
			if (isLabel(t) || isBranch(t)) break;
			// **番地として読むのが先である。** `ldr x9, [x9]` は x9 を番地として読んで
			// から x9 へ書く——「書く」だけを見て止めると、この形が畳めない。読み終えて
			// から基準が死ぬので、記録してから抜ける。定数の番地から読む式が毎回これ。
			const mem = MEM.exec(t);
			if (mem && mem[3] === reg) {
				uses.push({ idx: m, mn: mem[1], reg: mem[2] });
				if (writesReg(t, reg)) break;
				continue;
			}
			if (writesReg(t, reg)) break;
			if (!mentions(t, reg)) continue;
			return null;
		}
		return uses;
	};

	const encode = (u, baseReg, off) => {
		const w = widthOf(u.mn, u.reg);
		const o = Number(off);
		if (!Number.isSafeInteger(o)) return null;
		if (o === 0) return "\t" + u.mn + " " + u.reg + ", [" + baseReg + "]";
		if (o > 0 && o % w === 0 && o / w <= 4095) return "\t" + u.mn + " " + u.reg + ", [" + baseReg + ", #" + o + "]";
		if (o >= -256 && o <= 255) return "\t" + UNSCALED[u.mn] + " " + u.reg + ", [" + baseReg + ", #" + o + "]";
		return null;
	};

	const drop = new Set();
	const rewrite = new Map();
	let base = new Map(); // register → 今そこに入っている定数
	for (let i = 0; i < lines.length; ) {
		const t = insOf(lines[i]);
		if (!t) { i++; continue; }
		if (isLabel(t) || isBranch(t)) { base = new Map(); i++; continue; }
		const mat = readMat(i);
		if (!mat) {
			for (const r of [...base.keys()]) if (writesReg(t, r)) base.delete(r);
			i++;
			continue;
		}
		const had = base.get(mat.reg);
		// **同じ値をもう一度作るのは、ただの重複である。** 後の使い方が番地でも
		// データでも関係なく、register の中身は変わらない——材料化ごと消してよい。
		// レジスタ束を一度離れてまた戻る形（`CR` → `DR` → `CR`）で出る。
		if (had !== undefined && had === mat.val) {
			for (let k = 0; k < mat.len; k++) drop.add(i + k);
			i += mat.len;
			continue;
		}
		if (had !== undefined && had !== mat.val) {
			const uses = collectUses(i + mat.len, mat.reg);
			if (uses && uses.length > 0) {
				const rw = uses.map((u) => encode(u, mat.reg, mat.val - had));
				if (rw.every((x) => x !== null)) {
					for (let k = 0; k < mat.len; k++) drop.add(i + k);
					uses.forEach((u, k) => rewrite.set(u.idx, rw[k]));
					i += mat.len;
					continue; // ベースは据え置き
				}
			}
		}
		base.set(mat.reg, mat.val);
		i += mat.len;
	}
	if (drop.size === 0) return lines;
	const out = [];
	for (let i = 0; i < lines.length; i++) {
		if (drop.has(i)) continue;
		out.push(rewrite.has(i) ? rewrite.get(i) : lines[i]);
	}
	return out;
}

/**
 * **上書きされるだけのスロット書き込みを消す**（覗き穴）。
 *
 *     str x9, [x29, #16]    ← 1回目の `#` が返す番地
 *     …（#16 を読まない）
 *     str x9, [x29, #16]    ← 2回目が上書きする。1回目は誰も見ていない
 *
 * `#` も `@` も式なので値を返す。文の位置に並べたときその値は捨てられるが、
 * `genExpr` の規約（どの式もスロットへ置く）は捨てられることを知らない。boot の
 * ような「並べるだけ」のコードでは、**書き込みの数だけ死んだストアが出る**。
 *
 * 跨いではいけないものは `peepholeSlotMoves` と同じ——ラベル（別経路から飛び込める）と
 * 分岐である。加えて `x29` がスロットの読み書き以外の形で出てきたら、そのスロットの
 * 番地が漏れている可能性があるので**関数ごと諦める**（`$名前` が典型）。
 */
function peepholeDeadSlotStores(lines) {
	const isBranch = (t) => new RegExp("^(b|b\\.\\w+|cbz|cbnz|tbz|tbnz|bl|br|ret)\\b").test(t);
	const mentionsFp = new RegExp("\\bx29\\b");
	const framePro = new RegExp("^mov\\s+x29,\\s*sp$");
	const frameSave = new RegExp("^(stp|ldp)\\s+x29,\\s*x30,");
	// スロットの番地が漏れていないか。漏れていたら何も消せない。
	for (const l of lines) {
		const t = insOf(l);
		if (!mentionsFp.test(t)) continue;
		if (SLOT_ST.test(t) || SLOT_LD.test(t)) continue;
		if (framePro.test(t) || frameSave.test(t)) continue;
		return lines;
	}
	const drop = new Set();
	for (let i = 0; i < lines.length; i++) {
		const st = SLOT_ST.exec(insOf(lines[i]));
		if (!st) continue;
		for (let m = i + 1; m <= lines.length; m++) {
			if (m === lines.length) { drop.add(i); break; } // 関数の終わりまで誰も読まない
			const t = insOf(lines[m]);
			if (!t) continue;
			if (isLabel(t) || isBranch(t)) break;
			const ld = SLOT_LD.exec(t);
			if (ld && ld[2] === st[2]) break; // 読まれた
			const st2 = SLOT_ST.exec(t);
			if (st2 && st2[2] === st[2]) { drop.add(i); break; } // 上書きされた
		}
	}
	return lines.filter((_, i) => !drop.has(i));
}

function peepholeRedundantLoads(lines) {
	const out = [];
	for (const line of lines) {
		const cur = insOf(line);
		const ld = SLOT_LD.exec(cur);
		if (ld && out.length > 0) {
			const prev = insOf(out[out.length - 1]);
			const st = SLOT_ST.exec(prev);
			// 同じレジスタ・同じスロットなら、この `ldr` は何も変えない。
			if (st && st[1] === ld[1] && st[2] === ld[2]) continue;
			// **別のレジスタなら、記憶を経由せず渡せる。** 直前に書いた値をそのまま
			// 読み直しているので、`mov` 1つで足りる——書いた側は誰にも読まれなく
			// なるので `peepholeDeadSlotStores`（後で走る）が拾って消す。
			// 最後の式の値を返す形（`str x9, [x29,#16]` → `ldr x0, [x29,#16]`）が
			// 毎回これである。
			if (st && st[2] === ld[2]) {
				out.push("\tmov " + ld[1] + ", " + st[1]);
				continue;
			}
		}
		out.push(line);
	}
	return out;
}

/**
 * **スロット間の写しを、読み替えて消す**（覗き穴）。
 *
 *     ldr x9, [x29, #16]    ← 仮引数 a
 *     str x9, [x29, #32]    ← 新しいスロットへ写すだけ
 *     …
 *     ldr x9, [x29, #32]    ← ここを [#16] に読み替えれば、上の2つが消える
 *
 * `genExpr` は「どの式も新しいスロットへ置く」ので、**既にスロットに在る値でも写す**。
 * 規約は合成が閉じるために要るが、出た命令の上では消せる。
 *
 * **跨いではいけないものが2つある。** ラベル（別の経路から飛び込んで来られる）と分岐・
 * 呼び出し（`bl` はレジスタを壊し、分岐先では話が変わる）である。実測すると候補 482 の
 * うち 368 はこれに当たり、安全なのは 113 だけだった——**局所的に見えて、実際は跨ぐ**。
 *
 * 加えて、写し元が途中で書き換わらないこと・写し先がちょうど1回だけ読まれることを見る。
 */
function peepholeSlotMoves(lines) {
	const isBranch = (s) => /^(b|b\.\w+|cbz|cbnz|tbz|tbnz|bl)\b/.test(s);
	const drop = new Set();
	const rewrite = new Map(); // 行番号 → 読み替え先スロット
	for (let k = 0; k + 1 < lines.length; k++) {
		if (drop.has(k) || drop.has(k + 1)) continue;
		const a = SLOT_LD.exec(insOf(lines[k]));
		const b = SLOT_ST.exec(insOf(lines[k + 1]));
		if (!a || !b || a[1] !== b[1] || a[2] === b[2]) continue;
		const [src, dst] = [a[2], b[2]];
		let at = -1;
		let ok = true;
		for (let m = k + 2; m < lines.length; m++) {
			const s = insOf(lines[m]);
			if (isLabel(s) || isBranch(s)) { ok = false; break; }
			const st = SLOT_ST.exec(s);
			if (st && st[2] === src) { ok = false; break; } // 写し元が書き換わった
			if (st && st[2] === dst) break; // 写し先が上書きされた——ここまでで完結
			const ld = SLOT_LD.exec(s);
			if (ld && ld[2] === dst) {
				if (at >= 0) { ok = false; break; } // 2回以上読まれる
				at = m;
			}
		}
		if (!ok || at < 0) continue;
		drop.add(k);
		drop.add(k + 1);
		rewrite.set(at, src);
	}
	return lines
		.map((l, i) => (rewrite.has(i) ? l.replace(/\[x29,\s*#\d+\]/, `[x29, #${rewrite.get(i)}]`) : l))
		.filter((_, i) => !drop.has(i));
}

// 呼び出しを跨いでも生きるレジスタ（AAPCS64 の callee-saved）。**跨げることが要点**
// である——スロットは `bl` の先でも読めるので、置き換える先も同じ性質が要る。
const SLOT_REGS = ["x19", "x20", "x21", "x22", "x23", "x24", "x25", "x26", "x27", "x28"];

// 呼び出しを跨がないなら、使い捨ての側で足りる（x16/x17 はリンカの継ぎ当てが、x18 は
// 環境が使う可能性があるので入れない）。**こちらは退避が要らない**——誰も守っていない
// レジスタなので、守る義務もこちらには無い。
const SCRATCH_REGS = ["x9", "x10", "x11", "x12", "x13", "x14", "x15"];

/**
 * **スロットをレジスタへ移す（関数まるごと1つの表で決める）。**
 *
 * `genExpr` の規約は「どの式も新しいスロットへ置く」で、合成が閉じるためにそれでよい。
 * だがスクラッチが実質 x9/x10 の2本しか使われていないため、式が2つ以上の値を同時に
 * 持つたびに記憶へ溢れる——実プログラムの **46%（1879/4051 命令）** がスロット往復だった。
 *
 * **なぜ覗き穴では取れなかったか。** 2度試して2度壊した。窓ごとに「このレジスタは空き」
 * と判断すると、**重なった窓が同じレジスタを取る**（実際 `x11` を2つの窓が奪い合った）。
 * 重ならないように選ぶのは区間グラフの彩色そのもので、局所の書き換えでは決められない。
 *
 * ここでは彩色が要らない。**スロットは push/pop のスタックなので、生存区間は必ず入れ子**
 * であり、深さがそのまま色になる——深さ d のスロットは常に同じレジスタでよい。関数全体を
 * 見ている `wrapFrame` が、1つの表として決める。
 *
 * 条件は2つ。**`$名前` で番地が漏れていない**こと（漏れていれば記憶でなければならない）
 * と、**深さが手持ちのレジスタに収まる**こと。実測では 49 関数中 48 本が 10 本以内に
 * 収まり、往復の 93% がここに含まれる。
 */
function slotsToRegisters(lines) {
	// **番地が漏れていたら記憶でなければならない。** スロットの読み書き以外で `x29` が
	// 出てきたら、そのフレームは誰かに指されている可能性がある（`$名前` が典型）。
	// 相互末尾呼び出しの畳み（`ldp x29, x30`）だけは通す——戻しをその手前に差し込む。
	for (const l of lines) {
		const t = insOf(l);
		if (!/\bx29\b/.test(t)) continue;
		if (SLOT_ST.test(t) || SLOT_LD.test(t)) continue;
		if (/^mov\s+x29,\s*sp$/.test(t)) continue;
		// **`mov sp, x29` は漏れではない。** x29 を*読んで* `sp` を戻すだけで、番地は誰の
		// 手にも渡らない——ここが見ているのは「フレームの番地が外へ出たか」である。
		//
		// 逆向き（`mov x29, sp`）しか通していなかったので、`sp` を動かして戻す関数は
		// 割り当てを**丸ごと**諦めていた。追記をループにすると飛ぶ手前で `mov sp, x29` が
		// 出るので、`tokens` がここで落ちて往復が 157 本残っていた（+133 命令）。
		if (/^mov\s+sp,\s*x29$/.test(t)) continue;
		if (/^(stp|ldp)\s+x29,\s*x30,/.test(t)) continue;
		return null;
	}
	// 使う深さを集める（飛び飛びでも、深さ→レジスタの対応は変えない）。
	const used = new Set();
	for (const l of lines) {
		const m = SLOT_ST.exec(insOf(l)) || SLOT_LD.exec(insOf(l));
		if (m) {
			const d = (Number(m[2]) - 16) / 8;
			if (!Number.isInteger(d) || d < 0) return null;
			used.add(d);
		}
	}
	if (used.size === 0) return null;

	// **呼び出しを跨がないなら、使い捨ての側で足りる。**
	//
	// 跨ぐ関数は callee-saved（x19–x28）でなければならず、その代金として入口の退避と
	// フレームが要る。跨がない関数——実プログラムでは 49 本中 26 本——には、その代金を
	// 払う理由が無い。空いている使い捨てを使えば、退避も `sp` も出て来ない。
	//
	// **これは速さより先に、どの層で動くかの話である。** layer 0 は RAM が初期化されて
	// いない世界で、`sp` が有効な場所を指している保証が無い（`stp … [sp, #-32]!` は形が
	// 違うだけの確保である）。フレームを取らない関数は、そこでも動く。
	const calls = lines.some((l) => /^(bl|blr)\b/.test(insOf(l)));
	// **`w14` は `x14` である。** 32 ビット名は同じレジスタの別名なので、`x` の綴りだけを
	// 数えると `ldrb w14, …` を出している関数で x14 が「空き」に見える。実際そうなっていて、
	// 文字列比較（`w14`/`w15` で要素を読む）の右辺の ptr が x14 へ割り当てられ、**1文字目を
	// 読んだ瞬間に踏み潰されていた**。
	//
	// 壊れ方が嫌らしい。両辺が同じ綴りのときだけ——つまり `=` が真になるはずのときだけ
	// ——生きるスロットが4つ要って x14 まで届くので、`` `ab` = `ab` `` が偽になる。偽の側は
	// 正しいままなので、**比較が常に「違う」と答える**という形で静かに出ていた。
	const asX = (r) => "x" + r.slice(1);
	const taken = new Set();
	for (const l of lines) for (const m of insOf(l).matchAll(/\b([wx]\d+)\b/g)) taken.add(asX(m[1]));
	// **末尾で飛ぶ関数では x15 を配らない。**
	//
	// x15 は返値スロットの「入る個数」を運ぶ口（`SRET_LIMIT`）で、x8 と対の ABI である。
	// 使い捨てが使えるのは「呼び出しの無い関数」だけだから安全、と判断していたのが誤りで、
	// **末尾で飛ぶ関数は `bl` を持たないまま ABI に参加する**——`b` の先が入口で読む。
	//
	// 実測：`run : [~ts] ? expr (ts ' 1~)` が切片の起点 `1` を x15 へ置き、`b expr` の先で
	// 「残り 1」として読まれて**診断ゼロで `__`** になっていた。
	//
	// 表そのものから外すと、飛ばない関数まで1本損をする——使い捨てが減ったぶん
	// callee-saved に落ちてフレームを取り、`f : s ? s ' 1~` が layer 0 で弾かれた。
	// **守る必要があるのは飛ぶ関数だけ**なので、そこだけ予約する。
	const jumpsAway = lines.some((l) => {
		const t = insOf(l);
		if (!/^b\s+/.test(t)) return false;
		return !/^b\s+\.L/.test(t);
	});
	const free = calls ? [] : SCRATCH_REGS.filter((r) => !taken.has(r) && !(jumpsAway && r === SRET_LIMIT));

	// 深さは順位で詰める（飛び飛びでも入れ子は保たれるので、順位は色として正しい）。
	const depths = [...used].sort((a, b) => a - b);
	// **配る先を本体が既に使っていないか。** 32ビット名は同じレジスタなので w も数える。
	//
	// ここは長らく死んでいた——"\\b" は正規表現にすると「バックスラッシュ1文字」を探す
	// 綴りで、機械語には現れない。実害は出ていなかった（本体は x19–x28 を触らない）が、
	// **安全だと思い込む材料にはなっていた**。しかも「1本でも被ったら関数まるごと諦める」
	// という判断そのものが強すぎる——被った1本を配らなければ済む話である。
	const bodyUses = new Set();
	for (const l of lines) {
		const t = insOf(l);
		if (SLOT_ST.test(t) || SLOT_LD.test(t)) continue;
		for (const m of t.matchAll(/\b[wx](\d+)\b/g)) bodyUses.add("x" + m[1]);
	}
	// **使い捨てで足りるときだけそちらを使う。** 足りなければ callee-saved に落ちる
	// ——空きが無いことは「割り当てない」理由にはならない（一度そうして往復が倍に戻った）。
	const cheapBank = free.filter((r) => !bodyUses.has(r));
	const savedBank = SLOT_REGS.filter((r) => !bodyUses.has(r));
	const cheap = depths.length <= cheapBank.length;
	const bank = cheap ? cheapBank : savedBank;
	if (bank.length === 0) return null;

	// **入るだけ入れる。** 以前は持ち駒（10本）を1つでも越えたら null を返し、**何も
	// 割り当てなかった**。1本足りないだけで関数が丸ごと記憶へ落ちる崖で、実測では
	// スロットを2つ足しただけで tokens がそこから落ち、往復が 30 → 278 になった。
	//
	// 入れ子の生存区間では**深さがそのまま色**なので、部分集合を配っても衝突しない
	// ——配らなかった深さは記憶のままで、そこだけ往復が残る。全か無かである理由は無かった。
	//
	// どれを配るかは**触る回数**で決める。深い方が短命とは限らず（枝の中で何度も読む
	// スロットがある）、順位で切ると往復の多い方を落としかねない。
	const hits = new Map();
	for (const l of lines) {
		const m = SLOT_ST.exec(insOf(l)) || SLOT_LD.exec(insOf(l));
		if (m) {
			const d = (Number(m[2]) - 16) / 8;
			hits.set(d, (hits.get(d) || 0) + 1);
		}
	}
	const chosen = [...depths]
		.sort((x, y) => (hits.get(y) || 0) - (hits.get(x) || 0) || x - y)
		.slice(0, bank.length)
		.sort((x, y) => x - y);
	const at = new Map(chosen.map((d, i) => [d, bank[i]]));
	const regs = chosen.map((d) => at.get(d));

	// **記憶に残るスロットは前へ詰める。** 退避はその後ろに置く（calleeSaveLines の base）
	// ので、隙間を残すと退避と重なる。全部配れていた頃はスロットの領域をそのまま退避に
	// 使い回していて、**そこが全か無かの本当の理由**だった。
	const kept = depths.filter((d) => !at.has(d));
	const to = new Map(kept.map((d, i) => [d, 16 + i * 8]));
	const off = (v) => to.get((Number(v) - 16) / 8);
	const out = lines.map((l) => {
		const t = insOf(l);
		const st = SLOT_ST.exec(t);
		if (st) {
			const d = (Number(st[2]) - 16) / 8;
			return at.has(d) ? "\tmov " + at.get(d) + ", " + st[1] : "\tstr " + st[1] + ", [x29, #" + off(st[2]) + "]";
		}
		const ld = SLOT_LD.exec(t);
		if (ld) {
			const d = (Number(ld[2]) - 16) / 8;
			return at.has(d) ? "\tmov " + ld[1] + ", " + at.get(d) : "\tldr " + ld[1] + ", [x29, #" + off(ld[2]) + "]";
		}
		return l;
	});
	return { lines: out, regs, needsSaving: !cheap, kept: kept.length };
}

/** 退避／復帰の組を作る（`x29` 相対で、**フレームの中に**置く）。 */
function calleeSaveLines(regs, verb, base = 16) {
	const out = [];
	for (let i = 0; i < regs.length; i += 2) {
		const off = base + i * 8;
		const two = regs[i + 1];
		const op = verb === "save" ? (two ? "stp" : "str") : two ? "ldp" : "ldr";
		out.push("\t" + op + " " + regs[i] + (two ? ", " + two : "") + ", [x29, #" + off + "]");
	}
	return out;
}

/**
 * **命令の中でシンボル（飛び先・番地の名前）が占める範囲を伏せる。**
 *
 * レジスタを探す正規表現（`\bx0\b`）は、名前の中の綴りまで拾う——`$` も `.` も `"` も単語の
 * 境目なので、`bl f$x0` の `x0` も読みに見える。それを `substituteReads` が書き換えると、
 * コピー伝播が**呼び先の名前**を変えてしまう。実測：`f$x0` と `f$x19` を持つプログラムで
 * `bl f$x0` が `bl f$x19` になり、解釈 8 に対して機械は 106 を返した（別の関数を黙って呼ぶ）。
 * 呼び先が無ければリンクで落ちるが、在れば誤答である。
 *
 * 名前が立つ位置はここで決める：`b`/`bl`/`b.cond` の飛び先、`cbz`/`cbnz`/`tbz`/`tbnz` の
 * 最後のオペランド、`adr`/`adrp` の第2オペランド、`:lo12:` から後ろ、引用符の中。**長さを変えずに
 * 空白で伏せる**ので、伏せた字面で見つけた位置は元の字面でも同じ位置である。
 */
function maskSymbols(mn, ops) {
	const spans = [];
	if (mn === "b" || mn === "bl" || mn.startsWith("b.")) spans.push([0, ops.length]);
	else if (/^(cbz|cbnz|tbz|tbnz)$/.test(mn)) spans.push([ops.lastIndexOf(",") + 1, ops.length]);
	else if (mn === "adr" || mn === "adrp") spans.push([ops.indexOf(",") + 1, ops.length]);
	const lo = ops.indexOf(":lo12:");
	if (lo >= 0) {
		const end = ops.indexOf("]", lo);
		spans.push([lo, end < 0 ? ops.length : end]);
	}
	for (const m of ops.matchAll(/"[^"]*"/g)) spans.push([m.index, m.index + m[0].length]);
	const out = ops.split("");
	for (const [a, b] of spans) for (let i = Math.max(a, 0); i < b; i++) out[i] = " ";
	return out.join("");
}

/**
 * **読みだけを写し元へ向け直す。**
 *
 * 書き先も同じ名前のことがある——`csel x9, x9, x12, eq` の第2オペランドは読みである。
 * オペランドをまとめて置換すると書き先まで変わってしまうので、以前は「書き先と同じ名前
 * なら触らない」で逃げていた。**それで `is_space` の `mov x9, x0` が3つとも残った**。
 * 書き先の**後ろ**だけを置き換えれば、逃げる必要は無い。
 */
function substituteReads(line, from, to) {
	const cut = line.indexOf("//");
	const code = cut < 0 ? line : line.slice(0, cut);
	const tail = cut < 0 ? "" : line.slice(cut);
	const mn = code.trim().split(/[\s,]/)[0];
	const at = code.indexOf(mn) + mn.length;
	const ops = code.slice(at);
	// **書き先が何本かは `regsOf` が知っている。** ここで数え直すと `cmp x9, x12` や
	// `str x9, [x29, #16]` の第1オペランドを書き先と見なしてしまう——どちらも読みである。
	// 実際それで置換が減り、命令が 2588 から 2729 に増えた。**同じことを2箇所で決めない。**
	const n = regsOf(code.trim()).w.length;
	let start = 0;
	for (let k = 0; k < n; k++) start = ops.indexOf(",", start) + 1;
	if (n > 0 && start === 0) return line; // カンマが無い（書き先だけ）——読みは無い
	// 名前の中の綴りは読みではない（`maskSymbols`）。伏せた字面で探して、元の字面を置き換える。
	const masked = maskSymbols(mn, ops);
	let out = ops.slice(0, start);
	let pos = start;
	for (const m of masked.slice(start).matchAll(new RegExp("\\b" + from + "\\b", "g"))) {
		const i = start + m.index;
		out += ops.slice(pos, i) + to;
		pos = i + m[0].length;
	}
	return code.slice(0, at) + out + ops.slice(pos) + tail;
}

/**
 * **どのレジスタを読み、どのレジスタに書くか。**
 *
 * 書き先は第1オペランドである——ただし記憶へ書く形（`str`/`stp`）と比較（`cmp`/`ccmp`）は
 * 全部が読みで、`ldp` は2本に書く。ここを取り違えると、生きている値を消す。
 *
 * **書き先が `sp` の形に気をつける。** `sub sp, sp, x9` の第1オペランドはレジスタ番号を
 * 持たないので、「最初に現れた x レジスタ」を書き先だと読むと `x9` を書くことになる
 * ——生きている `x9` が死んで見え、確保そのものが消えて、返値スロットが引数配列と同じ
 * 番地になった。**オペランドの位置で見る**（`sp`/`xzr` は書き先として数えない）。
 */
function regsOf(t) {
	const mn = t.split(/[\s,]/)[0];
	const ops = t.slice(mn.length);
	// 名前の中の綴り（`bl f$x0`）は読みでも書きでもない（`maskSymbols`）。
	const all = [...maskSymbols(mn, ops).matchAll(/\b([wx])(\d+|zr)\b/g)].map((m) => "x" + m[2]);
	if (/^(str|strb|strh|stur|sturb|sturh|stp|stlr|cmp|cmn|tst|ccmp|ccmn|b|bl|br|blr|ret|cbz|cbnz|tbz|tbnz)$/.test(mn) || mn.startsWith("b."))
		return { w: [], r: all };
	// 先頭からいくつのオペランドが「x レジスタそのもの」か。`ldp` だけが2本に書く。
	const head = ops.split(",").map((o) => o.trim());
	const dests = /^(ldp|ldnp)$/.test(mn) ? 2 : 1;
	let n = 0;
	while (n < dests && /^[wx]\d+$/.test(head[n] || "")) n++;
	return { w: all.slice(0, n), r: all.slice(n) };
}

/**
 * **写しを畳む（コピー伝播と死んだ写しの除去）。**
 *
 *     mov x9, x19            add x9, x19, x24
 *     mov x10, x24     →     （2命令消える）
 *     add x9, x9, x10
 *
 * `slotsToRegisters` が往復を写しに変えたあと、**読む側が写し先を読んでいるだけ**の形が
 * 残る（実プログラムで 39%）。読む側を元のレジスタに向け直せば写しは死ぬ。
 *
 * **覗き穴で2度壊した形とは違う。** あちらは窓ごとに「空いているレジスタ」を*割り当て*、
 * 重なった窓が同じレジスタを奪い合った。ここは何も割り当てない——既にある名前へ向け直す
 * だけなので、窓が重なっても奪い合うものが無い。
 *
 * 直線の区間だけを見る。ラベル・分岐・呼び出しで表を捨てる（別の道から飛び込まれたら
 * レジスタの中身は保証できず、`bl` は x0–x18 を壊す）。幅の違う読み（`w9`）は触らない
 * ——`add w9, x19, w10` は命令として成り立たない。
 */
function peepholeFoldMoves(lines) {
	const isBreak = (t) => !t || /^[.\w$]+:$/.test(t) || /^(b|bl|br|blr|ret|cbz|cbnz|tbz|tbnz)\b/.test(t) || t.startsWith("b.");
	const MOV = /^mov (x\d+), (x\d+)$/;
	const out = lines.slice();

	// 1) コピー伝播：`mov xD, xS` のあと、xD の読みを xS に向け直す。
	//
	// **定数も同じ扱いにする。** `mov x9, #12` のあと `mov x21, x9` と写す形が実プログラム
	// に 246 箇所あった（命令の 9%）。写す代わりに置き直せば、元の `mov x9, #12` は読み手を
	// 失って死ぬ。置き直すのは `mov xE, xD` の形だけで、算術のオペランドには入れない
	// ——即値が命令の幅に収まるかはここでは分からない。
	let copy = new Map(); // xD -> xS
	let konst = new Map(); // xD -> その定数を作る命令（書き先は xD のまま）
	for (let i = 0; i < out.length; i++) {
		const t = insOf(out[i]);
		if (isBreak(t)) { copy = new Map(); konst = new Map(); continue; }
		const { w, r } = regsOf(t);
		if (copy.size && r.length) {
			let line = out[i];
			for (const reg of new Set(r)) {
				const src = copy.get(reg);
				if (src) line = substituteReads(line, reg, src);
			}
			out[i] = line;
		}
		// 写しの右辺が定数なら、写す代わりに置き直す。
		{
			const m = MOV.exec(insOf(out[i]));
			const k = m && konst.get(m[2]);
			if (k && m[1] !== m[2]) {
				const tail = out[i].includes("//") ? out[i].slice(out[i].indexOf("//")) : "";
				const made = k.replace(/^(\w+) x\d+,/, "$1 " + m[1] + ",");
				out[i] = "\t" + (tail ? made.padEnd(26) + tail : made);
			}
		}
		const now = insOf(out[i]);
		const nw = regsOf(now).w;
		// 書かれたレジスタが絡む写しは無効になる（写し先としても、写し元としても）。
		for (const d of nw) {
			copy.delete(d);
			konst.delete(d);
			for (const [k, v] of copy) if (v === d) copy.delete(k);
		}
		if (/^(mov|movz) x\d+, #/.test(now)) konst.set(regsOf(now).w[0], now);
		const m = MOV.exec(now);
		if (m && m[1] !== m[2]) copy.set(m[1], m[2]);
	}

	// 2) 死んだ写しを消す：使い捨てのスクラッチ（x9–x15）へ書いて、読まれる前に
	//    書き直されるもの。区間の終わりまでに読まれなければ捨てる——ただしラベルや
	//    分岐に達したら、その先で読まれるかは分からないので残す。
	const drop = new Set();
	for (let i = 0; i < out.length; i++) {
		const t = insOf(out[i]);
		const m = MOV.exec(t);
		if (!m) continue;
		const d = m[1];
		if (!/^x(9|1[0-5])$/.test(d)) continue;
		if (d === m[2]) { drop.add(i); continue; }
		for (let j = i + 1; j < out.length; j++) {
			const u = insOf(out[j]);
			if (isBreak(u)) break;
			const { w, r } = regsOf(u);
			if (r.includes(d)) break;
			if (w.includes(d)) { drop.add(i); break; }
		}
	}
	return out.filter((_, i) => !drop.has(i));
}

/**
 * @param {boolean} alloc スロットをレジスタへ移すか。**切れるようにしてあるのは、これが
 *   別のパスだからである**——「String の要素は 1 byte で読む」「ptr は x0、len は x1」の
 *   ような `genExpr` の決めごとを読む検査は、割り当ての後では読めなくなる（値が x19… に
 *   移り、コピー伝播が任意の命令をそちらへ向け直すため）。切って読めば、どちらのパスが
 *   何を決めたのかが分かれたまま検査できる。
 */
// 呼ぶ側が引数に使う口。**呼び出しの手前では、ここは全部生きていると見なす**——何本
// 渡すかは呼び先が決めることで、この表からは見えない。多めに生かすのは安全側である。
//
// **x15 は x8 と対である。** 返値スロットは番地（x8）と入る個数（x15）の2つで初めて
// 器になる——番地だけでは、そこがどこまで自分のものかを呼ばれた側が知りようがない
// （`SRET_LIMIT`）。ここに入れ忘れると `bl` を跨いで死んだと見なされ、**渡す命令が
// 消える**。実際それで消えていた。
const CALL_ARGS = ["x0", "x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8", "x15"];

// 消してよい命令。**旗を立てるもの（`cmp`/`subs`/`adds`）と、書き戻しのあるもの
// （`[sp, #-16]!`）は入れない。** 前者は次の `csel` が読み、後者は `sp` を動かす
// ——どちらも「書き先が死んでいる」だけでは判断できない。
const PURE = /^(mov|movz|add|sub|mul|sdiv|udiv|and|orr|eor|lsl|lsr|asr|csel|cset|csinc|neg|ldr|ldrb|ldrh|ldrsw|madd|msub)$/;

/**
 * **命令の並びを流れ図として読む。**
 *
 * 生存解析（後ろ向き）とコピーの伝播（前向き）が同じ図を見る。**2箇所で組み立てると
 * 必ず食い違う**ので、ここ1つにまとめてある。
 *
 * @returns `{ succ, preds, extra, rw }`——`extra` は「後続の外側で生きているもの」
 *   （出口・末尾呼び出し・飛び先不明）、`rw` は命令ごとの読み書き。
 */
function buildFlow(ins, labels) {
	const n = ins.length;
	// **戻り値は x0/x1 とは限らない。** 余積を返す関数は x0 から順に何本でも使う（AAPCS64
	// は x0–x7、sret なら x8）。2本と決めつけて `dup` の戻りを消し、`__` を返す機械語を
	// 出した。**何本使うかはこの表からは見えない**ので、全部生きていると見なす。
	// **`ret` で生きているのは返す口だけである。** x15（入る個数）は**もらう**口であって
	// 返す口ではないので、ここには入らない。入れると `mov x15, …` が「出口で読まれる」
	// ことになり、直後に上書きされる死んだ写しまで残る（実測で `f` に1本ずつ）。
	const EXIT = new Set(CALL_ARGS.filter((r) => r !== SRET_LIMIT));
	const TAIL = new Set(CALL_ARGS); // 畳んで飛ぶ先へ渡すもの（x15 も渡る）
	const ALL = new Set(Array.from({ length: 29 }, (_, i) => "x" + i));
	const succ = [];
	const extra = []; // 後続の外側で生きていると見なすもの（出口・末尾呼び出し）
	// **本文の末尾に置かれたラベルは出口である。** `.Ldone:` の後に命令が無い形が実際に
	// 出る（入口と出口は `wrapFrame` が後から足すので、本文はそこで終わっている）。
	const at = (name) => {
		const k = labels.get(name);
		return k !== undefined && k < n ? k : null;
	};
	const goes = (name) => labels.has(name) && at(name) === null; // 末尾のラベル＝出口
	for (let i = 0; i < n; i++) {
		const t = ins[i];
		const mn = t.split(/[\s,]/)[0];
		const to = t.split(/\s+/).pop();
		if (mn === "ret") { succ.push([]); extra.push(EXIT); continue; }
		if (mn === "br") { succ.push([]); extra.push(ALL); continue; }
		if (mn === "b") {
			// 局所ラベルなら飛び先へ。そうでなければ末尾呼び出し（畳んで飛ぶ）である。
			if (at(to) !== null) { succ.push([at(to)]); extra.push(null); }
			else { succ.push([]); extra.push(goes(to) ? EXIT : TAIL); }
			continue;
		}
		if (mn.startsWith("b.") || /^(cbz|cbnz|tbz|tbnz)$/.test(mn)) {
			// **落ちる先が本文の外に出ることがある。** 診断で弾かれる関数は本体が途中で
			// 終わり、飛び先のラベル（`.Lunit1`）も置かれないまま条件分岐が最後に残る。
			const fall = i + 1 < n ? [i + 1] : [];
			succ.push(at(to) !== null ? [...fall, at(to)] : fall);
			extra.push(at(to) !== null ? (fall.length ? null : EXIT) : goes(to) ? EXIT : TAIL);
			continue;
		}
		succ.push(i + 1 < n ? [i + 1] : []);
		extra.push(i + 1 < n ? null : EXIT);
	}
	const rw = ins.map((t) => {
		const mn = t.split(/[\s,]/)[0];
		if (mn === "bl" || mn === "blr") return { w: [], r: CALL_ARGS };
		const g = regsOf(t);
		// `movk` は上書きではなく差し込みなので、読みでもある。
		if (mn === "movk") return { w: g.w, r: [...g.r, ...g.w] };
		return g;
	});
	const preds = ins.map(() => []);
	for (let i = 0; i < n; i++) for (const j of succ[i]) preds[j].push(i);
	return { succ, preds, extra, rw };
}

/**
 * **関数まるごとの後ろ向き生存解析。**
 *
 * `peepholeFoldMoves` の直線区間は分岐に当たると表を捨てる——「この写しは以降読まれない」
 * が言えるのは次の分岐までである。分岐の向こうまで見るには、命令ごとの後続を辿って
 * 不動点を取るしかない。**局所で決めるのをやめて関数を1つの表として解く**——スロットの
 * 割り当てと同じ形である。
 *
 * 出口で生きているのは呼び出しの口（x0–x8）だけ。**退避したレジスタは出口で生きて
 * いない**——復帰は記憶から読むので、レジスタとしての値は要らない。ここが効いて
 * `mov x19, x9` の最後の1本が死ぬ。
 *
 * 安全側の寄せ方が3つ。呼び出しは x0–x8 を**読む**と見なす（何本渡すかは呼び先が決める）。
 * 呼び出しが**壊す**側は数えない——壊すと見なすと、跨いで生きている値を死んだことに
 * してしまう。飛び先の分からない `br` は全部生きていると見なす。
 */
function liveOutSets(ins, labels) {
	const n = ins.length;
	const { succ, extra, rw } = buildFlow(ins, labels);
	const liveIn = ins.map(() => new Set());
	const liveOut = ins.map(() => new Set());
	for (let round = 0; round < 100; round++) {
		let changed = false;
		for (let i = n - 1; i >= 0; i--) {
			const out = new Set(extra[i] || []);
			for (const j of succ[i]) for (const r of liveIn[j]) out.add(r);
			const inn = new Set(out);
			for (const d of rw[i].w) inn.delete(d);
			for (const u of rw[i].r) if (u !== "xzr") inn.add(u);
			if (inn.size !== liveIn[i].size || [...inn].some((r) => !liveIn[i].has(r))) changed = true;
			liveIn[i] = inn;
			liveOut[i] = out;
		}
		if (!changed) break;
	}
	return liveOut;
}

/**
 * **関数まるごとのコピー伝播（前向き）。**
 *
 * `peepholeFoldMoves` は直線区間しか見ないので、`mov xD, xS` の消費側が分岐の向こうに
 * あると向け直せない。実プログラムに残った写し 694 本（命令の 24%）の大半がこれである。
 *
 * 前向きに「いまどの写しが生きているか」を辿り、**合流点では交わりを取る**——どちらの
 * 道から来ても成り立つ写しだけが使える。生存解析と同じ流れ図を `buildFlow` から借りる。
 *
 * **呼び出しは x0–x18 を巻き込む写しを全部殺す。** 生存解析では「壊す側を数えない」のが
 * 安全側だったが、こちらは逆で、**数えないと壊れたレジスタを読みに行く**。同じ流れ図でも
 * 向きが逆なら安全側も逆である。
 *
 * 何も割り当てないので、覗き穴で2度壊した「重なった窓が同じレジスタを奪い合う」形には
 * ならない——既にある名前へ向け直すだけである。
 */
function propagateCopies(lines) {
	const idx = [];
	const ins = [];
	const labels = new Map();
	for (let i = 0; i < lines.length; i++) {
		const t = insOf(lines[i]);
		if (!t) continue;
		const m = /^([.\w$]+):$/.exec(t);
		if (m) { labels.set(m[1], ins.length); continue; }
		idx.push(i);
		ins.push(t);
	}
	if (!ins.length) return lines;
	const n = ins.length;
	const { preds, rw } = buildFlow(ins, labels);
	const MOV = /^mov (x\d+), (x\d+)$/;
	const CLOBBER = Array.from({ length: 19 }, (_, i) => "x" + i); // 呼び出しが壊す口

	// 起こり得る写しを先に数え上げる（交わりを取るので、初期値は「全部」が要る）。
	const universe = [];
	for (const t of ins) {
		const m = MOV.exec(t);
		if (m && m[1] !== m[2]) universe.push(m[1] + " " + m[2]);
	}
	if (!universe.length) return lines;
	const all = new Set(universe);
	const killsAt = (i) => (/^(bl|blr)\b/.test(ins[i]) ? CLOBBER : rw[i].w);

	const outOf = ins.map((_, i) => (i === 0 ? new Set() : new Set(all)));
	const inOf = ins.map(() => new Set());
	for (let round = 0; round < 100; round++) {
		let changed = false;
		for (let i = 0; i < n; i++) {
			// 入口は空。合流点は交わり。
			//
			// **関数の入口は、前任者が居ないこととは違う。** 自分へ戻る末尾再帰があると
			// 先頭にも後ろ向き辺が入り、合流点に見える——その道だけで交わりを取ると、
			// 「入口から来た場合」が抜ける（`loop 5 0` が 15 ではなく 0 になった）。
			let inn;
			if (i === 0 || !preds[i].length) inn = new Set();
			else {
				inn = new Set(outOf[preds[i][0]]);
				for (const q of preds[i].slice(1)) for (const c of [...inn]) if (!outOf[q].has(c)) inn.delete(c);
			}
			const out = new Set(inn);
			for (const d of killsAt(i)) for (const c of [...out]) { const [a, b] = c.split(" "); if (a === d || b === d) out.delete(c); }
			const m = MOV.exec(ins[i]);
			if (m && m[1] !== m[2]) out.add(m[1] + " " + m[2]);
			if (out.size !== outOf[i].size || [...out].some((c) => !outOf[i].has(c))) changed = true;
			inOf[i] = inn;
			outOf[i] = out;
		}
		if (!changed) break;
	}

	// 読みを写し元へ向け直す。**書き先は触らない**し、幅の違う読み（`w9`）も触らない
	// ——`add w9, x19, w10` は命令として成り立たない。
	const out = lines.slice();
	let moved = 0;
	for (let i = 0; i < n; i++) {
		const src = new Map();
		for (const c of inOf[i]) { const [a, b] = c.split(" "); if (!src.has(a)) src.set(a, b); }
		if (!src.size) continue;
		const { r } = rw[i];
		let line = out[idx[i]];
		for (const reg of new Set(r)) {
			const to = src.get(reg);
			if (to) line = substituteReads(line, reg, to);
		}
		if (line !== out[idx[i]]) { out[idx[i]] = line; moved++; }
	}
	return moved ? out : lines;
}

/**
 * **死んだ命令を消す（関数まるごとの生存で決める）。**
 *
 * 書き先が以降どの道でも読まれない純粋な命令を落とす。`peepholeFoldMoves` が向け直した
 * 結果、読み手を失った写しがここで死ぬ——**向け直しと除去は別の話で、後者だけが関数
 * 全体を要求する**。
 *
 * `x29`/`x30` には触らない。フレームと戻り先は、この本文の外（入口と出口）が読む。
 */
function deadCodeElim(lines) {
	const idx = [];
	const ins = [];
	const labels = new Map();
	for (let i = 0; i < lines.length; i++) {
		const t = insOf(lines[i]);
		if (!t) continue;
		const m = /^([.\w$]+):$/.exec(t);
		if (m) { labels.set(m[1], ins.length); continue; }
		idx.push(i);
		ins.push(t);
	}
	if (!ins.length) return lines;
	const liveOut = liveOutSets(ins, labels);
	const drop = new Set();
	for (let k = 0; k < ins.length; k++) {
		const t = ins[k];
		// **自分から自分への写しは、生きていようと何もしない。** コピー伝播が読みを
		// 向け直した結果として出る（`mov x0, x9` の x9 が x0 と同じだった）。生存では
		// 消えない——書き先は本当に生きているからである。
		const self = /^mov (x\d+), (x\d+)$/.exec(t);
		if (self && self[1] === self[2]) { drop.add(idx[k]); continue; }
		if (!PURE.test(t.split(/[\s,]/)[0])) continue;
		if (t.includes("]!") || /\],\s*#/.test(t)) continue; // 書き戻しは `sp` を動かす
		const w = regsOf(t).w;
		if (w.length !== 1 || /^(xzr|x29|x30)$/.test(w[0])) continue;
		if (liveOut[k].has(w[0])) continue;
		drop.add(idx[k]);
	}
	return drop.size ? lines.filter((_, i) => !drop.has(i)) : lines;
}

/**
 * **要素1つを置くのに何バイト要るか。**
 *
 * `measure` は「その値の中身の長さ」を測るので、`String` のように長さが型に無いものでは
 * `null` を返す。だがここで要るのは**運ぶ幅**であり、`String` を要素にする器は
 * `{ptr, len}` の2語＝16 byte で並べる——`passingOf` がそう答える。
 *
 * **同じ問いが2箇所に在った。** sret の計画（`collectSretPlan`）は既にこの規則で解いて
 * いたのに、実際に出す側は `measure` のままだったので、計画には載るのに「器の構築はまだ
 * 出せません」で止まっていた。決めるのは1箇所である。
 */
function elementCellSize(et, conf) {
	if (!et) return null;
	const pass = passingOf({ atomType: et }, { target: conf.target, charset: conf.charset });
	if (pass && pass.mode === "reference") return { size: pass.size };
	return measure({ atomType: et }, { target: conf.target, charset: conf.charset });
}

/**
 * **上界の項を1つ測る。** 呼ぶ側が、実引数を置いた枠から呼ぶ。
 *
 * 測った総和はそのまま x15 で呼び先へ渡る（`emitSretCapacityGuard`）。以前は呼ばれた側も
 * 自分の仮引数から同じ式を計算していて、そのため「同じ命令列でなければならない」という
 * 条件が付いていた——追記でその前提が崩れたので、いまは測るのは呼ぶ側だけである。
 * `off` は `{ptr, len}` を置いた枠の底。
 *
 *   len   ……… 要素の個数。`len` を1本読むだけ。
 *   chars ……… μ、つまり平らにしてからの個数。要素が `{ptr, len}` で並んでいるので、
 *              走査して `len` を足す。`String` の μ が強制であること（原理7）が、
 *              この測り方が要る理由そのものである。
 *
 * 走査に使うのは x12〜x15 で、容量式の総和（x11）と項の受け皿（`dst`）には触らない。
 */
function emitTermMeasure(em, off, measure, dst) {
	if (measure !== "chars") {
		em.load(dst, off + 8, "上界を測る（器の len）");
		return;
	}
	const top = em.newLabel("mu");
	const end = em.newLabel("mue");
	em.load("x12", off, "μ を測る：器の ptr");
	em.load("x14", off + 8, "μ を測る：器の len（要素の個数）");
	em.emit(`mov ${dst}, #0`, "中身の総量");
	em.emit("mov x13, #0", "位置");
	em.label(top);
	em.emit("cmp x13, x14");
	em.emit(`b.ge ${end}`);
	em.emit("add x15, x12, x13, lsl #4", "要素は {ptr, len} の16バイト");
	em.emit("ldr x15, [x15, #8]", "その要素の len");
	em.emit(`add ${dst}, ${dst}, x15`, "足す");
	em.emit("add x13, x13, #1");
	em.emit(`b ${top}`);
	em.label(end);
}

/**
 * **書く前に、入るかを確かめる**（sret の容量照合）。
 *
 * 呼ぶ側は `konst + Σ coef×||引数||` で場所を取り、その**個数をそのまま x15 で渡す**。
 * 呼ばれた側は入口でスロットへ仕舞っている（`em.sretLimit`）ので、ここではそれを読んで
 * 比べるだけである。越えるなら、その器は作れない——**作れなかったものは無い**ので `__`
 * を返す（完全性公理がそれを外へ運ぶ）。
 *
 * **なぜ呼ばれた側が計算し直さないか。** 追記では宛先が段ごとに進むのに仮引数は同じ
 * ままなので、自分の引数から出した式は「まるごとの容量」を答えてしまい、照合が素通り
 * する。**どこで割れているかは呼ぶ側の情報**であり（ジッパーの焦点と同じ形）、そこだけは
 * 渡すしかない。渡ってくるなら計算し直す理由も無い——**決めるのは1箇所**である。
 *
 * 見積もりが外れても壊れない。数学では無限はありふれているので、解が無いことにも答えを
 * 持っていなければならない。
 *
 * @param idxReg 書こうとしている位置（要素数）が入っているレジスタ
 */
/**
 * **器の底は、カーソルから合計を引けば出る。** 底を別のスロットに持たせると、それだけで
 * 割り当ての持ち駒（10本）を越えて関数が丸ごとメモリへ落ちる——**持たないで済むものは
 * 持たない**。使うのは出口の2箇所だけなので、そこで引く方が安い。
 */
/**
 * **中身の置き場の頭を出す。** `器の底 + 16×もらった個数` ——追記は宛先を `16×個数`
 * 進めて残りを同じ個数だけ狭めるので、この和は輪のどの段でも同じ番地になる。だから
 * 継ぎ足し位置を段の間で渡す必要が無い（そこの2語に置いてある）。
 *
 * 使うのは `SCRATCH[1]` と `dst` だけ。もらっていなければ false。
 */
function emitContentArena(em, dst) {
	if (em.sretDest === null || em.sretDest === undefined) return false;
	if (em.sretLimit === null || em.sretLimit === undefined) return false;
	// **合計は引かない。** ループは宛先を `幅×個数` 進めるのと同時に、残りそのものを同じ
	// 個数だけ狭めて書き戻す（`次の周の残り`）。だから和は最初から不変で、引くと二重に
	// なる——周ごとに `16×合計` だけ手前を指し、実測では「記号の次の語だけが落ちる」形で出た。
	em.load(dst, em.sretDest, "いまのカーソル");
	em.load(SCRATCH[1], em.sretLimit, "もらった個数");
	em.emit(`add ${dst}, ${dst}, ${SCRATCH[1]}, lsl #4`, "中身の置き場の頭");
	return true;
}

function emitSretBase(em, dst, width) {
	const shift = width === 16 ? 4 : width === 8 ? 3 : width === 4 ? 2 : width === 2 ? 1 : 0;
	em.load(dst, em.sretDest, "いまのカーソル");
	em.load(SCRATCH[1], em.sretTotal, "周を跨いだ合計");
	if (shift) em.emit(`sub ${dst}, ${dst}, ${SCRATCH[1]}, lsl #${shift}`, "戻せば器の底");
	else em.emit(`sub ${dst}, ${dst}, ${SCRATCH[1]}`, "戻せば器の底");
}

// **上限との照合はこの3命令だけである。** 上限を読み、比べ、越えていたら `__` へ飛ぶ
// ——3箇所が同じことを別々に書いていた。違うのは比べる向きと条件だけなので、そこを
// 引数にする。`em.sretLimit` が無い（スロットをもらっていない）なら何も出さない。
function emitSretCapCheck(em, lhs, rhs, cond, why) {
	if (em.sretLimit === null || em.sretLimit === undefined || !em.unitLabel) return;
	em.load(SRET_LIMIT, em.sretLimit, "入る個数（この周の残り）");
	em.emit(`cmp ${lhs}, ${rhs}`, why);
	em.emit(`b.${cond} ${em.unitLabel}`, "入らなければ器は作れない（__ を返す）");
}

function emitSretCapacityGuard(em, idxReg) {
	// **位置は底から数える。** ループにするとカーソルが周ごとに進むので、この周の中での
	// 位置（`idxReg`）だけでは上限と比べられない——前の周までに書いた合計を足す。
	// ループにならなければ合計は 0 のままで、足す命令は死んで消える。
	emitSretCapCheck(em, idxReg, SRET_LIMIT, "ge", "入るか");
}

/**
 * **個数が静的に分かるなら、位置を組み立てずに直に比べる。**
 *
 * 先頭に `k` 個並べるなら、聞きたいのは「残りが `k` 以上か」だけである。位置を作って
 * から比べると `mov` が1本余計に出る——同じ問いなので、答え方も1つでよい。
 */
/**
 * **スロットをもらったなら、器はそこへ着地する**（sret の着地）。
 *
 * 追記の枝は `len = 自分が置いた数 + 呼び先が返した len`、`ptr = 自分の宛先` で畳む。これが
 * 正しいのは**呼び先が自分のスロットへ書いた**ときだけである。ところが器を返す枝は3種類
 * あって、書くのはそのうち1つしかない：
 *
 *   組み立てた器      …… スロットに在る。そのまま。
 *   リテラル（`` `x` ``）…… `.rodata` に在る。**スロットには無い。**
 *   仮引数の切片      …… 呼ぶ側の記憶に在る。**スロットには無い。**
 *
 * 計画（`needsSlot`）は**関数ごと**に付くのに、「スロットに着地するか」は**枝ごと**に違う。
 * 実測：`g : s i ? i > 0 : (s ' 0) (g s (i - 1)) / \`x\`` が `||g \`ab\` 2||` に 3 を返しながら
 * `' 2` に 0 を返していた——**長さは合っているのに中身が無い**、診断ゼロの形である。
 *
 * だから枝ごとに直さず、**出口で1度だけ問う**。既にスロットに在るなら（`ptr` がスロットそのもの）
 * 何もしない——組み立てた枝も、下へ通した枝も、そこで一致する。在らなければ写す。
 *
 * @param width 要素1つのバイト数（`sretPlan` の `width`）
 */
function emitSretLanding(em, width) {
	if (em.sretDest === null || em.sretDest === undefined || !width) return;
	const skip = em.newLabel("landed");
	em.load(SCRATCH[0], em.sretDest, "もらったスロット");
	em.emit(`cmp x0, ${SCRATCH[0]}`, "もう自分のスロットに在るか");
	em.emit(`b.eq ${skip}`, "在るなら写さない");
	em.emit(`cbz x1, ${skip}`, "空なら写すものが無い（__ はそのまま）");
	// **写す前に入るかを確かめる。** 器を丸ごと運ぶので、要素数がそのまま位置の上限である。
	emitSretCapCheck(em, "x1", SRET_LIMIT, "gt", "入るか");
	const shift = width === 16 ? 4 : width === 8 ? 3 : width === 4 ? 2 : width === 2 ? 1 : 0;
	const top = em.newLabel("land");
	const end = em.newLabel("lande");
	em.emit("mov x13, #0", "位置");
	em.label(top);
	em.emit("cmp x13, x1");
	em.emit(`b.ge ${end}`);
	if (shift) {
		em.emit(`add x12, x0, x13, lsl #${shift}`, "写す元");
		em.emit(`add x14, ${SCRATCH[0]}, x13, lsl #${shift}`, "写す先");
	} else {
		em.emit("add x12, x0, x13", "写す元");
		em.emit(`add x14, ${SCRATCH[0]}, x13`, "写す先");
	}
	if (width === 16) {
		em.emit("ldr x11, [x12, #0]", "要素は {ptr, len} の16バイト");
		em.emit("str x11, [x14, #0]");
		em.emit("ldr x11, [x12, #8]");
		em.emit("str x11, [x14, #8]");
	} else {
		// **変位を明示する。** `[x12]` と書くと、効果を数える側（`unit_law` の
		// `effectReads`）が MMIO の読みと同じ綴りに見る——あちらの見分けは「素の `[xN]` から
		// 読んでいるか」だからである。書く側は `storeElem` が `[x14, #0]` を出しているので、
		// 読む側も揃える。**同じことをしている命令は同じ綴りで出す。**
		const ld = width === 1 ? "ldrb w11, [x12, #0]" : width === 2 ? "ldrh w11, [x12, #0]" : width === 4 ? "ldr w11, [x12, #0]" : "ldr x11, [x12, #0]";
		em.emit(ld, `${width} byte を1つ`);
		em.emit(storeElem("x11", "x14", 0, width));
	}
	em.emit("add x13, x13, #1");
	em.emit(`b ${top}`);
	em.label(end);
	em.emit(`mov x0, ${SCRATCH[0]}`, "器はスロットに在る");
	em.label(skip);
}

function emitSretCapacityNeed(em, need) {
	if (need <= 0) return;
	emitSretCapCheck(em, SRET_LIMIT, `#${need}`, "lt", `${need} 個入るか`);
}


/**
 * **括りを剥がすか、1要素として残すか。**
 *
 * `a (b c) d` の `(b c)` は、器が `List` なら1要素である——`List` の μ は任意なので入れ子が
 * 生き残る。だが器が `String` なら剥がさなければならない——**`String` の μ は強制**
 * （原理7、`String ≅ List(Char)`）で、文字列の中に文字列は入れ子で残れないからである。
 *
 * 解釈系の側は `groupedAbsorb` が同じことを言っている。**同じ規則を2箇所で書かない。**
 *
 * **ただし括った側が `List` なら、器が `String` でも剥がさない。** `groupedAbsorb` の
 * 1行目（`if (groupedNode.atomType === "List") return null`）がそれで、ブラケットが
 * 「これは器である」と宣言しているぶんは吸収に負けない——`` `abc` [1 2] `` は
 * `["abc", [1,2]]` の2要素である。ここが無条件に剥がしていたので、機械だけが
 * `[a,b,c,1,2]` の5要素を返していた（診断は出ない。長さだけが違う）。
 *
 * @param flatten 器が `String`（要素が `Char`）なら true。連接まで剥がす。
 */
function peelGroup(x, flatten) {
	let v = x;
	while (v && Array.isArray(v.lines) && v.lines.length === 1 && v.kind !== "abs" && v.kind !== "norm") {
		const inner = v.lines[0];
		if (inner && inner.type === "operation" && COPRODUCT_BUILD_OPS.has(inner.name) && (!flatten || v.atomType === "List")) break;
		v = inner;
	}
	return v;
}


function wrapFrame(bodyLines, slots, name, movedSp = false, alloc = true, peep = true) {
	// **覗き穴を切れる口**（`peep`）。自己ホストの門は「JS の pass4 が出した命令列と、Sign で
	// 書いた後段が出した命令列を、最適化を切って比べる」ものなので、切る口が無ければ門その
	// ものが開かない。既定は入りのままで、切ったときだけ通らない道である。
	if (peep) bodyLines = peepholeShareAddressBase(peepholeDeadSlotStores(peepholeSlotMoves(peepholeRedundantLoads(bodyLines))));

	// **フレームが要るかは、写す*前*の本体で決める。** 写した後を見ると `x29` が消えて
	// いるので「場所を使わない関数」に見え、退避を出さないまま x19… を壊す機械語になる
	// ——実際そうして `step` が呼び出し元の `a` を飛ばした（2026-09-01）。
	// **判定と生成が同じ本体を見ていること。**
	const bare = !movedSp && !bodyLines.some((l) => /\bx29\b/.test(l)) && !bodyLines.some((l) => /^\s*(bl|blr)\b/.test(l.split("//")[0].trim()));

	// **スロットをレジスタへ移せるなら移す。** `sp` を動かす関数はフレームの底が動くので
	// 触らない。移せたぶんだけ場所が要らなくなるので、フレームの大きさもここで決まる。
	const moved = bare || !alloc ? null : slotsToRegisters(bodyLines);
	// 往復が写しに化けたぶんを畳む。**写した後でなければ見えない**形なので、前段の
	// 覗き穴とは別に、ここで回す。向け直すと読み手を失う命令が出て、消すとまた向け直せる
	// ——動かなくなるまで回す。
	if (moved) {
		bodyLines = moved.lines;
		for (let i = 0; peep && i < 4; i++) {
			const next = deadCodeElim(propagateCopies(peepholeFoldMoves(bodyLines)));
			if (next.length === bodyLines.length && next.every((l, k) => l === bodyLines[k])) break;
			bodyLines = next;
		}
	}

	// **退避するのは、畳み終わってから残っているものだけ。**
	//
	// 移した時点の一覧で退避を決めると、そのあと死んだレジスタまで守ってしまう
	// （`mov x9, #12` / `mov x21, x9` が `mov x10, #12` に畳まれても x21 を退避し続けた）。
	// 何を守るかは、本文が決まってからでなければ決まらない。
	const live = moved && moved.needsSaving ? moved.regs.filter((r) => bodyLines.some((l) => new RegExp("\\b" + r + "\\b").test(l.split("//")[0]))) : [];
	// **退避は、記憶に残したスロットの後ろへ置く。** 全部配れたときだけスロットの領域を
	// 使い回せる——一部を残すなら、そこは塞がっている。
	const keptCells = moved ? moved.kept : 0;
	const saves = calleeSaveLines(live, "save", 16 + keptCells * 8);
	const back = calleeSaveLines(live, "restore", 16 + keptCells * 8);
	// x29/x30 の16バイト + （記憶に残したスロット ＋ 移した先の退避）
	const cells = moved ? keptCells + live.length : slots;
	const frame = 16 + Math.ceil((cells * 8) / 16) * 16;

	// 相互末尾呼び出しが置いた印を、決まったフレームの大きさで埋める。
	//
	// **畳んで飛ぶ道は出口を通らない。** 印を埋めるだけでは足りない——退避したレジスタは
	// 畳む*手前*で戻さねばならず（`ldp x29, x30` が `x29` を呼び出し元のものへ書き換えて
	// しまう）、フレームの大きさもこの畳みと出口の両方が同じ表から出ている必要がある。
	// 大きさを決める場所が2つあることに気づかず出口だけに足して、`sp` がずれて無限に回る
	// 機械語を出した（2026-09-01）。
	const filled = [];
	for (const l of bodyLines) {
		const t = l.split("//")[0];
		if (moved && l.includes(FRAME_MARK) && /^\s*ldp\s+x29,\s*x30,/.test(t)) filled.push(...back);
		filled.push(l.includes(FRAME_MARK) ? l.split(FRAME_MARK).join(String(frame)) : l);
	}
	// **`sp` を動かしたなら、戻すのは `x29` からである。**
	//
	// `ldp x29, x30, [sp], #frame` は「`sp` がフレームの底のまま」を前提にしている。
	// 本体が `sub sp, sp, #n` で場所を取ったら、その前提は崩れる——`x29` はフレームの底を
	// 指したままなので、そこから戻せばよい（AAPCS64 が `x29` をフレームポインタと呼ぶのは
	// このためである）。動かしていない関数には出さない：1命令とはいえ、全ての `ret` に
	// 付けるのは「使っていない機能の代金」である。
	const restore = movedSp ? ["\tmov sp, x29".padEnd(30) + "// sp を動かしたので戻す"] : [];

	// **場所を使わない関数は、場所を取らない。**
	//
	// フレームは「スロットを x29 相対で持つため」と「呼び出しを跨いで x30 を残すため」に
	// ある。どちらも要らない関数——覗き穴が往復を消しきって `x29` が1度も出て来ず、
	// `bl` も無い——では、`stp`/`mov x29, sp`/`ldp` の3命令はただの儀式である。
	//
	// **layer 0 ではこれが正しさの話でもある。** そこは RAM 未初期化の世界であり、
	// `sp` が有効な場所を指している保証が無い。ところが `stp x29, x30, [sp, #-32]!` は
	// プリインデックスで `sp` を下げて書く——`sub sp` という*形*をしていないだけで、
	// やっていることは確保である。門番が `sub sp` を探していたので当たっていなかった。
	// 使わないフレームを出さなくなれば、少なくとも「使わないのに触る」は消える
	// （`?` が持つ本来の要求は別の話で、layer_relations.md §4.1 が名指ししている）。
	// **畳んだ結果、場所が要らなくなることがある。** 守るものが無く、呼び出しも無く、
	// `x29` も出て来ないなら、入口と出口の3命令はただの儀式である（layer 0 ではそれが
	// 正しさの話でもある——`stp … [sp, #-32]!` は形が違うだけの確保である）。
	// **`sp` を動かした関数はフレームを手放せない。** 戻すのが `mov sp, x29` だからで
	// ある——入口と出口を落とすと `sub sp` した16バイトが返らず、`ret` した先の記憶が
	// ずれる（実際それで `@($(n + 4))` が止まらなくなった）。
	if (bare || (moved && !movedSp && !live.length && !filled.some((l) => /\bx29\b/.test(l) || /^\s*(bl|blr)\b/.test(l.split("//")[0].trim()))))
		return [`${symbolOf(name)}:`, ...filled, "\tret"];

	return [
		`${symbolOf(name)}:`,
		`\tstp x29, x30, [sp, #-${frame}]!`.padEnd(30) + `// フレーム ${frame} バイト`,
		"\tmov x29, sp",
		...saves,
		...filled,
		...restore,
		...back,
		`\tldp x29, x30, [sp], #${frame}`.padEnd(30) + "// フレームを戻す",
		"\tret",
	];
}

/**
 * 仮引数が引数レジスタを何本ずつ使うかを返す（診断は出さない）。
 *
 * **呼び出しサイトと関数の入口が同じ計算を使う必要がある。** 省略された引数には呼ぶ側が
 * `__` を置かなければならず（AAPCS64 は使われないレジスタを初期化しない）、その位置は
 * 仮引数の幅で決まるからである。2箇所で別々に数えると、片方だけが正しい命令列を出す。
 *
 * @returns 仮引数ごとの `{ shape, regs, elemSize, signed, error }`。決まらない位置は
 *   `error` に理由が入る（呼ぶ側は診断へ、呼び出しサイト側は「埋めない」判断へ使う）。
 */
function paramRegWidths(lambdaNode, em, callees = {}) {
	const allShapes = paramShapesOf(lambdaNode.left);
	const keep = allShapes.map((_, i) => i).filter((i) => {
		const sh = allShapes[i];
		return !sh || sh.kind !== "bare" || !(sh.name in callees);
	});
	// 型は2つの経路から来る。裸の仮引数は呼び出しサイトからの逆算（`callsiteParamTypes`）、
	// 分割代入された名前はラムダのスコープに直接ある——`[h ~t]` の `h` と `t` は仮引数の
	// 位置に名前が無いので、束縛の側にしか書いていない。
	const allTypes = lambdaNode.callsiteParamTypes || [];
	// **束縛は直接の Map ではなく `envLookup` で引く。** `[c ~rest]` の `c` はラムダの
	// スコープの Map に直接は載らない（載るのは器を受ける `rest` だけ）が、束縛としては
	// 解決されている。Map を覗くと「型が無い」に見えて、要素の幅が決まらなくなる。
	const typeOf = (raw) => {
		const b = lambdaNode.scope ? envLookup(lambdaNode.scope, raw) : null;
		return b ? b.atomType : null;
	};
	return keep.map((idx) => {
		let sh = allShapes[idx];
		if (!sh) return { shape: null, error: "裸の仮引数・デフォルト付き・`[h ~t]`・`[~x]` を出せます（裸の rest はまだ）" };
		if (sh.kind === "bare") {
			// **`[~x]` は宣言そのものが「器である」と言っている。** 型の解決を待たずに
			// 渡し方が決まる——要素の並びは `{ptr, len}` の2本である（stack_abi.md §4.6）。
			// n_queens.sn が「引数の書き方がそのまま型の宣言になっている」と書いているのは
			// このことで、`[~board]` は盤がリストであることを宣言している。
			// **どの器かは型が言う。** `Struct` は形が型にあるので `{ptr}` の1本、
			// `List`/`String` は要素数が型に無いので `{ptr, len}` の2本である
			// （stack_abi.md §4.6）。型が決まらないときだけ、宣言が言う「器である」に
			// 従って要素の並び（2本）として扱う——`[~x]` はそこまでは必ず言っている。
			if (sh.whole) {
				// 型が**決まっているとき**だけ型に従う。`slotsOf` は未注釈を 1 とみなすので、
				// そのまま渡すと器が1本になってしまう——宣言が「器である」と言っている
				// 以上、決まらないなら要素の並び（2本）として扱う方が宣言に忠実である。
				const t = allTypes[idx] ?? typeOf(sh.name);
				return { shape: sh, regs: t ? slotsOf(t, em.conf) ?? 2 : 2 };
			}
			// **束縛が実体の種類を知っている場合がある。** 規則を受ける仮引数（`f : c ? c ' 3`
			// を `f [0 ~+ 1]` と呼ぶ形）は、型が `Iterator` でも運ぶのは `{start, step}` の
			// 2本であって参照ではない。型だけを見ると渡し方が決まらない。
			const b = lambdaNode.scope ? envLookup(lambdaNode.scope, sh.name) : null;
			const view = { atomType: allTypes[idx] ?? (b && b.atomType), repr: b && b.repr, elementType: b && b.elementType };
			const w = slotsOfNode(view, em.conf, lambdaNode.scope);
			if (w === null) return { shape: sh, error: `仮引数 ${bareName(sh.name)} の渡し方が決まりません（直和か族）` };
			// **規則かどうかは入口の判定を変える。** 尽きているかを `len` で見るか
			// `start` と `end` の関係で見るかが違う（`emitIsUnit`）。
			return { shape: sh, regs: w, rule: isRuleNode(view, em.conf, lambdaNode.scope) };
		}
		// **構文だけでは読み方が決まらない。** `[bar ~this]` は `[h ~t]`（器の頭と残り）とも
		// `[名前 ~残り]`（構造体を名前で分ける）とも読める——同じ形である。決めるのは型だと
		// `fields` の枝が自分で書いているのに、`paramShapesOf` は型を見られないので**見た目
		// だけで先に** `destructure` を返していた。並びが引けるなら、それは構造体である。
		//
		// ここを直さないと、頭が1つの分割代入だけが器の頭として読まれる：`[bar ~this] ? bar`
		// が診断ゼロで**生のスタック番地**を返していた（頭が2つ以上の `[foo bar ~this]` は
		// `fields` の枝へ入るので正しく動く、という非対称な壊れ方）。
		if (sh.kind === "destructure" && sh.head && sh.rest && !sh.heads) {
			const rb0 = lambdaNode.scope ? envLookup(lambdaNode.scope, sh.rest) : null;
			if (rb0 && rb0.shape && rb0.shape.slotKind === "named") {
				sh = { kind: "fields", names: [sh.head], heads: [sh.head], rest: sh.rest };
			}
		}
		// **尾が入力（Reader）なら、頭がいくつでも番地1本で受ける。** 器ではないので ptr と len の
		// 2本は要らない——状態は番地だけで、頭は番地から読み、尾は同じ番地である（type_system.md
		// §3.5）。頭が2つ以上だと `fields` の形で来るので、その枝より前で拾う（後ろに置くと
		// `[a b ~xs]` だけが器の道へ落ち、ptr と len で引いていた）。
		if (sh.rest) {
			const restB = lambdaNode.scope ? envLookup(lambdaNode.scope, sh.rest) : null;
			if (restB && restB.atomType === "Reader") {
				const heads = sh.heads || (sh.head ? [sh.head] : []);
				return { shape: { kind: "destructure", heads, head: heads[0], rest: sh.rest }, regs: 1, reader: true };
			}
		}
		// **名前で分ける形は `{ptr}` 1本で受ける。** 構造体は形が型にあるので長さが要らない
		// （stack_abi.md §4.6）。名前はコンパイル時にオフセットへ解決されるので、入口で
		// することは固定オフセットからのロードだけである。
		if (sh.kind === "fields") {
			// 並びは呼び出しサイトが知っている。Pass 3 が仮引数の束縛へ形を置いている
			// ので（`shape`）、そこから引く——無ければ `~obj` の型から引き直す。
			const rb = lambdaNode.scope ? envLookup(lambdaNode.scope, sh.rest) : null;
			const lay = (rb && rb.shape) || lambdaNode.structLayout || null;
			// **並びが引けたなら構造体である。** 名前がコンパイル時にオフセットへ解決
			// されるので `{ptr}` 1本で足りる。
			if (lay) return { shape: sh, regs: 1, layout: lay };
			// **引けないなら位置で読む。** 名前を持たない器（List / String）に渡された、
			// ということであり、そこでは位置しか読み方が無い。`[h ~t]` と同じ道であって、
			// 先頭が n 個あるだけである。
			const ht = typeOf(sh.heads[0]);
			const el = ht ? measure({ atomType: ht }, { target: em.conf.target, charset: em.conf.charset }) : null;
			if (el && el.size && slotsOf(ht, em.conf) === 1) {
				return {
					shape: { kind: "destructure", heads: sh.heads, head: sh.heads[0], rest: sh.rest },
					regs: 2,
					elemSize: el.size,
					signed: SIGNEDNESS[ht] === "signed",
				};
			}
			return { shape: sh, regs: 1, layout: null };
		}
		const headType = typeOf(sh.head);
		const elem = headType ? measure({ atomType: headType }, { target: em.conf.target, charset: em.conf.charset }) : null;
		if (!elem || !elem.size) {
			return { shape: sh, error: `\`[${bareName(sh.head)} ~${bareName(sh.rest)}]\` の要素の幅が決まりません（${headType}）` };
		}
		if (slotsOf(headType, em.conf) !== 1) {
			return { shape: sh, error: `要素そのものが参照で運ぶ値の分割代入はまだ出せません（${headType}）` };
		}
		return { shape: sh, regs: 2, elemSize: elem.size, signed: SIGNEDNESS[headType] === "signed" };
	});
}
/**
 * 関数ごとの引数レジスタの並びを先に集める。呼び出しサイトが「省略された引数」の位置を
 * 知るために要る（`genFunction` と同じ `paramRegWidths` を使うので、必ず一致する）。
 */
/**
 * **関数ごとに、返す本数を集める。**
 *
 * `slotsOfNode` は型注釈が無いノードを1本と数える（整数リテラルのための既定）。
 * ところが**呼び出しの結果**にその既定を当てると、呼び先が2本書いていても呼ぶ側は
 * x1 を読まない——`{ptr, len}` の len が落ちて、器が生番地1本になる。具体化した
 * `@p` の呼び出しは pass3 が型を付けられないので、ちょうどこの形になっていた：
 *
 *     f : [~s] ? s
 *     g : p ? @p `abc`
 *     ||g $f||                  解釈 3 ／実機 1（診断ゼロ）
 *
 * 呼び先が何本返すかは静的に決まっているので、表にしておいて呼ぶ側が引く。列挙は
 * `collectSignatures` と同じ——**出す関数の集合と、幅を持つ関数の集合は同じでなければ
 * ならない**（引数の幅で一度踏んだのと同じ話である）。
 */
function collectReturnWidths(nodes, em, monos = null) {
	const out = new Map();
	const put = (name, lam) => {
		if (!lam || lam.type !== "operation" || lam.name !== "lambda" || out.has(name)) return;
		// **型が無い本体は表に載せない。** `slotsOfNode` の既定（1本）をここで固めると、
		// 「分からない」が「1本だと分かっている」に化ける——呼ぶ側はそれを信じて x1 を
		// 読まなくなる。分からないことは表に書かない（原理4）。
		const body = lam.right;
		if (!body || !body.atomType) return;
		const w = slotsOfNode(body, em.conf, lam.scope || em.env);
		if (w !== null && w !== undefined) out.set(name, w);
	};
	for (const node of nodes) {
		if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
		put(bareName(node.left.value), node.right);
	}
	for (const [label, lam] of (monos && monos.hoisted) || []) put(label, lam);
	return out;
}

function collectSignatures(nodes, em, monos = null) {
	const sig = new Map();
	for (const node of nodes) {
		if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
		const rhs = node.right;
		if (!rhs || rhs.type !== "operation" || rhs.name !== "lambda") continue;
		sig.set(bareName(node.left.value), paramRegWidths(rhs, em));
	}
	// **出す関数の集合と、署名を持つ関数の集合は同じでなければならない。**
	//
	// デフォルトに書いたラムダは関数内関数の定義であり、`collectMonomorphs` が名前を与えて
	// トップレベルの実体として出している（`monos.hoisted`）。ところがここはトップレベルの
	// `名前 : ラムダ` しか数えていなかったので、そこへの呼び出しだけ `sigW` が undefined に
	// なり、**持ち上げ（1619）も幅の検査（1643）も丸ごと飛んでいた**：
	//
	//     f :
	//     	s
	//     	p : [~x] ? 7
	//     ?
	//     	p s
	//     f \a                       解釈 7／実機 __（診断ゼロ）
	//
	// 片方に足すのではなく、**同じ列挙から引く**のが筋である。
	for (const [label, lam] of (monos && monos.hoisted) || []) {
		if (!lam || lam.type !== "operation" || lam.name !== "lambda") continue;
		if (!sig.has(label)) sig.set(label, paramRegWidths(lam, em));
	}
	return sig;
}
/**
 * **返す器は、呼び出し側が用意したスロットへ書く（sret）。**
 *
 * 自分のフレームに置いた器は返せない——エピローグの `mov sp, x29` が捨てるので、
 * 返したアドレスは死んだ場所を指す（memory_management.md §2）。そこで**呼び出し側が
 * 場所を用意し、呼ばれた側はそこへ書く**。使うのは x8、AAPCS64 が16バイトを超える
 * 複合型に使う間接返値レジスタそのものである——規約を新しく作らず、ハードウェアの
 * 側に既にあるものへ乗る（原理1：RISC as-is）。
 *
 * 用意する大きさは `returnSizeBound` の上界である。正確な個数は実行時に決まるが、
 * **上界は静的に書ける**——そこが sret を成立させている。
 *
 * @returns 名前 → `{ konst, terms, width, builds, needsSlot }`。`terms` は
 *   `{ coef, sizeOf, sizeOfIndex, measure }` の並びで、バイト数は
 *   `(konst + Σ coef × 測った値) × width`。`sizeOfIndex` は呼ぶ側が引数の位置で、
 *   `sizeOf` は呼ばれた側が仮引数の名前で同じ器を指す。`measure` が `len` なら要素数、
 *   `chars` なら μ（要素の長さの総和）で測る。`builds` は自分で器を組むか、
 *   `needsSlot` は場所をもらう必要があるか。
 */
/**
 * 上界を集める。**不動点で回す。**
 *
 * ある関数の上界が、別の関数の上界に依ることがある——`gap : st d ? … (closers st d)
 * newline` は「`closers` が返す器 ＋ 1」であり、`closers` の上界が決まらなければ決まら
 * ない。定義の順序で決まってしまわないように、増えなくなるまで回す。
 */
function collectSretPlan(nodes, em, stats = null) {
	let plan = new Map();
	const groups = mutualGroups(nodes);
	// **上界が動かなくなるまで回す。** 以前は「計画に載った名前の数」と `needsSlot` の旗しか
	// 見ておらず、上界そのものがまだ伸びている途中で止まっていた。相互再帰の輪では内側の
	// 上界が先に伸び、それを呼ぶ外側は1〜2周前の値のまま残る——parser.sn では `out` が
	// `μ + 42×len` なのに、それを包む `expr_at` は `6 + μ + 21×len`、さらに外の `run` は
	// `6 + μ + 1×len` だった。足りない置き場所は容量の照合が `__` にするが、連結の中では
	// その `__` が吸われるので、**機械は黙って短い綴りを返す**（解釈 30 文字、機械 6 文字）。
	//
	// 上界の言葉（`konst + Σ coef×測った値`）で不動点が無い形——周ごとに伸び続ける形——は、
	// 上限まで回っても動く名前を計画から外す。外れた関数とそれを頼る呼び手は上界を持たない
	// と言うことになり、名指しで断られる。伸びている途中の値を使うことはもう無い。
	const sig = (v) => JSON.stringify([v.konst, v.width, v.builds, v.needsSlot,
		v.terms.map((t) => [t.coef, t.sizeOf, t.sizeOfIndex, t.measure]),
		(v.content || []).map((t) => [t.coef, t.sizeOf, t.sizeOfIndex, t.measure]), v.eats || []]);
	const banned = new Set();
	const LIMIT = 64;
	for (let round = 1; ; round++) {
		const next = collectSretPlanOnce(nodes, em, plan, groups);
		for (const k of banned) next.delete(k);
		const moved = [...new Set([...plan.keys(), ...next.keys()])]
			.filter((k) => !plan.has(k) || !next.has(k) || sig(plan.get(k)) !== sig(next.get(k)));
		if (moved.length === 0) {
			// 試験が見る：何周で止まったか・外した名前・もう1周回しても動かないか（不動点の確認）
			if (stats) {
				const again = collectSretPlanOnce(nodes, em, next, groups);
				for (const k of banned) again.delete(k);
				const stable = again.size === next.size && [...next].every(([k, v]) => again.has(k) && sig(again.get(k)) === sig(v));
				stats.push({ rounds: round, limit: LIMIT, banned: [...banned], stable, plan: next });
			}
			return next;
		}
		if (round >= LIMIT) {
			for (const k of moved) banned.add(k);
			round = 0;
		}
		plan = next;
	}
}

/**
 * その枝は**場所を要る呼び出しの結果**をそのまま返すか。
 *
 * 返すなら、その器は呼び先が書く場所に在る。自分が x8 をもらって下へ渡せば、場所は
 * 最も外側で一度だけ取れば済む——もらわなければ自分のフレームに取ることになり、
 * 返した先では死んでいる。
 */
function returnsCallResult(arm, known) {
	const u = stripExpand(arm);
	if (!u) return false;
	if (u.type === "operation" && u.name === "or") return returnsCallResult(u.left, known) || returnsCallResult(u.right, known);
	if (Array.isArray(u.lines)) return u.lines.some((l) => returnsCallResult(isDefineNode(l) ? l.right : l, known));
	if (u.type !== "operation" || u.name !== "apply") return false;
	const { head, args } = applyParts(u);
	if (!isIdentifierNode(head)) return false;
	const e = known.get(bareName(head.value));
	if (!e) return false;
	if (e.needsSlot) return true;
	// **透過な呼び先の向こうを見る。** 器を組まず引数の切片を返す関数は、返る器の場所が
	// **引数の場所**である。だから場所が要るかどうかは引数の側が決める。
	return args.some((a) => returnsCallResult(a, known));
}

function collectSretPlanOnce(nodes, em, known, groups) {
	const plan = new Map();
	for (const node of nodes) {
		if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
		const lam = node.right;
		if (!lam || lam.type !== "operation" || lam.name !== "lambda") continue;
		// 本体の末尾で器を組み、それがフレームから出る形だけが対象である。
		const arms = Array.isArray(lam.right && lam.right.lines)
			? lam.right.lines.map((l) => (isDefineNode(l) ? l.right : l))
			: [lam.right];
		// **組み直しは器を作らない。** `strip_head : [c ~rest] ? … c rest` の `c rest` は
		// 渡された器そのもので、ptr を1つ戻すだけである（`rejoinPair`——確保は0）。
		// ここを「組む」と数えると、呼ぶ側が場所を用意するのに呼ばれた側はそこへ書かず、
		// **引数の切片**を返す。その引数が呼ぶ側のフレームに在れば、返した先で死んでいる。
		const rejoinScope = {
			bracketPairs: paramShapesOf(lam.left)
				.filter((sh) => sh && sh.kind === "destructure")
				.map((sh) => ({ head: sh.head, rest: sh.rest })),
		};
		// **出て行く器は、末尾の枝にいるとは限らない。** 蓄積子は引数の位置で組まれる：
		//
		//     go : [~acc] [~ts] i ?
		//         i > 2 : acc
		//         go (acc~ , (ts ' i)) ts (i + 1)      ← ここ
		//
		// `go` は仮引数をそのまま返すので、この引数は**出て行く**（`markEscapes` はそう
		// 印を付けている）。だが計画は末尾の枝しか見ておらず、`go` は「組まない」と読まれて
		// 場所をもらえなかった——組んだ器は自分のフレームに置かれ、返した先で死ぬ。
		//
		// **出て行く印が付いている器は、どこに書かれていても外から場所をもらう**のが
		// 「場所は最も外側で一度だけ取る」の言い換えである。
		let build = null;
		const findBuild = (x) => {
			if (!x || typeof x !== "object" || build) return;
			const u = unwrap(x);
			// **上書きのマージも器を作らない。** `a~ b~` で左が名前なら、書き先は a の器
			// そのもので確保は起きない——組み直し（`rejoinPair`）が渡された器を指し直す
			// だけなのと同じ形である。ここを「作る」と数えると、呼ぶ側が要りもしない返値
			// スロットを用意しようとして、その大きさを引数から測ろうとする
			// ——`f : s ? s~ [ bar : 99 ]~` が「第1引数が器ではない」で止まっていた
			// （構造体は `{ptr}` の1本で運ぶので、器の `{ptr, len}` 2本にはならない）。
			if (u && u.slotOrigins && u.mergeBase === "name") return;
			if (u && u.type === "operation" && COPRODUCT_BUILD_OPS.has(u.name) && u.escapesFrame !== false && !rejoinPair(u, rejoinScope)) {
				build = u;
				return;
			}
			// 構造体ブロックも器を組む。`COPRODUCT_BUILD_OPS` は operation しか拾わない。
			if (isStructBlock(u) && u.escapesFrame !== false) {
				build = u;
				return;
			}
			for (const k of ["left", "right", "operand"]) findBuild(x[k]);
			for (const l of x.lines || []) findBuild(l);
		};
		findBuild(lam.right);
		// **上界は器を返す関数すべてについて出す。** 場所を要るのは組む関数だけだが、上界は
		// **合成のため**に誰のぶんも要る——`close_all (next_st st d)` の内側がそれで、
		// `next_st` は組まない（`push` / `unwind` を呼ぶだけ）ので計画に載らず、外側の
		// 上界が出せなかった。**載せる基準は「組むか」ではなく「器を返すか」である。**
		const builds = !!build;
		if (!builds && !isBoxType(lam.right && lam.right.atomType)) continue;
		// **要素1つを置くのに何バイト要るか**は、`measure` ではなく `passingOf` が答える。
		//
		// `measure({atomType:"String"})` は「その文字列の中身の長さ」を測ろうとするので
		// 長さが型に無いと null になる。だがここで要るのは**運ぶ幅**であり、`String` を
		// 要素にする器は `{ptr, len}` の2語＝16 byte で並べる（`passingOf` はそう答える）。
		//
		// これが無いと、要素が `String` の器を返す関数——lexer.sn の `tokens` がまさに
		// それ——は sret の計画に載らず、「フレームから出るので置けない」で止まっていた。
		// レジスタに乗る要素（`Char`/`Int`）はこれまで通り `measure` の答えと同じである。
		// その順（`passingOf` が先、`measure` は後）は `elementCellSize` が持っている。
		// **幅は返す器が決める。** 組む節があればそれが言うし、無ければ返値の型が言う——
		// 組まずに下から受け取って返す関数（`mark`）も、返すのは同じ形の器である。
		const shape = build || lam.right;
		// **Struct の上界はバイト数そのものである。** 要素数の道（`konst × width`）は「要素が
		// 何個で、1つが何バイトか」を掛けるが、構造体は要素の並びではなく**形が型に入って
		// いる**——`layoutOfStruct` がバイト数を直接答えるので、掛け算に載せず konst を
		// バイト数・width を 1 として置く。0_design_principles.md のサイズ表に String と
		// List の行しか無いのは、構造体がこの道を通らないからである。
		if (isStructBlock(shape)) {
			// **上界を出すのに識別子テーブルが要ることがある。** 撒く行を含む形
			// （`[ foo : 99 / this~ ]`）は、撒く器の並びが仮引数の束縛にしかない
			// ——`env` を渡していなかったので並びが起こせず、計画に載らないまま
			// 「まだ出せない式です（block）」で止まっていた。**関数の中でだけ**動かない、
			// という非対称な壊れ方である。スコープはラムダのもので引く（`genFunction` と同じ）。
			const slay = layoutOfStruct(shape, { target: em.conf.target, charset: em.conf.charset, env: lam.scope || em.env });
			if (slay && slay.size) {
				plan.set(bareName(node.left.value), {
					konst: structFootprint(slay),
					terms: [],
					width: 1,
					builds,
					needsSlot: builds || arms.some((a) => returnsCallResult(a, known)),
				});
			}
			continue;
		}
		const et = shape ? shape.elementType || (shape.atomType === "String" ? "Char" : null) : null;
		const m = elementCellSize(et, em.conf);
		// **幅が測れなくても落とさない。** 上界は合成のために誰のぶんも要る——ここで
		// `continue` すると `continues` / `next_st` のぶんが消え、それを呼ぶ `walk` の
		// 上界まで出せなくなる（walk が計画から落ち、器を置く先を失っていた）。
		//
		// **場所が要るかどうかは別の問いである。** 要るのは「返す器がどこかのフレームに
		// 取られている」とき——自分で組むか、下の呼び出しの結果を返すか——であり、
		// どちらも幅が言えなければ確保できない。
		const name = bareName(node.left.value);
		const b = returnSizeBound(lam, name, known, groups && groups.get(bareName(node.left.value)), em.env);
		if (!b) continue;
		// **名前も位置も持つ。** 呼ぶ側は引数の位置で、呼ばれた側は自分の仮引数の名前で
		// 同じ器を指す。位置は枠ごとに違いうる（分解した名前が混ざる）ので、両側が同じ
		// ものを見ていると言えるのは名前の方である。
		const names = boundParamNames(lam);
		const terms = [];
		let ok = true;
		for (const t of b.terms) {
			// **ここで印を落とす。** 上界を組み立てるあいだは測り方を名前へ付けて Map の鍵に
			// していた（合流の規則をそのまま効かせるため）。計画は両側が引く表なので、名前は
			// 仮引数そのもの、測り方は欄として持つ。
			const sizeOf = bareMeasureName(t.sizeOf);
			const at = names.indexOf(sizeOf);
			if (at < 0) { ok = false; break; } // 相手が仮引数でなければ呼ぶ側は測れない
			terms.push({ coef: t.coef, sizeOf, sizeOfIndex: at, measure: measureOfKey(t.sizeOf) });
		}
		if (!ok) continue;
		// **場所が要るのは「返す器が、死ぬフレームに取られる」ときだけである。**
		//
		//   - 自分で組む            → 自分のフレームに取るので要る（`builds`）
		//   - 下の呼び出しの結果を返す → その呼び先も場所を要るので、もらって渡す（`mark`）
		//   - 仮引数をそのまま返す    → **呼び手の場所**なので要らない（`f : s ? s`）
		//
		// 3つ目を混ぜると、返すだけの関数にまで `sub sp` が付く。
		const needsSlot = !!(m && m.size) && (builds || arms.some((a) => returnsCallResult(a, known)));
		// **中身の置き場にも上界が要る。** 要素を `{ptr, len}` で運ぶ器（幅 16）は、記述子の
		// 並びだけでは足りない——指す先の**中身**が呼び手のスロットの中に無ければ、返った先で
		// 死ぬ。記述子の上界が `Σ coef×||器||` なら、中身はその器の**中身の総量**で抑えられる
		// （要素は引数を食って作られるので、総量が増える形は実行時の照合で `__` へ落ちる）。
		//
		// 測り方は呼ぶ側が実引数を見て決める（`content`）——`String` の中身の総量は `len`
		// そのものだが、`List(String)` なら μ（各要素の `len` の和）である。
		//
		// **konst の枝は今は出せない。** 字面で置く要素の中身は引数から測れないので、その
		// ぶんの置き場が言えない。上界を持たないまま出すと踏み抜くので、載せない。
		const content = m && m.size === 16 && b.konst === 0 && terms.length > 0
			? terms.map((x) => ({ coef: x.coef, sizeOf: x.sizeOf, sizeOfIndex: x.sizeOfIndex, measure: "content" }))
			: null;
		plan.set(name, { konst: b.konst, terms, width: m && m.size ? m.size : null, builds, needsSlot, content, eats: b.eats || [] });
	}
	return plan;
}

/**
 * **その部分は「器の続きを自分で書ける」呼び出しか。**
 *
 * 追記が成立するのは、相手が sret の規約で呼べる——つまり x8 で宛先を受け取れる——
 * ときだけである。そうでなければ相手は自分の場所へ書くので、こちらが写す羽目になる。
 *
 * @returns 呼び先の素の名前。追記できないなら null。
 */
/**
 * 追記の相手から後置 `~`（撒く）を剥がす。
 *
 * **List の μ は任意であり、`String` のそれは強制である**（原理7）。だから同じ「要素 ＋
 * 再帰の結果」でも、文字列は `(s ' 0) (f rest)` で平らになるのに、列は `(… ) (m rest)~`
 * と `~` を書かないと入れ子になる。写像がまさにこの形である。
 *
 * だが**追記の位置では `~` は 0 命令である**。呼ばれた側は自分の器の続きへ要素を連続して
 * 書くので、書き終えた領域は既に平らだからだ——器に当てた `~` が恒等であるのと同じ話。
 * 型の上で要る記号が、この位置では命令を1つも生まない。
 */
function stripExpand(node) {
	const u = unwrap(node);
	if (u && u.type === "operation" && u.position === "postfix" && u.name === "expand" && u.operand) return unwrap(u.operand);
	return u;
}

/**
 * **自分を呼んでいるか。** 追記のループ（底・合計の2スロットと、位置に合計を足す照合）は
 * 自己再帰にしか効かないので、そうでない関数に代金を払わせない。
 *
 * 実測でここを配らなかったとき、スロットが2つ増えただけで `slotsToRegisters` の持ち駒
 * （10本）を越え、`tokens` と `take_while` が丸ごとメモリへ落ちた——往復 30 → 278。
 * **要らない関数に持たせないことが、そのまま割り当ての成否になる。**
 *
 * 広めに見てよい（見落とすとループにならないだけ、余計に見ても代金を払うだけ）。ただし
 * **ループにするかの判定と同じ旗を使う**こと——2箇所で決めると必ず食い違う。
 */
function callsItself(node, name) {
	const self = new Set([name, bareName(name), bareName(name).split("$")[0]]);
	let found = false;
	const walk = (x) => {
		if (!x || typeof x !== "object" || found) return;
		if (isIdentifierNode(x) && (self.has(x.value) || self.has(bareName(x.value)))) { found = true; return; }
		for (const k of ["left", "right", "operand"]) walk(x[k]);
		if (Array.isArray(x.lines)) x.lines.forEach(walk);
	};
	walk(node);
	return found;
}

function appendableCallee(node, em) {
	const u = stripExpand(node);
	if (!u || u.type !== "operation" || u.name !== "apply") return null;
	const { head } = applyParts(u);
	if (!isIdentifierNode(head)) return null;
	const nm = bareName(head.value);
	const e = em.sretPlan && em.sretPlan.get(nm);
	return e && e.needsSlot ? nm : null;
}

/** 上界をバイト数へ。16 バイト境界へ丸める（AAPCS64 は `sp` の 16 整列を要求する）。 */
function sretBytesConst(p) {
	return Math.ceil((p.konst * p.width) / 16) * 16;
}

function genFunction(name, lambdaNode, env, em, mono) {
	// **本体の中では、名前は関数のスコープで解決する。**
	//
	// 外側の識別子テーブルだけを見ていると、仮引数が「見つからない名前」になる。型は
	// `callsiteParamTypes` が別経路で運んでいたので気づきにくかったが、**渡し方**
	// （`repr`）は束縛にしか無い——規則を受けた仮引数が要素列への参照に見えていた。
	// スコープは親へ繋がっているので、これでグローバルも今まで通り引ける。
	env = lambdaNode.scope || env;
	// 具体化された関数ポインタの仮引数は**引数として渡ってこない**（命令へ焼き込み済み）。
	const callees = (mono && mono.callees) || {};
	// 出せない形の報告は `paramRegWidths` が返す `error` に一本化してある（下）。
	// ここで別文言を出すと、同じ理由が2通りの言い方で出ることになる。仮引数の形と型を
	// 数え直すのも同じ理由で向こう側だけにある——ここに写しを置くと、片方だけが正しくなる。

	// 入ってくるレジスタの本数と、本体から見える名前を作る。
	//   裸        1つの名前 : 型の幅ぶん
	//   `[h ~t]`  容器が `{ptr, len}` の2本で来て、そこから2つの名前が生える
	// 幅の計算は**呼び出しサイトと同じ関数**で行う（`paramRegWidths`）。省略された引数へ
	// `__` を置く位置がそこで決まるので、2箇所で別々に数えると片方だけが正しくなる。
	const incoming = paramRegWidths(lambdaNode, em, callees);
	const bad = incoming.find((x) => x.error);
	if (bad) {
		em.diagnostics.push({ severity: "error", message: `${name}: ${bad.error}`, node: lambdaNode });
		return;
	}
	// レジスタが尽きたら残りはスタックで受ける（AAPCS64 §6.4）。割り振りは呼ぶ側と
	// **同じ関数**で計算する——2箇所で別々に数えると片方だけが正しい命令列を出す。
	const inPlan = assignArgSlots(incoming.map((x) => x.regs));

	// 本体は別の行配列へ出してから包む（フレームの大きさが後で決まるため）。
	const outer = em.lines;
	em.lines = [];
	em.slot = 0;
	em.maxSlot = 0;
	em.movedSp = false; // 本体が `sp` を動かしたか（エピローグの戻し方が変わる）

	// **末尾自己再帰の飛び先。** フレームの確保（`stp`）はこの外側にあり、ここから下だけを
	// 繰り返す——だから再帰の深さがスタックに積まれない（tco.md §7「同一スタック
	// フレームへの JMP」）。
	//
	// 飛び先を**仮引数の写しと完全性公理の検査より前**に置くのが要である。後ろに置くと
	// 検査が初回しか通らず、終端が消える。
	//
	// **返値スロットの退避は飛び先より前に置く。** x8 と x15 は入口の値であって、周ごとに
	// 変わるものではない——中で写すと、`bl` で壊れた残骸を毎周書き戻すことになる（実際
	// そうなっていて、飛ぶ直前にスロットから読み直す命令で埋め合わせていた）。**同じ値を
	// 2度決めない。**
	em.sretDest = null;
	// 返値スロットの中で、入れ子をどこまで置いたか（親のすぐ後ろから前順に伸びる）。
	em.sretBump = 0;
	em.sretLimit = null;
	em.sretTotal = null;
	// **具体化された実体も同じ器を返す。** 名前は `take_while$is_digit` に変わるが、返す形は
	// 元の定義が決めているので、素の名前でも引く——ここを見落とすと、多相な関数だけが
	// sret から取り残される（実際 `take_while` がそうなっていた）。
	const sretKey = bareName(name).split("$")[0];
	const sretEntry = em.sretPlan && (em.sretPlan.get(bareName(name)) || em.sretPlan.get(sretKey));
	if (sretEntry && sretEntry.needsSlot) {
		em.push();
		em.sretDest = (em.slot - 1) * 8;
		em.store("x8", em.sretDest, "返値スロットのアドレス（sret）を退避");
		// **どこまでが自分のものかは、呼ぶ側にしか分からない。**
		//
		// 以前はここで上界の式を自分の仮引数から計算し直していた（呼ぶ側と同じ式なので
		// 一致する、という理屈）。追記の道でそれが崩れる——`(s ' 0) (g s (i - 1))` は
		// 器の**続き**を書くので、段が下がるたびに宛先だけが進み、仮引数 `s` は同じまま
		// である。自分で計算すると毎段まるごとの容量が答えになり、照合は素通りする
		// （実測：上界3に対し41要素書いて qemu が止まる）。
		//
		// **割れ目は呼ぶ側の情報である**——ジッパーの焦点を呼ぶ側が選ぶのと同じ形で、
		// 残りは渡すしかない。渡ってくるなら呼ばれた側が計算し直す理由も無い：
		// **決めるのは1箇所**である。
		em.push();
		em.sretLimit = (em.slot - 1) * 8;
		em.store(SRET_LIMIT, em.sretLimit, "返値スロットに入る個数（sret）を退避");
		// **自分自身への追記をループにするための2つ。** 追記は器の続きを書くので、段が
		// 下がるたびに宛先だけが進む——ならば段を下げずに**宛先だけ進めればループになる**
		// （clang が `1 + f(…)` を蓄積子でループへ均すのと同じ変換）。
		//
		//   底（`sretBase`）  …… 返す `ptr`。周を回っても動かない。
		//   合計（`sretTotal`）…… ここまでに書いた個数。周を跨いで積む。
		//   カーソル（`sretDest`）…… 次に書く場所。周ごとに `k×幅` 進む。
		//
		// 3つとも**飛び先（`.Lloop`）より前**に置く。スロットは `x29` 相対でフレームは
		// 畳まれないので、後ろ向き辺を跨いで生き残る。
		//
		// **自分を呼ばない関数には持たせない**（`callsItself`）。スロットが2つ増えるだけで
		// 割り当ての持ち駒を越え、関数が丸ごとメモリへ落ちる。
		if (callsItself(lambdaNode.right, name)) {
			em.push();
			em.sretTotal = (em.slot - 1) * 8;
			em.emit(`mov ${SCRATCH[0]}, #0`, "ここまでに書いた個数");
			em.store(SCRATCH[0], em.sretTotal, "周を跨ぐ合計");
		}
	}
	em.sretLooped = false;
	const loopLabel = em.newLabel("loop");
	em.label(loopLabel);
	const bracketPairs = [];

	// **仮引数を入口でスロットへ写す。** 引数レジスタは最初の `bl` で壊れるので、
	// 本体のどこからでも読める場所へ移しておく必要がある。
	// 幅は引数ごとに違う——器を受ける仮引数は `{ptr, len}` で2本来る（stack_abi.md §4.6）。
	// **スタックで渡された引数は、自分のフレームの上にある。** `stp x29, x30, [sp, #-frame]!`
	// で `sp` が frame ぶん下がっているので、呼ぶ側が `[sp]` から積んだものは `x29 + frame`
	// にある。フレームの大きさは本体を出し切るまで決まらないので印を置く。
	if (inPlan.stackBytes > 0) em.emit(`add ${SCRATCH[1]}, x29, #${FRAME_MARK}`, "スタックで渡された引数域");
	incoming.forEach((inc, i) => {
		const s = inPlan.slots[i];
		inc.off = em.slot * 8;
		for (let k = 0; k < inc.regs; k++) {
			em.push();
			const what = inc.shape.kind === "bare" ? bareName(inc.shape.name) : `[${bareName(inc.shape.head)} ~${bareName(inc.shape.rest)}]`;
			const note = k === 0 ? `仮引数 ${what} を退避${inc.regs > 1 ? "（ptr）" : ""}` : "（len）";
			if (s.reg !== null) {
				em.store(ARG_REGS[s.reg + k], (em.slot - 1) * 8, note);
				continue;
			}
			em.emit(`ldr ${SCRATCH[0]}, [${SCRATCH[1]}, #${s.stackOff + k * 8}]`, k === 0 ? `仮引数 ${what}（スタック渡し）` : undefined);
			em.store(SCRATCH[0], (em.slot - 1) * 8, note);
		}
	});
	for (const [pn, cn] of Object.entries(callees)) em.emit(`// ${bareName(pn)} = ${cn}`, "具体化された呼び先");

	// **完全性公理を出す。** `f __ = __`——所有の引数に有効値が揃って初めて呼び出しが
	// 真になるので、どれか1つでも `__` なら本体へ一歩も入らずに `__` を返す
	// （unit.md §完全性公理、0_design_principles.md 原理5）。
	//
	// Sign にループは無く再帰しかない以上、これは最適化ではなく**終端そのもの**である。
	// 出さないと「命令は出ているのに止まらない」——診断も出ない一番たちの悪い形になる。
	//
	// 検査は**仮引数をスロットへ写した後**に置く。TCO でフレームを使い回すとき、飛び先が
	// この検査より後ろにあると初回しか検査を通らず、ループが終わらなくなるためである。
	// **検査・デフォルトの充填・分解は、宣言順に混ぜて出す。**
	//
	// 評価器（`bindParams`）が仮引数を1つずつ順に見るのと同じ順序でなければならない。
	// デフォルト式は前の仮引数を参照でき（`let*`、1_definition.md §6.1）、かつ Input
	// （前置 `@`）を含みうる——MMIO は読むたびに値が変わりうるので、**どの順で何回読むかが
	// 観測できる**。まとめて先に出すと、崩壊するはずの呼び出しで余計な読み出しが起きる。
	//
	// デフォルトを持つ仮引数は完全性公理の対象外である。`__` を受けても崩壊させず、
	// デフォルト式の値で埋める（それが `__` でも埋めたことにする——`s : __` が定義域を
	// 持ち上げるのはこの一点である。Pass 3 が information で名指ししている）。
	const unitLabel = incoming.length > 0 ? em.newLabel("unit") : null;
	const params = [];
	const paramOffsets = [];
	const paramSlots = [];
	// **入口の門番を通った仮引数**。デフォルトを持つものは通らない（渡されなければ
	// デフォルトで埋まり、その値が `__` である可能性を否定できない）ので入れない。
	const total = new Set();
	const scopeSoFar = () => ({ params, paramOffsets, paramSlots, callees, total });
	for (const inc of incoming) {
		const what = inc.shape.kind === "bare" ? bareName(inc.shape.name) : `[${bareName(inc.shape.head)} ~${bareName(inc.shape.rest)}]`;
		if (inc.shape.kind === "bare" && inc.shape.defaultNode) {
			// **デフォルトが `__` なら命令は要らない。** 埋めるのは値が `__` のときだけで
			// あり、そこへ `__` を置いても何も変わらない。つまりこの宣言の内容は
			// 「この引数について完全性公理を働かせない」の一点であって、検査を飛ばせば
			// それで足りる——定義域の持ち上げ（Pass 3 が information で名指しする）が
			// 機械の上では**命令ゼロ**であることが、ここで見える。
			if (inc.shape.defaultNode.type === "atom" && inc.shape.defaultNode.kind === "unit") {
				em.emit(`// ${what} は __ を受けても崩壊しない`, "定義域の持ち上げ");
				params.push(inc.shape.name);
				paramOffsets.push(inc.off);
				paramSlots.push(inc.regs);
				continue;
			}
			// 渡されていれば（`__` でなければ）そのまま。渡されていなければ埋める。
			const have = em.newLabel("have");
			emitIsUnit(em, inc.off, inc.regs, `仮引数 ${what} が渡されたか`, inc.rule);
			em.emit(`b.ne ${have}`, "渡されていればそのまま");
			const dw = genExpr(inc.shape.defaultNode, env, em, scopeSoFar());
			if (dw === false) {
				em.diagnostics.push({ severity: "error", message: `${name}: 仮引数 ${what} のデフォルト式を出せませんでした`, node: inc.shape.defaultNode });
				return;
			}
			if (dw === TAIL || dw !== inc.regs) {
				em.pop(dw === TAIL ? 0 : dw);
				em.diagnostics.push({
					severity: "error",
					message: `${name}: 仮引数 ${what} のデフォルトの幅が合いません（${dw} 本と ${inc.regs} 本）`,
					node: inc.shape.defaultNode,
				});
				return;
			}
			const base = em.slot - dw;
			for (let k = 0; k < dw; k++) {
				em.load(SCRATCH[0], (base + k) * 8);
				em.store(SCRATCH[0], inc.off + k * 8, k === 0 ? "デフォルトで埋める" : undefined);
			}
			em.pop(dw);
			em.label(have);
			params.push(inc.shape.name);
			paramOffsets.push(inc.off);
			paramSlots.push(inc.regs);
			continue;
		}
		// デフォルトが無いなら完全性公理が働く。
		emitIsUnit(em, inc.off, inc.regs, `仮引数 ${what} が __ か`, inc.rule);
		em.emit(`b.eq ${unitLabel}`, "__ なら本体へ入らない（完全性公理）");
		if (inc.shape.kind === "bare") {
			// **この名前は本体の中で `__ ` になり得ない。** 分解する形は入れない——門番が
			// 見たのは器であって、取り出した要素ではないからである。
			total.add(inc.shape.name);
			params.push(inc.shape.name);
			paramOffsets.push(inc.off);
			paramSlots.push(inc.regs);
			continue;
		}
		// **名前で分ける形は、固定オフセットからのロードである。** 名前はコンパイル時に
		// オフセットへ解決されるので Pass 4 には残らない（function_guide.md）——辞書の
		// 意味論を構造体のコストで得ている、というのがこの一点である。`~obj` は器その
		// もの＝渡ってきた `ptr` を指すので、そのスロットを使い回す（コピーしない）。
		if (inc.shape.kind === "fields") {
			const lay = inc.layout;
			if (!lay) {
				em.diagnostics.push({ severity: "error", message: `${name}: 構造体の並びが決まりません（呼び出しサイトから形が引けません）`, node: lambdaNode });
				return;
			}
			for (const nm of inc.shape.names) {
				const slot = (lay.slots || []).find((s) => s.name === bareName(nm));
				if (!slot) {
					em.diagnostics.push({ severity: "error", message: `${name}: 構造体に ${bareName(nm)} というスロットがありません`, node: lambdaNode });
					return;
				}
				const off = em.slot * 8;
				em.push();
				em.load(SCRATCH[1], inc.off, `構造体の ptr`);
				// 引くのは**バイトのずれ**であって添字ではない（`loadElem` は添字を取る）。
				// 名前がオフセットへ解決されている以上、そこは即値で書ける。
				em.emit(slotLoadInsn(slot, SCRATCH[0], SCRATCH[1], slot.offset), `フィールド ${bareName(nm)}（+${slot.offset}）`);
				em.store(SCRATCH[0], off);
				params.push(nm);
				paramOffsets.push(off);
				paramSlots.push(1);
			}
			params.push(inc.shape.rest);
			paramOffsets.push(inc.off);
			paramSlots.push(1);
			continue;
		}
		// **入力の分解は、頭を読んで尾に同じ番地を渡すだけである**（type_system.md §3.5）。
		// 器ではないので長さも崩壊の検査も無い——機器は尽きない。頭が複数あれば書いた順に同じ
		// 番地から読む（機器が読むたびに次を出すので、それが順に並ぶ）。尾は番地のスロットを
		// そのまま使い回す（1本、コピーしない）。出力 `#` が番地を返すのと対になる形である。
		if (inc.reader) {
			for (const h of inc.shape.heads || [inc.shape.head]) {
				const o = em.slot * 8;
				em.push();
				em.load(SCRATCH[1], inc.off, "入力の番地");
				// **機器を読むのは副作用である。** `[x ~xs]` は1つ消費することなので、`x` を使わなくても
				// 読みは起きなければならない——消すと、次に `xs` を読んだとき本来 `x` だった値が来る。
				// `ldr` は純粋な命令として不要命令の除去に消されるので、`ldar`（load-acquire）で出す。
				// 順序が保証されて並べ替えられず、除去の対象にもならない。MMIO の読みとしても筋が通る。
				em.emit(`ldar ${SCRATCH[0]}, [${SCRATCH[1]}]`, "読む（機器が次を出す。消さない・並べ替えない）");
				em.store(SCRATCH[0], o);
				params.push(h);
				paramOffsets.push(o);
				paramSlots.push(1);
			}
			params.push(inc.shape.rest);
			paramOffsets.push(inc.off);
			paramSlots.push(1);
			continue;
		}
		// **`[h ~t]` は検査の後で作る。** 空の容器から先頭を読むと指す先の外を触る
		// ——先に崩壊させておけば読まずに済む。先頭は新しいスロット、残りは容器の
		// スロットをそのまま使い回す（コピーしない）。
		const heads = inc.shape.heads || [inc.shape.head];
		const headOffs = heads.map(() => {
			const o = em.slot * 8;
			em.push();
			return o;
		});
		emitDestructure(em, inc.off, headOffs, inc.elemSize, inc.signed, what);
		params.push(...heads, inc.shape.rest);
		paramOffsets.push(...headOffs, inc.off);
		// **分解した組を覚えておく。** 組み直す形（`c rest`）は恒等射なので、器を作る
		// のではなく参照を戻せばよい（この直後の `bracketPairs` がその印である）。
		bracketPairs.push({ head: inc.shape.head, rest: inc.shape.rest, restOff: inc.off, elemSize: inc.elemSize });
		paramSlots.push(...heads.map(() => 1), 2);
	}

	// **自分のフレームに置いたものは返せない。**
	//
	// `$匿名式` は `sub sp` で場所を取るが、エピローグの `mov sp, x29` がそれを捨てる
	// ——返したアドレスは死んだ場所を指す。仕様がそう書いている（memory_management.md
	// §2「`alloca` は自分のフレームなので、作った器を返せない」）ので、黙って壊れた
	// アドレスを返さずに名指しする。
	//
	// 返す規約（sret：呼び出し側がスロットを提供し、呼ばれた側が `#` で書く）はまだ
	// 決まっていない。決まればここが道になる。
	//
	// 見るのは**末尾位置の式**である。変数へ入れてから返す形までは追わない（脱出解析が
	// 要る）——追えないものを追えたことにする方が危ない。
	const escaped = frameAddressInTail(lambdaNode.right);
	if (escaped) {
		em.diagnostics.push({
			severity: "error",
			message: `${name}: 自分のフレームに置いたものは返せません（'$匿名式' は 'sub sp' で場所を取り、関数から戻ると消えます——返す規約は未定です）`,
			node: escaped,
		});
	}

	const before = em.diagnostics.length;
	// 本体そのものが末尾位置である。`selfLabel` / `loopLabel` を渡すことで、本体の中の
	// 自己呼び出しがフレームを使い回す `b` になる。
	// 本体のどこかで場所を取るなら、フレームを畳む末尾呼び出しは使えない（`allocaAllowed` と
	const scope = {
		params,
		paramOffsets,
		paramSlots,
		callees,
		// **門番が証明したことを、本体へ持って行く。**
		//
		// 入口で仮引数を1つずつ `__` か検査し、そうなら本体へ入らずに `__` を返している
		// （完全性公理）。だから本体の中でその名前は `__` になり得ない——`total` はその
		// 集合である。ところがここへ載せていなかったので `cannotBeUnit` が
		// `scope.total === undefined` を見て常に false を返し、**門番が既に見たものを
		// 演算ごとにもう一度** `cmp` / `csel` で見ていた。
		//
		//     f : a b c ? a + b + c   入口で3回検査したうえで、算術がさらに4回
		//
		// 同じ事実を2箇所で決めていた形である。証明した側が黙っていたので、使う側は
		// 何も知らないまま毎回払っていた。
		total,
		selfLabel: name,
		loopLabel,
		bracketPairs,
		// **道の上にあるものだけ数える。** 枝の値は `genMatch` が枝ごとに足す。
		holdsFrameStorage: takesFrameStorage(lambdaNode.right, true),
		// 自分がスタックで受け取った引数域の大きさ。相互末尾呼び出しはここへ書ける。
		incomingStackBytes: inPlan.stackBytes,
	};
	// **容量は呼ぶ側が渡す。** 番地（x8）と対で入口に届いており、`em.sretLimit` の
	// スロットに仕舞ってある（`genFunction` の入口）。書く位置がそれを越えるなら、その
	// 器は作れない——**作れなかったものは無い**ので `__` を返す（完全性公理がそれを外へ
	// 運ぶ）。
	//
	// 見積もりが外れても壊れない。数学では無限はありふれているので、**解が無いことに
	// 答えを持っている**必要がある。
	em.unitLabel = unitLabel;

	// **撒いただけのものは返せない。** 後置 `~` は「器を開いて中身を撒く」であり、受け手
	// （組み立て中の器）がある位置でだけ意味を持つ。返値の位置には受け手が無いので、
	// 撒いた並びがそのまま出て行く——名前付きスロットならそこで名前が落ちる。
	//
	// interpreter.js の makeClosure が同じ判定を持ち、コメントに「静的に分かる違反は弾く
	// （原理4）」と書いてあるのに評価時に置かれていた。だから機械語側は素通りして、
	// `f : [~this] ? this~` が診断ゼロで**生のスタック番地**を返していた。
	{
		const body = unwrap(lambdaNode.right);
		if (body && body.type === "operation" && body.name === "expand" && body.position === "postfix") {
			em.diagnostics.push({
				severity: "error",
				message: name + ": 撒いただけのものは返せません（? x~）。後置 ~ は器を組み立てる位置でだけ意味を持ち、返値の位置には受け手が無いため、名前付きスロットなら名前が落ちて値の並びになります。器をそのまま返すなら ~ を外してください",
				node: lambdaNode,
			});
			return;
		}
	}
	em.tailCallee = null;
	const ok = genExpr(lambdaNode.right, env, em, scope, true);
	if (ok !== false) {
		// 返値の幅ぶん x0/x1 へ載せる。末尾呼び出しで出て行った経路は値を持たない。
		//
		// **飛んだ経路も、返す本数は型が決める。** 飛んだ先が2本返す関数なら、この関数も
		// 2本返している——`b` で出て行くのだから当然である。ところがここは「値を置かな
		// かった」ことを「1本」と数えていたので、崩壊の出口（`emitUnitRegs`）が x1 を
		// 置かず、呼ぶ側は前の呼び出しの残骸を `len` として読んでいた。
		//
		// 症状が重い。`h (g `ab` ``)` は `g` が空文字列で崩壊して `__` になり、それを受けた
		// `h` も本体に一歩も入らないはずなのに、実機は 7 を返す——**完全性公理（原理5）が
		// 効かない**、という一番下の土台が崩れる形である。
		// 型が答えないなら、飛んだ先に訊く（`b f` の `f` は既に出してあるので表に在る）。
		const tailByType = ok === TAIL ? slotsOfNode(lambdaNode.right, em.conf, env) : null;
		const tailByCallee =
			ok === TAIL && em.tailCallee && em.returnWidths && em.returnWidths.has(em.tailCallee)
				? em.returnWidths.get(em.tailCallee)
				: null;
		const tailWidth = lambdaNode.right && lambdaNode.right.atomType ? tailByType : (tailByCallee !== null ? tailByCallee : tailByType);
		const width = ok === TAIL ? (tailWidth === null ? 1 : tailWidth) : ok;
		if (width > ARG_REGS.length) {
			em.diagnostics.push({ severity: "error", message: `${name}: ${width} 本で返す関数はまだ出せません`, node: lambdaNode });
		}
		// **出したときの本数を表へ書き戻す。** 静的な見積もり（型）が答えられない形——
		// 具体化した `@p` を末尾で飛ぶ関数——でも、出し終えれば本数は決まっている。呼ぶ側
		// （`_.main` は最後に出る）はここを読む。**書く側と読む側が同じ表を引く**のが
		// 要点で、片方だけが既定の1本に落ちると `{ptr, len}` の len が黙って落ちる。
		if (em.returnWidths) em.returnWidths.set(name, width);
		if (ok !== TAIL) {
			const base = em.slot - ok;
			// **返す本数は値の形が決める。** 2本で打ち切っていたので、カーソル
			// （`{arm, k, ptr, len}`）や3本の規則を返す関数が上2本だけ載せて帰っていた
			// ——呼ぶ側は4本読むので、残りは前の呼び出しの残骸を読むことになる。
			for (let k = 0; k < Math.min(ok, ARG_REGS.length); k++) {
				const what = ok === 1 ? "返値を x0 へ" : k === 0 ? "返値の1本目を x0 へ" : undefined;
				em.load(ARG_REGS[k], (base + k) * 8, what);
			}
			em.pop(ok);
			// **スロットをもらったなら、器はそこへ着地する。** 枝によっては `.rodata` や
			// 呼ぶ側の記憶を指したまま返っており、追記の勘定（`len = k + 呼び先の len`）が
			// 空振りしていた。問いは枝ごとではなく出口で1つである（`emitSretLanding`）。
			if (ok === 2 && sretEntry && sretEntry.needsSlot) emitSretLanding(em, sretEntry.width);
			// **ループにしたなら、返すのは底と合計である。** 周の中で返ってきたのは
			// 「カーソルから何個書いたか」でしかない——器の全体は底から始まり、長さは
			// 周を跨いだ合計である。着地はカーソルに対して先に済ませてから底へ戻す。
			if (ok === 2 && em.sretLooped) {
				emitSretBase(em, "x0", sretEntry.width);
				em.load(SCRATCH[0], em.sretTotal, "周を跨いだ合計");
				em.emit(`add x1, x1, ${SCRATCH[0]}`, "最後の周のぶんを足す");
			}
		}
		// 崩壊したときの出口。返値と同じ幅で `__` を置く——枝によって幅が変わると
		// 呼び出し側が読む本数が決まらない。
		if (unitLabel) {
			// 本体が全て飛んで行ったなら、ここへ落ちてくるのは崩壊の経路だけである。
			const done = ok === TAIL ? null : em.newLabel("done");
			if (done) em.emit(`b ${done}`);
			em.label(unitLabel);
			// **ループにしたなら、崩壊しても積んだぶんは残る。**
			//
			// 再帰なら `f __ = __` は**呼び先**が `__` になるだけで、呼ぶ側は自分が置いた
			// k を持ったまま `(s ' 0) __ = [s ' 0]` と畳む（構築は `__` を落とす）。ところが
			// 飛び戻る形では持ち主が居ない——ここで素の `__` を返すと、**それまでに書いた
			// 全部が消える**。実測で `||f \`abcde\`||` が 5 ではなく `__` になった。
			//
			// だから返すのは底と合計である。1周目で崩壊したなら合計は 0 で、`{底, 0}` は
			// そのまま `__`（器の `__` は長さ 0）——同じ答えに落ちる。
			if (em.sretLooped && Math.min(width, 2) === 2) {
				emitSretBase(em, "x0", sretEntry && sretEntry.width);
				em.load("x1", em.sretTotal, "周を跨いだ合計（0 ならそのまま __）");
			} else {
				emitUnitRegs(em, Math.min(width, 2));
			}
			if (done) em.label(done);
		}
	} else if (em.diagnostics.length === before) {
		em.diagnostics.push({ severity: "error", message: `${name}: 本体を出せませんでした`, node: lambdaNode });
	}

	const body = em.lines;
	em.lines = outer;
	const wrapped = wrapFrame(body, em.maxSlot, name, em.movedSp, em.conf.regAlloc !== false, em.conf.peepholes !== false);
	checkStackFree(em, wrapped, name, lambdaNode);
	em.lines.push(...wrapped);
	em.blank();
}

/**
 * **layer 0 に記憶は無い。フレームは確保である。**
 *
 * `stp x29, x30, [sp, #-N]!` はプリインデックスで `sp` を下げて書く——`sub sp` という
 * *形*をしていないだけで、やっていることは確保である。layer 0 は RAM が生きている保証の
 * 無い世界なので、これを出してはならない（[`layer_relations.md`](../../documents/ja-jp/impl/layer_relations.md) §4.1）。
 * `-M virt` は最初から RAM が生きているので qemu では動いてしまうが、本物の BIOS/UEFI
 * 初期フェーズならその1命令目で死ぬ。**動いているように見えて実機で死ぬ**のが一番たちの
 * 悪い形なので、門番はここに要る。
 *
 * **判定は形ではなく要求で行う。** 「`?` を書いたか」ではなく「フレームが要ったか」を
 * 見る——覗き穴と割り付けが往復を消し切れば `?` を書いた関数でもフレームは消え、
 * そのときは本当に記憶を触らないので通してよい。層は要求で決まる（同 §5）。だから
 * **見るのは `wrapFrame` を通した後の行**である。前で見ると、消える予定のフレームまで
 * 止めることになる。
 *
 * 呼び出しを含む関数は必ずフレームを持つ（`wrapFrame` の `bare` 判定が `bl`/`blr` を
 * 外している）。`bl` は戻り番地 `x30` を上書きするので、呼ぶ側は自分の戻り先を記憶へ
 * 退避しなければならないためである。したがって **layer 0 では関数が呼べなくなる**——
 * それは正しい姿で、boot は直列のハード操作だけで書ける（同 §4.1）。
 */
function checkStackFree(em, lines, name, node) {
	if (em.conf.layer === undefined || em.conf.layer >= 1) return;
	const code = lines.map((l) => l.split("//")[0]);
	const frame = code.some((t) => /^\s*stp\s+x29,\s*x30,\s*\[sp,/.test(t) || /^\s*sub\s+sp\b/.test(t));
	if (!frame) return;
	const calls = code.some((t) => /^\s*(bl|blr)\b/.test(t.trim()));
	em.diagnostics.push({
		severity: "error",
		message: calls
			? `layer: ${em.conf.layer} では関数を呼べません（${name} が呼び出しを含む——` +
				`\`bl\` は戻り番地 x30 を上書きするので、呼ぶ側は自分の戻り先を記憶へ退避する必要がある）。` +
				`必要なのは layer: 1 以上です（layer_relations.md §4.1）`
			: `layer: ${em.conf.layer} では ${name} がフレームを要求します（式の途中の値を置く場所が要る）。` +
				`必要なのは layer: 1 以上です（layer_relations.md §4.1）`,
		node,
	});
}

/**
 * プログラム全体を AArch64 アセンブリへ落とす。
 *
 * @returns {{ text: string, diagnostics: Array }}
 */
function generateAsm(nodes, env, options = {}) {
	// `layer` は記憶を確保できるかどうかを決める（memory_management.md §2 の表）。
	// 渡されなければ検査しない——`option.ms` を読まない経路まで縛らない、他の門番と同じ方針。
	const conf = {
		target: options.target || "aarch64_qemu",
		charset: options.charset || DEFAULT_CHARSET,
		layer: options.layer,
		// **割り当てを切る口**（既定は入り）。パスごとに何を決めたのかを分けて読むため。
		regAlloc: options.regAlloc,
		// **覗き穴を切る口**（既定は入り）。`regAlloc` と対で、これを切ると素の命令列が出る
		// ——自己ホストの門（JS の後段と Sign の後段の命令列を比べる）は、両方を切った側で見る。
		peepholes: options.peepholes,
	};
	const em = new Emitter(conf);
	if (!widthsOf(conf.target)) {
		return {
			text: `// target '${conf.target}' の幅はまだ決まっていない（AArch64 のみ対応）\n`,
			diagnostics: [{ severity: "error", message: `未対応のターゲット: ${conf.target}` }],
		};
	}

	// **多すぎる引数を名指しする**（印は compile の specializeRefCalls が付ける）。
	//
	// `名前 : 値` の左辺が名前かどうか（1行の `条件 : 値`・一行に並べた構造体）はここでは
	// 見ない。構文が壊れている話なので、compile の `checkDefineLeftSides` が解釈器と機械の
	// 両方の手前で止める——機械だけが断っていた頃は、解釈器が同じ綴りを黙って束縛に読んでいた。
	{
		const seen = new Set();
		const walk = (n) => {
			if (!n || typeof n !== "object" || seen.has(n)) return;
			seen.add(n);
			if (n.refOverApply) {
				const o = n.refOverApply;
				const nm = (v) => String(v).replace(/^<|>$/g, "");
				// 吊り上げた無名のラムダには内部の名前（`関数$仮引数$番号`）が付いているので、書いた人の言葉で言う
				const tail = nm(o.callee).split("$").pop();
				const who = tail !== "" && [...tail].every((c) => c >= "0" && c <= "9") ? "無名のラムダ" : nm(o.callee);
				em.diagnostics.push({
					severity: "error",
					message:
						`@${nm(o.param)} に渡した ${who} はアリティ ${o.want} だが、本体で ${o.got} 個当てています` +
						"——`@a b c` は適用以外にありえないので、余った引数は飽和した結果（値）へ当てることになります",
					node: n,
				});
			}
			for (const k of ["left", "right", "operand", "middle"]) walk(n[k]);
			for (const l of n.lines || []) walk(l);
			for (const e of n.entries || []) walk(e.default);
		};
		for (const node of nodes) walk(node);
	}

	// 具体化はコード生成の前に済ませる（どの実体を出すかが決まらないと本体を出せない）。
	em.env = env; // 束縛から実体の種類を辿るために持つ（`slotsOfNode`）
	const monos = collectMonomorphs(nodes);
	// **作った器がフレームより長生きするか**を先に決める。器を作ってよいのは出ないときだけ
	// で、出るなら sret（呼び出し側がスロットを提供する）が要る。
	// **番地を取られた束縛を、命令へ畳む前に洗い出す。** 場所が在るかどうかは書かれた
	// ものが決めるのであって、行の順序が決めるのではない。
	markAddressTaken(nodes, env);
	// **効果を持つ束縛は1回だけ走らせる。** 同じく畳む前に印を付ける（上の注記）。
	markRunOnceBindings(nodes, env);
	// **公開できない綴りを名指しする。** 印を引く前に言う（引く側は黙って下ろす）。
	checkExportedNames(nodes, env, em);
	// **鍵が増えるマージは、鍵の和集合ぶんの場所を取る。** 確保なので layer 1 以上である
	// （layer_relations.md §3.3.1、option_ms_schema.md §4）。和集合は compile.js が
	// Pass 3 の前に確定させているので、ここで見るのは「実際に鍵が増えたか」だけ。

	// **どの位置の仮引数がそのまま返るか**は呼び出しサイトでも要る——渡す器の場所を
	// 決めるのは、呼び先がそれを返すかどうかだからである。
	em.returnedParams = collectReturnedParams(nodes);
	markEscapes(nodes, em.returnedParams);
	// 呼び出しサイトが省略された引数の位置を知るための署名表。本体を出す前に要る。
	em.signatures = collectSignatures(nodes, em, monos);
	// 返す本数も同じ列挙から。呼び出しサイトに型が付かない形（具体化した `@p`）で要る。
	em.returnWidths = collectReturnWidths(nodes, em, monos);
	// 返す器の置き場所（sret）。呼ぶ側と呼ばれる側の両方が同じ表を引く必要がある
	// ——2箇所で別々に大きさを数えると、片方だけが正しい命令列を出す。
	em.sretPlan = collectSretPlan(nodes, em, options.sretPlanStats);

	em.lines.push("// Sign — AArch64 (AAPCS64)");
	if (options.source) em.lines.push(`// source: ${options.source}`);
	em.lines.push("\t.text");
	em.blank();

	// 関数定義を先に出す。トップレベルの式は `_.main` に入る
	// （entry_point.md の生成スタブが `bl _.main` で呼ぶ）。
	const exprs = [];
	for (const node of nodes) {
		// 糖衣が置き換えた元の定義は出さない。同じ列を2通りに出すだけである
		// （compile.js の `markCursorEntries`）。AST には残っている——インタプリタは
		// 元の形をそのまま走らせるので、そちらが仕様の答えを持っている。
		if (node && node.supersededByDesugar) continue;
		// **関数への別名は命令を持たない。** `g : f` は名前の言い換えでしかなく、実体は
		// `f` の側に1つある。呼ぶ側が名前を辿るので（`aliasTargetOf`）、ここで値として
		// 出そうとするとラムダを式の位置で組むことになり「まだ出せない識別子です」で
		// 止まっていた——**呼び出しではなく定義の側が落ちていた**。
		if (isDefineNode(node) && isIdentifierNode(node.left) && aliasTargetOf(node.left.value, env) !== node.left.value) {
			const target = envLookup(env, aliasTargetOf(node.left.value, env));
			if (target && target.category === "Lambda") continue;
		}
		// **定数だけの構造体も命令を持たない。**
		//
		// MMIO のレジスタ束（`uart : / CR : 0x9000000 / DR : 0x9000004`）は「配置の記述」
		// であって「値の確保」ではない。フィールドを引いた結果はその番地そのものなので
		// （`constStructField` が畳む）、構造体自身はどこにも置かれなくてよい。
		//
		// ここを飛ばさないと定義の側が値を組もうとして「まだ出せない識別子です（CR）」で
		// 止まる——**畳みは成功しているのに、定義が落ちていた**。別名の定義と同じ形の穴で
		// ある。確保が起きないので `layer: 0` でもそのまま使える。
		if (isDefineNode(node) && isIdentifierNode(node.left) && constStructDefine(node)) continue;
		// **静的な像を置ける構造体も命令を持たない。** 像そのものが定義だからである。
		//
		// 上の `constStructDefine` は「全行が `名前 : 定数`」しか見ないので、文字列の
		// スロットを1つ持つだけで（`/ a : 1 / s : \`abc\` / b : 2`）素通りし、定義の側が
		// フレームへ組んでいた——読む側は `.rodata` の像を見るので、その 32 byte は
		// **誰も読まない**。組んだ回数だけ `sub sp` が出て、名前が別の実体を持つ形に
		// 戻ってしまう。飛ばすかどうかは「場所を持てるか」で決める。
		if (isDefineNode(node) && isIdentifierNode(node.left) && isStructBlock(unwrap(node.right))) {
			const sb = env ? envLookup(env, node.left.value) : null;
			if (sb && structBindingLabel(node.left.value, sb, env, em)) continue;
		}
		if (isDefineNode(node) && isIdentifierNode(node.left)) {
			const rhs = node.right;
			if (rhs && rhs.type === "operation" && rhs.name === "lambda") {
				const fname = bareName(node.left.value);
				const entry = monos.get(fname);
				if (entry) {
					// **呼ばれている組み合わせのぶんだけ実体を出す。** 呼び出しサイトが1つも
					// 無ければ実体を持ちようがない——`dyn` を持たない以上、そこは §5 Pass 1b が
					// 「呼び出しサイトの無い export はコンパイルエラー」と言うのと同じ線である。
					if (entry.instances.size === 0) {
						em.diagnostics.push({
							severity: "error",
							message: `${fname}: アドレス経由で呼ぶ仮引数を持つが、具体化できる呼び出しサイトが無い`,
							node: rhs,
						});
					}
					// デフォルトに直接書かれたラムダは、ここで名前付きの実体として出す
					// ——関数内関数の定義なので、出す先はトップレベルでよい。
					for (const [label, lam] of monos.hoisted || []) {
						if (em.hoistedDone && em.hoistedDone.has(label)) continue;
						if (!em.hoistedDone) em.hoistedDone = new Set();
						// 呼び出しサイトの `$(無名)` は `関数$仮引数$番号` で吊り上げている（1つの仮引数に
						// 何通りも来るため番号で分ける）。デフォルトは1つなので `関数$仮引数` のまま。
						if (!entry.ptrParams.some((pn) => { const pat = `${fname}$${bareName(pn)}`; return label === pat || label.startsWith(pat + "$"); })) continue;
						em.hoistedDone.add(label);
						// **ポイントフリーはまだ実体にできない。** `[+ 2]` は「左辺の欠けた
						// 演算」であって仮引数を持たないので、`_a ? _a + 2` へ合成しないと
						// 関数として出せない。これはデフォルトの話ではなく Pass 4 全体の穴
						// である——トップレベルの `g : [+ 2]` も、その場書きの `[+ 2] 5` も
						// 同じく出せない。黙って壊れた実体を出さずに名指しする。
						if (!(lam.type === "operation" && lam.name === "lambda")) {
							em.diagnostics.push({
								severity: "error",
								message:
									`${label}: ポイントフリーを実体にする経路がまだありません` +
									`（\`[+ 2]\` は左辺の欠けた演算であり、仮引数を持つ形へ合成する必要があります）`,
								node: lam,
							});
							continue;
						}
						// 生成された内部名（デフォルトに直接書かれたラムダ）。書いた人が付けた
						// 名前ではないので外から呼ばれることは無い——local のままにする。
						genFunction(label, lam, env, em);
						em.blank();
					}
					for (const inst of entry.instances.values()) {
						// 具体化した実体は元の名前の見え方を継ぐ（別名ではなく、同じ export の別の形）。
						em.lines.push(...symbolDirectives(fname, env, inst.label));
						genFunction(inst.label, rhs, env, em, inst);
						em.lines.push(...symbolDirectivesAfter(fname, env));
					}
					continue;
				}
				em.lines.push(...symbolDirectives(fname, env));
				genFunction(fname, rhs, env, em);
				em.lines.push(...symbolDirectivesAfter(fname, env));
				continue;
			}
		}
		exprs.push(node);
	}

	const outer = em.lines;
	em.lines = [];
	em.slot = 0;
	em.maxSlot = 0;
	em.movedSp = false; // 本体が `sp` を動かしたか（エピローグの戻し方が変わる）
	// **`_.main` は sret の受け手ではない。** 直前に出した関数が残した印を
	// そのまま持ち込むと、トップレベルで作った器が**死んだ他人のスロット**へ書かれる
	// ——トップレベルは返さないので `escapesFrame` が付いておらず、素通りしてしまう。
	// **印は一式で捨てる。** 底・合計・上限はスロットの番号であって、他人のフレームの
	// 番号を持ち込めば読む場所を間違える。1つ消して3つ残す方が危ない。
	em.sretDest = null;
	em.sretTotal = null;
	em.sretLimit = null;
	em.sretLooped = false;
	let last = null; // 最後に値を出した式の置き場所（`_.main` の返値になる）
	for (const node of exprs) {
		// **裸の文字列リテラルはコメントである**（string_and_comment.md）。Sign の
		// コメントはバッククォート文字列そのものなので AST に残るが、値として使われて
		// いない以上、命令は出ない。ここを診断にすると、コメントの数だけ「出せない」が
		// 並んで本当の穴が埋もれる。
		//
		// 判定は Pass 3 の charset の門番と**同じ関数**である。食い違うと「検査は通った
		// のに `.rodata` へ出る」（またはその逆）が起きる。
		if (isBareComment(node)) continue;
		const target = isDefineNode(node) ? node.right : node;
		const w = genExpr(target, env, em, null);
		if (w === false) continue;
		// **効果を持つ束縛は、この行で出した値を場所へ書く。** 使う側は畳まずにここを読むので
		// （`genLoadBinding`）、観測はプログラム全体で1回になる——`markRunOnceBindings` の注記。
		// これまでは出した値をそのまま捨てていたので、使う側が値ノードを出し直すしかなかった。
		if (isDefineNode(node) && w === 1 && isIdentifierNode(unwrap(node.left))) {
			const nm = unwrap(node.left).value;
			const rb = envLookup(env, nm);
			if (rb && rb.runsOnce) {
				const lab = em.internBinding(bareName(nm), "0", 8, true);
				em.load(SCRATCH[0], (em.slot - w) * 8, "この行で観測した値");
				em.emit(`adrp ${SCRATCH[1]}, ${lab}`, `${bareName(nm)} の場所（効果は1回）`);
				em.emit(`add ${SCRATCH[1]}, ${SCRATCH[1]}, :lo12:${lab}`);
				em.emit(`str ${SCRATCH[0]}, [${SCRATCH[1]}]`, "置く。以降の読みはここを辿る");
			}
		}
		// **最後の式の値が `_.main` の返値である。** ここまでは値をスロットへ置いた
		// まま `ret` していた——x0 に残っていたのは直前の `bl` の戻り値であって、式の値
		// ではない。`f 1 2` の形で終わるプログラムだけが偶然正しく、`1 + 2` や `42` は
		// 番地を返していた。qemu のテストが全て呼び出しで終わる書き方だったため、
		// **ハーネス自身の書き方がこの穴を隠していた**。
		last = w === TAIL ? null : { off: (em.slot - w) * 8, w };
		if (w !== TAIL) em.pop(w);
	}
	if (last) {
		for (let k = 0; k < last.w; k++) {
			em.load(ARG_REGS[k], last.off + k * 8, k === 0 ? (last.w > 1 ? "最後の式の値を返す（ptr）" : "最後の式の値を返す") : "（len）");
		}
	}
	const body = em.lines;
	em.lines = outer;
	em.lines.push("\t.global _.main");
	const wrappedMain = wrapFrame(body, em.maxSlot, "_.main", em.movedSp, em.conf.regAlloc !== false, em.conf.peepholes !== false);
	checkStackFree(em, wrappedMain, "_.main", null);
	em.lines.push(...wrappedMain);
	// 文字列の中身は最後に置く。`.text` と混ぜないのは、書き換えない領域だからである。
	em.lines.push(...em.rodataLines());

	return { text: em.lines.join("\n") + "\n", diagnostics: em.diagnostics };
}

// `RESERVED_*` を出すのは門のためである——同じ事実が `qemu/link.ld` と `qemu/start.s` にも
// 在るので、`test/export_symbol.test.js` が両方を読んでここが覆えているかを見る。
export { returnSizeBound, generateAsm, ARG_REGS, SCRATCH, MAX_SLOTS, RESERVED_SYMBOLS, RESERVED_ORIGIN };
