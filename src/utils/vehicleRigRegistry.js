/**
 * Canonical Vehicle Closures Rigging Registry
 * Verified against public/models/car.glb and python/reports/car_manifest.json
 *
 * Vehicle Type: 2-Door Sports Coupe (Khronos Car Concept)
 * Movable Articulated Components:
 *   1. Front-Left Door (Driver Door)
 *   2. Front-Right Door (Passenger Door)
 *   3. Bonnet / Hood (Forward-opening Clamshell)
 *   4. Boot / Trunk (Rear Liftback Hatch)
 */

export const CLOSURE_RIG_CONFIG = {
  door_fl: {
    id: 'door_fl',
    name: 'Driver Door (Front-Left)',
    shortName: 'Driver Door',
    category: 'Closures',
    pivotNodeName: 'Pivot_Door_FL',
    axis: 'z', // Local Z-axis in BodyUnderside frame corresponds to World-Y (Vertical Up)
    openAngleRad: -60 * (Math.PI / 180), // -1.0472 rad (outward swing)
    closedAngleRad: 0,
    openAngleDeg: -60,
    durationMs: 950,
    cameraFocusTarget: 'door_fl',
    description: 'Driver-side composite door with frameless glass and power mirror assembly.',
  },
  door_fr: {
    id: 'door_fr',
    name: 'Passenger Door (Front-Right)',
    shortName: 'Passenger Door',
    category: 'Closures',
    pivotNodeName: 'Pivot_Door_FR',
    axis: 'z',
    openAngleRad: 60 * (Math.PI / 180), // +1.0472 rad (outward swing)
    closedAngleRad: 0,
    openAngleDeg: 60,
    durationMs: 950,
    cameraFocusTarget: 'door_fr',
    description: 'Passenger-side composite door with frameless glass and passenger mirror.',
  },
  bonnet: {
    id: 'bonnet',
    name: 'Front Bonnet / Hood',
    shortName: 'Bonnet',
    category: 'Closures',
    pivotNodeName: 'Pivot_Bonnet',
    axis: 'x', // Lateral pitch axis across front bumper
    openAngleRad: 42 * (Math.PI / 180), // +0.7330 rad (forward clamshell lift)
    closedAngleRad: 0,
    openAngleDeg: 42,
    durationMs: 1100,
    cameraFocusTarget: 'bonnet',
    description: 'Forward-opening carbon-composite front clamshell revealing cooling and suspension bay.',
  },
  boot: {
    id: 'boot',
    name: 'Boot / Rear Hatch',
    shortName: 'Boot / Hatch',
    category: 'Closures',
    pivotNodeName: 'Pivot_Boot',
    axis: 'x', // Lateral pitch axis across rear roof/decklid
    openAngleRad: -48 * (Math.PI / 180), // -0.8378 rad (liftback tailgate lift)
    closedAngleRad: 0,
    openAngleDeg: -48,
    durationMs: 1100,
    cameraFocusTarget: 'boot',
    description: 'Rear aerodynamic liftback hatch with integrated heated glass and spoiler.',
  },
};

export const CLOSURE_IDS = Object.keys(CLOSURE_RIG_CONFIG);

/**
 * Standard cubic ease-in-out easing function
 * Provides smooth acceleration and deceleration without sudden velocity steps.
 */
export function easeInOutCubic(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/**
 * Check if a component ID is an animated closure
 */
export function isAnimatableClosure(componentId) {
  return Boolean(componentId && CLOSURE_RIG_CONFIG[componentId]);
}

/**
 * Get closure configuration by ID
 */
export function getClosureConfig(closureId) {
  return CLOSURE_RIG_CONFIG[closureId] || null;
}
