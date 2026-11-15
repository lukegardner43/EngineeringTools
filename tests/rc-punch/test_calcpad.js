// RC Punching Shear: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// The full calculation of every TCC13 punching run (outputs only, ref_tcc13.json: internal columns with the UK NA factors
// and with β calculated, edge and corner columns, effective depths given) and of random columns (internal, edge and corner,
// rectangular and circular, β by the UK NA value and by 6.39, 6.42, 6.43, 6.44 and 6.46, a load q taken off, openings
// within 6d, shear links with the size, spacing and first perimeter chosen or found) is pasted into CalcPad (headless,
// tests/calcpad) and every value CalcPad works out must be the tool's own. No chip may show an error or a unit CalcPad
// cannot read, and every PUNCH plan (drawn live from the values where there are no openings) must draw.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Punching Shear.html'), 'utf8');
const sb = { console, Math, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.Punching = Punching; this.CalcScript = CalcScript; this.PunchScript = PunchScript;', sb);
const { Punching, CalcScript, PunchScript } = sb;
const T13 = require('./ref_tcc13.json');
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, runs = 0;
const kinds = new Set();
function check(tag, C, P) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + 1e-9;
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  const pe = (P.plots || []).filter(p => p.err); if (pe.length || (C.items.some(it => it.t === 'plot') && !(P.plots || []).length)) { bad++; console.log('PLOT', tag, pe.slice(0, 2)); }
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
}
function run(tag, inp) {
  let R; try { R = Punching.design(inp); } catch (e) { return null; }
  const C = PunchScript.punch(R, inp); runs++;
  kinds.add(`${inp.type} ${inp.shape} ${R.B.how.replace(/ with.*|,.*/, '')}${R.links ? ', links' : ''}${R.S.some(s => s.active) ? ', opening' : ''}${R.q > 0 ? ', q' : ''}`);
  // the calculation's checks are the engine's: the face, u_1, and with links v_Rd,cs
  const U = Object.fromEntries(C.items.filter(it => it.t === 'chk').map(it => [it.name, it.v])); n++;
  if (Math.abs(Math.max(U.U_max, U.U_c, U.U_cs ?? 0) - R.util) > 1e-12 * R.util) { bad++; console.log('UTIL', tag, U, R.util); }
  check(tag, C, H.text(C.calcpad()));
  return { R, C };
}
// ---------- TCC13 ----------
T13.forEach(({ inp }, i) => run(`TCC13 ${i}`, inp));
// ---------- random columns ----------
let seed = 1311; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 150; t++) {
  const type = pick(['internal', 'internal', 'edge', 'corner']), circ = rnd() < 0.3, c1 = pick([250, 300, 400, 500, 600]), c2 = pick([250, 300, 400, 600, 800]), calc = rnd() < 0.5;
  run(`random ${t}`, { type, shape: circ ? 'circ' : 'rect', D: c1, c1, c2: circ ? c1 : c2, ey: pick([0, 0, 50, 200]), ex: pick([0, 100, 300]), h: pick([200, 225, 250, 300, 350]), cover: pick([20, 25, 30, 35]),
    outer: pick(['x', 'y']), phiX: pick([10, 12, 16, 20]), sX: pick([100, 125, 150, 200]), phiY: pick([10, 12, 16, 20]), sY: pick([100, 150, 200]), fck: pick([25, 30, 32, 40, 50, 60]), fyk: 500, fywk: pick([500, 460, 250]),
    VEd: pick([150, 300, 500, 700, 900, 1200]), q: rnd() < 0.3 ? pick([5, 10, 15]) : 0, beta: { method: calc ? 'calc' : 'factors', Mx: pick([0, 0, 20, 60, 150]), My: pick([0, 0, 15, 50, 120]) },
    holes: rnd() < 0.2 ? [{ x: pick([500, 700, -600]), y: pick([0, 300, 500]), a: pick([200, 300, 600]), b: pick([150, 300]) }] : [],
    link: { phi: rnd() < 0.3 ? pick([8, 10, 12]) : undefined, sr: rnd() < 0.3 ? pick([120, 150, 250]) : undefined, s0: rnd() < 0.3 ? pick([60, 80, 100]) : undefined } });
}
console.log(`${runs} punching checks, ${kinds.size} kinds:\n  ${[...kinds].sort().join('\n  ')}`);
console.log(`\n${n - bad}/${n} RC Punching Shear values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
