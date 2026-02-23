import os
from collections import defaultdict
from functools import lru_cache
import math
from pathlib import Path
import time
from urllib.parse import urlencode
from urllib.request import urlopen
import json

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


class RecommendationsPayload(BaseModel):
    codeforcesId: str
    perTopic: int = 3
    forceRefresh: bool = False


class DashboardPayload(BaseModel):
    codeforcesId: str


DATASET_DIR = Path(__file__).resolve().parents[1] / "cf_dataset_ml"
TOPIC_FEATURES_FILE = DATASET_DIR / "user_topic_features_ml.csv"
USER_CLUSTERS_FILE = DATASET_DIR / "user_clusters_v2.csv"
USER_PROFILE_FILE = DATASET_DIR / "user_profile.csv"
PROBLEM_HISTORY_FILE = DATASET_DIR / "problem_attempt_history.csv"
CLUSTER_STATS_FILE = DATASET_DIR / "cluster_topic_problem_stats.csv"
TRAINING_FEATURE_COLUMNS_FILE = DATASET_DIR / "training_feature_columns_v2.txt"


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


def _cf_api_get(method: str, **params):
    query = urlencode(params)
    url = f"https://codeforces.com/api/{method}?{query}"
    with urlopen(url, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    if payload.get("status") != "OK":
        raise ValueError(payload.get("comment", "Codeforces API call failed"))
    return payload.get("result", [])


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

    submissions = _cf_api_get("user.status", handle=codeforces_id, **{"from": 1, "count": 500})

    solved_problem_keys = set()
    topic_attempted = defaultdict(set)
    topic_solved = defaultdict(set)
    recent_submissions = []
    model_topics = set(_load_model_topics())

    for idx, sub in enumerate(submissions):
        problem = sub.get("problem") or {}
        contest_id = problem.get("contestId")
        index = problem.get("index")
        if contest_id is not None and index:
            problem_key = f"{contest_id}-{index}"
        else:
            problem_key = f"misc-{idx}"

        raw_tags = [str(t).strip().lower() for t in (problem.get("tags") or [])]
        tags = [t for t in raw_tags if t in model_topics]
        for topic in tags:
            topic_attempted[topic].add(problem_key)

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
        "recent_submissions": recent_submissions,
        "last_synced": int(time.time()),
    }


def _build_live_user_features(codeforces_id: str):
    model_topics = set(_load_model_topics())
    topic_stats = defaultdict(lambda: {"attempted": set(), "solved": set(), "submissions": 0})
    solved_problem_keys = set()

    profile_rows = _cf_api_get("user.info", handles=codeforces_id)
    user_profile = profile_rows[0] if profile_rows else {}
    rating = _to_float(user_profile.get("rating"), fallback=0.0)

    submissions = _cf_api_get("user.status", handle=codeforces_id, **{"from": 1, "count": 5000})
    per_problem = {}
    for sub in submissions:
        problem = sub.get("problem") or {}
        contest_id = problem.get("contestId")
        index = problem.get("index")
        if contest_id is None or not index:
            continue

        problem_key = f"{contest_id}-{index}"
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


def _predict_cluster_from_features(topic_rows, rating):
    cols = _load_training_feature_columns()
    target_map = _build_feature_vector(topic_rows, rating)
    target = [target_map.get(col, 0.0) for col in cols]

    best_cluster = None
    best_dist = float("inf")
    for cluster, vec in _load_known_user_vectors():
        dist = 0.0
        for i in range(len(cols)):
            d = target[i] - vec[i]
            dist += d * d
        dist = math.sqrt(dist)
        if dist < best_dist:
            best_dist = dist
            best_cluster = cluster
    return best_cluster or "C0"


def _get_cached_sheet(codeforces_id: str):
    try:
        collection = get_collection()
        doc = collection.find_one({"codeforces_id": codeforces_id}, {"sheet_cache": 1})
        if not doc:
            return None
        return doc.get("sheet_cache")
    except Exception:
        return None


def _set_cached_sheet(codeforces_id: str, sheet_payload):
    try:
        collection = get_collection()
        collection.update_one(
            {"codeforces_id": codeforces_id},
            {"$set": {"sheet_cache": sheet_payload}},
            upsert=False,
        )
    except Exception:
        # Cache write failure should not break recommendation response.
        return


def _compute_weakness(topic_row):
    attempted = _to_int(topic_row.get("attempted_unique"), fallback=0)
    accuracy = _to_float(topic_row.get("accuracy_unique"), fallback=0.0)
    struggle = _to_float(topic_row.get("struggle_score"), fallback=0.0)

    # Higher is weaker. No-attempt topics are treated as weak to promote topic coverage.
    return (1.0 - accuracy) + min(struggle, 8.0) / 10.0 + (0.4 if attempted == 0 else 0.0)


def _recommend_for_topic(cluster, topic, solved_problem_keys, user_rating, per_topic):
    cluster_topic_rows = _load_cluster_topic_problem_rows().get((cluster, topic), [])
    candidates = []
    for row in cluster_topic_rows:
        if row.get("problem_key") in solved_problem_keys:
            continue

        success_rate = _to_float(row.get("success_rate"), fallback=0.0)
        median_submissions = _to_float(row.get("median_submissions_until_ok"), fallback=99.0)
        problem_rating = _to_float(row.get("problem_rating"), fallback=0.0)
        rating_gap = abs(problem_rating - user_rating) if problem_rating > 0 and user_rating > 0 else 0.0
        score = (success_rate * 100.0) - median_submissions - (rating_gap / 800.0)

        candidates.append(
            {
                "score": round(score, 4),
                "problem_key": row.get("problem_key"),
                "problem_name": row.get("problem_name"),
                "problem_rating": row.get("problem_rating"),
                "success_rate": round(success_rate, 4),
                "median_submissions_until_ok": row.get("median_submissions_until_ok"),
                "cf_link": row.get("cf_link"),
            }
        )

    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates[:per_topic]


@app.post("/api/recommendations/weak-topics")
def weak_topic_recommendations(payload: RecommendationsPayload):
    codeforces_id = payload.codeforcesId.strip()
    per_topic = max(1, min(payload.perTopic, 10))
    if not codeforces_id:
        raise HTTPException(status_code=400, detail="codeforcesId is required")
    if not payload.forceRefresh:
        cached = _get_cached_sheet(codeforces_id)
        if isinstance(cached, dict) and cached.get("recommendations"):
            cached["cached"] = True
            return cached

    resolved_id, resolution_mode = _resolve_dataset_user_id(codeforces_id)
    cluster = None
    user_rating = 0.0
    solved_problem_keys = set()
    topic_rows = []
    source = "dataset"

    if resolved_id is not None:
        user_cluster_map = _load_user_cluster_map()
        cluster = user_cluster_map.get(resolved_id)
        topic_rows = _load_user_topic_rows().get(resolved_id, [])
        user_rating = _load_user_rating_map().get(resolved_id, 0.0)
        solved_problem_keys = _load_solved_problem_keys(resolved_id)

        if cluster is None and topic_rows:
            cluster = _predict_cluster_from_features(topic_rows, user_rating)
            source = "dataset_predicted_cluster"
        elif resolution_mode == "case_insensitive":
            source = "dataset_case_insensitive_match"

    if not topic_rows:
        try:
            user_rating, topic_rows, solved_problem_keys = _build_live_user_features(codeforces_id)
            cluster = _predict_cluster_from_features(topic_rows, user_rating)
            source = "live_codeforces_fallback"
        except Exception as exc:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"User '{codeforces_id}' not found in local clustering dataset and "
                    f"live Codeforces fallback failed: {exc}"
                ),
            )

    topic_rows_sorted = sorted(topic_rows, key=_compute_weakness, reverse=True)
    weakest = topic_rows_sorted[:5]

    recommendations = []
    for row in weakest:
        topic = row.get("topic")
        recs = _recommend_for_topic(cluster, topic, solved_problem_keys, user_rating, per_topic)
        recommendations.append(
            {
                "topic": topic,
                "weakness_score": round(_compute_weakness(row), 4),
                "attempted_unique": _to_int(row.get("attempted_unique"), fallback=0),
                "solved_unique": _to_int(row.get("solved_unique"), fallback=0),
                "accuracy_unique": round(_to_float(row.get("accuracy_unique"), fallback=0.0), 4),
                "struggle_score": round(_to_float(row.get("struggle_score"), fallback=0.0), 4),
                "problems": recs,
            }
        )

    response_payload = {
        "codeforces_id": codeforces_id,
        "cluster": cluster,
        "cluster_source": source,
        "top_weak_topics_count": len(recommendations),
        "recommendations": recommendations,
        "cached": False,
    }
    _set_cached_sheet(codeforces_id, response_payload)
    return response_payload


@app.post("/api/dashboard")
def dashboard(payload: DashboardPayload):
    codeforces_id = payload.codeforcesId.strip()
    if not codeforces_id:
        raise HTTPException(status_code=400, detail="codeforcesId is required")
    try:
        return _build_dashboard_data(codeforces_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Dashboard data fetch failed: {exc}")
