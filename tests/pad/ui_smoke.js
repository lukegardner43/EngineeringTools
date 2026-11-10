// Drives "Pad Foundation.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Pad Foundation.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/Pad%20Foundation.html', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-pad-foundation-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
(async () => {
  const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, draw = () => $('drawings') ? $('drawings').innerHTML : '';
  const set = (id, v) => { const e = $(id); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  await wait(300);
  truth('page loads without script errors, pad first', w.errs.length === 0 && d.querySelector('#types .on').dataset.t === 'pad' && !$('B').closest('.form-group').hidden);
  truth('plan and section on load', d.querySelectorAll('#drawings svg.dk').length === 2 && /L 2,800/.test(draw()) && /ULS ground pressure/.test(draw()) && /effective area/.test(draw()));
  $('calc').click();
  truth('check: verdict, bearing both combinations, sliding, EQU, bending, shear, punching', /PASS/.test(res()) && ['Bearing, DA1-1', 'Bearing, DA1-2', 'Sliding', 'Overturning (EQU)', 'Bending, bars along L', 'Beam shear', 'Punching', 'Punching at the column face', 'Minimum steel'].every(t => res().includes(t)));
  truth('the bearing table lists every combination, wind both ways', d.querySelectorAll('.ctab tbody tr').length === 14 && /C2: 1G − 1.3W/.test(res()));
  truth('governs: punching at 0.915', /0\.915/.test(res()) && /Governs: punching/.test(res()));
  set('H', '350'); $('calc').click(); truth('a thin base fails', /FAIL/.test(res()));
  set('H', '600'); set('soil', 'undrained'); set('cu', '60'); $('calc').click();
  truth('undrained: c_u shown, φ′ hidden, D.3 resistance', !$('cu').closest('.form-group').hidden && $('phi').closest('.form-group').hidden && /Bearing, DA1-2/.test(res()));
  set('soil', 'allowable'); set('qa', '300'); $('calc').click();
  truth('allowable pressure: the SLS check replaces Annex D', /Bearing pressure against the allowable/.test(res()) && !/Bearing, DA1-1/.test(res()) && !d.querySelector('.ctab'));
  set('soil', 'drained'); set('qa', '');
  set('ex', '2000'); $('calc').click(); truth('a column off the base is reported', !!$('results').querySelector('.err') && /not on the base/.test(res()));
  set('ex', '0'); $('calc').click(); $('printBtn').click();
  const rep = $('report').textContent;
  truth('print: the A4 sheet with Annex D, EC2 and the drawings', w.printed && /Pad foundation to BS EN 1997-1/.test(rep) && /Combination 2 \(A2 \+ M2\)/.test(rep) && /D\.4/.test(rep) && /column face/.test(rep) && $('report').querySelectorAll('svg.dk').length === 2);
  d.querySelector('#types [data-t=strip]').click(); await wait(260);
  truth('strip: B, column b and the y rows hidden; one section drawing', $('B').closest('.form-group').hidden && d.querySelector('tr.t-pad').hidden && d.querySelectorAll('#drawings svg.dk').length === 1 && /per metre run/.test(draw()));
  set('L', '1500'); set('c1', '300'); set('G_N', '200'); set('Q_N', '80'); set('W_Mx', '0'); set('W_Hx', '0'); set('G_Mx', '0'); $('calc').click();
  truth('strip check: distribution steel, no punching', /Distribution steel/.test(res()) && !/Punching/.test(res()) && /PASS|FAIL/.test(res()));
  const saved = w.localStorage.getItem('et-pad-foundation-v1');
  const w2 = page(saved); await wait(300);
  truth('type and inputs restored', w2.document.querySelector('#types .on').dataset.t === 'strip' && w2.document.getElementById('L').value === '1500' && w2.document.getElementById('B').closest('.form-group').hidden);
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
})();
