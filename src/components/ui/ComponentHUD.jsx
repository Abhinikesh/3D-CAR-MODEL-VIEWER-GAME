import React, { useEffect, useState } from 'react';
import {
  Layers,
  Crosshair,
  Maximize2,
  Eye,
  Box,
  X,
  Compass,
  RotateCw,
  Zap,
  ChevronRight,
  Sliders,
  Check,
  DoorOpen,
  DoorClosed,
} from 'lucide-react';
import { useSelectionStore } from '../../store/selectionStore.js';
import { useCameraStore } from '../../store/cameraStore.js';
import { useVehicleRigStore } from '../../store/vehicleRigStore.js';
import { useWheelAnimationStore } from '../../store/wheelAnimationStore.js';
import { useVehicleLightingStore } from '../../store/vehicleLightingStore.js';
import { SEMANTIC_COMPONENTS } from '../../utils/carAssetRegistry.js';
import { COMPONENT_TECHNICAL_DATA } from '../../utils/componentResolver.js';
import { CLOSURE_RIG_CONFIG, isAnimatableClosure } from '../../utils/vehicleRigRegistry.js';
import {
  isWheelComponent,
  getWheelConfig,
  radToDeg,
  calculateRpm,
} from '../../utils/wheelAnimationRegistry.js';
import {
  HEADLIGHT_MODES,
  BRAKE_MODES,
  INDICATOR_MODES,
} from '../../utils/vehicleLightingRegistry.js';

// Group components by functional automotive category for the explorer drawer
const COMPONENT_CATEGORIES = {
  'Closures & Body': ['door_fl', 'door_fr', 'bonnet', 'boot', 'chassis'],
  'Wheels & Brakes': ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr', 'rims', 'brakes'],
  'Lighting & Glazing': ['headlights', 'taillights', 'glass', 'mirrors'],
  'Interior & Drivetrain': ['interior', 'powertrain'],
};

export default function ComponentHUD() {
  const selectedComponentId = useSelectionStore((state) => state.selectedComponentId);
  const selectedComponent = useSelectionStore((state) => state.selectedComponent);
  const hoveredComponentId = useSelectionStore((state) => state.hoveredComponentId);
  const showBoundingBox = useSelectionStore((state) => state.showBoundingBox);
  const showWireframe = useSelectionStore((state) => state.showWireframe);
  const focusOnClick = useSelectionStore((state) => state.focusOnClick);
  const isDrawerOpen = useSelectionStore((state) => state.isDrawerOpen);

  const closures = useVehicleRigStore((state) => state.closures);
  const toggleClosure = useVehicleRigStore((state) => state.toggleClosure);

  const isSpinning = useWheelAnimationStore((state) => state.isSpinning);
  const spinSpeed = useWheelAnimationStore((state) => state.spinSpeed);
  const toggleSpin = useWheelAnimationStore((state) => state.toggleSpin);
  const currentSteeringAngle = useWheelAnimationStore((state) => state.currentSteeringAngle);
  const steerLeft = useWheelAnimationStore((state) => state.steerLeft);
  const steerCenter = useWheelAnimationStore((state) => state.steerCenter);
  const steerRight = useWheelAnimationStore((state) => state.steerRight);

  const headlightMode = useVehicleLightingStore((state) => state.headlightMode);
  const brakeMode = useVehicleLightingStore((state) => state.brakeMode);
  const indicatorMode = useVehicleLightingStore((state) => state.indicatorMode);
  const toggleLowBeam = useVehicleLightingStore((state) => state.toggleLowBeam);
  const toggleHighBeam = useVehicleLightingStore((state) => state.toggleHighBeam);
  const toggleBrakeLights = useVehicleLightingStore((state) => state.toggleBrakeLights);
  const toggleHazard = useVehicleLightingStore((state) => state.toggleHazard);

  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const selectComponent = useSelectionStore((state) => state.selectComponent);
  const toggleBoundingBox = useSelectionStore((state) => state.toggleBoundingBox);
  const toggleWireframe = useSelectionStore((state) => state.toggleWireframe);
  const toggleFocusOnClick = useSelectionStore((state) => state.toggleFocusOnClick);
  const toggleDrawer = useSelectionStore((state) => state.toggleDrawer);
  const setDrawerOpen = useSelectionStore((state) => state.setDrawerOpen);

  // Keyboard shortcut listener: Escape key clears selection and closes drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        clearSelection();
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection, setDrawerOpen]);

  const handleFocusCamera = () => {
    if (selectedComponentId) {
      useCameraStore.getState().focusOn(selectedComponentId);
    }
  };

  const handleSelectFromDrawer = (compId) => {
    selectComponent(compId);
    if (focusOnClick) {
      useCameraStore.getState().focusOn(compId);
    }
    setDrawerOpen(false);
  };

  const hoveredMeta = hoveredComponentId
    ? COMPONENT_TECHNICAL_DATA[hoveredComponentId] || null
    : null;

  return (
    <>
      {/* ─── 1. Hover Tooltip Indicator ─── */}
      {hoveredComponentId && !selectedComponentId && (
        <div style={styles.hoverTooltip}>
          <div style={styles.hoverPulseDot} />
          <span style={styles.hoverCategory}>
            {hoveredMeta?.subtitle || 'COMPONENT'}
          </span>
          <span style={styles.hoverDivider}>&bull;</span>
          <span style={styles.hoverName}>
            {hoveredMeta?.title || hoveredComponentId.toUpperCase()}
          </span>
          <span style={styles.hoverHint}>[Click to Inspect & Frame]</span>
        </div>
      )}

      {/* ─── 2. Bottom-Left Floating Action Pill / Drawer Trigger ─── */}
      <div style={styles.bottomControls}>
        <button
          onClick={toggleDrawer}
          style={{
            ...styles.pillButton,
            backgroundColor: isDrawerOpen ? 'var(--accent-cyan)' : 'rgba(12, 16, 23, 0.88)',
            color: isDrawerOpen ? '#07090D' : '#E2E8F0',
            border: isDrawerOpen ? '1px solid var(--accent-cyan)' : '1px solid rgba(0, 240, 255, 0.35)',
          }}
          title="Browse and select vehicle components"
        >
          <Layers size={14} />
          <span>EXPLORE COMPONENTS</span>
          <span style={styles.pillCount}>17</span>
        </button>

        {selectedComponentId && (
          <button
            onClick={clearSelection}
            style={styles.pillDeselect}
            title="Deselect active component (Esc)"
          >
            <X size={13} />
            <span>DESELECT</span>
          </button>
        )}
      </div>

      {/* ─── 3. Selected Component Technical Inspection HUD Card ─── */}
      {selectedComponent && (
        <div style={styles.hudCard}>
          {/* Header */}
          <div style={styles.hudHeader}>
            <div style={styles.hudTitleGroup}>
              <div style={styles.hudIconBadge}>
                <Crosshair size={16} color="var(--accent-cyan)" />
              </div>
              <div>
                <div style={styles.hudCategoryBadge}>
                  {selectedComponent.category.toUpperCase()} &bull; {selectedComponent.subtitle}
                </div>
                <h3 style={styles.hudTitle}>{selectedComponent.title}</h3>
              </div>
            </div>
            <button
              onClick={clearSelection}
              style={styles.hudCloseBtn}
              title="Close inspection (Esc)"
            >
              <X size={15} />
            </button>
          </div>

          {/* Description */}
          <p style={styles.hudDesc}>{selectedComponent.description}</p>

          {/* 4-Metric Geometric Telemetry Grid */}
          <div style={styles.metricsGrid}>
            <div style={styles.metricCell}>
              <span style={styles.metricLabel}>LENGTH</span>
              <span style={styles.metricValue}>
                {selectedComponent.dimensions?.length?.toFixed(2) ?? '—'} m
              </span>
            </div>
            <div style={styles.metricCell}>
              <span style={styles.metricLabel}>WIDTH</span>
              <span style={styles.metricValue}>
                {selectedComponent.dimensions?.width?.toFixed(2) ?? '—'} m
              </span>
            </div>
            <div style={styles.metricCell}>
              <span style={styles.metricLabel}>HEIGHT</span>
              <span style={styles.metricValue}>
                {selectedComponent.dimensions?.height?.toFixed(2) ?? '—'} m
              </span>
            </div>
            <div style={styles.metricCell}>
              <span style={styles.metricLabel}>TRIANGLES</span>
              <span style={styles.metricValue}>
                {selectedComponent.triangleCount?.toLocaleString() ?? '—'}
              </span>
            </div>
          </div>

          {/* Physical & Kinematic Specifications */}
          <div style={styles.specBox}>
            {selectedComponent.isHinged && (
              <div style={styles.specRow}>
                <RotateCw size={12} color="var(--accent-cyan)" />
                <span style={styles.specKey}>Kinematic Hinge:</span>
                <span style={styles.specVal}>
                  World-Y Axis &bull; Max Opening: {selectedComponent.maxAngleDeg}&deg;
                </span>
              </div>
            )}
            {selectedComponent.steerable && (
              <div style={styles.specRow}>
                <Compass size={12} color="var(--accent-teal)" />
                <span style={styles.specKey}>Steering:</span>
                <span style={styles.specVal}>Articulated Front Wheel &bull; &plusmn;32&deg;</span>
              </div>
            )}
            <div style={styles.specRow}>
              <Zap size={12} color="var(--status-ready)" />
              <span style={styles.specKey}>Material:</span>
              <span style={styles.specVal}>{selectedComponent.materialStatus}</span>
            </div>
          </div>

          {/* Kinematic Closure Mechanism Controls (Part 14) */}
          {isAnimatableClosure(selectedComponentId) && (
            <div style={styles.closureHudBox}>
              <div style={styles.closureHudHeader}>
                <div style={styles.closureHudTitleGroup}>
                  <RotateCw size={12} color="var(--accent-cyan)" />
                  <span style={styles.closureHudLabel}>KINEMATIC MECHANISM</span>
                </div>
                <span
                  style={{
                    ...styles.closureHudBadge,
                    color:
                      (closures[selectedComponentId]?.currentProgress ?? 0) > 0.95
                        ? 'var(--status-ready)'
                        : (closures[selectedComponentId]?.currentProgress ?? 0) > 0.05
                        ? 'var(--accent-cyan)'
                        : 'var(--text-muted)',
                  }}
                >
                  {closures[selectedComponentId]?.state === 'opening'
                    ? `OPENING (${Math.round((closures[selectedComponentId]?.currentProgress ?? 0) * 100)}%)`
                    : closures[selectedComponentId]?.state === 'closing'
                    ? `CLOSING (${Math.round((closures[selectedComponentId]?.currentProgress ?? 0) * 100)}%)`
                    : (closures[selectedComponentId]?.currentProgress ?? 0) > 0.95
                    ? 'FULLY OPEN'
                    : 'CLOSED'}
                </span>
              </div>

              {/* Progress Bar Track */}
              <div style={styles.closureHudTrack}>
                <div
                  style={{
                    ...styles.closureHudProgress,
                    width: `${Math.round((closures[selectedComponentId]?.currentProgress ?? 0) * 100)}%`,
                    backgroundColor:
                      (closures[selectedComponentId]?.currentProgress ?? 0) > 0.95
                        ? 'var(--status-ready)'
                        : 'var(--accent-cyan)',
                  }}
                />
              </div>

              <button
                onClick={() => toggleClosure(selectedComponentId)}
                style={{
                  ...styles.closureHudActionBtn,
                  backgroundColor:
                    (closures[selectedComponentId]?.currentProgress ?? 0) > 0.5
                      ? 'rgba(231, 76, 60, 0.18)'
                      : 'rgba(0, 240, 255, 0.15)',
                  borderColor:
                    (closures[selectedComponentId]?.currentProgress ?? 0) > 0.5
                      ? 'rgba(231, 76, 60, 0.6)'
                      : 'var(--accent-cyan)',
                  color:
                    (closures[selectedComponentId]?.currentProgress ?? 0) > 0.5
                      ? '#FF7B7B'
                      : 'var(--accent-cyan)',
                }}
              >
                {(closures[selectedComponentId]?.currentProgress ?? 0) > 0.5 ? (
                  <>
                    <DoorClosed size={13} />
                    <span>CLOSE {selectedComponent.name.toUpperCase()}</span>
                  </>
                ) : (
                  <>
                    <DoorOpen size={13} />
                    <span>OPEN {selectedComponent.name.toUpperCase()}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Wheel Dynamics & Kinematics Controls (Part 15) */}
          {isWheelComponent(selectedComponentId) && (
            <div style={styles.closureHudBox}>
              <div style={styles.closureHudHeader}>
                <div style={styles.closureHudTitleGroup}>
                  <RotateCw size={12} color="var(--accent-cyan)" />
                  <span style={styles.closureHudLabel}>WHEEL DYNAMICS</span>
                </div>
                <span
                  style={{
                    ...styles.closureHudBadge,
                    color: isSpinning ? 'var(--status-ready)' : 'var(--text-muted)',
                  }}
                >
                  {isSpinning ? `SPINNING (${calculateRpm(spinSpeed)} RPM)` : 'STATIONARY'}
                </span>
              </div>

              {/* Spin toggle button */}
              <button
                onClick={toggleSpin}
                style={{
                  ...styles.closureHudActionBtn,
                  backgroundColor: isSpinning ? 'rgba(231, 76, 60, 0.18)' : 'rgba(0, 240, 255, 0.15)',
                  borderColor: isSpinning ? 'rgba(231, 76, 60, 0.6)' : 'var(--accent-cyan)',
                  color: isSpinning ? '#FF7B7B' : 'var(--accent-cyan)',
                  marginBottom: getWheelConfig(selectedComponentId)?.steerable ? '8px' : '0',
                }}
              >
                <RotateCw size={13} />
                <span>{isSpinning ? 'STOP WHEEL ROLL' : 'START WHEEL ROLL'}</span>
              </button>

              {/* Front Steering Controls if steerable */}
              {getWheelConfig(selectedComponentId)?.steerable && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'monospace' }}>
                    <span style={{ color: 'var(--text-muted)' }}>STEERING YAW:</span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>
                      {radToDeg(currentSteeringAngle) > 0.5
                        ? `+${radToDeg(currentSteeringAngle).toFixed(1)}° (LEFT)`
                        : radToDeg(currentSteeringAngle) < -0.5
                        ? `${radToDeg(currentSteeringAngle).toFixed(1)}° (RIGHT)`
                        : '0.0° (CENTER)'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                    <button
                      onClick={steerLeft}
                      style={{
                        padding: '4px 2px',
                        fontSize: '8px',
                        fontWeight: '700',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: '#FFF',
                        cursor: 'pointer',
                      }}
                    >
                      LEFT (+30°)
                    </button>
                    <button
                      onClick={steerCenter}
                      style={{
                        padding: '4px 2px',
                        fontSize: '8px',
                        fontWeight: '700',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: '#FFF',
                        cursor: 'pointer',
                      }}
                    >
                      CENTER (0°)
                    </button>
                    <button
                      onClick={steerRight}
                      style={{
                        padding: '4px 2px',
                        fontSize: '8px',
                        fontWeight: '700',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: '#FFF',
                        cursor: 'pointer',
                      }}
                    >
                      RIGHT (-30°)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dynamic Exterior Lighting Controls (Part 16) */}
          {(selectedComponentId === 'headlights' || selectedComponentId === 'taillights') && (
            <div style={styles.closureHudBox}>
              <div style={styles.closureHudHeader}>
                <div style={styles.closureHudTitleGroup}>
                  <Lightbulb size={12} color="var(--accent-cyan)" />
                  <span style={styles.closureHudLabel}>
                    {selectedComponentId === 'headlights' ? 'HEADLAMP CONTROLS' : 'TAILLAMP & BRAKE CONTROLS'}
                  </span>
                </div>
                <span
                  style={{
                    ...styles.closureHudBadge,
                    color:
                      selectedComponentId === 'headlights' && headlightMode !== HEADLIGHT_MODES.OFF
                        ? 'var(--status-ready)'
                        : selectedComponentId === 'taillights' && brakeMode === BRAKE_MODES.ACTIVE
                        ? '#FF4D4D'
                        : 'var(--text-muted)',
                  }}
                >
                  {selectedComponentId === 'headlights'
                    ? headlightMode.toUpperCase()
                    : brakeMode === BRAKE_MODES.ACTIVE
                    ? 'BRAKE ACTIVE'
                    : 'RUNNING / OFF'}
                </span>
              </div>

              {selectedComponentId === 'headlights' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    onClick={toggleLowBeam}
                    style={{
                      ...styles.closureHudActionBtn,
                      backgroundColor:
                        headlightMode === HEADLIGHT_MODES.LOW_BEAM
                          ? 'rgba(0, 240, 255, 0.2)'
                          : 'rgba(255, 255, 255, 0.05)',
                      borderColor:
                        headlightMode === HEADLIGHT_MODES.LOW_BEAM
                          ? 'var(--accent-cyan)'
                          : 'var(--border-subtle)',
                      color:
                        headlightMode === HEADLIGHT_MODES.LOW_BEAM
                          ? 'var(--accent-cyan)'
                          : '#FFFFFF',
                    }}
                  >
                    <span>LOW BEAM</span>
                  </button>
                  <button
                    onClick={toggleHighBeam}
                    style={{
                      ...styles.closureHudActionBtn,
                      backgroundColor:
                        headlightMode === HEADLIGHT_MODES.HIGH_BEAM
                          ? 'rgba(0, 240, 255, 0.2)'
                          : 'rgba(255, 255, 255, 0.05)',
                      borderColor:
                        headlightMode === HEADLIGHT_MODES.HIGH_BEAM
                          ? 'var(--accent-cyan)'
                          : 'var(--border-subtle)',
                      color:
                        headlightMode === HEADLIGHT_MODES.HIGH_BEAM
                          ? 'var(--accent-cyan)'
                          : '#FFFFFF',
                    }}
                  >
                    <span>HIGH BEAM</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    onClick={toggleBrakeLights}
                    style={{
                      ...styles.closureHudActionBtn,
                      backgroundColor:
                        brakeMode === BRAKE_MODES.ACTIVE
                          ? 'rgba(255, 30, 0, 0.3)'
                          : 'rgba(255, 255, 255, 0.05)',
                      borderColor:
                        brakeMode === BRAKE_MODES.ACTIVE
                          ? '#FF2000'
                          : 'var(--border-subtle)',
                      color:
                        brakeMode === BRAKE_MODES.ACTIVE
                          ? '#FF4D4D'
                          : '#FFFFFF',
                    }}
                  >
                    <span>{brakeMode === BRAKE_MODES.ACTIVE ? 'RELEASE BRAKE' : 'PRESS BRAKE'}</span>
                  </button>
                  <button
                    onClick={toggleHazard}
                    style={{
                      ...styles.closureHudActionBtn,
                      backgroundColor:
                        indicatorMode === INDICATOR_MODES.HAZARD
                          ? 'rgba(255, 160, 0, 0.25)'
                          : 'rgba(255, 255, 255, 0.05)',
                      borderColor:
                        indicatorMode === INDICATOR_MODES.HAZARD
                          ? '#FFA000'
                          : 'var(--border-subtle)',
                      color:
                        indicatorMode === INDICATOR_MODES.HAZARD
                          ? '#FFA000'
                          : '#FFFFFF',
                    }}
                  >
                    <span>HAZARDS</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Toolbar */}
          <div style={styles.actionToolbar}>
            <button
              onClick={handleFocusCamera}
              style={styles.actionBtnPrimary}
              title="Smoothly frame camera onto this component"
            >
              <Maximize2 size={13} />
              <span>FOCUS CAMERA</span>
            </button>

            <button
              onClick={toggleWireframe}
              style={{
                ...styles.actionBtnToggle,
                borderColor: showWireframe ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.15)',
                color: showWireframe ? 'var(--accent-cyan)' : 'var(--text-muted)',
              }}
              title="Toggle 3D wireframe highlight overlay"
            >
              <Box size={13} />
              <span>WIREFRAME</span>
              {showWireframe && <Check size={11} />}
            </button>

            <button
              onClick={toggleBoundingBox}
              style={{
                ...styles.actionBtnToggle,
                borderColor: showBoundingBox ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.15)',
                color: showBoundingBox ? 'var(--accent-cyan)' : 'var(--text-muted)',
              }}
              title="Toggle 3D bounding brackets"
            >
              <Crosshair size={13} />
              <span>BOUNDS</span>
              {showBoundingBox && <Check size={11} />}
            </button>
          </div>
        </div>
      )}

      {/* ─── 4. Categorized Component Explorer Drawer ─── */}
      {isDrawerOpen && (
        <div style={styles.drawerOverlay}>
          <div style={styles.drawer}>
            <div style={styles.drawerHeader}>
              <div style={styles.drawerTitleGroup}>
                <Layers size={17} color="var(--accent-cyan)" />
                <h3 style={styles.drawerTitle}>VEHICLE COMPONENT EXPLORER</h3>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={styles.drawerCloseBtn}
                title="Close drawer"
              >
                <X size={15} />
              </button>
            </div>

            <div style={styles.drawerSettingsRow}>
              <label style={styles.drawerSettingLabel}>
                <input
                  type="checkbox"
                  checked={focusOnClick}
                  onChange={toggleFocusOnClick}
                  style={styles.checkbox}
                />
                <span>Auto-Focus Camera on Component Selection</span>
              </label>
            </div>

            <div style={styles.drawerContent}>
              {Object.entries(COMPONENT_CATEGORIES).map(([catName, compIds]) => (
                <div key={catName} style={styles.catGroup}>
                  <div style={styles.catHeading}>{catName.toUpperCase()}</div>
                  <div style={styles.catList}>
                    {compIds.map((compId) => {
                      const comp = Object.values(SEMANTIC_COMPONENTS).find(
                        (c) => c.id === compId
                      );
                      const isSelected = selectedComponentId === compId;
                      const tech = COMPONENT_TECHNICAL_DATA[compId];

                      return (
                        <button
                          key={compId}
                          onClick={() => handleSelectFromDrawer(compId)}
                          style={{
                            ...styles.drawerCompItem,
                            backgroundColor: isSelected
                              ? 'rgba(0, 240, 255, 0.12)'
                              : 'rgba(20, 27, 38, 0.65)',
                            borderColor: isSelected
                              ? 'var(--accent-cyan)'
                              : 'rgba(44, 54, 69, 0.6)',
                          }}
                        >
                          <div style={styles.drawerCompLeft}>
                            <span
                              style={{
                                ...styles.compIndicator,
                                backgroundColor: isSelected
                                  ? 'var(--accent-cyan)'
                                  : 'rgba(255, 255, 255, 0.2)',
                              }}
                            />
                            <div>
                              <div style={styles.drawerCompName}>
                                {comp?.name || compId}
                              </div>
                              <div style={styles.drawerCompSub}>
                                {tech?.subtitle || comp?.category}
                              </div>
                            </div>
                          </div>
                          <ChevronRight
                            size={14}
                            color={isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)'}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  hoverTooltip: {
    position: 'absolute',
    bottom: '4.8rem',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    backgroundColor: 'rgba(10, 14, 20, 0.92)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(0, 240, 255, 0.35)',
    borderRadius: '20px',
    padding: '0.4rem 0.85rem',
    color: '#FFFFFF',
    fontSize: '0.74rem',
    fontFamily: 'var(--font-mono)',
    zIndex: 15,
    pointerEvents: 'none',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  },
  hoverPulseDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-cyan)',
    boxShadow: '0 0 8px var(--accent-cyan)',
  },
  hoverCategory: {
    color: 'var(--accent-teal)',
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  hoverDivider: {
    color: 'var(--text-muted)',
  },
  hoverName: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hoverHint: {
    color: 'var(--text-muted)',
    fontSize: '0.66rem',
    marginLeft: '0.2rem',
  },
  bottomControls: {
    position: 'absolute',
    bottom: '4.4rem',
    left: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    zIndex: 12,
  },
  pillButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.45rem 0.85rem',
    borderRadius: '6px',
    border: '1px solid rgba(0, 240, 255, 0.35)',
    fontSize: '0.72rem',
    fontWeight: '600',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.5px',
    cursor: 'pointer',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.15s ease',
  },
  pillCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    padding: '0.1rem 0.35rem',
    borderRadius: '3px',
    fontSize: '0.66rem',
  },
  pillDeselect: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.45rem 0.65rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    border: '1px solid rgba(231, 76, 60, 0.4)',
    color: '#FF6B6B',
    fontSize: '0.7rem',
    fontWeight: '600',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    backdropFilter: 'blur(10px)',
  },
  hudCard: {
    position: 'absolute',
    bottom: '4.4rem',
    left: '1.25rem',
    width: '380px',
    backgroundColor: 'rgba(11, 15, 22, 0.94)',
    backdropFilter: 'blur(18px)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    borderRadius: '10px',
    padding: '1.1rem',
    color: '#FFFFFF',
    zIndex: 14,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65), 0 0 16px rgba(0, 240, 255, 0.1)',
  },
  hudHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.65rem',
  },
  hudTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  hudIconBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    border: '1px solid rgba(0, 240, 255, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudCategoryBadge: {
    fontSize: '0.64rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-teal)',
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
  },
  hudTitle: {
    margin: 0,
    fontSize: '0.92rem',
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: '0.3px',
  },
  hudCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.2rem',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudDesc: {
    fontSize: '0.74rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: '0 0 0.85rem 0',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.45rem',
    marginBottom: '0.75rem',
  },
  metricCell: {
    backgroundColor: 'rgba(20, 27, 38, 0.75)',
    border: '1px solid rgba(44, 54, 69, 0.6)',
    borderRadius: '5px',
    padding: '0.4rem 0.45rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: '0.58rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.4px',
  },
  metricValue: {
    fontSize: '0.72rem',
    fontWeight: '600',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-cyan)',
    marginTop: '0.15rem',
  },
  specBox: {
    backgroundColor: 'rgba(16, 22, 32, 0.85)',
    border: '1px solid rgba(44, 54, 69, 0.6)',
    borderRadius: '6px',
    padding: '0.55rem 0.7rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    marginBottom: '0.85rem',
  },
  specRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.7rem',
  },
  specKey: {
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.66rem',
  },
  specVal: {
    color: '#E2E8F0',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.68rem',
  },
  actionToolbar: {
    display: 'flex',
    gap: '0.45rem',
  },
  actionBtnPrimary: {
    flex: 1.4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--accent-cyan)',
    color: '#07090D',
    border: 'none',
    borderRadius: '6px',
    padding: '0.45rem 0.6rem',
    fontSize: '0.7rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.4px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  actionBtnToggle: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.3rem',
    backgroundColor: 'rgba(20, 27, 38, 0.85)',
    border: '1px solid',
    borderRadius: '6px',
    padding: '0.45rem 0.5rem',
    fontSize: '0.66rem',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(7, 9, 13, 0.65)',
    backdropFilter: 'blur(4px)',
    zIndex: 25,
    display: 'flex',
    justifyContent: 'flex-start',
  },
  drawer: {
    width: '360px',
    height: '100%',
    backgroundColor: 'rgba(11, 15, 22, 0.96)',
    borderRight: '1px solid rgba(0, 240, 255, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '10px 0 30px rgba(0, 0, 0, 0.7)',
  },
  drawerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.1rem 1.25rem',
    borderBottom: '1px solid rgba(44, 54, 69, 0.6)',
  },
  drawerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
  },
  drawerTitle: {
    margin: 0,
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.5px',
  },
  drawerCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
  },
  drawerSettingsRow: {
    padding: '0.65rem 1.25rem',
    backgroundColor: 'rgba(16, 22, 32, 0.6)',
    borderBottom: '1px solid rgba(44, 54, 69, 0.4)',
  },
  drawerSettingLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  checkbox: {
    accentColor: 'var(--accent-cyan)',
    cursor: 'pointer',
  },
  drawerContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  catGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  catHeading: {
    fontSize: '0.64rem',
    fontWeight: '700',
    color: 'var(--accent-teal)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.6px',
    marginBottom: '0.2rem',
  },
  catList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  drawerCompItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.55rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  drawerCompLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  compIndicator: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  drawerCompName: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  drawerCompSub: {
    fontSize: '0.66rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  closureHudBox: {
    backgroundColor: 'rgba(16, 22, 32, 0.9)',
    border: '1px solid rgba(0, 240, 255, 0.35)',
    borderRadius: '6px',
    padding: '0.6rem 0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    marginBottom: '0.75rem',
  },
  closureHudHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closureHudTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  closureHudLabel: {
    fontSize: '0.62rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    letterSpacing: '0.4px',
  },
  closureHudBadge: {
    fontSize: '0.64rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: '600',
  },
  closureHudTrack: {
    width: '100%',
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  closureHudProgress: {
    height: '100%',
    transition: 'width 0.05s linear',
  },
  closureHudActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    border: '1px solid',
    borderRadius: '5px',
    padding: '0.45rem',
    fontSize: '0.72rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.4px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
