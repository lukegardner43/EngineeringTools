// Hollowcore Support Beam: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part of the full calculation (the section, its class in sagging and the plank bearing; each construction stage that
// governs, as Steel Beam Torsion writes it; the final stage; the transverse bending of the bearing element; the Slimflor
// welds; the final stage with the beam in torsion) is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad
// works out must be the engine's own: UKB and UKC with the planks on the top or bottom flange, ASB and Slimflor, edge beams,
// restraints, line loads, the reaction at the tip, and random beams. Every check of the tool must be in a part with its
// utilisation; no chip may show an error or a unit CalcPad cannot read; and the whole calculation must open in CalcPad as one.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Hollowcore Support Beam.html'), 'utf8');
const block = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.Hollowcore=Hollowcore;this.SECTION_DATA=SECTION_DATA;this.CalcScript=CalcScript;this.HollowcoreScript=HollowcoreScript;', sb);
const { EC3, Hollowcore: HC, SECTION_DATA, CalcScript, HollowcoreScript } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, beams = 0;
const kinds = new Set();
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
const row = nm => SECTION_DATA.find(r => r[0].startsWith(nm));
const ZK = { brg: z => z.key === 'section', c_sec: (z, R) => /-sec$/.test(z.key) && z.util >= R.checks.find(c => c.k === 'c_sec').util - 1e-12, c_mem: z => /-mem$/.test(z.key), c_rot: z => /-rot$/.test(z.key),
  f_bend: z => z.key === 'final', f_shear: z => z.key === 'final', f_mv: z => z.key === 'final', f_dQ: z => z.key === 'final', f_dT: z => z.key === 'final', local: z => z.key === 'local', weld: z => z.key === 'weld' };
const base = { grade: 'S355', L: 6000, LA: 7500, LB: 7500, gp: 2.9e-3, gt: 1.2e-3, gs: 1.0e-3, q: 3.5e-3, qc: 0.75e-3, line: { g: 0, q: 0, e: 0 }, gap: 30, brgMin: 75, atTip: false,
  gG: 1.35, gQ: 1.5, restraints: [], rotLimitDeg: 2, deflQ: 360, deflT: 250, finalTorsion: false, weldLeg: 6 };
function beam(tag, o) {
  const inp = { ...base, ...o };
  let R; try { R = HC.design(inp); } catch (e) { console.log('engine refused', tag, e.message); return null; }
  let Z; try { Z = HollowcoreScript.zones(R, inp); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  beams++; kinds.add(`${inp.sec.kind} ${inp.bearOn}${inp.finalTorsion ? ' final torsion' : ''}`);
  for (const c of R.checks) {
    n++; const z = c.k.startsWith('ft_') ? Z.find(q => q.key === c.k.slice(3) + '-sec') : Z.find(q => ZK[c.k](q, R));
    if (!z || (isFinite(c.util) && z.util < c.util - 1e-12)) { bad++; console.log('MISSING', tag, c.k, z && z.util, c.util); }
  }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /not satisfied/i.test(it.text)); n++;
    if (zn.util != null && (isFinite(zn.util) ? Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util) : !said)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; const um = Math.max(...Z.map(z => z.util ?? 0)); if (!(um === R.utilMax || Math.abs(um - R.utilMax) <= 1e-9 * Math.max(1, R.utilMax))) { bad++; console.log('TOOL UTIL', tag, um, R.utilMax); }
  return Z;
}
// ---------- set beams ----------
const Z0 = beam('UKB, planks on the top flange', { sec: HC.rolled(row('457×191×82'), 'S355'), bearOn: 'top' });
beam('UKB, reaction at the tip, restraint at mid-span', { sec: HC.rolled(row('457×191×82'), 'S355'), bearOn: 'top', atTip: true, restraints: [3000] });
beam('UKC, planks on the bottom flange', { sec: HC.rolled(row('305×305×137'), 'S355'), bearOn: 'bottom', gap: 20 });
beam('UKB edge beam, line load', { sec: HC.rolled(row('533×210×92'), 'S355'), bearOn: 'top', LB: 0, line: { g: 5, q: 2, e: 100 } });
beam('ASB', { sec: HC.asb(HC.ASB_DATA[2], 'S355'), bearOn: 'bottom', gap: 30 });
beam('ASB edge beam, final torsion', { sec: HC.asb(HC.ASB_DATA[5], 'S355'), bearOn: 'bottom', LB: 0, finalTorsion: true });
beam('ASB, final torsion both sides', { sec: HC.asb(HC.ASB_DATA[7], 'S275'), grade: 'S275', bearOn: 'bottom', finalTorsion: true, L: 7500 });
beam('Slimflor', { sec: HC.slimflor(row('254×254×89'), 'S355', 400, 15), bearOn: 'bottom', gap: 10 });
beam('Slimflor edge beam, final torsion', { sec: HC.slimflor(row('305×305×118'), 'S355', 460, 20), bearOn: 'bottom', gap: 15, LB: 0, finalTorsion: true });
// ---------- random beams ----------
let seed = 385; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
for (let t = 0; t < 20; t++) {
  const kind = pick(['UKB', 'UKC', 'ASB', 'SF']), grade = pick(['S275', 'S355']);
  const ucr = pick(SECTION_DATA.filter(r => /^(254|305|356)×.*UKC$/.test(r[0])));
  const sec = kind === 'ASB' ? HC.asb(pick(HC.ASB_DATA), grade) : kind === 'SF' ? HC.slimflor(ucr, grade, Math.round(EC3.fromRow(ucr).b) + pick([100, 150, 200]), pick([12, 15, 20]))
    : HC.rolled(pick(SECTION_DATA.filter(r => kind === 'UKB' ? /^(406|457|533|610)×.*UKB$/.test(r[0]) : /^(254|305|356)×.*UKC$/.test(r[0]))), grade);
  const bearOn = kind === 'ASB' || kind === 'SF' ? 'bottom' : pick(['top', 'top', 'bottom']);
  beam(`random ${t} ${sec.name}`, { sec, grade, bearOn, L: pick([5000, 6000, 7500]), LA: pick([6000, 7500, 9000]), LB: rnd() < 0.25 ? 0 : pick([6000, 7500, 9000]), gap: bearOn === 'top' ? pick([20, 30, 40]) : pick([10, 20, 30]),
    atTip: rnd() < 0.3, restraints: rnd() < 0.3 ? [2500] : [], finalTorsion: rnd() < 0.3, qc: pick([0, 0.75e-3, 1.5e-3]), line: rnd() < 0.2 ? { g: between(1, 5), q: between(0, 3), e: 50 } : { g: 0, q: 0, e: 0 }, weldLeg: pick([6, 8]) });
}
// ---------- the whole calculation as one CalcPad check ----------
{ const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
console.log(`${zones} parts of ${beams} beams; ${[...kinds].sort().join('; ')}`);
console.log(`\n${n - bad}/${n} Hollowcore values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
