from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.datasets import make_classification
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

try:
    from xgboost import XGBClassifier
except Exception:  # pragma: no cover
    XGBClassifier = None


FEATURE_COLUMNS = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
]
TARGET_COLUMN = "Outcome"
ARTIFACT_DIR = Path("model_artifacts")


def _load_dataset() -> pd.DataFrame:
    csv_path = Path("data/diabetes.csv")
    if csv_path.exists():
        data = pd.read_csv(csv_path)
        missing = [col for col in FEATURE_COLUMNS + [TARGET_COLUMN] if col not in data.columns]
        if missing:
            raise ValueError(f"Missing required columns in {csv_path}: {missing}")
        return data[FEATURE_COLUMNS + [TARGET_COLUMN]]

    features, target = make_classification(
        n_samples=768,
        n_features=len(FEATURE_COLUMNS),
        n_informative=6,
        n_redundant=1,
        n_classes=2,
        class_sep=0.85,
        random_state=42,
    )
    df = pd.DataFrame(features, columns=FEATURE_COLUMNS)
    df["Pregnancies"] = np.clip((df["Pregnancies"] * 2 + 4).round(), 0, 17)
    df["Glucose"] = np.clip((df["Glucose"] * 25 + 120).round(), 50, 220)
    df["BloodPressure"] = np.clip((df["BloodPressure"] * 15 + 70).round(), 35, 130)
    df["SkinThickness"] = np.clip((df["SkinThickness"] * 8 + 20).round(), 7, 70)
    df["Insulin"] = np.clip((df["Insulin"] * 40 + 90).round(), 10, 400)
    df["BMI"] = np.clip(df["BMI"] * 5 + 30, 15.0, 60.0).round(1)
    df["DiabetesPedigreeFunction"] = np.clip(np.abs(df["DiabetesPedigreeFunction"]) / 2, 0.05, 2.5).round(3)
    df["Age"] = np.clip((df["Age"] * 9 + 35).round(), 18, 90)
    df[TARGET_COLUMN] = target
    return df


def train_and_save() -> dict[str, float | str]:
    data = _load_dataset()
    x = data[FEATURE_COLUMNS]
    y = data[TARGET_COLUMN]

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    x_train_scaled = scaler.fit_transform(x_train)
    x_test_scaled = scaler.transform(x_test)

    models = {
        "Logistic Regression": LogisticRegression(max_iter=2000, random_state=42),
        "Decision Tree": DecisionTreeClassifier(max_depth=6, random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=400, random_state=42),
    }
    if XGBClassifier is not None:
        models["XGBoost"] = XGBClassifier(
            n_estimators=25,
            max_depth=2,
            learning_rate=0.2,
            subsample=0.8,
            colsample_bytree=0.8,
            eval_metric="logloss",
            random_state=42,
        )

    scores: dict[str, float] = {}
    trained_models = {}
    for name, model in models.items():
        model.fit(x_train_scaled, y_train)
        preds = model.predict(x_test_scaled)
        score = accuracy_score(y_test, preds)
        scores[name] = score
        trained_models[name] = model

    best_name = max(scores, key=scores.get)
    best_model = trained_models[best_name]
    best_accuracy = scores[best_name]

    ARTIFACT_DIR.mkdir(exist_ok=True)
    joblib.dump(best_model, ARTIFACT_DIR / "best_model.joblib")
    joblib.dump(scaler, ARTIFACT_DIR / "scaler.joblib")

    metadata = {
        "feature_columns": FEATURE_COLUMNS,
        "best_model_name": best_name,
        "best_model_accuracy": round(best_accuracy * 100, 2),
        "all_model_scores": {k: round(v * 100, 2) for k, v in scores.items()},
    }
    (ARTIFACT_DIR / "model_metadata.json").write_text(json.dumps(metadata, indent=2))
    return metadata


if __name__ == "__main__":
    report = train_and_save()
    print("Training complete")
    print(f"Best model: {report['best_model_name']}")
    print(f"Accuracy: {report['best_model_accuracy']}%")
