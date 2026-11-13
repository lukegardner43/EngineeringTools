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
const rows = () => [...d.querySelectorAll('#tdRows tr')];
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
// transfer beams
set('tAOn', true); truth('above: its inputs, one load on it, a footer row for its reaction', shown($('tAL')) && d.querySelectorAll('#tALoads tr').length === 1 && shown(d.querySelector('.ta-row')) && $('tAAt').options.length === 6);
truth('… its reaction (40 × 4/6 + 1 × 3 = 29.67 kN, over 1 m of wall) in the footer and the sums at once', $('taDL').textContent === '29.67' && $('sDL').textContent === (4.95 + 35 + 29.67).toFixed(2));
set('tAAt', '-1'); set('tASpread', '0.5'); truth('… at the top, spread over 0.5 m: 59.33 kN/m', $('taDL').textContent === '59.33' && /at the top/.test($('taLab').textContent));
$('calc').click(); truth('… calculated: its drawing with the column stepping on it, the table and the step', /Transfer beam above/.test(res()) && /its other support/.test($('drawings').textContent) && /Its reaction on this wall/.test(res()) && /Transfer above/.test(res()));
set('tAOn', false); set('tBOn', true); set('tBa', '1'); set('tBb', '5');
$('tBAdd').click(); const lb = d.querySelectorAll('#tBLoads tr')[0]; lb.querySelector('.a').value = '7'; lb.querySelector('.DL').value = '20'; fire(lb.querySelector('.DL'), 'input');
$('calc').click();
truth('below: the beam, its supports and reactions, M and V, no footing', /transfer beam below/.test($('drawings').textContent) && /left support: ULS/.test($('drawings').textContent) && /Bending moment, ULS/.test(res()) && /stands on a transfer beam/.test(res()) && /M\s*Ed/.test(d.querySelector('#results .verdict').textContent));
truth('… the reactions and design actions tabled', /Left support/.test(res()) && /Bending moment, largest/.test(res()));
$('printBtn').click(); truth('… on the sheet: the transfer beams section and the result', /Transfer beams/.test($('report').textContent) && /Transfer beam below, bending moment and shear/.test($('report').textContent) && $('report').querySelectorAll('svg').length === 5);   // the load path, the beam, M, V and the hip
set('tBb', '9'); $('calc').click(); truth('… a wall past the beam\'s end is reported', /run along the span/.test(err()));
set('tBb', '5');
const w2 = page(w.localStorage.getItem('et-load-takedown-v1'));
truth('inputs restored: rows, cells and the hip', w2.document.querySelectorAll('#tdRows tr').length === 5 && w2.document.querySelectorAll('#tdRows tr')[4].querySelector('.aD').value === '0.1*20' && w2.document.getElementById('hipOn').checked);
truth('… the types, the transfer beams and their loads', [...w2.document.querySelectorAll('#tdRows .kind')].map(e => e.value).join() === 'roof,roof,floor,floor,wall' && w2.document.getElementById('tBOn').checked && !w2.document.getElementById('tAOn').checked && w2.document.querySelectorAll('#tBLoads tr').length === 1 && w2.document.getElementById('tAAt').value === '-1' && w2.document.getElementById('tASpread').value === '0.5');
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
