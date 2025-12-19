const http = require('http');

console.log('\n=== Testing Admin Stats Endpoint ===\n');

// First, login to get a token
const loginData = JSON.stringify({
  username: 'admin',
  password: 'admin123'
});

const loginOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
};

const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const loginResult = JSON.parse(data);
      console.log('✅ Login successful');
      console.log('Token:', loginResult.token.substring(0, 20) + '...');
      
      // Now test the stats endpoint
      const statsOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/admin/stats',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${loginResult.token}`
        }
      };
      
      const statsReq = http.request(statsOptions, (statsRes) => {
        console.log(`\nStats endpoint status: ${statsRes.statusCode}`);
        
        let statsData = '';
        
        statsRes.on('data', (chunk) => {
          statsData += chunk;
        });
        
        statsRes.on('end', () => {
          try {
            const stats = JSON.parse(statsData);
            console.log('\n✅ Stats loaded successfully:');
            console.log(JSON.stringify(stats, null, 2));
          } catch (e) {
            console.error('Error parsing stats:', e);
            console.log('Raw response:', statsData);
          }
        });
      });
      
      statsReq.on('error', (e) => {
        console.error(`Problem with stats request: ${e.message}`);
      });
      
      statsReq.end();
      
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
