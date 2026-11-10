// Drives "Pile Cap.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Pile Cap.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/Pile%20Cap.html', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-pile-cap-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
(async () => {
  const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, draw = () => $('drawings') ? $('drawings').innerHTML : '';
  const set = (id, v) => { const e = $(id); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const pick = k => { d.querySelector(`#ns [data-n="${k}"]`).click(); };
  await wait(300);
  truth('page loads without script errors, four piles first', w.errs.length === 0 && d.querySelector('#ns .on').dataset.n === '4' && !$('sy').closest('.form-group').hidden);
  truth('plan and section on load', d.querySelectorAll('#drawings svg.dk').length === 2 && /Section along x/.test(draw()) && />4</.test(draw()));
  $('calc').click();
  truth('check: verdict, bending, shear, punching, anchorage', /PASS/.test(res()) && ['Bending, bars along x', 'Shear across the cap', 'Punching at the column face', 'Anchorage past the piles', 'Minimum steel'].every(t => res().includes(t)));
  truth('pile loads table: four piles', d.querySelectorAll('.ctab tbody tr').length === 4);
  set('swl', '700'); set('Rcd', '800'); $('calc').click();
  truth('pile resistance checks appear', /safe working load/.test(res()) && /R_c,d|Rc,d/.test(res()));
  set('method', 'truss'); $('calc').click();
  truth('truss: ties and nodes', /Tie along x/.test(res()) && /Node under the column \(CCC\)/.test(res()) && /Node over the pile/.test(res()) && /struts/.test(draw()));
  pick('3'); await wait(260);
  truth('3 piles: truss only, band bars shown, the x/y bars hidden', $('method').disabled && $('method').value === 'truss' && !$('nBand').closest('.grid3').hidden && $('phiX').closest('.grid3').hidden);
  $('calc').click(); truth('3 piles: three side ties', (res().match(/Tie piles/g) || []).length === 3);
  pick('2'); await wait(260); set('method', 'bending');
  truth('2 piles: no spacing across, no M_y rows', $('sy').closest('.form-group').hidden && d.querySelector('tr.n-y').hidden);
  $('calc').click(); truth('2 piles: a result', /PASS|FAIL/.test(res()) && d.querySelectorAll('.ctab tbody tr').length === 2);
  pick('6'); await wait(260); set('ex', '3000'); $('calc').click();
  truth('a column off the cap is reported', !!$('results').querySelector('.err') && /not on the cap/.test(res()));
  set('ex', '0'); $('calc').click(); $('printBtn').click();
  const rep = $('report').textContent;
  truth('print: the A4 sheet with the pile loads, the method and the drawings', w.printed && /6-pile cap to BS EN 1992-1-1/.test(rep) && /Pile 6 at/.test(rep) && /Shear and punching/.test(rep) && $('report').querySelectorAll('svg.dk').length === 2);
  const saved = w.localStorage.getItem('et-pile-cap-v1');
  const w2 = page(saved); await wait(300);
  truth('layout and inputs restored', w2.document.querySelector('#ns .on').dataset.n === '6' && w2.document.getElementById('swl').value === '700');
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
})();
