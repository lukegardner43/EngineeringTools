// Drives "Masonry Column.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Masonry Column.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-masonry-column-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = id => !$(id).closest('.hidden');
truth('page loads without script errors', w.errs.length === 0);
truth('drawing on load: both directions, the moment and the plan', /Across t \(t = 215\)/.test($('drawings').textContent) && /Across b \(b = 440\)/.test($('drawings').textContent) && /Plan/.test($('drawings').textContent) && /M \(kNm\)/.test($('drawings').textContent) && !/PASS|FAIL/.test(res()));
$('calc').click();
truth('defaults pass, the governing check named', /PASS/.test(res()) && /Governs: top, across t/.test(res()) && !$('results').querySelector('.err'));
truth('checks each way at the top, mid-height and bottom, with slenderness', ['Slenderness across t', 'Top, across t', 'Mid-height, across t', 'Bottom, across t', 'Slenderness across b', 'Bottom, across b'].every(s => res().includes(s)));
truth('the table has a row per section each way', $('results').querySelectorAll('table.t tbody tr').length === 6);
truth('the small-area factor is shown', /0\.984 small area/.test(res()));
set('wk', '0.8'); $('calc').click(); truth('wind: the least-load case added', $('results').querySelectorAll('table.t tbody tr').length === 12 && /Least load with wind/.test(res()) && /2\.5 %/.test(res()));
set('combo', '6.10ab'); truth('6.10a/b: ψ₀ shown', shown('psi0')); $('calc').click(); truth('6.10a/b: the governing equation named', /6\.10b/.test(res()));
set('rhoT', 'custom'); truth('ρ other: its value shown', shown('rhoTv')); set('rhoTv', '0.85'); $('calc').click(); truth('ρ 0.85 used', /0\.850 × 2400 = 2040 mm/.test(res()));
set('src', 'fk'); truth('f_k entered: units hidden', shown('fk') && !shown('fb')); set('fk', '2'); $('calc').click(); truth('weak masonry fails', /FAIL/.test(res()));
set('src', 'calc'); set('etT', '120'); $('calc').click(); truth('e outside the section reported', /outside the section/.test(res()));
set('etT', '30'); set('h', '7000'); $('calc').click(); truth('slender column fails on h_ef/t_ef', /FAIL/.test(res()) && /Slenderness across t/.test(res()));
set('h', '2400'); $('calc').click();
$('printBtn').click(); truth('print: drawing, the table, checks and the verdict', w.printed && $('report').querySelectorAll('svg').length === 1 && $('report').querySelectorAll('table.t').length === 1 && /largest utilisation/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-masonry-column-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored', $2('combo').value === '6.10ab' && $2('wk').value === '0.8' && $2('rhoT').value === 'custom' && !$2('rhoTv').closest('.hidden'));
const w3 = page(), $3 = id => w3.document.getElementById(id), ev = (el, t) => el.dispatchEvent(new w3.Event(t, { bubbles: true }));
$3('b').value = '665'; ev($3('b'), 'input');
setTimeout(() => {
  truth('live: the drawing follows b', /Across b \(b = 665\)/.test($3('drawings').textContent));
  $3('t').value = '0'; ev($3('t'), 'input');
  setTimeout(() => {
    truth('live: impossible inputs give a note, not an error', /drawing will appear when the inputs are complete/.test($3('drawings').textContent));
    truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
    console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
  }, 350);
}, 350);
