import React, { Component } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import StudioScene from './StudioScene.jsx';
import { useSelectionStore } from '../../store/selectionStore.js';

class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ShowroomCanvas] WebGL / 3D Rendering Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  returnFallback() {
    return (
      <div style={styles.errorContainer}>
        <AlertTriangle size={36} color="#E74C3C" />
        <h3 style={styles.errorTitle}>3D Graphics Engine Error</h3>
        <p style={styles.errorMessage}>
          {this.state.error?.message || 'Failed to initialize WebGL rendering context or decode vehicle model.'}
        </p>
        <button onClick={this.handleRetry} style={styles.retryButton}>
          <RefreshCw size={14} /> Retry Viewport Initialization
        </button>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.returnFallback();
    }
    return this.props.children;
  }
}

export default function ShowroomCanvas({ onLoadMetrics }) {
  return (
    <div style={styles.wrapper}>
      <CanvasErrorBoundary>
        <Canvas
          shadows={{ enabled: true, type: THREE.PCFShadowMap }}
          dpr={[1, 2]}
          camera={{
            fov: 40,
            position: [3.6, 1.45, 4.2],
            near: 0.1,
            far: 100,
          }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl, scene }) => {
            if (gl.shadowMap) {
              gl.shadowMap.type = THREE.PCFShadowMap;
            }
            if (typeof window !== 'undefined') {
              window.__THREE_RENDERER__ = gl;
              window.__THREE_SCENE__ = scene;
            }
          }}
          onPointerMissed={() => useSelectionStore.getState().clearSelection()}
          style={styles.canvas}
        >
          <color attach="background" args={['#07090D']} />
          <StudioScene onLoadMetrics={onLoadMetrics} />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#07090D',
    overflow: 'hidden',
  },
  canvas: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
  errorContainer: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    backgroundColor: '#12161D',
    color: '#FFFFFF',
    textAlign: 'center',
    gap: '0.85rem',
  },
  errorTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorMessage: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    maxWidth: '420px',
    lineHeight: '1.5',
  },
  retryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1.2rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(69, 162, 158, 0.2)',
    border: '1px solid var(--border-focus)',
    color: 'var(--accent-cyan)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '0.5rem',
    transition: 'background-color 0.2s',
  },
};
