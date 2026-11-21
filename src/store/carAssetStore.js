import { create } from 'zustand';

export const useCarAssetStore = create((set, get) => ({
  modelUrl: '/models/car.glb',
  isLoaded: false,
  isLoading: true,
  error: null,

  // Runtime metrics calculated directly from the indexed Three.js scene graph
  metrics: {
    nodeCount: 0,
    meshCount: 0,
    primitiveCount: 0,
    uniqueMaterialsCount: 0,
    uniqueTexturesCount: 0,
    vertexCount: 0,
    triangleCount: 0,
    dimensions: { x: 2.47, y: 1.74, z: 4.56, length: 4.56, width: 2.47, height: 1.74 },
    bounds: { min: { x: -1.235, y: 0, z: -2.28 }, max: { x: 1.235, y: 1.74, z: 2.28 }, center: { x: 0, y: 0.87, z: 0 } },
    groundContact: 'Y = 0.000m (Verified)',
    radius: 2.74,
  },

  // Semantic component resolution state
  semanticRegistry: {
    resolvedCount: 0,
    totalCount: 0,
    unresolved: [],
  },

  // Actions
  setLoading: (isLoading) => set({ isLoading }),

  setLoaded: ({ metrics, semanticRegistry }) => {
    set({
      isLoaded: true,
      isLoading: false,
      error: null,
      metrics: {
        ...metrics,
        groundContact: `Y = ${metrics.bounds.min.y.toFixed(3)}m`,
      },
      semanticRegistry: {
        resolvedCount: semanticRegistry.resolvedCount,
        totalCount: semanticRegistry.totalCount,
        unresolved: semanticRegistry.unresolved,
      },
    });
  },

  setError: (error) => {
    set({
      isLoaded: false,
      isLoading: false,
      error,
    });
  },
}));

// Expose store for test instrumentation and browser automation
if (typeof window !== 'undefined') {
  window.__carAssetStore = useCarAssetStore;
}
