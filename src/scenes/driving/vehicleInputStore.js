import { create } from 'zustand';
import { INPUT_SOURCE, CONTROLLER_ACTION } from '../../services/controller/controllerTypes.js';

export { INPUT_SOURCE, CONTROLLER_ACTION };

/**
 * Vehicle Input State & Transmission Gears — Part 34 (Unified Multi-Source Input Architecture)
 *
 * Dedicated abstraction layer decoupling physical vehicle controls from raw hardware inputs.
 * Accepts normalized floating-point controls:
 * - throttle: [0.0, 1.0]
 * - brake: [0.0, 1.0]
 * - steer: [-1.0, 1.0] (left = -1.0, right = +1.0)
 * - handbrake: boolean
 * - reverse: boolean
 * - gear: 'D' | 'R' | 'N'
 *
 * Multi-Source Input Arbitration:
 * - Supports Keyboard, Smartphone controller, and future Gamepads.
 * - Single-active-controller ownership model: only the active source drives continuous movement.
 * - Disconnecting the active smartphone controller safely returns control to the desktop keyboard
 *   with zero stuck inputs.
 * - One-time discrete actions (Camera switch, Emergency Reset, Pause) are separated from continuous
 *   inputs and remain accessible to the desktop operator.
 */

export const VEHICLE_GEAR = {
  DRIVE: 'D',
  REVERSE: 'R',
  NEUTRAL: 'N',
};

export const useVehicleInputStore = create((set, get) => ({
  // ─── Input Arbitration State ───
  activeSource: INPUT_SOURCE.KEYBOARD, // 'keyboard' | 'smartphone' | 'gamepad'
  activeDeviceId: null,                // e.g. 'phone-session-1234'
  lastHeartbeat: Date.now(),

  // ─── Normalized Continuous Inputs ───
  throttle: 0.0,  // 0.0 to 1.0
  brake: 0.0,     // 0.0 to 1.0
  steer: 0.0,     // -1.0 (full left) to +1.0 (full right)
  handbrake: false,
  gear: VEHICLE_GEAR.DRIVE,

  // Discrete intent flags for HUD / animation telemetry
  isAccelerating: false,
  isBraking: false,
  isReversing: false,

  // ─── Source Arbitration Actions ───

  /**
   * Set the active input source with automatic neutral input reset
   * to guarantee zero stuck throttle/brake/steering values during handover.
   */
  setActiveSource: (source, deviceId = null) => {
    if (Object.values(INPUT_SOURCE).includes(source)) {
      set({
        activeSource: source,
        activeDeviceId: deviceId,
        // Neutralize continuous inputs on handover
        throttle: 0.0,
        brake: 0.0,
        steer: 0.0,
        handbrake: false,
        gear: VEHICLE_GEAR.DRIVE,
        isAccelerating: false,
        isBraking: false,
        isReversing: false,
        lastHeartbeat: Date.now(),
      });
    }
  },

  /**
   * Neutralize a controller's inputs and safely revert control back to Keyboard.
   */
  neutralizeController: (source = INPUT_SOURCE.SMARTPHONE) => {
    const current = get();
    if (current.activeSource === source) {
      set({
        activeSource: INPUT_SOURCE.KEYBOARD,
        activeDeviceId: null,
        throttle: 0.0,
        brake: 0.0,
        steer: 0.0,
        handbrake: false,
        gear: VEHICLE_GEAR.DRIVE,
        isAccelerating: false,
        isBraking: false,
        isReversing: false,
      });
    }
  },

  /**
   * Update heartbeat timestamp for the active controller.
   */
  updateHeartbeat: () => {
    set({ lastHeartbeat: Date.now() });
  },

  // ─── Continuous Input Injection ───

  setThrottle: (val, source = INPUT_SOURCE.KEYBOARD) => {
    const { activeSource } = get();
    if (source !== activeSource) return;

    const clamped = Math.max(0, Math.min(1, Number(val) || 0));
    set({
      throttle: clamped,
      isAccelerating: clamped > 0.01,
      lastHeartbeat: Date.now(),
    });
  },

  setBrake: (val, source = INPUT_SOURCE.KEYBOARD) => {
    const { activeSource } = get();
    if (source !== activeSource) return;

    const clamped = Math.max(0, Math.min(1, Number(val) || 0));
    set({
      brake: clamped,
      isBraking: clamped > 0.01,
      lastHeartbeat: Date.now(),
    });
  },

  setSteer: (val, source = INPUT_SOURCE.KEYBOARD) => {
    const { activeSource } = get();
    if (source !== activeSource) return;

    const clamped = Math.max(-1, Math.min(1, Number(val) || 0));
    set({ steer: clamped, lastHeartbeat: Date.now() });
  },

  setGear: (gear, source = INPUT_SOURCE.KEYBOARD) => {
    const { activeSource } = get();
    if (source !== activeSource) return;

    if (Object.values(VEHICLE_GEAR).includes(gear)) {
      set({
        gear,
        isReversing: gear === VEHICLE_GEAR.REVERSE,
        lastHeartbeat: Date.now(),
      });
    }
  },

  setHandbrake: (val, source = INPUT_SOURCE.KEYBOARD) => {
    const { activeSource } = get();
    if (source !== activeSource) return;

    set({ handbrake: Boolean(val), lastHeartbeat: Date.now() });
  },

  /**
   * Primary continuous input updater with source arbitration.
   */
  setInputs: (inputs, source = INPUT_SOURCE.KEYBOARD) => {
    const { activeSource } = get();

    // Arbitration check: if a smartphone is actively driving, reject keyboard driving inputs
    if (source !== activeSource) {
      return;
    }

    set((state) => {
      const next = { ...state };

      if (inputs.throttle !== undefined) {
        next.throttle = Math.max(0, Math.min(1, Number(inputs.throttle) || 0));
        next.isAccelerating = next.throttle > 0.01;
      }
      if (inputs.brake !== undefined) {
        next.brake = Math.max(0, Math.min(1, Number(inputs.brake) || 0));
        next.isBraking = next.brake > 0.01;
      }
      if (inputs.steer !== undefined || inputs.steering !== undefined) {
        const steerVal = inputs.steer !== undefined ? inputs.steer : inputs.steering;
        next.steer = Math.max(-1, Math.min(1, Number(steerVal) || 0));
      }
      if (inputs.gear !== undefined && Object.values(VEHICLE_GEAR).includes(inputs.gear)) {
        next.gear = inputs.gear;
        next.isReversing = inputs.gear === VEHICLE_GEAR.REVERSE;
      } else if (inputs.reverse !== undefined) {
        // Boolean reverse flag compatibility
        next.gear = inputs.reverse ? VEHICLE_GEAR.REVERSE : VEHICLE_GEAR.DRIVE;
        next.isReversing = Boolean(inputs.reverse);
      }
      if (inputs.handbrake !== undefined) {
        next.handbrake = Boolean(inputs.handbrake);
      }

      next.lastHeartbeat = Date.now();
      return next;
    });
  },

  // ─── Discrete Action Dispatcher ───

  /**
   * Dispatches one-time discrete actions (Camera, Reset, Pause).
   * Unlike continuous driving inputs, discrete actions from any authenticated
   * source are honored for operator safety.
   */
  dispatchAction: (action, source = INPUT_SOURCE.KEYBOARD) => {
    if (!action) return;

    // Dispatches to global stores if in browser environment
    if (typeof window !== 'undefined') {
      if (action === CONTROLLER_ACTION.CAMERA) {
        window.__appModeStore?.getState()?.cycleDrivingView?.();
      } else if (action === CONTROLLER_ACTION.RESET) {
        window.__vehiclePhysicsStore?.getState()?.requestReset?.();
      } else if (action === CONTROLLER_ACTION.PAUSE) {
        window.__vehiclePhysicsStore?.getState()?.togglePause?.();
      }
    }
  },

  /**
   * Master zeroing of all continuous inputs.
   */
  resetInputs: () => {
    set({
      throttle: 0.0,
      brake: 0.0,
      steer: 0.0,
      handbrake: false,
      gear: VEHICLE_GEAR.DRIVE,
      isAccelerating: false,
      isBraking: false,
      isReversing: false,
      lastHeartbeat: Date.now(),
    });
  },
}));

// Expose store globally for automated test harnesses and diagnostics
if (typeof window !== 'undefined') {
  window.__vehicleInputStore = useVehicleInputStore;
}
