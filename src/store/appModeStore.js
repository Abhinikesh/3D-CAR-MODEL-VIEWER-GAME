import { create } from 'zustand';
import { useVehicleInputStore } from '../scenes/driving/vehicleInputStore.js';
import { useVehiclePhysicsStore } from './vehiclePhysicsStore.js';
import { useControllerSessionStore } from '../services/controller/controllerSessionStore.js';

export const APP_MODES = {
  SHOWROOM: 'showroom',
  DRIVING: 'driving',
};

export const DRIVING_VIEWS = {
  CHASE: 'chase',
  CLOSE: 'close',
  WIDE: 'wide',
  HOOD: 'hood',
  BUMPER: 'bumper',
  ORBIT: 'orbit',
  AERIAL: 'aerial',
  TURN1: 'turn1',
  HAIRPIN: 'hairpin',
};

/**
 * App Mode Store
 * Manages top-level application operating state:
 * - 'showroom': Interactive 3D configurator, studio lighting, inspection cameras, closures, customization panels.
 * - 'driving': Real-time vehicle physics, dynamic test environment, follow camera, HUD telemetry.
 */
export const useAppModeStore = create((set, get) => ({
  mode: APP_MODES.SHOWROOM,
  drivingView: DRIVING_VIEWS.CHASE,
  cameraResetTrigger: 0,

  setMode: (newMode) => {
    if (Object.values(APP_MODES).includes(newMode)) {
      const prevMode = get().mode;
      if (prevMode !== newMode) {
        if (prevMode === APP_MODES.DRIVING && newMode === APP_MODES.SHOWROOM) {
          // Returning to Showroom: safely neutralize inputs, dispose physics, and reset controller session
          try {
            useVehicleInputStore.getState().resetInputs();
            useVehiclePhysicsStore.getState().disposePhysics();
            useControllerSessionStore.getState().resetSession();
          } catch (_) {}
        } else if (prevMode === APP_MODES.SHOWROOM && newMode === APP_MODES.DRIVING) {
          // Entering Driving Mode: ensure clean initial inputs and request vehicle spawn reset
          try {
            useVehicleInputStore.getState().resetInputs();
            useVehiclePhysicsStore.getState().requestReset();
          } catch (_) {}
        }
      }
      set({ mode: newMode });
    }
  },

  toggleMode: () => {
    set((state) => ({
      mode: state.mode === APP_MODES.SHOWROOM ? APP_MODES.DRIVING : APP_MODES.SHOWROOM,
    }));
  },

  setDrivingView: (view) => {
    if (Object.values(DRIVING_VIEWS).includes(view)) {
      set({ drivingView: view });
    }
  },

  cycleDrivingView: () => {
    const cycleOrder = [
      DRIVING_VIEWS.CHASE,
      DRIVING_VIEWS.CLOSE,
      DRIVING_VIEWS.WIDE,
      DRIVING_VIEWS.HOOD,
      DRIVING_VIEWS.BUMPER,
    ];
    set((state) => {
      const currentIndex = cycleOrder.indexOf(state.drivingView);
      const nextIndex = (currentIndex + 1) % cycleOrder.length;
      return { drivingView: cycleOrder[nextIndex] };
    });
  },

  resetDrivingCamera: () => {
    set((state) => ({ cameraResetTrigger: state.cameraResetTrigger + 1 }));
  },

  isDrivingMode: () => get().mode === APP_MODES.DRIVING,
  isShowroomMode: () => get().mode === APP_MODES.SHOWROOM,
}));

// Expose store globally for test harnesses and browser automation
if (typeof window !== 'undefined') {
  window.__appModeStore = useAppModeStore;
}

