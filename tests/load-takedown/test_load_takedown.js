// Load Take-down engine: the column load in Mosley, Bungey and Hulse, Reinforced Concrete Design to Eurocode 2 (7th ed.),
// Example 6.7 (published: eight storeys of (1.35 × 6 + 1.5 × 3) kN/m² on 22.75 m², whose 3% is 69 kN); the UK National Annex
// imposed loads, roof loads and reductions as the IStructE Manual for the design of building structures to Eurocode 1,
// Tables 3.1 and 3.5 and 3.7.3.4; and the combinations, snow and roof imposed loads, self-weight and the hipped roof by hand.
//   node tests/load-takedown/test_load_takedown.js
const { LoadTakedown: LT } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

// ---- Mosley et al. Example 6.7: column at ground level, eight floors of gk 6 + qk 3 on 3.5 × 6.5 m ----
{
  const levels = Array.from({ length: 8 }, (_, i) => ({ name: `L${8 - i}`, bu: 'F', trib: 3.5 * 6.5 }));
  const D = LT.design({ type: 'column', red: 'none', comb: '6.10', buildups: [{ id: 'F', name: 'Floor', cat: 'B1', qGiven: true, q: 3, items: [{ d: 'floor', g: 6 }] }], levels });
  truth('Ex 6.7: column load 8 × (1.35 × 6 + 1.5 × 3) × 22.75 = 2293 kN (3% = 69 kN)', near(D.base.uls, 2293.2, 0.05) && near(0.03 * D.base.uls, 69, 0.3), D.base.uls);
  truth('Ex 6.7: with α_n for 8 storeys (0.6): 1.35 × 1092 + 1.5 × 0.6 × 546 = 1965.6 kN', near(LT.design({ type: 'column', red: 'an', buildups: [{ id: 'F', name: 'Floor', cat: 'B1', qGiven: true, q: 3, items: [{ d: 'floor', g: 6 }] }], levels }).base.uls, 1.35 * 1092 + 1.5 * 0.6 * 546, 1e-9));
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
// ---- build-ups ----
{
  const b = LT.buildup({ id: 'R', name: 'Roof', pitch: 30, cat: 'H', snow: 0.5, items: [{ d: 'tiles', g: 0.6, on: 'slope' }, { d: 'ceiling', g: 0.2 }, { d: 'slab', t: 200, rho: 25 }] });
  truth('build-up: on slope ÷ cos 30°, plan as given, t × ρ', near(b.G, 0.6 / Math.cos(Math.PI / 6) + 0.2 + 5, 1e-12) && near(b.q, 0.6, 1e-12) && b.S === 0.5);
  const f = LT.buildup({ id: 'F', name: 'F', cat: 'A1', part: 0.8, items: [{ g: 1 }] });
  truth('build-up: imposed + partitions (6.3.1.2(8))', near(f.Q, 2.3, 1e-12) && f.grp === 'A');
  truth('build-up: given imposed load (not reduced)', LT.buildup({ id: 'X', name: 'X', cat: 'X', q: 7.5, items: [] }).Q === 7.5);
}
// ---- the default wall: a three-storey block of flats ----
const R = { id: 'R', name: 'Roof', pitch: 35, cat: 'H', snow: 0.45, items: [{ d: 'tiles', g: 0.55, on: 'slope' }, { d: 'battens', g: 0.05, on: 'slope' }, { d: 'trusses', g: 0.15, on: 'slope' }, { d: 'insulation', g: 0.05 }, { d: 'ceiling', g: 0.15 }] };
const F = { id: 'F', name: 'Floor', cat: 'A1', part: 0.5, items: [{ d: 'slab', t: 150, rho: 25 }, { d: 'screed', t: 65, rho: 22 }, { d: 'ceiling', g: 0.5 }] };
const LV = [{ name: 'Roof', bu: 'R', trib: 4.5, h: 2.7, sw: 2.4 }, { name: '2nd', bu: 'F', trib: 2.25, h: 2.7, sw: 2.4 }, { name: '1st', bu: 'F', trib: 2.25, h: 2.7, sw: 2.4 }, { name: 'Ground', h: 0.6, sw: 2.4 }];
{
  const D = LT.design({ type: 'wall', red: 'an', comb: '6.10', qa: 100, buildups: [R, F], levels: LV });
  const gR = (0.75 / Math.cos(35 * Math.PI / 180) + 0.2), gF = 3.75 + 1.43 + 0.5, G = gR * 4.5 + 2 * gF * 2.25 + 3 * 2.4 * 2.7 + 2.4 * 0.6, Q = 0.9 * 2 * 2.0 * 2.25, H = 0.5 * 4.5, S = 0.45 * 4.5;
  truth('wall: G_k at the base by hand', near(D.base.cum.G, G, 1e-9), [D.base.cum.G, G]);
  truth('wall: Q_k × α_n (2 storeys, 0.9)', near(D.base.Q, Q, 1e-9) && near(D.base.alpha, 0.9, 1e-12));
  truth('wall: roof imposed 0.5 kN/m² (35°) governs over snow 0.45, not both', near(D.base.R, H, 1e-12) && D.base.roofIs === 'H');
  truth('wall: (6.10) the worst variable leading: 1.35G + 1.5Q + 1.05H', near(D.base.uls, Math.max(1.35 * G + 1.5 * Q + 1.05 * H, 1.35 * G + 1.5 * H + 1.05 * Q, 1.35 * G + 1.5 * Q + 0.75 * S, 1.35 * G + 1.5 * S + 1.05 * Q), 1e-9), D.base.uls);
  truth('wall: (6.14b) characteristic G + Q + 0.7H', near(D.base.sls, G + Q + 0.7 * H, 1e-9), D.base.sls);
  truth('wall: strip width = characteristic/100', near(D.foot.b, D.base.sls / 100, 1e-12));
  const ab = LT.design({ type: 'wall', red: 'an', comb: '6.10ab', buildups: [R, F], levels: LV }).base;
  truth('wall: the worse of (6.10a) and (6.10b)', near(ab.uls, Math.max(1.35 * G + 1.05 * Q + 1.05 * H, 1.35 * G + 0.75 * S + 1.05 * Q, 1.249 * G + 1.5 * Q + 1.05 * H, 1.249 * G + 1.5 * H + 1.05 * Q, 1.249 * G + 1.5 * Q + 0.75 * S, 1.249 * G + 1.5 * S + 1.05 * Q), 1e-3) && ab.uls < LT.design({ type: 'wall', red: 'an', comb: '6.10', buildups: [R, F], levels: LV }).base.uls, ab.uls);
  truth('wall: no reduction gives the full Q', near(LT.design({ type: 'wall', red: 'none', buildups: [R, F], levels: LV }).base.Q, 2 * 2 * 2.25, 1e-12));
  const snow = LT.design({ type: 'wall', red: 'an', buildups: [{ ...R, snow: 1.2 }, F], levels: LV }).base;
  truth('wall: heavier snow governs the roof instead', snow.roofIs === 'S' && near(snow.R, 1.2 * 4.5, 1e-12));
  truth('rows: running totals grow down the building', D.rows.every((r, i) => i === 0 || r.cum.G > D.rows[i - 1].cum.G) && D.rows.length === 4);
  truth('footing self-weight is taken off the bearing pressure', near(LT.design({ type: 'wall', red: 'an', qa: 100, fw: 14.4, buildups: [R, F], levels: LV }).foot.b, D.base.sls / 85.6, 1e-12));
}
// ---- columns: α_A where it is smaller ----
{
  const lv = [{ name: 'L2', bu: 'F', trib: 40, h: 3, sw: 3 }, { name: 'L1', bu: 'F', trib: 40, h: 3, sw: 3 }];
  const an = LT.design({ type: 'column', red: 'an', buildups: [F], levels: lv }).base, best = LT.design({ type: 'column', red: 'best', buildups: [F], levels: lv }).base;
  truth('column: α_n 0.9 for 2 storeys; α_A = 1 − 80/1000 = 0.92 is larger, so α_n stays', near(an.alpha, 0.9, 1e-12) && near(best.alpha, 0.9, 1e-12));
  const lv2 = [{ name: 'L2', bu: 'F', trib: 150, h: 3, sw: 3 }, { name: 'L1', bu: 'F', trib: 150, h: 3, sw: 3 }];
  const b2 = LT.design({ type: 'column', red: 'best', buildups: [F], levels: lv2 }).base;
  truth('column: α_A = 1 − 300/1000 → 0.75 is smaller than α_n 0.9, used alone', near(b2.alpha, 0.75, 1e-12) && /α_A/.test(b2.how));
  truth('column: self-weight kN/m × height', near(an.cum.G, 2 * (3.75 + 1.43 + 0.5) * 40 + 2 * 9, 1e-9));
  truth('column: pad side √(char/q_a)', near(LT.design({ type: 'column', red: 'an', qa: 150, buildups: [F], levels: lv }).foot.s, Math.sqrt(an.sls / 150), 1e-12));
}
// ---- hipped roof ----
{
  const D = LT.design({ type: 'wall', buildups: [R, F], levels: LV, hip: { B: 9, L: 20, bu: 'R' } });
  const gR = 0.75 / Math.cos(35 * Math.PI / 180) + 0.2;
  truth('hip: side walls q·B/2 between the hips', near(D.hip.G.side, gR * 4.5, 1e-12) && near(D.hip.R.side, 0.5 * 4.5, 1e-12));
  truth('hip: end walls peak q·B/2, average q·B/4', near(D.hip.G.endPeak, gR * 4.5, 1e-12) && near(D.hip.G.endAvg, gR * 2.25, 1e-12));
  truth('hip: the four faces add up to the whole plan', near(2 * D.hip.areaEnd + 2 * D.hip.areaSide, 9 * 20, 1e-9) && near(2 * D.hip.G.endTot + 2 * D.hip.G.sideTot, gR * 180, 1e-9));
  truth('hip: half to the plates halves them', near(LT.design({ type: 'wall', buildups: [R, F], levels: LV, hip: { B: 9, L: 20, bu: 'R', f: 0.5 } }).hip.G.side, gR * 2.25, 1e-12));
  truth('hip: L shorter than B is refused', throws(() => LT.design({ type: 'wall', buildups: [R, F], levels: LV, hip: { B: 9, L: 6, bu: 'R' } }), /at least the width/));
}
// ---- refusals ----
truth('no levels refused', throws(() => LT.design({ buildups: [R], levels: [] }), /Add the levels/));
truth('a level pointing at a missing build-up refused', throws(() => LT.design({ buildups: [R], levels: [{ name: 'X', bu: 'Q', trib: 1 }] }), /not found/));
truth('footing heavier than the bearing pressure: no size, a limit', (() => { const D = LT.design({ buildups: [R, F], levels: LV, qa: 50, fw: 60 }); return D.foot === null && D.limits.some(l => /less than the allowable/.test(l)); })());
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
