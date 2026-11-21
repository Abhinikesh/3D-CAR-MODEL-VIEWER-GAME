import * as THREE from 'three';

/**
 * Rubber and tire material presets.
 * Tires are multi-primitive: sidewall (Tireside) + tread (Tiretread).
 * Rubber gaskets share the same material class as exterior plastics in the GLB (mat_2).
 */

// Tire sidewall profiles — typically smooth, slightly shinier than tread
export const TIRE_SIDEWALL_PROFILES = {
  factory: {
    id: 'factory',
    name: 'Factory Rubber Sidewall',
    description: 'Standard OEM tire sidewall — near-black matte rubber',
    color: '#0F0F11',
    metalness: 0.0,
    roughness: 0.88,
  },
  worn: {
    id: 'worn',
    name: 'Worn Sidewall',
    description: 'Aged rubber with slight grey bloom',
    color: '#1C1C20',
    metalness: 0.0,
    roughness: 0.95,
  },
  whitewall: {
    id: 'whitewall',
    name: 'Whitewall',
    description: 'Classic white-band sidewall',
    color: '#E8E8EA',
    metalness: 0.0,
    roughness: 0.9,
  },
};

// Tire tread profiles — coarser surface, deeper black
export const TIRE_TREAD_PROFILES = {
  factory: {
    id: 'factory',
    name: 'Factory Tire Tread',
    description: 'Standard OEM tread rubber — near-black rough diffuse',
    color: '#080809',
    metalness: 0.0,
    roughness: 0.95,
  },
  worn: {
    id: 'worn',
    name: 'Worn Tread',
    description: 'Degraded tread rubber with chalky surface',
    color: '#1A1A1E',
    metalness: 0.0,
    roughness: 0.98,
  },
  racing: {
    id: 'racing',
    name: 'Racing Slick',
    description: 'High-grip racing slick — slightly smoother tread surface',
    color: '#050507',
    metalness: 0.0,
    roughness: 0.85,
  },
};

// Rubber gasket profiles — window seals and weather strips
export const RUBBER_GASKET_PROFILES = {
  factory: {
    id: 'factory',
    name: 'Factory EPDM Seal',
    description: 'Standard EPDM window gasket and weather seal',
    color: '#101012',
    metalness: 0.0,
    roughness: 0.82,
  },
  aged: {
    id: 'aged',
    name: 'Aged Rubber Seal',
    description: 'Sun-degraded rubber with slight chalking',
    color: '#1E1E22',
    metalness: 0.0,
    roughness: 0.92,
  },
};

// Combined rubber profile for uniform tire application
export const RUBBER_PROFILES = {
  factory: { id: 'factory', name: 'Factory Rubber', sidewall: TIRE_SIDEWALL_PROFILES.factory, tread: TIRE_TREAD_PROFILES.factory, gasket: RUBBER_GASKET_PROFILES.factory },
  worn: { id: 'worn', name: 'Worn / Aged', sidewall: TIRE_SIDEWALL_PROFILES.worn, tread: TIRE_TREAD_PROFILES.worn, gasket: RUBBER_GASKET_PROFILES.aged },
  racing: { id: 'racing', name: 'Racing Compound', sidewall: TIRE_SIDEWALL_PROFILES.factory, tread: TIRE_TREAD_PROFILES.racing, gasket: RUBBER_GASKET_PROFILES.factory },
};

/**
 * Creates a tire sidewall material (applied to multi-material tire mesh index 0).
 */
export function createTireSidewallMaterial(profile = TIRE_SIDEWALL_PROFILES.factory) {
  return new THREE.MeshStandardMaterial({
    name: `TireSidewall_${profile.id}`,
    color: new THREE.Color(profile.color),
    metalness: profile.metalness,
    roughness: profile.roughness,
  });
}

/**
 * Creates a tire tread material (applied to multi-material tire mesh index 1).
 */
export function createTireTreadMaterial(profile = TIRE_TREAD_PROFILES.factory) {
  return new THREE.MeshStandardMaterial({
    name: `TireTread_${profile.id}`,
    color: new THREE.Color(profile.color),
    metalness: profile.metalness,
    roughness: profile.roughness,
  });
}

/**
 * Creates a rubber gasket / window seal material.
 */
export function createRubberGasketMaterial(profile = RUBBER_GASKET_PROFILES.factory) {
  return new THREE.MeshStandardMaterial({
    name: `RubberGasket_${profile.id}`,
    color: new THREE.Color(profile.color),
    metalness: profile.metalness,
    roughness: profile.roughness,
  });
}
