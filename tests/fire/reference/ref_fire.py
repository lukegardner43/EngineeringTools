"""Independent reference for the fire engine (scipy), written to ../ref_fire.json.
- Unprotected steel heating: dtheta/dt = k_sh (A_m/V) h_net / (c_a rho) integrated with solve_ivp (RK45, tight tolerance).
- Protected steel: the EN 1993-1-2 (4.27) increment integrated with a fine 0.25 s step in an independent loop.
- Critical temperatures (4.22) against BS EN 1993-1-2 Table 4.1.
"""
import json, math, pathlib
import numpy as np
from scipy.integrate import solve_ivp
HERE = pathlib.Path(__file__).resolve().parent
iso = lambda t: 20 + 345 * math.log10(8 * t / 60 + 1)
def ca(th):
    if th < 600: return 425 + 0.773 * th - 1.69e-3 * th ** 2 + 2.22e-6 * th ** 3
    if th < 735: return 666 + 13002 / (738 - th)
    if th < 900: return 545 + 17820 / (th - 731)
    return 650.0
def unprot(AmV, ksh, times):
    f = lambda t, y: [ksh * AmV / (ca(y[0]) * 7850) * (25 * (iso(t) - y[0]) + 0.7 * 5.67e-8 * ((iso(t) + 273) ** 4 - (y[0] + 273) ** 4))]
    sol = solve_ivp(f, (0, max(times)), [20.0], t_eval=times, rtol=1e-9, atol=1e-9, max_step=5)
    return list(sol.y[0])
def prot(ApV, dp, lp, cp, rp, times, dt=0.25):
    ta, t, out, k = 20.0, 0.0, [], 0
    ts = sorted(times)
    while k < len(ts):
        g0, g1 = iso(t), iso(t + dt)
        phi = cp * rp / (ca(ta) * 7850) * dp * ApV
        d = lp / dp * ApV / (ca(ta) * 7850) * (g1 - ta) / (1 + phi / 3) * dt - (math.exp(phi / 10) - 1) * (g1 - g0)
        if d < 0 and g1 > g0: d = 0
        ta += d; t += dt
        while k < len(ts) and t >= ts[k] - 1e-9: out.append(ta); k += 1
    return out
# 457x191x67 UKB, 3 sides: profile and box factors (perimeter formula with root fillets)
h, b, tw, tf, r, A = 453.4, 189.9, 8.5, 12.7, 12.7, 8600.0
prof3 = (2 * h + 4 * b - 2 * tw + (2 * math.pi - 8) * r - b) / 1000 / (A / 1e6)
box3 = (2 * h + b) / 1000 / (A / 1e6)
times = [600.0, 900.0, 1800.0, 3600.0]
out = dict(times=times, prof3=prof3, box3=box3, ksh=0.9 * box3 / prof3,
           unprot=unprot(prof3, 0.9 * box3 / prof3, times),
           prot=prot(box3, 0.020, 0.15, 1200.0, 800.0, times + [5400.0]))
out['table41'] = [[0.22, 711], [0.26, 685], [0.30, 664], [0.34, 645], [0.38, 628], [0.42, 612], [0.46, 598], [0.50, 585], [0.54, 572], [0.58, 560], [0.62, 549],
                  [0.66, 537], [0.70, 526], [0.74, 514], [0.78, 502], [0.82, 489], [0.86, 475], [0.90, 459]]   # BS EN 1993-1-2 Table 4.1 (rounded, from (4.22))
(HERE.parent / 'ref_fire.json').write_text(json.dumps(out, indent=1))
print(out)
