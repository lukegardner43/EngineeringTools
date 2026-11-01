// RC Flat Slab Design: node test_rc_flat.js
// The frame analysis is the RC beam engine (checked against an independent frame model in tests/rc-beam) and punching is
// the RC Punching Shear engine (tests/rc-punch); here:
// 1 The Concrete Centre TCC33 (30 internal-bay frames of 2 to 5 spans, outputs only): elastic and redistributed moments,
//   the end-column cap, reactions, strip widths and the face moments at internal columns.
// 2 Rules: frame equilibrium, the Table I.1 split, the 9.4.1(2) band, Mt,max (I.1.2(5)), punching at every column, errors.
const { EC2, RCBeam, Punching, FlatSlab } = require('./load.js');
const T33 = require('./ref_tcc33.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale = null) => { n++; const e = Math.abs(got - exp) / Math.max(Math.abs(scale ?? exp), 1e-9); const ok = e <= tol; if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(8)} expected ${(+exp).toPrecision(8)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; if (!c || process.env.V) console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, fn, re) => { let m = ''; try { fn(); } catch (e) { m = e.message; } truth(`${name} (${m || 'no error'})`, re.test(m)); };
const AREA = p => Math.PI * p * p / 4;

// ---------- 1 TCC33 ----------
T33.forEach(({ inp, tcc: t }, k) => {
  const R = FlatSlab.design(inp), A = R.A, off = R.off, N = inp.spans.length, tag = `TCC33 ${k} (${N} spans)`;
  for (let j = 0; j <= N; j++) {
    near(`${tag} column ${j + 1}: elastic moment`, A.supM[j + off].elastic / 1e6, t.supEl[j], 2e-3);
    if (j > 0 && j < N) near(`${tag} column ${j + 1}: redistributed moment`, A.supM[j + off].redist / 1e6, t.supRd[j], 1e-3);
    else near(`${tag} column ${j + 1}: end moment capped at Mt,max`, A.supM[j + off].redist / 1e6, t.supRd[j], 3e-2);
    near(`${tag} column ${j + 1}: largest ULS reaction`, A.Rmax[j + off] / 1e3, t.R[j], 5e-3);
  }
  for (let i = 0; i < N; i++) {
    near(`${tag} span ${i + 1}: elastic moment`, A.spanM[i + off].elastic / 1e6, t.spanEl[i], 2e-3);
    near(`${tag} span ${i + 1}: column strip width`, R.spanZ[i].wCS, t.wCSspan[i], 1e-12);
  }
  for (let j = 1; j < N; j++) {
    near(`${tag} column ${j + 1}: column strip width over the support`, R.supZ[j].wCS, t.wCSsup[j - 1], 1e-12);
    near(`${tag} column ${j + 1}: design moment at the face`, R.supZ[j].F.M / 1e6, t.Mface[j - 1], 3e-2);
  }
});

// ---------- 2 the flat slab frame ----------
// the flat slab frame
const F0 = { fck: 32, fyk: 500, coverTop: 25, coverBtm: 25, phiMax: 20, wk: 0.3, rule: '6.10ab', psi0: 0.7, psi2: 0.3, adjacent: false, redist: 'limited', h: 250, b: 7500, bay: 'internal',
  spans: [7.5, 7.5, 7.5], endL: 300, endR: 300, perimL: 4, perimR: 4, gk: 1.5, qk: 5, density: 25, hogCS: 0.75, sagCS: 0.55, phiEnd: 16, brittle: true,
  columns: [0, 1, 2, 3].map(j => ({ c1: 450, c2: 450, above: { L: 3.5, far: 'F' }, below: { L: 3.5, far: 'F' }, delta: j === 0 || j === 3 ? 1 : 0.85 })), punch: { beta: 'factors' } };
{
  const R = FlatSlab.design(F0), A = R.A, Gk = A.cases[A.cases.length - 1];
  const tot = R.gTot * 7.5 * (22.5 + 0.3 + 0.3) + 2 * 4 * 7.5;
  near('frame equilibrium under G_k: the reactions carry the slab and the cladding', Gk.R.reduce((a, v) => a + v, 0) / 1e3, tot, 1e-9);
  near('self-weight 25 h', R.swt, 6.25, 1e-12);
  R.supZ.forEach(Z => {
    if (Z.end) { near(`column ${Z.j + 1}: the whole hogging moment to b_e`, Z.csM, Z.F.M, 1e-12); near(`column ${Z.j + 1}: column strip = b_e = c2 + c1/2 + e (Figure 9.9)`, Z.wCS, 450 + 225 + 300, 1e-12); return; }
    near(`column ${Z.j + 1}: column strip 75 % (Table I.1)`, Z.csM, 0.75 * Z.F.M, 1e-12); near(`column ${Z.j + 1}: middle strip 25 %`, Z.msM, 0.25 * Z.F.M, 1e-12);
    near(`column ${Z.j + 1}: column strip width min(b, L)/2`, Z.wCS + Z.wMS, 7500, 1e-12);
    truth(`column ${Z.j + 1}: face moment not less than 0.65 of the centreline moment`, Z.F.M >= 0.65 * Z.F.Mcl - 1e-6);
    near(`column ${Z.j + 1}: 9.4.1(2) band, 0.5 At over 0.25 b`, Z.conc.need, 0.5 * (Z.cs.As * Z.wCS + Z.ms.As * Z.wMS) / 1000 / (0.25 * 7500 / 1000), 1e-12);
    truth(`column ${Z.j + 1}: band bars provide the need`, Z.conc.As >= Z.conc.need - 1e-9);
  });
  R.spanZ.forEach(Z => { near(`span ${Z.i + 1}: column strip 55 %`, Z.csM, 0.55 * Z.M, 1e-12); near(`span ${Z.i + 1}: strips share b`, Z.wCS + Z.wMS, 7500, 1e-12); near(`span ${Z.i + 1}: column strip width L/2`, Z.wCS, 3750, 1e-12); });
  const dE = 250 - 25 - 8, Mt = 0.17 * 975 * dE * dE * 32;
  near('Mt,max = 0.17 be d^2 fck (I.1.2(5))', R.ends[0].Mt, Mt, 1e-12);
  truth('the end moment is capped at Mt,max plus the overhang moment', A.supM[R.supZ[0].fj].redist <= R.ends[0].Mt + R.ends[0].Mcant + 1e-6 && A.supM[R.supZ[0].fj].elastic > R.ends[0].cap);
  truth('the cap is reported, not checked', R.info.length === 2 && R.info[0].capped && !R.checks.some(c => /Mt,max/.test(c.name)));
  const Pp = require('../rc-punch/load.js').Punching;   // the column handed to RC Punching Shear gives the same answer there
  R.punch.forEach(p => near(`column ${p.j + 1}: RC Punching Shear gives the same utilisation`, Pp.design(JSON.parse(JSON.stringify(p.inp))).util, p.R.util, 1e-12));
  truth('punching at every column: edge at the ends, internal between', R.punch.map(p => p.type).join() === 'edge,internal,internal,edge');
  near('punching load = the largest ULS reaction', R.punch[1].R.VEd, A.Rmax[R.supZ[1].fj], 1e-12);
  truth('every strip check is listed', R.checks.filter(c => /steel/.test(c.name)).length === 4 * 2 + 3 * 2);
  truth('bars meet their need', [...R.supZ.flatMap(z => [z.cs, z.ms]), ...R.spanZ.flatMap(z => [z.cs.z, z.ms.z])].every(z => z.As >= z.need - 1e-9));
  truth('spacings within 9.3.1.1(3)', R.supZ.every(z => z.cs.s <= Math.min(500, 250) && z.ms.s <= 400) && R.spanZ.every(z => z.cs.z.s <= 400 && z.ms.z.s <= 400));
  const E = FlatSlab.design({ ...F0, bay: 'edge', eT: 300, b: 4050 });
  truth('edge bay: edge columns between, corner columns at the ends', E.punch.map(p => p.type).join() === 'corner,edge,edge,corner');
  near('edge bay: column strip = the edge distance + min(inner part / 2, L / 4)', E.spanZ[0].wCS, 300 + Math.min((4050 - 300) / 2, 7500 / 4), 1e-12);
  const P = FlatSlab.design({ ...F0, adjacent: true });
  truth('adjacent-span patterns give at least the same hogging', P.supZ.every((z, j) => z.F.M >= FlatSlab.design(F0).supZ[j].F.M - 1e-6));
  const C = FlatSlab.design({ ...F0, columns: F0.columns.map(c => ({ ...c, circ: true, c1: 500 })) });
  truth('circular columns calculate', C.punch.every(p => p.R && p.inp.shape === 'circ'));
  const one = FlatSlab.design({ ...F0, spans: [6], columns: F0.columns.slice(0, 2).map(c => ({ ...c, delta: 1 })) });
  truth('a single span frame calculates', one.spanZ.length === 1 && one.punch.length === 2);
  const noOver = FlatSlab.design({ ...F0, endL: 0, endR: 225 });
  truth('no overhang: the frame starts at the column', !noOver.cantL && !noOver.cantR && noOver.off === 0);
  throws('one column per support', () => FlatSlab.design({ ...F0, columns: F0.columns.slice(0, 3) }), /one column for each support/);
  throws('Table I.1 limits on the hogging share', () => FlatSlab.design({ ...F0, hogCS: 0.9 }), /60 to 80/);
  throws('Table I.1 limits on the sagging share', () => FlatSlab.design({ ...F0, sagCS: 0.4 }), /50 to 70/);
  throws('slab depth', () => FlatSlab.design({ ...F0, h: 50 }), /slab depth/);
}

console.log(`\n${n - fails}/${n} passed`);
if (fails) process.exit(1);
/* Documented differences from the Concrete Centre's TCC33:
   elastic moments within 0.16 % (TCC's frame stiffnesses at the end columns); its face moments come from an iterative
   distribution (within 2.4 %); the redistributed span moment here is not less than delta x elastic, where TCC goes a
   little below; the overhang moment added to Mt,max uses the larger of 6.10a and 6.10b here (TCC: 6.10b); TCC's floor on
   the end-support moment differs; deflection here raises As by As,prov / As,req (7.4.2(2)), TCC iterates its raise. */
