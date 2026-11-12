// Drives "Tower Crane Base.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Tower Crane Base.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-crane-base-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, err = () => (($('results').querySelector('.err') || {}).textContent || '');
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('defaults: four load cases, torque only in service, two drawings', d.querySelectorAll('#caseRows .row').length === 4 && !d.querySelectorAll('#caseRows .T')[0].disabled && d.querySelectorAll('#caseRows .T')[1].disabled && $('drawings').querySelectorAll('svg.dk').length === 2);
$('calc').click();
truth('checked: PASS, the mast\'s tilt governs', /PASS/.test(res()) && /Governs: settlement and tilt/.test(res()) && !err());
truth('checks (13, with tilt and pull-out), the load-case table and the calculation', $('results').querySelectorAll('.ck').length === 13 && $('results').querySelectorAll('table.ctab tbody tr').length === 4 && /C761 Table A3\.2/.test(res()) && /Pull-out/.test(res()) && /jib at 0° to 45°/.test(res()));
set('E', ''); $('calc').click(); truth('no E: no settlement check, overturning governs', $('results').querySelectorAll('.ck').length === 12 && /Governs: overturning \(EQU\)/.test(res()));
set('E', '100'); set('qpBasis', 'gross'); $('calc').click(); truth('presumed bearing gross', /characteristic, gross/.test(res()) && !/overburden =/.test(res()));
set('qpBasis', 'net'); set('tc', '1400'); $('calc').click(); truth('the compression going in below the bottom steel is refused', /below the bottom steel/.test(err()));
set('tc', '235');
set('L', '5'); $('calc').click(); truth('a 5 m base overturns', /FAIL/.test(res()) && /Overturning/.test(res()));
set('L', '6');
$('dyn').checked = true; $('dyn').dispatchEvent(new w.Event('change', { bubbles: true })); $('calc').click(); truth('loads with dynamic effects: Table A3.3', /Table A3\.3/.test(res()));
$('dyn').checked = false; $('dyn').dispatchEvent(new w.Event('change', { bubbles: true }));
set('ground', 'undrained'); truth('undrained: c_u shown', !d.querySelector('.g-un').hidden && d.querySelector('.g-dr').hidden);
$('calc').click(); truth('undrained without c_u is refused', /c_u,k|cu,k/.test(err()));
set('cu', '120'); $('calc').click(); truth('undrained c_u 120 kPa checked', !err() && /Bearing, combination 2/.test(res()));
set('ground', 'drained');
$('addCase').click(); $('calc').click(); truth('a fifth load case (slew locked)', d.querySelectorAll('table.ctab tbody tr').length === 5 && /slew locked/.test(res()));
$('calc').click(); $('printBtn').click();
truth('print: two drawings, the checks and the table', w.printed && $('report').querySelectorAll('svg').length === 2 && $('report').querySelectorAll('table.rt').length === 1);
const w2 = page(w.localStorage.getItem('et-crane-base-v1'));
truth('inputs restored', w2.document.querySelectorAll('#caseRows .row').length === 5 && w2.document.getElementById('cu').value === '120');
const w3 = page(), ev = (el, tp) => el.dispatchEvent(new w3.Event(tp, { bubbles: true }));
const L = w3.document.getElementById('L'); L.value = '6.5'; ev(L, 'input');
setTimeout(() => {
  truth('live: the section follows the base size', /L 6\.50 m/.test(w3.document.getElementById('drawings').textContent));
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
}, 400);
