// Drives "RC Ribbed and Waffle Slabs.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Ribbed and Waffle Slabs.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-rc-ribbed-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, rows = id => d.querySelectorAll(`#${id} .row`);
const change = el => el.dispatchEvent(new w.Event('change', { bubbles: true }));
truth('page loads without script errors', w.errs.length === 0);
truth('default ribbed slab: 3 spans, 4 supports, 6 loads, 4 + 3 × 2 bar rows', rows('spanRows').length === 3 && rows('supRows').length === 4 && rows('loadRows').length === 6 && rows('barRows').length === 10);
truth('drawings on load, before Calculate: elevation, envelopes, the typical rib section and the design sections', !!$('drawings').querySelector('svg.elev') && $('drawings').querySelectorAll('svg.env').length === 2 && /Typical section through the ribs/.test($('drawings').textContent) && /Design sections, one rib each/.test($('drawings').textContent) && /s = 900/.test($('drawings').textContent) && !/PASS|FAIL/.test(res()));
$('calc').click();
truth('one-way: the defaults pass, with the drawings, checks, tables and zones', /PASS/.test(res()) && !!$('drawings').querySelector('svg.elev') && /Where the ribs start/.test(res()) && /Self-weight/.test(res()) && d.querySelectorAll('#results details.zone').length >= 6 && !$('results').querySelector('.err'));
truth('the governing check is named', /Governs: /.test(res()));
truth('spans without transverse ribs are noted (5.3.1(6))', /Transverse ribs \(5\.3\.1\(6\)/.test(res()));
// the solid zone inputs reach the engine: the ribs start where it ends
truth('ribs start 750 mm from the interior supports', /ribs from 750 mm/.test($('drawings').textContent) && /ribs from 300 mm/.test($('drawings').textContent));
$('suggest').click(); truth('one-way suggestion passes', /PASS/.test(res()) && !$('results').querySelector('.err'));
$('lphi').value = '0'; change($('lphi')); $('calc').click(); truth('no links: rib shear checked without them (6.2.2)', /Rib shear without links/.test(res()) && !/Rib shear with links/.test(res()));
$('lphi').value = '8'; change($('lphi'));
$('addSpan').click(); truth('add span: supports and bar rows follow', rows('spanRows').length === 4 && rows('supRows').length === 5 && rows('barRows').length === 13);
const s0 = rows('supRows')[0]; s0.querySelector('.kind').value = 'free'; change(s0.querySelector('.kind'));
truth('free end removes its bar row', rows('barRows').length === 12);
rows('spanRows')[0].querySelector('.L').value = '1.5'; rows('spanRows')[0].querySelector('.solL').value = '0'; rows('spanRows')[0].querySelector('.solR').value = '600';
$('addLoad').click(); const ld = rows('loadRows'), last = ld[ld.length - 1]; last.querySelector('.type').value = 'line'; change(last.querySelector('.type'));
truth('line load: P per metre, position enabled', /P \(kN\/m\)/.test(last.querySelector('.vl').textContent) && !last.querySelector('.a').disabled);
$('suggest').click(); truth('cantilever ribbed slab with a line load calculates', /cantilever/.test(res()) && !$('results').querySelector('.err'));
rows('supRows')[2].querySelector('.delta').value = '0.5'; $('calc').click(); truth('δ outside 0.7–1.0 reported', /δ must be between/.test(res()));
rows('supRows')[2].querySelector('.delta').value = '0.85';
$('s').value = '300'; $('taper').value = '2'; $('calc').click(); truth('ribs that meet at the top are reported', /meet at the top/.test(res()));
$('s').value = '900'; $('taper').value = '10'; $('calc').click();
$('printBtn').click(); truth('one-way print: elevation, envelopes, typical and design sections, topping, summary', w.printed && $('report').querySelectorAll('svg').length === 5 && /Typical section through the ribs/.test($('report').textContent) && /Topping and ribs/.test($('report').textContent) && /Summary/.test($('report').textContent));
// waffle
d.querySelector('#modes button[data-m="two"]').click();
truth('waffle pane shown, one-way options hidden', !$('pane-two').classList.contains('hidden') && $('pane-one').classList.contains('hidden') && d.querySelector('.one').classList.contains('hidden'));
truth('waffle bar rows: both ways + 2 continuous edges', rows('tbarRows').length === 4);
$('calc').click(); truth('waffle: case 4, plan, sections, edge shears per rib', /PASS|FAIL/.test(res()) && /Two adjacent edges discontinuous/.test(res()) && /Plan of the panel/.test(res()) && /Long edge 1 \(continuous\)/.test(res()) && /per rib at the margin/.test(res()) && !$('results').querySelector('.err'));
$('eL2').checked = true; change($('eL2')); truth('making long edge 2 continuous adds its bar row', rows('tbarRows').length === 5);
$('method').value = 'simple'; change($('method')); truth('simply supported: edges hidden, only the bottom bars', d.querySelector('.tw-edges').classList.contains('hidden') && rows('tbarRows').length === 2);
$('calc').click(); truth('simply supported panel calculates with its coefficients', /Simply supported, corners free to lift/.test(res()) && !$('results').querySelector('.err'));
$('method').value = 'restrained'; change($('method'));
$('tsuggest').click(); truth('waffle suggestion passes', /PASS/.test(res()) && /One short edge discontinuous/.test(res()));
$('ly').value = '6'; $('calc').click(); truth('l_x longer than l_y rejected', /shorter span/.test(res()));
$('ly').value = '8.1'; $('calc').click(); $('printBtn').click(); truth('waffle print: plan, typical and design sections, shear at the margins', $('report').querySelectorAll('svg').length === 3 && /Shear in the ribs at the solid margins/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-rc-ribbed-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored, waffle mode', !$2('pane-two').classList.contains('hidden') && $2('eL2').checked && $2('ly').value === '8.1' && w2.document.querySelectorAll('#spanRows .row').length === 4 && w2.document.querySelectorAll('#spanRows .row')[0].querySelector('.solR').value === '600');
// the drawings follow the inputs
const w3 = page(), $3 = id => w3.document.getElementById(id), ev = (el, t) => el.dispatchEvent(new w3.Event(t, { bubbles: true }));
const L0 = w3.document.querySelector('#spanRows .row .L'); L0.value = '8'; ev(L0, 'input');
setTimeout(() => {
  truth('live: the elevation follows an edited span', /8 m, h 300/.test($3('drawings').querySelector('svg.elev').textContent));
  w3.document.querySelector('#modes button[data-m="two"]').click();
  setTimeout(() => {
    truth('live: the waffle plan appears on switching modes', /Plan of the panel/.test($3('drawings').textContent) && /ribs at 900 mm both ways/.test($3('drawings').textContent) && !/PASS|FAIL/.test($3('results').textContent));
    $3('margin').value = '5000'; ev($3('margin'), 'input');
    setTimeout(() => {
      truth('live: impossible inputs give a note, not an error', /drawings will appear when the inputs are complete/.test($3('drawings').textContent) && /whole panel/.test($3('drawings').textContent));
      truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
      console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
    }, 350);
  }, 350);
}, 350);
