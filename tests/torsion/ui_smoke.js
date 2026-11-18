// Drives "Steel Beam Torsion.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Beam Torsion.html'), 'utf8');
let n = 0, fails = 0;
// the drawings each part of the calculation carries (as pictures for CalcPad; the page shows them above, not in the parts)
const capsIn = (w, re) => (w.eval('lastZ') || []).filter(z => re.test(z.title)).flatMap(z => z.C.items.filter(it => it.t === 'img').map(it => it.caption));
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; } });
const w = dom.window, d = w.document, $ = id => d.getElementById(id); w.errs = []; w.addEventListener('error', e => w.errs.push(e.message));
truth('page loads without script errors', w.errs.length === 0);
$('calc').click();
truth('verdict with the cross-section, member and twist checks', /PASS|FAIL/.test($('results').textContent) && /Twist at SLS/.test($('results').textContent) && !$('results').querySelector('.err'));
{ const c = capsIn(w, /^Cross-section at x/); truth('the drawings in the full calculation, pictures for CalcPad: the beam with the section; the twist, bimoment, torques, moment and stresses with the cross-section', capsIn(w, /^Section and its sectorial/)[0] === 'Beam, end conditions and eccentric loads'
  && JSON.stringify(c.slice(0, 5)) === JSON.stringify(['Twist φ at ULS (°)', 'Bimoment B (kNm²)', 'St Venant torque Tt (kNm)', 'Warping torque Tw (kNm)', 'Bending moment My (kNm)']) && /^Stresses at the critical section x = .* m \(N\/mm²\)$/.test(c[5])); }
const z = [...$('results').querySelectorAll('details.zone')], s = q => q.querySelector('summary').textContent;
truth('the full calculation: the sectorial properties, the cross-section, the member and the twist, with the CalcPad buttons and one download of the whole as a single check',
  z.length === 4 && /^Section and its sectorial properties/.test(s(z[0])) && /ω/.test(z[0].textContent) && /^Cross-section at x =/.test(s(z[1])) && /B_?Ed|BEd/.test(z[1].textContent.replace(/[\s,]/g, '')) && /^Member/.test(s(z[2])) && /k_?α|kα/.test(z[2].textContent.replace(/[\s,]/g, '')) && /^Twist/.test(s(z[3]))
  && z.every(q => !!q.querySelector('[data-cp="save"]')) && $('results').querySelectorAll('[data-cp="all"]').length === 1);
$('printBtn').click(); truth('print: the A4 sheet with the full calculation', w.printed && /SCI P385/.test($('report').textContent) && /Full calculation/.test($('report').textContent));
truth('no script errors', w.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
