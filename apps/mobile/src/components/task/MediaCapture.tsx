import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CameraView } from 'expo-camera';
import { useCamera } from '@/hooks/useCamera';

export interface MediaCaptureProps {
  onCapture: (imageUri: string) => void;
  isUploading?: boolean;
  compact?: boolean;
}

type CaptureState = 'permission' | 'camera' | 'preview';

export const MediaCapture = ({
  onCapture,
  isUploading = false,
  compact = false,
}: MediaCaptureProps): React.JSX.Element => {
  const { hasPermission, isLoading, requestPermission, facing, toggleFacing, flash, toggleFlash } =
    useCamera();
  const { theme } = useUnistyles();
  const cameraRef = useRef<CameraView>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const previewHeight = compact ? 280 : 420;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle}>
          Dostęp do kamery
        </Text>
        <Text style={styles.permissionDescription}>
          Aby wykonać zdjęcie do tego zadania, aplikacja potrzebuje dostępu do kamery.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => void requestPermission()}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>Przyznaj dostęp</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isUploading && capturedUri) {
    return (
      <View style={styles.gap3Center}>
        <View style={[styles.imageContainer, { height: previewHeight }]}>
          <Image source={{ uri: capturedUri }} style={RNStyleSheet.absoluteFillObject} resizeMode="cover" />
          <View style={styles.uploadOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.uploadOverlayText}>Przesyłanie zdjęcia...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (capturedUri) {
    return (
      <View style={styles.gap3}>
        <View style={[styles.imageContainer, { height: previewHeight }]}>
          <Image
            source={{ uri: capturedUri }}
            style={RNStyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={() => setCapturedUri(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.retakeButtonText}>Zrób ponownie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.usePhotoButton}
            onPress={() => onCapture(capturedUri)}
            activeOpacity={0.8}
          >
            <Text style={styles.usePhotoButtonText}>Użyj tego zdjęcia</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleCapture = async (): Promise<void> => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: false, quality: 0.8 });
      if (photo?.uri) setCapturedUri(photo.uri);
    } finally {
      setCapturing(false);
    }
  };

  const flashIcon = flash === 'off' ? '⚡️' : '🔦';
  const facingIcon = facing === 'back' ? '🔄' : '🤳';

  return (
    <View style={styles.gap3}>
      <View style={[styles.imageContainer, { height: previewHeight }]}>
        <CameraView
          ref={cameraRef}
          style={RNStyleSheet.absoluteFillObject}
          facing={facing}
          flash={flash}
        />

        <View style={styles.topControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleFacing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.controlButtonIcon}>{facingIcon}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleFlash}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.controlButtonIcon}>{flashIcon}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.captureRow}>
        <TouchableOpacity
          style={styles.captureButton}
          onPress={() => void handleCapture()}
          disabled={capturing}
          activeOpacity={0.8}
        >
          {capturing ? (
            <ActivityIndicator color={theme.colors.primary} size="small" />
          ) : (
            <View style={styles.captureInner} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  gap3: {
    gap: 12,
  },
  gap3Center: {
    gap: 12,
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  permissionContainer: {
    gap: 16,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  permissionIcon: {
    fontSize: 48,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.gray[900],
    textAlign: 'center',
  },
  permissionDescription: {
    fontSize: 14,
    color: theme.colors.gray[500],
    textAlign: 'center',
    lineHeight: 14 * 1.75,
  },
  permissionButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  imageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  uploadOverlay: {
    ...RNStyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  uploadOverlayText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: theme.colors.gray[700],
    fontWeight: '600',
  },
  usePhotoButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  usePhotoButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  topControls: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonIcon: {
    fontSize: 18,
  },
  captureRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  captureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.primary,
  },
}));
