// Drives the two steel member pages in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js):
// "Steel Member Design.html" (design actions) and "Steel Beam Analysis and Design.html" (spans and loads).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const file = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const MEM = file('Steel Member Design.html'), BEAM = file('Steel Beam Analysis and Design.html');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(html, store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; for (const [k, v] of Object.entries(store || {})) w.localStorage.setItem(k, v); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function calc(w) { w.document.getElementById('calc').click(); for (let i = 0; i < 200 && w.document.getElementById('results').classList.contains('busy'); i++) await wait(25); }
const block = (h, id) => h.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
(async () => {
  truth('both pages carry the same engine and section table', block(MEM, 'engine') === block(BEAM, 'engine') && block(MEM, 'sections') === block(BEAM, 'sections'));
  // member design: design actions only
  { const w = page(MEM), d = w.document, $ = id => d.getElementById(id);
    truth('member page: title and heading', d.title === 'Steel Member Design' && /Steel Member Design/.test(d.querySelector('h1').textContent));
    truth('member page: only the design-action inputs are shown', $('modeA').classList.contains('hidden') && !$('modeB').classList.contains('hidden') && d.querySelector('.seg').classList.contains('hidden'));
    truth('member page: column default', $('section').value === '254×254×89 UKC');
    await calc(w); const r = $('results').textContent;
    truth('member page: verdict with flexural buckling and interaction', /Flexural|flexural/.test(r) && /6\.6[12]|interaction/i.test(r) && !$('results').querySelector('.err'));
    $('printBtn').click(); truth('member page: A4 sheet names the tool', w.printed && /Steel Member Design/.test($('report').textContent));
    truth('member page: inputs saved under its own key', !!w.localStorage.getItem('et-steel-member-v1') && !w.localStorage.getItem('et-steel-beam-v1'));
    truth('member page: no script errors', w.errs.length === 0); }
  // beam analysis and design: spans and loads only
  { const w = page(BEAM), d = w.document, $ = id => d.getElementById(id);
    truth('beam page: title and heading', d.title === 'Steel Beam Analysis & Design' && /Steel Beam Analysis & Design/.test(d.querySelector('h1').textContent));
    truth('beam page: only spans, loads and combinations are shown', !$('modeA').classList.contains('hidden') && $('modeB').classList.contains('hidden') && d.querySelector('.seg').classList.contains('hidden'));
    truth('beam page: one span with G and Q loads by default', d.querySelectorAll('#spanRows .row').length === 1 && d.querySelectorAll('#loadRows .row').length === 2);
    await calc(w); const r = $('results').textContent;
    truth('beam page: results with combinations, LTB, bearing and deflection', /ULS combinations/.test(r) && /Lateral-torsional buckling/.test(r) && /Web bearing/.test(r) && /Deflection/.test(r) && !$('results').querySelector('.err'));
    $('printBtn').click(); truth('beam page: A4 sheet names the tool', w.printed && /Steel Beam Analysis & Design/.test($('report').textContent));
    truth('beam page: inputs saved under its own key', !!w.localStorage.getItem('et-steel-beam-v1'));
    truth('beam page: no script errors', w.errs.length === 0); }
  // a beam set up in the combined page before the split opens in the beam page; a member set-up stays in the member page
  { const old = page(MEM); await wait(10);
    const st = JSON.parse(old.localStorage.getItem('et-steel-member-v1') || 'null') || {};
    const w0 = page(BEAM); await calc(w0); const beamState = JSON.parse(w0.localStorage.getItem('et-steel-beam-v1')); beamState.mode = 'A'; beamState.spans = [7.5]; delete beamState.mems; beamState.cantL = 0; beamState.cantR = 0;
    const w = page(BEAM, { 'et-steel-member-v1': JSON.stringify(beamState) }), d = w.document;
    truth('beam page: picks up a pre-split beam set-up', d.querySelector('#spanRows .row .L').value === '7.5');
    const w2 = page(MEM, { 'et-steel-member-v1': JSON.stringify(beamState) });
    truth('member page: a stored beam set-up still opens in member mode', !w2.document.getElementById('modeB').classList.contains('hidden') && w2.errs.length === 0);
    truth('state object readable', typeof st === 'object'); }
  // supports: a free end makes a cantilever; a single member with a free end is fixed at the other end; mechanisms are refused
  { const w = page(BEAM), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, sel = (id, v) => { $(id).value = v; $(id).onchange(); };
    truth('beam page: no cantilever length boxes; end supports offer a free end', !$('cantL') && !$('cantR') && [...$('endL').options].some(o => o.value === 'free'));
    sel('endR', 'free');
    truth('one member, right end free: left end becomes fixed and the member is a cantilever', $('endL').value === 'fixed' && /Right cantilever/.test(d.querySelector('#spanRows .mname').textContent) && $('mechWarn').classList.contains('hidden'));
    await calc(w); truth('cantilever calculates (fixed root, free tip)', !$('results').querySelector('.err') && /PASS|FAIL/.test(res()));
    sel('endL', 'pinned'); truth('pinned + free single member: mechanism warning', !$('mechWarn').classList.contains('hidden') && /Mechanism/.test($('mechWarn').textContent));
    await calc(w); truth('mechanism is refused with a message', !!$('results').querySelector('.err') && /Mechanism/.test(res()));
    $('addSpan').click(); truth('two members with the right end free: overhang over the internal support, no warning', $('mechWarn').classList.contains('hidden') && [...d.querySelectorAll('#spanRows .mname')].map(e => e.textContent).join('|') === 'Span 1 (m)|Right cantilever (m)' && $('endL').value === 'pinned');
    await calc(w); truth('overhanging beam calculates', !$('results').querySelector('.err'));
    truth('loads can be placed on the cantilever', [...d.querySelector('#loadRows .mem').options].map(o => o.textContent).includes('Right cantilever'));
    sel('endL', 'free'); truth('both ends free over one internal support: mechanism', /Mechanism/.test($('mechWarn').textContent));
    const old = { ...JSON.parse(w.localStorage.getItem('et-steel-beam-v1')) }; delete old.mems; old.cantL = 1.5; old.cantR = 0; old.spans = [6]; old.endL = 'pinned'; old.endR = 'pinned';
    const w2 = page(BEAM, { 'et-steel-beam-v1': JSON.stringify(old) }), d2 = w2.document;
    truth('a state saved with a cantilever length opens as a free end', d2.getElementById('endL').value === 'free' && [...d2.querySelectorAll('#spanRows .L')].map(e => e.value).join(',') === '1.5,6');
    truth('no script errors (supports)', w.errs.length === 0 && w2.errs.length === 0); }
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
})();
