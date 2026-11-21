/**
 * Automated Unit Tests for Part 15 — Automotive Wheel Rotation, Steering & Mechanical Animation
 *
 * Verifies:
 * 1. Wheel assemblies exist in car_manifest.json and map to 4 positions
 * 2. Wheel animation registry defines verified axes and steering flags
 * 3. Steering angle limits (+/- 30 deg) and math conversion helpers
 * 4. Caliper isolation: stationaryMeshNames excludes calipers from spinning meshes
 * 5. Spinning meshes (Rim, Tire, Disc) exist in manifest for all 4 wheels
 * 6. RPM and equivalent vehicle km/h speed calculation helpers
 * 7. wheelAnimationStore initial state and defaults
 * 8. Store spin actions: start/stop/toggle/reverse/speed/mode
 * 9. Store steering actions: steerLeft/steerCenter/steerRight/clamping
 * 10. Transform reset action restoring neutral showroom pose with zero drift
 * 11. ComponentHUD integration for wheel dynamics
 * 12. App.jsx mounts WheelAnimationToolbar and tracks Part 15 as active/completed
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗  FAIL: ${name}`);
    console.error(`     ${err.message}`);
    failedTests++;
  }
}

console.log('\n◎ Part 15 — Automotive Wheel Dynamics, Rotation & Steering Unit Tests\n');

// 1. Manifest verification for wheel assemblies
runTest('All 4 wheel assemblies exist in car_manifest.json and map to distinct positions', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(ROOT, 'python/reports/car_manifest.json'), 'utf-8')
  );
  const nodes = manifest.nodes || [];
  const nodeNames = nodes.map((n) => n.name);

  assert.ok(nodeNames.includes('Wheel_Assembly_FL'), 'Wheel_Assembly_FL must exist in manifest');
  assert.ok(nodeNames.includes('Wheel_Assembly_FR'), 'Wheel_Assembly_FR must exist in manifest');
  assert.ok(nodeNames.includes('Wheel_Assembly_RL'), 'Wheel_Assembly_RL must exist in manifest');
  assert.ok(nodeNames.includes('Wheel_Assembly_RR'), 'Wheel_Assembly_RR must exist in manifest');
});

// 2. Wheel animation registry exports and configs
runTest('WHEEL_ANIMATION_CONFIG defines 4 verified wheel assemblies with axes and steering flags', async () => {
  const { WHEEL_ANIMATION_CONFIG, WHEEL_IDS, isWheelComponent } = await import(
    '../../src/utils/wheelAnimationRegistry.js'
  );

  assert.strictEqual(WHEEL_IDS.length, 4, 'Must have 4 wheel assemblies');
  assert.deepStrictEqual(WHEEL_IDS, ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']);

  // Front wheels must be steerable
  assert.strictEqual(WHEEL_ANIMATION_CONFIG.wheel_fl.steerable, true);
  assert.strictEqual(WHEEL_ANIMATION_CONFIG.wheel_fr.steerable, true);

  // Rear wheels must be rigid (non-steerable)
  assert.strictEqual(WHEEL_ANIMATION_CONFIG.wheel_rl.steerable, false);
  assert.strictEqual(WHEEL_ANIMATION_CONFIG.wheel_rr.steerable, false);

  // Helper check
  assert.strictEqual(isWheelComponent('wheel_fl'), true);
  assert.strictEqual(isWheelComponent('wheel_rr'), true);
  assert.strictEqual(isWheelComponent('bonnet'), false);
  assert.strictEqual(isWheelComponent(null), false);
});

// 3. Steering angle limits (+/- 30 deg) and math conversion helpers
runTest('Steering angle limits (+/- 30 deg) and degree/radian conversion helpers', async () => {
  const {
    MAX_STEERING_ANGLE_DEG,
    MAX_STEERING_ANGLE_RAD,
    degToRad,
    radToDeg,
  } = await import('../../src/utils/wheelAnimationRegistry.js');

  assert.strictEqual(MAX_STEERING_ANGLE_DEG, 30);
  assert.ok(Math.abs(MAX_STEERING_ANGLE_RAD - (30 * Math.PI) / 180) < 1e-6);

  // degToRad
  assert.strictEqual(degToRad(0), 0);
  assert.ok(Math.abs(degToRad(30) - Math.PI / 6) < 1e-6);
  assert.ok(Math.abs(degToRad(-30) - -Math.PI / 6) < 1e-6);

  // radToDeg
  assert.strictEqual(radToDeg(0), 0);
  assert.ok(Math.abs(radToDeg(Math.PI / 6) - 30) < 1e-6);
  assert.ok(Math.abs(radToDeg(-Math.PI / 6) - -30) < 1e-6);
});

// 4. Caliper isolation: stationaryMeshNames excludes calipers from spinning meshes
runTest('Brake calipers are strictly isolated from spinning meshes across all 4 wheels', async () => {
  const { WHEEL_ANIMATION_CONFIG, WHEEL_IDS } = await import(
    '../../src/utils/wheelAnimationRegistry.js'
  );

  WHEEL_IDS.forEach((id) => {
    const config = WHEEL_ANIMATION_CONFIG[id];
    assert.ok(config.stationaryMeshNames.length > 0, `${id} must declare stationaryMeshNames`);

    const caliperName = config.stationaryMeshNames[0];
    assert.ok(caliperName.includes('Caliper'), `${caliperName} must be caliper`);

    // Caliper must NOT be in spinMeshNames
    assert.ok(
      !config.spinMeshNames.includes(caliperName),
      `Caliper ${caliperName} must NOT be in spinMeshNames for ${id}`
    );
  });
});

// 5. Spinning meshes exist in car_manifest.json
runTest('All spinning meshes (Rim, Tire, Brake Disc) exist in car_manifest.json', async () => {
  const { WHEEL_ANIMATION_CONFIG, WHEEL_IDS } = await import(
    '../../src/utils/wheelAnimationRegistry.js'
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(ROOT, 'python/reports/car_manifest.json'), 'utf-8')
  );
  const nodeNames = new Set((manifest.nodes || []).map((n) => n.name));

  WHEEL_IDS.forEach((id) => {
    const config = WHEEL_ANIMATION_CONFIG[id];
    config.spinMeshNames.forEach((meshName) => {
      assert.ok(
        nodeNames.has(meshName),
        `Spin mesh ${meshName} for ${id} must exist in car_manifest.json`
      );
    });
    config.stationaryMeshNames.forEach((meshName) => {
      assert.ok(
        nodeNames.has(meshName),
        `Stationary mesh ${meshName} for ${id} must exist in car_manifest.json`
      );
    });
  });
});

// 6. RPM and speed calculation helpers
runTest('Vehicle speed (km/h) and RPM calculation helpers produce accurate values', async () => {
  const { calculateSpeedKmh, calculateRpm, TIRE_RADIUS_METERS } = await import(
    '../../src/utils/wheelAnimationRegistry.js'
  );

  assert.ok(TIRE_RADIUS_METERS > 0.35 && TIRE_RADIUS_METERS < 0.38, 'Tire radius ~ 0.36m');

  // At 1.0x multiplier: 60 RPM
  assert.strictEqual(calculateRpm(1.0), 60);
  assert.strictEqual(calculateRpm(2.0), 120);

  // Speed: at 1.0x (2*PI rad/s * 0.36065m * 3.6): ~8.16 km/h
  const kmh1x = calculateSpeedKmh(1.0);
  assert.ok(kmh1x > 8.0 && kmh1x < 8.3, `Expected ~8.16 km/h, got ${kmh1x}`);

  // Linear scaling
  const kmh2x = calculateSpeedKmh(2.0);
  assert.ok(Math.abs(kmh2x - 2 * kmh1x) < 1e-4, 'Speed must scale linearly with multiplier');
});

// 7. wheelAnimationStore initial state
runTest('useWheelAnimationStore initializes with verified defaults and idle state', async () => {
  const { useWheelAnimationStore } = await import('../../src/store/wheelAnimationStore.js');
  const state = useWheelAnimationStore.getState();

  assert.strictEqual(state.isSpinning, false, 'Default isSpinning must be false');
  assert.strictEqual(state.spinDirection, 1, 'Default spinDirection must be 1 (forward)');
  assert.strictEqual(state.spinSpeed, 1.0, 'Default spinSpeed must be 1.0');
  assert.strictEqual(state.spinMode, 'all', 'Default spinMode must be "all"');
  assert.strictEqual(state.activeIndividualWheel, 'wheel_fl');

  // Initial front steer angle matches glTF showcase pose (-30 deg)
  assert.ok(
    Math.abs(state.currentSteeringAngle - (-30 * Math.PI) / 180) < 1e-5,
    'currentSteeringAngle matches glTF pose (-30 deg)'
  );
  assert.ok(
    Math.abs(state.targetSteeringAngle - (-30 * Math.PI) / 180) < 1e-5,
    'targetSteeringAngle matches glTF pose (-30 deg)'
  );
});

// 8. Store spin actions
runTest('useWheelAnimationStore spin actions modify state correctly', async () => {
  const { useWheelAnimationStore } = await import('../../src/store/wheelAnimationStore.js');

  // Toggle
  useWheelAnimationStore.getState().toggleSpin();
  assert.strictEqual(useWheelAnimationStore.getState().isSpinning, true);

  useWheelAnimationStore.getState().stopSpin();
  assert.strictEqual(useWheelAnimationStore.getState().isSpinning, false);

  useWheelAnimationStore.getState().startSpin();
  assert.strictEqual(useWheelAnimationStore.getState().isSpinning, true);

  // Reverse
  useWheelAnimationStore.getState().reverseSpin();
  assert.strictEqual(useWheelAnimationStore.getState().spinDirection, -1);
  useWheelAnimationStore.getState().reverseSpin();
  assert.strictEqual(useWheelAnimationStore.getState().spinDirection, 1);

  // Speed clamping [0.25, 3.0]
  useWheelAnimationStore.getState().setSpinSpeed(5.0);
  assert.strictEqual(useWheelAnimationStore.getState().spinSpeed, 3.0);
  useWheelAnimationStore.getState().setSpinSpeed(0.1);
  assert.strictEqual(useWheelAnimationStore.getState().spinSpeed, 0.25);
  useWheelAnimationStore.getState().setSpinSpeed(1.5);
  assert.strictEqual(useWheelAnimationStore.getState().spinSpeed, 1.5);

  // Modes
  useWheelAnimationStore.getState().setSpinMode('front');
  assert.strictEqual(useWheelAnimationStore.getState().spinMode, 'front');
  useWheelAnimationStore.getState().setSpinMode('rear');
  assert.strictEqual(useWheelAnimationStore.getState().spinMode, 'rear');
  useWheelAnimationStore.getState().setSpinMode('individual');
  assert.strictEqual(useWheelAnimationStore.getState().spinMode, 'individual');
  useWheelAnimationStore.getState().setActiveIndividualWheel('wheel_fr');
  assert.strictEqual(useWheelAnimationStore.getState().activeIndividualWheel, 'wheel_fr');

  useWheelAnimationStore.getState().stopSpin();
});

// 9. Store steering actions
runTest('useWheelAnimationStore steering actions and clamping', async () => {
  const { useWheelAnimationStore } = await import('../../src/store/wheelAnimationStore.js');
  const { MAX_STEERING_ANGLE_RAD } = await import('../../src/utils/wheelAnimationRegistry.js');

  // Steer Left (+30 deg)
  useWheelAnimationStore.getState().steerLeft();
  assert.ok(
    Math.abs(useWheelAnimationStore.getState().targetSteeringAngle - MAX_STEERING_ANGLE_RAD) < 1e-6
  );

  // Steer Center (0 deg)
  useWheelAnimationStore.getState().steerCenter();
  assert.strictEqual(useWheelAnimationStore.getState().targetSteeringAngle, 0);

  // Steer Right (-30 deg)
  useWheelAnimationStore.getState().steerRight();
  assert.ok(
    Math.abs(useWheelAnimationStore.getState().targetSteeringAngle - -MAX_STEERING_ANGLE_RAD) < 1e-6
  );

  // Steer degree setter with clamping
  useWheelAnimationStore.getState().setTargetSteeringAngleDeg(45); // clamped to +30
  assert.ok(
    Math.abs(useWheelAnimationStore.getState().targetSteeringAngle - MAX_STEERING_ANGLE_RAD) < 1e-6
  );

  useWheelAnimationStore.getState().setTargetSteeringAngleDeg(-45); // clamped to -30
  assert.ok(
    Math.abs(useWheelAnimationStore.getState().targetSteeringAngle - -MAX_STEERING_ANGLE_RAD) < 1e-6
  );

  useWheelAnimationStore.getState().setTargetSteeringAngleDeg(15);
  assert.ok(
    Math.abs(useWheelAnimationStore.getState().targetSteeringAngle - (15 * Math.PI) / 180) < 1e-6
  );
});

// 10. Transform reset action restoring neutral showroom pose with zero drift
runTest('resetTransforms restores neutral showroom pose with zero cumulative drift', async () => {
  const { useWheelAnimationStore } = await import('../../src/store/wheelAnimationStore.js');

  // Modify state
  useWheelAnimationStore.getState().startSpin();
  useWheelAnimationStore.getState().reverseSpin();
  useWheelAnimationStore.getState().setSpinSpeed(2.5);
  useWheelAnimationStore.getState().setTargetSteeringAngleDeg(25);
  useWheelAnimationStore.getState().setCurrentSteeringAngle((25 * Math.PI) / 180);
  useWheelAnimationStore.getState().updateWheelRollAngles({
    wheel_fl: 12.345,
    wheel_fr: 67.89,
    wheel_rl: 45.12,
    wheel_rr: 89.01,
  });

  // Call resetTransforms
  useWheelAnimationStore.getState().resetTransforms();
  const resetState = useWheelAnimationStore.getState();

  assert.strictEqual(resetState.isSpinning, false, 'Must be stopped');
  assert.strictEqual(resetState.spinDirection, 1, 'Must be forward direction');
  assert.strictEqual(resetState.targetSteeringAngle, 0, 'Target steering must be 0 (center)');
  assert.strictEqual(resetState.currentSteeringAngle, 0, 'Current steering must be 0 (center)');
  assert.deepStrictEqual(
    resetState.wheelRollAngles,
    { wheel_fl: 0, wheel_fr: 0, wheel_rl: 0, wheel_rr: 0 },
    'All wheel roll angles must be exactly 0 with zero drift'
  );
});

// 11. ComponentHUD Integration for Wheel Dynamics
runTest('ComponentHUD integrates Wheel Dynamics and Kinematics controls', () => {
  const hudContent = fs.readFileSync('src/components/ui/ComponentHUD.jsx', 'utf-8');

  assert.ok(
    hudContent.includes('useWheelAnimationStore'),
    'ComponentHUD must import useWheelAnimationStore'
  );
  assert.ok(
    hudContent.includes('isWheelComponent'),
    'ComponentHUD must import and check isWheelComponent'
  );
  assert.ok(
    hudContent.includes('WHEEL DYNAMICS'),
    'ComponentHUD must render WHEEL DYNAMICS card'
  );
  assert.ok(
    hudContent.includes('STEERING YAW'),
    'ComponentHUD must render STEERING YAW telemetry for steerable wheels'
  );
});

// 12. App.jsx mounts WheelAnimationToolbar and tracks Part 15
runTest('App.jsx mounts WheelAnimationToolbar and tracks Part 15 as completed', () => {
  const appContent = fs.readFileSync('src/App.jsx', 'utf-8');

  assert.ok(
    appContent.includes('import { WheelAnimationToolbar }'),
    'App.jsx must import WheelAnimationToolbar'
  );
  assert.ok(
    appContent.includes('<WheelAnimationToolbar />'),
    'App.jsx must mount <WheelAnimationToolbar />'
  );
  assert.ok(
    /currentPart\s*=\s*(1[5-9]|20)/.test(appContent),
    'App.jsx currentPart must be >= 15'
  );

  const sceneGraphContent = fs.readFileSync('src/components/canvas/CarSceneGraph.jsx', 'utf-8');
  assert.ok(
    sceneGraphContent.includes('useWheelAnimation'),
    'CarSceneGraph must call useWheelAnimation(scene)'
  );
});

console.log('────────────────────────────────────────────────────');
console.log(`  Results: ${passedTests} passed, ${failedTests} failed`);
console.log('────────────────────────────────────────────────────\n');

if (failedTests > 0) {
  process.exit(1);
}
