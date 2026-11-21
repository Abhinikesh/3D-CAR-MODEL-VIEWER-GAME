import * as THREE from 'three';

/**
 * Carbon fiber material presets.
 *
 * CARBON_AVAILABLE = false:
 *   No dedicated carbon fiber mesh or material exists in the Khronos Car Concept GLB.
 *   This module defines the procedural approximation preset for optional future application
 *   to interior cladding (InteriorMid — mat[28] "Panel Sides").
 *   It is NOT applied to any mesh by default.
 */
export const CARBON_AVAILABLE = false;

export const CARBON_PROFILES = {
  twill_weave: {
    id: 'twill_weave',
    name: '2×2 Twill Carbon Weave',
    description: 'Procedural approximation of 2×2 twill-weave carbon fiber — no UV texture',
    color: '#1A1A1E',
    metalness: 0.4,
    roughness: 0.3,
    reflectivity: 0.5,
    envMapIntensity: 0.7,
  },
  gloss_carbon: {
    id: 'gloss_carbon',
    name: 'Gloss Carbon Fiber',
    description: 'High-gloss lacquered carbon fiber panel',
    color: '#12121A',
    metalness: 0.5,
    roughness: 0.12,
    reflectivity: 0.8,
    envMapIntensity: 1.0,
  },
  matte_carbon: {
    id: 'matte_carbon',
    name: 'Matte Carbon Fiber',
    description: 'Dry-weave matte carbon — motorsport appearance',
    color: '#1E1E22',
    metalness: 0.3,
    roughness: 0.65,
    reflectivity: 0.3,
    envMapIntensity: 0.5,
  },
};

/**
 * Creates a procedural carbon fiber approximation material.
 * NOTE: Since no UV mapping is validated for carbon texture, this is a plain dark
 * anisotropic-approximate material. For proper woven texture, UV-mapped texture
 * maps would be required.
 *
 * @param {Object} profile - Carbon profile from CARBON_PROFILES
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function createCarbonMaterial(profile = CARBON_PROFILES.twill_weave) {
  return new THREE.MeshPhysicalMaterial({
    name: `Carbon_${profile.id}`,
    color: new THREE.Color(profile.color),
    metalness: profile.metalness,
    roughness: profile.roughness,
    reflectivity: profile.reflectivity ?? 0.5,
    envMapIntensity: profile.envMapIntensity,
    // Slight sheen to approximate cross-weave highlight
    sheen: 0.15,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#2A2A30'),
  });
}
