// Drives "RC Beam Analysis and Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Beam Analysis and Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-rc-beam-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, rows = id => d.querySelectorAll(`#${id} .row`);
const change = el => el.dispatchEvent(new w.Event('change', { bubbles: true }));
truth('page loads without script errors', w.errs.length === 0);
truth('default beam: 3 spans, 4 supports, 7 loads, bar rows for 4 supports and 3 spans (+ links)', rows('spanRows').length === 3 && rows('supRows').length === 4 && rows('loadRows').length === 7 && rows('barRows').length === 4 + 3 + 3);
$('calc').click();
truth('calculates: verdict, elevation, BM and SF envelopes, tables', /PASS|FAIL/.test(res()) && !!$('results').querySelector('svg.elev') && $('results').querySelectorAll('svg.env').length === 2 && $('results').querySelectorAll('table').length === 4 && !$('results').querySelector('.err'));
truth('results list support, span and shear rows and curtailment', /4 column/.test(res()) && /Span 2 left/.test(res()) && /Support 2 top, into span 1/.test(res()) && /50% may stop/.test(res()));
truth('zones open to the calculation steps', d.querySelectorAll('#results details.zone').length >= 3 + 4 + 6 && /5\.3\.2\.2/.test(res()));
$('suggest').click();
truth('suggest bars: all checks pass', /PASS/.test(res()) && !$('results').querySelector('.err'));
const sup2 = d.querySelector('#barRows .row[data-kind="sup"][data-i="1"]');
truth('suggested compression bars where the redistributed support needs them', +sup2.querySelector('.nc').value > 0);
sup2.querySelector('.nc').value = '0'; $('calc').click(); truth('removing them fails the compression steel check', /Compression steel/.test(res()) && /FAIL/.test(res()));
$('suggest').click();
// cantilever at the left end
const s0 = rows('supRows')[0]; s0.querySelector('.kind').value = 'free'; change(s0.querySelector('.kind'));
truth('free end: support 1 columns hidden and its top bar row removed', s0.querySelector('.cols').classList.contains('hidden') && !d.querySelector('#barRows .row[data-kind="sup"][data-i="0"]'));
rows('spanRows')[0].querySelector('.L').value = '2'; $('suggest').click();
truth('cantilever span: designed at the root, no free-end shear', /cantilever/.test(res()) && !/Span 1 left/.test(res()) && !$('results').querySelector('.err'));
// add a span and a load, 6.10a/b, adjacent patterns
$('addSpan').click(); truth('add span: supports and bar rows follow', rows('spanRows').length === 4 && rows('supRows').length === 5);
$('addLoad').click(); const l = rows('loadRows'); const last = l[l.length - 1]; last.querySelector('.span').value = '3'; change(last.querySelector('.span')); last.querySelector('.type').value = 'part'; change(last.querySelector('.type'));
truth('partial UDL row enables a and length', !last.querySelector('.a').disabled && !last.querySelector('.b').disabled);
$('rule').value = '6.10ab'; $('pat').value = 'adj'; $('calc').click();
truth('6.10a/b with adjacent spans: 2 × 6 arrangements', /12 ULS arrangements/.test(res()));
// errors
rows('supRows')[2].querySelector('.delta').value = '0.5'; $('calc').click(); truth('δ outside 0.7–1.0 reported', /δ must be between 0.7 and 1.0/.test(res()));
rows('supRows')[2].querySelector('.delta').value = '0.85'; const s4 = rows('supRows')[4]; s4.querySelector('.kind').value = 'free'; change(s4.querySelector('.kind')); $('calc').click();
truth('both ends free reported as a mechanism', /mechanism/.test(res()));
s4.querySelector('.kind').value = 'knife'; change(s4.querySelector('.kind')); $('suggest').click();
$('printBtn').click(); truth('print: A4 sheet with elevation, envelopes, zones and summary', w.printed && $('report').querySelectorAll('svg').length === 3 && /Summary/.test($('report').textContent) && /Basis/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-rc-beam-v1')), d2 = w2.document;
truth('inputs restored', d2.querySelectorAll('#spanRows .row').length === 4 && d2.getElementById('rule').value === '6.10ab' && d2.querySelectorAll('#supRows .kind')[0].value === 'free' && d2.querySelectorAll('#loadRows .row').length === 8);
truth('no script errors', w.errs.length === 0 && w2.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
