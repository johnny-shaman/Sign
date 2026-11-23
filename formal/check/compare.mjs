// node --stack-size=8000 compare.mjs [--regen]
//
// Runs the JS port of the Lean typing model (model.mjs: J-1 Typing.lean, J-2 Arith.lean) against alpha1's read
// stage (the node dump of dump.mjs) over the coproduct_spec examples (ex.json, ex.json.meta), and records every
// agreement and disagreement.
//
//   T0  literal marks      : every literal leaf of the example's own lines: model litMark vs alpha1's kind/desc.
//   T1  row fold           : every written row of the last line whose items are inside J-1: model predictRow (rowStep
//                            with actBest) vs alpha1's tree shape for the row.  Rows with an item of unknown kind are
//                            T1u: the model defers there; we record what alpha1 does and whether its kind is implied.
//   T2  operator kinds     : every binary/unary value operator (J-2 BinOp/UnOp) of the example's own lines, plus the
//                            operator that refused in a refused source: model (r62/r62u, plusK, bestSound) vs alpha1's
//                            answer kind, refusal and attached warnings.
//   T3  soundness J.6(a)   : every example where the value stage produced a value: the read stage's definite kind
//                            (coarse A/L and the finer desc) vs the kind of the value produced.
//
// Inputs (read only): out/ex.json, out/ex.json.meta (made with ex.mjs from alpha1/docs/coproduct_spec.md) and
// out/ex_alltrees.jsonl (made with dump.mjs --all-trees), each made when missing or with --regen.
// Outputs: out/results.json (all rows), out/mismatches.json (in-scope disagreements), out/counts.json.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import * as M from "./model.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = (f) => path.join(HERE, f);
const OUT_DIR = path.join(HERE, "out");
const Q = (f) => path.join(OUT_DIR, f);
const REGEN = process.argv.includes("--regen");
fs.mkdirSync(OUT_DIR, { recursive: true });
if (REGEN || !fs.existsSync(Q("ex.json"))) {
  execFileSync(process.execPath, [P("ex.mjs"), path.resolve(HERE, "../../alpha1/docs/coproduct_spec.md"), Q("ex.json")]);
}
const DUMP = Q("ex_alltrees.jsonl");
if (REGEN || !fs.existsSync(DUMP)) {
  const out = execFileSync(process.execPath, ["--stack-size=8000", P("dump.mjs"), Q("ex.json"), "--all-trees", "--max-rows-elsewhere=0"], { maxBuffer: 1 << 30 });
  fs.writeFileSync(DUMP, out);
}
const dumps = fs.readFileSync(DUMP, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const srcs = JSON.parse(fs.readFileSync(Q("ex.json"), "utf8"));
const meta = JSON.parse(fs.readFileSync(Q("ex.json.meta"), "utf8"));
if (dumps.length !== srcs.length || meta.length !== srcs.length) throw new Error(`length mismatch dump=${dumps.length} src=${srcs.length} meta=${meta.length}`);
dumps.forEach((o, i) => {
  if (o.index !== i || o.source !== srcs[i]) throw new Error(`dump ${i} does not match ex.json`);
});

const { UNKNOWN, OUT, VOID_WARN, KIND_DOM, KVAL_DOM } = M;
const rows = [];
const skipped = { T0: [], T1: [], T2: [], T3: [] };
// out_of_scope_reason may be a list of reasons (kept as an array in out_of_scope_reasons, joined for display)
const push = (r) => {
  if (Array.isArray(r.out_of_scope_reason)) {
    r.out_of_scope_reasons = r.out_of_scope_reason;
    r.out_of_scope_reason = r.out_of_scope_reason.join(" ;; ");
  } else r.out_of_scope_reasons = r.out_of_scope_reason ? [r.out_of_scope_reason] : [];
  rows.push(r);
};
const base = (test, o) => ({ test, example_index: o.index, rule: meta[o.index].rule, source: o.source, spec_expect: meta[o.index].expect });

// ---------------------------------------------------------------------------------------------------------------
// tree helpers
// ---------------------------------------------------------------------------------------------------------------
function walk(n, f, parent = null, role = null) {
  if (!n || typeof n !== "object") return;
  f(n, parent, role);
  for (const c of n.children || []) walk(c.node, f, n, c.role);
}
function indexTree(t) {
  const m = new Map();
  walk(t, (n) => m.set(n.id, n));
  return m;
}
const child = (n, role) => ((n && n.children) || []).find((c) => c.role === role)?.node ?? null;
const kids = (n, role) => ((n && n.children) || []).filter((c) => c.role === role).map((c) => c.node);
// the trees of the example's own lines (STD lines that probe/dump prepend are lines 1..P)
function exampleTrees(o) {
  const nPre = (o.prepended || []).length;
  const trees = [...(o.all_trees || []), o.tree];
  return trees
    .map((t, i) => ({ t, i, line: o.lines && o.lines[i] ? o.lines[i].line : null, last: i === trees.length - 1 }))
    .filter((x) => x.t && (x.line === null || x.line > nPre));
}
const lineDefs = (o) => {
  // top-level definitions `name : rhs` of the program the read stage saw (STD lines prepended by probe/dump + the
  // example source).  Used for ρ of names defined by one literal, for R99 (`g9 : $inc`), and to tell parameters
  // (names with no top-level definition) from top-level names.
  const m = new Map();
  const params = new Set();
  for (const l of [...(o.prepended || []), ...o.source.split("\n")]) {
    const x = /^(\S+) :(?:\s+(.*?))?\s*$/.exec(l);
    if (x) m.set(x[1], x[2] || "");
    const q = /^\S+ : (.*?) \?/.exec(l);
    if (q) for (const p of q[1].match(/[A-Za-z_][A-Za-z0-9_]*/g) || []) params.add(p);
  }
  // a name that is also some function's parameter is not read through its top-level definition (shadowing):
  // get() answers only unshadowed names; has() still tells a top-level name from a pure parameter.
  return { get: (k) => (params.has(k) ? undefined : m.get(k)), has: (k) => m.has(k), shadowed: (k) => params.has(k) && m.has(k) };
};
// alpha1's finer reading of a desc (vocabulary of this compare, not of resolve.js)
function alphaFine(n) {
  if (!n) return "none";
  if (n.kind === "未知") return "unknown";
  if (n.kind === "L") return "function";
  if (n.kind !== "A") return "no kind";
  const d = n.desc || {};
  if (d.zero) return "void";
  if (d.ref) return "funAddr";
  if (d.vref) return "Address(vref)";
  if (d.addr === "pt") return "Address(pt)";
  if (d.addr === "diff") return "Address(diff)";
  if (d.lift) return "lift";
  if (d.spread) return "spread";
  if (d.shape && d.shape.s === "scalar") return n.int === "scalar" ? "Int" : "number";
  if (d.shape || d.seqOf || (Array.isArray(d.elements) && d.elements.length)) return "container";
  return "opaque";
}
const isAddrFine = (f) => typeof f === "string" && f.startsWith("Address");

// ---------------------------------------------------------------------------------------------------------------
// T0 literal marks
// ---------------------------------------------------------------------------------------------------------------
function litParts(n) {
  // term 'lit' or 'lit marks <pre>·<post>' (dump.mjs termLabel)
  const m = /^lit marks (.*)·(.*)$/.exec(n.term || "");
  const pre = m ? m[1] : "";
  const post = m ? m[2] : "";
  let s = n.spelling ?? n.show ?? "";
  if (pre && s.startsWith(pre)) s = s.slice(pre.length);
  if (post && s.endsWith(post)) s = s.slice(0, s.length - post.length);
  return { core: s, pre, post };
}
let t0SpellCheck = { checked: 0, bad: 0 };
for (const o of dumps) {
  if (!o.tree) {
    skipped.T0.push({ example_index: o.index, reason: o.refusal ? "read-stage refusal (no tree)" : "no tree" });
    continue;
  }
  // cross-check the core spelling against the dump's own literals[] of the last tree
  const litByNode = new Map((o.literals || []).map((l) => [l.node, l]));
  for (const { t, line, last } of exampleTrees(o)) {
    // operand faces given by the read stage's own addressOp call on the parent
    const faceOf = new Map();
    walk(t, (n) => {
      if (n.address_op && Array.isArray(n.address_op.faces)) {
        const l = child(n, "operand-left"), r = child(n, "operand-right");
        if (l) faceOf.set(l.id, { face: n.address_op.faces[0], info: n.address_op.info && n.address_op.info[0] });
        if (r) faceOf.set(r.id, { face: n.address_op.faces[1], info: n.address_op.info && n.address_op.info[1] });
      }
    });
    walk(t, (n, parent, role) => {
      if (!(n.term || "").startsWith("lit")) return;
      if (n.node !== "leaf" && n.node !== "operand") return;
      const { core, pre, post } = litParts(n);
      if (last && litByNode.has(n.id)) {
        t0SpellCheck.checked++;
        if (litByNode.get(n.id).spelling !== core) t0SpellCheck.bad++;
      }
      const r = { ...base("T0", o), node: `L${line}#${n.id} ${n.spelling ?? n.show}${n.recomputed ? " (operand, recomputed)" : ""}` };
      const model = M.litMark(core);
      const fine = alphaFine(n);
      const face = faceOf.get(n.id) || null;
      r.alpha1 = { kind: n.kind, fine, answer_kind: n.answer_kind, int: n.int ?? null, face: face ? face.face : null };
      r.model = { litClass: (() => { const c = M.litClass(core); return c === OUT ? OUT : c; })(), mark: model };
      if (n.kind === null && /not classified/.test(n.note || "")) {
        push({ ...r, in_scope: false, out_of_scope_reason: "key operand of `'`/`@` (stage 18): the read stage does not classify it as a value", verdict: "out-of-scope" });
        return;
      }
      if (pre || post) {
        push({ ...r, in_scope: false, out_of_scope_reason: `literal carries marks (${pre}·${post}): alpha1's kind is that of the marked term`, verdict: "out-of-scope" });
        return;
      }
      if (model === OUT) {
        push({ ...r, in_scope: false, out_of_scope_reason: "spelling outside the number rules (string/char/other)", verdict: "out-of-scope" });
        return;
      }
      let verdict, note;
      if (n.kind !== "A") { verdict = "disagree"; note = `alpha1 kind ${n.kind}, every literal mark is a value (A)`; }
      else if (model === "Int") {
        if (fine === "Int") { verdict = "agree"; note = "scalar desc and intTerm = scalar"; }
        else if (fine === "number" || fine === "opaque") { verdict = "agree-coarse"; note = `alpha1 ${fine}: Int-ness not recorded`; }
        else { verdict = "disagree"; note = `alpha1 reads ${fine}`; }
      } else if (model === "Address") {
        if (isAddrFine(fine) || (face && face.face === "hex")) { verdict = "agree"; note = face && face.face === "hex" ? "hex face at the parent's addressOp" : "address desc"; }
        else if (fine === "opaque") { verdict = "agree-coarse"; note = "alpha1 keeps 0x… as opaque A (ADDRESS_LIT, not scalar); the hex face is computed only on demand"; }
        else { verdict = "disagree"; note = `alpha1 reads ${fine}`; }
      } else {
        verdict = fine === "number" || fine === "opaque" || fine === "Int" ? "agree-coarse" : "disagree";
        note = `J-1 mark ${model} (J-3 kind); alpha1 ${fine}`;
      }
      push({ ...r, in_scope: true, out_of_scope_reason: null, verdict, note });
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// T1 row fold
// ---------------------------------------------------------------------------------------------------------------
function itemScope(it, n) {
  if (it.cat === "hole") return { out: "hole `_` item (R16/R34/R44/R46)" };
  if (it.cat === "unit") return { out: "written `!_` / `x~` mark item (R28/R43/R138)" };
  if (it.cat === "input") return { out: "input `@x` item (R120)" };
  if (it.cat === "default") return { out: "default-valued item" };
  if (it.writtenEmpty) return { out: "known `!_` item reread as written `!_` (R94/R112/R137: vanishes from the row)" };
  if (typeof it.spelling === "string" && it.spelling.startsWith("`")) return { out: "string item" };
  if (/identity/.test(it.answer_kind || "")) return { out: "identity function item (unit law R74/R126 rewrites the row)" };
  const k = it.kind;
  if (k !== "A" && k !== "L" && k !== "未知") return { out: "item without a kind" };
  if (!n) return { out: "item node not linked into the row's tree" };
  const d = n.desc || {};
  if (k === "L") {
    const fn = d.fn;
    if (!fn) return { out: "function item without fn desc" };
    const one = (f) => f && f.type === "plain" && f.origin === "plain" && f.n === 1;
    if (one(fn)) return { kind: "L" };
    if (fn.type === "compose") return Array.isArray(fn.fns) && fn.fns.every(one) ? { kind: "L" } : { out: "composition with a function outside one port" };
    if (fn.type === "pfUnary") return { kind: "L" }; // `[+ 1]`: one port (section)
    if (fn.type === "id") return { out: "identity function item (unit law R74/R126 rewrites the row)" };
    if (fn.type === "pattern") return { out: "bracket-param function (reference / bracket port, R24)" };
    if (fn.type === "plain" && (fn.origin === "hole" || fn.origin === "partial")) return { out: "hole or partial function" };
    if (typeof fn.n === "number" && fn.n >= 2) return { out: "function arity >= 2" };
    if (fn.type === "pfBinary") return { out: "function arity >= 2" };
    if (fn.type === "other") return { out: "function of unknown arity" };
    if (["pfFold", "pfGreedyUnary", "pfPick", "pfSeat"].includes(fn.type)) return { out: "pointfree fold/greedy/pick/seat (variadic or container port)" };
    return { out: `function type ${fn.type} outside J-1` };
  }
  if (k === "A") {
    if (d.spread) return { out: "spread item (A~)" };
    if (d.zero) return { out: "known `!_` value item (vanishes from the row, R137)" };
    return { kind: "A" };
  }
  return { kind: UNKNOWN };
}
function alphaShape(n, labelOf, idx, notes, depth = 0) {
  if (!n || depth > 100) return "?";
  if (n.node === "ref") {
    if (labelOf.has(n.ref)) return labelOf.get(n.ref);
    n = idx.get(n.ref) || n;
  }
  if (labelOf.has(n.id)) return labelOf.get(n.id);
  switch (n.node) {
    case "unit": {
      notes.add("leftover (unit …) stripped (R42/R47, outside J-1)");
      return ["unit", alphaShape(child(n, "inner"), labelOf, idx, notes, depth + 1)];
    }
    case "apply":
      return ["apply", alphaShape(child(n, "head"), labelOf, idx, notes, depth + 1), alphaShape(child(n, "arg"), labelOf, idx, notes, depth + 1)];
    case "compose":
      return ["compose", ...kids(n, "item").map((x) => alphaShape(x, labelOf, idx, notes, depth + 1))];
    case "construct":
      return ["construct", ...kids(n, "item").map((x) => alphaShape(x, labelOf, idx, notes, depth + 1))];
    default:
      return `?{${n.show}}`;
  }
}
function normShape(s) {
  if (typeof s === "string") return s;
  if (s[0] === "unit") return normShape(s[1]);
  const [h, ...a] = s;
  const args = a.map(normShape);
  if (h === "compose") return ["compose", ...args.flatMap((x) => (Array.isArray(x) && x[0] === "compose" ? x.slice(1) : [x]))];
  return [h, ...args];
}
const shapeStr = (s) => (typeof s === "string" ? s : `(${s[0]} ${s.slice(1).map(shapeStr).join(" ")})`);
const specTree = (expect) => {
  const m = /`(\([^`]*\))`/.exec(expect || "");
  return m ? m[1] : null;
};
const dropUnit = (t) => String(t).replace(/\(unit ([^()\s]+)\)/g, "$1");
function renderShape(s, spell) {
  if (typeof s === "string") {
    const m = /^x(\d+)$/.exec(s);
    return m ? spell[Number(m[1])] : s;
  }
  return `(${s[0]} ${s.slice(1).map((x) => renderShape(x, spell)).join(" ")})`;
}
const modelRowKind = (res) => (res.length >= 2 ? "A" : res.stack[0].kind);
const kindName = (k) => (k === "未知" ? UNKNOWN : k);

for (const o of dumps) {
  if (!o.tree) {
    skipped.T1.push({ example_index: o.index, reason: o.refusal ? "read-stage refusal (no tree)" : "no tree" });
    continue;
  }
  const idx = indexTree(o.tree);
  if (!(o.rows || []).length) {
    skipped.T1.push({ example_index: o.index, reason: "no written row of length >= 2 in the last line's tree" });
    continue;
  }
  for (const r of o.rows) {
    const rn = idx.get(r.node);
    const scopes = r.items.map((it) => itemScope(it, it.node === null || it.node === undefined ? null : idx.get(it.node)));
    const outs = [...new Set(scopes.filter((s) => s.out).map((s) => s.out))];
    if (r.path !== "fold") outs.push(`row path: ${r.path.replace(/reread \d+x/, "reread")}`);
    const hasUnknown = scopes.some((s) => s.kind === UNKNOWN);
    const test = hasUnknown ? "T1u" : "T1";
    const rec = { ...base(test, o), node: `row${r.row} @${r.line} "${r.text}" -> #${r.node} ${rn ? rn.show : "?"}` };
    const alphaSteps = (r.steps || []).map((s) => `${s.i}:${s.item}[${s.class}]`).join(" ");
    if (outs.length) {
      push({ ...rec, model: null, alpha1: { shape: rn ? rn.show : null, kind: rn ? rn.kind : null, steps: alphaSteps }, in_scope: false, out_of_scope_reason: outs, verdict: "out-of-scope" });
      continue;
    }
    const labelOf = new Map();
    r.items.forEach((it, i) => labelOf.set(it.node, `x${i}`));
    const notes = new Set();
    const aRaw = alphaShape(rn, labelOf, idx, notes);
    const aStr = shapeStr(normShape(aRaw));
    const legend = r.items.map((it, i) => `x${i}=${it.spelling}:${kindName(it.kind)}`).join(" ");
    const aKind = rn ? rn.kind : null;
    const flags = rn && rn.flags ? rn.flags : [];
    const alpha1 = { shape: aStr, shape_raw: shapeStr(aRaw), tree: rn ? rn.show : null, kind: kindName(aKind), flags, steps: alphaSteps, decision: r.decision };
    const res = M.predictRow(scopes.map((s, i) => ({ kind: s.kind, label: `x${i}` })));
    // the spec's stated tree (first backticked s-expression of the expectation), compared only for the row at the
    // root of the last line; `(unit x)` around a single item is dropped on both sides (leftover, outside J-1)
    const isRoot = !!rn && rn.id === 0;
    const sTree = isRoot ? specTree(meta[o.index].expect) : null;
    const spell = (s) => renderShape(s, r.items.map((it) => it.spelling));
    if (sTree) { rec.spec_tree = sTree; alpha1.matches_spec_tree = dropUnit(rn.show) === dropUnit(sTree); }
    if (res.status === "decided") {
      const mStr = shapeStr(normShape(res.shape));
      const mKind = modelRowKind(res);
      const model = { status: "decided", shape: mStr, kind: mKind, legend, steps: res.steps.map((s) => `${s.i}:${s.act}`).join(" ") };
      if (sTree) model.matches_spec_tree = spell(normShape(res.shape)) === dropUnit(sTree);
      let verdict, note;
      if (aStr.includes("?")) { verdict = "disagree"; note = "alpha1 row tree could not be mapped onto the items"; }
      else if (aStr !== mStr) { verdict = "disagree"; note = "shape differs"; }
      else if (kindName(aKind) === mKind) verdict = "agree";
      else if (kindName(aKind) === UNKNOWN) { verdict = "agree-incomplete"; note = `shape agrees; alpha1 row kind unknown, model ${mKind}`; }
      else if (mKind === UNKNOWN) { verdict = "agree"; note = `shape agrees; model row kind unknown (item), alpha1 ${aKind}`; }
      else { verdict = "disagree"; note = `kind: model ${mKind}, alpha1 ${aKind}`; }
      if (notes.size) note = [note, ...notes].filter(Boolean).join("; ");
      push({ ...rec, model, alpha1, in_scope: true, out_of_scope_reason: null, verdict, note: note || null });
      continue;
    }
    // defer: the model's read stage must say unknown at res.at (T:374 space_defer, T:409 act_defer)
    const unk = scopes.map((s, i) => (s.kind === UNKNOWN ? i : -1)).filter((i) => i >= 0);
    const completions = [];
    for (let m = 0; m < 1 << unk.length; m++) {
      const ks = scopes.map((s) => s.kind);
      unk.forEach((i, j) => (ks[i] = (m >> j) & 1 ? "L" : "A"));
      const c = M.predictRow(ks.map((k, i) => ({ kind: k, label: `x${i}` })));
      completions.push({ assign: unk.map((i) => `x${i}=${ks[i]}`).join(","), shape: shapeStr(normShape(c.shape)), kind: modelRowKind(c), ...(sTree ? { matches_spec_tree: spell(normShape(c.shape)) === dropUnit(sTree) } : {}) });
    }
    const model = { status: "defer", at: res.at, top: res.top, next: res.next, legend, completions };
    const kinds = [...new Set(completions.map((c) => c.kind))];
    const match = completions.filter((c) => c.shape === aStr).map((c) => c.assign);
    alpha1.shape_matches_completion = match.length ? match : null;
    let verdict, note;
    const ak = kindName(aKind);
    if (ak === UNKNOWN) { verdict = "defer-agree"; note = "alpha1 leaves the row's kind unknown"; }
    else if (kinds.length === 1 && kinds[0] === ak) {
      verdict = match.length ? "defer-predicted-sound" : "disagree";
      note = match.length
        ? `alpha1 builds a predicted tree (the completion ${match.join(" | ")}); its kind ${ak} holds in every completion; the value stage refolds the written row (R118)`
        : `alpha1's kind ${ak} holds in every completion but its shape matches no completion`;
    } else { verdict = "disagree"; note = `alpha1 commits to kind ${ak}; completions give ${kinds.join("/")}`; }
    if (notes.size) note = [note, ...notes].join("; ");
    push({ ...rec, model, alpha1, in_scope: true, out_of_scope_reason: null, verdict, note });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// T2 operator kinds
// ---------------------------------------------------------------------------------------------------------------
const BIN = new Set(Object.keys(M.BINOP_SPELLING));
const OTHER_OPS = new Set(["'", "~", "@", "#", ",", ":", "|", "&", ";", "!=="]);
const R62_WARN = new Set(["address-number-mix", "address-without-arrow", "level-mismatch"]);
// the operator of a tree node: { arity, sym, operands: [{node, role}] } or null
function opOf(n) {
  const term = n.term || "";
  if (term.startsWith("infix ") && (n.node === "leaf" || n.node === "operand")) {
    const sym = term.slice(6);
    return { arity: 2, sym, operands: [child(n, "operand-left"), child(n, "operand-right")] };
  }
  if (n.node === "op") {
    const sym = n.label;
    return { arity: 2, sym, operands: [child(n, "left"), child(n, "right")] };
  }
  const pm = /^(\w+) marks (.*)·(.*)$/.exec(term);
  if (pm && (n.node === "leaf" || n.node === "operand")) {
    const [, core, pre, post] = pm;
    // a single prefix `-` or `!!`, or a single postfix `!`, is a J-2 unary operator on the core
    const marks = [...pre.matchAll(/!!|./g)].map((x) => x[0]);
    if (!post && marks.length === 1 && (marks[0] === "-" || marks[0] === "!!")) return { arity: 1, sym: marks[0] === "-" ? "-x" : "!!", operands: [child(n, "core")], core };
    if (!pre && post === "!") return { arity: 1, sym: "x!", operands: [child(n, "core")], core };
    return null;
  }
  if (term === "abs" && n.node !== "raw") {
    const b = kids(n, "bracket");
    return { arity: 1, sym: "|x|", operands: [b.length === 1 ? b[0] : null], multi: b.length !== 1 };
  }
  return null;
}
const faceKind = (face, info) => {
  switch (face) {
    case "num": return info && info.int ? { k: "Int", via: "face num (Int)" } : { k: OUT, why: "number operand not known to be Int (Int/UInt/Char/Float undistinguished)" };
    case "hex": return { k: "Address", via: "face hex" };
    case "pt": return { k: "Address", via: "face pt" };
    case "diff": return { k: "Address", via: "face diff (degree 1)" };
    case "fn": return { k: "funAddr", via: "face fn" };
    case "unit": return { k: "void", via: "face unit" };
    case "fnv": return { k: "void", via: "face fnv (bare function under an operator, R87)" };
    case "lift": return { k: UNKNOWN, via: "face lift" };
    case "other": return { k: UNKNOWN, via: "face other" };
    case "box": return { k: OUT, why: "container holding an address (box face)" };
    case "none": return { k: OUT, why: "missing operand" };
    default: return { k: UNKNOWN, via: `face ${face}` };
  }
};
// the model's kind of an operand subterm: J-1 fold with μ = litMark, ρ from the read stage, τ = the model tables
function operandKind(n, ctx, faceHint) {
  if (!n || n.node === null) return { k: OUT, why: "missing operand" };
  const term = n.term || "";
  const op = opOf(n);
  if (op && (op.arity === 1 || BIN.has(op.sym))) {
    const m = opModel(n, op, ctx);
    if (m.model === OUT) return { k: OUT, why: `nested ${op.sym}: ${m.why}` };
    return { k: m.model === VOID_WARN ? "carried" : m.model, via: `nested ${op.sym} -> ${m.model}` };
  }
  if (op && op.sym === "," && n.node === "op") {
    // `,` only by its unit law (J.4(b)): a known `!_` side vanishes
    const a = operandKind(child(n, "left"), ctx), b = operandKind(child(n, "right"), ctx);
    if (a.k === "void") return { ...b, via: `\`,\` unit law -> ${b.via || b.k}` };
    if (b.k === "void") return { ...a, via: `\`,\` unit law -> ${a.via || a.k}` };
    return { k: OUT, why: "`,` beyond its unit law" };
  }
  if (term === "bracket" && n.node !== "raw") {
    const b = kids(n, "bracket");
    if (b.length === 1) return operandKind(b[0], ctx, faceHint); // [x] ≅ x
    return { k: OUT, why: "bracket with several rows" };
  }
  if (n.node === "construct") return { k: OUT, why: "container operand (written row)" };
  if (n.node === "unit") return { k: "void", via: "(unit …): leftover bare function (R87)" };
  if (n.cat === "unit") return { k: "void", via: "written !_" };
  if (term.startsWith("lit")) {
    const { core, pre, post } = litParts(n);
    if (pre || post) return { k: OUT, why: `literal with marks ${pre}·${post}` };
    const m = M.litMark(core);
    if (m === "Int" || m === "Address") return { k: m, via: `μ(${core})` };
    return { k: OUT, why: m === OUT ? "non-number literal" : `J-3 literal mark ${m}` };
  }
  const d = n.desc || {};
  const nm = /^name marks (.*)·(.*)$/.exec(term);
  if (nm || /^bracket marks (.*)·(.*)$/.test(term)) {
    const [pre, post] = nm ? [nm[1], nm[2]] : /^bracket marks (.*)·(.*)$/.exec(term).slice(1);
    if (pre === "$" && !post) {
      const nmText = (n.spelling ?? n.show ?? "").replace(/^\$/, "");
      const rhs = nm ? ctx.defs.get(nmText) : undefined;
      if (rhs !== undefined && rhs.startsWith("$")) return { k: "funAddr", via: `$ on a name defined as ${rhs}: the same address (R99)` };
      if (d.ref) return { k: "funAddr", via: "$ on a function (R49)" };
      if (d.vref || d.zero) return { k: "void", via: `$ on a value: known !_ (R49; alpha1 ${d.vref ? "vref point" : "zero"})` };
      return { k: UNKNOWN, via: "$ of unknown target" };
    }
    if (pre.startsWith("@")) return { k: UNKNOWN, via: "@ (input, target unknown)" };
    return { k: OUT, why: `marks ${pre}·${post} outside J-2` };
  }
  // names and other terms: ρ from the definition (single literal) or from the read stage
  if (term === "name") {
    const def = ctx.defs.get(n.spelling ?? n.show);
    if (def !== undefined) {
      const m = M.litMark(def);
      if (m === "Int" || m === "Address") return { k: m, via: `ρ: defined as ${def}` };
    }
  }
  if (n.kind === "L") return { k: "void", via: "bare function under an operator (R87)" };
  if (d.zero) return { k: "void", via: "alpha1 zero (known !_)" };
  if (d.ref) return { k: "funAddr", via: "alpha1 ref" };
  if (d.vref) return { k: "void", via: "alpha1 vref ($ on a value: !_ by R49)" };
  if (d.addr === "pt" || d.addr === "diff") return { k: "Address", via: `alpha1 addr ${d.addr}` };
  if (faceHint) {
    const f = faceKind(faceHint.face, faceHint.info);
    if (f.k !== UNKNOWN) return f;
  }
  if (n.kind === "未知") return { k: UNKNOWN, via: "alpha1 unknown" };
  if (d.lift) return { k: UNKNOWN, via: "alpha1 lift" };
  if (d.spread) return { k: OUT, why: "spread operand" };
  if (d.shape && d.shape.s === "scalar") return n.int === "scalar" ? { k: "Int", via: "alpha1 scalar + intTerm" } : { k: OUT, why: "number operand not known to be Int (Int/UInt/Char/Float undistinguished)" };
  if (d.shape || d.seqOf || (Array.isArray(d.elements) && d.elements.length)) return { k: OUT, why: "container operand" };
  return { k: UNKNOWN, via: "alpha1 opaque A (parameter / result)" };
}
function modelAnswer(sym, arity, ks) {
  if (arity === 1) {
    const x = ks[0];
    if (KIND_DOM.includes(x)) { const r = M.opKind1(sym, x); return { model: r, warn: r === VOID_WARN, table: "r62u" }; }
    if (x === UNKNOWN) { const r = M.predictOp1(sym, x); return { model: r, warn: false, table: "bestSound r62u (unknown over {Int, Address})" }; }
    return { model: OUT, why: `unary ${sym} on ${x}: no Lean table` };
  }
  const [a, b] = ks;
  if (KIND_DOM.includes(a) && KIND_DOM.includes(b)) { const r = M.opKind(sym, a, b); return { model: r, warn: r === VOID_WARN, table: "r62" }; }
  if (M.binOpOf(sym) === "add" && KVAL_DOM.includes(a) && KVAL_DOM.includes(b)) return { model: M.plusK(a, b), warn: null, table: "plusK" };
  if (a === UNKNOWN || b === UNKNOWN) {
    const r = M.predictOp(sym, a, b, "KVal");
    if (r === OUT) return { model: OUT, why: `unknown operand with ${a}/${b}: cells without a Lean table` };
    return { model: r, warn: null, table: "bestSound over KVal" };
  }
  return { model: OUT, why: `${sym} with ${a}/${b}: no Lean table (only + has void/funAddr/carried rows)` };
}
function opModel(n, op, ctx) {
  const faces = n.address_op && Array.isArray(n.address_op.faces) ? n.address_op.faces : null;
  const infos = n.address_op && n.address_op.info ? n.address_op.info : [null, null];
  if (op.multi) return { model: OUT, why: "abs over several rows", ks: [] };
  const oks = op.operands.map((x, i) => operandKind(x, ctx, faces ? { face: faces[i], info: infos[i] } : null));
  const ks = oks.map((x) => x.k);
  const bad = oks.find((x) => x.k === OUT);
  if (bad) return { model: OUT, why: bad.why, ks, oks };
  const a = modelAnswer(op.sym, op.arity, ks);
  return { ...a, ks, oks };
}
function alphaOpAnswer(n) {
  const fine = alphaFine(n);
  const warns = (n.warnings || []).map((w) => w.code);
  return { kind: kindName(n.kind), fine, answer_kind: n.answer_kind, warnings: warns, address_op: n.address_op ? { faces: n.address_op.faces, result: n.address_op.answer_kind, refusal: n.address_op.refusal ? n.address_op.refusal.gate : null } : null };
}
// classify alpha1's answer against the model's
function judgeOp(m, a) {
  const f = a.fine;
  const refused = !!a.refused;
  const warned = (a.warnings || []).some((w) => R62_WARN.has(w)) ? (a.warnings || []).filter((w) => R62_WARN.has(w)) : [];
  const anyWarn = (a.warnings || []).length > 0;
  const mk = m.model;
  if (refused) return { verdict: "disagree", note: `alpha1 refuses (${a.refused}) where the model answers ${mk}` };
  if (mk === "Int" || mk === "Address") {
    const same = mk === "Int" ? f === "Int" || f === "number" : isAddrFine(f);
    if (same) return { verdict: "agree", note: f === "number" ? "alpha1 number (scalar); the only J-2 number kind is Int" : null };
    if (f === "void") return { verdict: "agree", note: `alpha1 knows the answer is !_ (in ${mk}₊)` };
    if (f === "opaque" || f === "unknown") return { verdict: "agree-incomplete", note: `alpha1 ${f}: does not decide ${mk}` };
    return { verdict: "disagree", note: `alpha1 ${f} vs model ${mk}` };
  }
  if (mk === VOID_WARN) {
    if (f === "void" && warned.length) return { verdict: "agree", note: `void with ${warned.join(",")}` };
    if (f === "void") return { verdict: "disagree", note: "alpha1 void but no R62 warning attached" };
    if (f === "opaque" || f === "unknown") return { verdict: "disagree", note: `alpha1 ${f} and silent: model says !_ + warning (r62 none)` };
    return { verdict: "disagree", note: `alpha1 ${f}${anyWarn ? " with " + a.warnings.join(",") : " silent"}: model says !_ + warning (r62 none)` };
  }
  if (mk === "carried" || mk === "void") {
    if (f === "void") return { verdict: "agree", note: null };
    if (f === "opaque" || f === "unknown") return { verdict: "agree-incomplete", note: `alpha1 ${f}: does not decide ${mk} (!_)` };
    return { verdict: "disagree", note: `alpha1 decides ${f} where the model says ${mk} (!_)` };
  }
  if (mk === UNKNOWN) {
    if (f === "opaque" || f === "unknown") return { verdict: "agree-both-unknown", note: null };
    return { verdict: "disagree", note: `alpha1 decides ${f} where a sound read stage cannot (bestSound = unknown)` };
  }
  return { verdict: "disagree", note: `unhandled model answer ${mk}` };
}
// refused sources: the operands of a refused addressOp record are known only by their spelling and alpha1's faces.
// Split the spelling at its top-level operator and read each side like the tree path (μ for literals, nested
// operators through the model, `$` by R49/R99/Q108), falling back to the face (the read stage's ρ).
function splitTop(text, sym) {
  let depth = 0;
  const sep = ` ${sym} `;
  const hits = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (depth === 0 && text.startsWith(sep, i)) hits.push(i);
  }
  if (hits.length !== 1) return null;
  return [text.slice(0, hits[0]), text.slice(hits[0] + sep.length)];
}
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
// the inner text when the first bracket of t closes at its last character, else null
function wholeBracket(t) {
  if (!(t.startsWith("[") || t.startsWith("("))) return null;
  let d = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "[" || t[i] === "(") d++;
    else if (t[i] === "]" || t[i] === ")") {
      d--;
      if (d === 0) return i === t.length - 1 ? t.slice(1, -1) : null;
    }
  }
  return null;
}
function textKind(text, face, info, ctx, depth = 0) {
  const t = text.trim();
  if (depth > 20) return { k: OUT, why: "operand text too deep" };
  const inner = wholeBracket(t);
  if (inner !== null) return textKind(inner, face, info, ctx, depth + 1); // [x] ≅ x
  const lm = M.litMark(t);
  if (lm === "Int" || lm === "Address") return { k: lm, via: `μ(${t})` };
  for (const sym of Object.keys(M.BINOP_SPELLING)) {
    const parts = splitTop(t, sym);
    if (!parts) continue;
    const ks = parts.map((p) => textKind(p, null, null, ctx, depth + 1));
    const bad = ks.find((q) => q.k === OUT);
    if (bad) return { k: OUT, why: `nested ${sym}: ${bad.why}` };
    const m = modelAnswer(sym, 2, ks.map((q) => q.k));
    if (m.model === OUT) return { k: OUT, why: `nested ${sym}: ${m.why}` };
    return { k: m.model === VOID_WARN ? "carried" : m.model, via: `nested ${sym} -> ${m.model}` };
  }
  if (t === "_") return { k: "void", via: "written `_` under an operator: a bare function, `!_` (R87)" };
  const dn = /^\$([A-Za-z_][A-Za-z0-9_]*)$/.exec(t);
  if (dn) {
    if (!ctx.defs.has(dn[1])) return { k: UNKNOWN, via: "$ on a parameter: decided by the argument (Q108)" };
    const rhs = ctx.defs.get(dn[1]);
    if (rhs !== undefined && rhs.startsWith("$")) return { k: "funAddr", via: `$ on a name defined as ${rhs}: the same address (R99)` };
    if (face === "fn") return { k: "funAddr", via: "$ on a function (R49), face fn" };
    if (face === "pt") return { k: "void", via: "$ on a value: known !_ (R49); alpha1 face pt" };
    if (!face && rhs !== undefined) {
      if (/ \? |^_$|^\?/.test(rhs)) return { k: "funAddr", via: "$ on a function (R49), from its definition" };
      if (rhs) return { k: "void", via: "$ on a value: known !_ (R49), from its definition" };
    }
    return faceKind(face, info);
  }
  if (/^\$\[/.test(t)) {
    if (face === "fn") return { k: "funAddr", via: "$[…] of a function, face fn" };
    if (face === "pt") return { k: "void", via: "$[…] of a value: known !_ (R49); alpha1 face pt" };
    return faceKind(face, info);
  }
  if (/^\$@/.test(t)) return { k: UNKNOWN, via: "$@…: target unknown" };
  if (IDENT.test(t)) {
    const rhs = ctx.defs.get(t);
    if (rhs !== undefined) {
      const m = M.litMark(rhs);
      if (m === "Int" || m === "Address") return { k: m, via: `ρ: defined as ${rhs}` };
    }
    if (face === "pt") return { k: "void", via: "[R] face pt read as `$` on a value bound to the name (void, R49); a shifted point would be carried" };
    return faceKind(face, info);
  }
  return faceKind(face, info);
}
for (const o of dumps) {
  const ctx = { defs: lineDefs(o) };
  if (o.tree) {
    let any = false;
    for (const { t, line, last } of exampleTrees(o)) {
      walk(t, (n) => {
        const op = opOf(n);
        if (!op) return;
        const r = { ...base("T2", o), node: `L${line}#${n.id} ${n.show}${n.recomputed ? " (operand, recomputed)" : ""}`, is_root: !!last && n.id === 0 };
        const a = alphaOpAnswer(n);
        if (op.arity === 2 && !BIN.has(op.sym)) {
          push({ ...r, model: null, alpha1: a, in_scope: false, out_of_scope_reason: OTHER_OPS.has(op.sym) ? `operator ${op.sym} not in J-2 BinOp/UnOp` : `operator ${op.sym} outside J-2`, verdict: "out-of-scope" });
          return;
        }
        any = true;
        const m = opModel(n, op, ctx);
        const model = { op: op.sym, operand_kinds: m.ks, operand_via: (m.oks || []).map((x) => x.via || x.why), answer: m.model, warning_needed: m.warn ?? null, table: m.table ?? null };
        if (m.model === OUT) {
          push({ ...r, model, alpha1: a, in_scope: false, out_of_scope_reason: m.why, verdict: "out-of-scope" });
          return;
        }
        const j = judgeOp(m, a);
        push({ ...r, model, alpha1: a, in_scope: true, out_of_scope_reason: null, verdict: j.verdict, note: j.note });
      });
    }
    if (!any && !rows.some((x) => x.test === "T2" && x.example_index === o.index)) skipped.T2.push({ example_index: o.index, reason: "no operator node in the example's lines" });
  } else {
    // refused source: the operator that refused, from the read stage's own addressOp records (faces = ρ of the operands)
    const rec = [];
    const seen = new Set();
    for (const x of o.address_ops || []) {
      if (!x.refusal) continue;
      const key = JSON.stringify([x.spelling, x.faces, x.refusal.gate]);
      if (seen.has(key)) continue;
      seen.add(key);
      rec.push(x);
    }
    if (!rec.length) {
      // refusal not from addressOp: when its message names the operator (`中置 `X` の被演算子` / `値の演算子 `X` の被演算子`),
      // rebuild the operator from the refused line's text (recovered_from_refusal_message)
      const mm = o.refusal && /(?:中置|値の演算子) `([^`]+)` の被演算子/.exec(o.refusal.message || "");
      const nPre = (o.prepended || []).length;
      const lineText = o.refusal && o.refusal.line ? (o.refusal.line <= nPre ? o.prepended[o.refusal.line - 1] : o.source.split("\n")[o.refusal.line - nPre - 1]) : null;
      if (!mm || !lineText) {
        skipped.T2.push({ example_index: o.index, reason: o.refusal ? `read-stage refusal not from addressOp (${o.refusal.gate || ""} ${o.refusal.reason})` : "no tree" });
        continue;
      }
      const sym = mm[1];
      let body = lineText.trim();
      const def = /^\S+ :\s*(.*)$/.exec(body);
      if (def) body = def[1].includes(" ? ") ? def[1].slice(def[1].indexOf(" ? ") + 3) : def[1];
      const r = { ...base("T2", o), node: `refused (${o.refusal.gate} ${o.refusal.reason}) line ${o.refusal.line}: ${body}`, recovered_from_refusal_message: true, is_root: o.refusal.line - nPre === o.source.split("\n").length };
      const a = { kind: null, fine: "refused", refused: `${o.refusal.gate} ${o.refusal.reason}`, warnings: [], address_op: null };
      const parts = splitTop(body, sym);
      let model = null, mres = null;
      if (parts && BIN.has(sym)) {
        const oks = parts.map((p) => textKind(p, null, null, ctx));
        const bad = oks.find((q) => q.k === OUT);
        mres = bad ? { model: OUT, why: bad.why } : modelAnswer(sym, 2, oks.map((q) => q.k));
        model = { op: sym, operand_kinds: oks.map((q) => q.k), operand_via: oks.map((q) => q.via || q.why), answer: mres.model, warning_needed: mres.warn ?? null, table: mres.table ?? null };
      } else if (!parts && (sym === "-" || sym === "|…|") && (/^-/.test(body) || /^\|.*\|$/.test(body))) {
        const u = sym === "-" ? "-x" : "|x|";
        const opnd = sym === "-" ? body.slice(1) : body.slice(1, -1);
        const ok = textKind(opnd, null, null, ctx);
        mres = ok.k === OUT ? { model: OUT, why: ok.why } : modelAnswer(u, 1, [ok.k]);
        model = { op: u, operand_kinds: [ok.k], operand_via: [ok.via || ok.why], answer: mres.model, warning_needed: mres.warn ?? null, table: mres.table ?? null };
      } else {
        push({ ...r, model: null, alpha1: a, in_scope: false, out_of_scope_reason: BIN.has(sym) || sym === "-" ? "operator not recoverable from the refused line" : `operator ${sym} not in J-2 BinOp/UnOp`, verdict: "out-of-scope" });
        continue;
      }
      if (mres.model === OUT) {
        push({ ...r, model, alpha1: a, in_scope: false, out_of_scope_reason: mres.why, verdict: "out-of-scope" });
        continue;
      }
      const j = judgeOp(mres, a);
      push({ ...r, model, alpha1: a, in_scope: true, out_of_scope_reason: null, verdict: j.verdict, note: j.note });
      continue;
    }
    for (const x of rec) {
      const r = { ...base("T2", o), node: `refused addressOp ${x.spelling} (faces ${x.faces})`, is_root: x.spelling.trim() === o.source.split(String.fromCharCode(10)).slice(-1)[0].trim() };
      const a = { kind: null, fine: "refused", refused: `${x.refusal.gate} ${x.refusal.reason}`, warnings: [], address_op: { faces: x.faces, result: x.answer_kind, refusal: x.refusal.gate } };
      if (!BIN.has(x.sym)) {
        push({ ...r, model: null, alpha1: a, in_scope: false, out_of_scope_reason: `operator ${x.sym} outside J-2`, verdict: "out-of-scope" });
        continue;
      }
      const parts = splitTop(x.spelling, x.sym);
      const oks = x.faces.map((f, i) => (parts ? textKind(parts[i], f, x.info && x.info[i], ctx) : faceKind(f, x.info && x.info[i])));
      const ks = oks.map((q) => q.k);
      const bad = oks.find((q) => q.k === OUT);
      const mm = bad ? { model: OUT, why: bad.why } : modelAnswer(x.sym, 2, ks);
      const model = { op: x.sym, operand_kinds: ks, operand_via: oks.map((q) => q.via || q.why), answer: mm.model, warning_needed: mm.warn ?? null, table: mm.table ?? null };
      if (mm.model === OUT) {
        push({ ...r, model, alpha1: a, in_scope: false, out_of_scope_reason: mm.why, verdict: "out-of-scope" });
        continue;
      }
      const j = judgeOp(mm, a);
      push({ ...r, model, alpha1: a, in_scope: true, out_of_scope_reason: null, verdict: j.verdict, note: j.note });
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// T3 soundness J.6(a)
// ---------------------------------------------------------------------------------------------------------------
for (const o of dumps) {
  const v = o.value || {};
  if (v.status !== "value") {
    skipped.T3.push({ example_index: o.index, reason: `value stage: ${v.status}` });
    continue;
  }
  const vals = Array.isArray(v.all) && v.all.length ? v.all : [v];
  const trees = [...(o.all_trees || []), o.tree];
  for (const val of vals) {
    const li = (o.lines || []).findIndex((l) => l.line === val.line);
    const t = li >= 0 ? trees[li] : null;
    const r = { ...base("T3", o), node: `L${val.line} ${t ? t.show : "?"}` };
    if (!t) {
      push({ ...r, model: null, alpha1: null, in_scope: false, out_of_scope_reason: "value line has no tree", verdict: "out-of-scope" });
      continue;
    }
    const fine = alphaFine(t);
    const readKind = kindName(t.kind);
    const vt = val.type;
    const valueKind = vt === "function" || val.is_function ? "L" : vt === "Int" || vt === "Seq" || vt === "!_" ? "A" : "?";
    const model = { claim: "J.6(a): read kind ⊑ value kind", value_type: vt, value: val.show, value_kind: valueKind, item_types: val.item_types || null };
    const alpha1 = { kind: readKind, fine, answer_kind: t.answer_kind, desc: t.desc };
    let verdict, note = null;
    if (readKind === UNKNOWN) { verdict = "read-unknown"; note = "incompleteness, not a disagreement"; }
    else if (readKind !== "A" && readKind !== "L") { verdict = "read-unknown"; note = `read kind ${readKind}`; }
    else if (readKind !== valueKind) { verdict = "disagree"; note = `coarse: read ${readKind}, value ${vt}`; }
    else {
      // finer kinds
      if (fine === "void") { verdict = vt === "!_" ? "agree" : "disagree"; note = `read: known !_; value ${vt}`; }
      else if (fine === "Int" || fine === "number") {
        if (vt === "Int") verdict = "agree";
        else if (vt === "!_") { verdict = "agree"; note = "read number, value !_ (⊥ ∈ Int₊)"; }
        else { verdict = "disagree"; note = `read ${fine}, value ${vt}`; }
      } else if (fine === "container") {
        const d = t.desc || {};
        if (vt !== "Seq" && vt !== "!_") { verdict = "disagree"; note = `read container, value ${vt}`; }
        else if (typeof d.len === "number" && vt === "Seq" && Array.isArray(val.item_types) && d.len !== val.item_types.length) { verdict = "disagree"; note = `read len ${d.len}, value has ${val.item_types.length} items`; }
        else { verdict = "agree"; note = "container"; }
      } else if (isAddrFine(fine) || fine === "funAddr") { verdict = "agree-coarse"; note = `read ${fine}: the value stage has no Address type to compare (${vt})`; }
      else if (fine === "function") verdict = "agree";
      else { verdict = "agree-coarse"; note = `read ${fine}: only the coarse kind is decided`; }
    }
    push({ ...r, model, alpha1, in_scope: true, out_of_scope_reason: null, verdict, note });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// counts and output
// ---------------------------------------------------------------------------------------------------------------
// the spec's stated answer names an R62-family warning (address-number-mix, address-without-arrow, level-mismatch, or a
// width "warning") somewhere in the example's expectation (not necessarily at this node)
for (const r of rows) if (r.test === "T2") r.spec_mentions_r62_warning = /address-number-mix|address-without-arrow|level-mismatch|warning/.test(r.spec_expect);
// the spec's expectation names what the implementation does instead ("実装は …", listed in §6.4 as a known gap)
for (const r of rows) r.spec_notes_impl_gap = /実装は/.test(r.spec_expect || "");
const tests = ["T0", "T1", "T1u", "T2", "T3"];
const counts = { total_examples: dumps.length, value_status: {}, refused_examples: dumps.filter((o) => o.refusal).length, t0_spelling_crosscheck: t0SpellCheck, per_test: {} };
for (const o of dumps) counts.value_status[o.value.status] = (counts.value_status[o.value.status] || 0) + 1;
for (const t of tests) {
  const rs = rows.filter((r) => r.test === t);
  const c = { rows: rs.length, in_scope: 0, verdicts: {}, out_of_scope: 0, out_of_scope_by_reason: {}, examples_with_rows: new Set(rs.map((r) => r.example_index)).size, examples_with_in_scope_rows: new Set(rs.filter((r) => r.in_scope).map((r) => r.example_index)).size };
  for (const r of rs) {
    if (r.in_scope) { c.in_scope++; c.verdicts[r.verdict] = (c.verdicts[r.verdict] || 0) + 1; }
    else {
      c.out_of_scope++;
      // a row with several reasons counts once under each (so the reason counts can sum to more than out_of_scope)
      for (const why of r.out_of_scope_reasons) c.out_of_scope_by_reason[why] = (c.out_of_scope_by_reason[why] || 0) + 1;
      if (r.out_of_scope_reasons.length > 1) c.out_of_scope_rows_with_several_reasons = (c.out_of_scope_rows_with_several_reasons || 0) + 1;
    }
  }
  const sk = t === "T1u" ? [] : skipped[t];
  c.skipped_examples = sk.length;
  c.skipped_by_reason = {};
  for (const s of sk) {
    const why = s.reason;
    c.skipped_by_reason[why] = (c.skipped_by_reason[why] || 0) + 1;
  }
  counts.per_test[t] = c;
}
counts.note_T1 = "T1 and T1u share the T1 skipped list (examples without a tree or without a written row).";
const mismatches = rows.filter((r) => r.in_scope && r.verdict === "disagree");
counts.disagreements = { total: mismatches.length, by_test: Object.fromEntries(tests.map((t) => [t, mismatches.filter((r) => r.test === t).length])) };
const by = (rs, f) => { const m = {}; for (const r of rs) { const k = f(r); m[k] = (m[k] || 0) + 1; } return m; };
counts.disagreements.T2_by_note = by(mismatches.filter((r) => r.test === "T2"), (r) => `${r.model.op} ${r.model.operand_kinds.join(",")} -> ${r.model.answer} | ${r.alpha1.fine}${r.alpha1.refused ? " " + r.alpha1.refused.split(" ")[0] : ""}`);
counts.disagreements.T1_by_note = by(mismatches.filter((r) => r.test === "T1" || r.test === "T1u"), (r) => r.note);
counts.disagreements.by_spec_notes_impl_gap = by(mismatches, (r) => `${r.test} spec_notes_impl_gap=${r.spec_notes_impl_gap}`);
counts.disagreements.T2_by_is_root = by(mismatches.filter((r) => r.test === "T2"), (r) => `is_root=${r.is_root}`);
// T1/T1u side check (information, not a verdict): the root row's tree against the tree the spec writes.  The
// read stage's tree is a prediction that the value stage refolds (R118/R120), so a difference is not a disagreement.
counts.spec_tree_side_check = by(rows.filter((r) => (r.test === "T1" || r.test === "T1u") && r.in_scope && r.spec_tree), (r) =>
  `${r.test} alpha1_matches_spec_tree=${r.alpha1.matches_spec_tree}` + (r.test === "T1" ? ` model_matches=${r.model.matches_spec_tree}` : ` some_completion_matches=${(r.model.completions || []).some((c) => c.matches_spec_tree)}`) + ` spec_notes_impl_gap=${r.spec_notes_impl_gap}`);
fs.writeFileSync(Q("results.json"), JSON.stringify(rows, null, 1));
fs.writeFileSync(Q("mismatches.json"), JSON.stringify(mismatches, null, 1));
fs.writeFileSync(Q("counts.json"), JSON.stringify({ counts, skipped }, null, 1));
console.log(JSON.stringify(counts, null, 1));
