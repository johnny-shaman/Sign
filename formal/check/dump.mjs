// node --stack-size=8000 dump.mjs <srcs.json> [--pretty] [--all-trees] [--max-rows-elsewhere=N]
//
// alpha1 の読む段（resolve.js）を節ごとに見せる。入力は probe.mjs と同じ（源の文字列の JSON 配列、未定義の名前には STD を前に付ける。
// "#raw\n" で始まる源は付けない）。出力は源ごとに JSON 1つ（既定は1行に1つ、--pretty なら字下げ）。
//
// 仕組み：リポジトリの resolve.js を読み、関数をいくつか包んだ写し（out/.gen/resolve_hooked_<sha1>.mjs）をこのディレクトリの下に書いて読み込む（リポジトリは
// 変えない）。包むのは名前の付け替えだけ（`function f(` → `function f__orig(` と、同じ名前の包み）で、答えは変えない。毎回、包まない resolve.js の
// 木・知らせ・断りと突き合わせ、合わなければ "agree" に false を出す。値は包まない interpret.js で取る。
import { pathToFileURL, fileURLToPath } from "url";
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_JS = path.resolve(HERE, "../../alpha1/javascript").split(path.sep).join("/");
const GEN_DIR = path.join(HERE, "out", ".gen");

const args = process.argv.slice(2);
const opt = (name) => args.includes(name);
const optVal = (name, d) => {
  const a = args.find((x) => x.startsWith(name + "="));
  return a ? a.slice(name.length + 1) : d;
};
const srcFile = args.find((a) => !a.startsWith("--"));
if (!srcFile) {
  console.error("usage: node --stack-size=8000 dump.mjs <srcs.json> [--pretty] [--all-trees] [--max-rows-elsewhere=N]");
  process.exit(2);
}
const PRETTY = opt("--pretty");
const ALL_TREES = opt("--all-trees");
const MAX_ELSEWHERE = Number(optVal("--max-rows-elsewhere", "60"));

// ---------------------------------------------------------------------------
// 1. 包んだ写しを作る
// ---------------------------------------------------------------------------

const WRAPPED = [
  "foldStep", "reduceItems", "foldItems", "holeSeq", "subHole", "leftoverUnit", "classify", "classifyInfix", "addressOp", "pushDiag",
  "reportLeftover", "reportLift", "reportUnsized", "bareReturnUnit", "noteExcess", "reportNotFolded", "closedStep", "streamStep", "spliceStep",
  "holeStep", "markStep",
];

function buildHooked() {
  const srcPath = path.join(REPO_JS, "resolve.js");
  let text = fs.readFileSync(srcPath, "utf8");
  const hash = crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
  const out = path.join(GEN_DIR, `resolve_hooked_${hash}.mjs`);
  if (fs.existsSync(out)) return { out, hash };
  const once = (from, to) => {
    const n = text.split(from).length - 1;
    if (n !== 1) throw new Error(`patch anchor ${JSON.stringify(from)} found ${n} times (expected 1)`);
    text = text.replace(from, to);
  };
  const url = (f) => pathToFileURL(path.join(REPO_JS, f)).href;
  const peggyPath = createRequire(path.join(REPO_JS, "package.json")).resolve("peggy");
  once(`import peggy from "peggy";`, `import peggy from ${JSON.stringify(pathToFileURL(peggyPath).href)};`);
  once(`from "./lexer.js";`, `from ${JSON.stringify(url("lexer.js"))};`);
  once(`from "./operator_table.js";`, `from ${JSON.stringify(url("operator_table.js"))};`);
  once(`from "./errors.js";`, `from ${JSON.stringify(url("errors.js"))};`);
  once(`const dir = path.dirname(fileURLToPath(import.meta.url));`, `const dir = ${JSON.stringify(REPO_JS)};`);
  for (const f of WRAPPED) once(`\nfunction ${f}(`, `\nfunction ${f}__orig(`);
  const wrappers = WRAPPED.map(
    (f) => `function ${f}(...a) {\n  if (!__H) return ${f}__orig(...a);\n  return __wrap(${JSON.stringify(f)}, ${f}__orig, a);\n}`
  ).join("\n");
  text += `
// ---- dump.mjs の包み（リポジトリの resolve.js には無い） ----
let __H = null;
export function __setHook(h) { __H = h; }
function __wrap(name, f, a) {
  const tok = __H.enter(name, a);
  let r;
  try {
    r = f(...a);
  } catch (e) {
    __H.exit(tok, undefined, e);
    throw e;
  }
  __H.exit(tok, r, null);
  return r;
}
export const __internals = {
  intTerm: (t, v, c) => intTerm(t, v, c),
  isMark: (x) => isMark(x),
  isHoleItem: (x) => isHoleItem(x),
  isSpreadNode: (x) => isSpreadNode(x),
  writeTerm: (t) => writeTerm(t),
  writeTree: (t) => writeTree(t),
  showView: (v) => showView(v),
  isIdentityKind: (k) => isIdentityKind(k),
  foldSeq: () => foldSeq,
  peeking: () => peeking,
  WrittenEmptyAtValue,
  OperationError,
};
${wrappers}
`;
  fs.mkdirSync(GEN_DIR, { recursive: true });
  fs.writeFileSync(out, text);
  return { out, hash };
}

const { out: hookedPath, hash: srcHash } = buildHooked();
const H = await import(pathToFileURL(hookedPath).href);
const O = await import(pathToFileURL(path.join(REPO_JS, "resolve.js")).href);
const V = await import(pathToFileURL(path.join(REPO_JS, "interpret.js")).href);
const { OperationError } = await import(pathToFileURL(path.join(REPO_JS, "errors.js")).href);
const I = H.__internals;

// ---------------------------------------------------------------------------
// 2. 記録係
// ---------------------------------------------------------------------------

function newRecorder() {
  const R = {
    stack: [], // 包んだ呼び出しの枠
    rows: [], // reduceItems ごとに1つ
    rowByItems: new Map(), // items の配列 → 行
    rowStack: [],
    viewKids: new WeakMap(), // classify の答えの view → その中で直に classify した物 [{term, c}]
    viewInt: new WeakMap(), // classify の答えの view → intTerm（R97・R98 の Int か）
    viewAddr: new WeakMap(), // 中置の項の答えの view → addressOp の記録
    addrOps: [], // addressOp の記録の全部
    diagSubject: new WeakMap(), // 知らせ → {reporter, tree, at, term}
  };
  const top = () => R.stack[R.stack.length - 1];
  const curRow = () => R.rowStack[R.rowStack.length - 1];
  R.enter = (name, a) => {
    const fr = { name, a, kids: null, flags: [] };
    if (name === "classify" || name === "classifyInfix") fr.kids = [];
    if (name === "foldStep") {
      const st = a[0];
      const t0 = st.stack[st.stack.length - 1];
      const fs0 = I.foldSeq();
      fr.before = {
        len: st.stack.length,
        top: t0,
        logLen: t0 && t0.t === "fn" ? t0.log.length : -1,
        item: st.items[a[1]],
        stopped: !!(fs0 && fs0.stop),
      };
    }
    if (name === "reduceItems") {
      const [items, ctx, evaluate = false, closeIdle = true, bodyRoot = false, rereading = false] = a;
      const row = {
        id: R.rows.length,
        items,
        line: ctx && ctx.F ? ctx.F.line : undefined,
        flags: { evaluate: !!evaluate, evaluatePlace: evaluate && typeof evaluate === "object" ? evaluate.sym || true : null, closeIdle, bodyRoot, rereading, peeking: I.peeking() > 0 },
        parent: curRow() ? curRow().id : null,
        attempts: [],
        result: null,
        error: null,
      };
      R.rows.push(row);
      if (!R.rowByItems.has(items)) R.rowByItems.set(items, row);
      R.rowStack.push(row);
      fr.row = row;
    }
    if (name === "foldItems") {
      const row = curRow();
      const att = { items: a[0], path: null, steps: [], leftovers: [], subHole: null, hole: false };
      if (row) row.attempts.push(att);
      fr.att = att;
    }
    R.stack.push(fr);
    return fr;
  };
  R.exit = (fr, r, err) => {
    R.stack.pop();
    const parent = top();
    const row = curRow();
    const att = row && row.attempts[row.attempts.length - 1];
    switch (fr.name) {
      case "classify":
      case "classifyInfix": {
        if (!err && r) {
          if (fr.kids.length) {
            const prev = R.viewKids.get(r.view);
            R.viewKids.set(r.view, prev ? prev.concat(fr.kids) : fr.kids);
          }
          if (fr.name === "classify") {
            try {
              R.viewInt.set(r.view, I.intTerm(fr.a[0], r.view, fr.a[1]));
            } catch (e) {
              /* 読むだけの intTerm が投げても、記録しないだけ */
            }
          }
          if (fr.addr) R.viewAddr.set(r.view, fr.addr);
          if (parent && parent.kids) parent.kids.push({ term: fr.a[0], c: r });
        }
        break;
      }
      case "addressOp": {
        const [sym, lf, rf, textF, , info] = fr.a;
        let text = null;
        try {
          text = typeof textF === "function" ? textF() : null;
        } catch (e) {
          /* 綴りが作れなければ null */
        }
        const rec = {
          sym,
          faces: [lf, rf],
          info: (info || [null, null]).map(compactInfo),
          result: err ? null : r ? compactDesc(r) : null,
          answer_kind: err ? null : r ? answerKind(r) : "not an address op (null: ordinary reading)",
          refusal: err ? refusalOf(err) : null,
          spelling: text,
          from: parent && parent.name === "classifyInfix" ? "classifyInfix" : "resolveTreeIn (==/!==)",
        };
        R.addrOps.push(rec);
        if (parent && parent.name === "classifyInfix") parent.addr = rec;
        break;
      }
      case "foldStep": {
        if (att) att.steps.push(stepRecord(fr, err));
        break;
      }
      case "closedStep":
      case "streamStep":
      case "spliceStep":
      case "holeStep":
      case "markStep": {
        if (fr.name === "holeStep" || r) {
          const step = R.stack.slice().reverse().find((f) => f.name === "foldStep");
          if (step) step.flags.push(fr.name);
        }
        break;
      }
      case "holeSeq": {
        if (att && r) att.hole = true;
        break;
      }
      case "subHole": {
        if (att && r) att.subHole = { at: fr.a[1], tree: r };
        break;
      }
      case "leftoverUnit": {
        if (att && !err) att.leftovers.push({ tree: fr.a[0], quiet: !!fr.a[4], unit: r });
        break;
      }
      case "foldItems": {
        const a2 = fr.att;
        if (a2) {
          a2.result = err ? null : r;
          a2.error = err ? refusalOf(err) : null;
          a2.path = err
            ? err.unitLaw
              ? "identity split (internal G18, R126): refolded without the identity"
              : err instanceof I.WrittenEmptyAtValue
              ? "reread as written !_ (WrittenEmptyAtValue)"
              : "refusal"
            : a2.items.length === 1
            ? "single item"
            : a2.hole
            ? "hole row (R16/R34, holeSeq)"
            : a2.steps.length === 0
            ? "single item before written !_ (R28/R43)"
            : a2.subHole
            ? `fold, then sub-hole at item ${a2.subHole.at} (subHole)`
            : "fold";
        }
        break;
      }
      case "reduceItems": {
        const rw = fr.row;
        R.rowStack.pop();
        rw.result = err ? null : r;
        rw.error = err ? refusalOf(err) : null;
        break;
      }
      case "pushDiag": {
        const ctx = fr.a[0];
        const d = ctx && ctx.diag && ctx.diag[ctx.diag.length - 1];
        if (d && !err) {
          const rep = R.stack.slice().reverse().find((f) => REPORTERS.has(f.name));
          const at = fr.a[4];
          R.diagSubject.set(d, rep ? subjectOf(rep, at) : { reporter: "pushDiag", at });
        }
        break;
      }
    }
  };
  return R;
}

const REPORTERS = new Set(["reportLeftover", "reportLift", "reportUnsized", "bareReturnUnit", "noteExcess", "reportNotFolded"]);
function subjectOf(fr, at) {
  const a = fr.a;
  switch (fr.name) {
    case "reportLeftover":
      return { reporter: fr.name, tree: a[0], at: a[2] || at };
    case "reportLift":
      return { reporter: fr.name, term: a[0] };
    case "reportUnsized":
      return { reporter: fr.name, tree: a[1] };
    case "bareReturnUnit":
      return { reporter: fr.name, tree: a[0], at: a[2] };
    case "noteExcess":
      return { reporter: fr.name, args: a[1] };
    case "reportNotFolded":
      return { reporter: fr.name, row: a[0] };
  }
  return { reporter: fr.name };
}

// 畳み込みの1歩（foldStep）の前後から、その項に取った読みを決める（resolve.js の foldStep の枝と同じ分け方）。
function stepRecord(fr, err) {
  const st = fr.a[0];
  const i = fr.a[1];
  const b = fr.before;
  const x = b.item;
  const after = st.stack;
  const topA = after[after.length - 1];
  const prev = b.top;
  const flags = fr.flags;
  let decision;
  let cls;
  const events = prev && prev.t === "fn" ? prev.log.slice(b.logLen) : [];
  const fs1 = I.foldSeq();
  if (err) {
    if (err instanceof I.WrittenEmptyAtValue) [decision, cls] = ["reread as written !_ (R94/R112/R137, WrittenEmptyAtValue)", "reread"];
    else if (err.unitLaw) [decision, cls] = ["identity split (internal G18, R126): row refolded without the identity", "unit law"];
    else if (err instanceof OperationError) [decision, cls] = ["refusal: " + (err.reason || "") + (err.gate ? " " + err.gate : ""), "refusal"];
    else [decision, cls] = ["error: " + (err.constructor && err.constructor.name), "error"];
  } else if (flags.includes("markStep") || I.isMark(x)) [decision, cls] = ["written !_ mark (markStep, R28/R43/R105)", "mark"];
  else if (flags.includes("closedStep")) [decision, cls] = ["closed unsized application takes the rest (closedStep, R143)", "apply"];
  else if (fs1 && fs1.stop && !b.stopped) [decision, cls] = ["unsized container closes the application (R143)", "apply"];
  else if (after.length > b.len) {
    if (topA && topA.t === "fn") {
      if (!prev) [decision, cls] = ["head function: starts an entry", "head"];
      else if (prev.t === "fn") [decision, cls] = ["close unknown-arity function, stack new function (R120)", "compose-or-stack (predicted)"];
      else [decision, cls] = ["A L: function stacked on the value, takes items to its right (R47)", "no reading"];
    } else {
      const k = x && x.kind ? x.kind.k : null;
      if (!prev) [decision, cls] = [k === "U" ? "head value (unknown kind, predicted)" : "head value", "head"];
      else [decision, cls] = [k === "U" ? "stacked next to value (unknown kind: construct predicted, R120)" : "A A: construct", "construct"];
    }
  } else if (events.some((e) => e.k === "compose")) [decision, cls] = ["L L: compose (addGroup)", "compose"];
  else if (events.some((e) => e.k === "arg")) {
    const how = flags.includes("streamStep") ? "stream into mouths (R51)" : flags.includes("spliceStep") ? "splice into mouths (R142/R143)" : "feed the first open mouth";
    const sat = topA !== prev ? ", saturated" : "";
    const k = x && x.kind ? x.kind.k : null;
    [decision, cls] = [`L A: apply (${how}${sat})${k === "U" ? " [item kind unknown: predicted, R120]" : ""}`, "apply"];
  } else if (prev && prev.t === "fn" && topA && topA.t === "fn" && topA !== prev) [decision, cls] = ["identity at the head dropped by unit law (R74)", "unit law"];
  else if (after.length < b.len) [decision, cls] = ["stack shrank (spliceDone/unit pop)", "other"];
  else [decision, cls] = ["no visible change", "other"];
  if (flags.includes("holeStep")) decision = "written _ (holeStep, R44/R46) -> " + decision;
  return {
    i,
    item: safeShow(x),
    item_kind: x ? O.kindOf(x) : null,
    item_cat: x ? x.cat || x.t : null,
    top_before: !prev ? "empty" : prev.t === "fn" ? "open function" : "value(" + O.kindOf(prev) + ")",
    decision,
    class: cls,
  };
}

// ---------------------------------------------------------------------------
// 3. 種類の綴り
// ---------------------------------------------------------------------------

function compactFn(fn, depth = 0) {
  if (!fn || typeof fn !== "object") return fn || null;
  const o = { type: fn.type };
  for (const k of ["origin", "n", "sym", "label", "rest", "restAt", "lastBracket", "pointfree", "vop"]) if (fn[k] !== undefined && typeof fn[k] !== "function" && typeof fn[k] !== "object") o[k] = fn[k];
  if (fn.type === "compose" && Array.isArray(fn.fns) && depth < 3) o.fns = fn.fns.map((f) => compactFn(f, depth + 1));
  if (fn.map && depth < 3) o.map = compactFn(fn.map, depth + 1);
  if (fn.key !== undefined && fn.key !== null) o.key = typeof fn.key === "object" ? JSON.stringify(fn.key, bigRep) : fn.key;
  return o;
}
function compactDesc(d, depth = 0) {
  if (!d || typeof d !== "object") return d || null;
  if (depth > 4) return { k: d.k, cut: true };
  const o = { k: d.k };
  if (d.fn) o.fn = compactFn(d.fn);
  if (d.zero) o.zero = true;
  if (d.ref) o.ref = compactFn(d.ref);
  if (d.vref) o.vref = d.vref.selfOf ? { selfOf: true } : compactDesc(d.vref, depth + 1);
  if (d.addr) o.addr = d.addr;
  if (d.w) o.w = d.w;
  if (d.lift) o.lift = true;
  if (d.spread) o.spread = true;
  if (d.of) o.of = compactDesc(d.of, depth + 1);
  if (d.seqOf) o.seqOf = true;
  if (typeof d.len === "number") o.len = d.len;
  if (d.pv) o.paramTag = true;
  if (d.shape) {
    const s = d.shape;
    o.shape = s.s === "list" ? { s: "list", elem: s.elem ? compactDesc(s.elem, depth + 1) : null } : s.s === "struct" ? { s: "struct", fields: s.fields.map((f) => f.name) } : { s: s.s };
  }
  if (Array.isArray(d.elements)) o.elements = d.elements.map((e) => (typeof e === "string" ? e : compactDesc(e, depth + 1)));
  return o;
}
const FN_TEXT = {
  plain: "plain function",
  pattern: "bracket-param function",
  compose: "composition",
  id: "identity _",
  norm: "norm",
  input: "input @x (arity unknown)",
  other: "function of unknown arity",
  pfUnary: "pointfree unary section",
  pfSeat: "pointfree prefix/postfix seat",
  pfGreedyUnary: "greedy unary (map)",
  pfUnknownArity: "pointfree of unknown arity",
  pfFold: "folding binary pointfree",
  pfBinary: "non-folding binary pointfree",
  pfPick: "stage-18 pick pointfree",
};
// 読む段の desc（と葉の cat）から、細かい答えの種類の綴りを作る（resolve.js の refOf・vrefOf・addrOf・liftOf・zeroOf・isScalar と同じ見分け）。
function answerKind(d, cat) {
  if (cat === "unit") return "!_ (written void, or evaluated leftover `(unit f)`)";
  if (cat === "hole") return "_ (placed: hole/identity decided by position, §3.5)";
  if (cat === "input") return "input @x (target unknown)";
  if (!d) return null;
  if (d.k === "U") return d.seqOf ? "unknown (opaque sequence)" : "unknown";
  if (d.k === "L") {
    const f = d.fn;
    if (!f) return "function";
    const n = f.n !== undefined ? ` n=${f.n}` : "";
    return `function: ${FN_TEXT[f.type] || f.type}${f.sym ? " [" + f.sym + "]" : ""}${n}${f.origin && f.origin !== "plain" ? " (" + f.origin + ")" : ""}`;
  }
  if (d.k !== "A") return String(d.k);
  if (d.spread) return "spread stream (A~)" + (d.of ? " of " + answerKind(d.of) : "");
  if (d.ref) return "function address ($f, R49)";
  if (d.vref) return "value reference ($v) = Address point (R60/R62)" + (d.w ? ` w=${d.w}` : "");
  if (d.addr === "pt") return "Address point (shifted, R62)" + (d.w ? ` w=${d.w}` : "");
  if (d.addr === "diff") return "Address difference (R62)";
  if (d.lift) return "lift ($ of unknown target)";
  if (d.zero) return "!_ known value (zero mark, R49/R63)";
  if (d.shape && d.shape.s === "scalar") return "number (scalar: Int/UInt/Char/Float not distinguished by desc)";
  if (d.shape && d.shape.s === "list") return "List" + (d.shape.elem ? " of " + answerKind(d.shape.elem) : " (empty string)");
  if (d.shape && d.shape.s === "struct") return "struct {" + d.shape.fields.map((f) => f.name).join(" ") + "}";
  if (Array.isArray(d.elements) && d.elements.length === 0) return "empty bracket []";
  return "opaque value A";
}
// 字面の綴りの種類（文法 sign.pegjs の Atom の順。読む段の litDesc は文字列・番地・ほかの3つにしか分けない）。
function litClass(text) {
  if (/^`[^`]*`$/.test(text)) return "String";
  if (/^\\./.test(text)) return "Char";
  if (/^[0-9]+x[0-9a-fA-F]+$/.test(text)) return "Address literal";
  if (/^0r[0-9a-fA-F]+$/.test(text) || /^0b[01]+$/.test(text)) return "register UInt";
  if (/^[0-9]+u[0-9a-fA-F]+$/.test(text)) return "char code (unicode)";
  if (/^-?[0-9]+$/.test(text)) return "Int";
  if (/^-?[0-9]+\.[0-9]*$/.test(text)) return "Float";
  return "other";
}
function bigRep(k, v) {
  return typeof v === "bigint" ? (v < 0n ? "-0x" + (-v).toString(16) : "0x" + v.toString(16)) : v;
}
function compactInfo(x) {
  if (!x) return null;
  return JSON.parse(JSON.stringify(x, bigRep));
}
function refusalOf(e) {
  if (!e) return null;
  return {
    reason: e.reason || null,
    gate: e.gate || null,
    line: e.line === undefined ? null : e.line,
    spec: e.spec || null,
    error_class: e.constructor ? e.constructor.name : typeof e,
    message: String(e.message || "").slice(0, 240),
  };
}
function safeShow(t) {
  try {
    return O.show(t);
  } catch (e) {
    return "?" + (t && t.t);
  }
}

// ---------------------------------------------------------------------------
// 4. 木を JSON にする
// ---------------------------------------------------------------------------

function termLabel(term) {
  if (!term) return null;
  if (term.type === "infix") return "infix " + term.sym;
  if (term.type !== "atom") return term.type;
  const marks = (term.pre || []).join("") + "·" + (term.post || []).join("");
  const core = term.core.c === "unit" ? (term.core.nId ? "unit(_ written)" : "unit(!_ written)") : term.core.c;
  return marks === "·" ? core : `${core} marks ${marks}`;
}

function dumpTree(root, R, ctxOut) {
  let next = 0;
  const nodes = []; // id → {node, json}
  const seen = new WeakMap();
  const opView = (view) => (view && view.v === "infix" ? view.sym : null);
  const leafLabel = (t) => {
    const term = t.term;
    if (t.holeParam) return "hole param";
    if (term && term.type === "infix") return term.sym;
    if (t.view && t.view.v === "infix") return t.view.sym;
    if (t.cat === "unit") return "!_";
    if (t.cat === "hole") return "_";
    if (!term) return t.view && t.view.v === "block" ? "block" : "leaf";
    if (term.type !== "atom") return term.type;
    const c = term.core.c;
    const hasMarks = term.pre.length || term.post.length;
    const base = c === "lit" ? "literal" : c === "name" ? "name" : c === "bracket" ? "bracket" : c === "abs" ? "abs |…|" : c === "norm" ? "norm ||…||" : c === "indent" ? "block" : c;
    return hasMarks ? `${term.pre.join("")}${base}${term.post.join("")}` : base;
  };
  const flagsOf = (t) => {
    const f = [];
    for (const k of ["saturated", "unsized", "valueOnly", "placeWrap", "opaqueSeq", "knownUnit", "holeParam", "isLambdaName", "isQBracket", "flat", "spliceElems", "unsizedSeq"]) if (t[k]) f.push(k);
    if (t.writtenEmpty) f.push("writtenEmpty");
    if (t.undecided) f.push("undecided");
    if (t.fnMaybe) f.push("fnMaybe");
    return f;
  };
  // 中置の項の被演算子（葉の term から、classify の記録で見る。読む段は葉の desc しか残さないので、ここは記録から起こす）。
  const operandNodes = (view, term, depth) => {
    const kids = R.viewKids.get(view) || [];
    const out = [];
    if (!term || depth > 60) return out;
    const pick = (sub, role) => {
      if (!sub) return;
      const k = [...kids].reverse().find((x) => x.term === sub);
      if (k) out.push({ role, node: operandNode(sub, k.c, depth + 1) });
      else out.push({ role, node: { id: next++, node: "operand", label: termLabel(sub), show: I.writeTerm(sub), kind: null, desc: null, answer_kind: null, spelling: I.writeTerm(sub), term: termLabel(sub), note: "not classified here (stage-18 key of ' or @, or classification not recorded)", recomputed: true } });
    };
    if (term.type === "infix") {
      pick(term.left, "operand-left");
      pick(term.right, "operand-right");
    } else if (term.type === "atom" && (term.pre.length || term.post.length)) {
      const marks = (t) => t.pre.length + t.post.length;
      const k = [...kids].reverse().find((x) => x.term && x.term !== term && x.c && x.c.view !== view && x.term.type === "atom" && x.term.core === term.core && marks(x.term) < marks(term));
      if (k) out.push({ role: "core", node: operandNode(k.term, k.c, depth + 1) });
    }
    return out;
  };
  const operandNode = (term, c, depth) => {
    const id = next++;
    const j = {
      id,
      node: "operand",
      label: term.type === "infix" ? term.sym : leafLabel({ term, cat: c.cat, view: c.view }),
      show: c.view ? I.showView(c.view) : I.writeTerm(term),
      kind: c.desc ? (c.desc.k === "A" ? "A" : c.desc.k === "L" ? "L" : c.desc.k === "U" ? "未知" : null) : null,
      desc: compactDesc(c.desc),
      answer_kind: answerKind(c.desc, c.cat),
      cat: c.cat,
      spelling: I.writeTerm(term),
      term: termLabel(term),
      int: R.viewInt.has(c.view) ? R.viewInt.get(c.view) : null,
      recomputed: true,
    };
    const addr = R.viewAddr.get(c.view);
    if (addr) { addr.attached = true; j.address_op = addr; }
    if (term.type === "atom" && term.core.c === "lit") ctxOut.literals.push({ node: id, spelling: term.core.text, lit_class: litClass(term.core.text), kind: j.kind, desc: j.desc, answer_kind: j.answer_kind, int: j.int, attached: false, marks: (term.pre || []).join("") + (term.post || []).join("") || null });
    nodes.push({ t: null, term, view: c.view, json: j });
    const ch = [];
    if (c.view && Array.isArray(c.view.inner)) c.view.inner.forEach((x) => ch.push({ role: "bracket", node: walk(x, depth + 1) }));
    if (c.view && c.view.v === "block" && Array.isArray(c.view.rows)) c.view.rows.forEach((x) => ch.push({ role: "block-row", node: walk(x, depth + 1) }));
    if (!(c.view && Array.isArray(c.view.inner) && c.view.inner.length)) ch.push(...operandNodes(c.view, term, depth));
    if (ch.length) j.children = ch;
    return j;
  };
  const walk = (t, depth = 0) => {
    if (t === null || t === undefined) return { id: next++, node: null, label: "·", show: "·", kind: null };
    if (typeof t !== "object") return { id: next++, node: typeof t, show: String(t) };
    if (seen.has(t)) return { id: next++, node: "ref", ref: seen.get(t), show: safeShow(t), kind: O.kindOf(t) };
    if (depth > 200) return { id: next++, node: "cut", show: safeShow(t), kind: O.kindOf(t) };
    const id = next++;
    seen.set(t, id);
    const j = { id, node: t.t, label: null, show: safeShow(t), kind: O.kindOf(t), desc: compactDesc(t.kind || t.desc), answer_kind: null };
    nodes.push({ t, term: t.term || null, view: t.view || null, json: j });
    const ch = [];
    switch (t.t) {
      case "leaf":
      case "raw": {
        j.label = t.t === "raw" ? "raw (written, not resolved: left of `:`)" : leafLabel(t);
        j.cat = t.cat || null;
        j.spelling = t.view ? I.showView(t.view) : null;
        j.term = termLabel(t.term);
        j.answer_kind = answerKind(t.desc || t.kind, t.cat);
        if (t.view && R.viewInt.has(t.view)) j.int = R.viewInt.get(t.view);
        const addr = t.view && R.viewAddr.get(t.view);
        if (addr) { addr.attached = true; j.address_op = addr; }
        if (t.term && t.term.type === "atom" && t.term.core.c === "lit") {
          ctxOut.literals.push({ node: id, spelling: t.term.core.text, lit_class: litClass(t.term.core.text), kind: j.kind, desc: j.desc, answer_kind: j.answer_kind, int: j.int === undefined ? null : j.int, attached: true, marks: t.term.pre.join("") + t.term.post.join("") || null });
        }
        if (t.view && Array.isArray(t.view.inner)) t.view.inner.forEach((x) => ch.push({ role: "bracket", node: walk(x, depth + 1) }));
        if (t.view && t.view.v === "block" && Array.isArray(t.view.rows)) t.view.rows.forEach((x) => ch.push({ role: "block-row", node: walk(x, depth + 1) }));
        if (t.view && !(Array.isArray(t.view.inner) && t.view.inner.length)) ch.push(...operandNodes(t.view, t.term, depth));
        break;
      }
      case "construct":
        j.label = "construct";
        t.items.forEach((x) => ch.push({ role: "item", node: walk(x, depth + 1) }));
        break;
      case "compose":
        j.label = "compose";
        t.items.forEach((x) => ch.push({ role: "item", node: walk(x, depth + 1) }));
        break;
      case "apply":
        j.label = "apply";
        ch.push({ role: "head", node: walk(t.head, depth + 1) });
        ch.push({ role: "arg", node: walk(t.arg, depth + 1) });
        break;
      case "unit":
        j.label = "unit (!_: no reading / leftover)";
        ch.push({ role: "inner", node: walk(t.inner, depth + 1) });
        break;
      case "hole":
        j.label = "hole function (? [$p…])";
        j.params = t.params;
        ch.push({ role: "body", node: walk(t.body, depth + 1) });
        break;
      case "lambda":
        j.label = t.pattern ? "lambda (bracket-param, R24)" : "lambda ?";
        j.params = t.paramsText;
        if (t.pattern) {
          const insts = t.pattern.insts || [];
          if (!insts.length) j.deferred = t.pattern.deferText;
          insts.forEach((x) => ch.push({ role: "inst", shape: x.shapeText, node: walk(x.tree, depth + 1) }));
        } else if (t.body !== undefined) ch.push({ role: "body", node: walk(t.body, depth + 1) });
        break;
      case "op":
        j.label = t.sym;
        if (t.fieldName) j.fieldName = t.fieldName;
        ch.push({ role: "left", node: walk(t.left, depth + 1) });
        ch.push({ role: "right", node: walk(t.right, depth + 1) });
        break;
      default:
        j.label = String(t.t);
    }
    if (!j.answer_kind) j.answer_kind = answerKind(t.kind || t.desc, t.cat);
    const fl = flagsOf(t);
    if (fl.length) j.flags = fl;
    if (Array.isArray(t.written)) ctxOut.rowNodes.push({ node: id, tree: t });
    if (ch.length) j.children = ch;
    return j;
  };
  const json = walk(root);
  return { json, nodes };
}

// ---------------------------------------------------------------------------
// 5. 行（並置の畳み）と知らせを木に付ける
// ---------------------------------------------------------------------------

const COARSE = { construct: "construct", compose: "compose", apply: "apply", unit: "no reading (leftover -> !_)", hole: "hole function (R16/R34)", leaf: "single item", lambda: "lambda", op: "infix op" };
function shapeDecision(t) {
  if (!t) return null;
  return COARSE[t.t] || t.t;
}
function rowInfo(rowNode, idx, R, nodeIdOf, diags) {
  const t = rowNode.tree;
  const items = t.written;
  const rec = R.rowByItems.get(items) || null;
  // readWrittenEmpty（R94・R112・R137）は同じ並びを rereading の reduceItems で読み直すので、外の行に試しが無ければ、子の読み直しの行の最後の試しを見る。
  let src = rec;
  let rereads = 0;
  if (rec && !rec.attempts.length) {
    const kids = R.rows.filter((r) => r.parent === rec.id && r.flags.rereading);
    rereads = kids.length;
    const ok = kids.filter((r) => r.result && r.attempts.length);
    if (ok.length) src = ok[ok.length - 1];
  }
  const att = src && src.attempts.length ? src.attempts[src.attempts.length - 1] : null;
  const itemWarn = (x) => {
    const w = [];
    (diags || []).forEach((d, i) => {
      const subj = R.diagSubject.get(d);
      const term = x && x.term;
      const byName = d.reason === "name-undefined" && term && term.type === "atom" && term.core.c === "name" && term.core.name === d.name;
      const bySubj = subj && ((subj.tree && (subj.tree === x || (subj.tree.view && x && subj.tree.view === x.view))) || (subj.at && term && subj.at === term) || (subj.term && term && subj.term === term) || (subj.args && subj.args.includes(x)));
      if (byName || bySubj) w.push({ diag: i, code: d.reason, severity: d.severity, line: d.line ?? null });
    });
    return w.length ? w : undefined;
  };
  const o = {
    row: idx,
    node: rowNode.node,
    line: rec ? rec.line ?? null : null,
    text: items.map(safeShow).join(" "),
    items: items.map((x, i) => ({ i, spelling: safeShow(x), kind: x ? O.kindOf(x) : null, cat: x ? x.cat || x.t : null, answer_kind: x ? answerKind(x.desc || x.kind, x.cat) : null, node: nodeIdOf(x), ...(x && x.writtenEmpty ? { writtenEmpty: true } : {}), ...(itemWarn(x) ? { warnings: itemWarn(x) } : {}) })),
    shape_decision: shapeDecision(t),
    hooked: !!rec,
  };
  if (rec) {
    o.flags = rec.flags;
    o.attempts = src.attempts.length;
    if (att) {
      o.path = (src !== rec ? `reread ${rereads}x as written !_ (readWrittenEmpty, R94/R112/R137), then ` : "") + att.path;
      if (src !== rec) o.reread_items = src.items.map(safeShow).join(" ");
      o.steps = att.steps;
      o.decisions = [...new Set(att.steps.map((s) => s.class))];
      if (att.leftovers.length) o.leftover = att.leftovers.map((l) => ({ tree: safeShow(l.tree), quiet: l.quiet }));
      if (att.subHole) o.sub_hole = { at: att.subHole.at, tree: safeShow(att.subHole.tree) };
    } else o.path = "no fold attempt recorded";
    if (src.attempts.length > 1) o.retried = src.attempts.slice(0, -1).map((a) => ({ path: a.path, error: a.error, steps: a.steps.length, items: a.items.map(safeShow).join(" ") }));
    o.decision = rec.error ? "refusal" : shapeDecision(t);
  }
  return o;
}

function attachDiags(diags, nodes, R, finalLine) {
  const out = [];
  diags.forEach((d, i) => {
    const subj = R ? R.diagSubject.get(d) : null;
    const hits = [];
    for (const n of nodes) {
      const t = n.t;
      let hit = false;
      if (subj) {
        if (subj.tree && (t === subj.tree || (t && t.t === "unit" && t.inner === subj.tree) || (subj.tree.view && n.view === subj.tree.view))) hit = true;
        if (subj.at && n.term === subj.at) hit = true;
        if (subj.term && n.term === subj.term) hit = true;
        if (subj.args && t && subj.args.some((a) => a === t || (a && a.tree === t))) hit = true;
        if (subj.row && n.term && n.term.type === "atom" && Array.isArray(n.term.core.rows) && n.term.core.rows.includes(subj.row)) hit = true;
      }
      if (!hit && d.reason === "name-undefined" && n.term && n.term.type === "atom" && n.term.core.c === "name" && n.term.core.name === d.name) hit = true;
      if (hit) hits.push(n.json.id);
    }
    // 同じ所の重なり（`(unit X)` と X）は両方に付ける。木に無い所（ほかの行・定義の本体）は付けない。
    // 同一性で当たらず、知らせの行が最後の行なら、綴り（show か spelling が name）で当てる（match: "name"、弱い当て方）。
    let match = hits.length ? "identity" : null;
    if (!hits.length && d.line !== undefined && d.line === finalLine) {
      for (const n of nodes) if (n.json.show === d.name || n.json.spelling === d.name) hits.push(n.json.id);
      if (hits.length) match = "name";
    }
    for (const id of hits) {
      const n = nodes.find((m) => m.json.id === id);
      (n.json.warnings || (n.json.warnings = [])).push({ diag: i, code: d.reason, severity: d.severity, line: d.line ?? null, match });
    }
    out.push({ i, code: d.reason, severity: d.severity, line: d.line ?? null, name: d.name, reporter: subj ? subj.reporter : null, attached_to: hits, match, message: String(d.message || "").slice(0, 200) });
  });
  return out;
}

// ---------------------------------------------------------------------------
// 6. 値の段
// ---------------------------------------------------------------------------

function valueType(v) {
  if (v === V.UNIT) return "!_";
  if (typeof v === "bigint") return "Int";
  if (v instanceof V.Seq) return "Seq";
  if (v instanceof V.Fn) return "function";
  return typeof v;
}
function valueInfo(s, readRefused) {
  try {
    const r = V.interpret(s);
    const notices = (r.notices || []).map((n) => ({ reason: n.reason, line: n.line ?? null, severity: n.severity || null }));
    if (!r.values.length) return { status: "no value (only definitions)", notices };
    const last = r.values[r.values.length - 1];
    const v = last.value;
    const o = { status: "value", show: V.showValue(v), type: valueType(v), line: last.line ?? null, is_function: v instanceof V.Fn, notices };
    if (v instanceof V.Seq) o.item_types = v.items.map(valueType);
    if (v instanceof V.Fn) o.stages = v.stages.map((st) => ({ f: st.f.name, received: st.recv.length }));
    if (r.values.length > 1) o.all = r.values.map((x) => ({ line: x.line ?? null, show: V.showValue(x.value), type: valueType(x.value) }));
    return o;
  } catch (e) {
    const ref = refusalOf(e);
    if (readRefused) return { status: "stop: read-stage refusal (resolve threw first)", ...ref };
    if (e instanceof OperationError) {
      const st = e.reason === "interpret-not-yet" ? "stop: not yet in value stage (V12)" : readRefused ? "stop: read-stage refusal (resolve threw first)" : "stop: value-stage refusal";
      return { status: st, ...ref };
    }
    return { status: "stop: internal error", ...ref };
  }
}

// ---------------------------------------------------------------------------
// 7. 源ごと
// ---------------------------------------------------------------------------

const STD = ["inc : x ? x + 1", "double : x ? x * 2", "d : x ? x * 10", "g : x ? x * 10", "add : x y ? x + y", "f2 : x y ? x - y", "k1 : x y ? x", "mul : a b ? a * b", "use : f x ? @f x", "f3 : a b c ? a + b + c", "f4 : a b c e ? a + b + c + e", "adder : m ? $[+ m]", "map : f [x ~y] ? x", "n : [~x] ? x", "fs : $inc , $double , 3", "vs : 1 , 2 , 3", "i : _", "pw : [a : 1]", "w : pw ' zz"];
function withStd(s0) {
  let s = s0;
  if (s.startsWith("#raw\n")) return s.slice(5);
  const defined = new Set(s.split(/\r?\n/).map((l) => (l.match(/^(\S+) :/) || [])[1]).filter(Boolean));
  const words = new Set(s.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []);
  const pre = STD.filter((d) => {
    const nm = d.split(" ")[0];
    return words.has(nm) && !defined.has(nm);
  });
  if (pre.includes("w : pw ' zz") && !pre.includes("pw : [a : 1]")) pre.unshift("pw : [a : 1]");
  if (pre.length) s = pre.join("\n") + "\n" + s;
  return s;
}
const diagKey = (ds) => JSON.stringify((ds || []).map((d) => [d.reason, d.line, d.name]));

function dumpOne(s0, index) {
  const s = withStd(s0);
  const out = { index, source: s0, prepended: s === s0 ? null : s.slice(0, s.length - s0.length).replace(/\n$/, "").split("\n") };
  // 包まない読む段
  let orig = null;
  let origErr = null;
  try {
    orig = O.resolve(s);
  } catch (e) {
    origErr = e;
  }
  // 包んだ読む段
  const R = newRecorder();
  H.__setHook(R);
  let hooked = null;
  let hookedErr = null;
  try {
    hooked = H.resolve(s);
  } catch (e) {
    hookedErr = e;
  } finally {
    H.__setHook(null);
  }
  const lastOf = (r) => (r && r.trees.length ? r.trees[r.trees.length - 1] : null);
  out.agree = {
    tree: (orig ? O.show(lastOf(orig)) : null) === (hooked ? H.show(lastOf(hooked)) : null),
    diagnostics: diagKey(orig && orig.diagnostics) === diagKey(hooked && hooked.diagnostics),
    refusal: JSON.stringify(refusalOf(origErr)) === JSON.stringify(refusalOf(hookedErr)),
  };
  if (origErr) {
    out.refusal = refusalOf(origErr);
    if (!(origErr instanceof OperationError)) out.refusal.front_end_or_internal = origErr.constructor ? origErr.constructor.name : typeof origErr;
  }
  const useR = hooked ? R : null;
  const base = hooked || orig;
  if (base) {
    const ctxOut = { literals: [], rowNodes: [] };
    const tLast = lastOf(base);
    out.lines = base.trees.map((t, i) => ({ i, line: base.lineOf ? base.lineOf(base.rows[i]) ?? null : null, show: safeShow(t), kind: t ? O.kindOf(t) : null }));
    const { json, nodes } = dumpTree(tLast, useR || newRecorder(), ctxOut);
    out.tree = json;
    out.show = safeShow(tLast);
    out.kind = tLast ? O.kindOf(tLast) : null;
    if (ALL_TREES) out.all_trees = base.trees.slice(0, -1).map((t) => dumpTree(t, useR || newRecorder(), { literals: [], rowNodes: [] }).json);
    const idOf = new Map(nodes.filter((n) => n.t).map((n) => [n.t, n.json.id]));
    const nodeIdOf = (x) => (idOf.has(x) ? idOf.get(x) : null);
    out.rows = ctxOut.rowNodes.map((rn, i) => {
      const n = nodes.find((m) => m.json.id === rn.node);
      n.json.row = i;
      return rowInfo(rn, i, useR || newRecorder(), nodeIdOf, base.diagnostics || []);
    });
    if (useR) {
      const inTree = new Set(ctxOut.rowNodes.map((rn) => rn.tree.written));
      const seenKey = new Set();
      const elsewhere = [];
      for (const row of useR.rows) {
        if (inTree.has(row.items)) continue;
        const att = row.attempts[row.attempts.length - 1];
        const rec = {
          line: row.line ?? null,
          text: row.items.map(safeShow).join(" "),
          rereading: row.flags.rereading,
          peeking: row.flags.peeking,
          path: att ? att.path : null,
          decision: row.error ? "refusal" : shapeDecision(row.result),
          decisions: att ? [...new Set(att.steps.map((x) => x.class))] : [],
          result: row.result ? safeShow(row.result) : null,
          error: row.error,
        };
        const key = JSON.stringify([rec.line, rec.text, rec.decision, rec.path, rec.rereading, rec.peeking]);
        if (seenKey.has(key)) continue;
        seenKey.add(key);
        elsewhere.push(rec);
      }
      out.rows_elsewhere_count = elsewhere.length;
      out.rows_elsewhere = elsewhere.slice(0, MAX_ELSEWHERE);
      out.address_ops = useR.addrOps.map((a) => ({ ...a }));
    }
    out.literals = ctxOut.literals;
    out.diagnostics = attachDiags(base.diagnostics || [], nodes, useR, out.lines.length ? out.lines[out.lines.length - 1].line : null);
  } else {
    out.diagnostics = [];
    out.literals = [];
    out.rows = [];
    if (hookedErr && useR === null) {
      // 断った行の中で畳んだ行（断りに当たる前まで）も見せる
      const seenKey = new Set();
      out.rows_before_refusal = [];
      for (const row of R.rows) {
        const att = row.attempts[row.attempts.length - 1];
        const rec = { line: row.line ?? null, text: row.items.map(safeShow).join(" "), path: att ? att.path : null, decision: row.error ? "refusal" : shapeDecision(row.result), error: row.error, steps: att ? att.steps : [] };
        const key = JSON.stringify([rec.line, rec.text, rec.decision]);
        if (seenKey.has(key)) continue;
        seenKey.add(key);
        out.rows_before_refusal.push(rec);
      }
      out.rows_before_refusal = out.rows_before_refusal.slice(-MAX_ELSEWHERE);
      out.address_ops = R.addrOps;
    }
  }
  out.value = valueInfo(s, !!origErr);
  return out;
}

const srcs = JSON.parse(fs.readFileSync(srcFile, "utf8"));
const meta = { dump: "alpha1 read-stage dump", resolve_js_sha1: srcHash, hooked_copy: hookedPath, wrapped: WRAPPED };
if (opt("--meta")) console.log(JSON.stringify(meta));
srcs.forEach((s, i) => {
  let o;
  try {
    o = dumpOne(s, i);
  } catch (e) {
    o = { index: i, source: s, dump_error: String((e && e.stack) || e).slice(0, 600) };
  }
  console.log(PRETTY ? JSON.stringify(o, bigRep, 1) : JSON.stringify(o, bigRep));
});
