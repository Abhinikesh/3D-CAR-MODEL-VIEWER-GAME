import { create } from 'zustand';
import {
  MAX_STEERING_ANGLE_RAD,
  SPIN_MODES,
  WHEEL_IDS,
  degToRad,
  radToDeg,
} from '../utils/wheelAnimationRegistry.js';

export const useWheelAnimationStore = create((set, get) => ({
  // ─── Wheel Spin (Roll) State ───
  isSpinning: false,
  spinDirection: 1, // 1 = forward, -1 = reverse
  spinSpeed: 1.0, // multiplier: 0.25x to 3.0x
  spinMode: SPIN_MODES.ALL, // 'all' | 'front' | 'rear' | 'individual'
  activeIndividualWheel: 'wheel_fl', // 'wheel_fl' | 'wheel_fr' | 'wheel_rl' | 'wheel_rr'

  // Accumulated roll angles per wheel in radians
  wheelRollAngles: {
    wheel_fl: 0,
    wheel_fr: 0,
    wheel_rl: 0,
    wheel_rr: 0,
  },

  // ─── Front-Wheel Steering State ───
  // Default matches the original glTF showcase pose (-30 deg right steer)
  currentSteeringAngle: (-30 * Math.PI) / 180,
  targetSteeringAngle: (-30 * Math.PI) / 180,
  steeringSpeed: 8.0, // Damped interpolation response factor
  isSteering: false,
  // Individual driving steer angles for Ackermann geometry in Driving Mode (FL and FR)
  drivingSteerAngles: null,
  // Complete physics-driven wheel transform package (roll, steering, suspension)
  drivingWheelTransforms: null,

  // ─── Actions: Wheel Spin ───
  startSpin: () => set({ isSpinning: true }),

  stopSpin: () => set({ isSpinning: false }),

  toggleSpin: () => set((state) => ({ isSpinning: !state.isSpinning })),

  reverseSpin: () => set((state) => ({ spinDirection: state.spinDirection === 1 ? -1 : 1 })),

  setSpinDirection: (dir) => set({ spinDirection: dir >= 0 ? 1 : -1 }),

  setSpinSpeed: (speed) => {
    const clamped = Math.max(0.25, Math.min(3.0, Number(speed) || 1.0));
    set({ spinSpeed: clamped });
  },

  setSpinMode: (mode) => {
    if (Object.values(SPIN_MODES).includes(mode)) {
      set({ spinMode: mode });
    }
  },

  setActiveIndividualWheel: (wheelId) => {
    if (WHEEL_IDS.includes(wheelId)) {
      set({ activeIndividualWheel: wheelId });
    }
  },

  updateWheelRollAngles: (newAngles) => {
    set((state) => ({
      wheelRollAngles: { ...state.wheelRollAngles, ...newAngles },
    }));
  },

  // ─── Actions: Front-Wheel Steering ───
  setTargetSteeringAngle: (rad) => {
    const clamped = Math.max(-MAX_STEERING_ANGLE_RAD, Math.min(MAX_STEERING_ANGLE_RAD, Number(rad) || 0));
    set({
      targetSteeringAngle: clamped,
      isSteering: Math.abs(clamped - get().currentSteeringAngle) > 0.001,
    });
  },

  setTargetSteeringAngleDeg: (deg) => {
    const rad = degToRad(Number(deg) || 0);
    get().setTargetSteeringAngle(rad);
  },

  steerLeft: () => {
    // Steer left: +30 degrees
    get().setTargetSteeringAngle(MAX_STEERING_ANGLE_RAD);
  },

  steerCenter: () => {
    // Steer neutral forward: 0 degrees
    get().setTargetSteeringAngle(0);
  },

  steerRight: () => {
    // Steer right: -30 degrees
    get().setTargetSteeringAngle(-MAX_STEERING_ANGLE_RAD);
  },

  setCurrentSteeringAngle: (rad) => {
    set({
      currentSteeringAngle: rad,
      isSteering: Math.abs(get().targetSteeringAngle - rad) > 0.001,
    });
  },

  /**
   * Sets individual driving steering angles for Ackermann geometry in Driving Mode.
   */
  setDrivingSteerAngles: (angles) => {
    if (!angles) {
      set({ drivingSteerAngles: null });
    } else {
      set({
        drivingSteerAngles: {
          wheel_fl: angles.wheel_fl ?? 0,
          wheel_fr: angles.wheel_fr ?? 0,
        },
        currentSteeringAngle: angles.centralSteer ?? 0,
        targetSteeringAngle: angles.centralSteer ?? 0,
      });
    }
  },

  /**
   * Authoritative driving wheel transforms package passed from physics simulation.
   * Synchronizes physics-driven wheel spin (based on travel distance and radius),
   * Ackermann front steering angles, and dynamic suspension deflection offsets.
   */
  setDrivingWheelTransforms: (transforms) => {
    if (!transforms) {
      set({
        drivingWheelTransforms: null,
        drivingSteerAngles: null,
      });
    } else {
      set({
        drivingWheelTransforms: transforms,
        drivingSteerAngles: transforms.steerAngles ?? null,
        currentSteeringAngle: transforms.centralSteer ?? 0,
        targetSteeringAngle: transforms.centralSteer ?? 0,
        wheelRollAngles: transforms.rollAngles ?? get().wheelRollAngles,
      });
    }
  },

  // ─── Actions: Reset & Restoration ───
  /**
   * Resets all wheel transforms to neutral showroom configuration:
   * Stops spin, centers front steering to 0°, resets roll angles to 0.
   */
  resetTransforms: () => {
    set({
      isSpinning: false,
      spinDirection: 1,
      targetSteeringAngle: 0,
      currentSteeringAngle: 0,
      isSteering: false,
      drivingSteerAngles: null,
      drivingWheelTransforms: null,
      wheelRollAngles: {
        wheel_fl: 0,
        wheel_fr: 0,
        wheel_rl: 0,
        wheel_rr: 0,
      },
    });
  },

  /**
   * Resets front wheels to original glTF showcase angle (-30° right steer)
   */
  resetToInitialAssetPose: () => {
    const initialSteer = (-30 * Math.PI) / 180;
    set({
      isSpinning: false,
      spinDirection: 1,
      targetSteeringAngle: initialSteer,
      currentSteeringAngle: initialSteer,
      isSteering: false,
      drivingSteerAngles: null,
      drivingWheelTransforms: null,
      wheelRollAngles: {
        wheel_fl: 0,
        wheel_fr: 0,
        wheel_rl: 0,
        wheel_rr: 0,
      },
    });
  },
}));

// Expose store globally in browser window for automated verification and telemetry
if (typeof window !== 'undefined') {
  window.__wheelAnimationStore = useWheelAnimationStore;
}
