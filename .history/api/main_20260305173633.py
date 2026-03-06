import copy
import csv
import html
import json
import logging
import math
import os
import random
import re
import shutil
import ssl
import subprocess
import tempfile
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from threading import Lock, Thread
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

import bcrypt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
from pydantic import BaseModel, EmailStr, Field

try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None

load_dotenv()

logger = logging.getLogger(__name__)

CODEFORCES_HANDLE_RE = re.compile(r"^[A-Za-z0-9_.-]{3,24}$")
CODEFORCES_PROBLEM_LINK_RE = re.compile(
    r"codeforces\.com/(contest/\d+/problem/[A-Za-z0-9]+|problemset/problem/\d+/[A-Za-z0-9]+)",
    re.IGNORECASE,
)
CODEFORCES_CONTEST_PROBLEM_PATH_RE = re.compile(
    r"^/contest/(?P<contest_id>\d+)/problem/(?P<problem_index>[A-Za-z0-9]+)$", re.IGNORECASE
)
CODEFORCES_PROBLEMSET_PROBLEM_PATH_RE = re.compile(
    r"^/problemset/problem/(?P<contest_id>\d+)/(?P<problem_index>[A-Za-z0-9]+)$", re.IGNORECASE
)
CODEFORCES_SUBMISSION_LINK_RE = re.compile(
    r"^https?://codeforces\.com/"
    r"(contest/(?P<contest_id>\d+)/submission/(?P<submission_id>\d+)"
    r"|problemset/submission/(?P<problemset_id>\d+)/(?P<problemset_submission_id>\d+))$",
    re.IGNORECASE,
)
INVALID_CREDENTIALS_MSG = "Invalid credentials. Please check email and password."

DEFAULT_ALLOWED_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"]
SHEET_CACHE_VERSION = "v3"

_mongo_client_lock = Lock()
_mongo_client = None

_cf_api_cache_lock = Lock()
_cf_api_cache = {}

_user_status_cache_lock = Lock()
_user_status_cache = {}

_db_mode_lock = Lock()
_db_mode = "mongo"

_memory_lock = Lock()
_memory_next_id = 1
_memory_users = {}
_memory_email_index = {}
_memory_cf_index = {}

_model_retrain_lock = Lock()


class MemoryDuplicateKeyError(Exception):
    pass


class ModelUnavailableError(RuntimeError):
    pass


def _parse_allowed_origins():
    raw = os.getenv("ALLOW_ORIGINS", "").strip()
    if not raw:
        return list(DEFAULT_ALLOWED_ORIGINS)
    items = [part.strip() for part in raw.split(",")]
    return [item for item in items if item]


allowed_origins = _parse_allowed_origins()
allow_credentials = "*" not in allowed_origins

app = FastAPI(title="CP Mentor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
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


class RecommendationsPayload(BaseModel):
    codeforcesId: str
    perTopic: int = 10
    totalProblems: int = 5
    selectedTopics: list[str] = Field(default_factory=list)
    windowDays: int = 0
    forceRefresh: bool = False


class DashboardPayload(BaseModel):
    codeforcesId: str


class ContestStatusPayload(BaseModel):
    codeforcesId: str
    problemKeys: list[str]


class ContestGeneratePayload(BaseModel):
    codeforcesId: str
    totalProblems: int = 4
    perTopic: int = 10


class SubmissionSourcePayload(BaseModel):
    submissionUrl: str


class ProblemDetailsPayload(BaseModel):
    cfLink: str


class ProblemRunPayload(BaseModel):
    cfLink: str
    language: str
    code: str = Field(min_length=1, max_length=200000)


class TopicPreferencesPayload(BaseModel):
    codeforcesId: str
    topics: list[str]


class WeeklyContestScheduleGetPayload(BaseModel):
    codeforcesId: str


class WeeklyContestScheduleSetPayload(BaseModel):
    codeforcesId: str
    weekday: int
    hour: int
    minute: int
    timezoneOffsetMinutes: int = 0
    contestDurationSeconds: int | None = None


class ContestProblemProgressPayload(BaseModel):
    problemKey: str
    topic: str
    rating: float | int | None = 0
    status: str


class ContestCompletePayload(BaseModel):
    codeforcesId: str
    durationSeconds: int = 0
    problems: list[ContestProblemProgressPayload]
    startedAt: int | None = None
    finishedAt: int | None = None


DATASET_DIR = Path(__file__).resolve().parents[1] / "cf_dataset_ml"
TOPIC_FEATURES_FILE = DATASET_DIR / "user_topic_features_ml.csv"
USER_CLUSTERS_FILE = DATASET_DIR / "user_clusters_v2.csv"
USER_PROFILE_FILE = DATASET_DIR / "user_profile.csv"
PROBLEM_HISTORY_FILE = DATASET_DIR / "problem_attempt_history.csv"
CLUSTER_STATS_FILE = DATASET_DIR / "cluster_topic_problem_stats.csv"
TRAINING_FEATURE_COLUMNS_FILE = DATASET_DIR / "training_feature_columns_v2.txt"
SCALER_FILE = DATASET_DIR / "scaler_v2.pkl"
KMEANS_FILE = DATASET_DIR / "kmeans_v2.pkl"
MODEL_META_FILE = DATASET_DIR / "model_training_meta.json"
DYNAMIC_TRAINING_SNAPSHOTS_FILE = DATASET_DIR / "dynamic_user_feature_snapshots.csv"

MONGO_TRAINING_SNAPSHOTS_COLLECTION = os.getenv(
    "MONGO_TRAINING_SNAPSHOTS_COLLECTION", "training_snapshots"
).strip() or "training_snapshots"
MONGO_MODEL_META_COLLECTION = os.getenv("MONGO_MODEL_META_COLLECTION", "model_meta").strip() or "model_meta"
MODEL_META_DOC_ID = "cluster_training_meta"


def _safe_int_env(var_name: str, default: int) -> int:
    raw = os.getenv(var_name, str(default))
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


def _safe_bool_env(var_name: str, default: bool) -> bool:
    raw = os.getenv(var_name)
    if raw is None:
        return default
    value = str(raw).strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default


MIN_PASSWORD_LENGTH = max(1, _safe_int_env("MIN_PASSWORD_LENGTH", 8))
CF_API_CACHE_TTL_SECONDS = max(0, _safe_int_env("CF_API_CACHE_TTL_SECONDS", 120))
CF_STATUS_CACHE_TTL_SECONDS = max(0, _safe_int_env("CF_STATUS_CACHE_TTL_SECONDS", 120))
WEEKLY_CONTEST_DURATION_SECONDS = max(1800, _safe_int_env("WEEKLY_CONTEST_DURATION_SECONDS", 7200))
CLUSTER_MODEL_STRICT = _safe_bool_env("CLUSTER_MODEL_STRICT", True)
CLUSTER_RETRAIN_ENABLED = _safe_bool_env("CLUSTER_RETRAIN_ENABLED", True)
CLUSTER_RETRAIN_EVERY_N_USERS = max(1, _safe_int_env("CLUSTER_RETRAIN_EVERY_N_USERS", 5))
CLUSTER_RETRAIN_MIN_INTERVAL_SECONDS = max(
    0, _safe_int_env("CLUSTER_RETRAIN_MIN_INTERVAL_SECONDS", 3600)
)
CLUSTER_RETRAIN_MIN_TOTAL_USERS = max(2, _safe_int_env("CLUSTER_RETRAIN_MIN_TOTAL_USERS", 20))
CLUSTER_RETRAIN_MAX_CLUSTERS = max(2, _safe_int_env("CLUSTER_RETRAIN_MAX_CLUSTERS", 12))
ALLOW_CLUSTER_CENTROID_FALLBACK = _safe_bool_env("ALLOW_CLUSTER_CENTROID_FALLBACK", False)
CODE_RUN_TIMEOUT_SECONDS = max(1, min(15, _safe_int_env("CODE_RUN_TIMEOUT_SECONDS", 4)))
CODE_RUN_MAX_OUTPUT_CHARS = max(1024, _safe_int_env("CODE_RUN_MAX_OUTPUT_CHARS", 20000))
CODE_RUN_MAX_CODE_CHARS = max(1000, _safe_int_env("CODE_RUN_MAX_CODE_CHARS", 200000))
CODE_RUN_MAX_TESTCASES = max(1, min(16, _safe_int_env("CODE_RUN_MAX_TESTCASES", 8)))

EDITOR_LANGUAGE_CHOICES = [
    {"value": "c11_gcc5", "label": "GNU GCC C11 5.1.0"},
    {"value": "cpp17", "label": "GNU G++17 7.3.0"},
    {"value": "cpp20", "label": "GNU G++20 13.2 (64 bit, winlibs)"},
    {"value": "cpp23", "label": "GNU G++23 14.2 (64 bit, msys2)"},
    {"value": "csharp8", "label": "C# 8, .NET Core 3.1"},
    {"value": "csharp10", "label": "C# 10, .NET SDK 6.0"},
    {"value": "csharp13", "label": "C# 13, .NET SDK 9"},
    {"value": "csharp_mono", "label": "C# Mono 6.8"},
    {"value": "dmd32", "label": "D DMD32 v2.105.0"},
    {"value": "fsharp9", "label": "F# 9, .NET SDK 9"},
    {"value": "go122", "label": "Go 1.22.2"},
    {"value": "haskell810", "label": "Haskell GHC 8.10.1"},
    {"value": "java21", "label": "Java 21 64bit"},
    {"value": "java8", "label": "Java 8 32bit"},
    {"value": "kotlin1720", "label": "Kotlin 1.7.20"},
    {"value": "kotlin1921", "label": "Kotlin 1.9.21"},
    {"value": "kotlin220", "label": "Kotlin 2.2.0"},
    {"value": "ocaml4021", "label": "OCaml 4.02.1"},
    {"value": "delphi7", "label": "Delphi 7"},
    {"value": "freepascal322", "label": "Free Pascal 3.2.2"},
    {"value": "pascalabc383", "label": "PascalABC.NET 3.8.3"},
    {"value": "perl520", "label": "Perl 5.20.1"},
    {"value": "php81", "label": "PHP 8.1.7"},
    {"value": "python2", "label": "Python 2.7.18"},
    {"value": "python313", "label": "Python 3.13.2"},
    {"value": "pypy27", "label": "PyPy 2.7.13 (7.3.0)"},
    {"value": "pypy369", "label": "PyPy 3.6.9 (7.3.0)"},
    {"value": "pypy310", "label": "PyPy 3.10 (7.3.15, 64bit)"},
    {"value": "ruby322", "label": "Ruby 3.2.2"},
    {"value": "rust2021", "label": "Rust 1.89.0 (2021)"},
    {"value": "rust2024", "label": "Rust 1.89.0 (2024)"},
    {"value": "scala2128", "label": "Scala 2.12.8"},
    {"value": "javascript_v8", "label": "JavaScript V8 4.8.0"},
    {"value": "nodejs158", "label": "Node.js 15.8.0 (64bit)"},
]

EDITOR_LANGUAGE_ALIAS_MAP = {
    "python3": "python313",
    "java17": "java21",
}


def _set_db_mode(mode: str):
    global _db_mode
    with _db_mode_lock:
        if _db_mode == mode:
            return
        logger.warning("Database mode switched from '%s' to '%s'", _db_mode, mode)
        _db_mode = mode


def _get_db_mode() -> str:
    with _db_mode_lock:
        return _db_mode


def get_collection():
    global _mongo_client
    if _mongo_client is None:
        with _mongo_client_lock:
            if _mongo_client is None:
                mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
                _mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db_name = os.getenv("MONGO_DB_NAME", "cp_mentor")
    collection_name = os.getenv("MONGO_COLLECTION_NAME", "user_details")
    return _mongo_client[db_name][collection_name]


def _get_database():
    global _mongo_client
    if _mongo_client is None:
        with _mongo_client_lock:
            if _mongo_client is None:
                mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
                _mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db_name = os.getenv("MONGO_DB_NAME", "cp_mentor")
    return _mongo_client[db_name]


def _get_training_snapshots_collection():
    return _get_database()[MONGO_TRAINING_SNAPSHOTS_COLLECTION]


def _get_model_meta_collection():
    return _get_database()[MONGO_MODEL_META_COLLECTION]


def _memory_find_user_by_email(email: str):
    email_norm = email.strip().lower()
    with _memory_lock:
        user_id = _memory_email_index.get(email_norm)
        if not user_id:
            return None
        return copy.deepcopy(_memory_users.get(user_id))


def _memory_find_user_by_codeforces_id(codeforces_id: str):
    cf_norm = codeforces_id.strip().lower()
    with _memory_lock:
        user_id = _memory_cf_index.get(cf_norm)
        if not user_id:
            return None
        return copy.deepcopy(_memory_users.get(user_id))


def _memory_insert_user(doc: dict):
    global _memory_next_id
    item = copy.deepcopy(doc)
    email = str(item.get("email") or "").strip().lower()
    cf_id = str(item.get("codeforces_id") or "").strip().lower()
    if not email or not cf_id:
        raise ValueError("email and codeforces_id are required")

    with _memory_lock:
        if email in _memory_email_index or cf_id in _memory_cf_index:
            raise MemoryDuplicateKeyError("Email or Codeforces ID already exists")
        item["_id"] = f"local-{_memory_next_id}"
        _memory_next_id += 1
        user_id = str(item["_id"])
        _memory_users[user_id] = item
        _memory_email_index[email] = user_id
        _memory_cf_index[cf_id] = user_id
        return copy.deepcopy(item)


def _memory_save_user(doc: dict):
    global _memory_next_id
    item = copy.deepcopy(doc)
    email = str(item.get("email") or "").strip().lower()
    cf_id = str(item.get("codeforces_id") or "").strip().lower()
    if not cf_id:
        raise ValueError("codeforces_id is required")

    with _memory_lock:
        user_id = str(item.get("_id") or "")
        if not user_id:
            existing_id = _memory_cf_index.get(cf_id)
            if existing_id:
                user_id = existing_id
            else:
                user_id = f"local-{_memory_next_id}"
                _memory_next_id += 1
            item["_id"] = user_id

        existing = _memory_users.get(user_id)
        if existing:
            old_email = str(existing.get("email") or "").strip().lower()
            old_cf_id = str(existing.get("codeforces_id") or "").strip().lower()
            if old_email:
                _memory_email_index.pop(old_email, None)
            if old_cf_id:
                _memory_cf_index.pop(old_cf_id, None)

        if email:
            taken = _memory_email_index.get(email)
            if taken and taken != user_id:
                raise MemoryDuplicateKeyError("Email already exists")
        taken_cf = _memory_cf_index.get(cf_id)
        if taken_cf and taken_cf != user_id:
            raise MemoryDuplicateKeyError("Codeforces ID already exists")

        _memory_users[user_id] = item
        _memory_cf_index[cf_id] = user_id
        if email:
            _memory_email_index[email] = user_id
        return copy.deepcopy(item)


def _db_read_with_fallback(op_name: str, mongo_fn, fallback_fn):
    if _get_db_mode() == "memory":
        return fallback_fn()
    try:
        return mongo_fn()
    except PyMongoError:
        logger.exception("%s failed on MongoDB. Using in-memory fallback.", op_name)
        _set_db_mode("memory")
        return fallback_fn()


def _db_write_with_fallback(op_name: str, mongo_fn, fallback_fn):
    if _get_db_mode() == "memory":
        return fallback_fn()
    try:
        return mongo_fn()
    except DuplicateKeyError:
        raise
    except PyMongoError:
        logger.exception("%s failed on MongoDB. Using in-memory fallback.", op_name)
        _set_db_mode("memory")
        return fallback_fn()


def _find_user_by_email(email: str):
    email_norm = email.strip().lower()
    return _db_read_with_fallback(
        "find_user_by_email",
        lambda: get_collection().find_one({"email": email_norm}),
        lambda: _memory_find_user_by_email(email_norm),
    )


def _find_user_by_codeforces_id(codeforces_id: str):
    cf_norm = codeforces_id.strip().lower()

    def mongo_find():
        collection = get_collection()
        doc = collection.find_one({"codeforces_id": cf_norm})
        if doc:
            return doc
        # Backward compatibility: older records may contain mixed-case handles.
        return collection.find_one(
            {"codeforces_id": {"$regex": f"^{re.escape(cf_norm)}$", "$options": "i"}}
        )

    return _db_read_with_fallback(
        "find_user_by_codeforces_id",
        mongo_find,
        lambda: _memory_find_user_by_codeforces_id(cf_norm),
    )


def _insert_user_doc(doc: dict):
    item = copy.deepcopy(doc)
    item["email"] = str(item.get("email") or "").strip().lower()
    item["codeforces_id"] = str(item.get("codeforces_id") or "").strip().lower()

    def mongo_insert():
        result = get_collection().insert_one(item)
        saved = copy.deepcopy(item)
        saved["_id"] = result.inserted_id
        return saved

    def memory_insert():
        return _memory_insert_user(item)

    try:
        return _db_write_with_fallback("insert_user_doc", mongo_insert, memory_insert)
    except MemoryDuplicateKeyError as exc:
        raise DuplicateKeyError(str(exc))


def _save_user_doc(doc: dict):
    item = copy.deepcopy(doc)
    item["email"] = str(item.get("email") or "").strip().lower()
    item["codeforces_id"] = str(item.get("codeforces_id") or "").strip().lower()

    def mongo_save():
        collection = get_collection()
        if item.get("_id") is not None:
            collection.replace_one({"_id": item["_id"]}, item, upsert=True)
        else:
            collection.replace_one({"codeforces_id": item["codeforces_id"]}, item, upsert=True)
        return collection.find_one({"codeforces_id": item["codeforces_id"]})

    def memory_save():
        return _memory_save_user(item)

    try:
        return _db_write_with_fallback("save_user_doc", mongo_save, memory_save)
    except MemoryDuplicateKeyError as exc:
        raise DuplicateKeyError(str(exc))


def _serialize_user(doc: dict | None):
    if not doc:
        return None
    return {
        "id": str(doc.get("_id", "")),
        "username": str(doc.get("username") or ""),
        "email": str(doc.get("email") or ""),
        "codeforces_id": str(doc.get("codeforces_id") or ""),
    }


def init_collection() -> None:
    collection = get_collection()
    try:
        collection.database.command("ping")
    except Exception:
        logger.exception("MongoDB ping failed during startup; switching to in-memory fallback")
        _set_db_mode("memory")
        return
    _set_db_mode("mongo")
    collection.create_index([("email", ASCENDING)], unique=True, name="user_details_email_key")
    collection.create_index(
        [("codeforces_id", ASCENDING)],
        unique=True,
        name="user_details_codeforces_id_key",
    )
    snapshots = _get_training_snapshots_collection()
    snapshots.create_index([("user_id", ASCENDING)], unique=True, name="training_snapshots_user_id_key")
    snapshots.create_index([("timestamp", ASCENDING)], name="training_snapshots_timestamp_idx")
    model_meta = _get_model_meta_collection()


@app.on_event("startup")
def on_startup() -> None:
    init_collection()
    try:
        _load_saved_cluster_artifacts()
    except ModelUnavailableError:
        logger.exception("Cluster model initialization failed")
        if CLUSTER_MODEL_STRICT:
            raise


@app.on_event("shutdown")
def on_shutdown() -> None:
    global _mongo_client
    if _mongo_client is not None:
        _mongo_client.close()
        _mongo_client = None


@app.get("/api/health")
def health():
    mongo_status = "ok"
    db_mode = _get_db_mode()
    try:
        get_collection().database.command("ping")
    except Exception:
        mongo_status = "unavailable"
        if db_mode != "memory":
            _set_db_mode("memory")
            db_mode = "memory"

    model_status = "ok"
    model_detail = ""
    model_clusters = None
    try:
        _, model = _load_saved_cluster_artifacts()
        model_clusters = _to_int(getattr(model, "n_clusters", 0), fallback=0) or None
    except ModelUnavailableError as exc:
        model_status = "unavailable"
        model_detail = str(exc)
    except Exception:
        model_status = "error"
        model_detail = "Cluster model health check failed"

    training_meta = _read_model_meta()
    storage_backend = "mongodb" if db_mode == "mongo" else "in_memory_fallback"
    _, cookie_valid, cookie_status = _get_codeforces_cookie()
    return {
        "status": "ok",
        "mongo": mongo_status,
        "db_mode": db_mode,
        "database_available": True,
        "storage_backend": storage_backend,
        "dynamic_model_state_backend": "mongodb" if db_mode == "mongo" else "local_file_fallback",
        "cluster_model_status": model_status,
        "cluster_model_detail": model_detail,
        "cluster_count": model_clusters,
        "allow_cluster_centroid_fallback": ALLOW_CLUSTER_CENTROID_FALLBACK,
        "codeforces_cookie_status": cookie_status,
        "codeforces_cookie_configured": cookie_valid,
        "cluster_training_meta": training_meta,
    }


@app.post("/api/signup")
def signup(payload: SignUpPayload):
    username = payload.username.strip()
    email = payload.email.strip().lower()
    password = payload.password
    codeforces_id_raw = payload.codeforcesId.strip()
    codeforces_id = codeforces_id_raw.lower()

    if not username or not email or not password or not codeforces_id:
        raise HTTPException(
            status_code=400, detail="username, email, password and codeforcesId are required"
        )
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long",
        )
    if not CODEFORCES_HANDLE_RE.fullmatch(codeforces_id_raw):
        raise HTTPException(status_code=400, detail="Invalid codeforcesId format")

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    try:
        doc = {
            "username": username,
            "email": email,
            "codeforces_id": codeforces_id,
            "password_hash": password_hash,
            "created_at": int(time.time()),
            "updated_at": int(time.time()),
            "preferences": {
                "selected_topics": [],
                "weekly_contest_schedule": None,
            },
            "cluster_current": None,
            "cluster_source": None,
            "cluster_updated_at": None,
            "cluster_history": [],
            "sheet_cache": None,
            "sheet_cache_key": None,
            "latest_contest_result": None,
            "contest_history": [],
        }
        created_doc = _insert_user_doc(doc)
        user = _serialize_user(created_doc)
        _async_refresh_user_model_state(codeforces_id, source="signup")
        return {"message": "User created successfully", "user": user}
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Email or Codeforces ID already exists")
    except Exception:
        logger.exception("Failed to create user account for email='%s'", email)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/login")
def login(payload: LoginPayload):
    email = payload.email.strip().lower()
    password = payload.password

    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password are required")

    try:
        user = _find_user_by_email(email)
        if user is None:
            return JSONResponse(
                status_code=401,
                content={"alert": INVALID_CREDENTIALS_MSG, "detail": INVALID_CREDENTIALS_MSG},
            )

        password_hash = user.get("password_hash") or ""
        if not password_hash or not bcrypt.checkpw(
            password.encode("utf-8"), password_hash.encode("utf-8")
        ):
            return JSONResponse(
                status_code=401,
                content={"alert": INVALID_CREDENTIALS_MSG, "detail": INVALID_CREDENTIALS_MSG},
            )

        serialized_user = _serialize_user(user)
        _async_refresh_user_model_state(serialized_user.get("codeforces_id", ""), source="login")
        return {
            "message": "Login successful",
            "user": serialized_user,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Login failed for email='%s'", email)
        raise HTTPException(status_code=500, detail="Internal server error")


def _to_float(value, fallback=0.0):
    try:
        if value in (None, ""):
            return fallback
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _to_int(value, fallback=0):
    try:
        if value in (None, ""):
            return fallback
        return int(float(value))
    except (TypeError, ValueError):
        return fallback


def _normalize_topic(topic: str):
    value = str(topic or "").strip().lower()
    return value or None


def _normalize_topics(topics: list[str] | None):
    allowed = set(_load_model_topics())
    out = []
    seen = set()
    for topic in topics or []:
        normalized = _normalize_topic(topic)
        if not normalized or normalized not in allowed or normalized in seen:
            continue
        seen.add(normalized)
        out.append(normalized)
    return out


def _get_user_doc(codeforces_id: str):
    return _find_user_by_codeforces_id(codeforces_id.strip().lower())


def _save_user_doc_by_codeforces(codeforces_id: str, mutator):
    cf_id = codeforces_id.strip().lower()
    doc = _get_user_doc(cf_id)
    if not doc:
        return None
    mutator(doc)
    doc["updated_at"] = int(time.time())
    return _save_user_doc(doc)


def _get_user_selected_topics(codeforces_id: str):
    doc = _get_user_doc(codeforces_id)
    if not doc:
        return []
    preferences = doc.get("preferences") or {}
    return _normalize_topics(preferences.get("selected_topics") or [])


def _set_user_selected_topics(codeforces_id: str, topics: list[str]):
    normalized_topics = _normalize_topics(topics)

    def apply(doc):
        preferences = dict(doc.get("preferences") or {})
        preferences["selected_topics"] = normalized_topics
        doc["preferences"] = preferences

    saved = _save_user_doc_by_codeforces(codeforces_id, apply)
    return normalized_topics, saved


def _normalize_contest_duration_seconds(value, fallback=WEEKLY_CONTEST_DURATION_SECONDS):
    allowed = {3600, 7200, 10800}
    parsed = _to_int(value, fallback=fallback)
    if parsed in allowed:
        return parsed
    if parsed < 5400:
        return 3600
    if parsed < 9000:
        return 7200
    return 10800


def _get_user_weekly_schedule(codeforces_id: str):
    doc = _get_user_doc(codeforces_id)
    if not doc:
        return None, None
    preferences = dict(doc.get("preferences") or {})
    return doc, preferences.get("weekly_contest_schedule")


def _compute_current_weekly_contest_window(
    schedule: dict | None,
    duration_seconds: int | None = None,
    now_ts: int | None = None,
):
    out = {
        "configured": False,
        "is_open_now": False,
        "window_start_ts": None,
        "window_end_ts": None,
        "next_window_start_ts": None,
        "window_start_iso": None,
        "window_end_iso": None,
        "next_window_start_iso": None,
    }
    if not isinstance(schedule, dict):
        return out

    weekday = _to_int(schedule.get("weekday"), fallback=-1)
    hour = _to_int(schedule.get("hour"), fallback=-1)
    minute = _to_int(schedule.get("minute"), fallback=-1)
    tz_offset_minutes = _to_int(schedule.get("timezone_offset_minutes"), fallback=0)
    if weekday < 0 or weekday > 6 or hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return out

    configured_duration = schedule.get("contest_duration_seconds")
    if duration_seconds is None:
        safe_duration = _normalize_contest_duration_seconds(
            configured_duration, fallback=WEEKLY_CONTEST_DURATION_SECONDS
        )
    else:
        safe_duration = _normalize_contest_duration_seconds(
            duration_seconds, fallback=WEEKLY_CONTEST_DURATION_SECONDS
        )
    target_py_weekday = (weekday + 6) % 7  # JS weekday (Sun=0..Sat=6) -> Python weekday
    now_utc = datetime.fromtimestamp(_to_int(now_ts, fallback=int(time.time())), tz=timezone.utc)
    local_now = now_utc - timedelta(minutes=tz_offset_minutes)

    slot_local = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    days_back = (local_now.weekday() - target_py_weekday) % 7
    start_local = slot_local - timedelta(days=days_back)
    if start_local > local_now:
        start_local -= timedelta(days=7)

    window_start_utc = start_local + timedelta(minutes=tz_offset_minutes)
    window_end_utc = window_start_utc + timedelta(seconds=safe_duration)
    next_window_start_utc = window_start_utc + timedelta(days=7)

    out.update(
        {
            "configured": True,
            "is_open_now": window_start_utc <= now_utc < window_end_utc,
            "window_start_ts": int(window_start_utc.timestamp()),
            "window_end_ts": int(window_end_utc.timestamp()),
            "next_window_start_ts": int(next_window_start_utc.timestamp()),
            "window_start_iso": window_start_utc.isoformat(),
            "window_end_iso": window_end_utc.isoformat(),
            "next_window_start_iso": next_window_start_utc.isoformat(),
        }
    )
    return out


def _require_contest_window_open(
    codeforces_id: str,
    now_ts: int | None = None,
    duration_seconds: int | None = None,
):
    doc, schedule = _get_user_weekly_schedule(codeforces_id)
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    contest_window = _compute_current_weekly_contest_window(
        schedule, duration_seconds=duration_seconds, now_ts=now_ts
    )
    if not contest_window.get("configured"):
        raise HTTPException(status_code=400, detail="Weekly contest schedule is not configured")
    if not contest_window.get("is_open_now"):
        raise HTTPException(
            status_code=403,
            detail=(
                "Contest is locked outside the saved schedule. "
                f"Next window starts at {contest_window.get('next_window_start_iso')}"
            ),
        )
    return contest_window


def _compute_next_weekly_contest_timestamp(schedule: dict | None):
    if not isinstance(schedule, dict):
        return None
    weekday = _to_int(schedule.get("weekday"), fallback=-1)
    hour = _to_int(schedule.get("hour"), fallback=-1)
    minute = _to_int(schedule.get("minute"), fallback=-1)
    tz_offset_minutes = _to_int(schedule.get("timezone_offset_minutes"), fallback=0)
    if weekday < 0 or weekday > 6 or hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None

    # JS weekday (Sun=0..Sat=6) -> Python weekday (Mon=0..Sun=6)
    target_py_weekday = (weekday + 6) % 7

    now_utc = datetime.now(timezone.utc)
    local_now = now_utc - timedelta(minutes=tz_offset_minutes)
    candidate_local = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    days_ahead = (target_py_weekday - local_now.weekday()) % 7
    candidate_local = candidate_local + timedelta(days=days_ahead)
    if candidate_local <= local_now:
        candidate_local = candidate_local + timedelta(days=7)

    candidate_utc = candidate_local + timedelta(minutes=tz_offset_minutes)
    return int(candidate_utc.timestamp())


def _serialize_weekly_schedule(schedule: dict | None):
    if not isinstance(schedule, dict):
        return None
    duration_seconds = _normalize_contest_duration_seconds(
        schedule.get("contest_duration_seconds"), fallback=WEEKLY_CONTEST_DURATION_SECONDS
    )
    next_ts = _compute_next_weekly_contest_timestamp(schedule)
    payload = {
        "weekday": _to_int(schedule.get("weekday"), fallback=-1),
        "hour": _to_int(schedule.get("hour"), fallback=-1),
        "minute": _to_int(schedule.get("minute"), fallback=-1),
        "timezone_offset_minutes": _to_int(schedule.get("timezone_offset_minutes"), fallback=0),
        "contest_duration_seconds": duration_seconds,
        "next_contest_at": next_ts,
    }
    if next_ts:
        payload["next_contest_at_iso"] = datetime.fromtimestamp(next_ts, tz=timezone.utc).isoformat()
    return payload


def _record_cluster_state(
    codeforces_id: str,
    cluster: str | None,
    source: str,
    topic_rows: list[dict],
    rating: float,
):
    normalized_cluster = _normalize_cluster_label(cluster) or "C0"
    ts = int(time.time())
    topic_snapshot = []
    for row in topic_rows:
        topic = _normalize_topic(row.get("topic"))
        if not topic:
            continue
        topic_snapshot.append(
            {
                "topic": topic,
                "attempted_unique": _to_int(row.get("attempted_unique"), fallback=0),
                "solved_unique": _to_int(row.get("solved_unique"), fallback=0),
                "accuracy_unique": round(_to_float(row.get("accuracy_unique"), fallback=0.0), 4),
                "struggle_score": round(_to_float(row.get("struggle_score"), fallback=0.0), 4),
            }
        )

    def apply(doc):
        history = list(doc.get("cluster_history") or [])
        history.append(
            {
                "cluster": normalized_cluster,
                "source": source,
                "timestamp": ts,
                "rating": round(_to_float(rating, fallback=0.0), 2),
            }
        )
        doc["cluster_history"] = history[-30:]
        doc["cluster_current"] = normalized_cluster
        doc["cluster_source"] = source
        doc["cluster_updated_at"] = ts
        doc["topic_progress_snapshot"] = topic_snapshot
        doc["topic_progress_updated_at"] = ts

    return _save_user_doc_by_codeforces(codeforces_id, apply)


def _record_contest_result(codeforces_id: str, result_payload: dict):
    def apply(doc):
        history = list(doc.get("contest_history") or [])
        history.append(result_payload)
        doc["contest_history"] = history[-20:]
        doc["latest_contest_result"] = result_payload
        # Clear sheet cache to force dynamic update after contest completion.
        doc["sheet_cache"] = None
        doc["sheet_cache_key"] = None

    return _save_user_doc_by_codeforces(codeforces_id, apply)


@lru_cache(maxsize=1)
def _load_training_feature_columns():
    with TRAINING_FEATURE_COLUMNS_FILE.open(encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


@lru_cache(maxsize=1)
def _load_model_topics():
    cols = _load_training_feature_columns()
    prefixes = (
        "accuracy_unique_",
        "attempted_unique_",
        "struggle_score_",
    )
    topics = set()
    for col in cols:
        for prefix in prefixes:
            if col.startswith(prefix):
                topics.add(col[len(prefix) :])
    return sorted(topics)


@lru_cache(maxsize=1)
def _load_user_cluster_map():
    import csv

    data = {}
    with USER_CLUSTERS_FILE.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            data[row["user_id"]] = row["cluster"]
    return data


@lru_cache(maxsize=1)
def _load_user_rating_map():
    import csv

    data = {}
    with USER_PROFILE_FILE.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            data[row["user_id"]] = _to_float(row.get("rating"), fallback=0.0)
    return data


@lru_cache(maxsize=1)
def _load_user_topic_rows():
    import csv

    rows_by_user = {}
    with TOPIC_FEATURES_FILE.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows_by_user.setdefault(row["user_id"], []).append(row)
    return rows_by_user


@lru_cache(maxsize=1)
def _load_cluster_topic_problem_rows():
    import csv

    rows_by_cluster_topic = {}
    with CLUSTER_STATS_FILE.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = (row["cluster"], row["topic"])
            rows_by_cluster_topic.setdefault(key, []).append(row)
    return rows_by_cluster_topic


def _resolve_dataset_user_id(codeforces_id: str):
    ids = set(_load_user_cluster_map().keys())
    ids.update(_load_user_topic_rows().keys())
    ids.update(_load_user_rating_map().keys())

    if codeforces_id in ids:
        return codeforces_id, "exact"

    low_map = {}
    for user_id in ids:
        low_map[user_id.lower()] = user_id
    found = low_map.get(codeforces_id.lower())
    if found:
        return found, "case_insensitive"
    return None, None


def _load_solved_problem_keys(user_id: str):
    import csv

    solved = set()
    with PROBLEM_HISTORY_FILE.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("user_id") != user_id:
                continue
            if _to_int(row.get("solved"), fallback=0) == 1:
                solved.add(row.get("problem_key"))
    return solved


def _cache_get(cache_obj, cache_lock, key):
    now = time.time()
    with cache_lock:
        cached = cache_obj.get(key)
        if not cached:
            return None
        expires_at, payload = cached
        if expires_at <= now:
            cache_obj.pop(key, None)
            return None
        return payload


def _cache_set(cache_obj, cache_lock, key, payload, ttl_seconds: int):
    if ttl_seconds <= 0:
        return
    expires_at = time.time() + ttl_seconds
    with cache_lock:
        cache_obj[key] = (expires_at, payload)


def _cf_api_get(method: str, use_cache: bool = True, **params):
    cache_key = (
        method,
        tuple(sorted((str(k), str(v)) for k, v in params.items())),
    )
    if use_cache:
        cached = _cache_get(_cf_api_cache, _cf_api_cache_lock, cache_key)
        if cached is not None:
            return cached

    query = urlencode(params)
    url = f"https://codeforces.com/api/{method}?{query}"
    with urlopen(url, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    if payload.get("status") != "OK":
        raise ValueError(payload.get("comment", "Codeforces API call failed"))
    result = payload.get("result", [])
    if use_cache:
        _cache_set(_cf_api_cache, _cf_api_cache_lock, cache_key, result, CF_API_CACHE_TTL_SECONDS)
    return result


def _iso_to_timestamp(iso_value: str):
    if not iso_value:
        return 0
    try:
        cleaned = iso_value.replace("Z", "+00:00")
        return int(datetime.fromisoformat(cleaned).timestamp())
    except (TypeError, ValueError):
        return 0


def _fetch_contest_hive(platform_slug: str):
    url = f"https://contest-hive.vercel.app/api/{platform_slug}"
    with urlopen(url, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    if not payload.get("ok"):
        raise ValueError(f"Contest Hive API failed for {platform_slug}")
    return payload


def _codeforces_page_headers(referer: str | None = None):
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": (
            "text/html,application/xhtml+xml,application/xml;q=0.9,"
            "image/avif,image/webp,*/*;q=0.8"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
    }
    if referer:
        headers["Referer"] = referer

    # Optional session cookie for private/hidden submission source pages.
    cookie, cookie_valid, _ = _get_codeforces_cookie()
    if cookie_valid and cookie:
        headers["Cookie"] = cookie
    return headers


def _get_codeforces_cookie():
    cookie = os.getenv("CODEFORCES_COOKIE", "").strip()
    if not cookie:
        return "", False, "missing"
    if len(cookie) >= 2 and (
        (cookie[0] == '"' and cookie[-1] == '"') or (cookie[0] == "'" and cookie[-1] == "'")
    ):
        cookie = cookie[1:-1].strip()
    if not cookie:
        return "", False, "missing"

    parts = [seg.strip() for seg in cookie.split(";") if seg.strip()]
    if not parts or any("=" not in seg for seg in parts):
        return cookie, False, "malformed"
    return cookie, True, "ok"


def _decode_http_body(resp, raw: bytes):
    charset = ""
    try:
        charset = resp.headers.get_content_charset() or ""
    except Exception:
        charset = ""
    if charset:
        try:
            return raw.decode(charset, errors="replace")
        except Exception:
            pass
    return raw.decode("utf-8", errors="replace")


def _fetch_codeforces_page_html(url: str, referer: str | None = None, timeout: int = 20):
    contexts = [None]
    try:
        import certifi

        contexts.append(ssl.create_default_context(cafile=certifi.where()))
    except Exception:
        pass
    if hasattr(ssl, "_create_unverified_context"):
        contexts.append(ssl._create_unverified_context())

    retryable_statuses = {403, 429, 500, 502, 503, 504}
    last_exc = None
    headers = _codeforces_page_headers(referer=referer)

    for context in contexts:
        for attempt in range(2):
            try:
                request = Request(url, headers=headers)
                with urlopen(request, timeout=timeout, context=context) as resp:
                    raw = resp.read()
                    return _decode_http_body(resp, raw)
            except HTTPError as exc:
                last_exc = exc
                if exc.code in retryable_statuses and attempt == 0:
                    time.sleep(0.35)
                    continue
                break
            except Exception as exc:
                last_exc = exc
                if attempt == 0:
                    time.sleep(0.35)
                    continue
                break

    if last_exc:
        raise last_exc
    raise RuntimeError("Failed to fetch Codeforces page")


def _normalize_problem_url(cf_link: str):
    value = str(cf_link or "").strip()
    if not value:
        raise ValueError("cfLink is required")
    if value.startswith("codeforces.com/"):
        value = f"https://{value}"
    if "://" not in value:
        value = f"https://{value}"

    parsed = urlparse(value)
    host = (parsed.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if host != "codeforces.com":
        raise ValueError("Only codeforces.com problem links are supported")

    path = (parsed.path or "").rstrip("/")
    if not path:
        raise ValueError("Invalid Codeforces problem link")
    if not (
        CODEFORCES_CONTEST_PROBLEM_PATH_RE.match(path)
        or CODEFORCES_PROBLEMSET_PROBLEM_PATH_RE.match(path)
    ):
        raise ValueError("Only Codeforces contest/problemset problem links are supported")
    return f"https://codeforces.com{path}"


def _normalize_submission_url(submission_url: str):
    value = str(submission_url or "").strip()
    if not value:
        raise ValueError("submissionUrl is required")
    if value.startswith("codeforces.com/"):
        value = f"https://{value}"
    if "://" not in value:
        value = f"https://{value}"

    parsed = urlparse(value)
    host = (parsed.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if host != "codeforces.com":
        raise ValueError("Only codeforces.com submission URLs are supported")

    path = (parsed.path or "").rstrip("/")
    normalized = f"https://codeforces.com{path}"
    if not CODEFORCES_SUBMISSION_LINK_RE.match(normalized):
        raise ValueError("Only Codeforces contest/problemset submission URLs are supported")
    return normalized


def _derive_problem_submit_url(problem_url: str):
    parsed = urlparse(problem_url)
    path = (parsed.path or "").rstrip("/")

    contest_match = CODEFORCES_CONTEST_PROBLEM_PATH_RE.match(path)
    if contest_match:
        contest_id = contest_match.group("contest_id")
        return f"https://codeforces.com/contest/{contest_id}/submit"

    problemset_match = CODEFORCES_PROBLEMSET_PROBLEM_PATH_RE.match(path)
    if problemset_match:
        contest_id = problemset_match.group("contest_id")
        problem_index = problemset_match.group("problem_index")
        return (
            f"https://codeforces.com/problemset/submit?"
            f"contestId={contest_id}&problemIndex={problem_index}"
        )

    return problem_url


def _extract_block_text(node):
    if node is None:
        return ""
    text = node.get_text("\n", strip=True)
    if not text:
        return ""
    text = text.replace("\xa0", " ").replace("\r", "")
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.split("\n")]
    lines = [line for line in lines if line]
    merged = "\n".join(lines).strip()
    return _clean_codeforces_math_text(merged)


def _extract_pre_text(node):
    if node is None:
        return ""
    text = node.get_text("\n", strip=False)
    if not text:
        return ""
    cleaned = text.replace("\xa0", " ").replace("\r", "").strip("\n")
    return _clean_codeforces_math_text(cleaned)


def _strip_section_heading(text: str, heading: str):
    lines = [line.strip() for line in str(text or "").split("\n")]
    lines = [line for line in lines if line]
    if lines and lines[0].lower() == heading.lower():
        lines = lines[1:]
    return "\n".join(lines).strip()


def _clean_codeforces_math_text(text: str):
    value = str(text or "")
    if not value:
        return ""

    # CF statements often contain TeX delimiters and commands; convert a useful subset.
    out = value
    out = out.replace("$$$", "")
    out = out.replace("$$", "")
    out = out.replace("$", "")
    out = out.replace("\\leq", "≤").replace("\\le", "≤")
    out = out.replace("\\geq", "≥").replace("\\ge", "≥")
    out = out.replace("\\times", "×").replace("\\cdot", "·")
    out = out.replace("\\ldots", "...")
    out = out.replace("\\{", "{").replace("\\}", "}")
    out = out.replace("\\(", "(").replace("\\)", ")")
    out = out.replace("\\[", "[").replace("\\]", "]")
    out = re.sub(r"\\text\{([^}]*)\}", r"\1", out)
    out = re.sub(r"\\frac\{([^{}]+)\}\{([^{}]+)\}", r"(\1)/(\2)", out)
    out = re.sub(r"\\max\{([^{}]+)\}", r"max(\1)", out)
    out = re.sub(r"\\min\{([^{}]+)\}", r"min(\1)", out)
    out = re.sub(r"\\[a-zA-Z]+", "", out)
    out = out.replace("{", "").replace("}", "")
    out = re.sub(r"[ \t]+\n", "\n", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def _extract_constraints(statement_text: str, input_text: str):
    candidates = []
    seen = set()
    pattern = re.compile(r"(constraint|<=|>=|≤|≥|10\^|up to|at most|at least)", re.IGNORECASE)
    for source in (input_text, statement_text):
        for raw_line in str(source or "").split("\n"):
            line = raw_line.strip()
            if not line:
                continue
            lowered = line.lower()
            if len(lowered) > 220:
                continue
            if pattern.search(line) is None:
                continue
            if line in seen:
                continue
            seen.add(line)
            candidates.append(line)
            if len(candidates) >= 8:
                return candidates
    return candidates


def _canonical_editor_language(language: str):
    value = str(language or "").strip().lower()
    if not value:
        return ""
    return EDITOR_LANGUAGE_ALIAS_MAP.get(value, value)


def _build_local_run_plan(language: str):
    value = _canonical_editor_language(language)
    if value == "c11_gcc5":
        return {
            "language": value,
            "source_filename": "main.c",
            "compile_cmd": ["gcc", "-std=c11", "-O2", "-pipe", "-o", "main", "main.c"],
            "run_cmd": ["./main"],
            "required_bins": ["gcc"],
        }
    if value == "cpp17":
        return {
            "language": value,
            "source_filename": "main.cpp",
            "compile_cmd": ["g++", "-std=gnu++17", "-O2", "-pipe", "-o", "main", "main.cpp"],
            "run_cmd": ["./main"],
            "required_bins": ["g++"],
        }
    if value == "cpp20":
        return {
            "language": value,
            "source_filename": "main.cpp",
            "compile_cmd": ["g++", "-std=gnu++20", "-O2", "-pipe", "-o", "main", "main.cpp"],
            "run_cmd": ["./main"],
            "required_bins": ["g++"],
        }
    if value == "cpp23":
        return {
            "language": value,
            "source_filename": "main.cpp",
            "compile_cmd": ["g++", "-std=gnu++23", "-O2", "-pipe", "-o", "main", "main.cpp"],
            "run_cmd": ["./main"],
            "required_bins": ["g++"],
        }
    if value == "python313":
        return {
            "language": value,
            "source_filename": "main.py",
            "compile_cmd": None,
            "run_cmd": ["python3", "main.py"],
            "required_bins": ["python3"],
        }
    if value == "python2":
        return {
            "language": value,
            "source_filename": "main.py",
            "compile_cmd": None,
            "run_cmd": ["python2", "main.py"],
            "required_bins": ["python2"],
        }
    if value == "pypy27":
        return {
            "language": value,
            "source_filename": "main.py",
            "compile_cmd": None,
            "run_cmd": ["pypy", "main.py"],
            "required_bins": ["pypy"],
        }
    if value in {"pypy369", "pypy310"}:
        return {
            "language": value,
            "source_filename": "main.py",
            "compile_cmd": None,
            "run_cmd": ["pypy3", "main.py"],
            "required_bins": ["pypy3"],
        }
    if value in {"java21", "java8"}:
        return {
            "language": value,
            "source_filename": "Main.java",
            "compile_cmd": ["javac", "Main.java"],
            "run_cmd": ["java", "Main"],
            "required_bins": ["javac", "java"],
        }
    if value == "go122":
        return {
            "language": value,
            "source_filename": "main.go",
            "compile_cmd": ["go", "build", "-o", "main", "main.go"],
            "run_cmd": ["./main"],
            "required_bins": ["go"],
        }
    if value in {"javascript_v8", "nodejs158"}:
        return {
            "language": value,
            "source_filename": "main.js",
            "compile_cmd": None,
            "run_cmd": ["node", "main.js"],
            "required_bins": ["node"],
        }
    if value == "perl520":
        return {
            "language": value,
            "source_filename": "main.pl",
            "compile_cmd": None,
            "run_cmd": ["perl", "main.pl"],
            "required_bins": ["perl"],
        }
    if value == "php81":
        return {
            "language": value,
            "source_filename": "main.php",
            "compile_cmd": None,
            "run_cmd": ["php", "main.php"],
            "required_bins": ["php"],
        }
    if value == "ruby322":
        return {
            "language": value,
            "source_filename": "main.rb",
            "compile_cmd": None,
            "run_cmd": ["ruby", "main.rb"],
            "required_bins": ["ruby"],
        }
    if value == "rust2021":
        return {
            "language": value,
            "source_filename": "main.rs",
            "compile_cmd": ["rustc", "--edition=2021", "-O", "main.rs", "-o", "main"],
            "run_cmd": ["./main"],
            "required_bins": ["rustc"],
        }
    if value == "rust2024":
        return {
            "language": value,
            "source_filename": "main.rs",
            "compile_cmd": ["rustc", "--edition=2024", "-O", "main.rs", "-o", "main"],
            "run_cmd": ["./main"],
            "required_bins": ["rustc"],
        }
    return None


def _resolve_local_run_support(language: str):
    canonical = _canonical_editor_language(language)
    plan = _build_local_run_plan(canonical)
    if not plan:
        return canonical, None, False, [], "Local run is not configured for this language yet"

    missing = [binary for binary in plan.get("required_bins", []) if shutil.which(binary) is None]
    if missing:
        return canonical, plan, False, missing, f"Missing runtime(s): {', '.join(missing)}"
    return canonical, plan, True, [], ""


def _truncate_run_text(value: str, limit: int = CODE_RUN_MAX_OUTPUT_CHARS):
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    if len(text) <= limit:
        return text
    extra = len(text) - limit
    return f"{text[:limit]}\n...[truncated {extra} chars]"


def _normalize_output_for_compare(value: str):
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    return " ".join(text.strip().split())


def _to_subprocess_text(value):
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)


def _run_local_command(cmd: list[str], cwd: Path, timeout_seconds: int, input_text: str = ""):
    started = time.perf_counter()
    try:
        completed = subprocess.run(
            cmd,
            cwd=str(cwd),
            input=str(input_text or ""),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return {
            "timed_out": False,
            "exit_code": completed.returncode,
            "stdout": _truncate_run_text(completed.stdout),
            "stderr": _truncate_run_text(completed.stderr),
            "elapsed_ms": elapsed_ms,
        }
    except subprocess.TimeoutExpired as exc:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return {
            "timed_out": True,
            "exit_code": None,
            "stdout": _truncate_run_text(_to_subprocess_text(exc.stdout)),
            "stderr": _truncate_run_text(_to_subprocess_text(exc.stderr)),
            "elapsed_ms": elapsed_ms,
        }
    except FileNotFoundError as exc:
        raise RuntimeError(f"Required runtime '{cmd[0]}' is not installed") from exc


def _build_generated_testcases(samples: list[dict]):
    cases = []
    for sample in samples[:CODE_RUN_MAX_TESTCASES]:
        sample_index = _to_int(sample.get("index"), fallback=len(cases) + 1)
        sample_input = str(sample.get("input") or "")
        sample_output = str(sample.get("output") or "")
        if not sample_input and not sample_output:
            continue
        cases.append(
            {
                "index": sample_index,
                "input": sample_input,
                "output": sample_output,
            }
        )
    return cases


def _execute_code_on_generated_testcases(language: str, code: str, testcases: list[dict]):
    source_code = str(code or "")
    if len(source_code) > CODE_RUN_MAX_CODE_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Code is too large. Maximum allowed is {CODE_RUN_MAX_CODE_CHARS} characters.",
        )

    canonical, plan, supported, missing, reason = _resolve_local_run_support(language)
    if not canonical:
        raise HTTPException(status_code=400, detail="language is required")
    if not supported or not plan:
        if missing:
            raise HTTPException(status_code=503, detail=reason)
        raise HTTPException(status_code=400, detail=reason)

    if not testcases:
        raise HTTPException(status_code=400, detail="No generated testcases available for this problem")

    with tempfile.TemporaryDirectory(prefix="cpmentor-run-") as temp_dir:
        workdir = Path(temp_dir)
        source_path = workdir / plan["source_filename"]
        source_path.write_text(source_code, encoding="utf-8")

        compile_payload = {
            "required": bool(plan.get("compile_cmd")),
            "ok": True,
            "timed_out": False,
            "exit_code": 0,
            "stdout": "",
            "stderr": "",
            "elapsed_ms": 0,
        }
        if plan.get("compile_cmd"):
            compile_result = _run_local_command(
                plan["compile_cmd"],
                cwd=workdir,
                timeout_seconds=CODE_RUN_TIMEOUT_SECONDS,
                input_text="",
            )
            compile_payload.update(
                {
                    "ok": bool(
                        not compile_result.get("timed_out")
                        and _to_int(compile_result.get("exit_code"), fallback=1) == 0
                    ),
                    "timed_out": bool(compile_result.get("timed_out")),
                    "exit_code": compile_result.get("exit_code"),
                    "stdout": compile_result.get("stdout", ""),
                    "stderr": compile_result.get("stderr", ""),
                    "elapsed_ms": _to_int(compile_result.get("elapsed_ms"), fallback=0),
                }
            )
            if not compile_payload["ok"]:
                return {
                    "language": canonical,
                    "testcase_count": len(testcases),
                    "generated_testcases_only": True,
                    "compile": compile_payload,
                    "summary": {
                        "passed": 0,
                        "failed": len(testcases),
                        "status": "compile_error",
                    },
                    "results": [],
                }

        results = []
        passed_count = 0
        for idx, testcase in enumerate(testcases, start=1):
            run_result = _run_local_command(
                plan["run_cmd"],
                cwd=workdir,
                timeout_seconds=CODE_RUN_TIMEOUT_SECONDS,
                input_text=testcase.get("input", ""),
            )
            expected_output = str(testcase.get("output") or "")
            actual_output = run_result.get("stdout", "")
            status = "wrong_answer"
            passed = False
            if run_result.get("timed_out"):
                status = "time_limit_exceeded"
            elif _to_int(run_result.get("exit_code"), fallback=1) != 0:
                status = "runtime_error"
            else:
                passed = _normalize_output_for_compare(actual_output) == _normalize_output_for_compare(
                    expected_output
                )
                status = "passed" if passed else "wrong_answer"

            if passed:
                passed_count += 1

            results.append(
                {
                    "index": _to_int(testcase.get("index"), fallback=idx),
                    "input": _truncate_run_text(testcase.get("input", "")),
                    "expected_output": _truncate_run_text(expected_output),
                    "actual_output": actual_output,
                    "stderr": run_result.get("stderr", ""),
                    "exit_code": run_result.get("exit_code"),
                    "timed_out": bool(run_result.get("timed_out")),
                    "elapsed_ms": _to_int(run_result.get("elapsed_ms"), fallback=0),
                    "passed": passed,
                    "status": status,
                }
            )

    failed = len(testcases) - passed_count
    return {
        "language": canonical,
        "testcase_count": len(testcases),
        "generated_testcases_only": True,
        "compile": compile_payload,
        "summary": {
            "passed": passed_count,
            "failed": failed,
            "status": "ok" if failed == 0 else "completed_with_failures",
        },
        "results": results,
    }


def _extract_submission_source_from_html(page_html: str):
    code = ""
    language = ""
    verdict = ""
    page_lower = str(page_html or "").lower()

    if BeautifulSoup is not None:
        try:
            soup = BeautifulSoup(page_html, "html.parser")
            source_node = (
                soup.select_one("#program-source-text")
                or soup.select_one("pre.program-source")
                or soup.select_one("pre.prettyprint")
            )
            if source_node is not None:
                code = source_node.get_text("\n", strip=False).replace("\r\n", "\n").strip("\n")

            language_label_td = soup.find("td", string=re.compile(r"Programming language", re.IGNORECASE))
            if language_label_td is not None:
                language_value_td = language_label_td.find_next_sibling("td")
                if language_value_td is not None:
                    language = language_value_td.get_text(" ", strip=True)

            verdict_node = soup.select_one(".submissionVerdictWrapper")
            if verdict_node is not None:
                verdict = verdict_node.get_text(" ", strip=True)
        except Exception:
            logger.exception("HTML parser fallback failed for submission source page")

    if not code:
        source_match = re.search(
            r'<pre[^>]*id="program-source-text"[^>]*>(.*?)</pre>',
            page_html,
            flags=re.DOTALL | re.IGNORECASE,
        )
        if source_match:
            raw_code = source_match.group(1)
            code = html.unescape(raw_code).replace("\r\n", "\n").strip("\n")

    if not language:
        language_match = re.search(
            r"Programming language</td>\s*<td[^>]*>(.*?)</td>",
            page_html,
            flags=re.DOTALL | re.IGNORECASE,
        )
        language = html.unescape(re.sub(r"<.*?>", "", language_match.group(1)).strip()) if language_match else ""

    if not verdict:
        verdict_match = re.search(
            r"<span[^>]*submissionVerdictWrapper[^>]*>(.*?)</span>",
            page_html,
            flags=re.DOTALL | re.IGNORECASE,
        )
        verdict = html.unescape(re.sub(r"<.*?>", "", verdict_match.group(1)).strip()) if verdict_match else ""

    auth_required = (
        ("enter" in page_lower and "password" in page_lower and "login" in page_lower)
        or "sign in to codeforces" in page_lower
        or "login into codeforces" in page_lower
        or "authorization required" in page_lower
        or "you have no access" in page_lower
    )
    source_unavailable = "source code is not available" in page_lower or "source is not available" in page_lower

    return {
        "code": code,
        "language": language,
        "verdict": verdict,
        "auth_required": auth_required,
        "source_unavailable": source_unavailable,
    }


def _get_problem_key(problem: dict, fallback_index: int = 0):
    contest_id = problem.get("contestId")
    index = problem.get("index")
    if contest_id is not None and index:
        return f"{contest_id}-{index}"

    problemset_name = str(problem.get("problemsetName") or "").strip()
    problem_name = str(problem.get("name") or "").strip()
    if problemset_name and index:
        return f"{problemset_name}-{index}"
    if problem_name and index:
        return f"{problem_name}-{index}"
    if problem_name:
        return problem_name
    return f"misc-{fallback_index}"


def _fetch_user_status_all(
    codeforces_id: str,
    max_total: int = 20000,
    batch_size: int = 5000,
    use_cache: bool = True,
):
    cache_key = (codeforces_id.lower(), max_total, batch_size)
    if use_cache:
        cached = _cache_get(_user_status_cache, _user_status_cache_lock, cache_key)
        if cached is not None:
            return cached

    all_rows = []
    offset = 1
    while len(all_rows) < max_total:
        remaining = max_total - len(all_rows)
        count = min(batch_size, remaining)
        batch = _cf_api_get(
            "user.status",
            use_cache=use_cache,
            handle=codeforces_id,
            **{"from": offset, "count": count},
        )
        if not batch:
            break
        all_rows.extend(batch)
        if len(batch) < count:
            break
        offset += len(batch)
    if use_cache:
        _cache_set(
            _user_status_cache,
            _user_status_cache_lock,
            cache_key,
            all_rows,
            CF_STATUS_CACHE_TTL_SECONDS,
        )
    return all_rows


def _to_title_case(text: str):
    return " ".join(part.capitalize() for part in text.split())


def _time_ago_label(timestamp: int):
    now = int(time.time())
    delta = max(0, now - int(timestamp))
    if delta < 60:
        return f"{delta}s ago"
    if delta < 3600:
        return f"{delta // 60}m ago"
    if delta < 86400:
        return f"{delta // 3600}h ago"
    return f"{delta // 86400}d ago"


def _verdict_tone(verdict: str):
    if verdict == "OK":
        return "green"
    if verdict in {"WRONG_ANSWER", "COMPILATION_ERROR", "RUNTIME_ERROR"}:
        return "red"
    return "yellow"


def _build_dashboard_data(codeforces_id: str):
    profile_rows = _cf_api_get("user.info", handles=codeforces_id)
    if not profile_rows:
        raise ValueError(f"Codeforces user '{codeforces_id}' not found")
    profile = profile_rows[0]

    current_rating = _to_int(profile.get("rating"), fallback=0)
    max_rating = _to_int(profile.get("maxRating"), fallback=current_rating)

    rating_delta = 0
    try:
        rating_changes = _cf_api_get("user.rating", handle=codeforces_id)
        if rating_changes:
            last = rating_changes[-1]
            rating_delta = _to_int(last.get("newRating"), fallback=0) - _to_int(
                last.get("oldRating"), fallback=0
            )
    except Exception:
        rating_delta = 0

    submissions = _fetch_user_status_all(codeforces_id, max_total=20000, batch_size=5000)

    solved_problem_keys = set()
    topic_attempted = defaultdict(set)
    topic_solved = defaultdict(set)
    topic_submission_count = defaultdict(int)
    recent_submissions = []
    model_topics = set(_load_model_topics())

    for idx, sub in enumerate(submissions):
        problem = sub.get("problem") or {}
        contest_id = problem.get("contestId")
        problem_key = _get_problem_key(problem, fallback_index=idx)

        raw_tags = [str(t).strip().lower() for t in (problem.get("tags") or [])]
        tags = [t for t in raw_tags if t in model_topics]
        for topic in tags:
            topic_attempted[topic].add(problem_key)
            topic_submission_count[topic] += 1

        verdict = sub.get("verdict") or "UNKNOWN"
        if verdict == "OK":
            solved_problem_keys.add(problem_key)
            for topic in tags:
                topic_solved[topic].add(problem_key)

        if len(recent_submissions) < 8:
            topic_label = "Other"
            if tags:
                topic_label = _to_title_case(tags[0])
            elif raw_tags:
                topic_label = _to_title_case(raw_tags[0])
            submission_url = ""
            submission_id = sub.get("id")
            if contest_id is not None and submission_id is not None:
                submission_url = (
                    f"https://codeforces.com/contest/{contest_id}/submission/{submission_id}"
                )
            recent_submissions.append(
                {
                    "name": problem.get("name") or problem_key,
                    "topic": topic_label,
                    "verdict": verdict.replace("_", " ").title(),
                    "tone": _verdict_tone(verdict),
                    "time": _time_ago_label(
                        _to_int(sub.get("creationTimeSeconds"), fallback=int(time.time()))
                    ),
                    "view_url": submission_url,
                }
            )

    topic_accuracy = []
    for topic in sorted(model_topics):
        attempt_count = len(topic_attempted[topic])
        solved_count = len(topic_solved[topic])
        acc = int(round((solved_count / attempt_count) * 100)) if attempt_count > 0 else 0
        topic_accuracy.append({"topic": _to_title_case(topic), "value": acc, "attempted": attempt_count})

    # Show practiced topics first, then alphabetical for the full list.
    topic_accuracy.sort(key=lambda row: (-row["attempted"], row["topic"]))
    topic_accuracy = [{"topic": r["topic"], "value": r["value"]} for r in topic_accuracy]

    user_doc = _get_user_doc(codeforces_id) or {}
    preferences = dict(user_doc.get("preferences") or {})
    preferred_topics = _normalize_topics(preferences.get("selected_topics") or [])

    all_topic_progress = []
    for topic in sorted(model_topics):
        attempted = len(topic_attempted[topic])
        solved = len(topic_solved[topic])
        submissions_count = _to_int(topic_submission_count[topic], fallback=0)
        accuracy = (solved / attempted) if attempted > 0 else 0.0
        struggle = submissions_count / max(solved, 1)
        weakness = _compute_weakness(
            {
                "attempted_unique": attempted,
                "accuracy_unique": accuracy,
                "struggle_score": struggle,
            }
        )
        all_topic_progress.append(
            {
                "topic": topic,
                "topic_label": _to_title_case(topic),
                "attempted_unique": attempted,
                "solved_unique": solved,
                "accuracy_unique": round(accuracy, 4),
                "struggle_score": round(struggle, 4),
                "weakness_score": round(weakness, 4),
            }
        )

    progress_by_topic = {row["topic"]: row for row in all_topic_progress}
    fallback_topics = [row["topic"] for row in sorted(all_topic_progress, key=lambda r: r["weakness_score"], reverse=True)]
    weak_topics = preferred_topics or fallback_topics[:5]
    weak_topic_progress = [progress_by_topic[topic] for topic in weak_topics if topic in progress_by_topic]

    weekly_schedule = _serialize_weekly_schedule(preferences.get("weekly_contest_schedule"))
    latest_contest_result = user_doc.get("latest_contest_result")
    cluster_current = _normalize_cluster_label(user_doc.get("cluster_current"))
    cluster_source = user_doc.get("cluster_source")
    cluster_updated_at = _to_int(user_doc.get("cluster_updated_at"), fallback=0)

    return {
        "codeforces_id": codeforces_id,
        "username": profile.get("handle", codeforces_id),
        "rank": profile.get("rank", "unrated"),
        "max_rank": profile.get("maxRank", profile.get("rank", "unrated")),
        "current_rating": current_rating,
        "max_rating": max_rating,
        "rating_delta": rating_delta,
        "friend_of_count": _to_int(profile.get("friendOfCount"), fallback=0),
        "contribution": _to_int(profile.get("contribution"), fallback=0),
        "problems_solved": len(solved_problem_keys),
        "topic_accuracy": topic_accuracy,
        "weak_topic_progress": weak_topic_progress,
        "selected_topics": weak_topics,
        "weekly_contest_schedule": weekly_schedule,
        "latest_contest_result": latest_contest_result,
        "cluster_current": cluster_current,
        "cluster_source": cluster_source,
        "cluster_updated_at": cluster_updated_at,
        "recent_submissions": recent_submissions,
        "last_synced": int(time.time()),
    }


def _build_live_user_features(codeforces_id: str, use_cache: bool = True, lookback_days: int = 0):
    model_topics = set(_load_model_topics())
    topic_stats = defaultdict(lambda: {"attempted": set(), "solved": set(), "submissions": 0})
    solved_problem_keys = set()

    profile_rows = _cf_api_get("user.info", use_cache=use_cache, handles=codeforces_id)
    user_profile = profile_rows[0] if profile_rows else {}
    rating = _to_float(user_profile.get("rating"), fallback=0.0)

    submissions = _fetch_user_status_all(
        codeforces_id,
        max_total=20000,
        batch_size=5000,
        use_cache=use_cache,
    )
    cutoff_ts = 0
    if lookback_days > 0:
        cutoff_ts = int(time.time()) - (lookback_days * 86400)

    per_problem = {}
    for sub in submissions:
        if cutoff_ts > 0:
            created_at = _to_int(sub.get("creationTimeSeconds"), fallback=0)
            if created_at and created_at < cutoff_ts:
                continue
        problem = sub.get("problem") or {}
        problem_key = _get_problem_key(problem)
        tags = set()
        for t in problem.get("tags") or []:
            lowered = str(t).strip().lower()
            if lowered in model_topics:
                tags.add(lowered)
        if not tags:
            continue

        row = per_problem.setdefault(problem_key, {"tags": set(), "submissions": 0, "solved": False})
        row["tags"].update(tags)
        row["submissions"] += 1
        if sub.get("verdict") == "OK":
            row["solved"] = True
            solved_problem_keys.add(problem_key)

    for problem_key, meta in per_problem.items():
        for topic in meta["tags"]:
            topic_stats[topic]["attempted"].add(problem_key)
            topic_stats[topic]["submissions"] += meta["submissions"]
            if meta["solved"]:
                topic_stats[topic]["solved"].add(problem_key)

    topic_rows = []
    for topic in _load_model_topics():
        attempted_unique = len(topic_stats[topic]["attempted"])
        solved_unique = len(topic_stats[topic]["solved"])
        submissions_count = int(topic_stats[topic]["submissions"])
        accuracy = (solved_unique / attempted_unique) if attempted_unique > 0 else 0.0
        struggle = submissions_count / max(solved_unique, 1)

        topic_rows.append(
            {
                "user_id": codeforces_id,
                "topic": topic,
                "attempted_unique": attempted_unique,
                "solved_unique": solved_unique,
                "submissions": submissions_count,
                "accuracy_unique": accuracy,
                "struggle_score": struggle,
            }
        )

    return rating, topic_rows, solved_problem_keys


def _build_feature_vector(topic_rows, rating):
    by_topic = {row.get("topic"): row for row in topic_rows}
    out = {}
    for topic in _load_model_topics():
        row = by_topic.get(topic, {})
        out[f"accuracy_unique_{topic}"] = _to_float(row.get("accuracy_unique"), fallback=0.0)
        out[f"attempted_unique_{topic}"] = _to_float(row.get("attempted_unique"), fallback=0.0)
        out[f"struggle_score_{topic}"] = _to_float(row.get("struggle_score"), fallback=0.0)
    out["rating"] = _to_float(rating, fallback=0.0)
    out["trend_slope"] = 0.0
    return out


def _read_model_meta():
    defaults = {
        "last_retrain_at": 0,
        "last_retrain_user_count": 0,
        "last_retrain_total_samples": 0,
        "last_cluster_count": 0,
        "retrain_runs": 0,
        "last_retrain_reason": "",
    }

    def read_file_meta():
        if not MODEL_META_FILE.exists():
            return defaults
        try:
            with MODEL_META_FILE.open(encoding="utf-8") as f:
                payload = json.load(f)
            if not isinstance(payload, dict):
                return defaults
            merged = dict(defaults)
            merged.update(payload)
            return merged
        except Exception:
            logger.exception("Failed to read model meta file")
            return defaults

    def read_mongo_meta():
        doc = _get_model_meta_collection().find_one({"_id": MODEL_META_DOC_ID}) or {}
        if not isinstance(doc, dict):
            return defaults
        payload = {k: v for k, v in doc.items() if k != "_id"}
        merged = dict(defaults)
        merged.update(payload)
        return merged

    try:
        return _db_read_with_fallback("read_model_meta", read_mongo_meta, read_file_meta)
    except Exception:
        logger.exception("Failed to read model meta from MongoDB; falling back to file")
        return read_file_meta()


def _write_model_meta(meta: dict):
    payload = dict(meta or {})

    def write_file_meta():
        DATASET_DIR.mkdir(parents=True, exist_ok=True)
        with MODEL_META_FILE.open("w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, sort_keys=True)
        return payload

    def write_mongo_meta():
        _get_model_meta_collection().replace_one(
            {"_id": MODEL_META_DOC_ID},
            {"_id": MODEL_META_DOC_ID, **payload},
            upsert=True,
        )
        return payload

    try:
        _db_write_with_fallback("write_model_meta", write_mongo_meta, write_file_meta)
    except Exception:
        logger.exception("Failed to write model meta to MongoDB; falling back to file")
        write_file_meta()


def _training_snapshot_fieldnames(cols: list[str]):
    return ["user_id", "timestamp", "source", *cols]


def _append_dynamic_training_snapshot(codeforces_id: str, topic_rows: list[dict], rating: float, source: str):
    if not codeforces_id or not topic_rows:
        return None

    cols = _load_training_feature_columns()
    feature_map = _build_feature_vector(topic_rows, rating)
    row = {
        "user_id": codeforces_id.strip().lower(),
        "timestamp": int(time.time()),
        "source": source,
    }
    for col in cols:
        row[col] = _to_float(feature_map.get(col), fallback=0.0)

    def append_file_snapshot():
        DATASET_DIR.mkdir(parents=True, exist_ok=True)
        file_exists = DYNAMIC_TRAINING_SNAPSHOTS_FILE.exists() and DYNAMIC_TRAINING_SNAPSHOTS_FILE.stat().st_size > 0
        with DYNAMIC_TRAINING_SNAPSHOTS_FILE.open("a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=_training_snapshot_fieldnames(cols))
            if not file_exists:
                writer.writeheader()
            writer.writerow(row)
        return row

    def upsert_mongo_snapshot():
        _get_training_snapshots_collection().replace_one(
            {"user_id": row["user_id"]},
            row,
            upsert=True,
        )
        return row

    try:
        _db_write_with_fallback(
            "append_dynamic_training_snapshot",
            upsert_mongo_snapshot,
            append_file_snapshot,
        )
    except Exception:
        logger.exception("Failed to upsert dynamic snapshot in MongoDB; falling back to file")
        append_file_snapshot()
    return row


def _load_dynamic_latest_feature_vectors(cols: list[str]):
    def load_from_file():
        latest_by_user = {}
        if not DYNAMIC_TRAINING_SNAPSHOTS_FILE.exists():
            return latest_by_user
        try:
            with DYNAMIC_TRAINING_SNAPSHOTS_FILE.open(newline="", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    user_id = str(row.get("user_id") or "").strip().lower()
                    if not user_id:
                        continue
                    timestamp = _to_int(row.get("timestamp"), fallback=0)
                    existing = latest_by_user.get(user_id)
                    if existing and timestamp <= existing["timestamp"]:
                        continue
                    latest_by_user[user_id] = {
                        "timestamp": timestamp,
                        "vector": [_to_float(row.get(col), fallback=0.0) for col in cols],
                    }
        except Exception:
            logger.exception("Failed to load dynamic training snapshots from file")
        return latest_by_user

    def load_from_mongo():
        latest_by_user = {}
        projection = {"_id": 0, "user_id": 1, "timestamp": 1, **{col: 1 for col in cols}}
        cursor = _get_training_snapshots_collection().find({}, projection=projection)
        for row in cursor:
            user_id = str(row.get("user_id") or "").strip().lower()
            if not user_id:
                continue
            latest_by_user[user_id] = {
                "timestamp": _to_int(row.get("timestamp"), fallback=0),
                "vector": [_to_float(row.get(col), fallback=0.0) for col in cols],
            }
        return latest_by_user

    try:
        return _db_read_with_fallback(
            "load_dynamic_training_snapshots",
            load_from_mongo,
            load_from_file,
        )
    except Exception:
        logger.exception("Failed to load dynamic training snapshots from MongoDB; falling back to file")
        return load_from_file()


def _load_base_feature_vector_map(cols: list[str]):
    topic_rows_by_user = _load_user_topic_rows()
    rating_map = _load_user_rating_map()
    out = {}
    for user_id, rows in topic_rows_by_user.items():
        feature_map = _build_feature_vector(rows, rating_map.get(user_id, 0.0))
        out[user_id] = [_to_float(feature_map.get(col), fallback=0.0) for col in cols]
    return out


def _build_training_matrix():
    cols = _load_training_feature_columns()
    base_vectors = _load_base_feature_vector_map(cols)
    dynamic_vectors = _load_dynamic_latest_feature_vectors(cols)

    # Dynamic snapshots override static rows for users with newer app activity.
    for user_id, payload in dynamic_vectors.items():
        base_vectors[user_id] = payload["vector"]

    user_ids = sorted(base_vectors.keys())
    vectors = [base_vectors[user_id] for user_id in user_ids]
    return cols, user_ids, vectors, len(dynamic_vectors)


def _compute_dynamic_cluster_count(sample_count: int):
    if sample_count <= 2:
        return 2
    heuristic = int(round(math.sqrt(max(2.0, sample_count / 2.0))))
    clusters = max(2, min(CLUSTER_RETRAIN_MAX_CLUSTERS, heuristic))
    return min(clusters, sample_count)


def _retrain_cluster_model(force: bool, reason: str):
    if not CLUSTER_RETRAIN_ENABLED and not force:
        return {"status": "disabled"}

    with _model_retrain_lock:
        cols, user_ids, vectors, dynamic_users = _build_training_matrix()
        total_users = len(user_ids)
        if total_users < 2:
            return {"status": "skipped", "reason": "not_enough_users", "total_users": total_users}

        meta = _read_model_meta()
        now_ts = int(time.time())
        since_last_users = max(0, total_users - _to_int(meta.get("last_retrain_user_count"), fallback=0))
        last_retrain_at = _to_int(meta.get("last_retrain_at"), fallback=0)
        since_last_seconds = now_ts - last_retrain_at if last_retrain_at > 0 else None

        if not force:
            if total_users < CLUSTER_RETRAIN_MIN_TOTAL_USERS:
                return {
                    "status": "skipped",
                    "reason": "min_total_users_not_reached",
                    "total_users": total_users,
                }
            if since_last_users < CLUSTER_RETRAIN_EVERY_N_USERS:
                return {
                    "status": "skipped",
                    "reason": "new_user_threshold_not_reached",
                    "new_users": since_last_users,
                    "threshold": CLUSTER_RETRAIN_EVERY_N_USERS,
                }
            if since_last_seconds is not None and since_last_seconds < CLUSTER_RETRAIN_MIN_INTERVAL_SECONDS:
                return {
                    "status": "skipped",
                    "reason": "min_interval_not_reached",
                    "seconds_since_last": since_last_seconds,
                    "threshold_seconds": CLUSTER_RETRAIN_MIN_INTERVAL_SECONDS,
                }

        try:
            import joblib
            from sklearn.cluster import KMeans
            from sklearn.preprocessing import StandardScaler
        except Exception as exc:
            raise ModelUnavailableError(f"Required ML dependencies are unavailable: {exc}")

        cluster_count = _compute_dynamic_cluster_count(total_users)
        scaler = StandardScaler()
        scaled_matrix = scaler.fit_transform(vectors)
        kmeans = KMeans(n_clusters=cluster_count, random_state=42, n_init=20)
        kmeans.fit(scaled_matrix)

        DATASET_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(scaler, SCALER_FILE)
        joblib.dump(kmeans, KMEANS_FILE)
        _load_saved_cluster_artifacts.cache_clear()

        next_meta = dict(meta)
        next_meta.update(
            {
                "last_retrain_at": now_ts,
                "last_retrain_user_count": total_users,
                "last_retrain_total_samples": len(vectors),
                "last_cluster_count": cluster_count,
                "last_retrain_reason": reason,
                "retrain_runs": _to_int(meta.get("retrain_runs"), fallback=0) + 1,
                "dynamic_users_seen": dynamic_users,
                "feature_columns": len(cols),
            }
        )
        _write_model_meta(next_meta)
        logger.info(
            "Cluster model retrained: users=%s, dynamic_users=%s, clusters=%s, reason=%s",
            total_users,
            dynamic_users,
            cluster_count,
            reason,
        )
        return {
            "status": "retrained",
            "total_users": total_users,
            "dynamic_users": dynamic_users,
            "cluster_count": cluster_count,
        }


def _maybe_retrain_cluster_model(reason: str):
    try:
        return _retrain_cluster_model(force=False, reason=reason)
    except Exception:
        logger.exception("Automatic cluster retraining failed")
        return {"status": "failed"}


def _ingest_training_snapshot(
    codeforces_id: str,
    topic_rows: list[dict],
    rating: float,
    source: str,
    maybe_retrain: bool = True,
):
    try:
        _append_dynamic_training_snapshot(codeforces_id, topic_rows, rating, source)
    except Exception:
        logger.exception("Failed to append dynamic training snapshot for '%s'", codeforces_id)
        return
    if maybe_retrain:
        _maybe_retrain_cluster_model(reason=f"snapshot_{source}")


def _refresh_user_model_state(codeforces_id: str, source: str, use_cache: bool):
    rating, topic_rows, _ = _build_live_user_features(codeforces_id, use_cache=use_cache)
    _ingest_training_snapshot(codeforces_id, topic_rows, rating, source=source, maybe_retrain=True)
    cluster = _predict_cluster_from_features(topic_rows, rating)
    _record_cluster_state(codeforces_id, cluster, source, topic_rows, rating)


def _async_refresh_user_model_state(codeforces_id: str, source: str):
    handle = codeforces_id.strip().lower()
    if not handle:
        return

    def runner():
        try:
            _refresh_user_model_state(handle, source=source, use_cache=True)
        except Exception:
            logger.exception("Async model refresh failed for '%s'", handle)

    Thread(target=runner, daemon=True).start()


@lru_cache(maxsize=1)
def _load_known_user_vectors():
    vectors = []
    cols = _load_training_feature_columns()
    user_clusters = _load_user_cluster_map()
    topic_rows_by_user = _load_user_topic_rows()
    ratings = _load_user_rating_map()

    for user_id, cluster in user_clusters.items():
        rows = topic_rows_by_user.get(user_id)
        if not rows:
            continue
        feature_map = _build_feature_vector(rows, ratings.get(user_id, 0.0))
        vector = [feature_map.get(col, 0.0) for col in cols]
        vectors.append((cluster, vector))
    return vectors


@lru_cache(maxsize=1)
def _load_saved_cluster_artifacts():
    if not SCALER_FILE.exists() or not KMEANS_FILE.exists():
        if CLUSTER_RETRAIN_ENABLED:
            _retrain_cluster_model(force=True, reason="missing_cluster_artifacts")
    if not SCALER_FILE.exists() or not KMEANS_FILE.exists():
        if CLUSTER_MODEL_STRICT:
            raise ModelUnavailableError(
                "Trained cluster artifacts are missing. Expected scaler_v2.pkl and kmeans_v2.pkl."
            )
        return None, None

    try:
        import joblib
    except Exception:
        if CLUSTER_MODEL_STRICT:
            raise ModelUnavailableError("joblib is required to load trained cluster artifacts")
        logger.info("joblib unavailable; using centroid-based cluster fallback")
        return None, None

    try:
        scaler = joblib.load(SCALER_FILE)
        kmeans = joblib.load(KMEANS_FILE)
        return scaler, kmeans
    except Exception:
        if CLUSTER_MODEL_STRICT:
            raise ModelUnavailableError("Could not load trained cluster artifacts")
        logger.exception("Could not load saved scaler/kmeans artifacts; fallback will be used")
        return None, None


def _normalize_cluster_label(raw_cluster):
    if raw_cluster is None:
        return None
    if isinstance(raw_cluster, str):
        cluster = raw_cluster.strip()
        if not cluster:
            return None
        return cluster if cluster.startswith("C") else f"C{cluster}"
    try:
        cluster_int = int(raw_cluster)
    except (TypeError, ValueError):
        return None
    return f"C{cluster_int}"


def _predict_cluster_from_artifacts(feature_vector):
    scaler, kmeans = _load_saved_cluster_artifacts()
    if scaler is None or kmeans is None:
        return None
    try:
        scaled = scaler.transform([feature_vector])
        predicted = kmeans.predict(scaled)
        if len(predicted) == 0:
            raise ModelUnavailableError("Cluster model returned an empty prediction result")
        return _normalize_cluster_label(predicted[0])
    except Exception:
        if CLUSTER_MODEL_STRICT:
            raise ModelUnavailableError("Artifact-based cluster prediction failed")
        logger.exception("Artifact-based cluster prediction failed; fallback will be used")
        return None


@lru_cache(maxsize=1)
def _load_cluster_centroids():
    vectors_by_cluster = defaultdict(list)
    for cluster, vector in _load_known_user_vectors():
        vectors_by_cluster[_normalize_cluster_label(cluster) or "C0"].append(vector)

    if not vectors_by_cluster:
        return {}, [], []

    first_cluster_vectors = next(iter(vectors_by_cluster.values()))
    dim = len(first_cluster_vectors[0])
    all_vectors = [vec for vecs in vectors_by_cluster.values() for vec in vecs]
    total = len(all_vectors)
    means = [0.0] * dim
    for vec in all_vectors:
        for idx, value in enumerate(vec):
            means[idx] += value
    means = [value / total for value in means]

    variances = [0.0] * dim
    for vec in all_vectors:
        for idx, value in enumerate(vec):
            diff = value - means[idx]
            variances[idx] += diff * diff
    stds = [math.sqrt(value / total) if value > 1e-12 else 1.0 for value in variances]

    centroids = {}
    for cluster, vecs in vectors_by_cluster.items():
        centroid = [0.0] * dim
        for vec in vecs:
            for idx, value in enumerate(vec):
                centroid[idx] += (value - means[idx]) / stds[idx]
        centroids[cluster] = [value / len(vecs) for value in centroid]
    return centroids, means, stds


def _predict_cluster_from_features(topic_rows, rating):
    cols = _load_training_feature_columns()
    target_map = _build_feature_vector(topic_rows, rating)
    target = [target_map.get(col, 0.0) for col in cols]

    model_cluster = _predict_cluster_from_artifacts(target)
    if model_cluster:
        return model_cluster
    if not ALLOW_CLUSTER_CENTROID_FALLBACK:
        raise ModelUnavailableError(
            "Cluster prediction must come from saved trained artifacts; fallback prediction is disabled."
        )
    if CLUSTER_MODEL_STRICT:
        raise ModelUnavailableError("Strict cluster mode requires trained artifacts for prediction")

    centroids, means, stds = _load_cluster_centroids()
    if not centroids:
        return "C0"

    target_normalized = []
    for idx, value in enumerate(target):
        denom = stds[idx] if idx < len(stds) else 1.0
        mean = means[idx] if idx < len(means) else 0.0
        target_normalized.append((value - mean) / (denom or 1.0))

    best_cluster = None
    best_dist = float("inf")
    for cluster, centroid in centroids.items():
        dist_sq = 0.0
        for idx, c_value in enumerate(centroid):
            diff = target_normalized[idx] - c_value
            dist_sq += diff * diff
        dist = math.sqrt(dist_sq)
        if dist < best_dist:
            best_dist = dist
            best_cluster = cluster
    return best_cluster or "C0"


def _sheet_cache_key(
    codeforces_id: str,
    per_topic: int,
    total_problems: int,
    window_days: int,
    selected_topics: list[str] | None,
):
    selected_key = ",".join(sorted(_normalize_topics(selected_topics or [])))
    return (
        f"{SHEET_CACHE_VERSION}:{codeforces_id.lower()}:per={per_topic}:"
        f"total={total_problems}:window={window_days}:topics={selected_key}"
    )


def _get_cached_sheet(
    codeforces_id: str,
    per_topic: int,
    total_problems: int,
    window_days: int,
    selected_topics: list[str] | None,
):
    try:
        doc = _get_user_doc(codeforces_id)
        if not doc:
            return None
        payload = doc.get("sheet_cache")
        if not isinstance(payload, dict):
            return None
        expected_key = _sheet_cache_key(
            codeforces_id, per_topic, total_problems, window_days, selected_topics
        )
        saved_key = doc.get("sheet_cache_key") or payload.get("cache_key")
        if saved_key != expected_key:
            return None
        return payload
    except Exception:
        logger.exception("Sheet cache read failed for '%s'", codeforces_id)
        return None


def _set_cached_sheet(
    codeforces_id: str,
    per_topic: int,
    total_problems: int,
    window_days: int,
    selected_topics: list[str] | None,
    sheet_payload: dict,
):
    try:
        cache_key = _sheet_cache_key(
            codeforces_id, per_topic, total_problems, window_days, selected_topics
        )
        payload = dict(sheet_payload)
        payload["cache_key"] = cache_key

        def apply(doc):
            doc["sheet_cache"] = payload
            doc["sheet_cache_key"] = cache_key

        _save_user_doc_by_codeforces(codeforces_id, apply)
    except Exception:
        # Cache write failure should not break recommendation response.
        logger.exception("Sheet cache write failed for '%s'", codeforces_id)
        return


def _invalidate_codeforces_cache_for_user(codeforces_id: str):
    handle = codeforces_id.strip().lower()
    if not handle:
        return

    with _user_status_cache_lock:
        status_keys = [key for key in _user_status_cache.keys() if key[0] == handle]
        for key in status_keys:
            _user_status_cache.pop(key, None)

    with _cf_api_cache_lock:
        api_keys_to_drop = []
        for key in _cf_api_cache.keys():
            _, params = key
            for param_name, param_value in params:
                if param_name not in {"handle", "handles"}:
                    continue
                handles = [part.strip().lower() for part in str(param_value).split(";") if part.strip()]
                if handle in handles:
                    api_keys_to_drop.append(key)
                    break
        for key in api_keys_to_drop:
            _cf_api_cache.pop(key, None)


def _compute_weakness(topic_row):
    attempted = _to_int(topic_row.get("attempted_unique"), fallback=0)
    accuracy = _to_float(topic_row.get("accuracy_unique"), fallback=0.0)
    struggle = _to_float(topic_row.get("struggle_score"), fallback=0.0)

    # Higher is weaker. No-attempt topics are treated as weak to promote topic coverage.
    return (1.0 - accuracy) + min(struggle, 8.0) / 10.0 + (0.4 if attempted == 0 else 0.0)


def _recommend_for_topic(cluster, topic, solved_problem_keys, user_rating, per_topic):
    if not topic:
        return []

    by_cluster_topic = _load_cluster_topic_problem_rows()
    cluster_options = []
    normalized_cluster = _normalize_cluster_label(cluster)
    if normalized_cluster:
        cluster_options.append(normalized_cluster)
        if normalized_cluster.startswith("C"):
            cluster_options.append(normalized_cluster[1:])
    if cluster is not None:
        cluster_options.append(str(cluster))

    cluster_topic_rows = []
    for cluster_name in cluster_options:
        cluster_topic_rows = by_cluster_topic.get((cluster_name, topic), [])
        if cluster_topic_rows:
            break

    # Fallback: use topic rows from all clusters when the predicted cluster has no data.
    if not cluster_topic_rows:
        for (row_cluster, row_topic), rows in by_cluster_topic.items():
            if row_topic == topic:
                cluster_topic_rows.extend(rows)

    candidates = []
    seen_problem_keys = set()
    for row in cluster_topic_rows:
        problem_key = row.get("problem_key")
        if not problem_key:
            continue
        if problem_key in seen_problem_keys or problem_key in solved_problem_keys:
            continue
        seen_problem_keys.add(problem_key)
        cf_link = str(row.get("cf_link") or "").strip()
        if not CODEFORCES_PROBLEM_LINK_RE.search(cf_link):
            continue

        success_rate = _to_float(row.get("success_rate"), fallback=0.0)
        median_submissions = _to_float(row.get("median_submissions_until_ok"), fallback=99.0)
        problem_rating = _to_float(row.get("problem_rating"), fallback=0.0)
        rating_gap = abs(problem_rating - user_rating) if problem_rating > 0 and user_rating > 0 else 0.0
        score = (success_rate * 100.0) - median_submissions - (rating_gap / 800.0)

        candidates.append(
            {
                "score": round(score, 4),
                "problem_key": problem_key,
                "problem_name": row.get("problem_name"),
                "problem_rating": row.get("problem_rating"),
                "success_rate": round(success_rate, 4),
                "median_submissions_until_ok": row.get("median_submissions_until_ok"),
                "cf_link": cf_link,
            }
        )

    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates[:per_topic]


def _load_user_problem_status_sets(codeforces_id: str, use_cache: bool = True):
    submissions = _fetch_user_status_all(
        codeforces_id,
        max_total=20000,
        batch_size=5000,
        use_cache=use_cache,
    )
    attempted = set()
    solved = set()
    for idx, sub in enumerate(submissions):
        problem = sub.get("problem") or {}
        key = _get_problem_key(problem, fallback_index=idx)
        if not key:
            continue
        attempted.add(key)
        if sub.get("verdict") == "OK":
            solved.add(key)
    return attempted, solved


def _build_combined_problem_recommendations(
    cluster: str | None,
    topic_rows: list[dict],
    selected_topics: list[str],
    solved_problem_keys: set[str],
    user_rating: float,
    per_topic: int,
    total_problems: int,
):
    topic_map = {}
    for row in topic_rows:
        topic = _normalize_topic(row.get("topic"))
        if topic:
            topic_map[topic] = row

    weighted_candidates = []
    for topic in selected_topics:
        row = topic_map.get(topic, {})
        weakness = _compute_weakness(row) if row else 0.0
        topic_candidates = _recommend_for_topic(
            cluster,
            topic,
            solved_problem_keys,
            user_rating,
            per_topic=max(per_topic, total_problems * 2),
        )
        for candidate in topic_candidates:
            merged = dict(candidate)
            merged["topic"] = topic
            merged["topic_label"] = _to_title_case(topic)
            merged["weakness_score"] = round(weakness, 4)
            merged["final_score"] = round(_to_float(candidate.get("score"), 0.0) + (weakness * 12.0), 4)
            weighted_candidates.append(merged)

    weighted_candidates.sort(
        key=lambda item: (item.get("final_score", 0.0), item.get("score", 0.0)),
        reverse=True,
    )

    selected = []
    seen_keys = set()
    for candidate in weighted_candidates:
        problem_key = candidate.get("problem_key")
        if not problem_key or problem_key in seen_keys:
            continue
        selected.append(candidate)
        seen_keys.add(problem_key)
        if len(selected) >= total_problems:
            break
    return selected


@app.post("/api/recommendations/weak-topics")
def weak_topic_recommendations(payload: RecommendationsPayload):
    codeforces_id = payload.codeforcesId.strip().lower()
    per_topic = max(1, min(payload.perTopic, 20))
    total_problems = max(1, min(payload.totalProblems, 10))
    window_days = max(0, min(payload.windowDays, 30))
    explicit_topics = _normalize_topics(payload.selectedTopics)
    if not codeforces_id:
        raise HTTPException(status_code=400, detail="codeforcesId is required")
    if not CODEFORCES_HANDLE_RE.fullmatch(codeforces_id):
        raise HTTPException(status_code=400, detail="Invalid codeforcesId format")
    if window_days > 0:
        _require_contest_window_open(codeforces_id)

    persisted_topics = []
    if explicit_topics:
        persisted_topics, _ = _set_user_selected_topics(codeforces_id, explicit_topics)
    else:
        persisted_topics = _get_user_selected_topics(codeforces_id)

    if payload.forceRefresh:
        _invalidate_codeforces_cache_for_user(codeforces_id)

    # Cache is keyed by user preferences, not fallback weakest-topic picks.
    cache_topics = persisted_topics
    if not payload.forceRefresh:
        cached = _get_cached_sheet(
            codeforces_id,
            per_topic,
            total_problems,
            window_days,
            cache_topics,
        )
        if isinstance(cached, dict) and cached.get("recommendations"):
            cached_payload = dict(cached)
            cached_payload["cached"] = True
            return cached_payload

    cluster = None
    user_rating = 0.0
    solved_problem_keys = set()
    topic_rows = []
    source = "dataset"
    resolved_id = None
    resolution_mode = None

    use_dataset_snapshot = not payload.forceRefresh and window_days <= 0
    if use_dataset_snapshot:
        resolved_id, resolution_mode = _resolve_dataset_user_id(codeforces_id)
        if resolved_id is not None:
            topic_rows = _load_user_topic_rows().get(resolved_id, [])
            user_rating = _load_user_rating_map().get(resolved_id, 0.0)
            solved_problem_keys = _load_solved_problem_keys(resolved_id)

            if topic_rows:
                try:
                    cluster = _predict_cluster_from_features(topic_rows, user_rating)
                except ModelUnavailableError as exc:
                    raise HTTPException(status_code=503, detail=str(exc))
                source = "dataset_model_prediction"
            elif resolution_mode == "case_insensitive":
                source = "dataset_case_insensitive_match"

    if payload.forceRefresh or window_days > 0 or not topic_rows:
        try:
            user_rating, topic_rows, solved_problem_keys = _build_live_user_features(
                codeforces_id,
                use_cache=not payload.forceRefresh,
                lookback_days=window_days,
            )
            cluster = _predict_cluster_from_features(topic_rows, user_rating)
            if window_days > 0:
                source = f"live_codeforces_{window_days}d_window"
            else:
                source = "live_codeforces_refresh" if payload.forceRefresh else "live_codeforces_fallback"
        except ModelUnavailableError as exc:
            raise HTTPException(status_code=503, detail=str(exc))
        except Exception as exc:
            if topic_rows:
                source = f"{source}_live_refresh_failed"
            else:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        f"User '{codeforces_id}' not found in local clustering dataset and "
                        f"live Codeforces fallback failed: {exc}"
                    ),
                )

    should_ingest_snapshot = (
        bool(topic_rows)
        and (window_days > 0 or payload.forceRefresh or source.startswith("live_codeforces"))
    )
    if should_ingest_snapshot:
        _ingest_training_snapshot(codeforces_id, topic_rows, user_rating, source=source, maybe_retrain=True)
        try:
            cluster = _predict_cluster_from_features(topic_rows, user_rating)
        except ModelUnavailableError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

    topic_rows_sorted = sorted(topic_rows, key=_compute_weakness, reverse=True)
    weakest_topic_names = [
        _normalize_topic(row.get("topic"))
        for row in topic_rows_sorted
        if _normalize_topic(row.get("topic"))
    ]

    selected_topics = persisted_topics
    if not selected_topics:
        selected_topics = weakest_topic_names[:5]

    selected_topics = _normalize_topics(selected_topics)
    if not selected_topics:
        raise HTTPException(status_code=404, detail="No eligible topics found for recommendation generation")
    topic_row_map = {}
    for row in topic_rows:
        topic = _normalize_topic(row.get("topic"))
        if topic:
            topic_row_map[topic] = row
    selected_topics.sort(
        key=lambda topic_name: _compute_weakness(topic_row_map.get(topic_name, {})),
        reverse=True,
    )

    attempted_problem_keys, solved_problem_keys_live = _load_user_problem_status_sets(
        codeforces_id, use_cache=not payload.forceRefresh
    )
    solved_problem_keys = solved_problem_keys.union(solved_problem_keys_live)

    topic_progress = []
    for topic in selected_topics:
        row = topic_row_map.get(topic, {})
        topic_progress.append(
            {
                "topic": topic,
                "topic_label": _to_title_case(topic),
                "weakness_score": round(_compute_weakness(row), 4) if row else 0.0,
                "attempted_unique": _to_int(row.get("attempted_unique"), fallback=0),
                "solved_unique": _to_int(row.get("solved_unique"), fallback=0),
                "accuracy_unique": round(_to_float(row.get("accuracy_unique"), fallback=0.0), 4),
                "struggle_score": round(_to_float(row.get("struggle_score"), fallback=0.0), 4),
            }
        )

    recommendations = []
    flat_problems = []
    for topic_entry in topic_progress:
        topic = topic_entry["topic"]
        recs = _recommend_for_topic(
            cluster,
            topic,
            solved_problem_keys,
            user_rating,
            per_topic=per_topic,
        )
        recs_with_progress = []
        for idx, problem in enumerate(recs, start=1):
            status = "not_attempted"
            if problem.get("problem_key") in attempted_problem_keys:
                status = "attempted"
            enriched = {
                **problem,
                "topic": topic,
                "topic_label": _to_title_case(topic),
                "status": status,
                "rank_in_topic": idx,
            }
            recs_with_progress.append(enriched)
            flat_problems.append(enriched)

        # Track aggregate progress for recommended items in this topic.
        attempted_recs = sum(1 for item in recs_with_progress if item.get("status") != "not_attempted")
        topic_entry["recommended_count"] = len(recs_with_progress)
        topic_entry["recommended_attempted_count"] = attempted_recs
        topic_entry["recommended_progress_pct"] = (
            round((attempted_recs / len(recs_with_progress)) * 100, 2) if recs_with_progress else 0.0
        )
        recommendations.append({**topic_entry, "problems": recs_with_progress})

    normalized_cluster = _normalize_cluster_label(cluster) or "C0"
    _record_cluster_state(codeforces_id, normalized_cluster, source, topic_rows, user_rating)

    response_payload = {
        "codeforces_id": codeforces_id,
        "cluster": normalized_cluster,
        "cluster_source": source,
        "available_topics": _load_model_topics(),
        "selected_topics": selected_topics,
        "per_topic": per_topic,
        "total_problems_requested": total_problems,
        "window_days": window_days,
        "top_weak_topics_count": len(selected_topics),
        "topic_progress": topic_progress,
        "problems": flat_problems,
        "recommendations": recommendations,
        "cached": False,
    }
    _set_cached_sheet(
        codeforces_id,
        per_topic,
        total_problems,
        window_days,
        cache_topics,
        response_payload,
    )
    return response_payload


@app.get("/api/topics")
def list_topics():
    topics = _load_model_topics()
    return {
        "topics": [{"value": topic, "label": _to_title_case(topic)} for topic in topics],
        "count": len(topics),
    }


@app.post("/api/user/preferences/topics")
def update_topic_preferences(payload: TopicPreferencesPayload):
    codeforces_id = payload.codeforcesId.strip().lower()
    if not codeforces_id:
        raise HTTPException(status_code=400, detail="codeforcesId is required")
    if not CODEFORCES_HANDLE_RE.fullmatch(codeforces_id):
        raise HTTPException(status_code=400, detail="Invalid codeforcesId format")

    selected_topics, saved_doc = _set_user_selected_topics(codeforces_id, payload.topics)
    if not saved_doc:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "codeforces_id": codeforces_id,
        "selected_topics": selected_topics,
        "selected_topics_count": len(selected_topics),
    }


@app.post("/api/user/preferences")
def get_user_preferences(payload: WeeklyContestScheduleGetPayload):
    codeforces_id = payload.codeforcesId.strip().lower()
    if not codeforces_id:
        raise HTTPException(status_code=400, detail="codeforcesId is required")
    doc = _get_user_doc(codeforces_id)
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")

    preferences = dict(doc.get("preferences") or {})
    selected_topics = _normalize_topics(preferences.get("selected_topics") or [])
    weekly_schedule = _serialize_weekly_schedule(preferences.get("weekly_contest_schedule"))
    return {
        "codeforces_id": codeforces_id,
        "selected_topics": selected_topics,
        "weekly_contest_schedule": weekly_schedule,
    }


@app.post("/api/contest/weekly/schedule/get")
def get_weekly_schedule(payload: WeeklyContestScheduleGetPayload):
    codeforces_id = payload.codeforcesId.strip().lower()
    if not codeforces_id:
        raise HTTPException(status_code=400, detail="codeforcesId is required")
    doc = _get_user_doc(codeforces_id)
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    preferences = dict(doc.get("preferences") or {})
    schedule = _serialize_weekly_schedule(preferences.get("weekly_contest_schedule"))
    return {"codeforces_id": codeforces_id, "weekly_contest_schedule": schedule}


@app.post("/api/contest/weekly/schedule/set")
def set_weekly_schedule(payload: WeeklyContestScheduleSetPayload):
    codeforces_id = payload.codeforcesId.strip().lower()
    if not codeforces_id:
        raise HTTPException(status_code=400, detail="codeforcesId is required")
    if not (0 <= payload.weekday <= 6):
        raise HTTPException(status_code=400, detail="weekday must be in range 0..6")
    if not (0 <= payload.hour <= 23):
        raise HTTPException(status_code=400, detail="hour must be in range 0..23")
    if not (0 <= payload.minute <= 59):
        raise HTTPException(status_code=400, detail="minute must be in range 0..59")

    schedule = {
        "weekday": int(payload.weekday),
        "hour": int(payload.hour),
        "minute": int(payload.minute),
        "timezone_offset_minutes": int(payload.timezoneOffsetMinutes),
        "contest_duration_seconds": _normalize_contest_duration_seconds(
            payload.contestDurationSeconds, fallback=WEEKLY_CONTEST_DURATION_SECONDS
        ),
    }

    def apply(doc):
        preferences = dict(doc.get("preferences") or {})
        preferences["weekly_contest_schedule"] = schedule
        doc["preferences"] = preferences

    saved = _save_user_doc_by_codeforces(codeforces_id, apply)
    if not saved:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "codeforces_id": codeforces_id,
        "weekly_contest_schedule": _serialize_weekly_schedule(schedule),
    }


@app.post("/api/contest/generate")
def generate_weekly_contest(payload: ContestGeneratePayload):
    codeforces_id = payload.codeforcesId.strip().lower()
    if not codeforces_id:
        raise HTTPException(status_code=400, detail="codeforcesId is required")
    if not CODEFORCES_HANDLE_RE.fullmatch(codeforces_id):
        raise HTTPException(status_code=400, detail="Invalid codeforcesId format")

    contest_window = _require_contest_window_open(codeforces_id)
    total_problems = max(1, min(payload.totalProblems, 10))
    per_topic = max(10, min(payload.perTopic, 20))

    try:
        rating, topic_rows, solved_keys = _build_live_user_features(
            codeforces_id,
            use_cache=False,
            lookback_days=7,
        )
        _ingest_training_snapshot(
            codeforces_id,
            topic_rows,
            rating,
            source="contest_generation_7d_window",
            maybe_retrain=True,
        )
        cluster = _predict_cluster_from_features(topic_rows, rating)
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    _record_cluster_state(codeforces_id, cluster, "contest_generation_7d_window", topic_rows, rating)

    attempted_keys, _ = _load_user_problem_status_sets(codeforces_id, use_cache=True)
    topic_rows_sorted = sorted(topic_rows, key=_compute_weakness, reverse=True)
    selected_topics = []
    for row in topic_rows_sorted:
        topic = _normalize_topic(row.get("topic"))
        if topic and topic not in selected_topics:
            selected_topics.append(topic)
        if len(selected_topics) >= 4:
            break

    if not selected_topics:
        raise HTTPException(status_code=404, detail="No weak topics found to generate contest")

    problems = []
    seen_problem_keys = set()
    topic_progress = []
    topic_row_map = {row.get("topic"): row for row in topic_rows}

    for topic in selected_topics:
        row = topic_row_map.get(topic, {})
        topic_progress.append(
            {
                "topic": topic,
                "topic_label": _to_title_case(topic),
                "weakness_score": round(_compute_weakness(row), 4) if row else 0.0,
                "attempted_unique": _to_int(row.get("attempted_unique"), fallback=0),
                "solved_unique": _to_int(row.get("solved_unique"), fallback=0),
            }
        )

        topic_candidates = _recommend_for_topic(
            cluster,
            topic,
            solved_keys,
            rating,
            per_topic=per_topic,
        )
        non_attempted = [
            candidate
            for candidate in topic_candidates
            if candidate.get("problem_key") not in attempted_keys
            and candidate.get("problem_key") not in seen_problem_keys
        ]

        choice_pool = non_attempted[5:10] if len(non_attempted) >= 10 else non_attempted[5:]
        if not choice_pool:
            choice_pool = non_attempted
        if not choice_pool:
            continue

        random.shuffle(choice_pool)
        selected_problem = choice_pool[0]
        seen_problem_keys.add(selected_problem.get("problem_key"))
        problems.append(
            {
                **selected_problem,
                "topic": topic,
                "topic_label": _to_title_case(topic),
            }
        )

    if not problems:
        raise HTTPException(status_code=404, detail="No eligible non-attempted contest problems found")
    problems = problems[:total_problems]

    return {
        "codeforces_id": codeforces_id,
        "contest_window": contest_window,
        "generated_at": int(time.time()),
        "total_problems": len(problems),
        "problems": problems,
        "cluster": _normalize_cluster_label(cluster) or "C0",
        "cluster_source": "contest_generation_7d_window",
        "selected_topics": selected_topics,
        "topic_progress": topic_progress,
    }


@app.post("/api/contest/complete")
def complete_contest(payload: ContestCompletePayload):
    codeforces_id = payload.codeforcesId.strip().lower()
    if not codeforces_id:
        raise HTTPException(status_code=400, detail="codeforcesId is required")

    normalized_problems = []
    for item in payload.problems:
        problem_key = str(item.problemKey or "").strip()
        topic = _normalize_topic(item.topic)
        status = str(item.status or "").strip().lower()
        if not problem_key or not topic:
            continue
        normalized_problems.append(
            {
                "problem_key": problem_key,
                "topic": topic,
                "rating": _to_float(item.rating, fallback=0.0),
                "status": status,
            }
        )

    if not normalized_problems:
        raise HTTPException(status_code=400, detail="At least one valid problem result is required")

    solved_statuses = {"solved", "ok", "accepted"}
    solved_count = sum(1 for problem in normalized_problems if problem["status"] in solved_statuses)
    total_points = int(
        round(sum(_to_float(problem.get("rating"), fallback=0.0) for problem in normalized_problems))
    )
    scored_points = int(
        round(
            sum(
                _to_float(problem.get("rating"), fallback=0.0)
                for problem in normalized_problems
                if problem.get("status") in solved_statuses
            )
        )
    )

    finished_at = _to_int(payload.finishedAt, fallback=int(time.time()))
    duration_seconds = max(0, _to_int(payload.durationSeconds, fallback=0))
    started_at = _to_int(payload.startedAt, fallback=max(0, finished_at - duration_seconds))

    _, weekly_schedule = _get_user_weekly_schedule(codeforces_id)
    start_window = _compute_current_weekly_contest_window(
        weekly_schedule,
        duration_seconds=WEEKLY_CONTEST_DURATION_SECONDS,
        now_ts=started_at,
    )
    if not start_window.get("configured"):
        raise HTTPException(status_code=400, detail="Weekly contest schedule is not configured")
    if not start_window.get("is_open_now"):
        raise HTTPException(
            status_code=403,
            detail="Contest submissions are accepted only for contests started inside the saved schedule window",
        )

    result_payload = {
        "contest_id": f"{codeforces_id}-{finished_at}",
        "completed_at": finished_at,
        "completed_at_iso": datetime.fromtimestamp(finished_at, tz=timezone.utc).isoformat(),
        "started_at": started_at,
        "duration_seconds": duration_seconds,
        "problems": normalized_problems,
        "total_problems": len(normalized_problems),
        "solved_count": solved_count,
        "total_points": total_points,
        "scored_points": scored_points,
        "score_pct": round((solved_count / len(normalized_problems)) * 100, 2),
    }

    saved = _record_contest_result(codeforces_id, result_payload)
    if not saved:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        rating, topic_rows, _ = _build_live_user_features(codeforces_id, use_cache=False)
        _ingest_training_snapshot(
            codeforces_id,
            topic_rows,
            rating,
            source="contest_completion_refresh",
            maybe_retrain=True,
        )
        cluster = _predict_cluster_from_features(topic_rows, rating)
        _record_cluster_state(codeforces_id, cluster, "contest_completion_refresh", topic_rows, rating)
        result_payload["cluster_after_contest"] = _normalize_cluster_label(cluster) or "C0"
    except ModelUnavailableError as exc:
        logger.exception("Cluster model unavailable after contest completion for '%s'", codeforces_id)
        result_payload["cluster_refresh_error"] = str(exc)
    except Exception:
        logger.exception("Failed to refresh cluster after contest completion for '%s'", codeforces_id)

    return {"message": "Contest result saved", "result": result_payload}


@app.post("/api/dashboard")
def dashboard(payload: DashboardPayload):
    codeforces_id = payload.codeforcesId.strip().lower()
    if not codeforces_id:
        raise HTTPException(status_code=400, detail="codeforcesId is required")
    if not CODEFORCES_HANDLE_RE.fullmatch(codeforces_id):
        raise HTTPException(status_code=400, detail="Invalid codeforcesId format")
    try:
        return _build_dashboard_data(codeforces_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception:
        logger.exception("Dashboard fetch failed for '%s'", codeforces_id)
        raise HTTPException(status_code=502, detail="Dashboard data fetch failed")


@app.post("/api/contest/status")
def contest_status(payload: ContestStatusPayload):
    codeforces_id = payload.codeforcesId.strip().lower()
    if not codeforces_id:
        raise HTTPException(status_code=400, detail="codeforcesId is required")

    problem_keys = [key for key in payload.problemKeys if key]
    if not problem_keys:
        return {"solved_keys": []}

    try:
        submissions = _fetch_user_status_all(
            codeforces_id,
            max_total=20000,
            batch_size=5000,
            use_cache=True,
        )
    except Exception:
        logger.exception("Contest status refresh failed for '%s'", codeforces_id)
        raise HTTPException(status_code=404, detail="Codeforces fetch failed")

    solved_keys = set()
    for idx, sub in enumerate(submissions):
        if sub.get("verdict") != "OK":
            continue
        problem = sub.get("problem") or {}
        problem_key = _get_problem_key(problem, fallback_index=idx)
        if problem_key:
            solved_keys.add(problem_key)

    solved_filtered = [key for key in problem_keys if key in solved_keys]
    return {"solved_keys": solved_filtered}


@app.post("/api/problem/details")
def problem_details(payload: ProblemDetailsPayload):
    try:
        problem_url = _normalize_problem_url(payload.cfLink)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        page_html = _fetch_codeforces_page_html(
            problem_url,
            referer="https://codeforces.com/problemset",
            timeout=20,
        )
    except Exception as exc:
        logger.exception("Failed to fetch problem page: %s", problem_url)
        detail = "Failed to fetch problem page from Codeforces"
        if isinstance(exc, HTTPError):
            detail = f"Failed to fetch problem page from Codeforces (HTTP {exc.code})"
        raise HTTPException(status_code=502, detail=detail)

    if BeautifulSoup is None:
        title_match = re.search(r'<div[^>]*class="title"[^>]*>(.*?)</div>', page_html, flags=re.DOTALL | re.IGNORECASE)
        time_match = re.search(
            r'<div[^>]*class="time-limit"[^>]*>(.*?)</div>',
            page_html,
            flags=re.DOTALL | re.IGNORECASE,
        )
        memory_match = re.search(
            r'<div[^>]*class="memory-limit"[^>]*>(.*?)</div>',
            page_html,
            flags=re.DOTALL | re.IGNORECASE,
        )

        def _strip_html(value: str):
            return html.unescape(re.sub(r"<[^>]+>", "", str(value or ""))).strip()

        return {
            "source_url": problem_url,
            "submit_url": _derive_problem_submit_url(problem_url),
            "title": _strip_html(title_match.group(1)) if title_match else "",
            "time_limit": _strip_html(time_match.group(1)) if time_match else "",
            "memory_limit": _strip_html(memory_match.group(1)) if memory_match else "",
            "statement": (
                "Problem statement preview unavailable because beautifulsoup4 is not installed. "
                "Install requirements to enable full in-app statement parsing."
            ),
            "input_specification": "",
            "output_specification": "",
            "constraints": [],
            "samples": [],
            "note": "",
        }

    soup = BeautifulSoup(page_html, "html.parser")
    problem_root = soup.select_one("div.problem-statement")
    if problem_root is None:
        raise HTTPException(status_code=404, detail="Unable to parse problem statement from Codeforces page")

    header = problem_root.select_one("div.header")
    title = _extract_block_text(header.select_one("div.title") if header else None)
    time_limit = _extract_block_text(header.select_one("div.time-limit") if header else None)
    memory_limit = _extract_block_text(header.select_one("div.memory-limit") if header else None)
    time_limit = re.sub(r"(?i)^time limit per test", "", time_limit).strip(" :")
    memory_limit = re.sub(r"(?i)^memory limit per test", "", memory_limit).strip(" :")

    statement_chunks = []
    for child in problem_root.find_all(recursive=False):
        if not getattr(child, "name", None):
            continue
        classes = set(child.get("class") or [])
        if "header" in classes:
            continue
        if "input-specification" in classes:
            break
        if "output-specification" in classes or "sample-tests" in classes or "note" in classes:
            continue
        if child.name in {"script", "style"}:
            continue
        text = _extract_block_text(child)
        if text:
            statement_chunks.append(text)
    statement_text = "\n\n".join(statement_chunks).strip()
    if not statement_text:
        legend_node = problem_root.select_one("div.legend")
        if legend_node is not None:
            statement_text = _extract_block_text(legend_node)
    if not statement_text:
        # Last resort: extract all text and trim before input section label.
        flat = _extract_block_text(problem_root)
        if flat:
            marker = "\nInput\n"
            if marker in flat:
                flat = flat.split(marker, 1)[0].strip()
            statement_text = flat

    input_text = _strip_section_heading(
        _extract_block_text(problem_root.select_one("div.input-specification")),
        "Input",
    )
    output_text = _strip_section_heading(
        _extract_block_text(problem_root.select_one("div.output-specification")),
        "Output",
    )
    note_text = _strip_section_heading(
        _extract_block_text(problem_root.select_one("div.note")),
        "Note",
    )

    sample_inputs = problem_root.select("div.sample-tests div.input pre")
    sample_outputs = problem_root.select("div.sample-tests div.output pre")
    sample_count = max(len(sample_inputs), len(sample_outputs))
    samples = []
    for index in range(min(sample_count, 8)):
        samples.append(
            {
                "index": index + 1,
                "input": _extract_pre_text(sample_inputs[index]) if index < len(sample_inputs) else "",
                "output": _extract_pre_text(sample_outputs[index]) if index < len(sample_outputs) else "",
            }
        )

    constraints = _extract_constraints(statement_text, input_text)
    submit_url = _derive_problem_submit_url(problem_url)

    return {
        "source_url": problem_url,
        "submit_url": submit_url,
        "title": title,
        "time_limit": time_limit,
        "memory_limit": memory_limit,
        "statement": statement_text,
        "input_specification": input_text,
        "output_specification": output_text,
        "constraints": constraints,
        "samples": samples,
        "note": note_text,
    }


@app.post("/api/submission/source")
def submission_source(payload: SubmissionSourcePayload):
    try:
        url = _normalize_submission_url(payload.submissionUrl)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        page_html = _fetch_codeforces_page_html(
            url,
            referer="https://codeforces.com/",
            timeout=20,
        )
    except Exception as exc:
        logger.exception("Failed to fetch submission page: %s", url)
        detail = "Failed to fetch submission page from Codeforces"
        if isinstance(exc, HTTPError):
            detail = f"Failed to fetch submission page from Codeforces (HTTP {exc.code})"
        raise HTTPException(status_code=502, detail=detail)

    parsed = _extract_submission_source_from_html(page_html)

    # Fallback: some pages expose source under /problemset/submission even when /contest/submission fails.
    if not parsed.get("code"):
        submission_match = CODEFORCES_SUBMISSION_LINK_RE.match(url)
        contest_id = submission_match.group("contest_id") if submission_match else None
        submission_id = submission_match.group("submission_id") if submission_match else None
        if contest_id and submission_id and "/contest/" in url:
            fallback_url = f"https://codeforces.com/problemset/submission/{contest_id}/{submission_id}"
            try:
                fallback_html = _fetch_codeforces_page_html(
                    fallback_url,
                    referer="https://codeforces.com/problemset",
                    timeout=20,
                )
                fallback_parsed = _extract_submission_source_from_html(fallback_html)
                if fallback_parsed.get("code"):
                    url = fallback_url
                    parsed = fallback_parsed
            except Exception:
                logger.exception("Fallback submission source fetch failed: %s", fallback_url)

    if not parsed.get("code"):
        if parsed.get("auth_required"):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Codeforces requires authentication for this submission page. "
                    "Set CODEFORCES_COOKIE in backend .env to fetch private submission source."
                ),
            )
        if parsed.get("source_unavailable"):
            raise HTTPException(
                status_code=404,
                detail="Codeforces does not expose source code for this submission.",
            )
        _, cookie_valid, cookie_status = _get_codeforces_cookie()
        if cookie_status == "malformed":
            raise HTTPException(
                status_code=400,
                detail=(
                    "CODEFORCES_COOKIE in .env is malformed. Expected format like "
                    "`JSESSIONID=...; 39ce7=...`."
                ),
            )
        if not cookie_valid:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Could not extract source code. The page may require login or the source is unavailable. "
                    "Set CODEFORCES_COOKIE in backend .env and restart the server."
                ),
            )
        raise HTTPException(
            status_code=404,
            detail="Could not extract source code. The submission may be private or unavailable.",
        )

    return {
        "submission_url": url,
        "language": parsed.get("language") or "",
        "verdict": parsed.get("verdict") or "",
        "code": parsed.get("code") or "",
        "code_lines": (parsed.get("code") or "").count("\n") + 1 if parsed.get("code") else 0,
    }


@app.get("/api/contests/upcoming")
def upcoming_contests():
    platforms = {
        "codeforces": "Codeforces",
        "leetcode": "LeetCode",
    }

    contests = []
    last_updated_values = []
    now_ts = int(time.time())

    for slug, label in platforms.items():
        try:
            payload = _fetch_contest_hive(slug)
            updated = payload.get("lastUpdated") or payload.get("last_updated")
            if updated:
                last_updated_values.append(updated)

            for item in payload.get("data", []):
                title = item.get("title") or item.get("name") or "Upcoming Contest"
                start_time = item.get("startTime") or item.get("start_time")
                end_time = item.get("endTime") or item.get("end_time")
                duration = item.get("duration") or item.get("duration_seconds")
                url = item.get("url")
                contest_id = item.get("id") or item.get("titleSlug") or item.get("slug")
                phase = item.get("type") or item.get("category") or item.get("contestType")

                start_ts = _iso_to_timestamp(start_time)
                if start_ts and start_ts < now_ts - 300:
                    continue

                contests.append(
                    {
                        "id": contest_id,
                        "title": title,
                        "start_time": start_time,
                        "end_time": end_time,
                        "duration_seconds": duration,
                        "url": url,
                        "platform": label,
                        "phase": phase,
                    }
                )
        except Exception:
            continue

    contests.sort(key=lambda row: _iso_to_timestamp(row.get("start_time")))
    last_updated = None
    if last_updated_values:
        last_updated = max(last_updated_values, key=_iso_to_timestamp)

    return {"data": contests, "last_updated": last_updated}
