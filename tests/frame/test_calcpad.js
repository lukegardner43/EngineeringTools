// Steel Frame Design: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part of the full calculation (the sway imperfection and α_cr of each combination; each member under its governing
// combination as Steel Member Design writes it, its moments and shears from the frame analysis; the deflections and drift)
// is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the engine's own: portal frames
// (pitched and flat, fixed and pinned bases, with and without wind, first and second order) and multi-storey frames (rigid and
// pinned beams), and random frames. Every check of the tool must be in a part with its utilisation; no chip may show an error
// or a unit CalcPad cannot read; and the whole calculation must open in CalcPad as one check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Frame Design.html'), 'utf8');
const block = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.Frame2D=Frame2D;this.SECTION_DATA=SECTION_DATA;this.CalcScript=CalcScript;this.SteelFrameScript=SteelFrameScript;', sb);
const { EC3, Frame2D, SECTION_DATA, CalcScript, SteelFrameScript } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, frames = 0;
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
}
const sec = nm => EC3.fromRow(SECTION_DATA.find(r => r[0] === nm));
// the page's frame generator (frameModel in Steel Frame Design.html), from the same inputs
function model(s) {
  const col = sec(s.colSec), bm = sec(s.beamSec), base = s.base === 'fixed' ? { ux: 1, uy: 1, rz: 1 } : { ux: 1, uy: 1 };
  const nodes = [], members = [], G = { nodal: [], udl: [] }, Q = { nodal: [], udl: [] }, W = { nodal: [], udl: [] };
  const colM = (i, j, side) => { members.push({ i, j, sec: col, grade: s.grade, role: 'column', nLT: s.colSeg || 1, kz: 1, side }); return members.length - 1; };
  const beamM = (i, j, rel) => { members.push({ i, j, sec: bm, grade: s.grade, role: 'beam', nLT: s.beamSeg || 1, kz: 1, relI: rel, relJ: rel }); const m = members.length - 1; G.udl.push({ member: m, wy: -s.gk }); Q.udl.push({ member: m, wy: -s.qk }); return m; };
  if (s.kind === 'portal') {
    const L = s.span * 1000, h = s.eaves * 1000, r = s.rise * 1000;
    nodes.push({ x: 0, y: 0, sup: base }, { x: 0, y: h }, { x: L, y: 0, sup: base }, { x: L, y: h });
    colM(0, 1, 'L'); colM(2, 3, 'R');
    if (r > 0) { nodes.push({ x: L / 2, y: h + r }); beamM(1, 4, false); beamM(4, 3, false); } else beamM(1, 3, false);
  } else {
    const xs = [0]; s.bays.forEach(b => xs.push(xs[xs.length - 1] + b * 1000)); const ys = [0]; s.storeys.forEach(h => ys.push(ys[ys.length - 1] + h * 1000));
    const id = (c, l) => l * xs.length + c;
    ys.forEach((y, l) => xs.forEach((x, c) => nodes.push({ x, y, sup: l === 0 ? base : null })));
    for (let l = 0; l < s.storeys.length; l++) xs.forEach((x, c) => colM(id(c, l), id(c, l + 1), c === 0 ? 'L' : c === xs.length - 1 ? 'R' : 'M'));
    for (let l = 1; l < ys.length; l++) for (let c = 0; c < s.bays.length; c++) beamM(id(c, l), id(c + 1, l), s.joints === 'pinned');
  }
  members.forEach((m, mi) => { if (m.role !== 'column') return; if (m.side === 'L' && s.ww) W.udl.push({ member: mi, wx: s.ww }); if (m.side === 'R' && s.wl) W.udl.push({ member: mi, wx: s.wl }); });
  return { nodes, members, cases: { G, Q, W }, rule: s.rule, imperfection: s.imp !== false, deflQ: s.dQ || 360, driftW: s.dW || 300 };
}
const keyOf = (Z, mi, k) => ['bending', 'shear', 'axial'].includes(k) ? Z.find(z => z.mi === mi && z.checks && z.checks.includes(k)) : Z.find(z => z.key === `m${mi + 1}-${k}`);
function frame(tag, s) {
  const inp = model({ colSec: '254×254×73 UKC', beamSec: '406×178×54 UKB', grade: 'S355', rule: '6.10', gk: 8, qk: 10, ww: 0, wl: 0, colSeg: 1, beamSeg: 1, ...s });
  let R; try { R = Frame2D.design(inp); } catch (e) { console.log('engine refused', tag, e.message); return null; }
  let Z; try { Z = SteelFrameScript.zones(R, inp); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  frames++; kinds.add(`${s.kind}${R.acrMin < 10 ? ' 2nd order' : ' 1st order'}${R.sls.drift.length ? ' drift' : ''}`);
  for (const m of R.members) for (const [k, g] of Object.entries(m.D.gov)) {
    n++; const z = keyOf(Z, m.mi, k);
    if (!z || (isFinite(g.util) && z.util < g.util - 1e-12)) { bad++; console.log('MISSING', tag, m.mi, k, z && z.util, g.util); }
  }
  for (const x of [...R.sls.beams, ...R.sls.drift]) { n++; const z = Z.find(q => q.key === 'sls'); if (!z || z.util < x.util - 1e-12) { bad++; console.log('MISSING SLS', tag); } }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v); n++;
    if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; const um = Math.max(...Z.map(z => z.util ?? 0)); if (!(Math.abs(um - R.utilMax) <= 1e-9 * Math.max(1, R.utilMax))) { bad++; console.log('TOOL UTIL', tag, um, R.utilMax); }
  return Z;
}
// ---------- set frames ----------
const Z0 = frame('the page default: pitched portal, fixed bases, wind', { kind: 'portal', base: 'fixed', span: 18, eaves: 6, rise: 1.5, ww: 3, wl: 2, rule: '6.10' });
frame('flat portal, pinned bases (second order)', { kind: 'portal', base: 'pinned', span: 15, eaves: 7, rise: 0, ww: 2, wl: 1.5, colSec: '203×203×46 UKC', beamSec: '356×171×45 UKB', gk: 5, qk: 6 });
frame('portal without wind, 6.10a/b, restraints', { kind: 'portal', base: 'fixed', span: 20, eaves: 5, rise: 2, rule: '6.10ab', colSeg: 2, beamSeg: 3, colSec: '305×305×97 UKC', beamSec: '457×191×67 UKB' });
frame('portal without imperfections', { kind: 'portal', base: 'fixed', span: 12, eaves: 5, rise: 0, imp: false, ww: 1 });
frame('multi-storey, rigid joints', { kind: 'multi', base: 'fixed', joints: 'rigid', bays: [6, 6], storeys: [4, 3.5], ww: 2, wl: 1 });
frame('multi-storey, pinned beams, fixed bases', { kind: 'multi', base: 'fixed', joints: 'pinned', bays: [7], storeys: [4, 4], ww: 1.5, wl: 1, gk: 10, qk: 8, colSec: '305×305×118 UKC' });
frame('multi-storey, pinned bases, rigid joints, 6.10a/b', { kind: 'multi', base: 'pinned', joints: 'rigid', bays: [5, 8, 5], storeys: [5], rule: '6.10ab', ww: 2.5, wl: 1.5 });
// ---------- random frames ----------
let seed = 2005; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
const UKC = SECTION_DATA.filter(r => /UKC$/.test(r[0])).map(r => r[0]), UKB = SECTION_DATA.filter(r => /UKB$/.test(r[0]) && +r[0].split('×')[0] >= 305).map(r => r[0]);
for (let t = 0; t < 8; t++) {
  const portal = rnd() < 0.6;
  frame(`random ${t}`, portal ? { kind: 'portal', base: pick(['fixed', 'pinned']), span: pick([12, 15, 20, 25]), eaves: pick([4, 5, 6, 8]), rise: pick([0, 1, 2]), ww: rnd() < 0.7 ? between(0.5, 4) : 0, wl: between(0, 2),
      colSec: pick(UKC), beamSec: pick(UKB), gk: between(2, 12), qk: between(0, 10), rule: pick(['6.10', '6.10ab']), colSeg: pick([1, 2]), beamSeg: pick([1, 2, 4]) }
    : { kind: 'multi', base: 'fixed', joints: pick(['rigid', 'pinned']), bays: [pick([5, 6, 8])], storeys: [pick([3.5, 4]), pick([3.5, 4])], ww: between(0.5, 3), wl: between(0, 2),
      colSec: pick(UKC), beamSec: pick(UKB), gk: between(4, 12), qk: between(2, 8), rule: pick(['6.10', '6.10ab']) });
}
// ---------- the whole calculation as one CalcPad check ----------
{ const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
console.log(`${zones} parts of ${frames} frames; ${[...kinds].sort().join('; ')}`);
console.log(`\n${n - bad}/${n} Steel Frame values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
