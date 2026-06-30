// ============================================================
// physics.js — Complete Golf Ball Physics Engine
// Based on the Physics Study: RK4 + Magnus + Drag + Bounce + Roll
// ============================================================

// ── Physics Configuration (PhysicsConfig) ───────────────────
// Single source of truth for all physical constants and ground types.
export const PhysicsConfig = {
  GRAVITY:      9.81,                                             // g (m/s²)
  BALL_MASS:    0.04593,                                          // m (kg)
  BALL_RADIUS:  0.02135,                                          // R (m)
  BALL_AREA:    Math.PI * 0.02135 ** 2,                           // A = pi * R² (m²)
  INERTIA:      (2 / 5) * 0.04593 * 0.02135 ** 2,                 // I = (2/5)*m*R² (kg*m²)
  TIME_STEP:    0.001,                                            // h (s) - RK4 step size
  MAX_TIME:     20,                                               // Maximum simulation time (s)
  KINETIC_FRICTION: 0.20,                                         // mu_k (dynamic friction during bounce)
  
  GROUND_TYPES: {
    green:   { restitution: 0.38, rollingFriction: 0.08, name: 'Green'   },
    fairway: { restitution: 0.30, rollingFriction: 0.16, name: 'Fairway'  },
    rough:   { restitution: 0.12, rollingFriction: 0.35, name: 'Rough'    },
    hardpan: { restitution: 0.45, rollingFriction: 0.06, name: 'Hardpan'  },
  }
};

// Aliases for backward compatibility
export const PHYSICS = PhysicsConfig;
export const GROUND_TYPES = PhysicsConfig.GROUND_TYPES;

// ── Air Density (temperature + altitude) ────────────────────
export function calcAirDensity(tempC, altitude) {
  const T0 = 288.15;
  const T  = tempC + 273.15;
  return 1.225 * (T0 / T) * Math.exp(-0.000118 * altitude);
}

// ── Reynolds Number -> Drag Coefficient (Dimpled Golf Ball) ──
function dynamicCd(vel, rho) {
  const speed = Math.hypot(vel.x, vel.y, vel.z);
  const Re    = (rho * speed * 2 * PhysicsConfig.BALL_RADIUS) / 1.81e-5;
  if (Re < 50000)  return 0.50;
  if (Re < 200000) return 0.50 - (0.28 * (Re - 50000) / 150000);
  return 0.22;
}

// ── Lift Coefficient from Spin Ratio ────────────────────────
function liftCoeff(spinRatio) {
  if (spinRatio < 0.05) return 0;
  if (spinRatio > 0.50) return 0.30;
  const peak = 0.25;
  if (spinRatio < peak) return 0.60 * spinRatio;
  return 0.15 + 0.30 * Math.exp(-(spinRatio - peak) * 3);
}

// ── Acceleration and Spin Derivatives ───────────────────────
function computeAccel(vel, omega, rho, wind) {
  // Relative velocity with respect to wind
  const rv = { x: vel.x - wind.x, y: vel.y - wind.y, z: vel.z - wind.z };
  const speed = Math.hypot(rv.x, rv.y, rv.z);
  
  if (speed <= 0.0001) {
    return { ax: 0, ay: 0, az: -PhysicsConfig.GRAVITY, dOmX: 0, dOmY: 0, dOmZ: 0 };
  }

  const Cd = dynamicCd(rv, rho);
  const wMag = Math.hypot(omega.x, omega.y, omega.z);
  
  let Cl = 0;
  if (wMag > 0.1) {
    const spinRatio = (PhysicsConfig.BALL_RADIUS * wMag) / speed;
    Cl = liftCoeff(spinRatio);
  }

  // Lift components divided by |w| if spinning
  const wMagVal = wMag > 0.0001 ? wMag : 1.0;
  const liftX = Cl * (omega.y * rv.z - omega.z * rv.y) / wMagVal;
  const liftY = Cl * (omega.z * rv.x - omega.x * rv.z) / wMagVal;
  const liftZ = Cl * (omega.x * rv.y - omega.y * rv.x) / wMagVal;

  const k = -0.5 * rho * PhysicsConfig.BALL_AREA * speed / PhysicsConfig.BALL_MASS;

  // Accel components matching Cartesian coordinate equations:
  // ax = -0.5*rho*A*speed*(Cd*vx - Cl*(wy*vz - wz*vy)/|w|) / m
  const ax = k * (Cd * rv.x - liftX);
  const ay = k * (Cd * rv.y - liftY);
  const az = -PhysicsConfig.GRAVITY + k * (Cd * rv.z - liftZ);

  // Spin decay due to air resistance (Cm torque)
  const Cm = 0.005;
  const spinDecayK = (rho * PhysicsConfig.BALL_RADIUS * PhysicsConfig.BALL_AREA * Cm * speed) /
                     (2 * PhysicsConfig.INERTIA);
  const dOmX = -spinDecayK * omega.x;
  const dOmY = -spinDecayK * omega.y;
  const dOmZ = -spinDecayK * omega.z;

  return { ax, ay, az, dOmX, dOmY, dOmZ };
}

// ── Runge-Kutta 4th Order Integration (RK4) ──────────────────
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

// ── Ground Impact and Friction loss (Bounce) ──────────────────
export function handleBounce(state, eGround, groundType) {
  const { vel, omega, pos } = state;
  const mu_k = PhysicsConfig.KINETIC_FRICTION;
  
  // Normal velocity is vertical (Z), tangential is horizontal (X and Y)
  const vn_before = vel.z;
  const vt_before_x = vel.x;
  const vt_before_y = vel.y;
  const vt_before_mag = Math.hypot(vt_before_x, vt_before_y);

  // Vertical bouncing velocity
  const vn_after = -eGround * vn_before;

  // Tangential velocity loss due to friction impulse
  let vt_after_x = vt_before_x;
  let vt_after_y = vt_before_y;
  
  if (vt_before_mag > 0.001) {
    const delta_vt = mu_k * (1 + eGround) * Math.abs(vn_before);
    const scale = Math.max(0, (vt_before_mag - delta_vt) / vt_before_mag);
    vt_after_x = vt_before_x * scale;
    vt_after_y = vt_before_y * scale;
  }

  // Spin absorption by surface impact
  const spinLossFactor = groundType === 'green' ? 0.75 : 
                         groundType === 'fairway' ? 0.65 :
                         groundType === 'rough' ? 0.90 : 0.55;
  
  const newOmegaX = omega.x * (1 - spinLossFactor * 0.3);
  const newOmegaY = omega.y * (1 - spinLossFactor);
  const newOmegaZ = omega.z * (1 - spinLossFactor * 0.3);

  return {
    pos:   { ...pos, z: PhysicsConfig.BALL_RADIUS + 0.001 },
    vel:   { x: vt_after_x, y: vt_after_y, z: vn_after },
    omega: { x: newOmegaX, y: newOmegaY, z: newOmegaZ },
  };
}

// ── Rolling Motion Integration ──────────────────────────────
export function rollingStep(state, dt, mu_r) {
  const { pos, vel, omega } = state;
  const speed = Math.hypot(vel.x, vel.y);

  // Deceleration: a = - mu_r * g
  const decel = mu_r * PhysicsConfig.GRAVITY;

  // Stop threshold
  if (speed < 0.1) {
    return { pos, vel: { x: 0, y: 0, z: 0 }, omega: { x: 0, y: 0, z: 0 } };
  }

  const nx = vel.x / speed;
  const ny = vel.y / speed;

  let newSpeed = speed - decel * dt;
  if (newSpeed < 0) newSpeed = 0;

  const newVx = newSpeed * nx;
  const newVy = newSpeed * ny;

  // Position updates using average velocity (trapezoidal integration)
  const newPx = pos.x + (vel.x + newVx) * 0.5 * dt;
  const newPy = pos.y + (vel.y + newVy) * 0.5 * dt;

  // Pure rolling spin relation: omega = v / R
  const R = PhysicsConfig.BALL_RADIUS;
  const newOmegaX = newVy / R;
  const newOmegaY = -newVx / R;
  const newOmegaZ = 0;

  return {
    pos:   { x: newPx, y: newPy, z: R },
    vel:   { x: newVx, y: newVy, z: 0 },
    omega: { x: newOmegaX, y: newOmegaY, z: newOmegaZ },
  };
}

// ── Initial Launch State ─────────────────────────────────────
export function calcInitialState(p, startPos, clubForward) {
  const { v0, thetaDeg, phiDeg, backspinRPM, sidespinRPM } = p;
  const bs     = (backspinRPM  * 2 * Math.PI) / 60;
  const ss     = (sidespinRPM  * 2 * Math.PI) / 60;

  const x0 = startPos ? startPos.x : 0;
  const y0 = startPos ? startPos.y : 0;
  const z0 = startPos ? startPos.z : PhysicsConfig.BALL_RADIUS;

  let vx = 0, vy = 0, vz = 0;

  if (clubForward) {
    // Driven by the club head's forward vector at impact
    vx = clubForward.x * v0;
    vy = -clubForward.z * v0;
    vz = clubForward.y * v0;
  } else {
    // Fallback to slider values
    const thetaR = thetaDeg * Math.PI / 180;
    const phiR   = phiDeg   * Math.PI / 180;
    vx = v0 * Math.cos(thetaR) * Math.cos(phiR);
    vy = -v0 * Math.cos(thetaR) * Math.sin(phiR);
    vz = v0 * Math.sin(thetaR);
  }

  return {
    pos:   { x: x0, y: y0, z: z0 },
    vel:   { x: vx, y: vy, z: vz },
    omega: { x: ss, y: -bs, z: 0 },   // Negative backspin gives positive upward lift
  };
}

// ── Physics Engine Class ─────────────────────────────────────
export class PhysicsEngine {
  constructor(params, startPos, clubForward) {
    this.p          = params;
    this.rho        = calcAirDensity(params.temperature ?? 20, params.altitude ?? 0);
    this.wind       = { x: params.windX ?? 0, y: params.windY ?? 0, z: 0 };
    const gt        = PhysicsConfig.GROUND_TYPES[params.groundType] ?? PhysicsConfig.GROUND_TYPES.fairway;
    this.eGround    = gt.restitution;
    this.muRolling  = gt.rollingFriction;
    this.groundType = params.groundType ?? 'fairway';
    this.state      = calcInitialState(params, startPos, clubForward);
    this.trajectory = [{ ...this.state.pos }];
    this.time       = 0;
    this.phase      = 'flight';   // 'flight' | 'rolling' | 'stopped'
    this.inHole     = false;
    this.bounces    = 0;
    this.maxBounces = 6;
    this.landingPoint = null;
  }

  step(dt) {
    if (this.phase === 'stopped') return;

    if (this.phase === 'flight') {
      this.state = rk4Step(this.state, dt, this.rho, this.wind);
      this.time += dt;

      // Ground collision
      if (this.state.pos.z <= PhysicsConfig.BALL_RADIUS && this.bounces < this.maxBounces) {
        this.state = handleBounce(this.state, this.eGround, this.groundType);
        this.bounces++;
        if (!this.landingPoint && this.bounces === 1) {
          this.landingPoint = { ...this.state.pos };
        }
        if (Math.abs(this.state.vel.z) < 0.5) {
          this.state.pos.z  = PhysicsConfig.BALL_RADIUS;
          this.state.vel.z  = 0;
          this.phase        = 'rolling';
        }
      } else if (this.state.pos.z <= PhysicsConfig.BALL_RADIUS) {
        this.state.pos.z = PhysicsConfig.BALL_RADIUS;
        this.state.vel.z = 0;
        this.phase       = 'rolling';
        if (!this.landingPoint) {
          this.landingPoint = { ...this.state.pos };
        }
      }

      if (this.time > PhysicsConfig.MAX_TIME) this.phase = 'stopped';

    } else if (this.phase === 'rolling') {
      this.state = rollingStep(this.state, dt, this.muRolling);
      this.time += dt;
      if (this.state.vel.x === 0 && this.state.vel.y === 0) {
        this.phase = 'stopped';
      }
    }

    // Trajectory logging
    if (this.trajectory.length < 8000) {
      this.trajectory.push({ ...this.state.pos });
    }

    // Check hole entry (hole at x=170, y=0)
    if (!this.inHole) {
      const dx = this.state.pos.x - 170;
      const dy = this.state.pos.y;
      if (Math.hypot(dx, dy) < 0.6 && this.state.pos.z <= PhysicsConfig.BALL_RADIUS * 3) {
        this.inHole         = true;
        this.phase          = 'stopped';
        this.state.pos      = { x: 170, y: 0, z: -0.05 };
        this.state.vel      = { x: 0, y: 0, z: 0 };
      }
    }
  }

  update(deltaTime) {
    if (this.phase === 'stopped') return;
    const dt      = PhysicsConfig.TIME_STEP;
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
      landingX:  this.landingPoint ? this.landingPoint.x.toFixed(1) : null,
      landingY:  this.landingPoint ? this.landingPoint.y.toFixed(1) : null,
    };
  }
}