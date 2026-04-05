import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { useCamera } from '@/hooks/useCamera';

export interface MediaCaptureProps {
  onCapture: (imageUri: string) => void;
  isUploading?: boolean;
  compact?: boolean;
}

export const MediaCapture = ({
  onCapture,
  isUploading = false,
  compact = false,
}: MediaCaptureProps): React.JSX.Element => {
  const { hasPermission, isLoading, requestPermission, facing, toggleFacing, flash, toggleFlash } =
    useCamera();
  const cameraRef = useRef<CameraView>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const previewHeight = compact ? 280 : 420;

  if (isLoading) {
    return (
      <View className="items-center justify-center py-10">
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View className="gap-4 items-center py-6 px-4">
        <Ionicons name="camera-outline" size={48} color="#9CA3AF" />
        <Text className="text-base font-semibold text-gray-900 text-center">
          Dostęp do kamery
        </Text>
        <Text className="text-sm text-gray-500 text-center leading-6">
          Aby wykonać zdjęcie do tego zadania, aplikacja potrzebuje dostępu do kamery.
        </Text>
        <TouchableOpacity
          className="bg-primary rounded-xl px-6 py-3"
          onPress={() => void requestPermission()}
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold">Przyznaj dostęp</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isUploading && capturedUri) {
    return (
      <View className="gap-3 items-center">
        <View style={{ height: previewHeight, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', width: '100%' }}>
          <Image source={{ uri: capturedUri }} style={RNStyleSheet.absoluteFillObject} resizeMode="cover" />
          <View style={{ ...RNStyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text className="text-white font-semibold text-sm">Przesyłanie zdjęcia...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (capturedUri) {
    return (
      <View className="gap-3">
        <View style={{ height: previewHeight, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
          <Image source={{ uri: capturedUri }} style={RNStyleSheet.absoluteFillObject} resizeMode="cover" />
        </View>
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 border border-gray-200 rounded-xl py-3.5 items-center"
            onPress={() => setCapturedUri(null)}
            activeOpacity={0.8}
          >
            <Text className="text-gray-700 font-semibold">Zrób ponownie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-primary rounded-xl py-3.5 items-center"
            onPress={() => onCapture(capturedUri)}
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold">Użyj tego zdjęcia</Text>
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

  return (
    <View className="gap-3">
      <View style={{ height: previewHeight, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', position: 'relative' }}>
        <CameraView
          ref={cameraRef}
          style={RNStyleSheet.absoluteFillObject}
          facing={facing}
          flash={flash}
        />
        <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
            onPress={toggleFacing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="camera-reverse-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
            onPress={toggleFlash}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={flash === 'off' ? 'flash-outline' : 'flash'} size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="items-center py-2">
        <TouchableOpacity
          style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#FF6B35', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}
          onPress={() => void handleCapture()}
          disabled={capturing}
          activeOpacity={0.8}
        >
          {capturing ? (
            <ActivityIndicator color="#FF6B35" size="small" />
          ) : (
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#FF6B35' }} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};
