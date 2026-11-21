import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useSelectionStore } from '../../store/selectionStore.js';
import { useVehicleRigStore } from '../../store/vehicleRigStore.js';
import { SEMANTIC_COMPONENTS } from '../../utils/carAssetRegistry.js';

/**
 * High-tech Corner Bracket Geometry for 3D Bounding Reticles
 */
function createBoundingBracketLines(box, bracketFraction = 0.22) {
  if (!box || box.isEmpty()) return null;

  const min = box.min;
  const max = box.max;
  const dx = (max.x - min.x) * bracketFraction;
  const dy = (max.y - min.y) * bracketFraction;
  const dz = (max.z - min.z) * bracketFraction;

  const points = [];

  // Helper to add a line segment
  const addSeg = (p1, p2) => {
    points.push(new THREE.Vector3(...p1), new THREE.Vector3(...p2));
  };

  // 8 corners:
  // c000: min.x, min.y, min.z
  addSeg([min.x, min.y, min.z], [min.x + dx, min.y, min.z]);
  addSeg([min.x, min.y, min.z], [min.x, min.y + dy, min.z]);
  addSeg([min.x, min.y, min.z], [min.x, min.y, min.z + dz]);

  // c100: max.x, min.y, min.z
  addSeg([max.x, min.y, min.z], [max.x - dx, min.y, min.z]);
  addSeg([max.x, min.y, min.z], [max.x, min.y + dy, min.z]);
  addSeg([max.x, min.y, min.z], [max.x, min.y, min.z + dz]);

  // c010: min.x, max.y, min.z
  addSeg([min.x, max.y, min.z], [min.x + dx, max.y, min.z]);
  addSeg([min.x, max.y, min.z], [min.x, max.y - dy, min.z]);
  addSeg([min.x, max.y, min.z], [min.x, max.y, min.z + dz]);

  // c110: max.x, max.y, min.z
  addSeg([max.x, max.y, min.z], [max.x - dx, max.y, min.z]);
  addSeg([max.x, max.y, min.z], [max.x, max.y - dy, min.z]);
  addSeg([max.x, max.y, min.z], [max.x, max.y, min.z + dz]);

  // c001: min.x, min.y, max.z
  addSeg([min.x, min.y, max.z], [min.x + dx, min.y, max.z]);
  addSeg([min.x, min.y, max.z], [min.x, min.y + dy, max.z]);
  addSeg([min.x, min.y, max.z], [min.x, min.y, max.z - dz]);

  // c101: max.x, min.y, max.z
  addSeg([max.x, min.y, max.z], [max.x - dx, min.y, max.z]);
  addSeg([max.x, min.y, max.z], [max.x, min.y + dy, max.z]);
  addSeg([max.x, min.y, max.z], [max.x, min.y, max.z - dz]);

  // c011: min.x, max.y, max.z
  addSeg([min.x, max.y, max.z], [min.x + dx, max.y, max.z]);
  addSeg([min.x, max.y, max.z], [min.x, max.y - dy, max.z]);
  addSeg([min.x, max.y, max.z], [min.x, max.y, max.z - dz]);

  // c111: max.x, max.y, max.z
  addSeg([max.x, max.y, max.z], [max.x - dx, max.y, max.z]);
  addSeg([max.x, max.y, max.z], [max.x, max.y - dy, max.z]);
  addSeg([max.x, max.y, max.z], [max.x, max.y, max.z - dz]);

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return geo;
}

/**
 * 3D Component Selection & Hover Highlighting Engine
 * Non-destructive: Cloned geometries with specialized overlay materials.
 * The underlying PBR materials of the car are completely untouched.
 */
export default function SelectionHighlight({ scene }) {
  const selectedComponentId = useSelectionStore((state) => state.selectedComponentId);
  const hoveredComponentId = useSelectionStore((state) => state.hoveredComponentId);
  const showBoundingBox = useSelectionStore((state) => state.showBoundingBox);
  const showWireframe = useSelectionStore((state) => state.showWireframe);
  const closures = useVehicleRigStore((state) => state.closures);

  // Reusable materials
  const wireframeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#00F0FF'),
        wireframe: true,
        transparent: true,
        opacity: 0.4,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1.5,
        polygonOffsetUnits: -1.5,
      }),
    []
  );

  const selectedBoxMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color('#00F0FF'),
        transparent: true,
        opacity: 0.95,
        linewidth: 2,
        depthTest: true,
      }),
    []
  );

  const hoverBoxMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color('#00E5FF'),
        transparent: true,
        opacity: 0.5,
        linewidth: 1,
        depthTest: true,
      }),
    []
  );

  // Cleanup materials on unmount
  useEffect(() => {
    return () => {
      wireframeMat.dispose();
      selectedBoxMat.dispose();
      hoverBoxMat.dispose();
    };
  }, [wireframeMat, selectedBoxMat, hoverBoxMat]);

  // Resolve selected component meshes & bounding box
  const selectedData = useMemo(() => {
    if (!scene || !selectedComponentId) return null;

    const compDef = Object.values(SEMANTIC_COMPONENTS).find(
      (c) => c.id === selectedComponentId
    );
    if (!compDef) return null;

    const meshes = [];
    const box = new THREE.Box3();

    scene.traverse((node) => {
      if (node.isMesh && compDef.nodes.includes(node.name)) {
        meshes.push({
          geometry: node.geometry,
          matrixWorld: node.matrixWorld.clone(),
          name: node.name,
        });
        box.expandByObject(node);
      }
    });

    if (meshes.length === 0 || box.isEmpty()) return null;

    // Small padding on bounding box for visual aesthetics
    box.expandByScalar(0.015);

    const cornerGeo = createBoundingBracketLines(box, 0.25);
    const boxGeo = new THREE.BoxGeometry(
      box.max.x - box.min.x,
      box.max.y - box.min.y,
      box.max.z - box.min.z
    );
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    boxGeo.dispose();

    const center = new THREE.Vector3();
    box.getCenter(center);

    return {
      meshes,
      box,
      center,
      cornerGeo,
      edgesGeo,
    };
  }, [scene, selectedComponentId, closures]);

  // Resolve hovered component bounding box (if different from selected)
  const hoverData = useMemo(() => {
    if (
      !scene ||
      !hoveredComponentId ||
      hoveredComponentId === selectedComponentId
    ) {
      return null;
    }

    const compDef = Object.values(SEMANTIC_COMPONENTS).find(
      (c) => c.id === hoveredComponentId
    );
    if (!compDef) return null;

    const box = new THREE.Box3();
    let count = 0;

    scene.traverse((node) => {
      if (node.isMesh && compDef.nodes.includes(node.name)) {
        box.expandByObject(node);
        count++;
      }
    });

    if (count === 0 || box.isEmpty()) return null;

    box.expandByScalar(0.012);
    const cornerGeo = createBoundingBracketLines(box, 0.2);

    return {
      box,
      cornerGeo,
    };
  }, [scene, hoveredComponentId, selectedComponentId, closures]);

  // Clean up dynamic buffer geometries when target changes
  useEffect(() => {
    return () => {
      if (selectedData?.cornerGeo) selectedData.cornerGeo.dispose();
      if (selectedData?.edgesGeo) selectedData.edgesGeo.dispose();
    };
  }, [selectedData]);

  useEffect(() => {
    return () => {
      if (hoverData?.cornerGeo) hoverData.cornerGeo.dispose();
    };
  }, [hoverData]);

  if (!selectedData && !hoverData) return null;

  return (
    <group name="ComponentSelectionOverlay">
      {/* ─── Selected Component Highlighting ─── */}
      {selectedData && (
        <group name="SelectedHighlightGroup">
          {/* Wireframe Mesh Overlay */}
          {showWireframe &&
            selectedData.meshes.map((m, idx) => (
              <mesh
                key={`wire_${m.name}_${idx}`}
                geometry={m.geometry}
                material={wireframeMat}
                matrix={m.matrixWorld}
                matrixAutoUpdate={false}
              />
            ))}

          {/* High-Tech Bounding Box Brackets */}
          {showBoundingBox && selectedData.cornerGeo && (
            <lineSegments geometry={selectedData.cornerGeo} material={selectedBoxMat} />
          )}

          {/* Subtle Outer Bounding Wireframe Cube */}
          {showBoundingBox && selectedData.edgesGeo && (
            <lineSegments
              geometry={selectedData.edgesGeo}
              position={[
                selectedData.center.x,
                selectedData.center.y,
                selectedData.center.z,
              ]}
            >
              <lineBasicMaterial
                color="#00F0FF"
                transparent
                opacity={0.25}
                depthTest={true}
              />
            </lineSegments>
          )}
        </group>
      )}

      {/* ─── Hovered Component Subtle Reticle ─── */}
      {hoverData && hoverData.cornerGeo && (
        <group name="HoverHighlightGroup">
          <lineSegments geometry={hoverData.cornerGeo} material={hoverBoxMat} />
        </group>
      )}
    </group>
  );
}
