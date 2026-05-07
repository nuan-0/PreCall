import fetch from 'node-fetch';
async function test() {
  const res = await fetch('http://localhost:3000/api/content/all?force_refresh=true');
  console.log(res.headers.raw());
  const text = await res.text();
  console.log(text.substring(0, 50));
}
test();
