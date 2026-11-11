// Drives "Rigid Diaphragm.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Rigid Diaphragm.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-rigid-diaphragm-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = el => !el.closest('.hidden');
const rowsEl = () => [...d.querySelectorAll('#wallRows .row')];
truth('page loads without script errors', w.errs.length === 0);
truth('defaults: six concrete walls', rowsEl().length === 6 && rowsEl().every(r => r.querySelector('.type').value === 'concrete'));
truth('plan on load, before Calculate: walls, CR and loads', /CR \(/.test($('drawings').textContent) && /F_?x?\s*150 kN|150 kN/.test($('drawings').textContent) && !/PASS|FAIL/.test(res()));
$('calc').click();
truth('calculated: the most loaded wall named, drift checked', /takes the most|PASS|FAIL/.test(res()) && /Storey drift/.test(res()) && /F 111 kN|F,\s*111 kN/.test(res()) && !$('results').querySelector('.err'));
truth('table: six cases and the design force', ['X +T', 'X −T', 'Y +T', 'Y −T'].every(s => res().includes(s)) && $('results').querySelectorAll('table.t tbody tr').length === 6);
truth('calculation: stiffness, centre of rigidity, J and NA.10', /E_?cm|Ecm/.test(res()) && /x_?r\s*=|xr =/.test(res()) && /Σ k r²/.test(res()) && /NA\.2\.23/.test(res()));
truth('two plans on the page', $('results').querySelectorAll('svg.dk').length === 2);
// a wall along X shows y as its line
const r0 = rowsEl()[3]; truth('labels follow the direction: a wall along X has its line at y', r0.querySelector('.lat').textContent === 'Line y (m)' && /From x/.test(r0.querySelector('.lfr').textContent));
r0.querySelector('.dir').value = 'y'; r0.querySelector('.dir').dispatchEvent(new w.Event('change', { bubbles: true })); truth('… and at x when turned', r0.querySelector('.lat').textContent === 'Line x (m)');
r0.querySelector('.dir').value = 'x'; r0.querySelector('.dir').dispatchEvent(new w.Event('change', { bubbles: true }));
// bracing shows its arrangement and area
const t = rowsEl()[2].querySelector('.type'); t.value = 'brace'; t.dispatchEvent(new w.Event('change', { bubbles: true }));
truth('bracing: arrangement shown, area label, default area', shown(rowsEl()[2].querySelector('.arr')) && rowsEl()[2].querySelector('.lp').textContent === 'Diagonal A (cm²)' && rowsEl()[2].querySelector('.p').value === '10');
$('calc').click(); truth('bracing: diagonal force column', /N\s*diag/.test(res()) && /steel bracing/.test(res()));
// resistances give checks
rowsEl().forEach(r => { r.querySelector('.FRd').value = '150'; }); $('calc').click();
truth('F_Rd given: a check per wall and a verdict', d.querySelectorAll('#results .ck').length === 7 && /PASS|FAIL/.test(d.querySelector('.verdict .big').textContent) && /Util\./.test(res()));
// torsion options
set('tors', 'ecc'); truth('± e shown, NA.10 factor hidden', shown($('ecc')) && !shown($('flc'))); $('calc').click(); truth('… cases ± e', /X \+e/.test(res()));
set('tors', 'none'); $('calc').click(); truth('no torsion: two cases', $('results').querySelectorAll('table.t thead th').length === 4 + 2 + 2 + 1 + 2 && !/X \+T/.test(res()));   // wall, along, k, r; two cases; F_Ed, kN/m; N_diag; F_Rd, util
set('tors', 'na10');
// racking strength: stiffness inputs hidden, F_i,v,Rd asked for
set('basis', 'strength');
truth('strength: H and the stiffness rows hidden, F_i,v,Rd label', !shown($('H')) && !shown(rowsEl()[0].querySelector('.type')) && /F\s*i,v,Rd/.test(rowsEl()[0].querySelector('.lfrd').textContent));
$('calc').click(); truth('strength: shared by racking strength, no drift', /20\.3/.test(res()) && !/Storey drift/.test(res()) && /PASS|FAIL/.test(res()));
set('basis', 'stiffness');
// add and remove a wall
$('addWall').click(); truth('add a wall', rowsEl().length === 7); rowsEl()[6].querySelector('.xbtn').click(); truth('remove it', rowsEl().length === 6);
// an unstable layout reports, does not throw
const keep = rowsEl().map(r => r.querySelector('.dir').value); rowsEl().forEach(r => { r.querySelector('.dir').value = 'y'; });
$('calc').click(); truth('walls all along Y with load in X: a clear message', /Nothing resists the load in X/.test($('results').querySelector('.err').textContent));
rowsEl().forEach((r, i) => { r.querySelector('.dir').value = keep[i]; }); $('calc').click();
$('printBtn').click(); truth('print: plans, table, calculation, checks', w.printed && $('report').querySelectorAll('svg').length === 2 && $('report').querySelector('table.rt') && /Calculation/.test($('report').textContent) && /largest utilisation/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-rigid-diaphragm-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored, walls and resistances', w2.document.querySelectorAll('#wallRows .row').length === 6 && [...w2.document.querySelectorAll('#wallRows .FRd')].every(e => e.value === '150') && w2.document.querySelectorAll('#wallRows .type')[2].value === 'brace');
const w3 = page(), $3 = id => w3.document.getElementById(id), ev = (el, tp) => el.dispatchEvent(new w3.Event(tp, { bubbles: true }));
$3('B').value = '36'; ev($3('B'), 'input');
setTimeout(() => {
  truth('live: the plan follows B', /B 36\.00 m/.test($3('drawings').textContent));
  $3('B').value = ''; ev($3('B'), 'input');
  setTimeout(() => {
    truth('live: incomplete inputs give a note, not an error', /plan will appear when the inputs are complete/.test($3('drawings').textContent));
    truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0 && $2('B').value === '30');
    console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
  }, 350);
}, 350);
