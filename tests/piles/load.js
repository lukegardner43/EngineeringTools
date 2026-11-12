// Loads the pile engine out of "Piles and Pile Groups.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Piles and Pile Groups.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String, Float64Array };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.PileDesign = PileDesign;', sandbox);
module.exports = { PileDesign: sandbox.PileDesign };
