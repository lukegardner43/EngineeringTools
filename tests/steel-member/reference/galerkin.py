"""Independent check of the LTB eigenproblem by a Galerkin sine-series (fork supports), numpy/scipy.
Energy: U = 1/2∫(EIz v''^2 + GJ phi'^2 + EIw phi''^2); V2 = -∫ M phi v'' - 1/2∫ q a phi^2 - 1/2 P a phi(xp)^2."""
import numpy as np
from scipy.linalg import eigh
import sys, json

def galerkin(L, EIz, GJ, EIw, M, q=None, P=None, a=0.0, N=30, nq=4000):
    x = np.linspace(0, L, nq + 1)
    w = np.full(nq + 1, L / nq); w[0] = w[-1] = L / nq / 2  # trapezoid
    k = np.arange(1, N + 1)[:, None] * np.pi / L
    S = np.sin(k * x)            # N x nq
    Sd2 = -(k ** 2) * S          # second derivative
    K = np.zeros((2 * N, 2 * N)); Kg = np.zeros((2 * N, 2 * N))
    kk = k[:, 0]
    # orthogonality on [0, L]: ∫ sin_i sin_j = L/2 δij
    K[:N, :N] = np.diag(EIz * kk ** 4 * L / 2)
    K[N:, N:] = np.diag((GJ * kk ** 2 + EIw * kk ** 4) * L / 2)
    Mx = M(x)
    C = (S * Mx * w) @ Sd2.T      # C[i,j] = ∫ M phi_i v''_j
    Kg[N:, :N] = C; Kg[:N, N:] = C.T
    if a:
        if q is not None:
            Kg[N:, N:] += (S * (q(x) * a) * w) @ S.T
        for (xp, Pv) in (P or []):
            s = np.sin(kk * xp); Kg[N:, N:] += Pv * a * np.outer(s, s)
    mu = eigh(Kg, K, eigvals_only=True)
    return 1 / mu.max()

if __name__ == '__main__':
    E, G = 210000, 81000
    # 457x191x67 UKB (British Steel): Iz 1452 cm4, It 38.7 cm4, Iw 0.705 dm6, h 453.4, tf 12.7
    Iz, It, Iw, h = 1452e4, 38.7e4, 0.705e12, 453.4
    EIz, GJ, EIw = E * Iz, G * It, E * Iw
    out = {}
    L = 4000
    Mu = galerkin(L, EIz, GJ, EIw, lambda x: np.ones_like(x))
    for psi in (0.5, 0, -0.5, -1):
        out[f'C1 psi={psi}'] = galerkin(L, EIz, GJ, EIw, lambda x, p=psi: 1 + (p - 1) * x / L) / Mu
    out['C1 UDL'] = galerkin(L, EIz, GJ, EIw, lambda x: x * (L - x) / 2 / (L * L / 8)) / Mu
    out['C1 point'] = galerkin(L, EIz, GJ, EIw, lambda x: np.where(x < L / 2, x, L - x) / (L / 2)) / Mu
    Lx = 3000
    out['Mcr point top L=3000'] = galerkin(Lx, EIz, GJ, EIw, lambda x: 0.5 * np.where(x < Lx / 2, x, Lx - x), P=[(Lx / 2, 1.0)], a=h / 2, N=60) * Lx / 4
    out['Mcr UDL top L=3000'] = galerkin(Lx, EIz, GJ, EIw, lambda x: x * (Lx - x) / 2, q=lambda x: np.ones_like(x), a=h / 2) * Lx * Lx / 8
    print(json.dumps({k: round(v, 5) if v < 100 else float(f'{v:.5e}') for k, v in out.items()}, indent=1))
