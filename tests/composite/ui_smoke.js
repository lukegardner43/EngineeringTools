// Drives "Composite Beam Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js): each decking type, propped
// construction, the printed sheet, saved inputs and input validation.
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Composite Beam Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-composite-beam-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), calc = () => $('calc').click(), res = () => $('results').textContent;
truth('page loads without script errors', w.errs.length === 0);
truth('UKB list filled, default 457×191×67', $('section').options.length > 50 && $('section').value === '457×191×67 UKB');
calc(); truth('perpendicular decking: verdict and checks', /PASS|FAIL/.test(res()) && /Composite bending/.test(res()) && /Natural frequency/.test(res()) && !$('results').querySelector('.err'));
truth('perpendicular decking: no construction LTB', /decking restrains the beam/.test(res()));
$('deck').value = 'para'; calc(); truth('parallel decking: construction LTB checked', /with LTB/.test(res()));
$('deck').value = 'none'; calc(); truth('solid slab: calculates', /Composite bending/.test(res()) && !$('results').querySelector('.err'));
$('propped').checked = true; calc(); truth('propped: construction checks omitted', !/Construction: bending/.test(res()) && /propped/.test(res()));
$('printBtn').click(); truth('print: calculation sheet built and printed', w.printed && /Composite beam/.test($('report').textContent) && /Checks/.test($('report').textContent));
const saved = w.localStorage.getItem('et-composite-beam-v1'); truth('inputs saved', saved && JSON.parse(saved).deck === 'none');
const w2 = page(saved); truth('inputs restored on reload', w2.document.getElementById('deck').value === 'none' && w2.document.getElementById('propped').checked);
$('propped').checked = false; $('deck').value = 'perp'; $('hp').value = '140'; calc(); truth('rib deeper than the slab rejected', /Rib height/.test(res()));
$('hp').value = '60'; $('L').value = '0'; calc(); truth('zero span rejected', /Span must be positive/.test(res()));
$('L').value = '9'; $('bL').value = '0'; $('bR').value = '0'; calc(); truth('no adjacent beam rejected', /adjacent beam/.test(res()));
$('bL').value = '3'; $('section').value = '254×102×22 UKB'; $('L').value = '12'; calc(); truth('overloaded beam reports FAIL', /FAIL/.test(res()));
truth('no script errors', w.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
