// Drives "Beam Web Openings.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js): steel and composite modes,
// adding and removing openings, point loads, the printed sheet, saved inputs and validation.
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Beam Web Openings.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-web-openings-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), calc = () => $('calc').click(), res = () => $('results').textContent, err = () => $('results').querySelector('.err');
truth('page loads without script errors', w.errs.length === 0);
truth('three default openings, steel mode', $('ops').children.length === 3 && !$('gk').closest('.card').classList.contains('hidden') && $('hs').closest('.card').classList.contains('hidden'));
calc(); truth('steel: verdict, opening and web-post checks', /PASS|FAIL/.test(res()) && /Vierendeel bending/.test(res()) && /Web-post 1–2/.test(res()) && !err());
truth('steel: span drawn with three openings', $('results').querySelectorAll('#drawings svg.dk').length === 2 && /3 openings at true scale/.test($('drawings').textContent));
$('pts').value = '6.5, 10, 15'; calc(); truth('steel: point load accepted', !err() && /Total deflection incl. openings/.test(res()));
$('addOp').click(); truth('opening added', $('ops').children.length === 4);
const r4 = $('ops').children[3]; r4.querySelector('.o-sh').value = 'elong'; r4.querySelector('.o-sh').onchange(); r4.querySelector('.o-x').value = '7.6'; r4.querySelector('.o-l').value = '500'; r4.querySelector('.o-h').value = '200';
calc(); truth('elongated opening checked', /Opening 4 \(500×200/.test(res()) && !err());
r4.querySelector('.xbtn').click(); truth('opening removed', $('ops').children.length === 3);
d.querySelector('#modeSeg button[data-m=comp]').click(); truth('composite mode shows the slab inputs', !$('hs').closest('.card').classList.contains('hidden') && $('gk').closest('.card').classList.contains('hidden'));
calc(); truth('composite: beam and opening checks', /Composite bending/.test(res()) && /Opening 1/.test(res()) && !err());
truth('composite (unpropped): construction-stage opening checks', /Construction: Opening 1/.test(res()));
$('propped').checked = true; calc(); truth('composite (propped): no construction-stage opening checks', !/Construction: Opening/.test(res()));
$('printBtn').click(); truth('print: sheet built', w.printed && /Web openings/.test($('report').textContent) && /Vierendeel/.test($('report').textContent));
const saved = w.localStorage.getItem('et-web-openings-v1'); truth('inputs saved with the openings', saved && JSON.parse(saved).ops.length === 3 && JSON.parse(saved).mode === 'comp');
const w2 = page(saved); truth('inputs restored on reload', w2.document.getElementById('ops').children.length === 3 && !w2.document.getElementById('hs').closest('.card').classList.contains('hidden'));
d.querySelector('#modeSeg button[data-m=steel]').click(); $('ops').children[1].querySelector('.o-x').value = '1.7'; calc(); truth('overlap rejected', /overlap/.test(res()));
$('ops').children[1].querySelector('.o-x').value = '2.2'; $('pts').value = '12, 5, 5'; calc(); truth('point load beyond the span rejected', /Point load 1/.test(res()));
$('pts').value = ''; $('ops').children[2].querySelector('.o-l').value = ''; calc(); truth('missing rectangular length rejected', /enter the length/.test(res()));
truth('no script errors', w.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
