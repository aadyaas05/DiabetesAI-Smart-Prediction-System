import os, json, csv, io
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file
from werkzeug.security import generate_password_hash, check_password_hash
import joblib, numpy as np, pandas as pd
from datetime import datetime
import tempfile

app = Flask(__name__)
app.secret_key = 'diabetes_app_secret_key_2024'

# ── Load model & meta ──
MODEL    = joblib.load('models/best_model.pkl')
SCALER   = joblib.load('models/scaler.pkl')
with open('models/meta.json') as f:
    META = json.load(f)

FEATURES = META['feature_names']

# ── In-memory storage ──
USERS    = {'admin': {'password': generate_password_hash('admin123'), 'role': 'admin'}}
HISTORY  = []

# ── Helpers ──
def predict_diabetes(data: dict):
    vals = [float(data.get(f, 0)) for f in FEATURES]
    arr  = pd.DataFrame([dict(zip(FEATURES, vals))]) 
    scaled = SCALER.transform(arr)
    pred   = int(MODEL.predict(scaled)[0])
    proba  = float(MODEL.predict_proba(scaled)[0][1])
    pct    = round(proba * 100, 1)

    if pct < 30:   risk, risk_class = 'Low Risk',    'low'
    elif pct < 60: risk, risk_class = 'Medium Risk',  'medium'
    else:          risk, risk_class = 'High Risk',    'high'

    # AI explanation
    flags = []
    if float(data.get('Glucose', 0)) > 140:   flags.append('high glucose level')
    if float(data.get('BMI', 0)) > 30:         flags.append('elevated BMI')
    if float(data.get('Age', 0)) > 45:         flags.append('age above 45')
    if float(data.get('Pregnancies', 0)) > 4:  flags.append('multiple pregnancies')
    if float(data.get('BloodPressure', 0)) > 90: flags.append('high blood pressure')
    if float(data.get('Insulin', 0)) > 200:    flags.append('high insulin level')

    if pred == 1:
        if flags:
            explanation = f"The model detected {risk.lower()} for diabetes. Key contributing factors include: {', '.join(flags)}."
        else:
            explanation = "The model detected elevated diabetes risk based on the overall pattern of your health metrics."
    else:
        explanation = "Your health metrics suggest low diabetes risk. Maintaining a healthy lifestyle will help keep it that way."

    recs = []
    if float(data.get('Glucose', 0)) > 140:
        recs.append("Monitor blood glucose regularly and reduce sugar intake.")
    if float(data.get('BMI', 0)) > 30:
        recs.append("Consider a structured weight loss program with diet and exercise.")
    if float(data.get('BloodPressure', 0)) > 90:
        recs.append("Consult a doctor about blood pressure management.")
    if not recs:
        recs = ["Maintain a balanced diet rich in vegetables and whole grains.",
                "Exercise at least 30 minutes daily.",
                "Schedule regular health checkups."]

    return {
        'prediction':  pred,
        'probability': pct,
        'risk':        risk,
        'risk_class':  risk_class,
        'confidence':  round(max(proba, 1-proba) * 100, 1),
        'model_used':  META['best_model'],
        'explanation': explanation,
        'recommendations': recs,
        'timestamp':   datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

# ── Auth routes ──
@app.route('/login', methods=['GET','POST'])
def login():
    if request.method == 'POST':
        d = request.get_json() or request.form
        user = d.get('username','')
        pw   = d.get('password','')
        if user in USERS and check_password_hash(USERS[user]['password'], pw):
            session['user'] = user
            session['role'] = USERS[user]['role']
            return jsonify({'success': True, 'role': USERS[user]['role']})
        return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
    return render_template('index.html')

@app.route('/signup', methods=['POST'])
def signup():
    d = request.get_json()
    user = d.get('username','').strip()
    pw   = d.get('password','')
    if not user or not pw:
        return jsonify({'success': False, 'error': 'Username and password required'}), 400
    if user in USERS:
        return jsonify({'success': False, 'error': 'Username already exists'}), 400
    USERS[user] = {'password': generate_password_hash(pw), 'role': 'user'}
    session['user'] = user
    session['role'] = 'user'
    return jsonify({'success': True})

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

# ── Main routes ──
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/meta')
def api_meta():
    return jsonify(META)

@app.route('/api/predict', methods=['POST'])
def api_predict():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    try:
        result = predict_diabetes(data)
        entry = {**data, **result, 'user': session.get('user', 'guest')}
        HISTORY.append(entry)
        if len(HISTORY) > 200:
            HISTORY.pop(0)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/history')
def api_history():
    user = session.get('user')
    if not user:
        return jsonify([])
    if session.get('role') == 'admin':
        return jsonify(HISTORY[-50:][::-1])
    return jsonify([h for h in HISTORY if h.get('user') == user][-20:][::-1])

@app.route('/api/bulk_predict', methods=['POST'])
def bulk_predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    f = request.files['file']
    try:
        df = pd.read_csv(f)
        results = []
        for _, row in df.iterrows():
            try:
                r = predict_diabetes(row.to_dict())
                results.append({**row.to_dict(), **r})
            except:
                pass
        return jsonify({'count': len(results), 'results': results[:100]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/stats')
def admin_stats():
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    total = len(HISTORY)
    diabetic = sum(1 for h in HISTORY if h.get('prediction') == 1)
    return jsonify({
        'total_predictions': total,
        'diabetic_count': diabetic,
        'non_diabetic_count': total - diabetic,
        'total_users': len(USERS),
        'model_accuracy': META['best_accuracy']
    })

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)
