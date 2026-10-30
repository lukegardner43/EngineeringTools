"""Emit the UKB/UKC section table as a compact JS literal, after the dimension cross-check.
Rows that fail the cross-check on a strength/stiffness property are excluded."""
import csv, sys
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '.')
from check import check

EXCLUDE = {'406 x 260 x 132'}   # tabulated mass inconsistent with dimensions and area - unresolved

def emit(path, series):
    rows, bad = check(path)
    out = []
    for r in rows:
        if r['desig'] in EXCLUDE:
            continue
        name = r['desig'].replace(' x ', '×') + ' ' + series
        vals = [r[k] for k in ('mass', 'h', 'b', 'tw', 'tf', 'r', 'A', 'Iy', 'Iz', 'Wely', 'Welz', 'Wply', 'Wplz', 'It', 'Iw')]
        vals = [str(float(v)).rstrip('0').rstrip('.') if '.' in v else v for v in vals]
        out.append(f"['{name}',{','.join(vals)}]")
    return out

def emit_pfc(path):
    # British Steel PFC datasheet (July 2026), cross-checked by grid integration of the section geometry (A, I, W, cy
    # within 1.5%) and thin-walled warping/torsion constants (Iw within 6%, It within 15%)
    import hollow_ref as H
    out = []
    for r in csv.DictReader(open(path)):
        f = {k: float(v) for k, v in r.items() if k != 'desig'}
        g = H.pfc_grid(f['h'], f['b'], f['tw'], f['tf'], f['r'], n=1500)
        calc = dict(A=g['A'] / 100, Iy=g['Iy'] / 1e4, Iz=g['Iz'] / 1e4, Wely=g['Wely'] / 1e3, Welz=g['Welz'] / 1e3,
                    Wply=g['Wply'] / 1e3, Wplz=g['Wplz'] / 1e3, cy=g['cy'] / 10)
        bp, hp = f['b'] - f['tw'] / 2, f['h'] - f['tf']
        calc['Iw'] = f['tf'] * bp ** 3 * hp ** 2 / 12 * (3 * bp * f['tf'] + 2 * hp * f['tw']) / (6 * bp * f['tf'] + hp * f['tw']) / 1e12
        calc['It'] = (2 * bp * f['tf'] ** 3 + hp * f['tw'] ** 3) / 3 / 1e4
        tol = dict(A=0.015, Iy=0.015, Iz=0.015, Wely=0.015, Welz=0.015, Wply=0.015, Wplz=0.015, cy=0.015, Iw=0.06, It=0.15)
        bad = [k for k in tol if abs(calc[k] / f[k] - 1) > tol[k]]
        if bad:
            print('PFC check failed', r['desig'], {k: (f[k], round(calc[k], 4)) for k in bad}, file=sys.stderr); continue
        name = r['desig'].replace(' x ', '×') + ' PFC'
        vals = [r[k] for k in ('mass', 'h', 'b', 'tw', 'tf', 'r', 'A', 'Iy', 'Iz', 'Wely', 'Welz', 'Wply', 'Wplz', 'It', 'Iw', 'cy')]
        vals = [str(float(v)).rstrip('0').rstrip('.') if '.' in v else v for v in vals]
        out.append(f"['{name}',{','.join(vals)}]")
    return out

lines = emit('ukb.csv', 'UKB') + emit('ukc.csv', 'UKC')
pfc = emit_pfc('pfc.csv')
print('// [designation, mass kg/m, h, b, tw, tf, r (mm), A cm2, Iy, Iz cm4, Wel,y, Wel,z, Wpl,y, Wpl,z cm3, It cm4, Iw dm6]')
print('const SECTION_DATA=[\n' + ',\n'.join(lines) + '\n];')
print('// PFC: as above + cy (cm, centroid from back of web)')
print('const PFC_DATA=[\n' + ',\n'.join(pfc) + '\n];')
print(f'// {len(lines)} I sections, {len(pfc)} channels', file=sys.stderr)
