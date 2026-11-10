// Drives "Snow Loading.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Snow Loading.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; w.scrollTo = () => {}; if (store) w.localStorage.setItem('et-snow-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, shown = el => !el.classList.contains('hidden');
const sel = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('change', { bubbles: true })); };
truth('page loads without script errors', w.errs.length === 0);
truth('monopitch first: its inputs only', shown(d.querySelector('.m-mono')) && !shown(d.querySelector('.m-duo')) && !shown(d.querySelector('.m-abut')));
$('calc').click();
truth('monopitch: summary, sk, one persistent case with a section', /Snow on the roof up to 0\.400 kN\/m²/.test(res()) && /0\.400 kN\/m²μ 0\.80/.test(d.querySelector('#results svg.dk').textContent) && /sk \(kN\/m²\)0\.500/.test(res()) && d.querySelectorAll('#results .case').length === 1 && d.querySelectorAll('#results svg.dk').length === 1 && !/Accidental/.test(res()));
const expect = { duo: [3, /Table NA\.1/], multi: [2, /Annex B2/], cyl: [2, /Table NA\.2/], abut: [2, /Table B1/], parapet: [2, /B4\(3\)/], obstr: [2, /Figure B3/], canopy: [2, /Figure B3/] };
for (const [t, [k, re]] of Object.entries(expect)) {
  sel('type', t); truth(`${t}: its inputs shown`, shown(d.querySelector('.m-' + t)) && !shown(d.querySelector('.m-mono')));
  $('calc').click();
  truth(`${t}: ${k} cases, references, sections, no error`, d.querySelectorAll('#results .case').length === k && re.test(res()) && d.querySelectorAll('#results svg.dk').length === k && !$('results').querySelector('.err'));
  if (t !== 'duo' && t !== 'cyl') truth(`${t}: accidental drift reported`, /Accidental/.test(res()) && /exceptional drift up to/.test(res()));
}
sel('zone', '6.5'); $('alt').value = '400'; $('calc').click(); truth('zone and altitude change sk', /sk \(kN\/m²\)1\.421/.test(res()));
$('alt').value = '1600'; $('calc').click(); truth('altitude over 1500 m reported', !!$('results').querySelector('.err') && /Met Office/.test(res())); $('alt').value = '100';
sel('type', 'canopy'); $('nB1').value = '6'; $('calc').click(); truth('canopy over 5 m reported', /5 m/.test(res()) && !!$('results').querySelector('.err')); $('nB1').value = '2';
sel('type', 'duo'); $('keep').checked = true; $('dA1').value = '50'; $('dA2').value = '50'; $('calc').click(); truth('snow fence keeps μ at 0.8 on a steep roof', /0\.80/.test(d.querySelectorAll('#results table.t')[0].textContent));
$('calc').click(); $('printBtn').click();
truth('print: A4 sheet with ground snow and every case', w.printed && /Snow loading to BS EN 1991-1-3/.test($('report').textContent) && /NA\.2\.8/.test($('report').textContent) && $('report').querySelectorAll('svg').length === 3);
const w2 = page(w.localStorage.getItem('et-snow-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored', $2('type').value === 'duo' && $2('zone').value === '6.5' && $2('keep').checked && !w2.document.querySelector('.m-duo').classList.contains('hidden'));
truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
