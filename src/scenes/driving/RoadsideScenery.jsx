import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { getDistanceToRoadCenter } from './roadData.js';

/**
 * RoadsideScenery Component
 *
 * Implements a restrained, photorealistic automotive proving ground environment:
 * - Expansive 1200m x 1200m meadow grass terrain plane.
 * - Single-draw-call InstancedMesh trees (conifer pines & deciduous oaks) and low shrubs.
 * - Deterministic placement algorithm guaranteeing a strict >= 9.0m road clearance.
 * - Sleek modern test-track telemetry & lighting masts along the main launch straight.
 * - Distant mountain horizon ridge providing depth, atmosphere, and scale.
 * - Tagged with `userData: { type: 'scenery', collidable: false }` for collision system clarity.
 */
export default function RoadsideScenery() {
  const pineTrunkRef = useRef(null);
  const pineCrownRef = useRef(null);
  const oakTrunkRef = useRef(null);
  const oakCrownRef = useRef(null);
  const bushRef = useRef(null);

  // 1. Deterministic Vegetation Generation with Strict Road Exclusion Zone
  const { pineData, oakData, bushData } = useMemo(() => {
    const pines = [];
    const oaks = [];
    const bushes = [];

    // Deterministic PRNG for stable scene generation
    let seed = 12345;
    function rnd() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }

    // Grid-jittered candidate distribution across 500m x 500m area
    const GRID_SIZE = 24;
    const SPACING = 22.0;

    for (let gx = -GRID_SIZE; gx <= GRID_SIZE; gx++) {
      for (let gz = -GRID_SIZE; gz <= GRID_SIZE; gz++) {
        // Apply random jitter within the cell
        const x = gx * SPACING + (rnd() - 0.5) * SPACING * 0.8;
        const z = gz * SPACING + (rnd() - 0.5) * SPACING * 0.8;

        // Skip positions beyond a realistic perimeter radius
        const r2 = x * x + z * z;
        if (r2 > 280 * 280) continue;

        // CRITICAL CHECK: Distance to road centerline must exceed 9.0m
        const distToRoad = getDistanceToRoadCenter({ x, z });
        if (distToRoad <= 9.2) continue;

        const roll = rnd();
        const scale = 0.8 + rnd() * 0.45;
        const rotY = rnd() * Math.PI * 2;

        if (roll < 0.45) {
          // Pine tree
          const trunkMat = new THREE.Matrix4();
          trunkMat.makeRotationY(rotY);
          trunkMat.scale(new THREE.Vector3(scale, scale, scale));
          trunkMat.setPosition(x, 1.2 * scale, z);

          const crownMat = new THREE.Matrix4();
          crownMat.makeRotationY(rotY);
          crownMat.scale(new THREE.Vector3(scale, scale, scale));
          crownMat.setPosition(x, 4.2 * scale, z);

          pines.push({ trunk: trunkMat, crown: crownMat });
        } else if (roll < 0.80) {
          // Deciduous Oak tree
          const trunkMat = new THREE.Matrix4();
          trunkMat.makeRotationY(rotY);
          trunkMat.scale(new THREE.Vector3(scale, scale, scale));
          trunkMat.setPosition(x, 1.0 * scale, z);

          const crownMat = new THREE.Matrix4();
          crownMat.makeRotationY(rotY);
          crownMat.scale(new THREE.Vector3(scale * 1.1, scale * 1.1, scale * 1.1));
          crownMat.setPosition(x, 3.4 * scale, z);

          oaks.push({ trunk: trunkMat, crown: crownMat });
        } else {
          // Roadside Bush
          const bushMat = new THREE.Matrix4();
          bushMat.makeRotationY(rotY);
          bushMat.scale(new THREE.Vector3(scale * 0.8, scale * 0.7, scale * 0.8));
          bushMat.setPosition(x, 0.5 * scale, z);

          bushes.push(bushMat);
        }
      }
    }

    return { pineData: pines, oakData: oaks, bushData: bushes };
  }, []);

  // Update instanced meshes on mount
  useEffect(() => {
    if (pineTrunkRef.current && pineCrownRef.current) {
      pineData.forEach((p, idx) => {
        pineTrunkRef.current.setMatrixAt(idx, p.trunk);
        pineCrownRef.current.setMatrixAt(idx, p.crown);
      });
      pineTrunkRef.current.instanceMatrix.needsUpdate = true;
      pineCrownRef.current.instanceMatrix.needsUpdate = true;
    }

    if (oakTrunkRef.current && oakCrownRef.current) {
      oakData.forEach((o, idx) => {
        oakTrunkRef.current.setMatrixAt(idx, o.trunk);
        oakCrownRef.current.setMatrixAt(idx, o.crown);
      });
      oakTrunkRef.current.instanceMatrix.needsUpdate = true;
      oakCrownRef.current.instanceMatrix.needsUpdate = true;
    }

    if (bushRef.current) {
      bushData.forEach((matrix, idx) => {
        bushRef.current.setMatrixAt(idx, matrix);
      });
      bushRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [pineData, oakData, bushData]);

  // 2. Telemetry & Lighting Poles along Main Straight
  const lightPoles = useMemo(() => {
    const poles = [];
    // Spaced along Z in [-30, 130] at X = -8.0m and X = +8.0m
    const zCoords = [-30, 10, 50, 90, 130];
    for (const z of zCoords) {
      // Left pole
      poles.push({ pos: [-8.0, 0, z], rotY: Math.PI / 2 });
      // Right pole
      poles.push({ pos: [8.0, 0, z], rotY: -Math.PI / 2 });
    }
    return poles;
  }, []);

  // 3. Distant Mountain Ridge / Horizon Ring (Low-poly background)
  const mountainGeometry = useMemo(() => {
    const positions = [];
    const colors = [];
    const indices = [];

    const SEGMENTS = 64;
    const RADIUS_INNER = 460;
    const RADIUS_OUTER = 560;

    let seed = 999;
    function rnd() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }

    const baseColor = new THREE.Color('#466272');
    const peakColor = new THREE.Color('#6E8E9F');

    for (let i = 0; i <= SEGMENTS; i++) {
      const theta = (i / SEGMENTS) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Low-frequency noise peak height (30m to 70m)
      const peakH = 35 + Math.sin(theta * 4) * 18 + Math.cos(theta * 7) * 12 + rnd() * 6;

      // Base inner vertex (ground level)
      positions.push(cosT * RADIUS_INNER, 0.0, sinT * RADIUS_INNER);
      colors.push(baseColor.r, baseColor.g, baseColor.b);

      // Peak vertex
      const midR = (RADIUS_INNER + RADIUS_OUTER) / 2;
      positions.push(cosT * midR, peakH, sinT * midR);
      colors.push(peakColor.r, peakColor.g, peakColor.b);

      // Base outer vertex
      positions.push(cosT * RADIUS_OUTER, 0.0, sinT * RADIUS_OUTER);
      colors.push(baseColor.r, baseColor.g, baseColor.b);

      if (i < SEGMENTS) {
        const base = i * 3;
        // Inner slope quad
        indices.push(base, base + 1, base + 3);
        indices.push(base + 1, base + 4, base + 3);
        // Outer slope quad
        indices.push(base + 1, base + 2, base + 4);
        indices.push(base + 2, base + 5, base + 4);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, []);

  return (
    <group name="RoadsideSceneryGroup">
      {/* 1. Surrounding Landscape Meadow Ground */}
      <mesh
        name="Scenery_MeadowTerrain"
        position={[0, -0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        userData={{ type: 'terrain', collidable: true, surface: 'grass' }}
      >
        <planeGeometry args={[1200, 1200, 32, 32]} />
        <meshStandardMaterial
          color="#344D25"
          roughness={0.94}
          metalness={0.01}
        />
      </mesh>

      {/* 2. Instanced Pine Trees (Trunk + Foliage Cone) */}
      <instancedMesh
        ref={pineTrunkRef}
        name="Scenery_PineTrunks"
        args={[null, null, pineData.length]}
        castShadow
        userData={{ type: 'scenery', collidable: false }}
      >
        <cylinderGeometry args={[0.2, 0.35, 2.5, 8]} />
        <meshStandardMaterial color="#4A3423" roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={pineCrownRef}
        name="Scenery_PineCrowns"
        args={[null, null, pineData.length]}
        castShadow
        userData={{ type: 'scenery', collidable: false }}
      >
        <coneGeometry args={[2.2, 6.0, 7]} />
        <meshStandardMaterial color="#1E3B20" roughness={0.82} />
      </instancedMesh>

      {/* 3. Instanced Deciduous Oak Trees (Trunk + Spherical Canopy) */}
      <instancedMesh
        ref={oakTrunkRef}
        name="Scenery_OakTrunks"
        args={[null, null, oakData.length]}
        castShadow
        userData={{ type: 'scenery', collidable: false }}
      >
        <cylinderGeometry args={[0.22, 0.4, 2.2, 8]} />
        <meshStandardMaterial color="#3D2D1E" roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={oakCrownRef}
        name="Scenery_OakCrowns"
        args={[null, null, oakData.length]}
        castShadow
        userData={{ type: 'scenery', collidable: false }}
      >
        <dodecahedronGeometry args={[2.5, 1]} />
        <meshStandardMaterial color="#345B25" roughness={0.85} />
      </instancedMesh>

      {/* 4. Instanced Roadside Bushes */}
      <instancedMesh
        ref={bushRef}
        name="Scenery_RoadsideBushes"
        args={[null, null, bushData.length]}
        castShadow
        userData={{ type: 'scenery', collidable: false }}
      >
        <sphereGeometry args={[1.1, 7, 6]} />
        <meshStandardMaterial color="#2E4C22" roughness={0.88} />
      </instancedMesh>

      {/* 5. Telemetry & Lighting Masts along Main Straight */}
      <group name="Scenery_TelemetryLightMasts">
        {lightPoles.map((pole, idx) => (
          <group key={idx} position={pole.pos} rotation={[0, pole.rotY, 0]}>
            {/* Vertical Mast */}
            <mesh position={[0, 4.0, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.18, 8.0, 8]} />
              <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Horizontal Arm pointing towards track */}
            <mesh position={[0.9, 7.8, 0]} rotation={[0, 0, -Math.PI / 10]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, 2.0, 6]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Floodlight Fixture Head */}
            <mesh position={[1.8, 7.5, 0]}>
              <boxGeometry args={[0.6, 0.2, 0.4]} />
              <meshStandardMaterial
                color="#0F172A"
                emissive="#F8FAFC"
                emissiveIntensity={0.8}
                roughness={0.2}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* 6. Distant Low-Poly Mountain Horizon */}
      <mesh
        name="Scenery_DistantHorizon"
        geometry={mountainGeometry}
        userData={{ type: 'scenery', collidable: false }}
      >
        <meshStandardMaterial vertexColors roughness={0.88} metalness={0.04} />
      </mesh>
    </group>
  );
}
