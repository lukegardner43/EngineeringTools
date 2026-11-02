// Loads the engines out of "RC 2D Frame Analysis and Design.html" (EC2 core and section design, RC beam analysis and
// design, the 2D frame engine, the wall/column section model, the frame engine): tests run against the shipped page.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC 2D Frame Analysis and Design.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Set, Map, Object, Number, Error, JSON, Infinity, NaN, String, Boolean, parseFloat, isFinite, Float64Array, Int32Array, Uint8Array };
vm.createContext(sandbox);
vm.runInContext(m[1].replace(/if \(typeof module !== 'undefined'\)[^\n]*\n/g, '') + '\n;this.RCFrame = RCFrame; this.RCBeam = RCBeam; this.RCBeamDesign = RCBeamDesign; this.Frame2D = Frame2D; this.Wall = Wall; this.EC2 = EC2;', sandbox);
module.exports = { RCFrame: sandbox.RCFrame, RCBeam: sandbox.RCBeam, RCBeamDesign: sandbox.RCBeamDesign, Frame2D: sandbox.Frame2D, Wall: sandbox.Wall, EC2: sandbox.EC2 };
