// Mutation check for model.test.mjs: each mutant must make the suite fail.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const src = fs.readFileSync(path.join(__dirname, 'model.mjs'), 'utf8');
const test = fs.readFileSync(path.join(__dirname, 'model.test.mjs'), 'utf8');
const muts = [
  ['rowStep compose order', "return [fn((x) => g(f(x))), ...st.slice(1)];", "return [fn((x) => f(g(x))), ...st.slice(1)];"],
  ['r62 mul outlier side', "if (o === 'mul' && k1 === 'Address' && k2 === 'Int') return 'Address';", "if (o === 'mul' && k1 === 'Int' && k2 === 'Address') return 'Address';"],
  ['actBest top L decides', "if (x === 'A' && y === null) return 'push';", "if (x === 'L' && y === null) return 'push';"],
  ['plusK void+Int', "if (x === 'void' && y === 'Int') return 'Int';", "if (x === 'void' && y === 'Int') return 'void';"],
  ['mixOp botN absorbs addr', "if (s.t === 'botN' && t.t === 'num') return vnum(t.n);", "if (s.t === 'botN' && t.t !== 'botA') return t;"],
  ['litClass hex as dec', "return LC.hex(parseInt(m[1], 10)); // G:178", "return LC.dec(); // G:178"],
  ['predictRow compose shape', "st[0] = { kind: 'L', shape: ['compose', top.shape, node.shape] };", "st[0] = { kind: 'L', shape: ['compose', node.shape, top.shape] };"],
  ['bestSound ignores OUT', "if (def.length === 0 || vals.some((v) => v === OUT)) return OUT;", "if (def.length === 0) return OUT;"],
  ['tauSpace A L', "if (a === 'A' && b === 'L') return 'noRead';", "if (a === 'A' && b === 'L') return 'build';"],
  ['r62u bnot outlier', "if (o === 'bnot' && k === 'Address') return 'Address';", "if (o === 'bnot' && k === 'Address') return null;"],
  ['r62 div addr addr', "if (o === 'div' && k1 === 'Address' && k2 === 'Address') return 'Int';", "if (o === 'div' && k1 === 'Address' && k2 === 'Address') return 'Address';"],
  ['gUpdate updates all', "return x.map((xj, j) => (j === i ? fx[j] : xj));", "return fx;"],
  ['plusV unit right', "if (b === null) return a;", "if (b === null) return null;"],
  ['Kind fold domain without VOID_WARN', "dom = [...KIND_DOM, VOID_WARN];", "dom = [...KIND_DOM];"],
];
let caught = 0;
for (const [nm, from, to] of muts) {
  if (!src.includes(from)) { console.log(`MISSING  ${nm}`); continue; }
  const dir = path.join(__dirname, 'out', 'mut', nm.replace(/[^a-z0-9]+/gi, '_'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'model.mjs'), src.replace(from, to));
  fs.writeFileSync(path.join(dir, 'model.test.mjs'), test);
  const r = spawnSync(process.execPath, ['model.test.mjs'], { cwd: dir, encoding: 'utf8' });
  const m = /(\d+) passed, (\d+) failed/.exec(r.stdout);
  const failed = m ? Number(m[2]) : -1;
  const ok = r.status !== 0;
  if (ok) caught++;
  console.log(`${ok ? 'caught ' : 'MISSED '} ${nm}  (exit ${r.status}, failed checks ${failed}${failed < 0 ? ', crash: ' + (r.stderr || '').split('\n')[0] : ''})`);
}
console.log(`${caught}/${muts.length} mutants caught`);
