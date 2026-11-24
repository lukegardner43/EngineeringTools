// Timber Member: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part (the member and its actions; each check for its governing combination: compression with bending about each
// axis, tension or bending, lateral torsional buckling, shear) is pasted into CalcPad (headless, tests/calcpad) and every
// value CalcPad works out must be the tool's own: set cases (a stocky post, a slender one, eccentricity both ways, a tie
// with lost area, a tie under wind reversal, a lateral load, lateral buckling held at the ends and with l_ef given, held
// about z–z, glulam, hardwood, a declared product, self-weight) and 100 random members. Every check of the tool must be in
// a part with its utilisation; no chip may show an error or a unit CalcPad cannot read; the whole opens as one check.
const { TimberMember: TM, CalcScript, TimberMemberScript } = require('./load.js');
const K = require('../calcpad/zones.js').checker(CalcScript, 'Timber Member');
function member(tag, inp) {
  let D; try { D = TM.design(inp); } catch (e) { return null; }
  K.run(tag, TimberMemberScript.zones(D), D.checks, id => id, D.utilMax);
  return D;
}
const B = { mat: { family: 'solid', cls: 'C24' }, sc: 1, b: 100, h: 150, L: 3000, kY: 1, kZ: 1, ltb: { mode: 'held' }, loss: 0, ksys: false, sw: false, ez: 0, ey: 0, cat: 'A', combo: '6.10',
  loads: [{ case: 'G', N: 20 }, { case: 'Q', N: 30 }] };
member('base', B);
member('stocky', { ...B, b: 200, h: 200, L: 600 });
member('stocky with moments', { ...B, b: 200, h: 200, L: 600, loads: [{ case: 'G', N: 20, My: 2, Mz: 1 }, { case: 'Q', N: 30 }] });
member('eccentric both ways, self-weight', { ...B, ez: 25, ey: 10, sw: true });
member('a tie with lost area', { ...B, b: 47, h: 125, L: 2000, loss: 10, loads: [{ case: 'G', N: -2.5 }, { case: 'Q', N: -3 }] });
member('wind reversal', { ...B, cat: 'H', loads: [{ case: 'G', N: 5 }, { case: 'W', N: -12 }, { case: 'Q', N: 3 }] });
member('a lateral load, held at the ends', { ...B, ltb: { mode: 'ends' }, loads: [{ case: 'G', N: 15 }, { case: 'W', w: 1.2 }] });
member('a lateral load in tension, l_ef given', { ...B, ltb: { mode: 'lef', lef: 2400 }, loads: [{ case: 'G', N: -4 }, { case: 'W', N: -6, w: 1.5 }] });
member('held about z–z', { ...B, b: 47, h: 150, L: 2700, zHeld: true, loads: [{ case: 'G', N: 4 }, { case: 'Q', N: 6 }, { case: 'W', w: 0.6 }] });
member('glulam, 6.10a/b', { ...B, mat: { family: 'glulam', cls: 'GL28c' }, combo: '6.10ab', b: 140, h: 270, L: 5000, ltb: { mode: 'ends' }, loads: [{ case: 'G', N: 40, My: 5 }, { case: 'Q', N: 60, My: 8 }, { case: 'S', N: 10 }] });
member('hardwood', { ...B, mat: { family: 'hard', cls: 'D40' }, kY: 0.85, kZ: 0.7 });
member('a declared product', { ...B, mat: { family: 'other', props: { name: 'LVL', fmk: 44, ft0k: 35, fc0k: 40, fvk: 4.1, fc90k: 6, E0mean: 13800, E005: 11600, Gmean: 600, G005: 400, rhomean: 510, gM: 1.2, kcr: 1, s: 0.15 } }, b: 45, h: 200, ltb: { mode: 'ends' }, loads: [{ case: 'G', N: 5, My: 1 }, { case: 'Q', N: -8, My: 2 }] });
member('bending alone', { ...B, loads: [{ case: 'G', My: 3 }, { case: 'Q', My: 4, Mz: 1 }] });
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 100; t++) {
  const fam = pick(['solid', 'solid', 'glulam', 'hard']), cls = pick(fam === 'solid' ? ['C16', 'C24', 'C30'] : fam === 'glulam' ? ['GL24h', 'GL28c'] : ['D30', 'D40']);
  const r = () => (rnd() < 0.5 ? 0 : Math.round(rnd() * 100) / 10), loads = [{ case: 'G', N: 2 + 30 * rnd() * (rnd() < 0.15 ? -1 : 1), My: r() / 3, Mz: r() / 5 }];
  if (rnd() < 0.8) loads.push({ case: 'Q', N: 40 * rnd() * (rnd() < 0.15 ? -1 : 1), My: r() / 3, w: rnd() < 0.2 ? rnd() : 0 });
  if (rnd() < 0.3) loads.push({ case: 'S', N: 10 * rnd() });
  if (rnd() < 0.4) loads.push({ case: 'W', N: rnd() < 0.5 ? -10 * rnd() : 0, w: 2 * rnd() });
  member(`random ${t}`, { ...B, mat: { family: fam, cls }, sc: pick([1, 2, 3]), b: pick([47, 63, 75, 100, 150, 200]), h: pick([100, 150, 200, 250]), L: 1000 + 4000 * rnd(), kY: pick([1, 0.85, 0.7]), kZ: pick([1, 0.5]),
    zHeld: rnd() < 0.15, ltb: { mode: pick(['held', 'ends', 'lef']), lef: 1500 + 2000 * rnd() }, loss: pick([0, 0, 10, 20]), ksys: rnd() < 0.5, sw: rnd() < 0.5, ez: pick([0, 0, 20]), ey: pick([0, 0, 10]),
    cat: pick(['A', 'B', 'E', 'H']), combo: pick(['6.10', '6.10ab']), loads });
}
K.done('members');
