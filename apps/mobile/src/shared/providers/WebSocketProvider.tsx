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
import { useQueryClient } from '@tanstack/react-query';
import { WS_URL, RANKING_WS_NAMESPACE, QUERY_KEYS } from '@/shared/lib/constants';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useRankingStore } from '@/features/ranking/stores/rankingStore';
import { useGameStore, type AiResult } from '@/features/game/stores/gameStore';
import { useLocationStore } from '@/features/map/stores/locationStore';
import { useLocationWatcher } from '@/features/map/hooks/useLocation';
import type { RankingEntry } from '@/shared/types/api.types';

/** Server-side payload from RankingGateway.broadcastMentorReviewResult. */
interface MentorReviewResultEvent {
  attemptId: string;
  userId: string;
  taskId: string;
  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL';
  pointsAwarded: number;
  feedback: string;
}

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
  const currentGameId = useGameStore((s) => s.currentGame?.id ?? null);
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  useLocationWatcher({ enabled: isAuthenticated && Boolean(currentGameId) });

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
      // Re-emit join-game on every (re)connect so post-disconnect ranking
      // hydration always lands. The downstream `ranking:snapshot` handler
      // refreshes the persisted last-known entries.
      const reconnectGameId = useGameStore.getState().currentGame?.id ?? null;
      if (reconnectGameId) {
        socket.emit('join-game', { gameId: reconnectGameId });
      }
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

    // Mentor finalised a PRACTICAL approval for somebody in this game room.
    // If it's for us, surface it as an "AI result"-style payload (the
    // existing useTaskDetail listener already auto-navigates on lastAiResult)
    // and invalidate cached progress + task list so the next-task pointer
    // and points update without a manual refresh.
    socket.on('mentor:review-result', (data: MentorReviewResultEvent) => {
      if (!currentUserId || data.userId !== currentUserId) return;
      setLastAiResult({
        attemptId: data.attemptId,
        status: data.status,
        score: data.pointsAwarded > 0 ? 1 : 0,
        feedback: data.feedback,
      });
      if (currentGameId) {
        void queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.GAME(currentGameId),
        });
        void queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.TASKS(currentGameId),
        });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setLive(false);
    };
  }, [isAuthenticated, tokens?.accessToken]);

  // Broadcast live location to backend every 5 seconds while in a game
  const activeGameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected || !currentGameId) return;
    activeGameRef.current = currentGameId;

    // Join the game room so the backend associates this socket with the game
    socketRef.current?.emit('join-game', { gameId: currentGameId });

    const emitLocation = (): void => {
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
    };

    emitLocation();
    const intervalId = setInterval(emitLocation, 5000);

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
