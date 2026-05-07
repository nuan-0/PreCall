import fetch from 'node-fetch';

async function test() {
  console.log('Fetching from local server...');
  try {
    const res = await fetch('http://localhost:3000/api/content/all?force_refresh=true');
    const data: any = await res.json();
    console.log('STATUS:', res.status);
    console.log('Subjects count:', data.subjects?.length);
    console.log('Topics on First Subject:', data.subjects?.[0]?.topics?.length);
    console.log('First Topic Example:', data.subjects?.[0]?.topics?.[0]);
  } catch(e) {
    console.error('FETCH ERROR:', e);
  }
}

test();

