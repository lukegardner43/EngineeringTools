"""Independent reference for the floor vibration engine (SCI P354 simplified method), written to ../ref_vibration.json.
Second moments by first / second moments of area about the top of the slab (composite beams) and strip integration (ribbed slab);
primary beam deflection by the unit-load method (scipy quad) under the secondary beam reactions and self weight; the P354
frequency, modal mass and response expressions restated from the guide.
"""
import json, math, pathlib, re
from scipy.integrate import quad
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
html = (ROOT / 'Floor Vibration.html').read_text()
rows = {}
for m in re.finditer(r"\['([^']+)',([^\]]+)\]", html):
    try: rows[m.group(1)] = [float(x) for x in m.group(2).split(',')]
    except ValueError: pass
def sec(n):
    mass, h, b, tw, tf, r, A, Iy = rows[n][:8]; return dict(mass=mass, h=h, A=A * 100, Iy=Iy * 1e4)
ECM = {25: 31000, 30: 33000, 32: 33300, 35: 34000, 40: 35000}
def Icomp(s, beff, hc, hs, n):
    parts = [(beff * hc / n, hc / 2, beff * hc ** 3 / (12 * n)), (s['A'], hs + s['h'] / 2, s['Iy'])]   # (area, centroid from slab top, own I)
    A = sum(p[0] for p in parts); S = sum(p[0] * p[1] for p in parts); I = sum(p[2] + p[0] * p[1] ** 2 for p in parts)
    return I - S * S / A
def slabI(hs, hp, b0, rib, k=20000):
    dz = hs / k; A = S = I = 0.0
    for i in range(k):
        z = (i + 0.5) * dz; w = 1.0 if z <= hs - hp else b0 / rib
        A += w * dz; S += w * dz * z; I += w * dz * z * z
    return I - S * S / A
def case(c):
    Ea = 210000; Ed = 1.1 * ECM[c['fck']]; n = Ea / Ed; hc = c['hs'] - c['hp']
    wA = (c['sw'] + c['sdl'] + 0.1 * c['q']) * 1e-3; m = wA * 1e6 / 9.81
    Is = slabI(c['hs'], c['hp'], c['b0'], c['rib']); S_, P_ = sec(c['sec']), sec(c['prim'])
    Ib = Icomp(S_, min(c['Ly'] / 4, c['b']), hc, c['hs'], n); Ip = Icomp(P_, min(c['Lx'] / 4, c['Ly']), hc, c['hs'], n) if c['primComp'] else P_['Iy']
    dSlab = wA * c['b'] ** 4 / (384 * Ed * Is)
    wS = wA * c['b'] + S_['mass'] * 9.81e-3
    dSBss = 5 * wS * c['Ly'] ** 4 / (384 * Ea * Ib); dSBfe = dSBss / 5
    Lx = c['Lx']; loads = []; x = c['b']
    while x < Lx - 1e-6: loads.append((x, wS * c['Ly'])); x += c['b']
    wP = P_['mass'] * 9.81e-3
    RA = wP * Lx / 2 + sum(F * (Lx - a) / Lx for a, F in loads)
    Mx = lambda x: RA * x - wP * x * x / 2 - sum(F * (x - a) for a, F in loads if a < x)
    mu = lambda x: x / 2 if x <= Lx / 2 else (Lx - x) / 2
    pts = sorted(set([0, Lx / 2, Lx] + [a for a, _ in loads]))
    dPB = sum(quad(lambda x: Mx(x) * mu(x), a, b)[0] for a, b in zip(pts, pts[1:])) / (Ea * Ip)
    fA = 18 / math.sqrt(dSlab + dSBss); fB = 18 / math.sqrt(dPB + dSBfe + dSlab); f0 = min(fA, fB)
    eta = 0.5 if f0 < 5 else (0.21 * f0 - 0.55 if f0 <= 6 else 0.71)
    EIb = Ea * Ib * 1e-6; EIs = Ed * Is * 1e-3                       # N m2 (N/mm2 x mm4 -> 1e-6 N m2), N m2/m
    Leff = min(1.09 * 1.10 ** (c['ny'] - 1) * (EIb / (m * c['b'] / 1000 * f0 ** 2)) ** 0.25, c['ny'] * c['Ly'] / 1000)
    Sw = min(eta * 1.15 ** (c['nx'] - 1) * (EIs / (m * f0 ** 2)) ** 0.25, c['nx'] * Lx / 1000)
    M = m * Leff * Sw
    W = 0.4 if f0 < 2 else f0 / 5 if f0 < 5 else 1 if f0 <= 16 else 16 / f0
    v = 1.67 * c['fp'] ** 2 - 4.83 * c['fp'] + 4.5
    rho = min(1, 1 - math.exp(-2 * math.pi * c['zeta'] * c['Lp'] * c['fp'] / v)) if c['Lp'] > 0 else 1
    Q = 76 * 9.81
    aSS = c['mue'] * c['mur'] * 0.1 * Q * W * rho / (2 * math.sqrt(2) * M * c['zeta'])
    FI = 185 / f0 ** 1.3 * Q / 700                                  # footfall impulse 60 f_p^1.43 / f0^1.3 (Q/700) with f_p = 2.2 Hz, rounded to 185 in P354 7.5
    aTR = 2 * math.pi * f0 * FI * c['mue'] * c['mur'] * W / (math.sqrt(2) * M)
    a = max(aSS, aTR) if f0 < c['cutoff'] else aTR
    return dict(Is=Is, Ib=Ib, Ip=Ip, dSlab=dSlab, dSBss=dSBss, dSBfe=dSBfe, dPB=dPB, fA=fA, fB=fB, f0=f0, m=m, Leff=Leff, S=Sw, M=M, W=W, rho=rho, aSS=aSS, aTR=aTR, R=a / 0.005)
base = dict(Ly=9000, b=3000, Lx=9000, ny=3, nx=3, sec='457×191×67 UKB', prim='610×229×113 UKB', primComp=True, hs=130, hp=60, b0=150, rib=300, fck=30,
            sw=2.6, sdl=1.2, q=3.5, zeta=0.03, mue=1, mur=1, fp=2.0, Lp=0, cutoff=10)
cases = {
  'office_9x9': base,
  'walking_path': {**base, 'Lp': 10, 'zeta': 0.011},
  'stiff_short': {**base, 'Ly': 6000, 'b': 2500, 'Lx': 7500, 'sec': '406×178×60 UKB', 'prim': '533×210×101 UKB', 'ny': 2, 'nx': 4, 'fck': 35, 'hs': 150, 'sw': 3.0},
  'long_span_noncomp_primary': {**base, 'Ly': 12000, 'sec': '533×210×92 UKB', 'primComp': False, 'prim': '686×254×140 UKB', 'ny': 1, 'nx': 1, 'zeta': 0.045, 'cutoff': 8, 'mue': 0.8, 'mur': 0.9},
}
out = {k: dict(input=v, ref=case(v)) for k, v in cases.items()}
(HERE.parent / 'ref_vibration.json').write_text(json.dumps(out, indent=1))
for k, v in out.items(): print(k, {x: round(y, 4) for x, y in v['ref'].items()})
