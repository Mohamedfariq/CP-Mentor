# CP Mentor

CP Mentor is split into two app roots:

- `frontend/`: React + Vite client
- `backend/`: FastAPI API, datasets, and Python runtime files

## Local Development

Backend:
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn api.main:app --reload --host 127.0.0.1 --port 5000
```

Frontend:
```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open:

- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:5000/api/health`

## Vercel Deployment

Create two separate Vercel projects from the same repo.

Backend project:

- Root Directory: `backend`
- Framework Preset: `Other`
- Build Command: leave empty
- Output Directory: leave empty

Backend env vars:

- `MONGO_URI`
- `MONGO_DB_NAME`
- `MONGO_COLLECTION_NAME`
- `ALLOW_ORIGINS`
- `CODEFORCES_COOKIE` if needed

Frontend project:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Frontend env vars:

- `VITE_API_BASE_URL=https://your-backend.vercel.app`

Use [backend/.env.example](./backend/.env.example) and [frontend/.env.example](./frontend/.env.example) as templates.
