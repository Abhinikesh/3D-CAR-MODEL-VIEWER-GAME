import * as THREE from 'three';
import {
  GLASS_MESH_NAMES,
  ALL_CHROME_MESH_NAMES,
  CHROME_RIM_MESH_NAMES,
  TIRE_NODE_NAMES,
  RUBBER_GASKET_MESH_NAMES,
  ALL_RUBBER_MESH_NAMES,
  ALL_PLASTIC_MESH_NAMES,
  HEADLIGHT_MESH_NAMES,
  BRAKELIGHT_MESH_NAMES,
  SIGNALLIGHT_MESH_NAMES,
  ALL_EMISSIVE_MESH_NAMES,
} from './secondaryMaterialRegistry.js';
import { GLASS_PROFILES, createGlassMaterial } from './glassMaterials.js';
import { CHROME_PROFILES, createChromeMaterial, createRimInnerMaterial } from './chromeMaterials.js';
import { RUBBER_PROFILES, createTireSidewallMaterial, createTireTreadMaterial, createRubberGasketMaterial } from './rubberMaterials.js';
import { PLASTIC_PROFILES, createPlasticMaterial } from './plasticMaterials.js';
import { createHeadlightMaterial, createBrakelightMaterial, createSignallightMaterial } from './emissiveMaterials.js';

/**
 * Secondary Material Override Engine
 *
 * Manages runtime material overrides for all non-paint mesh categories:
 *   glass, chrome/metal, rubber/tires, plastic, emissive lights.
 *
 * Key design constraints:
 *   - NEVER mutates Drei/useGLTF shared materials directly
 *   - NEVER touches paint meshes (Part 9 namespace is fully separate)
 *   - Multi-material meshes (rim, tire) have mesh.material as Array — handled per-index
 *   - Zustand state is serializable only; Three.js objects live here, never in the store
 *   - Original materials cached on first initializeFromScene() call
 */
export class SecondaryMaterialEngine {
  constructor() {
    // Maps mesh.uuid -> original material (or Array of materials for multi-material meshes)
    this.originalMaterials = new Map();

    // Active application-owned materials (safe to dispose)
    this.activeCustomMaterials = new Set();

    // Mesh registries by category
    this.glassMeshes = [];
    this.chromeMeshes = [];          // mirrors + hardware (single-material)
    this.rimMeshes = [];             // multi-material rims
    this.tireMeshes = [];            // multi-material tires
    this.gasketMeshes = [];          // rubber seals
    this.plasticMeshes = [];         // interior + exterior plastics
    this.headlightMeshes = [];
    this.brakelightMeshes = [];
    this.signalMeshes = [];
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /**
   * Traverses the loaded car scene graph and populates all mesh registries.
   * Caches original materials on first call. Safe to call multiple times.
   *
   * @param {THREE.Object3D} rootObject - Car scene root
   */
  initializeFromScene(rootObject) {
    if (!rootObject) return;

    // Reset registries (not originals — they persist for restoration)
    this.glassMeshes = [];
    this.chromeMeshes = [];
    this.rimMeshes = [];
    this.tireMeshes = [];
    this.gasketMeshes = [];
    this.plasticMeshes = [];
    this.headlightMeshes = [];
    this.brakelightMeshes = [];
    this.signalMeshes = [];

    rootObject.traverse((node) => {
      if (!node.isMesh) return;
      const name = node.name;

      // Cache original on first visit
      if (!this.originalMaterials.has(node.uuid)) {
        if (Array.isArray(node.material)) {
          // Store a shallow copy of the array — element refs are still GLB originals
          this.originalMaterials.set(node.uuid, [...node.material]);
        } else {
          this.originalMaterials.set(node.uuid, node.material);
        }
      }

      // Categorize mesh
      if (GLASS_MESH_NAMES.includes(name)) {
        this.glassMeshes.push(node);
      } else if (CHROME_RIM_MESH_NAMES.includes(name)) {
        this.rimMeshes.push(node);
      } else if (TIRE_NODE_NAMES.includes(name)) {
        this.tireMeshes.push(node);
      } else if (RUBBER_GASKET_MESH_NAMES.includes(name)) {
        this.gasketMeshes.push(node);
      } else if (ALL_CHROME_MESH_NAMES.includes(name)) {
        // Mirrors + hardware (after rims are excluded above)
        this.chromeMeshes.push(node);
      } else if (ALL_PLASTIC_MESH_NAMES.includes(name)) {
        this.plasticMeshes.push(node);
      } else if (HEADLIGHT_MESH_NAMES.includes(name)) {
        this.headlightMeshes.push(node);
      } else if (BRAKELIGHT_MESH_NAMES.includes(name)) {
        this.brakelightMeshes.push(node);
      } else if (SIGNALLIGHT_MESH_NAMES.includes(name)) {
        this.signalMeshes.push(node);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Safely disposes custom materials currently assigned to a mesh.
   */
  _disposeMeshMaterialsIfCustom(mesh) {
    if (!mesh || !mesh.material) return;
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat) => {
        if (mat && this.activeCustomMaterials.has(mat)) {
          if (typeof mat.dispose === 'function') mat.dispose();
          this.activeCustomMaterials.delete(mat);
        }
      });
    } else if (this.activeCustomMaterials.has(mesh.material)) {
      if (typeof mesh.material.dispose === 'function') mesh.material.dispose();
      this.activeCustomMaterials.delete(mesh.material);
    }
  }

  /** Applies a single material to a standard (non-array) mesh. */
  _applySingle(mesh, material) {
    this._disposeMeshMaterialsIfCustom(mesh);
    mesh.material = material;
    mesh.material.needsUpdate = true;
    this.activeCustomMaterials.add(material);
  }

  /** Restores a mesh to its cached original material. */
  _restore(mesh) {
    this._disposeMeshMaterialsIfCustom(mesh);
    const original = this.originalMaterials.get(mesh.uuid);
    if (!original) return;
    mesh.material = Array.isArray(original) ? [...original] : original;
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => { if (m) m.needsUpdate = true; });
    } else {
      mesh.material.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Glass
  // ---------------------------------------------------------------------------

  applyGlass(profileId = 'factory') {
    const profile = GLASS_PROFILES[profileId] || GLASS_PROFILES.factory;
    for (const mesh of this.glassMeshes) {
      const mat = createGlassMaterial(profile);
      this._applySingle(mesh, mat);
    }
  }

  restoreGlass() {
    for (const mesh of this.glassMeshes) {
      this._restore(mesh);
    }
  }

  // ---------------------------------------------------------------------------
  // Chrome / Polished Metal
  // ---------------------------------------------------------------------------

  applyChrome(profileId = 'chrome') {
    const profile = CHROME_PROFILES[profileId] || CHROME_PROFILES.chrome;

    // Mirrors + hardware — single-material meshes
    for (const mesh of this.chromeMeshes) {
      this._applySingle(mesh, createChromeMaterial(profile));
    }

    // Rims — multi-material: index 0 = polished face (Rim2), index 1 = spoke inner (Rim1)
    for (const mesh of this.rimMeshes) {
      this._disposeMeshMaterialsIfCustom(mesh);
      const facemat = createChromeMaterial(profile);
      const innermat = createRimInnerMaterial(profile);
      this.activeCustomMaterials.add(facemat);
      this.activeCustomMaterials.add(innermat);

      if (Array.isArray(mesh.material)) {
        // Create new array — do NOT mutate the stored original
        const newMats = [...mesh.material];
        newMats[0] = facemat;
        if (newMats.length > 1) newMats[1] = innermat;
        mesh.material = newMats;
      } else {
        // Fallback: single-material rim (shouldn't happen but safe)
        mesh.material = facemat;
      }
      mesh.material.forEach?.((m) => { if (m) m.needsUpdate = true; });
    }
  }

  restoreChrome() {
    for (const mesh of [...this.chromeMeshes, ...this.rimMeshes]) {
      this._restore(mesh);
    }
  }

  // ---------------------------------------------------------------------------
  // Rubber / Tires
  // ---------------------------------------------------------------------------

  applyRubber(profileId = 'factory') {
    const profile = RUBBER_PROFILES[profileId] || RUBBER_PROFILES.factory;

    // Tires — multi-material: index 0 = sidewall (Tireside), index 1 = tread (Tiretread)
    for (const mesh of this.tireMeshes) {
      this._disposeMeshMaterialsIfCustom(mesh);
      const sidewall = createTireSidewallMaterial(profile.sidewall);
      const tread = createTireTreadMaterial(profile.tread);
      this.activeCustomMaterials.add(sidewall);
      this.activeCustomMaterials.add(tread);

      if (Array.isArray(mesh.material)) {
        const newMats = [...mesh.material];
        newMats[0] = sidewall;
        if (newMats.length > 1) newMats[1] = tread;
        mesh.material = newMats;
        mesh.material.forEach?.((m) => { if (m) m.needsUpdate = true; });
      } else {
        // Single-material fallback — apply sidewall
        mesh.material = sidewall;
        mesh.material.needsUpdate = true;
      }
    }

    // Gaskets — single-material
    for (const mesh of this.gasketMeshes) {
      this._applySingle(mesh, createRubberGasketMaterial(profile.gasket));
    }
  }

  restoreRubber() {
    for (const mesh of [...this.tireMeshes, ...this.gasketMeshes]) {
      this._restore(mesh);
    }
  }

  // ---------------------------------------------------------------------------
  // Plastics
  // ---------------------------------------------------------------------------

  applyPlastic(profileId = 'black_matte') {
    const profile = PLASTIC_PROFILES[profileId] || PLASTIC_PROFILES.black_matte;
    for (const mesh of this.plasticMeshes) {
      this._applySingle(mesh, createPlasticMaterial(profile));
    }
  }

  restorePlastic() {
    for (const mesh of this.plasticMeshes) {
      this._restore(mesh);
    }
  }

  // ---------------------------------------------------------------------------
  // Emissive lighting
  // ---------------------------------------------------------------------------

  setHeadlights(isOn) {
    const mat = createHeadlightMaterial(isOn);
    this.activeCustomMaterials.add(mat);
    for (const mesh of this.headlightMeshes) {
      mesh.material = mat;
      mesh.material.needsUpdate = true;
    }
  }

  setTaillights(isOn) {
    const mat = createBrakelightMaterial(isOn);
    this.activeCustomMaterials.add(mat);
    for (const mesh of this.brakelightMeshes) {
      mesh.material = mat;
      mesh.material.needsUpdate = true;
    }
  }

  setBrakeLights(isOn) {
    // BodyTaillights doubles as both taillight and brake light mesh
    this.setTaillights(isOn);
  }

  setIndicators(isOn) {
    const mat = createSignallightMaterial(isOn);
    this.activeCustomMaterials.add(mat);
    for (const mesh of this.signalMeshes) {
      mesh.material = mat;
      mesh.material.needsUpdate = true;
    }
  }

  restoreEmissive() {
    for (const mesh of [
      ...this.headlightMeshes,
      ...this.brakelightMeshes,
      ...this.signalMeshes,
    ]) {
      this._restore(mesh);
    }
  }

  // ---------------------------------------------------------------------------
  // Bulk restore
  // ---------------------------------------------------------------------------

  /**
   * Restores all secondary-managed meshes to their original GLB materials.
   */
  restoreAllSecondary() {
    const allMeshes = [
      ...this.glassMeshes,
      ...this.chromeMeshes,
      ...this.rimMeshes,
      ...this.tireMeshes,
      ...this.gasketMeshes,
      ...this.plasticMeshes,
      ...this.headlightMeshes,
      ...this.brakelightMeshes,
      ...this.signalMeshes,
    ];
    for (const mesh of allMeshes) {
      this._restore(mesh);
    }
    this.disposeCustomMaterials();
  }

  // ---------------------------------------------------------------------------
  // Disposal
  // ---------------------------------------------------------------------------

  /**
   * Disposes all application-owned materials.
   * Does NOT touch GLB-originating materials.
   */
  disposeCustomMaterials() {
    for (const mat of this.activeCustomMaterials) {
      if (mat && typeof mat.dispose === 'function') mat.dispose();
    }
    this.activeCustomMaterials.clear();
  }

  /**
   * Full cleanup — called when car model unmounts.
   */
  dispose() {
    this.restoreAllSecondary();
    this.originalMaterials.clear();
    this.glassMeshes = [];
    this.chromeMeshes = [];
    this.rimMeshes = [];
    this.tireMeshes = [];
    this.gasketMeshes = [];
    this.plasticMeshes = [];
    this.headlightMeshes = [];
    this.brakelightMeshes = [];
    this.signalMeshes = [];
  }
}
