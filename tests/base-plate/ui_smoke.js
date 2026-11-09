// Drives "Base Plate Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Base Plate Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store, key = 'et-base-plate-v1') {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem(key, store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), calc = () => $('calc').click(), res = () => $('results').textContent;
truth('page loads without script errors', w.errs.length === 0);
truth('UKC list with the default column; three default cases', $('section').value === '254×254×73 UKC' && $('cases').rows.length === 3);
truth('drawings before a Check (base view and mechanism)', d.querySelectorAll('#drawings svg').length >= 2);
calc();
truth('verdict and base checks with their governing case', /PASS|FAIL/.test(res()) && /Axial Compression \(Effective Area\)/.test(res()) && /Concrete Cone/.test(res()) && /Maximum compression/.test(res()) && !$('results').querySelector('.err'));
truth('cases table with each case\'s governing check', d.querySelectorAll('#results table.t tr').length === 4);
$('addCase').click(); truth('a case added', $('cases').rows.length === 4);
const r4 = $('cases').rows[3]; r4.querySelector('.c-N').value = '400'; r4.querySelector('.c-M').value = '80'; r4.querySelector('.c-V').value = '10'; calc();
truth('the new case is checked', /Case 4/.test(res()) && d.querySelectorAll('#results table.t tr').length === 5);
$('cases').rows[3].querySelector('button.rm').click(); truth('a case removed', $('cases').rows.length === 3);
$('series').value = 'UKB'; $('series').onchange(); calc(); truth('UKB on a 450 plate: anchor geometry error', /anchor bolts/.test(res()));
$('D').value = '560'; calc(); truth('UKB with a deeper plate calculates', /UKB/.test(res()) && !$('results').querySelector('.err'));
$('printBtn').click(); truth('print: A4 sheet with drawings and the summary', w.printed && /Column base plate/.test($('report').textContent) && /Summary/.test($('report').textContent) && $('report').querySelectorAll('svg').length >= 2);
const st = w.localStorage.getItem('et-base-plate-v1'), w2 = page(st), $2 = id => w2.document.getElementById(id);
truth('inputs and cases restored', $2('series').value === 'UKB' && $2('D').value === '560' && $2('cases').rows.length === 3);
// hand-over from Steel Column Design: its combinations become the cases, with a note
const hand = JSON.parse(st); hand.cases = [['1.35G + 1.5Q', '1316.1', '0.0', '4.8'], ['1.0G − 1.5W', '420.0', '12.0', '25.0']]; hand.from = 'Steel Column Design';
const w3 = page(JSON.stringify(hand)), $3 = id => w3.document.getElementById(id);
truth('hand-over: cases from Steel Column Design, noted', $3('cases').rows.length === 2 && /Steel Column Design/.test($3('fromCol').textContent) && !$3('fromCol').classList.contains('hidden'));
// first visit after the split: the combined tool's saved column and plate are picked up, default actions
const w4 = page(JSON.stringify({ v: 1, series: 'UKC', section: '305×305×97 UKC', grade: 'S355', D: '500', B: '500', tp: '35', A: {} }), 'et-column-base-v1');
truth('first visit: column and plate from Steel Column and Base Plate Design', w4.document.getElementById('section').value === '305×305×97 UKC' && w4.document.getElementById('tp').value === '35' && w4.document.getElementById('cases').rows.length === 3);
truth('no script errors', [w, w2, w3, w4].every(x => x.errs.length === 0));
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
