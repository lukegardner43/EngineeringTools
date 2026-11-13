// Load Take-down engine (the take-down table: area, line and point loads in DL, SIDL and LL per row):
//  - Luke's load take-down template (private reference; its sample's outputs only): a wall per metre run, roof 3.5 m² × (1,
//    0, 1), two floors 3.5 m² × (2.5, 2, 2.5), the wall 7 m² × 0.1*20: Sum DL 35, SIDL 14, LL 21; SLS 70; ULS 1.35(DL + SIDL)
//    + 1.5 LL = 97.65 kN;
//  - the column load in Mosley, Bungey and Hulse, Reinforced Concrete Design to Eurocode 2 (7th ed.), Example 6.7 (published:
//    eight storeys of (1.35 × 6 + 1.5 × 3) kN/m² on 22.75 m², whose 3% is 69 kN);
//  - the UK National Annex imposed loads, roof loads and reductions as the IStructE Manual for the design of building
//    structures to Eurocode 1, Tables 3.1 and 3.5 and 3.7.3.4;
//  - the cells' sums, line and point loads, the combinations, the footing, the hipped roof and the earlier version's saved
//    files (build-ups and levels) converted to rows, by hand;
//  - the rows' types (roof, floor, wall or facade, point load, other) guessed and kept, and the sums independent of them;
//  - the transfer beams by the simply supported beam formulas: reactions P·b/L and w·L/2, a part UDL by its resultant,
//    the moment P·a·b/L + w·x(L − x)/2 under a point and the peak of a part UDL at x = a + R_A/w.
//   node tests/load-takedown/test_load_takedown.js
const { LoadTakedown: LT } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

// ---- Luke's take-down template, its sample ----
const SHEET = [{ name: 'Roof', A: 3.5, aD: 1, aL: 1 }, { name: '2nd', A: 3.5, aD: 2.5, aS: 2, aL: 2.5 }, { name: '1st', A: 3.5, aD: 2.5, aS: 2, aL: 2.5 }, { name: 'wall', A: 7, aD: '=0.1*20' }];
{
  const D = LT.design({ type: 'wall', rows: SHEET });
  truth('template: row totals 3.5/0/3.5, 8.75/7/8.75 twice, 14/0/0', [[3.5, 0, 3.5], [8.75, 7, 8.75], [8.75, 7, 8.75], [14, 0, 0]].every(([a, b, c], i) => near(D.rows[i].DL, a, 1e-12) && near(D.rows[i].SIDL, b, 1e-12) && near(D.rows[i].LL, c, 1e-12)));
  truth('template: Sum DL 35, SIDL 14, LL 21', near(D.sum.DL, 35, 1e-12) && near(D.sum.SIDL, 14, 1e-12) && near(D.sum.LL, 21, 1e-12), D.sum);
  truth('template: SLS = 35 + 14 + 21 = 70', near(D.base.sls, 70, 1e-12));
  truth('template: ULS = 1.35 × 35 + 1.35 × 14 + 1.5 × 21 = 97.65', near(D.base.uls, 97.65, 1e-9), D.base.uls);
  truth('the running totals grow down the table, the last one the sum', D.rows.every((r, i) => i === 0 || r.uls > D.rows[i - 1].uls) && near(D.rows[1].sls, 3.5 + 3.5 + 8.75 + 7 + 8.75, 1e-12));
}
// ---- cells: numbers or sums ----
truth('cells: 0.1*20, =2.5+0.5, (1+2)*3, 1 + 2*3, −2, .5, 1,250 and 12/4', [['0.1*20', 2], ['=2.5+0.5', 3], ['(1+2)*3', 9], ['1 + 2*3', 7], ['-2', -2], ['.5', 0.5], ['1,250', 1250], ['12/4', 3], ['0.1×20', 2], ['', 0]].every(([s, v]) => near(LT.evalx(s), v, 1e-12)));
truth('cells: words, a bracket left open and a division by nothing are refused', throws(() => LT.evalx('abc'), /not a number/) && throws(() => LT.evalx('(1+2'), /bracket/) && throws(() => LT.evalx('2/0'), /does not give/) && throws(() => LT.evalx('1..2'), /not a number/));
truth('cells: a bad one names its row', throws(() => LT.design({ rows: [{ name: 'Roof', A: '3.5', aD: '1+' }] }), /^Roof: /));
// ---- line and point loads ----
{
  const D = LT.design({ type: 'column', rows: [{ name: 'Beam', L: 6, lD: 2, lS: 1, lL: '3*0.5', pD: 10, pS: 2, pL: 4 }] });
  truth('a row of line and point loads: DL 6 × 2 + 10 = 22, SIDL 6 + 2 = 8, LL 6 × 1.5 + 4 = 13 kN', near(D.base.cum.DL, 22, 1e-12) && near(D.base.cum.SIDL, 8, 1e-12) && near(D.base.cum.LL, 13, 1e-12) && D.U === 'kN');
  truth('all three together on one row', near(LT.design({ rows: [{ name: 'x', A: 2, aD: 3, L: 4, lD: 5, pD: 6 }] }).base.cum.DL, 6 + 20 + 6, 1e-12));
}
// ---- Mosley et al. Example 6.7: column at ground level, eight floors of gk 6 + qk 3 on 3.5 × 6.5 m ----
{
  const rows = Array.from({ length: 8 }, (_, i) => ({ name: `L${8 - i}`, A: 3.5 * 6.5, aD: 6, aL: 3, red: true }));
  const D = LT.design({ type: 'column', red: 'none', comb: '6.10', rows });
  truth('Ex 6.7: column load 8 × (1.35 × 6 + 1.5 × 3) × 22.75 = 2293 kN (3% = 69 kN)', near(D.base.uls, 2293.2, 0.05) && near(0.03 * D.base.uls, 69, 0.3), D.base.uls);
  const R = LT.design({ type: 'column', red: 'an', rows }).base;
  truth('Ex 6.7: with α_n for 8 storeys (0.6): 1.35 × 1092 + 1.5 × 0.6 × 546 = 1965.6 kN', near(R.uls, 1.35 * 1092 + 1.5 * 0.6 * 546, 1e-9) && near(R.alpha, 0.6, 1e-12), R.uls);
}
// ---- UK NA values (IStructE Manual for EC1) ----
{
  const t31 = { A1: [1.5, 2.0], A2: [1.5, 2.0], A3: [2.0, 2.0], A4: [2.0, 2.7], A5: [2.5, 2.0], B1: [2.5, 2.7], B2: [3.0, 2.7], C11: [2.0, 3.0], C12: [2.5, 4.0], C13: [3.0, 3.0], C21: [4.0, 3.6], C22: [3.0, 2.7], C31: [3.0, 4.5], C33: [4.0, 4.5], C35: [4.0, 4.0], C39: [4.0, 4.5], C41: [5.0, 3.6], C51: [5.0, 3.6], D1: [4.0, 3.6], D2: [4.0, 3.6] };
  truth('Table 3.1 (UK NA Table NA.2): q_k and Q_k for every category offered', Object.entries(t31).every(([k, [q, Q]]) => LT.CATS[k].q === q && LT.CATS[k].Q === Q));
  truth('Table 3.5: roofs not accessible, q_k 0.6 below 30°, 0.6(60 − α)/30 to 60°, 0 beyond; Q_k 0.9', LT.qH(0) === 0.6 && LT.qH(29.9) === 0.6 && near(LT.qH(35), 0.5, 1e-12) && near(LT.qH(45), 0.3, 1e-12) && LT.qH(60) === 0 && LT.CATS.H.Q === 0.9);
  truth('3.7.3.4: α_n = 1.1 − n/10 to 5 storeys, 0.6 to 10, 0.5 beyond', [1, 2, 3, 4, 5, 6, 10, 11, 20].every((n, i) => near(LT.alphaN(n), [1, 0.9, 0.8, 0.7, 0.6, 0.6, 0.6, 0.5, 0.5][i], 1e-12)));
  truth('3.7.3.4: α_A = 1 − A/1000 ≥ 0.75', near(LT.alphaA(100), 0.9, 1e-12) && LT.alphaA(250) === 0.75 && LT.alphaA(600) === 0.75);
  truth('ψ₀: 0.7 categories A to D and H, 1.0 E, 0.5 snow (Table 2.6)', ['A', 'B', 'C', 'D', 'H'].every(k => LT.PSI0[k] === 0.7) && LT.PSI0.E === 1 && LT.PSI0.S === 0.5);
}
// ---- the reduction: only the rows ticked as floors ----
{
  const rows = SHEET.map((r, i) => ({ ...r, red: i === 1 || i === 2 }));
  const D = LT.design({ type: 'wall', red: 'an', rows }).base;
  truth('template with its two floors ticked: α_n = 0.9 on their 17.5, the roof\'s 3.5 not reduced: LL 19.25', near(D.alpha, 0.9, 1e-12) && near(D.Q, 0.9 * 17.5 + 3.5, 1e-12) && D.cum.n === 2, D.Q);
  truth('… SLS 35 + 14 + 19.25 = 68.25, ULS 1.35 × 49 + 1.5 × 19.25 = 95.03', near(D.sls, 68.25, 1e-12) && near(D.uls, 1.35 * 49 + 1.5 * 19.25, 1e-9));
  truth('one floor alone: α_n 1.0, nothing reduced', near(LT.design({ type: 'wall', red: 'an', rows: SHEET.map((r, i) => ({ ...r, red: i === 1 })) }).base.Q, 21, 1e-12));
  truth('the reduction off: the ticks do nothing', near(LT.design({ type: 'wall', red: 'none', rows }).base.Q, 21, 1e-12));
  truth('the reduction on and nothing ticked: a warning', LT.design({ type: 'wall', red: 'an', rows: SHEET }).warnings.some(w => /No row is marked/.test(w)));
  const C = r => ({ name: r, A: 150, aD: 5, aL: 2.5, red: true });
  const b = LT.design({ type: 'column', red: 'best', rows: [C('L2'), C('L1')] }).base;
  truth('column: α_A = 1 − 300/1000 → 0.75, smaller than α_n 0.9, used alone', near(b.alpha, 0.75, 1e-12) && /α_A/.test(b.how));
  const b2 = LT.design({ type: 'column', red: 'best', rows: [{ ...C('L2'), A: 40 }, { ...C('L1'), A: 40 }] }).base;
  truth('column: α_A = 1 − 80/1000 = 0.92 is larger than α_n 0.9, so α_n stays', near(b2.alpha, 0.9, 1e-12));
  truth('a wall takes α_n even with "the better of"', near(LT.design({ type: 'wall', red: 'best', rows: [C('L2'), C('L1')] }).base.alpha, 0.9, 1e-12));
}
// ---- (6.10a) and (6.10b) ----
{
  const b = LT.design({ type: 'wall', comb: '6.10ab', rows: SHEET }).base;
  truth('(6.10a) 1.35 × 49 + 1.05 × 21 = 88.2; (6.10b) 0.925 × 1.35 × 49 + 1.5 × 21 = 92.7: 92.7 governs', near(b.uls610a, 1.35 * 49 + 1.05 * 21, 1e-9) && near(b.uls610b, 0.925 * 1.35 * 49 + 31.5, 1e-9) && near(b.uls, Math.max(b.uls610a, b.uls610b), 1e-12) && b.uls < 97.65, [b.uls610a, b.uls610b]);
  const heavy = LT.design({ type: 'wall', comb: '6.10ab', rows: [{ name: 'x', A: 1, aD: 100, aL: 1 }] }).base;
  truth('a heavy permanent load: (6.10a) governs', near(heavy.uls, 135 + 1.05, 1e-9));
}
// ---- footing ----
{
  const D = LT.design({ type: 'wall', qa: 100, rows: SHEET });
  truth('wall: strip width = SLS/100 = 0.70 m', near(D.foot.b, 0.7, 1e-12));
  truth('footing self-weight off the bearing pressure: 70/85.6', near(LT.design({ type: 'wall', qa: 100, fw: 14.4, rows: SHEET }).foot.b, 70 / 85.6, 1e-12));
  truth('column: pad side √(SLS/q_a)', near(LT.design({ type: 'column', qa: 150, rows: SHEET }).foot.s, Math.sqrt(70 / 150), 1e-12));
  truth('a footing heavier than the bearing pressure: no size, a limit', (() => { const X = LT.design({ rows: SHEET, qa: 50, fw: 60 }); return X.foot === null && X.limits.some(l => /less than the allowable/.test(l)); })());
}
// ---- hipped roof ----
{
  const D = LT.design({ type: 'wall', rows: SHEET, hip: { B: 9, L: 20, g: 1.1, s: '0.2', q: 0.6 } });
  truth('hip: side walls q·B/2 between the hips', near(D.hip.DL.side, 1.1 * 4.5, 1e-12) && near(D.hip.SIDL.side, 0.2 * 4.5, 1e-12) && near(D.hip.LL.side, 0.6 * 4.5, 1e-12));
  truth('hip: end walls peak q·B/2, average q·B/4', near(D.hip.DL.endPeak, 1.1 * 4.5, 1e-12) && near(D.hip.DL.endAvg, 1.1 * 2.25, 1e-12));
  truth('hip: the four faces add up to the whole plan', near(2 * D.hip.areaEnd + 2 * D.hip.areaSide, 180, 1e-9) && near(2 * D.hip.DL.endTot + 2 * D.hip.DL.sideTot, 1.1 * 180, 1e-9));
  truth('hip: half to the plates halves them', near(LT.design({ rows: SHEET, hip: { B: 9, L: 20, g: 1.1, q: 0.6, f: 0.5 } }).hip.DL.side, 1.1 * 2.25, 1e-12));
  truth('hip: L shorter than B is refused', throws(() => LT.design({ rows: SHEET, hip: { B: 9, L: 6, g: 1 } }), /at least the width/));
}
// ---- build-ups and the earlier version's saved files ----
{
  const b = LT.buildup({ id: 'R', name: 'Roof', pitch: 30, cat: 'H', snow: 0.5, items: [{ d: 'tiles', g: 0.6, on: 'slope' }, { d: 'ceiling', g: 0.2 }, { d: 'slab', t: 200, rho: 25 }] });
  truth('build-up: on slope ÷ cos 30°, plan as given, t × ρ', near(b.G, 0.6 / Math.cos(Math.PI / 6) + 0.2 + 5, 1e-12) && near(b.q, 0.6, 1e-12) && b.S === 0.5);
  const R = { id: 'b1', name: 'Roof', pitch: 35, cat: 'H', snow: 0.45, items: [{ d: 'tiles', g: 0.55, on: 'slope' }, { d: 'battens', g: 0.05, on: 'slope' }, { d: 'trusses', g: 0.15, on: 'slope' }, { d: 'insulation', g: 0.05 }, { d: 'ceiling', g: 0.15 }] };
  const Fl = { id: 'b2', name: 'Floor', cat: 'A1', part: 0.5, items: [{ d: 'slab', t: 150, rho: 25 }, { d: 'screed', t: 65, rho: 22 }, { d: 'ceiling', g: 0.5 }] };
  const v1 = { v: 1, type: 'wall', red: 'an', comb: '6.10', qa: '100', fw: '0', buildups: [R, Fl], levels: [{ name: 'Roof', bu: 'b1', trib: 4.5, h: 2.7, sw: 2.4 }, { name: '2nd', bu: 'b2', trib: 2.25, h: 2.7, sw: 2.4 }, { name: '1st', bu: 'b2', trib: 2.25, h: 2.7, sw: 2.4 }, { name: 'Ground', h: 0.6, sw: 2.4 }], hipOn: false };
  const s = LT.fromV1(v1), D = LT.design({ type: s.type, red: s.red, comb: s.comb, rows: s.rows });
  const gR = 0.75 / Math.cos(35 * Math.PI / 180) + 0.2, gF = 3.75 + 1.43 + 0.5, G = gR * 4.5 + 2 * gF * 2.25 + 3 * 2.4 * 2.7 + 2.4 * 0.6;
  truth('an earlier saved file: four rows, the floors ticked, the roof not', s.v === 2 && s.rows.length === 4 && s.rows[1].red && !s.rows[0].red && s.rows[3].A === undefined);
  truth('… DL as the earlier version\'s G_k (build-ups × widths + the walls\' weight as point loads), to the rounding of the cells', near(D.sum.DL, G, 0.02), [D.sum.DL, G]);
  truth('… the floors\' imposed load reduced by α_n 0.9; the roof\'s larger of 0.5 imposed and 0.45 snow', near(D.base.Q, 0.9 * 2 * 2 * 2.25 + 0.5 * 4.5, 1e-9) && near(D.base.alpha, 0.9, 1e-12));
}
// ---- the rows' types ----
{
  truth('types guessed: Roof, floors, Wall, a beam bearing, a plant base on point loads, a canopy', [['Roof', {}, 'roof'], ['Second floor', { A: 3 }, 'floor'], ['Ground floor slab', {}, 'floor'], ['Wall', { A: 7, aD: 2 }, 'wall'], ['Facade cladding', { L: 3, lD: 1 }, 'wall'], ['Inner leaf blockwork', {}, 'wall'], ['Beam B2', { pD: 10 }, 'point'], ['x', { pD: 4, pL: 2 }, 'point'], ['Canopy', {}, 'roof'], ['Services', { L: 1, lD: 0.5 }, 'other']].every(([name, o, k]) => LT.guessKind({ name, ...o }) === k));
  truth('a floor ticked for the reduction is a floor; a type given is kept; an unknown type is guessed', LT.guessKind({ name: 'L2', red: true }) === 'floor' && LT.guessKind({ name: 'Wall', kind: 'point' }) === 'point' && LT.guessKind({ name: 'Wall', kind: 'nonsense' }) === 'wall');
  const D = LT.design({ type: 'wall', rows: SHEET }), D2 = LT.design({ type: 'wall', rows: SHEET.map(r => ({ ...r, kind: 'other' })) });
  truth('the template\'s rows: roof, floor, floor, wall', D.rows.map(r => r.kind).join() === 'roof,floor,floor,wall', D.rows.map(r => r.kind));
  truth('the type does not change the sums', near(D2.base.uls, D.base.uls, 1e-12) && near(D2.sum.DL, D.sum.DL, 1e-12) && D2.rows.every(r => r.kind === 'other'));
}
// ---- transfer beams ----
{
  // above: span 6, P (60, 10, 30) kN at 2 m, own weight 2 kN/m; this column at the left end: 60 × 4/6 + 2 × 6/2 = 46
  const tAbove = { L: 6, end: 'left', sw: 2, loads: [{ type: 'point', a: 2, DL: 60, SIDL: 10, LL: 30 }], after: 0 };
  const D = LT.design({ type: 'column', rows: SHEET, tAbove }), T = D.tA;
  truth('above: reaction at the left end P·b/L + wL/2 = 46, 6.67, 20 kN', near(T.R.DL, 46, 1e-12) && near(T.R.SIDL, 10 * 4 / 6, 1e-12) && near(T.R.LL, 20, 1e-12), T.R);
  truth('… at the right end P·a/L + wL/2 = 26', near(LT.design({ type: 'column', rows: SHEET, tAbove: { ...tAbove, end: 'right' } }).tA.R.DL, 60 * 2 / 6 + 6, 1e-12));
  truth('… a row of its own after the roof, typed a transfer beam, in the sums', D.rows.length === 5 && D.rows[1].kind === 'transfer' && D.rows[1].transfer && near(D.sum.DL, 35 + 46, 1e-12) && near(D.base.uls, 1.35 * (35 + 14 + 46 + 20 / 3) + 1.5 * (21 + 20), 1e-9));
  truth('… at the top, or after the last row', LT.design({ rows: SHEET, tAbove: { ...tAbove, after: -1 } }).rows[0].transfer && LT.design({ rows: SHEET, tAbove: { ...tAbove, after: 9 } }).rows[4].transfer);
  const Dr = LT.design({ type: 'column', rows: SHEET.map((r, i) => (i === 1 || i === 2 ? { ...r, red: true } : r)), red: 'an', tAbove });
  truth('… its imposed load is not reduced: 0.9 × (8.75 + 8.75) + 3.5 + 20', near(Dr.base.Q, 0.9 * 17.5 + 3.5 + 20, 1e-9) && Dr.base.cum.n === 2, Dr.base.Q);
  const pu = LT.design({ rows: SHEET, tAbove: { L: 6, end: 'left', sw: 0, after: 0, loads: [{ type: 'udl', a: 1, b: 4, DL: 6 }] } }).tA;
  truth('… a part UDL by its resultant: 6 × 3 at 2.5 m: 18 × 3.5/6 = 10.5 to the left end', near(pu.R.DL, 10.5, 1e-12), pu.R);
  truth('… a UDL with b blank runs to the right end: 6 × 5 at 3.5 m from the left, 30 × 2.5/6', near(LT.design({ rows: SHEET, tAbove: { L: 6, end: 'left', after: 0, loads: [{ type: 'udl', a: 1, b: '', DL: 6 }] } }).tA.R.DL, 30 * 2.5 / 6, 1e-12));
  const Dw = LT.design({ type: 'wall', rows: SHEET, tAbove: { ...tAbove, spread: 0.5 } });
  truth('… on a wall, spread over 0.5 m: 46/0.5 = 92 kN/m', near(Dw.rows[1].DL, 92, 1e-12) && near(Dw.sum.DL, 35 + 92, 1e-12));
  truth('… refused without a span, or with a load off the span', throws(() => LT.design({ rows: SHEET, tAbove: { ...tAbove, L: '' } }), /give its span/) && throws(() => LT.design({ rows: SHEET, tAbove: { ...tAbove, loads: [{ type: 'point', a: 7, DL: 1 }] } }), /must lie on the span/));
}
{
  // below: a column of the template (G 49, Q 21 kN) at 3 m on 8 m, own weight 2 kN/m
  const D = LT.design({ type: 'column', rows: SHEET, tBelow: { L: 8, a: 3, sw: 2, loads: [] } }), T = D.tB;
  const gA = 49 * 5 / 8 + 8, qA = 21 * 5 / 8, gB = 49 * 3 / 8 + 8, qB = 21 * 3 / 8;
  truth('below: reactions P·b/L + wL/2: left G 38.63, Q 13.13; right 26.38, 7.88', near(T.RA.DL + T.RA.SIDL, gA, 1e-12) && near(T.RA.LL, qA, 1e-12) && near(T.RB.DL + T.RB.SIDL, gB, 1e-12) && near(T.RB.LL, qB, 1e-12));
  truth('… ULS (6.10) and SLS of the reactions', near(T.RA.uls, 1.35 * gA + 1.5 * qA, 1e-9) && near(T.RB.sls, gB + qB, 1e-9));
  const Mg = 49 * 3 * 5 / 8 + 2 * 3 * 5 / 2, Mq = 21 * 3 * 5 / 8;
  truth('… M_max under the column: Pab/L + wx(L − x)/2: 1.35 × 106.88 + 1.5 × 39.38 = 203.34 kNm at 3 m', near(T.Mmax, 1.35 * Mg + 1.5 * Mq, 1e-9) && near(T.xM, 3, 1e-12) && near(T.MmaxSLS, Mg + Mq, 1e-9), [T.Mmax, T.xM]);
  truth('… V_max the larger reaction, ULS', near(T.Vmax, 1.35 * gA + 1.5 * qA, 1e-9));
  const D2 = LT.design({ type: 'column', comb: '6.10ab', rows: SHEET, tBelow: { L: 8, a: 3, sw: 2 } }).tB;
  truth('… (6.10a) and (6.10b): the worse', near(D2.Mmax, Math.max(1.35 * Mg + 1.05 * Mq, 0.925 * 1.35 * Mg + 1.5 * Mq), 1e-9));
  truth('… no footing under it, a limit says so', (() => { const X = LT.design({ type: 'column', rows: SHEET, qa: 150, tBelow: { L: 8, a: 3 } }); return X.foot === null && X.limits.some(l => /stands on a transfer beam/.test(l)); })());
  // a wall from 1 to 5 m on 8 m: w = 97.65 kN/m at ULS over 4 m; R_A = w × 4 × 5/8; the peak at x = 1 + R_A/w = 3.5 m
  const W = LT.design({ type: 'wall', rows: SHEET, tBelow: { L: 8, a: 1, b: 5 } }).tB, w = 97.65, RA = w * 4 * 5 / 8, x = 1 + RA / w;
  truth('below a wall from 1 to 5 m: R_A = 244.13 kN ULS, M_max = R_A·x − w(x − 1)²/2 = 549.28 kNm at 3.5 m', near(W.RA.uls, RA, 1e-9) && near(W.Mmax, RA * x - w * (x - 1) ** 2 / 2, 1e-9) && near(W.xM, 3.5, 1e-9), [W.RA.uls, W.Mmax, W.xM]);
  const P = LT.design({ type: 'column', rows: SHEET, tBelow: { L: 8, a: 3, loads: [{ type: 'point', a: 6, DL: 20, LL: 10 }, { type: 'udl', a: 0, b: 2, SIDL: 5 }] } }).tB;
  const RAg = 49 * 5 / 8 + 20 * 2 / 8 + 10 * 7 / 8, RAq = 21 * 5 / 8 + 10 * 2 / 8;
  truth('… other loads too: a point (20, 0, 10) at 6 m and a UDL of 5 SIDL to 2 m', near(P.RA.DL + P.RA.SIDL, RAg, 1e-9) && near(P.RA.LL, RAq, 1e-9) && near(P.RA.DL + P.RB.DL + P.RA.SIDL + P.RB.SIDL, 49 + 20 + 10, 1e-9));
  truth('… refused: the column off the span, a wall past its end', throws(() => LT.design({ type: 'column', rows: SHEET, tBelow: { L: 8, a: 9 } }), /stand on the span/) && throws(() => LT.design({ type: 'wall', rows: SHEET, tBelow: { L: 8, a: 2, b: 9 } }), /run along the span/));
}
// ---- refusals ----
truth('no rows refused', throws(() => LT.design({ rows: [] }), /Add the rows/));
truth('empty rows are ignored', LT.design({ rows: [{ name: '' }, { name: 'x', pD: 1 }, {}] }).rows.length === 1);
truth('a negative area refused', throws(() => LT.design({ rows: [{ name: 'x', A: -1, aD: 1 }] }), /cannot be negative/));
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
