// Drives "CLT Panels.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'CLT Panels.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-clt-panels-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = id => !$(id).closest('.hidden');
const calc = () => $('calc').click(), err = () => ($('results').querySelector('.err') || {}).textContent || '';
truth('page loads without script errors', w.errs.length === 0);
truth('the layup drawn on load, before Calculate', $('drawings').querySelectorAll('svg').length >= 1 && !/PASS|FAIL/.test(res()));
truth('defaults: a floor, 160 mm five layers of C24, 4.5 m, G and Q', $('use').value === 'floor' && /160, 5 layers/.test($('layup').selectedOptions[0].textContent) && $('cls').value === 'C24' && $('L').value === '4500' && d.querySelectorAll('#loadRows .row').length === 2);
calc();
truth('the default floor passes', /PASS/.test(res()) && !err());
truth('floor checks: bending, shear, rolling shear, bearing, deflections and vibration', ['Bending', 'Shear in the layers along the span', 'Rolling shear in the cross layers', 'Bearing at the supports', 'Instantaneous deflection', 'Net final deflection', 'Fundamental frequency', 'Deflection under a 1 kN point load', 'Unit impulse velocity'].every(s => res().includes(s)));
truth('drawings: the layup with its stresses, the floor, M and V', $('drawings').querySelectorAll('svg').length === 4 && /bending σ/.test(res()));
truth('section properties both ways and the plate stiffness D11 … D88', /Along the outer layers/.test(res()) && /Across them/.test(res()) && /D88/.test(res().replace(/\s/g, '')));
truth('the γ-method stiffness shown for comparison', /γ-method/.test(res()));
// longer span: vibration fails first
set('L', '6000'); calc(); truth('6 m: fails, on vibration', /FAIL/.test(res()) && /Governs: fundamental frequency|Governs: unit impulse|Governs: deflection under/.test(res()));
set('L', '4500'); $('vib').checked = false; $('vib').dispatchEvent(new w.Event('change', { bubbles: true })); truth('vibration off hides B and ζ', !shown('B')); calc(); truth('... and drops the vibration checks', !/Fundamental frequency/.test(res()));
$('vib').checked = true; $('vib').dispatchEvent(new w.Event('change', { bubbles: true }));
// a line load across, and a custom layup
$('addLoad').click(); const r = [...d.querySelectorAll('#loadRows .row')].pop(); truth('a new load is a line load across with a position', r.querySelector('.form').value === 'point' && !r.querySelector('.a').closest('.hidden'));
calc(); truth('with a partition load it calculates', /PASS|FAIL/.test(res()) && !err());
set('layup', 'custom'); truth('custom: the layer table shown with the preset\'s layers', shown('layRows') && d.querySelectorAll('#layRows .row').length === 5);
$('addLayer').click(); $('addLayer').click(); calc(); truth('seven layers calculate (no γ-method for seven)', /PASS|FAIL/.test(res()) && !err());
d.querySelectorAll('#layRows .row')[0].querySelector('.t').value = ''; calc(); truth('a layer without a thickness: an error naming it', /Layer 1/.test(err()));
set('layup', '8');
set('dir', 'cross'); set('L', '2000'); calc(); truth('a load beyond the span: an error', /within the span/.test(err())); set('L', '3000'); calc(); truth('spanning across the outer layers calculates', /across the outer layers/.test(res()) && !err()); set('dir', 'main'); set('L', '4500');
// material
set('fam', 'other'); truth('declared values shown', shown('pfR') && !shown('cls')); calc(); truth('a declared product calculates', /PASS|FAIL/.test(res()) && !err()); set('fam', 'solid');
set('sc', '2'); calc(); truth('service class 2: k_def 1.0', /kdef=1/.test(res().replace(/[\s_]/g, '')) ); set('sc', '1');
// wall
set('use', 'wall');
truth('wall: height, eccentricity, loads at the top and wind shown; the floor\'s hidden; 100 mm three layers', shown('H') && shown('e') && shown('topRows') && shown('wind') && !shown('L') && /100, 3 layers/.test($('layup').selectedOptions[0].textContent));
calc();
truth('the default wall passes, with buckling, the top, shear, rolling shear and bearing', /PASS/.test(res()) && ['Compression and bending with buckling', 'The section at the top', 'Rolling shear in the cross layers', 'Bearing on the floor panel below'].every(s => res().includes(s)));
truth('wall drawings: the layup and the wall with its moment', $('drawings').querySelectorAll('svg').length === 2 && /kNm\/m/.test($('drawings').textContent));
set('H', '6000'); calc(); truth('a 6 m wall of 100 mm: buckling governs', /Governs: compression and bending with buckling/.test(res())); set('H', '2700');
// section only
set('use', 'section'); calc(); truth('section only: the properties without a verdict', /Section properties/.test(res()) && !/PASS|FAIL/.test(res()) && /D11/.test(res().replace(/\s/g, '')));
set('use', 'floor'); calc();
$('printBtn').click();
truth('print: the drawings, properties, calculation, checks and verdict', w.printed && $('report').querySelectorAll('svg').length === 4 && /Plate stiffness/.test($('report').textContent) && /largest utilisation/.test($('report').textContent) && /BS EN 16351/.test($('report').textContent));
truth('the disclaimer', /competent structural engineer/.test(d.body.textContent));
const w2 = page(w.localStorage.getItem('et-clt-panels-v1')), $2 = id => w2.document.getElementById(id);
truth('stored state restored: the floor, its layup and loads', w2.errs.length === 0 && $2('use').value === 'floor' && $2('layup').value === '8' && w2.document.querySelectorAll('#loadRows .row').length === 3);
truth('no script errors along the way', w.errs.length === 0);
console.log(`\n${n - fails}/${n} CLT UI checks passed`);
process.exit(fails ? 1 : 0);
