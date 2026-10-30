"""Independent reference for the EN 1993-1-1 clause chain (written separately from the JS engine).
Outputs a JSON list of cases with expected values for the JS cross-check."""
import math, json, random, sys
from galerkin import galerkin

E, G = 210000.0, 81000.0
FY = {'S275': [(16, 275), (40, 265), (63, 255), (80, 245), (100, 235)], 'S355': [(16, 355), (40, 345), (63, 335), (80, 325), (100, 315)],
      'S460': [(16, 460), (40, 440), (63, 430), (80, 410), (100, 400)]}
IMP = {'a0': 0.13, 'a': 0.21, 'b': 0.34, 'c': 0.49, 'd': 0.76}

def fy_of(grade, t):
    for lim, f in FY[grade]:
        if t <= lim: return f

def load_sections():
    import pathlib
    here = pathlib.Path(__file__).resolve().parent
    txt = (here.parent.parent.parent / 'Steel Member Design.html').read_text()
    rows = []
    for line in txt.splitlines():
        if line.startswith("['"):
            parts = line.strip().rstrip(',').strip('[]').split(',')
            name = parts[0].strip("'")
            vals = [float(v) for v in parts[1:]]
            rows.append((name, vals))
    return rows

def sec_of(name, v):
    mass, h, b, tw, tf, r, A, Iy, Iz, Wely, Welz, Wply, Wplz, It, Iw = v
    return dict(name=name, mass=mass, h=h, b=b, tw=tw, tf=tf, r=r, A=A * 100, Iy=Iy * 1e4, Iz=Iz * 1e4, Wely=Wely * 1e3,
                Welz=Welz * 1e3, Wply=Wply * 1e3, Wplz=Wplz * 1e3, It=It * 1e4, Iw=Iw * 1e12)

def web_class(s, fy, N, bending):
    eps = math.sqrt(235 / fy)
    c = s['h'] - 2 * s['tf'] - 2 * s['r']
    ct = c / s['tw']
    if not bending:
        if N <= 0: return 1
        lims = (33 * eps, 38 * eps, 42 * eps)
    else:
        alpha = min(1.0, 0.5 + N / (2 * s['tw'] * fy * c))
        psi = max(-3.0, min(1.0, 2 * N / (s['A'] * fy) - 1))
        if alpha <= 0: return 1
        c1 = 396 * eps / (13 * alpha - 1) if alpha > 0.5 else 36 * eps / alpha
        c2 = 456 * eps / (13 * alpha - 1) if alpha > 0.5 else 41.5 * eps / alpha
        c3 = 42 * eps / (0.67 + 0.33 * psi) if psi > -1 else 62 * eps * (1 - psi) * math.sqrt(-psi)
        lims = (c1, c2, c3)
    for i, l in enumerate(lims):
        if ct <= l: return i + 1
    return 4

def flange_class(s, fy):
    eps = math.sqrt(235 / fy)
    ct = (s['b'] - s['tw'] - 2 * s['r']) / 2 / s['tf']
    for i, l in enumerate((9 * eps, 10 * eps, 14 * eps)):
        if ct <= l: return i + 1
    return 4

def aeff(s, fy):
    if web_class(s, fy, 1, False) < 4: return s['A']
    eps = math.sqrt(235 / fy)
    c = s['h'] - 2 * s['tf'] - 2 * s['r']
    lp = (c / s['tw']) / (28.4 * eps * 2)
    rho = 1 if lp <= 0.673 else min(1, (lp - 0.22) / lp ** 2)
    return s['A'] - (1 - rho) * c * s['tw']

def shear_res(s, fy):
    eps = math.sqrt(235 / fy)
    hw = s['h'] - 2 * s['tf']
    Av = max(s['A'] - 2 * s['b'] * s['tf'] + (s['tw'] + 2 * s['r']) * s['tf'], hw * s['tw'])
    V = Av * fy / math.sqrt(3)
    if hw / s['tw'] > 72 * eps:
        lw = hw / (86.4 * s['tw'] * eps)
        chi = 1.0 if lw < 0.83 else 0.83 / lw
        V = min(V, chi * fy * hw * s['tw'] / math.sqrt(3), fy * hw * s['tw'] / math.sqrt(3))
    return V

def section_util(s, fy, N, My, V, Mz=0.0):
    bending = abs(My) > 1e-6 or abs(Mz) > 1e-6
    cls = max(flange_class(s, fy), web_class(s, fy, N, bending))
    VRd = shear_res(s, fy)
    uV = abs(V) / VRd
    rho = (2 * abs(V) / VRd - 1) ** 2 if abs(V) > 0.5 * VRd else 0.0
    hw = s['h'] - 2 * s['tf']
    Aw = hw * s['tw']
    NRd = (aeff(s, fy) if N > 0 else s['A']) * fy
    uN = abs(N) / NRd
    if cls <= 2:
        Ar = s['A'] - rho * Aw
        Npl = Ar * fy
        Mply = min(s['Wply'], s['Wply'] - rho * Aw ** 2 / (4 * s['tw'])) * fy
        Mplz = s['Wplz'] * fy
        n = abs(N) / Npl
        a = min(0.5, (Ar - 2 * s['b'] * s['tf']) / Ar)
        if abs(N) <= 0.25 * Npl and abs(N) <= 0.5 * hw * s['tw'] * (1 - rho) * fy:
            MNy = Mply
        else:
            MNy = max(0.0, min(Mply, Mply * (1 - n) / (1 - 0.5 * a)))
        MNz = Mplz if n <= a else (0.0 if n >= 1 else Mplz * (1 - ((n - a) / (1 - a)) ** 2))
        def ratio(m, r): return 0.0 if m <= 1e-6 else (math.inf if r <= 0 else m / r)
        if abs(Mz) > 1e-6:
            uM = ratio(abs(My), MNy) ** 2 + ratio(abs(Mz), MNz) ** max(1, 5 * n)
        else:
            uM = ratio(abs(My), MNy)
        uM = max(uM, n)
    else:
        Wy = s['Wely'] - rho * s['tw'] * hw ** 3 / (6 * s['h'])
        A = aeff(s, fy) if N > 0 else s['A']
        uM = (abs(N) / A + abs(My) / Wy + abs(Mz) / s['Welz']) / fy
    return dict(cls=cls, uV=uV, uM=uM, uN=uN, util=max(uV, uM, uN))

def chi_flex(lam, curve):
    if lam <= 0.2: return 1.0
    a = IMP[curve]
    phi = 0.5 * (1 + a * (lam - 0.2) + lam ** 2)
    return min(1.0, 1 / (phi + math.sqrt(phi ** 2 - lam ** 2)))

def curves(s, grade):
    hb = s['h'] / s['b']
    hi = grade == 'S460'
    if hb > 1.2:
        if s['tf'] <= 40: return ('a0', 'a0') if hi else ('a', 'b')
        return ('a', 'a') if hi else ('b', 'c')
    return ('a', 'a') if hi else ('b', 'c')

def chi_lt(lam, MoverMcr, s, kc):
    hb = s['h'] / s['b']
    curve = 'b' if hb <= 2 else ('c' if hb <= 3.1 else 'd')
    if lam <= 0.4 or MoverMcr <= 0.16: return 1.0
    a = IMP[curve]
    phi = 0.5 * (1 + a * (lam - 0.4) + 0.75 * lam ** 2)
    chi = min(1.0, 1 / lam ** 2, 1 / (phi + math.sqrt(phi ** 2 - 0.75 * lam ** 2)))
    f = min(1.0, 1 - 0.5 * (1 - kc) * (1 - 2 * (lam - 0.8) ** 2))
    return min(1.0, 1 / lam ** 2, chi / f)

def mcr0(s, L):
    return math.pi / L * math.sqrt(E * s['Iz'] * G * s['It'] * (1 + math.pi ** 2 * E * s['Iw'] / (L ** 2 * G * s['It'])))

if __name__ == '__main__':
    import numpy as np
    random.seed(7)
    secs = load_sections()
    cases = []
    # 1) random cross-section checks
    for _ in range(400):
        name, v = random.choice(secs)
        s = sec_of(name, v)
        grade = random.choice(['S275', 'S355', 'S460'])
        fy = fy_of(grade, max(s['tf'], s['tw']))
        if fy is None: continue
        Npl = s['A'] * fy
        N = random.choice([0, 0, random.uniform(-0.6, 0.9) * Npl])
        My = random.uniform(-1, 1) * s['Wply'] * fy * random.choice([0.3, 0.8, 1.1])
        Mz = random.choice([0, 0, random.uniform(-0.5, 0.5) * s['Wplz'] * fy])
        V = random.uniform(-1, 1) * shear_res(s, fy) * random.choice([0.2, 0.6, 0.9])
        r = section_util(s, fy, N, My, V, Mz)
        cases.append(dict(kind='section', name=name, grade=grade, N=N, My=My, V=V, Mz=Mz, exp=r))
    # 2) flexural buckling chi for random lengths
    for _ in range(100):
        name, v = random.choice(secs)
        s = sec_of(name, v)
        grade = random.choice(['S275', 'S355', 'S460'])
        fy = fy_of(grade, s['tf'])
        if fy is None: continue
        Lcr = random.uniform(1000, 12000)
        A = aeff(s, fy)
        cy, cz = curves(s, grade)
        ly = math.sqrt(A * fy / (math.pi ** 2 * E * s['Iy'] / Lcr ** 2))
        lz = math.sqrt(A * fy / (math.pi ** 2 * E * s['Iz'] / Lcr ** 2))
        cases.append(dict(kind='flex', name=name, grade=grade, Lcr=Lcr, exp=dict(chiy=chi_flex(ly, cy), chiz=chi_flex(lz, cz), A=A)))
    # 3) LTB between forks, linear moment psi, loads at shear centre; C1 from Galerkin
    for _ in range(40):
        name, v = random.choice(secs)
        s = sec_of(name, v)
        grade = random.choice(['S275', 'S355'])
        fy = fy_of(grade, s['tf'])
        L = random.uniform(1500, 9000)
        psi = random.choice([1, 0.5, 0, -0.5, -1])
        Mu = mcr0(s, L)
        lam_shape = galerkin(L, E * s['Iz'], G * s['It'], E * s['Iw'], lambda x, p=psi, LL=L: 1 + (p - 1) * x / LL, N=24)
        C1 = lam_shape / Mu
        Mcr = lam_shape  # for Mmax = 1 N mm
        kc = min(1.0, 1 / math.sqrt(C1)) if C1 > 1 else 1.0
        Wy = s['Wply']  # all UKB/UKC are class 1/2 in pure bending up to S355
        lam = math.sqrt(Wy * fy / Mcr)
        chi = chi_lt(lam, 1.0, s, kc)  # MEd/Mcr test uses MEd = Mb level -> assume not ignorable
        cases.append(dict(kind='ltb', name=name, grade=grade, L=L, psi=psi, exp=dict(C1=C1, Mcr=Mcr, lam=lam, chi=chi, Mb=chi * Wy * fy)))
    import pathlib
    out = pathlib.Path(__file__).resolve().parent.parent / "ref_cases.json"
    out.write_text(json.dumps(cases).replace("Infinity", "1e999"))
    print(len(cases), 'reference cases written')
