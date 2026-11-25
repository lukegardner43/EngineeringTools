// Drives the two steel member pages in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js):
// "Steel Member Design.html" (design actions) and "Steel Beam Analysis and Design.html" (spans and loads).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const file = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const MEM = file('Steel Member Design.html'), BEAM = file('Steel Beam Analysis and Design.html');
let n = 0, fails = 0;
// the drawings each part of the calculation carries (as pictures for CalcPad; the page shows them above, not in the parts)
const capsIn = (w, re) => (w.eval('lastZ') || []).filter(z => re.test(z.title)).flatMap(z => z.C.items.filter(it => it.t === 'img').map(it => it.caption));
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
    truth('member page: the member drawing in the full calculation, a picture for CalcPad', capsIn(w, /^Section, steel and class/)[0] === 'Member, design actions and buckling lengths');
    { const z = [...$('results').querySelectorAll('details.zone')];
      truth('member page: the full calculation, part by part, with CalcPad buttons', z.length >= 5 && /^Section, steel and class/.test(z[0].querySelector('summary').textContent) && z.every(q => !!q.querySelector('[data-cp="save"]')) && $('results').querySelectorAll('[data-cp="all"]').length === 1);
      truth('member page: classification, the cross-section, buckling and the interaction written out', /c\/t/.test(z[0].textContent) && z.some(q => /Cross-section at x/.test(q.textContent) && /V_?pl,?Rd|Vpl,Rd/.test(q.textContent.replace(/\s/g, ''))) && z.some(q => /χ/.test(q.textContent) && /N_?b,?Rd|Nb,Rd/.test(q.textContent.replace(/\s/g, ''))) && z.some(q => /\(6\.62\)/.test(q.textContent))); }
    $('printBtn').click(); truth('member page: A4 sheet names the tool', w.printed && /Steel Member Design/.test($('report').textContent) && /Full calculation/.test($('report').textContent));
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
    // tees split from UKB: the series, the section, the class by the sign of the moment, the drawing, the full calculation
    const opts = [...$('series').options], txt = v => (opts.find(o => o.value === v) || {}).textContent;
    truth('member page: tees split from UB and UC offered by their Blue Book names', txt('T-UKB') === 'Tees (T) split from UB' && txt('T-UKC') === 'Tees (T) split from UC');
    set('series', 'T-UKB'); $('series').dispatchEvent(new w.Event('change')); set('section', '191×229×34 T'); $('section').dispatchEvent(new w.Event('change'));
    truth('member page: a tee by its Blue Book designation, its parent in the list and the summary, with its centroid', $('section').value === '191×229×34 T' && /from 457×191×67 UKB/.test($('section').selectedOptions[0].textContent)
      && /split from 457×191×67 UKB/.test($('secInfo').textContent) && /centroid 54\.\d mm below the top of the flange/.test($('secInfo').textContent));
    { const ws = page(MEM, { 'et-steel-member-v1': JSON.stringify({ ...JSON.parse(w.localStorage.getItem('et-steel-member-v1')), series: 'T-UKB', section: 'Tee from 610×305×149 UKB' }) });
      truth('member page: a tee saved under its old name opens as its Blue Book designation', ws.document.getElementById('section').value === '305×305×75 T'); }
    set('bLmode', 'k'); $('bLmode').dispatchEvent(new w.Event('change')); set('bN', '30'); set('bMyB', '15'); set('bMyT', '-12'); set('bMzB', '0'); set('bMzT', '0');
    await calc(w); const rt = $('results').textContent;
    truth('member page: a tee in double curvature: the class by sign, Annex A, no error', /Class 1 sagging, Class 4 hogging/.test($('results').querySelector('.verdict').textContent) && /Annex A/.test(rt) && !$('results').querySelector('.err'));
    truth('member page: the tee drawn with its shear centre', /SC/.test($('drawings').textContent) && !!$('drawings').querySelector('svg path'));
    { const Z = w.eval('lastZ'); truth('member page: the tee in the full calculation: z_j, the stem as an outstand, N_cr,TF about z-z', Z.some(z => z.C.items.some(it => it.name === 'z_j')) && Z.some(z => z.C.items.some(it => it.name === 'c_w' && /outstand/.test(it.desc || it.text || ''))) && Z.some(z => z.C.items.some(it => it.name === 'N_crTF' && /z-z/.test(it.desc || '')))); }
    $('printBtn').click(); truth('member page: the A4 sheet of a tee: the stem and its k_σ', /Stem \(an outstand\)/.test($('report').textContent) && /kσ/.test($('report').textContent.replace(/\s/g, '')));
    truth('member page: no script errors', w.errs.length === 0 && w3.errs.length === 0); }
  // beam analysis and design: spans and loads only
  { const w = page(BEAM), d = w.document, $ = id => d.getElementById(id);
    truth('beam page: title and heading', d.title === 'Steel Beam Analysis & Design' && /Steel Beam Analysis & Design/.test(d.querySelector('h1').textContent));
    truth('beam page: only spans, loads and combinations are shown', !$('modeA').classList.contains('hidden') && $('modeB').classList.contains('hidden') && d.querySelector('.seg').classList.contains('hidden'));
    truth('beam page: one span with G and Q loads by default', d.querySelectorAll('#spanRows .row').length === 1 && d.querySelectorAll('#loadRows .row').length === 2);
    await calc(w); const r = $('results').textContent;
    truth('beam page: results with combinations, LTB, bearing and deflection', /ULS combinations/.test(r) && /Lateral-torsional buckling/.test(r) && /Web bearing/.test(r) && /Deflection/.test(r) && !$('results').querySelector('.err'));
    truth('beam page: the drawings in the full calculation, pictures for CalcPad: the beam and the envelopes with the analysis, the section, the deflected shape', JSON.stringify(capsIn(w, /^Loads, combinations/)) === JSON.stringify(['Beam, loads and lateral restraints', 'ULS bending moment envelope (kNm, sagging plotted below)', 'ULS shear force envelope (kN)'])
      && capsIn(w, /^Section, steel and class/)[0] === 'Section' && capsIn(w, /^Deflection/)[0] === 'Deflected shape (SLS)');
    { const z = [...$('results').querySelectorAll('details.zone')], t = q => q.textContent.replace(/\s/g, '');
      truth('beam page: the full calculation, part by part, with CalcPad buttons', z.length >= 7 && /^Section, steel and class/.test(z[0].querySelector('summary').textContent) && z.every(q => !!q.querySelector('[data-cp="save"]')) && $('results').querySelectorAll('[data-cp="all"]').length === 1);
      truth('beam page: loads and combinations, the cross-section, LTB, web bearing and deflection written out', z.some(q => /Loads, combinations/.test(q.textContent) && /γ/.test(q.textContent)) && z.some(q => /Cross-section at x/.test(q.textContent)) && z.some(q => /Lateral-torsional/.test(q.textContent) && /M_?cr|Mcr/.test(t(q))) && z.some(q => /Web bearing/.test(q.textContent) && /(6\.14)|F_?Rd|FRd/.test(t(q))) && z.some(q => /Deflection/.test(q.textContent) && /NA\.2\.23/.test(q.textContent)));
    }
    $('printBtn').click(); truth('beam page: A4 sheet names the tool', w.printed && /Steel Beam Analysis & Design/.test($('report').textContent) && /Full calculation/.test($('report').textContent));
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
  // the Blue Book series added: bearing piles (UKBP) and the channels British Steel no longer lists (Corus 2005 tables)
  { const w = page(MEM), d = w.document, $ = id => d.getElementById(id), sel = (id, v) => { $(id).value = v; $(id).onchange(); };
    const opt = v => [...$('series').options].find(o => o.value === v);
    truth('series: UKBP offered after UKC', !!opt('UKBP') && opt('UKBP').previousElementSibling.value === 'UKC');
    sel('series', 'UKBP');
    truth('UKBP: the 17 bearing piles listed', $('section').options.length === 17 && [...$('section').options].every(o => / UKBP$/.test(o.value)) && /British Steel/.test($('secInfo').textContent));
    $('section').value = '356×368×109 UKBP'; $('section').onchange();
    const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); };
    set('bN', '2000'); set('bMyB', '0'); set('bMyT', '150'); set('bMzB', '0'); set('bMzT', '0');
    await calc(w); const r = $('results').textContent;
    truth('UKBP: a Class 4 flange in S355 designed with A_eff and W_eff, no error', !$('results').querySelector('.err') && /Class 4/.test(r) && w.eval('lastZ').some(z => z.C.items.some(it => it.name === 'A_eff')));
    $('printBtn').click(); truth('UKBP: the A4 sheet names the bearing piles datasheet', /universal bearing piles \(UBP\) datasheet/.test($('report').textContent));
    sel('series', 'PFC');
    truth('PFC: 16 channels, the Corus 2005 sizes among them, the default kept (230×75×26)', $('section').options.length === 16 && $('section').options[0].value === '100×50×10 PFC' && $('section').options[15].value === '430×100×64 PFC' && $('section').value === '230×75×26 PFC');
    $('section').value = '430×100×64 PFC'; $('section').onchange();
    truth('PFC 430×100×64: the summary names the Corus tables', /Corus section tables \(2005\)/.test($('secInfo').textContent));
    set('bN', '0'); set('bMyB', '60'); set('bMyT', '60'); await calc(w);
    truth('PFC 430×100×64: designed', !$('results').querySelector('.err') && /PASS|FAIL/.test($('results').textContent));
    $('printBtn').click(); truth('PFC 430×100×64: the A4 sheet cites the Corus tables', /Corus Construction &? ?Industrial|Corus Construction/.test($('report').textContent) && /British Steel no longer lists/.test($('report').textContent));
    truth('no script errors (UKBP, PFC)', w.errs.length === 0); }
  // angles, single and back to back, in axial force
  { const w = page(MEM), d = w.document, $ = id => d.getElementById(id), sel = (id, v) => { $(id).value = v; $(id).onchange ? $(id).onchange() : $(id).dispatchEvent(new w.Event('change', { bubbles: true })); };
    const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); $(id).dispatchEvent(new w.Event('change', { bubbles: true })); };
    const hid = id => $(id).classList.contains('hidden') || !!$(id).closest('.hidden');
    truth('angles: the four series offered', ['EA', 'UA', '2EA', '2UA'].every(v => [...$('series').options].some(o => o.value === v)));
    truth('angles: not on the Steel Beam page', !/<option value="EA">/.test(BEAM) && /<option value="EA">/.test(MEM));
    sel('series', 'EA');
    truth('EA: 20 equal angles, 100×100×10 picked', $('section').options.length === 20 && $('section').value === '100×100×10 EA' && /Corus section tables/.test($('secInfo').textContent));
    truth('EA: the moments, buckling lengths and interaction factors hidden, the angle inputs shown', hid('bIbox') && hid('annexBox') && !hid('angBox') && hid('aPairBox') && !hid('aMethodBox') && hid('aLegBox') && !hid('aK3Box'));
    set('bL', '3'); set('bN', '150');
    await calc(w); let r = $('results').textContent;
    truth('EA strut by BB.1.2: designed, Class 4 in S355, buckling about v-v governs', !$('results').querySelector('.err') && /PASS|FAIL/.test(r) && /Class 4/.test(r) && /v-v \(BB\.1\.2\)/.test(r));
    truth('EA: the section and the member drawn', /Section, axes and shear centre/.test(r) && /Member, axial force and end connection/.test(r) && $('results').querySelectorAll('svg').length >= 2);
    truth('EA: the calculation in two parts', w.eval('lastZ').map(z => z.key).join() === 'section,flexural');
    $('printBtn').click(); const rep = $('report').textContent;
    truth('EA: the A4 sheet: basis, summary and the full calculation', /BS EN 1993-1-8/.test(rep) && /Summary/.test(rep) && /Full calculation/.test(rep) && /Corus Construction/.test(rep));
    sel('aMethod', 'Lcr');
    truth('EA by buckling lengths: L_cr,u and L_cr,v only', hid('aK3Box') && /cr,u/.test($('aK1L').textContent));
    await calc(w); r = $('results').textContent;
    truth('EA by buckling lengths: torsional-flexural listed', /torsional-flexural/.test(r) && !$('results').querySelector('.err'));
    sel('aMethod', 'BB'); set('aN', '1'); await calc(w);
    truth('EA: one bolt in compression by BB.1.2 refused (6.2.9)', /6\.2\.9/.test(($('results').querySelector('.err') || {}).textContent || ''));
    set('bN', '-200'); await calc(w); r = $('results').textContent;
    truth('EA in tension, one bolt: (3.11), net section and block tearing', !$('results').querySelector('.err') && /Net section/.test(r) && /Block tearing/.test(r) && /1 bolt/.test(r));
    sel('aConn', 'welded'); truth('welded: the bolt inputs hidden', hid('aBoltBox'));
    await calc(w); truth('EA welded in tension: no block tearing', !/Block tearing/.test($('results').textContent) && /4\.13/.test($('results').textContent));
    sel('series', 'UA'); truth('UA: 21 unequal angles, the connected leg asked', $('section').options.length === 21 && !hid('aLegBox'));
    sel('aLeg', 'short'); await calc(w);
    truth('UA by its short leg: the equal angle of that leg', /short leg: taken as a 90×90×10 equal angle/.test($('results').textContent));
    sel('series', '2UA'); sel('aConn', 'bolts'); set('aN', '2');
    truth('2UA: the gap and packs asked, no method or leg', !hid('aPairBox') && hid('aMethodBox') && hid('aLegBox') && hid('aK3Box') && /cr,y/.test($('aK1L').textContent));
    set('bN', '300'); set('aPack', '0.25'); await calc(w); r = $('results').textContent;
    truth('2UA strut: torsional-flexural about z-z, curve c, the packs checked', !$('results').querySelector('.err') && /torsional-flexural/.test(r) && /curve c/.test(r) && /Interconnections of the pair/.test(r) && w.eval('lastZ').some(z => z.key === 'packs'));
    truth('2UA: the summary gives both radii of gyration', /i[yz]? ?\d/.test($('secInfo').textContent) && /s = 10 mm/.test($('secInfo').textContent));
    set('aGap', '15'); truth('2UA: the gap updates the summary', /s = 15 mm/.test($('secInfo').textContent));
    const st = w.eval('collect()'); truth('angles: the inputs saved', st.Ang && st.Ang.gap === 15 && st.Ang.conn === 'bolts' && st.series === '2UA');
    st.Ang.e2 = 45; w.eval('applyState')(st); truth('angles: the inputs restored', $('aE2').value === '45' && $('series').value === '2UA' && !hid('angBox'));
    sel('series', 'UKC'); truth('back to UKC: the member inputs return', !hid('bIbox') && hid('angBox') && !hid('annexBox'));
    truth('no script errors (angles)', w.errs.length === 0); }
  // elliptical hollow sections and asymmetric beams (ASB)
  { const w = page(MEM), d = w.document, $ = id => d.getElementById(id), sel = (id, v) => { $(id).value = v; $(id).onchange(); };
    const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); };
    const opt = v => [...$('series').options].find(o => o.value === v);
    truth('EHS: offered with the hot-finished hollow sections', !!opt('EHS-H') && opt('EHS-H').previousElementSibling.value === 'CHS-H');
    sel('series', 'EHS-H');
    truth('EHS: the eleven Celsius sizes', $('section').options.length === 11 && /Tata Steel|BS EN 10210-2/.test($('secInfo').textContent));
    $('section').value = '500×250×10'; $('section').onchange();
    set('bN', '800'); set('bMyB', '0'); set('bMyT', '150'); set('bMzB', '0'); set('bMzT', '0'); await calc(w);
    truth('EHS 500×250×10 in compression and bending: Class 4, the reduced strength A x, no error', !$('results').querySelector('.err') && /Class 4/.test($('results').textContent) && w.eval('lastZ').some(z => z.C.items.some(it => it.name === 'xe_s')));
    truth('EHS: the section drawn as an ellipse', /a[\d.]+ [\d.]+ 0 1 0/.test($('results').innerHTML));
    $('printBtn').click(); truth('EHS: the A4 sheet names the source', /BS EN 10210-2/.test($('report').textContent));
    truth('ASB: offered on the member page, after the tees; not on the beam page', !!opt('ASB') && opt('ASB').previousElementSibling.value === 'T-UKC' && !/<option value="ASB">/.test(BEAM));
    sel('series', 'ASB');
    truth('ASB: the ten British Steel sizes, 280 ASB 74 first', $('section').options.length === 10 && $('section').value === '280 ASB 74' && /British Steel/.test($('secInfo').textContent) && /z<sub>j<\/sub>|zj|z j/.test($('secInfo').innerHTML));
    set('bN', '0'); set('bMyB', '-120'); set('bMyT', '40'); await calc(w);
    const r = $('results').textContent;
    truth('ASB hogging and sagging: each sign its class, Annex A not needed, no error', !$('results').querySelector('.err') && /Class 2 hogging/.test(r) && /Class 1 sagging/.test(r));
    const Z = w.eval('lastZ');
    truth('ASB: the calculation works out z_j and the shear centre, and checks LTB with them', Z.some(z => z.C.items.some(it => it.name === 'z_j')) && Z.some(z => z.C.items.some(it => it.name === 'M_cr0')) && Z.some(z => z.key === 'ltb'));
    truth('ASB: the section drawn with two flanges', (h => (h.match(/ A[\d.]+ [\d.]+ 0 0 0 /g) || []).length >= 4)($('results').innerHTML));
    set('bN', '600'); await calc(w);
    truth('ASB with compression: Annex A, torsional-flexural buckling', !$('results').querySelector('.err') && w.eval('lastZ').some(z => z.key === 'interaction' && /Annex A/.test(z.title)) && w.eval('lastZ').some(z => z.C.items.some(it => it.name === 'N_crTF')));
    $('printBtn').click(); const rep = $('report').textContent;
    truth('ASB: the A4 sheet gives both flanges, the source and the scope', /ASB/.test(rep) && /asymmetric beams \(ASB\) datasheet/.test(rep) && /Slimflor composite and fire design are not covered/.test(rep) && /Top flange outstand/.test(rep) && /Bottom flange outstand/.test(rep));
    const st = w.localStorage.getItem('et-steel-member-v1'), w2 = page(MEM, { 'et-steel-member-v1': st });
    truth('ASB: restored', w2.document.getElementById('series').value === 'ASB' && w2.document.getElementById('section').value === '280 ASB 74');
    truth('no script errors (EHS, ASB)', w.errs.length === 0 && w2.errs.length === 0); }
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
