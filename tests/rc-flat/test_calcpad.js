// RC Flat Slab Design: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every zone of the full calculation (the loads, frame and M_t,max; at each column its column strip, middle strip and
// punching; in each span its two strips with span / effective depth) is pasted into CalcPad (headless, tests/calcpad) and
// every value CalcPad works out must be the tool's own: every TCC33 frame (outputs only, ref_tcc33.json), internal and
// edge bays with overhangs and perimeter loads, β calculated, circular columns, strips that cannot be designed, and 16
// random frames. No chip may show an error or a unit CalcPad cannot read, every PUNCH plan must draw, and the CalcPad
// project of a frame must open check by check with the same values.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Flat Slab Design.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.FlatSlab = FlatSlab; this.CalcScript = CalcScript; this.FlatScript = FlatScript;', sb);
const { FlatSlab, CalcScript, FlatScript } = sb;
const T33 = require('./ref_tcc33.json');
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, frames = 0, failed = 0;
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
function frame(tag, inp) {
  let R; try { R = FlatSlab.design(inp); } catch (e) { return null; }
  const Z = FlatScript.zones(R, inp); frames++;
  // one zone for the loads, three at each column, two in each span; the worst zone is the frame's worst check
  n++; if (Z.length !== 1 + 3 * inp.columns.length + 2 * inp.spans.length || Math.abs(Math.max(...Z.map(z => z.util || 0)) - R.utilMax) > 1e-9 * R.utilMax) { bad++; console.log('ZONES', tag, Z.length, Math.max(...Z.map(z => z.util || 0)), R.utilMax); }
  failed += [...R.supZ.flatMap(z => [z.cs, z.ms]), ...R.spanZ.flatMap(z => [z.cs.z, z.ms.z])].filter(z => z.fail).length;
  for (const zn of Z) { zones++; check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad())); }
  return Z;
}
const F0 = { fck: 32, fyk: 500, coverTop: 25, coverBtm: 25, phiMax: 20, wk: 0.3, rule: '6.10ab', psi0: 0.7, psi2: 0.3, adjacent: false, redist: 'limited', h: 250, b: 7500, bay: 'internal',
  spans: [7.5, 7.5, 7.5], endL: 300, endR: 300, perimL: 4, perimR: 4, gk: 1.5, qk: 5, density: 25, hogCS: 0.75, sagCS: 0.55, phiEnd: 16, brittle: true,
  columns: [0, 1, 2, 3].map(j => ({ c1: 450, c2: 450, above: { L: 3.5, far: 'F' }, below: { L: 3.5, far: 'F' }, delta: j === 0 || j === 3 ? 1 : 0.85 })), punch: { beta: 'factors' } };
// ---------- the frames ----------
const Z0 = frame('internal bay', F0);
frame('edge bay, overhangs, β calculated', { ...F0, bay: 'edge', b: 4050, eT: 400, sideLoad: 3, endL: 1500, endR: 1200, punch: { beta: 'calc' } });
frame('overhangs, circular columns, inner layers, 6.10', { ...F0, rule: '6.10', endL: 1800, perimL: 6, outerTop: false, outerBtm: false, columns: F0.columns.map((c, j) => j % 2 ? { ...c, circ: true, c2: c.c1 } : c) });
frame('long spans, thin slab (strips not designed)', { ...F0, h: 180, spans: [9, 9.5], columns: F0.columns.slice(0, 3), qk: 7.5, phiMax: 16 });
frame('no Mt,max cap, one span', { ...F0, mtmax: false, spans: [6.5], columns: F0.columns.slice(0, 2), wk: 0.2 });
T33.forEach(({ inp }, k) => frame(`TCC33 ${k}`, inp));
// ---------- random frames ----------
let seed = 3305; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 16; t++) {
  const ns = pick([1, 2, 3, 4]), edge = rnd() < 0.35, spans = Array.from({ length: ns }, () => pick([5, 6, 7.2, 8, 9])), c = () => { const circ = rnd() < 0.25, c1 = pick([300, 400, 450, 500]); return { c1, c2: circ ? c1 : pick([300, 400, 600]), circ, above: rnd() < 0.8 ? { L: pick([3, 3.5, 4]), far: pick(['F', 'P']) } : null, below: { L: pick([3.5, 4]), far: pick(['F', 'P']) }, delta: pick([1, 0.85, 0.75]) }; };
  frame(`random ${t}`, { ...F0, fck: pick([25, 30, 32, 35, 40, 50]), h: pick([200, 225, 250, 275, 300, 350]), b: edge ? pick([3500, 4200]) : pick([6000, 7200, 8000]), bay: edge ? 'edge' : 'internal', eT: edge ? pick([200, 300, 500]) : 0, sideLoad: edge ? pick([0, 4]) : 0,
    spans, endL: pick([0, 250, 1200]), endR: pick([0, 300, 1500]), perimL: pick([0, 5]), perimR: pick([0, 5]), gk: pick([1, 1.5, 2.5]), qk: pick([2.5, 4, 5, 7.5]), rule: pick(['6.10', '6.10ab']), psi2: pick([0.3, 0.6]), adjacent: rnd() < 0.3,
    hogCS: pick([0.6, 0.7, 0.75, 0.8]), sagCS: pick([0.5, 0.55, 0.6, 0.7]), phiMax: pick([16, 20, 25]), phiEnd: pick([12, 16, 20]), wk: pick([0.2, 0.3, 0.4]), coverTop: pick([20, 25, 30]), coverBtm: pick([20, 25, 30]),
    outerTop: rnd() < 0.7, outerBtm: rnd() < 0.7, brittle: rnd() < 0.7, columns: Array.from({ length: ns + 1 }, c), punch: { beta: pick(['factors', 'calc']) } });
}
// ---------- the project of the internal bay opens in CalcPad check by check with the same values ----------
(async () => {
  const list = Z0.map(zn => ({ C: zn.C, title: zn.title })), sz = x => JSON.stringify(x).length;
  const P = await CalcScript.project(list, { project: 'Test' }, 'Flat slab'), Pn = await CalcScript.project(list, { project: 'Test' }, 'Flat slab', { share: false });
  // the whole calculation as one CalcPad check (.perega): its parts merged, every value still the tool's, as pasted and as opened
  { const M = CalcScript.merge(list, { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
  n++; if (P.checks.length !== Z0.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
  H.project(P).slice(1).forEach((r, k) => check(`project ${r.name}`, Z0[k].C, r));
  n++; if (!(sz(P) < 0.85 * sz(Pn))) { bad++; console.log('FAIL sharing did not make the pack smaller', sz(P), sz(Pn)); }
  console.log(`project: ${P.checks.length} checks, ${(sz(P) / 1e3).toFixed(0)} kB with the shared values, ${(sz(Pn) / 1e3).toFixed(0)} kB without`);
  console.log(`${zones} zones of ${frames} frames (${failed} strips that cannot be designed)`);
  console.log(`\n${n - bad}/${n} RC Flat Slab values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
