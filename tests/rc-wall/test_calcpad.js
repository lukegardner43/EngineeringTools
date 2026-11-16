// RC Wall Design: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every check of the full calculation is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out
// must be the tool's own: wall panels (reinforced: slenderness, the nominal-curvature moment and M_Rd at N_Ed by strain
// compatibility, then the 9.6 rules; plain: Table 12.1 and 12.10), 60 random panels, every TCC63 core (outputs only,
// ref_tcc63.json: the stiffness and torsion shares and the stresses at each location) and set cores (openings, extra
// eccentricity, both directions together, no loads). Each check's utilisation must be the tool's own, no chip may show an
// error or a unit CalcPad cannot read, and a core's project must open in CalcPad check by check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Wall Design.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.W = Wall; this.CS = CalcScript; this.WS = WallScript;', sb);
const H = require('../calcpad/harness.js').open();
const T63 = require('./ref_tcc63.json');
let n = 0, bad = 0, zones = 0;
function check(tag, C, Pc) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : sb.CS.toSI(it.v, it.unit), got = Pc.vars[it.name];
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + (it.name === 'N_res' ? 1e-2 : 1e-9);
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = Pc.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (Pc.warn) { bad++; console.log('BAD UNIT', tag, Pc.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
}
function zs(tag, Z, util) {
  for (const zn of Z) { zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v); n++;
    if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(tag + ' ' + zn.key, zn.C, H.text(zn.C.calcpad())); }
  n++; if (util != null && Math.abs(Math.max(...Z.map(z => z.util ?? 0)) - util) > 1e-9 * Math.max(1, util)) { bad++; console.log('ZUTIL', tag, Z.map(z => z.util), util); }
}
function panel(tag, inp) { let R; try { R = sb.W.panel(inp); } catch (e) { return; } const Z = sb.WS.panel(R); zs(tag, Z, isFinite(R.util) ? R.util : null); return Z; }
function core(tag, inp) { let R; try { R = sb.W.core(inp); } catch (e) { console.log('ERR', tag, e.message); return; } const Z = sb.WS.core(R, inp); zs(tag, Z, R.locs.length ? R.util : null); return Z; }
const P0 = { h: 200, l: 3500, fck: 32, fyk: 500, cover: 30, phiV: 12, sV: 200, phiH: 10, sH: 300, NEd: 900, Mtop: 6, Mbot: -3, braced: true, k1: 0.5, k2: 0.5, phief: 2, eimode: '400', lw: 4 };
panel('P0', P0);
panel('plain 4', { ...P0, plain: true, sides: '4', bSide: 3000, rigid: true, NEd: 500, Mtop: 4 });
panel('plain 3', { ...P0, plain: true, sides: '3', bSide: 2000, NEd: 400 });
panel('plain cant', { ...P0, plain: true, sides: 'cant', NEd: 200, l: 1500 });
panel('plain 2', { ...P0, plain: true, sides: '2', accPl: 0.6, NEd: 600 });
let seed = 3; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let k = 0; k < 60; k++) {
  const h = pick([150, 175, 200, 250, 300]), s = pick([100, 125, 200, 250]), pv = pick([10, 12, 16, 20]), ph = pick([8, 10, 12]), cov = pick([25, 30, 40]), fck = pick([25, 30, 32, 40]);
  const l = pick([2500, 3000, 3500, 4500, 6000]), braced = k % 4 !== 3, NEd = Math.round(1000 * h * 0.85 * fck / 1.5 * (0.05 + 0.6 * rnd()) / 1000), Mt = Math.round(rnd() * 0.08 * NEd * h / 1000 * 10) / 10, Mb = pick([Mt, -Mt * 0.5, 0, -Mt]);
  panel('rnd' + k, { h, l, fck, fyk: pick([500, 460]), cover: cov, phiV: pv, sV: s, phiH: ph, sH: pick([200, 300, 450]), NEd, Mtop: Mt, Mbot: Mb, braced, pinned: rnd() < 0.1, k1: pick([0.1, 0.5, 1, 2]), k2: pick([0.1, 0.5, 1, 2]), phief: pick([1, 1.5, 2]), eimode: pick(['400', 'ah']), hOutside: rnd() < 0.8, plain: rnd() < 0.15, sides: pick(['2', '3', '4', 'cant']), bSide: pick([1500, 3000, 5000]), rigid: rnd() < 0.3 });
}
T63.forEach(({ inp: c, tcc: O }, k) => {
  const psi0 = O['CORE!O11'], psi2 = O['CORE!Q11'];
  const combos = [[0.925 * 1.35, 1.5, 0.5], [0.925 * 1.35, 1.5 * psi0, 1.5], [1, 1.5, 0.5], [1, 1.5 * psi0, 1.5], [1.35, 1.5 * psi0, 0.5], [1, psi2, 1.5]].map(([gG, gQ, gW], j) => ({ name: `TCC ${j + 1}`, gG, gQ, gW }));
  core('tcc' + k, { L: c.L, W: c.W, Mns: c.Mns, Mew: c.Mew, method: 'tcc', together: true, ignoreIxy: true, cores: c.cores, design: c.sel, fck: c.fck, fyk: 500, combos, loads: c.loads, locations: c.locs });
});
const C0 = { L: 30, W: 15, Mns: 8000, Mew: 5000, eAcc: 0.05, cores: [{ x: 2, y: 3, B: 4000, D: 3000, openings: [{ x: 1000, y: 0, w: 1200, h: 200 }] }, { x: 24, y: 5, B: 3000, D: 3000, openings: [] }], design: 0, fck: 40, fyk: 500,
  loads: [{ x: 2000, y: 1500, G: 3000, Q: 1000 }, { x: 500, y: 2800, G: 800, Q: 300 }], locations: [{ x: 100, y: 100, t: 200 }, { x: 3900, y: 2900, t: 200 }, { x: 2000, y: 100, t: 200 }], psiQ: 0.7, rule: '6.10ab' };
const ZC = core('core', C0);
core('core together 6.10', { ...C0, together: true, rule: '6.10', eAcc: 0 });
core('core no loads', { ...C0, loads: [] });
(async () => {
  const list = ZC.map(zn => ({ C: zn.C, title: zn.title })), sz = x => JSON.stringify(x).length;
  const P = await sb.CS.project(list, { project: 'Test' }, 'Core'), Pn = await sb.CS.project(list, { project: 'Test' }, 'Core', { share: false });
  n++; if (P.checks.length !== ZC.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
  H.project(P).slice(1).forEach((r, k) => check(`project ${r.name}`, ZC[k].C, r));
  n++; if (!(sz(P) < 0.8 * sz(Pn))) { bad++; console.log('FAIL sharing did not make the pack smaller', sz(P), sz(Pn)); }
  console.log(`project: ${P.checks.length} checks, ${(sz(P) / 1e3).toFixed(0)} kB with the shared values, ${(sz(Pn) / 1e3).toFixed(0)} kB without`);
  console.log(`${zones} checks`);
  console.log(`\n${n - bad}/${n} RC Wall values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
