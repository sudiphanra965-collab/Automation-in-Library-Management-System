const http = require('http');

console.log('\n=== Testing API Endpoints ===\n');

// Test HTTP server
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/books',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const books = JSON.parse(data);
      console.log(`\n✅ Books returned: ${books.length}`);
      if (books.length > 0) {
        console.log('\nFirst book:');
        console.log(JSON.stringify(books[0], null, 2));
      }
    } catch (e) {
      console.error('Error parsing response:', e);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
