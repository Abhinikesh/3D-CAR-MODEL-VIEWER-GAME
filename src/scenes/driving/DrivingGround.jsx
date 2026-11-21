import React from 'react';
import RoadMesh from './RoadMesh.jsx';
import RoadMarkings from './RoadMarkings.jsx';
import RoadBarriers from './RoadBarriers.jsx';
import RoadsideScenery from './RoadsideScenery.jsx';

/**
 * Driving Mode Proving Ground & Road Environment
 *
 * Assembles the complete Part 23 automotive test track:
 * - RoadMesh: Continuous asphalt road surface, concrete shoulders, and FIA rumble kerbs.
 * - RoadMarkings: Solid edge lines, dashed centerline, starting grid, distance boards, and chevrons.
 * - RoadBarriers: Galvanized steel W-beam safety guardrails on curves and dangerous edges.
 * - RoadsideScenery: Meadow terrain, instanced trees, shrubs, lighting poles, and distant mountains.
 */
export default function DrivingGround() {
  return (
    <group name="DrivingProvingGroundEnvironment">
      {/* 1. Surrounding Landscape & Roadside Scenery */}
      <RoadsideScenery />

      {/* 2. Primary Asphalt Road Surface & Apex Rumble Kerbs */}
      <RoadMesh />

      {/* 3. Road Markings & Guidance Signage */}
      <RoadMarkings />

      {/* 4. Safety Barriers & Guardrails */}
      <RoadBarriers />
    </group>
  );
}
