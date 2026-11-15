// RC Slab Design: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every zone (one-way: the loads, each support side, each span with its distribution steel, each end's shear; two-way: the
// loads and coefficients, each mid-span and edge strip, each edge's shear) is pasted into CalcPad (headless, tests/calcpad)
// and every value CalcPad works out must be the tool's own: half the TCC31 slabs (outputs only, ref_tcc31.json), 30 random
// one-way slabs (beams, walls, knife edges and fixed ends, cantilevers, line loads, δ from 0.7) and every edge arrangement of
// two-way panel at five ratios, with the bars the tool suggests. No chip may show an error or a unit CalcPad cannot read.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Slab Design.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Object, Number, Error, JSON, Infinity, String, Set, Map, Promise, parseFloat, isFinite };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + ';this.RCBeam=RCBeam;this.RCSlabDesign=RCSlabDesign;this.CalcScript=CalcScript;this.RCSlabScript=RCSlabScript;', sb);
const { RCBeam, RCSlabDesign, CalcScript, RCSlabScript } = sb;
const T31 = require('./ref_tcc31.json');
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, slabs = 0;
function check(tag, C, P) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
    // (1e-9 absolute, in SI: a zone with no moment has steel and depths of order 1e-11 that CalcPad's rounding takes to 0)
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + (it.name === 'N_res' ? 1e-2 : 1e-9);
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
}
function run(tag, Z) { slabs++; for (const zn of Z) { zones++; check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad())); } }
function one(tag, inp) { let D; try { D = RCSlabDesign.oneWay({ ...inp, bars: RCSlabDesign.suggestOneWay(inp) }); } catch (e) { return; } run(tag, RCSlabScript.zonesOne(D, inp)); }
function two(tag, inp) { let T; try { const bars = { ...(inp.bars || {}), ...RCSlabDesign.suggestTwoWay(inp) }; T = RCSlabDesign.twoWay({ ...inp, bars }); inp = { ...inp, bars }; } catch (e) { return; } run(tag, RCSlabScript.zonesTwo(T, inp)); }
// ---------- TCC31: every other slab ----------
const PSI2 = { Office: 0.3, Shopping: 0.6, Storage: 0.8, Dwelling: 0.3 };
T31.cases.forEach((cs, ci) => {
  if (ci % 2) return;
  const ns = cs.n, O = cs.out;
  one(`TCC31 ${ci}`, { spans: cs.spans.map(s => ({ L: s.L * 1000, h: s.h })), supports: Array.from({ length: ns + 1 }, (_, j) => ({ kind: 'knife', width: 0, delta: 1 - cs.red[j] })),
    loads: cs.loads.flatMap((l, i) => [{ span: i, case: 'G', type: 'udl', w: l.G }, { span: i, case: 'Q', type: 'udl', w: l.Q }, ...l.pl.flatMap(p => [{ span: i, case: 'G', type: 'line', P: p.G, a: p.a }, { span: i, case: 'Q', type: 'line', P: p.Q, a: p.a }])]),
    sets: [{ gG: O['Uls!C8'], gQ: O['Uls!F9'], label: 'TCC' }], patterns: RCBeam.patternList(ns, false), redist: cs.in['ACTIONS!J14'] === 2 ? 'none' : 'limited', psi2: PSI2[cs.usage], selfWeight: false,
    fck: cs.fck, fyk: 500, dg: 20, cover: { top: cs.in['MAIN!J10'], btm: cs.in['MAIN!J11'] }, wk: { top: cs.in['MAIN!J7'], btm: cs.in['MAIN!J8'] }, brittle: true });
});
// ---------- random one-way slabs ----------
let seed = 31415926; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
for (let t = 0; t < 30; t++) {
  const ns = 1 + Math.floor(rnd() * 4), h = 25 * Math.round(between(150, 325) / 25);
  const spans = [...Array(ns)].map(() => ({ L: 250 * Math.round(between(2500, 7000) / 250), h }));
  const end = () => pick(['knife', 'beam', 'beam', 'fixed', 'free']), mk = k => ({ kind: k, width: k === 'free' ? 0 : pick([0, 200, 300]), delta: k === 'free' ? 1 : pick([1, 1, 0.85, 0.7]) });
  const supports = [...Array(ns + 1)].map((_, j) => mk(j === 0 || j === ns ? end() : pick(['beam', 'beam', 'knife'])));
  if (ns === 1 && supports.some(s => s.kind === 'free')) supports[supports[0].kind === 'free' ? 1 : 0] = mk('fixed');
  if (supports[0].kind === 'free' && supports[ns].kind === 'free') supports[ns] = mk('beam');
  const loads = spans.flatMap((s, i) => [{ span: i, case: 'G', type: 'udl', w: +between(1, 4).toFixed(1) }, { span: i, case: 'Q', type: 'udl', w: +between(1.5, 7.5).toFixed(1) },
    ...(rnd() < 0.3 ? [{ span: i, case: 'G', type: 'line', P: Math.round(between(3, 15)), a: +(s.L / 1000 * between(0.2, 0.8)).toFixed(2) }] : []),
    ...(rnd() < 0.2 ? [{ span: i, case: 'Q', type: 'part', w: +between(2, 5).toFixed(1), a: 0.5, b: +(s.L / 2000).toFixed(2) }] : [])]);
  one(`slab${t}`, { spans, supports, loads, rule: pick(['6.10', '6.10ab']), psi0: 0.7, psi2: pick([0.3, 0.6]), adjacent: rnd() < 0.3, redist: pick(['limited', 'none']), selfWeight: rnd() < 0.8, gc: 25,
    fck: pick([25, 30, 32, 35, 40, 50]), fyk: 500, dg: 20, cover: { top: pick([20, 25, 30]), btm: pick([20, 25, 30, 35]) }, wk: { top: 0.3, btm: pick([0.3, 0.2]) }, brittle: rnd() < 0.7 });
}
// ---------- two-way panels: every edge arrangement at five ratios ----------
let k = 0;
for (const mask of [...Array(16).keys()]) for (const r of [1, 1.25, 1.5, 1.75, 2.2]) {
  const edges = { L1: !!(mask & 1), L2: !!(mask & 2), S1: !!(mask & 4), S2: !!(mask & 8) }, lx = pick([3500, 4500, 5500, 6500]);
  two(`panel${k++} ${JSON.stringify(edges)} r=${r}`, { lx, ly: Math.round(lx * r), h: pick([175, 200, 225, 250]), fck: pick([25, 30, 32, 40]), fyk: 500, cover: { top: 25, btm: pick([25, 30]) }, edges, gk: +between(1, 3).toFixed(1), qk: +between(1.5, 5).toFixed(1),
    rule: pick(['6.10', '6.10ab']), psi0: 0.7, psi2: 0.3, selfWeight: rnd() < 0.8, gc: 25, wk: { top: 0.3, btm: 0.3 }, brittle: true });
}
console.log(`${zones} zones of ${slabs} slabs and panels`);
console.log(`\n${n - bad}/${n} RC Slab values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
