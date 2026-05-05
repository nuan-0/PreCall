fetch('http://localhost:3000/api/admin/run-migration')
  .then(res => res.text())
  .then(data => console.log('Response:', data.substring(0, 500)))
  .catch(err => console.error('Migration Error:', err));
