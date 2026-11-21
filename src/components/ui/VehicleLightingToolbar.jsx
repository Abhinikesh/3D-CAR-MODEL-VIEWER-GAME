import React, { useState } from 'react';
import {
  Lightbulb,
  Sun,
  Zap,
  ChevronDown,
  RotateCcw,
  Compass,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useVehicleLightingStore } from '../../store/vehicleLightingStore.js';
import {
  HEADLIGHT_MODES,
  TAILLIGHT_MODES,
  BRAKE_MODES,
  INDICATOR_MODES,
} from '../../utils/vehicleLightingRegistry.js';
import { useCameraStore } from '../../store/cameraStore.js';

export function VehicleLightingToolbar() {
  const [isOpen, setIsOpen] = useState(false);

  const headlightMode = useVehicleLightingStore((state) => state.headlightMode);
  const taillightMode = useVehicleLightingStore((state) => state.taillightMode);
  const brakeMode = useVehicleLightingStore((state) => state.brakeMode);
  const indicatorMode = useVehicleLightingStore((state) => state.indicatorMode);
  const blinkPhase = useVehicleLightingStore((state) => state.blinkPhase);
  const realLightsEnabled = useVehicleLightingStore((state) => state.realLightsEnabled);

  const setHeadlightMode = useVehicleLightingStore((state) => state.setHeadlightMode);
  const toggleBrakeLights = useVehicleLightingStore((state) => state.toggleBrakeLights);
  const pressBrake = useVehicleLightingStore((state) => state.pressBrake);
  const releaseBrake = useVehicleLightingStore((state) => state.releaseBrake);
  const toggleLeftIndicator = useVehicleLightingStore((state) => state.toggleLeftIndicator);
  const toggleRightIndicator = useVehicleLightingStore((state) => state.toggleRightIndicator);
  const toggleHazard = useVehicleLightingStore((state) => state.toggleHazard);
  const allLightsOff = useVehicleLightingStore((state) => state.allLightsOff);
  const setRealLightsEnabled = useVehicleLightingStore((state) => state.setRealLightsEnabled);

  // Compute status summary for trigger button
  let statusSummary = 'ALL OFF';
  const isAnyOn =
    headlightMode !== HEADLIGHT_MODES.OFF ||
    taillightMode !== TAILLIGHT_MODES.OFF ||
    brakeMode !== BRAKE_MODES.OFF ||
    indicatorMode !== INDICATOR_MODES.OFF;

  if (indicatorMode === INDICATOR_MODES.HAZARD) {
    statusSummary = 'HAZARDS ACTIVE';
  } else if (indicatorMode !== INDICATOR_MODES.OFF) {
    statusSummary = `${indicatorMode.toUpperCase()} SIGNAL`;
  } else if (brakeMode === BRAKE_MODES.ACTIVE) {
    statusSummary = 'BRAKES ACTIVE';
  } else if (headlightMode === HEADLIGHT_MODES.HIGH_BEAM) {
    statusSummary = 'HIGH BEAM ON';
  } else if (headlightMode === HEADLIGHT_MODES.LOW_BEAM) {
    statusSummary = 'LOW BEAM ON';
  } else if (headlightMode === HEADLIGHT_MODES.PARKING) {
    statusSummary = 'PARKING / DRL';
  }

  const handleFocus = (targetKey) => {
    useCameraStore.getState().focusOn(targetKey);
  };

  return (
    <div style={styles.container}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.triggerBtn,
          borderColor: isAnyOn ? 'var(--accent-cyan)' : 'var(--border-subtle)',
        }}
        title="Dynamic Automotive Lighting Controls (Headlights, Brakes, Indicators, Hazards)"
      >
        <div style={styles.triggerLeft}>
          <div
            style={{
              ...styles.iconBadge,
              backgroundColor: isAnyOn ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            }}
          >
            <Lightbulb
              size={16}
              color={
                indicatorMode !== INDICATOR_MODES.OFF
                  ? '#FFA000'
                  : brakeMode === BRAKE_MODES.ACTIVE
                  ? '#FF3B30'
                  : isAnyOn
                  ? 'var(--accent-cyan)'
                  : '#A0AEC0'
              }
            />
          </div>
          <div style={styles.triggerTextGroup}>
            <span style={styles.triggerLabel}>VEHICLE LIGHTING</span>
            <span style={styles.triggerValue}>{statusSummary}</span>
          </div>
        </div>
        <ChevronDown
          size={14}
          color="var(--text-muted)"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div style={styles.popover}>
          {/* Header */}
          <div style={styles.popoverHeader}>
            <div style={styles.headerTitleGroup}>
              <Sun size={14} color="var(--accent-cyan)" />
              <span style={styles.headerTitle}>DYNAMIC VEHICLE LIGHTING</span>
            </div>
            {isAnyOn && (
              <span style={styles.activeBadge}>
                <span style={styles.activeDot} /> ACTIVE
              </span>
            )}
          </div>

          {/* ─── SECTION 1: Headlamps & DRL ─── */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionTitle}>HEADLAMPS &amp; FRONT DRL</span>
              <span style={styles.sectionBadge}>{headlightMode.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div style={styles.buttonRow4}>
              {[
                { id: HEADLIGHT_MODES.OFF, label: 'OFF' },
                { id: HEADLIGHT_MODES.PARKING, label: 'DRL / PARK' },
                { id: HEADLIGHT_MODES.LOW_BEAM, label: 'LOW BEAM' },
                { id: HEADLIGHT_MODES.HIGH_BEAM, label: 'HIGH BEAM' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setHeadlightMode(m.id)}
                  style={{
                    ...styles.modeBtn,
                    borderColor: headlightMode === m.id ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                    backgroundColor:
                      headlightMode === m.id ? 'rgba(0, 240, 255, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                    color: headlightMode === m.id ? 'var(--accent-cyan)' : '#FFFFFF',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── SECTION 2: Taillights & Brake Stop Lights ─── */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionTitle}>TAILLIGHTS &amp; BRAKE SYSTEM</span>
              <span style={styles.sectionBadge}>
                {brakeMode === BRAKE_MODES.ACTIVE
                  ? 'BRAKE WARNING'
                  : taillightMode === TAILLIGHT_MODES.RUNNING
                  ? 'RUNNING'
                  : 'OFF'}
              </span>
            </div>
            <div style={styles.brakeRow}>
              <button
                onClick={toggleBrakeLights}
                onMouseDown={pressBrake}
                onMouseUp={releaseBrake}
                style={{
                  ...styles.brakeBtn,
                  backgroundColor:
                    brakeMode === BRAKE_MODES.ACTIVE ? 'rgba(255, 30, 0, 0.35)' : 'rgba(255, 255, 255, 0.04)',
                  borderColor: brakeMode === BRAKE_MODES.ACTIVE ? '#FF2000' : 'var(--border-subtle)',
                  color: brakeMode === BRAKE_MODES.ACTIVE ? '#FF4D4D' : '#FFFFFF',
                }}
              >
                <ShieldAlert size={14} />
                <span>{brakeMode === BRAKE_MODES.ACTIVE ? 'BRAKE ENGAGED (HOLD / TAP)' : 'PRESS / TAP BRAKE'}</span>
              </button>
            </div>
          </div>

          {/* ─── SECTION 3: Turn Signals & Hazard Warning ─── */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionTitle}>TURN SIGNALS &amp; HAZARD WARNING</span>
              <span
                style={{
                  ...styles.sectionBadge,
                  color: indicatorMode !== INDICATOR_MODES.OFF && blinkPhase ? '#FFA000' : 'var(--text-muted)',
                }}
              >
                {indicatorMode === INDICATOR_MODES.HAZARD
                  ? 'HAZARD (1.5 Hz)'
                  : indicatorMode !== INDICATOR_MODES.OFF
                  ? `${indicatorMode.toUpperCase()} (1.5 Hz)`
                  : 'OFF'}
              </span>
            </div>
            <div style={styles.buttonRow3}>
              <button
                onClick={toggleLeftIndicator}
                style={{
                  ...styles.indicatorBtn,
                  borderColor:
                    indicatorMode === INDICATOR_MODES.LEFT && blinkPhase
                      ? '#FFA000'
                      : 'var(--border-subtle)',
                  backgroundColor:
                    indicatorMode === INDICATOR_MODES.LEFT && blinkPhase
                      ? 'rgba(255, 160, 0, 0.25)'
                      : 'rgba(255, 255, 255, 0.03)',
                  color: indicatorMode === INDICATOR_MODES.LEFT ? '#FFA000' : '#FFFFFF',
                }}
              >
                <ArrowLeft size={13} />
                <span>LEFT</span>
              </button>

              <button
                onClick={toggleHazard}
                style={{
                  ...styles.hazardBtn,
                  borderColor:
                    indicatorMode === INDICATOR_MODES.HAZARD && blinkPhase
                      ? '#FF3B30'
                      : 'rgba(255, 59, 48, 0.4)',
                  backgroundColor:
                    indicatorMode === INDICATOR_MODES.HAZARD && blinkPhase
                      ? 'rgba(255, 59, 48, 0.35)'
                      : 'rgba(255, 59, 48, 0.1)',
                  color: '#FF6B6B',
                }}
              >
                <AlertTriangle size={13} />
                <span>HAZARD</span>
              </button>

              <button
                onClick={toggleRightIndicator}
                style={{
                  ...styles.indicatorBtn,
                  borderColor:
                    indicatorMode === INDICATOR_MODES.RIGHT && blinkPhase
                      ? '#FFA000'
                      : 'var(--border-subtle)',
                  backgroundColor:
                    indicatorMode === INDICATOR_MODES.RIGHT && blinkPhase
                      ? 'rgba(255, 160, 0, 0.25)'
                      : 'rgba(255, 255, 255, 0.03)',
                  color: indicatorMode === INDICATOR_MODES.RIGHT ? '#FFA000' : '#FFFFFF',
                }}
              >
                <span>RIGHT</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* ─── SECTION 4: System Telemetry & Actions ─── */}
          <div style={styles.footerSection}>
            <div style={styles.telemetryCard}>
              <div style={styles.telemetryRow}>
                <span style={styles.telemetryKey}>Headlamp Throw:</span>
                <span style={styles.telemetryVal}>
                  {headlightMode === HEADLIGHT_MODES.HIGH_BEAM
                    ? '38.0m (High Beam)'
                    : headlightMode === HEADLIGHT_MODES.LOW_BEAM
                    ? '20.0m (Low Beam)'
                    : 'OFF'}
                </span>
              </div>
              <div style={styles.telemetryRow}>
                <span style={styles.telemetryKey}>Rear Dual-Stage:</span>
                <span style={styles.telemetryVal}>
                  {brakeMode === BRAKE_MODES.ACTIVE
                    ? 'Brake (10.0 intensity)'
                    : taillightMode === TAILLIGHT_MODES.RUNNING
                    ? 'Running (2.5 intensity)'
                    : 'OFF'}
                </span>
              </div>
              <div style={styles.telemetryRow}>
                <span style={styles.telemetryKey}>Blinker Frequency:</span>
                <span style={styles.telemetryVal}>1.5 Hz (ECE R48 Standard)</span>
              </div>
            </div>

            <div style={styles.footerActionRow}>
              <button
                onClick={allLightsOff}
                style={styles.resetBtn}
                title="Immediately extinguish all vehicle lights"
              >
                <RotateCcw size={12} />
                <span>ALL LIGHTS OFF</span>
              </button>

              <button
                onClick={() => handleFocus(headlightMode !== HEADLIGHT_MODES.OFF ? 'headlights' : 'taillights')}
                style={styles.focusBtn}
                title="Focus camera on front or rear lighting array"
              >
                <Compass size={12} />
                <span>FOCUS LIGHTS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
  },
  triggerBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '240px',
    padding: '8px 12px',
    backgroundColor: 'rgba(10, 14, 20, 0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  triggerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  iconBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  triggerTextGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  triggerLabel: {
    fontSize: '9px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
  },
  triggerValue: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '320px',
    backgroundColor: 'rgba(10, 14, 20, 0.95)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    borderRadius: '10px',
    padding: '14px',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  popoverHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  headerTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: '0.06em',
  },
  activeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '9px',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.05em',
  },
  activeDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-cyan)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  sectionBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--accent-cyan)',
    fontFamily: 'monospace',
  },
  buttonRow4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
  },
  buttonRow3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr 1fr',
    gap: '4px',
  },
  modeBtn: {
    padding: '6px 2px',
    border: '1px solid',
    borderRadius: '5px',
    fontSize: '9px',
    fontWeight: '700',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
  },
  brakeRow: {
    display: 'flex',
    flexDirection: 'column',
  },
  brakeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 12px',
    border: '1px solid',
    borderRadius: '6px',
    fontSize: '10px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  indicatorBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '6px 4px',
    border: '1px solid',
    borderRadius: '5px',
    fontSize: '9px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  hazardBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '6px 4px',
    border: '1px solid',
    borderRadius: '5px',
    fontSize: '9px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  footerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    paddingTop: '8px',
  },
  telemetryCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    padding: '6px 8px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '5px',
    fontSize: '9px',
    fontFamily: 'monospace',
  },
  telemetryRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  telemetryKey: {
    color: 'var(--text-muted)',
  },
  telemetryVal: {
    color: 'var(--accent-cyan)',
    fontWeight: '600',
  },
  footerActionRow: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr',
    gap: '6px',
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '6px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '5px',
    color: '#A0AEC0',
    fontSize: '9px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  focusBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '6px 8px',
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    borderRadius: '5px',
    color: 'var(--accent-cyan)',
    fontSize: '9px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
