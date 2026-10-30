"""Independent reference for BS EN 1993-1-5 section 6 (unstiffened webs): FRd for loading types (a) and (c).
Writes ../ref_bearing.json. Clause references: 6.2 (6.1)-(6.3), 6.4 (6.5), 6.5 (6.8)-(6.13)."""
import math, json, csv, random, pathlib
E = 210000.0

def fy_of(grade, t):
    tab = {'S275': [(16, 275), (40, 265), (63, 255), (80, 245), (100, 235), (150, 225)], 'S355': [(16, 355), (40, 345), (63, 335), (80, 325), (100, 315), (150, 295)],
           'S460': [(16, 460), (40, 440), (63, 430), (80, 410), (100, 400), (120, 385)]}[grade]
    return next(f for lim, f in tab if t <= lim)

def frd(h, b, tw, tf, fy, ss, c, typ, channel=False):
    hw = h - 2 * tf; eps = math.sqrt(235 / fy)
    bf = min(b, tw + (15 if channel else 30) * eps * tf)
    kF = min(6.0, 2 + 6 * (ss + c) / hw) if typ == 'c' else 6.0
    Fcr = 0.9 * kF * E * tw ** 3 / hw
    m1 = bf / tw
    def ly_of(m2):
        la = ss + 2 * tf * (1 + math.sqrt(m1 + m2))
        if typ != 'c': return la
        le = min(kF * E * tw ** 2 / (2 * fy * hw), ss + c)
        return min(la, le + tf * math.sqrt(m1 / 2 + (le / tf) ** 2 + m2), le + tf * math.sqrt(m1 + m2))
    ly = ly_of(0.02 * (hw / tf) ** 2); lam = math.sqrt(ly * tw * fy / Fcr)
    if lam <= 0.5:
        ly = ly_of(0.0); lam = math.sqrt(ly * tw * fy / Fcr)
    chi = min(1.0, 0.5 / lam)
    return chi * ly * tw * fy

if __name__ == '__main__':
    random.seed(5)
    here = pathlib.Path(__file__).resolve().parent
    rows = [('I', r) for r in csv.DictReader(open(here / 'ukb.csv'))] + [('I', r) for r in csv.DictReader(open(here / 'ukc.csv'))] + [('PFC', r) for r in csv.DictReader(open(here / 'pfc.csv'))]
    cases = []
    for k in range(150):
        kind, r = random.choice(rows)
        f = {q: float(v) for q, v in r.items() if q != 'desig'}
        grade = random.choice(['S275', 'S355', 'S460']); fy = fy_of(grade, max(f['tw'], f['tf']))
        ss = random.choice([0, 20, 50, 100, 150, 250]); typ = random.choice(['a', 'c']); c = random.choice([0, 0, 25, 100]) if typ == 'c' else 0
        cases.append(dict(kind=kind, desig=r['desig'], grade=grade, ss=ss, c=c, type=typ, FRd=frd(f['h'], f['b'], f['tw'], f['tf'], fy, ss, c, typ, kind == 'PFC')))
    (here.parent / 'ref_bearing.json').write_text(json.dumps(cases))
    print(len(cases), 'web bearing cases')
