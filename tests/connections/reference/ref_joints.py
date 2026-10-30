"""Independent reference values for the joints engine (ConnectionCheck), written to ../ref_joints.json.
- T-stub (EN 1993-1-8 Table 6.2) re-implemented; effective lengths of bolt-row groups from Table 6.4 by enumeration of patterns.
- Base plate effective area by rasterising the set of points within Chebyshev distance c of the I-section, clipped to the plate.
- Base plate M_j,Rd by proportional loading of the two-component model to the first component resistance (statics, not Table 6.7).
- Fin plate / end plate tying, anchors and the RHS splice by hand formulae.
"""
import json, math, pathlib
import numpy as np
HERE = pathlib.Path(__file__).resolve().parent
GM0, GM2, GMU = 1.0, 1.25, 1.1

def tstub(l1, l2, t, f, m, n, Ft, nb, gm=GM0, prying=True):
    M1 = 0.25 * l1 * t * t * f / gm; M2 = 0.25 * l2 * t * t * f / gm; n = min(n, 1.25 * m)
    if prying:
        F1 = 4 * M1 / m; F2 = (2 * M2 + n * nb * Ft) / (m + n)
    else:
        F1 = 2 * M1 / m; F2 = math.inf
    return dict(F1=F1, F2=F2 if math.isfinite(F2) else None, F3=nb * Ft, F=min(F1, F2, nb * Ft))

def leff_rows(m, e, nr, p=0.0, e1=math.inf):
    # Table 6.4: every way of splitting the rows into consecutive groups; each group or individual row, mode 1 and 2
    ind_cp = min(2 * math.pi * m, math.pi * m + 2 * e1); ind_nc = min(4 * m + 1.25 * e, 2 * m + 0.625 * e + e1)
    in_cp, in_nc = 2 * math.pi * m, 4 * m + 1.25 * e
    if nr == 1: return min(ind_cp, ind_nc), ind_nc
    s1 = 2 * min(ind_cp, ind_nc) + (nr - 2) * min(in_cp, in_nc); s2 = 2 * ind_nc + (nr - 2) * in_nc
    g_cp = 2 * min(math.pi * m + p, 2 * e1 + p) + (nr - 2) * 2 * p
    g_nc = 2 * min(2 * m + 0.625 * e + 0.5 * p, e1 + 0.5 * p) + (nr - 2) * p
    return min(s1, g_cp, g_nc), min(s2, g_nc)

out = {}
# ---------------- T-stub spot values
out['tstub'] = [dict(args=a, **tstub(*a[:8], **a[8])) for a in [
    (200, 200, 15, 275, 40, 50, 0.9 * 800 * 245 / 1.25, 2, {}),
    (120, 160, 20, 355, 35, 30, 0.9 * 800 * 353 / 1.25, 2, {}),
    (150, 150, 25, 345, 60, 40, 0.9 * 400 * 561 / 1.25, 2, dict(prying=False)),
    (300, 300, 10, 410, 45, 60, 0.9 * 800 * 245 / 1.1, 6, dict(gm=1.1))]]
out['leff'] = [dict(args=[x if math.isfinite(x) else None for x in a], l=leff_rows(*a)) for a in [(40, 50, 3, 70, 40), (35.2, 60, 4, 70, math.inf), (30, 45, 1, 0, 50), (50, 40, 2, 90, 35)]]

# ---------------- fin plate tying: M20 8.8, n 3, p1 70, e1 50, e2p 50, e2w 40, tp 10, hp 200, tw 9.9, aw 8; S275 plate, S355 beam
d, d0, As, fub = 20, 22, 245, 800
n, p1, e1, e2p, e2w, tp, hp, tw, aw = 3, 70, 50, 50, 40, 10, 200, 9.9, 8
fyp, fup, fyb, fub_beam = 275, 410, 355, 470
Fv = 0.6 * fub * As / GMU
k1p = min(2.8 * e1 / d0 - 1.7, 1.4 * p1 / d0 - 1.7, 2.5); abp = min(e2p / (3 * d0), fub / fup, 1)
k1w = min(1.4 * p1 / d0 - 1.7, 2.5); abw = min(e2w / (3 * d0), fub / fub_beam, 1)
Nnet_p = 0.9 * (hp - n * d0) * tp * fup / GMU
Nbt_p = fup * ((n - 1) * (p1 - d0)) * tp / GMU + fyp * 2 * (e2p - d0 / 2) * tp / math.sqrt(3)
Ngr_p = hp * tp * fyp
Nnet_w = 0.9 * (hp - n * d0) * tw * fub_beam / GMU
Nbt_w = fub_beam * ((n - 1) * (p1 - d0)) * tw / GMU + fyb * 2 * (e2w - d0 / 2) * tw / math.sqrt(3)
Ngr_w = hp * tw * fyb
a = aw / math.sqrt(2); Nw = 2 * a * hp * min(fup, 410) / (math.sqrt(2) * 0.85 * 1.25)
out['fin'] = dict(bolts=n * Fv, bear_p=n * k1p * abp * fup * d * tp / GMU, bear_w=n * k1w * abw * fub_beam * d * tw / GMU,
                  plate=min(Nnet_p, Nbt_p, Ngr_p), web=min(Nnet_w, Nbt_w, Ngr_w), weld=Nw, tmax=0.5 * d)

# ---------------- end plate tying: M20 8.8, 3 rows p1 70, e1 40, gauge 90, ex 30, tp 10, hp 220, tw 9.9, aw 6, S275 plate, S355 beam;
# column flange 254x254x89 UKC (tf 17.3, tw 10.3, r 12.7, b 256.3), S355
g, ex, tpe, hpe, awe, nr, e1e = 90, 30, 10, 220, 6, 3, 40
m = (g - tw) / 2 - 0.8 * awe * math.sqrt(2)
l1, l2 = leff_rows(m, ex, nr, p1, e1e)
Ftu = 0.9 * fub * As / GMU
ep = tstub(l1, l2, tpe, fup, m, ex, Ftu, 2 * nr, gm=GMU)
mc = (g - 10.3) / 2 - 0.8 * 12.7; ec = (256.3 - g) / 2
lc1, lc2 = leff_rows(mc, ec, nr, p1)
cf = tstub(lc1, lc2, 17.3, 470, mc, ec, Ftu, 2 * nr, gm=GMU)
out['endplate'] = dict(m=m, l1=l1, l2=l2, plate=ep['F'], web=hpe * tw * fub_beam / GMU, weld=2 * awe / math.sqrt(2) * hpe * fup / (math.sqrt(2) * 0.85 * 1.25),
                       mc=mc, lc1=lc1, lc2=lc2, flange=cf['F'])

# ---------------- base plate: 254x254x73 UKC (h 254.1, b 254.6, tf 14.2, tw 8.6, r 12.7), plate 400 x 450 x 25 S275, C25/30, alpha 1.5
h, b, tf, tw_c, r = 254.1, 254.6, 14.2, 8.6, 12.7
B, D, t = 400.0, 450.0, 25.0
fy = 265.0   # S275, 16 < t <= 40
fcd = 0.85 * 25 / 1.5; fjd = 2 / 3 * 1.5 * fcd
c = t * math.sqrt(fy / (3 * fjd))
# raster: points within Chebyshev distance c of the I footprint (centred), inside the plate
dx = 0.25
xs = np.arange(-B / 2, B / 2, dx) + dx / 2; ys = np.arange(-D / 2, D / 2, dx) + dx / 2
X, Y = np.meshgrid(xs, ys)
def dist_rect(x0, x1, y0, y1):    # Chebyshev distance to an axis-aligned rectangle
    return np.maximum(np.maximum(x0 - X, X - x1), np.maximum(np.maximum(y0 - Y, Y - y1), 0)) if False else np.maximum(np.maximum(np.maximum(x0 - X, X - x1), 0), np.maximum(np.maximum(y0 - Y, Y - y1), 0))
top = dist_rect(-b / 2, b / 2, h / 2 - tf, h / 2); bot = dist_rect(-b / 2, b / 2, -h / 2, -h / 2 + tf); web = dist_rect(-tw_c / 2, tw_c / 2, -h / 2, h / 2)
mask = (top <= c) | (bot <= c) | (web <= c)
Aeff = mask.sum() * dx * dx
# bending: anchor bolts M24 8.8 (two per side, gauge 300) at 50 mm outside each flange face; flange weld 8 mm
ex_b, w, aw_b = 50.0, 300.0, 8.0
mx = ex_b - 0.8 * aw_b * math.sqrt(2); exT = (D - h) / 2 - ex_b; eT = (B - w) / 2
lcp = min(2 * math.pi * mx, math.pi * mx + w, math.pi * mx + 2 * eT)
lnc = min(4 * mx + 1.25 * exT, eT + 2 * mx + 0.625 * exT, 0.5 * B, 0.5 * w + 2 * mx + 0.625 * exT)
le = min(lcp, lnc)
Ftb = 0.9 * 800 * 353 / 1.25
tsb = tstub(le, lnc, t, fy, mx, exT, Ftb, 2, prying=False)
FT = min(tsb['F'], le * tw_c * 345 / 1.0)
ext = min(c, (D - h) / 2); FC = fjd * min(b + 2 * c, B) * (tf + c + ext)
zT, zC = h / 2 + ex_b, h / 2 - tf / 2; z = zT + zC
def mrd_prop(N, M):   # N compression +, M > 0: scale until a component reaches its resistance
    FtEd = (M - N * zC) / z; FcEd = (M + N * zT) / z
    if FtEd <= 0:   # both flanges in compression: left/right compression from statics about the two flange centres
        Fl = (N * zC - M) / (2 * zC); Fr = (N * zC + M) / (2 * zC)
        lam = min(FC / Fr if Fr > 0 else math.inf, FC / Fl if Fl > 0 else math.inf)
    else:
        lam = min(FT / FtEd, FC / FcEd if FcEd > 0 else math.inf)
    return lam * M
cases = [(500e3, 60e6), (200e3, 120e6), (0.0, 80e6), (800e3, 20e6), (-100e3, 40e6)]
out['base'] = dict(c=c, fjd=fjd, Aeff=Aeff, mx=mx, leff=le, lnc=lnc, Tplate=tsb['F'], FT=FT, FC=FC, zT=zT, zC=zC,
                   mrd=[dict(N=N, M=M, MRd=mrd_prop(N, M), FtEd=max(0.0, (M - N * zC) / z)) for N, M in cases])
# anchors: h_ef 300, d_h 60 (anchor plate), edge c 200 across the row, cracked, C25/30
hef, dh, cE = 300.0, 60.0, 200.0
N0 = 8.9 * math.sqrt(25) * hef ** 1.5; scr, ccr = 3 * hef, 1.5 * hef
AcN = (scr + min(w, scr)) * (ccr + min(cE, ccr)); psiS = min(1, 0.7 + 0.3 * cE / ccr); psiRe = min(1, 0.5 + hef / 200)
NRkc = N0 * AcN / scr ** 2 * psiS * psiRe
out['anchor'] = dict(NRdc=NRkc / 1.5, NRdp=7.5 * math.pi / 4 * (dh ** 2 - 24 ** 2) * 25 / 1.5, VRdcp=2 * NRkc / 1.5)

# ---------------- RHS splice: 200 x 200 x 10 S355, plates 25 S275 340 wide, 3 M24 8.8 per side, bolt 50 mm from the face, e 40, weld 8
mS = 50 - 0.8 * 8 * math.sqrt(2)
ts = tstub(min(340 / 2, 3 * math.pi * mS), 340 / 2, 25, 265, mS, 40, 0.9 * 800 * 353 / 1.25, 3)
out['splice'] = dict(m=mS, NRd=2 * ts['F'], modes=[ts['F1'], ts['F2'], ts['F3']], Npl=(2 * 400 * 10 - 400) * 355, weld=8 / math.sqrt(2) * 800 * 410 / (math.sqrt(2) * 0.9 * 1.25))
(HERE.parent / 'ref_joints.json').write_text(json.dumps(out, indent=1))
print(json.dumps(out['base'], indent=1)[:900]); print(out['fin']); print(out['endplate']); print(out['splice'])

# ---------------- steel to concrete: V 120 kN at e 80, T 75 kN, 2 rows x 2 M20 8.8 (p 200, g 150), plate 300 high, h_ef 150, d_h 35, C32/40 cracked
def s2c(V, e, T, rows, p, g, h, d, As, fuk, fyk, hef, dh, fck, cracked, c1, hm):
    zs = [h / 2 + ((rows - 1) / 2 - i) * p for i in range(rows)]
    M = V * e; sz2 = sum(z * z for z in zs)
    rowT = [T / rows + M * z / sz2 for z in zs]; Ntop = max(rowT) / 2; Ngrp = sum(max(0, t) for t in rowT)
    gN = max(1.4, 1.2 * fuk / fyk); gV = max(1.25, fuk / fyk) if (fuk <= 800 and fyk / fuk <= 0.8) else 1.5
    NRds = As * fuk / gN; VRds = (0.6 if fuk <= 500 else 0.5) * As * fuk / gV
    steel = (Ntop / NRds) ** 2 + (V / (2 * rows) / VRds) ** 2
    k1 = 8.9 if cracked else 12.7; scr, ccr = 3 * hef, 1.5 * hef
    N0 = k1 * math.sqrt(fck) * hef ** 1.5; nt = sum(1 for t in rowT if t > 1e-9)
    if c1 > 0:   # edge below the bottom row: projected area cut at c1 (<= c_cr,N) and psi_s,N
        AcN = (scr + min(g, scr)) * (ccr + max(0, nt - 1) * min(p, scr) + min(c1, ccr)); psiS = min(1, 0.7 + 0.3 * min(c1, ccr) / ccr)
    else:
        AcN = (scr + min(g, scr)) * (scr + max(0, nt - 1) * min(p, scr)); psiS = 1.0
    NRdc = N0 * AcN / scr ** 2 * psiS * min(1, 0.5 + hef / 200) / 1.5
    NRdp = (7.5 if cracked else 10.5) * math.pi / 4 * (dh ** 2 - d ** 2) * fck / 1.5
    VRdcp = 2 * N0 * ((scr + min(g, scr)) * (scr + (rows - 1) * min(p, scr))) / scr ** 2 * min(1, 0.5 + hef / 200) / 1.5
    VRdc = math.inf
    if c1 > 0:
        lf = min(hef, 12 * d); a = 0.1 * math.sqrt(lf / c1); bb = 0.1 * (d / c1) ** 0.2
        V0 = (1.7 if cracked else 2.4) * d ** a * lf ** bb * math.sqrt(fck) * c1 ** 1.5
        AcV = min(1.5 * c1, hm) * (3 * c1 + min(g, 3 * c1)); VRdc = V0 * AcV / (4.5 * c1 * c1) * max(1, math.sqrt(1.5 * c1 / hm)) / 1.5
    bN = max(Ngrp / NRdc, Ntop / NRdp); bV = max(V / VRdcp, V / VRdc if math.isfinite(VRdc) else 0)
    return dict(rowT=rowT, Ntop=Ntop, Ngrp=Ngrp, NRds=NRds, VRds=VRds, steel=steel, NRdc=NRdc, NRdp=NRdp, VRdcp=VRdcp, VRdc=VRdc if math.isfinite(VRdc) else None, inter=bN ** 1.5 + bV ** 1.5)
out['s2c'] = [s2c(120e3, 80, 75e3, 2, 200, 150, 300, 20, 245, 800, 640, 150, 35, 32, True, 0, 250),
              s2c(80e3, 60, 0, 3, 100, 120, 300, 16, 157, 400, 240, 120, 30, 30, False, 150, 200)]
(HERE.parent / 'ref_joints.json').write_text(json.dumps(out, indent=1))
print(out['s2c'])
