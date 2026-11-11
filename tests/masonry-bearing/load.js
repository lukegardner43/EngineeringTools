// Loads the EC6 core and the bearing engine out of "Masonry Bearing.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Masonry Bearing.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.EC6 = EC6; this.MasonryBearing = MasonryBearing;', sandbox);
module.exports = { EC6: sandbox.EC6, MasonryBearing: sandbox.MasonryBearing };
