# Netlify Deploy Fix (Books "Failed to fetch")

## Why it happens
Netlify hosts **static files only** (your `frontend/` folder).  
Your app’s real data comes from the **Node/Express backend** (`backend/server.js`) via endpoints like:

- `/api/books`
- `/api/login`
- `/api/admin/...`

If the backend isn’t deployed + connected, the frontend will show **“Backend not connected / Failed to fetch”**.

## Correct deployment architecture
- **Frontend**: Netlify (static)
- **Backend API**: Render / Railway / Fly.io / VPS (Node/Express)

## Option A (Recommended): Deploy backend to Render (quick)
1. Create a new **Web Service** from your GitHub repo
2. Set these fields:
   - **Root directory**: `backend`
   - **Build command**: `npm install`
   - **Start command**: `npm start`
3. Add environment variable:
   - `JWT_SECRET`: set a strong random string
4. Deploy. Copy your backend URL, e.g. `https://your-service.onrender.com`

## Connect Netlify → Backend
Update `netlify.toml` to proxy API calls to your backend URL:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR-BACKEND-HOST/api/:splat"
  status = 200

[[redirects]]
  from = "/uploads/*"
  to = "https://YOUR-BACKEND-HOST/uploads/:splat"
  status = 200
```

Then redeploy Netlify (**Clear cache and deploy**).

## Notes
- The backend currently uses **SQLite** (`backend/library.db`). Some hosts have **ephemeral disk** on free tiers.
  - If you need persistent data, use a host with persistent disk or migrate to Postgres (docs exist in this repo).
- Camera QR scanning requires HTTPS and browser permissions; Netlify is HTTPS already.


