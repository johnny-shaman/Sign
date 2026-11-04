/**
 * 値の段（alpha1 の解釈器の片1）。仕様は alpha1/docs/value_spec.md の V1〜V12。
 *
 * 入口は `interpret(source)` の1つ。先に resolve を通し（読む段。断りはファイルごと止める、R119）、値は書いた行の木（resolve の rows）を左から
 * 2つずつ畳んで決める（R118）。解決器の木と種類は予想なので、ここでは読まない（試験が値と種類を突き合わせるだけ、V1）。
 *
 * 返す物は `{ values, notices, diagnostics, trees }`。values は定義でない行ごとの `{ index, line, value }`（index は resolve の行の番号。ファイルでは捨てる値で、試験の口、V9）、notices は値の段の
 * 知らせ（information。`_` の生まれた行を持つ、V11）、diagnostics と trees は resolve の物のまま（trees は試験が値と種類を突き合わせるためだけに返す）。
 *
 * 片1 で持っていない形は「まだ」で、行を名指しして止める（V12。言語の `_` ではなく実装の限り。`_` を返すと観測した型にその答えが焼き付くので返さない）。
 */
import { resolve } from "./resolve.js";
import { OperationError } from "./errors.js";

const SPEC = "alpha1/docs/value_spec.md";

// ---------------------------------------------------------------------------
// 値（V2）
// ---------------------------------------------------------------------------

/** `_`。値の口でも並びでも消える（R105・R106・R112）。 */
export const UNIT = Symbol("_");
// Int は 64 bit（U〔答え〕10-28 00:0x）。値は BigInt で持つ。
const INT_MIN = -(1n << 63n);
const INT_MAX = (1n << 63n) - 1n;

/** 2つ以上の値の並び（行の並び・`,` の積・本体が返した並び）。`[x] ≅ x` なので、1つの並びは値そのもの。 */
export class Seq {
  constructor(items) {
    this.items = items;
  }
}

/**
 * 関数の値。段の並びで、段は `{ f, recv }`（受けた実引数）。段が2つ以上なら合成で、左の段から実行する（R11）。
 * f は `{ name, params, body, env, line }`（素の関数：仮引数が全部裸の名前）。値は書き換えない（部分適用は新しい値を作る）ので、定義の記録に置いても写さない。
 */
export class Fn {
  constructor(stages) {
    this.stages = stages;
  }
}

// 本体の返す所の、最後の1歩が呼び出しになる形（V10 の末尾呼び出し）。呼んだ側のループが受けて回す。
class TailCall {
  constructor(f, args, line) {
    this.f = f;
    this.args = args;
    this.line = line;
  }
}

/** 値を書く。並びは空白でつなぎ、入れ子の並びは `[…]`、関数は `関数(名前)`。 */
export function showValue(v, top = true) {
  if (v === UNIT) return "_";
  if (typeof v === "bigint") return String(v);
  if (v instanceof Seq) {
    const s = v.items.map((x) => showValue(x, false)).join(" ");
    return top ? s : `[${s}]`;
  }
  if (v instanceof Fn) return `関数(${v.stages.map((s) => s.f.name).join(" ")})`;
  return String(v);
}

// ---------------------------------------------------------------------------
// 資源（V10）
// ---------------------------------------------------------------------------

// 評価の入れ子（末尾でない呼び出し・項・行）の深さの上限。JS のスタックの溢れに頼らない（V10）。呼び出しの深さだけを数えると、1段の呼び出しの中の括りと中置の
// 入れ子の分だけ JS のスタックが伸びて先に溢れる（Node の既定のスタックで 1000 段に届かなかった）ので、入れ子を全部数える。Node の既定のスタック（約 1 MB）で
// 溢れる手前の入れ子は、本体の形で 2381〜3456 だった（2026-11-04 に測った。手続きの本体がいちばん浅い）。その最小のほぼ半分に置く。
const NEST_LIMIT = 1200;
// 1行（ファイルのいちばん外の行）の計算の量の上限。入れ子に入った回数で数え、行ごとに数え直す（問16「行は別々」）。止まらない輪のうち、同じ状態へ戻る物は
// 輪として止める（callFn）が、戻らない物（`f : x ? f (x + 1)`）はここで止める。解釈器の都合なので `_` にせず、行を名指しして止める（V10）。
// 既定の 2000 万回は、この機械で数秒にあたる。
const WORK_LIMIT = 20_000_000;

// ---------------------------------------------------------------------------
// まだ（V12）と知らせ（V11）
// ---------------------------------------------------------------------------

function notYet(what, line) {
  const e = new OperationError(`値の段の片1 では、まだ${what}を持っていません（${SPEC} V12）。`, { spec: `${SPEC} V12`, reason: "interpret-not-yet" });
  if (line !== undefined) e.line = line;
  return e;
}

const NOTICE_TEXT = {
  "zero-division": "0 で割ったので `_` です（V5）。",
  "int-overflow": "Int（64 bit）に入らないので `_` です（V5）。",
  "no-operation": "当たる演算が無いので `_` です（V5）。",
  "resource-depth": `評価の入れ子（呼び出し・項・行）が深さの上限（${NEST_LIMIT}）に届いたので \`_\` です（V10）。`,
};

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

/**
 * ソースを読んで値の段で走らせる。
 * @param {string} source
 * @param {{ workLimit?: number }} [options] workLimit は1行の計算の量の上限（試験が小さくして確かめる）
 * @returns {{ values: { index: number, line: number|undefined, value: any }[], notices: object[], diagnostics: object[], trees: object[] }}
 */
export function interpret(source, { workLimit = WORK_LIMIT } = {}) {
  const { trees, diagnostics, rows, lineOf } = resolve(source);
  // exhausted は深さの上限に当たった回数（lookup が、上限で欠けた値を覚えないために見る）。frames は答えを出している途中の呼び出しを関数ごとに（callFn）。
  const cx = { defs: new Map(), notices: [], noticed: new Set(), lineOf, nest: 0, work: 0, workLimit, exhausted: 0, frames: new Map() };

  // ファイルのいちばん外の定義（順序に依らない。同じ名前の2つ目は読む段が name-duplicate で止める）。右辺が書いた `_` 1つの定義は書かなかったことと同じ（R113）。
  for (const row of rows) {
    const name = defName(row, lineOf(row));
    if (name === null || isUnitRow(row.right)) continue;
    if (!cx.defs.has(name)) cx.defs.set(name, { name, rhs: row.right, line: lineOf(row) });
  }

  const values = [];
  rows.forEach((row, index) => {
    const line = lineOf(row);
    cx.work = 0; // 行は別々（問16）
    cx.row = line;
    const name = defName(row, line);
    if (name !== null) {
      // 定義は自分の行で1回走る。先に引かれていれば、その時に走っている（U〔答え〕10-31「引かれた時」）。
      if (!isUnitRow(row.right)) lookup(cx, name, null, line);
      return;
    }
    if (isOp(row, ":")) throw notYet("左が名前1つでないファイルの `:` の行", line);
    values.push({ index, line, value: valueOf(evalRow(cx, row, null, line, "eval"), line) });
  });
  return { values, notices: cx.notices, diagnostics, trees };
}

// 入れ子を1段入る。深さの上限なら知らせて false（その所は `_`、V10）。計算の量の上限なら止める。
function enter(cx, line) {
  if (cx.nest >= NEST_LIMIT) {
    notice(cx, "resource-depth", line);
    cx.exhausted++;
    return false;
  }
  if (++cx.work > cx.workLimit) throw workLimit(cx, line);
  cx.nest++;
  return true;
}

// 名指しするのは重かった行（いちばん外の行）。上限に届いた時に走っていた所も言う。
function workLimit(cx, at) {
  const where = at !== undefined && at !== cx.row ? `上限に届いた時は ${at} 行目を走っていました。` : "";
  const e = new OperationError(`1行の計算の量が解釈器の上限（${cx.workLimit}）を超えたので止めます。止まらない輪か、解釈器には重すぎる計算です。${where}（${SPEC} V10）`, {
    spec: `${SPEC} V10`,
    reason: "interpret-work-limit",
  });
  if (cx.row !== undefined) e.line = cx.row;
  return e;
}

function notice(cx, reason, line) {
  const key = `${reason}@${line}`;
  if (cx.noticed.has(key)) return;
  cx.noticed.add(key);
  cx.notices.push({ severity: "information", reason, line, message: NOTICE_TEXT[reason] });
}

// ---------------------------------------------------------------------------
// 行の形を見る小物
// ---------------------------------------------------------------------------

const isOp = (row, sym) => !!row && row.type === "op" && row.sym === sym;
const bareAtom = (t) => !!t && t.type === "atom" && t.pre.length === 0 && t.post.length === 0;
const bareName = (t) => (bareAtom(t) && t.core.c === "name" ? t.core.name : null);
const singleTerm = (row) => (row && row.type === "seq" && row.terms.length === 1 ? row.terms[0] : null);
const isUnitRow = (row) => {
  const t = singleTerm(row);
  return bareAtom(t) && t.core.c === "unit";
};

// 定義の行（左が名前1つの `:`）なら名前、ほかは null。公開の印 `#` の付いた名前はまだ（V12）。
function defName(row, line) {
  if (!isOp(row, ":")) return null;
  const t = singleTerm(row.left);
  if (!t || t.type !== "atom" || t.core.c !== "name" || t.post.length) return null;
  if (t.pre.length === 0) return t.core.name;
  if (t.pre.every((p) => /^#+$/.test(p))) throw notYet("公開の印 `#` の付いた定義", line);
  return null;
}

// 左から畳んだ並び → 値。空は `_`、1つはその値、2つ以上は並び（V2）。
function valueOf(stack, line) {
  if (stack instanceof TailCall) throw new Error("内部の誤り：末尾呼び出しが返す所の外に出た");
  if (stack.length === 0) return UNIT;
  if (stack.length === 1) return stack[0];
  if (stack.some((x) => x instanceof Seq)) throw notYet("並びを中に持つ並び（器の片）", line);
  return new Seq(stack);
}

// ---------------------------------------------------------------------------
// 名前と定義（V9）
// ---------------------------------------------------------------------------

function lookup(cx, name, env, line) {
  for (let e = env; e; e = e.parent) if (e.vars.has(name)) return e.vars.get(name);
  const d = cx.defs.get(name);
  if (!d) return UNIT; // 未定義の名前は `_`（R111）。`x : _` の名前も（R113）
  if ("value" in d) return d.value;
  if (d.busy) throw notYet("値の定義の輪", line);
  d.busy = true;
  const before = cx.exhausted;
  try {
    // 自分の行か、先に引かれた時に一度だけ走らせて覚える（U〔答え〕10-31「引かれた時」）。走っている間に深さの上限に当たった値は、その所の資源で欠けた値
    // なので覚えない（覚えると、後の行の値と「まだ」が前の行の深さで変わる）。
    const v = defValue(cx, d);
    if (cx.exhausted === before) d.value = v;
    return v;
  } finally {
    d.busy = false;
  }
}

function defValue(cx, d) {
  const lam = lambdaOf(d.rhs);
  if (lam) return makeLambda(cx, lam, null, d.name, cx.lineOf(lam) ?? d.line);
  // 定義の右辺は評価する所ではない。1つだけ残った関数は関数のまま（`w : add 1`）、値の上の関数は `_`（R52）。
  return valueOf(evalRow(cx, d.rhs, null, d.line, "keep"), d.line);
}

// 右辺が関数の綴りなら `?` の行。1行の括りに包んだ `?` も同じ（[x] ≅ x）。字下げの1行（仮引数のブロックの `?` の行）も剥がす（resolve の unwrapLambda と同じ）。
function lambdaOf(rhs) {
  let r = rhs;
  for (let t = singleTerm(r); bareAtom(t) && (t.core.c === "bracket" || t.core.c === "indent") && t.core.rows.length === 1; t = singleTerm(r)) r = t.core.rows[0];
  return isOp(r, "?") ? r : null;
}

function makeLambda(cx, op, env, name, line) {
  const params = [];
  for (const t of (op.left && op.left.type === "seq" && op.left.terms) || []) {
    const n = bareName(t);
    if (n === null) throw notYet("括りの仮引数・既定値・仮引数のブロック（解2 の片）", line);
    params.push(n);
  }
  if (!params.length) throw notYet("仮引数の無い関数", line);
  return new Fn([{ f: { name: name || "?", params, body: op.right, env, line }, recv: [] }]);
}

// ---------------------------------------------------------------------------
// 行（V3・V4・V6・V7）
// ---------------------------------------------------------------------------

/**
 * 1行を畳んで並び（値の配列）にする。place は置かれた所：
 * - "eval"：評価する所（根・演算子の被演算子・手続きの行・枝の条件と値）。余った関数は `_`（V4）。
 * - "keep"：定義の右辺と括りの中。1つだけ残った関数は関数のまま、値の上の関数は `_`（R52）。
 * - "tail"：本体の返す所。"eval" と同じで、行の答えが最後の呼び出しの答えそのものなら、呼ばずに TailCall を返す（V10）。
 * - "tailkeep"：返す所に置いた括りの中。"keep" と同じで、TailCall も返す。
 * 返す所かどうかは綴りでなく意味で決める：後ろの項が全部 `_` の呼び出し、括りの中、`&`・`|` の右、`,` の空の辺の隣も返す所。
 */
function evalRow(cx, row, env, line, place) {
  if (!row) throw notYet("被演算子の欠けた行（点なし）", line);
  if (!enter(cx, line)) return [];
  try {
    return rowOf(cx, row, env, line, place);
  } finally {
    cx.nest--;
  }
}

function rowOf(cx, row, env, line, place) {
  if (row.type === "seq") return foldTerms(cx, row.terms, env, line, place);
  switch (row.sym) {
    case "?":
      return close([makeLambda(cx, row, env, null, line)], place);
    case ",":
      return product(cx, row, env, line, place);
    case "&": {
      // 左が `_` なら右を読まない（V7）。右の答えが行の答え。
      const l = sideValue(cx, row.left, env, line);
      return l === UNIT ? [] : sideRow(cx, row.right, env, line, place);
    }
    case "|": {
      // 左が `_` でなければ右を読まない（V7）。右の答えが行の答え。
      const l = sideValue(cx, row.left, env, line);
      return l !== UNIT ? spread(l) : sideRow(cx, row.right, env, line, place);
    }
    case ";": {
      // 片方だけが値ならその値、両方とも値か両方とも `_` なら `_`（U 10-27 23:56）。
      const l = sideValue(cx, row.left, env, line);
      const r = sideValue(cx, row.right, env, line);
      return (l === UNIT) === (r === UNIT) ? [] : spread(l === UNIT ? r : l);
    }
    case "==": {
      // 深く比べて、等しければ左（U〔答え〕10-27 23:54）。どちらかが `_` なら `_`（U 11-04、R .8）。並びの比べは器の片（V12）。
      const l = sideValue(cx, row.left, env, line);
      const r = sideValue(cx, row.right, env, line);
      if (l instanceof Seq || r instanceof Seq) throw notYet("並びを `==` で比べる形（器の片）", line);
      return l === UNIT || r === UNIT || l !== r ? [] : spread(l);
    }
    default:
      throw notYet(`段 ${row.stage} の \`${row.sym}\``, line);
  }
}

// 比べ・論理の被演算子は評価する所（R76）。
function sideValue(cx, row, env, line) {
  return valueOf(evalRow(cx, row, env, line, "eval"), line);
}
const spread = (v) => (v === UNIT ? [] : [v]);
const isTail = (place) => place === "tail" || place === "tailkeep";

// 答えが行の答えになる辺（`&`・`|` の右）。評価する所で、行が返す所なら辺も返す所。
function sideRow(cx, row, env, line, place) {
  const r = evalRow(cx, row, env, line, isTail(place) ? "tail" : "eval");
  return r instanceof TailCall ? r : spread(valueOf(r, line));
}

// `,` の積（V4）。辺も左から畳み（R121）、辺に丸ごと残った関数は `_`（R123）、`_` は積の単位（R61）。
// 書いた `_` の辺は無いのと同じで、隣の辺は行の置かれた所のまま（`w : inc , _` は inc）。左が空なら右の答えが行の答え。
function product(cx, row, env, line, place) {
  if (isUnitRow(row.left)) return evalRow(cx, row.right, env, line, place);
  if (isUnitRow(row.right)) return evalRow(cx, row.left, env, line, place);
  const l = evalRow(cx, row.left, env, line, "eval");
  if (!l.length) return evalRow(cx, row.right, env, line, isTail(place) ? "tail" : "eval");
  const r = evalRow(cx, row.right, env, line, "eval");
  if (!r.length) return l;
  if ([...l, ...r].some((x) => x instanceof Seq)) throw notYet("並びを `,` の辺に置く形（器の片）", line);
  return [...l, ...r];
}

function close(stack, place) {
  const top = stack[stack.length - 1];
  const keep = place === "keep" || place === "tailkeep";
  if (top instanceof Fn && (!keep || stack.length > 1)) stack.pop();
  return stack;
}

// 書いた項の並びを左から2つずつ畳む（R40・R47・R120）。
// 返す所では、並びを空にする最後の呼び出しを呼ばずに取っておき（pending）、後ろの項が全部 `_` ならそれを TailCall で返す。`_` でない項が来たら呼んで畳みを続ける。
function foldTerms(cx, terms, env, line, place) {
  const tail = isTail(place);
  const stack = [];
  let pending = null;
  for (const t of terms) {
    const v = evalTerm(cx, t, env, line, tail && !stack.length && !pending ? "tailkeep" : "keep");
    if (v instanceof TailCall) {
      pending = v; // 並びが空の所の括りの中の最後の呼び出し
      continue;
    }
    if (v === UNIT) continue;
    if (pending) {
      const r = callFn(cx, pending.f, pending.args, pending.line);
      pending = null;
      step(cx, stack, r, line);
    }
    pending = step(cx, stack, v, line, tail);
  }
  return pending || close(stack, place);
}

// 畳みの1歩（V3）：関数の後ろの値は適用、関数の後ろの関数は合成、ほかは積む。`_` は値の口でも並びでも消える。
// tail なら、並びを空にする最後の呼び出しを呼ばずに TailCall で返す（ほかは null）。
function step(cx, stack, v, line, tail = false) {
  if (v === UNIT) return null;
  const top = stack[stack.length - 1];
  if (top instanceof Fn) {
    if (v instanceof Fn) {
      stack[stack.length - 1] = new Fn([...top.stages, ...v.stages]);
      return null;
    }
    stack.pop();
    const { rest, outs, call } = feed(cx, top, v, line, tail && !stack.length);
    if (call) return call;
    if (rest) stack.push(rest);
    for (const o of outs) step(cx, stack, o, line);
    return null;
  }
  if ((v instanceof Seq && stack.length) || stack.some((x) => x instanceof Seq)) throw notYet("並びの隣に項を積む形（器の片）", line);
  stack.push(v);
  return null;
}

// 関数の値に値を1つ当てる。段の口が埋まれば呼び、答えは次の段へ流し、段が尽きた後の答えは並びに出す（R11・R40）。
// 段の並びはループで回す（書いた合成が長くても JS のスタックを積まない）。tail なら最後の段の呼び出しは呼ばずに返す。
function feed(cx, fn, v, line, tail) {
  let stages = fn.stages;
  for (;;) {
    if (v instanceof Seq) throw notYet("並びを関数の口へ渡す形（器の片）", line);
    const [st, ...later] = stages;
    const recv = [...st.recv, v];
    if (recv.length < st.f.params.length) return { rest: new Fn([{ f: st.f, recv }, ...later]), outs: [] };
    if (tail && !later.length) return { call: new TailCall(st.f, recv, line) };
    const r = callFn(cx, st.f, recv, line);
    if (!later.length) return { rest: null, outs: r === UNIT ? [] : [r] };
    if (r === UNIT) return { rest: new Fn(later), outs: [] };
    stages = later;
    v = r;
  }
}

// ---------------------------------------------------------------------------
// 呼び出しと本体（V8・V10）
// ---------------------------------------------------------------------------

// 呼び出しは、関数と実引数で決まる（値は書き換えず、同じ呼び出しは同じ答え）。だから次の2つは止まらない輪で、回さずに止める（V10・V12）：
// - 答えを出している途中の呼び出しを、同じ実引数でもう一度呼ぶ（必ず読む所なら問10 で読む段が断る輪で、読む段にまだ無い。枝の中なら同じ引数の輪で眠る）。
// - 末尾呼び出しのループが前に通った状態へ戻る（アイドル。問12「アイドルでいい」の `_ _ = _` の永久ループで、解釈器にはまだ無い）。Brent の方法で見つける。
function callFn(cx, f, args, line) {
  if (reentered(cx, f, args, null)) throw notYet(REENTER, line);
  if (!enter(cx, line)) return UNIT;
  const frame = { f, args };
  pushFrame(cx, frame);
  try {
    let saved = frame.args;
    let savedF = f;
    let power = 1;
    let lam = 0;
    for (;;) {
      const r = runBody(cx, frame.f, frame.args);
      if (!(r instanceof TailCall)) return r;
      if (r.f === savedF && sameArgs(r.args, saved)) throw notYet("前に通った状態へ戻る末尾の輪（アイドル、問12）", r.line);
      if (++lam === power) {
        savedF = r.f;
        saved = r.args;
        power *= 2;
        lam = 0;
      }
      if (reentered(cx, r.f, r.args, frame)) throw notYet(REENTER, r.line);
      popFrame(cx, frame);
      frame.f = r.f;
      frame.args = r.args;
      pushFrame(cx, frame);
    }
  } finally {
    popFrame(cx, frame);
    cx.nest--;
  }
}

const REENTER = "答えを出している途中の呼び出しを同じ実引数で呼ぶ輪（止まらない。読む段が断る必ず読む輪（問10）か、眠る輪（問12））";
const sameArgs = (a, b) => a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));

function reentered(cx, f, args, self) {
  const active = cx.frames.get(f);
  return !!active && active.some((fr) => fr !== self && sameArgs(fr.args, args));
}

function pushFrame(cx, frame) {
  const active = cx.frames.get(frame.f);
  if (active) active.push(frame);
  else cx.frames.set(frame.f, [frame]);
}

// 途中の呼び出しのうち、いちばん内側の物を外す（同じ関数の並びでもいちばん後ろにいる）。
function popFrame(cx, frame) {
  const active = cx.frames.get(frame.f);
  active.splice(active.lastIndexOf(frame), 1);
  if (!active.length) cx.frames.delete(frame.f);
}

function runBody(cx, f, args) {
  const env = { vars: new Map(f.params.map((p, i) => [p, args[i]])), parent: f.env };
  const line = cx.lineOf(f.body) ?? f.line;
  const t = singleTerm(f.body);
  const r = bareAtom(t) && t.core.c === "indent" ? evalBlock(cx, t.core.rows, env, line) : evalRow(cx, f.body, env, line, "tail");
  return r instanceof TailCall ? r : Array.isArray(r) ? valueOf(r, line) : r;
}

// 字下げの本体（V8）。枝（`:` の行）が有れば選び、無ければ手続き `l1 & … & ln`（R76）。
function evalBlock(cx, rows, env, outer) {
  const lineAt = (r) => cx.lineOf(r) ?? outer;
  if (rows.some((r) => isOp(r, ":"))) {
    // 選び：`(c1 & v1) | … | 既定`。値が `_` の枝は次の枝へ進む（U〔答え〕10-29 12:46、U 12:52）。
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const line = lineAt(r);
      const last = i === rows.length - 1;
      // 枝の前か間の裸の行と2つ目からの既定の行は、読む段が名指しして止める（寄せ1 の R130、body-bare-row-between）ので、ここには来ない。来たら読む段の
      // 抜けなので、言語の `_` に倒さず「まだ」で止める。
      if (!isOp(r, ":")) {
        if (!last) throw notYet("枝の間に置いた既定の行（読む段の R130 の抜け）", line);
        return evalRow(cx, r, env, line, "tail");
      }
      // 本体の `:` の行は左が何でも枝で、何も定義しない（寄せ1 の R128、U〔答え〕10-29 12:18「ガイドに戻す」）。左が名前1つでも、条件として読む（未定義の名前は `_`）。
      // 最後でない枝の値は末尾でない（値が `_` なら次の枝へ進むので、値を見るまで戻れない。R129）。
      if (sideValue(cx, r.left, env, line) === UNIT) continue;
      if (last) return evalRow(cx, r.right, env, line, "tail");
      const v = sideValue(cx, r.right, env, line);
      if (v !== UNIT) return v;
    }
    return UNIT;
  }
  for (let i = 0; i < rows.length; i++) {
    const line = lineAt(rows[i]);
    if (i === rows.length - 1) return evalRow(cx, rows[i], env, line, "tail");
    if (sideValue(cx, rows[i], env, line) === UNIT) return UNIT;
  }
  return UNIT;
}

// ---------------------------------------------------------------------------
// 項（V5・V6）
// ---------------------------------------------------------------------------

// place は項の並びの置かれた所で、効くのは印の無い括りだけ（"tailkeep" なら括りの中も返す所）。
function evalTerm(cx, t, env, line, place = "keep") {
  if (!t) throw notYet("被演算子の欠けた項（点なし）", line);
  if (!enter(cx, line)) return UNIT;
  try {
    return termOf(cx, t, env, line, place);
  } finally {
    cx.nest--;
  }
}

function termOf(cx, t, env, line, place) {
  if (t.type === "infix") return evalInfix(cx, t, env, line);
  if (t.post.length) throw notYet(`後置の印 \`${t.post.join("")}\``, line);
  for (const p of t.pre) if (p !== "-") throw notYet(`前置の印 \`${p}\``, line);
  // 前置 `-` は、芯の中の演算子が算術の範囲の時だけ（U [2026-10-30 14:47]、渡された仮引数は見ない U〔答え〕14:52「通す」）。読む段がまだ線を引かないので、
  // 線の外と言い切れない芯（定義の名前・適用・比べ）もまだで止める。
  if (t.pre.length && !arithCore(cx, t.core, env)) throw notYet("前置 `-` を算術と言い切れない物に当てる形（10-30 の算術の線）", line);
  let v;
  const c = t.core;
  switch (c.c) {
    case "lit":
      v = literal(c.text, line);
      break;
    case "name":
      v = lookup(cx, c.name, env, line);
      break;
    case "unit":
      v = UNIT;
      break;
    case "bracket":
      v = bracketValue(cx, c, env, line, !t.pre.length && place === "tailkeep" ? "tailkeep" : "keep");
      if (v instanceof TailCall) return v;
      break;
    default:
      throw notYet(c.c === "indent" ? "項に置いた字下げのブロック" : "絶対値・ノルム", line);
  }
  for (let i = t.pre.length - 1; i >= 0; i--) v = negate(cx, operandOf(v, line), line);
  return v;
}

// 芯が算術の線の内か：字面・`_`・仮引数・未定義の名前（`_`、R111）と、それを算術の中置でつないだ物、それを1つ括った物。
function arithCore(cx, c, env) {
  switch (c.c) {
    case "lit":
    case "unit":
      return true;
    case "name":
      return isParam(env, c.name) || !cx.defs.has(c.name);
    case "bracket":
      return c.rows.length === 1 && arithTerm(cx, singleTerm(c.rows[0]), env);
    default:
      return false;
  }
}

function arithTerm(cx, t, env) {
  if (!t) return false;
  if (t.type === "infix") return ARITH.has(t.sym) && arithTerm(cx, t.left, env) && arithTerm(cx, t.right, env);
  return !t.post.length && t.pre.every((p) => p === "-") && arithCore(cx, t.core, env);
}

function isParam(env, name) {
  for (let e = env; e; e = e.parent) if (e.vars.has(name)) return true;
  return false;
}

function literal(text, line) {
  if (!/^-?[0-9]+$/.test(text)) throw notYet(`字面 \`${text}\`（数は 10 進の Int だけ）`, line);
  const n = BigInt(text);
  if (n < INT_MIN || n > INT_MAX) throw notYet(`Int に入らない字面 \`${text}\``, line);
  return n;
}

// 括り（1行だけ）。中身を畳んで、空なら `_`、1つならその値（[x] ≅ x。関数も）。2つ以上は器でまだ。
// place が "tailkeep" なら中身も返す所で、最後の呼び出しは TailCall で返る。
function bracketValue(cx, c, env, line, place) {
  if (c.rows.length !== 1) throw notYet(c.rows.length ? "2行以上の括り（器の片）" : "書いた `[]`", line);
  const row = c.rows[0];
  const inner = cx.lineOf(row) ?? line;
  if (row && row.type === "seq" && row.terms.some(hasMissing)) throw notYet("点なしの区間", inner);
  const st = evalRow(cx, row, env, inner, place);
  if (st instanceof TailCall) return st;
  if (st.length >= 2) throw notYet("2つ以上の値の括り（器の片）", inner);
  return st.length ? st[0] : UNIT;
}
const hasMissing = (t) => !t || (t.type === "infix" && (hasMissing(t.left) || hasMissing(t.right)));

// 値の演算子の被演算子は評価する所（R87）：関数は `_`。並びは器の片でまだ。
function operandOf(v, line) {
  if (v instanceof Fn) return UNIT;
  if (v instanceof Seq) throw notYet("並びを値の演算子に当てる形（器の片）", line);
  return v;
}

const ARITH = new Set(["+", "-", "*", "/", "%", "^"]);
const ORDER = new Set(["<", "<=", ">", ">="]);

function evalInfix(cx, t, env, line) {
  if (!t.left || !t.right) throw notYet("点なしの区間", line);
  const operand = (x) => operandOf(evalTerm(cx, x, env, line), line);
  if (ARITH.has(t.sym)) {
    const a = operand(t.left);
    const b = operand(t.right);
    return arith(cx, t.sym, a, b, line);
  }
  if (ORDER.has(t.sym)) {
    // 括らない3項の連鎖（読む段が通すのは `a < b < c` と `a > b > c` だけ）：成り立てば真ん中、外れたら `_`（R119、U 11-04）。
    if (t.left.type === "infix" && ORDER.has(t.left.sym)) {
      const a = operand(t.left.left);
      const b = operand(t.left.right);
      const c = operand(t.right);
      if (a === UNIT || b === UNIT || c === UNIT) return UNIT;
      return holds(t.left.sym, a, b) && holds(t.sym, b, c) ? b : UNIT;
    }
    const a = operand(t.left);
    const b = operand(t.right);
    // 成り立てば左、外れたら `_`（0/1 の例外なし、U 10-27 23:01・U〔答え〕23:5x）。どちらかが `_` なら `_`（U 11-04）。
    if (a === UNIT || b === UNIT) return UNIT;
    return holds(t.sym, a, b) ? a : UNIT;
  }
  throw notYet(`中置 \`${t.sym}\``, line);
}

function holds(sym, a, b) {
  return sym === "<" ? a < b : sym === "<=" ? a <= b : sym === ">" ? a > b : a >= b;
}

// 算術（V5、U〔答え〕10-28 00:0x）。`_` は両側の単位（`_ - 2` は 2）。
function arith(cx, sym, a, b, line) {
  if (a === UNIT) return b;
  if (b === UNIT) return a;
  let r;
  switch (sym) {
    case "+":
      r = a + b;
      break;
    case "-":
      r = a - b;
      break;
    case "*":
      r = a * b;
      break;
    case "/":
    case "%":
      if (b === 0n) {
        notice(cx, "zero-division", line);
        return UNIT;
      }
      r = sym === "/" ? a / b : a % b; // BigInt の割り算は 0 へ切り捨て
      break;
    case "^":
      if (b < 0n) {
        notice(cx, "no-operation", line); // 負の指数の冪は `_`
        return UNIT;
      }
      if ((a > 1n || a < -1n) && b > 63n) {
        notice(cx, "int-overflow", line);
        return UNIT;
      }
      r = a ** b;
      break;
  }
  return fits(cx, r, line);
}

function negate(cx, v, line) {
  return v === UNIT ? UNIT : fits(cx, -v, line);
}

function fits(cx, r, line) {
  if (r < INT_MIN || r > INT_MAX) {
    notice(cx, "int-overflow", line);
    return UNIT;
  }
  return r;
}

// 実引数を深く比べる（同じ呼び出しを見つける、callFn）。関数は同じ値の時だけ等しいと見る（違う値でも同じ関数でありうるので、輪を見落とす側に倒れる）。
function deepEqual(a, b) {
  if (a instanceof Seq || b instanceof Seq) {
    return a instanceof Seq && b instanceof Seq && a.items.length === b.items.length && a.items.every((x, i) => deepEqual(x, b.items[i]));
  }
  return a === b;
}
