// Runs every Steel Member Design test suite against the shipped HTML. Usage: node tests/steel-member/run_all.js
const { execFileSync } = require('child_process');
let failed = 0;
for (const f of ['test_beam.js', 'test_mcr.js', 'test_ec3.js', 'test_screen.js', 'test_fixes.js']) {
  try { const out = execFileSync(process.execPath, [require('path').join(__dirname, f)], { encoding: 'utf8' }); console.log(out.trim().split('\n').pop()); }
  catch (e) { failed++; console.log(`${f} FAILED\n${e.stdout || ''}${e.stderr || ''}`); }
}
process.exit(failed ? 1 : 0);
