import { create } from 'zustand';

interface Coordinates {
  lat: number;
  lng: number;
}

interface LocationState {
  location: Coordinates | null;
  heading: number | null;
  accuracy: number | null;
  hasPermission: boolean | null;
  // Actions
  setLocation: (coords: Coordinates, accuracy?: number) => void;
  setHeading: (heading: number) => void;
  setPermission: (granted: boolean) => void;
  reset: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  location: null,
  heading: null,
  accuracy: null,
  hasPermission: null,

  setLocation: (coords, accuracy) =>
    set({ location: coords, accuracy: accuracy ?? null }),

  setHeading: (heading) => set({ heading }),

  setPermission: (granted) => set({ hasPermission: granted }),

  reset: () =>
    set({ location: null, heading: null, accuracy: null }),
}));
