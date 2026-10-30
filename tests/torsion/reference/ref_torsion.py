"""Independent closed-form torsion solutions (numpy): EIw phi'''' - GIt phi'' = m on segments, homogeneous part
C1 + C2 x + C3 cosh(k x) + C4 sinh(k x), k^2 = GIt / EIw, particular -m x^2 / (2 GIt) for uniform m.
Boundary conditions: fork phi = phi'' = 0; fixed phi = phi' = 0; free phi'' = 0 and T = GIt phi' - EIw phi''' = applied end torque.
Point torque T0 at a: continuity of phi, phi', phi'' and a jump T(a+) - T(a-) = -T0. Writes ../ref_torsion.json."""
import json, math, pathlib
import numpy as np

def solve(L, EIw, GIt, ends, m=0.0, T0=0.0, a=None, xs=()):
    k = math.sqrt(GIt / EIw)
    segs = [(0.0, a), (a, L)] if (T0 and a is not None and 0 < a < L) else [(0.0, L)]
    ns = len(segs); N = 4 * ns
    def basis(x):   # rows: phi, phi', phi'', phi''' for coefficients [C1..C4]
        ch, sh = math.cosh(k * x), math.sinh(k * x)
        return np.array([[1, x, ch, sh], [0, 1, k * sh, k * ch], [0, 0, k * k * ch, k * k * sh], [0, 0, k ** 3 * sh, k ** 3 * ch]])
    def part(x):    # particular solution derivatives
        return np.array([-m * x * x / (2 * GIt), -m * x / GIt, -m / GIt, 0.0])
    Arows, b = [], []
    def put(seg, x, row_coeffs, rhs):
        r = np.zeros(N); r[4 * seg:4 * seg + 4] = row_coeffs; Arows.append(r); b.append(rhs)
    def T_row(x):   # torque GIt phi' - EIw phi''' as a coefficient row and its particular part
        B = basis(x); return GIt * B[1] - EIw * B[3], GIt * part(x)[1] - EIw * part(x)[3]
    tipT = T0 if (T0 and (a is None or a >= L)) else 0.0
    for end, x, seg in ((ends[0], 0.0, 0), (ends[1], L, ns - 1)):
        B, P = basis(x), part(x)
        if end in ('fork', 'fixed'): put(seg, x, B[0], -P[0])
        if end == 'fork': put(seg, x, B[2], -P[2])
        if end == 'fixed': put(seg, x, B[1], -P[1])
        if end == 'free':
            put(seg, x, B[2], -P[2]); r, p = T_row(x); put(seg, x, r, (tipT if x == L else 0.0) - p)
    if ns == 2:
        B, P = basis(a), part(a)
        for d in range(3):
            r = np.zeros(N); r[0:4] = B[d]; r[4:8] = -B[d]; Arows.append(r); b.append(0.0)
        r1, _ = T_row(a); r = np.zeros(N); r[0:4] = r1; r[4:8] = -r1; Arows.append(r); b.append(T0)   # T(a-) - T(a+) = T0
    C = np.linalg.solve(np.array(Arows), np.array(b))
    out = []
    for x in xs:
        seg = 0 if ns == 1 or x <= a else 1
        v = basis(x) @ C[4 * seg:4 * seg + 4] + part(x)
        out.append(dict(x=x, phi=v[0], d2=v[2], Tt=GIt * v[1], Tw=-EIw * v[3]))
    return out

def main():
    E, G = 210000.0, 81000.0
    # 457x191x67 UKB: It 37.1 cm4 (table 38.7 used by the JS engine via fromRow), Iw 0.705 dm6
    It, Iw = 38.7e4, 0.705e12
    EIw, GIt = E * Iw, G * It
    cases = []
    L = 6000.0
    xs = [0.0, 1500.0, 3000.0, 4500.0, 6000.0]
    for ends in (('fork', 'fork'), ('fixed', 'fixed'), ('fixed', 'fork')):
        cases.append(dict(name=f'uniform torque {ends}', L=L, ends=ends, m=10.0, pts=solve(L, EIw, GIt, ends, m=10.0, xs=xs)))
        cases.append(dict(name=f'point torque at 0.3L {ends}', L=L, ends=ends, T0=5e6, a=1800.0, pts=solve(L, EIw, GIt, ends, T0=5e6, a=1800.0, xs=[0.0, 900.0, 1800.0, 3600.0, 6000.0])))
    Lc = 3000.0
    cases.append(dict(name='cantilever, tip torque', L=Lc, ends=('fixed', 'free'), T0=2e6, a=Lc, pts=solve(Lc, EIw, GIt, ('fixed', 'free'), T0=2e6, a=Lc, xs=[0.0, 1500.0, 3000.0])))
    cases.append(dict(name='cantilever, uniform torque', L=Lc, ends=('fixed', 'free'), m=5.0, pts=solve(Lc, EIw, GIt, ('fixed', 'free'), m=5.0, xs=[0.0, 1500.0, 3000.0])))
    pathlib.Path(__file__).resolve().parent.parent.joinpath('ref_torsion.json').write_text(json.dumps(dict(EIw=EIw, GIt=GIt, cases=cases)))
    print(len(cases), 'torsion reference cases'); print(cases[0]['pts'][2])


if __name__ == '__main__':
    main()
