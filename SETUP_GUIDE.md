# CP Mentor - Setup Guide for New Users

This guide will help you set up CP Mentor on your computer. If you're getting errors like "code view not working" or "PyMongo fallback to local memory", follow these steps.

## Prerequisites
- **Python** 3.11 or higher
- **Node.js** 18 or higher  
- **npm** (comes with Node.js)
- **MongoDB** (either local or MongoDB Atlas account)

Check what you have:
```bash
python3 --version
node --version
npm --version
```

---

## Complete Setup Process

### 1️⃣ Backend Setup

```bash
# Navigate to project folder
cd CP-Mentor

# Create Python virtual environment
python3 -m venv .venv

# Activate virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
# .venv\Scripts\activate

# Upgrade pip
python3 -m pip install --upgrade pip

# Install Python dependencies
pip install -r requirements.txt
```

### 2️⃣ Environment Configuration

**Copy the example env file:**
```bash
cp .env.example .env
```

**Edit `.env` file with your MongoDB credentials:**

Open `.env` in your editor and fill in these values:

```env
# REQUIRED - MongoDB Connection
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
# If using local MongoDB:
# MONGO_URI=mongodb://localhost:27017

MONGO_DB_NAME=cp_mentor
MONGO_COLLECTION_NAME=users

# REQUIRED for code viewing feature
CODEFORCES_COOKIE=JSESSIONID=abc123...; 39ce7=xyz789...
# Get this by:
# 1. Login to codeforces.com
# 2. Open browser DevTools (F12)
# 3. Go to Application > Cookies > codeforces.com
# 4. Copy the entire "JSESSIONID" and "39ce7" cookie values

# Optional settings (keep defaults if unsure)
ALLOW_ORIGINS=["http://localhost:5173"]
MIN_PASSWORD_LENGTH=6
CF_API_CACHE_TTL_SECONDS=3600
CF_STATUS_CACHE_TTL_SECONDS=600
WEEKLY_CONTEST_DURATION_SECONDS=3600
CLUSTER_MODEL_STRICT=false
CLUSTER_RETRAIN_ENABLED=true
CLUSTER_RETRAIN_EVERY_N_USERS=5
CLUSTER_RETRAIN_MIN_INTERVAL_SECONDS=300
CLUSTER_RETRAIN_MIN_TOTAL_USERS=10
CLUSTER_RETRAIN_MAX_CLUSTERS=8
ALLOW_CLUSTER_CENTROID_FALLBACK=false
MONGO_TRAINING_SNAPSHOTS_COLLECTION=user_training_snapshots
MONGO_MODEL_META_COLLECTION=model_metadata
```

### 3️⃣ Start Backend

```bash
# Make sure you're in the project folder with .venv activated
python3 -m uvicorn api.main:app --reload --host 127.0.0.1 --port 5000
```

You should see:
```
Uvicorn running on http://127.0.0.1:5000
```

**✅ Backend is ready when you see this message.**

### 4️⃣ Frontend Setup (New Terminal)

Open a **new terminal window** and run:

```bash
# Navigate to project folder
cd CP-Mentor

# Install npm dependencies
npm install

# Start development server
npm run dev -- --host 127.0.0.1 --port 5173
```

You should see:
```
  ➜  Local:   http://127.0.0.1:5173/
```

### 5️⃣ Access the App

Open in your browser:
- **Frontend**: http://127.0.0.1:5173
- **Backend Health**: http://127.0.0.1:5000/api/health

---

## Troubleshooting

### ❌ "Code View Not Working"

**Cause**: Missing `CODEFORCES_COOKIE` in `.env`

**Fix**:
1. Go to https://codeforces.com and login
2. Open DevTools: Press `F12` (or `Cmd+Option+I` on macOS)
3. Click **Application** → **Cookies** → **codeforces.com**
4. Copy the value of `JSESSIONID` and `39ce7` cookies
5. Paste into `.env`:
   ```env
   CODEFORCES_COOKIE=JSESSIONID=value1; 39ce7=value2
   ```
6. Restart backend: `python3 -m uvicorn api.main:app --reload --host 127.0.0.1 --port 5000`

---

### ❌ "PyMongo Fallback to Local Memory"

**Cause**: MongoDB is not running or connection string is wrong

**Fix Option 1: Use MongoDB Atlas (Recommended)**
1. Create free account at https://www.mongodb.com/cloud/atlas
2. Create a cluster (free tier)
3. Get connection string from **Connect** button
4. Update `.env`:
   ```env
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   ```
5. Restart backend

**Fix Option 2: Use Local MongoDB**
1. Install MongoDB locally:
   - **macOS**: `brew install mongodb-community`
   - **Windows**: Download from https://www.mongodb.com/try/download/community
   - **Linux**: `sudo apt-get install mongodb`

2. Start MongoDB:
   - **macOS**: `brew services start mongodb-community`
   - **Windows**: MongoDB should auto-start
   - **Linux**: `sudo systemctl start mongod`

3. Update `.env`:
   ```env
   MONGO_URI=mongodb://localhost:27017
   ```
4. Restart backend

**Check MongoDB is running:**
```bash
# Try connecting (you need mongodb tools installed)
mongosh "mongodb://localhost:27017"
# Or test via backend health endpoint
curl http://127.0.0.1:5000/api/health
```

---

### ❌ "Port Already in Use"

If you get "Address already in use" error:

**For port 5000 (backend):**
```bash
# Kill process on port 5000
lsof -i :5000 | grep -v COMMAND | awk '{print $2}' | xargs kill -9
```

**For port 5173 (frontend):**
```bash
# Kill process on port 5173
lsof -i :5173 | grep -v COMMAND | awk '{print $2}' | xargs kill -9
```

Or use different ports:
```bash
# Backend on 5001
python3 -m uvicorn api.main:app --reload --host 127.0.0.1 --port 5001

# Frontend on 5174
npm run dev -- --host 127.0.0.1 --port 5174
```

---

### ❌ "npm install fails"

Make sure you have **Node.js 18+** installed:
```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be 8.0.0 or higher
```

If not, download from https://nodejs.org/

---

### ❌ "pip install fails"

Make sure you're using **Python 3.11+**:
```bash
python3 --version  # Should be 3.11.0 or higher
which python3
```

And make sure **venv is activated**:
```bash
source .venv/bin/activate  # macOS/Linux
# or
.venv\Scripts\activate     # Windows
```

---

## Quick Start Checklist

- [ ] Python 3.11+ installed
- [ ] Node.js 18+ installed
- [ ] Ran `python3 -m venv .venv` in project folder
- [ ] Activated venv with `source .venv/bin/activate`
- [ ] Ran `pip install -r requirements.txt`
- [ ] Created `.env` file from `.env.example`
- [ ] Added `MONGO_URI` to `.env` (Atlas or local)
- [ ] Added `CODEFORCES_COOKIE` to `.env`
- [ ] Started backend: `python3 -m uvicorn api.main:app --reload --host 127.0.0.1 --port 5000`
- [ ] In new terminal, started frontend: `npm run dev -- --host 127.0.0.1 --port 5173`
- [ ] Opened http://127.0.0.1:5173 in browser

---

## Still Having Issues?

Check these:
1. **Backend running?** Visit http://127.0.0.1:5000/api/health
2. **Frontend running?** Visit http://127.0.0.1:5173
3. **MongoDB connected?** Check `.env` file has valid `MONGO_URI`
4. **Codeforces cookie valid?** Login to codeforces.com and re-grab the cookie

If problems persist, share the error message you're seeing!
