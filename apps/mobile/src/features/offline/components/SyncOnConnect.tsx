import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useIsOnline } from '@/shared/providers/NetworkProvider';
import { SyncRunner } from '@/features/offline/services/syncService';

/**
 * Headless component: drains the mutation queue whenever the app becomes
 * usable. Mounted once at the root layout, never renders anything.
 *
 * Triggers:
 *  - online transition (offline → online)
 *  - foreground transition (background → active)
 *  - on initial mount, if already online + active
 */
export const SyncOnConnect = (): null => {
  const isOnline = useIsOnline();
  const wasOnline = useRef(isOnline);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Online transition.
    if (isOnline && !wasOnline.current) {
      void SyncRunner.flush();
    }
    wasOnline.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    // Initial flush — covers cold starts where we boot already online.
    if (isOnline && AppState.currentState === 'active') {
      void SyncRunner.flush();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      appState.current = next;
      if (prev !== 'active' && next === 'active' && isOnline) {
        void SyncRunner.flush();
      }
    });
    return () => sub.remove();
  }, [isOnline]);

  return null;
};
