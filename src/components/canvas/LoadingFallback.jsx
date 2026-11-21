import React from 'react';
import { Html } from '@react-three/drei';
import { Loader2 } from 'lucide-react';

export default function LoadingFallback() {
  return (
    <Html center>
      <div style={styles.container}>
        <Loader2 size={32} color="var(--accent-cyan)" style={styles.spinner} />
        <div style={styles.title}>Loading Vehicle Geometry...</div>
        <div style={styles.subtitle}>Parsing Khronos Car Concept GLB &amp; Compiling PBR Shaders</div>
      </div>
    </Html>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    padding: '1.5rem 2rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(18, 22, 29, 0.92)',
    border: '1px solid var(--border-subtle)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    minWidth: '280px',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  spinner: {
    animation: 'spin 1.2s linear infinite',
  },
  title: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    letterSpacing: '0.04em',
  },
  subtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    maxWidth: '240px',
    lineHeight: '1.4',
  },
};
