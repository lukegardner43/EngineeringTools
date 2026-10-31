"""Independent reference for the 2D frame analysis engine, written to ../ref_frame2d.json.
Different formulation from the engine: every member is subdivided into many frame elements (internal nodes at 1/48 points
and at load positions), distributed loads are applied to each sub-element as closed-form uniform + triangular fixed-end
forces, member end releases are handled by static condensation of the end sub-element, and the system is solved with
numpy. Internal forces at the stations come from the sub-element end forces, deflections from the nodal displacements.
Also: a statically determinate truss by the method of joints, three-moment-equation support moments, the exact
second-order cantilever and Euler critical loads (scipy generalised eigenproblem on a finely subdivided model).
"""
import json, math, pathlib
import numpy as np
from scipy.linalg import eigh
HERE = pathlib.Path(__file__).resolve().parent

def k_el(EA, EI, L):
    a, b, c, d, e = EA / L, 12 * EI / L**3, 6 * EI / L**2, 4 * EI / L, 2 * EI / L
    return np.array([[a, 0, 0, -a, 0, 0], [0, b, c, 0, -b, c], [0, c, d, 0, -c, e], [-a, 0, 0, a, 0, 0], [0, -b, -c, 0, b, -c], [0, c, e, 0, -c, d]], float)
def kg_el(N, L):
    k = np.zeros((6, 6)); t = np.array([[6/5, L/10, -6/5, L/10], [L/10, 2*L*L/15, -L/10, -L*L/30], [-6/5, -L/10, 6/5, -L/10], [L/10, -L*L/30, -L/10, 2*L*L/15]]) * N / L
    ix = [1, 2, 4, 5]
    for p in range(4):
        for q in range(4): k[ix[p], ix[q]] = t[p, q]
    return k
def T6(c, s):
    T = np.zeros((6, 6)); r = np.array([[c, s], [-s, c]]); T[0:2, 0:2] = r; T[3:5, 3:5] = r; T[2, 2] = T[5, 5] = 1; return T
def fef_linear(qa, qb, L):
    """fixed-end equivalent nodal loads (local) for a transverse load varying linearly qa -> qb over the element (closed form)"""
    # uniform qa + triangle (0 -> qb - qa)
    u, t = qa, qb - qa
    return np.array([0, u*L/2 + 3*t*L/20, u*L*L/12 + t*L*L/30, 0, u*L/2 + 7*t*L/20, -u*L*L/12 - t*L*L/20])
def fef_axial(pa, pb, L):
    return np.array([L * (2*pa + pb) / 6, 0, 0, L * (pa + 2*pb) / 6, 0, 0])
def condense(k, p, rel):
    if not rel: return k, p
    keep = [i for i in range(6) if i not in rel]
    krr = k[np.ix_(rel, rel)]; inv = np.linalg.inv(krr)
    kc = np.zeros((6, 6)); pc = np.zeros(6)
    kc[np.ix_(keep, keep)] = k[np.ix_(keep, keep)] - k[np.ix_(keep, rel)] @ inv @ k[np.ix_(rel, keep)]
    pc[keep] = p[keep] - k[np.ix_(keep, rel)] @ inv @ p[rel]
    return kc, pc

def solve(model, factors, nsub=48, second=False):
    nodes = {n['id']: (n['x'], n['y']) for n in model['nodes']}
    ids = list(nodes); dof = {nid: [3*i, 3*i+1, 3*i+2] for i, nid in enumerate(ids)}; nd = 3 * len(ids)
    elems = []   # (dofs, EA, EI, L, c, s, local load (qa, qb, pa, pb), rel, member id, x0)
    stations = {}
    for mem in model['members']:
        (xa, ya), (xb, yb) = nodes[mem['i']], nodes[mem['j']]; L = math.hypot(xb - xa, yb - ya); c, s = (xb - xa) / L, (yb - ya) / L
        sec = mem['sec']; EA = sec['E'] * 1e6 * sec['A'] * 1e-4; EI = sec['E'] * 1e6 * sec['I'] * 1e-8
        loads = [l for l in model['loads'] if l.get('member') == mem['id'] and factors.get(l['case'])]
        pts = set(L * k / nsub for k in range(nsub + 1))
        for l in loads:
            if l['type'] == 'udl': pts |= {l.get('a', 0) or 0, L if l.get('b') in (None, '') else l['b']}
            else: pts.add(L / 2 if l.get('a') in (None, '') else l['a'])
        xs = sorted(x for x in pts if 0 <= x <= L + 1e-12)
        # internal nodes
        chain = [dof[mem['i']]]
        for x in xs[1:-1]: chain.append([nd, nd + 1, nd + 2]); nd += 3
        chain.append(dof[mem['j']])
        def q_local(x):
            qx = qy = 0.0
            for l in loads:
                if l['type'] != 'udl': continue
                f = factors[l['case']]; a = l.get('a', 0) or 0; b = L if l.get('b') in (None, '') else l['b']
                if not (a - 1e-12 <= x <= b + 1e-12): continue
                w1 = l['w1'] * f; w2 = (l['w1'] if l.get('w2') in (None, '') else l['w2']) * f; w = w1 + (w2 - w1) * (x - a) / (b - a)
                d = l.get('dir', 'GY')
                if d == 'LY': qy += w
                elif d == 'LX': qx += w
                else:
                    pr = abs(c) if d == 'GYP' else abs(s) if d == 'GXP' else 1.0
                    gx, gy = (w * pr, 0.0) if d[1] == 'X' else (0.0, w * pr)
                    qx += gx * c + gy * s; qy += -gx * s + gy * c
            sw = sum(factors.get(cs['id'], 0) for cs in model['cases'] if cs.get('selfWeight'))
            if sw: w = -(sec.get('mass', 0) * 9.81 / 1000) * sw; qx += w * s; qy += w * c
            return qx, qy
        for k in range(len(xs) - 1):
            x0, x1 = xs[k], xs[k + 1]; h = x1 - x0
            # loads within the element: evaluate just inside its ends (partial loads start/stop at element nodes)
            qa, qb = q_local(x0 + 1e-9), q_local(x1 - 1e-9)
            p = fef_linear(qa[1], qb[1], h) + fef_axial(qa[0], qb[0], h)
            rel = []
            if k == 0 and (mem.get('relI') or mem.get('truss')): rel.append(2)
            if k == len(xs) - 2 and (mem.get('relJ') or mem.get('truss')): rel.append(5)
            elems.append(dict(d=chain[k] + chain[k + 1], EA=EA, EI=EI, L=h, c=c, s=s, p=p, rel=rel, mem=mem['id'], x0=x0))
        # point loads and moments at nodes
        stations[mem['id']] = dict(xs=xs, chain=chain, L=L, c=c, s=s)
        for l in loads:
            if l['type'] == 'udl': continue
            f = factors[l['case']]; a = L / 2 if l.get('a') in (None, '') else l['a']; k = xs.index(min(xs, key=lambda x: abs(x - a)))
            dd = chain[k]
            if l['type'] == 'point':
                P = l['P'] * f; d = l.get('dir', 'GY')
                if d == 'LY': gx, gy = -P * s, P * c
                elif d == 'LX': gx, gy = P * c, P * s
                elif d == 'GX': gx, gy = P, 0.0
                else: gx, gy = 0.0, P
                elems.append(dict(nodal=(dd, gx, gy, 0.0)))
            else: elems.append(dict(nodal=(dd, 0.0, 0.0, l['M'] * f)))
    def assemble(Nmap=None, geo_only=False):
        K = np.zeros((nd, nd)); Kg = np.zeros((nd, nd)); F = np.zeros(nd)
        for e in elems:
            if 'nodal' in e: (dd, gx, gy, mz) = e['nodal']; F[dd[0]] += gx; F[dd[1]] += gy; F[dd[2]] += mz; continue
            k = k_el(e['EA'], e['EI'], e['L'])
            if Nmap is not None: k = k + kg_el(Nmap[e['mem']], e['L'])
            kc, pc = condense(k, e['p'].copy(), e['rel']); T = T6(e['c'], e['s'])
            K[np.ix_(e['d'], e['d'])] += T.T @ kc @ T; F[e['d']] += T.T @ pc
        for l in model['loads']:
            if l['type'] == 'node' and factors.get(l['case']):
                f = factors[l['case']]; i = ids.index(l['node']); F[3*i] += l.get('Fx', 0) * f; F[3*i+1] += l.get('Fy', 0) * f; F[3*i+2] += l.get('Mz', 0) * f
        return K, F
    def run(Nmap):
        K, F = assemble(Nmap)
        fixed = set()
        for i, n in enumerate(model['nodes']):
            for j, dname in enumerate(['ux', 'uy', 'rz']):
                v = (n.get('sup') or {}).get(dname)
                if v == 'f': fixed.add(3*i + j)
                elif isinstance(v, (int, float)) and v > 0: K[3*i+j, 3*i+j] += v
        for i in range(len(ids)):
            if 3*i+2 not in fixed and abs(K[3*i+2, 3*i+2]) < 1e-9 * np.max(np.abs(np.diag(K))): fixed.add(3*i+2)
        free = [i for i in range(nd) if i not in fixed]
        u = np.zeros(nd); u[free] = np.linalg.solve(K[np.ix_(free, free)], F[free])
        R = K @ u - F
        return u, R, fixed
    u, R, fixed = run(None)
    if second:
        for _ in range(60):
            Nmap = {}
            for e in elems:
                if 'nodal' in e or e['mem'] in Nmap: continue
            # member axial force: mean over its sub-elements
            acc = {}
            for e in elems:
                if 'nodal' in e: continue
                ul = T6(e['c'], e['s']) @ u[e['d']]; k = k_el(e['EA'], e['EI'], e['L']); kc, pc = condense(k, e['p'].copy(), e['rel']); f = kc @ ul - pc
                acc.setdefault(e['mem'], []).append((f[3] - f[0]) / 2)
            Nmap = {m: float(np.mean(v)) for m, v in acc.items()}
            u2, R, fixed = run(Nmap)
            if np.max(np.abs(u2 - u)) < 1e-12: u = u2; break
            u = u2
    # results
    out = dict(nodes={nid: [float(u[3*i]), float(u[3*i+1]), float(u[3*i+2])] for i, nid in enumerate(ids)}, reactions={}, members={})
    for i, n in enumerate(model['nodes']):
        sp = n.get('sup') or {}
        if any(sp.get(d) for d in ('ux', 'uy', 'rz')):
            out['reactions'][n['id']] = [float(R[3*i+j]) if sp.get(d) == 'f' else (float(-sp[d] * u[3*i+j]) if isinstance(sp.get(d), (int, float)) else 0.0) for j, d in enumerate(['ux', 'uy', 'rz'])]
    for mid, st in stations.items():
        es = [e for e in elems if 'nodal' not in e and e['mem'] == mid]; res = []
        for k, e in enumerate(es):
            ul = T6(e['c'], e['s']) @ u[e['d']]; kk = k_el(e['EA'], e['EI'], e['L']); kc, pc = condense(kk, e['p'].copy(), e['rel']); f = kc @ ul - pc
            g = u[e['d']]
            res.append(dict(x=e['x0'], N=float(-f[0]), V=float(f[1]), M=float(-f[2]), dx=float(g[0]), dy=float(g[1])))
            if k == len(es) - 1: res.append(dict(x=st['L'], N=float(f[3]), V=float(-f[4]), M=float(f[5]), dx=float(g[3]), dy=float(g[4])))
        out['members'][mid] = res
    return out

def sec(A, I, E=210, mass=0): return dict(A=A, I=I, E=E, mass=mass)
UB = sec(85.5, 29400, 210, 67.1); UC = sec(114, 14300, 210, 89)
FIX, PIN, ROLL = {'ux': 'f', 'uy': 'f', 'rz': 'f'}, {'ux': 'f', 'uy': 'f'}, {'uy': 'f'}
models = {}
# 1 portal frame: fixed bases, UDL + partial trapezoid on the beam, wind, self weight
models['portal'] = dict(nodes=[dict(id='1', x=0, y=0, sup=FIX), dict(id='2', x=0, y=5), dict(id='3', x=8, y=5.5), dict(id='4', x=8, y=0, sup=FIX)],
  members=[dict(id='c1', i='1', j='2', sec=UC), dict(id='b', i='2', j='3', sec=UB), dict(id='c2', i='4', j='3', sec=UC)],
  cases=[dict(id='G', name='G', type='G', selfWeight=True), dict(id='W', name='W', type='W', selfWeight=False)],
  loads=[dict(case='G', type='udl', member='b', w1=-20, w2='', a=0, b='', dir='GY'), dict(case='G', type='udl', member='b', w1=-5, w2=-15, a=2, b=6, dir='GYP'),
         dict(case='G', type='point', member='b', P=-30, a=3, dir='GY'), dict(case='W', type='udl', member='c1', w1=4, w2='', a=0, b='', dir='GX'),
         dict(case='W', type='node', node='3', Fx=-6, Fy=0, Mz=0), dict(case='W', type='udl', member='b', w1=2.5, w2='', a=0, b='', dir='LY')],
  combos=[dict(id='U1', name='1.35G + 1.5W', kind='ULS', f={'G': 1.35, 'W': 1.5})])
# 2 Pratt truss, nodal loads only (determinate)
nodesT, memsT, loadsT = [], [], []
n, Ls, d = 6, 12.0, 1.5; p = Ls / n
for k in range(n + 1): nodesT.append(dict(id=f'B{k}', x=k*p, y=0, sup=PIN if k == 0 else ROLL if k == n else {}))
for k in range(n + 1): nodesT.append(dict(id=f'T{k}', x=k*p, y=d, sup={}))
bar = sec(19.4, 186, 210, 0)
for k in range(n): memsT += [dict(id=f'b{k}', i=f'B{k}', j=f'B{k+1}', sec=bar, truss=True), dict(id=f't{k}', i=f'T{k}', j=f'T{k+1}', sec=bar, truss=True)]
for k in range(n + 1): memsT.append(dict(id=f'v{k}', i=f'B{k}', j=f'T{k}', sec=bar, truss=True))
for k in range(n): memsT.append(dict(id=f'd{k}', i=f'T{k}', j=f'B{k+1}', sec=bar, truss=True) if k < n/2 else dict(id=f'd{k}', i=f'B{k}', j=f'T{k+1}', sec=bar, truss=True))
for k in range(n + 1): loadsT.append(dict(case='G', type='node', node=f'T{k}', Fx=0, Fy=-(10 if 0 < k < n else 5), Mz=0))
loadsT.append(dict(case='G', type='node', node='B3', Fx=8, Fy=-12, Mz=0))
models['truss'] = dict(nodes=nodesT, members=memsT, cases=[dict(id='G', name='G', type='G', selfWeight=False)], loads=loadsT, combos=[])
# 3 continuous beam with every member load type, a hinge (Gerber) and a spring support
models['beam'] = dict(nodes=[dict(id='A', x=0, y=0, sup=PIN), dict(id='B', x=6, y=0, sup=ROLL), dict(id='C', x=14, y=0, sup={'uy': 30000}), dict(id='D', x=20, y=0, sup=ROLL), dict(id='E', x=22, y=0)],
  members=[dict(id='m1', i='A', j='B', sec=UB), dict(id='m2', i='B', j='C', sec=UB, relJ=True), dict(id='m3', i='C', j='D', sec=UB), dict(id='m4', i='D', j='E', sec=UB)],
  cases=[dict(id='G', name='G', type='G', selfWeight=False)],
  loads=[dict(case='G', type='udl', member='m1', w1=-12, w2='', a=0, b='', dir='GY'), dict(case='G', type='udl', member='m2', w1=-4, w2=-18, a=1.5, b=7, dir='GY'),
         dict(case='G', type='point', member='m2', P=-40, a=2.5, dir='GY'), dict(case='G', type='moment', member='m3', M=25, a=2), dict(case='G', type='udl', member='m3', w1=-10, w2='', a=0, b='', dir='GY'),
         dict(case='G', type='node', node='E', Fx=0, Fy=-15, Mz=0), dict(case='G', type='udl', member='m1', w1=3, w2='', a=0, b='', dir='LX')], combos=[])
# 4 three-span beam, uniform load only: support moments by the three-moment equation
models['three'] = dict(nodes=[dict(id='A', x=0, y=0, sup=PIN), dict(id='B', x=6, y=0, sup=ROLL), dict(id='C', x=14, y=0, sup=ROLL), dict(id='D', x=20, y=0, sup=ROLL)],
  members=[dict(id='s1', i='A', j='B', sec=UB), dict(id='s2', i='B', j='C', sec=UB), dict(id='s3', i='C', j='D', sec=UB)], cases=[dict(id='G', name='G', type='G', selfWeight=False)],
  loads=[dict(case='G', type='udl', member=m, w1=-10, w2='', a=0, b='', dir='GY') for m in ('s1', 's2', 's3')], combos=[])
out = {}
for k, m in models.items():
    fac = {c['id']: 1 for c in m['cases']}
    out[k] = dict(model=m, cases={c['id']: solve(m, {c['id']: 1}) for c in m['cases']}, combos={c['id']: solve(m, c['f']) for c in m['combos']})
# method of joints for the truss (statically determinate): unknowns = bar forces + 3 reactions
m = models['truss']; ids = [n['id'] for n in m['nodes']]; pos = {n['id']: (n['x'], n['y']) for n in m['nodes']}
A = np.zeros((2 * len(ids), len(m['members']) + 3)); b = np.zeros(2 * len(ids))
for j, mem in enumerate(m['members']):
    (xa, ya), (xb, yb) = pos[mem['i']], pos[mem['j']]; L = math.hypot(xb - xa, yb - ya); c, s = (xb - xa) / L, (yb - ya) / L
    ia, ib = ids.index(mem['i']), ids.index(mem['j']); A[2*ia, j] += c; A[2*ia+1, j] += s; A[2*ib, j] -= c; A[2*ib+1, j] -= s   # tension pulls the node towards the bar
nm = len(m['members']); A[0, nm] = 1; A[1, nm + 1] = 1; A[2 * ids.index('B6') + 1, nm + 2] = 1
for l in m['loads']: i = ids.index(l['node']); b[2*i] -= l['Fx']; b[2*i+1] -= l['Fy']
x = np.linalg.solve(A, b); out['truss']['joints'] = {mem['id']: float(x[j]) for j, mem in enumerate(m['members'])}
# three-moment equation (equal EI, UDL w on all spans): M_A = M_D = 0
w, L1, L2, L3 = 10, 6, 8, 6
M3 = np.linalg.solve(np.array([[2 * (L1 + L2), L2], [L2, 2 * (L2 + L3)]]), -np.array([w * (L1**3 + L2**3) / 4, w * (L2**3 + L3**3) / 4]))
out['three']['MB'], out['three']['MC'] = float(M3[0]), float(M3[1])
# exact second order cantilever and Euler loads; portal alpha_cr by scipy on a finely subdivided model
EI = 210e6 * 29400e-8; Lc = 4; Pcr = math.pi**2 * EI / (4 * Lc**2)
out['euler'] = dict(EI=EI, L=Lc, Pcr=Pcr)
def acr_fine(model, factors, nsub=40):
    base = solve(model, factors, nsub=nsub)
    Nm = {mid: float(np.mean([r['N'] for r in res])) for mid, res in base['members'].items()}
    nodes = {n['id']: (n['x'], n['y']) for n in model['nodes']}; ids = list(nodes); nd = 3 * len(ids); el = []
    for mem in model['members']:
        (xa, ya), (xb, yb) = nodes[mem['i']], nodes[mem['j']]; L = math.hypot(xb - xa, yb - ya); c, s = (xb - xa) / L, (yb - ya) / L
        sc = mem['sec']; EA = sc['E'] * 1e6 * sc['A'] * 1e-4; EIm = sc['E'] * 1e6 * sc['I'] * 1e-8
        chain = [[3*ids.index(mem['i']) + q for q in range(3)]] + [[nd + 3*q, nd + 3*q + 1, nd + 3*q + 2] for q in range(nsub - 1)] + [[3*ids.index(mem['j']) + q for q in range(3)]]; nd += 3 * (nsub - 1)
        for q in range(nsub): el.append((chain[q] + chain[q + 1], EA, EIm, L / nsub, c, s, Nm[mem['id']]))
    K = np.zeros((nd, nd)); G = np.zeros((nd, nd))
    for d, EA, EIm, l, c, s, N in el:
        T = T6(c, s); K[np.ix_(d, d)] += T.T @ k_el(EA, EIm, l) @ T; G[np.ix_(d, d)] += T.T @ kg_el(N, l) @ T
    fixed = [3*ids.index(n['id']) + j for n in model['nodes'] for j, dn in enumerate(['ux', 'uy', 'rz']) if (n.get('sup') or {}).get(dn) == 'f']
    free = [i for i in range(nd) if i not in fixed]
    ev = eigh(K[np.ix_(free, free)], -G[np.ix_(free, free)], eigvals_only=True) if False else None
    mu = eigh(-G[np.ix_(free, free)], K[np.ix_(free, free)], eigvals_only=True)
    return 1 / max(mu)
out['portal']['acr'] = acr_fine(models['portal'], {'G': 1.35, 'W': 1.5})
# alpha_cr with end releases and truss bars: released ends get their own rotation, bars (pinned both ends) are one element
# carrying axial force and the string stiffness N/L only (no buckling between their nodes); rotations with no stiffness held
def acr_fine2(model, factors, nsub=40):
    base = solve(model, factors, nsub=nsub)
    Nm = {mid: float(np.mean([r['N'] for r in res])) for mid, res in base['members'].items()}
    nodes = {n['id']: (n['x'], n['y']) for n in model['nodes']}; ids = list(nodes); nd = 3 * len(ids); el = []
    for mem in model['members']:
        (xa, ya), (xb, yb) = nodes[mem['i']], nodes[mem['j']]; L = math.hypot(xb - xa, yb - ya); c, s = (xb - xa) / L, (yb - ya) / L
        sc = mem['sec']; EA = sc['E'] * 1e6 * sc['A'] * 1e-4; EIm = sc['E'] * 1e6 * sc['I'] * 1e-8
        ri, rj = bool(mem.get('relI') or mem.get('truss')), bool(mem.get('relJ') or mem.get('truss'))
        di = [3*ids.index(mem['i']) + q for q in range(3)]; dj = [3*ids.index(mem['j']) + q for q in range(3)]
        if ri and rj:
            kb = np.zeros((6, 6)); kb[0, 0] = kb[3, 3] = EA / L; kb[0, 3] = kb[3, 0] = -EA / L
            gb = np.zeros((6, 6)); f = Nm[mem['id']] / L; gb[1, 1] = gb[4, 4] = f; gb[1, 4] = gb[4, 1] = -f
            el.append((di + dj, kb, gb, c, s)); continue
        if ri: di = di[:2] + [nd]; nd += 1
        if rj: dj = dj[:2] + [nd]; nd += 1
        chain = [di] + [[nd + 3*q, nd + 3*q + 1, nd + 3*q + 2] for q in range(nsub - 1)] + [dj]; nd += 3 * (nsub - 1)
        for q in range(nsub): el.append((chain[q] + chain[q + 1], k_el(EA, EIm, L / nsub), kg_el(Nm[mem['id']], L / nsub), c, s))
    K = np.zeros((nd, nd)); G = np.zeros((nd, nd))
    for d, k, g, c, s in el:
        T = T6(c, s); K[np.ix_(d, d)] += T.T @ k @ T; G[np.ix_(d, d)] += T.T @ g @ T
    fixed = [3*ids.index(n['id']) + j for n in model['nodes'] for j, dn in enumerate(['ux', 'uy', 'rz']) if (n.get('sup') or {}).get(dn) == 'f']
    fixed += [3*k + 2 for k in range(len(ids)) if abs(K[3*k + 2, 3*k + 2]) < 1e-9 * np.abs(np.diag(K)).max()]
    free = [i for i in range(nd) if i not in set(fixed)]
    mu = eigh(-G[np.ix_(free, free)], K[np.ix_(free, free)], eigvals_only=True)
    return 1 / max(mu)
# 5 two-bay three-storey frame: one pinned base, a beam pinned at one end, wind, self weight
nM = [dict(id=f'N{s}{b}', x=6.0 * b, y=3.6 * s, sup=(PIN if b == 2 else FIX) if s == 0 else {}) for s in range(4) for b in range(3)]
mM, lM = [], []
for s in range(3):
    for b in range(3): mM.append(dict(id=f'C{s}{b}', i=f'N{s}{b}', j=f'N{s+1}{b}', sec=UC))
for s in range(1, 4):
    for b in range(2):
        mM.append(dict(id=f'B{s}{b}', i=f'N{s}{b}', j=f'N{s}{b+1}', sec=UB, relJ=(s == 2 and b == 1)))
        lM += [dict(case='G', type='udl', member=f'B{s}{b}', w1=-30), dict(case='Q', type='udl', member=f'B{s}{b}', w1=-15)]
    lM.append(dict(case='W', type='node', node=f'N{s}0', Fx=12))
models['multi'] = dict(nodes=nM, members=mM, cases=[dict(id='G', name='G', type='G', selfWeight=True), dict(id='Q', name='Q', type='Q', selfWeight=False), dict(id='W', name='W', type='W', selfWeight=False)],
  loads=lM, combos=[dict(id='U1', name='U1', kind='ULS', f={'G': 1.35, 'Q': 1.5, 'W': 0.75}), dict(id='U2', name='U2', kind='ULS', f={'G': 1.0, 'W': 1.5})])
# 6 braced frame: pinned bases, simply supported beams, X-bracing bars in one bay, continuous columns
nB = [dict(id=f'P{s}{b}', x=5.0 * b, y=4.0 * s, sup=PIN if s == 0 else {}) for s in range(3) for b in range(2)]
bar = sec(15.0, 100, 210, 0)
mB = [dict(id=f'C{s}{b}', i=f'P{s}{b}', j=f'P{s+1}{b}', sec=UC) for s in range(2) for b in range(2)]
mB += [dict(id=f'B{s}', i=f'P{s}0', j=f'P{s}1', sec=UB, relI=True, relJ=True) for s in (1, 2)]
mB += [dict(id=f'X{s}', i=f'P{s}0', j=f'P{s+1}1', sec=bar, truss=True) for s in range(2)] + [dict(id=f'Y{s}', i=f'P{s}1', j=f'P{s+1}0', sec=bar, truss=True) for s in range(2)]
lB = [dict(case='G', type='node', node=f'P{s}{b}', Fy=-400) for s in (1, 2) for b in range(2)] + [dict(case='W', type='node', node=f'P{s}0', Fx=20) for s in (1, 2)]
models['braced'] = dict(nodes=nB, members=mB, cases=[dict(id='G', name='G', type='G', selfWeight=False), dict(id='W', name='W', type='W', selfWeight=False)], loads=lB, combos=[dict(id='U1', name='U1', kind='ULS', f={'G': 1.35, 'W': 1.5})])
for k in ('multi', 'braced'):
    m = models[k]; out[k] = dict(model=m, acr={c['id']: acr_fine2(m, c['f']) for c in m['combos']})
out['portal']['acr2'] = acr_fine2(models['portal'], {'G': 1.35, 'W': 1.5})
print('acr multi', out['multi']['acr'], 'braced', out['braced']['acr'], 'portal check', out['portal']['acr'], out['portal']['acr2'])
(HERE.parent / 'ref_frame2d.json').write_text(json.dumps(out))
print('three-moment', out['three']['MB'], out['three']['MC'], 'portal acr', out['portal']['acr'])
print('portal reactions', out['portal']['combos']['U1']['reactions'])
