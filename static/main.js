// ── State ──
let META = {}, CURRENT_RESULT = null, GAUGE_CHART = null, RADAR_CHART = null, FEAT_CHART = null;
let currentUser = null, currentRole = null;

// ── Init ──
window.addEventListener('load', async () => {
  const res = await fetch('/api/meta');
  META = await res.json();
  document.getElementById('hsBestModel').textContent = META.best_model || '—';
  document.getElementById('hsAccuracy').textContent  = (META.best_accuracy || 0) + '%';
  initAnalyticsCharts();
});

// ── Auth ──
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', (tab==='login')===!i || (tab==='signup')&&i===1));
  document.getElementById('loginForm').style.display  = tab === 'login'  ? 'block' : 'none';
  document.getElementById('signupForm').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('authError').textContent = '';
}

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  if (!username || !password) { showAuthError('Fill all fields'); return; }
  const res  = await fetch('/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username, password}) });
  const data = await res.json();
  if (data.success) {
    currentUser = username; currentRole = data.role;
    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('userBadge').textContent = username;
    if (data.role === 'admin') document.getElementById('adminNavBtn').style.display = 'block';
  } else {
    showAuthError(data.error || 'Login failed');
  }
}

async function doSignup() {
  const username = document.getElementById('signUser').value.trim();
  const password = document.getElementById('signPass').value;
  if (!username || !password) { showAuthError('Fill all fields'); return; }
  const res  = await fetch('/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username, password}) });
  const data = await res.json();
  if (data.success) {
    currentUser = username;
    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('userBadge').textContent = username;
  } else {
    showAuthError(data.error || 'Signup failed');
  }
}

function showAuthError(msg) { document.getElementById('authError').textContent = msg; }
function logout() { fetch('/logout'); location.reload(); }

// ── Navigation ──
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => { if (b.textContent.toLowerCase().includes(name)) b.classList.add('active'); });
  if (name === 'history') loadHistory();
  if (name === 'admin')   loadAdmin();
}

function toggleTheme() {
  const html  = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.querySelector('.theme-btn').textContent = isDark ? '🌞' : '🌙';
}

// ── Sample Data ──
function fillSample(diabetic) {
  if (diabetic) {
    setFields({Pregnancies:6,Glucose:168,BloodPressure:92,SkinThickness:29,Insulin:210,BMI:38.5,DiabetesPedigreeFunction:0.78,Age:52});
  } else {
    setFields({Pregnancies:1,Glucose:95,BloodPressure:68,SkinThickness:20,Insulin:80,BMI:22.4,DiabetesPedigreeFunction:0.2,Age:28});
  }
}

function setFields(data) {
  Object.entries(data).forEach(([k,v]) => { const el = document.getElementById(k); if(el) el.value = v; });
}

function clearForm() {
  ['Pregnancies','Glucose','BloodPressure','SkinThickness','Insulin','BMI','DiabetesPedigreeFunction','Age'].forEach(k => {
    const el = document.getElementById(k); if(el) el.value = '';
  });
}

function getFormData() {
  const fields = ['Pregnancies','Glucose','BloodPressure','SkinThickness','Insulin','BMI','DiabetesPedigreeFunction','Age'];
  const data = {};
  for (const f of fields) {
    const val = parseFloat(document.getElementById(f)?.value);
    if (isNaN(val)) return null;
    data[f] = val;
  }
  return data;
}

// ── Predict ──
async function predict() {
  const data = getFormData();
  if (!data) { showToast('Please fill all fields with valid numbers.', 'error'); return; }

  const btn = document.getElementById('predictBtn');
  btn.disabled = true;
  document.getElementById('predictBtnText').textContent = '⏳ Analyzing...';

  try {
    const res    = await fetch('/api/predict', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
    const result = await res.json();
    if (result.error) { showToast(result.error, 'error'); return; }
    CURRENT_RESULT = { ...data, ...result };
    renderResult(result, data);
  } catch(e) {
    showToast('Prediction failed. Is the server running?', 'error');
  } finally {
    btn.disabled = false;
    document.getElementById('predictBtnText').textContent = '🔬 Analyze & Predict';
  }
}

function renderResult(r, data) {
  const card = document.getElementById('resultCard');
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Verdict
  const isDiabetic = r.prediction === 1;
  const verdictEl  = document.getElementById('resultVerdict');
  verdictEl.className = 'result-verdict risk-' + r.risk_class;
  document.getElementById('verdictIcon').textContent = isDiabetic ? '⚠️' : '✅';
  document.getElementById('verdictText').textContent = isDiabetic ? 'Diabetic' : 'Non-Diabetic';
  document.getElementById('verdictSub').textContent  = r.risk;

  // Metrics
  document.getElementById('gaugePct').textContent     = r.probability + '%';
  document.getElementById('metConfidence').textContent = r.confidence + '%';
  document.getElementById('metModel').textContent      = r.model_used;
  document.getElementById('metAccuracy').textContent   = META.best_accuracy + '%';

  // Gauge
  drawGauge(r.probability);

  // Explanation
  document.getElementById('explanationBox').innerHTML = `
    <strong>AI Analysis:</strong> ${r.explanation}
    <br><br><strong>Timestamp:</strong> ${r.timestamp}
  `;

  // Radar chart
  drawRadar(data);

  // Feature importance chart
  drawFeatureBar();

  // Recommendations
  const rList = document.getElementById('recsList');
  rList.innerHTML = r.recommendations.map(rec =>
    `<div class="rec-item"><span class="rec-icon">💊</span><span>${rec}</span></div>`
  ).join('');

  // Summary table
  const labels = {
    Pregnancies:'Pregnancies', Glucose:'Glucose (mg/dL)', BloodPressure:'Blood Pressure (mm Hg)',
    SkinThickness:'Skin Thickness (mm)', Insulin:'Insulin (μU/mL)', BMI:'BMI (kg/m²)',
    DiabetesPedigreeFunction:'Diabetes Pedigree', Age:'Age (years)'
  };
  const normals = {
    Glucose:'70–140', BloodPressure:'60–90', BMI:'18.5–24.9', Age:'—',
    Pregnancies:'0–5', SkinThickness:'10–40', Insulin:'16–166', DiabetesPedigreeFunction:'0–1'
  };
  const table = document.getElementById('summaryTable');
  table.innerHTML = `<thead><tr><th>Metric</th><th>Value</th><th>Normal Range</th><th>Status</th></tr></thead>
  <tbody>` + Object.entries(labels).map(([k,lbl]) => {
    const val = data[k];
    const flag = flagStatus(k, val);
    return `<tr><td>${lbl}</td><td><strong>${val}</strong></td><td>${normals[k]||'—'}</td><td>${flag}</td></tr>`;
  }).join('') + `</tbody>`;
}

function flagStatus(key, val) {
  const checks = {
    Glucose:   v => v > 140 ? 'high' : v < 70 ? 'low' : 'normal',
    BMI:       v => v > 30 ? 'high' : v < 18.5 ? 'low' : 'normal',
    BloodPressure: v => v > 90 ? 'high' : v < 60 ? 'low' : 'normal',
    Insulin:   v => v > 166 ? 'high' : 'normal',
  };
  const fn = checks[key];
  if (!fn) return '<span class="badge badge-healthy">—</span>';
  const s = fn(val);
  if (s === 'high')   return '<span class="badge badge-diabetic">High ⚠</span>';
  if (s === 'low')    return '<span class="badge badge-medium">Low ↓</span>';
  return '<span class="badge badge-healthy">Normal ✓</span>';
}

// ── Charts ──
function drawGauge(pct) {
  if (GAUGE_CHART) { GAUGE_CHART.destroy(); }
  const color = pct < 30 ? '#22c55e' : pct < 60 ? '#f59e0b' : '#ef4444';
  const ctx   = document.getElementById('gaugeChart').getContext('2d');
  GAUGE_CHART = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [pct, 100 - pct],
        backgroundColor: [color, getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#252a45'],
        borderWidth: 0, cutout: '75%'
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false }, tooltip: { enabled: false } }, rotation: -90, circumference: 180 }
  });
}

function drawRadar(data) {
  if (RADAR_CHART) { RADAR_CHART.destroy(); }
  const normalizers = { Pregnancies:17, Glucose:200, BloodPressure:120, SkinThickness:99, Insulin:846, BMI:67, DiabetesPedigreeFunction:2.5, Age:81 };
  const labels = Object.keys(normalizers);
  const vals   = labels.map(k => Math.round((data[k] / normalizers[k]) * 100));
  const ctx    = document.getElementById('radarChart').getContext('2d');
  RADAR_CHART  = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Pregnancies','Glucose','BP','Skin','Insulin','BMI','Pedigree','Age'],
      datasets: [{ label: 'Patient', data: vals, backgroundColor: 'rgba(108,99,255,.25)', borderColor: '#6c63ff', borderWidth: 2, pointBackgroundColor: '#6c63ff' }]
    },
    options: { responsive: true, scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: 'rgba(255,255,255,.1)' }, pointLabels: { color: '#9ea3c0', font: { size: 11 } } } }, plugins: { legend: { display: false } } }
  });
}

function drawFeatureBar() {
  if (FEAT_CHART) { FEAT_CHART.destroy(); }
  if (!META.feature_importance) return;
  const sorted = Object.entries(META.feature_importance).sort((a,b) => b[1]-a[1]);
  const ctx    = document.getElementById('featureChart').getContext('2d');
  FEAT_CHART   = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(([k]) => k),
      datasets: [{ label: 'Importance %', data: sorted.map(([,v]) => v), backgroundColor: sorted.map((_,i) => `hsl(${240+i*15},70%,65%)`), borderRadius: 6 }]
    },
    options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#9ea3c0' } }, y: { grid: { display: false }, ticks: { color: '#9ea3c0', font: { size: 11 } } } } }
  });
}

// ── Analytics Charts ──
function initAnalyticsCharts() {
  if (!META.all_accuracies) return;

  // Model accuracy comparison
  const accCtx = document.getElementById('modelAccChart')?.getContext('2d');
  if (accCtx) new Chart(accCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(META.all_accuracies),
      datasets: [{ label: 'Accuracy %', data: Object.values(META.all_accuracies), backgroundColor: ['#6c63ff','#22c55e','#f59e0b','#ef4444'], borderRadius: 8 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 50, max: 100, grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#9ea3c0' } }, x: { grid: { display: false }, ticks: { color: '#9ea3c0' } } } }
  });

  // Feature importance
  if (META.feature_importance) {
    const sorted = Object.entries(META.feature_importance).sort((a,b)=>b[1]-a[1]);
    const fiCtx  = document.getElementById('featImpChart')?.getContext('2d');
    if (fiCtx) new Chart(fiCtx, {
      type: 'bar',
      data: {
        labels: sorted.map(([k])=>k),
        datasets: [{ label: 'Importance %', data: sorted.map(([,v])=>v), backgroundColor: sorted.map((_,i)=>`hsl(${240+i*15},65%,60%)`), borderRadius: 6 }]
      },
      options: { indexAxis:'y', responsive:true, plugins:{legend:{display:false}}, scales:{x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#9ea3c0'}},y:{grid:{display:false},ticks:{color:'#9ea3c0',font:{size:11}}}} }
    });
  }

  // Risk distribution (demo)
  const rdCtx = document.getElementById('riskDistChart')?.getContext('2d');
  if (rdCtx) new Chart(rdCtx, {
    type: 'doughnut',
    data: { labels:['Low Risk','Medium Risk','High Risk'], datasets:[{ data:[55,30,15], backgroundColor:['#22c55e','#f59e0b','#ef4444'], borderWidth:0 }] },
    options: { responsive:true, plugins:{ legend:{ labels:{ color:'#9ea3c0' } } } }
  });

  // Trend (demo)
  const tCtx = document.getElementById('trendChart')?.getContext('2d');
  if (tCtx) new Chart(tCtx, {
    type: 'line',
    data: { labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], datasets:[{ label:'Predictions', data:[4,7,5,9,12,8,6], borderColor:'#6c63ff', backgroundColor:'rgba(108,99,255,.1)', tension:.4, fill:true }] },
    options: { responsive:true, plugins:{legend:{display:false}}, scales:{ x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#9ea3c0'}}, y:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#9ea3c0'}} } }
  });
}

// ── History ──
async function loadHistory() {
  const res  = await fetch('/api/history');
  const data = await res.json();
  const tbody = document.getElementById('historyBody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3)">No predictions yet</td></tr>'; return; }
  tbody.innerHTML = data.map(h => `
    <tr>
      <td>${h.timestamp||'—'}</td>
      <td>${h.Glucose||'—'}</td>
      <td>${h.BMI||'—'}</td>
      <td>${h.Age||'—'}</td>
      <td><span class="badge ${h.prediction===1?'badge-diabetic':'badge-healthy'}">${h.prediction===1?'Diabetic':'Healthy'}</span></td>
      <td><span class="badge badge-${h.risk_class}">${h.risk}</span></td>
      <td>${h.probability}%</td>
    </tr>`).join('');
}

// ── Admin ──
async function loadAdmin() {
  const sRes  = await fetch('/api/admin/stats');
  const stats = await sRes.json();
  if (stats.error) return;
  document.getElementById('adminStats').innerHTML = `
    <div class="admin-stat"><div class="admin-stat-val">${stats.total_predictions}</div><div class="admin-stat-lbl">Total Predictions</div></div>
    <div class="admin-stat"><div class="admin-stat-val" style="color:var(--red)">${stats.diabetic_count}</div><div class="admin-stat-lbl">Diabetic Cases</div></div>
    <div class="admin-stat"><div class="admin-stat-val" style="color:var(--green)">${stats.non_diabetic_count}</div><div class="admin-stat-lbl">Non-Diabetic</div></div>
    <div class="admin-stat"><div class="admin-stat-val">${stats.total_users}</div><div class="admin-stat-lbl">Total Users</div></div>
    <div class="admin-stat"><div class="admin-stat-val" style="color:var(--accent2)">${stats.model_accuracy}%</div><div class="admin-stat-lbl">Model Accuracy</div></div>
  `;

  const hRes  = await fetch('/api/history');
  const hist  = await hRes.json();
  document.getElementById('adminBody').innerHTML = hist.map(h => `
    <tr>
      <td>${h.timestamp||'—'}</td>
      <td><strong>${h.user||'guest'}</strong></td>
      <td>${h.Glucose||'—'}</td>
      <td>${h.BMI||'—'}</td>
      <td>${h.Age||'—'}</td>
      <td><span class="badge ${h.prediction===1?'badge-diabetic':'badge-healthy'}">${h.prediction===1?'Diabetic':'Healthy'}</span></td>
      <td>${h.probability}%</td>
    </tr>`).join('');
}

// ── Bulk CSV ──
async function handleCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  showToast('Processing CSV...', 'info');
  try {
    const res  = await fetch('/api/bulk_predict', { method:'POST', body: fd });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    renderBulkResults(data);
  } catch(e) {
    showToast('CSV processing failed.', 'error');
  }
}

function renderBulkResults(data) {
  const diabetic = data.results.filter(r => r.prediction === 1).length;
  document.getElementById('bulkStats').innerHTML = `
    <div class="bulk-stat">📊 Total: <strong>${data.count}</strong></div>
    <div class="bulk-stat" style="color:var(--red)">⚠ Diabetic: <strong>${diabetic}</strong></div>
    <div class="bulk-stat" style="color:var(--green)">✓ Healthy: <strong>${data.count-diabetic}</strong></div>
  `;
  const table = document.getElementById('bulkTable');
  table.innerHTML = `<thead><tr><th>Glucose</th><th>BMI</th><th>Age</th><th>Result</th><th>Risk</th><th>Probability</th></tr></thead>
    <tbody>${data.results.map(r => `<tr>
      <td>${r.Glucose||'—'}</td><td>${r.BMI||'—'}</td><td>${r.Age||'—'}</td>
      <td><span class="badge ${r.prediction===1?'badge-diabetic':'badge-healthy'}">${r.prediction===1?'Diabetic':'Healthy'}</span></td>
      <td><span class="badge badge-${r.risk_class}">${r.risk}</span></td>
      <td>${r.probability}%</td>
    </tr>`).join('')}</tbody>`;
  document.getElementById('bulkResult').style.display = 'block';
}

// ── PDF Report ──
function downloadReport() {
  if (!CURRENT_RESULT) return;
  const r = CURRENT_RESULT;
  const content = `
DIABETES PREDICTION REPORT
===========================
Generated: ${r.timestamp}

PREDICTION RESULT
-----------------
Outcome:     ${r.prediction === 1 ? 'DIABETIC' : 'NON-DIABETIC'}
Risk Level:  ${r.risk}
Probability: ${r.probability}%
Confidence:  ${r.confidence}%
Model Used:  ${r.model_used} (Accuracy: ${META.best_accuracy}%)

PATIENT METRICS
---------------
Pregnancies:           ${r.Pregnancies}
Glucose:               ${r.Glucose} mg/dL
Blood Pressure:        ${r.BloodPressure} mm Hg
Skin Thickness:        ${r.SkinThickness} mm
Insulin:               ${r.Insulin} μU/mL
BMI:                   ${r.BMI}
Diabetes Pedigree:     ${r.DiabetesPedigreeFunction}
Age:                   ${r.Age} years

AI ANALYSIS
-----------
${r.explanation}

RECOMMENDATIONS
---------------
${r.recommendations.map((rec,i) => `${i+1}. ${rec}`).join('\n')}

---
DiabetesAI Prediction System | For informational purposes only.
Please consult a qualified healthcare professional for medical advice.
  `;
  const blob = new Blob([content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `diabetes_report_${Date.now()}.txt`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Toast ──
function showToast(msg, type='info') {
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:600;max-width:320px;box-shadow:0 8px 30px rgba(0,0,0,.4);transition:opacity .3s,transform .3s;color:#fff';
    document.body.appendChild(t);
  }
  const colors = { error:'#ef4444', success:'#22c55e', info:'#6c63ff' };
  t.style.background = colors[type] || colors.info;
  t.textContent = msg;
  t.style.opacity = '1'; t.style.transform = 'translateY(0)';
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, 3500);
}
