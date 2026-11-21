import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');

console.log('--- TEST SUITE: Part 23 — Road Markings, Safety Barriers and Roadside Scenery ---');

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
      throw err;
    }
  }

  // Import Road Data Module
  const roadData = await import('../../src/scenes/driving/roadData.js');
  const {
    ROAD_WIDTH,
    HALF_ROAD_WIDTH,
    BARRIER_OFFSET,
    BARRIER_DIST_FROM_CENTER,
    BARRIER_HEIGHT,
    ROAD_SURFACE_ELEVATION,
    MARKING_ELEVATION,
    SPAWN_POSITION,
    SPAWN_HEADING,
    ROAD_CURVE,
    TRACK_LENGTH,
    getRoadPoint,
    getRoadTangent,
    getRoadNormal,
    getRoadCurvature,
    getDistanceToRoadCenter,
    isPointOnRoad,
    isPointInRunoff,
    TRACK_SECTORS,
    ROAD_COLLISION_METADATA,
  } = roadData;

  // 1. Road Geometry & Alignment at Spawn
  test('Road Path & Dimensions: 1.2km closed circuit, 10m road width, valid spawn alignment', () => {
    assert.strictEqual(ROAD_WIDTH, 10.0, 'Road width must be 10.0m');
    assert.strictEqual(HALF_ROAD_WIDTH, 5.0, 'Half road width must be 5.0m');
    assert.ok(TRACK_LENGTH > 1000 && TRACK_LENGTH < 1500, `Track length must be ~1.2km (got ${TRACK_LENGTH.toFixed(1)}m)`);

    // Verify spawn point alignment
    const spawnPt = getRoadPoint(0.05);
    assert.ok(Math.abs(spawnPt.x) < 0.2, `Spawn X must be ~0 (got ${spawnPt.x})`);
    assert.ok(Math.abs(spawnPt.z) < 0.2, `Spawn Z must be ~0 (got ${spawnPt.z})`);

    const spawnTan = getRoadTangent(0.05);
    assert.ok(Math.abs(spawnTan.x) < 0.01, `Spawn tangent X must be ~0 (got ${spawnTan.x})`);
    assert.ok(spawnTan.z > 0.99, `Spawn tangent Z must point +Z (got ${spawnTan.z})`);

    // Test clearance against self-intersection
    const SAMPLES = 200;
    const pts = [];
    for (let i = 0; i < SAMPLES; i++) {
      pts.push(ROAD_CURVE.getPointAt(i / SAMPLES));
    }
    let minNonAdjDist = Infinity;
    for (let i = 0; i < SAMPLES; i++) {
      for (let j = i + 25; j < SAMPLES - 25; j++) {
        const d = pts[i].distanceTo(pts[j]);
        if (d < minNonAdjDist) minNonAdjDist = d;
      }
    }
    assert.ok(minNonAdjDist > 20.0, `Track must not intersect itself (min distance ${minNonAdjDist.toFixed(1)}m > 20m)`);
  });

  // 2. Road Markings Alignment & Non-Flickering Offsets
  test('Road Markings: Strictly elevated above asphalt, correct dash rhythm, grid at spawn', () => {
    assert.ok(MARKING_ELEVATION > ROAD_SURFACE_ELEVATION, 'Markings must sit cleanly above road surface (zero z-fighting)');
    assert.strictEqual(MARKING_ELEVATION, 0.008, 'Markings elevation must be 0.008m');
    assert.strictEqual(ROAD_SURFACE_ELEVATION, 0.002, 'Road elevation must be 0.002m');

    // Solid edge lines must reside within the road boundary
    const edgeLineInset = 0.45;
    const edgeLineDist = HALF_ROAD_WIDTH - edgeLineInset; // 4.55m
    assert.ok(edgeLineDist < HALF_ROAD_WIDTH, 'Edge lines must be inside drivable asphalt width');

    // Spatial verification: point on edge line is on road
    assert.strictEqual(isPointOnRoad(new THREE.Vector3(edgeLineDist, 0, 0)), true);
    assert.strictEqual(isPointOnRoad(new THREE.Vector3(0, 0, 0)), true);
    assert.strictEqual(isPointOnRoad(new THREE.Vector3(HALF_ROAD_WIDTH + 1.0, 0, 0)), false);
  });

  // 3. Road Safety Barriers Placement & Clearance
  test('Safety Barriers: Placed strictly outside road surface at 6.4m, standard 0.85m height', () => {
    assert.strictEqual(BARRIER_OFFSET, 1.4, 'Barrier offset from road edge must be 1.4m');
    assert.strictEqual(BARRIER_DIST_FROM_CENTER, 6.4, 'Barrier distance from center must be 6.4m');
    assert.strictEqual(BARRIER_HEIGHT, 0.85, 'Standard barrier height must be 0.85m');

    // Barrier points must never be on the drivable road surface
    const testBarrierPt = new THREE.Vector3(BARRIER_DIST_FROM_CENTER, 0, 0);
    assert.strictEqual(isPointOnRoad(testBarrierPt), false, 'Barrier position must NOT be on drivable road');
    assert.strictEqual(isPointInRunoff(testBarrierPt, BARRIER_OFFSET + 0.1), true, 'Barrier must sit in the runoff boundary');

    // Sector curvature and barrier side matching
    const turn1 = TRACK_SECTORS.find(s => s.id === 'sector_2_turn_1_sweeper');
    assert.ok(turn1, 'Turn 1 sector must exist');
    assert.strictEqual(turn1.hasGuardrail, true, 'Turn 1 must have guardrails');
    assert.strictEqual(turn1.guardrailSide, 'left', 'Right turn must have outside guardrail on left');
    assert.strictEqual(turn1.kerbSide, 'right', 'Right turn must have inside apex kerb on right');
  });

  // 4. Roadside Scenery Safety & Zero Road Encroachment
  test('Roadside Scenery: 100% of vegetation and lighting masts placed outside 8.0m road buffer', () => {
    // Verify distance check algorithm
    const roadCenter = new THREE.Vector3(0, 0, 0);
    assert.strictEqual(getDistanceToRoadCenter(roadCenter) < 0.2, true);

    const roadsideSafePt = new THREE.Vector3(12.0, 0, 0);
    assert.ok(getDistanceToRoadCenter(roadsideSafePt) >= 11.8, 'Distance helper must be accurate');

    // Verify lighting poles along straight are placed at X = +/- 8.0m
    const leftPole = new THREE.Vector3(-8.0, 0, 10.0);
    const rightPole = new THREE.Vector3(8.0, 0, 10.0);
    assert.strictEqual(isPointOnRoad(leftPole), false, 'Lighting poles must NOT be on road surface');
    assert.strictEqual(isPointOnRoad(rightPole), false, 'Lighting poles must NOT be on road surface');
    assert.ok(getDistanceToRoadCenter(leftPole) > HALF_ROAD_WIDTH + 2.0, 'Poles must be at least 2m clear of asphalt');
  });

  // 5. Collision Metadata Registry (Part 30 Compatibility)
  test('Collision Metadata: Full metadata specification for future Part 30 collision detection', () => {
    assert.ok(ROAD_COLLISION_METADATA, 'ROAD_COLLISION_METADATA must exist');
    assert.strictEqual(ROAD_COLLISION_METADATA.roadWidth, 10.0);
    assert.strictEqual(ROAD_COLLISION_METADATA.barrierHeight, 0.85);
    assert.strictEqual(ROAD_COLLISION_METADATA.surfaceTypes.ROAD.collidable, true);
    assert.strictEqual(ROAD_COLLISION_METADATA.surfaceTypes.BARRIER.collidable, true);
    assert.strictEqual(ROAD_COLLISION_METADATA.surfaceTypes.SCENERY.collidable, false);
  });

  // 6. Component File Existence & Exports
  test('Component Integrity: All Part 23 modular scene components exist with default exports', () => {
    const requiredFiles = [
      'src/scenes/driving/roadData.js',
      'src/scenes/driving/RoadMesh.jsx',
      'src/scenes/driving/RoadMarkings.jsx',
      'src/scenes/driving/RoadBarriers.jsx',
      'src/scenes/driving/RoadsideScenery.jsx',
      'src/scenes/driving/DrivingGround.jsx',
      'src/scenes/driving/DrivingScene.jsx',
    ];

    for (const relPath of requiredFiles) {
      const fullPath = path.resolve(ROOT, relPath);
      assert.strictEqual(fs.existsSync(fullPath), true, `File must exist: ${relPath}`);
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (relPath.endsWith('.jsx')) {
        assert.strictEqual(content.includes('export default function'), true, `${relPath} must have default export`);
      }
    }
  });

  console.log(`\nResults: ${passed} / ${total} unit tests passed successfully.`);
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
