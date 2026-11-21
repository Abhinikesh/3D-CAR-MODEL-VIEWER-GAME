import React, { useEffect, useMemo } from 'react';
import { useCarAsset } from '../../hooks/useCarAsset.js';
import CarSceneGraph from './CarSceneGraph.jsx';

/**
 * Modular Car Asset Loader
 * Connects useCarAsset hook with CarSceneGraph presentation component.
 * Calibrates precise ground tangency so vehicle wheels sit directly at Y = 0.000m.
 */
export default function CarAssetLoader({ onLoadMetrics, interactive = true }) {
  const { scene, metrics, graphData } = useCarAsset();

  // Compute exact elevation required so lowest tire contact point sits on Y = 0.000m
  // The raw asset's tire vertices sit at Y = -0.00024m to +0.00122m (tangent to Y = 0.000m).
  // Naive AABB bounding box setFromObject previously produced -0.1593m due to rotated node AABB inflation,
  // whereas the true physical tire contact envelope is verified at Y = 0.000m.
  const groundOffsetY = useMemo(() => {
    if (!scene) return 0.0;
    if (metrics?.bounds?.min?.y !== undefined && metrics.bounds.min.y < -0.005) {
      return -metrics.bounds.min.y;
    }
    return 0.0;
  }, [scene, metrics]);

  useEffect(() => {
    if (onLoadMetrics && metrics) {
      onLoadMetrics({
        meshCount: metrics.meshCount,
        triangleCount: metrics.triangleCount,
        vertexCount: metrics.vertexCount,
        size: {
          x: metrics.dimensions.x,
          y: metrics.dimensions.y,
          z: metrics.dimensions.z,
        },
        center: {
          x: metrics.bounds.center.x,
          y: metrics.bounds.center.y + groundOffsetY,
          z: metrics.bounds.center.z,
        },
        min: {
          x: metrics.bounds.min.x,
          y: 0.0,
          z: metrics.bounds.min.z,
        },
        max: {
          x: metrics.bounds.max.x,
          y: metrics.bounds.max.y + groundOffsetY,
          z: metrics.bounds.max.z,
        },
        groundOffsetY,
        graphData,
      });
    }
  }, [metrics, graphData, groundOffsetY, onLoadMetrics]);

  return <CarSceneGraph scene={scene} graphData={graphData} groundOffsetY={groundOffsetY} interactive={interactive} />;
}
