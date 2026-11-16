// Composite Beam Design: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part of the full calculation (the beam, slab, effective width and loads; the construction stage; the studs and the
// degree of shear connection; the plastic resistance by stress blocks with the neutral axis in the slab, the flange, the
// root fillet or the web, and the vertical shear; the longitudinal shear in the slab; the deflections and the frequency) is
// pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the engine's own: the reference
// cases (decking perpendicular with one and two studs, an edge beam with alternate troughs, a propped solid slab, decking
// parallel) and random beams. Every check of the tool must be in a part with its utilisation; no chip may show an error or a
// unit CalcPad cannot read; and the whole calculation must open in CalcPad as one check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Composite Beam Design.html'), 'utf8');
const block = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.Composite=Composite;this.SECTION_DATA=SECTION_DATA;this.CalcScript=CalcScript;this.CompositeScript=CompositeScript;', sb);
const { EC3, Composite, SECTION_DATA, CalcScript, CompositeScript } = sb;
const REF = require('./ref_composite.json');
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
const KEY = { c1: 'construction', c2: 'construction', m: 'bending', v: 'bending', eta: 'connection', tr: 'slabshear', cr: 'slabshear', dq: 'sls', dt: 'sls', f: 'sls' };
function beam(tag, c) {
  const inp = { ...c, s: EC3.fromRow(SECTION_DATA.find(r => r[0] === c.section)) };
  let R; try { R = Composite.design(inp); } catch (e) { console.log('engine refused', tag, e.message); return null; }
  let Z; try { Z = CompositeScript.zones(R, inp); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  beams++; kinds.add(`${inp.slab.deck}${inp.propped ? ' propped' : ''}${R.eta < 1 ? ' partial' : ' full'} PNA ${(R.eta < 1 ? R.part : R.full).pnaIn}`);
  for (const k of R.checks) { n++; const z = Z.find(q => q.key === KEY[k.k]); if (!z || (isFinite(k.util) && z.util < k.util - 1e-12)) { bad++; console.log('MISSING', tag, k.k, z && z.util, k.util); } }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /not satisfied/i.test(it.text)); n++;
    if (zn.util != null && (isFinite(zn.util) ? Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util) : !said)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; const um = Math.max(...Z.map(z => z.util ?? 0)); if (!(um === R.utilMax || Math.abs(um - R.utilMax) <= 1e-9 * Math.max(1, R.utilMax))) { bad++; console.log('TOOL UTIL', tag, um, R.utilMax); }
  return Z;
}
// ---------- the reference cases ----------
let Z0 = null;
for (const [k, c] of Object.entries(REF)) if (c.input) { const z = beam(k, c.input); Z0 = Z0 || z; }
// ---------- random beams ----------
let seed = 359; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
const base = REF.perp_single.input;
for (let t = 0; t < 30; t++) {
  const deck = pick(['perp', 'perp', 'para', 'none']), hs = pick([120, 130, 150, 200]), hp = deck === 'none' ? 0 : pick([50, 60, 80]);
  const c = JSON.parse(JSON.stringify(base));
  Object.assign(c, { section: pick(SECTION_DATA.filter(r => /^(254|305|356|406|457|533|610)×.*UKB$/.test(r[0])))[0],
    grade: pick(['S275', 'S355']), L: pick([6000, 7500, 9000, 12000]), bL: pick([0, 2500, 3000, 3750]), bR: pick([2500, 3000, 3750]), propped: rnd() < 0.2 });
  Object.assign(c.slab, { hs, hp, deck, b0: pick([120, 150, 160]), rib: pick([300, 333]), t: pick([0.9, 1.0, 1.2]), fck: pick([25, 30, 35]), Ast: pick([0, 193, 283, 393]), continuous: rnd() < 0.6, sw: rnd() < 0.5 ? 0 : between(2, 4) });
  Object.assign(c.studs, { nr: pick([1, 1, 2]), every: pick([1, 1, 2]), spacing: pick([150, 200, 300]) });
  Object.assign(c.loads, { q: pick([2.5, 3.5, 5]), qPart: pick([0, 0.8, 1]) });
  beam(`random ${t} ${c.section}`, c);
}
// ---------- the whole calculation as one CalcPad check ----------
{ const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
console.log(`${zones} parts of ${beams} beams; ${[...kinds].sort().join('; ')}`);
console.log(`\n${n - bad}/${n} Composite values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
