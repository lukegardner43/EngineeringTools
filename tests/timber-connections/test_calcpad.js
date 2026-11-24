// Timber Connections: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part (the joint: the fastener, the embedment strengths, the thicknesses in the equations, the withdrawal for the
// rope effect, the Johansen modes, F_v,Rd, the group and the axial checks; splitting; slip) is pasted into CalcPad
// (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: every joint type (timber, panel and
// steel, single and double shear, a slotted plate), nails smooth and ring-shank, pre-drilled or not, through or from both
// sides, screws (A1 and declared, with head pull-through), bolts (washer under a plate) and dowels, plates thin, thick and
// between, an angle to the grain, splitting and slip, and 400 random joints (about a third of them valid). No chip may show an error or a unit CalcPad
// cannot read.
const { TimberConnection: TC, CalcScript, TimberConnectionScript } = require('./load.js');
const K = require('../calcpad/zones.js').checker(CalcScript, 'Timber Connections');
const ZONE = { lat: 'joint', ax: 'joint', comb: 'joint', split: 'split' };
function joint(tag, inp) {
  let D; try { D = TC.design(inp); } catch (e) { if (!/^random/.test(tag)) console.log("THROWS", tag, e.message); return null; }
  K.run(tag, TimberConnectionScript.zones(D), D.checks, id => ZONE[id], D.utilMax);
  return D;
}
joint('P&K plywood to C18, smooth nails', { type: 'pt1', sc: 2, dur: 'medium', fast: { kind: 'nail', nail: 'smooth', d: 3, len: 50, fu: 650 }, m1: { panel: 'ply', t: 12, rhok: 630 }, m2: { cls: 'C18', t: 50 }, layout: { n: 6, m: 1, a1: 42 }, load: { Fv: 2.8 } });
joint('wet, axial only', { type: 'pt1', sc: 3, dur: 'instantaneous', fast: { kind: 'nail', nail: 'smooth', d: 2.65, len: 40, fu: 600, wet: true }, m1: { panel: 'ply', t: 15, rhok: 550 }, m2: { cls: 'C18', t: 47 }, layout: { n: 28, m: 1, a1: 35 }, load: { Fax: 0.6 } });
joint('screws through a steel plate, lateral and axial', { type: 'st1', sc: 2, dur: 'short', fast: { kind: 'screw', d: 8, d1: 5.6, shank: true, len: 130, fu: 400, lthread: 86.67 }, m1: { steel: true, t: 8, clear: 0 }, m2: { cls: 'C22', t: 100 }, layout: { n: 2, m: 2, a1: 80, a2: 36 }, load: { Fv: 10.61, Fax: 10.61 } });
joint('bolts in double shear at 30°, splitting', { type: 'tt2', sc: 2, dur: 'medium', fast: { kind: 'bolt', d: 12, fu: 400 }, m1: { cls: 'C24', t: 47, alpha: 0 }, m2: { cls: 'C24', t: 75, alpha: 30, h: 200, he: 140 }, layout: { n: 3, m: 2, a1: 60, a2: 50, a3: 90, end: 'loaded', a4: 50, edge: 'loaded' }, load: { Fv: 20, mid: true } });
joint('ring nails timber to timber, slip', { type: 'tt1', sc: 1, dur: 'medium', fast: { kind: 'nail', nail: 'ring', d: 4, len: 90, fu: 600 }, m1: { cls: 'C16', t: 38, alpha: 0 }, m2: { cls: 'C24', t: 75, alpha: 90 }, layout: { n: 4, m: 2, a1: 60, a2: 40 }, load: { Fv: 3, Fax: 0.5, Fser: 2 } });
joint('nails through three members', { type: 'tt2', sc: 1, dur: 'short', fast: { kind: 'nail', nail: 'smooth', d: 3.35, len: 125, fu: 600, nailing: 'through' }, m1: { cls: 'C16', t: 38 }, m2: { cls: 'C16', t: 47 }, layout: { n: 5, m: 1, a1: 50 }, load: { Fv: 4 } });
joint('nails from both sides, pre-drilled', { type: 'tt2', sc: 1, dur: 'short', fast: { kind: 'nail', nail: 'smooth', d: 4, len: 75, fu: 600, predrilled: true }, m1: { cls: 'C24', t: 38 }, m2: { cls: 'C24', t: 100 }, layout: { n: 3, m: 1, a1: 50 }, load: { Fv: 3 } });
joint('OSB panels both sides', { type: 'pt2', sc: 1, dur: 'medium', fast: { kind: 'nail', nail: 'ring', d: 3.1, len: 65, fu: 600 }, m1: { panel: 'osb3', t: 18 }, m2: { cls: 'C24', t: 100 }, layout: { n: 4, m: 1, a1: 50 }, load: { Fv: 3 } });
joint('steel plates both sides, bolts thick', { type: 'st2', sc: 2, dur: 'medium', fast: { kind: 'bolt', d: 16, fu: 400 }, m1: { steel: true, t: 20, clear: 1 }, m2: { cls: 'GL24h', family: 'glulam', t: 140 }, layout: { n: 3, m: 1, a1: 90 }, load: { Fv: 60, Fser: 30 } });
joint('steel plates both sides, between thin and thick', { type: 'st2', sc: 2, dur: 'medium', fast: { kind: 'dowel', d: 16, fu: 400 }, m1: { steel: true, t: 12, clear: 0 }, m2: { cls: 'C24', t: 140 }, layout: { n: 2, m: 1, a1: 90 }, load: { Fv: 30 } });
joint('a slotted-in plate, dowels', { type: 'st3', sc: 1, dur: 'short', fast: { kind: 'dowel', d: 12, fu: 360 }, m1: { steel: true, t: 10 }, m2: { cls: 'GL28c', family: 'glulam', t: 70, alpha: 90, h: 400, he: 300 }, layout: { n: 4, m: 2, a1: 60, a2: 40 }, load: { Fv: 40 } });
joint('a steel plate, nails, thin', { type: 'st1', sc: 1, dur: 'medium', fast: { kind: 'nail', nail: 'ring', d: 4, len: 60, fu: 600 }, m1: { steel: true, t: 2, clear: 0 }, m2: { cls: 'C24', t: 100 }, layout: { n: 6, m: 2, a1: 40, a2: 30 }, load: { Fv: 8, Fax: 2 } });
joint('screws A1 with head pull-through', { type: 'tt1', sc: 1, dur: 'medium', fast: { kind: 'screw', d: 8, d1: 5, len: 160, fu: 600, fheadk: 12, dh: 16 }, m1: { cls: 'C24', t: 60 }, m2: { cls: 'C24', t: 140 }, layout: { n: 3, m: 1, a1: 80 }, load: { Fv: 6, Fax: 4 } });
joint('screws declared', { type: 'tt1', sc: 1, dur: 'medium', fast: { kind: 'screw', d: 6, d1: 4, len: 100, fu: 600, faxk: 11.5, rhoa: 350 }, m1: { cls: 'C24', t: 45 }, m2: { cls: 'C24', t: 100 }, layout: { n: 2, m: 1, a1: 60 }, load: { Fv: 3, Fax: 2 } });
joint('bolts under a washer, axial', { type: 'st1', sc: 2, dur: 'long', fast: { kind: 'bolt', d: 12, fu: 400, dw: 36 }, m1: { steel: true, t: 6, clear: 1 }, m2: { cls: 'C24', t: 100 }, layout: { n: 2, m: 1, a1: 60 }, load: { Fv: 5, Fax: 3 } });
let seed = 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 400; t++) {
  const type = pick(['tt1', 'tt2', 'pt1', 'pt2', 'st1', 'st2', 'st3']), kind = pick(type === 'st3' ? ['bolt', 'dowel'] : ['nail', 'nail', 'screw', 'bolt', 'dowel']);
  const d = kind === 'nail' ? pick([2.65, 3.1, 3.35, 4, 5, 10]) : kind === 'screw' ? pick([5, 6, 8, 10]) : pick([8, 10, 12, 16, 20]);
  const m1 = type[0] === 'p' ? { panel: pick(['ply', 'osb3', 'osb4']), t: pick([9, 12, 15, 18]) } : type[0] === 's' ? { steel: true, t: pick([2, 4, 6, 8, 10, 12, 20]), clear: pick([0, 1]) } : { cls: pick(['C16', 'C24']), t: pick([38, 47, 63, 75]), alpha: pick([0, 0, 30, 90]) };
  const a2 = pick([0, 0, 0, 30, 45, 90]);
  joint(`random ${t}`, { type, sc: pick([1, 2, 3]), dur: pick(['permanent', 'long', 'medium', 'short', 'instantaneous']),
    fast: { kind, nail: pick(['smooth', 'ring']), d, len: Math.round(d * pick([12, 16, 20, 25])), fu: pick([400, 600]), predrilled: rnd() < 0.3, d1: d * 0.65, shank: rnd() < 0.3, nailing: pick(['both', 'through']), wet: rnd() < 0.1, dw: rnd() < 0.3 ? 3.5 * d : undefined },
    m1, m2: { cls: pick(['C16', 'C24', 'GL24h']), family: rnd() < 0.2 ? 'glulam' : 'solid', t: pick([47, 75, 100, 140]), alpha: a2, h: 200, he: pick([100, 150]) },
    layout: { n: pick([1, 2, 3, 5]), m: pick([1, 2]), a1: 14 * d, a2: 5 * d }, load: { Fv: rnd() < 0.9 ? 1 + 20 * rnd() : 0, Fax: rnd() < 0.3 ? 2 * rnd() : 0, Fser: rnd() < 0.3 ? 5 * rnd() : 0, mid: rnd() < 0.3 } });
}
K.done('joints');
