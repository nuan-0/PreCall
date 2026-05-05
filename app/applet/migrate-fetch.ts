fetch('http://localhost:3000/api/admin/run-migration')
  .then(res => res.json())
  .then(data => console.log('Migration Result:', data))
  .catch(err => console.error('Migration Error:', err));
