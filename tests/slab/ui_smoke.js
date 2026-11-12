// Drives "Ground-Bearing Slab.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Ground-Bearing Slab.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-slab-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, err = () => (($('results').querySelector('.err') || {}).textContent || '');
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('defaults: a 175 mm steel fibre slab, three point loads and a line load, two drawings', $('h').value === '175' && $('reo').value === 'fibre' && d.querySelectorAll('#ptRows .row').length === 3 && d.querySelectorAll('#lnRows .row').length === 1 && $('drawings').querySelectorAll('svg.dk').length === 2);
$('calc').click();
truth('checked: PASS 0.626', /PASS/.test(res()) && /0\.626/.test(res()) && !err());
truth('nine checks, the point load table and the calculation', $('results').querySelectorAll('.ck').length === 9 && $('results').querySelectorAll('table.ctab tbody tr').length === 3 && /l = \[/.test(res()));
truth('fibre inputs shown, the bar inputs hidden', !d.querySelector('.g-fib').hidden && d.querySelector('.g-bar').hidden);
set('reo', 'fabric'); set('As', '393'); set('phi', '10'); $('calc').click();
truth('fabric: the bar inputs shown, A393 gives M_p 19.48 and the 0.08% check', !d.querySelector('.g-bar').hidden && d.querySelector('.g-fib').hidden && /19\.48/.test(res()) && /Fabric at least 0\.08%/.test(res()));
$('fatOn').checked = true; $('fatOn').dispatchEvent(new w.Event('change', { bubbles: true }));
truth('fatigue: the axle inputs shown', !d.querySelector('.g-fat').hidden);
$('calc').click(); truth('fatigue on a fabric slab: Appendix E checked', /Fatigue under materials handling traffic/.test(res()) && !err());
set('reo', 'fibre'); $('calc').click(); truth('fatigue on a fibre slab is refused', /not for fibre/.test(err()));
$('fatOn').checked = false; $('fatOn').dispatchEvent(new w.Event('change', { bubbles: true }));
set('dowels', 'given'); truth('proprietary dowels: the per-dowel capacity shown, the bar size hidden', !d.querySelector('.g-dgiv').hidden && d.querySelector('.g-dbar').hidden);
set('dowels', 'bar');
$('addPt').click(); truth('a point load added', d.querySelectorAll('#ptRows .row').length === 4);
const r4 = d.querySelectorAll('#ptRows .row')[3]; r4.querySelector('.P').value = '400'; $('calc').click();
truth('400 kN static fails in bending', /FAIL/.test(res()) && /P4: internal, bending/.test(res()));
set('h', '140'); $('calc').click(); truth('140 mm is refused', /150 mm/.test(err()));
set('h', '175'); $('calc').click();
$('printBtn').click();
truth('print: two drawings, the checks and the load table', w.printed && $('report').querySelectorAll('svg').length === 2 && $('report').querySelectorAll('table.rt').length === 1);
const w2 = page(w.localStorage.getItem('et-slab-v1'));
truth('inputs restored', w2.document.getElementById('dowels').value === 'bar' && w2.document.querySelectorAll('#ptRows .row').length === 4 && w2.document.getElementById('As').value === '393');
const w3 = page(), ev = (el, tp) => el.dispatchEvent(new w3.Event(tp, { bubbles: true }));
const hh = w3.document.getElementById('h'); hh.value = '200'; ev(hh, 'input');
setTimeout(() => {
  truth('live: the drawings follow the thickness', /h 200/.test(w3.document.getElementById('drawings').textContent));
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
}, 400);
