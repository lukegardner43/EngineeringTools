// Drives "Bolt Group Analysis.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Bolt Group Analysis.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; } });
const w = dom.window, d = w.document, $ = id => d.getElementById(id); w.errs = []; w.addEventListener('error', e => w.errs.push(e.message));
truth('page loads without script errors', w.errs.length === 0);
$('calc').click();
truth('verdict with the bolt forces', /PASS|FAIL/.test($('results').textContent) && /governing bolt/.test($('results').textContent));
const z = [...$('results').querySelectorAll('details.zone')], s = q => q.querySelector('summary').textContent;
truth('the full calculation: the bolts, the group and the governing bolt, with the CalcPad buttons and one download of the whole as a single check',
  z.length === 1 && /^Bolt group:/.test(s(z[0])) && /J/.test(z[0].textContent) && /β_?Lf|βLf/.test(z[0].textContent.replace(/[\s,]/g, '')) && /k_?1|k1/.test(z[0].textContent.replace(/[\s,]/g, ''))
  && !!z[0].querySelector('[data-cp="save"]') && $('results').querySelectorAll('[data-cp="all"]').length === 1);
$('printBtn').click(); truth('print: the A4 sheet with the full calculation', w.printed && /Full calculation/.test($('report').textContent));
truth('no script errors', w.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
