import { create } from 'zustand';
import { CLOSURE_IDS, CLOSURE_RIG_CONFIG } from '../utils/vehicleRigRegistry.js';

function createInitialClosuresState() {
  const initial = {};
  for (const id of CLOSURE_IDS) {
    initial[id] = {
      id,
      currentProgress: 0, // 0.0 (closed) to 1.0 (fully open)
      targetProgress: 0,  // Target state
      state: 'closed',    // 'closed' | 'opening' | 'open' | 'closing'
    };
  }
  return initial;
}

export const useVehicleRigStore = create((set, get) => ({
  // Serializable Closure States
  closures: createInitialClosuresState(),

  // Animation playback configuration
  animationSpeed: 1.0,
  isAnyAnimating: false,
  activeClosureId: null,

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  // Open an individual closure
  openClosure: (closureId) => {
    const { closures } = get();
    const current = closures[closureId];
    if (!current) return;

    if (current.currentProgress >= 1.0 && current.targetProgress === 1.0) {
      return; // Already fully open
    }

    set((state) => ({
      closures: {
        ...state.closures,
        [closureId]: {
          ...current,
          targetProgress: 1.0,
          state: 'opening',
        },
      },
      isAnyAnimating: true,
      activeClosureId: closureId,
    }));
  },

  // Close an individual closure
  closeClosure: (closureId) => {
    const { closures } = get();
    const current = closures[closureId];
    if (!current) return;

    if (current.currentProgress <= 0.0 && current.targetProgress === 0.0) {
      return; // Already fully closed
    }

    set((state) => ({
      closures: {
        ...state.closures,
        [closureId]: {
          ...current,
          targetProgress: 0.0,
          state: current.currentProgress <= 0.0001 && current.targetProgress === 0.0 ? 'closed' : 'closing',
        },
      },
      isAnyAnimating: current.currentProgress > 0.0001,
      activeClosureId: closureId,
    }));
  },

  // Toggle closure state (open <-> closed, or reverse mid-flight)
  toggleClosure: (closureId) => {
    const { closures } = get();
    const current = closures[closureId];
    if (!current) return;

    // If currently opening or already mostly open, close it; otherwise open it
    const shouldClose = current.targetProgress > 0.5;
    if (shouldClose) {
      get().closeClosure(closureId);
    } else {
      get().openClosure(closureId);
    }
  },

  // Open all 4 supported closures in coordinated sequence
  openAll: () => {
    const { closures } = get();
    const nextClosures = {};
    for (const [id, data] of Object.entries(closures)) {
      nextClosures[id] = {
        ...data,
        targetProgress: 1.0,
        state: data.currentProgress >= 1.0 ? 'open' : 'opening',
      };
    }
    set({
      closures: nextClosures,
      isAnyAnimating: true,
      activeClosureId: null,
    });
  },

  // Close all 4 supported closures
  closeAll: () => {
    const { closures } = get();
    const nextClosures = {};
    for (const [id, data] of Object.entries(closures)) {
      nextClosures[id] = {
        ...data,
        targetProgress: 0.0,
        state: data.currentProgress <= 0.0 ? 'closed' : 'closing',
      };
    }
    set({
      closures: nextClosures,
      isAnyAnimating: true,
      activeClosureId: null,
    });
  },

  // Instantly reset all closures to factory closed position without lerping
  resetAll: () => {
    const resetClosures = {};
    for (const id of CLOSURE_IDS) {
      resetClosures[id] = {
        id,
        currentProgress: 0.0,
        targetProgress: 0.0,
        state: 'closed',
      };
    }
    set({
      closures: resetClosures,
      isAnyAnimating: false,
      activeClosureId: null,
    });
  },

  // Internal progress update executed per-frame by the animation engine
  updateProgress: (closureId, newProgress) => {
    const { closures } = get();
    const current = closures[closureId];
    if (!current) return;

    let newState = current.state;
    if (newProgress <= 0.0001) {
      newState = 'closed';
    } else if (newProgress >= 0.9999) {
      newState = 'open';
    } else if (current.targetProgress > current.currentProgress) {
      newState = 'opening';
    } else {
      newState = 'closing';
    }

    set((state) => ({
      closures: {
        ...state.closures,
        [closureId]: {
          ...current,
          currentProgress: newProgress,
          state: newState,
        },
      },
    }));
  },

  setAnyAnimating: (isAnyAnimating) => {
    set({ isAnyAnimating });
  },

  setAnimationSpeed: (speed) => {
    set({ animationSpeed: Math.max(0.2, Math.min(3.0, speed)) });
  },
}));

// Expose store for test instrumentation and browser automation
if (typeof window !== 'undefined') {
  window.__vehicleRigStore = useVehicleRigStore;
}
