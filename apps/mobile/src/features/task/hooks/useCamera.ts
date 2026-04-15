import { useState } from 'react';
import { useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';

interface UseCameraReturn {
  hasPermission: boolean;
  isLoading: boolean;
  requestPermission: () => Promise<{ granted: boolean }>;
  facing: CameraType;
  toggleFacing: () => void;
  flash: FlashMode;
  toggleFlash: () => void;
}

export function useCamera(): UseCameraReturn {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');

  const toggleFacing = (): void => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = (): void => {
    setFlash((f) => (f === 'off' ? 'on' : 'off'));
  };

  return {
    hasPermission: permission?.granted ?? false,
    isLoading: permission === null,
    requestPermission,
    facing,
    toggleFacing,
    flash,
    toggleFlash,
  };
}
