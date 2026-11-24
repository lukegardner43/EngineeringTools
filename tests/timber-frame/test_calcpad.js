// Timber 2D Frame Analysis and Design: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node
// test_calcpad.js). Every part (the frame, its actions, its analysis and reactions; each member group at its worst member
// and station with every EC5 check by formula; the joints' deflection and a portal's sway) is pasted into CalcPad
// (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: every truss type, chords continuous
// or every joint pinned, flat trusses, portals with pinned and fixed bases (first and second order), and 40 random frames.
const { TimberFrame: TF, CalcScript, TimberFrameScript } = require('./load.js');
const K = require('../calcpad/zones.js').checker(CalcScript, 'Timber 2D Frame');
function frame(tag, inp) {
  let D; try { D = TF.design(inp); } catch (e) { if (!/^random/.test(tag)) console.log('THROWS', tag, e.message); return null; }
  K.run(tag, TimberFrameScript.zones(D), D.checks, TimberFrameScript.ZONE, D.utilMax);
  return D;
}
const TRUSS = { mat: { family: 'solid', cls: 'C24' }, sc: 2, spacing: 600, sw: true, ksys: false, combo: '6.10',
  sizes: { top: { b: 47, h: 125 }, bot: { b: 47, h: 125 }, web: { b: 47, h: 75 } }, lz: { top: 600, bot: 1800 },
  actions: { gRoof: 0.75, gCeil: 0.25, qRoof: 0.6, qCeil: 0.25, catCeil: 'A', snow: 0.5, wRoof1: -0.6, wRoof2: -0.4 } };
const PORTAL = { mat: { family: 'glulam', cls: 'GL24h' }, sc: 1, spacing: 4800, sw: true, ksys: false, combo: '6.10',
  sizes: { raf: { b: 140, h: 585 }, col: { b: 140, h: 585 } }, lz: { raf: 1200, col: 1500 },
  actions: { gRoof: 0.75, qRoof: 0.6, snow: 0.5, wRoof1: -0.6, wRoof2: -0.4, wWall1: 0.5, wWall2: -0.25 } };
for (const [tag, base, geom] of [['Fink, chords continuous', TRUSS, { kind: 'truss', type: 'fink', L: 8000, pitch: 30, joints: 'chords' }],
  ['Fink, every joint pinned', TRUSS, { kind: 'truss', type: 'fink', L: 8000, pitch: 30, joints: 'pinned' }],
  ['Howe, 6 panels', TRUSS, { kind: 'truss', type: 'howe', L: 9000, pitch: 25, n: 6, joints: 'chords' }],
  ['Pratt, 8 panels', TRUSS, { kind: 'truss', type: 'pratt', L: 10000, pitch: 22.5, n: 8, joints: 'chords' }],
  ['king post', TRUSS, { kind: 'truss', type: 'kingpost', L: 6000, pitch: 30, joints: 'pinned' }],
  ['flat Pratt', TRUSS, { kind: 'flat', type: 'pratt', L: 9000, n: 6, depth: 900, joints: 'chords' }],
  ['flat Warren', TRUSS, { kind: 'flat', type: 'warren', L: 9000, n: 6, depth: 900, joints: 'pinned' }],
  ['portal, pinned bases', PORTAL, { kind: 'portal', L: 12000, pitch: 10, he: 4000, base: 'pinned' }],
  ['portal, fixed bases', PORTAL, { kind: 'portal', L: 12000, pitch: 10, he: 4000, base: 'fixed' }],
  ['portal, slender, second order', { ...PORTAL, sizes: { raf: { b: 115, h: 360 }, col: { b: 115, h: 360 } } }, { kind: 'portal', L: 14000, pitch: 5, he: 5500, base: 'pinned' }]]) frame(tag, { ...base, geom });
frame('Fink, 6.10a/b, k_sys, LVL-free hardwood', { ...TRUSS, mat: { family: 'hard', cls: 'D30' }, combo: '6.10ab', ksys: true, geom: { kind: 'truss', type: 'fink', L: 8000, pitch: 30, joints: 'chords' } });
let seed = 31; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 40; t++) {
  const portal = rnd() < 0.35;
  if (portal) frame(`random ${t}`, { ...PORTAL, mat: { family: 'glulam', cls: pick(['GL24h', 'GL28c', 'GL32h']) }, sc: pick([1, 2]), combo: pick(['6.10', '6.10ab']), spacing: 4000 + 2000 * rnd(),
    sizes: { raf: { b: pick([115, 140, 165]), h: pick([405, 495, 585, 675]) }, col: { b: pick([115, 140, 165]), h: pick([405, 495, 585]) } }, lz: { raf: pick([0, 1200, 2400]), col: pick([0, 1500]) },
    geom: { kind: 'portal', L: 10000 + 8000 * rnd(), pitch: pick([5, 10, 15]), he: 3500 + 2000 * rnd(), base: pick(['pinned', 'fixed']) } });
  else frame(`random ${t}`, { ...TRUSS, mat: { family: 'solid', cls: pick(['C16', 'C24']) }, sc: pick([1, 2]), combo: pick(['6.10', '6.10ab']), ksys: rnd() < 0.5, spacing: pick([400, 600]),
    sizes: { top: { b: pick([35, 47]), h: pick([100, 125, 150]) }, bot: { b: pick([35, 47]), h: pick([100, 125]) }, web: { b: pick([35, 47]), h: pick([72, 75, 97]) } }, lz: { top: pick([0, 600]), bot: pick([0, 1800]) },
    actions: { gRoof: 0.5 + 0.5 * rnd(), gCeil: 0.25, qRoof: rnd() < 0.5 ? 0.6 : 0, qCeil: rnd() < 0.5 ? 0.25 : 0, catCeil: 'A', snow: rnd() < 0.5 ? 0.5 + 0.3 * rnd() : 0, wRoof1: rnd() < 0.5 ? -0.8 * rnd() : 0, wRoof2: rnd() < 0.5 ? -0.5 * rnd() : 0 },
    geom: { kind: pick(['truss', 'truss', 'flat']), type: pick(['fink', 'howe', 'pratt', 'kingpost', 'warren']), L: 6000 + 5000 * rnd(), pitch: pick([15, 22.5, 30, 35]), n: pick([4, 6, 8]), depth: 700 + 400 * rnd(), joints: pick(['chords', 'pinned']) } });
}
K.done('frames');
