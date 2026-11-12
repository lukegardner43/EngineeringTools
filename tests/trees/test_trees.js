// Foundations Near Trees engine against NHBC Standards Chapter 4.2 (2022), outputs only:
//  - the chapter's worked example (4.2.14): Oxford, I_p 36% with all passing 425 μm (medium), a Lombardy poplar to remain
//    (25 m, high water demand) 10 m away: 2.33 m from Chart 2; a sycamore removed (mature 22 m, 15 m when felled, over
//    half: 22 m) 8 m away: 1.50 m; 0.05 m off for the climate: 2.28 m;
//  - the depth tables (4.2.13), which are the chart lines rounded up to 50 mm: cells read from Tables 11, 15 and 17 for
//    broad-leafed and conifer lines on high, medium and low soil and all three water demands;
//  - Tables 1, 3, 3a, 3b, 4, 5, 6, 7, 9 and the rules of 4.2.7 to 4.2.10, and the refusals.
//   node tests/trees/test_trees.js
const { TreeFoundations: T } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const idx = n => String(T.SPECIES.findIndex(s => s.n === n));
const tab = (v, wd, con, H, D) => +T.roundUp(T.chart(v, wd, con, D / H)).toFixed(2);

// ---- the chapter's example (4.2.14) ----
const EX = { soil: { vcp: 'test', Ip: 36, pass: 100 }, clim: 0.05, trees: [{ ref: 'Lombardy poplar', sp: idx('Lombardy poplar'), status: 'remain', D: 10 }, { ref: 'Sycamore', sp: idx('Sycamore'), status: 'remove', Ha: 15, D: 8 }] };
{
  const D = T.design(EX), P = D.trees[0], S = D.trees[1];
  truth('4.2.14 step 1: I′p = 36 × 100/100 = 36%: medium volume change potential', D.soil.v === 'medium' && near(D.soil.Ipm, 36, 1e-12));
  truth('4.2.14 step 2: Lombardy poplar 25 m, high; sycamore 22 m, moderate (Table 3)', P.Hm === 25 && P.sp.wd === 'high' && S.Hm === 22 && S.sp.wd === 'moderate');
  truth('4.2.14 step 4: the poplar remains, H = mature 25 m; the sycamore 15 m when felled, over half of 22 m: H 22 m', P.H === 25 && S.H === 22 && !S.young);
  truth('4.2.14 step 6C(a): D/H = 10/25 = 0.4 and 8/22 = 0.36', near(P.x, 0.4, 1e-12) && near(S.x, 0.36, 0.005));
  truth('4.2.14 step 6C(b): Chart 2, the poplar 2.33 m', near(P.raw, 2.33, 0.005), P.raw);
  truth('4.2.14: the sycamore 1.50 m (Chart 2 read off; the line gives 1.47, the tables 1.50)', near(P.raw, 2.328, 0.0005) && near(S.raw, 1.467, 0.001) && near(S.tab, 1.5, 1e-9), [S.raw, S.tab]);
  truth('4.2.14: the poplar governs', D.govT === P);
  truth('4.2.14 step 7: Oxford, 50 to 100 miles north-west of London: 2.33 − 0.05 = 2.28 m', near(D.dReq, 2.278, 0.0005) && near(P.dTree, 2.278, 0.0005), D.dReq);
  truth('4.2.14: within the guidance (2.28 ≤ 2.5 m)', near(D.checks.find(c => c.id === 'limit').util, 2.278 / 2.5, 0.001));
  truth('zones of influence (Table 3b): 1.25 × 25 = 31.25 m, 0.75 × 22 = 16.5 m', near(P.zone, 31.25, 1e-12) && near(S.zone, 16.5, 1e-12) && P.inZone && S.inZone);
}
// ---- the depth tables: the chart lines rounded up to 50 mm ----
{
  const cells = [
    // Table 11: high soil, high water demand, broad-leafed and conifers
    ['high', 'high', false, 8, 4, 2.50], ['high', 'high', false, 8, 6, 2.00], ['high', 'high', false, 10, 7, 2.10], ['high', 'high', false, 12, 9, 2.00], ['high', 'high', false, 14, 11, 1.95],
    ['high', 'high', false, 18, 20, 1.30], ['high', 'high', false, 30, 37, 1.05], ['high', 'high', false, 30, 38, 1.00], ['high', 'high', false, 24, 30, 1.00], ['high', 'high', false, 26, 28, 1.35], ['high', 'high', false, 30, 28, 1.65],
    ['high', 'high', true, 8, 2, 2.50], ['high', 'high', true, 8, 3, 1.95], ['high', 'high', true, 10, 3, 2.25], ['high', 'high', true, 12, 7, 1.10], ['high', 'high', true, 14, 8, 1.15],
    ['high', 'high', true, 18, 9, 1.45], ['high', 'high', true, 22, 8, 2.00], ['high', 'high', true, 30, 8, 2.40], ['high', 'high', true, 30, 17, 1.15], ['high', 'high', true, 30, 18, 1.00],
    // Table 15: medium soil, moderate water demand
    ['medium', 'moderate', false, 8, 1, 1.85], ['medium', 'moderate', false, 8, 3, 1.45], ['medium', 'moderate', false, 8, 6, 0.90], ['medium', 'moderate', false, 16, 8, 1.30], ['medium', 'moderate', false, 30, 1, 1.95], ['medium', 'moderate', false, 30, 22, 0.95],
    ['medium', 'moderate', true, 8, 1, 1.65], ['medium', 'moderate', true, 8, 3, 0.90], ['medium', 'moderate', true, 10, 3, 1.10], ['medium', 'moderate', true, 30, 10, 0.95], ['medium', 'moderate', true, 30, 11, 0.90],
    // Table 17: low soil, high water demand
    ['low', 'high', false, 8, 1, 2.35], ['low', 'high', false, 8, 9, 0.95], ['low', 'high', false, 8, 10, 0.75], ['low', 'high', false, 30, 10, 2.05], ['low', 'high', false, 16, 12, 1.45],
    ['low', 'high', true, 8, 1, 2.15], ['low', 'high', true, 8, 4, 1.05], ['low', 'high', true, 8, 5, 0.75], ['low', 'high', true, 30, 17, 0.85], ['low', 'high', true, 30, 18, 0.75],
  ];
  const bad = cells.filter(([v, wd, con, H, D, d]) => tab(v, wd, con, H, D) !== d).map(c => [...c, tab(c[0], c[1], c[2], c[3], c[4])]);
  truth(`the depth tables: ${cells.length} cells of Tables 11, 15 and 17 reproduced (the line to the centimetre, then up to 50 mm)`, bad.length === 0, bad);
  truth('Chart 1: 3.5 m at the trunk for high water demand, the broad-leafed line to 1.0 m at D/H 1.25, the conifer at 0.6', near(T.chart('high', 'high', false, 0), 3.5, 1e-12) && near(T.chart('high', 'high', false, 1.25), 1.0, 1e-12) && near(T.chart('high', 'high', true, 0.6), 1.0, 1e-12) && near(T.chart('high', 'high', true, 0.3), 2.25, 1e-12));
  truth('Charts 2 and 3: moderate 2.0 and 1.6, low 1.5 and 1.2 at the trunk; minimums 0.9 and 0.75 m', near(T.chart('medium', 'moderate', false, 0), 2.0, 1e-12) && near(T.chart('low', 'moderate', false, 0), 1.6, 1e-12) && near(T.chart('medium', 'low', false, 0), 1.5, 1e-12) && near(T.chart('low', 'low', false, 0), 1.2, 1e-12) && near(T.chart('medium', 'low', false, 0.5), 0.9, 1e-12) && near(T.chart('low', 'low', false, 0.6), 0.75, 1e-12));
}
// ---- Table 1, Table 3, Table 3a, the sapling rule ----
{
  truth('Table 1: I′p 40 high, 39.9 medium, 20 medium, 19.9 low, 10 low, under 10 not shrinkable', T.vcpOf({ vcp: 'test', Ip: 40, pass: 100 }).v === 'high' && T.vcpOf({ vcp: 'test', Ip: 39.9, pass: 100 }).v === 'medium' && T.vcpOf({ vcp: 'test', Ip: 20, pass: 100 }).v === 'medium' && T.vcpOf({ vcp: 'test', Ip: 19.9, pass: 100 }).v === 'low' && T.vcpOf({ vcp: 'test', Ip: 10, pass: 100 }).v === 'low' && T.vcpOf({ vcp: 'test', Ip: 9.9, pass: 100 }).v === null);
  truth('Table 1: a glacial till, I_p 45 with 80% passing 425 μm: I′p 36, medium', T.vcpOf({ vcp: 'test', Ip: 45, pass: 80 }).v === 'medium');
  truth('not known: high (4.2.4)', T.design({ soil: { vcp: 'unknown' }, trees: [{ sp: idx('Birch'), D: 3 }] }).soil.v === 'high');
  truth('Table 3: its 61 species and 7 for the subspecies-unknown rule (elm 24, oak 24, poplar 28, willow 24, cherry 17, maple 18, cypress 20)', T.SPECIES.length === 68 && ['Elm', 'Oak', 'Poplar', 'Willow', 'Cherry', 'Maple', 'Cypress'].every((n, i) => T.SPECIES.find(s => s.n === `${n}, subspecies unknown`).H === [24, 24, 28, 24, 17, 18, 20][i]));
  truth('Table 3: Wellingtonia 30 m moderate conifer; hawthorn 10 m high; tulip tree 20 m low', (s => s.H === 30 && s.con && s.wd === 'moderate')(T.SPECIES[+idx('Wellingtonia')]) && (s => s.H === 10 && s.wd === 'high')(T.SPECIES[+idx('Hawthorn')]) && (s => s.H === 20 && s.wd === 'low')(T.SPECIES[+idx('Tulip tree')]));
  const young = T.design({ soil: { vcp: 'high' }, trees: [{ sp: idx('English oak'), status: 'remove', Ha: 8, D: 1 }] }).trees[0];
  truth('Table 3a and 4.2.7: an oak felled at 8 m (under half its 20 m) within 2 m: H = 8 m, D = 2 m', young.H === 8 && young.D === 2 && young.young && near(young.raw, T.chart('high', 'high', false, 2 / 8), 1e-12));
  const keep = T.design({ soil: { vcp: 'high' }, trees: [{ sp: idx('English oak'), status: 'remain', Ha: 8, D: 10 }] }).trees[0];
  truth('Table 3a: an oak to remain uses its mature height (20 m) for depth, its present 8 m for heave', keep.H === 20 && keep.Hh === 8 && near(keep.dHeave, Math.max(1, T.chart('high', 'high', false, 10 / 8)), 1e-12));
  const unk = T.design({ soil: { vcp: 'medium' }, trees: [{ sp: 'unknown', Hm: 15, D: 5 }] }).trees[0];
  truth('an unidentified tree: high water demand (4.2.4)', unk.sp.wd === 'high' && near(unk.raw, T.chart('medium', 'high', false, 5 / 15), 1e-12));
  truth('an unlisted species with no height is refused', throws(() => T.design({ soil: { vcp: 'medium' }, trees: [{ sp: 'otherMod', D: 5 }] }), /mature height/));
}
// ---- the climate reduction, the minimum, changed levels ----
{
  const far = T.design({ soil: { vcp: 'medium' }, clim: 0.5, trees: [{ sp: idx('Birch'), D: 6 }] }).trees[0];
  truth('the climate reduction stops at the minimum depth (4.2.14 step 7)', near(far.dTree, 0.9, 1e-12) && near(far.raw, T.chart('medium', 'low', false, 6 / 14), 1e-12));
  const up = T.design({ soil: { vcp: 'high' }, dLevel: 0.6, trees: [{ sp: idx('Ash'), status: 'remain', D: 8 }] }).trees[0];
  truth('Figure 1, ground raised 0.6 m by a tree to remain: the founding level stays the chart depth below the original ground, 0.6 m more from the finished', near(up.lvlA, up.dTree, 1e-12) && near(up.lvlB, up.dTree - 0.6, 1e-12) && near(up.depth, up.dTree + 0.6, 1e-12));
  const rm = T.design({ soil: { vcp: 'high' }, dLevel: -1.0, trees: [{ sp: idx('Ash'), status: 'remove', Ha: 20, D: 8 }] }).trees[0];
  truth('Figure 2, ground lowered 1.0 m where a tree is removed: the lower of (a) the chart depth below the original and (b) the minimum below the new', near(rm.lvlA, rm.dTree, 1e-12) && near(rm.lvlB, 1.0 + 1.0, 1e-12) && near(rm.depth, Math.max(rm.dTree, 2.0) - 1.0, 1e-12));
  const pr = T.design({ soil: { vcp: 'high' }, dLevel: 0.5, trees: [{ sp: idx('Lime'), status: 'proposed', D: 6 }] }).trees[0];
  truth('Figure 3, ground raised 0.5 m for a proposed tree: the lower of (a) the minimum below the original and (b) the mature-height depth below the new', near(pr.lvlA, 1.0, 1e-12) && near(pr.lvlB, pr.dTree - 0.5, 1e-12) && near(pr.depth, Math.max(1.0, pr.dTree - 0.5) + 0.5, 1e-12));
}
// ---- shrubs (Table 6) ----
{
  const D = T.design({ soil: { vcp: 'high' }, shrubs: [{ kind: 'small', H: 1.5, D: 0.5 }, { kind: 'climber', H: 4, D: 0.2 }, { kind: 'pyra', H: 3, D: 3 }, { kind: 'pyra', H: 3, D: 2 }, { kind: 'pyra', H: 3, D: 1 }, { kind: 'other', H: 4, D: 3 }, { kind: 'other', H: 4, D: 2 }] });
  const n = D.shrubs.map(s => s.need);
  truth('Table 6, high soil: small and climbing shrubs 1.0 m (B); pyracantha 3 m at 3 m B, at 2 m A (1.5 m), at 1 m too close; others 4 m at 3 m B, at 2 m A', n.join() === [1.0, 1.0, 1.0, 1.5, 1.5, 1.0, 1.5].join() && D.shrubs[4].tooClose && !D.shrubs[3].tooClose, n);
  truth('Table 6: the shrubs set the depth (1.5 m, column A) and the one planted too close fails', near(D.dReq, 1.5, 1e-12) && D.checks.find(c => c.id === 'shrub4').util > 1 && D.checks.find(c => c.id === 'shrub3').util <= 1);
  truth('Table 6: a "small" shrub over 1.8 m and a climber over 5 m are treated as others', T.design({ soil: { vcp: 'low' }, shrubs: [{ kind: 'small', H: 2.5, D: 1 }, { kind: 'climber', H: 6, D: 1 }] }).shrubs.every(s => s.kind === 'other' && near(s.need, 1.0, 1e-12)));
  const P = T.design({ soil: { vcp: 'medium' }, dProp: 1.0, shrubs: [{ kind: 'other', H: 3, D: 1 }] });
  truth('Table 6 against a proposed 1.0 m on medium soil: a 3 m shrub 1 m away needs 1.25 m (column A)', near(P.checks.find(c => c.id === 'shrub0').util, 1.25, 1e-12) && near(P.checks.find(c => c.id === 'depth').util, 1.25, 1e-12));
}
// ---- Tables 4, 5, 7 and 9, heave, the foundation types ----
{
  truth('Table 4: A 1.5 / 1.25 / 1.0, B 1.0 / 0.9 / 0.75 m; Table 5: A 1.0 / 0.5 / 0.2 H, B 1.25 / 0.75 / 0.5 H', T.VCP.high.A === 1.5 && T.VCP.medium.A === 1.25 && T.VCP.low.A === 1.0 && T.VCP.high.B === 1.0 && T.VCP.medium.B === 0.9 && T.VCP.low.B === 0.75 && T.NOPLANT_A.high === 1.0 && T.NOPLANT_A.moderate === 0.5 && T.NOPLANT_A.low === 0.2);
  truth('Table 7: voids 35 / 150 / 300, 25 / 100 / 250, 0 / 50 / 200 mm; Table 9: 150, 100, 50 mm', T.VCP.high.voids.join() === '35,150,300' && T.VCP.medium.voids.join() === '25,100,250' && T.VCP.low.voids.join() === '0,50,200' && T.VCP.high.move === 150 && T.VCP.low.move === 50);
  const D = T.design(EX);
  truth('heave: the trees remain and removed reach the foundation; trench fill 2.28 m > 1.5 m: the inside faces of external walls, 25 mm', D.heave.needed && /inside faces of the external walls, 25 mm/.test(D.heave.items[0]) && /100 mm of ground movement/.test(D.heave.items.join(' ')));
  const prop = T.design({ soil: { vcp: 'high' }, trees: [{ sp: idx('English oak'), status: 'proposed', D: 10 }] });
  truth('heave: none for a proposed tree (Table 8)', !prop.heave.needed && prop.dReq > 1.0);
  const pier = T.design({ ...EX, type: 'pier' });
  truth('pier and beam: all faces of the piers, the inside faces and underside of ground beams; an engineer\'s design', /all their faces/.test(pier.heave.items.join(' ')) && /underside|under all of them/.test(pier.heave.items.join(' ')) && pier.warnings.some(w => /engineer’s design/.test(w)));
  const raft = T.design({ ...EX, type: 'raft', Lx: 20, Ly: 8 });
  truth('raft: a plan ratio 20/8 = 2.5 over 2:1 fails; granular infill from half the depth (1.14 m) to 1.25 m', near(raft.checks.find(c => c.id === 'raft').util, 1.25, 1e-12) && near(raft.raft.infillMin, 2.278 / 2, 0.001));
  const deep = T.design({ soil: { vcp: 'high' }, trees: [{ sp: idx('English oak'), D: 3 }] });
  truth('an oak 3 m away on high soil: 3.2 m, over 2.5 m: an engineer\'s design', deep.dReq > 2.5 && deep.checks.find(c => c.id === 'limit').util > 1 && deep.warnings.some(w => /R5/.test(w)));
  const ns = T.design({ ...EX, ns: { on: true, t: 2.0, B: 0.6, d: 1.2 } });
  truth('4.2.9: sand to 2.0 m over the clay, X 2.28 m: ¾X = 1.71 < 2.0, T = 0.8 ≥ B 0.6: a 1.2 m foundation in the sand is acceptable (NHBC to approve)', ns.ns.util <= 1 && near(ns.ns.uX, 0.75 * 2.278 / 2.0, 0.001) && near(ns.ns.uB, 0.6 / 0.8, 1e-12));
  const ns2 = T.design({ ...EX, ns: { on: true, t: 1.6, B: 0.6, d: 1.2 } });
  truth('4.2.9: sand only to 1.6 m (under ¾X = 1.71 m): not acceptable', ns2.ns.util > 1);
  const pd = T.design({ ...EX, dProp: 2.0 });
  truth('a proposed 2.0 m against the 2.28 m needed fails', pd.checks.find(c => c.id === 'depth').util > 1 && pd.utilMax > 1);
}
// ---- the refusals ----
truth('refuses: nothing given', throws(() => T.design({ soil: { vcp: 'high' } }), /at least one tree/));
truth('refuses: non-shrinkable soil', throws(() => T.design({ soil: { vcp: 'test', Ip: 8, pass: 100 }, trees: [{ sp: idx('Birch'), D: 3 }] }), /not shrinkable/));
truth('refuses: a climate reduction over 0.5 m', throws(() => T.design({ ...EX, clim: 0.6 }), /0.50 m at most/));
truth('refuses: no distance', throws(() => T.design({ soil: { vcp: 'high' }, trees: [{ sp: idx('Birch') }] }), /distance/));

console.log(`\n${pass}/${pass + fail} passed`); if (fail) process.exit(1);
