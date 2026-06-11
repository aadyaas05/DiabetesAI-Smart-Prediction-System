import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score
from xgboost import XGBClassifier
import joblib, os, json

def train_and_save():
    print("Loading dataset...")
    df = pd.read_csv('data/diabetes.csv')
    cols_with_zeros = ['Glucose','BloodPressure','SkinThickness','Insulin','BMI']
    df[cols_with_zeros] = df[cols_with_zeros].replace(0, np.nan)
    df.fillna(df.median(numeric_only=True), inplace=True)

    X = df.drop('Outcome', axis=1)
    y = df['Outcome']
    feature_names = X.columns.tolist()

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    models = {
        'Logistic Regression': LogisticRegression(random_state=42, max_iter=1000),
        'Random Forest':       RandomForestClassifier(n_estimators=100, random_state=42),
        'Decision Tree':       DecisionTreeClassifier(random_state=42, max_depth=6),
        'XGBoost':             XGBClassifier(random_state=42, eval_metric='logloss', verbosity=0)
    }

    results = {}
    best_acc, best_name, best_model = 0, '', None
    trained = {}

    for name, model in models.items():
        model.fit(X_train_s, y_train)
        acc = accuracy_score(y_test, model.predict(X_test_s))
        results[name] = round(acc*100, 2)
        trained[name] = model
        print(f"  {name}: {acc*100:.2f}%")
        if acc > best_acc:
            best_acc, best_name, best_model = acc, name, model

    print(f"\nBest: {best_name} ({best_acc*100:.2f}%)")

    rf = trained['Random Forest']
    feat_imp = dict(zip(feature_names, [round(float(i)*100,2) for i in rf.feature_importances_]))

    os.makedirs('models', exist_ok=True)
    joblib.dump(best_model, 'models/best_model.pkl')
    joblib.dump(scaler,     'models/scaler.pkl')

    meta = {
        'best_model': best_name,
        'best_accuracy': round(best_acc*100,2),
        'all_accuracies': results,
        'feature_names': feature_names,
        'feature_importance': feat_imp
    }
    with open('models/meta.json','w') as f:
        json.dump(meta, f)

    print("Saved to models/")
    return meta

if __name__ == '__main__':
    train_and_save()
