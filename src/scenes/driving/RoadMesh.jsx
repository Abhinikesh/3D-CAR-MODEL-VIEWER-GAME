import React, { useMemo, useEffect } from 'react';
import {
  buildRoadSurfaceGeometry,
  buildShoulderGeometry,
  buildApexKerbGeometry,
  createProceduralAsphaltTexture,
  createProceduralAsphaltRoughnessMap,
} from './roadGeometryUtils.js';

/**
 * RoadMesh Component — Part 22 & 23
 *
 * Procedurally generates the continuous asphalt road ribbon, outer concrete shoulders,
 * and FIA-specification red-and-white apex kerbs following the closed track spline.
 */
export default function RoadMesh() {
  const SAMPLES = 600;

  const roadGeometry = useMemo(() => buildRoadSurfaceGeometry(SAMPLES), [SAMPLES]);
  const shoulderGeometry = useMemo(() => buildShoulderGeometry(SAMPLES), [SAMPLES]);
  const kerbGeometry = useMemo(() => buildApexKerbGeometry(SAMPLES), [SAMPLES]);

  // Procedural asphalt textures with fine aggregate and roughness
  const asphaltTexture = useMemo(() => createProceduralAsphaltTexture(), []);
  const roughnessTexture = useMemo(() => createProceduralAsphaltRoughnessMap(), []);

  // Safe texture disposal on unmount to prevent GPU memory leaks
  useEffect(() => {
    return () => {
      if (asphaltTexture) asphaltTexture.dispose();
      if (roughnessTexture) roughnessTexture.dispose();
      roadGeometry.dispose();
      shoulderGeometry.dispose();
      kerbGeometry.dispose();
    };
  }, [asphaltTexture, roughnessTexture, roadGeometry, shoulderGeometry, kerbGeometry]);

  return (
    <group name="RoadMeshGroup">
      {/* 1. Main Asphalt Surface */}
      <mesh
        name="RoadSurface_Asphalt"
        geometry={roadGeometry}
        receiveShadow
        userData={{ type: 'road', collidable: true, surface: 'asphalt' }}
      >
        <meshStandardMaterial
          color="#282C34"
          map={asphaltTexture}
          roughnessMap={roughnessTexture}
          roughness={0.84}
          metalness={0.06}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* 2. Concrete Outer Gutters / Shoulders */}
      <mesh
        name="RoadShoulders_Concrete"
        geometry={shoulderGeometry}
        receiveShadow
        userData={{ type: 'shoulder', collidable: true, surface: 'concrete' }}
      >
        <meshStandardMaterial
          color="#484E5A"
          roughness={0.90}
          metalness={0.04}
        />
      </mesh>

      {/* 3. FIA Red/White Apex Rumble Kerbs */}
      <mesh
        name="RoadApexKerbs_Rumble"
        geometry={kerbGeometry}
        receiveShadow
        userData={{ type: 'curb', collidable: true, surface: 'concrete', rumble: true }}
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}
