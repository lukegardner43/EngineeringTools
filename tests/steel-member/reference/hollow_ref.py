"""Independent hollow-section and channel properties by direct integration on a fine grid (numpy), for checking the
engine's closed-form EN 10210-2 / EN 10219-2 geometry and the British Steel PFC table. Corner radii:
hot-finished (EN 10210-2) ro = 1.5t, ri = 1.0t; cold-formed (EN 10219-2) ro = 2t (t<=6), 2.5t (6<t<=10), 3t (t>10), ri = ro - t."""
import numpy as np, math

def radii(t, cold):
    if not cold: return 1.5 * t, t
    ro = 2 * t if t <= 6 else 2.5 * t if t <= 10 else 3 * t
    return ro, ro - t

def rrect_mask(Y, Z, H, B, r):
    """inside a rounded rectangle centred at 0 (H along z, B along y), corner radius r"""
    ay, az = np.abs(Y), np.abs(Z)
    inside = (ay <= B / 2) & (az <= H / 2)
    cy, cz = B / 2 - r, H / 2 - r
    corner = (ay > cy) & (az > cz)
    return inside & ~(corner & ((ay - cy) ** 2 + (az - cz) ** 2 > r * r))

def rhs_grid(H, B, t, cold=False, n=3000):
    ro, ri = radii(t, cold)
    y = (np.arange(n) + 0.5) / n * B - B / 2; z = (np.arange(n) + 0.5) / n * H - H / 2
    Y, Z = np.meshgrid(y, z); dA = (B / n) * (H / n)
    m = rrect_mask(Y, Z, H, B, ro) & ~rrect_mask(Y, Z, H - 2 * t, B - 2 * t, ri)
    A = m.sum() * dA
    Iy = (Z ** 2 * m).sum() * dA; Iz = (Y ** 2 * m).sum() * dA
    Wply = (np.abs(Z) * m).sum() * dA; Wplz = (np.abs(Y) * m).sum() * dA
    # EN 10210-2 torsion (thin-walled closed section with mean corner radius)
    Rc = (ro + ri) / 2
    h = 2 * ((B - t) + (H - t)) - 2 * Rc * (4 - math.pi)
    Ah = (B - t) * (H - t) - Rc ** 2 * (4 - math.pi)
    K = 2 * Ah * t / h
    It = t ** 3 * h / 3 + 2 * K * Ah
    Wt = It / (t + K / t)
    return dict(A=A, Iy=Iy, Iz=Iz, Wely=Iy / (H / 2), Welz=Iz / (B / 2), Wply=Wply, Wplz=Wplz, It=It, Wt=Wt)

def pfc_grid(h, b, tw, tf, r, n=4000):
    """channel, web at y in [0, tw], flanges to y = b; parallel flanges, root radius r, no toe radius"""
    y = (np.arange(n) + 0.5) / n * b; z = (np.arange(n) + 0.5) / n * h - h / 2
    Y, Z = np.meshgrid(y, z); dA = (b / n) * (h / n)
    web = Y <= tw
    fl = np.abs(Z) >= h / 2 - tf
    # root fillets: square [tw, tw+r] x [h/2-tf-r, h/2-tf] minus disc centred at (tw+r, h/2-tf-r)
    az = np.abs(Z)
    sq = (Y > tw) & (Y <= tw + r) & (az < h / 2 - tf) & (az >= h / 2 - tf - r)
    fil = sq & ((Y - (tw + r)) ** 2 + (az - (h / 2 - tf - r)) ** 2 >= r * r)
    m = web | fl | fil
    A = m.sum() * dA
    cy = (Y * m).sum() * dA / A
    Iy = (Z ** 2 * m).sum() * dA; Iz = ((Y - cy) ** 2 * m).sum() * dA
    Wply = (np.abs(Z) * m).sum() * dA
    # plastic neutral axis for z-bending: equal-area line y = yp
    ys = np.sort(Y[m].ravel()); yp = ys[len(ys) // 2]
    Wplz = (np.abs(Y - yp) * m).sum() * dA
    return dict(A=A, cy=cy, Iy=Iy, Iz=Iz, Wely=Iy / (h / 2), Welz=Iz / (b - cy), Wply=Wply, Wplz=Wplz, yp=yp)

def chs(d, t):
    di = d - 2 * t
    I = math.pi / 64 * (d ** 4 - di ** 4)
    return dict(A=math.pi / 4 * (d ** 2 - di ** 2), I=I, Wel=2 * I / d, Wpl=(d ** 3 - di ** 3) / 6, It=2 * I, Wt=4 * I / d)


# ---------- exact polygon integration (corner arcs as many-sided polygons) ----------
def rrect_poly(H, B, r, nseg=400):
    """counter-clockwise vertices of a rounded rectangle centred at 0 (y horizontal, z vertical)"""
    pts = []
    for (cy, cz, a0) in ((B / 2 - r, H / 2 - r, 0.0), (-B / 2 + r, H / 2 - r, 0.5 * math.pi), (-B / 2 + r, -H / 2 + r, math.pi), (B / 2 - r, -H / 2 + r, 1.5 * math.pi)):
        for k in range(nseg + 1):
            a = a0 + 0.5 * math.pi * k / nseg
            pts.append((cy + r * math.cos(a), cz + r * math.sin(a)))
    return pts

def clip_above(pts, z0=0.0):
    """part of a convex polygon with z >= z0 (Sutherland-Hodgman on one edge)"""
    out = []
    for i in range(len(pts)):
        p, q = pts[i], pts[(i + 1) % len(pts)]
        pin, qin = p[1] >= z0, q[1] >= z0
        if pin: out.append(p)
        if pin != qin:
            t = (z0 - p[1]) / (q[1] - p[1]); out.append((p[0] + t * (q[0] - p[0]), z0))
    return out

def poly_props(pts):
    """area, first moments and second moments about the origin (shoelace / Green's theorem)"""
    A = Sy = Sz = Iyy = Izz = 0.0
    for i in range(len(pts)):
        y0, z0 = pts[i]; y1, z1 = pts[(i + 1) % len(pts)]
        c = y0 * z1 - y1 * z0
        A += c / 2; Sz += (y0 + y1) * c / 6; Sy += (z0 + z1) * c / 6
        Iyy += (z0 * z0 + z0 * z1 + z1 * z1) * c / 12; Izz += (y0 * y0 + y0 * y1 + y1 * y1) * c / 12
    return dict(A=A, Sy=Sy, Sz=Sz, Iy=Iyy, Iz=Izz)   # Sy = int z dA, Sz = int y dA

def rhs_poly(H, B, t, cold=False):
    ro, ri = radii(t, cold)
    o, i = rrect_poly(H, B, ro), rrect_poly(H - 2 * t, B - 2 * t, ri)
    po, pi_ = poly_props(o), poly_props(i)
    A = po['A'] - pi_['A']; Iy = po['Iy'] - pi_['Iy']; Iz = po['Iz'] - pi_['Iz']
    # plastic moduli: 2 x first moment of the half above the axis
    ho, hi = poly_props(clip_above(o)), poly_props(clip_above(i))
    rot = lambda pts: [(z, -y) for (y, z) in pts]          # rotate 90 degrees for the z-axis
    vo, vi = poly_props(clip_above(rot(o))), poly_props(clip_above(rot(i)))
    Wply = 2 * (ho['Sy'] - hi['Sy']); Wplz = 2 * (vo['Sy'] - vi['Sy'])
    Rc = (ro + ri) / 2
    h = 2 * ((B - t) + (H - t)) - 2 * Rc * (4 - math.pi)
    Ah = (B - t) * (H - t) - Rc ** 2 * (4 - math.pi)
    K = 2 * Ah * t / h; It = t ** 3 * h / 3 + 2 * K * Ah
    return dict(A=A, Iy=Iy, Iz=Iz, Wely=Iy / (H / 2), Welz=Iz / (B / 2), Wply=Wply, Wplz=Wplz, It=It, Wt=It / (t + K / t))
