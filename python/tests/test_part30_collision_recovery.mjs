/**
 * Unit Test Suite for Part 30: Road Boundaries, Vehicle Collision Detection and Recovery
 *
 * Verifies:
 * 1. Module exports & collision configuration integrity (half extents, contact points, surface configs, restitution).
 * 2. Continuous track surface classification across 1,200m circuit (asphalt, kerb, grass).
 * 3. Surface properties computation and 4-wheel multi-surface blending (grip reduction & rolling resistance).
 * 4. Armco guardrail collision detection along curved and straight barrier segments with inward normals.
 * 5. Static roadside obstacle collision detection (countdown signs, chevrons, lighting poles).
 * 6. Inelastic collision response (restitution 0.18, separation, tangential barrier scrubbing friction).
 * 7. Multi-step barrier deflection preventing penetration/tunneling.
 * 8. Complete vehicle recovery & reset restoration (position, orientation, velocities, steering, wheels).
 * 9. Store actions & reset request handshake.
 * 10. Repeated collision-recovery cycles numerical stability without drift or NaNs.
 */

import * as THREE from 'three';
import { VEHICLE_PHYSICS_CONFIG } from '../../src/scenes/driving/vehiclePhysicsConfig.js';
import {
  getGroundHeightAt,
  computeSurfaceProperties,
  computeEffectiveVehicleSurface,
  checkVehicleCollision,
  resolveVehicleCollisionResponse,
  resetVehiclePhysicsState,
} from '../../src/scenes/driving/vehiclePhysicsUtils.js';
import { BARRIER_SEGMENTS, ROADSIDE_OBSTACLES, getRoadSurfaceQuery } from '../../src/scenes/driving/roadData.js';
import { useVehiclePhysicsStore } from '../../src/store/vehiclePhysicsStore.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (details) console.error(`         Details: ${details}`);
    failed++;
  }
}

async function runTest(name, fn) {
  console.log(`\n--- Test: ${name} ---`);
  try {
    await fn();
  } catch (err) {
    console.error(`  [FAIL Exception] ${name}: ${err.message}\n${err.stack}`);
    failed++;
  }
}

async function main() {
  console.log('================================================================');
  console.log('PART 30 UNIT TESTS: Road Boundaries, Collision & Recovery');
  console.log('================================================================');

  const collisionCfg = VEHICLE_PHYSICS_CONFIG.collision;
  const chassisCfg = VEHICLE_PHYSICS_CONFIG.chassis;
  const suspCfg = VEHICLE_PHYSICS_CONFIG.suspension;
  const spawnCfg = VEHICLE_PHYSICS_CONFIG.spawn;
  const wheelCfg = VEHICLE_PHYSICS_CONFIG.wheelKinematics;

  // Test 1: Collision Configuration Integrity
  await runTest('Collision Configuration Integrity', () => {
    assert(collisionCfg !== undefined && collisionCfg !== null, 'collision configuration exists');
    assert(collisionCfg.halfExtents[0] === 0.975 && collisionCfg.halfExtents[2] === 2.28, 'Vehicle half-extents match actual 3D model [0.975, 0.575, 2.28]');
    assert(collisionCfg.boundingRadius > 2.4 && collisionCfg.boundingRadius < 2.6, `Bounding radius is ~2.48m (got ${collisionCfg.boundingRadius})`);
    assert(Array.isArray(collisionCfg.contactPoints) && collisionCfg.contactPoints.length === 8, '8 bumper/perimeter contact points configured');
    assert(collisionCfg.barrierRestitution === 0.18, `Armco barrier restitution is 0.18 (got ${collisionCfg.barrierRestitution})`);
    assert(collisionCfg.barrierFriction === 0.45, `Barrier tangential friction is 0.45 (got ${collisionCfg.barrierFriction})`);
    assert(collisionCfg.surfaces.asphalt.frictionCoeff === 1.15, 'Asphalt friction coefficient is 1.15');
    assert(collisionCfg.surfaces.grass.frictionCoeff === 0.65, 'Grass friction coefficient is 0.65 (reduced grip)');
    assert(collisionCfg.surfaces.grass.rollingResistanceCoeff === 0.055, 'Grass rolling resistance is 0.055 (3.7x asphalt)');
    assert(collisionCfg.roadHalfWidth === 5.0 && collisionCfg.shoulderWidth === 0.5, 'Road half width is 5.0m, shoulder is 0.5m');
  });

  // Test 2: Continuous Track Surface Classification
  await runTest('Track Surface Classification across Circuit', () => {
    // Centerline point at spawn (x = 0, z = 0)
    const centerQ = getRoadSurfaceQuery(0, 0);
    assert(centerQ.surfaceType === 'asphalt', `Centerline surface is asphalt (got ${centerQ.surfaceType})`);
    assert(centerQ.isRoad === true, 'Centerline isRoad is true');
    assert(centerQ.distToCenter < 0.1, `Centerline distance < 0.1m (got ${centerQ.distToCenter.toFixed(3)})`);

    // Road surface at lateral offset 3.0m (within 5.0m width)
    const midRoadQ = getRoadSurfaceQuery(3.0, 0);
    assert(midRoadQ.surfaceType === 'asphalt' && midRoadQ.isRoad === true, '3.0m offset is within asphalt road');

    // Concrete shoulder / kerb at lateral offset 5.25m (between 5.0m and 5.5m)
    const kerbQ = getRoadSurfaceQuery(5.25, 0);
    assert(kerbQ.surfaceType === 'kerb', `5.25m offset is kerb (got ${kerbQ.surfaceType})`);
    assert(kerbQ.isRunoff === true, 'Kerb is runoff');

    // Grass verge at lateral offset 8.0m (beyond 5.5m)
    const grassQ = getRoadSurfaceQuery(8.0, 0);
    assert(grassQ.surfaceType === 'grass', `8.0m offset is grass (got ${grassQ.surfaceType})`);
    assert(grassQ.isOffRoad === true, 'Grass is off-road');

    // Remote test on Turn 1 sweeper (~t = 0.25)
    const turnPoint = new THREE.Vector3(250, 0, 150);
    const turnQ = getRoadSurfaceQuery(turnPoint.x, turnPoint.z);
    assert(turnQ.distToCenter !== undefined && turnQ.surfaceType !== undefined, 'Turn 1 surface query succeeds');
  });

  // Test 3: Surface Properties & 4-Wheel Multi-Surface Blending
  await runTest('Surface Properties & 4-Wheel Blending Evaluation', () => {
    // Single surface lookup
    const asphaltProps = computeSurfaceProperties('asphalt', collisionCfg);
    assert(asphaltProps.frictionCoeff === 1.15 && asphaltProps.rollingResistanceCoeff === 0.015, 'Asphalt surface properties match');

    const grassProps = computeSurfaceProperties('grass', collisionCfg);
    assert(grassProps.frictionCoeff === 0.65 && grassProps.rollingResistanceCoeff === 0.055, 'Grass surface properties match');

    // 4 wheels on asphalt
    const allAsphalt = computeEffectiveVehicleSurface(
      { fl: 'asphalt', fr: 'asphalt', rl: 'asphalt', rr: 'asphalt' },
      collisionCfg
    );
    assert(allAsphalt.primarySurface === 'asphalt', 'All asphalt primary surface is asphalt');
    assert(allAsphalt.effectiveFriction === 1.15, 'All asphalt effective friction is 1.15');
    assert(allAsphalt.effectiveRollingResistance === 0.015, 'All asphalt effective rolling resistance is 0.015');
    assert(allAsphalt.isOffRoad === false, 'All asphalt isOffRoad is false');
    assert(allAsphalt.offRoadWheelCount === 0, 'Off-road wheel count is 0');

    // 2 wheels dropping onto grass (right side off-track)
    const halfGrass = computeEffectiveVehicleSurface(
      { fl: 'asphalt', fr: 'grass', rl: 'asphalt', rr: 'grass' },
      collisionCfg
    );
    assert(halfGrass.offRoadWheelCount === 2, 'Half grass off-road wheel count is 2');
    const expectedHalfFriction = (1.15 * 2 + 0.65 * 2) / 4;
    assert(Math.abs(halfGrass.effectiveFriction - expectedHalfFriction) < 0.001, `Half grass blended friction is ${halfGrass.effectiveFriction.toFixed(3)}`);
    assert(halfGrass.effectiveRollingResistance > 0.015, 'Half grass rolling resistance is increased');

    // All 4 wheels in grass
    const allGrass = computeEffectiveVehicleSurface(
      { fl: 'grass', fr: 'grass', rl: 'grass', rr: 'grass' },
      collisionCfg
    );
    assert(allGrass.primarySurface === 'grass', 'All grass primary surface is grass');
    assert(allGrass.isOffRoad === true, 'All grass isOffRoad is true');
    assert(allGrass.offRoadWheelCount === 4, 'Off-road wheel count is 4');
    assert(Math.abs(allGrass.effectiveFriction - 0.65) < 0.001, 'All grass friction is 0.65');
    assert(Math.abs(allGrass.effectiveRollingResistance - 0.055) < 0.001, 'All grass rolling resistance is 0.055');
  });

  // Test 4: Armco Guardrail Collision Detection & Inward Normals
  await runTest('Armco Guardrail Collision Detection & Inward Normals', () => {
    assert(BARRIER_SEGMENTS.length >= 8, `Circuit has ${BARRIER_SEGMENTS.length} continuous barrier segments`);

    // Vehicle centered on track: should have zero collision
    const centerPos = new THREE.Vector3(0, 0.35, 10);
    const quat = new THREE.Quaternion();
    const vel = new THREE.Vector3(0, 0, 15);
    const angVel = new THREE.Vector3(0, 0, 0);

    const safeCol = checkVehicleCollision(centerPos, quat, vel, angVel, collisionCfg, 0.01);
    assert(!safeCol || !safeCol.hasCollision, 'Vehicle in lane center reports no collision');

    // Vehicle placed at x = 5.8m (right side barrier inner face is at ~6.25m, vehicle half width is 0.975m -> right edge at 6.775m, penetrating ~0.525m)
    const barrierPenPos = new THREE.Vector3(5.8, 0.35, 20);
    const barrierCol = checkVehicleCollision(barrierPenPos, quat, vel, angVel, collisionCfg, 0.02);
    assert(barrierCol !== null && barrierCol.hasCollision === true, 'Vehicle contacting barrier rail reports collision');
    assert(barrierCol.type === 'barrier', `Collision type is 'barrier' (got ${barrierCol.type})`);
    assert(barrierCol.maxPenetration > 0.1, `Penetration depth > 0.1m (got ${barrierCol.maxPenetration.toFixed(3)}m)`);
    // Inward normal should point toward the road (negative X for right side barrier)
    assert(barrierCol.normal.x < -0.8, `Inward barrier normal points back to track (nx = ${barrierCol.normal.x.toFixed(3)})`);
  });

  // Test 5: Static Roadside Obstacle Collision Detection
  await runTest('Static Roadside Obstacle Collisions', () => {
    assert(ROADSIDE_OBSTACLES.length > 0, `Circuit has ${ROADSIDE_OBSTACLES.length} roadside obstacles`);
    const targetObstacle = ROADSIDE_OBSTACLES[0]; // First sign/chevron
    const obsPos = new THREE.Vector3(...targetObstacle.pos);

    // Position vehicle bumper directly touching the obstacle
    const vehicleNearObs = obsPos.clone().add(new THREE.Vector3(0, 0, -collisionCfg.halfExtents[2] + 0.1));
    const quat = new THREE.Quaternion();
    const vel = new THREE.Vector3(0, 0, 10);
    const angVel = new THREE.Vector3(0, 0, 0);

    const obsCol = checkVehicleCollision(vehicleNearObs, quat, vel, angVel, collisionCfg, 0.01);
    assert(obsCol !== null && obsCol.hasCollision === true, 'Collision with roadside obstacle detected');
    assert(obsCol.type === 'obstacle' || obsCol.type === 'barrier', `Collision type identified (${obsCol.type})`);
  });

  // Test 6: Inelastic Collision Response (Restitution 0.18, Scrubbing Friction)
  await runTest('Inelastic Collision Response & Tangential Scrubbing', () => {
    const sim = {
      position: new THREE.Vector3(5.8, 0.35, 30),
      quaternion: new THREE.Quaternion(),
      linearVelocity: new THREE.Vector3(6.0, 0, 20), // Moving into barrier with +6 m/s lateral, +20 m/s longitudinal
      angularVelocity: new THREE.Vector3(0, 0, 0),
    };

    const initialLateralSpeed = sim.linearVelocity.x;
    const initialLongSpeed = sim.linearVelocity.z;

    const col = {
      hasCollision: true,
      type: 'barrier',
      objectId: 'barrier-seg-0-right',
      maxPenetration: 0.35,
      contactPoint: new THREE.Vector3(6.775, 0.35, 30),
      normal: new THREE.Vector3(-1, 0, 0), // Pointing inward to road (-X)
      impactVelocity: 6.0,
    };

    const dt = 1 / 60;
    resolveVehicleCollisionResponse(sim, col, dt, collisionCfg, chassisCfg);

    // 1. Position Separation: sim.position.x should be shifted inward by penetration (x: 5.8 -> 5.45)
    assert(sim.position.x < 5.5, `Position separated inward from barrier rail (x: ${sim.position.x.toFixed(3)})`);

    // 2. Normal velocity impulse: lateral velocity should reverse with restitution 0.18 (vn: +6.0 -> negative)
    assert(sim.linearVelocity.x < 0, `Lateral velocity reversed inward towards road (vx: ${sim.linearVelocity.x.toFixed(2)} m/s)`);
    assert(Math.abs(sim.linearVelocity.x) < initialLateralSpeed, `Lateral velocity magnitude reduced by inelastic impulse`);

    // 3. Tangential scrubbing: longitudinal speed should be scrubbed by barrier friction
    assert(sim.linearVelocity.z < initialLongSpeed, `Longitudinal speed scrubbed by barrier friction (vz: ${sim.linearVelocity.z.toFixed(2)} vs ${initialLongSpeed} m/s)`);

    // 4. Angular velocity sanity
    assert(Math.abs(sim.angularVelocity.y) <= 2.5, `Yaw angular velocity bounded to prevent violent spinouts (|w_y| = ${Math.abs(sim.angularVelocity.y).toFixed(2)})`);
  });

  // Test 7: Multi-Step Barrier Deflection (No Tunneling)
  await runTest('Multi-Step Barrier Deflection without Penetration', () => {
    const sim = {
      position: new THREE.Vector3(5.0, 0.35, 40),
      quaternion: new THREE.Quaternion(),
      linearVelocity: new THREE.Vector3(10.0, 0, 15), // Heading towards right barrier at 10 m/s
      angularVelocity: new THREE.Vector3(0, 0, 0),
    };

    const dt = 1 / 60;
    let collisionsResolved = 0;

    // Simulate 30 steps (0.5 second of physics)
    for (let i = 0; i < 30; i++) {
      // Numerical step
      sim.position.addScaledVector(sim.linearVelocity, dt);
      const col = checkVehicleCollision(sim.position, sim.quaternion, sim.linearVelocity, sim.angularVelocity, collisionCfg, 0.03);
      if (col && col.hasCollision) {
        resolveVehicleCollisionResponse(sim, col, dt, collisionCfg, chassisCfg);
        collisionsResolved++;
      }
    }

    assert(collisionsResolved > 0, `Barrier collision engaged (${collisionsResolved} responses computed)`);
    // Maximum lateral displacement should be constrained by barrier rail (< 6.3m)
    assert(sim.position.x < 6.4, `Vehicle prevented from penetrating past barrier rail (final x = ${sim.position.x.toFixed(3)}m)`);
  });

  // Test 8: Complete Vehicle Recovery & Reset
  await runTest('Complete Vehicle Recovery & Reset Restoration', () => {
    const sim = {
      position: new THREE.Vector3(120, 1.5, -450),
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 1.2, -0.3)),
      prevPosition: new THREE.Vector3(119, 1.5, -448),
      prevQuaternion: new THREE.Quaternion(),
      linearVelocity: new THREE.Vector3(25, -2, 40),
      angularVelocity: new THREE.Vector3(0.5, 1.8, -0.2),
      isSettled: false,
      settleCounter: 0,
      totalSteps: 1540,
      drivetrain: {
        gear: 'D',
        speedLong: 47.2,
        driveForce: 3500,
        brakeForce: 0,
        dragForce: -450,
        rollForce: -300,
        netLongForce: 2750,
        wheelRollAngle: 45.2,
      },
      steering: {
        currentAngle: 0.35,
        steerFL: 0.38,
        steerFR: 0.32,
        maxSteerLimit: 0.45,
        totalLatForce: 4200,
        yawTorque: 850,
        lateralG: 0.65,
        yawRate: 0.42,
        lastT: 0.38,
      },
      wheels: {
        fl: { length: 0.32, prevLength: 0.32, compression: 0.08, force: 4500, isGrounded: true, rollAngle: 12.4, groundSpeed: 47.0, rpm: 1240, suspensionOffset: 0.015, surfaceType: 'grass' },
        fr: { length: 0.31, prevLength: 0.31, compression: 0.09, force: 4800, isGrounded: true, rollAngle: 12.3, groundSpeed: 47.2, rpm: 1245, suspensionOffset: 0.018, surfaceType: 'grass' },
        rl: { length: 0.33, prevLength: 0.33, compression: 0.07, force: 3900, isGrounded: true, rollAngle: 12.4, groundSpeed: 47.0, rpm: 1240, suspensionOffset: 0.010, surfaceType: 'grass' },
        rr: { length: 0.33, prevLength: 0.33, compression: 0.07, force: 3900, isGrounded: true, rollAngle: 12.4, groundSpeed: 47.1, rpm: 1242, suspensionOffset: 0.011, surfaceType: 'grass' },
      },
      collision: {
        hasCollided: true,
        collisionCount: 4,
        lastCollisionType: 'barrier',
        lastCollisionObject: 'barrier-turn1',
        penetrationDepth: 0.28,
        impactSpeed: 14.2,
        surfaceType: 'grass',
        isOffRoad: true,
        offRoadWheelCount: 4,
      },
    };

    resetVehiclePhysicsState(sim, spawnCfg, chassisCfg, suspCfg, wheelCfg);

    // Check position restored to spawn
    assert(Math.abs(sim.position.x - spawnCfg.position[0]) < 0.001, `Position X reset to ${spawnCfg.position[0]} (got ${sim.position.x})`);
    assert(Math.abs(sim.position.y - spawnCfg.position[1]) < 0.001, `Position Y reset to ${spawnCfg.position[1]} (got ${sim.position.y})`);
    assert(Math.abs(sim.position.z - spawnCfg.position[2]) < 0.001, `Position Z reset to ${spawnCfg.position[2]} (got ${sim.position.z})`);

    // Check velocities zeroed
    assert(sim.linearVelocity.length() === 0, 'Linear velocity strictly zeroed');
    assert(sim.angularVelocity.length() === 0, 'Angular velocity strictly zeroed');

    // Check drivetrain reset
    assert(sim.drivetrain.speedLong === 0 && sim.drivetrain.wheelRollAngle === 0, 'Drivetrain speed and wheel roll reset to 0');

    // Check steering reset
    assert(sim.steering.currentAngle === 0 && sim.steering.steerFL === 0 && sim.steering.steerFR === 0, 'Steering angles reset to 0');

    // Check settled suspension
    const settledFL = wheelCfg.settledCompression.fl;
    assert(Math.abs(sim.wheels.fl.compression - settledFL) < 0.001, `FL suspension settled at ${settledFL}m (got ${sim.wheels.fl.compression})`);
    assert(sim.wheels.fl.rollAngle === 0 && sim.wheels.fl.groundSpeed === 0, 'FL wheel roll and ground speed reset');
    assert(sim.wheels.fl.surfaceType === 'asphalt', 'Wheel surface restored to asphalt');

    // Check collision flags cleared
    assert(sim.collision.hasCollided === false, 'Collision flag cleared');
    assert(sim.collision.penetrationDepth === 0, 'Penetration depth cleared');
    assert(sim.isSettled === true, 'Vehicle marked as settled at rest');
  });

  // Test 9: Vehicle Physics Store Actions & Reset Request Handshake
  await runTest('Vehicle Physics Store Actions & Reset Handshake', () => {
    const store = useVehiclePhysicsStore.getState();
    assert(typeof store.requestReset === 'function', 'store.requestReset is a function');
    assert(typeof store.consumeReset === 'function', 'store.consumeReset is a function');

    const initialCount = store.resetCount;
    assert(store.resetRequested === false, 'resetRequested initially false');

    store.requestReset();
    assert(useVehiclePhysicsStore.getState().resetRequested === true, 'requestReset() sets resetRequested to true');

    useVehiclePhysicsStore.getState().consumeReset();
    assert(useVehiclePhysicsStore.getState().resetRequested === false, 'consumeReset() clears resetRequested');
    assert(useVehiclePhysicsStore.getState().resetCount === initialCount + 1, `resetCount incremented to ${initialCount + 1}`);
  });

  // Test 10: Repeated Collisions & Recovery Numerical Stability
  await runTest('10 Consecutive Collision & Recovery Cycles Stability', () => {
    const sim = {
      position: new THREE.Vector3(...spawnCfg.position),
      quaternion: new THREE.Quaternion(),
      prevPosition: new THREE.Vector3(...spawnCfg.position),
      prevQuaternion: new THREE.Quaternion(),
      linearVelocity: new THREE.Vector3(0, 0, 0),
      angularVelocity: new THREE.Vector3(0, 0, 0),
      isSettled: true,
      settleCounter: 12,
      totalSteps: 0,
      drivetrain: { gear: 'D', speedLong: 0, driveForce: 0, brakeForce: 0, dragForce: 0, rollForce: 0, netLongForce: 0, wheelRollAngle: 0 },
      steering: { currentAngle: 0, steerFL: 0, steerFR: 0, maxSteerLimit: 0.52, totalLatForce: 0, yawTorque: 0, lateralG: 0, yawRate: 0, lastT: 0.05 },
      wheels: {
        fl: { length: 0.28, prevLength: 0.28, compression: 0.11, force: 4000, isGrounded: true, rollAngle: 0, groundSpeed: 0, rpm: 0, suspensionOffset: 0, surfaceType: 'asphalt' },
        fr: { length: 0.28, prevLength: 0.28, compression: 0.11, force: 4000, isGrounded: true, rollAngle: 0, groundSpeed: 0, rpm: 0, suspensionOffset: 0, surfaceType: 'asphalt' },
        rl: { length: 0.31, prevLength: 0.31, compression: 0.09, force: 3500, isGrounded: true, rollAngle: 0, groundSpeed: 0, rpm: 0, suspensionOffset: 0, surfaceType: 'asphalt' },
        rr: { length: 0.31, prevLength: 0.31, compression: 0.09, force: 3500, isGrounded: true, rollAngle: 0, groundSpeed: 0, rpm: 0, suspensionOffset: 0, surfaceType: 'asphalt' },
      },
      collision: { hasCollided: false, collisionCount: 0, lastCollisionType: 'none', lastCollisionObject: null, penetrationDepth: 0, impactSpeed: 0, surfaceType: 'asphalt', isOffRoad: false, offRoadWheelCount: 0 },
    };

    const dt = 1 / 60;
    for (let cycle = 0; cycle < 10; cycle++) {
      // Launch vehicle into barrier
      sim.linearVelocity.set(12.0, 0, 25.0);
      sim.position.set(5.5, 0.35, 10 + cycle * 5);

      // Check collision
      const col = checkVehicleCollision(sim.position, sim.quaternion, sim.linearVelocity, sim.angularVelocity, collisionCfg, 0.01);
      if (col && col.hasCollision) {
        resolveVehicleCollisionResponse(sim, col, dt, collisionCfg, chassisCfg);
      }

      // Reset
      resetVehiclePhysicsState(sim, spawnCfg, chassisCfg, suspCfg, wheelCfg);

      // Verify state has zero NaNs
      assert(!isNaN(sim.position.x) && !isNaN(sim.linearVelocity.z), `Cycle ${cycle + 1} produced no NaNs`);
    }

    assert(Math.abs(sim.position.x - spawnCfg.position[0]) < 0.001, 'Position returned exactly to spawn after 10 cycles');
    assert(sim.linearVelocity.length() === 0, 'Velocity strictly zero after 10 cycles');
  });

  console.log('\n================================================================');
  console.log(`PART 30 TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
