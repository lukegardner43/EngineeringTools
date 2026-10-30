"""Independent reference values for the Steel Masonry Support tool, written to ../ref_masonry.json.

- Angle properties (hot-rolled with root and toe radii; cold-formed bent plate) by a fine 2D occupancy grid.
- Continuous angle on fixings: a 2D frame finite-element model (Euler-Bernoulli, centreline) of the legs per unit length -
  heel bearing (horizontal restraint) and fixing (horizontal + vertical) - for the leg moments and the load-point deflection.
- Spanning angle, plate and fixing forces by hand; the secant modulus by solving the Ramberg-Osgood curve numerically.
"""
import json, math, pathlib
import numpy as np
from scipy.optimize import brentq

HERE = pathlib.Path(__file__).resolve().parent

def angle_grid(h, b, t, r, r2=0.0, cold=False, d=0.04):
    y = np.arange(0, b, d) + d / 2; z = np.arange(0, h, d) + d / 2
    Y, Z = np.meshgrid(y, z)
    m = ((Y <= t) & (Z <= h)) | ((Z <= t) & (Y <= b))
    if r > 0:                                     # root / inside fillet at (t, t)
        m |= (Y >= t) & (Z >= t) & (Y <= t + r) & (Z <= t + r) & ((Y - t - r) ** 2 + (Z - t - r) ** 2 >= r * r)
    if r2 > 0 and not cold:                       # toe radii at the inner corners of the leg ends
        m &= ~((Y <= t) & (Y >= t - r2) & (Z >= h - r2) & ((Y - (t - r2)) ** 2 + (Z - (h - r2)) ** 2 > r2 * r2))
        m &= ~((Z <= t) & (Z >= t - r2) & (Y >= b - r2) & ((Y - (b - r2)) ** 2 + (Z - (t - r2)) ** 2 > r2 * r2))
    if cold:                                      # outside corner radius r + t
        R = r + t
        m &= ~((Y < R) & (Z < R) & ((Y - R) ** 2 + (Z - R) ** 2 > R * R))
    dA = d * d; A = m.sum() * dA
    zc = (Z * m).sum() * dA / A; Iy = (((Z - zc) ** 2) * m).sum() * dA
    zt = Z[m].max() + d / 2; zb = Z[m].min() - d / 2
    return dict(A=A, zc=zc, Iy=Iy, Wtop=Iy / (zt - zc), Wbot=Iy / (zc - zb))

def frame(e_c, z, w, EI):
    """2D frame, unit width: vertical leg (0,0)-(0,z), horizontal leg (0,0)-(e_c,0); load w down at (e_c,0).
    Supports: (0,0) ux; (0,z) ux, uy. Returns the corner moment, the vertical-leg moment at y and the load-point deflection."""
    nodes = [(0.0, 0.0), (0.0, z), (e_c, 0.0)]
    elems = [(0, 1), (0, 2)]
    nd = 3 * len(nodes); K = np.zeros((nd, nd)); F = np.zeros(nd)
    EA = EI * 1e6
    for a, b in elems:
        (x1, y1), (x2, y2) = nodes[a], nodes[b]; L = math.hypot(x2 - x1, y2 - y1); c, s = (x2 - x1) / L, (y2 - y1) / L
        k = np.array([[EA / L, 0, 0, -EA / L, 0, 0], [0, 12 * EI / L ** 3, 6 * EI / L ** 2, 0, -12 * EI / L ** 3, 6 * EI / L ** 2],
                      [0, 6 * EI / L ** 2, 4 * EI / L, 0, -6 * EI / L ** 2, 2 * EI / L], [-EA / L, 0, 0, EA / L, 0, 0],
                      [0, -12 * EI / L ** 3, -6 * EI / L ** 2, 0, 12 * EI / L ** 3, -6 * EI / L ** 2], [0, 6 * EI / L ** 2, 2 * EI / L, 0, -6 * EI / L ** 2, 4 * EI / L]])
        T = np.zeros((6, 6)); r = np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]]); T[:3, :3] = r; T[3:, 3:] = r
        idx = [3 * a, 3 * a + 1, 3 * a + 2, 3 * b, 3 * b + 1, 3 * b + 2]
        K[np.ix_(idx, idx)] += T.T @ k @ T
    F[3 * 2 + 1] = -w
    fixed = [0, 3, 4]
    free = [i for i in range(nd) if i not in fixed]
    u = np.zeros(nd); u[free] = np.linalg.solve(K[np.ix_(free, free)], F[free])
    # corner moment from the horizontal leg element end forces
    (x1, y1), (x2, y2) = nodes[0], nodes[2]; L = e_c
    kloc = np.array([[12 * EI / L ** 3, 6 * EI / L ** 2, -12 * EI / L ** 3, 6 * EI / L ** 2], [6 * EI / L ** 2, 4 * EI / L, -6 * EI / L ** 2, 2 * EI / L]])
    Mc = abs(kloc[1] @ np.array([u[1], u[2], u[7], u[8]]))
    return dict(Mc=Mc, defl=-u[7], rot=u[2])

out = {}
# ---- angle properties
out['angles'] = []
for nm, kw in [('cold 150x140x8 r8', dict(h=150, b=140, t=8, r=8, cold=True)), ('hot 150x90x10 r12 r2 4.8', dict(h=150, b=90, t=10, r=12, r2=4.8)),
               ('hot 100x100x10 r12 r2 4.8', dict(h=100, b=100, t=10, r=12, r2=4.8))]:
    out['angles'].append(dict(name=nm, dims=kw, **angle_grid(**kw)))

# ---- continuous angle on fixings: 1.4404 hot rolled plate, 150 x 140 x 8 cold formed r 8, leaf 102.5 at c = 50, 3 m at 20 kN/m3
h, b, t, r = 150.0, 140.0, 8.0, 8.0
Gk = 20e-6 * 102.5 * 3000 * 1000 / 1000      # N/mm (kN/m): rho [N/mm3] * t * H
Gk = 20 * 102.5e-3 * 3.0                     # kN/m = N/mm
wEd, wk = 1.35 * Gk, Gk
e = 50 + 102.5 / 2
s, z, dm = 500.0, 110.0, 19.0
fy, fu, E, n, gM0, gM2 = 220.0, 520.0, 200000.0, 7, 1.1, 1.25
W = wEd * s; T = W * e / z
mh = wEd * (e - t - r); mv = wEd * e * (1 - (t + r) / z); mRd = t * t / 4 * fy / gM0
# secant modulus: solve the Ramberg-Osgood strain for the SLS stress, Es = sigma / eps
def es(sig):
    eps = sig / E + 0.002 * (sig / fy) ** n
    return sig / eps
sH = wk * (e - t - r) / (t * t / 6); sV = wk * e / (t * t / 6)
Es = min(es(sH), es(sV))
ec = e - t / 2
fr = frame(ec, z, wk, Es * t ** 3 / 12)
out['fixed'] = dict(Gk=Gk, wEd=wEd, e=e, W=W, T=T, V=W, mh=mh, mv=mv, mRd=mRd, Es=Es, defl=fr['defl'], Mc_frame=fr['Mc'], Mc=wk * ec,
                    BpRd=0.6 * math.pi * dm * t * fu / gM2, inter=T / 10e3 + W / 8e3)

# ---- spanning angle: S275 hot-rolled 150 x 90 x 10 (vertical leg 150), span 1200; leaf at c = 0 so e = 51.25
p = out['angles'][1]
fy = 275.0; e = 0 + 102.5 / 2; wEd = 1.35 * Gk; wk = Gk; Ls = 1200.0; t = 10.0; r = 12.0
M = wEd * Ls ** 2 / 8; V = wEd * Ls / 2; MRd = min(p['Wtop'], p['Wbot']) * fy
It = ((150 - t / 2) + (90 - t / 2)) * t ** 3 / 3
eSC = e - t / 2; mt = wEd * eSC; Ttor = mt * Ls / 2; tauT = Ttor * t / It; tauV = V / (150 * t)
phi = wk * eSC * Ls ** 2 / (8 * 81000 * It)
dB = 5 * wk * Ls ** 4 / (384 * 210000 * p['Iy']); dT = phi * eSC; dH = wk * (e - t - r) ** 3 / (3 * 210000 * t ** 3 / 12)
psi = (t + r - p['zc']) / (150 - p['zc']); ks = 0.57 - 0.21 * psi + 0.07 * psi ** 2
out['span'] = dict(e=e, M=M, V=V, MRd=MRd, Ttor=Ttor, tauT=tauT, tauV=tauV, phi=phi, d=dB + dT + dH, psi=psi, ks=ks, lim3=21 * math.sqrt(235 / fy) * math.sqrt(ks))

# ---- plate under a beam: S355, t 15, projection 120, flange 190, leaf at c = 0 from the flange tip, weld 6
fy, fu = 355.0, 470.0; a = 102.5 / 2; wEd = 1.35 * Gk; wk = Gk
out['plate'] = dict(a=a, mEd=wEd * a, mRd=15 ** 2 / 4 * fy, T=wEd * (190 + a) / 190, FwRd=fu / (math.sqrt(3) * 0.9 * 1.25) * 6 / math.sqrt(2),
                    d=wk * a ** 3 / (3 * 210000 * 15 ** 3 / 12))
(HERE.parent / 'ref_masonry.json').write_text(json.dumps(out, indent=1))
print(json.dumps({k: out[k] for k in ('fixed', 'span', 'plate')}, indent=1)[:1500])
