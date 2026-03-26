import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { WS_URL, RANKING_WS_NAMESPACE } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { useRankingStore } from '@/stores/rankingStore';
import { useGameStore, type AiResult } from '@/stores/gameStore';
import type { RankingEntry } from '@/services/api';

interface WebSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  joinGame: (sessionId: string) => void;
  leaveGame: (sessionId: string) => void;
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

  const joinGame = (sessionId: string): void => {
    socketRef.current?.emit('game:join', { sessionId });
  };

  const leaveGame = (sessionId: string): void => {
    socketRef.current?.emit('game:leave', { sessionId });
  };

  return (
    <WebSocketContext.Provider
      value={{ socket: socketRef.current, isConnected, joinGame, leaveGame }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
