import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet as RNStyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native-unistyles';
import { useGameStore } from '@/stores/gameStore';

const OVERLAY_SIZE = 260;

export default function QRScannerModal(): React.JSX.Element {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const { setLastScannedQR } = useGameStore();

  useEffect(() => {
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = ({
    data,
  }: {
    type: string;
    data: string;
  }): void => {
    if (scanned) return;
    setScanned(true);
    // Store the result so TaskRenderer can read it on return
    setLastScannedQR(data);
    router.back();
  };

  const handleClose = (): void => {
    router.back();
  };

  if (!permission) {
    return (
      <View style={styles.centeredBlack}>
        <Text style={styles.whiteText}>Ładowanie kamery...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>
          Brak dostępu do kamery
        </Text>
        <Text style={styles.permissionSubtitle}>
          Aby skanować kody QR, aplikacja potrzebuje dostępu do kamery.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => void requestPermission()}
        >
          <Text style={styles.permissionButtonText}>Przyznaj dostęp</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClose}>
          <Text style={styles.cancelText}>Anuluj</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.flex1Black}>
      <StatusBar style="light" />

      <CameraView
        style={RNStyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Dark overlay with transparent cutout */}
      <View style={RNStyleSheet.absoluteFillObject} pointerEvents="none">
        {/* Top */}
        <View style={styles.overlayFill} />
        {/* Middle row */}
        <View style={[styles.middleRow, { height: OVERLAY_SIZE }]}>
          <View style={styles.overlayFill} />
          {/* Transparent center */}
          <View
            style={{
              width: OVERLAY_SIZE,
              height: OVERLAY_SIZE,
              borderWidth: 2,
              borderColor: '#FF6B35',
              borderRadius: 12,
            }}
          />
          <View style={styles.overlayFill} />
        </View>
        {/* Bottom */}
        <View style={styles.overlayFill} />
      </View>

      {/* Close button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={handleClose}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>

      {/* Instruction text */}
      <View style={styles.instructionContainer}>
        <Text style={styles.instructionText}>
          Skieruj kamerę na kod QR, aby go zeskanować
        </Text>
        {scanned ? (
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.rescanButtonText}>Skanuj ponownie</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex1Black: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centeredBlack: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: theme.fontWeight.bold,
    textAlign: 'center',
  },
  permissionSubtitle: {
    color: theme.colors.gray[400],
    fontSize: 14,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: theme.fontWeight.semibold,
  },
  cancelText: {
    color: theme.colors.gray[400],
    fontSize: 14,
  },
  overlayFill: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  middleRow: {
    flexDirection: 'row',
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 64,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: theme.fontWeight.medium,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  rescanButton: {
    marginTop: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  rescanButtonText: {
    color: '#FFFFFF',
    fontWeight: theme.fontWeight.semibold,
  },
}));
