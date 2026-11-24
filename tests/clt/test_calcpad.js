// CLT Panels: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part (the net section as sums over the layers, κ given, GA_s; a floor: bending, shear, rolling shear, bearing,
// deflection, vibration with b_ef; a wall: N_cr with shear, k_c, compression and bending down the height, the top, shear,
// rolling shear, bearing) is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the
// tool's own: floors along and across, 3, 5 and 7 layers, point loads, uplift, k_sys, service class 2, a declared product;
// walls with and without wind, eccentricity, self-weight and bearing; the section alone; and 80 random panels.
const { CLT, CalcScript, CLTScript } = require('./load.js');
const K = require('../calcpad/zones.js').checker(CalcScript, 'CLT Panels');
const alt = ts => ts.map((t, i) => ({ t, o: i % 2 ? 90 : 0 }));
function run(tag, f, inp) {
  let D; try { D = f(inp); } catch (e) { if (!/^random/.test(tag)) console.log('THROWS', tag, e.message); return null; }
  K.run(tag, CLTScript.zones(D), D.checks, id => CLTScript.ZONE[id] || id, D.kind === 'section' ? null : D.utilMax);
  return D;
}
const F = { mat: { cls: 'C24' }, sc: 1, layers: alt([40, 20, 40, 20, 40]), L: 4500, lb: 100, loads: [{ case: 'G', form: 'area', w: 1.5 }, { case: 'Q', form: 'area', w: 1.5 }], cat: 'A', combo: '6.10', vib: { B: 4, zeta: 0.02 } };
run('floor', CLT.floor, F);
run('floor, k_sys, service class 2, 6.10a/b', CLT.floor, { ...F, ksys: true, sc: 2, combo: '6.10ab' });
run('floor, a point load, no self-weight', CLT.floor, { ...F, loads: [{ case: 'G', form: 'point', w: 2, a: 2.25 }, { case: 'Q', form: 'partial', w: 2, a: 1, b: 3 }], sw: false, vib: null });
run('floor across', CLT.floor, { ...F, dir: 'cross', L: 2000, vib: null });
run('floor, 3 layers, snow and uplift', CLT.floor, { ...F, layers: alt([30, 40, 30]), cat: 'H', loads: [{ case: 'G', form: 'area', w: 0.6 }, { case: 'S', form: 'area', w: 0.8 }, { case: 'W', form: 'area', w: 1.2, up: true }], vib: null });
run('floor, 7 layers, long', CLT.floor, { ...F, layers: alt([30, 20, 30, 20, 30, 20, 30]), L: 7000, vib: { B: 6, zeta: 0.025 } });
run('floor, a declared product', CLT.floor, { ...F, mat: { family: 'other', props: { name: 'X', fmk: 24, ft0k: 14, fc0k: 21, fvk: 4, fRk: 1.1, fc90k: 2.5, E0mean: 12000, E005: 10000, Gmean: 690, GR: 50, rhok: 350, rhomean: 420, gM: 1.25 } } });
const W = { mat: { cls: 'C24' }, sc: 1, layers: alt([30, 40, 30]), H: 2700, kef: 1, top: [{ case: 'G', w: 15 }, { case: 'Q', w: 6 }], e: 15, wind: 0.8, cat: 'A', combo: '6.10', bearing: { on: true } };
run('wall', CLT.wall, W);
run('wall, no wind, no self-weight', CLT.wall, { ...W, wind: 0, sw: false, bearing: null });
run('wall, snow, 5 layers, k_ef 0.85', CLT.wall, { ...W, layers: alt([20, 20, 20, 20, 20]), kef: 0.85, top: [{ case: 'G', w: 20 }, { case: 'S', w: 5 }], e: 0 });
run('the section', CLT.properties, { mat: { cls: 'C24' }, layers: alt([40, 20, 40, 20, 40]) });
run('the section across', CLT.properties, { mat: { cls: 'C24' }, layers: alt([40, 20, 40, 20, 40]), dir: 'cross' });
let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 80; t++) {
  const layers = alt(pick([[30, 40, 30], [40, 20, 40, 20, 40], [20, 20, 20, 20, 20], [30, 20, 30, 20, 30, 20, 30], [40, 40, 40]]));
  if (rnd() < 0.6) {
    const loads = [{ case: 'G', form: 'area', w: 0.5 + 2 * rnd() }];
    if (rnd() < 0.8) loads.push({ case: 'Q', form: pick(['area', 'area', 'line', 'point']), w: 1 + 3 * rnd(), a: 1.5 });
    if (rnd() < 0.3) loads.push({ case: 'S', form: 'area', w: 0.5 + rnd() });
    run(`random floor ${t}`, CLT.floor, { ...F, mat: { cls: pick(['C16', 'C24']) }, sc: pick([1, 2]), layers, dir: rnd() < 0.15 ? 'cross' : 'main', L: 3000 + 4000 * rnd(), lb: pick([80, 100, 150]), loads, cat: pick(['A', 'B', 'C']), combo: pick(['6.10', '6.10ab']), ksys: rnd() < 0.3, sw: rnd() < 0.8, vib: rnd() < 0.5 ? { B: 3 + 4 * rnd(), zeta: 0.02 } : null });
  } else run(`random wall ${t}`, CLT.wall, { ...W, mat: { cls: pick(['C16', 'C24']) }, sc: pick([1, 2]), layers, H: 2400 + 1200 * rnd(), kef: pick([1, 0.85]), top: [{ case: 'G', w: 5 + 30 * rnd() }, ...(rnd() < 0.8 ? [{ case: pick(['Q', 'S']), w: 10 * rnd() }] : [])], e: pick([0, 10, 20, 30]), wind: rnd() < 0.6 ? 0.3 + rnd() : 0, combo: pick(['6.10', '6.10ab']), sw: rnd() < 0.7, bearing: { on: rnd() < 0.5 } });
}
K.done('panels');
