/**
 * Canonical GameSettings interface for the backend.
 * Mirrors @citygame/shared GameSettings — kept in sync manually to avoid
 * rootDir issues with the shared package's source alias in tsconfig.
 */
export interface GameSettings {
  maxPlayers?: number;
  timeLimitMinutes?: number;
  allowLateJoin?: boolean;
  allowHints?: boolean;
  teamMode?: boolean;
  minTeamSize?: number;
  maxTeamSize?: number;
  pinRevealDistanceMeters?: number;
  narrative?: {
    isNarrative?: boolean;
    theme?: string;
    prologue?: string;
    epilogue?: string;
  };
}
