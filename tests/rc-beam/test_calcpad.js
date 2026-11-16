// RC Beam Analysis and Design: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every zone's calculation (loads, each support side, each span with its middle-zone links, each end's shear) is pasted
// into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: a third of the TCC41
// beams (outputs only, ref_tcc41.json) and 40 random beams (1 to 4 spans, rectangular and flanged, cantilevers, knife
// edges, columns and fixed ends, point and partial loads, δ from 0.7, f_ck to 60, the bars the tool suggests). No chip may
// show an error or a unit CalcPad cannot read, and the CalcPad project of a beam must open check by check with the same values.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Beam Analysis and Design.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Object, Number, Error, JSON, Infinity, String, Set, Map, Promise, parseFloat, isFinite };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + ';this.RCBeam=RCBeam;this.RCBeamDesign=RCBeamDesign;this.CalcScript=CalcScript;this.RCBeamScript=RCBeamScript;', sb);
const { RCBeam, RCBeamDesign, CalcScript, RCBeamScript } = sb;
const TCC = require('./ref_tcc41.json');
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0;
const PSI2 = { A: 0.3, B: 0.3, C: 0.6, D: 0.6, E: 0.8 };
function check(tag, C, P) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
    // (1e-9 absolute, in SI: a zone with no moment has steel and depths of order 1e-11 that CalcPad's rounding takes to 0)
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + (/^N_res(_\d+)*$/.test(it.name) ? 1e-2 : 1e-9);
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  const pe = (P.plots || []).filter(p => p.err); if (pe.length || (C.items.some(it => it.t === 'plot') && !(P.plots || []).length)) { bad++; console.log('PLOT', tag, pe.slice(0, 2)); }
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
}
function beam(tag, inp) {
  let D; try { D = RCBeamDesign.design({ ...inp, bars: RCBeamDesign.suggest(inp) }); } catch (e) { return null; }
  const Z = RCBeamScript.zones(D, inp);
  for (const zn of Z) { zones++; check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad())); }
  return { D, Z };
}
// ---------- TCC41: every third beam ----------
TCC.cases.forEach((cs, ci) => {
  if (ci % 3) return;
  const O = cs.out, ns = cs.n;
  const spans = cs.spans.map(s => ({ L: s.L * 1000, h: s.h, bw: s.bw, hf: s.hf, shape: s.type, beff: s.type === 'R' ? s.bw : s.beff, bay: 5000 }));
  const supports = cs.sups.map((s, j) => s.kind === 'K' ? { kind: 'knife', width: 0, delta: 1 - cs.red[j] } : { kind: 'column', width: s.below.H, delta: 1 - cs.red[j],
    above: s.above ? { L: s.above.L * 1000, b: s.above.B, h: s.above.H, far: s.above.far } : null, below: { L: s.below.L * 1000, b: s.below.B, h: s.below.H, far: s.below.far } });
  const loads = cs.loads.flatMap((l, i) => [{ span: i, case: 'G', type: 'udl', w: l.G }, { span: i, case: 'Q', type: 'udl', w: l.Q },
    ...(l.pl || []).flatMap(p => [{ span: i, case: 'G', type: 'point', P: p.G, a: p.a }, { span: i, case: 'Q', type: 'point', P: p.Q, a: p.a }]),
    ...(l.pu ? [{ span: i, case: 'G', type: 'part', w: l.pu.G, a: l.pu.a, b: l.pu.b }, { span: i, case: 'Q', type: 'part', w: l.pu.Q, a: l.pu.a, b: l.pu.b }] : [])]);
  beam(`TCC41 ${ci}`, { spans, supports, loads, sets: [{ gG: O['Uls!C8'], gQ: O['Uls!F9'], label: 'TCC' }], patterns: RCBeam.patternList(ns, false), redist: cs.in['ACTIONS!L14'] === 2 ? 'none' : 'limited',
    psi2: PSI2[cs.usage], selfWeight: 'none', fck: cs.fck, fyk: 500, dg: 20, cover: { top: cs.in['MAIN!J9'], btm: cs.in['MAIN!J10'] }, phiLink: cs.bars[0].link, legs: 2, wk: { top: cs.in['MAIN!H9'], btm: cs.in['MAIN!H10'] }, brittle: true });
});
// ---------- random beams ----------
let seed = 20261115; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
let made = 0, first = null;
for (let t = 0; made < 40 && t < 400; t++) {
  const ns = 1 + Math.floor(rnd() * 4), shape = pick(['R', 'T', 'L', 'T']), h = 50 * Math.round(between(350, 750) / 50), bw = 25 * Math.round(between(250, 450) / 25), hf = shape === 'R' ? 0 : 25 * Math.round(between(100, 200) / 25);
  const spans = [...Array(ns)].map(() => ({ L: 250 * Math.round(between(3000, 8500) / 250), h, bw, hf, shape, beff: null, bay: 5000 }));
  const col = () => ({ kind: 'column', width: pick([250, 300, 350, 400]), delta: pick([1, 1, 0.9, 0.85, 0.8, 0.7]), above: rnd() < 0.7 ? { L: 3500, b: 300, h: 300, far: pick(['F', 'P']) } : null, below: { L: 3500, b: 300, h: 300, far: pick(['F', 'P']) } });
  const end = () => pick(['knife', 'column', 'column', 'fixed', 'free']), mk = k => k === 'column' ? col() : k === 'knife' ? { kind: 'knife', width: pick([0, 150, 250]), delta: pick([1, 0.85]) } : k === 'fixed' ? { kind: 'fixed', width: 300, delta: 1 } : { kind: 'free', width: 0 };
  const supports = [...Array(ns + 1)].map((_, j) => j === 0 || j === ns ? mk(end()) : rnd() < 0.7 ? col() : mk('knife'));
  if (ns === 1 && supports.some(s => s.kind === 'free')) { supports[supports[0].kind === 'free' ? 1 : 0] = { kind: 'fixed', width: 300, delta: 1 }; }
  if (supports[0].kind === 'free' && supports[ns].kind === 'free') supports[ns] = col();
  const loads = spans.flatMap((s, i) => [{ span: i, case: 'G', type: 'udl', w: Math.round(between(10, 50)) }, { span: i, case: 'Q', type: 'udl', w: Math.round(between(5, 25)) },
    ...(rnd() < 0.3 ? [{ span: i, case: 'G', type: 'point', P: Math.round(between(10, 80)), a: +(s.L / 1000 * between(0.2, 0.8)).toFixed(2) }] : []),
    ...(rnd() < 0.2 ? [{ span: i, case: 'Q', type: 'part', w: Math.round(between(5, 20)), a: 0.5, b: +(s.L / 2000).toFixed(2) }] : [])]);
  const inp = { spans, supports, loads, rule: pick(['6.10', '6.10ab']), psi0: 0.7, psi2: pick([0.3, 0.6]), adjacent: rnd() < 0.3, redist: pick(['limited', 'none']), selfWeight: pick(['downstand', 'full', 'none']), gc: 25,
    fck: pick([25, 28, 30, 32, 35, 40, 45, 50, 60]), fyk: 500, dg: 20, cover: { top: pick([25, 30, 35, 40]), btm: pick([25, 30, 35, 40]) }, phiLink: pick([8, 10, 12]), legs: pick([2, 2, 3, 4]), wk: { top: 0.3, btm: pick([0.3, 0.2, 0.4]) }, xdMax: pick([null, null, 0.45]), brittle: rnd() < 0.7 };
  const r = beam(`beam${made}`, inp); if (!r) continue; if (!first) first = { inp, ...r }; made++;
}
// ---------- the project of the first random beam opens in CalcPad check by check with the same values ----------
(async () => {
  const P = await CalcScript.project(first.Z.map(zn => ({ C: zn.C, title: zn.title })), { project: 'Test', job: '1' }, 'Beam');
  // the whole calculation as one CalcPad check (.perega): its parts merged, every value still the tool's, as pasted and as opened
  { const M = CalcScript.merge(first.Z.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
  // the values the zones repeat go once into a first check of shared values, which CalcPad gives to every other check:
  // each zone, opened in the project, still has every value of its own calculation; and the pack is smaller for it
  n++; if (P.kind !== 'calcpad-project' || P.checks.length !== first.Z.length + 1 || !P.checks[0].shared || P.checks.slice(1).some(c => c.shared)) { bad++; console.log('FAIL the project has the wrong shape'); }
  const R = H.project(P);
  R.slice(1).forEach((r, k) => check(`project ${r.name}`, first.Z[k].C, r));
  const Pn = await CalcScript.project(first.Z.map(zn => ({ C: zn.C, title: zn.title })), { project: 'Test', job: '1' }, 'Beam', { share: false });
  const sz = x => JSON.stringify(x).length; n++; if (!(sz(P) < 0.85 * sz(Pn))) { bad++; console.log('FAIL sharing did not make the pack smaller', sz(P), sz(Pn)); }
  console.log(`project: ${P.checks.length} checks, ${(sz(P) / 1e3).toFixed(0)} kB with the shared values, ${(sz(Pn) / 1e3).toFixed(0)} kB without`);
  console.log(`${zones} zones of ${made} random and ${Math.ceil(TCC.cases.length / 3)} TCC41 beams`);
  console.log(`\n${n - bad}/${n} RC Beam values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
