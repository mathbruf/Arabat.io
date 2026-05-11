import { io, Socket } from 'socket.io-client';
import type {
  BulletData,
  JoinRejectedPayload,
  JoinedPayload,
  PlayerData,
  TickPayload,
} from '../types';

export interface NetworkHandlers {
  onJoined: (payload: JoinedPayload) => void;
  onJoinRejected: (payload: JoinRejectedPayload) => void;
  onNewPlayer: (player: PlayerData) => void;
  onTick: (payload: TickPayload) => void;
  onUserDisconnected: (id: string) => void;
  onBulletSpawned: (bullet: BulletData) => void;
  onPlayerRespawned: (player: PlayerData) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export class NetworkClient {
  private socket: Socket;

  constructor(url: string, handlers: NetworkHandlers) {
    this.socket = url ? io(url) : io();
    this.socket.on('connect', handlers.onConnect);
    this.socket.on('disconnect', handlers.onDisconnect);
    this.socket.on('joined', handlers.onJoined);
    this.socket.on('joinRejected', handlers.onJoinRejected);
    this.socket.on('newPlayer', handlers.onNewPlayer);
    this.socket.on('tick', handlers.onTick);
    this.socket.on('userDisconnected', handlers.onUserDisconnected);
    this.socket.on('bulletSpawned', handlers.onBulletSpawned);
    this.socket.on('playerRespawned', handlers.onPlayerRespawned);
  }

  get id(): string | undefined {
    return this.socket.id;
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  join(name: string): void {
    this.socket.emit('join', { name });
  }

  sendPosition(x: number, y: number): void {
    this.socket.emit('playerMovement', { x, y });
  }

  shoot(dx: number, dy: number): void {
    this.socket.emit('shoot', { dx, dy });
  }

  respawn(name: string): void {
    this.socket.emit('respawn', { name });
  }

  leaveGame(): void {
    this.socket.emit('leaveGame');
  }
}
