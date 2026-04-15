'use client';

import { useEffect, useReducer, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import type { ConnectionStatus } from './useWebSocket';
import {
  monitorReducer,
  type ActivityEntry,
  type TaskProgressEntry,
  type AIErrorEntry,
  type PlayerLocation,
  type MonitorStats,
} from './useMonitor.types';

export type {
  ActivityEntry,
  TaskProgressEntry,
  AIErrorEntry,
  PlayerLocation,
  MonitorStats,
};

interface UseMonitorOptions {
  gameId: string;
  startedAt?: string;
  initialPlayerCount?: number;
  initialCompletions?: number;
}

interface UseMonitorReturn {
  activities: ActivityEntry[];
  taskProgress: TaskProgressEntry[];
  aiErrors: AIErrorEntry[];
  playerLocations: PlayerLocation[];
  stats: MonitorStats;
  connectionStatus: ConnectionStatus;
  retryAIError: (errorId: string) => void;
  setTaskProgress: (tasks: TaskProgressEntry[]) => void;
  setActivities: (activities: ActivityEntry[]) => void;
}

export function useMonitor({
  gameId,
  startedAt,
  initialPlayerCount = 0,
  initialCompletions = 0,
}: UseMonitorOptions): UseMonitorReturn {
  const [state, dispatch] = useReducer(monitorReducer, {
    activities: [],
    taskProgress: [],
    aiErrors: [],
    playerLocations: [],
    stats: {
      activePlayers: initialPlayerCount,
      totalCompletions: initialCompletions,
      elapsedSeconds: startedAt
        ? Math.floor(
            (Date.now() - new Date(startedAt).getTime()) / 1000,
          )
        : 0,
    },
  });

  const { status, joinGame, leaveGame, onEvent, connectEpoch } =
    useWebSocket();

  // Sync initial stats when async data arrives
  useEffect(() => {
    if (initialPlayerCount > 0 || initialCompletions > 0) {
      dispatch({
        type: 'SET_STATS',
        payload: {
          activePlayers: initialPlayerCount,
          totalCompletions: initialCompletions,
        },
      });
    }
  }, [initialPlayerCount, initialCompletions]);

  useEffect(() => {
    if (startedAt) {
      dispatch({
        type: 'SET_STATS',
        payload: {
          elapsedSeconds: Math.floor(
            (Date.now() - new Date(startedAt).getTime()) / 1000,
          ),
        },
      });
    }
  }, [startedAt]);

  // Elapsed timer tick
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: 'TICK_ELAPSED' });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Join game room when connected
  useEffect(() => {
    if (status === 'connected') {
      joinGame(gameId);
    }
    return () => {
      if (status === 'connected') leaveGame(gameId);
    };
  }, [status, gameId, joinGame, leaveGame]);

  // Subscribe to WebSocket events
  useEffect(() => {
    const offActivity = onEvent<{
      id?: string;
      playerName: string;
      type: string;
      action?: ActivityEntry['action'];
      details: string;
      points?: number;
      taskId?: string;
      timestamp?: string;
    }>('activity', (event) => {
      const action = (event.action ?? event.type) as ActivityEntry['action'];
      dispatch({
        type: 'ADD_ACTIVITY',
        payload: {
          id: event.id ?? crypto.randomUUID(),
          playerName: event.playerName,
          action,
          details: event.details,
          points: event.points,
          timestamp: event.timestamp
            ? new Date(event.timestamp)
            : new Date(),
        },
      });

      if (action === 'task_completed') {
        dispatch({ type: 'INCREMENT_COMPLETIONS' });
        if (event.taskId) {
          dispatch({
            type: 'INCREMENT_TASK',
            payload: { taskId: event.taskId },
          });
        }
      }
      if (action === 'game_joined') {
        dispatch({ type: 'INCREMENT_PLAYERS' });
      }
    });

    const offTaskComplete = onEvent<{ taskId: string }>(
      'task_completed',
      ({ taskId }) => {
        dispatch({ type: 'INCREMENT_TASK', payload: { taskId } });
      },
    );

    const offAiError = onEvent<{
      id: string;
      taskName: string;
      playerName: string;
      errorMessage: string;
      timestamp: string;
    }>('ai_error', (event) => {
      dispatch({
        type: 'ADD_AI_ERROR',
        payload: { ...event, timestamp: new Date(event.timestamp) },
      });
    });

    const offPlayerCount = onEvent<{ count: number }>(
      'player_count',
      ({ count }) => {
        dispatch({ type: 'SET_STATS', payload: { activePlayers: count } });
      },
    );

    const offPlayerLocations = onEvent<{
      players: PlayerLocation[];
    }>('player:locations', ({ players }) => {
      dispatch({ type: 'SET_PLAYER_LOCATIONS', payload: players });
    });

    return () => {
      offActivity();
      offTaskComplete();
      offAiError();
      offPlayerCount();
      offPlayerLocations();
    };
  }, [onEvent, connectEpoch]);

  const retryAIError = useCallback((errorId: string) => {
    dispatch({ type: 'REMOVE_AI_ERROR', payload: { id: errorId } });
  }, []);

  const setTaskProgress = useCallback(
    (tasks: TaskProgressEntry[]) => {
      dispatch({ type: 'SET_TASK_PROGRESS', payload: tasks });
    },
    [],
  );

  const setActivities = useCallback(
    (activities: ActivityEntry[]) => {
      dispatch({ type: 'SET_ACTIVITIES', payload: activities });
    },
    [],
  );

  return {
    activities: state.activities,
    taskProgress: state.taskProgress,
    aiErrors: state.aiErrors,
    playerLocations: state.playerLocations,
    stats: state.stats,
    connectionStatus: status,
    retryAIError,
    setTaskProgress,
    setActivities,
  };
}
