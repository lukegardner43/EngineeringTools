// Drives "Masonry Bearing.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Masonry Bearing.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-masonry-bearing-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = id => !$(id).closest('.hidden');
truth('page loads without script errors', w.errs.length === 0);
truth('drawing on load, before Calculate: elevation and section with l_efm and the spreader', !!$('drawings').querySelector('svg') && /Elevation along the wall/.test($('drawings').textContent) && /Section through the wall/.test($('drawings').textContent) && /spreader 440/.test($('drawings').textContent) && !/PASS|FAIL/.test(res()));
$('calc').click();
truth('defaults: PASS with the padstone, the governing check named', /PASS/.test(res()) && /Governs: /.test(res()) && !$('results').querySelector('.err'));
truth('without the padstone: a padstone is needed (the padstone calculator\'s first answer)', /Without the padstone: .* so a padstone is needed/.test(res()));
truth('checks: beam on the padstone, masonry under the spreader, eccentricity, mid-height', ['Beam on the padstone', 'Masonry under the spreader', 'Load within the middle half', 'Wall at mid-height'].every(s => res().includes(s)));
truth('calculation steps: K, fk, γM, β, mid-height', /K = 0\.55/.test(res()) && /eq\. 3\.1/.test(res()) && /NA\.1/.test(res()) && /Annex G/.test(res()));
// characteristic loads
set('lmode', 'char'); truth('characteristic loads: G and Q shown, N_Ed hidden', shown('Gk') && shown('Qk') && !shown('NEd'));
set('Gk', '20'); set('Qk', '10'); $('calc').click(); truth('N_Ed = 1.35 G + 1.5 Q = 42.0 kN', /42\.0 kN/.test(res()));
// f_k directly
set('src', 'fk'); truth('f_k entered: units and mortar hidden, group kept', shown('fk') && !shown('fb') && !shown('mortar') && shown('group'));
set('fk', '1.23'); set('cat', 'II'); $('calc').click(); truth('f_k 1.23, γ_M 3: f_d 0.410', /fd 0\.410|f d 0\.410|0\.410 N\/mm²/.test(res()));
// no padstone
set('pmat', 'none'); truth('no padstone: its inputs hidden', !shown('pL') && !shown('pfck'));
$('calc').click(); truth('no padstone: FAIL and "Padstone needed"', /FAIL/.test(res()) && /Padstone needed/.test(res()) && /Bearing on the masonry/.test(res()));
// size one
$('suggest').click(); truth('Size a padstone: when the wall itself fails at mid-height, says so', /No padstone .* passes\. With .* wall at mid-height below the load still fails .* a padstone does not change that/.test(res()));
set('fk', '3'); $('suggest').click(); truth('Size a padstone: concrete chosen, sized and passing', $('pmat').value === 'concrete' && /PASS/.test(res()) && +$('pW').value === 100 && +$('pL').value >= 133);
// masonry padstone, β = 1
set('pmat', 'masonry'); truth('masonry padstone: f_k,pad shown, concrete hidden', shown('pfk') && !shown('pfck'));
set('bmode', 'one'); $('calc').click(); truth('β = 1 by choice is reported', /β taken as 1 by choice/.test(res()));
set('bmode', 'calc');
// units: thin layer and lightweight fields
set('src', 'calc'); set('mortar', 'LW1'); truth('lightweight mortar: f_m shown, collar joint hidden', shown('fm') && !shown('collar'));
set('mortar', 'M4'); set('unit', 'aac'); truth('AAC: Group 2 not offered, voids hidden', $('group').querySelector('option[value="2"]').disabled && !shown('voids'));
set('unit', 'agg'); truth('aggregate Group 1: formed voids shown', shown('voids'));
// mid-height off, custom ρ
set('rho', 'custom'); truth('ρ other: its value shown', shown('rhoV'));
$('midOn').checked = false; $('midOn').dispatchEvent(new w.Event('change', { bubbles: true })); truth('mid-height off: its inputs hidden', !shown('hst'));
$('calc').click(); truth('no mid-height check when off', !/Wall at mid-height/.test(res()));
// errors
set('inset', '50'); $('calc').click(); truth('a bearing past the far face is reported', /far face/.test(res()));
set('inset', '0'); set('pL', '5000'); $('calc').click(); truth('a padstone longer than the wall is reported', /longer than the wall/.test(res()));
set('pL', '440'); $('calc').click();
$('printBtn').click(); truth('print: drawing, calculation, checks, verdict', w.printed && $('report').querySelectorAll('svg').length === 1 && /Calculation/.test($('report').textContent) && /Checks/.test($('report').textContent) && /largest utilisation/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-masonry-bearing-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored', $2('lmode').value === 'char' && $2('pmat').value === 'masonry' && !$2('midOn').checked && $2('Gk').value === '20');
// the drawing follows the inputs
const w3 = page(), $3 = id => w3.document.getElementById(id), ev = (el, t) => el.dispatchEvent(new w3.Event(t, { bubbles: true }));
$3('aL').value = '0'; ev($3('aL'), 'input');
setTimeout(() => {
  truth('live: the bearing at the end of the wall', /end of wall/.test($3('drawings').textContent));
  $3('ph').value = '3000'; ev($3('ph'), 'input');
  setTimeout(() => {
    truth('live: impossible inputs give a note, not an error', /drawing will appear when the inputs are complete/.test($3('drawings').textContent) && /as deep as the wall/.test($3('drawings').textContent));
    truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
    console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
  }, 350);
}, 350);
