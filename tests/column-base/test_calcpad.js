// Steel Column Design: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part of the full calculation (the characteristic actions and the combinations; for each combination that governs a
// check, its design actions from the loads, the nominal eccentricities and the self-weight, then the member checks as Steel
// Member Design writes them, and the NCCI SN048b criterion where it is within its scope) is pasted into CalcPad (headless,
// tests/calcpad) and every value CalcPad works out must be the engine's own: set columns (simple construction with nominal
// moments about both axes, wind both ways, a UDL up the column, end moments, a column in tension, UKB and UKC, Annex A and
// B, restraints) and random columns. Every check of the tool must be in a part with its utilisation; no chip may show an
// error or a unit CalcPad cannot read; and the whole calculation must open in CalcPad as one check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Column Design.html'), 'utf8');
const block = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.ColumnBase=ColumnBase;this.SECTION_DATA=SECTION_DATA;this.CalcScript=CalcScript;this.SteelColumnScript=SteelColumnScript;', sb);
const { EC3, ColumnBase, SECTION_DATA, CalcScript, SteelColumnScript } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, cols = 0;
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
const zoneOf = (Z, R, k, g) => { const id = g.r.combo.id, kk = k.replace(/^m:/, '');
  return ['bending', 'shear', 'axial'].includes(kk) ? Z.find(z => z.key.startsWith(id + '-cs') && z.checks && z.checks.includes(kk)) : Z.find(z => z.key === `${id}-${kk}`); };
const sec = nm => EC3.fromRow(SECTION_DATA.find(r => r[0] === nm));
const kn = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v * ({ MyT: 1e6, MyB: 1e6, MzT: 1e6, MzB: 1e6, w: 1 }[k] || 1e3)]));
const base = { grade: 'S355', L: 4500, ky: 1, kz: 1, nLT: 1, annex: 'B', simple: true, share: 1, rule: '6.10ab', psiQ: 0.7, windBoth: true, base: null };
function column(tag, o) {
  const inp = { ...base, ...o, cases: Object.fromEntries(Object.entries(o.cases).map(([c, v]) => [c, kn(v)])) };
  let R; try { R = ColumnBase.design(inp); } catch (e) { return null; }
  let Z; try { Z = SteelColumnScript.zones(R, inp); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  cols++; kinds.add(`${inp.sec.name.split(' ').pop()}${R.gov.sn048 ? ' SN048b' : ''}${R.gov['m:interaction'] ? ' annex ' + inp.annex : ''}`);
  for (const [k, g] of Object.entries(R.gov)) {
    n++; const z = zoneOf(Z, R, k, g);
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
// ---------- set columns ----------
const Z0 = column('the page default: simple construction, G Q W', { sec: sec('254×254×73 UKC'), cases: { G: { N: 450, Ry1: 60, Ry2: 25, Rz1: 20 }, Q: { N: 300, Ry1: 45, Ry2: 15, Rz1: 15 }, W: { H: 12 } } });
column('Annex A, nominal moments both ways', { sec: sec('203×203×46 UKC'), annex: 'A', cases: { G: { N: 300, Ry1: 50, Ry2: 10, Rz1: 15, Rz2: 5 }, Q: { N: 200, Ry1: 40, Rz1: 12 } } });
column('(6.10), wind as entered only', { sec: sec('254×254×89 UKC'), rule: '6.10', windBoth: false, cases: { G: { N: 600, Ry1: 80 }, Q: { N: 400, Ry1: 60 }, W: { MyT: 15, MyB: -10 } } });
column('UDL up the column (wind on the face)', { sec: sec('305×305×97 UKC'), L: 6000, cases: { G: { N: 500, Ry1: 40 }, Q: { N: 250 }, W: { w: 6 } } });
column('UDL, Annex A', { sec: sec('305×305×97 UKC'), L: 6000, annex: 'A', cases: { G: { N: 500, Ry1: 40 }, Q: { N: 250 }, W: { w: 6 } } });
column('end moments, continuous construction (share 0)', { sec: sec('254×254×107 UKC'), simple: false, cases: { G: { N: 700, MyT: 60, MyB: -30 }, Q: { N: 350, MyT: 40, MyB: -20, MzT: 5 } } });
column('half the nominal moments to this length', { sec: sec('203×203×60 UKC'), share: 0.5, nLT: 2, cases: { G: { N: 400, Ry1: 70, Ry2: 20 }, Q: { N: 250, Ry1: 55, Ry2: 10 } } });
column('two restraints, k 0.85', { sec: sec('356×368×129 UKC'), L: 8000, ky: 0.85, kz: 0.85, nLT: 3, cases: { G: { N: 1500, Ry1: 120, Ry2: 100, Rz1: 40 }, Q: { N: 900, Ry1: 90, Rz1: 30 } } });
column('a UKB column', { sec: sec('406×178×60 UKB'), cases: { G: { N: 200, Ry1: 60 }, Q: { N: 100, Ry1: 50 } } });
column('a column in tension under wind uplift', { sec: sec('152×152×23 UKC'), cases: { G: { N: 20 }, W: { N: -150, H: 5 } } });
column('Class 4 not possible for UKC: S460 slender', { sec: sec('152×152×30 UKC'), grade: 'S460', L: 3000, cases: { G: { N: 400, Ry1: 30 }, Q: { N: 200 } } });
column('minor-axis end moments only', { sec: sec('203×203×46 UKC'), simple: false, cases: { G: { N: 300, MzT: 8, MzB: -4 } } });
column('wind moments, Annex A', { sec: sec('254×254×73 UKC'), annex: 'A', cases: { G: { N: 400, Ry1: 50 }, Q: { N: 200, Ry1: 40 }, W: { MyT: 20, MyB: 20, H: 8 } } });
// ---------- random columns ----------
let seed = 4321; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
for (let t = 0; t < 30; t++) {
  const s = EC3.fromRow(pick(SECTION_DATA.filter(r => /UK[BC]$/.test(r[0])))), cap = s.A * 275 / 1e3;
  const G = { N: cap * between(0.05, 0.3), Ry1: cap * between(0, 0.05), Ry2: rnd() < 0.5 ? cap * between(0, 0.03) : 0, Rz1: rnd() < 0.5 ? cap * between(0, 0.02) : 0 };
  const Q = rnd() < 0.8 ? { N: cap * between(0.02, 0.2), Ry1: cap * between(0, 0.04) } : {};
  const W = rnd() < 0.5 ? (rnd() < 0.5 ? { w: between(1, 8) } : { MyT: between(-20, 20), H: between(0, 10) }) : {};
  if (rnd() < 0.2) G.MyB = between(-20, 20);
  column(`random ${t} ${s.name}`, { sec: s, grade: pick(['S275', 'S355']), L: pick([3000, 4500, 6000]), ky: pick([0.85, 1]), kz: pick([0.85, 1]), nLT: pick([1, 1, 2]), annex: pick(['A', 'B']),
    simple: rnd() < 0.8, share: pick([1, 0.5]), rule: pick(['6.10', '6.10ab']), windBoth: rnd() < 0.7, cases: { G, Q, W } });
}
// ---------- the whole calculation as one CalcPad check ----------
{ const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
console.log(`${zones} parts of ${cols} columns; ${[...kinds].sort().join('; ')}`);
console.log(`\n${n - bad}/${n} Steel Column values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
