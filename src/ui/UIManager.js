import { GROUND_INFO } from '../utils/Constants.js';

export class UIManager {
  constructor(game) {
    this.game = game;
    this.ui = {
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
      camDefault:  document.getElementById('cam-default'),
      camTop:      document.getElementById('cam-top'),
      camPlayer:   document.getElementById('cam-player'),
      camFollow:   document.getElementById('cam-follow'),
      camFree:     document.getElementById('cam-free'),
      camCinematic:document.getElementById('cam-cinematic'),
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
      victoryOverlay: document.getElementById('victory-overlay'),
      victoryStrokes: document.getElementById('victory-strokes'),
      victoryRestartBtn: document.getElementById('victory-restart-btn'),
    };

    this.activeParam = 'power';
    this.audioCtx = null;

    this.initListeners();
    this.updateActiveParamVisuals('power');
  }

  initListeners() {
    this.ui.launchBtn.addEventListener('click', () => {
      this.game.launchBall();
    });

    this.ui.resetBtn.addEventListener('click', () => {
      this.game.resetGame();
    });

    this.ui.victoryRestartBtn.addEventListener('click', () => {
      this.game.resetGame();
    });

    [this.ui.camDefault, this.ui.camTop, this.ui.camPlayer, this.ui.camFollow, this.ui.camFree, this.ui.camCinematic].forEach(btn => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.game.setCameraMode(mode);
      });
    });

    const ctrlV0 = document.getElementById('ctrl-v0');
    const ctrlPhi = document.getElementById('ctrl-phi');
    const ctrlSidespin = document.getElementById('ctrl-sidespin');

    if (ctrlV0) ctrlV0.addEventListener('click', () => this.updateActiveParamVisuals('power'));
    if (ctrlPhi) ctrlPhi.addEventListener('click', () => this.updateActiveParamVisuals('aim'));
    if (ctrlSidespin) ctrlSidespin.addEventListener('click', () => this.updateActiveParamVisuals('spin'));

    this.ui.groundType.addEventListener('change', () => {
      this.updateGroundUI(this.ui.groundType.value);
    });
  }

  playSound(type) {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'hit') {
        osc.frequency.setValueAtTime(500, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        osc.start(); 
        osc.stop(this.audioCtx.currentTime + 0.1);
      } else if (type === 'bounce') {
        osc.frequency.setValueAtTime(250, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.audioCtx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.06);
        osc.start(); 
        osc.stop(this.audioCtx.currentTime + 0.06);
      } else if (type === 'hole') {
        osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
        osc.frequency.setValueAtTime(800, this.audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1200, this.audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);
        osc.start(); 
        osc.stop(this.audioCtx.currentTime + 0.4);
      }
    } catch (e) { }
  }

  updateHUD(state) {
    const speed = Math.hypot(state.vel.x, state.vel.y, state.vel.z);
    const spin = Math.hypot(state.omega.x, state.omega.y, state.omega.z);
    this.ui.dashAlt.textContent = state.pos.z.toFixed(2);
    this.ui.dashVel.textContent = speed.toFixed(2);
    this.ui.dashDist.textContent = Math.hypot(state.pos.x, state.pos.y).toFixed(2);
    this.ui.dashSpin.textContent = (spin / (2 * Math.PI) * 60).toFixed(0);
    return speed;
  }

  updateGroundUI(type) {
    const info = GROUND_INFO[type] ?? GROUND_INFO.fairway;
    this.ui.groundLabel.textContent = info.label;
    this.ui.groundLabel.style.color = info.color;
    this.ui.groundDesc.textContent = info.desc;
  }

  updateCamButtons(activeMode) {
    [this.ui.camDefault, this.ui.camTop, this.ui.camPlayer, this.ui.camFollow, this.ui.camFree, this.ui.camCinematic].forEach(b => {
      if (b) b.classList.toggle('active', b.dataset.mode === activeMode);
    });
  }

  updateActiveParamVisuals(param) {
    this.activeParam = param;
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

  adjustParameter(param, isIncrease, isFine, shiftPressed) {
    let inputEl = null;
    let valLabelEl = null;
    let normalStep = 1.0;
    let fineStep = 0.1;

    if (param === 'power') {
      inputEl = this.ui.v0;
      valLabelEl = document.getElementById('v0-val');
      normalStep = 1.0;
      fineStep = 0.1;
    } else if (param === 'aim') {
      inputEl = this.ui.phi;
      valLabelEl = document.getElementById('phi-val');
      normalStep = 1.0;
      fineStep = 0.1;
    } else if (param === 'spin') {
      inputEl = this.ui.sidespin;
      valLabelEl = document.getElementById('ss-val');
      normalStep = 100.0;
      fineStep = 10.0;
    }

    if (!inputEl) return;

    let step = isFine ? fineStep : normalStep;
    if (shiftPressed) step /= 10;

    let val = parseFloat(inputEl.value);
    if (isIncrease) val += step;
    else val -= step;

    const min = parseFloat(inputEl.min);
    const max = parseFloat(inputEl.max);
    val = Math.max(min, Math.min(max, val));

    inputEl.value = val;
    if (valLabelEl) {
      valLabelEl.textContent = val.toFixed(param === 'spin' ? 0 : 1);
    }

    this.game.onParamAdjust(param, val);
  }

  getParams() {
    return {
      v0: parseFloat(this.ui.v0.value),
      thetaDeg: parseFloat(this.ui.theta.value),
      phiDeg: parseFloat(this.ui.phi.value),
      backspinRPM: parseFloat(this.ui.backspin.value),
      sidespinRPM: parseFloat(this.ui.sidespin.value),
      temperature: parseFloat(this.ui.temperature.value),
      altitude: parseFloat(this.ui.altitude.value),
      crosswindWs: parseFloat(this.ui.windX.value),
      windX: parseFloat(this.ui.windX.value),
      windY: 0,
      groundType: this.ui.groundType.value,
    };
  }

  setPhiValue(val) {
    this.ui.phi.value = val.toFixed(1);
    const phiValLabel = document.getElementById('phi-val');
    if (phiValLabel) phiValLabel.textContent = val.toFixed(1);
  }

  showVictory(strokes) {
    this.ui.victoryStrokes.textContent = strokes;
    this.ui.victoryOverlay.style.display = 'flex';
    setTimeout(() => {
      this.ui.victoryOverlay.classList.add('show');
    }, 10);
  }

  hideVictory() {
    this.ui.victoryOverlay.classList.remove('show');
    setTimeout(() => {
      if (!this.ui.victoryOverlay.classList.contains('show')) {
        this.ui.victoryOverlay.style.display = 'none';
      }
    }, 400);
  }

  showStats(stats) {
    this.ui.statDist.textContent = stats.distance + ' m';
    this.ui.statMaxH.textContent = stats.maxHeight + ' m';
    this.ui.statApex.textContent = stats.apexDist + ' m';
    this.ui.statTime.textContent = stats.flightTime + ' s';
    this.ui.statHole.textContent = stats.inHole ? 'Yes' : 'No';

    if (this.ui.statLanding && stats.landingX) {
      this.ui.statLanding.textContent = `${stats.landingX} m, ${stats.landingY} m`;
    }
    this.ui.statsPanel.style.display = 'block';
  }

  hideStats() {
    this.ui.statsPanel.style.display = 'none';
  }

  setStatus(text, color) {
    this.ui.dashStatus.textContent = text;
    if (color) this.ui.dashStatus.style.color = color;
  }

  setStrokesHUD(strokes) {
    this.ui.dashStrokes.textContent = strokes;
  }

  dispose() {
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
