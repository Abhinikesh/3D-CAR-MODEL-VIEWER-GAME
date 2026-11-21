import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Disc,
  Layers,
  DoorOpen,
  Activity,
  Lightbulb,
  Sun,
  Box,
  RotateCcw,
  Compass,
  Check,
  Maximize2,
  Info,
  Sliders,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

// Paint Store & Presets
import { usePaintStore } from '../../store/paintStore.js';
import { PAINT_COLOR_PRESETS, PAINT_FINISH_TYPES } from '../../materials/paintPresets.js';

// Wheel Store & Presets
import { useWheelStore } from '../../store/wheelStore.js';
import {
  RIM_FINISH_PRESETS,
  CALIPER_PRESETS,
  WHEEL_TARGET_MODES,
} from '../../materials/wheelPresets.js';

// Secondary Materials Store
import { useSecondaryMaterialStore } from '../../store/secondaryMaterialStore.js';

// Vehicle Closures Rig Store & Config
import { useVehicleRigStore } from '../../store/vehicleRigStore.js';
import { CLOSURE_RIG_CONFIG, CLOSURE_IDS } from '../../utils/vehicleRigRegistry.js';

// Wheel Dynamics Store & Config
import { useWheelAnimationStore } from '../../store/wheelAnimationStore.js';
import {
  SPIN_MODES,
  WHEEL_IDS,
  radToDeg,
  degToRad,
  calculateSpeedKmh,
  calculateRpm,
} from '../../utils/wheelAnimationRegistry.js';

// Vehicle Lighting Store & Modes
import { useVehicleLightingStore } from '../../store/vehicleLightingStore.js';
import {
  HEADLIGHT_MODES,
  TAILLIGHT_MODES,
  BRAKE_MODES,
  INDICATOR_MODES,
} from '../../utils/vehicleLightingRegistry.js';

// Showroom Environment Store & Registry
import { useShowroomEnvironmentStore } from '../../store/showroomEnvironmentStore.js';
import {
  SHOWROOM_ENVIRONMENTS,
  ENVIRONMENT_IDS,
} from '../../utils/showroomEnvironmentRegistry.js';

// Camera Store
import { useCameraStore } from '../../store/cameraStore.js';

// Selection Store
import { useSelectionStore } from '../../store/selectionStore.js';

export default function ConfiguratorWorkspace({ activeTab, onClose, modelMetrics }) {
  // ─── 1. Paint State ───
  const activePresetId = usePaintStore((s) => s.activePresetId);
  const activeFinish = usePaintStore((s) => s.activeFinish);
  const primaryColor = usePaintStore((s) => s.primaryColor);
  const applyPreset = usePaintStore((s) => s.applyPreset);
  const setFinish = usePaintStore((s) => s.setFinish);
  const setCustomColor = usePaintStore((s) => s.setCustomColor);
  const resetToFactoryPaint = usePaintStore((s) => s.resetToFactory);

  // ─── 2. Wheel State ───
  const targetMode = useWheelStore((s) => s.targetMode);
  const selectedWheel = useWheelStore((s) => s.selectedWheel);
  const activeRimPresetId = useWheelStore((s) => s.activePresetId);
  const caliperPreset = useWheelStore((s) => s.caliperPreset);
  const setTargetMode = useWheelStore((s) => s.setTargetMode);
  const setSelectedWheel = useWheelStore((s) => s.setSelectedWheel);
  const setRimFinish = useWheelStore((s) => s.setRimFinish);
  const setCaliperPreset = useWheelStore((s) => s.setCaliperPreset);
  const resetWheelsToFactory = useWheelStore((s) => s.resetWheelsToFactory);

  // ─── 3. Secondary Materials State ───
  const glassProfile = useSecondaryMaterialStore((s) => s.glassProfile);
  const chromeProfile = useSecondaryMaterialStore((s) => s.chromeProfile);
  const plasticProfile = useSecondaryMaterialStore((s) => s.plasticProfile);
  const rubberProfile = useSecondaryMaterialStore((s) => s.rubberProfile);
  const setGlassProfile = useSecondaryMaterialStore((s) => s.setGlassProfile);
  const setChromeProfile = useSecondaryMaterialStore((s) => s.setChromeProfile);
  const setPlasticProfile = useSecondaryMaterialStore((s) => s.setPlasticProfile);
  const setRubberProfile = useSecondaryMaterialStore((s) => s.setRubberProfile);
  const resetSecondaryMaterials = useSecondaryMaterialStore((s) => s.resetToFactory);

  // ─── 4. Closures Rig State ───
  const closures = useVehicleRigStore((s) => s.closures);
  const toggleClosure = useVehicleRigStore((s) => s.toggleClosure);
  const openAllClosures = useVehicleRigStore((s) => s.openAll);
  const closeAllClosures = useVehicleRigStore((s) => s.closeAll);
  const resetAllClosures = useVehicleRigStore((s) => s.resetAll);

  // ─── 5. Dynamics State ───
  const isSpinning = useWheelAnimationStore((s) => s.isSpinning);
  const spinSpeed = useWheelAnimationStore((s) => s.spinSpeed);
  const spinDirection = useWheelAnimationStore((s) => s.spinDirection);
  const spinMode = useWheelAnimationStore((s) => s.spinMode);
  const currentSteeringAngle = useWheelAnimationStore((s) => s.currentSteeringAngle);
  const targetSteeringAngle = useWheelAnimationStore((s) => s.targetSteeringAngle);
  const toggleSpin = useWheelAnimationStore((s) => s.toggleSpin);
  const setSpinSpeed = useWheelAnimationStore((s) => s.setSpinSpeed);
  const reverseSpin = useWheelAnimationStore((s) => s.reverseSpin);
  const setSpinMode = useWheelAnimationStore((s) => s.setSpinMode);
  const setTargetSteeringAngle = useWheelAnimationStore((s) => s.setTargetSteeringAngle);
  const resetWheelTransforms = useWheelAnimationStore((s) => s.resetTransforms);

  // Steer angle in degrees
  const currentSteerDeg = Math.round(radToDeg(targetSteeringAngle));
  const currentSpeedKmh = calculateSpeedKmh(spinSpeed * spinDirection);
  const currentRpm = calculateRpm(spinSpeed);

  // ─── 6. Lighting State ───
  const headlightMode = useVehicleLightingStore((s) => s.headlightMode);
  const brakeMode = useVehicleLightingStore((s) => s.brakeMode);
  const indicatorMode = useVehicleLightingStore((s) => s.indicatorMode);
  const setHeadlightMode = useVehicleLightingStore((s) => s.setHeadlightMode);
  const toggleBrake = useVehicleLightingStore((s) => s.toggleBrake);
  const toggleHazard = useVehicleLightingStore((s) => s.toggleHazard);
  const setIndicator = useVehicleLightingStore((s) => s.setIndicator);
  const allLightsOff = useVehicleLightingStore((s) => s.allLightsOff);

  // ─── 7. Environment State ───
  const activeEnvId = useShowroomEnvironmentStore((s) => s.activeEnvironmentId);
  const exposureMultiplier = useShowroomEnvironmentStore((s) => s.exposureMultiplier);
  const reflectionMultiplier = useShowroomEnvironmentStore((s) => s.reflectionMultiplier);
  const shadowMultiplier = useShowroomEnvironmentStore((s) => s.shadowMultiplier);
  const setEnvironment = useShowroomEnvironmentStore((s) => s.setEnvironment);
  const setExposureMultiplier = useShowroomEnvironmentStore((s) => s.setExposureMultiplier);
  const setReflectionMultiplier = useShowroomEnvironmentStore((s) => s.setReflectionMultiplier);
  const setShadowMultiplier = useShowroomEnvironmentStore((s) => s.setShadowMultiplier);
  const resetEnvironment = useShowroomEnvironmentStore((s) => s.resetEnvironment);

  // ─── 8. Camera State ───
  const setPreset = useCameraStore((s) => s.setPreset);
  const focusOn = useCameraStore((s) => s.focusOn);
  const resetView = useCameraStore((s) => s.resetView);

  // Custom Paint Hex
  const [customHex, setCustomHex] = useState(primaryColor);

  return (
    <aside style={styles.container} aria-label="Configurator Workspace">
      {/* ─── Workspace Header ─── */}
      <div style={styles.drawerHeader}>
        <div style={styles.drawerTitleGroup}>
          <div style={styles.tabBadge}>
            <span style={styles.tabBadgeText}>{activeTab.toUpperCase()}</span>
          </div>
          <h2 style={styles.drawerTitle}>
            {activeTab === 'overview' && 'Vehicle Specification & Overview'}
            {activeTab === 'paint' && 'Exterior Paint & PBR Surface'}
            {activeTab === 'wheels' && 'Wheels, Rims & Brake Calipers'}
            {activeTab === 'materials' && 'Secondary Glass & Trim Materials'}
            {activeTab === 'closures' && 'Aerodynamics & Closures Rigging'}
            {activeTab === 'dynamics' && 'Wheel Dynamics & Steering Engine'}
            {activeTab === 'lighting' && 'Automotive Lighting Systems'}
            {activeTab === 'environment' && 'Showroom Environment & Lighting'}
          </h2>
        </div>

        <button onClick={onClose} style={styles.closeBtn} title="Collapse Panel">
          <X size={16} />
        </button>
      </div>

      {/* ─── Workspace Body ─── */}
      <div style={styles.scrollBody}>
        {/* ═══════════ TAB 1: OVERVIEW ═══════════ */}
        {activeTab === 'overview' && (
          <div style={styles.sectionStack}>
            {/* Purposeful Light Surface Card for High Readability of Specs */}
            <div style={styles.lightSpecCard}>
              <div style={styles.lightCardHeader}>
                <span style={styles.lightCardTitle}>CHASSIS SPECIFICATIONS</span>
                <span style={styles.lightCardBadge}>VERIFIED CAD</span>
              </div>
              <div style={styles.specGrid}>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Overall Dimensions</span>
                  <span style={styles.specValue}>{modelMetrics?.dimensions || '4.56m × 2.47m × 1.74m'}</span>
                </div>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Ground Tangency</span>
                  <span style={styles.specValue}>{modelMetrics?.groundContact || 'Y = 0.000m (Verified)'}</span>
                </div>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Total Triangles</span>
                  <span style={styles.specValue}>{modelMetrics?.triangleCount?.toLocaleString() || '213,347'}</span>
                </div>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Mesh Count</span>
                  <span style={styles.specValue}>{modelMetrics?.meshCount || '97'} Meshes</span>
                </div>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Asset Source</span>
                  <span style={styles.specValue}>Khronos Group Car Concept (CC BY 4.0)</span>
                </div>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Coordinate System</span>
                  <span style={styles.specValue}>Right-Handed Y-Up (+Z Forward)</span>
                </div>
              </div>
            </div>

            {/* Quick Hero Framing Actions */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>HERO CAMERA FRAMING</span>
              <div style={styles.pillGrid}>
                <button onClick={() => setPreset('front-left')} style={styles.pillBtn}>
                  FRONT 3/4 SHOWCASE
                </button>
                <button onClick={() => setPreset('side-left')} style={styles.pillBtn}>
                  LEFT PROFILE
                </button>
                <button onClick={() => setPreset('rear-left')} style={styles.pillBtn}>
                  REAR 3/4 SHOWCASE
                </button>
                <button onClick={() => setPreset('cockpit')} style={styles.pillBtn}>
                  COCKPIT INSPECTION
                </button>
              </div>
            </div>

            {/* Master Vehicle Reset */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>MASTER CONFIGURATION RESTORE</span>
              <button
                onClick={() => {
                  resetToFactoryPaint();
                  resetWheelsToFactory();
                  resetSecondaryMaterials();
                  resetAllClosures();
                  resetWheelTransforms();
                  allLightsOff();
                  resetEnvironment();
                  resetView();
                  useSelectionStore.getState().clearSelection();
                }}
                style={styles.masterResetBtn}
              >
                <RotateCcw size={14} />
                <span>RESTORE ALL OEM FACTORY SETTINGS</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ TAB 2: PAINTWORK ═══════════ */}
        {activeTab === 'paint' && (
          <div style={styles.sectionStack}>
            {/* Curated Presets Grid */}
            <div style={styles.actionCard}>
              <div style={styles.cardHeaderRow}>
                <span style={styles.cardSectionLabel}>CURATED AUTOMOTIVE COLORWAYS</span>
                <span style={styles.subtextCount}>12 Presets</span>
              </div>
              <div style={styles.colorChipsGrid}>
                {PAINT_COLOR_PRESETS.map((preset) => {
                  const isSelected = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset.id)}
                      style={{
                        ...styles.colorChipBtn,
                        border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid rgba(255, 255, 255, 0.12)',
                        boxShadow: isSelected ? '0 0 12px rgba(0, 240, 255, 0.35)' : 'none',
                      }}
                      title={`${preset.name} (${preset.category})`}
                    >
                      <div
                        style={{
                          ...styles.colorSwatchCircle,
                          backgroundColor: preset.primaryColor || preset.color,
                        }}
                      />
                      <span style={isSelected ? styles.chipTextActive : styles.chipText}>
                        {preset.name}
                      </span>
                      {isSelected && (
                        <div style={styles.checkIconBadge}>
                          <Check size={10} color="#000000" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Finish Category Selectors */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>PBR SURFACE FINISH FORMULATION</span>
              <div style={styles.finishPillsRow}>
                {Object.keys(PAINT_FINISH_TYPES).map((finishKey) => {
                  const isSelected = activeFinish === finishKey;
                  return (
                    <button
                      key={finishKey}
                      onClick={() => setFinish(finishKey)}
                      style={{
                        ...styles.finishPillBtn,
                        ...(isSelected ? styles.finishPillActive : {}),
                      }}
                    >
                      <span>{finishKey.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Input */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>BESPOKE CUSTOM HEX COLOR</span>
              <div style={styles.customColorRow}>
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => {
                    setCustomHex(e.target.value);
                    setCustomColor(e.target.value);
                  }}
                  style={styles.nativeColorInput}
                />
                <input
                  type="text"
                  value={customHex.toUpperCase()}
                  onChange={(e) => {
                    setCustomHex(e.target.value);
                    if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                      setCustomColor(e.target.value);
                    }
                  }}
                  style={styles.hexTextInput}
                  maxLength={7}
                />
                <button
                  onClick={resetToFactoryPaint}
                  style={styles.resetMiniBtn}
                  title="Reset to Factory Metallic Orange"
                >
                  <RotateCcw size={12} />
                  <span>RESET</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ TAB 3: WHEELS & TIRES ═══════════ */}
        {activeTab === 'wheels' && (
          <div style={styles.sectionStack}>
            {/* Target Axle Selector */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>CUSTOMIZATION TARGET AXLE / WHEEL</span>
              <div style={styles.targetWheelsRow}>
                {[
                  { id: WHEEL_TARGET_MODES.ALL, label: 'ALL 4 WHEELS' },
                  { id: WHEEL_TARGET_MODES.FRONT_REAR, label: 'FRONT / REAR SPLIT' },
                  { id: WHEEL_TARGET_MODES.INDIVIDUAL, label: 'INDIVIDUAL WHEEL' },
                ].map((target) => {
                  const isSelected = targetMode === target.id;
                  return (
                    <button
                      key={target.id}
                      onClick={() => setTargetMode(target.id)}
                      style={{
                        ...styles.targetBtn,
                        ...(isSelected ? styles.targetBtnActive : {}),
                      }}
                    >
                      <span>{target.label}</span>
                    </button>
                  );
                })}
              </div>

              {targetMode === WHEEL_TARGET_MODES.INDIVIDUAL && (
                <div style={styles.individualWheelRow}>
                  {['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map((wId) => {
                    const isSelected = selectedWheel === wId;
                    return (
                      <button
                        key={wId}
                        onClick={() => setSelectedWheel(wId)}
                        style={{
                          ...styles.indivBtn,
                          ...(isSelected ? styles.indivBtnActive : {}),
                        }}
                      >
                        {wId.replace('wheel_', '').toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rim Finish Presets */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>ALLOY RIM FINISH PRESETS</span>
              <div style={styles.colorChipsGrid}>
                {Object.entries(RIM_FINISH_PRESETS).map(([key, preset]) => {
                  const isSelected = activeRimPresetId === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setRimFinish(key)}
                      style={{
                        ...styles.colorChipBtn,
                        border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid rgba(255, 255, 255, 0.12)',
                        boxShadow: isSelected ? '0 0 10px rgba(0, 240, 255, 0.3)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          ...styles.colorSwatchCircle,
                          backgroundColor: preset.outerColor || '#888888',
                        }}
                      />
                      <span style={isSelected ? styles.chipTextActive : styles.chipText}>
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Brake Calipers */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>BRAKE CALIPER FINISH</span>
              <div style={styles.caliperRow}>
                {Object.entries(CALIPER_PRESETS).map(([key, preset]) => {
                  const isSelected = caliperPreset === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setCaliperPreset(key)}
                      style={{
                        ...styles.caliperBtn,
                        border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <div style={{ ...styles.caliperDot, backgroundColor: preset.color || '#CCCCCC' }} />
                      <span style={isSelected ? styles.chipTextActive : styles.chipText}>
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Single Geometry Notice */}
            <div style={styles.noticeBox}>
              <Info size={14} color="var(--accent-cyan)" />
              <span style={styles.noticeText}>
                Model incorporates OEM lightweight directional 5-spoke alloys. Customization supports PBR finish &amp; caliper color variations on verified sub-meshes.
              </span>
            </div>
          </div>
        )}

        {/* ═══════════ TAB 4: MATERIALS ═══════════ */}
        {activeTab === 'materials' && (
          <div style={styles.sectionStack}>
            {/* Automotive Glass Profiles */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>PHYSICAL TRANSMISSION GLASS</span>
              <div style={styles.optionsList}>
                {[
                  { id: 'factory', label: 'Factory Tinted Glass (High Transmission)', trans: '92%', ior: '1.52' },
                  { id: 'dark', label: 'Executive Dark Smoke Tint', trans: '65%', ior: '1.52' },
                  { id: 'clear', label: 'Ultra-Clear Optical Glass', trans: '98%', ior: '1.50' },
                ].map((g) => {
                  const isSelected = glassProfile === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setGlassProfile(g.id)}
                      style={{
                        ...styles.optionRowBtn,
                        border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: isSelected ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      }}
                    >
                      <span style={isSelected ? styles.optionLabelActive : styles.optionLabel}>
                        {g.label}
                      </span>
                      <span style={styles.optionSub}>{g.trans} Trans &bull; IOR {g.ior}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chrome & Metallic Hardware */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>CHROME &amp; POLISHED HARDWARE</span>
              <div style={styles.pillGrid}>
                {[
                  { id: 'chrome', label: 'Factory Mirror Chrome' },
                  { id: 'dark_metal', label: 'Dark Gunmetal Chrome' },
                  { id: 'brushed', label: 'Brushed Aluminum' },
                ].map((c) => {
                  const isSelected = chromeProfile === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setChromeProfile(c.id)}
                      style={{
                        ...styles.pillBtn,
                        ...(isSelected ? styles.pillBtnActive : {}),
                      }}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plastics & Rubber */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>BODY PLASTICS &amp; TIRE RUBBER</span>
              <div style={styles.specGrid}>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Exterior Plastics</span>
                  <button
                    onClick={() => setPlasticProfile(plasticProfile === 'black_matte' ? 'gloss_black' : 'black_matte')}
                    style={styles.toggleTextBtn}
                  >
                    {plasticProfile === 'black_matte' ? 'SATIN MATTE BLACK' : 'GLOSS PIANO BLACK'}
                  </button>
                </div>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Tire Rubber</span>
                  <button
                    onClick={() => setRubberProfile(rubberProfile === 'factory' ? 'worn' : 'factory')}
                    style={styles.toggleTextBtn}
                  >
                    {rubberProfile === 'factory' ? 'FACTORY NATURAL' : 'WEATHERED TRACK'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ TAB 5: CLOSURES & RIGGING ═══════════ */}
        {activeTab === 'closures' && (
          <div style={styles.sectionStack}>
            {/* Master Open / Close Actions */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>SYNCHRONIZED KINEMATIC ACTIONS</span>
              <div style={styles.doubleBtnRow}>
                <button onClick={openAllClosures} style={styles.openAllBtn}>
                  <DoorOpen size={14} />
                  <span>OPEN ALL CLOSURES</span>
                </button>
                <button onClick={closeAllClosures} style={styles.closeAllBtn}>
                  <X size={14} />
                  <span>CLOSE ALL</span>
                </button>
              </div>
            </div>

            {/* Individual Closures List */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>INDIVIDUAL VEHICLE PANELS</span>
              <div style={styles.closuresStack}>
                {CLOSURE_IDS.map((closureId) => {
                  const conf = CLOSURE_RIG_CONFIG[closureId];
                  const state = closures[closureId] || { progress: 0, state: 'closed' };
                  const percent = Math.round(state.progress * 100);
                  const isOpen = percent > 10;
                  return (
                    <div key={closureId} style={styles.closureRowCard}>
                      <div style={styles.closureRowTop}>
                        <div style={styles.closureNameGroup}>
                          <span style={styles.closureName}>{conf.name}</span>
                          <span
                            style={{
                              ...styles.closureStateBadge,
                              backgroundColor: isOpen ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255, 255, 255, 0.06)',
                              color: isOpen ? '#10B981' : 'var(--text-muted)',
                            }}
                          >
                            {state.state.toUpperCase()} ({percent}%)
                          </span>
                        </div>

                        <div style={styles.closureBtnGroup}>
                          <button
                            onClick={() => focusOn(closureId)}
                            style={styles.focusMiniBtn}
                            title={`Focus camera on ${conf.name}`}
                          >
                            <Maximize2 size={12} />
                          </button>
                          <button
                            onClick={() => toggleClosure(closureId)}
                            style={{
                              ...styles.toggleClosureBtn,
                              backgroundColor: isOpen ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 240, 255, 0.12)',
                              color: isOpen ? '#EF4444' : 'var(--accent-cyan)',
                              borderColor: isOpen ? 'rgba(239, 68, 68, 0.35)' : 'rgba(0, 240, 255, 0.3)',
                            }}
                          >
                            {isOpen ? 'CLOSE' : 'OPEN'}
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div style={styles.progressBarTrack}>
                        <div
                          style={{
                            ...styles.progressBarFill,
                            width: `${percent}%`,
                            backgroundColor: isOpen ? '#10B981' : 'var(--accent-cyan)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ TAB 6: DYNAMICS & POWERTRAIN ═══════════ */}
        {activeTab === 'dynamics' && (
          <div style={styles.sectionStack}>
            {/* Speedometer Telemetry Readout Card */}
            <div style={styles.lightSpecCard}>
              <div style={styles.lightCardHeader}>
                <span style={styles.lightCardTitle}>WHEEL SPIN TELEMETRY</span>
                <span style={styles.lightCardBadge}>
                  {isSpinning ? 'SPINNING ACTIVE' : 'IDLE STATIONARY'}
                </span>
              </div>
              <div style={styles.specGrid}>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Linear Simulated Speed</span>
                  <span style={styles.specValue}>{currentSpeedKmh.toFixed(1)} km/h</span>
                </div>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Wheel Angular Speed</span>
                  <span style={styles.specValue}>{Math.round(currentRpm)} RPM</span>
                </div>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Front Steering Yaw</span>
                  <span style={styles.specValue}>{currentSteerDeg > 0 ? `+${currentSteerDeg}°` : `${currentSteerDeg}°`}</span>
                </div>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Ground Constraint</span>
                  <span style={styles.specValue}>Stationary Y = 0.000m</span>
                </div>
              </div>
            </div>

            {/* Wheel Spin Actions */}
            <div style={styles.actionCard}>
              <div style={styles.cardHeaderRow}>
                <span style={styles.cardSectionLabel}>AXIAL WHEEL ROTATION</span>
                <button
                  onClick={toggleSpin}
                  style={{
                    ...styles.spinToggleBtn,
                    backgroundColor: isSpinning ? '#EF4444' : '#10B981',
                  }}
                >
                  {isSpinning ? 'STOP ROTATION' : 'START SPIN'}
                </button>
              </div>

              {/* Speed Presets */}
              <div style={styles.pillGrid}>
                {[
                  { speed: 0.5, label: '0.5x CRUISE' },
                  { speed: 1.0, label: '1.0x NORMAL' },
                  { speed: 1.5, label: '1.5x FAST' },
                  { speed: 2.5, label: '2.5x HIGH-SPEED' },
                ].map((p) => {
                  const isSelected = isSpinning && Math.abs(spinSpeed - p.speed) < 0.05;
                  return (
                    <button
                      key={p.speed}
                      onClick={() => {
                        setSpinSpeed(p.speed);
                        if (!isSpinning) toggleSpin();
                      }}
                      style={{
                        ...styles.pillBtn,
                        ...(isSelected ? styles.pillBtnActive : {}),
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Direction Toggle */}
              <div style={styles.sliderHeaderRow}>
                <span style={styles.sliderSubLabel}>DIRECTION</span>
                <div style={styles.dirBtnGroup}>
                  <button
                    onClick={() => {
                      if (spinDirection !== 1) reverseSpin();
                    }}
                    style={{
                      ...styles.dirBtn,
                      backgroundColor: spinDirection === 1 ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                      color: spinDirection === 1 ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    }}
                  >
                    FORWARD
                  </button>
                  <button
                    onClick={() => {
                      if (spinDirection !== -1) reverseSpin();
                    }}
                    style={{
                      ...styles.dirBtn,
                      backgroundColor: spinDirection === -1 ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                      color: spinDirection === -1 ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    }}
                  >
                    REVERSE
                  </button>
                </div>
              </div>
            </div>

            {/* Front Wheel Steering Slider */}
            <div style={styles.actionCard}>
              <div style={styles.sliderHeaderRow}>
                <span style={styles.cardSectionLabel}>FRONT WHEEL STEERING</span>
                <span style={styles.sliderValueText}>{currentSteerDeg}°</span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                step="1"
                value={currentSteerDeg}
                onChange={(e) => setTargetSteeringAngle(degToRad(Number(e.target.value)))}
                style={styles.fullSlider}
              />
              <div style={styles.sliderSnapRow}>
                <button onClick={() => setTargetSteeringAngle(degToRad(-30))} style={styles.snapBtn}>FULL LEFT (-30°)</button>
                <button onClick={() => setTargetSteeringAngle(0)} style={styles.snapBtn}>CENTER (0°)</button>
                <button onClick={() => setTargetSteeringAngle(degToRad(30))} style={styles.snapBtn}>FULL RIGHT (+30°)</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ TAB 7: LIGHTING ═══════════ */}
        {activeTab === 'lighting' && (
          <div style={styles.sectionStack}>
            {/* Master Headlamps */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>HEADLAMP ILLUMINATION MODES</span>
              <div style={styles.lightingPillGrid}>
                {[
                  { id: HEADLIGHT_MODES.OFF, label: 'ALL OFF' },
                  { id: HEADLIGHT_MODES.PARKING, label: 'PARKING / DRL' },
                  { id: HEADLIGHT_MODES.LOW_BEAM, label: 'LOW BEAM (18m)' },
                  { id: HEADLIGHT_MODES.HIGH_BEAM, label: 'HIGH BEAM (38m)' },
                ].map((mode) => {
                  const isSelected = headlightMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setHeadlightMode(mode.id)}
                      style={{
                        ...styles.lightingModeBtn,
                        border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      }}
                    >
                      <span style={isSelected ? styles.chipTextActive : styles.chipText}>
                        {mode.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Brake & Hazard Controls */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>BRAKE LIGHT &amp; HAZARD FLASHER</span>
              <div style={styles.doubleBtnRow}>
                <button
                  onClick={toggleBrake}
                  style={{
                    ...styles.brakeToggleBtn,
                    backgroundColor: brakeMode === BRAKE_MODES.ACTIVE ? '#EF4444' : 'rgba(239, 68, 68, 0.12)',
                    color: brakeMode === BRAKE_MODES.ACTIVE ? '#FFFFFF' : '#EF4444',
                  }}
                >
                  {brakeMode === BRAKE_MODES.ACTIVE ? 'RELEASE BRAKES' : 'PRESS BRAKE PEDAL'}
                </button>
                <button
                  onClick={toggleHazard}
                  style={{
                    ...styles.hazardToggleBtn,
                    backgroundColor: indicatorMode === INDICATOR_MODES.HAZARD ? '#F59E0B' : 'rgba(245, 158, 11, 0.12)',
                    color: indicatorMode === INDICATOR_MODES.HAZARD ? '#000000' : '#F59E0B',
                  }}
                >
                  {indicatorMode === INDICATOR_MODES.HAZARD ? 'HAZARDS FLASHING (1.5 Hz)' : 'HAZARD WARNING'}
                </button>
              </div>
            </div>

            {/* Indicator Selectors */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>DIRECTIONAL TURN SIGNALS</span>
              <div style={styles.pillGrid}>
                <button
                  onClick={() => setIndicator(indicatorMode === INDICATOR_MODES.LEFT ? INDICATOR_MODES.OFF : INDICATOR_MODES.LEFT)}
                  style={{
                    ...styles.pillBtn,
                    ...(indicatorMode === INDICATOR_MODES.LEFT ? styles.pillBtnActive : {}),
                  }}
                >
                  LEFT INDICATOR
                </button>
                <button
                  onClick={() => setIndicator(INDICATOR_MODES.OFF)}
                  style={styles.pillBtn}
                >
                  SIGNALS OFF
                </button>
                <button
                  onClick={() => setIndicator(indicatorMode === INDICATOR_MODES.RIGHT ? INDICATOR_MODES.OFF : INDICATOR_MODES.RIGHT)}
                  style={{
                    ...styles.pillBtn,
                    ...(indicatorMode === INDICATOR_MODES.RIGHT ? styles.pillBtnActive : {}),
                  }}
                >
                  RIGHT INDICATOR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ TAB 8: ENVIRONMENT ═══════════ */}
        {activeTab === 'environment' && (
          <div style={styles.sectionStack}>
            {/* Environment Cards */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>AUTOMOTIVE PRESENTATION ENVIRONMENTS</span>
              <div style={styles.envGrid}>
                {ENVIRONMENT_IDS.map((envId) => {
                  const env = SHOWROOM_ENVIRONMENTS[envId];
                  const isSelected = activeEnvId === envId;
                  return (
                    <button
                      key={envId}
                      onClick={() => setEnvironment(envId)}
                      style={{
                        ...styles.envCardItem,
                        border: isSelected ? `1px solid ${env.themeColor}` : '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: isSelected ? `${env.themeColor}12` : 'rgba(255, 255, 255, 0.03)',
                      }}
                    >
                      <div style={styles.envCardTop}>
                        <span style={{ ...styles.envBadge, color: env.themeColor, backgroundColor: `${env.themeColor}20` }}>
                          {env.badge}
                        </span>
                        <span style={styles.envCardName}>{env.name}</span>
                        {isSelected && <Check size={12} color={env.themeColor} />}
                      </div>
                      <p style={styles.envCardSub}>{env.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calibration Sliders */}
            <div style={styles.actionCard}>
              <span style={styles.cardSectionLabel}>LIGHTING &amp; EXPOSURE CALIBRATION</span>
              <div style={styles.sliderGroup}>
                <div style={styles.sliderHeaderRow}>
                  <span style={styles.sliderSubLabel}>TONE MAPPING EXPOSURE</span>
                  <span style={styles.sliderValueText}>{exposureMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.4"
                  step="0.05"
                  value={exposureMultiplier}
                  onChange={(e) => setExposureMultiplier(Number(e.target.value))}
                  style={styles.fullSlider}
                />
              </div>

              <div style={styles.sliderGroup}>
                <div style={styles.sliderHeaderRow}>
                  <span style={styles.sliderSubLabel}>HDR REFLECTION INTENSITY</span>
                  <span style={styles.sliderValueText}>{reflectionMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={reflectionMultiplier}
                  onChange={(e) => setReflectionMultiplier(Number(e.target.value))}
                  style={styles.fullSlider}
                />
              </div>

              <div style={styles.sliderGroup}>
                <div style={styles.sliderHeaderRow}>
                  <span style={styles.sliderSubLabel}>CONTACT SHADOW DENSITY</span>
                  <span style={styles.sliderValueText}>{shadowMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.5"
                  step="0.05"
                  value={shadowMultiplier}
                  onChange={(e) => setShadowMultiplier(Number(e.target.value))}
                  style={styles.fullSlider}
                />
              </div>

              <button onClick={resetEnvironment} style={styles.resetFullBtn}>
                <RotateCcw size={12} />
                <span>RESET TO DEFAULT PREMIUM STUDIO</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

const styles = {
  container: {
    width: '420px',
    height: '100%',
    backgroundColor: 'rgba(10, 14, 20, 0.96)',
    backdropFilter: 'blur(24px)',
    borderLeft: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    zIndex: 25,
    animation: 'slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.95rem 1.25rem',
    borderBottom: '1px solid var(--border-subtle)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  drawerTitleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  tabBadge: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: '0.70rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-cyan)',
    letterSpacing: '0.1em',
  },
  drawerTitle: {
    fontSize: '0.96rem',
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: '0.02em',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    color: 'var(--text-muted)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-subtle)',
    transition: 'all 0.15s ease',
  },
  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.15rem',
  },
  sectionStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  lightSpecCard: {
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    borderRadius: '8px',
    padding: '0.95rem 1.15rem',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
    border: '1px solid #E2E8F0',
  },
  lightCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #E2E8F0',
    paddingBottom: '0.5rem',
    marginBottom: '0.75rem',
  },
  lightCardTitle: {
    fontSize: '0.76rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
    color: '#0F172A',
    letterSpacing: '0.08em',
  },
  lightCardBadge: {
    fontSize: '0.68rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  specGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem 1rem',
  },
  specItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  specKey: {
    fontSize: '0.68rem',
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  specValue: {
    fontSize: '0.80rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    color: '#0F172A',
  },
  actionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    padding: '0.95rem 1.05rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  cardHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSectionLabel: {
    fontSize: '0.74rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-cyan)',
    letterSpacing: '0.08em',
  },
  subtextCount: {
    fontSize: '0.70rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  pillGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
  },
  pillBtn: {
    padding: '8px 10px',
    minHeight: '36px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    fontSize: '0.74rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    textAlign: 'center',
    transition: 'all 0.15s ease',
  },
  pillBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.14)',
    color: 'var(--accent-cyan)',
    borderColor: 'rgba(0, 240, 255, 0.35)',
  },
  colorChipsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  colorChipBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    minHeight: '38px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-subtle)',
    position: 'relative',
    transition: 'all 0.15s ease',
  },
  colorSwatchCircle: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    flexShrink: 0,
    boxShadow: '0 0 6px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255, 255, 255, 0.35)',
  },
  chipText: {
    fontSize: '0.76rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chipTextActive: {
    fontSize: '0.76rem',
    fontWeight: '800',
    color: '#FFFFFF',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  checkIconBadge: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-cyan)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishPillsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  finishPillBtn: {
    padding: '7px 12px',
    minHeight: '34px',
    borderRadius: '5px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    fontSize: '0.74rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    transition: 'all 0.15s ease',
  },
  finishPillActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    color: 'var(--accent-cyan)',
    borderColor: 'rgba(0, 240, 255, 0.3)',
  },
  customColorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  nativeColorInput: {
    width: '36px',
    height: '36px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },
  hexTextInput: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: '5px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-subtle)',
    color: '#FFFFFF',
    fontSize: '0.78rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: '700',
  },
  resetMiniBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '7px 12px',
    borderRadius: '5px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  targetWheelsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px',
  },
  targetBtn: {
    padding: '6px 12px',
    minHeight: '32px',
    borderRadius: '5px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  targetBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    color: 'var(--accent-cyan)',
    borderColor: 'rgba(0, 240, 255, 0.35)',
  },
  individualWheelRow: {
    display: 'flex',
    gap: '5px',
    marginTop: '4px',
  },
  indivBtn: {
    flex: 1,
    padding: '6px 8px',
    minHeight: '32px',
    borderRadius: '5px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    fontSize: '0.70rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  indivBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    color: 'var(--accent-cyan)',
    borderColor: 'rgba(0, 240, 255, 0.35)',
  },
  caliperRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px',
  },
  caliperBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 10px',
    minHeight: '36px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-subtle)',
  },
  caliperDot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
  },
  noticeBox: {
    display: 'flex',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: '6px',
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
    border: '1px solid rgba(0, 240, 255, 0.18)',
  },
  noticeText: {
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  optionRowBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    minHeight: '38px',
    borderRadius: '6px',
    border: '1px solid var(--border-subtle)',
  },
  optionLabel: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  optionLabelActive: {
    fontSize: '0.78rem',
    color: 'var(--accent-cyan)',
    fontWeight: '700',
  },
  optionSub: {
    fontSize: '0.70rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  toggleTextBtn: {
    fontSize: '0.74rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-cyan)',
    textAlign: 'left',
  },
  doubleBtnRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  openAllBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 12px',
    minHeight: '36px',
    borderRadius: '6px',
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    color: 'var(--accent-cyan)',
    fontSize: '0.74rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  closeAllBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 12px',
    minHeight: '36px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    fontSize: '0.74rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  closuresStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  closureRowCard: {
    padding: '9px 11px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  closureRowTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closureNameGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  closureName: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closureStateBadge: {
    fontSize: '0.68rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  closureBtnGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  focusMiniBtn: {
    padding: '5px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
  },
  toggleClosureBtn: {
    padding: '5px 10px',
    minHeight: '30px',
    borderRadius: '4px',
    border: '1px solid',
    fontSize: '0.70rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  progressBarTrack: {
    width: '100%',
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    transition: 'width 0.1s linear',
  },
  spinToggleBtn: {
    padding: '6px 12px',
    minHeight: '32px',
    borderRadius: '5px',
    color: '#FFFFFF',
    fontSize: '0.72rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  sliderHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderSubLabel: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  sliderValueText: {
    fontSize: '0.76rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-cyan)',
  },
  dirBtnGroup: {
    display: 'flex',
    gap: '5px',
  },
  dirBtn: {
    padding: '4px 9px',
    borderRadius: '4px',
    fontSize: '0.68rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    border: '1px solid var(--border-subtle)',
  },
  fullSlider: {
    width: '100%',
    cursor: 'pointer',
  },
  sliderSnapRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  snapBtn: {
    fontSize: '0.68rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    fontWeight: '600',
  },
  lightingPillGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  lightingModeBtn: {
    padding: '9px 11px',
    minHeight: '38px',
    borderRadius: '6px',
    border: '1px solid',
    textAlign: 'center',
    fontSize: '0.74rem',
  },
  brakeToggleBtn: {
    padding: '9px 12px',
    minHeight: '38px',
    borderRadius: '6px',
    border: '1px solid #EF4444',
    fontSize: '0.74rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  hazardToggleBtn: {
    padding: '9px 12px',
    minHeight: '38px',
    borderRadius: '6px',
    border: '1px solid #F59E0B',
    fontSize: '0.74rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  envGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  envCardItem: {
    padding: '10px 11px',
    minHeight: '68px',
    borderRadius: '6px',
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    textAlign: 'left',
  },
  envCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  envBadge: {
    fontSize: '0.66rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
    padding: '2px 5px',
    borderRadius: '3px',
  },
  envCardName: {
    fontSize: '0.76rem',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  envCardSub: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
  sliderGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  resetFullBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '9px 12px',
    minHeight: '36px',
    borderRadius: '5px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    fontSize: '0.72rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    marginTop: '4px',
  },
  masterResetBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 14px',
    minHeight: '38px',
    borderRadius: '6px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    color: '#EF4444',
    fontSize: '0.74rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
};
