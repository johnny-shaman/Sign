// model.mjs -- executable port of the J-1 typing model and the J-2 tables of Sign's formal notes.
//
// Sources (git HEAD 172985de of this repository, read-only):
//   T:n  = formal/lean/SignMath/Typing.lean line n   (J.1-J.7)
//   A:n  = formal/lean/SignMath/Arith.lean  line n   (J.8, J.12, J.13)
//   R:n  = formal/lean/SignMath/Row.lean    line n   (dropVoid, orO/andO/xorO, buildOp, flatLE used by J)
//   S:n  = formal/skeleton.md line n (intended reading; used only where Lean leaves a spelling or a domain open)
//   G:n  = alpha1/javascript/sign.pegjs line n (only for spelling -> LitClass, which Lean does not define)
//
// Conventions
//   * Lean `Option α` inside literal ports: JS `null` is `none`; any other JS value v is `some v`.
//   * Read-stage answers handed to callers use the string constants below:
//       UNKNOWN      the read stage says "not known yet" (Lean `none` of the read stage, T:309 Approx)
//       OUT          "out-of-model": Lean is silent or ambiguous here; nothing is claimed
//       VOID_WARN    J-2's `none` of r62 / r62u: `!_` + warning (A:64-65)
//   * Kinds: J-1 SKind (T:102)  'Int' 'Address' 'CharCode' 'point' 'r0' 'b0' 'funAddr'
//            J-2 Kind   (A:36)  'Int' 'Address'
//            KVal SK3   (T:875, T:888) 'Int' 'Address' 'funAddr' (= SK3.fn) 'void' 'carried'
//   * Integers that Lean reads in Nat/Int are BigInt here.

export const UNKNOWN = 'unknown';
export const OUT = 'out-of-model';
export const VOID_WARN = 'void+warning';

// structural equality that also handles BigInt (functions compare by reference)
export function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEq(a[k], b[k]));
}
const uniq = (xs) => xs.filter((x, i) => xs.findIndex((y) => deepEq(x, y)) === i);

// =====================================================================================
// J.1  Typing is a fold  (Typing.lean)
// =====================================================================================

// T:19-22 inductive OpTm (L N O) | lit | name | op
export const lit = (l) => ({ tag: 'lit', l });
export const name = (i) => ({ tag: 'name', i });
export const op = (o, a, b) => ({ tag: 'op', o, a, b });

// T:25-29 def OpTm.fold μ ρ τ
export function fold(mu, rho, tau, t) {
  switch (t.tag) {
    case 'lit': return mu(t.l);
    case 'name': return rho(t.i);
    case 'op': return tau(t.o, fold(mu, rho, tau, t.a), fold(mu, rho, tau, t.b));
    default: throw new Error('not an OpTm');
  }
}

// T:32-35 def OpTm.mapLit
export function mapLit(f, t) {
  switch (t.tag) {
    case 'lit': return lit(f(t.l));
    case 'name': return name(t.i);
    case 'op': return op(t.o, mapLit(f, t.a), mapLit(f, t.b));
    default: throw new Error('not an OpTm');
  }
}

// T:86-98 inductive LitClass | dec | point | hex (w) | u0 (w) | r0 | b0
export const LC = {
  dec: () => ({ c: 'dec' }),
  point: () => ({ c: 'point' }),
  hex: (w) => ({ c: 'hex', w }),
  u0: (w) => ({ c: 'u0', w }),
  r0: () => ({ c: 'r0' }),
  b0: () => ({ c: 'b0' }),
};

// T:107-113 def LitClass.mark : LitClass → SKind   (width does not enter)
export function mark(lc) {
  switch (lc.c) {
    case 'dec': return 'Int';
    case 'point': return 'point';
    case 'hex': return 'Address';
    case 'u0': return 'CharCode';
    case 'r0': return 'r0';
    case 'b0': return 'b0';
    default: return OUT;
  }
}

// T:116-119 def LitClass.dropWidth
export function dropWidth(lc) {
  if (lc.c === 'hex') return LC.hex(0);
  if (lc.c === 'u0') return LC.u0(0);
  return lc;
}

// spelling → LitClass.  NOT in Lean (Lean starts from LitClass).  Taken from the number rules of
// G:177-180 (address / register / unicode / number), in the PEG order of Atom (G:170), and the
// μ table of S:346-354.  A spelling that no single rule matches in full → OUT
// (strings, chars, identifiers, `!_`, `1r5`, `0b12`, `-0x10` (= prefix `-` on an address), ...).
export function litClass(spelling) {
  if (typeof spelling !== 'string') return OUT;
  let m;
  if ((m = /^([0-9]+)x[0-9a-fA-F]+$/.exec(spelling))) return LC.hex(parseInt(m[1], 10)); // G:178 address; `0x` = width 0 (T:91)
  if (/^0r[0-9a-fA-F]+$/.test(spelling)) return LC.r0();                                // G:179 register `0r…`
  if (/^0b[01]+$/.test(spelling)) return LC.b0();                                        // G:179 register `0b…`
  if ((m = /^([0-9]+)u[0-9a-fA-F]+$/.exec(spelling))) return LC.u0(parseInt(m[1], 10));  // G:180 unicode `0u…`/`NuHHHH`
  if (/^-?[0-9]+\.?[0-9]*$/.test(spelling)) return spelling.includes('.') ? LC.point() : LC.dec(); // G:177, split by `.` (S:381)
  return OUT;
}

// litMark(spelling) = LitClass.mark (litClass spelling)   (T:107 after the spelling map above)
export function litMark(spelling) {
  const lc = litClass(spelling);
  return lc === OUT ? OUT : mark(lc);
}

// =====================================================================================
// J.2  Kinds of recursive names: the greatest fixed point  (Guess n = Fin n → Bool, true = A)
// =====================================================================================

// T:134 Guess.le
export const guessLe = (x, y) => x.every((xi, i) => !xi || y[i]);
// T:137 Guess.top
export const guessTop = (n) => Array(n).fill(true);
// T:140-141 GMono, decided by enumerating all 2^n guesses (finite n only)
export function gMono(F, n) {
  const all = allGuesses(n);
  for (const x of all) for (const y of all) if (guessLe(x, y) && !guessLe(F(x), F(y))) return false;
  return true;
}
export function allGuesses(n) {
  const out = [];
  for (let m = 0; m < 1 << n; m++) out.push(Array.from({ length: n }, (_, i) => ((m >> i) & 1) === 1));
  return out;
}
// T:144-146 gIter
export function gIter(F, n, k) {
  let x = guessTop(n);
  for (let j = 0; j < k; j++) x = F(x);
  return x;
}
// T:149-150 gUpdate
export function gUpdate(F, x, i) {
  const fx = F(x);
  return x.map((xj, j) => (j === i ? fx[j] : xj));
}
// T:153-154 gRun  (foldl from Guess.top)
export function gRun(F, n, s) {
  return s.reduce((x, i) => gUpdate(F, x, i), guessTop(n));
}

// =====================================================================================
// J.3  The juxtaposition table and the row fold
// =====================================================================================

// T:309 Approx x k := x = none ∨ x = some k
export const approx = (x, k) => x === null || deepEq(x, k);

// T:312-314 SoundBin τ τR, decided by enumeration over a finite K (dom) and the given read inputs
export function soundBin(tau, tauR, dom) {
  const opt = [null, ...dom];
  for (const x of opt) for (const y of opt)
    for (const k1 of dom) for (const k2 of dom)
      if (approx(x, k1) && approx(y, k2) && !approx(tauR(x, y), tau(k1, k2))) return false;
  return true;
}

// T:317-319 Kd = A | L ; T:322-324 Step = build | comp | app | noRead
export const KD = ['A', 'L'];
export const STEPS = ['build', 'comp', 'app', 'noRead'];

// T:327-331 def tauSpace
export function tauSpace(a, b) {
  if (a === 'A' && b === 'A') return 'build';
  if (a === 'L' && b === 'L') return 'comp';
  if (a === 'L' && b === 'A') return 'app';
  if (a === 'A' && b === 'L') return 'noRead';
  return OUT; // inputs outside {A, L}
}

// T:334-336 Act = push | comp | app ; T:339-343 Step.act
export const ACTS = ['push', 'comp', 'app'];
export function stepAct(s) {
  switch (s) {
    case 'build': return 'push';
    case 'noRead': return 'push';
    case 'comp': return 'comp';
    case 'app': return 'app';
    default: return OUT;
  }
}
// T:346 actSpace a b := (tauSpace a b).act
export const actSpace = (a, b) => stepAct(tauSpace(a, b));

// T:349-352 def actBest : Option Kd → Option Kd → Option Act   (null = none)
export function actBest(x, y) {
  if (x !== null && y !== null) return actSpace(x, y);
  if (x === 'A' && y === null) return 'push';
  return null;
}

// T:453-455 Item V F | val | fn ; T:458-460 Item.kd
export const val = (v) => ({ tag: 'val', v });
export const fn = (f) => ({ tag: 'fn', f });
export const itemKd = (it) => (it.tag === 'val' ? 'A' : 'L');

// T:464-469 def rowStep (stack top = head = index 0)
//   | .fn f :: s, .val x => .val (f x) :: s
//   | .fn f :: s, .fn g  => .fn (fun x => g (f x)) :: s     (left function runs first, R11)
//   | s, it => it :: s
export function rowStep(st, it) {
  if (st.length > 0 && st[0].tag === 'fn' && it.tag === 'val') return [val(st[0].f(it.v)), ...st.slice(1)];
  if (st.length > 0 && st[0].tag === 'fn' && it.tag === 'fn') {
    const f = st[0].f, g = it.f;
    return [fn((x) => g(f(x))), ...st.slice(1)];
  }
  return [it, ...st];
}
// T:472-473 def rowFold w := w.foldl rowStep []
export const rowFold = (w) => w.reduce(rowStep, []);

// T:485-489 ItemSat (the fn case quantifies over all d, k; here over the finite samples given)
export function itemSat(sat, dSample, kSample, it, ik) {
  if (it.tag === 'val' && ik.tag === 'val') return sat(it.v, ik.v);
  if (it.tag === 'fn' && ik.tag === 'fn')
    return dSample.every((d) => kSample.every((k) => !sat(d, k) || sat(it.f(d), ik.f(k))));
  return false;
}
// T:492-495 Rel2 (List.Forall₂)
export const rel2 = (R, as, bs) => as.length === bs.length && as.every((a, i) => R(a, bs[i]));

// ---- derived: the read stage over item kinds A / L / unknown -------------------------------
// Not a Lean def.  It runs the literal rowStep cases (T:467-469) on symbolic items, choosing the
// action with actBest (T:349) from the kinds only.  The empty stack always pushes (T:469 with s = []).
// When actBest = none the read stage MUST say unknown there (T:409 act_defer, T:374 space_defer);
// Lean defines nothing after that point, so the rest of the row is OUT.
// Shapes: a label string, ['apply', f, x], ['compose', f, g] (f runs first: T:468), and for a final
// stack of >= 2 items ['construct', bottom, ..., top] (the stack itself, T:472).
// Function items have one port only and app always yields a value (T:464: f : V → V).
function kdOf(k) {
  if (k === 'A' || k === 'L') return k;
  if (k === UNKNOWN || k === null || k === undefined) return null;
  return OUT;
}
export function sexpr(shape, flat = false) {
  if (typeof shape === 'string') return shape;
  const [head, ...args] = shape;
  if (flat && head === 'compose' && Array.isArray(args[0]) && args[0][0] === 'compose') {
    // compose is left-nested by T:468; the flat print lists the chain in running order (spec style)
    const inner = sexpr(args[0], true).slice('(compose '.length, -1);
    return `(compose ${inner} ${sexpr(args[1], true)})`;
  }
  return `(${head} ${args.map((a) => sexpr(a, flat)).join(' ')})`;
}
export function predictRow(items) {
  const st = []; // head = top, as in T:464
  const steps = [];
  const kname = (k) => (k === null ? UNKNOWN : k);
  for (let i = 0; i < items.length; i++) {
    const raw = typeof items[i] === 'string' ? { kind: items[i] } : items[i];
    const k = kdOf(raw.kind);
    if (k === OUT) return { status: OUT, reason: `item ${i}: kind ${raw.kind} is not A, L or unknown` };
    const node = { kind: k, shape: raw.label ?? `x${i}` };
    if (st.length === 0) {
      st.unshift(node);
      steps.push({ i, top: null, next: kname(k), act: 'push', step: null });
      continue;
    }
    const top = st[0];
    const act = actBest(top.kind, k);
    if (act === null) {
      return {
        status: 'defer', at: i, top: kname(top.kind), next: kname(k), steps,
        stack: st.map((n) => ({ kind: kname(n.kind), shape: n.shape })), rest: OUT,
      };
    }
    const step = top.kind !== null && k !== null ? tauSpace(top.kind, k) : null; // null: A then unknown (build or noRead)
    if (act === 'push') st.unshift(node);
    else if (act === 'comp') st[0] = { kind: 'L', shape: ['compose', top.shape, node.shape] };
    else st[0] = { kind: 'A', shape: ['apply', top.shape, node.shape] };
    steps.push({ i, top: kname(top.kind), next: kname(k), act, step });
  }
  const shape = st.length === 1 ? st[0].shape : ['construct', ...[...st].reverse().map((n) => n.shape)];
  return {
    status: 'decided', length: st.length,
    stack: st.map((n) => ({ kind: kname(n.kind), shape: n.shape })),
    shape, sexpr: st.length === 0 ? '()' : sexpr(shape), sexprFlat: st.length === 0 ? '()' : sexpr(shape, true), steps,
  };
}
// interpret a shape with an environment (used to check predictRow against the literal rowFold)
export function evalShape(shape, env) {
  if (typeof shape === 'string') return env[shape];
  const [h, ...a] = shape;
  if (h === 'apply') return evalShape(a[0], env)(evalShape(a[1], env));
  if (h === 'compose') { const f = evalShape(a[0], env), g = evalShape(a[1], env); return (x) => g(f(x)); }
  if (h === 'construct') return a.map((s) => evalShape(s, env));
  throw new Error('bad shape');
}

// =====================================================================================
// J.4  Self-typed separators (and the Row.lean pieces they use)
// =====================================================================================

// T:557, T:560
export const MAX64 = 9223372036854775807n;
export const MIN64 = -9223372036854775808n;
// T:563-566 plusV
export function plusV(a, b) {
  if (a === null) return b;
  if (b === null) return a;
  const s = a + b;
  return MIN64 <= s && s <= MAX64 ? s : null;
}
// T:569-571 eqO
export const eqO = (a, b) => (a !== null && b !== null ? (deepEq(a, b) ? a : null) : null);
// T:574-576 ltO
export const ltO = (a, b) => (a !== null && b !== null ? (a < b ? a : null) : null);

// R:15 dropVoid w := w.filterMap id
export const dropVoid = (w) => w.filter((x) => x !== null);
// R:213-215 orO, R:218-220 andO, R:223-226 xorO
export const orO = (a, b) => (a !== null ? a : b);
export const andO = (a, b) => (a === null ? null : b);
export const xorO = (a, b) => (a !== null && b === null ? a : a === null && b !== null ? b : null);
// R:440-453 buildOp c  (c = [k ∈ {0,1,2}, l, r])
export function buildOp(c) {
  const [k, l, r] = c;
  return (a, b) => {
    if (a !== null && b !== null) return k === 0 ? null : k === 1 ? a : b;
    if (a !== null && b === null) return l ? a : null;
    if (a === null && b !== null) return r ? b : null;
    return null;
  };
}
// R:531-535 ops_coordinates: `|` (1,T,T), `&` (2,F,F), `;` (0,T,T)
export const COORD = { or: [1, true, true], and: [2, false, false], xor: [0, true, true] };

// =====================================================================================
// J.5  Two sides of different kinds
// =====================================================================================

// T:661-664 allCoords
export const allCoords = [
  [0, false, false], [0, false, true], [0, true, false], [0, true, true],
  [1, false, false], [1, false, true], [1, true, false], [1, true, true],
  [2, false, false], [2, false, true], [2, true, false], [2, true, true],
];
// T:657-658 detB c := !((c.1 = 1 ∨ c.2.1) ∧ (c.1 = 2 ∨ c.2.2))
export const detB = (c) => !((c[0] === 1 || c[1]) && (c[0] === 2 || c[2]));
// T:647-654 DetLeft / DetRight, decided by enumerating Option A × Option B for the given finite A, B
export function detLeft(c, A, B) { return detSide(c, A, B, 'L'); }
export function detRight(c, A, B) { return detSide(c, A, B, 'R'); }
function detSide(c, A, B, side) {
  const o = buildOp(c);
  for (const x of [null, ...A]) for (const y of [null, ...B]) {
    const v = o(x === null ? null : { L: x }, y === null ? null : { R: y });
    if (v !== null && !(side in v)) return false;
  }
  return true;
}
// derived (T:684 det_iff): which side's kind the answer of a natural op is coarsely fixed to
export function coarseSide(c) {
  const A = ['a'], B = ['b'];
  const l = detLeft(c, A, B), r = detRight(c, A, B);
  return l && r ? 'both(const ⊥)' : l ? 'left' : r ? 'right' : 'undetermined';
}

// =====================================================================================
// J.6  Two stages
// =====================================================================================

// T:722-724 SoundTable τ τR := ∀ o, SoundBin (τ o) (τR o)   (enumerated over the given ops and K)
export const soundTable = (tau, tauR, ops, dom) => ops.every((o) => soundBin((a, b) => tau(o, a, b), (x, y) => tauR(o, x, y), dom));

// T:776-781 liftAbs τ ab
export function liftAbs(tau, ab) {
  return (o, x, y) => {
    if (x !== null && y !== null) return tau(o, x, y);
    if (x !== null && y === null) return ab(o, x) ? x : null;
    if (x === null && y !== null) return ab(o, y) ? y : null;
    return null;
  };
}

// T:801-806 eval1 κ δ η ev
export function eval1(kappa, delta, eta, ev, t) {
  if (t.tag === 'lit') return delta(t.l);
  if (t.tag === 'name') return eta(t.i);
  const da = eval1(kappa, delta, eta, ev, t.a), db = eval1(kappa, delta, eta, ev, t.b);
  return ev(t.o, kappa(da), kappa(db), da, db);
}
// T:810-816 eval2 κ δ η ev tyR   ((tyR a).getD (κ …): the read-stage kind first, else the value's kind)
export function eval2(kappa, delta, eta, ev, tyR, t) {
  if (t.tag === 'lit') return delta(t.l);
  if (t.tag === 'name') return eta(t.i);
  const da = eval2(kappa, delta, eta, ev, tyR, t.a), db = eval2(kappa, delta, eta, ev, tyR, t.b);
  const ka = tyR(t.a), kb = tyR(t.b);
  return ev(t.o, ka !== null ? ka : kappa(da), kb !== null ? kb : kappa(db), da, db);
}

// T:875-879 KVal S | kind s | void | carried ; T:888-890 SK3 int | addr | fn
export const KVAL_DOM = ['Int', 'Address', 'funAddr', 'void', 'carried'];
export const KIND_DOM = ['Int', 'Address'];
// T:882-885 KVal.collapse : void and carried both go to ⊥
export const collapse = (k) => (k === 'void' || k === 'carried' ? null : k);

// T:894-904 plusK (match order kept)
export function plusK(x, y) {
  if (!KVAL_DOM.includes(x) || !KVAL_DOM.includes(y)) return OUT;
  if (x === 'carried') return 'carried';
  if (y === 'carried') return 'carried';
  if (x === 'funAddr') return 'carried';
  if (y === 'funAddr') return 'carried';
  if (x === 'void' && y === 'void') return 'void';
  if (x === 'void' && y === 'Int') return 'Int';
  if (x === 'Int' && y === 'void') return 'Int';
  if (x === 'Int' && y === 'Int') return 'Int';
  if (x === 'Address' && y === 'Address') return 'Address';
  return 'carried';
}

// =====================================================================================
// J.7  Reassociation: T:918-926 Reassoc generated by (a o b) o c ≈ a o (b o c)
// =====================================================================================
export function reassocStep(o, t) {
  // one generator step at the root, both directions; returns null if the root does not match
  if (t.tag === 'op' && t.o === o && t.a.tag === 'op' && t.a.o === o) return op(o, t.a.a, op(o, t.a.b, t.b));
  if (t.tag === 'op' && t.o === o && t.b.tag === 'op' && t.b.o === o) return op(o, op(o, t.a, t.b.a), t.b.b);
  return null;
}

// =====================================================================================
// J.8  Literal marks and the operator tables  (Arith.lean)
// =====================================================================================

// A:30 AllPos, A:33 Pow2 (as predicates on BigInt λ)
export const AllPos = () => true;
export const Pow2 = (l) => l > 0n && (l & (l - 1n)) === 0n;

// A:36-39 Kind ; A:42-44 Kind.deg
export const kindDeg = (k) => (k === 'Int' ? 0 : k === 'Address' ? 1 : OUT);
// A:47-51 Mark | dec | hex | width w ; A:54-57 Mark.kind
export function markKind(m) {
  if (m.m === 'dec') return 'Int';
  if (m.m === 'hex' || m.m === 'width') return 'Address';
  return OUT;
}
// spelling → Arith Mark (not in Lean; same spelling rules as litClass).  `0x…` (width 0) → hex,
// `NxHHHH` with N > 0 → width N.  `.`, `0u`, `0r`, `0b` are J-3 / outside J-2 (A:46) → OUT.
export function markOf(spelling) {
  const lc = litClass(spelling);
  if (lc === OUT) return OUT;
  if (lc.c === 'dec') return { m: 'dec' };
  if (lc.c === 'hex') return lc.w === 0 ? { m: 'hex' } : { m: 'width', w: lc.w };
  return OUT;
}

// A:60-62 BinOp
export const BINOPS = ['add', 'sub', 'mul', 'div', 'mod', 'pow', 'shl', 'shr', 'band', 'bor', 'bxor', 'lt', 'eq'];
// spelling → BinOp.  Lean A:59 says only "比べは `<` で代表する".  `<` `<=` `>` `>=` are the
// comparisons; `=` and `!=` are put in the same family by coproduct_spec R62 (段13), so they map to
// lt too (a reading of the spec, not of Lean).  `!==` has no Lean counterpart → OUT.
export const BINOP_SPELLING = {
  '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'mod', '^': 'pow', '<<': 'shl', '>>': 'shr',
  '&&': 'band', '||': 'bor', ';;': 'bxor',
  '<': 'lt', '<=': 'lt', '>': 'lt', '>=': 'lt', '=': 'lt', '!=': 'lt', '==': 'eq',
};
export function binOpOf(s) {
  if (BINOPS.includes(s)) return s;
  return Object.prototype.hasOwnProperty.call(BINOP_SPELLING, s) ? BINOP_SPELLING[s] : OUT;
}

// A:67-80 r62 : BinOp → Kind → Kind → Option Kind   (null = `!_` + warning; match order kept)
export function r62(o, k1, k2) {
  if (k1 === 'Int' && k2 === 'Int') return 'Int';
  if (o === 'add' && k1 === 'Address' && k2 === 'Address') return 'Address';
  if (o === 'sub' && k1 === 'Address' && k2 === 'Address') return 'Address';
  if (o === 'mul' && k1 === 'Address' && k2 === 'Int') return 'Address';
  if (o === 'div' && k1 === 'Address' && k2 === 'Address') return 'Int';
  if (o === 'mod' && k1 === 'Address' && k2 === 'Address') return 'Address';
  if (o === 'shl' && k1 === 'Address' && k2 === 'Int') return 'Address';
  if (o === 'band' && k1 === 'Address' && k2 === 'Address') return 'Address';
  if (o === 'bor' && k1 === 'Address' && k2 === 'Address') return 'Address';
  if (o === 'bxor' && k1 === 'Address' && k2 === 'Address') return 'Address';
  if (o === 'lt' && k1 === 'Address' && k2 === 'Address') return 'Address';
  if (o === 'eq' && k1 === 'Address' && k2 === 'Address') return 'Address';
  return null;
}
// A:83 markTable o m₁ m₂ := r62 o m₁.kind m₂.kind
export function markTable(o, m1, m2) {
  const k1 = markKind(m1), k2 = markKind(m2);
  return k1 === OUT || k2 === OUT || !BINOPS.includes(o) ? OUT : r62(o, k1, k2);
}

// opKind(op, left, right): r62 for callers.  op: BinOp name or spelling; kinds 'Int' | 'Address'.
// Returns 'Int' | 'Address' | VOID_WARN, or OUT when the op or a kind is outside A:60 / A:36.
export function opKind(o, k1, k2) {
  const b = binOpOf(o);
  if (b === OUT || !KIND_DOM.includes(k1) || !KIND_DOM.includes(k2)) return OUT;
  const r = r62(b, k1, k2);
  return r === null ? VOID_WARN : r;
}

// A:86-94 subA divF modA ltW eqW (Nat; BigInt here)
export const subA = (x, y) => (y <= x ? x - y : null);
export const divF = (x, y) => (0n < y ? x / y : null);
export const modA = (x, y) => (0n < y ? x % y : null);
export const ltW = (x, y) => (x < y ? x : null);
export const eqW = (x, y) => (x === y ? x : null);
// A:97-110 cand
export function cand(o) {
  switch (o) {
    case 'add': return (x, y) => x + y;
    case 'sub': return subA;
    case 'mul': return (x, y) => x * y;
    case 'div': return divF;
    case 'mod': return modA;
    case 'pow': return (x, y) => x ** y;
    case 'shl': return (x, y) => x << y;
    case 'shr': return (x, y) => x >> y;
    case 'band': return (x, y) => x & y;
    case 'bor': return (x, y) => x | y;
    case 'bxor': return (x, y) => x ^ y;
    case 'lt': return ltW;
    case 'eq': return eqW;
    default: return OUT;
  }
}
// A:113-117 scale
export const scale = (o) => (o === 'band' || o === 'bor' || o === 'bxor' ? Pow2 : AllPos);

// A:120-122 UnOp abs | bnot | fact | neg
export const UNOPS = ['abs', 'bnot', 'fact', 'neg'];
export const UNOP_SPELLING = { '|x|': 'abs', '!!': 'bnot', 'x!': 'fact', '-x': 'neg' };
export function unOpOf(s) {
  if (UNOPS.includes(s)) return s;
  return Object.prototype.hasOwnProperty.call(UNOP_SPELLING, s) ? UNOP_SPELLING[s] : OUT;
}
// A:125-129 r62u
export function r62u(o, k) {
  if (k === 'Int') return 'Int';
  if (o === 'abs' && k === 'Address') return 'Address';
  if (o === 'bnot' && k === 'Address') return 'Address';
  return null;
}
export function opKind1(o, k) {
  const u = unOpOf(o);
  if (u === OUT || !KIND_DOM.includes(k)) return OUT;
  const r = r62u(u, k);
  return r === null ? VOID_WARN : r;
}
// A:132-134 fact, A:137 notW, A:140 negN (Nat: truncated subtraction as in Lean)
export function fact(n) { let r = 1n; for (let i = 2n; i <= n; i++) r *= i; return r; }
export const natSub = (a, b) => (a >= b ? a - b : 0n);
export const notW = (x) => natSub(natSub(2n ** 64n, 1n), x);
export const negN = (x) => (x === 0n ? 0n : null);
// A:143-147 cand1
export function cand1(o) {
  switch (o) {
    case 'abs': return (x) => x;
    case 'bnot': return notW;
    case 'fact': return fact;
    case 'neg': return negN;
    default: return OUT;
  }
}
// A:150-152 scale1
export const scale1 = (o) => (o === 'bnot' ? Pow2 : AllPos);

// A:22-23 Homog G d₁ d₂ d f — sampled: λ ∈ G ∩ [1, lmax], x, y ∈ [0, vmax].  A failure is a real
// counterexample; "ok" only means none was found in the sample.
export function homogSample(G, d1, d2, d, f, { lmax = 8, vmax = 10 } = {}) {
  for (let l = 1n; l <= BigInt(lmax); l++) {
    if (!G(l)) continue;
    for (let x = 0n; x <= BigInt(vmax); x++) for (let y = 0n; y <= BigInt(vmax); y++) {
      const lhs = f(l ** BigInt(d1) * x, l ** BigInt(d2) * y);
      const r = f(x, y);
      const rhs = r === null ? null : l ** BigInt(d) * r;
      if (lhs !== rhs) return { ok: false, l, x, y };
    }
  }
  return { ok: true };
}
// A:26-27 Homog1 — sampled likewise
export function homog1Sample(G, d1, d, f, { lmax = 8, vmax = 10 } = {}) {
  for (let l = 1n; l <= BigInt(lmax); l++) {
    if (!G(l)) continue;
    for (let x = 0n; x <= BigInt(vmax); x++) {
      const lhs = f(l ** BigInt(d1) * x);
      const r = f(x);
      const rhs = r === null ? null : l ** BigInt(d) * r;
      if (lhs !== rhs) return { ok: false, l, x };
    }
  }
  return { ok: true };
}
// the full J.8 table as data (13 ops × 4 kind pairs), with the 3 outliers of A:465-468 flagged
export function r62Table() {
  const rows = [];
  for (const o of BINOPS) for (const k1 of KIND_DOM) for (const k2 of KIND_DOM) {
    const r = r62(o, k1, k2);
    rows.push({ op: o, left: k1, right: k2, answer: r === null ? VOID_WARN : r, outlier: o === 'mul' && k1 === 'Int' && k2 === 'Address' });
  }
  for (const o of UNOPS) for (const k of KIND_DOM) {
    const r = r62u(o, k);
    rows.push({ op: o, arg: k, answer: r === null ? VOID_WARN : r, outlier: k === 'Address' && (o === 'bnot' || o === 'neg') });
  }
  return rows;
}

// =====================================================================================
// J.12  The two lifts of `!_` and the cross-kind `+`
// =====================================================================================

// A:914-917 liftU f
export const liftU = (f) => (a, b) => (a !== null && b !== null ? f(a, b) : a !== null ? a : b);
// A:920-922 liftZ f
export const liftZ = (f) => (a, b) => (a !== null && b !== null ? f(a, b) : null);
// A:925-926 KAssoc f, checked on a finite sample
export function kassocSample(f, xs) {
  const bind = (m, k) => (m === null ? null : k(m));
  for (const x of xs) for (const y of xs) for (const z of xs)
    if (!deepEq(bind(f(x, y), (w) => f(w, z)), bind(f(y, z), (w) => f(x, w)))) return { ok: false, x, y, z };
  return { ok: true };
}

// A:1042-1046 Val N A | num | addr | fn ; Option (Option Val): outer none = ⊥_A (carried), some none = ⊥_N
export const BOT_A = { t: 'botA' };
export const BOT_N = { t: 'botN' };
export const vnum = (n) => ({ t: 'num', n });
export const vaddr = (a) => ({ t: 'addr', a });
export const VFN = { t: 'fn' };
// A:1051-1060 mixOp gN gA (match order kept; gA returns null for none)
export function mixOp(gN, gA) {
  return (s, t) => {
    if (s.t === 'botA') return BOT_A;
    if (t.t === 'botA') return BOT_A;
    if (s.t === 'botN' && t.t === 'botN') return BOT_N;
    if (s.t === 'botN' && t.t === 'num') return vnum(t.n);
    if (s.t === 'num' && t.t === 'botN') return vnum(s.n);
    if (s.t === 'num' && t.t === 'num') return vnum(gN(s.n, t.n));
    if (s.t === 'addr' && t.t === 'addr') { const c = gA(s.a, t.a); return c === null ? BOT_A : vaddr(c); }
    return BOT_A;
  };
}
// A:1063-1069 oneOp gN gA over Option Val (none = BOT)
export const BOT = { t: 'bot' };
export function oneOp(gN, gA) {
  return (s, t) => {
    if (s.t === 'bot' && t.t === 'num') return vnum(t.n);
    if (s.t === 'num' && t.t === 'bot') return vnum(s.n);
    if (s.t === 'num' && t.t === 'num') return vnum(gN(s.n, t.n));
    if (s.t === 'addr' && t.t === 'addr') { const c = gA(s.a, t.a); return c === null ? BOT : vaddr(c); }
    return BOT;
  };
}
// A:1161-1163 plus2, A:1166-1167 plus1
export const plus2 = mixOp((a, b) => a + b, (a, b) => a + b);
export const plus1 = oneOp((a, b) => a + b, (a, b) => a + b);

// =====================================================================================
// J.13  Overflow and fabrication
// =====================================================================================
// A:1183-1185 Tm | lit n | node g s t
export const tlit = (n) => ({ t: 'lit', n });
export const tnode = (g, s, u) => ({ t: 'node', g, s, u });
// A:1188-1190 Tm.exact
export const exact = (m) => (m.t === 'lit' ? m.n : m.g(exact(m.s), exact(m.u)));
// A:1193 bnd
export const bnd = (B, v) => (B(v) ? v : null);
// A:1196-1198 evZ, A:1201-1203 evU
export const evZ = (B, m) => (m.t === 'lit' ? bnd(B, m.n) : liftZ((x, y) => bnd(B, m.g(x, y)))(evZ(B, m.s), evZ(B, m.u)));
export const evU = (B, m) => (m.t === 'lit' ? bnd(B, m.n) : liftU((x, y) => bnd(B, m.g(x, y)))(evU(B, m.s), evU(B, m.u)));
// A:1206 in64, A:1209 maxInt
export const in64 = (v) => -(2n ** 63n) <= v && v <= 2n ** 63n - 1n;
export const maxInt = 2n ** 63n - 1n;
const add = (a, b) => a + b, sub = (a, b) => a - b;
// A:1212 tOver, A:1215-1216 tOver'
export const tOver = tnode(add, tnode(add, tlit(maxInt), tlit(2n)), tnode(sub, tlit(0n), tlit(2n)));
export const tOver2 = tnode(add, tlit(maxInt), tnode(add, tlit(2n), tnode(sub, tlit(0n), tlit(2n))));
// R:622-625 flatLE
export const flatLE = (a, b) => (a === null ? true : b === null ? false : deepEq(a, b));

// =====================================================================================
// Derived: what a sound read stage may say for the value operators (not a Lean def)
// =====================================================================================
// bestSound(τ, dom)(x, y) with x, y ∈ dom ∪ {UNKNOWN}: the most a sound read table may decide.
//  * Both known: τ itself (T:736 readStage_complete needs exactly this).
//  * One side unknown: decided only when the row/column is constant over dom (T:752
//    decided_needs_const, T:761 decided_needs_const_right); otherwise UNKNOWN is forced.
//  * This is the construction of actBest (T:349) for τ = actSpace (checked in the tests).
//  * If τ is OUT on some cell the unknown may reach: UNKNOWN if two defined cells already differ
//    (forced whatever the OUT cells are), else OUT.
export function bestSound(tau, dom) {
  return (x, y) => {
    const xs = x === UNKNOWN ? dom : [x];
    const ys = y === UNKNOWN ? dom : [y];
    const vals = [];
    for (const a of xs) for (const b of ys) vals.push(tau(a, b));
    const def = uniq(vals.filter((v) => v !== OUT));
    if (def.length >= 2) return UNKNOWN;
    if (def.length === 0 || vals.some((v) => v === OUT)) return OUT;
    return def[0];
  };
}
// range 'Kind': unknown ranges over {Int, Address} (the K of J-2, A:36); table = r62 with none = VOID_WARN.
// range 'KVal': unknown ranges over KVal SK3 (T:875); `+` uses plusK (T:894); other ops use r62 on
//   Int/Address with none read as 'carried' (plusK's doc T:893 "Int と Address の混ぜは carried" and the
//   J-1 definition of carried, S:344); other ops on void / carried / funAddr are OUT (Lean has no table).
function tableKind(o, a, b) { const r = r62(o, a, b); return r === null ? VOID_WARN : r; }
function tableKVal(o, a, b) {
  if (o === 'add') return plusK(a, b);
  if (KIND_DOM.includes(a) && KIND_DOM.includes(b)) { const r = r62(o, a, b); return r === null ? 'carried' : r; }
  return OUT;
}
export function predictOp(o, x, y, range = 'Kind') {
  const b = binOpOf(o);
  const dom = range === 'Kind' ? KIND_DOM : range === 'KVal' ? KVAL_DOM : null;
  if (b === OUT || dom === null) return OUT;
  const ok = (v) => v === UNKNOWN || dom.includes(v);
  if (!ok(x) || !ok(y)) return OUT;
  const tau = range === 'Kind' ? (p, q) => tableKind(b, p, q) : (p, q) => tableKVal(b, p, q);
  return bestSound(tau, dom)(x, y);
}
export function predictOp1(o, x) {
  const u = unOpOf(o);
  if (u === OUT || !(x === UNKNOWN || KIND_DOM.includes(x))) return OUT;
  const t1 = (p) => { const r = r62u(u, p); return r === null ? VOID_WARN : r; };
  return bestSound((p, _q) => t1(p), KIND_DOM)(x, KIND_DOM[0]); // the second argument is a dummy known point
}
// foldKind(t, rho, range): T:25 OpTm.fold with μ = litMark restricted to the J-2 kinds (other marks → OUT),
// ρ = rho[name] (default UNKNOWN), τ = the bestSound table over the fold's own K.  OUT propagates.
// The K of a fold must hold every answer a node can give (T:25 needs τ : K → K → K):
//   'KVal': K = KVal SK3; tableKVal stays inside it (none of r62 is read as carried), so K is closed.
//   'Kind': K = {Int, Address, VOID_WARN} = r62's codomain (Option Kind).  r62 has no row for a
//           VOID_WARN operand, so those cells are OUT; an UNKNOWN operand therefore never yields a decided
//           answer unless two defined cells already differ (then UNKNOWN).  (predictOp(…, 'Kind') is the
//           single-operator table where the unknown is an operand of J-2 kind Int or Address.)
// Read-stage soundness of this fold is T:727 readStage_sound for these tables (checked on random trees).
export function foldKind(t, rho = {}, range = 'KVal') {
  const mu = (s) => { const m = litMark(s); return m === 'Int' || m === 'Address' ? m : OUT; };
  let dom, tauR;
  if (range === 'KVal') {
    dom = KVAL_DOM;
    tauR = (o, a, b) => predictOp(o, a, b, 'KVal');
  } else if (range === 'Kind') {
    dom = [...KIND_DOM, VOID_WARN];
    tauR = (o, a, b) => {
      const bo = binOpOf(o);
      if (bo === OUT) return OUT;
      return bestSound((p, q) => (KIND_DOM.includes(p) && KIND_DOM.includes(q) ? tableKind(bo, p, q) : OUT), dom)(a, b);
    };
  } else return OUT;
  const rhoF = (i) => { const v = Object.prototype.hasOwnProperty.call(rho, i) ? rho[i] : UNKNOWN; return v === UNKNOWN || dom.includes(v) ? v : OUT; };
  const tau = (o, a, b) => (a === OUT || b === OUT ? OUT : tauR(o, a, b));
  return fold(mu, rhoF, tau, t);
}
