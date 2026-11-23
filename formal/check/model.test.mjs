// model.test.mjs -- checks the concrete facts the Lean theorems of J-1 / J-2 state, against model.mjs.
// Run: node model.test.mjs     (exit code 1 on any failure)
// Every group names the Lean theorem it checks (T:n Typing.lean, A:n Arith.lean).
// Universally quantified theorems are checked by exhaustive enumeration where the domain is finite,
// otherwise on a deterministic pseudo-random sample (seeded), which is marked "sample".
import * as M from './model.mjs';
const { UNKNOWN, OUT, VOID_WARN, deepEq } = M;

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) pass++;
  else { fail++; fails.push(name + (detail !== undefined ? ' :: ' + safe(detail) : '')); }
}
function safe(x) { try { return JSON.stringify(x, (_, v) => (typeof v === 'bigint' ? v.toString() + 'n' : typeof v === 'function' ? '<fn>' : v)); } catch { return String(x); } }
function group(name, body) {
  const p0 = pass, f0 = fail;
  body();
  console.log(`${fail === f0 ? 'ok  ' : 'FAIL'} ${name}  (${pass - p0 + fail - f0} checks${fail > f0 ? `, ${fail - f0} failed` : ''})`);
}
// deterministic PRNG
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(20261123);
const pick = (xs) => xs[Math.floor(R() * xs.length)];
const int = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1));
const mapOpt = (k, v) => (v === null ? null : k(v));

// ============================ J.1 ============================
group('J.1 litMark / LitClass.mark (T:107) on spellings (μ table S:346-354, grammar G:177-180)', () => {
  const cases = {
    '16': 'Int', '0': 'Int', '007': 'Int', '-3': 'Int', '1.5': 'point', '1.': 'point', '-0.25': 'point',
    '0x10': 'Address', '04x1000': 'Address', '16xFF': 'Address', '0u0041': 'CharCode', '2u41': 'CharCode',
    '0r1F': 'r0', '0b101': 'b0',
    '`ab`': OUT, '\\a': OUT, 'inc': OUT, '_': OUT, '!_': OUT, '1r5': OUT, '0b12': OUT, '-0x10': OUT, '0xG': OUT, '1e5': OUT,
  };
  for (const [s, k] of Object.entries(cases)) check(`litMark ${s}`, M.litMark(s) === k, M.litMark(s));
  check('width parsed: 04x1000 → hex 4', deepEq(M.litClass('04x1000'), { c: 'hex', w: 4 }));
  check('width parsed: 0x10 → hex 0', deepEq(M.litClass('0x10'), { c: 'hex', w: 0 }));
  check('funAddr is not a literal mark (T:101)', !Object.values(cases).includes('funAddr'));
});

function randTm(depth, leaf, ops) {
  if (depth === 0 || R() < 0.3) return leaf();
  return M.op(pick(ops), randTm(depth - 1, leaf, ops), randTm(depth - 1, leaf, ops));
}
group('J.1(c) fold_mapLit (T:63), fold_mark_invariant / fold_width_invariant (T:74, T:122)  [sample 500 trees]', () => {
  const lcs = () => pick([M.LC.dec(), M.LC.point(), M.LC.hex(int(0, 16)), M.LC.u0(int(0, 8)), M.LC.r0(), M.LC.b0()]);
  const tau = (o, a, b) => `${o}(${a},${b})`; // a free table: any change of marks would show
  const rho = (i) => `n${i}`;
  for (let i = 0; i < 500; i++) {
    const t = randTm(4, () => (R() < 0.8 ? M.lit(lcs()) : M.name(int(0, 3))), ['+', '*']);
    const lhs = M.fold(M.mark, rho, tau, t);
    check('fold_mapLit', lhs === M.fold((k) => k, rho, tau, M.mapLit(M.mark, t)));
    check('fold_width_invariant', lhs === M.fold(M.mark, rho, tau, M.mapLit(M.dropWidth, t)));
  }
});

// ============================ J.2 ============================
group('J.2 gIter_desc / gIter_fixed / gIter_greatest / gfp_unique / gRun_eq (T:157-304)  [sample 300 monotone F, n ≤ 5]', () => {
  let reachedByRun = 0;
  for (let trial = 0; trial < 300; trial++) {
    const n = int(1, 5);
    const clauses = Array.from({ length: n }, () => Array.from({ length: int(0, 3) }, () => int(0, (1 << n) - 1)));
    const F = (x) => clauses.map((cl) => cl.some((mask) => x.every((xi, j) => !((mask >> j) & 1) || xi)));
    check('F is monotone (GMono, T:140)', M.gMono(F, n));
    for (let k = 0; k <= n + 2; k++) check('gIter_desc', M.guessLe(M.gIter(F, n, k + 1), M.gIter(F, n, k)));
    const g = M.gIter(F, n, n);
    check('gIter_fixed', deepEq(F(g), g));
    for (const y of M.allGuesses(n)) if (M.guessLe(y, F(y))) check('gIter_greatest', M.guessLe(y, g));
    for (const z of M.allGuesses(n)) {
      const greatest = M.allGuesses(n).every((y) => !M.guessLe(y, F(y)) || M.guessLe(y, z));
      if (deepEq(F(z), z) && greatest) check('gfp_unique', deepEq(z, g));
    }
    for (let r = 0; r < 10; r++) {
      const s = Array.from({ length: int(0, 3 * n) }, () => int(0, n - 1));
      const x = M.gRun(F, n, s);
      if (deepEq(F(x), x)) { reachedByRun++; check('gRun_eq', deepEq(x, g)); }
    }
  }
  check('gRun_eq is not vacuous (some runs stop at a fixed point)', reachedByRun > 100, reachedByRun);
  const allFalse = (x) => x.map(() => false);
  check('gUpdate (T:149) rereads only name i', deepEq(M.gUpdate(allFalse, [true, true, true], 1), [true, false, true]));
  check('gRun [] = top (T:153)', deepEq(M.gRun(allFalse, 3, []), [true, true, true]));
  check('gIter 0 = top (T:145)', deepEq(M.gIter(allFalse, 2, 0), [true, true]));
});

// ============================ J.3 ============================
const OPT_KD = [null, 'A', 'L'];
group('J.3(a) tauSpace_bij (T:355)', () => {
  for (const a of M.KD) for (const b of M.KD) for (const c of M.KD) for (const d of M.KD)
    if (M.tauSpace(a, b) === M.tauSpace(c, d)) check('injective', a === c && b === d);
  for (const s of M.STEPS) check(`surjective onto ${s}`, M.KD.some((a) => M.KD.some((b) => M.tauSpace(a, b) === s)));
  check('A A build', M.tauSpace('A', 'A') === 'build');
  check('L L comp', M.tauSpace('L', 'L') === 'comp');
  check('L A app', M.tauSpace('L', 'A') === 'app');
  check('A L noRead', M.tauSpace('A', 'L') === 'noRead');
});
group('J.3(b) space_defer (T:374): per read input, the only sound decided Step needs both sides known  [exhaustive]', () => {
  // SoundBin is a conjunction over read inputs, so the sound tables are the product of the per-input allowed sets.
  for (const x of OPT_KD) for (const y of OPT_KD) {
    const allowed = [null, ...M.STEPS].filter((s) =>
      M.KD.every((k1) => M.KD.every((k2) => !(M.approx(x, k1) && M.approx(y, k2)) || M.approx(s, M.tauSpace(k1, k2)))));
    check(`(${x},${y}) allows a decided Step ⇒ both known`, allowed.every((s) => s === null) || (x !== null && y !== null), allowed);
  }
});
group('J.3(c) act_defer (T:409), actBest_sound (T:442), actBest is the maximum  [exhaustive over 4^9 tables]', () => {
  const OUTS = [null, 'push', 'comp', 'app'];
  const inputs = [];
  for (const x of OPT_KD) for (const y of OPT_KD) inputs.push([x, y]);
  let sound = 0;
  for (let code = 0; code < 4 ** 9; code++) {
    const tbl = new Map(); let c = code;
    for (const [x, y] of inputs) { tbl.set(`${x}|${y}`, OUTS[c % 4]); c = Math.floor(c / 4); }
    const tauR = (x, y) => tbl.get(`${x}|${y}`);
    if (!M.soundBin(M.actSpace, tauR, M.KD)) continue;
    sound++;
    for (const [x, y] of inputs) {
      const s = tauR(x, y);
      if (s !== null) {
        check('act_defer', (x !== null && y !== null) || x === 'A');
        check('every sound decision is actBest\'s', s === M.actBest(x, y));
      }
    }
  }
  check('actBest_sound', M.soundBin(M.actSpace, M.actBest, M.KD));
  check('number of sound tables = product of per-input choices (2^5 = 32)', sound === 32, sound);
  const best = M.bestSound(M.actSpace, M.KD);
  for (const x of OPT_KD) for (const y of OPT_KD) {
    const b = best(x ?? UNKNOWN, y ?? UNKNOWN);
    check(`bestSound(actSpace) = actBest at (${x},${y})`, (b === UNKNOWN ? null : b) === M.actBest(x, y), b);
  }
});
group('J.3(d) rowStep_length (T:476)  [sample]', () => {
  const items = [M.val(1), M.fn((x) => x + 1)];
  for (let i = 0; i < 200; i++) {
    const s = Array.from({ length: int(0, 4) }, () => pick(items));
    const top = pick(items), it = pick(items);
    const len = M.rowStep([top, ...s], it).length;
    const act = M.actSpace(M.itemKd(top), M.itemKd(it));
    check('length', len === (act === 'push' ? s.length + 2 : s.length + 1));
  }
});
group('J.3(d) row_sound (T:528) on the parity instance  [sample 300 rows]', () => {
  const sat = (d, k) => d % 2n === BigInt(k);
  const pairs = [
    [(d) => 2n * d, () => 0], [(d) => d + 1n, (k) => 1 - k], [(d) => d * d, (k) => k], [(d) => d + 2n, (k) => k],
  ];
  const dS = Array.from({ length: 21 }, (_, i) => BigInt(i)), kS = [0, 1];
  const isat = (a, b) => M.itemSat(sat, dS, kS, a, b);
  for (let r = 0; r < 300; r++) {
    const w = [], wk = [];
    for (let j = int(1, 7); j > 0; j--) {
      if (R() < 0.5) { const d = BigInt(int(0, 50)); w.push(M.val(d)); wk.push(M.val(Number(d % 2n))); }
      else { const [f, phi] = pick(pairs); w.push(M.fn(f)); wk.push(M.fn(phi)); }
    }
    check('premise Rel2', M.rel2(isat, w, wk));
    check('Rel2 after rowFold', M.rel2(isat, M.rowFold(w), M.rowFold(wk)));
  }
});
group('J.3(e) row_double_inc (T:543), row_shape_depends (T:549)', () => {
  const r = M.rowFold([M.fn((x) => x * 2), M.fn((x) => x + 1), M.val(5)]);
  check('double inc 5 = [11]', r.length === 1 && r[0].tag === 'val' && r[0].v === 11, r);
  check('inc 5 has 1 item', M.rowFold([M.fn((x) => x + 1), M.val(5)]).length === 1);
  check('3 5 has 2 items', M.rowFold([M.val(3), M.val(5)]).length === 2);
});
group('J.3 predictRow (derived read stage): shapes and deferrals', () => {
  const A = (label) => ({ kind: 'A', label }), L = (label) => ({ kind: 'L', label }), U = (label) => ({ kind: UNKNOWN, label });
  const ex = [
    [[L('double'), L('inc'), A('5')], '(apply (compose double inc) 5)', '(apply (compose double inc) 5)', 1],
    [[L('inc'), L('double'), L('inc'), A('5')], '(apply (compose (compose inc double) inc) 5)', '(apply (compose inc double inc) 5)', 1],
    [[L('d'), A('1'), A('2')], '(construct (apply d 1) 2)', '(construct (apply d 1) 2)', 2],
    [[A('1'), A('2')], '(construct 1 2)', '(construct 1 2)', 2],
    [[A('1'), A('2'), L('inc')], '(construct 1 2 inc)', '(construct 1 2 inc)', 3],
    [[A('3'), L('inc'), A('5')], '(construct 3 (apply inc 5))', '(construct 3 (apply inc 5))', 2],
    [[U('x')], 'x', 'x', 1],
    [[A('3'), U('x')], '(construct 3 x)', '(construct 3 x)', 2],
  ];
  for (const [items, sx, sxf, len] of ex) {
    const p = M.predictRow(items);
    check(`decided ${sx}`, p.status === 'decided' && p.sexpr === sx && p.sexprFlat === sxf && p.length === len, p);
  }
  check('1 2 inc: last step is noRead (R47)', M.predictRow([A('1'), A('2'), L('inc')]).steps[2].step === 'noRead');
  const defers = [
    [[U('x'), A('5')], 1], [[A('3'), U('x'), A('5')], 2], [[L('inc'), U('x')], 1], [[U('x'), L('f')], 1], [[L('f'), A('1'), U('y'), A('2')], 3],
  ];
  for (const [items, at] of defers) {
    const p = M.predictRow(items);
    check(`defer at ${at}: ${items.map((i) => i.label).join(' ')}`, p.status === 'defer' && p.at === at && p.rest === OUT, p);
  }
  check('bad kind → out-of-model', M.predictRow([{ kind: 'Int' }]).status === OUT);
});
group('J.3 predictRow agrees with the literal rowFold (T:472) on known rows  [sample 2000 rows]', () => {
  const env = { 1: 1, 2: 2, 3: 3, 5: 5, inc: (x) => x + 1, double: (x) => x * 2, sq: (x) => x * x };
  const labels = Object.keys(env);
  const same = (a, b) => (typeof a === 'function' && typeof b === 'function'
    ? [0, 1, 2, 3, 7].every((x) => a(x) === b(x)) : a === b);
  for (let r = 0; r < 2000; r++) {
    const ls = Array.from({ length: int(1, 6) }, () => pick(labels));
    const items = ls.map((l) => ({ kind: typeof env[l] === 'function' ? 'L' : 'A', label: l }));
    const p = M.predictRow(items);
    const lit = M.rowFold(ls.map((l) => (typeof env[l] === 'function' ? M.fn(env[l]) : M.val(env[l]))));
    check('decided', p.status === 'decided');
    check('length', p.length === lit.length);
    const got = p.length === 1 ? [M.evalShape(p.shape, env)] : M.evalShape(p.shape, env);
    const want = [...lit].reverse().map((it) => (it.tag === 'val' ? it.v : it.f));
    check('items', got.length === want.length && got.every((g, i) => same(g, want[i])), ls.join(' '));
    check('top kinds', p.stack.every((n, i) => n.kind === M.itemKd(lit[i])));
  }
});

// ============================ J.4 ============================
group('J.4(a) self_typed_iff ⇐ (T:579): the 12 buildOp commute with every κ  [exhaustive on V={0,1,2}, S={p,q}]', () => {
  const V = [0, 1, 2], OV = [null, ...V];
  const kappas = [];
  for (let m = 0; m < 8; m++) kappas.push((v) => (((m >> v) & 1) ? 'q' : 'p'));
  for (const c of M.allCoords) {
    const o = M.buildOp(c);
    let ok = true;
    for (const k of kappas) for (const a of OV) for (const b of OV)
      if (mapOpt(k, o(a, b)) !== o(mapOpt(k, a), mapOpt(k, b))) ok = false;
    check(`buildOp ${c} natural`, ok);
  }
  const OA = [null, 1, 2];
  for (const a of OA) for (const b of OA) {
    check('`|` = buildOp(1,T,T)', M.orO(a, b) === M.buildOp(M.COORD.or)(a, b));
    check('`&` = buildOp(2,F,F)', M.andO(a, b) === M.buildOp(M.COORD.and)(a, b));
    check('`;` = buildOp(0,T,T)', M.xorO(a, b) === M.buildOp(M.COORD.xor)(a, b));
  }
});
group('J.4(b) dropVoid_kind (T:590)  [sample]', () => {
  for (let r = 0; r < 200; r++) {
    const w = Array.from({ length: int(0, 6) }, () => (R() < 0.3 ? null : int(0, 5)));
    const k = (v) => `k${v % 2}`;
    check('dropVoid commutes with κ', deepEq(M.dropVoid(w).map(k), M.dropVoid(w.map((v) => mapOpt(k, v)))));
  }
});
group('J.4(c) natOp_no_new (T:600), value_ops_not_self_typed (T:610), eqO_ltO_left_or_none (T:617)', () => {
  const OV = [null, 0, 1, 2];
  for (const c of M.allCoords) for (const a of OV) for (const b of OV) {
    const v = M.buildOp(c)(a, b);
    check('answer is a, b or ⊥', v === a || v === b || v === null);
  }
  check('plusV 1 2 = 3', M.plusV(1n, 2n) === 3n);
  check('plusV: !_ is a two-sided unit (T:564-565)', M.plusV(5n, null) === 5n && M.plusV(null, 5n) === 5n && M.plusV(null, null) === null);
  check('plusV: overflow is !_ (T:566)', M.plusV(M.MAX64, 1n) === null && M.plusV(M.MIN64, -1n) === null && M.plusV(M.MAX64, 0n) === M.MAX64);
  check('== does not commute with the collapsing κ', mapOpt(() => 'u', M.eqO(1n, 2n)) !== M.eqO('u', 'u'));
  check('< does not commute with κ ↦ 0', mapOpt(() => 0n, M.ltO(1n, 2n)) !== M.ltO(0n, 0n));
  const OI = [null, -2n, -1n, 0n, 1n, 2n];
  for (const a of OI) for (const b of OI) {
    check('eqO left or ⊥', M.eqO(a, b) === a || M.eqO(a, b) === null);
    check('ltO left or ⊥', M.ltO(a, b) === a || M.ltO(a, b) === null);
  }
});

// ============================ J.5 ============================
group('J.5(a) allCoords_spec (T:667), det_count (T:677), det_iff (T:684)  [|A|,|B| ∈ {1,2}]', () => {
  const keys = M.allCoords.map((c) => c.join());
  check('12 distinct coords', keys.length === 12 && new Set(keys).size === 12);
  for (const k of [0, 1, 2]) for (const l of [false, true]) for (const r of [false, true]) check('covers', keys.includes([k, l, r].join()));
  const want = [[0, false, false], [0, false, true], [0, true, false], [1, false, false], [1, true, false], [2, false, false], [2, false, true]];
  check('det_count = the 7 coords', deepEq(M.allCoords.filter(M.detB), want));
  for (const [A, B] of [[['a'], ['b']], [['a', 'a2'], ['b']], [['a'], ['b', 'b2']], [['a', 'a2'], ['b', 'b2']]])
    for (const c of M.allCoords) check(`det_iff ${c}`, (M.detLeft(c, A, B) || M.detRight(c, A, B)) === M.detB(c));
  check('`&` coarsely right', M.coarseSide(M.COORD.and) === 'right');
  check('`|` undetermined', M.coarseSide(M.COORD.or) === 'undetermined');
  check('`;` undetermined', M.coarseSide(M.COORD.xor) === 'undetermined');
});
group('J.5(b) unit_not_det (T:708) for `|` and `;` (⊥ is a two-sided unit)', () => {
  for (const [nm, star] of [['|', M.orO], [';', M.xorO]]) {
    const xs = [null, { L: 'a' }], ys = [null, { R: 'b' }];
    check(`${nm} unit`, xs.every((x) => star(x, null) === x) && ys.every((y) => star(null, y) === y));
    let notLeft = false, notRight = false;
    for (const x of xs) for (const y of ys) { const v = star(x, y); if (v && !('L' in v)) notLeft = true; if (v && !('R' in v)) notRight = true; }
    check(`${nm} neither side`, notLeft && notRight);
  }
});

// ============================ J.6 ============================
group('J.6(a)(b) readStage_sound (T:727) / readStage_complete (T:736) for foldKind  [sample 4000 trees per range]', () => {
  const ops = ['+', '-', '*', '/', '%', '^', '<<', '>>', '&&', '||', ';;', '<', '=='];
  const leaves = ['1', '16', '0x10', '04x1000'];
  const names = ['a', 'b', 'c'];
  for (const range of ['Kind', 'KVal']) {
    const dom = range === 'Kind' ? M.KIND_DOM : M.KVAL_DOM;
    let decided = 0, compared = 0, truthOutReadDecided = 0;
    for (let r = 0; r < 4000; r++) {
      const t = randTm(4, () => (R() < 0.6 ? M.lit(pick(leaves)) : M.name(pick(names))), R() < 0.5 ? ['+'] : ops);
      const truthRho = Object.fromEntries(names.map((n) => [n, pick(dom)]));
      const readRho = Object.fromEntries(names.map((n) => [n, R() < 0.5 ? UNKNOWN : truthRho[n]]));
      const truth = M.foldKind(t, truthRho, range), read = M.foldKind(t, readRho, range);
      check('complete: all leaves known ⇒ never unknown', truth !== UNKNOWN, truth);
      if (truth !== OUT && read !== OUT) { compared++; check('sound: read ⊑ truth', read === UNKNOWN || read === truth, { t, readRho, truthRho, read, truth }); if (read !== UNKNOWN) decided++; }
      if (truth === OUT && read !== OUT && read !== UNKNOWN) truthOutReadDecided++;
    }
    check(`${range}: non-vacuous`, compared > 1000 && decided > 300, { compared, decided });
    if (range === 'Kind') check('Kind fold: never decides where the truth leaves the model', truthOutReadDecided === 0, truthOutReadDecided);
    console.log(`     ${range}: compared ${compared}, read decided ${decided}, truth out-of-model but read decided ${truthOutReadDecided}`);
  }
});
group('J.6(c) decided_needs_const(_right) (T:752, T:761) and maximality, for the bestSound tables  [exhaustive]', () => {
  const tables = [];
  for (const o of M.BINOPS) tables.push([`r62 ${o}`, (a, b) => M.opKind(o, a, b), M.KIND_DOM, (x, y) => M.predictOp(o, x, y, 'Kind')]);
  tables.push(['plusK', M.plusK, M.KVAL_DOM, (x, y) => M.predictOp('+', x, y, 'KVal')]);
  for (const [nm, tau, dom, read] of tables) {
    for (const z of dom) {
      const row = uniqStr(dom.map((k) => tau(z, k))), col = uniqStr(dom.map((k) => tau(k, z)));
      const rz = read(z, UNKNOWN), cz = read(UNKNOWN, z);
      if (rz !== UNKNOWN) check(`${nm} row ${z}: decided ⇒ constant`, row.length === 1 && row[0] === rz, { row, rz });
      if (row.length === 1) check(`${nm} row ${z}: constant ⇒ decided`, rz === row[0]);
      if (cz !== UNKNOWN) check(`${nm} col ${z}: decided ⇒ constant`, col.length === 1 && col[0] === cz, { col, cz });
      if (col.length === 1) check(`${nm} col ${z}: constant ⇒ decided`, cz === col[0]);
      for (const k of dom) check(`${nm} both known = table`, read(z, k) === tau(z, k));
    }
    check(`${nm} both unknown`, read(UNKNOWN, UNKNOWN) === UNKNOWN);
  }
  // unit_row_not_const (T:770): a left-unit row over ≥ 2 kinds is not constant (liftU's ⊥ row)
  const lu = M.liftU((x) => x);
  check('unit_row_not_const', uniqStr([1, 2].map((k) => lu(null, k))).length === 2);
});
function uniqStr(xs) { return [...new Set(xs)]; }
group('J.6(c) liftAbs_sound (T:784) with plusK and the absorbing carried  [exhaustive]', () => {
  const tau = (o, a, b) => M.plusK(a, b), ab = (o, a) => a === 'carried';
  check('hab', M.KVAL_DOM.every((k) => M.plusK('carried', k) === 'carried' && M.plusK(k, 'carried') === 'carried'));
  check('SoundTable', M.soundTable(tau, M.liftAbs(tau, ab), ['+'], M.KVAL_DOM));
});
group('J.6(d)(e) eval2_eq_eval1_of_exact (T:851), eval2_ne_eval1 (T:859) on an instance (instance is not Lean; S:430 reading)', () => {
  const kap = (d) => (d.t === 'num' ? 'Int' : d.t === 'addr' ? 'Address' : d.t);
  const delta = (s) => (M.litMark(s) === 'Int' ? { t: 'num', n: BigInt(s) } : { t: 'addr', a: BigInt(parseInt(s.split('x')[1], 16)) });
  const eta = () => { throw new Error('no names'); };
  const ev = (o, k1, k2, d1, d2) => {
    if (o === '+') {
      const r = M.plusK(k1, k2);
      if (r === 'Int') return { t: 'num', n: (d1.t === 'num' ? d1.n : 0n) + (d2.t === 'num' ? d2.n : 0n) };
      if (r === 'Address') return d1.t === 'addr' && d2.t === 'addr' ? { t: 'addr', a: d1.a + d2.a } : { t: 'carried' };
      return { t: r };
    }
    if (k1 === 'Address' && k2 === 'Address' && d1.t === 'addr' && d2.t === 'addr') return d1.a >= d2.a ? { t: 'addr', a: d1.a - d2.a } : { t: 'void' };
    if (k1 === 'Int' && k2 === 'Int' && d1.t === 'num' && d2.t === 'num') return { t: 'num', n: d1.n - d2.n };
    return { t: 'carried' };
  };
  const e1 = (t) => M.eval1(kap, delta, eta, ev, t);
  for (let r = 0; r < 300; r++) {
    const t = randTm(4, () => M.lit(pick(['1', '5', '0x10', '0x20'])), ['+', '-']);
    const tyExact = (s) => kap(e1(s));
    check('exact tyR ⇒ eval2 = eval1', deepEq(M.eval2(kap, delta, eta, ev, tyExact, t), e1(t)));
  }
  const tA = M.op('-', M.lit('0x10'), M.lit('0x20')), s1 = M.lit('1'), T = M.op('+', tA, s1);
  const tyR = (s) => { const k = M.foldKind(s, {}, 'KVal'); return k === UNKNOWN || k === OUT ? null : k; };
  const e2 = (t) => M.eval2(kap, delta, eta, ev, tyR, t);
  check('ht: tyR (0x10 - 0x20) = Address', tyR(tA) === 'Address');
  check('hs', tyR(s1) === kap(e1(s1)));
  check('et, es', deepEq(e2(tA), e1(tA)) && deepEq(e2(s1), e1(s1)));
  check('eval1 ((0x10 - 0x20) + 1) = 1 (void is the unit)', deepEq(e1(T), { t: 'num', n: 1n }));
  check('eval2 ((0x10 - 0x20) + 1) = carried', deepEq(e2(T), { t: 'carried' }));
  check('eval2 ≠ eval1', !deepEq(e2(T), e1(T)));
});
group('J.6(f) void_carried (T:907)', () => {
  check('collapse void = collapse carried', M.collapse('void') === M.collapse('carried') && M.collapse('void') === null);
  check('void + Int = Int', M.plusK('void', 'Int') === 'Int');
  check('carried + Int = carried', M.plusK('carried', 'Int') === 'carried');
  check('void + Address = carried', M.plusK('void', 'Address') === 'carried');
  for (const k of M.KVAL_DOM) check(`carried absorbs ${k}`, M.plusK('carried', k) === 'carried' && M.plusK(k, 'carried') === 'carried');
  for (const a of M.KIND_DOM) for (const b of M.KIND_DOM) {
    const r = M.r62('add', a, b);
    check(`plusK agrees with r62 add on ${a},${b} (none ↔ carried)`, M.plusK(a, b) === (r === null ? 'carried' : r));
  }
});

// ============================ J.7 ============================
group('J.7(b) plusK_assoc_comm (T:945)  [exhaustive 125 + 25]', () => {
  for (const x of M.KVAL_DOM) for (const y of M.KVAL_DOM) {
    check('comm', M.plusK(x, y) === M.plusK(y, x));
    for (const z of M.KVAL_DOM) check('assoc', M.plusK(M.plusK(x, y), z) === M.plusK(x, M.plusK(y, z)));
  }
});
group('J.7(a) fold_reassoc (T:929) with plusK  [sample 500 trees]', () => {
  const tau = (o, a, b) => M.plusK(a, b);
  const rewrite = (t) => {
    if (t.tag !== 'op') return t;
    let u = M.op(t.o, rewrite(t.a), rewrite(t.b)); // congL / congR
    if (R() < 0.5) { const v = M.reassocStep('+', u); if (v) u = v; } // step / symm
    return u;
  };
  for (let r = 0; r < 500; r++) {
    const t = randTm(5, () => M.lit(pick(M.KVAL_DOM)), ['+']);
    let u = t; for (let j = 0; j < 4; j++) u = rewrite(u);
    check('fold invariant', M.fold((k) => k, () => OUT, tau, t) === M.fold((k) => k, () => OUT, tau, u));
  }
});
group('J.7(c) plusV_not_assoc (T:956), value_fold_not_reassoc (T:962)', () => {
  check('(MAX + 1) + 1 = 1', M.plusV(M.plusV(M.MAX64, 1n), 1n) === 1n);
  check('MAX + (1 + 1) = !_', M.plusV(M.MAX64, M.plusV(1n, 1n)) === null);
  const s = M.op('+', M.op('+', M.lit(M.MAX64), M.lit(1n)), M.lit(1n));
  const t = M.op('+', M.lit(M.MAX64), M.op('+', M.lit(1n), M.lit(1n)));
  check('Reassoc step relates them', deepEq(M.reassocStep('+', s), t));
  const f = (u) => M.fold((n) => n, () => { throw new Error('Empty'); }, (o, a, b) => M.plusV(a, b), u);
  check('value folds differ (1 vs !_)', f(s) === 1n && f(t) === null && f(s) !== f(t), [f(s), f(t)]);
});

// ============================ J.8 ============================
const D = (k) => M.kindDeg(k);
group('J.8(a) homog_rows (A:156)  [sample λ ≤ 8, values ≤ 10]', () => {
  const rows = [
    [M.AllPos, 1, 1, 1, 'add'], [M.AllPos, 1, 1, 1, 'sub'], [M.AllPos, 1, 0, 1, 'mul'], [M.AllPos, 0, 1, 1, 'mul'],
    [M.AllPos, 1, 1, 2, 'mul'], [M.AllPos, 1, 1, 0, 'div'], [M.AllPos, 1, 1, 1, 'mod'], [M.AllPos, 1, 0, 1, 'shl'],
    [M.AllPos, 1, 1, 1, 'lt'], [M.AllPos, 1, 1, 1, 'eq'], [M.Pow2, 1, 1, 1, 'band'], [M.Pow2, 1, 1, 1, 'bor'], [M.Pow2, 1, 1, 1, 'bxor'],
  ];
  for (const [G, d1, d2, d, o] of rows) check(`Homog ${o} (${d1},${d2};${d})`, M.homogSample(G, d1, d2, d, M.cand(o)).ok);
});
group('J.8(b) not_homog_rows (A:233) for d = 0..3 (a counterexample is found in the sample)', () => {
  const rows = [
    ['add', 1, 0], ['add', 0, 1], ['sub', 1, 0], ['sub', 0, 1], ['div', 1, 0], ['div', 0, 1], ['mod', 1, 0], ['mod', 0, 1],
    ['pow', 1, 0], ['pow', 1, 1], ['pow', 0, 1], ['shl', 1, 1], ['shl', 0, 1], ['shr', 1, 0], ['shr', 1, 1], ['shr', 0, 1],
    ['lt', 1, 0], ['lt', 0, 1], ['eq', 1, 0], ['eq', 0, 1],
    ['band', 1, 0], ['band', 0, 1], ['bor', 1, 0], ['bor', 0, 1], ['bxor', 1, 0], ['bxor', 0, 1],
  ];
  for (let d = 0; d <= 3; d++) {
    for (const [o, d1, d2] of rows) check(`¬Homog ${o} (${d1},${d2};${d})`, !M.homogSample(M.scale(o), d1, d2, d, M.cand(o)).ok);
    if (d !== 2) check(`¬Homog mul (1,1;${d})`, !M.homogSample(M.AllPos, 1, 1, d, M.cand('mul')).ok);
    check(`¬Homog1 fact (1;${d})`, !M.homog1Sample(M.AllPos, 1, d, M.cand1('fact')).ok);
  }
});
group('J.8(c) bit_rows_not_allPos (A:390)', () => {
  for (const o of ['band', 'bor', 'bxor']) check(`¬Homog AllPos ${o}`, !M.homogSample(M.AllPos, 1, 1, 1, M.cand(o)).ok);
});
group('J.8(d) kind_table (A:413): r62 o k₁ k₂ = some k ⇔ Homog (scale o) … except `数 * 番地`  [sample]', () => {
  for (const o of M.BINOPS) for (const k1 of M.KIND_DOM) for (const k2 of M.KIND_DOM) {
    if (o === 'mul' && k1 === 'Int' && k2 === 'Address') continue;
    for (const k of M.KIND_DOM)
      check(`${o} ${k1} ${k2} → ${k}`, (M.r62(o, k1, k2) === k) === M.homogSample(M.scale(o), D(k1), D(k2), D(k), M.cand(o)).ok);
  }
});
group('J.8(d) kind_table1 (A:446)  [sample]', () => {
  for (const o of M.UNOPS) for (const k of M.KIND_DOM) {
    if (o === 'neg' || (o === 'bnot' && k === 'Address')) continue;
    for (const k2 of M.KIND_DOM)
      check(`${o} ${k} → ${k2}`, (M.r62u(o, k) === k2) === M.homog1Sample(M.scale1(o), D(k), D(k2), M.cand1(o)).ok);
  }
});
group('J.8(e) kind_table_outliers (A:465)', () => {
  check('r62 mul Int Address = !_', M.r62('mul', 'Int', 'Address') === null);
  check('… though Homog AllPos 0 1 1 mul', M.homogSample(M.AllPos, 0, 1, 1, M.cand('mul')).ok);
  check('r62u bnot Address = Address', M.r62u('bnot', 'Address') === 'Address');
  for (let d = 0; d <= 3; d++) check(`… though ¬Homog1 Pow2 1 ${d} bnot`, !M.homog1Sample(M.Pow2, 1, d, M.cand1('bnot')).ok);
  check('r62u neg Address = !_', M.r62u('neg', 'Address') === null);
  for (let d1 = 0; d1 <= 3; d1++) for (let d = 0; d <= 3; d++) check(`… though Homog1 AllPos ${d1} ${d} neg`, M.homog1Sample(M.AllPos, d1, d, M.cand1('neg')).ok);
  check('opKind 2 * 0x10', M.opKind('*', 'Int', 'Address') === VOID_WARN);
  check('opKind1 !! 0x10', M.opKind1('!!', 'Address') === 'Address');
  check('opKind1 -(0x10)', M.opKind1('-x', 'Address') === VOID_WARN);
  check('r62Table flags exactly 3 outliers', M.r62Table().filter((r) => r.outlier).length === 3);
});
group('J.8(f) shift_scale_free (A:491)  [sample]', () => {
  for (const o of ['shl', 'shr']) for (const k1 of M.KIND_DOM) for (const k2 of M.KIND_DOM) for (const k of M.KIND_DOM)
    check(`${o} ${k1} ${k2} ${k}`, M.homogSample(M.AllPos, D(k1), D(k2), D(k), M.cand(o)).ok === M.homogSample(M.Pow2, D(k1), D(k2), D(k), M.cand(o)).ok);
});
group('J-2 table spot checks (S:473-486) through spellings', () => {
  const ex = [
    ['+', 'Address', 'Address', 'Address'], ['+', 'Address', 'Int', VOID_WARN], ['+', 'Int', 'Address', VOID_WARN],
    ['-', 'Address', 'Address', 'Address'], ['*', 'Address', 'Address', VOID_WARN], ['*', 'Address', 'Int', 'Address'],
    ['/', 'Address', 'Address', 'Int'], ['/', 'Address', 'Int', VOID_WARN], ['%', 'Address', 'Address', 'Address'],
    ['%', 'Int', 'Address', VOID_WARN], ['^', 'Address', 'Int', VOID_WARN], ['<<', 'Address', 'Int', 'Address'],
    ['<<', 'Address', 'Address', VOID_WARN], ['>>', 'Address', 'Int', VOID_WARN], ['&&', 'Address', 'Address', 'Address'],
    ['&&', 'Address', 'Int', VOID_WARN], ['<', 'Address', 'Address', 'Address'], ['==', 'Address', 'Int', VOID_WARN],
    ['^', 'Int', 'Int', 'Int'], ['>>', 'Int', 'Int', 'Int'],
    ['!==', 'Address', 'Address', OUT], ['|', 'Int', 'Int', OUT], ['+', 'CharCode', 'Int', OUT], ['+', 'point', 'Int', OUT],
  ];
  for (const [o, a, b, want] of ex) check(`${a} ${o} ${b} → ${want}`, M.opKind(o, a, b) === want, M.opKind(o, a, b));
  check('markTable 0x10 + 1 via markOf', M.markTable('add', M.markOf('0x10'), M.markOf('1')) === null);
  check('markOf 04x1000 = width 4', deepEq(M.markOf('04x1000'), { m: 'width', w: 4 }));
  check('markOf 1.5 = out-of-model (J-3)', M.markOf('1.5') === OUT);
});
group('derived predictOp examples', () => {
  check('0x10 + 1 (Kind)', M.predictOp('+', 'Address', 'Int') === VOID_WARN);
  check('x + 1, x unknown', M.predictOp('+', UNKNOWN, 'Int') === UNKNOWN);
  check('x ^ 0x10, Kind range: column constant', M.predictOp('^', UNKNOWN, 'Address', 'Kind') === VOID_WARN);
  check('x ^ 0x10, KVal range: Lean silent on void/carried/funAddr', M.predictOp('^', UNKNOWN, 'Address', 'KVal') === OUT);
  check('x * 2, KVal range: forced unknown', M.predictOp('*', UNKNOWN, 'Int', 'KVal') === UNKNOWN);
  check('$inc + x, KVal: carried', M.predictOp('+', 'funAddr', UNKNOWN, 'KVal') === 'carried');
  check('x + carried, KVal: carried', M.predictOp('+', UNKNOWN, 'carried', 'KVal') === 'carried');
  check('void * 2, KVal: out-of-model', M.predictOp('*', 'void', 'Int', 'KVal') === OUT);
  check('unary on unknown', M.predictOp1('!!', UNKNOWN) === UNKNOWN && M.predictOp1('!!', 'Address') === 'Address');
  check('foldKind $inc + 1 + 2', M.foldKind(M.op('+', M.op('+', M.name('f'), M.lit('1')), M.lit('2')), { f: 'funAddr' }) === 'carried');
  check('foldKind (0x4 * 0x2) + 1', M.foldKind(M.op('+', M.op('*', M.lit('0x4'), M.lit('0x2')), M.lit('1'))) === 'carried');
  check('foldKind (0x4 * 0x2) + 1, Kind range: out-of-model', M.foldKind(M.op('+', M.op('*', M.lit('0x4'), M.lit('0x2')), M.lit('1')), {}, 'Kind') === OUT);
  check('foldKind 1.5 + 1: out-of-model', M.foldKind(M.op('+', M.lit('1.5'), M.lit('1'))) === OUT);
});

// ============================ J.12 ============================
group('J.12(a) ops_as_lifts (A:929), wedge_profile (A:939)', () => {
  const OA = [null, 1, 2, 3];
  for (const a of OA) for (const b of OA) {
    check('| = U(π₁)', M.orO(a, b) === M.liftU((x) => x)(a, b));
    check('; = U(⊥)', M.xorO(a, b) === M.liftU(() => null)(a, b));
    check('& = Z(π₂)', M.andO(a, b) === M.liftZ((_, y) => y)(a, b));
  }
  const f = (x, y) => (x + y) % 3 === 0 ? null : x * y;
  for (const a of OA) {
    check('U a ⊥ = a', M.liftU(f)(a, null) === a); check('U ⊥ a = a', M.liftU(f)(null, a) === a);
    check('Z a ⊥ = ⊥', M.liftZ(f)(a, null) === null); check('Z ⊥ a = ⊥', M.liftZ(f)(null, a) === null);
  }
});
group('J.12(c) liftZ_assoc_iff (A:995), liftU_assoc_of_total (A:1025)  [sample]', () => {
  const uadd = (Mx) => (a, b) => (a + b <= Mx ? a + b : null);
  const int64add = (a, b) => M.bnd(M.in64, a + b);
  const cases = [
    ['bounded unsigned +', uadd(6n), [0n, 1n, 2n, 3n, 4n, 5n]],
    ['subA', M.subA, [0n, 1n, 2n, 3n, 4n]],
    ['int64 +', int64add, [M.maxInt, 1n, -1n, 0n]],
  ];
  for (const [nm, f, xs] of cases) {
    const ka = M.kassocSample(f, xs).ok;
    const ox = [null, ...xs];
    let za = true;
    for (const a of ox) for (const b of ox) for (const c of ox)
      if (!deepEq(M.liftZ(f)(M.liftZ(f)(a, b), c), M.liftZ(f)(a, M.liftZ(f)(b, c)))) za = false;
    check(`${nm}: Z assoc ⇔ KAssoc`, ka === za, { ka, za });
  }
  check('bounded unsigned + is KAssoc (uaddB_kassoc A:1258)', M.kassocSample(uadd(10n), Array.from({ length: 13 }, (_, i) => BigInt(i))).ok);
  check('int64 + is not KAssoc at (MAX, 1, -1) (int64_not_kassoc A:1288)', !M.kassocSample(int64add, [M.maxInt, 1n, -1n]).ok);
  const g = (a, b) => a + b, U = M.liftU(g), os = [null, -1n, 0n, 2n, 5n];
  for (const a of os) for (const b of os) for (const c of os) check('U(total assoc) assoc', U(U(a, b), c) === U(a, U(b, c)));
});
const P11 = [M.BOT_A, M.BOT_N, M.vnum(0n), M.vnum(1n), M.vnum(2n), M.vnum(-3n), M.vaddr(0n), M.vaddr(1n), M.vaddr(5n), M.VFN, M.vnum(7n)];
group('J.12(d) mixOp_profile (A:1072)  [all t in an 11-point sample]', () => {
  const op = M.plus2;
  for (const t of P11) for (const n of [0n, 4n]) for (const a of [0n, 3n]) {
    check('⊥_A left zero', deepEq(op(M.BOT_A, t), M.BOT_A));
    check('⊥_A right zero', deepEq(op(t, M.BOT_A), M.BOT_A));
    check('⊥_N + n = n', deepEq(op(M.BOT_N, M.vnum(n)), M.vnum(n)));
    check('n + ⊥_N = n', deepEq(op(M.vnum(n), M.BOT_N), M.vnum(n)));
    check('⊥_N + a = ⊥_A', deepEq(op(M.BOT_N, M.vaddr(a)), M.BOT_A));
    check('a + ⊥_N = ⊥_A', deepEq(op(M.vaddr(a), M.BOT_N), M.BOT_A));
    check('a + n = ⊥_A', deepEq(op(M.vaddr(a), M.vnum(n)), M.BOT_A));
    check('n + a = ⊥_A', deepEq(op(M.vnum(n), M.vaddr(a)), M.BOT_A));
    check('fn + t = ⊥_A', deepEq(op(M.VFN, t), M.BOT_A));
    check('t + fn = ⊥_A', deepEq(op(t, M.VFN), M.BOT_A));
  }
});
group('J.12(d) mixOp_assoc (A:1139)  [1331 triples × 4 (gN, gA)]', () => {
  const configs = [
    ['(+), (+)', (a, b) => a + b, (a, b) => a + b],
    ['left projection, (+)', (a) => a, (a, b) => a + b],
    ['(+), bounded +', (a, b) => a + b, (a, b) => (a + b <= 5n ? a + b : null)],
    ['left projection, bounded +', (a) => a, (a, b) => (a + b <= 5n ? a + b : null)],
  ];
  for (const [nm, gN, gA] of configs) {
    const o = M.mixOp(gN, gA);
    let bad = 0;
    for (const s of P11) for (const t of P11) for (const w of P11) if (!deepEq(o(o(s, t), w), o(s, o(t, w)))) bad++;
    check(`${nm}: 0 failures`, bad === 0, bad);
  }
});
group('J.12(d) oneOp_not_assoc (A:1153), J.12(e) carry_examples (A:1171)', () => {
  for (const n of [0n, 1n]) for (const a of [0n, 16n])
    check('(⊥ + a) + n ≠ ⊥ + (a + n)', !deepEq(M.plus1(M.plus1(M.BOT, M.vaddr(a)), M.vnum(n)), M.plus1(M.BOT, M.plus1(M.vaddr(a), M.vnum(n)))));
  const n = M.vnum, A = M.vaddr, F = M.VFN;
  check('$inc + 1 + 2 = !_ (plus2)', deepEq(M.plus2(M.plus2(F, n(1n)), n(2n)), M.BOT_A));
  check('1 + ($inc + 2) = !_ (plus2)', deepEq(M.plus2(n(1n), M.plus2(F, n(2n))), M.BOT_A));
  check('$vs + 0x8 + 0x10 = !_ (plus2)', deepEq(M.plus2(M.plus2(M.BOT_N, A(8n)), A(16n)), M.BOT_A));
  check('(3 < 2) + 1 = 1 (plus2)', deepEq(M.plus2(M.BOT_N, n(1n)), n(1n)));
  check('$inc + 1 + 2 = 2 (plus1)', deepEq(M.plus1(M.plus1(F, n(1n)), n(2n)), n(2n)));
  check('1 + ($inc + 2) = 1 (plus1)', deepEq(M.plus1(n(1n), M.plus1(F, n(2n))), n(1n)));
});

// ============================ J.13 ============================
group('J.13(a) evZ_sound (A:1226)  [sample 1000 trees], J.13(b) overflow_fabricates (A:1252)', () => {
  const gs = [(a, b) => a + b, (a, b) => a - b, (a, b) => a * b];
  const big = [M.maxInt, -M.maxInt - 1n, 2n ** 62n, 3n, -7n, 0n, 1n];
  const rt = (d) => (d === 0 || R() < 0.3 ? M.tlit(pick(big)) : M.tnode(pick(gs), rt(d - 1), rt(d - 1)));
  let some = 0;
  for (let i = 0; i < 1000; i++) {
    const t = rt(4), v = M.evZ(M.in64, t);
    if (v !== null) { some++; check('evZ value = exact', v === M.exact(t)); }
  }
  check('non-vacuous', some > 100, some);
  check('tOver.evU = -2', M.evU(M.in64, M.tOver) === -2n);
  check("tOver'.evU = MAX", M.evU(M.in64, M.tOver2) === M.maxInt);
  check('tOver.exact = MAX', M.exact(M.tOver) === M.maxInt);
  check('tOver.evZ = !_', M.evZ(M.in64, M.tOver) === null);
  check("tOver'.evZ = MAX", M.evZ(M.in64, M.tOver2) === M.maxInt);
});
group('J.13(d) liftU_mono_iff (A:1293), liftZ_mono (A:1349)  [exhaustive on small X]', () => {
  const mono = (o, X) => {
    const OX = [null, ...X];
    for (const a of OX) for (const a2 of OX) for (const b of OX) for (const b2 of OX)
      if (M.flatLE(a, a2) && M.flatLE(b, b2) && !M.flatLE(o(a, b), o(a2, b2))) return false;
    return true;
  };
  const rhs = (f, X) => X.every((x) => X.every((y) => f(x, y) === x && f(x, y) === y));
  for (const X of [[1], [1, 2]]) for (const f of [(x) => x, (_, y) => y, () => null, (x, y) => (x === y ? x : null)])
    check(`liftU mono ⇔ f = π₁ = π₂ on |X|=${X.length}`, mono(M.liftU(f), X) === rhs(f, X));
  for (let r = 0; r < 50; r++) {
    const X = [1, 2, 3], tbl = {};
    for (const x of X) for (const y of X) tbl[`${x},${y}`] = pick([null, 1, 2, 3]);
    check('liftZ mono', mono(M.liftZ((x, y) => tbl[`${x},${y}`]), X));
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log(fails.slice(0, 40).join('\n')); process.exitCode = 1; }
