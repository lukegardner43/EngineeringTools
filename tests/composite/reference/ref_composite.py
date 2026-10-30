"""Independent reference for the composite beam engine, written to ../ref_composite.json.
- Plastic resistance by fibre integration of the true section shape (plates plus circular root fillets), the plastic
  neutral axis found by bisection on the force balance; concrete stress block 0.85 fck/1.5 limited by the connection.
- Studs (6.18, 6.19), decking factors (6.22, 6.23, Table 6.2), eta_min (6.6.1.2), effective width (5.4.1.2).
- Transformed second moments by summing first and second moments about the slab top; deflections 5wL^4/384EI with the
  7.3.1(4) partial-interaction factor; frequency 18/sqrt(delta).
Section properties are read from the repository's section table (dimensions and datasheet Iy, A, Wpl).
"""
import json, math, pathlib, re
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
html = (ROOT / 'Composite Beam Design.html').read_text()
rows = {}
for m in re.finditer(r"\['([^']+)',([^\]]+)\]", html):
    v = m.group(2).split(',')
    try: rows[m.group(1)] = [float(x) for x in v]
    except ValueError: pass
ECM = {25: 31000, 28: 32300, 30: 33000, 32: 33300, 35: 34000, 40: 35000}
Ea = 210000.0

def section(name):
    mass, h, b, tw, tf, r, A, Iy, Iz, Wey, Wez, Wpy, Wpz, It, Iw = rows[name][:15]
    return dict(name=name, mass=mass, h=h, b=b, tw=tw, tf=tf, r=r, A=A * 100, Iy=Iy * 1e4, Wply=Wpy * 1e3)

def fy_of(grade, t):
    tab = {'S355': [(16, 355), (40, 345), (63, 335)], 'S275': [(16, 275), (40, 265), (63, 255)]}[grade]
    for lim, f in tab:
        if t <= lim: return f

def width(s, y):
    """steel width at depth y below the top of the steel"""
    h, b, tw, tf, r = s['h'], s['b'], s['tw'], s['tf'], s['r']
    if y < 0 or y > h: return 0.0
    if y <= tf or y >= h - tf: return b
    d = min(y - tf, h - tf - y)            # distance from the nearer flange inner face
    w = tw
    if d < r: w += 2 * (r - math.sqrt(r * r - (r - d) ** 2))
    return w

def plastic(s, fy, beff, hc, hs, fcd, NcLim, n=40000):
    h = s['h']; dy = h / n
    ys = [(i + 0.5) * dy for i in range(n)]
    ws = [width(s, y) for y in ys]
    A = sum(ws) * dy
    Npl = A * fy; fc = 0.85 * fcd
    Nc = min(fc * beff * hc, NcLim, Npl); xc = Nc / (fc * beff)
    # compression in steel above y0: fy*Aabove; balance Nc + fy*Aab = fy*(A - Aab)
    target = (Npl - Nc) / (2 * fy)
    cum = 0.0; y0 = 0.0
    for y, w in zip(ys, ws):
        if cum + w * dy >= target:
            y0 = y - dy / 2 + (target - cum) / w; break
        cum += w * dy
    # moment about the slab top: tension (+ lever) minus compression
    M = 0.0
    for y, w in zip(ys, ws):
        lo, hi = y - dy / 2, y + dy / 2
        if hi <= y0: M -= fy * w * dy * (hs + y)
        elif lo >= y0: M += fy * w * dy * (hs + y)
        else:
            a1 = y0 - lo; a2 = hi - y0
            M -= fy * w * a1 * (hs + lo + a1 / 2); M += fy * w * a2 * (hs + y0 + a2 / 2)
    M -= Nc * xc / 2
    return dict(M=M, Nc=Nc, Ncf=fc * beff * hc, Npl=Npl, A=A)

def stud(d, hsc, fu, fck, Ecm, deck, nr, t, b0, hp):
    fu = min(fu, 500)
    r = hsc / d; alpha = 1.0 if r > 4 else 0.2 * (r + 1)
    P = min(0.8 * fu * math.pi * d * d / 4 / 1.25, 0.29 * alpha * d * d * math.sqrt(fck * Ecm) / 1.25)
    h_ = min(hsc, hp + 75)
    if deck == 'perp':
        kmax = {(1, False): 0.85, (1, True): 1.0, (2, False): 0.70, (2, True): 0.80}[(nr, t > 1.0)]
        k = min(kmax, 0.7 / math.sqrt(nr) * b0 / hp * (h_ / hp - 1))
    elif deck == 'para': k = min(1.0, 0.6 * b0 / hp * (h_ / hp - 1))
    else: k = 1.0
    return P, k

def transformed_I(s, beff, hc, hs, n):
    # first and second moments about the slab top
    Ac = beff * hc / n; As = s['A']; ys = hs + s['h'] / 2
    A = Ac + As; S1 = Ac * hc / 2 + As * ys
    I_top = beff * hc ** 3 / (3 * n) + s['Iy'] + As * ys ** 2
    return I_top - S1 ** 2 / A

def case(c):
    s = section(c['section']); fy = fy_of(c['grade'], max(s['tf'], s['tw']))
    L = c['L']; S = c['slab']; fck = S['fck']; fcd = fck / 1.5; Ecm = ECM[fck]
    width_trib = (c['bL'] + c['bR']) / 2
    be = [min(L / 8, b / 2) if b > 0 else 0 for b in (c['bL'], c['bR'])]
    beff = (100 if c['studs']['nr'] == 2 else 0) + sum(be)
    hc = S['hs'] if S['deck'] == 'none' else S['hs'] - S['hp']
    gSlab = S['sw']; gBeam = s['mass'] * 9.81e-3
    G = (gSlab + c['loads']['sdl']) * width_trib * 1e-3 + gBeam
    Q = (c['loads']['q'] + c['loads']['qPart']) * width_trib * 1e-3
    w = c['gG'] * G + c['gQ'] * Q
    MEd = w * L * L / 8; VEd = w * L / 2
    wc = gSlab * width_trib * 1e-3 + gBeam; wcq = c['loads']['gConst'] * width_trib * 1e-3
    M1 = (c['gG'] * wc + c['gQ'] * wcq) * L * L / 8
    P, k = stud(c['studs']['d'], c['studs']['hsc'], c['studs']['fu'], fck, Ecm, S['deck'], c['studs']['nr'], S['t'], S['b0'], S['hp'])
    PRd = P * k
    pitch = S['rib'] * c['studs']['every'] if S['deck'] == 'perp' else c['studs']['spacing']
    nHalf = math.floor(L / 2 / pitch) * c['studs']['nr']
    NcConn = nHalf * PRd
    full = plastic(s, fy, beff, hc, S['hs'], fcd, float('inf'))
    eta = min(1.0, NcConn / full['Nc'])
    MRd = full['M'] if eta >= 1 else plastic(s, fy, beff, hc, S['hs'], fcd, NcConn)['M']
    Le = L / 1000; etaMin = 1.0 if Le > 25 else max(0.4, 1 - 355 / fy * (0.75 - 0.03 * Le))
    Av = max(s['A'] - 2 * s['b'] * s['tf'] + (s['tw'] + 2 * s['r']) * s['tf'], (s['h'] - 2 * s['tf']) * s['tw'])
    VRd = Av * fy / math.sqrt(3)
    # slab shear plane
    F = min(NcConn, full['Nc']) * max(be) / beff
    vEd = F / (L / 2) / hc
    Ape = S['Ape'] if (S['deck'] == 'perp' and S['continuous']) else 0
    req = max(0.0, vEd * hc / 2 - Ape * S['fyp'] / 1000) / (500 / 1.15) * 1000
    th = math.atan(0.5); vCr = 0.6 * (1 - fck / 250) * fcd * math.sin(th) * math.cos(th)
    n0 = Ea / Ecm; nL = n0 * (1 + 1.1 * 2)
    I0 = transformed_I(s, beff, hc, S['hs'], n0); IL = transformed_I(s, beff, hc, S['hs'], nL)
    d5 = lambda q, I: 5 * q * L ** 4 / (384 * Ea * I)
    kp = 0.5 if c['propped'] else 0.3
    pi = lambda I: 1 + kp * (1 - eta) * (I / s['Iy'] - 1)
    dSDL = d5(c['loads']['sdl'] * width_trib * 1e-3, IL) * pi(IL); dQ = d5(Q, I0) * pi(I0)
    dTot = (d5(wc, IL) if c['propped'] else d5(wc, s['Iy'])) + dSDL + dQ
    Idyn = transformed_I(s, beff, hc, S['hs'], Ea / (1.1 * Ecm))
    f = 18 / math.sqrt(d5(G + 0.1 * c['loads']['q'] * width_trib * 1e-3, Idyn))
    return dict(fy=fy, beff=beff, P=P, k=k, PRd=PRd, nHalf=nHalf, NcFull=full['Nc'], Npl=full['Npl'], eta=eta, etaMin=etaMin, MRd=MRd,
                MEd=MEd, VEd=VEd, VRd=VRd, M1=M1, reqAst=req, vEd=vEd, vCrush=vCr, I0=I0, IL=IL, dQ=dQ, dSDL=dSDL, dTot=dTot, f=f)

deck = lambda **k: {**dict(hs=130, hp=60, b0=150, rib=300, t=0.9, deck='perp', density=24, fck=30, Ast=193, continuous=True, Ape=1100, fyp=350, sw=2.6), **k}
studs = lambda **k: {**dict(d=19, hsc=95, fu=450, nr=1, every=1, spacing=150), **k}
loads = dict(gConst=0.75, sdl=1.2, q=3.5, qPart=0.8)
base = dict(grade='S355', gG=1.35, gQ=1.5, propped=False, creep=2, deflQ=360, deflT=250, fLim=4, loads=loads)
cases = {
  'perp_single': {**base, 'section': '457×191×67 UKB', 'L': 9000, 'bL': 3000, 'bR': 3000, 'slab': deck(), 'studs': studs()},
  'perp_pairs': {**base, 'section': '457×191×67 UKB', 'L': 9000, 'bL': 3000, 'bR': 3000, 'slab': deck(t=1.2), 'studs': studs(nr=2)},
  'edge_alternate': {**base, 'section': '533×210×92 UKB', 'L': 12000, 'bL': 3000, 'bR': 0, 'slab': deck(hs=140, sw=2.8, continuous=False), 'studs': studs(every=2)},
  'solid_propped': {**base, 'section': '406×178×54 UKB', 'L': 7500, 'bL': 2500, 'bR': 2500, 'propped': True,
                    'slab': deck(hs=150, hp=0, deck='none', sw=3.6, fck=35, Ast=252), 'studs': studs(spacing=150)},
  'parallel': {**base, 'section': '356×171×45 UKB', 'L': 6000, 'bL': 2500, 'bR': 2500, 'grade': 'S275',
               'slab': deck(deck='para', b0=180, hp=60, sw=2.5), 'studs': studs(spacing=200)},
}
out = {k: {'input': v, 'ref': case(v)} for k, v in cases.items()}
# plastic moment checks: no concrete (= Wpl fy by fibres), and the PNA-in-slab closed form
s = section('457×191×67 UKB')
out['plastic_steel'] = plastic(s, 355, 2000, 70, 130, 20, 0.0)
out['area_457'] = plastic(s, 355, 2000, 70, 130, 20, 0.0)['A']
(HERE.parent / 'ref_composite.json').write_text(json.dumps(out, indent=1))
for k in cases: r = out[k]['ref']; print(k, {x: round(r[x], 3) for x in ('beff', 'PRd', 'eta', 'MRd', 'MEd', 'reqAst', 'dTot', 'f')})
print('steel Mpl (fibres)', out['plastic_steel']['M'] / 1e6, 'area', out['area_457'])
