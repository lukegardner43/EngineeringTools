// Timber Racking Wall: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part (racking: the sheathing nail by the Johansen modes with the rope effect, or as given, f_p,d,t, K_opening,
// the wind from the storeys above, K_i,w, F_i,v,Rd and the deflection limit; sliding; compression at the leeward end) is
// pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: set cases
// (smooth and ring-shank nails into OSB and plywood, a short nail without withdrawal, the capacity given, a second layer
// both ways, plasterboard, openings tall and shallow, storeys above, uplift, no withdrawal capacity, the leeward check
// left out) and 80 random walls. Every check must be in a part with its utilisation; no chip in error.
const { TimberRacking: TR, CalcScript, TimberRackingScript } = require('./load.js');
const K = require('../calcpad/zones.js').checker(CalcScript, 'Timber Racking Wall');
const ZONE = { rack: 'rack', defl: 'rack', slide: 'slide', lee: 'lee' };
function wall(tag, inp) {
  let D; try { D = TR.design(inp); } catch (e) { return null; }
  K.run(tag, TimberRackingScript.zones(D), D.checks, id => ZONE[id], D.utilMax);
  return D;
}
const B = { L: 3.6, H: 2.4, sc: 2, stud: { cls: 'C16', b: 38, h: 140, s: 600, rail: 38 }, sheath: { kind: 'OSB/3', t: 9, fastener: { mode: 'calc', type: 'smooth', d: 3.1, len: 50, fu: 600 }, s: 150 },
  second: { mode: 'none' }, openings: [], wind: { R: 6, above: [], Hf: 0.3 }, vert: { g: 4, V: 2, up: 0, q: 3, cat: 'A' }, base: { fwd: 3, fix: 0 }, lee: { n: 2, small: false } };
wall('smooth nails, OSB', B);
wall('ring-shank, plywood, service class 1', { ...B, sc: 1, sheath: { ...B.sheath, kind: 'ply', t: 12, fastener: { mode: 'calc', type: 'ring', d: 2.8, len: 50, fu: 600, dh: 6.5 } } });
wall('a short nail: no withdrawal', { ...B, sheath: { ...B.sheath, fastener: { mode: 'calc', type: 'smooth', d: 3.1, len: 30 } } });
wall('the capacity given', { ...B, sheath: { ...B.sheath, fastener: { mode: 'given', Ffd: 0.5 } } });
wall('the same layer on the opposite face', { ...B, second: { mode: 'oppSame' } });
wall('a stronger second layer', { ...B, second: { mode: 'sameSide', Ffd: 1.2, s: 75 } });
wall('plasterboard', { ...B, sheath: { kind: 'pb', pb: 'pb125x2' } });
wall('openings, tall and shallow', { ...B, L: 6, openings: [{ w: 1.2, h: 1.2, sill: 0.9, x: 1 }, { w: 1.5, h: 0.5, sill: 1.6, x: 3.5 }] });
wall('two storeys above, uplift', { ...B, wind: { R: 5, above: [{ R: 4, H: 2.6 }, { R: 3, H: 2.6 }], Hf: 0.3 }, vert: { g: 6, V: 3, up: 1, q: 2, cat: 'A' } });
wall('no withdrawal capacity', { ...B, base: { fwd: 0, fix: 2 } });
wall('the leeward check left out', { ...B, lee: { n: 2, small: true } });
wall('no stabilising moment, no withdrawal', { ...B, vert: { g: 0, V: 0, up: 0, q: 0 }, base: { fwd: 0, fix: 0 } });
let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 80; t++) {
  const kind = pick(['OSB/3', 'OSB/4', 'ply', 'ply', 'pb']);
  wall(`random ${t}`, { ...B, L: 1.5 + 5 * rnd(), H: 2.4 + 0.6 * rnd(), sc: pick([1, 2]), stud: { cls: pick(['C16', 'C24']), b: pick([38, 44, 47]), h: pick([89, 140]), s: pick([400, 600]), rail: 38 },
    sheath: { kind, pb: pick(['pb125', 'pb15', 'pb125x2', 'pb15x2', 'sep30']), t: pick([9, 11, 12, 15, 18]), rhok: rnd() < 0.2 ? 500 : undefined, s: pick([50, 75, 100, 150]),
      fastener: rnd() < 0.2 ? { mode: 'given', Ffd: 0.3 + 0.5 * rnd() } : { mode: 'calc', type: pick(['smooth', 'ring']), d: pick([2.8, 3.1, 3.35]), len: pick([40, 50, 65]), fu: 600, dh: rnd() < 0.3 ? 7 : undefined } },
    second: rnd() < 0.3 ? { mode: pick(['oppSame', 'oppDiff', 'sameSide']), Ffd: 0.4 + rnd(), s: pick([75, 150]) } : { mode: 'none' },
    openings: rnd() < 0.3 ? [{ w: 0.6 + rnd(), h: 0.4 + rnd(), sill: 0.8, x: 0.5 }] : [], wind: { R: 2 + 10 * rnd(), above: rnd() < 0.4 ? [{ R: 2 + 5 * rnd(), H: 2.5 }] : [], Hf: 0.3 },
    vert: { g: 10 * rnd(), V: 5 * rnd(), up: rnd() < 0.3 ? 2 * rnd() : 0, q: 5 * rnd(), cat: pick(['A', 'B']) }, base: { fwd: rnd() < 0.8 ? 5 * rnd() : 0, fix: rnd() < 0.3 ? 2 : 0 }, lee: { n: pick([0, 1, 2, 3]), small: rnd() < 0.3 } });
}
K.done('walls');
