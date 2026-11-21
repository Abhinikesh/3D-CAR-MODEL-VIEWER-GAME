import React from 'react';
import {
  Compass,
  Maximize2,
  RotateCw,
  Sliders,
  PanelRightClose,
  PanelRightOpen,
  Camera,
  Layers,
  Sparkles,
  Sun,
  Disc,
  Activity,
  Lightbulb,
  DoorOpen,
  Box,
  Gauge,
} from 'lucide-react';
import { useCameraStore } from '../../store/cameraStore.js';
import { usePaintStore } from '../../store/paintStore.js';
import { useWheelStore } from '../../store/wheelStore.js';
import { useShowroomEnvironmentStore } from '../../store/showroomEnvironmentStore.js';
import { useVehicleLightingStore } from '../../store/vehicleLightingStore.js';
import { useVehicleRigStore } from '../../store/vehicleRigStore.js';
import { usePerformanceStore } from '../../store/performanceStore.js';
import { useAppModeStore, APP_MODES } from '../../store/appModeStore.js';

import { CONFIG_TABS_CONFIG } from '../../utils/configuratorTabs.js';

const ICON_MAP = {
  Box,
  Sparkles,
  Disc,
  Layers,
  DoorOpen,
  Activity,
  Lightbulb,
  Sun,
};

export const CONFIG_TABS = CONFIG_TABS_CONFIG.map((t) => ({
  ...t,
  icon: ICON_MAP[t.iconName] || Box,
}));

export default function StudioHeader({
  activeTab,
  onSelectTab,
  drawerOpen,
  onToggleDrawer,
  onOpenMilestones,
  currentPart = 20,
  totalParts = 40,
}) {
  // Live state subscriptions
  const primaryColor = usePaintStore((state) => state.primaryColor);
  const activeFinish = usePaintStore((state) => state.activeFinish);
  const activeRimPresetId = useWheelStore((state) => state.activePresetId);
  const activeEnvId = useShowroomEnvironmentStore((state) => state.activeEnvironmentId);
  const headlightMode = useVehicleLightingStore((state) => state.headlightMode);
  const closures = useVehicleRigStore((state) => state.closures);
  const openCount = Object.values(closures || {}).filter(
    (c) => c.currentProgress > 0.05 || c.state === 'open' || c.state === 'opening'
  ).length;
  const isTurntableActive = useCameraStore((state) => state.isTurntableActive);
  const projectionMode = useCameraStore((state) => state.projectionMode);

  // Performance HUD state
  const isDiagnosticsOpen = usePerformanceStore((state) => state.isDiagnosticsOpen);
  const toggleDiagnostics = usePerformanceStore((state) => state.toggleDiagnostics);

  const toggleTurntable = useCameraStore((state) => state.toggleTurntable);
  const setProjectionMode = useCameraStore((state) => state.setProjectionMode);
  const resetView = useCameraStore((state) => state.resetView);

  // Format environment label
  const envLabels = {
    premium_studio: 'Studio',
    luxury_showroom: 'Luxury',
    outdoor_daylight: 'Daylight',
    cinematic_stage: 'Cinematic',
  };

  // App mode (Showroom vs Driving)
  const appMode = useAppModeStore((state) => state.mode);
  const setAppMode = useAppModeStore((state) => state.setMode);

  return (
    <header style={styles.header}>
      {/* ─── Left: Brand & Stage Identifier ─── */}
      <div style={styles.brandContainer}>
        <div style={styles.brandLogo}>
          <Box size={18} color="var(--accent-cyan)" />
        </div>
        <div style={styles.brandTextGroup}>
          <div style={styles.brandTitleRow}>
            <span style={styles.brandName}>AERO CONCEPT GT</span>
            <span style={styles.chassisTag}>SPEC // 01</span>
          </div>
        </div>

        {/* Operating Mode Segmented Switcher */}
        <div style={styles.modeSwitchGroup}>
          <button
            onClick={() => setAppMode(APP_MODES.SHOWROOM)}
            style={{
              ...styles.modeBtn,
              ...(appMode === APP_MODES.SHOWROOM ? styles.modeBtnActive : {}),
            }}
            title="Switch to 3D Showroom Configurator"
          >
            <span>STUDIO</span>
          </button>
          <button
            onClick={() => setAppMode(APP_MODES.DRIVING)}
            style={{
              ...styles.modeBtn,
              ...(appMode === APP_MODES.DRIVING ? styles.modeBtnDriveActive : {}),
            }}
            title="Switch to Single-Player Driving Mode"
          >
            <span>DRIVE</span>
          </button>
        </div>

        {/* Stage Milestone Pill */}
        <div style={styles.stageBadge}>
          <span style={styles.stageDot} />
          <span style={styles.stageText}>
            STAGE {currentPart}/{totalParts}
          </span>
        </div>
      </div>

      {/* ─── Center: Primary Configurator Mode Tabs OR Driving Proving Ground Telemetry ─── */}
      {appMode === APP_MODES.SHOWROOM ? (
        <nav style={styles.navTabs}>
          {CONFIG_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id && drawerOpen;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  onSelectTab(tab.id);
                }}
                style={{
                  ...styles.tabBtn,
                  ...(isActive ? styles.tabBtnActive : {}),
                }}
                title={`Configure ${tab.label}`}
              >
                <Icon size={13} color={isActive ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
                <span style={isActive ? styles.tabLabelActive : styles.tabLabel}>
                  {tab.label}
                </span>
                {isActive && <div style={styles.activeTabGlow} />}
              </button>
            );
          })}
        </nav>
      ) : (
        <div style={styles.drivingHeaderCenter}>
          <div style={styles.drivingTrackPill}>
            <Compass size={12} color="#10B981" />
            <span style={styles.drivingTrackText}>ASPHALT TEST PROVING GROUND</span>
          </div>
          <div style={styles.drivingStatusPill}>
            <span style={styles.drivingLiveDot} />
            <span style={styles.drivingStatusText}>PHYSICS SIMULATION ACTIVE</span>
          </div>
        </div>
      )}

      {/* ─── Right: Viewport Controls & Status ─── */}
      <div style={styles.actionGroup}>
        {/* Test Drive Button (Showroom Mode only) */}
        {appMode === APP_MODES.SHOWROOM && (
          <button
            onClick={() => setAppMode(APP_MODES.DRIVING)}
            style={styles.testDriveHeaderBtn}
            title="Drive this customized vehicle on the test track"
          >
            <Gauge size={13} color="#10B981" />
            <span>TEST DRIVE</span>
          </button>
        )}

        {/* Return to Configurator Button (Driving Mode only) */}
        {appMode === APP_MODES.DRIVING && (
          <button
            onClick={() => setAppMode(APP_MODES.SHOWROOM)}
            style={styles.returnStudioBtn}
            title="Return to Showroom Configurator"
          >
            <Sliders size={13} color="var(--accent-cyan)" />
            <span>STUDIO CONFIG</span>
          </button>
        )}

        {/* Turntable Auto-Rotation Toggle (Showroom Mode only) */}
        {appMode === APP_MODES.SHOWROOM && (
          <button
            onClick={toggleTurntable}
            style={{
              ...styles.iconActionBtn,
              border: isTurntableActive ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              backgroundColor: isTurntableActive ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            }}
            title={isTurntableActive ? 'Pause Turntable Showcase' : 'Start Auto-Turntable Showcase'}
          >
            <RotateCw
              size={13}
              color={isTurntableActive ? 'var(--accent-cyan)' : 'var(--text-secondary)'}
              style={{
                animation: isTurntableActive ? 'spin 6s linear infinite' : 'none',
              }}
            />
            <span style={styles.btnLabelSmall}>360°</span>
          </button>
        )}

        {/* Projection Mode Toggle (Showroom Mode only) */}
        {appMode === APP_MODES.SHOWROOM && (
          <button
            onClick={() =>
              setProjectionMode(
                projectionMode === 'perspective' ? 'orthographic' : 'perspective'
              )
            }
            style={styles.iconActionBtn}
            title={`Switch Projection (Current: ${projectionMode.toUpperCase()})`}
          >
            <Camera size={13} color="var(--text-secondary)" />
            <span style={styles.btnLabelSmall}>
              {projectionMode === 'perspective' ? 'PERSP' : 'ORTHO'}
            </span>
          </button>
        )}

        {/* Reset Camera View (Showroom Mode only) */}
        {appMode === APP_MODES.SHOWROOM && (
          <button
            onClick={resetView}
            style={styles.iconActionBtn}
            title="Reset Camera to Hero Isometric Angle"
          >
            <Compass size={13} color="var(--text-secondary)" />
            <span style={styles.btnLabelSmall}>RESET</span>
          </button>
        )}

        {/* Real-time Diagnostics HUD Toggle */}
        <button
          onClick={toggleDiagnostics}
          style={{
            ...styles.iconActionBtn,
            border: isDiagnosticsOpen ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
            backgroundColor: isDiagnosticsOpen ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)',
          }}
          title="Toggle Performance Diagnostics HUD (Press D)"
        >
          <Gauge
            size={13}
            color={isDiagnosticsOpen ? 'var(--accent-cyan)' : 'var(--text-secondary)'}
          />
          <span style={styles.btnLabelSmall}>STATS</span>
        </button>

        {/* Specs & Milestones Modal Toggle */}
        {onOpenMilestones && (
          <button
            onClick={onOpenMilestones}
            style={styles.iconActionBtn}
            title="View Computer Graphics Engineering Pipeline & Milestone Progress"
          >
            <Layers size={13} color="var(--text-secondary)" />
            <span style={styles.btnLabelSmall}>SPECS</span>
          </button>
        )}

        {/* Configurator Drawer Toggle */}
        <button
          onClick={onToggleDrawer}
          style={{
            ...styles.iconActionBtn,
            border: drawerOpen ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
            backgroundColor: drawerOpen ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)',
          }}
          title={drawerOpen ? 'Collapse Configurator Panel' : 'Expand Configurator Panel'}
        >
          {drawerOpen ? (
            <PanelRightClose size={14} color="var(--accent-cyan)" />
          ) : (
            <PanelRightOpen size={14} color="var(--text-secondary)" />
          )}
          <span style={styles.btnLabelSmall}>
            {drawerOpen ? 'HIDE' : 'CONTROLS'}
          </span>
        </button>
      </div>
    </header>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1rem',
    height: '48px',
    minHeight: '48px',
    maxHeight: '48px',
    backgroundColor: 'rgba(8, 10, 14, 0.96)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border-subtle)',
    position: 'relative',
    zIndex: 40,
    gap: '0.75rem',
    flexWrap: 'nowrap',
    flexShrink: 0,
    overflow: 'hidden',
  },
  brandContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    flexShrink: 0,
  },
  modeSwitchGroup: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '2px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  modeBtn: {
    padding: '3px 8px',
    borderRadius: '14px',
    fontSize: '0.6rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.18)',
    color: 'var(--accent-cyan)',
    boxShadow: '0 0 8px rgba(0, 240, 255, 0.25)',
  },
  modeBtnDriveActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    color: '#10B981',
    boxShadow: '0 0 8px rgba(16, 185, 129, 0.3)',
  },
  brandLogo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    border: '1px solid rgba(0, 240, 255, 0.25)',
  },
  brandTextGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  brandName: {
    fontSize: '0.85rem',
    fontWeight: '800',
    letterSpacing: '0.06em',
    color: '#FFFFFF',
    fontFamily: 'var(--font-sans)',
    whiteSpace: 'nowrap',
  },
  chassisTag: {
    fontSize: '0.6rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    padding: '1px 4px',
    borderRadius: '3px',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
  },
  brandSubtitle: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  liveConfigPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '4px 10px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '16px',
    marginLeft: '0.5rem',
  },
  colorDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    boxShadow: '0 0 8px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.4)',
  },
  configSummaryText: {
    fontSize: '0.68rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    letterSpacing: '0.04em',
  },
  closuresActiveBadge: {
    fontSize: '0.62rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: '700',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    padding: '1px 5px',
    borderRadius: '3px',
  },
  lightsActiveBadge: {
    fontSize: '0.62rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: '700',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    padding: '1px 5px',
    borderRadius: '3px',
  },
  navTabs: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: '3px 4px',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 8px',
    borderRadius: '5px',
    color: 'var(--text-muted)',
    fontSize: '0.68rem',
    fontWeight: '600',
    letterSpacing: '0.04em',
    transition: 'all 0.16s ease',
    position: 'relative',
    whiteSpace: 'nowrap',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    color: '#FFFFFF',
    border: '1px solid rgba(0, 240, 255, 0.28)',
  },
  tabLabel: {
    color: 'var(--text-muted)',
  },
  tabLabelActive: {
    color: 'var(--accent-cyan)',
    fontWeight: '700',
  },
  activeTabGlow: {
    position: 'absolute',
    bottom: '-3px',
    left: '15%',
    right: '15%',
    height: '2px',
    backgroundColor: 'var(--accent-cyan)',
    borderRadius: '2px',
    boxShadow: '0 0 6px var(--accent-cyan)',
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  iconActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 7px',
    borderRadius: '5px',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text-secondary)',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },
  btnLabelSmall: {
    fontSize: '0.62rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
  },
  stageBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 9px',
    borderRadius: '6px',
    backgroundColor: 'rgba(0, 240, 255, 0.06)',
    border: '1px solid rgba(0, 240, 255, 0.2)',
  },
  stageDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--status-ready)',
    boxShadow: '0 0 6px var(--status-ready)',
  },
  stageText: {
    fontSize: '0.67rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-cyan)',
  },
  drivingHeaderCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  drivingTrackPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    borderRadius: '16px',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
  },
  drivingTrackText: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: '0.04em',
    fontFamily: 'var(--font-mono)',
  },
  drivingStatusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    borderRadius: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-subtle)',
  },
  drivingLiveDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-cyan)',
    boxShadow: '0 0 6px var(--accent-cyan)',
  },
  drivingStatusText: {
    fontSize: '0.62rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    letterSpacing: '0.04em',
    fontFamily: 'var(--font-mono)',
  },
  testDriveHeaderBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '16px',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    color: '#10B981',
    fontSize: '0.66rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    letterSpacing: '0.05em',
    transition: 'all 0.15s ease',
    boxShadow: '0 0 12px rgba(16, 185, 129, 0.18)',
  },
  returnStudioBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '16px',
    border: '1px solid rgba(0, 240, 255, 0.35)',
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    color: 'var(--accent-cyan)',
    fontSize: '0.66rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    letterSpacing: '0.05em',
    transition: 'all 0.15s ease',
  },
};
