/**
 * Driving Camera Configuration & Mode Presets
 * Part 31: Third-Person Driving Camera and Follow System
 *
 * Defines:
 * 1. 5 primary automotive driving camera perspectives:
 *    - CHASE: Third-person balanced chase camera (default)
 *    - CLOSE: Close aggressive sports follow
 *    - WIDE: Wide cinematic track overview chase
 *    - HOOD: Forward bonnet / cockpit view looking down the road
 *    - BUMPER: Low front splitter speed perspective
 * 2. 4 auxiliary trackside & orbit perspectives:
 *    - ORBIT: Limited vehicle orbit / inspection camera
 *    - AERIAL: High-altitude track map overview
 *    - TURN1: Trackside spectator camera at North Sweeper
 *    - HAIRPIN: Trackside spectator camera at South Hairpin
 * 3. Exponential damping rates, speed scaling, and orbit spring-back physics.
 */

import * as THREE from 'three';

export const DRIVING_CAMERA_MODES = {
  CHASE: 'chase',
  CLOSE: 'close',
  WIDE: 'wide',
  HOOD: 'hood',
  BUMPER: 'bumper',
  ORBIT: 'orbit',
  AERIAL: 'aerial',
  TURN1: 'turn1',
  HAIRPIN: 'hairpin',
};

export const DRIVING_CAMERA_CONFIG = {
  // Mode-specific presets
  modes: {
    [DRIVING_CAMERA_MODES.CHASE]: {
      id: 'chase',
      label: 'CHASE',
      desc: 'Third-Person Chase Follow (Default)',
      distance: 5.6,              // Base distance behind vehicle (meters)
      height: 2.15,               // Base elevation above vehicle (meters)
      targetHeight: 0.90,         // Look-at target height above vehicle origin (meters)
      lookAhead: 2.5,             // Base look-ahead distance in front of vehicle (meters)
      speedDistanceScale: 1.2,    // Additional distance at top speed (+1.2m -> 6.8m)
      speedHeightScale: 0.35,     // Additional height at top speed (+0.35m -> 2.50m)
      speedLookAheadScale: 6.0,   // Additional look-ahead down the road at top speed (+6.0m -> 8.5m)
      speedFovScale: 6.0,         // Dynamic FOV widening at speed (+6° -> 52°)
      baseFov: 46.0,              // Base FOV in degrees
      posDamping: 8.5,            // Exponential position damping (1/s)
      rotDamping: 10.0,           // Exponential look-at damping (1/s)
      allowOrbit: true,
      maxOrbitAzimuth: (80 * Math.PI) / 180, // ±80° horizontal glance limit
      maxOrbitPolar: (25 * Math.PI) / 180,   // ±25° vertical glance limit
      orbitReturnSpeed: 4.0,                 // Automatic return rate to center (1/s)
    },
    [DRIVING_CAMERA_MODES.CLOSE]: {
      id: 'close',
      label: 'CLOSE',
      desc: 'Closer Dynamic Sports Follow',
      distance: 4.2,
      height: 1.65,
      targetHeight: 0.80,
      lookAhead: 1.8,
      speedDistanceScale: 0.8,
      speedHeightScale: 0.25,
      speedLookAheadScale: 4.5,
      speedFovScale: 5.0,
      baseFov: 48.0,
      posDamping: 10.0,
      rotDamping: 12.0,
      allowOrbit: true,
      maxOrbitAzimuth: (80 * Math.PI) / 180,
      maxOrbitPolar: (25 * Math.PI) / 180,
      orbitReturnSpeed: 4.5,
    },
    [DRIVING_CAMERA_MODES.WIDE]: {
      id: 'wide',
      label: 'WIDE',
      desc: 'Expansive Track Cinematic Chase',
      distance: 7.8,
      height: 3.0,
      targetHeight: 1.05,
      lookAhead: 3.5,
      speedDistanceScale: 1.8,
      speedHeightScale: 0.5,
      speedLookAheadScale: 8.0,
      speedFovScale: 7.0,
      baseFov: 52.0,
      posDamping: 6.5,
      rotDamping: 8.0,
      allowOrbit: true,
      maxOrbitAzimuth: (80 * Math.PI) / 180,
      maxOrbitPolar: (25 * Math.PI) / 180,
      orbitReturnSpeed: 3.5,
    },
    [DRIVING_CAMERA_MODES.HOOD]: {
      id: 'hood',
      label: 'BONNET',
      desc: 'Forward Bonnet / Cockpit View',
      localPos: [0.0, 1.12, 0.55], // Mounted on bonnet looking over car nose
      targetOffset: [0.0, 1.05, 25.0], // Looking down the forward road
      baseFov: 58.0,
      speedFovScale: 8.0,
      posDamping: 24.0,
      rotDamping: 22.0,
      allowOrbit: false,
    },
    [DRIVING_CAMERA_MODES.BUMPER]: {
      id: 'bumper',
      label: 'BUMPER',
      desc: 'Low Front Splitter Speed View',
      localPos: [0.0, 0.45, 2.42], // Mounted just in front of front splitter
      targetOffset: [0.0, 0.45, 20.0],
      baseFov: 65.0,
      speedFovScale: 10.0,
      posDamping: 26.0,
      rotDamping: 24.0,
      allowOrbit: false,
    },
    [DRIVING_CAMERA_MODES.ORBIT]: {
      id: 'orbit',
      label: 'ORBIT',
      desc: '360° Free Vehicle Inspection',
      distance: 5.5,
      height: 1.8,
      targetHeight: 0.75,
      baseFov: 45.0,
      minDistance: 2.5,
      maxDistance: 25.0,
      minPolarAngle: 0.1,
      maxPolarAngle: Math.PI / 2 - 0.05,
    },
    [DRIVING_CAMERA_MODES.AERIAL]: {
      id: 'aerial',
      label: 'AERIAL',
      desc: 'Circuit Skyway Overview',
      fixedPos: [60, 260, 40],
      fixedTarget: [60, 0, 40],
      baseFov: 55.0,
    },
    [DRIVING_CAMERA_MODES.TURN1]: {
      id: 'turn1',
      label: 'TURN 1',
      desc: 'North Sweeper Trackside Apex',
      fixedPos: [45, 8, 205],
      fixedTarget: [80, 0, 242],
      baseFov: 45.0,
      trackVehicle: true,
    },
    [DRIVING_CAMERA_MODES.HAIRPIN]: {
      id: 'hairpin',
      label: 'HAIRPIN',
      desc: 'South Hairpin Apex View',
      fixedPos: [30, 7, -145],
      fixedTarget: [10, 0, -175],
      baseFov: 45.0,
      trackVehicle: true,
    },
  },

  // General follow camera parameters
  referenceTopSpeedMs: 45.0, // 162 km/h normalized top speed
  minCameraElevation: 0.25,  // Minimum height above local ground to prevent clipping
};
