import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');

console.log('--- TEST SUITE: Part 21 — Single-Player Driving Mode Architecture & Scene Separation ---');

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

  // 1. App Mode Store Verification
  const { useAppModeStore, APP_MODES } = await import('../../src/store/appModeStore.js');

  test('Mode Store: Default mode is SHOWROOM and switches cleanly to DRIVING', () => {
    // Baseline state
    assert.strictEqual(useAppModeStore.getState().mode, APP_MODES.SHOWROOM);
    assert.strictEqual(useAppModeStore.getState().isShowroomMode(), true);
    assert.strictEqual(useAppModeStore.getState().isDrivingMode(), false);

    // Switch to Driving Mode
    useAppModeStore.getState().setMode(APP_MODES.DRIVING);
    assert.strictEqual(useAppModeStore.getState().mode, APP_MODES.DRIVING);
    assert.strictEqual(useAppModeStore.getState().isDrivingMode(), true);
    assert.strictEqual(useAppModeStore.getState().isShowroomMode(), false);

    // Toggle back to Showroom
    useAppModeStore.getState().toggleMode();
    assert.strictEqual(useAppModeStore.getState().mode, APP_MODES.SHOWROOM);

    // Ignore invalid mode
    useAppModeStore.getState().setMode('invalid_mode');
    assert.strictEqual(useAppModeStore.getState().mode, APP_MODES.SHOWROOM);
  });

  // 2. Modular Scene Files Verification
  test('Modular Scene Files: Modular scenes and shared components exist with correct exports', () => {
    const requiredFiles = [
      'src/scenes/shared/ConfiguredVehicle.jsx',
      'src/scenes/showroom/ShowroomScene.jsx',
      'src/scenes/driving/DrivingScene.jsx',
      'src/scenes/driving/DrivingGround.jsx',
      'src/scenes/driving/DrivingCamera.jsx',
    ];

    for (const relPath of requiredFiles) {
      const fullPath = path.resolve(ROOT, relPath);
      assert.strictEqual(fs.existsSync(fullPath), true, `File must exist: ${relPath}`);
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert.strictEqual(content.includes('export default function'), true, `${relPath} must have default export`);
    }
  });

  // 3. Shared Vehicle Configuration Continuity
  const { usePaintStore } = await import('../../src/store/paintStore.js');
  const { useWheelStore } = await import('../../src/store/wheelStore.js');
  const { useSecondaryMaterialStore } = await import('../../src/store/secondaryMaterialStore.js');
  const { useVehicleLightingStore } = await import('../../src/store/vehicleLightingStore.js');

  test('Vehicle Customization Continuity: Customization state survives mode transitions', () => {
    // Apply customizations in showroom
    usePaintStore.getState().setCustomColor('#FF2200');
    usePaintStore.getState().setFinish('matte');
    useWheelStore.getState().setRimFinish('gloss_black');
    useSecondaryMaterialStore.getState().setGlassProfile('tinted');
    useVehicleLightingStore.getState().setHeadlightMode('low_beam');

    // Transition to Driving mode
    useAppModeStore.getState().setMode(APP_MODES.DRIVING);

    // Verify all customizations are completely intact in driving mode
    assert.strictEqual(usePaintStore.getState().primaryColor, '#FF2200');
    assert.strictEqual(usePaintStore.getState().activeFinish, 'matte');
    assert.strictEqual(useWheelStore.getState().rimFinishes.fl.preset, 'gloss_black');
    assert.strictEqual(useSecondaryMaterialStore.getState().glassProfile, 'tinted');
    assert.strictEqual(useVehicleLightingStore.getState().headlightMode, 'low_beam');

    // Return to Showroom mode
    useAppModeStore.getState().setMode(APP_MODES.SHOWROOM);

    // Verify zero data loss on return
    assert.strictEqual(usePaintStore.getState().primaryColor, '#FF2200');
    assert.strictEqual(usePaintStore.getState().activeFinish, 'matte');
    assert.strictEqual(useWheelStore.getState().rimFinishes.fl.preset, 'gloss_black');

    // Cleanup to factory baseline
    usePaintStore.getState().resetToFactory();
    useWheelStore.getState().resetWheelsToFactory();
    useSecondaryMaterialStore.getState().resetToFactory();
    useVehicleLightingStore.getState().allLightsOff();
  });

  // 4. Ground Tangency & Calibration Verification
  test('Ground Tangency Calibration: CarAssetLoader applies ground tangency offset', () => {
    const loaderPath = path.resolve(ROOT, 'src/components/canvas/CarAssetLoader.jsx');
    const content = fs.readFileSync(loaderPath, 'utf-8');
    assert.strictEqual(content.includes('groundOffsetY'), true, 'CarAssetLoader must compute and pass groundOffsetY');
    assert.strictEqual(content.includes('metrics.bounds.min.y'), true, 'CarAssetLoader must check bounds.min.y');
  });

  // 5. App UI Header Mode Switcher Integration
  test('StudioHeader Mode Switcher: StudioHeader renders mode switcher and connects to store', () => {
    const headerPath = path.resolve(ROOT, 'src/components/ui/StudioHeader.jsx');
    const content = fs.readFileSync(headerPath, 'utf-8');
    assert.strictEqual(content.includes('useAppModeStore'), true, 'StudioHeader must use useAppModeStore');
    assert.strictEqual(content.includes('APP_MODES.SHOWROOM'), true, 'StudioHeader must reference APP_MODES.SHOWROOM');
    assert.strictEqual(content.includes('APP_MODES.DRIVING'), true, 'StudioHeader must reference APP_MODES.DRIVING');
  });

  console.log(`\nResults: ${passed} / ${total} unit tests passed successfully.`);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
