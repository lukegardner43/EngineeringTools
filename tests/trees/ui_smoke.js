// Drives "Foundations Near Trees.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Foundations Near Trees.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-trees-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, err = () => (($('results').querySelector('.err') || {}).textContent || '');
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('defaults: NHBC\'s example, two trees and a shrub, two drawings', d.querySelectorAll('#treeRows .row').length === 2 && d.querySelectorAll('#shrubRows .row').length === 1 && $('drawings').querySelectorAll('svg.dk').length === 2);
truth('the species list: 68 from Table 3 and 4 not listed, in groups', d.querySelectorAll('#treeRows .row')[0].querySelectorAll('.sp option').length === 72 && d.querySelectorAll('#treeRows .row')[0].querySelectorAll('.sp optgroup').length === 6);
$('calc').click();
truth('checked: 2.28 m deep, the poplar governs', /PASS/.test(res()) && /2\.28 m deep/.test(res()) && /Lombardy poplar governs/.test(res()) && !err());
truth('the trees table, heave precautions and the planting table', $('results').querySelectorAll('table.ctab').length === 2 && $('results').querySelectorAll('ul.heave li').length === 3 && /column A/.test(res()));
set('dProp', '2.0'); $('calc').click(); truth('a proposed 2.0 m fails', /FAIL/.test(res()) && /Foundation depth/.test(res()));
set('dProp', ''); set('vcp', 'high'); truth('a given potential hides the test inputs', d.querySelector('.g-test').hidden);
$('calc').click(); truth('high soil: deeper', !err() && parseFloat(res().match(/(\d\.\d\d) m deep/)[1]) > 2.28);
set('vcp', 'test');
const sp = d.querySelectorAll('#treeRows .row')[0].querySelector('.sp'); sp.value = sp.querySelector('option[value]').value; sp.dispatchEvent(new w.Event('change', { bubbles: true }));
truth('choosing a species fills its mature height', d.querySelectorAll('#treeRows .row')[0].querySelector('.Hm').value === '24');
$('addShrub').click(); $('addTree').click(); $('calc').click();
truth('a shrub and a tree added', d.querySelectorAll('#shrubRows .row').length === 2 && d.querySelectorAll('#treeRows .row').length === 3 && !err());
set('type', 'raft'); truth('a raft shows its plan size', !d.querySelector('.g-raft').hidden);
$('calc').click(); truth('raft: an engineer\'s design, the plan ratio checked', /Raft: plan proportion/.test(res()));
set('type', 'trench'); $('nsOn').checked = true; $('nsOn').dispatchEvent(new w.Event('change', { bubbles: true }));
$('calc').click(); truth('non-shrinkable soil over the clay checked', !d.querySelector('.g-ns').hidden && /non-shrinkable soil above/.test(res()));
$('printBtn').click();
truth('print: two drawings, the checks and tables', w.printed && $('report').querySelectorAll('svg').length === 2 && $('report').querySelectorAll('table.rt').length >= 2);
const w2 = page(w.localStorage.getItem('et-trees-v1'));
truth('inputs restored', w2.document.querySelectorAll('#treeRows .row').length === 3 && w2.document.getElementById('nsOn').checked);
const w3 = page(), ev = (el, tp) => el.dispatchEvent(new w3.Event(tp, { bubbles: true }));
const Dd = w3.document.querySelectorAll('#treeRows .row')[0].querySelector('.D'); Dd.value = '12'; ev(Dd, 'input');
setTimeout(() => {
  truth('live: the drawings follow the distance', /at 12\.00 m/.test(w3.document.getElementById('drawings').textContent));
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
}, 400);
