// Drives "Raft Foundation.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Raft Foundation.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-raft-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, err = () => (($('results').querySelector('.err') || {}).textContent || '');
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('defaults: nine columns, no walls, two plans drawn', d.querySelectorAll('#colRows .row').length === 9 && d.querySelectorAll('#wallRows .row').length === 0 && $('drawings').querySelectorAll('svg.dk').length === 2);
$('calc').click();
truth('checked: PASS 0.878, punching governs', /PASS/.test(res()) && /0\.878/.test(res()) && /Governs: punching at the columns/.test(res()) && !err());
truth('checks, the punching table (9 columns) and the calculation', $('results').querySelectorAll('.ck').length === 10 && $('results').querySelectorAll('table.ctab tbody tr').length === 9 && /Wood–Armer/.test(res()) && /Bed/.test(res()));
set('h', '300'); $('calc').click(); truth('300 mm: punching fails without links, with a note', /FAIL/.test(res()) && /shear links/.test(res()));
set('h', '350');
$('addWall').click(); $('calc').click(); truth('a wall added: checked', d.querySelectorAll('#wallRows .row').length === 1 && !err() && /1 wall/.test(res()));
d.querySelector('#wallRows .xbtn').click();
const cx = d.querySelectorAll('#colRows .x')[0]; cx.value = '20'; cx.dispatchEvent(new w.Event('input', { bubbles: true })); $('calc').click();
truth('a column off the raft is refused', /not wholly on the raft/.test(err()));
cx.value = '0.5'; cx.dispatchEvent(new w.Event('input', { bubbles: true }));
set('ks', '5000'); $('calc').click(); truth('softer ground: more settlement', /settlement [0-9.]+ mm/.test(res()) && !err());
set('ks', '15000');
$('calc').click(); $('printBtn').click();
truth('print: two plans, the checks and the punching table', w.printed && $('report').querySelectorAll('svg').length === 2 && $('report').querySelectorAll('table.rt').length === 1 && /Punching at the columns/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-raft-v1'));
truth('inputs restored', w2.document.querySelectorAll('#colRows .row').length === 9 && w2.document.getElementById('ks').value === '15000' && w2.document.getElementById('h').value === '350');
const w3 = page(), ev = (el, tp) => el.dispatchEvent(new w3.Event(tp, { bubbles: true }));
const L = w3.document.getElementById('Lx'); L.value = '12'; ev(L, 'input');
setTimeout(() => {
  truth('live: the plans follow the raft length', /12\.00 m/.test(w3.document.getElementById('drawings').textContent));
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
}, 1500);
