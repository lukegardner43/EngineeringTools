// Drives "Steel Column Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Column Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store, key = 'et-steel-column-v1') {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem(key, store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), calc = () => $('calc').click(), res = () => $('results').textContent;
truth('page loads without script errors', w.errs.length === 0);
truth('UKC list with the default column', $('section').options.length > 20 && $('section').value === '254×254×73 UKC');
truth('actions table: 11 rows × G, Q, W', d.querySelectorAll('#actTable input').length === 33);
truth('no base plate inputs (Base Plate Design does the base)', !$('bpOn') && !$('tp') && /Base Plate Design/.test(d.body.textContent));
truth('column drawing before a Check', d.querySelectorAll('#drawings svg.dk').length === 2);
calc();
truth('verdict and column checks, no base checks', /PASS|FAIL/.test(res()) && /Flexural and torsional buckling/.test(res()) && /Simple column interaction/.test(res()) && !/Effective Area/.test(res()) && !$('results').querySelector('.err'));
truth('15 ULS combinations listed (6.10, wind both ways)', /15 ULS combinations/.test(res()));
truth('elevation with moments and the cap plan drawn', d.querySelectorAll('#drawings svg.dk').length === 2 && /M<tspan[^>]*>y,nom<\/tspan>/.test($('drawings').innerHTML));
truth('SN048 breakdown shown', /SN048b:/.test(res()));
$('rule').value = '6.10ab'; calc(); truth('6.10a/b: 25 combinations', /25 ULS combinations/.test(res()));
$('simple').checked = false; $('simple').onchange(); calc(); truth('without simple construction: no SN048 bar, no cap plan, share disabled', !/Simple column interaction/.test(res()) && $('share').disabled && d.querySelectorAll('#drawings svg.dk').length === 1);
$('series').value = 'UKB'; $('series').onchange(); calc(); truth('UKB column calculates', /UKB/.test(res()) && !$('results').querySelector('.err'));
$('printBtn').click(); truth('print: A4 sheet with the drawings and the actions at the base', w.printed && /Steel column/.test($('report').textContent) && /Actions at the base/.test($('report').textContent) && $('report').querySelectorAll('svg.dk').length >= 1);
$('H').value = '0'; calc(); truth('invalid height reported', /Height must be positive/.test(res()));
$('H').value = '5.2'; calc();
// hand-over: every combination's actions at the base go to Base Plate Design, keeping its plate inputs
w.localStorage.setItem('et-base-plate-v1', JSON.stringify({ v: 1, D: '520', tp: '35', cases: [['old', '1', '0', '0']] }));
try { $('toBase').onclick(); } catch (e) { /* jsdom does not navigate; the hand-over is in storage */ }
const bs = JSON.parse(w.localStorage.getItem('et-base-plate-v1'));
truth('hand-over: cases from the combinations, section with them, plate inputs kept', Array.isArray(bs.cases) && bs.cases.length >= 10 && bs.section === $('section').value && bs.D === '520' && bs.tp === '35' && bs.from === 'Steel Column Design');
const w2 = page(w.localStorage.getItem('et-steel-column-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored', $2('series').value === 'UKB' && $2('H').value === '5.2' && $2('rule').value === '6.10ab' && !$2('simple').checked && $2('share').disabled);
// first visit after the split: the combined tool's saved inputs are picked up
const old = JSON.parse(w.localStorage.getItem('et-steel-column-v1')); old.H = '6.1'; old.bpOn = true;
const w3 = page(JSON.stringify(old), 'et-column-base-v1');
truth('first visit: inputs from Steel Column and Base Plate Design', w3.document.getElementById('H').value === '6.1' && w3.errs.length === 0);
truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
