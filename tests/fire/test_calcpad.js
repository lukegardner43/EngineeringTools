// Steel Member Fire Design: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part of the full calculation (the section factors and k_sh, the standard fire and the steel temperature at the
// period; the resistance in fire at that temperature: Table 3.1 interpolated, the class in fire, a restrained beam, an
// unrestrained beam, a member in compression with or without bending; the same at 20 °C, μ₀ and the critical temperature)
// is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the engine's own: set members
// of each type, I and hollow sections, three and four sides, unprotected and protected with boards and spray, and random
// members. Every check of the tool must be in a part with its utilisation; no chip may show an error or a unit CalcPad
// cannot read; and the whole calculation must open in CalcPad as one check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Member Fire Design.html'), 'utf8');
const block = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.Fire=Fire;this.SECTION_DATA=SECTION_DATA;this.CalcScript=CalcScript;this.SteelFireScript=SteelFireScript;', sb);
const { EC3, Fire, SECTION_DATA, CalcScript, SteelFireScript } = sb;
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
}
const sec = nm => EC3.fromRow(SECTION_DATA.find(r => r[0] === nm));
// the page's input (Steel Member Fire Design.html): M_cr from the segment length and C_1 for an unrestrained beam or a column with bending
function member(tag, o) {
  if (o.Lseg) o.Mcr = (o.C1 || 1) * EC3.mcrUniform(o.s, o.Lseg * 1000);
  let R; try { R = Fire.design(o); } catch (e) { console.log('engine refused', tag, e.message); return null; }
  let Z; try { Z = SteelFireScript.zones(R, o); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  mems++; kinds.add(`${o.type} ${o.s.shape} ${o.prot ? o.prot.type : 'unprotected'}`);
  const zf = Z.find(z => z.key === 'fire'); n++;
  if (!zf || Math.abs(zf.util - R.util) > 1e-12 * Math.max(1, R.util)) { bad++; console.log('MISSING', tag, zf && zf.util, R.util); }
  const zc = Z.find(z => z.key === 'cold'); n++;
  if (!zc || zc.util < R.cold.util - 1e-12) { bad++; console.log('MISSING cold', tag); }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v); n++;
    if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  return Z;
}
const ub = sec('457×191×67 UKB'), uc = sec('254×254×73 UKC'), board = (dp = 20) => ({ type: 'board', dp, lp: 0.15, cp: 1200, rhop: 800 }), spray = (dp = 15) => ({ type: 'spray', dp, lp: 0.12, cp: 1100, rhop: 550 });
// ---------- set members ----------
const Z0 = member('restrained beam, unprotected, R30', { s: ub, grade: 'S355', type: 'beamR', kappa: 0.7, Ed: { N: 0, M: 150e6 }, sides: 3, period: 30, prot: null });
member('restrained beam, boards, R60', { s: ub, grade: 'S355', type: 'beamR', kappa: 0.7 * 0.85, Ed: { N: 0, M: 200e6 }, sides: 3, period: 60, prot: board(20) });
member('restrained beam, spray, four sides, R90', { s: sec('406×178×60 UKB'), grade: 'S275', type: 'beamR', kappa: 1, Ed: { N: 0, M: 100e6 }, sides: 4, period: 90, prot: spray(25) });
member('unrestrained beam, boards, R60', { s: ub, grade: 'S355', type: 'beamU', kappa: 1, Ed: { N: 0, M: 120e6 }, sides: 4, period: 60, prot: board(25), Lseg: 4, C1: 1.13 });
member('unrestrained beam, unprotected, R15', { s: sec('305×165×40 UKB'), grade: 'S355', type: 'beamU', kappa: 1, Ed: { N: 0, M: 40e6 }, sides: 4, period: 15, prot: null, Lseg: 3, C1: 1 });
member('column, boards, R60', { s: uc, grade: 'S355', type: 'column', kappa: 1, Ed: { N: 900e3, M: 0 }, sides: 4, period: 60, prot: board(20), Lcr: { y: 2800, z: 2800 } });
member('column with bending, spray, R60', { s: uc, grade: 'S355', type: 'column', kappa: 1, Ed: { N: 600e3, M: 30e6 }, sides: 4, period: 60, prot: spray(20), Lcr: { y: 3500, z: 3500 }, psi: 0, Lseg: 3.5, C1: 1.77 });
member('column with bending, unprotected, R30', { s: sec('203×203×46 UKC'), grade: 'S275', type: 'column', kappa: 1, Ed: { N: 200e3, M: 10e6 }, sides: 4, period: 30, prot: null, Lcr: { y: 3000, z: 3000 }, psi: 1, Lseg: 3, C1: 1 });
member('SHS column, boards, R60', { s: EC3.rhs({ h: 200, b: 200, t: 10 }), grade: 'S355', type: 'column', kappa: 1, Ed: { N: 500e3, M: 0 }, sides: 4, period: 60, prot: board(20), Lcr: { y: 3000, z: 3000 } });
member('RHS beam, three sides, unprotected', { s: EC3.rhs({ h: 300, b: 200, t: 10 }), grade: 'S355', type: 'beamR', kappa: 1, Ed: { N: 0, M: 60e6 }, sides: 3, period: 30, prot: null });
member('CHS column, spray, R30', { s: EC3.chs({ d: 219.1, t: 8 }), grade: 'S355', type: 'column', kappa: 1, Ed: { N: 300e3, M: 0 }, sides: 4, period: 30, prot: spray(10), Lcr: { y: 3000, z: 3000 } });
member('CHS column with bending, unprotected', { s: EC3.chs({ d: 273, t: 10 }), grade: 'S355', type: 'column', kappa: 1, Ed: { N: 200e3, M: 20e6 }, sides: 4, period: 15, prot: null, Lcr: { y: 3000, z: 3000 }, psi: 0.5, Lseg: 3, C1: 1 });
member('long period, the steel at 1199 °C', { s: sec('203×133×25 UKB'), grade: 'S275', type: 'beamR', kappa: 1, Ed: { N: 0, M: 5e6 }, sides: 4, period: 240, prot: null });
// ---------- random members ----------
let seed = 834; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
for (let t = 0; t < 30; t++) {
  const type = pick(['beamR', 'beamU', 'column', 'column']);
  const s = type === 'column' ? (rnd() < 0.8 ? EC3.fromRow(pick(SECTION_DATA.filter(r => /UKC$/.test(r[0])))) : EC3.rhs({ h: pick([150, 200, 250]), b: pick([150, 200]), t: pick([8, 10, 12.5]) })) : EC3.fromRow(pick(SECTION_DATA.filter(r => /UKB$/.test(r[0]))));
  const fy = 355, M = type === 'column' ? (rnd() < 0.5 ? between(0.02, 0.15) * s.Wply * fy : 0) : between(0.1, 0.5) * s.Wply * fy, N = type === 'column' ? between(0.1, 0.4) * s.A * fy : 0;
  const L = pick([2.5, 3, 4, 5]);
  const o = { s, grade: pick(['S275', 'S355']), type, kappa: type === 'beamR' ? pick([0.7, 0.85, 1]) : 1, Ed: { N, M }, sides: type === 'column' ? 4 : pick([3, 4]), period: pick([15, 30, 60, 90, 120]),
    prot: rnd() < 0.3 ? null : rnd() < 0.5 ? board(pick([10, 15, 20, 30])) : spray(pick([8, 12, 20])) };
  if (type === 'column') { o.Lcr = { y: L * 1000, z: L * 1000 * pick([0.5, 0.7, 1]) }; o.psi = pick([-1, 0, 0.5, 1]); }
  if (type === 'beamU' || (type === 'column' && M > 0)) { o.Lseg = L; o.C1 = pick([1, 1.13, 1.35, 1.77]); }
  member(`random ${t} ${s.name}`, o);
}
// ---------- the whole calculation as one CalcPad check ----------
{ const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
console.log(`${zones} parts of ${mems} members; ${[...kinds].sort().join('; ')}`);
console.log(`\n${n - bad}/${n} Steel Fire values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
