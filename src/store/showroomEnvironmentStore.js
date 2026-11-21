import { create } from 'zustand';
import {
  SHOWROOM_ENVIRONMENTS,
  ENVIRONMENT_IDS,
  DEFAULT_ENVIRONMENT_ID,
  getEnvironmentConfig,
} from '../utils/showroomEnvironmentRegistry.js';
import { useLightingStore } from './lightingStore.js';

export const useShowroomEnvironmentStore = create((set, get) => ({
  // Active environment identifier
  activeEnvironmentId: DEFAULT_ENVIRONMENT_ID,

  // User calibration multipliers
  exposureMultiplier: 1.0, // 0.7x to 1.4x
  reflectionMultiplier: 1.0, // 0.2x to 2.0x
  shadowMultiplier: 1.0, // 0.3x to 1.5x

  // Transition smoothing state
  isTransitioning: false,

  // ─── Actions ───

  setEnvironment: (envId) => {
    if (!SHOWROOM_ENVIRONMENTS[envId]) return;
    set({
      activeEnvironmentId: envId,
      isTransitioning: true,
    });

    // Synchronize legacy lightingStore for backward compatibility with Part 7 tests
    try {
      const mapping = {
        premium_studio: 'studio',
        luxury_showroom: 'soft',
        outdoor_daylight: 'studio',
        cinematic_stage: 'dramatic',
      };
      const legacyId = mapping[envId] || 'studio';
      useLightingStore.getState().setLightingPreset(legacyId);
    } catch (_) {}

    // Clear transition flag after smooth interpolation
    setTimeout(() => {
      set({ isTransitioning: false });
    }, 600);
  },

  setExposureMultiplier: (val) => {
    const clamped = Math.max(0.7, Math.min(1.4, Number(val) || 1.0));
    set({ exposureMultiplier: clamped });
  },

  setReflectionMultiplier: (val) => {
    const clamped = Math.max(0.2, Math.min(2.0, Number(val) || 1.0));
    set({ reflectionMultiplier: clamped });
  },

  setShadowMultiplier: (val) => {
    const clamped = Math.max(0.3, Math.min(1.5, Number(val) || 1.0));
    set({ shadowMultiplier: clamped });
  },

  resetMultipliers: () => {
    set({
      exposureMultiplier: 1.0,
      reflectionMultiplier: 1.0,
      shadowMultiplier: 1.0,
    });
  },

  resetEnvironment: () => {
    set({
      activeEnvironmentId: DEFAULT_ENVIRONMENT_ID,
      exposureMultiplier: 1.0,
      reflectionMultiplier: 1.0,
      shadowMultiplier: 1.0,
      isTransitioning: false,
    });
    try {
      useLightingStore.getState().setLightingPreset('studio');
    } catch (_) {}
  },

  // Helper accessor for active environment configuration
  getConfig: () => getEnvironmentConfig(get().activeEnvironmentId),
}));

// Expose globally in browser window for automated verification
if (typeof window !== 'undefined') {
  window.__showroomEnvironmentStore = useShowroomEnvironmentStore;
}
