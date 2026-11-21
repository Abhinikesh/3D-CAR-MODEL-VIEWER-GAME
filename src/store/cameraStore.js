import { create } from 'zustand';

// Canonical vehicle center in Three.js world coordinates (calibrated for vehicle inspection)
export const DEFAULT_CAMERA_TARGET = [0, 0.75, 0];

// Hero isometric perspective (heroic automotive framing occupying ~68% viewport)
export const DEFAULT_CAMERA_POSITION = [3.6, 1.45, 4.2];

/**
 * Production Camera Presets
 * Vehicle Coordinate Reference:
 * - X = lateral width (2.47m) -> Left is +X, Right is -X
 * - Y = vertical height (1.74m) -> Roof is +Y, Ground is Y=0
 * - Z = longitudinal length (4.56m) -> Front is +Z, Rear is -Z
 */
export const CAMERA_PRESETS = {
  // ─── 10 Core Part 6 Presets (Strictly Preserved for Backward Compatibility) ───
  'front': {
    id: 'front',
    label: 'Front',
    category: 'Orthogonal',
    description: 'Front bumper & grille (+Z)',
    position: [0, 1.01, 6.6],
    target: [0, 0.75, 0],
    allowUnderside: false,
  },
  'rear': {
    id: 'rear',
    label: 'Rear',
    category: 'Orthogonal',
    description: 'Rear diffuser & taillights (-Z)',
    position: [0, 1.01, -6.6],
    target: [0, 0.75, 0],
    allowUnderside: false,
  },
  'left': {
    id: 'left',
    label: 'Left Side',
    category: 'Orthogonal',
    description: 'Driver-side profile (+X)',
    position: [6.0, 1.01, 0],
    target: [0, 0.75, 0],
    allowUnderside: false,
  },
  'right': {
    id: 'right',
    label: 'Right Side',
    category: 'Orthogonal',
    description: 'Passenger-side profile (-X)',
    position: [-6.0, 1.01, 0],
    target: [0, 0.75, 0],
    allowUnderside: false,
  },
  'top': {
    id: 'top',
    label: 'Top View',
    category: 'Planar',
    description: 'Plan view looking down (+Y)',
    position: [0, 8.0, 0.001],
    target: [0, 0.75, 0],
    allowUnderside: false,
  },
  'bottom': {
    id: 'bottom',
    label: 'Underside',
    category: 'Planar',
    description: 'Chassis underside looking up (-Y)',
    position: [0, -4.5, 0.001],
    target: [0, 0.75, 0],
    allowUnderside: true,
  },
  'front-left': {
    id: 'front-left',
    label: 'Front-Left 3/4',
    category: 'Isometric',
    description: 'Hero isometric perspective (Default)',
    position: [3.6, 1.45, 4.2],
    target: [0, 0.75, 0],
    allowUnderside: false,
  },
  'front-right': {
    id: 'front-right',
    label: 'Front-Right 3/4',
    category: 'Isometric',
    description: 'Front-right three-quarter angle',
    position: [-3.6, 1.45, 4.2],
    target: [0, 0.75, 0],
    allowUnderside: false,
  },
  'rear-left': {
    id: 'rear-left',
    label: 'Rear-Left 3/4',
    category: 'Isometric',
    description: 'Rear-left three-quarter angle',
    position: [3.6, 1.45, -4.2],
    target: [0, 0.75, 0],
    allowUnderside: false,
  },
  'rear-right': {
    id: 'rear-right',
    label: 'Rear-Right 3/4',
    category: 'Isometric',
    description: 'Rear-right three-quarter angle',
    position: [-3.6, 1.45, -4.2],
    target: [0, 0.75, 0],
    allowUnderside: false,
  },

  // ─── Part 12 Advanced Automotive Viewpoints ───
  'elevated-front': {
    id: 'elevated-front',
    label: 'Elevated Front',
    category: 'Cinematic',
    description: 'High-angle dramatic front showcase',
    position: [3.4, 3.76, 5.2],
    target: [0, 0.91, 0.1],
    allowUnderside: false,
  },
  'elevated-rear': {
    id: 'elevated-rear',
    label: 'Elevated Rear',
    category: 'Cinematic',
    description: 'High-angle dramatic rear showcase',
    position: [3.4, 3.76, -5.2],
    target: [0, 0.91, 0.1],
    allowUnderside: false,
  },
  'wheel-detail': {
    id: 'wheel-detail',
    label: 'Wheel Close-Up',
    category: 'Detail',
    description: 'Front-left wheel rim & caliper framing',
    position: [2.15, 0.71, 2.05],
    target: [1.05, 0.51, 1.35],
    allowUnderside: false,
  },
  'front-detail': {
    id: 'front-detail',
    label: 'Front Detail',
    category: 'Detail',
    description: 'Grille, headlights & aero splitter framing',
    position: [0.85, 1.11, 3.25],
    target: [0, 0.84, 1.95],
    allowUnderside: false,
  },
  'rear-detail': {
    id: 'rear-detail',
    label: 'Rear Detail',
    category: 'Detail',
    description: 'Taillights, decklid & diffuser framing',
    position: [0.85, 1.21, -3.35],
    target: [0, 0.94, -1.95],
    allowUnderside: false,
  },
  'interior-view': {
    id: 'interior-view',
    label: 'Cockpit View',
    category: 'Detail',
    description: 'Driver cockpit & dashboard through glass',
    position: [1.45, 1.31, 0.45],
    target: [0.15, 0.98, 0.25],
    allowUnderside: false,
  },
};

/**
 * Focus Target Definitions for Component Framing
 */
export const FOCUS_TARGETS = {
  vehicle: {
    id: 'vehicle',
    name: 'Entire Vehicle',
    target: [0, 0.91, 0.1],
    position: [3.6, 1.45, 4.2],
  },
  front: {
    id: 'front',
    name: 'Front Fascia',
    target: [0, 0.84, 1.95],
    position: [0.85, 1.11, 3.25],
  },
  rear: {
    id: 'rear',
    name: 'Rear Aero',
    target: [0, 0.94, -1.95],
    position: [0.85, 1.21, -3.35],
  },
  wheel_fl: {
    id: 'wheel_fl',
    name: 'Front-Left Wheel',
    target: [1.05, 0.51, 1.35],
    position: [2.15, 0.71, 2.05],
  },
  wheel_fr: {
    id: 'wheel_fr',
    name: 'Front-Right Wheel',
    target: [-1.05, 0.51, 1.35],
    position: [-2.15, 0.71, 2.05],
  },
  wheel_rl: {
    id: 'wheel_rl',
    name: 'Rear-Left Wheel',
    target: [1.05, 0.51, -1.35],
    position: [2.15, 0.71, -2.05],
  },
  wheel_rr: {
    id: 'wheel_rr',
    name: 'Rear-Right Wheel',
    target: [-1.05, 0.51, -1.35],
    position: [-2.15, 0.71, -2.05],
  },
  cabin: {
    id: 'cabin',
    name: 'Interior Cockpit',
    target: [0.15, 0.98, 0.25],
    position: [1.45, 1.31, 0.45],
  },
  interior: {
    id: 'interior',
    name: 'Cockpit & Interior',
    target: [0.15, 0.98, 0.25],
    position: [1.45, 1.31, 0.45],
  },
  door_fl: {
    id: 'door_fl',
    name: 'Front-Left Door',
    target: [0.95, 0.91, 0.15],
    position: [2.75, 1.41, 0.85],
  },
  door_fr: {
    id: 'door_fr',
    name: 'Front-Right Door',
    target: [-0.95, 0.91, 0.15],
    position: [-2.75, 1.41, 0.85],
  },
  bonnet: {
    id: 'bonnet',
    name: 'Front Bonnet',
    target: [0, 0.98, 1.35],
    position: [1.65, 1.81, 2.85],
  },
  boot: {
    id: 'boot',
    name: 'Boot / Hatch',
    target: [0, 1.11, -1.35],
    position: [1.65, 1.81, -2.85],
  },
  glass: {
    id: 'glass',
    name: 'Windshield Glazing',
    target: [0, 1.21, 0.2],
    position: [2.45, 2.11, 1.85],
  },
  mirrors: {
    id: 'mirrors',
    name: 'Side Mirrors',
    target: [1.0, 1.04, 0.55],
    position: [1.85, 1.31, 1.25],
  },
  headlights: {
    id: 'headlights',
    name: 'Headlight Modules',
    target: [0, 0.84, 1.95],
    position: [0.85, 1.11, 3.25],
  },
  taillights: {
    id: 'taillights',
    name: 'Taillight Array',
    target: [0, 0.94, -1.95],
    position: [0.85, 1.21, -3.35],
  },
  rims: {
    id: 'rims',
    name: 'Wheel Rims',
    target: [1.05, 0.51, 1.35],
    position: [2.15, 0.71, 2.05],
  },
  brakes: {
    id: 'brakes',
    name: 'Brake Calipers & Discs',
    target: [1.05, 0.51, 1.35],
    position: [2.15, 0.71, 2.05],
  },
  powertrain: {
    id: 'powertrain',
    name: 'Powertrain & Axles',
    target: [0, 0.71, 0.85],
    position: [1.85, 1.61, 2.15],
  },
  chassis: {
    id: 'chassis',
    name: 'Chassis & Structure',
    target: [0, 0.91, 0.1],
    position: [3.6, 1.45, 4.2],
  },
};

export const useCameraStore = create((set, get) => ({
  // Active preset key or 'custom'
  activePreset: 'front-left',

  // Projection mode: 'perspective' | 'orthographic'
  projectionMode: 'perspective',

  // Current camera target
  target: [...DEFAULT_CAMERA_TARGET],

  // Transition destination (or null if settled)
  desiredPosition: [...DEFAULT_CAMERA_POSITION],
  desiredTarget: [...DEFAULT_CAMERA_TARGET],

  // Whether a programmatic lerp is actively moving the camera
  isTransitioning: false,
  transitionId: 0,

  // Transition smoothing factor (default 7.5 for smooth exponential decay)
  transitionSmoothing: 7.5,

  // Automatic Turntable Presentation Mode
  isTurntableActive: false,
  turntableSpeed: 1.8,

  // Stored vehicle bounds from CarModel traversal
  bounds: {
    size: { x: 2.47, y: 1.74, z: 4.56 },
    center: { x: 0, y: 0.75, z: 0 },
    radius: 2.74,
  },

  // Whether underside inspection mode is active (relaxes polar constraints and hides floor)
  allowUnderside: false,

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  // Set vehicle bounds from CarModel
  setBounds: (bounds) => {
    if (!bounds) return;
    const size = bounds.size || { x: 2.47, y: 1.74, z: 4.56 };
    const center = bounds.center || { x: 0, y: 0.75, z: 0 };
    const radius = Math.sqrt(size.x ** 2 + size.y ** 2 + size.z ** 2) / 2;
    set({ bounds: { size, center, radius } });
  },

  // Select a preset view (works for all 16 presets)
  setPreset: (presetKey) => {
    const preset = CAMERA_PRESETS[presetKey];
    if (!preset) return;

    set((state) => ({
      activePreset: presetKey,
      desiredPosition: [...preset.position],
      desiredTarget: [...preset.target],
      target: [...preset.target],
      isTransitioning: true,
      allowUnderside: Boolean(preset.allowUnderside),
      isTurntableActive: false, // pause turntable on explicit preset switch
      transitionId: state.transitionId + 1,
    }));
  },

  // Focus on a specific vehicle component
  focusOn: (targetKey) => {
    const focusDef = FOCUS_TARGETS[targetKey];
    if (!focusDef) return;

    set((state) => ({
      activePreset: `focus-${targetKey}`,
      desiredPosition: [...focusDef.position],
      desiredTarget: [...focusDef.target],
      target: [...focusDef.target],
      isTransitioning: true,
      allowUnderside: false,
      isTurntableActive: false,
      transitionId: state.transitionId + 1,
    }));
  },

  // Toggle or set projection mode
  setProjectionMode: (mode) => {
    set({ projectionMode: mode });
  },

  // Turntable controls
  toggleTurntable: (active) => {
    set((state) => ({
      isTurntableActive: active !== undefined ? active : !state.isTurntableActive,
    }));
  },

  stopTurntable: () => {
    set({ isTurntableActive: false });
  },

  setTurntableSpeed: (speed) => {
    set({ turntableSpeed: speed });
  },

  setTransitionSmoothing: (factor) => {
    set({ transitionSmoothing: factor });
  },

  // Reset to default hero view
  resetView: () => {
    const defaultPreset = CAMERA_PRESETS['front-left'];
    set((state) => ({
      activePreset: 'front-left',
      projectionMode: 'perspective',
      desiredPosition: [...defaultPreset.position],
      desiredTarget: [...defaultPreset.target],
      target: [...defaultPreset.target],
      isTransitioning: true,
      allowUnderside: false,
      isTurntableActive: false,
      transitionId: state.transitionId + 1,
    }));
  },

  // Fit camera distance to completely frame vehicle bounding sphere from current view vector
  fitToVehicle: () => {
    set((state) => {
      const radius = state.bounds?.radius || 2.74;
      const fovRad = (40 * Math.PI) / 180;
      const fitDistance = (radius / Math.sin(fovRad / 2)) * 1.15;

      const currPos = state.desiredPosition || DEFAULT_CAMERA_POSITION;
      const currTarget = state.target || DEFAULT_CAMERA_TARGET;

      let dx = currPos[0] - currTarget[0];
      let dy = currPos[1] - currTarget[1];
      let dz = currPos[2] - currTarget[2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

      dx = (dx / len) * fitDistance;
      dy = (dy / len) * fitDistance;
      dz = (dz / len) * fitDistance;

      return {
        desiredPosition: [currTarget[0] + dx, currTarget[1] + dy, currTarget[2] + dz],
        desiredTarget: [...currTarget],
        isTransitioning: true,
        transitionId: state.transitionId + 1,
      };
    });
  },

  // Called when user manually interacts via orbit/zoom/pan
  setCustomView: () => {
    const { activePreset } = get();
    if (activePreset !== 'custom') {
      set({ activePreset: 'custom' });
    }
  },

  // Mark transition as completed
  finishTransition: () => {
    set({ isTransitioning: false });
  },
}));

// Expose store for test instrumentation and browser automation
if (typeof window !== 'undefined') {
  window.__cameraStore = useCameraStore;
}
