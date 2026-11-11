// Drives "Timber Beam.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Timber Beam.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-timber-beam-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const chk = (id, v) => { const el = $(id); el.checked = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = el => !(typeof el === 'string' ? $(el) : el).closest('.hidden');
const rows = () => [...d.querySelectorAll('#loadRows .row')];
const setRow = (r, c, f, v, a, b, up) => { const q = s => r.querySelector(s); q('.case').value = c; q('.form').value = f; q('.w').value = v; if (a != null) q('.a').value = a; if (b != null) q('.bb').value = b; q('.up').checked = !!up; q('.form').dispatchEvent(new w.Event('change', { bubbles: true })); q('.case').dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('drawing on load: the beam, its loads and L, before Calculate', /L = 3,800/.test($('drawings').textContent) && /G self-weight/.test($('drawings').textContent) && !/PASS|FAIL/.test(res()));
truth('defaults: C24, two load rows', $('cls').value === 'C24' && rows().length === 2);
$('calc').click();
truth('defaults: a domestic joist passes', /PASS/.test(res()) && /Governs:/.test(res()) && !$('results').querySelector('.err'));
truth('checks: bending, shear, bearing, deflections, vibration', ['Bending', 'Shear', 'Bearing at the supports', 'Instantaneous deflection', 'Net final deflection', 'Floor frequency', 'Floor deflection under 1 kN', 'Unit impulse velocity'].every(s => res().includes(s)));
truth('combinations table with k_mod', /1\.35G \+ 1\.5Q/.test(res()) && $('results').querySelectorAll('table.t tbody tr').length === 2);
truth('calculation: EN 338, k_h, bearing, vibration', /BS EN 338:2016/.test(res()) && /k_?h/.test(res().replace(/\s/g, '')) && /discrete supports/.test(res()) && /floor vibration/.test(res()));
// material families
set('fam', 'glulam'); truth('glulam: classes listed', $('cls').value === 'GL24h' && [...$('cls').options].some(o => o.value === 'GL32c'));
set('fam', 'other'); truth('product: its values shown, class hidden', shown('pfm') && !shown('cls'));
$('calc').click(); truth('product (Kerto-S defaults) calculates', /Kerto-S/.test(res()) && !$('results').querySelector('.err'));
set('fam', 'hard'); truth('hardwood: D classes', $('cls').value === 'D30' && !shown('pfm')); set('fam', 'solid'); set('cls', 'C16');
// restraint and notch
truth('restraint: load level hidden with the top held', !shown('rlevel') && !shown('lef')); set('rmode', 'ends'); truth('held at the ends: load level shown', shown('rlevel'));
set('rmode', 'lef'); truth('l_ef given: shown', shown('lef')); set('rmode', 'ends');
truth('notch inputs hidden until ticked', !shown('hn')); chk('notchOn', true); truth('notch inputs shown', shown('hn'));
// loads
$('addLoad').click(); $('addLoad').click(); truth('add load rows', rows().length === 4);
setRow(rows()[2], 'Q', 'point', 3, 1.9); setRow(rows()[3], 'W', 'line', 0.5, null, null, true);
truth('a point load shows a, not b', shown(rows()[2].querySelector('.a')) && !shown(rows()[2].querySelector('.bb')) && rows()[2].querySelector('.vl').textContent === 'kN');
truth('wind shows the upward box', shown(rows()[3].querySelector('.upw')) && !shown(rows()[2].querySelector('.upw')));
chk('vibOn', false); truth('vibration inputs hidden', !shown('vm'));
$('calc').click();
truth('held at the ends: lateral buckling in the calculation', /lateral buckling/.test(res()) && /6\.3\.3/.test(res()));
truth('notch: shear at the notched end', /Shear at the notched end/.test(res()) && /k_?v/.test(res().replace(/\s/g, '')));
truth('wind uplift combination listed', /1\.0G \+ 1\.5W/.test(res()) && !/1\.5Q \+ 0\.75W/.test(res()));
truth('no vibration checks when unticked', !/Floor frequency/.test(res()));
rows()[3].querySelector('.xbtn').click(); truth('remove a load row', rows().length === 3);
// errors and sizing
set('spacing', '0'); $('calc').click(); truth('area loads without spacing: an error', /spacing/.test($('results').querySelector('.err').textContent)); set('spacing', '400');
set('clear', '5200'); set('h', '150'); $('suggest').click(); truth('size the beam: a deeper section that passes', +$('h').value > 150 && /PASS/.test(res()));
$('printBtn').click(); truth('print: drawing, calculation, combinations, checks, verdict', w.printed && $('report').querySelectorAll('svg').length === 1 && /Calculation/.test($('report').textContent) && /largest utilisation/.test($('report').textContent) && $('report').querySelectorAll('table.t').length === 1);
const w2 = page(w.localStorage.getItem('et-timber-beam-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored, with the load rows', $2('cls').value === 'C16' && $2('rmode').value === 'ends' && $2('notchOn').checked && !$2('vibOn').checked && w2.document.querySelectorAll('#loadRows .row').length === 3 && !$2('rlevel').closest('.hidden'));
const w3 = page(), $3 = id => w3.document.getElementById(id), ev = (el, t) => el.dispatchEvent(new w3.Event(t, { bubbles: true }));
$3('clear').value = '4400'; ev($3('clear'), 'input');
setTimeout(() => {
  truth('live: the drawing follows the span', /L = 4,500/.test($3('drawings').textContent));
  $3('h').value = '0'; ev($3('h'), 'input');
  setTimeout(() => {
    truth('live: impossible inputs give a note, not an error', /drawing will appear when the inputs are complete/.test($3('drawings').textContent));
    truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
    console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
  }, 350);
}, 350);
