import { useEffect } from 'react';
import { useWebSocketContext } from '@/providers/WebSocketProvider';

interface UseWebSocketReturn {
  isConnected: boolean;
  joinGame: (sessionId: string) => void;
  leaveGame: (sessionId: string) => void;
}

export const useWebSocket = (sessionId?: string): UseWebSocketReturn => {
  const { isConnected, joinGame, leaveGame } = useWebSocketContext();

  useEffect(() => {
    if (!sessionId) return;

    joinGame(sessionId);

    return () => {
      leaveGame(sessionId);
    };
  }, [sessionId, joinGame, leaveGame]);

  return { isConnected, joinGame, leaveGame };
};
