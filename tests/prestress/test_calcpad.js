// Prestressed Beam Design: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part of the full calculation (the section's stack and properties; the materials, creep and shrinkage by Annex B; the
// prestress at mid-span, its release and losses; the stresses where each limit governs; the tendon stresses and the
// deflections; ULS bending by strain compatibility; shear; lateral stability and the end block) is pasted into CalcPad
// (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: the cases of tests/prestress (Mosley,
// Bungey and Hulse example 11.8, a pretensioned double-tee with debonding, a post-tensioned I beam with friction, draw-in
// and an end block) with variations, and random beams. Every check of the tool must be in a part with its utilisation;
// no chip may show an error or a unit CalcPad cannot read; and the CalcPad project of a beam must open part by part.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Prestressed Beam Design.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.PSC = PSC; this.CalcScript = CalcScript; this.PSCScript = PSCScript;', sb);
const { PSC, CalcScript, PSCScript } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, beams = 0;
const kinds = new Set();
function check(tag, C, P) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + (/^N_res(_\d+)*$/.test(it.name) ? 1e-2 : 1e-9);
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
}
const ZONE = { tc: 'stress', tt: 'stress', sc: 'stress', sq: 'stress', st: 'stress', dec: 'stress', sj: 'tendon', s0: 'tendon', sp: 'tendon', d1: 'tendon', d2: 'tendon', mu: 'uls', vl: 'shear', vs: 'shear', vc: 'shear', vm: 'shear', ft: 'shear', lt: 'other', eb1: 'other', eb2: 'other' };
function beam(tag, inp) {
  let R; try { R = PSC.design(inp); } catch (e) { return null; }
  let Z; try { Z = PSCScript.zones(R); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  beams++; R.checks.forEach(k => kinds.add(k.id)); kinds.add(R.inp?.pre?.kind || inp.pre.kind);
  for (const k of R.checks) { n++; const z = Z.find(zn => zn.key === ZONE[k.id]); if (!z || (isFinite(k.util) && z.util < k.util - 1e-12)) { bad++; console.log('MISSING', tag, k.id, z && z.util, k.util); } }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /not satisfied/.test(it.text)); n++;
    if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util) && !(said && zn.util > Math.max(0, ...u))) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    if (zn.util != null && !isFinite(zn.util) && !said) { bad++; console.log('INFINITE UTIL WITHOUT A NOTE', tag, zn.key); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; const um = Math.max(...Z.map(z => z.util ?? 0)); if (!(um === R.util || Math.abs(um - R.util) <= 1e-9 * Math.max(1, R.util))) { bad++; console.log('TOOL UTIL', tag, um, R.util); }
  return Z;
}
const ex118 = (over = {}) => ({ sec: { type: 'rect', b: 200, h: 350 }, L: 10000, lb: 0, loads: { rho: 25, g2: 2, q: 1, psi0: 0.7, psi1: 0.5, psi2: 0.3 },
  conc: { fck: 40, fckT: 40, t0: 28, cement: 'N', creepMode: 'given', phi: 0, ecs: 0, EcT: 35000, Ec: 35000 },
  pre: { kind: 'post', fpk: 1860, Ep: 195000, sigJ: 1400, relMode: 'factor', relFactor: 0, rho1000: 2.5, Ap: 400, nT: 1, esj: 'seq', zEnd: 175, zMid: 100, mu: 0, k: 0, drawIn: 0, ends: 'one' },
  lossMode: 'sum', limits: { tS: { mode: 'value', value: 1 }, tT: { mode: 'value', value: 1 } }, uls: { links: { phi: 8, legs: 2, s: 200 } }, ...over });
const DT = (over = {}) => ({ sec: { type: 'dt', B: 2400, hf: 75, h: 600, n: 2, bwt: 180, bwb: 120, sp: 1200 }, L: 12000, lb: 150,
  loads: { rho: 25, g2: 3.6, q: 6.0, psi0: 0.7, psi1: 0.5, psi2: 0.3 }, conc: { fck: 50, fckT: 32, t0: 1, cement: 'R', RH: 50, temp: 20 },
  pre: { kind: 'pre', fpk: 1860, Ep: 195000, sigJ: 0.72 * 1860, relClass: 2, rho1000: 2.5, wire: 'strand', release: 'gradual',
    strands: [{ n: 4, Ap: 100, phi: 12.9, z: 60 }, { n: 2, Ap: 100, phi: 12.9, z: 110 }, { n: 2, Ap: 100, phi: 12.9, z: 110, debond: 1500 }] },
  limits: { tT: { mode: 'fctm' }, tS: { mode: 'fctm' }, tComb: 'freq', exposure: 'XC1' }, uls: { rule: '6.10', links: { phi: 8, legs: 2, s: 200 } }, ...over });
const PT = (over = {}) => ({ sec: { type: 'I', h: 1200, bt: 600, ht: 150, hth: 75, bw: 200, bb: 450, hb: 200, hbh: 100 }, L: 20000, lb: 300,
  loads: { rho: 25, g2: 10, q: 15, psi0: 0.7, psi1: 0.5, psi2: 0.3 }, conc: { fck: 40, t0: 7, cement: 'N', RH: 70, temp: 20 },
  pre: { kind: 'post', fpk: 1860, Ep: 195000, sigJ: 0.75 * 1860, relClass: 2, rho1000: 2.5, Ap: 2100, nT: 2, zEnd: 600, zMid: 130, mu: 0.19, k: 0.005, drawIn: 6, ends: 'both', esj: 'half', duct: { phi: 80, kind: 'steel', across: 1 } },
  limits: { tT: { mode: 'fctm' }, tS: { mode: 'fctm' }, tComb: 'freq', exposure: 'XC1' }, uls: { links: { phi: 10, legs: 2, s: 250 } },
  end: { on: true, na: 2, shape: 'square', a0: 250, b1: 450, h1: 450, B: 600, H: 1200, sigS: 300, phiZone: 12, phiAll: 16 }, ...over });
beam('Mosley 11.8', ex118());
const Z0 = beam('double-tee', DT());
beam('double-tee, 6.10ab, sums, factor relaxation, no links', DT({ uls: { rule: '6.10ab' }, lossMode: 'sum', pre: { ...DT().pre, relMode: 'factor', relFactor: 2 } }));
beam('double-tee, given creep, sudden release, poor bond, XC2', DT({ conc: { ...DT().conc, creepMode: 'given', phi: 2, ecs: 300 }, pre: { ...DT().pre, release: 'sudden', bondGood: false }, limits: { ...DT().limits, exposure: 'XC2', tS: { mode: 'zero' } } }));
beam('double-tee, heavy', DT({ loads: { ...DT().loads, q: 30 } }));
beam('double-tee, transfer from age, point loads, bars', DT({ conc: { fck: 50, t0: 2, cement: 'R', RH: 60 }, loads: { ...DT().loads, points: [{ a: 3000, G: 10, Q: 20 }, { a: 9000, G: 5, Q: 0 }] }, bars: [{ As: 400, z: 40, fyk: 500 }] }));
beam('post-tensioned I', PT());
beam('post-tensioned, one end, no draw-in, sequential', PT({ pre: { ...PT().pre, ends: 'one', drawIn: 0, esj: 'seq', nT: 4 } }));
beam('post-tensioned, straight, plastic duct, XD, lower shear', PT({ pre: { ...PT().pre, zEnd: 300, zMid: 300, duct: { phi: 80, kind: 'plastic', across: 1 } }, limits: { ...PT().limits, exposure: 'XD' }, uls: { ...PT().uls, shearRule: 'lower' } }));
beam('rectangle, pretensioned', { sec: { type: 'rect', b: 300, h: 600 }, L: 9000, lb: 200, loads: { rho: 25, g2: 3, q: 8, psi0: 0.7, psi1: 0.5, psi2: 0.3 }, conc: { fck: 45, fckT: 30, t0: 2, cement: 'R', RH: 65 },
  pre: { kind: 'pre', fpk: 1770, Ep: 195000, sigJ: 1300, relClass: 2, rho1000: 2.5, wire: 'strand', release: 'gradual', strands: [{ n: 6, Ap: 93, phi: 12.5, z: 70 }, { n: 2, Ap: 93, phi: 12.5, z: 530 }] }, limits: { tT: { mode: 'fctm' }, tS: { mode: 'fctm' } }, uls: { links: { phi: 8, legs: 2, s: 300 } } });
beam('custom layers', { sec: { type: 'custom', layers: [{ h: 150, b0: 400, b1: 400 }, { h: 100, b0: 400, b1: 150 }, { h: 400, b0: 150, b1: 150 }, { h: 150, b0: 800, b1: 800 }] }, L: 15000, lb: 200, loads: { rho: 25, g2: 4, q: 10, psi0: 0.7, psi1: 0.5, psi2: 0.3 },
  conc: { fck: 50, fckT: 35, t0: 1, cement: 'R', RH: 55 }, pre: { kind: 'pre', fpk: 1860, Ep: 195000, sigJ: 1350, relClass: 2, rho1000: 2.5, wire: 'strand', release: 'gradual', strands: [{ n: 8, Ap: 140, phi: 15.2, z: 60 }, { n: 4, Ap: 140, phi: 15.2, z: 110, debond: 2000 }] },
  limits: { tT: { mode: 'fctm' }, tS: { mode: 'fctm' }, tComb: 'char' }, uls: { links: { phi: 10, legs: 2, s: 250 } } });
// ---------- random beams ----------
let seed = 1112; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 24; t++) {
  const pre = rnd() < 0.6, base = pre ? DT() : PT();
  const o = { L: base.L * pick([0.8, 1, 1.2]), loads: { ...base.loads, q: pick([3, 6, 12, 20]), g2: pick([0, 3, 8]) }, conc: { ...base.conc, fck: pick([40, 45, 50]), RH: pick([50, 70, 80]), cement: pick(['N', 'R']) },
    uls: { ...base.uls, rule: pick(['6.10', '6.10ab']), shearRule: pick(['ec2', 'ec2', 'lower']), links: rnd() < 0.8 ? { phi: pick([8, 10]), legs: 2, s: pick([150, 250, 400]) } : {} },
    limits: { ...base.limits, tComb: pick(['char', 'freq']), exposure: pick(['XC1', 'XC2', 'XD']), tT: { mode: pick(['fctm', 'zero']) }, tS: { mode: pick(['fctm', 'zero', 'value']), value: 2 } }, lossMode: pick(['ec2', 'ec2', 'sum']) };
  if (pre) o.pre = { ...base.pre, sigJ: pick([0.65, 0.72, 0.78]) * 1860, release: pick(['gradual', 'sudden']), strands: base.pre.strands.map(s => ({ ...s, n: s.n + pick([0, 1, 2]) })) };
  else o.pre = { ...base.pre, mu: pick([0.15, 0.19, 0.25]), drawIn: pick([0, 4, 8]), ends: pick(['one', 'both']), zMid: pick([110, 160, 250]), esj: pick(['half', 'seq']) };
  beam(`random ${t}`, pre ? DT(o) : PT(o));
}
// ---------- the project of a beam opens in CalcPad part by part with the same values ----------
(async () => {
  const list = Z0.map(zn => ({ C: zn.C, title: zn.title }));
  const P = await CalcScript.project(list, { project: 'Test' }, 'Prestressed beam');
  // the whole calculation as one CalcPad check (.perega): its parts merged, every value still the tool's, as pasted and as opened
  { const M = CalcScript.merge(list, { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
  n++; if (P.checks.length !== Z0.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
  H.project(P).slice(1).forEach((r, k) => check(`project ${r.name}`, Z0[k].C, r));
  console.log(`project: ${P.checks.length} checks, ${(JSON.stringify(P).length / 1e3).toFixed(0)} kB`);
  console.log(`${zones} parts of ${beams} beams; checks and kinds: ${[...kinds].sort().join(', ')}`);
  console.log(`\n${n - bad}/${n} Prestressed Beam values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
