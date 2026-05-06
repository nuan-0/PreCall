import fetch from 'node-fetch';

async function test() {
  console.log('Fetching from local server...');
  try {
    const res = await fetch('http://localhost:3000/api/content/all?force_refresh=true');
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('CONTENT START:', text.substring(0, 150));
  } catch(e) {
    console.error('FETCH ERROR:', e);
  }
}

test();
