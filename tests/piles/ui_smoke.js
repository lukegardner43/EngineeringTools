// Drives "Piles and Pile Groups.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Piles and Pile Groups.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-piles-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, err = () => (($('results').querySelector('.err') || {}).textContent || '');
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('defaults: two layers (fill, clay), four piles, both drawings', d.querySelectorAll('#layRows .row').length === 2 && d.querySelectorAll('#pileRows .row').length === 4 && $('drawings').querySelectorAll('svg.dk').length === 2 && d.querySelectorAll('#layRows .p1')[0].disabled);
$('calc').click();
truth('checked: PASS, combination 2 governs, the least length given', /PASS/.test(res()) && /Governs: pile in compression, combination 2/.test(res()) && /m would do/.test(res()) && !err());
truth('checks (4), the pile table and the calculation', $('results').querySelectorAll('.ck').length === 4 && $('results').querySelectorAll('table.ctab tbody tr').length === 4 && /Characteristic/.test(res()));
// a sand layer below
$('addLay').click(); const rows = d.querySelectorAll('#layRows .row'), r3 = rows[2]; const ty = r3.querySelector('.type'); ty.value = 'sand'; ty.dispatchEvent(new w.Event('change', { bubbles: true }));
truth('a sand layer: its labels and defaults', /φ′/.test(r3.querySelector('.l1').textContent) && r3.querySelector('.p1').value === '32');
set('L', '34'); $('calc').click(); truth('a pile into the sand: checked, base in sand', !err() && /in sand at 34\.00 m/.test(res()));
set('L', '40'); $('calc').click(); truth('a pile below the ground is refused', /below the layers/.test(err()));
set('L', '25'); d.querySelectorAll('#layRows .xbtn')[2].click();
// one pile alone
while (d.querySelectorAll('#pileRows .row').length > 1) d.querySelectorAll('#pileRows .xbtn')[1].click();
set('MxQ', '0'); set('G', '800'); set('Q', '300'); $('calc').click();
truth('one pile alone: no group table or block, one drawing', !$('results').querySelector('table.ctab') && !/block/i.test(res()) && $('drawings').querySelectorAll('svg.dk').length === 1);
$('addPile').click(); $('addPile').click(); set('MxQ', '200'); $('calc').click();
truth('piles in a line with a moment about the line: refused', /in a line/.test(err()));
set('MxQ', '0'); set('type', 'driven'); $('calc').click(); truth('driven: Table A.NA.6', /A\.NA\.6/.test(res()));
$('sls').checked = true; $('sls').dispatchEvent(new w.Event('change', { bubbles: true })); $('calc').click(); truth('explicit SLS: the lower R4 factors', /with explicit SLS verification/.test(res()));
$('calc').click(); $('printBtn').click();
truth('print: the drawings, the checks', w.printed && $('report').querySelectorAll('svg').length >= 1 && /Pile in compression/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-piles-v1'));
truth('inputs restored', w2.document.querySelectorAll('#pileRows .row').length === 3 && w2.document.getElementById('type').value === 'driven' && w2.document.getElementById('sls').checked);
const w3 = page(), ev = (el, tp) => el.dispatchEvent(new w3.Event(tp, { bubbles: true }));
const L = w3.document.getElementById('L'); L.value = '22'; ev(L, 'input');
setTimeout(() => {
  truth('live: the drawing follows the length', /22\.00 m/.test(w3.document.getElementById('drawings').textContent));
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
}, 400);
