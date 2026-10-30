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

lines = emit('ukb.csv', 'UKB') + emit('ukc.csv', 'UKC')
print('// [designation, mass kg/m, h, b, tw, tf, r (mm), A cm2, Iy, Iz cm4, Wel,y, Wel,z, Wpl,y, Wpl,z cm3, It cm4, Iw dm6]')
print('const SECTION_DATA=[\n' + ',\n'.join(lines) + '\n];')
print(f'// {len(lines)} sections', file=sys.stderr)
