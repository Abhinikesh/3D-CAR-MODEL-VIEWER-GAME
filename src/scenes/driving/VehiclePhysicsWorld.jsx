import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VEHICLE_PHYSICS_CONFIG } from './vehiclePhysicsConfig.js';
import {
  getGroundHeightAt,
  computeSuspensionForce,
  computeAntiRollForce,
  integrateRigidBodyStep,
  interpolatePhysicsTransform,
  computeDriveForce,
  computeBrakeForce,
  computeAerodynamicDrag,
  computeRollingResistance,
  computeSpeedSensitiveSteerLimit,
  computeAckermannSteeringAngles,
  computeTireLateralForces,
  computePhysicsWheelSpeeds,
  computePhysicsWheelRollDelta,
  computeVisualSuspensionDeflection,
  checkVehicleCollision,
  resolveVehicleCollisionResponse,
  resetVehiclePhysicsState,
  computeEffectiveVehicleSurface,
} from './vehiclePhysicsUtils.js';
import { useVehiclePhysicsStore } from '../../store/vehiclePhysicsStore.js';
import { useVehicleInputStore } from './vehicleInputStore.js';
import { useWheelAnimationStore } from '../../store/wheelAnimationStore.js';

/**
 * VehiclePhysicsWorld Component
 *
 * Implements deterministic 60Hz fixed-timestep vehicle dynamics:
 * - 4-wheel independent raycast suspension with Hooke's spring law, viscous damping, and anti-roll bars.
 * - Rigid body dynamics with mass, moment of inertia tensor, and center of mass offset.
 * - Part 27 Longitudinal Drivetrain: forward acceleration power curve, progressive service braking,
 *   coasting aerodynamic drag, rolling resistance, reverse driving, and dynamic pitch torque.
 * - Accumulator pattern with max sub-step clamping to eliminate frame-rate dependence.
 * - Interpolated visual transform presentation for jitter-free 60/120+ FPS rendering.
 * - Automatic suspension settling and rock-solid ground stabilization on the road surface.
 * - Clean lifecycle disposal on mode switch.
 */
export default function VehiclePhysicsWorld({ vehicleRootRef }) {
  const {
    chassis: chassisCfg,
    suspension: suspCfg,
    wheelMounts,
    simulation: simCfg,
    spawn,
    drivetrain: driveCfg,
    steering: steeringCfg,
    wheelKinematics: wheelCfg,
    collision: collisionCfg,
  } = VEHICLE_PHYSICS_CONFIG;

  const updateTelemetry = useVehiclePhysicsStore((s) => s.updateTelemetry);
  const initializePhysics = useVehiclePhysicsStore((s) => s.initializePhysics);
  const disposePhysics = useVehiclePhysicsStore((s) => s.disposePhysics);

  // Scratch math instances to eliminate allocations in the 60Hz loop
  const _totalForce = useMemo(() => new THREE.Vector3(), []);
  const _totalTorque = useMemo(() => new THREE.Vector3(), []);
  const _mountWorld = useMemo(() => new THREE.Vector3(), []);
  const _comWorld = useMemo(() => new THREE.Vector3(), []);
  const _leverArm = useMemo(() => new THREE.Vector3(), []);
  const _wheelForce = useMemo(() => new THREE.Vector3(), []);
  const _wheelTorque = useMemo(() => new THREE.Vector3(), []);
  const _rotMatrix = useMemo(() => new THREE.Matrix4(), []);
  const _interpPos = useMemo(() => new THREE.Vector3(), []);
  const _interpRot = useMemo(() => new THREE.Quaternion(), []);

  // Longitudinal drivetrain & lateral handling scratch instances
  const _forwardVec = useMemo(() => new THREE.Vector3(), []);
  const _rightVec = useMemo(() => new THREE.Vector3(), []);
  const _upVec = useMemo(() => new THREE.Vector3(), []);
  const _longForceWorld = useMemo(() => new THREE.Vector3(), []);
  const _latDampWorld = useMemo(() => new THREE.Vector3(), []);
  const _longTorque = useMemo(() => new THREE.Vector3(), []);
  const _yawTorque = useMemo(() => new THREE.Vector3(), []);

  // Internal physics simulation state (never triggers React re-renders)
  const simStateRef = useRef(null);
  const accumulatorRef = useRef(0);
  const lastTelemetrySyncRef = useRef(0);
  const frameCountRef = useRef(0);

  // Initialize simulation state on mount
  useEffect(() => {
    initializePhysics();
    console.log('[VehiclePhysicsWorld] Initializing physics simulation with Part 28 steering & handling...');

    const initialPos = new THREE.Vector3(...spawn.position);
    const initialRot = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(spawn.rotation[0], spawn.rotation[1], spawn.rotation[2], 'YXZ')
    );

    simStateRef.current = {
      position: initialPos.clone(),
      quaternion: initialRot.clone(),
      prevPosition: initialPos.clone(),
      prevQuaternion: initialRot.clone(),
      linearVelocity: new THREE.Vector3(0, 0, 0),
      angularVelocity: new THREE.Vector3(0, 0, 0),
      isSettled: false,
      settleCounter: 0,
      totalSteps: 0,
      wheels: {
        fl: { length: suspCfg.restLength, prevLength: suspCfg.restLength, compression: 0, force: 0, isGrounded: true, rollAngle: 0, groundSpeed: 0, rpm: 0, suspensionOffset: 0, surfaceType: 'asphalt' },
        fr: { length: suspCfg.restLength, prevLength: suspCfg.restLength, compression: 0, force: 0, isGrounded: true, rollAngle: 0, groundSpeed: 0, rpm: 0, suspensionOffset: 0, surfaceType: 'asphalt' },
        rl: { length: suspCfg.restLength, prevLength: suspCfg.restLength, compression: 0, force: 0, isGrounded: true, rollAngle: 0, groundSpeed: 0, rpm: 0, suspensionOffset: 0, surfaceType: 'asphalt' },
        rr: { length: suspCfg.restLength, prevLength: suspCfg.restLength, compression: 0, force: 0, isGrounded: true, rollAngle: 0, groundSpeed: 0, rpm: 0, suspensionOffset: 0, surfaceType: 'asphalt' },
      },
      drivetrain: {
        gear: 'D',
        speedLong: 0,
        driveForce: 0,
        brakeForce: 0,
        dragForce: 0,
        rollForce: 0,
        netLongForce: 0,
        wheelRollAngle: 0,
      },
      steering: {
        currentAngle: 0.0,
        steerFL: 0.0,
        steerFR: 0.0,
        maxSteerLimit: steeringCfg.maxSteeringAngleLow,
        totalLatForce: 0.0,
        yawTorque: 0.0,
        lateralG: 0.0,
        yawRate: 0.0,
        lastT: 0.05,
      },
      collision: {
        hasCollided: false,
        collisionCount: 0,
        lastCollisionType: 'none',
        lastCollisionObject: null,
        penetrationDepth: 0,
        impactSpeed: 0,
        surfaceType: 'asphalt',
        isOffRoad: false,
        offRoadWheelCount: 0,
      },
    };

    if (typeof window !== 'undefined') {
      window.__physicsSim = simStateRef.current;
    }

    // Synchronize initial visual root position
    if (vehicleRootRef?.current) {
      vehicleRootRef.current.position.copy(initialPos);
      vehicleRootRef.current.quaternion.copy(initialRot);
    }

    return () => {
      disposePhysics();
      simStateRef.current = null;
      useWheelAnimationStore.getState().stopSpin();
      useWheelAnimationStore.getState().setDrivingSteerAngles(null);
      useWheelAnimationStore.getState().setDrivingWheelTransforms(null);
      useWheelAnimationStore.getState().resetTransforms();
    };
  }, [initializePhysics, disposePhysics, spawn, suspCfg.restLength, steeringCfg, vehicleRootRef]);

  // Fixed timestep physics update inside R3F render loop
  useFrame((state, delta) => {
    try {
      frameCountRef.current++;
      const sim = simStateRef.current;
      if (!sim) return;

      if (typeof window !== 'undefined') {
        window.__physicsFrames = frameCountRef.current;
        window.__debugDelta = delta;
        window.__debugTimeStep = simCfg.timeStep;
        window.__debugAccumulator = accumulatorRef.current;
      }

      // 0. Check for user / programmatic vehicle reset & recovery request (Part 30)
      if (useVehiclePhysicsStore.getState().resetRequested) {
        useVehiclePhysicsStore.getState().consumeReset();
        resetVehiclePhysicsState(sim, spawn, chassisCfg, suspCfg, wheelCfg);
        useVehicleInputStore.getState().resetInputs();
        useWheelAnimationStore.getState().resetTransforms();
        if (vehicleRootRef?.current) {
          vehicleRootRef.current.position.set(...spawn.position);
          vehicleRootRef.current.quaternion.setFromEuler(
            new THREE.Euler(spawn.rotation[0], spawn.rotation[1], spawn.rotation[2], 'YXZ')
          );
        }
        accumulatorRef.current = 0;
      }

      // 0b. Part 32: If paused, halt physics integration and freeze vehicle in place
      if (useVehiclePhysicsStore.getState().isPaused) {
        accumulatorRef.current = 0;
        return;
      }

      // 1. Accumulate real frame time, clamped to prevent spiral of death during backgrounding
      const clampedDelta = Math.min(delta, simCfg.maxDelta);
      accumulatorRef.current += clampedDelta;

      let subSteps = 0;

      // 2. Execute fixed-timestep physics steps
      while (accumulatorRef.current >= simCfg.timeStep && subSteps < simCfg.maxSubSteps) {
        stepPhysics(sim, simCfg.timeStep);
        accumulatorRef.current -= simCfg.timeStep;
        subSteps++;
      }

      // Drop excess time if catch-up step limit reached
      if (subSteps >= simCfg.maxSubSteps) {
        accumulatorRef.current = 0;
      }

      // 3. Interpolate transforms for butter-smooth rendering between physics ticks
      const alpha = Math.min(1, Math.max(0, accumulatorRef.current / simCfg.timeStep));
      interpolatePhysicsTransform(
        sim.prevPosition,
        sim.position,
        sim.prevQuaternion,
        sim.quaternion,
        alpha,
        _interpPos,
        _interpRot
      );

      // Apply interpolated pose to visual vehicle root
      if (vehicleRootRef?.current) {
        vehicleRootRef.current.position.copy(_interpPos);
        vehicleRootRef.current.quaternion.copy(_interpRot);
      }

      // 4. Throttled telemetry synchronization to Zustand store (~10 Hz)
      const now = performance.now();
      if (now - lastTelemetrySyncRef.current >= 100) {
        lastTelemetrySyncRef.current = now;
        const speedKmh = +(sim.drivetrain.speedLong * 3.6).toFixed(1);
        const displaySpeed = Math.round(Math.abs(sim.drivetrain.speedLong * 3.6));

        const steerDeg = +(sim.steering.currentAngle * (180 / Math.PI)).toFixed(1);
        const steerFLDeg = +(sim.steering.steerFL * (180 / Math.PI)).toFixed(1);
        const steerFRDeg = +(sim.steering.steerFR * (180 / Math.PI)).toFixed(1);
        const maxLimitDeg = +(sim.steering.maxSteerLimit * (180 / Math.PI)).toFixed(1);
        const yawRateDeg = +(sim.steering.yawRate * (180 / Math.PI)).toFixed(1);

        updateTelemetry({
          isSettled: sim.isSettled,
          settleProgress: Math.min(1.0, +(sim.settleCounter / chassisCfg.settleConsecutiveTicks).toFixed(2)),
          chassis: {
            position: [sim.position.x, sim.position.y, sim.position.z],
            rotation: [
              +new THREE.Euler().setFromQuaternion(sim.quaternion).x.toFixed(4),
              +new THREE.Euler().setFromQuaternion(sim.quaternion).y.toFixed(4),
              +new THREE.Euler().setFromQuaternion(sim.quaternion).z.toFixed(4),
            ],
            linearVelocity: [sim.linearVelocity.x, sim.linearVelocity.y, sim.linearVelocity.z],
            angularVelocity: [sim.angularVelocity.x, sim.angularVelocity.y, sim.angularVelocity.z],
            speedKmh,
            groundClearance: +sim.position.y.toFixed(4),
          },
          drivetrain: {
            gear: sim.drivetrain.gear,
            longitudinalSpeed: +sim.drivetrain.speedLong.toFixed(3),
            speedKmh: +speedKmh,
            displaySpeed,
            driveForce: Math.round(sim.drivetrain.driveForce),
            brakeForce: Math.round(sim.drivetrain.brakeForce),
            dragForce: Math.round(sim.drivetrain.dragForce),
            rollingResistanceForce: Math.round(sim.drivetrain.rollForce),
            netLongitudinalForce: Math.round(sim.drivetrain.netLongForce),
            isAccelerating: sim.drivetrain.driveForce !== 0,
            isBraking: sim.drivetrain.brakeForce !== 0,
            isCoasting: sim.drivetrain.driveForce === 0 && sim.drivetrain.brakeForce === 0 && Math.abs(sim.drivetrain.speedLong) > 0.05,
            isReversing: sim.drivetrain.gear === 'R',
            wheelRollAngle: +sim.drivetrain.wheelRollAngle.toFixed(3),
          },
          steering: {
            steeringInput: +useVehicleInputStore.getState().steer.toFixed(2),
            centralAngleDeg: steerDeg,
            centralAngleRad: +sim.steering.currentAngle.toFixed(4),
            angleFLDeg: steerFLDeg,
            angleFLRad: +sim.steering.steerFL.toFixed(4),
            angleFRDeg: steerFRDeg,
            angleFRRad: +sim.steering.steerFR.toFixed(4),
            maxSteerLimitDeg: maxLimitDeg,
            yawRateDeg,
            yawRateRad: +sim.steering.yawRate.toFixed(4),
            lateralG: +sim.steering.lateralG.toFixed(2),
            lateralForceTotal: Math.round(sim.steering.totalLatForce),
            isSteering: Math.abs(sim.steering.currentAngle) > 0.005,
          },
          wheels: {
            fl: {
              suspensionLength: +sim.wheels.fl.length.toFixed(4),
              compression: +sim.wheels.fl.compression.toFixed(4),
              compressionRatio: +((sim.wheels.fl.compression / (suspCfg.restLength - suspCfg.minLength)).toFixed(2)),
              suspensionForce: Math.round(sim.wheels.fl.force),
              isGrounded: sim.wheels.fl.isGrounded,
              rollAngle: +sim.wheels.fl.rollAngle.toFixed(3),
              groundSpeed: +sim.wheels.fl.groundSpeed.toFixed(2),
              rpm: sim.wheels.fl.rpm,
              suspensionOffsetMm: +(sim.wheels.fl.suspensionOffset * 1000).toFixed(1),
              surfaceType: sim.wheels.fl.surfaceType || 'asphalt',
            },
            fr: {
              suspensionLength: +sim.wheels.fr.length.toFixed(4),
              compression: +sim.wheels.fr.compression.toFixed(4),
              compressionRatio: +((sim.wheels.fr.compression / (suspCfg.restLength - suspCfg.minLength)).toFixed(2)),
              suspensionForce: Math.round(sim.wheels.fr.force),
              isGrounded: sim.wheels.fr.isGrounded,
              rollAngle: +sim.wheels.fr.rollAngle.toFixed(3),
              groundSpeed: +sim.wheels.fr.groundSpeed.toFixed(2),
              rpm: sim.wheels.fr.rpm,
              suspensionOffsetMm: +(sim.wheels.fr.suspensionOffset * 1000).toFixed(1),
              surfaceType: sim.wheels.fr.surfaceType || 'asphalt',
            },
            rl: {
              suspensionLength: +sim.wheels.rl.length.toFixed(4),
              compression: +sim.wheels.rl.compression.toFixed(4),
              compressionRatio: +((sim.wheels.rl.compression / (suspCfg.restLength - suspCfg.minLength)).toFixed(2)),
              suspensionForce: Math.round(sim.wheels.rl.force),
              isGrounded: sim.wheels.rl.isGrounded,
              rollAngle: +sim.wheels.rl.rollAngle.toFixed(3),
              groundSpeed: +sim.wheels.rl.groundSpeed.toFixed(2),
              rpm: sim.wheels.rl.rpm,
              suspensionOffsetMm: +(sim.wheels.rl.suspensionOffset * 1000).toFixed(1),
              surfaceType: sim.wheels.rl.surfaceType || 'asphalt',
            },
            rr: {
              suspensionLength: +sim.wheels.rr.length.toFixed(4),
              compression: +sim.wheels.rr.compression.toFixed(4),
              compressionRatio: +((sim.wheels.rr.compression / (suspCfg.restLength - suspCfg.minLength)).toFixed(2)),
              suspensionForce: Math.round(sim.wheels.rr.force),
              isGrounded: sim.wheels.rr.isGrounded,
              rollAngle: +sim.wheels.rr.rollAngle.toFixed(3),
              groundSpeed: +sim.wheels.rr.groundSpeed.toFixed(2),
              rpm: sim.wheels.rr.rpm,
              suspensionOffsetMm: +(sim.wheels.rr.suspensionOffset * 1000).toFixed(1),
              surfaceType: sim.wheels.rr.surfaceType || 'asphalt',
            },
          },
          collision: {
            hasCollided: sim.collision.hasCollided,
            collisionCount: sim.collision.collisionCount,
            lastCollisionType: sim.collision.lastCollisionType,
            lastCollisionObject: sim.collision.lastCollisionObject,
            penetrationDepth: +sim.collision.penetrationDepth.toFixed(3),
            impactSpeedKmh: +(sim.collision.impactSpeed * 3.6).toFixed(1),
            surfaceType: sim.collision.surfaceType,
            isOffRoad: sim.collision.isOffRoad,
            offRoadWheelCount: sim.collision.offRoadWheelCount,
          },
          stats: {
            totalPhysicsSteps: sim.totalSteps,
            subStepsLastFrame: subSteps,
            accumulatorMs: +(accumulatorRef.current * 1000).toFixed(1),
          },
        });

        // Keep showroom spin state in sync for telemetry / status indicators
        if (Math.abs(sim.drivetrain.speedLong) > 0.05) {
          const spinDir = sim.drivetrain.speedLong >= 0 ? 1 : -1;
          const spinSpeedFactor = Math.min(3.0, Math.max(0.2, Math.abs(sim.drivetrain.speedLong) / 5.0));
          useWheelAnimationStore.getState().startSpin(spinDir, spinSpeedFactor);
        } else {
          useWheelAnimationStore.getState().stopSpin();
        }
      }

      // Synchronize physics-driven wheel transforms (roll, Ackermann steering, suspension) with visual assemblies
      useWheelAnimationStore.getState().setDrivingWheelTransforms({
        rollAngles: {
          wheel_fl: sim.wheels.fl.rollAngle,
          wheel_fr: sim.wheels.fr.rollAngle,
          wheel_rl: sim.wheels.rl.rollAngle,
          wheel_rr: sim.wheels.rr.rollAngle,
        },
        steerAngles: {
          wheel_fl: sim.steering.steerFL,
          wheel_fr: sim.steering.steerFR,
          wheel_rl: 0.0,
          wheel_rr: 0.0,
        },
        suspensionOffsets: {
          wheel_fl: sim.wheels.fl.suspensionOffset,
          wheel_fr: sim.wheels.fr.suspensionOffset,
          wheel_rl: sim.wheels.rl.suspensionOffset,
          wheel_rr: sim.wheels.rr.suspensionOffset,
        },
        centralSteer: sim.steering.currentAngle,
      });
    } catch (err) {
      if (typeof window !== 'undefined') {
        window.__physicsError = err.message + '\n' + err.stack;
      }
      console.error('[VehiclePhysicsWorld Error]', err);
    }
  });

  /**
   * Single fixed-timestep integration step (60 Hz)
   */
  function stepPhysics(sim, dt) {
    // 1. Snapshot previous transforms for interpolation
    sim.prevPosition.copy(sim.position);
    sim.prevQuaternion.copy(sim.quaternion);

    // Read current driver inputs from abstracted store
    const input = useVehicleInputStore.getState();
    const { throttle = 0, brake = 0, steer = 0, gear = 'D', handbrake = false } = input;
    const hasActiveInput = throttle > 0.01 || brake > 0.01 || Math.abs(steer) > 0.01;

    // Wake up from settled state if driver provides input
    if (hasActiveInput) {
      sim.isSettled = false;
      sim.settleCounter = 0;
    }

    // If fully settled at rest with zero inputs, bypass complex calculations and hold state rock-solid
    if (sim.isSettled && !hasActiveInput) {
      sim.linearVelocity.set(0, 0, 0);
      sim.angularVelocity.set(0, 0, 0);
      sim.drivetrain.speedLong = 0;
      sim.drivetrain.driveForce = 0;
      sim.drivetrain.brakeForce = 0;
      sim.drivetrain.dragForce = 0;
      sim.drivetrain.rollForce = 0;
      sim.drivetrain.netLongForce = 0;
      sim.steering.totalLatForce = 0;
      sim.steering.yawTorque = 0;
      sim.steering.lateralG = 0;
      sim.steering.yawRate = 0;
      ['fl', 'fr', 'rl', 'rr'].forEach((k) => {
        sim.wheels[k].groundSpeed = 0;
        sim.wheels[k].rpm = 0;
        sim.wheels[k].suspensionOffset = 0;
      });
      sim.totalSteps++;
      return;
    }

    // 2. Initialize force and torque accumulators with gravity: F_gravity = m * g
    _totalForce.set(0, chassisCfg.mass * chassisCfg.gravity[1], 0);
    _totalTorque.set(0, 0, 0);

    // Compute center of mass in world coordinates
    _rotMatrix.makeRotationFromQuaternion(sim.quaternion);
    _comWorld.fromArray(chassisCfg.centerOfMass).applyMatrix4(_rotMatrix).add(sim.position);

    // 3. Evaluate 4-Wheel Raycast Suspensions
    const wheelKeys = ['fl', 'fr', 'rl', 'rr'];
    const compressions = {};

    wheelKeys.forEach((key) => {
      const mount = wheelMounts[key];
      const wheelState = sim.wheels[key];

      // Calculate suspension mount point in world space
      _mountWorld.fromArray(mount.mountPoint).applyMatrix4(_rotMatrix).add(sim.position);

      // Raycast downward to test ground elevation and surface classification (Part 30)
      const ground = getGroundHeightAt(_mountWorld.x, _mountWorld.z, sim.steering.lastT || null);
      if (ground.t !== undefined && ground.t !== null) {
        sim.steering.lastT = ground.t;
      }
      wheelState.surfaceType = ground.surfaceType || 'asphalt';

      const hitDistance = _mountWorld.y - ground.elevation;

      // Unclamped suspension length = raycast distance - tire radius
      const rawLength = hitDistance - suspCfg.tireRadius;
      const clampedLength = Math.max(suspCfg.minLength, Math.min(suspCfg.maxLength, rawLength));

      // Compression deflection: x = restLength - currentLength
      const compression = Math.max(0, suspCfg.restLength - clampedLength);
      compressions[key] = compression;

      // Rate of compression: v_comp = (prevLength - clampedLength) / dt
      const compVelocity = (wheelState.prevLength - clampedLength) / dt;

      // Primary spring + damper normal force
      const normalForce = computeSuspensionForce(compression, compVelocity, suspCfg);

      wheelState.prevLength = wheelState.length;
      wheelState.length = clampedLength;
      wheelState.compression = compression;
      wheelState.force = normalForce;
      wheelState.isGrounded = rawLength <= suspCfg.maxLength;
    });

    // 4. Anti-Roll Bar Forces (Front and Rear Axles)
    const arbFront = computeAntiRollForce(compressions.fl, compressions.fr, suspCfg.antiRollStiffness);
    const arbRear = computeAntiRollForce(compressions.rl, compressions.rr, suspCfg.antiRollStiffness);

    // 5. Accumulate Suspension Forces and Resulting Torques
    wheelKeys.forEach((key) => {
      const mount = wheelMounts[key];
      const wheelState = sim.wheels[key];

      let effectiveForce = wheelState.force;
      if (key === 'fl') effectiveForce += arbFront;
      else if (key === 'fr') effectiveForce -= arbFront;
      else if (key === 'rl') effectiveForce += arbRear;
      else if (key === 'rr') effectiveForce -= arbRear;

      effectiveForce = Math.max(0, effectiveForce);
      wheelState.force = effectiveForce;

      if (effectiveForce > 0) {
        // Vertical suspension force on chassis
        _wheelForce.set(0, effectiveForce, 0);
        _totalForce.add(_wheelForce);

        // Torque about Center of Mass: tau = (p_mount - p_com) x F_wheel
        _mountWorld.fromArray(mount.mountPoint).applyMatrix4(_rotMatrix).add(sim.position);
        _leverArm.subVectors(_mountWorld, _comWorld);
        _wheelTorque.crossVectors(_leverArm, _wheelForce);
        _totalTorque.add(_wheelTorque);
      }
    });

    // 5b. Surface Evaluation across All 4 Wheels (Part 30)
    const surfaceEval = computeEffectiveVehicleSurface(
      {
        fl: sim.wheels.fl.surfaceType,
        fr: sim.wheels.fr.surfaceType,
        rl: sim.wheels.rl.surfaceType,
        rr: sim.wheels.rr.surfaceType,
      },
      collisionCfg
    );
    sim.collision.surfaceType = surfaceEval.primarySurface;
    sim.collision.isOffRoad = surfaceEval.isOffRoad;
    sim.collision.offRoadWheelCount = surfaceEval.offRoadWheelCount;

    // 6. Longitudinal Drivetrain Dynamics (Part 27)
    // Derive chassis orientation unit vectors in world coordinates
    _forwardVec.set(0, 0, 1).applyQuaternion(sim.quaternion);
    _rightVec.set(1, 0, 0).applyQuaternion(sim.quaternion);
    _upVec.set(0, 1, 0).applyQuaternion(sim.quaternion);

    const speedLong = sim.linearVelocity.dot(_forwardVec);
    const speedLat = sim.linearVelocity.dot(_rightVec);

    // Tractive Engine Drive Force (Brake pedal overrides throttle)
    const normalWeight = chassisCfg.mass * Math.abs(chassisCfg.gravity[1]);
    let driveForce = 0.0;
    if (brake <= 0.05 && !handbrake) {
      driveForce = computeDriveForce(throttle, speedLong, gear, driveCfg);
      // Off-road traction limit (Part 30): wheel slip limits max tractive force on loose terrain
      const maxDriveTraction = surfaceEval.effectiveFriction * normalWeight;
      if (Math.abs(driveForce) > maxDriveTraction) {
        driveForce = Math.sign(driveForce) * maxDriveTraction;
      }
    }

    // Progressive Service & Emergency Braking Force
    const effectiveBrake = handbrake ? Math.max(brake, 0.9) : brake;
    const brakeForce = computeBrakeForce(effectiveBrake, speedLong, dt, chassisCfg.mass, driveCfg);

    // Aerodynamic Drag opposing velocity
    const dragForce = computeAerodynamicDrag(speedLong, driveCfg);

    // Tire Rolling Resistance on evaluated terrain surface (grass increases resistance 3.7x)
    const surfaceDriveCfg = { ...driveCfg, rollingResistanceCoeff: surfaceEval.effectiveRollingResistance };
    const rollForce = computeRollingResistance(speedLong, normalWeight, dt, chassisCfg.mass, surfaceDriveCfg);

    // Net longitudinal force along vehicle forward axis
    const netLongForce = driveForce + brakeForce + dragForce + rollForce;

    // Apply net longitudinal force in world space
    _longForceWorld.copy(_forwardVec).multiplyScalar(netLongForce);
    _totalForce.add(_longForceWorld);

    // Pitch Torque from contact patch offset (lever arm deltaY ~ -0.78m below COM)
    // Positive netLongForce (acceleration) causes pitch-up (rear squat).
    // Negative netLongForce (braking) causes pitch-down (front dive).
    const deltaY = driveCfg.contactPatchYOffset - chassisCfg.centerOfMass[1];
    _longTorque.set(-deltaY * netLongForce, 0, 0).applyQuaternion(sim.quaternion);
    _totalTorque.add(_longTorque);

    // 7. Steering Dynamics, Ackermann Angles & Tire Lateral Handling Forces (Part 28)
    const maxSteerLimit = computeSpeedSensitiveSteerLimit(speedLong, steeringCfg);
    sim.steering.maxSteerLimit = maxSteerLimit;

    // Target central steering angle: steer = -1.0 (Left) -> +maxSteerLimit, steer = +1.0 (Right) -> -maxSteerLimit
    const targetSteerAngle = -steer * maxSteerLimit;

    if (Math.abs(steer) > 0.01) {
      // Driver active steering buildup towards target angle
      const maxDelta = steeringCfg.steeringResponseRate * dt;
      const angleDiff = targetSteerAngle - sim.steering.currentAngle;
      const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, angleDiff));
      sim.steering.currentAngle = Math.max(-maxSteerLimit, Math.min(maxSteerLimit, sim.steering.currentAngle + clampedDelta));
    } else {
      // Automatic self-centering towards 0 rad when steering input is released
      const maxCenterDelta = steeringCfg.steeringCenteringRate * dt;
      if (Math.abs(sim.steering.currentAngle) <= maxCenterDelta) {
        sim.steering.currentAngle = 0.0;
      } else {
        sim.steering.currentAngle -= Math.sign(sim.steering.currentAngle) * maxCenterDelta;
      }
    }

    // Compute Front-Left and Front-Right Ackermann steering angles
    const ackermann = computeAckermannSteeringAngles(sim.steering.currentAngle, steeringCfg);
    sim.steering.steerFL = ackermann.steerFL;
    sim.steering.steerFR = ackermann.steerFR;

    // Estimate front and rear normal vertical axle loads
    const frontNormalLoad = (sim.wheels.fl.force + sim.wheels.fr.force) || (chassisCfg.mass * Math.abs(chassisCfg.gravity[1]) * 0.52);
    const rearNormalLoad = (sim.wheels.rl.force + sim.wheels.rr.force) || (chassisCfg.mass * Math.abs(chassisCfg.gravity[1]) * 0.48);

    // Compute tire lateral cornering forces and restoring yaw torque with dynamic surface grip
    const surfaceSteeringCfg = { ...steeringCfg, tireFrictionCoeff: surfaceEval.effectiveFriction };
    const tireForces = computeTireLateralForces(
      speedLong,
      speedLat,
      sim.angularVelocity.y,
      sim.steering.currentAngle,
      { front: frontNormalLoad, rear: rearNormalLoad },
      dt,
      surfaceSteeringCfg
    );

    // Apply net lateral force along vehicle lateral axis in world space
    _latDampWorld.copy(_rightVec).multiplyScalar(tireForces.totalLatForce);
    _totalForce.add(_latDampWorld);

    // Apply yaw torque along vehicle vertical axis in world space
    _yawTorque.copy(_upVec).multiplyScalar(tireForces.yawTorque);
    _totalTorque.add(_yawTorque);

    // Compute lateral G and store steering telemetry
    const latAccel = tireForces.totalLatForce / chassisCfg.mass;
    sim.steering.totalLatForce = tireForces.totalLatForce;
    sim.steering.yawTorque = tireForces.yawTorque;
    sim.steering.lateralG = latAccel / 9.81;
    sim.steering.yawRate = sim.angularVelocity.y;

    // 8. Part 29: Differential Wheel Kinematics, Spin Integration & Suspension Deflection
    const wheelSpeeds = computePhysicsWheelSpeeds(
      speedLong,
      sim.angularVelocity.y,
      sim.steering.steerFL,
      sim.steering.steerFR,
      steeringCfg
    );

    const tireRadius = wheelCfg?.tireRadius || suspCfg.tireRadius || 0.36065;
    const maxTravel = wheelCfg?.maxSuspensionTravel || 0.040;

    wheelKeys.forEach((key) => {
      const wSpeed = wheelSpeeds[key];
      const deltaWheelRoll = computePhysicsWheelRollDelta(wSpeed, dt, tireRadius);
      const wheelObj = sim.wheels[key];
      wheelObj.rollAngle = (wheelObj.rollAngle + deltaWheelRoll) % (2 * Math.PI);
      wheelObj.groundSpeed = wSpeed;
      wheelObj.rpm = Math.round((wSpeed / (2 * Math.PI * tireRadius)) * 60);

      // Visual suspension displacement relative to settled equilibrium height
      const settledComp = wheelCfg?.settledCompression?.[key] ?? 0.10;
      wheelObj.suspensionOffset = computeVisualSuspensionDeflection(
        wheelObj.compression,
        settledComp,
        maxTravel
      );
    });

    sim.drivetrain.wheelRollAngle = sim.wheels.fl.rollAngle;

    // Store internal drivetrain telemetry
    sim.drivetrain.gear = gear;
    sim.drivetrain.speedLong = speedLong;
    sim.drivetrain.driveForce = driveForce;
    sim.drivetrain.brakeForce = brakeForce;
    sim.drivetrain.dragForce = dragForce;
    sim.drivetrain.rollForce = rollForce;
    sim.drivetrain.netLongForce = netLongForce;

    // 7. Ground Safety Barrier (Relative to Local Road Elevation)
    const localRoad = getGroundHeightAt(sim.position.x, sim.position.z, sim.steering.lastT || null);
    if (sim.position.y < localRoad.elevation - 0.02) {
      // Emergency ground restoring force
      const penetration = (localRoad.elevation - 0.02) - sim.position.y;
      _totalForce.y += penetration * 200000;
      sim.linearVelocity.y = Math.max(0, sim.linearVelocity.y);
    }

    // 8. Numerical Integration (Semi-Implicit Euler)
    integrateRigidBodyStep(sim, _totalForce, _totalTorque, dt, chassisCfg);
    sim.totalSteps++;

    // 9. Boundary & Collision Detection and Response (Part 30)
    const collision = checkVehicleCollision(
      sim.position,
      sim.quaternion,
      sim.linearVelocity,
      sim.angularVelocity,
      collisionCfg,
      sim.steering.lastT || null
    );

    if (collision && collision.hasCollision) {
      resolveVehicleCollisionResponse(sim, collision, dt, collisionCfg, chassisCfg);
      sim.collision.hasCollided = true;
      sim.collision.collisionCount++;
      sim.collision.lastCollisionType = collision.type;
      sim.collision.lastCollisionObject = collision.objectId || collision.type;
      sim.collision.penetrationDepth = collision.maxPenetration;
      sim.collision.impactSpeed = collision.impactVelocity || 0;
    } else {
      sim.collision.hasCollided = false;
      sim.collision.penetrationDepth = 0;
    }

    // 10. Suspension Rest Settlement Detection
    const linSpeed = sim.linearVelocity.length();
    const angSpeed = sim.angularVelocity.length();

    if (
      !hasActiveInput &&
      linSpeed < chassisCfg.settleLinearVelocityThreshold &&
      angSpeed < chassisCfg.settleAngularVelocityThreshold
    ) {
      sim.settleCounter++;
      if (sim.settleCounter >= chassisCfg.settleConsecutiveTicks) {
        sim.isSettled = true;
        sim.linearVelocity.set(0, 0, 0);
        sim.angularVelocity.set(0, 0, 0);
      }
    } else {
      sim.settleCounter = Math.max(0, sim.settleCounter - 1);
    }
  }

  return null;
}
