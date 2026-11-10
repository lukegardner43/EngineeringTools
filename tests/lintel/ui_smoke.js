// Drives "RC Lintel Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Lintel Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/RC%20Lintel%20Design.html', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-rc-lintel-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
(async () => {
  const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, draw = () => $('drawings') ? $('drawings').innerHTML : '';
  const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('change', { bubbles: true })); };
  await wait(300);
  truth('page loads without script errors', w.errs.length === 0);
  truth('drawings on load: elevation, loading, section, shear, span/depth', d.querySelectorAll('#drawings svg.dk').length === 5 && /load triangle/.test(draw()) && /floor 1/.test(draw()));
  $('calc').click();
  truth('check: verdict, governing check, loads and values', /PASS|FAIL/.test(res()) && /Governs/.test(res()) && /Masonry in the load triangle/.test(res()) && /Floor 1: G at 1200/.test(res()) && !!$('results').querySelector('.kv'));
  truth('check: bending, shear links, span/depth, lateral stability', /Bending/.test(res()) && /Shear links/.test(res()) && /span\/depth/i.test(res()) && /Lateral stability/.test(res()));
  truth('no masonry strength: the bearing is not checked and a note says so', !/Bearing on the masonry/.test(res()) && /Give the masonry f/.test(res()));
  set('fk', '4'); $('calc').click(); truth('masonry f_k given: bearing checked', /Bearing on the masonry/.test(res()));
  $('addPoint').click(); await wait(260); truth('a point load row redraws with P1', /P1:/.test(draw()) && d.querySelectorAll('#pointRows .row').length === 1);
  set('mode', 'full'); await wait(260); truth('no arching: all the masonry above', /all the masonry above is carried/.test(draw()));
  $('calc').click(); truth('no arching: the masonry load named', /Masonry above the lintel/.test(res()));
  set('phil', '0'); $('calc').click(); truth('no links: the 2 m rule applies', /No links: lintels up to 2 m/.test(res()));
  set('L', '2400'); $('calc').click(); truth('no links over 2 m: FAIL', /FAIL/.test(res()));
  set('L', '0'); $('calc').click(); truth('a zero span is reported', !!$('results').querySelector('.err') && /Clear span/.test(res()));
  set('L', '1800'); set('phil', '6'); $('calc').click();
  $('printBtn').click(); truth('print: the A4 sheet with the drawings, section design and checks', w.printed && $('report').querySelectorAll('svg.dk').length === 5 && /3 Section design/.test($('report').textContent) && /4 Checks/.test($('report').textContent));
  const saved = w.localStorage.getItem('et-rc-lintel-v1');
  const w2 = page(saved); await wait(300);
  truth('inputs restored with the rows', w2.document.getElementById('mode').value === 'full' && w2.document.querySelectorAll('#pointRows .row').length === 1 && w2.document.getElementById('fk').value === '4' && w2.document.querySelectorAll('#drawings svg.dk').length === 5);
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
})();
