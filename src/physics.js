// ============================================================
// physics.js — محرك الفيزياء الكامل لكرة الغولف
// بناءً على الدراسة الفيزيائية: RK4 + Magnus + Drag + Bounce
// ============================================================

// ── الثوابت الفيزيائية ──────────────────────────────────────
export const PHYSICS = {
  BALL_MASS:   0.04593,                                           // kg
  BALL_RADIUS: 0.02135,                                           // m
  BALL_AREA:   Math.PI * 0.02135 ** 2,                           // m²
  INERTIA:     (2 / 5) * 0.04593 * 0.02135 ** 2,                // I = (2/5)mR²
  GRAVITY:     9.81,                                              // m/s²
  CD_DIMPLED:  0.22,                                              // معامل السحب للكرة المنقّرة
  CD_SMOOTH:   0.50,                                              // معامل السحب للكرة الملساء
  TIME_STEP:   0.001,                                             // ثانية — دقة عالية
  MAX_TIME:    20,                                                // حد أقصى للمحاكاة
};

// أنواع أسطح الأرض — من الدراسة الفيزيائية
export const GROUND_TYPES = {
  green:   { restitution: 0.38, rollingFriction: 0.015, name: 'أخضر — Green'   },
  fairway: { restitution: 0.35, rollingFriction: 0.025, name: 'ممر — Fairway'  },
  rough:   { restitution: 0.15, rollingFriction: 0.080, name: 'خشن — Rough'    },
  hardpan: { restitution: 0.40, rollingFriction: 0.012, name: 'صلب — Hardpan'  },
};

// ── كثافة الهواء الديناميكية (حرارة + ارتفاع) ──────────────
export function calcAirDensity(tempC, altitude) {
  const T0 = 288.15;
  const T  = tempC + 273.15;
  return 1.225 * (T0 / T) * Math.exp(-0.000118 * altitude);
}

// ── رقم رينولدز → معامل السحب الديناميكي ────────────────────
function dynamicCd(vel, rho) {
  const speed = Math.hypot(vel.x, vel.y, vel.z);
  const Re    = (rho * speed * 2 * PHYSICS.BALL_RADIUS) / 1.81e-5;
  if (Re < 50000)  return 0.50;
  if (Re < 200000) return 0.50 - (0.28 * (Re - 50000) / 150000);
  return 0.22;
}

// ── معامل الرفع من نسبة الدوران (بيانات تجريبية) ────────────
function liftCoeff(spinRatio) {
  if (spinRatio < 0.05) return 0;
  if (spinRatio > 0.50) return 0.30;
  return 0.60 * spinRatio;
}

// ── حساب القوى الكلية وإعادة التسارع ────────────────────────
function computeAccel(vel, omega, rho, wind) {
  // سرعة الكرة نسبةً للهواء
  const rv = { x: vel.x - wind.x, y: vel.y - wind.y, z: vel.z - wind.z };
  const speed = Math.hypot(rv.x, rv.y, rv.z);

  // ── السحب (Drag) ──
  const Cd   = dynamicCd(rv, rho);
  const drag = -0.5 * Cd * rho * PHYSICS.BALL_AREA * speed;
  const fDx  = speed > 0 ? (drag * rv.x) / speed : 0;
  const fDy  = speed > 0 ? (drag * rv.y) / speed : 0;
  const fDz  = speed > 0 ? (drag * rv.z) / speed : 0;

  // ── قوة ماغنوس (Magnus / Lift) ──
  let fLx = 0, fLy = 0, fLz = 0;
  const wMag = Math.hypot(omega.x, omega.y, omega.z);
  if (wMag > 0.1 && speed > 0.01) {
    const spinRatio = (PHYSICS.BALL_RADIUS * wMag) / speed;
    const Cl        = liftCoeff(spinRatio);
    const magnusK   = 0.5 * Cl * rho * PHYSICS.BALL_AREA * (speed / wMag);
    // ω × v
    const cx = omega.y * rv.z - omega.z * rv.y;
    const cy = omega.z * rv.x - omega.x * rv.z;
    const cz = omega.x * rv.y - omega.y * rv.x;
    fLx = magnusK * cx;
    fLy = magnusK * cy;
    fLz = magnusK * cz;
  }

  // ── اضمحلال الدوران (Spin Decay) بالمعادلة الفيزيائية ──
  const Cm           = 0.005;
  const spinDecayK   = (rho * PHYSICS.BALL_RADIUS * PHYSICS.BALL_AREA * Cm * speed) /
                       (2 * PHYSICS.INERTIA);
  const dOmX = -spinDecayK * omega.x;
  const dOmY = -spinDecayK * omega.y;
  const dOmZ = -spinDecayK * omega.z;

  return {
    ax:   (fDx + fLx) / PHYSICS.BALL_MASS,
    ay:   (fDy + fLy) / PHYSICS.BALL_MASS,
    az:   -PHYSICS.GRAVITY + (fDz + fLz) / PHYSICS.BALL_MASS,
    dOmX, dOmY, dOmZ,
  };
}

// ── خطوة RK4 كاملة ───────────────────────────────────────────
export function rk4Step(state, dt, rho, wind) {
  const { pos, vel, omega } = state;

  function deriv(v, om) {
    const a = computeAccel(v, om, rho, wind);
    return { vx: v.x, vy: v.y, vz: v.z, ax: a.ax, ay: a.ay, az: a.az,
             dOmX: a.dOmX, dOmY: a.dOmY, dOmZ: a.dOmZ };
  }

  const k1 = deriv(vel, omega);

  const v2  = { x: vel.x + .5*dt*k1.ax,   y: vel.y + .5*dt*k1.ay,   z: vel.z + .5*dt*k1.az   };
  const om2 = { x: omega.x+.5*dt*k1.dOmX, y: omega.y+.5*dt*k1.dOmY, z: omega.z+.5*dt*k1.dOmZ };
  const k2  = deriv(v2, om2);

  const v3  = { x: vel.x + .5*dt*k2.ax,   y: vel.y + .5*dt*k2.ay,   z: vel.z + .5*dt*k2.az   };
  const om3 = { x: omega.x+.5*dt*k2.dOmX, y: omega.y+.5*dt*k2.dOmY, z: omega.z+.5*dt*k2.dOmZ };
  const k3  = deriv(v3, om3);

  const v4  = { x: vel.x + dt*k3.ax,   y: vel.y + dt*k3.ay,   z: vel.z + dt*k3.az   };
  const om4 = { x: omega.x+dt*k3.dOmX, y: omega.y+dt*k3.dOmY, z: omega.z+dt*k3.dOmZ };
  const k4  = deriv(v4, om4);

  const w = dt / 6;
  return {
    pos: {
      x: pos.x + w*(k1.vx+2*k2.vx+2*k3.vx+k4.vx),
      y: pos.y + w*(k1.vy+2*k2.vy+2*k3.vy+k4.vy),
      z: pos.z + w*(k1.vz+2*k2.vz+2*k3.vz+k4.vz),
    },
    vel: {
      x: vel.x + w*(k1.ax+2*k2.ax+2*k3.ax+k4.ax),
      y: vel.y + w*(k1.ay+2*k2.ay+2*k3.ay+k4.ay),
      z: vel.z + w*(k1.az+2*k2.az+2*k3.az+k4.az),
    },
    omega: {
      x: omega.x + w*(k1.dOmX+2*k2.dOmX+2*k3.dOmX+k4.dOmX),
      y: omega.y + w*(k1.dOmY+2*k2.dOmY+2*k3.dOmY+k4.dOmY),
      z: omega.z + w*(k1.dOmZ+2*k2.dOmZ+2*k3.dOmZ+k4.dOmZ),
    },
  };
}

// ── ارتداد الأرض — Impulse Model ─────────────────────────────
export function handleBounce(state, eGround) {
  const { vel, omega, pos } = state;
  const mu_d = 0.20;
  const vzB  = vel.z;

  // الارتداد العمودي
  const newVz = -eGround * vzB;

  // سرعة الانزلاق على السطح
  const vSlipX = vel.x - PHYSICS.BALL_RADIUS * omega.y;
  const vSlipY = vel.y;
  const vSlipM = Math.hypot(vSlipX, vSlipY);

  let newVx = vel.x, newVy = vel.y;
  let newOmY = omega.y;

  if (vSlipM > 0.01) {
    const imp  = mu_d * (1 + eGround) * Math.abs(vzB);
    const fx   = -imp * (vSlipX / vSlipM);
    const fy   = -imp * (vSlipY / vSlipM);
    newVx     += fx;
    newVy     += fy;
    newOmY    += (PHYSICS.BALL_RADIUS * (-fx)) / PHYSICS.INERTIA;
  }

  return {
    pos:   { ...pos, z: PHYSICS.BALL_RADIUS + 0.001 },
    vel:   { x: newVx, y: newVy, z: newVz },
    omega: { ...omega, y: newOmY },
  };
}

// ── تحديث الدحرجة (Velocity Verlet) ──────────────────────────
export function rollingStep(state, dt, mu_r) {
  const { pos, vel, omega } = state;
  const speed = Math.hypot(vel.x, vel.y);

  // عتبة التوقف — أي سرعة أقل من 0.3 م/ث تتوقف فوراً
  if (speed < 0.3) {
    return { pos, vel: {x:0, y:0, z:0}, omega: {x:0, y:0, z:0} };
  }

  // تباطؤ بفعل الاحتكاك التدحرجي: a = -μr·g
  const decel  = mu_r * PHYSICS.GRAVITY;
  const nx     = vel.x / speed;
  const ny     = vel.y / speed;

  // سرعة جديدة بعد الاحتكاك
  let newVx = vel.x - decel * nx * dt;
  let newVy = vel.y - decel * ny * dt;

  // إذا عكس الاتجاه → توقف
  if (Math.sign(newVx) !== Math.sign(vel.x)) newVx = 0;
  if (Math.sign(newVy) !== Math.sign(vel.y)) newVy = 0;

  // موقع جديد
  const newPx = pos.x + (vel.x + newVx) * 0.5 * dt;
  const newPy = pos.y + (vel.y + newVy) * 0.5 * dt;

  // اضمحلال الدوران بنسبة أسرع أثناء الدحرجة
  const spinDecay = Math.max(0, 1 - decel * dt / Math.max(speed, 0.1));

  return {
    pos:   { x: newPx, y: newPy, z: PHYSICS.BALL_RADIUS },
    vel:   { x: newVx, y: newVy, z: 0 },
    omega: { x: omega.x * spinDecay, y: omega.y * spinDecay, z: omega.z * spinDecay },
  };
}

// ── الشروط الابتدائية من معطيات المضرب ───────────────────────
export function calcInitialState(p) {
  const { v0, thetaDeg, phiDeg, backspinRPM, sidespinRPM } = p;
  const thetaR = thetaDeg * Math.PI / 180;
  const phiR   = phiDeg   * Math.PI / 180;
  const bs     = (backspinRPM  * 2 * Math.PI) / 60;
  const ss     = (sidespinRPM  * 2 * Math.PI) / 60;
  return {
    pos:   { x: 0, y: 0, z: PHYSICS.BALL_RADIUS },
    vel:   {
      x: v0 * Math.cos(thetaR) * Math.cos(phiR),
      y: v0 * Math.cos(thetaR) * Math.sin(phiR),
      z: v0 * Math.sin(thetaR),
    },
    omega: { x: ss, y: -bs, z: 0 },   // backspin سالب يعطي Magnus للأعلى
  };
}

// ── محرك المحاكاة الكامل ──────────────────────────────────────
export class PhysicsEngine {
  constructor(params) {
    this.p          = params;
    this.rho        = calcAirDensity(params.temperature ?? 20, params.altitude ?? 0);
    this.wind       = { x: params.windX ?? 0, y: params.windY ?? 0, z: 0 };
    const gt        = GROUND_TYPES[params.groundType] ?? GROUND_TYPES.fairway;
    this.eGround    = gt.restitution;
    this.muRolling  = gt.rollingFriction;
    this.state      = calcInitialState(params);
    this.trajectory = [{ ...this.state.pos }];
    this.time       = 0;
    this.phase      = 'flight';   // 'flight' | 'rolling' | 'stopped'
    this.inHole     = false;
    this.bounces    = 0;
    this.maxBounces = 6;
  }

  step(dt) {
    if (this.phase === 'stopped') return;

    if (this.phase === 'flight') {
      this.state = rk4Step(this.state, dt, this.rho, this.wind);
      this.time += dt;

      // وصل الأرض؟
      if (this.state.pos.z <= PHYSICS.BALL_RADIUS && this.bounces < this.maxBounces) {
        this.state = handleBounce(this.state, this.eGround);
        this.bounces++;
        // إذا كانت السرعة العمودية صغيرة جداً بعد الارتداد → تدحرج
        if (Math.abs(this.state.vel.z) < 0.5) {
          this.state.pos.z  = PHYSICS.BALL_RADIUS;
          this.state.vel.z  = 0;
          this.phase        = 'rolling';
        }
      } else if (this.state.pos.z <= PHYSICS.BALL_RADIUS) {
        this.state.pos.z = PHYSICS.BALL_RADIUS;
        this.state.vel.z = 0;
        this.phase       = 'rolling';
      }

      if (this.time > PHYSICS.MAX_TIME) this.phase = 'stopped';

    } else if (this.phase === 'rolling') {
      this.state = rollingStep(this.state, dt, this.muRolling);
      this.time += dt;
      if (this.state.vel.x === 0 && this.state.vel.y === 0) {
        this.phase = 'stopped';
      }
    }

    // تسجيل المسار (كل خطوة ثانية تقريباً لتوفير الذاكرة)
    if (this.trajectory.length < 8000) {
      this.trajectory.push({ ...this.state.pos });
    }

    // فحص دخول الجورة (x=170, y=0)
    if (!this.inHole) {
      const dx = this.state.pos.x - 170;
      const dy = this.state.pos.y;
      if (Math.hypot(dx, dy) < 0.6 && this.state.pos.z <= PHYSICS.BALL_RADIUS * 3) {
        this.inHole         = true;
        this.phase          = 'stopped';
        this.state.pos      = { x: 170, y: 0, z: -0.05 };
        this.state.vel      = { x: 0, y: 0, z: 0 };
      }
    }
  }

  update(deltaTime) {
    if (this.phase === 'stopped') return;
    const dt      = PHYSICS.TIME_STEP;
    let   remain  = Math.min(deltaTime, 0.05);
    let   steps   = 0;
    while (remain > 0 && this.phase !== 'stopped' && steps < 60) {
      this.step(Math.min(dt, remain));
      remain -= dt;
      steps++;
    }
  }

  getStats() {
    let maxH = 0, apexDist = 0;
    for (const p of this.trajectory) {
      if (p.z > maxH) { maxH = p.z; apexDist = Math.hypot(p.x, p.y); }
    }
    const last  = this.trajectory[this.trajectory.length - 1];
    return {
      distance:  Math.hypot(last.x, last.y).toFixed(1),
      maxHeight: maxH.toFixed(1),
      apexDist:  apexDist.toFixed(1),
      flightTime:this.time.toFixed(2),
      inHole:    this.inHole,
    };
  }
}
