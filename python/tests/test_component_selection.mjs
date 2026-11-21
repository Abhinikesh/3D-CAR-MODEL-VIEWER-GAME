import fs from 'fs';
import assert from 'assert';
import {
  MESH_TO_COMPONENT_MAP,
  resolveComponentByMeshName,
  getComponentTechnicalDetails,
  COMPONENT_TECHNICAL_DATA,
  COMPONENT_RESOLUTION_PRIORITY,
} from '../../src/utils/componentResolver.js';
import { useSelectionStore } from '../../src/store/selectionStore.js';
import { useCameraStore, FOCUS_TARGETS } from '../../src/store/cameraStore.js';
import { SEMANTIC_COMPONENTS } from '../../src/utils/carAssetRegistry.js';

console.log('\n◎ Part 13 — Interactive Component Raycasting & Selection Unit Tests\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗  FAIL: ${name}`);
    console.error(`     ${err.message}`);
    process.exitCode = 1;
  }
}

// 1. Manifest Mesh Mapping Completeness
runTest('All 97 manifest mesh nodes resolve to a canonical semantic component', () => {
  const manifest = JSON.parse(fs.readFileSync('python/reports/car_manifest.json'));
  const meshNodes = manifest.nodes.filter((n) => n.has_mesh);

  assert.strictEqual(meshNodes.length, 97, 'Manifest should contain 97 mesh nodes');

  let resolvedCount = 0;
  for (const node of meshNodes) {
    const compId = resolveComponentByMeshName(node.name);
    assert.ok(compId, `Node ${node.name} must resolve to a valid component ID`);
    resolvedCount++;
  }

  assert.strictEqual(resolvedCount, 97, 'All 97 nodes must resolve successfully');
});

// 2. Specific Sub-Assembly Resolution Accuracy
runTest('High-priority mechanical sub-assemblies resolve with exact precision', () => {
  // Wheels
  assert.strictEqual(resolveComponentByMeshName('Mesh_Rim_FL'), 'wheel_fl');
  assert.strictEqual(resolveComponentByMeshName('Mesh_Caliper_FL'), 'wheel_fl');
  assert.strictEqual(resolveComponentByMeshName('WheelFrontLBrakeDisc'), 'wheel_fl');
  assert.strictEqual(resolveComponentByMeshName('node_84'), 'wheel_fl');

  assert.strictEqual(resolveComponentByMeshName('Mesh_Rim_FR'), 'wheel_fr');
  assert.strictEqual(resolveComponentByMeshName('node_89'), 'wheel_fr');

  assert.strictEqual(resolveComponentByMeshName('Mesh_Rim_RL'), 'wheel_rl');
  assert.strictEqual(resolveComponentByMeshName('node_94'), 'wheel_rl');

  assert.strictEqual(resolveComponentByMeshName('Mesh_Rim_RR'), 'wheel_rr');
  assert.strictEqual(resolveComponentByMeshName('node_99'), 'wheel_rr');

  // Doors
  assert.strictEqual(resolveComponentByMeshName('BodyDoorLColor2'), 'door_fl');
  assert.strictEqual(resolveComponentByMeshName('Glass_Door_FL'), 'door_fl');
  assert.strictEqual(resolveComponentByMeshName('BodyDoorRColor2'), 'door_fr');
  assert.strictEqual(resolveComponentByMeshName('Glass_Door_FR'), 'door_fr');

  // Closures
  assert.strictEqual(resolveComponentByMeshName('BodyHoodTopgrill'), 'bonnet');
  assert.strictEqual(resolveComponentByMeshName('InteriorRearHatch'), 'boot');

  // Lighting & Glazing
  assert.strictEqual(resolveComponentByMeshName('Glass_Windshield'), 'glass');
  assert.strictEqual(resolveComponentByMeshName('Mesh_Headlight_Assemblies'), 'headlights');
  assert.strictEqual(resolveComponentByMeshName('Mesh_Taillight_Assemblies'), 'taillights');

  // Interior & Powertrain
  assert.strictEqual(resolveComponentByMeshName('InteriorCage'), 'interior');
  assert.strictEqual(resolveComponentByMeshName('Engine'), 'powertrain');
  assert.strictEqual(resolveComponentByMeshName('BodyUnderside'), 'chassis');
});

// 3. Technical Metadata Generation
runTest('COMPONENT_TECHNICAL_DATA defines telemetry and descriptions for all 17 components', () => {
  const compIds = Object.values(SEMANTIC_COMPONENTS).map((c) => c.id);
  assert.strictEqual(compIds.length, 17);

  for (const compId of compIds) {
    const tech = COMPONENT_TECHNICAL_DATA[compId];
    assert.ok(tech, `Missing COMPONENT_TECHNICAL_DATA for '${compId}'`);
    assert.ok(tech.title && tech.title.length > 0, `Title missing for '${compId}'`);
    assert.ok(tech.subtitle && tech.subtitle.length > 0, `Subtitle missing for '${compId}'`);
    assert.ok(tech.description && tech.description.length > 0, `Description missing for '${compId}'`);
  }
});

// 4. Component Technical Details Generator
runTest('getComponentTechnicalDetails generates complete serializable object', () => {
  const details = getComponentTechnicalDetails('door_fl');
  assert.ok(details);
  assert.strictEqual(details.id, 'door_fl');
  assert.strictEqual(details.name, 'Front-Left Door');
  assert.strictEqual(details.category, 'Closures');
  assert.strictEqual(details.isHinged, true);
  assert.strictEqual(details.maxAngleDeg, 65);
  assert.ok(details.materialStatus);
});

// 5. Selection Store Initialization & Defaults
runTest('selectionStore initializes with correct idle state and preferences', () => {
  const state = useSelectionStore.getState();
  assert.strictEqual(state.selectedComponentId, null);
  assert.strictEqual(state.selectedMeshName, null);
  assert.strictEqual(state.selectedComponent, null);
  assert.strictEqual(state.hoveredComponentId, null);
  assert.strictEqual(state.focusOnClick, true);
  assert.strictEqual(state.showBoundingBox, true);
  assert.strictEqual(state.showWireframe, true);
  assert.strictEqual(state.isDrawerOpen, false);
});

// 6. Selection Store State Mutations
runTest('selectionStore actions update and clear selection cleanly', () => {
  const store = useSelectionStore.getState();

  // Test Hover
  store.setHovered('wheel_fl', 'Mesh_Rim_FL', [1.05, 0.35, 1.35], { x: 320, y: 240 });
  let current = useSelectionStore.getState();
  assert.strictEqual(current.hoveredComponentId, 'wheel_fl');
  assert.strictEqual(current.hoveredMeshName, 'Mesh_Rim_FL');
  assert.deepStrictEqual(current.hoverPoint, [1.05, 0.35, 1.35]);
  assert.deepStrictEqual(current.hoverScreenPos, { x: 320, y: 240 });

  store.clearHovered();
  current = useSelectionStore.getState();
  assert.strictEqual(current.hoveredComponentId, null);
  assert.strictEqual(current.hoverPoint, null);

  // Test Select
  store.selectComponent('door_fl', 'BodyDoorLColor2');
  current = useSelectionStore.getState();
  assert.strictEqual(current.selectedComponentId, 'door_fl');
  assert.strictEqual(current.selectedMeshName, 'BodyDoorLColor2');
  assert.ok(current.selectedComponent);
  assert.strictEqual(current.selectedComponent.id, 'door_fl');

  // Test Deselect
  store.clearSelection();
  current = useSelectionStore.getState();
  assert.strictEqual(current.selectedComponentId, null);
  assert.strictEqual(current.selectedComponent, null);
});

// 7. Store Toggle Actions
runTest('selectionStore toggles preferences correctly', () => {
  const store = useSelectionStore.getState();

  store.toggleBoundingBox();
  assert.strictEqual(useSelectionStore.getState().showBoundingBox, false);
  store.toggleBoundingBox();
  assert.strictEqual(useSelectionStore.getState().showBoundingBox, true);

  store.toggleWireframe();
  assert.strictEqual(useSelectionStore.getState().showWireframe, false);
  store.toggleWireframe();
  assert.strictEqual(useSelectionStore.getState().showWireframe, true);

  store.toggleFocusOnClick();
  assert.strictEqual(useSelectionStore.getState().focusOnClick, false);
  store.toggleFocusOnClick();
  assert.strictEqual(useSelectionStore.getState().focusOnClick, true);

  store.toggleDrawer();
  assert.strictEqual(useSelectionStore.getState().isDrawerOpen, true);
  store.toggleDrawer();
  assert.strictEqual(useSelectionStore.getState().isDrawerOpen, false);
});

// 8. Camera Framing Integration for All 17 Components
runTest('cameraStore FOCUS_TARGETS includes valid camera targets for all 17 components', () => {
  const compIds = Object.values(SEMANTIC_COMPONENTS).map((c) => c.id);

  for (const compId of compIds) {
    assert.ok(FOCUS_TARGETS[compId], `FOCUS_TARGETS must define target for '${compId}'`);
    const def = FOCUS_TARGETS[compId];
    assert.strictEqual(def.target.length, 3, `'${compId}' target must have [x, y, z]`);
    assert.strictEqual(def.position.length, 3, `'${compId}' position must have [x, y, z]`);
  }
});

// 9. Camera focusOn Execution
runTest('focusOn action animates camera to frame selected component', () => {
  const camera = useCameraStore.getState();

  camera.focusOn('door_fl');
  const afterDoor = useCameraStore.getState();
  assert.strictEqual(afterDoor.activePreset, 'focus-door_fl');
  assert.strictEqual(afterDoor.isTransitioning, true);
  assert.deepStrictEqual(afterDoor.desiredTarget, FOCUS_TARGETS.door_fl.target);
  assert.deepStrictEqual(afterDoor.desiredPosition, FOCUS_TARGETS.door_fl.position);

  camera.focusOn('wheel_fl');
  const afterWheel = useCameraStore.getState();
  assert.strictEqual(afterWheel.activePreset, 'focus-wheel_fl');
  assert.strictEqual(afterWheel.isTransitioning, true);
  assert.deepStrictEqual(afterWheel.desiredTarget, FOCUS_TARGETS.wheel_fl.target);
});

// 10. Zero Mutation / Material Preservation Constraint
runTest('Selection highlight architecture preserves original car materials without mutation', () => {
  const fileContent = fs.readFileSync('src/components/canvas/SelectionHighlight.jsx', 'utf-8');

  // Verify that SelectionHighlight uses its own overlay materials
  assert.ok(fileContent.includes('MeshBasicMaterial'), 'Must use dedicated MeshBasicMaterial for wireframe');
  assert.ok(fileContent.includes('polygonOffset: true'), 'Must use polygonOffset to eliminate Z-fighting');
  assert.ok(fileContent.includes('matrixAutoUpdate={false}'), 'Must use matrixWorld copy to align overlay meshes');

  // Ensure it does not mutate node.material
  assert.ok(!fileContent.includes('node.material ='), 'Must never assign node.material');
  assert.ok(!fileContent.includes('mesh.material ='), 'Must never assign mesh.material');
});

// 11. ComponentHUD Component File Structure
runTest('ComponentHUD.jsx exports default React component and includes telemetry elements', () => {
  const hudContent = fs.readFileSync('src/components/ui/ComponentHUD.jsx', 'utf-8');
  assert.ok(hudContent.includes('export default function ComponentHUD'), 'Must export ComponentHUD');
  assert.ok(hudContent.includes('EXPLORE COMPONENTS'), 'Must provide explorer drawer button');
  assert.ok(hudContent.includes('FOCUS CAMERA'), 'Must provide Focus Camera action');
  assert.ok(hudContent.includes('WIREFRAME'), 'Must provide Wireframe toggle');
  assert.ok(hudContent.includes('BOUNDS'), 'Must provide Bounds toggle');
  assert.ok(hudContent.includes('DESELECT'), 'Must provide Deselect action');
});

// 12. App.jsx Mount Verification
runTest('App.jsx mounts ComponentHUD and tracks Part 13 as completed', () => {
  const appContent = fs.readFileSync('src/App.jsx', 'utf-8');
  assert.ok(appContent.includes('import ComponentHUD from'), 'App.jsx must import ComponentHUD');
  assert.ok(appContent.includes('<ComponentHUD />'), 'App.jsx must render <ComponentHUD />');
  assert.ok(/currentPart\s*=\s*(1[3-9]|20)/.test(appContent), 'App.jsx currentPart must be >= 13');
  assert.ok(
    appContent.includes("{ id: 13, title: 'Interactive Component Raycasting', status: 'completed' }"),
    'App.jsx must mark milestone 13 as completed'
  );
});

console.log(`\n────────────────────────────────────────────────────`);
console.log(`  Results: ${passedTests} passed, ${totalTests - passedTests} failed`);
console.log(`────────────────────────────────────────────────────\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
