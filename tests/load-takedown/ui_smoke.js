// Drives "Load Take-down.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Load Take-down.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-load-takedown-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const fire = (el, tp) => el.dispatchEvent(new w.Event(tp, { bubbles: true }));
const set = (id, v) => { const el = $(id); if (el.type === 'checkbox') el.checked = v; else el.value = v; fire(el, 'change'); };
const rows = () => [...d.querySelectorAll('#tdRows tr:not(.trow)')];
const cell = (i, k, v) => { const el = rows()[i].querySelector('.' + k); el.value = v; fire(el, 'input'); return el; };
const shown = el => !el.closest('.hidden');
const err = () => ($('results').querySelector('.err') || {}).textContent || '';
truth('page loads without script errors', w.errs.length === 0);
truth('defaults: the take-down table with four rows, area, line and point loads and the totals', rows().length === 4 && d.querySelectorAll('#ltd thead tr.g th').length === 8 && rows()[0].querySelectorAll('input.c').length === 11);
truth('live totals as a spreadsheet: rows 3.50 / 8.75 / 8.75 / 14.00, Sum 35 / 14 / 21, SLS 70.00, ULS 97.65', rows().map(r => r.querySelector('.tDL').textContent).join() === '3.50,8.75,8.75,14.00' && $('sDL').textContent === '35.00' && $('sSIDL').textContent === '14.00' && $('sLL').textContent === '21.00' && /70\.00 kN\/m/.test($('tSLS').textContent) && /97\.65 kN\/m/.test($('tULS').textContent));
truth('a sum in a cell: the wall’s 0.1*20', rows()[3].querySelector('.aD').value === '0.1*20' && rows()[3].querySelector('.tDL').textContent === '14.00');
truth('load path drawn before Calculate', /ULS 97\.7 kN\/m/.test($('drawings').textContent));
$('calc').click();
truth('calculated: ULS 97.7 kN/m, SLS 70.0', /ULS 97\.7 kN\/m/.test(res()) && /SLS 70\.0 kN\/m/.test(res()));
truth('results: the totals down the building and the calculation', d.querySelectorAll('#results table.t tbody tr').length === 4 && /ULS \(6\.10\)/.test(res()) && /1\.35 × \(35\.00 \+ 14\.00\) \+ 1\.5 × 21\.00 = 97\.65/.test(res()));
// typing updates the totals at once
cell(0, 'pL', '5'); truth('a point load typed into the roof row: LL 8.50, ULS 105.15 at once', rows()[0].querySelector('.tLL').textContent === '8.50' && /105\.15/.test($('tULS').textContent));
const bad = cell(0, 'pL', '5+'); truth('a bad cell is marked and the totals wait', bad.classList.contains('bad') && rows()[0].querySelector('.tLL').textContent === '–' && $('tULS').textContent === '–');
cell(0, 'pL', '');
// rows: add, copy, remove
$('addRow').click(); truth('a row added', rows().length === 5);
cell(4, 'name', 'Ground beam'); cell(4, 'L', '1'); cell(4, 'lD', '0.45*0.3*25'); truth('a line load row: 3.38 kN/m', rows()[4].querySelector('.tDL').textContent === '3.38');
rows()[1].querySelector('.cpbtn').click(); truth('a row copied below itself', rows().length === 6 && rows()[2].querySelector('.name').value === 'Second floor (copy)' && rows()[2].querySelector('.tDL').textContent === '8.75');
rows()[2].querySelector('.xbtn').click(); rows()[4].querySelector('.xbtn').click(); truth('removed again', rows().length === 4 && /97\.65/.test($('tULS').textContent));
// the reduction shows the floor ticks
truth('no reduction: the floor column hidden', !$('ltd').classList.contains('red-on'));
set('red', 'an'); truth('α_n: the floor column shown, the floors already ticked: ULS 95.03', $('ltd').classList.contains('red-on') && rows()[1].querySelector('.red').checked && /95\.03/.test($('tULS').textContent));
$('calc').click(); truth('α_n 0.90 in the results', /0\.90/.test(d.querySelector('#results tr.base').textContent) && /6\.3\.1\.2\(11\)/.test(res()));
set('red', 'none');
// column, 6.10a/b, footing
set('type', 'column'); truth('column: totals in kN', [...d.querySelectorAll('.tu')].every(e => e.textContent === 'kN') && / kN$/.test($('tULS').textContent) && shown(d.querySelector('.u-col')));
set('qa', '150'); $('calc').click(); truth('column: a pad size', /square/.test(res()));
set('type', 'wall'); set('qa', '100');
set('comb', '6.10ab'); truth('(6.10a) and (6.10b): 92.69 in the table', /92\.69/.test($('tULS').textContent) && /6\.10a/.test($('ulsLab').textContent));
$('calc').click(); truth('(6.10a) and (6.10b) in the calculation, the strip 0.70 m', /\(6\.10a\)/.test(res()) && /\(6\.10b\)/.test(res()) && /0\.70 m wide/.test(res()));
set('comb', '6.10');
// hipped roof
set('hipOn', true); truth('hip inputs and its loads shown', shown($('hB')) && /Side walls, between the hips/.test($('hipOut').textContent));
$('hipSide').click(); truth('the side wall load added as the top row', rows().length === 5 && rows()[0].querySelector('.name').value === 'Hipped roof, side wall' && rows()[0].querySelector('.L').value === '1' && rows()[0].querySelector('.tDL').textContent === '4.95');
$('calc').click(); truth('hip: the table and the plan', /End walls, peak/.test(res()) && $('results').querySelectorAll('svg.dk').length === 2);
// print and restore
$('printBtn').click(); truth('print: the take-down sheet, the drawings and the tables', w.printed && $('report').querySelectorAll('svg').length === 2 && $('report').querySelectorAll('table.ltdp tbody tr').length === 8 && /Strip footing width/.test($('report').textContent));
truth('the sheet lists each row\'s type', /Wall \/ facade/.test($('report').querySelector('table.ltdp').textContent));
// the rows' types: guessed, kept once chosen, drawn by type
const kinds = () => rows().map(r => r.querySelector('.kind').value).join();
truth('types guessed: the hip row a roof, roof, floor, floor, wall', kinds() === 'roof,roof,floor,floor,wall', kinds());
truth('the wall drawn as a facade over its storey, not a level', /wall \/ facade, over the storey/.test($('drawings').textContent));
$('addRow').click(); cell(5, 'name', 'Beam B4'); cell(5, 'pD', '15'); truth('a row with a beam\'s name and point loads: a point load, drawn as one', rows()[5].querySelector('.kind').value === 'point');
const ks = rows()[5].querySelector('.kind'); ks.value = 'other'; fire(ks, 'change'); cell(5, 'name', 'Beam B4 bearing'); truth('a type chosen is kept when the name changes', ks.value === 'other');
$('calc').click(); truth('drawn by type: the point load and the other load captioned', /other load/.test($('drawings').textContent) && /Other load/.test(d.querySelector('#results table.t').textContent));
rows()[5].querySelector('.xbtn').click();
// transfer beams, at any level
$('trAdd').click();
const tb = () => [...d.querySelectorAll('#trList .trb')], tq = (i, c) => tb()[i].querySelector('.' + c), tv = (i, c, v) => { const e = tq(i, c); e.value = v; fire(e, 'change'); };
truth('a transfer beam added: under First floor, the wall above standing on it from 2 m (to b), a line in the table', tb().length === 1 && tq(0, 'after').options.length === 6 && tq(0, 'after').selectedOptions[0].textContent === 'Under First floor' && shown(tq(0, 'a')) && shown(tq(0, 'b')) && d.querySelectorAll('#tdRows tr.trow').length === 1);
truth('… carried on down the left support: (6 − 4)/6 × 4 m of wall = × 1.333 of 25.95, + 3 own, + the wall 14 = 51.60 at once', /× 1\.333/.test(d.querySelector('#tdRows tr.trow').textContent) && $('sDL').textContent === '51.60' && /Carried down to the base/.test($('sumLab').textContent), $('sDL').textContent);
tv(0, 'follow', 'right'); tv(0, 'below', 'column'); truth('… down the right support, a column: the totals in kN, the spread hidden', / kN$/.test($('tULS').textContent) && !shown(tq(0, 'spread')));
$('calc').click();
truth('… calculated: the element steps to the support, the beam drawn, its own drawing, M and V', /Transfer beam 1, span 6\.00 m/.test($('drawings').textContent) && /carries on down the right support, a column/.test($('drawings').textContent) && /left support: ULS/.test($('drawings').textContent) && /Bending moment, ULS/.test(res()) && /Design actions on the beam/.test(res()));
truth('… the steps say how much goes on down', /down the right support, a column: 0\.667 of the wall’s load × 4\.00 m = × 2\.667/i.test(res()));
tv(0, 'on', 'support'); truth('carrying straight on at a support: no position, no choice of element below', !shown(tq(0, 'a')) && !shown(tq(0, 'below')) && /carries straight on at its right support/.test(d.querySelector('#tdRows tr.trow').textContent));
tv(0, 'on', 'beam'); tv(0, 'below', 'wall');
tq(0, 'addld').click(); const lb = tq(0, 'lds').querySelector('tr'); lb.querySelector('.a').value = '7.5'; lb.querySelector('.DL').value = '20'; fire(lb.querySelector('.DL'), 'input');
$('calc').click(); truth('a load beyond the support: carried as a cantilever, warned', /cantilever/.test(res()) && /hogging/.test(res()));
tv(0, 'after', '4'); tv(0, 'follow', 'none'); $('calc').click();
truth('stopping on a beam under the last row: the result on the beam, no footing', /on Transfer beam 1/.test(d.querySelector('#results .verdict').textContent) && /stops on Transfer beam 1/.test(res()) && !/strip .* m wide/.test($('drawings').textContent));
$('printBtn').click(); truth('… on the sheet: the transfer beams section and the result', /Transfer beams/.test($('report').textContent) && /Transfer beam 1: bending moment/.test($('report').textContent) && $('report').querySelectorAll('svg').length === 5);   // the load path, the beam, M, V and the hip
tv(0, 'after', '2'); $('calc').click(); truth('… with rows below it: an error naming them', /stops on Transfer beam 1 above it/.test(err()));
tv(0, 'after', '4'); $('calc').click();
const w2 = page(w.localStorage.getItem('et-load-takedown-v1'));
truth('inputs restored: rows, cells and the hip', w2.document.querySelectorAll('#tdRows tr:not(.trow)').length === 5 && w2.document.querySelectorAll('#tdRows tr:not(.trow)')[4].querySelector('.aD').value === '0.1*20' && w2.document.getElementById('hipOn').checked);
truth('… the types, the transfer beam and its load', [...w2.document.querySelectorAll('#tdRows tr:not(.trow) .kind')].map(e => e.value).join() === 'roof,roof,floor,floor,wall' && w2.document.querySelectorAll('#trList .trb').length === 1 && w2.document.querySelector('#trList .after').value === '4' && w2.document.querySelector('#trList .follow').value === 'none' && w2.document.querySelectorAll('#trList .lds tr').length === 1);
// a page saved with the first version's beams above and below opens as two transfer beams
const w5 = page(JSON.stringify({ v: 2, type: 'column', rows: [{ name: 'Roof', A: '10', aD: '1' }, { name: 'L1', A: '10', aD: '5' }], tAOn: true, tAL: '6', tAEnd: 'left', tASw: '1', tAAt: '0', tALoads: [{ type: 'point', a: '2', DL: '40' }], tBOn: true, tBL: '8', tBa: '3', tBSw: '2', tBLoads: [] }));
truth('… the first version\'s beams above and below open as two', w5.document.querySelectorAll('#trList .trb').length === 2 && w5.document.querySelectorAll('#trList .on')[0].value === 'support' && w5.document.querySelectorAll('#trList .follow')[1].value === 'none' && w5.errs.length === 0);
// a page saved by the earlier version opens as rows
const v1 = { v: 1, type: 'wall', red: 'an', comb: '6.10', qa: '100', fw: '0', seq: 3, hipOn: false, buildups: [
  { id: 'b1', name: 'Pitched roof', cat: 'H', pitch: '35', part: '0', snow: '0.45', items: [{ d: 'Tiles', g: '0.55', on: 'slope' }, { d: 'Ceiling', g: '0.15', on: 'plan' }] },
  { id: 'b2', name: 'Concrete floor', cat: 'A1', pitch: '0', part: '0.5', snow: '0', items: [{ d: 'RC slab', t: '150', rho: '25', on: 'plan' }] }],
  levels: [{ name: 'Roof', bu: 'b1', trib: '4.5', h: '2.7', sw: '2.4' }, { name: 'First floor', bu: 'b2', trib: '2.25', h: '2.7', sw: '2.4' }, { name: 'Ground floor', bu: '', trib: '0', h: '0.6', sw: '2.4' }] };
const w4 = page(JSON.stringify(v1)), d4 = w4.document;
truth('an earlier version’s page opens as three rows, the floor ticked, α_n on', d4.querySelectorAll('#tdRows tr').length === 3 && d4.querySelectorAll('#tdRows tr')[1].querySelector('.red').checked && d4.getElementById('red').value === 'an' && d4.getElementById('ltd').classList.contains('red-on'));
// an error is reported, not thrown
const w3 = page(); w3.document.getElementById('qa').value = '10'; w3.document.getElementById('fw').value = '20'; w3.document.getElementById('calc').click();
truth('a footing heavier than the bearing pressure is reported', /less than the allowable/.test(w3.document.querySelector('#results .err').textContent) && /ULS/.test(w3.document.getElementById('results').textContent));
const a0 = w3.document.querySelector('#tdRows .A'); a0.value = '6'; a0.dispatchEvent(new w3.Event('input', { bubbles: true }));
setTimeout(() => {
  truth('live: the load path follows the table', /DL 6\.00, LL 6\.00 kN\/m/.test(w3.document.getElementById('drawings').textContent));
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0 && w4.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
}, 350);
