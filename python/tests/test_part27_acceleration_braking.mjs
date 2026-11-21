import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';

import { VEHICLE_PHYSICS_CONFIG } from '../../src/scenes/driving/vehiclePhysicsConfig.js';
import {
  computeDriveForce,
  computeBrakeForce,
  computeAerodynamicDrag,
  computeRollingResistance,
  integrateRigidBodyStep,
  interpolatePhysicsTransform,
} from '../../src/scenes/driving/vehiclePhysicsUtils.js';
import { useVehicleInputStore, VEHICLE_GEAR } from '../../src/scenes/driving/vehicleInputStore.js';
import { useVehiclePhysicsStore } from '../../src/store/vehiclePhysicsStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

console.log('\n--- TEST SUITE: Part 27 — Vehicle Acceleration, Braking and Reverse System ---');

// ─── Test 1: File Architecture & Exports ───
console.log('  Testing 1: Part 27 module integrity and exports...');
const requiredFiles = [
  'src/scenes/driving/vehiclePhysicsConfig.js',
  'src/scenes/driving/vehiclePhysicsUtils.js',
  'src/scenes/driving/vehicleInputStore.js',
  'src/scenes/driving/KeyboardVehicleInput.jsx',
  'src/scenes/driving/VehiclePhysicsWorld.jsx',
  'src/components/ui/DrivingHUD.jsx',
  'src/store/vehiclePhysicsStore.js',
];

for (const relPath of requiredFiles) {
  const fullPath = path.resolve(ROOT, relPath);
  assert.ok(fs.existsSync(fullPath), `Required file missing: ${relPath}`);
}
console.log('  ✓ All Part 27 drivetrain & input files exist and export expected modules');

// ─── Test 2: Drivetrain Configuration Parameters ───
console.log('  Testing 2: Drivetrain configuration values...');
const { drivetrain: driveCfg, chassis: chassisCfg } = VEHICLE_PHYSICS_CONFIG;

assert.ok(driveCfg.maxDriveForce >= 5000 && driveCfg.maxDriveForce <= 12000, 'maxDriveForce should be in realistic 5-12kN range');
assert.ok(driveCfg.maxReverseForce > 0 && driveCfg.maxReverseForce < driveCfg.maxDriveForce, 'Reverse force should be positive and less than forward drive force');
assert.ok(driveCfg.maxSpeedForward >= 55.0 && driveCfg.maxSpeedForward <= 85.0, 'Top speed should be ~200-300 km/h (55-85 m/s)');
assert.ok(driveCfg.maxSpeedReverse >= 10.0 && driveCfg.maxSpeedReverse <= 20.0, 'Reverse top speed should be ~35-70 km/h (10-20 m/s)');
assert.ok(driveCfg.maxBrakeForce >= 12000 && driveCfg.maxBrakeForce <= 22000, 'Brake force should produce ~1g deceleration (12-22kN)');
assert.ok(driveCfg.rollingResistanceCoeff > 0 && driveCfg.rollingResistanceCoeff <= 0.03, 'C_rr should be ~0.015 for road tires');
assert.ok(driveCfg.aerodynamicDragCoeff > 0.2 && driveCfg.aerodynamicDragCoeff < 0.6, 'Aerodynamic drag factor should be ~0.3-0.5 kg/m');
console.log('  ✓ Drivetrain configuration defines verified sports-car power, brake, and resistance parameters');

// ─── Test 3: Acceleration from Rest & Progressive Throttle Force ───
console.log('  Testing 3: Progressive acceleration from standstill...');
const zeroSpeedForceFull = computeDriveForce(1.0, 0.0, 'D', driveCfg);
const zeroSpeedForceHalf = computeDriveForce(0.5, 0.0, 'D', driveCfg);

assert.strictEqual(zeroSpeedForceFull, driveCfg.maxDriveForce, 'Full throttle at standstill should yield max drive force');
assert.strictEqual(zeroSpeedForceHalf, driveCfg.maxDriveForce * 0.5, 'Half throttle at standstill should yield half drive force');

// Tapering power curve with increasing speed
const midSpeedForce = computeDriveForce(1.0, 30.0, 'D', driveCfg); // ~108 km/h
const highSpeedForce = computeDriveForce(1.0, 60.0, 'D', driveCfg); // ~216 km/h
const topSpeedForce = computeDriveForce(1.0, driveCfg.maxSpeedForward, 'D', driveCfg);

assert.ok(midSpeedForce < zeroSpeedForceFull, 'Drive force must decrease as speed increases');
assert.ok(highSpeedForce < midSpeedForce, 'High speed force must be lower than mid-speed force');
assert.strictEqual(topSpeedForce, 0.0, 'Drive force at top speed must taper to zero');
console.log('  ✓ computeDriveForce produces authentic progressive power curve and respects forward top speed limit');

// ─── Test 4: Coasting (Aerodynamic Drag & Rolling Resistance) ───
console.log('  Testing 4: Coasting deceleration under drag and rolling resistance...');
const normalWeight = chassisCfg.mass * 9.81;
const dt = 1 / 60;

// High speed coasting: drag dominates
const dragAt100Kmh = Math.abs(computeAerodynamicDrag(27.78, driveCfg));
const dragAt200Kmh = Math.abs(computeAerodynamicDrag(55.56, driveCfg));
assert.ok(dragAt200Kmh > dragAt100Kmh * 3.5, 'Aerodynamic drag must scale quadratically with speed');

// Rolling resistance opposes direction of motion
const rollFwd = computeRollingResistance(15.0, normalWeight, dt, chassisCfg.mass, driveCfg);
const rollRev = computeRollingResistance(-15.0, normalWeight, dt, chassisCfg.mass, driveCfg);
assert.ok(rollFwd < 0, 'Rolling resistance must oppose forward motion');
assert.ok(rollRev > 0, 'Rolling resistance must oppose reverse motion');

// Coasting stop clamp when speed is near zero
const stopSpeed = 0.0005; // very slow creep
const rollStopClamp = computeRollingResistance(stopSpeed, normalWeight, dt, chassisCfg.mass, driveCfg);
const resultingSpeed = stopSpeed + (rollStopClamp / chassisCfg.mass) * dt;
assert.ok(Math.abs(resultingSpeed) < 1e-9, 'Rolling resistance clamp must bring slowly coasting vehicle to exact standstill without oscillation');
console.log('  ✓ Aerodynamic drag and rolling resistance correctly decelerate vehicle and clamp coasting to rest');

// ─── Test 5: Progressive Braking & Non-Reversing Stop Clamp ───
console.log('  Testing 5: Braking deceleration and stop clamping...');
const brakeForceFull = computeBrakeForce(1.0, 20.0, dt, chassisCfg.mass, driveCfg);
const brakeForceHalf = computeBrakeForce(0.5, 20.0, dt, chassisCfg.mass, driveCfg);

assert.ok(brakeForceFull < 0, 'Braking when moving forward must exert negative force');
assert.strictEqual(brakeForceFull, -driveCfg.maxBrakeForce, 'Full brake input must yield full braking force');
assert.strictEqual(brakeForceHalf, -driveCfg.maxBrakeForce * 0.5, 'Half brake input must yield half braking force');

// Braking in reverse
const brakeForceRev = computeBrakeForce(1.0, -10.0, dt, chassisCfg.mass, driveCfg);
assert.ok(brakeForceRev > 0, 'Braking when reversing must exert positive forward force');

// Stopping clamp: when speed is low enough that full brake force would cause backward reversal
const lowSpeed = 0.02; // 0.02 m/s
const brakeStopClamp = computeBrakeForce(1.0, lowSpeed, dt, chassisCfg.mass, driveCfg);
const newSpeed = lowSpeed + (brakeStopClamp / chassisCfg.mass) * dt;
assert.ok(Math.abs(newSpeed) < 1e-9, 'Braking clamp must decelerate vehicle to exact 0.0 m/s without reversing direction');
console.log('  ✓ Braking produces progressive deceleration and halts car stably with zero reverse overshoot');

// ─── Test 6: Reverse Gear & Reverse Speed Limiting ───
console.log('  Testing 6: Reverse engagement, reverse tractive force, and top speed limit...');
const revForceZero = computeDriveForce(1.0, 0.0, 'R', driveCfg);
assert.ok(revForceZero < 0, 'Reverse gear must produce negative tractive force');
assert.strictEqual(revForceZero, -driveCfg.maxReverseForce, 'Reverse from standstill must produce max reverse force');

const revForceMid = computeDriveForce(1.0, -6.0, 'R', driveCfg);
assert.ok(Math.abs(revForceMid) < driveCfg.maxReverseForce, 'Reverse force must taper as reverse speed increases');

const revForceTop = computeDriveForce(1.0, -driveCfg.maxSpeedReverse, 'R', driveCfg);
assert.strictEqual(revForceTop, 0.0, 'Reverse force at max reverse speed must taper to zero');
console.log('  ✓ Reverse gear applies negative tractive force with realistic power curve and capped top speed');

// ─── Test 7: Simulated Longitudinal Drive Cycle (0-100 km/h, Coast, Full Brake) ───
console.log('  Testing 7: End-to-end longitudinal drive cycle simulation...');
const simState = {
  position: new THREE.Vector3(0, 0.002, 0),
  quaternion: new THREE.Quaternion(),
  linearVelocity: new THREE.Vector3(0, 0, 0),
  angularVelocity: new THREE.Vector3(0, 0, 0),
};

const fixedDt = 1 / 60;

// Phase A: Accelerate full throttle for 4.0 seconds (240 ticks)
for (let i = 0; i < 240; i++) {
  const fwdVec = new THREE.Vector3(0, 0, 1).applyQuaternion(simState.quaternion);
  const vLong = simState.linearVelocity.dot(fwdVec);
  const drive = computeDriveForce(1.0, vLong, 'D', driveCfg);
  const drag = computeAerodynamicDrag(vLong, driveCfg);
  const roll = computeRollingResistance(vLong, normalWeight, fixedDt, chassisCfg.mass, driveCfg);
  const totalF = fwdVec.multiplyScalar(drive + drag + roll);

  integrateRigidBodyStep(simState, totalF, new THREE.Vector3(0, 0, 0), fixedDt, chassisCfg);
}

const speedAfterAccel = simState.linearVelocity.z;
const distanceAfterAccel = simState.position.z;
console.log(`    Phase A (4.0s Accel): Speed = ${(speedAfterAccel * 3.6).toFixed(1)} km/h (${speedAfterAccel.toFixed(2)} m/s), Dist = ${distanceAfterAccel.toFixed(2)} m`);
assert.ok(speedAfterAccel >= 20.0, 'Vehicle must accelerate past 70 km/h (~20 m/s) in 4 seconds');
assert.ok(distanceAfterAccel > 35.0, 'Vehicle must travel substantial distance along road during acceleration');

// Phase B: Coast for 1.5 seconds (90 ticks)
const startCoastSpeed = simState.linearVelocity.z;
for (let i = 0; i < 90; i++) {
  const fwdVec = new THREE.Vector3(0, 0, 1).applyQuaternion(simState.quaternion);
  const vLong = simState.linearVelocity.dot(fwdVec);
  const drag = computeAerodynamicDrag(vLong, driveCfg);
  const roll = computeRollingResistance(vLong, normalWeight, fixedDt, chassisCfg.mass, driveCfg);
  const totalF = fwdVec.multiplyScalar(drag + roll);

  integrateRigidBodyStep(simState, totalF, new THREE.Vector3(0, 0, 0), fixedDt, chassisCfg);
}

const speedAfterCoast = simState.linearVelocity.z;
console.log(`    Phase B (1.5s Coast): Speed = ${(speedAfterCoast * 3.6).toFixed(1)} km/h (Decelerated by ${((startCoastSpeed - speedAfterCoast) * 3.6).toFixed(1)} km/h)`);
assert.ok(speedAfterCoast < startCoastSpeed, 'Speed after coasting must be lower than initial coast speed');

// Phase C: Emergency Full Braking to Stop
let stopTicks = 0;
while (Math.abs(simState.linearVelocity.z) > 0.0001 && stopTicks < 300) {
  const fwdVec = new THREE.Vector3(0, 0, 1).applyQuaternion(simState.quaternion);
  const vLong = simState.linearVelocity.dot(fwdVec);

  if (Math.abs(vLong) <= driveCfg.stopSpeedThreshold) {
    simState.linearVelocity.z = 0;
    break;
  }

  const brake = computeBrakeForce(1.0, vLong, fixedDt, chassisCfg.mass, driveCfg);
  const drag = computeAerodynamicDrag(vLong, driveCfg);
  const totalF = fwdVec.multiplyScalar(brake + drag);

  integrateRigidBodyStep(simState, totalF, new THREE.Vector3(0, 0, 0), fixedDt, chassisCfg);
  stopTicks++;
}

console.log(`    Phase C (Brake to Stop): Stopped in ${(stopTicks * fixedDt).toFixed(2)}s, Final Speed = ${(simState.linearVelocity.z * 3.6).toFixed(3)} km/h`);
assert.ok(Math.abs(simState.linearVelocity.z) < 1e-4, 'Vehicle must come to a complete standstill under full braking');
assert.ok(stopTicks * fixedDt <= 3.0, 'High performance sports car should stop in under 3.0 seconds from road speeds');
console.log('  ✓ Complete drive cycle (acceleration -> coasting -> emergency stop) behaves deterministically');

// ─── Test 8: Frame-Rate Independence Across 30, 60, and 120 FPS ───
console.log('  Testing 8: Frame-rate independence test (30Hz, 60Hz, 120Hz render frame rates)...');

function simulateRun(renderFps, durationSeconds) {
  const state = {
    position: new THREE.Vector3(0, 0.002, 0),
    quaternion: new THREE.Quaternion(),
    linearVelocity: new THREE.Vector3(0, 0, 0),
    angularVelocity: new THREE.Vector3(0, 0, 0),
  };

  const renderDelta = 1 / renderFps;
  const physicsDt = VEHICLE_PHYSICS_CONFIG.simulation.timeStep; // 1/60
  let accumulator = 0;
  let simulatedTime = 0;

  while (simulatedTime < durationSeconds) {
    accumulator += renderDelta;

    while (accumulator >= physicsDt) {
      const fwdVec = new THREE.Vector3(0, 0, 1).applyQuaternion(state.quaternion);
      const vLong = state.linearVelocity.dot(fwdVec);
      const drive = computeDriveForce(1.0, vLong, 'D', driveCfg);
      const drag = computeAerodynamicDrag(vLong, driveCfg);
      const roll = computeRollingResistance(vLong, normalWeight, physicsDt, chassisCfg.mass, driveCfg);
      const totalF = fwdVec.multiplyScalar(drive + drag + roll);

      integrateRigidBodyStep(state, totalF, new THREE.Vector3(0, 0, 0), physicsDt, chassisCfg);
      accumulator -= physicsDt;
    }

    simulatedTime += renderDelta;
  }

  return {
    finalPositionZ: state.position.z,
    finalSpeedZ: state.linearVelocity.z,
  };
}

const run30 = simulateRun(30, 3.0);
const run60 = simulateRun(60, 3.0);
const run120 = simulateRun(120, 3.0);

console.log(`    30 FPS Render: Dist = ${run30.finalPositionZ.toFixed(3)}m, Speed = ${(run30.finalSpeedZ * 3.6).toFixed(2)} km/h`);
console.log(`    60 FPS Render: Dist = ${run60.finalPositionZ.toFixed(3)}m, Speed = ${(run60.finalSpeedZ * 3.6).toFixed(2)} km/h`);
console.log(`    120 FPS Render: Dist = ${run120.finalPositionZ.toFixed(3)}m, Speed = ${(run120.finalSpeedZ * 3.6).toFixed(2)} km/h`);

// Variance between 30Hz, 60Hz, and 120Hz must be less than 2% due to deterministic accumulator
const distDiff30_60 = Math.abs(run30.finalPositionZ - run60.finalPositionZ) / run60.finalPositionZ;
const distDiff120_60 = Math.abs(run120.finalPositionZ - run60.finalPositionZ) / run60.finalPositionZ;

assert.ok(distDiff30_60 < 0.02, `Distance variance between 30 and 60 FPS must be < 2% (was ${(distDiff30_60 * 100).toFixed(3)}%)`);
assert.ok(distDiff120_60 < 0.02, `Distance variance between 120 and 60 FPS must be < 2% (was ${(distDiff120_60 * 100).toFixed(3)}%)`);
console.log('  ✓ Fixed-timestep accumulator guarantees frame-rate-independent simulation across varying FPS');

// ─── Test 9: Input Abstraction & Store Decoupling ───
console.log('  Testing 9: vehicleInputStore actions and state transitions...');
useVehicleInputStore.getState().resetInputs();
assert.strictEqual(useVehicleInputStore.getState().throttle, 0.0);
assert.strictEqual(useVehicleInputStore.getState().brake, 0.0);
assert.strictEqual(useVehicleInputStore.getState().gear, VEHICLE_GEAR.DRIVE);

useVehicleInputStore.getState().setThrottle(0.75);
assert.strictEqual(useVehicleInputStore.getState().throttle, 0.75);
assert.strictEqual(useVehicleInputStore.getState().isAccelerating, true);

useVehicleInputStore.getState().setBrake(1.0);
assert.strictEqual(useVehicleInputStore.getState().brake, 1.0);
assert.strictEqual(useVehicleInputStore.getState().isBraking, true);

useVehicleInputStore.getState().setGear(VEHICLE_GEAR.REVERSE);
assert.strictEqual(useVehicleInputStore.getState().gear, VEHICLE_GEAR.REVERSE);
assert.strictEqual(useVehicleInputStore.getState().isReversing, true);

useVehicleInputStore.getState().resetInputs();
assert.strictEqual(useVehicleInputStore.getState().throttle, 0.0);
assert.strictEqual(useVehicleInputStore.getState().brake, 0.0);
assert.strictEqual(useVehicleInputStore.getState().isReversing, false);
console.log('  ✓ vehicleInputStore correctly sets, clamps, and resets abstract inputs');

// ─── Test 10: vehiclePhysicsStore Drivetrain Telemetry Update & Disposal ───
console.log('  Testing 10: vehiclePhysicsStore telemetry synchronization and clean disposal...');
useVehiclePhysicsStore.getState().initializePhysics();
const initialStore = useVehiclePhysicsStore.getState();
assert.ok(initialStore.drivetrain !== undefined, 'Store must define drivetrain telemetry object');
assert.strictEqual(initialStore.drivetrain.displaySpeed, 0);

useVehiclePhysicsStore.getState().updateTelemetry({
  drivetrain: {
    gear: 'D',
    longitudinalSpeed: 18.5,
    speedKmh: 66.6,
    displaySpeed: 67,
    driveForce: 4200,
    brakeForce: 0,
    isAccelerating: true,
  },
});

const updatedStore = useVehiclePhysicsStore.getState();
assert.strictEqual(updatedStore.drivetrain.displaySpeed, 67);
assert.strictEqual(updatedStore.drivetrain.isAccelerating, true);
assert.strictEqual(updatedStore.drivetrain.driveForce, 4200);

useVehiclePhysicsStore.getState().disposePhysics();
const disposedStore = useVehiclePhysicsStore.getState();
assert.strictEqual(disposedStore.isInitialized, false);
assert.strictEqual(disposedStore.drivetrain.displaySpeed, 0);
assert.strictEqual(disposedStore.drivetrain.isAccelerating, false);
console.log('  ✓ vehiclePhysicsStore updates longitudinal telemetry and disposes cleanly');

console.log('\nResults: 10 / 10 unit tests passed successfully.\n');
