"""Shared resume parsing, job-description extraction, ML scoring, and ranking engine.

Used by both the FastAPI backend (backend/main.py) and the existing Streamlit app (app.py).
"""

from __future__ import annotations

import hashlib
import io
import math
import re
import warnings
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd


# ============================================================
# CONSTANTS
# ============================================================

APP_DIR = Path(__file__).resolve().parent
MODEL_PATH = APP_DIR / "resume_screening_model.pkl"
METADATA_PATH = APP_DIR / "resume_screening_model_metadata.json"
DATA_PATH = APP_DIR / "ai_resume_screening.csv"
SAMPLE_RESUMES_DIR = APP_DIR / "resume"

FEATURE_COLUMNS = [
    "years_experience",
    "skills_match_score",
    "education_level",
    "project_count",
    "resume_length",
    "github_activity",
]
NUMERIC_COLUMNS = [c for c in FEATURE_COLUMNS if c != "education_level"]
TARGET_COLUMN = "shortlisted"

# Ranges seen in the training data. Values are clamped to these before scoring
# so that one unusual resume cannot push the model outside what it has seen.
FEATURE_LIMITS = {
    "years_experience": (0, 15),
    "skills_match_score": (0, 100),
    "project_count": (0, 25),
    "resume_length": (150, 900),
    "github_activity": (0, 842),
}
DEFAULT_GITHUB_ACTIVITY = 321      # dataset median; resumes do not contain this number
NEUTRAL_SKILL_SCORE = 74.3         # dataset median, used when a JD lists no skills

EDU_LEVELS = ["Unknown", "High School", "Bachelors", "Masters", "PhD"]
EDU_RANK = {label: i for i, label in enumerate(EDU_LEVELS)}
REQ_EDU_OPTIONS = ["Any", "High School", "Bachelors", "Masters", "PhD"]

STATUS_SHORTLISTED = "Shortlisted"
STATUS_REVIEW = "Review"
STATUS_REJECTED = "Not shortlisted"
STATUS_CLASS = {STATUS_SHORTLISTED: "ok", STATUS_REVIEW: "warn", STATUS_REJECTED: "bad"}
HR_DECISIONS = ["Auto", "Shortlist", "Reject"]

DEFAULT_CONFIG = {
    "cutoff": 60,
    "band": 10,
    "strict_must": True,
    "w_skill": 50,
    "w_exp": 30,
    "w_edu": 20,
    "ml_weight": 30,
    "github_default": DEFAULT_GITHUB_ACTIVITY,
}

SAMPLE_JD = """Backend Developer

We are hiring a Backend Developer with 2+ years of experience building web services.

Required skills: Python, Django, REST API, PostgreSQL, Docker, AWS and Git.
Nice to have: Redis, CI/CD.

Education: B.Tech / B.E. in Computer Science, or MCA.
"""


# ============================================================
# SKILL TAXONOMY  (canonical name -> aliases)
# ============================================================

SKILL_ALIASES: dict[str, list[str]] = {
    # languages
    "python": [],
    "java": [],
    "javascript": ["js", "ecmascript"],
    "typescript": [],
    "c++": ["cpp"],
    "c": [],
    "c#": ["csharp", "c sharp"],
    "golang": ["go lang"],
    "rust": [],
    "kotlin": [],
    "swift": [],
    "php": [],
    "ruby": [],
    "scala": [],
    "matlab": [],
    "bash": ["shell scripting"],
    "sql": [],
    # web & backend
    "html": ["html5"],
    "css": ["css3"],
    "react": ["react.js", "reactjs"],
    "angular": ["angularjs"],
    "vue": ["vue.js", "vuejs"],
    "next.js": ["nextjs"],
    "node.js": ["nodejs", "node js", "node"],
    "express.js": ["expressjs"],
    "django": [],
    "flask": [],
    "fastapi": [],
    "spring boot": ["springboot"],
    "spring": [],
    "hibernate": [],
    ".net": ["dotnet", "asp.net"],
    "jquery": [],
    "tailwind": ["tailwind css"],
    "bootstrap": [],
    "rest api": ["rest apis", "restful", "restful api", "restful apis", "rest"],
    "graphql": [],
    "microservices": ["micro-services"],
    # data
    "mysql": [],
    "postgresql": ["postgres"],
    "mongodb": ["mongo"],
    "oracle": [],
    "sqlite": [],
    "redis": [],
    "elasticsearch": [],
    "cassandra": [],
    "nosql": ["no sql"],
    "snowflake": [],
    "bigquery": [],
    "hadoop": [],
    "spark": ["apache spark", "pyspark"],
    "kafka": [],
    "airflow": [],
    "etl": [],
    "data analysis": ["data analytics"],
    "statistics": ["statistical analysis"],
    # ML / AI
    "machine learning": ["ml"],
    "deep learning": [],
    "nlp": ["natural language processing"],
    "computer vision": [],
    "tensorflow": [],
    "pytorch": [],
    "keras": [],
    "scikit-learn": ["sklearn", "scikit learn"],
    "pandas": [],
    "numpy": [],
    "scipy": [],
    "matplotlib": [],
    "seaborn": [],
    "opencv": [],
    "xgboost": [],
    "hugging face": ["huggingface"],
    "llm": ["llms", "large language models"],
    "langchain": [],
    "generative ai": ["genai", "gen ai"],
    # BI
    "power bi": ["powerbi"],
    "tableau": [],
    "excel": ["ms excel", "microsoft excel", "advanced excel"],
    "looker": [],
    # cloud & devops
    "docker": [],
    "kubernetes": ["k8s"],
    "aws": ["amazon web services"],
    "azure": [],
    "gcp": ["google cloud"],
    "terraform": [],
    "jenkins": [],
    "ci/cd": ["cicd", "ci cd", "continuous integration"],
    "git": [],
    "github": [],
    "gitlab": [],
    "linux": [],
    "ansible": [],
    # mobile
    "android": [],
    "ios": [],
    "flutter": [],
    "react native": [],
    # practices
    "agile": [],
    "scrum": [],
    "jira": [],
    "unit testing": ["junit", "pytest"],
    "selenium": [],
    "postman": [],
}

ALIAS_TO_CANON: dict[str, str] = {}
for _canon, _aliases in SKILL_ALIASES.items():
    ALIAS_TO_CANON[_canon] = _canon
    for _alias in _aliases:
        ALIAS_TO_CANON[_alias] = _canon

SKILL_GUARDS = {"excel": r"(?!\s+(?:in|at|as)\b)"}

PRETTY_SKILLS = {
    "aws": "AWS", "gcp": "GCP", "sql": "SQL", "html": "HTML", "css": "CSS", "nlp": "NLP",
    "c++": "C++", "c#": "C#", "c": "C", ".net": ".NET", "node.js": "Node.js",
    "next.js": "Next.js", "express.js": "Express.js", "ci/cd": "CI/CD",
    "rest api": "REST API", "mysql": "MySQL", "postgresql": "PostgreSQL",
    "mongodb": "MongoDB", "nosql": "NoSQL", "power bi": "Power BI", "pytorch": "PyTorch",
    "tensorflow": "TensorFlow", "javascript": "JavaScript", "typescript": "TypeScript",
    "github": "GitHub", "gitlab": "GitLab", "fastapi": "FastAPI", "graphql": "GraphQL",
    "opencv": "OpenCV", "ios": "iOS", "llm": "LLM", "etl": "ETL", "php": "PHP",
    "jquery": "jQuery", "xgboost": "XGBoost", "bigquery": "BigQuery",
    "scikit-learn": "scikit-learn", "golang": "Go", "ml": "ML", "k8s": "Kubernetes",
    "langchain": "LangChain", "hugging face": "Hugging Face", "generative ai": "Generative AI",
    "spring boot": "Spring Boot", "react native": "React Native", "jira": "Jira",
}


def canonical_skill(skill: str) -> str:
    key = skill.strip().lower()
    return ALIAS_TO_CANON.get(key, key)


def pretty_skill(skill: str) -> str:
    return PRETTY_SKILLS.get(skill, skill.title() if skill.islower() else skill)


@lru_cache(maxsize=4096)
def _skill_regex(skill: str) -> re.Pattern:
    names = {skill, *SKILL_ALIASES.get(skill, [])}
    alternatives = []
    for name in sorted(names, key=len, reverse=True):
        escaped = re.escape(name).replace(r"\ ", r"[\s\-]+").replace(" ", r"[\s\-]+")
        alternatives.append(escaped)
    core = "(?:" + "|".join(alternatives) + ")"
    guard = SKILL_GUARDS.get(skill, "")
    flags = re.IGNORECASE
    if skill == "c":
        core, flags = "C", 0
    return re.compile(r"(?<![A-Za-z0-9+#])" + core + r"(?![A-Za-z0-9+#])" + guard, flags)


def find_skill(text: str, skill: str) -> re.Match | None:
    return _skill_regex(skill).search(text)


def extract_job_skills(job_description: str) -> list[str]:
    """Skills mentioned in the JD, ordered by first appearance."""
    found: list[tuple[int, str]] = []
    for skill in SKILL_ALIASES:
        match = find_skill(job_description, skill)
        if match:
            found.append((match.start(), skill))
    found.sort()
    names = [s for _, s in found]
    kept = [
        s for s in names
        if not any(
            s != o and " " in o and re.search(rf"(?<![a-z0-9]){re.escape(s)}(?![a-z0-9])", o) for o in names
        )
    ]
    return kept


def match_skills(text: str, required: list[str]) -> tuple[list[str], list[str]]:
    matched = [s for s in required if find_skill(text, s)]
    missing = [s for s in required if s not in matched]
    return matched, missing


# ============================================================
# JOB DESCRIPTION PARSING
# ============================================================

_EXP_PATTERNS = [
    re.compile(r"(\d{1,2})\s*(?:-|–|to)\s*\d{1,2}\s*\+?\s*(?:years?|yrs?)", re.I),
    re.compile(r"(\d{1,2})\s*\+\s*(?:years?|yrs?)", re.I),
    re.compile(r"(?:minimum|min\.?|at least|atleast|over|more than)\s*(?:of\s*)?(\d{1,2})\s*\+?\s*(?:years?|yrs?)", re.I),
    re.compile(r"(\d{1,2})\s*(?:years?|yrs?)\s*(?:of\s+)?(?:[a-z\-]+\s+){0,3}?experience", re.I),
]


def extract_required_experience(job_description: str) -> int:
    best: tuple[int, int] | None = None
    for pattern in _EXP_PATTERNS:
        match = pattern.search(job_description)
        if match and (best is None or match.start() < best[0]):
            best = (match.start(), int(match.group(1)))
    return best[1] if best else 0


_EDU_PATTERNS = {
    "PhD": r"\bph\.?\s?d\b|\bdoctorate\b|\bdoctor of philosophy\b",
    "Masters": (
        r"\bm\.?\s?tech\b|\bm\.?\s?sc\b|\bm\.?\s?eng\b|\bmba\b|\bmca\b|\bpgdm\b|\bpost[- ]?graduate\b"
        r"|\bmaster'?s\b|\bmasters\b|\bmaster\s+(?:of|in|degree)\b|\bm\.\s?s\b"
    ),
    "Bachelors": (
        r"\bb\.?\s?tech\b|\bb\.\s?e\b|\bb\.?\s?sc\b|\bbca\b|\bbba\b|\bb\.?\s?com\b|\bb\.?\s?eng\b"
        r"|\bb\.\s?a\b|\bbachelor'?s?\b|\bundergraduate\b|\bgraduate degree\b|\bdegree in\b"
    ),
    "High School": r"\bhigh school\b|\bhsc\b|\b12th\b|\bsenior secondary\b|\bssc\b|\bged\b",
}
_EDU_REGEX = {k: re.compile(v, re.I) for k, v in _EDU_PATTERNS.items()}


def detect_education_levels(text: str) -> list[str]:
    return [level for level, rx in _EDU_REGEX.items() if rx.search(text)]


def extract_required_education(job_description: str) -> str:
    """Minimum level named in the JD."""
    levels = detect_education_levels(job_description)
    if not levels:
        return "Any"
    return min(levels, key=lambda lv: EDU_RANK[lv])


def highest_education(text: str) -> str:
    levels = detect_education_levels(text)
    if not levels:
        return "Unknown"
    return max(levels, key=lambda lv: EDU_RANK[lv])


# ============================================================
# RESUME TEXT EXTRACTION
# ============================================================

def _pdf_text(data: bytes) -> str:
    try:
        try:
            import pymupdf
        except ImportError:
            import fitz as pymupdf
    except ImportError:
        pymupdf = None

    if pymupdf is not None:
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            return "\n".join(page.get_text() for page in doc)

    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError("PDF support needs `pip install pymupdf` (or pypdf).") from exc
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def _docx_text(data: bytes) -> str:
    try:
        from docx import Document
        from docx.table import Table
        from docx.text.paragraph import Paragraph
    except ImportError as exc:
        raise RuntimeError("DOCX support needs `pip install python-docx`.") from exc

    document = Document(io.BytesIO(data))
    lines: list[str] = []
    for child in document.element.body.iterchildren():
        if child.tag.endswith("}p"):
            lines.append(Paragraph(child, document).text)
        elif child.tag.endswith("}tbl"):
            for row in Table(child, document).rows:
                seen, cells = [], []
                for cell in row.cells:
                    if any(cell._tc is s for s in seen):
                        continue
                    seen.append(cell._tc)
                    cells.append(cell.text.strip())
                lines.append(" | ".join(c for c in cells if c))
    return "\n".join(lines)


def extract_text(data: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        text = _pdf_text(data)
    elif ext == ".docx":
        text = _docx_text(data)
    elif ext in {".txt", ".md"}:
        text = data.decode("utf-8", errors="ignore")
    else:
        raise ValueError(f"Unsupported file type: {ext or 'unknown'}")
    return text.replace("\u00a0", " ").replace("\x00", "")


# ============================================================
# RESUME FIELD EXTRACTION
# ============================================================

SECTION_HEADERS = {
    "experience": {
        "experience", "work experience", "professional experience", "employment history",
        "work history", "internships", "internship", "career history", "professional background",
        "employment", "internship experience",
    },
    "education": {
        "education", "academic background", "academics", "educational qualifications",
        "education qualification", "academic qualifications", "qualifications",
    },
    "projects": {
        "projects", "personal projects", "academic projects", "key projects", "project experience",
        "selected projects", "technical projects", "projects undertaken", "project work",
    },
    "skills": {
        "skills", "technical skills", "core competencies", "key skills", "skills summary",
        "tech stack", "technologies", "technical expertise",
    },
    "certifications": {"certifications", "certificates", "courses", "licenses", "training"},
    "achievements": {
        "achievements", "awards", "honors", "accomplishments", "publications",
        "extracurricular", "extracurriculars", "activities", "hobbies", "interests",
    },
    "summary": {"summary", "profile", "professional summary", "objective", "career objective", "about me", "about"},
}
IGNORED_FOR_EXPERIENCE = {"projects", "education", "certifications", "achievements", "skills"}


def _header_key(line: str) -> str | None:
    key = re.sub(r"\s+", " ", re.sub(r"[^a-z ]", " ", line.lower())).strip()
    if not key or len(key) > 40:
        return None
    for section, names in SECTION_HEADERS.items():
        if key in names:
            return section
    return None


def iter_sections(text: str):
    """Yield (section, line) for every non-header line."""
    section = "header"
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        header = _header_key(line)
        if header:
            section = header
            continue
        yield section, line


_MON = r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
_SEP = r"\s*(?:-|–|—|to|until|till)\s*"
_PRESENT = r"(present|current|currently|now|ongoing|till date|to date|date)"
_RANGE_MONTH_YEAR = re.compile(
    rf"\b{_MON}\.?,?\s+(\d{{4}}){_SEP}(?:{_MON}\.?,?\s+(\d{{4}})|{_PRESENT}\b)", re.I
)
_RANGE_NUMERIC = re.compile(
    rf"\b(\d{{1,2}})[/.](\d{{4}}){_SEP}(?:(\d{{1,2}})[/.](\d{{4}})|{_PRESENT}\b)", re.I
)
_RANGE_YEAR = re.compile(rf"\b((?:19|20)\d{{2}}){_SEP}(?:((?:19|20)\d{{2}})\b|{_PRESENT}\b)", re.I)
_EDU_CONTEXT = re.compile(
    r"school|college|university|institute|b\.?\s?tech|m\.?\s?tech|bachelor|master|degree|cgpa|gpa|percentage|%|"
    r"secondary|diploma|\bmba\b|\bmca\b|\bbca\b|ph\.?d",
    re.I,
)
_STATED_EXPERIENCE = re.compile(
    r"(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:[a-z\-]+\s+){0,2}?experience", re.I
)


def _month_index(year: int, month: int) -> int:
    return year * 12 + (month - 1)


def _month_number(name: str) -> int:
    return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].index(name[:3].lower()) + 1


def extract_experience(text: str) -> tuple[float, str]:
    """Returns (years, source) where source is 'dates', 'stated' or 'none'."""
    now = datetime.now()
    now_idx = _month_index(now.year, now.month) + 1
    intervals: list[tuple[int, int]] = []

    def add(start: int, end: int) -> None:
        end = min(end, now_idx)
        if start < _month_index(1970, 1) or end <= start or start >= now_idx:
            return
        intervals.append((start, end))

    for section, line in iter_sections(text):
        if section in IGNORED_FOR_EXPERIENCE:
            continue
        low = line.lower()

        def blank(match: re.Match) -> str:
            return " " * len(match.group(0))

        for m in _RANGE_MONTH_YEAR.finditer(low):
            start = _month_index(int(m.group(2)), int(_month_number(m.group(1))))
            if m.group(3):
                end = _month_index(int(m.group(4)), _month_number(m.group(3))) + 1
            else:
                end = now_idx
            add(start, end)
        low = _RANGE_MONTH_YEAR.sub(blank, low)

        for m in _RANGE_NUMERIC.finditer(low):
            start_month, start_year = int(m.group(1)), int(m.group(2))
            if not 1 <= start_month <= 12:
                continue
            if m.group(3):
                end_month = int(m.group(3))
                if not 1 <= end_month <= 12:
                    continue
                end = _month_index(int(m.group(4)), end_month) + 1
            else:
                end = now_idx
            add(_month_index(start_year, start_month), end)
        low = _RANGE_NUMERIC.sub(blank, low)

        if not _EDU_CONTEXT.search(low):
            for m in _RANGE_YEAR.finditer(low):
                start = int(m.group(1)) * 12
                end = int(m.group(2)) * 12 if m.group(2) else now_idx
                add(start, end)

    if intervals:
        intervals.sort()
        merged = [list(intervals[0])]
        for start, end in intervals[1:]:
            if start <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        months = sum(end - start for start, end in merged)
        return round(min(months / 12, FEATURE_LIMITS["years_experience"][1]), 2), "dates"

    stated = [float(m.group(1)) for m in _STATED_EXPERIENCE.finditer(text)]
    if stated:
        return round(min(max(stated), FEATURE_LIMITS["years_experience"][1]), 2), "stated"
    return 0.0, "none"


_BULLET = re.compile(r"^\s*(?:[\u2022\u25cf\u25aa\u25e6\u2023\u2043\u2219\u25ba\u27a2•▪◦●►➢*\-–—·»]|\d+[.)])\s*")
_PROJECT_NOISE = re.compile(r"^(tech(?:nologies| stack)?|tools?|stack|github|link|demo|url|description|role|built|developed|using)\b", re.I)
_REPO_LINK = re.compile(r"github\.com/[\w.-]+/[\w.-]+", re.I)


def count_projects(text: str) -> int:
    titles = bullets = 0
    for section, line in iter_sections(text):
        if section != "projects":
            continue
        if _BULLET.match(line):
            bullets += 1
            continue
        words = line.split()
        if len(words) <= 12 and not line.endswith(".") and not _PROJECT_NOISE.match(line) and line[0].isalnum():
            titles += 1
    if titles:
        count = titles
    elif bullets:
        count = math.ceil(bullets / 2)
    else:
        count = len({m.group(0).lower() for m in _REPO_LINK.finditer(text)})
    return int(min(count, FEATURE_LIMITS["project_count"][1]))


_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_PHONE = re.compile(r"(?<!\d)(\+?\d[\d\s().-]{8,16}\d)(?!\d)")
_LINKEDIN = re.compile(r"linkedin\.com/in/[\w%-]+", re.I)
_GITHUB_PROFILE = re.compile(r"github\.com/([\w-]+)", re.I)
_NOT_A_NAME = re.compile(
    r"resume|curriculum|vitae|\bcv\b|engineer|developer|analyst|manager|student|profile|summary|objective|date of birth|personal details|contact",
    re.I,
)


def extract_contact(text: str, filename: str) -> dict:
    email = _EMAIL.search(text)
    phone = next((m.group(1).strip() for m in _PHONE.finditer(text) if 10 <= len(re.sub(r"\D", "", m.group(1))) <= 13), "")
    linkedin = _LINKEDIN.search(text)
    github = _GITHUB_PROFILE.search(text)

    name = ""
    for line in [l.strip() for l in text.splitlines() if l.strip()][:6]:
        words = line.split()
        if 2 <= len(words) <= 4 and not re.search(r"[\d@:/|]", line) and not _NOT_A_NAME.search(line):
            if all(re.fullmatch(r"[A-Za-z.'\-]+", w) for w in words):
                name = line.title() if line.isupper() else line
                break
    if not name:
        name = re.sub(r"[_\-]+", " ", Path(filename).stem).strip().title() or filename

    return {
        "name": name,
        "email": email.group(0) if email else "",
        "phone": phone,
        "linkedin": linkedin.group(0) if linkedin else "",
        "github": f"github.com/{github.group(1)}" if github else "",
    }


def parse_resume_raw(data: bytes, filename: str) -> dict:
    """Parse resume bytes into structured fields (pure Python, framework-agnostic)."""
    base = {"filename": filename, "error": "", "text": "", "text_hash": ""}
    try:
        text = extract_text(data, filename)
    except Exception as exc:  # noqa: BLE001
        return {**base, "error": str(exc), "name": Path(filename).stem}

    if len(text.strip()) < 80:
        return {
            **base,
            "error": "No readable text found (scanned image or empty file?). Try a text-based PDF/DOCX.",
            "name": Path(filename).stem,
        }

    experience, source = extract_experience(text)
    contact = extract_contact(text, filename)
    normalized = re.sub(r"\s+", " ", text.lower()).strip()
    return {
        **base,
        **contact,
        "text": text,
        "text_hash": hashlib.md5(normalized.encode("utf-8")).hexdigest(),
        "words": len(re.findall(r"\w+", text)),
        "experience": experience,
        "experience_source": source,
        "education": highest_education(text),
        "projects": count_projects(text),
    }


# ============================================================
# MODEL  (load the pickle, otherwise retrain from the CSV)
# ============================================================

def normalize_education_column(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip().str.title()


def build_pipeline():
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder

    preprocessor = ColumnTransformer(
        [
            ("education", OneHotEncoder(handle_unknown="ignore"), ["education_level"]),
            ("numeric", "passthrough", NUMERIC_COLUMNS),
        ]
    )
    return Pipeline([("preprocessor", preprocessor), ("classifier", GradientBoostingClassifier(random_state=42))])


def load_training_frame() -> tuple[pd.DataFrame, pd.Series]:
    df = pd.read_csv(DATA_PATH)
    missing = set(FEATURE_COLUMNS + [TARGET_COLUMN]) - set(df.columns)
    if missing:
        raise ValueError(f"{DATA_PATH.name} is missing columns: {sorted(missing)}")
    X = df[FEATURE_COLUMNS].copy()
    X["education_level"] = normalize_education_column(X["education_level"])
    y = df[TARGET_COLUMN].astype(str).str.strip().str.lower().isin(["yes", "1", "true", "y"]).astype(int)
    return X, y


def _positive_index(model) -> int:
    classes = list(model.classes_)
    for candidate in (1, True, "Yes", "yes", "1"):
        if candidate in classes:
            return classes.index(candidate)
    return len(classes) - 1


def _education_map(model) -> dict[str, str]:
    try:
        categories = model.named_steps["preprocessor"].named_transformers_["education"].categories_[0]
        return {str(c).lower(): str(c) for c in categories}
    except Exception:  # noqa: BLE001
        return {"high school": "High School", "bachelors": "Bachelors", "masters": "Masters", "phd": "Phd"}


def _feature_importances(model) -> pd.Series | None:
    try:
        names = model.named_steps["preprocessor"].get_feature_names_out()
        values = model.named_steps["classifier"].feature_importances_
        series = pd.Series(values, index=[n.split("__", 1)[-1] for n in names])
        education = series[series.index.str.startswith("education_level")].sum()
        series = series[~series.index.str.startswith("education_level")]
        series["education_level"] = education
        return series.sort_values(ascending=False)
    except Exception:  # noqa: BLE001
        return None


def _evaluate_holdout(X: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
    from sklearn.model_selection import train_test_split

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    holdout = build_pipeline().fit(X_train, y_train)
    predictions = holdout.predict(X_test)
    return {
        "Accuracy": float(accuracy_score(y_test, predictions)),
        "Precision": float(precision_score(y_test, predictions, zero_division=0)),
        "Recall": float(recall_score(y_test, predictions, zero_division=0)),
        "F1": float(f1_score(y_test, predictions, zero_division=0)),
    }


def load_model_bundle_raw(
    compute_metrics_if_loaded: bool = False
) -> dict:

    bundle = {
        "model": None,
        "source": "",
        "notice": "",
        "metrics": None,
        "importances": None,
        "edu_map": {},
        "pos_idx": 1,
        "data_summary": None,
    }

    if not MODEL_PATH.exists():
        bundle["notice"] = (
            "Saved ML model not found. "
            "Scoring uses job-description fit only."
        )
        return bundle

    try:
        import joblib

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = joblib.load(MODEL_PATH)

        probe = pd.DataFrame([{
            "years_experience": 3,
            "skills_match_score": 70.0,
            "education_level": "Bachelors",
            "project_count": 5,
            "resume_length": 500,
            "github_activity": 200,
        }])

        model.predict_proba(probe)

        bundle["model"] = model
        bundle["source"] = f"Loaded {MODEL_PATH.name}"

        bundle["edu_map"] = _education_map(model)
        bundle["pos_idx"] = _positive_index(model)
        bundle["importances"] = _feature_importances(model)

    except Exception as exc:
        bundle["notice"] = (
            f"Model loading failed: {type(exc).__name__}: {exc}. "
            "Scoring uses job-description fit only."
        )

    return bundle

def model_education(bundle: dict, label: str) -> str:
    if label not in EDU_RANK or label == "Unknown":
        label = "Bachelors"
    return bundle["edu_map"].get(label.lower(), label)


def model_probabilities(bundle: dict, frame: pd.DataFrame) -> np.ndarray:
    X = frame[FEATURE_COLUMNS].copy()
    X["education_level"] = X["education_level"].map(lambda v: model_education(bundle, str(v)))
    for column, (low, high) in FEATURE_LIMITS.items():
        X[column] = pd.to_numeric(X[column], errors="coerce").fillna(low).clip(low, high)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return bundle["model"].predict_proba(X)[:, bundle["pos_idx"]]


# ============================================================
# SCORING & EXPLANATIONS
# ============================================================

def clean_number(value, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return default if math.isnan(number) else number


def score_candidates(parsed: list[dict], edits: pd.DataFrame, req: dict, cfg: dict, bundle: dict) -> pd.DataFrame:
    rows: list[dict] = []
    for i, item in enumerate(parsed):
        edit = edits.iloc[i]
        matched, missing = match_skills(item["text"], req["skills"])
        skills_pct = 100.0 * len(matched) / len(req["skills"]) if req["skills"] else None
        experience = clean_number(edit["Experience (yrs)"], 0.0)
        education = edit["Education"] if edit["Education"] in EDU_RANK else "Unknown"
        projects = int(clean_number(edit["Projects"], 0))
        github = clean_number(edit["GitHub activity"], float(cfg["github_default"]))
        must_missing = [s for s in req["must"] if s in missing]

        exp_pct = 100.0 if req["exp"] <= 0 else min(experience / req["exp"], 1.0) * 100
        edu_ok = EDU_RANK[education] >= req["edu_rank"] and not (req["edu_rank"] > 0 and education == "Unknown")
        components = []
        if skills_pct is not None:
            components.append((cfg["w_skill"], skills_pct))
        if req["exp"] > 0:
            components.append((cfg["w_exp"], exp_pct))
        if req["edu_rank"] > 0:
            components.append((cfg["w_edu"], 100.0 if edu_ok else 0.0))
        total_weight = sum(w for w, _ in components)
        if components:
            rule_score = (
                sum(w * s for w, s in components) / total_weight
                if total_weight > 0 else sum(s for _, s in components) / len(components)
            )
        else:
            rule_score = None

        typed_name = edit["Candidate"]
        name = str(typed_name).strip() if pd.notna(typed_name) and str(typed_name).strip() else item["name"]
        rows.append({
            "idx": i,
            "candidate": name,
            "file": item["filename"],
            "email": item.get("email", ""),
            "phone": item.get("phone", ""),
            "linkedin": item.get("linkedin", ""),
            "github_profile": item.get("github", ""),
            "skills_pct": skills_pct,
            "matched": matched,
            "missing": missing,
            "must_missing": must_missing,
            "experience": experience,
            "experience_source": item.get("experience_source", "none"),
            "education": education,
            "edu_ok": edu_ok,
            "projects": projects,
            "github_activity": github,
            "words": item.get("words", 0),
            "rule_score": rule_score,
            "hr_decision": edit["HR decision"] if edit["HR decision"] in HR_DECISIONS else "Auto",
            "text_hash": item["text_hash"],
            "exp_pct": exp_pct,
        })

    df = pd.DataFrame(rows)
    df["rule_score"] = pd.to_numeric(df["rule_score"], errors="coerce")
    df["skills_pct"] = pd.to_numeric(df["skills_pct"], errors="coerce")

    if bundle["model"] is not None:
        features = pd.DataFrame({
            "years_experience": df["experience"],
            "skills_match_score": df["skills_pct"].fillna(NEUTRAL_SKILL_SCORE),
            "education_level": df["education"],
            "project_count": df["projects"],
            "resume_length": df["words"],
            "github_activity": df["github_activity"],
        })
        df["model_prob"] = model_probabilities(bundle, features)
    else:
        df["model_prob"] = np.nan

    alpha = cfg["ml_weight"] / 100 if bundle["model"] is not None else 0.0

    def blend(row) -> float:
        rule, prob = row["rule_score"], row["model_prob"]
        if pd.isna(rule):
            return 100 * prob if not pd.isna(prob) else 0.0
        if pd.isna(prob) or alpha == 0:
            return rule
        return (1 - alpha) * rule + alpha * 100 * prob

    df["final_score"] = df.apply(blend, axis=1).round(1)

    def decide(row) -> tuple[str, str]:
        score, must_ok = row["final_score"], not row["must_missing"]
        if score >= cfg["cutoff"]:
            auto = STATUS_SHORTLISTED if (must_ok or not cfg["strict_must"]) else STATUS_REVIEW
        elif score >= cfg["cutoff"] - cfg["band"]:
            auto = STATUS_REVIEW
        else:
            auto = STATUS_REJECTED
        if row["hr_decision"] == "Shortlist":
            return STATUS_SHORTLISTED, auto
        if row["hr_decision"] == "Reject":
            return STATUS_REJECTED, auto
        return auto, auto

    decisions = df.apply(decide, axis=1, result_type="expand")
    df["status"], df["auto_status"] = decisions[0], decisions[1]

    first_seen: dict[str, str] = {}
    flags = []
    for _, row in df.iterrows():
        notes = []
        if row["text_hash"] in first_seen:
            notes.append(f"Duplicate of {first_seen[row['text_hash']]}")
        else:
            first_seen[row["text_hash"]] = row["candidate"]
        if row["experience_source"] == "none":
            notes.append("No experience dates found")
        elif row["experience_source"] == "stated":
            notes.append("Experience taken from a written claim, not dates")
        if row["education"] == "Unknown":
            notes.append("Education not detected")
        if row["hr_decision"] != "Auto":
            notes.append(f"HR override: {row['hr_decision']}")
        flags.append(notes)
    df["flags"] = flags

    df = df.sort_values(["final_score", "skills_pct"], ascending=[False, False], na_position="last").reset_index(drop=True)
    df.insert(0, "rank", range(1, len(df) + 1))
    return df


def explain(row: pd.Series | dict, req: dict) -> tuple[list[str], list[str]]:
    good, gaps = [], []
    if req["skills"]:
        n, total = len(row["matched"]), len(req["skills"])
        (good if n / total >= 0.7 else gaps).append(f"Matches {n} of {total} required skills")
    if row["must_missing"]:
        gaps.append("Missing must-have: " + ", ".join(pretty_skill(s) for s in row["must_missing"]))
    if req["exp"] > 0:
        if row["experience"] >= req["exp"]:
            good.append(f"{row['experience']:.1f} years of experience meets the {req['exp']:g}+ requirement")
        else:
            gaps.append(f"{row['experience']:.1f} years of experience against {req['exp']:g} required")
    if req["edu_rank"] > 0:
        if row["edu_ok"]:
            good.append(f"{row['education']} meets the {REQ_EDU_OPTIONS[req['edu_rank']]} requirement")
        else:
            gaps.append(
                "Education not detected" if row["education"] == "Unknown"
                else f"{row['education']} is below the required {REQ_EDU_OPTIONS[req['edu_rank']]}"
            )
    prob = row["model_prob"]
    if pd.notna(prob):
        if prob >= 0.7:
            good.append(f"Profile resembles previously shortlisted candidates (model {prob:.0%})")
        elif prob < 0.4:
            gaps.append(f"Profile differs from previously shortlisted candidates (model {prob:.0%})")
    return good, gaps


def results_to_export(df: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame({
        "Rank": df["rank"],
        "Candidate": df["candidate"],
        "Status": df["status"],
        "Final score": df["final_score"],
        "JD fit": df["rule_score"].round(1),
        "Model probability": df["model_prob"].round(3),
        "Skill match %": df["skills_pct"].round(1),
        "Matched skills": df["matched"].map(lambda s: "; ".join(pretty_skill(x) for x in s)),
        "Missing skills": df["missing"].map(lambda s: "; ".join(pretty_skill(x) for x in s)),
        "Missing must-haves": df["must_missing"].map(lambda s: "; ".join(pretty_skill(x) for x in s)),
        "Experience (yrs)": df["experience"],
        "Education": df["education"],
        "Projects": df["projects"],
        "Email": df["email"],
        "Phone": df["phone"],
        "LinkedIn": df["linkedin"],
        "GitHub": df["github_profile"],
        "File": df["file"],
        "HR decision": df["hr_decision"],
        "Notes": df["flags"].map(lambda f: "; ".join(f)),
    })
