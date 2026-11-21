import * as THREE from 'three';

/**
 * Automotive chrome and polished metal material presets.
 * Covers mirror faces, interior hardware, and polished wheel rims.
 * Uses MeshPhysicalMaterial for high-quality reflections and clearcoat.
 */
export const CHROME_PROFILES = {
  chrome: {
    id: 'chrome',
    name: 'High-Polish Chrome',
    description: 'Mirror-finish chrome plating — maximum reflectivity',
    metalness: 1.0,
    roughness: 0.0,
    reflectivity: 1.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.5,
    color: '#FFFFFF',
  },
  brushed: {
    id: 'brushed',
    name: 'Brushed Aluminium',
    description: 'Directionally brushed satin-finish aluminium',
    metalness: 0.9,
    roughness: 0.25,
    reflectivity: 0.8,
    clearcoat: 0.1,
    clearcoatRoughness: 0.3,
    envMapIntensity: 1.0,
    color: '#D8DCDF',
  },
  dark_metal: {
    id: 'dark_metal',
    name: 'Dark Gunmetal',
    description: 'Darkened metal — satin gunmetal finish for stealth trim',
    metalness: 0.8,
    roughness: 0.4,
    reflectivity: 0.6,
    clearcoat: 0.05,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.8,
    color: '#3A3D42',
  },
};

/**
 * Creates a chrome / polished metal material.
 * Suitable for mirror faces, interior hardware, and polished rim faces.
 *
 * @param {Object} profile - Chrome profile from CHROME_PROFILES
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function createChromeMaterial(profile = CHROME_PROFILES.chrome) {
  return new THREE.MeshPhysicalMaterial({
    name: `Chrome_${profile.id}`,
    color: new THREE.Color(profile.color),
    metalness: profile.metalness,
    roughness: profile.roughness,
    reflectivity: profile.reflectivity,
    clearcoat: profile.clearcoat,
    clearcoatRoughness: profile.clearcoatRoughness,
    envMapIntensity: profile.envMapIntensity,
    // No transmission — chrome is opaque
    transparent: false,
    depthWrite: true,
  });
}

/**
 * Creates the matte spoke / inner rim material (Rim1 equivalent).
 * Applied to multi-material rim meshes at index 1.
 *
 * @param {Object} profile - Chrome profile used for base identity
 * @returns {THREE.MeshStandardMaterial}
 */
export function createRimInnerMaterial(profile = CHROME_PROFILES.chrome) {
  // Inner spokes: same identity but softer — matches GLB Rim1 (metallic=0, rough=0.4)
  return new THREE.MeshStandardMaterial({
    name: `RimInner_${profile.id}`,
    color: new THREE.Color(profile.id === 'dark_metal' ? '#1E2126' : '#8A8E95'),
    metalness: profile.id === 'chrome' ? 0.0 : 0.3,
    roughness: profile.id === 'chrome' ? 0.4 : 0.6,
    envMapIntensity: 0.6,
  });
}
