// Loads the engines out of "Timber 2D Frame Analysis and Design.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Timber 2D Frame Analysis and Design.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String, Set, Map, isFinite, Float64Array, Int32Array };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.EC5 = EC5; this.EC3 = EC3; this.Frame2D = Frame2D; this.TimberFrame = TimberFrame;', sandbox);
module.exports = { EC5: sandbox.EC5, EC3: sandbox.EC3, Frame2D: sandbox.Frame2D, TimberFrame: sandbox.TimberFrame };
