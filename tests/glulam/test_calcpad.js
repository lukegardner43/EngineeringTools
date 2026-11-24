// Glulam Beams: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part (the beam; bending at the section that governs with k_m,α, k_crit and the axial term in curved legs; shear;
// the apex zone: bending, tension perpendicular to the grain, shear with tension, radial compression; bearing square to
// the grain or at an angle; deflection with the pre-camber) is pasted into CalcPad (headless, tests/calcpad) and every
// value CalcPad works out must be the tool's own: each profile (straight, single and double tapered, curved, pitched
// cambered), restraints (top held, both, at the supports, bracing), wind uplift with hogging, point and part loads, LVL,
// and 100 random beams. Every check must be in a part with its utilisation; no chip may show an error.
const { GlulamBeam: GB, CalcScript, GlulamBeamScript } = require('./load.js');
const K = require('../calcpad/zones.js').checker(CalcScript, 'Glulam Beams');
const ZONE = { bend: 'bend', shear: 'shear', apexM: 'apexM', apexT: 'apexT', apexTV: 'apexTV', apexC: 'apexC', bearing: 'bearing', winst: 'deflection', wfin: 'deflection' };
function beam(tag, inp) {
  let D; try { D = GB.design(inp); } catch (e) { if (!/^random/.test(tag)) console.log('THROWS', tag, e.message); return null; }
  K.run(tag, GlulamBeamScript.zones(D), D.checks, id => ZONE[id], D.utilMax);
  return D;
}
const B = { mat: { family: 'glulam', cls: 'GL24h' }, sc: 1, L: 16, b: 160, lb: 200, hs: 600, h1: 900, hap: 1100, h: 960, alpha: 10, beta: 5, rin: 15, t: 33, spacing: 5, sw: true, ksys: false, cat: 'H', combo: '6.10',
  loads: [{ case: 'G', form: 'area', w: 0.75 }, { case: 'S', form: 'area', w: 0.6 }], restraint: { mode: 'lef', lef: 2.5 }, defl: { inst: 300, fin: 250, camber: 0 } };
for (const shape of ['straight', 'single', 'double', 'curved', 'pitched']) {
  beam(shape, { ...B, shape });
  beam(`${shape}, held at the supports, uplift`, { ...B, shape, restraint: { mode: 'ends' }, loads: [...B.loads, { case: 'W', form: 'area', w: 1.6, up: true }] });
  beam(`${shape}, top held, a point load, camber`, { ...B, shape, restraint: { mode: 'top' }, loads: [...B.loads, { case: 'Q', form: 'point', w: 8, a: 6 }], defl: { inst: 300, fin: 250, camber: 20 } });
  beam(`${shape}, both held, a part load`, { ...B, shape, restraint: { mode: 'both' }, loads: [...B.loads, { case: 'Q', form: 'partial', w: 3, a: 2, b: 9 }], sc: 2, combo: '6.10ab' });
}
beam('straight LVL', { ...B, shape: 'straight', mat: { family: 'other', props: { name: 'LVL', fmk: 44, ft0k: 35, ft90k: 0.6, fc0k: 40, fc90k: 6, fvk: 4.1, E0mean: 13800, E005: 11600, Gmean: 600, G005: 400, rhomean: 510, gM: 1.2, kcr: 1, s: 0.15 } }, h: 400, L: 7 });
let seed = 17; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 100; t++) {
  const shape = pick(['straight', 'single', 'double', 'curved', 'pitched']), L = 8 + 16 * rnd();
  const loads = [{ case: 'G', form: 'area', w: 0.3 + rnd() }];
  if (rnd() < 0.7) loads.push({ case: pick(['S', 'Q']), form: pick(['area', 'line', 'point', 'partial']), w: 0.5 + 2 * rnd(), a: L * 0.2, b: L * 0.6 });
  if (rnd() < 0.4) loads.push({ case: 'W', form: 'area', w: 0.3 + rnd(), up: rnd() < 0.7 });
  beam(`random ${t}`, { ...B, shape, mat: { family: 'glulam', cls: pick(['GL24h', 'GL28h', 'GL30c', 'GL32h']) }, sc: pick([1, 2]), L, b: pick([115, 140, 160, 200]), hs: 400 + 300 * rnd(), h1: 900 + 500 * rnd(), hap: 900 + 600 * rnd(), h: 500 + 700 * rnd(),
    alpha: 5 + 10 * rnd(), beta: 2 + 5 * rnd(), rin: 10 + 30 * rnd(), t: pick([33, 40, 45]), spacing: 3 + 4 * rnd(), sw: rnd() < 0.8, ksys: rnd() < 0.3, cat: 'H', combo: pick(['6.10', '6.10ab']), loads,
    restraint: { mode: pick(['top', 'both', 'ends', 'lef']), lef: 1 + 4 * rnd() }, defl: { inst: 300, fin: 250, camber: rnd() < 0.3 ? 30 * rnd() : 0 } });
}
K.done('beams');
