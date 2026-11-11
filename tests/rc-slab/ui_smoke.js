// Drives "RC Slab Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Slab Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; if (store) w.localStorage.setItem('et-rc-slab-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, rows = id => d.querySelectorAll(`#${id} .row`);
const change = el => el.dispatchEvent(new w.Event('change', { bubbles: true }));
truth('page loads without script errors', w.errs.length === 0);
truth('drawings on load, before Calculate: elevation, BM, SF and the per-metre sections', !!$('drawings').querySelector('svg.elev') && $('drawings').querySelectorAll('svg.env').length === 2 && /Sections, per metre width/.test($('drawings').textContent) && /G 1\.5/.test($('drawings').querySelector('svg.elev').textContent) && !/PASS|FAIL/.test(res()));
truth('default one-way slab: 3 spans, 4 supports, 6 loads, 7 bar rows', rows('spanRows').length === 3 && rows('supRows').length === 4 && rows('loadRows').length === 6 && rows('barRows').length === 7);
$('calc').click();
truth('one-way sections: four supports and three spans, bars and utilisations', (() => { const t = $('drawings').querySelector('svg.dk').textContent; return (t.match(/Support \d/g) || []).length === 4 && (t.match(/Span \d/g) || []).length === 3 && /H12 @ 175 top, 646 mm²\/m/.test(t) && /utilisation 1\.021/.test(t); })());
truth('one-way: verdict, elevation, envelopes, tables, zones', /PASS|FAIL/.test(res()) && !!$('results').querySelector('svg.elev') && $('results').querySelectorAll('svg.env').length === 2 && /Distribution/.test(res()) && /9\.3\.1\.2\(2\)/.test(res()) && !$('results').querySelector('.err'));
$('suggest').click(); truth('one-way suggestion passes', /PASS/.test(res()) && !$('results').querySelector('.err'));
$('addSpan').click(); truth('add span: supports and bars follow', rows('spanRows').length === 4 && rows('supRows').length === 5 && rows('barRows').length === 9);
const s0 = rows('supRows')[0]; s0.querySelector('.kind').value = 'free'; change(s0.querySelector('.kind'));
truth('free end removes its bar row', rows('barRows').length === 8);
rows('spanRows')[0].querySelector('.L').value = '1.5'; $('addLoad').click(); const ld = rows('loadRows'), last = ld[ld.length - 1]; last.querySelector('.type').value = 'line'; change(last.querySelector('.type'));
truth('line load: P per metre, position enabled', /P \(kN\/m\)/.test(last.querySelector('.vl').textContent) && !last.querySelector('.a').disabled);
$('suggest').click(); truth('cantilever slab with a line load calculates', /cantilever/.test(res()) && !$('results').querySelector('.err'));
rows('supRows')[2].querySelector('.delta').value = '0.5'; $('calc').click(); truth('δ outside 0.7–1.0 reported', /δ must be between/.test(res()));
rows('supRows')[2].querySelector('.delta').value = '0.85'; $('calc').click();
$('printBtn').click(); truth('one-way print: elevation, envelopes, sections, summary', w.printed && $('report').querySelectorAll('svg').length === 4 && /Sections, per metre width/.test($('report').textContent) && /Summary/.test($('report').textContent));
// two-way
d.querySelector('#modes button[data-m="two"]').click();
truth('two-way pane shown, one-way options hidden', !$('pane-two').classList.contains('hidden') && $('pane-one').classList.contains('hidden') && d.querySelector('.one').classList.contains('hidden'));
truth('two-way bar rows: spans + 2 continuous edges', rows('tbarRows').length === 4);
$('calc').click(); truth('two-way: case 4, plan drawing, coefficients and edge shears', /Two adjacent edges discontinuous/.test(res()) && !!$('results').querySelector('svg.plan') && /Short-span bars \(B1, outer\)/.test($('drawings').textContent) && /Short edge 1 \(T2, inner\)/.test($('drawings').textContent) && /Long edge 1 \(continuous\)/.test(res()) && /Corner torsion/.test(res()));
$('eL2').checked = true; change($('eL2')); truth('making long edge 2 continuous adds its bar row', rows('tbarRows').length === 5);
$('tsuggest').click(); truth('two-way suggestion passes', /PASS/.test(res()) && /One short edge discontinuous/.test(res()));
$('ly').value = '4'; $('calc').click(); truth('l_x longer than l_y rejected', /shorter span/.test(res()));
$('ly').value = '7.5'; $('calc').click(); $('printBtn').click(); truth('two-way print: plan, sections and edge shears', $('report').querySelectorAll('svg').length === 2 && /Sections, per metre width/.test($('report').textContent) && /Shear at the edges/.test($('report').textContent));
const w2 = page(w.localStorage.getItem('et-rc-slab-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored, two-way mode', !$2('pane-two').classList.contains('hidden') && $2('eL2').checked && $2('ly').value === '7.5' && w2.document.querySelectorAll('#spanRows .row').length === 4);
// the drawings follow the inputs, both modes
const w3 = page(), $3 = id => w3.document.getElementById(id), ev = (el, t) => el.dispatchEvent(new w3.Event(t, { bubbles: true }));
const L0 = w3.document.querySelector('#spanRows .row .L'); L0.value = '4.5'; ev(L0, 'input');
setTimeout(() => {
  truth('live: the elevation follows an edited span', /4\.5 m, h 200/.test($3('drawings').querySelector('svg.elev').textContent));
  w3.document.querySelector('#modes button[data-m="two"]').click();
  setTimeout(() => {
    truth('live: two-way panel drawn on switching modes', !!$3('drawings').querySelector('svg.plan') && /Long-span bars \(B2, inner\)/.test($3('drawings').textContent) && !/PASS|FAIL/.test($3('results').textContent));
    $3('th').value = '0'; ev($3('th'), 'input');
    setTimeout(() => {
      truth('live: incomplete inputs give a note, not an error', /drawings will appear when the inputs are complete/.test($3('drawings').textContent));
      truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0);
      console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
    }, 350);
  }, 350);
}, 350);
