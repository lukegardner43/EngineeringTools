// Drives "RC Punching Shear.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Punching Shear.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store, hash = '') {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/RC%20Punching%20Shear.html' + hash, beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-rc-punch-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, rows = id => d.querySelectorAll(`#${id} .row`);
const change = el => el.dispatchEvent(new w.Event('change', { bubbles: true }));
const shown = el => !el.classList.contains('hidden');
truth('page loads without script errors', w.errs.length === 0);
truth('internal column: no edge distances, β moments hidden', !shown(d.querySelector('.pedge')) && !shown(d.querySelector('.pcorner')) && !shown(d.querySelector('.pcalc')));
$('calc').click(); truth('verdict, plan, checks, values', /PASS|FAIL/.test(res()) && $('results').querySelectorAll('#drawings svg.dk').length === 3 && /u₁ 4,164 mm at 2d = 408/.test($('drawings').textContent) && /vRd,max/.test(res()) && /u₁ \(mm\)/.test(res()) && !$('results').querySelector('.err'));
$('pV').value = '900'; $('addHole').click(); $('calc').click();
truth('an opening and links: length lost, link perimeters drawn', /Openings take/.test(res()) && /Perimeter/.test(res()) && $('drawings').querySelectorAll('svg.dk circle').length > 20);
$('pbeta').value = 'calc'; change($('pbeta')); truth('β calculated shows the moments', shown(d.querySelector('.pcalc')));
$('pMx').value = '40'; $('pMy').value = '25'; $('calc').click(); truth('biaxial β (6.43)', /\(6\.43\)/.test(res()));
$('ptype').value = 'edge'; change($('ptype')); truth('edge shows the edge distance only', shown(d.querySelector('.pedge')) && !shown(d.querySelector('.pcorner')));
rows('holeRows')[0].querySelector('.xbtn').click(); $('pV').value = '400'; $('calc').click(); truth('edge column: β (6.44)', /\(6\.44\)/.test(res()) && /slab edge/.test(res()));
$('ptype').value = 'corner'; change($('ptype')); truth('corner shows both edge distances', shown(d.querySelector('.pedge')) && shown(d.querySelector('.pcorner')));
$('pV').value = '250'; $('calc').click(); truth('corner column: β = u1/u1* (6.46)', /\(6\.46\)/.test(res()) && !$('results').querySelector('.err'));
$('pshape').value = 'circ'; change($('pshape')); truth('circular hides c₂ and labels D', !shown(d.querySelector('.prect')) && /Diameter/.test($('pc1l').textContent));
$('calc').click(); truth('circular corner column calculates', /circular column/.test(res()) && !$('results').querySelector('.err'));
$('pshape').value = 'rect'; change($('pshape')); $('ptype').value = 'internal'; change($('ptype')); $('pbeta').value = 'factors'; change($('pbeta'));
$('pV').value = '2000'; $('calc').click(); truth('beyond 2 vRd,c: links cannot help, advice given', /FAIL/.test(res()) && /links cannot make it work/.test(res()));
$('pV').value = '900';
$('addHole').click(); const hr = rows('holeRows')[0]; hr.querySelector('.x').value = '100'; $('calc').click(); truth('an opening over the column is reported', /overlaps the column/.test(res()));
hr.querySelector('.x').value = '700'; $('plphi').value = '10'; $('plsr').value = '120'; $('calc').click();
truth('link size and spacing as given', /H10 legs/.test(res()) && /sr = 120 mm/.test(res().replace(/s\s*r/g, 'sr')));
$('printBtn').click(); truth('print: plan, values and checks', w.printed && $('report').querySelectorAll('svg.dk').length === 3 && /Checks/.test($('report').textContent) && /RC Punching Shear/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-rc-punch-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored with the opening', w2.document.querySelectorAll('#holeRows .row').length === 1 && $2('pV').value === '900' && $2('plphi').value === '10');
// a column handed over from RC Flat Slab Design
const st = { v: 1, from: 'Column 2 of the flat slab frame: test', pRef: 'L2, column 2', fck: 32, fyk: 500, ptype: 'internal', pshape: 'rect', pc1: 450, pc2: 450, pey: 0, pex: 0, ph: 250, pcov: 25, pouter: 'x', pfx: 16, psx: 137, pfy: 16, psy: 137, pV: 1008.2, pbeta: 'factors', pMx: 0, pMy: 0, pq: 0, plphi: 'auto', holes: [] };
const w3 = page(w.localStorage.getItem('et-rc-punch-v1'), '#in=' + encodeURIComponent(JSON.stringify(st))), $3 = id => w3.document.getElementById(id);
truth('hand-off: calculated on arrival with the note', /PASS|FAIL/.test($3('results').textContent) && /Column 2 of the flat slab frame/.test($3('results').textContent));
truth('hand-off: values taken, an odd spacing kept, openings cleared', $3('pV').value === '1008.2' && $3('psx').value === '137' && $3('pc1').value === '450' && w3.document.querySelectorAll('#holeRows .row').length === 0 && $3('pRef').value === 'L2, column 2');
truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
