import { useEffect } from 'react';
import { useWebSocketContext } from '@/shared/providers/WebSocketProvider';

interface UseWebSocketReturn {
  isConnected: boolean;
  joinGame: (gameId: string) => void;
  leaveGame: (gameId: string) => void;
}

export const useWebSocket = (gameId?: string): UseWebSocketReturn => {
  const { isConnected, joinGame, leaveGame } = useWebSocketContext();

  useEffect(() => {
    if (!gameId) return;

    joinGame(gameId);

    return () => {
      leaveGame(gameId);
    };
  }, [gameId, joinGame, leaveGame]);

  return { isConnected, joinGame, leaveGame };
};
