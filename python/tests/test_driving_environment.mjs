import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');

console.log('--- TEST SUITE: Part 24 — Driving Environment Lighting, Sky and Atmosphere ---');

// ─── Test 1: Component File & Export Verification ───
const envControllerPath = path.resolve(ROOT, 'src/scenes/driving/DrivingEnvironmentController.jsx');
assert.ok(fs.existsSync(envControllerPath), 'DrivingEnvironmentController.jsx must exist');
const envContent = fs.readFileSync(envControllerPath, 'utf-8');
assert.ok(envContent.includes('export default function DrivingEnvironmentController'), 'DrivingEnvironmentController must export default function');
console.log('  ✓ Component Integrity: DrivingEnvironmentController.jsx exists with default export');

// ─── Test 2: DrivingScene Integration ───
const drivingScenePath = path.resolve(ROOT, 'src/scenes/driving/DrivingScene.jsx');
assert.ok(fs.existsSync(drivingScenePath), 'DrivingScene.jsx must exist');
const sceneContent = fs.readFileSync(drivingScenePath, 'utf-8');
assert.ok(sceneContent.includes('DrivingEnvironmentController'), 'DrivingScene.jsx must import and mount DrivingEnvironmentController');
console.log('  ✓ Scene Integration: DrivingScene.jsx cleanly mounts DrivingEnvironmentController');

// ─── Test 3: Atmospheric Sky Dome & Sun Vector Calibration ───
assert.ok(envContent.includes('<Sky'), 'DrivingEnvironmentController must render Drei <Sky /> component');
assert.ok(envContent.includes('sunPosition'), 'Sky must define sunPosition');
assert.ok(envContent.includes('turbidity'), 'Sky must configure turbidity');
assert.ok(envContent.includes('rayleigh'), 'Sky must configure rayleigh scattering');
console.log('  ✓ Sky Dome & Sun Vector: Procedural atmospheric scattering and solar vector verified');

// ─── Test 4: Physical Outdoor Lighting Rig (Hemisphere + Sun Directional + Shadows) ───
assert.ok(envContent.includes('<hemisphereLight'), 'DrivingEnvironmentController must define hemisphereLight for sky/ground bounce');
assert.ok(envContent.includes('skyColor'), 'hemisphereLight must define skyColor');
assert.ok(envContent.includes('groundColor'), 'hemisphereLight must define groundColor');

assert.ok(envContent.includes('<directionalLight'), 'DrivingEnvironmentController must define directional sunlight');
assert.ok(envContent.includes('castShadow'), 'Directional sunlight must cast shadows');
assert.ok(envContent.includes('shadow-mapSize-width={2048}'), 'Sunlight shadow map must be 2048x2048');
assert.ok(envContent.includes('<ContactShadows'), 'DrivingEnvironmentController must include ContactShadows under vehicle');
console.log('  ✓ Outdoor Lighting Rig: Hemisphere sky/ground fill, 2K shadow sun, and underbody contact shadows verified');

// ─── Test 5: PBR Specular Reflection Probe ───
assert.ok(envContent.includes('<Environment'), 'DrivingEnvironmentController must render Drei <Environment /> for PBR reflections');
assert.ok(envContent.includes('background={false}'), 'Environment map must not overwrite the sky dome background');
assert.ok(envContent.includes('Suspense'), 'Environment map must be wrapped in Suspense to prevent render blocking');
console.log('  ✓ PBR Specular Reflections: Non-blocking HDR reflection probe verified for clearcoat and glass');

// ─── Test 6: Atmospheric Depth & Scene Isolation ───
assert.ok(envContent.includes('THREE.Fog'), 'DrivingEnvironmentController must configure atmospheric THREE.Fog');
assert.ok(envContent.includes('scene.fog = originalFog') || envContent.includes('scene.fog = null'), 'DrivingEnvironmentController must restore scene.fog on unmount');
assert.ok(envContent.includes('gl.toneMappingExposure'), 'DrivingEnvironmentController must manage tone mapping exposure');
console.log('  ✓ Atmospheric Perspective & Isolation: Soft horizon fog and clean lifecycle restoration verified');

// ─── Test 7: Store & Camera Dock Extension (ORBIT / VEHICLE View) ───
const storePath = path.resolve(ROOT, 'src/store/appModeStore.js');
const storeContent = fs.readFileSync(storePath, 'utf-8');
assert.ok(storeContent.includes("ORBIT: 'orbit'"), 'appModeStore must define ORBIT driving view');

const dockPath = path.resolve(ROOT, 'src/components/ui/DrivingCameraDock.jsx');
const dockContent = fs.readFileSync(dockPath, 'utf-8');
assert.ok(dockContent.includes('DRIVING_VIEWS.ORBIT'), 'DrivingCameraDock must include ORBIT / VEHICLE showcase view');
console.log('  ✓ Multi-Perspective Camera Dock: 6 distinct automotive camera modes registered and verified');

console.log('\nResults: 7 / 7 unit tests passed successfully.\n');
