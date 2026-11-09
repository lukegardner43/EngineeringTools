// Base Plate Design: node test_base_plate.js
// The base plate engine checks each set of actions with the joints engine (identical numbers), reports each check for the set
// that governs it, and picks the governing set; validation; the drawings render for compression, bending and uplift.
const { base: B } = require('../column-base/load.js');
const { EC3, Joints, BasePlate, DrawBase, SECTION_DATA } = B;
let n = 0, fails = 0;
const truth = (name, c) => { n++; if (!c || process.env.V) console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const sec = name => EC3.fromRow(SECTION_DATA.find(r => r[0] === name));
const BASE = { plate: { D: 450, B: 450, t: 30, grade: 'S275' }, fck: 30, alpha: 1.5, bolts: { size: 'M24', cls: '8.8', ex: 50, ey: 300, hef: 300, dh: 60, cEdge: 200, cracked: true }, aw: 8, awW: 6 };
const cases = [{ name: 'compression', N: 1316e3, M: 0, V: 4.8e3 }, { name: 'bending', N: 900e3, M: 25e6, V: 12e3 }, { name: 'uplift', N: -150e3, M: 10e6, V: 18e3 }, { name: 'bending, other sign', N: 300e3, M: -60e6, V: 20e3 }];
const s = sec('254×254×73 UKC'), inp = { sec: s, grade: 'S355', base: BASE, cases }, R = BasePlate.design(inp), fy = EC3.yieldStrength('S355', Math.max(s.tf, s.tw));
R.res.forEach((r, i) => {
  const d = Joints.basePlate({ col: { h: s.h, b: s.b, tf: s.tf, tw: s.tw, r: s.r }, colFy: fy, colWpl: s.Wply, plate: BASE.plate, fck: 30, alpha: 1.5, bolts: { ...BASE.bolts, n: 2 }, aw: 8, awW: 6, N: cases[i].N, M: cases[i].M, V: cases[i].V });
  truth(`${cases[i].name}: checks identical to the joints engine`, d.checks.length === r.bp.checks.length && d.checks.every((c, k) => Math.abs(c.dem - r.bp.checks[k].dem) < 1e-9 && Math.abs(c.cap - r.bp.checks[k].cap) < 1e-9));
  truth(`${cases[i].name}: case utilisation is its worst check`, Math.abs(r.util - Math.max(...r.bp.checks.map(BasePlate.utilOf))) < 1e-12);
});
for (const [id, g] of Object.entries(R.gov)) truth(`check ${id}: reported for the case that governs it`, R.res.every(r => { const k = r.bp.checks.find(x => x.id === id); return !k || BasePlate.utilOf(k) <= g.util + 1e-12; }));
truth('governing case is the worst overall', R.utilMax === Math.max(...R.res.map(r => r.util)) && R.governing.util === R.utilMax);
truth('compression governs N_j,Rd', R.gov.B1.r.c.name === 'compression');
truth('the sign of M does not matter (symmetrical plate)', (() => { const a = BasePlate.design({ ...inp, cases: [{ name: 'a', N: 300e3, M: 60e6, V: 0 }] }), b = BasePlate.design({ ...inp, cases: [{ name: 'b', N: 300e3, M: -60e6, V: 0 }] }); return Math.abs(a.utilMax - b.utilMax) < 1e-12; })());
truth('bending case for the drawing: the largest M / M_j,Rd', R.bending && R.bending.c.name === R.res.filter(r => r.c.M).reduce((a, r) => Math.abs(r.c.M) / r.bp.MjRd > Math.abs(a.c.M) / a.bp.MjRd ? r : a).c.name);
const thr = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };
truth('no cases rejected', thr(() => BasePlate.design({ ...inp, cases: [] }), /at least one set/));
truth('non-numeric actions rejected', thr(() => BasePlate.design({ ...inp, cases: [{ name: 'x', N: NaN, M: 0, V: 0 }] }), /must be numbers/));
truth('anchors inside the column outline rejected', thr(() => BasePlate.design({ ...inp, base: { ...BASE, bolts: { ...BASE.bolts, ex: 120 } } }), /anchor bolts/));
// drawings: the joints kit's base view and the mechanism view for compression only, bending and uplift
const st = { section: '254×254×73 UKC', B: '450', D: '450', tp: '30', ex: '50', w: '300', hef: '300', dh: '60', c: '200', bolt: 'M24', cls: '8.8', aw: '8', awW: '6', fck: '30', pg: 'S275' };
for (const cs of [[cases[0]], [cases[1]], [cases[2]], cases]) {
  const Rr = BasePlate.design({ ...inp, cases: cs }), h = DrawBase.html({ ...inp, cases: cs, state: st }, Rr);
  truth(`drawings for ${cs.map(c => c.name).join(', ')}: base view and mechanism, no NaN`, (h.match(/<svg/g) || []).length >= 2 && !/NaN|undefined/.test(h));
}
console.log(`\n${n - fails}/${n} base plate checks passed`); if (fails) process.exit(1);
