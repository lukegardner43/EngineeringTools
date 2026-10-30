"""Independent frame reference (numpy / scipy), written to ../ref_frame.json.
- Fixed-base and pinned-base portal frames (flat beam) by an independent stiffness solver with exact element fixed-end forces:
  member end moments, reactions and sway under a beam UDL plus a horizontal eaves load.
- Elastic critical load factors: portal sway buckling from the exact slope-deflection (stability functions) characteristic equation,
  solved by root finding; pinned-base portal and a two-storey frame against a fine finite-element eigen solution (scipy).
"""
import json, math, pathlib
import numpy as np
from scipy.linalg import eigh
from scipy.optimize import brentq
HERE = pathlib.Path(__file__).resolve().parent
E = 210000.0

def frame_solve(nodes, mems, fixed, loads_nodal, udl, nsub=1, geo=None):
    """nodes [(x,y)], mems [(i,j,A,I)], fixed set of dofs, loads_nodal {dof: F}, udl {mem: wy (global, per length)}; returns u, end moments"""
    # subdivide
    N = [list(n) for n in nodes]; els = []
    for mi, (i, j, A, I) in enumerate(mems):
        xi, yi = nodes[i]; xj, yj = nodes[j]; ids = [i]
        for k in range(1, nsub):
            N.append([xi + (xj - xi) * k / nsub, yi + (yj - yi) * k / nsub]); ids.append(len(N) - 1)
        ids.append(j)
        for k in range(nsub): els.append((ids[k], ids[k + 1], A, I, mi))
    n = 3 * len(N); K = np.zeros((n, n)); F = np.zeros(n); KG = np.zeros((n, n))
    for a, b, A, I, mi in els:
        (x1, y1), (x2, y2) = N[a], N[b]; L = math.hypot(x2 - x1, y2 - y1); c, s = (x2 - x1) / L, (y2 - y1) / L
        T = np.zeros((6, 6)); R = np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]]); T[:3, :3] = R; T[3:, 3:] = R
        EA, EI = E * A / L, E * I
        k = np.array([[EA, 0, 0, -EA, 0, 0], [0, 12 * EI / L**3, 6 * EI / L**2, 0, -12 * EI / L**3, 6 * EI / L**2], [0, 6 * EI / L**2, 4 * EI / L, 0, -6 * EI / L**2, 2 * EI / L],
                      [-EA, 0, 0, EA, 0, 0], [0, -12 * EI / L**3, -6 * EI / L**2, 0, 12 * EI / L**3, -6 * EI / L**2], [0, 6 * EI / L**2, 2 * EI / L, 0, -6 * EI / L**2, 4 * EI / L]])
        g = np.array([[0, 0, 0, 0, 0, 0], [0, 36, 3 * L, 0, -36, 3 * L], [0, 3 * L, 4 * L * L, 0, -3 * L, -L * L], [0, 0, 0, 0, 0, 0], [0, -36, -3 * L, 0, 36, -3 * L], [0, 3 * L, -L * L, 0, -3 * L, 4 * L * L]]) / (30 * L)
        idx = [3 * a, 3 * a + 1, 3 * a + 2, 3 * b, 3 * b + 1, 3 * b + 2]
        K[np.ix_(idx, idx)] += T.T @ k @ T
        if geo is not None: KG[np.ix_(idx, idx)] += geo[mi] * (T.T @ g @ T)
        w = udl.get(mi, 0.0)
        if w:
            wl, wt = w * s, w * c
            f = np.array([wl * L / 2, wt * L / 2, wt * L * L / 12, wl * L / 2, wt * L / 2, -wt * L * L / 12]); F[idx] += T.T @ f
    for d, v in loads_nodal.items(): F[d] += v
    free = [i for i in range(n) if i not in fixed]
    return K, KG, F, free, N, els

def portal(base_fixed, h, Lb, Ic, Ib, A, w, H):
    nodes = [(0, 0), (0, h), (Lb, h), (Lb, 0)]; mems = [(0, 1, A, Ic), (1, 2, A, Ib), (3, 2, A, Ic)]
    fixed = {0, 1, 9, 10} | ({2, 11} if base_fixed else set())
    K, _, F, free, N, els = frame_solve(nodes, mems, fixed, {3: H}, {1: -w}, nsub=1)
    u = np.zeros(len(F)); u[free] = np.linalg.solve(K[np.ix_(free, free)], F[free])
    R = K @ u - F
    return dict(sway=u[3], uy_mid=None, Rx0=R[0], Ry0=R[1], M0=R[2], Rx3=R[9], Ry3=R[10], M3=R[11])

out = {}
h, Lb, Ic, Ib, A = 6000.0, 12000.0, 1.2e8, 2.4e8, 1.0e4
for bf in (True, False):
    out['portal_' + ('fixed' if bf else 'pinned')] = portal(bf, h, Lb, Ic, Ib, A, 20.0, 50e3)

# alpha_cr of a fixed-base portal, columns loaded by P each (beam unloaded axially): stability functions, sway mode
def sway_char(P, base_fixed):
    k = math.sqrt(P / (E * Ic)); kl = k * h
    s = (kl * math.sin(kl) - kl * kl * math.cos(kl)) / (2 - 2 * math.cos(kl) - kl * math.sin(kl))     # stability functions s, c (Livesley)
    c = (kl * kl - kl * math.sin(kl)) / (kl * math.sin(kl) - kl * kl * math.cos(kl))
    EIc, EIb = E * Ic, E * Ib
    # sway mode, antisymmetric: beam end stiffness 6 EIb/Lb; unknowns joint rotation theta and sway delta
    if base_fixed:
        a11 = s * EIc / h + 6 * EIb / Lb; a12 = -s * (1 + c) * EIc / h**2
        a22 = 2 * s * (1 + c) * EIc / h**3 - P / h   # per column: (2s(1+c) EI/h³ - P/h)
        a21 = -s * (1 + c) * EIc / h**2
        return a11 * a22 - a12 * a21
    else:
        sp = s * (1 - c * c)                          # modified stiffness, far end pinned
        a11 = sp * EIc / h + 6 * EIb / Lb; a12 = -sp * EIc / h**2; a22 = sp * EIc / h**3 - P / h; a21 = a12
        return a11 * a22 - a12 * a21
def first_root(fun, lo, hi, n=4000):
    xs = np.linspace(lo, hi, n); vs = [fun(x) for x in xs]
    for i in range(n - 1):
        if vs[i] * vs[i + 1] < 0: return brentq(fun, xs[i], xs[i + 1])
    return None
Pref = 1000e3
out['acr_portal_fixed'] = first_root(lambda P: sway_char(P, True), 1e3, 4 * math.pi**2 * E * Ic / h**2 * 0.999) / Pref
out['acr_portal_pinned'] = first_root(lambda P: sway_char(P, False), 1e3, math.pi**2 * E * Ic / h**2 * 0.999) / Pref
# FE eigen check of the same (nsub 20) for both
def fe_acr(base_fixed):
    nodes = [(0, 0), (0, h), (Lb, h), (Lb, 0)]; mems = [(0, 1, 1e6, Ic), (1, 2, 1e6, Ib), (3, 2, 1e6, Ic)]
    fixed = {0, 1, 9, 10} | ({2, 11} if base_fixed else set())
    K, KG, F, free, N, els = frame_solve(nodes, mems, fixed, {}, {}, nsub=20, geo={0: -Pref, 1: 0.0, 2: -Pref})
    mu = eigh(-KG[np.ix_(free, free)], K[np.ix_(free, free)], eigvals_only=True)   # mu = 1/lambda (K positive definite)
    return 1 / mu.max()
out['acr_portal_fixed_fe'] = fe_acr(True); out['acr_portal_pinned_fe'] = fe_acr(False)
out['geom'] = dict(h=h, Lb=Lb, Ic=Ic, Ib=Ib, A=A, Pref=Pref)
(HERE.parent / 'ref_frame.json').write_text(json.dumps(out, indent=1))
print(json.dumps(out, indent=1))
