import { create } from 'zustand';

/**
 * Automotive Studio Lighting Presets
 * Each preset configures balanced, physically sensible intensities and exposures
 * tailored for realistic vehicle visualization.
 */
export const LIGHTING_PRESETS = {
  'studio': {
    id: 'studio',
    label: 'Studio',
    description: 'Balanced commercial showroom lighting with crisp highlights',
    keyIntensity: 2.2,
    fillIntensity: 0.85,
    rimIntensity: 1.4,
    frontIntensity: 0.65,
    rearIntensity: 0.65,
    overheadIntensity: 1.0,
    ambientIntensity: 0.35,
    envIntensity: 0.85,
    exposure: 1.05,
    contactShadowOpacity: 0.8,
    keyColor: '#FFFFFF',
    fillColor: '#94A3B8',
    rimColor: '#A5F3FC',
  },
  'soft': {
    id: 'soft',
    label: 'Soft Studio',
    description: 'Diffused light tent with soft highlights and lifted shadow detail',
    keyIntensity: 1.4,
    fillIntensity: 1.35,
    rimIntensity: 0.9,
    frontIntensity: 0.85,
    rearIntensity: 0.85,
    overheadIntensity: 1.4,
    ambientIntensity: 0.5,
    envIntensity: 1.15,
    exposure: 1.0,
    contactShadowOpacity: 0.65,
    keyColor: '#F8FAFC',
    fillColor: '#CBD5E1',
    rimColor: '#E2E8F0',
  },
  'dramatic': {
    id: 'dramatic',
    label: 'Dramatic',
    description: 'High-contrast presentation emphasizing muscular body contours and shoulder curves',
    keyIntensity: 2.7,
    fillIntensity: 0.35,
    rimIntensity: 2.4,
    frontIntensity: 0.45,
    rearIntensity: 0.5,
    overheadIntensity: 0.6,
    ambientIntensity: 0.2,
    envIntensity: 0.55,
    exposure: 1.12,
    contactShadowOpacity: 0.95,
    keyColor: '#FFFFFF',
    fillColor: '#64748B',
    rimColor: '#66FCF1',
  },
};

export const useLightingStore = create((set, get) => ({
  activePreset: 'studio',

  // Select lighting preset
  setLightingPreset: (presetId) => {
    if (!LIGHTING_PRESETS[presetId]) return;
    set({ activePreset: presetId });
  },

  // Get current active preset configuration
  getConfig: () => {
    const { activePreset } = get();
    return LIGHTING_PRESETS[activePreset] || LIGHTING_PRESETS['studio'];
  },
}));
