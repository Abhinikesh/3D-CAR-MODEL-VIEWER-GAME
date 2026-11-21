import * as THREE from 'three';

/**
 * Interior and exterior plastic material presets.
 * Covers body structural plastics (mat_2 family) and interior cladding (Panel Sides).
 */
export const PLASTIC_PROFILES = {
  black_matte: {
    id: 'black_matte',
    name: 'Black Matte Plastic',
    description: 'Standard OEM matte black unpainted plastic trim',
    color: '#0A0A0C',
    metalness: 0.0,
    roughness: 0.85,
  },
  dark_soft: {
    id: 'dark_soft',
    name: 'Dark Soft-Touch',
    description: 'Soft-touch interior panel material — darker with slight sheen',
    color: '#141418',
    metalness: 0.0,
    roughness: 0.70,
  },
  panel_cladding: {
    id: 'panel_cladding',
    name: 'Body Cladding',
    description: 'Exterior cladding and underbody panels',
    color: '#080810',
    metalness: 0.0,
    roughness: 0.75,
  },
  gloss_black: {
    id: 'gloss_black',
    name: 'Gloss Black Trim',
    description: 'High-gloss piano-black interior and exterior trim',
    color: '#050508',
    metalness: 0.0,
    roughness: 0.08,
  },
};

/**
 * Creates an automotive plastic material for body/interior panels.
 *
 * @param {Object} profile - Plastic profile from PLASTIC_PROFILES
 * @returns {THREE.MeshStandardMaterial}
 */
export function createPlasticMaterial(profile = PLASTIC_PROFILES.black_matte) {
  return new THREE.MeshStandardMaterial({
    name: `Plastic_${profile.id}`,
    color: new THREE.Color(profile.color),
    metalness: profile.metalness,
    roughness: profile.roughness,
    // No transmission, no clearcoat needed for standard plastics
  });
}
