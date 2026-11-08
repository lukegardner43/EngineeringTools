// Drawings on Composite Beam, Floor Vibration, Steel Member, Concrete Tie Force and RC Crack Width: present on load, redrawn
// as the inputs change, and free of NaN / undefined / Infinity across the input variations each tool offers.
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
  {   // the steel beam page shares the template but carries no member drawings
    const { w, errs } = await load('Steel Beam Analysis and Design.html');
    truth('Steel Beam Analysis & Design: unchanged, no member drawing code', typeof w.DrawMember === 'undefined' && w.document.getElementById('drawings').innerHTML === '' && errs.length === 0); w.close();
  }
  console.log(`\n${pass}/${pass + fail} drawing checks passed`); process.exit(fail ? 1 : 0);
})();
