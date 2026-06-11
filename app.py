from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, jsonify, render_template, request


ARTIFACT_DIR = Path("model_artifacts")
MODEL_PATH = ARTIFACT_DIR / "best_model.joblib"
SCALER_PATH = ARTIFACT_DIR / "scaler.joblib"
METADATA_PATH = ARTIFACT_DIR / "model_metadata.json"


def _load_artifacts():
    if not MODEL_PATH.exists() or not SCALER_PATH.exists() or not METADATA_PATH.exists():
        raise FileNotFoundError(
            "Model artifacts not found. Run `python train_model.py` before starting the app."
        )
    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    metadata = json.loads(METADATA_PATH.read_text())
    return model, scaler, metadata


app = Flask(__name__)
model, scaler, metadata = _load_artifacts()
FEATURE_COLUMNS = metadata["feature_columns"]


def _parse_input(payload: dict[str, str | float]) -> pd.DataFrame:
    values = []
    for feature in FEATURE_COLUMNS:
        if feature not in payload:
            raise ValueError(f"Missing field: {feature}")
        values.append(float(payload[feature]))
    return pd.DataFrame([values], columns=FEATURE_COLUMNS, dtype=float)


@app.get("/")
def index():
    return render_template(
        "index.html",
        feature_columns=FEATURE_COLUMNS,
        best_model_name=metadata.get("best_model_name", "Unknown"),
        best_model_accuracy=metadata.get("best_model_accuracy", "N/A"),
        prediction=None,
    )


@app.post("/predict")
def predict():
    try:
        raw = request.form.to_dict()
        input_data = _parse_input(raw)
        scaled = scaler.transform(input_data)
        predicted_class = int(model.predict(scaled)[0])
        probability = float(model.predict_proba(scaled)[0][1]) if hasattr(model, "predict_proba") else None
        result = {
            "predicted_class": predicted_class,
            "risk_label": "High Risk" if predicted_class == 1 else "Low Risk",
            "probability": round(probability * 100, 2) if probability is not None else None,
        }
        return render_template(
            "index.html",
            feature_columns=FEATURE_COLUMNS,
            best_model_name=metadata.get("best_model_name", "Unknown"),
            best_model_accuracy=metadata.get("best_model_accuracy", "N/A"),
            prediction=result,
        )
    except Exception as exc:
        return render_template(
            "index.html",
            feature_columns=FEATURE_COLUMNS,
            best_model_name=metadata.get("best_model_name", "Unknown"),
            best_model_accuracy=metadata.get("best_model_accuracy", "N/A"),
            prediction={"error": str(exc)},
        ), 400


@app.post("/api/predict")
def api_predict():
    try:
        payload = request.get_json(silent=True) or {}
        input_data = _parse_input(payload)
        scaled = scaler.transform(input_data)
        predicted_class = int(model.predict(scaled)[0])
        probability = float(model.predict_proba(scaled)[0][1]) if hasattr(model, "predict_proba") else None
        return jsonify(
            {
                "predicted_class": predicted_class,
                "risk_label": "High Risk" if predicted_class == 1 else "Low Risk",
                "probability": round(probability * 100, 2) if probability is not None else None,
                "best_model": metadata.get("best_model_name"),
            }
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


if __name__ == "__main__":
    app.run(debug=True)
