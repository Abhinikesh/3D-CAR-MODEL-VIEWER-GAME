import * as THREE from 'three';

/**
 * Canonical Semantic Component Registry
 * Maps high-level automotive concepts to actual Three.js scene graph node names.
 * The vehicle is a two-door sports coupe (Khronos Car Concept).
 */
export const SEMANTIC_COMPONENTS = {
  // Vehicle Structure & Main Chassis
  CHASSIS: {
    id: 'chassis',
    name: 'Chassis & Structure',
    category: 'Body',
    pivotNode: 'BodyUnderside',
    nodes: [
      'BodyUnderside',
      'BodyRoofPanel',
      'BodyPillars',
      'BodyPanelsColor2',
      'BodyWindshieldGasket',
      'BodyWindshieldWipers',
      'BodyWindshieldWipersBase',
      'License Plate',
    ],
  },

  // Doors (2-Door Coupe)
  DOOR_FL: {
    id: 'door_fl',
    name: 'Front-Left Door',
    category: 'Closures',
    pivotNode: 'Pivot_Door_FL',
    isHinged: true,
    hingeAxis: [0, 1, 0], // World Y rotation
    maxAngle: (65 * Math.PI) / 180,
    nodes: [
      'Pivot_Door_FL',
      'InteriorDoorL04',
      'InteriorDoorL01',
      'InteriorDoorL02',
      'InteriorDoorL03',
      'InteriorDoorL05',
      'InteriorDoorL06',
      'BodyDoorLColor2',
      'BodyDoorLHandle01',
      'BodyDoorLHandle02',
      'BodyDoorLMirror',
      'BodyDoorLMirrorColor1',
      'BodyDoorLWindowGasket',
      'Glass_Door_FL',
      'BodyDoorLMirrorColor2',
    ],
  },
  DOOR_FR: {
    id: 'door_fr',
    name: 'Front-Right Door',
    category: 'Closures',
    pivotNode: 'Pivot_Door_FR',
    isHinged: true,
    hingeAxis: [0, 1, 0],
    maxAngle: (-65 * Math.PI) / 180,
    nodes: [
      'Pivot_Door_FR',
      'BodyDoorRColor2',
      'BodyDoorRHandle01',
      'BodyDoorRHandle02',
      'BodyDoorRMirror',
      'BodyDoorRMirrorColor1',
      'BodyDoorRMirrorColor2',
      'Glass_Door_FR',
      'BodyDoorRWindowGasket',
      'InteriorDoorR01',
      'InteriorDoorR02',
      'InteriorDoorR03',
      'InteriorDoorR04',
      'InteriorDoorR05',
      'InteriorDoorR06',
    ],
  },

  // Bonnet / Hood
  BONNET: {
    id: 'bonnet',
    name: 'Bonnet / Hood',
    category: 'Closures',
    pivotNode: 'Pivot_Bonnet',
    isHinged: true,
    hingeAxis: [1, 0, 0], // World X rotation
    maxAngle: (-45 * Math.PI) / 180,
    nodes: [
      'Pivot_Bonnet',
      'BodyHoodInterior01',
      'BodyHoodInterior02',
      'BodyHoodTopgrill',
      'BodyHoodUnder',
      'Mesh_Headlight_Assemblies',
    ],
  },

  // Boot / Trunk Hatch
  BOOT: {
    id: 'boot',
    name: 'Boot / Rear Hatch',
    category: 'Closures',
    pivotNode: 'Pivot_Boot',
    isHinged: true,
    hingeAxis: [1, 0, 0],
    maxAngle: (50 * Math.PI) / 180,
    nodes: [
      'Pivot_Boot',
      'InteriorRearHatch',
      'InteriorRearPanels',
      'BodyWindowsRearSides',
      'BodyTurnsignalsRear',
      'BodyTaillightsPanels',
      'Mesh_Taillight_Assemblies',
      'Glass_RearWindow',
    ],
  },

  // 4 Wheel Assemblies
  WHEEL_FL: {
    id: 'wheel_fl',
    name: 'Front-Left Wheel',
    category: 'Wheels',
    pivotNode: 'Wheel_Assembly_FL',
    steerable: true,
    nodes: [
      'Wheel_Assembly_FL',
      'Mesh_Rim_FL',
      'Mesh_Caliper_FL',
      'WheelFrontLBrakeDisc',
      'node_84',
    ],
  },
  WHEEL_FR: {
    id: 'wheel_fr',
    name: 'Front-Right Wheel',
    category: 'Wheels',
    pivotNode: 'Wheel_Assembly_FR',
    steerable: true,
    nodes: [
      'Wheel_Assembly_FR',
      'Mesh_Rim_FR',
      'Mesh_Caliper_FR',
      'WheelFrontRBrakeDisc',
      'node_89',
    ],
  },
  WHEEL_RL: {
    id: 'wheel_rl',
    name: 'Rear-Left Wheel',
    category: 'Wheels',
    pivotNode: 'Wheel_Assembly_RL',
    steerable: false,
    nodes: [
      'Wheel_Assembly_RL',
      'WheelRearLBrakeDisc',
      'Mesh_Caliper_RL',
      'Mesh_Rim_RL',
      'node_94',
    ],
  },
  WHEEL_RR: {
    id: 'wheel_rr',
    name: 'Rear-Right Wheel',
    category: 'Wheels',
    pivotNode: 'Wheel_Assembly_RR',
    steerable: false,
    nodes: [
      'Wheel_Assembly_RR',
      'WheelRearRBrakeDisc',
      'Mesh_Caliper_RR',
      'Mesh_Rim_RR',
      'node_99',
    ],
  },

  // Glass & Glazing
  GLASS: {
    id: 'glass',
    name: 'Automotive Glass',
    category: 'Glazing',
    nodes: [
      'Glass_Windshield',
      'Glass_Door_FL',
      'Glass_Door_FR',
      'Glass_RearWindow',
      'BodyWindowsRearSides',
    ],
  },

  // Rearview Mirrors
  MIRRORS: {
    id: 'mirrors',
    name: 'Side Mirrors',
    category: 'Exterior',
    nodes: [
      'BodyDoorLMirror',
      'BodyDoorLMirrorColor1',
      'BodyDoorLMirrorColor2',
      'BodyDoorRMirror',
      'BodyDoorRMirrorColor1',
      'BodyDoorRMirrorColor2',
    ],
  },

  // Headlights
  HEADLIGHTS: {
    id: 'headlights',
    name: 'Headlight Assemblies',
    category: 'Lighting',
    nodes: ['Mesh_Headlight_Assemblies'],
  },

  // Taillights
  TAILLIGHTS: {
    id: 'taillights',
    name: 'Taillight Assemblies',
    category: 'Lighting',
    nodes: [
      'Mesh_Taillight_Assemblies',
      'BodyTurnsignalsRear',
      'BodyTaillightsPanels',
    ],
  },

  // Rims & Calipers
  RIMS: {
    id: 'rims',
    name: 'Wheel Rims',
    category: 'Wheels',
    nodes: ['Mesh_Rim_FL', 'Mesh_Rim_FR', 'Mesh_Rim_RL', 'Mesh_Rim_RR'],
  },
  BRAKES: {
    id: 'brakes',
    name: 'Brake Calipers & Discs',
    category: 'Wheels',
    nodes: [
      'Mesh_Caliper_FL',
      'Mesh_Caliper_FR',
      'Mesh_Caliper_RL',
      'Mesh_Caliper_RR',
      'WheelFrontLBrakeDisc',
      'WheelFrontRBrakeDisc',
      'WheelRearLBrakeDisc',
      'WheelRearRBrakeDisc',
    ],
  },

  // Interior Cockpit
  INTERIOR: {
    id: 'interior',
    name: 'Cockpit & Interior',
    category: 'Interior',
    nodes: [
      'InteriorCage',
      'InteriorDashMid',
      'InteriorDashSides',
      'InteriorFloor',
      'InteriorFloormats',
      'InteriorMid',
      'InteriorPedalAccel',
      'InteriorPedalAccelArm',
      'InteriorPedalBrake',
      'InteriorPedalBrakeArm',
      'InteriorPillar',
      'InteriorSeatsColor1',
      'InteriorSeatsColor2',
      'InteriorSeatsFrame1',
      'InteriorSeatsFrame2',
      'InteriorSteeringBase',
      'InteriorSteeringCylinder',
      'InteriorSteeringEmblem',
      'InteriorSteeringWheel01',
      'InteriorSteeringWheel02',
      'InteriorSteeringWheel03',
      'InteriorSteeringWheel04',
      'InteriorSteeringDash',
      'InteriorSteeringDashColumn',
      'InteriorSteeringHandleL',
      'InteriorSteeringHandleR',
    ],
  },

  // Powertrain & Axles
  POWERTRAIN: {
    id: 'powertrain',
    name: 'Engine & Axles',
    category: 'Mechanical',
    nodes: ['Engine', 'Axles'],
  },
};

/**
 * Traverse the Three.js scene graph once and construct an indexed, high-performance
 * scene graph data structure with fast lookup maps.
 */
export function indexCarScene(rootObject) {
  if (!rootObject) return null;

  const nodeMap = new Map();
  const meshes = [];
  const materialsMap = new Map();
  const texturesSet = new Set();

  let vertexCount = 0;
  let triangleCount = 0;
  let primitiveCount = 0;

  // Single traversal pass
  rootObject.traverse((node) => {
    // 1. Index node by name for O(1) lookup
    if (node.name) {
      nodeMap.set(node.name, node);
    }

    // 2. Mesh processing
    if (node.isMesh) {
      meshes.push(node);
      node.castShadow = true;
      node.receiveShadow = true;

      const geo = node.geometry;
      if (geo) {
        primitiveCount++;
        if (geo.attributes?.position) {
          vertexCount += geo.attributes.position.count;
        }
        if (geo.index) {
          triangleCount += geo.index.count / 3;
        } else if (geo.attributes?.position) {
          triangleCount += geo.attributes.position.count / 3;
        }
      }

      // Collect materials and textures
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((mat) => {
        if (mat) {
          mat.needsUpdate = true;
          if (mat.name) {
            materialsMap.set(mat.name, mat);
          } else {
            materialsMap.set(`mat_${materialsMap.size}`, mat);
          }

          // Enumerate active texture maps
          const mapProps = [
            'map',
            'normalMap',
            'roughnessMap',
            'metalnessMap',
            'clearcoatMap',
            'clearcoatRoughnessMap',
            'transmissionMap',
            'emissiveMap',
          ];
          mapProps.forEach((prop) => {
            if (mat[prop] && mat[prop].isTexture) {
              texturesSet.add(mat[prop]);
            }
          });
        }
      });
    }
  });

  // 3. Compute accurate vertex-accurate world-space bounding dimensions
  // Using actual vertex positions transformed by node world matrices avoids the AABB inflation
  // artifact where rotating local bounding boxes expands the bounds box downwards to -0.159m
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  rootObject.traverse((node) => {
    if (node.isMesh && node.geometry?.attributes?.position) {
      node.updateWorldMatrix(true, false);
      const pos = node.geometry.attributes.position;
      const mat = node.matrixWorld.elements;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const wx = mat[0] * x + mat[4] * y + mat[8] * z + mat[12];
        const wy = mat[1] * x + mat[5] * y + mat[9] * z + mat[13];
        const wz = mat[2] * x + mat[6] * y + mat[10] * z + mat[14];

        if (wx < minX) minX = wx;
        if (wy < minY) minY = wy;
        if (wz < minZ) minZ = wz;
        if (wx > maxX) maxX = wx;
        if (wy > maxY) maxY = wy;
        if (wz > maxZ) maxZ = wz;
      }
    }
  });

  // Clamp near-zero floor contact (-0.001 to +0.001) to exact 0.000m
  if (Math.abs(minY) < 0.002) minY = 0.0;

  const size = new THREE.Vector3(maxX - minX, maxY - minY, maxZ - minZ);
  const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  const box = new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ));

  // 4. Resolve semantic components against the indexed scene graph
  const resolvedComponents = {};
  const unresolvedComponents = [];

  for (const [key, comp] of Object.entries(SEMANTIC_COMPONENTS)) {
    const compMeshes = [];
    const compNodes = [];

    // Resolve pivot node
    const pivot = comp.pivotNode ? nodeMap.get(comp.pivotNode) || null : null;

    // Resolve component nodes
    comp.nodes.forEach((nodeName) => {
      const foundNode = nodeMap.get(nodeName);
      if (foundNode) {
        compNodes.push(foundNode);
        if (foundNode.isMesh) {
          compMeshes.push(foundNode);
        }
        // Also collect child meshes if node is a parent group
        foundNode.traverse((ch) => {
          if (ch.isMesh && !compMeshes.includes(ch)) {
            compMeshes.push(ch);
          }
        });
      }
    });

    const isResolved = compNodes.length > 0;
    if (isResolved) {
      resolvedComponents[comp.id] = {
        ...comp,
        pivot,
        nodes: compNodes,
        meshes: compMeshes,
        resolved: true,
      };
    } else {
      unresolvedComponents.push(comp.id);
    }
  }

  return {
    root: rootObject,
    nodeMap,
    meshes,
    materialsMap,
    texturesSet,
    metrics: {
      nodeCount: nodeMap.size,
      meshCount: meshes.length,
      primitiveCount,
      uniqueMaterialsCount: materialsMap.size,
      uniqueTexturesCount: texturesSet.size,
      vertexCount,
      triangleCount: Math.round(triangleCount),
      dimensions: {
        x: Number(size.x.toFixed(3)),
        y: Number(size.y.toFixed(3)),
        z: Number(size.z.toFixed(3)),
        length: Number(size.z.toFixed(2)),
        width: Number(size.x.toFixed(2)),
        height: Number(size.y.toFixed(2)),
      },
      bounds: {
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z },
        center: { x: center.x, y: center.y, z: center.z },
      },
      radius: Number((Math.sqrt(size.x ** 2 + size.y ** 2 + size.z ** 2) / 2).toFixed(3)),
    },
    semanticRegistry: {
      components: resolvedComponents,
      unresolved: unresolvedComponents,
      totalCount: Object.keys(SEMANTIC_COMPONENTS).length,
      resolvedCount: Object.keys(resolvedComponents).length,
    },
  };
}

/**
 * Fast O(1) lookup of any node by name.
 */
export function findNodeByName(graphData, name) {
  if (!graphData || !graphData.nodeMap) return null;
  return graphData.nodeMap.get(name) || null;
}

/**
 * Fast lookup of a semantic component by its semantic identifier.
 */
export function getComponentBySemanticId(graphData, semanticId) {
  if (!graphData || !graphData.semanticRegistry) return null;
  return graphData.semanticRegistry.components[semanticId] || null;
}

/**
 * Collect all meshes associated with a semantic component.
 */
export function getMeshesForComponent(graphData, semanticId) {
  const comp = getComponentBySemanticId(graphData, semanticId);
  return comp ? comp.meshes : [];
}

/**
 * Compute the bounding box of a specific semantic component.
 */
export function getComponentBoundingBox(graphData, semanticId) {
  const comp = getComponentBySemanticId(graphData, semanticId);
  if (!comp || comp.meshes.length === 0) return null;

  const box = new THREE.Box3();
  comp.meshes.forEach((mesh) => box.expandByObject(mesh));
  return box;
}
