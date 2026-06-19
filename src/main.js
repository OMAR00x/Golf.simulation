// ============================================================
// main.js — نقطة الدخول الرئيسية للمحاكاة
// ============================================================
import * as THREE from 'three';
import { GraphicsSystem } from './graphics.js';
import { PhysicsEngine, GROUND_TYPES, calcAirDensity } from './physics.js';

// ── واجهة المستخدم ──────────────────────────────────────────
const ui = {
  v0:          document.getElementById('v0'),
  theta:       document.getElementById('theta'),
  phi:         document.getElementById('phi'),
  backspin:    document.getElementById('backspin'),
  sidespin:    document.getElementById('sidespin'),
  temperature: document.getElementById('temperature'),
  altitude:    document.getElementById('altitude'),
  windX:       document.getElementById('windX'),
  groundType:  document.getElementById('groundType'),
  launchBtn:   document.getElementById('launch-btn'),
  resetBtn:    document.getElementById('reset-btn'),
  camFree:     document.getElementById('cam-free'),
  camFollow:   document.getElementById('cam-follow'),
  camLanding:  document.getElementById('cam-landing'),
  // HUD
  dashAlt:     document.getElementById('dash-alt'),
  dashVel:     document.getElementById('dash-vel'),
  dashDist:    document.getElementById('dash-dist'),
  dashSpin:    document.getElementById('dash-spin'),
  dashStatus:  document.getElementById('dash-status'),
  // نتائج
  statsPanel:  document.getElementById('stats-panel'),
  statDist:    document.getElementById('stat-dist'),
  statMaxH:    document.getElementById('stat-maxh'),
  statApex:    document.getElementById('stat-apex'),
  statTime:    document.getElementById('stat-time'),
  statHole:    document.getElementById('stat-hole'),
  // نوع الأرض
  groundLabel: document.getElementById('ground-label'),
  groundDesc:  document.getElementById('ground-desc'),
};

// ── وصف أنواع الأرض ─────────────────────────────────────────
const GROUND_INFO = {
  green:   { label: '🟢 أخضر — Green',   color: '#4ecb71', desc: 'عشب الحفرة مقصوص جداً. الكرة تتدحرج بعيداً وبناعم.' },
  fairway: { label: '🌿 ممر — Fairway',  color: '#6fcf8a', desc: 'المسار الرئيسي للضربة. ارتداد ودحرجة طبيعية.' },
  rough:   { label: '🌾 خشن — Rough',    color: '#b5cc55', desc: 'عشب طويل. يمتص الكرة ويقلل الـ Backspin (The Flier).' },
  hardpan: { label: '🪨 صلب — Hardpan',  color: '#d4aa60', desc: 'أرض جافة. الكرة ترتد عالياً وتمشي مسافة طويلة.' },
};

// ── Chart.js ────────────────────────────────────────────────
let chartInstance = null;
let chartLabels   = [];
let chartAltData  = [];
let chartVelData  = [];

function initChart() {
  const ctx = document.getElementById('physicsChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  chartLabels  = [0];
  chartAltData = [0];
  chartVelData = [0];
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [
        { label: 'الارتفاع (م)',      data: chartAltData, borderColor: '#ffaa00', backgroundColor: 'rgba(255,170,0,0.08)',
          yAxisID: 'y-alt', borderWidth: 2, pointRadius: 0, fill: true },
        { label: 'السرعة (م/ث)',      data: chartVelData, borderColor: '#00ffcc', backgroundColor: 'rgba(0,255,200,0.06)',
          yAxisID: 'y-vel', borderWidth: 2, pointRadius: 0, fill: true },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      scales: {
        x:       { title: { display: true, text: 'الزمن (ث)', font: { size: 10 } }, ticks: { maxTicksLimit: 8 } },
        'y-alt': { type: 'linear', position: 'right',  title: { display: true, text: 'الارتفاع', color: '#ffaa00', font: { size: 10 } }, grid: { color: 'rgba(255,170,0,0.08)' } },
        'y-vel': { type: 'linear', position: 'left',   title: { display: true, text: 'السرعة',   color: '#00ffcc', font: { size: 10 } }, grid: { color: 'rgba(0,255,200,0.06)' } },
      },
      plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } },
    },
  });
}

// ── الحالة العامة ────────────────────────────────────────────
const gfx     = new GraphicsSystem();
let   engine  = null;
let   running = false;
let   frameCount = 0;

// ── تحديث HUD ───────────────────────────────────────────────
function updateHUD(state) {
  const speed = Math.hypot(state.vel.x, state.vel.y, state.vel.z);
  const spin  = Math.hypot(state.omega.x, state.omega.y, state.omega.z);
  ui.dashAlt.textContent  = state.pos.z.toFixed(2);
  ui.dashVel.textContent  = speed.toFixed(2);
  ui.dashDist.textContent = Math.hypot(state.pos.x, state.pos.y).toFixed(2);
  ui.dashSpin.textContent = (spin / (2 * Math.PI) * 60).toFixed(0);  // rpm
  return speed;
}

// ── تحديث نوع الأرض في الواجهة ──────────────────────────────
function updateGroundUI(type) {
  const info = GROUND_INFO[type] ?? GROUND_INFO.fairway;
  ui.groundLabel.textContent = info.label;
  ui.groundLabel.style.color = info.color;
  ui.groundDesc.textContent  = info.desc;
}

// ── إطلاق المحاكاة ───────────────────────────────────────────
ui.launchBtn.addEventListener('click', () => {
  if (running) return;

  const params = {
    v0:          parseFloat(ui.v0.value),
    thetaDeg:    parseFloat(ui.theta.value),
    phiDeg:      parseFloat(ui.phi.value),
    backspinRPM: parseFloat(ui.backspin.value),
    sidespinRPM: parseFloat(ui.sidespin.value),
    temperature: parseFloat(ui.temperature.value),
    altitude:    parseFloat(ui.altitude.value),
    windX:       parseFloat(ui.windX.value),
    windY:       0,
    groundType:  ui.groundType.value,
  };

  engine = new PhysicsEngine(params);
  running = true;
  frameCount = 0;

  gfx.clearTrajectory();
  initChart();

  ui.statsPanel.style.display = 'none';
  ui.dashStatus.textContent   = '🏌️ في الهواء';
  ui.dashStatus.style.color   = '#ffaa00';

  updateGroundUI(params.groundType);
});

// ── إعادة التعيين ────────────────────────────────────────────
ui.resetBtn.addEventListener('click', () => {
  running = false;
  engine  = null;
  gfx.resetBall();
  initChart();
  ui.dashAlt.textContent  = '0.00';
  ui.dashVel.textContent  = '0.00';
  ui.dashDist.textContent = '0.00';
  ui.dashSpin.textContent = '0';
  ui.dashStatus.textContent = 'جاهزة';
  ui.dashStatus.style.color = '#ffaa00';
  ui.statsPanel.style.display = 'none';
  updateGroundUI(ui.groundType.value);
});

// ── أزرار الكاميرا ───────────────────────────────────────────
[ui.camFree, ui.camFollow, ui.camLanding].forEach(btn => {
  if (!btn) return;
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    gfx.cameraMode = mode;
    [ui.camFree, ui.camFollow, ui.camLanding].forEach(b => {
      if (b) b.classList.toggle('active', b.dataset.mode === mode);
    });
  });
});

// ── مزامنة نوع الأرض مع الواجهة ─────────────────────────────
ui.groundType.addEventListener('change', () => {
  updateGroundUI(ui.groundType.value);
});

// ── حلقة التحريك الرئيسية ───────────────────────────────────
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now   = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime    = now;

  if (running && engine) {
    engine.update(delta);
    const state = engine.state;

    gfx.updateBallPosition(state.pos);
    gfx.updateCamera(state.pos);

    const speed = updateHUD(state);

    // تحديث المسار كل إطارين
    if (frameCount % 2 === 0) {
      gfx.updateTrajectory(engine.trajectory);
    }

    // تحديث المخطط البياني كل 3 إطارات
    if (frameCount % 3 === 0) {
      chartLabels.push(engine.time.toFixed(2));
      chartAltData.push(+state.pos.z.toFixed(3));
      chartVelData.push(+speed.toFixed(3));
      chartInstance.update('none');
    }

    // حالة الدحرجة
    if (engine.phase === 'rolling') {
      ui.dashStatus.textContent = '🌿 تتدحرج';
      ui.dashStatus.style.color = '#52b788';
    }

    // توقف
    if (engine.phase === 'stopped') {
      running = false;
      chartInstance.update();

      const stats = engine.getStats();
      ui.statDist.textContent  = stats.distance  + ' م';
      ui.statMaxH.textContent  = stats.maxHeight + ' م';
      ui.statApex.textContent  = stats.apexDist  + ' م';
      ui.statTime.textContent  = stats.flightTime + ' ث';
      ui.statHole.textContent  = stats.inHole ? '🏆 دخلت الجورة!' : '—';
      ui.statsPanel.style.display = 'block';

      ui.dashStatus.textContent = stats.inHole ? '🏆 في الجورة!' : '🎯 مستقرة';
      ui.dashStatus.style.color = '#00ffcc';
    }

    frameCount++;
  } else {
    gfx.updateCamera({ x: 0, y: 0, z: 0 });
  }

  gfx.render();
}

// ── تهيئة أولية ─────────────────────────────────────────────
initChart();
updateGroundUI('fairway');
animate();
