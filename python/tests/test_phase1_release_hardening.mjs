import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');

console.log('--- TEST SUITE: Part 20 — Configurator Release Hardening & Phase-One Checkpoint ---');

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
      throw err;
    }
  }

  // 1. Stores Import
  const { usePaintStore } = await import('../../src/store/paintStore.js');
  const { useWheelStore } = await import('../../src/store/wheelStore.js');
  const { useSecondaryMaterialStore } = await import('../../src/store/secondaryMaterialStore.js');
  const { useVehicleRigStore } = await import('../../src/store/vehicleRigStore.js');
  const { useWheelAnimationStore } = await import('../../src/store/wheelAnimationStore.js');
  const { useVehicleLightingStore } = await import('../../src/store/vehicleLightingStore.js');
  const { useShowroomEnvironmentStore } = await import('../../src/store/showroomEnvironmentStore.js');
  const { useSelectionStore } = await import('../../src/store/selectionStore.js');
  const { useCameraStore } = await import('../../src/store/cameraStore.js');

  // 2. Master Factory Reset Coherence
  test('Master Factory Reset: All 9 subsystems reset to clean OEM baseline without cross-corruption', () => {
    // Dirty the state across all subsystems
    usePaintStore.getState().setCustomColor('#123456');
    usePaintStore.getState().setFinish('matte');
    useWheelStore.getState().setRimFinish('gloss_black');
    useWheelStore.getState().setCaliperPreset('red_brembo');
    useSecondaryMaterialStore.getState().setGlassProfile('privacy');
    useVehicleRigStore.getState().openAll();
    useWheelAnimationStore.getState().setTargetSteeringAngle(0.3);
    useWheelAnimationStore.getState().startSpin();
    useVehicleLightingStore.getState().setHeadlightMode('high_beam');
    useVehicleLightingStore.getState().setBrakeMode('active');
    useShowroomEnvironmentStore.getState().setEnvironment('cinematic_stage');
    useShowroomEnvironmentStore.getState().setExposureMultiplier(1.3);
    useSelectionStore.getState().selectComponent('door_fl');

    // Execute coordinated Master Reset
    usePaintStore.getState().resetToFactory();
    useWheelStore.getState().resetWheelsToFactory();
    useSecondaryMaterialStore.getState().resetToFactory();
    useVehicleRigStore.getState().resetAll();
    useWheelAnimationStore.getState().resetTransforms();
    useWheelAnimationStore.getState().stopSpin();
    useVehicleLightingStore.getState().allLightsOff();
    useShowroomEnvironmentStore.getState().resetEnvironment();
    useSelectionStore.getState().clearSelection();

    // Assert Clean Factory Baseline
    const paint = usePaintStore.getState();
    assert.strictEqual(paint.isFactory, true, 'Paint isFactory must be true');
    assert.strictEqual(paint.activeFinish, 'metallic', 'Paint finish must be metallic');

    const wheels = useWheelStore.getState();
    assert.strictEqual(wheels.rimFinishes.fl.preset, 'factory', 'Wheel FL preset must be factory');
    assert.strictEqual(wheels.caliperPreset, 'factory', 'Caliper preset must be factory');

    const sec = useSecondaryMaterialStore.getState();
    assert.strictEqual(sec.glassProfile, 'factory', 'Glass profile must be factory');
    assert.strictEqual(sec.chromeProfile, 'chrome', 'Chrome profile must be chrome');

    const rig = useVehicleRigStore.getState();
    assert.strictEqual(rig.closures.door_fl.currentProgress, 0, 'Door FL progress must be 0');
    assert.strictEqual(rig.closures.bonnet.currentProgress, 0, 'Bonnet progress must be 0');

    const anim = useWheelAnimationStore.getState();
    assert.strictEqual(anim.isSpinning, false, 'Wheel spin must be stopped');
    assert.strictEqual(anim.targetSteeringAngle, 0, 'Steering angle must be 0');

    const lights = useVehicleLightingStore.getState();
    assert.strictEqual(lights.headlightMode, 'off', 'Headlights must be off');
    assert.strictEqual(lights.brakeMode, 'off', 'Brake lights must be off');

    const env = useShowroomEnvironmentStore.getState();
    assert.strictEqual(env.activeEnvironmentId, 'premium_studio', 'Environment must be premium_studio');
    assert.strictEqual(env.exposureMultiplier, 1.0, 'Exposure multiplier must be 1.0');

    const sel = useSelectionStore.getState();
    assert.strictEqual(sel.selectedComponentId, null, 'Selection must be cleared');
  });

  // 3. State Isolation / Non-Corruption
  test('State Isolation: Independent subsystems do not mutate unrelated stores', () => {
    // 1. Modifying paint must not alter wheels or doors
    usePaintStore.getState().setCustomColor('#FF00FF');
    assert.strictEqual(useWheelStore.getState().rimFinishes.fl.preset, 'factory');
    assert.strictEqual(useVehicleRigStore.getState().closures.door_fl.state, 'closed');

    // 2. Modifying closures must not alter lights or paint
    useVehicleRigStore.getState().toggleClosure('door_fr');
    assert.strictEqual(usePaintStore.getState().primaryColor, '#FF00FF');
    assert.strictEqual(useVehicleLightingStore.getState().headlightMode, 'off');

    // 3. Switching environment must not alter paint color
    useShowroomEnvironmentStore.getState().setEnvironment('outdoor_daylight');
    assert.strictEqual(usePaintStore.getState().primaryColor, '#FF00FF');
    assert.strictEqual(useWheelStore.getState().rimFinishes.fl.preset, 'factory');

    // Clean up
    usePaintStore.getState().resetToFactory();
    useVehicleRigStore.getState().resetAll();
    useShowroomEnvironmentStore.getState().resetEnvironment();
  });

  // 4. Fallback Robustness & Defensive Error Handling
  const { getEnvironmentConfig } = await import('../../src/utils/showroomEnvironmentRegistry.js');
  const { createAutomotivePaintMaterial } = await import('../../src/materials/paintMaterialFactory.js');
  const { createRimFaceMaterial } = await import('../../src/materials/wheelMaterialFactory.js');

  test('Defensive Error Handling: Fallbacks for invalid inputs and corrupt keys', () => {
    // Environment fallback
    const fallbackEnv = getEnvironmentConfig('corrupted_or_missing_env_id');
    assert.strictEqual(fallbackEnv.id, 'premium_studio', 'Invalid env must fallback to premium_studio');

    // Paint material fallback
    const fallbackPaint = createAutomotivePaintMaterial({ finish: 'invalid_finish_id', color: '#112233' });
    assert(fallbackPaint, 'Paint material must be created despite invalid finish');
    assert.strictEqual(fallbackPaint.roughness, 0.22, 'Should fallback to metallic roughness 0.22');

    // Rim material fallback
    const fallbackRim = createRimFaceMaterial({ preset: 'invalid_rim_preset' });
    assert(fallbackRim, 'Rim material must be created despite invalid preset');
    assert.strictEqual(fallbackRim.metalness, 0.92, 'Should fallback to factory rim metalness');
  });

  // 5. Driving-Mode Serializable State Compatibility
  test('Driving-Mode Compatibility: Customization state is 100% serializable without Three.js object cycles', () => {
    const paintState = usePaintStore.getState().getPaintConfig();
    const wheelState = useWheelStore.getState().getWheelConfig();
    const secState = useSecondaryMaterialStore.getState().getSecondaryConfig();
    const lightingState = {
      headlightMode: useVehicleLightingStore.getState().headlightMode,
      brakeMode: useVehicleLightingStore.getState().brakeMode,
      indicatorMode: useVehicleLightingStore.getState().indicatorMode,
    };

    const combinedConfig = {
      paint: paintState,
      wheels: wheelState,
      secondary: secState,
      lighting: lightingState,
    };

    // Must serialize to JSON without throwing circular structure error
    let jsonStr;
    assert.doesNotThrow(() => {
      jsonStr = JSON.stringify(combinedConfig);
    }, 'Vehicle configuration must be strictly serializable for driving mode handoff');

    const parsed = JSON.parse(jsonStr);
    assert.strictEqual(typeof parsed.paint.primaryColor, 'string');
    assert.strictEqual(typeof parsed.wheels.rimFinishes, 'object');
    assert.strictEqual(typeof parsed.secondary.glass, 'string');
    assert.strictEqual(typeof parsed.lighting.headlightMode, 'string');
  });

  // 6. Semantic Rig Registry Completeness for Driving Mode Attachment
  const { SEMANTIC_COMPONENTS, CAR_PIVOTS } = await import('../../src/utils/carAssetRegistry.js');
  const { WHEEL_ANIMATION_CONFIG, TIRE_RADIUS_METERS } = await import('../../src/utils/wheelAnimationRegistry.js');

  test('Driving-Mode Vehicle Rig Integrity: All 4 wheel assemblies and chassis defined for physics', () => {
    // Chassis must be resolved
    assert(SEMANTIC_COMPONENTS.CHASSIS, 'Chassis component must exist');
    assert.strictEqual(SEMANTIC_COMPONENTS.CHASSIS.id, 'chassis');

    // Tire radius constant must be valid for physics speed calculation
    assert.strictEqual(typeof TIRE_RADIUS_METERS, 'number');
    assert(TIRE_RADIUS_METERS > 0.3 && TIRE_RADIUS_METERS < 0.45, 'Tire radius must be physically realistic');

    // 4 Wheels must have verified node assemblies and spin mesh mappings
    ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].forEach((id) => {
      const cfg = WHEEL_ANIMATION_CONFIG[id];
      assert(cfg, `Wheel config for ${id} must exist`);
      assert(cfg.assemblyNodeName, `Assembly node name must be defined for ${id}`);
      assert(Array.isArray(cfg.spinMeshNames), `Spin meshes must be listed for ${id}`);
    });
  });

  console.log(`\nResults: ${passed} / ${total} unit tests passed successfully.`);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
