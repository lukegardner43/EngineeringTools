// Drives "Basement Wall.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Basement Wall.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/Basement%20Wall.html', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-basement-wall-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
(async () => {
  const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, draw = () => $('drawings') ? $('drawings').innerHTML : '';
  const set = (id, v) => { const e = $(id); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  await wait(300);
  truth('page loads without script errors; K0, water and the slab by default', w.errs.length === 0 && $('K').value === 'rest' && +$('hw').value > 0 && $('baseHeld').checked);
  truth('section and wall diagrams on load', d.querySelectorAll('#drawings svg.dk').length === 2 && /prop/.test(draw()) && /base fixed/.test(draw()));
  $('calc').click();
  truth('check: bearing, the wall both faces, toe, heel, restraint, prop and slab', /PASS/.test(res()) && ['Bearing, DA1-1', 'Stem, back face at the base', 'Stem, front face in the span', 'Toe, bottom face', 'Heel, top face', 'early-age restraint', 'Prop force', 'Reaction into the slab'].every(t => res().includes(t)));
  truth('no sliding or overturning check (slab and prop)', !/Sliding, DA1/.test(res()) && !/Overturning/.test(res()));
  set('fixBase', 'pinned'); $('calc').click();
  truth('pinned at the slab: a result and the diagram says so', /PASS|FAIL/.test(res()) && /base pinned/.test(draw()));
  set('fixBase', 'fixed'); set('baseHeld', ''); $('baseHeld').checked = false; $('baseHeld').dispatchEvent(new w.Event('change', { bubbles: true })); $('calc').click();
  truth('without the slab: sliding comes back', /Sliding, DA1-1/.test(res()));
  $('baseHeld').checked = true; set('ts', '0'); $('calc').click(); truth('a zero wall thickness is reported', !!$('results').querySelector('.err'));
  set('ts', '300'); $('calc').click(); $('printBtn').click();
  const rep = $('report').textContent;
  truth('print: the A4 sheet', w.printed && /Basement wall to BS EN 1997-1/.test(rep) && /Flotation of the whole basement is not checked/.test(rep) && $('report').querySelectorAll('svg.dk').length === 2);
  const saved = w.localStorage.getItem('et-basement-wall-v1');
  const w2 = page(saved); await wait(300);
  truth('inputs restored', w2.document.getElementById('ts').value === '300' && w2.document.getElementById('fixBase').value === 'fixed' && w2.document.getElementById('baseHeld').checked);
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
})();
