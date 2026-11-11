// Drives "Load Take-down.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Load Take-down.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-load-takedown-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = el => !el.closest('.hidden');
truth('page loads without script errors', w.errs.length === 0);
truth('defaults: two build-ups, four levels, level selects list the build-ups', d.querySelectorAll('#buRows .bub').length === 2 && d.querySelectorAll('#levRows .row').length === 4 && d.querySelectorAll('#levRows .bu')[0].options.length === 3);
truth('load path drawn before Calculate', /ULS/.test($('drawings').textContent) && !/characteristic 61/.test(res().replace($('drawings').textContent, '')));
$('calc').click();
truth('calculated: ULS 84.0 kN/m, characteristic 61.1, strip 0.61 m', /ULS 84\.0 kN\/m/.test(res()) && /characteristic 61\.1 kN\/m/.test(res()) && /0\.61 m wide/.test(res()));
truth('tables: levels and build-ups; α 0.90 at the base', d.querySelectorAll('#results table.t').length === 2 && /0\.90/.test(d.querySelector('#results tr.base').textContent));
truth('calculation: build-ups, α_n and (6.10)', /Table 6\.2/.test(res()) && /6\.3\.1\.2\(11\)/.test(res()) && /\(6\.10\)/.test(res()));
// a third storey of flats
$('addLev').click(); const rows = () => [...d.querySelectorAll('#levRows .row')];
const r = rows()[4]; r.querySelector('.bu').value = 'b2'; r.querySelector('.trib').value = '2.25'; r.querySelector('.name').value = 'Basement';
$('calc').click(); truth('another floor raises the base and α_n to 0.8', /0\.80/.test(d.querySelector('#results tr.base').textContent) && d.querySelectorAll('#results tr').length > 6);
r.querySelector('.xbtn').click(); $('calc').click(); truth('removed again', /ULS 84\.0/.test(res()));
// a new build-up appears in the level selects
$('addBu').click(); truth('a new build-up is offered to the levels', d.querySelectorAll('#levRows .bu')[0].options.length === 4);
d.querySelectorAll('#buRows .bub')[2].querySelector('.bx').click(); truth('… and goes when removed', d.querySelectorAll('#levRows .bu')[0].options.length === 3);
// given imposed load shows its field
const c = d.querySelectorAll('#buRows .bub')[1].querySelector('.cat'); c.value = 'X'; c.dispatchEvent(new w.Event('change', { bubbles: true }));
truth('given imposed load: q_k field shown, partitions hidden', shown(d.querySelectorAll('#buRows .bub')[1].querySelector('.q')) && !shown(d.querySelectorAll('#buRows .bub')[1].querySelector('.part')));
c.value = 'A1'; c.dispatchEvent(new w.Event('change', { bubbles: true }));
// column
set('type', 'column'); truth('column: tributary area and kN/m labels', rows()[0].querySelector('.lt').textContent === 'Trib. area (m²)' && rows()[0].querySelector('.ls').textContent === 'Column (kN/m)');
$('calc').click(); truth('column: results in kN, pad size', / kN /.test(res()) && /square/.test(res()));
set('type', 'wall');
// 6.10a/b
set('comb', '6.10ab'); $('calc').click(); truth('(6.10a) and (6.10b)', /\(6\.10a\)/.test(res()) && /\(6\.10b\)/.test(res()));
set('comb', '6.10');
// hipped roof
set('hipOn', true); truth('hip inputs shown', shown($('hB')) && $('hBu').options.length === 2);
$('hBu').value = 'b1'; $('calc').click();
truth('hip: side and end wall loads and the plan', /Side walls, between the hips/.test(res()) && /End walls, peak/.test(res()) && $('results').querySelectorAll('svg.dk').length === 2);
// print and restore
$('printBtn').click(); truth('print: drawings, tables, calculation', w.printed && $('report').querySelectorAll('svg').length === 2 && $('report').querySelectorAll('table.rt').length >= 3 && /Strip footing width/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-load-takedown-v1'));
truth('inputs restored: build-ups, items, levels, hip', w2.document.querySelectorAll('#buRows .bub').length === 2 && w2.document.querySelectorAll('#buRows .items .row').length === 8 && w2.document.querySelectorAll('#levRows .row').length === 4 && w2.document.getElementById('hipOn').checked && w2.document.getElementById('hBu').value === 'b1' && w2.document.querySelectorAll('#levRows .bu')[1].value === 'b2');
// an error is reported, not thrown
const w3 = page(); w3.document.getElementById('qa').value = '10'; w3.document.getElementById('fw').value = '20'; w3.document.getElementById('calc').click();
truth('a footing heavier than the bearing pressure is reported', /less than the allowable/.test(w3.document.querySelector('#results .err').textContent) && /ULS/.test(w3.document.getElementById('results').textContent));
const ev = (el, tp) => el.dispatchEvent(new w3.Event(tp, { bubbles: true }));
w3.document.querySelectorAll('#levRows .trib')[0].value = '6'; ev(w3.document.querySelectorAll('#levRows .trib')[0], 'input');
setTimeout(() => {
  truth('live: the load path follows the inputs', /G 6\.69/.test(w3.document.getElementById('drawings').textContent));
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
}, 350);
