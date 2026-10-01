"""Train and persist the resume screening pipeline.

Run from the project directory with:
    .\\venv\\Scripts\\python.exe train_model.py
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


PROJECT_DIR = Path(__file__).resolve().parent
DATA_PATH = PROJECT_DIR / "ai_resume_screening.csv"
MODEL_PATH = PROJECT_DIR / "resume_screening_model.pkl"
METADATA_PATH = PROJECT_DIR / "resume_screening_model_metadata.json"

FEATURE_COLUMNS = [
    "years_experience",
    "skills_match_score",
    "education_level",
    "project_count",
    "resume_length",
    "github_activity",
]
CATEGORICAL_FEATURES = ["education_level"]
NUMERIC_FEATURES = [column for column in FEATURE_COLUMNS if column not in CATEGORICAL_FEATURES]
TARGET_COLUMN = "shortlisted"


def load_training_data(path: Path = DATA_PATH) -> tuple[pd.DataFrame, pd.Series]:
    """Load data and normalize the target exactly once; education stays categorical."""
    df = pd.read_csv(path)
    df.columns = df.columns.str.strip()

    required = set(FEATURE_COLUMNS + [TARGET_COLUMN])
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(f"Training CSV is missing columns: {sorted(missing)}")

    df = df[FEATURE_COLUMNS + [TARGET_COLUMN]].copy()
    df["education_level"] = df["education_level"].astype("string").str.strip().str.title()
    df[TARGET_COLUMN] = (
        df[TARGET_COLUMN].astype("string").str.strip().str.casefold().map({"yes": 1, "no": 0})
    )
    df = df.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN]).copy()
    df[NUMERIC_FEATURES] = df[NUMERIC_FEATURES].apply(pd.to_numeric, errors="coerce")
    df = df.dropna(subset=NUMERIC_FEATURES)

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN].astype("int8")
    if y.nunique() != 2:
        raise ValueError("The shortlisted target must contain both Yes and No examples.")
    return X, y


def build_model() -> Pipeline:
    """Create one pipeline that accepts raw category text and numeric features."""
    preprocess = ColumnTransformer(
        transformers=[
            ("education", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
            ("numeric", StandardScaler(), NUMERIC_FEATURES),
        ],
        remainder="drop",
    )
    return Pipeline(
        steps=[
            ("preprocessor", preprocess),
            ("classifier", GradientBoostingClassifier(n_estimators=100, random_state=42)),
        ]
    )


def candidate_frame(candidate: dict | pd.DataFrame) -> pd.DataFrame:
    """Validate/reorder live features to match the model training schema."""
    frame = candidate.copy() if isinstance(candidate, pd.DataFrame) else pd.DataFrame([candidate])
    missing = set(FEATURE_COLUMNS).difference(frame.columns)
    extra = set(frame.columns).difference(FEATURE_COLUMNS)
    if missing or extra:
        raise ValueError(f"Feature mismatch; missing={sorted(missing)}, extra={sorted(extra)}")
    frame = frame[FEATURE_COLUMNS].copy()
    frame["education_level"] = frame["education_level"].astype("string").str.strip().str.title()
    frame[NUMERIC_FEATURES] = frame[NUMERIC_FEATURES].apply(pd.to_numeric, errors="raise")
    return frame


def predict_resume(model: Pipeline, candidate: dict | pd.DataFrame) -> tuple[str, float]:
    """Predict using the same six raw input features used to train the model."""
    frame = candidate_frame(candidate)
    prediction = int(model.predict(frame)[0])
    probability = float(model.predict_proba(frame)[0, 1])
    return ("Shortlisted" if prediction == 1 else "Not Shortlisted", probability)


def train_and_save() -> dict[str, float]:
    X, y = load_training_data()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = build_model()
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    metrics = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "precision": float(precision_score(y_test, predictions, zero_division=0)),
        "recall": float(recall_score(y_test, predictions, zero_division=0)),
        "f1": float(f1_score(y_test, predictions, zero_division=0)),
    }

    # Rebuild the shipped artifact using the installed sklearn version.
    final_model = build_model().fit(X, y)
    joblib.dump(final_model, MODEL_PATH)
    METADATA_PATH.write_text(
        json.dumps(
            {
                "scikit_learn_version": sklearn.__version__,
                "feature_columns": FEATURE_COLUMNS,
                "target_column": TARGET_COLUMN,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return metrics


if __name__ == "__main__":
    scores = train_and_save()
    print(f"scikit-learn: {sklearn.__version__}")
    print(f"Features: {', '.join(FEATURE_COLUMNS)}")
    print(f"Evaluation: {json.dumps(scores, sort_keys=True)}")
    print(f"Saved model: {MODEL_PATH}")
