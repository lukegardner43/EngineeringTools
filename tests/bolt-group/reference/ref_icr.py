"""Independent instantaneous-centre solution (Crawford-Kulak curve R = Rult (1 - exp(-10 D))^0.55, Dmax = 0.34 in) by
scipy.optimize: for a vertical load P at eccentricity e from the group centroid, find the IC on the horizontal line through
the centroid (exact for vertical loads on a group symmetric about that line) such that vertical and moment equilibrium hold.
Writes ../ref_icr.json: [{rows, cols, p1, p2, e, C}]."""
import json, math, pathlib
from scipy.optimize import brentq

def C_of(rows, cols, p1, p2, e):
    pts = [(c * p2, r * p1) for r in range(rows) for c in range(cols)]
    yc = sum(p[0] for p in pts) / len(pts); zc = sum(p[1] for p in pts) / len(pts)
    pts = [(y - yc, z - zc) for y, z in pts]
    def resid(r0):          # IC at (-r0, 0) for a downward load at +e (clockwise moment)
        rs = [math.hypot(y + r0, z) for y, z in pts]; rmax = max(rs)
        R = [(1 - math.exp(-10 * 0.34 * r / rmax)) ** 0.55 for r in rs]
        Fz = sum(Ri * (y + r0) / r for Ri, r, (y, z) in zip(R, rs, pts))     # vertical components (|tangent z| = dy/r)
        M = sum(Ri * r for Ri, r in zip(R, rs))
        P = M / (e + r0)                                                      # moment equilibrium about the IC
        return P - Fz, P
    r0 = brentq(lambda r: resid(r)[0], 1e-6, 1e6)
    return resid(r0)[1]

out = []
for rows, cols, p1, p2 in [(4, 2, 70, 90), (3, 1, 75, 0), (6, 2, 70, 100), (5, 3, 80, 80)]:
    for e in [50, 150, 300, 600]:
        out.append(dict(rows=rows, cols=cols, p1=p1, p2=p2, e=e, C=C_of(rows, cols, p1, p2 if cols > 1 else 1, e)))
pathlib.Path(__file__).resolve().parent.parent.joinpath('ref_icr.json').write_text(json.dumps(out))
print(len(out), 'ICR cases'); print(out[:3])
