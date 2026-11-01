// Drives "RC Slab FE Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Slab FE Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-rc-slab-fe-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, rows = id => d.querySelectorAll(`#${id} .row`);
  const change = el => el.dispatchEvent(new w.Event('change', { bubbles: true }));
  const calc = async () => { $('calc').click(); for (let k = 0; k < 600 && $('calc').disabled; k++) await sleep(50); };
  truth('page loads without script errors', w.errs.length === 0);
  truth('default plan: 16 grid intersections, all columns', d.querySelectorAll('#prev .ci').length === 16 && /16 columns/.test($('prevNote').textContent));
  $('spx').value = '6, 6'; $('spy').value = '6'; $('elsz').value = '0.5'; change($('spx'));
  truth('the plan follows the spans: 2 x 1 bays, 6 columns', d.querySelectorAll('#prev .ci').length === 6 && /2 × 1 bays/.test($('prevNote').textContent));
  await calc();
  truth('results: verdict, plan map, scale, checks, tables', /PASS|FAIL/.test(res()) && !!$('results').querySelector('svg.map') && !!$('results').querySelector('.scale') && /Reinforcement/.test(res()) && /Columns and punching/.test(res()) && /Deflection by bay/.test(res()) && !$('results').querySelector('.err'));
  truth('each column opens in RC Punching Shear', $('results').querySelectorAll('a.lnk').length === 6 && [...$('results').querySelectorAll('a.lnk')].every(a => /^RC%20Punching%20Shear\.html#in=/.test(a.getAttribute('href'))));
  const st = JSON.parse(decodeURIComponent($('results').querySelector('a.lnk').getAttribute('href').split('#in=')[1]));
  truth('the hand-off carries a corner column with its edge distances and reaction', st.ptype === 'corner' && st.pey > 0 && st.pex > 0 && st.pV > 0 && st.psx > 0);
  const sel = $('viewSel'); truth('19 plan views (long-term deflection first)', sel.options.length === 19 && sel.value === 'wlt');
  sel.value = 'pv2'; change(sel); truth('switching the plan to the top steel provided', $('results').querySelector('svg.map').dataset.key === 'pv2');
  sel.value = 'mx'; change(sel); truth('moments use the diverging scale', /hogging/.test($('results').querySelector('.scale').textContent));
  truth('the governing spot is marked', !!$('results').querySelector('svg.map circle'));
  $('printBtn').click(); truth('print: six plans, tables and the summary', w.printed && $('report').querySelectorAll('svg.map').length === 6 && /Summary/.test($('report').textContent) && /Reinforcement/.test($('report').textContent));
  // columns chosen on the plan
  d.querySelectorAll('#prev .ci')[0].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  truth('clicking an intersection removes its column and switches to chosen columns', $('colAt').value === 'custom' && /5 columns/.test($('prevNote').textContent));
  d.querySelectorAll('#prev .ci')[0].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  truth('clicking again puts it back', /6 columns/.test($('prevNote').textContent));
  // walls, openings, loads
  $('addWall').click(); $('addHole').click(); $('addLoad').click();
  const ld = rows('loadRows')[0]; ld.querySelector('.type').value = 'point'; change(ld.querySelector('.type'));
  truth('a point load disables its second corner', ld.querySelector('.x1').disabled && /kN$/.test(ld.querySelector('.vl').textContent));
  truth('walls, openings and loads appear on the plan', d.querySelectorAll('#prev line[stroke-width="4"]').length >= 1 && d.querySelectorAll('#prev circle[r="4"]').length === 1);
  const hr = rows('holeRows')[0]; hr.querySelector('.x0').value = '1'; hr.querySelector('.y0').value = '2'; hr.querySelector('.x1').value = '2'; hr.querySelector('.y1').value = '3';
  const wr = rows('wallRows')[0]; wr.querySelector('.x0').value = '6'; wr.querySelector('.y0').value = '1'; wr.querySelector('.x1').value = '6'; wr.querySelector('.y1').value = '5';
  await calc(); truth('with a wall, an opening and a point load the slab calculates', /PASS|FAIL/.test(res()) && /Wall 1/.test(res()) && !$('results').querySelector('.err'));
  // errors
  $('colAt').value = 'none'; change($('colAt')); await calc(); truth('a slab with nothing but a short wall under it is a mechanism', /mechanism|support/.test(res()));
  rows('wallRows')[0].querySelector('.xbtn').click(); await calc(); truth('no supports at all is reported', /Give the slab some support/.test(res()));
  $('colAt').value = 'all'; change($('colAt')); $('spx').value = '6, 0'; await calc(); truth('a bad span is reported', /spans in metres/.test(res()));
  $('spx').value = '6, 6';
  // edges and long-term off
  $('eL').value = 'pinned'; $('eR').value = 'fixed'; $('ltOn').checked = false; change($('eL')); await calc();
  truth('edge supports and no long-term run', /Left edge/.test(res()) && !/long-term/i.test($('viewSel').innerHTML.split('</option>')[0]) && $('viewSel').value === 'wk');
  const w2 = page(w.localStorage.getItem('et-rc-slab-fe-v1')), $2 = id => w2.document.getElementById(id);
  truth('inputs restored', $2('spx').value === '6, 6' && $2('eR').value === 'fixed' && !$2('ltOn').checked && w2.document.querySelectorAll('#holeRows .row').length === 1 && w2.document.querySelectorAll('#loadRows .row').length === 1);
  truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
})();
