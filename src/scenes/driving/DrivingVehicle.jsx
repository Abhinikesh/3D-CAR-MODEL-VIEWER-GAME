import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import ConfiguredVehicle from '../shared/ConfiguredVehicle.jsx';
import { DRIVING_VEHICLE_CONFIG } from './drivingVehicleConfig.js';

/**
 * DrivingVehicle Component
 *
 * Integrates the player's customized 3D vehicle into the driving proving ground:
 * - Positioned at verified road spawn coordinates [0, 0.002, 0] tangent to asphalt.
 * - Facing forward along the +Z heading vector [0, 0, 1] down the main launch straight.
 * - Maintains 1:1 original Khronos sports coupe proportions (scale [1, 1, 1]).
 * - Reuses existing GLB asset from Drei cache without duplicating geometry or textures.
 * - Automatically applies all showroom customizations (paint, secondary materials, wheels, calipers).
 * - Enforces scene separation: showroom raycast selection outlines are disabled (interactive={false}).
 */
const DrivingVehicle = forwardRef(function DrivingVehicle({ onLoadMetrics }, ref) {
  const rootGroupRef = useRef(null);

  // Expose underlying Object3D to parent refs (e.g. for camera tracking or future physics controller)
  useImperativeHandle(ref, () => rootGroupRef.current, []);

  return (
    <group
      ref={rootGroupRef}
      name="DrivingVehicleRoot"
      position={DRIVING_VEHICLE_CONFIG.spawnPosition}
      rotation={DRIVING_VEHICLE_CONFIG.spawnRotation}
      scale={DRIVING_VEHICLE_CONFIG.scale}
    >
      <ConfiguredVehicle
        onLoadMetrics={onLoadMetrics}
        interactive={false}
      />
    </group>
  );
});

export default DrivingVehicle;
