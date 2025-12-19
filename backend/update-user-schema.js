// Update user schema for enhanced signup with verification
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Updating user schema for enhanced signup...');

// Add new columns to users table
const updates = [
  `ALTER TABLE users ADD COLUMN full_name TEXT`,
  `ALTER TABLE users ADD COLUMN roll_no TEXT UNIQUE`,
  `ALTER TABLE users ADD COLUMN date_of_birth TEXT`,
  `ALTER TABLE users ADD COLUMN mobile_no TEXT`,
  `ALTER TABLE users ADD COLUMN user_photo TEXT`,
  `ALTER TABLE users ADD COLUMN id_proof_photo TEXT`,
  `ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN verification_status TEXT DEFAULT 'pending'`,
  `ALTER TABLE users ADD COLUMN registration_date TEXT DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE users ADD COLUMN verified_by INTEGER`,
  `ALTER TABLE users ADD COLUMN verified_date TEXT`,
  `ALTER TABLE users ADD COLUMN rejection_reason TEXT`
];

let completed = 0;
let errors = 0;

updates.forEach((sql, index) => {
  db.run(sql, (err) => {
    completed++;
    
    if (err) {
      // Ignore "duplicate column" errors (column already exists)
      if (err.message.includes('duplicate column')) {
        console.log(`⚠️  Column already exists: ${sql.split('ADD COLUMN ')[1]?.split(' ')[0]}`);
      } else {
        console.error(`❌ Error: ${err.message}`);
        errors++;
      }
    } else {
      console.log(`✅ Added: ${sql.split('ADD COLUMN ')[1]?.split(' ')[0]}`);
    }
    
    // When all updates are done
    if (completed === updates.length) {
      if (errors === 0) {
        console.log('\n✅ User schema updated successfully!');
        console.log('\n📋 New fields added:');
        console.log('   - full_name (Full name of user)');
        console.log('   - roll_no (Unique roll number)');
        console.log('   - date_of_birth (Date of birth)');
        console.log('   - mobile_no (Mobile number)');
        console.log('   - user_photo (Path to user photo)');
        console.log('   - id_proof_photo (Path to college ID proof)');
        console.log('   - is_verified (0=pending, 1=verified, 2=rejected)');
        console.log('   - verification_status (pending/approved/rejected)');
        console.log('   - registration_date (Auto timestamp)');
        console.log('   - verified_by (Admin user ID)');
        console.log('   - verified_date (Verification timestamp)');
        console.log('   - rejection_reason (Reason if rejected)');
      } else {
        console.log(`\n⚠️  Completed with ${errors} errors`);
      }
      
      db.close();
    }
  });
});
