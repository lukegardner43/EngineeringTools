// Drives "Timber Member.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Timber Member.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-timber-member-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const chk = (id, v) => { const el = $(id); el.checked = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = id => !$(id).closest('.hidden');
const rows = () => [...d.querySelectorAll('#loadRows .row')];
truth('page loads without script errors', w.errs.length === 0);
truth('drawing on load: the member, N and the section, before Calculate', /N\s*Ed\s*39\.75 kN/.test($('drawings').textContent.replace(/\s+/g, ' ')) && /Section/.test($('drawings').textContent) && !/PASS|FAIL/.test(res()));
truth('defaults: P&K 5.7.3, C24 100 × 200', $('cls').value === 'C24' && $('b').value === '100' && rows().length === 2);
$('calc').click();
truth('defaults pass at 0.963, buckling about z–z governs', /PASS/.test(res()) && /0\.963/.test(res()) && /Governs: compression and bending, buckling about z–z/.test(res()));
truth('calculation: k_c each way, k_h, eccentricity', /k\s*c,y/.test(res()) && /e\s*z = 25 mm/.test(res()) && /3\.2, 3\.3, 3\.4/.test(res()));
truth('combinations table', $('results').querySelectorAll('table.t tbody tr').length === 2);
set('fam', 'other'); truth('product values shown', shown('pfc0') && !shown('cls')); $('calc').click(); truth('product calculates', /Kerto-S/.test(res()) && !$('results').querySelector('.err'));
set('fam', 'glulam'); truth('glulam classes', $('cls').value === 'GL24h'); set('fam', 'solid');
truth('lateral buckling length hidden', !shown('lef')); set('ltb', 'lef'); truth('… shown when given', shown('lef')); set('lef', '3000'); $('calc').click();
truth('lateral buckling check', /Lateral torsional buckling/.test(res()) && /6\.35/.test(res()));
// wind on the post
$('addLoad').click(); truth('add an action row', rows().length === 3); const r = rows()[2]; r.querySelector('.N').value = '-30'; r.querySelector('.w').value = '1.0';
$('calc').click();
truth('wind: tension, shear and reversal', /Tension and bending/.test(res()) && /Shear from the lateral load/.test(res()) && /reverses/.test(res()) && /1\.0G \+ 1\.5W/.test(res()));
r.querySelector('.xbtn').click(); truth('remove a row', rows().length === 2);
set('L', '0'); $('calc').click(); truth('a zero length: an error', /length/i.test($('results').querySelector('.err').textContent)); set('L', '3750');
set('b', '47'); set('h', '75'); $('suggest').click(); truth('size the member: a larger section that passes', +$('b').value * +$('h').value > 47 * 75 && /PASS/.test(res()));
$('printBtn').click(); truth('print: drawing, calculation, checks, verdict', w.printed && $('report').querySelectorAll('svg').length === 1 && /Calculation/.test($('report').textContent) && /largest utilisation/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-timber-member-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored', $2('ltb').value === 'lef' && $2('lef').value === '3000' && w2.document.querySelectorAll('#loadRows .row').length === 2 && !$2('lef').closest('.hidden'));
const w3 = page(), $3 = id => w3.document.getElementById(id), ev = (el, t) => el.dispatchEvent(new w3.Event(t, { bubbles: true }));
$3('L').value = '2400'; ev($3('L'), 'input');
setTimeout(() => {
  truth('live: the drawing follows the length', /L 2,400/.test($3('drawings').textContent));
  $3('b').value = '0'; ev($3('b'), 'input');
  setTimeout(() => {
    truth('live: impossible inputs give a note, not an error', /drawing will appear when the inputs are complete/.test($3('drawings').textContent));
    truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
    console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
  }, 350);
}, 350);
