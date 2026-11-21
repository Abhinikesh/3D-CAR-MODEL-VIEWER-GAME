import * as THREE from 'three';
import { ROAD_SURFACE_ELEVATION, SPAWN_POSITION, SPAWN_HEADING } from './roadData.js';

/**
 * Automotive Vehicle Physics & Kinematic Configuration
 *
 * Vehicle Type: 2-Door Performance Sports Coupe (Khronos Car Concept)
 * Calibrated against verified 3D mesh dimensions:
 * - Length: 4.56m, Width: 2.47m (1.95m track), Height: 1.74m (1.15m body roof)
 * - Wheelbase: 2.800m (Front Axle Z = +1.485m, Rear Axle Z = -1.314m)
 * - Front Track: 1.952m (FL X = +0.976m, FR X = -0.976m)
 * - Rear Track: 1.964m (RL X = +0.982m, RR X = -0.982m)
 * - Tire Radius: 0.36065m
 */

export const VEHICLE_PHYSICS_CONFIG = {
  // ─── 1. Chassis Rigid Body Dynamics ───
  chassis: {
    // Curb weight in kilograms
    mass: 1450, // kg (typical mid-engine lightweight sports coupe)
    // Physical bounding dimensions in meters [width, height, length]
    dimensions: [1.95, 1.15, 4.56],
    // Center of Mass offset from model origin [X, Y, Z]
    // Calibrated: low center of gravity at 0.42m above ground, slightly forward for 52:48 weight distribution
    centerOfMass: [0.0, 0.42, 0.08],
    // Moments of inertia computed for cuboid of dimensions [1.95, 1.15, 4.56] and mass 1450kg
    inertia: {
      ixx: 2672, // Roll inertia: 1/12 * m * (h^2 + l^2)
      iyy: 2971, // Yaw inertia:  1/12 * m * (w^2 + l^2)
      izz: 619,  // Pitch inertia:1/12 * m * (w^2 + h^2)
    },
    // Gravity acceleration vector in world space
    gravity: [0, -9.81, 0], // m/s^2
    // Linear damping (air drag & rolling resistance at low speeds)
    linearDamping: 0.08,
    // Angular damping (pitch/roll stabilization)
    angularDamping: 0.22,
    // Rest settlement velocity thresholds
    settleLinearVelocityThreshold: 0.008, // m/s
    settleAngularVelocityThreshold: 0.008, // rad/s
    settleConsecutiveTicks: 12, // ~200ms of near-zero velocity confirms settlement
  },

  // ─── 2. Suspension & Wheel Geometry ───
  suspension: {
    // Nominal uncompressed rest length of suspension spring (meters)
    restLength: 0.28,
    // Minimum compressed length (bump-stop limit)
    minLength: 0.12,
    // Maximum extended length (droop limit)
    maxLength: 0.36,
    // Spring stiffness (Newtons per meter) - tuned for comfortable sports damping
    springStiffness: 35000, // N/m (total vehicle capacity = 140,000 N/m)
    // Shock absorber damping rate (Newton-seconds per meter)
    dampingRate: 3200, // N*s/m (critical damping ratio ~0.68)
    // Anti-roll bar torsional coupling stiffness between left/right wheels (N/m)
    antiRollStiffness: 8000,
    // Wheel physical radius
    tireRadius: 0.36065,
    // Tire rolling resistance coefficient
    rollingResistance: 0.015,
  },

  // ─── 3. Four Wheel Mounting Points (Chassis Local Frame) ───
  // Anchors are suspension top mounts in chassis local coordinates
  wheelMounts: {
    fl: {
      id: 'wheel_fl',
      name: 'Front-Left',
      axle: 'front',
      side: 'left',
      // Mount anchor point relative to vehicle origin [X, Y, Z]
      mountPoint: [0.9755, 0.54, 1.4857],
      hubNodeName: 'Wheel_Assembly_FL',
    },
    fr: {
      id: 'wheel_fr',
      name: 'Front-Right',
      axle: 'front',
      side: 'right',
      mountPoint: [-0.9767, 0.54, 1.4840],
      hubNodeName: 'Wheel_Assembly_FR',
    },
    rl: {
      id: 'wheel_rl',
      name: 'Rear-Left',
      axle: 'rear',
      side: 'left',
      mountPoint: [0.9825, 0.54, -1.3141],
      hubNodeName: 'Wheel_Assembly_RL',
    },
    rr: {
      id: 'wheel_rr',
      name: 'Rear-Right',
      axle: 'rear',
      side: 'right',
      mountPoint: [-0.9817, 0.54, -1.3141],
      hubNodeName: 'Wheel_Assembly_RR',
    },
  },

  // ─── 4. Fixed Timestep Simulation Parameters ───
  simulation: {
    // Fixed simulation delta time (60 Hz clock)
    timeStep: 1 / 60, // 0.016667s
    // Maximum sub-steps per frame to prevent spiral of death during lag spikes
    maxSubSteps: 5,
    // Maximum delta clamp to safeguard against background tab throttling
    maxDelta: 0.1, // 100ms
  },

  // ─── 5. Spawn Pose (Road Tangent Datum) ───
  spawn: {
    // Initial chassis position: elevated by 0.025m above ground for natural initial suspension settling
    position: [SPAWN_POSITION.x, ROAD_SURFACE_ELEVATION + 0.015, SPAWN_POSITION.z],
    rotation: [0, 0, 0], // Yaw 0 aligned with +Z heading vector
    heading: [SPAWN_HEADING.x, SPAWN_HEADING.y, SPAWN_HEADING.z],
  },

  // ─── 6. Drivetrain & Longitudinal Dynamics (Part 27) ───
  drivetrain: {
    // Maximum forward tractive force from engine at tire contact patch (Newtons)
    // 9,800 N produces ~6.7 m/s^2 initial acceleration for 1,450 kg (~4.5s 0-100 km/h)
    maxDriveForce: 9800,
    // Maximum reverse tractive force (Newtons)
    maxReverseForce: 4200,
    // Forward top speed (m/s) -> 250 km/h (69.44 m/s)
    maxSpeedForward: 69.44,
    // Reverse top speed (m/s) -> 45 km/h (12.5 m/s)
    maxSpeedReverse: 12.5,
    // Maximum progressive service braking force (Newtons) -> ~1.05g deceleration
    maxBrakeForce: 15200,
    // Front/Rear brake bias (65% front, 35% rear for dynamic weight transfer)
    brakeBiasFront: 0.65,
    brakeBiasRear: 0.35,
    // Rolling resistance coefficient (C_rr) on smooth asphalt tarmac
    rollingResistanceCoeff: 0.015,
    // Aerodynamic drag parameter: 0.5 * rho * Cd * FrontalArea (kg/m)
    // rho = 1.225 kg/m^3, Cd = 0.31, Frontal Area = 1.90 m^2 -> 0.3608 kg/m
    aerodynamicDragCoeff: 0.36,
    // Threshold below which braking or coasting clamps velocity to absolute zero (m/s)
    stopSpeedThreshold: 0.05,
    // Speed threshold below which reverse engagement is permitted (m/s)
    reverseEngagementThreshold: 0.35,
    // Throttle response smoothing rate (1/s)
    throttleResponseRate: 6.0,
    // Brake response smoothing rate (1/s)
    brakeResponseRate: 10.0,
    // Contact patch height offset relative to chassis origin (meters)
    contactPatchYOffset: -0.36,
  },

  // ─── 7. Steering & Lateral Handling Dynamics (Part 28) ───
  steering: {
    // Maximum front wheel steering angle at low speed (<= 5 m/s / 18 km/h) in radians
    // 30 degrees = 0.5235987756 rad (matches verified Khronos CarConcept physical steering limit)
    maxSteeringAngleLow: (30 * Math.PI) / 180,
    // Minimum front wheel steering angle limit at high speed (>= 60 m/s / 216 km/h) in radians
    // 12 degrees = 0.2094395102 rad (prevents excessive lateral G, rollover, and high-speed spinouts)
    maxSteeringAngleHigh: (12 * Math.PI) / 180,
    // Speed scaling factor for speed-sensitive steering reduction (m/s)
    steerSpeedScale: 18.0,
    // Steering input buildup response rate (rad/s buildup speed towards target angle)
    steeringResponseRate: 3.5,
    // Automatic self-centering return rate (rad/s decay towards center when input released)
    steeringCenteringRate: 5.0,
    // Wheelbase L in meters: Front Axle (+1.485m) to Rear Axle (-1.314m)
    wheelbase: 2.800,
    // Front track width W_f in meters: FL (+0.976m) to FR (-0.976m)
    trackWidthFront: 1.952,
    // Rear track width W_r in meters: RL (+0.982m) to RR (-0.982m)
    trackWidthRear: 1.964,
    // Longitudinal distance from center of mass to front axle (m)
    distComToFrontAxle: 1.405,
    // Longitudinal distance from center of mass to rear axle (m)
    distComToRearAxle: 1.394,
    // Front cornering stiffness C_alpha_front (N/rad)
    corneringStiffnessFront: 68000,
    // Rear cornering stiffness C_alpha_rear (N/rad) - tuned slightly higher for mild understeer stability
    corneringStiffnessRear: 74000,
    // Peak tire-road adhesion friction coefficient mu (dry asphalt tarmac)
    tireFrictionCoeff: 1.15,
    // Speed threshold below which lateral tire forces scale to zero to prevent stationary rotation (m/s)
    stationarySpeedThreshold: 0.25,
    // Minimum speed epsilon to prevent division by zero in slip angle evaluation (m/s)
    slipAngleEpsilon: 0.5,
  },

  // ─── 8. Physics-Driven Wheel Kinematics & Visual Suspension (Part 29) ───
  wheelKinematics: {
    // Physical rolling radius of wheels (meters)
    tireRadius: 0.36065,
    // Outer rolling circumference (meters) = 2 * PI * radius
    tireCircumference: 2 * Math.PI * 0.36065, // ~2.26607m
    // Baseline equilibrium suspension compression at resting gravity settlement (meters)
    settledCompression: {
      fl: 0.1134,
      fr: 0.1134,
      rl: 0.0902,
      rr: 0.0902,
    },
    // Maximum physical suspension deflection travel clamp (meters)
    // +/- 40mm prevents wheel arch clipping while presenting authentic bump/dive/roll
    maxSuspensionTravel: 0.040,
    // Low-pass filter damping rate for smooth visual suspension travel (1/s)
    suspensionSmoothingRate: 18.0,
  },

  // ─── 9. Road Boundaries, Collision Detection & Off-Road Dynamics (Part 30) ───
  collision: {
    // Vehicle collision bounding box half-extents in meters [halfWidth, halfHeight, halfLength]
    // CarConcept body: 1.95m width (half 0.975m), 1.15m height (half 0.575m), 4.56m length (half 2.28m)
    halfExtents: [0.975, 0.575, 2.28],
    boundingRadius: 2.48, // sqrt(0.975^2 + 2.28^2)
    bumperContactY: 0.35, // Nominal bumper height above ground (meters)

    // Bumper collision contact probing offsets in chassis local frame:
    // [FL, FR, RL, RR, ML, MR, FrontCenter, RearCenter]
    contactPoints: [
      { id: 'bumper_fl', pos: [0.95, 0.35, 2.25] },
      { id: 'bumper_fr', pos: [-0.95, 0.35, 2.25] },
      { id: 'bumper_rl', pos: [0.95, 0.35, -2.25] },
      { id: 'bumper_rr', pos: [-0.95, 0.35, -2.25] },
      { id: 'side_l', pos: [0.975, 0.35, 0.0] },
      { id: 'side_r', pos: [-0.975, 0.35, 0.0] },
      { id: 'nose_fc', pos: [0.0, 0.35, 2.28] },
      { id: 'tail_rc', pos: [0.0, 0.35, -2.28] },
    ],

    // Coefficient of restitution (bounciness) for barrier impact (low for realistic metal deformation)
    barrierRestitution: 0.18,
    // Dynamic friction coefficient during barrier contact scrub
    barrierFriction: 0.45,
    // Collision angular impulse damping factor to prevent violent spinning
    collisionAngularDamping: 0.75,

    // Surface friction and rolling resistance properties
    surfaces: {
      asphalt: {
        id: 'asphalt',
        name: 'Asphalt Road Surface',
        frictionCoeff: 1.15,
        rollingResistanceCoeff: 0.015,
        elevation: 0.002,
      },
      kerb: {
        id: 'kerb',
        name: 'Concrete Shoulder / Kerb',
        frictionCoeff: 1.05,
        rollingResistanceCoeff: 0.022,
        elevation: 0.002,
      },
      grass: {
        id: 'grass',
        name: 'Off-Road Meadow Grass',
        frictionCoeff: 0.65, // ~43% grip reduction compared to asphalt
        rollingResistanceCoeff: 0.055, // ~3.7x higher rolling resistance to naturally slow car
        elevation: 0.000,
      },
    },

    // Roadway lateral distance thresholds (from centerline)
    roadHalfWidth: 5.0, // 0 to 5.0m = Asphalt
    shoulderWidth: 0.5, // 5.0 to 5.5m = Concrete shoulder
    barrierDistance: 6.4, // 6.4m = Armco barrier centerline
    barrierRailInset: 6.25, // 6.25m = Inside face of Armco barrier (physical collision line)
    perimeterBoundaryDist: 18.0, // Absolute outer boundary limit for open meadow sections
  },
};
