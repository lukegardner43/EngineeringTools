// Drawings on Composite Beam, Floor Vibration, Steel Member, Concrete Tie Force and RC Crack Width (group 1) and on Steel Beam
// Torsion, Beam Web Openings, Steel Frame Design, Sheet Pile Wall, the RC Section Toolkit tabs, RC Column, Hollowcore Support
// Beam, Steel Masonry Support, Steel Member Fire Design and the later pages to Glulam Beams (group 2): present on load, redrawn as the inputs change, and free of NaN / undefined / Infinity across the input variations each tool offers.
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
    ['a 1903 British Standard Beam, f_y given', w => { set(w, 'series', 'H-BSB1903', 'change'); set(w, 'fyG', '230'); }], ['a 1932 channel', w => set(w, 'series', 'H-BSC1932', 'change')],
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
    ['base again, short on a slender base', w => { set(w, 'restraint_config', 'base_only', 'change'); set(w, 'L', '4'); set(w, 'base_b', '0.6'); }],
    ['T1, R and εcd given', w => { set(w, 'T1_mode', 'given', 'change'); set(w, 'R1_mode', 'manual', 'change'); set(w, 'ecd_mode', 'given', 'change'); }],
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
  await sweep('Pad Foundation.html', [
    ['offset column, both offsets', w => { set(w, 'ex', '300'); set(w, 'ey', '-200'); }], ['rectangular base, moments both ways', w => { set(w, 'L', '3600'); set(w, 'B', '2200'); set(w, 'G_My', '60'); set(w, 'Q_Mx', '-40'); }],
    ['deep soil cover, big bars', w => { set(w, 'Dover', '2200'); set(w, 'phiX', '25', 'change'); set(w, 'sX', '200'); }], ['no soil over the base', w => set(w, 'Dover', '600')],
    ['small base: perimeters off the edge', w => { set(w, 'L', '1200'); set(w, 'B', '1200'); set(w, 'ex', '0'); set(w, 'ey', '0'); }], ['undrained', w => { set(w, 'L', '2800'); set(w, 'B', '2800'); set(w, 'soil', 'undrained', 'change'); set(w, 'cu', '50'); }],
    ['allowable pressure', w => { set(w, 'soil', 'allowable', 'change'); set(w, 'qa', '250'); }], ['big wind moment, uplift on one side', w => { set(w, 'W_Mx', '900'); set(w, 'W_N', '-300'); }],
    ['strip footing', w => w.document.querySelector('#types [data-t=strip]').click()], ['strip, offset wall', w => { set(w, 'L', '1800'); set(w, 'c1', '215'); set(w, 'ex', '-400'); set(w, 'W_Mx', '0'); set(w, 'W_N', '0'); }],
  ], 2);
  await sweep('Pile Cap.html', [
    ['2 piles', w => w.document.querySelector('#ns [data-n="2"]').click()], ['2 piles, truss, offset column', w => { set(w, 'method', 'truss', 'change'); set(w, 'ex', '150'); }],
    ['3 piles', w => w.document.querySelector('#ns [data-n="3"]').click()], ['3 piles, big moments', w => { set(w, 'G_My', '200'); set(w, 'W_Mx', '400'); }],
    ['4 piles, rectangular, bending', w => { w.document.querySelector('#ns [data-n="4"]').click(); set(w, 'method', 'bending', 'change'); set(w, 'sy', '1000'); set(w, 'ex', '0'); }],
    ['5 piles', w => w.document.querySelector('#ns [data-n="5"]').click()], ['6 piles, truss', w => { w.document.querySelector('#ns [data-n="6"]').click(); set(w, 'method', 'truss', 'change'); }],
    ['6 piles, tension piles', w => { set(w, 'W_Mx', '2500'); set(w, 'G_N', '300'); set(w, 'Q_N', '0'); }], ['shallow cap, wide piles', w => { set(w, 'H', '450'); set(w, 's', '2400'); set(w, 'W_Mx', '0'); set(w, 'G_N', '1500'); }],
  ], 2);
  await sweep('Retaining Wall.html', [
    ['sloping ground', w => set(w, 'beta', '20')], ['water both sides', w => { set(w, 'hw', '2000'); set(w, 'hwf', '600'); }], ['line and strip loads', w => { set(w, 'lineG', '10'); set(w, 'lineQ', '15'); set(w, 'stripQ', '20'); }],
    ['key and passive', w => { w.document.getElementById('passive').checked = true; set(w, 'hk', '400'); }], ['no toe', w => { set(w, 'bt', '0'); set(w, 'hk', '0'); }], ['tall wall, short base: fails', w => { set(w, 'H', '5000'); set(w, 'B', '1500'); }],
    ['propped', w => { w.document.querySelector('#types [data-t="propped"]').click(); set(w, 'H', '3200'); set(w, 'B', '2600'); set(w, 'bt', '600'); }], ['propped low', w => set(w, 'hProp', '1500')],
    ['gravity', w => w.document.querySelector('#types [data-t="gravity"]').click()], ['gravity, slope and water', w => { set(w, 'beta', '10'); set(w, 'hw', '800'); }],
  ], 2);
  await sweep('Basement Wall.html', [
    ['pinned at the slab', w => set(w, 'fixBase', 'pinned', 'change')], ['water to the ground', w => set(w, 'hw', '3300')], ['no water, active', w => { set(w, 'hw', '0'); set(w, 'K', 'active', 'change'); }],
    ['tall wall, low prop', w => { set(w, 'H', '4500'); set(w, 'hProp', '3000'); }], ['big wall loads', w => { set(w, 'wallG', '300'); set(w, 'wallQ', '150'); }], ['no toe', w => set(w, 'bt', '0')],
  ], 2);
  // ---------- RC beam, slab and flat slab: drawn live from the inputs, before any Calculate ----------
  const q = (w, sel, v, ev = 'input') => { const e = w.document.querySelector(sel); e.value = v; e.dispatchEvent(new w.Event(ev, { bubbles: true })); };
  const qa = (w, sel, v, ev = 'change') => w.document.querySelectorAll(sel).forEach(e => { e.value = v; e.dispatchEvent(new w.Event(ev, { bubbles: true })); });
  await sweep('RC Beam Analysis and Design.html', [
    ['span 2 at 9 m', w => q(w, '#spanRows .row:nth-child(2) .L', '9')], ['rectangular spans', w => qa(w, '#spanRows .shape', 'R')],
    ['6.10a/b, adjacent patterns', w => { set(w, 'rule', '6.10ab', 'change'); set(w, 'pat', 'adj', 'change'); }],
    ['a partial UDL', w => { w.document.getElementById('addLoad').click(); const r = [...w.document.querySelectorAll('#loadRows .row')].pop(); q(w, '#loadRows .row:last-child .type', 'part', 'change'); r.querySelector('.a').value = '1'; q(w, '#loadRows .row:last-child .b', '2'); }],
    ['cantilever at the left', w => { q(w, '#supRows .row:first-child .kind', 'free', 'change'); q(w, '#spanRows .row:first-child .L', '2'); }],
    ['four spans', w => w.document.getElementById('addSpan').click()], ['knife-edge supports', w => qa(w, '#supRows .row:not(:first-child) .kind', 'knife')],
    ['two layers of bottom bars', w => qa(w, '#barRows .row[data-kind="span"] .lay', '2')],
  ], 1);
  await sweep('RC Slab Design.html', [
    ['span 2 at 7 m', w => q(w, '#spanRows .row:nth-child(2) .L', '7')], ['h 250 throughout', w => qa(w, '#spanRows .h', '250', 'input')],
    ['encastré ends', w => { q(w, '#supRows .row:first-child .kind', 'fixed', 'change'); q(w, '#supRows .row:last-child .kind', 'fixed', 'change'); }],
    ['cantilever at the right', w => { q(w, '#supRows .row:last-child .kind', 'free', 'change'); q(w, '#spanRows .row:last-child .L', '1.5'); }],
    ['a line load', w => { w.document.getElementById('addLoad').click(); q(w, '#loadRows .row:last-child .type', 'line', 'change'); q(w, '#loadRows .row:last-child .val', '8'); }],
    ['two-way panel', w => w.document.querySelector('#modes [data-m="two"]').click()],
    ['two-way, all edges continuous', w => ['eL1', 'eL2', 'eS1', 'eS2'].forEach(id => { const e = w.document.getElementById(id); e.checked = true; e.dispatchEvent(new w.Event('change', { bubbles: true })); })],
    ['two-way, simply supported', w => ['eL1', 'eL2', 'eS1', 'eS2'].forEach(id => { const e = w.document.getElementById(id); e.checked = false; e.dispatchEvent(new w.Event('change', { bubbles: true })); })],
    ['two-way, l_y/l_x beyond 2', w => set(w, 'ly', '15')],
  ], 1);
  await sweep('RC Flat Slab Design.html', [
    ['span 1 at 9 m', w => q(w, '#spanRows .row:first-child .L', '9')], ['h 300', w => set(w, 'h', '300')],
    ['edge bay', w => { set(w, 'bay', 'edge', 'change'); set(w, 'b', '4050'); }], ['circular column 3', w => { q(w, '#colRows .row:nth-child(3) .shape', 'circ', 'change'); q(w, '#colRows .row:nth-child(3) .c1', '500'); }],
    ['four spans', w => w.document.getElementById('addSpan').click()], ['heavy imposed load', w => set(w, 'qk', '10')],
  ], 3);
  await sweep('RC Ribbed and Waffle Slabs.html', [
    ['span 2 at 9 m', w => q(w, '#spanRows .row:nth-child(2) .L', '9')], ['no solid zone at the end', w => q(w, '#spanRows .row:first-child .solL', '0')],
    ['two transverse ribs', w => qa(w, '#spanRows .cross', '2', 'input')], ['vertical rib sides, wide centres', w => { set(w, 'taper', '0'); set(w, 's', '1200'); }],
    ['no links, no mesh', w => { set(w, 'lphi', '0', 'change'); set(w, 'mesh', '0', 'change'); }], ['bearing ends', w => { q(w, '#supRows .row:first-child .kind', 'knife', 'change'); q(w, '#supRows .row:last-child .kind', 'knife', 'change'); }],
    ['cantilever at the right', w => { q(w, '#supRows .row:last-child .kind', 'free', 'change'); q(w, '#spanRows .row:last-child .L', '1.8'); q(w, '#spanRows .row:last-child .solR', '0'); }],
    ['waffle panel', w => w.document.querySelector('#modes [data-m="two"]').click()],
    ['waffle, all edges continuous', w => ['eL1', 'eL2', 'eS1', 'eS2'].forEach(id => { const e = w.document.getElementById(id); e.checked = true; e.dispatchEvent(new w.Event('change', { bubbles: true })); })],
    ['waffle, simply supported', w => set(w, 'method', 'simple', 'change')], ['waffle, no margins', w => set(w, 'margin', '0')], ['waffle, long panel', w => set(w, 'ly', '16')],
  ], 2);
  await sweep('Masonry Bearing.html', [
    ['bearing at the end of the wall', w => set(w, 'aL', '0')], ['short pier', w => { set(w, 'aL', '160'); set(w, 'aR', '160'); }], ['long wall', w => { set(w, 'aL', '6000'); set(w, 'aR', '6000'); }],
    ['narrow bearing at one face', w => { set(w, 't', '215'); set(w, 'pW', '215'); set(w, 'wb', '60'); }], ['bearing set back from the face', w => set(w, 'inset', '100')],
    ['no padstone', w => set(w, 'pmat', 'none', 'change')], ['masonry padstone, wall width', w => { set(w, 'pmat', 'masonry', 'change'); set(w, 'pW', '215'); }], ['shallow concrete padstone', w => { set(w, 'pmat', 'concrete', 'change'); set(w, 'ph', '100'); }],
    ['long spreader', w => { set(w, 'pL', '1115'); set(w, 'ph', '300'); }], ['narrow padstone, centred bearing', w => { set(w, 'inset', '57.5'); set(w, 'wb', '100'); set(w, 'pW', '140'); }], ['tall wall', w => set(w, 'hc', '6000')],
    ['clay bricks', w => set(w, 'unit', 'clay', 'change')], ['AAC blocks', w => set(w, 'unit', 'aac', 'change')],
  ], 1);
  await sweep('Masonry Column.html', [
    ['tall column', w => set(w, 'h', '4500')], ['wide pier', w => set(w, 'b', '1115')], ['brick pier', w => { set(w, 'b', '327'); set(w, 't', '215'); set(w, 'unit', 'clay', 'change'); }],
    ['wind across t', w => set(w, 'wk', '1')], ['wind across b', w => set(w, 'wdir', 'b', 'change')], ['eccentric both ways', w => { set(w, 'ebT', '40'); set(w, 'etT', '-20'); }],
    ['double curvature', w => set(w, 'etB', '20')], ['concrete floors', w => set(w, 'rhoT', '0.75', 'change')], ['6.10a/b', w => { set(w, 'combo', '6.10ab', 'change'); set(w, 'Qk', '60'); }],
  ], 1);
  await sweep('Masonry Wall Panel.html', [
    ['tall panel', w => set(w, 'h', '4000')], ['long panel', w => set(w, 'l', '7500')], ['continuous sides', w => { set(w, 'eL', 'fixed', 'change'); set(w, 'eR', 'fixed', 'change'); }],
    ['free top', w => set(w, 'eTopS', 'free', 'change')], ['one free side', w => { set(w, 'eTopS', 'ss', 'change'); set(w, 'eR', 'free', 'change'); }],
    ['spanning vertically', w => { set(w, 'eL', 'free', 'change'); set(w, 'l', '4500'); }], ['spanning horizontally', w => { set(w, 'eL', 'ss', 'change'); set(w, 'eR', 'ss', 'change'); set(w, 'eTopS', 'free', 'change'); set(w, 'eBotS', 'free', 'change'); }],
    ['single leaf', w => { set(w, 'eTopS', 'ss', 'change'); set(w, 'eBotS', 'ss', 'change'); const c = w.document.getElementById('cav'); c.checked = false; c.dispatchEvent(new w.Event('change', { bubbles: true })); }],
    ['no wind', w => set(w, 'wk', '0')], ['eccentric load', w => set(w, 'eT', '-30')], ['clay bricks', w => { set(w, 'unit', 'clay', 'change'); set(w, 't', '215'); }],
  ], 1);
  const row = (w, c, f, v, a, b, up) => { w.document.getElementById('addLoad').click(); const r = [...w.document.querySelectorAll('#loadRows .row')].pop(), q = s => r.querySelector(s);
    q('.case').value = c; q('.form').value = f; q('.w').value = v; if (a != null) q('.a').value = a; if (b != null) q('.bb').value = b; q('.up').checked = !!up; q('.form').dispatchEvent(new w.Event('change', { bubbles: true })); };
  const tick = (w, id, v) => { const c = w.document.getElementById(id); c.checked = v; c.dispatchEvent(new w.Event('change', { bubbles: true })); };
  await sweep('Timber Beam.html', [
    ['longer span', w => set(w, 'clear', '5200')], ['deeper', w => set(w, 'h', '250')], ['two plies', w => set(w, 'n', '2')],
    ['notched', w => { tick(w, 'notchOn', true); set(w, 'hn', '40'); }], ['glulam', w => { set(w, 'fam', 'glulam', 'change'); set(w, 'b', '90'); }], ['product', w => set(w, 'fam', 'other', 'change')],
    ['a point load', w => row(w, 'Q', 'point', 3, 2.0)], ['partial snow', w => row(w, 'S', 'partial', 1.5, 0.5, 3)], ['wind uplift', w => row(w, 'W', 'line', 1.2, null, null, true)],
    ['no self-weight', w => tick(w, 'sw', false)], ['short bearing', w => set(w, 'lb', '50')],
  ], 1);
  const act = (w, c, N, My, Mz, wl) => { w.document.getElementById('addLoad').click(); const r = [...w.document.querySelectorAll('#loadRows .row')].pop(), q = s => r.querySelector(s);
    q('.case').value = c; q('.N').value = N; q('.My').value = My; q('.Mz').value = Mz; q('.w').value = wl; q('.N').dispatchEvent(new w.Event('input', { bubbles: true })); };
  await sweep('Timber Member.html', [
    ['longer', w => set(w, 'L', '4800')], ['wider', w => set(w, 'b', '150')], ['no eccentricity', w => { set(w, 'ez', '0'); set(w, 'ey', '0'); }],
    ['a moment', w => act(w, 'Q', 0, 2, 0, 0)], ['wind on the face', w => act(w, 'W', 0, 0, 0, 1.5)], ['tension', w => act(w, 'W', -80, 0, 0, 0)],
    ['restrained mid-height', w => set(w, 'kY', '0.5')], ['glulam', w => { set(w, 'fam', 'glulam', 'change'); set(w, 'h', '315'); }], ['LVL', w => set(w, 'fam', 'other', 'change')],
  ], 1);
  await sweep('Timber Stud Wall.html', [
    ['taller', w => set(w, 'H', '3000')], ['closer studs', w => set(w, 's', '400')], ['deeper studs', w => set(w, 'h', '89')], ['noggings', w => set(w, 'restraint', 'noggings', 'change')],
    ['two rows', w => set(w, 'rows', '2')], ['no restraint', w => set(w, 'restraint', 'none', 'change')], ['loads per stud', w => set(w, 'per', 'stud', 'change')],
    ['off centre', w => set(w, 'e', '40')], ['thicker plate', w => set(w, 'tp', '50')], ['no wind', w => { const r = [...w.document.querySelectorAll('#loadRows .row')].pop(); r.querySelector('.xbtn').click(); }],
  ], 2);
  await sweep('Timber Racking Wall.html', [
    ['longer', w => set(w, 'L', '4.8')], ['taller', w => set(w, 'H', '2.7')], ['more wind', w => set(w, 'R', '4')], ['no opening', w => w.document.querySelector('#openRows .xbtn').click()],
    ['two openings', w => { w.document.getElementById('addOpen').click(); w.document.getElementById('addOpen').click(); }], ['no storey above', w => w.document.querySelector('#aboveRows .xbtn').click()],
    ['return wall load', w => set(w, 'V', '5')], ['uplift', w => set(w, 'up', '0.5')], ['plasterboard', w => set(w, 'kind', 'pb', 'change')], ['no withdrawal', w => { set(w, 'kind', 'OSB/3', 'change'); set(w, 'fwd', '0'); }],
  ], 1);
  await sweep('Timber Connections.html', [
    ['thicker main member', w => set(w, 't2', '75')], ['two rows', w => { set(w, 'm', '2'); set(w, 'sa2', '30'); }], ['unloaded end', w => set(w, 'end', 'unloaded', 'change')],
    ['single shear', w => set(w, 'type', 'tt1', 'change')], ['plywood', w => set(w, 'type', 'pt1', 'change')], ['steel plate', w => set(w, 'type', 'st1', 'change')],
    ['plates both sides', w => set(w, 'type', 'st2', 'change')], ['bolts', w => { set(w, 'kind', 'bolt', 'change'); set(w, 'd', '12'); set(w, 'n', '3'); set(w, 'sa1', '60'); }],
    ['slotted plate', w => set(w, 'type', 'st3', 'change')], ['at an angle', w => { set(w, 'a2', '45'); set(w, 'he', '100'); }],
  ], 1);
  const wrow = (w, i) => w.document.querySelectorAll('#wallRows .row')[i], wset = (w, i, cls, v) => { const e = wrow(w, i).querySelector('.' + cls); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  await sweep('Rigid Diaphragm.html', [
    ['wider plan', w => set(w, 'B', '36')], ['load off centre', w => set(w, 'ay', '24')], ['load in X only', w => set(w, 'Fy', '0')], ['load in Y only', w => { set(w, 'Fy', '200'); set(w, 'Fx', '0'); }],
    ['± e torsion', w => { set(w, 'Fx', '100'); set(w, 'tors', 'ecc', 'change'); }], ['no torsion', w => set(w, 'tors', 'none', 'change')], ['bracing', w => wset(w, 2, 'type', 'brace')],
    ['masonry', w => wset(w, 0, 'type', 'masonry')], ['given k', w => wset(w, 1, 'type', 'k')], ['a wall moved', w => wset(w, 5, 'at', '12')], ['a wall removed', w => wrow(w, 4).querySelector('.xbtn').click()],
    ['walls along Y only (Y load)', w => { set(w, 'Fx', '0'); [0, 1, 2, 3, 4].forEach(i => { if (wrow(w, i)) wset(w, i, 'dir', 'y'); }); }], ['racking strength', w => { [0, 1, 2, 3, 4].forEach(i => { if (wrow(w, i)) wset(w, i, 'FRd', '20'); }); set(w, 'basis', 'strength', 'change'); }],
  ], 2);
  const tset = (w, i, cls, v) => { const e = w.document.querySelectorAll('#tdRows tr')[i].querySelector('.' + cls); e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); };
  await sweep('Load Take-down.html', [
    ['a bigger roof area', w => tset(w, 0, 'A', '6')], ['a point load on a floor', w => tset(w, 1, 'pD', '12')], ['a sum in a cell', w => tset(w, 3, 'aD', '0.215*20')], ['a footing size', w => set(w, 'qa', '100')],
    ['column', w => { set(w, 'type', 'column', 'change'); tset(w, 0, 'A', '20'); tset(w, 1, 'A', '20'); tset(w, 2, 'A', '20'); set(w, 'qa', '150'); }],
    ['best of α_n and α_A', w => set(w, 'red', 'best', 'change')], ['(6.10a), (6.10b)', w => set(w, 'comb', '6.10ab', 'change')],
    ['hipped roof', w => { set(w, 'type', 'wall', 'change'); const c = w.document.getElementById('hipOn'); c.checked = true; c.dispatchEvent(new w.Event('change', { bubbles: true })); }],
    ['hip, half to the plates', w => set(w, 'hF', '0.5')], ['a row added', w => { w.document.getElementById('addRow').click(); tset(w, 4, 'pD', '20'); }], ['a row removed', w => w.document.querySelectorAll('#tdRows .xbtn')[3].click()],
  ], 1);
  await sweep('Rolling Load Analysis.html', [
    ['longer span', w => { const e = w.document.querySelector('#spanRows .L'); e.value = '12'; e.dispatchEvent(new w.Event('input', { bubbles: true })); }],
    ['two spans', w => w.document.getElementById('addSpan').click()], ['a third load', w => w.document.getElementById('addWheel').click()],
    ['fixed and free ends', w => { set(w, 'supL', 'fixed', 'change'); set(w, 'supR', 'free', 'change'); }], ['no permanent load', w => { w.document.querySelectorAll('#spanRows .G').forEach(e => { e.value = '0'; }); set(w, 'E', '205'); }],
  ], 1);
  await sweep('Gabion Retaining Wall.html', [
    ['lean 10°', w => set(w, 'alpha', '10')], ['sloping ground 15°', w => set(w, 'eps', '15')], ['a fourth course', w => w.document.getElementById('addCourse').click()],
    ['upright, stepped at the back', w => { set(w, 'alpha', '0'); w.document.querySelectorAll('#courseRows .off').forEach((e, i) => { if (i) { e.value = '0'; e.dispatchEvent(new w.Event('input', { bubbles: true })); } }); }],
    ['heavy surcharge, resultant out of the middle third', w => set(w, 'qQ', '60')], ['no surcharge', w => set(w, 'qQ', '0')],
    ['undrained founding soil', w => { set(w, 'bearing', 'undrained', 'change'); set(w, 'cuf', '60'); }], ['toe 0.3 m down', w => set(w, 'D', '0.3')],
  ], 1);
  await sweep('Outrigger Loading.html', [
    ['a longer radius', w => { const e = w.document.querySelector('#liftRows .R'); e.value = '16'; e.dispatchEvent(new w.Event('input', { bubbles: true })); }],
    ['a third, heavier lift that governs', w => { w.document.getElementById('addLift').click(); const r = w.document.querySelectorAll('#liftRows .row')[2]; r.querySelector('.P').value = '8'; r.querySelector('.R').value = '10'; r.querySelector('.R').dispatchEvent(new w.Event('input', { bubbles: true })); }], ['wider outriggers', w => set(w, 'b', '7')],
    ['steel plate, two-way', w => { set(w, 'mat', 'steel', 'change'); set(w, 't', '40'); }], ['plastic mat', w => { set(w, 'mat', 'plastic', 'change'); set(w, 't', '120'); }],
    ['square foot', w => set(w, 'footShape', 'square', 'change')], ['a long mat', w => set(w, 'L', '3')],
    ['75% rule', w => w.document.querySelector('#methods [data-m="rule"]').click()], ['given value', w => w.document.querySelector('#methods [data-m="given"]').click()],
  ], 3);
  await sweep('Raft Foundation.html', [
    ['thinner raft', w => set(w, 'h', '300')], ['softer ground', w => set(w, 'ks', '5000')], ['a wall', w => w.document.getElementById('addWall').click()],
    ['a column removed', w => w.document.querySelectorAll('#colRows .xbtn')[4].click()], ['top bars H16', w => set(w, 'phiT', '16', 'change')], ['longer raft', w => set(w, 'Lx', '12')],
  ], 2);
  await sweep('Piles and Pile Groups.html', [
    ['longer pile', w => set(w, 'L', '28')], ['bigger pile', w => set(w, 'D', '750')], ['water higher', w => set(w, 'zw', '1')],
    ['a pile added', w => w.document.getElementById('addPile').click()], ['a sand layer', w => { w.document.getElementById('addLay').click(); }], ['heavier load', w => set(w, 'G', '4000')],
  ], 2);
  await sweep('Tower Crane Base.html', [
    ['a bigger base', w => set(w, 'L', '6.5')], ['a thicker base', w => set(w, 'h', '1.6')], ['clay', w => { set(w, 'ground', 'undrained', 'change'); set(w, 'cu', '120'); }],
    ['a heavier load case added', w => { w.document.getElementById('addCase').click(); const r = [...w.document.querySelectorAll('#caseRows .row')].pop(), M = r.querySelector('.M'); M.value = '4200'; M.dispatchEvent(new w.Event('input', { bubbles: true })); }], ['wider legs', w => set(w, 's', '2.5')], ['four piles', w => set(w, 'type', 'piled', 'change')],
  ], 2);
  await sweep('Foundations Near Trees.html', [
    ['high soil', w => set(w, 'vcp', 'high', 'change')], ['a climate reduction', w => set(w, 'clim', '0.2', 'change')],
    ['the poplar nearer', w => { const D = w.document.querySelector('#treeRows .row .D'); D.value = '6'; D.dispatchEvent(new w.Event('input', { bubbles: true })); }],
    ['a tree added', w => w.document.getElementById('addTree').click()], ['a shrub added', w => w.document.getElementById('addShrub').click()],
    ['piers', w => set(w, 'type', 'pier', 'change')], ['piles', w => set(w, 'type', 'pile', 'change')], ['a raft', w => set(w, 'type', 'raft', 'change')],
  ], 3);
  await sweep('Working Platforms.html', [
    ['a stiffer subgrade', w => set(w, 'cu', '40')], ['a heavier case 2', w => set(w, 'q2k', '260')], ['a geosynthetic', w => { const c = w.document.getElementById('rOn'); c.checked = true; c.dispatchEvent(new w.Event('change', { bubbles: true })); }],
    ['a granular subgrade', w => { set(w, 'sub', 'granular', 'change'); set(w, 'phiS', '33'); }], ['a proposed thickness', w => set(w, 'Dprop', '0.9')],
  ], 2);
  await sweep('Ground-Bearing Slab.html', [
    ['a thicker slab', w => set(w, 'h', '225')], ['a softer subgrade', w => set(w, 'k', '0.02')], ['fabric', w => set(w, 'reo', 'fabric', 'change')],
    ['a heavier point load added', w => { w.document.getElementById('addPt').click(); const r = [...w.document.querySelectorAll('#ptRows .row')].pop(), P = r.querySelector('.P'); P.value = '300'; P.dispatchEvent(new w.Event('input', { bubbles: true })); }],
    ['four loads at a free corner', w => { const r = w.document.querySelector('#ptRows .row'); r.querySelector('.loc').value = 'corner'; r.querySelector('.n').value = '4'; r.querySelector('.sy').value = '1100'; r.querySelector('.n').dispatchEvent(new w.Event('change', { bubbles: true })); }],
    ['plain concrete', w => set(w, 'reo', 'plain', 'change')],
  ], 2);
  const shp = (w, s) => w.document.querySelector(`#shapes button[data-s="${s}"]`).click();
  await sweep('Glulam Beams.html', [
    ['a deeper apex', w => set(w, 'hap', '1500')], ['single tapered', w => shp(w, 'single')], ['a shallower deep end', w => set(w, 'h1', '900')],
    ['curved', w => shp(w, 'curved')], ['a tighter curve, thinner laminations', w => { set(w, 'rin', '8'); set(w, 't', '20'); }], ['steeper legs', w => set(w, 'beta', '12')],
    ['pitched cambered', w => { set(w, 'beta', '5'); shp(w, 'pitched'); }], ['a steeper roof', w => set(w, 'alpha', '15')], ['a declared glulam product', w => { set(w, 'fam', 'other', 'change'); set(w, 'pkind', 'glulam', 'change'); }],
    ['double tapered, GL32h', w => { set(w, 'fam', 'glulam', 'change'); set(w, 'cls', 'GL32h', 'change'); shp(w, 'double'); }],
    ['a point load at the apex', w => row(w, 'Q', 'point', 20, 8)], ['wind uplift that governs', w => row(w, 'W', 'area', 3, null, null, true)], ['held only at the ends', w => set(w, 'rmode', 'ends', 'change')],
    ['no self-weight', w => tick(w, 'sw', false)], ['a long span', w => set(w, 'L', '24')],
  ], 3);
  console.log(`\n${pass}/${pass + fail} drawing checks passed`); process.exit(fail ? 1 : 0);
})();
