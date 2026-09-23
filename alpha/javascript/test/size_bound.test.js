/**
 * **返す器の大きさの上界を、引数から求める**（pass4.js の `returnSizeBound`）。
 *
 * 正確な個数は実行時に決まるが、**上界は静的に書ける**ことが多い——`d st~` は
 * `1 + ||st||` である。スロットは上界で足りるので、これが分かれば呼び出し側が場所を
 * 用意できる（sret）。「実行時にしか決まらない」で止まらず**上界を疑う**のが要で、
 * 個数と上界は別の問いである。
 *
 * **ただしまだ sret には使えない。** 下の最後の節がその理由で、仮引数の型が値より狭く
 * 出ることがあり、そのまま信じるとスロットが小さすぎる。
 *
 * 実行: node test/size_bound.test.js
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";
import { returnSizeBound } from "../pass4.js";
import { evaluate, newRuntimeEnv, UNIT, observe, isUnit } from "../interpreter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = peggy.generate(fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8"));

let passed = 0;
let total = 0;
function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
	if (!ok) console.log(`     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
}
function checkTrue(note, cond, extra) {
	check(note, !!cond, true);
	if (!cond && extra) console.log(`     ${extra}`);
}
// `f` の返値の上界を `k` か `k + ||p||` の形で返す。
function bound(src) {
	const { nodes } = compile(src, { charset: "ascii" });
	// `$` で関数を受ける `f` は、呼び出しサイトごとの実体 `f$g` になって総称は消える
	// （compile.js の specializeRefCalls）。測るのはその実体である。
	const nm = (n) => String(n.left.value).replace(/[<>]/g, "");
	const d = nodes.find((n) => n.name === "define" && /^f(\$|$)/.test(nm(n)));
	const b = returnSizeBound(d.right, nm(d));
	if (!b) return null;
	// **上界は器ごとの項の和である**（`konst + Σ coef_i × ||器_i||`）。1項なら今まで通りの
	// 見た目になる——`walk` のように2つの器を同時に食う形が書けるようになっただけである。
	if (!b.terms || b.terms.length === 0) return String(b.konst);
	const parts = b.terms.map((t) => `${t.coef === 1 ? "" : `${t.coef} × `}||${String(t.sizeOf).replace(/[<>]/g, "")}||`);
	return `${b.konst} + ${parts.join(" + ")}`;
}
// **その関数の上界が見積もりで通った道**（`returnSizeBound` の `estimated`）。証明で通れば空である。
function estimated(src) {
	const { nodes } = compile(src, { charset: "ascii" });
	const nm = (n) => String(n.left.value).replace(/[<>]/g, "");
	const d = nodes.find((n) => n.name === "define" && /^f($|$)/.test(nm(n)));
	const known = new Map();
	// 呼び先の上界を先に入れておく（合成の道を見るため）。`known` は名前 → 上界である。
	for (const n of nodes) {
		if (n.name !== "define" || !n.right || n.right.name !== "lambda") continue;
		const b0 = returnSizeBound(n.right, nm(n));
		if (b0) known.set(nm(n), b0);
	}
	const b = returnSizeBound(d.right, nm(d), known);
	return b ? b.estimated || [] : [];
}

function value(src) {
	const { nodes } = compile(src, { parse: parser.parse });
	const env = newRuntimeEnv(null);
	let r = UNIT;
	for (const n of nodes) r = evaluate(n, env);
	return isUnit(r) ? "__" : JSON.stringify(observe(r));
}

// ---- スカラーだけを並べるなら定数 ----
check("2つ並べる", bound("f : a b ? a b\nf 1 2"), "2");
check("3つ並べる", bound("f : a b c ? a b c\nf 1 2 3"), "3");
// `__` を返す枝は 0 要素なので、上界には効かない。
check("__ の枝は数えない", bound("f : a b ?\n\ta > 1 : __\n\ta b\nf 1 2"), "2");

// ---- 器を撒くなら、その器の要素数ぶん ----
//
// `d st~` は `1 + ||st||` である。**個数は実行時、上界は静的**——この区別が sret を
// 可能にする（スロットは上界で足りる）。
check("器の前にスカラー", bound("f : d st ? d st~\nf 1 `abc`"), "1 + ||st||");
check("器の後ろにスカラー", bound("f : d st ? st~ d\nf 1 `abc`"), "1 + ||st||");
// **器が2つ混ざるなら、和で書く。** 上界は器ごとの項の和（`konst + Σ coef×||器||`）で
// あり、1変数しか持てなかった頃はここで諦めていた。呼ぶ側も呼ばれた側も同じ式を計算する
// ——項が増えるだけで、性質は変わらない。
//
// これが要るのは preprocess.sn の `walk` である：各段で「続きを歩く」（入力に比例）か
// 「残りの段を閉じる」（スタックに比例）かを選ぶので、2つの器を同時に食っている。
check("器が2つなら和で書く", bound("f : a b ? a~ b~\nf `ab` `cd`"), "0 + ||a|| + ||b||");
// 呼び出しを含む形も、まだ扱わない（再帰の深さが要る）。
check("呼び出しを含む形は求めない", bound("g : x ? x\nf : a b ? a (g b)\nf 1 `ab`"), null);

// ---- まだ sret には使えない ----
//
// **仮引数の型が値より狭く出ることがある。** `push : st d ? d st~` は `bottom : 0` から
// 始まるスタックを受けるので `st` に `Int` と `List` の両方が来るが、型は片方へ落ちる
// （`collectParamTypes` が具体型を別の具体型で上書きするため、最後に書いた方が残る）。
// すると上界が `2` になり、実行時に 3 要素・4 要素と伸びる値に対して**スロットが
// 小さすぎる**——そのまま信じると記憶を壊す。
{
	const S = "bottom : 0\npush : st d ? d st~\nf : st d ? d st~\n";
	check("実行時は伸びる", value(S + "push (push bottom 2) 5"), JSON.stringify([5, 2, 0]));
	const { nodes } = compile(S + "push (push bottom 2) 5", { charset: "ascii" });
	const look = (s, nm) => { while (s) { const b = s.bindings instanceof Map ? s.bindings.get(nm) : s.bindings[nm]; if (b) return b; s = s.parent; } return null; };
	const d = nodes.find((n) => n.name === "define" && String(n.left.value).includes("push"));
	const st = look(d.right.scope, "<st>");
	// **スカラーと器が混ざったら器へ持ち上げる。** `[5] ≅ 5` なのでスカラーは1要素の器で
	// あり、`Int` と `List` は「どちらか分からない」のではなく**同じものの別の段**である
	// （`C` と `C×C`）。実引数を観測する側で合流させると、`st` は `List` になり上界も
	// 正しくなる——以前は片方へ落ちて `2` になり、実行時に伸びる値に対してスロットが
	// 小さすぎた。
	checkTrue("器へ持ち上がる", st && st.atomType === "List", `st = ${st && st.atomType}`);
	check("上界も正しくなる", bound(S + "f (f bottom 2) 5"), "1 + ||st||");
	// **持ち上げるのは「値がどちらにもなる」ときだけ**である。使われ方（`c (rest ' 0)` の
	// `c` は String を要求する演算に渡される）は値の型ではないので、そこでは持ち上げない
	// ——混同すると `[c ~rest]` の頭まで器になり、要素の幅が決まらなくなる。
	{
		const { nodes: ns } = compile("f : [c ~rest] ? c (rest ' 0)\nf `abc`", { charset: "ascii" });
		const fd = ns.find((n) => n.name === "define" && String(n.left.value).includes("f>"));
		const cb = look(fd.right.scope, "<c>");
		checkTrue("使われ方では持ち上げない", cb && cb.atomType === "Char", `c = ${cb && cb.atomType}`);
	}
}

// ---- 引数を食う自己呼び出しは、その器の要素数ぶん ----
//
// 器を返す関数のほとんどは再帰である。ここで諦めていると、返し方（sret）を決めても
// スロットの大きさが出ないので何も出せない——実際 lexer と preprocess の sret が
// 全部ここで止まっていた。
//
// 止まる理由が器の側にあること（毎段短くなること）が上界の根拠であり、それは原理5の
// 完全性公理が言う「器を尽くして止まる」形そのものである。
{
	// `take_while` の形。毎段1つ取って残りへ進むので `||s||` で頭打ちになる。
	const TW = "f : p s ?\n\ts = `` : ``\n\t(@p (s ' 0)) : (s ' 0) (f p (s ' 1~))\n\t``\nf $g `abc`\ng : c ? c = `a`\n";
	check("食う再帰は器の要素数", bound(TW), "0 + ||s||");
	// 段ごとに2つ並べるなら係数が2になる（`T(n) = 2 + T(n-1)`）。
	const DUP = "f : s ?\n\ts = `` : ``\n\t(s ' 0) (s ' 0) (f (s ' 1~))\nf `abc`\n";
	check("段ごとに2つなら係数2", bound(DUP), "0 + 2 × ||s||");
	// 底の枝が定数を返すなら、それが `konst` になる。
	const BASE = "f : s ?\n\ts = `` : `xy`\n\t(s ' 0) (f (s ' 1~))\nf `abc`\n";
	check("底の定数が konst", bound(BASE), "2 + ||s||");
	// **同じものを渡す自己呼び出しは、上界に何も足さない。** 器の引数を素通しするので
	// 返るものの大きさは自分の上界そのものである（`T = T`）——上界は他の枝で決まる。
	// ここで枝の形だけを見て諦めていたため、定数の底を持つ形まで sret に乗らなかった。
	check("素通しの自己呼び出しは足さない", bound("f : n a b ?\n\tn > 3 : a b\n\tf (n + 1) a b\nf 0 1 2"), "2");
	// スカラーの位置は入れ替えても器の大きさは動かない。
	check("スカラーは入れ替えてもよい", bound("f : n a b ?\n\tn > 3 : a b\n\tf (n + 1) b a\nf 0 1 2"), "2");
	// **そのまま渡す再帰は器では止まらない。** `try_col … board` は `board` が毎段
	// 同じで、止めているのは別の条件である——器から上界は出ないので求めない。
	// ここを緩めると、止まらない再帰に有限のスロットを割り当ててしまう。
	const SAME = "f : n s ?\n\tn > 3 : __\n\t(s ' 0) (f (n + 1) s)\nf 0 `abc`\n";
	check("そのまま渡す再帰は求めない", bound(SAME), null);
}

// ---- 静的に測れる綴りは konst である ----
//
// **上界の語彙に「静的に分かっていて、仮引数ではない」項が無かった。** 字面で書かれた
// 綴りへ辿り着ける名前——モジュールの束縛と、名前付きスロットの欄——は、呼ぶ側も
// 呼ばれた側も**同じ表を読めば同じ数**になる。測る必要が無いのだから `konst` である。
//
// これが無いあいだ、アセンブラが1行を組む形（`` `\t` (表 ' 鍵~) ` x0, x1` ``）が
// 丸ごと断られていた。長さは3つとも静的に分かっているのに、上界の側にそれを書く言葉が
// 無かっただけである。
//
// **実行時の鍵なら、選ばれうる行の最大を取る。** どれが選ばれるかは分からないが、
// 選ばれるのは表の行のどれかなので、最大は上界である。
{
	// `env` を渡した側の上界。渡さなければ今まで通り（既定は null）で、この項は出ない。
	const boundE = (src) => {
		const { nodes, env } = compile(src, { charset: "ascii" });
		const nm = (n) => String(n.left.value).replace(/[<>]/g, "");
		const d = nodes.find((n) => n.name === "define" && /^f(\$|$)/.test(nm(n)));
		const b = returnSizeBound(d.right, nm(d), undefined, undefined, env);
		if (!b) return null;
		if (!b.terms || b.terms.length === 0) return String(b.konst);
		const parts = b.terms.map((t) => `${t.coef === 1 ? "" : `${t.coef} × `}||${String(t.sizeOf).replace(/[<>]/g, "")}||`);
		return `${b.konst} + ${parts.join(" + ")}`;
	};

	// 字面1つ（1文字）＋ モジュールの名前（3文字）。
	check("モジュールの名前は konst", boundE("a : `add`\nf : n ? `\t` a\nf 1"), "4");
	// 名前から名前へ辿っても同じ。底が字面であることだけが条件である。
	check("名前から名前へ辿る", boundE("b : `add`\na : b\nf : n ? `\t` a\nf 1"), "4");
	// 静的な鍵なら、その欄だけを見る。
	check("静的な鍵はその欄だけ", boundE("t :\n\tadd : `add`\n\tsub : `subtract`\nf : n ? `\t` (t ' add)\nf 1"), "4");
	// **実行時の鍵は、行の最大**。`subtract`（8文字）が選ばれうるので 1 + 8 である。
	// ここを「先頭の行」にすると 4 になり、長い行を選んだときに足りない。
	check("実行時の鍵は行の最大", boundE("t :\n\tadd : `add`\n\tsub : `subtract`\nf : k ? `\t` (t ' k~)\nf `add`"), "9");
	// アセンブラの1行そのもの。`\t`(1) + 最大の綴り(8) + ` x0, x1`(7)。
	check("アセンブラの1行", boundE("t :\n\tadd : `add`\n\tsub : `subtract`\nf : k ? `\t` (t ' k~) ` x0, x1`\nf `add`"), "16");
	// `env` を渡さなければ今まで通り断る——**既存の呼び出しは何も変わらない**。
	check("env を渡さなければ今まで通り", bound("a : `add`\nf : n ? `\t` a\nf 1"), null);

	// ---- 静的に測れないものは、今まで通り断る ----
	//
	// **呼び出しの結果を辿ってはならない。** 辿れば「その関数が返す値」を一つに決めた
	// ことになり、上界の根拠が「読めば分かる字面」から「関数の意味」へすり替わる。
	check("呼び出しに束縛した名前は求めない", boundE("g : n ? `add`\na : g 1\nf : n ? `\t` a\nf 1"), null);
	check("欄が呼び出しなら求めない", boundE("g : n ? `add`\nt :\n\tk : g 1\n\tj : `xy`\nf : n ? `\t` (t ' k)\nf 1"), null);
	// **番地を取られた束縛は畳まない。** そこには場所があり、書き換えられうる——
	// 長さが静的だという根拠が消える（`constStructField` が同じ理由で断っている）。
	//
	// 印（`addressTaken`）を付けるのは Pass 4 の中なので、`compile` しただけの木にはまだ
	// 付いていない。ここで見たいのは**印が付いていたら畳まないこと**なので、印を立てて
	// から測る。実際の道で断ることは `qemu.test.js` の側（`$` を書いた形）で見る。
	{
		const src = "a : `add`\nf : n ? `\t` a\nf 1";
		const { nodes, env } = compile(src, { charset: "ascii" });
		const nm = (n) => String(n.left.value).replace(/[<>]/g, "");
		const d = nodes.find((n) => n.name === "define" && /^f(\$|$)/.test(nm(n)));
		const b0 = returnSizeBound(d.right, nm(d), undefined, undefined, env);
		checkTrue("印が無ければ畳む", b0 && b0.konst === 4, `konst = ${b0 && b0.konst}`);
		// 束縛の鍵は `<名前>`（`pass1` の綴り）。
		let s = env;
		let bind = null;
		while (s && !bind) { bind = s.bindings instanceof Map ? s.bindings.get("<a>") : s.bindings["<a>"]; s = s.parent; }
		checkTrue("束縛が見つかる", !!bind, "a の束縛が取れなかった");
		bind.addressTaken = true;
		check("番地を取られたら畳まない", returnSizeBound(d.right, nm(d), undefined, undefined, env), null);
	}
	// **組んだ列は数えない。** `l : a , b` は `List(String)` であり、字面ではない——
	// ここを辿ると「文字列を組む」形へ器を撒くことになり、解釈器と食い違う。
	// （実測：辿らせると解釈器が 2、機械が 3 を返した。断りが誤答に化ける方が悪い。）
	check("組んだ列は求めない", boundE("a : `ab`\nb : `cd`\nl : a , b\nf : n ? `\t` l\nf 1"), null);
	// **数と綴りを同じ節で混ぜたら求めない。**
	//
	// 末尾の「それ以外は1要素」は、落ちる先が `List` なら正しいが `String` は数を吸って
	// **綴りにする**（解釈器は `51` を2文字に綴る）。これは前からある数え違いで、この
	// 変更の外にある——ここで要るのは**断りが誤答に化けない**ことだけなので混ぜない。
	// 混ぜていた版は 5 を返した（正しくは 6）。
	check("数と綴りを混ぜたら求めない", boundE("a : 51\nb : `add`\nf : n ? `\t` b a\nf 1"), null);
}


// ---- 見積もりで通した上界は、黙らずに名指しする（利用者の裁定 2026-09-23） ----
//
// 上界は**証明ではなく見積もり**で通す道が3つある（stack_abi.md §4.7「外れたときに
// 何が起きるか」）。外れても踏み抜かない——書く直前に x15 と比べて `__` を返す——が、
// **その `__` は呼ぶ側の連結に吸われる**（`x , __ = x` は余積の法である）ので、外側には
// 短い器が黙って返る。踏み抜かないことと黙らないことは別なので、見積もりで通した関数を
// 後段が information で1件ずつ挙げる。
//
// ここで見るのは「印が付くか」である。診断そのものは `asm_gate.test.js` がコーパスの
// 9件を言い分ごと golden に持っている（`corpus.js` の `asm`）。
{
	// 撒きながら食う枝。`s~` を撒きつつ `s ' 1~` で食うので、線形の漸化式にならない
	// ——段ごとに消えたぶんを超えないと**見積もる**。
	const spreadAndEat = "f : s ?\n\t!s : ``\n\ts~ (f (s ' 1~))~\nf `abc`";
	checkTrue("撒きながら食う枝は見積もりの印が付く", estimated(spreadAndEat).length > 0, JSON.stringify(estimated(spreadAndEat)));
	check("印はその道の名前を持つ", estimated(spreadAndEat).some((w) => /撒きながら食う/.test(w)), true);
	// 素直に食うだけの再帰は証明で通る（印は付かない）。
	check("食うだけの再帰に印は付かない", estimated("f : s ?\n\t!s : ``\n\t(s ' 0) (f (s ' 1~))\nf `abc`"), []);
	// 器を組まない関数にも付かない。
	check("器を返さない関数に印は付かない", estimated("f : n ? n + 1\nf 1"), []);
}
// **印は呼ぶ側へも伝わる**（見積もりの上界を合成した上界も見積もりである）。合成の道は4つ
// あり、コーパス9枚で実際に通っている（実測：呼び先の印 43 回・実引数の合成 28 回・枝の中の
// 呼び出し 15 回・入れ子の合成 4 回）。**ここに単体の証人は置けなかった**——手で書いた小さな形は
// どれも上界そのものが出ず（`f : s ? g s` は `null`）、合成に入る前に終わってしまう。証人は
// コーパスの側に在る：`parser.sn` の `out_one` は3つの道の印を持ち（`corpus.js` の `asm`）、
// `out` / `out_at` / `out_as` / `out_jk` は輪を通って同じ印を受け取っている。

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
