import React, { useMemo } from 'react';
import * as THREE from 'three';
import {
  ROAD_CURVE,
  HALF_ROAD_WIDTH,
  MARKING_ELEVATION,
  TRACK_LENGTH,
  getRoadNormal,
  getRoadPoint,
} from './roadData.js';

/**
 * RoadMarkings Component
 *
 * Implements high-visibility, professional automotive circuit road markings:
 * - Solid outer boundary edge lines (white, 0.18m wide).
 * - Dashed centerline with strict automotive rhythm (3m stroke, 5m gap, 0.16m wide).
 * - Starting grid & spawn markings at Z = 0 (launch box, pole position, checkered start line).
 * - Distance countdown boards (150m, 100m, 50m) approaching key corners.
 * - Directional curve chevron boards on apex runoffs.
 * - Non-flickering polygon-offset geometry elevated by MARKING_ELEVATION (0.008m).
 */
export default function RoadMarkings() {
  const SAMPLES = 600;

  // 1. Solid Outer Edge Lines (Left & Right borders)
  const edgeLinesGeometry = useMemo(() => {
    const positions = [];
    const normals = [];
    const indices = [];

    const LINE_WIDTH = 0.18;
    const HALF_LW = LINE_WIDTH / 2;
    const EDGE_INSET = 0.45; // 0.45m inside the asphalt edge

    const leftCenterDist = HALF_ROAD_WIDTH - EDGE_INSET;
    const rightCenterDist = HALF_ROAD_WIDTH - EDGE_INSET;

    for (let i = 0; i <= SAMPLES; i++) {
      const t = (i % SAMPLES) / SAMPLES;
      const pt = ROAD_CURVE.getPointAt(t);
      const norm = getRoadNormal(t);

      // Left edge line
      const lInnerX = pt.x - norm.x * (leftCenterDist - HALF_LW);
      const lInnerZ = pt.z - norm.z * (leftCenterDist - HALF_LW);
      const lOuterX = pt.x - norm.x * (leftCenterDist + HALF_LW);
      const lOuterZ = pt.z - norm.z * (leftCenterDist + HALF_LW);

      positions.push(lInnerX, MARKING_ELEVATION, lInnerZ);
      positions.push(lOuterX, MARKING_ELEVATION, lOuterZ);
      normals.push(0, 1, 0, 0, 1, 0);

      // Right edge line
      const rInnerX = pt.x + norm.x * (rightCenterDist - HALF_LW);
      const rInnerZ = pt.z + norm.z * (rightCenterDist - HALF_LW);
      const rOuterX = pt.x + norm.x * (rightCenterDist + HALF_LW);
      const rOuterZ = pt.z + norm.z * (rightCenterDist + HALF_LW);

      positions.push(rInnerX, MARKING_ELEVATION, rInnerZ);
      positions.push(rOuterX, MARKING_ELEVATION, rOuterZ);
      normals.push(0, 1, 0, 0, 1, 0);

      if (i < SAMPLES) {
        const base = i * 4;
        const next = (i + 1) * 4;

        // Left line quad
        indices.push(base, base + 1, next);
        indices.push(base + 1, next + 1, next);

        // Right line quad
        indices.push(base + 2, base + 3, next + 2);
        indices.push(base + 3, next + 3, next + 2);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setIndex(indices);
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    return geom;
  }, []);

  // 2. Dashed Centerline (3m stroke, 5m gap, 0.16m wide)
  const centerlineGeometry = useMemo(() => {
    const positions = [];
    const normals = [];
    const indices = [];

    const DASH_LEN = 3.0;
    const GAP_LEN = 5.0;
    const PERIOD = DASH_LEN + GAP_LEN; // 8.0m
    const numDashes = Math.floor(TRACK_LENGTH / PERIOD);

    const HALF_W = 0.08; // 0.16m total width
    let vertOffset = 0;

    for (let k = 0; k < numDashes; k++) {
      const s0 = k * PERIOD;
      const s1 = s0 + DASH_LEN;

      // Subdivide each dash into 2 segments (3 slices) for smooth curvature
      const SUBDIVS = 2;
      for (let s = 0; s <= SUBDIVS; s++) {
        const curS = s0 + (s / SUBDIVS) * DASH_LEN;
        const t = (curS % TRACK_LENGTH) / TRACK_LENGTH;
        const pt = ROAD_CURVE.getPointAt(t);
        const norm = getRoadNormal(t);

        const leftX = pt.x - norm.x * HALF_W;
        const leftZ = pt.z - norm.z * HALF_W;
        const rightX = pt.x + norm.x * HALF_W;
        const rightZ = pt.z + norm.z * HALF_W;

        positions.push(leftX, MARKING_ELEVATION, leftZ);
        positions.push(rightX, MARKING_ELEVATION, rightZ);
        normals.push(0, 1, 0, 0, 1, 0);
      }

      for (let s = 0; s < SUBDIVS; s++) {
        const base = vertOffset + s * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }

      vertOffset += (SUBDIVS + 1) * 2;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setIndex(indices);
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    return geom;
  }, []);

  // 3. Starting Grid & Spawn Guidance Markings
  const startGridGeometry = useMemo(() => {
    const positions = [];
    const normals = [];
    const indices = [];
    let vertCount = 0;

    function addQuad(p1, p2, p3, p4) {
      positions.push(p1[0], p1[1], p1[2]);
      positions.push(p2[0], p2[1], p2[2]);
      positions.push(p3[0], p3[1], p3[2]);
      positions.push(p4[0], p4[1], p4[2]);
      for (let i = 0; i < 4; i++) normals.push(0, 1, 0);
      indices.push(vertCount, vertCount + 1, vertCount + 2);
      indices.push(vertCount + 1, vertCount + 3, vertCount + 2);
      vertCount += 4;
    }

    // A. Start / Finish Line Banner (at Z = 5.0m, across full road width X in [-4.5, 4.5])
    const startZ = 5.0;
    const bandDepth = 0.8;
    // Checkered pattern with 10 squares
    const numChecks = 10;
    const checkWidth = 9.0 / numChecks;
    for (let c = 0; c < numChecks; c++) {
      if (c % 2 === 0) {
        const x0 = -4.5 + c * checkWidth;
        const x1 = x0 + checkWidth;
        addQuad(
          [x0, MARKING_ELEVATION + 0.001, startZ - bandDepth / 2],
          [x1, MARKING_ELEVATION + 0.001, startZ - bandDepth / 2],
          [x0, MARKING_ELEVATION + 0.001, startZ + bandDepth / 2],
          [x1, MARKING_ELEVATION + 0.001, startZ + bandDepth / 2]
        );
      }
    }

    // B. Spawn Grid Box 1 (Pole Position for Player Car at [0, 0, 0])
    // Box dimensions: X in [-1.4, 1.4], Z in [-2.5, 2.5]
    const bw = 0.12; // line stroke width
    function addBoxFrame(cx, cz, w, d) {
      const hx = w / 2;
      const hz = d / 2;
      // Front line
      addQuad([cx - hx, MARKING_ELEVATION, cz + hz - bw], [cx + hx, MARKING_ELEVATION, cz + hz - bw], [cx - hx, MARKING_ELEVATION, cz + hz], [cx + hx, MARKING_ELEVATION, cz + hz]);
      // Rear line
      addQuad([cx - hx, MARKING_ELEVATION, cz - hz], [cx + hx, MARKING_ELEVATION, cz - hz], [cx - hx, MARKING_ELEVATION, cz - hz + bw], [cx + hx, MARKING_ELEVATION, cz - hz + bw]);
      // Left line
      addQuad([cx - hx, MARKING_ELEVATION, cz - hz], [cx - hx + bw, MARKING_ELEVATION, cz - hz], [cx - hx, MARKING_ELEVATION, cz + hz], [cx - hx + bw, MARKING_ELEVATION, cz + hz]);
      // Right line
      addQuad([cx + hx - bw, MARKING_ELEVATION, cz - hz], [cx + hx, MARKING_ELEVATION, cz - hz], [cx + hx - bw, MARKING_ELEVATION, cz + hz], [cx + hx, MARKING_ELEVATION, cz + hz]);
    }

    // Pole Position Box (Center Lane at Z = 0)
    addBoxFrame(0, 0, 2.6, 5.0);

    // Staggered grid slots behind
    addBoxFrame(-2.2, -10.0, 2.4, 4.6);
    addBoxFrame(2.2, -18.0, 2.4, 4.6);
    addBoxFrame(-2.2, -26.0, 2.4, 4.6);

    // C. Acceleration Test Traps at Z = 50m and Z = 100m
    function addTransverseStripe(z, width, color) {
      addQuad(
        [-HALF_ROAD_WIDTH + 0.5, MARKING_ELEVATION, z - 0.15],
        [HALF_ROAD_WIDTH - 0.5, MARKING_ELEVATION, z - 0.15],
        [-HALF_ROAD_WIDTH + 0.5, MARKING_ELEVATION, z + 0.15],
        [HALF_ROAD_WIDTH - 0.5, MARKING_ELEVATION, z + 0.15]
      );
    }
    addTransverseStripe(50.0, 0.3);
    addTransverseStripe(100.0, 0.3);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setIndex(indices);
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    return geom;
  }, []);

  // 4. Roadside Distance Countdown & Chevron Sign Boards
  const signBoards = useMemo(() => {
    return [
      // Approach to Turn 1 (North Sweeper): 150m, 100m, 50m boards
      { pos: [6.2, 0.7, 75], rot: [0, -Math.PI / 2, 0], label: '150m', type: 'distance' },
      { pos: [6.2, 0.7, 95], rot: [0, -Math.PI / 2, 0], label: '100m', type: 'distance' },
      { pos: [6.2, 0.7, 115], rot: [0, -Math.PI / 2, 0], label: '50m', type: 'distance' },

      // Approach to Turn 5 (Hairpin): distance boards
      { pos: [100, 0.7, -150], rot: [0, Math.PI / 4, 0], label: '100m', type: 'distance' },
      { pos: [45, 0.7, -168], rot: [0, 0, 0], label: '50m', type: 'distance' },

      // Curve Chevron signs on apex runoffs
      { pos: [75, 1.0, 248], rot: [0, Math.PI, 0], type: 'chevron_right' },
      { pos: [140, 1.0, 252], rot: [0, Math.PI * 0.9, 0], type: 'chevron_right' },
      { pos: [198, 1.0, 208], rot: [0, Math.PI * 0.7, 0], type: 'chevron_right' },
      { pos: [10, 1.0, -182], rot: [0, 0, 0], type: 'chevron_left' },
      { pos: [-60, 1.0, -158], rot: [0, -Math.PI * 0.25, 0], type: 'chevron_left' },
    ];
  }, []);

  return (
    <group name="RoadMarkingsGroup">
      {/* 1. Solid Outer Edge Lines */}
      <mesh
        name="RoadMarkings_SolidEdgeLines"
        geometry={edgeLinesGeometry}
        userData={{ type: 'road_marking', collidable: false }}
      >
        <meshBasicMaterial
          color="#F8FAFC"
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* 2. Dashed Centerline */}
      <mesh
        name="RoadMarkings_DashedCenterline"
        geometry={centerlineGeometry}
        userData={{ type: 'road_marking', collidable: false }}
      >
        <meshBasicMaterial
          color="#F1F5F9"
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* 3. Starting Grid & Spawn Markings */}
      <mesh
        name="RoadMarkings_StartingGrid"
        geometry={startGridGeometry}
        userData={{ type: 'road_marking', collidable: false }}
      >
        <meshBasicMaterial
          color="#FFFFFF"
          polygonOffset
          polygonOffsetFactor={-2.5}
          polygonOffsetUnits={-2.5}
        />
      </mesh>

      {/* 4. Roadside Distance Countdown & Chevron Sign Boards */}
      <group name="RoadsideGuidanceSignBoards">
        {signBoards.map((s, idx) => (
          <group key={idx} position={s.pos} rotation={s.rot}>
            {/* Sign Support Post */}
            <mesh position={[0, -0.2, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 1.1, 8]} />
              <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
            </mesh>

            {/* Sign Board Plate */}
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[0.9, 0.6, 0.04]} />
              <meshStandardMaterial
                color={s.type === 'distance' ? '#0F172A' : '#EAB308'}
                roughness={0.4}
                metalness={0.2}
              />
            </mesh>

            {/* High-visibility retro-reflective chevron or stripe indicator */}
            <mesh position={[0, 0.45, 0.025]}>
              <planeGeometry args={[0.75, 0.45]} />
              <meshBasicMaterial
                color={s.type === 'distance' ? '#F8FAFC' : '#18181B'}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
