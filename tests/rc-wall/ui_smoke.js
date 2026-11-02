// Drives "RC Wall Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Wall Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store, hash = '') {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/' + hash, beforeParse(w) { w.print = () => { w.printed = true; }; w.scrollTo = () => {}; if (store) w.localStorage.setItem('et-rc-wall-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, shown = el => !el.classList.contains('hidden');
const change = el => el.dispatchEvent(new w.Event('change', { bubbles: true }));
truth('page loads without script errors', w.errs.length === 0);
truth('wall panel first: reinforced inputs shown, plain hidden', shown($('pane-panel')) && !shown($('pane-core')) && shown(d.querySelector('#pane-panel .card.rc')) && !shown(d.querySelector('#pane-panel .plain')));
$('calc').click();
truth('panel: verdict, strip, N–M diagram, checks, values', /PASS|FAIL/.test(res()) && !!$('results').querySelector('svg.strip') && !!$('results').querySelector('svg.mn') && /9\.6\.2/.test(res()) && /λlim/.test(res()) && !$('results').querySelector('.err'));
$('wl').value = '6000'; $('wN').value = '600'; $('calc').click();
truth('panel: a slender wall shows Kr, Kφ and M2', /\(slender\)/.test(res()) && /Kr/.test(res()) && /M₂/.test(res()));
$('wbr').value = 'unbraced'; $('calc').click(); truth('panel: unbraced', /unbraced wall/.test(res()) && /M02 \+ M2|e0 NEd/.test(res()));
$('wbr').value = 'braced';
$('wend').value = 'pinned'; change($('wend')); truth('pinned ends hide k₁ and k₂', !shown(d.querySelector('.kfr')));
$('calc').click(); truth('pinned: l₀ = l', /l₀ = 6000 mm/.test(res()));
$('wend').value = 'framed'; change($('wend'));
$('wtype').value = 'plain'; change($('wtype'));
truth('plain: reinforcement and creep hidden, Table 12.1 shown', !shown(d.querySelector('#pane-panel .card.rc')) && shown(d.querySelector('#pane-panel .plain')) && !shown(d.querySelector('.sideb')));
$('wsides').value = '4'; change($('wsides')); truth('four sides held shows b', shown(d.querySelector('.sideb')));
$('wl').value = '3500'; $('wN').value = '400'; $('calc').click();
truth('plain: 12.6.5 resistance and λ ≤ 86', /12\.6\.5\.2/.test(res()) && /86/.test(res()) && /Φ/.test(res()) && !$('results').querySelector('svg.mn'));
$('wtype').value = 'rc'; change($('wtype')); $('wsides').value = '2'; change($('wsides'));
$('wh').value = '90'; $('calc').click(); truth('bad input reported', !!$('results').querySelector('.err') && /100 mm/.test(res())); $('wh').value = '200';
// core walls
d.querySelector('#modes button[data-m=core]').click();
truth('core walls pane', shown($('pane-core')) && !shown($('pane-panel')) && d.querySelectorAll('#coreRows .row').length === 2 && d.querySelectorAll('#opRows .row').length === 2 && d.querySelectorAll('#loadRows .row').length === 5);
$('calc').click();
truth('core: verdict, building plan, core plan, shares, stresses and bars', /PASS|FAIL/.test(res()) && d.querySelectorAll('#results svg.plan').length === 2 && /NS share/.test(res()) && /Bars each face/.test(res()) && /H\d+ @ \d+/.test(res()) && !$('results').querySelector('.err'));
truth('core: one row per location with a panel link', d.querySelectorAll('#results button.lnk').length === 7);
$('csel').value = '1'; change($('csel'));
truth('choosing core 2 edits its openings, loads and locations', $('opCore').textContent === 'core 2' && d.querySelectorAll('#opRows .row').length === 1 && d.querySelectorAll('#loadRows .row').length === 0);
$('addLoc').click(); $('calc').click(); truth('core 2 designs with one location', /Core 2:/.test(res()) && d.querySelectorAll('#results button.lnk').length === 1);
$('csel').value = '0'; change($('csel')); truth('back to core 1 keeps its rows', d.querySelectorAll('#loadRows .row').length === 5 && d.querySelectorAll('#locRows .row').length === 7);
$('addCore').click(); truth('add a core', d.querySelectorAll('#coreRows .row').length === 3 && $('csel').value === '2');
d.querySelectorAll('#coreRows .row')[2].querySelector('.xbtn').click(); truth('remove a core', d.querySelectorAll('#coreRows .row').length === 2);
$('csel').value = '0'; change($('csel'));
$('cdir').value = 'tog'; $('cea').value = '10'; $('calc').click(); truth('both directions at once and extra eccentricity', /together/.test(res()) && !$('results').querySelector('.err'));
$('addOp').click(); const ops = d.querySelectorAll('#opRows .row'); ops[ops.length - 1].querySelector('.x').value = '2800'; ops[ops.length - 1].querySelector('.w').value = '600'; $('calc').click();
truth('an opening outside the core is reported', /not inside the core outline/.test(res())); ops[ops.length - 1].querySelector('.xbtn').click(); $('calc').click();
const st = (() => { const s = $('results').querySelectorAll('button.lnk')[0]; return +/(\d+) kN\/m/.exec(s.textContent)[1]; })();
$('results').querySelectorAll('button.lnk')[0].click();
truth('location to panel: mode, thickness and NEd handed over', shown($('pane-panel')) && $('wh').value === '250' && Math.abs(+$('wN').value - st) <= 1 && /From core 1, location 1/.test(res()) && /PASS|FAIL/.test(res()));
$('printBtn').click(); truth('print: panel sheet', w.printed && /Slenderness \(5\.8\)/.test($('report').textContent) && $('report').querySelectorAll('svg').length === 2);
d.querySelector('#modes button[data-m=core]').click(); $('calc').click(); w.printed = false; $('printBtn').click();
truth('print: core sheet', w.printed && /Building and wind/.test($('report').textContent) && /Stresses and vertical steel/.test($('report').textContent) && $('report').querySelectorAll('svg').length === 2);
const w2 = page(w.localStorage.getItem('et-rc-wall-v1')), $2 = id => w2.document.getElementById(id);
truth('inputs restored, mode and cores included', $2('cdir').value === 'tog' && !w2.document.getElementById('pane-core').classList.contains('hidden') && w2.document.querySelectorAll('#coreRows .row').length === 2 && $2('wh').value === '250');
// wind moments handed over from Wind Loading (#in=), with and without a saved session
const hand = { v: 1, mode: 'core', cL: 36, cW: 15, cMns: 4321, cMew: 1234, from: 'From Wind Loading: test.' };
const w3 = page(null, '#in=' + encodeURIComponent(JSON.stringify(hand))), $3 = id => w3.document.getElementById(id);
truth('hand-off from Wind Loading: core mode, moments and plan size, run with the note', !w3.document.getElementById('pane-core').classList.contains('hidden') && $3('cMns').value === '4321' && $3('cMew').value === '1234' && $3('cL').value === '36'
  && /From Wind Loading: test\./.test($3('results').textContent) && /PASS|FAIL/.test($3('results').textContent) && w3.document.querySelectorAll('#coreRows .row').length === 2);
const w4 = page(w.localStorage.getItem('et-rc-wall-v1'), '#in=' + encodeURIComponent(JSON.stringify(hand))), $4 = id => w4.document.getElementById(id);
truth('hand-off keeps the saved cores and other inputs', $4('cMns').value === '4321' && $4('cdir').value === 'tog' && $4('wh').value === '250');
truth('no script errors', w.errs.length === 0 && w2.errs.length === 0 && w3.errs.length === 0 && w4.errs.length === 0);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
