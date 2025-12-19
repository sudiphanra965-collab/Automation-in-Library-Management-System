// Test user stats endpoint
const https = require('https');

// Create agent that ignores SSL errors
const agent = new https.Agent({
  rejectUnauthorized: false
});

// First, login to get token
const loginData = JSON.stringify({
  username: 'kj',
  password: 'kj'
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

console.log('🔐 Logging in as kj...');

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
        
        // Now test the user stats endpoint
        testUserStats(response.token);
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

function testUserStats(token) {
  console.log('\n📊 Testing /api/user/stats endpoint...');
  
  const options = {
    hostname: 'localhost',
    port: 5443,
    path: '/api/user/stats',
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
        const stats = JSON.parse(data);
        console.log('✅ User stats endpoint works!');
        console.log('Stats data:', JSON.stringify(stats, null, 2));
      } catch (e) {
        console.error('❌ Error parsing stats response:', e);
        console.error('Response:', data);
      }
    });
  });
  
  req.on('error', (e) => {
    console.error('❌ Stats request error:', e);
  });
  
  req.end();
}
