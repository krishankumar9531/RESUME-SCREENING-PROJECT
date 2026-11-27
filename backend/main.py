"""FastAPI backend for the AI Resume Screening & Candidate Shortlisting System."""

from __future__ import annotations

import io
import re
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import sklearn
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.auth import (
    SESSION_COOKIE_NAME,
    SESSION_TTL_SECONDS,
    authenticate_hr_user,
    create_hr_user,
    create_session_token,
    init_auth_db,
    require_hr_user,
)

from screening_engine import (
    APP_DIR,
    DEFAULT_CONFIG,
    DEFAULT_GITHUB_ACTIVITY,
    EDU_LEVELS,
    FEATURE_COLUMNS,
    FEATURE_LIMITS,
    HR_DECISIONS,
    REQ_EDU_OPTIONS,
    SAMPLE_JD,
    SAMPLE_RESUMES_DIR,
    SKILL_ALIASES,
    STATUS_REJECTED,
    STATUS_REVIEW,
    STATUS_SHORTLISTED,
    canonical_skill,
    explain,
    extract_job_skills,
    extract_required_education,
    extract_required_experience,
    load_model_bundle_raw,
    model_probabilities,
    normalize_education_column,
    parse_resume_raw,
    pretty_skill,
    results_to_export,
    score_candidates,
)

FRONTEND_DIST = APP_DIR / "frontend" / "dist"


@lru_cache(maxsize=1)
def get_model_bundle() -> dict[str, Any]:
    return load_model_bundle_raw(compute_metrics_if_loaded=True)


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    init_auth_db()
    yield


app = FastAPI(
    title="AI Resume Screening & Candidate Shortlisting API",
    version="1.0.0",
    description="FastAPI service integrating the scikit-learn shortlisting model and resume parser.",
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "HR Recruiter"

class JDParseRequest(BaseModel):
    jd_text: str = ""


class JobRequirements(BaseModel):
    skills: list[str] = Field(default_factory=list)
    must: list[str] = Field(default_factory=list)
    exp: float = 0.0
    edu_rank: int = 0


class ScreeningConfig(BaseModel):
    cutoff: float = DEFAULT_CONFIG["cutoff"]
    band: float = DEFAULT_CONFIG["band"]
    strict_must: bool = DEFAULT_CONFIG["strict_must"]
    w_skill: float = DEFAULT_CONFIG["w_skill"]
    w_exp: float = DEFAULT_CONFIG["w_exp"]
    w_edu: float = DEFAULT_CONFIG["w_edu"]
    ml_weight: float = DEFAULT_CONFIG["ml_weight"]
    github_default: float = DEFAULT_CONFIG["github_default"]


class CandidateInput(BaseModel):
    filename: str
    name: str
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    github: str = ""
    text: str
    text_hash: str
    words: int = 0
    experience: float = 0.0
    experience_source: str = "none"
    education: str = "Unknown"
    projects: int = 0
    github_activity: float | None = None
    hr_decision: str = "Auto"


class ScreenRequest(BaseModel):
    candidates: list[CandidateInput]
    requirements: JobRequirements
    config: ScreeningConfig = Field(default_factory=ScreeningConfig)


class ModelPredictRequest(BaseModel):
    years_experience: float = 5.0
    skills_match_score: float = 74.0
    education_level: str = "Bachelors"
    project_count: int = 10
    resume_length: int = 574
    github_activity: float = DEFAULT_GITHUB_ACTIVITY


class ExportRequest(ScreenRequest):
    shortlist_only: bool = False


# ============================================================
# HELPERS
# ============================================================

def _clean_json_value(value: Any) -> Any:
    if isinstance(value, (np.floating, float)):
        return None if np.isnan(value) else float(value)
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    return value


def _serialize_skill(canon: str) -> dict[str, str]:
    return {"id": canon, "label": pretty_skill(canon)}


def _build_edits_and_parsed(candidates: list[CandidateInput]) -> tuple[list[dict], pd.DataFrame]:
    parsed: list[dict] = []
    edit_rows: list[dict] = []
    for c in candidates:
        parsed.append({
            "filename": c.filename,
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "linkedin": c.linkedin,
            "github": c.github,
            "text": c.text,
            "text_hash": c.text_hash,
            "words": c.words,
            "experience": c.experience,
            "experience_source": c.experience_source,
            "education": c.education,
            "projects": c.projects,
            "error": "",
        })
        edit_rows.append({
            "Candidate": c.name,
            "File": c.filename,
            "Experience (yrs)": float(c.experience),
            "Education": c.education if c.education in EDU_LEVELS else "Unknown",
            "Projects": int(c.projects),
            "GitHub activity": np.nan if c.github_activity is None else float(c.github_activity),
            "HR decision": c.hr_decision if c.hr_decision in HR_DECISIONS else "Auto",
        })
    return parsed, pd.DataFrame(edit_rows)


def _run_scoring(payload: ScreenRequest) -> tuple[pd.DataFrame, dict[str, Any], list[dict]]:
    bundle = get_model_bundle()
    parsed, edits = _build_edits_and_parsed(payload.candidates)

    skills: list[str] = []
    for token in payload.requirements.skills:
        canon = canonical_skill(token)
        if canon and canon not in skills:
            skills.append(canon)
    must = [canonical_skill(s) for s in payload.requirements.must if canonical_skill(s) in skills]
    req = {
        "skills": skills,
        "must": must,
        "exp": float(payload.requirements.exp),
        "edu_rank": max(0, min(int(payload.requirements.edu_rank), len(REQ_EDU_OPTIONS) - 1)),
    }
    cfg = payload.config.model_dump()
    df = score_candidates(parsed, edits, req, cfg, bundle)
    return df, req, parsed


# ============================================================
# AUTH ROUTES
# ============================================================

def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_TTL_SECONDS,
        path="/",
    )


@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response) -> dict[str, Any]:
    user = authenticate_hr_user(payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_session_token(user)
    _set_session_cookie(response, token)
    return {"user": user, "token": token}


@app.post("/api/auth/register")
def register(payload: RegisterRequest, response: Response) -> dict[str, Any]:
    try:
        user = create_hr_user(
            name=payload.name,
            email=payload.email,
            password=payload.password,
            role=payload.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token = create_session_token(user)
    _set_session_cookie(response, token)
    return {"user": user, "token": token}


@app.post("/api/auth/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"status": "logged_out"}


@app.get("/api/auth/me")
def current_hr_user(user: dict[str, Any] = Depends(require_hr_user)) -> dict[str, Any]:
    return {"user": user}


# ============================================================
# ROUTES
# ============================================================

@app.get("/api/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "TalentLens AI"
    }


@app.get("/api/model/info")
def model_info(_user: dict[str, Any] = Depends(require_hr_user)) -> dict[str, Any]:
    bundle = get_model_bundle()
    importances = []
    if bundle["importances"] is not None:
        importances = [
            {"feature": str(k), "importance": round(float(v), 4)}
            for k, v in bundle["importances"].items()
        ]
    return {
        "model_loaded": bundle["model"] is not None,
        "source": bundle["source"],
        "notice": bundle["notice"],
        "scikit_learn_version": sklearn.__version__,
        "metrics": bundle["metrics"],
        "importances": importances,
        "data_summary": bundle["data_summary"],
        "feature_columns": FEATURE_COLUMNS,
        "feature_limits": FEATURE_LIMITS,
        "education_levels": EDU_LEVELS,
        "required_education_options": REQ_EDU_OPTIONS,
        "hr_decisions": HR_DECISIONS,
        "default_config": DEFAULT_CONFIG,
        "sample_jd": SAMPLE_JD,
        "known_skills": [_serialize_skill(k) for k in SKILL_ALIASES],
    }


@app.post("/api/model/predict")
def predict_single(
    req: ModelPredictRequest, _user: dict[str, Any] = Depends(require_hr_user)
) -> dict[str, Any]:
    bundle = get_model_bundle()
    if bundle["model"] is None:
        raise HTTPException(status_code=503, detail=bundle["notice"] or "ML model is unavailable.")
    frame = pd.DataFrame([{
        "years_experience": req.years_experience,
        "skills_match_score": req.skills_match_score,
        "education_level": req.education_level,
        "project_count": req.project_count,
        "resume_length": req.resume_length,
        "github_activity": req.github_activity,
    }])
    prob = float(model_probabilities(bundle, frame)[0])
    return {
        "shortlist_probability": round(prob, 4),
        "prediction": "Shortlisted" if prob >= 0.5 else "Not Shortlisted",
    }


@app.post("/api/model/batch-csv")
async def predict_batch_csv(
    file: UploadFile = File(...), _user: dict[str, Any] = Depends(require_hr_user)
) -> dict[str, Any]:
    bundle = get_model_bundle()
    if bundle["model"] is None:
        raise HTTPException(status_code=503, detail=bundle["notice"] or "ML model is unavailable.")
    raw = await file.read()
    try:
        frame = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}") from exc

    missing = [c for c in FEATURE_COLUMNS if c not in frame.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")

    frame = frame.head(50000).copy()
    frame["education_level"] = normalize_education_column(frame["education_level"]).replace({"Phd": "PhD"})
    frame["shortlist_probability"] = model_probabilities(bundle, frame).round(4)
    frame["prediction"] = np.where(frame["shortlist_probability"] >= 0.5, "Yes", "No")

    shortlisted_count = int((frame["prediction"] == "Yes").sum())
    return {
        "total_rows": int(len(frame)),
        "shortlisted_count": shortlisted_count,
        "shortlist_rate": round(shortlisted_count / len(frame), 4) if len(frame) else 0.0,
        "preview": frame.head(200).replace({np.nan: None}).to_dict(orient="records"),
        "csv_content": frame.to_csv(index=False),
    }


@app.post("/api/jd/parse")
def parse_jd(
    req: JDParseRequest, _user: dict[str, Any] = Depends(require_hr_user)
) -> dict[str, Any]:
    text = req.jd_text or ""
    if not text.strip():
        return {"skills": [], "experience": 0, "education": "Any", "edu_rank": 0}
    skills = extract_job_skills(text)
    edu = extract_required_education(text)
    return {
        "skills": [_serialize_skill(s) for s in skills],
        "experience": extract_required_experience(text),
        "education": edu,
        "edu_rank": REQ_EDU_OPTIONS.index(edu),
    }


@app.post("/api/jd/canonicalize")
def canonicalize_skills(
    skills: list[str], _user: dict[str, Any] = Depends(require_hr_user)
) -> dict[str, Any]:
    cleaned: list[dict[str, str]] = []
    seen: set[str] = set()
    for token in skills:
        canon = canonical_skill(token)
        if canon and canon not in seen:
            seen.add(canon)
            cleaned.append(_serialize_skill(canon))
    return {"skills": cleaned}


@app.post("/api/resumes/parse")
async def parse_resumes(
    files: list[UploadFile] = File(...), _user: dict[str, Any] = Depends(require_hr_user)
) -> dict[str, Any]:
    parsed: list[dict[str, Any]] = []
    failed: list[dict[str, str]] = []
    for f in files:
        data = await f.read()
        item = parse_resume_raw(data, f.filename or "resume.txt")
        if item["error"]:
            failed.append({"filename": item["filename"], "error": item["error"]})
        else:
            item["github_activity"] = None
            item["hr_decision"] = "Auto"
            parsed.append(item)
    return {"parsed": parsed, "failed": failed}


@app.get("/api/demo/load")
def load_demo_workspace(_user: dict[str, Any] = Depends(require_hr_user)) -> dict[str, Any]:
    parsed: list[dict[str, Any]] = []
    failed: list[dict[str, str]] = []
    if SAMPLE_RESUMES_DIR.exists():
        for file_path in sorted(SAMPLE_RESUMES_DIR.iterdir()):
            if file_path.suffix.lower() in {".pdf", ".docx", ".txt", ".md"}:
                item = parse_resume_raw(file_path.read_bytes(), file_path.name)
                if item["error"]:
                    failed.append({"filename": item["filename"], "error": item["error"]})
                else:
                    item["github_activity"] = None
                    item["hr_decision"] = "Auto"
                    parsed.append(item)
    jd_skills = extract_job_skills(SAMPLE_JD)
    edu = extract_required_education(SAMPLE_JD)
    return {
        "jd_text": SAMPLE_JD,
        "requirements": {
            "skills": [_serialize_skill(s) for s in jd_skills],
            "must": [],
            "exp": extract_required_experience(SAMPLE_JD),
            "education": edu,
            "edu_rank": REQ_EDU_OPTIONS.index(edu),
        },
        "parsed": parsed,
        "failed": failed,
    }


@app.post("/api/screen")
def screen_candidates(
    payload: ScreenRequest, _user: dict[str, Any] = Depends(require_hr_user)
) -> dict[str, Any]:
    if not payload.candidates:
        return {
            "candidates": [],
            "summary": {
                "total": 0,
                "shortlisted": 0,
                "review": 0,
                "rejected": 0,
                "median_score": 0.0,
                "avg_score": 0.0,
                "avg_skill_match": 0.0,
                "skill_coverage": [],
            },
        }

    df, req, parsed = _run_scoring(payload)
    candidates_out: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        good, gaps = explain(row, req)
        ordered_missing = row["must_missing"] + [s for s in row["missing"] if s not in row["must_missing"]]
        questions = [
            f"Ask about hands-on experience with {pretty_skill(skill)}. It was not found in the resume."
            for skill in ordered_missing[:4]
        ]
        idx = int(row["idx"])
        candidates_out.append({
            "rank": int(row["rank"]),
            "idx": idx,
            "candidate": str(row["candidate"]),
            "file": str(row["file"]),
            "email": str(row["email"]),
            "phone": str(row["phone"]),
            "linkedin": str(row["linkedin"]),
            "github_profile": str(row["github_profile"]),
            "skills_pct": _clean_json_value(row["skills_pct"]),
            "matched": [_serialize_skill(s) for s in row["matched"]],
            "missing": [_serialize_skill(s) for s in row["missing"]],
            "must_missing": [_serialize_skill(s) for s in row["must_missing"]],
            "experience": float(row["experience"]),
            "experience_source": str(row["experience_source"]),
            "education": str(row["education"]),
            "edu_ok": bool(row["edu_ok"]),
            "projects": int(row["projects"]),
            "github_activity": float(row["github_activity"]),
            "words": int(row["words"]),
            "rule_score": _clean_json_value(row["rule_score"]),
            "model_prob": _clean_json_value(row["model_prob"]),
            "final_score": float(row["final_score"]),
            "status": str(row["status"]),
            "auto_status": str(row["auto_status"]),
            "hr_decision": str(row["hr_decision"]),
            "flags": list(row["flags"]),
            "good": good,
            "gaps": gaps,
            "interview_questions": questions,
            "text": parsed[idx]["text"],
        })

    counts = df["status"].value_counts()
    skill_coverage = []
    total_c = len(df)
    for skill in req["skills"]:
        matched_n = sum(1 for _, r in df.iterrows() if skill in r["matched"])
        skill_coverage.append({
            "id": skill,
            "label": pretty_skill(skill),
            "matched": matched_n,
            "total": total_c,
            "pct": round(100.0 * matched_n / total_c, 1) if total_c else 0.0,
            "is_must": skill in req["must"],
        })

    avg_skill = df["skills_pct"].dropna().mean()
    return {
        "candidates": candidates_out,
        "summary": {
            "total": total_c,
            "shortlisted": int(counts.get(STATUS_SHORTLISTED, 0)),
            "review": int(counts.get(STATUS_REVIEW, 0)),
            "rejected": int(counts.get(STATUS_REJECTED, 0)),
            "median_score": round(float(df["final_score"].median()), 1),
            "avg_score": round(float(df["final_score"].mean()), 1),
            "avg_skill_match": round(float(avg_skill), 1) if pd.notna(avg_skill) else 0.0,
            "skill_coverage": skill_coverage,
        },
    }


@app.post("/api/export/csv")
def export_csv(
    payload: ExportRequest, _user: dict[str, Any] = Depends(require_hr_user)
) -> Response:
    if not payload.candidates:
        raise HTTPException(status_code=400, detail="No candidates to export.")
    df, _, _ = _run_scoring(payload)
    export_df = results_to_export(df)
    filename = "resume_screening_report.csv"
    if payload.shortlist_only:
        export_df = export_df[export_df["Status"] == STATUS_SHORTLISTED]
        filename = "shortlisted_candidates.csv"
    return Response(
        content=export_df.to_csv(index=False),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# Serve built React frontend when available
if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str) -> FileResponse:
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        dist_root = FRONTEND_DIST.resolve()
        candidate = (dist_root / full_path).resolve()
        if full_path and candidate.is_relative_to(dist_root) and candidate.exists() and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(dist_root / "index.html")
