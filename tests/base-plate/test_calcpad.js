// Base Plate Design: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Each set of actions that governs a check is written out (the bearing strength and effective area, the tension T-stub with
// the bolts and the column web, the compression T-stub, M_j,Rd by every branch of Table 6.7, the anchor force, shear by
// friction and the anchors, the cone, pull-out and pry-out, the welds) and pasted into CalcPad (headless, tests/calcpad);
// every value CalcPad works out must be the engine's own: compression, bending, uplift, tension with both sides in
// tension, both sides in compression, the flange zones overlapping, and random bases. Every check of the tool must be in a
// part with its value; no chip may show an error or a unit CalcPad cannot read; and the whole calculation must open in
// CalcPad as one check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Base Plate Design.html'), 'utf8');
const block = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.BasePlate=BasePlate;this.SECTION_DATA=SECTION_DATA;this.CalcScript=CalcScript;this.BasePlateScript=BasePlateScript;', sb);
const { EC3, BasePlate, SECTION_DATA, CalcScript, BasePlateScript } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, bases = 0;
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
const sec = nm => EC3.fromRow(SECTION_DATA.find(r => r[0] === nm));
function base(tag, inp) {
  let R; try { R = BasePlate.design(inp); } catch (e) { console.log('engine refused', tag, e.message); return null; }
  let Z; try { Z = BasePlateScript.zones(R, inp); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  bases++;
  const all = Z.flatMap(z => z.C.items.filter(it => it.t === 'chk').map(it => it.v));
  for (const [id, g] of Object.entries(R.gov)) { n++; if (isFinite(g.util) && !all.some(v => Math.abs(v - g.util) <= 1e-9 * Math.max(1, g.util))) { bad++; console.log('MISSING', tag, id, g.util); } }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /not satisfied/i.test(it.text)); n++;
    if (zn.util != null && (isFinite(zn.util) ? Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util) : !said)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; const um = Math.max(...Z.map(z => z.util ?? 0)); if (!(um === R.utilMax || Math.abs(um - R.utilMax) <= 1e-9 * Math.max(1, R.utilMax))) { bad++; console.log('TOOL UTIL', tag, um, R.utilMax); }
  return Z;
}
const BASE = { plate: { D: 450, B: 450, t: 30, grade: 'S275' }, fck: 30, alpha: 1.5, bolts: { size: 'M24', cls: '8.8', ex: 50, ey: 300, hef: 300, dh: 60, cEdge: 200, cracked: true }, aw: 8, awW: 6 };
const cases = [{ name: 'compression', N: 1316e3, M: 0, V: 4.8e3 }, { name: 'bending', N: 900e3, M: 25e6, V: 12e3 }, { name: 'uplift', N: -150e3, M: 10e6, V: 18e3 }, { name: 'bending, other sign', N: 300e3, M: -60e6, V: 25e3 }];
const uc = sec('254×254×73 UKC');
const Z0 = base('the test set', { sec: uc, grade: 'S355', base: BASE, cases });
for (const c of [{ name: 'tension, both sides in tension', N: -400e3, M: 5e6, V: 10e3 }, { name: 'compression, both sides in compression', N: 1500e3, M: 20e6, V: 5e3 }, { name: 'pure moment', N: 0, M: 40e6, V: 15e3 },
  { name: 'pure tension', N: -200e3, M: 0, V: 0 }, { name: 'tension, large moment', N: -50e3, M: 60e6, V: 30e3 }]) base(c.name, { sec: uc, grade: 'S355', base: BASE, cases: [c] });
base('flange zones overlap (thick plate, small column)', { sec: sec('152×152×23 UKC'), grade: 'S275', base: { ...BASE, plate: { D: 350, B: 350, t: 50, grade: 'S355' }, bolts: { ...BASE.bolts, ex: 40, ey: 220 } }, cases: [{ name: 'c', N: 800e3, M: 5e6, V: 10e3 }] });
base('no welds given, 10.9 bolts, non-cracked, shallow', { sec: uc, grade: 'S355', base: { ...BASE, aw: 0, awW: 0, bolts: { ...BASE.bolts, cls: '10.9', cracked: false, hef: 50, size: 'M20' } }, cases });
// ---------- random bases ----------
let seed = 667; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
for (let t = 0; t < 25; t++) {
  const s = EC3.fromRow(pick(SECTION_DATA.filter(r => /UKC$/.test(r[0])))), D = Math.round((s.h + pick([150, 200, 250])) / 10) * 10, B = Math.round((s.b + pick([100, 150, 200])) / 10) * 10;
  const b = { plate: { D, B, t: pick([20, 25, 30, 40]), grade: pick(['S275', 'S355']) }, fck: pick([25, 30, 40]), alpha: pick([1, 1.5, 2]), bolts: { size: pick(['M20', 'M24', 'M30']), cls: pick(['4.6', '8.8', '10.9']), ex: pick([45, 50, 60]), ey: Math.round(B * 0.6 / 10) * 10, hef: pick([150, 250, 350]), dh: pick([50, 60, 70]), cEdge: pick([150, 250]), cracked: rnd() < 0.6 }, aw: pick([0, 6, 8]), awW: pick([0, 6]) };
  const cap = s.A * 275, cs = Array.from({ length: pick([1, 2, 3]) }, (_, i) => ({ name: `case ${i + 1}`, N: cap * between(-0.2, 0.5), M: s.Wply * 275 * between(-0.3, 0.3) * (rnd() < 0.2 ? 0 : 1), V: cap * between(0, 0.05) }));
  base(`random ${t} ${s.name}`, { sec: s, grade: pick(['S275', 'S355']), base: b, cases: cs });
}
// ---------- the whole calculation as one CalcPad check ----------
{ const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
console.log(`${zones} parts of ${bases} bases`);
console.log(`\n${n - bad}/${n} Base Plate values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
