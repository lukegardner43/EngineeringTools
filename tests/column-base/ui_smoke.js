// Drives "Steel Column and Base Plate Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Column and Base Plate Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-column-base-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), calc = () => $('calc').click(), res = () => $('results').textContent;
truth('page loads without script errors', w.errs.length === 0);
truth('UKC list with the default column', $('section').options.length > 20 && $('section').value === '254×254×73 UKC');
truth('actions table: 11 rows × G, Q, W', d.querySelectorAll('#actTable input').length === 33);
calc();
truth('verdict, column and base checks', /PASS|FAIL/.test(res()) && /Flexural and torsional buckling/.test(res()) && /Simple column interaction/.test(res()) && /Axial Compression \(Effective Area\)/.test(res()) && !$('results').querySelector('.err'));
truth('15 ULS combinations listed (6.10, wind both ways)', /15 ULS combinations/.test(res()) && d.querySelectorAll('#results table.t')[0].rows.length >= 2);
truth('elevation and base plate drawings', !!$('results').querySelector('svg.elev') && !!$('results').querySelector('svg.jd'));
truth('SN048 breakdown shown', /SN048b:/.test(res()));
$('rule').value = '6.10ab'; calc(); truth('6.10a/b: 25 combinations', /25 ULS combinations/.test(res()));
$('simple').checked = false; $('simple').onchange(); calc(); truth('without simple construction: no SN048 bar, share disabled', !/Simple column interaction/.test(res()) && $('share').disabled);
$('bpOn').checked = false; $('bpOn').onchange(); calc(); truth('base plate off: column only', !/Column base/.test(res()) && $('bpBox').classList.contains('hidden') && !$('results').querySelector('svg.jd'));
$('bpOn').checked = true; $('bpOn').onchange();
$('a-MzB-G').value = '5'; calc(); truth('minor-axis base moment flagged', /minor-axis moment acts at the base/.test(res()));
$('a-MzB-G').value = '0'; $('series').value = 'UKB'; $('series').onchange(); calc(); truth('plate shallower than the UKB plus the bolt row: error shown', /anchor bolts/.test(res()));
$('D').value = '560'; calc(); truth('UKB column with a deeper base plate calculates', /UKB/.test(res()) && !$('results').querySelector('.err'));
$('printBtn').click(); truth('print: A4 sheet with column and base sections', w.printed && /Steel column and base plate/.test($('report').textContent) && /Column base/.test($('report').textContent) && /Summary/.test($('report').textContent));
$('H').value = '0'; calc(); truth('invalid height reported', /Height must be positive/.test(res()));
$('H').value = '5.2'; $('ex').value = '200'; calc(); truth('anchor geometry error reported', /anchor bolts/.test(res()));
$('ex').value = '50'; calc();
const w2 = page(w.localStorage.getItem('et-column-base-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored', $2('series').value === 'UKB' && $2('H').value === '5.2' && $2('rule').value === '6.10ab' && !$2('simple').checked && $2('share').disabled);
truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
