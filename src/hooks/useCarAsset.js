import { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { indexCarScene } from '../utils/carAssetRegistry.js';
import { useCarAssetStore } from '../store/carAssetStore.js';
import { useCameraStore } from '../store/cameraStore.js';

export const CAR_MODEL_URL = '/models/car.glb';

/**
 * Custom React hook for modular vehicle asset loading, caching, and scene graph indexing.
 */
export function useCarAsset(modelUrl = CAR_MODEL_URL) {
  // Leverage Drei's built-in global GLTF loader and cache
  const gltf = useGLTF(modelUrl);
  const setLoaded = useCarAssetStore((state) => state.setLoaded);
  const setError = useCarAssetStore((state) => state.setError);

  // Index the scene graph once on load and cache the resulting lookup structures
  const graphData = useMemo(() => {
    if (!gltf || !gltf.scene) return null;
    return indexCarScene(gltf.scene);
  }, [gltf]);

  // Synchronize runtime telemetry with asset and camera stores
  useEffect(() => {
    if (graphData) {
      setLoaded({
        metrics: graphData.metrics,
        semanticRegistry: graphData.semanticRegistry,
      });

      // Synchronize vehicle bounds with camera navigation store, accounting for ground tangency
      const groundOffsetY = graphData.metrics.bounds.min.y < 0 ? -graphData.metrics.bounds.min.y : 0;
      useCameraStore.getState().setBounds({
        size: graphData.metrics.dimensions,
        center: {
          x: graphData.metrics.bounds.center.x,
          y: graphData.metrics.bounds.center.y + groundOffsetY,
          z: graphData.metrics.bounds.center.z,
        },
        radius: graphData.metrics.radius,
      });
    }
  }, [graphData, setLoaded]);

  return {
    scene: gltf.scene,
    nodes: gltf.nodes,
    materials: gltf.materials,
    graphData,
    metrics: graphData?.metrics,
    semanticRegistry: graphData?.semanticRegistry,
    isLoaded: Boolean(graphData),
  };
}

// Preload the vehicle asset immediately for seamless WebGL instantiation
useGLTF.preload(CAR_MODEL_URL);
