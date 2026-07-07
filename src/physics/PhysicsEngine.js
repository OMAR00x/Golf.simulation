import { PhysicsSettings, TerrainSettings } from '../utils/Constants.js';

export function calcAirDensity(tempC, altitude) {
  const T0 = 288.15;
  const T  = tempC + 273.15;
  return 1.225 * (T0 / T) * Math.exp(-0.000118 * altitude);
}

function dynamicCd(vel, rho) {
  const speed = Math.hypot(vel.x, vel.y, vel.z);
  if (speed <= 0.1) return 0.47;

  const spinRatio = (PhysicsSettings.BALL_RADIUS * 2500 * 0.1047) / speed; 

  return 0.22 + 0.40 / (1.0 + speed * 0.1);
}

function liftCoeff(spinRatio) {
  if (spinRatio <= 0) return 0;
  return 0.25 * (1 - Math.exp(-4.5 * spinRatio));
}

function computeAccel(vel, omega, rho, wind) {
  const rv = { x: vel.x - wind.x, y: vel.y - wind.y, z: vel.z - wind.z };
  const speed = Math.hypot(rv.x, rv.y, rv.z);

  if (speed <= 0.0001) {
    return { ax: 0, ay: 0, az: -PhysicsSettings.GRAVITY, dOmX: 0, dOmY: 0, dOmZ: 0 };
  }

  const Cd = dynamicCd(rv, rho);
  const wMag = Math.hypot(omega.x, omega.y, omega.z);

  let Cl = 0;
  if (wMag > 0.1) {
    const spinRatio = (PhysicsSettings.BALL_RADIUS * wMag) / speed;
    Cl = liftCoeff(spinRatio);
  }

  const wMagVal = wMag > 0.0001 ? wMag : 1.0;
  const liftX = Cl * (omega.y * rv.z - omega.z * rv.y) / wMagVal;
  const liftY = Cl * (omega.z * rv.x - omega.x * rv.z) / wMagVal;
  const liftZ = Cl * (omega.x * rv.y - omega.y * rv.x) / wMagVal;

  const dragConst = -0.5 * rho * PhysicsSettings.BALL_AREA * speed / PhysicsSettings.BALL_MASS;
  const liftConst = 0.5 * rho * PhysicsSettings.BALL_AREA * speed / PhysicsSettings.BALL_MASS;

  const ax = (dragConst * Cd * rv.x) + (liftConst * liftX);
  const ay = (dragConst * Cd * rv.y) + (liftConst * liftY);
  const az = -PhysicsSettings.GRAVITY + (dragConst * Cd * rv.z) + (liftConst * liftZ);

  const Cm = 0.005;
  const spinDecayK = (rho * PhysicsSettings.BALL_RADIUS * PhysicsSettings.BALL_AREA * Cm * speed) /
                     (2 * PhysicsSettings.INERTIA);
  const dOmX = -spinDecayK * omega.x;
  const dOmY = -spinDecayK * omega.y;
  const dOmZ = -spinDecayK * omega.z;

  return { ax, ay, az, dOmX, dOmY, dOmZ };
}

function rk4Step(state, dt, rho, wind) {
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

export function calcInitialState(p, startPos, clubForward) {
  const { v0, thetaDeg, phiDeg, backspinRPM, sidespinRPM } = p;
  const bs     = (backspinRPM  * 2 * Math.PI) / 60;
  const ss     = (sidespinRPM  * 2 * Math.PI) / 60;

  const x0 = startPos ? startPos.x : 0;
  const y0 = startPos ? startPos.y : 0;
  const z0 = startPos ? startPos.z : PhysicsSettings.BALL_RADIUS;

  let vx = 0, vy = 0, vz = 0;

  if (clubForward) {
    vx = clubForward.x * v0;
    vy = -clubForward.z * v0;
    vz = clubForward.y * v0;
  } else {
    const thetaR = thetaDeg * Math.PI / 180;
    const phiR   = phiDeg   * Math.PI / 180;
    vx = v0 * Math.cos(thetaR) * Math.cos(phiR);
    vy = v0 * Math.cos(thetaR) * Math.sin(phiR);
    vz = v0 * Math.sin(thetaR);
  }

  return {
    pos:   { x: x0, y: y0, z: z0 },
    vel:   { x: vx, y: vy, z: vz },
    omega: { x: ss, y: -bs, z: 0 },
  };
}

export class PhysicsEngine {
  constructor(params, startPos, clubForward, heightCallback) {
    this.p          = params;
    this.heightCallback = heightCallback;
    this.rho        = calcAirDensity(params.temperature ?? 20, params.altitude ?? 0);
    this.wind = { x: params.windX ?? 0, y: params.windY ?? 0, z: 0 }

    const gt        = PhysicsSettings.GROUND_TYPES[params.groundType] ?? PhysicsSettings.GROUND_TYPES.fairway;
    this.eGround    = gt?.restitution ?? 0.5;
    this.muRolling  = gt?.rollingFriction ?? 0.1;
    this.groundType = params.groundType ?? 'fairway';

    this.state      = calcInitialState(params, startPos, clubForward);
    this.trajectory = [{ ...this.state.pos }];
    this.time       = 0;

    this.flightTime = 0;

    this.apexHeight = this.state.pos.z;
    this.apexDist   = 0;

    this.phase      = 'flight';   
    this.inHole     = false;
    this.bounces    = 0;
    this.maxBounces = 8;
    this.landingPoint = null;
  }

  rollingStepOnSlope(state, dt, groundInfo) {
    const { pos, vel } = state;
    const speed = Math.hypot(vel.x, vel.y);
    const R = PhysicsSettings.BALL_RADIUS;

    const normal = groundInfo.normal;
    const g = PhysicsSettings.GRAVITY;
    const mu_r = this.muRolling;

    const a_gx = g * normal.z * normal.x;
    const a_gy = g * normal.z * normal.y;

    const a_f_mag = mu_r * g * normal.z;

    let a_fx = 0;
    let a_fy = 0;

    if (speed > 0.01) {
      a_fx = -a_f_mag * (vel.x / speed);
      a_fy = -a_f_mag * (vel.y / speed);
    }

    const ax = a_gx + a_fx;
    const ay = a_gy + a_fy;

    let newVx = vel.x + ax * dt;
    let newVy = vel.y + ay * dt;
    let newSpeed = Math.hypot(newVx, newVy);

    if (newSpeed < 0.05 && Math.hypot(a_gx, a_gy) <= a_f_mag) {
      return {
        pos: { ...pos, z: groundInfo.height + R },
        vel: { x: 0, y: 0, z: 0 },
        omega: { x: 0, y: 0, z: 0 }
      };
    }

    const newPx = pos.x + (vel.x + newVx) * 0.5 * dt;
    const newPy = pos.y + (vel.y + newVy) * 0.5 * dt;

    const nextGroundInfo = this.heightCallback ? this.heightCallback(newPx, newPy) : { height: 0, normal: { x: 0, y: 0, z: 1 } };
    const groundH = nextGroundInfo.height;

    const groundH_old = groundInfo.height;
    if (groundH < groundH_old - 0.05 && newSpeed > 2.0) {
      this.phase = 'flight';
      return {
        pos: { x: newPx, y: newPy, z: groundH_old + R },
        vel: { x: newVx, y: newVy, z: 0 },
        omega: state.omega
      };
    }

    const newOmegaX = newVy / R;
    const newOmegaY = -newVx / R;
    const newOmegaZ = 0;

    return {
      pos: { x: newPx, y: newPy, z: groundH + R },
      vel: { x: newVx, y: newVy, z: 0 },
      omega: { x: newOmegaX, y: newOmegaY, z: newOmegaZ }
    };
  }

  step(dt) {
    if (this.phase === 'stopped') return;

    const R = PhysicsSettings.BALL_RADIUS;

    const groundInfo = this.heightCallback ? this.heightCallback(this.state.pos.x, this.state.pos.y) : { height: 0, normal: { x: 0, y: 0, z: 1 }, meshName: 'Default' };
    const groundH = groundInfo.height;
    const normal = groundInfo.normal;

    if (this.phase === 'flight') {
      const nextState = rk4Step(this.state, dt, this.rho, this.wind);

      if (nextState.pos.z > this.apexHeight) {
        this.apexHeight = nextState.pos.z;
        this.apexDist = Math.hypot(nextState.pos.x, nextState.pos.y);
      }

      this.flightTime += dt;

      const nextGroundInfo = this.heightCallback ? this.heightCallback(nextState.pos.x, nextState.pos.y) : { height: 0, normal: { x: 0, y: 0, z: 1 }, meshName: 'Default' };
      const nextGroundH = nextGroundInfo.height;

      if (nextState.pos.z <= nextGroundH + R) {
        this.bounces++;

        const impactNormal = nextGroundInfo.normal;

        if (!this.landingPoint) {
          this.landingPoint = { ...nextState.pos };
        }

        const vn = this.state.vel.x * impactNormal.x + this.state.vel.y * impactNormal.y + this.state.vel.z * impactNormal.z;

        if (vn < 0) {

          const vn_after = -this.eGround * vn;

          const vt_x = this.state.vel.x - vn * impactNormal.x;
          const vt_y = this.state.vel.y - vn * impactNormal.y;
          const vt_z = this.state.vel.z - vn * impactNormal.z;

          const frictionLoss = this.groundType === 'rough' ? 0.35 : 
                               this.groundType === 'green' ? 0.08 : 0.16;

          const vt_after_x = vt_x * (1 - frictionLoss);
          const vt_after_y = vt_y * (1 - frictionLoss);
          const vt_after_z = vt_z * (1 - frictionLoss);

          this.state.vel = {
            x: vt_after_x + vn_after * impactNormal.x,
            y: vt_after_y + vn_after * impactNormal.y,
            z: vt_after_z + vn_after * impactNormal.z
          };

          this.state.pos = {
            x: nextState.pos.x,
            y: nextState.pos.y,
            z: nextGroundH + R + 0.01
          };

          this.state.omega = {
            x: this.state.omega.x * 0.5,
            y: this.state.omega.y * 0.5,
            z: this.state.omega.z * 0.5
          };

          if (Math.abs(vn) < 0.65 || this.bounces >= this.maxBounces) {
            this.phase = 'rolling';
            this.state.pos.z = nextGroundH + R ;
            this.state.vel.z = 0;
          }
        } else {

          this.state = nextState;
        }
      } else {

        this.state = nextState;
      }

      this.time += dt;
      if (this.time > PhysicsSettings.MAX_TIME) this.phase = 'stopped';

    } else if (this.phase === 'rolling') {
      this.state = this.rollingStepOnSlope(this.state, dt, groundInfo);
      this.time += dt;

      const speed = Math.hypot(this.state.vel.x, this.state.vel.y);
      if (speed < 0.05) {
        this.phase = 'stopped';
        this.state.vel = { x: 0, y: 0, z: 0 };
        this.state.omega = { x: 0, y: 0, z: 0 };
      }
    }

    if (this.trajectory.length < 8000) {
      this.trajectory.push({ ...this.state.pos });
    }

    if (!this.inHole) {
      const dx = this.state.pos.x - TerrainSettings.HOLE_X;
      const dy = this.state.pos.y - (TerrainSettings.HOLE_Y ?? 0);
      if (Math.hypot(dx, dy) < 0.6 && this.state.pos.z <= groundH + R * 3) {
        this.inHole         = true;
        this.phase          = 'stopped';
        this.state.pos      = { x: TerrainSettings.HOLE_X, y: TerrainSettings.HOLE_Y ?? 0, z: groundH - 0.05 };
        this.state.vel      = { x: 0, y: 0, z: 0 };
      }
    }

    const minX = -680;
    const maxX = 1680;
    const minY = -78;
    const maxY = 78;

    if (this.state.pos.x < minX || this.state.pos.x > maxX || this.state.pos.y < minY || this.state.pos.y > maxY) {
      this.state.pos.x = Math.max(minX, Math.min(maxX, this.state.pos.x));
      this.state.pos.y = Math.max(minY, Math.min(maxY, this.state.pos.y));
      this.state.vel = { x: 0, y: 0, z: 0 };
      this.state.omega = { x: 0, y: 0, z: 0 };
      this.phase = 'stopped';
    }
  }

  update(deltaTime) {
    if (this.phase === 'stopped') return;
    const dt      = PhysicsSettings.TIME_STEP;
    let   remain  = Math.min(deltaTime, 0.05);
    let   steps   = 0;
    while (remain > 0 && this.phase !== 'stopped' && steps < 60) {
      this.step(Math.min(dt, remain));
      remain -= dt;
      steps++;
    }
  }

  getStats() {
    const last  = this.trajectory[this.trajectory.length - 1];
    const groundInfo = this.heightCallback ? this.heightCallback(last.x, last.y) : { height: 0 };

    return {
      distance:  Math.hypot(last.x, last.y).toFixed(1),
      maxHeight: (this.apexHeight - PhysicsSettings.BALL_RADIUS).toFixed(1),
      apexDist:  this.apexDist.toFixed(1),
      flightTime: this.flightTime.toFixed(2),
      totalTime:  this.time.toFixed(2),
      inHole:    this.inHole,
      landingX:  this.landingPoint ? this.landingPoint.x.toFixed(1) : null,
      landingY:  this.landingPoint ? this.landingPoint.y.toFixed(1) : null,
    };
  }
}