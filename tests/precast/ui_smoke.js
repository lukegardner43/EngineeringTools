// Drives "Precast Connections.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Precast Connections.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/Precast%20Connections.html', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-precast-connections-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
(async () => {
  const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, draw = () => $('drawings') ? $('drawings').innerHTML : '';
  const set = (id, v) => { const e = $(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const mode = m => d.querySelector(`#modes [data-m=${m}]`).click();
  await wait(300);
  truth('page loads without script errors, bearing first', w.errs.length === 0 && !d.querySelector('.m-bearing').hidden && d.querySelector('.m-half').hidden);
  truth('bearing drawing on load (Figure 10.6 chain)', d.querySelectorAll('#drawings svg.dk').length === 1 && /a required/.test(draw()) && /a provided 250/.test(draw()));
  $('calc').click();
  truth('bearing check: verdict, nominal length and stress', /PASS/.test(res()) && /Nominal bearing length a/.test(res()) && /Bearing stress/.test(res()) && /160/.test(res()));
  set('b_conn', 'dry'); $('calc').click(); truth('dry: the 0.3 f_cd check appears', /Dry connection/.test(res()));
  set('b_conn', 'pad'); set('b_tPad', '10'); set('b_lpad', '150'); $('calc').click(); truth('pad: the transverse steel of (10.5) and the pad length', /soft pad/.test(res()) && /Pad or bedding long enough/.test(res()) && !d.querySelector('.b-pad').hidden);
  set('b_aProv', '120'); $('calc').click(); truth('a short seating fails', /FAIL/.test(res()));
  set('b_aProv', '250'); set('b_conn', 'bedded'); set('b_lpad', '');
  $('printBtn') || $('calc').click(); $('calc').click(); $('printBtn').click();
  truth('bearing print: the A4 sheet with the chain and the checks', w.printed && /Bearing to BS EN 1992-1-1 10.9.5/.test($('report').textContent) && /\(10\.6\)/.test($('report').textContent) && $('report').querySelectorAll('svg.dk').length === 1);
  mode('half'); await wait(260);
  truth('half-joint: inputs shown, drawing with the strut-and-tie forces', !d.querySelector('.m-half').hidden && d.querySelector('.m-bearing').hidden && /F<tspan[^>]*>t<\/tspan> 198 kN/.test(draw()) && /a 186/.test(draw()));
  $('calc').click();
  truth('half-joint check: node, tie, hangers, bottom tie, bearing node, strut, shear, anchorages', ['Compression node at the hangers', 'Nib tie', 'Hangers at the re-entrant corner', 'Bottom tie', 'Bearing node', 'Strut from the bearing', 'Shear in the nib', 'loops', 'U-bars'].every(t => res().includes(t)) && /PASS/.test(res()));
  set('j_alpha', '50'); set('j_nInc', '2'); $('calc').click(); truth('half-joint: inclined bars share the load', /Inclined bars/.test(res()) && /Links in the nib/.test(res()) && !d.querySelector('.j-inc').hidden);
  set('j_alpha', '0'); set('j_VEd', '600'); $('calc').click(); truth('half-joint: 600 kN fails', /FAIL/.test(res()));
  set('j_VEd', '200'); $('calc').click(); $('printBtn').click(); truth('half-joint print: the node layout and the checks', /Half-joint to BS EN 1992-1-1 10.9.4.6/.test($('report').textContent) && /CCIP-057/.test($('report').textContent));
  mode('splice'); await wait(260);
  truth('splice: section and elevation drawings', d.querySelectorAll('#drawings svg.dk').length === 2 && /8H25 in sleeves of 45 mm/.test(draw()) && /embedment 220/.test(draw()));
  $('calc').click();
  truth("splice check: N, M, shear across the bed and the maker's requirements", /Axial compression/.test(res()) && /Bending across h/.test(res()) && /Shear across the grout bed/.test(res()) && /Embedment/.test(res()) && /Grout strength/.test(res()) && /Clear spacing/.test(res()));
  set('s_leProv', '150'); $('calc').click(); truth('splice: short embedment NOT MET', /NOT MET/.test(res()) && /FAIL/.test(res()));
  set('s_leProv', '220'); set('s_capMode', 'value'); set('s_Fk', '150'); set('s_NEd', '-300'); set('s_Mh', '0'); $('calc').click();
  truth('splice: a splice rated below the bar, in tension', /Tension across the joint/.test(res()) && /below the bar/.test(res()) && !d.querySelector('.s-cap').hidden);
  set('s_b', '0'); $('calc').click(); truth('a zero width is reported', !!$('results').querySelector('.err'));
  set('s_b', '400');
  const saved = w.localStorage.getItem('et-precast-connections-v1');
  const w2 = page(saved); await wait(300);
  truth('mode and inputs restored', w2.document.querySelector('#modes .on').dataset.m === 'splice' && w2.document.getElementById('s_capMode').value === 'value' && !w2.document.querySelector('.m-splice').hidden);
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
})();
