// Drives "Masonry Wall Panel.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Masonry Wall Panel.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-masonry-wall-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = id => !$(id).closest('.hidden');
truth('page loads without script errors', w.errs.length === 0);
truth('drawing on load: the panel with case E and the section', /Case E, h\/l = 0\.58/.test($('drawings').textContent) && /top: simply supported/.test($('drawings').textContent) && /h_?ef/.test($('drawings').textContent.replace(/\s/g, '')) && !/PASS|FAIL/.test(res()));
$('calc').click();
truth('defaults: a cavity wall passes, lateral load governs', /PASS/.test(res()) && /Governs: lateral load on both leaves/.test(res()) && !$('results').querySelector('.err'));
truth('checks: lateral, bending both ways per leaf, slenderness, vertical at three levels', ['Lateral load on both leaves', 'parallel to the bed joints, loaded leaf', 'perpendicular to the bed joints, other leaf', 'Slenderness', 'Vertical load, top', 'Vertical load, mid-height', 'Vertical load, bottom'].every(s => res().includes(s)));
truth('calculation: Table NA.6 for both leaves, σ_d, ρ₄', /blocks of 7\.3 N\/mm² declared strength/.test(res()) && /clay units, water absorption 7 to 12 %/.test(res()) && /6\.3\.1\(4\)/.test(res()) && /ρ₄/.test(res()));
// flexural strength inputs follow the units
truth('blocks: declared strength shown, water absorption hidden', shown('decl') && !shown('absn')); set('unit', 'clay'); truth('clay: water absorption shown', shown('absn') && !shown('decl') && !shown('size'));
set('fsrc', 'enter'); truth('entered: f_xk1 and f_xk2 shown', shown('fx1') && shown('fx2') && !shown('absn')); set('fsrc', 'na'); set('unit', 'agg');
// single leaf, one-way, edges
$('cav').checked = false; $('cav').dispatchEvent(new w.Event('change', { bubbles: true })); truth('single leaf: the other leaf hidden', !shown('t2'));
$('calc').click(); truth('single leaf checks', /Lateral load/.test(res()) && !/other leaf/.test(res()));
set('eL', 'free'); set('eR', 'free'); $('calc').click(); truth('both sides free: one-way vertical', /spanning vertically one way/.test(res()) && /Bending vertically/.test(res()));
set('eL', 'fixed'); set('eR', 'ss'); $('calc').click(); truth('left continuous: case F mirrored', /case F \(mirrored\)/.test(res()));
set('eTopS', 'free'); $('calc').click(); truth('top free: case B, no vertical checks, noted', /case B/.test(res()) && !/Vertical load, top/.test(res()) && /left out/.test(res()));
set('eTopS', 'fixed'); $('calc').click(); truth('edges with no Annex E case are reported', /match no Annex E case/.test(res()));
set('eTopS', 'ss'); set('eL', 'ss'); set('mortar', 'TL'); $('calc').click(); truth('thin layer with Table NA.6 is reported', /general purpose mortar only/.test(res()));
set('mortar', 'M4'); set('combo', '6.10ab'); truth('6.10a/b: ψ₀ shown', shown('psi0')); set('wk', '1.5'); $('calc').click();
$('printBtn').click(); truth('print: drawing, calculation, checks, verdict', w.printed && $('report').querySelectorAll('svg').length === 1 && /Calculation/.test($('report').textContent) && /largest utilisation/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-masonry-wall-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored', !$2('cav').checked && $2('combo').value === '6.10ab' && $2('wk').value === '1.5' && $2('t2').closest('.hidden'));
const w3 = page(), $3 = id => w3.document.getElementById(id), ev = (el, t) => el.dispatchEvent(new w3.Event(t, { bubbles: true }));
$3('h').value = '3600'; ev($3('h'), 'input');
setTimeout(() => {
  truth('live: the drawing follows h', /Case E, h\/l = 0\.80/.test($3('drawings').textContent));
  $3('l').value = '0'; ev($3('l'), 'input');
  setTimeout(() => {
    truth('live: impossible inputs give a note, not an error', /drawing will appear when the inputs are complete/.test($3('drawings').textContent));
    truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
    console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
  }, 350);
}, 350);
