"""Independent reference for the Steel Column and Base Plate Design engine, written to ../ref_column_base.json.
Re-implements from BS EN 1990 + UK NA, BS EN 1993-1-1 + UK NA and BS EN 1993-1-8:
- the ULS combination set (6.10 or 6.10a/b; G favourable only with a variable action; wind leading or accompanying, both ways);
- the design actions: axial load plus beam reactions, nominal moments at 100 mm from the face, end moments, UDL, base shear;
- flexural and torsional buckling resistances (6.3.1.2, Table 6.2, 6.3.1.4) from the section table;
- M_b,Rd under uniform moment by the closed-form M_cr (C1 = 1, forks) and the UK NA rolled-section rule (6.3.2.3);
- the SN048b terms N/N_b,min,Rd and 1.5 M_z/M_cb,z,Rd;
- the base plate effective area and N_j,Rd (6.2.5) by the T-stub rule.
Section data are read from the section table shipped with the pages (sections/sections.js inside the HTML)."""
import json, math, pathlib, re, itertools
HERE = pathlib.Path(__file__).resolve().parent
html = (HERE.parents[2] / 'Steel Column and Base Plate Design.html').read_text()
block = re.search(r'<script id="sections">([\s\S]*?)</script>', html).group(1)
rows = re.search(r'const SECTION_DATA=(\[[\s\S]*?\]);', block).group(1)
DATA = {r[0]: r for r in json.loads(rows.replace("'", '"'))}
E, G = 210000.0, 81000.0
ALPHA = {'a0': 0.13, 'a': 0.21, 'b': 0.34, 'c': 0.49, 'd': 0.76}

def sec(name):
    r = DATA[name]
    return dict(name=name, mass=r[1], h=r[2], b=r[3], tw=r[4], tf=r[5], r=r[6], A=r[7] * 1e2, Iy=r[8] * 1e4, Iz=r[9] * 1e4,
                Wely=r[10] * 1e3, Welz=r[11] * 1e3, Wply=r[12] * 1e3, Wplz=r[13] * 1e3, It=r[14] * 1e4, Iw=r[15] * 1e12)

def fy_of(grade, t):   # BS EN 10025-2 nominal values by thickness
    base = {'S275': [(16, 275), (40, 265), (63, 255)], 'S355': [(16, 355), (40, 345), (63, 335)]}[grade]
    return next(f for lim, f in base if t <= lim)

def chi(lam, curve):
    if lam <= 0.2: return 1.0
    a = ALPHA[curve]; phi = 0.5 * (1 + a * (lam - 0.2) + lam * lam)
    return min(1.0, 1 / (phi + math.sqrt(phi * phi - lam * lam)))

def buckling(s, grade, L, ky, kz, LT):
    fy = fy_of(grade, max(s['tf'], s['tw'])); NRk = s['A'] * fy
    hb, tf = s['h'] / s['b'], s['tf']
    cy, cz = (('a', 'b') if tf <= 40 else ('b', 'c')) if hb > 1.2 else (('b', 'c') if tf <= 100 else ('d', 'd'))
    Ncry, Ncrz = math.pi ** 2 * E * s['Iy'] / (ky * L) ** 2, math.pi ** 2 * E * s['Iz'] / (kz * L) ** 2
    i02 = (s['Iy'] + s['Iz']) / s['A']; NcrT = (G * s['It'] + math.pi ** 2 * E * s['Iw'] / LT ** 2) / i02
    ly, lz, lT = math.sqrt(NRk / Ncry), math.sqrt(NRk / Ncrz), math.sqrt(NRk / NcrT)
    xy, xz, xT = chi(ly, cy), chi(lz, cz), chi(lT, cz)
    return dict(fy=fy, NRk=NRk, curves=[cy, cz], Ncry=Ncry, Ncrz=Ncrz, NcrT=NcrT, lamY=ly, lamZ=lz, lamT=lT, chiY=xy, chiZ=xz, chiT=xT,
                NbRd=min(xy, xz, xT) * NRk, NbMin=min(xy, xz) * NRk, NbY=xy * NRk)

def mb_uniform(s, grade, L, MEd):
    fy = fy_of(grade, max(s['tf'], s['tw']))
    Mcr = math.pi ** 2 * E * s['Iz'] / L ** 2 * math.sqrt(s['Iw'] / s['Iz'] + L * L * G * s['It'] / (math.pi ** 2 * E * s['Iz']))
    lam = math.sqrt(s['Wply'] * fy / Mcr); hb = s['h'] / s['b']; curve = 'b' if hb <= 2 else 'c' if hb <= 3.1 else 'd'
    if lam <= 0.4 or MEd / Mcr <= 0.16: x = 1.0
    else:
        phi = 0.5 * (1 + ALPHA[curve] * (lam - 0.4) + 0.75 * lam * lam)
        x = min(1.0, 1 / lam ** 2, 1 / (phi + math.sqrt(phi * phi - 0.75 * lam * lam)))   # f = 1 for uniform moment (k_c = 1)
    return dict(Mcr=Mcr, lamLT=lam, chiLT=x, MbRd=x * s['Wply'] * fy)

def combos(rule, hasQ, hasW, psiQ=0.7, both=True):
    out = set(); psi = {'Q': psiQ, 'W': 0.5}
    for q in ([0, 1] if hasQ else [0]):
        for w in (([0, 1, -1] if both else [0, 1]) if hasW else [0]):
            pres = (['Q'] if q else []) + (['W'] if w else []); sg = {'Q': 1, 'W': w or 1}
            gsup = [1.35, 1.0] if pres else [1.35]
            for gG in gsup:
                if rule == '6.10':
                    if not pres: out.add((gG, 0, 0))
                    for lead in pres:
                        f = {a: sg[a] * (1.5 if a == lead else 1.5 * psi[a]) for a in pres}; out.add((gG, f.get('Q', 0), f.get('W', 0)))
                else:
                    f = {a: sg[a] * 1.5 * psi[a] for a in pres}; out.add((gG, f.get('Q', 0), f.get('W', 0)))
                    gb = 0.925 * 1.35 if gG == 1.35 else 1.0
                    for lead in pres:
                        f = {a: sg[a] * (1.5 if a == lead else 1.5 * psi[a]) for a in pres}; out.add((gb, f.get('Q', 0), f.get('W', 0)))
    return sorted([round(a, 6), round(b, 6), round(c, 6)] for a, b, c in out)

def actions(s, cases, f, L, share):
    ey, ez = s['h'] / 2 + 100, s['tw'] / 2 + 100
    a = dict(N=0, MyT=0, MyB=0, MzT=0, MzB=0, w=0, H=0)
    for c, fc in f.items():
        x = cases.get(c, {}); R = sum(x.get(k, 0) for k in ('Ry1', 'Ry2', 'Rz1', 'Rz2'))
        a['N'] += fc * (x.get('N', 0) + R)
        a['MyT'] += fc * (x.get('MyT', 0) + share * (x.get('Ry1', 0) - x.get('Ry2', 0)) * ey); a['MyB'] += fc * x.get('MyB', 0)
        a['MzT'] += fc * (x.get('MzT', 0) + share * (x.get('Rz1', 0) - x.get('Rz2', 0)) * ez); a['MzB'] += fc * x.get('MzB', 0)
        a['w'] += fc * x.get('w', 0); a['H'] += fc * x.get('H', 0)
    a['sw'] = f.get('G', 0) * s['mass'] * 9.81 / 1000 * L; a['Nbase'] = a['N'] + a['sw']
    a['Mmid'] = (a['MyT'] + a['MyB']) / 2 + a['w'] * L * L / 8
    a['Vbase'] = (a['MyT'] - a['MyB']) / L + a['w'] * L / 2 + a['H']; a['VbaseZ'] = (a['MzT'] - a['MzB']) / L; a['Vres'] = math.hypot(a['Vbase'], a['VbaseZ'])
    return a

def njrd(col, D, B, t, pgrade, fck, alpha):
    fyp = fy_of(pgrade, t); fcd = 0.85 * fck / 1.5; fjd = 2 / 3 * min(3, alpha) * fcd
    c = t * math.sqrt(fyp / (3 * fjd))
    ext = min(c, (D - col['h']) / 2); bf = min(col['b'] + 2 * c, B); dfl = col['tf'] + c + ext
    web = col['h'] - 2 * col['tf'] - 2 * c
    Aeff = 2 * bf * dfl + (web * min(col['tw'] + 2 * c, B) if web > 0 else 0)
    return dict(fjd=fjd, c=c, Aeff=Aeff, NjRd=Aeff * fjd)

out = {}
uc, ub = sec('254×254×73 UKC'), sec('406×178×60 UKB')
out['combos'] = {'6.10': combos('6.10', True, True), '6.10ab': combos('6.10ab', True, True), '6.10_QonlyOneWay': combos('6.10', True, True, both=False), '6.10_Gonly': combos('6.10', False, False)}
out['buckling'] = [dict(sec=n, grade=g, L=L, ky=ky, kz=kz, nLT=nLT, **buckling(sec(n), g, L, ky, kz, L / nLT))
                   for n, g, L, ky, kz, nLT in [('254×254×73 UKC', 'S355', 4500, 1.0, 1.0, 1), ('254×254×73 UKC', 'S355', 6000, 0.85, 1.0, 2), ('203×133×30 UKB', 'S275', 4000, 1.0, 0.7, 1), ('305×305×97 UKC', 'S275', 7000, 1.0, 1.0, 1)]]
out['ltb'] = [dict(sec=n, grade=g, L=L, M=M, **mb_uniform(sec(n), g, L, M * 1.35)) for n, g, L, M in [('254×254×73 UKC', 'S355', 6000, 100e6), ('406×178×60 UKB', 'S275', 5000, 120e6), ('457×191×67 UKB', 'S355', 3500, 200e6)]]
cs = {'G': dict(N=500e3, Ry1=60e3, Ry2=20e3, Rz1=10e3, Rz2=30e3, MyT=5e6, MyB=-8e6, MzT=2e6, w=1.2, H=4e3), 'Q': dict(N=300e3, Ry1=40e3, Ry2=5e3, Rz1=15e3, MyT=3e6, w=0.8), 'W': dict(H=12e3, w=1.5, N=-50e3)}
out['actions'] = dict(sec=uc['name'], L=4200, share=0.5, cases=cs, results={k: actions(uc, cs, f, 4200, 0.5) for k, f in {'U1': {'G': 1.35, 'Q': 1.5}, 'U2': {'G': 1.0, 'W': -1.5}, 'U3': {'G': 1.25, 'Q': 1.05, 'W': 1.5}}.items()})
out['base'] = njrd(uc, 450, 450, 30, 'S275', 30, 1.5)
out['sn048'] = dict(McbZ_uc_S355=uc['Wplz'] * 355, A_uc=uc['A'])
(HERE.parent / 'ref_column_base.json').write_text(json.dumps(out, indent=1, ensure_ascii=False))
print('combos', {k: len(v) for k, v in out['combos'].items()}, 'NjRd', round(out['base']['NjRd'] / 1e3, 1), 'MbRd', [round(x['MbRd'] / 1e6, 1) for x in out['ltb']])
