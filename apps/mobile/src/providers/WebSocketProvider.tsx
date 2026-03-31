import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { WS_URL, RANKING_WS_NAMESPACE } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { useRankingStore } from '@/stores/rankingStore';
import { useGameStore, type AiResult } from '@/stores/gameStore';
import { useLocationStore } from '@/stores/locationStore';
import type { RankingEntry } from '@/services/api';

interface WebSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  joinGame: (gameId: string) => void;
  leaveGame: (gameId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  socket: null,
  isConnected: false,
  joinGame: () => undefined,
  leaveGame: () => undefined,
});

export const useWebSocketContext = (): WebSocketContextValue =>
  useContext(WebSocketContext);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider = ({
  children,
}: WebSocketProviderProps): React.JSX.Element => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { tokens, isAuthenticated } = useAuthStore();
  const { setRanking, updateRanking, setLive } = useRankingStore();
  const { setLastAiResult } = useGameStore();

  useEffect(() => {
    if (!isAuthenticated || !tokens?.accessToken) {
      socketRef.current?.disconnect();
      return;
    }

    const socket = io(`${WS_URL}${RANKING_WS_NAMESPACE}`, {
      auth: { token: tokens.accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setLive(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setLive(false);
    });

    socket.on('ranking:snapshot', (entries: RankingEntry[]) => {
      setRanking(entries);
    });

    socket.on('ranking:update', (entries: RankingEntry[]) => {
      updateRanking(entries);
    });

    socket.on('ai:result', (data: AiResult) => {
      setLastAiResult(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setLive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, tokens?.accessToken]);

  // Broadcast live location to backend every 5 seconds while in a game
  const activeGameRef = useRef<string | null>(null);
  const currentGameId = useGameStore((s) => s.currentGame?.id ?? null);

  useEffect(() => {
    if (!isConnected || !currentGameId) return;
    activeGameRef.current = currentGameId;

    // Join the game room so the backend associates this socket with the game
    socketRef.current?.emit('join-game', { gameId: currentGameId });

    const intervalId = setInterval(() => {
      const loc = useLocationStore.getState().location;
      const heading = useLocationStore.getState().heading;
      const accuracy = useLocationStore.getState().accuracy;
      const user = useAuthStore.getState().user;
      if (!loc || !user || !activeGameRef.current) return;

      socketRef.current?.emit('location:update', {
        gameId: activeGameRef.current,
        userId: user.id,
        displayName: user.displayName ?? user.email,
        latitude: loc.lat,
        longitude: loc.lng,
        heading,
        accuracy,
      });
    }, 5000);

    return () => {
      clearInterval(intervalId);
      socketRef.current?.emit('leave-game', { gameId: currentGameId });
      activeGameRef.current = null;
    };
  }, [isConnected, currentGameId]);

  const joinGame = useCallback((gameId: string): void => {
    socketRef.current?.emit('join-game', { gameId });
  }, []);

  const leaveGame = useCallback((gameId: string): void => {
    socketRef.current?.emit('leave-game', { gameId });
  }, []);

  return (
    <WebSocketContext.Provider
      value={{ socket: socketRef.current, isConnected, joinGame, leaveGame }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
