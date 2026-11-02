// Drives "RC Stair Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Stair Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; w.scrollTo = () => {}; if (store) w.localStorage.setItem('et-rc-stair-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, shown = el => !el.classList.contains('hidden');
truth('page loads without script errors', w.errs.length === 0);
truth('flight pane first', shown($('pane-flight')) && !shown($('pane-landing')));
$('calc').click();
truth('flight: verdict, elevation, grouped checks, values', /PASS|FAIL/.test(res()) && !!$('results').querySelector('svg.stair') && /Landing A/.test(res()) && /Flight/.test(res()) && /Landing C/.test(res()) && /7\.4\.2/.test(res()) && /ULS reactions/.test(res()));
$('pA').value = '600'; $('pC').value = '300'; $('calc').click();
truth('projections: top steel checked at both supports', /Support at landing A \(top\)/.test(res()) && /Support at landing C \(top\)/.test(res()));
$('sugB').click(); truth('suggest bottom bars: a passing set', /PASS/.test(res()) || !/Flight[\s\S]*FAIL/.test(res())); const bs = $('bs').value;
$('sugT').click(); truth('suggest top bars: page passes', /PASS/.test(res()));
$('supports').value = 'monolithic'; $('pA').value = '0'; $('pC').value = '0'; $('calc').click(); truth('built-in ends: 25 % top steel', /Support at landing A \(top\)/.test(res()));
$('comb').value = '6.10ab'; $('calc').click(); truth('6.10a and b', /6\.10a and 6\.10b/.test(res()) && !$('results').querySelector('.err'));
$('t').value = '0'; $('calc').click(); truth('bad input reported', !!$('results').querySelector('.err')); $('t').value = '175'; $('calc').click();
$('toLanding').click();
truth('reactions carried to the half landing', shown($('pane-landing')) && +$('GA').value > 0 && /From the flight/.test($('fromFlight').textContent) && /Half landing/.test(res()) && !!$('results').querySelector('svg.stair'));
$('lw').value = '2400'; $('calc').click(); truth('landing: effective width 1.8 m', /1\.80/.test(res()));
$('printBtn').click(); truth('print: A4 sheet with the working', w.printed && /RC stair half landing/.test($('report').textContent) && /K = M_Ed|K = MEd/.test($('report').textContent) && $('report').querySelectorAll('svg').length === 1);
const w2 = page(w.localStorage.getItem('et-rc-stair-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored, landing mode included', $2('lw').value === '2400' && $2('comb').value === '6.10ab' && !w2.document.getElementById('pane-landing').classList.contains('hidden'));
truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
