// Floor Vibration: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// The mass, the slab and beam stiffnesses with the dynamic modulus, the deflections and frequencies of both modes, the
// modal mass and the response to walking are pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out
// must be the engine's own: the four reference floors (composite and steel primaries, a walking path), low- and
// high-frequency floors, a given slab stiffness, and random floors. The tool's utilisation must be the part's; no chip may
// show an error or a unit CalcPad cannot read; and the whole calculation must open in CalcPad as one check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Floor Vibration.html'), 'utf8');
const block = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.Vibration=Vibration;this.SECTION_DATA=SECTION_DATA;this.CalcScript=CalcScript;this.VibrationScript=VibrationScript;', sb);
const { EC3, Vibration, SECTION_DATA, CalcScript, VibrationScript } = sb;
const REF = require('./ref_vibration.json');
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, floors = 0;
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
const sec = name => EC3.fromRow(SECTION_DATA.find(r => r[0] === name));
const inp = c => ({ Ly: c.Ly, b: c.b, Lx: c.Lx, ny: c.ny, nx: c.nx, sec: sec(c.sec), prim: sec(c.prim), primComp: c.primComp, slab: { hs: c.hs, hp: c.hp, b0: c.b0, rib: c.rib, fck: c.fck, sw: c.sw, Is: c.Is || 0 },
  sdl: c.sdl, q: c.q, qFrac: 0.1, zeta: c.zeta, mue: c.mue, mur: c.mur, fp: c.fp, Lp: c.Lp, cutoff: c.cutoff, Rlim: c.Rlim || 8, fmin: c.fmin || 3 });
function floor(tag, c) {
  const i = inp(c);
  let R; try { R = Vibration.design(i); } catch (e) { console.log('engine refused', tag, e.message); return null; }
  let Z; try { Z = VibrationScript.zones(R, i); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  floors++; kinds.add(`${R.low ? 'low' : 'high'}-frequency${R.fA <= R.fB ? ' secondary mode' : ' primary mode'}${i.Lp > 0 ? ' path' : ''}`);
  for (const zn of Z) {
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v); n++;
    if (Math.abs(Math.max(...u) - zn.util) > 1e-9 * Math.max(1, zn.util) || Math.abs(zn.util - R.utilMax) > 1e-12) { bad++; console.log('UTIL', tag, u, zn.util, R.utilMax); }
    check(tag, zn.C, H.text(zn.C.calcpad()));
  }
  return Z;
}
let Z0 = null;
for (const [k, { input }] of Object.entries(REF)) { const z = floor(k, input); Z0 = Z0 || z; }
floor('a given slab stiffness', { ...REF.office_9x9.input, Is: 9.5e5 });
floor('one bay each way, a steel primary', { ...REF.office_9x9.input, ny: 1, nx: 1, primComp: false });
let seed = 354; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
const UKB = SECTION_DATA.filter(r => /^(305|356|406|457|533|610|686)×.*UKB$/.test(r[0])).map(r => r[0]);
for (let t = 0; t < 30; t++) {
  const Ly = pick([6000, 7500, 9000, 12000]), b = pick([2500, 3000, 3750]), Lx = b * pick([2, 3, 4]);
  floor(`random ${t}`, { Ly, b, Lx, ny: pick([1, 2, 3, 4]), nx: pick([1, 2, 3, 4]), sec: pick(UKB), prim: pick(UKB), primComp: rnd() < 0.7, hs: pick([120, 130, 150]), hp: pick([50, 60, 80]), b0: pick([120, 150]), rib: pick([300, 333]),
    fck: pick([25, 30, 35]), sw: between(2, 3.5), sdl: between(0.5, 1.5), q: pick([2.5, 3.5, 5]), zeta: pick([0.011, 0.03, 0.045]), mue: between(0.6, 1), mur: between(0.6, 1), fp: between(1.8, 2.2), Lp: rnd() < 0.4 ? pick([5, 10, 20]) : 0, cutoff: pick([9, 10]), Rlim: pick([4, 8]), fmin: pick([3, 4]) });
}
{ const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
console.log(`${floors} floors; ${[...kinds].sort().join('; ')}`);
console.log(`\n${n - bad}/${n} Floor Vibration values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
