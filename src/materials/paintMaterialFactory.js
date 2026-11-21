import * as THREE from 'three';
import { PAINT_FINISH_TYPES } from './paintPresets.js';

/**
 * Exact mesh-to-material target mapping derived from technical GLB inspection.
 */
export const PRIMARY_PAINT_MESH_NAMES = [
  'BodyRearPanelsColor1',
  'BodyPillars',
  'BodyHood',
  'BodyDoorRColor1',
  'BodyDoorRMirrorColor1',
  'BodyDoorLColor1',
  'BodyDoorLMirrorColor1',
];

export const SECONDARY_PAINT_MESH_NAMES = [
  'BodyRoofPanel',
  'BodyPanelsColor2',
  'BodyHoodTopgrill',
  'BodyDoorRColor2',
  'BodyDoorRHandle02',
  'BodyDoorRMirrorColor2',
  'BodyDoorLColor2',
  'BodyDoorLHandle02',
  'BodyDoorLMirrorColor2',
];

export const ALL_PAINTABLE_MESH_NAMES = [
  ...PRIMARY_PAINT_MESH_NAMES,
  ...SECONDARY_PAINT_MESH_NAMES,
];

/**
 * Creates a physically based MeshPhysicalMaterial tailored for automotive paint.
 *
 * @param {Object} params
 * @param {string|number|THREE.Color} params.color - Base body paint color
 * @param {string} [params.finish='metallic'] - Finish preset id (solid, metallic, pearl, matte, satin, gloss)
 * @param {number} [params.clearcoat] - Optional clearcoat override (0.0 to 1.0)
 * @param {number} [params.roughness] - Optional roughness override (0.0 to 1.0)
 * @param {number} [params.metalness] - Optional metalness override (0.0 to 1.0)
 * @param {string} [params.name='AutomotivePaintMaterial']
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function createAutomotivePaintMaterial(params = {}) {
  const finishConfig = PAINT_FINISH_TYPES[params.finish] || PAINT_FINISH_TYPES.metallic;

  const colorVal = new THREE.Color(params.color || '#AA0000');
  const metalness = params.metalness ?? finishConfig.metalness;
  const roughness = params.roughness ?? finishConfig.roughness;
  const clearcoat = params.clearcoat ?? finishConfig.clearcoat;
  const clearcoatRoughness = params.clearcoatRoughness ?? finishConfig.clearcoatRoughness;
  const reflectivity = params.reflectivity ?? finishConfig.reflectivity;
  const ior = params.ior ?? finishConfig.ior;
  const iridescence = params.iridescence ?? finishConfig.iridescence;
  const iridescenceIOR = params.iridescenceIOR ?? finishConfig.iridescenceIOR;
  const envMapIntensity = params.envMapIntensity ?? finishConfig.envMapIntensity;

  const material = new THREE.MeshPhysicalMaterial({
    name: params.name || `Paint_${finishConfig.id}_${colorVal.getHexString()}`,
    color: colorVal,
    metalness,
    roughness,
    clearcoat,
    clearcoatRoughness,
    reflectivity,
    ior,
    iridescence,
    iridescenceIOR,
    envMapIntensity,
    // Realistic automotive flake micro-highlights
    sheen: finishConfig.id === 'metallic' || finishConfig.id === 'pearl' ? 0.35 : 0.0,
    sheenRoughness: 0.3,
    sheenColor: new THREE.Color(0xffffff),
    // Performance & quality settings
    polygonOffset: false,
    dithering: true,
  });

  material.needsUpdate = true;
  return material;
}

/**
 * Material Override Engine
 * Manages runtime material application without mutating Drei's shared cached GLTF assets.
 */
export class PaintOverrideEngine {
  constructor() {
    // Maps mesh uuid -> original immutable Three.js material
    this.originalMaterials = new Map();
    // Tracks active application-owned materials for safe disposal
    this.activeCustomMaterials = new Set();
    // Cache for currently applied meshes
    this.targetMeshes = [];
  }

  /**
   * Discovers and indexes all paintable meshes in the loaded scene graph.
   * Caches original materials on first discovery.
   *
   * @param {THREE.Object3D} rootObject
   */
  initializeFromScene(rootObject) {
    if (!rootObject) return;

    this.targetMeshes = [];

    rootObject.traverse((node) => {
      if (node.isMesh && ALL_PAINTABLE_MESH_NAMES.includes(node.name)) {
        this.targetMeshes.push(node);

        // Record original material if not already stored
        if (!this.originalMaterials.has(node.uuid)) {
          this.originalMaterials.set(node.uuid, node.material);
        }
      }
    });
  }

  /**
   * Applies automotive paint material overrides to the target meshes.
   *
   * @param {Object} options
   * @param {string} options.primaryColor - Hex color for primary panels
   * @param {string} options.secondaryColor - Hex color for roof/accents
   * @param {string} options.finish - Finish preset id
   * @param {boolean} options.isFactory - Whether to restore factory GLTF materials
   * @param {number} [options.clearcoat] - Optional clearcoat override
   * @param {number} [options.roughness] - Optional roughness override
   * @param {number} [options.metalness] - Optional metalness override
   */
  applyPaint(options = {}) {
    if (this.targetMeshes.length === 0) return;

    // If factory restore requested, re-assign original materials
    if (options.isFactory) {
      this.restoreFactoryMaterials();
      return;
    }

    // Dispose previous custom materials to prevent memory accumulation
    this.disposeCustomMaterials();

    // Create primary paint material instance
    const primaryMaterial = createAutomotivePaintMaterial({
      color: options.primaryColor || '#AA0000',
      finish: options.finish || 'metallic',
      clearcoat: options.clearcoat,
      roughness: options.roughness,
      metalness: options.metalness,
      name: `CustomPrimary_${options.finish}`,
    });
    this.activeCustomMaterials.add(primaryMaterial);

    // Create coordinated secondary paint material instance
    const secondaryMaterial = createAutomotivePaintMaterial({
      color: options.secondaryColor || '#1A1A1A',
      finish: options.finish || 'metallic',
      clearcoat: options.clearcoat,
      roughness: options.roughness,
      metalness: options.metalness,
      name: `CustomSecondary_${options.finish}`,
    });
    this.activeCustomMaterials.add(secondaryMaterial);

    // Apply materials to respective mesh groups
    for (const mesh of this.targetMeshes) {
      if (PRIMARY_PAINT_MESH_NAMES.includes(mesh.name)) {
        mesh.material = primaryMaterial;
        mesh.material.needsUpdate = true;
      } else if (SECONDARY_PAINT_MESH_NAMES.includes(mesh.name)) {
        mesh.material = secondaryMaterial;
        mesh.material.needsUpdate = true;
      }
    }
  }

  /**
   * Restores all target meshes to their original unmodified GLTF materials.
   */
  restoreFactoryMaterials() {
    for (const mesh of this.targetMeshes) {
      const original = this.originalMaterials.get(mesh.uuid);
      if (original) {
        mesh.material = original;
        mesh.material.needsUpdate = true;
      }
    }
    this.disposeCustomMaterials();
  }

  /**
   * Safely disposes custom materials created by this engine.
   * Does NOT dispose geometries or textures belonging to the shared GLTF cache.
   */
  disposeCustomMaterials() {
    for (const mat of this.activeCustomMaterials) {
      if (mat && typeof mat.dispose === 'function') {
        mat.dispose();
      }
    }
    this.activeCustomMaterials.clear();
  }

  /**
   * Complete engine disposal (called when car model unmounts).
   */
  dispose() {
    this.restoreFactoryMaterials();
    this.originalMaterials.clear();
    this.targetMeshes = [];
  }
}
