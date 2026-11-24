// Flitch Beams: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part (the beam and its loads; each check for its governing combination: timber bending, shear and bearing, the
// plate in bending and shear, the bolts along the beam and at the supports, splitting; the spacings of GD9; deflection)
// is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: set cases
// (GD9's example sizes, uplift, lateral buckling, point and part loads, self-weight, S355, grade 8.8, one bolt at a
// support, a deep and a shallow plate) and 80 random beams. Every check must be in a part with its utilisation.
const { FlitchBeam: F, CalcScript, FlitchBeamScript } = require('./load.js');
const K = require('../calcpad/zones.js').checker(CalcScript, 'Flitch Beams');
const ZONE = id => (FlitchBeamScript.IDS.includes(id) ? id : ['sMax', 'sMin', 'eT', 'eS', 'pE'].includes(id) ? 'spacing' : 'deflection');
function beam(tag, inp) {
  let D; try { D = F.design(inp); } catch (e) { if (!/^random/.test(tag)) console.log('THROWS', tag, e.message); return null; }
  K.run(tag, FlitchBeamScript.zones(D), D.checks, ZONE, D.utilMax);
  return D;
}
const B = { mat: { family: 'solid', cls: 'C24' }, sc: 1, b: 75, h: 225, tp: 12, hp: 200, grade: 'S275', clear: 4500, lb: 100, sw: false, cat: 'A',
  loads: [{ case: 'G', form: 'line', w: 1.5 }, { case: 'Q', form: 'line', w: 3.6 }], restraint: { mode: 'top' }, bolt: { d: 12, grade: '4.6', s: 450, nEnd: 2 }, defl: { inst: 300, ceiling: true } };
beam('base', B);
beam('self-weight, area loads', { ...B, sw: true, spacing: 2000, loads: [{ case: 'G', form: 'area', w: 0.8 }, { case: 'Q', form: 'area', w: 1.5 }] });
beam('point and part loads', { ...B, loads: [...B.loads, { case: 'G', form: 'point', w: 6, a: 1.2 }, { case: 'Q', form: 'point', w: 10, a: 1.2 }, { case: 'Q', form: 'partial', w: 2, a: 0.5, b: 2.5 }] });
beam('held at the ends, uplift', { ...B, cat: 'H', restraint: { mode: 'ends' }, loads: [{ case: 'G', form: 'line', w: 0.6 }, { case: 'Q', form: 'line', w: 0.75 }, { case: 'W', form: 'line', w: 4, up: true }] });
beam('l_ef given, S355, grade 8.8, three support bolts', { ...B, grade: 'S355', tp: 20, hp: 300, h: 325, restraint: { mode: 'lef', lef: 2000 }, bolt: { d: 16, grade: '8.8', s: 600, nEnd: 3 } });
beam('one bolt at a support, glulam', { ...B, mat: { family: 'glulam', cls: 'GL24h' }, bolt: { d: 12, grade: '4.6', s: 450, nEnd: 1 } });
beam('a shallow plate', { ...B, hp: 120, sc: 2, defl: { inst: 300, ceiling: false } });
beam('two support bolts side by side', { ...B, h: 150, hp: 120, bolt: { d: 16, grade: '4.6', s: 300, nEnd: 2 } });
let seed = 19; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 80; t++) {
  const h = pick([200, 225, 250, 300]), loads = [{ case: 'G', form: pick(['line', 'area']), w: 0.5 + 2 * rnd() }];
  if (rnd() < 0.8) loads.push({ case: 'Q', form: pick(['line', 'area', 'point', 'partial']), w: 1 + 5 * rnd(), a: 1 + rnd(), b: 3 });
  if (rnd() < 0.3) loads.push({ case: 'S', form: 'line', w: 0.5 + rnd() });
  if (rnd() < 0.3) loads.push({ case: 'W', form: 'line', w: 0.5 + 2 * rnd(), up: rnd() < 0.6 });
  beam(`random ${t}`, { ...B, mat: { family: pick(['solid', 'solid', 'glulam', 'hard']), cls: pick(['C24', 'C16', 'GL24h', 'D30']) }, sc: pick([1, 2]), b: pick([47, 63, 75, 100]), h, tp: pick([8, 10, 12, 15, 20]), hp: h - pick([15, 25, 50]),
    grade: pick(['S275', 'S355']), clear: 3000 + 3000 * rnd(), lb: pick([100, 150]), aOut: pick([0, 0, 50]), sw: rnd() < 0.5, spacing: 2000, cat: pick(['A', 'B']), combo: pick(['6.10', '6.10ab']), loads,
    restraint: { mode: pick(['top', 'ends', 'lef']), lef: 2000 + 2000 * rnd() }, bolt: { d: pick([10, 12, 16, 20]), grade: pick(['4.6', '8.8']), s: pick([300, 450, 600]), nEnd: pick([1, 2, 3, 4]) }, defl: { inst: 300, ceiling: rnd() < 0.5 } });
}
K.done('beams');
