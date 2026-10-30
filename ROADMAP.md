# EngineeringTools roadmap: Eurocode (UK NA) calculation coverage

Target scope: the structural calculations in the public Tekla Tedds UK Eurocode library list
([support.tekla.com, 14 Oct 2025](https://support.tekla.com/doc/tekla-tedds/not-version-specific/lib_calculation_list_eurocodes)),
rebuilt independently as self-contained EngineeringTools modules.

## Clean-room rules

- **Scope** comes from the public calculation list only: names, not methods.
- **Methods** come from BS EN 1990 to 1997, their UK National Annexes, and published guidance (SCI, Concrete Centre, TRADA, IStructE), with clause references in the output.
- **Not used as input:** Tedds software, help text, report layouts, screenshots or outputs. Decompiling or reverse engineering Tedds is prohibited by the Trimble Tekla EULA (2024) cl. 4.11(d). Using Tedds to develop other software is prohibited by cl. 4.11(f).
- **Verification** is against published worked examples, closed-form results and independent reference implementations, kept as runnable tests under `tests/`.

## Scope

The UK list has 91 entries. Out of scope:

- 5 civils entries: drain and sewer design, open channel flow, stormwater drainage, cut and fill, slope stability.
- 4 non-calculation or proprietary entries: Tata Steel RoofDek, batch design, section sketch, co-ordinate conversion.

That leaves **82 structural entries**. Many share one engine. For example, the four steel member entries are a single EC3 member check behind different front ends.

Status key: **Done** means it's in this repo with tests. **Partial** means an existing tool covers part of it. **Planned** means it isn't started.

## Batch 1: Steel, EN 1993 (in progress)

| Tedds entry | Module | Status | Basis |
|---|---|---|---|
| Steel Member Design | Steel Member Design | Done | EN 1993-1-1 6.2, 6.3, Annex A/B + UK NA; EN 1993-1-5 4.4, 5, 6, 7 |
| Steel Member Analysis & Design | Steel Member Design | Done | + EN 1990 combinations, vertical and horizontal loads |
| Steel Beam Analysis & Design | Steel Member Design | Done | continuous spans, cantilevers, pattern loading, web bearing |
| Steel Column Design | Steel Member Design (member mode) | Done | 6.3.1, 6.3.3 Annex A or B |
| Steel section classification | Steel Member Design | Done | Table 5.2 sheets 1-3 |
| Beam Analysis | Beam Analysis | Done | stiffness method; springs, hinges, EI per member; EN 1990 combinations |
| Section Properties Calculator | Section Properties | Done | exact polygon integrals; plastic moduli; principal axes; It, Iw, shear centre |
| Steel simple connection design | ConnectionCheck | Done | SCI P358 check lists incl. detailing, supporting element and tying (fin plates, end plates) |
| Steel beam splice design | ConnectionCheck (Moment End Plate, splice) | Done | bolted end plate splices, EN 1993-1-8 6.2.7 |
| Steel moment connection design (SCI P398) | ConnectionCheck (Moment End Plate) | Done | extended / flush end plates, beam to column flange; plastic row distribution, compression and panel shear limits |
| Steel column splice design | ConnectionCheck | Partial (existing) | P358 splices |
| Column Base Plate Design | ConnectionCheck | Done | EN 1993-1-8 6.2.5 effective area, 6.2.8 / Table 6.7 bending, anchors to EN 1992-4 |
| Steel Column and Base Plate Design | Steel Member Design + base | Planned | |
| Steel hollow section tension only splice design | ConnectionCheck (RHS Tension Splice) | Done | EN 1993-1-8 6.2.4 T-stubs; CHS flange splices not covered |
| Steel to Concrete Simple Connection Design | ConnectionCheck (Steel to Concrete) | Done | cast-in headed anchors, BS EN 1992-4 |
| Bolt Group Analysis | Bolt Group Analysis | Done | elastic and ICR methods; EN 1993-1-8 Table 3.4 |
| Steel Beam Torsion Design | Steel Beam Torsion | Done | SCI P385; EN 1993-6 Annex A interaction |
| Steel Masonry Support | Steel Masonry Support | Done | EN 1993-1-1, -1-4, -1-8; continuous angle, spanning angle, welded plate |
| Windpost design | Windpost Design | Done | EN 1993-1-1; carbon steel (stainless windposts not covered) |
| Steel Beam Supporting Hollowcore Slab Design | Hollowcore Support Beam | Done | P385 torsion + EC3; UKB / UKC / ASB / Slimflor |
| Steel 2D Analysis & Design | 2D frame + EC3 | Planned | frame solver, 5.2 imperfections |
| Crane gantry girder design | Crane girder | Planned | EN 1993-6, EN 1991-3 |
| Steel member fire resistance design | Steel fire | Planned | EN 1993-1-2 |
| Steel sheet piling design | Sheet piling | Planned | EN 1997-1, EN 1993-5 |

Steel Member Design covers:

- **Sections:** UKB, UKC, PFC (British Steel datasheets); SHS/RHS/CHS, hot-finished (BS EN 10210-2) and cold-formed (BS EN 10219-2); custom welded or rolled I.
- **Checks:** Class 4 effective sections, web bearing and buckling (EN 1993-1-5 section 6), horizontal (minor-axis) loads in beam mode, and Annex A or Annex B interaction.

Limits:
- Angles and tees are not covered.
- Class 4 flanges of I sections and channels, and Class 4 CHS (EN 1993-1-6), are rejected rather than designed.
- Hollow-section wall bearing is not checked.
- Torsion from eccentric loading (for example channels loaded in the web plane) belongs to the torsion module.

Hollowcore Support Beam covers:

- **Sections:** UKB / UKC (planks on the top or bottom flange), ASB (British Steel datasheet, planks on the bottom flange), Slimflor (UKC with a welded bottom plate, planks on the plate).
- **Stages:** 1 planks on one side; 2 both sides with wet topping and construction load on either or both sides (beam unrestrained, P385 torsion, M<sub>cr</sub> with load height and z<sub>j</sub>); 3 final, restrained (6.2.5, 6.2.6, 6.2.8), with an option to check out-of-balance torsion on the beam alone.
- **Local:** plank bearing length, transverse bending of the bearing flange / plate with the coexistent longitudinal stress, Slimflor plate welds.

Limits:
- Simply supported single spans with uniform plank loads; no point loads on the beam.
- Non-composite; composite action (P359) is a separate module.
- Slimflor weld prying uses a simple elastic estimate (Q = 6m/b) and should be confirmed by the engineer for unusual plate proportions.

ConnectionCheck audit (October 2026):
- Material f<sub>u</sub> corrected to the BS EN 10025-2 lower bound used by the UK NA (S275 410, S355 470 N/mm²; previously 430 / 490).
- Added P358 detailing (fin plate ductility t<sub>p</sub> ≤ 0.5d / 0.42d, depth ≥ 0.6h<sub>b</sub>), supporting element (local shear, punching) and structural integrity (tying) checks with γ<sub>Mu</sub> = 1.1: bolts, bearing, plate and web tension, welds, end plate and column flange T-stubs.
- Base plate rewritten to EN 1993-1-8 6.2.5 / 6.2.8 with EN 1992-4 anchors; new joint types: RHS tension splice and steel to concrete.
- Section table replaced with the British Steel datasheet (the legacy table had cross-section areas up to 40 % wrong and wrong root radii).
- Moment end plates (P398): verified against a published worked example (HEB 140 / IPE 220, extended end plate: every component, row forces and M<sub>j,Rd</sub> = 34.91 kNm). α (Figure 6.11) is entered by the engineer; without it the unstiffened yield patterns are used, which is conservative. Joint stiffness S<sub>j,ini</sub> and classification are not yet calculated; stiffened columns are limited to a compression stiffener.
- Open: column web tying (yield line) for fin plates on column webs is not checked; anchor splitting / blow-out and supplementary reinforcement are not considered.

Steel Masonry Support and Windpost limits:
- Fixings into the frame (channels, anchors) and wall ties are checked against the manufacturer's design resistances entered by the engineer.
- Stainless partial factors default to the EN 1993-1-4 recommended values (1.1 / 1.1 / 1.25) and are editable; confirm against the UK NA in use.
- Spanning masonry angles are carbon steel only; windposts are carbon steel only (stainless member buckling to EN 1993-1-4 is not implemented).

## Batch 2: Concrete and precast, EN 1992

| Tedds entry | Module | Status |
|---|---|---|
| RC Column Design | RC Column Design | Done (existing) |
| RC Beam Design; RC Beam Analysis & Design; RC Beam Torsion Design; RC Design Toolkit | RC beam | Planned |
| RC Slab Design | RC slab | Partial (FEM plate tool, not yet in this repo) |
| RC Wall Design | RC wall | Planned (RC Crack Width covers early-age cracking) |
| RC Corbel Design; RC Nib Design | Corbels and nibs | Planned |
| RC Stair design | RC stair | Planned |
| RC 2D Analysis & Design | 2D frame + EC2 | Planned |
| Precast Concrete beam design | Precast beam | Partial (prestressed double-tee tool, not yet in this repo) |
| Precast Concrete Column / Wall / Stair Design | Precast members | Planned |
| Precast Concrete Hollowcore slab design | Hollowcore | Planned |
| Precast Concrete Bearing / Half-joint / Grouted Sleeve Splice Design | Precast connections | Planned |

## Batch 3: Timber and masonry, EN 1995 and EN 1996

| Tedds entry | Module | Status |
|---|---|---|
| Timber Member Design; Timber Member A&D; Timber Beam A&D; Timber joist; Timber rafter; Timber stud | Timber member | Planned |
| Flitch, Glulam, Composite LVL Beam / Member A&D (6 entries) | Timber member (product sets) | Planned |
| Timber 2D analysis & design | 2D frame + EC5 | Planned |
| Cross-laminated timber section properties / section design / floor panel / wall panel | CLT | Planned |
| Timber Connection Design | EC5 connections | Partial (ec5-connection-designer, not yet in this repo) |
| Timber Frame Racking Panel Design; Timber Frame Racking Loads | Racking | Planned |
| Masonry Bearing Design; Masonry Column Design; Masonry Wall Panel Design | Masonry | Planned |

## Batch 4: Foundations, retaining, loading and analysis, EN 1991 and EN 1997

| Tedds entry | Module | Status |
|---|---|---|
| Foundation Analysis & Design; Bearing Pressures for Rectangular Footings | Pad foundation | Planned |
| RC raft foundation; RC pile cap design | Raft / pile cap | Planned |
| Pile Analysis; Pile Group Analysis | Piles | Planned |
| Retaining Wall Analysis & Design; Retaining basement wall analysis & design; Gabion Retaining Wall | Retaining walls | Planned |
| Wind Loading; Snow Loading | EC1 loading | Planned |
| Dead Loading; Hipped End Loading | Load take-down | Planned |
| Rigid Diaphragm Force Distribution | Diaphragm | Planned |
| Outrigger loading design | Outrigger (TWf) | Planned |
| 2D Frame Analysis; Rolling load analysis | Analysis | Planned |

## Steel Member Design verification (`node tests/steel-member/run_all.js`)

- **Beam analysis:** 30 closed-form checks (simply supported, fixed, propped, continuous, cantilever, couples, triangular load, three-span coefficients).
- **Mcr:** finite-element solution against the closed-form uniform-moment result, against an independent Galerkin solution (`reference/galerkin.py`), against the exact tension-flange-restraint solution, and against the classical cantilever result.
- **EC3 clause chain:** 1980 comparisons against an independent Python implementation (`reference/ref_ec3.py`) covering 400 random cross-section states, 100 flexural buckling cases and 40 LTB cases. Plus four hand-calculated design cases.
- **Screening:** the Mcr screening bound gives results identical to exhaustive solution on 40 random continuous beams.
- **Section data:** `reference/check.py` recomputes every tabulated property from the dimensions. 406x260x132 UKB is excluded because its tabulated mass contradicts its geometry.
- **Shapes:** 2653 checks (`test_shapes.js`) against `reference/ref_shapes.py`. The reference uses exact polygon and polar integration and independent implementations of Class 4 sections and N-M interaction. Published data checks: Tata Celsius SHS and British Steel PFC.
- **Web bearing:** 154 checks (`test_bearing.js`) against `reference/ref_bearing.py`, plus a hand calculation.
- **Biaxial / horizontal loads:** 19 hand-value checks (`test_biaxial.js`).
- **Annex A:** 32 checks (`test_annexA.js`) against the published intermediate values of ECCS TC8 No. 119 Worked Example 5, IPE 500 (as reproduced in SCIA benchmark 21). This includes Czz as corrected by AC:2009.
- **Beam Analysis** (`node tests/beam-analysis/test_beam_analysis.js`): 35 closed-form checks. They cover simply supported, cantilever, propped, fixed-fixed and two-span beams; stepped EI; a vertical spring; a Gerber beam with a hinge; a rotational spring; triangular load; mechanism detection; and the EN 1990 combinations and pattern loading.
- **Section Properties** (`node tests/section-props/test_section_props.js`): 471 checks. They cover closed forms, British Steel UKB/UKC/PFC and Tata SHS tables, BS EN 10056-1 angle values, cross-checks against the EC3 hollow-section engine, and a grid integration of the monosymmetry integral.
- **Bolt Group Analysis** (`node tests/bolt-group/test_bolt_group.js`): 38 checks. Elastic distribution and EN 1993-1-8 resistances against hand calculations; ICR against an independent scipy solution (`reference/ref_icr.py`).
- **Steel Beam Torsion** (`node tests/torsion/test_torsion.js`): 139 checks. FE torsion against closed-form ODE solutions (`reference/ref_torsion.py`) for fork, warping-fixed and cantilever ends; I and channel sectorial properties against integration; stresses and the Annex A interaction by hand.
- **Hollowcore Support Beam** (`node tests/hollowcore/test_hollowcore.js`): 133 checks against `reference/ref_hollowcore.py`:
  - ASB datasheet values (British Steel, 21.07.26) against the nominal geometry by independent strip integration; Slimflor (UKC + plate) properties, shear centre, I<sub>w</sub> and z<sub>j</sub>;
  - M<sub>cr</sub> with load height and the Wagner (monosymmetry) term against a Rayleigh-Ritz sine series;
  - the transverse plastic moment of a plate under longitudinal stress against linear programming over fibres;
  - a full UKB design case (final stage, deflections, stage 1 torsion against the closed-form ODE solution, local flange bending) and the Slimflor weld forces by hand;
  - classification of every UKB / UKC against the EC3 engine, and behaviour (edge beam, bearing errors, warnings, final-stage torsion option).
- **Steel Masonry Support** (`node tests/masonry/test_masonry.js`): 65 checks against `reference/ref_masonry.py`: angle properties (hot-rolled and cold-formed) by a 2D occupancy grid and the BS EN 10056-1 datasheet; the continuous-angle deflection against a 2D frame FE; the stainless secant modulus by Ramberg-Osgood; spanning angle, plate, weld and fixing forces by hand.
- **Windpost Design** (`node tests/windpost/test_windpost.js`): 24 checks: wind load, moments, shear, deflection, reactions and tie forces by hand; M<sub>cr</sub> against the C1 closed form; cantilever, RHS orientation and CHS behaviour.
- **ConnectionCheck joints engine** (`node tests/connections/test_joints.js`): 112 checks (incl. the published extended end plate example) against `reference/ref_joints.py`: T-stubs and Table 6.4 effective lengths re-implemented; base plate effective area by rasterising the Chebyshev offset of the column; M<sub>j,Rd</sub> (Table 6.7) against proportional loading of the two-component model; fin / end plate tying, anchors (cone, pull-out, pry-out, edge) and the RHS splice by hand. `tests/connections/ui_smoke.js` (jsdom) runs every joint type through the page.
- **Review fixes:** 31 checks (`test_fixes.js`). Most compare against `reference/ref_fixes.py`, which uses its own independent methods; the rest are hand values. They cover:
  - a destabilising tip load on a cantilever (Ritz solution);
  - flexural and torsional buckling of a span with an overhang (exact characteristic equation);
  - Weff of a plate girder with a Class 4 web (EN 1993-1-5 4.4);
  - sway-mode Cm = 0.9;
  - bending with shear on a web that needs a shear buckling check (EN 1993-1-5 7.1).

**Open point.** Table B.3, last row (−1 ≤ αh < 0, −1 ≤ ψ < 0), concentrated-load column. Copies are reported to print 0.90 − 0.10αh(1+2ψ), which does not meet the row above at ψ = 0. The engine takes the larger of the + and − readings, which is conservative either way. Confirm the cell against a printed BS EN 1993-1-1 + AC:2009.
