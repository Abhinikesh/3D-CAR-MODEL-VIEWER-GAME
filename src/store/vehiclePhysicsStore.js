import { create } from 'zustand';
import { VEHICLE_PHYSICS_CONFIG } from '../scenes/driving/vehiclePhysicsConfig.js';

/**
 * Vehicle Physics Store
 *
 * Dedicated state container for vehicle dynamics and suspension telemetry.
 * Completely decoupled from the 60Hz physics integration loop to avoid React re-rendering churn.
 * Receives throttled state snapshots (10 Hz) for UI HUD and diagnostics.
 */

function createInitialWheelState(id) {
  return {
    id,
    suspensionLength: VEHICLE_PHYSICS_CONFIG.suspension.restLength,
    compression: 0,
    compressionRatio: 0,
    suspensionForce: 0,
    isGrounded: true,
    hubElevation: VEHICLE_PHYSICS_CONFIG.suspension.tireRadius,
  };
}

function createInitialSteeringState() {
  return {
    steeringInput: 0.0,
    centralAngleDeg: 0.0,
    centralAngleRad: 0.0,
    angleFLDeg: 0.0,
    angleFLRad: 0.0,
    angleFRDeg: 0.0,
    angleFRRad: 0.0,
    maxSteerLimitDeg: +(VEHICLE_PHYSICS_CONFIG.steering?.maxSteeringAngleLow * 180 / Math.PI || 30).toFixed(1),
    yawRateDeg: 0.0,
    yawRateRad: 0.0,
    lateralG: 0.0,
    lateralForceTotal: 0,
    isSteering: false,
  };
}

function createInitialCollisionState() {
  return {
    hasCollided: false,
    collisionCount: 0,
    lastCollisionType: 'none', // 'none' | 'barrier' | 'obstacle' | 'boundary'
    lastCollisionObject: null,
    penetrationDepth: 0,
    impactSpeedKmh: 0,
    surfaceType: 'asphalt', // 'asphalt' | 'kerb' | 'grass'
    isOffRoad: false,
    offRoadWheelCount: 0,
  };
}

export const useVehiclePhysicsStore = create((set, get) => ({
  isInitialized: false,
  isSimulating: false,
  isSettled: false,
  settleProgress: 0.0,
  resetRequested: false,
  resetCount: 0,
  isPaused: false,

  // Chassis rigid body telemetry
  chassis: {
    position: [...VEHICLE_PHYSICS_CONFIG.spawn.position],
    rotation: [...VEHICLE_PHYSICS_CONFIG.spawn.rotation],
    linearVelocity: [0, 0, 0],
    angularVelocity: [0, 0, 0],
    speedKmh: 0,
    mass: VEHICLE_PHYSICS_CONFIG.chassis.mass,
    groundClearance: VEHICLE_PHYSICS_CONFIG.spawn.position[1],
  },

  // Longitudinal drivetrain & kinematics telemetry (Part 27)
  drivetrain: {
    gear: 'D',
    longitudinalSpeed: 0.0, // m/s
    speedKmh: 0.0,          // signed km/h (positive forward, negative reverse)
    displaySpeed: 0,        // absolute integer km/h for gauge HUD
    driveForce: 0,          // N
    brakeForce: 0,          // N
    dragForce: 0,           // N
    rollingResistanceForce: 0, // N
    netLongitudinalForce: 0,// N
    isAccelerating: false,
    isBraking: false,
    isCoasting: false,
    isReversing: false,
    wheelRollAngle: 0.0,
  },

  // Four-wheel suspension state
  wheels: {
    fl: createInitialWheelState('fl'),
    fr: createInitialWheelState('fr'),
    rl: createInitialWheelState('rl'),
    rr: createInitialWheelState('rr'),
  },

  // Steering kinematics & lateral handling telemetry (Part 28)
  steering: createInitialSteeringState(),

  // Road boundaries & collision telemetry (Part 30)
  collision: createInitialCollisionState(),

  // Simulation execution telemetry
  stats: {
    totalPhysicsSteps: 0,
    fixedTimeStepMs: +(VEHICLE_PHYSICS_CONFIG.simulation.timeStep * 1000).toFixed(2),
    subStepsLastFrame: 1,
    accumulatorMs: 0,
  },

  // ─── Actions ───

  pause: () => {
    set({ isPaused: true });
  },

  resume: () => {
    set({ isPaused: false });
  },

  togglePause: () => {
    set((state) => ({ isPaused: !state.isPaused }));
  },

  requestReset: () => {
    set({ resetRequested: true });
  },

  consumeReset: () => {
    set((state) => ({ resetRequested: false, resetCount: state.resetCount + 1 }));
  },

  initializePhysics: (customSpawn) => {
    const spawnPos = customSpawn?.position || VEHICLE_PHYSICS_CONFIG.spawn.position;
    const spawnRot = customSpawn?.rotation || VEHICLE_PHYSICS_CONFIG.spawn.rotation;

    set({
      isInitialized: true,
      isSimulating: true,
      isSettled: false,
      settleProgress: 0.0,
      chassis: {
        position: [...spawnPos],
        rotation: [...spawnRot],
        linearVelocity: [0, 0, 0],
        angularVelocity: [0, 0, 0],
        speedKmh: 0,
        mass: VEHICLE_PHYSICS_CONFIG.chassis.mass,
        groundClearance: spawnPos[1],
      },
      drivetrain: {
        gear: 'D',
        longitudinalSpeed: 0.0,
        speedKmh: 0.0,
        displaySpeed: 0,
        driveForce: 0,
        brakeForce: 0,
        dragForce: 0,
        rollingResistanceForce: 0,
        netLongitudinalForce: 0,
        isAccelerating: false,
        isBraking: false,
        isCoasting: false,
        isReversing: false,
        wheelRollAngle: 0.0,
      },
      wheels: {
        fl: createInitialWheelState('fl'),
        fr: createInitialWheelState('fr'),
        rl: createInitialWheelState('rl'),
        rr: createInitialWheelState('rr'),
      },
      steering: createInitialSteeringState(),
      collision: createInitialCollisionState(),
      resetRequested: false,
      isPaused: false,
      stats: {
        totalPhysicsSteps: 0,
        fixedTimeStepMs: +(VEHICLE_PHYSICS_CONFIG.simulation.timeStep * 1000).toFixed(2),
        subStepsLastFrame: 1,
        accumulatorMs: 0,
      },
    });
  },

  updateTelemetry: (snapshot) => {
    set((state) => ({
      isSettled: snapshot.isSettled ?? state.isSettled,
      settleProgress: snapshot.settleProgress ?? state.settleProgress,
      chassis: {
        ...state.chassis,
        ...snapshot.chassis,
      },
      drivetrain: snapshot.drivetrain ? { ...state.drivetrain, ...snapshot.drivetrain } : state.drivetrain,
      wheels: snapshot.wheels ? { ...state.wheels, ...snapshot.wheels } : state.wheels,
      steering: snapshot.steering ? { ...state.steering, ...snapshot.steering } : state.steering,
      collision: snapshot.collision ? { ...state.collision, ...snapshot.collision } : state.collision,
      stats: snapshot.stats ? { ...state.stats, ...snapshot.stats } : state.stats,
    }));
  },

  resetPhysics: () => {
    get().initializePhysics();
  },

  disposePhysics: () => {
    set({
      isInitialized: false,
      isSimulating: false,
      isSettled: false,
      settleProgress: 0.0,
      resetRequested: false,
      isPaused: false,
      collision: createInitialCollisionState(),
      drivetrain: {
        gear: 'D',
        longitudinalSpeed: 0.0,
        speedKmh: 0.0,
        displaySpeed: 0,
        driveForce: 0,
        brakeForce: 0,
        dragForce: 0,
        rollingResistanceForce: 0,
        netLongitudinalForce: 0,
        isAccelerating: false,
        isBraking: false,
        isCoasting: false,
        isReversing: false,
        wheelRollAngle: 0.0,
      },
      steering: createInitialSteeringState(),
    });
  },
}));

// Expose store globally for test harnesses and diagnostics
if (typeof window !== 'undefined') {
  window.__vehiclePhysicsStore = useVehiclePhysicsStore;
}
