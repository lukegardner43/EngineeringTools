// Drives ConnectionCheck.html in jsdom (needs the jsdom package: NODE_PATH=<dir with node_modules> node ui_smoke.js):
// every joint type calculates without error, and the P358 tying / detailing checks appear where expected.
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'ConnectionCheck.html'), 'utf8').replace(/<script src=[^>]*><\/script>/g, '');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/' });
const w = dom.window, errors = [];
w.addEventListener('error', e => errors.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
(async () => {
  await wait(100);
  for (const id of ['fin', 'pdep', 'fdep', 'dcleat', 'scleat', 'splice', 'base', 'rsplice', 'conc', 'brace']) {
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
    if (id === 'conc') truth('conc: EN 1992-4 anchor checks reported', /Concrete Cone/.test(txt) && /Pry-out/.test(txt));
  }
  truth('no script errors', errors.length === 0 || (console.log(errors), false));
  console.log(`\n${n - fails}/${n} ConnectionCheck UI checks passed`);
  process.exit(fails ? 1 : 0);
})();
