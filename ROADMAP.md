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

## Interface

All pages share one light style (`common/style.css` in the build sources): IBM Plex Sans, ink on a blue-grey ground with white cards, one blue (#1d5fbf) on the main data (envelopes, bars, utilisation), green or red only on the verdict and on a check that fails, and a near-black primary button. Each tool's title row is a photograph of its material (`img/`, from Wikimedia Commons, credits on the home page and in `img/CREDITS.md`); without the image folder the title row falls back to a plain dark band. The printed A4 calculation sheets are unchanged.

Status key: **Done** means it's in this repo with tests. **Partial** means an existing tool covers part of it. **Planned** means it isn't started.

## Batch 1: Steel, EN 1993 (complete, October 2026)

| Tedds entry | Module | Status | Basis |
|---|---|---|---|
| Steel Member Design | Steel Member Design | Done | EN 1993-1-1 6.2, 6.3, Annex A/B + UK NA; EN 1993-1-5 4.4, 5, 6, 7 |
| Steel Member Analysis & Design | Steel Beam Analysis & Design | Done | + EN 1990 combinations, vertical and horizontal loads |
| Steel Beam Analysis & Design | Steel Beam Analysis & Design | Done | separate page (split from Steel Member Design, October 2026): continuous spans, cantilevers (free end supports; a single member with a free end is fixed at the other), mechanism check, pattern loading, web bearing |
| Steel Column Design | Steel Member Design | Done | 6.3.1, 6.3.3 Annex A or B |
| Steel section classification | Steel Member Design / Steel Beam Analysis & Design | Done | Table 5.2 sheets 1-3 |
| Beam Analysis | Beam Analysis | Done | stiffness method; springs, hinges, EI per member; EN 1990 combinations |
| Section Properties Calculator | Section Properties | Done | exact polygon integrals; plastic moduli; principal axes; It, Iw, shear centre |
| Steel simple connection design | ConnectionCheck | Done | SCI P358 check lists incl. detailing, supporting element and tying (fin plates, end plates) |
| Steel beam splice design | ConnectionCheck (Moment End Plate, splice) | Done | bolted end plate splices, EN 1993-1-8 6.2.7 |
| Steel moment connection design (SCI P398) | ConnectionCheck (Moment End Plate) | Done | extended / flush end plates, beam to column flange; plastic row distribution, compression and panel shear limits |
| Steel column splice design | ConnectionCheck (Column Splice) | Done | bearing and non-bearing cover plate splices: EN 1993-1-8 6.2.7.1(13)/(14), packs, long joints, block tearing, tying |
| Column Base Plate Design | ConnectionCheck | Done | EN 1993-1-8 6.2.5 effective area, 6.2.8 / Table 6.7 bending, anchors to EN 1992-4 |
| Steel Column and Base Plate Design | Steel Column and Base Plate Design | Done | EN 1990 combinations; nominal moments of simple construction (100 mm from the face); EN 1993-1-1 member checks with NCCI SN048b; EN 1993-1-8 6.2.5 / Table 6.7 / 6.2.2 base; anchors to BS EN 1992-4 |
| Steel hollow section tension only splice design | ConnectionCheck (RHS Tension Splice) | Done | EN 1993-1-8 6.2.4 T-stubs; CHS flange splices not covered |
| Steel to Concrete Simple Connection Design | ConnectionCheck (Steel to Concrete) | Done | cast-in headed anchors, BS EN 1992-4 |
| Bolt Group Analysis | Bolt Group Analysis | Done | elastic and ICR methods; EN 1993-1-8 Table 3.4 |
| Steel Beam Torsion Design | Steel Beam Torsion | Done | SCI P385; EN 1993-6 Annex A interaction |
| Steel Masonry Support | Steel Masonry Support | Done | EN 1993-1-1, -1-4, -1-8; continuous angle, spanning angle, welded plate |
| Windpost design | Windpost Design | Done | EN 1993-1-1; carbon steel (stainless windposts not covered) |
| Steel Beam Supporting Hollowcore Slab Design | Hollowcore Support Beam | Done | P385 torsion + EC3; UKB / UKC / ASB / Slimflor |
| Steel 2D Analysis & Design | Steel Frame Design | Done | portal and multi-bay multi-storey frames; α<sub>cr</sub>, EHF, second-order P-Δ, member design |
| Crane gantry girder design | Crane Gantry Girder | Done | EN 1993-6 / EN 1991-3: moving wheels, cap channel, chord LTB, local wheel stresses, deflection, fatigue (λ by class) |
| Steel member fire resistance design | Steel Member Fire Design | Done | EN 1993-1-2: incremental heating (unprotected / board / spray), restrained and unrestrained beams, columns; intumescents not covered |
| Steel sheet piling design | Sheet Pile Wall | Done | cantilever (Blum) and single-propped (free earth) walls, DA1, layered soils and water; EN 1993-5 bending |
| Composite beam design (SCI P359) | Composite Beam Design | Done | EN 1994-1-1: simply supported UKB, decking ⟂ / ∥ or solid slab, partial shear connection, studs, slab shear, SLS and frequency |
| Steel and composite beams with web openings (SCI P355) | Beam Web Openings | Done | circular / rectangular / elongated openings, Vierendeel, web-posts (AD 418 / AD 419), construction stage, deflection |
| Floor vibration (SCI P354) | Floor Vibration | Done | simplified method: mode frequencies, modal mass, steady-state / transient response factor, VDV |

Steel Member Design (design actions) and Steel Beam Analysis & Design (spans, loads and combinations) are separate pages since October 2026, built from one template with the same engine. Together they cover:

- **Sections:** UKB, UKC, PFC (British Steel datasheets); SHS/RHS/CHS, hot-finished (BS EN 10210-2) and cold-formed (BS EN 10219-2); custom welded or rolled I.
- **Checks:** Class 4 effective sections, web bearing and buckling (EN 1993-1-5 section 6), horizontal (minor-axis) loads in Steel Beam Analysis & Design, and Annex A or Annex B interaction.

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
- Drawings (October 2026): the static hand-drawn diagrams are replaced by parametric, to-scale drafting views of every joint (elevation plus plan / section / view on plate) drawn from the current inputs: bolts, welds, packs, notches, dimension chains, labels and design actions, redrawn as inputs change, flagged in red where the geometry does not fit (e.g. bolts beyond the plate), kept beside the results and included in the PDF report.
- Column splices (October 2026): the legacy bearing-splice check (cover plates sized for V·L/2) is replaced by bearing and non-bearing cover plate splices on the joints engine: net flange tension M<sub>y</sub>/(h − t<sub>f</sub>) − N<sub>G</sub>/2, 25 % of the maximum compression (6.2.7.1(14)), the 6.2.7.1(13) minimum moments and shears for non-bearing splices, packs (3.6.1(12)), long joints (3.8), group bearing (3.7), block tearing, plate buckling across the joint (0.6L), division plates by 45° dispersion and vertical tying with γ<sub>Mu</sub> = 1.1. P358 chapter 6 is not in the public excerpt, so the P358 detailing minimums are not enforced beyond Table 3.3 and the flange plate width; external flange cover plates only.

Steel Frame Design covers / limits:
- Geometry from templates: single-bay portal (flat or pitched) and regular multi-bay, multi-storey grids with fixed or pinned bases and rigid or pinned beams; general node / member editing is not provided (2D Frame Analysis analyses arbitrary frames and trusses, without member design).
- α<sub>cr</sub> by the frame's elastic buckling eigenvalue; second-order P-Δ analysis (geometric stiffness, iterated) where α<sub>cr</sub> &lt; 10; sway imperfection by EHF (5.3.2); member bow imperfections are covered by the member checks (in-plane buckling length = member length).
- Haunches, tapered members, plastic analysis (SCI P397 / P399 portal design) and bracing are not covered.

2D Frame Analysis covers / limits (October 2026; scope from the public Tedds product description only, methods from the stiffness-method literature):
- Interactive model: draw nodes and members on a snapped grid, or generate trusses (Pratt / Howe / Warren, flat or pitched), portals, continuous beams and multi-storey frames; supports fixed, pinned, roller or spring in each direction; member end releases (both ends released = truss bar); UK sections (UKB / UKC / PFC / SHS / RHS / CHS) or custom A, I, E.
- Loads: nodal forces and moments, point loads and moments on members, full or partial trapezoidal loads in global, projected or local directions, self weight; load cases G / Q / S / W / A with automatic BS EN 1990 + UK NA combinations (6.10 or 6.10a/b, wind as an alternative leading action) or user combinations; ULS envelopes.
- Results: deflected shape, axial (colour bands), shear, bending moment (tension side) and reaction diagrams with a hover read-out; tables; A4 report.
- Linear elastic first-order analysis; optional second-order P-Δ by the consistent geometric stiffness, iterated per ULS combination; α<sub>cr</sub> per ULS combination from the exact member stiffness (Livesley stability functions) with the Wittrick–Williams eigenvalue count, so it is not a discretisation estimate. Bars pinned at both ends carry axial force and the string stiffness only, so they are not checked for buckling between their nodes (design them as struts). Shear deformation, member imperfections, P-δ within members in the second-order analysis, cables / tension-only members, moving loads and member design are not covered.
- Solver: skyline LDLᵀ with reverse Cuthill–McKee ordering, one factorisation for all first-order cases and combinations (a 231-node, 420-member frame analyses in about 0.4 s, with α<sub>cr</sub> in about 1 s).

Steel Column and Base Plate Design covers / limits (October 2026):
- One column length (base to the first restraint level), UKC or UKB, S275 / S355, with buckling length factors, equally spaced lateral restraints and Annex A or B interaction (the Steel Member Design engine).
- Characteristic actions in G, Q and W at the top: axial load, beam reactions on both flanges and both sides of the web (simple construction: applied at 100 mm from the face, NSC AD 404; the share of the net nominal moment taken by this length is an input, 1.0 below a roof), end moments about both axes, a UDL up the column about the major axis and an extra horizontal force at the base. Self-weight added at γ<sub>G</sub>.
- ULS combinations to BS EN 1990 + UK NA (6.10 or 6.10a/b), wind leading or accompanying and optionally reversed, G favourable where a variable action is present.
- NCCI SN048b simplified criterion N/N<sub>b,min,Rd</sub> + M<sub>y</sub>/M<sub>b,y,Rd</sub> + 1.5 M<sub>z</sub>/M<sub>cb,z,Rd</sub> ≤ 1 reported and counted only within its scope (Class 1-3 I/H, linear moments, ψ limits); the full 6.3.3 check always runs.
- Column base by the ConnectionCheck joints engine for N, M<sub>y</sub> and the resultant shear; a minor-axis base moment is flagged, not designed. Four cast-in anchors (one row outside each flange). The axial force at the base is taken over the full length in the member checks (conservative). Hollow-section columns, splices and the column above the restraint are not covered.

Crane Gantry Girder limits / open points:
- Two equal wheels per rail; single simple span; eccentric-wheel torsion and rail wear are not included; the web resistance to the wheel uses s<sub>s</sub> = l<sub>eff</sub> − 2t<sub>f</sub> (engineer to confirm).
- Fatigue λ values (BS EN 1991-3 Table 2.12) and the φ₂ parameters (Table 2.5) to be confirmed against the printed standard.

Composite Beam Design limits:
- Simply supported, uniformly loaded secondary beams (UKB, symmetric); no point loads, continuous or primary beams, web openings (P355), precast units or lightweight concrete.
- Effective width b₀ = 100 mm for pairs of studs, 0 for single studs; studs uniformly spaced; through-deck welding contribution (P<sub>pb,Rd</sub>) not used for discontinuous decking.
- k<sub>t</sub> / k<sub>l</sub> from EN 1994-1-1 6.6.4 with the Table 6.2 limits; confirm against the decking manufacturer's data and the SCI guidance for the stud position in the trough.
- The construction stage takes the decking (ribs perpendicular) as lateral restraint; for parallel decking the beam is checked for LTB between the supports with the wet load on the top flange.
- Natural frequency is the beam alone (f = 18/√δ); the floor-system frequency and response factor (SCI P354) are not calculated.

Beam Web Openings limits / basis:
- Simply supported rolled UKB / UKC; steel beams with the compression flange laterally restrained (no LTB check of the perforated beam); UDL (+ point loads for steel beams); unstiffened openings.
- P355 (2011) as published on SteelConstruction.info covers the method up to 3.4.1; Tee M–N–V resistances are therefore taken from first principles (fibre plastic interaction with ρ on the stem; elastic for Class 3, effective stem 14εt<sub>w</sub> for Class 4), and the local composite Vierendeel action M<sub>vc,Rd</sub> and the slab shear contribution are ignored (conservative).
- Web-post buckling lengths and bending follow AD 418 / AD 419 with buckling curve b (AD 418 permits curve a for rolled sections); the compression-Tee check over long openings follows the EN 1993-1-13 approach in the SCI NSC May 2024 article.
- Deflection adds the Vierendeel sway (fixed-ended Tees) and the reduced stiffness over each opening using the steel Tees only (no composite stiffening of the top Tee).

Floor Vibration limits / basis:
- P354 (2009) simplified method for regular steel-composite grids; the copy on SteelConstruction.info stops in section 6, so the section 7 expressions (L<sub>eff</sub> = 1.09(1.10)<sup>n<sub>y</sub>−1</sup>…, S = η(1.15)<sup>n<sub>x</sub>−1</sup>…, η, 0.1Q steady state, 185 transient, v = 1.67f<sub>p</sub>² − 4.83f<sub>p</sub> + 4.5) were taken from two independent published summaries that agree; confirm against the printed guide.
- Beams simply supported (no continuity factors); slab stiffness from the uncracked ribbed concrete section with the decking ignored (overridable); W<sub>b</sub> weighting (z-axis, offices); mode shape factors entered (default 1).
- Irregular grids, cantilevers, long-span or lightweight floors, rhythmic activity, stairs and sensitive equipment need a finite element assessment (P354 section 6).

Sheet Pile Wall limits:
- Limit equilibrium only (no soil-structure interaction / deflections); hydrostatic water (no seepage); Coulomb K<sub>a</sub>, K<sub>p</sub> with passive wall friction capped at φ′/3; multi-propped walls, berms, sloping ground, undrained (total stress) clays and overall stability are not covered; pile section properties are entered by the engineer.

Steel Masonry Support and Windpost limits:
- Fixings into the frame (channels, anchors) and wall ties are checked against the manufacturer's design resistances entered by the engineer.
- Stainless partial factors default to the EN 1993-1-4 recommended values (1.1 / 1.1 / 1.25) and are editable; confirm against the UK NA in use.
- Spanning masonry angles are carbon steel only; windposts are carbon steel only (stainless member buckling to EN 1993-1-4 is not implemented).

## Batch 2: Concrete and precast, EN 1992

Build order and the planned CalcPad round trip / EngineeringSuite repo: see [docs/plans/concrete-suite-plan.txt](docs/plans/concrete-suite-plan.txt). Every concrete tool is cross-checked against The Concrete Centre's Eurocode spreadsheets (TCC series, run in LibreOffice; the spreadsheets themselves are not in this repo).

| Tedds entry | Module | Status |
|---|---|---|
| RC Column Design | RC Column Design | Done (existing) |
| RC Design Toolkit; RC Beam Torsion Design | RC Section Design Toolkit | Done |
| RC Beam Design; RC Beam Analysis & Design | RC Beam Analysis & Design | Done |
| RC Slab Design | RC Slab Design (one-way continuous, two-way panels) | Done; ribbed slabs and the FEM plate tool to follow |
| RC Wall Design | RC wall | Planned (RC Crack Width covers early-age cracking) |
| RC Corbel Design; RC Nib Design | Corbels and nibs | Planned |
| RC Stair design | RC stair | Planned |
| RC 2D Analysis & Design | 2D frame + EC2 | Planned |
| Precast Concrete beam design | Precast beam | Partial (prestressed double-tee tool, not yet in this repo) |
| Precast Concrete Column / Wall / Stair Design | Precast members | Planned |
| Precast Concrete Hollowcore slab design | Hollowcore | Planned |
| Precast Concrete Bearing / Half-joint / Grouted Sleeve Splice Design | Precast connections | Planned |

RC Section Design Toolkit covers / limits:
- Rectangular and flanged beams (sagging or hogging) and slabs per metre: bending by the rectangular block with the x/d limit from δ (5.5(4)) or 0.45, compression steel where needed, resistance of the bars provided by strain compatibility, minimum and maximum steel, crack control by Tables 7.2N/7.3N with A<sub>s,min</sub> (7.1), span/depth (7.16 with the UK NA notes), shear with vertical links (6.2) and the bar spacing rules; torsion with shear on solid rectangles (6.3), calculated crack width in bending or axial tension (7.3.4), anchorage and laps (8.4, 8.7).
- Checked against The Concrete Centre TCC11 (RECT~BEAM, TEE~BEAM, SLAB, SHEAR) for 120 randomised cases. Quantities computed the same way agree to 1e-9 (A<sub>s,min</sub> to 1e-6, where TCC rounds f<sub>ctm</sub>). Method differences: TCC limits A<sub>s</sub> to 1.75 A<sub>s,req</sub> when finding σ<sub>s</sub>; with the stress block in the web TCC uses the simplified flange + web split (the tool integrates the block exactly, up to ~10% less steel); TCC takes ρ′ for deflection from the bars provided (the tool uses A<sub>s2,req</sub>); TCC's flanged SLS section is simplified; TCC extrapolates Table 7.3N below 160 N/mm² (the tool caps the spacing at 300 mm); TCC takes k for minimum crack steel from the beam width.
- Not covered: circular sections, N–M interaction (see RC Column Design), inclined links or bent-up bars, prestress, fire.

RC Beam Analysis & Design covers / limits:
- Continuous beams of up to any number of spans (T, L or rectangular, b<sub>eff</sub> by 5.3.2.1 or entered), end cantilevers, supports on columns (above and below, far ends fixed or pinned, no sway), knife edges or encastré; UDLs, point loads and partial UDLs as G or Q; self-weight. EN 1990 6.10 or 6.10a/b, UK NA patterns (all and alternate spans, optionally adjacent spans) with the same γ<sub>G</sub> on every span, 1.0 G<sub>k</sub> for minimum moments; elastic SLS envelopes.
- Redistribution (5.5): each support's peak reduced to δ × elastic, the other patterns moved by up to 1 − δ (the Concrete Centre method), the design envelope not below δ<sub>f</sub> × elastic; x/d from δ. Support design at the face (monolithic, ≥ 0.65 centreline) or centreline − F t/8 (knife edge), β<sub>1</sub> = 0.25 at monolithic ends; flanged spans, compression bars through supports; shear at each face with links and link zones; span/depth with σ<sub>s</sub> from the SLS analysis and ρ on b<sub>w</sub>d + (b<sub>eff</sub> − b<sub>w</sub>)h<sub>f</sub>; bar and link suggestions; curtailment by the shift rule and l<sub>bd</sub>.
- Checked against an independent frame model (1e-8) and The Concrete Centre TCC41 for 75 beams (analysis within TCC's truncated moment distribution, ~0.1%; design quantities to 1e-9). Method differences and two TCC41 v4.6 cell errors are listed in the test file.
- Not covered: sway frames, torsion (RC Section Design Toolkit), rigorous (curvature) deflection, axial load in the beam, bent-up bars, fire.

RC Slab Design covers / limits:
- One-way continuous slabs per metre on the RC beam analysis (supports on beams or walls, bearings, encastré, free ends; UDLs, line loads, partial UDLs; UK NA patterns and redistribution): bending, minimum and maximum steel, bar spacing (9.3.1.1), crack control, span/depth, shear without links, the 25% end-support top steel over 0.2L (9.3.1.2(2)), distribution steel, curtailment with a<sub>l</sub> = d, bar suggestions.
- Two-way panels by BS 8110-1 Tables 3.14 and 3.15 (restrained, corners held down) interpolated in l<sub>y</sub>/l<sub>x</sub>: both directions with their own d, edge moments, edge shears and reactions, span/depth on the short span, corner torsion steel.
- Checked against TCC31 (45 slabs) and TCC94 (the nine edge cases at l<sub>y</sub>/l<sub>x</sub> 1.0 to 2.0, within the tables' rounding).
- Not covered: ribbed and waffle slabs, flat slabs and punching (planned), FEM plates, point loads on two-way panels, openings.

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
| 2D Frame Analysis | 2D Frame Analysis | Done |
| Rolling load analysis | Analysis | Planned |

## Steel Member Design and Steel Beam Analysis & Design verification (`node tests/steel-member/run_all.js`)

The two pages are built from one template and carry the same engine; `tests/steel-member/ui_smoke.js` (jsdom, 29 checks) confirms the engines are identical, each page shows only its own inputs, calculates, prints and keeps its own saved inputs, and drives the end supports (free ends, the automatic fixed root of a single cantilever, overhangs, mechanisms refused, older saved states).

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
- **ConnectionCheck joints engine** (`node tests/connections/test_joints.js`): 156 checks (incl. three column splices: bearing, bearing with a division plate, non-bearing with packs) (incl. the published extended end plate example) against `reference/ref_joints.py`: T-stubs and Table 6.4 effective lengths re-implemented; base plate effective area by rasterising the Chebyshev offset of the column; M<sub>j,Rd</sub> (Table 6.7) against proportional loading of the two-component model; fin / end plate tying, anchors (cone, pull-out, pry-out, edge) and the RHS splice by hand. `tests/connections/ui_smoke.js` (jsdom) runs every joint type through the page.
- **Steel Frame Design** (`node tests/frame/test_frame.js`): 28 checks against `reference/ref_frame.py`: portal sway, moments and reactions by an independent numpy stiffness solver; α<sub>cr</sub> of fixed- and pinned-base portals against the exact stability-function characteristic equation (and a scipy FE eigen solution); second-order cantilever sway and moment against the exact solution; combinations, EHF; the frame member check against the Steel Beam Analysis & Design engine.
- **2D Frame Analysis** (`node tests/frame2d/test_frame2d.js`): 9804 checks against `reference/ref_frame2d.py` (an independent numpy stiffness solver with every member cut into 48 elements and releases by static condensation; the Pratt truss by the method of joints; three-span support moments by the three-moment equation): displacements, reactions and N / V / M / deflection along every member for every case and combination; Gerber hinge and spring support; second-order cantilever sway against the exact tan solution; α<sub>cr</sub> against Euler (cantilever, pinned strut, sway column), the clamped-guided column 4π²EI/L² (the clamped-member count), the propped cantilever (tan kL = kL), a portal with a rigid beam, and scipy eigen solutions of finely subdivided portal, multi-storey (pinned base, released beam end, self weight) and braced (truss bars, simple beams) frames; the stability functions against their series and the consistent geometric stiffness; EN 1990 combinations; mechanism and error messages. `tests/frame2d/ui_smoke.js` (jsdom): 33 page checks (drawing, wizards, releases, loads, views, undo, storage, report).
- **Steel Column and Base Plate Design** (`node tests/column-base/test_column_base.js`): 131 checks against `reference/ref_column_base.py`: the ULS combination sets (6.10 and 6.10a/b, wind one or both ways, G only); design actions with reactions, nominal moments × share, end moments, UDL, base shear and self-weight; N<sub>cr</sub>, χ<sub>y</sub>, χ<sub>z</sub>, χ<sub>T</sub> and N<sub>b,Rd</sub> for four UKC / UKB cases from the section table; FE M<sub>cr</sub>, χ<sub>LT,mod</sub> and M<sub>b,Rd</sub> under uniform moment against the closed form and the UK NA rolled-section rule; SN048b terms and each scope limit; the base plate effective area and N<sub>j,Rd</sub>, the wiring of N, M<sub>y</sub> and the resultant shear into the joints engine for every combination, anchor tension under uplift; errors. `tests/column-base/ui_smoke.js` (jsdom): 18 page checks.
- **RC Section Design Toolkit** (`node tests/rc-section/test_rc_section.js`): 1512 checks. The Concrete Centre TCC11 (RECT~BEAM, TEE~BEAM, SLAB, SHEAR; 120 randomised cases recalculated in LibreOffice, outputs only in `ref_tcc11.json`): d, x/d limit, z, A<sub>s</sub>, A<sub>s2</sub>, A<sub>s,min</sub>, ρ, basic l/d, F1, F2, σ<sub>s</sub> (characteristic and quasi-permanent), the Table 7.3N spacing, V<sub>Ed</sub> at d, k, ρ<sub>l</sub>, V<sub>Rd,c</sub>, ν, cot θ, V<sub>Rd,max</sub>, A<sub>sw</sub>/s and its minimum, s<sub>l,max</sub>; the documented method differences as bounds. Against `reference/ref_rc_section.py`: flanged sections with the block in the web by numerical integration of the block, strain-compatibility M<sub>Rd</sub> of rectangular and flanged sections with up to three layers, torsion (t<sub>ef</sub>, A<sub>k</sub>, u<sub>k</sub>, T<sub>Rd,c</sub>, T<sub>Rd,max</sub>, link and longitudinal steel), calculated crack width (x, σ<sub>s</sub>, h<sub>c,ef</sub>, ρ<sub>p,eff</sub>, ε<sub>sm</sub> − ε<sub>cm</sub>, s<sub>r,max</sub>, w<sub>k</sub>), anchorage and laps; clause identities and behaviour. `tests/rc-section/ui_smoke.js` (jsdom): 19 page checks.
- **RC Beam Analysis & Design** (`node tests/rc-beam/test_rc_beam.js`): 24667 checks. Against `reference/ref_rc_beam.py` (14 random beams as numpy frames with the columns as members, every load arrangement): end moments, reactions, elastic, redistributed, design and SLS envelopes, exact span maxima and the support design moments. Against The Concrete Centre TCC41 (75 beams recalculated in LibreOffice, outputs only, `ref_tcc41.json`): support moments per pattern, peaks, span moments and δ, reactions, support design moments, A<sub>s</sub>, V<sub>Ed</sub>, V<sub>Rd,c</sub>, V<sub>Rd,max</sub>, link spacing, SLS moments, σ<sub>s</sub>, ρ, basic and allowed l/d. Behaviour: closed forms, cantilevers, mechanisms, redistribution rules, suggestions and curtailment. `tests/rc-beam/ui_smoke.js` (jsdom): 18 page checks.
- **RC Slab Design** (`node tests/rc-slab/test_rc_slab.js`): 4398 checks. The Concrete Centre TCC31 (45 one-way slabs, outputs only): support and span moments, reactions, design moments, d, steel areas, shear and v<sub>Rd,c</sub>, σ<sub>s</sub>, basic and allowed l/d. TCC94: the Table 3.14 and 3.15 coefficients against TCC's formula values for the nine edge cases. Closed forms (simply supported and two-span strips, a line load by the three-moment equation, two-way moments, depths, edge shears, corner steel) and behaviour. `tests/rc-slab/ui_smoke.js` (jsdom): 19 page checks.
- **Steel Member Fire Design** (`node tests/fire/test_fire.js`): 39 checks: section factors; unprotected heating against scipy RK45 integration and protected heating against an independent fine-step loop (`reference/ref_fire.py`); critical temperature (4.22) against Table 4.1; reduction factors, restrained-beam and column resistances by hand; limiting temperature and protection sizing.
- **Crane Gantry Girder** (`node tests/gantry/test_gantry.js`): 25 checks: moving loads against closed forms, cap-channel section by parallel axes, φ₂, l<sub>eff</sub>, chord buckling, fatigue ranges.
- **Composite Beam Design** (`node tests/composite/test_composite.js`): 133 checks against `reference/ref_composite.py`: five full design cases (decking ⟂ with one or two studs, edge beam with alternate troughs, propped solid slab, parallel decking) with the plastic resistance by fibre integration of the true section shape including root fillets; PNA in the slab and the top flange against closed forms; stud resistances and k<sub>t</sub> / k<sub>l</sub> with the Table 6.2 limits; η<sub>min</sub>; construction M<sub>cr</sub> (load on the top flange) against the SN003 three-factor formula; partial interaction, propped and edge-beam branches. `tests/composite/ui_smoke.js` (jsdom): 15 page checks.
- **Beam Web Openings** (`node tests/webopen/test_webopen.js`): 181 checks: the published NSC May 2024 worked example (Tee area, centroid, axial and plastic resistances, M<sub>o,Rd</sub>, I<sub>T</sub>, Vierendeel moment, sway, M<sub>add</sub>, combined check 0.99); steel (circular, rectangular, elongated with eccentricity, point load) and composite cases, final and construction stages, against `reference/ref_webopen.py` (fibre model of the true section with root fillets, Tee M–N by bisection, composite net section by fibres, mid-span deflection by virtual work with scipy quad); validation and behaviour. `tests/webopen/ui_smoke.js` (jsdom): 19 page checks.
- **Floor Vibration** (`node tests/vibration/test_vibration.js`): 98 checks: four floors (open plan, walking path, high-frequency floor, non-composite primary with mode shape factors) against `reference/ref_vibration.py` (section properties by moments of area and strip integration, primary deflection by virtual work with scipy quad); η, W<sub>b</sub>, walking speed, caps and damping / path / mode-shape scaling. `tests/vibration/ui_smoke.js` (jsdom): 11 page checks.
- **Sheet Pile Wall** (`node tests/piling/test_piling.js`): 18 checks: Coulomb coefficients, Blum cantilever and free-earth propped walls against closed forms, water and effective stresses, DA1 combinations, section resistance.
- **Review fixes:** 31 checks (`test_fixes.js`). Most compare against `reference/ref_fixes.py`, which uses its own independent methods; the rest are hand values. They cover:
  - a destabilising tip load on a cantilever (Ritz solution);
  - flexural and torsional buckling of a span with an overhang (exact characteristic equation);
  - Weff of a plate girder with a Class 4 web (EN 1993-1-5 4.4);
  - sway-mode Cm = 0.9;
  - bending with shear on a web that needs a shear buckling check (EN 1993-1-5 7.1).

**Open point.** Table B.3, last row (−1 ≤ αh < 0, −1 ≤ ψ < 0), concentrated-load column. Copies are reported to print 0.90 − 0.10αh(1+2ψ), which does not meet the row above at ψ = 0. The engine takes the larger of the + and − readings, which is conservative either way. Confirm the cell against a printed BS EN 1993-1-1 + AC:2009.
