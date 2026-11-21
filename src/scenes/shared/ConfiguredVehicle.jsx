import React from 'react';
import CarAssetLoader from '../../components/canvas/CarAssetLoader.jsx';

/**
 * Shared Configured Vehicle
 *
 * Single source of truth for the 3D vehicle representation across modes:
 * - Reuses the exact same GLTF asset from Drei cache without reloading geometry.
 * - Applies all active PBR materials (paint, wheels, glass, lights, closures).
 * - Shared across Showroom (configurator) and Driving (simulation) scenes.
 */
export default function ConfiguredVehicle({
  onLoadMetrics,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  interactive = true,
}) {
  return (
    <group position={position} rotation={rotation} scale={scale} name="ConfiguredVehicleGroup">
      <CarAssetLoader onLoadMetrics={onLoadMetrics} interactive={interactive} />
    </group>
  );
}
