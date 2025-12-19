// Simple certificate generator using selfsigned package
const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

console.log('🔐 Generating SSL Certificate...\n');

try {
  // Generate self-signed certificate
  const attrs = [{ name: 'commonName', value: '10.237.19.96' }];
  const pems = selfsigned.generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'basicConstraints',
        cA: true
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          {
            type: 2, // DNS
            value: 'localhost'
          },
          {
            type: 7, // IP
            ip: '10.237.19.96'
          },
          {
            type: 7, // IP
            ip: '127.0.0.1'
          }
        ]
      }
    ]
  });

  // Save certificate and key
  const certPath = path.join(__dirname, 'localhost-cert.pem');
  const keyPath = path.join(__dirname, 'localhost-key.pem');

  fs.writeFileSync(certPath, pems.cert);
  fs.writeFileSync(keyPath, pems.private);

  console.log('✅ Certificate generated successfully!\n');
  console.log('📁 Certificate files:');
  console.log(`   ${certPath}`);
  console.log(`   ${keyPath}\n`);
  console.log('🚀 Now run: node server-https.js\n');

} catch (error) {
  console.error('❌ Error generating certificate:', error.message);
  console.log('\n💡 Please install selfsigned package:');
  console.log('   npm install selfsigned\n');
}
