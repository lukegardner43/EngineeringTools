// Concealed Plate Glulam Connections: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node
// test_calcpad.js). Every part (the most loaded fastener at its angle to the grain with the Johansen modes of each shear
// plane; each row along the grain; the timber: splitting, shear, block shear, the net section; the spacings; the plates)
// is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: one, two and
// three slotted-in plates and plates outside, dowels and bolts, shear with a moment, tension, a fastener left out, a
// single fastener, and 100 random joints. Every check must be in a part with its utilisation; no chip in error.
const { GlulamPlate: GP, CalcScript, GlulamPlateScript } = require('./load.js');
const K = require('../calcpad/zones.js').checker(CalcScript, 'Concealed Plate Glulam Connections');
function joint(tag, inp) {
  let D; try { D = GP.design(inp); } catch (e) { if (!/^random/.test(tag)) console.log('THROWS', tag, e.message); return null; }
  K.run(tag, GlulamPlateScript.zones(D), D.checks, id => GlulamPlateScript.ZONE[id], D.utilMax);
  return D;
}
const B = { mat: { family: 'glulam', cls: 'GL24h' }, sc: 1, b: 140, h: 450, dur: 'medium', plates: { arr: 'inside', n: 1, ts: 10, slot: 12, grade: 'S275', holeOK: true, e1p: 30, e2p: 30 },
  fast: { kind: 'dowel', d: 12, fu: 410 }, layout: { m: 3, n: 4, a1: 84, a2: 60, a3: 100, a4: 60 }, act: { V: 30, N: 0, g: 20 } };
joint('base', B);
joint('bolts', { ...B, fast: { kind: 'bolt', d: 12, fu: 400, dw: 36 } });
joint('two plates', { ...B, b: 200, plates: { ...B.plates, n: 2 } });
joint('three plates, t_2 given', { ...B, b: 240, plates: { ...B.plates, n: 3, t2: 50 } });
joint('plates outside, bolts', { ...B, plates: { arr: 'outside', ts: 12, grade: 'S355', holeOK: true, hp: 300, e1p: 40, e2p: 40 }, fast: { kind: 'bolt', d: 16, fu: 800 } });
joint('tension and shear, e given, a moment', { ...B, act: { V: 20, N: 40, e: 120, M: 2 } });
joint('tension only', { ...B, act: { V: 0, N: 80, g: 0 } });
joint('downward shear', { ...B, act: { V: -25, N: 0, g: 30 } });
joint('a fastener left out', { ...B, layout: { ...B.layout, omit: [[0, 0]] } });
joint('one fastener, no moment', { ...B, layout: { m: 1, n: 1, a3: 100, a4: 200 }, act: { V: 5, N: 0, e: 0 } });
joint('loose holes in thick plates', { ...B, b: 200, plates: { ...B.plates, n: 2, ts: 15, holeOK: false } });
joint('solid timber, outside, short', { mat: { family: 'solid', cls: 'C24' }, sc: 2, b: 72, h: 294, dur: 'short', plates: { arr: 'outside', ts: 12, grade: 'S275', holeOK: true, hp: 294, e1p: 40, e2p: 40 }, fast: { kind: 'bolt', d: 12, fu: 400 }, layout: { m: 2, n: 3, a1: 80, a2: 70, a3: 90, a4: 60 }, act: { V: 12, N: 6, g: 30 } });
let seed = 29; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 100; t++) {
  const d = pick([8, 10, 12, 16, 20]), np = pick([1, 1, 2, 3]), inside = rnd() < 0.8;
  joint(`random ${t}`, { mat: { family: pick(['glulam', 'glulam', 'solid']), cls: pick(['GL24h', 'GL28c', 'C24']) }, sc: pick([1, 2]), b: inside ? 100 + 50 * np + 40 * rnd() : 90 + 60 * rnd(), h: 300 + 400 * rnd(), dur: pick(['permanent', 'medium', 'short']),
    plates: inside ? { arr: 'inside', n: np, ts: pick([8, 10, 12, 15]), slot: 0, grade: pick(['S275', 'S355']), holeOK: rnd() < 0.8, e1p: 2.5 * d, e2p: 2.5 * d } : { arr: 'outside', ts: pick([8, 10, 12, 15]), grade: 'S275', holeOK: true, e1p: 2.5 * d, e2p: 2.5 * d },
    fast: rnd() < 0.6 ? { kind: 'dowel', d, fu: pick([360, 410, 470]) } : { kind: 'bolt', d, fu: pick([400, 800]) },
    layout: { m: pick([1, 2, 3]), n: pick([2, 3, 4]), a1: 7 * d, a2: 5 * d, a3: 7 * d + 20, a4: 4 * d + 20 }, act: { V: 40 * rnd() * (rnd() < 0.2 ? -1 : 1), N: rnd() < 0.4 ? 60 * rnd() : 0, g: 50 * rnd(), M: rnd() < 0.2 ? 3 * rnd() : 0 } });
}
K.done('joints');
