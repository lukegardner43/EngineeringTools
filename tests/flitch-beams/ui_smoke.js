// Drives "Flitch Beams.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Flitch Beams.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-flitch-beam-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = id => !$(id).closest('.hidden');
const rows = () => [...d.querySelectorAll('#loadRows .row')];
truth('page loads without script errors', w.errs.length === 0);
truth('the drawing on load, before Calculate', $('drawings').querySelectorAll('svg').length === 1 && /M12 at 450 max/.test($('drawings').textContent) && !/PASS|FAIL/.test(res()));
truth('defaults: 2 × 75 × 225 C24, a 12 × 200 S275 plate, M12 at 450, two area loads', $('cls').value === 'C24' && $('b').value === '75' && $('tp').value === '12' && $('grade').value === 'S275' && $('bd').value === '12' && rows().length === 2);
$('calc').click();
truth('defaults pass', /PASS/.test(res()) && !$('results').querySelector('.err'));
truth('checks: timber, plate, bolts, splitting, spacings, deflection', ['Timber bending', 'Timber shear at the supports', 'Bearing of the timber', 'Steel plate bending', 'Steel plate shear', 'Bolts along the beam', 'Bolts at each support', 'Splitting at the bolts along the beam', 'Bolt spacing for composite action', 'Bolts to the plate edges', 'Instantaneous deflection', 'Net final deflection'].every(s => res().includes(s)));
truth('the load sharing shown: k_t, k_s, E_0,fin', /kt/.test(res().replace(/\s/g, '')) && /E0,fin/.test(res().replace(/\s/g, '')) && /× 1\.04/.test(res()));
truth('the bolting table', !!$('results').querySelector('table.bt') && /Each support/.test(res()));
// a point load gets its bolts
$('addLoad').click(); const r = rows()[2]; r.querySelector('.case').value = 'Q'; r.querySelector('.form').value = 'point'; r.querySelector('.w').value = '8'; r.querySelector('.a').value = '2';
r.querySelector('.form').dispatchEvent(new w.Event('change', { bubbles: true }));
truth('a point load shows a, not b', !r.querySelector('.a').closest('.hidden') && !!r.querySelector('.bb').closest('.hidden'));
$('calc').click(); truth('the bolts under the point load listed', /Point load at 2\.00 m/.test(res()) && /\d M12/.test($('results').querySelector('table.bt').textContent));
// restraint, materials
set('rmode', 'lef'); truth('l_ef shown for a given length', shown('lef')); set('rmode', 'ends'); $('calc').click(); truth('held at the supports: lateral buckling of each stringer', /lateral buckling of each stringer/.test(res())); set('rmode', 'top');
set('fam', 'other'); truth('a product: its values and ρ_k shown', shown('prhok') && !shown('cls')); $('calc').click(); truth('an LVL product calculates', !$('results').querySelector('.err') && /PASS|FAIL/.test(res()));
set('fam', 'solid');
set('bd', '16'); $('calc').click(); truth('M16 in 225 mm stringers fails the edge distance', /FAIL/.test(res()) && /Bolts to the timber edges/.test(res())); set('bd', '12');
// errors
set('hp', '240'); $('calc').click(); truth('a plate deeper than the timber: an error', /deeper/.test($('results').querySelector('.err').textContent)); set('hp', '200');
$('calc').click();
$('printBtn').click(); truth('print: drawing, calculation, bolting, checks and the verdict', w.printed && $('report').querySelectorAll('svg').length === 1 && /Bolting/.test($('report').textContent) && /largest utilisation/.test($('report').textContent) && /GD9/.test($('report').textContent));
truth('the disclaimer', /competent structural engineer/.test(d.body.textContent));
const w2 = page(w.localStorage.getItem('et-flitch-beam-v1')), $2 = id => w2.document.getElementById(id);
truth('stored state restored: the plate, bolts and loads', w2.errs.length === 0 && $2('hp').value === '200' && $2('bd').value === '12' && w2.document.querySelectorAll('#loadRows .row').length === 3);
truth('no script errors along the way', w.errs.length === 0);
console.log(`\n${n - fails}/${n} flitch beam UI checks passed`);
process.exit(fails ? 1 : 0);
