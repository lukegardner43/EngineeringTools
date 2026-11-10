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
  // ---- check a Naylor lintel against the brochure ----
  truth('opens on the RC design: the Naylor card hidden', $('cardNaylor').hidden && !$('cardRC').hidden && $('tool').value === 'ec2');
  d.querySelector('#tools [data-t=naylor]').click(); await wait(260);
  truth('Naylor: the RC inputs hidden, the lintel list filled from the brochure', !$('cardNaylor').hidden && $('cardRC').hidden && $('ecSize').hidden && $('nl').options.length === 60 && d.querySelectorAll('#nl optgroup').length === 5);
  truth('Naylor: the brochure named with its edition and address on the inputs', /March 2025/.test($('nSrc').textContent) && !!$('nSrc').querySelector('a[href*="lintelsbrochurexfs4march2025"]'));
  truth('Naylor: drawings on change: elevation, load against the allowable, section', d.querySelectorAll('#drawings svg.dk').length === 3 && /allowable, Naylor table/.test(draw()) && /Naylor R8/.test(draw()));
  set('L', '1800'); $('calc').click();
  truth('Naylor check: verdict, table check, end bearing and fire', /PASS|FAIL/.test(res()) && /Allowable load, Naylor table: R8/.test(res()) && /End bearing/.test(res()) && /Fire resistance/.test(res()));
  truth('Naylor check: the table row with the span used, the source, the lighter options', !!$('results').querySelector('td.use') && /31\.18/.test($('results').querySelector('td.use').textContent) && /LintelsBrochureXFS4March2025/.test(res()) && /lightest first/.test(res()));
  set('nl', 'HS-R6'); set('L', '3000'); set('t1', '200'); set('t2', '200'); $('calc').click();
  truth('Naylor: R6 at a 3000 mm opening with the default loads', /R6/.test(res()) && /stock length/.test(res()));
  set('t1', '100'); $('calc').click(); truth('Naylor: a 100 mm bearing at 3000 mm is NOT MET and fails', /NOT MET/.test(res()) && /FAIL/.test(res()));
  set('t1', '200'); set('fire', '60'); $('calc').click(); truth('Naylor: 60 min needed from a 30 min lintel fails', /30 min available; 60 min needed/.test(res()) && /FAIL/.test(res()));
  set('fire', '30'); set('L', '1800'); set('t1', '150'); set('t2', '150'); set('nl', 'HS-R8'); $('calc').click();
  $('printBtn').click();
  truth('Naylor print: the A4 sheet names the brochure and shows the table check', /Naylor lintel against the brochure load tables/.test($('report').textContent) && /LintelsBrochureXFS4March2025/.test($('report').textContent)
    && /lintelsbrochurexfs4march2025_1\.pdf/.test($('report').textContent) && /3 Against Naylor/.test($('report').textContent) && $('report').querySelectorAll('svg.dk').length === 3);
  const savedN = w.localStorage.getItem('et-rc-lintel-v1');
  const wN = page(savedN); await wait(300);
  truth('Naylor: the mode and the lintel restored', wN.document.getElementById('tool').value === 'naylor' && wN.document.getElementById('nl').value === 'HS-R8' && !wN.document.getElementById('cardNaylor').hidden && wN.document.querySelectorAll('#drawings svg.dk').length === 3);
  d.querySelector('#tools [data-t=ec2]').click(); await wait(260); $('calc').click();
  truth('back to the RC design: five drawings and the section design', d.querySelectorAll('#drawings svg.dk').length === 5 && /Governs/.test(res()) && /Bending/.test(res()));
  const saved = w.localStorage.getItem('et-rc-lintel-v1');
  const w2 = page(saved); await wait(300);
  truth('inputs restored with the rows', w2.document.getElementById('mode').value === 'full' && w2.document.querySelectorAll('#pointRows .row').length === 1 && w2.document.getElementById('fk').value === '4' && w2.document.querySelectorAll('#drawings svg.dk').length === 5);
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && wN.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
})();
