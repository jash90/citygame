import React from 'react';
import { View, StyleSheet as RNStyleSheet } from 'react-native';
import MapView, { Marker, Circle, type Region } from 'react-native-maps';
import { useLocationStore } from '@/stores/locationStore';

interface GameMapProps {
  initialRegion?: Region;
  children?: React.ReactNode;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
}

const DEFAULT_REGION: Region = {
  latitude: 52.2297,
  longitude: 21.0122,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
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

export const GameMap = ({
  initialRegion,
  children,
  onMapPress,
}: GameMapProps): React.JSX.Element => {
  const { location, accuracy } = useLocationStore();

  const mapRegion: Region = location
    ? {
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: initialRegion?.latitudeDelta ?? 0.01,
        longitudeDelta: initialRegion?.longitudeDelta ?? 0.01,
      }
    : (initialRegion ?? DEFAULT_REGION);

  return (
    <View className="flex-1">
      <MapView
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
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 9999,
                  backgroundColor: '#FF6B35',
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 2,
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
};
