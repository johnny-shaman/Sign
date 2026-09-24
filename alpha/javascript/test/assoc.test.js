// **結合の向きは、表が言うことと実装が一致していなければならない。**
//
// `operator_table.md` の凡例は「右結合は位置表記内に※あり」と決めている（`中置※`）。
// ところが実装（pass2 の `reduceOnce`）は**演算子ごとにベタ書き**で、`@` と `,` だけ
// 手で書いてあった。表が同じく右結合と言っている `^`（冪）と `#`（出力）は左結合のまま
// で、`2 ^ 3 ^ 2` が 512 ではなく **64**（`(2^3)^2`）になっていた——もっともらしい数が
// 返るので長く見つからなかった。
//
// **同じ事実が2箇所にある形**なので、表（`operator_table.js` の `assoc`）へ寄せて実装は
// 引くだけにした。この試験は、その2箇所が**また割れたら落ちる**ためにある。
import { compile } from "../compile.js";
import { evaluate, newRuntimeEnv, observe } from "../interpreter.js";
import { OPERATOR_BY_PRECEDENCE } from "../operator_table.js";
import fs from "fs";
import path from "path";

let passed = 0, total = 0;
const check = (note, got, want) => {
	total++;
	if (got === want) { passed++; console.log(`ok   ${note.padEnd(40)} ${got}`); }
	else console.log(`FAIL ${note.padEnd(40)} got: ${got} / want: ${want}`);
};

// md が「中置※」＝右結合と言っている演算子を、md そのものから読む。
const MD = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "../../../documents/ja-jp/impl/syntax/operator_table.md");
const md = fs.readFileSync(MD, "utf8");
const rightInMd = new Set();
for (const line of md.split(/\r?\n/)) {
	const m = line.match(/^\|\s*[\d.]+[^|]*\|\s*`([^`]+)`\s*\|\s*中置※/);
	if (m) rightInMd.add(m[1]);
}

// 表（js）が assoc: 'right' と言っているもの。
const rightInJs = new Set();
for (const tier of OPERATOR_BY_PRECEDENCE) {
	for (const [op, e] of Object.entries(tier || {})) {
		if (e.position === "infix" && e.assoc === "right") rightInJs.add(op);
	}
}

// **`:` と `?` は二項の畳みを通らない**（束縛とラムダは構文そのもの）ので、この対応の外。
const STRUCTURAL = new Set([":", "?"]);
for (const op of rightInMd) {
	if (STRUCTURAL.has(op)) continue;
	check(`md が右結合と言う ${op} は表にも書いてある`, rightInJs.has(op), true);
}
for (const op of rightInJs) {
	check(`表が右結合と言う ${op} は md にも書いてある`, rightInMd.has(op), true);
}

// 実測。`a OP b OP c` がどちらに切れるか。
const shape = (n) => {
	if (!n || typeof n !== "object") return String(n);
	if (n.type === "atom") return String(n.value).replace(/[<>]/g, "");
	if (n.type === "operation") {
		if (n.position === "postfix") return shape(n.operand) + (n.op || "");
		if (n.position === "prefix") return (n.op || "") + shape(n.operand);
		return "(" + shape(n.left) + (n.op || n.name) + shape(n.right) + ")";
	}
	return n.type;
};
const cut = (op) => {
	try {
		const src = ["a : 2", "b : 3", "c : 2", `s : a ${op} b ${op} c`].join(String.fromCharCode(10));
		const { nodes } = compile(src);
		const s = shape(nodes[nodes.length - 1].right);
		return /^\(a[^(]*\(b/.test(s) ? "右" : "左";
	} catch { return "例外"; }
};
// 冪は数で見るのが一番確か。右結合なら 2^(3^2) = 512。
check("冪は右から: 2 ^ 3 ^ 2 の切れ方", cut("^"), "右");
check("積は右から: 1 , 2 , 3 の切れ方", cut(","), "右");
check("出力は右から: a # b # c の切れ方", cut("#"), "右");
check("足し算は左から", cut("+"), "左");
check("引き算は左から", cut("-"), "左");
check("合成は左から", cut(";"), "左");
check("余積（空白）は左から", cut(" "), "左");

// **1つの連なりの結合の向きは1つである。**
//
// 同じ段に向きの違う演算子が居ると、括らずに並べた形に読みが2つある——`s @ r ' t` は
// `(s @ r) ' t` とも `s @ (r ' t)` とも読める。以前の `reduceOnce` は左から畳み、右結合は
// 「右に同じ綴りが居る」ときだけ待っていたので、`a @ b ' c @ d` が `a @ ((b ' c) @ d)` と
// いう表からは読めない形になっていた。いまは名指しで断る（原理4、連鎖比較の混在と同じ）。
//
// **段は表から引く。** 向きの割れた段を手で書くと、段が増えたときにこちらが古くなる。
const mixedTiers = [];
for (const [tier, row] of OPERATOR_BY_PRECEDENCE.entries()) {
	const ops = Object.entries(row || {}).filter(([, e]) => e.position === "infix");
	const right = ops.filter(([, e]) => e.assoc === "right").map(([op]) => op);
	const left = ops.filter(([, e]) => e.assoc !== "right").map(([op]) => op);
	if (right.length && left.length) mixedTiers.push({ tier, left, right });
}
// 今それに当たるのは get の2つだけ。増えたら下の検査がそのまま新しい組も見る。
check("向きが割れている段は get だけ", JSON.stringify(mixedTiers.map((t) => [...t.left, ...t.right].sort())), JSON.stringify([["'", "@"]]));
// **断りは2つある。** 行の門（`compile.js` の `refuseMixedGetInLine`）が「同じ行に中置の
// `'` と `@`」を断り、連なりの門（`pass2.js` の `refuseMixedAssociativity`）が「括らずに1つの
// 連なりへ混ぜた」を断る。書いた字句に対しては**行の門が先に当たる**ので、こちらへ届くのは
// 字句の段で合成された形だけである（`pasteVisiblePipelines`）。どちらが出たかで数える。
const refused = (src) => {
	try {
		compile(src);
		return "通った";
	} catch (e) {
		if (/同じ行に中置の「'」と「@」は混ぜられません/.test(e.message)) return "行";
		if (/結合の向きが違う演算子は括らずに並べられません/.test(e.message)) return "連なり";
		return "別の理由：" + e.message;
	}
};
const G = "m : [10 20] , [30 40]\nk : 0\n";
for (const { left, right } of mixedTiers) {
	for (const l of left) for (const r of right) {
		check(`同じ行に混ぜると断る k ${r} m ${l} 1`, refused(G + `k ${r} m ${l} 1`), "行");
		check(`同じ行に混ぜると断る m ${l} 0 ${r} m`, refused(G + `m ${l} 0 ${r} m`), "行");
		check(`括りの中でも同じ (k ${r} m ${l} 1)`, refused(G + `(k ${r} m ${l} 1)`), "行");
		check(`関数の本体でも同じ`, refused(G + `f : i ? i ${r} m ${l} 1\nf 0`), "行");
		check(`3つ以上でも断る k ${r} 1 ${r} m ${l} 0`, refused(G + `k ${r} 1 ${r} m ${l} 0`), "行");
	}
}
// **字句の段の書き換えも抜け道にならない。** 関数を並べた器の `p ' 1` は pass2 より前に
// スロットへ貼られる（compile.js の `pasteVisiblePipelines`）。隣を見ずに貼っていたので、
// データだけの器なら断る `1 @ d ' 0` が、関数を持つ器では `1 @ p ' 1` のまま 8 を返していた。
check("関数を並べた器でも断る 1 @ p ' 1", refused("p : [+ 2] , [7 8 9] , 3\n1 @ p ' 1"), "行");
check("データだけの器でも断る 1 @ d ' 0", refused("d : [7 8 9] , [1 2] , 3\n1 @ d ' 0"), "行");
// **撒いた字句が混在を作らない。** 積の中で撒くとき、スロットを裸で並べると書いてもいない
// `' 0 @` が字句の段で生まれていた。スロットは括って置く（断るなら混在以外の理由で）。
// ここは**行の門より後**で起きるので、連なりの門が最後の網になる。
check("撒いたスロットが混在を作らない", refused("m : [10 20] , [30 40]\np : 0 @ m , [+ 1]\nm ' p~ , 3") === "通った", true);

// **括っても、並置で切れていても、同じ行なら断る**（利用者の裁定 2026-09-23）。
//
// 括れば式の読みは1つに決まる。それでも断るのは、**行を左から読む側が向きの裏返りを
// 見落とす**からである——`(0 @ m) ' 1` は「0 の m」と「その 1 番目」で主語が途中で入れ替わる。
// 読みが1つかどうかではなく、**1行の中で綴りを混ぜないこと**を規則にした。
const F = "l : [1 2 3]\nf : x y ? x + y\ng : x ? x\n";
check("並置で切れていても断る f 0 @ l l ' 2", refused(F + "f 0 @ l l ' 2"), "行");
check("並置の中の1つの連なりも断る g 0 @ l ' 1", refused(F + "g 0 @ l ' 1"), "行");
check("括っても断る (0 @ m) ' 1", refused(G + "(0 @ m) ' 1"), "行");
check("括っても断る 0 @ (m ' 1)", refused(G + "0 @ (m ' 1)"), "行");
check("弱い段で切れていても断る m ' 0 ' 1 + 1 @ 0 @ m", refused(G + "m ' 0 ' 1 + 1 @ 0 @ m"), "行");
check("等式の左右でも断る (2 @ l) = (l ' 2)", refused(F + "(2 @ l) = (l ' 2)"), "行");

// **通るのは、綴りを揃えた形と、行を分けた形である。**
check("綴りを揃えれば通る m ' 0 ' 1", refused(G + "m ' 0 ' 1"), "通った");
check("綴りを揃えれば通る 1 @ 0 @ m", refused(G + "1 @ 0 @ m"), "通った");
check("行を分ければ通る", refused(F + "a : 2 @ l\nb : l ' 2\na = b"), "通った");
// 2行以上の括りと字下げブロックは、書いた人が行を分けている。
check("括りの中の別々の行は通る", refused(G + "y : [\n\t0 @ m\n\tm ' 1\n]"), "通った");
check("字下げブロックの別々の行は通る", refused(F + "h : x ?\n\tx > 1 : 0 @ l\n\tl ' 0"), "通った");

// **数えるのは中置だけである。** 前置 `@`（参照外し・鍵の中身）と後置 `@`（import）は別の
// 演算子で、段も違うので連なりが切れる——混ぜても読みは1つに決まる。巻き込むと
// `l ' @i` も `IO@ ' say` も書けなくなる（仕様は「数えるのは中置だけ」と書いてある）。
check("前置 `@` は当たらない l ' @i", refused("l : [1 2 3]\ni : 1\nl ' @i"), "通った");
check("後置 `@` は当たらない IO@ ' say", refused("IO@ ' say"), "通った");
check("前置と中置が同じ行でも、中置が1つなら通る", refused(F + "f (@g 1) (2 @ l)"), "通った");


// ---- 適用と積（`,`）を括らずに同じ行へ混ぜない（利用者の裁定 2026-09-24） ----
//
// 空白（余積）には2つの読みがある——**器を作る**（余積 ⇒ 積への一意な射）と、**値を食う**
// （評価射）である。前者は積より内側、後者は積より外側に居るのが筋だが、表では同じ1段に
// 同居している。だから `f 1, 2, 3` は `(f 1) , 2 , 3` と読まれ、書き手が意図した
// `f (1, 2, 3)` とは**別の関数呼び出し**になる——裸の rest なら x に 1 だけが入る。
//
// `'` と `@` の混在と同じ構えである：**読みが2つ立つ所は括りで決めさせる**。括って書いて
// あれば段を差し替えても読みが変わらないので、この門は「後で差し替えられる」ことの保証でもある。
const mixed = (src) => {
	try {
		compile(src);
		return "通った";
	} catch (e) {
		if (/適用と積（','）を括らずに同じ行へ混ぜられません/.test(e.message)) return "断る";
		return "別の理由：" + e.message.slice(0, 40);
	}
};
check("裸の rest にカンマ列は断る", mixed("f : x ~xs ? xs\nf 1, 2, 3"), "断る");
check("括りの rest でも断る", mixed("f : [x ~xs] ? xs\nf 1, 2, 3"), "断る");
check("右辺が適用でも断る", mixed("f : x y ? x\n1 , f 2 3"), "断る");
check("括れば通る（積を1項で渡す）", mixed("f : [x ~xs] ? xs\nf (1, 2, 3)"), "通った");
check("括れば通る（適用の結果を積む）", mixed("f : x y ? x + y\n(f 1 2) , 3"), "通った");
check("余積だけなら通る", mixed("f : x ~xs ? xs\nf 1 2 3"), "通った");
check("積だけなら通る", mixed("1 , 2 , 3"), "通った");
check("適用だけなら通る", mixed("f : x y ? x + y\nf 1 2"), "通った");
// 実コードはもともと括って書いてある（`lexer.sn` の追記の形）。
check("実コードの形は通る", mixed("take : n s ? s\ntok : s ? s\n(take 0 `ab`) , (tok `cd`)"), "通った");
// 器の字面の中は積だけなので当たらない。
check("器の中のカンマは通る", mixed("f : x ~xs ? xs\nf [1 , 2 , 3]~"), "通った");
// **部分適用も適用である。** 飽和していなくても「値を食う」読みなので、積と混ぜれば同じ割れ方をする。
check("部分適用と積も断る", mixed("f : x y z ? x\nf 1 , 2"), "断る");
// **断るのは積の隣だけである。** 飽和した適用の右に値が並ぶのは構築（器を作る読み）なので通る
// ——ここまで巻き込むと、余積の普通の書き方が全部断られる。
check("適用の右に値が並ぶのは通る", mixed("f : x y ? x + y\nf 1 2 3"), "通った");


// ---- 畳む向きは表が言う（同じ事実が3か所で決まっていた） ----
//
// 区間を**その場で畳む**道（`pass2.js` の `foldHeadSections`）は表の `assoc` を見ていたが、
// **字面を展開する**道（`expandGreedyFold`）と**実行時に器を走る**道（`foldSource` が書き下す
// 再帰関数）は左畳みの決め打ちだった。`+` `*` では差が出ず、`-` は左結合なので合う
// ——**右結合の演算子を器で渡したときだけ**黙って違う答えになっていた。
//
// 期待値は書かない。同じ値の3つの綴り（区間に並べる・器を撒く・中置で書く）が**同じ答え**に
// なることを見る——どれかが片方の綴りだけ直っても落ちる軸になる。
const v = (src) => {
	try {
		const { nodes, env } = compile(src);
		const renv = newRuntimeEnv(null, "ascii");
		let r;
		for (const node of nodes) r = evaluate(node, renv);
		return JSON.stringify(observe(r));
	} catch (e) {
		return "例外:" + e.message.slice(0, 40);
	}
};
check("`^` は3つの綴りで同じ（右結合）", v("[^] 2 3 2") + "/" + v("[^] [2 3 2]~"), v("2 ^ 3 ^ 2") + "/" + v("2 ^ 3 ^ 2"));
check("`,` は3つの綴りで同じ（右結合）", v("[,] 1 2 3") + "/" + v("[,] [1 2 3]~"), v("1 , 2 , 3") + "/" + v("1 , 2 , 3"));
check("`-` は3つの綴りで同じ（左結合）", v("[-] 10 3 2") + "/" + v("[-] [10 3 2]~"), v("10 - 3 - 2") + "/" + v("10 - 3 - 2"));
// 名前を経由しても同じ（器が実行時に届く道）。
check("名前の器でも同じ", v("l : 2 3 2\n[^] l~"), v("2 ^ 3 ^ 2"));
// 利用者が挙げた区間の綴り3つ（`[+] : x ~y ?` という裸の rest の実装）。
check("区間は余積で食う", v("[+] 1 2 3"), "6");
check("撒いた器でも同じ", v("[+] [1 2 3]~"), "6");
check("積で組んだ器を撒いても同じ", v("[+] [1,2,3]~"), "6");

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);