/**
 * Canonical Showroom Environment Registry
 *
 * Defines four genuinely distinct automotive presentation environments:
 * 1. Premium Studio: Clean commercial automotive studio with neutral background and softbox highlights.
 * 2. Luxury Showroom: High-end architectural gallery with warm champagne spotlights and mirror-gloss floor.
 * 3. Outdoor Daylight: Natural sunny exterior presentation with procedural sky dome and open asphalt tarmac.
 * 4. Cinematic Stage: High-contrast commercial photography stage with electric cyan and violet dual rim lights.
 */

export const SHOWROOM_ENVIRONMENTS = {
  premium_studio: {
    id: 'premium_studio',
    name: 'Premium Studio',
    category: 'Studio',
    badge: 'STUDIO',
    themeColor: '#00F0FF',
    subtitle: 'Balanced commercial automotive studio with neutral background and softbox highlights',
    description: 'Clean architectural light-tent with neutral grey vignette, balanced contrast, and realistic satin floor reflections.',
    bgColor: '#0B0E14',
    hdrFile: '/environments/studio_small_08_1k.hdr',
    envIntensity: 0.9,
    envRotation: [0, -Math.PI / 4, 0],
    hasSky: false,
    exposure: 1.05,
    lighting: {
      keyColor: '#FFFFFF',
      keyIntensity: 2.2,
      keyPosition: [5.5, 7.5, 5.0],
      fillColor: '#94A3B8',
      fillIntensity: 0.85,
      fillPosition: [-6.0, 4.5, -4.5],
      rimColor: '#A5F3FC',
      rimIntensity: 1.4,
      rimPosition: [4.5, 5.0, -6.5],
      ambientColor: '#F1F5F9',
      ambientIntensity: 0.35,
      overheadIntensity: 1.0,
      frontIntensity: 0.65,
      rearIntensity: 0.65,
    },
    floor: {
      color: '#0E1218',
      roughness: 0.45,
      metalness: 0.25,
      envMapIntensity: 0.75,
      radius: 14,
      contactShadowOpacity: 0.8,
    },
  },

  luxury_showroom: {
    id: 'luxury_showroom',
    name: 'Luxury Showroom',
    category: 'Interior',
    badge: 'LUXURY',
    themeColor: '#FFD700',
    subtitle: 'High-end architectural gallery with warm champagne spotlights and mirror-gloss floor',
    description: 'Warm boutique interior featuring golden ceiling downlights, rich dark background, and high-gloss polished marble floor.',
    bgColor: '#100E14',
    hdrFile: '/environments/studio_small_08_1k.hdr',
    envIntensity: 1.2,
    envRotation: [0, 0, 0],
    hasSky: false,
    exposure: 1.1,
    lighting: {
      keyColor: '#FFF8F0',
      keyIntensity: 2.5,
      keyPosition: [6.0, 8.0, 4.0],
      fillColor: '#D8C4B6',
      fillIntensity: 1.1,
      fillPosition: [-5.5, 5.0, -4.0],
      rimColor: '#FFE8D6',
      rimIntensity: 1.8,
      rimPosition: [4.5, 5.0, -6.5],
      ambientColor: '#FDF6EE',
      ambientIntensity: 0.45,
      overheadIntensity: 1.3,
      frontIntensity: 0.8,
      rearIntensity: 0.75,
    },
    floor: {
      color: '#121116',
      roughness: 0.12, // High-gloss polished finish
      metalness: 0.35,
      envMapIntensity: 1.8,
      radius: 16,
      contactShadowOpacity: 0.7,
    },
  },

  outdoor_daylight: {
    id: 'outdoor_daylight',
    name: 'Outdoor Daylight',
    category: 'Exterior',
    badge: 'OUTDOOR',
    themeColor: '#48DBFB',
    subtitle: 'Natural sunny exterior presentation with procedural sky dome and open asphalt tarmac',
    description: 'Open sky environment with clear atmospheric scattering, direct warm sunlight, and wide textured asphalt ground.',
    bgColor: '#7EB6E8',
    hdrFile: '/environments/studio_small_08_1k.hdr',
    envIntensity: 1.1,
    envRotation: [0, Math.PI / 3, 0],
    hasSky: true,
    skyParams: {
      sunPosition: [12, 18, 12],
      turbidity: 6,
      rayleigh: 2.5,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8,
    },
    exposure: 0.98,
    lighting: {
      keyColor: '#FFF9E6', // Direct sunlight
      keyIntensity: 3.2,
      keyPosition: [12.0, 18.0, 12.0],
      fillColor: '#B8D5E5', // Sky bounce fill
      fillIntensity: 1.2,
      fillPosition: [-8.0, 6.0, -8.0],
      rimColor: '#FFFFFF',
      rimIntensity: 1.0,
      rimPosition: [5.0, 5.0, -7.0],
      ambientColor: '#DCEAF5',
      ambientIntensity: 0.6,
      overheadIntensity: 0.8,
      frontIntensity: 0.5,
      rearIntensity: 0.5,
    },
    floor: {
      color: '#25282F', // Matte asphalt tarmac
      roughness: 0.88,
      metalness: 0.05,
      envMapIntensity: 0.35,
      radius: 25,
      contactShadowOpacity: 0.85,
    },
  },

  cinematic_stage: {
    id: 'cinematic_stage',
    name: 'Cinematic Stage',
    category: 'Stage',
    badge: 'CINEMATIC',
    themeColor: '#BD00FF',
    subtitle: 'High-contrast commercial photography stage with electric cyan and violet dual rim lights',
    description: 'Moody theatrical noir setting with deep obsidian backdrop, dual-tone contour lighting, and wet reflective ground.',
    bgColor: '#05070A',
    hdrFile: '/environments/studio_small_08_1k.hdr',
    envIntensity: 0.7,
    envRotation: [0, -Math.PI / 2, 0],
    hasSky: false,
    exposure: 1.15,
    lighting: {
      keyColor: '#FFFFFF',
      keyIntensity: 2.8,
      keyPosition: [4.5, 7.0, 5.5],
      fillColor: '#3B4252',
      fillIntensity: 0.35,
      fillPosition: [-5.0, 4.0, -4.0],
      rimColor: '#00F0FF', // Electric Cyan primary rim
      rimIntensity: 2.8,
      rimPosition: [4.5, 5.0, -6.5],
      secondaryRimColor: '#BD00FF', // Electric Violet secondary rim
      secondaryRimIntensity: 2.4,
      secondaryRimPosition: [-4.5, 5.0, -6.5],
      ambientColor: '#0F172A',
      ambientIntensity: 0.18,
      overheadIntensity: 0.5,
      frontIntensity: 0.4,
      rearIntensity: 0.45,
    },
    floor: {
      color: '#06080D',
      roughness: 0.1, // Wet obsidian mirror reflection
      metalness: 0.65,
      envMapIntensity: 2.2,
      radius: 14,
      contactShadowOpacity: 0.95,
    },
  },
};

export const ENVIRONMENT_IDS = Object.keys(SHOWROOM_ENVIRONMENTS);

export const DEFAULT_ENVIRONMENT_ID = 'premium_studio';

/**
 * Get configuration for an environment ID
 */
export function getEnvironmentConfig(envId) {
  return SHOWROOM_ENVIRONMENTS[envId] || SHOWROOM_ENVIRONMENTS[DEFAULT_ENVIRONMENT_ID];
}
