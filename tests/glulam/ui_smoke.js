// Drives "Glulam Beams.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Glulam Beams.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-glulam-beam-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const chk = (id, v) => { const el = $(id); el.checked = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = el => !(typeof el === 'string' ? $(el) : el).closest('.hidden');
const rows = () => [...d.querySelectorAll('#loadRows .row')];
const shape = s => d.querySelector(`#shapes button[data-s="${s}"]`).click();
const setRow = (r, c, f, v, a, b, up) => { const q = s => r.querySelector(s); q('.case').value = c; q('.form').value = f; q('.w').value = v; if (a != null) q('.a').value = a; if (b != null) q('.bb').value = b; q('.up').checked = !!up; q('.form').dispatchEvent(new w.Event('change', { bubbles: true })); q('.case').dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('drawing on load: the elevation and the charts, before Calculate', $('drawings').querySelectorAll('svg').length === 3 && /L = 16\.00 m/.test($('drawings').textContent) && !/PASS|FAIL/.test(res()));
truth('defaults: double tapered GL24h, two area loads', $('shape').value === 'double' && $('cls').value === 'GL24h' && rows().length === 2 && rows().every(r => r.querySelector('.form').value === 'area'));
truth('double tapered: h_s and h_ap shown, the curve hidden', shown('hs') && shown('hap') && !shown('h1') && !shown('rin') && !shown('t'));
$('calc').click();
truth('defaults: the double tapered beam passes', /PASS/.test(res()) && /Governs:/.test(res()) && !$('results').querySelector('.err'));
truth('checks: along the beam, apex, bearing, deflections', ['Bending along the beam', 'Shear', 'Bending in the apex zone', 'Tension perpendicular to the grain in the apex zone', 'Shear with tension perpendicular to the grain at the apex', 'Bearing at the supports', 'Instantaneous deflection', 'Net final deflection'].every(s => res().includes(s)));
truth('three drawings: elevation, bending, shear', $('drawings').querySelectorAll('svg').length === 3 && /apex zone/.test($('drawings').textContent) && /capacity/.test($('drawings').textContent));
truth('combinations table with the apex columns', $('results').querySelectorAll('table.t tbody tr').length >= 2 && /Apex shear \+ tension/.test(res()));
truth('calculation: k_l, k_p, k_vol, k_dis 1.4', /6\.4\.3/.test(res()) && /k_?vol/.test(res().replace(/\s/g, '')) && /k_?dis = 1\.4/.test(res().replace(/\s/g, ' ')));
// shapes
shape('single'); truth('single tapered: h_s and h₁ shown', shown('h1') && !shown('hap') && $('shapeHelp').textContent.includes('left support'));
$('calc').click(); truth('single tapered: no apex checks', /Single tapered/.test(res()) && !/Bending in the apex zone/.test(res()) && !$('results').querySelector('.err'));
shape('curved'); truth('curved: h, β, r_in and t shown, h_s hidden', shown('h') && shown('beta') && shown('rin') && shown('t') && !shown('hs'));
$('calc').click(); truth('curved: k_r and the horizontal movement warning', /Curved beam/.test(res()) && /k_?r/.test(res().replace(/\s/g, '')) && /horizontal movement/.test(res()));
shape('pitched'); truth('pitched cambered: α_ap and the soffit slope', shown('alpha') && shown('beta') && /Soffit slope/.test(d.querySelector('.betaL').textContent));
$('calc').click(); truth('pitched cambered: k_dis 1.7, h_ap from the geometry', /Pitched cambered/.test(res()) && /k_?dis = 1\.7/.test(res().replace(/\s/g, ' ')) && /hap1368/.test(res().replace(/\s/g, '')));
// materials
set('fam', 'other'); truth('product: its values shown, class hidden', shown('pfm') && !shown('cls'));
$('calc').click(); truth('an LVL product refused for a pitched cambered beam', /glued laminated timber/.test($('results').querySelector('.err').textContent));
set('pkind', 'glulam'); $('calc').click(); truth('a declared glulam product calculates', !$('results').querySelector('.err') && /PASS|FAIL/.test(res()) && /Kerto-S/.test(res()));
set('fam', 'glulam'); set('cls', 'GL28h'); shape('double');
// restraint, loads
set('rmode', 'top'); truth('held along the top: l_ef hidden', !shown('lef')); set('rmode', 'lef'); truth('bracing spacing: l_ef shown', shown('lef'));
$('addLoad').click(); $('addLoad').click(); truth('add load rows', rows().length === 4);
setRow(rows()[2], 'Q', 'point', 10, 6); setRow(rows()[3], 'W', 'line', 0.8, null, null, true);
truth('a point load shows a, not b', shown(rows()[2].querySelector('.a')) && !shown(rows()[2].querySelector('.bb')) && rows()[2].querySelector('.vl').textContent === 'kN');
truth('wind shows the upward box', shown(rows()[3].querySelector('.upw')) && !shown(rows()[2].querySelector('.upw')));
$('calc').click(); truth('wind uplift combination listed', /1\.0G \+ 1\.5W/.test(res()) && !$('results').querySelector('.err'));
rows()[3].querySelector('.xbtn').click(); truth('remove a load row', rows().length === 3);
// errors
set('spacing', '0'); $('calc').click(); truth('area loads without spacing: an error', /spacing/.test($('results').querySelector('.err').textContent)); set('spacing', '5');
set('hap', '400'); $('calc').click(); truth('h_ap not deeper than h_s: an error', !!$('results').querySelector('.err')); set('hap', '1250');
$('calc').click();
$('printBtn').click(); truth('print: three drawings, calculation, combinations, checks, verdict', w.printed && $('report').querySelectorAll('svg').length === 3 && /Calculation/.test($('report').textContent) && /largest utilisation/.test($('report').textContent) && $('report').querySelectorAll('table.t').length === 1);
truth('print: the disclaimer and the verification note', /competent structural engineer/.test(d.body.textContent) && /Partly verified/.test(d.body.textContent));
// stored state comes back
const w2 = page(w.localStorage.getItem('et-glulam-beam-v1')), $2 = id => w2.document.getElementById(id);
truth('stored state restored: shape, class, loads', w2.errs.length === 0 && $2('shape').value === 'double' && $2('cls').value === 'GL28h' && w2.document.querySelectorAll('#loadRows .row').length === 3);
truth('…and the drawing follows it', $2('drawings').querySelectorAll('svg').length === 3);
truth('no script errors along the way', w.errs.length === 0);
console.log(`\n${n - fails}/${n} glulam UI checks passed`);
process.exit(fails ? 1 : 0);
