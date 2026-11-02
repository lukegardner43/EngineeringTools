// Drives "RC Corbel and Nib Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Corbel and Nib Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; w.scrollTo = () => {}; if (store) w.localStorage.setItem('et-rc-corbel-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, shown = el => !el.classList.contains('hidden');
const sel = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('corbel first: width and bar count shown, nib fields hidden', shown(d.querySelector('.form-group.corbel')) && !shown(d.querySelector('.form-group.nib')) && !shown(d.querySelector('.hval')));
$('calc').click();
truth('corbel: verdict, elevation, checks, values', /PASS|FAIL/.test(res()) && !!$('results').querySelector('svg.elev') && d.querySelectorAll('#results .ck').length >= 9 && /B\.4\.2/.test(res()) && /ax2/.test(res()));
truth('default corbel fails on the front bend and says so', /FAIL/.test(res()) && /Governs: tie anchored at the front/.test(res()) && /welded/.test(res()));
sel('frontAnch', 'welded'); truth('welded bar shows its diameter', shown(d.querySelector('.weld')));
$('calc').click(); truth('welded cross bar: passes', /PASS/.test(res()) && /welded bar and bend/.test(res()));
sel('hRule', 'value'); truth('given horizontal force shows its input', shown(d.querySelector('.hval')));
$('HEd').value = '0'; $('calc').click(); truth('no horizontal force: CCIP-057 note', /0\.2FEd/.test(res()));
sel('bearing', 'bedded'); truth('bedded bearing shows fbed', shown(d.querySelector('.bed'))); $('calc').click(); truth('bedded bearing checked', /10\.9\.5\.2/.test(res()));
$('ac').value = '600'; $('calc').click(); truth('bad geometry reported', !!$('results').querySelector('.err') && /front/.test(res())); $('ac').value = '200';
d.querySelector('#modes button[data-m=nib]').click();
truth('nib: per-metre inputs, defaults swapped in', shown(d.querySelector('.form-group.nib')) && !shown(d.querySelector('.form-group.corbel')) && $('FEd').value === '120' && d.querySelector('.uF').textContent === 'kN/m');
$('hanging').checked = true; $('hanging').dispatchEvent(new w.Event('change', { bubbles: true })); truth('hanging nib shows hanger inputs', shown(d.querySelector('.hng')));
$('calc').click(); truth('nib: per metre, hanger check', /Nib per metre/.test(res()) && /6\.2\.1\(9\)/.test(res()) && /kN\/m/.test(res()) && !$('results').querySelector('.err'));
$('printBtn').click(); truth('print: A4 sheet with the model and checks', w.printed && /PD 6687-1 B\.4/.test($('report').textContent) && $('report').querySelectorAll('svg').length === 1 && /Strut-and-tie/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-rc-corbel-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored, nib mode included', $2('hanging').checked && $2('frontAnch').value === 'welded' && !w2.document.querySelector('.form-group.nib').classList.contains('hidden'));
truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
