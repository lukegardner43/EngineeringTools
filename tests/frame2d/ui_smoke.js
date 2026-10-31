// Drives "2D Frame Analysis.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js): drawing with the mouse,
// supports, releases, loads, section changes, every wizard, every result view, cases and combinations, undo / redo,
// saved model, mechanisms reported, print.
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', '2D Frame Analysis.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-frame2d-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
(async () => {
  const w = page(), d = w.document, $ = id => d.getElementById(id), ev = s => w.eval(s);
  await wait(150);
  truth('page loads without script errors', w.errs.length === 0);
  truth('default Pratt truss analysed (no error, ULS combination selected)', ev('S.res && !S.err && S.resKey && S.resKey.startsWith("combo:")') === true);
  truth('canvas draws members, supports and loads', d.querySelectorAll('#cv line').length > 20 && /kN/.test($('cv').textContent));
  for (const v of ['defl', 'N', 'V', 'M', 'R']) { d.querySelector(`#views button[data-v=${v}]`).click(); await wait(20); truth(`view ${v} renders`, $('cv').innerHTML.length > 500 && w.errs.length === 0); }
  ev("S.resKey = 'env:uls'; render()"); truth('ULS envelope renders', /envelope/.test($('legend').textContent));
  // new model drawn with the mouse
  ev("S.model = blankModel(); S.hist = []; changed(); S.view = { cx: 100, cy: 500, k: 50 }; render()");
  const click = (x, y) => { const o = { clientX: 100 + x * 50, clientY: 500 - y * 50, button: 0, bubbles: true }; $('cv').dispatchEvent(new w.MouseEvent('mousedown', o)); w.dispatchEvent(new w.MouseEvent('mouseup', o)); };
  d.querySelector('#modes button[data-m=member]').click(); [[0, 0], [0, 4], [6, 4], [6, 0]].forEach(([x, y]) => click(x, y)); w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  truth('member tool: 4 nodes and 3 members drawn', ev('S.model.nodes.length') === 4 && ev('S.model.members.length') === 3);
  d.querySelector('#modes button[data-m=support]').click(); click(0, 0); click(0, 0); click(6, 0);
  truth('support tool cycles: fixed and pinned', ev('JSON.stringify(S.model.nodes[0].sup)') === '{"ux":"f","uy":"f","rz":"f"}' && ev('JSON.stringify(S.model.nodes[3].sup)') === '{"ux":"f","uy":"f"}');
  d.querySelector('#modes button[data-m=load]').click(); click(3, 4); click(0, 4); await wait(80);
  truth('load tool: UDL on the beam and a nodal load', ev('S.model.loads.filter(l => l.type === "udl").length') === 1 && ev('S.model.loads.filter(l => l.type === "node").length') === 1);
  truth('frame analysed after drawing', ev('!!S.res && !S.err') === true);
  d.querySelector('#modes button[data-m=release]').click(); click(5.8, 4); await wait(60);
  truth('release tool pins the member end near the click', ev('S.model.members[1].relJ') === true);
  // properties pane: member section and loads
  ev("S.sel = { type: 'member', id: S.model.members[1].id }; S.tab = 'prop'; renderPane()");
  const fam = d.querySelector('[data-f="s.fam"]'); fam.value = 'UKC'; fam.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(60);
  truth('section family change applies a UKC', /UKC/.test(ev('S.model.members[1].sec.name')));
  d.querySelector('[data-add="point"]').click(); await wait(60); truth('point load added from the pane', ev('S.model.loads.some(l => l.type === "point")') === true);
  const P = d.querySelector('.ld [data-l="P"]'); P.value = '-25'; P.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(60);
  truth('load value edited', ev('S.model.loads.find(l => l.type === "point").P') === -25);
  const tr = d.querySelector('[data-r="truss"]'); tr.checked = true; tr.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(60);
  truth('truss checkbox makes a bar', ev('S.model.members[1].truss') === true);
  // undo / redo
  const before = ev('JSON.stringify(S.model)'); $('bUndo').click(); await wait(30); truth('undo restores the previous state', ev('S.model.members[1].truss') === false); $('bRedo').click(); await wait(30); truth('redo re-applies it', ev('JSON.stringify(S.model)') === before);
  // tables and cases
  ev("S.tab = 'tables'; S.tables = 'members'; renderPane()"); truth('members table', d.querySelectorAll('#pane table.e tr').length === 4);
  ev("S.tab = 'cases'; renderPane()"); d.querySelector('[data-cadd]').click(); await wait(40);
  truth('load case added and combinations regenerated', ev('S.model.cases.length') === 3 && ev('S.model.combos.length') >= 3);
  ev("S.tab = 'results'; renderPane()"); truth('results tab lists reactions', /node/.test($('pane').textContent) && /kN/.test($('pane').innerHTML));
  // mechanism reported
  ev("S.model.nodes.forEach(n => { n.sup = n.sup && n.sup.uy ? { uy: 'f' } : {}; }); changed(); analyseNow()");
  truth('mechanism shown as an error', /Unstable/.test($('err').textContent) && $('err').style.display === 'block');
  $('bUndo').click(); await wait(80); ev('analyseNow()'); truth('undo clears the mechanism', !ev('S.err'));
  // every wizard
  for (const t of ['truss', 'portal', 'beam', 'multi']) {
    $('bWizard').click(); d.querySelector(`[data-wt=${t}]`).click(); if (t === 'truss') { const k = d.querySelector('[data-w=kind]'); k.value = 'warren'; } $('wzGo').click(); await wait(80); ev('analyseNow()');
    truth(`wizard ${t}: generated and analysed`, ev('S.model.members.length') > 2 && !ev('S.err') && ev('!!S.res'));
  }
  ev("S.model.second = true; S.model.acr = true; changed(); analyseNow()");
  truth('second order with alpha_cr on the multi-storey frame', ev('Object.values(S.res.combos).some(r => r.iterations > 0 && Number.isFinite(r.acr))') === true);
  // saved and restored
  const saved = w.localStorage.getItem('et-frame2d-v1'); const w2 = page(saved); await wait(150);
  truth('model restored from storage', w2.eval('S.model.members.length') === ev('S.model.members.length'));
  ev("S.tab = 'prop'; S.sel = null; renderPane()"); $('bPrint').click(); await wait(30);
  truth('print report built with diagrams', w.printed && d.querySelectorAll('#report svg').length >= 4);
  truth('no script errors', w.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
})();
