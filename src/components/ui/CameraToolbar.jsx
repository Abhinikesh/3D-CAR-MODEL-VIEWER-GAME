import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  RotateCcw,
  Maximize2,
  Eye,
  Box,
  Compass,
  ChevronDown,
  Layers,
  Sun,
  Sparkles,
  RotateCw,
  Film,
  Crosshair,
} from 'lucide-react';
import {
  useCameraStore,
  CAMERA_PRESETS,
} from '../../store/cameraStore.js';
import {
  useLightingStore,
  LIGHTING_PRESETS,
} from '../../store/lightingStore.js';

export default function CameraToolbar() {
  const {
    activePreset,
    projectionMode,
    isTurntableActive,
    setPreset,
    setProjectionMode,
    toggleTurntable,
    resetView,
    fitToVehicle,
  } = useCameraStore();

  const { activePreset: activeLighting, setLightingPreset } = useLightingStore();

  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const [cinematicDropdownOpen, setCinematicDropdownOpen] = useState(false);
  const [lightingDropdownOpen, setLightingDropdownOpen] = useState(false);

  const presetDropdownRef = useRef(null);
  const cinematicDropdownRef = useRef(null);
  const lightingDropdownRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(event.target)) {
        setPresetDropdownOpen(false);
      }
      if (cinematicDropdownRef.current && !cinematicDropdownRef.current.contains(event.target)) {
        setCinematicDropdownOpen(false);
      }
      if (lightingDropdownRef.current && !lightingDropdownRef.current.contains(event.target)) {
        setLightingDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activePresetData = CAMERA_PRESETS[activePreset] || {
    label: activePreset === 'custom' ? 'Custom Orbit' : 'Preset',
    description: 'Free orbital viewing angle',
  };

  const activeLightingData = LIGHTING_PRESETS[activeLighting] || LIGHTING_PRESETS['studio'];

  // Group camera presets into categories
  const orthogonalPresets = ['front', 'rear', 'left', 'right'];
  const planarPresets = ['top', 'bottom'];
  const isometricPresets = ['front-left', 'front-right', 'rear-left', 'rear-right'];
  const cinematicPresets = ['elevated-front', 'elevated-rear', 'wheel-detail', 'front-detail', 'rear-detail', 'interior-view'];

  return (
    <div style={styles.container}>
      {/* 1. Camera Angle Preset Dropdown */}
      <div style={styles.dropdownWrapper} ref={presetDropdownRef}>
        <button
          onClick={() => {
            setPresetDropdownOpen(!presetDropdownOpen);
            setLightingDropdownOpen(false);
          }}
          style={{
            ...styles.button,
            ...styles.presetButton,
            borderColor: activePreset !== 'custom' ? 'var(--accent-teal)' : 'var(--border-color)',
          }}
          title="Select camera angle preset"
          aria-expanded={presetDropdownOpen}
          aria-haspopup="listbox"
        >
          <Camera size={14} color="var(--accent-cyan)" />
          <div style={styles.presetTextGroup}>
            <span style={styles.presetLabel}>{activePresetData.label}</span>
          </div>
          <ChevronDown
            size={13}
            color="var(--text-muted)"
            style={{
              transform: presetDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        {presetDropdownOpen && (
          <div style={styles.menu} role="listbox">
            {/* Isometric Angles */}
            <div style={styles.menuGroupHeader}>
              <Compass size={11} color="var(--accent-teal)" />
              <span>ISOMETRIC ANGLES</span>
            </div>
            {isometricPresets.map((key) => {
              const item = CAMERA_PRESETS[key];
              const isSelected = activePreset === key;
              return (
                <button
                  key={key}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setPreset(key);
                    setPresetDropdownOpen(false);
                  }}
                  style={{
                    ...styles.menuItem,
                    backgroundColor: isSelected ? 'rgba(69, 162, 158, 0.18)' : 'transparent',
                    color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                  }}
                >
                  <span style={styles.menuItemTitle}>{item.label}</span>
                  <span style={styles.menuItemDesc}>{item.description}</span>
                </button>
              );
            })}

            {/* Principal Faces */}
            <div style={styles.menuGroupHeader}>
              <Box size={11} color="var(--accent-teal)" />
              <span>PRINCIPAL FACES</span>
            </div>
            {orthogonalPresets.map((key) => {
              const item = CAMERA_PRESETS[key];
              const isSelected = activePreset === key;
              return (
                <button
                  key={key}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setPreset(key);
                    setPresetDropdownOpen(false);
                  }}
                  style={{
                    ...styles.menuItem,
                    backgroundColor: isSelected ? 'rgba(69, 162, 158, 0.18)' : 'transparent',
                    color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                  }}
                >
                  <span style={styles.menuItemTitle}>{item.label}</span>
                  <span style={styles.menuItemDesc}>{item.description}</span>
                </button>
              );
            })}

            {/* Planar Views */}
            <div style={styles.menuGroupHeader}>
              <Layers size={11} color="var(--accent-teal)" />
              <span>PLANAR INSPECTION</span>
            </div>
            {planarPresets.map((key) => {
              const item = CAMERA_PRESETS[key];
              const isSelected = activePreset === key;
              return (
                <button
                  key={key}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setPreset(key);
                    setPresetDropdownOpen(false);
                  }}
                  style={{
                    ...styles.menuItem,
                    backgroundColor: isSelected ? 'rgba(69, 162, 158, 0.18)' : 'transparent',
                    color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                  }}
                >
                  <span style={styles.menuItemTitle}>{item.label}</span>
                  <span style={styles.menuItemDesc}>{item.description}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 1b. Cinematic Views & Component Detail Focus Dropdown */}
      <div style={styles.dropdownWrapper} ref={cinematicDropdownRef}>
        <button
          onClick={() => {
            setCinematicDropdownOpen(!cinematicDropdownOpen);
            setPresetDropdownOpen(false);
            setLightingDropdownOpen(false);
          }}
          style={{
            ...styles.button,
            ...styles.cinematicButton,
            borderColor: cinematicPresets.includes(activePreset) ? 'var(--accent-teal)' : 'var(--border-color)',
          }}
          title="Select cinematic showcase or component detail viewpoint"
          aria-expanded={cinematicDropdownOpen}
        >
          <Film size={14} color="var(--accent-teal, #45A29E)" />
          <div style={styles.presetTextGroup}>
            <span style={styles.presetLabel}>
              {cinematicPresets.includes(activePreset) ? activePresetData.label : 'Cinematic'}
            </span>
          </div>
          <ChevronDown
            size={13}
            color="var(--text-muted)"
            style={{
              transform: cinematicDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        {cinematicDropdownOpen && (
          <div style={styles.menu} role="listbox">
            {/* Cinematic Showcase Views */}
            <div style={styles.menuGroupHeader}>
              <Sparkles size={11} color="var(--accent-teal)" />
              <span>SHOWCASE VIEWPOINTS</span>
            </div>
            {['elevated-front', 'elevated-rear'].map((key) => {
              const item = CAMERA_PRESETS[key];
              const isSelected = activePreset === key;
              return (
                <button
                  key={key}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setPreset(key);
                    setCinematicDropdownOpen(false);
                  }}
                  style={{
                    ...styles.menuItem,
                    backgroundColor: isSelected ? 'rgba(69, 162, 158, 0.18)' : 'transparent',
                    color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                  }}
                >
                  <span style={styles.menuItemTitle}>{item.label}</span>
                  <span style={styles.menuItemDesc}>{item.description}</span>
                </button>
              );
            })}

            {/* Component Detail Framing */}
            <div style={styles.menuGroupHeader}>
              <Crosshair size={11} color="var(--accent-teal)" />
              <span>DETAIL & FOCUS</span>
            </div>
            {['wheel-detail', 'front-detail', 'rear-detail', 'interior-view'].map((key) => {
              const item = CAMERA_PRESETS[key];
              const isSelected = activePreset === key;
              return (
                <button
                  key={key}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setPreset(key);
                    setCinematicDropdownOpen(false);
                  }}
                  style={{
                    ...styles.menuItem,
                    backgroundColor: isSelected ? 'rgba(69, 162, 158, 0.18)' : 'transparent',
                    color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                  }}
                >
                  <span style={styles.menuItemTitle}>{item.label}</span>
                  <span style={styles.menuItemDesc}>{item.description}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={styles.divider} />

      {/* 2. Projection Mode Switcher */}
      <div style={styles.toggleGroup} role="group" aria-label="Projection Mode">
        <button
          onClick={() => setProjectionMode('perspective')}
          style={{
            ...styles.toggleButton,
            ...(projectionMode === 'perspective' ? styles.toggleActive : {}),
          }}
          title="Perspective Projection (Realistic 3D Showroom)"
        >
          <Eye size={13} />
          <span>Perspective</span>
        </button>
        <button
          onClick={() => setProjectionMode('orthographic')}
          style={{
            ...styles.toggleButton,
            ...(projectionMode === 'orthographic' ? styles.toggleActive : {}),
          }}
          title="Orthographic Projection (Parallel Technical View)"
        >
          <Layers size={13} />
          <span>Orthographic</span>
        </button>
      </div>

      <div style={styles.divider} />

      {/* 3. Automotive Studio Lighting Preset Selector */}
      <div style={styles.dropdownWrapper} ref={lightingDropdownRef}>
        <button
          onClick={() => {
            setLightingDropdownOpen(!lightingDropdownOpen);
            setPresetDropdownOpen(false);
          }}
          style={{
            ...styles.button,
            ...styles.lightingButton,
            borderColor: 'rgba(245, 158, 11, 0.4)',
          }}
          title="Select automotive studio lighting preset"
          aria-expanded={lightingDropdownOpen}
          aria-haspopup="listbox"
        >
          <Sun size={14} color="#F59E0B" />
          <div style={styles.presetTextGroup}>
            <span style={styles.presetLabel}>{activeLightingData.label}</span>
          </div>
          <ChevronDown
            size={13}
            color="var(--text-muted)"
            style={{
              transform: lightingDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        {lightingDropdownOpen && (
          <div style={{ ...styles.menu, minWidth: '220px' }} role="listbox">
            <div style={styles.menuGroupHeader}>
              <Sparkles size={11} color="#F59E0B" />
              <span>STUDIO LIGHTING RIGS</span>
            </div>
            {Object.keys(LIGHTING_PRESETS).map((key) => {
              const item = LIGHTING_PRESETS[key];
              const isSelected = activeLighting === key;
              return (
                <button
                  key={key}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setLightingPreset(key);
                    setLightingDropdownOpen(false);
                  }}
                  style={{
                    ...styles.menuItem,
                    backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    color: isSelected ? '#FBBF24' : 'var(--text-primary)',
                  }}
                >
                  <span style={styles.menuItemTitle}>{item.label}</span>
                  <span style={styles.menuItemDesc}>{item.description}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3b. Automatic Turntable Presentation Toggle */}
      <button
        onClick={() => toggleTurntable()}
        style={{
          ...styles.actionButton,
          backgroundColor: isTurntableActive ? 'rgba(102, 252, 241, 0.18)' : 'rgba(26, 32, 44, 0.7)',
          borderColor: isTurntableActive ? 'var(--accent-cyan)' : 'var(--border-color)',
          color: isTurntableActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
        }}
        title="Toggle automatic showroom turntable presentation"
      >
        <RotateCw
          size={13}
          style={{
            transform: isTurntableActive ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.4s ease',
            color: isTurntableActive ? 'var(--accent-cyan)' : 'currentColor',
          }}
        />
        <span style={styles.actionLabel}>{isTurntableActive ? 'Rotating' : 'Turntable'}</span>
      </button>

      <div style={styles.divider} />

      {/* 4. Fit Vehicle to Viewport */}
      <button
        onClick={fitToVehicle}
        style={styles.actionButton}
        title="Fit vehicle to camera viewport"
      >
        <Maximize2 size={13} color="var(--text-secondary)" />
        <span style={styles.actionLabel}>Fit</span>
      </button>

      {/* 5. Reset Camera to Default */}
      <button
        onClick={resetView}
        style={styles.actionButton}
        title="Reset camera to default hero view"
      >
        <RotateCcw size={13} color="var(--text-secondary)" />
        <span style={styles.actionLabel}>Reset</span>
      </button>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    backgroundColor: 'rgba(14, 18, 24, 0.88)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(69, 162, 158, 0.25)',
    borderRadius: '8px',
    padding: '0.3rem 0.5rem',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
    zIndex: 10,
    flexWrap: 'wrap',
  },
  dropdownWrapper: {
    position: 'relative',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    backgroundColor: 'rgba(26, 32, 44, 0.9)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '0.35rem 0.65rem',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  presetButton: {
    minWidth: '135px',
    justifyContent: 'space-between',
  },
  cinematicButton: {
    minWidth: '125px',
    justifyContent: 'space-between',
  },
  lightingButton: {
    minWidth: '120px',
    justifyContent: 'space-between',
  },
  presetTextGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left',
  },
  presetLabel: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: '0.01em',
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: '0',
    minWidth: '220px',
    backgroundColor: '#0E1218',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '0.35rem',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.75)',
    zIndex: 50,
    maxHeight: '340px',
    overflowY: 'auto',
  },
  menuGroupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.35rem 0.5rem 0.2rem',
    fontSize: '0.62rem',
    fontWeight: '700',
    letterSpacing: '0.08em',
    color: 'var(--accent-teal)',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    marginTop: '0.2rem',
  },
  menuItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%',
    padding: '0.4rem 0.55rem',
    borderRadius: '5px',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 0.12s ease',
  },
  menuItemTitle: {
    fontSize: '0.78rem',
    fontWeight: '600',
  },
  menuItemDesc: {
    fontSize: '0.66rem',
    color: 'var(--text-muted)',
    marginTop: '0.1rem',
  },
  divider: {
    width: '1px',
    height: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  toggleGroup: {
    display: 'flex',
    backgroundColor: 'rgba(26, 32, 44, 0.8)',
    borderRadius: '6px',
    padding: '2px',
    border: '1px solid var(--border-color)',
  },
  toggleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.28rem 0.55rem',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  toggleActive: {
    backgroundColor: 'var(--accent-teal)',
    color: '#07090D',
    fontWeight: '700',
    boxShadow: '0 2px 6px rgba(69, 162, 158, 0.35)',
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.35rem 0.55rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(26, 32, 44, 0.7)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
    fontSize: '0.72rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  actionLabel: {
    fontSize: '0.72rem',
  },
};
