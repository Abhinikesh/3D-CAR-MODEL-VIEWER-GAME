import React, { memo, useRef, useCallback, useEffect } from 'react';
import { usePaintMaterials } from '../../hooks/usePaintMaterials.js';
import { useSecondaryMaterials } from '../../hooks/useSecondaryMaterials.js';
import { useWheelCustomization } from '../../hooks/useWheelCustomization.js';
import { useVehicleRig } from '../../hooks/useVehicleRig.js';
import { useWheelAnimation } from '../../hooks/useWheelAnimation.js';
import { useVehicleLighting } from '../../hooks/useVehicleLighting.js';
import { useSelectionStore } from '../../store/selectionStore.js';
import { useCameraStore } from '../../store/cameraStore.js';
import { resolveComponentByMeshName } from '../../utils/componentResolver.js';
import SelectionHighlight from './SelectionHighlight.jsx';

/**
 * Pure presentation component rendering the indexed car model hierarchy
 * with integrated interactive component raycasting, hover detection, and selection.
 *
 * Resource Ownership Rules:
 * 1. Geometry and texture buffers are owned by Drei's useGLTF global cache.
 *    Do NOT call geometry.dispose() or texture.dispose() on unmount.
 * 2. Application-owned paint material instances are managed via usePaintMaterials (Part 9).
 * 3. Secondary material overrides are managed via useSecondaryMaterials (Part 10).
 * 4. Wheel and rim customization are managed via useWheelCustomization (Part 11).
 * 5. Interactive component raycasting and selection are managed via useSelectionStore (Part 13).
 */
function CarSceneGraph({ scene, graphData, groundOffsetY = 0.0, interactive = true }) {
  // Part 9: Automotive paint overrides
  usePaintMaterials(scene);
  // Part 10: Secondary material overrides (glass, chrome, rubber, plastic, lights)
  useSecondaryMaterials(scene);
  // Part 11: Wheel & rim customization (rims & brake calipers)
  useWheelCustomization(scene);
  // Part 14: Automotive closures rigging and animation (doors, bonnet, boot)
  useVehicleRig(scene);
  // Part 15: Wheel rotation, steering & mechanical animation
  useWheelAnimation(scene);
  // Part 16: Dynamic automotive lighting system (headlights, brakes, indicators, hazards)
  useVehicleLighting(scene);

  const pointerDownRef = useRef({ x: 0, y: 0, time: 0 });
  const lastMoveTimeRef = useRef(0);

  const setHovered = useSelectionStore((state) => state.setHovered);
  const clearHovered = useSelectionStore((state) => state.clearHovered);
  const selectComponent = useSelectionStore((state) => state.selectComponent);
  const focusOnClick = useSelectionStore((state) => state.focusOnClick);

  // Clean up cursor style on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = 'default';
    };
  }, []);

  const handlePointerDown = useCallback((e) => {
    if (!interactive) return;
    pointerDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
    };
  }, [interactive]);

  const handlePointerMove = useCallback(
    (e) => {
      if (!interactive) return;
      e.stopPropagation();
      const now = performance.now();
      // Throttle hover updates to ~40fps for high efficiency
      if (now - lastMoveTimeRef.current < 25) return;
      lastMoveTimeRef.current = now;

      const meshName = e.object?.name;
      const compId = resolveComponentByMeshName(meshName);
      if (compId) {
        setHovered(
          compId,
          meshName,
          [e.point.x, e.point.y, e.point.z],
          { x: e.clientX, y: e.clientY }
        );
        document.body.style.cursor = 'pointer';
      } else {
        clearHovered();
        document.body.style.cursor = 'default';
      }
    },
    [interactive, setHovered, clearHovered]
  );

  const handlePointerOut = useCallback(
    (e) => {
      if (!interactive) return;
      clearHovered();
      document.body.style.cursor = 'default';
    },
    [interactive, clearHovered]
  );

  const handleClick = useCallback(
    (e) => {
      if (!interactive) return;
      e.stopPropagation();
      const dx = e.clientX - pointerDownRef.current.x;
      const dy = e.clientY - pointerDownRef.current.y;
      const dist = Math.hypot(dx, dy);

      // Distinguish orbit/pan drag from intentional click (5px threshold)
      if (dist > 5) return;
      if (performance.now() - pointerDownRef.current.time > 500) return;

      const meshName = e.object?.name;
      const compId = resolveComponentByMeshName(meshName);
      if (compId) {
        selectComponent(compId, meshName, graphData);
        if (focusOnClick) {
          useCameraStore.getState().focusOn(compId);
        }
      }
    },
    [interactive, graphData, selectComponent, focusOnClick]
  );

  if (!scene) return null;

  return (
    <>
      <group
        name="CarInteractiveRoot"
        position={[0, groundOffsetY, 0]}
        onPointerDown={interactive ? handlePointerDown : undefined}
        onPointerMove={interactive ? handlePointerMove : undefined}
        onPointerOut={interactive ? handlePointerOut : undefined}
        onClick={interactive ? handleClick : undefined}
      >
        <primitive object={scene} />
      </group>
      {interactive && <SelectionHighlight scene={scene} />}
    </>
  );
}

export default memo(CarSceneGraph);
