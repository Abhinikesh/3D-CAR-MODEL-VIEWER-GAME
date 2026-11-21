/**
 * Driving Camera Utilities & Mathematical Transformations
 * Part 31: Third-Person Driving Camera and Follow System
 *
 * Provides:
 * - computeIdealCameraTransform: Pure mathematical evaluation of ideal camera pose
 * - dampCameraTransform: Frame-rate independent exponential smoothing
 * - computeOrbitSpringBack: Auto-centering spring decay for user glance/orbit
 * - clampOrbitAngles: Boundary clamping for limited user orbit
 */

import * as THREE from 'three';
import { DRIVING_CAMERA_CONFIG, DRIVING_CAMERA_MODES } from './drivingCameraConfig.js';

// Preallocated math scratch vectors to eliminate allocations inside the 60/120Hz render loop
const _forward = new THREE.Vector3();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _trailDir = new THREE.Vector3();
const _orbitRot = new THREE.Quaternion();
const _localOffset = new THREE.Vector3();

/**
 * Computes the ideal camera position, look target, and field-of-view for a given
 * vehicle state and driving camera mode.
 *
 * @param {THREE.Vector3} vehiclePos - Vehicle world position
 * @param {THREE.Quaternion} vehicleQuat - Vehicle world orientation
 * @param {number} speedLong - Vehicle longitudinal speed (m/s)
 * @param {string} modeId - Active camera mode ('chase' | 'close' | 'wide' | 'hood' | 'bumper' | etc.)
 * @param {{ azimuth: number, polar: number }} [orbitAngles] - Optional user glance/orbit offsets (radians)
 * @param {Object} [config] - Camera configuration
 * @returns {{ position: THREE.Vector3, target: THREE.Vector3, fov: number }}
 */
export function computeIdealCameraTransform(
  vehiclePos,
  vehicleQuat,
  speedLong = 0,
  modeId = DRIVING_CAMERA_MODES.CHASE,
  orbitAngles = { azimuth: 0, polar: 0 },
  config = DRIVING_CAMERA_CONFIG
) {
  const modes = config?.modes || DRIVING_CAMERA_CONFIG.modes;
  const modeCfg = modes[modeId] || modes[DRIVING_CAMERA_MODES.CHASE];

  const pos = new THREE.Vector3();
  const target = new THREE.Vector3();
  let fov = modeCfg.baseFov || 46.0;

  // Derive vehicle world directional axes: +Z = forward, +Y = up, +X = left
  _forward.set(0, 0, 1).applyQuaternion(vehicleQuat);
  _up.set(0, 1, 0).applyQuaternion(vehicleQuat);
  _right.set(1, 0, 0).applyQuaternion(vehicleQuat);

  const topSpeed = config?.referenceTopSpeedMs || 45.0;
  const speedRatio = Math.min(1.0, Math.max(0.0, Math.abs(speedLong) / topSpeed));

  if (
    modeId === DRIVING_CAMERA_MODES.CHASE ||
    modeId === DRIVING_CAMERA_MODES.CLOSE ||
    modeId === DRIVING_CAMERA_MODES.WIDE
  ) {
    // Dynamic speed-aware parameter scaling
    const dist = modeCfg.distance + (modeCfg.speedDistanceScale || 0) * speedRatio;
    const height = modeCfg.height + (modeCfg.speedHeightScale || 0) * speedRatio;
    const lookAhead = modeCfg.lookAhead + (modeCfg.speedLookAheadScale || 0) * speedRatio;
    fov = modeCfg.baseFov + (modeCfg.speedFovScale || 0) * speedRatio;

    // Trailing direction behind vehicle (-forward)
    _trailDir.copy(_forward).negate();

    // Apply limited user glance/orbit offsets around world Y and horizontal axis
    if (orbitAngles.azimuth !== 0 || orbitAngles.polar !== 0) {
      _orbitRot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), orbitAngles.azimuth);
      _trailDir.applyQuaternion(_orbitRot);
    }

    // Camera world position: vehicle position + trailing vector + elevation
    pos.copy(vehiclePos).addScaledVector(_trailDir, dist);
    pos.y += height;

    if (orbitAngles.polar !== 0) {
      pos.y += Math.sin(orbitAngles.polar) * dist * 0.5;
    }

    // Safety: ensure camera height stays above ground plane
    const minElev = config?.minCameraElevation ?? 0.25;
    if (pos.y < minElev) {
      pos.y = minElev;
    }

    // Camera look target: vehicle COM + target height + forward look-ahead
    target.copy(vehiclePos);
    target.y += modeCfg.targetHeight;
    target.addScaledVector(_forward, lookAhead);
  } else if (modeId === DRIVING_CAMERA_MODES.HOOD) {
    // Forward bonnet / cockpit view mounted on front hood
    fov = modeCfg.baseFov + (modeCfg.speedFovScale || 0) * speedRatio;

    _localOffset.fromArray(modeCfg.localPos).applyQuaternion(vehicleQuat);
    pos.copy(vehiclePos).add(_localOffset);

    _localOffset.fromArray(modeCfg.targetOffset).applyQuaternion(vehicleQuat);
    target.copy(vehiclePos).add(_localOffset);
  } else if (modeId === DRIVING_CAMERA_MODES.BUMPER) {
    // Low front splitter speed perspective
    fov = modeCfg.baseFov + (modeCfg.speedFovScale || 0) * speedRatio;

    _localOffset.fromArray(modeCfg.localPos).applyQuaternion(vehicleQuat);
    pos.copy(vehiclePos).add(_localOffset);

    _localOffset.fromArray(modeCfg.targetOffset).applyQuaternion(vehicleQuat);
    target.copy(vehiclePos).add(_localOffset);
  } else if (modeId === DRIVING_CAMERA_MODES.AERIAL) {
    // Fixed aerial overview
    pos.fromArray(modeCfg.fixedPos);
    target.fromArray(modeCfg.fixedTarget);
  } else if (modeId === DRIVING_CAMERA_MODES.TURN1 || modeId === DRIVING_CAMERA_MODES.HAIRPIN) {
    // Trackside spectator camera tracking vehicle
    pos.fromArray(modeCfg.fixedPos);
    if (modeCfg.trackVehicle) {
      target.copy(vehiclePos);
      target.y += 0.8;
    } else {
      target.fromArray(modeCfg.fixedTarget);
    }
  } else {
    // Fallback default
    pos.copy(vehiclePos).addScaledVector(_forward, -5.6);
    pos.y += 2.15;
    target.copy(vehiclePos).addScaledVector(_forward, 2.5);
    target.y += 0.90;
  }

  return { position: pos, target, fov };
}

/**
 * Performs frame-rate independent exponential damping on camera position, target, and FOV.
 * Uses exact analytical exponential decay: alpha = 1 - exp(-lambda * dt).
 *
 * @param {THREE.Vector3} currentPos - Current camera position
 * @param {THREE.Vector3} currentTarget - Current camera look target
 * @param {number} currentFov - Current camera FOV
 * @param {THREE.Vector3} idealPos - Target ideal position
 * @param {THREE.Vector3} idealTarget - Target ideal look target
 * @param {number} idealFov - Target ideal FOV
 * @param {number} dt - Frame delta time (seconds)
 * @param {number} posDamping - Position damping rate (1/s)
 * @param {number} rotDamping - Look target damping rate (1/s)
 * @returns {{ position: THREE.Vector3, target: THREE.Vector3, fov: number }}
 */
export function dampCameraTransform(
  currentPos,
  currentTarget,
  currentFov,
  idealPos,
  idealTarget,
  idealFov,
  dt,
  posDamping = 8.5,
  rotDamping = 10.0
) {
  // Clamped dt to prevent spiral on tab resume
  const safeDt = Math.min(0.1, Math.max(0.0001, dt));

  const alphaPos = Math.min(1.0, Math.max(0.0, 1.0 - Math.exp(-posDamping * safeDt)));
  const alphaRot = Math.min(1.0, Math.max(0.0, 1.0 - Math.exp(-rotDamping * safeDt)));

  currentPos.lerp(idealPos, alphaPos);
  currentTarget.lerp(idealTarget, alphaRot);
  const dampedFov = currentFov + (idealFov - currentFov) * alphaPos;

  return {
    position: currentPos,
    target: currentTarget,
    fov: dampedFov,
  };
}

/**
 * Computes smooth exponential spring-back return of orbit glance angles towards (0, 0).
 *
 * @param {{ azimuth: number, polar: number }} orbitAngles - Current user orbit angles (radians)
 * @param {number} dt - Delta time (seconds)
 * @param {number} returnSpeed - Spring decay rate (1/s)
 * @returns {{ azimuth: number, polar: number }}
 */
export function computeOrbitSpringBack(orbitAngles, dt, returnSpeed = 4.0) {
  const safeDt = Math.min(0.1, Math.max(0.0001, dt));
  const decay = Math.exp(-returnSpeed * safeDt);

  let newAzimuth = orbitAngles.azimuth * decay;
  let newPolar = orbitAngles.polar * decay;

  // Snapping deadzone for zero-cost rest
  if (Math.abs(newAzimuth) < 0.0005) newAzimuth = 0;
  if (Math.abs(newPolar) < 0.0005) newPolar = 0;

  return { azimuth: newAzimuth, polar: newPolar };
}

/**
 * Clamps user orbit angles to prevent disorienting flip or inverted viewing.
 *
 * @param {number} azimuth - Horizontal angle (radians)
 * @param {number} polar - Vertical angle (radians)
 * @param {number} maxAzimuth - Max horizontal angle limit (radians)
 * @param {number} maxPolar - Max vertical angle limit (radians)
 * @returns {{ azimuth: number, polar: number }}
 */
export function clampOrbitAngles(azimuth, polar, maxAzimuth, maxPolar) {
  return {
    azimuth: Math.max(-maxAzimuth, Math.min(maxAzimuth, azimuth)),
    polar: Math.max(-maxPolar, Math.min(maxPolar, polar)),
  };
}
