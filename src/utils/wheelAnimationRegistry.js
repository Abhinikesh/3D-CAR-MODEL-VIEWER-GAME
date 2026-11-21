/**
 * Canonical Wheel Animation & Steering Kinematics Registry
 * Verified against public/models/car.glb and python/reports/car_manifest.json
 *
 * Vehicle Type: 2-Door Sports Coupe (Khronos Car Concept)
 * Stationary Ground Plane: Y = 0.000m (Chassis remains completely fixed)
 *
 * Kinematic Systems:
 *   1. Wheel Spin (Axial Roll):
 *      - Local pitch axis: Local X-axis across each wheel hub
 *      - Rotating components: Rim (Mesh_Rim_*), Tire (node_*), Brake Disc (Wheel*BrakeDisc)
 *      - Stationary component: Brake Caliper (Mesh_Caliper_*) remains stationary on the knuckle!
 *
 *   2. Front-Wheel Steering:
 *      - Steering axis: World Y (Local Z in BodyUnderside frame)
 *      - Articulated wheels: Front-Left (FL) and Front-Right (FR)
 *      - Rigid rear axle: Rear-Left (RL) and Rear-Right (RR) do NOT steer (0° fixed)
 *      - Safe angular limits: -30° (Full Right) to +30° (Full Left)
 */

export const MAX_STEERING_ANGLE_DEG = 30;
export const MAX_STEERING_ANGLE_RAD = (30 * Math.PI) / 180; // 0.5235987755982988 rad

// Base spin speed: 1.0x multiplier = 1 revolution per second (2*PI rad/s = 60 RPM)
export const BASE_SPIN_SPEED_RAD_PER_SEC = 2 * Math.PI;

// Physical tire radius measured from glTF bounding geometry: Y/Z extent = 0.36065m (360.65mm)
export const TIRE_RADIUS_METERS = 0.36065;

export const SPIN_MODES = {
  ALL: 'all',
  FRONT: 'front',
  REAR: 'rear',
  INDIVIDUAL: 'individual',
};

export const WHEEL_ANIMATION_CONFIG = {
  wheel_fl: {
    id: 'wheel_fl',
    name: 'Front-Left Wheel',
    shortName: 'Front-Left',
    axle: 'front',
    side: 'left',
    assemblyNodeName: 'Wheel_Assembly_FL',
    steerable: true,
    rollAxis: 'x',
    rollDirection: 1, // positive forward rotation
    // In glTF, initial pose is steered -30 deg, with base roll Euler X = 120 deg in Euler order ZYX
    baseEulerXRad: (120 * Math.PI) / 180,
    initialSteerAngleRad: (-30 * Math.PI) / 180,
    neutralSteerAngleRad: 0,
    // Components that rotate during wheel roll
    spinMeshNames: ['Mesh_Rim_FL', 'node_84', 'WheelFrontLBrakeDisc'],
    // Components that remain stationary relative to the steering knuckle during wheel roll
    stationaryMeshNames: ['Mesh_Caliper_FL'],
    cameraFocusTarget: 'wheel_fl',
    description: 'Steerable front-left wheel assembly with ventilated brake disc and 4-piston caliper.',
  },
  wheel_fr: {
    id: 'wheel_fr',
    name: 'Front-Right Wheel',
    shortName: 'Front-Right',
    axle: 'front',
    side: 'right',
    assemblyNodeName: 'Wheel_Assembly_FR',
    steerable: true,
    rollAxis: 'x',
    rollDirection: 1,
    // In glTF, initial pose is steered -30 deg, with base roll Euler X = 45 deg in Euler order ZYX
    baseEulerXRad: (45 * Math.PI) / 180,
    initialSteerAngleRad: (-30 * Math.PI) / 180,
    neutralSteerAngleRad: 0,
    spinMeshNames: ['Mesh_Rim_FR', 'node_89', 'WheelFrontRBrakeDisc'],
    stationaryMeshNames: ['Mesh_Caliper_FR'],
    cameraFocusTarget: 'wheel_fr',
    description: 'Steerable front-right wheel assembly with ventilated brake disc and 4-piston caliper.',
  },
  wheel_rl: {
    id: 'wheel_rl',
    name: 'Rear-Left Wheel',
    shortName: 'Rear-Left',
    axle: 'rear',
    side: 'left',
    assemblyNodeName: 'Wheel_Assembly_RL',
    steerable: false,
    rollAxis: 'x',
    rollDirection: 1,
    // Base roll Euler X = -110 deg
    baseEulerXRad: (-110 * Math.PI) / 180,
    initialSteerAngleRad: 0,
    neutralSteerAngleRad: 0,
    spinMeshNames: ['Mesh_Rim_RL', 'node_94', 'WheelRearLBrakeDisc'],
    stationaryMeshNames: ['Mesh_Caliper_RL'],
    cameraFocusTarget: 'wheel_rl',
    description: 'Fixed rear-left driven wheel assembly with solid performance disc and trailing caliper.',
  },
  wheel_rr: {
    id: 'wheel_rr',
    name: 'Rear-Right Wheel',
    shortName: 'Rear-Right',
    axle: 'rear',
    side: 'right',
    assemblyNodeName: 'Wheel_Assembly_RR',
    steerable: false,
    rollAxis: 'x',
    rollDirection: 1,
    // Base roll Euler X = -55 deg
    baseEulerXRad: (-55 * Math.PI) / 180,
    initialSteerAngleRad: 0,
    neutralSteerAngleRad: 0,
    spinMeshNames: ['Mesh_Rim_RR', 'node_99', 'WheelRearRBrakeDisc'],
    stationaryMeshNames: ['Mesh_Caliper_RR'],
    cameraFocusTarget: 'wheel_rr',
    description: 'Fixed rear-right driven wheel assembly with solid performance disc and trailing caliper.',
  },
};

export const WHEEL_IDS = Object.keys(WHEEL_ANIMATION_CONFIG);

/**
 * Check if a component ID is a wheel assembly
 */
export function isWheelComponent(componentId) {
  return Boolean(componentId && WHEEL_ANIMATION_CONFIG[componentId]);
}

/**
 * Get wheel configuration by ID
 */
export function getWheelConfig(wheelId) {
  return WHEEL_ANIMATION_CONFIG[wheelId] || null;
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Calculate vehicle equivalent speed in km/h based on wheel spin multiplier
 * speed (km/h) = (rad/s) * radius(m) * 3.6
 */
export function calculateSpeedKmh(spinSpeedMultiplier, radius = TIRE_RADIUS_METERS) {
  const radPerSec = spinSpeedMultiplier * BASE_SPIN_SPEED_RAD_PER_SEC;
  const metersPerSec = radPerSec * radius;
  return metersPerSec * 3.6;
}

/**
 * Calculate wheel RPM based on spin speed multiplier
 */
export function calculateRpm(spinSpeedMultiplier) {
  return Math.round(spinSpeedMultiplier * 60);
}
