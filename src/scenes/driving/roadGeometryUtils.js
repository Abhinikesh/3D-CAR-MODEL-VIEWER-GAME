import * as THREE from 'three';
import {
  ROAD_CURVE,
  HALF_ROAD_WIDTH,
  ROAD_SURFACE_ELEVATION,
  KERB_WIDTH,
  KERB_HEIGHT,
  ROAD_THICKNESS,
  getRoadNormal,
  getRoadCurvature,
  TRACK_LENGTH,
} from './roadData.js';

/**
 * Procedural Asphalt Texture Generator
 *
 * Generates calibrated procedural textures for believable asphalt surfaces:
 * - Subtle aggregate mineral grain (fine stone specks)
 * - Micro-roughness variation avoiding artificial gloss or excessive noise
 * - Seamless RepeatWrapping for consistent texture scale at driving distances
 */
export function createProceduralAsphaltTexture() {
  if (typeof document === 'undefined') return null;
  try {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base asphalt tone: dark charcoal slate
    ctx.fillStyle = '#262930';
    ctx.fillRect(0, 0, size, size);

    // Subtle aggregate noise
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 22;
      data[i]     = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // Repeat across 10m road width and along 1,200m track length
    texture.repeat.set(4, 120);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  } catch {
    return null;
  }
}

export function createProceduralAsphaltRoughnessMap() {
  if (typeof document === 'undefined') return null;
  try {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base roughness ~0.84
    ctx.fillStyle = '#D6D6D6';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 28;
      const val = Math.min(255, Math.max(0, 214 + noise));
      data[i]     = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 120);
    return texture;
  } catch {
    return null;
  }
}

/**
 * 1. Primary Asphalt Road Surface Geometry Builder
 *
 * Constructs a continuous, closed quad-strip following the road spline.
 * Guarantees exact width consistency (2 * HALF_ROAD_WIDTH = 10.0m) and clean normals.
 */
export function buildRoadSurfaceGeometry(samples = 600) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= samples; i++) {
    const t = (i % samples) / samples;
    const pt = ROAD_CURVE.getPointAt(t);
    const norm = getRoadNormal(t);

    // Left road edge
    const leftX = pt.x - norm.x * HALF_ROAD_WIDTH;
    const leftZ = pt.z - norm.z * HALF_ROAD_WIDTH;
    positions.push(leftX, ROAD_SURFACE_ELEVATION, leftZ);
    normals.push(0, 1, 0);
    uvs.push(0, (i / samples) * (TRACK_LENGTH / 10));

    // Right road edge
    const rightX = pt.x + norm.x * HALF_ROAD_WIDTH;
    const rightZ = pt.z + norm.z * HALF_ROAD_WIDTH;
    positions.push(rightX, ROAD_SURFACE_ELEVATION, rightZ);
    normals.push(0, 1, 0);
    uvs.push(1, (i / samples) * (TRACK_LENGTH / 10));

    if (i < samples) {
      const idx = i * 2;
      indices.push(idx, idx + 1, idx + 2);
      indices.push(idx + 1, idx + 3, idx + 2);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * 2. Concrete Outer Gutters & Shoulders Geometry Builder (0.5m each side)
 */
export function buildShoulderGeometry(samples = 600) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const SHOULDER_W = 0.5;

  let vertCount = 0;
  for (let i = 0; i <= samples; i++) {
    const t = (i % samples) / samples;
    const pt = ROAD_CURVE.getPointAt(t);
    const norm = getRoadNormal(t);

    // Left shoulder strip
    const lInnerX = pt.x - norm.x * HALF_ROAD_WIDTH;
    const lInnerZ = pt.z - norm.z * HALF_ROAD_WIDTH;
    const lOuterX = pt.x - norm.x * (HALF_ROAD_WIDTH + SHOULDER_W);
    const lOuterZ = pt.z - norm.z * (HALF_ROAD_WIDTH + SHOULDER_W);

    positions.push(lInnerX, ROAD_SURFACE_ELEVATION - 0.001, lInnerZ);
    positions.push(lOuterX, ROAD_SURFACE_ELEVATION - 0.001, lOuterZ);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, (i / samples) * 50, 1, (i / samples) * 50);

    // Right shoulder strip
    const rInnerX = pt.x + norm.x * HALF_ROAD_WIDTH;
    const rInnerZ = pt.z + norm.z * HALF_ROAD_WIDTH;
    const rOuterX = pt.x + norm.x * (HALF_ROAD_WIDTH + SHOULDER_W);
    const rOuterZ = pt.z + norm.z * (HALF_ROAD_WIDTH + SHOULDER_W);

    positions.push(rInnerX, ROAD_SURFACE_ELEVATION - 0.001, rInnerZ);
    positions.push(rOuterX, ROAD_SURFACE_ELEVATION - 0.001, rOuterZ);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, (i / samples) * 50, 1, (i / samples) * 50);

    if (i < samples) {
      // Left quad
      const lBase = (vertCount / 2) * 4;
      indices.push(lBase, lBase + 1, lBase + 4);
      indices.push(lBase + 1, lBase + 5, lBase + 4);

      // Right quad
      const rBase = lBase + 2;
      indices.push(rBase, rBase + 1, rBase + 6);
      indices.push(rBase + 1, rBase + 7, rBase + 6);
    }
    vertCount += 2;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * 3. FIA Red/White Apex Rumble Kerbs Geometry Builder
 */
export function buildApexKerbGeometry(samples = 600) {
  const positions = [];
  const colors = [];
  const normals = [];
  const indices = [];

  const redColor = new THREE.Color('#DC2626');
  const whiteColor = new THREE.Color('#F8FAFC');

  let vertexOffset = 0;

  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const curv = getRoadCurvature(t);

    if (Math.abs(curv) > 3.5) {
      const nextT = ((i + 1) % samples) / samples;
      const pt1 = ROAD_CURVE.getPointAt(t);
      const pt2 = ROAD_CURVE.getPointAt(nextT);
      const norm1 = getRoadNormal(t);
      const norm2 = getRoadNormal(nextT);

      const insideSign = curv > 0 ? 1 : -1;
      const arcPos = t * TRACK_LENGTH;
      const isRed = Math.floor(arcPos / 1.2) % 2 === 0;
      const color = isRed ? redColor : whiteColor;

      const in1X = pt1.x + norm1.x * (HALF_ROAD_WIDTH * insideSign);
      const in1Z = pt1.z + norm1.z * (HALF_ROAD_WIDTH * insideSign);
      const in2X = pt2.x + norm2.x * (HALF_ROAD_WIDTH * insideSign);
      const in2Z = pt2.z + norm2.z * (HALF_ROAD_WIDTH * insideSign);

      const out1X = pt1.x + norm1.x * ((HALF_ROAD_WIDTH + KERB_WIDTH) * insideSign);
      const out1Z = pt1.z + norm1.z * ((HALF_ROAD_WIDTH + KERB_WIDTH) * insideSign);
      const out2X = pt2.x + norm2.x * ((HALF_ROAD_WIDTH + KERB_WIDTH) * insideSign);
      const out2Z = pt2.z + norm2.z * ((HALF_ROAD_WIDTH + KERB_WIDTH) * insideSign);

      const baseIdx = vertexOffset;

      positions.push(in1X, ROAD_SURFACE_ELEVATION + 0.003, in1Z);
      positions.push(out1X, ROAD_SURFACE_ELEVATION + KERB_HEIGHT, out1Z);
      positions.push(in2X, ROAD_SURFACE_ELEVATION + 0.003, in2Z);
      positions.push(out2X, ROAD_SURFACE_ELEVATION + KERB_HEIGHT, out2Z);

      for (let v = 0; v < 4; v++) {
        colors.push(color.r, color.g, color.b);
        normals.push(0, 1, 0);
      }

      indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
      indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);

      vertexOffset += 4;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setIndex(indices);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}
