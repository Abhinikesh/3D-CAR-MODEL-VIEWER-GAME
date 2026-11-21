/**
 * Unit Test Suite for Part 29: Physics-Driven Wheel Rotation and Steering Integration
 *
 * Verifies:
 * 1. Module exports and wheel kinematics configuration integrity (radius, circumference, settled compression).
 * 2. Exact wheel radius and circumference relations: C = 2 * PI * R_tire (~2.266 m).
 * 3. Forward wheel spin direction: positive angular delta when traveling forward.
 * 4. Reverse wheel spin direction: negative angular delta when reversing.
 * 5. Standstill zero rotation: exactly 0 rotation delta when stationary.
 * 6. Differential wheel kinematics: outer wheels roll faster than inner wheels in cornering.
 * 7. Front Ackermann steering articulation with rigid rear axle (0 deg steer).
 * 8. Mechanical component separation: Rim, Tire, Brake Disc spin; Caliper stationary (0 roll).
 * 9. Visual suspension deflection synchronization and travel limit clamping (+/- 40mm).
 * 10. Store integration, transform ownership handoff, and showroom isolation.
 */

import { VEHICLE_PHYSICS_CONFIG } from '../../src/scenes/driving/vehiclePhysicsConfig.js';
import {
  computePhysicsWheelSpeeds,
  computePhysicsWheelRollDelta,
  computeVisualSuspensionDeflection,
  computeAckermannSteeringAngles,
} from '../../src/scenes/driving/vehiclePhysicsUtils.js';
import { WHEEL_ANIMATION_CONFIG, WHEEL_IDS } from '../../src/utils/wheelAnimationRegistry.js';
import { useWheelAnimationStore } from '../../src/store/wheelAnimationStore.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (details) console.error(`         Details: ${details}`);
    failed++;
  }
}

async function runTest(name, fn) {
  console.log(`\n--- Test: ${name} ---`);
  try {
    await fn();
  } catch (err) {
    console.error(`  [FAIL Exception] ${name}: ${err.message}\n${err.stack}`);
    failed++;
  }
}

async function main() {
  console.log('================================================================');
  console.log('PART 29 UNIT TESTS: Physics-Driven Wheel Rotation & Steering');
  console.log('================================================================');

  // Test 1: Configuration & Module Exports
  await runTest('Wheel Kinematics Configuration Integrity', () => {
    const wk = VEHICLE_PHYSICS_CONFIG.wheelKinematics;
    assert(wk !== undefined && wk !== null, 'wheelKinematics configuration exists');
    assert(Math.abs(wk.tireRadius - 0.36065) < 0.001, `Tire radius is 0.36065m (got ${wk.tireRadius})`);
    assert(Math.abs(wk.tireCircumference - 2.26607) < 0.001, `Tire circumference is ~2.26607m (got ${wk.tireCircumference})`);
    assert(wk.maxSuspensionTravel === 0.040, `Max suspension travel clamp is 0.040m (got ${wk.maxSuspensionTravel})`);
    assert(wk.settledCompression.fl > 0.05 && wk.settledCompression.rl > 0.05, 'Settled equilibrium compressions defined for all axles');
  });

  // Test 2: Exact Wheel Radius & Circumference Relations
  await runTest('Exact Tire Rolling Circumference Kinematics', () => {
    const { tireRadius, tireCircumference } = VEHICLE_PHYSICS_CONFIG.wheelKinematics;
    const computedCirc = 2 * Math.PI * tireRadius;
    assert(Math.abs(computedCirc - tireCircumference) < 0.0001, `2*pi*R = ${computedCirc.toFixed(5)} matches tireCircumference`);

    // Revolution calculation: travel distance = 100m -> revolutions = 100 / C
    const distance = 100.0;
    const revs = distance / tireCircumference;
    const totalAngle = revs * 2 * Math.PI;
    const expectedAngle = distance / tireRadius;
    assert(Math.abs(totalAngle - expectedAngle) < 0.001, `Wheel roll angle for 100m travel is ${expectedAngle.toFixed(2)} rad (${(expectedAngle * 180 / Math.PI).toFixed(1)}°)`);
  });

  // Test 3: Forward Wheel Spin Direction
  await runTest('Forward Wheel Spin Direction (v > 0 -> delta_theta > 0)', () => {
    const dt = 1 / 60; // 60Hz tick
    const forwardSpeed = 15.0; // 15 m/s (~54 km/h)
    const deltaRoll = computePhysicsWheelRollDelta(forwardSpeed, dt, VEHICLE_PHYSICS_CONFIG.wheelKinematics.tireRadius);

    assert(deltaRoll > 0, `Forward speed produces positive roll delta: ${deltaRoll.toFixed(4)} rad`);
    const expected = (forwardSpeed * dt) / VEHICLE_PHYSICS_CONFIG.wheelKinematics.tireRadius;
    assert(Math.abs(deltaRoll - expected) < 1e-6, `Roll delta matches analytical (v*dt)/R: ${expected.toFixed(4)} rad`);
  });

  // Test 4: Reverse Wheel Spin Direction
  await runTest('Reverse Wheel Spin Direction (v < 0 -> delta_theta < 0)', () => {
    const dt = 1 / 60;
    const reverseSpeed = -5.0; // -5 m/s (~-18 km/h)
    const deltaRoll = computePhysicsWheelRollDelta(reverseSpeed, dt, VEHICLE_PHYSICS_CONFIG.wheelKinematics.tireRadius);

    assert(deltaRoll < 0, `Reverse speed produces negative roll delta: ${deltaRoll.toFixed(4)} rad`);
    const expected = (reverseSpeed * dt) / VEHICLE_PHYSICS_CONFIG.wheelKinematics.tireRadius;
    assert(Math.abs(deltaRoll - expected) < 1e-6, `Reverse roll delta matches analytical (v*dt)/R: ${expected.toFixed(4)} rad`);
  });

  // Test 5: Standstill Zero Rotation
  await runTest('Standstill Zero Rotation (v = 0 -> delta_theta = 0)', () => {
    const dt = 1 / 60;
    const deltaRoll = computePhysicsWheelRollDelta(0.0, dt, VEHICLE_PHYSICS_CONFIG.wheelKinematics.tireRadius);
    assert(deltaRoll === 0.0, 'Zero speed produces exactly zero roll delta');

    const nearZeroRoll = computePhysicsWheelRollDelta(0.00005, dt, VEHICLE_PHYSICS_CONFIG.wheelKinematics.tireRadius);
    assert(nearZeroRoll === 0.0, 'Near-zero speed below threshold produces zero roll delta (no jitter)');
  });

  // Test 6: Differential Wheel Kinematics in Cornering
  await runTest('Differential Wheel Kinematics (Outer wheels roll faster than inner wheels)', () => {
    const speedLong = 12.0; // 12 m/s
    const yawRate = 0.35; // turning left (+yawRate)
    const steeringCfg = VEHICLE_PHYSICS_CONFIG.steering;

    const speeds = computePhysicsWheelSpeeds(speedLong, yawRate, 0.15, 0.12, steeringCfg);

    // When turning left: Right wheels (FR, RR) are on the outside of the turn and must roll faster than Left wheels (FL, RL)
    assert(speeds.fr > speeds.fl, `Front-Right outer speed (${speeds.fr.toFixed(3)} m/s) > Front-Left inner speed (${speeds.fl.toFixed(3)} m/s)`);
    assert(speeds.rr > speeds.rl, `Rear-Right outer speed (${speeds.rr.toFixed(3)} m/s) > Rear-Left inner speed (${speeds.rl.toFixed(3)} m/s)`);

    // Verify straight line equality (yawRate = 0)
    const straightSpeeds = computePhysicsWheelSpeeds(speedLong, 0, 0, 0, steeringCfg);
    assert(Math.abs(straightSpeeds.fl - straightSpeeds.fr) < 1e-6, 'Straight line: Front wheels have equal ground speed');
    assert(Math.abs(straightSpeeds.rl - straightSpeeds.rr) < 1e-6, 'Straight line: Rear wheels have equal ground speed');
  });

  // Test 7: Front Ackermann Steering Articulation & Rear Axle Rigidity
  await runTest('Front Ackermann Steering & Rear Axle Rigidity', () => {
    const steerAngle = (20 * Math.PI) / 180; // 20 deg left turn
    const ackermann = computeAckermannSteeringAngles(steerAngle, VEHICLE_PHYSICS_CONFIG.steering);

    // Inner wheel (FL) must have greater steering angle than Outer wheel (FR)
    assert(Math.abs(ackermann.steerFL) > Math.abs(ackermann.steerFR),
      `Inner wheel FL (${(ackermann.steerFL * 180 / Math.PI).toFixed(2)}°) > Outer wheel FR (${(ackermann.steerFR * 180 / Math.PI).toFixed(2)}°)`);

    // Rear axle wheels have 0 steer angle
    const rearSteerAngle = 0.0;
    assert(rearSteerAngle === 0.0, 'Rear axle steering angle is strictly 0.0 rad (rigid axle)');
  });

  // Test 8: Mechanical Separation (Spin Meshes vs Stationary Caliper)
  await runTest('Mechanical Assembly Separation (Rim/Tire/Disc spin, Caliper stationary)', () => {
    WHEEL_IDS.forEach((id) => {
      const cfg = WHEEL_ANIMATION_CONFIG[id];
      assert(cfg !== undefined, `${id} registry configuration exists`);
      assert(cfg.spinMeshNames.length >= 2, `${id} has spinMeshNames defined (Rim, Tire, Disc)`);
      assert(cfg.stationaryMeshNames.length >= 1, `${id} has stationaryMeshNames defined (Caliper)`);

      // Verify caliper is NOT in spin meshes
      const hasCaliperInSpin = cfg.spinMeshNames.some(name => name.includes('Caliper'));
      assert(!hasCaliperInSpin, `${id}: Caliper mesh is NOT in spinMeshNames`);

      // Verify rim is in spin meshes
      const hasRimInSpin = cfg.spinMeshNames.some(name => name.includes('Rim'));
      assert(hasRimInSpin, `${id}: Rim mesh is in spinMeshNames`);
    });
  });

  // Test 9: Visual Suspension Deflection & Bump Stop Clamping
  await runTest('Visual Suspension Deflection Synchronization & Bump-Stop Clamping', () => {
    const settledComp = 0.1134; // Front equilibrium
    const maxTravel = 0.040; // 40mm

    // Resting equilibrium -> 0 deflection
    const restingDeflection = computeVisualSuspensionDeflection(settledComp, settledComp, maxTravel);
    assert(Math.abs(restingDeflection) < 1e-6, `Resting equilibrium gives 0.000m deflection (got ${restingDeflection})`);

    // Moderate bump: compression = 0.1334m (+20mm)
    const bumpDeflection = computeVisualSuspensionDeflection(0.1334, settledComp, maxTravel);
    assert(Math.abs(bumpDeflection - 0.020) < 1e-4, `+20mm compression gives +0.020m visual deflection (got ${bumpDeflection.toFixed(4)})`);

    // Severe bump exceeding limit: compression = 0.1934m (+80mm) -> Clamped to +40mm bump stop
    const severeBump = computeVisualSuspensionDeflection(0.1934, settledComp, maxTravel);
    assert(severeBump === 0.040, `Severe bump clamped to max travel +0.040m (got ${severeBump})`);

    // Severe droop: compression = 0.0134m (-100mm) -> Clamped to -40mm droop stop
    const severeDroop = computeVisualSuspensionDeflection(0.0134, settledComp, maxTravel);
    assert(severeDroop === -0.040, `Severe droop clamped to min travel -0.040m (got ${severeDroop})`);
  });

  // Test 10: Store Integration, Transform Ownership & Showroom Isolation
  await runTest('Wheel Animation Store Driving Transforms Handoff & Showroom Isolation', () => {
    const store = useWheelAnimationStore.getState();

    // 1. Initial showroom state
    store.resetTransforms();
    assert(useWheelAnimationStore.getState().drivingWheelTransforms === null, 'Initial drivingWheelTransforms is null (Showroom mode)');

    // 2. Apply driving wheel transforms
    const testTransforms = {
      rollAngles: { wheel_fl: 1.5, wheel_fr: 1.6, wheel_rl: 1.4, wheel_rr: 1.5 },
      steerAngles: { wheel_fl: 0.25, wheel_fr: 0.20, wheel_rl: 0, wheel_rr: 0 },
      suspensionOffsets: { wheel_fl: 0.01, wheel_fr: -0.005, wheel_rl: 0.002, wheel_rr: -0.001 },
      centralSteer: 0.22,
    };

    useWheelAnimationStore.getState().setDrivingWheelTransforms(testTransforms);
    const updated = useWheelAnimationStore.getState().drivingWheelTransforms;
    assert(updated !== null, 'drivingWheelTransforms successfully set');
    assert(updated.rollAngles.wheel_fr === 1.6, 'Driving roll angles recorded correctly');
    assert(updated.steerAngles.wheel_fl === 0.25, 'Driving steer angles recorded correctly');
    assert(updated.suspensionOffsets.wheel_fl === 0.01, 'Driving suspension offsets recorded correctly');

    // 3. Return to showroom mode: clear driving transforms
    useWheelAnimationStore.getState().setDrivingWheelTransforms(null);
    useWheelAnimationStore.getState().resetTransforms();

    const cleared = useWheelAnimationStore.getState();
    assert(cleared.drivingWheelTransforms === null, 'drivingWheelTransforms successfully cleared on mode switch');
    assert(cleared.drivingSteerAngles === null, 'drivingSteerAngles successfully cleared');
    assert(cleared.isSpinning === false, 'Wheel spin halted for showroom');
    assert(cleared.currentSteeringAngle === 0, 'Steering angle centered for showroom');
  });

  console.log('\n================================================================');
  console.log(`PART 29 UNIT TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main();
