import React, { Suspense } from 'react';
import CameraController from '../../components/canvas/CameraController.jsx';
import ShowroomEnvironmentController from '../../components/canvas/ShowroomEnvironmentController.jsx';
import PerformanceDiagnosticsCollector from '../../components/canvas/PerformanceDiagnosticsCollector.jsx';
import LoadingFallback from '../../components/canvas/LoadingFallback.jsx';
import ConfiguredVehicle from '../shared/ConfiguredVehicle.jsx';

/**
 * Showroom Scene Presentation
 *
 * Dedicated architectural showroom environment:
 * - 4-environment lighting rig (Studio, Luxury, Daylight, Cinematic).
 * - Smooth camera preset transitions, turntable, and technical gizmo.
 * - Interactive component selection raycasting and closures kinematics.
 * - Shared configured vehicle reusing identical GLB asset and customizations.
 */
export default function ShowroomScene({ onLoadMetrics }) {
  return (
    <>
      {/* Live Performance & Memory Diagnostics Collector */}
      <PerformanceDiagnosticsCollector />

      {/* Centralized Camera System & Navigation Gizmo */}
      <CameraController />

      {/* Dynamic Showroom Environment Rig (HDR, Procedural Sky, Photometric Rig & Ground Stage) */}
      <ShowroomEnvironmentController />

      {/* Shared Configured Vehicle Model with Loading Fallback */}
      <Suspense fallback={<LoadingFallback />}>
        <ConfiguredVehicle onLoadMetrics={onLoadMetrics} />
      </Suspense>
    </>
  );
}
