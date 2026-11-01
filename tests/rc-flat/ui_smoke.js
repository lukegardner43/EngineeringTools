// Drives "RC Flat Slab and Punching Shear.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Flat Slab and Punching Shear.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-rc-flat-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, rows = id => d.querySelectorAll(`#${id} .row`);
const change = el => el.dispatchEvent(new w.Event('change', { bubbles: true }));
const shown = el => !el.classList.contains('hidden');
truth('page loads without script errors', w.errs.length === 0);
truth('default frame: 3 spans, 4 columns, δ fixed at the end columns', rows('spanRows').length === 3 && rows('colRows').length === 4 && rows('colRows')[0].querySelector('.delta').disabled && rows('colRows')[3].querySelector('.delta').disabled && !rows('colRows')[1].querySelector('.delta').disabled);
$('calc').click();
truth('flat slab: verdict, elevation, moments, plan, strips, punching', /PASS|FAIL/.test(res()) && !!$('results').querySelector('svg.elev') && !!$('results').querySelector('svg.env') && !!$('results').querySelector('svg.plan') && !!$('results').querySelector('svg.pplan') && /Table I\.1/.test(res()) && /Punching shear at the columns/.test(res()) && !$('results').querySelector('.err'));
truth('the governing check is named', /Governs: (Column|Span) \d/.test(res()));
truth('moment transfer to the end columns reported', /Mt,max/.test(res()) && /I\.1\.2\(5\)/.test(res()));
$('addSpan').click(); truth('add span: columns follow', rows('spanRows').length === 4 && rows('colRows').length === 5 && rows('colRows')[3].querySelector('.delta').disabled === false && rows('colRows')[4].querySelector('.delta').disabled);
rows('spanRows')[3].querySelector('.xbtn').click(); truth('remove span: columns follow', rows('spanRows').length === 3 && rows('colRows').length === 4);
$('bay').value = 'edge'; change($('bay')); truth('edge bay shows the edge distance', shown(d.querySelector('.edgeonly')));
$('b').value = '4050'; $('calc').click(); truth('edge bay: corner columns at the ends', /corner/.test(res()) && !$('results').querySelector('.err'));
$('bay').value = 'internal'; change($('bay')); $('b').value = '7500';
rows('colRows')[1].querySelector('.delta').value = '0.5'; $('calc').click(); truth('δ outside 0.7–1.0 reported against the column', /Column 2: δ must be between/.test(res()));
rows('colRows')[1].querySelector('.delta').value = '0.85';
const c2 = rows('colRows')[2]; c2.querySelector('.shape').value = 'circ'; c2.querySelector('.c1').value = '500'; $('calc').click();
truth('a circular column calculates', /PASS|FAIL/.test(res()) && !$('results').querySelector('.err'));
$('printBtn').click(); truth('print: frame drawings, moments, strips, punching, summary', w.printed && $('report').querySelectorAll('svg').length === 3 && /Support and span moments/.test($('report').textContent) && /Summary/.test($('report').textContent));
// punching check
d.querySelector('#modes button[data-m="punch"]').click();
truth('punching pane shown, frame options hidden', shown($('pane-punch')) && !shown($('pane-flat')) && !shown(d.querySelector('.flat')));
$('calc').click(); truth('punching: verdict, plan, checks, values', /PASS|FAIL/.test(res()) && !!$('results').querySelector('svg.pplan') && /vRd,max/.test(res()) && /u₁ \(mm\)/.test(res()) && !$('results').querySelector('.err'));
$('pV').value = '900'; $('addHole').click(); $('calc').click();
truth('an opening and links: length lost, link perimeters drawn', /Openings remove/.test(res()) && /Perimeter/.test(res()) && $('results').querySelectorAll('svg.pplan circle').length > 20);
$('pbeta').value = 'calc'; change($('pbeta')); truth('β calculated shows the moments', shown(d.querySelector('.pcalc')));
$('pMx').value = '40'; $('pMy').value = '25'; $('calc').click(); truth('biaxial β (6.43)', /\(6\.43\)/.test(res()));
$('ptype').value = 'corner'; change($('ptype')); truth('corner shows both edge distances', shown(d.querySelector('.pedge')) && shown(d.querySelector('.pcorner')));
rows('holeRows')[0].querySelector('.xbtn').click(); $('calc').click(); truth('corner column: β = u1/u1* (6.46)', /\(6\.46\)/.test(res()) && !$('results').querySelector('.err'));
$('pshape').value = 'circ'; change($('pshape')); truth('circular hides c₂', !shown(d.querySelector('.prect')));
$('pshape').value = 'rect'; change($('pshape')); $('ptype').value = 'internal'; change($('ptype'));
$('addHole').click(); const hr = rows('holeRows')[0]; hr.querySelector('.x').value = '100'; $('calc').click(); truth('an opening over the column is reported', /overlaps the column/.test(res()));
hr.querySelector('.x').value = '700'; $('calc').click();
$('printBtn').click(); truth('punching print: plan and checks', $('report').querySelectorAll('svg').length === 1 && /Checks/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-rc-flat-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored, punching mode with its opening', !$2('pane-punch').classList.contains('hidden') && w2.document.querySelectorAll('#holeRows .row').length === 1 && $2('pV').value === '900' && w2.document.querySelectorAll('#colRows .row')[2].querySelector('.shape').value === 'circ');
truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
