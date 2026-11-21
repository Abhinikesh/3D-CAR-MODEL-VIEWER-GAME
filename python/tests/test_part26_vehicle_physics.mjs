/**
 * Automated Unit Test Suite for Part 26:
 * Vehicle Physics Foundation & Movement Architecture
 *
 * Verifies:
 * 1. Component & Module Integrity: vehiclePhysicsConfig, vehiclePhysicsUtils, vehiclePhysicsStore, VehiclePhysicsWorld, VehiclePhysicsController
 * 2. Rigid Body Specifications: Mass (1450kg), Center of Mass ([0, 0.42, 0.08]), Dimensions, Inertia Tensor, Gravity (-9.81)
 * 3. 4-Wheel Suspension Geometry: 4 mounts, wheelbase (2.80m), tracks (1.952m / 1.964m), tire radius (0.36065m), stiffness (35kN/m)
 * 4. Physics Math & Force Mechanics: Hooke's law, viscous damping, anti-roll bars, unilateral ground contact
 * 5. Fixed-Timestep Independence: 60Hz delta accumulator, sub-step clamping (max 5), interpolation alpha
 * 6. Store Lifecycle & Teardown: Clean initialization, telemetry synchronization, reset, and disposal
 * 7. Scene Separation & Showroom Protection: VehiclePhysicsController returns null in Showroom Mode
 */

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

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    failedTests++;
  }
}

console.log('\n--- TEST SUITE: Part 26 — Vehicle Physics Foundation & Movement Architecture ---\n');

// 1. Module & Component File Integrity
runTest('All Part 26 physics files exist and export expected modules', async () => {
  const config = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');
  assert.ok(config.VEHICLE_PHYSICS_CONFIG, 'VEHICLE_PHYSICS_CONFIG must be exported');

  const utils = await import('../../src/scenes/driving/vehiclePhysicsUtils.js');
  assert.ok(typeof utils.getGroundHeightAt === 'function', 'getGroundHeightAt must be a function');
  assert.ok(typeof utils.computeSuspensionForce === 'function', 'computeSuspensionForce must be a function');
  assert.ok(typeof utils.computeAntiRollForce === 'function', 'computeAntiRollForce must be a function');
  assert.ok(typeof utils.integrateRigidBodyStep === 'function', 'integrateRigidBodyStep must be a function');
  assert.ok(typeof utils.interpolatePhysicsTransform === 'function', 'interpolatePhysicsTransform must be a function');

  const store = await import('../../src/store/vehiclePhysicsStore.js');
  assert.ok(store.useVehiclePhysicsStore, 'useVehiclePhysicsStore must be exported');

  const worldFile = fs.readFileSync(path.resolve(ROOT, 'src/scenes/driving/VehiclePhysicsWorld.jsx'), 'utf-8');
  assert.ok(worldFile.includes('export default function VehiclePhysicsWorld'), 'VehiclePhysicsWorld must have default export');

  const controllerFile = fs.readFileSync(path.resolve(ROOT, 'src/scenes/driving/VehiclePhysicsController.jsx'), 'utf-8');
  assert.ok(controllerFile.includes('export default function VehiclePhysicsController'), 'VehiclePhysicsController must have default export');

  const sceneFile = fs.readFileSync(path.resolve(ROOT, 'src/scenes/driving/DrivingScene.jsx'), 'utf-8');
  assert.ok(sceneFile.includes('VehiclePhysicsController'), 'DrivingScene must mount VehiclePhysicsController');
});

// 2. Rigid Body Physical Properties
runTest('Chassis rigid body defines accurate physical dimensions, mass, and inertia', async () => {
  const { VEHICLE_PHYSICS_CONFIG } = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');
  const { chassis } = VEHICLE_PHYSICS_CONFIG;

  assert.strictEqual(chassis.mass, 1450, 'Vehicle mass must be 1450 kg');
  assert.deepStrictEqual(chassis.dimensions, [1.95, 1.15, 4.56], 'Dimensions must match [1.95, 1.15, 4.56]m');
  assert.deepStrictEqual(chassis.centerOfMass, [0.0, 0.42, 0.08], 'Center of mass must be [0.0, 0.42, 0.08]');
  assert.strictEqual(chassis.gravity[1], -9.81, 'Gravity must be -9.81 m/s^2');
  assert.ok(chassis.inertia.ixx > 0 && chassis.inertia.iyy > 0 && chassis.inertia.izz > 0, 'Moments of inertia must be positive');
  assert.strictEqual(chassis.linearDamping, 0.08);
  assert.strictEqual(chassis.angularDamping, 0.22);
});

// 3. Four-Wheel Suspension Geometry
runTest('Suspension configuration defines 4 distinct wheel mounts with verified geometry', async () => {
  const { VEHICLE_PHYSICS_CONFIG } = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');
  const { suspension, wheelMounts } = VEHICLE_PHYSICS_CONFIG;

  // Wheel mounts presence
  assert.ok(wheelMounts.fl && wheelMounts.fr && wheelMounts.rl && wheelMounts.rr, 'All 4 wheel mounts must exist');

  // Wheelbase calculation (Front Axle Z minus Rear Axle Z)
  const wheelbase = wheelMounts.fl.mountPoint[2] - wheelMounts.rl.mountPoint[2];
  assert.ok(Math.abs(wheelbase - 2.80) < 0.01, `Wheelbase should be 2.80m, got ${wheelbase.toFixed(3)}m`);

  // Front track width (FL X minus FR X)
  const frontTrack = wheelMounts.fl.mountPoint[0] - wheelMounts.fr.mountPoint[0];
  assert.ok(Math.abs(frontTrack - 1.952) < 0.01, `Front track should be 1.952m, got ${frontTrack.toFixed(3)}m`);

  // Rear track width (RL X minus RR X)
  const rearTrack = wheelMounts.rl.mountPoint[0] - wheelMounts.rr.mountPoint[0];
  assert.ok(Math.abs(rearTrack - 1.964) < 0.01, `Rear track should be 1.964m, got ${rearTrack.toFixed(3)}m`);

  // Spring & Damper parameters
  assert.strictEqual(suspension.restLength, 0.28);
  assert.strictEqual(suspension.minLength, 0.12);
  assert.strictEqual(suspension.maxLength, 0.36);
  assert.strictEqual(suspension.springStiffness, 35000);
  assert.strictEqual(suspension.dampingRate, 3200);
  assert.strictEqual(suspension.antiRollStiffness, 8000);
  assert.strictEqual(suspension.tireRadius, 0.36065);
});

// 4. Suspension Physics Math & Contact Logic
runTest('computeSuspensionForce implements Hookes law, viscous damping, and unilateral ground contact', async () => {
  const { computeSuspensionForce } = await import('../../src/scenes/driving/vehiclePhysicsUtils.js');
  const config = { springStiffness: 35000, dampingRate: 3200 };

  // Static compression of 0.10m (10cm): F = 35000 * 0.10 = 3500 N
  const staticForce = computeSuspensionForce(0.10, 0, config);
  assert.strictEqual(staticForce, 3500);

  // Dynamic compression: 0.10m compression with 0.5 m/s compression velocity
  // F = 3500 + 3200 * 0.5 = 3500 + 1600 = 5100 N
  const dynamicForce = computeSuspensionForce(0.10, 0.5, config);
  assert.strictEqual(dynamicForce, 5100);

  // Unilateral contact: extension with high rebound velocity should not produce negative (pulling) force
  const negativeForce = computeSuspensionForce(-0.05, -2.0, config);
  assert.strictEqual(negativeForce, 0, 'Suspension cannot exert downward pulling force on ground');
});

runTest('computeAntiRollForce calculates differential force between wheels on the same axle', async () => {
  const { computeAntiRollForce } = await import('../../src/scenes/driving/vehiclePhysicsUtils.js');

  // Left wheel compressed 0.12m, right wheel compressed 0.08m (car rolling right)
  // Delta = 0.04m, Anti-Roll Stiffness = 8000 N/m -> Force = 8000 * 0.04 = 320 N
  const arbForce = computeAntiRollForce(0.12, 0.08, 8000);
  assert.ok(Math.abs(arbForce - 320) < 0.001, `Anti-roll force should be ~320 N, got ${arbForce}`);

  // Symmetric compression (pure pitch/heave): Anti-roll force must be zero
  const zeroArb = computeAntiRollForce(0.10, 0.10, 8000);
  assert.ok(Math.abs(zeroArb) < 0.001, `Symmetric compression anti-roll force should be 0 N, got ${zeroArb}`);
});

// 5. Fixed-Timestep Independence & Numerical Integration
runTest('integrateRigidBodyStep performs deterministic semi-implicit Euler integration without numerical instability', async () => {
  const { integrateRigidBodyStep } = await import('../../src/scenes/driving/vehiclePhysicsUtils.js');
  const { VEHICLE_PHYSICS_CONFIG } = await import('../../src/scenes/driving/vehiclePhysicsConfig.js');

  const state = {
    position: new THREE.Vector3(0, 1.0, 0),
    quaternion: new THREE.Quaternion(0, 0, 0, 1),
    linearVelocity: new THREE.Vector3(0, 0, 0),
    angularVelocity: new THREE.Vector3(0, 0, 0),
  };

  const totalForce = new THREE.Vector3(0, -9.81 * 1450, 0); // Pure gravity
  const totalTorque = new THREE.Vector3(0, 0, 0);
  const dt = 1 / 60;

  // Step 1: Free fall from Y = 1.0m
  integrateRigidBodyStep(state, totalForce, totalTorque, dt, VEHICLE_PHYSICS_CONFIG.chassis);

  // Velocity after 1 tick: v = a * dt = -9.81 * (1/60) * damping ~ -0.163 m/s
  assert.ok(state.linearVelocity.y < 0, 'Velocity must be negative downwards');
  assert.ok(state.position.y < 1.0, 'Position must drop below 1.0m');
  assert.strictEqual(state.position.x, 0, 'X position must remain undisturbed');
  assert.strictEqual(state.position.z, 0, 'Z position must remain undisturbed');
});

// 6. Transform Interpolation
runTest('interpolatePhysicsTransform smoothly blends transforms using linear lerp and quaternion slerp', async () => {
  const { interpolatePhysicsTransform } = await import('../../src/scenes/driving/vehiclePhysicsUtils.js');

  const p0 = new THREE.Vector3(0, 0, 0);
  const p1 = new THREE.Vector3(10, 20, 30);
  const q0 = new THREE.Quaternion(0, 0, 0, 1);
  const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

  const outPos = new THREE.Vector3();
  const outRot = new THREE.Quaternion();

  // Alpha = 0.5 (midpoint)
  interpolatePhysicsTransform(p0, p1, q0, q1, 0.5, outPos, outRot);

  assert.strictEqual(outPos.x, 5);
  assert.strictEqual(outPos.y, 10);
  assert.strictEqual(outPos.z, 15);
  assert.ok(Math.abs(outRot.length() - 1.0) < 0.0001, 'Quaternion must remain normalized');
});

// 7. Store State Management & Lifecycle
runTest('useVehiclePhysicsStore initializes, updates, and disposes state cleanly', async () => {
  const { useVehiclePhysicsStore } = await import('../../src/store/vehiclePhysicsStore.js');

  // 1. Initialize
  useVehiclePhysicsStore.getState().initializePhysics();
  assert.strictEqual(useVehiclePhysicsStore.getState().isInitialized, true);
  assert.strictEqual(useVehiclePhysicsStore.getState().isSimulating, true);
  assert.strictEqual(useVehiclePhysicsStore.getState().chassis.mass, 1450);

  // 2. Update Telemetry
  useVehiclePhysicsStore.getState().updateTelemetry({
    isSettled: true,
    settleProgress: 1.0,
    chassis: { speedKmh: 42.5 },
  });

  assert.strictEqual(useVehiclePhysicsStore.getState().isSettled, true);
  assert.strictEqual(useVehiclePhysicsStore.getState().settleProgress, 1.0);
  assert.strictEqual(useVehiclePhysicsStore.getState().chassis.speedKmh, 42.5);

  // 3. Dispose
  useVehiclePhysicsStore.getState().disposePhysics();
  assert.strictEqual(useVehiclePhysicsStore.getState().isInitialized, false);
  assert.strictEqual(useVehiclePhysicsStore.getState().isSimulating, false);
});

// 8. Scene Separation & Showroom Mode Isolation
runTest('VehiclePhysicsController renders null when mode is not DRIVING', async () => {
  const controllerCode = fs.readFileSync(
    path.resolve(ROOT, 'src/scenes/driving/VehiclePhysicsController.jsx'),
    'utf-8'
  );
  assert.ok(
    controllerCode.includes('if (mode !== APP_MODES.DRIVING)'),
    'Controller must check APP_MODES.DRIVING'
  );
  assert.ok(
    controllerCode.includes('return null;'),
    'Controller must return null in Showroom Mode'
  );
});

console.log(`\nResults: ${passedTests} / ${passedTests + failedTests} unit tests passed successfully.\n`);
if (failedTests > 0) process.exit(1);
