import React from 'react';
import CarAssetLoader from './CarAssetLoader.jsx';

/**
 * CarModel: Primary entry point for the 3D vehicle in the showroom scene.
 * Delegates to the modular CarAssetLoader and useCarAsset architecture.
 */
export default function CarModel({ onLoadMetrics }) {
  return <CarAssetLoader onLoadMetrics={onLoadMetrics} />;
}
