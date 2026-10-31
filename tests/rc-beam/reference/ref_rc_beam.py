"""Independent reference for RC Beam Analysis & Design (tests/rc-beam/ref_rc_beam.json).
Written separately from the JavaScript engine:
- each beam is a 2D frame of Euler-Bernoulli elements: the spans cut at every station, load point and partial-UDL end, the
  columns above and below as real members to their far ends (fixed, or pinned), no sway (one horizontal restraint), solved
  with numpy for every load arrangement; moments and shears come from the element end forces, never from free-moment formulas;
- patterns (all, odd, even, optionally adjacent pairs) with the same gamma_G on every span plus 1.0 G_k, the SLS sets;
- the redistribution rule (support moments reduced to delta x the peak, other patterns min((2 - delta) M, delta M_max), the
  1.0 G_k case only capped, cantilevers and their root support elastic) applied by superposing linear corrections;
- the design envelope floor delta_f x elastic, design support moments (face / 0.65 centreline / beta1 / F t/8) and shears."""
import json, math, random, pathlib
import numpy as np
HERE = pathlib.Path(__file__).resolve().parent
rnd = random.Random(2026)
E = 30000.0
def beam_I(s):
    if s['shape'] == 'R': return s['bw'] * s['h'] ** 3 / 12
    Af, Aw = (s['beff'] - s['bw']) * s['hf'], s['bw'] * s['h']; y = (Af * s['hf'] / 2 + Aw * s['h'] / 2) / (Af + Aw)
    return (s['beff'] - s['bw']) * s['hf'] ** 3 / 12 + Af * (y - s['hf'] / 2) ** 2 + s['bw'] * s['h'] ** 3 / 12 + Aw * (s['h'] / 2 - y) ** 2
def k_local(EA, EI, L):
    k = np.zeros((6, 6)); a, b, c, d = EA / L, 12 * EI / L ** 3, 6 * EI / L ** 2, EI / L
    k[0, 0] = k[3, 3] = a; k[0, 3] = k[3, 0] = -a
    k[1, 1] = k[4, 4] = b; k[1, 4] = k[4, 1] = -b; k[1, 2] = k[2, 1] = k[1, 5] = k[5, 1] = c; k[2, 4] = k[4, 2] = k[4, 5] = k[5, 4] = -c
    k[2, 2] = k[5, 5] = 4 * d; k[2, 5] = k[5, 2] = 2 * d
    return k
def rot(cx, cy):
    T = np.zeros((6, 6)); r = np.array([[cx, cy, 0], [-cy, cx, 0], [0, 0, 1]]); T[:3, :3] = r; T[3:, 3:] = r; return T
class Frame:
    """beam along x (nodes 0..), columns hang off support nodes; DOF u, v, theta"""
    def __init__(s, m):
        s.m = m; spans, sups = m['spans'], m['supports']; n = len(spans)
        s.x0 = [0.0]; [s.x0.append(s.x0[-1] + sp['L']) for sp in spans]
        cuts = []
        for i, sp in enumerate(spans):
            L = sp['L']; xs = {L * k / 20 for k in range(21)}
            for f in m['probe'][i]: xs.add(f)
            for l in m['loads']:
                if l['span'] != i: continue
                if l['type'] == 'point': xs.add(l['a'] * 1e3)
                if l['type'] == 'part': xs |= {l['a'] * 1e3, min(L, (l['a'] + l['b']) * 1e3)}
            cuts.append(sorted(x for x in xs if -1e-9 <= x <= L + 1e-9))
        s.cuts = cuts
        s.nodes = []; s.bnode = []   # beam node ids per span cut
        idx = {}
        for i, cs in enumerate(cuts):
            ids = []
            for x in cs:
                X = round(s.x0[i] + x, 6)
                if X not in idx: idx[X] = len(s.nodes); s.nodes.append((X, 0.0))
                ids.append(idx[X])
            s.bnode.append(ids)
        s.sup_node = [s.bnode[0][0]] + [s.bnode[j - 1][-1] for j in range(1, n + 1)]
        s.elems = []   # (n1, n2, EA, EI, kind, span, xa, xb)
        for i, sp in enumerate(spans):
            EI = E * beam_I(sp); EA = EI * 1e6
            for k in range(len(cuts[i]) - 1): s.elems.append((s.bnode[i][k], s.bnode[i][k + 1], EA, EI, 'beam', i, cuts[i][k], cuts[i][k + 1]))
        s.fix = set()
        for j, su in enumerate(sups):
            nd = s.sup_node[j]
            if su['kind'] in ('knife', 'column'): s.fix.add(3 * nd + 1)
            if su['kind'] == 'fixed': s.fix |= {3 * nd + 1, 3 * nd + 2}
            if su['kind'] == 'column':
                for key, sgn in (('above', 1), ('below', -1)):
                    c = su.get(key)
                    if not c: continue
                    far = len(s.nodes); s.nodes.append((s.nodes[nd][0], sgn * c['L']))
                    EIc = E * c["b"] * c["h"] ** 3 / 12; s.elems.append((nd, far, EIc * 1e6, EIc, 'col', j, 0, c['L']))
                    s.fix |= {3 * far, 3 * far + 1} | ({3 * far + 2} if c['far'] == 'F' else set())
        s.fix.add(3 * s.sup_node[0] if sups[0]['kind'] != 'free' else 3 * s.sup_node[1])   # no sway
        nd = 3 * len(s.nodes); s.K = np.zeros((nd, nd)); s.Ts = []
        for (a, b, EA, EI, kind, *_ ) in s.elems:
            (xa, ya), (xb, yb) = s.nodes[a], s.nodes[b]; L = math.hypot(xb - xa, yb - ya); T = rot((xb - xa) / L, (yb - ya) / L)
            kg = T.T @ k_local(EA, EI, L) @ T; dofs = [3 * a, 3 * a + 1, 3 * a + 2, 3 * b, 3 * b + 1, 3 * b + 2]
            s.K[np.ix_(dofs, dofs)] += kg; s.Ts.append((T, L, dofs))
        s.free = [d for d in range(nd) if d not in s.fix]
    def solve(s, factor):   # factor(span, case) -> multiplier
        nd = 3 * len(s.nodes); F = np.zeros(nd); r_el = {}
        for l in s.m['loads']:
            f = factor(l['span'], l['case'])
            if not f: continue
            i = l['span']
            if l['type'] == 'point':
                nd_id = s.bnode[i][s.cuts[i].index(min(s.cuts[i], key=lambda x: abs(x - l['a'] * 1e3)))]; F[3 * nd_id + 1] -= f * l['P'] * 1e3
            else:
                a1, a2 = (0, s.m['spans'][i]['L']) if l['type'] == 'udl' else (l['a'] * 1e3, min(s.m['spans'][i]['L'], (l['a'] + l['b']) * 1e3))
                for e, el in enumerate(s.elems):
                    if el[4] != 'beam' or el[5] != i: continue
                    xa, xb = el[6], el[7]
                    if xa >= a1 - 1e-9 and xb <= a2 + 1e-9:
                        w = f * l['w']; L = xb - xa; r = np.array([0, w * L / 2, w * L * L / 12, 0, w * L / 2, -w * L * L / 12])
                        r_el[e] = r_el.get(e, 0) + r; dofs = s.Ts[e][2]; F[dofs] -= r
        u = np.zeros(nd); fr = s.free; u[fr] = np.linalg.solve(s.K[np.ix_(fr, fr)], F[fr])
        R = s.K @ u - F   # reactions at restrained dofs
        # element end forces (local): k u_local + fixed-end reactions
        ends = {}
        for e, el in enumerate(s.elems):
            T, L, dofs = s.Ts[e]; ul = T @ u[dofs]; f = k_local(el[2], el[3], L) @ ul + (r_el.get(e, 0) if isinstance(r_el.get(e, 0), np.ndarray) else 0)
            ends[e] = f
        s.wel = {e: (2 * r[1] / s.Ts[e][1] if isinstance(r, np.ndarray) else 0) for e, r in r_el.items()}
        return u, R, ends
    def beam_forces(s, ends):
        """internal M (sagging +) and V (dM/dx) just right / left of every cut, per span"""
        out = []
        for i in range(len(s.m['spans'])):
            n = len(s.cuts[i]); MR = [None] * n; ML = [None] * n; VR = [None] * n; VL = [None] * n
            for e, el in enumerate(s.elems):
                if el[4] != 'beam' or el[5] != i: continue
                k = s.cuts[i].index(el[6]); f = ends[e]
                MR[k] = -f[2]; VR[k] = f[1]; ML[k + 1] = f[5]; VL[k + 1] = -f[4]
            ML[0] = MR[0]; VL[0] = VR[0]; MR[-1] = ML[-1]; VR[-1] = VL[-1]
            # interior maxima: within an element under w the shear falls linearly, M peaks where V = 0
            peak = -math.inf
            for e, el in enumerate(s.elems):
                if el[4] != 'beam' or el[5] != i: continue
                k = s.cuts[i].index(el[6]); w = s.wel.get(e, 0)
                if w > 0 and VR[k] > 0 and VL[k + 1] < 0: peak = max(peak, MR[k] + VR[k] ** 2 / (2 * w))
            out.append({'x': s.cuts[i], 'M': [MR[k] if MR[k] is not None else ML[k] for k in range(n)], 'VR': VR, 'VL': VL, 'peak': peak})
        return out
def patterns(n, adjacent):
    p = [('All spans', [True] * n)]
    if n > 1: p += [('Odd spans', [i % 2 == 0 for i in range(n)]), ('Even spans', [i % 2 == 1 for i in range(n)])]
    if adjacent and n > 2: p += [(f'Spans {i + 1} & {i + 2}', [k in (i, i + 1) for k in range(n)]) for i in range(n - 1)]
    return p
def run(m):
    fr = Frame(m); spans, sups, n = m['spans'], m['supports'], len(m['spans'])
    sets = m['sets']; pats = patterns(n, m.get('adjacent', False))
    cases = [{'gG': st['gG'], 'gQ': st['gQ'], 'q': q, 'uls': True} for st in sets for _, q in pats] + [{'gG': 1, 'gQ': 0, 'q': [False] * n, 'uls': False}]
    cant = [('L' if i == 0 and sups[0]['kind'] == 'free' else 'R' if i == n - 1 and sups[n]['kind'] == 'free' else None) for i in range(n)]
    cantRoot = [((j > 0 and cant[j - 1]) or (j < n and cant[j])) is not None and bool((j > 0 and cant[j - 1]) or (j < n and cant[j])) for j in range(n + 1)]
    delta = [1.0 if cantRoot[j] or sups[j]['kind'] == 'free' else sups[j].get('delta', 1.0) for j in range(n + 1)]
    for c in cases:
        u, R, ends = fr.solve(lambda i, cs, c=c: c['gG'] if cs == 'G' else (c['gQ'] if c['q'][i] else 0))
        c['bf'] = fr.beam_forces(ends); c['wel'] = dict(fr.wel)
        c['hog'] = [[-c['bf'][i]['M'][0], -c['bf'][i]['M'][-1]] for i in range(n)]
        c['R'] = [R[3 * fr.sup_node[j] + 1] if sups[j]['kind'] != 'free' else 0.0 for j in range(n + 1)]
    sls = {'k': [], 'qp': []}
    for _, q in pats:
        for key, gq in (('k', 1.0), ('qp', m['psi2'])):
            u, R, ends = fr.solve(lambda i, cs, q=q, gq=gq: 1.0 if cs == 'G' else (gq if q[i] else 0)); sls[key].append(fr.beam_forces(ends))
    # redistribution
    Mmax = [max([0] + [v for c in cases if c['uls'] for v in ([c['hog'][j - 1][1]] if j > 0 else []) + ([c['hog'][j][0]] if j < n else [])]) for j in range(n + 1)]
    cap = [delta[j] * Mmax[j] for j in range(n + 1)]; bp = [1 if m['redist'] == 'none' else 2 - delta[j] for j in range(n + 1)]
    def adj(v, j, i, c):
        if cant[i] or cantRoot[j] or sups[j]['kind'] == 'free' or not v > 0: return v
        return min((bp[j] if c['uls'] else 1) * v, cap[j])
    for c in cases:
        c['hogR'] = [[adj(c['hog'][i][0], i, i, c), adj(c['hog'][i][1], i + 1, i, c)] for i in range(n)]
        # corrections are linear in each span: dM = -(dhL (1 - x/L) + dhR x/L), dV = (dhL - dhR)/L
        c['bfR'] = []
        for i in range(n):
            L = spans[i]['L']; dl, dr = c['hogR'][i][0] - c['hog'][i][0], c['hogR'][i][1] - c['hog'][i][1]; b = c['bf'][i]
            c['bfR'].append({'x': b['x'], 'M': [M - dl * (1 - x / L) - dr * x / L for x, M in zip(b['x'], b['M'])],
                             'VR': [V + (dl - dr) / L if V is not None else None for V in b['VR']], 'VL': [V + (dl - dr) / L if V is not None else None for V in b['VL']]})
        c['RR'] = [c['R'][j] + ((c['hogR'][j][0] - c['hog'][j][0] - c['hogR'][j][1] + c['hog'][j][1]) / spans[j]['L'] if j < n else 0) - ((c['hogR'][j - 1][0] - c['hog'][j - 1][0] - c['hogR'][j - 1][1] + c['hog'][j - 1][1]) / spans[j - 1]['L'] if j > 0 else 0) if sups[j]['kind'] != 'free' else 0.0 for j in range(n + 1)]
    out = {'cases': [{'hog': c['hog'], 'hogR': c['hogR'], 'R': c['R'], 'RR': c['RR'], 'uls': c['uls']} for c in cases], 'Mmax': Mmax, 'stations': []}
    for i in range(n):
        xs = fr.cuts[i]; df = min(delta[i], delta[i + 1]); st = []
        for k, x in enumerate(xs):
            el = [c['bf'][i]['M'][k] for c in cases]; rd = [c['bfR'][i]['M'][k] for c in cases]
            vR = [c['bfR'][i]['VR'][k] for c in cases if c['bfR'][i]['VR'][k] is not None]; vL = [c['bfR'][i]['VL'][k] for c in cases if c['bfR'][i]['VL'][k] is not None]
            o = {'x': x, 'MmaxE': max(el), 'MminE': min(el), 'Mmax': max(rd), 'Mmin': min(rd), 'VmaxR': max(vR), 'VminR': min(vR), 'VmaxL': max(vL), 'VminL': min(vL),
                 'MkMax': max(b[i]['M'][k] for b in sls['k']), 'MkMin': min(b[i]['M'][k] for b in sls['k']), 'MqMax': max(b[i]['M'][k] for b in sls['qp']), 'MqMin': min(b[i]['M'][k] for b in sls['qp'])}
            o['MmaxD'] = max(o['Mmax'], df * o['MmaxE']) if o['MmaxE'] > 0 else o['Mmax']; o['MminD'] = min(o['Mmin'], df * o['MminE']) if o['MminE'] < 0 else o['Mmin']
            st.append(o)
        out['stations'].append(st)
    # exact span maxima: nodes and interior zero-shear peaks; redistributed peaks from the corrected shears (w unchanged)
    def peakR(c, i):
        b = c['bfR'][i]; pk = -math.inf
        for e, el in enumerate(fr.elems):
            if el[4] != 'beam' or el[5] != i: continue
            k = b['x'].index(el[6]); w = c['wel'].get(e, 0)
            if w > 0 and b['VR'][k] > 0 and b['VL'][k + 1] < 0: pk = max(pk, b['M'][k] + b['VR'][k] ** 2 / (2 * w))
        return max(pk, max(b['M']))
    out['spanMax'] = []
    for i in range(n):
        el = max(0, max(max(max(c['bf'][i]['M']), c['bf'][i]['peak']) for c in cases)); eq = max(0, max(peakR(c, i) for c in cases)); df = min(delta[i], delta[i + 1])
        out['spanMax'].append({'elastic': el, 'equilibrium': eq, 'design': max(eq, df * el if el > 0 else 0), 'Mk': max(0, max(max(max(b[i]['M']), b[i]['peak']) for b in sls['k'])), 'Mqp': max(0, max(max(max(b[i]['M']), b[i]['peak']) for b in sls['qp']))})
    out['Rmax'] = [max(c['RR'][j] for c in cases if c['uls']) for j in range(n + 1)]
    # design support moments
    des = []
    for j, su in enumerate(sups):
        if su['kind'] == 'free': des.append(None); continue
        sides = []
        for side, i in (('L', j - 1), ('R', j)):
            if not (0 <= i < n): continue
            L = spans[i]['L']; xs = fr.cuts[i]; st = out['stations'][i]
            face = max(0, L - su['width'] / 2) if side == 'L' else min(L, su['width'] / 2); xc = L if side == 'L' else 0
            at = lambda x: st[min(range(len(xs)), key=lambda k: abs(xs[k] - x))]
            Mf, Mc = max(0, -at(face)['MminD']), max(0, -at(xc)['MminD']); mono = su['kind'] in ('column', 'fixed')
            if cant[i]: Md = Mf if mono else Mc
            elif mono: Md = max(Mf, 0.65 * Mc)
            else: Md = max(0, Mc - out['Rmax'][j] * su['width'] / 8)
            if (j == 0 or j == n) and mono and not cant[i]: Md = max(Md, 0.25 * out['spanMax'][i]['design'])
            sides.append({'side': side, 'span': i, 'Mface': Mf, 'Mcl': Mc, 'Mdes': Md})
        des.append(sides)
    out['design'] = des
    return out
def rand_case(k):
    n = rnd.choice([1, 2, 3, 3, 4, 5]); spans = []
    for i in range(n):
        shape = rnd.choice(['T', 'L', 'R']); bw = rnd.choice([250, 300, 400]); h = rnd.choice([400, 500, 600]); hf = rnd.choice([100, 150])
        spans.append({'L': rnd.choice([3000, 4500, 6000, 7200, 8000]), 'h': h, 'bw': bw, 'hf': hf, 'shape': shape, 'beff': bw if shape == 'R' else bw + rnd.choice([400, 900, 1500]), 'bay': 5000})
    sups = []
    for j in range(n + 1):
        end = j in (0, n); kinds = ['column', 'column', 'knife'] + (['fixed', 'free'] if end else [])
        kd = rnd.choice(kinds)
        if kd == 'free' and (n == 1 or (j == n and sups and sups[0]['kind'] == 'free')): kd = 'column'
        su = {'kind': kd, 'width': rnd.choice([0, 250, 300, 400]) if kd != 'free' else 0, 'delta': 1.0}
        if kd == 'column':
            mk = lambda: {'L': rnd.choice([3000, 3500, 4000]), 'b': rnd.choice([250, 300, 400]), 'h': rnd.choice([250, 300, 400, 500]), 'far': rnd.choice(['F', 'P'])}
            su['above'] = mk() if rnd.random() < 0.8 else None; su['below'] = mk()
        if 0 < j < n: su['delta'] = rnd.choice([1.0, 0.9, 0.85, 0.8, 0.7])
        sups.append(su)
    if n >= 1 and sups[0]['kind'] == 'free' and sups[1]['kind'] == 'knife' and n == 1: sups[1]['kind'] = 'fixed'
    if sups[0]['kind'] == 'free' and n > 1 and sups[1]['kind'] not in ('column', 'fixed') and n == 1: sups[1]['kind'] = 'fixed'
    if sups[-1]['kind'] == 'free' and n == 1: sups[0]['kind'] = 'fixed'
    loads = []
    for i in range(n):
        L = spans[i]['L'] / 1e3
        loads += [{'span': i, 'case': 'G', 'type': 'udl', 'w': round(rnd.uniform(10, 50), 1)}, {'span': i, 'case': 'Q', 'type': 'udl', 'w': round(rnd.uniform(3, 25), 1)}]
        if rnd.random() < 0.5: loads.append({'span': i, 'case': rnd.choice(['G', 'Q']), 'type': 'point', 'P': round(rnd.uniform(20, 150), 1), 'a': round(rnd.uniform(0.1, 0.9) * L, 2)})
        if rnd.random() < 0.4: a = round(rnd.uniform(0, 0.5) * L, 2); loads.append({'span': i, 'case': rnd.choice(['G', 'Q']), 'type': 'part', 'w': round(rnd.uniform(5, 30), 1), 'a': a, 'b': round(rnd.uniform(0.2, 0.9) * (L - a), 2)})
    rule = rnd.choice(['6.10', '6.10ab']); psi0 = 0.7
    sets = [{'gG': 1.35, 'gQ': 1.5, 'label': '6.10'}] if rule == '6.10' else [{'gG': 1.35, 'gQ': 1.5 * psi0, 'label': '6.10a'}, {'gG': 0.925 * 1.35, 'gQ': 1.5, 'label': '6.10b'}]
    m = {'spans': spans, 'supports': sups, 'loads': loads, 'rule': rule, 'psi0': psi0, 'sets': sets, 'adjacent': rnd.random() < 0.3, 'redist': rnd.choice(['limited', 'limited', 'none']), 'psi2': rnd.choice([0.3, 0.6])}
    m['probe'] = [[sups[i]['width'] / 2, spans[i]['L'] - sups[i + 1]['width'] / 2] for i in range(n)]
    return m
cases = []
while len(cases) < 14:
    m = rand_case(len(cases))
    try: res = run(m)
    except np.linalg.LinAlgError: continue
    cases.append({'model': {k: v for k, v in m.items() if k != 'probe'}, 'res': res})
def rnd12(o):
    if isinstance(o, float): return float(f'{o:.12g}')
    if isinstance(o, list): return [rnd12(v) for v in o]
    if isinstance(o, dict): return {k: rnd12(v) for k, v in o.items()}
    return o
(HERE.parent / 'ref_rc_beam.json').write_text(json.dumps(rnd12({'cases': cases}), separators=(',', ':')))
print(len(cases), [len(c['model']['spans']) for c in cases], [[s['kind'][0] for s in c['model']['supports']] for c in cases])
