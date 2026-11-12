// Drives "Timber 2D Frame Analysis and Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Timber 2D Frame Analysis and Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-timber-frame-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = id => !$(id).closest('.hidden');
const size = (g, k, v) => { const el = d.querySelector(`#sizes [data-g="${g}"][data-k="${k}"]`); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const calc = () => $('calc').click();
truth('page loads without script errors', w.errs.length === 0);
truth('the frame is drawn on load, before Calculate', $('drawings').querySelectorAll('svg').length === 1 && !/PASS|FAIL/.test(res()));
truth('defaults: a Fink truss, 8 m at 30°, C24 at 600 mm, three member groups', $('kind').value === 'truss' && $('ttype').value === 'fink' && $('cls').value === 'C24' && d.querySelectorAll('#sizes .nm').length === 3);
calc();
truth('defaults pass', /PASS/.test(res()) && !$('results').querySelector('.err'));
truth('the checks: top and bottom chords, webs and both deflections', ['Top chords', 'Bottom chords', 'Webs', 'Instantaneous deflection', 'Net final deflection'].every(s => res().includes(s)));
truth('drawings: the frame with its utilisation, then the forces', $('drawings').querySelectorAll('svg').length === 2 && /Axial forces and bending moments/.test(res()));
truth('every combination listed with its k_mod; the roof imposed load never with snow', /1\.35G \+ 1\.5Qr/.test(res()) && /1\.35G \+ 1\.5S/.test(res()) && [...d.querySelectorAll('#results table')[1].querySelectorAll('tbody tr')].every(r => { const c = r.cells[0].textContent; return !(/Qr/.test(c) && /S\b|W\b/.test(c)); }));
truth('the members table and the reactions of each action', d.querySelectorAll('#results table').length === 3 && /Q ceiling/.test(res()));
truth('the slip warning for a truss', /without slip/.test(res()));
// panels for Howe / Pratt
set('ttype', 'howe'); truth('Howe: the panel count shown', shown('n')); set('n', '8'); calc(); truth('an 8-panel Howe truss calculates', /PASS|FAIL/.test(res()) && !$('results').querySelector('.err'));
set('ttype', 'kingpost'); truth('king post: no panel count', !shown('n')); set('joints', 'pinned'); calc(); truth('a king post truss with every joint pinned calculates', /PASS|FAIL/.test(res()) && !$('results').querySelector('.err'));
// parallel-chord
set('kind', 'flat'); truth('parallel-chord: its type and depth shown, no pitch', shown('ftype') && shown('depth') && !shown('pitch'));
set('ftype', 'warren'); calc(); truth('a Warren truss with pinned joints calculates', /PASS|FAIL/.test(res()) && !$('results').querySelector('.err'));
set('joints', 'chords');
// portal
set('kind', 'portal');
truth('portal: glulam GL24h at 4.8 m, a 12 m span, rafters and columns 140 × 585', $('fam').value === 'glulam' && $('cls').value === 'GL24h' && $('spacing').value === '4800' && $('L').value === '12'
  && d.querySelector('#sizes [data-g="raf"][data-k="1"]').value === '585' && d.querySelectorAll('#sizes .nm').length === 2);
truth('portal: eaves height, bases, walls\' wind and the sway limit shown; the ceiling loads hidden', shown('he') && shown('base') && shown('wWall1') && shown('swayDiv') && !shown('gCeil'));
calc();
truth('the default portal passes', /PASS/.test(res()) && !$('results').querySelector('.err'));
truth('portal: imperfection both ways, α_cr in the combinations, the sway check', /φ →/.test(res()) && /φ ←/.test(res()) && /αcr/.test(res().replace(/\s/g, '')) && /Eaves sway under wind/.test(res()));
set('base', 'fixed'); calc(); truth('fixed bases calculate', /PASS|FAIL/.test(res()));
size('col', 0, '90'); size('col', 1, '270'); size('raf', 0, '90'); size('raf', 1, '360'); set('he', '6'); calc();
truth('a slender portal: second order in some combinations, or a clear failure', /second/.test(res()) || /FAIL/.test(res()) || /unstable/.test(res()));
size('col', 1, ''); calc(); truth('a missing depth: an error naming the group', /Column/.test(($('results').querySelector('.err') || {}).textContent || ''));
size('col', 1, '585'); size('col', 0, '140'); size('raf', 0, '140'); size('raf', 1, '585'); set('he', '4'); set('base', 'pinned');
// material
set('fam', 'other'); truth('an LVL product: its values shown', shown('pfm') && !shown('cls')); calc(); truth('an LVL portal calculates', /PASS|FAIL/.test(res()) && !$('results').querySelector('.err'));
set('fam', 'glulam');
set('L', '-3'); calc(); truth('a negative span: an error', !!$('results').querySelector('.err')); set('L', '12'); calc();
$('printBtn').click();
truth('print: the drawings, the calculation and the checks', w.printed && $('report').querySelectorAll('svg').length === 2 && /largest utilisation/.test($('report').textContent) && /BS EN 1995-1-1/.test($('report').textContent));
truth('the disclaimer', /competent structural engineer/.test(d.body.textContent));
const w2 = page(w.localStorage.getItem('et-timber-frame-v1')), $2 = id => w2.document.getElementById(id);
truth('stored state restored: the portal, its sizes and glulam', w2.errs.length === 0 && $2('kind').value === 'portal' && $2('fam').value === 'glulam' && w2.document.querySelector('#sizes [data-g="raf"][data-k="1"]').value === '585');
truth('no script errors along the way', w.errs.length === 0);
console.log(`\n${n - fails}/${n} timber frame UI checks passed`);
process.exit(fails ? 1 : 0);
