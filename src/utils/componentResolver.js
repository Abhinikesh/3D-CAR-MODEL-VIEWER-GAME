import * as THREE from 'three';
import { SEMANTIC_COMPONENTS } from './carAssetRegistry.js';
import { usePaintStore } from '../store/paintStore.js';
import { PAINT_COLOR_PRESETS } from '../materials/paintPresets.js';
import { useWheelStore } from '../store/wheelStore.js';
import { RIM_FINISH_PRESETS, CALIPER_PRESETS } from '../materials/wheelPresets.js';
import { useSecondaryMaterialStore } from '../store/secondaryMaterialStore.js';
import { GLASS_PROFILES } from '../materials/glassMaterials.js';

/**
 * Priority order for resolving ambiguous meshes that exist in both a parent/functional
 * group and a specific physical assembly.
 * Specific articulated sub-assemblies (wheels, doors, bonnet, boot) take precedence.
 */
export const COMPONENT_RESOLUTION_PRIORITY = [
  'wheel_fl',
  'wheel_fr',
  'wheel_rl',
  'wheel_rr',
  'headlights',
  'taillights',
  'door_fl',
  'door_fr',
  'bonnet',
  'boot',
  'glass',
  'mirrors',
  'interior',
  'powertrain',
  'chassis',
  'rims',
  'brakes',
];

/**
 * Build precomputed reverse lookup mapping every glTF node name to its canonical component ID.
 */
function buildMeshToComponentMap() {
  const map = new Map();

  for (const compId of COMPONENT_RESOLUTION_PRIORITY) {
    const compKey = Object.keys(SEMANTIC_COMPONENTS).find(
      (k) => SEMANTIC_COMPONENTS[k].id === compId
    );
    if (!compKey) continue;
    const comp = SEMANTIC_COMPONENTS[compKey];
    for (const nodeName of comp.nodes) {
      if (!map.has(nodeName)) {
        map.set(nodeName, comp.id);
      }
    }
  }

  return map;
}

export const MESH_TO_COMPONENT_MAP = buildMeshToComponentMap();

/**
 * Extended Technical Descriptions for all 17 Semantic Components
 */
export const COMPONENT_TECHNICAL_DATA = {
  chassis: {
    title: 'CHASSIS & SPACEFRAME',
    subtitle: 'Monocoque Body Structure',
    description: 'High-rigidity aluminum spaceframe and composite passenger safety cell with integrated energy-absorbing front and rear crash structures.',
    materialDomain: 'chassis',
  },
  door_fl: {
    title: 'FRONT-LEFT DOOR',
    subtitle: 'Driver Articulated Closure',
    description: 'Lightweight composite door assembly with frameless glazing, power mirror housing, precision latching mechanism, and side-impact beam.',
    materialDomain: 'exterior',
  },
  door_fr: {
    title: 'FRONT-RIGHT DOOR',
    subtitle: 'Passenger Articulated Closure',
    description: 'Lightweight composite door assembly with frameless glazing, passenger power mirror housing, and side-impact beam.',
    materialDomain: 'exterior',
  },
  bonnet: {
    title: 'FRONT BONNET / HOOD',
    subtitle: 'Forward Aerodynamic Clamshell',
    description: 'Forward-opening lightweight carbon-composite front bonnet providing access to front suspension, cooling pack, and steering assembly.',
    materialDomain: 'exterior',
  },
  boot: {
    title: 'BOOT / REAR HATCH',
    subtitle: 'Aerodynamic Liftback Tailgate',
    description: 'Rear aerodynamic liftback hatch with integrated heated safety glass, dynamic high-mount stop lamp, and aerodynamic spoiler.',
    materialDomain: 'exterior',
  },
  wheel_fl: {
    title: 'FRONT-LEFT WHEEL ASSEMBLY',
    subtitle: 'Steerable Drive Corner',
    description: 'Forged lightweight alloy rim with high-performance ventilated cross-drilled rotor, monobloc caliper, and low-profile performance tire.',
    materialDomain: 'wheel',
  },
  wheel_fr: {
    title: 'FRONT-RIGHT WHEEL ASSEMBLY',
    subtitle: 'Steerable Drive Corner',
    description: 'Forged lightweight alloy rim with high-performance ventilated cross-drilled rotor, monobloc caliper, and low-profile performance tire.',
    materialDomain: 'wheel',
  },
  wheel_rl: {
    title: 'REAR-LEFT WHEEL ASSEMBLY',
    subtitle: 'Fixed Axle Corner',
    description: 'Staggered forged alloy rim with integrated emergency brake caliper, ventilated disc, and high-traction performance tire.',
    materialDomain: 'wheel',
  },
  wheel_rr: {
    title: 'REAR-RIGHT WHEEL ASSEMBLY',
    subtitle: 'Fixed Axle Corner',
    description: 'Staggered forged alloy rim with integrated emergency brake caliper, ventilated disc, and high-traction performance tire.',
    materialDomain: 'wheel',
  },
  glass: {
    title: 'AUTOMOTIVE GLAZING',
    subtitle: 'Laminated Acoustic Windshield',
    description: 'High-transmission laminated automotive safety glass with solar attenuation, acoustic interlayer, and integrated antenna elements.',
    materialDomain: 'glass',
  },
  mirrors: {
    title: 'AERO SIDE MIRRORS',
    subtitle: 'Dual Aerodynamic Pods',
    description: 'Sculpted low-drag aerodynamic mirror housings with integrated LED indicator repeaters and electrochromic anti-glare glass.',
    materialDomain: 'exterior',
  },
  headlights: {
    title: 'HEADLIGHT ASSEMBLIES',
    subtitle: 'Adaptive Dual-Projector LED',
    description: 'High-luminance matrix LED headlight modules with dynamic daytime running light signatures and high-performance optical reflectors.',
    materialDomain: 'lighting',
  },
  taillights: {
    title: 'TAILLIGHT ASSEMBLIES',
    subtitle: 'Dynamic 3D OLED Array',
    description: 'Full-width three-dimensional OLED taillight assemblies with sequential turn indicators and high-visibility brake light illumination.',
    materialDomain: 'lighting',
  },
  rims: {
    title: 'ALLOY WHEEL RIMS',
    subtitle: 'OEM 5-Spoke Wheelset',
    description: 'Staggered lightweight directional 5-spoke forged aluminum alloy wheel rims with diamond-cut face accents and durable clearcoat.',
    materialDomain: 'wheel',
  },
  brakes: {
    title: 'BRAKING SYSTEM',
    subtitle: 'Ventilated Rotors & Calipers',
    description: 'High-performance automotive braking package with multi-piston monobloc calipers, floating rotors, and semi-metallic friction pads.',
    materialDomain: 'wheel',
  },
  interior: {
    title: 'COCKPIT & INTERIOR',
    subtitle: 'Driver-Centric Ergonomics',
    description: 'Ergonomic cockpit layout featuring bolstered sport bucket seats, multifunction flat-bottom steering wheel, digital telemetry cluster, and alloy pedals.',
    materialDomain: 'interior',
  },
  powertrain: {
    title: 'POWERTRAIN & AXLES',
    subtitle: 'Drivetrain Sub-Assembly',
    description: 'Transverse high-output electric drive unit with integrated reduction differential, constant-velocity half-shafts, and suspension crossmembers.',
    materialDomain: 'mechanical',
  },
};

/**
 * Resolve a hit mesh name to its canonical semantic component ID.
 */
export function resolveComponentByMeshName(meshName) {
  if (!meshName) return null;
  return MESH_TO_COMPONENT_MAP.get(meshName) || null;
}

/**
 * Query active material status description for a component across active stores.
 */
export function getComponentMaterialStatus(componentId) {
  try {
    const techData = COMPONENT_TECHNICAL_DATA[componentId];
    const domain = techData?.materialDomain || 'exterior';

    if (domain === 'exterior') {
      const paintState = usePaintStore.getState();
      const preset = PAINT_COLOR_PRESETS.find((p) => p.id === paintState.activePresetId);
      const finish = paintState.activeFinish || 'metallic';
      return `Paint: ${preset ? preset.name : 'Custom'} (${finish.toUpperCase()})`;
    }

    if (domain === 'wheel') {
      const wheelState = useWheelStore.getState();
      const rimFinish = RIM_FINISH_PRESETS[wheelState.rimFinish];
      const caliperPreset = CALIPER_PRESETS[wheelState.caliperPreset];
      return `Rim: ${rimFinish ? rimFinish.name : 'Custom'} | Caliper: ${caliperPreset ? caliperPreset.name : 'Factory'}`;
    }

    if (domain === 'glass') {
      const secState = useSecondaryMaterialStore.getState();
      const glass = GLASS_PROFILES[secState.glassProfile];
      return `Glass: ${glass ? glass.name : 'Factory'} (Trans: ${(glass?.transmission ?? 0.92) * 100}%)`;
    }

    if (domain === 'lighting') {
      const secState = useSecondaryMaterialStore.getState();
      const isHeadlightsOn = secState.headlightsOn;
      return `LED Illumination: ${isHeadlightsOn ? 'ACTIVE (10x)' : 'STANDBY'}`;
    }

    return 'OEM Factory Spec';
  } catch {
    return 'OEM Factory Spec';
  }
}

/**
 * Extract comprehensive, serializable technical metadata for a selected component.
 */
export function getComponentTechnicalDetails(componentId, sceneGraphData) {
  const compDef = Object.values(SEMANTIC_COMPONENTS).find((c) => c.id === componentId);
  if (!compDef) return null;

  const tech = COMPONENT_TECHNICAL_DATA[componentId] || {
    title: compDef.name.toUpperCase(),
    subtitle: compDef.category,
    description: 'Automotive vehicle sub-assembly.',
  };

  let triangleCount = 0;
  let vertexCount = 0;
  let meshCount = 0;
  const meshNames = [];
  const bounds = {
    min: [0, 0, 0],
    max: [0, 0, 0],
    center: [0, 0.75, 0],
  };
  const dimensions = { length: 0, width: 0, height: 0, volume: 0 };

  // Calculate actual bounds and geometric stats if sceneGraphData is available
  if (sceneGraphData && sceneGraphData.nodeMap) {
    const box = new THREE.Box3();
    let hasObjects = false;

    compDef.nodes.forEach((nodeName) => {
      const node = sceneGraphData.nodeMap.get(nodeName);
      if (node) {
        node.traverse((child) => {
          if (child.isMesh && child.geometry) {
            meshCount++;
            if (!meshNames.includes(child.name)) {
              meshNames.push(child.name);
            }

            const geo = child.geometry;
            if (geo.attributes?.position) {
              vertexCount += geo.attributes.position.count;
            }
            if (geo.index) {
              triangleCount += geo.index.count / 3;
            } else if (geo.attributes?.position) {
              triangleCount += (geo.attributes.position.count || 0) / 3;
            }

            box.expandByObject(child);
            hasObjects = true;
          }
        });
      }
    });

    if (hasObjects && !box.isEmpty()) {
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      bounds.min = [Number(box.min.x.toFixed(3)), Number(box.min.y.toFixed(3)), Number(box.min.z.toFixed(3))];
      bounds.max = [Number(box.max.x.toFixed(3)), Number(box.max.y.toFixed(3)), Number(box.max.z.toFixed(3))];
      bounds.center = [Number(center.x.toFixed(3)), Number(center.y.toFixed(3)), Number(center.z.toFixed(3))];

      dimensions.width = Number(size.x.toFixed(3));
      dimensions.height = Number(size.y.toFixed(3));
      dimensions.length = Number(size.z.toFixed(3));
      dimensions.volume = Number((size.x * size.y * size.z).toFixed(3));
    }
  }

  const materialStatus = getComponentMaterialStatus(componentId);

  return {
    id: compDef.id,
    name: compDef.name,
    title: tech.title,
    subtitle: tech.subtitle,
    category: compDef.category,
    description: tech.description,
    isHinged: Boolean(compDef.isHinged),
    hingeAxis: compDef.hingeAxis || null,
    maxAngleDeg: compDef.maxAngle ? Math.round((compDef.maxAngle * 180) / Math.PI) : null,
    steerable: Boolean(compDef.steerable),
    pivotNode: compDef.pivotNode || null,
    meshCount,
    meshNames,
    triangleCount: Math.round(triangleCount),
    vertexCount,
    bounds,
    dimensions,
    materialStatus,
  };
}
