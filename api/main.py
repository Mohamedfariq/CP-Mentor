import os

import bcrypt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, EmailStr

load_dotenv()

app = FastAPI(title="CP Mentor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SignUpPayload(BaseModel):
    username: str
    email: EmailStr
    password: str
    codeforcesId: str


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


def get_collection():
    mongo_uri = os.getenv(
        "MONGO_URI",
        "mongodb+srv://mohamedfariq2326:fariq2326@cluster0.xbkxmdv.mongodb.net/?appName=Cluster0",
    )
    client = MongoClient(mongo_uri)
    db = client["cp_mentor"]
    return db["user_details"]


def init_collection() -> None:
    collection = get_collection()
    collection.create_index([("email", ASCENDING)], unique=True, name="user_details_email_key")
    collection.create_index(
        [("codeforces_id", ASCENDING)],
        unique=True,
        name="user_details_codeforces_id_key",
    )


@app.on_event("startup")
def on_startup() -> None:
    init_collection()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/signup")
def signup(payload: SignUpPayload):
    username = payload.username.strip()
    email = payload.email.strip().lower()
    password = payload.password
    codeforces_id = payload.codeforcesId.strip()

    if not username or not email or not password or not codeforces_id:
        raise HTTPException(
            status_code=400, detail="username, email, password and codeforcesId are required"
        )

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    try:
        collection = get_collection()
        doc = {
            "username": username,
            "email": email,
            "codeforces_id": codeforces_id,
            "password_hash": password_hash,
        }
        insert_result = collection.insert_one(doc)
        user = {
            "id": str(insert_result.inserted_id),
            "username": username,
            "email": email,
            "codeforces_id": codeforces_id,
        }
        return {"message": "User created successfully", "user": user}
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Email or Codeforces ID already exists")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal server error: {exc}")


@app.post("/api/login")
def login(payload: LoginPayload):
    email = payload.email.strip().lower()
    password = payload.password

    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password are required")

    try:
        collection = get_collection()
        user = collection.find_one({"email": email})
        if user is None:
            return JSONResponse(
                status_code=401,
                content={"alert": "Invalid credentials. Please check email and password."},
            )

        password_hash = user.get("password_hash") or ""
        if not password_hash or not bcrypt.checkpw(
            password.encode("utf-8"), password_hash.encode("utf-8")
        ):
            return JSONResponse(
                status_code=401,
                content={"alert": "Invalid credentials. Please check email and password."},
            )

        return {
            "message": "Login successful",
            "user": {
                "id": str(user["_id"]),
                "username": user["username"],
                "email": user["email"],
                "codeforces_id": user["codeforces_id"],
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal server error: {exc}")
