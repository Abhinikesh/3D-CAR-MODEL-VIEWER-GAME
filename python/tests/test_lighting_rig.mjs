/**
 * Automated Unit Tests for Part 16 — Dynamic Automotive Lighting System
 *
 * Verifies:
 * 1. Lighting meshes exist in car_manifest.json and map to verified pivots
 * 2. Registry exports all required lighting modes and enums
 * 3. Standard blinker timing conforms to 1.5 Hz ECE R48 specification
 * 4. getLightingCapabilities() accurately discloses physical geometry limitations
 * 5. Emissive presets define valid PBR parameters and intensity progressions
 * 6. Light source specifications define valid positions and beam parameters
 * 7. vehicleLightingStore initializes in ALL OFF idle state
 * 8. Headlamp mode transitions (OFF -> PARKING -> LOW -> HIGH -> OFF) and auto-taillight sync
 * 9. Brake light activation and dual-stage taillight behavior
 * 10. Indicator and Hazard warning flasher logic and mutual exclusivity
 * 11. allLightsOff action resets all modes simultaneously
 * 12. App.jsx, CarSceneGraph.jsx, and ComponentHUD.jsx integration
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

console.log('\n◎ Part 16 — Dynamic Automotive Lighting System Unit Tests\n');

// 1. Manifest verification
runTest('All lighting meshes exist in car_manifest.json and attach to verified pivots', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(ROOT, 'python/reports/car_manifest.json'), 'utf-8')
  );
  const nodes = manifest.nodes || [];
  const nodeNames = new Set(nodes.map((n) => n.name));

  assert.ok(nodeNames.has('BodyHeadlights') || nodeNames.has('Mesh_Headlight_Assemblies'), 'Headlights must exist in manifest');
  assert.ok(nodeNames.has('BodyTaillights') || nodeNames.has('Mesh_Taillight_Assemblies'), 'Taillights must exist in manifest');
  assert.ok(nodeNames.has('BodyTurnsignalsRear'), 'Rear turn signals must exist in manifest');
  assert.ok(nodeNames.has('Pivot_Bonnet'), 'Pivot_Bonnet must exist for headlight mounting');
  assert.ok(nodeNames.has('Pivot_Boot'), 'Pivot_Boot must exist for taillight/signal mounting');
});

// 2. Registry modes and enums
runTest('Registry exports all required lighting modes and enums', async () => {
  const {
    HEADLIGHT_MODES,
    TAILLIGHT_MODES,
    BRAKE_MODES,
    INDICATOR_MODES,
  } = await import('../../src/utils/vehicleLightingRegistry.js');

  assert.deepStrictEqual(HEADLIGHT_MODES, {
    OFF: 'off',
    PARKING: 'parking',
    LOW_BEAM: 'low_beam',
    HIGH_BEAM: 'high_beam',
  });

  assert.deepStrictEqual(TAILLIGHT_MODES, {
    OFF: 'off',
    RUNNING: 'running',
  });

  assert.deepStrictEqual(BRAKE_MODES, {
    OFF: 'off',
    ACTIVE: 'active',
  });

  assert.deepStrictEqual(INDICATOR_MODES, {
    OFF: 'off',
    LEFT: 'left',
    RIGHT: 'right',
    HAZARD: 'hazard',
  });
});

// 3. Blinker timing constants
runTest('Blinker timing conforms to 1.5 Hz standard (667ms period, 50% duty cycle)', async () => {
  const { BLINK_PERIOD_MS, BLINK_DUTY_CYCLE } = await import(
    '../../src/utils/vehicleLightingRegistry.js'
  );

  assert.ok(BLINK_PERIOD_MS >= 600 && BLINK_PERIOD_MS <= 800, 'Period must be ~667ms');
  assert.strictEqual(BLINK_DUTY_CYCLE, 0.5, 'Duty cycle must be 50%');

  // Calculates ~90 flashes per minute
  const flashesPerMinute = (60 * 1000) / BLINK_PERIOD_MS;
  assert.ok(flashesPerMinute >= 75 && flashesPerMinute <= 100, 'Must be ~90 flashes/min');
});

// 4. Physical capability and limitation disclosure
runTest('getLightingCapabilities() honestly discloses model geometry limitations', async () => {
  const { getLightingCapabilities } = await import(
    '../../src/utils/vehicleLightingRegistry.js'
  );

  const caps = getLightingCapabilities();
  assert.strictEqual(caps.headlightLensesSeparate, false, 'Headlight lenses are not separate meshes');
  assert.strictEqual(caps.frontIndicatorsPresentInGeometry, false, 'Front indicators absent from geometry');
  assert.strictEqual(caps.taillightBrakeSharedGeometry, true, 'Taillights and brake share BodyTaillights');
  assert.ok(caps.supportedFunctions.length >= 10, 'Must support 10 lighting functions');
  assert.ok(caps.limitations.length >= 4, 'Must document 4 limitations');
});

// 5. Emissive material presets
runTest('Emissive presets define valid PBR parameters and intensity progression', async () => {
  const {
    HEADLIGHT_EMISSIVE_PRESETS,
    TAILLIGHT_EMISSIVE_PRESETS,
    SIGNALLIGHT_EMISSIVE_PRESETS,
  } = await import('../../src/utils/vehicleLightingRegistry.js');

  // Headlight progression: OFF < PARKING < LOW_BEAM < HIGH_BEAM
  assert.strictEqual(HEADLIGHT_EMISSIVE_PRESETS.off.emissiveIntensity, 0);
  assert.ok(HEADLIGHT_EMISSIVE_PRESETS.parking.emissiveIntensity > 0);
  assert.ok(HEADLIGHT_EMISSIVE_PRESETS.low_beam.emissiveIntensity > HEADLIGHT_EMISSIVE_PRESETS.parking.emissiveIntensity);
  assert.ok(HEADLIGHT_EMISSIVE_PRESETS.high_beam.emissiveIntensity > HEADLIGHT_EMISSIVE_PRESETS.low_beam.emissiveIntensity);

  // Taillight dual-stage: OFF < RUNNING < BRAKE
  assert.strictEqual(TAILLIGHT_EMISSIVE_PRESETS.off.emissiveIntensity, 0);
  assert.ok(TAILLIGHT_EMISSIVE_PRESETS.running.emissiveIntensity > 0);
  assert.ok(TAILLIGHT_EMISSIVE_PRESETS.brake.emissiveIntensity > TAILLIGHT_EMISSIVE_PRESETS.running.emissiveIntensity);

  // Signals: BLINK_ON > BLINK_OFF
  assert.strictEqual(SIGNALLIGHT_EMISSIVE_PRESETS.blink_off.emissiveIntensity, 0);
  assert.ok(SIGNALLIGHT_EMISSIVE_PRESETS.blink_on.emissiveIntensity > 0);
});

// 6. Real light source specifications
runTest('Light source specifications define valid positions and throw parameters', async () => {
  const { LIGHT_SOURCE_SPECS } = await import('../../src/utils/vehicleLightingRegistry.js');

  const hl = LIGHT_SOURCE_SPECS.headlights;
  assert.ok(hl.leftPosLocal[0] > 0, 'Left headlight has positive X');
  assert.ok(hl.rightPosLocal[0] < 0, 'Right headlight has negative X');
  assert.ok(hl.highBeam.distance > hl.lowBeam.distance, 'High beam has longer distance throw');
  assert.ok(hl.highBeam.intensity > hl.lowBeam.intensity, 'High beam has higher intensity');

  const tl = LIGHT_SOURCE_SPECS.taillights;
  assert.ok(tl.brake.intensity > tl.running.intensity, 'Brake light has higher intensity than running light');
});

// 7. vehicleLightingStore initial state
runTest('useVehicleLightingStore initializes in ALL OFF idle state', async () => {
  const { useVehicleLightingStore } = await import('../../src/store/vehicleLightingStore.js');
  const state = useVehicleLightingStore.getState();

  assert.strictEqual(state.headlightMode, 'off');
  assert.strictEqual(state.taillightMode, 'off');
  assert.strictEqual(state.brakeMode, 'off');
  assert.strictEqual(state.indicatorMode, 'off');
  assert.strictEqual(state.isBlinking, false);
});

// 8. Headlight mode transitions and auto taillight sync
runTest('Headlamp mode transitions and automatic taillight electrical activation', async () => {
  const { useVehicleLightingStore } = await import('../../src/store/vehicleLightingStore.js');

  // OFF -> PARKING -> Taillights automatically turn RUNNING
  useVehicleLightingStore.getState().setHeadlightMode('parking');
  assert.strictEqual(useVehicleLightingStore.getState().headlightMode, 'parking');
  assert.strictEqual(useVehicleLightingStore.getState().taillightMode, 'running');

  // LOW_BEAM
  useVehicleLightingStore.getState().setHeadlightMode('low_beam');
  assert.strictEqual(useVehicleLightingStore.getState().headlightMode, 'low_beam');
  assert.strictEqual(useVehicleLightingStore.getState().taillightMode, 'running');

  // HIGH_BEAM
  useVehicleLightingStore.getState().setHeadlightMode('high_beam');
  assert.strictEqual(useVehicleLightingStore.getState().headlightMode, 'high_beam');
  assert.strictEqual(useVehicleLightingStore.getState().taillightMode, 'running');

  // OFF -> Taillights turn OFF
  useVehicleLightingStore.getState().setHeadlightMode('off');
  assert.strictEqual(useVehicleLightingStore.getState().headlightMode, 'off');
  assert.strictEqual(useVehicleLightingStore.getState().taillightMode, 'off');
});

// 9. Brake light activation and dual-stage taillight behavior
runTest('Brake light activation and release actions', async () => {
  const { useVehicleLightingStore } = await import('../../src/store/vehicleLightingStore.js');

  // Press brake
  useVehicleLightingStore.getState().pressBrake();
  assert.strictEqual(useVehicleLightingStore.getState().brakeMode, 'active');

  // Release brake
  useVehicleLightingStore.getState().releaseBrake();
  assert.strictEqual(useVehicleLightingStore.getState().brakeMode, 'off');

  // Toggle brake
  useVehicleLightingStore.getState().toggleBrakeLights();
  assert.strictEqual(useVehicleLightingStore.getState().brakeMode, 'active');
  useVehicleLightingStore.getState().toggleBrakeLights();
  assert.strictEqual(useVehicleLightingStore.getState().brakeMode, 'off');
});

// 10. Indicator and Hazard warning flasher logic
runTest('Indicator and Hazard warning flasher logic and mutual exclusivity', async () => {
  const { useVehicleLightingStore } = await import('../../src/store/vehicleLightingStore.js');

  // Turn Left on
  useVehicleLightingStore.getState().toggleLeftIndicator();
  assert.strictEqual(useVehicleLightingStore.getState().indicatorMode, 'left');
  assert.strictEqual(useVehicleLightingStore.getState().isBlinking, true);

  // Turn Right on (should switch to right)
  useVehicleLightingStore.getState().toggleRightIndicator();
  assert.strictEqual(useVehicleLightingStore.getState().indicatorMode, 'right');

  // Toggle Hazard on
  useVehicleLightingStore.getState().toggleHazard();
  assert.strictEqual(useVehicleLightingStore.getState().indicatorMode, 'hazard');

  // Toggle Hazard off (returns to off)
  useVehicleLightingStore.getState().toggleHazard();
  assert.strictEqual(useVehicleLightingStore.getState().indicatorMode, 'off');
  assert.strictEqual(useVehicleLightingStore.getState().isBlinking, false);
});

// 11. allLightsOff master reset action
runTest('allLightsOff resets all lighting modes simultaneously', async () => {
  const { useVehicleLightingStore } = await import('../../src/store/vehicleLightingStore.js');

  // Turn on multiple lights
  useVehicleLightingStore.getState().setHeadlightMode('high_beam');
  useVehicleLightingStore.getState().setBrakeMode('active');
  useVehicleLightingStore.getState().setIndicatorMode('hazard');

  // Reset
  useVehicleLightingStore.getState().allLightsOff();
  const reset = useVehicleLightingStore.getState();

  assert.strictEqual(reset.headlightMode, 'off');
  assert.strictEqual(reset.taillightMode, 'off');
  assert.strictEqual(reset.brakeMode, 'off');
  assert.strictEqual(reset.indicatorMode, 'off');
  assert.strictEqual(reset.isBlinking, false);
});

// 12. Component & App Integration
runTest('App.jsx, CarSceneGraph.jsx, and ComponentHUD.jsx integrate lighting controls', () => {
  const appContent = fs.readFileSync('src/App.jsx', 'utf-8');
  assert.ok(appContent.includes('VehicleLightingToolbar'), 'App.jsx must import and mount VehicleLightingToolbar');
  assert.ok(/currentPart\s*=\s*(1[6-9]|20)/.test(appContent), 'App.jsx currentPart must be >= 16');

  const sceneGraphContent = fs.readFileSync('src/components/canvas/CarSceneGraph.jsx', 'utf-8');
  assert.ok(sceneGraphContent.includes('useVehicleLighting'), 'CarSceneGraph must call useVehicleLighting');

  const hudContent = fs.readFileSync('src/components/ui/ComponentHUD.jsx', 'utf-8');
  assert.ok(hudContent.includes('useVehicleLightingStore'), 'ComponentHUD must import useVehicleLightingStore');
  assert.ok(hudContent.includes('HEADLAMP CONTROLS'), 'ComponentHUD must render HEADLAMP CONTROLS');
});

console.log('────────────────────────────────────────────────────');
console.log(`  Results: ${passedTests} passed, ${failedTests} failed`);
console.log('────────────────────────────────────────────────────\n');

if (failedTests > 0) {
  process.exit(1);
}
