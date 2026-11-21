import { create } from 'zustand';

/**
 * Zustand store for Part 10 secondary material state.
 *
 * Rules:
 *  - Only serializable values (strings, booleans, numbers) stored here.
 *  - Three.js objects (materials, textures) live exclusively in SecondaryMaterialEngine.
 *  - Fully independent from paintStore (Part 9).
 */
export const useSecondaryMaterialStore = create((set, get) => ({
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /** Active glass profile id: 'factory' | 'dark' | 'clear' */
  glassProfile: 'factory',

  /** Active chrome profile id: 'chrome' | 'brushed' | 'dark_metal' */
  chromeProfile: 'chrome',

  /** Active rubber profile id: 'factory' | 'worn' | 'racing' */
  rubberProfile: 'factory',

  /** Active plastic profile id: 'black_matte' | 'dark_soft' | 'panel_cladding' | 'gloss_black' */
  plasticProfile: 'black_matte',

  /** Light toggle states */
  headlightsOn: false,
  taillightsOn: false,
  indicatorsOn: false,
  brakeLightsOn: false,

  /** true when no secondary overrides are active (all factory materials) */
  isFactorySecondary: true,

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  setGlassProfile: (profileId) =>
    set({ glassProfile: profileId, isFactorySecondary: false }),

  setChromeProfile: (profileId) =>
    set({ chromeProfile: profileId, isFactorySecondary: false }),

  setRubberProfile: (profileId) =>
    set({ rubberProfile: profileId, isFactorySecondary: false }),

  setPlasticProfile: (profileId) =>
    set({ plasticProfile: profileId, isFactorySecondary: false }),

  setHeadlights: (isOn) =>
    set({ headlightsOn: isOn, isFactorySecondary: false }),

  setTaillights: (isOn) =>
    set({ taillightsOn: isOn, isFactorySecondary: false }),

  setIndicators: (isOn) =>
    set({ indicatorsOn: isOn, isFactorySecondary: false }),

  setBrakeLights: (isOn) =>
    set({ brakeLightsOn: isOn, isFactorySecondary: false }),

  /**
   * Resets all secondary material state to factory defaults.
   * Engine restoration is triggered reactively through hook effects.
   */
  resetAllSecondary: () =>
    set({
      glassProfile: 'factory',
      chromeProfile: 'chrome',
      rubberProfile: 'factory',
      plasticProfile: 'black_matte',
      headlightsOn: false,
      taillightsOn: false,
      indicatorsOn: false,
      brakeLightsOn: false,
      isFactorySecondary: true,
    }),

  /** Alias matching factory reset convention across paint and wheel stores */
  resetToFactory: () => get().resetAllSecondary(),

  /**
   * Returns a snapshot of all current secondary material settings.
   */
  getSecondaryConfig: () => {
    const s = get();
    return {
      glass: s.glassProfile,
      chrome: s.chromeProfile,
      rubber: s.rubberProfile,
      plastic: s.plasticProfile,
      lights: {
        headlights: s.headlightsOn,
        taillights: s.taillightsOn,
        indicators: s.indicatorsOn,
        brakeLights: s.brakeLightsOn,
      },
      isFactorySecondary: s.isFactorySecondary,
    };
  },
}));

// Expose store globally for test instrumentation and browser automation
if (typeof window !== 'undefined') {
  window.__secondaryMaterialStore = useSecondaryMaterialStore;
}

