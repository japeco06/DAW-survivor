import { io, Socket } from 'socket.io-client';
import type { CharacterId, GameMode } from '../systems/MetaSystem';
import type {
  CoopGameEventPayload,
  CoopLevelUpPayload,
  CoopWorldSnapshot,
  PeerInputPayload,
  PublicRoomSummary,
  RoomStateDTO,
  SerializedUpgradeCard,
} from './MultiplayerTypes';

const SERVER_URL_STORAGE_KEY = 'cyber_survivor_mp_server_v1';

// URL por defecto en producción si se compila con VITE_MULTIPLAYER_URL
const ENV_SERVER_URL: string = (import.meta as any).env?.VITE_MULTIPLAYER_URL || '';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export class MultiplayerClient {
  private socket: Socket | null = null;
  private pingTimer: number | null = null;

  public status: ConnectionStatus = 'DISCONNECTED';
  public statusMessage: string = '';
  public serverUrl: string = '';
  public latencyMs: number = 0;
  public room: RoomStateDTO | null = null;
  public publicRooms: PublicRoomSummary[] = [];

  public onRoomUpdate: ((room: RoomStateDTO | null) => void) | null = null;
  public onMatchStart: ((room: RoomStateDTO) => void) | null = null;
  public onPeerInput: ((input: PeerInputPayload) => void) | null = null;
  public onSnapshot: ((snapshot: CoopWorldSnapshot) => void) | null = null;
  public onLevelUp: ((payload: CoopLevelUpPayload) => void) | null = null;
  public onPeerPickUpgrade: ((data: { playerId: string; index: number }) => void) | null = null;
  public onPeerRerollRequest: ((data: { playerId: string }) => void) | null = null;
  public onRerollResult: ((data: {
    targetId: string;
    choices: SerializedUpgradeCard[];
    rerollsRemaining: number;
  }) => void) | null = null;
  public onUpgradeStatus: ((data: { readyCount: number; totalCount: number }) => void) | null = null;
  public onResumeFromUpgrade: (() => void) | null = null;
  public onGameEvent: ((evt: CoopGameEventPayload) => void) | null = null;
  public onReturnedToLobby: ((room: RoomStateDTO) => void) | null = null;
  public onPlayerLeft: ((data: {
    playerId: string;
    name: string;
    newHostId: string | null;
  }) => void) | null = null;

  constructor() {
    this.serverUrl = this.resolveInitialServerUrl();
  }

  private resolveInitialServerUrl(): string {
    try {
      const saved = localStorage.getItem(SERVER_URL_STORAGE_KEY);
      if (saved && saved.trim().length > 0) {
        return this.normalizeUrl(saved);
      }
    } catch {
      // Ignorar si storage no disponible
    }

    if (ENV_SERVER_URL && ENV_SERVER_URL.trim().length > 0) {
      return this.normalizeUrl(ENV_SERVER_URL);
    }

    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:3001';
      }
    }

    return '';
  }

  public normalizeUrl(raw: string): string {
    let url = raw.trim().replace(/\/+$/, '');
    if (url.length > 0 && !/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    return url;
  }

  public setServerUrl(raw: string): string {
    const clean = this.normalizeUrl(raw);
    this.serverUrl = clean;
    try {
      if (clean.length > 0) {
        localStorage.setItem(SERVER_URL_STORAGE_KEY, clean);
      } else {
        localStorage.removeItem(SERVER_URL_STORAGE_KEY);
      }
    } catch {
      // Ignorar
    }
    this.disconnect();
    return clean;
  }

  public get myId(): string {
    return this.socket?.id || '';
  }

  public get isHost(): boolean {
    return Boolean(this.room && this.socket?.id && this.room.hostId === this.socket.id);
  }

  public get isInRoom(): boolean {
    return this.room !== null;
  }

  public get isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  public async connect(): Promise<boolean> {
    if (!this.serverUrl) {
      this.status = 'ERROR';
      this.statusMessage = 'Configura primero la URL de tu servidor Render.';
      return false;
    }

    if (this.socket?.connected) {
      this.status = 'CONNECTED';
      return true;
    }

    this.disconnect();
    this.status = 'CONNECTING';
    this.statusMessage = 'Conectando / despertando servidor Render...';

    return new Promise((resolve) => {
      const socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 22000,
      } as any);
      this.socket = socket;

      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      socket.on('connect', () => {
        this.status = 'CONNECTED';
        this.statusMessage = 'Conectado al servidor multijugador.';
        this.measurePing();
        this.startPingLoop();
        this.refreshPublicRooms();
        done(true);
      });

      socket.on('connect_error', (err) => {
        this.status = 'ERROR';
        this.statusMessage = `Error de conexión: ${err.message || 'Sin respuesta'}`;
        done(false);
      });

      socket.on('disconnect', () => {
        this.stopPingLoop();
        if (this.status !== 'ERROR') {
          this.status = 'DISCONNECTED';
          this.statusMessage = 'Desconectado del servidor.';
        }
        if (this.room) {
          this.room = null;
          this.onRoomUpdate?.(null);
        }
      });

      this.registerSocketHandlers(socket);
    });
  }

  private registerSocketHandlers(socket: Socket): void {
    socket.on('room:update', (room: RoomStateDTO) => {
      this.room = room;
      this.onRoomUpdate?.(room);
    });

    socket.on('room:started', (room: RoomStateDTO) => {
      this.room = room;
      this.onMatchStart?.(room);
    });

    socket.on('room:player_left', (data) => {
      this.onPlayerLeft?.(data);
    });

    socket.on('room:returned_lobby', (room: RoomStateDTO) => {
      this.room = room;
      this.onReturnedToLobby?.(room);
    });

    socket.on('game:peer_input', (input: PeerInputPayload) => {
      this.onPeerInput?.(input);
    });

    socket.on('game:snapshot', (snapshot: CoopWorldSnapshot) => {
      this.onSnapshot?.(snapshot);
    });

    socket.on('game:level_up', (payload: CoopLevelUpPayload) => {
      this.onLevelUp?.(payload);
    });

    socket.on('game:peer_pick_upgrade', (data) => {
      this.onPeerPickUpgrade?.(data);
    });

    socket.on('game:peer_reroll_request', (data) => {
      this.onPeerRerollRequest?.(data);
    });

    socket.on('game:reroll_result', (data) => {
      this.onRerollResult?.(data);
    });

    socket.on('game:upgrade_status', (data) => {
      this.onUpgradeStatus?.(data);
    });

    socket.on('game:resume_from_upgrade', () => {
      this.onResumeFromUpgrade?.();
    });

    socket.on('game:event', (evt: CoopGameEventPayload) => {
      this.onGameEvent?.(evt);
    });
  }

  public disconnect(): void {
    this.stopPingLoop();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.room = null;
    this.status = 'DISCONNECTED';
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingTimer = window.setInterval(() => this.measurePing(), 3500);
  }

  private stopPingLoop(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public measurePing(): void {
    if (!this.socket?.connected) return;
    const t0 = performance.now();
    this.socket.emit('ping:measure', Date.now(), () => {
      this.latencyMs = Math.max(1, Math.round(performance.now() - t0));
    });
  }

  public async refreshPublicRooms(): Promise<PublicRoomSummary[]> {
    if (!this.socket?.connected) return [];
    return new Promise((resolve) => {
      this.socket!.emit('room:list', (res: { ok: boolean; rooms?: PublicRoomSummary[] }) => {
        if (res?.ok && res.rooms) {
          this.publicRooms = res.rooms;
          resolve(res.rooms);
        } else {
          resolve([]);
        }
      });
    });
  }

  public async createRoom(payload: {
    name: string;
    characterId: CharacterId;
    hatId: string | null;
    mode: GameMode;
    isPublic: boolean;
  }): Promise<{ ok: boolean; error?: string; room?: RoomStateDTO }> {
    const ok = await this.connect();
    if (!ok || !this.socket) {
      return { ok: false, error: this.statusMessage || 'CONNECT_FAILED' };
    }
    return new Promise((resolve) => {
      this.socket!.emit('room:create', payload, (res: any) => {
        if (res?.ok && res.room) {
          this.room = res.room;
          this.onRoomUpdate?.(res.room);
        }
        resolve(res || { ok: false, error: 'UNKNOWN' });
      });
    });
  }

  public async joinRoom(payload: {
    code: string;
    name: string;
    characterId: CharacterId;
    hatId: string | null;
  }): Promise<{ ok: boolean; error?: string; room?: RoomStateDTO }> {
    const ok = await this.connect();
    if (!ok || !this.socket) {
      return { ok: false, error: this.statusMessage || 'CONNECT_FAILED' };
    }
    return new Promise((resolve) => {
      this.socket!.emit('room:join', payload, (res: any) => {
        if (res?.ok && res.room) {
          this.room = res.room;
          this.onRoomUpdate?.(res.room);
        }
        resolve(res || { ok: false, error: 'UNKNOWN' });
      });
    });
  }

  public leaveRoom(): void {
    if (this.socket?.connected) {
      this.socket.emit('room:leave');
    }
    this.room = null;
    this.onRoomUpdate?.(null);
  }

  public updateLoadout(payload: {
    name?: string;
    characterId?: CharacterId;
    hatId?: string | null;
  }): void {
    if (this.socket?.connected && this.room) {
      this.socket.emit('room:update_loadout', payload);
    }
  }

  public toggleReady(ready?: boolean): void {
    if (this.socket?.connected && this.room) {
      this.socket.emit('room:toggle_ready', { ready });
    }
  }

  public setMode(mode: GameMode): void {
    if (this.socket?.connected && this.isHost) {
      this.socket.emit('room:set_mode', { mode });
    }
  }

  public startMatch(): Promise<{ ok: boolean; error?: string }> {
    if (!this.socket?.connected || !this.isHost) {
      return Promise.resolve({ ok: false, error: 'NOT_HOST' });
    }
    return new Promise((resolve) => {
      this.socket!.emit('room:start', (res: any) => {
        resolve(res || { ok: false, error: 'START_FAILED' });
      });
    });
  }

  public sendInput(moveX: number, moveY: number, facingAngle: number, isMoving: boolean, seq: number): void {
    if (this.socket?.connected && this.room?.status === 'IN_GAME') {
      this.socket.volatile.emit('game:input', { moveX, moveY, facingAngle, isMoving, seq });
    }
  }

  public sendSnapshot(snapshot: CoopWorldSnapshot): void {
    if (this.socket?.connected && this.isHost && this.room?.status === 'IN_GAME') {
      this.socket.volatile.emit('game:snapshot', snapshot);
    }
  }

  public sendLevelUp(payload: CoopLevelUpPayload): void {
    if (this.socket?.connected && this.isHost) {
      this.socket.emit('game:level_up', payload);
    }
  }

  public sendPickUpgrade(index: number): void {
    if (this.socket?.connected) {
      this.socket.emit('game:pick_upgrade', { index });
    }
  }

  public sendRerollRequest(): void {
    if (this.socket?.connected) {
      this.socket.emit('game:reroll_request');
    }
  }

  public sendRerollResult(targetId: string, choices: SerializedUpgradeCard[], rerollsRemaining: number): void {
    if (this.socket?.connected && this.isHost) {
      this.socket.emit('game:reroll_result', { targetId, choices, rerollsRemaining });
    }
  }

  public sendUpgradeStatus(readyCount: number, totalCount: number): void {
    if (this.socket?.connected && this.isHost) {
      this.socket.emit('game:upgrade_status', { readyCount, totalCount });
    }
  }

  public sendResumeFromUpgrade(): void {
    if (this.socket?.connected && this.isHost) {
      this.socket.emit('game:resume_from_upgrade');
    }
  }

  public sendGameEvent(evt: CoopGameEventPayload): void {
    if (this.socket?.connected && this.isHost) {
      this.socket.emit('game:event', evt);
    }
  }

  public sendReturnToLobby(): void {
    if (this.socket?.connected && this.isHost) {
      this.socket.emit('game:return_lobby');
    }
  }
}
