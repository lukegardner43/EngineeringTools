// Concrete Tie Force: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// The building's class and the tie forces it needs (F_t, the peripheral tie, the internal ties each way and grouped at
// the beams, the ties to the columns and walls, the vertical ties for Class 2B and 3) are pasted into CalcPad (headless,
// tests/calcpad) and every value CalcPad works out must be the page's own: Mosley, Bungey and Hulse example 6.7 as
// test_tie_force.js sets it, every class, F_t at and beyond its 60 kN cap, internal ties held at F_t, each column rule
// governing, the tributary area given or from the spacings, and random buildings. No chip may show an error or a unit
// CalcPad cannot read, and the CalcPad project must open with the same values.
const fs = require('fs'), path = require('path'), { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Concrete Tie Force.html'), 'utf8');
const vc = new VirtualConsole(), errs = []; vc.on('jsdomError', e => errs.push(e.message));
const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', virtualConsole: vc }).window, d = w.document;
const H = require('../calcpad/harness.js').open();
const CalcScript = w.eval('CalcScript');
let n = 0, bad = 0, cases = 0;
const seen = new Set();
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
const set = o => { for (const [k, v] of Object.entries(o)) { const el = d.getElementById(k); if (!el) throw new Error('no input ' + k); if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v); el.dispatchEvent(new w.Event('change', { bubbles: true })); } };
function building(tag, o) {
  set(o); w.calculate();
  const t = w.eval('lastCalc'), Z = w.eval('fullZ');
  if (!Z) { bad++; console.log('SCRIPT', tag, d.getElementById('fullCalc').textContent.slice(0, 200)); return null; }
  cases++; seen.add(`class ${t.cls}${t.tx.calc < t.Ft ? ', X at F_t' : ''}${t.h3 > Math.min(t.h1, t.h2) ? ', 3% governs' : t.h1 < t.h2 ? ', 2Ft governs' : ''}${t.Ft === 60 ? ', F_t capped' : ''}`);
  const names = Z[0].C.items.filter(it => it.name).map(it => it.name);
  n++; if (t.cls !== '1' && !['F_t', 'F_per', 'F_ix', 'F_iy', 'F_col'].every(k => names.includes(k)) || (t.cls === '2B' || t.cls === '3') !== names.includes('F_v')) { bad++; console.log('FAIL the ties of class', t.cls, names.join(' ')); }
  check(tag, Z[0].C, H.text(Z[0].C.calcpad()));
  return Z;
}
// ---------- Mosley, Bungey and Hulse example 6.7 ----------
const NEd = 8 * (1.35 * 6 + 1.5 * 3) * (7 / 2 * 6.5);
const E67 = { buildingUse: 'office', nStoreys: 8, floorAreaPS: 182, floorW: 7, floorL: 26, csX: 6.5, csY: 7, ls: 3.4, gk: 6, gsk: 0, qk: 3, ned: NEd, psi1: 0.6, trib: 7 / 2 * 6.5, hazardous: false, pubCap: 0 };
const Z0 = building('Mosley example 6.7', E67);
n++; { const z = d.querySelectorAll('#fullCalc details.zone'); if (!(z.length === 1 && d.getElementById('fullCalcSection').style.display === 'block' && z[0].querySelector('[data-cp="copy"]'))) { bad++; console.log('FAIL the page shows no full calculation with its CalcPad buttons'); } }
building('light floors: the internal ties are F_t', { ...E67, gk: 1, qk: 1 });
building('no tributary area given', { ...E67, trib: '' });
building('ten storeys: F_t at its cap', { ...E67, nStoreys: 10, buildingUse: 'residential' });
building('twenty storeys: Class 3', { ...E67, nStoreys: 20 });
building('a house of three storeys: Class 1', { ...E67, buildingUse: 'house', nStoreys: 3 });
building('a four-storey office, low storeys: 2F_t governs the column ties', { ...E67, nStoreys: 4, ls: 6, ned: 500 });
building('a heavy column: 3 % governs', { ...E67, ned: 6000 });
building('hazardous: Class 3', { ...E67, nStoreys: 2, hazardous: true });
// ---------- random buildings ----------
let seed = 910; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 40; t++) building(`random ${t}`, { buildingUse: pick(['house', 'residential', 'office', 'retail', 'industrial', 'educational', 'public_assembly', 'healthcare', 'car_parking', 'agricultural']), nStoreys: pick([1, 2, 3, 4, 5, 6, 8, 12, 16, 25]),
  floorAreaPS: pick([500, 1500, 3000, 6000]), floorW: pick([10, 20]), floorL: pick([20, 40]), csX: pick([4.5, 6, 7.5, 9]), csY: pick([4.5, 6, 7.5, 9]), ls: pick([2.7, 3.2, 4, 5.5]), gk: pick([2, 5, 8]), gsk: pick([0, 1.5]), qk: pick([1.5, 2.5, 5]),
  ned: pick([300, 1500, 4000]), psi1: pick([0.5, 0.7, 0.9]), trib: pick(['', 30, 55]), hazardous: rnd() < 0.1, pubCap: pick([0, 0, 6000]) });
// ---------- the project opens in CalcPad with the same values ----------
(async () => {
  const P = await CalcScript.project(Z0.map(zn => ({ C: zn.C, title: zn.title })), { project: 'Test' }, 'Ties');
  H.project(P).slice(-Z0.length).forEach((r, k) => check(`project ${r.name}`, Z0[k].C, r));
  n++; if (errs.length) { bad++; console.log('PAGE ERRORS', errs.slice(0, 3)); }
  console.log(`${cases} buildings: ${[...seen].sort().join('; ')}`);
  console.log(`\n${n - bad}/${n} Concrete Tie Force values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
