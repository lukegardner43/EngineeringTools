"""Independent reference for angles, single and back to back, in axial force (written separately from the JS engine).
- Section properties: the outline of the rolled angle (legs, the root fillet r1 as a concave arc, the toe rounds r2 as
  convex arcs) as a polygon of 4000 points per arc, integrated by the shoelace formulae; principal axes by the eigenvectors
  of the inertia tensor; the shear centre at the meeting of the legs' centrelines. A pair: the two mirrored outlines.
- Classification, BS EN 1993-1-1 Table 5.2 sheet 3 (h/t ≤ 15ε, (b + h)/2t ≤ 11.5ε, else Class 4); A_eff with each leg an
  outstand in uniform compression (BS EN 1993-1-5 4.4, Table 4.2, k_σ = 0.43, c the leg).
- Tension: N_pl = A f_y; BS EN 1993-1-8 3.10.3 (one, two, three or more bolts; β by Table 3.8 interpolated; an unequal angle
  connected by its short leg as the equal angle of that leg); 4.13 welded; block tearing 3.10.2 (3.10). γ_M2 1.1 for the
  net section (UK NA to BS EN 1993-1-1), 1.25 for block tearing.
- Compression: BB.1.2 effective slenderness (v, y, z) and torsional buckling N_cr,T = G I_t/i0²; or flexural about u and v
  and torsional-flexural, the least positive root of the cubic by numpy.roots (an equal angle, v0 = 0: the quadratic of N_u
  and N_T, the cubic's other factor being flexure about v-v); a pair: flexural y, z and the torsional-
  flexural quadratic about z, curve c; a single angle curve b.
Writes ../ref_angles.json."""
import math, json, random, csv, pathlib
import numpy as np

E, G = 210000.0, 81000.0
FY = {'S235': [(16, 235), (40, 225)], 'S275': [(16, 275), (40, 265)], 'S355': [(16, 355), (40, 345)], 'S460': [(16, 460), (40, 440)]}
FU = {'S235': 360, 'S275': 410, 'S355': 470, 'S460': 540}
IMP = {'b': 0.34, 'c': 0.49}
HERE = pathlib.Path(__file__).parent

def fy_of(g, t):
    for lim, f in FY[g]:
        if t <= lim: return f

def arc(cy, cz, r, a0, a1, n=4000):
    return [(cy + r * math.cos(a0 + (a1 - a0) * k / n), cz + r * math.sin(a0 + (a1 - a0) * k / n)) for k in range(n + 1)]

def outline(h, b, t, r1, r2):
    """counter-clockwise from the heel"""
    p = [(0.0, 0.0), (b, 0.0)]
    p += arc(b - r2, t - r2, r2, 0, math.pi / 2)                     # toe of the horizontal leg
    p += arc(t + r1, t + r1, r1, -math.pi / 2, -math.pi)             # root fillet, concave (centre outside the steel)
    p += arc(t - r2, h - r2, r2, 0, math.pi / 2)                     # toe of the vertical leg
    p += [(0.0, h)]
    return p

def integ(p):
    A = Sy = Sz = Iyy = Izz = Iyz = 0.0
    n = len(p)
    for i in range(n):
        y0, z0 = p[i]; y1, z1 = p[(i + 1) % n]; c = y0 * z1 - y1 * z0
        A += c / 2; Sz += (y0 + y1) * c / 6; Sy += (z0 + z1) * c / 6
        Iyy += (z0 * z0 + z0 * z1 + z1 * z1) * c / 12; Izz += (y0 * y0 + y0 * y1 + y1 * y1) * c / 12
        Iyz += (y0 * z1 + 2 * y0 * z0 + 2 * y1 * z1 + y1 * z0) * c / 24
    return np.array([A, Sy, Sz, Iyy, Izz, Iyz])

def props(polys):
    t = sum(integ(p) for p in polys)
    A, Sy, Sz, Iyy, Izz, Iyz = t
    yc, zc = Sz / A, Sy / A
    Iy, Iz, Pyz = Iyy - A * zc * zc, Izz - A * yc * yc, Iyz - A * yc * zc
    return dict(A=A, yc=yc, zc=zc, Iy=Iy, Iz=Iz, Iyz=Pyz)

def single(h, b, t, r1, r2):
    q = props([outline(h, b, t, r1, r2)])
    # inertia tensor about the centroid for directions d: I(d) = d^T M d with M = [[Iy, -Iyz], [-Iyz, Iz]] (d = (dy, dz))
    M = np.array([[q['Iy'], -q['Iyz']], [-q['Iyz'], q['Iz']]])
    w, V = np.linalg.eigh(M)
    q['Iv'], q['Iu'] = w[0], w[1]
    du, dv = V[:, 1], V[:, 0]
    rel = np.array([t / 2 - q['yc'], t / 2 - q['zc']])
    q['u0'], q['v0'] = float(rel @ du), float(rel @ dv)
    q['tan_alpha'] = abs(du[1] / du[0]) if abs(du[0]) > 1e-12 else math.inf
    return q

def pair(h, b, t, r1, r2, s):
    p = outline(h, b, t, r1, r2)
    right = [(y + s / 2, z) for y, z in p]
    left = [(-(y + s / 2), z) for y, z in reversed(p)]
    return props([right, left])

def chi(lam, curve):
    a = IMP[curve]; phi = 0.5 * (1 + a * (lam - 0.2) + lam * lam)
    return 1.0 if lam <= 0.2 else min(1.0, 1 / (phi + math.sqrt(phi * phi - lam * lam)))

def aeff(A, h, b, t, eps, cls):
    if cls < 4: return A
    def rho(c):
        lp = c / t / (28.4 * eps * math.sqrt(0.43))
        return 1.0 if lp <= 0.748 else min(1.0, (lp - 0.188) / lp ** 2)
    return A - t * ((1 - rho(h)) * h + (1 - rho(b)) * b)

def case(row, kind, grade, N, L, rnd):
    h, b, t, r1, r2 = (float(row[k]) for k in ('h', 'b', 't', 'r1', 'r2'))
    It1 = float(row['It']) * 1e4
    fy, fu = fy_of(grade, t), FU[grade]
    if grade == 'S460': fu = 540 if t <= 40 else 530
    eps = math.sqrt(235 / fy)
    a = single(h, b, t, r1, r2)
    cls = 1 if N <= 0 else (3 if h / t <= 15 * eps and (b + h) / (2 * t) <= 11.5 * eps else 4)
    Aeff1 = aeff(a['A'], h, b, t, eps, cls)
    out = dict(name=row['name'], kind=kind, grade=grade, N=N, L=L, props=dict(A=a['A'], yc=a['yc'], zc=a['zc'], Iy=a['Iy'], Iz=a['Iz'], Iu=a['Iu'], Iv=a['Iv'], tan_alpha=a['tan_alpha'], u0abs=abs(a['u0']), v0abs=abs(a['v0'])), exp={'cls': cls})
    k = 2 if kind == 'pair' else 1
    if kind == 'pair':
        gap = rnd.choice([8, 10, 12, 15]); out['gap'] = gap
        q = pair(h, b, t, r1, r2, gap)
        out['pairProps'] = dict(A=q['A'], zc=q['zc'], Iy=q['Iy'], Iz=q['Iz'])
        pk = rnd.choice([0.5, 0.8, 1.0, 1.5]) * 15 * math.sqrt(a['Iv'] / a['A']); out['pack'] = pk
        out['exp']['packs'] = pk / (15 * math.sqrt(a['Iv'] / a['A']))
    A = k * a['A']
    if N < 0:
        conn = rnd.choice(['bolts', 'bolts', 'welded'])
        leg = 'long' if (kind == 'pair' or h == b) else rnd.choice(['long', 'short'])
        Lg = b if leg == 'short' and h != b and kind != 'pair' else h
        Aeq = single(Lg, Lg, t, r1, r2)['A'] if Lg != h else a['A']
        out['exp']['Npl'] = A * fy
        c = {'type': conn, 'leg': leg}
        if conn == 'welded':
            out['exp']['Nu'] = k * Aeq * fy
        else:
            d0 = rnd.choice([14, 18, 22]); n = rnd.choice([1, 2, 3, 4])
            e2 = min(max(1.2 * d0, Lg / 2), Lg - t - d0 / 2)
            if e2 < 1.2 * d0: return None
            e1 = math.ceil(rnd.uniform(1.2, 3) * d0); p1 = math.ceil(rnd.uniform(2.2, 6) * d0)
            c.update(n=n, d0=d0, e1=e1, e2=e2, p1=p1)
            Anet = Aeq - d0 * t
            if n == 1: Nu = 2 * (e2 - 0.5 * d0) * t * fu / 1.1
            else:
                lo = 0.4 if n == 2 else 0.5
                if p1 <= 2.5 * d0: beta = lo
                elif p1 >= 5 * d0: beta = 0.7
                else: beta = lo + (0.7 - lo) * (p1 - 2.5 * d0) / (2.5 * d0)
                Nu = beta * Anet * fu / 1.1
            out['exp']['Nu'] = k * Nu
            Anv = (e1 + (n - 1) * p1 - (n - 0.5) * d0) * t; Ant = (e2 - 0.5 * d0) * t
            out['exp']['Nbt'] = k * (0.5 * fu * Ant / 1.25 + fy * Anv / (math.sqrt(3)))
        out['conn'] = c
        utils = [-N / out['exp']['Npl'], -N / out['exp']['Nu']] + ([-N / out['exp']['Nbt']] if 'Nbt' in out['exp'] else [])
    else:
        Ae = k * Aeff1; NRk = Ae * fy
        out['exp']['Aeff'] = Ae
        if kind == 'pair':
            q = out['pairProps']; ky, kz = rnd.choice([1, 0.85, 0.7]), rnd.choice([1, 0.5])
            out['k'] = {'y': ky, 'z': kz}
            Ny = math.pi ** 2 * E * q['Iy'] / (ky * L) ** 2; Nz = math.pi ** 2 * E * q['Iz'] / (kz * L) ** 2
            z0 = q['zc'] - t / 2; i02 = (q['Iy'] + q['Iz']) / q['A'] + z0 * z0; NT = G * 2 * It1 / i02
            # (N - Nz)(N - NT) i02 - N^2 z0^2 = 0, least root
            r = np.roots([i02 - z0 * z0, -i02 * (Nz + NT), i02 * Nz * NT]); NTF = min(x.real for x in r if abs(x.imag) < 1e-6 * abs(x) and x.real > 0)
            modes = {'y': Ny, 'z': Nz, 'TF': NTF}
            Nb = {m: chi(math.sqrt(NRk / v), 'c') * NRk for m, v in modes.items()}
            out['method'] = 'Lcr'
        else:
            method = rnd.choice(['BB', 'BB', 'Lcr']); out['method'] = method
            i02 = (a['Iu'] + a['Iv']) / a['A'] + a['u0'] ** 2 + a['v0'] ** 2; NT = G * It1 / i02
            if method == 'BB':
                f = {'y': rnd.choice([1, 1, 0.8]), 'z': rnd.choice([1, 1, 0.8]), 'v': rnd.choice([1, 0.7, 0.5])}; out['k'] = f
                Nv = math.pi ** 2 * E * a['Iv'] / (f['v'] * L) ** 2; Ny = math.pi ** 2 * E * a['Iy'] / (f['y'] * L) ** 2; Nz = math.pi ** 2 * E * a['Iz'] / (f['z'] * L) ** 2
                lam = {m: math.sqrt(NRk / v) for m, v in (('v', Nv), ('y', Ny), ('z', Nz), ('T', NT))}
                Nb = {'v': chi(0.35 + 0.7 * lam['v'], 'b') * NRk, 'y': chi(0.5 + 0.7 * lam['y'], 'b') * NRk, 'z': chi(0.5 + 0.7 * lam['z'], 'b') * NRk, 'T': chi(lam['T'], 'b') * NRk}
                out['conn'] = rnd.choice([{'type': 'welded'}, {'type': 'bolts', 'n': 2}])
            else:
                f = {'u': rnd.choice([1, 0.7]), 'v': rnd.choice([1, 0.7, 0.5])}; out['k'] = f
                Nu = math.pi ** 2 * E * a['Iu'] / (f['u'] * L) ** 2; Nv = math.pi ** 2 * E * a['Iv'] / (f['v'] * L) ** 2
                u0, v0 = a['u0'], a['v0']
                # i02 (Nu - N)(Nv - N)(NT - N) - N^2 u0^2 (Nv - N) - N^2 v0^2 (Nu - N) = 0 as a cubic in N
                P = np.polymul(np.polymul([-1, Nu], [-1, Nv]), [-1, NT]) * i02
                P = np.polysub(P, np.polymul([u0 * u0, 0, 0], [-1, Nv]))
                P = np.polysub(P, np.polymul([v0 * v0, 0, 0], [-1, Nu]))
                if h == b:   # v0 = 0: the cubic factors; the torsional-flexural mode is the quadratic in N_u and N_T
                    P = np.polysub(np.polymul([-1, Nu], [-1, NT]) * i02, [u0 * u0, 0, 0])
                rts = [x.real for x in np.roots(P) if abs(x.imag) <= 1e-7 * abs(x) and x.real > 0]
                NTF = min(rts)
                Nb = {'u': chi(math.sqrt(NRk / Nu), 'b') * NRk, 'v': chi(math.sqrt(NRk / Nv), 'b') * NRk, 'TF': chi(math.sqrt(NRk / NTF), 'b') * NRk}
                out['NTF'] = NTF
        out['exp']['Nb'] = Nb
        out['exp']['NcRd'] = NRk
        utils = [N / NRk, N / min(Nb.values())]
    if 'packs' in out['exp']: utils.append(out['exp']['packs'])
    out['exp']['util'] = max(utils)
    return out

if __name__ == '__main__':
    rows = list(csv.DictReader(open(HERE / 'angles.csv')))
    for r in rows:
        nm = lambda v: str(float(v)).rstrip('0').rstrip('.')
        r['name'] = f"{nm(r['h'])}×{nm(r['b'])}×{nm(r['t'])}"
    rnd = random.Random(2026)
    cases = []
    # every row once in each role, then random mixes
    for r in rows:
        for kind in ('single', 'pair'):
            for sgn in (-1, 1):
                g = rnd.choice(['S275', 'S355', 'S355', 'S460'])
                a = single(*(float(r[k]) for k in ('h', 'b', 't', 'r1', 'r2')))
                N = sgn * rnd.uniform(0.2, 0.7) * a['A'] * 275 * (2 if kind == 'pair' else 1)
                c = case(r, kind, g, N, rnd.choice([1500, 2500, 3500, 5000]), rnd)
                if c: cases.append(c)
    (HERE.parent / 'ref_angles.json').write_text(json.dumps(cases))
    print(len(cases), 'cases')
