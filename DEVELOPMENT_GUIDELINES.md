# Development & Engineering Guidelines

This document outlines the engineering standards, code conventions, 3D graphics practices, and architectural rules governing the **3D Car Model and Viewer** project.

---

## 1. Core Engineering Principles

1. **Academic Rigor & Theoretical Clarity:**
   - Every 3D transform, shader uniform, projection calculation, or scene graph manipulation should reflect clear Computer Graphics theory.
   - Code must avoid magical unexplained values; annotate spatial coordinates and angles with physical units (meters, radians, degrees).

2. **Zero Placeholder Policy:**
   - Never render fake buttons, dummy icons with empty handlers (`onClick={() => {}}`), or mock data that pretends to implement a feature.
   - If a feature is scheduled for a future part, do not display a non-functional UI element for it. Keep the interface honest and strictly functional.

3. **Non-Destructive & Stable Incremental Development:**
   - Each part builds upon the previous part.
   - Never break previously working features when introducing new functionality.
   - Maintain a runnable state after every development stage.

---

## 2. Three.js & WebGL Memory Lifecycle

WebGL runs directly against GPU memory buffers (VBOs, IBOs, texture memory). Unlike standard JavaScript objects, **GPU resources are not automatically garbage-collected by the JavaScript runtime**.

### Resource Disposal Rules

1. **Always Dispose When Unmounting:**
   When a 3D component unmounts or replaces an asset/texture, explicitly call `.dispose()` on:
   - Geometries: `geometry.dispose()`
   - Materials: `material.dispose()`
   - Textures: `texture.dispose()`
   - Render Targets: `renderTarget.dispose()`

2. **Recursive Traversal Disposal Helper:**
   All 3D components unloading models must utilize the project's standard traversal cleanup:
   ```javascript
   export function disposeObject3D(object) {
     if (!object) return;
     object.traverse((child) => {
       if (child.isMesh) {
         if (child.geometry) {
           child.geometry.dispose();
         }
         if (child.material) {
           if (Array.isArray(child.material)) {
             child.material.forEach((mat) => disposeMaterial(mat));
           } else {
             disposeMaterial(child.material);
           }
         }
       }
     });
   }

   function disposeMaterial(mat) {
     Object.keys(mat).forEach((prop) => {
       if (mat[prop] && typeof mat[prop].dispose === 'function') {
         mat[prop].dispose();
       }
     });
     mat.dispose();
   }
   ```

3. **Avoid Dynamic Allocation in the Render Loop (`useFrame`):**
   - **Never** instantiate objects (`new THREE.Vector3()`, `new THREE.Matrix4()`, `new THREE.Color()`) inside `useFrame` or tick loops.
   - Pre-allocate reusable scratchpad vectors and quaternions outside the frame callback to avoid triggering Garbage Collection (GC) pauses that cause frame rate stutter:
   ```javascript
   // Recommended Pattern:
   const _targetVector = new THREE.Vector3();
   const _tempQuaternion = new THREE.Quaternion();

   useFrame((state, delta) => {
     // Mutate existing pre-allocated scratch objects
     _targetVector.set(x, y, z);
     camera.position.lerp(_targetVector, delta * 3);
   });
   ```

---

## 3. Component Decomposition & Modular Boundaries

To maintain clean code and prevent monolithic single-file components, observe the following architectural boundaries:

1. **Maximum File Size Guideline:**
   - Keep files focused and under 250 lines of code. If a component grows beyond this, extract sub-assemblies or utilities.

2. **Single Responsibility per Component:**
   - `ShowroomCanvas.jsx`: Canvas initialization, WebGL context attributes, Suspense/Loader boundary, fallback error display.
   - `StudioScene.jsx`: World environment, HDRI, directional studio lights, ground shadow plane.
   - `CarModel.jsx`: GLTF model loading, scene graph traversal, binding of dynamic materials and pivot refs.
   - `CarDoors.jsx`: Kinematic rotation logic for door pivots.
   - `CarWheels.jsx`: Wheel spin kinematics, rim and caliper material bindings.
   - `CameraRig.jsx`: Camera position transitions, target look-at interpolation, OrbitControls.
   - `ConfiguratorPanel.jsx`: DOM UI for paint colors, material finish switches, rim styles.
   - `useCarStore.js`: Zustand store isolating UI state from 3D canvas rendering.

3. **Strict Decoupling of DOM UI from WebGL Canvas:**
   - HTML controls and HUD overlays must reside outside the `<Canvas>` tree.
   - Communication between DOM controls and 3D objects occurs through reactive store subscriptions (`useCarStore.getState()` or selectors) to avoid re-mounting the Three.js canvas.

---

## 4. 3D Asset Rigging & Naming Standards

For all vehicle components to animate and customize reliably, adhere to the standardized node contract:

| Target Component | Semantic Hierarchy Pattern | Behavior |
| :--- | :--- | :--- |
| **Front Left Door** | `Pivot_Door_FL` $\rightarrow$ `Mesh_Door_FL` | Hinge rotation on local vertical axis ($\approx Y$) |
| **Front Right Door** | `Pivot_Door_FR` $\rightarrow$ `Mesh_Door_FR` | Hinge rotation on local vertical axis ($\approx Y$) |
| **Rear Left Door** | `Pivot_Door_RL` $\rightarrow$ `Mesh_Door_RL` | Hinge rotation on local vertical axis |
| **Rear Right Door** | `Pivot_Door_RR` $\rightarrow$ `Mesh_Door_RR` | Hinge rotation on local vertical axis |
| **Hood / Bonnet** | `Pivot_Bonnet` $\rightarrow$ `Mesh_Bonnet` | Tilts upward along horizontal hinge axis ($\approx X$) |
| **Trunk / Boot** | `Pivot_Boot` $\rightarrow$ `Mesh_Boot` | Tilts upward along rear horizontal axis |
| **Wheels (FL/FR/RL/RR)**| `Wheel_Assembly_*` $\rightarrow$ `Spin_Pivot_*` | Continuous rotation around axle during driving animation |
| **Front Wheels Only** | `Wheel_Assembly_F*` $\rightarrow$ `Steer_Pivot_F*` | Yaw rotation around vertical axis ($\pm 30^\circ$) |
| **Car Body Paint** | Material slot named `Material_Body_Paint` | Bound to `MeshPhysicalMaterial` for real-time color updates |
| **Rims / Wheels** | Material slot named `Material_Rim` | Configurable chrome, gloss black, satin silver |
| **Brake Calipers** | Material slot named `Material_Caliper` | Configurable accent color (red, yellow, blue, etc.) |
| **Window Glass** | Material slot named `Material_Glass` | Physical transmission material with transparency |
| **Headlights** | Mesh named `Mesh_Headlight_*` | Emissive material + spot light cone |
| **Taillights** | Mesh named `Mesh_Taillight_*` | Emissive red material |

---

## 5. Python & Blender Asset Pipeline Standards

1. **Python Script Portability:**
   - Python code must execute under standard Python 3.10+.
   - Do not require Blender installation for basic inspection; use `pygltflib` or `trimesh` for standalone model audit scripts.
   - For scripts requiring Blender's Python API (`bpy`), verify that Blender can run headlessly via CLI flags (`blender --background --python script.py`).

2. **Automated Asset Checks:**
   - Verify that the asset scale is normalized to real-world metric dimensions (e.g., car length $\approx 4.0 - 5.0$ meters).
   - Ensure the car's bottom tire contact points rest exactly at ground level ($Y = 0.00$).
   - Verify that model vertex normals are consistent and smooth.
   - Audit polygon counts to prevent browser performance bottlenecks ($< 250,000$ triangles).

---

## 6. Code Style & Formatting

- **JavaScript / JSX:**
  - Modern ES6+ syntax (arrow functions, destructuring, async/await).
  - Explicit prop validation or TypeScript-style JSDoc annotations where appropriate.
  - Descriptive naming: `handleDoorToggle`, `activeCameraPreset`, `isAutoRotating`.
- **CSS:**
  - Dark automotive showroom aesthetic: `#0B0C10`, `#1F2833`, `#C5C6C7`, `#66FCF1`, `#45A29E`.
  - Clean flexbox/grid layouts, no hardcoded magic z-indexes, accessible contrast ratios.
- **Error Handling:**
  - Wrap model loading in `<Suspense>` with informative fallback loading indicators (percentage loaded).
  - Include an Error Boundary around the 3D Canvas to catch WebGL context losses or GLTF parsing failures gracefully.
