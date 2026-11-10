// Drives "RC Flat Slab Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Flat Slab Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-rc-flat-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, rows = id => d.querySelectorAll(`#${id} .row`);
const change = el => el.dispatchEvent(new w.Event('change', { bubbles: true }));
const shown = el => !el.classList.contains('hidden');
truth('page loads without script errors', w.errs.length === 0);
truth('no single-column mode here (it is RC Punching Shear)', !$('modes') && !$('pane-punch'));
truth('default frame: 3 spans, 4 columns, δ fixed at the end columns', rows('spanRows').length === 3 && rows('colRows').length === 4 && rows('colRows')[0].querySelector('.delta').disabled && rows('colRows')[3].querySelector('.delta').disabled && !rows('colRows')[1].querySelector('.delta').disabled);
$('calc').click();
truth('flat slab: verdict, elevation, moments, plan, strips, punching', /PASS|FAIL/.test(res()) && !!$('results').querySelector('svg.elev') && !!$('results').querySelector('svg.env') && !!$('results').querySelector('svg.plan') && $('results').querySelectorAll('svg.dk').length === 3 && /Punching at column/.test(res()) && /CS H/.test($('results').querySelector('svg.plan').textContent) && /Table I\.1/.test(res()) && /Punching shear at the columns/.test(res()) && !$('results').querySelector('.err'));
truth('the governing check is named', /Governs: (Column|Span) \d/.test(res()));
truth('moment transfer to the end columns reported', /Mt,max/.test(res()) && /I\.1\.2\(5\)/.test(res()));
const links = [...$('results').querySelectorAll('a.lnk')];
truth('each column opens in RC Punching Shear', links.length === 4 && links.every(a => /^RC%20Punching%20Shear\.html#in=/.test(a.getAttribute('href')) && a.target === '_blank'));
const st = JSON.parse(decodeURIComponent(links[1].getAttribute('href').split('#in=')[1]));
truth('the hand-off carries the column, slab, bars and reaction', st.v === 1 && st.ptype === 'internal' && st.pc1 === 450 && st.ph === 250 && st.pV > 500 && st.psx > 0 && Array.isArray(st.holes) && /Column 2/.test(st.from));
$('addSpan').click(); truth('add span: columns follow', rows('spanRows').length === 4 && rows('colRows').length === 5 && rows('colRows')[3].querySelector('.delta').disabled === false && rows('colRows')[4].querySelector('.delta').disabled);
rows('spanRows')[3].querySelector('.xbtn').click(); truth('remove span: columns follow', rows('spanRows').length === 3 && rows('colRows').length === 4);
truth('internal bay hides the edge distance', !shown(d.querySelector('.edgeonly')));
$('bay').value = 'edge'; change($('bay')); truth('edge bay shows the edge distance', shown(d.querySelector('.edgeonly')));
$('b').value = '4050'; $('calc').click(); truth('edge bay: corner columns at the ends', /corner/.test(res()) && !$('results').querySelector('.err'));
$('bay').value = 'internal'; change($('bay')); $('b').value = '7500';
rows('colRows')[1].querySelector('.delta').value = '0.5'; $('calc').click(); truth('δ outside 0.7–1.0 reported against the column', /Column 2: δ must be between/.test(res()));
rows('colRows')[1].querySelector('.delta').value = '0.85';
const c2 = rows('colRows')[2]; c2.querySelector('.shape').value = 'circ'; c2.querySelector('.c1').value = '500'; $('calc').click();
truth('a circular column calculates', /PASS|FAIL/.test(res()) && !$('results').querySelector('.err'));
$('printBtn').click(); truth('print: frame drawings, moments, strips, punching, summary', w.printed && $('report').querySelectorAll('svg').length === 6 && /Support and span moments/.test($('report').textContent) && /Summary/.test($('report').textContent) && !$('report').querySelector('a.lnk'));
const w2 = page(w.localStorage.getItem('et-rc-flat-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored', w2.document.querySelectorAll('#colRows .row')[2].querySelector('.shape').value === 'circ' && $2('b').value === '7500');
truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
