import React, { useImperativeHandle, useRef, forwardRef, useCallback, useEffect } from 'react';
import { Platform, View, StyleSheet as RNStyleSheet } from 'react-native';
import {
  MapView,
  Camera,
  MarkerView,
  type CameraRef,
  type MapViewRef,
} from '@maplibre/maplibre-react-native';
import { useLocationStore } from '@/features/map/stores/locationStore';
import { MAP_STYLE_URL } from '@/shared/lib/constants';

/**
 * Public API matches the previous react-native-maps GameMap:
 *  - `initialRegion`-equivalent via `initialCenter`/`initialZoom`
 *  - `centerOnUser` imperative ref method
 *  - `onMapPress` callback
 *  - User location dot rendered as a `Camera`-tracked overlay
 *  - Auto-recenter when the player drifts off the visible bounds (throttled)
 *
 * Switching from Google/Apple to MapLibre is what unlocks offline play —
 * see `mapPackManager.ts` for downloading tile packs for a city.
 */

interface GameMapProps {
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  children?: React.ReactNode;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
}

export interface GameMapHandle {
  centerOnUser: () => void;
}

const DEFAULT_CENTER: [number, number] = [21.7877, 49.8685]; // Strzyżów
const DEFAULT_ZOOM = 14;

export const GameMap = forwardRef<GameMapHandle, GameMapProps>(
  ({ initialCenter, initialZoom, children, onMapPress }, ref) => {
    const mapRef = useRef<MapViewRef>(null);
    const cameraRef = useRef<CameraRef>(null);
    const isMapReady = useRef(false);
    const lastRecenterAtRef = useRef(0);

    const { location } = useLocationStore();

    const center = location ? [location.lng, location.lat] : (initialCenter ?? DEFAULT_CENTER);

    useImperativeHandle(ref, () => ({
      centerOnUser: () => {
        const loc = useLocationStore.getState().location;
        if (!loc || !cameraRef.current) return;
        cameraRef.current.flyTo([loc.lng, loc.lat], 300);
      },
    }));

    const ensureUserVisible = useCallback(async (): Promise<void> => {
      const map = mapRef.current;
      const camera = cameraRef.current;
      const loc = useLocationStore.getState().location;
      if (!map || !camera || !loc || !isMapReady.current) return;

      let bounds: Awaited<ReturnType<typeof map.getVisibleBounds>>;
      try {
        bounds = await map.getVisibleBounds();
      } catch {
        return;
      }
      // bounds is [northEast, southWest] as [lng, lat]
      const [ne, sw] = bounds;
      const outside =
        loc.lat > ne[1] || loc.lat < sw[1] || loc.lng > ne[0] || loc.lng < sw[0];
      if (!outside) return;

      const now = Date.now();
      if (now - lastRecenterAtRef.current < 500) return;
      lastRecenterAtRef.current = now;
      camera.flyTo([loc.lng, loc.lat], 500);
    }, []);

    useEffect(() => {
      void ensureUserVisible();
    }, [location?.lat, location?.lng, ensureUserVisible]);

    return (
      <View className="flex-1">
        <MapView
          ref={mapRef}
          style={RNStyleSheet.absoluteFillObject}
          mapStyle={MAP_STYLE_URL}
          logoEnabled={false}
          attributionEnabled
          compassEnabled={false}
          onDidFinishLoadingMap={() => {
            isMapReady.current = true;
          }}
          onRegionDidChange={() => {
            void ensureUserVisible();
          }}
          onPress={(feature) => {
            if (!onMapPress) return;
            const coords = (feature.geometry as GeoJSON.Point).coordinates;
            onMapPress({ latitude: coords[1], longitude: coords[0] });
          }}
        >
          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: center,
              zoomLevel: initialZoom ?? DEFAULT_ZOOM,
            }}
            animationMode="flyTo"
          />
          {location ? (
            <MarkerView
              id="player-position"
              coordinate={[location.lng, location.lat]}
              anchor={{ x: 0.5, y: 0.5 }}
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
            </MarkerView>
          ) : null}
          {children}
        </MapView>
      </View>
    );
  },
);

GameMap.displayName = 'GameMap';
