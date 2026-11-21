import React from 'react';
import { useSecondaryMaterialStore } from '../../store/secondaryMaterialStore.js';

// ─── Style constants ──────────────────────────────────────────────────────────
const S = {
  panel: {
    background: 'rgba(10, 12, 18, 0.88)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '10px 12px',
    color: '#E0E4EE',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '11px',
    minWidth: '200px',
    userSelect: 'none',
  },
  title: {
    fontWeight: '600',
    fontSize: '10px',
    letterSpacing: '0.08em',
    color: '#7A8098',
    textTransform: 'uppercase',
    marginBottom: '8px',
    paddingBottom: '5px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  section: {
    marginBottom: '8px',
  },
  sectionLabel: {
    color: '#6A7090',
    fontSize: '9px',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  btnRow: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  btn: (active) => ({
    padding: '3px 8px',
    borderRadius: '5px',
    border: `1px solid ${active ? 'rgba(100,160,255,0.6)' : 'rgba(255,255,255,0.1)'}`,
    background: active ? 'rgba(80,130,255,0.18)' : 'rgba(255,255,255,0.05)',
    color: active ? '#A0C8FF' : '#B0B8D0',
    fontSize: '10px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  }),
  toggleBtn: (active) => ({
    padding: '3px 8px',
    borderRadius: '5px',
    border: `1px solid ${active ? 'rgba(80,220,120,0.6)' : 'rgba(255,255,255,0.1)'}`,
    background: active ? 'rgba(60,180,100,0.18)' : 'rgba(255,255,255,0.05)',
    color: active ? '#80EEA0' : '#B0B8D0',
    fontSize: '10px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  }),
  resetBtn: {
    width: '100%',
    padding: '4px',
    borderRadius: '5px',
    border: '1px solid rgba(255,80,80,0.3)',
    background: 'rgba(200,60,60,0.12)',
    color: '#FF9090',
    fontSize: '10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '4px',
  },
  divider: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    margin: '6px 0',
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProfileRow({ label, options, active, onSelect }) {
  return (
    <div style={S.section}>
      <div style={S.sectionLabel}>{label}</div>
      <div style={S.btnRow}>
        {options.map(({ id, label: l }) => (
          <button
            key={id}
            style={S.btn(active === id)}
            onClick={() => onSelect(id)}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function LightToggle({ label, isOn, onToggle }) {
  return (
    <button style={S.toggleBtn(isOn)} onClick={() => onToggle(!isOn)}>
      {isOn ? '● ' : '○ '}{label}
    </button>
  );
}

// ─── Main Toolbar ─────────────────────────────────────────────────────────────

export function SecondaryMaterialToolbar() {
  const glassProfile = useSecondaryMaterialStore((s) => s.glassProfile);
  const chromeProfile = useSecondaryMaterialStore((s) => s.chromeProfile);
  const rubberProfile = useSecondaryMaterialStore((s) => s.rubberProfile);
  const plasticProfile = useSecondaryMaterialStore((s) => s.plasticProfile);
  const headlightsOn = useSecondaryMaterialStore((s) => s.headlightsOn);
  const taillightsOn = useSecondaryMaterialStore((s) => s.taillightsOn);
  const indicatorsOn = useSecondaryMaterialStore((s) => s.indicatorsOn);
  const brakeLightsOn = useSecondaryMaterialStore((s) => s.brakeLightsOn);

  const setGlassProfile = useSecondaryMaterialStore((s) => s.setGlassProfile);
  const setChromeProfile = useSecondaryMaterialStore((s) => s.setChromeProfile);
  const setRubberProfile = useSecondaryMaterialStore((s) => s.setRubberProfile);
  const setPlasticProfile = useSecondaryMaterialStore((s) => s.setPlasticProfile);
  const setHeadlights = useSecondaryMaterialStore((s) => s.setHeadlights);
  const setTaillights = useSecondaryMaterialStore((s) => s.setTaillights);
  const setIndicators = useSecondaryMaterialStore((s) => s.setIndicators);
  const setBrakeLights = useSecondaryMaterialStore((s) => s.setBrakeLights);
  const resetAllSecondary = useSecondaryMaterialStore((s) => s.resetAllSecondary);

  return (
    <div style={S.panel} data-testid="secondary-material-toolbar">
      <div style={S.title}>⚙ Secondary Materials</div>

      <ProfileRow
        label="Glass"
        active={glassProfile}
        options={[
          { id: 'factory', label: 'Factory' },
          { id: 'dark', label: 'Dark Tint' },
          { id: 'clear', label: 'Clear' },
        ]}
        onSelect={setGlassProfile}
      />

      <ProfileRow
        label="Chrome / Metal"
        active={chromeProfile}
        options={[
          { id: 'chrome', label: 'Chrome' },
          { id: 'brushed', label: 'Brushed' },
          { id: 'dark_metal', label: 'Gunmetal' },
        ]}
        onSelect={setChromeProfile}
      />

      <ProfileRow
        label="Rubber"
        active={rubberProfile}
        options={[
          { id: 'factory', label: 'Factory' },
          { id: 'worn', label: 'Worn' },
          { id: 'racing', label: 'Racing' },
        ]}
        onSelect={setRubberProfile}
      />

      <ProfileRow
        label="Plastic Trim"
        active={plasticProfile}
        options={[
          { id: 'black_matte', label: 'Matte' },
          { id: 'dark_soft', label: 'Soft-Touch' },
          { id: 'gloss_black', label: 'Gloss' },
        ]}
        onSelect={setPlasticProfile}
      />

      <div style={S.divider} />

      <div style={S.section}>
        <div style={S.sectionLabel}>Lighting</div>
        <div style={{ ...S.btnRow, gap: '4px' }}>
          <LightToggle label="Head" isOn={headlightsOn} onToggle={setHeadlights} />
          <LightToggle label="Tail" isOn={taillightsOn} onToggle={setTaillights} />
          <LightToggle label="Signal" isOn={indicatorsOn} onToggle={setIndicators} />
          <LightToggle label="Brake" isOn={brakeLightsOn} onToggle={setBrakeLights} />
        </div>
      </div>

      <button style={S.resetBtn} onClick={resetAllSecondary}>
        ↺ Reset Secondary
      </button>
    </div>
  );
}
