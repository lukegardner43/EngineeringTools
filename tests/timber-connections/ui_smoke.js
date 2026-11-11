// Drives "Timber Connections.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Timber Connections.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-timber-connections-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent;
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const chk = (id, v) => { const el = $(id); el.checked = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const shown = id => !$(id).closest('.hidden');
const flat = s => s.replace(/\s+/g, '');
truth('page loads without script errors', w.errs.length === 0);
truth('drawing on load: the section and the pattern, before Calculate', /2 shear planes/.test($('drawings').textContent) && /Main member, grain along it/.test($('drawings').textContent) && !/PASS|FAIL/.test(res()));
truth('defaults: P&K 10.13.1, C22, 9 nails a side', $('cls2').value === 'C22' && $('n').value === '9' && $('type').value === 'tt2');
$('calc').click();
truth('defaults pass at 0.959 with mode (e)', /PASS/.test(res()) && /0\.959/.test(res()) && /mode e/.test(res()));
truth('every mode listed with F_v,Rd', $('results').querySelectorAll('table.t tbody tr').length === 6);
truth('calculation: embedment, withdrawal, n_ef, spacings', /8\.15/.test(res()) && /8\.24/.test(res()) && /Table 8\.1/.test(res()) && /Table 8\.2/.test(res()));
truth('nail inputs shown, bolt washer hidden', shown('len') && shown('nail') && !shown('dw') && shown('nailing'));
set('kind', 'bolt'); truth('bolts: washer shown, nail inputs hidden', shown('dw') && !shown('len') && !shown('nailing'));
set('d', '12'); set('fu', '400'); set('n', '3'); set('m', '2'); set('sa1', '60'); set('sa2', '50'); set('sa3', '90'); set('sa4', '40'); set('a2', '30'); $('calc').click();
truth('bolts at 30°: Hankinson, n_ef interpolated, splitting', /8\.31/.test(res()) && /at 30°/.test(res()) && /Splitting across the grain/.test(res()));
set('type', 'st3'); truth('slotted plate: steel inputs shown', shown('ts') && !shown('t1') && /Timber each side/.test(d.querySelector('.t2l').textContent));
$('calc').click(); truth('slotted plate calculates (8.11)', /8\.11/.test(res()) && !$('results').querySelector('.err'));
set('kind', 'nail'); $('calc').click(); truth('nails in a slotted plate: an error', /bolts or dowels/.test($('results').querySelector('.err').textContent));
set('type', 'pt1'); truth('panel inputs shown', shown('panel') && shown('tp')); set('panel', 'osb3'); truth('OSB density 550', $('rhop').value === '550');
set('d', '3'); set('len', '50'); set('n', '6'); set('m', '1'); set('sa1', '42'); set('a2', '0'); set('Fv', '2'); set('Fax', '0.2'); $('calc').click();
truth('panel nails with withdrawal: lateral, withdrawal, combined', /Lateral capacity/.test(res()) && /Withdrawal/.test(res()) && /Lateral and axial together/.test(res()) && /8\.22/.test(res()));
set('kind', 'screw'); truth('screw inputs shown', shown('d1') && shown('lthread')); set('kind', 'nail');
set('n', '1'); $('suggest').click(); truth('find the number of fasteners: more than one, passing', +$('n').value > 1 && /PASS/.test(res()));
set('Fser', '1'); $('calc').click(); truth('slip under a service force', /slip under 1\.00 kN/.test(res()));
$('printBtn').click(); truth('print: drawing, calculation, modes, checks, verdict', w.printed && $('report').querySelectorAll('svg').length === 1 && /Calculation/.test($('report').textContent) && $('report').querySelectorAll('table.t').length === 1 && /largest utilisation/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-timber-connections-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored', $2('type').value === 'pt1' && $2('panel').value === 'osb3' && $2('Fser').value === '1' && !$2('panel').closest('.hidden'));
const w3 = page(), $3 = id => w3.document.getElementById(id), ev = (el, t) => el.dispatchEvent(new w3.Event(t, { bubbles: true }));
$3('t2').value = '75'; ev($3('t2'), 'input');
setTimeout(() => {
  truth('live: the drawing follows t₂', />75</.test($3('drawings').innerHTML));
  $3('d').value = '0'; ev($3('d'), 'input');
  setTimeout(() => {
    truth('live: impossible inputs give a note, not an error', /drawing will appear when the inputs are complete/.test($3('drawings').textContent));
    truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
    console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
  }, 350);
}, 350);
