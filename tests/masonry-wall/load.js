// Loads the EC6 core, the lateral tables and the wall engine out of "Masonry Wall Panel.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Masonry Wall Panel.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.EC6 = EC6; this.EC6Lateral = EC6Lateral; this.MasonryWall = MasonryWall;', sandbox);
module.exports = { EC6: sandbox.EC6, EC6Lateral: sandbox.EC6Lateral, MasonryWall: sandbox.MasonryWall };
