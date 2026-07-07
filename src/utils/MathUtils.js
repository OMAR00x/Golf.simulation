export function degreesToRadians(deg) {
  return deg * Math.PI / 180;
}

export function radiansToDegrees(rad) {
  return rad * 180 / Math.PI;
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function hypot3D(dx, dy, dz) {
  return Math.hypot(dx, dy, dz);
}
