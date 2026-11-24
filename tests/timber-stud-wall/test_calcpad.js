// Timber Stud Wall: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part (the stud and its actions per stud; each member check for its governing combination; the sole plate in
// bearing; the lateral deflection under wind) is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad
// works out must be the tool's own: set cases (sheathed, noggings, no restraint; loads per metre and per stud; wind with
// and without the deflection check; uplift; glulam; a plate too thick for k_c,90) and 80 random walls. Every check of the
// tool must be in a part with its utilisation; no chip may show an error or a unit CalcPad cannot read.
const { TimberStudWall: SW, CalcScript, TimberStudWallScript } = require('./load.js');
const K = require('../calcpad/zones.js').checker(CalcScript, 'Timber Stud Wall');
function wall(tag, inp) {
  let D; try { D = SW.design(inp); } catch (e) { return null; }
  K.run(tag, TimberStudWallScript.zones(D), D.checks, id => id, D.utilMax);
  return D;
}
const B = { mat: { family: 'solid', cls: 'C16' }, sc: 2, b: 38, h: 140, s: 600, H: 2700, restraint: 'sheathed', rows: 1, kY: 1, per: 'm', e: 0, ksys: true, cat: 'A', combo: '6.10', tp: 38,
  loads: [{ case: 'G', V: 4 }, { case: 'Q', V: 6 }, { case: 'W', p: 0.8 }], defl: { div: 300 } };
wall('sheathed, per metre, deflection', B);
wall('noggings, 2 rows', { ...B, restraint: 'noggings', rows: 2 });
wall('no restraint, eccentric', { ...B, restraint: 'none', e: 20, b: 47, h: 150 });
wall('per stud, no wind', { ...B, per: 'stud', loads: [{ case: 'G', V: 0.6 }, { case: 'Q', V: 2.4 }], defl: null, cat: 'E' });
wall('wind uplift', { ...B, loads: [{ case: 'G', V: 1 }, { case: 'W', V: -4, p: 0.9 }], defl: { div: 360 } });
wall('snow and imposed, 6.10a/b', { ...B, combo: '6.10ab', loads: [{ case: 'G', V: 4 }, { case: 'Q', V: 3 }, { case: 'S', V: 2 }, { case: 'W', p: 0.6 }] });
wall('glulam, a thick plate', { ...B, mat: { family: 'glulam', cls: 'GL24h' }, b: 66, h: 140, tp: 300 });
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 80; t++) {
  const loads = [{ case: 'G', V: 1 + 6 * rnd() }];
  if (rnd() < 0.8) loads.push({ case: 'Q', V: 8 * rnd() });
  if (rnd() < 0.3) loads.push({ case: 'S', V: 3 * rnd() });
  if (rnd() < 0.7) loads.push({ case: 'W', V: rnd() < 0.3 ? -3 * rnd() : 0, p: 0.3 + rnd() });
  wall(`random ${t}`, { ...B, mat: { family: pick(['solid', 'solid', 'glulam']), cls: pick(['C16', 'C24']) }, sc: pick([1, 2]), b: pick([38, 44, 47, 63]), h: pick([89, 100, 140, 150, 184]), s: pick([400, 600]), H: 2400 + 1500 * rnd(),
    restraint: pick(['sheathed', 'noggings', 'none']), rows: pick([1, 2, 3]), kY: pick([1, 0.85]), per: pick(['m', 'stud']), e: pick([0, 0, 15]), ksys: rnd() < 0.6, cat: pick(['A', 'B']), combo: pick(['6.10', '6.10ab']), tp: pick([38, 44, 47]), loads, defl: rnd() < 0.6 ? { div: pick([300, 360, 500]) } : null });
}
K.done('walls');
