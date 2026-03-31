import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RankEntry, TeamRankEntry } from './ranking.service';

export interface RankingUpdatePayload {
  gameId: string;
  ranking: RankEntry[];
}

export interface PlayerCompletedTaskPayload {
  gameId: string;
  userId: string;
  taskId: string;
  pointsAwarded: number;
  totalPoints: number;
}

export interface AiResultPayload {
  attemptId: string;
  userId: string;
  status: string;
  score?: number;
  feedback?: string;
}

export interface ActivityPayload {
  type: string;
  playerName: string;
  details: string;
  points?: number;
  taskId?: string;
}

export interface TeamUpdatePayload {
  gameId: string;
  teamId: string;
  teamName: string;
  ranking: TeamRankEntry[];
}

export interface PlayerLocationPayload {
  gameId: string;
  userId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  accuracy?: number | null;
}

@WebSocketGateway({
  namespace: '/ranking',
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3002')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  },
})
export class RankingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RankingGateway.name);

  /** In-memory store of live player locations per game. */
  private readonly playerLocations = new Map<
    string, // gameId
    Map<string, PlayerLocationPayload> // userId → location
  >();

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected to ranking gateway: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected from ranking gateway: ${client.id}`);

    // Clean up player location data when a client disconnects
    const userId = (client as Socket & { _locationUserId?: string })._locationUserId;
    const gameId = (client as Socket & { _locationGameId?: string })._locationGameId;
    if (userId && gameId) {
      const gameLocs = this.playerLocations.get(gameId);
      if (gameLocs) {
        gameLocs.delete(userId);
        if (gameLocs.size === 0) this.playerLocations.delete(gameId);
        this.broadcastPlayerLocations(gameId);
      }
    }
  }

  /**
   * Client joins the ranking room for a specific game.
   */
  @SubscribeMessage('join-game')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ): void {
    const room = `game:${data.gameId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
  }

  /**
   * Client leaves the ranking room for a specific game.
   */
  @SubscribeMessage('leave-game')
  handleLeaveGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ): void {
    const room = `game:${data.gameId}`;
    void client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
  }

  /**
   * Broadcast updated ranking to all clients watching a game.
   * Called by PlayerService after a successful answer.
   */
  broadcastRankingUpdate(gameId: string, ranking: RankEntry[]): void {
    const payload: RankingUpdatePayload = { gameId, ranking };
    this.server.to(`game:${gameId}`).emit('ranking:update', payload);
  }

  /**
   * Broadcast task completion event for real-time feed.
   */
  broadcastPlayerCompletedTask(payload: PlayerCompletedTaskPayload): void {
    this.server
      .to(`game:${payload.gameId}`)
      .emit('player-completed-task', payload);
  }

  /**
   * Broadcast the result of an AI verification to all clients in the game room.
   * The mobile client uses this to display real-time feedback without polling.
   */
  broadcastAiResult(gameId: string, payload: AiResultPayload): void {
    this.server.to(`game:${gameId}`).emit('ai:result', payload);
  }

  /**
   * Broadcast a general activity event for admin monitoring and activity feeds.
   * Covers: task completed, hint used, game joined, etc.
   */
  broadcastActivity(gameId: string, payload: ActivityPayload): void {
    this.server.to(`game:${gameId}`).emit('activity', {
      ...payload,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Receive live location updates from mobile players and rebroadcast
   * the full player location set to admin clients watching the game room.
   */
  @SubscribeMessage('location:update')
  handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      gameId: string;
      userId: string;
      displayName: string;
      latitude: number;
      longitude: number;
      heading?: number | null;
      accuracy?: number | null;
    },
  ): void {
    if (!data.gameId || !data.userId) return;

    // Store reference on socket for cleanup on disconnect
    (client as Socket & { _locationUserId?: string })._locationUserId = data.userId;
    (client as Socket & { _locationGameId?: string })._locationGameId = data.gameId;

    let gameLocs = this.playerLocations.get(data.gameId);
    if (!gameLocs) {
      gameLocs = new Map();
      this.playerLocations.set(data.gameId, gameLocs);
    }

    gameLocs.set(data.userId, {
      gameId: data.gameId,
      userId: data.userId,
      displayName: data.displayName,
      latitude: data.latitude,
      longitude: data.longitude,
      heading: data.heading,
      accuracy: data.accuracy,
    });

    this.broadcastPlayerLocations(data.gameId);
  }

  /**
   * Broadcast all known player locations to admin clients watching a game.
   */
  broadcastPlayerLocations(gameId: string): void {
    const gameLocs = this.playerLocations.get(gameId);
    const players = gameLocs ? Array.from(gameLocs.values()) : [];
    this.server.to(`game:${gameId}`).emit('player:locations', { gameId, players });
  }

  /**
   * Broadcast team ranking update to all clients watching the game room
   * and specifically to the team's private room.
   */
  broadcastTeamUpdate(gameId: string, payload: TeamUpdatePayload): void {
    this.server.to(`game:${gameId}`).emit('team:ranking:update', payload);
    this.server.to(`team:${payload.teamId}`).emit('team:ranking:update', payload);
  }

  /**
   * Client joins the team room to receive notifications specific to their team.
   */
  @SubscribeMessage('join-team-room')
  handleJoinTeamRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { teamId: string },
  ): void {
    const room = `team:${data.teamId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined team room ${room}`);
  }

  /**
   * Client leaves the team room.
   */
  @SubscribeMessage('leave-team-room')
  handleLeaveTeamRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { teamId: string },
  ): void {
    const room = `team:${data.teamId}`;
    void client.leave(room);
    this.logger.log(`Client ${client.id} left team room ${room}`);
  }
}
