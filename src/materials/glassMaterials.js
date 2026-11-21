import * as THREE from 'three';

/**
 * Automotive glass material presets.
 * Based on GLB Glass material: KHR_materials_transmission, metallic=0, roughness=0.
 * Three.js MeshPhysicalMaterial supports transmission natively.
 */
export const GLASS_PROFILES = {
  factory: {
    id: 'factory',
    name: 'Factory Tinted Glass',
    description: 'Original OEM neutral-tint automotive glass with physical transmission',
    transmission: 0.92,
    roughness: 0.04,
    metalness: 0.0,
    ior: 1.52,
    thickness: 0.006,
    color: '#C8D8E8',
    opacity: 1.0,
    transparent: false,
    side: THREE.DoubleSide,
    depthWrite: true,
    attenuationColor: '#E8F4FF',
    attenuationDistance: 0.015,
  },
  dark: {
    id: 'dark',
    name: 'Privacy Dark Tint',
    description: 'Heavily tinted privacy glass',
    transmission: 0.65,
    roughness: 0.06,
    metalness: 0.0,
    ior: 1.52,
    thickness: 0.006,
    color: '#1A2030',
    opacity: 1.0,
    transparent: false,
    side: THREE.DoubleSide,
    depthWrite: true,
    attenuationColor: '#202840',
    attenuationDistance: 0.02,
  },
  clear: {
    id: 'clear',
    name: 'Clear Sport Glass',
    description: 'High-clarity racing-spec glass with minimal tint',
    transmission: 0.98,
    roughness: 0.02,
    metalness: 0.0,
    ior: 1.51,
    thickness: 0.004,
    color: '#EEF4FF',
    opacity: 1.0,
    transparent: false,
    side: THREE.DoubleSide,
    depthWrite: true,
    attenuationColor: '#F5FEFF',
    attenuationDistance: 0.008,
  },
};

/**
 * Creates a physically accurate automotive window glass material.
 * Uses MeshPhysicalMaterial with transmission for interior cabin visibility.
 */
export function createGlassMaterial(profile = GLASS_PROFILES.factory) {
  return new THREE.MeshPhysicalMaterial({
    name: `Glass_${profile.id}`,
    color: new THREE.Color(profile.color),
    transmission: profile.transmission,
    roughness: profile.roughness,
    metalness: profile.metalness,
    ior: profile.ior,
    thickness: profile.thickness,
    opacity: profile.opacity,
    transparent: profile.transparent,
    side: profile.side,
    depthWrite: profile.depthWrite,
    attenuationColor: new THREE.Color(profile.attenuationColor),
    attenuationDistance: profile.attenuationDistance,
    envMapIntensity: 0.9,
  });
}
