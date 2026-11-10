// Drives "Retaining Wall.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Retaining Wall.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/Retaining%20Wall.html', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-retaining-wall-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
(async () => {
  const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, draw = () => $('drawings') ? $('drawings').innerHTML : '';
  const set = (id, v) => { const e = $(id); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const pick = t => d.querySelector(`#types [data-t="${t}"]`).click();
  await wait(300);
  truth('page loads without script errors, cantilever first', w.errs.length === 0 && d.querySelector('#types .on').dataset.t === 'cantilever' && $('tTop').closest('.form-group').hidden);
  truth('section and stem diagrams on load', d.querySelectorAll('#drawings svg.dk').length === 2 && /virtual back/.test(draw()) && /Moment/.test(draw()));
  $('calc').click();
  truth('check: sliding, bearing, EQU, stem, toe, heel', /PASS/.test(res()) && ['Sliding, DA1-1', 'Bearing, DA1-2', 'Overturning about the toe', 'Stem, back face', 'Toe, bottom face', 'Heel, top face', 'crack control'].every(t => res().includes(t)));
  truth('the ground table lists the combinations', d.querySelectorAll('.ctab tbody tr').length === 7);
  set('beta', '20'); set('hw', '1200'); set('lineQ', '20'); $('calc').click();
  truth('slope, water and a line load: a result', /PASS|FAIL/.test(res()) && /Water 1200 mm/.test(res()) && /K /.test(draw()));
  set('bearing', 'undrained'); truth('undrained hides φ′ and shows c_u', $('phif').closest('.form-group').hidden && !$('cuf').closest('.form-group').hidden);
  set('bearing', 'drained'); set('beta', '0'); set('hw', '0'); set('lineQ', '0');
  pick('propped'); await wait(260); set('K', 'rest'); $('calc').click();
  truth('propped: the prop force, no EQU, front bars', /Prop force/.test(res()) && !/Overturning about the toe/.test(res()) && !$('phiSF').closest('.grid3').hidden && /prop/.test(draw()));
  pick('gravity'); await wait(260); $('calc').click();
  truth('gravity: plain concrete checks, no bars, one drawing', /Wall in plain concrete/.test(res()) && $('phiS').closest('.card').hidden && d.querySelectorAll('#drawings svg.dk').length === 1);
  set('B', '300'); $('calc').click(); truth('a base short of the stem is reported', !!$('results').querySelector('.err') && /reach the back of the stem/.test(res()));
  set('B', '3000'); pick('cantilever'); await wait(260); $('calc').click(); $('printBtn').click();
  const rep = $('report').textContent;
  truth('print: the A4 sheet with the ground, the structure and the drawings', w.printed && /Cantilever retaining wall to BS EN 1997-1/.test(rep) && /Ground \(GEO, EQU\)/.test(rep) && /Structure/.test(rep) && $('report').querySelectorAll('svg.dk').length === 2);
  const saved = w.localStorage.getItem('et-retaining-wall-v1');
  const w2 = page(saved); await wait(300);
  truth('type and inputs restored', w2.document.querySelector('#types .on').dataset.t === 'cantilever' && w2.document.getElementById('B').value === '3000');
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
})();
