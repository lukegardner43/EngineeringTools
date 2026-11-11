// Drives "Gabion Retaining Wall.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Gabion Retaining Wall.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-gabion-wall-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('defaults: three courses, the base offset fixed at 0, the section drawn', d.querySelectorAll('#courseRows .row').length === 3 && d.querySelectorAll('#courseRows .off')[0].disabled && /2\.00 × 1\.00/.test($('drawings').textContent));
truth('defaults: EC7 basis, the factors of safety hidden, limestone fill 16', d.querySelector('#bases .on').dataset.b === 'ec7' && d.querySelector('.b-fos').hidden && $('fillSel').value === 'limestone' && $('fill').value === '16');
$('calc').click();
truth('checked: PASS 0.631, sliding governs, no notes', /PASS/.test(res()) && /0\.631/.test(res()) && !$('results').querySelector('.note:not(:last-of-type)') && /Governs: sliding on the base, DA1-2/.test(res()) && !$('results').querySelector('.err'));
truth('section, checks, the joints table and the calculation', $('results').querySelectorAll('svg.dk').length === 1 && $('results').querySelectorAll('.ck').length >= 9 && $('results').querySelectorAll('table.ctab tbody tr').length === 3 && /K_a|Ka/.test(res().replace(/\s/g, '')) && /Coulomb/.test(res()));
truth('the drawing shows the thrust, the weight and the pressures', /Pa\s*\d/.test($('drawings').textContent) && /W \d/.test($('drawings').textContent) && /kPa/.test($('drawings').textContent));
// factors of safety
d.querySelector('#bases [data-b="fos"]').click();
truth('factors of safety: the limits shown', !d.querySelector('.b-fos').hidden);
$('calc').click();
truth('… checked by F_o and F_s', /F_?s|Fs/.test(res()) && /Overturning about the toe/.test(res()) && /F\s*o\s*=|Fo =/.test(res().replace(/<[^>]+>/g, '')));
d.querySelector('#bases [data-b="ec7"]').click();
// a fourth course
$('addCourse').click(); truth('a fourth course on top, narrower, its back flush with the one below', d.querySelectorAll('#courseRows .row').length === 4 && d.querySelectorAll('#courseRows .w')[3].value === '0.5' && d.querySelectorAll('#courseRows .off')[3].value === '1.5');
$('calc').click(); truth('… checked, three joints in the table', d.querySelectorAll('table.ctab tbody tr').length === 4);
d.querySelectorAll('#courseRows .xbtn')[3].click();
// an overhanging course
const off = d.querySelectorAll('#courseRows .off')[2]; off.value = '1.2'; off.dispatchEvent(new w.Event('input', { bubbles: true }));
$('calc').click(); truth('an overhanging course is refused', /overhangs the back/.test(($('results').querySelector('.err') || {}).textContent || ''));
off.value = '1'; off.dispatchEvent(new w.Event('input', { bubbles: true }));
// fill presets
set('fillSel', 'basalt'); truth('basalt fill sets γ_g 18', $('fill').value === '18');
const fl = $('fill'); fl.value = '17.2'; fl.dispatchEvent(new w.Event('input', { bubbles: true })); truth('another unit weight switches the fill to Other', $('fillSel').value === 'other');
set('fillSel', 'limestone');
// undrained
set('bearing', 'undrained'); truth('undrained: c_u shown, φ′ hidden', !d.querySelector('.b-un').hidden && d.querySelector('.b-dr').hidden);
$('calc').click(); truth('undrained without c_u is refused', /c_u,k|cu,k/.test(($('results').querySelector('.err') || {}).textContent || ''));
set('cuf', '75'); $('calc').click(); truth('undrained with c_u 75 kPa', /Bearing, DA1-2/.test(res()) && !$('results').querySelector('.err'));
set('bearing', 'drained');
$('calc').click(); $('printBtn').click();
truth('print: the section, checks and the joints table', w.printed && $('report').querySelectorAll('svg').length === 1 && $('report').querySelectorAll('table.rt').length === 1 && /Sliding on the base, DA1-2/.test($('report').textContent) && /competent/.test(d.querySelector('footer.disclaimer').textContent));
const w2 = page(w.localStorage.getItem('et-gabion-wall-v1'));
truth('inputs restored', w2.document.querySelectorAll('#courseRows .row').length === 3 && w2.document.getElementById('cuf').value === '75' && w2.document.querySelectorAll('#courseRows .w')[1].value === '1.5');
const w3 = page(), ev = (el, tp) => el.dispatchEvent(new w3.Event(tp, { bubbles: true }));
const W0 = w3.document.querySelector('#courseRows .w'); W0.value = '2.4'; ev(W0, 'input');
setTimeout(() => {
  truth('live: the section follows the base width', /2\.40 × 1\.00/.test(w3.document.getElementById('drawings').textContent));
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
}, 350);
