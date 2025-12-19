const https = require('https');
const process = require('process');

// Disable SSL verification for self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('\n=== Testing HTTPS Server Endpoints ===\n');

// First, login to get a token
const loginData = JSON.stringify({
  username: 'admin',
  password: 'admin123'
});

const loginOptions = {
  hostname: 'localhost',
  port: 5443,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  },
  rejectUnauthorized: false
};

const loginReq = https.request(loginOptions, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const loginResult = JSON.parse(data);
      console.log('✅ Login successful');
      const token = loginResult.token;
      
      // Test all endpoints
      const endpoints = [
        { path: '/api/admin/stats', method: 'GET', name: 'Dashboard Stats' },
        { path: '/api/admin/books/all', method: 'GET', name: 'All Books' },
        { path: '/api/admin/borrowed', method: 'GET', name: 'Borrowed Books' }
      ];
      
      let completed = 0;
      
      endpoints.forEach(endpoint => {
        const options = {
          hostname: 'localhost',
          port: 5443,
          path: endpoint.path,
          method: endpoint.method,
          headers: {
            'Authorization': `Bearer ${token}`
          },
          rejectUnauthorized: false
        };
        
        const req = https.request(options, (res) => {
          console.log(`\n${endpoint.name}:`);
          console.log(`  Path: ${endpoint.path}`);
          console.log(`  Status: ${res.statusCode}`);
          
          let responseData = '';
          
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          
          res.on('end', () => {
            try {
              const json = JSON.parse(responseData);
              if (Array.isArray(json)) {
                console.log(`  ✅ Success - Returned ${json.length} items`);
                if (json.length > 0) {
                  console.log(`  Sample:`, JSON.stringify(json[0]).substring(0, 100) + '...');
                }
              } else {
                console.log(`  ✅ Success - Data:`, JSON.stringify(json));
              }
            } catch (e) {
              console.log(`  ❌ Error parsing response`);
              console.log(`  Raw:`, responseData.substring(0, 200));
            }
            
            completed++;
            if (completed === endpoints.length) {
              console.log('\n=== Test Complete ===\n');
            }
          });
        });
        
        req.on('error', (e) => {
          console.log(`  ❌ Request failed: ${e.message}`);
          completed++;
        });
        
        req.end();
      });
      
    } catch (e) {
      console.error('Error parsing login response:', e);
      console.log('Raw response:', data);
    }
  });
});

loginReq.on('error', (e) => {
  console.error(`Problem with login request: ${e.message}`);
});

loginReq.write(loginData);
loginReq.end();
