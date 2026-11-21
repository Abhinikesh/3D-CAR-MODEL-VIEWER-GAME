import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');

let passedTests = 0;
let failedTests = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    failedTests++;
  }
}

async function main() {
  console.log('\n--- TEST SUITE: Part 28 — Vehicle Steering, Tire Friction and Handling ---\n');

  // 1. Module & Component File Integrity
  await runTest('All Part 28 steering and handling modules exist and export required methods', async () => {
  const config = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');
  assert.ok(config.VEHICLE_PHYSICS_CONFIG.steering, 'VEHICLE_PHYSICS_CONFIG must export steering configuration');

  const utils = await import('../../src/scenes/driving/vehiclePhysicsUtils.js');
  assert.strictEqual(typeof utils.computeSpeedSensitiveSteerLimit, 'function', 'computeSpeedSensitiveSteerLimit must be exported');
  assert.strictEqual(typeof utils.computeAckermannSteeringAngles, 'function', 'computeAckermannSteeringAngles must be exported');
  assert.strictEqual(typeof utils.computeTireLateralForces, 'function', 'computeTireLateralForces must be exported');

  const store = await import('../../src/store/vehiclePhysicsStore.js');
  assert.ok(store.useVehiclePhysicsStore, 'useVehiclePhysicsStore must be exported');
  const initialSteering = store.useVehiclePhysicsStore.getState().steering;
  assert.ok(initialSteering, 'useVehiclePhysicsStore must contain initial steering state');
  assert.strictEqual(typeof initialSteering.centralAngleDeg, 'number');
  assert.strictEqual(typeof initialSteering.lateralG, 'number');

  const wheelAnimStore = await import('../../src/store/wheelAnimationStore.js');
  assert.strictEqual(typeof wheelAnimStore.useWheelAnimationStore.getState().setDrivingSteerAngles, 'function', 'setDrivingSteerAngles action must exist');

  const hudFile = fs.readFileSync(path.resolve(ROOT, 'src/components/ui/DrivingHUD.jsx'), 'utf-8');
  assert.ok(hudFile.includes('steerTelemetryRow') || hudFile.includes('steerCol'), 'DrivingHUD must render steering telemetry');
  assert.ok(hudFile.includes('Steer'), 'DrivingHUD must include steering controls in quick guide');
});

  // 2. Steering Configuration Physical Properties
  await runTest('Steering configuration defines verified sports coupe geometry and cornering parameters', async () => {
    const { VEHICLE_PHYSICS_CONFIG } = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');
    const { steering } = VEHICLE_PHYSICS_CONFIG;

    assert.ok(Math.abs(steering.maxSteeringAngleLow - (30 * Math.PI / 180)) < 1e-6, 'Low speed steering limit must be 30 degrees');
    assert.ok(Math.abs(steering.maxSteeringAngleHigh - (12 * Math.PI / 180)) < 1e-6, 'High speed steering limit must be 12 degrees');
    assert.ok(steering.maxSteeringAngleHigh < steering.maxSteeringAngleLow, 'High speed steering must be lower than low speed');

    assert.strictEqual(steering.wheelbase, 2.800, 'Wheelbase must match 2.800m');
    assert.strictEqual(steering.trackWidthFront, 1.952, 'Front track width must match 1.952m');
    assert.strictEqual(steering.trackWidthRear, 1.964, 'Rear track width must match 1.964m');

    assert.ok(Math.abs((steering.distComToFrontAxle + steering.distComToRearAxle) - steering.wheelbase) < 0.01, 'Axle distances from COM must sum to wheelbase');

    assert.ok(steering.corneringStiffnessFront >= 60000, 'Front cornering stiffness must be >= 60,000 N/rad');
    assert.ok(steering.corneringStiffnessRear > steering.corneringStiffnessFront, 'Rear stiffness must exceed front for understeer stability');
    assert.ok(steering.tireFrictionCoeff >= 1.0, 'Dry asphalt tire friction coefficient must be >= 1.0');
  });

  // 3. Speed-Sensitive Steering Scaling
  await runTest('computeSpeedSensitiveSteerLimit scales smoothly from 30° at low speed to 12° at high speed', async () => {
    const { computeSpeedSensitiveSteerLimit } = await import('../../src/scenes/driving/vehiclePhysicsUtils.js');
    const { VEHICLE_PHYSICS_CONFIG } = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');
    const cfg = VEHICLE_PHYSICS_CONFIG.steering;

    // Zero speed: exactly 30 degrees
    const limit0 = computeSpeedSensitiveSteerLimit(0, cfg);
    assert.ok(Math.abs(limit0 - cfg.maxSteeringAngleLow) < 1e-6, 'Zero speed limit must equal maxSteeringAngleLow');

    // Low speed (5 m/s = 18 km/h)
    const limit5 = computeSpeedSensitiveSteerLimit(5, cfg);
    assert.ok(limit5 > (27 * Math.PI / 180), 'At 18 km/h limit should remain near 30 deg');

    // Medium speed (18 m/s = 65 km/h)
    const limit18 = computeSpeedSensitiveSteerLimit(18, cfg);
    const expected18 = cfg.maxSteeringAngleHigh + (cfg.maxSteeringAngleLow - cfg.maxSteeringAngleHigh) * 0.5;
    assert.ok(Math.abs(limit18 - expected18) < 1e-6, 'At steerSpeedScale limit must be halfway between low and high');

    // High speed (60 m/s = 216 km/h)
    const limit60 = computeSpeedSensitiveSteerLimit(60, cfg);
    assert.ok(limit60 < (15 * Math.PI / 180), 'At high speed limit must approach 12 deg');
    assert.ok(limit60 >= cfg.maxSteeringAngleHigh, 'Limit must never drop below maxSteeringAngleHigh');

    // Monotonicity check
    assert.ok(limit0 > limit5 && limit5 > limit18 && limit18 > limit60, 'Steering limit must decrease monotonically with speed');
  });

  // 4. Ackermann Steering Geometry
  await runTest('computeAckermannSteeringAngles ensures inner wheel turns sharper than outer wheel', async () => {
    const { computeAckermannSteeringAngles } = await import('../../src/scenes/driving/vehiclePhysicsUtils.js');
    const { VEHICLE_PHYSICS_CONFIG } = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');
    const cfg = VEHICLE_PHYSICS_CONFIG.steering;

    // Neutral (0 rad)
    const neutral = computeAckermannSteeringAngles(0, cfg);
    assert.strictEqual(neutral.steerFL, 0);
    assert.strictEqual(neutral.steerFR, 0);

    // Left Turn (+20 deg central angle)
    const leftSteerRad = (20 * Math.PI) / 180;
    const leftTurn = computeAckermannSteeringAngles(leftSteerRad, cfg);
    assert.ok(leftTurn.steerFL > leftSteerRad, 'Left turn inner FL wheel must steer sharper than central angle');
    assert.ok(leftTurn.steerFR < leftSteerRad, 'Left turn outer FR wheel must steer gentler than central angle');
    assert.ok(leftTurn.steerFL > leftTurn.steerFR, 'Inner wheel angle must be strictly greater than outer wheel angle');

    // Right Turn (-20 deg central angle)
    const rightSteerRad = -(20 * Math.PI) / 180;
    const rightTurn = computeAckermannSteeringAngles(rightSteerRad, cfg);
    assert.ok(Math.abs(rightTurn.steerFR) > Math.abs(rightSteerRad), 'Right turn inner FR wheel must steer sharper');
    assert.ok(Math.abs(rightTurn.steerFL) < Math.abs(rightSteerRad), 'Right turn outer FL wheel must steer gentler');
    assert.ok(Math.abs(rightTurn.steerFR) > Math.abs(rightTurn.steerFL), 'Right turn inner wheel magnitude must exceed outer wheel');
  });

  // 5. Stationary Stability Guarantee
  await runTest('Stationary stability: full steering at 0 m/s generates ZERO lateral force and ZERO yaw torque', async () => {
    const { computeTireLateralForces } = await import('../../src/scenes/driving/vehiclePhysicsUtils.js');
    const { VEHICLE_PHYSICS_CONFIG } = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');
    const cfg = VEHICLE_PHYSICS_CONFIG.steering;
    const normalLoads = { front: 7500, rear: 6700 };

    const resultStandstill = computeTireLateralForces(0.0, 0.0, 0.0, cfg.maxSteeringAngleLow, normalLoads, 1 / 60, cfg);

    assert.strictEqual(resultStandstill.totalLatForce, 0.0, 'Stationary lateral force must be exactly 0 N');
    assert.strictEqual(resultStandstill.yawTorque, 0.0, 'Stationary yaw torque must be exactly 0 N*m');
    assert.strictEqual(resultStandstill.latForceFront, 0.0, 'Stationary front tire force must be exactly 0 N');
    assert.strictEqual(resultStandstill.latForceRear, 0.0, 'Stationary rear tire force must be exactly 0 N');

    const resultCreep = computeTireLateralForces(0.001, 0.0, 0.0, cfg.maxSteeringAngleLow, normalLoads, 1 / 60, cfg);
    assert.ok(Math.abs(resultCreep.totalLatForce) < 50, 'Forces below threshold must scale smoothly down');
  });

  // 6. Dynamic Tire Cornering Forces and Friction Saturation
  await runTest('Tire cornering forces produce authentic lateral grip, yaw torque, and never exceed friction limit', async () => {
    const { computeTireLateralForces } = await import('../../src/scenes/driving/vehiclePhysicsUtils.js');
    const { VEHICLE_PHYSICS_CONFIG } = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');
    const cfg = VEHICLE_PHYSICS_CONFIG.steering;
    const normalLoads = { front: 7500, rear: 6700 };

    const steerAngle = (10 * Math.PI) / 180;
    const result = computeTireLateralForces(20.0, 0.0, 0.0, steerAngle, normalLoads, 1 / 60, cfg);

    assert.ok(result.latForceFront > 0, 'Front lateral tire force must push vehicle to the Left (+X)');
    assert.ok(result.totalLatForce > 0, 'Total lateral force must accelerate vehicle to the Left (+X)');
    assert.ok(result.yawTorque > 0, 'Yaw torque must be positive to turn heading to the Left');

    const maxFrontGrip = cfg.tireFrictionCoeff * normalLoads.front;
    const maxRearGrip = cfg.tireFrictionCoeff * normalLoads.rear;
    assert.ok(Math.abs(result.latForceFront) <= maxFrontGrip, 'Front lateral force must respect peak friction circle');
    assert.ok(Math.abs(result.latForceRear) <= maxRearGrip, 'Rear lateral force must respect peak friction circle');

    const saturatedResult = computeTireLateralForces(25.0, 5.0, 0.5, (45 * Math.PI) / 180, normalLoads, 1 / 60, cfg);
    assert.ok(Math.abs(saturatedResult.latForceFront) <= maxFrontGrip + 1e-4, 'Extreme turn must smoothly saturate at friction ceiling');
  });

  // 7. Steering Buildup Response Rate and Self-Centering
  await runTest('Steering response rate limits buildup and self-centering returns wheels to neutral', async () => {
    const { VEHICLE_PHYSICS_CONFIG } = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');
    const cfg = VEHICLE_PHYSICS_CONFIG.steering;
    const dt = 1 / 60;

    let currentAngle = 0.0;
    const targetAngle = cfg.maxSteeringAngleLow;
    const maxDelta = cfg.steeringResponseRate * dt;

    let steps = 0;
    while (currentAngle < targetAngle && steps < 120) {
      const diff = targetAngle - currentAngle;
      const step = Math.min(maxDelta, diff);
      currentAngle += step;
      steps++;
    }

    assert.ok(steps >= 6 && steps <= 20, `Steering buildup should take 6-20 ticks (took ${steps})`);
    assert.ok(Math.abs(currentAngle - targetAngle) < 1e-6, 'Steering angle must reach target');

    const maxCenterDelta = cfg.steeringCenteringRate * dt;
    let centerSteps = 0;
    while (currentAngle > 0 && centerSteps < 120) {
      if (currentAngle <= maxCenterDelta) {
        currentAngle = 0;
      } else {
        currentAngle -= maxCenterDelta;
      }
      centerSteps++;
    }

    assert.strictEqual(currentAngle, 0.0, 'Steering must self-center to exactly 0.0 rad');
    assert.ok(centerSteps >= 4 && centerSteps <= 15, `Self-centering should take 4-15 ticks (took ${centerSteps})`);
  });

  // 8. Dynamic Turning Circle Simulation
  await runTest('Simulated vehicle turns in smooth continuous arc with realistic turning radius', async () => {
    const {
      computeTireLateralForces,
      integrateRigidBodyStep,
    } = await import('../../src/scenes/driving/vehiclePhysicsUtils.js');
    const { VEHICLE_PHYSICS_CONFIG } = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');

    const dt = 1 / 60;
    const chassisCfg = VEHICLE_PHYSICS_CONFIG.chassis;
    const steeringCfg = VEHICLE_PHYSICS_CONFIG.steering;
    const normalLoads = {
      front: chassisCfg.mass * 9.81 * 0.52,
      rear: chassisCfg.mass * 9.81 * 0.48,
    };

    const state = {
      position: new THREE.Vector3(0, 0, 0),
      quaternion: new THREE.Quaternion(0, 0, 0, 1),
      linearVelocity: new THREE.Vector3(0, 0, 15.0),
      angularVelocity: new THREE.Vector3(0, 0, 0),
    };

    const steerAngle = (12 * Math.PI) / 180;
    const _totalForce = new THREE.Vector3();
    const _totalTorque = new THREE.Vector3();
    const _forwardVec = new THREE.Vector3();
    const _rightVec = new THREE.Vector3();
    const _upVec = new THREE.Vector3();

    for (let t = 0; t < 90; t++) {
      _forwardVec.set(0, 0, 1).applyQuaternion(state.quaternion);
      _rightVec.set(1, 0, 0).applyQuaternion(state.quaternion);
      _upVec.set(0, 1, 0).applyQuaternion(state.quaternion);

      const speedLong = state.linearVelocity.dot(_forwardVec);
      const speedLat = state.linearVelocity.dot(_rightVec);

      _totalForce.set(0, 0, 0);
      _totalTorque.set(0, 0, 0);

      const forces = computeTireLateralForces(speedLong, speedLat, state.angularVelocity.y, steerAngle, normalLoads, dt, steeringCfg);
      _totalForce.addScaledVector(_rightVec, forces.totalLatForce);
      _totalTorque.addScaledVector(_upVec, forces.yawTorque);

      integrateRigidBodyStep(state, _totalForce, _totalTorque, dt, chassisCfg);
    }

    assert.ok(state.position.x > 1.5, `Vehicle must have moved left: X = ${state.position.x.toFixed(2)}m`);
    assert.ok(state.position.z > 15.0, `Vehicle must have progressed forward: Z = ${state.position.z.toFixed(2)}m`);
    const euler = new THREE.Euler().setFromQuaternion(state.quaternion);
    assert.ok(euler.y > 0.15, `Vehicle heading must rotate left: yaw = ${(euler.y * 180 / Math.PI).toFixed(1)} deg`);
    assert.ok(!isNaN(state.position.x) && !isNaN(state.quaternion.x), 'Physics state must remain valid numbers with no NaNs');
  });

  // 9. Frame-Rate Independence of Steering Dynamics
  await runTest('Accumulator guarantees consistent steering trajectory across 30, 60, and 120 FPS', async () => {
    const {
      computeTireLateralForces,
      integrateRigidBodyStep,
    } = await import('../../src/scenes/driving/vehiclePhysicsUtils.js');
    const { VEHICLE_PHYSICS_CONFIG } = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');

    const simStep = VEHICLE_PHYSICS_CONFIG.simulation.timeStep;
    const chassisCfg = VEHICLE_PHYSICS_CONFIG.chassis;
    const steeringCfg = VEHICLE_PHYSICS_CONFIG.steering;
    const normalLoads = {
      front: chassisCfg.mass * 9.81 * 0.52,
      rear: chassisCfg.mass * 9.81 * 0.48,
    };

    function runSimulationWithFPS(renderFps) {
      const renderDelta = 1 / renderFps;
      const totalSimTime = 1.0;
      let accumulator = 0;

      const state = {
        position: new THREE.Vector3(0, 0, 0),
        quaternion: new THREE.Quaternion(0, 0, 0, 1),
        linearVelocity: new THREE.Vector3(0, 0, 12.0),
        angularVelocity: new THREE.Vector3(0, 0, 0),
      };

      const _totalForce = new THREE.Vector3();
      const _totalTorque = new THREE.Vector3();
      const _forwardVec = new THREE.Vector3();
      const _rightVec = new THREE.Vector3();
      const _upVec = new THREE.Vector3();
      const steerAngle = (10 * Math.PI) / 180;

      const totalFrames = Math.round(totalSimTime * renderFps);
      for (let f = 0; f < totalFrames; f++) {
        accumulator += renderDelta;
        while (accumulator >= simStep) {
          _forwardVec.set(0, 0, 1).applyQuaternion(state.quaternion);
          _rightVec.set(1, 0, 0).applyQuaternion(state.quaternion);
          _upVec.set(0, 1, 0).applyQuaternion(state.quaternion);

          const speedLong = state.linearVelocity.dot(_forwardVec);
          const speedLat = state.linearVelocity.dot(_rightVec);

          _totalForce.set(0, 0, 0);
          _totalTorque.set(0, 0, 0);

          const forces = computeTireLateralForces(speedLong, speedLat, state.angularVelocity.y, steerAngle, normalLoads, simStep, steeringCfg);
          _totalForce.addScaledVector(_rightVec, forces.totalLatForce);
          _totalTorque.addScaledVector(_upVec, forces.yawTorque);

          integrateRigidBodyStep(state, _totalForce, _totalTorque, simStep, chassisCfg);
          accumulator -= simStep;
        }
      }
      return {
        x: state.position.x,
        z: state.position.z,
        yaw: new THREE.Euler().setFromQuaternion(state.quaternion).y,
      };
    }

    const res30 = runSimulationWithFPS(30);
    const res60 = runSimulationWithFPS(60);
    const res120 = runSimulationWithFPS(120);

    const deltaX = Math.abs(res30.x - res120.x);
    const deltaYaw = Math.abs(res30.yaw - res120.yaw);

    assert.ok(deltaX < 0.05, `Trajectory X variation must be < 5cm (delta = ${deltaX.toFixed(4)}m)`);
    assert.ok(deltaYaw < 0.02, `Heading variation must be < 0.02 rad (delta = ${deltaYaw.toFixed(4)} rad)`);
  });

  // 10. Vehicle Physics Store Telemetry & Lifecycle Cleanliness
  await runTest('useVehiclePhysicsStore updates steering telemetry and resets state cleanly on disposal', async () => {
    const { useVehiclePhysicsStore } = await import('../../src/store/vehiclePhysicsStore.js');

    useVehiclePhysicsStore.getState().initializePhysics();
    let state = useVehiclePhysicsStore.getState();
    assert.strictEqual(state.steering.centralAngleDeg, 0);
    assert.strictEqual(state.steering.lateralG, 0);

    useVehiclePhysicsStore.getState().updateTelemetry({
      steering: {
        steeringInput: -1.0,
        centralAngleDeg: 28.5,
        centralAngleRad: 0.4974,
        angleFLDeg: 31.2,
        angleFLRad: 0.5445,
        angleFRDeg: 26.1,
        angleFRRad: 0.4555,
        maxSteerLimitDeg: 30.0,
        yawRateDeg: 14.2,
        yawRateRad: 0.2478,
        lateralG: 0.45,
        lateralForceTotal: 6450,
        isSteering: true,
      },
    });

    state = useVehiclePhysicsStore.getState();
    assert.strictEqual(state.steering.centralAngleDeg, 28.5);
    assert.strictEqual(state.steering.angleFLDeg, 31.2);
    assert.strictEqual(state.steering.angleFRDeg, 26.1);
    assert.strictEqual(state.steering.lateralG, 0.45);
    assert.strictEqual(state.steering.isSteering, true);

    useVehiclePhysicsStore.getState().disposePhysics();
    state = useVehiclePhysicsStore.getState();
    assert.strictEqual(state.isSimulating, false);
    assert.strictEqual(state.steering.centralAngleDeg, 0);
    assert.strictEqual(state.steering.lateralG, 0);
  });

  // Summary
  console.log(`\nResults: ${passedTests} / ${passedTests + failedTests} unit tests passed successfully.\n`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
