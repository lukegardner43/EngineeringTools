// Drives "Steel Member Fire Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Member Fire Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; } });
const w = dom.window, d = w.document, $ = id => d.getElementById(id); w.errs = []; w.addEventListener('error', e => w.errs.push(e.message));
truth('page loads without script errors', w.errs.length === 0);
$('calc').click();
truth('verdict for the period', /PASS|FAIL/.test($('results').textContent) && /R\d+/.test($('results').querySelector('.verdict').textContent) && !$('results').querySelector('.err'));
const z = [...$('results').querySelectorAll('details.zone')], s = q => q.querySelector('summary').textContent;
truth('the full calculation: the heating, the resistance at the period and at 20 °C, with the CalcPad buttons and one download of the whole as a single check',
  z.length === 3 && /^Exposure and the steel temperature/.test(s(z[0])) && /A_?m\/V|Am\/V/.test(z[0].textContent.replace(/\s/g, '')) && /^Resistance in fire at R\d+/.test(s(z[1])) && /k_?y,θ|ky,θ/.test(z[1].textContent.replace(/\s/g, '')) && /^At 20 °C/.test(s(z[2])) && /\(4\.22\)/.test(z[2].textContent)
  && z.every(q => !!q.querySelector('[data-cp="save"]')) && $('results').querySelectorAll('[data-cp="all"]').length === 1);
$('printBtn').click(); truth('print: the A4 sheet with the full calculation', w.printed && /Steel member in fire/.test($('report').textContent) && /Full calculation/.test($('report').textContent));
for (const t of ['beamU', 'column']) { $('type').value = t; $('type').dispatchEvent(new w.Event('change', { bubbles: true })); $('calc').click();
  truth(`${t}: calculates with its full calculation`, !$('results').querySelector('.err') && $('results').querySelectorAll('details.zone').length === 3); }
truth('no script errors', w.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
