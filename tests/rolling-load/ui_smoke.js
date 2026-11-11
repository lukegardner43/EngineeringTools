// Drives "Rolling Load Analysis.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Rolling Load Analysis.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-rolling-load-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('defaults: one span, two loads; the arrangement drawn', d.querySelectorAll('#spanRows .row').length === 1 && d.querySelectorAll('#wheelRows .row').length === 2 && /85\.0/.test($('drawings').textContent));
truth('the first load has no spacing', d.querySelectorAll('#wheelRows .s')[0].disabled && !d.querySelectorAll('#wheelRows .s')[1].disabled);
$('calc').click();
truth('calculated: M_Ed 339.9 kNm, deflection passes', /339\.9 kNm/.test(res()) && /passes/.test(res()) && !$('results').querySelector('.err'));
truth('three drawings, spans and reactions tables', $('results').querySelectorAll('svg.dk').length === 3 && $('results').querySelectorAll('table.t').length === 2);
truth('calculation: train, method, the largest sagging, supports', /resultant/.test(res()) && /influence lines/.test(res()) && /217\.6 kNm/.test(res()) && /support 2/.test(res()));
// a second span
$('addSpan').click(); $('calc').click();
truth('two spans: hogging at the middle support, three supports', /hogging/.test(res()) && $('results').querySelectorAll('table.t')[1].querySelectorAll('tbody tr').length === 3);
d.querySelectorAll('#spanRows .xbtn')[1].click();
// a third load
$('addWheel').click(); truth('a third load', d.querySelectorAll('#wheelRows .row').length === 3); $('calc').click(); truth('… calculated', /3 loads/.test(res()));
d.querySelectorAll('#wheelRows .xbtn')[2].click();
// fixed ends, cantilever
set('supL', 'fixed'); set('supR', 'free'); $('calc').click(); truth('cantilever: hogging, a doubled deflection limit', /hogging/.test(res()) && /cantilever/.test(res()));
set('supL', 'free'); $('calc').click(); truth('a mechanism is reported', /mechanism/.test($('results').querySelector('.err').textContent));
set('supL', 'pin'); set('supR', 'pin');
// factors
set('phi', '1.25'); $('calc').click(); truth('φ raises M_Ed', /φ 1\.25|1\.25 M/.test(res()) && !/339\.9 kNm/.test(res().split('Calculation')[0]));
set('phi', '1');
$('calc').click(); $('printBtn').click();
truth('print: three drawings, tables, checks', w.printed && $('report').querySelectorAll('svg').length === 3 && $('report').querySelectorAll('table.rt').length === 2 && /Deflection, span 1/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-rolling-load-v1'));
truth('inputs restored', w2.document.querySelectorAll('#spanRows .row').length === 1 && w2.document.querySelectorAll('#wheelRows .P')[1].value === '85' && w2.document.getElementById('phi').value === '1');
const w3 = page(), ev = (el, tp) => el.dispatchEvent(new w3.Event(tp, { bubbles: true }));
const L = w3.document.querySelector('#spanRows .L'); L.value = '11'; ev(L, 'input');
setTimeout(() => {
  truth('live: the arrangement follows the span', /11\.00 m/.test(w3.document.getElementById('drawings').textContent));
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
}, 350);
