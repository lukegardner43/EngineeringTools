// RC Slab FE Design: node test_rc_fe.js
// 1 The MITC4 plate against closed forms and series (Timoshenko & Woinowsky-Krieger, Theory of Plates and Shells, 1959):
//   a cylindrically bent strip (exact Timoshenko beam), simply supported rectangles by the Navier series with the Mindlin
//   shear term, a point load (Navier), the clamped square (Table 35), an interior panel of a flat plate on a square
//   grid of point supports (a doubly periodic Fourier series; Timoshenko's 0.00581 q a^4 / D), mesh convergence,
//   equilibrium of the reactions.
// 2 The slab design layer: equilibrium with columns, walls, edges, openings and every load type; symmetry; the
//   Wood–Armer rules; the pattern envelope; the EC2 steel, A_s,min and the zones; the column moments; punching against
//   the RC Punching Shear engine; the long-term section terms against the EC2 core; creep and shrinkage (Annex B, 3.1.4)
//   by hand; errors.
const { EC2, Punching, PlateFEM: P, SlabFEM } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale = null) => { n++; const e = Math.abs(got - exp) / Math.max(Math.abs(scale ?? exp), 1e-12); const ok = e <= tol; if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(8)} expected ${(+exp).toPrecision(8)} (${e.toExponential(2)})`); if (!ok) fails++; };
const truth = (name, c) => { n++; if (!c || process.env.V) console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, fn, re) => { let m = ''; try { fn(); } catch (e) { m = e.message; } truth(`${name} (${m || 'no error'})`, re.test(m)); };
const T = 1e-9, E = 30e6;

// ---------- 1 the plate ----------
function plate({ a, b, h, nu, el, bc, loads, extra = [] }) {
  const D = E * h ** 3 / (12 * (1 - nu * nu)), Ds = 5 / 6 * E / (2 * (1 + nu)) * h;
  const xs = P.lines([0, a / 4, a / 2, 3 * a / 4, a, ...extra.map(p => p[0])], el), ys = P.lines([0, b / 4, b / 2, 3 * b / 4, b, ...extra.map(p => p[1])], el), M = P.mesh(xs, ys), fixed = new Uint8Array(3 * M.nn);
  for (let k = 0; k < M.nn; k++) bc(M.X(k), M.Y(k), k, fixed);
  const sys = P.assemble({ mesh: M, Db: P.iso(D, nu), Ds, fixed }), F = new Float64Array(3 * M.nn); loads(M, F);
  const u = P.solve(sys, F), R = P.results(sys, u), r = P.residual(sys, u, F);
  const w = (x, y) => u[3 * P.nearestNode(M, x, y)];
  const mAt = (x, y, k) => { let best = 0, bd = 1e9; for (let e = 0; e < M.nEl; e++) { const xc = (M.xs[M.ci[e]] + M.xs[M.ci[e] + 1]) / 2, yc = (M.ys[M.cj[e]] + M.ys[M.cj[e] + 1]) / 2, dd = Math.hypot(xc - x, yc - y); if (dd < bd) { bd = dd; best = e; } } return R[6 * best + k]; };
  let Rw = 0; for (let k = 0; k < M.nn; k++) if (fixed[3 * k]) Rw -= r[3 * k];
  let load = 0; for (let k = 0; k < M.nn; k++) load += F[3 * k];
  return { D, Ds, M, u, R, w, mAt, Rw, load };
}
const ssAll = a => (x, y, k, f) => { if (x < T || x > a - T) { f[3 * k] = 1; f[3 * k + 2] = 1; } if (y < T || y > a - T) { f[3 * k] = 1; f[3 * k + 1] = 1; } };
// cylindrical bending, nu = 0: the Timoshenko beam w = 5 q L^4 / 384 EI + q L^2 / 8 kGA, M = q x (L - x) / 2
for (const el of [0.25, 0.125]) {
  const a = 6, r = plate({ a, b: 2, h: 0.2, nu: 0, el, bc: (x, y, k, f) => { if (x < T || x > a - T) { f[3 * k] = 1; f[3 * k + 2] = 1; } }, loads: (M, F) => P.udl(M, F, 1) });
  near(`strip, elements ${el} m: midspan deflection (Timoshenko beam)`, r.w(3, 1), 5 * a ** 4 / (384 * r.D) + a * a / (8 * r.Ds), el > 0.2 ? 3e-3 : 8e-4);
  for (const x of [a / 2 + el / 2, a / 4 + el / 2]) near(`strip, elements ${el} m: m_x at x = ${x} (statics)`, r.mAt(x, 1, 0), x * (a - x) / 2, el > 0.2 ? 3e-3 : 8e-4);
  near(`strip, elements ${el} m: reactions carry the load`, r.Rw, r.load, 1e-9);
}
// simply supported rectangles: Navier with the Mindlin shear term, w = sum q_mn (1/(D k^4) + 1/(kGh k^2)) sin sin
function navier(a, b, D, Ds, nu, x, y, q = 1, pt = null) {
  let w = 0, mx = 0, my = 0;
  for (let m = 1; m < 300; m++) for (let k = 1; k < 300; k++) {
    let qmn; if (pt) qmn = 4 * pt[2] / (a * b) * Math.sin(m * Math.PI * pt[0] / a) * Math.sin(k * Math.PI * pt[1] / b); else { if (m % 2 === 0 || k % 2 === 0) continue; qmn = 16 * q / (Math.PI ** 2 * m * k); }
    const am = m * Math.PI / a, bk = k * Math.PI / b, k2 = am * am + bk * bk, s = Math.sin(am * x) * Math.sin(bk * y), wb = qmn / (D * k2 * k2);
    w += (wb + qmn / (Ds * k2)) * s; mx += D * wb * s * (am * am + nu * bk * bk); my += D * wb * s * (bk * bk + nu * am * am);
  }
  return { w, mx, my };
}
for (const [a, b] of [[6, 6], [9, 6]]) {
  let prev = null;
  for (const el of [0.5, 0.25, 0.125]) {
    const r = plate({ a, b, h: 0.2, nu: 0.2, el, bc: (x, y, k, f) => { if (x < T || x > a - T) { f[3 * k] = 1; f[3 * k + 2] = 1; } if (y < T || y > b - T) { f[3 * k] = 1; f[3 * k + 1] = 1; } }, loads: (M, F) => P.udl(M, F, 5) });
    const ref = navier(a, b, r.D, r.Ds, 0.2, a / 2, b / 2, 5), err = Math.abs(r.w(a / 2, b / 2) / ref.w - 1);
    near(`SS ${a} x ${b}, elements ${el} m: centre deflection (Navier, Mindlin)`, r.w(a / 2, b / 2), ref.w, { 0.5: 6e-3, 0.25: 1.5e-3, 0.125: 4e-4 }[el]);
    const xc = a / 2 + el / 2, yc = b / 2 + el / 2, rm = navier(a, b, r.D, r.Ds, 0.2, xc, yc, 5);
    near(`SS ${a} x ${b}, elements ${el} m: m_x at an element centre (Navier)`, r.mAt(xc, yc, 0), rm.mx, { 0.5: 1.2e-2, 0.25: 3e-3, 0.125: 8e-4 }[el]);
    near(`SS ${a} x ${b}, elements ${el} m: m_y at an element centre (Navier)`, r.mAt(xc, yc, 1), rm.my, { 0.5: 1.2e-2, 0.25: 3e-3, 0.125: 8e-4 }[el]);
    near(`SS ${a} x ${b}, elements ${el} m: reactions carry the load`, r.Rw, 5 * a * b, 1e-9);
    if (prev != null) truth(`SS ${a} x ${b}: the error falls as the mesh is refined (${prev.toExponential(1)} -> ${err.toExponential(1)})`, err < prev);
    prev = err;
  }
}
{ // point load at the centre, deflection at a quarter point (away from the Mindlin point-load singularity)
  const a = 6, r = plate({ a, b: a, h: 0.02, nu: 0.3, el: 0.125, bc: ssAll(a), loads: (M, F) => { F[3 * P.nearestNode(M, 3, 3)] += 10; } });
  near('SS square, point load: deflection at the quarter point (Navier)', r.w(1.5, 1.5), navier(a, a, r.D, r.Ds, 0.3, 1.5, 1.5, 0, [3, 3, 10]).w, 3e-3);
  near('SS square, point load: centre deflection 0.01160 P a^2 / D (T&W Table 23)', r.w(3, 3), 0.0116 * 10 * a * a / r.D, 2e-2);
}
{ // clamped square, thin, nu = 0.3: w = 0.00126 q a^4 / D, m centre 0.0231 q a^2, m mid-edge -0.0513 q a^2 (T&W Table 35)
  const a = 10, el = 0.125, r = plate({ a, b: a, h: 0.05, nu: 0.3, el, bc: (x, y, k, f) => { if (x < T || x > a - T || y < T || y > a - T) f[3 * k] = f[3 * k + 1] = f[3 * k + 2] = 1; }, loads: (M, F) => P.udl(M, F, 1) });
  near('clamped square: centre deflection (T&W 0.00126, exact 0.001265)', r.w(5, 5), 0.001265 * a ** 4 / r.D, 5e-3);
  const mc = (r.mAt(5 - el / 2, 5 - el / 2, 0) + r.mAt(5 + el / 2, 5 + el / 2, 0)) / 2, m1 = r.mAt(el / 2, 5, 0), m2 = r.mAt(1.5 * el, 5, 0);
  near('clamped square: centre moment (T&W 0.0231, exact 0.0229)', mc, 0.0229 * a * a, 1e-2);
  near('clamped square: mid-edge moment, extrapolated from the first two rows (T&W -0.0513)', m1 + (m1 - m2) / 2, -0.0513 * a * a, 5e-3);
}
{ // interior panel of a flat plate on point supports: lines of symmetry all round, supports at the corners
  const series = (a, x, y, D) => { let s = 0; for (let m = 0; m < 500; m++) for (let k = 0; k < 500; k++) { if (!m && !k) continue; const c = m && k ? 4 : 2, kk = (m / a) ** 2 + (k / a) ** 2; s += c * (1 - Math.cos(2 * Math.PI * m * x / a) * Math.cos(2 * Math.PI * k * y / a)) / (kk * kk); } return s / (16 * Math.PI ** 4 * D); };
  const a = 6, r = plate({ a, b: a, h: 0.002, nu: 0.2, el: 0.125, bc: (x, y, k, f) => { if (x < T || x > a - T) f[3 * k + 1] = 1; if (y < T || y > a - T) f[3 * k + 2] = 1; if ((x < T || x > a - T) && (y < T || y > a - T)) f[3 * k] = 1; }, loads: (M, F) => P.udl(M, F, 1) });
  near('flat plate panel: the series gives Timoshenko\'s 0.00581 q a^4 / D', series(a, 3, 3, 1) / a ** 4, 0.00581, 2e-3);
  near('flat plate panel: centre deflection (series)', r.w(3, 3), series(a, 3, 3, r.D), 4e-3);
  near('flat plate panel: mid-point of a column line (series)', r.w(3, 0), series(a, 3, 0, r.D), 4e-3);
  near('flat plate panel: the corner supports carry the panel', r.Rw, a * a, 1e-6);
}
{ // Wood–Armer
  const wa = P.woodArmer;
  const eq = (name, a, b) => truth(name, a.every((v, i) => Math.abs(v - b[i]) < 1e-12));
  eq('Wood–Armer: m_xy = 0 gives the moments themselves', wa(10, 4, 0), [10, 4, 0, 0]);
  eq('Wood–Armer: both bottom moments + |m_xy|, top 0 when m - |m_xy| > 0', wa(10, 8, 3), [13, 11, 0, 0]);
  eq('Wood–Armer: bottom m_x* < 0 -> 0 and m_y* = m_y + m_xy^2 / |m_x|; top m_y* > 0 -> 0 and m_x* = m_x - m_xy^2 / |m_y|', wa(-6, 10, 3), [0, 10 + 9 / 6, -6 - 9 / 10, 0]);
  eq('Wood–Armer: bottom m_x* < 0 -> 0, m_y* = m_y + m_xy^2 / |m_x|; both top moments m - |m_xy|', wa(-10, 2, 4), [0, 2 + 16 / 10, -14, -2]);
  eq('Wood–Armer: pure twist needs |m_xy| in every layer', wa(0, 0, 5), [5, 5, -5, -5]);
}

// ---------- 2 the slab ----------
const base = { fck: 32, fyk: 500, h: 250, coverTop: 25, coverBtm: 25, phi: 12, spansX: [7.5, 7.5], spansY: [6, 6], over: { L: 0.3, R: 0.3, B: 0.3, T: 0.3 }, edges: { L: 'free', R: 'free', B: 'free', T: 'free' },
  columns: { at: [], cx: 450, cy: 400, above: { H: 3.5, far: 'F' }, below: { H: 3.5, far: 'F' }, footprint: true, model: 'elastic' }, gk: 1.5, qk: 5, density: 25, perim: 4, psi0: 0.7, psi2: 0.3, rule: '6.10ab', patterns: true, wk: 0.3, beta: 'factors', meshTop: 'auto', meshBtm: 'auto', zone: 1.0, longTerm: { RH: 50, t0: 28 } };
const all = (nx, ny) => { const a = []; for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) a.push([i, j]); return a; };
const F0 = { ...base, columns: { ...base.columns, at: all(2, 2) } };
const R0 = SlabFEM.design(F0);
{
  const area = (15 + 0.6) * (12 + 0.6), perimL = 2 * (15.6 + 12.6);
  near('flat slab: total G = (self-weight + g_k) area + cladding', R0.totalG, R0.gTot * area + 4 * perimL, 1e-9);
  near('flat slab: total Q = q_k area', R0.totalQ, 5 * area, 1e-9);
  near('flat slab: the columns carry G_k + Q_k', R0.columns.reduce((s, p) => s + p.Rk, 0), R0.totalG + R0.totalQ, 1e-9);
  near('flat slab: the columns carry G_k', R0.columns.reduce((s, p) => s + p.RG, 0), R0.totalG, 1e-9);
  const byName = Object.fromEntries(R0.columns.map(p => [`${p.i}${p.j}`, p]));
  near('flat slab: symmetry, corner columns A1 = C3', byName['00'].Rk, byName['22'].Rk, 1e-6); near('flat slab: symmetry, edge columns B1 = B3', byName['10'].Rk, byName['12'].Rk, 1e-6);
  truth('flat slab: the internal column carries the most', R0.columns.every(p => p.Rk <= byName['11'].Rk + 1e-9));
  near('flat slab: no moment at the symmetric internal column under G', byName['11'].Mabout_y, 0, 1e-6, 100);
  truth('flat slab: column types internal / edge / corner', R0.punch.find(p => p.i === 1 && p.j === 1).type === 'internal' && R0.punch.find(p => p.i === 0 && p.j === 1).type === 'edge' && R0.punch.find(p => p.i === 0 && p.j === 0).type === 'corner');
  for (const p of R0.punch) near(`punching at ${p.i}${p.j} agrees with the RC Punching Shear engine on the same input`, p.R.util, Punching.design(JSON.parse(JSON.stringify(p.inp))).util, 1e-12);
  // the pattern envelope covers the all-bays case
  let ok = true; for (let e = 0; e < R0.M.nEl; e++) { const w = P.woodArmer(R0.Rall[6 * e], R0.Rall[6 * e + 1], R0.Rall[6 * e + 2]); for (let k = 0; k < 4; k++) if (Math.abs(w[k]) > Math.abs(R0.WA[4 * e + k]) + 1e-9) ok = false; }
  truth('flat slab: the Wood–Armer envelope covers every element under all bays loaded', ok);
  truth('flat slab: 7 imposed load patterns x 2 combinations', R0.combos.length === 14);
  // steel: As from the EC2 core, As,min, the zones provide what each element needs
  let okS = true, okMin = true, okZ = true;
  for (let e = 0; e < R0.M.nEl; e++) { if (R0.inFoot[e]) continue; for (let k = 0; k < 4; k++) { const m = Math.abs(R0.WA[4 * e + k]) * 1e6, As = m > 0 ? EC2.bendingDesign({ sec: { b: 1000, bw: 1000, hf: 0, h: 250 }, d: R0.dL[k], M: m, c: R0.c, s: R0.st }).As : 0, need = k < 2 || m > 0 ? Math.max(As, R0.AsMin[k]) : 0; if (Math.abs(need - R0.req[4 * e + k]) > 1e-6) okS = false; if (k < 2 && R0.req[4 * e + k] < R0.AsMin[k] - 1e-9) okMin = false; if (R0.prov[4 * e + k] < R0.req[4 * e + k] - 1e-6) okZ = false; } }
  truth('flat slab: A_s needed = EC2 core bending design of the Wood–Armer moment, at least A_s,min', okS);
  truth('flat slab: A_s,min in the bottom everywhere', okMin); truth('flat slab: the steel provided covers every element', okZ);
  near('flat slab: d of the outer bottom layer = h - c - phi/2', R0.dL[0], 250 - 25 - 6, 1e-12); near('flat slab: d of the inner top layer = h - c - 3 phi / 2', R0.dL[3], 250 - 25 - 18, 1e-12);
  near('flat slab: A_s,min (9.2.1.1)', R0.AsMin[0], Math.max(0.26 * R0.c.fctm / 500 * 1000 * 219, 0.0013 * 1000 * 219), 1e-12);
  // long-term section terms against the EC2 core
  const e = R0.M.nEl >> 1, ae = 200000 / R0.Eeff, m = 30, S = R0.ltSection(e, 'x', m);
  const As = R0.prov[4 * e], d = R0.dL[0], As2 = R0.prov[4 * e + 2], d2 = 250 - R0.dL[2];
  const U = EC2.uncracked({ sec: { b: 1000, bw: 1000, hf: 0 }, h: 250, As, d, As2, d2, ae }), Cr = EC2.cracked({ sec: { b: 1000, bw: 1000, hf: 0, h: 250 }, As, d, As2, d2, ae });
  const Mcr = R0.c.fctm * U.I / (250 - U.y), z = 30e6 > Mcr ? 1 - 0.5 * (Mcr / 30e6) ** 2 : 0;
  near('long-term: zeta = 1 - 0.5 (M_cr / M)^2 (7.19)', S.z, z, 1e-9);
  near('long-term: EI by interpolating the curvatures (7.18)', S.EI, 1 / (z / (R0.Eeff * Cr.Icr) + (1 - z) / (R0.Eeff * U.I)), 1e-6);
  near('long-term: shrinkage curvature (7.21)', S.kcs, R0.ecs * ae * (z * (As * (d - Cr.x) - As2 * (Cr.x - d2)) / Cr.Icr + (1 - z) * (As * (d - U.y) - As2 * (U.y - d2)) / U.I), 1e-6);
  truth('long-term: more than (1 + phi) x the quasi-permanent deflection where the slab cracks', R0.bays.every(b => b.wLT > b.wQP * (1 + R0.phiC) * 0.95));
}
{ // creep and shrinkage by hand, C30/37, RH 50 %, h0 = 200 mm, t0 = 28 days, class N
  const cr = SlabFEM.creep({ fck: 30, RH: 50, t0: 28, h0: 200 }), fcm = 38, a1 = (35 / fcm) ** 0.7, a2 = (35 / fcm) ** 0.2;
  near('creep: phi_RH (B.3b, f_cm > 35)', cr.phiRH, (1 + 0.5 / (0.1 * 200 ** (1 / 3)) * a1) * a2, 1e-12);
  near('creep: phi(inf, 28) = phi_RH beta(f_cm) beta(t0) (B.2)', cr.phi, cr.phiRH * 16.8 / Math.sqrt(fcm) / (0.1 + 28 ** 0.2), 1e-12);
  truth(`creep: about 2.4, as Figure 3.1 reads (${cr.phi.toFixed(2)})`, cr.phi > 2.2 && cr.phi < 2.5);
  const sh = SlabFEM.shrinkage({ fck: 30, RH: 50, h0: 200 });
  near('shrinkage: eps_cd,0 (B.11) against Table 3.2 between C20/25 and C40/50 at RH 50 % (0.48 per mille)', sh.ecd0, 0.478e-3, 1.5e-2);
  near('shrinkage: k_h = 0.85 at h0 = 200 (Table 3.3)', sh.kh, 0.85, 1e-12);
  near('shrinkage: eps_ca = 2.5 (fck - 10) 1e-6 (3.12)', sh.eca, 50e-6, 1e-12);
}
{ // a slab on walls and edges with an opening and every kind of load: equilibrium
  const inp = { ...base, spansX: [6, 4], spansY: [5], over: { L: 0, R: 0, B: 0, T: 0 }, edges: { L: 'pinned', R: 'fixed', B: 'pinned', T: 'free' }, perim: 3,
    walls: [{ x0: 6, y0: 0, x1: 6, y1: 3, kind: 'pinned' }], openings: [{ x0: 1, y0: 3.5, x1: 2, y1: 4.5 }], columns: { ...base.columns, at: [[1, 1]] },
    loads: [{ type: 'patch', case: 'Q', q: 3, x0: 7, y0: 1, x1: 9, y1: 2 }, { type: 'line', case: 'G', q: 6, x0: 2.5, y0: 2, x1: 5, y1: 2 }, { type: 'point', case: 'Q', P: 20, x: 3, y: 1 }] };
  const R = SlabFEM.design(inp);
  const area = 10 * 5 - 1;
  near('walls and edges: total G with the cladding on the free top edge and the line load', R.totalG, R.gTot * area + 3 * 10 - 3 * 0 + 6 * 2.5, 1e-9);
  near('walls and edges: total Q with the patch and the point load', R.totalQ, 5 * area + 3 * 2 + 20, 1e-9);
  const sumG = R.lineR.reduce((s, l) => s + l.G, 0) + R.columns.reduce((s, p) => s + p.RG, 0), sumK = R.lineR.reduce((s, l) => s + l.G + l.Qall, 0) + R.columns.reduce((s, p) => s + p.Rk, 0);
  near('walls and edges: the supports carry G_k', sumG, R.totalG, 1e-9);
  near('walls and edges: the supports carry G_k + Q_k', sumK, R.totalG + R.totalQ, 1e-9);
  truth('walls and edges: the opening has no elements', !Array.from({ length: R.M.nEl }, (_, e) => [R.elC[2 * e], R.elC[2 * e + 1]]).some(([x, y]) => x > 1 && x < 2 && y > 3.5 && y < 4.5));
  truth('walls and edges: an edge column near the free top edge', R.punch[0].type === 'internal' || R.punch[0].type === 'edge');
}
{ // one bay with continuous edges and columns at the corners: a panel of a large flat slab
  const R = SlabFEM.design({ ...base, spansX: [7.5], spansY: [7.5], over: {}, edges: { L: 'continuous', R: 'continuous', B: 'continuous', T: 'continuous' }, perim: 0, columns: { ...base.columns, cy: 450, at: all(1, 1) }, patterns: false });
  near('continuous panel: each corner column takes a quarter of the panel', R.columns[0].Rk, (R.totalG + R.totalQ) / 4, 1e-9);
  truth('continuous panel: corner supports are internal columns for punching', R.punch.every(p => p.type === 'internal'));
}
{ // against RC Slab Design (tool 3): a wide slab simply supported on two opposite edges bends as its one-way strip
  const S = require('../rc-slab/load.js'), R = SlabFEM.design({ ...base, spansX: [6], spansY: [6, 6, 6], over: {}, edges: { L: 'pinned', R: 'pinned', B: 'free', T: 'free' }, perim: 0, columns: { ...base.columns, at: [] }, patterns: false, loads: [], mesh: 0.2 });
  const sets = [{ label: '6.10a', gG: 1.35, gQ: 1.5 * 0.7 }, { label: '6.10b', gG: 0.925 * 1.35, gQ: 1.5 }];
  const D = S.RCSlabDesign.oneWay({ spans: [{ L: 6000, h: 250 }], supports: [{ kind: 'knife', width: 0, delta: 1 }, { kind: 'knife', width: 0, delta: 1 }], loads: [{ span: 0, case: 'G', type: 'udl', w: R.gTot }, { span: 0, case: 'Q', type: 'udl', w: 5 }],
    sets, patterns: S.RCBeam.patternList(1, false), redist: 'none', psi2: 0.3, selfWeight: false, fck: 32, fyk: 500, dg: 20, cover: { top: 25, btm: 25 }, wk: { top: 0.3, btm: 0.3 }, brittle: true });
  let e0 = -1, bd = 1e9; for (let e = 0; e < R.M.nEl; e++) { const dd = Math.hypot(R.elC[2 * e] - 3 - R.el / 2, R.elC[2 * e + 1] - 9); if (dd < bd) { bd = dd; e0 = e; } }
  const xc = R.elC[2 * e0], Mstrip = D.A.spanM[0].elastic / 1e6 * (xc * (6 - xc)) / 9;
  // statics: m_x integrated across the width = width x the strip moment; mid-width is 0.5 % lower, as the anticlastic free
  // edges (Levy's solution, nu = 0.2) carry a little more
  let I = 0; const i0 = R.M.ci[e0]; for (let j = 0; j < R.M.ny; j++) { const e = R.M.cellEl[j * R.M.nx + i0]; I += R.Rall[6 * e] * (R.M.ys[j + 1] - R.M.ys[j]); }
  near('one-way slab: m_x across the whole width = width x the RC Slab Design strip moment', I, 18 * Mstrip, 2e-3);
  near('one-way slab: m_x at mid-width within 1 % of the strip moment', R.Rall[6 * e0], Mstrip, 1e-2);
  near('one-way slab: the edges carry the load', R.lineR.reduce((s, l) => s + l.G + l.Qall, 0), R.totalG + R.totalQ, 1e-9);
}
// errors
throws('no support at all', () => SlabFEM.design({ ...base, columns: { ...base.columns, at: [] } }), /support/);
throws('a mechanism: one column', () => SlabFEM.design({ ...base, columns: { ...base.columns, at: [[1, 1]], model: 'pinned' } }), /mechanism/);
throws('a column in an opening', () => SlabFEM.design({ ...F0, openings: [{ x0: 7, y0: 5.5, x1: 8, y1: 6.5 }] }), /in an opening/);
throws('a diagonal wall', () => SlabFEM.design({ ...F0, walls: [{ x0: 0, y0: 0, x1: 3, y1: 3 }] }), /along x or along y/);
throws('spans', () => SlabFEM.design({ ...F0, spansX: [7.5, 0] }), /length/);
throws('depth', () => SlabFEM.design({ ...F0, h: 60 }), /slab depth/);

console.log(`\n${n - fails}/${n} passed`);
if (fails) process.exit(1);
