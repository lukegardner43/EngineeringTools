"""Independent reference for the RC Section Design Toolkit (tests/rc-section/ref_rc_section.json).
Written separately from the JavaScript engine, from BS EN 1992-1-1 + UK NA:
- flanged sections with the stress block in the web: required steel by integrating the rectangular block over the
  section on a fine grid (no closed-form T split), x found by bisection;
- resistance of a given arrangement: strain compatibility with the block integrated numerically, layers at any depth;
- torsion (6.3.2), calculated crack width (7.3.4), anchorage and laps (8.4, 8.7) from the clause formulas.
The TCC11 comparison (ref_tcc11.json) covers rectangular beams, slabs, shear and flanged beams with the block in the flange."""
import json, math, random, pathlib
HERE = pathlib.Path(__file__).resolve().parent
rnd = random.Random(7)
def conc(fck):
    fctm = 0.30 * fck ** (2 / 3) if fck <= 50 else 2.12 * math.log(1 + (fck + 8) / 10)
    return dict(fck=fck, fcd=0.85 * fck / 1.5, fctm=fctm, Ecm=22000 * ((fck + 8) / 10) ** 0.3, fctd=0.7 * fctm / 1.5, fv=min(fck, 50))
def width_at(y, b, bw, hf): return b if y < hf else bw
def block_force_moment(x, b, bw, hf, d, fcd, n=4000):
    s = 0.8 * x; dy = s / n; F = M = 0.0
    for i in range(n):
        y = (i + 0.5) * dy; w = width_at(y, b, bw, hf); F += fcd * w * dy; M += fcd * w * dy * (d - y)
    return F, M
def flanged_As(M, b, bw, hf, d, fck):
    c = conc(fck); lo, hi = 0.0, d
    for _ in range(60):
        x = (lo + hi) / 2; F, Mx = block_force_moment(x, b, bw, hf, d, c['fcd'], 800)
        if Mx < M: lo = x
        else: hi = x
    x = (lo + hi) / 2; F, Mx = block_force_moment(x, b, bw, hf, d, c['fcd'])
    z = min(Mx / F, 0.95 * d); return dict(x=x, As=M / (500 / 1.15 * z), z=z)
def resistance(b, bw, hf, h, layers, fck):
    c = conc(fck); fyd = 500 / 1.15; a = c['fcd']
    def sig(x, d): e = 0.0035 * (x - d) / x; return max(-fyd, min(fyd, 200000 * e))
    def force(x):
        F, _ = block_force_moment(x, b, bw, hf, h, a, 400)
        return F + sum(A * (sig(x, d) - (a if 0.8 * x > d else 0)) for A, d in layers)
    lo, hi = 1e-6, 2 * h
    for _ in range(80):
        x = (lo + hi) / 2
        if force(x) > 0: hi = x
        else: lo = x
    x = (lo + hi) / 2; s = 0.8 * x; n = 4000; dy = s / n; Mt = 0.0
    for i in range(n):
        y = (i + 0.5) * dy; Mt += -a * width_at(y, b, bw, hf) * dy * y
    for A, d in layers: Mt += -A * (sig(x, d) - (a if s > d else 0)) * d
    return dict(x=x, MRd=Mt)
def torsion(b, h, cEdge, fck, TEd, cot):
    c = conc(fck); tef = max(b * h / (2 * (b + h)), 2 * cEdge); Ak = (b - tef) * (h - tef); uk = 2 * (b - tef + h - tef)
    nu = 0.6 * (1 - c['fv'] / 250); th = math.atan(1 / cot)
    return dict(tef=tef, Ak=Ak, uk=uk, TRdc=2 * Ak * tef * c['fctd'], TRdmax=2 * nu * c['fv'] / 1.5 * Ak * tef * math.sin(th) * math.cos(th),
                AswS1=TEd / (2 * Ak * 500 / 1.15 * cot), Asl=TEd * uk * cot / (2 * Ak * 500 / 1.15))
def crack(b, h, cover, phi, n, M, fck, ae, kt):
    c = conc(fck); As = n * math.pi * phi ** 2 / 4; d = h - cover - phi / 2
    x = (-ae * As + math.sqrt((ae * As) ** 2 + 2 * b * ae * As * d)) / b
    I = b * x ** 3 / 3 + ae * As * (d - x) ** 2; ss = ae * M * (d - x) / I
    hc = min(2.5 * (h - d), (h - x) / 3, h / 2); rho = As / (b * hc); aeS = 200000 / c['Ecm']
    de = max((ss - kt * c['fctm'] / rho * (1 + aeS * rho)) / 200000, 0.6 * ss / 200000)
    sp = (b - 2 * cover - phi) / (n - 1)
    sr = 3.4 * cover + 0.8 * 0.5 * 0.425 * phi / rho if sp <= 5 * (cover + phi / 2) else 1.3 * (h - x)
    return dict(x=x, ss=ss, hc=hc, rho=rho, de=de, sr=sr, wk=sr * de)
def anchor(phi, fck, good, cd, lapped):
    c = conc(fck); fbd = 2.25 * (1 if good else 0.7) * (1 if phi <= 32 else (132 - phi) / 100) * c['fctd']
    lb = phi / 4 * (500 / 1.15) / fbd; a2 = min(1, max(0.7, 1 - 0.15 * (cd - phi) / phi))
    lbd = max(a2 * lb, max(0.3 * lb, 10 * phi, 100)); a6 = min(1.5, max(1, math.sqrt(lapped / 25)))
    l0 = max(a2 * a6 * lb, max(0.3 * a6 * lb, 15 * phi, 200)); return dict(fbd=fbd, lbrqd=lb, lbd=lbd, l0=l0, a2=a2, a6=a6)
out = dict(flanged=[], resist=[], torsion=[], crack=[], anchor=[])
while len(out['flanged']) < 12:   # block in the web, neutral axis inside the x/d = 0.45 limit (singly reinforced)
    bw = rnd.choice([250, 300, 350]); b = bw + rnd.choice([400, 700, 1000]); hf = rnd.choice([100, 125, 150]); h = rnd.choice([450, 550, 650]); d = h - 50; fck = rnd.choice([25, 30, 32, 40])
    fcd = 0.85 * fck / 1.5; Mf = fcd * b * hf * (d - hf / 2); Mlim = block_force_moment(0.45 * d, b, bw, hf, d, fcd)[1]
    if Mlim < 1.03 * Mf: continue
    M = rnd.uniform(1.01 * Mf, 0.99 * Mlim)
    out['flanged'].append(dict(b=b, bw=bw, hf=hf, h=h, d=d, fck=fck, M=M, **flanged_As(M, b, bw, hf, d, fck)))
for _ in range(12):
    bw = rnd.choice([250, 300]); fl = rnd.random() < 0.5; b = bw + (600 if fl else 0); hf = 120 if fl else 0; h = rnd.choice([450, 600]); fck = rnd.choice([25, 32, 40])
    layers = [(rnd.choice([3, 4, 5]) * math.pi * 25 ** 2 / 4, h - 50), (2 * math.pi * 16 ** 2 / 4, 45)] + ([(2 * math.pi * 20 ** 2 / 4, h - 95)] if rnd.random() < 0.5 else [])
    out['resist'].append(dict(b=b, bw=bw, hf=hf if fl else 0, h=h, fck=fck, layers=layers, **resistance(b, bw, hf if fl else h, h, layers, fck)))
for _ in range(10):
    b = rnd.choice([250, 300, 400]); h = rnd.choice([400, 500, 700]); cE = rnd.choice([45, 50, 55]); fck = rnd.choice([25, 30, 40]); T = rnd.uniform(10, 60) * 1e6; cot = rnd.choice([1.0, 1.5, 2.0, 2.5])
    out['torsion'].append(dict(b=b, h=h, cEdge=cE, fck=fck, TEd=T, cot=cot, **torsion(b, h, cE, fck, T, cot)))
for _ in range(12):
    b = rnd.choice([250, 300, 400]); h = rnd.choice([450, 600, 750]); cover = rnd.choice([30, 40, 50]); phi = rnd.choice([16, 20, 25, 32]); n = rnd.choice([2, 3, 4, 6]); fck = rnd.choice([25, 30, 40])
    M = rnd.uniform(40, 220) * 1e6; ae = rnd.choice([7, 10, 15]); kt = rnd.choice([0.4, 0.6])
    out['crack'].append(dict(b=b, h=h, cover=cover, phi=phi, n=n, M=M, fck=fck, ae=ae, kt=kt, **crack(b, h, cover, phi, n, M, fck, ae, kt)))
for phi in (10, 16, 25, 40):
    for good in (True, False):
        out['anchor'].append(dict(phi=phi, fck=30, good=good, cd=40, lapped=50, **anchor(phi, 30, good, 40, 50)))
(HERE.parent / 'ref_rc_section.json').write_text(json.dumps(out))
print({k: len(v) for k, v in out.items()})
