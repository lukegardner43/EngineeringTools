"""Independent reference values for the Hollowcore Support Beam tool (numpy / scipy), written to ../ref_hollowcore.json.

A  Section geometry by z-strip integration (rectangles + root fillets as exact width functions, y-intervals per strip):
   A, centroid, Iy, Iz, elastic moduli, plastic modulus (PNA by bisection), first-order properties of the ASB datasheet
   and of a Slimflor section (UKC + plate); thin-walled shear centre, Iw and the Wagner coefficient z_j.
B  Elastic critical moment by a Rayleigh-Ritz sine series (fork ends, UDL at a load height, monosymmetry term).
C  Transverse plastic moment of a plate with a longitudinal stress, by linear programming over fibres (von Mises).
D  Final-stage ULS / SLS quantities, the Slimflor weld force and the stage 1 torsion at mid-span by hand / closed form.
"""
import json, math, pathlib, sys
import numpy as np
from scipy.optimize import linprog
from scipy.linalg import eigh

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / 'torsion' / 'reference'))
E, G = 210000.0, 81000.0

# ---------------------------------------------------------------- A: geometry by strips
def fillet_w(v, r):            # width of a root fillet at distance v from the flange face (0 <= v <= r)
    return r - math.sqrt(max(0.0, r * r - (r - v) ** 2))

def i_section(h, bt, tt, bb, tb, tw, r, z0=0.0, plate=None):
    """Return a function z -> list of y-intervals, the z-range and the strip breakpoints."""
    def intervals(z):
        iv = []
        if plate and 0 <= z <= plate[1]:
            iv.append((-plate[0] / 2, plate[0] / 2))
        zz = z - z0
        if 0 <= zz <= tb: iv.append((-bb / 2, bb / 2))
        elif h - tt <= zz <= h: iv.append((-bt / 2, bt / 2))
        elif tb < zz < h - tt:
            w = 0.0
            if zz - tb < r: w = fillet_w(zz - tb, r)
            elif (h - tt) - zz < r: w = fillet_w((h - tt) - zz, r)
            iv.append((-tw / 2 - w, tw / 2 + w))
        return iv
    top = z0 + h
    return intervals, 0.0, top

def strip_props(intervals, zlo, zhi, n=400000):
    dz = (zhi - zlo) / n
    zs = zlo + (np.arange(n) + 0.5) * dz
    A = S1 = S2 = Iz = Y2Z = 0.0
    b = np.zeros(n); y2 = np.zeros(n)
    for k, z in enumerate(zs):
        for (y1, y2_) in intervals(z):
            b[k] += y2_ - y1; y2[k] += (y2_ ** 3 - y1 ** 3) / 3
    A = b.sum() * dz; zc = (b * zs).sum() * dz / A
    Iy = (b * (zs - zc) ** 2).sum() * dz; Iz = y2.sum() * dz
    z3 = ((b * (zs - zc) ** 3) + y2 * (zs - zc)).sum() * dz          # int z (y^2 + z^2) dA about the centroid
    # plastic neutral axis
    cum = np.cumsum(b) * dz
    k = int(np.searchsorted(cum, A / 2)); zp = zs[k] - dz / 2 + (A / 2 - (cum[k - 1] if k else 0)) / b[k]
    Wpl = (b * np.abs(zs - zp)).sum() * dz
    return dict(A=A, zc=zc, Iy=Iy, Iz=Iz, z3=z3, zpna=zp, Wpl=Wpl, Welt=Iy / (zhi - zc), Welb=Iy / zc, H=zhi)

def thin_walled(flanges):      # [(b, t, z)] -> zs, Iw, omega at each tip
    I = [t * b ** 3 / 12 for b, t, z in flanges]
    zs = sum(Ik * f[2] for Ik, f in zip(I, flanges)) / sum(I)
    Iw = sum(Ik * (f[2] - zs) ** 2 for Ik, f in zip(I, flanges))
    return zs, Iw, [abs(f[2] - zs) * f[0] / 2 for f in flanges]

asb = [  # name, D, Bt, Bb, tw, T, r, A, Iy, Iz, Welt, Welb, Wpl, Iw, ye, yp (datasheet)
    ('280 ASB 74', 272, 175, 285, 10, 14, 27, 95.1, 12366, 3337, 788, 1075, 994, 0.338, 15.7, 21.3),
    ('280 ASB 124', 296, 178, 288, 13, 26, 27, 159, 23630, 6414, 1372, 1906, 1745, 0.721, 17.2, 25.6),
    ('300 ASB 196', 342, 183, 293, 20, 40, 27, 249, 45871, 10463, 2321, 3185, 3055, 1.5, 19.8, 28.1),
]
out = dict(asb=[], slimflor=None)
for (nm, D, Bt, Bb, tw, T, r, A, Iy, Iz, Wt, Wb, Wpl, Iw, ye, yp) in asb:
    f, lo, hi = i_section(D, Bt, T, Bb, T, tw, r)
    p = strip_props(f, lo, hi)
    zs, Iw_tw, w = thin_walled([(Bt, T, D - T / 2), (Bb, T, T / 2)])
    zj = (zs - p['zc']) - p['z3'] / (2 * p['Iy'])
    out['asb'].append(dict(name=nm, geom=p, zs=zs, Iw=Iw_tw, zj=zj, table=dict(A=A * 1e2, Iy=Iy * 1e4, Iz=Iz * 1e4, Welt=Wt * 1e3, Welb=Wb * 1e3, Wpl=Wpl * 1e3, Iw=Iw * 1e12, zc=D - ye * 10, zpna=D - yp * 10)))

# Slimflor: 254x254x89 UKC (h 260.3, b 256.3, tw 10.3, tf 17.3, r 20) + 460 x 15 plate
h, b, tw, tf, r, bp, tp = 260.3, 256.3, 10.3, 17.3, 20.0, 460.0, 15.0
f, lo, hi = i_section(h, b, tf, b, tf, tw, r, z0=tp, plate=(bp, tp))
p = strip_props(f, lo, hi)
zs, Iw, w = thin_walled([(b, tf, tp + h - tf / 2), (b, tf, tp + tf / 2), (bp, tp, tp / 2)])
zj = (zs - p['zc']) - p['z3'] / (2 * p['Iy'])
out['slimflor'] = dict(dims=dict(h=h, b=b, tw=tw, tf=tf, r=r, bp=bp, tp=tp), geom=p, zs=zs, Iw=Iw, zj=zj, omega=w)

# ---------------------------------------------------------------- B: M_cr by Ritz
def mcr_ritz(L, EIz, GIt, EIw, a, zj, nterms=25, nq=4000):
    """Simply supported, fork ends, unit UDL (1 N/mm) at height a above the shear centre; returns M_cr at mid-span."""
    x = (np.arange(nq) + 0.5) * L / nq; dx = L / nq
    M = x * (L - x) / 2
    n = np.arange(1, nterms + 1); k = n * math.pi / L
    S = np.sin(np.outer(k, x)); C = np.cos(np.outer(k, x))
    K = np.zeros((2 * nterms, 2 * nterms)); Kg = np.zeros_like(K)
    for i in range(nterms):
        K[i, i] = EIz * k[i] ** 4 * L / 2
        K[nterms + i, nterms + i] = (EIw * k[i] ** 4 + GIt * k[i] ** 2) * L / 2
    # coupling int M phi v'' ; load height + int q a phi^2 ; Wagner - int 2 M zj phi'^2
    cpl = -(S * M) @ (S.T * k ** 2) * dx           # [phi_m, v_n]
    Kg[nterms:, :nterms] = cpl; Kg[:nterms, nterms:] = cpl.T
    Kg[nterms:, nterms:] = a * (S @ S.T) * dx - 2 * zj * ((C * M) @ C.T) * np.outer(k, k) * dx
    mu = eigh(Kg, K, eigvals_only=True)
    return (1 / mu.max()) * L * L / 8

mcr_cases = []
for nm, L, sec, a in [('ASB 280x124, bottom-flange load', 6000.0, out['asb'][1], None), ('Slimflor, plate load', 6000.0, 'slim', None)]:
    pass
# cases are evaluated with the tabulated / geometric properties the engine uses (fed back from the JS test inputs)
asb124 = out['asb'][1]
mcr_cases.append(dict(name='280 ASB 124, load on the bottom flange', L=6000.0, EIz=E * 6414e4, GIt=G * 347e4, EIw=E * asb124['Iw'], a=26 - asb124['zs'], zj=asb124['zj']))
mcr_cases.append(dict(name='280 ASB 124, load at the top', L=6000.0, EIz=E * 6414e4, GIt=G * 347e4, EIw=E * asb124['Iw'], a=296 - asb124['zs'], zj=asb124['zj']))
sl = out['slimflor']
from_parts_It = 114e4 + (bp * tp ** 3 * (1 / 3 - 0.21 * (tp / bp) * (1 - tp ** 4 / (12 * bp ** 4))))
mcr_cases.append(dict(name='Slimflor 254 UKC 89 + 460x15, load on the plate', L=7000.0, EIz=E * sl['geom']['Iz'], GIt=G * from_parts_It, EIw=E * sl['Iw'], a=tp - sl['zs'], zj=sl['zj']))
mcr_cases.append(dict(name='457x191x82 UKB, top flange load (no monosymmetry)', L=6000.0, EIz=E * 1871e4, GIt=G * 71.4e4, EIw=E * 0.922e12, a=230.0, zj=0.0))
for c in mcr_cases: c['Mcr'] = mcr_ritz(c['L'], c['EIz'], c['GIt'], c['EIw'], c['a'], c['zj'])
out['mcr'] = mcr_cases

# ---------------------------------------------------------------- C: transverse plastic moment by LP
def m_lp(t, f, sx, n=400):
    y = (np.arange(n) + 0.5) * t / n - t / 2; dy = t / n
    R = math.sqrt(max(0.0, f * f - 0.75 * sx * sx)); lo, hi = sx / 2 - R, sx / 2 + R
    res = linprog(-y * dy, A_eq=[np.full(n, dy)], b_eq=[0.0], bounds=[(lo, hi)] * n, method='highs')
    return -res.fun
out['mtrans'] = [dict(t=t, f=f, sx=sx, m=m_lp(t, f, sx)) for t, f, sx in [(15, 355, 0), (15, 355, 150), (26, 345, -200), (17.3, 345, 300), (20, 355, 354)]]

# ---------------------------------------------------------------- D: hand checks for one design case each
from ref_torsion import solve
def ss_udl_torsion(L, EIw, GIt, m, x):
    return solve(L, EIw, GIt, ('fork', 'fork'), m=m, xs=[x])[0]

# Case UKB: 457x191x82 UKB S355, top flange bearing, L 6 m, planks 7.5 m both sides, gap 30, reaction at the bearing centre
s = dict(h=460, b=191.3, tw=9.9, tf=16, r=12.7, A=105e2, Iy=37268e4, Iz=1871e4, Wpl=1842e3, It=71.4e4, Iw=0.922e12, mass=82)
L, LA, LB = 6000.0, 7500.0, 7500.0
gp, gt, gs, q, qc = 2.9e-3, 1.2e-3, 1.0e-3, 3.5e-3, 0.75e-3
gG, gQ, gap = 1.35, 1.5, 30.0
fy = 355.0
g0 = s['mass'] * 9.81e-3
avail = (s['b'] - gap) / 2; e = gap / 2 + avail / 2
wF = gG * (g0 + (gp + gt + gs) * (LA + LB) / 2) + gQ * q * (LA + LB) / 2
MEd, VEd = wF * L * L / 8, wF * L / 2
Av = max(s['A'] - 2 * s['b'] * s['tf'] + (s['tw'] + 2 * s['r']) * s['tf'], (s['h'] - 2 * s['tf']) * s['tw'])
dC = 5 * (g0 + (gp + gt) * (LA + LB) / 2) * L ** 4 / (384 * E * s['Iy'])
dS = 5 * (gs * (LA + LB) / 2) * L ** 4 / (384 * E * s['Iy']); dQ = 5 * (q * (LA + LB) / 2) * L ** 4 / (384 * E * s['Iy'])
# stage 1A torsion: m = (gG gp + gQ qc) LA/2 e at ULS, SLS (gp + qc) LA/2 e
mU = (gG * gp + gQ * qc) * LA / 2 * e; mS = (gp + qc) * LA / 2 * e
tU = ss_udl_torsion(L, E * s['Iw'], G * s['It'], mU, L / 2); tS = ss_udl_torsion(L, E * s['Iw'], G * s['It'], mS, L / 2)
wU1 = gG * (g0 + gp * LA / 2) + gQ * qc * LA / 2
M1 = wU1 * L * L / 8; B1 = -E * s['Iw'] * tU['d2']
hs = s['h'] - s['tf']; wtip = s['b'] * hs / 4
sig_tip = M1 * (s['h'] / 2) / s['Iy'] + abs(B1) * wtip / s['Iw']
# local transverse bending of the top flange, final stage, side A
qA = gG * (gp + gt + gs) * LA / 2 + gQ * q * LA / 2
lever = e - (s['tw'] / 2 + s['r'])
sx = MEd * (s['h'] / 2) / s['Iy']
mRd = s['tf'] ** 2 / 4 * (fy ** 2 - sx ** 2) / math.sqrt(fy ** 2 - 0.75 * sx ** 2)
out['ukb'] = dict(avail=avail, e=e, wF=wF, MEd=MEd, VEd=VEd, McRd=s['Wpl'] * fy, Vpl=Av * fy / math.sqrt(3), dC=dC, dS=dS, dQ=dQ,
                  phiU_mid=tU['phi'], phiS_mid=tS['phi'], B1_mid=B1, M1_mid=M1, sig_tip=sig_tip, qA=qA, mEd=qA * lever, sx=sx, mRd=mRd)

# Case Slimflor weld: final stage, both sides 7.5 m, gap 10 from the flange tip, reaction at the bearing centre, 6 mm leg, S355
sl = out['slimflor']; geo = sl['geom']
avail = (bp - b) / 2 - 10; e = b / 2 + 10 + avail / 2
g0s = geo['A'] * 7850e-6 * 9.81e-3
qAs = gG * (gp + gt + gs) * LA / 2 + gQ * q * LA / 2
wFs = gG * (g0s + (gp + gt + gs) * (LA + LB) / 2) + gQ * q * (LA + LB) / 2
VEds = wFs * 6000 / 2
Sp = bp * tp * (geo['zc'] - tp / 2)
vL = VEds * Sp / geo['Iy'] / 2
m = qAs * (e - b / 2)
T = qAs + 3 * m / b                     # balanced: rigid part q, prying 3 m / b
FwRd = 470 / (math.sqrt(3) * 0.9 * 1.25) * 6 / math.sqrt(2)
out['slim_weld'] = dict(avail=avail, e=e, qA=qAs, vL=vL, T=T, res=math.hypot(T, vL), FwRd=FwRd)

(HERE.parent / 'ref_hollowcore.json').write_text(json.dumps(out, indent=1))
print('written; ASB 74 geom A', round(out['asb'][0]['geom']['A'], 1), 'table', out['asb'][0]['table']['A'])
for c in mcr_cases: print(c['name'], round(c['Mcr'] / 1e6, 2), 'kNm per unit-udl moment')
for c in out['mtrans']: print('mtrans', c)
