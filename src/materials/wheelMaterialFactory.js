import * as THREE from 'three';
import { RIM_FINISH_PRESETS, CALIPER_PRESETS } from './wheelPresets.js';

export const RIM_MESH_MAP = {
  fl: 'Mesh_Rim_FL',
  fr: 'Mesh_Rim_FR',
  rl: 'Mesh_Rim_RL',
  rr: 'Mesh_Rim_RR',
};

export const CALIPER_MESH_MAP = {
  fl: 'Mesh_Caliper_FL',
  fr: 'Mesh_Caliper_FR',
  rl: 'Mesh_Caliper_RL',
  rr: 'Mesh_Caliper_RR',
};

export const ALL_RIM_MESH_NAMES = Object.values(RIM_MESH_MAP);
export const ALL_CALIPER_MESH_NAMES = Object.values(CALIPER_MESH_MAP);

// Explicit read-only protected components
export const PROTECTED_DISC_MESH_NAMES = [
  'WheelFrontLBrakeDisc',
  'WheelFrontRBrakeDisc',
  'WheelRearLBrakeDisc',
  'WheelRearRBrakeDisc',
];

export const PROTECTED_TIRE_NODE_NAMES = [
  'node_84',
  'node_89',
  'node_94',
  'node_99',
];

/**
 * Creates physically based MeshPhysicalMaterial for the polished outer rim face (Primitive 0).
 */
export function createRimFaceMaterial(options = {}) {
  const presetKey = options.preset || 'silver_metallic';
  const preset = RIM_FINISH_PRESETS[presetKey] || RIM_FINISH_PRESETS.silver_metallic;
  const colorVal = options.customColor || preset.color;

  const mat = new THREE.MeshPhysicalMaterial({
    name: `RimFace_${preset.id}_${new THREE.Color(colorVal).getHexString()}`,
    color: new THREE.Color(colorVal),
    metalness: options.metalness ?? preset.metalness,
    roughness: options.roughness ?? preset.roughness,
    clearcoat: options.clearcoat ?? preset.clearcoat,
    clearcoatRoughness: options.clearcoatRoughness ?? preset.clearcoatRoughness,
    reflectivity: options.reflectivity ?? preset.reflectivity,
    envMapIntensity: options.envMapIntensity ?? preset.envMapIntensity,
    transparent: false,
    depthWrite: true,
  });

  mat.needsUpdate = true;
  return mat;
}

/**
 * Creates physically coordinated material for the inner rim spokes/barrel cavity (Primitive 1).
 */
export function createRimInnerSpokeMaterial(options = {}) {
  const presetKey = options.preset || 'silver_metallic';
  const preset = RIM_FINISH_PRESETS[presetKey] || RIM_FINISH_PRESETS.silver_metallic;

  // For custom color, calculate a slightly darker satin barrel tone
  let innerColorVal;
  if (options.customColor) {
    const hsl = {};
    new THREE.Color(options.customColor).getHSL(hsl);
    innerColorVal = new THREE.Color().setHSL(hsl.h, hsl.s * 0.7, Math.max(0.05, hsl.l * 0.45));
  } else {
    innerColorVal = new THREE.Color(preset.innerColor);
  }

  const mat = new THREE.MeshStandardMaterial({
    name: `RimInner_${preset.id}`,
    color: innerColorVal,
    metalness: Math.max(0.2, (options.metalness ?? preset.metalness) * 0.8),
    roughness: Math.min(0.8, (options.roughness ?? preset.roughness) * 1.5 + 0.1),
    envMapIntensity: 0.8,
  });

  mat.needsUpdate = true;
  return mat;
}

/**
 * Creates physically based MeshPhysicalMaterial for the brake calipers.
 */
export function createBrakeCaliperMaterial(options = {}) {
  const presetKey = options.preset || 'factory';
  const preset = CALIPER_PRESETS[presetKey] || CALIPER_PRESETS.factory;
  const colorVal = options.customColor || preset.color;

  const mat = new THREE.MeshPhysicalMaterial({
    name: `Caliper_${preset.id}_${new THREE.Color(colorVal).getHexString()}`,
    color: new THREE.Color(colorVal),
    metalness: preset.metalness,
    roughness: preset.roughness,
    clearcoat: preset.clearcoat,
    clearcoatRoughness: 0.15,
    reflectivity: 0.7,
    envMapIntensity: 1.0,
    transparent: false,
    depthWrite: true,
  });

  mat.needsUpdate = true;
  return mat;
}
