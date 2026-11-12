// Loads the working platforms engine out of "Working Platforms.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Working Platforms.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.WorkingPlatform = WorkingPlatform;', sandbox);
module.exports = { WorkingPlatform: sandbox.WorkingPlatform };
