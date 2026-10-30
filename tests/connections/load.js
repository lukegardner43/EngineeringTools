// Loads the joints engine out of ConnectionCheck.html.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'ConnectionCheck.html'), 'utf8');
const m = html.match(/<script id="joints-engine">([\s\S]*?)<\/script>/); if (!m) throw new Error('joints engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.Joints = Joints;', sandbox);
module.exports = { Joints: sandbox.Joints, html };
