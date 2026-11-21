import * as THREE from 'three';
import {
  SPAWN_POSITION,
  SPAWN_HEADING,
  ROAD_SURFACE_ELEVATION,
  TRACK_LENGTH,
} from './roadData.js';

/**
 * Driving Mode Vehicle Spawn & Kinematic Configuration
 *
 * Mathematical Ground-Contact & Orientation Specification:
 * 1. Physical Wheel Tangency:
 *    - Lowest tire vertices in raw GLB: Y = -0.0002m (FL/RL) to +0.0012m (FR/RR).
 *    - Road surface elevation: Y = ROAD_SURFACE_ELEVATION = 0.002m (2mm above terrain datum).
 *    - Ground-contact offset: +0.002m ensures lowest tire rubber vertices sit at exactly Y = 0.002m.
 *    - Zero penetration into asphalt, zero floating above asphalt.
 *
 * 2. Spawn Alignment:
 *    - Position: [0, 0.002, 0] on the launch straight centerline.
 *    - Orientation: [0, 0, 0] (Euler radians).
 *    - Heading Vector: [0, 0, 1] (+Z direction along the 200m straight towards Turn 1).
 *    - Scale: [1, 1, 1] (preserving authentic 1:1 Khronos sports coupe proportions).
 *
 * 3. Verified Geometry & Dimensions (from carAssetRegistry & glTF vertex buffers):
 *    - Total Length: 4.56m (Z-axis extent from front splitter to rear diffuser)
 *    - Total Width: 2.47m (X-axis extent including side mirrors; 1.95m body track)
 *    - Total Height: 1.74m (Y-axis extent from tire contact to roof apex)
 *    - Wheelbase: 2.800m (distance from Front Axle Z = +1.485m to Rear Axle Z = -1.314m)
 *    - Front Track: 1.952m (distance between FL hub at X = +0.9755m and FR hub at X = -0.9767m)
 *    - Rear Track: 1.964m (distance between RL hub at X = +0.9825m and RR hub at X = -0.9817m)
 *    - Wheel Radius: 0.36065m (nominal 360.65mm tire outer radius)
 *    - Wheel Center Height: 0.3838m above ground
 */

export const DRIVING_VEHICLE_CONFIG = {
  // Spawn Transform
  spawnPosition: [SPAWN_POSITION.x, ROAD_SURFACE_ELEVATION, SPAWN_POSITION.z], // [0, 0.002, 0]
  spawnRotation: [0, 0, 0], // Yaw 0 aligns facing +Z along the main straight
  spawnHeading: [SPAWN_HEADING.x, SPAWN_HEADING.y, SPAWN_HEADING.z], // [0, 0, 1]
  groundContactOffsetY: ROAD_SURFACE_ELEVATION, // 0.002m
  scale: [1, 1, 1], // Strict 1:1 original model scale

  // Initial Camera Target & Inspection Centers
  cameraTargetOffset: [0, 0.75, 0], // Vehicle center of mass / cockpit level
  initialLookAt: [0, 0.95, 2.0], // Forward road horizon look-at target

  // Physical Dimensions & Kinematics Specification
  dimensions: {
    length: 4.56,
    width: 2.47,
    height: 1.74,
    wheelbase: 2.80,
    frontTrack: 1.952,
    rearTrack: 1.964,
    tireRadius: 0.36065,
    wheelCenterHeight: 0.3838,
  },

  // Wheel Assembly Node Names
  wheelNodes: {
    frontLeft: 'Wheel_Assembly_FL',
    frontRight: 'Wheel_Assembly_FR',
    rearLeft: 'Wheel_Assembly_RL',
    rearRight: 'Wheel_Assembly_RR',
  },

  // Initial Vehicle Kinematic State
  initialState: {
    speedKmh: 0,
    steeringAngleRad: 0,
    rpm: 800,
    gear: 'N',
    throttle: 0,
    brake: 0,
    handbrake: true,
    isGrounded: true,
    distanceTraveledMeters: 0,
    lapTimeSeconds: 0,
    headlightsActive: false,
    brakeLightsActive: false,
    indicatorsActive: false,
    doorsOpen: false,
    bonnetOpen: false,
    bootOpen: false,
  },
};

/**
 * Returns a fresh clone of the initial vehicle state object.
 */
export function getInitialDrivingVehicleState() {
  return { ...DRIVING_VEHICLE_CONFIG.initialState };
}

/**
 * Validates that a given position vector lies within valid track boundaries.
 */
export function isPositionOnTrack(pos, maxRoadOffset = 5.0) {
  if (!pos) return false;
  // Road centerline at spawn is X = 0, half-width is 5.0m
  return Math.abs(pos.x) <= maxRoadOffset;
}
