// Drives "Timber Stud Wall.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Timber Stud Wall.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-timber-stud-wall-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const chk = (id, v) => { const el = $(id); el.checked = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = id => !$(id).closest('.hidden');
const rows = () => [...d.querySelectorAll('#loadRows .row')];
truth('page loads without script errors', w.errs.length === 0);
truth('drawings on load: the wall and one stud', /The wall in elevation/.test($('drawings').textContent) && /One stud from the side/.test($('drawings').textContent) && /G 2\.50 \+ Q 3\.00 kN\/m/.test($('drawings').textContent) && !/PASS|FAIL/.test(res()));
truth('defaults: C16 38 × 140 at 600, three load rows', $('cls').value === 'C16' && $('h').value === '140' && rows().length === 3);
$('calc').click();
truth('defaults pass', /PASS/.test(res()) && /Governs:/.test(res()) && !$('results').querySelector('.err'));
truth('checks: stud, sole plate, deflection', ['Compression and bending', 'Sole plate bearing', 'Lateral deflection under wind', 'Shear from the lateral load'].every(s => res().includes(s)));
truth('sheathed: held about z–z', /held about z–z/.test(res()) && !/Lateral torsional buckling/.test(res()));
truth('noggings hidden while sheathed', !shown('rows')); set('restraint', 'noggings'); truth('noggings: rows shown', shown('rows')); set('rows', '2'); $('calc').click();
truth('noggings: buckling both ways and lateral buckling', /buckling about z–z/.test(res()) && /Lateral torsional buckling/.test(res()) && /2 rows of noggings/.test(res()));
set('per', 'stud'); truth('per stud: the label follows', /kN per stud/.test(rows()[0].querySelector('.vl').textContent)); set('per', 'm');
chk('deflOn', false); truth('deflection limit hidden', !shown('div')); $('calc').click(); truth('no deflection check', !/Lateral deflection/.test(res())); chk('deflOn', true);
$('addLoad').click(); truth('add a load row', rows().length === 4); rows()[3].querySelector('.xbtn').click(); truth('remove it', rows().length === 3);
set('fam', 'other'); truth('product values shown', shown('pfc0')); set('fam', 'solid'); set('cls', 'C24');
set('s', '20'); $('calc').click(); truth('spacing under the breadth: an error', /spacing/.test($('results').querySelector('.err').textContent)); set('s', '600');
set('h', '63'); set('H', '3000'); $('suggest').click(); truth('size the studs: a deeper stud that passes', +$('h').value > 63 && /PASS/.test(res()));
$('printBtn').click(); truth('print: two drawings, calculation, checks, verdict', w.printed && $('report').querySelectorAll('svg').length === 2 && /Calculation/.test($('report').textContent) && /largest utilisation/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-timber-stud-wall-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored', $2('restraint').value === 'noggings' && $2('rows').value === '2' && $2('cls').value === 'C24' && w2.document.querySelectorAll('#loadRows .row').length === 3 && !$2('rows').closest('.hidden'));
const w3 = page(), $3 = id => w3.document.getElementById(id), ev = (el, t) => el.dispatchEvent(new w3.Event(t, { bubbles: true }));
$3('H').value = '2700'; ev($3('H'), 'input');
setTimeout(() => {
  truth('live: the drawing follows the height', /H 2,700/.test($3('drawings').textContent));
  $3('b').value = '0'; ev($3('b'), 'input');
  setTimeout(() => {
    truth('live: impossible inputs give a note, not an error', /drawing will appear when the inputs are complete/.test($3('drawings').textContent));
    truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
    console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
  }, 350);
}, 350);
