import * as THREE from 'three';

/**
 * Emissive lighting material presets.
 * Controls headlights, brake/taillights, and indicator signals.
 *
 * Dashboard (mat[8]) is excluded — relies on embedded textures and is read-only.
 * This module provides material factories for the three controllable emissive meshes:
 *   - BodyHeadlights (mat[14] "Headlight")
 *   - BodyTaillights (mat[13] "Brakelight")
 *   - BodyTurnsignalsRear (mat[12] "Signallight")
 */

export const HEADLIGHT_PRESETS = {
  off: {
    id: 'off',
    emissive: '#000000',
    emissiveIntensity: 0,
    color: '#8AB8FF',   // Bluish-white lens colour when off
    metalness: 0.0,
    roughness: 0.08,
  },
  on: {
    id: 'on',
    emissive: '#8AB8FF',   // Blue-white high-intensity LED
    emissiveIntensity: 10,
    color: '#8AB8FF',
    metalness: 0.0,
    roughness: 0.04,
  },
};

export const BRAKELIGHT_PRESETS = {
  off: {
    id: 'off',
    emissive: '#000000',
    emissiveIntensity: 0,
    color: '#FF2000',   // Red lens — visible but not lit
    metalness: 0.0,
    roughness: 0.1,
  },
  on: {
    id: 'on',
    emissive: '#FF2000',   // Red brake/taillight
    emissiveIntensity: 2,
    color: '#FF2000',
    metalness: 0.0,
    roughness: 0.06,
  },
};

export const SIGNALLIGHT_PRESETS = {
  off: {
    id: 'off',
    emissive: '#000000',
    emissiveIntensity: 0,
    color: '#FF8800',   // Amber lens when off
    metalness: 0.0,
    roughness: 0.1,
  },
  on: {
    id: 'on',
    emissive: '#FF8800',   // Amber indicator
    emissiveIntensity: 2,
    color: '#FF8800',
    metalness: 0.0,
    roughness: 0.06,
  },
};

/**
 * Creates a headlight material.
 * @param {boolean} isOn - Whether headlights are illuminated
 * @returns {THREE.MeshStandardMaterial}
 */
export function createHeadlightMaterial(isOn = false) {
  const preset = isOn ? HEADLIGHT_PRESETS.on : HEADLIGHT_PRESETS.off;
  return new THREE.MeshStandardMaterial({
    name: `Headlight_${isOn ? 'on' : 'off'}`,
    color: new THREE.Color(preset.color),
    emissive: new THREE.Color(preset.emissive),
    emissiveIntensity: preset.emissiveIntensity,
    metalness: preset.metalness,
    roughness: preset.roughness,
    transparent: false,
  });
}

/**
 * Creates a brake/taillight material.
 * @param {boolean} isOn - Whether brake lights are illuminated
 * @returns {THREE.MeshStandardMaterial}
 */
export function createBrakelightMaterial(isOn = false) {
  const preset = isOn ? BRAKELIGHT_PRESETS.on : BRAKELIGHT_PRESETS.off;
  return new THREE.MeshStandardMaterial({
    name: `Brakelight_${isOn ? 'on' : 'off'}`,
    color: new THREE.Color(preset.color),
    emissive: new THREE.Color(preset.emissive),
    emissiveIntensity: preset.emissiveIntensity,
    metalness: preset.metalness,
    roughness: preset.roughness,
    transparent: false,
  });
}

/**
 * Creates a turn signal / indicator material.
 * @param {boolean} isOn - Whether indicators are illuminated
 * @returns {THREE.MeshStandardMaterial}
 */
export function createSignallightMaterial(isOn = false) {
  const preset = isOn ? SIGNALLIGHT_PRESETS.on : SIGNALLIGHT_PRESETS.off;
  return new THREE.MeshStandardMaterial({
    name: `Signallight_${isOn ? 'on' : 'off'}`,
    color: new THREE.Color(preset.color),
    emissive: new THREE.Color(preset.emissive),
    emissiveIntensity: preset.emissiveIntensity,
    metalness: preset.metalness,
    roughness: preset.roughness,
    transparent: false,
  });
}
