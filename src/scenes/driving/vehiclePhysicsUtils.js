import * as THREE from 'three';
import {
  ROAD_SURFACE_ELEVATION,
  HALF_ROAD_WIDTH,
  BARRIER_SEGMENTS,
  ROADSIDE_OBSTACLES,
  getRoadSurfaceQuery,
} from './roadData.js';

/**
 * Vehicle Physics Utility Functions & Math Primitives
 *
 * Provides optimized math routines for:
 * 1. Ground ray-casting and surface normal querying.
 * 2. Suspension spring-damper force calculation with Hooke's Law and viscous damping.
 * 3. Anti-roll bar coupling between opposing wheels on the same axle.
 * 4. Semi-implicit Euler integration with scratch object reuse (zero GC heap churn).
 * 5. Transform interpolation between previous and current physics ticks.
 */

// Scratch math instances to eliminate allocations in the 60Hz physics loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _qDelta = new THREE.Quaternion();
const _angVelQuat = new THREE.Quaternion();

/**
 * Evaluates the ground elevation, surface type, and normal at world coordinates (x, z).
 * Queries the 1,200m proving ground road spline:
 * - On the asphalt road (distToCenter <= 5.0m): elevation = 0.002m, surfaceType = 'asphalt'
 * - On the concrete shoulder / kerb (5.0m < distToCenter <= 5.5m): elevation = 0.002m, surfaceType = 'kerb'
 * - On the off-road grass terrain (distToCenter > 5.5m): elevation = 0.000m, surfaceType = 'grass'
 *
 * @param {number} x - World X position
 * @param {number} z - World Z position
 * @param {number|null} hintT - Optional track parameter hint for O(1) localized evaluation
 * @returns {{ elevation: number, normal: THREE.Vector3, isRoad: boolean, surfaceType: string, distToCenter: number, signedLateralDist: number, t: number, nx: number, nz: number }}
 */
export function getGroundHeightAt(x, z, hintT = null) {
  const query = getRoadSurfaceQuery(x, z, hintT);
  return {
    elevation: query.elevation,
    normal: new THREE.Vector3(0, 1, 0),
    isRoad: query.isRoad,
    surfaceType: query.surfaceType,
    distToCenter: query.distToCenter,
    signedLateralDist: query.signedLateralDist,
    t: query.t,
    nx: query.nx,
    nz: query.nz,
  };
}

/**
 * Calculates suspension force using Hooke's spring law and viscous damping.
 *
 * F_susp = max(0, k_s * compression + c_d * compressionVelocity)
 *
 * @param {number} compression - Suspension spring deflection from rest length (meters)
 * @param {number} compressionVelocity - Rate of suspension compression (m/s)
 * @param {Object} suspensionConfig - Spring stiffness and damping parameters
 * @returns {number} Normal force in Newtons
 */
export function computeSuspensionForce(compression, compressionVelocity, suspensionConfig) {
  const { springStiffness, dampingRate } = suspensionConfig;
  const springForce = springStiffness * compression;
  const dampingForce = dampingRate * compressionVelocity;
  // Suspension cannot pull the ground (unilateral contact condition)
  return Math.max(0, springForce + dampingForce);
}

/**
 * Calculates anti-roll bar torsional transfer force between left and right wheels.
 * If the left wheel is more compressed than the right, anti-roll pushes the right wheel down
 * and pulls the left wheel up, combating chassis body roll.
 *
 * @param {number} leftCompression - Left wheel spring deflection (m)
 * @param {number} rightCompression - Right wheel spring deflection (m)
 * @param {number} antiRollStiffness - Anti-roll bar stiffness (N/m)
 * @returns {number} Differential anti-roll force (N)
 */
export function computeAntiRollForce(leftCompression, rightCompression, antiRollStiffness) {
  return antiRollStiffness * (leftCompression - rightCompression);
}

/**
 * Advances the rigid body state by one fixed physics timestep using Semi-Implicit Euler.
 *
 * @param {Object} state - Current chassis state { position, quaternion, linearVelocity, angularVelocity }
 * @param {THREE.Vector3} totalForce - Net force vector accumulated on chassis (Newtons)
 * @param {THREE.Vector3} totalTorque - Net torque vector accumulated on chassis (N*m)
 * @param {number} dt - Fixed timestep in seconds (e.g. 1/60)
 * @param {Object} chassisConfig - Mass, moments of inertia, damping constants
 * @returns {Object} Updated chassis state
 */
export function integrateRigidBodyStep(state, totalForce, totalTorque, dt, chassisConfig) {
  const { mass, inertia, linearDamping, angularDamping } = chassisConfig;

  // 1. Linear acceleration: a = F / m
  const accelX = totalForce.x / mass;
  const accelY = totalForce.y / mass;
  const accelZ = totalForce.z / mass;

  // Update linear velocity with damping
  const dampFactorLin = Math.max(0, 1 - linearDamping * dt);
  const vx = (state.linearVelocity.x + accelX * dt) * dampFactorLin;
  const vy = (state.linearVelocity.y + accelY * dt) * dampFactorLin;
  const vz = (state.linearVelocity.z + accelZ * dt) * dampFactorLin;

  // Update position: p = p + v * dt
  const px = state.position.x + vx * dt;
  const py = state.position.y + vy * dt;
  const pz = state.position.z + vz * dt;

  // 2. Angular acceleration: alpha = T / I
  const angAccelX = totalTorque.x / inertia.ixx;
  const angAccelY = totalTorque.y / inertia.iyy;
  const angAccelZ = totalTorque.z / inertia.izz;

  // Update angular velocity with damping
  const dampFactorAng = Math.max(0, 1 - angularDamping * dt);
  const wx = (state.angularVelocity.x + angAccelX * dt) * dampFactorAng;
  const wy = (state.angularVelocity.y + angAccelY * dt) * dampFactorAng;
  const wz = (state.angularVelocity.z + angAccelZ * dt) * dampFactorAng;

  // 3. Quaternion integration: q_new = normalize(q + 0.5 * dt * [w, 0] * q)
  _angVelQuat.set(wx, wy, wz, 0);
  _qDelta.copy(_angVelQuat).multiply(state.quaternion);

  const qx = state.quaternion.x + 0.5 * dt * _qDelta.x;
  const qy = state.quaternion.y + 0.5 * dt * _qDelta.y;
  const qz = state.quaternion.z + 0.5 * dt * _qDelta.z;
  const qw = state.quaternion.w + 0.5 * dt * _qDelta.w;

  const qLength = Math.hypot(qx, qy, qz, qw);
  const invLen = qLength > 0 ? 1 / qLength : 1;

  state.position.set(px, py, pz);
  state.quaternion.set(qx * invLen, qy * invLen, qz * invLen, qw * invLen);
  state.linearVelocity.set(vx, vy, vz);
  state.angularVelocity.set(wx, wy, wz);

  return state;
}

/**
 * Linearly interpolates between previous and current physics transforms for smooth rendering.
 *
 * @param {THREE.Vector3} prevPos - Position at start of physics step
 * @param {THREE.Vector3} currPos - Position at end of physics step
 * @param {THREE.Quaternion} prevRot - Quaternion at start of physics step
 * @param {THREE.Quaternion} currRot - Quaternion at end of physics step
 * @param {number} alpha - Interpolation factor in [0, 1]
 * @param {THREE.Vector3} targetPos - Out vector receiving interpolated position
 * @param {THREE.Quaternion} targetRot - Out quaternion receiving interpolated orientation
 */
export function interpolatePhysicsTransform(prevPos, currPos, prevRot, currRot, alpha, targetPos, targetRot) {
  targetPos.lerpVectors(prevPos, currPos, alpha);
  targetRot.copy(prevRot).slerp(currRot, alpha);
}

// ─── Part 27: Longitudinal Dynamics & Drivetrain Physics ───

/**
 * Calculates progressive tractive drive force (Newtons) based on throttle input and current speed.
 * Uses a power-curve model: high torque off the line tapering off smoothly towards maximum speed.
 *
 * @param {number} throttle - Normalized throttle pedal [0, 1]
 * @param {number} speedLong - Current longitudinal velocity (m/s, positive = forward)
 * @param {string} gear - Active transmission gear ('D' or 'R')
 * @param {Object} drivetrainConfig - Drivetrain parameters from vehiclePhysicsConfig
 * @returns {number} Net tractive drive force (N, signed along vehicle forward vector)
 */
export function computeDriveForce(throttle, speedLong, gear, drivetrainConfig) {
  if (throttle <= 0.001) return 0.0;

  const { maxDriveForce, maxReverseForce, maxSpeedForward, maxSpeedReverse } = drivetrainConfig;

  if (gear === 'R') {
    // Reverse drive: force is negative (along -Z)
    const revSpeed = Math.max(0, -speedLong);
    if (revSpeed >= maxSpeedReverse) return 0.0;

    const speedRatio = Math.min(1.0, revSpeed / maxSpeedReverse);
    const powerCurve = Math.max(0.0, 1.0 - Math.pow(speedRatio, 1.4));
    return -throttle * maxReverseForce * powerCurve;
  }

  // Forward Drive: force is positive (along +Z)
  const fwdSpeed = Math.max(0, speedLong);
  if (fwdSpeed >= maxSpeedForward) return 0.0;

  const speedRatio = Math.min(1.0, fwdSpeed / maxSpeedForward);
  const powerCurve = Math.max(0.0, 1.0 - Math.pow(speedRatio, 1.4));
  return throttle * maxDriveForce * powerCurve;
}

/**
 * Calculates progressive service braking force (Newtons) opposing longitudinal velocity.
 * Implements a non-reversing stop clamp: when vehicle speed is within one timestep of zero,
 * the force is clamped to bring the vehicle to an exact halt without reverse overshoot or vibration.
 *
 * @param {number} brakeInput - Normalized brake pedal [0, 1]
 * @param {number} speedLong - Current longitudinal velocity (m/s)
 * @param {number} dt - Physics simulation timestep (s)
 * @param {number} mass - Vehicle mass (kg)
 * @param {Object} drivetrainConfig - Drivetrain parameters
 * @returns {number} Braking force (N, opposing direction of speedLong)
 */
export function computeBrakeForce(brakeInput, speedLong, dt, mass, drivetrainConfig) {
  if (brakeInput <= 0.001 || Math.abs(speedLong) <= 0.0001) return 0.0;

  const { maxBrakeForce } = drivetrainConfig;
  const targetBrakeMag = brakeInput * maxBrakeForce;

  // Maximum force that would decelerate the vehicle to exactly 0 m/s in this timestep
  const maxStopForce = (Math.abs(speedLong) * mass) / dt;

  if (targetBrakeMag >= maxStopForce) {
    // Perfect stop clamp: bring speed to exactly 0 m/s without reversing direction
    return -Math.sign(speedLong) * maxStopForce;
  }

  return -Math.sign(speedLong) * targetBrakeMag;
}

/**
 * Calculates aerodynamic drag force (Newtons) opposing direction of motion.
 * F_drag = 0.5 * rho * C_d * A * v^2
 *
 * @param {number} speedLong - Longitudinal velocity (m/s)
 * @param {Object} drivetrainConfig - Aerodynamic parameters
 * @returns {number} Drag force (N, opposing direction of speedLong)
 */
export function computeAerodynamicDrag(speedLong, drivetrainConfig) {
  if (Math.abs(speedLong) <= 0.001) return 0.0;
  const { aerodynamicDragCoeff } = drivetrainConfig;
  return -aerodynamicDragCoeff * speedLong * Math.abs(speedLong);
}

/**
 * Calculates tire rolling resistance force (Newtons) on asphalt.
 * F_roll = C_rr * m * g
 * Includes coasting stop clamp to bring slowly rolling vehicles to a complete rest.
 *
 * @param {number} speedLong - Longitudinal velocity (m/s)
 * @param {number} normalWeight - Total vehicle gravitational weight (N = m * g)
 * @param {number} dt - Physics simulation timestep (s)
 * @param {number} mass - Vehicle mass (kg)
 * @param {Object} drivetrainConfig - Drivetrain parameters
 * @returns {number} Rolling resistance force (N, opposing direction of speedLong)
 */
export function computeRollingResistance(speedLong, normalWeight, dt, mass, drivetrainConfig) {
  if (Math.abs(speedLong) <= 0.0001) return 0.0;

  const { rollingResistanceCoeff } = drivetrainConfig;
  const rollMag = rollingResistanceCoeff * normalWeight;

  // Coasting stop clamp: if rolling resistance exceeds speed in this timestep, clamp to 0
  const maxStopForce = (Math.abs(speedLong) * mass) / dt;
  if (rollMag >= maxStopForce) {
    return -Math.sign(speedLong) * maxStopForce;
  }

  return -Math.sign(speedLong) * rollMag;
}

// ─── Part 28: Steering Kinematics, Ackermann Geometry & Tire Lateral Dynamics ───

/**
 * Calculates dynamic speed-sensitive steering angle limit in radians.
 * As forward speed increases, the maximum allowable steering angle smoothly scales down
 * from maxSteeringAngleLow (30 deg at <= 18 km/h) to maxSteeringAngleHigh (12 deg at >= 216 km/h).
 * This prevents catastrophic rollover and high-speed spinouts while preserving full agility at parking speeds.
 *
 * @param {number} speedLong - Vehicle longitudinal speed (m/s)
 * @param {Object} steeringConfig - Steering parameters from VEHICLE_PHYSICS_CONFIG
 * @returns {number} Maximum steering angle in radians for the current speed
 */
export function computeSpeedSensitiveSteerLimit(speedLong, steeringConfig) {
  const speed = Math.abs(speedLong || 0);
  const { maxSteeringAngleLow, maxSteeringAngleHigh, steerSpeedScale } = steeringConfig;
  const speedRatio = speed / steerSpeedScale;
  return maxSteeringAngleHigh + (maxSteeringAngleLow - maxSteeringAngleHigh) / (1.0 + speedRatio * speedRatio);
}

/**
 * Computes Ackermann steering angles for Front-Left and Front-Right wheels.
 * Eliminates tire scrub in turns by ensuring the inner wheel turns through a larger
 * angle than the outer wheel, matching their distinct turning radii.
 *
 * @param {number} centralSteer - Central road steering angle in radians (positive = Left, negative = Right)
 * @param {Object} steeringConfig - Steering configuration containing wheelbase and front track width
 * @returns {{ steerFL: number, steerFR: number, centralSteer: number }}
 */
export function computeAckermannSteeringAngles(centralSteer, steeringConfig) {
  if (Math.abs(centralSteer) <= 1e-5) {
    return { steerFL: 0.0, steerFR: 0.0, centralSteer: 0.0 };
  }

  const { wheelbase, trackWidthFront } = steeringConfig;
  const halfTrack = trackWidthFront * 0.5;
  const absSteer = Math.abs(centralSteer);
  const tanSteer = Math.tan(absSteer);

  // Turn radius to vehicle centerline
  const radiusCenter = wheelbase / tanSteer;

  // Turn radius for inner and outer wheels
  const radiusInner = Math.max(0.2, radiusCenter - halfTrack);
  const radiusOuter = radiusCenter + halfTrack;

  const angleInner = Math.atan(wheelbase / radiusInner);
  const angleOuter = Math.atan(wheelbase / radiusOuter);

  if (centralSteer > 0) {
    // Left Turn: FL is inner wheel (turns sharper), FR is outer wheel
    return {
      steerFL: angleInner,
      steerFR: angleOuter,
      centralSteer,
    };
  } else {
    // Right Turn: FR is inner wheel (turns sharper), FL is outer wheel
    return {
      steerFL: -angleOuter,
      steerFR: -angleInner,
      centralSteer,
    };
  }
}

/**
 * Computes lateral tire cornering forces and resulting yaw torque acting on the vehicle chassis.
 *
 * Kinematic & Dynamic Principles:
 * 1. Stationary Stability: At standstill (|v_long| < stationarySpeedThreshold), lateral tire forces scale to zero.
 *    Steering turns the wheels visually without causing the stationary car to slide or spin in place.
 * 2. Slip Angles: Front and rear slip angles alpha_f and alpha_r are derived from vehicle lateral velocity,
 *    yaw angular rate, and wheel steering angles.
 * 3. Tire Force Saturation: Uses a continuous hyperbolic tangent tire model with maximum grip limit mu * F_z.
 * 4. Yaw Torque: tau_yaw = a * F_y,front * cos(delta) - b * F_y,rear, producing authentic directional turning and damping.
 *
 * @param {number} speedLong - Vehicle longitudinal velocity (m/s)
 * @param {number} speedLat - Vehicle lateral velocity (m/s, along vehicle local +X left axis)
 * @param {number} yawRate - Vehicle yaw angular velocity (rad/s, positive = counter-clockwise left)
 * @param {number} centralSteer - Active steering angle in radians (positive = Left)
 * @param {{ front: number, rear: number }} normalLoads - Normal vertical load on front and rear axles (N)
 * @param {number} dt - Physics timestep (s)
 * @param {Object} steeringConfig - Steering and tire parameters
 * @returns {{
 *   latForceFront: number,
 *   latForceRear: number,
 *   totalLatForce: number,
 *   yawTorque: number,
 *   slipAngleFront: number,
 *   slipAngleRear: number
 * }}
 */
export function computeTireLateralForces(speedLong, speedLat, yawRate, centralSteer, normalLoads, dt, steeringConfig) {
  const speedMag = Math.abs(speedLong);
  const {
    distComToFrontAxle,
    distComToRearAxle,
    corneringStiffnessFront,
    corneringStiffnessRear,
    tireFrictionCoeff,
    stationarySpeedThreshold,
    slipAngleEpsilon,
  } = steeringConfig;

  // 1. Stationary stability clamp: scale forces to zero as speed approaches zero
  const speedFactor = Math.min(1.0, speedMag / stationarySpeedThreshold);
  if (speedFactor <= 0.001) {
    return {
      latForceFront: 0.0,
      latForceRear: 0.0,
      totalLatForce: 0.0,
      yawTorque: 0.0,
      slipAngleFront: 0.0,
      slipAngleRear: 0.0,
    };
  }

  // 2. Lateral velocity of front and rear axle contact points
  const a = distComToFrontAxle;
  const b = distComToRearAxle;
  const vLatFront = speedLat + a * yawRate;
  const vLatRear = speedLat - b * yawRate;

  // 3. Tire slip angles (radians)
  const denom = speedMag + slipAngleEpsilon;
  // Account for reverse driving direction
  const steerSign = speedLong >= 0 ? 1 : -1;
  const slipAngleFront = Math.atan2(vLatFront, denom) - steerSign * centralSteer;
  const slipAngleRear = Math.atan2(vLatRear, denom);

  // 4. Maximum available lateral grip per axle under current vertical load: F_y,max = mu * F_z
  const maxGripFront = tireFrictionCoeff * Math.max(100, normalLoads.front);
  const maxGripRear = tireFrictionCoeff * Math.max(100, normalLoads.rear);

  // 5. Cornering force with progressive saturation: F_y = -speedFactor * maxGrip * tanh((C_alpha * alpha) / maxGrip)
  const latForceFront = -speedFactor * maxGripFront * Math.tanh((corneringStiffnessFront * slipAngleFront) / maxGripFront);
  const latForceRear = -speedFactor * maxGripRear * Math.tanh((corneringStiffnessRear * slipAngleRear) / maxGripRear);

  // 6. Total lateral force and yaw torque on chassis
  const totalLatForce = latForceFront * Math.cos(centralSteer) + latForceRear;
  const yawTorque = a * latForceFront * Math.cos(centralSteer) - b * latForceRear;

  return {
    latForceFront,
    latForceRear,
    totalLatForce,
    yawTorque,
    slipAngleFront,
    slipAngleRear,
  };
}

// ─── Part 29: Physics-Driven Wheel Rotation & Visual Suspension Integration ───

/**
 * Computes individual ground surface speeds for all four wheels (m/s).
 * Incorporates differential turning kinematics: outer wheels cover a longer arc distance
 * and roll faster, while inner wheels cover a shorter arc distance and roll slower.
 *
 * @param {number} speedLong - Vehicle longitudinal velocity (m/s)
 * @param {number} yawRate - Vehicle yaw angular velocity (rad/s)
 * @param {number} steerFL - Front-Left Ackermann steer angle (rad)
 * @param {number} steerFR - Front-Right Ackermann steer angle (rad)
 * @param {Object} steeringConfig - Geometry config containing trackWidthFront and trackWidthRear
 * @returns {{ fl: number, fr: number, rl: number, rr: number }}
 */
export function computePhysicsWheelSpeeds(speedLong, yawRate, steerFL, steerFR, steeringConfig) {
  const halfWf = steeringConfig.trackWidthFront * 0.5;
  const halfWr = steeringConfig.trackWidthRear * 0.5;

  // Differential velocity at each wheel contact patch
  // In our coordinate system, +yawRate turns Left, so Right wheels are on the outside of the turn
  const vFL = (speedLong - halfWf * yawRate) * Math.cos(steerFL || 0);
  const vFR = (speedLong + halfWf * yawRate) * Math.cos(steerFR || 0);
  const vRL = speedLong - halfWr * yawRate;
  const vRR = speedLong + halfWr * yawRate;

  return { fl: vFL, fr: vFR, rl: vRL, rr: vRR };
}

/**
 * Computes incremental physical wheel roll rotation angle delta in radians.
 * Derived from the fundamental kinematic relation: delta_theta = delta_s / R_tire = (v * dt) / R_tire.
 *
 * @param {number} wheelSpeed - Linear ground speed of the wheel (m/s)
 * @param {number} dt - Timestep in seconds
 * @param {number} tireRadius - Physical tire outer rolling radius in meters (0.36065m)
 * @returns {number} Incremental roll angle in radians (signed)
 */
export function computePhysicsWheelRollDelta(wheelSpeed, dt, tireRadius = 0.36065) {
  if (Math.abs(wheelSpeed) <= 0.0001) return 0.0;
  return (wheelSpeed * dt) / tireRadius;
}

/**
 * Computes dynamic visual suspension vertical deflection offset (meters).
 * Compares current suspension compression against resting gravity equilibrium compression.
 * Clamps within physical bump-stop and droop limits to prevent fender clipping.
 *
 * @param {number} compression - Current suspension spring compression deflection (m)
 * @param {number} settledCompression - Baseline resting equilibrium compression (m)
 * @param {number} maxTravel - Maximum allowable visual travel deflection clamp (m)
 * @returns {number} Visual displacement along wheel vertical axis (meters, positive = bump/up)
 */
export function computeVisualSuspensionDeflection(compression, settledCompression, maxTravel = 0.040) {
  const dynamicOffset = (compression || 0) - (settledCompression || 0);
  return Math.max(-maxTravel, Math.min(maxTravel, dynamicOffset));
}

// ─── Part 30: Road Boundaries, Vehicle Collision Detection & Recovery ───

/**
 * Evaluates surface friction and rolling resistance properties for a given surface type.
 *
 * @param {string} surfaceType - 'asphalt' | 'kerb' | 'grass'
 * @param {Object} collisionConfig - Configuration containing surfaces definition
 * @returns {{ frictionCoeff: number, rollingResistanceCoeff: number, elevation: number, isOffRoad: boolean }}
 */
export function computeSurfaceProperties(surfaceType, collisionConfig) {
  const surfaces = collisionConfig?.surfaces;
  const cfg = surfaces?.[surfaceType] || surfaces?.asphalt || {
    frictionCoeff: 1.15,
    rollingResistanceCoeff: 0.015,
    elevation: 0.002,
  };
  return {
    frictionCoeff: cfg.frictionCoeff,
    rollingResistanceCoeff: cfg.rollingResistanceCoeff,
    elevation: cfg.elevation,
    isOffRoad: surfaceType === 'grass',
  };
}

/**
 * Computes average effective tire-road adhesion and rolling resistance across all 4 wheels.
 * If wheels leave the road onto grass, grip is reduced and rolling resistance increases proportionally.
 *
 * @param {Object} wheelSurfaces - Object mapping { fl, fr, rl, rr } to surface types
 * @param {Object} collisionConfig - Collision configuration
 * @returns {{ effectiveFriction: number, effectiveRollingResistance: number, offRoadWheelCount: number, isVehicleOffRoad: boolean }}
 */
export function computeEffectiveVehicleSurface(wheelSurfaces, collisionConfig) {
  const keys = ['fl', 'fr', 'rl', 'rr'];
  let totalFriction = 0;
  let totalRollingResistance = 0;
  let offRoadCount = 0;

  keys.forEach((k) => {
    const sType = wheelSurfaces?.[k] || 'asphalt';
    const props = computeSurfaceProperties(sType, collisionConfig);
    totalFriction += props.frictionCoeff;
    totalRollingResistance += props.rollingResistanceCoeff;
    if (props.isOffRoad) {
      offRoadCount++;
    }
  });

  const isOffRoad = offRoadCount >= 2;
  const primarySurface = isOffRoad
    ? 'grass'
    : (keys.some((k) => wheelSurfaces?.[k] === 'kerb') ? 'kerb' : 'asphalt');

  return {
    effectiveFriction: totalFriction / 4,
    effectiveRollingResistance: totalRollingResistance / 4,
    offRoadWheelCount: offRoadCount,
    isVehicleOffRoad: isOffRoad,
    isOffRoad,
    primarySurface,
  };
}

// Scratch math instances for collision routines to eliminate allocations
const _cornerWorld = new THREE.Vector3();
const _rotMat = new THREE.Matrix4();
const _colNormal = new THREE.Vector3();
const _contactPt = new THREE.Vector3();
const _rContact = new THREE.Vector3();
const _vContact = new THREE.Vector3();
const _deltaV = new THREE.Vector3();
const _deltaVt = new THREE.Vector3();

/**
 * Checks for vehicle collisions against:
 * 1. Active Armco steel guardrails along defined barrier segments (at 6.25m from centerline).
 * 2. Static roadside obstacles (distance countdown boards, chevron posts, lighting poles).
 * 3. Perimeter boundary limits on open verge sections (18.0m from centerline).
 *
 * @param {THREE.Vector3} vehiclePos - Vehicle world position
 * @param {THREE.Quaternion} vehicleQuat - Vehicle world orientation
 * @param {THREE.Vector3} vehicleVelocity - Vehicle linear velocity
 * @param {THREE.Vector3} vehicleAngularVelocity - Vehicle angular velocity
 * @param {Object} collisionConfig - Collision geometry and physical thresholds
 * @param {number|null} hintT - Track parameter hint for localized querying
 * @returns {{ hasCollision: boolean, maxPenetration: number, contactPoint: THREE.Vector3, normal: THREE.Vector3, type: string, objectId: string, impactVelocity: number }|null}
 */
export function checkVehicleCollision(
  vehiclePos,
  vehicleQuat,
  vehicleVelocity,
  vehicleAngularVelocity,
  collisionConfig,
  hintT = null
) {
  _rotMat.makeRotationFromQuaternion(vehicleQuat);
  const contactPoints = collisionConfig?.contactPoints || [
    { id: 'bumper_fl', pos: [0.95, 0.35, 2.25] },
    { id: 'bumper_fr', pos: [-0.95, 0.35, 2.25] },
    { id: 'bumper_rl', pos: [0.95, 0.35, -2.25] },
    { id: 'bumper_rr', pos: [-0.95, 0.35, -2.25] },
  ];

  const barrierRailInset = collisionConfig?.barrierRailInset || 6.25;
  const perimeterDist = collisionConfig?.perimeterBoundaryDist || 18.0;

  let maxPenetration = 0;
  let bestContact = null;

  // 1. Check Vehicle Collision Contact Points against Road Boundaries & Barriers
  for (let i = 0; i < contactPoints.length; i++) {
    const cp = contactPoints[i];
    _cornerWorld.fromArray(cp.pos).applyMatrix4(_rotMat).add(vehiclePos);

    const sq = getRoadSurfaceQuery(_cornerWorld.x, _cornerWorld.z, hintT);
    const signedLat = sq.signedLateralDist;
    const absLat = Math.abs(signedLat);
    const side = signedLat >= 0 ? 1 : -1; // 1 = Right, -1 = Left

    // Check if this track parameter t falls in an active guardrail run on this side
    const inBarrierSeg = BARRIER_SEGMENTS.find((seg) => {
      if (seg.side !== side) return false;
      if (seg.startT <= seg.endT) {
        return sq.t >= seg.startT && sq.t <= seg.endT;
      } else {
        return sq.t >= seg.startT || sq.t <= seg.endT;
      }
    });

    if (inBarrierSeg && absLat > barrierRailInset) {
      const penetration = absLat - barrierRailInset;
      if (penetration > maxPenetration) {
        maxPenetration = penetration;
        _colNormal.set(-side * sq.nx, 0, -side * sq.nz).normalize();
        _contactPt.copy(_cornerWorld);

        bestContact = {
          hasCollision: true,
          type: 'barrier',
          objectId: inBarrierSeg.id,
          maxPenetration: penetration,
          contactPoint: _contactPt.clone(),
          normal: _colNormal.clone(),
        };
      }
    } else if (absLat > perimeterDist) {
      const penetration = absLat - perimeterDist;
      if (penetration > maxPenetration) {
        maxPenetration = penetration;
        _colNormal.set(-side * sq.nx, 0, -side * sq.nz).normalize();
        _contactPt.copy(_cornerWorld);

        bestContact = {
          hasCollision: true,
          type: 'boundary',
          objectId: 'perimeter_boundary',
          maxPenetration: penetration,
          contactPoint: _contactPt.clone(),
          normal: _colNormal.clone(),
        };
      }
    }
  }

  // 2. Check Static Roadside Obstacles (Countdown boards, chevrons, poles)
  const obstacles = ROADSIDE_OBSTACLES;
  const boundingRad = collisionConfig?.boundingRadius || 2.48;
  for (let j = 0; j < obstacles.length; j++) {
    const obs = obstacles[j];
    const ox = obs.pos[0];
    const oz = obs.pos[2];
    const rObs = obs.radius || 0.45;

    // Broadphase test against vehicle center
    const distCenter = Math.hypot(vehiclePos.x - ox, vehiclePos.z - oz);
    if (distCenter > boundingRad + rObs) continue;

    // Narrowphase check against contact points
    for (let i = 0; i < contactPoints.length; i++) {
      const cp = contactPoints[i];
      _cornerWorld.fromArray(cp.pos).applyMatrix4(_rotMat).add(vehiclePos);
      const distPt = Math.hypot(_cornerWorld.x - ox, _cornerWorld.z - oz);
      const minDist = rObs + 0.15;

      if (distPt < minDist) {
        const penetration = minDist - distPt;
        if (penetration > maxPenetration) {
          maxPenetration = penetration;
          const nx = distPt > 0.001 ? (_cornerWorld.x - ox) / distPt : 0;
          const nz = distPt > 0.001 ? (_cornerWorld.z - oz) / distPt : 1;
          _colNormal.set(nx, 0, nz).normalize();
          _contactPt.copy(_cornerWorld);

          bestContact = {
            hasCollision: true,
            type: 'obstacle',
            objectId: obs.id,
            maxPenetration: penetration,
            contactPoint: _contactPt.clone(),
            normal: _colNormal.clone(),
          };
        }
      }
    }
  }

  if (bestContact) {
    _rContact.subVectors(bestContact.contactPoint, vehiclePos);
    _vContact.crossVectors(vehicleAngularVelocity, _rContact).add(vehicleVelocity);
    bestContact.impactVelocity = Math.abs(_vContact.dot(bestContact.normal));
  }

  return bestContact;
}

/**
 * Resolves vehicle collision response via position separation, restitution impulse,
 * barrier tangential scrubbing friction, and restoring angular torque.
 *
 * @param {Object} sim - Physical simulation state object
 * @param {Object} col - Collision detection result from checkVehicleCollision
 * @param {number} dt - Timestep in seconds
 * @param {Object} collisionConfig - Collision configuration
 * @param {Object} chassisConfig - Chassis mass and moment of inertia configuration
 */
export function resolveVehicleCollisionResponse(sim, col, dt, collisionConfig, chassisConfig) {
  if (!col || !col.hasCollision) return;

  const { normal, maxPenetration, contactPoint } = col;
  const mass = chassisConfig.mass || 1450;
  const iyy = chassisConfig.inertia?.iyy || 2971;
  const restitution = collisionConfig.barrierRestitution ?? 0.18;
  const barrierFriction = collisionConfig.barrierFriction ?? 0.45;
  const angularDamping = collisionConfig.collisionAngularDamping ?? 0.75;

  // 1. Position Separation: Eliminate penetration along inward normal
  const separation = Math.max(0, maxPenetration);
  sim.position.x += normal.x * separation;
  sim.position.z += normal.z * separation;

  // 2. Relative Contact Point Velocity: v_c = v + omega x r
  _rContact.subVectors(contactPoint, sim.position);
  _vContact.crossVectors(sim.angularVelocity, _rContact).add(sim.linearVelocity);

  const vn = _vContact.dot(normal);

  // Only apply impulse if moving into the collision surface (vn < 0)
  if (vn < -0.01) {
    // Effective mass including rotational inertia around vertical yaw axis
    const rxn = _rContact.x * normal.z - _rContact.z * normal.x;
    const invMass = 1 / mass;
    const invInertia = (rxn * rxn) / iyy;
    const effectiveMass = 1 / (invMass + invInertia);

    // Normal impulse magnitude (with restitution e)
    const jn = -(1 + restitution) * vn * effectiveMass;

    // Apply linear velocity impulse along normal
    _deltaV.copy(normal).multiplyScalar(jn / mass);
    sim.linearVelocity.add(_deltaV);

    // Apply angular velocity impulse around yaw axis
    const torqueY = rxn * jn;
    const deltaOmegaY = (torqueY / iyy) * angularDamping;
    sim.angularVelocity.y += deltaOmegaY;

    // 3. Tangential Friction Scrub (Energy dissipation along the barrier rail)
    _deltaVt.copy(_vContact).sub(normal.clone().multiplyScalar(vn));
    const speedTangential = _deltaVt.length();

    if (speedTangential > 0.05) {
      const frictionImpulseMax = barrierFriction * jn;
      const frictionImpulseActual = Math.min(frictionImpulseMax, mass * speedTangential * 0.5);
      _deltaVt.normalize().multiplyScalar(-frictionImpulseActual / mass);
      sim.linearVelocity.add(_deltaVt);
    }

    // Stabilize angular velocity to prevent violent spinouts
    sim.angularVelocity.y = Math.max(-2.5, Math.min(2.5, sim.angularVelocity.y));
  }
}

/**
 * Resets the vehicle simulation state to initial spawn conditions cleanly.
 * Restores position, orientation, zeroes all velocities, resets steering and wheel transforms,
 * and pre-settles suspension compressions to resting equilibrium.
 *
 * @param {Object} sim - Physical simulation state
 * @param {Object} spawnConfig - Spawn position, rotation, heading
 * @param {Object} chassisConfig - Chassis configuration
 * @param {Object} suspConfig - Suspension configuration
 * @param {Object} wheelKinematics - Wheel kinematics configuration
 */
export function resetVehiclePhysicsState(sim, spawnConfig, chassisConfig, suspConfig, wheelKinematics) {
  const initialPos = new THREE.Vector3(...spawnConfig.position);
  const initialRot = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(spawnConfig.rotation[0], spawnConfig.rotation[1], spawnConfig.rotation[2], 'YXZ')
  );

  sim.position.copy(initialPos);
  sim.quaternion.copy(initialRot);
  sim.prevPosition.copy(initialPos);
  sim.prevQuaternion.copy(initialRot);
  sim.linearVelocity.set(0, 0, 0);
  sim.angularVelocity.set(0, 0, 0);

  sim.isSettled = true;
  sim.settleCounter = chassisConfig.settleConsecutiveTicks || 12;

  // Reset Drivetrain
  sim.drivetrain.gear = 'D';
  sim.drivetrain.speedLong = 0;
  sim.drivetrain.driveForce = 0;
  sim.drivetrain.brakeForce = 0;
  sim.drivetrain.dragForce = 0;
  sim.drivetrain.rollForce = 0;
  sim.drivetrain.netLongForce = 0;
  sim.drivetrain.wheelRollAngle = 0;

  // Reset Steering
  sim.steering.currentAngle = 0.0;
  sim.steering.steerFL = 0.0;
  sim.steering.steerFR = 0.0;
  sim.steering.totalLatForce = 0.0;
  sim.steering.yawTorque = 0.0;
  sim.steering.lateralG = 0.0;
  sim.steering.yawRate = 0.0;

  // Reset Wheels & Suspension
  const settled = wheelKinematics?.settledCompression || { fl: 0.1134, fr: 0.1134, rl: 0.0902, rr: 0.0902 };
  ['fl', 'fr', 'rl', 'rr'].forEach((k) => {
    const comp = settled[k] || 0.10;
    sim.wheels[k].length = suspConfig.restLength - comp;
    sim.wheels[k].prevLength = suspConfig.restLength - comp;
    sim.wheels[k].compression = comp;
    sim.wheels[k].force = comp * suspConfig.springStiffness;
    sim.wheels[k].isGrounded = true;
    sim.wheels[k].rollAngle = 0;
    sim.wheels[k].groundSpeed = 0;
    sim.wheels[k].rpm = 0;
    sim.wheels[k].suspensionOffset = 0;
    sim.wheels[k].surfaceType = 'asphalt';
  });

  // Collision state reset
  if (sim.collision) {
    sim.collision.hasCollided = false;
    sim.collision.lastCollisionType = 'none';
    sim.collision.lastCollisionObject = null;
    sim.collision.penetrationDepth = 0;
    sim.collision.impactSpeed = 0;
  }
}
