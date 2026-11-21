import * as THREE from 'three';

/**
 * Automotive Test Track & Proving Ground Road Specification
 *
 * Mathematical definition of the Part 23 test-drive circuit:
 * - Total Track Length: ~1,200m (1.2 km closed handling circuit)
 * - Road Width: 10.0m (dual 4.6m lanes + 0.5m shoulders)
 * - Vehicle Spawn: [0, 0, 0], heading along +Z axis on the main launch straight
 * - Surface Elevation: Y = 0.002m (tangent to terrain, zero z-fighting)
 * - Markings Elevation: Y = 0.008m (polygon offset compliant)
 * - Barriers Offset: 1.4m from road edge (6.4m from centerline, clear of drivable surface)
 */

export const ROAD_WIDTH = 10.0;
export const HALF_ROAD_WIDTH = ROAD_WIDTH / 2; // 5.0m
export const LANE_WIDTH = 4.6;
export const SHOULDER_WIDTH = 0.5;
export const BARRIER_OFFSET = 1.4; // Offset from road edge
export const BARRIER_DIST_FROM_CENTER = HALF_ROAD_WIDTH + BARRIER_OFFSET; // 6.4m
export const BARRIER_HEIGHT = 0.85;
export const ROAD_SURFACE_ELEVATION = 0.002;
export const MARKING_ELEVATION = 0.008;
export const KERB_WIDTH = 0.9;
export const KERB_HEIGHT = 0.06;
export const ROAD_THICKNESS = 0.08; // 8cm structural asphalt substrate depth

export const SPAWN_POSITION = new THREE.Vector3(0, 0, 0);
export const SPAWN_HEADING = new THREE.Vector3(0, 0, 1);
export const SPAWN_T = 0.05;

/**
 * Consolidated Road Dimensions Specification
 */
export const ROAD_DIMENSIONS = {
  roadWidth: ROAD_WIDTH,
  halfRoadWidth: HALF_ROAD_WIDTH,
  laneWidth: LANE_WIDTH,
  shoulderWidth: SHOULDER_WIDTH,
  thickness: ROAD_THICKNESS,
  elevation: ROAD_SURFACE_ELEVATION,
  markingElevation: MARKING_ELEVATION,
  kerbWidth: KERB_WIDTH,
  kerbHeight: KERB_HEIGHT,
  spawnPosition: SPAWN_POSITION,
  spawnHeading: SPAWN_HEADING,
};

/**
 * 22 Key Control Points defining the proving ground circuit
 * Collinear linear points around Z in [-60, 140] guarantee exact straight runway alignment.
 */
export const ROAD_CONTROL_POINTS = [
  new THREE.Vector3(0, 0, -60),
  new THREE.Vector3(0, 0, -30),
  new THREE.Vector3(0, 0, 0),      // Spawn point (t ≈ 0.05, tangent = [0, 0, 1])
  new THREE.Vector3(0, 0, 40),
  new THREE.Vector3(0, 0, 90),
  new THREE.Vector3(0, 0, 140),    // End of main launch straight
  new THREE.Vector3(25, 0, 195),   // Turn 1 entry
  new THREE.Vector3(75, 0, 240),   // Turn 1 apex (North Sweeper)
  new THREE.Vector3(135, 0, 245),  // Turn 1 exit
  new THREE.Vector3(190, 0, 200),  // Turn 2 entry
  new THREE.Vector3(200, 0, 140),  // Turn 2 apex (East Sweeper)
  new THREE.Vector3(175, 0, 80),   // Chicane reversal
  new THREE.Vector3(190, 0, 15),   // Turn 3 entry
  new THREE.Vector3(180, 0, -55),  // South sweeper entry
  new THREE.Vector3(140, 0, -120), // South sweeper
  new THREE.Vector3(75, 0, -165),  // Hairpin entry
  new THREE.Vector3(10, 0, -175),  // Hairpin apex (South Hairpin)
  new THREE.Vector3(-55, 0, -150), // Hairpin exit
  new THREE.Vector3(-85, 0, -110), // West return straight
  new THREE.Vector3(-75, 0, -60),  // West sweeper
  new THREE.Vector3(-45, 0, -50),  // Final corner entry
  new THREE.Vector3(-20, 0, -55),  // Merge line-up into start straight
];

/**
 * Centripetal Catmull-Rom closed 3D spline
 */
export const ROAD_CURVE = new THREE.CatmullRomCurve3(
  ROAD_CONTROL_POINTS,
  true,
  'catmullrom',
  0.5
);

export const TRACK_LENGTH = ROAD_CURVE.getLength();

const UP_VECTOR = new THREE.Vector3(0, 1, 0);

/**
 * Sampling & Transform Utility Functions
 */
export function getRoadPoint(t) {
  return ROAD_CURVE.getPointAt(t);
}

export function getRoadTangent(t) {
  return ROAD_CURVE.getTangentAt(t);
}

/**
 * Horizontal road normal pointing to the RIGHT side of the road (looking forward).
 */
export function getRoadNormal(t) {
  const tan = ROAD_CURVE.getTangentAt(t);
  const norm = new THREE.Vector3().crossVectors(tan, UP_VECTOR);
  return norm.normalize();
}

/**
 * Signed curvature estimate via central differences:
 * - Positive: Turning RIGHT (inside = right, outside barrier = left)
 * - Negative: Turning LEFT (inside = left, outside barrier = right)
 * - Near 0: Straight road
 */
export function getRoadCurvature(t, eps = 0.002) {
  const t0 = (t - eps + 1) % 1;
  const t1 = (t + eps) % 1;
  const tan0 = ROAD_CURVE.getTangentAt(t0);
  const tan1 = ROAD_CURVE.getTangentAt(t1);
  const norm = getRoadNormal(t);
  const dTan = new THREE.Vector3().subVectors(tan1, tan0);
  return dTan.dot(norm) / (2 * eps);
}

/**
 * Find the closest parameter t on the road curve to a given 3D position
 */
export function getClosestT(pos, samples = 200) {
  let minD2 = Infinity;
  let bestT = 0;
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const p = ROAD_CURVE.getPointAt(t);
    const d2 = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
    if (d2 < minD2) {
      minD2 = d2;
      bestT = t;
    }
  }

  // Refine with local search
  const step = 1 / (samples * 4);
  let refinedT = bestT;
  for (let s = -2; s <= 2; s++) {
    const t = (bestT + s * step + 1) % 1;
    const p = ROAD_CURVE.getPointAt(t);
    const d2 = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
    if (d2 < minD2) {
      minD2 = d2;
      refinedT = t;
    }
  }

  return refinedT;
}

/**
 * Distance from any 3D coordinate to the road centerline in the XZ plane
 */
export function getDistanceToRoadCenter(pos) {
  const t = getClosestT(pos);
  const roadPt = ROAD_CURVE.getPointAt(t);
  return Math.hypot(pos.x - roadPt.x, pos.z - roadPt.z);
}

/**
 * Test whether a point lies on the drivable road surface
 */
export function isPointOnRoad(pos, margin = 0) {
  const dist = getDistanceToRoadCenter(pos);
  return dist <= (HALF_ROAD_WIDTH + margin);
}

/**
 * Test whether a point lies in the roadside runoff verge
 */
export function isPointInRunoff(pos, runoffWidth = BARRIER_OFFSET) {
  const dist = getDistanceToRoadCenter(pos);
  return dist > HALF_ROAD_WIDTH && dist <= (HALF_ROAD_WIDTH + runoffWidth);
}

/**
 * Track Sectors & Driving Zones
 */
export const TRACK_SECTORS = [
  {
    id: 'sector_1_launch_straight',
    name: 'Main Launch Straight',
    startT: 0.0,
    endT: 0.17,
    type: 'straight',
    lengthMeters: 195,
    speedRecommendationKmH: 220,
    hasStartingGrid: true,
    hasSpeedTraps: true,
    lightingPoles: true,
  },
  {
    id: 'sector_2_turn_1_sweeper',
    name: 'North High-Speed Sweeper (Turn 1)',
    startT: 0.17,
    endT: 0.32,
    type: 'curve_right',
    apexT: 0.24,
    speedRecommendationKmH: 140,
    hasApexKerb: true,
    kerbSide: 'right', // inside
    hasGuardrail: true,
    guardrailSide: 'left', // outside
    hasChevrons: true,
  },
  {
    id: 'sector_3_east_chicane',
    name: 'East Technical S-Chicane (Turns 2-3)',
    startT: 0.32,
    endT: 0.49,
    type: 'chicane',
    speedRecommendationKmH: 110,
    hasApexKerb: true,
    kerbSide: 'alternating',
    hasGuardrail: true,
    guardrailSide: 'both',
  },
  {
    id: 'sector_4_south_sweeper',
    name: 'South Sweeper (Turn 4)',
    startT: 0.49,
    endT: 0.64,
    type: 'curve_left',
    apexT: 0.57,
    speedRecommendationKmH: 135,
    hasApexKerb: true,
    kerbSide: 'left',
    hasGuardrail: true,
    guardrailSide: 'right',
  },
  {
    id: 'sector_5_hairpin',
    name: 'Grand South Hairpin (Turn 5)',
    startT: 0.64,
    endT: 0.79,
    type: 'hairpin',
    apexT: 0.72,
    speedRecommendationKmH: 65,
    hasApexKerb: true,
    kerbSide: 'left',
    hasGuardrail: true,
    guardrailSide: 'right',
    hasBrakingBoards: true,
  },
  {
    id: 'sector_6_west_return',
    name: 'West Return & Final Chicane',
    startT: 0.79,
    endT: 1.0,
    type: 'complex',
    speedRecommendationKmH: 125,
    hasApexKerb: true,
    kerbSide: 'right',
    hasGuardrail: true,
    guardrailSide: 'left',
  },
];

/**
 * Collision Registry Specification for Part 30 Collision System
 */
export const BARRIER_SEGMENTS = [
  { id: 'turn_1_north_sweeper_outer', startT: 0.17, endT: 0.32, side: -1 }, // Left (outside of right turn)
  { id: 'east_chicane_outer_1', startT: 0.34, endT: 0.41, side: 1 },        // Right
  { id: 'east_chicane_outer_2', startT: 0.42, endT: 0.49, side: -1 },       // Left
  { id: 'turn_4_south_sweeper_outer', startT: 0.50, endT: 0.63, side: 1 },  // Right
  { id: 'turn_5_hairpin_outer', startT: 0.65, endT: 0.78, side: 1 },        // Right (outside of tight hairpin)
  { id: 'west_return_outer', startT: 0.81, endT: 0.94, side: -1 },          // Left
  { id: 'launch_straight_left', startT: 0.0, endT: 0.15, side: -1 },        // Left straight safety rail
  { id: 'launch_straight_right', startT: 0.0, endT: 0.15, side: 1 },        // Right straight safety rail
];

export const ROADSIDE_OBSTACLES = [
  // Distance Countdown Boards (Turn 1 approach)
  { id: 'sign_150m_turn1', pos: [6.2, 0.7, 75], radius: 0.45, type: 'sign' },
  { id: 'sign_100m_turn1', pos: [6.2, 0.7, 95], radius: 0.45, type: 'sign' },
  { id: 'sign_50m_turn1', pos: [6.2, 0.7, 115], radius: 0.45, type: 'sign' },
  // Distance Countdown Boards (Hairpin approach)
  { id: 'sign_100m_hairpin', pos: [100, 0.7, -150], radius: 0.45, type: 'sign' },
  { id: 'sign_50m_hairpin', pos: [45, 0.7, -168], radius: 0.45, type: 'sign' },
  // Chevron Signs on apex runoffs
  { id: 'chevron_t1_1', pos: [75, 1.0, 248], radius: 0.5, type: 'sign' },
  { id: 'chevron_t1_2', pos: [140, 1.0, 252], radius: 0.5, type: 'sign' },
  { id: 'chevron_t2', pos: [198, 1.0, 208], radius: 0.5, type: 'sign' },
  { id: 'chevron_hairpin_1', pos: [10, 1.0, -182], radius: 0.5, type: 'sign' },
  { id: 'chevron_hairpin_2', pos: [-60, 1.0, -158], radius: 0.5, type: 'sign' },
  // Telemetry Lighting Poles along launch straight
  { id: 'pole_l1', pos: [-7.5, 3.5, 20], radius: 0.35, type: 'pole' },
  { id: 'pole_r1', pos: [7.5, 3.5, 20], radius: 0.35, type: 'pole' },
  { id: 'pole_l2', pos: [-7.5, 3.5, 60], radius: 0.35, type: 'pole' },
  { id: 'pole_r2', pos: [7.5, 3.5, 60], radius: 0.35, type: 'pole' },
  { id: 'pole_l3', pos: [-7.5, 3.5, 100], radius: 0.35, type: 'pole' },
  { id: 'pole_r3', pos: [7.5, 3.5, 100], radius: 0.35, type: 'pole' },
];

const SAMPLE_COUNT = 600;
export const PRECOMPUTED_ROAD_SAMPLES = (() => {
  const samples = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = i / SAMPLE_COUNT;
    const pt = ROAD_CURVE.getPointAt(t);
    const tan = ROAD_CURVE.getTangentAt(t);
    const norm = new THREE.Vector3().crossVectors(tan, UP_VECTOR).normalize();
    samples.push({
      t,
      x: pt.x,
      z: pt.z,
      tx: tan.x,
      tz: tan.z,
      nx: norm.x,
      nz: norm.z,
    });
  }
  return samples;
})();

/**
 * Fast, deterministic spatial query for road surface classification,
 * elevation, and lateral distance from centerline.
 */
export function getRoadSurfaceQuery(x, z, hintT = null) {
  let bestIdx = 0;
  let minDistSq = Infinity;

  // If a valid hintT is provided, check localized window around hintT (O(1))
  if (hintT !== null && hintT >= 0 && hintT <= 1) {
    const centerIdx = Math.round(hintT * SAMPLE_COUNT) % SAMPLE_COUNT;
    const windowSize = 25; // +/- 25 samples (~50 meters window)
    for (let offset = -windowSize; offset <= windowSize; offset++) {
      const idx = (centerIdx + offset + SAMPLE_COUNT) % SAMPLE_COUNT;
      const s = PRECOMPUTED_ROAD_SAMPLES[idx];
      const d2 = (x - s.x) ** 2 + (z - s.z) ** 2;
      if (d2 < minDistSq) {
        minDistSq = d2;
        bestIdx = idx;
      }
    }
  }

  // Fallback to full search if no hint or localized search resulted in large distance (> 30m)
  if (minDistSq > 900) {
    minDistSq = Infinity;
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const s = PRECOMPUTED_ROAD_SAMPLES[i];
      const d2 = (x - s.x) ** 2 + (z - s.z) ** 2;
      if (d2 < minDistSq) {
        minDistSq = d2;
        bestIdx = i;
      }
    }
  }

  const s0 = PRECOMPUTED_ROAD_SAMPLES[bestIdx];
  const nextIdx = (bestIdx + 1) % SAMPLE_COUNT;
  const s1 = PRECOMPUTED_ROAD_SAMPLES[nextIdx];

  // Segment projection
  const segDx = s1.x - s0.x;
  const segDz = s1.z - s0.z;
  const segLenSq = segDx * segDx + segDz * segDz || 1;
  const u = Math.max(0, Math.min(1, ((x - s0.x) * segDx + (z - s0.z) * segDz) / segLenSq));

  const projX = s0.x + u * segDx;
  const projZ = s0.z + u * segDz;
  const projNx = s0.nx + u * (s1.nx - s0.nx);
  const projNz = s0.nz + u * (s1.nz - s0.nz);
  const normLen = Math.hypot(projNx, projNz) || 1;
  const nx = projNx / normLen;
  const nz = projNz / normLen;

  const dx = x - projX;
  const dz = z - projZ;
  const distToCenter = Math.hypot(dx, dz);
  const signedLateralDist = dx * nx + dz * nz;
  const t = (s0.t + u * (1 / SAMPLE_COUNT)) % 1;

  // Surface classification
  let surfaceType = 'asphalt';
  let elevation = ROAD_SURFACE_ELEVATION;
  let isRoad = true;
  let isRunoff = false;
  let isOffRoad = false;

  if (distToCenter <= HALF_ROAD_WIDTH) {
    // 0 to 5.0m: Primary drivable asphalt road surface
    surfaceType = 'asphalt';
    elevation = ROAD_SURFACE_ELEVATION;
    isRoad = true;
  } else if (distToCenter <= HALF_ROAD_WIDTH + SHOULDER_WIDTH) {
    // 5.0m to 5.5m: Concrete shoulder / kerb
    surfaceType = 'kerb';
    elevation = ROAD_SURFACE_ELEVATION;
    isRoad = true;
    isRunoff = true;
  } else {
    // Beyond 5.5m: Off-road meadow terrain
    surfaceType = 'grass';
    elevation = 0.0;
    isRoad = false;
    isOffRoad = true;
  }

  return {
    t,
    projX,
    projZ,
    nx,
    nz,
    distToCenter,
    signedLateralDist,
    surfaceType,
    elevation,
    isRoad,
    isRunoff,
    isOffRoad,
  };
}

export const ROAD_COLLISION_METADATA = {
  version: '1.0',
  trackLength: TRACK_LENGTH,
  roadWidth: ROAD_WIDTH,
  halfWidth: HALF_ROAD_WIDTH,
  barrierOffset: BARRIER_OFFSET,
  barrierDistance: BARRIER_DIST_FROM_CENTER,
  barrierHeight: BARRIER_HEIGHT,
  surfaceTypes: {
    ROAD: { tag: 'road', friction: 1.0, collidable: true },
    KERB: { tag: 'curb', friction: 0.85, rumble: true, collidable: true },
    RUNOFF: { tag: 'runoff', friction: 0.6, collidable: true },
    GRASS: { tag: 'grass', friction: 0.35, collidable: true },
    BARRIER: { tag: 'barrier', collidable: true, restitution: 0.15, damage: true },
    SCENERY: { tag: 'scenery', collidable: false },
    OBSTACLE: { tag: 'obstacle', collidable: true, radius: 0.45 },
  },
};
