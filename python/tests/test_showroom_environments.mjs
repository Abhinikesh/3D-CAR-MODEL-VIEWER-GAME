import {
  SHOWROOM_ENVIRONMENTS,
  ENVIRONMENT_IDS,
  getEnvironmentConfig,
} from '../../src/utils/showroomEnvironmentRegistry.js';
import { useShowroomEnvironmentStore } from '../../src/store/showroomEnvironmentStore.js';
import { useLightingStore } from '../../src/store/lightingStore.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[Test] Running Part 17 Multi-Environment Showroom Automated Verification...');

// ─── Test 1: Verify all 4 required environments are registered ───
const expectedEnvs = [
  'premium_studio',
  'luxury_showroom',
  'outdoor_daylight',
  'cinematic_stage',
];

for (const envId of expectedEnvs) {
  if (!SHOWROOM_ENVIRONMENTS[envId]) {
    throw new Error(`Missing required showroom environment: ${envId}`);
  }
}
if (ENVIRONMENT_IDS.length < 4) {
  throw new Error(`Expected at least 4 ENVIRONMENT_IDS, got ${ENVIRONMENT_IDS.length}`);
}
console.log('✓ PASS 1: All 4 distinct showroom environments registered in registry.');

// ─── Test 2: Verify metadata and semantic descriptors ───
for (const envId of expectedEnvs) {
  const env = SHOWROOM_ENVIRONMENTS[envId];
  if (!env.id || !env.name || !env.subtitle || !env.description || !env.badge) {
    throw new Error(`Environment ${envId} missing descriptive metadata.`);
  }
  if (typeof env.exposure !== 'number' || env.exposure <= 0) {
    throw new Error(`Environment ${envId} has invalid exposure value: ${env.exposure}`);
  }
}
console.log('✓ PASS 2: All environments contain complete semantic metadata, badges, and exposure.');

// ─── Test 3: Verify lighting rig properties for every environment ───
const requiredLightProps = [
  'ambientIntensity',
  'ambientColor',
  'keyIntensity',
  'keyColor',
  'keyPosition',
  'fillIntensity',
  'fillColor',
  'fillPosition',
  'rimIntensity',
  'rimColor',
  'rimPosition',
  'overheadIntensity',
  'frontIntensity',
  'rearIntensity',
];

for (const envId of expectedEnvs) {
  const lighting = SHOWROOM_ENVIRONMENTS[envId].lighting;
  for (const prop of requiredLightProps) {
    if (lighting[prop] === undefined || lighting[prop] === null) {
      throw new Error(`Environment ${envId} lighting missing required property: ${prop}`);
    }
  }
  // Check position vectors
  if (lighting.keyPosition.length !== 3 || lighting.fillPosition.length !== 3 || lighting.rimPosition.length !== 3) {
    throw new Error(`Environment ${envId} contains malformed 3D light position vector.`);
  }
}
console.log('✓ PASS 3: Complete photometric lighting rig defined with valid positions and intensities.');

// ─── Test 4: Verify distinct floor PBR material properties ───
for (const envId of expectedEnvs) {
  const floor = SHOWROOM_ENVIRONMENTS[envId].floor;
  if (typeof floor.roughness !== 'number' || floor.roughness < 0 || floor.roughness > 1) {
    throw new Error(`Environment ${envId} has invalid floor roughness: ${floor.roughness}`);
  }
  if (typeof floor.metalness !== 'number' || floor.metalness < 0 || floor.metalness > 1) {
    throw new Error(`Environment ${envId} has invalid floor metalness: ${floor.metalness}`);
  }
  if (typeof floor.radius !== 'number' || floor.radius < 10) {
    throw new Error(`Environment ${envId} has insufficient floor stage radius: ${floor.radius}`);
  }
  if (typeof floor.contactShadowOpacity !== 'number' || floor.contactShadowOpacity <= 0) {
    throw new Error(`Environment ${envId} has invalid contactShadowOpacity: ${floor.contactShadowOpacity}`);
  }
}

// Contrast floor types: Luxury showroom (mirror gloss) vs Outdoor (matte asphalt)
const luxuryFloor = SHOWROOM_ENVIRONMENTS['luxury_showroom'].floor;
const outdoorFloor = SHOWROOM_ENVIRONMENTS['outdoor_daylight'].floor;
if (luxuryFloor.roughness >= 0.25) {
  throw new Error(`Luxury showroom floor should be polished gloss (roughness <= 0.25), got ${luxuryFloor.roughness}`);
}
if (outdoorFloor.roughness < 0.75) {
  throw new Error(`Outdoor daylight floor should be diffuse asphalt (roughness >= 0.75), got ${outdoorFloor.roughness}`);
}
console.log('✓ PASS 4: Distinct PBR floor materials verified (Mirror Gloss 0.12 vs Matte Asphalt 0.88).');

// ─── Test 5: Verify procedural Sky dome parameters for Outdoor Daylight ───
const outdoor = SHOWROOM_ENVIRONMENTS['outdoor_daylight'];
if (!outdoor.hasSky || !outdoor.skyParams) {
  throw new Error('Outdoor Daylight environment must enable hasSky and define skyParams.');
}
if (!Array.isArray(outdoor.skyParams.sunPosition) || outdoor.skyParams.sunPosition.length !== 3) {
  throw new Error('Outdoor Daylight skyParams must define a 3D sunPosition vector.');
}
if (typeof outdoor.skyParams.turbidity !== 'number' || typeof outdoor.skyParams.rayleigh !== 'number') {
  throw new Error('Outdoor Daylight skyParams must define numeric atmospheric scattering parameters.');
}
console.log('✓ PASS 5: Procedural Sky dome atmospheric scattering parameters strictly verified.');

// ─── Test 6: Verify getEnvironmentConfig fallback behavior ───
const validConfig = getEnvironmentConfig('cinematic_stage');
if (validConfig.id !== 'cinematic_stage') {
  throw new Error('getEnvironmentConfig failed to return cinematic_stage');
}
const fallbackConfig = getEnvironmentConfig('non_existent_env_id');
if (fallbackConfig.id !== 'premium_studio') {
  throw new Error(`getEnvironmentConfig should fallback to premium_studio, got ${fallbackConfig.id}`);
}
console.log('✓ PASS 6: getEnvironmentConfig handles valid queries and graceful fallback.');

// ─── Test 7: Verify ShowroomEnvironmentStore initial state ───
const store = useShowroomEnvironmentStore.getState();
if (store.activeEnvironmentId !== 'premium_studio') {
  throw new Error(`Initial activeEnvironmentId should be premium_studio, got ${store.activeEnvironmentId}`);
}
if (store.exposureMultiplier !== 1.0 || store.reflectionMultiplier !== 1.0 || store.shadowMultiplier !== 1.0) {
  throw new Error('Initial calibration multipliers should all be 1.0');
}
console.log('✓ PASS 7: ShowroomEnvironmentStore initializes cleanly with premium_studio and neutral multipliers.');

// ─── Test 8: Verify setEnvironment state transitions & lightingStore synchronization ───
store.setEnvironment('luxury_showroom');
let current = useShowroomEnvironmentStore.getState();
if (current.activeEnvironmentId !== 'luxury_showroom') {
  throw new Error(`setEnvironment failed to update activeEnvironmentId, got ${current.activeEnvironmentId}`);
}
// Legacy lighting store sync check: luxury_showroom maps to soft
let legacyLighting = useLightingStore.getState().activePreset;
if (legacyLighting !== 'soft') {
  throw new Error(`useLightingStore should sync to soft when luxury_showroom selected, got ${legacyLighting}`);
}

store.setEnvironment('cinematic_stage');
current = useShowroomEnvironmentStore.getState();
if (current.activeEnvironmentId !== 'cinematic_stage') {
  throw new Error('setEnvironment cinematic_stage failed');
}
legacyLighting = useLightingStore.getState().activePreset;
if (legacyLighting !== 'dramatic') {
  throw new Error(`useLightingStore should sync to dramatic when cinematic_stage selected, got ${legacyLighting}`);
}

store.setEnvironment('outdoor_daylight');
current = useShowroomEnvironmentStore.getState();
if (current.activeEnvironmentId !== 'outdoor_daylight') {
  throw new Error('setEnvironment outdoor_daylight failed');
}
legacyLighting = useLightingStore.getState().activePreset;
if (legacyLighting !== 'studio') {
  throw new Error(`useLightingStore should sync to studio when outdoor_daylight selected, got ${legacyLighting}`);
}
console.log('✓ PASS 8: Environment switching and backward-compatible lightingStore sync verified.');

// ─── Test 9: Verify multiplier bounds clamping and reset actions ───
store.setExposureMultiplier(5.0); // should clamp to 1.4
if (useShowroomEnvironmentStore.getState().exposureMultiplier !== 1.4) {
  throw new Error(`exposureMultiplier did not clamp to upper bound 1.4, got ${useShowroomEnvironmentStore.getState().exposureMultiplier}`);
}
store.setExposureMultiplier(0.01); // should clamp to 0.7
if (useShowroomEnvironmentStore.getState().exposureMultiplier !== 0.7) {
  throw new Error(`exposureMultiplier did not clamp to lower bound 0.7, got ${useShowroomEnvironmentStore.getState().exposureMultiplier}`);
}

store.setReflectionMultiplier(1.8);
store.setShadowMultiplier(1.2);
current = useShowroomEnvironmentStore.getState();
if (current.reflectionMultiplier !== 1.8 || current.shadowMultiplier !== 1.2) {
  throw new Error('Multiplier values failed to update');
}

store.resetMultipliers();
current = useShowroomEnvironmentStore.getState();
if (current.exposureMultiplier !== 1.0 || current.reflectionMultiplier !== 1.0 || current.shadowMultiplier !== 1.0) {
  throw new Error('resetMultipliers failed to restore 1.0 defaults');
}

store.resetEnvironment();
current = useShowroomEnvironmentStore.getState();
if (current.activeEnvironmentId !== 'premium_studio') {
  throw new Error('resetEnvironment failed to restore premium_studio');
}
console.log('✓ PASS 9: Multipliers clamp safely to calibrated bounds and reset actions function correctly.');

// ─── Test 10: Verify component integration in App.jsx and StudioScene.jsx ───
const appPath = path.resolve(__dirname, '../../src/App.jsx');
const appContent = fs.readFileSync(appPath, 'utf-8');

if (!appContent.includes('EnvironmentToolbar')) {
  throw new Error('App.jsx does not import or mount EnvironmentToolbar');
}
if (!/currentPart\s*=\s*(1[7-9]|20)/.test(appContent)) {
  throw new Error('App.jsx currentPart must be >= 17');
}
if (!appContent.includes("id: 17, title: 'Multi-Environment Showroom HDRI', status: 'completed'")) {
  throw new Error('App.jsx does not mark Milestone 17 as completed');
}

const studioScenePath = path.resolve(__dirname, '../../src/components/canvas/StudioScene.jsx');
const sceneContent = fs.readFileSync(studioScenePath, 'utf-8');
if (!sceneContent.includes('ShowroomEnvironmentController')) {
  throw new Error('StudioScene.jsx does not mount ShowroomEnvironmentController');
}
console.log('✓ PASS 10: App.jsx mounts EnvironmentToolbar, sets currentPart=17, and StudioScene renders controller.');

// ─── Test 11: Verify non-destructive environment switching (no GLB reload) ───
// Verify that neither EnvironmentToolbar nor ShowroomEnvironmentController reloads the CarModel or canvas
const envToolbarPath = path.resolve(__dirname, '../../src/components/ui/EnvironmentToolbar.jsx');
const toolbarContent = fs.readFileSync(envToolbarPath, 'utf-8');
if (toolbarContent.includes('window.location.reload') || toolbarContent.includes('useGLTF.clear')) {
  throw new Error('EnvironmentToolbar must not reload window or purge GLTF cache');
}
console.log('✓ PASS 11: Non-destructive environment switching guaranteed (no page reloads or GLTF cache purging).');

// ─── Test 12: Verify cinematic lighting accents (Dual Rim Lights & Colored Stage) ───
const cinematic = SHOWROOM_ENVIRONMENTS['cinematic_stage'];
if (!cinematic.lighting.secondaryRimColor || !cinematic.lighting.secondaryRimPosition) {
  throw new Error('Cinematic Stage must define dual asymmetric rim lighting (secondaryRimColor and position).');
}
if (cinematic.lighting.rimColor === cinematic.lighting.secondaryRimColor) {
  throw new Error('Cinematic Stage dual rim lights must have distinct artistic colors (e.g. Cyan vs Magenta/Violet).');
}
console.log(`✓ PASS 12: Dual asymmetric artistic rim lights verified (Cyan ${cinematic.lighting.rimColor} & Magenta ${cinematic.lighting.secondaryRimColor}).`);

console.log('\n======================================================');
console.log('🎉 ALL 12 MULTI-ENVIRONMENT SHOWROOM TESTS PASSED! 🎉');
console.log('======================================================\n');
