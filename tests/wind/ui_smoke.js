// Drives "Wind Loading.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Wind Loading.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; w.scrollTo = () => {}; if (store) w.localStorage.setItem('et-wind-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, shown = el => !el.classList.contains('hidden');
const change = el => el.dispatchEvent(new w.Event('change', { bubbles: true })), sel = (id, v) => { $(id).value = v; change($(id)); };
truth('page loads without script errors', w.errs.length === 0);
truth('country, flat roof, no orography: town, pitch and orography fields hidden', !shown(d.querySelector('.town')) && !shown(d.querySelector('.pitched')) && !shown(d.querySelector('.oro')) && shown(d.querySelector('.flatonly')));
$('calc').click();
truth('flat roof: summary, four tabs, plan, face, walls and roof tables', /qp up to/.test(res()) && d.querySelectorAll('#cases button').length === 4 && !!$('results').querySelector('svg.plan') && !!$('results').querySelector('svg.elev')
  && /Table NA\.4/.test(res()) && /Table NA\.5/.test(res()) && !$('results').querySelector('.err'));
const zones = () => [...$('results').querySelectorAll('table.t')[1].querySelectorAll('tr')].slice(1).map(r => r.cells[0].textContent).join();
truth('flat roof zones F G H I', zones() === 'F,G,H,I');
d.querySelector('#cases button[data-k="3"]').click(); truth('a tab shows its side', /Wind on side 4/.test(d.querySelector('#cases button.on').textContent) && /wind from 270°/.test(res()));
sel('rtype', 'duo'); truth('duopitch shows the pitch and hides the eaves', shown(d.querySelector('.pitched')) && !shown(d.querySelector('.flatonly')));
$('calc').click(); d.querySelector('#cases button[data-k="0"]').click();
truth('duopitch θ = 0: Table NA.7, zones F G H J I and a roof force', /Table NA\.7/.test(res()) && zones() === 'F,G,H,J,I' && /Roof horizontal/.test(res()));
d.querySelector('#cases button[data-k="1"]').click(); truth('duopitch gable: zones F G H I', zones() === 'F,G,H,I');
sel('rtype', 'mono'); $('pitch').value = '10'; $('calc').click(); d.querySelector('#cases button[data-k="1"]').click();
truth('monopitch θ = 90°: Table NA.6 with Fup and Flow', /Table NA\.6/.test(res()) && /Fup/.test(zones()) && /Flow/.test(zones()));
sel('terrain', 'town'); truth('town shows its fields', shown(d.querySelector('.town')));
$('xTown').value = '1'; $('have').value = '8'; $('xOpen').value = '5'; $('calc').click(); truth('town: ce,T and hdis reported', /ce,T/.test(res()) && /hdis = 4\.87 m/.test(res()));
sel('orog', 'cliff'); truth('cliff hides the downwind length', shown(d.querySelector('.oro')) && !shown(d.querySelector('.ohill')));
sel('orog', 'hill'); $('alt').value = '120'; $('oAb').value = '60'; $('calc').click(); truth('hill: co reported', /co/.test(res()) && !$('results').querySelector('.err'));
sel('cdirm', 'one'); truth('cdir 1.0 hides the bearing', !shown(d.querySelector('.dirb')));
$('calc').click(); truth('cdir 1.0 in every case', [...d.querySelectorAll('#cases button')].every((b, k) => { b.click(); return /cdir1\.000/.test(res().replace(/\s/g, '')); }));
const link = $('results').querySelector('a.lnk'); const hand = JSON.parse(decodeURIComponent(link.getAttribute('href').split('#in=')[1]));
truth('link to RC Wall Design carries the core moments', /RC%20Wall%20Design\.html#in=/.test(link.getAttribute('href')) && hand.mode === 'core' && hand.cMns > 0 && hand.cMew > 0 && hand.cL === 30 && hand.cW === 12);
$('vbmap').value = '40'; $('calc').click(); truth('bad input reported', !!$('results').querySelector('.err') && /18 and 35/.test(res())); $('vbmap').value = '22';
sel('rtype', 'flat'); sel('eaves', 'parapet'); truth('parapet shows its height', shown(d.querySelector('.ev-parapet')) && !shown(d.querySelector('.ev-curved')));
$('calc').click(); $('printBtn').click();
truth('print: A4 sheet with all four directions', w.printed && /Wind loading to BS EN 1991-1-4/.test($('report').textContent) && (($('report').textContent.match(/Wind on side/g) || []).length === 4));
const w2 = page(w.localStorage.getItem('et-wind-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored', $2('rtype').value === 'flat' && $2('eaves').value === 'parapet' && $2('terrain').value === 'town' && $2('orog').value === 'hill' && !w2.document.querySelector('.town').classList.contains('hidden'));
truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
