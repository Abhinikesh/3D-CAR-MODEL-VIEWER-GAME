import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import {
  ROAD_CURVE,
  getRoadNormal,
  BARRIER_DIST_FROM_CENTER,
  BARRIER_HEIGHT,
  TRACK_LENGTH,
  BARRIER_SEGMENTS,
} from './roadData.js';

/**
 * RoadBarriers Component
 *
 * Implements realistic galvanized steel W-beam Armco safety barriers:
 * - Positioned on the outside perimeter of high-speed turns and hazardous sections.
 * - Placed at BARRIER_DIST_FROM_CENTER = 6.4m (1.4m outside road edge), leaving drivable surface 100% clear.
 * - Corrugated continuous steel rail ribbon between Y = 0.52m and Y = 0.85m.
 * - Steel support posts spaced every 3.5m with amber/red retro-reflective safety markers.
 * - Single-draw-call InstancedMesh for all posts and reflectors.
 * - Tagged with `userData: { type: 'barrier', collidable: true }` for Part 30 collision detection.
 */
export default function RoadBarriers() {
  const postsInstancedRef = useRef(null);
  const reflectorsInstancedRef = useRef(null);

  // Defined barrier runs around the circuit
  const barrierSegments = BARRIER_SEGMENTS;

  // 1. Continuous Corrugated Rail Ribbon Geometry
  const { railGeometry, postTransforms, reflectorTransforms } = useMemo(() => {
    const positions = [];
    const normals = [];
    const indices = [];

    const posts = [];
    const reflectors = [];

    const POST_SPACING = 3.5; // meters
    const RAIL_BOTTOM = 0.50;
    const RAIL_TOP = 0.85;
    const RAIL_THICKNESS = 0.04;

    let globalVertOffset = 0;

    for (const seg of barrierSegments) {
      const segArcLen = (seg.endT - seg.startT) * TRACK_LENGTH;
      const numSteps = Math.max(12, Math.ceil(segArcLen / 2.0));
      const segBaseVert = globalVertOffset;

      let lastPostArc = -POST_SPACING;

      for (let s = 0; s <= numSteps; s++) {
        const u = s / numSteps;
        const t = seg.startT + u * (seg.endT - seg.startT);
        const pt = ROAD_CURVE.getPointAt(t);
        const norm = getRoadNormal(t);
        const tan = ROAD_CURVE.getTangentAt(t);

        // Center position of barrier line
        const bx = pt.x + norm.x * (BARRIER_DIST_FROM_CENTER * seg.side);
        const bz = pt.z + norm.z * (BARRIER_DIST_FROM_CENTER * seg.side);

        // Inward facing normal (towards road)
        const inNormX = -norm.x * seg.side;
        const inNormZ = -norm.z * seg.side;

        // Front face vertices (facing the road)
        const fBottomX = bx + inNormX * (RAIL_THICKNESS / 2);
        const fBottomZ = bz + inNormZ * (RAIL_THICKNESS / 2);
        const fTopX = fBottomX;
        const fTopZ = fBottomZ;

        // Back face vertices
        const bBottomX = bx - inNormX * (RAIL_THICKNESS / 2);
        const bBottomZ = bz - inNormZ * (RAIL_THICKNESS / 2);
        const bTopX = bBottomX;
        const bTopZ = bBottomZ;

        // 4 vertices per slice
        positions.push(fBottomX, RAIL_BOTTOM, fBottomZ);
        positions.push(fTopX, RAIL_TOP, fTopZ);
        positions.push(bBottomX, RAIL_BOTTOM, bBottomZ);
        positions.push(bTopX, RAIL_TOP, bTopZ);

        // Normals
        normals.push(inNormX, 0, inNormZ);
        normals.push(inNormX, 0, inNormZ);
        normals.push(-inNormX, 0, -inNormZ);
        normals.push(-inNormX, 0, -inNormZ);

        if (s < numSteps) {
          const base = segBaseVert + s * 4;
          // Front face quad
          indices.push(base, base + 1, base + 4);
          indices.push(base + 1, base + 5, base + 4);

          // Back face quad
          indices.push(base + 2, base + 6, base + 3);
          indices.push(base + 3, base + 6, base + 7);

          // Top cap quad
          indices.push(base + 1, base + 3, base + 5);
          indices.push(base + 3, base + 7, base + 5);
        }

        // Post placement
        const curArc = u * segArcLen;
        if (curArc - lastPostArc >= POST_SPACING || s === 0 || s === numSteps) {
          lastPostArc = curArc;

          // Post matrix: position at [bx, 0.425, bz], oriented along road tangent
          const postMatrix = new THREE.Matrix4();
          const angle = Math.atan2(tan.x, tan.z);
          postMatrix.makeRotationY(angle);
          postMatrix.setPosition(bx, (RAIL_TOP) / 2, bz);
          posts.push(postMatrix);

          // Reflector matrix on top of post
          const refMatrix = new THREE.Matrix4();
          refMatrix.makeRotationY(angle);
          refMatrix.setPosition(bx + inNormX * 0.03, RAIL_TOP + 0.05, bz + inNormZ * 0.03);
          reflectors.push(refMatrix);
        }
      }

      globalVertOffset += (numSteps + 1) * 4;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setIndex(indices);
    geom.computeBoundingBox();
    geom.computeBoundingSphere();

    return {
      railGeometry: geom,
      postTransforms: posts,
      reflectorTransforms: reflectors,
    };
  }, [barrierSegments]);

  // Update instanced matrices on mount
  useEffect(() => {
    if (postsInstancedRef.current) {
      postTransforms.forEach((matrix, idx) => {
        postsInstancedRef.current.setMatrixAt(idx, matrix);
      });
      postsInstancedRef.current.instanceMatrix.needsUpdate = true;
    }

    if (reflectorsInstancedRef.current) {
      reflectorTransforms.forEach((matrix, idx) => {
        reflectorsInstancedRef.current.setMatrixAt(idx, matrix);
      });
      reflectorsInstancedRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [postTransforms, reflectorTransforms]);

  return (
    <group name="RoadBarriersGroup">
      {/* 1. Continuous Galvanized Steel Rail Ribbon */}
      <mesh
        name="RoadBarriers_SteelRail"
        geometry={railGeometry}
        castShadow
        receiveShadow
        userData={{
          type: 'barrier',
          collidable: true,
          collisionType: 'guardrail',
          height: BARRIER_HEIGHT,
        }}
      >
        <meshStandardMaterial
          color="#94A3B8"
          metalness={0.88}
          roughness={0.32}
        />
      </mesh>

      {/* 2. Instanced Steel Support Posts */}
      <instancedMesh
        ref={postsInstancedRef}
        name="RoadBarriers_Posts"
        args={[null, null, postTransforms.length]}
        castShadow
        receiveShadow
        userData={{ type: 'barrier_post', collidable: true }}
      >
        <boxGeometry args={[0.08, BARRIER_HEIGHT, 0.1]} />
        <meshStandardMaterial
          color="#64748B"
          metalness={0.85}
          roughness={0.4}
        />
      </instancedMesh>

      {/* 3. Instanced Retro-reflective Safety Markers (Amber caps) */}
      <instancedMesh
        ref={reflectorsInstancedRef}
        name="RoadBarriers_Reflectors"
        args={[null, null, reflectorTransforms.length]}
        userData={{ type: 'reflector', collidable: false }}
      >
        <boxGeometry args={[0.06, 0.08, 0.03]} />
        <meshStandardMaterial
          color="#F59E0B"
          emissive="#D97706"
          emissiveIntensity={0.6}
          roughness={0.2}
          metalness={0.1}
        />
      </instancedMesh>
    </group>
  );
}
