import React from 'react';
import {
  Layers,
  ShieldCheck,
  Clock,
  CheckCircle2,
  X,
  Cpu,
  Compass,
} from 'lucide-react';

export default function EngineeringMilestonesDrawer({ isOpen, onClose, milestones = [] }) {
  if (!isOpen) return null;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={styles.modalHeader}>
          <div style={styles.modalTitleGroup}>
            <div style={styles.iconBox}>
              <Layers size={18} color="var(--accent-cyan)" />
            </div>
            <div>
              <h2 style={styles.modalTitle}>CG Engineering Pipeline &amp; Milestones</h2>
              <p style={styles.modalSub}>
                Academic Computer Graphics Architecture &bull; 20-Stage Configurator Checkpoint
              </p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Close Specs & Milestones">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={styles.modalBody}>
          {/* Top Card: PBR Graphics Pipeline Reference */}
          <div style={styles.pipelineCard}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitleRow}>
                <Cpu size={16} color="var(--accent-cyan)" />
                <h3 style={styles.cardTitle}>Computer Graphics Engineering Pipeline</h3>
              </div>
              <ShieldCheck size={16} color="#10B981" />
            </div>

            <div style={styles.pipelineGrid}>
              <div style={styles.pipelineItem}>
                <span style={styles.pipeKey}>Coordinate Standard</span>
                <span style={styles.pipeVal}>Three.js Y-Up Right-Handed Cartesian (Y = 0.000m Ground Tangency)</span>
              </div>
              <div style={styles.pipelineItem}>
                <span style={styles.pipeKey}>Materials Engine</span>
                <span style={styles.pipeVal}>MeshPhysicalMaterial Clearcoat, Sheen, Transmission &amp; Metalness</span>
              </div>
              <div style={styles.pipelineItem}>
                <span style={styles.pipeKey}>Illumination Architecture</span>
                <span style={styles.pipeVal}>4-Environment Photometric Rigs &bull; 2K Soft PCF Shadows &bull; Contact Shadows</span>
              </div>
              <div style={styles.pipelineItem}>
                <span style={styles.pipeKey}>Kinematics &amp; Dynamics</span>
                <span style={styles.pipeVal}>Rodrigues Local-Hinge Rotations &bull; Cubic Ease-in-out &bull; Wheel Roll/Steer</span>
              </div>
            </div>
          </div>

          {/* Bottom Card: Milestone Tracking Grid */}
          <div style={styles.milestonesCard}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitleRow}>
                <Clock size={16} color="var(--accent-cyan)" />
                <h3 style={styles.cardTitle}>Automotive Configurator Milestones</h3>
              </div>
              <span style={styles.completedBadge}>20 of 20 Completed (100%)</span>
            </div>

            <div style={styles.milestonesGrid}>
              {milestones.map((m) => (
                <div key={m.id} style={styles.milestoneItem}>
                  <div style={styles.milestoneLeft}>
                    <CheckCircle2 size={13} color="#10B981" />
                    <span style={styles.milestonePart}>Part {String(m.id).padStart(2, '0')}</span>
                    <span style={styles.milestoneTitle}>{m.title}</span>
                  </div>
                  <span style={styles.milestoneBadge}>Verified</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(10px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
  },
  modal: {
    width: '100%',
    maxWidth: '920px',
    maxHeight: '85vh',
    backgroundColor: 'rgba(12, 16, 24, 0.98)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '12px',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.4rem',
    borderBottom: '1px solid var(--border-subtle)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  modalTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  iconBox: {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'var(--font-sans)',
  },
  modalSub: {
    margin: 0,
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  closeBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modalBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.2rem 1.4rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
  },
  pipelineCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    padding: '1rem 1.2rem',
  },
  milestonesCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    padding: '1rem 1.2rem',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '0.6rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    marginBottom: '0.8rem',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '0.82rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
    color: '#FFFFFF',
    letterSpacing: '0.04em',
  },
  completedBadge: {
    fontSize: '0.64rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid rgba(16, 185, 129, 0.25)',
  },
  pipelineGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem 1.2rem',
  },
  pipelineItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  pipeKey: {
    fontSize: '0.62rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
  },
  pipeVal: {
    fontSize: '0.72rem',
    color: '#E2E8F0',
    lineHeight: '1.4',
  },
  milestonesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.45rem 1.2rem',
  },
  milestoneItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.35rem 0.6rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
  },
  milestoneLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    overflow: 'hidden',
  },
  milestonePart: {
    fontSize: '0.6rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: '800',
    color: 'var(--accent-cyan)',
  },
  milestoneTitle: {
    fontSize: '0.66rem',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  milestoneBadge: {
    fontSize: '0.58rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: '1px 5px',
    borderRadius: '3px',
    marginLeft: '6px',
  },
};
