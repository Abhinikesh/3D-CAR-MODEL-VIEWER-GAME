import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');

console.log('--- TEST SUITE: Performance Optimization, Resource Management & Stability ---');

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

  // 1. Performance Store Tests
  const { usePerformanceStore } = await import('../../src/store/performanceStore.js');

  test('PerformanceStore: Initial state and metric getters', () => {
    const s = usePerformanceStore.getState();
    assert.strictEqual(typeof s.fps, 'number');
    assert.strictEqual(typeof s.frameTimeMs, 'number');
    assert.strictEqual(s.isDiagnosticsOpen, false);
    assert.strictEqual(s.isContextLost, false);

    const snap = s.getSnapshot();
    assert.strictEqual(snap.isContextLost, false);
  });

  test('PerformanceStore: Actions toggleDiagnostics and setContextLost', () => {
    const store = usePerformanceStore.getState();
    store.toggleDiagnostics();
    assert.strictEqual(usePerformanceStore.getState().isDiagnosticsOpen, true);

    store.toggleDiagnostics();
    assert.strictEqual(usePerformanceStore.getState().isDiagnosticsOpen, false);

    store.setContextLost(true);
    assert.strictEqual(usePerformanceStore.getState().isContextLost, true);

    store.setContextLost(false);
    assert.strictEqual(usePerformanceStore.getState().isContextLost, false);

    store.updateMetrics({ fps: 58, frameTimeMs: 17.2, drawCalls: 120 });
    assert.strictEqual(usePerformanceStore.getState().fps, 58);
    assert.strictEqual(usePerformanceStore.getState().drawCalls, 120);
  });

  // 2. WheelCustomizationEngine Memory Disposal Tests
  const { WheelCustomizationEngine } = await import('../../src/materials/wheelCustomizationEngine.js');

  test('WheelCustomizationEngine: Safely disposes superseded custom materials during re-application', () => {
    const engine = new WheelCustomizationEngine();

    // Mock rim mesh with array material
    let disposedCount = 0;
    const origMat0 = new THREE.MeshStandardMaterial({ name: 'orig_rim_face' });
    const origMat1 = new THREE.MeshStandardMaterial({ name: 'orig_rim_inner' });
    const mockRimMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      [origMat0, origMat1]
    );
    mockRimMesh.name = 'Mesh_Rim_FL';

    const root = new THREE.Group();
    root.add(mockRimMesh);

    engine.initializeFromScene(root);
    assert.strictEqual(engine.rimMeshes.fl, mockRimMesh);

    // Apply rim finish 1
    engine.applyRimFinishes({ fl: { preset: 'gloss_black', customColor: null } });
    assert.strictEqual(engine.activeCustomMaterials.size, 2);

    // Track dispose calls on current custom materials
    const customMats1 = [...engine.activeCustomMaterials];
    customMats1.forEach((m) => {
      const origDispose = m.dispose.bind(m);
      m.dispose = () => {
        disposedCount++;
        origDispose();
      };
    });

    // Apply rim finish 2 (should trigger dispose on customMats1)
    engine.applyRimFinishes({ fl: { preset: 'bronze_satin', customColor: null } });
    assert.strictEqual(disposedCount, 2, 'Previous custom materials must be disposed on change');
    assert.strictEqual(engine.activeCustomMaterials.size, 2, 'Only current custom materials should be retained');

    // Restore factory wheels
    engine.restoreFactoryWheels();
    assert.strictEqual(engine.activeCustomMaterials.size, 0, 'All custom materials must be cleared on factory restore');
    assert.strictEqual(mockRimMesh.material[0], origMat0, 'Original factory material 0 must be restored');
    assert.strictEqual(mockRimMesh.material[1], origMat1, 'Original factory material 1 must be restored');
  });

  // 3. SecondaryMaterialEngine Memory Disposal Tests
  const { SecondaryMaterialEngine } = await import('../../src/materials/secondaryMaterialEngine.js');

  test('SecondaryMaterialEngine: Disposes superseded materials on repeated glass updates', () => {
    const engine = new SecondaryMaterialEngine();

    let disposedCount = 0;
    const origGlassMat = new THREE.MeshPhysicalMaterial({ name: 'orig_glass' });
    const mockGlassMesh = new THREE.Mesh(new THREE.BufferGeometry(), origGlassMat);
    mockGlassMesh.name = 'BodyWindshield';

    const root = new THREE.Group();
    root.add(mockGlassMesh);

    engine.initializeFromScene(root);
    assert.strictEqual(engine.glassMeshes.length, 1);

    // Apply tinted glass
    engine.applyGlass('tinted');
    assert.strictEqual(engine.activeCustomMaterials.size, 1);

    const firstGlassMat = [...engine.activeCustomMaterials][0];
    const origDispose = firstGlassMat.dispose.bind(firstGlassMat);
    firstGlassMat.dispose = () => {
      disposedCount++;
      origDispose();
    };

    // Apply privacy glass
    engine.applyGlass('privacy');
    assert.strictEqual(disposedCount, 1, 'Previous glass material must be disposed on change');
    assert.strictEqual(engine.activeCustomMaterials.size, 1);

    // Restore glass
    engine.restoreGlass();
    assert.strictEqual(mockGlassMesh.material, origGlassMat, 'Original glass material must be restored');
  });

  // 4. Hot Loop Allocation Safety Verification
  test('Hot Loop Safety: ShowroomEnvironmentController has no inside-loop object allocations', () => {
    const filePath = path.join(ROOT, 'src/components/canvas/ShowroomEnvironmentController.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract useFrame block
    const useFrameStart = content.indexOf('useFrame(');
    const useFrameEnd = content.indexOf('return (', useFrameStart);
    const useFrameBlock = content.slice(useFrameStart, useFrameEnd);

    assert(
      !useFrameBlock.includes('new THREE.Color'),
      'ShowroomEnvironmentController useFrame must NOT allocate new THREE.Color'
    );
    assert(
      !useFrameBlock.includes('new THREE.Vector3'),
      'ShowroomEnvironmentController useFrame must NOT allocate new THREE.Vector3'
    );
  });

  test('Hot Loop Safety: useWheelAnimation has no inside-loop Euler allocations', () => {
    const filePath = path.join(ROOT, 'src/hooks/useWheelAnimation.js');
    const content = fs.readFileSync(filePath, 'utf8');

    const useFrameStart = content.indexOf('useFrame(');
    const useFrameEnd = content.indexOf('return null;', useFrameStart);
    const useFrameBlock = content.slice(useFrameStart, useFrameEnd);

    assert(
      !useFrameBlock.includes('new THREE.Euler'),
      'useWheelAnimation useFrame must NOT allocate new THREE.Euler'
    );
    assert(
      !useFrameBlock.includes("['wheel_fl', 'wheel_fr'].forEach"),
      'useWheelAnimation useFrame must NOT allocate arrays in steering loop'
    );
  });

  // 5. Diagnostics Component & Context Loss Check
  test('Diagnostics HUD: PerformanceDiagnosticsCollector attaches listeners & exposes metrics', () => {
    const collectorPath = path.join(
      ROOT,
      'src/components/canvas/PerformanceDiagnosticsCollector.jsx'
    );
    const content = fs.readFileSync(collectorPath, 'utf8');

    assert(content.includes('webglcontextlost'), 'Collector must listen to webglcontextlost');
    assert(content.includes('webglcontextrestored'), 'Collector must listen to webglcontextrestored');
    assert(content.includes('window.__PERF_METRICS__'), 'Collector must expose metrics globally');
    assert(content.includes('gl.info.render'), 'Collector must read gl.info.render');
  });

  console.log(`\nResults: ${passed} / ${total} unit tests passed successfully.`);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
