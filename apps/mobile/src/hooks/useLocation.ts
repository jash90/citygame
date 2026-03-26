import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useLocationStore } from '@/stores/locationStore';

interface UseLocationReturn {
  location: { lat: number; lng: number } | null;
  heading: number | null;
  accuracy: number | null;
  hasPermission: boolean | null;
  requestPermission: () => Promise<boolean>;
}

export const useLocation = (): UseLocationReturn => {
  const { location, heading, accuracy, hasPermission, setLocation, setHeading, setPermission } =
    useLocationStore();

  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const headingWatcherRef = useRef<Location.LocationSubscription | null>(null);

  const requestPermission = async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === Location.PermissionStatus.GRANTED;
    setPermission(granted);
    return granted;
  };

  useEffect(() => {
    let mounted = true;

    const startWatching = async (): Promise<void> => {
      const { status } = await Location.getForegroundPermissionsAsync();
      const granted = status === Location.PermissionStatus.GRANTED;

      if (!mounted) return;
      setPermission(granted);

      if (!granted) return;

      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (loc) => {
          if (!mounted) return;
          setLocation(
            { lat: loc.coords.latitude, lng: loc.coords.longitude },
            loc.coords.accuracy ?? undefined,
          );
        },
      );

      headingWatcherRef.current = await Location.watchHeadingAsync((h) => {
        if (!mounted) return;
        setHeading(h.trueHeading ?? h.magHeading);
      });
    };

    void startWatching();

    return () => {
      mounted = false;
      watcherRef.current?.remove();
      headingWatcherRef.current?.remove();
    };
  }, [setLocation, setHeading, setPermission]);

  return { location, heading, accuracy, hasPermission, requestPermission };
};
