import { create } from 'zustand';
import { PAINT_COLOR_PRESETS, PAINT_FINISH_TYPES } from '../materials/paintPresets.js';

export const usePaintStore = create((set, get) => {
  const initialPreset = PAINT_COLOR_PRESETS[0]; // factory_original
  const initialFinish = PAINT_FINISH_TYPES[initialPreset.finish] || PAINT_FINISH_TYPES.metallic;

  return {
    // Current active selection
    activePresetId: initialPreset.id,
    activeFinish: initialPreset.finish,
    primaryColor: initialPreset.primaryColor,
    secondaryColor: initialPreset.secondaryColor,
    isFactory: true,
    customColor: '#9333EA',

    // Material parameters (normalized serializable representation)
    materialParameters: {
      metalness: initialFinish.metalness,
      roughness: initialFinish.roughness,
      clearcoat: initialFinish.clearcoat,
      clearcoatRoughness: initialFinish.clearcoatRoughness,
      reflectivity: initialFinish.reflectivity,
      ior: initialFinish.ior,
      iridescence: initialFinish.iridescence,
      envMapIntensity: initialFinish.envMapIntensity,
    },

    // 1. Select a curated paint preset
    applyPreset: (presetId) => {
      const preset = PAINT_COLOR_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;

      const finishConfig = PAINT_FINISH_TYPES[preset.finish] || PAINT_FINISH_TYPES.metallic;

      set({
        activePresetId: preset.id,
        activeFinish: preset.finish,
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        isFactory: Boolean(preset.isFactory),
        materialParameters: {
          metalness: finishConfig.metalness,
          roughness: finishConfig.roughness,
          clearcoat: finishConfig.clearcoat,
          clearcoatRoughness: finishConfig.clearcoatRoughness,
          reflectivity: finishConfig.reflectivity,
          ior: finishConfig.ior,
          iridescence: finishConfig.iridescence,
          envMapIntensity: finishConfig.envMapIntensity,
        },
      });
    },

    // 2. Switch finish category (Solid, Metallic, Pearl, Matte, Satin, Gloss)
    setFinish: (finishId) => {
      const finishConfig = PAINT_FINISH_TYPES[finishId];
      if (!finishConfig) return;

      set((state) => ({
        activeFinish: finishId,
        isFactory: false,
        materialParameters: {
          ...state.materialParameters,
          metalness: finishConfig.metalness,
          roughness: finishConfig.roughness,
          clearcoat: finishConfig.clearcoat,
          clearcoatRoughness: finishConfig.clearcoatRoughness,
          reflectivity: finishConfig.reflectivity,
          ior: finishConfig.ior,
          iridescence: finishConfig.iridescence,
          envMapIntensity: finishConfig.envMapIntensity,
        },
      }));
    },

    // 3. Set custom primary color
    setCustomColor: (hexColor) => {
      set((state) => ({
        activePresetId: 'custom',
        isFactory: false,
        customColor: hexColor,
        primaryColor: hexColor,
      }));
    },

    // 4. Fine-tune individual material parameter
    setMaterialParameter: (key, value) => {
      set((state) => ({
        isFactory: false,
        materialParameters: {
          ...state.materialParameters,
          [key]: typeof value === 'number' ? Math.max(0, Math.min(2.0, value)) : value,
        },
      }));
    },

    // 5. Reset to original factory paint
    resetToFactory: () => {
      const factory = PAINT_COLOR_PRESETS.find((p) => p.id === 'factory_original');
      const finishConfig = PAINT_FINISH_TYPES.metallic;

      set({
        activePresetId: factory.id,
        activeFinish: factory.finish,
        primaryColor: factory.primaryColor,
        secondaryColor: factory.secondaryColor,
        isFactory: true,
        materialParameters: {
          metalness: finishConfig.metalness,
          roughness: finishConfig.roughness,
          clearcoat: finishConfig.clearcoat,
          clearcoatRoughness: finishConfig.clearcoatRoughness,
          reflectivity: finishConfig.reflectivity,
          ior: finishConfig.ior,
          iridescence: finishConfig.iridescence,
          envMapIntensity: finishConfig.envMapIntensity,
        },
      });
    },

    // 6. Query current full paint configuration
    getPaintConfig: () => {
      const state = get();
      return {
        presetId: state.activePresetId,
        finish: state.activeFinish,
        primaryColor: state.primaryColor,
        secondaryColor: state.secondaryColor,
        isFactory: state.isFactory,
        materialParameters: { ...state.materialParameters },
      };
    },
  };
});

// Expose store globally for test instrumentation and browser automation
if (typeof window !== 'undefined') {
  window.__paintStore = usePaintStore;
}

