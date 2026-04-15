import { Logger, OnModuleDestroy, OnModuleInit, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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
import { RankEntry } from './ranking.service';
import { TeamRankEntry } from './team-ranking.service';
import { createWsJwtMiddleware, type WsUser } from './ws-jwt.middleware';
import { JoinGameWsDto } from './dto/join-game.ws.dto';
import { LocationUpdateWsDto } from './dto/location-update.ws.dto';
import { matchesOrigin } from '../../common/utils/cors';
import { PlayerLocationService } from './player-location.service';

/**
 * Env reader for CORS — evaluated at decorator time, before DI is available.
 * This is infrastructure-level config (not business logic), so direct env
 * access is acceptable here. The DIP rule applies to business-logic services.
 */
const corsGetEnv = (key: string): string | undefined => process.env[key];

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

@WebSocketGateway({
  namespace: '/ranking',
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (matchesOrigin(origin, corsGetEnv)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  },
})
export class RankingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RankingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly playerLocationService: PlayerLocationService,
  ) {}

  onModuleInit(): void {
    if (!this.server) {
      this.logger.error('WebSocket server not available at onModuleInit — JWT middleware NOT registered');
    } else {
      this.server.use(createWsJwtMiddleware(this.jwtService, this.configService));
    }

    // Wire the location service's broadcast to our WS server
    this.playerLocationService.setBroadcastFn((gameId, players) => {
      this.server.to(`game:${gameId}`).emit('player:locations', { gameId, players });
    });
    this.playerLocationService.onModuleInit();
  }

  onModuleDestroy(): void {
    this.playerLocationService.onModuleDestroy();
  }

  handleConnection(client: Socket): void {
    const user = client.data.user as WsUser | undefined;
    this.logger.log(`Client connected to ranking gateway: ${client.id} (user: ${user?.id ?? 'anonymous'})`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected from ranking gateway: ${client.id}`);

    const userId = (client as Socket & { _locationUserId?: string })._locationUserId;
    const gameId = (client as Socket & { _locationGameId?: string })._locationGameId;
    if (userId && gameId) {
      this.playerLocationService.removePlayer(gameId, userId);
    }
  }

  @UsePipes(ValidationPipe)
  @SubscribeMessage('join-game')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinGameWsDto,
  ): void {
    const room = `game:${data.gameId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
  }

  @UsePipes(ValidationPipe)
  @SubscribeMessage('leave-game')
  handleLeaveGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinGameWsDto,
  ): void {
    const room = `game:${data.gameId}`;
    void client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
  }

  broadcastRankingUpdate(gameId: string, ranking: RankEntry[]): void {
    const payload: RankingUpdatePayload = { gameId, ranking };
    this.server.to(`game:${gameId}`).emit('ranking:update', payload);
  }

  broadcastPlayerCompletedTask(payload: PlayerCompletedTaskPayload): void {
    this.server
      .to(`game:${payload.gameId}`)
      .emit('player-completed-task', payload);
  }

  broadcastAiResult(gameId: string, payload: AiResultPayload): void {
    this.server.to(`game:${gameId}`).emit('ai:result', payload);
  }

  broadcastActivity(gameId: string, payload: ActivityPayload): void {
    this.server.to(`game:${gameId}`).emit('activity', {
      ...payload,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    });
  }

  @UsePipes(ValidationPipe)
  @SubscribeMessage('location:update')
  handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationUpdateWsDto,
  ): void {
    if (!data.gameId || !data.userId) return;

    const wsUser = client.data.user as WsUser | undefined;
    if (!wsUser || data.userId !== wsUser.id) {
      this.logger.warn(
        `Location update rejected: socket user ${wsUser?.id ?? 'unauthenticated'} tried to send for ${data.userId}`,
      );
      return;
    }

    (client as Socket & { _locationUserId?: string })._locationUserId = data.userId;
    (client as Socket & { _locationGameId?: string })._locationGameId = data.gameId;

    this.playerLocationService.handleLocationUpdate({
      gameId: data.gameId,
      userId: data.userId,
      displayName: data.displayName,
      latitude: data.latitude,
      longitude: data.longitude,
      heading: data.heading,
      accuracy: data.accuracy,
      lastSeen: Date.now(),
    });
  }

  broadcastTeamUpdate(gameId: string, payload: TeamUpdatePayload): void {
    this.server.to(`game:${gameId}`).emit('team:ranking:update', payload);
    this.server.to(`team:${payload.teamId}`).emit('team:ranking:update', payload);
  }

  @SubscribeMessage('join-team-room')
  handleJoinTeamRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { teamId: string },
  ): void {
    const room = `team:${data.teamId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined team room ${room}`);
  }

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
