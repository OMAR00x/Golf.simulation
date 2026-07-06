// ============================================================
// Constants.js — Application Configuration Settings
// ============================================================

export const PhysicsSettings = {
  GRAVITY:          9.81,                                             // g (m/s²)
  BALL_MASS:        0.04593,                                          // m (kg)
  BALL_RADIUS:      0.02135,                                          // R (m)
  BALL_AREA:        Math.PI * 0.02135 ** 2,                           // A = pi * R² (m²)
  INERTIA:          (2 / 5) * 0.04593 * 0.02135 ** 2,                 // I = (2/5)*m*R² (kg*m²)
  TIME_STEP:        0.001,                                            // h (s) - RK4 step size
  MAX_TIME:         20,                                               // Maximum simulation time (s)
  KINETIC_FRICTION: 0.20,                                             // mu_k (dynamic friction during bounce)
  
  GROUND_TYPES: {
    green:   { restitution: 0.38, rollingFriction: 0.08, name: 'Green'   },
    fairway: { restitution: 0.30, rollingFriction: 0.16, name: 'Fairway'  },
    rough:   { restitution: 0.12, rollingFriction: 0.35, name: 'Rough'    },
    hardpan: { restitution: 0.45, rollingFriction: 0.06, name: 'Hardpan'  },
  }
};

export const TerrainSettings = {
  ROUGH_SIZE_X:    12000,
  ROUGH_SIZE_Z:    9000,
  ROUGH_SEG_X:     240,
  ROUGH_SEG_Z:     180,
  FAIRWAY_SIZE_X:  2400,
  FAIRWAY_SIZE_Z:  160,
  FAIRWAY_SEG_X:   120,
  FAIRWAY_SEG_Z:   20,
  HOLE_X:          170.0,
  PATH_SIZE_X:     8,
  PATH_SIZE_Z:     1600,
  PATH_SEG_X:      80,
  PATH_SEG_Z:      2,
};

export const CameraSettings = {
  AIM_DIST:       3.0,
  AIM_HEIGHT:     1.0,
  FOLLOW_DIST:    12.0,
  FOLLOW_HEIGHT:  3.5,
  MIN_CAMERA_Y:   0.4,
};

export const TreeSettings = {
  COUNT:      300,
  MIN_SCALE:  0.85,
  MAX_SCALE:  1.25,
};

export const GROUND_INFO = {
  green:   { label: 'Green',   color: '#4ecb71', desc: 'Putting green grass. Ball rolls smoothly.' },
  fairway: { label: 'Fairway',  color: '#6fcf8a', desc: 'Main cut fairway. Normal bounce and roll.' },
  rough:   { label: 'Rough',    color: '#b5cc55', desc: 'Long grass. Absorbs impact energy.' },
  hardpan: { label: 'Hardpan',  color: '#d4aa60', desc: 'Hard dry ground. Higher bounce, longer roll.' },
};
