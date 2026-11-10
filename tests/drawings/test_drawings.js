// Drawings on Composite Beam, Floor Vibration, Steel Member, Concrete Tie Force and RC Crack Width (group 1) and on Steel Beam
// Torsion, Beam Web Openings, Steel Frame Design, Sheet Pile Wall, the RC Section Toolkit tabs, RC Column, Hollowcore Support
// Beam, Steel Masonry Support and Steel Member Fire Design (group 2): present on load, redrawn as the inputs change, and free of NaN / undefined / Infinity across the input variations each tool offers.
//   NODE_PATH=<jsdom>/node_modules node tests/drawings/test_drawings.js
const fs = require('fs'), path = require('path'), { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.resolve(__dirname, '../..');
let pass = 0, fail = 0; const truth = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const load = async f => {
  const vc = new VirtualConsole(), errs = []; vc.on('jsdomError', e => { if (!/Could not load|fetch|Not implemented/i.test(e.message)) errs.push(e.message); });
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, f), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/' + encodeURIComponent(f), virtualConsole: vc });
  await wait(400); return { w: dom.window, errs };
};
const bad = s => /NaN|undefined|Infinity/.test(s);
const set = (w, id, v, ev = 'input') => { const e = w.document.getElementById(id); e.value = v; e.dispatchEvent(new w.Event(ev, { bubbles: true })); };
async function sweep(f, cases, expect) {
  const { w, errs } = await load(f), d = () => w.document.getElementById('drawings').innerHTML;
  const n0 = (d().match(/<svg class="jd dk"/g) || []).length;
  truth(`${f}: drawings on load (${n0})`, n0 >= expect && !bad(d()));
  for (const [name, fn] of cases) {
    const before = d(); fn(w); await wait(260);
    const html = d();
    truth(`${f}: ${name}`, html !== before && /<svg class="jd dk"/.test(html) && !bad(html));
  }
  truth(`${f}: no script errors`, errs.length === 0 || (console.log(errs), false));
  w.close();
}
(async () => {
  await sweep('Composite Beam Design.html', [
    ['span 12 m', w => set(w, 'L', '12')], ['ribs parallel to the beam', w => set(w, 'deck', 'para', 'change')], ['solid slab', w => set(w, 'deck', 'none', 'change')],
    ['edge beam (no slab on the left)', w => set(w, 'bL', '0')], ['one stud per trough, propped', w => { set(w, 'nr', '1', 'change'); const p = w.document.getElementById('propped'); p.checked = true; p.dispatchEvent(new w.Event('change', { bubbles: true })); }],
  ], 2);
  {   // the section's labels carry the engine's values
    const { w } = await load('Composite Beam Design.html'); const h = w.document.getElementById('drawings').innerHTML;
    truth('Composite Beam Design: section shows b_eff, N_c and the PNA', /b<tspan[^>]*>eff<\/tspan> = 2350 mm/.test(h) && /N<tspan[^>]*>c<\/tspan> 1715 kN/.test(h) && />PNA</.test(h)); w.close();
  }
  await sweep('Floor Vibration.html', [
    ['one bay each way', w => { set(w, 'nx', '1', 'change'); set(w, 'ny', '1', 'change'); }], ['walking path', w => set(w, 'Lp', '12')], ['primary steel alone', w => { const p = w.document.getElementById('primComp'); p.checked = false; p.dispatchEvent(new w.Event('change', { bubbles: true })); }],
    ['secondary spacing 2.5 m', w => set(w, 'b', '2.5')],
  ], 2);
  await sweep('Steel Member Design.html', [
    ['three LT segments, double curvature', w => { set(w, 'bnLT', '3'); set(w, 'bMyB', '-30'); }], ['tension', w => set(w, 'bN', '-400')], ['k_z = 2', w => set(w, 'bkz', '2')],
    ['CHS', w => set(w, 'series', 'CHS-H', 'change')], ['RHS', w => set(w, 'series', 'RHS-C', 'change')], ['PFC', w => set(w, 'series', 'PFC', 'change')],
  ], 1);
  await sweep('Concrete Tie Force.html', [
    ['class 2B: vertical ties drawn', w => { set(w, 'nStoreys', '8'); w.updateClass(); }], ['bays wider than 1.5 l_r get extra ties', w => { set(w, 'floorL', '40'); set(w, 'csX', '40'); }],
    ['class 1: no ties', w => { set(w, 'nStoreys', '3'); w.updateClass(); }],
  ], 1);
  {
    const { w } = await load('Concrete Tie Force.html'); set(w, 'nStoreys', '8'); w.updateClass(); await wait(260);
    truth('Concrete Tie Force: class 2B adds the vertical-tie section', (w.document.getElementById('drawings').innerHTML.match(/<svg class="jd dk"/g) || []).length === 2); w.close();
  }
  await sweep('RC Crack Width.html', [
    ['base only', w => { set(w, 'restraint_config', 'base_only', 'change'); }], ['base and one end', w => set(w, 'restraint_config', 'base_one_end', 'change')],
    ['ends only', w => set(w, 'restraint_config', 'ends_only', 'change')], ['thick wall, long', w => { set(w, 'h', '600'); set(w, 'L', '20'); }],
  ], 2);
  {   // the steel beam page shares the template: its own beam drawings, not the member page's
    const { w, errs } = await load('Steel Beam Analysis and Design.html');
    const h = w.document.getElementById('drawings').innerHTML;
    truth('Steel Beam Analysis & Design: beam drawing on load, no member drawing code', w.eval('typeof DrawMember') === 'undefined' && w.eval('typeof DrawSteelBeam') === 'object' && /G 10 kN\/m/.test(h) && /Q 15 kN\/m/.test(h) && errs.length === 0);
    w.document.getElementById('calc').click(); await wait(400);
    const h2 = w.document.getElementById('drawings').innerHTML;
    truth('Steel Beam Analysis & Design: Calculate adds the LTB utilisation, governing location and deflected shape', /LTB 0\.690/.test(h2) && /Deflected shape/.test(h2) && /L\/360 = 16\.7/.test(h2) && !bad(h2)); w.close();
  }
  await sweep('Steel Beam Analysis and Design.html', [
    ['span 8 m', w => { const e = w.document.querySelector('#spanRows .L'); e.value = '8'; e.dispatchEvent(new w.Event('input', { bubbles: true })); }],
    ['restraint at mid-span', w => { const r = w.document.querySelector('#restrRows .row'); r.querySelector('.rm').value = 'points'; r.querySelector('.rm').onchange(); r.querySelector('.rp').value = '4'; r.querySelector('.rp').dispatchEvent(new w.Event('input', { bubbles: true })); }],
    ['a second span and a point load', w => { w.spanRow(5); w.refreshMembers(); w.loadRow({ case: 'Q', member: 1, type: 'point', P: 30, a: 2 }); w.refreshMembers(); w.document.getElementById('sw').dispatchEvent(new w.Event('change', { bubbles: true })); }],
    ['destabilising loads', w => { const c = w.document.getElementById('destab'); c.checked = true; c.dispatchEvent(new w.Event('change', { bubbles: true })); }],
  ], 2);
  {   // RC beam: the design sections after a Calculate
    const { w, errs } = await load('RC Beam Analysis and Design.html'); w.document.getElementById('calc').click(); await wait(300);
    const all = w.document.getElementById('results').innerHTML, i = all.indexOf('Sections at the supports and mid-spans'), h = all.slice(i, all.indexOf('</svg>', i));
    truth('RC Beam Analysis & Design: sections at the four supports and three spans', (h.match(/>Support \d/g) || []).length === 4 && (h.match(/>Span \d</g) || []).length >= 3 && /4H25 top, 3H12 comp\./.test(h) && /l\/d 18\.9/.test(h) && !bad(h) && errs.length === 0); w.close();
  }
  // ---------- group 2 ----------
  const click = (w, sel) => w.document.querySelector(sel).click();
  await sweep('Steel Beam Torsion.html', [
    ['span 8 m', w => set(w, 'L', '8')], ['warping restrained left end', w => set(w, 'endL', 'fixed', 'change')],
    ['lateral restraint at 2 m', w => set(w, 'restr', '2')], ['PFC', w => set(w, 'series', 'PFC', 'change')], ['cantilever (root built in)', w => { set(w, 'endL', 'fork', 'change'); set(w, 'sys', 'cant', 'change'); }],
  ], 1);
  await sweep('Beam Web Openings.html', [
    ['span 10 m', w => set(w, 'L', '10')], ['composite', w => click(w, '#modeSeg button[data-m="comp"]')], ['imposed 7.5 kN/m²', w => set(w, 'q', '7.5')],
  ], 1);
  await sweep('Steel Frame Design.html', [
    ['span 24 m', w => set(w, 'span', '24')], ['rise 2 m', w => set(w, 'rise', '2')], ['pinned bases', w => set(w, 'base', 'pinned', 'change')], ['grid frame', w => set(w, 'kind', 'grid', 'change')],
  ], 1);
  await sweep('Sheet Pile Wall.html', [
    ['retained height 5 m', w => set(w, 'H', '5')], ['propped', w => set(w, 'type', 'prop', 'change')], ['toe provided 5 m', w => set(w, 'toe', '5')],
    ['no water', w => { set(w, 'zwR', ''); set(w, 'zwE', ''); }], ['no unplanned excavation', w => { const c = w.document.getElementById('unpl'); c.checked = false; c.dispatchEvent(new w.Event('change', { bubbles: true })); }],
  ], 1);
  {   // the toe provided is measured below the formation: the requirement adds the unplanned excavation
    const { w } = await load('Sheet Pile Wall.html'); const inp = w.input(w.collect()); inp.toeProvided = 6; const R = w.eval('Piling').design(inp);
    const need = R.toeLevel - inp.H, ck = R.checks.find(c => c.k === 'd');
    truth('Sheet Pile Wall: embedment check uses the toe below the formation', Math.abs(ck.util - need / 6) < 1e-9 && need > R.dReq); w.close();
  }
  await sweep('RC Section Design Toolkit.html', [
    ['torsion tab', w => click(w, '#modes button[data-m="tor"]')], ['torsion T_Ed 60', w => set(w, 'TEd', '60')],
    ['crack width tab', w => click(w, '#modes button[data-m="crk"]')], ['axial tension, slab', w => { set(w, 'ckind', 'tension', 'change'); set(w, 'cel', 'slab', 'change'); }],
    ['anchorage tab', w => click(w, '#modes button[data-m="anc"]')], ['bent bar, 12 mm', w => { set(w, 'abent', '1', 'change'); set(w, 'aphi', '12', 'change'); }], ['compression', w => set(w, 'aten', '0', 'change')],
  ], 0);
  await sweep('RC Column Design.html', [
    ['N_Ed 1500 kN, 7 m', w => { set(w, 'ned', '1500'); set(w, 'clen', '7000'); }], ['unbraced', w => w.setBraced(false)], ['pinned', w => w.setPinned(true)], ['circular', w => w.setTab('circ')],
  ], 2);
  await sweep('Hollowcore Support Beam.html', [
    ['span 7.2 m', w => set(w, 'L', '7.2')], ['edge beam', w => set(w, 'LB', '0')], ['bottom flange', w => set(w, 'bearOn', 'bottom', 'change')],
    ['Slimflor', w => { set(w, 'series', 'SF', 'change'); set(w, 'gap', '10'); }], ['ASB', w => set(w, 'series', 'ASB', 'change')],
  ], 2);
  {   // after a Check on the same inputs the construction stages and the moments are drawn
    const { w } = await load('Hollowcore Support Beam.html'); click(w, '#calc'); await wait(50);
    const h = w.document.getElementById('drawings').innerHTML;
    truth('Hollowcore Support Beam: Check adds the construction stages', (h.match(/<svg class="jd dk"/g) || []).length === 3 && />2AB</.test(h) && !bad(h)); w.close();
  }
  await sweep('Steel Masonry Support.html', [
    ['leaf 50 mm off the face', w => set(w, 'lc', '60')], ['toe load', w => set(w, 'loadAt', 'toe', 'change')], ['plate under a beam', w => set(w, 'type', 'plate', 'change')],
    ['spanning angle, S275', w => { set(w, 'grade', 'S275', 'change'); set(w, 'cold', '0', 'change'); set(w, 'at', '12'); set(w, 'type', 'span', 'change'); }],
  ], 1);
  {   // a stainless plate weld has a resistance (beta_w = 1.0, BS EN 1993-1-4 4.3(4)), so the verdict is never NaN
    const { w } = await load('Steel Masonry Support.html'); set(w, 'type', 'plate', 'change'); const R = w.eval('Masonry').design(w.input(w.collect()));
    truth('Steel Masonry Support: stainless plate weld resistance is finite', Number.isFinite(R.plate.FwRd) && Number.isFinite(R.utilMax)); w.close();
  }
  await sweep('Steel Member Fire Design.html', [
    ['spray, 4 sides', w => { set(w, 'prot', 'spray', 'change'); set(w, 'sides', '4', 'change'); }], ['unprotected', w => set(w, 'prot', 'none', 'change')],
    ['R120', w => set(w, 'period', '120', 'change')], ['SHS column', w => { set(w, 'series', 'SHS-H', 'change'); set(w, 'type', 'column', 'change'); set(w, 'N', '500'); }], ['CHS', w => set(w, 'series', 'CHS-H', 'change')],
  ], 3);
  // ---------- bolt group, and the two halves of the former column and base plate tool ----------
  await sweep('Bolt Group Analysis.html', [
    ['force offset 250 mm', w => set(w, 'ya', '250')], ['horizontal force', w => set(w, 'Fy', '60')], ['moment out of plane, about the bottom edge', w => { set(w, 'My', '40'); set(w, 'pivot', 'bottom', 'change'); }],
    ['three columns of bolts', w => set(w, 'cols', '3')], ['coordinates', w => click(w, '#lgCustom')],
  ], 1);
  {
    const { w } = await load('Bolt Group Analysis.html'); set(w, 'My', '40'); await wait(260);
    truth('Bolt Group Analysis: out-of-plane moment adds the tension view', (w.document.getElementById('drawings').innerHTML.match(/<svg class="jd dk"/g) || []).length === 2); w.close();
  }
  await sweep('Steel Column Design.html', [
    ['height 6 m', w => set(w, 'H', '6')], ['two lateral restraints', w => set(w, 'nR', '2')], ['L_cr,z / L = 0.7', w => set(w, 'kz', '0.7')],
    ['UDL up the column', w => set(w, 'a-w-G', '2')], ['UKB', w => set(w, 'series', 'UKB', 'change')],
  ], 2);
  await sweep('Base Plate Design.html', [
    ['thicker plate', w => set(w, 'tp', '40')], ['larger moment', w => { const r = w.document.querySelector('#cases tr:nth-child(2) .c-M'); r.value = '80'; r.dispatchEvent(new w.Event('input', { bubbles: true })); }],
    ['uplift only', w => { const rows = w.document.querySelectorAll('#cases tr'); rows.forEach(tr => { tr.querySelector('.c-N').value = '-200'; tr.querySelector('.c-M').value = '0'; }); rows[0].querySelector('.c-N').dispatchEvent(new w.Event('input', { bubbles: true })); }],
    ['UKB on a deeper plate', w => { set(w, 'D', '560'); set(w, 'series', 'UKB', 'change'); }],
  ], 1);   // the mechanism view in the drawing kit; the joints kit's base view is counted separately below
  {
    const { w } = await load('Base Plate Design.html'); const h = w.document.getElementById('drawings').innerHTML;
    truth('Base Plate Design: the joints kit base view (elevation and plan) with the mechanism', /ELEVATION/.test(h) && /PLAN/.test(h) && /How the base works/.test(h)); w.close();
  }
  // ---------- group 3 ----------
  await sweep('Windpost Design.html', [
    ['cantilever (parapet)', w => set(w, 'sys', 'cant', 'change')], ['restrained at the ties', w => set(w, 'restr', 'ties', 'change')], ['6 m wide panel', w => set(w, 'b', '6')],
    ['RHS, short side to the wind', w => { set(w, 'series', 'RHS-H', 'change'); set(w, 'ori', 'minor', 'change'); }], ['CHS', w => set(w, 'series', 'CHS-H', 'change')], ['UKB, 5 m', w => { set(w, 'series', 'UKB', 'change'); set(w, 'H', '5'); }],
  ], 2);
  {
    const { w } = await load('Windpost Design.html'); const h = w.document.getElementById('drawings').innerHTML;
    truth('Windpost Design: the wind, moment, deflection and tie force carry the engine values', /5\.40 kN\/m/.test(h) && /8\.27 kNm/.test(h) && /2\.88 mm/.test(h) && /1\.21 kN/.test(h) && /9\.45 kN/.test(h)); w.close();
  }
  await sweep('RC Stair Design.html', [
    ['projection beyond support A', w => set(w, 'pA', '900')], ['built into beams (top bars)', w => set(w, 'supports', 'monolithic', 'change')], ['no landings', w => { set(w, 'a', '0'); set(w, 'c', '0'); }],
    ['steep flight', w => { set(w, 'rise', '200'); set(w, 'going', '225'); }], ['6.10a and b', w => set(w, 'comb', '6.10ab', 'change')],
    ['half landing', w => w.document.querySelector('#modes button[data-m="landing"]').click()],
  ], 1);
  {
    const { w } = await load('RC Stair Design.html'); const h = w.document.getElementById('drawings').innerHTML;
    truth('RC Stair Design: flight moments, bars and span/depth carry the engine values', />40\.6</.test(h) && /H12 @ 150 bottom/.test(h) && /actual 29\.9 against allowed 23\.2/.test(h) && /10 × 250 = 2500/.test(h)); w.close();
  }
  await sweep('RC Section Design Toolkit.html', [
    ['flanged, b_eff 1200', w => { set(w, 'shape', 'flanged', 'change'); set(w, 'b', '1200'); }], ['hogging', w => set(w, 'moment', 'hogging', 'change')],
    ['two layers', w => { set(w, 'layers', '2', 'change'); set(w, 'n', '6'); }], ['no compression bars', w => set(w, 'nc', '0')], ['no shear check', w => set(w, 'VEd', '0')],
    ['slab per metre', w => set(w, 'kind', 'slab', 'change')],
  ], 3);
  {
    const { w } = await load('RC Section Design Toolkit.html'); const h = w.document.getElementById('drawings').innerHTML;
    truth('RC Section Design Toolkit: M_Rd, the forces, x and the shear resistances carry the engine values', /328\.9 kNm/.test(h) && /F<tspan[^>]*>c<\/tspan> 686 kN/.test(h) && /x 145\.5/.test(h) && />340</.test(h) && />498\.2</.test(h) && /16\.95/.test(h)); w.close();
  }
  await sweep('RC Punching Shear.html', [
    ['edge column', w => { set(w, 'ptype', 'edge', 'change'); set(w, 'pey', '150'); }], ['corner column', w => set(w, 'ptype', 'corner', 'change')], ['circular', w => set(w, 'pshape', 'circ', 'change')],
    ['an opening', w => w.document.getElementById('addHole').click()], ['β calculated with moments', w => { set(w, 'pbeta', 'calc', 'change'); set(w, 'pMx', '40'); set(w, 'pMy', '25'); }],
    ['no links needed', w => set(w, 'pV', '300')], ['beyond 2 v_Rd,c', w => set(w, 'pV', '2500')],
  ], 3);
  {
    const { w } = await load('RC Punching Shear.html'); const h = w.document.getElementById('drawings').textContent;
    truth('RC Punching Shear: perimeters, stresses and links carry the engine values', /u₁ 4,164 mm at 2d = 408/.test(h) && /2\.47 against/.test(h) && /0\.948/.test(h) && /H8 links, 3 perimeters, 40 legs/.test(h) && /306 ≤ 1\.5d 306/.test(h)); w.close();
  }
  for (const bay of ['internal', 'edge']) {
    const { w, errs } = await load('RC Flat Slab Design.html'); if (bay === 'edge') set(w, 'bay', 'edge', 'change'); w.document.getElementById('calc').click(); await wait(300);
    const r = w.document.getElementById('results'), plan = r.querySelector('svg.plan'), elev = r.querySelector('svg.elev');
    truth(`RC Flat Slab Design (${bay} bay): punching views, strip widths and bars, loads on the elevation`, r.querySelectorAll('svg.dk').length === 3 && !!plan && /CS H\d+ @ \d+/.test(plan.textContent) && /MS H\d+ @ \d+/.test(plan.textContent) && /kN\/m²/.test(elev.textContent) && !bad(r.innerHTML) && errs.length === 0); w.close();
  }
  for (const t of ['mono', 'duo', 'multi', 'cyl', 'abut', 'parapet', 'obstr', 'canopy']) {
    const { w, errs } = await load('Snow Loading.html'); set(w, 'type', t, 'change'); w.document.getElementById('calc').click(); await wait(150);
    const r = w.document.getElementById('results'), cases = r.querySelectorAll('.case'), svgs = r.querySelectorAll('.case svg.dk');
    truth(`Snow Loading (${t}): a drawing per case with the loads in kN/m² and the roof dimensioned`, cases.length > 0 && svgs.length === cases.length && [...svgs].every(s => /kN\/m²/.test(s.textContent) || /no load/.test(s.textContent)) && /\d\.\d\d m/.test(svgs[0].textContent) && !bad(r.innerHTML) && errs.length === 0); w.close();
  }
  {
    const { w, errs } = await load('Beam Analysis.html');
    w.eval(`loadRow({ case: 'Q', member: 0, type: 'point', P: 30, a: 2 }); loadRow({ case: 'S', member: 1, type: 'vdl', w1: 2, w2: 6, a: 1, b: 5 }); loadRow({ case: 'G', member: 2, type: 'moment', M: 15, a: 0.5 });`);
    const pre = w.document.getElementById('results').innerHTML;
    w.document.getElementById('calc').click(); await wait(400);
    const h = w.document.getElementById('results').querySelector('svg.diag').textContent;
    truth('Beam Analysis: the model gives every load with its value, and the ULS reactions after a run', /G 8 kN\/m/.test(pre) && /Q 10 kN\/m/.test(h) && /W -3 kN\/m/.test(h) && /Q 30 kN/.test(h) && /S 2–6 kN\/m/.test(h) && /G 15 kNm/.test(h) && /184\.6|1\d\d\.\d/.test(h) && !bad(w.document.getElementById('results').innerHTML) && errs.length === 0); w.close();
  }
  for (const [rt, pitch] of [['flat', 0], ['mono', 10], ['duo', 25]]) {
    const { w, errs } = await load('Wind Loading.html'); set(w, 'rtype', rt, 'change'); if (pitch) set(w, 'pitch', String(pitch)); w.document.getElementById('calc').click(); await wait(200);
    let ok = true;
    for (let k = 0; k < 4; k++) {
      w.document.querySelector(`#cases button[data-k="${k}"]`).click(); await wait(60);
      const r = w.document.getElementById('results'), plan = r.querySelector('svg.plan'), elev = r.querySelector('svg.elev');
      ok = ok && !!plan && !!elev && /[+-]\d\.\d\d/.test(plan.textContent) && /kN\/m²/.test(plan.textContent) && /\d+\.\d kN/.test(elev.textContent) && !bad(r.innerHTML);
    }
    w.document.getElementById('printBtn').click();
    truth(`Wind Loading (${rt} roof): every direction's plan gives c_pe and w_e by zone, the face the overall force; all on the A4 sheet`, ok && w.document.getElementById('report').querySelectorAll('svg.plan').length === 4 && errs.length === 0); w.close();
  }
  await sweep('RC Wall Design.html', [
    ['pinned ends', w => set(w, 'wend', 'pinned', 'change')], ['plain wall', w => set(w, 'wtype', 'plain', 'change')],
    ['reinforced, unbraced and slender', w => { set(w, 'wtype', 'rc', 'change'); set(w, 'wend', 'framed', 'change'); set(w, 'wbr', 'unbraced', 'change'); set(w, 'wl', '5000'); set(w, 'wN', '1500'); }], ['braced, slender', w => { set(w, 'wl', '6000'); set(w, 'wN', '1500'); }], ['thicker wall, bigger moments', w => { set(w, 'wh', '300'); set(w, 'wMt', '40'); set(w, 'wMb', '-20'); }],
  ], 1);
  {
    const { w } = await load('RC Wall Design.html'); const h = w.document.getElementById('drawings').textContent;
    w.document.querySelector('#modes button[data-m="core"]').click(); await wait(260);
    truth('RC Wall Design: the panel elevation carries l₀, λ and M_Ed against M_Rd; none in core mode', /l₀ 2,671/.test(h) && /λ = l₀\/i = 46\.3/.test(h) && /M.*Ed.* = 18\.0 kNm\/m/.test(h) && /93\.4 kNm\/m/.test(h) && w.document.getElementById('drawings').innerHTML === ''); w.close();
  }
  {
    const { w, errs } = await load('Section Properties.html'); let ok = true, chan = '';
    for (const sh of ['isec', 'channel', 'tee', 'angle', 'rhs', 'chs', 'rect', 'circle', 'plates', 'polygon']) {
      w.eval(`document.getElementById('shape').value = '${sh}'; renderDims(); document.getElementById('calc').click();`);
      const r = w.document.getElementById('results'), sv = r.querySelector('svg.diag');
      const good = !!sv && /Centroid C/.test(sv.textContent) && /from the left/.test(sv.textContent) && !bad(r.innerHTML) && !r.querySelector('.err');
      if (!good) { ok = false; console.log('  section properties drawing failed for', sh); }
      if (sh === 'channel') chan = sv.textContent;
    }
    truth('Section Properties: every shape draws its dimensions, centroid, axes and shear centre; the channel S 53.9 from C', ok && /-53\.9 along y/.test(chan) && /PNA 150\.0 from the bottom/.test(chan) && errs.length === 0); w.close();
  }
  await sweep('RC Lintel Design.html', [
    ['no arching', w => set(w, 'mode', 'full', 'change')], ['a point load', w => w.document.getElementById('addPoint').click()], ['wide opening, deeper lintel', w => { set(w, 'L', '3600'); set(w, 'h', '300'); }],
    ['no links', w => set(w, 'phil', '0', 'change')], ['low wall', w => { set(w, 'mode', 'tri', 'change'); set(w, 'Hm', '500'); }], ['a second floor, direct load', w => { w.document.getElementById('addFloor').click(); set(w, 'dG', '3'); }],
    ['6.10a and b, short bearings', w => { set(w, 'comb', '6.10ab', 'change'); set(w, 't1', '100'); }],
  ], 5);
  {
    const { w } = await load('RC Lintel Design.html'); const h = w.document.getElementById('drawings').textContent;
    truth('RC Lintel Design: spans, the triangle height and M_Ed carry the engine values', /clear span 1,800/.test(h) && /1,950/.test(h) && /990/.test(h) && /2\.26 at 898/.test(h) && /in the interaction zone: halved/.test(h)); w.close();
  }
  {   // RC Lintel Design, checking a Naylor lintel: three drawings across the lintels, spans and loads, values from the engine
    const { w, errs } = await load('RC Lintel Design.html'), d = () => w.document.getElementById('drawings').innerHTML;
    w.document.querySelector('#tools [data-t=naylor]').click(); await wait(260);
    let ok = (d().match(/<svg class="jd dk"/g) || []).length === 3 && !bad(d());
    const cases = [['nl', 'HS-R6'], ['L', '2700'], ['nl', 'EE-ER4'], ['nn', '2'], ['mode', 'full'], ['L', '3400'], ['nl', 'XF-XFS8'], ['L', '600'], ['nl', 'FS-FireR14-120'], ['Hm', '300'], ['dG', '12']];
    for (const [id, v] of cases) { set(w, id, v, 'change'); await wait(220); const h = d(); if ((h.match(/<svg class="jd dk"/g) || []).length !== 3 || bad(h)) { ok = false; console.log('  Naylor drawing failed at', id, v); } }
    truth('RC Lintel Design, Naylor: three drawings across lintels, spans, side by side and the wall', ok && errs.length === 0);
    set(w, 'nl', 'HS-R8', 'change'); set(w, 'nn', '1', 'change'); set(w, 'mode', 'tri', 'change'); set(w, 'L', '1800', 'change'); set(w, 'Hm', '2000', 'change'); set(w, 'dG', '0', 'change'); await wait(260);
    const t = w.document.getElementById('drawings').textContent;
    truth('RC Lintel Design, Naylor: w_eq 3.43, the allowable 31.18 and M_k 1.63 from the engine', /eq3\.43/.test(t.replace(/\s/g, '')) && /31\.18/.test(t) && /1\.63 kNm/.test(t) && /Naylor R8/.test(t)); w.close();
  }
  await sweep('Precast Connections.html', [
    ['bearing dry, a floor on steel', w => { set(w, 'b_conn', 'dry', 'change'); set(w, 'b_row', 'line', 'change'); set(w, 'b_support', 'steel', 'change'); set(w, 'b_b1', '1000'); set(w, 'b_FEd', '60'); }],
    ['bearing on a pad, isolated, vertical loops', w => { set(w, 'b_conn', 'pad', 'change'); set(w, 'b_lpad', '120'); set(w, 'b_detail', 'vloop', 'change'); const c = w.document.getElementById('b_isolated'); c.checked = true; c.dispatchEvent(new w.Event('change', { bubbles: true })); }],
    ['brickwork, short seating', w => { set(w, 'b_support', 'brick', 'change'); set(w, 'b_aProv', '90'); }],
    ['half-joint', w => w.document.querySelector('#modes [data-m=half]').click()], ['half-joint, half on inclined bars', w => { set(w, 'j_alpha', '50'); set(w, 'j_nInc', '2'); }],
    ['half-joint, all inclined, plate end, straight bottom bars', w => { set(w, 'j_alpha', '100'); set(w, 'j_nibEnd', 'plate', 'change'); set(w, 'j_botEnd', 'straight', 'change'); }],
    ['half-joint, deep nib far bearing', w => { set(w, 'j_alpha', '0'); set(w, 'j_hn', '450'); set(w, 'j_av', '160'); set(w, 'j_lend', '300'); }],
    ['splice', w => w.document.querySelector('#modes [data-m=splice]').click()], ['splice, biaxial, 5 by 4 bars', w => { set(w, 's_Mb', '80'); set(w, 's_nb', '5'); set(w, 's_nh', '4'); set(w, 's_phi', '20', 'change'); }],
    ['splice in tension, rated below the bar', w => { set(w, 's_NEd', '-300'); set(w, 's_capMode', 'value', 'change'); set(w, 's_Fk', '120'); }],
  ], 1);
  console.log(`\n${pass}/${pass + fail} drawing checks passed`); process.exit(fail ? 1 : 0);
})();
