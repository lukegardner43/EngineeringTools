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
    // buckling lengths in metres
    const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); };
    set('bL', '6'); set('bky', '0.85'); set('bkz', '0.7'); set('bnLT', '2');
    truth('member page: factors of L by default, lengths hidden', $('bLmode').value === 'k' && $('bLbox').classList.contains('hidden') && !$('bKbox').classList.contains('hidden') && /factors of L/.test($('bLhelp').textContent));
    d.querySelector('#bLmodeSeg button[data-v="L"]').click();
    truth('member page: lengths in metres, filled from the factors', $('bLmode').value === 'L' && !$('bLbox').classList.contains('hidden') && $('bKbox').classList.contains('hidden') && $('bLy').value === '5.1' && $('bLz').value === '4.2' && $('bLLT').value === '3' && /BS 5950/.test($('bLhelp').textContent));
    set('bLy', '7.2'); set('bLz', '3.1'); set('bLLT', '2.5'); await calc(w); const rl = $('results').textContent;
    truth('member page: the given lengths in the buckling table', /y-y7\.20/.test(rl.replace(/\s/g, '')) && /z-z3\.10/.test(rl.replace(/\s/g, '')) && !$('results').querySelector('.err'));
    truth('member page: L_LT checked along the member', /over LLT = 2\.50 m, the worst of \d+ positions/.test(rl.replace(/\s+/g, ' ')) && /x = \d\.\d\d–\d\.\d\d m/.test(rl));
    await wait(200); const dt = $('drawings').textContent.replace(/[_{}]/g, '');
    truth('member page: the drawing shows the given lengths and where L_LT governs', /Lcr,y = 7\.20 m/.test(dt) && /Lcr,z = 3\.10 m/.test(dt) && /LLT = 2\.50 m/.test(dt) && /LLT at x = \d\.\d\d–\d\.\d\d m/.test(dt));
    $('printBtn').click(); truth('member page: the A4 sheet lists the given lengths', /Buckling lengths given/.test($('report').textContent) && /7\.20, 3\.10, 2\.50 m/.test($('report').textContent) && /positions along the member/.test($('report').textContent));
    set('bLz', '0'); await calc(w); truth('member page: a zero length refused', /give a buckling length greater than zero/.test($('results').querySelector('.err').textContent)); set('bLz', '3.1');
    const w3 = page(MEM, { 'et-steel-member-v1': w.localStorage.getItem('et-steel-member-v1') }), $3 = id => w3.document.getElementById(id);
    truth('member page: the lengths restored', $3('bLmode').value === 'L' && !$3('bLbox').classList.contains('hidden') && $3('bLy').value === '7.2' && $3('bLLT').value === '2.5');
    truth('member page: no script errors', w.errs.length === 0 && w3.errs.length === 0); }
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
  // historic sections and the steel's strength
  { const w = page(MEM), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, sel = (id, v) => { $(id).value = v; $(id).onchange(); };
    const og = [...$('series').querySelectorAll('optgroup')].find(o => /Historic/.test(o.label));
    truth('historic: thirteen series of the BCSA handbook offered after today’s', og && og.querySelectorAll('option').length === 13);
    truth('historic: grades S235 to S460, BS 15, BS 548, BS 968 and a given f_y; the f_y box hidden', ['S235', 'S275', 'S355', 'S460', 'BS15', 'BS548', 'BS968A', 'BS968', 'GIVEN'].every(v => [...$('grade').options].some(o => o.value === v)) && $('fyBox').classList.contains('hidden'));
    sel('series', 'H-BSB1903');
    truth('a 1903 series with S355: the grade turns to a given f_y, its box shown, the note explains', $('grade').value === 'GIVEN' && !$('fyBox').classList.contains('hidden') && /wrought iron/.test($('gradeHelp').textContent) && $('section').options.length === 30);
    $('section').value = 'BSB 26 15×6 in × 59 lb (BS 4:1903)'; $('section').onchange();
    truth('the section line names the handbook table and the derived properties', /BS 4:1903 \(handbook Table 3\.7\)/.test($('secInfo').textContent) && /derived/.test($('secInfo').textContent));
    await calc(w); truth('no f_y given: asked for', /Give the steel’s yield strength/.test(res()));
    $('fyG').value = '230'; await calc(w);
    truth('f_y 230 given: checked, the verdict says so, the historic note shown', !$('results').querySelector('.err') && /f_y given|fy given/.test($('results').querySelector('.verdict').textContent.replace(/\s+/g, ' ').replace('fy', 'f_y')) && /230 N\/mm²/.test(res()) && /BS 449/.test(res()));
    $('printBtn').click(); truth('the A4 sheet gives the source of the properties and the given f_y', /Historical Structural Steelwork Handbook/.test($('report').textContent) && /given by the engineer/.test($('report').textContent));
    sel('series', 'H-UB1962'); truth('a 1962 series keeps the chosen given f_y', $('grade').value === 'GIVEN');
    sel('grade', 'S355'); sel('series', 'H-UC1962'); truth('… and from S355 turns to BS 15 (1948–68)', $('grade').value === 'BS15' && $('fyBox').classList.contains('hidden') && /BS 15:1948/.test($('gradeHelp').textContent));
    await calc(w); truth('BS 15 on a 1962 UC: checked', !$('results').querySelector('.err') && /BS 15/.test($('results').querySelector('.verdict').textContent));
    sel('series', 'H-BSC1932'); await calc(w); truth('a 1932 channel: checked', !$('results').querySelector('.err') && /BSC/.test($('results').querySelector('.verdict').textContent));
    sel('grade', 'S275'); sel('series', 'H-UB1972'); truth('a 1972 series keeps S275 (BS 4360 grade 43)', $('grade').value === 'S275' && /BS 4360/.test($('gradeHelp').textContent));
    const st = w.localStorage.getItem('et-steel-member-v1'), w2 = page(MEM, { 'et-steel-member-v1': st });
    truth('restored: the historic series, section and grade', w2.document.getElementById('series').value === 'H-BSC1932' && /BSC/.test(w2.document.getElementById('section').value) && w2.document.getElementById('grade').value === 'BS15');
    truth('no script errors (historic)', w.errs.length === 0 && w2.errs.length === 0); }
  console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
})();
