/**
 * **layout.js の問いを記録する実行時。単独のモジュールではない。**
 *
 * `layout_trace_hooks.mjs` が layout.js を読み込むときに、このファイルの中身をそのまま
 * layout.js の `export {` の直前へ差し込む。だから `deref` のような layout.js の中の名前を
 * そのまま引ける——単独で import すると未定義の名前で落ちる。`test/run.js` は `test/` 直下の
 * `*.test.js` しか拾わないので、ここが検査として走ることは無い。
 *
 * 差し込む前に、フックが次の2つを用意する:
 *   - `__LAYOUT_SHA`   書き換える前の layout.js の指紋（`layoutShaOf`。`export {` より前の sha256）
 *   - `__o_<名前>`      包む前の関数（元の `function <名前>(` を改名したもの）
 * そして差し込んだ後ろで、元の名前を包んだ関数へ付け替える（`const measure = __ask(…)`）。
 * layout.js の中の呼び出しも外からの呼び出しも、元の名前を引くので全部ここを通る。
 *
 * **記録するのは問いであって答えではない。** 答えを持っているのは layout.js なので、
 * 門は実行時に JS へ同じ問いを立て直す（`target_info_reached.js` と同じ規律）。
 * ここで答えを見るのは、**型の名前だけで同じ答えが出るか**を確かめるときだけである。
 */
import __fs from "node:fs";
import __path from "node:path";

// **合成の問い（型の名前だけの節点）を立てている間は記録しない。** 確かめるための呼び出しが
// 問いとして数えられると、誰も立てていない問いが表に載る。ただし枠と印は動かす（下の `__probe`）。
let __quiet = 0;
const __seen = new Map();
const __THREW = Symbol("threw");

const __put = (rec) => {
	const k = JSON.stringify(rec);
	__seen.set(k, (__seen.get(k) || 0) + 1);
};

const __hush = (f) => {
	__quiet++;
	try {
		return f();
	} catch {
		return __THREW;
	} finally {
		__quiet--;
	}
};

// 答えの同一性は JSON で見る。`undefined` の欄は JSON に出ないので、`null` と取り違えない。
const __same = (a, b) => a !== __THREW && b !== __THREW && JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// **行には `null` で書き、問い直すときは `undefined` として渡す。** conf に欄が無いのと
// `null` とでは、layout.js の中の既定値（`charset = DEFAULT_CHARSET`）の効き方が違うので、
// 門が立て直す問いと同じ形（`undefined`）でここも確かめる。
const __u = (v) => (v === null ? undefined : v);
const __cf = (c) => ({ target: (c && c.target) ?? null, charset: (c && c.charset) ?? null });

/**
 * **問いの枠。** `passingOf` / `slotCellSize` / `measure` / `measureRule` に入るたびに1つ積む。
 *
 * 構文木を歩く関数（`listItems` / `stringLength` / `layoutOfStruct` / `cursorParts` …）に
 * 入ったら、**いちばん内側の枠**にその名前を付ける。`passingOf` が中で `measure` を呼んで
 * 器の中身を数えても、それは内側の `measure` の枠に付く——`passingOf` が使うのはその答えの
 * `repr` だけで、器の中身は答えに届かない（`List` なら何が入っていても `{ptr, len}`）。
 *
 * **答えをそのまま返したときだけ、内側の枠の印を引き継ぐ。** `slotCellSize` は参照でなければ
 * `measure` の答えを素通しするので、そこで歩いたなら `slotCellSize` の答えも歩いた結果である。
 * 同じかどうかは値の同一性で見る（`null` どうしも同じと見る——広く引き継ぐ側へ倒す）。
 */
let __frames = [];
const __charge = (why) => {
	if (__frames.length) __frames[__frames.length - 1].walked.add(why);
};
const __enter = () => {
	const f = { walked: new Set(), kids: [] };
	__frames.push(f);
	return f;
};
const __inherit = (f, r) => {
	for (const k of f.kids) if (k.r === r) for (const w of k.walked) f.walked.add(w);
};
const __leave = (f, r) => {
	__frames.pop();
	__inherit(f, r);
	const up = __frames[__frames.length - 1];
	if (up) up.kids.push({ r, walked: f.walked });
};

/**
 * **合成の問いを立てて、答えと「歩いたか」の両方を返す。**
 *
 * 名前だけの節点で問い直しても、JS がその中で木を歩くことがある——`measure({ atomType: "List" })`
 * は `measureList` に入って、数える中身が無いので `null` を返す。その `null` は名前が決めた
 * 答えではない。本物の問いが別の理由で `null` を返したとき（入れ子の見張り `MAX_NEST` を
 * 越えた、など）に、答えが偶然一致して名前の問いに見えてしまう。だから合成の側も印を見る。
 *
 * 枠の積みは本物と分ける。合成の枠が本物の親の `kids` に入ると、親が偶然同じ値を返したとき
 * 印を引き継いでしまう。
 */
const __probe = (call) => {
	const saved = __frames;
	__frames = [];
	const sf = __enter();
	let r = __THREW;
	__quiet++;
	try {
		r = call();
	} catch {
		r = __THREW;
	} finally {
		__quiet--;
		__frames = saved;
	}
	__inherit(sf, r);
	return { r, walked: sf.walked };
};

// 記録しないとき（合成の問いの中）も、枠だけは積んで印を受ける。
const __framed = (fn, self, a) => {
	const f = __enter();
	let r = __THREW;
	try {
		r = fn.apply(self, a);
	} finally {
		__leave(f, r);
	}
	return r;
};

// 節点が名乗る型と、辿った先。**大きさは中身にしか無い**ので layout.js は識別子を辿ってから
// 型を読む（`node.atomType || named.atomType`）。ここも同じ順で読む。
//
// **辿るのは本物の呼び出しが終わった後、しかもターゲットが在るときだけである。** `deref` は
// 束縛の `repr` / `elementType` を値の節点へ書き写す（副作用がある）。未対応のターゲットでは
// layout.js は辿る前に `null` を返すので、ここで辿ると本物が書かなかったものを書いてしまう。
const __resolve = (node, conf) => {
	if (!node || typeof node !== "object") return { type: null, d: null };
	if (!widthsOf(conf && conf.target)) return { type: node.atomType ?? null, d: node };
	const d = __hush(() => deref(node, conf && conf.env));
	const dd = d && d !== __THREW ? d : node;
	return { type: dd.atomType || node.atomType || null, d: dd };
};

/**
 * `passingOf` / `slotCellSize` / `measure`。
 *
 * 行になるのは、**型の名前だけで同じ答えが出て、本物も合成も構文木を歩かなかった**問いだけ
 * である。答えの一致だけでは足りない——`measure` は `[…]` の中身を数えて `null` を返すことが
 * あり、型の名前だけの節点も（数える中身が無いので）`null` を返す。答えは同じだが、前者は
 * 中身で決まっている。
 */
const __ask = (name, fn) =>
	function (...a) {
		if (__quiet) return __framed(fn, this, a);
		const [node, conf] = a;
		const f = __enter();
		let r = __THREW;
		try {
			r = fn.apply(this, a);
		} finally {
			__leave(f, r);
		}
		// 印は枠を閉じた後に足してよい。親の枠は同じ Set を持っているので、親が閉じるときに見える。
		const { type, d } = __resolve(node, conf);
		const own = node && typeof node === "object" ? node.atomType ?? null : null;
		// **型の名前が節点に無く、束縛を辿って初めて分かった**なら、それは名前ではなく木から来た。
		if (type !== own) f.walked.add("deref");
		// 前置 `~` は中身（operand）を測る。名前だけでは中身の型が分からない。
		if (name === "measure" && d && d.type === "operation" && d.position === "prefix" && d.name === "continuous" && d.operand) f.walked.add("continuous");
		const c = __cf(conf);
		const syn = type ? __probe(() => fn({ atomType: type }, { target: __u(c.target), charset: __u(c.charset) })) : { r: __THREW, walked: new Set() };
		__put({ fn: name, type, own, target: c.target, charset: c.charset, typeOnly: __same(r, syn.r), walked: [...f.walked].sort(), synWalked: [...syn.walked].sort() });
		return r;
	};

/**
 * `measureRule`。**答えは型と要素型とターゲットだけで決まる**（`node.atomType` /
 * `node.elementType` / `widthsOf(target)` しか読まない）ので、行には要素型も載せる。
 *
 * 呼び手（`measure` / `passingOf`）の側から見ると、要素型か `repr` を読んだ時点で答えは型の
 * 名前だけでは決まらない。だから入る前に、呼び手の枠へ印を付ける。
 */
const __rule = (fn) =>
	function (...a) {
		const [node, conf] = a;
		if (node && (node.elementType || node.repr)) __charge("measureRule(el/repr)");
		if (__quiet) return __framed(fn, this, a);
		const r = __framed(fn, this, a);
		const c = __cf(conf);
		const type = (node && node.atomType) ?? null;
		const el = (node && node.elementType) ?? null;
		const syn = __probe(() => fn({ atomType: __u(type), elementType: __u(el) }, { target: __u(c.target), charset: __u(c.charset) }));
		__put({ fn: "measureRule", type, el, repr: (node && node.repr) ?? null, target: c.target, charset: c.charset, nameOnly: __same(r, syn.r) && syn.walked.size === 0 });
		return r;
	};

// 文字列と数だけを行に残す。節点が紛れ込んでも行が膨らまないように印へ潰す。
const __arg = (v) => (v === undefined ? null : v !== null && typeof v === "object" ? "(obj)" : v);

/** `alignUp` / `bareName` / `addressWithoutArrow` / `packSlots` / `packNamed`。引数（と並び）を残す。 */
const __plain = (name, fn) =>
	function (...a) {
		const r = fn.apply(this, a);
		if (__quiet) return r;
		if (name === "packSlots") {
			const [, conf, kind] = a;
			const c = __cf(conf);
			// 並べた後のスロットから幅と境界を取る（詰めた順）。オフセットと全体は門が JS から出し直す。
			// ここで残すのは、畳むときに「詰め物が入ったか」「末尾を切り上げたか」を見るためである。
			__put(
				r
					? { fn: name, kind: kind ?? null, target: c.target, charset: c.charset, cells: r.slots.map((s) => [s.size, s.align]), offsets: r.slots.map((s) => s.offset), size: r.size }
					: { fn: name, kind: kind ?? null, target: c.target, charset: c.charset, cells: null },
			);
		} else if (name === "packNamed") {
			// 並べ替えは entries をその場で書き換えるので、呼んだ後の並びが「並べた後」である。
			if (Array.isArray(a[0])) __put({ fn: name, names: a[0].map((e) => __arg(e && e.name)) });
		} else {
			__put({ fn: name, args: a.map(__arg) });
		}
		return r;
	};

/**
 * 構文木を歩く関数。いちばん内側の問いの枠に印を付ける。
 *
 * `measureImplicit` は要素型を読むときだけ印を付ける（要素型が無ければ `{ptr}` の1本で、
 * 型の名前だけで決まる）。呼ばれた回数は `listItems` / `cursorParts` 以外を数える——
 * その2つは中の道具で、問いとして外から立つことが無い。
 */
const __walk = (name, fn) =>
	function (...a) {
		// 印は合成の問いの中でも付ける（`__probe` がそれを見る）。数えるのは本物の呼び出しだけ。
		if (name !== "measureImplicit" || (a[0] && a[0].elementType)) __charge(name);
		if (!__quiet && name !== "listItems" && name !== "cursorParts") __put({ fn: name });
		return fn.apply(this, a);
	};

/** 名前では答えられない問い（器の形を訊く）。回数だけ数える。 */
const __count = (name, fn) =>
	function (...a) {
		if (!__quiet) __put({ fn: name });
		return fn.apply(this, a);
	};

const __TRACE_ID = (globalThis.__LAYOUT_TRACE_N = (globalThis.__LAYOUT_TRACE_N || 0) + 1);
globalThis.__LAYOUT_TRACE = {
	meta: { layoutSha: __LAYOUT_SHA, argv1: process.argv[1] || null, pid: process.pid },
	rows() {
		return [...__seen].map(([k, n]) => ({ ...JSON.parse(k), cnt: n }));
	},
};

// **一式を走らせるときは、プロセスが終わるときに書く。** テストはそれぞれ別のプロセス
// （`test/run.js` が1本ずつ起こす）なので、プロセスごとに1枚になる。
// 同じプロセスで layout.js が2度読まれても上書きしないよう、通し番号を名前に入れる。
if (process.env.LAYOUT_TRACE_DIR) {
	process.on("exit", () => {
		try {
			const dir = process.env.LAYOUT_TRACE_DIR;
			__fs.mkdirSync(dir, { recursive: true });
			const base = __path.basename(process.argv[1] || "unknown");
			const file = __path.join(dir, `${base}.${process.pid}.${__TRACE_ID}.json`);
			__fs.writeFileSync(file, JSON.stringify({ meta: globalThis.__LAYOUT_TRACE.meta, rows: globalThis.__LAYOUT_TRACE.rows() }));
		} catch {
			// 記録できなくても検査は落とさない（落とすと一式の結果が記録の都合で変わる）。
		}
	});
}
