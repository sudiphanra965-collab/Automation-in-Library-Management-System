// Test QR code endpoint
const https = require('https');

// Create agent that ignores SSL errors
const agent = new https.Agent({
  rejectUnauthorized: false
});

// Test with book ID 1
const bookId = 1;

console.log(`🔍 Testing QR code generation for book ID: ${bookId}`);

const options = {
  hostname: 'localhost',
  port: 5443,
  path: `/api/books/${bookId}/qrcode`,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  },
  agent: agent
};

const req = https.request(options, (res) => {
  let data = '';
  
  console.log('Status Code:', res.statusCode);
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('✅ QR code endpoint works!');
      console.log('Book data:', response.bookData);
      console.log('QR code (first 100 chars):', response.qrCode.substring(0, 100) + '...');
      console.log('QR code length:', response.qrCode.length);
    } catch (e) {
      console.error('❌ Error parsing response:', e);
      console.error('Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e);
});

req.end();
