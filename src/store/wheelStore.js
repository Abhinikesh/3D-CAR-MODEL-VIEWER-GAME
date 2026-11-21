import { create } from 'zustand';
import { WHEEL_TARGET_MODES } from '../materials/wheelPresets.js';

export const useWheelStore = create((set, get) => ({
  // Targeting
  targetMode: WHEEL_TARGET_MODES.ALL, // 'all' | 'front_rear' | 'individual'
  selectedWheel: 'fl', // 'fl' | 'fr' | 'rl' | 'rr' (for individual mode)

  // Rim finish states per wheel position
  rimFinishes: {
    fl: { preset: 'factory', customColor: '#DCE0E6' },
    fr: { preset: 'factory', customColor: '#DCE0E6' },
    rl: { preset: 'factory', customColor: '#DCE0E6' },
    rr: { preset: 'factory', customColor: '#DCE0E6' },
  },

  // Primary active preset (convenience accessor for UI)
  activePresetId: 'factory',
  customRimColor: '#DCE0E6',

  // Brake Caliper state
  caliperPreset: 'factory',
  customCaliperColor: '#FFC800',

  // Factory flag
  isFactoryWheels: true,

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  setTargetMode: (mode) => set({ targetMode: mode }),

  setSelectedWheel: (wheelKey) => set({ selectedWheel: wheelKey }),

  /**
   * Sets rim finish preset according to the target parameter or active targetMode.
   *
   * @param {string} presetId - Preset id from RIM_FINISH_PRESETS
   * @param {string} [target] - 'all' | 'front' | 'rear' | 'fl' | 'fr' | 'rl' | 'rr'
   */
  setRimFinish: (presetId, target) => {
    const { targetMode, selectedWheel, rimFinishes } = get();
    const effectiveTarget = target || (targetMode === WHEEL_TARGET_MODES.INDIVIDUAL ? selectedWheel : targetMode);

    const updated = { ...rimFinishes };

    if (effectiveTarget === 'all' || effectiveTarget === WHEEL_TARGET_MODES.ALL) {
      ['fl', 'fr', 'rl', 'rr'].forEach((k) => {
        updated[k] = { ...updated[k], preset: presetId };
      });
    } else if (effectiveTarget === 'front') {
      ['fl', 'fr'].forEach((k) => {
        updated[k] = { ...updated[k], preset: presetId };
      });
    } else if (effectiveTarget === 'rear') {
      ['rl', 'rr'].forEach((k) => {
        updated[k] = { ...updated[k], preset: presetId };
      });
    } else if (['fl', 'fr', 'rl', 'rr'].includes(effectiveTarget)) {
      updated[effectiveTarget] = { ...updated[effectiveTarget], preset: presetId };
    }

    set({
      rimFinishes: updated,
      activePresetId: presetId,
      isFactoryWheels: false,
    });
  },

  /**
   * Sets custom rim color for the targeted wheels.
   */
  setCustomRimColor: (colorHex, target) => {
    const { targetMode, selectedWheel, rimFinishes } = get();
    const effectiveTarget = target || (targetMode === WHEEL_TARGET_MODES.INDIVIDUAL ? selectedWheel : targetMode);

    const updated = { ...rimFinishes };

    if (effectiveTarget === 'all' || effectiveTarget === WHEEL_TARGET_MODES.ALL) {
      ['fl', 'fr', 'rl', 'rr'].forEach((k) => {
        updated[k] = { preset: 'custom', customColor: colorHex };
      });
    } else if (effectiveTarget === 'front') {
      ['fl', 'fr'].forEach((k) => {
        updated[k] = { preset: 'custom', customColor: colorHex };
      });
    } else if (effectiveTarget === 'rear') {
      ['rl', 'rr'].forEach((k) => {
        updated[k] = { preset: 'custom', customColor: colorHex };
      });
    } else if (['fl', 'fr', 'rl', 'rr'].includes(effectiveTarget)) {
      updated[effectiveTarget] = { preset: 'custom', customColor: colorHex };
    }

    set({
      rimFinishes: updated,
      activePresetId: 'custom',
      customRimColor: colorHex,
      isFactoryWheels: false,
    });
  },

  setCaliperPreset: (presetId) =>
    set({
      caliperPreset: presetId,
      isFactoryWheels: false,
    }),

  setCustomCaliperColor: (colorHex) =>
    set({
      caliperPreset: 'custom',
      customCaliperColor: colorHex,
      isFactoryWheels: false,
    }),

  /**
   * Resets all four wheels and calipers to OEM factory materials.
   */
  resetWheelsToFactory: () =>
    set({
      targetMode: WHEEL_TARGET_MODES.ALL,
      selectedWheel: 'fl',
      rimFinishes: {
        fl: { preset: 'factory', customColor: '#DCE0E6' },
        fr: { preset: 'factory', customColor: '#DCE0E6' },
        rl: { preset: 'factory', customColor: '#DCE0E6' },
        rr: { preset: 'factory', customColor: '#DCE0E6' },
      },
      activePresetId: 'factory',
      customRimColor: '#DCE0E6',
      caliperPreset: 'factory',
      isFactoryWheels: true,
    }),

  getWheelConfig: () => {
    const s = get();
    return {
      targetMode: s.targetMode,
      selectedWheel: s.selectedWheel,
      rimFinishes: { ...s.rimFinishes },
      caliperPreset: s.caliperPreset,
      isFactoryWheels: s.isFactoryWheels,
    };
  },
}));

// Expose store globally for test instrumentation and browser automation
if (typeof window !== 'undefined') {
  window.__wheelStore = useWheelStore;
}

