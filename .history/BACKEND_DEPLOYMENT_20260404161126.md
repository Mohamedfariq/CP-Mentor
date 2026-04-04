# Backend Deployment Guide

## Deploy to Render

### Step 1: Prepare Backend for Render

1. Create `render.yaml` in the backend folder:

```yaml
services:
  - type: web
    name: cp-mentor-backend
    env: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn api.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: MONGO_URI
        sync: false
      - key: MONGO_DB_NAME
        value: cp_mentor
      - key: MONGO_COLLECTION_NAME
        value: user_details
      - key: ALLOW_ORIGINS
        value: https://cpfrontend-26zg97uj9-mohamedfariq2326-7184s-projects.vercel.app,http://localhost:5173,http://127.0.0.1:5173
      - key: MIN_PASSWORD_LENGTH
        value: "8"
      - key: CF_API_CACHE_TTL_SECONDS
        value: "120"
      - key: CF_STATUS_CACHE_TTL_SECONDS
        value: "120"
```

2. Update `backend/requirements.txt` to include:
```
fastapi
uvicorn
python-dotenv
pymongo
bcrypt
pydantic
email-validator
beautifulsoup4
```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com) and sign up
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Select the **Root Directory**: `backend`
5. Set **Build Command**: `pip install -r requirements.txt`
6. Set **Start Command**: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
7. Add Environment Variables:
   - `MONGO_URI`: Your MongoDB connection string
   - `MONGO_DB_NAME`: `cp_mentor`
   - `MONGO_COLLECTION_NAME`: `user_details`
   - `ALLOW_ORIGINS`: (Add all your frontend URLs here)
   - `CODEFORCES_COOKIE`: Your CF cookie (if needed)

8. Click **Deploy**

### Step 3: Get Your Backend URL

Once deployed, Render will provide a URL like: `https://cp-mentor-xxx.onrender.com`

### Step 4: Update Frontend Environment

In your Vercel project settings, add:

**Environment Variables:**
```
VITE_API_BASE_URL=https://cp-mentor-xxx.onrender.com
```

Replace `xxx` with your actual Render service ID.

### Step 5: Redeploy Frontend on Vercel

After updating the env var, trigger a redeploy on Vercel (push a commit or manually trigger).

---

## Alternative Hosting Options

### Railway
- Similar to Render, go to railway.app
- Connect GitHub repo → Deploy
- Set start command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`

### Heroku (Free tier removed, but still works with paid dynos)
```bash
heroku login
heroku create your-app-name
git push heroku main
```
