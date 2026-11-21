import {
  useLightingStore,
  LIGHTING_PRESETS,
} from '../../src/store/lightingStore.js';

console.log('[Test] Running Automotive Lighting Rig & HDR Presets Automated Verification...');

// 1. Verify all 3 lighting presets exist
const expectedPresets = ['studio', 'soft', 'dramatic'];
for (const id of expectedPresets) {
  if (!LIGHTING_PRESETS[id]) {
    throw new Error(`Missing lighting preset: ${id}`);
  }
}
console.log('✓ PASS: All 3 studio lighting presets (Studio, Soft Studio, Dramatic) defined.');

// 2. Verify physical lighting properties
const requiredProps = [
  'keyIntensity',
  'fillIntensity',
  'rimIntensity',
  'frontIntensity',
  'rearIntensity',
  'overheadIntensity',
  'ambientIntensity',
  'envIntensity',
  'exposure',
  'contactShadowOpacity',
];

for (const id of expectedPresets) {
  const p = LIGHTING_PRESETS[id];
  for (const prop of requiredProps) {
    if (typeof p[prop] !== 'number' || isNaN(p[prop]) || p[prop] <= 0) {
      throw new Error(`Preset ${id} has invalid property ${prop}: ${p[prop]}`);
    }
  }
}
console.log('✓ PASS: Physical intensities, exposures, and shadow parameters strictly validated.');

// 3. Contrast & lighting balance validation
const studio = LIGHTING_PRESETS['studio'];
const soft = LIGHTING_PRESETS['soft'];
const dramatic = LIGHTING_PRESETS['dramatic'];

// Contrast ratio Key/Fill
const softRatio = soft.keyIntensity / soft.fillIntensity;
const dramaticRatio = dramatic.keyIntensity / dramatic.fillIntensity;
if (dramaticRatio <= softRatio) {
  throw new Error(`Dramatic preset contrast ratio (${dramaticRatio.toFixed(2)}) must exceed Soft Studio (${softRatio.toFixed(2)})`);
}
console.log(`✓ PASS: Contrast ratio verified: Dramatic (${dramaticRatio.toFixed(2)}x) > Soft Studio (${softRatio.toFixed(2)}x)`);

// Soft Studio has higher environment/ambient diffusion
if (soft.envIntensity <= dramatic.envIntensity) {
  throw new Error('Soft Studio environment intensity must exceed Dramatic environment intensity');
}
console.log(`✓ PASS: Environment diffusion verified: Soft (${soft.envIntensity}) > Dramatic (${dramatic.envIntensity})`);

// 4. Zustand state machine tests
const store = useLightingStore.getState();

// Initial state
if (store.activePreset !== 'studio') {
  throw new Error(`Initial lighting preset should be studio, got ${store.activePreset}`);
}

// Switch to Soft Studio
store.setLightingPreset('soft');
let current = useLightingStore.getState();
if (current.activePreset !== 'soft' || current.getConfig().id !== 'soft') {
  throw new Error('setLightingPreset soft failed');
}

// Switch to Dramatic
store.setLightingPreset('dramatic');
current = useLightingStore.getState();
if (current.activePreset !== 'dramatic' || current.getConfig().id !== 'dramatic') {
  throw new Error('setLightingPreset dramatic failed');
}

// Invalid preset ignored
store.setLightingPreset('non_existent');
current = useLightingStore.getState();
if (current.activePreset !== 'dramatic') {
  throw new Error('Invalid lighting preset should have been ignored');
}

// Reset to studio
store.setLightingPreset('studio');
current = useLightingStore.getState();
if (current.activePreset !== 'studio') {
  throw new Error('Reset to studio failed');
}

console.log('✓ PASS: Zustand lighting store actions & state transitions verified.');
console.log('✓ All Part 7 Lighting & Environment tests passed!');
