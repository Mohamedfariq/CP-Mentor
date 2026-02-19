import os

import bcrypt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pg8000 import dbapi
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


def get_db_connection():
    password = os.getenv("PGPASSWORD")
    if not password:
        raise RuntimeError("PGPASSWORD is missing. Add it in .env as a string value.")

    return dbapi.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        user=os.getenv("PGUSER", "postgres"),
        password=password,
        database=os.getenv("PGDATABASE", "postgres"),
    )


def row_to_dict(cursor, row):
    if row is None:
        return None
    return {desc[0]: value for desc, value in zip(cursor.description, row)}


def init_table() -> None:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS user_details (
                id BIGSERIAL PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                codeforces_id VARCHAR(100),
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute(
            """
            ALTER TABLE user_details
            ADD COLUMN IF NOT EXISTS id BIGSERIAL;
            """
        )
        cur.execute(
            """
            ALTER TABLE user_details
            ADD COLUMN IF NOT EXISTS username VARCHAR(100);
            """
        )
        cur.execute(
            """
            ALTER TABLE user_details
            ADD COLUMN IF NOT EXISTS email VARCHAR(255);
            """
        )
        cur.execute(
            """
            ALTER TABLE user_details
            ADD COLUMN IF NOT EXISTS codeforces_id VARCHAR(100);
            """
        )
        cur.execute(
            """
            ALTER TABLE user_details
            ADD COLUMN IF NOT EXISTS password_hash TEXT;
            """
        )
        cur.execute(
            """
            ALTER TABLE user_details
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
            """
        )
        cur.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'user_details_pkey'
                ) THEN
                    ALTER TABLE user_details ADD CONSTRAINT user_details_pkey PRIMARY KEY (id);
                END IF;
            END $$;
            """
        )
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS user_details_email_key
            ON user_details (email);
            """
        )
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS user_details_codeforces_id_key
            ON user_details (codeforces_id);
            """
        )
        conn.commit()
    finally:
        conn.close()


@app.on_event("startup")
def on_startup() -> None:
    init_table()


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

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO user_details (username, email, codeforces_id, password_hash)
            VALUES (%s, %s, %s, %s)
            RETURNING id, username, email, codeforces_id, created_at
            """,
            (username, email, codeforces_id, password_hash),
        )
        user = row_to_dict(cur, cur.fetchone())
        conn.commit()
        return {"message": "User created successfully", "user": user}
    except dbapi.IntegrityError as exc:
        conn.rollback()
        if "duplicate key value violates unique constraint" in str(exc):
            raise HTTPException(status_code=409, detail="Email or Codeforces ID already exists")
        raise HTTPException(status_code=400, detail=f"Database integrity error: {exc}")
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {exc}")
    finally:
        conn.close()


@app.post("/api/login")
def login(payload: LoginPayload):
    email = payload.email.strip().lower()
    password = payload.password

    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password are required")

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, username, email, codeforces_id, password_hash, created_at
            FROM user_details
            WHERE LOWER(email) = %s
            LIMIT 1
            """,
            (email,),
        )
        row = cur.fetchone()

        if row is None:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        user = row_to_dict(cur, row)
        password_hash = user.get("password_hash") or ""
        if not password_hash or not bcrypt.checkpw(
            password.encode("utf-8"), password_hash.encode("utf-8")
        ):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        return {
            "message": "Login successful",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "codeforces_id": user["codeforces_id"],
                "created_at": user["created_at"],
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal server error: {exc}")
    finally:
        conn.close()
