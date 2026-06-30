// ============================================================
// main.js — Main Simulation Entry Point
// ============================================================
import * as THREE from 'three';
import { GraphicsSystem } from './graphics.js';
import { PhysicsEngine, GROUND_TYPES, calcAirDensity } from './physics.js';

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
  camTop:      document.getElementById('cam-top'),
  camPlayer:   document.getElementById('cam-player'),
  dashAlt:     document.getElementById('dash-alt'),
  dashVel:     document.getElementById('dash-vel'),
  dashDist:    document.getElementById('dash-dist'),
  dashSpin:    document.getElementById('dash-spin'),
  dashStatus:  document.getElementById('dash-status'),
  dashStrokes: document.getElementById('dash-strokes'),
  statsPanel:  document.getElementById('stats-panel'),
  statDist:    document.getElementById('stat-dist'),
  statMaxH:    document.getElementById('stat-maxh'),
  statApex:    document.getElementById('stat-apex'),
  statTime:    document.getElementById('stat-time'),
  statHole:    document.getElementById('stat-hole'),
  statLanding: document.getElementById('stat-landing') || null,
  groundLabel: document.getElementById('ground-label'),
  groundDesc:  document.getElementById('ground-desc'),
};

const GROUND_INFO = {
  green:   { label: 'Green',   color: '#4ecb71', desc: 'Putting green grass. Ball rolls smoothly.' },
  fairway: { label: 'Fairway',  color: '#6fcf8a', desc: 'Main cut fairway. Normal bounce and roll.' },
  rough:   { label: 'Rough',    color: '#b5cc55', desc: 'Long grass. Absorbs impact energy.' },
  hardpan: { label: 'Hardpan',  color: '#d4aa60', desc: 'Hard dry ground. Higher bounce, longer roll.' },
};

let chartInstance = null;
let chartLabels = [];
let chartAltData = [];
let chartVelData = [];

function initChart() {
  const ctx = document.getElementById('physicsChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  chartLabels = [0];
  chartAltData = [0];
  chartVelData = [0];
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [
        { label: 'Altitude (m)', data: chartAltData, borderColor: '#ffaa00', backgroundColor: 'rgba(255,170,0,0.08)',
          yAxisID: 'y-alt', borderWidth: 2, pointRadius: 0, fill: true },
        { label: 'Speed (m/s)', data: chartVelData, borderColor: '#00ffcc', backgroundColor: 'rgba(0,255,200,0.06)',
          yAxisID: 'y-vel', borderWidth: 2, pointRadius: 0, fill: true },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      scales: {
        x: { title: { display: true, text: 'Time (s)', font: { size: 10 } }, ticks: { maxTicksLimit: 8 } },
        'y-alt': { type: 'linear', position: 'right', title: { display: true, text: 'Altitude', color: '#ffaa00', font: { size: 10 } }, grid: { color: 'rgba(255,170,0,0.08)' } },
        'y-vel': { type: 'linear', position: 'left', title: { display: true, text: 'Speed', color: '#00ffcc', font: { size: 10 } }, grid: { color: 'rgba(0,255,200,0.06)' } },
      },
      plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } },
    },
  });
}

const gfx = new GraphicsSystem();
let engine = null;
let running = false;
let frameCount = 0;
let lastBounceCount = 0;
let strokes = 0;
let currentBallPos = { x: 0, y: 0, z: 0.02135 }; // physics coordinates (z = PHYSICS.BALL_RADIUS)
let holeComplete = false;

function updateHUD(state) {
  const speed = Math.hypot(state.vel.x, state.vel.y, state.vel.z);
  const spin = Math.hypot(state.omega.x, state.omega.y, state.omega.z);
  ui.dashAlt.textContent = state.pos.z.toFixed(2);
  ui.dashVel.textContent = speed.toFixed(2);
  ui.dashDist.textContent = Math.hypot(state.pos.x, state.pos.y).toFixed(2);
  ui.dashSpin.textContent = (spin / (2 * Math.PI) * 60).toFixed(0);
  return speed;
}

function updateGroundUI(type) {
  const info = GROUND_INFO[type] ?? GROUND_INFO.fairway;
  ui.groundLabel.textContent = info.label;
  ui.groundLabel.style.color = info.color;
  ui.groundDesc.textContent = info.desc;
}

function resetGame() {
  running = false;
  engine = null;
  strokes = 0;
  currentBallPos = { x: 0, y: 0, z: 0.02135 };
  holeComplete = false;
  ui.dashStrokes.textContent = '0';
  gfx.resetBall();
  
  // Reset club position back to starting tee-off
  gfx.updateClubPositionAndAim(currentBallPos, parseFloat(ui.phi.value));

  // Reset camera mode to player/aim
  gfx.cameraMode = 'player';
  updateCamButtons('player');

  // Hide victory modal
  document.getElementById('victory-overlay').style.display = 'none';

  initChart();
  ui.dashAlt.textContent = '0.00';
  ui.dashVel.textContent = '0.00';
  ui.dashDist.textContent = '0.00';
  ui.dashSpin.textContent = '0';
  ui.dashStatus.textContent = 'Ready';
  ui.dashStatus.style.color = '#ffaa00';
  ui.statsPanel.style.display = 'none';
  updateGroundUI(ui.groundType.value);
}

ui.launchBtn.addEventListener('click', () => {
  if (running || gfx.clubState !== 'idle') return;

  // Hide the aiming line immediately
  if (gfx.aimLine) {
    gfx.aimLine.visible = false;
  }

  const params = {
    v0: parseFloat(ui.v0.value),
    thetaDeg: parseFloat(ui.theta.value),
    phiDeg: parseFloat(ui.phi.value),
    backspinRPM: parseFloat(ui.backspin.value),
    sidespinRPM: parseFloat(ui.sidespin.value),
    temperature: parseFloat(ui.temperature.value),
    altitude: parseFloat(ui.altitude.value),
    windX: parseFloat(ui.windX.value),
    windY: 0,
    groundType: ui.groundType.value,
  };

  // Start the swing animation of the club.
  gfx.startSwing(
    // onImpact callback: starts ball physics!
    () => {
      const clubForward = gfx.getClubForwardVector(params.thetaDeg);
      engine = new PhysicsEngine(params, currentBallPos, clubForward);
      running = true;
      frameCount = 0;
      lastBounceCount = 0;

      strokes++;
      ui.dashStrokes.textContent = strokes;

      // Switch camera to follow mode on impact
      gfx.cameraMode = 'follow';
      updateCamButtons('follow');

      // Hide the club during flight
      if (gfx.clubGroup) {
        gfx.clubGroup.visible = false;
      }

      gfx.clearTrajectory();
      initChart();

      ui.statsPanel.style.display = 'none';
      ui.dashStatus.textContent = `Stroke ${strokes}`;
      ui.dashStatus.style.color = '#ffaa00';

      updateGroundUI(params.groundType);
      playSound('hit');
    },
    // onComplete callback: called when swing returns to idle
    () => {
      console.log('Swing complete.');
    }
  );
});

ui.resetBtn.addEventListener('click', resetGame);
document.getElementById('victory-restart-btn').addEventListener('click', resetGame);

// Camera Mode Buttons
[ui.camFree, ui.camFollow, ui.camLanding, ui.camTop, ui.camPlayer].forEach(btn => {
  if (!btn) return;
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    gfx.cameraMode = mode;
    updateCamButtons(mode);
  });
});

function updateCamButtons(activeMode) {
  [ui.camFree, ui.camFollow, ui.camLanding, ui.camTop, ui.camPlayer].forEach(b => {
    if (b) b.classList.toggle('active', b.dataset.mode === activeMode);
  });
}

// Camera keyboard shortcuts and parameter controls
let activeParam = 'power';

function adjustParameter(param, isIncrease, isFine, shiftPressed) {
  let inputEl = null;
  let valLabelEl = null;
  let normalStep = 1.0;
  let fineStep = 0.1;
  
  if (param === 'power') {
    inputEl = ui.v0;
    valLabelEl = document.getElementById('v0-val');
    normalStep = 1.0;
    fineStep = 0.1;
  } else if (param === 'aim') {
    inputEl = ui.phi;
    valLabelEl = document.getElementById('phi-val');
    normalStep = 1.0;
    fineStep = 0.1;
  } else if (param === 'spin') {
    inputEl = ui.sidespin;
    valLabelEl = document.getElementById('ss-val');
    normalStep = 100.0;
    fineStep = 10.0;
  }
  
  if (!inputEl) return;
  
  let step = isFine ? fineStep : normalStep;
  if (shiftPressed) {
    step /= 10;
  }
  
  let val = parseFloat(inputEl.value);
  if (isIncrease) {
    val += step;
  } else {
    val -= step;
  }
  
  const min = parseFloat(inputEl.min);
  const max = parseFloat(inputEl.max);
  val = Math.max(min, Math.min(max, val));
  
  inputEl.value = val;
  if (valLabelEl) {
    valLabelEl.textContent = val.toFixed(param === 'spin' ? 0 : 1);
  }
  
  // Force rendering updates immediately
  if (param === 'aim' && !running && !holeComplete) {
    gfx.updateClubPositionAndAim(currentBallPos, val);
    gfx.updateAimLine(currentBallPos, val, parseFloat(ui.theta.value));
  }
}

function updateActiveParamVisuals(param) {
  activeParam = param;
  
  const ctrlV0 = document.getElementById('ctrl-v0');
  const ctrlPhi = document.getElementById('ctrl-phi');
  const ctrlSidespin = document.getElementById('ctrl-sidespin');
  
  if (ctrlV0) ctrlV0.classList.toggle('active-param', param === 'power');
  if (ctrlPhi) ctrlPhi.classList.toggle('active-param', param === 'aim');
  if (ctrlSidespin) ctrlSidespin.classList.toggle('active-param', param === 'spin');
  
  const hudVal = document.getElementById('active-param-hud');
  if (hudVal) {
    hudVal.textContent = param === 'power' ? 'Power' : param === 'aim' ? 'Aim' : 'Spin';
  }
}

// Click to focus parameters
if (document.getElementById('ctrl-v0')) {
  document.getElementById('ctrl-v0').addEventListener('click', () => updateActiveParamVisuals('power'));
}
if (document.getElementById('ctrl-phi')) {
  document.getElementById('ctrl-phi').addEventListener('click', () => updateActiveParamVisuals('aim'));
}
if (document.getElementById('ctrl-sidespin')) {
  document.getElementById('ctrl-sidespin').addEventListener('click', () => updateActiveParamVisuals('spin'));
}

// Initialize visuals on load
updateActiveParamVisuals('power');

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  
  // Select Parameter Hotkeys
  if (key === 'p') {
    updateActiveParamVisuals('power');
    e.preventDefault();
  } else if (key === 'a') {
    updateActiveParamVisuals('aim');
    e.preventDefault();
  } else if (key === 's') {
    updateActiveParamVisuals('spin');
    e.preventDefault();
  }
  
  // Camera Shortcuts
  if (e.key === '1') {
    gfx.cameraMode = 'free';
    updateCamButtons('free');
  } else if (e.key === '2') {
    gfx.cameraMode = 'follow';
    updateCamButtons('follow');
  } else if (e.key === '3') {
    gfx.cameraMode = 'landing';
    updateCamButtons('landing');
  } else if (e.key === '4') {
    gfx.cameraMode = 'top';
    updateCamButtons('top');
  } else if (e.key === '5') {
    gfx.cameraMode = 'player';
    updateCamButtons('player');
  }
  
  // Arrow Key Parameter Adjustment
  if (!running && !holeComplete) {
    const shiftPressed = e.shiftKey;
    
    if (e.key === 'ArrowUp') {
      adjustParameter(activeParam, true, false, shiftPressed);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      adjustParameter(activeParam, false, false, shiftPressed);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      adjustParameter(activeParam, true, true, shiftPressed);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      adjustParameter(activeParam, false, true, shiftPressed);
      e.preventDefault();
    }
  }
});

ui.groundType.addEventListener('change', () => {
  updateGroundUI(ui.groundType.value);
});

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'hit') {
      osc.frequency.setValueAtTime(500, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start(); 
      osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'bounce') {
      osc.frequency.setValueAtTime(250, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.06);
      osc.start(); 
      osc.stop(audioCtx.currentTime + 0.06);
    } else if (type === 'hole') {
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.1);
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.start(); 
      osc.stop(audioCtx.currentTime + 0.4);
    }
  } catch (e) { }
}

let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  gfx.updateEnvironment(delta);
  gfx.updateParticles(delta);

  if (running && engine) {
    engine.update(delta);
    const state = engine.state;

    gfx.updateBallPosition(state.pos, state.omega, delta);
    gfx.updateCamera(state.pos, parseFloat(ui.phi.value));

    const speed = updateHUD(state);

    if (frameCount % 2 === 0) {
      gfx.updateTrajectory(engine.trajectory);
    }

    if (engine.landingPoint) {
      gfx.updateLandingMarker(engine.landingPoint);
    }

    if (frameCount % 3 === 0) {
      chartLabels.push(engine.time.toFixed(2));
      chartAltData.push(+state.pos.z.toFixed(3));
      chartVelData.push(+speed.toFixed(3));
      chartInstance.update('none');
    }

    if (engine.bounces > lastBounceCount) {
      playSound('bounce');
      gfx.createBounceParticles(state.pos, Math.min(1, speed / 20));
      lastBounceCount = engine.bounces;
    }

    if (engine.phase === 'rolling') {
      ui.dashStatus.textContent = 'Rolling';
      ui.dashStatus.style.color = '#52b788';
    }

    if (engine.phase === 'stopped') {
      running = false;
      chartInstance.update();

      // Save resting ball position
      currentBallPos = { x: state.pos.x, y: state.pos.y, z: state.pos.z };

      // Calculate perfect aiming angle pointing directly from the ball to the hole (170, 0)
      const dx = 170 - currentBallPos.x;
      const dy = -currentBallPos.y; // physics Y is sideways, corresponds to -z in Three.js
      const angleRad = Math.atan2(dy, dx);
      let angleDeg = angleRad * 180 / Math.PI;
      
      // Clamp/Wrap to [-180, 180] range
      if (angleDeg < -180) angleDeg += 360;
      if (angleDeg > 180) angleDeg -= 360;

      // Update aiming input slider and label
      ui.phi.value = angleDeg.toFixed(1);
      const phiValLabel = document.getElementById('phi-val');
      if (phiValLabel) {
        phiValLabel.textContent = angleDeg.toFixed(1);
      }

      // Reposition the club face behind the ball oriented along the new aim direction
      gfx.updateClubPositionAndAim(currentBallPos, angleDeg);

      // Show ball at new position (hides the tee ball if away from start)
      gfx.positionBallAt(currentBallPos);

      const stats = engine.getStats();
      ui.statDist.textContent = stats.distance + ' m';
      ui.statMaxH.textContent = stats.maxHeight + ' m';
      ui.statApex.textContent = stats.apexDist + ' m';
      ui.statTime.textContent = stats.flightTime + ' s';
      ui.statHole.textContent = stats.inHole ? 'Yes' : 'No';

      if (ui.statLanding && stats.landingX) {
        ui.statLanding.textContent = `${stats.landingX} m, ${stats.landingY} m`;
      }

      // Check if the ball went in the hole
      if (stats.inHole) {
        holeComplete = true;

        // Hide club and aiming line immediately (HOLE_COMPLETE state)
        if (gfx.clubGroup) {
          gfx.clubGroup.visible = false;
        }
        if (gfx.aimLine) {
          gfx.aimLine.visible = false;
        }

        gfx.cameraMode = 'hole';
        updateCamButtons('hole');
        playSound('hole');
        
        // Show victory modal after a small delay to allow viewing the cinematic orbit first
        setTimeout(() => {
          document.getElementById('victory-strokes').textContent = strokes;
          document.getElementById('victory-overlay').style.display = 'flex';
        }, 1500);
      } else {
        // Return to aim camera mode behind the new ball position
        gfx.cameraMode = 'player';
        updateCamButtons('player');
        
        ui.statsPanel.style.display = 'block';
      }

      ui.dashStatus.textContent = stats.inHole ? 'Holed' : 'Stopped';
      ui.dashStatus.style.color = '#00ffcc';
    }

    frameCount++;
  } else {
    if (holeComplete) {
      gfx.updateCamera(currentBallPos, parseFloat(ui.phi.value));
      // Hide club and line when hole complete (HOLE_COMPLETE state)
      if (gfx.clubGroup) {
        gfx.clubGroup.visible = false;
      }
      if (gfx.aimLine) {
        gfx.aimLine.visible = false;
      }
    } else {
      // Keep camera orbiting behind the ball relative to aim slider when idle
      gfx.updateCamera(currentBallPos, parseFloat(ui.phi.value));
      
      // Reposition the club face behind the ball oriented along the aim direction when idle
      if (gfx.clubState === 'idle') {
        gfx.updateClubPositionAndAim(currentBallPos, parseFloat(ui.phi.value));
        
        // Update interactive aiming guide line in real-time!
        gfx.updateAimLine(currentBallPos, parseFloat(ui.phi.value), parseFloat(ui.theta.value));
      }
    }
  }

  gfx.render();
}

initChart();
updateGroundUI('fairway');
animate();