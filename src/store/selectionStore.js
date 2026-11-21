import { create } from 'zustand';
import { getComponentTechnicalDetails, resolveComponentByMeshName } from '../utils/componentResolver.js';

export const useSelectionStore = create((set, get) => ({
  // Active Selected Component State
  selectedComponentId: null,
  selectedMeshName: null,
  selectedComponent: null, // Full technical metadata object

  // Active Hovered State
  hoveredComponentId: null,
  hoveredMeshName: null,
  hoverPoint: null, // [x, y, z]
  hoverScreenPos: null, // { x, y }

  // Interaction & Visualization Preferences
  focusOnClick: true,
  showBoundingBox: true,
  showWireframe: true,
  showHUD: true,
  isDrawerOpen: false,

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  setHovered: (componentId, meshName = null, point = null, screenPos = null) => {
    // Avoid redundant state updates on identical hover target
    const current = get();
    if (
      current.hoveredComponentId === componentId &&
      current.hoveredMeshName === meshName
    ) {
      if (point || screenPos) {
        set({
          hoverPoint: point ? [...point] : current.hoverPoint,
          hoverScreenPos: screenPos ? { ...screenPos } : current.hoverScreenPos,
        });
      }
      return;
    }

    set({
      hoveredComponentId: componentId,
      hoveredMeshName: meshName,
      hoverPoint: point ? [...point] : null,
      hoverScreenPos: screenPos ? { ...screenPos } : null,
    });
  },

  clearHovered: () => {
    const { hoveredComponentId, hoveredMeshName } = get();
    if (hoveredComponentId !== null || hoveredMeshName !== null) {
      set({
        hoveredComponentId: null,
        hoveredMeshName: null,
        hoverPoint: null,
        hoverScreenPos: null,
      });
    }
  },

  selectComponent: (componentId, meshName = null, sceneGraphData = null) => {
    if (!componentId) {
      get().clearSelection();
      return;
    }

    // Resolve mesh if componentId was omitted but meshName was provided
    let targetComponentId = componentId;
    if (!targetComponentId && meshName) {
      targetComponentId = resolveComponentByMeshName(meshName);
    }
    if (!targetComponentId) return;

    const technicalData = getComponentTechnicalDetails(targetComponentId, sceneGraphData);

    set({
      selectedComponentId: targetComponentId,
      selectedMeshName: meshName,
      selectedComponent: technicalData,
      showHUD: true,
    });
  },

  clearSelection: () => {
    set({
      selectedComponentId: null,
      selectedMeshName: null,
      selectedComponent: null,
    });
  },

  setFocusOnClick: (enabled) => {
    set({ focusOnClick: Boolean(enabled) });
  },

  toggleFocusOnClick: () => {
    set((state) => ({ focusOnClick: !state.focusOnClick }));
  },

  setShowBoundingBox: (enabled) => {
    set({ showBoundingBox: Boolean(enabled) });
  },

  toggleBoundingBox: () => {
    set((state) => ({ showBoundingBox: !state.showBoundingBox }));
  },

  setShowWireframe: (enabled) => {
    set({ showWireframe: Boolean(enabled) });
  },

  toggleWireframe: () => {
    set((state) => ({ showWireframe: !state.showWireframe }));
  },

  setShowHUD: (enabled) => {
    set({ showHUD: Boolean(enabled) });
  },

  setDrawerOpen: (isOpen) => {
    set({ isDrawerOpen: Boolean(isOpen) });
  },

  toggleDrawer: () => {
    set((state) => ({ isDrawerOpen: !state.isDrawerOpen }));
  },
}));

// Expose store for test instrumentation and browser automation
if (typeof window !== 'undefined') {
  window.__selectionStore = useSelectionStore;
}
