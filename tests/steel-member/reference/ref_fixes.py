"""Independent reference values for the post-review fixes (numpy/scipy only; nothing shared with the JS engine).

1. LTB of a built-in cantilever with a tip point load on the top flange: Ritz polynomial basis (v = phi = 0, v' = phi' = 0 at
   the root), energy -int(M phi v'') - 1/2 P a phi(L)^2.
2. Flexural (and, by analogy, torsional) buckling of a column pinned at 0 and Lb with a free overhang Lc: exact
   transcendental equation (EI/Lb) u^2 sin u / (sin u - u cos u) = EI k tan(k Lc), u = k Lb, k = sqrt(N/EI).
3. Torsional buckling of a built-in cantilever: (GIt + pi^2 EIw / (2L)^2) / i0^2.
4. Effective section modulus of a welded I with a Class 4 web in bending (EN 1993-1-5 4.4, psi = -1), by summing parts.
Usage: python3 ref_fixes.py '<section JSON>' > ../ref_fixes.json (see test_fixes.js for the section)"""
import json, math
import numpy as np
from scipy.linalg import eigh
from scipy.optimize import brentq

E, G = 210000.0, 81000.0
def ritz_cantilever(L, EIz, GJ, EIw, P, a, n=12, nq=6000):
    x = np.linspace(0, L, nq + 1); w = np.full(nq + 1, L / nq); w[0] = w[-1] = L / nq / 2
    xi = x / L
    p = np.arange(2, n + 2)[:, None]
    f = xi ** p; d1 = p * xi ** (p - 1) / L; d2 = p * (p - 1) * xi ** (p - 2) / L ** 2
    K = np.zeros((2 * n, 2 * n)); Kg = np.zeros((2 * n, 2 * n))
    K[:n, :n] = (d2 * EIz * w) @ d2.T
    K[n:, n:] = (d1 * GJ * w) @ d1.T + (d2 * EIw * w) @ d2.T
    M = -P * (L - x)                       # hogging, sagging positive
    C = (f * M * w) @ d2.T                 # int M phi_i v''_j
    Kg[n:, :n] = C; Kg[:n, n:] = C.T
    tip = f[:, -1]
    Kg[n:, n:] += P * a * np.outer(tip, tip)
    mu = eigh(Kg, K, eigvals_only=True)
    return 1 / mu.max()                    # load factor on P

def overhang_ncr(EI, Lb, Lc):
    def g(k):
        u = k * Lb
        return (EI / Lb) * u * u * math.sin(u) / (math.sin(u) - u * math.cos(u)) - EI * k * math.tan(k * Lc)
    # smallest root below both pi/(2Lc) and pi/Lb
    kmax = min(math.pi / (2 * Lc), math.pi / Lb) * (1 - 1e-9)
    ks = np.linspace(1e-7, kmax, 20000)
    vals = [g(k) for k in ks]
    for i in range(len(ks) - 1):
        if vals[i] > 0 and vals[i + 1] <= 0:
            k = brentq(g, ks[i], ks[i + 1]); return EI * k * k
    raise RuntimeError('no root')

def weff_welded(h, b, tw, tf, fy):
    eps = math.sqrt(235 / fy); c = h - 2 * tf; psi = -1.0; ks = 23.9
    lp = (c / tw) / (28.4 * eps * math.sqrt(ks))
    rho = 1.0 if lp <= 0.5 + math.sqrt(0.085 - 0.055 * psi) else min(1.0, (lp - 0.055 * (3 + psi)) / lp ** 2)
    bc = c / (1 - psi); beff = rho * bc; be1 = 0.4 * beff; be2 = 0.6 * beff
    # parts measured from the compression face: (area, centroid depth, own I)
    parts = [(b * tf, tf / 2, b * tf ** 3 / 12),
             (tw * be1, tf + be1 / 2, tw * be1 ** 3 / 12),
             (tw * (be2 + c / 2), h - tf - (be2 + c / 2) / 2, tw * (be2 + c / 2) ** 3 / 12),
             (b * tf, h - tf / 2, b * tf ** 3 / 12)]
    A = sum(p[0] for p in parts); zc = sum(p[0] * p[1] for p in parts) / A
    I = sum(p[2] + p[0] * (p[1] - zc) ** 2 for p in parts)
    Iy = b * h ** 3 / 12 - (b - tw) * c ** 3 / 12
    return {'Weff': I / zc, 'Wel': Iy / (h / 2), 'rho': rho, 'lp': lp}

if __name__ == '__main__':
    import sys
    sec = json.loads(sys.argv[1])          # {Iz, It, Iw, h, tf, Iy, A}
    EIz, GJ, EIw = E * sec['Iz'], G * sec['It'], E * sec['Iw']
    out = {}
    L = 3000.0
    lamTop = ritz_cantilever(L, EIz, GJ, EIw, 1.0, sec['h'] / 2)
    lamSC = ritz_cantilever(L, EIz, GJ, EIw, 1.0, 0.0)
    out['cant_top_Mcr'] = lamTop * L
    out['cant_sc_Mcr'] = lamSC * L
    out['overhang_Ncrz_4000_3000'] = overhang_ncr(E * sec['Iz'], 4000.0, 3000.0)
    out['overhang_Ncry_4000_3000'] = overhang_ncr(E * sec['Iy'], 4000.0, 3000.0)
    i02 = (sec['Iy'] + sec['Iz']) / sec['A']
    # torsional analogue: EIw phi'''' + (N i0^2 - GIt) phi'' = 0 has the same characteristic equation with EI -> EIw
    out['overhang_NcrT_4000_3000'] = (GJ + overhang_ncr(EIw, 4000.0, 3000.0)) / i02
    out['cant_fixed_NcrT_3000'] = (GJ + math.pi ** 2 * EIw / (2 * L) ** 2) / i02
    out['pg'] = weff_welded(1200.0, 300.0, 8.0, 20.0, 345.0)   # fy for tf 20 mm S355 (EN 10025-2: 16 < t <= 40)
    print(json.dumps(out))
