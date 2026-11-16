// Drives "Steel Frame Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Frame Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; } });
const w = dom.window, d = w.document, $ = id => d.getElementById(id); w.errs = []; w.addEventListener('error', e => w.errs.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  truth('page loads without script errors', w.errs.length === 0);
  $('calc').click(); for (let i = 0; i < 400 && !/PASS|FAIL|err/.test($('results').innerHTML); i++) await wait(25);
  truth('verdict with the members and the serviceability checks', /PASS|FAIL/.test($('results').textContent) && /drift|deflection/.test($('results').textContent) && !$('results').querySelector('.err'));
  const z = [...$('results').querySelectorAll('details.zone')], s = q => q.querySelector('summary').textContent;
  truth('the full calculation: the frame’s stability, every member under its governing combination, the serviceability, with the CalcPad buttons and one download of the whole as a single check',
    z.length >= 8 && /^Frame stability and imperfections/.test(s(z[0])) && /φ/.test(z[0].textContent) && z.some(q => /^Member 1 \(column\)/.test(s(q)) && /Section, steel and class/.test(s(q))) && z.some(q => /^Member 3 \(beam\)/.test(s(q)))
    && /^Serviceability/.test(s(z[z.length - 1])) && z.every(q => !!q.querySelector('[data-cp="save"]')) && $('results').querySelectorAll('[data-cp="all"]').length === 1);
  $('printBtn').click(); truth('print: the A4 sheet with the full calculation', w.printed && /Steel frame/.test($('report').textContent) && /Full calculation/.test($('report').textContent));
  truth('no script errors', w.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
})();
