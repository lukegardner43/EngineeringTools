// Basement Wall: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// The engine and its full calculation are the Retaining Wall's (tests/retaining-wall/test_calcpad.js), the wall propped at
// the ground floor: here every check (bearing in each combination, sliding where no slab holds the base, the wall's back
// face at the base and front face in the span, the toe and heel, the early-age bars) of the TCC61 walls (outputs only,
// ref_tcc61.json), set cases (fixed and pinned, water, surcharges, the wall above the ground, wall loads, without the slab)
// and random basement walls is pasted into CalcPad (headless, tests/calcpad) and every value must be the tool's own.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Basement Wall.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.RetWall = RetWall; this.CalcScript = CalcScript; this.RetWallScript = RetWallScript;', sb);
const { RetWall, CalcScript, RetWallScript } = sb;
const REF = require('./ref_tcc61.json');
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, walls = 0;
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
const keyOf = k => /^bear/.test(k.id) ? k.key : /^(slide1|slide2|equ|sls|plainN|plainV|restraint)$/.test(k.id) ? k.id : /^stemF/.test(k.id) ? 'stemF' : /^stem/.test(k.id) ? 'stem' : /^toe/.test(k.id) ? 'toe' : /^heel/.test(k.id) ? 'heel' : '?';
function wall(tag, inp) {
  let R; try { R = RetWall.design(inp); } catch (e) { return null; }
  let Z; try { Z = RetWallScript.zones(R); } catch (e) { bad++; console.log('SCRIPT', tag, e.message); return null; }
  walls++; Z.forEach(z => kinds.add(z.key.replace(/^C[12][ab]$/, 'bearing')));
  for (const k of R.checks) {
    if (k.req) continue; n++;
    const z = Z.find(zn => zn.key === keyOf(k));
    if (!z || (isFinite(k.util) && z.util < k.util - 1e-12)) { bad++; console.log('MISSING', tag, k.id, keyOf(k), z && z.util, k.util); }
  }
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
// ---------- TCC61 ----------
const bars = { fck: 30, phiS: 16, sS: 150, phiSF: 12, sSF: 200, phiT: 12, sT: 200, phiH: 12, sH: 200 };
REF.cases.forEach((c, i) => { const L = c.Hc + c.tb;
  wall(`TCC61 ${i + 1}`, { type: 'propped', K: 'active', H: c.tb + c.hb, hUp: L - c.hb, hProp: L, tb: c.tb, ts: c.ts, B: c.B, bt: c.B - c.bh - c.ts, g: c.g, gsat: c.g, phi: c.phi, gf: 20, phif: 35, baseHeld: true, qQ: c.qk || 0, ...bars }); });
// ---------- set cases ----------
const D = { type: 'propped', K: 'rest', fixBase: true, H: 3300, hUp: 0, hProp: 3000, tb: 300, B: 1400, bt: 600, ts: 300, hg: 0, g: 18, gsat: 20, phi: 30, gf: 19, phif: 32, baseHeld: true, dA: 0, ...bars };
const Z0 = wall('fixed, slab', { ...D, hw: 1500, qQ: 10, phiHz: 12, sHz: 200, tCrack: 3, cement: 'N' });
wall('pinned at the slab', { ...D, fixBase: false, qQ: 5 });
wall('the wall above the ground, wall loads', { ...D, hUp: 600, hProp: 3600, wallG: 30, wallQ: 15, qG: 5 });
wall('no slab: sliding', { ...D, baseHeld: false, passive: true, hg: 300 });
wall('undrained, allowable pressure', { ...D, bearing: 'undrained', cuf: 75, qa: 150 });
// ---------- random basement walls ----------
let seed = 6161; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 40; t++) {
  const H = pick([2500, 3300, 4000]), tb = pick([250, 300, 400]), ts = pick([250, 300, 350]), B = pick([1000, 1400, 2000]), bt = Math.min(pick([0, 300, 600]), B - ts);
  wall(`random ${t}`, { type: 'propped', H, tb, ts, B, bt, hUp: pick([0, 0, 300]), hProp: H - tb - pick([0, 200]), fixBase: rnd() < 0.7, baseHeld: rnd() < 0.7, K: pick(['rest', 'rest', 'active']), g: pick([18, 19]), gsat: pick([20, 21]), phi: pick([25, 30, 35]),
    hw: rnd() < 0.5 ? pick([1000, 2000]) : 0, qG: pick([0, 5]), qQ: pick([0, 5, 10]), wallG: pick([0, 20]), wallQ: pick([0, 10]), gf: 19, phif: pick([28, 32]), cf: pick([0, 5]), bearing: rnd() < 0.2 ? 'undrained' : 'drained', cuf: 60,
    fck: pick([30, 32, 35]), phiS: pick([12, 16]), sS: pick([150, 200]), phiSF: 12, sSF: 200, phiT: 12, sT: 200, phiH: pick([12, 16]), sH: 200, phiHz: rnd() < 0.5 ? 12 : 0, sHz: 200, psi2: pick([0.3, 0.6]), wk: pick([0.2, 0.3]), dA: 0 });
}
// ---------- the project of a wall opens in CalcPad check by check with the same values ----------
(async () => {
  const list = Z0.map(zn => ({ C: zn.C, title: zn.title }));
  const P = await CalcScript.project(list, { project: 'Test' }, 'Basement wall');
  // the whole calculation as one CalcPad check (.perega): its parts merged, every value still the tool's, as pasted and as opened
  { const M = CalcScript.merge(list, { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
  n++; if (P.checks.length !== Z0.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
  H.project(P).slice(1).forEach((r, k) => check(`project ${r.name}`, Z0[k].C, r));
  console.log(`project: ${P.checks.length} checks, ${(JSON.stringify(P).length / 1e3).toFixed(0)} kB`);
  console.log(`${zones} checks of ${walls} walls; kinds: ${[...kinds].sort().join(', ')}`);
  console.log(`\n${n - bad}/${n} Basement Wall values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
