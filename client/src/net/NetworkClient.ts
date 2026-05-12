import { io, Socket } from 'socket.io-client';
import type {
  JoinRejectedPayload,
  JoinedPayload,
  StateUpdate,
} from '../types';

export interface NetworkHandlers {
  onJoined: (payload: JoinedPayload) => void;
  onJoinRejected: (payload: JoinRejectedPayload) => void;
  onState: (update: StateUpdate) => void;
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
    this.socket.on('state', handlers.onState);
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
