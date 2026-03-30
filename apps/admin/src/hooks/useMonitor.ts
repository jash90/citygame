'use client';

import { useEffect, useReducer, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import type { ConnectionStatus } from './useWebSocket';

export interface ActivityEntry {
  id: string;
  timestamp: Date;
  playerName: string;
  action: 'task_completed' | 'hint_used' | 'game_joined' | 'game_completed';
  details: string;
  points?: number;
}

export interface TaskProgressEntry {
  taskId: string;
  title: string;
  type: string;
  completions: number;
  total: number;
}

export interface AIErrorEntry {
  id: string;
  taskName: string;
  playerName: string;
  errorMessage: string;
  timestamp: Date;
}

export interface MonitorStats {
  activePlayers: number;
  totalCompletions: number;
  elapsedSeconds: number;
}

interface MonitorState {
  activities: ActivityEntry[];
  taskProgress: TaskProgressEntry[];
  aiErrors: AIErrorEntry[];
  stats: MonitorStats;
}

type MonitorAction =
  | { type: 'ADD_ACTIVITY'; payload: ActivityEntry }
  | { type: 'SET_TASK_PROGRESS'; payload: TaskProgressEntry[] }
  | { type: 'INCREMENT_TASK'; payload: { taskId: string } }
  | { type: 'ADD_AI_ERROR'; payload: AIErrorEntry }
  | { type: 'REMOVE_AI_ERROR'; payload: { id: string } }
  | { type: 'SET_STATS'; payload: Partial<MonitorStats> }
  | { type: 'INCREMENT_COMPLETIONS' }
  | { type: 'INCREMENT_PLAYERS' }
  | { type: 'TICK_ELAPSED' };

function monitorReducer(state: MonitorState, action: MonitorAction): MonitorState {
  switch (action.type) {
    case 'ADD_ACTIVITY':
      return {
        ...state,
        activities: [action.payload, ...state.activities].slice(0, 100),
      };

    case 'SET_TASK_PROGRESS':
      return { ...state, taskProgress: action.payload };

    case 'INCREMENT_TASK':
      return {
        ...state,
        taskProgress: state.taskProgress.map((t) =>
          t.taskId === action.payload.taskId
            ? { ...t, completions: t.completions + 1 }
            : t,
        ),
      };

    case 'ADD_AI_ERROR':
      return {
        ...state,
        aiErrors: [action.payload, ...state.aiErrors].slice(0, 50),
      };

    case 'REMOVE_AI_ERROR':
      return {
        ...state,
        aiErrors: state.aiErrors.filter((e) => e.id !== action.payload.id),
      };

    case 'SET_STATS':
      return { ...state, stats: { ...state.stats, ...action.payload } };

    case 'INCREMENT_COMPLETIONS':
      return {
        ...state,
        stats: { ...state.stats, totalCompletions: state.stats.totalCompletions + 1 },
      };

    case 'INCREMENT_PLAYERS':
      return {
        ...state,
        stats: { ...state.stats, activePlayers: state.stats.activePlayers + 1 },
      };

    case 'TICK_ELAPSED':
      return {
        ...state,
        stats: {
          ...state.stats,
          elapsedSeconds: state.stats.elapsedSeconds + 1,
        },
      };

    default:
      return state;
  }
}

interface UseMonitorOptions {
  gameId: string;
  startedAt?: string;
  initialPlayerCount?: number;
}

interface UseMonitorReturn {
  activities: ActivityEntry[];
  taskProgress: TaskProgressEntry[];
  aiErrors: AIErrorEntry[];
  stats: MonitorStats;
  connectionStatus: ConnectionStatus;
  retryAIError: (errorId: string) => void;
  setTaskProgress: (tasks: TaskProgressEntry[]) => void;
}

export function useMonitor({
  gameId,
  startedAt,
  initialPlayerCount = 0,
}: UseMonitorOptions): UseMonitorReturn {
  const [state, dispatch] = useReducer(monitorReducer, {
    activities: [],
    taskProgress: [],
    aiErrors: [],
    stats: {
      activePlayers: initialPlayerCount,
      totalCompletions: 0,
      elapsedSeconds: startedAt
        ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
        : 0,
    },
  });

  const { status, joinGame, leaveGame, onEvent, connectEpoch } = useWebSocket();

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
          timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        },
      });

      if (action === 'task_completed') {
        dispatch({ type: 'INCREMENT_COMPLETIONS' });
      }
      if (action === 'game_joined') {
        dispatch({ type: 'INCREMENT_PLAYERS' });
      }
    });

    const offTaskComplete = onEvent<{ taskId: string }>('task_completed', ({ taskId }) => {
      dispatch({ type: 'INCREMENT_TASK', payload: { taskId } });
    });

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

    const offPlayerCount = onEvent<{ count: number }>('player_count', ({ count }) => {
      dispatch({ type: 'SET_STATS', payload: { activePlayers: count } });
    });

    return () => {
      offActivity();
      offTaskComplete();
      offAiError();
      offPlayerCount();
    };
  }, [onEvent, connectEpoch]);

  const retryAIError = useCallback((errorId: string) => {
    dispatch({ type: 'REMOVE_AI_ERROR', payload: { id: errorId } });
  }, []);

  const setTaskProgress = useCallback((tasks: TaskProgressEntry[]) => {
    dispatch({ type: 'SET_TASK_PROGRESS', payload: tasks });
  }, []);

  return {
    activities: state.activities,
    taskProgress: state.taskProgress,
    aiErrors: state.aiErrors,
    stats: state.stats,
    connectionStatus: status,
    retryAIError,
    setTaskProgress,
  };
}
