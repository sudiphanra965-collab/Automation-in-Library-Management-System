// test-admin-login.js
const fetch = require('node-fetch');

async function testAdminLogin() {
  try {
    const response = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    const result = await response.json();
    console.log('Login response status:', response.status);
    console.log('Login response:', result);

    if (result.isAdmin) {
      console.log('✅ Admin login successful!');
      console.log('Admin token:', result.token);
    } else {
      console.log('❌ Login successful but user is not admin');
    }
  } catch (error) {
    console.error('❌ Login test failed:', error.message);
  }
}

testAdminLogin();
