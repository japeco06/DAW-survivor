import type { CharacterId, GameMode } from '../systems/MetaSystem';

export interface RoomPlayerDTO {
  id: string;
  slot: number;
  name: string;
  characterId: CharacterId;
  hatId: string | null;
  ready: boolean;
  isHost: boolean;
  slotColor: string;
  slotBorder: string;
}

export interface RoomStateDTO {
  code: string;
  hostId: string;
  status: 'LOBBY' | 'IN_GAME';
  mode: GameMode;
  isPublic: boolean;
  maxPlayers: number;
  worldSeed: number;
  players: RoomPlayerDTO[];
}

export interface PublicRoomSummary {
  code: string;
  hostName: string;
  count: number;
  maxPlayers: number;
  mode: GameMode;
}

export interface SerializedUpgradeCard {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  categoryEn: string;
  description: string;
  descriptionEn: string;
  statBadge: string;
  statBadgeEn: string;
  color: string;
  level: number;
  maxLevel: number;
  isWeapon?: boolean;
  isEvolution?: boolean;
  isCompanionBranchCard?: boolean;
}

export interface PeerInputPayload {
  playerId: string;
  moveX: number;
  moveY: number;
  facingAngle: number;
  isMoving: boolean;
  seq: number;
}

export interface SnapshotPlayer {
  id: string;
  slot: number;
  name: string;
  characterId: CharacterId;
  hatId: string | null;
  color: string;
  borderColor: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  facingAngle: number;
  isMoving: boolean;
  downed: boolean;
  reviveProgress: number;
  shieldReady: boolean;
  adrenaline: boolean;
  activeWeapons: string[];
  ackSeq?: number;
  spd?: number;
  xpM?: number;
}

// [typeCode, x, y, size, hp, maxHp, angle, flags, netId?]
// flags: bit0=elite, bit1=frozen, bit2=flash, bit3=shield/Toro telegraph, bit4=Toro dash / Rootkit stealth
export type SnapshotEnemyTuple = [number, number, number, number, number, number, number, number, number?];

// [kind, x, y, vx, vy, evolved(0|1), size]
// kind: 0=Projectile, 1=PingProjectile, 2=CryoShard, 3=SqlBeam, 4=SawDisc, 5=EnemyProjectile, 6=PetShrapnel
export type SnapshotProjTuple = [number, number, number, number, number, number, number];

// [kind, x, y, value]
// kind: 0=CodeFragment, 1=CryptoCoin, 2=NUKE, 3=FREEZE, 4=OVERCLOCK, 5=HEAL
export type SnapshotPickupTuple = [number, number, number, number];

// [kind, x, y, radius, progress, duration, flag]
// kind: 0=Quarantine, 1=Cooling, 2=Emp, 3=Vault, 4=Storm
export type SnapshotZoneTuple = [number, number, number, number, number, number, number];

// [x, y, radius, evolved(0|1)]
export type SnapshotPulseTuple = [number, number, number, number];

// [x, y, durability, evolved(0|1)]
export type SnapshotDroneTuple = [number, number, number, number];

// [x, y, branchCode(0..3), size]
export type SnapshotPetTuple = [number, number, number, number];

// [x, y, radius, kind(0=Cryo, 1=DroneBlast, 2=WormPuddle, 3=RootTrail, 4=PetShockwave)]
export type SnapshotRingTuple = [number, number, number, number];

export interface SnapshotBossHUD {
  name: string;
  color: string;
  hp: number;
  maxHp: number;
  isToro?: boolean;
  toroDmg?: number;
  toroStatus?: string;
  alertTimer?: number;
}

export interface CoopWorldSnapshot {
  seq: number;
  t: number;
  kc: number;
  bk: number;
  coins: number;
  lv: number;
  xp: number;
  xpNext: number;
  nm: boolean;
  fz: number;
  oc: number;
  sw: number;
  toro: boolean;
  players: SnapshotPlayer[];
  enemies: SnapshotEnemyTuple[];
  projectiles: SnapshotProjTuple[];
  pickups: SnapshotPickupTuple[];
  zones: SnapshotZoneTuple[];
  arcs: [number, number][][];
  pulses: SnapshotPulseTuple[];
  oasis?: [string, number, number, number][];
  drones?: SnapshotDroneTuple[];
  pets?: SnapshotPetTuple[];
  rings?: SnapshotRingTuple[];
  boss?: SnapshotBossHUD | null;
}

export interface CoopLevelUpPayload {
  level: number;
  rerollsByPlayer: Record<string, number>;
  choicesByPlayer: Record<string, SerializedUpgradeCard[]>;
}

export interface CoopGameEventPayload {
  type:
    | 'LOG'
    | 'BOSS_SPAWN'
    | 'REVIVE'
    | 'DOWNED'
    | 'GAME_OVER'
    | 'SFX';
  text?: string;
  sfx?: 'shoot' | 'hit' | 'xp' | 'coin' | 'explosion' | 'levelup';
  x?: number;
  y?: number;
  color?: string;
}
