// Test if fines endpoint works
const https = require('https');

// Create agent that ignores SSL errors
const agent = new https.Agent({
  rejectUnauthorized: false
});

// First, login to get token
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
  agent: agent
};

console.log('🔐 Logging in as admin...');

const loginReq = https.request(loginOptions, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.token) {
        console.log('✅ Login successful!');
        console.log('Token:', response.token.substring(0, 20) + '...');
        
        // Now test the fines endpoint
        testFinesEndpoint(response.token);
      } else {
        console.error('❌ Login failed:', data);
      }
    } catch (e) {
      console.error('❌ Error parsing login response:', e);
      console.error('Response:', data);
    }
  });
});

loginReq.on('error', (e) => {
  console.error('❌ Login request error:', e);
});

loginReq.write(loginData);
loginReq.end();

function testFinesEndpoint(token) {
  console.log('\n💰 Testing /api/admin/fines endpoint...');
  
  const options = {
    hostname: 'localhost',
    port: 5443,
    path: '/api/admin/fines',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
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
        const fines = JSON.parse(data);
        console.log('✅ Fines endpoint works!');
        console.log('Fines found:', fines.length);
        console.log('Fines data:', JSON.stringify(fines, null, 2));
      } catch (e) {
        console.error('❌ Error parsing fines response:', e);
        console.error('Response:', data);
      }
    });
  });
  
  req.on('error', (e) => {
    console.error('❌ Fines request error:', e);
  });
  
  req.end();
}
