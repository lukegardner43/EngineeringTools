"""Cross-check tabulated I-section properties against values recomputed from dimensions.
Formulae: SCI P363 (Blue Book) explanatory notes for rolled I/H sections with root radii.
Units in: mm. Tabulated units: A cm2, I cm4, W cm3, i cm, It cm4, Iw dm6."""
import csv, math, sys, json

def props(h, b, tw, tf, r):
    As = (1 - math.pi / 4) * r * r              # area of one root fillet (spandrel)
    e = r * (10 - 3 * math.pi) / (12 - 3 * math.pi)  # centroid of spandrel from its corner
    Ic = (1 - 5 * math.pi / 16) * r**4 - As * e * e  # spandrel I about own centroid (verified by integration)
    hw = h - 2 * tf
    A = 2 * b * tf + hw * tw + 4 * As
    yf = h / 2 - tf - e
    Iy = (b * h**3 - (b - tw) * hw**3) / 12 + 4 * (Ic + As * yf * yf)
    zf = tw / 2 + e
    Iz = 2 * tf * b**3 / 12 + hw * tw**3 / 12 + 4 * (Ic + As * zf * zf)
    Wply = b * tf * (h - tf) + tw * hw**2 / 4 + 4 * As * yf
    Wplz = tf * b * b / 2 + hw * tw * tw / 4 + 4 * As * zf
    a1 = -0.042 + 0.2204 * tw / tf + 0.1355 * r / tf - 0.0865 * r * tw / tf**2 - 0.0725 * tw**2 / tf**2
    D1 = ((tf + r) ** 2 + tw * (r + tw / 4)) / (2 * r + tf)
    It = 2 / 3 * b * tf**3 + 1 / 3 * hw * tw**3 + 2 * a1 * D1**4 - 0.420 * tf**4
    hs = h - tf
    Iw = Iz * hs * hs / 4
    return dict(A=A / 1e2, Iy=Iy / 1e4, Iz=Iz / 1e4, Wely=Iy / (h / 2) / 1e3, Welz=Iz / (b / 2) / 1e3,
                Wply=Wply / 1e3, Wplz=Wplz / 1e3, It=It / 1e4, Iw=Iw / 1e12,
                iy=math.sqrt(Iy / A) / 10, iz=math.sqrt(Iz / A) / 10, mass=A * 7850 / 1e6)

TOL = dict(A=0.015, Iy=0.015, Iz=0.02, Wely=0.015, Welz=0.02, Wply=0.015, Wplz=0.02, It=0.06, Iw=0.03,
           iy=0.015, iz=0.02, mass=0.02)

def check(path):
    bad = []
    rows = list(csv.DictReader(open(path)))
    for row in rows:
        f = {k: float(v) for k, v in row.items() if k != 'desig'}
        c = props(f['h'], f['b'], f['tw'], f['tf'], f['r'])
        dcalc = f['h'] - 2 * f['tf'] - 2 * f['r']
        issues = []
        if abs(dcalc - f['d']) > 0.6:
            issues.append(f"d tab {f['d']} vs h-2tf-2r {dcalc:.1f}")
        for k, tol in TOL.items():
            t = f[k]
            # allow for tabulated rounding: half a unit in last place
            s = row[k]
            dec = len(s.split('.')[1]) if '.' in s else 0
            rnd = 0.5 * 10 ** (-dec)
            if abs(c[k] - t) > max(tol * abs(t), rnd * 1.01):
                issues.append(f"{k} tab {t} calc {c[k]:.4g} ({(c[k] - t) / t * 100:+.1f}%)")
        if issues:
            bad.append((row['desig'], issues))
    return rows, bad

if __name__ == '__main__':
    for p in sys.argv[1:]:
        rows, bad = check(p)
        print(f"== {p}: {len(rows)} rows, {len(bad)} with discrepancies")
        for d, iss in bad:
            print(' ', d, '|', '; '.join(iss))
