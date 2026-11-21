import React from 'react';
import { useAppModeStore, APP_MODES } from '../../store/appModeStore.js';
import ShowroomScene from '../../scenes/showroom/ShowroomScene.jsx';
import DrivingScene from '../../scenes/driving/DrivingScene.jsx';
// ShowroomEnvironmentController is mounted inside ShowroomScene
import ShowroomEnvironmentController from './ShowroomEnvironmentController.jsx';

/**
 * Master Scene Switcher
 * Dynamically mounts either the ShowroomScene (hosting ShowroomEnvironmentController and configurator)
 * or DrivingScene (simulation test track) based on the active application operating mode.
 */
export default function StudioScene({ onLoadMetrics }) {
  const mode = useAppModeStore((state) => state.mode);

  if (mode === APP_MODES.DRIVING) {
    return <DrivingScene onLoadMetrics={onLoadMetrics} />;
  }

  return <ShowroomScene onLoadMetrics={onLoadMetrics} />;
}
