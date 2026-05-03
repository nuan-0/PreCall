import http from 'http';

http.get('http://127.0.0.1:3000/api/content/all', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.subjects) {
          parsed.subjects.forEach(d => {
             if (d.pdfUrl) {
                console.log(`[API] ${d.slug}: pdfVisible = ${d.pdfVisible}, url = ${d.pdfUrl}`);
             }
          });
      }
    } catch (e) {
      console.log('Raw:', data);
    }
  });
});
