// Drives ConnectionCheck.html in jsdom (needs the jsdom package: NODE_PATH=<dir with node_modules> node ui_smoke.js):
// every joint type calculates without error, and the P358 tying / detailing checks appear where expected.
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'ConnectionCheck.html'), 'utf8').replace(/<script src=[^>]*><\/script>/g, '');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/' });
const w = dom.window, errors = [];
w.addEventListener('error', e => errors.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
let n = 0, fails = 0, near_;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
(async () => {
  await wait(100);
  for (const id of ['fin', 'pdep', 'fdep', 'dcleat', 'scleat', 'splice', 'base', 'rsplice', 'conc', 'moment', 'brace']) {
    w.switchJt(id); await wait(120);
    if (id === 'base') { w.document.getElementById('ba-M').value = '60'; }
    w.doCalc(); await wait(50);
    const eb = w.document.getElementById('err-box'), res = w.document.getElementById('results');
    const err = eb && eb.style.display !== 'none' ? eb.textContent : '';
    const txt = res ? res.textContent : '';
    truth(`${id}: calculates without error${err ? ' (' + err + ')' : ''}`, !err && res && res.style.display !== 'none');
    if (['fin', 'pdep', 'fdep'].includes(id)) truth(`${id}: tying checks reported`, /Tying/.test(txt));
    if (id === 'fin') truth('fin: P358 detailing checks reported', /Ductility/.test(txt) && /Torsional Restraint/.test(txt));
    if (id === 'base') truth('base: EN 1993-1-8 / EN 1992-4 checks reported', /Effective Area/.test(txt) && /Table 6.7/.test(txt) && /Concrete Cone/.test(txt));
    if (id === 'rsplice') truth('rsplice: T-stub check reported', /T-stub/.test(txt));
    if (id === 'splice') { truth('splice (bearing): net tension, 25% compression and tying checks', /Net Tension/.test(txt) && /25% of the Maximum Compression/.test(txt) && /Vertical Tying/.test(txt));
      w.document.getElementById('sp-type').value = 'nonbearing'; w.document.getElementById('sp-tdiv').value = '10'; w.doCalc(); await wait(50);
      const t2 = w.document.getElementById('results').textContent; truth('splice (non-bearing): minimum actions and plate buckling checks', /Design Actions \(non-bearing\)/.test(t2) && /buckling across the joint/.test(t2)); }
    if (id === 'moment') truth('moment: M_j,Rd reported', /Moment Resistance M_j,Rd/.test(txt) && /Panel Shear/.test(txt));
    if (id === 'conc') truth('conc: EN 1992-4 anchor checks reported', /Concrete Cone/.test(txt) && /Pry-out/.test(txt));
  }
  // parametric drawings: every joint draws an elevation and a second view from its inputs, redraws on input and stays with the results
  for (const id of ['fin', 'pdep', 'fdep', 'dcleat', 'scleat', 'splice', 'base', 'rsplice', 'conc', 'moment', 'brace']) {
    w.switchJt(id); await wait(150);
    const sv = w.document.querySelector('#diag-svg svg.jd'), txt = sv ? sv.textContent : '';
    truth(`${id}: drawing with two titled views`, !!sv && (txt.match(/ELEVATION|SECTION|VIEW ON|PLAN/g) || []).length >= 2);
  }
  w.switchJt('fin'); await wait(150);
  const nC = () => w.document.querySelectorAll('#diag-svg svg circle').length, c0 = nC();
  const nIn = w.document.getElementById('fin-n'); nIn.value = '4'; nIn.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(250);
  truth('fin: drawing redraws with an extra bolt when n changes', nC() > c0);
  truth('fin: bolts beyond the plate are flagged on the drawing', /beyond the plate/.test(w.document.getElementById('diag-svg').textContent));
  w.doCalc(); await wait(60); truth('drawing stays visible after the calculation', !!w.document.querySelector('#diag-svg svg.jd'));
  near_ = (nm, a, b, t) => truth(`${nm}: ${a.toFixed(0)} vs ${b}`, Math.abs(a - b) <= t * b);
  near_('plastic modulus helper, 457x191x67 UKB (datasheet 1481 cm³)', w.eval("wplI(SECTIONS['457×191×67 UKB'])") / 1e3, 1481, 0.01);
  near_('plastic modulus helper, 254x254x89 UKC (datasheet 1246 cm³)', w.eval("wplI(SECTIONS['254×254×89 UKC'])") / 1e3, 1246, 0.01);
  truth('no script errors', errors.length === 0 || (console.log(errors), false));
  console.log(`\n${n - fails}/${n} ConnectionCheck UI checks passed`);
  process.exit(fails ? 1 : 0);
})();
