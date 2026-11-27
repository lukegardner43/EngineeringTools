// Steel Beam Torsion: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part of the full calculation (the section and its sectorial properties; the ULS loads, their torques and the
// moments and shears by statics at the station where the yield criterion governs, the finite-element bimoment and torques
// there, the stresses and the yield criterion; the member check of BS EN 1993-6 Annex A; the twist at SLS) is pasted into
// CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the engine's own: UKB, UKC and PFC, simple spans
// and cantilevers, forks and fixed ends, UDLs, point loads and applied torques, restraints, destabilising loads, and random
// members. Every check of the tool must be in a part with its utilisation; no chip may show an error or a unit CalcPad cannot
// read; and the whole calculation must open in CalcPad as one check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Beam Torsion.html'), 'utf8');
const block = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.Torsion=Torsion;this.SECTION_DATA=SECTION_DATA;this.PFC_DATA=PFC_DATA;this.CalcScript=CalcScript;this.TorsionScript=TorsionScript;', sb);
const { EC3, Torsion, SECTION_DATA, PFC_DATA, CalcScript, TorsionScript } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, mems = 0;
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
const I = nm => EC3.fromRow(SECTION_DATA.find(r => r[0] === nm)), U = nm => EC3.fromRowPFC(PFC_DATA.find(r => r[0] === nm));
const KEY = { section: 'section-check', member: 'member', rotation: 'rotation' };
function member(tag, o) {
  const inp = { grade: 'S355', sys: 'ss', ends: ['fork', 'fork'], loadsQ: [], torquesG: [], torquesQ: [], gG: 1.35, gQ: 1.5, lateral: { restraints: [] }, rotLimitDeg: 2, ...o };
  let R; try { R = Torsion.design(inp); } catch (e) { console.log('engine refused', tag, e.message); return null; }
  let Z; try { Z = TorsionScript.zones(R, inp); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  mems++; kinds.add(`${inp.sec.shape} ${inp.sys} ${inp.ends.join('/')}`);
  for (const [k, g] of Object.entries(R.gov)) { if (!g) continue; n++; const z = Z.find(q => q.key === KEY[k]); if (!z || Math.abs(z.util - g.util) > 1e-12 * Math.max(1, g.util)) { bad++; console.log('MISSING', tag, k, z && z.util, g.util); } }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /not satisfied/i.test(it.text)); n++;
    if (zn.util != null && (isFinite(zn.util) ? Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util) : !said)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  return Z;
}
const ub = I('457×191×67 UKB'), uc = I('254×254×73 UKC');
// ---------- set members ----------
const Z0 = member('the page default: UKB span, eccentric UDL', { sec: ub, L: 6000, loadsG: [{ type: 'udl', w: 10, e: 75 }], loadsQ: [{ type: 'udl', w: 8, e: 75 }] });
member('UKC, point load off the web, restraint at mid-span', { sec: uc, L: 5000, loadsG: [{ type: 'udl', w: 5, e: 0 }], loadsQ: [{ type: 'point', P: 60e3, a: 2000, e: 100 }], lateral: { restraints: [2500] } });
member('UKB, fixed ends for torsion', { sec: ub, L: 8000, ends: ['fixed', 'fixed'], loadsG: [{ type: 'udl', w: 12, e: 50 }], loadsQ: [{ type: 'udl', w: 10, e: 50 }] });
member('UKB, applied torques', { sec: I('406×178×60 UKB'), L: 6000, loadsG: [{ type: 'udl', w: 6, e: 0 }], torquesG: [{ x: 3000, T: 5e6 }], torquesQ: [{ x: 1500, T: 3e6 }] });
member('PFC span, eccentric UDL', { sec: U('300×100×46 PFC'), L: 5000, loadsG: [{ type: 'udl', w: 8, e: 60 }], loadsQ: [{ type: 'udl', w: 6, e: 60 }] });
member('PFC, point load', { sec: U('260×90×35 PFC'), L: 4000, loadsG: [{ type: 'point', P: 30e3, a: 2000, e: 80 }] });
member('cantilever, fixed root, tip load', { sec: uc, L: 2000, sys: 'cant', ends: ['fixed', 'free'], loadsG: [{ type: 'point', P: 20e3, a: 2000, e: 100 }], loadsQ: [{ type: 'udl', w: 3, e: 50 }] });
member('cantilever, tip restrained laterally', { sec: ub, L: 2500, sys: 'cant', ends: ['fixed', 'free'], loadsG: [{ type: 'udl', w: 10, e: 40 }], lateral: { restraints: [], tipRestrained: true } });
member('destabilising load', { sec: ub, L: 7000, loadsG: [{ type: 'udl', w: 10, e: 75 }], loadsQ: [{ type: 'udl', w: 10, e: 75 }], lateral: { restraints: [], destab: true } });
member('two restraints, fork and fixed', { sec: I('533×210×92 UKB'), L: 9000, ends: ['fork', 'fixed'], loadsG: [{ type: 'udl', w: 15, e: 100 }], loadsQ: [{ type: 'point', P: 50e3, a: 6000, e: 100 }], lateral: { restraints: [3000, 6000] } });
// ---------- random members ----------
let seed = 385; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
for (let t = 0; t < 25; t++) {
  const pfc = rnd() < 0.3, sec = pfc ? EC3.fromRowPFC(pick(PFC_DATA)) : EC3.fromRow(pick(SECTION_DATA.filter(r => /UK[BC]$/.test(r[0]))));
  const cant = rnd() < 0.2, L = cant ? pick([1500, 2500]) : pick([3000, 5000, 7000]), w = sec.Wply * 275 / (L * L / (cant ? 2 : 8)) * between(0.1, 0.4);
  const loadsG = [{ type: 'udl', w: w * 0.5, e: pick([0, 25, 50, 100]) }], loadsQ = rnd() < 0.7 ? [{ type: 'udl', w: w * 0.4, e: pick([0, 50, 100]) }] : [];
  if (rnd() < 0.4) loadsQ.push({ type: 'point', P: w * L * 0.2, a: L * between(0.2, 1), e: pick([50, 100, 150]) });
  member(`random ${t} ${sec.name}`, { sec, grade: pick(['S275', 'S355']), L, sys: cant ? 'cant' : 'ss', ends: cant ? ['fixed', 'free'] : [pick(['fork', 'fork', 'fixed']), pick(['fork', 'fixed'])], loadsG, loadsQ,
    torquesG: rnd() < 0.2 ? [{ x: L / 2, T: between(1, 5) * 1e6 }] : [], lateral: { restraints: !cant && rnd() < 0.4 ? [L / 2] : [], destab: rnd() < 0.3, tipRestrained: cant && rnd() < 0.5 }, rotLimitDeg: pick([1, 2, 3]) });
}
// ---------- the whole calculation as one CalcPad check ----------
{ const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
console.log(`${zones} parts of ${mems} members; ${[...kinds].sort().join('; ')}`);
console.log(`\n${n - bad}/${n} Steel Torsion values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
