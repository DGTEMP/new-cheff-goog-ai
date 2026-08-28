const http = require('http');

http.get('http://localhost:8080/api/super/tarefas', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    console.log('Response:', data);
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
