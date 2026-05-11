import { io, Socket } from 'socket.io-client';
import { PlayerData } from '../types';

export interface NetworkHandlers {
  onCurrentPlayers: (players: Record<string, PlayerData>) => void;
  onNewPlayer: (player: PlayerData) => void;
  onPlayerMoved: (player: PlayerData) => void;
  onUserDisconnected: (id: string) => void;
}

export class NetworkClient {
  private socket: Socket;

  constructor(url: string, handlers: NetworkHandlers) {
    // Empty URL → socket.io connects to the page's origin (same-origin setup).
    this.socket = url ? io(url) : io();
    this.socket.on('currentPlayers', handlers.onCurrentPlayers);
    this.socket.on('newPlayer', handlers.onNewPlayer);
    this.socket.on('playerMoved', handlers.onPlayerMoved);
    this.socket.on('userDisconnected', handlers.onUserDisconnected);
  }

  get id(): string | undefined {
    return this.socket.id;
  }

  sendPosition(x: number, y: number): void {
    this.socket.emit('playerMovement', { x, y });
  }
}
