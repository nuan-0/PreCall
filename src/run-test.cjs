const { spawn } = require('child_process');
const child = spawn('npx', ['tsx', 'api/index.ts']);
let out = '';
child.stdout.on('data', d => out += d);
child.stderr.on('data', d => out += d);
setTimeout(() => {
  console.log(out);
  child.kill();
  process.exit(0);
}, 5000);
