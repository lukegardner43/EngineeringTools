// Drives "Floor Vibration.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Floor Vibration.html'), 'utf8');
let n = 0, fails = 0;
// the drawings each part of the calculation carries (as pictures for CalcPad; the page shows them above, not in the parts)
const capsIn = (w, re) => (w.eval('lastZ') || []).filter(z => re.test(z.title)).flatMap(z => z.C.items.filter(it => it.t === 'img').map(it => it.caption));
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-floor-vibration-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), calc = () => $('calc').click(), res = () => $('results').textContent;
truth('page loads without script errors', w.errs.length === 0);
truth('section lists filled', $('sec').options.length > 50 && $('prim').value === '610×229×113 UKB');
calc(); truth('verdict with frequency and response factor', /R = /.test(res()) && /Floor frequency/.test(res()) && /primary beam/.test(res()) && !$('results').querySelector('.err'));
truth('the drawings in the full calculation, pictures for CalcPad', JSON.stringify(capsIn(w, /^Floor vibration/)) === JSON.stringify(['Floor plan and effective floor area', 'Modes and beam section']));
{ const z = [...$('results').querySelectorAll('details.zone')];
  truth('the full calculation: mass, stiffness, frequencies, modal mass and response, with the CalcPad buttons and one download of the whole as a single check',
    z.length === 1 && /^Floor vibration:/.test(z[0].querySelector('summary').textContent) && /18\/√δ/.test(z[0].textContent) && /L_?eff|Leff/.test(z[0].textContent.replace(/[\s,]/g, '')) && /W_?b|Wb/.test(z[0].textContent.replace(/[\s,]/g, ''))
    && !!z[0].querySelector('[data-cp="save"]') && $('results').querySelectorAll('[data-cp="all"]').length === 1); }
truth('no VDV note without a walking path', !/Vibration dose/.test(res()));
$('Lp').value = '10'; calc(); truth('walking path: ρ < 1 and VDV note', /Vibration dose/.test(res()));
$('use').value = '4'; $('use').onchange(); truth('use sets the response factor limit', $('Rlim').value === '4');
$('primComp').checked = false; calc(); truth('non-composite primary calculates', !$('results').querySelector('.err'));
$('printBtn').click(); truth('print: sheet built, with the full calculation', w.printed && /Floor vibration/.test($('report').textContent) && /Full calculation/.test($('report').textContent));
const saved = w.localStorage.getItem('et-floor-vibration-v1'); const w2 = page(saved); truth('inputs restored', w2.document.getElementById('Lp').value === '10' && !w2.document.getElementById('primComp').checked);
$('fp').value = '3'; calc(); truth('pace frequency outside 1.7-2.4 Hz rejected', /Pace frequency/.test(res()));
truth('no script errors', w.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
