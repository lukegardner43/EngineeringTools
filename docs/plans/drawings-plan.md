# Drawings plan (third group)

Rebuilt on 10 November 2026 from an audit of every live tool: each was opened, run with its default inputs, and its
drawings were looked at. The first two groups (and Bolt Group, Steel Column, Base Plate, Steel Beam and RC Beam) are
done; see the ROADMAP. Crane Gantry Girder is deferred.

Each drawing is to scale from the inputs, uses the JD drafting kit (`joints/diagrams.js`), `drawings/kit.js` and one
module per tool, marks the governing check or location in red, sits under the verdict, redraws as the inputs change
where the engine is fast, and goes on the A4 sheet. `tests/drawings/test_drawings.js` sweeps each tool's inputs.

| # | Tool | What it shows now | To add |
|---|------|-------------------|--------|
| 1 (done) | Windpost Design | A line with wind arrows and the height | Elevation of the post in the panel with the masonry, the head and base fixings and the tie positions; the wind load with its value; the bending moment with M_Ed and the deflection against its limit; the section to scale with the masonry ties, cavity and orientation |
| 2 (done) | RC Stair Design | Flight profile and a bending moment curve | The flight to scale with waist, risers, goings and landing lengths dimensioned; the loads with their values; the main bars and distribution bars; the supports; the bending moment with M_Ed and M_Rd and the span/depth check |
| 3 (done) | RC Section Design Toolkit (bending, shear, deflection tabs) | A small section with bars and the neutral axis | Bending: the section beside the strain diagram (ε_cu2, ε_s, ε_s2) and the stress block with the forces and lever arm. Shear: the section with the links and legs, the truss model with θ, z and the strut, V_Ed against V_Rd,c, V_Rd,s and V_Rd,max. Deflection: the span with the basic and modified l/d and the factors |
| 4 | RC Punching Shear | Control perimeters and link positions without values | Labels and dimensions on u_0, u_1 at 2d and u_out, edges or openings with the ineffective lengths, the link perimeters with s_r and the first perimeter distance; a section through the slab with d, the column, the links and the 2d / 1.5d / kd distances; v_Ed against v_Rd,c, v_Rd,cs and v_Rd,max |
| 5 | RC Flat Slab Design | Elevation without load values, a shaded strip plan, the bare punching plan | Loads with values on the elevation; the plan of the strip with the column and middle strip widths dimensioned and the bars in each; the punching plan with the item 4 labels |
| 6 | Snow Loading | Shape coefficients over the roof outline | Snow loads in kN/m² for each case with the drift lengths l_s and the slopes dimensioned; the undrifted and drifted cases side by side; for drifts, the obstruction or step height and h |
| 7 | Beam Analysis | The model with loads as empty boxes | The loads with their type and values (G, Q, S, W), points and couples, springs and hinges, and the reactions after a run |
| 8 | Wind Loading | Zone letters on the plan; one q_p on the windward face | c_pe and the net pressures in each zone (walls A to E, roof F to I), the zone widths dimensioned from e, the reference heights with q_p at each strip, and the overall force with its lever |
| 9 | RC Wall Design | Section strip and the N–M chart | An elevation of the wall with its height, the restraints top and bottom, l_0, the loads and eccentricities, and the slenderness; for core walls, the plan with each wall's share of the wind and the centre of stiffness |
| 10 | Section Properties | The shape and its axes | Dimensions on the shape, the centroid and shear centre with their offsets, the principal axes at α, and the elastic and plastic neutral axes |

Done when each tool's drawing answers what governs and why, the sweeps pass, and the ROADMAP records it.

Notes on what was built: the windpost section has no cavity or leaf thickness (the tool has no input for them), and the
stair shows the main bars only (the tool has no input for distribution bars).
