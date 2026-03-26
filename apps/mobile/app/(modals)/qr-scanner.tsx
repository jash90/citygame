import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet as RNStyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white text-base">Ładowanie kamery...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-8 gap-4">
        <Text className="text-white text-xl font-bold text-center">
          Brak dostępu do kamery
        </Text>
        <Text className="text-gray-400 text-sm text-center">
          Aby skanować kody QR, aplikacja potrzebuje dostępu do kamery.
        </Text>
        <TouchableOpacity
          className="bg-primary rounded-xl px-6 py-3"
          onPress={() => void requestPermission()}
        >
          <Text className="text-white font-semibold">Przyznaj dostęp</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClose}>
          <Text className="text-gray-400 text-sm">Anuluj</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
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
        <View className="flex-1 bg-black/60" />
        {/* Middle row */}
        <View className="flex-row" style={{ height: OVERLAY_SIZE }}>
          <View className="flex-1 bg-black/60" />
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
          <View className="flex-1 bg-black/60" />
        </View>
        {/* Bottom */}
        <View className="flex-1 bg-black/60" />
      </View>

      {/* Close button */}
      <TouchableOpacity
        className="absolute top-14 right-4 w-10 h-10 rounded-full bg-black/50 items-center justify-center"
        onPress={handleClose}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text className="text-white text-lg">✕</Text>
      </TouchableOpacity>

      {/* Instruction text */}
      <View className="absolute bottom-16 left-0 right-0 items-center">
        <Text className="text-white text-sm font-medium text-center px-8">
          Skieruj kamerę na kod QR, aby go zeskanować
        </Text>
        {scanned ? (
          <TouchableOpacity
            className="mt-4 bg-primary rounded-xl px-6 py-3"
            onPress={() => setScanned(false)}
          >
            <Text className="text-white font-semibold">Skanuj ponownie</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
