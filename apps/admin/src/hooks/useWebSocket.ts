'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getRankingSocket } from '@/lib/ws';
import type { Socket } from 'socket.io-client';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseWebSocketOptions {
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  socket: Socket | null;
  joinGame: (gameId: string) => void;
  leaveGame: (gameId: string) => void;
  emit: (event: string, data?: unknown) => void;
  onEvent: <T>(event: string, handler: (data: T) => void) => () => void;
  /** Increments when socket (re)connects so consumers can re-register listeners. */
  connectEpoch: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { autoConnect = true } = options;
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [connectEpoch, setConnectEpoch] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  // Reconnect attempt counter for backoff
  const reconnectAttempts = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    const socket = getRankingSocket();
    socketRef.current = socket;

    setStatus('connecting');
    socket.connect();

    const handleConnect = () => {
      setStatus('connected');
      setConnectEpoch((e) => e + 1);
      reconnectAttempts.current = 0;
    };

    const handleDisconnect = () => {
      setStatus('disconnected');

      // Exponential backoff: 1s, 2s, 4s, max 16s
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 16000);
      reconnectAttempts.current += 1;

      reconnectTimerRef.current = setTimeout(() => {
        if (!socket.connected) {
          setStatus('connecting');
          socket.connect();
        }
      }, delay);
    };

    const handleConnectError = () => {
      setStatus('disconnected');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
    };
  }, [autoConnect]);

  const joinGame = useCallback((gameId: string) => {
    socketRef.current?.emit('watch_game', { gameId });
  }, []);

  const leaveGame = useCallback((gameId: string) => {
    socketRef.current?.emit('unwatch_game', { gameId });
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const onEvent = useCallback(<T>(event: string, handler: (data: T) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  return {
    status,
    socket: socketRef.current,
    joinGame,
    leaveGame,
    emit,
    onEvent,
    connectEpoch,
  };
}
