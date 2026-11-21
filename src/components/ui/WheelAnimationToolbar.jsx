import React, { useState } from 'react';
import {
  RotateCw,
  Play,
  Square,
  ArrowLeftRight,
  ChevronDown,
  RotateCcw,
  Compass,
  Gauge,
  Sliders,
  Check,
  Zap,
} from 'lucide-react';
import { useWheelAnimationStore } from '../../store/wheelAnimationStore.js';
import {
  SPIN_MODES,
  WHEEL_IDS,
  WHEEL_ANIMATION_CONFIG,
  radToDeg,
  calculateSpeedKmh,
  calculateRpm,
} from '../../utils/wheelAnimationRegistry.js';
import { useCameraStore } from '../../store/cameraStore.js';

export function WheelAnimationToolbar() {
  const [isOpen, setIsOpen] = useState(false);

  const isSpinning = useWheelAnimationStore((state) => state.isSpinning);
  const spinDirection = useWheelAnimationStore((state) => state.spinDirection);
  const spinSpeed = useWheelAnimationStore((state) => state.spinSpeed);
  const spinMode = useWheelAnimationStore((state) => state.spinMode);
  const activeIndividualWheel = useWheelAnimationStore((state) => state.activeIndividualWheel);
  const currentSteeringAngle = useWheelAnimationStore((state) => state.currentSteeringAngle);
  const targetSteeringAngle = useWheelAnimationStore((state) => state.targetSteeringAngle);
  const isSteering = useWheelAnimationStore((state) => state.isSteering);

  const toggleSpin = useWheelAnimationStore((state) => state.toggleSpin);
  const reverseSpin = useWheelAnimationStore((state) => state.reverseSpin);
  const setSpinSpeed = useWheelAnimationStore((state) => state.setSpinSpeed);
  const setSpinMode = useWheelAnimationStore((state) => state.setSpinMode);
  const setActiveIndividualWheel = useWheelAnimationStore((state) => state.setActiveIndividualWheel);
  const steerLeft = useWheelAnimationStore((state) => state.steerLeft);
  const steerCenter = useWheelAnimationStore((state) => state.steerCenter);
  const steerRight = useWheelAnimationStore((state) => state.steerRight);
  const setTargetSteeringAngleDeg = useWheelAnimationStore((state) => state.setTargetSteeringAngleDeg);
  const resetTransforms = useWheelAnimationStore((state) => state.resetTransforms);

  const steerDeg = Math.round(radToDeg(currentSteeringAngle) * 10) / 10;
  const targetSteerDeg = Math.round(radToDeg(targetSteeringAngle) * 10) / 10;
  const rpm = calculateRpm(spinSpeed);
  const kmh = calculateSpeedKmh(spinSpeed).toFixed(1);

  const handleFocusWheel = (wheelId) => {
    useCameraStore.getState().focusOn(wheelId);
  };

  return (
    <div style={styles.container}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.triggerBtn,
          borderColor: isSpinning || Math.abs(steerDeg) > 1 ? 'var(--accent-cyan)' : 'var(--border-subtle)',
        }}
        title="Automotive Wheel Dynamics, Spin & Steering Controls"
      >
        <div style={styles.triggerLeft}>
          <div
            style={{
              ...styles.iconBadge,
              backgroundColor: isSpinning ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            }}
          >
            <RotateCw
              size={16}
              color={isSpinning ? 'var(--accent-cyan)' : '#A0AEC0'}
              style={{
                animation: isSpinning ? 'spin 2s linear infinite' : 'none',
              }}
            />
          </div>
          <div style={styles.triggerTextGroup}>
            <span style={styles.triggerLabel}>WHEEL DYNAMICS</span>
            <span style={styles.triggerValue}>
              {isSpinning
                ? `SPINNING (${rpm} RPM)`
                : Math.abs(steerDeg) > 0.5
                ? `STEER: ${steerDeg > 0 ? `+${steerDeg}°` : `${steerDeg}°`}`
                : 'STATIONARY'}
            </span>
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
          {/* Popover Header */}
          <div style={styles.popoverHeader}>
            <div style={styles.headerTitleGroup}>
              <Gauge size={14} color="var(--accent-cyan)" />
              <span style={styles.headerTitle}>WHEEL DYNAMICS &amp; STEERING</span>
            </div>
            {(isSpinning || isSteering) && (
              <span style={styles.animBadge}>
                <span style={styles.animDot} /> ACTIVE
              </span>
            )}
          </div>

          {/* ─── SECTION 1: Front-Wheel Steering Articulation ─── */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionTitle}>FRONT STEERING ARTICULATION</span>
              <span style={styles.sectionBadge}>
                {steerDeg > 0.5
                  ? `+${steerDeg.toFixed(1)}° LEFT`
                  : steerDeg < -0.5
                  ? `${steerDeg.toFixed(1)}° RIGHT`
                  : '0.0° CENTER'}
              </span>
            </div>

            {/* Visual Steering Gauge */}
            <div style={styles.steerGaugeTrack}>
              <div style={styles.steerGaugeCenterTick} />
              <div
                style={{
                  ...styles.steerGaugeIndicator,
                  left: `${((steerDeg + 30) / 60) * 100}%`,
                }}
              />
            </div>

            {/* Quick Steering Preset Buttons */}
            <div style={styles.steerPresetRow}>
              <button
                onClick={steerLeft}
                style={{
                  ...styles.presetBtn,
                  borderColor: targetSteerDeg >= 29 ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  backgroundColor:
                    targetSteerDeg >= 29 ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                }}
              >
                LEFT (+30°)
              </button>
              <button
                onClick={steerCenter}
                style={{
                  ...styles.presetBtn,
                  borderColor: Math.abs(targetSteerDeg) < 1 ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  backgroundColor:
                    Math.abs(targetSteerDeg) < 1 ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                }}
              >
                CENTER (0°)
              </button>
              <button
                onClick={steerRight}
                style={{
                  ...styles.presetBtn,
                  borderColor: targetSteerDeg <= -29 ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  backgroundColor:
                    targetSteerDeg <= -29 ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                }}
              >
                RIGHT (-30°)
              </button>
            </div>

            {/* Continuous Steering Slider */}
            <div style={styles.sliderRow}>
              <input
                type="range"
                min="-30"
                max="30"
                step="1"
                value={targetSteerDeg}
                onChange={(e) => setTargetSteeringAngleDeg(Number(e.target.value))}
                style={styles.rangeSlider}
              />
              <div style={styles.sliderLabels}>
                <span>-30° (R)</span>
                <span>0°</span>
                <span>+30° (L)</span>
              </div>
            </div>
          </div>

          {/* ─── SECTION 2: Axial Wheel Roll (Spinning) ─── */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionTitle}>AXIAL WHEEL ROLL (STATIONARY CAR)</span>
              <span style={styles.sectionBadge}>
                {isSpinning ? `${spinDirection > 0 ? 'FWD' : 'REV'} • ${kmh} KM/H` : 'STOPPED'}
              </span>
            </div>

            {/* Master Toggle & Direction Controls */}
            <div style={styles.spinControlsRow}>
              <button
                onClick={toggleSpin}
                style={{
                  ...styles.mainActionBtn,
                  backgroundColor: isSpinning ? 'rgba(231, 76, 60, 0.2)' : 'rgba(0, 240, 255, 0.18)',
                  borderColor: isSpinning ? '#E74C3C' : 'var(--accent-cyan)',
                  color: isSpinning ? '#FF7675' : 'var(--accent-cyan)',
                }}
              >
                {isSpinning ? (
                  <>
                    <Square size={13} />
                    <span>STOP ROLL</span>
                  </>
                ) : (
                  <>
                    <Play size={13} />
                    <span>START ROLL</span>
                  </>
                )}
              </button>

              <button
                onClick={reverseSpin}
                style={styles.secondaryActionBtn}
                title="Toggle Forward / Reverse Roll"
              >
                <ArrowLeftRight size={13} />
                <span>{spinDirection > 0 ? 'FORWARD' : 'REVERSE'}</span>
              </button>
            </div>

            {/* Spin Mode Tabs: All, Front, Rear, Individual */}
            <div style={styles.modeTabsRow}>
              {[
                { id: SPIN_MODES.ALL, label: 'ALL 4' },
                { id: SPIN_MODES.FRONT, label: 'FRONT' },
                { id: SPIN_MODES.REAR, label: 'REAR' },
                { id: SPIN_MODES.INDIVIDUAL, label: 'SINGLE' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSpinMode(m.id)}
                  style={{
                    ...styles.modeTabBtn,
                    borderColor: spinMode === m.id ? 'var(--accent-cyan)' : 'transparent',
                    backgroundColor:
                      spinMode === m.id ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    color: spinMode === m.id ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* If Single mode, pick which wheel */}
            {spinMode === SPIN_MODES.INDIVIDUAL && (
              <div style={styles.singleWheelRow}>
                {WHEEL_IDS.map((id) => {
                  const cfg = WHEEL_ANIMATION_CONFIG[id];
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveIndividualWheel(id)}
                      style={{
                        ...styles.singleWheelBtn,
                        borderColor:
                          activeIndividualWheel === id ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                        backgroundColor:
                          activeIndividualWheel === id
                            ? 'rgba(0, 240, 255, 0.15)'
                            : 'rgba(255, 255, 255, 0.03)',
                        color:
                          activeIndividualWheel === id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      }}
                    >
                      {cfg.shortName}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Spin Speed Multiplier Slider */}
            <div style={styles.sliderRow}>
              <div style={styles.sliderHeaderRow}>
                <span style={styles.sliderLabel}>SPEED MULTIPLIER</span>
                <span style={styles.sliderVal}>
                  {spinSpeed.toFixed(2)}x ({rpm} RPM &bull; {kmh} km/h)
                </span>
              </div>
              <input
                type="range"
                min="0.25"
                max="3.0"
                step="0.05"
                value={spinSpeed}
                onChange={(e) => setSpinSpeed(Number(e.target.value))}
                style={styles.rangeSlider}
              />
            </div>
          </div>

          {/* ─── SECTION 3: Mechanical Isolation Status & Actions ─── */}
          <div style={styles.footerSection}>
            <div style={styles.telemetryCard}>
              <div style={styles.telemetryRow}>
                <span style={styles.telemetryKey}>Brake Calipers:</span>
                <span style={styles.telemetryValGood}>ISOLATED / STATIONARY</span>
              </div>
              <div style={styles.telemetryRow}>
                <span style={styles.telemetryKey}>Rear Axle:</span>
                <span style={styles.telemetryValGood}>RIGID (0° YAW)</span>
              </div>
              <div style={styles.telemetryRow}>
                <span style={styles.telemetryKey}>Vehicle Body:</span>
                <span style={styles.telemetryValGood}>STATIONARY (Y = 0.000m)</span>
              </div>
            </div>

            <div style={styles.footerActionRow}>
              <button
                onClick={resetTransforms}
                style={styles.resetBtn}
                title="Reset all wheel spin and steering to neutral forward pose"
              >
                <RotateCcw size={12} />
                <span>RESET ALL TRANSFORMS</span>
              </button>

              <button
                onClick={() => handleFocusWheel(activeIndividualWheel || 'wheel_fl')}
                style={styles.focusBtn}
                title="Focus camera on wheel assembly"
              >
                <Compass size={12} />
                <span>FOCUS WHEEL</span>
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
  animBadge: {
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
  animDot: {
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
  steerGaugeTrack: {
    position: 'relative',
    height: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '4px',
    marginBottom: '4px',
  },
  steerGaugeCenterTick: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: '2px',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: 'translateX(-50%)',
  },
  steerGaugeIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '10px',
    backgroundColor: 'var(--accent-cyan)',
    borderRadius: '3px',
    transform: 'translateX(-50%)',
    boxShadow: '0 0 8px var(--accent-cyan)',
    transition: 'left 0.05s linear',
  },
  steerPresetRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '6px',
  },
  presetBtn: {
    padding: '6px 4px',
    border: '1px solid var(--border-subtle)',
    borderRadius: '5px',
    color: '#FFFFFF',
    fontSize: '10px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
  },
  sliderRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '4px',
  },
  rangeSlider: {
    width: '100%',
    accentColor: 'var(--accent-cyan)',
    cursor: 'pointer',
    height: '4px',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '8px',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  sliderHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: '9px',
    fontWeight: '700',
    color: 'var(--text-muted)',
  },
  sliderVal: {
    fontSize: '9px',
    color: 'var(--accent-cyan)',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  spinControlsRow: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '6px',
  },
  mainActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '7px 10px',
    border: '1px solid',
    borderRadius: '6px',
    fontSize: '10px',
    fontWeight: '700',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    transition: 'all 0.15s ease',
  },
  secondaryActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '7px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    color: '#FFFFFF',
    fontSize: '10px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modeTabsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
  },
  modeTabBtn: {
    padding: '5px 2px',
    border: '1px solid',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: '700',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
  },
  singleWheelRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
  },
  singleWheelBtn: {
    padding: '4px 2px',
    border: '1px solid',
    borderRadius: '4px',
    fontSize: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
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
  telemetryValGood: {
    color: 'var(--status-ready)',
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
