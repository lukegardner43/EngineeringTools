// Drives "Timber Racking Wall.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Timber Racking Wall.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-timber-racking-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = id => !$(id).closest('.hidden');
const flat = s => s.replace(/\s+/g, '');
truth('page loads without script errors', w.errs.length === 0);
truth('drawing on load: the wall, the racking load, before Calculate', /6\.75kN/.test(flat($('drawings').textContent)) && /incl\. 1 storey above/.test($('drawings').textContent) && !/PASS|FAIL/.test(res()));
truth('defaults: one opening, one storey above', d.querySelectorAll('#openRows .row').length === 1 && d.querySelectorAll('#aboveRows .row').length === 1);
$('calc').click();
truth('defaults pass, racking governs', /PASS/.test(res()) && /Governs: racking/.test(res()) && !$('results').querySelector('.err'));
truth('checks: racking, deflection limit, sliding', ['Racking', 'Racking deflection limit', 'Sliding'].every(s => res().includes(s)));
truth('calculation: the nail by EC5, (20), (21), (16), Note 2', /8\.2\.2/.test(res()) && /PD 6693-1 \(20\)/.test(res()) && /PD 6693-1 \(21\)/.test(res()) && /PD 6693-1 \(16\)/.test(res()) && /may be disregarded/.test(res()));
truth('fastener: given hidden', !shown('Ffd') && shown('d')); set('fmode', 'given'); truth('… given shown', shown('Ffd') && !shown('d')); set('fmode', 'smooth');
truth('second layer inputs hidden', !shown('Ffd2')); set('second', 'oppDiff'); truth('… shown for a different layer', shown('Ffd2')); set('second', 'oppSame');
set('kind', 'ply'); truth('plywood: density follows', $('rhop').value === '410'); set('kind', 'pb'); truth('plasterboard: Table 8 shown, nails hidden', shown('pb') && !shown('d'));
$('calc').click(); truth('plasterboard calculates from Table 8', /Table 8/.test(res()) && !/deflection limit/.test(res()));
set('kind', 'OSB/3'); $('calc').click(); truth('two layers: K_comb', /K\s*comb/.test(res()) || /0\.75 ×/.test(res()));
// a door is a discontinuity
$('addOpen').click(); const r = [...d.querySelectorAll('#openRows .row')].pop(); r.querySelector('.w').value = '0.9'; r.querySelector('.h').value = '2.1'; r.querySelector('.sill').value = '0';
$('calc').click(); truth('a door: not a pass, and the discontinuity named', /FAIL|CHECK/.test(res()) && !/PASS/.test(res()) && /discontinuity/.test($('results').querySelector('.err').textContent));
r.querySelector('.xbtn').click(); truth('remove the door', d.querySelectorAll('#openRows .row').length === 1);
$('addAbove').click(); truth('add a storey above', d.querySelectorAll('#aboveRows .row').length === 2); [...d.querySelectorAll('#aboveRows .row')].pop().querySelector('.xbtn').click();
set('R', '6'); set('fwd', '8'); set('fix', '4'); set('second', 'none'); $('calc').click(); const before = res();
$('suggest').click(); truth('find the nail spacing: closer than 150 and passing', +$('s').value < 150 && /PASS/.test(res()) && /FAIL/.test(before));
$('printBtn').click(); truth('print: drawing, calculation, checks, verdict', w.printed && $('report').querySelectorAll('svg').length === 1 && /Calculation/.test($('report').textContent) && /largest utilisation/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-timber-racking-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored', $2('R').value === '6' && $2('fwd').value === '8' && +$2('s').value < 150 && w2.document.querySelectorAll('#aboveRows .row').length === 1);
const w3 = page(), $3 = id => w3.document.getElementById(id), ev = (el, t) => el.dispatchEvent(new w3.Event(t, { bubbles: true }));
$3('L').value = '4.8'; ev($3('L'), 'input');
setTimeout(() => {
  truth('live: the drawing follows L', /L 4\.80 m/.test($3('drawings').textContent));
  $3('H').value = '0'; ev($3('H'), 'input');
  setTimeout(() => {
    truth('live: impossible inputs give a note, not an error', /drawing will appear when the inputs are complete/.test($3('drawings').textContent));
    truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
    console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
  }, 350);
}, 350);
