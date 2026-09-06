/**
 * ストリームを返す関数を、引ける規則へ均す糖衣（stream_desugar.js）。
 *
 * **見るのは「元の関数と同じ列になるか」だけ**である。生成したものが元と違う意味に
 * なっていても見た目では分からないので、期待値は書かず、元の関数をインタプリタで
 * 走らせた答えと突き合わせる。
 *
 * 実行: node test/stream_desugar.test.js
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile } from "../compile.js";
import { evaluate, newRuntimeEnv, UNIT, observe, isUnit } from "../interpreter.js";
import { findStreamFunctions, generatePullers, groupStreamFunctions, printNode, printParams } from "../stream_desugar.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = peggy.generate(fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8"));

let passed = 0;
let total = 0;

function check(note, got, want) {
	total++;
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (ok) passed++;
	console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
	if (!ok) {
		console.log(`     got:  ${JSON.stringify(got)}`);
		console.log(`     want: ${JSON.stringify(want)}`);
	}
}
function checkTrue(note, cond, extra) {
	check(note, !!cond, true);
	if (!cond && extra) console.log(`     ${extra}`);
}

function run(source) {
	const { nodes } = compile(source, { parse: parser.parse });
	const env = newRuntimeEnv(null);
	let r = UNIT;
	for (const node of nodes) r = evaluate(node, env);
	return isUnit(r) ? "__" : observe(r);
}
function streams(src) {
	return findStreamFunctions(compile(src, { charset: "ascii" }).nodes);
}

// ---- 何がストリームで、何がそうでないか ----
//
// 枝が「有限個の要素を並べて、最後に自分（か仲間）をもう一度呼ぶ」形をしているものだけ。
// 並べる要素が1つも無ければただの末尾呼び出しであって、状態機械の枝ではない。
check("1枝のストリーム", streams("dup : [c ~rest] ? c c (dup rest)").map((f) => [f.name, f.arms.length, f.arms[0].prefix.length]), [["dup", 1, 2]]);
check("多枝のストリーム", streams("sep : [c ~rest] ?\n\tc = 1 : c c (sep rest)\n\tc (sep rest)").map((f) => f.arms.map((a) => a.prefix.length)), [[2, 1]]);
check("相互再帰も群になる", streams("a : [c ~rest] ? c (b rest)\nb : [c ~rest] ? c c (a rest)").map((f) => f.name), ["a", "b"]);
check("ふつうの関数は違う", streams("f : n ? n + 1"), []);
check("末尾呼び出しだけは違う", streams("f : s ? g (s ' 1~)\ng : s ? f (s ' 1~)"), []);
check("畳み込みは違う", streams("fold : s a ? (fold (s ' 1~) (a + 1)) | a"), []);

// ---- 印字。糖衣だと言うからには目で読めなければならない ----
{
	const lam = compile("sep : [c ~rest] ?\n\tc = 1 : c (rest ' 0)\n\t!c & (c > 2) : c\n", { charset: "ascii" }).nodes[0].right;
	check("仮引数はブラケットごと", printParams(lam.left), "[c ~rest]");
	// ブラケットの有無で意味が変わる（1引数を分解する／先頭と可変長）ので、落としてはいけない。
	const bareLam = compile("f : c ~rest ? c", { charset: "ascii" }).nodes[0].right;
	check("裸の rest はブラケット無し", printParams(bareLam.left), "c ~rest");
	check("ガードも印字できる", printNode(lam.right.lines[1].left), "(!c & ((c > 2)))");
}

// ---- 生成物は元の列と一致する ----
//
// 消費側（`run`）は手で書く。カーソルは `(a, k, s)` の3つで、`a` が枝、`k` が枝の中の
// 位置、`s` が残りの入力である。要素はどこにも置かれない。
// 長さを数える消費側。
const RUN = (g) => `run : a k s acc ?\n\tk < (${g}_len a) : (run a (k + 1) s (acc + 1)) | acc\n\t(run (${g}_na a (${g}_nx a s)) 0 (${g}_nx a s) acc) | acc\n`;

// **中身も数える消費側。** `Char` に算術は無いので（仕様通り、算術は `__` へ落ちる）、
// 比較して `hit` で 1 を作る。`hit __` は完全性公理で `__` になり、`| 0` が受ける。
const RUN_CH = (g, ch) =>
	`hit : c ? 1\nrun : a k s acc ?\n\tk < (${g}_len a) : (run a (k + 1) s (acc + ((hit ((${g}_at a k s) = \`${ch}\`)) | 0))) | acc\n` +
	`\t(run (${g}_na a (${g}_nx a s)) 0 (${g}_nx a s) acc) | acc\n`;

/**
 * 元の関数が作る列と、生成した規則から引ける列が一致することを見る。
 *
 * 長さだけでは足りない——並べる要素を取り違えていても長さは合う。文字ごとの個数まで
 * 数えれば、どの枝がどの要素を出すかも見ていることになる。**期待値は書かない**：
 * 仕様の答えは元の関数が持っている。
 */
function sameStream(note, def, input) {
	const name = /^(\w+)/.exec(def)[1];
	const want = run(`${def}\n${name} ${input}\n`);
	const g = generatePullers(findStreamFunctions(compile(def, { charset: "ascii" }).nodes));
	if (!g) return checkTrue(note, false, "生成できなかった");
	if (typeof want !== "string") return checkTrue(note, false, `元が列にならない：${JSON.stringify(want)}`);
	// 糖衣なら元の定義は消える。生成した規則だけで同じ列が引けなければならない。
	const head = `run (${name}_arm ${input}) 0 ${input} 0\n`;
	const len = run(g.source + RUN(g.group) + head);
	const bad = [];
	if (len !== want.length) bad.push(`長さ ${want.length} → ${len}`);
	for (const ch of new Set([...want])) {
		const n = [...want].filter((x) => x === ch).length;
		const got = run(g.source + RUN_CH(g.group, ch) + head);
		if (got !== n) bad.push(`${ch} が ${n} → ${got}`);
	}
	checkTrue(note, bad.length === 0, `元=${JSON.stringify(want)}  ${bad.join(" / ")}`);
}
const sameLength = sameStream;
sameLength("そのまま流す", "id : [c ~rest] ? c (id rest)", "`abcde`");
sameLength("1つを2つにする", "dup : [c ~rest] ? c c (dup rest)", "`abc`");
sameLength("1つを3つにする", "tri : [c ~rest] ? c c c (tri rest)", "`ab`");
sameLength("入力を飛ばす", "sk : [c ~rest] ? c (sk (rest ' 1~))", "`abcdef`");
sameLength("枝で本数が変わる", "v : [c ~rest] ?\n\tc = `a` : c c (v rest)\n\tc (v rest)", "`abaca`");
sameLength("仲間へ移る", "p : [c ~rest] ?\n\tc = `\"` : c (q rest)\n\tc (p rest)\nq : [c ~rest] ?\n\tc = `\"` : c (p rest)\n\tc c (q rest)", '`ab"cd"ef`');
// **入力の連続した位置を並べる枝**（`sep` の形）。3文字を1つの要素として並べているが、
// それは入力のその3文字そのものなので、切り出し1つになる——確保は要らない。
sameStream("連続位置を切り出す", "w : [c ~rest] ?\n\tc = `-` : (c (rest ' 0) (rest ' 1)) (w (rest ' 2~))\n\tc (w rest)", "`ab-cdef`");
sameStream("2文字ぶんの切り出し", "w : [c ~rest] ?\n\tc = `-` : (c (rest ' 0)) (w (rest ' 1~))\n\tc (w rest)", "`a-bc-de`");

// ---- 実物を読めること ----
//
// `preprocess.sn` の `sep` / `in_quote` が本当に列を作っている2つで、`walk`（状態を
// 5つ持ち回る）や `preprocess`（ただの末尾呼び出し）はそうではない。
// ---- 均せない形は均さない ----
//
// **並べるものは1要素でなければならない。ただし入力の連続した位置なら切り出せる。**
//
// `space (c (rest ' 0) (rest ' 1)) space` の真ん中は1つの要素であって3つではない
// （`a (b c) d` は `["a","bc","d"]`——余積は「右辺を1要素として足す」）。平らにすると
// 答えが変わり、そのまま返すと複数文字の器をその場で作ることになる。**ところがその
// 3文字は入力のその3文字そのもの**なので、切り出し1つで書ける——確保は要らない。
// 分割代入を添字へ戻すと（`c` は `s ' 0`、`rest ' i` は `s ' (i+1)`）それが見える。
check("連続した位置なら均せる", streams("f : [c ~rest] ? c (c (rest ' 0)) c (f rest)").length, 1);
// 連続していなければ均さない（`(c c)` は 0 番目を2つ並べており、切り出しにならない）。
check("連続していなければ均さない", streams("f : [c ~rest] ? c (c c) c (f rest)"), []);
// **群は閉じていなければならない。** 枝が移る先が均されていなければ `_na` は存在しない
// 名前へ跳ぶ。片方だけ均すのは跳び先を失うことである。
{
	const half = "p : [c ~rest] ? c (q rest)\nq : [c ~rest] ? c (q (rest ' 1~)) (r rest)\nr : n ? n";
	checkTrue("閉じない群は生成しない", generatePullers(streams(half)) === null);
	const closed = "p : [c ~rest] ? c (q rest)\nq : [c ~rest] ? c c (p rest)";
	checkTrue("閉じた群は生成する", generatePullers(streams(closed)) !== null);
}

// ---- 終端の枝 ----
//
// 仲間を呼ばずに終わる枝は「そこで列が尽きる」であって、カーソルの尽きた状態そのもので
// ある。`__` を返す枝は要素を1つ並べるのではなく、並べずに終わる。
check("終端の枝を読む", streams("f : [c ~rest] ?\n\tc = `;` : __\n\tc (f rest)").map((x) => x.arms.map((a) => (a.call ? a.prefix.length + "→" + a.call.name : a.prefix.length + "→終端"))), [["0→終端", "1→f"]]);
check("終端が要素を並べる", streams("f : [c ~rest] ?\n\tc = `;` : c\n\tc c (f rest)").map((x) => x.arms.map((a) => a.prefix.length)), [[1, 2]]);
checkTrue("全部終端なら列ではない", streams("f : [c ~rest] ?\n\tc = `;` : c\n\tc").length === 0);

// **並べるものの中に仲間が隠れていてはいけない。**
//
// `delta : … 1 + (delta rest)` は列を作っているように見えるが、再帰の結果を**算術に
// 使って**いる——返すのは深さという1つの数であって列ではない。枝の末尾にある呼び出しだけを
// 見ていると、式に埋まった再帰を見落として**まったく別の意味へ均してしまう**。
// **仲間が隠れているかは、群が決まってから見る。** ファイル中の全定義を仲間と見なすと、
// `dedent` のような定数を並べているだけの枝まで弾いてしまう（実際に弾いていた）。
checkTrue("式に埋まった再帰は生成しない", generatePullers(streams("f : [c ~rest] ?\n\tc = `(` : 1 + (f rest)\n\tc (f rest)")) === null);
checkTrue("定数を並べる枝は生成する", generatePullers(streams("d : `x`\nf : [c ~rest] ?\n\tc = `;` : __\n\td (f rest)")) !== null);
// **空文字列は `__` と同型である**（`__ = []`）。「空を返して終わる」枝は終端である。
check("空文字列で終わる枝", streams("f : [c ~rest] ?\n\tc = `;` : ``\n\tc (f rest)").map((x) => x.arms.map((a) => a.prefix.length)), [[0, 1]]);
// 器が並ぶ形も入らない（個数が固定でない）。
check("器が並ぶ形は均さない", streams("f : [c ~rest] ?\n\tc = `;` : c rest\n\tc (f rest)"), []);

// ---- 群は呼び合う塊ごとに分ける ----
//
// `close_all` と `delta` は互いを呼ばないので別の群である。まとめると、片方が均せない
// ときに巻き添えになるし、引くたびに関係の無い枝まで比べることになる。
{
	const two = "a : [c ~rest] ?\n\tc = `;` : __\n\tc (a rest)\nb : [c ~rest] ?\n\tc = `.` : __\n\tc c (b rest)";
	const gs = groupStreamFunctions(streams(two));
	check("別々の群に分ける", gs.map((g) => g.map((f) => f.name)), [["a"], ["b"]]);
	const mutual = "p : [c ~rest] ? c (q rest)\nq : [c ~rest] ? c c (p rest)";
	check("呼び合う塊は1つの群", groupStreamFunctions(streams(mutual)).map((g) => g.map((f) => f.name)), [["p", "q"]]);
	const open = "p : [c ~rest] ? c (r rest)\nr : n ? n";
	check("閉じない群は落とす", groupStreamFunctions(streams(open)), []);
}

// ---- 実物を読めること ----
{
	const src = fs.readFileSync(path.join(__dirname, "..", "..", "sign", "preprocess.sn"), "utf8");
	const found = streams(src);
	// `sep` は枝の真ん中に構築があるので均せない。`in_quote` は均せるが枝が `sep` へ移る
	// ので群が閉じない。
	// `sep` の枝が並べる3文字は**入力のその3文字**なので切り出し1つで書ける。均せるように
	// なったので `in_quote` の群も閉じる（枝が `sep` へ移れる）。
	check("preprocess.sn のストリーム", found.map((f) => f.name).sort(), ["close_all", "closers", "delta", "head_line", "in_quote", "sep", "unwind"]);
	check("in_quote の枝の本数", found.find((f) => f.name === "in_quote").arms.map((a) => a.prefix.length), [1, 1, 1]);
	const groups = groupStreamFunctions(found);
	check("閉じた群だけ残る", groups.map((g) => g.map((f) => f.name)), [["sep", "in_quote"], ["delta"], ["head_line"], ["unwind"], ["closers"], ["close_all"]]);
	// 実際に均せるのは、状態が1つで、式に再帰が埋まっていないものだけ。
	const gen = (nm) => generatePullers(groups.find((g) => g[0].name === nm)) !== null;
	check("均せる群", groups.map((g) => g[0].name).filter(gen), ["sep", "head_line", "close_all"]);
	checkTrue("状態が2つならまだ均さない", !gen("unwind") && !gen("closers"));
	checkTrue("式に再帰が埋まっていたら均さない", !gen("delta"));
	// 状態が1つの器で表せない形（`walk`）はまだ均さない——カーソルが太る。
	checkTrue("walk は含まれない", !found.some((f) => f.name === "walk"));
}

// ---- カーソルを仮引数で受けるなら、群も一緒に運ぶ ----
//
// 引く命令がどこへ跳ぶか（`<群>_at` / `<群>_adv`）は群からしか決まらない。`repr` だけを
// 渡して群を落とすと、仮引数で受けたカーソルが「参照」に見えて `ptr` を値として読む
// ——**黙って違う値が出る**（実測で 97 のところに 0 が出ていた）。渡し方は群と一緒に運ぶ。
//
// `reprOfNode` は呼び出しの返値までは辿らないが、`cursorGroupOfNode` は辿る。群が
// 分かった時点で置かれ方も分かっているので、そこから読む。
{
	const look = (s, n) => { while (s) { const b = s.bindings instanceof Map ? s.bindings.get(n) : s.bindings[n]; if (b) return b; s = s.parent; } return null; };
	const clean = (s) => String(s).replace(/[<>]/g, "");
	const SRC = "dup : [c ~rest] ? c c (dup rest)\ntake : cur ? cur ' 0\ntake (dup `abc`)";
	const { nodes } = compile(SRC, { charset: "ascii", desugarStreams: true });
	const d = nodes.find((n) => n.name === "define" && clean(n.left.value) === "take" && !n.supersededByDesugar);
	const b = d ? look(d.right.scope, "<cur>") : null;
	check("カーソルの置かれ方が届く", b && b.repr, "cursor");
	check("カーソルの群も届く", b && b.cursorGroup, "dup");
}

// ---- 置き換えられた定義は呼び出しサイトではない ----
//
// 糖衣は同じ名前の定義を2つ作る（元のものと、器を引く形へ均したもの）。元の方は
// `supersededByDesugar` の印が付いていて命令にはならないが、型の証拠としては数えられて
// いた——**死んだ定義の中の呼び出しが、生きている関数の仮引数の型を決めていた**。
//
// 実害はこう出た。`sep : [c ~rest] ?` の `c` は `Char` だが、置き換えられた側の `c` は
// `String` のまま取り残される。そこの `infix1 c` が観測されるため `infix1` の仮引数が
// `String` になり、`ch = \:` が「String と Char の比較」になって出せなくなっていた。
{
	const look = (s, n) => { while (s) { const b = s.bindings instanceof Map ? s.bindings.get(n) : s.bindings[n]; if (b) return b; s = s.parent; } return null; };
	const clean = (s) => String(s).replace(/[<>]/g, "");
	// 器を1つ受けて頭を渡す形。糖衣が掛かっても、渡る先の仮引数は要素の型（`Char`）である。
	const SRC = "hit : ch ?\n\tch = \\a : ch\n\t__\ns : [c ~rest] ?\n\thit c : c (s rest)\n\tc (s rest)\nf : x ? s x\nf `abc`\n";
	for (const ds of [false, true]) {
		const { nodes } = compile(SRC, { charset: "ascii", desugarStreams: ds });
		const d = nodes.find((n) => n.name === "define" && clean(n.left.value) === "hit" && !n.supersededByDesugar);
		const b = d && d.right.name === "lambda" ? look(d.right.scope, "<ch>") : null;
		check(`糖衣${ds ? "あり" : "なし"}：頭は要素の型`, b && b.atomType, "Char");
	}
	// 置き換えられた定義そのものが残っていること（消さずに印だけ付ける設計）も確かめる
	// ——消してしまうと、どの定義が何に置き換わったのかが追えなくなる。
	{
		const { nodes } = compile(SRC, { charset: "ascii", desugarStreams: true });
		const dead = nodes.filter((n) => n && n.supersededByDesugar);
		checkTrue("置き換えられた定義は印が付いて残る", dead.length > 0, `印の付いた定義が ${dead.length} 個`);
	}
}

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
