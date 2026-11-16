// Beam Web Openings: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part of the full calculation (the beam's gross checks, steel or composite; each opening with its Tees, shear,
// bending, Vierendeel bending, the compression Tee over a long opening and the Vierendeel deflection; each web-post; the
// construction stage of an unpropped composite beam; the deflections with the openings) is pasted into CalcPad (headless,
// tests/calcpad) and every value CalcPad works out must be the engine's own: the reference steel and composite beams,
// circular, rectangular and elongated openings, eccentric openings, point loads, and random beams. Every check of the tool
// must appear in the calculation with its value; no chip may show an error or a unit CalcPad cannot read; and the whole
// calculation must open in CalcPad as one check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Beam Web Openings.html'), 'utf8');
const block = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.Openings=Openings;this.SECTION_DATA=SECTION_DATA;this.CalcScript=CalcScript;this.WebOpeningsScript=WebOpeningsScript;', sb);
const { EC3, Openings, SECTION_DATA, CalcScript, WebOpeningsScript } = sb;
const REF = require('./ref_webopen.json'), CREF = require('../composite/ref_composite.json');
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
const sec = nm => EC3.fromRow(SECTION_DATA.find(r => r[0] === nm));
function beam(tag, inp) {
  let R; try { R = Openings.design(inp); } catch (e) { console.log('engine refused', tag, e.message); return null; }
  let Z; try { Z = WebOpeningsScript.zones(R, inp); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  beams++; kinds.add(`${inp.mode}${R.cons ? ' + construction' : ''} ${[...new Set(inp.openings.map(o => o.shape))].join('/')}${R.posts.length ? ' posts' : ''}`);
  const all = Z.flatMap(z => z.C.items.filter(it => it.t === 'chk').map(it => it.v));
  for (const c of R.checks) { n++; if (isFinite(c.util) && !all.some(v => Math.abs(v - c.util) <= 1e-9 * Math.max(1, c.util))) { bad++; console.log('MISSING', tag, c.k, c.nm, c.util); } }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /not satisfied/i.test(it.text)); n++;
    if (zn.util != null && (isFinite(zn.util) ? Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util) : !said)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; const um = Math.max(...Z.map(z => z.util ?? 0)); if (!(um === R.utilMax || Math.abs(um - R.utilMax) <= 1e-9 * Math.max(1, R.utilMax))) { bad++; console.log('TOOL UTIL', tag, um, R.utilMax); }
  return Z;
}
// ---------- the reference beams ----------
const I = REF.steel.input, ci = CREF.perp_single.input;
const Z0 = beam('reference steel beam', { mode: 'steel', s: sec(I.section), grade: 'S355', L: I.L, steel: { gk: I.gk, qk: I.qk, points: I.points.map(p => ({ ...p })), gG: 1.35, gQ: 1.5, deflQ: 360, deflT: 250 }, openings: I.ops });
beam('reference composite beam, unpropped', { mode: 'comp', s: sec(ci.section), grade: 'S355', L: ci.L, comp: { ...ci, s: sec(ci.section) }, openings: REF.comp.input.ops });
beam('reference composite beam, propped', { mode: 'comp', s: sec(ci.section), grade: 'S355', L: ci.L, comp: { ...ci, s: sec(ci.section), propped: true }, openings: REF.comp.input.ops });
const s457 = sec('457×191×67 UKB'), st = { gk: 10, qk: 12, points: [], gG: 1.35, gQ: 1.5, deflQ: 360, deflT: 250 };
beam('one circular opening', { mode: 'steel', s: s457, grade: 'S355', L: 9000, steel: st, openings: [{ shape: 'circ', x: 2500, h0: 300, lo: 300, e0: 0 }] });
beam('eccentric rectangular openings in a row', { mode: 'steel', s: s457, grade: 'S355', L: 9000, steel: st, openings: [{ shape: 'rect', x: 2000, h0: 250, lo: 500, e0: 30 }, { shape: 'rect', x: 2900, h0: 250, lo: 500, e0: -20 }] });
beam('elongated opening with a point load', { mode: 'steel', s: sec('533×210×92 UKB'), grade: 'S275', L: 10000, steel: { ...st, points: [{ x: 7000, G: 40, Q: 30 }] }, openings: [{ shape: 'elong', x: 3000, h0: 300, lo: 600, e0: 0 }] });
// ---------- random beams ----------
let seed = 355; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
for (let t = 0; t < 20; t++) {
  const s = EC3.fromRow(pick(SECTION_DATA.filter(r => /^(406|457|533|610)×.*UKB$/.test(r[0])))), L = pick([7000, 9000, 12000]), n = pick([1, 2, 3]);
  const shape = pick(['circ', 'rect', 'elong']), h0 = Math.round(s.h * between(0.4, 0.65) / 10) * 10, lo = shape === 'circ' ? h0 : Math.round(h0 * between(1, 2) / 10) * 10, gap = pick([0.5, 1, 1.5]) * lo;
  const x0 = L * between(0.15, 0.3), ops = Array.from({ length: n }, (_, i) => ({ shape, x: x0 + i * (lo + gap), h0, lo, e0: pick([0, 0, 20, -20]) }));
  const comp = rnd() < 0.4;
  const inp = comp ? { mode: 'comp', s, grade: 'S355', L, comp: { ...ci, s, L, propped: rnd() < 0.3 }, openings: ops }
    : { mode: 'steel', s, grade: pick(['S275', 'S355']), L, steel: { gk: between(5, 20), qk: between(5, 20), points: [], gG: 1.35, gQ: 1.5, deflQ: 360, deflT: 250 }, openings: ops };
  if (!comp) inp.grade = inp.grade;
  beam(`random ${t} ${s.name}`, inp);
}
// ---------- the whole calculation as one CalcPad check ----------
{ const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
console.log(`${zones} parts of ${beams} beams; ${[...kinds].sort().join('; ')}`);
console.log(`\n${n - bad}/${n} Web Opening values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
