// Drives "Outrigger Loading.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Outrigger Loading.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-outrigger-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, err = () => (($('results').querySelector('.err') || {}).textContent || '');
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('defaults: calculate, two lifts, timber one-way, EC7; plan, slew and mat drawn', d.querySelector('#methods .on').dataset.m === 'calc' && d.querySelectorAll('#liftRows .row').length === 2 && $('span').value === 'one' && $('span').disabled && d.querySelector('#bases .on').dataset.b === 'ec7' && $('drawings').querySelectorAll('svg.dk').length === 3);
$('calc').click();
truth('checked: PASS 0.567, the ground governs, 227.9 kN at the rear right', /PASS/.test(res()) && /0\.567/.test(res()) && /Governs: ground bearing resistance, DA1-2/.test(res()) && /227\.9 kN \(23\.23 t\)/.test(res()) && /rear right/.test(res()));
truth('checks, the outrigger table and the calculation', $('results').querySelectorAll('.ck').length === 5 && $('results').querySelectorAll('table.ctab tbody tr').length === 2 && /Least mat/.test(res()));
// a third lift
$('addLift').click(); $('calc').click(); truth('a third lift in the table', $('results').querySelectorAll('table.ctab tbody tr').length === 3);
d.querySelectorAll('#liftRows .xbtn')[2].click();
// an overturning lift
const P = d.querySelectorAll('#liftRows .P')[0]; P.value = '20'; P.dispatchEvent(new w.Event('input', { bubbles: true })); $('calc').click();
truth('an overturning lift is refused', /overturns/.test(err()));
P.value = '4'; P.dispatchEvent(new w.Event('input', { bubbles: true }));
// the 75% rule and a given value
d.querySelector('#methods [data-m="rule"]').click(); $('calc').click();
truth('75% rule: 0.75 × 48.8 + 4 = 40.6 t, the mat drawing only', /40\.60 t/.test(res()) && $('drawings').querySelectorAll('svg.dk').length === 1 && /C703/.test(res()));
d.querySelector('#methods [data-m="given"]').click(); $('calc').click();
truth('given: 25 t', /25\.00 t/.test(res()));
d.querySelector('#methods [data-m="calc"]').click();
// materials
set('mat', 'steel'); truth('steel: grade shown, two-way allowed', !d.querySelector('.mt-steel').hidden && !$('span').disabled);
set('t', '40'); $('calc').click(); truth('steel plate 40 mm checked by von Mises', /σvM|σ_vM|von Mises|σ<sub>vM/.test($('results').innerHTML) || /vM/.test(res()));
set('mat', 'plastic'); truth('plastic: strength and modulus shown', !d.querySelector('.mt-plastic').hidden);
set('t', '100'); $('calc').click(); truth('plastic 100 mm fails', /FAIL/.test(res()));
set('mat', 'timber'); set('t', '200'); truth('timber: one-way again', $('span').value === 'one' && $('span').disabled);
// ground bases
d.querySelector('#bases [data-b="allow"]').click(); truth('allowable: the pressure input shown, the soil hidden', !d.querySelector('.b-allow').hidden && d.querySelector('.b-soil').hidden);
$('calc').click(); truth('allowable 150 kPa checked', /≤ 150\.0 kPa/.test(res()));
d.querySelector('#bases [data-b="fos"]').click(); set('bearing', 'undrained'); set('cu', '60'); $('calc').click();
truth('factor of safety, undrained c_u 60', /factor of safety 2\.00/.test(res()) && !err());
d.querySelector('#bases [data-b="ec7"]').click(); set('bearing', 'drained');
$('calc').click(); $('printBtn').click();
truth('print: three drawings, the table and the checks', w.printed && $('report').querySelectorAll('svg').length === 3 && $('report').querySelectorAll('table.rt').length === 1 && /Ground bearing resistance/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-outrigger-v1'));
truth('inputs restored', w2.document.querySelectorAll('#liftRows .row').length === 2 && w2.document.getElementById('cu').value === '60' && w2.document.querySelector('#bases .on').dataset.b === 'ec7');
const w3 = page(), ev = (el, tp) => el.dispatchEvent(new w3.Event(tp, { bubbles: true }));
const Bi = w3.document.getElementById('L'); Bi.value = '2.4'; ev(Bi, 'input');
setTimeout(() => {
  truth('live: the mat drawing follows its length', /L 2\.40 m/.test(w3.document.getElementById('drawings').textContent));
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
}, 450);
