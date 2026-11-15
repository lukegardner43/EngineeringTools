// RC Column Design: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Check Design runs on the page (jsdom); every check of its full calculation (each axis, biaxial bending, the limits and
// fire resistance) is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the page's
// own: every TCC53 (rectangular) and TCC54 (circular) column (outputs only, ref_tcc53/54.json) and 60 random columns
// (braced and unbraced, pinned, single and double curvature, biaxial, slender and stocky, the whole section in
// compression). No chip may show an error or a unit CalcPad cannot read, and every SECTION drawing must draw.
const { load, run } = require('./load.js');
const T53 = require('./ref_tcc53.json'), T54 = require('./ref_tcc54.json');
const H = require('../calcpad/harness.js').open();
const w = load(), RCS = w.eval('RCColScript'), CS = w.eval('CalcScript');
let n = 0, bad = 0, zones = 0, cols = 0;
function check(tag, C, P) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CS.toSI(it.v, it.unit), got = P.vars[it.name];
    if (it.t === 'chk' && !isFinite(exp)) { if (isFinite(got) && got < 1e6) { bad++; console.log('FAIL', tag, it.name, 'tool', exp, 'calcpad', got); } continue; }
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + (it.name === 'N_res' ? 1e-2 : 1e-9);
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
  const pe = (P.plots || []).filter(p => p.err); if (pe.length || (C.items.some(it => it.t === 'plot') && !(P.plots || []).length)) { bad++; console.log('PLOT', tag, pe.slice(0, 2)); }
}
function col(tag, s) {
  const L = run(w, s); if (!L) return;
  const Z = RCS.zones(L, w.colInputs());
  cols++; for (const zn of Z) { zones++; check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad())); }
  // the page shows the same checks after Check Design, each with its CalcPad buttons, and one project download
  const D = w.document.querySelectorAll('#fullCalc details.zone'); n++;
  if (D.length !== Z.length || [...D].some(z => !z.querySelector('[data-cp="copy"]') || !z.querySelector('.cs')) || w.document.querySelectorAll('#fullCalc [data-cp="proj"]').length !== 1) { bad++; console.log('PAGE', tag, D.length, Z.length); }
}
// ---------- TCC53, TCC54 ----------
T53.forEach(({ inp: c, tcc: t }, k) => col(`TCC53 ${k}`, { rb: c.b, rh: c.h, rfck: c.fck, rfyk: 500, rcov: c.cov, rlink: Math.max(c.link, t.bar > 32 ? 10 : 8), rnx: c.nb, rdx: t.bar, rny: c.nh, rdy: t.bar,
  ned: c.N, mtop: c.My[0], mbot: c.My[1], mtopy: c.Mz[0], mboty: c.Mz[1], clen: t.ly, cleny: t.lz, phief: t.phief, ktop: t.y.k1, kbot: t.y.k2, ktopy: t.z.k1, kboty: t.z.k2, braced: c.braced === 'Y', mufi: 0.7, eimode: 'ah' }));
T54.forEach(({ inp: c, tcc: t }, k) => col(`TCC54 ${k}`, { tab: 'circ', cd: c.D, cfck: c.fck, cfyk: 500, ccov: c.cov, clink: t.bar > 32 ? 10 : 8, cnb: c.nb, cdb: t.bar,
  ned: c.N, mtop: c.M02, mbot: -c.M01, mtopy: 0, mboty: 0, clen: c.L, cleny: c.L, phief: t.phief, ktop: t.k1, kbot: t.k2, ktopy: t.k1, kboty: t.k2, braced: c.braced === 'Y', mufi: 0.7, eimode: 'ah' }));
// ---------- random columns ----------
let seed = 5302; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648, pick = a => a[Math.floor(rnd() * a.length)], between = (a, b) => a + (b - a) * rnd();
for (let t = 0; t < 60; t++) {
  const circ = rnd() < 0.3, fck = pick([25, 30, 32, 35, 40, 50]), fyk = pick([500, 500, 460, 250]), l = 250 * Math.round(between(2500, 9000) / 250), braced = rnd() < 0.75, pinned = braced && rnd() < 0.15;
  const M1 = Math.round(between(-120, 150)), M2 = Math.round(between(-150, 150)), N = Math.round(between(150, 4500)), common = { ned: N, mtop: M1, mbot: M2, clen: l, cleny: pick([l, l, l - 500]), phief: pick([0, 1, 1.5, 2]),
    ktop: +between(0.1, 3).toFixed(2), kbot: +between(0.1, 3).toFixed(2), ktopy: +between(0.1, 3).toFixed(2), kboty: +between(0.1, 3).toFixed(2), braced, pinned, mufi: pick([0.5, 0.7]), eimode: pick(['400', 'ah']) };
  if (circ) col(`circ${t}`, { tab: 'circ', cd: pick([300, 350, 400, 450, 500, 600]), cfck: fck, cfyk: fyk, ccov: pick([25, 30, 35, 40]), clink: 8, cnb: pick([6, 8, 10, 12]), cdb: pick([16, 20, 25, 32]), ...common, mtopy: 0, mboty: 0 });
  else col(`rect${t}`, { rb: pick([250, 300, 350, 400]), rh: pick([300, 350, 400, 500, 600]), rfck: fck, rfyk: fyk, rcov: pick([25, 30, 35, 40]), rlink: pick([8, 10]), rnx: pick([2, 2, 3, 4]), rdx: pick([16, 20, 25, 32]),
    rny: pick([2, 2, 3, 4]), rdy: pick([16, 20, 25]), ...common, mtopy: rnd() < 0.4 ? Math.round(between(-60, 80)) : 0, mboty: rnd() < 0.4 ? Math.round(between(-60, 80)) : 0 });
}
console.log(`${zones} checks of ${cols} columns`);
console.log(`\n${n - bad}/${n} RC Column values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
