# Mobile Access Setup Guide - HTTPS Only

## Why HTTPS?
HTTPS is required for camera access on both mobile and desktop. Without HTTPS, QR code scanning won't work.

## Setup Steps for Mobile

### For Android (Chrome):
1. Open Chrome on your mobile
2. Go to: `https://10.237.19.96:5443`
3. You'll see a warning: **"Your connection is not private"**
4. Tap **"Advanced"**
5. Tap **"Proceed to 10.237.19.96 (unsafe)"**
6. ✅ Done! The site will now work with full camera access

### For iPhone/iOS (Safari):
1. Open Safari on your iPhone
2. Go to: `https://10.237.19.96:5443`
3. You'll see a warning
4. Tap **"Show Details"**
5. Tap **"visit this website"**
6. Tap **"Visit Website"** again
7. ✅ Done! The site will now work with full camera access

## Important Notes

- **You only need to accept the certificate ONCE per device**
- After accepting, bookmark the page for easy access
- Camera/QR scanning will work perfectly after accepting
- All features (borrow, return, scan) will work on mobile

## URLs

- **Desktop**: https://localhost:5443
- **Mobile**: https://10.237.19.96:5443
- **Admin Panel**: Add `/admin.html` to either URL

## Starting the Server

Run: `node server-https.js`

Or double-click: `START-HTTPS-ONLY.bat`
