/**
 * `alpha/sign/` に置いた「Sign 自身で書いたプログラム」の動作確認。
 *
 * 処理系の単体テストと違い、こちらは**まとまった量の実プログラム**が壊れていないかを見る。
 * 8-Queens（documents/ja-jp/guide/examples/n_queens.sn）と同じ役割で、
 * 個別機能のテストでは拾えない相互作用の回帰を検出することを狙っている。
 *
 * 実際、この2本を書く過程で pass2.js の余積解決のバグが1件見つかった
 * （`isListLike` が中身を見ずに括弧を全て List 扱いし、`` `x` (`y`) `` が
 * construct ではなく push へ落ちて String の連結が起きなかった）。
 *
 * 実行: node test/sign_programs.test.js
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";
import { evaluate, newRuntimeEnv, UNIT, isUnit, observe } from "../interpreter.js";
import { generateAsm } from "../pass4.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const grammar = fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8");
const parser = peggy.generate(grammar);
const signDir = path.join(__dirname, "..", "..", "sign");

// **インポートを解く手段は呼ぶ側が渡す**（build_system.md §4.2——`compile.js` は fs に
// 触らない。playground でも同じ道が通る必要があるため）。`parser.sn` が演算子表を
// 読むようになったので、ここでも渡す。
const readImport = (p) => fs.readFileSync(path.join(signDir, p), "utf8").replace(/\r\n/g, "\n");

// .sn ファイルを読んで実行し、最後の行の評価結果を返す。
function runFile(name) {
	const source = fs.readFileSync(path.join(signDir, name), "utf8");
	const { nodes } = compile(source, { parse: parser.parse, readImport });
	const env = newRuntimeEnv(null);
	let result = UNIT;
	for (const node of nodes) result = observe(evaluate(node, env));
	return result;
}

// ファイル本体（最終行の実行例）を差し替えて、別の入力で評価する。
function runWith(name, lastLine) {
	const source = fs.readFileSync(path.join(signDir, name), "utf8");
	const body = source.split("\n").filter((l) => l.trim() !== "");
	body[body.length - 1] = lastLine;
	const { nodes } = compile(body.join("\n"), { parse: parser.parse, readImport });
	const env = newRuntimeEnv(null);
	let result = UNIT;
	for (const node of nodes) result = observe(evaluate(node, env));
	return result;
}

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
		console.log(`     got: ${JSON.stringify(got)}, want: ${JSON.stringify(want)}`);
	}
}

// ---- lexer.sn ----
// **語 ＝ 次の空白まで。** ただし文字列の中と括りの中の空白は数えない。
//
// Sign は中置演算子を必ず空白で区切る（`operator_table.md` の基本原則「全ての空白を余積
// 演算子と見なせる」）ので、文字クラスの最長一致は要らない——`is_digit` も `<=` も `!==` も、
// 空白に挟まれて最初から1語である。**空白で割ることが、余積の項を取り出すことそのもの**。
//
// だから `bar42` は切らない。以前は数字と英字を別クラスとして `bar` / `42` に割っていたが、
// それは**字句解析器が文法より細かく切っていた**ということで、識別子が壊れる。
//
// 括りは中へ降りずに丸ごと1語で返す。中身を字句へ投げ返すのは構文解析の仕事で、そこで
// 相互再帰する（**相互再帰は余積の入れ子そのもの**）。文字列だけは中を保護して二度と掛けない。
// **トークン列は平坦である。** カンマ（直積）で積むが、再帰の結果に後置 `~` を付けて
// 「相手のスロットを並べる」ので、段は残らない（余積の `~` との双対）。
//
// **型の上では cons、表現は平坦な配列**である（原理8：同型は型では無償、表現では有償）。
// 終端は `__` が signal し、直積の Unit は恒等射なので（`A × __ ≅ A`）末尾にスロットは
// 生まれない。
//
// 以前ここは入れ子（`["foo",["123",…]]`）を期待値に焼き込んでいた。検査の名前は
// 「5トークンへ分割する」と言っているのに、**期待値の方が段の深さを固定していた**
// ——`~` が無いと段が深くなり、大きさが静的に決まらず機械語にできない。
check(
	"lexer.sn: `foo 123 + bar42` を4語へ分割する",
	runFile("lexer.sn"),
	["foo", "123", "+", "bar42"]
);

check(
	"lexer.sn: 識別子は数字を含んでも1語（bar42 を切らない）",
	runWith("lexer.sn", "tokens `bar42`"),
	["bar42"]
);

check("lexer.sn: 空文字列 → __", isUnit(runWith("lexer.sn", "tokens ``")), true);

check(
	"lexer.sn: 連続する空白を読み飛ばす",
	runWith("lexer.sn", "tokens `a   b`"),
	["a", "b"]
);

// 文字リテラルは直後の1バイトをそのまま取るため、空白・タブ・改行が同じ形で書ける
// （`\n` のようなエスケープシーケンスは存在しない）。lexer.sn の is_space はこの3種を見る。
const TAB = String.fromCharCode(9);
check(
	"lexer.sn: タブ区切りも空白として扱う",
	runWith("lexer.sn", "tokens `a" + TAB + "b`"),
	["a", "b"]
);
check("lexer.sn: is_space がタブに真を返す", runWith("lexer.sn", "is_space tab"), TAB);
check("lexer.sn: is_space が改行に真を返す", runWith("lexer.sn", "is_space newline"), "\n");
check("lexer.sn: is_space は通常文字に __ を返す", isUnit(runWith("lexer.sn", "is_space \\a")), true);

// ---- 字句解析器は、自分のソースを自分で割れる ----
//
// **語 ＝ 次の空白まで。ただし文字列の中と括りの中の空白は数えない。** その規則を JS でも
// 書いて、`lexer.sn` の各行で突き合わせる——**同じ規則の独立した2つの実装**であり、
// 期待値を書き置くのではなく、そのつど導く（書き置いた証人は腐る）。
//
// 括りが1語のまま返るのが要点である。`(s ' 0)` を `(s` / `'` / `0)` に割らないのは、
// **括りの中の空白は次の段の余積**だからで、中身を字句へ投げ返すのは構文解析の仕事になる。
//
// バッククォートを含む行は除く——この検査自身が行を Sign の文字列リテラルへ包むので、
// 中の `` ` `` が閉じてしまう（字句の側の問題ではない）。
{
	const BS = String.fromCharCode(92);
	const TB = String.fromCharCode(9);
	const BQ = String.fromCharCode(96);
	const raw = fs.readFileSync(path.join(signDir, "lexer.sn"), "utf8").replace(/\r\n/g, "\n");
	const body = raw.split("\n").filter((l) => !l.startsWith("tokens " + BQ)).join("\n");
	// 同じ規則の、もう一つの実装。
	const words = (s) => {
		const out = [];
		let cur = "";
		let d = 0;
		for (let i = 0; i < s.length; i++) {
			const ch = s[i];
			if (ch === BS) {
				cur += ch + (s[i + 1] || "");
				i++;
				continue;
			}
			if ("([{".includes(ch)) d++;
			if (")]}".includes(ch)) d--;
			if (d === 0 && (ch === " " || ch === TB)) {
				if (cur) out.push(cur);
				cur = "";
				continue;
			}
			cur += ch;
		}
		if (cur) out.push(cur);
		return out;
	};
	const run = (line) => {
		const { nodes } = compile(body + "\ntokens " + BQ + line + BQ, { parse: parser.parse, readImport });
		const env = newRuntimeEnv(null);
		let r = UNIT;
		for (const node of nodes) r = evaluate(node, env);
		const o = observe(r);
		return (Array.isArray(o) ? o : o === undefined || o === null ? [] : [o]).map(String);
	};
	let lines = 0;
	let toks = 0;
	let bad = 0;
	for (const line of raw.split("\n")) {
		const s = line.replace(/\r/g, "");
		if (!s.trim() || s.includes(BQ)) continue;
		lines++;
		const got = run(s);
		toks += got.length;
		if (JSON.stringify(got) !== JSON.stringify(words(s))) {
			bad++;
			console.log(`     ${JSON.stringify(s)}`);
			console.log(`       got: ${JSON.stringify(got)}`);
			console.log(`      want: ${JSON.stringify(words(s))}`);
		}
	}
	check("lexer.sn: 自分のソースの全行を語に割る（食い違い 0）", bad, 0);
	// **前提も見る。** 行が拾えていなければ比較は1度も走らず、緑は何も意味しない。
	check("lexer.sn: 語に割った行数と語数（前提）", lines >= 40 && toks >= 180, true);
}

// ---- parser.sn ----
//
// **パース結果は構文木で、.ms の形で書き出す。** `1 + 2 * 3` は
//
//     ast : [
//     op : `+`
//     l : 1
//     r : [
//     op : `*`
//     l : 2
//     r : 3
//     ]
//     ]
//
// になる。.ms は Sign の積の記法をそのままデータに使う形式で（option_ms_schema.md）、木は
// 走らせるものではなく読むものである。入れ子は字下げではなく括りで書く——字下げは各行が深さ
// ぶんのタブを持つので出力が入力の二乗で伸び、機械は線形の上界しか言えないので置き場所が
// 取れない。括りなら1つの節が足すのは定数である。
//
// 以前は前置（S式）で書き出し、出したものを走らせて中置と同じ値かを見ていた。S式のままでは
// 定義とラムダの特例（`:` の外括りを外す、`?` の仮引数を並べる）が積み重なったので、木を
// データで出すことにした（利用者の裁定 2026-09-22）。検査は**pass2 の木と突き合わせる**
// ——同じ入力を読む2つの前段が同じ木を出すことが、parser.sn が正しいことの定義である。
function astText(lastLine) {
	return runWith("parser.sn", lastLine);
}
function evalSign(src) {
	const { nodes } = compile(src, { parse: parser.parse });
	const env = newRuntimeEnv(null);
	let result = UNIT;
	for (const node of nodes) result = observe(evaluate(node, env));
	return result;
}

// **木を同じ形に均す。** pass2 の木と parser.sn の木は、書き方の違うところが3つある:
//
//   並置          pass2 は型とアリティで解いた節（apply・construct…）、parser.sn は「隣り合っている」
//                 という事実だけ——どちらも平らな連なりへ均す（同じ段の中の結び方は Sign の仕事）
//   連鎖比較      pass2 は1つの節（L C R）、parser.sn は同じ段の入れ子——左へ入れ子の二項へ均す
//   中置 `@`      pass2 は `'` の左右を入れ替えた形へ均してある——parser.sn の側を同じく入れ替える
//
// 葉（字句の1語）は pass2 に読ませて同じ規則で均す。ラムダの仮引数は、並べた名前と括りの分解を
// 仮引数の形のまま比べる。
const J = " ";
const bareOf = (v) => String(v).replace(/^<|>$/g, "");
const rightNest = (xs) => (xs.length === 1 ? xs[0] : { op: J, l: xs[0], r: rightNest(xs.slice(1)) });
const isJuxt = (n) => n && n.type === "operation" && n.op === J && n.position === "infix";
const flatJuxt = (n, out) => { if (isJuxt(n)) { flatJuxt(n.left, out); flatJuxt(n.right, out); } else out.push(n); return out; };
const restParam = (name) => ({ prefix: "~", x: { a: "identifier", v: name } });
function canon(n) {
	if (n === null || n === undefined) return null;
	if (n.type === "atom") return { a: n.kind, v: n.value };
	if (n.type === "params") {
		const es = n.entries || [];
		if (n.bracket) return { params: "bracket", names: es.map((e) => (e.rest ? "~" : "") + bareOf(e.name)) };
		const one = (e) => (e.pattern
			? { params: "bracket", names: e.pattern.map((p) => (p.rest ? "~" : "") + bareOf(p.name)) }
			: e.rest ? restParam(e.name) : { a: "identifier", v: e.name });
		return rightNest(es.map(one));
	}
	if (n.type === "block") return { blk: n.kind, lines: (n.lines || []).map(canon) };
	if (n.type === "operation") {
		if (isJuxt(n)) return rightNest(flatJuxt(n, []).map(canon));
		if (n.name === "chain_compare") return { op: n.op, l: { op: n.op, l: canon(n.left), r: canon(n.middle) }, r: canon(n.right) };
		if (n.position === "prefix" || n.position === "postfix") return { [n.position]: n.op, x: canon(n.operand) };
		return { op: n.op, l: canon(n.left), r: canon(n.right) };
	}
	return { other: n.type };
}
// .ms を行で読む：`鍵 : 値`、`鍵 : [` で節が開き `]` の行で閉じる。値は字句のまま残す。
// 同じ欄が2つ・閉じない括り・余った行は読めないと言う（.ms は重複を先勝ちで黙って捨てるので、
// 本物の読み手に任せると壊れた出力が通ってしまう）。
function parseMs(text) {
	const lines = String(text).split("\n");
	let i = 0;
	const block = (top) => {
		const o = {};
		while (i < lines.length && lines[i] !== "]") {
			const body = lines[i];
			const m = body.indexOf(" : ");
			if (m < 0) throw new Error("欄の形でない: " + JSON.stringify(body));
			const key = body.slice(0, m);
			const rest = body.slice(m + 3);
			i++;
			if (key in o) throw new Error("同じ欄が2つ: " + key);
			if (rest === "[") {
				o[key] = block(false);
				if (lines[i] !== "]") throw new Error("括りが閉じていない");
				i++;
			} else o[key] = { leaf: rest };
		}
		if (top && i !== lines.length) throw new Error("余った行（" + (i + 1) + " 行目）");
		return o;
	};
	return block(true);
}
function leafCanon(text, paramSide) {
	const n = compile(text, { parse: parser.parse }).nodes[0];
	if (paramSide && n && n.type === "block") {
		const ln = n.lines && n.lines[0];
		const nm = (x) => (x.type === "operation" && x.position === "prefix" && x.op === "~" ? "~" + bareOf(x.operand.value) : bareOf(x.value));
		return { params: "bracket", names: ln ? flatJuxt(ln, []).map(nm) : [] };
	}
	if (paramSide && n && n.type === "operation" && n.position === "prefix" && n.op === "~") return restParam(n.operand.value);
	return canon(n);
}
function fromMs(v, paramSide) {
	if (v && "leaf" in v) return leafCanon(v.leaf, paramSide);
	const op = v.op && v.op.leaf ? v.op.leaf.replace(/^`|`$/g, "") : "?op?";
	const l = fromMs(v.l, op === "?" || (paramSide && op === J));
	const r = fromMs(v.r, paramSide && op === J);
	return op === "@" ? { op: "'", l: r, r: l } : { op, l, r };
}
{
	const BQ = String.fromCharCode(96);
	const TB = String.fromCharCode(9);
	const noExample = (name, re) => fs.readFileSync(path.join(signDir, name), "utf8").replace(/\r\n/g, "\n").split("\n").filter((l) => !re.test(l)).join("\n");
	const CHAIN = noExample("lexer.sn", new RegExp("^tokens " + BQ)) + "\n" + noExample("parser.sn", /^expr \[/) + "\n";
	const textOf = (line) => {
		const { nodes } = compile(CHAIN + "expr (tokens " + BQ + line + BQ + ")", { parse: parser.parse, readImport });
		const env = newRuntimeEnv(null);
		let r = UNIT;
		for (const node of nodes) r = evaluate(node, env);
		return isUnit(r) ? null : observe(r);
	};
	const astOf = (line) => {
		const text = textOf(line);
		if (text === null) return "__";
		const t = parseMs(text);
		return t.ast ? fromMs(t.ast, false) : "ast の欄が無い";
	};
	// pass2 の木。単独で読めない行（match の枝）は関数の本体の枝として読む。
	const pass2Of = (line) => {
		try { return canon(compile(line, { parse: parser.parse }).nodes[0]); } catch {}
		try {
			const n = compile("_ctx : _v ?\n" + TB + line + "\n" + TB + "__", { parse: parser.parse }).nodes[0];
			return canon(n.right.right.lines[0]);
		} catch { return null; }
	};
	const same = (note, line) => check(note, JSON.stringify(astOf(line)), JSON.stringify(pass2Of(line)));

	check("parser.sn: 1 + 2 * 3 を .ms の木で書く", runFile("parser.sn"), "ast : [\nop : `+`\nl : 1\nr : [\nop : `*`\nl : 2\nr : 3\n]\n]");
	check("parser.sn: 1語は葉そのもの", astText("expr [`7`]"), "ast : 7");
	same("parser.sn = pass2: 1 * 2 + 3", "1 * 2 + 3");
	same("parser.sn = pass2: 1 - 2 - 3（左結合）", "1 - 2 - 3");
	same("parser.sn = pass2: 1 + 2 * 3 - 4", "1 + 2 * 3 - 4");
	same("parser.sn = pass2: 2 ^ 3 ^ 2（右結合）", "2 ^ 3 ^ 2");
	same("parser.sn = pass2: a , b , c（右結合）", "a , b , c");
	same("parser.sn = pass2: 3 < 5 < 7（連鎖比較）", "3 < 5 < 7");
	same("parser.sn = pass2: 1 ~+ 2 ~ 10（範囲の連なり）", "1 ~+ 2 ~ 10");
	same("parser.sn = pass2: xs ' 0 ' 1", "xs ' 0 ' 1");
	same("parser.sn = pass2: a @ b @ c", "a @ b @ c");
	same("parser.sn = pass2: 前置と後置 !x & y", "!x & y");
	same("parser.sn = pass2: a | b & c", "a | b & c");

	// **並置は綴りを持たない段である。** 適用・連接・合成はどれも「間に何も無いこと」が演算子で
	// （表の 10.0〜10.5）、表は綴りを鍵に引くので、この段だけは引けない。段は 11 で**算術より弱い**
	// ——`1 + f 1` は `(1 + f) 1`。同じ段の中の結び方（`f x y` が `(f x) y` か、`1 2 3` が `[1 2 3]`
	// か）は Sign が型とアリティで決めるので、木は連なりをそのまま渡す（op は空白1つ）。
	same("parser.sn = pass2: 適用 f 1", "f 1");
	same("parser.sn = pass2: 連なり h 5 2", "h 5 2");
	same("parser.sn = pass2: 値の並置 1 2 3", "1 2 3");
	same("parser.sn = pass2: 算術は並置より強い f 1 + 1", "f 1 + 1");
	same("parser.sn = pass2: 括りは1語のまま葉になる", "f (h 5 2)");

	// **定義とラムダもただの節である。** S式のときに要った特例は、木を走らせないので要らない。
	// 仮引数の並び `x y` は並置の節に、`[x y]` は葉になって区別できる。
	same("parser.sn = pass2: 定義 x : 20", "x : 20");
	same("parser.sn = pass2: 2引数のラムダ", "f : x y ? x - y");
	same("parser.sn = pass2: 器1つの仮引数", "f : [x y] ? x - y");
	same("parser.sn = pass2: 残りの仮引数", "f : x ~xs ? ||xs||");
	same("parser.sn = pass2: 括りと裸の混ざった仮引数", "f : [~ts] k ? k");
	same("parser.sn = pass2: 文字の定義", "c : \\a");

	// **自分のソースを読む。** lexer.sn と parser.sn の行のうち pass2 が1行で読めるもの（本体の枝は
	// 関数の枝として読む）を全部突き合わせる。書き置いた期待値ではなく、そのつど pass2 に訊く。
	// バッククォートを含む行は除く——この検査自身が行を文字列へ包むので閉じてしまう。
	let compared = 0;
	let bad = 0;
	for (const name of ["lexer.sn", "parser.sn"]) {
		for (const raw of fs.readFileSync(path.join(signDir, name), "utf8").split(/\r?\n/)) {
			const line = raw.replace(/^\t+/, "");
			if (!line.trim() || line.includes(BQ)) continue;
			const ref = pass2Of(line);
			if (ref === null) continue; // 仮引数だけの頭の行（`f : [~s] ?`）は1行では式にならない
			compared++;
			const got = astOf(line);
			if (JSON.stringify(got) !== JSON.stringify(ref)) {
				bad++;
				console.log(`     ${name}: ${JSON.stringify(line)}\n       got:  ${JSON.stringify(got)}\n       want: ${JSON.stringify(ref)}`);
			}
		}
	}
	check("parser.sn = pass2: 自分のソースの行を全部（食い違い 0）", bad, 0);
	// **前提も見る。** 比べた行が少なければ、緑は何も言っていない。
	check("parser.sn = pass2: 比べた行数（前提）", compared >= 70, true);

	// **本物の .ms の読み手でも同じ形。** 括りのブロックは字下げのブロックと同じ define の並びとして
	// 読まれる（option_ms.js の toTree と同じ規則で、節は op・l・r の3つの欄）。
	const shapeOf = (nodes) => {
		const o = {};
		for (const n of nodes) {
			if (!n || n.type !== "operation" || n.name !== "define" || !n.left || n.left.type !== "atom") continue;
			const rhs = n.right;
			const isNode = rhs && rhs.type === "block" && (rhs.lines || []).some((l) => l && l.name === "define");
			o[bareOf(n.left.value)] = isNode ? shapeOf(rhs.lines) : "葉";
		}
		return o;
	};
	const shapeMs = (t) => { const o = {}; for (const [k, v] of Object.entries(t)) o[k] = "leaf" in v ? "葉" : shapeMs(v); return o; };
	for (const line of ["1 + 2 * 3", "f : x y ? x - y", "h 5 2", "3 < 5 < 7"]) {
		const text = textOf(line);
		check(`parser.sn: 本物の .ms の読み手でも同じ形（${line}）`, JSON.stringify(shapeOf(compile(text, { parse: parser.parse }).nodes)), JSON.stringify(shapeMs(parseMs(text))));
	}

	// **止まること、読めない演算子を項にしないこと。**
	//
	// 末尾が演算子（`1 +`・`a :`）だと、並置の段が長さを跨いで回り続けていた（両エンジンとも
	// 停止しない）。演算子の字だけでできた語（`===`・`!`・`><`）は、表に中置として無ければ読めない
	// 演算子であって項ではない——項として数えると誤った木が黙って出た。
	check("parser.sn: 末尾の演算子で止まる 1 +", isUnit(astText("expr [`1` , `+`]")), true);
	check("parser.sn: 廃止された綴りを項にしない 1 === 2", isUnit(astText("expr [`1` , `===` , `2`]")), true);
	check("parser.sn: 前置だけの ! を項にしない a ! b", isUnit(astText("expr [`a` , `!` , `b`]")), true);

	// **結合の向きが違う演算子を、括らずに1つの連なりへ混ぜない。** 同じ段で向きが割れているのは
	// get の `'`（左）と `@`（右）だけで、`s @ r ' t` は `(s @ r) ' t` とも `s @ (r ' t)` とも
	// 読める。pass2 は名指しで断る（`assoc.test.js`）。parser.sn は向きが変わった所で連なりを止め、
	// 入口の長さの検査が `__` を返す——知らない綴りを断るのと同じ道である。
	check("parser.sn: 向きの違う get を混ぜない s @ r ' t", isUnit(astText("expr [`s` , `@` , `r` , `'` , `t`]")), true);
	check("parser.sn: 向きの違う get を混ぜない s ' r @ t", isUnit(astText("expr [`s` , `'` , `r` , `@` , `t`]")), true);
	same("parser.sn = pass2: 弱い段で切れていれば混在ではない", "a ' b + c @ d");
	same("parser.sn = pass2: 並置で切れていれば混在ではない", "f 0 @ l l ' 2");
	check("parser.sn: 並置の中でも1つの連なりなら混ぜない", isUnit(astText("expr [`g` , `0` , `@` , `m` , `'` , `1`]")), true);
}

// **`[[op] L R]` ≡ `L op R`——区間は位置で被演算子を取る。**
//
// S式が構文木の表現であることの根拠で（利用者の裁定 2026-09-22）、parser.sn が .ms の木を
// 出すようになった今も pass2 の規則として残る。以前は両辺が値のときだけ成り立ち、片方が
// 関数だと割れていた:
//
//     1 + d      = __     中置：算術の相手が `Lambda` なので零射（表の ※1）
//     [[+] 1 d]  = 10     器の中で `1 d` が先に逆適用へ解決されてから畳まれていた
//
// 区間 `[op]` にアリティが無く、被演算子どうしが**型で**先に結び付いていたのが根だった。
// Lisp の `(+ 1 d)` と同じく、頭の区間が連なりの残りを**位置で**取るようにした（pass2 の
// `foldHeadSections`）。`[:]` と `[?]` も同じ木——`[:] f [?] y [*] y y` は `f : y ? y * y`
// （`kan_extensions.md` §3.7）で、こちらは字句の段で中置へ脱糖する（`desugarSections`）。
//
// 壊してはいけない読みも並べる：被演算子が1つなら器の要素を歩く／区間どうしは合成が先。
{
	const D = "d : x ? x * 10\n";
	const show = (src) => { const v = evalSign(src); return isUnit(v) ? "__" : Array.isArray(v) ? JSON.stringify(v) : String(v); };
	check("中置と区間：両辺が値なら同じ", [show("1 + 2"), show("[[+] 1 2]")], ["3", "3"]);
	check("中置と区間：`__` でも同じ", [show("1 + __"), show("[[+] 1 __]")], ["1", "1"]);
	check("中置と区間：片方が関数でも同じ（以前は 10 に割れていた）", [show(D + "1 + d"), show(D + "[[+] 1 d]")], ["__", "__"]);
	check("区間：被演算子が1つなら器の要素を歩く", show("[+] [1 2 3]"), "6");
	check("区間：区間どうしは合成が先（写像と畳み込み）", show("[* 2,] [+] 1 2 3 4 5"), "30");
	// **3項からも同じ木。** 畳む向きは表が言い（右結合は右から）、比較の3項は連鎖比較である。
	// 左畳みで決め打ちしていたので `[^] 2 3 2` が 64、`[<] 5 7 10` が 5 と、中置から割れていた。
	const M = "m : [10 20] , [30 40]\n";
	const both = (note, sec, inf, pre = "") => check(note, show(pre + sec), show(pre + inf));
	both("区間：右結合は右から畳む（冪）", "[^] 2 3 2", "2 ^ 3 ^ 2");
	both("区間：右結合は右から畳む（積）", "[,] 1 2 3", "1 , 2 , 3");
	both("区間：右結合は右から畳む（get の @）", "[@] 0 1 m", "0 @ 1 @ m", M);
	both("区間：左結合は左から畳む", "[-] 10 3 2", "10 - 3 - 2");
	both("区間：比較の3項は連鎖比較（中央が返る）", "[<] 5 7 10", "5 < 7 < 10");
	both("区間：比較の3項は連鎖比較（偽）", "[<] 0 5 3", "0 < 5 < 3");
	const why = (src) => { try { evalSign(src); return "通った"; } catch (e) { return e.message; } };
	check("区間：推移的でない比較は中置と同じく断る", why("[!=] 1 2 3"), why("1 != 2 != 3"));
	check("区間：4項の比較は中置と同じく断る", why("[<] 1 2 3 4"), why("1 < 2 < 3 < 4"));

	// `[:]` と `[?]`。中置の同じ形と、使い方（部分適用まで）ごとに値が同じであること。
	const same = (note, sec, inf, use) => check(note, show(sec + "\n" + use), show(inf + "\n" + use));
	same("[:] x 20 は x : 20", "[:] x 20", "x : 20", "x");
	same("[:] f [?] y [*] y y は f : y ? y * y（仕様の例）", "[:] f [?] y [*] y y", "f : y ? y * y", "f 7");
	same("[?] x y B は2引数（部分適用）", "f : [?] x y (x - y)", "f : x y ? x - y", "g : f 10\ng 3");
	same("[?] [x y] B は器1つ（部分適用）", "f : [?] [x y] (x - y)", "f : [x y] ? x - y", "g : f 10\ng 3");
	same("[:] の右辺のラムダ", "[:] f ([?] x (x + 1))", "f : x ? x + 1", "f 5");
}

// ---- 8-Queens（guide の例） ----
//
// **結果を固定していなかったので、壊れても気付けなかった。** 実際に一度壊した
// ——余積の規則を直したとき `(col board)` が「盤を1要素として足す」になり、答えが
// `[3 [1 [3 [1 …]]]]` という入れ子になった。テストが無ければ通ってしまう類の壊れ方で、
// 診断も出ない。処理系の単体テストでは拾えない相互作用そのものである。
{
	const p = path.join(__dirname, "..", "..", "..", "documents", "ja-jp", "guide", "examples", "n-queen");
	const runFile = (name) => {
		const source = fs.readFileSync(path.join(p, name), "utf8");
		const { nodes } = compile(source, { parse: parser.parse });
		const env = newRuntimeEnv(null);
		let result = UNIT;
		for (const node of nodes) result = observe(evaluate(node, env));
		return result;
	};
	check("n_queens.sn → 8クイーンの解", runFile("n_queens.sn"), [4, 2, 7, 3, 6, 8, 5, 1]);
	// コメントを落とした版も同じ答えを出す（コメントは命令を出さない）。
	check("コメント除去版も同じ解", runFile("n_queens.nocomment.sn"), [4, 2, 7, 3, 6, 8, 5, 1]);
}

// ---- Pass 3 の型の不動点は上限まで回らない ----
//
// 旗（「この周で書き換えた」）で回していた頃は、状態が数周で止まった後も2つの集め方が同じ欄を
// 書き換え合って旗が立ち続け、3本とも毎回上限（定義の数 + 2）まで回っていた。値は変わらないので
// 他の検査では見えず、ビルドの時間だけが入力に対して急に伸びる（自己ホストの規模では終わらない）。
//
// **2周期でも止まらない。** 2つの状態を行き来する不動点は、上限の周の位相で止めている。上限は
// 「定義の数 + 2」なので、どちらの状態が残るかは**行の数の偶奇**で決まり、根拠が無い。実測で
// `target_info.sn` を取り込んで `size_of` を呼ぶ形が、使わない行を1行足すかどうかで通る／断るを
// 行き来した（範囲の端点の規則が、`x ' k~` を均した `k ~+ 1` の合成の `1` を証拠に数えていた）。
// 前は parser.sn にも2周期（`end_of` / `end_at`）が居た。今はどの枚でも起きないことを見る。
for (const name of ["lexer.sn", "parser.sn", "preprocess.sn", "target_info.sn", "emit.sn", "operator_table.sn"]) {
	const fixpointStats = [];
	compile(fs.readFileSync(path.join(signDir, name), "utf8"), { parse: parser.parse, readImport, fixpointStats });
	check(`${name}: 型の不動点はどの回も上限の前で止まる`, fixpointStats.length > 0 && fixpointStats.every((s) => s.rounds < s.limit), true);
	check(`${name}: 型の不動点は2周期で止まらない`, fixpointStats.filter((s) => s.cycled).length, 0);
}
// **行の数の偶奇で答えが変わらない。** 使わない定義を 0〜3 本足しても、診断も値も同じであること。
{
	const body = "`target_info.sn`@~\ndrive 0\n\nrse : ty el tg ?\n\t!(size_of el tg) : __\n\t3 * (size_of el tg)\n\ncs2 : ty tg ? size_of ty tg\n";
	const results = [0, 1, 2, 3].map((pad) => {
		const src = body + Array.from({ length: pad }, (_, k) => `zz${k} : ${k}\n`).join("") + "rse `List` `Int` `aarch64_qemu`\n";
		const { nodes, env } = compile(src, { readImport });
		const r = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii", layer: 1 });
		return r.diagnostics.map((d) => d.message.slice(0, 30)).join(" / ") || "診断なし";
	});
	check("使わない行を足しても断りが出たり消えたりしない（0〜3 本）", results, ["診断なし", "診断なし", "診断なし", "診断なし"]);
}
// ---- emit.sn：後段を Sign で書く最初の1枚 ----
//
// 自己ホストの後段は「綴りを文字として書き出す」形で書く（idiom_to_instructions.md）。この1枚は
// その形を使い切っている——位置で歩く、出来た端から書き出す、表を実行時の鍵で引く、外れは `__` を
// `|` で受ける、駆動行が全部を呼ぶ。**機械が出せることが要点**なので、値ではなく診断と出方を見る。
// `blr` が 0 なのは、`$` が静的に解けて実行時の関数値が無いことの裏返しである。
{
	const source = fs.readFileSync(path.join(signDir, "emit.sn"), "utf8");
	const { nodes, env, diagnostics } = compile(source, { parse: parser.parse, readImport });
	check("emit.sn: 前段の診断が無い", diagnostics.length, 0);
	const asm = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii", layer: 1 });
	check("emit.sn: 機械の診断が無い", asm.diagnostics.length, 0);
	check("emit.sn: blr を出さない", (asm.text.match(/^\tblr/gm) || []).length, 0);
	// 命令数は後段を直せば動く。桁が変わったら（半分・倍）気づけるだけの幅で見る。
	const count = (asm.text.match(/^\t[a-z]/gm) || []).length;
	check("emit.sn: 命令数はこの桁（500〜700、いまは 576）", count > 500 && count < 700, true);
}

// ---- sret の計画は上界の不動点で止まる ----
//
// 計画は「載った名前の数」と `needsSlot` の旗が動かなくなったら止めていたので、上界そのものが
// まだ伸びている途中で止まっていた。parser.sn の輪は周ごとに 28 → 1792 と倍々で伸びており、
// 外側（`expr`）ほど1〜2周前の小さい値のまま残る。外側で包むと置き場所が足りず、容量の照合が
// 返す `__` が連結の中で吸われて、**機械は黙って短い綴りを返した**（AST 版で 30 文字が 6 文字）。
// S式の版は1節4文字なので、遅れた見積もりでも足りていて表に出なかった。
//
// もう1周回しても何も動かないこと（本当に不動点であること）、上限の前に止まること、外した
// 名前が無いことを見る。輪の上界は1つ——輪の全員が同じ係数を持つ（倍々の増え方は係数が割れる）。
for (const name of ["lexer.sn", "parser.sn", "preprocess.sn", "emit.sn"]) {
	const { nodes, env } = compile(fs.readFileSync(path.join(signDir, name), "utf8"), { readImport });
	const stats = [];
	generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii", layer: 1, sretPlanStats: stats });
	const st = stats[0];
	check(`${name}: sret の計画は上界の不動点で止まる`, !!st && st.stable && st.rounds < st.limit && st.banned.length === 0, true);
	if (name === "parser.sn" && st) {
		const ring = [...st.plan].filter(([k]) => /^out/.test(k)).map(([, v]) => v.terms.filter((t) => t.measure === "len").map((t) => t.coef).join("/"));
		check("parser.sn: 輪の上界は1つ（out の輪の全員が同じ係数）", ring.length > 1 && new Set(ring).size === 1, true);
	}
}
console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
