/**
 * 値の段（alpha1 の解釈器の片1）。仕様は alpha1/docs/value_spec.md の V1〜V12。
 *
 * 入口は `interpret(source)` の1つ。先に resolve を通し（読む段。断りはファイルごと止める、R119）、値は書いた行の木（resolve の rows）を左から
 * 2つずつ畳んで決める（R118）。解決器の木と種類は予想なので、ここでは読まない（試験が値と種類を突き合わせるだけ、V1）。
 *
 * 返す物は `{ values, notices, diagnostics, trees }`。values は定義でない行ごとの `{ index, line, value }`（index は resolve の行の番号。ファイルでは捨てる値で、試験の口、V9）、notices は値の段の
 * 知らせ（information。`!_` の生まれた行を持つ、V11）、diagnostics と trees は resolve の物のまま（trees は試験が値と種類を突き合わせるためだけに返す）。
 *
 * 片1 で持っていない形は「まだ」で、行を名指しして止める（V12。言語の `!_` ではなく実装の限り。`!_` を返すと観測した型にその答えが焼き付くので返さない）。
 */
import { resolve } from "./resolve.js";
import { OperationError } from "./errors.js";

const SPEC = "alpha1/docs/value_spec.md";

// ---------------------------------------------------------------------------
// 値（V2）
// ---------------------------------------------------------------------------

/** void の値（今の綴りの `!_`。Symbol の名の "_" は前の綴りのまま）。値の口でも並びでも消える（R105・R106・R112）。 */
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
// orElse は「呼んだ答えが `!_` なら、この所の答えはこの関数」（括りの中の `,`・`|`・`;` で、単位律が関数1つを残す形。11-04、2026-11-07 の誤2・誤4）。
// 残った関数が `!_` になる所（"tail"）では要らないので evalRow が外し、callFn のループは見ない。後ろに項が続いて呼ぶ所（callPending）だけが当てる。
// 当てるのは答えが `!_` の時だけ。今は呼び出しの答えが関数になる形が無い（本体の返す所の関数は `!_`、R125）ので、関数を返す呼び出しが入る片（ウの `$`・`@`）で
// 「答えが関数なら `!_`（R123）」の枝が要る。
class TailCall {
  constructor(f, args, line, orElse = null) {
    this.f = f;
    this.args = args;
    this.line = line;
    this.orElse = orElse;
  }
}

// 取っておいた末尾呼び出しを、後ろに `!_` でない物が来たので呼ぶ。呼び手が3つ（evalRow の畳み・product・xorRow）なので溶かさず、生成器のまま呼ぶ（呼び手は yield で頼む）。
function* callPending(cx, tc) {
  const r = yield callFn(cx, tc.f, tc.args, tc.line);
  return r === UNIT && tc.orElse ? tc.orElse : r;
}

/** 値を書く。並びは空白でつなぎ、入れ子の並びは `[…]`、関数は `関数(名前)`。 */
export function showValue(v, top = true) {
  if (v === UNIT) return "!_";
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

// 評価の入れ子（末尾でない呼び出し・項・行）の深さの上限。JS のスタックの溢れに頼らない（V10）。評価の入れ子は JS のスタックに積まず、ヒープ上の配列に積む
// （drive）ので、届く深さは JS のスタックの大きさに依らず、この上限とメモリで決まる。数えるのは前と同じ所（enter）。1段の重さはその段で読んでいる行の項の数に
// ほぼ比例し、ヒープが溢れるとプロセスごと落ちて catch できないので、ふつうの幅の行が小さいヒープでも収まる所に置く（V10 の注、2026-11-07 の誤5）。
// `interpret(source, { nestLimit })` で変えられる（試験が小さくして確かめる）。
const NEST_LIMIT = 10_000;
// 1行（ファイルのいちばん外の行）の計算の量の上限。入れ子に入った回数で数え、行ごとに数え直す（問16「行は別々」）。止まらない輪のうち、同じ状態へ戻る物は
// 輪として止める（callFn）が、戻らない物（`f : x ? f (x + 1)`）はここで止める。解釈器の都合なので `!_` にせず、行を名指しして止める（V10）。
// 既定の 2000 万回は、この機械で数秒にあたる。
const WORK_LIMIT = 20_000_000;

// ---------------------------------------------------------------------------
// 駆動（V10、2026-11-07 の誤5）：評価の入れ子を JS のスタックでなく、ヒープ上の配列に積む
// ---------------------------------------------------------------------------

// 評価を呼び返す関数は生成器で、子の評価は `yield 子の生成器` で頼む。ここが子を走らせ、答えを .next(答え) で親へ返す。子が投げた例外は
// .throw(例外) で親へ渡す（親が捕まえなければ、親も終わって更に上へ）。どの生成器も、終わるか例外を受けるまで積まれているので、finally は元と同じに走る。
// 輪の外から呼ぶのは interpret の2か所だけで、drive の中で drive は呼ばない（JS のスタックの深さは drive＋生成器1つ＋書いた形の深さで抑えられる葉で頭打ち）。
// export は試験の口（interpret.test.js が作り物の生成器で駆動の輪だけを確かめる）。入口は interpret の1つのまま（V1）。
export function drive(root) {
  const stack = [root];
  let input;
  let error;
  let failed = false;
  for (;;) {
    const g = stack[stack.length - 1];
    let r;
    try {
      r = failed ? g.throw(error) : g.next(input);
    } catch (e) {
      stack.pop();
      if (!stack.length) throw e;
      error = e;
      failed = true;
      continue;
    }
    failed = false;
    error = undefined;
    if (r.done) {
      stack.pop();
      if (!stack.length) return r.value;
      input = r.value;
    } else {
      stack.push(r.value);
      input = undefined;
    }
  }
}

// ---------------------------------------------------------------------------
// まだ（V12）と知らせ（V11）
// ---------------------------------------------------------------------------

function notYet(what, line) {
  const e = new OperationError(`値の段の片1 では、まだ${what}を持っていません（${SPEC} V12）。`, { spec: `${SPEC} V12`, reason: "interpret-not-yet" });
  if (line !== undefined) e.line = line;
  return e;
}

const NOTICE_TEXT = {
  "zero-division": "0 で割ったので `!_` です（V5）。",
  "int-overflow": "Int（64 bit）に入らないので `!_` です（V5）。",
  "no-operation": "当たる演算が無いので `!_` です（V5）。",
  "resource-depth": (cx) => `評価の入れ子（呼び出し・項・行）が深さの上限（${cx.nestLimit}）に届いたので \`!_\` です（V10）。`,
};

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

/**
 * ソースを読んで値の段で走らせる。
 * @param {string} source
 * @param {{ workLimit?: number, nestLimit?: number }} [options] workLimit は1行の計算の量の上限、nestLimit は評価の入れ子の深さの上限（どちらも試験が小さくして確かめる）
 * @returns {{ values: { index: number, line: number|undefined, value: any }[], notices: object[], diagnostics: object[], trees: object[] }}
 */
export function interpret(source, { workLimit = WORK_LIMIT, nestLimit = NEST_LIMIT } = {}) {
  const { trees, diagnostics, rows, lineOf } = resolve(source);
  // exhausted は深さの上限に当たった回数（lookup が、上限で欠けた値を覚えないために見る）。frames は答えを出している途中の呼び出しを関数ごとに（callFn）。
  const cx = { defs: new Map(), notices: [], noticed: new Set(), lineOf, nest: 0, nestLimit, work: 0, workLimit, exhausted: 0, frames: new Map() };

  // ファイルのいちばん外の定義（順序に依らない。同じ名前の2つ目は読む段が name-duplicate で止める）。前は、右辺が書いた `!_` 1つの定義を書かなかったことと
  // 同じにしていた（R113、isUnitRow）。2026-11-09 の R138 の片2 から、その行は読む段の void-written が先に断る。
  for (const row of rows) {
    const name = defName(row, lineOf(row));
    if (name === null) continue;
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
      drive(lookup(cx, name, null, line));
      return;
    }
    if (isOp(row, ":")) throw notYet("左が名前1つでないファイルの `:` の行", line);
    values.push({ index, line, value: valueOf(drive(evalRow(cx, row, null, line, "eval")), line) });
  });
  return { values, notices: cx.notices, diagnostics, trees };
}

// 入れ子を1段入る。深さの上限なら知らせて false（その所は `!_`、V10）。計算の量の上限なら止める。
function enter(cx, line) {
  if (cx.nest >= cx.nestLimit) {
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
  const text = NOTICE_TEXT[reason];
  cx.notices.push({ severity: "information", reason, line, message: typeof text === "function" ? text(cx) : text });
}

// ---------------------------------------------------------------------------
// 行の形を見る小物
// ---------------------------------------------------------------------------

const isOp = (row, sym) => !!row && row.type === "op" && row.sym === sym;
const bareAtom = (t) => !!t && t.type === "atom" && t.pre.length === 0 && t.post.length === 0;
const bareName = (t) => (bareAtom(t) && t.core.c === "name" ? t.core.name : null);
const singleTerm = (row) => (row && row.type === "seq" && row.terms.length === 1 ? row.terms[0] : null);

// 定義の行（左が名前1つの `:`）なら名前、ほかは null。公開の印 `#` の付いた名前はまだ（V12）。
function defName(row, line) {
  if (!isOp(row, ":")) return null;
  const t = singleTerm(row.left);
  if (!t || t.type !== "atom" || t.core.c !== "name" || t.post.length) return null;
  if (t.pre.length === 0) return t.core.name;
  if (t.pre.every((p) => /^#+$/.test(p))) throw notYet("公開の印 `#` の付いた定義", line);
  return null;
}

// 左から畳んだ並び → 値。空は `!_`、1つはその値、2つ以上は並び（V2）。
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

// 走らせずに分かる名前の値（仮引数・覚えた値）。定義を走らせる要る時と、定義の見えない名前は NEED（呼ぶ側が lookup で回す）。
const NEED = Symbol("need");
function known(cx, name, env) {
  for (let e = env; e; e = e.parent) if (e.vars.has(name)) return e.vars.get(name);
  const d = cx.defs.get(name);
  if (d && "value" in d) return d.value;
  return NEED;
}

function* lookup(cx, name, env, line) {
  const k = known(cx, name, env);
  if (k !== NEED) return k;
  const d = cx.defs.get(name);
  // 定義の見えない名前は、取り込み（後置 `@`）のある範囲の名前だけが来る（取り込みの無い範囲の未定義の名前は、読む段の name-undefined が先に断る、R138）。
  // 取り込み先の値はまだ持っていない（V12）。前（R111）は `!_` と読んでいた。
  if (!d) throw notYet(`取り込みの先にあるかもしれない名前 \`${name}\` の値`, line);
  if (d.busy) throw notYet("値の定義の輪", line);
  d.busy = true;
  const before = cx.exhausted;
  try {
    // 自分の行か、先に引かれた時に一度だけ走らせて覚える（U〔答え〕10-31「引かれた時」）。走っている間に深さの上限に当たった値は、その所の資源で欠けた値
    // なので覚えない（覚えると、後の行の値と「まだ」が前の行の深さで変わる）。
    const v = yield defValue(cx, d);
    if (cx.exhausted === before) d.value = v;
    return v;
  } finally {
    d.busy = false;
  }
}

function* defValue(cx, d) {
  const lam = lambdaOf(d.rhs);
  // 括りに包んだ関数は、括りをその場で書いた時と同じ点なしの門を通る（`f : [x ? x |]` ⏎ `f 5` は `[x ? x |] 5` と同じまだ。字下げの1行に置いた括りも。
  // 名前は右辺を閉じた1つの項、R42 の読み7。2026-11-07 の誤1）。括らない `f : x ? x |` は読む段が止めるので、ここへは来ない。
  if (lam && rowMissing(lam)) throw notYet("被演算子の欠けた行（点なし）", cx.lineOf(lam) ?? d.line);
  if (lam) return makeLambda(cx, lam, null, d.name, cx.lineOf(lam) ?? d.line);
  // 定義の右辺は評価する所ではない。1つだけ残った関数は関数のまま（`w : add 1`）、値の上の関数は `!_`（R52）。
  return valueOf(yield evalRow(cx, d.rhs, null, d.line, "keep"), d.line);
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
 * - "eval"：評価する所（根・演算子の被演算子・手続きの行・枝の条件と値）。余った関数は `!_`（V4）。
 * - "keep"：定義の右辺と括りの中。1つだけ残った関数は関数のまま、値の上の関数は `!_`（R52）。
 * - "tail"：本体の返す所。"eval" と同じで、行の答えが最後の呼び出しの答えそのものなら、呼ばずに TailCall を返す（V10）。
 * - "tailkeep"：返す所に置いた括りの中。"keep" と同じで、TailCall も返す。
 * 返す所かどうかは綴りでなく意味で決める：後ろの項が全部 `!_` の呼び出し、括りの中、`&`・`|` の右（`|` の左が丸ごとの関数でも）、`,`・`;` の辺の呼び出しで
 * 後ろの辺が全部 `!_` の物（`;` は後ろの辺が丸ごとの関数でも。`!_` は出どころに依らず消えるので、隣の辺が行の答え。11-04、2026-11-07 の誤2・誤4）も返す所。
 */
function* evalRow(cx, row, env, line, place) {
  if (!row) throw notYet("被演算子の欠けた行（点なし）", line);
  if (!enter(cx, line)) return [];
  try {
    let r;
    if (row.type === "seq") {
      // 書いた項の並びを左から2つずつ畳む（R40・R47・R120。前の foldTerms を溶かした）。
      // 返す所では、並びを空にする最後の呼び出しを呼ばずに取っておき（pending）、後ろの項が全部 `!_` ならそれを TailCall で返す。`!_` でない項が来たら呼んで畳みを続ける。
      const tail = isTail(place);
      const stack = [];
      let pending = null;
      for (const t of row.terms) {
        let v = termNow(cx, t, env, line);
        if (v === NEED) v = yield evalTerm(cx, t, env, line, tail && !stack.length && !pending ? "tailkeep" : "keep");
        if (v instanceof TailCall) {
          pending = v; // 並びが空の所の括りの中の最後の呼び出し
          continue;
        }
        if (v === UNIT) continue;
        if (pending) {
          const c = yield callPending(cx, pending);
          pending = null;
          if (stepNow(cx, stack, c, line) === NEED) yield applyStep(cx, stack, c, line, false);
        }
        pending = stepNow(cx, stack, v, line);
        if (pending === NEED) pending = yield applyStep(cx, stack, v, line, tail);
      }
      r = pending || close(stack, place);
    } else r = yield rowOf(cx, row, env, line, place);
    // "tail" は評価する所なので、残った関数は `!_`（V4）。呼んだ答えが `!_` の時の関数（orElse）は要らない（外さないと、`&` の右を通った括りの関数が残る）。
    return r instanceof TailCall && r.orElse && place === "tail" ? new TailCall(r.f, r.args, r.line) : r;
  } finally {
    cx.nest--;
  }
}

// 演算子の行（項の並びの行は evalRow が畳む）。
function* rowOf(cx, row, env, line, place) {
  switch (row.sym) {
    case "?":
      return close([makeLambda(cx, row, env, null, line)], place);
    case ",":
      return yield product(cx, row, env, line, place);
    case "&": {
      // 左が `!_` なら右を読まない（V7）。右の答えが行の答え。
      const l = valueOf(yield evalRow(cx, row.left, env, line, "eval"), line);
      return l === UNIT ? [] : yield sideRow(cx, row.right, env, line, place);
    }
    case "|": {
      // 左が `!_` でなければ右を読まない（V7）。右の答えが行の答え。
      // 評価する所・返す所では残った関数も `!_` なので、左の関数は `!_` と同じ（今のまま）。違うのは括りの中と定義の右辺だけ（orKeep、2026-11-07 の誤4）。
      if (isKeep(place)) return yield orKeep(cx, row, env, line, place);
      const l = valueOf(yield evalRow(cx, row.left, env, line, "eval"), line);
      return l !== UNIT ? spread(l) : yield sideRow(cx, row.right, env, line, place);
    }
    case ";":
      return yield xorRow(cx, row, env, line, place);
    case "==": {
      // 深く比べて、等しければ左（U〔答え〕10-27 23:54）。どちらかが `!_` なら `!_`（U 11-04、R .8）。並びの比べは器の片（V12）。
      const l = valueOf(yield evalRow(cx, row.left, env, line, "eval"), line);
      const r = valueOf(yield evalRow(cx, row.right, env, line, "eval"), line);
      if (l instanceof Seq || r instanceof Seq) throw notYet("並びを `==` で比べる形（器の片）", line);
      return l === UNIT || r === UNIT || l !== r ? [] : spread(l);
    }
    default:
      throw notYet(`段 ${row.stage} の \`${row.sym}\``, line);
  }
}

// 比べ・論理の被演算子は評価する所（R76）：呼ぶ所で `valueOf(yield evalRow(…, "eval"), line)`（前の sideValue。生成器を1つ減らすため開いた）。
const spread = (v) => (v === UNIT ? [] : [v]);
const isTail = (place) => place === "tail" || place === "tailkeep";
const isKeep = (place) => place === "keep" || place === "tailkeep";
// 辺を関数のまま（keep）読んだ並びが、丸ごとの関数1つか。
const lone = (s) => Array.isArray(s) && s.length === 1 && s[0] instanceof Fn;
// keep で読んだ辺の並びを、論理の辺の形（関数1つ・`!_`・値1つ。2つ以上の値は並び）にする（評価する所の `valueOf(yield evalRow(…, "eval"), line)` と同じ形）。
const asSide = (s, line) => (s instanceof TailCall || lone(s) ? s : spread(valueOf(s, line)));

// 括りの中・定義の右辺の `|`（V7、2026-11-07 の誤4。U〔答え〕11-04 05:34「6 に揃える」・06:04「消える」）。`!_` は両側の単位で出どころに依らず先に消え、
// 残った辺は行の置かれた所のまま。消えた後にも `|` が残れば丸ごとの関数は `!_`（R123）で、それも単位で消える。左が値なら右を読まない（V7）。
function* orKeep(cx, row, env, line, place) {
  const l = yield evalRow(cx, row.left, env, line, "keep");
  if (!l.length) return asSide(yield evalRow(cx, row.right, env, line, place), line);
  if (!lone(l)) return asSide(l, line);
  // 左が関数：右が `!_` なら左の関数だけが残り、右が値なら左の関数は `!_`、右も関数なら両方 `!_`。右が返す所の呼び出しなら、呼んだ答えが `!_` の時に左の関数。
  const r = yield evalRow(cx, row.right, env, line, place);
  if (r instanceof TailCall) return new TailCall(r.f, r.args, r.line, r.orElse ? null : l[0]);
  if (!r.length) return l;
  return lone(r) ? [] : asSide(r, line);
}

// `;`（V7）：片方だけが値ならその値、両方とも値か両方とも `!_` なら `!_`（U 10-27 23:56）。`!_` は両側の単位で、残った辺は行の置かれた所のまま。
// 消えた後にも `;` が残れば丸ごとの関数は `!_`（R123）で、それも消える（2026-11-07 の誤4）。評価する所では残った関数は `!_` なので、前と同じ答え。
// 返す所では、左の最後の呼び出しを取っておき（V10。右が `!_` か関数なら左が答えで、右が関数なら呼んだ答えが `!_` の時にその関数）、
// 左が `!_` か関数なら右を行の置かれた所のまま（返す所なら返す所）に読む。
// 辺を関数のまま（keep）読むのは括りの中と定義の右辺だけ。評価する所・返す所の辺は評価する所のまま読む（keep で読むと、`inc , double , add 1 ; 7` の左が
// Q89 の門に当たって、前は 7 だった答えがまだになる。V7「評価する所では…答えは前と同じ」）。
function* xorRow(cx, row, env, line, place) {
  const side = isKeep(place) ? "keep" : "eval";
  const l = yield evalRow(cx, row.left, env, line, isKeep(place) ? (isTail(place) ? "tailkeep" : "keep") : place);
  if (l instanceof TailCall) {
    const r = asSide(yield evalRow(cx, row.right, env, line, side), line);
    if (!r.length) return l;
    if (lone(r)) return new TailCall(l.f, l.args, l.line, l.orElse ? null : r[0]);
    return close(xorOf(spread(yield callPending(cx, l)), r), place);
  }
  if (!l.length || lone(l)) {
    const r = yield evalRow(cx, row.right, env, line, place);
    if (r instanceof TailCall) return lone(l) ? new TailCall(r.f, r.args, r.line, r.orElse ? null : l[0]) : r;
    return close(xorOf(l, asSide(r, line)), place);
  }
  return close(xorOf(asSide(l, line), asSide(yield evalRow(cx, row.right, env, line, side), line)), place);
}

// `;` の2つの辺（`!_`・関数1つ・値1つ）。
function xorOf(l, r) {
  if (!l.length) return r;
  if (!r.length) return l;
  if (lone(l)) return lone(r) ? [] : r;
  if (lone(r)) return l;
  return [];
}

// 答えが行の答えになる辺（`&`・`|` の右）。評価する所で、行が返す所なら辺も返す所。
function* sideRow(cx, row, env, line, place) {
  const r = yield evalRow(cx, row, env, line, isTail(place) ? "tail" : "eval");
  return r instanceof TailCall ? r : spread(valueOf(r, line));
}

// `,` の積（V4、2026-11-07 の誤2）。括らない `,` の鎖は1つの平らな積で、辺（因子。括った `(…)` は1つの因子）を左から、関数のまま（keep）読む（R121）。
// 1. 単位律：`!_` の辺は出どころ（書いた・名前・括り・計算・0 除算・`!_` を返す呼び出し）に依らず消える（R61、U 11-04 04:26）。
// 2. 1つだけ残った辺は行の置かれた所のまま（`w : inc , !_` は inc、根では `!_`）。
// 3. 2つ以上残れば `,` が残るので、丸ごとの関数は `!_`（R123）で、それも単位で消える（U〔答え〕11-04 06:04）。関数だけが3つ以上残る形は、括りの中と
//    定義の右辺では仕様 §5 Q89 の答えまでまだ（V12）、評価する所ではどの読みでも `!_`。
// 返す所では、前の辺が関数だけ（2つまで）の辺の最後の呼び出しを取っておき（evalRow の畳みの pending と同じ）、後ろの辺が全部 `!_` ならそれが行の答え（V10）。
// 前の関数が3つ以上なら取っておかずに読む（末尾の道が Q89 を黙って答えないように）。取っておいた呼び出しの中の括りが残す関数（orElse）も数える：
// 返す所の括りの中で、それを足して3つ以上なら、取っておかずに呼んで下の規則（Q89 の門）に当てる（`(inc , double , (add 1 , lz n)) 5` は根と同じまだ）。
function* product(cx, row, env, line, place) {
  const sides = [];
  let r = row;
  for (; isOp(r, ","); r = r.right) sides.push(r.left);
  sides.push(r);
  const kept = []; // 消えなかった辺（keep で読んだ並び）
  let pending = null;
  for (const side of sides) {
    const tailHere = isTail(place) && !pending && kept.length < 3 && kept.every(lone);
    const s = yield evalRow(cx, side, env, line, tailHere ? "tailkeep" : "keep");
    if (s instanceof TailCall) {
      pending = s;
      continue;
    }
    if (!s.length) continue;
    if (pending) {
      const v = yield callPending(cx, pending);
      pending = null;
      if (v !== UNIT) kept.push([v]);
    }
    kept.push(s);
  }
  if (pending) {
    // 後ろの辺は全部 `!_`、前の辺は関数だけ。呼んだ答えが `!_` でなければそれが答え（前の関数は R123 で消える）、`!_` なら残るのは関数だけ。
    const fns = [...kept.map((s) => s[0]), ...(pending.orElse ? [pending.orElse] : [])];
    if (fns.length < 3 || !isKeep(place)) return fns.length === 0 ? pending : new TailCall(pending.f, pending.args, pending.line, fns.length === 1 ? fns[0] : null);
    const v = yield callPending(cx, pending);
    if (v !== UNIT) kept.push([v]);
  }
  if (kept.length <= 1) return close(kept[0] || [], place);
  const vals = kept.filter((s) => !lone(s));
  if (!vals.length && kept.length >= 3 && isKeep(place)) throw notYet("括らない `,` の鎖で関数だけが3つ以上残る形（仕様 §5 Q89）", line);
  if (vals.length <= 1) return vals[0] || [];
  if (vals.some((s) => s.some((x) => x instanceof Seq))) throw notYet("並びを `,` の辺に置く形（器の片）", line);
  // 4. `,` は段を保つ（V4、2026-11-07 の誤3）。辺が2つ以上の値なら2次元（`1 2 , 3 4` は `[1 2] , [3 4]`）で器の片。門は単位律と R123 の後
  //    （前に置くと `1 2 , !_`・`1 2 , inc` が止まる）。辺がどれも1つの値なら1次元（`1 , 2 , 3` は `1 2 3`）。
  if (vals.some((s) => s.length > 1)) throw notYet("2つ以上の値を `,` の辺に置く形（`,` は段を保つので2次元、器の片）", line);
  return vals.map((s) => s[0]);
}

function close(stack, place) {
  const top = stack[stack.length - 1];
  const keep = place === "keep" || place === "tailkeep";
  if (top instanceof Fn && (!keep || stack.length > 1)) stack.pop();
  return stack;
}

// 畳みの1歩（V3）：関数の後ろの値は適用、関数の後ろの関数は合成、ほかは積む。`!_` は値の口でも並びでも消える。
// 適用でない1歩（`!_`・合成・積む）はここで済ませて null、適用の1歩は何もせず NEED を返す（呼ぶ側が applyStep で回す。前の step を2つに分けた）。
function stepNow(cx, stack, v, line) {
  if (v === UNIT) return null;
  const top = stack[stack.length - 1];
  if (top instanceof Fn) {
    if (v instanceof Fn) {
      stack[stack.length - 1] = new Fn([...top.stages, ...v.stages]);
      return null;
    }
    return NEED;
  }
  if ((v instanceof Seq && stack.length) || stack.some((x) => x instanceof Seq)) throw notYet("並びの隣に項を積む形（器の片）", line);
  stack.push(v);
  return null;
}

// 適用の1歩（並びの頭が関数で、v が関数でない値）。tail なら、並びを空にする最後の呼び出しを呼ばずに TailCall で返す（ほかは null）。
// 関数の値に値を1つ当てる（前の feed を溶かした）。段の口が埋まれば呼び、答えは次の段へ流し、段が尽きた後の答えは並びに出す（R11・R40）。
// 段の並びはループで回す（書いた合成が長くても積まない）。
function* applyStep(cx, stack, v, line, tail) {
  const fn = stack.pop();
  const last = tail && !stack.length;
  let rest = null;
  let out = UNIT;
  let stages = fn.stages;
  for (;;) {
    if (v instanceof Seq) throw notYet("並びを関数の口へ渡す形（器の片）", line);
    const [st, ...later] = stages;
    const recv = [...st.recv, v];
    if (recv.length < st.f.params.length) {
      rest = new Fn([{ f: st.f, recv }, ...later]);
      break;
    }
    if (last && !later.length) return new TailCall(st.f, recv, line);
    const r = yield callFn(cx, st.f, recv, line);
    if (!later.length) {
      out = r;
      break;
    }
    if (r === UNIT) {
      rest = new Fn(later);
      break;
    }
    stages = later;
    v = r;
  }
  if (rest) stack.push(rest);
  if (out !== UNIT && stepNow(cx, stack, out, line) === NEED) yield applyStep(cx, stack, out, line, false);
  return null;
}

// ---------------------------------------------------------------------------
// 呼び出しと本体（V8・V10）
// ---------------------------------------------------------------------------

// 呼び出しは、関数と実引数で決まる（値は書き換えず、同じ呼び出しは同じ答え）。だから次の2つは止まらない輪で、回さずに止める（V10・V12）：
// - 答えを出している途中の呼び出しを、同じ実引数でもう一度呼ぶ（必ず読む所なら問10 で読む段が断る輪で、読む段にまだ無い。枝の中なら同じ引数の輪で眠る）。
// - 末尾呼び出しのループが前に通った状態へ戻る（アイドル。問12「アイドルでいい」の `!_ !_ = !_` の永久ループで、解釈器にはまだ無い）。Brent の方法で見つける。
function* callFn(cx, f, args, line) {
  const key = argsKey(args);
  if (reentered(cx, f, key, null)) throw notYet(REENTER, line);
  if (!enter(cx, line)) return UNIT;
  const frame = { f, args, key };
  pushFrame(cx, frame);
  try {
    let saved = frame.args;
    let savedF = f;
    let power = 1;
    let lam = 0;
    for (;;) {
      // 本体を走らせる（前の runBody を溶かした）。
      const bf = frame.f;
      const env = { vars: new Map(bf.params.map((p, i) => [p, frame.args[i]])), parent: bf.env };
      const bline = cx.lineOf(bf.body) ?? bf.line;
      const bt = singleTerm(bf.body);
      let r;
      if (bareAtom(bt) && bt.core.c === "indent") {
        // 字下げの本体（V8。前の evalBlock を溶かした）。枝（`:` の行）が有れば選び、無ければ手続き `l1 & … & ln`（R76）。
        const rows = bt.core.rows;
        r = UNIT;
        if (rows.some((x) => isOp(x, ":"))) {
          // 選び：`(c1 & v1) | … | 既定`。値が `!_` の枝は次の枝へ進む（U〔答え〕10-29 12:46、U 12:52）。
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rl = cx.lineOf(row) ?? bline;
            const last = i === rows.length - 1;
            // 枝の前か間の裸の行と2つ目からの既定の行は、読む段が名指しして止める（寄せ1 の R130、body-bare-row-between）ので、ここには来ない。来たら読む段の
            // 抜けなので、言語の `!_` に倒さず「まだ」で止める。
            if (!isOp(row, ":")) {
              if (!last) throw notYet("枝の間に置いた既定の行（読む段の R130 の抜け）", rl);
              r = yield evalRow(cx, row, env, rl, "tail");
              break;
            }
            // 本体の `:` の行は左が何でも枝で、何も定義しない（寄せ1 の R128、U〔答え〕10-29 12:18「ガイドに戻す」）。左が名前1つでも、条件として読む（未定義の名前は読む段が断る、R138）。
            // 最後でない枝の値は末尾でない（値が `!_` なら次の枝へ進むので、値を見るまで戻れない。R129）。
            if (valueOf(yield evalRow(cx, row.left, env, rl, "eval"), rl) === UNIT) continue;
            if (last) {
              r = yield evalRow(cx, row.right, env, rl, "tail");
              break;
            }
            const v = valueOf(yield evalRow(cx, row.right, env, rl, "eval"), rl);
            if (v !== UNIT) {
              r = v;
              break;
            }
          }
        } else {
          for (let i = 0; i < rows.length; i++) {
            const rl = cx.lineOf(rows[i]) ?? bline;
            if (i === rows.length - 1) {
              r = yield evalRow(cx, rows[i], env, rl, "tail");
              break;
            }
            if (valueOf(yield evalRow(cx, rows[i], env, rl, "eval"), rl) === UNIT) break;
          }
        }
      } else r = yield evalRow(cx, bf.body, env, bline, "tail");
      if (Array.isArray(r)) r = valueOf(r, bline);
      if (!(r instanceof TailCall)) return r;
      if (r.f === savedF && sameArgs(r.args, saved)) throw notYet("前に通った状態へ戻る末尾の輪（アイドル、問12）", r.line);
      if (++lam === power) {
        savedF = r.f;
        saved = r.args;
        power *= 2;
        lam = 0;
      }
      const rkey = argsKey(r.args);
      if (reentered(cx, r.f, rkey, frame)) throw notYet(REENTER, r.line);
      popFrame(cx, frame);
      frame.f = r.f;
      frame.args = r.args;
      frame.key = rkey;
      pushFrame(cx, frame);
    }
  } finally {
    popFrame(cx, frame);
    cx.nest--;
  }
}

const REENTER = "答えを出している途中の呼び出しを同じ実引数で呼ぶ輪（止まらない。読む段が断る必ず読む輪（問10）か、眠る輪（問12））";
const sameArgs = (a, b) => a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));

// 途中の呼び出しは、関数ごとに実引数の鍵で数える（cx.frames は f → (鍵 → 数)）。鍵が等しい ⟺ sameArgs（Int は値、関数は同じ値、並びは中身）。
// 並べて全部と比べると、入れ子が深い時に1回の呼び出しが深さぶんかかる（深さの2乗。上限を上げると効く）ので、数で引く（2026-11-07 の誤5）。
// 知らない種類の値は鍵を持たず、内部の誤りで止める（器の片で新しい値が入ったら足す）。
const fnIds = new WeakMap();
let fnCount = 0;
function valueKey(v) {
  if (typeof v === "bigint") return String(v);
  if (v === UNIT) return "_";
  if (v instanceof Fn) {
    let id = fnIds.get(v);
    if (id === undefined) fnIds.set(v, (id = ++fnCount));
    return `f${id}`;
  }
  if (v instanceof Seq) return `[${v.items.map(valueKey).join(" ")}]`;
  throw new Error("内部の誤り：鍵を持たない値");
}
// 1つの Int の実引数は値そのものを鍵にする（Map は BigInt を値で引くので、文字の鍵と混ざらない）。
const argsKey = (args) => (args.length === 1 && typeof args[0] === "bigint" ? args[0] : args.map(valueKey).join(","));

function reentered(cx, f, key, self) {
  const active = cx.frames.get(f);
  if (!active) return false;
  const n = active.get(key) || 0;
  return n - (self && self.f === f && self.key === key ? 1 : 0) > 0;
}

function pushFrame(cx, frame) {
  const active = cx.frames.get(frame.f);
  if (active) active.set(frame.key, (active.get(frame.key) || 0) + 1);
  else cx.frames.set(frame.f, new Map([[frame.key, 1]]));
}

// 途中の呼び出しを1つ外す。
function popFrame(cx, frame) {
  const active = cx.frames.get(frame.f);
  const n = active.get(frame.key) - 1;
  if (n) active.set(frame.key, n);
  else active.delete(frame.key);
  if (!active.size) cx.frames.delete(frame.f);
}

// ---------------------------------------------------------------------------
// 項（V5・V6）
// ---------------------------------------------------------------------------

// 子を走らせずに値が出る項は、生成器を作らずにここで畳む（速道）：印の無い字面・`!_`・走らせずに分かる名前（known）と、それを中置で1段つないだ物
// （3項の比べの連鎖も）。enter・知らせ・断りは evalTerm と同じ所で同じ順に出る。ほかの項は NEED（呼ぶ側が evalTerm で回す）。
// evalTerm の入口の順を2か所で持つので、印・芯の種類を増やす時は termNow と plainAtom も見る。
function termNow(cx, t, env, line) {
  if (!t) return NEED;
  if (t.type === "infix") {
    if (!t.left || !t.right || !INFIX.has(t.sym)) return NEED;
    const ops = infixOperands(t);
    for (const x of ops) if (!plainAtom(cx, x, env)) return NEED;
    if (!enter(cx, line)) return UNIT;
    try {
      const vals = [];
      for (const x of ops) vals.push(operandOf(atomNow(cx, x, env, line), line));
      return infixValue(cx, t, vals, line);
    } finally {
      cx.nest--;
    }
  }
  return plainAtom(cx, t, env) ? atomNow(cx, t, env, line) : NEED;
}
const plainAtom = (cx, t, env) =>
  !!t && t.type === "atom" && !t.pre.length && !t.post.length &&
  (t.core.c === "lit" || t.core.c === "unit" || (t.core.c === "name" && known(cx, t.core.name, env) !== NEED));
function atomNow(cx, t, env, line) {
  if (!enter(cx, line)) return UNIT;
  try {
    const c = t.core;
    return c.c === "lit" ? literal(c.text, line) : c.c === "unit" ? UNIT : known(cx, c.name, env);
  } finally {
    cx.nest--;
  }
}

// place は項の並びの置かれた所で、効くのは印の無い括りだけ（"tailkeep" なら括りの中も返す所）。
function* evalTerm(cx, t, env, line, place = "keep") {
  if (!t) throw notYet("被演算子の欠けた項（点なし）", line);
  if (!enter(cx, line)) return UNIT;
  try {
    // 項の値（前の termOf・evalInfix・bracketValue を溶かした）。
    if (t.type === "infix") {
      if (!t.left || !t.right) throw notYet("点なしの区間", line);
      if (!INFIX.has(t.sym)) throw notYet(`中置 \`${t.sym}\``, line);
      const vals = [];
      for (const x of infixOperands(t)) {
        let v = termNow(cx, x, env, line);
        if (v === NEED) v = yield evalTerm(cx, x, env, line);
        vals.push(operandOf(v, line));
      }
      return infixValue(cx, t, vals, line);
    }
    // 識別子の id（2026-11-09、R138。value_spec V5）：芯が id の値の印は、印に依らず `!_`（下の idMarked）。
    if (idMarked(t)) return UNIT;
    if (t.post.length) throw notYet(`後置の印 \`${t.post.join("")}\``, line);
    for (let k = 0; k < t.pre.length; k++) {
      const p = t.pre[k];
      if (p === "-") continue;
      // 書いた恒等射 `_` は、内部ではいちばん内側に前置 `!` を持つ（読む段の tokenize が足した物で、書いた印ではない。resolve.js の seatRows の注）。
      if (k === t.pre.length - 1 && t.core.c === "unit" && t.core.nId) throw notYet("恒等射 `_` の評価", line);
      throw notYet(`前置の印 \`${p}\``, line);
    }
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
        v = known(cx, c.name, env);
        if (v === NEED) v = yield lookup(cx, c.name, env, line);
        break;
      case "unit":
        v = UNIT;
        break;
      case "bracket": {
        // 括り（1行だけ。前の bracketValue）。中身を畳んで、空なら `!_`、1つならその値（[x] ≅ x。関数も）。2つ以上は器でまだ。
        // 中身が点なし（区間・前置と後置の点なし `[-_]`・片側の欠けた中置の行 `[5 |]`）なら、括り1つではないので V12 のまだ（V5・V12、2026-11-07 の誤1）。
        // 印の無い括りで place が "tailkeep" なら中身も返す所で、最後の呼び出しは TailCall で返る。
        // 書いた空の括りは、読む段の empty-written が先に断る（R138。前はここで「書いた `[]`」のまだ）。
        if (c.rows.length !== 1) throw notYet("2行以上の括り（器の片）", line);
        const row = c.rows[0];
        const inner = cx.lineOf(row) ?? line;
        if (row && row.type === "seq" && row.terms.some(hasMissing)) throw notYet("点なしの区間", inner);
        if (row && row.type === "seq" && row.terms.length === 1 && valueMarkUnit(row.terms[0])) throw notYet("前置・後置の点なし", inner);
        if (row && row.type === "op" && rowMissing(row)) throw notYet("被演算子の欠けた行（点なし）", inner);
        const st = yield evalRow(cx, row, env, inner, !t.pre.length && place === "tailkeep" ? "tailkeep" : "keep");
        if (st instanceof TailCall) return st;
        if (st.length >= 2) throw notYet("2つ以上の値の括り（器の片）", inner);
        v = st.length ? st[0] : UNIT;
        break;
      }
      default:
        throw notYet(c.c === "indent" ? "項に置いた字下げのブロック" : "絶対値・ノルム", line);
    }
    for (let i = t.pre.length - 1; i >= 0; i--) v = negate(cx, operandOf(v, line), line);
    return v;
  } finally {
    cx.nest--;
  }
}

// 識別子の id（2026-11-09、R138。value_spec V5）：芯が id の値の印か。芯が id なのは、書いた `_`（内部ではいちばん内側に前置 `!` を足した、印 nId の核。resolve.js の tokenize の
// 写し）と、それだけを1行で括った物（`(_)`・`[[_]]`。R24 の [x] ≅ x）。印は、内部で足した `!` を外した前置が `-`・`!!` だけで、後置が `!` だけの物（`-_`・`!!_`・`_!`・`-_!`・
// `!!_!`・`-(_)`）。括らない値の印の `_` は識別子が当たり、名前の id（`i : _` の i）と同じく、関数に演算子を直接充てた解なし（R87）なので `!_`。印の中身（`-`・`!!`・`!`）に
// 依らないので、前置 `-` の算術の線（10-30）の外の答えで、`!!`・後置 `!` がまだ（V12）でも同じ所で返す。根拠：U [2026-11-09 13:18:07 2617ea04]「他方で括らないというなら、
// 識別子が当たるよね。」と R87。値は、前の綴りの同じ源（void に印。U〔答え〕[2026-10-28 00:17:32 438d5b1a]「単項の -_・!!_・_! は _」、前の綴り）で repo の 3283f019 が出していた値と同じ
// （`-_ 5` は 5）。印に否定の `!` が混ざる物（`!-_`）は、否定がまだなので今のまま止まる。名前の芯（`i : _` ⏎ `-i`）も今のまま止まる（V12、定義の名前の芯）。
function idMarked(t) {
  const c = t.core;
  const own = c.c === "unit" && !!c.nId && t.pre.length > 0 && t.pre[t.pre.length - 1] === "!";
  if (!own && !bracketedId(c)) return false;
  const marks = own ? t.pre.slice(0, -1) : t.pre;
  return marks.length + t.post.length > 0 && marks.every((p) => p === "-" || p === "!!") && t.post.every((p) => p === "!");
}
// 書いた `_`（id）だけの項（内部の綴りで前置 `!` 1つと印 nId の核）。
const isIdAtom = (t) => !!t && t.type === "atom" && t.pre.length === 1 && t.pre[0] === "!" && !t.post.length && t.core.c === "unit" && !!t.core.nId;
// 芯が、id だけを1行で括った物か（`(_)`・`[[_]]`）。
function bracketedId(c) {
  if (c.c !== "bracket" || c.rows.length !== 1) return false;
  const t = singleTerm(c.rows[0]);
  return isIdAtom(t) || (bareAtom(t) && bracketedId(t.core));
}

// 芯が算術の線の内か：字面・`!_`・仮引数・定義の見えない名前と、それを算術の中置でつないだ物、それを1つ括った物。定義の見えない名前は、取り込み（後置 `@`）のある
// 範囲の名前だけが来て（ほかは読む段の name-undefined が先に断る、R138）、値は lookup が V12 のまだで止める。前（R111）は `!_` と読んでいた。
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

// 括りの中身の点なし（evalTerm の括りの門）。区間の形の項か。
const hasMissing = (t) => !t || (t.type === "infix" && (hasMissing(t.left) || hasMissing(t.right)));
// 前置・後置の点なしの項：値の前置の印1つ（`-`・`!`・`!!`）か後置の `!` 1つと、核の書いた `_` だけ（`-_`・`!_`・`!!_`・`_!`、点なしの席）。席の外の `_`（内部で前置 `!` を足した id、印 nId）は除く。
// resolve.js の同じ名前の形の写し（import すると V1 の口が増えるので写す）。芯を括った `-(_)` は核が括りなので入らない（V5）。
const VALUE_PREFIX = new Set(["-", "!", "!!"]);
const valueMarkUnit = (t) =>
  !!t && t.type === "atom" && t.core.c === "unit" && !t.core.nId && t.pre.length + t.post.length === 1 &&
  ((t.pre.length === 1 && VALUE_PREFIX.has(t.pre[0])) || (t.post.length === 1 && t.post[0] === "!"));
// 行の中置（段1〜9）のどこかの被演算子が欠けているか（`[5 |]`・入れ子の `[3 | 2 +]`・`[5 ; 3 |]`）。並びの項は区間の形だけを見て、中の括りへは降りない（V12）。
const rowMissing = (r) => !r || (r.type === "op" ? rowMissing(r.left) || rowMissing(r.right) : r.terms.some(hasMissing));

// 値の演算子の被演算子は評価する所（R87）：関数は `!_`。並びは器の片でまだ。
function operandOf(v, line) {
  if (v instanceof Fn) return UNIT;
  if (v instanceof Seq) throw notYet("並びを値の演算子に当てる形（器の片）", line);
  return v;
}

const ARITH = new Set(["+", "-", "*", "/", "%", "^"]);
const ORDER = new Set(["<", "<=", ">", ">="]);
// 値の段が持つ中置（ほかは V12 のまだ）。
const INFIX = new Set([...ARITH, ...ORDER, "="]);

// 中置の被演算子を、評価する順に。括らない3項の比べの連鎖は3つ（真ん中の中置は項として走らせない）。速道（termNow）と生成器（evalTerm）が同じ1か所を使う。
const infixOperands = (t) => (ORDER.has(t.sym) && t.left.type === "infix" && ORDER.has(t.left.sym) ? [t.left.left, t.left.right, t.right] : [t.left, t.right]);

// 被演算子の値（operandOf の後）から中置の値（前の evalInfix の値の計算）。
function infixValue(cx, t, vals, line) {
  if (ARITH.has(t.sym)) return arith(cx, t.sym, vals[0], vals[1], line);
  if (ORDER.has(t.sym)) {
    // 括らない3項の連鎖（読む段が通すのは向きの揃った3項の範囲だけで、`<` と `<=`、`>` と `>=` は混ぜてもいい。2026-11-06 の寄せ5）：
    // 成り立てば真ん中、外れたら `!_`（R119、U 11-04。`0 <= 0 < 5` は 0、`0 <= 5 < 5` は `!_`）。
    if (vals.length === 3) {
      const [a, b, c] = vals;
      if (a === UNIT || b === UNIT || c === UNIT) return UNIT;
      return holds(t.left.sym, a, b) && holds(t.sym, b, c) ? b : UNIT;
    }
    const [a, b] = vals;
    // 成り立てば左、外れたら `!_`（0/1 の例外なし、U 10-27 23:01・U〔答え〕23:5x）。どちらかが `!_` なら `!_`（U 11-04）。
    if (a === UNIT || b === UNIT) return UNIT;
    return holds(t.sym, a, b) ? a : UNIT;
  }
  // Int の `=`（2026-11-06 の寄せ5、R119・V6）：`==` と同じ値で、等しければ左、違えば `!_`、どちらかが `!_` なら `!_`。
  // 連鎖（`1 = 1 = 1`）は左の背骨の左畳みで、全部等しければ一番左、どこかが違えば `!_`。並び・番地・文字の `=` は V12 のまま（並びは operandOf が止める）。
  const [a, b] = vals;
  if (a === UNIT || b === UNIT) return UNIT;
  return a === b ? a : UNIT;
}

function holds(sym, a, b) {
  return sym === "<" ? a < b : sym === "<=" ? a <= b : sym === ">" ? a > b : a >= b;
}

// 算術（V5、U〔答え〕10-28 00:0x）。`!_` は両側の単位（`!_ - 2` は 2）。
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
        notice(cx, "no-operation", line); // 負の指数の冪は `!_`
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
