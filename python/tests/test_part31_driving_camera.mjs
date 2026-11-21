/**
 * Unit Test Suite for Part 31: Third-Person Driving Camera and Follow System
 *
 * Verifies:
 * 1. Module exports and camera configuration integrity (all modes, presets, damping rates).
 * 2. Stationary third-person follow geometry (behind vehicle, looking forward down road).
 * 3. Rotational following during vehicle yaw turns (90° right turn, 180° hairpin turn).
 * 4. Dynamic speed-aware response (pull-back distance, height lift, look-ahead distance, dynamic FOV).
 * 5. Distinct camera modes geometry (CHASE, CLOSE, WIDE, HOOD/BONNET, BUMPER).
 * 6. Bonnet and bumper forward cockpit perspectives orientation and placement.
 * 7. Frame-rate independent exponential smoothing (identical convergence across 30, 60, 120 FPS).
 * 8. User glance orbit clamping and automatic spring-back return.
 * 9. Instant vehicle recovery & reset synchronization (zero stale target).
 * 10. Showroom camera isolation (Showroom presets and cameraStore strictly unaffected).
 */

import * as THREE from 'three';
import { DRIVING_CAMERA_CONFIG, DRIVING_CAMERA_MODES } from '../../src/scenes/driving/drivingCameraConfig.js';
import {
  computeIdealCameraTransform,
  dampCameraTransform,
  computeOrbitSpringBack,
  clampOrbitAngles,
} from '../../src/scenes/driving/drivingCameraUtils.js';
import { useAppModeStore, DRIVING_VIEWS } from '../../src/store/appModeStore.js';
import { useCameraStore, CAMERA_PRESETS } from '../../src/store/cameraStore.js';

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
  console.log('PART 31 UNIT TESTS: Third-Person Driving Camera & Follow System');
  console.log('================================================================');

  // Test 1: Configuration & Module Exports
  await runTest('Driving Camera Configuration Integrity', () => {
    assert(DRIVING_CAMERA_CONFIG !== undefined && DRIVING_CAMERA_CONFIG !== null, 'DRIVING_CAMERA_CONFIG exists');
    assert(DRIVING_CAMERA_MODES !== undefined, 'DRIVING_CAMERA_MODES exists');

    const { modes } = DRIVING_CAMERA_CONFIG;
    assert(modes.chase !== undefined, 'CHASE mode preset configured');
    assert(modes.close !== undefined, 'CLOSE mode preset configured');
    assert(modes.wide !== undefined, 'WIDE mode preset configured');
    assert(modes.hood !== undefined, 'HOOD/BONNET mode preset configured');
    assert(modes.bumper !== undefined, 'BUMPER mode preset configured');

    assert(modes.chase.distance === 5.6 && modes.chase.height === 2.15, 'CHASE base distance is 5.6m, height is 2.15m');
    assert(modes.chase.posDamping >= 7.0 && modes.chase.rotDamping >= 8.0, 'CHASE damping factors defined for smooth follow');
    assert(modes.close.distance < modes.chase.distance, 'CLOSE mode distance is tighter than CHASE');
    assert(modes.wide.distance > modes.chase.distance, 'WIDE mode distance is further than CHASE');
  });

  // Test 2: Stationary Third-Person Follow Geometry
  await runTest('Stationary Follow Camera Geometry at Spawn', () => {
    const spawnPos = new THREE.Vector3(0, 0.002, 0);
    const spawnQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)); // Facing +Z

    const transform = computeIdealCameraTransform(spawnPos, spawnQuat, 0, DRIVING_CAMERA_MODES.CHASE);
    const { position, target, fov } = transform;

    // In vehicle frame (+Z forward), camera should be behind (-Z) at -5.6m
    assert(Math.abs(position.x) < 0.001, `Camera X is centered on vehicle: ${position.x.toFixed(3)}`);
    assert(Math.abs(position.y - 2.152) < 0.01, `Camera Y is elevated at ${position.y.toFixed(3)}m (expected ~2.152m)`);
    assert(Math.abs(position.z - (-5.6)) < 0.01, `Camera Z is behind vehicle at ${position.z.toFixed(3)}m (expected -5.6m)`);

    // Target should be ahead (+Z) at +2.5m, slightly elevated
    assert(Math.abs(target.x) < 0.001, `Target X is centered: ${target.x.toFixed(3)}`);
    assert(Math.abs(target.y - 0.902) < 0.01, `Target Y is at ${target.y.toFixed(3)}m`);
    assert(Math.abs(target.z - 2.5) < 0.01, `Target Z is ahead down the road at ${target.z.toFixed(3)}m`);
    assert(fov === 46.0, `Base FOV is 46° (got ${fov})`);
  });

  // Test 3: Rotational Following during Yaw Turns
  await runTest('Rotational Following during Yaw Turns (90° and 180°)', () => {
    const vehPos = new THREE.Vector3(100, 0.002, 200);

    // 90° Turn towards +X: Heading is +X (quaternion: yaw = +PI/2)
    const quatRight90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const right90Transform = computeIdealCameraTransform(vehPos, quatRight90, 0, DRIVING_CAMERA_MODES.CHASE);

    // Behind the vehicle should now be along -X (x = 100 - 5.6 = 94.4), z should be centered at 200
    assert(Math.abs(right90Transform.position.x - (100 - 5.6)) < 0.05, `90° Turn to +X: Camera position trails along -X (${right90Transform.position.x.toFixed(2)})`);
    assert(Math.abs(right90Transform.position.z - 200) < 0.05, `90° Turn to +X: Camera Z remains aligned with car (${right90Transform.position.z.toFixed(2)})`);
    // Look target should be ahead along +X (x = 100 + 2.5 = 102.5)
    assert(Math.abs(right90Transform.target.x - (100 + 2.5)) < 0.05, `90° Turn to +X: Look target is ahead along +X (${right90Transform.target.x.toFixed(2)})`);

    // 180° Hairpin Turn: Heading is -Z (quaternion: yaw = PI)
    const quat180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    const hairpinTransform = computeIdealCameraTransform(vehPos, quat180, 0, DRIVING_CAMERA_MODES.CHASE);

    // Behind the vehicle is now along +Z (z = 200 + 5.6 = 205.6)
    assert(Math.abs(hairpinTransform.position.z - (200 + 5.6)) < 0.05, `180° Hairpin: Camera trails along +Z (${hairpinTransform.position.z.toFixed(2)})`);
    // Look target is ahead along -Z (z = 200 - 2.5 = 197.5)
    assert(Math.abs(hairpinTransform.target.z - (200 - 2.5)) < 0.05, `180° Hairpin: Look target points along -Z (${hairpinTransform.target.z.toFixed(2)})`);
  });

  // Test 4: Dynamic Speed-Aware Response
  await runTest('Dynamic Speed-Aware Response (Distance, Height, Look-Ahead, FOV)', () => {
    const vehPos = new THREE.Vector3(0, 0.002, 0);
    const vehQuat = new THREE.Quaternion(); // Heading +Z

    // Standstill: 0 m/s
    const stopTrans = computeIdealCameraTransform(vehPos, vehQuat, 0, DRIVING_CAMERA_MODES.CHASE);

    // High Speed: 45 m/s (162 km/h)
    const fastTrans = computeIdealCameraTransform(vehPos, vehQuat, 45.0, DRIVING_CAMERA_MODES.CHASE);

    // Distance pulled back by +1.2m (5.6m -> 6.8m, z: -5.6 -> -6.8)
    const stopDist = Math.abs(stopTrans.position.z);
    const fastDist = Math.abs(fastTrans.position.z);
    assert(Math.abs(fastDist - 6.8) < 0.05, `High-speed distance pulled back to 6.8m (got ${fastDist.toFixed(2)}m)`);
    assert(fastDist > stopDist, 'High-speed distance is greater than stationary distance');

    // Height lifted by +0.35m (2.15m -> 2.50m)
    assert(Math.abs(fastTrans.position.y - (stopTrans.position.y + 0.35)) < 0.05, `High-speed height lifted by +0.35m (got ${fastTrans.position.y.toFixed(2)}m)`);

    // Look-ahead extended down the road by +6.0m (2.5m -> 8.5m)
    assert(Math.abs(fastTrans.target.z - 8.5) < 0.05, `Look-ahead target extended down the road to 8.5m (got ${fastTrans.target.z.toFixed(2)}m)`);

    // FOV expanded by +6° (46° -> 52°)
    assert(Math.abs(fastTrans.fov - 52.0) < 0.1, `Dynamic FOV expanded to 52° at top speed (got ${fastTrans.fov.toFixed(1)}°)`);
  });

  // Test 5: Distinct Camera Modes Geometry (Chase, Close, Wide)
  await runTest('Camera Mode Variations: Close vs Chase vs Wide', () => {
    const vehPos = new THREE.Vector3(0, 0, 0);
    const vehQuat = new THREE.Quaternion();

    const chase = computeIdealCameraTransform(vehPos, vehQuat, 0, DRIVING_CAMERA_MODES.CHASE);
    const close = computeIdealCameraTransform(vehPos, vehQuat, 0, DRIVING_CAMERA_MODES.CLOSE);
    const wide = computeIdealCameraTransform(vehPos, vehQuat, 0, DRIVING_CAMERA_MODES.WIDE);

    // Distance progression: Close (4.2m) < Chase (5.6m) < Wide (7.8m)
    const dClose = Math.abs(close.position.z);
    const dChase = Math.abs(chase.position.z);
    const dWide = Math.abs(wide.position.z);

    assert(dClose < dChase, `CLOSE distance (${dClose.toFixed(1)}m) < CHASE distance (${dChase.toFixed(1)}m)`);
    assert(dWide > dChase, `WIDE distance (${dWide.toFixed(1)}m) > CHASE distance (${dChase.toFixed(1)}m)`);

    // Height progression: Close (1.65m) < Chase (2.15m) < Wide (3.0m)
    assert(close.position.y < chase.position.y, 'CLOSE height is lower than CHASE for aggressive sports stance');
    assert(wide.position.y > chase.position.y, 'WIDE height is elevated for broad track view');
  });

  // Test 6: Forward Bonnet / Hood & Bumper Perspectives
  await runTest('Bonnet / Hood & Front Bumper Perspectives', () => {
    const vehPos = new THREE.Vector3(50, 0.002, 120);
    const vehQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5); // 0.5 rad left yaw

    // HOOD mode
    const hood = computeIdealCameraTransform(vehPos, vehQuat, 20.0, DRIVING_CAMERA_MODES.HOOD);
    assert(hood.fov >= 58.0, `Bonnet FOV is wide for road immersion: ${hood.fov.toFixed(1)}°`);
    // Camera is ahead of car COM (local z = +0.55m)
    const hoodRel = hood.position.clone().sub(vehPos);
    assert(hoodRel.length() < 2.0, `Bonnet camera is mounted on the vehicle body (offset dist = ${hoodRel.length().toFixed(2)}m)`);

    // BUMPER mode
    const bumper = computeIdealCameraTransform(vehPos, vehQuat, 20.0, DRIVING_CAMERA_MODES.BUMPER);
    assert(bumper.fov >= 65.0, `Bumper FOV is ultra-wide for extreme speed sensation: ${bumper.fov.toFixed(1)}°`);
    assert(bumper.position.y < 0.60, `Bumper camera is mounted close to the road (Y = ${bumper.position.y.toFixed(2)}m)`);
  });

  // Test 7: Frame-Rate Independent Exponential Smoothing
  await runTest('Frame-Rate Independent Exponential Smoothing (30 vs 60 vs 120 FPS)', () => {
    const idealPos = new THREE.Vector3(0, 2.15, -5.6);
    const idealTarget = new THREE.Vector3(0, 0.90, 2.5);
    const idealFov = 46.0;

    const startPos = new THREE.Vector3(10, 5, -20);
    const startTarget = new THREE.Vector3(5, 2, 0);
    const startFov = 55.0;

    // Simulate 1.0 second of simulation at 30 FPS, 60 FPS, and 120 FPS
    function simulateConvergence(fps) {
      const dt = 1 / fps;
      const steps = fps; // exactly 1 second
      const pos = startPos.clone();
      const tgt = startTarget.clone();
      let fov = startFov;

      for (let i = 0; i < steps; i++) {
        const res = dampCameraTransform(pos, tgt, fov, idealPos, idealTarget, idealFov, dt, 8.5, 10.0);
        pos.copy(res.position);
        tgt.copy(res.target);
        fov = res.fov;
      }
      return { pos, tgt, fov };
    }

    const sim30 = simulateConvergence(30);
    const sim60 = simulateConvergence(60);
    const sim120 = simulateConvergence(120);

    // All should be within 0.005m of the ideal target after 1.0 second
    assert(sim60.pos.distanceTo(idealPos) < 0.01, `60 FPS converged to ideal position (${sim60.pos.distanceTo(idealPos).toFixed(4)}m remaining error)`);
    assert(sim30.pos.distanceTo(sim60.pos) < 0.005, `30 FPS vs 60 FPS position difference < 5mm (${sim30.pos.distanceTo(sim60.pos).toFixed(4)}m)`);
    assert(sim120.pos.distanceTo(sim60.pos) < 0.005, `120 FPS vs 60 FPS position difference < 5mm (${sim120.pos.distanceTo(sim60.pos).toFixed(4)}m)`);
  });

  // Test 8: User Glance Orbit Clamping & Spring-Back Return
  await runTest('User Glance Orbit Clamping & Auto-Centering Spring-Back', () => {
    const maxAzimuth = (80 * Math.PI) / 180;
    const maxPolar = (25 * Math.PI) / 180;

    // Test Clamping
    const clamped = clampOrbitAngles(2.5, -1.0, maxAzimuth, maxPolar);
    assert(Math.abs(clamped.azimuth - maxAzimuth) < 0.001, `Azimuth clamped to max 80° (${(clamped.azimuth * 180 / Math.PI).toFixed(1)}°)`);
    assert(Math.abs(clamped.polar - (-maxPolar)) < 0.001, `Polar clamped to min -25° (${(clamped.polar * 180 / Math.PI).toFixed(1)}°)`);

    // Test Spring-Back Decay over 0.5s
    let angles = { azimuth: 0.8, polar: 0.2 };
    for (let i = 0; i < 30; i++) {
      angles = computeOrbitSpringBack(angles, 1 / 60, 4.0);
    }
    assert(angles.azimuth < 0.15, `Glance azimuth smoothly decayed towards 0 (got ${angles.azimuth.toFixed(3)} rad)`);
    assert(angles.polar < 0.05, `Glance polar smoothly decayed towards 0 (got ${angles.polar.toFixed(3)} rad)`);
  });

  // Test 9: Mode Cycling & Reset Synchronization
  await runTest('App Mode Store Camera View Cycling & Actions', () => {
    const store = useAppModeStore.getState();
    assert(typeof store.setDrivingView === 'function', 'setDrivingView is a function');
    assert(typeof store.cycleDrivingView === 'function', 'cycleDrivingView is a function');
    assert(typeof store.resetDrivingCamera === 'function', 'resetDrivingCamera is a function');

    store.setDrivingView(DRIVING_VIEWS.CHASE);
    assert(useAppModeStore.getState().drivingView === DRIVING_VIEWS.CHASE, 'Initial view set to CHASE');

    store.cycleDrivingView();
    assert(useAppModeStore.getState().drivingView === DRIVING_VIEWS.CLOSE, 'Cycled to CLOSE');

    store.cycleDrivingView();
    assert(useAppModeStore.getState().drivingView === DRIVING_VIEWS.WIDE, 'Cycled to WIDE');

    store.cycleDrivingView();
    assert(useAppModeStore.getState().drivingView === DRIVING_VIEWS.HOOD, 'Cycled to HOOD/BONNET');

    store.cycleDrivingView();
    assert(useAppModeStore.getState().drivingView === DRIVING_VIEWS.BUMPER, 'Cycled to BUMPER');

    store.cycleDrivingView();
    assert(useAppModeStore.getState().drivingView === DRIVING_VIEWS.CHASE, 'Cycled back to CHASE');

    // Camera reset trigger
    const initialTrig = store.cameraResetTrigger || 0;
    store.resetDrivingCamera();
    assert(useAppModeStore.getState().cameraResetTrigger === initialTrig + 1, 'resetDrivingCamera incremented trigger');
  });

  // Test 10: Showroom Camera Isolation
  await runTest('Showroom Camera Isolation (Zero State Pollution)', () => {
    const showroomStore = useCameraStore.getState();
    assert(showroomStore.activePreset !== undefined, 'Showroom activePreset is intact');
    assert(CAMERA_PRESETS !== undefined && Object.keys(CAMERA_PRESETS).length >= 10, 'Showroom presets registry is intact');

    // Check canonical showroom presets unchanged
    const frontPreset = CAMERA_PRESETS['front'];
    assert(frontPreset.position[2] === 6.6, 'Showroom Front preset position unaffected');
    const heroPreset = CAMERA_PRESETS['front-left'];
    assert(heroPreset.position[0] === 3.6 && heroPreset.position[2] === 4.2, 'Showroom Hero preset position unaffected');
  });

  console.log('\n================================================================');
  console.log(`PART 31 TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
