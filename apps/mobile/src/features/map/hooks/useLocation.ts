import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useLocationStore } from '@/features/map/stores/locationStore';

interface UseLocationReturn {
  location: { lat: number; lng: number } | null;
  heading: number | null;
  accuracy: number | null;
  hasPermission: boolean | null;
  requestPermission: () => Promise<boolean>;
}

interface UseLocationOptions {
  watch?: boolean;
}

interface UseLocationWatcherOptions {
  enabled?: boolean;
}

export const useLocationWatcher = ({
  enabled = true,
}: UseLocationWatcherOptions = {}): void => {
  const setLocation = useLocationStore((s) => s.setLocation);
  const setHeading = useLocationStore((s) => s.setHeading);
  const setPermission = useLocationStore((s) => s.setPermission);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const headingWatcherRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;

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
  }, [enabled, setLocation, setHeading, setPermission]);
};

export const useLocation = ({
  watch = true,
}: UseLocationOptions = {}): UseLocationReturn => {
  const { location, heading, accuracy, hasPermission, setPermission } =
    useLocationStore();

  useLocationWatcher({ enabled: watch });

  const requestPermission = async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === Location.PermissionStatus.GRANTED;
    setPermission(granted);
    return granted;
  };

  return { location, heading, accuracy, hasPermission, requestPermission };
};
