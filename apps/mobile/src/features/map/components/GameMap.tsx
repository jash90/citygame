import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { Platform, View, StyleSheet as RNStyleSheet } from 'react-native';
import MapView, { Marker, Circle, type Region } from 'react-native-maps';
import { useLocationStore } from '@/features/map/stores/locationStore';

interface GameMapProps {
  initialRegion?: Region;
  children?: React.ReactNode;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
}

export interface GameMapHandle {
  centerOnUser: () => void;
}

const DEFAULT_REGION: Region = {
  latitude: 49.8685,
  longitude: 21.7877,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const MAP_STYLE = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels',
    stylers: [{ visibility: 'simplified' }],
  },
];

export const GameMap = forwardRef<GameMapHandle, GameMapProps>(
  ({ initialRegion, children, onMapPress }, ref) => {
    const mapRef = useRef<MapView>(null);
    const { location, accuracy } = useLocationStore();

    const mapRegion: Region = location
      ? {
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: initialRegion?.latitudeDelta ?? 0.01,
          longitudeDelta: initialRegion?.longitudeDelta ?? 0.01,
        }
      : (initialRegion ?? DEFAULT_REGION);

    useImperativeHandle(ref, () => ({
      centerOnUser: () => {
        const loc = useLocationStore.getState().location;
        if (!loc || !mapRef.current) return;
        mapRef.current.animateToRegion(
          {
            latitude: loc.lat,
            longitude: loc.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          300,
        );
      },
    }));

    return (
      <View className="flex-1">
        <MapView
          ref={mapRef}
          style={RNStyleSheet.absoluteFillObject}
          initialRegion={mapRegion}
          customMapStyle={MAP_STYLE}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          onPress={(e) => onMapPress?.(e.nativeEvent.coordinate)}
        >
          {location ? (
            <>
              <Marker
                coordinate={{ latitude: location.lat, longitude: location.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={Platform.OS === 'android'}
              >
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: '#FF6B35',
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    ...(Platform.OS === 'ios'
                      ? {
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.1,
                          shadowRadius: 2,
                        }
                      : { elevation: 2 }),
                  }}
                />
              </Marker>
              {accuracy && accuracy > 0 ? (
                <Circle
                  center={{ latitude: location.lat, longitude: location.lng }}
                  radius={accuracy}
                  fillColor="rgba(255,107,53,0.1)"
                  strokeColor="rgba(255,107,53,0.3)"
                  strokeWidth={1}
                />
              ) : null}
            </>
          ) : null}

          {children}
        </MapView>
      </View>
    );
  },
);
