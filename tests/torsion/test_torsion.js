// Steel beam torsion: FE torsional analysis against closed-form solutions (reference/ref_torsion.py), sectorial
// properties against direct integration, and the stress / interaction expressions by hand.
let mods;
if (process.env.ENGINE) { const { EC3 } = require('../steel-member/load.js'); global.EC3 = EC3; const T = require(process.env.ENGINE); mods = { EC3, Torsion: T.Torsion, ...require('../steel-member/load.js') }; }
else mods = require('./load.js');
const { EC3, Torsion, SECTION_DATA, PFC_DATA } = mods;
const REF = require('./ref_torsion.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale, quiet) => { n++; const ok = Math.abs(got - exp) <= tol * (scale ?? Math.max(Math.abs(exp), 1e-30)); if (!ok || !quiet) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
for (const c of REF.cases) {
  const r = Torsion.analyse({ L: c.L, EIw: REF.EIw, GIt: REF.GIt, ends: c.ends, mt: c.m ? [{ a: 0, b: c.L, m: c.m }] : [], Tpt: c.T0 ? [{ x: c.a, T: c.T0 }] : [], nEl: 300 });
  const at = (arr, x) => { let k = 0; r.nodes.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(r.nodes[k] - x)) k = i; }); return arr[k]; };
  const phiS = Math.max(...c.pts.map(p => Math.abs(p.phi))), d2S = Math.max(...c.pts.map(p => Math.abs(p.d2))), TS = Math.max(...c.pts.map(p => Math.max(Math.abs(p.Tt), Math.abs(p.Tw))));
  for (const p of c.pts) {
    near(`${c.name} x=${p.x}: phi`, at(r.phi, p.x), p.phi, 1e-4, phiS, true);
    near(`${c.name} x=${p.x}: phi''`, at(r.d2, p.x), p.d2, 2e-3, d2S, true);
    if (Math.abs(p.x - (c.a ?? -1)) > 1) {         // torque components are discontinuous at a point torque
      near(`${c.name} x=${p.x}: T_t`, at(r.Tt, p.x), p.Tt, 2e-3, TS, true);
      near(`${c.name} x=${p.x}: T_w`, at(r.Tw, p.x), p.Tw, 5e-3, TS, true);
    }
  }
  console.log(`ok   ${c.name}: max phi ${(phiS * 180 / Math.PI).toFixed(3)} deg compared at ${c.pts.length} points`);
}
// sectorial properties: I section and channel against direct integration of omega_n on the centreline
{ const s = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('457×191×67'))), sc = Torsion.sectorial(s);
  near('I: omega_n at the flange tip = b hs / 4', sc.w_tip, s.b * (s.h - s.tf) / 4, 1e-12);
  near('I: Sw at the flange centre = tf b² hs / 16', sc.Sw_flange, s.tf * s.b ** 2 * (s.h - s.tf) / 16, 1e-12);
  near('I: Iw = 2 tf int omega² over the flanges (= Iz,flange hs²/2)', 2 * 2 * s.tf * (s.b / 2) * (sc.w_tip ** 2) / 3, s.tf * s.b ** 3 / 12 * (s.h - s.tf) ** 2 / 2, 1e-12); }
{ const c = EC3.fromRowPFC(PFC_DATA.find(r => r[0].startsWith('300×90×41'))), sc = Torsion.sectorial(c);
  const bp = c.b - c.tw / 2, hp = c.h - c.tf, e = c.eSC, nint = 20000;
  // centreline: top flange from tip (s = 0) to junction, web, bottom flange; omega_n linear on each plate
  // flanges: omega_n linear from -w2 at the tip to +w1 at the junction (top flange; bottom flange antisymmetric);
  // web: omega_n = w1 (2z/h') so that int omega_n z dA = 0 locates the shear centre
  let Iw = 0, Iwz = 0;
  for (let i = 0; i < nint; i++) { const t = (i + 0.5) / nint, w = -sc.w_tip + (sc.w_junction + sc.w_tip) * t; Iw += 2 * c.tf * bp / nint * w * w; Iwz += 2 * c.tf * bp / nint * w * hp / 2; }
  for (let i = 0; i < nint; i++) { const t = (i + 0.5) / nint, z = hp / 2 - hp * t, w = sc.w_junction * 2 * z / hp; Iw += c.tw * hp / nint * w * w; Iwz += c.tw * hp / nint * w * z; }
  near('channel: Iw by integration of omega_n = closed form', Iw, (c.tf * bp ** 3 * hp ** 2 / 12) * (3 * bp * c.tf + 2 * hp * c.tw) / (6 * bp * c.tf + hp * c.tw), 1e-6);
  near('channel: int omega_n z dA = 0 at the shear centre', Iwz, 0, 1e-6, sc.w_tip * c.tf * bp * hp);
  near('channel: Sw max in the flange = tf (b\' - e)² h\' / 4', sc.Sw_flange, c.tf * (bp - e) ** 2 * hp / 4, 1e-12); }
// design: stresses at the critical point by hand (simply supported, eccentric udl, fork ends)
{ const s = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('457×191×67'))), L = 6000;
  const R = Torsion.design({ sec: s, grade: 'S355', L, sys: 'ss', ends: ['fork', 'fork'], loadsG: [{ type: 'udl', w: 10, e: 75 }], loadsQ: [], gG: 1.35, gQ: 1.5, lateral: { restraints: [] }, rotLimitDeg: 2 });
  const mid = R.pts.reduce((a, p) => Math.abs(p.x - L / 2) < Math.abs(a.x - L / 2) ? p : a);
  const sc = Torsion.sectorial(s), M = 1.35 * 10 * L * L / 8;
  near('design: midspan bending stress M h / 2 Iy', mid.sb, M * s.h / 2 / s.Iy, 1e-9);
  near('design: warping stress B omega / Iw', mid.sw_tip, Math.abs(mid.B) * sc.w_tip / s.Iw, 1e-12);
  const v = Math.sqrt(((mid.sb + mid.sw_tip) / 355) ** 2 + 3 * (mid.tt_f / 355) ** 2);
  near('design: von Mises at the flange tip', mid.u >= v - 1e-12 ? v : NaN, v, 1e-12);
  const g = R.gov.member.seg, kw = 0.7 - 0.2 * g.BEd / g.BRk, ka = 1 / (1 - g.MEd / g.Mcr);
  near('design: EN 1993-6 Annex A interaction', g.u, g.MEd / (g.chi * g.MyRk) + kw * ka * g.BEd / g.BRk, 1e-12);
  near('design: SLS rotation from the characteristic loads', R.gov.rotation.rot, Math.max(...Torsion.analyse({ L, EIw: EC3.E * s.Iw, GIt: EC3.G * s.It, ends: ['fork', 'fork'], mt: [{ a: 0, b: L, m: 10 * 75 }] }).phi), 1e-9); }
console.log(`${n - fails}/${n} torsion checks passed`);
process.exit(fails ? 1 : 0);
