import { Injectable, Logger } from '@nestjs/common';

export interface PlayerLocationPayload {
  gameId: string;
  userId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  accuracy?: number | null;
  /** Epoch ms of the last update — used for stale entry eviction. */
  lastSeen: number;
}

@Injectable()
export class PlayerLocationService {
  private readonly logger = new Logger(PlayerLocationService.name);

  /** In-memory store of live player locations per game. */
  private readonly playerLocations = new Map<
    string, // gameId
    Map<string, PlayerLocationPayload> // userId → location
  >();

  /** Periodic cleanup interval for stale player locations. */
  private locationCleanupInterval?: ReturnType<typeof setInterval>;

  /** Entries older than this threshold (ms) are considered stale. */
  private static readonly LOCATION_STALE_MS = 120_000; // 2 minutes

  /** Callback to broadcast locations — set by the gateway. */
  private broadcastFn?: (gameId: string, players: PlayerLocationPayload[]) => void;

  onModuleInit(): void {
    this.locationCleanupInterval = setInterval(() => {
      const threshold = Date.now() - PlayerLocationService.LOCATION_STALE_MS;
      for (const [gameId, gameLocs] of this.playerLocations) {
        for (const [userId, loc] of gameLocs) {
          if (loc.lastSeen < threshold) {
            gameLocs.delete(userId);
          }
        }
        if (gameLocs.size === 0) {
          this.playerLocations.delete(gameId);
        } else {
          this.broadcastPlayerLocations(gameId);
        }
      }
    }, 30_000);
  }

  onModuleDestroy(): void {
    if (this.locationCleanupInterval) {
      clearInterval(this.locationCleanupInterval);
    }
  }

  setBroadcastFn(fn: (gameId: string, players: PlayerLocationPayload[]) => void): void {
    this.broadcastFn = fn;
  }

  /**
   * Store a location update and broadcast the full set to the game room.
   */
  handleLocationUpdate(location: PlayerLocationPayload): void {
    let gameLocs = this.playerLocations.get(location.gameId);
    if (!gameLocs) {
      gameLocs = new Map();
      this.playerLocations.set(location.gameId, gameLocs);
    }

    gameLocs.set(location.userId, { ...location, lastSeen: Date.now() });
    this.broadcastPlayerLocations(location.gameId);
  }

  /**
   * Remove a player's location on disconnect.
   */
  removePlayer(gameId: string, userId: string): void {
    const gameLocs = this.playerLocations.get(gameId);
    if (gameLocs) {
      gameLocs.delete(userId);
      if (gameLocs.size === 0) this.playerLocations.delete(gameId);
      this.broadcastPlayerLocations(gameId);
    }
  }

  /**
   * Get all player locations for a game.
   */
  getPlayers(gameId: string): PlayerLocationPayload[] {
    const gameLocs = this.playerLocations.get(gameId);
    return gameLocs ? Array.from(gameLocs.values()) : [];
  }

  private broadcastPlayerLocations(gameId: string): void {
    if (this.broadcastFn) {
      this.broadcastFn(gameId, this.getPlayers(gameId));
    }
  }
}
