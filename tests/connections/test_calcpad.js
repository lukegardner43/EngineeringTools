// ConnectionCheck: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every joint type is calculated on the page (jsdom) and its full calculation pasted into CalcPad (headless, tests/calcpad):
// a column base is written formula by formula (as Base Plate Design) and every value CalcPad works out must be the page's;
// every other joint carries each check's worked lines with its resistance and demand, and CalcPad must reproduce every
// check's utilisation. The part's utilisation must be the joint's; no chip may show an error or a unit CalcPad cannot read;
// and the whole joint must open in CalcPad as one check.
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'ConnectionCheck.html'), 'utf8').replace(/<script src=[^>]*><\/script>/g, '');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/' });
const w = dom.window, d = w.document;
const H = require('../calcpad/harness.js').open();
const CalcScript = w.eval('CalcScript');
let n = 0, bad = 0, joints = 0;
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
function joint(tag) {
  w.doCalc();
  const eb = d.getElementById('err-box'); if (eb && eb.style.display !== 'none') { console.log('page refused', tag, eb.textContent); return null; }
  const res = w.lastRes, Z = w.eval('lastZ');
  if (!Z) { bad++; console.log('NO CALC', tag); return null; }
  joints++;
  const all = Z.flatMap(z => z.C.items.filter(it => it.t === 'chk').map(it => it.v));
  for (const c of res.checks) { n++; if (c.cap > 0 && !all.some(v => Math.abs(v - c.r) <= 1e-9 * Math.max(1, c.r))) { bad++; console.log('MISSING', tag, c.id, c.name, c.r); } }
  for (const zn of Z) {
    n++; if (Math.abs(zn.util - res.maxR) > 1e-12 * Math.max(1, res.maxR)) { bad++; console.log('UTIL', tag, zn.util, res.maxR); }
    check(tag, zn.C, H.text(zn.C.calcpad()));
  }
  n++; if (d.querySelectorAll('#results details.zone').length !== Z.length || d.querySelectorAll('#results [data-cp="all"]').length !== 1) { bad++; console.log('PAGE', tag); }
  return Z;
}
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), set = (id, v) => { d.getElementById(id).value = v; };
  await wait(100);
  let Z0 = null;
  for (const id of ['fin', 'pdep', 'fdep', 'dcleat', 'scleat', 'splice', 'base', 'rsplice', 'conc', 'moment', 'brace']) {
    w.switchJt(id); await wait(60);
    const z = joint(id); if (id === 'base') Z0 = z;
  }
  // the column base, formula by formula: compression, bending, uplift, both sides in tension, no welds, other columns
  w.switchJt('base'); await wait(60);
  const cases = [['1500', '0', '10'], ['900', '60', '20'], ['-150', '10', '18'], ['-400', '5', '10'], ['300', '-60', '25'], ['0', '40', '15'], ['1500', '20', '5']];
  for (const [N, M, V] of cases) { set('ba-N', N); set('ba-M', M); set('ba-V', V); joint(`base N ${N} M ${M} V ${V}`); }
  set('ba-aw', '0'); set('ba-awW', '0'); joint('base without welds');
  for (const col of ['203×203×46 UKC', '305×305×118 UKC', '356×368×129 UKC']) { set('ba-col', col); set('ba-D', '600'); set('ba-B', '550'); set('ba-w', '400'); joint(`base ${col}`); }
  { const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
  console.log(`${joints} joints`);
  console.log(`\n${n - bad}/${n} ConnectionCheck values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
