import { create } from 'zustand';
import {
  HEADLIGHT_MODES,
  TAILLIGHT_MODES,
  BRAKE_MODES,
  INDICATOR_MODES,
} from '../utils/vehicleLightingRegistry.js';
import { useSecondaryMaterialStore } from './secondaryMaterialStore.js';

export const useVehicleLightingStore = create((set, get) => ({
  // ─── Core Lighting States ───
  headlightMode: HEADLIGHT_MODES.OFF, // 'off' | 'parking' | 'low_beam' | 'high_beam'
  taillightMode: TAILLIGHT_MODES.OFF, // 'off' | 'running'
  brakeMode: BRAKE_MODES.OFF, // 'off' | 'active'
  indicatorMode: INDICATOR_MODES.OFF, // 'off' | 'left' | 'right' | 'hazard'

  // Blinker clock synchronization
  isBlinking: false,
  blinkPhase: true, // true = ON phase, false = OFF phase

  // Real Three.js light sources toggle (for performance scaling if needed)
  realLightsEnabled: true,

  // ─── Actions: Headlights & DRL ───

  setHeadlightMode: (mode) => {
    if (!Object.values(HEADLIGHT_MODES).includes(mode)) return;

    // Automatic electrical logic:
    // When parking lights, low beam, or high beam are active, rear running lights automatically activate!
    const isLit = mode !== HEADLIGHT_MODES.OFF;
    const nextTaillight = isLit ? TAILLIGHT_MODES.RUNNING : TAILLIGHT_MODES.OFF;

    set({
      headlightMode: mode,
      taillightMode: nextTaillight,
    });

    // Synchronize legacy secondaryMaterialStore for backward compatibility
    try {
      useSecondaryMaterialStore.getState().setHeadlights(isLit);
      useSecondaryMaterialStore.getState().setTaillights(isLit || get().brakeMode === BRAKE_MODES.ACTIVE);
    } catch (_) {}
  },

  cycleHeadlightMode: () => {
    const { headlightMode, setHeadlightMode } = get();
    if (headlightMode === HEADLIGHT_MODES.OFF) {
      setHeadlightMode(HEADLIGHT_MODES.PARKING);
    } else if (headlightMode === HEADLIGHT_MODES.PARKING) {
      setHeadlightMode(HEADLIGHT_MODES.LOW_BEAM);
    } else if (headlightMode === HEADLIGHT_MODES.LOW_BEAM) {
      setHeadlightMode(HEADLIGHT_MODES.HIGH_BEAM);
    } else {
      setHeadlightMode(HEADLIGHT_MODES.OFF);
    }
  },

  toggleParkingLights: () => {
    const { headlightMode, setHeadlightMode } = get();
    setHeadlightMode(
      headlightMode === HEADLIGHT_MODES.PARKING
        ? HEADLIGHT_MODES.OFF
        : HEADLIGHT_MODES.PARKING
    );
  },

  toggleLowBeam: () => {
    const { headlightMode, setHeadlightMode } = get();
    setHeadlightMode(
      headlightMode === HEADLIGHT_MODES.LOW_BEAM
        ? HEADLIGHT_MODES.OFF
        : HEADLIGHT_MODES.LOW_BEAM
    );
  },

  toggleHighBeam: () => {
    const { headlightMode, setHeadlightMode } = get();
    setHeadlightMode(
      headlightMode === HEADLIGHT_MODES.HIGH_BEAM
        ? HEADLIGHT_MODES.LOW_BEAM
        : HEADLIGHT_MODES.HIGH_BEAM
    );
  },

  // ─── Actions: Brake Lights ───

  setBrakeMode: (mode) => {
    if (!Object.values(BRAKE_MODES).includes(mode)) return;
    set({ brakeMode: mode });

    try {
      useSecondaryMaterialStore
        .getState()
        .setBrakeLights(mode === BRAKE_MODES.ACTIVE);
      if (mode === BRAKE_MODES.ACTIVE) {
        useSecondaryMaterialStore.getState().setTaillights(true);
      } else {
        const isHeadlightLit = get().headlightMode !== HEADLIGHT_MODES.OFF;
        useSecondaryMaterialStore.getState().setTaillights(isHeadlightLit);
      }
    } catch (_) {}
  },

  toggleBrakeLights: () => {
    const { brakeMode, setBrakeMode } = get();
    setBrakeMode(
      brakeMode === BRAKE_MODES.ACTIVE
        ? BRAKE_MODES.OFF
        : BRAKE_MODES.ACTIVE
    );
  },

  pressBrake: () => get().setBrakeMode(BRAKE_MODES.ACTIVE),

  releaseBrake: () => get().setBrakeMode(BRAKE_MODES.OFF),

  // ─── Actions: Indicators & Hazard Warning ───

  setIndicatorMode: (mode) => {
    if (!Object.values(INDICATOR_MODES).includes(mode)) return;
    const isBlinking = mode !== INDICATOR_MODES.OFF;
    set({
      indicatorMode: mode,
      isBlinking,
      blinkPhase: true, // Reset blink phase to start immediately visible
    });

    try {
      useSecondaryMaterialStore.getState().setIndicators(isBlinking);
    } catch (_) {}
  },

  toggleLeftIndicator: () => {
    const { indicatorMode, setIndicatorMode } = get();
    setIndicatorMode(
      indicatorMode === INDICATOR_MODES.LEFT
        ? INDICATOR_MODES.OFF
        : INDICATOR_MODES.LEFT
    );
  },

  toggleRightIndicator: () => {
    const { indicatorMode, setIndicatorMode } = get();
    setIndicatorMode(
      indicatorMode === INDICATOR_MODES.RIGHT
        ? INDICATOR_MODES.OFF
        : INDICATOR_MODES.RIGHT
    );
  },

  toggleHazard: () => {
    const { indicatorMode, setIndicatorMode } = get();
    setIndicatorMode(
      indicatorMode === INDICATOR_MODES.HAZARD
        ? INDICATOR_MODES.OFF
        : INDICATOR_MODES.HAZARD
    );
  },

  setBlinkPhase: (phase) => set({ blinkPhase: Boolean(phase) }),

  // ─── Actions: Real Light Sources Toggle ───

  setRealLightsEnabled: (enabled) => set({ realLightsEnabled: Boolean(enabled) }),

  // ─── Actions: Master Reset / All Off ───

  allLightsOff: () => {
    set({
      headlightMode: HEADLIGHT_MODES.OFF,
      taillightMode: TAILLIGHT_MODES.OFF,
      brakeMode: BRAKE_MODES.OFF,
      indicatorMode: INDICATOR_MODES.OFF,
      isBlinking: false,
      blinkPhase: false,
    });

    try {
      useSecondaryMaterialStore.getState().setHeadlights(false);
      useSecondaryMaterialStore.getState().setTaillights(false);
      useSecondaryMaterialStore.getState().setBrakeLights(false);
      useSecondaryMaterialStore.getState().setIndicators(false);
    } catch (_) {}
  },

  resetLighting: () => get().allLightsOff(),
}));

// Expose globally in browser window for automated verification and telemetry
if (typeof window !== 'undefined') {
  window.__vehicleLightingStore = useVehicleLightingStore;
}
