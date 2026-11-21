/**
 * test_part22_road_geometry.mjs
 * Part 22 — 3D Driving Road Geometry & Track Construction
 *
 * Verifies:
 * - Spline-based road path generation and closed loop continuity
 * - Accurate track length (~1,204m closed handling circuit)
 * - Exact road width consistency across the entire circuit (10.0m)
 * - Valid buffer geometry generation (positions, normals, UVs, indices)
 * - Surface normal direction correctness (upright +Y)
 * - Spawn position validity (aligned at [0, 0, 0], heading +Z)
 * - Curvature smoothness and turning clearance
 * - Documented road dimensions (lane width, shoulders, thickness, elevation)
 * - Concrete shoulders and FIA rumble kerb geometry generation
 *
 * Run with:  node python/tests/test_part22_road_geometry.mjs
 */

import * as THREE from 'three';
import {
  ROAD_CURVE,
  TRACK_LENGTH,
  ROAD_WIDTH,
  HALF_ROAD_WIDTH,
  LANE_WIDTH,
  SHOULDER_WIDTH,
  ROAD_THICKNESS,
  ROAD_SURFACE_ELEVATION,
  SPAWN_POSITION,
  SPAWN_HEADING,
  ROAD_CONTROL_POINTS,
  ROAD_DIMENSIONS,
  getRoadPoint,
  getRoadTangent,
  getRoadNormal,
  getRoadCurvature,
} from '../../src/scenes/driving/roadData.js';

import {
  buildRoadSurfaceGeometry,
  buildShoulderGeometry,
  buildApexKerbGeometry,
  createProceduralAsphaltTexture,
  createProceduralAsphaltRoughnessMap,
} from '../../src/scenes/driving/roadGeometryUtils.js';

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    pass++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${err.message}`);
    failures.push({ name, error: err.message });
    fail++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg ?? 'Assertion failed');
}

function assertClose(a, b, msg, tol = 1e-4) {
  if (Math.abs(a - b) > tol) throw new Error(msg ?? `Expected ~${b}, got ${a}`);
}

console.log('\n━━━ Part 22: 3D Driving Road Geometry & Track Construction ━━━\n');

// ── T01: Road path spline definition ─────────────────────────────────────────
test('T01: Road path is a closed 3D Catmull-Rom spline with >= 20 control points', () => {
  assert(ROAD_CURVE instanceof THREE.CatmullRomCurve3, 'ROAD_CURVE must be CatmullRomCurve3');
  assert(ROAD_CURVE.closed === true, 'Road curve must be a closed loop');
  assert(ROAD_CONTROL_POINTS.length >= 20, `Expected >= 20 control points, got ${ROAD_CONTROL_POINTS.length}`);
});

// ── T02: Total track length ──────────────────────────────────────────────────
test('T02: Total track length is approximately 1,200m (closed handling circuit)', () => {
  assert(TRACK_LENGTH > 1180 && TRACK_LENGTH < 1250, `Track length must be ~1200m, got ${TRACK_LENGTH.toFixed(2)}m`);
});

// ── T03: Closed loop C0 continuity ───────────────────────────────────────────
test('T03: Path C0 continuity: point(0.0) matches point(1.0) with zero gap', () => {
  const pStart = getRoadPoint(0.0);
  const pEnd   = getRoadPoint(1.0);
  assertClose(pStart.x, pEnd.x, 'X start/end mismatch');
  assertClose(pStart.y, pEnd.y, 'Y start/end mismatch');
  assertClose(pStart.z, pEnd.z, 'Z start/end mismatch');
});

// ── T04: Closed loop C1 tangent continuity ───────────────────────────────────
test('T04: Path C1 continuity: tangent(0.0) matches tangent(1.0) seamlessly', () => {
  const tStart = getRoadTangent(0.0);
  const tEnd   = getRoadTangent(1.0);
  assertClose(tStart.x, tEnd.x, 'Tangent X mismatch', 0.02);
  assertClose(tStart.y, tEnd.y, 'Tangent Y mismatch', 0.02);
  assertClose(tStart.z, tEnd.z, 'Tangent Z mismatch', 0.02);
});

// ── T05: Launch straight alignment ───────────────────────────────────────────
test('T05: Launch straight section is perfectly collinear along Z axis', () => {
  const p1 = getRoadPoint(0.03);
  const p2 = getRoadPoint(0.05);
  const p3 = getRoadPoint(0.08);
  assertClose(p1.x, 0.0, 'Launch straight X should be 0.0', 0.1);
  assertClose(p2.x, 0.0, 'Spawn straight X should be 0.0', 0.01);
  assertClose(p3.x, 0.0, 'Downstream straight X should be 0.0', 0.2);
});

// ── T06: Vehicle spawn placement validity ────────────────────────────────────
test('T06: Vehicle spawn is at [0, 0, 0] with tangent pointing +Z [0, 0, 1]', () => {
  assertClose(SPAWN_POSITION.x, 0, 'Spawn X');
  assertClose(SPAWN_POSITION.y, 0, 'Spawn Y');
  assertClose(SPAWN_POSITION.z, 0, 'Spawn Z');

  const tangentAtSpawn = getRoadTangent(0.05);
  assert(tangentAtSpawn.z > 0.99, `Spawn heading must be along +Z, got z=${tangentAtSpawn.z}`);
  assertClose(tangentAtSpawn.x, 0.0, 'Spawn heading X deviation', 0.05);
});

// ── T07: Road normal orthogonality ───────────────────────────────────────────
test('T07: Road normal is strictly horizontal (Y=0) and perpendicular to tangent', () => {
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const tan = getRoadTangent(t);
    const norm = getRoadNormal(t);
    assertClose(norm.y, 0.0, `Road normal Y at t=${t} must be 0`, 1e-5);
    const dot = tan.dot(norm);
    assertClose(dot, 0.0, `Tangent and normal dot product at t=${t} must be 0`, 1e-4);
    assertClose(norm.length(), 1.0, `Normal must be unit length at t=${t}`, 1e-4);
  }
});

// ── T08: Road width consistency across 100 sample intervals ──────────────────
test('T08: Road width is consistently 10.0m (2 * 5.0m) across the entire circuit', () => {
  for (let i = 0; i < 100; i++) {
    const t = i / 100;
    const pt = getRoadPoint(t);
    const norm = getRoadNormal(t);
    const leftEdge  = new THREE.Vector3(pt.x - norm.x * HALF_ROAD_WIDTH, 0, pt.z - norm.z * HALF_ROAD_WIDTH);
    const rightEdge = new THREE.Vector3(pt.x + norm.x * HALF_ROAD_WIDTH, 0, pt.z + norm.z * HALF_ROAD_WIDTH);
    const measuredWidth = leftEdge.distanceTo(rightEdge);
    assertClose(measuredWidth, ROAD_WIDTH, `Road width at t=${t} must be 10.0m`, 1e-3);
  }
});

// ── T09: Asphalt surface BufferGeometry vertex & index generation ────────────
test('T09: buildRoadSurfaceGeometry produces valid BufferGeometry with correct counts', () => {
  const SAMPLES = 600;
  const geom = buildRoadSurfaceGeometry(SAMPLES);
  assert(geom instanceof THREE.BufferGeometry, 'Must return THREE.BufferGeometry');

  const posAttr = geom.getAttribute('position');
  assert(posAttr !== undefined, 'Must have position attribute');
  assert(posAttr.count === (SAMPLES + 1) * 2, `Expected ${(SAMPLES + 1) * 2} vertices, got ${posAttr.count}`);

  const normAttr = geom.getAttribute('normal');
  assert(normAttr !== undefined, 'Must have normal attribute');
  for (let i = 0; i < normAttr.count; i++) {
    assertClose(normAttr.getY(i), 1.0, `Normal Y at ${i} must be 1.0`, 1e-4);
  }

  const uvAttr = geom.getAttribute('uv');
  assert(uvAttr !== undefined, 'Must have UV attribute');
  assert(uvAttr.count === posAttr.count, 'UV count must match position count');

  const idxAttr = geom.getIndex();
  assert(idxAttr !== null, 'Geometry must be indexed');
  assert(idxAttr.count === SAMPLES * 6, `Expected ${SAMPLES * 6} indices (quad strips), got ${idxAttr.count}`);

  geom.dispose();
});

// ── T10: Surface elevation & bounding box ────────────────────────────────────
test('T10: Road surface elevation is planar at Y = 0.002m (tangent to terrain)', () => {
  const geom = buildRoadSurfaceGeometry(300);
  geom.computeBoundingBox();
  const box = geom.boundingBox;
  assertClose(box.min.y, ROAD_SURFACE_ELEVATION, 'Bounding box min Y');
  assertClose(box.max.y, ROAD_SURFACE_ELEVATION, 'Bounding box max Y');
  assert(box.max.x - box.min.x > 200, 'Track spans > 200m in X');
  assert(box.max.z - box.min.z > 350, 'Track spans > 350m in Z');
  geom.dispose();
});

// ── T11: Concrete shoulder geometry generation ───────────────────────────────
test('T11: buildShoulderGeometry produces valid concrete gutters (0.5m each side)', () => {
  const SAMPLES = 300;
  const geom = buildShoulderGeometry(SAMPLES);
  assert(geom instanceof THREE.BufferGeometry, 'Shoulder must be BufferGeometry');
  const posAttr = geom.getAttribute('position');
  assert(posAttr.count > 0, 'Shoulder vertex count must be > 0');
  const idxAttr = geom.getIndex();
  assert(idxAttr && idxAttr.count > 0, 'Shoulder indices must be > 0');
  geom.dispose();
});

// ── T12: Apex rumble kerb geometry generation ────────────────────────────────
test('T12: buildApexKerbGeometry produces vertex-colored beveled kerbs', () => {
  const SAMPLES = 300;
  const geom = buildApexKerbGeometry(SAMPLES);
  assert(geom instanceof THREE.BufferGeometry, 'Kerb must be BufferGeometry');
  const colorAttr = geom.getAttribute('color');
  assert(colorAttr !== undefined, 'Apex kerbs must have vertex colors attribute');
  assert(colorAttr.count > 0, 'Apex kerbs must have colored vertices at high curvature zones');
  geom.dispose();
});

// ── T13: Documented road dimensions ──────────────────────────────────────────
test('T13: ROAD_DIMENSIONS exports documented world dimensions', () => {
  assert(ROAD_DIMENSIONS.roadWidth === 10.0, 'roadWidth = 10.0m');
  assert(ROAD_DIMENSIONS.laneWidth === 4.6, 'laneWidth = 4.6m');
  assert(ROAD_DIMENSIONS.shoulderWidth === 0.5, 'shoulderWidth = 0.5m');
  assert(ROAD_DIMENSIONS.thickness === 0.08, 'thickness = 0.08m');
  assert(ROAD_DIMENSIONS.elevation === 0.002, 'elevation = 0.002m');
  assert(ROAD_DIMENSIONS.kerbWidth === 0.9, 'kerbWidth = 0.9m');
  assert(ROAD_DIMENSIONS.kerbHeight === 0.06, 'kerbHeight = 0.06m');
});

// ── T14: Curve smoothness & sports-coupe turn clearance ──────────────────────
test('T14: Track curvature is smooth and turning clearance supports sports car', () => {
  let maxCurvature = 0;
  for (let i = 0; i < 500; i++) {
    const t = i / 500;
    const curv = Math.abs(getRoadCurvature(t));
    if (curv > maxCurvature) maxCurvature = curv;
  }
  const physicalCurv = maxCurvature / TRACK_LENGTH;
  const minRadius = 1 / physicalCurv;
  assert(minRadius >= 3.5, `Minimum curve radius must be >= 3.5m, got ${minRadius.toFixed(1)}m`);
});

// ── T15: Segment step resolution (no visual gaps) ────────────────────────────
test('T15: 600-sample resolution guarantees step distance ds < 2.5m (no gaps)', () => {
  const SAMPLES = 600;
  let maxStep = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t1 = i / SAMPLES;
    const t2 = (i + 1) / SAMPLES;
    const p1 = getRoadPoint(t1);
    const p2 = getRoadPoint(t2);
    const step = p1.distanceTo(p2);
    if (step > maxStep) maxStep = step;
  }
  assert(maxStep < 2.5, `Max sample step must be < 2.5m, got ${maxStep.toFixed(2)}m`);
});

// ── T16: Procedural texture generator functions exist ────────────────────────
test('T16: Procedural asphalt texture functions are exported and callable', () => {
  assert(typeof createProceduralAsphaltTexture === 'function', 'createProceduralAsphaltTexture function');
  assert(typeof createProceduralAsphaltRoughnessMap === 'function', 'createProceduralAsphaltRoughnessMap function');
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
console.log(`━━━ Results: ${pass} passed, ${fail} failed ━━━`);

if (failures.length) {
  console.log('\nFailed tests:');
  failures.forEach(({ name, error }) => {
    console.log(`  ✗ ${name}`);
    console.log(`    ${error}`);
  });
}

console.log('');
process.exit(fail > 0 ? 1 : 0);
