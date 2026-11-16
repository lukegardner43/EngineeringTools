// Steel Beam Analysis & Design: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad_beam.js).
// Every part of the full calculation (the section, its steel and class; the loads and the combinations; the cross-section at
// each station where a check governs; flexural and torsional buckling; lateral-torsional buckling of the governing
// segment; the interaction of 6.3.3 by Annex B or Annex A; web bearing to EN 1993-1-5 section 6 with 7.2; the deflection)
// is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the engine's own: set beams
// (simple, continuous, propped, fixed, cantilevers with free and restrained tips, intermediate restraints, the top flange
// restrained, destabilising loads, horizontal loads, axial compression and tension, Annex A and B, every shape) and random
// beams. Every check of the tool must be in a part with its utilisation; no chip may show an error or a unit CalcPad cannot
// read; and the whole calculation must open in CalcPad as one check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Beam Analysis and Design.html'), 'utf8');
const block = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.Design=Design;this.SECTION_DATA=SECTION_DATA;this.PFC_DATA=PFC_DATA;this.HIST_SERIES=HIST_SERIES;this.CalcScript=CalcScript;this.SteelBeamScript=SteelBeamScript;', sb);
const { EC3, Design, SECTION_DATA, PFC_DATA, HIST_SERIES, CalcScript, SteelBeamScript } = sb;
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
}
const keyOf = (Z, k) => ['bending', 'shear', 'axial'].includes(k) ? Z.find(z => z.checks && z.checks.includes(k)) : Z.find(z => z.key === k);
const base = { grade: 'S355', selfWeight: true, rule: '6.10ab', psi0: 0.7, N: 0, annex: 'B' };
function beam(tag, o) {
  const inp = { ...base, spans: [], cantL: 0, cantR: 0, ...o };
  const nm = (inp.cantL > 0 ? 1 : 0) + inp.spans.length + (inp.cantR > 0 ? 1 : 0);
  inp.restraint = inp.restraint || Array(nm).fill({ mode: 'ends' });
  let R; try { R = Design.designBeam(inp); } catch (e) { return null; }
  let Z; try { Z = SteelBeamScript.zones(R, inp); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  beams++; kinds.add(`${inp.sec.shape}${R.gov.interaction ? ' annex ' + R.gov.interaction.ir.method : ''}${R.gov.bearing ? ' bearing ' + R.gov.bearing.type : ''}`);
  for (const [k, g] of Object.entries(R.gov)) {
    n++; const z = keyOf(Z, k);
    if (!z || (isFinite(g.util) && z.util < g.util - 1e-12)) { bad++; console.log('MISSING', tag, k, z && z.util, g.util); }
  }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v); n++;
    if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; const um = Math.max(...Z.map(z => z.util ?? 0)); if (!(Math.abs(um - R.utilMax) <= 1e-9 * Math.max(1, R.utilMax))) { bad++; console.log('TOOL UTIL', tag, um, R.utilMax); }
  return Z;
}
const row = nm => SECTION_DATA.find(r => r[0] === nm), I = nm => EC3.fromRow(row(nm)), U = nm => EC3.fromRowPFC(PFC_DATA.find(r => r[0] === nm));
const HS = k => HIST_SERIES.find(x => x.key === k), hist = (k, i) => EC3.fromHist(HS(k).rows[i], HS(k).kind, HS(k));
const ub = I('457×191×67 UKB'), uc = I('254×254×89 UKC');
const G = (m, w) => ({ case: 'G', member: m, type: 'udl', w }), Q = (m, w) => ({ case: 'Q', member: m, type: 'udl', w });
// ---------- set beams ----------
const Z0 = beam('simple span, G + Q', { sec: ub, spans: [8000], loads: [G(0, 10), Q(0, 15)], defl: { brittle: true } });
beam('simple span, point loads, (6.10)', { sec: ub, spans: [7000], rule: '6.10', loads: [{ case: 'G', member: 0, type: 'point', P: 60e3, a: 2500 }, { case: 'Q', member: 0, type: 'point', P: 90e3, a: 4500 }] });
beam('two spans, pattern loading', { sec: I('406×178×54 UKB'), spans: [6000, 6000], loads: [G(0, 8), G(1, 8), Q(0, 12), Q(1, 12)] });
beam('three spans, intermediate restraints', { sec: I('356×171×45 UKB'), spans: [5000, 7000, 5000], loads: [0, 1, 2].flatMap(m => [G(m, 6), Q(m, 9)]),
  restraint: [{ mode: 'ends' }, { mode: 'points', pts: [2333, 4667] }, { mode: 'ends' }] });
beam('propped cantilever, partial and varying loads', { sec: ub, spans: [9000], endLeft: 'fixed', loads: [{ case: 'G', member: 0, type: 'pudl', w: 12, a: 1000, b: 6000 }, { case: 'Q', member: 0, type: 'vdl', w1: 5, w2: 20, a: 2000, b: 9000 }] });
beam('fixed both ends, applied moment', { sec: uc, spans: [6000], endLeft: 'fixed', endRight: 'fixed', loads: [G(0, 20), { case: 'Q', member: 0, type: 'moment', M: 40e6, a: 2000 }] });
beam('span with a right cantilever, free tip', { sec: ub, spans: [7000], cantR: 2500, loads: [G(0, 10), G(1, 10), Q(0, 10), Q(1, 10), { case: 'Q', member: 1, type: 'point', P: 20e3, a: 2500 }] });
beam('span with a left cantilever, tip restrained', { sec: ub, spans: [6000], cantL: 2000, tipRestrained: { L: true }, loads: [G(0, 12), G(1, 12), Q(0, 8), Q(1, 8)] });
beam('lone cantilever off a fixed support, destabilising', { sec: I('305×165×40 UKB'), spans: [], cantR: 3000, endLeft: 'fixed', destab: true, loads: [G(0, 5), { case: 'Q', member: 0, type: 'point', P: 15e3, a: 3000 }] });
beam('destabilising loads on a simple span', { sec: ub, spans: [8000], destab: true, loads: [G(0, 10), Q(0, 12)] });
beam('top flange restrained', { sec: ub, spans: [8000, 8000], restraint: [{ mode: 'top' }, { mode: 'top' }], loads: [G(0, 15), G(1, 15), Q(0, 20), Q(1, 20)] });
beam('horizontal loads: biaxial bending', { sec: uc, spans: [6000], loads: [G(0, 10), Q(0, 10), { case: 'Q', member: 0, type: 'udl', w: 3, dir: 'h' }] });
beam('horizontal point load on a cantilever beam', { sec: uc, spans: [5000], cantR: 1500, loads: [G(0, 8), G(1, 8), { case: 'Q', member: 0, type: 'point', P: 20e3, a: 2500, dir: 'h' }] });
beam('axial compression, Annex B', { sec: uc, spans: [6000], N: 600e3, loads: [G(0, 8), Q(0, 10)] });
beam('axial compression, Annex A', { sec: uc, spans: [6000], N: 600e3, annex: 'A', loads: [G(0, 8), Q(0, 10)] });
beam('axial compression, biaxial, Annex A', { sec: uc, spans: [6000], N: 400e3, annex: 'A', loads: [G(0, 8), Q(0, 10), { case: 'Q', member: 0, type: 'udl', w: 2, dir: 'h' }] });
beam('axial compression, cantilever, Annex A', { sec: uc, spans: [5000], cantR: 2000, N: 300e3, annex: 'A', loads: [G(0, 10), G(1, 10), Q(0, 10), Q(1, 10)] });
beam('axial compression, cantilever, Annex B', { sec: uc, spans: [5000], cantR: 2000, N: 300e3, loads: [G(0, 10), G(1, 10), Q(0, 10), Q(1, 10)] });
beam('axial compression, k_y 0.7, restraints', { sec: ub, spans: [8000], N: 200e3, ky: [0.7], restraint: [{ mode: 'points', pts: [4000] }], loads: [G(0, 10), Q(0, 10)] });
beam('axial tension with horizontal loads', { sec: uc, spans: [6000], N: -300e3, loads: [G(0, 10), { case: 'Q', member: 0, type: 'udl', w: 3, dir: 'h' }] });
beam('axial tension', { sec: ub, spans: [8000], N: -400e3, loads: [G(0, 10), Q(0, 10)] });
beam('PFC beam', { sec: U('260×90×35 PFC'), spans: [5000], loads: [G(0, 5), Q(0, 6)] });
beam('PFC with compression', { sec: U('300×100×46 PFC'), spans: [4000], N: 100e3, loads: [G(0, 5), Q(0, 6)] });
beam('RHS beam', { sec: EC3.rhs({ h: 250, b: 150, t: 8 }), spans: [6000], loads: [G(0, 8), Q(0, 10)] });
beam('SHS cold-formed with compression', { sec: EC3.rhs({ h: 200, b: 200, t: 6, cold: true }), spans: [5000], N: 300e3, loads: [G(0, 5), Q(0, 5)] });
beam('CHS beam', { sec: EC3.chs({ d: 219.1, t: 8 }), spans: [7000], loads: [G(0, 5), Q(0, 5)] });
beam('CHS with compression, Annex A', { sec: EC3.chs({ d: 273, t: 10 }), spans: [6000], N: 400e3, annex: 'A', loads: [G(0, 5), Q(0, 5)] });
beam('plate girder: web buckles in shear', { sec: EC3.customI({ name: 'PG 1500x400x10x25', h: 1500, b: 400, tw: 10, tf: 25 }), spans: [12000], loads: [G(0, 60), Q(0, 50)], restraint: [{ mode: 'points', pts: [3000, 6000, 9000] }] });
beam('welded I, Class 4 web, compression', { sec: EC3.customI({ name: 'WI 900x250x8x16', h: 900, b: 250, tw: 8, tf: 16 }), spans: [10000], N: 300e3, loads: [G(0, 10), Q(0, 15)] });
beam('web bearing at an end, c given', { sec: I('406×140×39 UKB'), spans: [3000], ssSupport: 60, cEnd: 20, ssPoint: 40, loads: [{ case: 'G', member: 0, type: 'point', P: 150e3, a: 1500 }, { case: 'Q', member: 0, type: 'point', P: 200e3, a: 1500 }] });
beam('point load near the end', { sec: I('356×171×45 UKB'), spans: [4000], loads: [{ case: 'G', member: 0, type: 'point', P: 200e3, a: 200 }] });
beam('historic UB, BS 15', { sec: hist('H-UB1962', 20), grade: 'BS15', spans: [6000], loads: [G(0, 10), Q(0, 10)] });
beam('historic, f_y given', { sec: hist('H-UB1962', 10), grade: 'GIVEN', fy: 230, spans: [5000, 5000], loads: [G(0, 10), G(1, 10), Q(0, 10), Q(1, 10)] });
beam('deflection: other beams, span/200', { sec: I('305×165×40 UKB'), spans: [7000], defl: { brittle: false }, loads: [G(0, 5), Q(0, 8)] });
beam('S460 heavy UKC', { sec: I('356×406×634 UKC'), grade: 'S460', spans: [10000], loads: [G(0, 60), Q(0, 80)] });
// ---------- random beams ----------
let seed = 1990; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
for (let t = 0; t < 40; t++) {
  const kind = pick(['UKB', 'UKB', 'UKC', 'PFC', 'RHS', 'CHS', 'welded']);
  let sec;
  if (kind === 'UKB' || kind === 'UKC') sec = EC3.fromRow(pick(SECTION_DATA.filter(r => r[0].endsWith(kind))));
  else if (kind === 'PFC') sec = EC3.fromRowPFC(pick(PFC_DATA));
  else if (kind === 'RHS') { const h = pick([150, 200, 250, 300]); sec = EC3.rhs({ h, b: pick([h, h / 2, 100]), t: pick([5, 6.3, 8, 10]), cold: rnd() < 0.3 }); }
  else if (kind === 'CHS') sec = EC3.chs({ d: pick([168.3, 219.1, 323.9]), t: pick([5, 6.3, 8, 10]) });
  else sec = EC3.customI({ name: 'WI', h: pick([400, 600, 900]), b: pick([200, 300]), tw: pick([6, 8, 10]), tf: pick([12, 16, 20]) });
  const ns = pick([1, 1, 2, 3]), spans = Array.from({ length: ns }, () => pick([3000, 5000, 7000])), cantR = rnd() < 0.25 ? pick([1000, 2000]) : 0, cantL = rnd() < 0.15 ? 1500 : 0;
  const nm = (cantL ? 1 : 0) + ns + (cantR ? 1 : 0), Lmax = Math.max(...spans);
  const w = Math.max(1, sec.Wply * 275 / (Lmax * Lmax / 8) * between(0.2, 0.8));
  const loads = [];
  for (let m = 0; m < nm; m++) { loads.push(G(m, w * 0.4)); if (rnd() < 0.8) loads.push(Q(m, w * 0.4)); }
  if (rnd() < 0.4) { const m = cantL ? 1 : 0; loads.push({ case: pick(['G', 'Q']), member: m, type: 'point', P: w * spans[0] * 0.3, a: spans[0] * between(0.2, 0.8) }); }
  if (rnd() < 0.2) loads.push({ case: 'Q', member: cantL ? 1 : 0, type: 'udl', w: w * 0.1, dir: 'h' });
  const restraint = Array.from({ length: nm }, (_, m) => { const L = m === 0 && cantL ? cantL : m === nm - 1 && cantR ? cantR : spans[m - (cantL ? 1 : 0)]; const r = rnd(); return r < 0.2 && !((m === 0 && cantL) || (m === nm - 1 && cantR)) ? { mode: 'top' } : r < 0.5 ? { mode: 'points', pts: [L / 2] } : { mode: 'ends' }; });
  const N = pick([0, 0, 0, 0.1, -0.1, 0.2]) * sec.A * 275;
  beam(`random ${t} ${sec.name}`, { sec, grade: pick(['S275', 'S355']), spans, cantL, cantR, loads, restraint, N, annex: pick(['B', 'B', 'A']), destab: rnd() < 0.2, rule: pick(['6.10', '6.10ab']),
    endLeft: cantL ? 'pinned' : pick(['pinned', 'pinned', 'fixed']), endRight: cantR ? 'pinned' : pick(['pinned', 'fixed']), tipRestrained: { L: rnd() < 0.3, R: rnd() < 0.3 }, defl: { brittle: rnd() < 0.5 } });
}
// ---------- the whole calculation as one CalcPad check ----------
{ const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
console.log(`${zones} parts of ${beams} beams; ${[...kinds].sort().join('; ')}`);
console.log(`\n${n - bad}/${n} Steel Beam values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
