import { memo } from 'react';
import { useVehicleLighting } from '../../hooks/useVehicleLighting.js';

/**
 * Presentation wrapper for the Dynamic Automotive Lighting System.
 * Mounts the useVehicleLighting hook within the R3F Canvas hierarchy.
 */
function VehicleLightingController({ scene }) {
  useVehicleLighting(scene);
  return null;
}

export default memo(VehicleLightingController);
