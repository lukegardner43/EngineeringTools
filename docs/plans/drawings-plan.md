# Drawings plan (third group)

Rebuilt on 10 November 2026 from an audit of every live tool: each was opened, run with its default inputs, and its
drawings were looked at. The first two groups (and Bolt Group, Steel Column, Base Plate, Steel Beam and RC Beam) are
done; see the ROADMAP. Crane Gantry Girder has since been removed from the suite.

Each drawing is to scale from the inputs, uses the JD drafting kit (`joints/diagrams.js`), `drawings/kit.js` and one
module per tool, marks the governing check or location in red, sits under the verdict, redraws as the inputs change
where the engine is fast, and goes on the A4 sheet. `tests/drawings/test_drawings.js` sweeps each tool's inputs.

| # | Tool | What it shows now | To add |
|---|------|-------------------|--------|
| 1 (done) | Windpost Design | A line with wind arrows and the height | Elevation of the post in the panel with the masonry, the head and base fixings and the tie positions; the wind load with its value; the bending moment with M_Ed and the deflection against its limit; the section to scale with the masonry ties, cavity and orientation |
| 2 (done) | RC Stair Design | Flight profile and a bending moment curve | The flight to scale with waist, risers, goings and landing lengths dimensioned; the loads with their values; the main bars and distribution bars; the supports; the bending moment with M_Ed and M_Rd and the span/depth check |
| 3 (done) | RC Section Design Toolkit (bending, shear, deflection tabs) | A small section with bars and the neutral axis | Bending: the section beside the strain diagram (ε_cu2, ε_s, ε_s2) and the stress block with the forces and lever arm. Shear: the section with the links and legs, the truss model with θ, z and the strut, V_Ed against V_Rd,c, V_Rd,s and V_Rd,max. Deflection: the span with the basic and modified l/d and the factors |
| 4 (done) | RC Punching Shear | Control perimeters and link positions without values | Labels and dimensions on u_0, u_1 at 2d and u_out, edges or openings with the ineffective lengths, the link perimeters with s_r and the first perimeter distance; a section through the slab with d, the column, the links and the 2d / 1.5d / kd distances; v_Ed against v_Rd,c, v_Rd,cs and v_Rd,max |
| 5 (done) | RC Flat Slab Design | Elevation without load values, a shaded strip plan, the bare punching plan | Loads with values on the elevation; the plan of the strip with the column and middle strip widths dimensioned and the bars in each; the punching plan with the item 4 labels |
| 6 (done) | Snow Loading | Shape coefficients over the roof outline | Snow loads in kN/m² for each case with the drift lengths l_s and the slopes dimensioned; the undrifted and drifted cases side by side; for drifts, the obstruction or step height and h |
| 7 (done) | Beam Analysis | The model with loads as empty boxes | The loads with their type and values (G, Q, S, W), points and couples, springs and hinges, and the reactions after a run |
| 8 (done) | Wind Loading | Zone letters on the plan; one q_p on the windward face | c_pe and the net pressures in each zone (walls A to E, roof F to I), the zone widths dimensioned from e, the reference heights with q_p at each strip, and the overall force with its lever |
| 9 (done) | RC Wall Design | Section strip and the N–M chart | An elevation of the wall with its height, the restraints top and bottom, l_0, the loads and eccentricities, and the slenderness; for core walls, the plan with each wall's share of the wind and the centre of stiffness |
| 10 (done) | Section Properties | The shape and its axes | Dimensions on the shape, the centroid and shear centre with their offsets, the principal axes at α, and the elastic and plastic neutral axes |

Done when each tool's drawing answers what governs and why, the sweeps pass, and the ROADMAP records it.

All ten are done (November 2026). Notes on what was built: the windpost section has no cavity or leaf thickness (the tool has no input for them), and the
stair shows the main bars only (the tool has no input for distribution bars).

## Steel sections in CalcPad (planned, November 2026)

The steel tools' full calculations (all thirteen, November 2026) carry no drawing into CalcPad: the section, its
dimensions and the governing parts are only in the tool. Concrete sections already draw themselves live in CalcPad
from their own names (`SECTION(...)`, CalcPad ecee29e); steel should do the same. Two stages, the first now and the
second later.

**Stage 1: a live steel section (next).**

| Part | What it does |
|------|--------------|
| `STEEL(...)` in CalcPad (lukegardner43/calcpad) | A new plot line beside `SECTION` and `PUNCH`, redrawn from the values at every recalculation, saved, printed and sent to Word as a picture. Shapes: I and H (UKB, UKC, UBP, joists), PFC, RHS and SHS (hot-finished and cold-formed, with their corner radii), CHS, ASB and Slimflor (the plate below), and the Tee of a web opening. Drawn to scale with h, b, t_w, t_f and r dimensioned from the values; the y and z axes marked |
| Options | `axis:` the axis of bending, with the load's direction; `x:` the plastic or elastic neutral axis under the axial force; `class:` each compression part shaded with its c/t against the limit, the part that sets the class in red; `eff:` for Class 4, the ineffective parts of the web and flanges left out (from b_eff and ρ); `sc:` the shear centre and the warping stresses at the flange tips (Steel Beam Torsion, Hollowcore Support Beam) |
| The steel scripts | `steel/ec3script.js` writes the line from the calculation's own names once the section is classified (as the concrete scripts write `SECTION` after x_u), so every steel tool gets it; editing h, b or a thickness in CalcPad redraws the section |
| Graphs that are formulas | `PLOT` lines where the calculation already has the formula: the moment along the member in Steel Member Design (the end moments and the UDL, M_y,Ed(x)), the standard fire curve θ_g(t) to the period in Steel Member Fire Design, and the buckling curve χ(λ̄) with the member's λ̄ marked. Results of an analysis (the frame's and the beam's moment and shear diagrams, the steel temperature history) stay pictures, as the concrete tools do |
| Tests | Each steel `test_calcpad.js` checks every section it runs draws without an error, for every shape and option; the merged one-check `.perega` still opens |

Stage 1 changes no value: the section's properties (A, I_y, W_pl,y and the rest) are still the table's, so editing h
in CalcPad redraws the section but does not change A. CalcPad says so under the drawing.

**Stage 2: changing the section in CalcPad (later, not yet).**

| Part | What it does |
|------|--------------|
| `STEEL(457×191×67 UKB)` | The designation alone: the line looks the section up in the same tables the tools use and defines every dimension and property from it (h, b, t_w, t_f, r, A, I_y, I_z, W_el, W_pl, i, I_t, I_w, the mass), so changing the designation updates every value and redraws the section |
| Branches as formulas | What depends on the section becomes an IF formula rather than a fixed line: f_y by thickness, the class of each part, the buckling curve (h/b and t_f), the shear area of the shape, the λ̄_LT method and its β, the self-weight in the loads |
| Values from an analysis | M_cr from finite elements, the frame's moments and α_cr, the fire temperature from the time-stepping, the Tee areas of a web opening and the bimoment from the torsion analysis cannot follow a new section: CalcPad marks them stale ("worked for 457×191×67 UKB") when the designation changes, and the tool is where to run them again |

Done when every steel calculation draws its section live in CalcPad, the tests pass, and the ROADMAP records it.
Stage 2 waits until Luke asks for it.
