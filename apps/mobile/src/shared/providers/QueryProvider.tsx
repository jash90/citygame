import React, { type ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createMmkvQueryPersister } from '@/shared/lib/storage/mmkv';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reuse cached data while offline — React Query will not throw on
      // missing network; queued queries resume when connectivity returns.
      networkMode: 'offlineFirst',
      staleTime: 1000 * 60 * 5,        // 5 min
      gcTime: 1000 * 60 * 60 * 24,     // 24 h — keep cache around for offline cold starts
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 0,
    },
  },
});

const persister = createMmkvQueryPersister();

interface QueryProviderProps {
  children: ReactNode;
}

export const QueryProvider = ({ children }: QueryProviderProps): React.JSX.Element => {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        // Bump this string to invalidate persisted cache after schema changes.
        buster: 'v1',
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
};
