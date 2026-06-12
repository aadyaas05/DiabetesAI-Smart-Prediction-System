# 🩺 DiabetesAI — Smart Prediction System

🔗 **[Live Demo](https://diabetesai-smart-prediction-system.onrender.com)**

A production-ready AI-powered Diabetes Prediction Web Application built with Python, Flask, and Machine Learning.

## 🚀 Features

- **4 ML Models:** Logistic Regression, Random Forest, Decision Tree, XGBoost
- **Auto Model Selection:** Best model selected automatically
- **Risk Assessment:** Low / Medium / High risk with probability score
- **AI Explanations:** Plain language explanation of results
- **Health Recommendations:** Personalized suggestions
- **Bulk CSV Prediction:** Upload CSV for multiple predictions
- **Prediction History:** Track past predictions
- **Admin Dashboard:** Stats and user management
- **Dark/Light Mode:** Toggle between themes
- **PDF Report Download:** Export prediction report
- **User Authentication:** Login/Signup system

## 📂 Project Structure

```
diabetes_app/
├── app.py                  # Flask backend
├── train_model.py          # ML model training
├── requirements.txt
├── README.md
├── data/
│   └── diabetes.csv        # Dataset
├── models/
│   ├── best_model.pkl      # Trained model
│   ├── scaler.pkl          # Feature scaler
│   └── meta.json           # Model metadata
├── templates/
│   └── index.html          # Frontend
└── static/
    ├── css/style.css
    └── js/main.js
```

## ⚙️ Installation

```bash
# 1. Clone the repo
git clone https://github.com/yourname/diabetes-ai.git
cd diabetes-ai

# 2. Install dependencies
pip install -r requirements.txt

# 3. Train the model
python train_model.py

# 4. Run the app
python app.py
```

Open: **http://localhost:5000**

**Default login:** `admin` / `admin123`

## 🧠 ML Pipeline

1. Load Pima Indians Diabetes Dataset
2. Replace physiologically impossible zeros with NaN
3. Fill missing values with median
4. Train/test split (80/20)
5. StandardScaler normalization
6. Train 4 models, compare accuracy
7. Auto-select best model

## 🚀 Deploy to Render

```
Build Command: pip install -r requirements.txt && python train_model.py
Start Command: gunicorn app:app
```

## ⚠️ Disclaimer

For educational purposes only. Not a substitute for professional medical advice.
=======
# DiabetesAI-Smart-Prediction-System

