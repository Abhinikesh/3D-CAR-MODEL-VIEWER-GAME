import {
  RIM_MESH_MAP,
  CALIPER_MESH_MAP,
  ALL_RIM_MESH_NAMES,
  ALL_CALIPER_MESH_NAMES,
  PROTECTED_DISC_MESH_NAMES,
  PROTECTED_TIRE_NODE_NAMES,
  createRimFaceMaterial,
  createRimInnerSpokeMaterial,
  createBrakeCaliperMaterial,
} from './wheelMaterialFactory.js';

/**
 * Wheel and Rim Customization Engine
 *
 * Manages runtime material application exclusively for the vehicle's four wheel
 * assemblies (rims and brake calipers).
 *
 * Core Guarantees:
 * 1. Zero mutation of Drei/useGLTF shared asset materials or geometry.
 * 2. Original materials preserved in an immutable Map by mesh UUID.
 * 3. Strict isolation: Never modifies tire, brake disc, paint, or secondary meshes.
 * 4. Multi-material rim handling: Clones the material array without altering the original.
 * 5. Clean memory disposal: Disposes only application-owned material instances.
 */
export class WheelCustomizationEngine {
  constructor() {
    // Maps mesh.uuid -> original GLTF material or material array
    this.originalMaterials = new Map();

    // Application-owned materials tracked for safe disposal
    this.activeCustomMaterials = new Set();

    // Indexed meshes by position: { fl: Mesh, fr: Mesh, rl: Mesh, rr: Mesh }
    this.rimMeshes = {};
    this.caliperMeshes = {};
  }

  /**
   * Traverses scene and indexes rim and caliper meshes. Caches original materials.
   *
   * @param {THREE.Object3D} rootObject
   */
  initializeFromScene(rootObject) {
    if (!rootObject) return;

    this.rimMeshes = {};
    this.caliperMeshes = {};

    rootObject.traverse((node) => {
      if (!node.isMesh) return;
      const name = node.name;

      // Index Rims
      for (const [pos, rimName] of Object.entries(RIM_MESH_MAP)) {
        if (name === rimName) {
          this.rimMeshes[pos] = node;
          if (!this.originalMaterials.has(node.uuid)) {
            if (Array.isArray(node.material)) {
              this.originalMaterials.set(node.uuid, [...node.material]);
            } else {
              this.originalMaterials.set(node.uuid, node.material);
            }
          }
        }
      }

      // Index Calipers
      for (const [pos, calName] of Object.entries(CALIPER_MESH_MAP)) {
        if (name === calName) {
          this.caliperMeshes[pos] = node;
          if (!this.originalMaterials.has(node.uuid)) {
            this.originalMaterials.set(node.uuid, node.material);
          }
        }
      }
    });
  }

  /**
   * Disposes custom materials currently assigned to a mesh, preventing GPU memory leaks.
   */
  _disposeOldMeshCustomMaterials(mesh) {
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

  /**
   * Applies rim finishes according to per-wheel configuration.
   *
   * @param {Object} rimFinishes - { fl: {preset, customColor}, fr: ..., rl: ..., rr: ... }
   */
  applyRimFinishes(rimFinishes = {}) {
    for (const [pos, mesh] of Object.entries(this.rimMeshes)) {
      const config = rimFinishes[pos];
      if (!config || !mesh) continue;

      if (config.preset === 'factory') {
        this._disposeOldMeshCustomMaterials(mesh);
        this._restoreMesh(mesh);
        continue;
      }

      // Dispose previously applied custom rim materials on this mesh before allocating new ones
      this._disposeOldMeshCustomMaterials(mesh);

      const faceMat = createRimFaceMaterial({
        preset: config.preset,
        customColor: config.customColor,
      });
      const innerMat = createRimInnerSpokeMaterial({
        preset: config.preset,
        customColor: config.customColor,
      });

      this.activeCustomMaterials.add(faceMat);
      this.activeCustomMaterials.add(innerMat);

      if (Array.isArray(mesh.material)) {
        // Multi-primitive rim: slot 0 is polished face, slot 1 is inner spoke/barrel
        const newMats = [...mesh.material];
        newMats[0] = faceMat;
        if (newMats.length > 1) newMats[1] = innerMat;
        mesh.material = newMats;
        mesh.material.forEach((m) => { if (m) m.needsUpdate = true; });
      } else {
        mesh.material = faceMat;
        mesh.material.needsUpdate = true;
      }
    }
  }

  /**
   * Applies brake caliper finish to all four calipers.
   *
   * @param {string} caliperPreset
   * @param {string} customColor
   */
  applyCaliperFinish(caliperPreset = 'factory', customColor) {
    for (const [, mesh] of Object.entries(this.caliperMeshes)) {
      if (!mesh) continue;

      if (caliperPreset === 'factory') {
        this._disposeOldMeshCustomMaterials(mesh);
        this._restoreMesh(mesh);
        continue;
      }

      // Dispose previously applied custom caliper material on this mesh
      this._disposeOldMeshCustomMaterials(mesh);

      const mat = createBrakeCaliperMaterial({
        preset: caliperPreset,
        customColor,
      });

      this.activeCustomMaterials.add(mat);
      mesh.material = mat;
      mesh.material.needsUpdate = true;
    }
  }

  /**
   * Restores an individual mesh to its cached original material.
   */
  _restoreMesh(mesh) {
    this._disposeOldMeshCustomMaterials(mesh);
    const original = this.originalMaterials.get(mesh.uuid);
    if (!original) return;

    if (Array.isArray(original)) {
      mesh.material = [...original];
      mesh.material.forEach((m) => { if (m) m.needsUpdate = true; });
    } else {
      mesh.material = original;
      mesh.material.needsUpdate = true;
    }
  }

  /**
   * Restores all rims and calipers to OEM factory materials.
   */
  restoreFactoryWheels() {
    for (const mesh of Object.values(this.rimMeshes)) {
      if (mesh) this._restoreMesh(mesh);
    }
    for (const mesh of Object.values(this.caliperMeshes)) {
      if (mesh) this._restoreMesh(mesh);
    }
    this.disposeCustomMaterials();
  }

  /**
   * Safely disposes application-owned custom material instances.
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
    this.restoreFactoryWheels();
    this.originalMaterials.clear();
    this.rimMeshes = {};
    this.caliperMeshes = {};
  }
}
