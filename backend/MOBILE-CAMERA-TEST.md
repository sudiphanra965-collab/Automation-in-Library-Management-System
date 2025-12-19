# Mobile Camera Access Troubleshooting

## ✅ **Setup Checklist:**

### 1. **Server Running on HTTPS**
- ✅ Server must be running on port 5443
- ✅ Access via: `https://10.246.76.157:5443`

### 2. **Firewall Rules**
- ✅ Run `SETUP-FIREWALL.bat` as Administrator
- ✅ Port 5443 must be open

### 3. **Mobile Browser Setup**
- ✅ Use Chrome (Android) or Safari (iOS)
- ✅ Accept the security certificate warning
- ✅ Grant camera permissions when prompted

### 4. **Camera Permissions**
When you click "Start QR Scanner":
1. Browser will ask: "Allow camera access?"
2. Tap **"Allow"** or **"Yes"**
3. Camera should start immediately

## 🔍 **Testing Steps:**

### On Mobile:
1. Open browser (Chrome/Safari)
2. Go to: `https://10.246.76.157:5443/admin.html`
3. Login with admin credentials
4. Click "Issue & Return" in sidebar
5. Click "📸 Start QR Scanner" button
6. **Allow camera access** when prompted
7. Point camera at QR code

## ❌ **If Camera Doesn't Work:**

### Check 1: HTTPS Connection
- URL must start with `https://`
- You must see the padlock icon (even if it says "Not Secure")

### Check 2: Browser Permissions
**Android Chrome:**
- Tap the lock icon in address bar
- Tap "Permissions"
- Make sure "Camera" is set to "Allow"

**iOS Safari:**
- Settings → Safari → Camera
- Set to "Ask" or "Allow"

### Check 3: Clear Browser Data
- Clear cache and reload the page
- Try in Incognito/Private mode

## 📱 **Mobile Access URL:**
```
https://10.246.76.157:5443/admin.html
```

## 🎯 **Expected Behavior:**
1. Click "Start QR Scanner"
2. Camera permission popup appears
3. Tap "Allow"
4. Camera feed shows in the scanner box
5. Point at QR code
6. Book ID auto-fills and processes

## 💡 **Tips:**
- Make sure you're on the same WiFi network as the PC
- The first time you access, accept the certificate warning
- Grant camera permissions when asked
- If it fails, refresh the page and try again
