/**
 * Secondary Material Registry
 * Maps actual GLB mesh names to their source materials and secondary material categories.
 * Ground truth established from direct binary GLB inspection.
 */

// === GLASS MESHES ===
// Source material: "Glass" (mat[1]) - transmission, metallic=0, roughness=0, doubleSided
export const GLASS_MESH_NAMES = [
  'BodyWindshield',       // Front windshield — large glass surface
  'BodyWindowsRearSides', // Rear quarter fixed windows
  'BodyRearwindow',       // Rear hatch window
  'BodyDoorRWindow',      // Front-Right door window
  'BodyDoorLWindow',      // Front-Left door window
];

// === CHROME / POLISHED METAL MESHES ===
// Source material: "Mirror" (mat[15]) — metallic=1, roughness=0, emissive mirror map
// These are side mirror reflective surfaces (rearview glass simulators)
export const CHROME_MIRROR_MESH_NAMES = [
  'BodyDoorRMirror',   // Right side mirror reflective face
  'BodyDoorLMirror',   // Left side mirror reflective face
];

// Source material: "Hardware" (mat[5]) — metallic=1, roughness=0.5 — interior polished metal
export const CHROME_HARDWARE_MESH_NAMES = [
  'InteriorPedalAccelArm',   // Accelerator pedal arm
  'InteriorPedalBrakeArm',   // Brake pedal arm
  'InteriorSteeringEmblem',  // Steering wheel centre badge
  'InteriorSteeringHandleL', // Steering column handle (left)
  'InteriorSteeringHandleR', // Steering column handle (right)
  'InteriorDoorR06',         // Door inner chrome trim pull
  'InteriorDoorL06',         // Door inner chrome trim pull
];

// Source material: "Rim2" (mat[20]) — metallic=1, roughness=0.049 — polished outer rim face
export const CHROME_RIM_MESH_NAMES = [
  'Mesh_Rim_FL', // Front-Left rim polished face
  'Mesh_Rim_FR', // Front-Right rim polished face
  'Mesh_Rim_RL', // Rear-Left rim polished face
  'Mesh_Rim_RR', // Rear-Right rim polished face
];

export const ALL_CHROME_MESH_NAMES = [
  ...CHROME_MIRROR_MESH_NAMES,
  ...CHROME_HARDWARE_MESH_NAMES,
  ...CHROME_RIM_MESH_NAMES,
];

// === RUBBER / TIRE MESHES ===
// Tires: node_84, node_89, node_94, node_99 — multi-primitive (Tireside + Tiretread materials)
// Three.js exposes them as mesh nodes with multiple materials (array).
// We identify by node name from the registry.
export const TIRE_NODE_NAMES = [
  'node_84', // Front-Left tire
  'node_89', // Front-Right tire
  'node_94', // Rear-Left tire
  'node_99', // Rear-Right tire
];

// Rubber gaskets/seals — Source material: "mat_2" (unnamed) — metallic=0, roughness=0.8
export const RUBBER_GASKET_MESH_NAMES = [
  'BodyWindshieldGasket',
  'BodyDoorRWindowGasket',
  'BodyDoorLWindowGasket',
];

export const ALL_RUBBER_MESH_NAMES = [
  ...TIRE_NODE_NAMES,
  ...RUBBER_GASKET_MESH_NAMES,
];

// === PLASTIC MESHES ===
// Exterior black plastic "mat_2" (unnamed) — includes windshield surround, wipers, body panels
export const EXTERIOR_PLASTIC_MESH_NAMES = [
  'BodyWindshieldWipers',
  'BodyWindshieldWipersBase',
];

// Interior dark plastic "mat_2" covers many structural interior parts
export const INTERIOR_PLASTIC_MESH_NAMES = [
  'InteriorCage',
  'InteriorFloor',
  'InteriorPillar',
  'InteriorSeatsFrame1',
  'InteriorSeatsFrame2',
  'InteriorSteeringBase',
  'InteriorSteeringCylinder',
  'InteriorSteeringWheel04',
  'InteriorSteeringDashColumn',
  'InteriorRearHatch',
  'BodyHoodInterior01',
  'BodyHoodInterior02',
  'BodyHoodUnder',
  'BodyDoorRHandle01',
  'BodyDoorLHandle01',
  'BodyTaillightsPanels', // Taillight housing panels
];

// Panel Sides material (mat[28]) — dark matte body side cladding
export const CLADDING_MESH_NAMES = [
  'InteriorMid', // Uses "Panel Sides" material — mid interior cladding panels
];

export const ALL_PLASTIC_MESH_NAMES = [
  ...EXTERIOR_PLASTIC_MESH_NAMES,
  ...INTERIOR_PLASTIC_MESH_NAMES,
  ...CLADDING_MESH_NAMES,
];

// === EMISSIVE LIGHT MESHES ===
// Headlight — Source material: "Headlight" (mat[14]) — emissive strength=10, blue-white
export const HEADLIGHT_MESH_NAMES = [
  'BodyHeadlights',
];

// Taillight / Brakelight — Source material: "Brakelight" (mat[13]) — emissive strength=2, red
export const BRAKELIGHT_MESH_NAMES = [
  'BodyTaillights',
];

// Signal (indicator) — Source material: "Signallight" (mat[12]) — emissive strength=2, amber
export const SIGNALLIGHT_MESH_NAMES = [
  'BodyTurnsignalsRear',
];

// Dashboard instruments — Source material: "Dashboard" (mat[8]) — emissive texture/strength=3
// Note: We do NOT override dashboard emissive as it uses textures that cannot be trivially cloned.
// It is treated as read-only, non-controllable in this part.

export const ALL_EMISSIVE_MESH_NAMES = [
  ...HEADLIGHT_MESH_NAMES,
  ...BRAKELIGHT_MESH_NAMES,
  ...SIGNALLIGHT_MESH_NAMES,
];

// === CARBON FIBER STATUS ===
// No dedicated carbon fiber material or mesh exists in this GLB.
// The closest candidates are interior structural panels ("mat_2") but they carry no UV
// pattern that simulates carbon weave. A carbon fiber material preset is defined in
// carbonMaterials.js and can be optionally applied to interior cladding panels (InteriorMid).
// It is explicitly NOT applied by default to avoid changing structural mesh appearance.
export const CARBON_SUPPORTED_TARGETS = [
  'InteriorMid', // Optional — uses Panel Sides mat, could carry carbon cladding
];
export const CARBON_AVAILABLE = false; // No factory carbon meshes exist in GLB

// === MECHANICAL / BRAKE MESHES (read-only, not overridden) ===
// These are managed by their own GLB materials and are not affected by secondary overrides.
// Listed for documentation / no-touch reference.
export const READ_ONLY_MESH_NAMES = [
  'BodyUnderside', 'Engine', 'Axles',
  'WheelFrontLBrakePad', 'WheelFrontRBrakePad', 'WheelRearLBrakePad', 'WheelRearRBrakePad',
  'WheelFrontLBrakeDisc', 'WheelFrontRBrakeDisc', 'WheelRearLBrakeDisc', 'WheelRearRBrakeDisc',
  'Mesh_Caliper_FL', 'Mesh_Caliper_FR', 'Mesh_Caliper_RL', 'Mesh_Caliper_RR',
  'InteriorSteeringDash', 'License Plate',
];
