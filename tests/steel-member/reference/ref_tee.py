"""Independent reference for tees cut from UKB and UKC (written separately from the JS engine).
- Section properties by integrating thin horizontal strips (200 000 of them): the flange, the stem and the two root fillets
  (width r - sqrt(r^2 - (r - u)^2) each u below the flange); A, centroid, I_y, I_z, W_el, W_pl (plastic neutral axis by
  cumulative area), W_pl,z, and the Wagner integral of z(y^2 + z^2) for z_j = z_0 - integral/(2 I_y), the shear centre at the
  flange-stem junction (z_0 = c - t_f/2). I_t and I_w by the SCI P363 tee formulae (the same as the engine's: not independent).
- Classification from BS EN 1993-1-1 Table 5.2 sheet 2 (the stem an outstand from the root of the fillet, c = h - t_f - r;
  its toe in compression or tension by the sign of M_y), k_sigma from BS EN 1993-1-5 Table 4.2, alpha from the plastic
  stress blocks, psi elastic with the extreme compression fibre at f_y.
- Class 4: A_eff and e_N in compression; W_eff by the sign of M_y (psi from the gross section, an outstand), by strips.
- The cross-section (6.2): shear on A_v of 6.2.6(3)(c); plastic N-M by stress blocks over the strips (the stem's yield
  strength reduced for shear); elastic fibre stresses (Class 3); 6.2.9.3 with N e_N (Class 4).
- Torsional-flexural buckling: the smallest root of i0^2 (N - Ncr,z)(N - Ncr,T) - z0^2 N^2 = 0.
- M_cr: a Galerkin sine series with the Wagner term (galerkin_wagner below), for linear moment diagrams of either sign.
Writes ../ref_tee.json."""
import math, json, random, pathlib, csv
import numpy as np
from scipy.linalg import eigh

E, G = 210000.0, 81000.0
FY = {'S275': [(16, 275), (40, 265), (63, 255), (80, 245), (100, 235), (150, 225)],
      'S355': [(16, 355), (40, 345), (63, 335), (80, 325), (100, 315), (150, 295)]}
IMP = {'c': 0.49, 'd': 0.76}

def fy_of(grade, t):
    for lim, f in FY[grade]:
        if t <= lim: return f

def klass(ratio, lims):
    for i, l in enumerate(lims):
        if ratio <= l: return i + 1
    return 4

# ---------- the tee as strips ----------
def strips(h, b, tw, tf, r, n=200000):
    d = (np.arange(n) + 0.5) * h / n                  # depth below the top of the flange
    w = np.where(d < tf, b, tw)
    u = d - tf
    inf = (u >= 0) & (u < r)
    w = w + np.where(inf, 2 * (r - np.sqrt(np.maximum(0.0, r * r - (r - u) ** 2))), 0.0)
    return d, w, h / n

def props(p):
    h, b, tw, tf, r = p['h'] / 2, p['b'], p['tw'], p['tf'], p['r']
    d, w, dd = strips(h, b, tw, tf, r)
    dA = w * dd
    A = dA.sum(); c = (d * dA).sum() / A; z = c - d
    Iy = (z * z * dA).sum(); Iz = (w ** 3 / 12 * dd).sum()
    cum = np.cumsum(dA); k = np.searchsorted(cum, A / 2); zp = d[k]
    Wply = (np.abs(d - zp) * dA).sum(); Wplz = (w * w / 4 * dd).sum()
    wag = (z * (w ** 3 / 12 + w * z * z) * dd).sum()
    z0 = c - tf / 2; zj = z0 - wag / (2 * Iy)
    a1 = -0.042 + 0.2204 * tw / tf + 0.1355 * r / tf - 0.0865 * r * tw / tf ** 2 - 0.0725 * tw ** 2 / tf ** 2
    D1 = ((tf + r) ** 2 + tw * (r + tw / 4)) / (2 * r + tf)
    It = b * tf ** 3 / 3 + (h - tf) * tw ** 3 / 3 + a1 * D1 ** 4 - 0.21 * tf ** 4 - 0.105 * tw ** 4
    Iw = b ** 3 * tf ** 3 / 144 + tw ** 3 * (h - tf / 2) ** 3 / 36
    return dict(h=h, b=b, tw=tw, tf=tf, r=r, A=A, c=c, Iy=Iy, Iz=Iz, WelyF=Iy / c, WelyT=Iy / (h - c), Wely=min(Iy / c, Iy / (h - c)),
                Welz=Iz / (b / 2), Wply=Wply, Wplz=Wplz, zp=zp, It=It, Iw=Iw, z0=z0, zj=zj)

def depth_of_area(s, a, k=1.0):
    d, w, dd = strips(s['h'], s['b'], s['tw'], s['tf'], s['r'], 40000)
    dA = w * dd * np.where(d < s['tf'], 1.0, k)
    cum = np.cumsum(dA)
    i = np.searchsorted(cum, a)
    return d[min(i, len(d) - 1)]

# ---------- classification ----------
def ks_tip_comp(psi):
    p = max(-3.0, min(1.0, psi)); return 0.57 - 0.21 * p + 0.07 * p * p

def ks_tip_tens(psi):
    if psi >= 1: return 0.43
    if psi > 0: return 0.578 / (psi + 0.34)
    if psi > -1: return 1.7 - 5 * psi + 17.1 * psi * psi
    return 23.8

def classify(s, fy, N, bending, biax, sgn):
    if bending and sgn == 0:
        a, b_ = classify(s, fy, N, True, biax, 1), classify(s, fy, N, True, biax, -1)
        return b_ if b_['cls'] > a['cls'] else a
    eps = math.sqrt(235 / fy); A, h = s['A'], s['h']
    cf = (s['b'] - s['tw'] - 2 * s['r']) / 2; cw = h - s['tf'] - s['r']; d0 = s['tf'] + s['r']
    Ac = (A + N / fy) / 2
    alpha = psi = ks = None
    if not bending:
        if N > 0: alpha, psi, ks, lims = 1, 1, 0.43, (9 * eps, 10 * eps, 14 * eps)
        else: alpha, psi, lims = 0, -1, (math.inf,) * 3
    elif Ac >= A: alpha, psi, ks, lims = 1, 1, 0.43, (9 * eps, 10 * eps, 14 * eps)
    elif Ac <= 0: alpha, psi, lims = 0, -1, (math.inf,) * 3
    else:
        sN = N / A
        if sgn > 0:
            dp = depth_of_area(s, Ac); alpha = max(0, min(1, (dp - d0) / cw))
            k = (fy - sN) / s['c']; sr = sN + k * (s['c'] - d0); st = sN + k * (s['c'] - h)
            if alpha <= 0 and sr <= 0: psi, lims = -1, (math.inf,) * 3
            else:
                psi = max(-3, st / sr) if sr > 0 else -1; ks = ks_tip_tens(psi); aa = max(alpha, 1e-9)
                lims = (9 * eps / (aa * math.sqrt(aa)), 10 * eps / (aa * math.sqrt(aa)), 21 * eps * math.sqrt(ks))
        else:
            dp = depth_of_area(s, A - Ac); alpha = max(0, min(1, (h - max(dp, d0)) / cw))
            k = -(fy - sN) / (h - s['c']); sr = sN + k * (s['c'] - d0)
            psi = max(-3, min(1, sr / fy)); ks = ks_tip_comp(psi); aa = max(alpha, 1e-9)
            lims = (9 * eps / aa, 10 * eps / aa, 21 * eps * math.sqrt(ks))
    wcls = klass(cw / s['tw'], lims)
    fcomp = biax or N > 0 or (bending and sgn > 0)
    fcls = klass(cf / s['tf'], (9 * eps, 10 * eps, 14 * eps)) if fcomp else 1
    return dict(cls=max(fcls, wcls), fcls=fcls, wcls=wcls, alpha=alpha, psi=psi, ks=ks, cw=cw, eps=eps)

# ---------- effective sections (strips with the hole taken out) ----------
def eff(s, hole_from, hole_to):
    d, w, dd = strips(s['h'], s['b'], s['tw'], s['tf'], s['r'], 100000)
    keep = ~((d > hole_from) & (d < hole_to) & (d > s['tf'] + s['r']))
    dA = w * dd * keep
    Aeff = dA.sum(); ce = (d * dA).sum() / Aeff
    Ieff = ((ce - d) ** 2 * dA).sum()
    lo = d[keep].max()
    return Aeff, ce, Ieff, lo

def rho_out(lp): return 1.0 if lp <= 0.748 else min(1.0, (lp - 0.188) / lp ** 2)

def aeff_comp(s, fy):
    k = classify(s, fy, 1.0, False, False, 0)
    if k['wcls'] < 4: return s['A'], 0.0, 1.0
    rho = rho_out((k['cw'] / s['tw']) / (28.4 * k['eps'] * math.sqrt(0.43)))
    L = (1 - rho) * k['cw']
    Aeff, ce, _, _ = eff(s, s['h'] - L, s['h'] + 1)
    return Aeff, s['c'] - ce, rho

def weff(s, fy, sgn):
    k = classify(s, fy, 0.0, True, False, sgn)
    if k['cls'] < 4: return s['Wely'], 1.0
    rho = rho_out((k['cw'] / s['tw']) / (28.4 * k['eps'] * math.sqrt(k['ks'])))
    bc = k['cw'] / (1 - k['psi']) if k['psi'] < 0 else k['cw']
    hole = bc - rho * bc; d0 = s['tf'] + s['r']
    a, b_ = (s['h'] - hole, s['h'] + 1) if sgn < 0 else (d0 + rho * bc, d0 + bc)
    Aeff, ce, Ieff, lo = eff(s, a, b_)
    return Ieff / max(ce, lo + s['h'] / 100000 / 2 - ce), rho

# ---------- the cross-section ----------
def plastic_M(s, fyd, N, sgn, k):
    d, w, dd = strips(s['h'], s['b'], s['tw'], s['tf'], s['r'], 100000)
    dA = w * dd * np.where(d < s['tf'], 1.0, k)
    F = dA.sum() * fyd; C = (F + N) / 2
    if C <= 0 or C >= F: return 0.0, F
    cum = np.cumsum(dA) * fyd
    if sgn >= 0: comp = cum <= C
    else: comp = cum >= F - C
    M = (np.where(comp, 1.0, -1.0) * fyd * (s['c'] - d) * dA).sum()
    return abs(M), F

def section(s, fy, N, My, V, Mz, Vz):
    sgn = 1 if My > 1e-6 else (-1 if My < -1e-6 else 0); biax = abs(Mz) > 1e-6
    k = classify(s, fy, N, sgn != 0, biax, sgn)
    Av = s['A'] - s['b'] * s['tf'] + (s['tw'] + 2 * s['r']) * s['tf'] / 2; Vpl = Av * fy / math.sqrt(3)
    Avy = s['A'] - (s['h'] - s['tf']) * s['tw']; Vply = Avy * fy / math.sqrt(3)
    rho = (2 * abs(V) / Vpl - 1) ** 2 if abs(V) > 0.5 * Vpl else 0.0
    rhoZ = (2 * abs(Vz) / Vply - 1) ** 2 if abs(Vz) > 0.5 * Vply else 0.0
    Aeff, eN, _ = aeff_comp(s, fy)
    NRd = (Aeff if (N > 0 and Aeff < s['A']) else s['A']) * fy
    out = dict(cls=k['cls'], Av=Av, Vpl=Vpl, NRd=NRd, rho=rho)
    if k['cls'] <= 2:
        MN, F = plastic_M(s, fy, N, sgn or 1, 1 - rho)
        n = abs(N) / F; MNz = max(0.0, (1 - rhoZ) * s['Wplz'] * fy * (1 - n))
        u = (abs(My) / MN if abs(My) > 1e-6 else 0.0) + (abs(Mz) / MNz if abs(Mz) > 1e-6 else 0.0)
        out.update(MNy=MN, uM=max(u, n))
    elif k['cls'] == 3:
        sN = N / s['A']; sT = sN + My / s['WelyF']; sB = sN - My / s['WelyT']
        u = max((abs(sT) + abs(Mz) / s['Welz']) / ((1 - rhoZ) * fy), (abs(sB) + abs(Mz) * s['tw'] / 2 / s['Iz']) / ((1 - rho) * fy))
        out.update(uM=u)
    else:
        A_ = Aeff if N > 0 else s['A']; e = eN if N > 0 else 0.0
        M1 = My - (N * e if N > 0 else 0.0)
        W, _ = weff(s, fy, 1 if M1 >= 0 else -1)
        sig = abs(N) / A_ + abs(M1) / W + abs(Mz) / s['Welz']
        out.update(uM=sig / ((1 - max(rho, rhoZ)) * fy))
    return out

# ---------- buckling ----------
def chi(lam, a):
    if lam <= 0.2: return 1.0
    ph = 0.5 * (1 + a * (lam - 0.2) + lam * lam)
    return min(1.0, 1 / (ph + math.sqrt(ph * ph - lam * lam)))

def axial(s, fy, Lcry, Lcrz, LT):
    Aeff, _, _ = aeff_comp(s, fy); NRk = Aeff * fy
    Ncry = math.pi ** 2 * E * s['Iy'] / Lcry ** 2; Ncrz = math.pi ** 2 * E * s['Iz'] / Lcrz ** 2
    i02 = (s['Iy'] + s['Iz']) / s['A'] + s['z0'] ** 2
    NcrT = (G * s['It'] + math.pi ** 2 * E * s['Iw'] / LT ** 2) / i02
    a = i02 - s['z0'] ** 2; bq = -i02 * (Ncrz + NcrT); c = i02 * Ncrz * NcrT
    NcrTF = (-bq - math.sqrt(bq * bq - 4 * a * c)) / (2 * a)
    ch = min(chi(math.sqrt(NRk / Ncry), IMP['c']), chi(math.sqrt(NRk / Ncrz), IMP['c']), chi(math.sqrt(NRk / NcrTF), IMP['c']))
    return dict(NcrTF=NcrTF, NbRd=ch * NRk)

def galerkin_wagner(L, EIz, GJ, EIw, zj, M, N=40, nq=4000):
    x = np.linspace(0, L, nq + 1); wq = np.full(nq + 1, L / nq); wq[0] = wq[-1] = L / nq / 2
    k = np.arange(1, N + 1)[:, None] * np.pi / L; kk = k[:, 0]
    S = np.sin(k * x); Sd2 = -(k ** 2) * S; Sd1 = k * np.cos(k * x)
    K = np.zeros((2 * N, 2 * N)); Kg = np.zeros((2 * N, 2 * N))
    K[:N, :N] = np.diag(EIz * kk ** 4 * L / 2); K[N:, N:] = np.diag((GJ * kk ** 2 + EIw * kk ** 4) * L / 2)
    Mx = M(x)
    C = (S * Mx * wq) @ Sd2.T
    Kg[N:, :N] = C; Kg[:N, N:] = C.T
    Kg[N:, N:] -= 2 * zj * (Sd1 * Mx * wq) @ Sd1.T          # Wagner: stabilising where M z_j > 0
    mu = eigh(Kg, K, eigvals_only=True)
    return 1 / mu.max() if mu.max() > 0 else math.inf

def ltb(s, fy, L, MA, MB):
    Mf = lambda x: MA + (MB - MA) * x / L
    lam = galerkin_wagner(L, E * s['Iz'], G * s['It'], E * s['Iw'], s['zj'], Mf)
    out = []
    for sg in (1, -1):
        Ms = max(0.0, sg * MA, sg * MB)
        if Ms < 1: continue
        cls = classify(s, fy, 0.0, True, False, sg)['cls']
        W = s['Wply'] if cls <= 2 else s['Wely'] if cls == 3 else weff(s, fy, sg)[0]
        Mcr = lam * Ms; lt = math.sqrt(W * fy / Mcr)
        if lt <= 0.2 or Ms / Mcr <= 0.04: x_ = 1.0
        else:
            ph = 0.5 * (1 + IMP['d'] * (lt - 0.2) + lt * lt); x_ = min(1.0, 1 / (ph + math.sqrt(ph * ph - lt * lt)))
        out.append(dict(sgn=sg, cls=cls, Mcr=Mcr, MbRd=x_ * W * fy, util=Ms / (x_ * W * fy)))
    return out

if __name__ == '__main__':
    random.seed(5)
    here = pathlib.Path(__file__).resolve().parent
    parents = []
    for fn, ser in (('ukb.csv', 'UKB'), ('ukc.csv', 'UKC')):
        for row in csv.DictReader(open(here / fn)):
            parents.append(dict(name=row['desig'].replace(' x ', '×') + ' ' + ser, mass=float(row['mass']), h=float(row['h']), b=float(row['b']),
                                tw=float(row['tw']), tf=float(row['tf']), r=float(row['r'])))
    out = dict(props=[], sections=[], axial=[], ltb=[])
    for p in parents:
        s = props(p)
        out['props'].append(dict(parent=p, exp={k: s[k] for k in ('A', 'c', 'Iy', 'Iz', 'WelyF', 'WelyT', 'Welz', 'Wply', 'Wplz', 'zp', 'z0', 'zj')}))
    for _ in range(160):
        p = random.choice(parents); s = props(p); grade = random.choice(['S275', 'S355']); fy = fy_of(grade, max(s['tf'], s['tw']))
        N = random.choice([0.0, 0.0, random.uniform(-0.6, 0.7) * s['A'] * fy])
        My = random.choice([1, -1]) * random.uniform(0.05, 0.6) * s['Wely'] * fy * random.choice([0, 1, 1])
        Mz = random.choice([0.0, random.uniform(-0.3, 0.3) * s['Wplz'] * fy])
        Av = s['A'] - s['b'] * s['tf'] + (s['tw'] + 2 * s['r']) * s['tf'] / 2
        V = random.uniform(-1, 1) * Av * fy / math.sqrt(3) * random.choice([0.2, 0.7, 0.9])
        Vz = random.choice([0.0, 0.0, random.uniform(-0.8, 0.8) * (s['A'] - (s['h'] - s['tf']) * s['tw']) * fy / math.sqrt(3)])
        exp = section(s, fy, N, My, V, Mz, Vz)
        cl = classify(s, fy, N, abs(My) > 1e-6, abs(Mz) > 1e-6, 1 if My > 1e-6 else -1 if My < -1e-6 else 0)
        exp.update(fcls=cl['fcls'], wcls=cl['wcls'], alpha=cl['alpha'], psi=cl['psi'], ks=cl['ks'])
        out['sections'].append(dict(parent=p, grade=grade, fy=fy, N=N, My=My, V=V, Mz=Mz, Vz=Vz, exp=exp))
    for _ in range(40):
        p = random.choice(parents); s = props(p); grade = random.choice(['S275', 'S355']); fy = fy_of(grade, max(s['tf'], s['tw']))
        Ly, Lz = random.choice([1500, 3000, 5000]), random.choice([1000, 2500, 4000]); LT = Lz
        out['axial'].append(dict(parent=p, grade=grade, fy=fy, Lcry=Ly, Lcrz=Lz, LT=LT, exp=axial(s, fy, Ly, Lz, LT)))
    for _ in range(40):
        p = random.choice(parents); s = props(p); grade = random.choice(['S275', 'S355']); fy = fy_of(grade, max(s['tf'], s['tw']))
        L = random.choice([1500, 3000, 5000, 8000]); M0 = s['Wely'] * fy * random.uniform(0.1, 0.5)
        MA, MB = random.choice([(M0, M0), (-M0, -M0), (M0, -M0), (M0, 0.3 * M0), (-M0, 0.5 * M0), (0.0, M0)])
        out['ltb'].append(dict(parent=p, grade=grade, fy=fy, L=L, MA=MA, MB=MB, exp=ltb(s, fy, L, MA, MB)))
    (here.parent / 'ref_tee.json').write_text(json.dumps(out, default=float))
    print(len(out['props']), 'tees,', len(out['sections']), 'cross-sections,', len(out['axial']), 'axial,', len(out['ltb']), 'LTB cases written')
