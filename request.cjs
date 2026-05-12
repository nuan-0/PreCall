const http = require('http');

const body = JSON.stringify({
  userId: '123',
  topic: {
    id: 'test',
    slug: 'test',
    subjectSlug: 'math'
  }
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/admin/save-topic',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('RESPONSE:', res.statusCode, data));
});

req.on('error', e => console.error(e));
req.write(body);
req.end();
