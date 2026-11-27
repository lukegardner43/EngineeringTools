// Bolt Group Analysis: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// The bolts and their resistances, the group (centroid, moment about it, J, the long-joint factor) and the governing bolt
// (elastic shear, tension about the centroid or a pivot, bearing in each ply along y and z, punching, shear with tension)
// are pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the engine's own: grids and
// free layouts, eccentric shear, pure torsion, tension with moments about the centroid and about the bottom edge, two
// plies, long joints, shanks in the shear plane, and random groups. The tool's utilisation must be the part's; no chip may
// show an error or a unit CalcPad cannot read; and the whole calculation must open in CalcPad as one check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Bolt Group Analysis.html'), 'utf8');
const sb = { console, Math, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite };
vm.createContext(sb);
const src = html.slice(html.indexOf('/* ===== BOLT GROUP ENGINE'), html.indexOf("if (typeof module !== 'undefined') module.exports = { BoltGroupScript };"));
vm.runInContext(src + '\n;this.BoltGroup=BoltGroup;this.CalcScript=CalcScript;this.BoltGroupScript=BoltGroupScript;', sb);
const { BoltGroup, CalcScript, BoltGroupScript } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, groups = 0;
function check(tag, C, P) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + 1e-9;
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
  // the drawings CalcPad draws live (STEEL, PLOT): every one drawn, none showing an error
  const pe = (P.plots || []).filter(p => p.err), np = C.items.filter(it => it.t === 'plot').length; if (pe.length || (P.plots || []).length !== np) { bad++; console.log('PLOT', tag, (P.plots || []).length, np, pe.slice(0, 2)); }
  globalThis.__plots = (globalThis.__plots || 0) + (P.plots || []).length;
}
// as the page's analyse(): the layout, the plies and the actions (kN, kNm)
function group(tag, { layout, d = 20, cls = '8.8', thr = true, planes = 1, plies = [{ t: 10, fu: 430 }], act }) {
  const { bolts, plate } = layout.bolts ? layout : BoltGroup.grid(layout);
  const a = { Fy: (act.Fy || 0) * 1e3, Fz: (act.Fz || 0) * 1e3, T: (act.T || 0) * 1e6, ya: act.ya ?? 0, za: act.za ?? 0, N: (act.N || 0) * 1e3, My: (act.My || 0) * 1e6, pivotZ: act.pivot === 'bottom' ? plate.z0 : null };
  let r; try { r = BoltGroup.check({ bolts, plate, d, cls, threadsInShear: thr, planes, plates: plies, act: a }); } catch (e) { console.log('engine refused', tag, e.message); return null; }
  const R = { s: { thr }, bolts, plate, plies, act: a, r, warn: [] };
  let Z; try { Z = BoltGroupScript.zones(R); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  groups++;
  for (const zn of Z) {
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /not satisfied/i.test(it.text)); n++;
    if (isFinite(zn.util) ? Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util) : !said) { bad++; console.log('UTIL', tag, u, zn.util); }
    check(tag, zn.C, H.text(zn.C.calcpad()));
  }
  return Z;
}
const g34 = { rows: 4, cols: 2, p1: 70, p2: 90, e1: 40, e2: 40 };
const Z0 = group('eccentric shear on a 4 × 2 grid', { layout: g34, act: { Fz: -150, ya: 250, za: 145 } });
group('pure torsion', { layout: g34, act: { T: 20 } });
group('concentric shear and tension, two plies', { layout: { rows: 3, cols: 2, p1: 70, p2: 100, e1: 45, e2: 50 }, plies: [{ t: 10, fu: 430 }, { t: 12, fu: 510 }], act: { Fy: 60, Fz: -120, ya: 100, za: 115, N: 80 } });
group('tension and moment about the centroid', { layout: g34, act: { N: 50, My: 15, Fz: -60, ya: 85, za: 145 } });
group('moment about the bottom edge (pivot)', { layout: g34, act: { My: 30, Fz: -100, ya: 85, za: 145, pivot: 'bottom' } });
group('a single column of bolts, M24 10.9, shank in the shear plane', { layout: { rows: 5, cols: 1, p1: 75, p2: 0, e1: 40, e2: 50 }, d: 24, cls: '10.9', thr: false, act: { Fz: -200, ya: 120, za: 190 } });
group('a single row', { layout: { rows: 1, cols: 4, p1: 0, p2: 70, e1: 50, e2: 40 }, act: { Fy: 100, ya: 145, za: 50 } });
group('a long joint, two shear planes', { layout: { rows: 12, cols: 2, p1: 80, p2: 100, e1: 40, e2: 50 }, planes: 2, act: { Fz: 1200, ya: 100, za: 520 } });
group('a free layout', { layout: { bolts: [{ y: 50, z: 50 }, { y: 150, z: 60 }, { y: 100, z: 160 }, { y: 210, z: 180 }], plate: { y0: 0, y1: 260, z0: 0, z1: 230 } }, cls: '4.6', act: { Fy: 30, Fz: -40, T: 5, ya: 130, za: 115, N: 20 } });
// ---------- random groups ----------
let seed = 358; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
for (let t = 0; t < 30; t++) {
  const d = pick([12, 16, 20, 24, 30]), d0 = BoltGroup.BOLTS[d][2], rows = pick([1, 2, 3, 4, 6]), cols = pick([1, 2, 3]);
  const layout = { rows, cols, p1: rows > 1 ? Math.round(d0 * between(2.4, 4)) : 0, p2: cols > 1 ? Math.round(d0 * between(2.5, 4)) : 0, e1: Math.round(d0 * between(1.3, 2.5)), e2: Math.round(d0 * between(1.3, 2.5)) };
  const act = { Fy: between(-50, 50), Fz: between(-150, 50), T: rnd() < 0.3 ? between(-10, 10) : 0, ya: between(0, 300), za: between(0, 300), N: rnd() < 0.4 ? between(0, 80) : 0, My: rnd() < 0.3 ? between(0, 20) : 0, pivot: rnd() < 0.5 ? 'bottom' : 'centroid' };
  if (rows * cols === 1) { act.T = 0; act.ya = layout.e2; act.za = layout.e1; act.My = 0; }
  group(`random ${t}`, { layout, d, cls: pick(['4.6', '8.8', '10.9']), thr: rnd() < 0.8, planes: pick([1, 1, 2]), plies: [{ t: pick([8, 10, 12, 15]), fu: pick([410, 430, 470, 510]) }, ...(rnd() < 0.4 ? [{ t: pick([10, 15]), fu: 430 }] : [])], act });
}
// ---------- the whole calculation as one CalcPad check ----------
{ const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
console.log(`${groups} groups`);
console.log(`\n${n - bad}/${n} Bolt Group values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
