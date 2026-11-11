// Masonry Bearing and the EC6 core: K (UK NA Table NA.4), fk and its limits, γM (Table NA.1), β and l_efm (6.1.3), Φ_i and
// Φ_m (Annex G) against hand calculation and the JRC Eurocode 6 workshop example; the padstone calculator in the user's
// Drive ("Typical Padstone.xlsx": stresses and limits where its rules and EC6 meet); EC2 6.7 on a concrete padstone; the
// spreader rule; the wall at mid-height; the eccentricity limit; input errors; padstone sizing.
const { EC6, MasonryBearing: MB } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol = 1e-9) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const S3 = Math.sqrt(3);

// ---------- K, UK NA Table NA.4 (general purpose, thin layer, lightweight 600-800, 800-1500) ----------
const NA4 = { clay: { 1: [0.50, 0.75, 0.30, 0.40], 2: [0.40, 0.70, 0.25, 0.30] }, cs: { 1: [0.50, 0.80, null, null], 2: [0.40, 0.70, null, null] },
  agg: { 1: [0.55, 0.80, 0.45, 0.45], 2: [0.52, 0.76, 0.45, 0.45] }, aggflat: { 1: [0.50, 0.70, 0.40, 0.40] }, aac: { 1: [0.55, 0.80, 0.45, 0.45] },
  mstone: { 1: [0.45, 0.75, null, null] }, nstone: { 1: [0.45, null, null, null] } };
for (const [u, gs] of Object.entries(NA4)) for (const [g, row] of Object.entries(gs)) ['M4', 'TL', 'LW1', 'LW2'].forEach((mo, i) => {
  const m = { unit: u, group: +g, fb: 10, mortar: mo, fm: 5 };
  if (row[i] == null) throws(`K: ${u} G${g} ${mo} has no UK value`, () => EC6.fk(m), /no value of K/);
  else near(`K: ${u} G${g} ${mo}`, EC6.fk(m).K, row[i]);
});
throws('K: AAC Group 2 is not in the UK NA', () => EC6.fk({ unit: 'aac', group: 2, fb: 5, mortar: 'M4' }), /Group 1 only/);
// ---------- fk ----------
near('fk clay G1 fb 20 M4 = 0.5 × 20^0.7 × 4^0.3', EC6.fk({ unit: 'clay', group: 1, fb: 20, mortar: 'M4' }).fk, 0.5 * 20 ** 0.7 * 4 ** 0.3);
near('fk M2, M6, M12 use fm = the class', EC6.fk({ unit: 'cs', group: 1, fb: 30, mortar: 'M6' }).fk, 0.5 * 30 ** 0.7 * 6 ** 0.3);
near('fk thin layer, clay G2: K fb^0.7 (eq. 3.3)', EC6.fk({ unit: 'clay', group: 2, fb: 30, mortar: 'TL' }).fk, 0.70 * 30 ** 0.7);
near('fk thin layer, aggregate G1: K fb^0.85 (eq. 3.2)', EC6.fk({ unit: 'agg', group: 1, fb: 10, mortar: 'TL' }).fk, 0.80 * 10 ** 0.85);
near('fk thin layer, clay G1: K fb^0.85', EC6.fk({ unit: 'clay', group: 1, fb: 40, mortar: 'TL' }).fk, 0.75 * 40 ** 0.85);
near('fk lightweight: fm as given', EC6.fk({ unit: 'agg', group: 1, fb: 7, mortar: 'LW2', fm: 5 }).fk, 0.45 * 7 ** 0.7 * 5 ** 0.3);
near('fb ≤ 110 in general purpose mortar', EC6.fk({ unit: 'clay', group: 1, fb: 150, mortar: 'M12' }).fk, 0.5 * 110 ** 0.7 * 12 ** 0.3);
near('fb ≤ 50 in thin layer mortar', EC6.fk({ unit: 'aac', group: 1, fb: 60, mortar: 'TL' }).fk, 0.8 * 50 ** 0.85);
near('fm ≤ 2 fb', EC6.fk({ unit: 'agg', group: 1, fb: 3, mortar: 'M12' }).fk, 0.55 * 3 ** 0.7 * 6 ** 0.3);
near('lightweight fm ≤ 10', EC6.fk({ unit: 'clay', group: 1, fb: 30, mortar: 'LW2', fm: 12 }).fk, 0.4 * 30 ** 0.7 * 10 ** 0.3);
near('joint parallel to the face: K × 0.8 (general purpose)', EC6.fk({ unit: 'clay', group: 1, fb: 20, mortar: 'M4', collar: true }).K, 0.4);
near('joint parallel to the face: no factor in thin layer mortar', EC6.fk({ unit: 'clay', group: 1, fb: 20, mortar: 'TL', collar: true }).K, 0.75);
near('formed voids 20 %: K × 0.8', EC6.fk({ unit: 'agg', group: 1, fb: 10, mortar: 'M4', voids: 20 }).K, 0.55 * 0.8);
{ const F = EC6.fk({ unit: 'agg', group: 1, fb: 10, mortar: 'M4', voids: 30 }); near('formed voids over 25 %: 25 % used', F.K, 0.55 * 0.75); truth('formed voids over 25 %: noted', F.notes.some(x => /25 %/.test(x))); }
near('formed voids: Group 2 aggregate units unaffected', EC6.fk({ unit: 'agg', group: 2, fb: 10, mortar: 'M4', voids: 20 }).K, 0.52);
throws('fb must be positive', () => EC6.fk({ unit: 'clay', group: 1, fb: 0, mortar: 'M4' }), /positive/);
// JRC workshop (Haseltine): 10.4 N/mm² blocks 150 wide in M4 give fk = 5.1 N/mm²; fb = 10.4 × 1.28 (shape factor, 215 high)
near('JRC example: fk = 5.1 N/mm² for 10.4 N/mm² blocks in M4', EC6.fk({ unit: 'agg', group: 1, fb: 10.4 * 1.28, mortar: 'M4' }).fk, 5.1, 0.01);
near('JRC example: fk = 2.45 N/mm² for 3.6 N/mm² blocks in M4', EC6.fk({ unit: 'agg', group: 1, fb: 3.6 * 1.28, mortar: 'M4' }).fk, 2.45, 0.015);

// ---------- γM, UK NA Table NA.1 ----------
near('γM compression, category I, class 1', EC6.gammaM({ category: 'I', exec: 1 }), 2.3); near('γM compression, category I, class 2', EC6.gammaM({ category: 'I', exec: 2 }), 2.7);
near('γM compression, category II, class 1', EC6.gammaM({ category: 'II', exec: 1 }), 2.6); near('γM compression, category II, class 2', EC6.gammaM({ category: 'II', exec: 2 }), 3.0);
near('γM flexure, class 1', EC6.gammaM({ category: 'II', exec: 1, kind: 'flexure' }), 2.3); near('γM flexure, class 2', EC6.gammaM({ exec: 2, kind: 'flexure' }), 2.7);
near('γM shear', EC6.gammaM({ exec: 1, kind: 'shear' }), 2.5); near('γM wall ties', EC6.gammaM({ kind: 'ties' }), 3.5);
near('γM accidental: halved', EC6.gammaM({ category: 'II', exec: 2, accidental: true }), 1.5);

// ---------- Φ and t_ef (JRC example: 4-storey house, 150 + 150 cavity wall) ----------
near('t_ef = ∛(150³ + 150³) = 189 mm', EC6.tefCavity(150, 150), 189, 0.002);
near('t_ef: the unloaded leaf taken no thicker than the loaded', EC6.tefCavity(150, 100), Math.cbrt(2) * 100);
near('Φ_i = 1 − 2 × 21.87/150 = 0.70 (JRC)', EC6.phiI(21.87, 150).phi, 1 - 2 * 21.87 / 150);
near('Φ_i with e_i under 0.05t: 0.9', EC6.phiI(3, 150).phi, 0.9);
{ const lam = 1630 / 189 / Math.sqrt(1000), u = (lam - 0.063) / (0.73 - 1.17 * 0.05), exp = 0.9 * Math.exp(-u * u / 2);
  near('Φ_m, Annex G, h_ef/t_ef = 8.62, e_mk = 0.05t', EC6.phiM(1630, 189, 3.62, 150).phi, exp);
  near('Φ_m = 0.85 read from Figure G.1 (JRC)', EC6.phiM(1630, 189, 3.62, 150).phi, 0.85, 0.02); }
{ const lam = 27 / Math.sqrt(1000), u = (lam - 0.063) / (0.73 - 1.17 * 0.3); near('Φ_m, h_ef/t_ef = 27, e_mk = 0.3t', EC6.phiM(2700, 100, 30, 100).phi, 0.4 * Math.exp(-u * u / 2)); }
near('Φ_m = 0 when e_mk reaches t/2', EC6.phiM(2000, 100, 50, 100).phi, 0);
near('e_init = h_ef/450', EC6.einit(1800), 4);
near('small area: 0.7 + 3A for A < 0.1 m²', EC6.smallArea(0.0946e6), 0.7 + 3 * 0.0946); near('small area: 1 from 0.1 m²', EC6.smallArea(0.1e6), 1);

// ---------- β and l_efm (6.1.3) ----------
near('l_efm: 60° spread both sides', EC6.lefm(100, 1000, 1000, 1200).l, 100 + 2 * 1200 / S3);
near('l_efm: stopped at the end of the wall', EC6.lefm(100, 0, 1000, 1200).l, 100 + 1200 / S3);
near('l_efm: stopped part-way', EC6.lefm(100, 200, 1000, 1200).l, 100 + 200 + 1200 / S3);
near('β: a1 = 0, A_b/A_ef = 0.2: 1.28 capped at 1.25', EC6.beta(0, 2400, 0.2, 1).beta, 1.25);
near('β: a1 = h_c/2, small area: 1.725 capped at 1.5', EC6.beta(1200, 2400, 1e-6, 1).beta, 1.5);
near('β: a1 = 300, h_c = 2400, ratio 0.3', EC6.beta(300, 2400, 0.3, 1).beta, (1 + 0.3 * 300 / 2400) * (1.5 - 1.1 * 0.3));
near('β: A_b/A_ef over 0.45 taken as 0.45', EC6.beta(0, 2400, 0.6, 1).beta, 1.5 - 1.1 * 0.45);
near('β ≥ 1', EC6.beta(0, 2400, 0.45, 1).raw, 1.005); near('β one: 1', EC6.beta(1200, 2400, 0.01, 1, { one: true }).beta, 1);

// ---------- the padstone calculator: 35 kN on a 200 × 100 bearing, fk 1.23, γm 3; padstone 500 long, 200 wide, fk 10.5 ----------
const sheet = { N: 35e3, t: 200, hc: 6500, aL: 150, aR: 3000, lb: 200, wb: 100, inset: 0, mas: { src: 'fk', fk: 1.23, group: 1, category: 'II', exec: 2, betaOne: true } };
{ const D = MB.design(sheet);
  near('sheet: actual bearing stress 35000/(200 × 100) = 1.75 N/mm²', D.D0.sigma, 1.75);
  near('sheet: γ_M = 3.0 (category II, class 2), f_d = 1.23/3 = 0.41', D.fd, 0.41);
  near('sheet: maximum bearing stress with bearing factor 1.0 = 0.41 N/mm²', D.D0.limit, 0.41);
  truth('sheet: "Padstone Required"', D.padNeeded && D.checks.find(c => c.id === 'bear').util > 1);
  near('sheet: the load at the face of a 200 wall from a 100 bearing: e = t/4, allowed', D.checks.find(c => c.id === 'ecc').util, 1); }
{ const D = MB.design({ ...sheet, mas: { ...sheet.mas, betaOne: false }, pad: { L: 500, W: 200, h: 260, mat: 'masonry', fk: 10.5 } }), P = D.P;
  near('padstone flush with the end of the wall', P.xp, 0); near('60° through 260 mm reaches the padstone ends: l_pe = 500', P.lpe, 500, 1e-12);
  near('sheet: stress under the padstone 35000/(500 × 200) = 0.35 N/mm²', P.U.sigma, 0.35);
  near('sheet: allowable masonry stress 1.25 × 1.23/3 = 0.5125 (β at its 1.25 cap, a1 = 0)', P.U.limit, 0.5125);
  truth('not a spreader: 500 is not more than 3 × 200', !P.spreader && P.crit.h && !P.crit.L && P.crit.W);
  near('padstone stress under the beam 1.75 N/mm² (sheet F42)', P.on.sigma, 1.75);
  near('masonry padstone: f_k,pad/γ_M = 10.5/3 (the sheet allows 1.25 × that)', P.on.limit, 3.5);
  truth('sheet: both padstone checks pass, as in the sheet', D.utilMax <= 1);
  const raw = (1 + 0.3 * 150 / 6500) * (1.5 - 1.1 * 20000 / ((200 + 150 + 3250 / S3) * 200));
  near('without the padstone, EC6 β at a1 = 150: capped at 1.25 + a1/2h_c', D.D0.B.beta, Math.min(raw, 1.25 + 150 / 13000));
  truth('without the padstone it is still needed', D.padNeeded); }

// ---------- a concrete padstone (BS EN 1992-1-1 6.7) and the spreader rule ----------
const wall = { N: 100e3, t: 215, hc: 2400, aL: 1000, aR: 1000, lb: 100, wb: 100, inset: 57.5, mas: { src: 'fk', fk: 5, group: 1, category: 'I', exec: 2 } };
{ const D = MB.design({ ...wall, pad: { L: 440, W: 215, h: 215, mat: 'concrete', fck: 30, reinforced: true } }), P = D.P;
  near('padstone centred on the bearing', P.xp, 830); near('A_c1 scale: min(3, 1 + h/b, 2c_x/b, 2c_y/d) = 2.15', P.on.k, 2.15);
  near('F_Rdu = A_c0 × 0.85 × 30/1.5 × 2.15', P.on.FRdu, 10000 * 17 * 2.15);
  truth('a spreader: 215 > 200, 440 > 3 × 100, as wide as the wall', P.spreader);
  near('l_pe = l_b + 2 × h_p/√3', P.lpe, 100 + 2 * 215 / S3);
  near('masonry under the spreader: σ = N/(l_pe t)', P.U.sigma, 100e3 / ((100 + 2 * 215 / S3) * 215));
  near('masonry under the spreader: limit 1.5 f_d', P.U.limit, 1.5 * 5 / 2.7);
  near('e = 0 for a centred bearing', D.e, 0); }
{ const D = MB.design({ ...wall, pad: { L: 440, W: 215, h: 215, mat: 'concrete', fck: 30, reinforced: false } });
  near('plain padstone: 0.6 f_ck/1.5, no enhancement (EC2 12.3.1)', D.P.on.FRdu, 10000 * 12); }
{ const D = MB.design({ ...wall, pad: { L: 440, W: 215, h: 100, mat: 'concrete', fck: 30, reinforced: true } });
  truth('100 deep: not a spreader, β from 6.1.3', !D.P.spreader && D.P.U.B);
  near('A_c1 limited by the depth: 1 + 100/100', D.P.on.k, 2);
  near('h_c − h_p under the padstone', D.P.U.hc, 2300); }
{ const D = MB.design({ ...wall, aL: 0, pad: { L: 440, W: 215, h: 215, mat: 'concrete', fck: 30, reinforced: true } });
  near('end of the wall: the padstone flush with it', D.P.xp, 0); near('end: A_c1 limited by the near end, 2 × 50/100', D.P.on.k, 1);
  near('end: l_pe one-sided', D.P.lpe, 100 + 215 / S3); }

// ---------- the wall at mid-height ----------
{ const mid = { h: 2400, rho: 0.75, q: 10, t2: 0 }, D = MB.design({ ...wall, mid, pad: { L: 440, W: 215, h: 215, mat: 'concrete', fck: 30, reinforced: true } }), W = D.W;
  const lm = 100 + 2 * 215 / S3 + 2 * (2185 / 2) / S3, nC = 100e3 / lm, emk = Math.max(1800 / 450, 0.05 * 215);
  const lam = 1800 / 215 / Math.sqrt(1000), u = (lam - 0.063) / (0.73 - 1.17 * emk / 215), phi = (1 - 2 * emk / 215) * Math.exp(-u * u / 2);
  near('mid-height: l_efm from the padstone base, at (h_c − h_p)/2', W.lm, lm);
  near('mid-height: N = N_Ed/l_efm + other load', W.Nmd, nC + 10); near('mid-height: Φ_m', W.F.phi, phi);
  near('mid-height: N_Rd = Φ_m t f_d', W.NRd, phi * 215 * 5 / 2.7); near('mid-height utilisation', W.util, (nC + 10) / (phi * 215 * 5 / 2.7)); }
{ const D = MB.design({ ...wall, inset: 0, wb: 60, mid: { h: 2400, rho: 1, q: 0, t2: 100 } }), W = D.W, e = 107.5 - 30;
  near('mid-height: e from the bearing, half of N e at mid-height + e_init', W.em, 0.5 * e + 2400 / 450);
  near('mid-height: cavity wall t_ef', W.tef, Math.cbrt(100 ** 3 + 215 ** 3)); }
{ const D = MB.design({ ...wall, aL: 170, aR: 170, mid: { h: 2400, rho: 0.75, q: 0, t2: 0 } });
  near('a pier 440 × 215: f_d × (0.7 + 3A)', D.W.fA, 0.7 + 3 * 440 * 215 / 1e6); }

// ---------- eccentricity across the wall, β = 1 cases ----------
{ const D = MB.design({ ...wall, inset: 0 }); near('e = t/2 − w_b/2', D.e, 57.5); near('e > t/4 fails 6.1.3(4)', D.checks.find(c => c.id === 'ecc').util, 57.5 / 53.75);
  truth('e > t/4: β = 1', D.D0.B.beta === 1 && /t\/4/.test(D.D0.B.reason)); }
{ const D = MB.design({ ...wall, inset: 3.75 }); near('e = t/4 exactly: allowed', D.checks.find(c => c.id === 'ecc').util, 1); truth('e = t/4: β enhanced', D.D0.B.beta > 1); }
{ const D = MB.design({ ...wall, mas: { ...wall.mas, group: 2 } }); truth('Group 2: β = 1', D.D0.B.beta === 1); truth('Group 2: a Group 1 unit or padstone advised (6.1.3(6))', D.warnings.some(w => /Group 1 unit/.test(w))); }
{ const D = MB.design({ ...wall, mas: { ...wall.mas, shell: true } }); truth('shell bedded: β = 1', D.D0.B.beta === 1); }
{ const D = MB.design(wall), B = D.D0.B, a1 = 1000, lef = 100 + 2 * 1200 / S3, raw = (1 + 0.3 * a1 / 2400) * (1.5 - 1.1 * 10000 / (lef * 215));
  const b = Math.min(raw, 1.25 + a1 / (2 * 2400), 1.5);
  near('bearing on the masonry: β capped at 1.25 + a1/2h_c', B.beta, b); near('N_Rdc = β A_b f_d', D.D0.NRdc, b * 10000 * 5 / 2.7); }
{ const D = MB.design({ ...wall, mas: { src: 'calc', unit: 'clay', group: 1, fb: 20, mortar: 'M4', category: 'I', exec: 1 } }); near('f_d from the units and mortar', D.fd, 0.5 * 20 ** 0.7 * 4 ** 0.3 / 2.3); }

// ---------- input errors ----------
throws('bearing past the far face', () => MB.design({ ...wall, inset: 150 }), /far face/);
throws('padstone longer than the wall', () => MB.design({ ...wall, pad: { L: 2200, W: 215, h: 140, mat: 'concrete', fck: 30 } }), /longer than the wall/);
throws('padstone wider than the wall', () => MB.design({ ...wall, pad: { L: 440, W: 300, h: 140, mat: 'concrete', fck: 30 } }), /wider than the wall/);
throws('padstone shorter than the bearing', () => MB.design({ ...wall, pad: { L: 80, W: 215, h: 140, mat: 'concrete', fck: 30 } }), /shorter than the bearing/);
throws('padstone as deep as the wall', () => MB.design({ ...wall, hc: 200, pad: { L: 440, W: 215, h: 215, mat: 'concrete', fck: 30 } }), /as deep as/);
throws('bearing off a narrow padstone', () => MB.design({ ...wall, inset: 0, pad: { L: 440, W: 100, h: 140, mat: 'concrete', fck: 30 } }), /not on the/);
throws('no load', () => MB.design({ ...wall, N: 0 }), /positive/);

// ---------- sizing a padstone ----------
{ const inp = { N: 40e3, t: 100, hc: 2400, aL: 1500, aR: 1500, lb: 133, wb: 100, inset: 0, mas: { src: 'calc', unit: 'agg', group: 1, fb: 10, mortar: 'M4', category: 'I', exec: 2 },
    pad: { mat: 'concrete', fck: 30, reinforced: false, L: 215, W: 100, h: 100 }, mid: { h: 2400, rho: 0.75, q: 20, t2: 100 } };
  truth('the default case needs a padstone', MB.design({ ...inp, pad: null }).padNeeded);
  const S = MB.suggest(inp); truth('a padstone is found and passes', S && S.D.utilMax <= 1 && S.pad.W === 100);
  const L = [215, 327, 440, 552, 665, 777, 890, 1002, 1115, 1340, 1565, 1790, 2015], H = [100, 140, 215, 300];
  const smaller = L.flatMap(l => H.map(h => ({ l, h }))).filter(o => o.l * o.h < S.pad.L * S.pad.h && o.l >= 133);
  truth(`no smaller padstone passes (${S.pad.L} × ${S.pad.h}; ${smaller.length} smaller tried)`, smaller.every(o => { try { return MB.design({ ...inp, pad: { ...inp.pad, L: o.l, h: o.h, W: 100 } }).utilMax > 1; } catch (e) { return true; } }));
  truth('no padstone can carry 2 MN on this wall', MB.suggest({ ...inp, N: 2000e3 }) === null); }

console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
