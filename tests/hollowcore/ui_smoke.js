// Drives "Hollowcore Support Beam.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Hollowcore Support Beam.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; } });
const w = dom.window, d = w.document, $ = id => d.getElementById(id); w.errs = []; w.addEventListener('error', e => w.errs.push(e.message));
truth('page loads without script errors', w.errs.length === 0);
$('calc').click();
truth('verdict with the construction and final checks', /PASS|FAIL/.test($('results').textContent) && /Construction/.test($('results').textContent) && /Final/.test($('results').textContent) && !$('results').querySelector('.err'));
const z = [...$('results').querySelectorAll('details.zone')], s = q => q.querySelector('summary').textContent;
truth('the full calculation: the section and bearing, the governing construction stages, the final stage and the transverse bending, with the CalcPad buttons and one download of the whole as a single check',
  z.length >= 5 && /^Section, steel, class and the plank bearing/.test(s(z[0])) && z.some(q => /^Construction .*cross-section, bending and torsion/.test(s(q)) && /B_?Ed|BEd/.test(q.textContent.replace(/[\s,]/g, ''))) && z.some(q => /^Final stage/.test(s(q))) && z.some(q => /^Transverse bending/.test(s(q)))
  && z.every(q => !!q.querySelector('[data-cp="save"]')) && $('results').querySelectorAll('[data-cp="all"]').length === 1);
$('printBtn').click(); truth('print: the A4 sheet with the full calculation', w.printed && /Hollowcore Support Beam/.test($('report').textContent) && /Full calculation/.test($('report').textContent));
truth('no script errors', w.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
