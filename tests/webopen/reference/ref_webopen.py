"""Independent reference for the web openings engine, written to ../ref_webopen.json.
The steel section is modelled by fibres of the true shape (plates plus circular root fillets); Tee plastic moments with axial
force are found by bisection on the fibre force balance; net and composite sections by fibre integration; deflections by the
unit-load (virtual work) method with scipy quad over each segment plus the Vierendeel sway at each opening.
Formulae: P355 (Tee shear area, rho, (14), effective lengths), AD 418 / AD 419 (web-post), EN 1993-1-13 Tee check (NSC 05/2024).
"""
import json, math, pathlib, re, importlib.util
from scipy.integrate import quad
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('rc', ROOT / 'tests/composite/reference/ref_composite.py')
E, G = 210000.0, 81000.0
html = (ROOT / 'Beam Web Openings.html').read_text()
rows = {}
for m in re.finditer(r"\['([^']+)',([^\]]+)\]", html):
    try: rows[m.group(1)] = [float(x) for x in m.group(2).split(',')]
    except ValueError: pass

def section(name):
    mass, h, b, tw, tf, r, A, Iy = rows[name][:8]
    return dict(name=name, mass=mass, h=h, b=b, tw=tw, tf=tf, r=r, A=A * 100, Iy=Iy * 1e4)

def width(s, y):
    h, b, tw, tf, r = s['h'], s['b'], s['tw'], s['tf'], s['r']
    if y < 0 or y > h: return 0.0
    if y <= tf or y >= h - tf: return b
    d = min(y - tf, h - tf - y); w = tw
    if d < r: w += 2 * (r - math.sqrt(r * r - (r - d) ** 2))
    return w

class Fib:
    """fibres between z0 and z1 (z down from the top of the steel); stem fibres (below / above the flanges) scaled by f"""
    def __init__(s_, sec, z0, z1, f=1.0, n=6000):
        dz = (z1 - z0) / n; s_.z = []; s_.a = []
        for i in range(n):
            z = z0 + (i + 0.5) * dz; w = width(sec, z)
            if sec['tf'] < z < sec['h'] - sec['tf']: w *= f
            s_.z.append(z); s_.a.append(w * dz)
        s_.A = sum(s_.a); s_.zc = sum(a * z for a, z in zip(s_.a, s_.z)) / s_.A
        s_.I = sum(a * (z - s_.zc) ** 2 for a, z in zip(s_.a, s_.z))
        s_.top = z0; s_.bot = z1
    def merge(s_, o):
        m = Fib.__new__(Fib); m.z = s_.z + o.z; m.a = s_.a + o.a; m.A = sum(m.a); m.zc = sum(a * z for a, z in zip(m.a, m.z)) / m.A
        m.I = sum(a * (z - m.zc) ** 2 for a, z in zip(m.a, m.z)); m.top = min(s_.top, o.top); m.bot = max(s_.bot, o.bot); return m

def mn_plastic(F, fy, N):
    """sagging and hogging plastic moments about the centroid with axial force N (compression +), by bisection on the PNA"""
    out = []
    for sgn in (1, -1):
        lo, hi = F.top, F.bot
        def force(zp):   # compression +: sgn=1 -> compression above zp
            return sum(a * fy * (sgn if z < zp else -sgn) for a, z in zip(F.a, F.z))
        for _ in range(60):
            m = (lo + hi) / 2
            if (force(m) - N) * sgn < 0: lo = m
            else: hi = m
        zp = (lo + hi) / 2
        M = sum(a * fy * (sgn if z < zp else -sgn) * (F.zc - z) for a, z in zip(F.a, F.z))
        out.append(abs(M))
    return out

def mn_elastic(F, fy, N):
    sN = N / F.A; dt = F.zc - F.top; db = F.bot - F.zc
    return [max(0, min((fy - sN) * F.I / dt, (fy + sN) * F.I / db)), max(0, min((fy + sN) * F.I / dt, (fy - sN) * F.I / db))]

def cls_tee(s, depth, fy):
    eps = math.sqrt(235 / fy)
    c = lambda v: 1 if v <= 9 * eps else 2 if v <= 10 * eps else 3 if v <= 14 * eps else 4
    return max(c(max(0, depth - s['tf'] - s['r']) / s['tw']), c((s['b'] - s['tw'] - 2 * s['r']) / 2 / s['tf']))

def chi(lam, a):
    if lam <= 0.2: return 1.0
    phi = 0.5 * (1 + a * (lam - 0.2) + lam * lam); return min(1.0, 1 / (phi + math.sqrt(phi * phi - lam * lam)))

def beam_fns(L, w, P):
    RA = w * L / 2 + sum(F * (L - x) / L for x, F in P)
    V = lambda x: RA - w * x - sum(F for a, F in P if a < x)
    M = lambda x: RA * x - w * x * x / 2 - sum(F * (x - a) for a, F in P if a < x)
    return M, V

def model(s, fy, o):
    zc = s['h'] / 2 - o.get('e0', 0); lo = o['h0'] if o['shape'] == 'circ' else o['lo']
    hv = o['h0'] if o['shape'] == 'rect' else 0.9 * o['h0']
    e = 0.45 * o['h0'] if o['shape'] == 'circ' else (lo - 0.55 * o['h0'] if o['shape'] == 'elong' else lo)
    a, b = zc - o['h0'] / 2, zc + o['h0'] / 2; av, bv = zc - hv / 2, zc + hv / 2
    T = dict(top=(0, a), bot=(b, s['h']), vtop=(0, av), vbot=(bv, s['h']))
    def Av(F, depth): return min(F.A, max((depth - s['tf'] - s['r']) * s['tw'], F.A - s['b'] * s['tf'] + (s['tw'] + 2 * s['r']) * s['tf'] / 2))
    tt = {k: Fib(s, *v) for k, v in T.items()}
    av_ = {k: Av(tt[k], v[1] - v[0]) for k, v in T.items()}
    return dict(o=o, lo=lo, hv=hv, e=e, zc=zc, a=a, b=b, av=av, bv=bv, T=T, tt=tt, Av=av_, x1=o['x'] - lo / 2, x2=o['x'] + lo / 2,
                heff=tt['vbot'].zc - tt['vtop'].zc)

def tee_res(s, fy, rng, N, rho, which):
    depth = rng[1] - rng[0]; c = cls_tee(s, depth, fy)
    if c == 4:
        keep = s['tf'] + s['r'] + 14 * math.sqrt(235 / fy) * s['tw']
        rng = (rng[0], rng[0] + keep) if which == 'top' else (rng[1] - keep, rng[1])
    F = Fib(s, *rng, f=1 - rho)
    return (mn_plastic(F, fy, N) if c <= 2 else mn_elastic(F, fy, N)), c

def openings_stage(s, fy, L, M, V, Msls, Vsls, wULS, ops, comp=None, construction=False):
    out = []; mods = [model(s, fy, o) for o in ops]; mods.sort(key=lambda m: m['o']['x'])
    VplG = (s['A'] - 2 * s['b'] * s['tf'] + (s['tw'] + 2 * s['r']) * s['tf']) * fy / math.sqrt(3)
    for m in mods:
        xs = [m['x1'] + (m['x2'] - m['x1']) * i / 400 for i in range(401)]
        MEd = max(abs(M(x)) for x in xs); VEd = max(abs(V(x)) for x in xs)
        VplO = (m['Av']['top'] + m['Av']['bot']) * fy / math.sqrt(3); VplV = (m['Av']['vtop'] + m['Av']['vbot']) * fy / math.sqrt(3)
        rho = min(1, (2 * VEd / VplO - 1) ** 2) if VEd > 0.5 * VplO else 0; rhoV = min(1, (2 * VEd / VplV - 1) ** 2) if VEd > 0.5 * VplV else 0
        cO = max(cls_tee(s, m['a'], fy), cls_tee(s, s['h'] - m['b'], fy))
        net = Fib(s, 0, m['a'], f=1 - rho).merge(Fib(s, m['b'], s['h'], f=1 - rho))
        def MoRd(x):
            if comp:
                return comp_plastic(net, fy, comp, x, L)
            if cO <= 2: return mn_plastic(net, fy, 0)[0]
            return fy * net.I / max(net.zc - net.top, net.bot - net.zc)
        uM = max(abs(M(x)) / MoRd(x) for x in (m['x1'], m['o']['x'], m['x2']))
        if comp:
            dc = m['tt']['vtop'].zc + comp['hs'] - 0.5 * comp['hc']
            xLow = m['x1'] if abs(M(m['x1'])) <= abs(M(m['x2'])) else m['x2']
            Nc = min(NcAt(comp, xLow, L), MEd / (m['heff'] + dc)); Nb = (MEd - Nc * dc) / m['heff']; Nt = Nb - Nc
        else: Nb = Nt = MEd / m['heff']
        (tp, tn), _ = tee_res(s, fy, m['T']['vtop'], Nt, rhoV, 'top'); (bp, bn), _ = tee_res(s, fy, m['T']['vbot'], -Nb, rhoV, 'bot')
        r = dict(x=m['o']['x'], MEd=MEd, VEd=VEd, VplO=VplO, rho=rho, uM=uM, Nt=Nt, Nb=Nb, MvRd=tp + tn + bp + bn, uV=VEd / VplO, uVi=VEd * m['e'] / (tp + tn + bp + bn), heff=m['heff'])
        if not comp and m['o']['shape'] != 'circ':
            t = m['tt']['top']; i = math.sqrt(t.I / t.A); lam = 0.5 * m['lo'] / i / (math.pi * math.sqrt(E / fy)); NbRd = chi(lam, 0.49) * t.A * fy
            w = abs(Vsls(m['o']['x'])) * m['e'] ** 3 / (12 * E * (m['tt']['vtop'].I + m['tt']['vbot'].I))
            (mp, mn), _ = tee_res(s, fy, m['T']['top'], 0, 0, 'top')
            Vt = abs(V(m['o']['x'])) * m['Av']['vtop'] / (m['Av']['vtop'] + m['Av']['vbot'])
            r['uTb'] = Nt / NbRd + (0.4 * (Vt * m['e'] / 2 + Nt * w) + wULS * m['lo'] ** 2 / 12) / min(mp, mn)
        if not construction and m['o']['shape'] != 'circ':
            Vs = abs(Vsls(m['o']['x'])); r['dV'] = Vs * m['e'] ** 3 / (12 * E * (m['tt']['vtop'].I + m['tt']['vbot'].I)) + Vs * m['e'] / (G * (m['Av']['vtop'] + m['Av']['vbot']))
        out.append(r)
    posts = []
    for a, b in zip(mods, mods[1:]):
        s0 = b['x1'] - a['x2']; sc = b['o']['x'] - a['o']['x']
        if s0 > 5 * max(a['lo'], b['lo']): continue
        rect = 'rect' in (a['o']['shape'], b['o']['shape']); h1, h2 = max(a['o']['h0'], b['o']['h0']), min(a['o']['h0'], b['o']['h0'])
        h0e = max(0.5 * (h1 + h2), 0.75 * h1) + abs(a['o'].get('e0', 0) - b['o'].get('e0', 0))
        lw = min(0.7 * math.hypot(h0e, s0), h0e) if rect else min(0.5 * math.hypot(h0e, s0), 0.7 * h0e)
        Vav = (abs(V(a['o']['x'])) + abs(V(b['o']['x']))) / 2; heff = (a['heff'] + b['heff']) / 2
        if comp:
            dc = (a['tt']['vtop'].zc + b['tt']['vtop'].zc) / 2 + comp['hs'] - 0.5 * comp['hc']; dN = abs(NcAt(comp, b['o']['x'], L) - NcAt(comp, a['o']['x'], L))
            Vwp = max((Vav * sc - dN * dc) / heff, Vav * sc / (heff + dc))
        else: Vwp = Vav * sc / heff
        lam = lw * math.sqrt(12) / s['tw'] / (math.pi * math.sqrt(E / fy)); x = min(chi(lam, 0.34), 1 / math.sqrt(3))
        p = dict(s0=s0, lw=lw, lam=lam, Vwp=Vwp, uV=Vwp / (s['tw'] * s0 * fy / math.sqrt(3)), uB=Vwp / (x * s['tw'] * s0 * fy))
        if rect: p['uM'] = 0.5 * (0.5 * (h1 + h2) + abs(a['o'].get('e0', 0)) + abs(b['o'].get('e0', 0))) * Vwp / (s['tw'] * s0 ** 2 * fy / 6)
        posts.append(p)
    return out, posts, mods

def NcAt(c, x, L):
    xs = min(x, L - x); n = math.floor(xs / c['pitch'] + 1e-9) * c['nr']; bo = min(c['beff'], 3 * L / 16 + xs / 4 if xs <= L / 4 else L / 4)
    return min(n * c['PRd'], 0.85 * c['fcd'] * bo * c['hc'])

def comp_plastic(net, fy, c, x, L):
    xs = min(x, L - x); bo = min(c['beff'], 3 * L / 16 + xs / 4 if xs <= L / 4 else L / 4)
    Npl = net.A * fy; fc = 0.85 * c['fcd']; Nc = min(fc * bo * c['hc'], NcAt(c, x, L), Npl); xc = Nc / (fc * bo)
    # steel PNA: compression above zp; balance Nc + C = T
    lo, hi = net.top, net.bot
    f = lambda zp: Nc + sum(a * fy for a, z in zip(net.a, net.z) if z < zp) - sum(a * fy for a, z in zip(net.a, net.z) if z >= zp)
    for _ in range(60):
        m = (lo + hi) / 2
        if f(m) < 0: lo = m
        else: hi = m
    zp = (lo + hi) / 2
    return sum(a * fy * (c['hs'] + z) * (1 if z >= zp else -1) for a, z in zip(net.a, net.z)) - Nc * xc / 2

def vw_defl(L, M, EIfun, breaks, slips):
    """mid-span deflection by virtual work: integral of M m / EI plus the sways times the unit-load shear"""
    m = lambda x: x / 2 if x <= L / 2 else (L - x) / 2
    pts = sorted(set([0, L / 2, L] + [b for b in breaks if 0 < b < L]))
    d = sum(quad(lambda x: M(x) * m(x) / EIfun(x), a, b, limit=200, epsabs=1e-12)[0] for a, b in zip(pts, pts[1:]))
    return d + sum(sl * 0.5 for sl in slips)

def defl_parts(s, fy, mods, M, V, Ig, Inet, L):
    EIfun = lambda x: E * next((Inet[j] for j, mm in enumerate(mods) if mm['o']['x'] - mm['e'] / 2 <= x <= mm['o']['x'] + mm['e'] / 2), Ig)
    br = [v for mm in mods for v in (mm['o']['x'] - mm['e'] / 2, mm['o']['x'] + mm['e'] / 2)]
    sl = [abs(V(mm['o']['x'])) * (mm['e'] ** 3 / (12 * E * (mm['tt']['vtop'].I + mm['tt']['vbot'].I)) + mm['e'] / (G * (mm['Av']['vtop'] + mm['Av']['vbot'])))
          * (1 if mm['o']['x'] < L / 2 else 1) for mm in mods]
    return vw_defl(L, M, EIfun, br, sl), vw_defl(L, M, lambda x: E * Ig, [], [])

out = {}
# ---- 1 NSC 05/2024 worked example (welded, r = 0): published intermediate values ----
nsc = dict(h=650, b=220, tw=10, tf=20, r=0, A=2 * 220 * 20 + 610 * 10, Iy=0, mass=0, name='welded 650')
m = model(nsc, 345, dict(shape='rect', x=5000, h0=450, lo=1000, e0=0)); t = m['tt']['top']
mp = mn_plastic(t, 345, 0)
out['nsc'] = dict(AT=t.A, ze=t.zc, NTRd=t.A * 345, MoRd=t.A * 345 * (650 - 2 * t.zc), IT=t.I, MTRd=mp[0])
# ---- 2 steel beam: UKB with circular, rectangular and elongated openings and a point load ----
s = section('457×191×67 UKB'); fy = 355; L = 9000
gk, qk, P = 10 + s['mass'] * 9.81e-3, 12, [(6500, 10e3, 15e3)]
wU = 1.35 * gk + 1.5 * qk
M, V = beam_fns(L, wU, [(x, 1.35 * g + 1.5 * q) for x, g, q in P]); Ms, Vs = beam_fns(L, gk + qk, [(x, g + q) for x, g, q in P]); Mq, Vq = beam_fns(L, qk, [(x, q) for x, g, q in P])
ops = [dict(shape='circ', x=1600, h0=250, e0=0), dict(shape='circ', x=2200, h0=250, e0=0), dict(shape='rect', x=3400, h0=220, lo=450, e0=0), dict(shape='elong', x=7600, h0=200, lo=500, e0=20)]
res, posts, mods = openings_stage(s, fy, L, M, V, Ms, Vs, wU, ops)
Inet = [(Fib(s, 0, mm['av']).merge(Fib(s, mm['bv'], s['h']))).I for mm in mods]
dT, dTg = defl_parts(s, fy, mods, Ms, Vs, s['Iy'], Inet, L); dQ, dQg = defl_parts(s, fy, mods, Mq, Vq, s['Iy'], Inet, L)
out['steel'] = dict(input=dict(section=s['name'], L=L, gk=10, qk=12, points=[dict(x=6500, G=10, Q=15)], ops=ops), res=res, posts=posts, dTmid=dT, dQmid=dQ, dTgross=dTg)
# ---- 3 composite beam (perp_single of the composite reference) with openings, final and construction stages ----
rc = importlib.util.module_from_spec(spec); spec.loader.exec_module(rc)
ci = json.loads((ROOT / 'tests/composite/ref_composite.json').read_text())['perp_single']['input']; cr = rc.case(ci)
S = ci['slab']; hc = S['hs'] - S['hp']
comp = dict(hs=S['hs'], hc=hc, fcd=S['fck'] / 1.5, PRd=cr['PRd'], pitch=S['rib'] * ci['studs']['every'], nr=ci['studs']['nr'], beff=cr['beff'])
wid = (ci['bL'] + ci['bR']) / 2 * 1e-3; gB = s['mass'] * 9.81e-3
wG = (S['sw'] + ci['loads']['sdl']) * wid + gB; wQ = (ci['loads']['q'] + ci['loads']['qPart']) * wid; wU = 1.35 * wG + 1.5 * wQ
M, V = beam_fns(L, wU, []); Ms, Vs = beam_fns(L, wG + wQ, [])
ops = [dict(shape='circ', x=1500, h0=300, e0=0), dict(shape='circ', x=2000, h0=300, e0=0), dict(shape='rect', x=3600, h0=250, lo=500, e0=0)]
resC, postsC, modsC = openings_stage(s, fy, L, M, V, Ms, Vs, wU, ops, comp=comp)
wc = S['sw'] * wid + gB; wcU = 1.35 * wc + 1.5 * ci['loads']['gConst'] * wid
Mc, Vc = beam_fns(L, wcU, []); Mcs, Vcs = beam_fns(L, wc + ci['loads']['gConst'] * wid, [])
resK, postsK, _ = openings_stage(s, fy, L, Mc, Vc, Mcs, Vcs, wcU, ops, construction=True)
# additional mid-span deflections per stage (steel Tees for the sway, transformed composite net sections for stiffness)
Ecm = rc.ECM[S['fck']]
def Icomp(F, n):
    Ac = cr['beff'] * hc / n; zcC = -S['hs'] + hc / 2; A = Ac + F.A; z = (Ac * zcC + F.A * F.zc) / A
    return F.I + F.A * (F.zc - z) ** 2 + cr['beff'] * hc ** 3 / (12 * n) + Ac * (z - zcC) ** 2
full = Fib(s, 0, s['h']); nets = [Fib(s, 0, mm['av']).merge(Fib(s, mm['bv'], s['h'])) for mm in modsC]
def add(w, Ig, In):
    Mw, Vw = beam_fns(L, w, []); a, b = defl_parts(s, fy, modsC, Mw, Vw, Ig, In, L); return a - b
n0 = 210000 / Ecm; nL = n0 * 3.2
aWet = add(wc, s['Iy'], [F.I for F in nets]); aSDL = add(ci['loads']['sdl'] * wid, Icomp(full, nL), [Icomp(F, nL) for F in nets]); aQ = add(wQ, Icomp(full, n0), [Icomp(F, n0) for F in nets])
out['comp'] = dict(input=dict(ops=ops), res=resC, posts=postsC, cons=resK, consPosts=postsK, add=dict(aWet=aWet, aSDL=aSDL, aQ=aQ))
(HERE.parent / 'ref_webopen.json').write_text(json.dumps(out, indent=1))
print('nsc', {k: round(v, 2) for k, v in out['nsc'].items()})
for r in res: print('steel', {k: round(v, 4) for k, v in r.items()})
for p in posts: print('post', {k: round(v, 4) for k, v in p.items()})
print('defl', dT, dQ, dTg)
for r in resC: print('comp', {k: round(v, 4) for k, v in r.items()})
for p in postsC: print('cpost', {k: round(v, 4) for k, v in p.items()})
print('add', out['comp']['add'])
