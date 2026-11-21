import React, { Suspense, useRef, useEffect } from 'react';
import DrivingEnvironmentController from './DrivingEnvironmentController.jsx';
import DrivingGround from './DrivingGround.jsx';
import DrivingCamera from './DrivingCamera.jsx';
import DrivingVehicle from './DrivingVehicle.jsx';
import VehiclePhysicsController from './VehiclePhysicsController.jsx';
import KeyboardVehicleInput from './KeyboardVehicleInput.jsx';
import LoadingFallback from '../../components/canvas/LoadingFallback.jsx';
import PerformanceDiagnosticsCollector from '../../components/canvas/PerformanceDiagnosticsCollector.jsx';
import { localControllerService } from '../../services/controller/localControllerService.js';
import { useControllerWebSocket } from '../../services/controller/useControllerWebSocket.js';

/**
 * Driving Scene Foundation
 *
 * Dedicated outdoor driving environment:
 * - Natural open-air lighting with procedural sun dome & HDR reflection probe.
 * - Expansive asphalt testing surface with telemetry grid.
 * - Shared configured vehicle reusing identical GLB asset and customizations.
 * - Dynamic chase/follow camera.
 * - Part 26: 4-Wheel raycast suspension and rigid body physics simulation.
 * - Part 37: Real-time smartphone wireless controller integration.
 */
export default function DrivingScene({ onLoadMetrics }) {
  const vehicleRef = useRef(null);

  // Part 37: Listen to smartphone controller WebSocket events over Vite HMR channel
  useControllerWebSocket();

  // Part 34: Initialize local smartphone controller service when Driving Mode starts
  useEffect(() => {
    localControllerService.init();
    return () => {
      localControllerService.dispose();
    };
  }, []);

  return (
    <>
      {/* Live WebGL Performance Telemetry */}
      <PerformanceDiagnosticsCollector />

      {/* Part 24 Outdoor Environment, Atmosphere, Sky Dome & Lighting Rig */}
      <DrivingEnvironmentController />

      {/* Driving Proving Ground Surface */}
      <DrivingGround />

      {/* Part 26 & 27 Core Vehicle Physics & 4-Wheel Raycast Suspension Simulation */}
      <VehiclePhysicsController vehicleRootRef={vehicleRef} />

      {/* Part 27 Keyboard Input Driver Bridge */}
      <KeyboardVehicleInput />

      {/* Third-Person Dynamic Chase / Follow Camera */}
      <DrivingCamera targetObjectRef={vehicleRef} />

      {/* Part 25 Customized Player Vehicle on Road Surface */}
      <Suspense fallback={<LoadingFallback />}>
        <DrivingVehicle ref={vehicleRef} onLoadMetrics={onLoadMetrics} />
      </Suspense>
    </>
  );
}
