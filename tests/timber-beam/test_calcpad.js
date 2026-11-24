// Timber Beam: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part (the beam and its loads; bending, shear and bearing for the combination that governs each; deflection; floor
// vibration) is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the tool's own:
// set cases (loads along the span; a point load and a part load; wind uplift with reversal; lateral buckling held at the
// supports, l_ef given, loads on either edge; a notch; plies; glulam, hardwood and a declared product; vibration; the
// beam ending at its bearing and running past it) and 80 random beams. Every check of the tool must be in a part with its
// utilisation, no chip may show an error or a unit CalcPad cannot read, and the whole calculation must open as one check.
const { TimberBeam: TB, CalcScript, TimberBeamScript } = require('./load.js');
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, beams = 0, zones = 0;
const kinds = new Set();
function check(tag, C, P) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + 1e-9 * (it.unit === 'mm4' || it.unit === 'mm3' ? 1e-6 : 1);
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
}
const ZONE = { bend: 'bending', shear: 'shear', bearing: 'bearing', winst: 'deflection', wfin: 'deflection', f1: 'vibration', a: 'vibration', v: 'vibration' };
function beam(tag, inp) {
  let D; try { D = TB.design(inp); } catch (e) { return null; }
  const Z = TimberBeamScript.zones(D); beams++;
  Z.forEach(z => kinds.add(z.key));
  for (const k of D.checks) {
    n++; const z = Z.find(zn => zn.key === ZONE[k.id]);
    if (!z || Math.abs(z.util - Math.max(...D.checks.filter(c => ZONE[c.id] === ZONE[k.id]).map(c => c.util))) > 1e-12) { bad++; console.log('MISSING', tag, k.id, z && z.util, k.util); }
  }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v); n++;
    if (zn.util != null && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  // the whole calculation as one check, as the page's button downloads it
  const all = CalcScript.merge(Z.map(z => ({ C: z.C, title: z.title })), { title: 'Timber beam' });
  check(`${tag} whole`, all, H.text(all.calcpad()));
  n++; if (Math.abs(Math.max(...Z.map(z => z.util ?? 0)) - D.utilMax) > 1e-9 * Math.max(1, D.utilMax)) { bad++; console.log('TOOL UTIL', tag, Z.map(z => z.util), D.utilMax); }
  return Z;
}
const B = { mat: { family: 'solid', cls: 'C24' }, sc: 1, b: 47, h: 200, n: 1, clear: 3800, lb: 100, aOut: 0, spacing: 400, ksys: true, sw: true, cat: 'A', combo: '6.10',
  loads: [{ case: 'G', form: 'area', w: 0.5 }, { case: 'Q', form: 'area', w: 1.5 }], restraint: { mode: 'top' }, notch: null, defl: { inst: 300, ceiling: true }, vib: null };
beam('base', B);
beam('6.10a/b, snow, two variable actions', { ...B, combo: '6.10ab', loads: [...B.loads, { case: 'S', form: 'line', w: 0.4 }] });
beam('wind uplift reverses, held at the ends', { ...B, cat: 'H', restraint: { mode: 'ends', level: 'top' }, loads: [{ case: 'G', form: 'line', w: 0.3 }, { case: 'Q', form: 'line', w: 0.25 }, { case: 'W', form: 'area', w: 2.4, up: true }] });
beam('held at the ends, load on the bottom edge', { ...B, restraint: { mode: 'ends', level: 'bottom' } });
beam('held at the ends, load at the centroid', { ...B, restraint: { mode: 'ends', level: 'centroid' } });
beam('l_ef given', { ...B, restraint: { mode: 'lef', lef: 3000 } });
beam('a point load at mid-span, held at the ends', { ...B, restraint: { mode: 'ends', level: 'top' }, sw: false, loads: [{ case: 'Q', form: 'point', w: 3, a: 1.95 }] });
beam('a point load and a part load', { ...B, loads: [...B.loads, { case: 'G', form: 'point', w: 1.2, a: 1.1 }, { case: 'Q', form: 'partial', w: 1.5, a: 0.5, b: 2.2 }] });
beam('part loads with uplift (both signs)', { ...B, restraint: { mode: 'ends', level: 'top' }, loads: [{ case: 'G', form: 'partial', w: 0.4, a: 0, b: 1.5 }, { case: 'W', form: 'partial', w: 3, a: 1.5, b: 3.9, up: true }] });
beam('a notch', { ...B, b: 63, h: 225, notch: { hn: 40, x: 120 } });
beam('plies, glulam', { ...B, mat: { family: 'glulam', cls: 'GL24h' }, n: 2, b: 90, h: 360, clear: 6500, lb: 150, loads: [{ case: 'G', form: 'line', w: 3 }, { case: 'Q', form: 'line', w: 4 }] });
beam('hardwood, held at the ends', { ...B, mat: { family: 'hard', cls: 'D40' }, b: 100, h: 250, clear: 6050, restraint: { mode: 'ends', level: 'top' } });
beam('a declared product, held at the ends', { ...B, mat: { family: 'other', props: { name: 'LVL', fmk: 44, fvk: 4.1, fc90k: 6, E0mean: 13800, E005: 11600, Gmean: 600, G005: 400, rhomean: 510, gM: 1.2, kcr: 1, s: 0.15 } }, b: 45, h: 240, restraint: { mode: 'ends', level: 'top' } });
beam('running past the bearing, service class 2', { ...B, sc: 2, aOut: 40, ceiling: false, defl: { inst: 250, ceiling: false } });
beam('floor vibration', { ...B, vib: { m: 40, B: 4, tdeck: 22, Edeck: 4930, strut: true, kamp: 1.05 } });
beam('floor vibration, a long span', { ...B, b: 75, h: 250, clear: 4600, vib: { m: 45, B: 5, tdeck: 18, Edeck: 4000, strut: false, kamp: 1.05 } });
beam('no self-weight, no variable action', { ...B, sw: false, loads: [{ case: 'G', form: 'line', w: 1 }] });
// ---------- random ----------
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 80; t++) {
  const fam = pick(['solid', 'solid', 'glulam', 'hard']), cls = pick(fam === 'solid' ? ['C16', 'C24', 'C30'] : fam === 'glulam' ? ['GL24h', 'GL28c'] : ['D30', 'D40']);
  const loads = [{ case: 'G', form: pick(['area', 'line']), w: 0.3 + rnd() }];
  if (rnd() < 0.8) loads.push({ case: 'Q', form: pick(['area', 'line', 'point', 'partial']), w: 0.5 + 2 * rnd(), a: 0.3 + rnd(), b: 2 + rnd() });
  if (rnd() < 0.3) loads.push({ case: 'S', form: 'line', w: 0.2 + rnd() });
  if (rnd() < 0.3) loads.push({ case: 'W', form: pick(['area', 'line']), w: 0.3 + rnd(), up: rnd() < 0.6 });
  const mode = pick(['top', 'ends', 'lef', 'both']);
  beam(`random ${t}`, { ...B, mat: { family: fam, cls }, sc: pick([1, 2, 3]), b: pick([38, 47, 63, 75, 100]), h: pick([150, 175, 200, 225, 250, 300]), n: pick([1, 1, 2]), clear: 2500 + 3000 * rnd(), lb: pick([75, 100, 150]), aOut: pick([0, 0, 50]),
    ksys: rnd() < 0.5, sw: rnd() < 0.7, cat: pick(['A', 'B', 'C', 'E']), combo: pick(['6.10', '6.10ab']), loads, restraint: { mode, level: pick(['top', 'centroid', 'bottom']), lef: 2000 + 2000 * rnd() },
    notch: rnd() < 0.2 ? { hn: 20 + 20 * rnd(), x: 50 + 100 * rnd() } : null, defl: { inst: pick([300, 360]), ceiling: rnd() < 0.5 }, vib: rnd() < 0.3 ? { m: 30 + 20 * rnd(), B: 3 + 3 * rnd(), tdeck: 18 + 4 * rnd(), Edeck: 4000 + 1000 * rnd(), strut: rnd() < 0.5, kamp: 1.05 } : null });
}
console.log(`${beams} beams, ${zones} parts: ${[...kinds].join(', ')}`);
console.log(`\n${n - bad}/${n} Timber Beam values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
