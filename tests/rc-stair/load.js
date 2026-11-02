// Loads the EC2 core, EC2Section and the stair engine out of "RC Stair Design.html": tests run against the shipped page.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Stair Design.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite };
vm.createContext(sandbox);
vm.runInContext(m[1].replace(/if \(typeof module !== 'undefined'\)[^\n]*\n/g, '') + '\n;this.Stair = Stair; this.EC2 = EC2; this.EC2Section = EC2Section;', sandbox);
module.exports = { Stair: sandbox.Stair, EC2: sandbox.EC2, EC2Section: sandbox.EC2Section };
