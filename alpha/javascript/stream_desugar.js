/**
 * **ストリームを返す関数を、引ける規則へ均す（糖衣）。**
 *
 * Sign にループは無く再帰しかないので、列を作る関数はどれもこの形になる：
 *
 *     sep : [c ~rest] ?
 *         c = escape : c (rest ' 0) (sep (rest ' 1~))
 *         infix1 c   : space c space (sep rest)
 *         c (sep rest)
 *
 * どの枝も「**有限個の要素**を並べて、最後に自分（か仲間）をもう一度呼ぶ」形である。
 * つまり枝は状態機械の1状態であり、列全体は
 *
 *     カーソル = (どの枝か, 枝の中で何番目か, 残りの入力)
 *
 * で表せる。要素はどこにも置かれない——`k` 番目を訊かれたときに計算するだけである。
 * これは規則（レンジ）が `start + i × step` で引けるのと同じことで、**器を作るのでは
 * なく引ける規則を作る**という一つの答えの、一般形にあたる。
 *
 * ここが返すのは **Sign のソース**である。糖衣だと言うからには、何へ均したのかを目で
 * 読めなければならない。生成されるのは4つ：
 *
 *     f_arm  : 入力 ?        どの枝か（元のガード列そのまま）
 *     f_len  : a ?           その枝が並べる要素の個数
 *     f_at   : a k 入力 ?    枝 a の k 番目の要素
 *     f_next : a 入力 ?      枝 a を終えたあとの入力
 *
 * **実行時ディスパッチは要らない。** 枝は番号であって関数ポインタではないので、
 * `f_at` の中身はただの分岐である（type_system.md §4 の単相化と衝突しない）。
 */


// ノードの形を見るだけの述語は layout.js が唯一の置き場である（理由はそこの
// `isDefineNode` のコメント）。ここでの呼び名は `isIdent`。下の `bare` は
// `/^<|>$/g` で片側だけの山括弧も剥ぐ**別の規則**なので、そちらは写しではない。
import { isIdentifierNode as isIdent } from "./layout.js";

// 並置（連接）で列を伸ばす演算。どれも「左辺が器」で左結合である（list_model.md §2.2）。
const JOIN_OPS = new Set(["construct", "push", "unshift", "concat", "product"]);

function bare(name) {
	return typeof name === "string" ? name.replace(/^<|>$/g, "") : name;
}
// `(...)` の1枚皮を剥ぐ。連接の項は括弧に包まれて来ることが多い。
function unparen(n) {
	while (n && (n.type === "paren" || n.type === "block") && Array.isArray(n.lines) && n.lines.length === 1) n = n.lines[0];
	return n;
}
function isApply(n) {
	return !!n && n.type === "operation" && (n.name === "apply" || n.name === "partial_apply");
}
// 適用の根と引数列。`f a b` は `apply(apply(f, a), b)` として来る。
function applyChain(n) {
	const args = [];
	let cur = n;
	while (isApply(cur)) {
		args.unshift(cur.right);
		cur = cur.left;
	}
	return { base: cur, args };
}

/**
 * 連接の連なりを項の列へ均す。`a b (f x)` は `construct(construct(a, b), paren(...))`
 * として来るので、左へ降りながら右を集める。
 */
function joinItems(node) {
	const out = [];
	let cur = node;
	while (cur && cur.type === "operation" && JOIN_OPS.has(cur.name)) {
		out.unshift(cur.right);
		cur = cur.left;
	}
	out.unshift(cur);
	return out;
}

/**
 * 1つの枝を読む。**最後の項が仲間への呼び出しなら**、それはストリームの枝である。
 * @returns {{prefix: Node[], call: {name, args}}|null}
 */
// `__`（零射）そのものか。終端の枝が `__` を返すのは「そこで列が尽きる」であって、
// `__` という要素を1つ並べることではない。
function isUnitAtom(n) {
	if (!n || n.type !== "atom") return false;
	// **空文字列は `__` と同型である**（`__ = []`、unit.md）。`take_while : … s = `` : ``` の
	// ように「空を返して終わる」枝はよくある書き方で、`__` と書いたのと同じ意味である。
	if (n.atomType === "Unit") return true;
	if ((n.kind === "string" || n.kind === "char") && String(n.value).replace(/^`|`$/g, "") === "") return true;
	return n.value === "_" || n.value === "__";
}

function readArm(body, group) {
	const items = joinItems(body).map(unparen);
	const last = items[items.length - 1];
	if (isApply(last)) {
		const { base, args } = applyChain(last);
		if (isIdent(base) && group.has(bare(base.value))) {
			return { prefix: items.slice(0, -1), call: { name: bare(base.value), args } };
		}
	}
	// **終端の枝。** 仲間を呼ばずに終わる枝は「そこで列が尽きる」である——カーソルの
	// 尽きた状態そのものなので、状態機械の枝として正しい。`close_all` のように
	// 「並べて自分を呼ぶ枝」と「`__` で終わる枝」の2つで書かれた形がこれである。
	return { prefix: items.every(isUnitAtom) ? [] : items, call: null };
}

/**
 * 関数定義からストリームの枝を取り出す。読めない枝が1つでもあれば諦める——
 * **半分だけ均すと、どちらの規則で読むべきかが式ごとに変わる**ことになる。
 * @returns {{name, params, arms: [{guard, prefix, call}]}|null}
 */
function readStreamFunction(node, group) {
	if (!node || node.type !== "operation" || node.name !== "define" || !isIdent(node.left)) return null;
	const lam = node.right;
	if (!lam || lam.type !== "operation" || lam.name !== "lambda") return null;
	const name = bare(node.left.value);
	const body = lam.right;
	// 分岐の無い1枝ものと、インデントブロックの多枝ものの両方を扱う。
	const lines = Array.isArray(body && body.lines) ? body.lines : [body];
	const arms = [];
	for (const line of lines) {
		const guarded = line && line.type === "operation" && line.name === "define";
		const value = guarded ? line.right : line;
		const arm = readArm(value, group);
		arms.push({ guard: guarded ? line.left : null, ...arm });
	}
	if (arms.length === 0) return null;
	// ガードの無い枝は最後の1つだけ（それより後ろは届かない）。
	for (let i = 0; i < arms.length - 1; i++) if (!arms[i].guard) return null;
	// **並べる要素が1つも無ければ、それは列ではない。** `preprocess : s ? sep (mark s)` は
	// ただの末尾呼び出しであり、状態機械の枝ではない——ここを混ぜると、ふつうの関数まで
	// カーソルへ均そうとしてしまう。
	if (!arms.some((a) => a.prefix.length > 0)) return null;
	// **並べるものは1要素でなければならない。**
	//
	// `space (c (rest ' 0) (rest ' 1)) space` の真ん中は**1つの要素**だが、それは
	// 3文字の器である——`_at` の返値にすると、複数文字の器をその場で作ることになる。
	// 平らにすれば答えが変わる（`a (b c) d` は `["a","bc","d"]`——余積は「右辺を1要素と
	// して足す」）。`c rest` のように器そのものが並ぶ形も、個数が固定でないので入らない。
	// **どちらも黙ってやってはいけない**ので、この形は均さない。
	//
	// 見るのは型である。器（`String` / `List` / `Struct` / `Iterator`）が並んでいたら諦める。
	// **並べるものは1要素でなければならない。ただし個数は型では分からない。**
	//
	// 型の上ではスカラーも1要素の器なので（`[5] ≅ 5`）、`c` は `Char` とも `String` とも
	// 書ける——**型で「器かどうか」を判定しても、1要素かどうかは出ない**。見るのは構造で
	// ある：分割代入の頭（`c`）と添字（`rest ' i`）とリテラルは1つ、尾（`rest`）とその
	// 撒き（`rest~`）は多数、連なりは中身の数だけ。
	//
	// 入力の連続した位置が並んでいるなら通す——`space (c (rest ' 0) (rest ' 1)) space` の
	// 真ん中は3文字だが、入力のその3文字そのものなので位置ごとに展開できる（`printElements`）。
	const dmap = destructureMap(lam.left);
	const okElement = (p) => {
		if (!p) return false;
		// 連なりは、入力の連続した位置なら展開できる。そうでなければ個数が決まらない。
		if (p.type === "operation" && JOIN_OPS.has(p.name)) return !!dmap && consecutiveRun(p, dmap) !== null;
		// 尾そのもの（と、その撒き）は多数である。
		const q = p.type === "operation" && p.position === "postfix" && p.name === "expand" ? unparen(p.operand) : p;
		if (dmap && isIdent(q) && bare(q.value) === dmap.rest) return false;
		// それ以外は1つ（頭・添字・リテラル・計算した値）。
		return true;
	};
	if (arms.some((a) => a.prefix.some((p) => !okElement(p)))) return null;
	// **列であるには、続く枝が要る。** 全部が終端なら、それはただの分岐である。
	if (!arms.some((a) => a.call)) return null;

	// **次の状態の形は枝によらず同じでなければならない。** 引数の本数が枝ごとに違うなら
	// カーソルの形が決まらない（終端の枝には次が無いので数えない）。
	const calls = arms.filter((a) => a.call);
	const arity = calls[0].call.args.length;
	if (calls.some((a) => a.call.args.length !== arity)) return null;
	return { name, paramNode: lam.left, arms, arity };
}

/** 定義の名前を集める。相互再帰の群を判定するのに使う。 */
function definedNames(nodes) {
	const out = new Set();
	for (const n of nodes) {
		if (n && n.type === "operation" && n.name === "define" && isIdent(n.left)) out.add(bare(n.left.value));
	}
	return out;
}

/**
 * ストリームを返す関数を全部見つける。
 *
 * 群は「互いを呼び合う定義の集まり」だが、まずは**定義されている名前すべて**を候補に
 * して読んでみて、読めたものだけを採る——読めることそのものが「枝の形をしている」
 * という証拠なので、群の判定を先にやる必要が無い。
 */
function findStreamFunctions(nodes) {
	const group = definedNames(nodes);
	const found = [];
	for (const n of nodes) {
		const f = readStreamFunction(n, group);
		if (f) found.push(f);
	}
	return found;
}

/**
 * **AST を Sign のソースへ戻す。**
 *
 * 糖衣だと言うからには、何へ均したのかを目で読めなければならない。生成した規則を
 * 文字列で吐いて、それを**もう一度同じパイプラインへ通す**——手で書いたコードと
 * 同じ道を通るので、生成側だけが通る抜け道が生まれない。
 *
 * 読めない形に当たったら `null` を返す。**半分だけ印字するくらいなら諦める**方がよい
 * ——生成したものが元と違う意味になっていても、見た目では分からないからである。
 */

// 並置（連接・適用）は記号が空白なので、項の間に空白1つだけを置く。
function printNode(n, subst = null) {
	if (!n || typeof n !== "object") return null;
	if (n.type === "atom") {
		if (n.kind === "identifier") {
			const name = bare(n.value);
			// **分割代入を添字へ戻す。** `[c ~rest]` で受けた名前は、入力を丸ごと受ける形
			// （`s`）から見れば `s ' 0` と `s ' 1~` である。同じものの別の書き方でしかない
			// が、**添字の形なら「入力の連続した位置」だと分かる**——分かれば器を作らずに
			// 切り出しで済む（`sep` の枝が3文字を並べているのは入力の3文字そのものである）。
			if (subst && Object.prototype.hasOwnProperty.call(subst, name)) return subst[name];
			return name;
		}
		return String(n.value);
	}
	if (n.type === "operation") {
		if (n.position === "prefix") {
			const o = printNode(n.operand, subst);
			return o === null ? null : `${n.op}${o}`;
		}
		if (n.position === "postfix") {
			const o = printNode(n.operand, subst);
			return o === null ? null : `(${o})${n.op}`;
		}
		const l = printNode(n.left, subst);
		const r = printNode(n.right, subst);
		if (l === null || r === null) return null;
		// **並置に括弧を付けてはいけない。** `a (b c) d` の括弧は「ここまでで1つの要素」と
		// 言っており、付けると要素数が変わる（余積は右辺を1要素として足す）。連なりは
		// 平らなまま書く——括弧が要る所には、元の木に既にブロックが在る。
		if (n.op === " ") return `${l} ${r}`;
		return `(${l} ${n.op} ${r})`;
	}
	// ブロックは1行ものだけ扱う。複数行のブロックが式の位置に来る形は、ここでは諦める。
	if (Array.isArray(n.lines)) {
		if (n.lines.length !== 1) return null;
		const inner = printNode(n.lines[0], subst);
		return inner === null ? null : `(${inner})`;
	}
	return null;
}

/**
 * 仮引数リストを印字する。**ブラケットの有無で意味が変わる**——`[c ~rest]` は
 * 「1つの器を受けて分解する」、`c ~rest` は「先頭と可変長」であり、同じ entries でも
 * 別物である（`bracket`）。デフォルト値と入れ子のパターンはまだ印字しない。
 */
function printParams(p) {
	if (!p) return null;
	if (p.type === "atom") return bare(p.value);
	if (p.type !== "params") return null;
	const parts = [];
	for (const e of p.entries || []) {
		if (e.pattern || e.default) return null;
		if (!e.name) return null;
		parts.push((e.rest ? "~" : "") + bare(e.name));
	}
	if (parts.length === 0) return null;
	return p.bracket ? `[${parts.join(" ")}]` : parts.join(" ");
}

/**
 * `[c ~rest]` で受ける形を、入力を丸ごと受ける形（`s`）へ読み替える表。
 * 頭と尾の名前、そして名前 → 添字式の置換を返す。この形でなければ null。
 */
function destructureMap(paramNode) {
	if (!paramNode || paramNode.type !== "params" || !paramNode.bracket) return null;
	const es = paramNode.entries || [];
	if (es.length !== 2 || es[0].rest || !es[1].rest || !es[0].name || !es[1].name) return null;
	const head = bare(es[0].name);
	const rest = bare(es[1].name);
	return { head, rest, subst: { [head]: "(s ' 0)", [rest]: "(s ' 1~)" } };
}

// その式が入力の何番目を指しているか。`c` は 0、`rest ' i` は i+1。分からなければ null。
function inputPosition(node, dm) {
	const n = unparen(node);
	if (!n) return null;
	if (isIdent(n) && bare(n.value) === dm.head) return 0;
	if (n.type === "operation" && n.name === "get_prop" && isIdent(unparen(n.left))) {
		if (bare(unparen(n.left).value) !== dm.rest) return null;
		const i = unparen(n.right);
		if (i && i.type === "atom" && i.kind === "number" && Number.isInteger(Number(i.value))) return Number(i.value) + 1;
	}
	return null;
}

// その式が入力の何番目から末尾までを指しているか。`rest` は 1、`rest ' (i ~+ 1)` は i+1。
function suffixPosition(node, dm) {
	const n = unparen(node);
	if (!n) return null;
	if (isIdent(n) && bare(n.value) === dm.rest) return 1;
	if (n.type === "operation" && n.name === "get_prop" && isIdent(unparen(n.left))) {
		if (bare(unparen(n.left).value) !== dm.rest) return null;
		const r = unparen(n.right);
		if (r && r.type === "operation" && r.name === "range_arithmetic") {
			const st = unparen(r.left);
			const sp = unparen(r.right);
			if (st && st.kind === "number" && sp && sp.kind === "number" && Number(sp.value) === 1) return Number(st.value) + 1;
		}
	}
	return null;
}

/**
 * 並べる要素を印字する。**入力の連続した位置が並んでいるなら、切り出し1つで書く。**
 *
 * `c (rest ' 0) (rest ' 1)` は入力の 0,1,2 番目であり、器を作る必要はない——同じ領域を
 * 指したまま頭と長さを決めればよい。ここが `sep` の枝が均せなかった理由である。
 */
// 並んでいるのが入力の連続した位置なら `[先頭, 末尾]` を返す。そうでなければ null。
function consecutiveRun(node, dm) {
	const items = joinItems(node).map(unparen);
	if (items.length < 2) return null;
	const positions = items.map((it) => inputPosition(it, dm));
	if (positions.some((p) => p === null)) return null;
	for (let i = 1; i < positions.length; i++) if (positions[i] !== positions[i - 1] + 1) return null;
	return [positions[0], positions[positions.length - 1]];
}

/**
 * 並べる要素を印字する。**入力の連続した位置が並んでいるなら、位置ごとの要素へ展開する。**
 *
 * `(c (rest ' 0) (rest ' 1))` は括弧のせいで1つの要素に見えるが、中身は入力の 0,1,2 番目
 * である。**切り出し1つに畳んではいけない**——列の要素数が変わってしまう（3文字が1要素に
 * なる）。位置ごとにばらせば、器も作らず、列も元のままである。
 *
 * @returns 印字した要素の配列（ふつうは1つ、連続位置なら並んだぶんだけ）
 */
function printElements(node, dm) {
	const run = consecutiveRun(node, dm);
	if (run) {
		const out = [];
		for (let p = run[0]; p <= run[1]; p++) out.push(`s ' ${p}`);
		return out;
	}
	const one = printNode(node, dm.subst);
	return one === null ? null : [one];
}

/**
 * **群をまたいで枝に通し番号を振る。**
 *
 * 枝は「どの関数のどの枝か」で決まるが、カーソルが持つのは番号1つで足りる——`sep` の
 * 枝から `in_quote` の枝へ移ることがあるので、関数ごとに振り直すと移った先が言えない。
 * 群の名前は最初の関数の名前を借りる（相互再帰では順序だけが根拠なので、決め方を
 * 一つにしておく）。
 */
function numberArms(funcs) {
	const armIndex = new Map(); // "関数名#枝番" → 通し番号
	const flat = [];
	for (const f of funcs) {
		f.arms.forEach((a, i) => {
			armIndex.set(`${f.name}#${i}`, flat.length);
			flat.push({ owner: f, local: i, ...a });
		});
	}
	return { armIndex, flat };
}

/**
 * ストリームを返す関数の群を、**引ける規則**へ均した Sign のソースへ変換する。
 *
 * 出るのは5種類。どれもただの分岐であって、実行時ディスパッチはどこにも無い。
 *
 *     <f>_arm : 入力 ?        どの枝か（元のガード列そのまま）
 *     <g>_len : a ?           枝 a が並べる要素の個数
 *     <g>_at  : a k 入力 ?    枝 a の k 番目の要素
 *     <g>_nx  : a 入力 ?      枝 a を終えたあとの入力
 *     <g>_na  : a 入力 ?      枝 a を終えたあとの枝番号
 *
 * `_at` と `_nx` は枝ごとの小さな関数へ振り分ける。入力を**丸ごと**受けて、分解は
 * 振り分けられた先でやる——`[c ~rest]` で受けてから器を組み直すのは、参照を分解した
 * ものを足し合わせることであり、確保が要る。丸ごと渡せば要らない。
 *
 * @returns {{source: string, group: string, names: object}|null} 印字できなければ null
 */
function generatePullers(funcs, opts = {}) {
	if (!funcs || funcs.length === 0) return null;
	// 状態が1つの器で表せる形だけを扱う。複数の値を持ち回る枝（`walk`）はカーソルが
	// 太るので、まだここでは均さない。
	if (funcs.some((f) => f.arity !== 1)) return null;
	// **群は閉じていなければならない。** 枝が移る先の関数が均されていなければ、その枝の
	// `_na` は存在しない名前へ跳ぶ。片方だけ均すのは、跳び先を失うことである。
	const known = new Set(funcs.map((f) => f.name));
	for (const f of funcs) {
		for (const a of f.arms) if (a.call && !known.has(a.call.name)) return null;
	}
	// **並べるものの中に仲間が隠れていてはいけない。**
	//
	// `delta : … 1 + (delta rest)` は列を作っているように見えるが、再帰の結果を**算術に
	// 使って**いる——返すのは深さという1つの数であって列ではない。枝の末尾にある呼び出し
	// だけを見ていると、式に埋まった再帰を見落として**まったく別の意味へ均してしまう**。
	// 遅くなるのではなく間違えるので、少しでも混ざっていたら諦める。
	//
	// 見るのは**群の仲間だけ**である。ファイル中の全定義を仲間と見なすと、`dedent` の
	// ような定数を並べているだけの枝まで弾いてしまう（実際に弾いていた）。
	const mentions = (n) => {
		if (!n || typeof n !== "object") return false;
		if (isIdent(n) && known.has(bare(n.value))) return true;
		for (const k of ["left", "right", "operand"]) if (mentions(n[k])) return true;
		for (const l of n.lines || []) if (mentions(l)) return true;
		return false;
	};
	for (const f of funcs) {
		for (const a of f.arms) if (a.prefix.some(mentions)) return null;
	}
	const pre = opts.prefix || "";
	const group = pre + funcs[0].name;
	const { armIndex, flat } = numberArms(funcs);
	const out = [];

	// --- どの枝か。ガード列はそのまま写す ---
	for (const f of funcs) {
		const ps = printParams(f.paramNode);
		if (ps === null) return null;
		const lines = [`${pre}${f.name}_arm : ${ps} ?`];
		for (let i = 0; i < f.arms.length; i++) {
			const a = f.arms[i];
			const n = armIndex.get(`${f.name}#${i}`);
			if (!a.guard) {
				lines.push(`\t${n}`);
				continue;
			}
			const g = printNode(a.guard);
			if (g === null) return null;
			lines.push(`\t${g} : ${n}`);
		}
		out.push(lines.join("\n"));
	}

	// --- 枝ごとの「k 番目」と「次の入力」 ---
	for (let n = 0; n < flat.length; n++) {
		const a = flat[n];
		// **分割代入は添字へ戻せる。** `[c ~rest]` で受けた名前は、入力を丸ごと受ける形から
		// 見れば `s ' 0` と `s ' 1~` である。戻すと「入力の連続した位置」が見えるようになり、
		// 並んでいるのが入力の切り出しなら**器を作らずに済む**（`sep` の枝が3文字を並べて
		// いるのは、入力のその3文字そのものである）。
		const dm = destructureMap(a.owner.paramNode);
		const ps = dm ? "s" : printParams(a.owner.paramNode);
		if (ps === null) return null;
		// k 番目。要素が1つなら分岐は要らない。
		// 連続位置は位置ごとの要素へ展開されるので、枝の要素数が増えることがある。
		let elems = [];
		for (const p of a.prefix) {
			const got = dm ? printElements(p, dm) : [printNode(p)];
			if (!got || got.some((e) => e === null)) { elems = null; break; }
			elems.push(...got);
		}
		if (elems === null) return null;
		a.emitted = elems.length; // `_len` はここで決まる（元の要素数ではない）
		if (elems.length === 0) {
			// 何も並べない枝。引かれることは無いが、形を揃えておく（`_len` が 0 を返す）。
			out.push(`${group}_at${n} : k ${ps} ? __`);
		} else if (elems.length === 1) {
			out.push(`${group}_at${n} : k ${ps} ? ${elems[0]}`);
		} else {
			const lines = [`${group}_at${n} : k ${ps} ?`];
			for (let i = 0; i < elems.length - 1; i++) lines.push(`\tk = ${i} : ${elems[i]}`);
			lines.push(`\t${elems[elems.length - 1]}`);
			out.push(lines.join("\n"));
		}
		// 次の入力。再帰呼び出しの実引数がそれである。終端の枝には次が無い。
		if (a.call) {
			// 次の入力も位置で書ける（`rest ' 2~` は入力の 3 番目から末尾まで）。
			const pos = dm ? suffixPosition(a.call.args[0], dm) : null;
			const nx = pos !== null ? `s ' ${pos}~` : printNode(a.call.args[0], dm ? dm.subst : null);
			if (nx === null) return null;
			out.push(`${group}_nx${n} : ${ps} ? ${nx}`);
		}
	}

	// --- 振り分け。ただの分岐であって、跳び先は静的に決まっている ---
	// **どの枝も番号で選ぶ。最後の枝も条件を書く。**
	//
	// 既定の枝（条件なし）にすると、枝が1つのときに `a` が本体に一度も現れず、型が
	// 決まらなくなる（「渡し方が決まりません」）。全部条件付きにすれば `a = N` が `a` を
	// `Int` だと言うし、範囲外の枝番号は `__` になる——それが正しい答えでもある。
	const dispatch = (name, params, body) => {
		const lines = [`${group}_${name} : ${params} ?`];
		for (let n = 0; n < flat.length; n++) lines.push(`\ta = ${n} : ${body(n)}`);
		return lines.join("\n");
	};
	out.push(dispatch("len", "a", (n) => String(flat[n].emitted ?? flat[n].prefix.length)));
	out.push(dispatch("at", "a k s", (n) => `${group}_at${n} k s`));
	// 終端の枝は入力を動かさない。動かす先が無いので、そのまま返す（幅を揃えるため）。
	out.push(dispatch("nx", "a s", (n) => (flat[n].call ? `${group}_nx${n} s` : "s")));
	// 移った先の枝番号は、移った先の関数のガード列が決める。**終端の枝は `__` である**
	// ——カーソルの `arm` が niche になり、それがそのまま「尽きた」を表す。
	out.push(dispatch("na", "a s", (n) => (flat[n].call ? `${pre}${flat[n].call.name}_arm s` : "__")));

	// --- 進める。**カーソルを1つ進めたカーソル** ---
	//
	// 枝の中に続きがあれば `k` を進めるだけ、尽きたら入力を送って次の枝を選ぶ。どちらも
	// カーソルであって、要素はどこにも現れない——`[h ~t]` が参照の頭と長さをずらすのと
	// 同じ機械が、ここでは枝と位置をずらす算術になる。
	//
	// **これも Sign で書く。** Pass 4 が出すのは `bl <g>_adv` の1つで足りる。分岐や
	// 呼び出しの組み立てを命令の側へ持ち込まなければ、確かめる場所が1つで済む。
	out.push(
		[
			`${group}_adv : a k s ?`,
			`\t(k + 1) < (${group}_len a) : a , (k + 1) , s`,
			`\t(${group}_na a (${group}_nx a s)) , 0 , (${group}_nx a s)`,
		].join("\n"),
	);

	// --- 入口。**元の名前がカーソルを返すようになる** ---
	//
	// `sep s` は列を作るのではなく「列を引くための3つ組」を返す。並べるものは何も
	// 置かれないので、これが「器を作るのではなく引ける規則を作る」の実体である。
	// 定義は後から来た方が勝つので、元の定義はこれに置き換わる（Pass 4 は元を飛ばす）。
	const entries = funcs.map((f) => f.name);
	for (const f of funcs) out.push(`${pre}${f.name} : s ? (${pre}${f.name}_arm s) , 0 , s`);

	return { source: out.join("\n\n") + "\n", group, armCount: flat.length, entries };
}

/**
 * 生成される規則の名前。**pass3 と pass4 もこれを読む**——カーソルは「引き方」を持つ値
 * なので、どの関数を呼ぶかは型の側からも命令の側からも同じ規約で決まる。文字列を
 * 3か所に書くと、片方だけ変えたときに黙って食い違う。
 */
const CURSOR_SUFFIXES = { arm: "_arm", len: "_len", at: "_at", nx: "_nx", na: "_na", adv: "_adv" };

/**
 * **見つけたものを、実際に呼び合う塊へ分ける。**
 *
 * `close_all` と `delta` は互いを呼ばないので別の群である。まとめて1つの群として番号を
 * 振ると、関係の無い関数の枝が同じ `_at` の分岐に並ぶ——動きはするが、`close_all` を
 * 引くたびに `delta` の枝まで比べることになるし、片方が均せないときに巻き添えになる。
 *
 * 枝が移る先が見つかっていない群は落とす。跳び先の無い `_na` を出すよりは、均さない方が
 * よい（`in_quote` は `sep` へ移るが、`sep` は要素が器なので均せない）。
 */
function groupStreamFunctions(funcs) {
	const byName = new Map(funcs.map((f) => [f.name, f]));
	const seen = new Set();
	const groups = [];
	for (const f of funcs) {
		if (seen.has(f.name)) continue;
		// 呼び合う関係の連結成分を取る（向きは見ない——相互再帰は双方向である）。
		const members = [];
		const queue = [f.name];
		let closed = true;
		while (queue.length > 0) {
			const name = queue.shift();
			if (seen.has(name)) continue;
			seen.add(name);
			const g = byName.get(name);
			if (!g) continue;
			members.push(g);
			for (const a of g.arms) {
				if (!a.call) continue;
				if (!byName.has(a.call.name)) {
					closed = false;
					continue;
				}
				if (!seen.has(a.call.name)) queue.push(a.call.name);
			}
			// 自分を呼ぶ側も同じ群である。
			for (const other of funcs) {
				if (seen.has(other.name)) continue;
				if (other.arms.some((a) => a.call && a.call.name === name)) queue.push(other.name);
			}
		}
		if (!closed) continue;
		// 定義の順を保つ（群の名前は最初の関数から借りるので、決め方を一つにしておく）。
		members.sort((a, b) => funcs.indexOf(a) - funcs.indexOf(b));
		groups.push(members);
	}
	return groups;
}

export { CURSOR_SUFFIXES, groupStreamFunctions, generatePullers, printNode, printParams, findStreamFunctions, readStreamFunction, joinItems, readArm, definedNames, bare, unparen, applyChain };
