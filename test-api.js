import http from 'http';

http.get('http://127.0.0.1:3000/api/content/all', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Subjects:', parsed.subjects?.length);
      console.log('Topics:', parsed.topics?.length);
      console.log('Error:', parsed.error);
    } catch (e) {
      console.log('Raw:', data);
    }
  });
});
