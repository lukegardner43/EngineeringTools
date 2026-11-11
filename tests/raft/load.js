// Loads the EC2 core, punching, plate FE and raft engines out of "Raft Foundation.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Raft Foundation.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String, Set, Map, Float64Array, Int32Array, Uint8Array, isFinite };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.RaftFoundation = RaftFoundation; this.EC2 = EC2; this.PlateFEM = PlateFEM; this.Punching = Punching;', sandbox);
module.exports = { RaftFoundation: sandbox.RaftFoundation, EC2: sandbox.EC2, PlateFEM: sandbox.PlateFEM, Punching: sandbox.Punching };
