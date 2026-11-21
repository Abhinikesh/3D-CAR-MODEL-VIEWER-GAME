import React from 'react';
import VehiclePhysicsWorld from './VehiclePhysicsWorld.jsx';
import { useAppModeStore, APP_MODES } from '../../store/appModeStore.js';

/**
 * VehiclePhysicsController Component
 *
 * High-level coordinator mounting the vehicle physics world inside Driving Mode.
 * Ensures the physics simulation is active ONLY during Driving Mode and is completely
 * dismantled when switching to Showroom Mode.
 */
export default function VehiclePhysicsController({ vehicleRootRef }) {
  const mode = useAppModeStore((state) => state.mode);

  // Strictly isolate physics: only mount simulation in DRIVING mode
  if (mode !== APP_MODES.DRIVING) {
    return null;
  }

  return <VehiclePhysicsWorld vehicleRootRef={vehicleRootRef} />;
}
