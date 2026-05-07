const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');
code = code.replace(/fs\.appendFileSync\([^)]+\);/g, '');
code = code.replace(/fs\.writeFileSync\([^)]+\);/g, '');
fs.writeFileSync('api/index.ts', code);
console.log('Removed fs calls');
