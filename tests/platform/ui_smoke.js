// Drives "Working Platforms.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Working Platforms.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-platform-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, err = () => (($('results').querySelector('.err') || {}).textContent || '');
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('defaults: BR 470\'s soft clay example, two drawings', $('cu').value === '24' && $('drawings').querySelectorAll('svg.dk').length === 2);
$('calc').click();
truth('checked: a 0.725 m platform', /PASS/.test(res()) && /0\.725 m platform/.test(res()) && !err());
truth('checks, the two cases and the calculation', $('results').querySelectorAll('.ck').length === 6 && $('results').querySelectorAll('table.ctab tbody tr').length === 2);
$('rOn').checked = true; $('rOn').dispatchEvent(new w.Event('change', { bubbles: true })); $('calc').click();
truth('with a 30 kN/m geogrid: 0.625 m, the unreinforced checks shown', /0\.625 m platform/.test(res()) && /without the geosynthetic/.test(res()) && !d.querySelector('.g-reinf').hidden);
$('rOn').checked = false; $('rOn').dispatchEvent(new w.Event('change', { bubbles: true }));
set('sub', 'granular'); truth('granular: φ′ and the water table shown', !d.querySelector('.g-gran').hidden && d.querySelector('.g-coh').hidden);
set('phiS', '35'); set('gS', '20'); set('W', '0.5'); set('L1', '3'); set('L2', '2.5'); set('q2k', '220'); $('calc').click();
truth('granular subgrade: BR 470\'s 0.38 m, to 0.400 m', /0\.400 m platform/.test(res()) && !err());
set('phiP', '30'); $('calc').click(); truth('a platform φ′ under 35° is refused', /35° to 50°/.test(err()));
set('phiP', '40'); set('Dprop', '0.3'); $('calc').click(); truth('a proposed 0.3 m fails', /FAIL/.test(res()) && /Platform thickness/.test(res()));
$('printBtn').click();
truth('print: two drawings, the checks and the table', w.printed && $('report').querySelectorAll('svg').length === 2 && $('report').querySelectorAll('table.rt').length === 1);
const w2 = page(w.localStorage.getItem('et-platform-v1'));
truth('inputs restored', w2.document.getElementById('sub').value === 'granular' && w2.document.getElementById('Dprop').value === '0.3');
const w3 = page(), ev = (el, tp) => el.dispatchEvent(new w3.Event(tp, { bubbles: true }));
const q = w3.document.getElementById('q2k'); q.value = '260'; ev(q, 'input');
setTimeout(() => {
  truth('live: the drawings follow the load', /1\.2 × 260 = 312 kPa/.test(w3.document.getElementById('drawings').textContent));
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
}, 400);
