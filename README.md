# DiabetesAI-Smart-Prediction-System

AI-powered diabetes risk prediction web app using multiple machine learning models and automatic best-model selection.

## Features

- Real-time diabetes risk prediction
- Multiple model comparison (Logistic Regression, Decision Tree, Random Forest, XGBoost)
- Automated best-model selection by validation accuracy
- Feature scaling and preprocessing with `StandardScaler`
- Model persistence with Joblib
- Flask web interface for user input and instant prediction

## Tech Stack

- Python
- Flask
- Scikit-learn
- Pandas
- NumPy
- XGBoost
- HTML/CSS/JavaScript

## Best Model

- Random Forest Classifier
- Accuracy: 77.92%

## Project Structure

```text
.
├── app.py
├── train_model.py
├── requirements.txt
├── model_artifacts/
│   ├── best_model.joblib
│   ├── scaler.joblib
│   └── model_metadata.json
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── app.js
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Train Models

```bash
python train_model.py
```

This trains all configured models, evaluates them, picks the best-performing model automatically, and stores artifacts in `model_artifacts/`.

## Run Web App

```bash
python app.py
```

Open `http://127.0.0.1:5000`.