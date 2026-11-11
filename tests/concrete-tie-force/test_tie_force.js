// Concrete Frame Tie Force Calculator (Concrete Tie Force.html): the tie forces against Mosley, Bungey and Hulse, Reinforced
// Concrete Design to Eurocode 2 (7th ed.), Example 6.7 (published; an eight-storey frame, outputs only), and the building
// classes against Approved Document A (2004 incorporating 2010 and 2013 amendments), Table 11, at every boundary.
//   NODE_PATH=<jsdom>/node_modules node tests/concrete-tie-force/test_tie_force.js
const fs = require('fs'), path = require('path'), { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Concrete Tie Force.html'), 'utf8');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const vc = new VirtualConsole(), errs = []; vc.on('jsdomError', e => errs.push(e.message));
const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', virtualConsole: vc }).window, d = w.document;
const set = o => { for (const [k, v] of Object.entries(o)) { const el = d.getElementById(k); if (!el) throw new Error('no input ' + k); if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v); el.dispatchEvent(new w.Event('change', { bubbles: true })); } };
truth('page loads without script errors', errs.length === 0, errs);

// ---- Mosley et al. Example 6.7: 8 storeys, gk 6, qk 3 kN/m², ls 3.4 m, 4 bays of 6.5 m along X, transverse beams 7 m ----
const NEd = 8 * (1.35 * 6 + 1.5 * 3) * (7 / 2 * 6.5);   // 3% of this is the book's 69 kN at ground level
set({ buildingUse: 'office', nStoreys: 8, floorAreaPS: 182, floorW: 7, floorL: 26, csX: 6.5, csY: 7, ls: 3.4, gk: 6, gsk: 0, qk: 3, ned: NEd, psi1: 0.6, trib: 7 / 2 * 6.5, hazardous: false, pubCap: 0 });
{
  const t = w.tieCalc();
  truth('Ex 6.7: Ft = 20 + 4 × 8 = 52 kN (< 60)', t.Ft === 52);
  truth('Ex 6.7: peripheral tie 52 kN (104 mm² at 500 N/mm²)', t.Fper === 52 && near(t.Fper * 1e3 / 500, 104, 1e-9));
  truth('Ex 6.7: internal ties across (lr 7 m) 87.4 kN/m', near(t.ty.F, 87.4, 0.05), t.ty.F);
  truth('Ex 6.7: internal ties along (lr 6.5 m) 81.1 kN/m', near(t.tx.F, 81.1, 0.05), t.tx.F);
  truth('Ex 6.7: per transverse beam 87.4 × 6.5 = 568.1 kN; along the length 81.1 × 7 = 567.7 kN', near(t.ty.F * t.csX, 568.1, 0.4) && near(t.tx.F * t.csY, 567.7, 0.4), [t.ty.F * t.csX, t.tx.F * t.csY]);
  truth('Ex 6.7: column ties ls Ft/2.5 = 70.7 kN < 2Ft', near(t.h2, 70.7, 0.05) && t.h2 < t.h1);
  truth('Ex 6.7: 3% of the ultimate column load = 69 kN; the tie is 70.7 kN', near(t.h3, 69, 0.3) && near(t.Fcol, 70.7, 0.05), [t.h3, t.Fcol]);
  truth('Ex 6.7: vertical tie (1.0 × 6 + 0.6 × 3) × 3.5 × 6.5 = 177.5 kN', near(t.Fvert, 177.5, 0.06), t.Fvert);   // 177.45, which the book rounds to 177.5
  truth('Ex 6.7: an 8-storey office is Class 2B', t.cls === '2B');
  truth('internal ties not less than Ft', w.tieCalc().tx.F >= 52 && (set({ gk: 1, qk: 1 }), w.tieCalc().tx.F === 52 && w.tieCalc().ty.F === 52));
  set({ gk: 6, qk: 3 });
  truth('vertical tie: blank tributary area takes X × Y spacing', (set({ trib: '' }), near(w.tieCalc().Fvert, 7.8 * 6.5 * 7, 1e-9)));
  set({ trib: 22.75 });
  truth('Ft capped at 60 kN from 10 storeys', (set({ nStoreys: 12 }), w.tieCalc().Ft === 60));
  set({ nStoreys: 8 });
}
// ---- Approved Document A, Table 11 ----
const cls = (use, n, area = 500, extra = {}) => { set({ buildingUse: use, nStoreys: n, floorAreaPS: area, hazardous: false, pubCap: 0, ...extra }); return w.classify().cls; };
const cases = [
  ['house', 4, 500, '1'], ['house', 5, 500, '2A'], ['house', 6, 500, '3'],
  ['residential', 1, 500, '2A'], ['residential', 4, 500, '2A'], ['residential', 5, 500, '2B'], ['residential', 15, 500, '2B'], ['residential', 16, 500, '3'],
  ['office', 4, 500, '2A'], ['office', 5, 500, '2B'], ['office', 15, 500, '2B'], ['office', 16, 500, '3'],
  ['industrial', 3, 500, '2A'], ['industrial', 4, 500, '3'],
  ['retail', 3, 1999, '2A'], ['retail', 3, 2000, '2B'], ['retail', 4, 500, '2B'], ['retail', 15, 4999, '2B'], ['retail', 2, 5000, '3'], ['retail', 16, 500, '3'],
  ['educational', 1, 500, '2A'], ['educational', 2, 500, '2B'], ['educational', 15, 500, '2B'], ['educational', 16, 500, '3'],
  ['public_assembly', 2, 2000, '2A'], ['public_assembly', 2, 2001, '2B'], ['public_assembly', 6, 4999, '2B'], ['public_assembly', 1, 5000, '3'], ['public_assembly', 3, 1500, '3'],
  ['healthcare', 3, 500, '2B'], ['healthcare', 4, 500, '3'], ['car_parking', 6, 500, '2B'], ['car_parking', 7, 500, '3'], ['agricultural', 2, 500, '1'],
];
for (const [use, n, area, want] of cases) { const got = cls(use, n, area); truth(`Table 11: ${use}, ${n} storeys, ${area} m² → Class ${want}`, got === want, got); }
truth('Table 11: hazardous substances → Class 3', cls('office', 2, 500, { hazardous: true }) === '3');
truth('Table 11: grandstand for more than 5000 → Class 3', cls('public_assembly', 1, 500, { pubCap: 5001 }) === '3' && cls('public_assembly', 1, 500, { pubCap: 5000 }) === '2A');
// ---- the page ----
set({ buildingUse: 'office', nStoreys: 8, floorAreaPS: 182, hazardous: false, pubCap: 0 }); w.calculate();
const t = d.getElementById('resultsCard').textContent;
truth('results: Class 2B, peripheral in kN, internal ties each way in kN/m, vertical per column', /Class 2B/.test(t) && /52\.00 kN/.test(t) && /X 81\.1\d kN\/m/.test(t) && /Y 87\.3\d kN\/m/.test(t) && /177\.45 kN per column/.test(t), t.slice(0, 200));
truth('clauses: 9.10.2.2 to 9.10.2.5 of the UK NA', ['9.10.2.2', '9.10.2.3', '9.10.2.4', '9.10.2.5'].every(c => t.includes('UK NA to ' + c)));
truth('the plan names both internal ties', /X 81\.1, Y 87\.4 kN\/m|X 81, Y 87 kN\/m/.test(d.getElementById('drawings').textContent), d.getElementById('drawings').textContent.slice(0, 300));
truth('no script errors', errs.length === 0, errs);
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
