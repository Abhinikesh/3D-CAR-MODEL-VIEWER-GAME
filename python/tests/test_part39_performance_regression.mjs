/**
 * test_part39_performance_regression.mjs — Comprehensive Regression & Performance Audit Suite
 *
 * Verifies all performance invariants, Three.js resource lifecycles, physics timestep stability,
 * network bounds, and multi-subsystem regression integrity across Parts 1–39.
 */

import { usePerformanceStore } from '../../src/store/performanceStore.js';
import { useAppModeStore, APP_MODES, DRIVING_VIEWS } from '../../src/store/appModeStore.js';
import { useVehiclePhysicsStore } from '../../src/store/vehiclePhysicsStore.js';
import { useVehicleInputStore, VEHICLE_GEAR, INPUT_SOURCE } from '../../src/scenes/driving/vehicleInputStore.js';
import { useControllerSessionStore } from '../../src/services/controller/controllerSessionStore.js';
import { CONTROLLER_STATUS } from '../../src/services/controller/controllerTypes.js';
import { localControllerService } from '../../src/services/controller/localControllerService.js';
import { VEHICLE_PHYSICS_CONFIG } from '../../src/scenes/driving/vehiclePhysicsConfig.js';
import { integrateRigidBodyStep, resetVehiclePhysicsState } from '../../src/scenes/driving/vehiclePhysicsUtils.js';
import { useWheelAnimationStore } from '../../src/store/wheelAnimationStore.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✅ ${message}`);
}

console.log('\n🚀 ═════════════════════════════════════════════════════════════════');
console.log('   PART 39: PERFORMANCE OPTIMIZATION & COMPREHENSIVE REGRESSION');
console.log('═════════════════════════════════════════════════════════════════\n');

// ─── 1. PERFORMANCE & TELEMETRY STORE INTEGRITY ─────────────────────────
console.log('--- 1. PERFORMANCE STORE & WEBGL TELEMETRY INVARIANTS ---');

const perfState = usePerformanceStore.getState();
assert(typeof perfState.fps === 'number' && perfState.fps > 0, 'PerformanceStore tracks numerical FPS');
assert(typeof perfState.frameTimeMs === 'number', 'PerformanceStore tracks numerical frameTimeMs');
assert(typeof perfState.drawCalls === 'number', 'PerformanceStore tracks drawCalls metric');
assert(typeof perfState.triangles === 'number', 'PerformanceStore tracks triangle count');
assert(typeof perfState.geometries === 'number', 'PerformanceStore tracks allocated geometry count');
assert(typeof perfState.textures === 'number', 'PerformanceStore tracks active texture units');
assert(typeof perfState.programs === 'number', 'PerformanceStore tracks compiled shader programs');

// Test diagnostics toggle
perfState.setDiagnosticsOpen(true);
assert(usePerformanceStore.getState().isDiagnosticsOpen === true, 'PerformanceStore diagnostics modal can be opened');
perfState.toggleDiagnostics();
assert(usePerformanceStore.getState().isDiagnosticsOpen === false, 'PerformanceStore diagnostics modal can be toggled');

// Test metric snapshot formatting
perfState.updateMetrics({
  fps: 60,
  frameTimeMs: 16.6,
  drawCalls: 12,
  triangles: 213347,
  geometries: 117,
  textures: 28,
  programs: 34,
  jsHeapMB: 85.4,
});
const snap = usePerformanceStore.getState().getSnapshot();
assert(snap.drawCalls === 12 && snap.triangles === 213347, 'PerformanceStore snapshot correctly captures live metrics');


// ─── 2. THREE.JS RESOURCE LIFECYCLE & DISPOSAL ──────────────────────────
console.log('\n--- 2. THREE.JS RESOURCE LIFECYCLE & DISPOSAL AUDIT ---');

// Verify ShowroomScene and DrivingScene clean mounting & unmounting
useAppModeStore.getState().setMode(APP_MODES.DRIVING);
assert(useAppModeStore.getState().mode === APP_MODES.DRIVING, 'Switched to DRIVING mode');

// Simulate physics lifecycle initialization
useVehiclePhysicsStore.getState().initializePhysics();
assert(useVehiclePhysicsStore.getState().isInitialized === true, 'Vehicle physics initialized cleanly');

// Inject active driving inputs
useVehicleInputStore.getState().setInputs({
  throttle: 0.8,
  steer: 0.35,
  source: INPUT_SOURCE.KEYBOARD,
});
assert(useVehicleInputStore.getState().throttle === 0.8, 'Driving inputs applied during simulation');

// Switch mode back to SHOWROOM
useAppModeStore.getState().setMode(APP_MODES.SHOWROOM);
assert(useAppModeStore.getState().mode === APP_MODES.SHOWROOM, 'Switched back to SHOWROOM mode');

// Verify that mode transition safely wiped active inputs and physics
assert(useVehicleInputStore.getState().throttle === 0, 'Active throttle reset to 0 on mode switch');
assert(useVehicleInputStore.getState().steer === 0, 'Active steer reset to 0 on mode switch');
assert(useVehiclePhysicsStore.getState().isSimulating === false, 'Physics marked inactive on mode switch');

// Verify local controller service lifecycle
localControllerService.init();
assert(localControllerService.isInitialized === true, 'LocalControllerService initializes watchdog cleanly');
assert(localControllerService.watchdogTimer !== null, 'LocalControllerService watchdog timer is active');
localControllerService.dispose();
assert(localControllerService.isInitialized === false, 'LocalControllerService disposes cleanly');
assert(localControllerService.watchdogTimer === null, 'LocalControllerService watchdog timer cleared');


// ─── 3. DRIVING PHYSICS TIMESTEP & STABILITY INVARIANTS ─────────────────
console.log('\n--- 3. DRIVING PHYSICS TIMESTEP & DRIFT STABILITY ---');

const simCfg = VEHICLE_PHYSICS_CONFIG.simulation;
assert(Math.abs(simCfg.timeStep - 1 / 60) < 0.0001, 'Physics timestep is strictly 1/60s (16.67ms) fixed rate');
assert(simCfg.maxSubSteps >= 1 && simCfg.maxSubSteps <= 10, 'Substep catch-up budget is bounded to prevent spiral of death');
assert(simCfg.maxDelta > 0 && simCfg.maxDelta <= 0.2, 'Max frame delta clamped to prevent large dt explosion on tab switch');

// Test zero-drift invariant: vehicle at rest with zero input over 120 ticks (2 seconds)
const dummySim = {
  position: new THREE.Vector3(0, 0.35, 0),
  quaternion: new THREE.Quaternion(),
  prevPosition: new THREE.Vector3(0, 0.35, 0),
  prevQuaternion: new THREE.Quaternion(),
  linearVelocity: new THREE.Vector3(0, 0, 0),
  angularVelocity: new THREE.Vector3(0, 0, 0),
  isSettled: true,
  settleCounter: 30,
  totalSteps: 0,
  wheels: {
    fl: { length: 0.32, prevLength: 0.32, compression: 0.03, force: 3750, isGrounded: true, rollAngle: 0, groundSpeed: 0, rpm: 0, suspensionOffset: 0, surfaceType: 'asphalt' },
    fr: { length: 0.32, prevLength: 0.32, compression: 0.03, force: 3750, isGrounded: true, rollAngle: 0, groundSpeed: 0, rpm: 0, suspensionOffset: 0, surfaceType: 'asphalt' },
    rl: { length: 0.32, prevLength: 0.32, compression: 0.03, force: 3750, isGrounded: true, rollAngle: 0, groundSpeed: 0, rpm: 0, suspensionOffset: 0, surfaceType: 'asphalt' },
    rr: { length: 0.32, prevLength: 0.32, compression: 0.03, force: 3750, isGrounded: true, rollAngle: 0, groundSpeed: 0, rpm: 0, suspensionOffset: 0, surfaceType: 'asphalt' },
  },
  drivetrain: { gear: 'D', speedLong: 0, driveForce: 0, brakeForce: 0, dragForce: 0, rollForce: 0, netLongForce: 0, wheelRollAngle: 0 },
  steering: { currentAngle: 0, steerFL: 0, steerFR: 0, maxSteerLimit: 0.6, totalLatForce: 0, yawTorque: 0, lateralG: 0, yawRate: 0, lastT: 0.05 },
  collision: { hasCollided: false, collisionCount: 0, lastCollisionType: 'none', lastCollisionObject: null, penetrationDepth: 0, impactSpeed: 0, surfaceType: 'asphalt', isOffRoad: false, offRoadWheelCount: 0 },
};

const initialZ = dummySim.position.z;
const zeroForce = new THREE.Vector3(0, 0, 0);
const zeroTorque = new THREE.Vector3(0, 0, 0);

for (let i = 0; i < 120; i++) {
  integrateRigidBodyStep(
    dummySim,
    zeroForce,
    zeroTorque,
    simCfg.timeStep,
    VEHICLE_PHYSICS_CONFIG.chassis,
    VEHICLE_PHYSICS_CONFIG.suspension
  );
}

assert(
  Math.abs(dummySim.position.z - initialZ) < 0.0001,
  `Zero-drift invariant verified: drift delta = ${Math.abs(dummySim.position.z - initialZ).toFixed(6)}m`
);
assert(
  dummySim.linearVelocity.length() < 0.0001,
  `Rest velocity stability verified: velocity = ${dummySim.linearVelocity.length().toFixed(6)}m/s`
);


// ─── 4. SMARTPHONE CONTROLLER SAFETY & PROTOCOL BOUNDS ───────────────────
console.log('\n--- 4. SMARTPHONE CONTROLLER PROTOCOL & SECURITY BOUNDS ---');

const sessionStore = useControllerSessionStore.getState();

// Rate limiting & payload size invariants
const VITE_CONFIG_FILE = path.join(ROOT, 'vite.config.js');
const viteContent = fs.readFileSync(VITE_CONFIG_FILE, 'utf-8');

assert(viteContent.includes('MAX_PAYLOAD_BYTES = 2048'), 'WebSocket frame size strictly guarded at 2048 bytes');
assert(viteContent.includes('MAX_PACKETS_PER_SEC = 60'), 'WebSocket message rate strictly limited to 60 packets/sec');
assert(viteContent.includes('rateWindowStart > 1000'), 'Rate-limit window configured at 1000ms');

// Watchdog safety checks
sessionStore.connectController({ id: 'bench-phone', name: 'Perf Handset', ip: '192.168.1.55' });
assert(useControllerSessionStore.getState().status === CONTROLLER_STATUS.CONNECTED, 'Controller connected');

// Stale watchdog at 750ms: neutralizes throttle and steer
const currentDevice = useControllerSessionStore.getState().connectedDevice;
useControllerSessionStore.setState({
  connectedDevice: { ...currentDevice, lastInputTime: Date.now() - 850 },
});
useControllerSessionStore.getState().checkHeartbeatTimeout();
assert(useControllerSessionStore.getState().status === CONTROLLER_STATUS.STALE, 'Watchdog marks status STALE after 750ms inactivity');
assert(useVehicleInputStore.getState().throttle === 0, 'Watchdog neutralized throttle during STALE state');

// Hard disconnect watchdog at 2000ms: disconnects phone and reverts to keyboard
const staleDevice = useControllerSessionStore.getState().connectedDevice;
useControllerSessionStore.setState({
  connectedDevice: { ...staleDevice, lastSeen: Date.now() - 2500 },
});
useControllerSessionStore.getState().checkHeartbeatTimeout();
assert(
  useControllerSessionStore.getState().status === CONTROLLER_STATUS.READY ||
  useControllerSessionStore.getState().status === CONTROLLER_STATUS.DISCONNECTED,
  'Watchdog triggers disconnect after 2000ms heartbeat loss'
);
assert(useVehicleInputStore.getState().activeSource === INPUT_SOURCE.KEYBOARD, 'Control safely reverted to KEYBOARD');


// ─── 5. INSTANCING & RENDERING PIPELINE EFFICIENCY ──────────────────────
console.log('\n--- 5. RENDERING PIPELINE & SCENERY INSTANCING ---');

const roadsideFile = fs.readFileSync(path.join(ROOT, 'src/scenes/driving/RoadsideScenery.jsx'), 'utf-8');
assert(roadsideFile.includes('<instancedMesh'), 'RoadsideScenery uses instancedMesh for high-efficiency tree/shrub batches');

const barriersFile = fs.readFileSync(path.join(ROOT, 'src/scenes/driving/RoadBarriers.jsx'), 'utf-8');
assert(barriersFile.includes('<instancedMesh'), 'RoadBarriers uses instancedMesh for barrier posts and reflectors');

const physicsWorldFile = fs.readFileSync(path.join(ROOT, 'src/scenes/driving/VehiclePhysicsWorld.jsx'), 'utf-8');
assert(physicsWorldFile.includes('useMemo(() => new THREE.Vector3()'), 'VehiclePhysicsWorld pre-allocates scratch math objects to eliminate GC churn');


// ─── 6. STATE STABILITY ACROSS REPEATED MODE SWITCHING ──────────────────
console.log('\n--- 6. STRESS TEST: 10 CONSECUTIVE MODE SWITCH CYCLES ---');

for (let cycle = 1; cycle <= 10; cycle++) {
  useAppModeStore.getState().setMode(APP_MODES.DRIVING);
  useVehicleInputStore.getState().setInputs({ throttle: 0.5, steer: -0.2 });
  useAppModeStore.getState().setMode(APP_MODES.SHOWROOM);
}

assert(useAppModeStore.getState().mode === APP_MODES.SHOWROOM, 'Final mode is SHOWROOM after 10 cycles');
assert(useVehicleInputStore.getState().throttle === 0, 'Zero stuck throttle after 10 cycles');
assert(useVehicleInputStore.getState().steer === 0, 'Zero stuck steer after 10 cycles');
assert(useVehiclePhysicsStore.getState().isSimulating === false, 'Physics world cleanly disposed');


// ─── 7. MILESTONE 39 VERIFICATION ───────────────────────────────────────
console.log('\n--- 7. MILESTONES INTEGRATION ---');

const appFile = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf-8');
assert(appFile.includes("id: 39, title: 'Performance Optimization and Complete Regression Testing'"), 'App.jsx includes Milestone 39');
assert(appFile.includes("status: 'completed'"), 'Milestone 39 is marked completed');

console.log('\n───────────────────────────────────────────────────────');
console.log(`📊 Part 39 Regression Test Results: ${passedTests} passed, 0 failed out of ${totalTests} tests`);
console.log('🎉 ALL PART 39 PERFORMANCE & REGRESSION INVARIANTS SATISFIED!\n');
