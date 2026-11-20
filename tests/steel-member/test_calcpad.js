// Steel Member Design: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part of the full calculation (the section, its steel and class; the cross-section at each station where a check
// governs: Table 5.2 there, shear with shear buckling, tension or compression, bending with shear and axial force about
// both axes, EN 1993-1-5 7.1; flexural, torsional and torsional-flexural buckling; lateral-torsional buckling of the
// governing segment; the interaction of 6.3.3 by Annex B or Annex A) is pasted into CalcPad (headless, tests/calcpad)
// and every value CalcPad works out must be the engine's own: set members of every shape (UKB, UKC, PFC, RHS, SHS, CHS,
// welded plate girders, historic sections), every class, tension and compression, biaxial bending, high shear, webs that
// buckle in shear, given buckling lengths (positions along the member, longer than the member), sway modes, Annex A and B,
// and random members. Every check of the tool must be in a part with its utilisation; no chip may show an error or a unit
// CalcPad cannot read; and the whole calculation must open in CalcPad as one check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Member Design.html'), 'utf8');
const block = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.Design=Design;this.SECTION_DATA=SECTION_DATA;this.PFC_DATA=PFC_DATA;this.HIST_SERIES=HIST_SERIES;this.CalcScript=CalcScript;this.SteelMemberScript=SteelMemberScript;', sb);
const { EC3, Design, SECTION_DATA, PFC_DATA, HIST_SERIES, CalcScript, SteelMemberScript } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, members = 0;
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
const keyOf = (Z, k) => ['bending', 'shear', 'axial'].includes(k) ? Z.find(z => z.checks && z.checks.includes(k)) : Z.find(z => z.key === k);
function member(tag, inp) {
  let R; try { R = Design.designMember(inp); } catch (e) { return null; }
  let Z; try { Z = SteelMemberScript.zones(R, inp); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  members++; kinds.add(`${inp.sec.shape} class ${R.cls}${R.gov.interaction ? ' annex ' + R.gov.interaction.ir.method : ''}`);
  for (const [k, g] of Object.entries(R.gov)) {
    n++; const z = keyOf(Z, k);
    if (!z || (isFinite(g.util) && z.util < g.util - 1e-12)) { bad++; console.log('MISSING', tag, k, z && z.util, g.util); }
  }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /not satisfied/i.test(it.text)); n++;
    if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util) && !(said && zn.util > Math.max(0, ...u))) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; const um = Math.max(...Z.map(z => z.util ?? 0)); if (!(um === R.utilMax || Math.abs(um - R.utilMax) <= 1e-9 * Math.max(1, R.utilMax))) { bad++; console.log('TOOL UTIL', tag, um, R.utilMax); }
  return Z;
}
const row = nm => SECTION_DATA.find(r => r[0] === nm), I = nm => EC3.fromRow(row(nm)), U = nm => EC3.fromRowPFC(PFC_DATA.find(r => r[0] === nm));
const HS = k => HIST_SERIES.find(x => x.key === k), hist = (k, i) => EC3.fromHist(HS(k).rows[i], HS(k).kind, HS(k));
// ---------- set members ----------
const uc = I('254×254×89 UKC'), ub = I('457×191×67 UKB');
const Z0 = member('UKC beam-column, Annex B', { sec: uc, grade: 'S355', L: 5000, N: 1200e3, MyB: 0, MyT: 40e6, MzB: 0, MzT: 10e6, ky: 1, kz: 1, nLT: 1, annex: 'B' });
member('UKC beam-column, Annex A', { sec: uc, grade: 'S355', L: 5000, N: 1200e3, MyB: 0, MyT: 40e6, MzB: 0, MzT: 10e6, ky: 1, kz: 1, nLT: 1, annex: 'A' });
member('UKB beam, two segments', { sec: ub, grade: 'S275', L: 8000, N: 0, MyB: -150e6, MyT: 120e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 2 });
member('UKB in tension and bending', { sec: ub, grade: 'S355', L: 6000, N: -400e3, MyB: 80e6, MyT: 80e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('UKB, high shear', { sec: I('406×140×39 UKB'), grade: 'S355', L: 600, N: 0, MyB: -160e6, MyT: 160e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('UKC column, sway', { sec: I('203×203×46 UKC'), grade: 'S355', L: 4000, N: 600e3, MyB: 30e6, MyT: -30e6, MzB: 0, MzT: 0, ky: 2, kz: 1, nLT: 1 });
member('UKC, given lengths, positions along the member', { sec: uc, grade: 'S355', L: 6000, N: 800e3, MyB: -60e6, MyT: 90e6, MzB: 0, MzT: 0, Lcr: { y: 6000, z: 3000, LT: 2500 } });
member('UKC, L_LT longer than the member, Annex A', { sec: uc, grade: 'S355', L: 4000, N: 500e3, MyB: 20e6, MyT: 70e6, MzB: 5e6, MzT: -5e6, Lcr: { y: 4000, z: 4000, LT: 6000 }, annex: 'A' });
member('PFC column: torsional-flexural', { sec: U('200×90×30 PFC'), grade: 'S275', L: 3000, N: 250e3, MyB: 0, MyT: 15e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('PFC biaxial, Annex A', { sec: U('300×90×41 PFC'), grade: 'S355', L: 4000, N: 150e3, MyB: 20e6, MyT: 40e6, MzB: 2e6, MzT: 3e6, ky: 1, kz: 1, nLT: 1, annex: 'A' });
member('RHS biaxial', { sec: EC3.rhs({ h: 200, b: 100, t: 6.3 }), grade: 'S355', L: 5000, N: 300e3, MyB: 30e6, MyT: 30e6, MzB: 15e6, MzT: 15e6, Lcr: { y: 5000, z: 5000, LT: 5000 } });
member('RHS biaxial, Annex A', { sec: EC3.rhs({ h: 250, b: 150, t: 8 }), grade: 'S355', L: 5000, N: 400e3, MyB: 10e6, MyT: 50e6, MzB: 0, MzT: 12e6, ky: 1, kz: 1, nLT: 1, annex: 'A' });
member('SHS cold-formed, slender: Class 4', { sec: EC3.rhs({ h: 200, b: 200, t: 5, cold: true }), grade: 'S355', L: 3000, N: 600e3, MyB: 0, MyT: 20e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('CHS biaxial', { sec: EC3.chs({ d: 168.3, t: 6.3 }), grade: 'S355', L: 4000, N: 200e3, MyB: 10e6, MyT: 10e6, MzB: 10e6, MzT: 10e6, Lcr: { y: 4000, z: 4000, LT: 4000 } });
member('CHS, high shear, Annex A', { sec: EC3.chs({ d: 114.3, t: 3.6 }), grade: 'S355', L: 400, N: 50e3, MyB: -15e6, MyT: 15e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1, annex: 'A' });
member('plate girder: web buckles in shear, EN 1993-1-5 7.1', { sec: EC3.customI({ name: 'PG 1200x300x8x20', h: 1200, b: 300, tw: 8, tf: 20 }), grade: 'S355', L: 3000, N: 0, MyB: -1500e6, MyT: 1500e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('plate girder in compression: Class 4 web', { sec: EC3.customI({ name: 'PG 900x250x8x16', h: 900, b: 250, tw: 8, tf: 16 }), grade: 'S275', L: 6000, N: 400e3, MyB: 0, MyT: 300e6, MzB: 0, MzT: 0, ky: 1, kz: 0.5, nLT: 2 });
member('welded I, Class 3 flange, S460', { sec: EC3.customI({ name: 'WI 500x400x12x16', h: 500, b: 400, tw: 12, tf: 16 }), grade: 'S460', L: 5000, N: 1500e3, MyB: 50e6, MyT: 200e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1, annex: 'A' });
member('historic UB, BS 15 steel', { sec: hist('H-UB1962', 20), grade: 'BS15', L: 6000, N: 0, MyB: 0, MyT: 0, MzB: 0, MzT: 0, Myf: x => 50e6 * 4 * x / 6000 * (1 - x / 6000), Vzf: x => 50e6 * 4 / 6000 * (1 - 2 * x / 6000), ky: 1, kz: 1, nLT: 1, hasUdl: true });
member('historic channel, f_y given', { sec: hist('H-BSC1932', 20), grade: 'GIVEN', fy: 230, L: 3000, N: 60e3, MyB: 0, MyT: 8e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('axial only, UKC tie', { sec: uc, grade: 'S355', L: 5000, N: -1500e3, MyB: 0, MyT: 0, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('axial only, UKC strut', { sec: uc, grade: 'S355', L: 7000, N: 1500e3, MyB: 0, MyT: 0, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('minor-axis bending only', { sec: uc, grade: 'S275', L: 4000, N: 0, MyB: 0, MyT: 0, MzB: 30e6, MzT: -20e6, ky: 1, kz: 1, nLT: 1 });
// ---------- tees cut from UKB and UKC ----------
const T = nm => EC3.tee(EC3.fromRow(row(nm)));
const tb = T('457×191×67 UKB'), tc = T('254×254×89 UKC'), tdeep = T('914×305×253 UKB');
member('tee: sagging, the flange in compression (Class 1)', { sec: tb, grade: 'S355', L: 5000, N: 0, MyB: 40e6, MyT: 40e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('tee: hogging, the toe in compression (Class 4, W_eff)', { sec: tb, grade: 'S355', L: 5000, N: 0, MyB: -15e6, MyT: -15e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('tee: reversal along the member', { sec: tb, grade: 'S275', L: 4000, N: 0, MyB: 20e6, MyT: -20e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 2 });
member('tee strut: Class 4, torsional-flexural, ΔM = e_N N', { sec: tb, grade: 'S355', L: 5000, N: 200e3, MyB: 0, MyT: 0, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('tee: compression and hogging', { sec: tb, grade: 'S355', L: 5000, N: 120e3, MyB: -8e6, MyT: -8e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('tee: compression and sagging', { sec: tdeep, grade: 'S275', L: 6000, N: 800e3, MyB: 150e6, MyT: 60e6, MzB: 0, MzT: 0, ky: 1, kz: 0.5, nLT: 2 });
member('tee: tension and sagging', { sec: tb, grade: 'S355', L: 5000, N: -250e3, MyB: 30e6, MyT: 30e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('tee from a UKC: biaxial with compression', { sec: tc, grade: 'S355', L: 3000, N: 150e3, MyB: 15e6, MyT: 25e6, MzB: 4e6, MzT: 4e6, ky: 1, kz: 1, nLT: 1 });
member('tee from a UKC: short, high shear', { sec: tc, grade: 'S355', L: 300, N: 0, MyB: 0, MyT: 60e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
member('tee: given lengths, positions along the member', { sec: tb, grade: 'S355', L: 6000, N: 60e3, MyB: 30e6, MyT: -10e6, MzB: 0, MzT: 0, Lcr: { y: 6000, z: 3000, LT: 2500 } });
member('tee: L_LT longer than the member', { sec: tb, grade: 'S355', L: 4000, N: 50e3, MyB: 40e6, MyT: 10e6, MzB: 0, MzT: 0, Lcr: { y: 4000, z: 4000, LT: 6000 } });
member('tee: minor-axis bending only', { sec: tc, grade: 'S275', L: 4000, N: 0, MyB: 0, MyT: 0, MzB: 20e6, MzT: -10e6, ky: 1, kz: 1, nLT: 1 });
member('tee tie', { sec: tb, grade: 'S355', L: 5000, N: -600e3, MyB: 0, MyT: 0, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
for (let t = 0; t < 40; t++) {
  let s2 = 7000 + t * 37; const r2 = () => (s2 = s2 * 16807 % 2147483647) / 2147483647, p2 = a => a[Math.floor(r2() * a.length)], b2 = (a, b) => a + (b - a) * r2();
  const sec = EC3.tee(EC3.fromRow(p2(SECTION_DATA.filter(r => /UK[BC]$/.test(r[0]))))), L = p2([1000, 2500, 4000, 6000]), fy = 275;
  const Mel = sec.Wely * fy, Nsz = sec.A * fy, given = r2() < 0.3;
  const inp = { sec, grade: p2(['S275', 'S355']), L, N: p2([0, 0, -0.3, 0.1, 0.3]) * Nsz, MyB: b2(-0.6, 0.8) * Mel, MyT: p2([0, 0.3, 0.6, -0.4]) * Mel, MzB: r2() < 0.25 ? b2(-0.15, 0.15) * sec.Wplz * fy : 0, MzT: 0,
    ky: p2([0.7, 1, 1]), kz: p2([0.5, 1]), nLT: p2([1, 1, 2]) };
  if (inp.MzB) inp.MzT = b2(-0.15, 0.15) * sec.Wplz * fy;
  if (given) inp.Lcr = { y: L * p2([0.7, 1, 2]), z: L * p2([0.5, 1]), LT: L * p2([0.3, 0.5, 1, 1.5]) };
  member(`random tee ${t} ${sec.name}`, inp);
}
// ---------- random members ----------
let seed = 1993; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
for (let t = 0; t < 70; t++) {
  const kind = pick(['UKB', 'UKC', 'UKC', 'PFC', 'RHS', 'CHS', 'welded', 'hist']);
  let sec;
  if (kind === 'UKB' || kind === 'UKC') sec = EC3.fromRow(pick(SECTION_DATA.filter(r => r[0].endsWith(kind))));
  else if (kind === 'PFC') sec = EC3.fromRowPFC(pick(PFC_DATA));
  else if (kind === 'RHS') { const h = pick([100, 150, 200, 250, 300]); sec = EC3.rhs({ h, b: pick([h, h / 2, 100]), t: pick([4, 5, 6.3, 8, 10]), cold: rnd() < 0.3 }); }
  else if (kind === 'CHS') sec = EC3.chs({ d: pick([88.9, 114.3, 168.3, 219.1, 323.9]), t: pick([3.2, 5, 6.3, 8, 10]), cold: rnd() < 0.3 });
  else if (kind === 'welded') sec = EC3.customI({ name: 'WI', h: pick([400, 600, 900, 1200]), b: pick([200, 300, 400]), tw: pick([6, 8, 10, 12]), tf: pick([12, 16, 20, 25]) });
  else { const s = pick(HIST_SERIES.filter(x => x.kind === 'I')); sec = EC3.fromHist(pick(s.rows), s.kind, s); }
  const grade = kind === 'hist' ? pick(['BS15', 'BS548', 'GIVEN']) : pick(['S275', 'S355', 'S355', 'S460']), L = pick([1000, 3000, 5000, 8000]);
  const sz = sec.Wply * 275, Nsz = sec.A * 275, given = rnd() < 0.3;
  const inp = { sec, grade, fy: 245, L, N: pick([0, 0, -0.3, 0.15, 0.4]) * Nsz, MyB: between(-0.5, 0.5) * sz, MyT: pick([0, 0.3, 0.6, -0.5]) * sz, MzB: rnd() < 0.3 ? between(-0.2, 0.2) * sec.Wplz * 275 : 0, MzT: 0,
    ky: pick([0.7, 1, 1, 1.5]), kz: pick([0.5, 1]), nLT: pick([1, 1, 2, 3]), annex: pick(['B', 'B', 'A']) };
  if (inp.MzB) inp.MzT = between(-0.2, 0.2) * sec.Wplz * 275;
  if (given) inp.Lcr = { y: L * pick([0.7, 1, 2]), z: L * pick([0.5, 1]), LT: L * pick([0.3, 0.5, 1, 1.5]) };
  member(`random ${t} ${sec.name}`, inp);
}
// ---------- the whole calculation as one CalcPad check ----------
{ const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
console.log(`${zones} parts of ${members} members; ${[...kinds].sort().join('; ')}`);
console.log(`\n${n - bad}/${n} Steel Member values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
