"""Independent reference for hollow sections and channels (written separately from the JS engine).
- Section properties by grid integration (hollow_ref.py).
- Classification from BS EN 1993-1-1 Table 5.2; Class 4 effective sections by integrating the effective geometry on a grid
  (BS EN 1993-1-5 4.4, Tables 4.1/4.2).
- Plastic N-M of CHS by numerical stress blocks; RHS by (6.39)/(6.40)/(6.41); channel by web stress block.
- Flexural buckling (Table 6.2) and torsional-flexural buckling of channels from the coupled equation
  i0^2 (N - Ncr,z)(N - Ncr,T) - y0^2 N^2 = 0 (smallest root).
Writes ../ref_shapes.json."""
import math, json, random, pathlib, csv
import numpy as np
import hollow_ref as H

E, G = 210000.0, 81000.0
FY = {'S275': [(16, 275), (40, 265), (63, 255)], 'S355': [(16, 355), (40, 345), (63, 335)], 'S460': [(16, 460), (40, 440), (63, 430)]}
IMP = {'a0': 0.13, 'a': 0.21, 'b': 0.34, 'c': 0.49, 'd': 0.76}

def fy_of(grade, t):
    for lim, f in FY[grade]:
        if t <= lim: return f

def lims_internal(alpha, psi, eps):
    if alpha <= 0: return (math.inf,) * 3
    c1 = 396 * eps / (13 * alpha - 1) if alpha > 0.5 else 36 * eps / alpha
    c2 = 456 * eps / (13 * alpha - 1) if alpha > 0.5 else 41.5 * eps / alpha
    c3 = 42 * eps / (0.67 + 0.33 * psi) if psi > -1 else 62 * eps * (1 - psi) * math.sqrt(-psi)
    return (c1, c2, c3)

def klass(ratio, lims):
    for i, l in enumerate(lims):
        if ratio <= l: return i + 1
    return 4

def ksig(psi):
    if psi == 1: return 4.0
    if psi == 0: return 7.81
    if psi == -1: return 23.9
    if psi > 0: return 8.2 / (1.05 + psi)
    if psi > -1: return 7.81 - 6.29 * psi + 9.78 * psi ** 2
    return 5.98 * (1 - psi) ** 2

def rho_int(cb, t, eps, psi):
    lp = cb / t / (28.4 * eps * math.sqrt(ksig(psi)))
    return 1.0 if lp <= 0.5 + math.sqrt(0.085 - 0.055 * psi) else min(1.0, (lp - 0.055 * (3 + psi)) / lp ** 2)

# ---------- RHS ----------
def rhs_case(h, b, t, cold, grade, N, My, V, Mz, Vz):
    p = H.rhs_poly(h, b, t, cold)
    fy = fy_of(grade, t); eps = math.sqrt(235 / fy)
    cf, cw = b - 3 * t, h - 3 * t
    bend = abs(My) > 1e-6 or abs(Mz) > 1e-6; biax = abs(Mz) > 1e-6
    if biax or not bend:
        alpha, psi = (1.0, 1.0) if (biax or N > 0) else (0.0, -1.0)
    else:
        alpha = min(1.0, 0.5 + N / (4 * fy * t * cw)); psi = max(-3.0, min(1.0, 2 * N / (p['A'] * fy) - 1))
    fcls = 1 if (not bend and not N > 0 and not biax) else klass(cf / t, lims_internal(1, 1, eps))
    wcls = klass(cw / t, lims_internal(alpha, psi, eps))
    cls = max(fcls, wcls)
    # compression class for Aeff
    fc, wc = klass(cf / t, lims_internal(1, 1, eps)), klass(cw / t, lims_internal(1, 1, eps))
    Aeff = p['A']
    if wc == 4: Aeff -= 2 * (1 - rho_int(cw, t, eps, 1)) * cw * t
    if fc == 4: Aeff -= 2 * (1 - rho_int(cf, t, eps, 1)) * cf * t
    Av = p['A'] * h / (b + h); Avz = p['A'] * b / (b + h)
    hw = h - 2 * t
    VRd = Av * fy / math.sqrt(3)
    if hw / t > 72 * eps:
        lw = hw / (86.4 * t * eps); chiw = 1.0 if lw < 0.83 else 0.83 / lw
        VRd = min(VRd, 2 * min(chiw, 1.0) * fy * hw * t / math.sqrt(3))
    VRdz = Avz * fy / math.sqrt(3)
    uV = max(abs(V) / VRd, abs(Vz) / VRdz)
    NRd = (Aeff if N > 0 else p['A']) * fy
    out = dict(cls=cls, Aeff=Aeff, uV=uV, NRd=NRd)
    slender = hw / t > 72 * eps
    rho = (2 * abs(V) / VRd - 1) ** 2 if (abs(V) > 0.5 * VRd and not slender) else 0.0
    rhoz = (2 * abs(Vz) / VRdz - 1) ** 2 if abs(Vz) > 0.5 * VRdz else 0.0
    Aw = 2 * hw * t
    if cls <= 2:
        Ar = p['A'] - rho * Aw; n = abs(N) / (Ar * fy)
        Mply = (p['Wply'] - rho * Aw ** 2 / (8 * t)) * fy; Mplz = (1 - rhoz) * p['Wplz'] * fy
        aw = min(0.5, (p['A'] - 2 * b * t) / p['A']); af = min(0.5, (p['A'] - 2 * h * t) / p['A'])
        MNy = max(0.0, min(Mply, Mply * (1 - n) / (1 - 0.5 * aw))); MNz = max(0.0, min(Mplz, Mplz * (1 - n) / (1 - 0.5 * af)))
        ex = min(6.0, 1.66 / (1 - 1.13 * n * n))
        r = lambda m, R: 0.0 if m <= 1e-6 else (math.inf if R <= 0 else m / R)
        uNM = r(abs(My), MNy) ** ex + r(abs(Mz), MNz) ** ex if abs(Mz) > 1e-6 else r(abs(My), MNy)
        out['uM'] = max(uNM, n)
    else:
        W = p['Wely'] if cls == 3 else weff_rhs(h, b, t, cold, fy)
        Wy = W - rho * 2 * t * hw ** 3 / (6 * h); Wz = (1 - rhoz) * p['Welz']
        out['uM'] = (abs(N) / (Aeff if N > 0 else p['A']) + abs(My) / Wy + abs(Mz) / Wz) / fy
        if cls == 4: out['Weff'] = W
    if slender:                                  # EN 1993-1-5 7.1(1) with 5.4(2) and (6.39)
        lw = hw / (86.4 * t * eps); chiw = 1.0 if lw < 0.83 else 0.83 / lw
        Vbw = 2 * chiw * fy * hw * t / math.sqrt(3)
        eta3 = abs(V) / Vbw
        if eta3 > 0.5:
            Af = 2 * b * t; Mpl = p['Wply'] * fy; n = abs(N) / (p['A'] * fy)
            aw = min(0.5, (p['A'] - Af) / p['A'])
            MplN = max(0.0, min(Mpl, Mpl * (1 - n) / (1 - 0.5 * aw)))
            Mf = max(0.0, b * t * (h - t) * fy * (1 - abs(N) / (Af * fy)))
            Mv = MplN - (MplN - Mf) * (2 * min(1.0, eta3) - 1) ** 2
            out['uM'] = max(out['uM'], 0.0 if abs(My) <= 1e-6 else (abs(My) / Mv if Mv > 0 else math.inf))
    return out

def weff_rhs(h, b, t, cold, fy):
    """effective section modulus under major-axis bending: exact gross polygon section minus rectangular ineffective
    strips (flange: centre strip, psi = 1; webs: Table 4.1 with psi from the effective flange + gross webs)"""
    eps = math.sqrt(235 / fy)
    g = H.rhs_poly(h, b, t, cold)
    A, I0 = g['A'], g['Iy']                      # about the gross centroid (z = 0)
    holes = []                                   # (area, z centroid, own I)
    cf, cw = b - 3 * t, h - 3 * t
    if klass(cf / t, lims_internal(1, 1, eps)) == 4:
        hf = (1 - rho_int(cf, t, eps, 1)) * cf
        holes.append((hf * t, h / 2 - t / 2, hf * t ** 3 / 12))
    a1 = A - sum(x[0] for x in holes); zc = -sum(x[0] * x[1] for x in holes) / a1
    psi = max(-3.0, (-cw / 2 - zc) / (cw / 2 - zc))
    rw = rho_int(cw, t, eps, psi)
    if psi < 0: bc = cw / (1 - psi); beff = rw * bc; be1 = 0.4 * beff
    else: bc = cw; beff = rw * cw; be1 = 2 * beff / (5 - psi)
    hole = bc - beff
    if hole > 0: holes.append((2 * hole * t, cw / 2 - be1 - hole / 2, 2 * t * hole ** 3 / 12))
    Ae = A - sum(x[0] for x in holes); ze = -sum(x[0] * x[1] for x in holes) / Ae
    Ie = I0 - sum(x[2] + x[0] * x[1] ** 2 for x in holes) - Ae * ze * ze
    return Ie / (h / 2 - ze)

# ---------- CHS ----------
def chs_case(d, t, cold, grade, N, My, V, Mz, Vz):
    p = H.chs(d, t); fy = fy_of(grade, t); eps = math.sqrt(235 / fy)
    cls = klass(d / t, (50 * eps ** 2, 70 * eps ** 2, 90 * eps ** 2))
    if cls == 4: return None
    Av = 2 * p['A'] / math.pi; VRd = Av * fy / math.sqrt(3)
    Vr = math.hypot(V, Vz); uV = max(abs(V), abs(Vz)) / VRd
    rho = (2 * Vr / VRd - 1) ** 2 if Vr > 0.5 * VRd else 0.0
    out = dict(cls=cls, Aeff=p['A'], uV=uV, NRd=p['A'] * fy)
    M = math.hypot(My, Mz)
    if cls <= 2:
        fyr = (1 - rho) * fy
        MN = chs_mn_grid(d, t, fyr, abs(N))
        n = abs(N) / (p['A'] * fyr)
        out['uM'] = max(0.0 if M <= 1e-6 else (M / MN if MN > 0 else math.inf), n)
    else:
        out['uM'] = (abs(N) / p['A'] + M / ((1 - rho) * p['Wel'])) / fy
    return out

def chs_mn_grid(d, t, fyr, N, nr=120, nth=40000):
    """plastic N-M of an annulus by polar integration: stress +fyr above the neutral axis z0, -fyr below"""
    R, r = d / 2, d / 2 - t
    rr = r + (np.arange(nr) + 0.5) / nr * t; th = (np.arange(nth) + 0.5) / nth * 2 * math.pi
    RR, TH = np.meshgrid(rr, th); Z = RR * np.sin(TH); dA = RR * (t / nr) * (2 * math.pi / nth)
    A = dA.sum()
    if N >= A * fyr: return 0.0
    order = np.argsort(Z.ravel()); zs = Z.ravel()[order]; cum = np.cumsum(dA.ravel()[order])
    k = np.searchsorted(cum, (A - N / fyr) / 2); z0 = zs[min(k, len(zs) - 1)]
    sgn = np.where(Z > z0, 1.0, -1.0)
    return fyr * (sgn * Z * dA).sum()

# ---------- channel ----------
def pfc_props(row):
    f = {k: float(v) for k, v in row.items() if k != 'desig'}
    bp, hp = f['b'] - f['tw'] / 2, f['h'] - f['tf']
    e = 3 * bp * bp * f['tf'] / (6 * bp * f['tf'] + hp * f['tw'])
    return dict(name=row['desig'].replace(' x ', '×') + ' PFC', h=f['h'], b=f['b'], tw=f['tw'], tf=f['tf'], r=f['r'], A=f['A'] * 100,
                Iy=f['Iy'] * 1e4, Iz=f['Iz'] * 1e4, Wely=f['Wely'] * 1e3, Welz=f['Welz'] * 1e3, Wply=f['Wply'] * 1e3, Wplz=f['Wplz'] * 1e3,
                It=f['It'] * 1e4, Iw=f['Iw'] * 1e12, cy=f['cy'] * 10, y0=f['cy'] * 10 - f['tw'] / 2 + e)

def pfc_case(s, grade, N, My, V, Mz, Vz):
    fy = fy_of(grade, max(s['tw'], s['tf'])); eps = math.sqrt(235 / fy)
    cf = s['b'] - s['tw'] - s['r']; cw = s['h'] - 2 * s['tf'] - 2 * s['r']
    bend = abs(My) > 1e-6 or abs(Mz) > 1e-6
    if not bend: alpha, psi = (1.0, 1.0) if N > 0 else (0.0, -1.0)
    else: alpha = min(1.0, 0.5 + N / (2 * s['tw'] * fy * cw)); psi = max(-3.0, min(1.0, 2 * N / (s['A'] * fy) - 1))
    fcls = klass(cf / s['tf'], (9 * eps, 10 * eps, 14 * eps)); wcls = klass(cw / s['tw'], lims_internal(alpha, psi, eps))
    cls = max(fcls, wcls)
    hw = s['h'] - 2 * s['tf']
    Av = max(s['A'] - 2 * s['b'] * s['tf'] + (s['tw'] + s['r']) * s['tf'], hw * s['tw']); Avz = s['A'] - hw * s['tw']
    VRd = Av * fy / math.sqrt(3); VRdz = Avz * fy / math.sqrt(3)
    uV = max(abs(V) / VRd, abs(Vz) / VRdz)
    rho = (2 * abs(V) / VRd - 1) ** 2 if abs(V) > 0.5 * VRd else 0.0
    rhoz = (2 * abs(Vz) / VRdz - 1) ** 2 if abs(Vz) > 0.5 * VRdz else 0.0
    Aeff = s['A']
    if klass(cw / s['tw'], lims_internal(1, 1, eps)) == 4: Aeff -= (1 - rho_int(cw, s['tw'], eps, 1)) * cw * s['tw']
    if klass(cf / s['tf'], (9 * eps, 10 * eps, 14 * eps)) == 4:
        lp = cf / s['tf'] / (28.4 * eps * math.sqrt(0.43)); rf = 1.0 if lp <= 0.748 else min(1.0, (lp - 0.188) / lp ** 2)
        Aeff -= 2 * (1 - rf) * cf * s['tf']
    out = dict(cls=cls, uV=uV, NRd=(Aeff if N > 0 else s['A']) * fy, Aeff=Aeff)
    Aw = hw * s['tw']
    if cls <= 2:
        Npl = (s['A'] - rho * Aw) * fy; n = abs(N) / Npl
        Mply = (s['Wply'] - rho * Aw ** 2 / (4 * s['tw'])) * fy; Mplz = (1 - rhoz) * s['Wplz'] * fy
        twr = s['tw'] * (1 - rho); Nw = (hw - 2 * s['r']) * twr * fy
        if abs(N) <= Nw: MNy = Mply - N * N / (4 * twr * fy)
        else:
            Mw = max(0.0, Mply - Nw * Nw / (4 * twr * fy)); MNy = max(0.0, Mw * (1 - (abs(N) - Nw) / (Npl - Nw)))
        MNz = max(0.0, Mplz * (1 - n))
        r = lambda m, R: 0.0 if m <= 1e-6 else (math.inf if R <= 0 else m / R)
        out['uM'] = max(r(abs(My), MNy) + r(abs(Mz), MNz), n)
    else:
        out['uM'] = (abs(N) / (Aeff if N > 0 else s['A']) + abs(My) / (s['Wely'] - rho * s['tw'] * hw ** 3 / (6 * s['h'])) + abs(Mz) / ((1 - rhoz) * s['Welz'])) / fy
    return out

def chi(lam, a):
    if lam <= 0.2: return 1.0
    ph = 0.5 * (1 + a * (lam - 0.2) + lam * lam)
    return min(1.0, 1 / (ph + math.sqrt(ph * ph - lam * lam)))

def pfc_buckling(s, grade, L, Aeff):
    fy = fy_of(grade, max(s['tw'], s['tf'])); NRk = Aeff * fy
    Ncrz = math.pi ** 2 * E * s['Iz'] / L ** 2; Ncry = math.pi ** 2 * E * s['Iy'] / L ** 2
    i02 = (s['Iy'] + s['Iz']) / s['A'] + s['y0'] ** 2
    NcrT = (G * s['It'] + math.pi ** 2 * E * s['Iw'] / L ** 2) / i02
    # smallest root of i02 (N - Ncrz)(N - NcrT) - y0^2 N^2 = 0
    a = i02 - s['y0'] ** 2; bq = -i02 * (Ncrz + NcrT); c = i02 * Ncrz * NcrT
    NcrTF = (-bq - math.sqrt(bq * bq - 4 * a * c)) / (2 * a)
    cy_, cz_, cT_ = chi(math.sqrt(NRk / Ncry), IMP['c']), chi(math.sqrt(NRk / Ncrz), IMP['c']), chi(math.sqrt(NRk / NcrTF), IMP['c'])
    return dict(NcrTF=NcrTF, NbRd=min(cy_, cz_, cT_) * NRk)

def hollow_buckling(A_, I, grade, t, cold, L, Aeff=None):
    fy = fy_of(grade, t); NRk = (Aeff or A_) * fy
    a = IMP['c'] if cold else (IMP['a0'] if grade == 'S460' else IMP['a'])
    return dict(NbRd=chi(math.sqrt(NRk / (math.pi ** 2 * E * I / L ** 2)), a) * NRk)

if __name__ == '__main__':
    random.seed(11)
    here = pathlib.Path(__file__).resolve().parent
    cases = []
    sizes = [(40, 40), (60, 60), (100, 100), (150, 150), (200, 200), (300, 300), (400, 400), (100, 50), (150, 100), (200, 100), (300, 200), (400, 200), (500, 300)]
    ts = [3.2, 4.0, 5.0, 6.3, 8.0, 10.0, 12.5, 16.0]
    while len([c for c in cases if c['kind'] == 'RHS']) < 120:
        h, b = random.choice(sizes); t = random.choice(ts)
        if b / t < 6.25 or b / t > 60: continue
        cold = random.random() < 0.4; grade = random.choice(['S275', 'S355', 'S460'])
        p = H.rhs_poly(h, b, t, cold); fy = fy_of(grade, t)
        N = random.choice([0, 0, random.uniform(-0.5, 0.8) * p['A'] * fy])
        My = random.uniform(-1, 1) * p['Wply'] * fy * random.choice([0.3, 0.7]); Mz = random.choice([0, random.uniform(-0.4, 0.4) * p['Wplz'] * fy])
        V = random.uniform(-1, 1) * p['A'] * h / (b + h) * fy / math.sqrt(3) * random.choice([0.2, 0.6, 0.9]); Vz = random.choice([0, 0.3 * p['A'] * b / (b + h) * fy / math.sqrt(3)])
        exp = rhs_case(h, b, t, cold, grade, N, My, V, Mz, Vz)
        L = random.choice([2000, 4000, 7000]); exp.update(hollow_buckling(p['A'], p['Iz'], grade, t, cold, L, exp['Aeff']))
        cases.append(dict(kind='RHS', h=h, b=b, t=t, cold=cold, grade=grade, N=N, My=My, V=V, Mz=Mz, Vz=Vz, L=L, exp=exp,
                          props=dict(A=p['A'], Iy=p['Iy'], Iz=p['Iz'], Wply=p['Wply'], Wplz=p['Wplz'], It=p['It'], Wt=p['Wt'])))
    # Class 4 webs and flanges in bending: thin large RHS
    for (h, b, t) in [(400, 200, 5.0), (500, 300, 6.3), (400, 400, 6.3), (300, 300, 5.0), (500, 200, 6.3)]:
        for grade in ['S355', 'S460']:
            for cold in [False, True]:
                p = H.rhs_poly(h, b, t, cold); fy = fy_of(grade, t)
                exp = rhs_case(h, b, t, cold, grade, 0, 0.5 * p['Wely'] * fy, 0, 0, 0)
                cases.append(dict(kind='RHS', h=h, b=b, t=t, cold=cold, grade=grade, N=0, My=0.5 * p['Wely'] * fy, V=0, Mz=0, Vz=0, L=3000, exp=exp, props=None))
    chs_d = [42.4, 60.3, 88.9, 114.3, 168.3, 219.1, 273.0, 323.9, 406.4, 508.0]
    while len([c for c in cases if c['kind'] == 'CHS']) < 80:
        d = random.choice(chs_d); t = random.choice(ts)
        if d / t < 6 or d / t > 120: continue
        cold = random.random() < 0.4; grade = random.choice(['S275', 'S355', 'S460'])
        p = H.chs(d, t); fy = fy_of(grade, t)
        N = random.choice([0, random.uniform(-0.5, 0.9) * p['A'] * fy]); My = random.uniform(-1, 1) * p['Wpl'] * fy * 0.6
        Mz = random.choice([0, random.uniform(-0.5, 0.5) * p['Wpl'] * fy]); V = random.uniform(-1, 1) * 2 * p['A'] / math.pi * fy / math.sqrt(3) * random.choice([0.2, 0.7])
        exp = chs_case(d, t, cold, grade, N, My, V, Mz, 0)
        if exp is None: continue
        L = random.choice([2000, 5000]); exp.update(hollow_buckling(p['A'], p['I'], grade, t, cold, L))
        cases.append(dict(kind='CHS', d=d, t=t, cold=cold, grade=grade, N=N, My=My, V=V, Mz=Mz, Vz=0, L=L, exp=exp, props=dict(A=p['A'], Iy=p['I'], Wply=p['Wpl'], It=p['It'])))
    rows = list(csv.DictReader(open(here / 'pfc.csv')))
    for k in range(80):
        s = pfc_props(random.choice(rows)); grade = random.choice(['S275', 'S355', 'S460']); fy = fy_of(grade, max(s['tw'], s['tf']))
        N = random.choice([0, 0, random.uniform(-0.4, 0.8) * s['A'] * fy]); My = random.uniform(-1, 1) * s['Wply'] * fy * 0.5
        Mz = random.choice([0, random.uniform(-0.3, 0.3) * s['Wplz'] * fy]); V = random.uniform(-1, 1) * s['A'] * 0.4 * fy / math.sqrt(3)
        exp = pfc_case(s, grade, N, My, V, Mz, 0)
        L = random.choice([1500, 3000, 5000]); exp.update(pfc_buckling(s, grade, L, exp['Aeff']))
        cases.append(dict(kind='PFC', name=s['name'], grade=grade, N=N, My=My, V=V, Mz=Mz, Vz=0, L=L, exp=exp))
    (here.parent / 'ref_shapes.json').write_text(json.dumps(cases, default=float))
    print(len(cases), 'shape reference cases written')
