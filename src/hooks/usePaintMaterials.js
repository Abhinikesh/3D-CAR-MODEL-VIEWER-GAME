import { useEffect, useRef, useMemo } from 'react';
import { usePaintStore } from '../store/paintStore.js';
import {
  PaintOverrideEngine,
  ALL_PAINTABLE_MESH_NAMES,
  PRIMARY_PAINT_MESH_NAMES,
  SECONDARY_PAINT_MESH_NAMES,
} from '../materials/paintMaterialFactory.js';

/**
 * React Hook orchestrating runtime automotive paint material application.
 * Bridges Zustand paintStore with the Three.js scene graph.
 *
 * @param {THREE.Object3D} rootScene - Car model root object
 * @returns {Object} Public paint application API
 */
export function usePaintMaterials(rootScene) {
  const engineRef = useRef(null);

  // Lazy-initialize engine singleton
  if (!engineRef.current) {
    engineRef.current = new PaintOverrideEngine();
  }

  // Subscribe to relevant state slices from paintStore
  const activePresetId = usePaintStore((s) => s.activePresetId);
  const activeFinish = usePaintStore((s) => s.activeFinish);
  const primaryColor = usePaintStore((s) => s.primaryColor);
  const secondaryColor = usePaintStore((s) => s.secondaryColor);
  const isFactory = usePaintStore((s) => s.isFactory);
  const materialParameters = usePaintStore((s) => s.materialParameters);

  const applyPreset = usePaintStore((s) => s.applyPreset);
  const setFinish = usePaintStore((s) => s.setFinish);
  const setCustomColor = usePaintStore((s) => s.setCustomColor);
  const setMaterialParameter = usePaintStore((s) => s.setMaterialParameter);
  const resetToFactory = usePaintStore((s) => s.resetToFactory);
  const getPaintConfig = usePaintStore((s) => s.getPaintConfig);

  // Initialize engine when scene graph is ready
  useEffect(() => {
    if (rootScene) {
      engineRef.current.initializeFromScene(rootScene);
    }
  }, [rootScene]);

  // Synchronize paint materials whenever store state changes
  useEffect(() => {
    if (!rootScene) return;

    engineRef.current.applyPaint({
      primaryColor,
      secondaryColor,
      finish: activeFinish,
      isFactory,
      clearcoat: materialParameters.clearcoat,
      roughness: materialParameters.roughness,
      metalness: materialParameters.metalness,
    });
  }, [rootScene, activePresetId, activeFinish, primaryColor, secondaryColor, isFactory, materialParameters]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);

  // Public API matching Section 6 specifications
  const api = useMemo(
    () => ({
      applyPaintPreset: applyPreset,
      applyCustomColor: setCustomColor,
      changeFinishType: setFinish,
      updateClearcoat: (val) => setMaterialParameter('clearcoat', val),
      updateRoughness: (val) => setMaterialParameter('roughness', val),
      restoreFactoryPaint: resetToFactory,
      getCurrentPaintConfig: getPaintConfig,
      getAffectedMeshes: () => ({
        primary: [...PRIMARY_PAINT_MESH_NAMES],
        secondary: [...SECONDARY_PAINT_MESH_NAMES],
        all: [...ALL_PAINTABLE_MESH_NAMES],
        totalCount: ALL_PAINTABLE_MESH_NAMES.length,
      }),
    }),
    [applyPreset, setCustomColor, setFinish, setMaterialParameter, resetToFactory, getPaintConfig]
  );

  return api;
}
