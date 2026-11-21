/**
 * Canonical Vehicle Lighting System Registry
 * Verified against public/models/car.glb and python/reports/car_manifest.json
 *
 * Vehicle Type: 2-Door Sports Coupe (Khronos Car Concept)
 *
 * Asset Geometry Analysis & Physical Capabilities:
 * 1. Headlights:
 *    - Mesh: BodyHeadlights (Node 49, child of Pivot_Bonnet / Node 44)
 *    - Material slot: Material 14 ("Headlight")
 *    - Geometry: Single unified mesh spanning both left and right headlight lenses.
 *    - Supported Functions: OFF, Parking/DRL, Low Beam, High Beam.
 *    - Light Sources: Independent Left & Right forward SpotLights pointing forward (+Z).
 *
 * 2. Taillights & Brake Lights:
 *    - Mesh: BodyTaillights (Node 40, child of Pivot_Boot / Node 34)
 *    - Material slot: Material 13 ("Brakelight")
 *    - Geometry: Single unified rear strip spanning both left and right sides.
 *    - Dual-Function Behavior:
 *      * Running / Tail Light: soft red illumination (emissive intensity ~1.8)
 *      * Brake Light: high-intensity stop warning (emissive intensity ~8.0)
 *    - Light Sources: Left & Right rear PointLights casting subtle red ground illumination.
 *
 * 3. Turn Signals (Indicators) & Hazard Lights:
 *    - Mesh: BodyTurnsignalsRear (Node 38, child of Pivot_Boot / Node 34)
 *    - Material slot: Material 12 ("Signallight")
 *    - Geometry: Single unified rear turn signal mesh.
 *    - Supported Functions: Left Indicator, Right Indicator, Hazard Lights (both).
 *    - Front Indicator Limitation: The model does NOT contain separate front indicator geometry.
 *      Independent side PointLights cast directional amber illumination for Left vs Right indication.
 */

// ─── Operating Modes & State Enums ───

export const HEADLIGHT_MODES = {
  OFF: 'off',
  PARKING: 'parking', // DRL (Daytime Running Lights) / Position Lights
  LOW_BEAM: 'low_beam', // Standard night-driving projector beam
  HIGH_BEAM: 'high_beam', // Maximum long-distance forward throw
};

export const TAILLIGHT_MODES = {
  OFF: 'off',
  RUNNING: 'running', // Active with parking or headlights
};

export const BRAKE_MODES = {
  OFF: 'off',
  ACTIVE: 'active', // Intensifies rear taillight strip to full stop brightness
};

export const INDICATOR_MODES = {
  OFF: 'off',
  LEFT: 'left',
  RIGHT: 'right',
  HAZARD: 'hazard',
};

// ─── Standard Automotive Blinker Timing (ECE / SAE Compliant) ───
// Standard automotive flasher: 90 flashes/min = 1.5 Hz
// Period = 667ms (333ms ON, 333ms OFF -> 50% duty cycle)
export const BLINK_PERIOD_MS = 667;
export const BLINK_DUTY_CYCLE = 0.5;

// ─── Emissive Material Presets ───

export const HEADLIGHT_EMISSIVE_PRESETS = {
  off: {
    color: '#8AB8FF',
    emissive: '#000000',
    emissiveIntensity: 0,
    roughness: 0.08,
    metalness: 0.0,
  },
  parking: {
    color: '#A8CEFF',
    emissive: '#9EC4FF',
    emissiveIntensity: 2.5,
    roughness: 0.05,
    metalness: 0.0,
  },
  low_beam: {
    color: '#E0ECFF',
    emissive: '#D0E4FF',
    emissiveIntensity: 8.0,
    roughness: 0.03,
    metalness: 0.0,
  },
  high_beam: {
    color: '#FFFFFF',
    emissive: '#FFFFFF',
    emissiveIntensity: 15.0,
    roughness: 0.01,
    metalness: 0.0,
  },
};

export const TAILLIGHT_EMISSIVE_PRESETS = {
  off: {
    color: '#FF2000',
    emissive: '#000000',
    emissiveIntensity: 0,
    roughness: 0.1,
    metalness: 0.0,
  },
  running: {
    color: '#FF2000',
    emissive: '#FF1500',
    emissiveIntensity: 1.8,
    roughness: 0.06,
    metalness: 0.0,
  },
  brake: {
    color: '#FF0500',
    emissive: '#FF0000',
    emissiveIntensity: 8.0,
    roughness: 0.03,
    metalness: 0.0,
  },
};

export const SIGNALLIGHT_EMISSIVE_PRESETS = {
  off: {
    color: '#FF8800',
    emissive: '#000000',
    emissiveIntensity: 0,
    roughness: 0.1,
    metalness: 0.0,
  },
  blink_on: {
    color: '#FFA020',
    emissive: '#FF8800',
    emissiveIntensity: 6.0,
    roughness: 0.04,
    metalness: 0.0,
  },
  blink_off: {
    color: '#FF8800',
    emissive: '#000000',
    emissiveIntensity: 0,
    roughness: 0.1,
    metalness: 0.0,
  },
};

// ─── Real Three.js Light Source Specifications ───
// Coordinates are measured in parent pivot reference frames so lights move naturally with doors/bonnet/boot!

export const LIGHT_SOURCE_SPECS = {
  // Headlights: attached to Pivot_Bonnet (Node 44)
  headlights: {
    leftPosLocal: [0.6463, -2.1825, 0.6649],
    rightPosLocal: [-0.6463, -2.1825, 0.6649],
    lowBeam: {
      color: '#E8F0FF',
      intensity: 22.0,
      distance: 20.0,
      angle: 0.58, // ~33 deg cone
      penumbra: 0.6,
      targetLocal: [0, -12.0, 0.1], // Road illumination forward and down
    },
    highBeam: {
      color: '#FFFFFF',
      intensity: 48.0,
      distance: 38.0,
      angle: 0.68, // ~39 deg cone
      penumbra: 0.4,
      targetLocal: [0, -25.0, 0.5], // Far distance throw
    },
  },

  // Taillights & Brakes: attached to Pivot_Boot (Node 34)
  taillights: {
    leftPosLocal: [0.4775, 1.579, 0.9709],
    rightPosLocal: [-0.4775, 1.579, 0.9709],
    running: {
      color: '#FF1500',
      intensity: 2.5,
      distance: 4.5,
    },
    brake: {
      color: '#FF0000',
      intensity: 10.0,
      distance: 7.5,
    },
  },

  // Indicators: attached to Pivot_Boot (Node 34)
  indicators: {
    leftPosLocal: [0.7917, 1.3655, 0.991],
    rightPosLocal: [-0.7917, 1.3655, 0.991],
    amberColor: '#FFA000',
    intensity: 8.0,
    distance: 5.5,
  },
};

/**
 * Returns documented physical capabilities and limitations of the car model asset
 */
export function getLightingCapabilities() {
  return {
    headlightMeshes: ['BodyHeadlights'],
    headlightLensesSeparate: false,
    frontIndicatorsPresentInGeometry: false,
    taillightMeshes: ['BodyTaillights'],
    taillightBrakeSharedGeometry: true,
    turnSignalMeshes: ['BodyTurnsignalsRear'],
    supportedFunctions: [
      'Headlights OFF',
      'Parking / DRL Lights',
      'Low Beam Projector Lights',
      'High Beam Long Throw Lights',
      'Rear Tail / Running Lights',
      'Brake Lights (Intensified Tail Strip)',
      'Left Turn Indicator',
      'Right Turn Indicator',
      'Hazard Warning Flasher',
      'All Lights OFF / Reset',
    ],
    limitations: [
      'Left and right headlight lenses belong to single unified BodyHeadlights mesh',
      'Front turn signals have no distinct geometry in model; simulated via directional amber light sources',
      'Taillights and brake lights share BodyTaillights mesh; differentiated by dual-intensity illumination',
      'Rear turn signals belong to single unified BodyTurnsignalsRear mesh',
    ],
  };
}
