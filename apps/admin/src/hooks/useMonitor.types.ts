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

export interface PlayerLocation {
  userId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  accuracy?: number | null;
}

export interface MonitorStats {
  activePlayers: number;
  totalCompletions: number;
  elapsedSeconds: number;
}

export interface MonitorState {
  activities: ActivityEntry[];
  taskProgress: TaskProgressEntry[];
  aiErrors: AIErrorEntry[];
  playerLocations: PlayerLocation[];
  stats: MonitorStats;
}

export type MonitorAction =
  | { type: 'ADD_ACTIVITY'; payload: ActivityEntry }
  | { type: 'SET_ACTIVITIES'; payload: ActivityEntry[] }
  | { type: 'SET_TASK_PROGRESS'; payload: TaskProgressEntry[] }
  | { type: 'INCREMENT_TASK'; payload: { taskId: string } }
  | { type: 'ADD_AI_ERROR'; payload: AIErrorEntry }
  | { type: 'REMOVE_AI_ERROR'; payload: { id: string } }
  | { type: 'SET_STATS'; payload: Partial<MonitorStats> }
  | { type: 'SET_PLAYER_LOCATIONS'; payload: PlayerLocation[] }
  | { type: 'INCREMENT_COMPLETIONS' }
  | { type: 'INCREMENT_PLAYERS' }
  | { type: 'TICK_ELAPSED' };

export function monitorReducer(
  state: MonitorState,
  action: MonitorAction,
): MonitorState {
  switch (action.type) {
    case 'ADD_ACTIVITY':
      return {
        ...state,
        activities: [action.payload, ...state.activities].slice(0, 100),
      };

    case 'SET_ACTIVITIES':
      return {
        ...state,
        activities: action.payload.slice(0, 100),
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

    case 'SET_PLAYER_LOCATIONS':
      return { ...state, playerLocations: action.payload };

    case 'INCREMENT_COMPLETIONS':
      return {
        ...state,
        stats: {
          ...state.stats,
          totalCompletions: state.stats.totalCompletions + 1,
        },
      };

    case 'INCREMENT_PLAYERS':
      return {
        ...state,
        stats: {
          ...state.stats,
          activePlayers: state.stats.activePlayers + 1,
        },
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
