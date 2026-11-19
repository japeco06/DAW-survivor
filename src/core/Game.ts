import { Input } from './Input';
import { SoundSystem } from './SoundSystem';
import { Entity } from '../entities/Entity';
import { Player } from '../entities/Player';
import { Adware } from '../entities/Adware';
import { Worm } from '../entities/Worm';
import { CryptoMiner } from '../entities/CryptoMiner';
import { WaveBoss, RansomwareBoss, RootkitTitanBoss, WormPrimeBoss, SpywareSpecterBoss } from '../entities/WaveBoss';
import { Projectile } from '../entities/Projectile';
import { PingProjectile } from '../entities/PingProjectile';
import { QuarantineZone } from '../entities/QuarantineZone';
import { CodeFragment } from '../entities/CodeFragment';
import { CryptoCoin } from '../entities/CryptoCoin';
import { ArmoredWorm } from '../entities/ArmoredWorm';
import { Evasor } from '../entities/Evasor';
import { ElToroBoss } from '../entities/ElToroBoss';
import { PowerUpItem, PowerUpType } from '../entities/PowerUpItem';
import { Spawner } from '../systems/Spawner';
import { CombatSystem } from '../systems/CombatSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { AchievementSystem } from '../systems/AchievementSystem';
import { DailyMissionSystem } from '../systems/DailyMissionSystem';
import { TerrainEventSystem } from '../systems/TerrainEventSystem';
import { WorldEnvironment } from '../systems/WorldEnvironment';
import { MultiplayerClient } from '../network/MultiplayerClient';
import { CoopLobbyUI, CoopButtonAction } from '../network/CoopLobbyUI';
import { CoopRenderer, encodeEnemyType } from '../network/CoopRenderer';
import type {
  CoopGameOverStats,
  CoopSquadMvpEntry,
  CoopWorldSnapshot,
  RoomStateDTO,
  SerializedUpgradeCard,
  SnapshotBossHUD,
  SnapshotDroneTuple,
  SnapshotEnemyTuple,
  SnapshotPetTuple,
  SnapshotPickupTuple,
  SnapshotPlayer,
  SnapshotProjTuple,
  SnapshotRingTuple,
  SnapshotZoneTuple,
} from '../network/MultiplayerTypes';
import {
  MetaSystem,
  CharacterId,
  GameMode,
  LabUpgradeId,
  LAB_UPGRADES_ORDER,
  LAB_UPGRADES_CONFIG,
  NIGHTMARE_ENTRY_COST,
  GACHA_PULL_SINGLE_COST,
  GACHA_PULL_TEN_COST,
  GachaPullEntry,
  LeaderboardEntry,
} from '../systems/MetaSystem';
import { HatItem, HATS_DATABASE, RARITY_CONFIG } from '../systems/HatSystem';
import { HatRenderer } from '../utils/HatRenderer';
import { i18n } from '../utils/i18n';
import { auth, db, googleProvider, logAnalyticsEvent } from '../firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';

type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER';
type MenuTab = 'SHOP' | 'LAB' | 'GACHA' | 'INVENTORY';
type LeaderboardCategory = 'TORO_DAMAGE' | 'SURVIVAL_TIME';

interface CardRect {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MenuCharacterRect {
  id: CharacterId;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PauseButtonRect {
  action: 'RESUME' | 'SETTINGS' | 'EXIT_TO_MENU';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CoopPeerRuntime {
  id: string;
  slot: number;
  name: string;
  characterId: CharacterId;
  hatId: string | null;
  slotColor: string;
  slotBorder: string;
  player: Player;
  combatSystem: CombatSystem;
  upgradeSystem: UpgradeSystem;
  inputX: number;
  inputY: number;
  isMoving: boolean;
  lastAckSeq: number;
  downed: boolean;
  reviveProgress: number;
  revivesDone: number;
  timesDowned: number;
}

export const LOGICAL_WIDTH = 1920;
export const LOGICAL_HEIGHT = 1080;

const GAME_VERSION = 'v1.7.0';
const FONT_DISPLAY = '"Segoe UI", "Inter", system-ui, -apple-system, sans-serif';
const FONT_MONO = '"JetBrains Mono", Consolas, monospace';
const LIGHT_GFX_STORAGE_KEY = 'daw_survivor_light_gfx_v1';
export const FINAL_BOSS_ARRIVAL_TIME = 700; // 11 minutos y 40 segundos (~11-12 min)

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bgCacheCanvas: HTMLCanvasElement | null = null;
  private scanLineCache: HTMLCanvasElement | null = null;
  private infiniteTileCache: HTMLCanvasElement | null = null;
  private input: Input;
  private sound: SoundSystem;
  private metaSystem: MetaSystem;
  private player: Player;
  private enemies: Adware[] = [];
  private projectiles: Projectile[] = [];
  private pingProjectiles: PingProjectile[] = [];
  private quarantineZones: QuarantineZone[] = [];
  private codeFragments: CodeFragment[] = [];
  private cryptoCoins: CryptoCoin[] = [];
  private powerUps: PowerUpItem[] = [];
  private systemFreezeTimer: number = 0;
  private thermalOverclockTimer: number = 0;
  private spawner: Spawner;
  private combatSystem: CombatSystem;
  private upgradeSystem: UpgradeSystem;
  private particleSystem: ParticleSystem;

  private isPaused: boolean = false;
  private hoveredPauseAction: 'RESUME' | 'SETTINGS' | 'EXIT_TO_MENU' | null = null;

  private finalBoss: ElToroBoss | null = null;

  private gameState: GameState = 'MENU';
  private lastTime: number = 0;
  private elapsedTime: number = 0;
  private killCount: number = 0;
  private runCoinsCollected: number = 0;
  private runDamageToToro: number = 0;
  private highScoreKills: number = 0;
  private showHitboxes: boolean = false;
  private showAttackRange: boolean = false;
  private hoveredCardIndex: number = -1;
  private hoveredMenuChar: CharacterId | null = null;
  private hoveredLabId: LabUpgradeId | null = null;
  private activeMenuTab: MenuTab = 'SHOP';
  private lastGachaResults: GachaPullEntry[] = [];
  private gachaRevealTimer: number = 0;
  private inventoryPage: number = 0;
  private hoveredHatId: string | null = null;
  private currentUser: User | null = null;
  private hoveredAuthBtn: boolean = false;
  private showLeaderboardOverlay: boolean = false;
  private activeLeaderboardCategory: LeaderboardCategory = 'SURVIVAL_TIME';
  private leaderboardLoading: boolean = false;
  private toroDamageLeaderboard: LeaderboardEntry[] = [];
  private survivalTimeLeaderboard: LeaderboardEntry[] = [];
  private hoveredRankingsBtn: boolean = false;
  private hoveredLeaderboardTab: LeaderboardCategory | null = null;
  private hoveredLeaderboardBackBtn: boolean = false;
  private achievementSystem: AchievementSystem;
  private showAchievementsOverlay: boolean = false;
  private achievementsPage: number = 0;
  private hoveredAchievementsTab: number | null = null;
  private showSettingsOverlay: boolean = false;
  private showHelpOverlay: boolean = false;
  private hoveredAchievementsBtn: boolean = false;
  private hoveredSettingsBtn: boolean = false;
  private hoveredFullscreenBtn: boolean = false;
  private hoveredOverlayBackBtn: boolean = false;
  private hoveredStartBtn: boolean = false;
  private hoveredDailyMissionsBtn: boolean = false;
  private showDailyMissionsOverlay: boolean = false;
  private hoveredRerollBtn: boolean = false;
  private hoveredInGameBtn: 'PAUSE' | 'MUTE' | 'ULT' | null = null;
  private hoveredGameOverBtn: 'RETRY' | 'MENU' | null = null;
  private runRevivesDone: number = 0;
  private runTimesDowned: number = 0;
  private coopGameOverSquad: CoopSquadMvpEntry[] = [];
  private statusToastText: string = '';
  private statusToastColor: string = '#38bdf8';
  private statusToastExpiresAt: number = 0;
  private hoveredModeBtn: GameMode | null = null;
  private selectedGameMode: GameMode = 'CLASSIC';
  private isNightmareRun: boolean = false;
  private lightGraphicsEnabled: boolean = false;
  private dailyMissions: DailyMissionSystem;
  private terrainEvents: TerrainEventSystem;
  private worldEnv: WorldEnvironment;
  private lastTouchTapTime: number = 0;
  private lastOverclockTier: number = 0;
  private lastStandardHealTier: number = 0;
  private runBossesKilled: number = 0;
  private runTotalDamageDealt: number = 0;
  private mpClient: MultiplayerClient;
  private showCoopModal: boolean = false;
  private hoveredCoopBtn: boolean = false;
  private hoveredCoopAction: CoopButtonAction | null = null;
  private coopFeedbackMsg: string = '';
  private isCoopMode: boolean = false;
  private isCoopHost: boolean = false;
  private coopSelfDowned: boolean = false;
  private coopSelfReviveProgress: number = 0;
  private coopPeers: Map<string, CoopPeerRuntime> = new Map();
  private coopWaitingUpgrade: boolean = false;
  private coopUpgradePickedIds: Set<string> = new Set();
  private coopUpgradeTimer: number = 0;
  private coopUpgradeStatusText: string = '';
  private coopSnapshot: CoopWorldSnapshot | null = null;
  private coopSnapshotTimer: number = 0;
  private coopSnapshotSeq: number = 0;
  private coopLastSnapSeq: number = 0;
  private coopInputTimer: number = 0;
  private coopInputSeq: number = 0;
  private coopPendingInputs: { seq: number; x: number; y: number }[] = [];
  private coopLastPrevEnemyHp: Map<number, { x: number; y: number; hp: number; maxHp: number }> = new Map();
  public readonly firestoreDb = db;
  private menuFeedbackMessage: string = i18n.t(
    'Explora Agentes, Gacha (Tirada x1 / x10) e Inventario de Sombreros.',
    'Explore Agents, Gacha (Roll x1 / x10) & Hat Inventory.'
  );
  private damageVignetteAlpha: number = 0;
  private terminalLogs: string[] = [
    `> DAW_SURVIVOR_KERNEL ${GAME_VERSION} online...`,
    '> Antivirus Agents & Cyber Arsenal READY.',
  ];
  private ambientNodes: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] =
    Array.from({ length: 28 }, (_, i) => ({
      x: ((i * 271) % LOGICAL_WIDTH),
      y: ((i * 193) % LOGICAL_HEIGHT),
      vx: ((i % 5) - 2) * 8,
      vy: ((i % 3) - 1) * 10 - 6,
      size: 1.5 + (i % 3) * 0.8,
      alpha: 0.14 + (i % 4) * 0.06,
    }));

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context =
      canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo inicializar el contexto 2D del Canvas.');
    }
    this.ctx = context;

    try {
      const savedLight =
        localStorage.getItem(LIGHT_GFX_STORAGE_KEY) ||
        localStorage.getItem('cyber_survivor_light_gfx_v1');
      this.lightGraphicsEnabled = savedLight === '1';
    } catch {
      this.lightGraphicsEnabled = false;
    }

    this.input = new Input();
    this.sound = new SoundSystem();
    this.metaSystem = new MetaSystem();
    this.highScoreKills = this.metaSystem.highScore;
    this.player = new Player(
      LOGICAL_WIDTH / 2,
      LOGICAL_HEIGHT / 2,
      this.metaSystem.getSelectedProfile(),
      this.metaSystem.getEquippedHat()
    );
    this.spawner = new Spawner();
    this.combatSystem = new CombatSystem();
    this.upgradeSystem = new UpgradeSystem();
    this.particleSystem = new ParticleSystem();
    this.particleSystem.lightMode = this.lightGraphicsEnabled;

    this.resize();
    window.addEventListener('resize', () => {
      this.resize();
    });

    this.dailyMissions = new DailyMissionSystem();
    this.dailyMissions.onCompleteCallback = (mission) => {
      this.sound.playAchievement();
      this.metaSystem.coins += mission.rewardCoins;
      this.metaSystem.save();
      void this.metaSystem.syncToCloud();
      this.addTerminalLog(`MISIÓN DIARIA: ${mission.title} (+${mission.rewardCoins} CR)`);
    };
    this.terrainEvents = new TerrainEventSystem();
    this.worldEnv = new WorldEnvironment();
    this.mpClient = new MultiplayerClient();
    this.setupMultiplayerHandlers();

    this.achievementSystem = new AchievementSystem();
    this.achievementSystem.onUnlockCallback = (ach) => {
      this.sound.playAchievement();
      this.metaSystem.coins += ach.rewardCoins;
      this.metaSystem.save();
      void this.metaSystem.syncToCloud();
      this.addTerminalLog(`HITO DESBLOQUEADO: ${ach.title} (+${ach.rewardCoins} 🪙)`);
    };

    onAuthStateChanged(
      auth,
      async (user) => {
        try {
          this.currentUser = user;
          if (user) {
            const displayName = user.displayName || user.email || i18n.t('Agente', 'Agent');
            this.menuFeedbackMessage = i18n.t(
              `Sincronizando datos en la nube de ${displayName}...`,
              `Syncing cloud data for ${displayName}...`
            );
            await this.metaSystem.loadFromCloud(user.uid);
            this.highScoreKills = this.metaSystem.highScore;
            if (this.gameState === 'MENU') {
              this.player = new Player(
                LOGICAL_WIDTH / 2,
                LOGICAL_HEIGHT / 2,
                this.metaSystem.getSelectedProfile()
              );
            }
            this.menuFeedbackMessage = i18n.t(
              `Sesión iniciada como ${displayName}. Progreso sincronizado con la nube.`,
              `Signed in as ${displayName}. Progress synced to cloud.`
            );
            this.addTerminalLog(`AUTH: Cloud Save synced (${displayName})`);
            this.achievementSystem.reportProgress('gacha_collector_20', this.metaSystem.unlockedHats.size, true);
            if (this.metaSystem.getUnlockedHatsList().some((h) => h.rarity === 'MITICA' || h.rarity === 'LEGENDARIA')) {
              this.achievementSystem.reportProgress('gacha_mythic', 1, true);
            }
          }
        } catch (err) {
          console.warn('Error al sincronizar auth de Firebase:', err);
        }
      },
      (error) => {
        console.warn('Firebase Auth state error (entorno sandbox/iframe):', error);
      }
    );

    this.achievementSystem.reportProgress('gacha_collector_20', this.metaSystem.unlockedHats.size, true);
    if (this.metaSystem.getUnlockedHatsList().some((h) => h.rarity === 'MITICA' || h.rarity === 'LEGENDARIA')) {
      this.achievementSystem.reportProgress('gacha_mythic', 1, true);
    }

    this.setupEventListeners();
  }

  private addTerminalLog(message: string): void {
    const timeTag = this.elapsedTime.toFixed(1).padStart(5, '0');
    this.terminalLogs.push(`[${timeTag}s] ${message}`);
    if (this.terminalLogs.length > 5) {
      this.terminalLogs.shift();
    }
  }

  private getCanvasClientPos(clientXCoord: number, clientYCoord: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const canvasAspect = LOGICAL_WIDTH / LOGICAL_HEIGHT;
    const rectAspect = rect.width / Math.max(1, rect.height);

    let renderW = rect.width;
    let renderH = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (rectAspect > canvasAspect) {
      renderW = rect.height * canvasAspect;
      offsetX = (rect.width - renderW) / 2;
    } else if (rectAspect < canvasAspect) {
      renderH = rect.width / canvasAspect;
      offsetY = (rect.height - renderH) / 2;
    }

    const clientX = clientXCoord - rect.left - offsetX;
    const clientY = clientYCoord - rect.top - offsetY;

    return {
      x: Math.max(0, Math.min(LOGICAL_WIDTH, clientX * (LOGICAL_WIDTH / Math.max(1, renderW)))),
      y: Math.max(0, Math.min(LOGICAL_HEIGHT, clientY * (LOGICAL_HEIGHT / Math.max(1, renderH)))),
    };
  }

  private getCanvasMousePos(e: MouseEvent): { x: number; y: number } {
    return this.getCanvasClientPos(e.clientX, e.clientY);
  }

  private isMovingMap(): boolean {
    return this.isNightmareRun || this.isCoopMode;
  }

  private getCameraOrigin(): { x: number; y: number } {
    if (!this.isMovingMap() || this.gameState === 'MENU') {
      return { x: 0, y: 0 };
    }
    if (this.isCoopMode && this.coopSelfDowned) {
      if (this.isCoopHost) {
        for (const peer of this.coopPeers.values()) {
          if (!peer.downed && peer.player.active) {
            return {
              x: peer.player.x - LOGICAL_WIDTH / 2,
              y: peer.player.y - LOGICAL_HEIGHT / 2,
            };
          }
        }
      } else if (this.coopSnapshot) {
        const aliveAlly = this.coopSnapshot.players.find(
          (p) => p.id !== this.mpClient.myId && !p.downed
        );
        if (aliveAlly) {
          return {
            x: aliveAlly.x - LOGICAL_WIDTH / 2,
            y: aliveAlly.y - LOGICAL_HEIGHT / 2,
          };
        }
      }
    }
    return {
      x: this.player.x - LOGICAL_WIDTH / 2,
      y: this.player.y - LOGICAL_HEIGHT / 2,
    };
  }

  private getNearestAliveCoopCameraOrigin(x: number, y: number): { x: number; y: number } {
    if (!this.isCoopMode) return this.getCameraOrigin();
    const p = this.getNearestAliveCoopPlayer(x, y);
    return {
      x: p.x - LOGICAL_WIDTH / 2,
      y: p.y - LOGICAL_HEIGHT / 2,
    };
  }

  private getSlotSpawnOffset(slot: number): { dx: number; dy: number } {
    const offsets = [
      { dx: -68, dy: -42 },
      { dx: 68, dy: -42 },
      { dx: -68, dy: 52 },
      { dx: 68, dy: 52 },
    ];
    return offsets[slot % offsets.length] || { dx: 0, dy: 0 };
  }

  private syncCoopLoadout(): void {
    if (!this.mpClient.isInRoom) return;
    const hat = this.metaSystem.getEquippedHat();
    this.mpClient.updateLoadout({
      name: this.metaSystem.displayName,
      characterId: this.metaSystem.selectedCharacter,
      hatId: hat?.id ?? null,
    });
  }

  private openCoopModal(): void {
    this.showCoopModal = true;
    this.coopFeedbackMsg = '';
    if (this.mpClient.serverUrl && !this.mpClient.isConnected) {
      void this.mpClient.connect().then((ok) => {
        if (!ok && this.mpClient.statusMessage) {
          this.coopFeedbackMsg = this.mpClient.statusMessage;
        }
      });
    } else if (this.mpClient.isConnected && !this.mpClient.isInRoom) {
      void this.mpClient.refreshPublicRooms();
    }
  }

  private handleCoopButtonAction(action: CoopButtonAction): void {
    if (action === 'CLOSE') {
      this.showCoopModal = false;
      this.sound.playShoot(false);
      return;
    }

    if (action === 'SET_URL') {
      const nextUrl = window.prompt(
        i18n.t(
          'Pega la URL de tu servidor Render (ej: https://daw-survivor-coop.onrender.com):',
          'Paste your Render server URL (e.g. https://daw-survivor-coop.onrender.com):'
        ),
        this.mpClient.serverUrl || 'https://'
      );
      if (nextUrl !== null) {
        const clean = this.mpClient.setServerUrl(nextUrl);
        this.coopFeedbackMsg = clean
          ? i18n.t(`Conectando a ${clean}...`, `Connecting to ${clean}...`)
          : i18n.t('URL limpiada.', 'URL cleared.');
        if (clean) {
          void this.mpClient.connect().then((ok) => {
            if (!ok) this.coopFeedbackMsg = this.mpClient.statusMessage;
            else this.coopFeedbackMsg = i18n.t('¡Servidor Render conectado!', 'Render server connected!');
          });
        }
      }
      return;
    }

    const hat = this.metaSystem.getEquippedHat();
    const myLoadout = {
      name: this.metaSystem.displayName,
      characterId: this.metaSystem.selectedCharacter,
      hatId: hat?.id ?? null,
    };

    if (action === 'CREATE_PUBLIC' || action === 'CREATE_PRIVATE') {
      this.coopFeedbackMsg = i18n.t('Creando sala...', 'Creating room...');
      void this.mpClient
        .createRoom({
          ...myLoadout,
          mode: this.selectedGameMode,
          isPublic: action === 'CREATE_PUBLIC',
        })
        .then((res) => {
          if (res.ok && res.room) {
            this.sound.playCoinPickup();
            this.coopFeedbackMsg = i18n.t(
              `Sala ${res.room.code} creada. Comparte el código con hasta 3 amigos.`,
              `Room ${res.room.code} created. Share code with up to 3 friends.`
            );
          } else {
            this.sound.playExplosion(false);
            this.coopFeedbackMsg = res.error || this.mpClient.statusMessage;
          }
        });
      return;
    }

    if (action === 'JOIN_CODE') {
      const rawCode = window.prompt(
        i18n.t('Introduce el código de sala (4 caracteres):', 'Enter 4-char Room Code:'),
        ''
      );
      if (rawCode && rawCode.trim().length > 0) {
        this.coopFeedbackMsg = i18n.t('Uniéndose a la sala...', 'Joining room...');
        void this.mpClient.joinRoom({ code: rawCode.trim().toUpperCase(), ...myLoadout }).then((res) => {
          if (res.ok) {
            this.sound.playCoinPickup();
            this.coopFeedbackMsg = '';
          } else {
            this.sound.playExplosion(false);
            this.coopFeedbackMsg =
              res.error === 'ROOM_NOT_FOUND'
                ? i18n.t('Sala no encontrada.', 'Room not found.')
                : res.error === 'ROOM_FULL'
                ? i18n.t('Sala llena (4/4 jugadores).', 'Room full (4/4).')
                : res.error === 'MATCH_ALREADY_STARTED'
                ? i18n.t('La partida ya ha empezado.', 'Match already started.')
                : res.error || this.mpClient.statusMessage;
          }
        });
      }
      return;
    }

    if (action.startsWith('JOIN_PUBLIC:')) {
      const code = action.slice('JOIN_PUBLIC:'.length);
      this.coopFeedbackMsg = i18n.t(`Uniéndose a #${code}...`, `Joining #${code}...`);
      void this.mpClient.joinRoom({ code, ...myLoadout }).then((res) => {
        if (res.ok) {
          this.sound.playCoinPickup();
          this.coopFeedbackMsg = '';
        } else {
          this.sound.playExplosion(false);
          this.coopFeedbackMsg = res.error || this.mpClient.statusMessage;
          void this.mpClient.refreshPublicRooms();
        }
      });
      return;
    }

    if (action === 'REFRESH_ROOMS') {
      this.coopFeedbackMsg = i18n.t('Actualizando salas públicas...', 'Refreshing public rooms...');
      void this.mpClient.refreshPublicRooms().then(() => {
        this.coopFeedbackMsg = '';
      });
      return;
    }

    if (action === 'COPY_CODE' && this.mpClient.room) {
      const code = this.mpClient.room.code;
      navigator.clipboard?.writeText(code).catch(() => {});
      this.sound.playCoinPickup();
      this.coopFeedbackMsg = i18n.t(
        `Código ${code} copiado al portapapeles.`,
        `Code ${code} copied to clipboard.`
      );
      return;
    }

    if (action === 'TOGGLE_MODE' && this.mpClient.room && this.mpClient.isHost) {
      const nextMode = this.mpClient.room.mode === 'CLASSIC' ? 'NIGHTMARE' : 'CLASSIC';
      this.mpClient.setMode(nextMode);
      this.sound.playShoot(false);
      return;
    }

    if (action === 'TOGGLE_READY') {
      this.mpClient.toggleReady();
      this.sound.playShoot(false);
      return;
    }

    if (action === 'START_MATCH' && this.mpClient.isHost) {
      this.coopFeedbackMsg = i18n.t('Lanzando partida Co-op...', 'Launching Co-op match...');
      void this.mpClient.startMatch().then((res) => {
        if (!res.ok) {
          this.sound.playExplosion(false);
          this.coopFeedbackMsg = res.error || 'Error';
        }
      });
      return;
    }

    if (action === 'LEAVE_ROOM') {
      this.mpClient.leaveRoom();
      this.coopFeedbackMsg = '';
      this.sound.playShoot(false);
    }
  }

  private setupMultiplayerHandlers(): void {
    this.mpClient.onRoomUpdate = (room) => {
      if (!room && this.isCoopMode && this.gameState === 'PLAYING') {
        this.exitToMainMenu(true);
        this.showCoopModal = true;
        this.coopFeedbackMsg =
          this.mpClient.statusMessage ||
          i18n.t(
            'Conexión perdida con la sala Co-op.',
            'Connection lost to the Co-op room.'
          );
        return;
      }
      if (this.gameState === 'MENU' && !room && this.showCoopModal) {
        this.coopFeedbackMsg = this.mpClient.statusMessage;
      }
    };

    this.mpClient.onMatchStart = (room) => {
      this.startCoopMatch(room);
    };

    this.mpClient.onPeerInput = (inp) => {
      const peer = this.coopPeers.get(inp.playerId);
      if (!peer) return;
      peer.inputX = inp.moveX;
      peer.inputY = inp.moveY;
      peer.isMoving = inp.isMoving;
      peer.lastAckSeq = Math.max(peer.lastAckSeq, inp.seq || 0);
      if (Math.hypot(inp.moveX, inp.moveY) > 0.05) {
        peer.player.facingAngle = inp.facingAngle;
      }
      if (inp.ult && !peer.downed && peer.player.activateUltimate()) {
        const uName = i18n.currentLang === 'EN' ? peer.player.ultNameEn : peer.player.ultName;
        this.sound.playAchievement();
        this.particleSystem.spawnExplosion(peer.player.x, peer.player.y, peer.slotColor, 34, true);
        this.particleSystem.spawnFloatingText(
          peer.player.x,
          peer.player.y - 36,
          `⚡ ¡${uName}! (${peer.player.ultDuration}s)`,
          '#fbbf24',
          1.35
        );
        const msg = `ULTIMATE: ${peer.name} unleashed ${uName} (${peer.player.ultDuration}s)!`;
        this.addTerminalLog(msg);
        this.mpClient.sendGameEvent({
          type: 'REVIVE',
          x: peer.player.x,
          y: peer.player.y,
          text: msg,
        });
      }
    };

    this.mpClient.onSnapshot = (snap) => {
      if (!this.isCoopMode || this.isCoopHost) return;
      if (snap.seq <= this.coopLastSnapSeq) return;
      this.coopLastSnapSeq = snap.seq;

      CoopRenderer.ingestSnapshot(snap);

      const prevCoins = this.coopSnapshot?.coins ?? 0;
      const prevMyHp = this.player.hp;
      this.coopSnapshot = snap;
      this.elapsedTime = snap.t;
      this.killCount = snap.kc;
      this.runBossesKilled = snap.bk;
      if (snap.boss?.toroDmg !== undefined) {
        this.runDamageToToro = Math.max(this.runDamageToToro, snap.boss.toroDmg);
      }
      if (snap.coins > prevCoins) {
        const delta = snap.coins - prevCoins;
        this.metaSystem.addCoins(delta);
        this.dailyMissions.reportProgress('COINS', delta);
        this.sound.playCoinPickup();
      }
      this.runCoinsCollected = snap.coins;
      this.upgradeSystem.level = snap.lv;
      this.upgradeSystem.currentXp = snap.xp;
      this.upgradeSystem.xpToNextLevel = snap.xpNext;
      this.isNightmareRun = snap.nm;
      this.systemFreezeTimer = snap.fz;
      this.thermalOverclockTimer = snap.oc;
      this.spawner.swarmActiveTimer = snap.sw;
      this.spawner.finalBossMode = snap.toro;
      if (snap.oasis) {
        this.worldEnv.applyRemoteOasisStates(snap.oasis);
      }

      // Música dinámica en cliente Invitado según estado del Jefe / El Toro
      if (snap.toro || snap.boss?.isToro) {
        if (this.sound.getCurrentTrack() !== 'FINAL_BOSS') this.sound.setTrack('FINAL_BOSS');
      } else if (snap.boss && snap.boss.hp > 0) {
        if (this.sound.getCurrentTrack() !== 'BOSS') this.sound.setTrack('BOSS');
      } else if (this.gameState === 'PLAYING') {
        if (this.sound.getCurrentTrack() !== 'INGAME') this.sound.setTrack('INGAME');
      }

      // Retroalimentación visual ligera en cliente al detectar bajas reales de enemigos por netId
      if (!this.lightGraphicsEnabled) {
        const currentById = new Map<number, { x: number; y: number; hp: number; maxHp: number }>();
        for (const e of snap.enemies) {
          const nid = e[8];
          if (nid === undefined) continue;
          currentById.set(nid, { x: e[1], y: e[2], hp: e[4], maxHp: e[5] });
        }
        for (const [oldId, oldInfo] of this.coopLastPrevEnemyHp.entries()) {
          if (
            !currentById.has(oldId) &&
            oldInfo.hp <= Math.max(40, oldInfo.maxHp * 0.65) &&
            Math.hypot(oldInfo.x - this.player.x, oldInfo.y - this.player.y) < 950
          ) {
            this.particleSystem.spawnExplosion(oldInfo.x, oldInfo.y, '#ff1e42', 7, false);
          }
        }
        this.coopLastPrevEnemyHp = currentById;
      }

      const me = snap.players.find((p) => p.id === this.mpClient.myId);
      if (me) {
        if (me.hp < prevMyHp && prevMyHp > 0 && !this.coopSelfDowned) {
          this.damageVignetteAlpha = 0.6;
          this.particleSystem.triggerShake(7, 0.22);
          this.sound.playExplosion(false);
          this.particleSystem.spawnExplosion(this.player.x, this.player.y, '#ff1e42', 12, false);
        }
        this.coopSelfDowned = me.downed;
        this.coopSelfReviveProgress = me.reviveProgress;
        this.player.hp = me.hp;
        this.player.maxHp = me.maxHp;
        this.player.active = !me.downed;
        if (me.xpM && me.xpM > 0) {
          this.player.xpMultiplier = me.xpM;
        }
        if (me.ultChg !== undefined) {
          this.player.ultCharge = me.ultChg;
        }
        if (me.ultMax !== undefined && me.ultMax > 0) {
          this.player.ultMaxCharge = me.ultMax;
        }
        if (me.ultAct !== undefined) {
          this.player.ultActiveTimer = me.ultAct;
        }
        if (me.spd && me.spd > 0) {
          this.player.speed = me.spd;
          this.player.speedBonusMultiplier = 1.0;
        }

        const ackSeq = me.ackSeq ?? 0;
        if (me.downed) {
          this.player.x = me.x;
          this.player.y = me.y;
          this.coopPendingInputs = [];
        } else {
          const histIdx = ackSeq > 0 ? this.coopPendingInputs.findIndex((h) => h.seq === ackSeq) : -1;
          if (histIdx !== -1) {
            const ackPos = this.coopPendingInputs[histIdx];
            this.coopPendingInputs.splice(0, histIdx + 1);
            const errX = me.x - ackPos.x;
            const errY = me.y - ackPos.y;
            const errDist = Math.hypot(errX, errY);
            if (errDist > 150) {
              this.player.x = me.x;
              this.player.y = me.y;
              this.coopPendingInputs = [];
            } else if (errDist > 4) {
              const blend = 0.22;
              const adjX = errX * blend;
              const adjY = errY * blend;
              this.player.x += adjX;
              this.player.y += adjY;
              for (const pending of this.coopPendingInputs) {
                pending.x += adjX;
                pending.y += adjY;
              }
            }
          } else {
            const dist = Math.hypot(me.x - this.player.x, me.y - this.player.y);
            if (dist > 170) {
              this.player.x = me.x;
              this.player.y = me.y;
              this.coopPendingInputs = [];
            } else if (!this.player.isMoving && dist > 6) {
              this.player.x += (me.x - this.player.x) * 0.16;
              this.player.y += (me.y - this.player.y) * 0.16;
            }
          }
        }
      }
    };

    this.mpClient.onLevelUp = (payload) => {
      if (!this.isCoopMode || this.isCoopHost) return;
      this.upgradeSystem.level = payload.level;
      const myChoices = payload.choicesByPlayer[this.mpClient.myId] || [];
      const myRerolls = payload.rerollsByPlayer[this.mpClient.myId] ?? 0;
      this.coopWaitingUpgrade = true;
      this.coopUpgradeStatusText = '';
      this.sound.playAchievement();
      if (myChoices.length > 0 && !this.coopSelfDowned) {
        this.upgradeSystem.setExternalChoices(myChoices, myRerolls);
      } else {
        this.upgradeSystem.clearExternalChoices();
        this.mpClient.sendPickUpgrade(0);
      }
    };

    this.mpClient.onPeerPickUpgrade = ({ playerId, index }) => {
      if (!this.isCoopMode || !this.isCoopHost || !this.coopWaitingUpgrade) return;
      const peer = this.coopPeers.get(playerId);
      if (peer) {
        peer.upgradeSystem.selectUpgrade(index, peer.player, peer.combatSystem);
      }
      this.coopUpgradePickedIds.add(playerId);
      this.tryResumeCoopUpgrade();
    };

    this.mpClient.onPeerRerollRequest = ({ playerId }) => {
      if (!this.isCoopMode || !this.isCoopHost || !this.coopWaitingUpgrade) return;
      const peer = this.coopPeers.get(playerId);
      if (!peer) return;
      if (peer.upgradeSystem.rerollChoices(peer.player)) {
        this.mpClient.sendRerollResult(
          playerId,
          peer.upgradeSystem.serializeCurrentChoices(),
          peer.upgradeSystem.rerollsRemaining
        );
      }
    };

    this.mpClient.onRerollResult = ({ choices, rerollsRemaining }) => {
      if (!this.isCoopMode || this.isCoopHost) return;
      this.upgradeSystem.setExternalChoices(choices, rerollsRemaining);
      this.sound.playShoot(true);
    };

    this.mpClient.onUpgradeStatus = ({ readyCount, totalCount }) => {
      this.coopUpgradeStatusText = `${readyCount}/${totalCount}`;
    };

    this.mpClient.onResumeFromUpgrade = () => {
      if (!this.isCoopMode || this.isCoopHost) return;
      this.upgradeSystem.clearExternalChoices();
      this.coopWaitingUpgrade = false;
      this.coopUpgradeStatusText = '';
      this.sound.playCoinPickup();
    };

    this.mpClient.onGameEvent = (evt) => {
      if (!this.isCoopMode || this.isCoopHost) return;
      if (evt.type === 'LOG' && evt.text) {
        this.addTerminalLog(evt.text);
      } else if (evt.type === 'SFX' && evt.sfx) {
        if (evt.sfx === 'explosion') this.sound.playExplosion(true);
        else if (evt.sfx === 'coin') this.sound.playCoinPickup();
        else if (evt.sfx === 'levelup') this.sound.playAchievement();
        else if (evt.sfx === 'shoot') this.sound.playShoot(false);
      } else if (evt.type === 'REVIVE' && evt.text) {
        this.sound.playAchievement();
        this.addTerminalLog(evt.text);
        if (evt.x !== undefined && evt.y !== undefined) {
          this.particleSystem.spawnExplosion(evt.x, evt.y, '#10b981', 28, true);
        }
      } else if (evt.type === 'DOWNED' && evt.text) {
        this.sound.playExplosion(false);
        this.addTerminalLog(evt.text);
      } else if (evt.type === 'GAME_OVER') {
        this.gameState = 'GAMEOVER';
        this.coopWaitingUpgrade = false;
        this.upgradeSystem.clearExternalChoices();
        this.sound.setTrack('NONE');
        this.sound.playExplosion(true);
        if (evt.stats) {
          const myWepStats = evt.stats.weaponsByPlayer[this.mpClient.myId];
          if (myWepStats) {
            this.combatSystem.weaponDamageStats = { ...myWepStats };
          }
          if (evt.stats.killsByType) {
            this.combatSystem.killsByTypeStats = { ...evt.stats.killsByType };
          }
          if (evt.stats.squadMvp) {
            this.coopGameOverSquad = evt.stats.squadMvp;
          }
          if (evt.stats.damageToToro > 0) {
            this.runDamageToToro = Math.max(this.runDamageToToro, evt.stats.damageToToro);
          }
        }
        this.dailyMissions.reportProgress('SURVIVAL_SEC', Math.floor(this.elapsedTime));
        this.dailyMissions.reportProgress('LEVEL', this.upgradeSystem.level);
        if (this.killCount > 0) this.dailyMissions.reportProgress('KILLS', this.killCount);
        if (this.runBossesKilled > 0) this.dailyMissions.reportProgress('BOSSES', this.runBossesKilled);
        this.metaSystem.updateHighScore(this.killCount, this.elapsedTime, this.runDamageToToro);
        this.highScoreKills = Math.max(this.highScoreKills, this.metaSystem.highScore);
        void this.metaSystem.syncToCloud(this.elapsedTime, this.runDamageToToro);
        this.achievementSystem.flushPendingSave(true);
        this.metaSystem.flushPendingSave();
        this.dailyMissions.flushPendingSave(true);
      }
    };

    this.mpClient.onReturnedToLobby = (_room) => {
      this.exitToMainMenu(true);
      this.showCoopModal = true;
      this.coopFeedbackMsg = i18n.t('De vuelta en el Lobby Co-op.', 'Returned to Co-op Lobby.');
    };

    this.mpClient.onPlayerLeft = (data) => {
      if (!this.isCoopMode) return;
      this.addTerminalLog(`CO-OP: ${data.name} disconnected.`);
      if (this.isCoopHost) {
        this.coopPeers.delete(data.playerId);
        if (this.coopWaitingUpgrade) {
          this.tryResumeCoopUpgrade();
        }
      } else if (data.newHostId) {
        this.exitToMainMenu(true);
        this.showCoopModal = true;
        this.coopFeedbackMsg = i18n.t(
          'El Host abandonó la partida. Regresado al Lobby.',
          'Host left the match. Returned to Lobby.'
        );
      }
    };
  }

  private startCoopMatch(room: RoomStateDTO): void {
    const myId = this.mpClient.myId;
    const myMember = room.players.find((p) => p.id === myId) || room.players[0];
    const myProfile =
      this.metaSystem.characters[myMember.characterId] || this.metaSystem.getSelectedProfile();
    const myHat = myMember.hatId
      ? HATS_DATABASE.find((h) => h.id === myMember.hatId) || null
      : null;
    const myOff = this.getSlotSpawnOffset(myMember.slot);

    this.isCoopMode = true;
    this.isCoopHost = room.hostId === myId;
    this.isNightmareRun = room.mode === 'NIGHTMARE';
    this.showCoopModal = false;
    this.showDailyMissionsOverlay = false;
    this.showLeaderboardOverlay = false;
    this.showAchievementsOverlay = false;
    this.showSettingsOverlay = false;
    this.showHelpOverlay = false;
    this.coopSelfDowned = false;
    this.coopSelfReviveProgress = 0;
    this.coopWaitingUpgrade = false;
    this.coopUpgradePickedIds.clear();
    this.coopUpgradeStatusText = '';
    this.coopSnapshot = null;
    this.coopSnapshotTimer = 0;
    this.coopSnapshotSeq = 0;
    this.coopLastSnapSeq = 0;
    this.coopInputTimer = 0;
    this.coopInputSeq = 0;
    this.coopPendingInputs = [];
    this.coopLastPrevEnemyHp.clear();
    CoopRenderer.resetState();
    this.coopPeers.clear();
    this.input.clearTouch();

    this.player = new Player(
      LOGICAL_WIDTH / 2 + myOff.dx,
      LOGICAL_HEIGHT / 2 + myOff.dy,
      myProfile,
      myHat
    );
    this.player.profileName = myMember.name;
    this.player.color = myMember.slotColor;
    this.player.borderColor = myMember.slotBorder;

    this.enemies = [];
    this.projectiles = [];
    this.pingProjectiles = [];
    this.quarantineZones = [];
    this.codeFragments = [];
    this.cryptoCoins = [];
    this.powerUps = [];
    this.systemFreezeTimer = 0;
    this.thermalOverclockTimer = 0;
    this.finalBoss = null;
    this.isPaused = false;
    this.hoveredPauseAction = null;
    this.hoveredGameOverBtn = null;
    this.runRevivesDone = 0;
    this.runTimesDowned = 0;
    this.coopGameOverSquad = [];
    this.combatSystem = new CombatSystem();
    if (myProfile.id === 'KERNEL_X') {
      this.combatSystem.multiShotCount += 1;
    }
    this.upgradeSystem = new UpgradeSystem();
    this.spawner = new Spawner();
    this.spawner.isNightmareMode = this.isNightmareRun;
    this.spawner.isInfiniteMap = this.isMovingMap();
    this.spawner.coopPlayerCount = Math.max(1, room.players.length);
    this.worldEnv.reset(room.worldSeed || 1337, this.isMovingMap(), this.isCoopHost);
    this.particleSystem.clear();
    this.elapsedTime = 0;
    this.killCount = 0;
    this.lastOverclockTier = 0;
    this.runCoinsCollected = 0;
    this.runDamageToToro = 0;
    this.runBossesKilled = 0;
    this.runTotalDamageDealt = 0;
    this.runRevivesDone = 0;
    this.runTimesDowned = 0;
    this.coopGameOverSquad = [];
    this.hoveredCardIndex = -1;
    this.hoveredRerollBtn = false;
    this.hoveredGameOverBtn = null;
    this.damageVignetteAlpha = 0;

    if (this.isCoopHost) {
      for (const m of room.players) {
        if (m.id === myId) continue;
        const pProfile = this.metaSystem.characters[m.characterId] || this.metaSystem.characters.STANDARD;
        const pHat = m.hatId ? HATS_DATABASE.find((h) => h.id === m.hatId) || null : null;
        const pOff = this.getSlotSpawnOffset(m.slot);
        const peerPlayer = new Player(
          LOGICAL_WIDTH / 2 + pOff.dx,
          LOGICAL_HEIGHT / 2 + pOff.dy,
          pProfile,
          pHat
        );
        peerPlayer.profileName = m.name;
        peerPlayer.color = m.slotColor;
        peerPlayer.borderColor = m.slotBorder;

        const peerCombat = new CombatSystem();
        if (pProfile.id === 'KERNEL_X') {
          peerCombat.multiShotCount += 1;
        }
        this.coopPeers.set(m.id, {
          id: m.id,
          slot: m.slot,
          name: m.name,
          characterId: m.characterId,
          hatId: m.hatId,
          slotColor: m.slotColor,
          slotBorder: m.slotBorder,
          player: peerPlayer,
          combatSystem: peerCombat,
          upgradeSystem: new UpgradeSystem(),
          inputX: 0,
          inputY: 0,
          isMoving: false,
          lastAckSeq: 0,
          downed: false,
          reviveProgress: 0,
          revivesDone: 0,
          timesDowned: 0,
        });
      }

      const cam = this.getCameraOrigin();
      this.spawner.spawnOpeningWave(
        this.enemies,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
        cam.x,
        cam.y,
        this.worldEnv
      );
      if (this.isNightmareRun) {
        this.terrainEvents.reset(this.player.x, this.player.y, this.worldEnv);
      }
      this.broadcastCoopSnapshot();
    }

    this.gameState = 'PLAYING';
    this.sound.setTrack('INGAME');
    this.lastTime = performance.now();
    this.sound.playCoinPickup();
    this.terminalLogs = [
      `[000.0s] > CO-OP ROOM #${room.code} (${room.players.length}/4) [${this.isNightmareRun ? 'PESADILLA' : 'CLÁSICO'}]`,
      `[000.0s] > Role: ${this.isCoopHost ? 'HOST SERVER' : 'SQUAD CLIENT'}`,
    ];
  }

  private getNearestAliveCoopPlayer(x: number, y: number): Player {
    let best: Player | null = !this.coopSelfDowned && this.player.active ? this.player : null;
    let bestDist = best ? Math.hypot(best.x - x, best.y - y) : Infinity;

    for (const peer of this.coopPeers.values()) {
      if (peer.downed || !peer.player.active) continue;
      const d = Math.hypot(peer.player.x - x, peer.player.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = peer.player;
      }
    }

    return best || this.player;
  }

  private getCoopAliveCount(): number {
    let alive = this.coopSelfDowned ? 0 : 1;
    for (const peer of this.coopPeers.values()) {
      if (!peer.downed) alive++;
    }
    return alive;
  }

  private triggerCoopTeamLevelUp(): void {
    const myId = this.mpClient.myId;
    const rerollsByPlayer: Record<string, number> = {
      [myId]: this.upgradeSystem.rerollsRemaining,
    };
    const choicesByPlayer: Record<string, SerializedUpgradeCard[]> = {};
    this.coopUpgradePickedIds.clear();
    this.coopWaitingUpgrade = true;
    this.coopUpgradeTimer = 18.0;

    if (this.coopSelfDowned || !this.upgradeSystem.isChoosingUpgrade()) {
      this.upgradeSystem.pendingLevelUps = Math.max(0, this.upgradeSystem.pendingLevelUps - 1);
      this.upgradeSystem.currentChoices = [];
      this.coopUpgradePickedIds.add(myId);
    }

    for (const peer of this.coopPeers.values()) {
      peer.upgradeSystem.level = this.upgradeSystem.level;
      if (peer.downed) {
        choicesByPlayer[peer.id] = [];
        rerollsByPlayer[peer.id] = peer.upgradeSystem.rerollsRemaining;
        this.coopUpgradePickedIds.add(peer.id);
        continue;
      }
      peer.upgradeSystem.rollChoices(peer.player);
      choicesByPlayer[peer.id] = peer.upgradeSystem.serializeCurrentChoices();
      rerollsByPlayer[peer.id] = peer.upgradeSystem.rerollsRemaining;
    }

    this.mpClient.sendLevelUp({
      level: this.upgradeSystem.level,
      rerollsByPlayer,
      choicesByPlayer,
    });
    this.tryResumeCoopUpgrade();
  }

  private tryResumeCoopUpgrade(): void {
    if (!this.isCoopHost || !this.coopWaitingUpgrade) return;
    const totalCount = 1 + this.coopPeers.size;
    const readyCount = this.coopUpgradePickedIds.size;
    this.coopUpgradeStatusText = `${readyCount}/${totalCount}`;
    this.mpClient.sendUpgradeStatus(readyCount, totalCount);

    if (readyCount >= totalCount) {
      if (this.upgradeSystem.pendingLevelUps > 0) {
        if (!this.coopSelfDowned) {
          this.upgradeSystem.rollChoices(this.player);
        }
        this.triggerCoopTeamLevelUp();
        return;
      }
      this.coopWaitingUpgrade = false;
      this.coopUpgradePickedIds.clear();
      this.coopUpgradeStatusText = '';
      this.upgradeSystem.clearExternalChoices();
      this.mpClient.sendResumeFromUpgrade();
      this.sound.playCoinPickup();
    }
  }

  private forceCoopUpgradeTimeout(): void {
    if (!this.coopUpgradePickedIds.has(this.mpClient.myId)) {
      if (this.upgradeSystem.isChoosingUpgrade()) {
        this.upgradeSystem.selectUpgrade(0, this.player, this.combatSystem);
        this.upgradeSystem.currentChoices = [];
      }
      this.coopUpgradePickedIds.add(this.mpClient.myId);
    }
    for (const peer of this.coopPeers.values()) {
      if (!this.coopUpgradePickedIds.has(peer.id)) {
        if (peer.upgradeSystem.isChoosingUpgrade()) {
          peer.upgradeSystem.selectUpgrade(0, peer.player, peer.combatSystem);
          peer.upgradeSystem.currentChoices = [];
        }
        this.coopUpgradePickedIds.add(peer.id);
      }
    }
    this.tryResumeCoopUpgrade();
  }

  private broadcastCoopSnapshot(): void {
    if (!this.isCoopMode || !this.isCoopHost) return;
    const room = this.mpClient.room;
    const myMember = room?.players.find((p) => p.id === this.mpClient.myId);
    const players: SnapshotPlayer[] = [
      {
        id: this.mpClient.myId,
        slot: myMember?.slot ?? 0,
        name: this.player.profileName,
        characterId: this.player.characterId,
        hatId: this.player.equippedHat?.id ?? null,
        color: this.player.color,
        borderColor: this.player.borderColor,
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        hp: Math.ceil(this.player.hp),
        maxHp: this.player.maxHp,
        facingAngle: Number(this.player.facingAngle.toFixed(2)),
        isMoving: this.player.isMoving,
        downed: this.coopSelfDowned,
        reviveProgress: Number(this.coopSelfReviveProgress.toFixed(2)),
        shieldReady: this.player.shieldReady,
        adrenaline: this.player.adrenalineTimer > 0,
        activeWeapons: this.combatSystem.getActiveWeaponsList(this.player).slice(0, 6),
        spd: Math.round(this.player.speed * this.player.speedBonusMultiplier),
        xpM: Number(this.player.xpMultiplier.toFixed(2)),
        ultChg: this.player.ultCharge,
        ultMax: this.player.ultMaxCharge,
        ultAct: Number(this.player.ultActiveTimer.toFixed(2)),
      },
    ];

    const anchors: { x: number; y: number }[] = [{ x: this.player.x, y: this.player.y }];
    for (const peer of this.coopPeers.values()) {
      anchors.push({ x: peer.player.x, y: peer.player.y });
      players.push({
        id: peer.id,
        slot: peer.slot,
        name: peer.name,
        characterId: peer.characterId,
        hatId: peer.hatId,
        color: peer.slotColor,
        borderColor: peer.slotBorder,
        x: Math.round(peer.player.x),
        y: Math.round(peer.player.y),
        hp: Math.ceil(peer.player.hp),
        maxHp: peer.player.maxHp,
        facingAngle: Number(peer.player.facingAngle.toFixed(2)),
        isMoving: peer.isMoving,
        downed: peer.downed,
        reviveProgress: Number(peer.reviveProgress.toFixed(2)),
        shieldReady: peer.player.shieldReady,
        adrenaline: peer.player.adrenalineTimer > 0,
        activeWeapons: peer.combatSystem.getActiveWeaponsList(peer.player).slice(0, 6),
        ackSeq: peer.lastAckSeq,
        spd: Math.round(peer.player.speed * peer.player.speedBonusMultiplier),
        xpM: Number(peer.player.xpMultiplier.toFixed(2)),
        ultChg: peer.player.ultCharge,
        ultMax: peer.player.ultMaxCharge,
        ultAct: Number(peer.player.ultActiveTimer.toFixed(2)),
      });
    }

    const minDistSqToAnyPlayer = (x: number, y: number): number => {
      let best = Infinity;
      for (const a of anchors) {
        const dx = x - a.x;
        const dy = y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < best) best = d2;
      }
      return best;
    };

    // Priorizar jefes y enemigos más cercanos a CUALQUIER jugador del escuadrón
    const enemyCandidates: { e: Adware; prio: number }[] = [];
    for (const e of this.enemies) {
      if (!e.active) continue;
      const isBossPriority =
        e.malwareType === 'FINAL_BOSS' ||
        e.malwareType === 'RANSOMWARE' ||
        e.malwareType === 'CRYPTO_MINER';
      const d2 = minDistSqToAnyPlayer(e.x, e.y);
      if (!isBossPriority && d2 > 1450 * 1450) continue;
      enemyCandidates.push({ e, prio: isBossPriority ? -1000000 + d2 : d2 });
    }
    enemyCandidates.sort((a, b) => a.prio - b.prio);

    const enemies: SnapshotEnemyTuple[] = [];
    const enemyCap = Math.min(165, enemyCandidates.length);
    for (let i = 0; i < enemyCap; i++) {
      const e = enemyCandidates[i].e;
      let flags = 0;
      if (e.malwareType === 'ARMORED_WORM' || e.malwareType === 'EVASOR') flags |= 1;
      if (e.networkFreezeTimer > 0 || e.cryoSlowTimer > 0) flags |= 2;
      if (e.hitFlashTimer > 0) flags |= 4;
      if (e instanceof ElToroBoss) {
        if (e.state === 'TELEGRAPH') flags |= 8;
        else if (e.state === 'DASH') flags |= 16;
      } else if (e instanceof RootkitTitanBoss && e.getIsStealthed()) {
        flags |= 16;
      }
      enemies.push([
        encodeEnemyType(e),
        Math.round(e.x),
        Math.round(e.y),
        Math.round(e.size),
        Math.ceil(e.hp),
        Math.ceil(e.maxHp),
        Number(e.facingAngle.toFixed(2)),
        flags,
        e.netId,
      ]);
    }

    // Priorizar proyectiles más cercanos a cualquier jugador (sin que el Host monopolice el tope)
    const projCandidates: { tuple: SnapshotProjTuple; d2: number }[] = [];
    const pushProjCand = (
      kind: number,
      x: number,
      y: number,
      vx: number,
      vy: number,
      evolved: boolean,
      size: number
    ) => {
      const d2 = minDistSqToAnyPlayer(x, y);
      if (d2 > 1350 * 1350) return;
      projCandidates.push({
        tuple: [
          kind,
          Math.round(x),
          Math.round(y),
          Math.round(vx),
          Math.round(vy),
          evolved ? 1 : 0,
          Math.round(size),
        ],
        d2,
      });
    };

    for (const p of this.projectiles) if (p.active) pushProjCand(0, p.x, p.y, p.vx, p.vy, p.isEvolved, p.size);
    for (const p of this.pingProjectiles) if (p.active) pushProjCand(1, p.x, p.y, p.vx, p.vy, p.isEvolved, p.size);

    const collectCombatShots = (cs: CombatSystem) => {
      for (const s of cs.cryoShards) if (s.active) pushProjCand(2, s.x, s.y, s.vx, s.vy, s.isEvolved, s.size);
      for (const b of cs.sqlBeams) if (b.active) pushProjCand(3, b.x, b.y, b.vx, b.vy, b.isEvolved, b.thickness);
      for (const d of cs.sawDiscs) if (d.active) pushProjCand(4, d.x, d.y, 0, 0, d.isEvolved, d.size);
      for (const ep of cs.enemyProjectiles) if (ep.active) pushProjCand(5, ep.x, ep.y, ep.vx, ep.vy, false, ep.size);
    };
    collectCombatShots(this.combatSystem);
    for (const peer of this.coopPeers.values()) collectCombatShots(peer.combatSystem);

    // Mascotas Morcillita, sus fragmentos virales y ondas de choque
    const pets: SnapshotPetTuple[] = [];
    const rings: SnapshotRingTuple[] = [];
    const collectPlayerCompanion = (pl: Player) => {
      if (!pl.active || !pl.companion) return;
      const bCode = pl.companion.getBranchCode();
      for (const u of pl.companion.getUnits()) {
        pets.push([Math.round(u.x), Math.round(u.y), bCode, Math.round(u.size)]);
      }
      for (const sp of pl.companion.getSnapshotProjectiles()) {
        pushProjCand(6, sp.x, sp.y, sp.vx, sp.vy, false, sp.size);
      }
      for (const sw of pl.companion.getSnapshotShockwaves()) {
        rings.push([Math.round(sw.x), Math.round(sw.y), Math.round(sw.radius), 4]);
      }
    };
    collectPlayerCompanion(this.player);
    for (const peer of this.coopPeers.values()) {
      if (!peer.downed) collectPlayerCompanion(peer.player);
    }

    projCandidates.sort((a, b) => a.d2 - b.d2);
    const projectiles: SnapshotProjTuple[] = projCandidates.slice(0, 125).map((c) => c.tuple);

    // Priorizar recogibles más cercanos a cualquier jugador
    const pickupCandidates: { tuple: SnapshotPickupTuple; d2: number }[] = [];
    for (const f of this.codeFragments) {
      if (!f.active) continue;
      const d2 = minDistSqToAnyPlayer(f.x, f.y);
      if (d2 <= 1350 * 1350) pickupCandidates.push({ tuple: [0, Math.round(f.x), Math.round(f.y), f.xpValue], d2 });
    }
    for (const c of this.cryptoCoins) {
      if (!c.active) continue;
      pickupCandidates.push({ tuple: [1, Math.round(c.x), Math.round(c.y), c.value], d2: minDistSqToAnyPlayer(c.x, c.y) * 0.5 });
    }
    for (const p of this.powerUps) {
      if (!p.active) continue;
      const pk = p.type === 'NUKE' ? 2 : p.type === 'FREEZE' ? 3 : 4;
      pickupCandidates.push({ tuple: [pk, Math.round(p.x), Math.round(p.y), 1], d2: minDistSqToAnyPlayer(p.x, p.y) * 0.25 });
    }
    pickupCandidates.sort((a, b) => a.d2 - b.d2);
    const pickups: SnapshotPickupTuple[] = pickupCandidates.slice(0, 110).map((c) => c.tuple);

    const zones: SnapshotZoneTuple[] = [];
    for (const q of this.quarantineZones) {
      if (q.active) zones.push([0, Math.round(q.x), Math.round(q.y), Math.round(q.radius), 0, 1, q.isEvolved ? 1 : 0]);
    }
    if (this.isNightmareRun) {
      for (const tn of this.terrainEvents.nodes) {
        if (!tn.active) continue;
        const zk =
          tn.type === 'COOLING_SERVER'
            ? 1
            : tn.type === 'EMP_PYLON'
            ? 2
            : tn.type === 'CORRUPTED_VAULT'
            ? 3
            : 4;
        zones.push([
          zk,
          Math.round(tn.x),
          Math.round(tn.y),
          Math.round(tn.radius),
          Number(tn.progress.toFixed(2)),
          Number(tn.duration.toFixed(2)),
          0,
        ]);
      }
    }

    const arcs: [number, number][][] = [];
    for (const arc of this.combatSystem.teslaArcs) {
      arcs.push(arc.points.map((pt) => [Math.round(pt.x), Math.round(pt.y)]));
    }
    for (const peer of this.coopPeers.values()) {
      for (const arc of peer.combatSystem.teslaArcs) {
        arcs.push(arc.points.map((pt) => [Math.round(pt.x), Math.round(pt.y)]));
      }
    }

    const pulses: [number, number, number, number][] = [];
    for (const pl of this.combatSystem.firewallPulses) {
      if (pl.active) pulses.push([Math.round(pl.x), Math.round(pl.y), Math.round(pl.radius), pl.isEvolved ? 1 : 0]);
    }
    for (const peer of this.coopPeers.values()) {
      for (const pl of peer.combatSystem.firewallPulses) {
        if (pl.active) pulses.push([Math.round(pl.x), Math.round(pl.y), Math.round(pl.radius), pl.isEvolved ? 1 : 0]);
      }
    }

    // Drones orbitales del escuadrón
    const drones: SnapshotDroneTuple[] = [];
    if (!this.coopSelfDowned && this.player.active) {
      drones.push(...this.combatSystem.getSnapshotDrones(this.player));
    }
    for (const peer of this.coopPeers.values()) {
      if (!peer.downed && peer.player.active) {
        drones.push(...peer.combatSystem.getSnapshotDrones(peer.player));
      }
    }

    // Anillos Crio, explosiones de drones, charcos de Worm Prime y estelas Root
    rings.push(...this.combatSystem.getSnapshotRings());
    for (const peer of this.coopPeers.values()) {
      rings.push(...peer.combatSystem.getSnapshotRings());
    }
    for (const rn of this.player.rootTrailNodes) {
      rings.push([Math.round(rn.x), Math.round(rn.y), Math.round(rn.radius), 3]);
    }
    for (const peer of this.coopPeers.values()) {
      for (const rn of peer.player.rootTrailNodes) {
        rings.push([Math.round(rn.x), Math.round(rn.y), Math.round(rn.radius), 3]);
      }
    }
    let activeWaveBoss: WaveBoss | null = null;
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e instanceof WormPrimeBoss) {
        for (const pd of e.getPuddles()) {
          rings.push([Math.round(pd.x), Math.round(pd.y), Math.round(pd.radius), 2]);
        }
      }
      if (!activeWaveBoss && e instanceof WaveBoss) {
        activeWaveBoss = e;
      }
    }

    // HUD de Jefe / El Toro para sincronizar barra y alerta en clientes Invitados
    let bossHud: SnapshotBossHUD | null = null;
    if (this.finalBoss && this.finalBoss.active) {
      bossHud = {
        name: 'EL TORO',
        color: this.finalBoss.state === 'TELEGRAPH' ? '#fbbf24' : '#f43f5e',
        hp: 1,
        maxHp: 1,
        isToro: true,
        toroDmg: Math.round(this.finalBoss.totalDamageTaken),
        toroStatus: this.finalBoss.getDashStatusText(),
      };
    } else if (activeWaveBoss) {
      bossHud = {
        name: activeWaveBoss.bossName,
        color: activeWaveBoss.bossColor || '#f43f5e',
        hp: Math.max(0, Math.ceil(activeWaveBoss.hp)),
        maxHp: Math.max(1, Math.ceil(activeWaveBoss.maxHp)),
        alertTimer: Number(this.spawner.activeBossAlertTimer.toFixed(2)),
      };
    } else if (this.spawner.activeBossAlertTimer > 0) {
      bossHud = {
        name: this.spawner.lastBossSpawnedName || 'BOSS',
        color: this.spawner.lastBossSpawnedColor || '#f43f5e',
        hp: 0,
        maxHp: 1,
        alertTimer: Number(this.spawner.activeBossAlertTimer.toFixed(2)),
      };
    }

    this.mpClient.sendSnapshot({
      seq: ++this.coopSnapshotSeq,
      t: Number(this.elapsedTime.toFixed(2)),
      kc: this.killCount,
      bk: this.runBossesKilled,
      coins: this.runCoinsCollected,
      lv: this.upgradeSystem.level,
      xp: Math.round(this.upgradeSystem.currentXp),
      xpNext: Math.round(this.upgradeSystem.xpToNextLevel),
      nm: this.isNightmareRun,
      fz: Number(this.systemFreezeTimer.toFixed(1)),
      oc: Number(this.thermalOverclockTimer.toFixed(1)),
      sw: Number(this.spawner.swarmActiveTimer.toFixed(1)),
      toro: this.spawner.finalBossMode,
      players,
      enemies,
      projectiles,
      pickups,
      zones,
      arcs: arcs.slice(0, 12),
      pulses: pulses.slice(0, 14),
      oasis: this.worldEnv.exportOasisStates(),
      drones: drones.slice(0, 32),
      pets: pets.slice(0, 20),
      rings: rings.slice(0, 48),
      boss: bossHud,
    });
  }

  private drawCoopSquadHud(): void {
    if (!this.isCoopMode) return;
    const room = this.mpClient.room;
    const startX = 16;
    const startY = 126;
    const panelW = 248;

    const list = this.isCoopHost
      ? [
          {
            slot: room?.players.find((p) => p.id === this.mpClient.myId)?.slot ?? 0,
            name: this.player.profileName,
            hp: Math.ceil(this.player.hp),
            maxHp: this.player.maxHp,
            downed: this.coopSelfDowned,
            color: this.player.color,
          },
          ...Array.from(this.coopPeers.values()).map((pr) => ({
            slot: pr.slot,
            name: pr.name,
            hp: Math.ceil(pr.player.hp),
            maxHp: pr.player.maxHp,
            downed: pr.downed,
            color: pr.slotColor,
          })),
        ].sort((a, b) => a.slot - b.slot)
      : (this.coopSnapshot?.players || [])
          .map((sp) => ({
            slot: sp.slot,
            name: sp.name,
            hp: sp.hp,
            maxHp: sp.maxHp,
            downed: sp.downed,
            color: sp.color,
          }))
          .sort((a, b) => a.slot - b.slot);

    const panelH = 34 + Math.max(1, list.length) * 30;
    this.ctx.save();
    this.drawCyberPanel(startX, startY, panelW, panelH, 8, 'rgba(11, 19, 34, 0.88)', 'rgba(56, 189, 248, 0.5)', 1.3);

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#7dd3fc';
    this.ctx.font = `bold 10.5px ${FONT_MONO}`;
    this.ctx.fillText(
      `CO-OP #${room?.code || '----'}  •  ${this.mpClient.latencyMs || '—'}ms`,
      startX + 12,
      startY + 20
    );

    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const ry = startY + 32 + i * 30;
      this.ctx.fillStyle = m.color;
      this.ctx.fillRect(startX + 12, ry + 3, 5, 16);

      this.ctx.fillStyle = m.downed ? '#fda4af' : '#f8fafc';
      this.ctx.font = `bold 11px ${FONT_DISPLAY}`;
      this.ctx.fillText(`J${m.slot + 1} ${m.name}`, startX + 22, ry + 13, 128);

      const bw = 78;
      const bx = startX + panelW - bw - 12;
      this.ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
      this.ctx.fillRect(bx, ry + 5, bw, 10);
      if (m.downed) {
        this.ctx.fillStyle = '#f43f5e';
        this.ctx.font = `bold 9.5px ${FONT_MONO}`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(i18n.t('CAÍDO', 'DOWN'), bx + bw / 2, ry + 13.5);
        this.ctx.textAlign = 'left';
      } else {
        const ratio = Math.max(0, Math.min(1, m.hp / Math.max(1, m.maxHp)));
        this.ctx.fillStyle = ratio > 0.5 ? '#10b981' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
        this.ctx.fillRect(bx, ry + 5, bw * ratio, 10);
      }
    }
    this.ctx.restore();
  }

  private drawCoopWaitingOverlay(): void {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 9, 18, 0.72)';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const w = 520;
    const h = 132;
    this.drawCyberPanel(cx - w / 2, cy - h / 2, w, h, 14, 'rgba(11, 19, 34, 0.96)', '#10b981', 2, '#10b981', 12);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#6ee7b7';
    this.ctx.font = `bold 20px ${FONT_DISPLAY}`;
    this.ctx.fillText(
      this.coopSelfDowned
        ? i18n.t('ESPERANDO REANIMACIÓN / EQUIPO...', 'WAITING FOR TEAM UPGRADE...')
        : i18n.t('✓ MEJORA INSTALADA — ESPERANDO EQUIPO', '✓ MODULE READY — WAITING FOR SQUAD'),
      cx,
      cy - 8
    );

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = `bold 13px ${FONT_MONO}`;
    this.ctx.fillText(
      i18n.t(
        `Jugadores listos: ${this.coopUpgradeStatusText || '...'}`,
        `Players ready: ${this.coopUpgradeStatusText || '...'}`
      ),
      cx,
      cy + 26
    );
    this.ctx.restore();
  }

  private tryTriggerPlayerUltimate(): boolean {
    if (
      this.gameState !== 'PLAYING' ||
      this.isPaused ||
      this.coopWaitingUpgrade ||
      this.upgradeSystem.isChoosingUpgrade() ||
      this.coopSelfDowned
    ) {
      return false;
    }

    if (this.isCoopMode && !this.isCoopHost) {
      if (!this.player.canActivateUltimate()) return false;
      this.player.activateUltimate();
      const uName = i18n.currentLang === 'EN' ? this.player.ultNameEn : this.player.ultName;
      this.sound.playAchievement();
      this.particleSystem.spawnExplosion(this.player.x, this.player.y, this.player.color, 34, true);
      this.showStatusToast(`⚡ ¡${uName} ACTIVADA (${this.player.ultDuration}s)!`, '#fbbf24', 2400);
      const dir = this.input.getDirection();
      const nextSeq = ++this.coopInputSeq;
      this.mpClient.sendInput(
        dir.x,
        dir.y,
        this.player.facingAngle,
        dir.x !== 0 || dir.y !== 0,
        nextSeq,
        true
      );
      return true;
    }

    if (!this.player.activateUltimate()) return false;
    const uName = i18n.currentLang === 'EN' ? this.player.ultNameEn : this.player.ultName;
    this.sound.playAchievement();
    this.particleSystem.triggerShake(8, 0.24);
    this.particleSystem.spawnExplosion(this.player.x, this.player.y, this.player.color, 36, true);
    this.particleSystem.spawnFloatingText(
      this.player.x,
      this.player.y - 36,
      `⚡ ¡${uName}! (${this.player.ultDuration}s)`,
      '#fbbf24',
      1.38
    );
    const msg = `ULTIMATE: ${this.player.profileName} unleashed ${uName} (${this.player.ultDuration}s)!`;
    this.addTerminalLog(msg);
    this.showStatusToast(`⚡ ¡${uName} ACTIVADA (${this.player.ultDuration}s)!`, '#fbbf24', 2400);
    if (this.isCoopMode && this.isCoopHost) {
      this.mpClient.sendGameEvent({
        type: 'REVIVE',
        x: this.player.x,
        y: this.player.y,
        text: msg,
      });
    }
    return true;
  }

  private showStatusToast(text: string, color: string = '#38bdf8', durationMs: number = 2100): void {
    this.statusToastText = text;
    this.statusToastColor = color;
    this.statusToastExpiresAt = performance.now() + durationMs;
  }

  private toggleAudioMute(): void {
    this.sound.muted = !this.sound.muted;
    if (!this.sound.muted) {
      this.sound.playShoot(false);
    }
    this.addTerminalLog(`Audio Synthesizer: ${this.sound.muted ? 'MUTED' : 'ONLINE'}`);
    this.showStatusToast(
      this.sound.muted
        ? i18n.t('🔇 AUDIO SILENCIADO [M]', '🔇 AUDIO MUTED [M]')
        : i18n.t('🔊 AUDIO ACTIVADO [M]', '🔊 AUDIO ONLINE [M]'),
      this.sound.muted ? '#fb7185' : '#10b981'
    );
  }

  private toggleLightGraphics(): void {
    this.lightGraphicsEnabled = !this.lightGraphicsEnabled;
    this.particleSystem.lightMode = this.lightGraphicsEnabled;
    try {
      localStorage.setItem(LIGHT_GFX_STORAGE_KEY, this.lightGraphicsEnabled ? '1' : '0');
    } catch {
      // Ignorar errores de almacenamiento
    }
    this.resize();
    this.showStatusToast(
      this.lightGraphicsEnabled
        ? i18n.t('⚡ GRÁFICOS LIGEROS: ACTIVADOS [V]', '⚡ LIGHT GRAPHICS: ON [V]')
        : i18n.t('✦ GRÁFICOS COMPLETOS: ACTIVADOS [V]', '✦ FULL GRAPHICS: ON [V]'),
      this.lightGraphicsEnabled ? '#fbbf24' : '#38bdf8'
    );
    this.addTerminalLog(
      this.lightGraphicsEnabled
        ? 'PERF: Light Graphics ENABLED (1280x720 + reduced FX).'
        : 'PERF: Standard Graphics ENABLED (1920x1080 Full FX).'
    );
  }

  private setupEventListeners(): void {
    const unlockAudio = () => {
      this.sound.ensureContext();
      if (this.gameState === 'MENU' && this.sound.getCurrentTrack() === 'NONE') {
        this.sound.setTrack('MENU');
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('pagehide', () => {
      this.achievementSystem.flushPendingSave(true);
      this.metaSystem.flushPendingSave();
      this.dailyMissions.flushPendingSave(true);
    });

    document.addEventListener('visibilitychange', () => {
      if (
        document.hidden &&
        this.gameState === 'PLAYING' &&
        !this.isCoopMode &&
        !this.isPaused &&
        !this.upgradeSystem.isChoosingUpgrade()
      ) {
        this.togglePause();
        this.addTerminalLog('AUTO-PAUSE: Tab switched to background.');
      }
    });

    window.addEventListener('keydown', (e) => {
      unlockAudio();
      const key = e.key.toLowerCase();

      if (key === 'v') {
        this.toggleLightGraphics();
        this.sound.playShoot(false);
        return;
      }

      if (key === 'm' && (this.gameState !== 'MENU' || e.shiftKey)) {
        this.toggleAudioMute();
        return;
      }

      if (key === 'f') {
        this.toggleFullscreen();
        this.showStatusToast(
          document.fullscreenElement
            ? i18n.t('⛶ SALIENDO DE PANTALLA COMPLETA [F]', '⛶ EXITING FULLSCREEN [F]')
            : i18n.t('⛶ PANTALLA COMPLETA [F]', '⛶ FULLSCREEN [F]'),
          '#38bdf8'
        );
      }

      if (this.gameState === 'MENU') {
        if (this.showLeaderboardOverlay) {
          if (key === 'escape' || key === 'b') {
            this.showLeaderboardOverlay = false;
            this.sound.playShoot(false);
          } else if (key === '1') {
            this.activeLeaderboardCategory = 'TORO_DAMAGE';
            this.sound.playShoot(false);
          } else if (key === '2') {
            this.activeLeaderboardCategory = 'SURVIVAL_TIME';
            this.sound.playShoot(false);
          }
          return;
        }

        if (this.showDailyMissionsOverlay) {
          if (key === 'escape' || key === 'b' || key === 'm') {
            this.showDailyMissionsOverlay = false;
            this.sound.playShoot(false);
          }
          return;
        }

        if (this.showAchievementsOverlay) {
          if (key === 'escape' || key === 'b' || key === 'a') {
            this.showAchievementsOverlay = false;
            this.sound.playShoot(false);
          } else if (key === '1' || key === 'arrowleft' || key === 'left') {
            this.achievementsPage = 0;
            this.sound.playShoot(false);
          } else if (key === '2' || key === 'arrowright' || key === 'right') {
            this.achievementsPage = 1;
            this.sound.playShoot(false);
          }
          return;
        }

        if (this.showHelpOverlay) {
          if (key === 'escape' || key === 'b' || key === 'h') {
            this.showHelpOverlay = false;
            this.sound.playShoot(false);
          }
          return;
        }

        if (this.showSettingsOverlay) {
          if (key === 'escape' || key === 'b' || key === 'o') {
            this.showSettingsOverlay = false;
            this.sound.playShoot(false);
          }
          return;
        }

        if (this.showCoopModal) {
          if (key === 'escape' || key === 'k') {
            this.showCoopModal = false;
            this.sound.playShoot(false);
          }
          return;
        }

        const keyMap: Record<string, CharacterId> = {
          '1': 'STANDARD',
          '2': 'ROOT',
          '3': 'PROXY',
          '4': 'MORCILLITA',
          '5': 'CRYPTO',
          '6': 'SPECTRE',
          '7': 'OVERCLOCK',
          '8': 'KERNEL_X',
        };
        if (key === 'q') {
          this.activeMenuTab = 'SHOP';
        } else if (key === 'u') {
          this.activeMenuTab = 'LAB';
          this.sound.playShoot(false);
        } else if (key === 'g') {
          this.activeMenuTab = 'GACHA';
        } else if (key === 'i') {
          this.activeMenuTab = 'INVENTORY';
          this.inventoryPage = 0;
        } else if (key === 'k') {
          this.openCoopModal();
          this.sound.playCoinPickup();
        } else if (key === 'l') {
          this.handleAuthButtonClick();
        } else if (key === 'r') {
          this.openLeaderboardOverlay();
        } else if (key === 'm') {
          this.showDailyMissionsOverlay = true;
          this.sound.playCoinPickup();
        } else if (key === 'a') {
          this.showAchievementsOverlay = true;
          this.sound.playCoinPickup();
        } else if (key === 'o') {
          this.showSettingsOverlay = true;
          this.sound.playShoot(false);
        } else if (key === 'h') {
          this.showHelpOverlay = true;
          this.sound.playShoot(false);
        } else if (key === 'b') {
          this.selectedGameMode =
            this.selectedGameMode === 'CLASSIC' ? 'NIGHTMARE' : 'CLASSIC';
          this.sound.playShoot(false);
        } else if (this.activeMenuTab === 'SHOP' && keyMap[key]) {
          const res = this.metaSystem.selectOrBuyCharacter(keyMap[key]);
          this.menuFeedbackMessage = res.message;
          if (res.success) {
            this.sound.playCoinPickup();
            this.syncCoopLoadout();
          }
        } else if (
          this.activeMenuTab === 'LAB' &&
          key >= '1' &&
          key <= '6'
        ) {
          const labId = LAB_UPGRADES_ORDER[parseInt(key, 10) - 1];
          if (labId) {
            const res = this.metaSystem.buyLabUpgrade(labId);
            this.menuFeedbackMessage = res.message;
            if (res.success) this.sound.playCoinPickup();
            else this.sound.playExplosion(false);
          }
        } else if (key === 'enter' || key === ' ') {
          this.startNewRun();
        }
        return;
      }

      if (this.gameState === 'GAMEOVER') {
        if (key === 'r' || key === 'enter' || key === ' ') {
          if (this.isCoopMode) {
            if (this.isCoopHost) this.mpClient.sendReturnToLobby();
          } else {
            this.startNewRun();
          }
        } else if (key === 'escape' || key === 't') {
          this.exitToMainMenu();
        }
        return;
      }

      if (this.isPaused) {
        if (this.showHelpOverlay) {
          if (key === 'escape' || key === 'b' || key === 'h') {
            this.showHelpOverlay = false;
            this.sound.playShoot(false);
          }
          return;
        }
        if (this.showSettingsOverlay) {
          if (key === 'escape' || key === 'b' || key === 'o') {
            this.showSettingsOverlay = false;
            this.sound.playShoot(false);
          }
          return;
        }
        if (key === '1' || key === 'enter' || key === 'escape' || key === 'p') {
          this.togglePause();
        } else if (key === 'o') {
          this.showSettingsOverlay = true;
          this.sound.playShoot(false);
        } else if (key === '2') {
          this.exitToMainMenu();
        }
        return;
      }

      if (
        this.gameState === 'PLAYING' &&
        !this.upgradeSystem.isChoosingUpgrade() &&
        (key === 'p' || key === 'escape')
      ) {
        this.togglePause();
        return;
      }

      if (this.upgradeSystem.isChoosingUpgrade()) {
        if (key === '1' || key === '2' || key === '3') {
          this.applySelectedUpgrade(parseInt(key, 10) - 1);
        } else if (key === 'r') {
          this.handleUpgradeReroll();
        }
        return;
      }

      if (
        this.gameState === 'PLAYING' &&
        !this.upgradeSystem.isChoosingUpgrade() &&
        (key === ' ' || key === 'e')
      ) {
        e.preventDefault();
        this.tryTriggerPlayerUltimate();
        return;
      }

      if (key === 'h') {
        if (this.gameState === 'PLAYING') {
          this.showAttackRange = !this.showAttackRange;
        } else {
          this.showHitboxes = !this.showHitboxes;
        }
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const pos = this.getCanvasMousePos(e);
      const mx = pos.x;
      const my = pos.y;

      if (this.gameState === 'MENU') {
        this.hoveredMenuChar = null;
        this.hoveredLabId = null;
        this.hoveredHatId = null;
        this.hoveredModeBtn = null;

        if (this.showLeaderboardOverlay) {
          this.hoveredLeaderboardTab = null;
          for (const tabBtn of this.getLeaderboardTabRects()) {
            if (this.isPointInRect(mx, my, tabBtn)) {
              this.hoveredLeaderboardTab = tabBtn.category;
              break;
            }
          }
          this.hoveredLeaderboardBackBtn = this.isPointInRect(
            mx,
            my,
            this.getLeaderboardBackButtonRect()
          );
          return;
        }

        if (this.showDailyMissionsOverlay) {
          const panelH = 500;
          const py = LOGICAL_HEIGHT / 2 - panelH / 2;
          this.hoveredOverlayBackBtn = this.isPointInRect(
            mx,
            my,
            this.getOverlayBackButtonRect(py, panelH)
          );
          return;
        }

        if (this.showAchievementsOverlay) {
          const panelH = 650;
          const py = LOGICAL_HEIGHT / 2 - panelH / 2;
          this.hoveredOverlayBackBtn = this.isPointInRect(
            mx,
            my,
            this.getOverlayBackButtonRect(py, panelH)
          );
          this.hoveredAchievementsTab = null;
          for (const tab of this.getAchievementsTabRects(py)) {
            if (this.isPointInRect(mx, my, tab)) {
              this.hoveredAchievementsTab = tab.page;
              break;
            }
          }
          return;
        }

        if (this.showCoopModal) {
          this.hoveredCoopAction = null;
          for (const btn of CoopLobbyUI.getButtons(LOGICAL_WIDTH, LOGICAL_HEIGHT, this.mpClient)) {
            if (this.isPointInRect(mx, my, btn)) {
              this.hoveredCoopAction = btn.action;
              break;
            }
          }
          return;
        }

        if (this.showHelpOverlay) {
          const panelH = 590;
          const py = LOGICAL_HEIGHT / 2 - panelH / 2;
          this.hoveredOverlayBackBtn = this.isPointInRect(
            mx,
            my,
            this.getOverlayBackButtonRect(py, panelH)
          );
          return;
        }

        if (this.showSettingsOverlay) {
          const panelH = 590;
          const py = LOGICAL_HEIGHT / 2 - panelH / 2;
          this.hoveredOverlayBackBtn = this.isPointInRect(
            mx,
            my,
            this.getOverlayBackButtonRect(py, panelH)
          );
          return;
        }

        this.hoveredAuthBtn =
          this.currentUser || this.isExternalLoginAllowed()
            ? this.isPointInRect(mx, my, this.getAuthActionButtonRect())
            : false;
        this.hoveredCoopBtn = this.isPointInRect(mx, my, this.getCoopOnlineButtonRect());
        this.hoveredRankingsBtn = this.isPointInRect(mx, my, this.getGlobalRankingsButtonRect());
        this.hoveredDailyMissionsBtn = this.isPointInRect(
          mx,
          my,
          this.getDailyMissionsButtonRect()
        );
        this.hoveredAchievementsBtn = this.isPointInRect(mx, my, this.getAchievementsButtonRect());
        this.hoveredSettingsBtn = this.isPointInRect(mx, my, this.getSettingsButtonRect());
        this.hoveredFullscreenBtn = this.isPointInRect(mx, my, this.getFullscreenButtonRect());
        this.hoveredStartBtn = this.isPointInRect(mx, my, this.getStartButtonRect());

        for (const mBtn of this.getGameModeButtonRects()) {
          if (this.isPointInRect(mx, my, mBtn)) {
            this.hoveredModeBtn = mBtn.mode;
            break;
          }
        }

        if (this.activeMenuTab === 'SHOP') {
          for (const charRect of this.getMenuCharacterRects()) {
            if (this.isPointInRect(mx, my, charRect)) {
              this.hoveredMenuChar = charRect.id;
              break;
            }
          }
        } else if (this.activeMenuTab === 'LAB') {
          for (const labRect of this.getMenuLabRects()) {
            if (this.isPointInRect(mx, my, labRect)) {
              this.hoveredLabId = labRect.id;
              break;
            }
          }
        } else if (this.activeMenuTab === 'INVENTORY') {
          for (const slot of this.getInventoryHatRects()) {
            if (this.isPointInRect(mx, my, slot)) {
              this.hoveredHatId = slot.hat.id;
              break;
            }
          }
        }
        return;
      }

      if (this.isPaused) {
        this.hoveredInGameBtn = null;
        this.hoveredPauseAction = null;
        for (const btn of this.getPauseButtonRects()) {
          if (this.isPointInRect(mx, my, btn)) {
            this.hoveredPauseAction = btn.action;
            break;
          }
        }
        this.canvas.style.cursor = this.hoveredPauseAction ? 'pointer' : 'default';
        return;
      }

      if (this.gameState !== 'PLAYING' || !this.upgradeSystem.isChoosingUpgrade()) {
        this.hoveredCardIndex = -1;
        this.hoveredRerollBtn = false;
        if (this.gameState === 'PLAYING') {
          this.hoveredGameOverBtn = null;
          if (this.isPointInRect(mx, my, this.getInGamePauseButtonRect())) {
            this.hoveredInGameBtn = 'PAUSE';
          } else if (this.isPointInRect(mx, my, this.getInGameMuteButtonRect())) {
            this.hoveredInGameBtn = 'MUTE';
          } else if (
            this.player.canActivateUltimate() &&
            this.isPointInRect(mx, my, this.getInGameUltBarRect())
          ) {
            this.hoveredInGameBtn = 'ULT';
          } else {
            this.hoveredInGameBtn = null;
          }
          this.canvas.style.cursor = this.hoveredInGameBtn ? 'pointer' : 'default';
        } else if (this.gameState === 'GAMEOVER') {
          this.hoveredInGameBtn = null;
          this.hoveredGameOverBtn = null;
          for (const gBtn of this.getGameOverButtonRects()) {
            if (this.isPointInRect(mx, my, gBtn)) {
              this.hoveredGameOverBtn = gBtn.action;
              break;
            }
          }
          this.canvas.style.cursor = this.hoveredGameOverBtn ? 'pointer' : 'default';
        } else {
          this.hoveredInGameBtn = null;
          this.hoveredGameOverBtn = null;
          this.canvas.style.cursor = 'default';
        }
        return;
      }

      this.hoveredInGameBtn = null;
      this.hoveredCardIndex = -1;
      for (const card of this.getUpgradeCardRects()) {
        if (this.isPointInRect(mx, my, card)) {
          this.hoveredCardIndex = card.index;
          break;
        }
      }
      this.hoveredRerollBtn = this.isPointInRect(mx, my, this.getRerollButtonRect());
      this.canvas.style.cursor =
        this.hoveredCardIndex !== -1 || this.hoveredRerollBtn ? 'pointer' : 'default';
    });

    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        unlockAudio();
        this.input.hasUsedTouch = true;

        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          const pt = this.getCanvasClientPos(touch.clientX, touch.clientY);

          if (
            this.gameState === 'PLAYING' &&
            !this.isPaused &&
            !this.upgradeSystem.isChoosingUpgrade()
          ) {
            if (this.isPointInRect(pt.x, pt.y, this.getInGameMuteButtonRect())) {
              this.toggleAudioMute();
              this.lastTouchTapTime = performance.now();
              continue;
            }
            if (this.isPointInRect(pt.x, pt.y, this.getInGamePauseButtonRect())) {
              this.togglePause();
              this.lastTouchTapTime = performance.now();
              continue;
            }
            if (
              this.player.canActivateUltimate() &&
              this.isPointInRect(pt.x, pt.y, this.getInGameUltBarRect())
            ) {
              this.tryTriggerPlayerUltimate();
              this.lastTouchTapTime = performance.now();
              continue;
            }
            if (!this.input.isTouchActive()) {
              this.input.startTouch(touch.identifier, pt.x, pt.y);
            }
          } else {
            this.lastTouchTapTime = performance.now();
            this.handleCanvasTap(pt.x, pt.y);
          }
        }
      },
      { passive: false }
    );

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (this.input.getActiveTouchId() === touch.identifier) {
            const pt = this.getCanvasClientPos(touch.clientX, touch.clientY);
            this.input.moveTouch(touch.identifier, pt.x, pt.y);
          }
        }
      },
      { passive: false }
    );

    const handleTouchRelease = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        this.input.endTouch(e.changedTouches[i].identifier);
      }
    };
    this.canvas.addEventListener('touchend', handleTouchRelease, { passive: false });
    this.canvas.addEventListener('touchcancel', handleTouchRelease, { passive: false });

    this.canvas.addEventListener('click', (e) => {
      if (performance.now() - this.lastTouchTapTime < 450) {
        return;
      }
      unlockAudio();
      const pos = this.getCanvasMousePos(e);
      this.handleCanvasTap(pos.x, pos.y);
    });
  }

  private isPointInRect(
    mx: number,
    my: number,
    rect: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      mx >= rect.x &&
      mx <= rect.x + rect.width &&
      my >= rect.y &&
      my <= rect.y + rect.height
    );
  }

  private applySelectedUpgrade(index: number): void {
    const chosen = this.upgradeSystem.currentChoices[index];
    if (!chosen) return;

    if (this.isCoopMode && !this.isCoopHost) {
      this.upgradeSystem.clearExternalChoices();
      this.mpClient.sendPickUpgrade(index);
      this.hoveredCardIndex = -1;
      this.hoveredRerollBtn = false;
      this.sound.playCoinPickup();
      return;
    }

    if (this.upgradeSystem.selectUpgrade(index, this.player, this.combatSystem)) {
      if (chosen.isEvolution) {
        this.sound.playAchievement();
        this.dailyMissions.reportProgress('EVOLUTION', 1);
        this.addTerminalLog(`★ EVOLUTION COMPLETED: ${chosen.name}!`);
      } else {
        this.sound.playCoinPickup();
        this.addTerminalLog(`INSTALLED: ${chosen.name} (v${chosen.level}.0)`);
      }
      logAnalyticsEvent('select_content', {
        content_type: chosen.isEvolution ? 'weapon_evolution' : 'upgrade',
        item_id: chosen.id,
        item_name: chosen.name,
        level: chosen.level,
      });
      this.particleSystem.spawnExplosion(this.player.x, this.player.y, chosen.color, 26, true);
      this.hoveredCardIndex = -1;
      this.hoveredRerollBtn = false;

      if (this.isCoopMode && this.isCoopHost && this.coopWaitingUpgrade) {
        this.upgradeSystem.currentChoices = [];
        this.coopUpgradePickedIds.add(this.mpClient.myId);
        this.tryResumeCoopUpgrade();
      }
    }
  }

  private handleUpgradeReroll(): void {
    if (this.isCoopMode && !this.isCoopHost) {
      if (this.upgradeSystem.rerollsRemaining > 0 && !this.upgradeSystem.currentChoices[0]?.isCompanionBranchCard) {
        this.mpClient.sendRerollRequest();
      } else {
        this.sound.playExplosion(false);
      }
      return;
    }

    if (this.upgradeSystem.rerollChoices(this.player)) {
      this.sound.playShoot(true);
      this.addTerminalLog(
        `REROLL: Modules refreshed (${this.upgradeSystem.rerollsRemaining}/3 left).`
      );
      this.hoveredCardIndex = -1;
    } else {
      this.sound.playExplosion(false);
    }
  }

  private handleCanvasTap(mx: number, my: number): void {
    if (this.gameState === 'MENU') {
      if (this.showLeaderboardOverlay) {
        for (const tabBtn of this.getLeaderboardTabRects()) {
          if (this.isPointInRect(mx, my, tabBtn)) {
            this.activeLeaderboardCategory = tabBtn.category;
            this.sound.playShoot(false);
            void this.refreshLeaderboards();
            return;
          }
        }
        if (this.isPointInRect(mx, my, this.getLeaderboardBackButtonRect())) {
          this.showLeaderboardOverlay = false;
          this.sound.playShoot(false);
        }
        return;
      }

      if (this.showDailyMissionsOverlay) {
        const panelH = 500;
        const py = LOGICAL_HEIGHT / 2 - panelH / 2;
        if (this.isPointInRect(mx, my, this.getOverlayBackButtonRect(py, panelH))) {
          this.showDailyMissionsOverlay = false;
          this.sound.playShoot(false);
        }
        return;
      }

      if (this.showAchievementsOverlay) {
        const panelH = 650;
        const py = LOGICAL_HEIGHT / 2 - panelH / 2;
        if (this.isPointInRect(mx, my, this.getOverlayBackButtonRect(py, panelH))) {
          this.showAchievementsOverlay = false;
          this.sound.playShoot(false);
          return;
        }
        for (const tab of this.getAchievementsTabRects(py)) {
          if (this.isPointInRect(mx, my, tab)) {
            if (this.achievementsPage !== tab.page) {
              this.achievementsPage = tab.page;
              this.sound.playShoot(false);
            }
            return;
          }
        }
        return;
      }

      if (this.showCoopModal) {
        for (const btn of CoopLobbyUI.getButtons(LOGICAL_WIDTH, LOGICAL_HEIGHT, this.mpClient)) {
          if (this.isPointInRect(mx, my, btn)) {
            this.handleCoopButtonAction(btn.action);
            return;
          }
        }
        return;
      }

      if (this.showHelpOverlay) {
        const backBtn = this.getOverlayBackButtonRect(LOGICAL_HEIGHT / 2 - 295, 590);
        if (this.isPointInRect(mx, my, backBtn)) {
          this.showHelpOverlay = false;
          this.sound.playShoot(false);
        }
        return;
      }

      if (this.showSettingsOverlay) {
        this.handleSettingsClick(mx, my);
        return;
      }

      if (this.isPointInRect(mx, my, this.getCoopOnlineButtonRect())) {
        this.openCoopModal();
        this.sound.playCoinPickup();
        return;
      }

      if (this.isPointInRect(mx, my, this.getDailyMissionsButtonRect())) {
        this.showDailyMissionsOverlay = true;
        this.sound.playCoinPickup();
        return;
      }

      if (this.isPointInRect(mx, my, this.getAchievementsButtonRect())) {
        this.showAchievementsOverlay = true;
        this.sound.playCoinPickup();
        return;
      }

      if (this.isPointInRect(mx, my, this.getSettingsButtonRect())) {
        this.showSettingsOverlay = true;
        this.sound.playShoot(false);
        return;
      }

      if (this.isPointInRect(mx, my, this.getFullscreenButtonRect())) {
        this.toggleFullscreen();
        this.sound.playShoot(false);
        return;
      }

      if (
        (this.currentUser || this.isExternalLoginAllowed()) &&
        this.isPointInRect(mx, my, this.getAuthActionButtonRect())
      ) {
        this.handleAuthButtonClick();
        return;
      }

      if (this.isPointInRect(mx, my, this.getGlobalRankingsButtonRect())) {
        this.openLeaderboardOverlay();
        return;
      }

      for (const tabRect of this.getMenuTabRects()) {
        if (this.isPointInRect(mx, my, tabRect)) {
          this.activeMenuTab = tabRect.tab;
          if (tabRect.tab === 'INVENTORY') {
            this.inventoryPage = 0;
          }
          this.sound.playShoot(false);
          return;
        }
      }

      if (this.activeMenuTab === 'SHOP') {
        for (const charRect of this.getMenuCharacterRects()) {
          if (this.isPointInRect(mx, my, charRect)) {
            const res = this.metaSystem.selectOrBuyCharacter(charRect.id);
            this.menuFeedbackMessage = res.message;
            if (res.success) {
              this.sound.playCoinPickup();
              this.syncCoopLoadout();
            }
            return;
          }
        }
      } else if (this.activeMenuTab === 'LAB') {
        for (const labRect of this.getMenuLabRects()) {
          if (this.isPointInRect(mx, my, labRect)) {
            const res = this.metaSystem.buyLabUpgrade(labRect.id);
            this.menuFeedbackMessage = res.message;
            if (res.success) {
              this.sound.playCoinPickup();
              this.particleSystem.spawnExplosion(
                labRect.x + labRect.width / 2,
                labRect.y + labRect.height / 2,
                LAB_UPGRADES_CONFIG[labRect.id].color,
                22,
                true
              );
            } else {
              this.sound.playExplosion(false);
            }
            return;
          }
        }
      } else if (this.activeMenuTab === 'GACHA') {
        for (const pullBtn of this.getGachaPullButtonRects()) {
          if (this.isPointInRect(mx, my, pullBtn)) {
            const res = this.metaSystem.pullGachaBatch(pullBtn.count);
            this.menuFeedbackMessage = res.message;
            if (res.success && res.results.length > 0) {
              this.lastGachaResults = res.results;
              this.gachaRevealTimer = 1.2;
              this.sound.playCoinPickup();
              this.achievementSystem.reportProgress(
                'gacha_collector_20',
                this.metaSystem.unlockedHats.size,
                true
              );
              if (
                res.results.some(
                  (r) => r.hat.rarity === 'MITICA' || r.hat.rarity === 'LEGENDARIA'
                )
              ) {
                this.achievementSystem.reportProgress('gacha_mythic', 1, true);
              }
              const bestEntry = res.results[0];
              const rColor = RARITY_CONFIG[bestEntry.hat.rarity].color;
              this.particleSystem.spawnExplosion(
                LOGICAL_WIDTH / 2,
                LOGICAL_HEIGHT / 2 + 55,
                rColor,
                pullBtn.count === 10 ? 60 : 30,
                true
              );
            } else {
              this.sound.playExplosion(false);
            }
            return;
          }
        }
      } else if (this.activeMenuTab === 'INVENTORY') {
        for (const slot of this.getInventoryHatRects()) {
          if (this.isPointInRect(mx, my, slot)) {
            const res = this.metaSystem.equipHat(slot.hat.id);
            this.menuFeedbackMessage = res.message;
            if (res.success) {
              this.sound.playCoinPickup();
              this.syncCoopLoadout();
            }
            return;
          }
        }

        for (const pageBtn of this.getInventoryPaginationRects()) {
          if (this.isPointInRect(mx, my, pageBtn)) {
            const totalUnlocked = this.metaSystem.getUnlockedHatsList().length;
            const maxPage = Math.max(0, Math.ceil(totalUnlocked / 9) - 1);
            if (pageBtn.dir === 'PREV') {
              this.inventoryPage = Math.max(0, this.inventoryPage - 1);
            } else {
              this.inventoryPage = Math.min(maxPage, this.inventoryPage + 1);
            }
            this.sound.playShoot(false);
            return;
          }
        }
      }

      for (const mBtn of this.getGameModeButtonRects()) {
        if (this.isPointInRect(mx, my, mBtn)) {
          this.selectedGameMode = mBtn.mode;
          this.menuFeedbackMessage =
            mBtn.mode === 'NIGHTMARE'
              ? i18n.t(
                  `Modo Pesadilla seleccionado: Mapa Infinito, Eventos y x2 Cripto (Coste: ${NIGHTMARE_ENTRY_COST} CR).`,
                  `Nightmare Mode selected: Infinite Map, Events & 2x Crypto (Cost: ${NIGHTMARE_ENTRY_COST} CR).`
                )
              : i18n.t(
                  'Modo Clásico seleccionado: Arena estándar gratuita 1920x1080.',
                  'Classic Mode selected: Free standard 1920x1080 arena.'
                );
          this.sound.playShoot(false);
          return;
        }
      }

      if (this.isPointInRect(mx, my, this.getStartButtonRect())) {
        this.startNewRun();
        return;
      }
      if (this.isPointInRect(mx, my, this.getCoopOnlineButtonRect())) {
        this.openCoopModal();
        this.sound.playCoinPickup();
      }
      return;
    }

    if (this.isPaused) {
      if (this.showHelpOverlay) {
        const backBtn = this.getOverlayBackButtonRect(LOGICAL_HEIGHT / 2 - 295, 590);
        if (this.isPointInRect(mx, my, backBtn)) {
          this.showHelpOverlay = false;
          this.sound.playShoot(false);
        }
        return;
      }

      if (this.showSettingsOverlay) {
        this.handleSettingsClick(mx, my);
        return;
      }

      for (const btn of this.getPauseButtonRects()) {
        if (this.isPointInRect(mx, my, btn)) {
          if (btn.action === 'RESUME') {
            this.togglePause();
          } else if (btn.action === 'SETTINGS') {
            this.showSettingsOverlay = true;
            this.sound.playShoot(false);
          } else if (btn.action === 'EXIT_TO_MENU') {
            this.exitToMainMenu();
          }
          return;
        }
      }
      return;
    }

    if (this.gameState === 'GAMEOVER') {
      for (const gBtn of this.getGameOverButtonRects()) {
        if (this.isPointInRect(mx, my, gBtn)) {
          if (gBtn.action === 'RETRY') {
            if (this.isCoopMode) {
              if (this.isCoopHost) this.mpClient.sendReturnToLobby();
              else this.exitToMainMenu();
            } else {
              this.startNewRun();
            }
          } else {
            this.exitToMainMenu();
          }
          return;
        }
      }
      return;
    }

    if (this.gameState === 'PLAYING' && !this.upgradeSystem.isChoosingUpgrade()) {
      if (this.isPointInRect(mx, my, this.getInGameMuteButtonRect())) {
        this.toggleAudioMute();
        return;
      }
      if (this.isPointInRect(mx, my, this.getInGamePauseButtonRect())) {
        this.togglePause();
        return;
      }
      if (
        this.player.canActivateUltimate() &&
        this.isPointInRect(mx, my, this.getInGameUltBarRect())
      ) {
        this.tryTriggerPlayerUltimate();
        return;
      }
      return;
    }

    if (!this.upgradeSystem.isChoosingUpgrade()) return;

    if (this.isPointInRect(mx, my, this.getRerollButtonRect())) {
      this.handleUpgradeReroll();
      return;
    }

    for (const card of this.getUpgradeCardRects()) {
      if (this.isPointInRect(mx, my, card)) {
        this.applySelectedUpgrade(card.index);
        break;
      }
    }
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.hoveredPauseAction = null;
    if (this.isPaused) {
      this.input.clearTouch();
      this.achievementSystem.flushPendingSave(true);
      this.metaSystem.flushPendingSave();
      this.dailyMissions.flushPendingSave(true);
    } else {
      this.lastTime = performance.now();
    }
  }

  private exitToMainMenu(keepRoom: boolean = false): void {
    if (this.finalBoss) {
      this.runDamageToToro = Math.floor(this.finalBoss.totalDamageTaken);
    }
    this.metaSystem.updateHighScore(this.killCount, this.elapsedTime, this.runDamageToToro);
    this.achievementSystem.flushPendingSave(true);
    this.metaSystem.flushPendingSave();
    this.dailyMissions.flushPendingSave(true);
    this.highScoreKills = Math.max(this.highScoreKills, this.metaSystem.highScore);
    void this.metaSystem.syncToCloud(this.elapsedTime, this.runDamageToToro);
    if (!keepRoom && this.mpClient.isInRoom) {
      this.mpClient.leaveRoom();
    }
    this.isCoopMode = false;
    this.isCoopHost = false;
    this.coopSelfDowned = false;
    this.coopSelfReviveProgress = 0;
    this.coopPeers.clear();
    this.coopWaitingUpgrade = false;
    this.coopUpgradePickedIds.clear();
    this.coopUpgradeStatusText = '';
    this.coopSnapshot = null;
    this.coopLastSnapSeq = 0;
    this.coopInputSeq = 0;
    this.coopPendingInputs = [];
    this.coopLastPrevEnemyHp.clear();
    CoopRenderer.resetState();
    this.input.clearTouch();
    this.isPaused = false;
    this.isNightmareRun = false;
    this.hoveredPauseAction = null;
    this.hoveredCardIndex = -1;
    this.enemies = [];
    this.projectiles = [];
    this.pingProjectiles = [];
    this.quarantineZones = [];
    this.combatSystem.enemyProjectiles = [];
    this.combatSystem.firewallPulses = [];
    this.combatSystem.sqlBeams = [];
    this.codeFragments = [];
    this.cryptoCoins = [];
    this.powerUps = [];
    this.systemFreezeTimer = 0;
    this.thermalOverclockTimer = 0;
    this.finalBoss = null;
    this.spawner = new Spawner();
    this.combatSystem = new CombatSystem();
    this.upgradeSystem = new UpgradeSystem();
    this.particleSystem.clear();
    this.elapsedTime = 0;
    this.killCount = 0;
    this.runCoinsCollected = 0;
    this.runBossesKilled = 0;
    this.runTotalDamageDealt = 0;
    this.damageVignetteAlpha = 0;
    this.player = new Player(
      LOGICAL_WIDTH / 2,
      LOGICAL_HEIGHT / 2,
      this.metaSystem.getSelectedProfile(),
      this.metaSystem.getEquippedHat()
    );
    this.gameState = 'MENU';
    this.sound.setTrack('MENU');
    this.lastTime = performance.now();
  }

  private resize(): void {
    const targetW = this.lightGraphicsEnabled ? 1280 : LOGICAL_WIDTH;
    const targetH = this.lightGraphicsEnabled ? 720 : LOGICAL_HEIGHT;
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.bgCacheCanvas = null;
      this.infiniteTileCache = null;
    }
  }

  private startNewRun(): void {
    if (this.selectedGameMode === 'NIGHTMARE') {
      const payRes = this.metaSystem.payNightmareEntry();
      if (!payRes.success) {
        this.menuFeedbackMessage = payRes.message;
        this.sound.playExplosion(false);
        return;
      }
      this.isNightmareRun = true;
      this.menuFeedbackMessage = payRes.message;
    } else {
      this.isNightmareRun = false;
    }

    const profile = this.metaSystem.getSelectedProfile();
    logAnalyticsEvent('level_start', {
      character: profile.name,
      equipped_hat: this.metaSystem.getEquippedHat() || 'none',
      mode: this.isNightmareRun ? 'NIGHTMARE' : 'CLASSIC',
    });
    this.input.clearTouch();
    this.player = new Player(
      LOGICAL_WIDTH / 2,
      LOGICAL_HEIGHT / 2,
      profile,
      this.metaSystem.getEquippedHat()
    );
    this.enemies = [];
    this.projectiles = [];
    this.pingProjectiles = [];
    this.quarantineZones = [];
    this.codeFragments = [];
    this.cryptoCoins = [];
    this.powerUps = [];
    this.systemFreezeTimer = 0;
    this.thermalOverclockTimer = 0;
    this.finalBoss = null;
    this.isPaused = false;
    this.hoveredPauseAction = null;
    this.hoveredGameOverBtn = null;
    this.runRevivesDone = 0;
    this.runTimesDowned = 0;
    this.coopGameOverSquad = [];
    this.combatSystem = new CombatSystem();
    if (profile.id === 'KERNEL_X') {
      this.combatSystem.multiShotCount += 1;
    }
    this.upgradeSystem = new UpgradeSystem();
    this.spawner = new Spawner();
    this.spawner.isNightmareMode = this.isNightmareRun;
    this.spawner.isInfiniteMap = this.isMovingMap();
    this.worldEnv.reset(Math.floor(Math.random() * 0xffffffff) >>> 0, this.isMovingMap());
    const cam = this.getCameraOrigin();
    this.spawner.spawnOpeningWave(
      this.enemies,
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT,
      cam.x,
      cam.y,
      this.worldEnv
    );
    if (this.isNightmareRun) {
      this.terrainEvents.reset(this.player.x, this.player.y, this.worldEnv);
    }
    this.particleSystem.clear();
    this.elapsedTime = 0;
    this.killCount = 0;
    this.lastOverclockTier = 0;
    this.runCoinsCollected = 0;
    this.runDamageToToro = 0;
    this.runBossesKilled = 0;
    this.runTotalDamageDealt = 0;
    this.hoveredCardIndex = -1;
    this.hoveredRerollBtn = false;
    this.damageVignetteAlpha = 0;
    this.gameState = 'PLAYING';
    this.sound.setTrack('INGAME');
    this.lastTime = performance.now();
    this.sound.playShoot(false);
    this.terminalLogs = [
      `[000.0s] > DEPLOYED: ${profile.name} [${this.isNightmareRun ? 'PESADILLA x2 CR' : 'CLÁSICO'}]`,
      `[000.0s] > Passive: ${i18n.currentLang === 'EN' ? profile.passiveNameEn : profile.passiveName}`,
    ];
  }

  /**
   * Invoca al Jefe Final ("El Toro") al alcanzarse el tiempo de supervivencia de ~11-12 minutos.
   */
  private triggerFinalBossArrival(): void {
    this.achievementSystem.reportProgress('toro_arrival', 1);
    this.spawner.enableFinalBossMode();
    this.enemies = [];
    const infiniteArena = this.isMovingMap();
    const anchor =
      this.player.active
        ? this.player
        : this.isCoopMode
        ? this.getNearestAliveCoopPlayer(this.player.x, this.player.y)
        : this.player;
    const spawnX = infiniteArena ? anchor.x : LOGICAL_WIDTH / 2;
    const spawnY = infiniteArena
      ? anchor.y - 420
      : anchor.y > LOGICAL_HEIGHT * 0.45
      ? 120
      : LOGICAL_HEIGHT - 120;
    this.finalBoss = new ElToroBoss(spawnX, spawnY);
    this.finalBoss.unbounded = infiniteArena;
    this.enemies.push(this.finalBoss);
    logAnalyticsEvent('boss_spawn', { boss_name: 'EL_TORO' });

    this.sound.playExplosion(true);
    this.particleSystem.triggerShake(18, 0.7);
    this.particleSystem.spawnExplosion(this.finalBoss.x, this.finalBoss.y, '#dc2626', 100, true);
    this.particleSystem.spawnFloatingText(
      this.player.x,
      this.player.y - 50,
      '¡¡ALERTA MÁXIMA: PROTOCOLO TORO ACTIVADO!!',
      '#ff0044',
      2.0
    );
    this.addTerminalLog('!! CRITICAL ALERT: SYSTEM TIME EXCEEDED 11:30 !!');
    this.addTerminalLog('!! FINAL BOSS AWAKENED: EL TORO (INVINCIBLE) — WEAPONS ONLINE !!');
  }

  public start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  private loop(timestamp: number): void {
    if (this.isPaused && !this.isCoopMode) {
      this.lastTime = timestamp;
      this.render();
      requestAnimationFrame((nextTimestamp) => this.loop(nextTimestamp));
      return;
    }

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((nextTimestamp) => this.loop(nextTimestamp));
  }

  private update(dt: number): void {
    this.particleSystem.update(dt);
    this.achievementSystem.updateToasts(dt);
    this.dailyMissions.updateToasts(dt);
    if (this.gachaRevealTimer > 0) {
      this.gachaRevealTimer = Math.max(0, this.gachaRevealTimer - dt);
    }

    if (this.damageVignetteAlpha > 0) {
      this.damageVignetteAlpha = Math.max(0, this.damageVignetteAlpha - dt * 1.8);
    }

    if (this.gameState !== 'PLAYING') {
      return;
    }

    // Invitado Co-op: predice movimiento local sin tirones y envía inputs al Host (50 Hz)
    if (this.isCoopMode && !this.isCoopHost) {
      if (!this.isPaused && !this.coopSelfDowned && !this.coopWaitingUpgrade && !this.upgradeSystem.isChoosingUpgrade()) {
        this.player.externalSpeedMultiplier = this.worldEnv.isInSlowLiquid(
          this.player.x,
          this.player.y,
          this.elapsedTime
        )
          ? 0.58
          : 1.0;
        this.player.update(
          dt,
          this.input,
          LOGICAL_WIDTH,
          LOGICAL_HEIGHT,
          this.isMovingMap(),
          this.lightGraphicsEnabled
        );
        const resolved = this.worldEnv.resolveCircleCollision(
          this.player.x,
          this.player.y,
          this.player.size * 0.48
        );
        this.player.x = resolved.x;
        this.player.y = resolved.y;
      }
      this.worldEnv.updateOases(dt, [{ x: this.player.x, y: this.player.y }], false, this.elapsedTime);
      this.coopInputTimer += dt;
      if (this.coopInputTimer >= 0.02) {
        this.coopInputTimer = 0;
        const dir = this.isPaused || this.coopSelfDowned || this.coopWaitingUpgrade
          ? { x: 0, y: 0 }
          : this.input.getDirection();
        const nextSeq = ++this.coopInputSeq;
        this.coopPendingInputs.push({ seq: nextSeq, x: this.player.x, y: this.player.y });
        if (this.coopPendingInputs.length > 50) {
          this.coopPendingInputs.shift();
        }
        this.mpClient.sendInput(
          dir.x,
          dir.y,
          this.player.facingAngle,
          dir.x !== 0 || dir.y !== 0,
          nextSeq
        );
      }
      return;
    }

    // Host Co-op esperando a que todo el escuadrón elija mejora de nivel
    if (this.isCoopMode && this.isCoopHost && this.coopWaitingUpgrade) {
      this.coopUpgradeTimer -= dt;
      if (this.coopUpgradeTimer <= 0) {
        this.forceCoopUpgradeTimeout();
      }
      return;
    }

    if (this.upgradeSystem.isChoosingUpgrade()) {
      return;
    }

    this.elapsedTime += dt;
    const cam = this.getCameraOrigin();

    if (this.finalBoss && this.finalBoss.active) {
      if (this.sound.getCurrentTrack() !== 'FINAL_BOSS') {
        this.sound.setTrack('FINAL_BOSS');
      }
    } else if (this.enemies.some((e) => e.active && e.malwareType === 'RANSOMWARE')) {
      if (this.sound.getCurrentTrack() !== 'BOSS') {
        this.sound.setTrack('BOSS');
      }
    } else {
      if (this.sound.getCurrentTrack() !== 'INGAME') {
        this.sound.setTrack('INGAME');
      }
    }

    this.achievementSystem.reportProgress('survivor_3min', this.elapsedTime, true);
    this.achievementSystem.reportProgress('survivor_6min', this.elapsedTime, true);
    this.achievementSystem.reportProgress('survivor_10min', this.elapsedTime, true);
    this.achievementSystem.reportProgress('survivor_15min', this.elapsedTime, true);
    this.achievementSystem.reportProgress('level_20', this.upgradeSystem.level, true);
    this.achievementSystem.reportProgress('level_30', this.upgradeSystem.level, true);
    this.dailyMissions.reportProgress('SURVIVAL_SEC', Math.floor(this.elapsedTime));
    this.dailyMissions.reportProgress('LEVEL', this.upgradeSystem.level);

    if (!this.isCoopMode || (!this.coopSelfDowned && !this.isPaused)) {
      this.player.externalSpeedMultiplier = this.worldEnv.isInSlowLiquid(
        this.player.x,
        this.player.y,
        this.elapsedTime
      )
        ? 0.58
        : 1.0;
      this.player.update(
        dt,
        this.input,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
        this.isMovingMap(),
        this.lightGraphicsEnabled
      );
      const resolved = this.worldEnv.resolveCircleCollision(
        this.player.x,
        this.player.y,
        this.player.size * 0.48
      );
      this.player.x = resolved.x;
      this.player.y = resolved.y;
    }

    // Actualizar aliados Co-op en Host + reanimación en cápsula
    if (this.isCoopMode && this.isCoopHost) {
      for (const peer of this.coopPeers.values()) {
        if (!peer.downed) {
          peer.player.externalSpeedMultiplier = this.worldEnv.isInSlowLiquid(
            peer.player.x,
            peer.player.y,
            this.elapsedTime
          )
            ? 0.58
            : 1.0;
          peer.player.updateWithVector(
            dt,
            peer.inputX,
            peer.inputY,
            LOGICAL_WIDTH,
            LOGICAL_HEIGHT,
            this.isMovingMap(),
            this.lightGraphicsEnabled
          );
          const resolvedPeer = this.worldEnv.resolveCircleCollision(
            peer.player.x,
            peer.player.y,
            peer.player.size * 0.48
          );
          peer.player.x = resolvedPeer.x;
          peer.player.y = resolvedPeer.y;
        }
      }

      // Comprobar rescate de jugadores caídos (radio 75px durante 3s, acelerado por DADOS CUÁNTICOS)
      if (this.coopSelfDowned) {
        let rescuingPeer: CoopPeerRuntime | null = null;
        for (const peer of this.coopPeers.values()) {
          if (!peer.downed && Math.hypot(peer.player.x - this.player.x, peer.player.y - this.player.y) <= 75) {
            rescuingPeer = peer;
            break;
          }
        }
        if (rescuingPeer) {
          this.coopSelfReviveProgress += (dt * rescuingPeer.player.reviveSpeedMultiplier) / 3.0;
          if (this.coopSelfReviveProgress >= 1) {
            this.coopSelfDowned = false;
            this.coopSelfReviveProgress = 0;
            this.player.active = true;
            this.player.hp = Math.ceil(this.player.maxHp * 0.5);
            this.player.invulnerabilityTimer = 2.0;
            rescuingPeer.revivesDone += 1;
            this.sound.playAchievement();
            this.particleSystem.spawnExplosion(this.player.x, this.player.y, '#10b981', 30, true);
            this.mpClient.sendGameEvent({
              type: 'REVIVE',
              x: this.player.x,
              y: this.player.y,
              text: `REVIVED: ${this.player.profileName} rescued by ${rescuingPeer.name}!`,
            });
          }
        } else if (this.coopSelfReviveProgress > 0) {
          this.coopSelfReviveProgress = Math.max(0, this.coopSelfReviveProgress - dt * 0.35);
        }
      }

      for (const peer of this.coopPeers.values()) {
        if (!peer.downed) continue;
        const hostRescuing =
          !this.coopSelfDowned &&
          Math.hypot(this.player.x - peer.player.x, this.player.y - peer.player.y) <= 75;
        let peerRescuer: CoopPeerRuntime | null = null;
        if (!hostRescuing) {
          for (const other of this.coopPeers.values()) {
            if (other.id !== peer.id && !other.downed && Math.hypot(other.player.x - peer.player.x, other.player.y - peer.player.y) <= 75) {
              peerRescuer = other;
              break;
            }
          }
        }
        if (hostRescuing || peerRescuer) {
          const revMult = hostRescuing
            ? this.player.reviveSpeedMultiplier
            : peerRescuer!.player.reviveSpeedMultiplier;
          peer.reviveProgress += (dt * revMult) / 3.0;
          if (peer.reviveProgress >= 1) {
            peer.downed = false;
            peer.reviveProgress = 0;
            peer.player.active = true;
            peer.player.hp = Math.ceil(peer.player.maxHp * 0.5);
            peer.player.invulnerabilityTimer = 2.0;
            if (hostRescuing) this.runRevivesDone += 1;
            else if (peerRescuer) peerRescuer.revivesDone += 1;
            this.sound.playAchievement();
            this.particleSystem.spawnExplosion(peer.player.x, peer.player.y, '#10b981', 30, true);
            this.mpClient.sendGameEvent({
              type: 'REVIVE',
              x: peer.player.x,
              y: peer.player.y,
              text: `REVIVED: ${peer.name} back online!`,
            });
          }
        } else if (peer.reviveProgress > 0) {
          peer.reviveProgress = Math.max(0, peer.reviveProgress - dt * 0.35);
        }
      }
    }

    // Actualizar origen tras mover jugador para spawns y proyectiles centrados en Pesadilla
    const activeCam = this.getCameraOrigin();
    const alivePeerPlayers: Player[] = [];
    const allAlivePlayers: Player[] = [];
    if (!this.coopSelfDowned && this.player.active) {
      allAlivePlayers.push(this.player);
    }
    if (this.isCoopMode && this.isCoopHost) {
      for (const peer of this.coopPeers.values()) {
        if (!peer.downed && peer.player.active) {
          alivePeerPlayers.push(peer.player);
          allAlivePlayers.push(peer.player);
        }
      }
    }

    const markPeerDownedIfDead = (peer: CoopPeerRuntime) => {
      if (!peer.downed && !peer.player.active) {
        peer.downed = true;
        peer.reviveProgress = 0;
        peer.timesDowned += 1;
        peer.player.hp = 0;
        this.mpClient.sendGameEvent({
          type: 'DOWNED',
          text: `ALERT: ${peer.name} cayó — ¡acércate para reanimarlo!`,
        });
      }
    };

    // Eventos de terreno en Modo Pesadilla
    if (this.isNightmareRun) {
      const tRes = this.terrainEvents.update(
        dt,
        this.player,
        this.elapsedTime,
        alivePeerPlayers,
        this.worldEnv
      );
      if (tRes.coolingActivated) {
        this.thermalOverclockTimer = Math.max(this.thermalOverclockTimer, 10.0);
        for (const ap of allAlivePlayers) {
          ap.heal(20);
        }
        this.sound.playCoinPickup();
        this.particleSystem.spawnFloatingText(
          this.player.x,
          this.player.y - 34,
          i18n.t('❄ ¡SERVIDOR CRIO: +OVERCLOCK +20 HP!', '❄ CRYO SERVER: +OVERCLOCK +20 HP!'),
          '#38bdf8',
          1.25
        );
        this.addTerminalLog('TERRAIN: Cryo Server activated (+10s Overclock & +20 HP).');
      }
      if (tRes.empDetonation) {
        const emp = tRes.empDetonation;
        this.sound.playExplosion(true);
        this.particleSystem.triggerShake(10, 0.3);
        this.particleSystem.spawnExplosion(emp.x, emp.y, '#a855f7', 35, true);
        const killed = this.terrainEvents.applyAreaBlast(
          this.enemies,
          emp.x,
          emp.y,
          emp.radius,
          emp.damage,
          2.5
        );
        for (const k of killed) {
          this.spawnCodeFragment(k.x, k.y, k.xpValue);
          this.killCount++;
        }
        this.particleSystem.spawnFloatingText(
          emp.x,
          emp.y - 24,
          i18n.t('⚡ ¡PULSO EMP DETONADO!', '⚡ EMP BLAST TRIGGERED!'),
          '#c084fc',
          1.3
        );
        this.addTerminalLog(`TERRAIN: EMP Pylon stunned sector (${killed.length} purged).`);
      }
      if (tRes.vaultReward) {
        const v = tRes.vaultReward;
        this.sound.playAchievement();
        this.particleSystem.spawnExplosion(v.x, v.y, '#fbbf24', 36, true);
        for (let c = 0; c < v.coins; c++) {
          this.spawnCryptoCoin(
            v.x + (Math.random() - 0.5) * 80,
            v.y + (Math.random() - 0.5) * 80,
            1
          );
        }
        for (let f = 0; f < 4; f++) {
          this.spawnCodeFragment(
            v.x + (Math.random() - 0.5) * 60,
            v.y + (Math.random() - 0.5) * 60,
            Math.round(v.xp / 4)
          );
        }
        this.particleSystem.spawnFloatingText(
          v.x,
          v.y - 26,
          i18n.t('₿ ¡BÓVEDA CRIPTO CONQUISTADA!', '₿ CRYPTO VAULT CAPTURED!'),
          '#fbbf24',
          1.35
        );
        this.addTerminalLog('TERRAIN: Corrupted Vault captured! Bonus CryptoCoins & XP!');
      }
      if (tRes.stormBlast) {
        const sb = tRes.stormBlast;
        this.sound.playExplosion(false);
        this.particleSystem.spawnExplosion(sb.x, sb.y, '#ff1e42', 28, true);
        const stormKilled = this.terrainEvents.applyAreaBlast(
          this.enemies,
          sb.x,
          sb.y,
          sb.radius,
          sb.damageToEnemies
        );
        for (const sk of stormKilled) {
          this.spawnCodeFragment(sk.x, sk.y, sk.xpValue);
        }
        for (const hitPl of sb.hitPlayers) {
          if (hitPl.takeDamage(22)) {
            if (hitPl === this.player) {
              this.particleSystem.triggerShake(9, 0.25);
              this.damageVignetteAlpha = 0.6;
              this.addTerminalLog('ALERT: Hit by Data Storm (-22 HP)!');
            } else {
              for (const peer of this.coopPeers.values()) {
                if (peer.player === hitPl) {
                  markPeerDownedIfDead(peer);
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Comprobar llegada del Jefe Final ("El Toro") a los ~11-12 minutos (700s)
    if (
      this.elapsedTime >= FINAL_BOSS_ARRIVAL_TIME &&
      !this.spawner.finalBossMode &&
      !this.finalBoss
    ) {
      this.triggerFinalBossArrival();
    }

    const prevThreat = this.spawner.currentThreatLevel;
    const prevBossAlert = this.spawner.activeBossAlertTimer;

    const aliveOrigins: { x: number; y: number }[] = [];
    const alivePosList: { x: number; y: number }[] = [];
    if (!this.coopSelfDowned && this.player.active) {
      alivePosList.push({ x: this.player.x, y: this.player.y });
    }
    if (this.isCoopMode && this.isCoopHost) {
      for (const peer of this.coopPeers.values()) {
        if (!peer.downed && peer.player.active) {
          aliveOrigins.push({
            x: peer.player.x - LOGICAL_WIDTH / 2,
            y: peer.player.y - LOGICAL_HEIGHT / 2,
          });
          alivePosList.push({ x: peer.player.x, y: peer.player.y });
        }
      }
    }

    // Oasis dinámicos con recompensas (desaparecen al recogerse y reaparecen en otra zona)
    const { rewards: oasisRewards, spawned: oasisSpawned } = this.worldEnv.updateOases(
      dt,
      alivePosList,
      true,
      this.elapsedTime
    );
    for (const sp of oasisSpawned) {
      this.particleSystem.spawnExplosion(sp.x, sp.y, '#34d399', 18, false);
      this.addTerminalLog('✦ NEW OASIS DETECTED! (+HP +CRYPTO +XP)');
    }
    for (const ow of oasisRewards) {
      this.sound.playAchievement();
      this.particleSystem.spawnExplosion(ow.x, ow.y, '#10b981', 36, true);
      if (!this.coopSelfDowned && this.player.active) {
        this.player.heal(ow.heal);
        this.player.speedBonusMultiplier = 1.25;
        this.player.speedBoostTimer = 4.0;
      }
      if (this.isCoopMode && this.isCoopHost) {
        for (const peer of this.coopPeers.values()) {
          if (!peer.downed && peer.player.active) {
            peer.player.heal(ow.heal);
            peer.player.speedBonusMultiplier = 1.25;
            peer.player.speedBoostTimer = 4.0;
          }
        }
      }
      const coinBonus = this.isNightmareRun ? ow.coins * 2 : ow.coins;
      this.runCoinsCollected += coinBonus;
      this.metaSystem.addCoins(coinBonus);
      this.dailyMissions.reportProgress('COINS', coinBonus);
      this.spawnCodeFragment(ow.x, ow.y, ow.xp);
      this.particleSystem.spawnFloatingText(
        ow.x,
        ow.y - 28,
        i18n.t(`✦ ¡OASIS: +${ow.heal} HP +${coinBonus} CR +TURBO!`, `✦ OASIS: +${ow.heal} HP +${coinBonus} CR +SPEED!`),
        '#34d399',
        1.35
      );
      const msg = `OASIS: +${ow.heal} HP, +${coinBonus} CR & +4s Speed Boost!`;
      this.addTerminalLog(msg);
      if (this.isCoopMode && this.isCoopHost) {
        this.mpClient.sendGameEvent({ type: 'REVIVE', x: ow.x, y: ow.y, text: msg });
      }
    }

    this.spawner.coopPlayerCount = this.isCoopMode ? Math.max(1, 1 + this.coopPeers.size) : 1;
    this.spawner.update(
      dt,
      this.elapsedTime,
      this.upgradeSystem.level,
      this.enemies,
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT,
      activeCam.x,
      activeCam.y,
      aliveOrigins,
      this.worldEnv
    );

    if (this.spawner.currentThreatLevel > prevThreat) {
      this.addTerminalLog(`WARNING: Threat Level escalated to LVL ${this.spawner.currentThreatLevel}`);
    }
    if (prevBossAlert === 0 && this.spawner.activeBossAlertTimer > 0) {
      this.addTerminalLog(`CRITICAL ALERT: ${this.spawner.lastBossSpawnedName} breached firewall!`);
    }
    if (this.spawner.swarmTriggeredJustNow) {
      this.sound.playExplosion(true);
      this.addTerminalLog('!! ALERTA DE PLAGA: EL ENJAMBRE (50 ENEMIGOS - 6s) !!');
    }
    if (this.spawner.minerSpawnedJustNow) {
      this.sound.playCoinPickup();
      this.addTerminalLog('!! MINERO DE CRIPTOS DETECTADO: ¡CÁZALO ANTES DE QUE ESCAPE! !!');
    }

    const isFrozen = this.systemFreezeTimer > 0;
    if (this.systemFreezeTimer > 0) {
      this.systemFreezeTimer = Math.max(0, this.systemFreezeTimer - dt);
    }

    for (const proj of this.projectiles) {
      const prevX = proj.x;
      const prevY = proj.y;
      const pCam = this.getNearestAliveCoopCameraOrigin(proj.x, proj.y);
      proj.update(dt, LOGICAL_WIDTH, LOGICAL_HEIGHT, pCam.x, pCam.y);
      if (proj.active && this.worldEnv.isInfinite) {
        const pSpd = Math.hypot(proj.vx, proj.vy) || 1;
        const tipX = proj.x + (proj.vx / pSpd) * (proj.size * 0.68);
        const tipY = proj.y + (proj.vy / pSpd) * (proj.size * 0.68);
        const hitWall = this.worldEnv.findSegmentObstacleImpact(prevX, prevY, tipX, tipY, Math.max(3.5, proj.size * 0.36));
        if (hitWall) {
          proj.active = false;
          this.particleSystem.spawnExplosion(hitWall.x, hitWall.y, proj.isEvolved ? '#fde047' : '#00f0ff', 4, false);
        }
      }
    }
    for (const ping of this.pingProjectiles) {
      const prevX = ping.x;
      const prevY = ping.y;
      const pCam = this.getNearestAliveCoopCameraOrigin(ping.x, ping.y);
      ping.update(dt, this.enemies, LOGICAL_WIDTH, LOGICAL_HEIGHT, pCam.x, pCam.y, this.worldEnv);
      if (ping.active && this.worldEnv.isInfinite) {
        const pSpd = Math.hypot(ping.vx, ping.vy) || 1;
        const tipX = ping.x + (ping.vx / pSpd) * (ping.size * 0.68);
        const tipY = ping.y + (ping.vy / pSpd) * (ping.size * 0.68);
        const hitWall = this.worldEnv.findSegmentObstacleImpact(prevX, prevY, tipX, tipY, Math.max(3.5, ping.size * 0.36));
        if (hitWall) {
          ping.active = false;
          this.particleSystem.spawnExplosion(hitWall.x, hitWall.y, ping.isEvolved ? '#60a5fa' : '#0088ff', 4, false);
        }
      }
    }
    for (const enemy of this.enemies) {
      if (isFrozen && !(enemy instanceof ElToroBoss)) {
        enemy.networkFreezeTimer = 0.2;
      } else {
        const targetPlayer = this.isCoopMode
          ? this.getNearestAliveCoopPlayer(enemy.x, enemy.y)
          : this.player;
        const prevEx = enemy.x;
        const prevEy = enemy.y;
        enemy.update(dt, targetPlayer);
        if (enemy.malwareType !== 'HARDWARE_BOX') {
          if (enemy instanceof CryptoMiner) {
            const fleeRes = this.worldEnv.moveEntityAvoidingObstacles(
              prevEx,
              prevEy,
              enemy.x,
              enemy.y,
              enemy.x + (enemy.x - prevEx) * 12,
              enemy.y + (enemy.y - prevEy) * 12,
              enemy.size * 0.44,
              (enemy.netId & 1) === 0 ? 1 : -1
            );
            enemy.x = fleeRes.x;
            enemy.y = fleeRes.y;
          } else if (enemy instanceof Evasor || (enemy instanceof ElToroBoss && enemy.state !== 'CHASE')) {
            if (this.worldEnv.isInfinite) {
              const clamped = this.worldEnv.resolveCircleCollision(enemy.x, enemy.y, enemy.size * 0.44);
              enemy.x = clamped.x;
              enemy.y = clamped.y;
            }
          } else {
            const eRes = this.worldEnv.moveEntityAvoidingObstacles(
              prevEx,
              prevEy,
              enemy.x,
              enemy.y,
              targetPlayer.x,
              targetPlayer.y,
              enemy.size * 0.44,
              (enemy.netId & 1) === 0 ? 1 : -1
            );
            enemy.x = eRes.x;
            enemy.y = eRes.y;
          }
        }
      }
      if (enemy instanceof WormPrimeBoss && enemy.active) {
        const puddleHits = enemy.applyPuddleDamageToPlayers(allAlivePlayers);
        for (const hitPl of puddleHits) {
          if (hitPl === this.player) {
            this.particleSystem.triggerShake(5, 0.16);
            this.damageVignetteAlpha = Math.max(this.damageVignetteAlpha, 0.45);
            this.addTerminalLog(`ALERT: Acid Puddle damaged kernel! HP: ${Math.ceil(this.player.hp)}/${this.player.maxHp}`);
          } else {
            for (const peer of this.coopPeers.values()) {
              if (peer.player === hitPl) {
                markPeerDownedIfDead(peer);
                break;
              }
            }
          }
        }
      }
      if (enemy instanceof CryptoMiner && enemy.escaped) {
        this.particleSystem.spawnFloatingText(enemy.x, enemy.y, '¡MINERO ESCAPÓ!', '#94a3b8', 1.0);
        this.addTerminalLog('> Crypto Miner escaped from the sector.');
      }
      if (enemy instanceof WaveBoss && enemy.pendingMinions.length > 0) {
        this.enemies.push(...enemy.pendingMinions);
        enemy.pendingMinions = [];
      }
    }

    if (this.thermalOverclockTimer > 0) {
      this.thermalOverclockTimer = Math.max(0, this.thermalOverclockTimer - dt);
    }
    const isFrenzy = this.thermalOverclockTimer > 0;
    const baseFireRate = this.player.fireRateMultiplier;
    const baseCrit = this.player.critChance;
    if (isFrenzy) {
      this.player.fireRateMultiplier = baseFireRate * 2.0;
      this.player.critChance = 1.0;
    }

    const combatEvents = this.combatSystem.update(
      dt,
      this.player,
      this.enemies,
      this.projectiles,
      this.pingProjectiles,
      this.quarantineZones,
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT,
      activeCam.x,
      activeCam.y,
      this.worldEnv,
      true,
      allAlivePlayers
    );

    if (combatEvents.peerPlayersHit && combatEvents.peerPlayersHit.length > 0) {
      for (const hitPeerPlayer of combatEvents.peerPlayersHit) {
        for (const peer of this.coopPeers.values()) {
          if (peer.player === hitPeerPlayer) {
            markPeerDownedIfDead(peer);
            break;
          }
        }
      }
    }

    if (this.player.companion && this.player.active) {
      const isK9Hyper = this.player.ultActiveTimer > 0 && this.player.characterId === 'MORCILLITA';
      const savedDmgMult = this.player.damageMultiplier;
      if (isK9Hyper) {
        this.player.damageMultiplier = savedDmgMult * 1.8;
      }
      const compEvents = this.player.companion.update(
        isK9Hyper ? dt * 1.65 : dt,
        this.player,
        this.upgradeSystem.level,
        this.enemies,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
        activeCam.x,
        activeCam.y,
        this.worldEnv
      );
      if (isK9Hyper) {
        this.player.damageMultiplier = savedDmgMult;
      }
      if (compEvents.screenShakeIntensity && compEvents.screenShakeIntensity > 0) {
        this.particleSystem.triggerShake(compEvents.screenShakeIntensity, 0.16);
      }
      combatEvents.enemiesKilled += compEvents.killedEnemies.length;
      combatEvents.damagedEnemies.push(...compEvents.damagedEnemies);
      for (const d of compEvents.damagedEnemies) {
        this.combatSystem.recordCompanionDamage(d.damage);
      }
      if (this.player.vampirismChance > 0) {
        const healAmount = Math.max(2, this.player.vampirismHealAmount);
        for (let h = 0; h < compEvents.damagedEnemies.length; h++) {
          if (Math.random() < this.player.vampirismChance) {
            const prevHp = this.player.hp;
            this.player.heal(healAmount);
            const restored = this.player.hp - prevHp;
            if (restored > 0) {
              combatEvents.vampirismHeals += restored;
            }
          }
        }
      }
      for (const killed of compEvents.killedEnemies) {
        combatEvents.destroyedEnemies.push({
          x: killed.x,
          y: killed.y,
          xpValue: killed.xpValue,
          color: killed.color,
          malwareType: killed.malwareType,
          enemyRef: killed,
        });
      }

      if (compEvents.milestoneMessage) {
        this.sound.playCoinPickup();
        this.particleSystem.spawnExplosion(this.player.x, this.player.y, '#ec4899', 42, true);
        this.particleSystem.spawnFloatingText(
          this.player.x,
          this.player.y - 36,
          compEvents.milestoneMessage,
          '#f472b6',
          1.45
        );
        this.addTerminalLog(`>> ${compEvents.milestoneMessage} <<`);
      }
    }

    if (isFrenzy) {
      this.player.fireRateMultiplier = baseFireRate;
      this.player.critChance = baseCrit;
    }

    // Simular combate y compañeros de los aliados Co-op en el Host
    if (this.isCoopMode && this.isCoopHost) {
      for (const peer of this.coopPeers.values()) {
        if (peer.downed || !peer.player.active) {
          peer.combatSystem.decayWhenDowned(dt);
          continue;
        }
        const pBaseRof = peer.player.fireRateMultiplier;
        const pBaseCrit = peer.player.critChance;
        if (isFrenzy) {
          peer.player.fireRateMultiplier = pBaseRof * 2.0;
          peer.player.critChance = 1.0;
        }
        const pCombat = peer.combatSystem.update(
          dt,
          peer.player,
          this.enemies,
          this.projectiles,
          this.pingProjectiles,
          this.quarantineZones,
          LOGICAL_WIDTH,
          LOGICAL_HEIGHT,
          peer.player.x - LOGICAL_WIDTH / 2,
          peer.player.y - LOGICAL_HEIGHT / 2,
          this.worldEnv,
          false
        );
        if (isFrenzy) {
          peer.player.fireRateMultiplier = pBaseRof;
          peer.player.critChance = pBaseCrit;
        }
        combatEvents.enemiesKilled += pCombat.enemiesKilled;
        combatEvents.destroyedEnemies.push(...pCombat.destroyedEnemies);
        combatEvents.damagedEnemies.push(...pCombat.damagedEnemies);
        if (pCombat.wallImpacts) {
          for (const wi of pCombat.wallImpacts) {
            this.particleSystem.spawnExplosion(wi.x, wi.y, wi.color, 4, false);
          }
        }

        if (peer.player.companion && peer.player.active) {
          const pCompCamX = this.isMovingMap() ? peer.player.x - LOGICAL_WIDTH / 2 : 0;
          const pCompCamY = this.isMovingMap() ? peer.player.y - LOGICAL_HEIGHT / 2 : 0;
          const isPeerK9Hyper = peer.player.ultActiveTimer > 0 && peer.player.characterId === 'MORCILLITA';
          const savedPeerDmg = peer.player.damageMultiplier;
          if (isPeerK9Hyper) {
            peer.player.damageMultiplier = savedPeerDmg * 1.8;
          }
          const pComp = peer.player.companion.update(
            isPeerK9Hyper ? dt * 1.65 : dt,
            peer.player,
            this.upgradeSystem.level,
            this.enemies,
            LOGICAL_WIDTH,
            LOGICAL_HEIGHT,
            pCompCamX,
            pCompCamY,
            this.worldEnv
          );
          if (isPeerK9Hyper) {
            peer.player.damageMultiplier = savedPeerDmg;
          }
          for (const d of pComp.damagedEnemies) {
            peer.combatSystem.recordCompanionDamage(d.damage);
          }
          combatEvents.enemiesKilled += pComp.killedEnemies.length;
          combatEvents.damagedEnemies.push(...pComp.damagedEnemies);
          for (const k of pComp.killedEnemies) {
            combatEvents.destroyedEnemies.push({
              x: k.x,
              y: k.y,
              xpValue: k.xpValue,
              color: k.color,
              malwareType: k.malwareType,
              enemyRef: k,
            });
          }
        }

        markPeerDownedIfDead(peer);
      }
    }

    // Evitar que SpywareSpecterBoss se teletransporte dentro de un muro al recibir daño
    if (this.worldEnv.isInfinite) {
      for (const enemy of this.enemies) {
        if (enemy.active && enemy instanceof SpywareSpecterBoss) {
          const safe = this.worldEnv.resolveCircleCollision(enemy.x, enemy.y, enemy.size * 0.45);
          enemy.x = safe.x;
          enemy.y = safe.y;
        }
      }
    }

    if (combatEvents.wallImpacts) {
      for (const wi of combatEvents.wallImpacts) {
        this.particleSystem.spawnExplosion(wi.x, wi.y, wi.color, 4, false);
      }
    }

    if (combatEvents.droneExploded) {
      this.particleSystem.triggerShake(7, 0.22);
    }

    const prevKillCount = this.killCount;
    this.killCount += combatEvents.enemiesKilled;
    if (combatEvents.enemiesKilled > 0) {
      this.dailyMissions.reportProgress('KILLS', combatEvents.enemiesKilled);
      if (this.isNightmareRun) {
        this.dailyMissions.reportProgress('NIGHTMARE_KILLS', combatEvents.enemiesKilled);
      }
      // Cargar Ultimate por bajas (+7 extra si había un jefe entre los eliminados)
      let ultChargeGain = combatEvents.enemiesKilled;
      for (const de of combatEvents.destroyedEnemies) {
        if (de.malwareType === 'RANSOMWARE' || de.malwareType === 'CRYPTO_MINER') {
          ultChargeGain += 7;
        }
      }
      if (this.player.addUltCharge(ultChargeGain)) {
        const uName = i18n.currentLang === 'EN' ? this.player.ultNameEn : this.player.ultName;
        this.sound.playCoinPickup();
        this.showStatusToast(
          i18n.t(
            `⚡ ¡ULTIMATE LISTA: ${uName}! PULSA [ESPACIO] O [E]`,
            `⚡ ULTIMATE READY: ${uName}! PRESS [SPACE] OR [E]`
          ),
          '#fbbf24',
          2600
        );
      }
      for (const peerPl of alivePeerPlayers) {
        peerPl.addUltCharge(ultChargeGain);
      }
      // Fiebre del Oro (Ultimate de CRYPTO): +1 CryptoCoin garantizada cada 10 bajas mientras dura
      for (const ap of allAlivePlayers) {
        if (ap.ultActiveTimer > 0 && ap.characterId === 'CRYPTO') {
          ap.ultKillAccumulator += combatEvents.enemiesKilled;
          while (ap.ultKillAccumulator >= 10) {
            ap.ultKillAccumulator -= 10;
            this.spawnCryptoCoin(ap.x + (Math.random() - 0.5) * 40, ap.y + (Math.random() - 0.5) * 40, 1);
          }
        }
      }
    }
    const killMilestone = Math.floor(this.killCount / 25);
    if (killMilestone > this.lastOverclockTier) {
      this.lastOverclockTier = killMilestone;
      for (const ap of allAlivePlayers) {
        if (ap.characterId === 'OVERCLOCK') {
          ap.triggerOverclockAdrenaline();
          this.particleSystem.spawnFloatingText(
            ap.x,
            ap.y - 34,
            '⚡ ¡SOBRECARGA ADRENALINA!',
            '#f97316',
            1.15
          );
        } else if (ap.characterId === 'STANDARD') {
          ap.heal(1);
        }
      }
    }

    if (combatEvents.shieldBlocked) {
      this.sound.playShoot(true);
      this.particleSystem.spawnExplosion(this.player.x, this.player.y, '#38bdf8', 18, true);
      this.particleSystem.spawnFloatingText(
        this.player.x,
        this.player.y - 32,
        '🛡 ¡ESCUDO AEGIS!',
        '#38bdf8',
        1.2
      );
    }
    if (combatEvents.dodgedHit) {
      this.particleSystem.spawnFloatingText(
        this.player.x,
        this.player.y - 28,
        'EVADIDO!',
        '#67e8f9',
        1.1
      );
    }
    if (combatEvents.surgeTriggered) {
      this.sound.playExplosion(false);
      this.particleSystem.spawnExplosion(this.player.x, this.player.y, '#00ff66', 20, true);
      this.particleSystem.spawnFloatingText(
        this.player.x,
        this.player.y - 36,
        '⚡ DESCARGA KERNEL!',
        '#00ff66',
        1.15
      );
    }

    this.achievementSystem.reportProgress('first_patch', this.killCount, true);
    this.achievementSystem.reportProgress('mass_purge', this.killCount, true);
    this.achievementSystem.reportProgress('mass_purge_elite', this.killCount, true);

    if (this.finalBoss) {
      this.runDamageToToro = Math.floor(this.finalBoss.totalDamageTaken);
      this.achievementSystem.reportProgress('toro_damage_10k', this.runDamageToToro, true);
      this.achievementSystem.reportProgress('toro_damage_50k', this.runDamageToToro, true);
      this.achievementSystem.reportProgress('toro_damage_100k', this.runDamageToToro, true);
      this.achievementSystem.reportProgress('toro_damage_250k', this.runDamageToToro, true);
    }
    this.metaSystem.updateHighScore(this.killCount, this.elapsedTime, this.runDamageToToro);
    this.highScoreKills = Math.max(this.highScoreKills, this.metaSystem.highScore);

    // Mecánica de Vampirismo / Robo de Ancho de Banda: solo se activa tras equipar la pasiva
    const prevVampirismTier = Math.floor(prevKillCount / 20);
    const currentVampirismTier = Math.floor(this.killCount / 20);
    if (this.player.vampirismChance > 0 && currentVampirismTier > prevVampirismTier && this.player.active) {
      const tiersCrossed = currentVampirismTier - prevVampirismTier;
      let triggeredTiers = 0;
      for (let t = 0; t < tiersCrossed; t++) {
        if (Math.random() < 0.05) {
          triggeredTiers++;
        }
      }
      if (triggeredTiers > 0) {
        const passiveVampirismHeal = triggeredTiers * 20;
        this.player.heal(passiveVampirismHeal);
        this.particleSystem.spawnFloatingText(
          this.player.x,
          this.player.y - 30,
          `+${passiveVampirismHeal} HP [VAMPIRISMO]`,
          '#f43f5e',
          1.0
        );
        this.addTerminalLog(
          `VAMPIRISM PASSIVE (5% RNG): +${passiveVampirismHeal} HP restored (${this.killCount} kills).`
        );
      }
    }

    if (combatEvents.shotsFired > 0) {
      this.sound.playShoot(false);
    }
    if (combatEvents.homingShotsFired > 0) {
      this.sound.playShoot(true);
    }
    if (combatEvents.vampirismHeals > 0) {
      this.particleSystem.spawnFloatingText(
        this.player.x,
        this.player.y - 24,
        `+${combatEvents.vampirismHeals} HP`,
        '#00ff66',
        0.85
      );
    }

    for (const hit of combatEvents.damagedEnemies) {
      this.runTotalDamageDealt += hit.damage;
      this.particleSystem.spawnHitSparks(hit.x, hit.y, hit.isCrit ? '#facc15' : hit.color);
      if (hit.damage === 0) {
        this.particleSystem.spawnFloatingText(hit.x, hit.y, '0 [SHIELD]', '#38bdf8', 0.85);
      } else if (hit.isCrit) {
        this.particleSystem.spawnFloatingText(hit.x, hit.y, `-${hit.damage}!`, '#facc15', 1.35);
      } else {
        this.particleSystem.spawnFloatingText(hit.x, hit.y, `-${hit.damage}`, '#ffffff', 0.95);
      }
    }
    this.achievementSystem.reportProgress('damage_dealer_halfmillion', this.runTotalDamageDealt, true);

    for (const drop of combatEvents.destroyedEnemies) {
      // Si el Minero de Criptos simplemente desapareció por agotarse su tiempo de huida, no da botín
      if (
        drop.malwareType === 'CRYPTO_MINER' &&
        drop.enemyRef instanceof CryptoMiner &&
        drop.enemyRef.escaped
      ) {
        this.particleSystem.spawnFloatingText(
          drop.x,
          drop.y,
          '¡MINERO ESCAPÓ!',
          '#94a3b8',
          1.0
        );
        this.addTerminalLog('> Crypto Miner escaped from the sector.');
        continue;
      }

      const isBoss = drop.malwareType === 'RANSOMWARE';
      this.sound.playExplosion(isBoss || drop.malwareType === 'CRYPTO_MINER');

      if (drop.malwareType === 'CRYPTO_MINER') {
        this.achievementSystem.reportProgress('crypto_miner_slayer', 1);
        this.achievementSystem.reportProgress('crypto_tycoon', 1);
      }

      this.particleSystem.spawnExplosion(
        drop.x,
        drop.y,
        drop.color,
        isBoss || drop.malwareType === 'CRYPTO_MINER' ? 55 : 18,
        isBoss || drop.malwareType === 'CRYPTO_MINER'
      );

      if (drop.malwareType === 'HARDWARE_BOX') {
        this.achievementSystem.reportProgress('hardware_collector', 1);
        this.achievementSystem.reportProgress('hardware_hoarder', 1);
        for (const ap of allAlivePlayers) {
          ap.heal(25);
        }
        for (let c = 0; c < 3; c++) {
          this.spawnCryptoCoin(
            drop.x + (Math.random() - 0.5) * 28,
            drop.y + (Math.random() - 0.5) * 28,
            1
          );
        }
        for (let f = 0; f < 3; f++) {
          this.spawnCodeFragment(
            drop.x + (Math.random() - 0.5) * 30,
            drop.y + (Math.random() - 0.5) * 30,
            35
          );
        }
        // 25% de probabilidad de soltar un power-up raro (Nuke, Freeze, Frenzy)
        if (Math.random() < 0.25) {
          const pTypes: PowerUpType[] = ['NUKE', 'FREEZE', 'FRENZY'];
          const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
          this.powerUps.push(new PowerUpItem(drop.x, drop.y, pType));
        }
        this.particleSystem.spawnFloatingText(
          this.player.x,
          this.player.y - 24,
          'CAJA: +25 HP + XP + 3 CRYPTO 🪙',
          '#00ff66',
          1.1
        );
        continue;
      }

      if (drop.malwareType === 'CRYPTO_MINER') {
        const jackpotCoins = 30 + Math.floor(Math.random() * 11);
        for (let c = 0; c < jackpotCoins; c++) {
          this.spawnCryptoCoin(
            drop.x + (Math.random() - 0.5) * 110,
            drop.y + (Math.random() - 0.5) * 110,
            1
          );
        }
        this.spawnCodeFragment(drop.x, drop.y, drop.xpValue);
        this.sound.playCoinPickup();
        this.particleSystem.spawnFloatingText(
          drop.x,
          drop.y - 16,
          `¡BOTÍN MINERO! +${jackpotCoins} CRYPTO 🪙`,
          '#fbbf24',
          1.3
        );
        this.addTerminalLog(`>> CRYPTO MINER ELIMINATED! Dropped +${jackpotCoins} CryptoCoins! <<`);
        continue;
      }

      if (isBoss && !this.spawner.finalBossMode) {
        this.runBossesKilled++;
        this.dailyMissions.reportProgress('BOSSES', 1);
        this.achievementSystem.reportProgress('first_boss_killed', 1);
        this.achievementSystem.reportProgress('all_four_bosses', this.runBossesKilled, true);
        this.achievementSystem.reportProgress('boss_slayer_ten', this.runBossesKilled, true);
        const bossTitle = (drop.enemyRef as WaveBoss)?.bossName || 'RANSOMWARE';
        this.addTerminalLog(`BOSS PURGED: ${bossTitle} (Total: ${this.runBossesKilled})!`);
        logAnalyticsEvent('boss_defeat', { boss_name: bossTitle });
        this.particleSystem.spawnFloatingText(
          drop.x,
          drop.y - 32,
          '¡JEFE PURGADO! +BOTÍN ÉPICO',
          '#00ff66',
          1.4
        );
      }

      this.spawnCodeFragment(drop.x, drop.y, drop.xpValue);

      if (isBoss) {
        // Jefe de oleada derrotado: suelta 5 CryptoCoins y un PowerUp garantizado
        for (let c = 0; c < 5; c++) {
          this.spawnCryptoCoin(
            drop.x + (Math.random() - 0.5) * 44,
            drop.y + (Math.random() - 0.5) * 44,
            1
          );
        }
        const pTypes: PowerUpType[] = ['NUKE', 'FREEZE', 'FRENZY'];
        const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
        this.powerUps.push(new PowerUpItem(drop.x, drop.y, pType));
      } else {
        // 1% de probabilidad de soltar un power-up raro en enemigos comunes
        if (Math.random() < 0.01) {
          const pTypes: PowerUpType[] = ['NUKE', 'FREEZE', 'FRENZY'];
          const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
          this.powerUps.push(new PowerUpItem(drop.x, drop.y, pType));
        }
        let maxBonusCoinDrop = this.player.bonusCoinDropChance;
        for (const peerPl of alivePeerPlayers) {
          if (peerPl.bonusCoinDropChance > maxBonusCoinDrop) {
            maxBonusCoinDrop = peerPl.bonusCoinDropChance;
          }
        }
        const dropChance = 0.06 + maxBonusCoinDrop;
        if (Math.random() < dropChance) {
          this.spawnCryptoCoin(drop.x + 8, drop.y - 8, 1);
        }
      }

      if (
        !this.spawner.finalBossMode &&
        drop.enemyRef instanceof Worm &&
        !drop.enemyRef.isSplitChild
      ) {
        const activeWormCount = this.enemies.filter(
          (e) => e.active && e instanceof Worm
        ).length;
        const hpMult = this.spawner.getGlobalHpMultiplier(
          this.elapsedTime,
          this.upgradeSystem.level
        );
        const maxWorms = this.spawner.getMaxActiveWorms(this.elapsedTime);
        const dmgMult = this.spawner.getGlobalDamageMultiplier(this.elapsedTime);
        const spdMult = this.spawner.getGlobalSpeedMultiplier(this.elapsedTime);
        if (activeWormCount < maxWorms) {
          const w1 = new Worm(drop.x - 14, drop.y - 14, hpMult, true);
          w1.damage = Math.round(w1.damage * dmgMult);
          w1.speed = Math.round(w1.speed * spdMult);
          this.enemies.push(w1);
        }
        if (activeWormCount + 1 < maxWorms) {
          const w2 = new Worm(drop.x + 14, drop.y + 14, hpMult, true);
          w2.damage = Math.round(w2.damage * dmgMult);
          w2.speed = Math.round(w2.speed * spdMult);
          this.enemies.push(w2);
        }
      }
    }

    if (combatEvents.playerHit) {
      this.particleSystem.triggerShake(8, 0.28);
      this.damageVignetteAlpha = 0.65;
      this.particleSystem.spawnExplosion(this.player.x, this.player.y, '#ff1e42', 16, false);
      this.addTerminalLog(`ALERT: Kernel integrity damaged! HP: ${Math.ceil(this.player.hp)}/${this.player.maxHp}`);
    }

    // Comprobar muerte/caída fuera de playerHit para evitar soft-lock por charcos o tormentas de datos
    if (!this.player.active && !this.coopSelfDowned) {
      if (this.isCoopMode && this.isCoopHost && this.getCoopAliveCount() > 1) {
        this.coopSelfDowned = true;
        this.coopSelfReviveProgress = 0;
        this.runTimesDowned += 1;
        this.player.hp = 0;
        this.sound.playExplosion(false);
        this.mpClient.sendGameEvent({
          type: 'DOWNED',
          text: `ALERT: ${this.player.profileName} cayó — ¡acércate para reanimarlo!`,
        });
      } else {
        this.triggerGameOverSequence();
        return;
      }
    }

    if (this.isCoopMode && this.isCoopHost && this.getCoopAliveCount() === 0) {
      this.triggerGameOverSequence();
      return;
    }

    for (const fragment of this.codeFragments) {
      if (!fragment.active) continue;
      const collector = this.isCoopMode
        ? this.getNearestAliveCoopPlayer(fragment.x, fragment.y)
        : this.player;
      fragment.update(dt, collector);

      let collected = CombatSystem.checkAABBCollision(collector, fragment);
      if (!collected && collector.companion) {
        for (const unit of collector.companion.getUnits()) {
          if (Math.hypot(unit.x - fragment.x, unit.y - fragment.y) <= unit.size + 16) {
            collected = true;
            break;
          }
        }
      }

      if (collected) {
        fragment.active = false;
        const gainedXp = Math.round(fragment.xpValue * collector.xpMultiplier);

        this.particleSystem.spawnFloatingText(
          collector.x,
          collector.y - 18,
          `+${gainedXp} XP${collector.xpMultiplier > 1 ? ` (x${collector.xpMultiplier.toFixed(2)})` : ''}`,
          collector.xpMultiplier > 1 ? '#a3e635' : '#00f0ff',
          0.9
        );

        const leveledUp = this.upgradeSystem.addXp(gainedXp, this.player);
        if (leveledUp) {
          this.addTerminalLog(`SYSTEM UPGRADE READY: Agent reached v${this.upgradeSystem.level}.0`);
          if (this.isCoopMode && this.isCoopHost) {
            this.triggerCoopTeamLevelUp();
          }
        }
      }
    }

    for (const coin of this.cryptoCoins) {
      if (!coin.active) continue;
      const collector = this.isCoopMode
        ? this.getNearestAliveCoopPlayer(coin.x, coin.y)
        : this.player;
      coin.update(dt, collector);

      let collected = CombatSystem.checkAABBCollision(collector, coin);
      if (!collected && collector.companion) {
        for (const unit of collector.companion.getUnits()) {
          if (Math.hypot(unit.x - coin.x, unit.y - coin.y) <= unit.size + 16) {
            collected = true;
            break;
          }
        }
      }

      if (collected) {
        coin.active = false;
        const awarded = this.isNightmareRun ? coin.value * 2 : coin.value;
        this.runCoinsCollected += awarded;
        this.metaSystem.addCoins(awarded);
        this.dailyMissions.reportProgress('COINS', awarded);
        this.sound.playCoinPickup();
        this.particleSystem.spawnFloatingText(
          collector.x,
          collector.y - 28,
          `+${awarded} CRYPTO${this.isNightmareRun ? ' (x2)' : ''}`,
          '#fbbf24',
          1.0
        );
      }
    }

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      if (!p.active) continue;
      const collector = this.isCoopMode
        ? this.getNearestAliveCoopPlayer(p.x, p.y)
        : this.player;
      p.update(dt, collector);

      if (CombatSystem.checkAABBCollision(collector, p)) {
        p.active = false;
        this.activatePowerUp(p.type, p.x, p.y);
      }
    }

    this.resolveEnemyCrowd();
    this.projectiles = this.projectiles.filter((p) => p.active);
    this.pingProjectiles = this.pingProjectiles.filter((p) => p.active);
    this.quarantineZones = this.quarantineZones.filter((z) => z.active);
    this.enemies = this.enemies.filter((e) => e.active);
    this.codeFragments = this.codeFragments.filter((f) => f.active);
    this.cryptoCoins = this.cryptoCoins.filter((c) => c.active);
    this.powerUps = this.powerUps.filter((p) => p.active);
    this.achievementSystem.flushPendingSave(false);
    this.dailyMissions.flushPendingSave(false);

    if (this.isCoopMode && this.isCoopHost) {
      this.coopSnapshotTimer += dt;
      if (this.coopSnapshotTimer >= 0.04) {
        this.coopSnapshotTimer = 0;
        this.broadcastCoopSnapshot();
      }
    }
  }

  private triggerGameOverSequence(): void {
    this.gameState = 'GAMEOVER';
    this.coopWaitingUpgrade = false;
    this.hoveredGameOverBtn = null;
    this.sound.setTrack('NONE');
    if (this.finalBoss) {
      this.runDamageToToro = Math.floor(this.finalBoss.totalDamageTaken);
    }

    const computeCombatSummary = (cs: CombatSystem): { totalDamage: number; topWeapon: string } => {
      let totalDamage = 0;
      let topWeapon = 'Ráfaga Firewall';
      let topDmg = -1;
      for (const [wName, dmg] of Object.entries(cs.weaponDamageStats)) {
        totalDamage += dmg;
        if (dmg > topDmg) {
          topDmg = dmg;
          topWeapon = wName;
        }
      }
      return { totalDamage: Math.round(totalDamage), topWeapon };
    };

    if (this.isCoopMode && this.isCoopHost) {
      const room = this.mpClient.room;
      const mySlot = room?.players.find((p) => p.id === this.mpClient.myId)?.slot ?? 0;
      const hostSum = computeCombatSummary(this.combatSystem);
      const squadMvp: CoopSquadMvpEntry[] = [
        {
          id: this.mpClient.myId,
          slot: mySlot,
          name: this.player.profileName,
          color: this.player.color,
          characterId: this.player.characterId,
          totalDamage: hostSum.totalDamage,
          topWeapon: hostSum.topWeapon,
          revives: this.runRevivesDone,
          downs: this.runTimesDowned,
        },
      ];
      const weaponsByPlayer: Record<string, Record<string, number>> = {
        [this.mpClient.myId]: { ...this.combatSystem.weaponDamageStats },
      };

      for (const peer of this.coopPeers.values()) {
        const pSum = computeCombatSummary(peer.combatSystem);
        squadMvp.push({
          id: peer.id,
          slot: peer.slot,
          name: peer.name,
          color: peer.slotColor,
          characterId: peer.characterId,
          totalDamage: pSum.totalDamage,
          topWeapon: pSum.topWeapon,
          revives: peer.revivesDone,
          downs: peer.timesDowned,
        });
        weaponsByPlayer[peer.id] = { ...peer.combatSystem.weaponDamageStats };
      }
      squadMvp.sort((a, b) => b.totalDamage - a.totalDamage);
      this.coopGameOverSquad = squadMvp;

      const stats: CoopGameOverStats = {
        squadMvp,
        weaponsByPlayer,
        killsByType: { ...this.combatSystem.killsByTypeStats },
        damageToToro: this.runDamageToToro,
      };
      this.broadcastCoopSnapshot();
      this.mpClient.sendGameEvent({ type: 'GAME_OVER', stats });
    }

    logAnalyticsEvent('level_end', {
      success: false,
      reason: 'killed_by_enemies',
      elapsed_seconds: Math.round(this.elapsedTime),
      kills: this.killCount,
      damage_to_toro: this.runDamageToToro,
      character: this.metaSystem.getSelectedProfile().name,
      coop: this.isCoopMode,
    });
    this.metaSystem.updateHighScore(this.killCount, this.elapsedTime, this.runDamageToToro);
    this.achievementSystem.flushPendingSave(true);
    this.metaSystem.flushPendingSave();
    this.dailyMissions.flushPendingSave(true);
    this.highScoreKills = Math.max(this.highScoreKills, this.metaSystem.highScore);
    void this.metaSystem.syncToCloud(this.elapsedTime, this.runDamageToToro);
    this.sound.playExplosion(true);
    this.particleSystem.spawnExplosion(this.player.x, this.player.y, '#00ff66', 45, true);
    this.addTerminalLog('FATAL_ERROR: Antivirus Agent terminated.');
  }

  private spawnCodeFragment(x: number, y: number, xpValue: number): void {
    if (this.codeFragments.length >= 160) {
      const oldest = this.codeFragments[0];
      if (oldest) {
        oldest.xpValue += xpValue;
        return;
      }
    }
    this.codeFragments.push(new CodeFragment(x, y, xpValue));
  }

  private spawnCryptoCoin(x: number, y: number, value: number = 1): void {
    if (this.cryptoCoins.length >= 50) {
      const oldest = this.cryptoCoins[0];
      if (oldest) {
        oldest.value += value;
        return;
      }
    }
    this.cryptoCoins.push(new CryptoCoin(x, y, value));
  }

  private activatePowerUp(type: PowerUpType, x: number, y: number): void {
    this.sound.playCoinPickup();
    if (type === 'NUKE') {
      this.sound.playExplosion(true);
      let killedCount = 0;
      for (const e of this.enemies) {
        if (
          !e.active ||
          e.malwareType === 'RANSOMWARE' ||
          e.malwareType === 'HARDWARE_BOX' ||
          e.malwareType === 'FINAL_BOSS'
        )
          continue;
        e.active = false;
        killedCount++;
        this.spawnCodeFragment(e.x, e.y, e.xpValue);
        this.particleSystem.spawnExplosion(e.x, e.y, '#ff1e42', 12, false);
      }
      if (killedCount > 0) {
        this.killCount += killedCount;
        this.highScoreKills = Math.max(this.highScoreKills, this.killCount);
        this.metaSystem.updateHighScore(this.killCount, this.elapsedTime, this.runDamageToToro);
        this.achievementSystem.reportProgress('first_patch', this.killCount, true);
        this.achievementSystem.reportProgress('mass_purge', this.killCount, true);
        this.achievementSystem.reportProgress('mass_purge_elite', this.killCount, true);
      }
      this.particleSystem.spawnFloatingText(x, y - 24, '¡BOMBA LÓGICA ACTIVADA!', '#ff1e42', 1.3);
      this.addTerminalLog(`>> LOGIC BOMB DETONATED: ${killedCount} basic malware units purged! <<`);
    } else if (type === 'FREEZE') {
      this.systemFreezeTimer = 4.0;
      this.particleSystem.spawnFloatingText(x, y - 24, '¡SISTEMA CONGELADO (4s)!', '#38bdf8', 1.3);
      this.addTerminalLog('>> SYSTEM FREEZE: Enemy movement paused for 4 seconds! <<');
    } else if (type === 'FRENZY') {
      this.thermalOverclockTimer = 6.0;
      this.particleSystem.spawnFloatingText(x, y - 24, '¡OVERCLOCK TÉRMICO (x2 VEL, 100% CRIT)!', '#f97316', 1.3);
      this.addTerminalLog('>> THERMAL OVERCLOCK: 2x fire rate & 100% critical hit chance for 6s! <<');
    }
  }

  private resolveEnemyCrowd(): void {
    const useWallClamp = this.worldEnv.isInfinite;
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i];
      if (!a.active || a.malwareType === 'HARDWARE_BOX') continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
        if (!b.active || b.malwareType === 'HARDWARE_BOX') continue;
        const minDistance = (a.size + b.size) * 0.46;
        const dx = b.x - a.x;
        if (Math.abs(dx) >= minDistance) continue;
        const dy = b.y - a.y;
        if (Math.abs(dy) >= minDistance) continue;

        const distSq = dx * dx + dy * dy;
        const minDistanceSq = minDistance * minDistance;

        if (distSq > 0 && distSq < minDistanceSq) {
          const dist = Math.sqrt(distSq);
          const overlap = (minDistance - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          if (a instanceof ElToroBoss) {
            b.x += nx * overlap * 2;
            b.y += ny * overlap * 2;
            if (useWallClamp) {
              const rb = this.worldEnv.resolveCircleCollision(b.x, b.y, b.size * 0.44);
              b.x = rb.x;
              b.y = rb.y;
            }
          } else if (b instanceof ElToroBoss) {
            a.x -= nx * overlap * 2;
            a.y -= ny * overlap * 2;
            if (useWallClamp) {
              const ra = this.worldEnv.resolveCircleCollision(a.x, a.y, a.size * 0.44);
              a.x = ra.x;
              a.y = ra.y;
            }
          } else {
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;
            if (useWallClamp) {
              const ra = this.worldEnv.resolveCircleCollision(a.x, a.y, a.size * 0.44);
              a.x = ra.x;
              a.y = ra.y;
              const rb = this.worldEnv.resolveCircleCollision(b.x, b.y, b.size * 0.44);
              b.x = rb.x;
              b.y = rb.y;
            }
          }
        }
      }
    }
  }

  private ensureInfiniteTileCache(): HTMLCanvasElement {
    if (this.infiniteTileCache) return this.infiniteTileCache;
    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 256;
    const tCtx = tile.getContext('2d', { alpha: false }) || tile.getContext('2d');
    if (tCtx) {
      tCtx.fillStyle = '#070b15';
      tCtx.fillRect(0, 0, 256, 256);

      // Rejilla secundaria PCB
      tCtx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      tCtx.lineWidth = 1;
      tCtx.beginPath();
      for (let i = 0; i < 256; i += 64) {
        tCtx.moveTo(i, 0);
        tCtx.lineTo(i, 256);
        tCtx.moveTo(0, i);
        tCtx.lineTo(256, i);
      }
      tCtx.stroke();

      // Líneas maestras + trazas 45° de sector
      tCtx.strokeStyle = 'rgba(244, 63, 94, 0.14)';
      tCtx.beginPath();
      tCtx.moveTo(0, 0);
      tCtx.lineTo(256, 0);
      tCtx.moveTo(0, 0);
      tCtx.lineTo(0, 256);
      tCtx.stroke();

      tCtx.strokeStyle = 'rgba(16, 185, 129, 0.11)';
      tCtx.lineWidth = 1.6;
      tCtx.beginPath();
      tCtx.moveTo(86, 128);
      tCtx.lineTo(110, 128);
      tCtx.lineTo(128, 146);
      tCtx.lineTo(162, 146);
      tCtx.stroke();

      tCtx.fillStyle = 'rgba(251, 191, 36, 0.24)';
      tCtx.beginPath();
      tCtx.arc(86, 128, 2.3, 0, Math.PI * 2);
      tCtx.fill();
    }
    this.infiniteTileCache = tile;
    return tile;
  }

  private drawInfiniteCyberGrid(camX: number, camY: number): void {
    const tile = this.ensureInfiniteTileCache();
    const ox = ((camX % 256) + 256) % 256;
    const oy = ((camY % 256) + 256) % 256;

    this.ctx.save();
    for (let x = -ox - 64; x < LOGICAL_WIDTH + 64; x += 256) {
      for (let y = -oy - 64; y < LOGICAL_HEIGHT + 64; y += 256) {
        this.ctx.drawImage(tile, x, y);
      }
    }
    // Tinte carmesí sutil solo en Pesadilla; azul limpio en Co-op Clásico
    if (this.isNightmareRun) {
      this.ctx.fillStyle = 'rgba(127, 29, 29, 0.08)';
      this.ctx.fillRect(-24, -24, LOGICAL_WIDTH + 48, LOGICAL_HEIGHT + 48);
    }
    this.ctx.restore();
  }

  private render(): void {
    const scale = this.canvas.width / LOGICAL_WIDTH;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.ctx.fillStyle = '#060a13';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const shake =
      this.sound.screenShakeEnabled && !this.lightGraphicsEnabled
        ? this.particleSystem.getShakeOffset()
        : { x: 0, y: 0 };
    const cam = this.getCameraOrigin();

    this.ctx.save();
    this.ctx.translate(shake.x, shake.y);

    if (this.isMovingMap() && this.gameState !== 'MENU') {
      this.drawInfiniteCyberGrid(cam.x, cam.y);
    } else {
      this.drawCyberGrid();
    }

    if (this.gameState !== 'MENU') {
      this.ctx.save();
      this.ctx.translate(-cam.x, -cam.y);

      this.worldEnv.draw(
        this.ctx,
        cam.x,
        cam.y,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
        performance.now(),
        this.elapsedTime
      );

      if (this.isCoopMode && !this.isCoopHost && this.coopSnapshot) {
        CoopRenderer.drawWorld(
          this.ctx,
          this.coopSnapshot,
          this.mpClient.myId,
          {
            x: this.player.x,
            y: this.player.y,
            facingAngle: this.player.facingAngle,
            isMoving: this.player.isMoving,
          },
          this.worldEnv
        );
      } else {
        if (this.isNightmareRun) {
          this.terrainEvents.draw(this.ctx);
        }

        for (const zone of this.quarantineZones) {
          zone.draw(this.ctx);
        }

        if (this.player.active && this.showAttackRange) {
          this.drawScannerRange();
        }

        for (const fragment of this.codeFragments) {
          fragment.draw(this.ctx);
        }

        for (const coin of this.cryptoCoins) {
          coin.draw(this.ctx);
        }

        for (const p of this.powerUps) {
          p.draw(this.ctx);
        }

        for (const proj of this.projectiles) {
          proj.draw(this.ctx);
        }

        for (const ping of this.pingProjectiles) {
          ping.draw(this.ctx);
        }

        this.combatSystem.drawFirewall(this.ctx, this.player);
        if (this.player.companion && this.player.active) {
          this.player.companion.draw(this.ctx, this.player, this.upgradeSystem.level);
        }

        for (const peer of this.coopPeers.values()) {
          if (!peer.downed) {
            peer.combatSystem.drawFirewall(this.ctx, peer.player);
            if (peer.player.companion && peer.player.active) {
              peer.player.companion.draw(this.ctx, peer.player, this.upgradeSystem.level);
            }
          }
        }

        for (const enemy of this.enemies) {
          enemy.draw(this.ctx);
        }

        this.drawEliteHpBars();

        const nowMs = performance.now();
        if (this.isCoopMode && this.isCoopHost) {
          for (const peer of this.coopPeers.values()) {
            CoopRenderer.drawTeammate(
              this.ctx,
              {
                id: peer.id,
                slot: peer.slot,
                name: peer.name,
                characterId: peer.characterId,
                hatId: peer.hatId,
                color: peer.slotColor,
                borderColor: peer.slotBorder,
                x: peer.player.x,
                y: peer.player.y,
                hp: peer.player.hp,
                maxHp: peer.player.maxHp,
                facingAngle: peer.player.facingAngle,
                isMoving: peer.isMoving,
                downed: peer.downed,
                reviveProgress: peer.reviveProgress,
                shieldReady: peer.player.shieldReady,
                adrenaline: peer.player.adrenalineTimer > 0,
                activeWeapons: [],
              },
              peer.player.x,
              peer.player.y,
              false,
              nowMs
            );
          }
          if (this.coopSelfDowned) {
            const mySlot =
              this.mpClient.room?.players.find((p) => p.id === this.mpClient.myId)?.slot ?? 0;
            CoopRenderer.drawTeammate(
              this.ctx,
              {
                id: this.mpClient.myId,
                slot: mySlot,
                name: this.player.profileName,
                characterId: this.player.characterId,
                hatId: this.player.equippedHat?.id ?? null,
                color: this.player.color,
                borderColor: this.player.borderColor,
                x: this.player.x,
                y: this.player.y,
                hp: 0,
                maxHp: this.player.maxHp,
                facingAngle: this.player.facingAngle,
                isMoving: false,
                downed: true,
                reviveProgress: this.coopSelfReviveProgress,
                shieldReady: false,
                adrenaline: false,
                activeWeapons: [],
              },
              this.player.x,
              this.player.y,
              true,
              nowMs
            );
          }
        }

        if (this.player.active) {
          this.player.draw(this.ctx);
        }
      }

      this.particleSystem.draw(this.ctx);

      if (this.showHitboxes) {
        this.drawDebugHitboxes();
      }

      this.ctx.restore();
    }

    this.ctx.restore();

    if (this.gameState === 'PLAYING') {
      if (this.systemFreezeTimer > 0) {
        this.drawFreezeOverlay();
      }
    }

    if (this.spawner.swarmActiveTimer > 0 && this.gameState !== 'MENU') {
      this.drawSwarmPlagueOverlay();
    }

    if (this.damageVignetteAlpha > 0) {
      this.drawDamageVignette();
    }

    if (this.gameState === 'MENU') {
      this.drawStartMenuWithShop();
    } else {
      this.drawXpBar();
      this.drawHUD();
      if (this.isCoopMode) {
        this.drawCoopSquadHud();
      }
      if (this.isNightmareRun || this.isCoopMode) {
        this.drawNightmareMinimap();
      }
      if (this.gameState === 'PLAYING') {
        this.drawOffScreenIndicators(cam.x, cam.y);
      }
      this.drawTerminalLogBox();
      this.drawBossHUD();
      this.drawTouchJoystick();

      if (this.upgradeSystem.isChoosingUpgrade() && (this.player.active || this.isCoopMode)) {
        this.drawUpgradeModal();
      } else if (this.isCoopMode && this.coopWaitingUpgrade && this.gameState === 'PLAYING') {
        this.drawCoopWaitingOverlay();
      }

      if (this.isPaused && this.gameState === 'PLAYING') {
        this.drawPauseMenuOverlay();
      }

      if (this.gameState === 'GAMEOVER') {
        this.drawSystemFailureOverlay();
      }
    }

    this.drawTopStatusBanners();
    const achToastH = this.achievementSystem.drawToasts(this.ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.dailyMissions.drawToasts(this.ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT, achToastH);
    if (!this.lightGraphicsEnabled) {
      this.drawCRTScanlines();
    }
    this.drawVersionBadge();
  }

  private getPauseButtonRects(): PauseButtonRect[] {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;
    const btnW = 380;
    const btnH = 46;

    return [
      {
        action: 'RESUME',
        label: `> ${i18n.t('[1 / ESC / P] REANUDAR PARTIDA', '[1 / ESC / P] RESUME GAME')}`,
        x: cx - btnW / 2,
        y: cy - 38,
        width: btnW,
        height: btnH,
      },
      {
        action: 'SETTINGS',
        label: `> ${i18n.t('[O] AJUSTES Y VOLUMEN', '[O] SETTINGS & AUDIO')}`,
        x: cx - btnW / 2,
        y: cy + 16,
        width: btnW,
        height: btnH,
      },
      {
        action: 'EXIT_TO_MENU',
        label: `> ${i18n.t('[2] SALIR AL MENÚ PRINCIPAL', '[2] QUIT TO MAIN MENU')}`,
        x: cx - btnW / 2,
        y: cy + 70,
        width: btnW,
        height: btnH,
      },
    ];
  }

  private drawPauseMenuOverlay(): void {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 9, 18, 0.84)';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const boxW = 520;
    const boxH = 342;
    this.drawCyberPanel(
      cx - boxW / 2,
      cy - boxH / 2,
      boxW,
      boxH,
      14,
      'rgba(11, 19, 34, 0.97)',
      '#38bdf8',
      2,
      '#38bdf8',
      18
    );

    this.ctx.fillStyle = '#38bdf8';
    this.ctx.fillRect(cx - 120, cy - boxH / 2 + 2, 240, 2.5);

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = `bold 26px ${FONT_DISPLAY}`;
    this.ctx.fillText(i18n.t('SISTEMA EN PAUSA', 'SYSTEM PAUSED'), cx, cy - 102);

    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = `13px ${FONT_MONO}`;
    this.ctx.fillText(
      i18n.t('// Simulación y temporizadores en espera', '// Simulation & timers suspended'),
      cx,
      cy - 72
    );

    for (const btn of this.getPauseButtonRects()) {
      const hovered = this.hoveredPauseAction === btn.action;
      const isExit = btn.action === 'EXIT_TO_MENU';
      const isSettings = btn.action === 'SETTINGS';
      const baseColor = isExit ? '#f43f5e' : isSettings ? '#38bdf8' : '#10b981';

      this.drawClippedButton(
        btn,
        hovered
          ? isExit
            ? 'rgba(76, 12, 28, 0.96)'
            : isSettings
            ? 'rgba(14, 52, 82, 0.96)'
            : 'rgba(6, 62, 42, 0.96)'
          : 'rgba(15, 25, 44, 0.94)',
        hovered ? '#ffffff' : baseColor,
        hovered ? 2.2 : 1.5,
        hovered ? '#ffffff' : baseColor,
        14,
        btn.label
      );
    }

    // Barra inferior de atajos rápidos con estado en tiempo real
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = `bold 11px ${FONT_MONO}`;
    const audioState = this.sound.muted ? i18n.t('SILENCIO', 'MUTED') : 'ON';
    const gfxState = this.lightGraphicsEnabled ? 'ON' : 'OFF';
    this.ctx.fillText(
      `[M] AUDIO: ${audioState}   •   [V] ${i18n.t('LIGEROS', 'LIGHT')}: ${gfxState}   •   [F] ${i18n.t('PANTALLA', 'FULLSCR')}`,
      cx,
      cy + 144
    );

    if (this.showHelpOverlay) {
      this.drawHelpOverlay();
    } else if (this.showSettingsOverlay) {
      this.drawSettingsOverlay();
    }

    this.ctx.restore();
  }

  private drawTopStatusBanners(): void {
    const now = performance.now();
    const banners: { text: string; color: string; bg: string; alpha?: number }[] = [];

    if (this.gameState === 'PLAYING') {
      if (this.spawner.swarmActiveTimer > 0) {
        const blink = Math.floor(now / 280) % 2 === 0;
        banners.push({
          text: i18n.t(
            `⚠️ PLAGA: EL ENJAMBRE (${this.spawner.swarmActiveTimer.toFixed(1)}s) // ¡50 ENEMIGOS!`,
            `⚠️ PLAGUE: THE SWARM (${this.spawner.swarmActiveTimer.toFixed(1)}s) // 50 HOSTILES!`
          ),
          color: blink ? '#ff1e42' : '#fde047',
          bg: 'rgba(38, 8, 16, 0.88)',
        });
      }

      const bossAlertTimer =
        this.isCoopMode && !this.isCoopHost
          ? this.coopSnapshot?.boss?.alertTimer || 0
          : this.spawner.activeBossAlertTimer;
      if (bossAlertTimer > 0) {
        const bossName =
          this.isCoopMode && !this.isCoopHost
            ? this.coopSnapshot?.boss?.name || 'BOSS'
            : this.spawner.lastBossSpawnedName || 'BOSS';
        const bossColor =
          this.isCoopMode && !this.isCoopHost
            ? this.coopSnapshot?.boss?.color || '#f43f5e'
            : this.spawner.lastBossSpawnedColor || '#f43f5e';
        const pulse = Math.floor(bossAlertTimer * 8) % 2 === 0;
        banners.push({
          text: `ALERTA // ${bossName} DETECTED`,
          color: pulse ? bossColor : '#fef08a',
          bg: 'rgba(28, 10, 20, 0.9)',
        });
      }

      if (this.systemFreezeTimer > 0) {
        banners.push({
          text: i18n.t(
            `❄ SISTEMA CONGELADO: ${this.systemFreezeTimer.toFixed(1)}s`,
            `❄ SYSTEM FREEZE: ${this.systemFreezeTimer.toFixed(1)}s`
          ),
          color: '#38bdf8',
          bg: 'rgba(8, 24, 42, 0.88)',
        });
      }

      if (this.thermalOverclockTimer > 0) {
        banners.push({
          text: i18n.t(
            `⚡ OVERCLOCK TÉRMICO (x2 CADENCIA + 100% CRIT): ${this.thermalOverclockTimer.toFixed(1)}s`,
            `⚡ THERMAL OVERCLOCK (2x FIRE RATE + 100% CRIT): ${this.thermalOverclockTimer.toFixed(1)}s`
          ),
          color: '#fb923c',
          bg: 'rgba(36, 18, 8, 0.88)',
        });
      }
    }

    if (this.statusToastExpiresAt > now && this.statusToastText) {
      const rem = this.statusToastExpiresAt - now;
      const alpha = Math.min(1, rem / 450);
      banners.push({
        text: this.statusToastText,
        color: this.statusToastColor,
        bg: 'rgba(11, 19, 34, 0.94)',
        alpha,
      });
    }

    if (banners.length === 0) return;

    this.ctx.save();
    this.ctx.font = `bold 13.5px ${FONT_MONO}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    let curY = this.gameState === 'MENU' ? 84 : 62;
    const pillH = 26;

    for (const b of banners) {
      const tw = this.ctx.measureText(b.text).width;
      const pillW = Math.min(760, tw + 32);
      const px = LOGICAL_WIDTH / 2 - pillW / 2;
      this.ctx.globalAlpha = b.alpha ?? 1;
      this.ctx.fillStyle = b.bg;
      this.ctx.strokeStyle = b.color;
      this.ctx.lineWidth = 1.4;
      this.ctx.beginPath();
      this.ctx.roundRect(px, curY, pillW, pillH, 6);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = b.color;
      this.ctx.fillText(b.text, LOGICAL_WIDTH / 2, curY + pillH / 2 + 0.5, pillW - 18);
      curY += pillH + 6;
    }
    this.ctx.restore();
  }

  private drawVersionBadge(): void {
    this.ctx.save();
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = 'rgba(125, 211, 252, 0.78)';
    this.ctx.font = `bold 12px ${FONT_MONO}`;
    this.ctx.fillText(GAME_VERSION, LOGICAL_WIDTH - 18, LOGICAL_HEIGHT - 14);
    this.ctx.restore();
  }

  private drawSwarmPlagueOverlay(): void {
    this.ctx.save();
    // Filtro rojo suave sobre todo el Canvas durante 'El Enjambre' (texto gestionado en drawTopStatusBanners)
    const pulseAlpha = 0.11 + Math.sin(performance.now() * 0.008) * 0.035;
    this.ctx.fillStyle = `rgba(255, 15, 45, ${pulseAlpha})`;
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.ctx.restore();
  }

  private drawDamageVignette(): void {
    this.ctx.save();
    const grad = this.ctx.createRadialGradient(
      LOGICAL_WIDTH / 2,
      LOGICAL_HEIGHT / 2,
      LOGICAL_WIDTH * 0.25,
      LOGICAL_WIDTH / 2,
      LOGICAL_HEIGHT / 2,
      LOGICAL_WIDTH * 0.65
    );
    grad.addColorStop(0, 'rgba(255, 0, 50, 0)');
    grad.addColorStop(1, `rgba(255, 15, 60, ${this.damageVignetteAlpha * 0.45})`);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.ctx.restore();
  }

  private drawEliteHpBars(): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      // Los mini-jefes (RansomwareBoss) ya tienen su propia barra roja de vida;
      // solo dibujamos barra minimalista sobre los otros élites (Gusano Blindado y Evasor).
      const isElite = enemy instanceof ArmoredWorm || enemy instanceof Evasor;

      if (isElite) {
        const hpRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
        const barW = Math.max(28, enemy.size * 0.95);
        const barH = 3.5;
        const barX = enemy.x - barW / 2;
        const barY = enemy.y - enemy.size * 0.5 - 9;

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        this.ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);
        this.ctx.fillStyle = hpRatio > 0.5 ? '#00ff66' : hpRatio > 0.25 ? '#facc15' : '#ff1e42';
        this.ctx.fillRect(barX, barY, barW * hpRatio, barH);
        this.ctx.restore();
      }
    }
  }

  private drawOffScreenIndicators(camX: number = 0, camY: number = 0): void {
    const w = LOGICAL_WIDTH;
    const h = LOGICAL_HEIGHT;
    const edgePadding = 26;
    const flashAlpha = 0.45 + 0.55 * Math.abs(Math.sin(Date.now() * 0.007));

    const drawMarkerArrow = (worldX: number, worldY: number, isMiner: boolean) => {
      const screenX = worldX - camX;
      const screenY = worldY - camY;
      if (screenX >= 0 && screenX <= w && screenY >= 0 && screenY <= h) return;

      const cx = w / 2;
      const cy = h / 2;
      const dx = screenX - cx;
      const dy = screenY - cy;
      const angle = Math.atan2(dy, dx);

      const edgeX = Math.max(edgePadding, Math.min(w - edgePadding, cx + dx));
      const edgeY = Math.max(edgePadding, Math.min(h - edgePadding, cy + dy));

      this.ctx.save();
      this.ctx.translate(edgeX, edgeY);
      this.ctx.rotate(angle);

      const fillColor = isMiner
        ? `rgba(250, 204, 21, ${flashAlpha})`
        : `rgba(255, 30, 66, ${flashAlpha})`;
      const strokeColor = isMiner ? '#fef08a' : '#fecdd3';

      this.ctx.fillStyle = fillColor;
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 1.6;

      this.ctx.beginPath();
      this.ctx.moveTo(14, 0);
      this.ctx.lineTo(-10, -8);
      this.ctx.lineTo(-4, 0);
      this.ctx.lineTo(-10, 8);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.restore();
    };

    if (this.isCoopMode && !this.isCoopHost && this.coopSnapshot) {
      for (const e of this.coopSnapshot.enemies) {
        const typeCode = e[0];
        const isMiner = typeCode === 5;
        const isBoss = typeCode >= 8;
        if (!isMiner && !isBoss) continue;
        drawMarkerArrow(e[1], e[2], isMiner);
      }
    } else {
      for (const enemy of this.enemies) {
        if (!enemy.active) continue;
        const isMiner = enemy instanceof CryptoMiner || enemy.malwareType === 'CRYPTO_MINER';
        const isElite =
          enemy.malwareType === 'RANSOMWARE' ||
          enemy.malwareType === 'FINAL_BOSS' ||
          enemy instanceof ArmoredWorm ||
          enemy instanceof Evasor;

        if (!isMiner && !isElite) continue;
        drawMarkerArrow(enemy.x, enemy.y, isMiner);
      }
    }

    // Flechas direccionales en los bordes hacia los aliados Co-op fuera de cámara
    if (this.isCoopMode) {
      const allies = this.isCoopHost
        ? Array.from(this.coopPeers.values()).map((p) => ({
            slot: p.slot,
            x: p.player.x,
            y: p.player.y,
            downed: p.downed,
            color: p.slotColor,
          }))
        : (this.coopSnapshot?.players || [])
            .filter((p) => p.id !== this.mpClient.myId)
            .map((p) => ({
              slot: p.slot,
              x: p.x,
              y: p.y,
              downed: p.downed,
              color: p.color,
            }));

      for (const ally of allies) {
        const sx = ally.x - camX;
        const sy = ally.y - camY;
        const off = sx < 24 || sx > w - 24 || sy < 96 || sy > h - 24;
        if (!off && !ally.downed) continue;

        const cx = w / 2;
        const cy = h / 2;
        const dx = sx - cx;
        const dy = sy - cy;
        const angle = Math.atan2(dy, dx);
        const minX = 52;
        const maxX = w - 52;
        const minY = 110;
        const maxY = h - 52;
        let edgeX = Math.max(minX, Math.min(maxX, sx));
        let edgeY = Math.max(minY, Math.min(maxY, sy));
        if (off) {
          let t = 1;
          if (dx > 0.001) t = Math.min(t, (maxX - cx) / dx);
          else if (dx < -0.001) t = Math.min(t, (minX - cx) / dx);
          if (dy > 0.001) t = Math.min(t, (maxY - cy) / dy);
          else if (dy < -0.001) t = Math.min(t, (minY - cy) / dy);
          edgeX = Math.max(minX, Math.min(maxX, cx + dx * t));
          edgeY = Math.max(minY, Math.min(maxY, cy + dy * t));
          if (edgeX < 285 && edgeY < 305) {
            edgeY = 305;
          } else if (edgeX > w - 210 && edgeY < 305) {
            edgeY = 305;
          }
          const hasBottomBossHud =
            Boolean(this.finalBoss?.active) ||
            this.enemies.some((e) => e.active && e instanceof WaveBoss) ||
            Boolean(this.coopSnapshot?.boss && (this.coopSnapshot.boss.isToro || this.coopSnapshot.boss.hp > 0));
          if (hasBottomBossHud && Math.abs(edgeX - w / 2) < 370 && edgeY > h - 116) {
            edgeY = h - 116;
          }
        }
        const distM = Math.max(1, Math.round(Math.hypot(ally.x - this.player.x, ally.y - this.player.y) / 10));

        this.ctx.save();
        this.ctx.translate(edgeX, edgeY);

        if (off) {
          this.ctx.save();
          this.ctx.rotate(angle);
          this.ctx.fillStyle = ally.downed ? '#ff1e42' : ally.color;
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 2.0;
          this.ctx.beginPath();
          this.ctx.moveTo(18, 0);
          this.ctx.lineTo(-11, -11);
          this.ctx.lineTo(-5, 0);
          this.ctx.lineTo(-11, 11);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
          this.ctx.restore();
        }

        const label = ally.downed ? `✚ J${ally.slot + 1} ${distM}m` : `J${ally.slot + 1} · ${distM}m`;
        this.ctx.font = `bold 11.5px ${FONT_MONO}`;
        const tw = this.ctx.measureText(label).width;
        const labelY = edgeY > h - 75 ? -26 : 24;
        this.ctx.fillStyle = 'rgba(8, 13, 24, 0.85)';
        this.ctx.fillRect(-tw / 2 - 6, labelY - 12, tw + 12, 16);
        this.ctx.strokeStyle = ally.downed ? '#f43f5e' : ally.color;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(-tw / 2 - 6, labelY - 12, tw + 12, 16);
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = ally.downed ? '#fda4af' : '#f0f9ff';
        this.ctx.fillText(label, 0, labelY);
        this.ctx.restore();
      }
    }
  }

  private drawFreezeOverlay(): void {
    this.ctx.save();
    const grad = this.ctx.createRadialGradient(
      LOGICAL_WIDTH / 2,
      LOGICAL_HEIGHT / 2,
      LOGICAL_WIDTH * 0.3,
      LOGICAL_WIDTH / 2,
      LOGICAL_HEIGHT / 2,
      LOGICAL_WIDTH * 0.7
    );
    grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
    grad.addColorStop(1, 'rgba(0, 200, 255, 0.26)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.ctx.restore();
  }

  private drawCRTScanlines(): void {
    const w = LOGICAL_WIDTH;
    const h = LOGICAL_HEIGHT;
    const arm = 26;
    const pad = 10;

    this.ctx.save();
    // Esquinas tácticas de telemetría (sin franjas verdes CRT)
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.34)';
    this.ctx.lineWidth = 1.8;
    this.ctx.beginPath();
    // Arriba-izq
    this.ctx.moveTo(pad, pad + arm);
    this.ctx.lineTo(pad, pad);
    this.ctx.lineTo(pad + arm, pad);
    // Arriba-der
    this.ctx.moveTo(w - pad - arm, pad);
    this.ctx.lineTo(w - pad, pad);
    this.ctx.lineTo(w - pad, pad + arm);
    // Abajo-izq
    this.ctx.moveTo(pad, h - pad - arm);
    this.ctx.lineTo(pad, h - pad);
    this.ctx.lineTo(pad + arm, h - pad);
    // Abajo-der
    this.ctx.moveTo(w - pad - arm, h - pad);
    this.ctx.lineTo(w - pad, h - pad);
    this.ctx.lineTo(w - pad, h - pad - arm);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawTerminalLogBox(): void {
    const recent = this.terminalLogs.slice(-2);
    if (recent.length === 0) return;

    const boxX = 16;
    const boxH = 44;
    const boxY = LOGICAL_HEIGHT - boxH - 14;
    const boxW = 440;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(11, 19, 34, 0.72)';
    this.ctx.fillRect(boxX, boxY, boxW, boxH);

    // Barra vertical cyan hardware
    this.ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
    this.ctx.fillRect(boxX, boxY, 3, boxH);

    this.ctx.font = `11.5px ${FONT_MONO}`;
    const maxLineW = boxW - 22;
    for (let i = 0; i < recent.length; i++) {
      const isLatest = i === recent.length - 1;
      this.ctx.fillStyle = isLatest ? '#e0f2fe' : 'rgba(148, 163, 184, 0.7)';
      let line = recent[i];
      if (this.ctx.measureText(line).width > maxLineW) {
        while (line.length > 8 && this.ctx.measureText(line + '…').width > maxLineW) {
          line = line.slice(0, -1);
        }
        line += '…';
      }
      this.ctx.fillText(line, boxX + 12, boxY + 17 + i * 17);
    }
    this.ctx.restore();
  }

  private getMenuLayout(): {
    cx: number;
    cy: number;
    panelW: number;
    panelH: number;
    px: number;
    py: number;
    leftCx: number;
    bayX: number;
    bayY: number;
    bayW: number;
    bayH: number;
  } {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;
    const panelW = 1140;
    const panelH = 626;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2 + 12;
    const leftCx = px + 408;
    const bayX = px + 806;
    const bayY = py + 104;
    const bayW = 308;
    const bayH = 496;
    return { cx, cy, panelW, panelH, px, py, leftCx, bayX, bayY, bayW, bayH };
  }

  private getMenuTabRects(): {
    tab: MenuTab;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const { py, leftCx } = this.getMenuLayout();
    const tabW = 180;
    const tabH = 38;
    const gap = 12;
    const totalW = tabW * 4 + gap * 3;
    const startX = leftCx - totalW / 2;
    const y = py + 104;

    return [
      {
        tab: 'SHOP',
        label: `[Q] ${i18n.t('AGENTES', 'AGENTS')}`,
        x: startX,
        y,
        width: tabW,
        height: tabH,
      },
      {
        tab: 'LAB',
        label: `[U] ${i18n.t('LABORATORIO', 'KERNEL LAB')}`,
        x: startX + tabW + gap,
        y,
        width: tabW,
        height: tabH,
      },
      {
        tab: 'GACHA',
        label: `[G] ${i18n.t('GACHA', 'GACHA')}`,
        x: startX + (tabW + gap) * 2,
        y,
        width: tabW,
        height: tabH,
      },
      {
        tab: 'INVENTORY',
        label: `[I] ${i18n.t('SOMBREROS', 'HATS')} (${this.metaSystem.unlockedHats.size}/${HATS_DATABASE.length})`,
        x: startX + (tabW + gap) * 3,
        y,
        width: tabW,
        height: tabH,
      },
    ];
  }

  private getMenuLabRects(): {
    id: LabUpgradeId;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const { py, leftCx } = this.getMenuLayout();
    const cardW = 244;
    const cardH = 148;
    const gapX = 12;
    const gapY = 12;
    const totalW = cardW * 3 + gapX * 2;
    const startX = leftCx - totalW / 2;
    const startY = py + 154;

    return LAB_UPGRADES_ORDER.map((id, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      return {
        id,
        x: startX + col * (cardW + gapX),
        y: startY + row * (cardH + gapY),
        width: cardW,
        height: cardH,
      };
    });
  }

  private getInGameUltBarRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 30,
      y: 91,
      width: 328,
      height: 20,
    };
  }

  private getGameOverButtonRects(): {
    action: 'RETRY' | 'MENU';
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;
    const btnW = 360;
    const btnH = 42;
    const gap = 24;
    const y = cy + 236;

    if (this.isCoopMode && !this.isCoopHost) {
      return [
        {
          action: 'MENU',
          label: `[T / ESC / CLIC] ${i18n.t('SALIR AL HANGAR (O ESPERA AL HOST)', 'MAIN HANGAR (OR WAIT FOR HOST)')}`,
          x: cx - 260,
          y,
          width: 520,
          height: btnH,
        },
      ];
    }

    return [
      {
        action: 'RETRY',
        label: this.isCoopMode
          ? `[R / ENTER] ${i18n.t('VOLVER AL LOBBY CO-OP', 'RETURN TO CO-OP LOBBY')}`
          : `[R / ENTER] ${i18n.t('REINTENTAR PARTIDA', 'PLAY AGAIN')}`,
        x: cx - btnW - gap / 2,
        y,
        width: btnW,
        height: btnH,
      },
      {
        action: 'MENU',
        label: `[ESC / T] ${i18n.t('VOLVER AL HANGAR', 'RETURN TO HANGAR')}`,
        x: cx + gap / 2,
        y,
        width: btnW,
        height: btnH,
      },
    ];
  }

  private getMenuCharacterRects(): MenuCharacterRect[] {
    const { py, leftCx } = this.getMenuLayout();
    const cardW = 180;
    const cardH = 148;
    const gapX = 12;
    const gapY = 12;
    const totalW = cardW * 4 + gapX * 3;
    const startX = leftCx - totalW / 2;
    const startY = py + 154;

    return this.metaSystem.characterOrder.map((id, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      return {
        id,
        x: startX + col * (cardW + gapX),
        y: startY + row * (cardH + gapY),
        width: cardW,
        height: cardH,
      };
    });
  }

  private getGameModeButtonRects(): {
    mode: GameMode;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const { py, leftCx } = this.getMenuLayout();
    const btnW = 368;
    const btnH = 38;
    const gap = 16;
    return [
      {
        mode: 'CLASSIC',
        x: leftCx - btnW - gap / 2,
        y: py + 474,
        width: btnW,
        height: btnH,
      },
      {
        mode: 'NIGHTMARE',
        x: leftCx + gap / 2,
        y: py + 474,
        width: btnW,
        height: btnH,
      },
    ];
  }

  private getGachaPullButtonRects(): {
    count: 1 | 10;
    cost: number;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const { py, leftCx } = this.getMenuLayout();
    const btnW = 328;
    const btnH = 46;
    const gap = 20;
    const startX = leftCx - btnW - gap / 2;
    const y = py + 188;

    return [
      {
        count: 1,
        cost: GACHA_PULL_SINGLE_COST,
        label: `[1x] ${i18n.t('COMPILAR COFRE', 'OPEN CHEST')} (${GACHA_PULL_SINGLE_COST} CR)`,
        x: startX,
        y,
        width: btnW,
        height: btnH,
      },
      {
        count: 10,
        cost: GACHA_PULL_TEN_COST,
        label: `[10x] ${i18n.t('LOTE OVERCLOCK', 'BATCH x10')} (${GACHA_PULL_TEN_COST} CR)`,
        x: startX + btnW + gap,
        y,
        width: btnW,
        height: btnH,
      },
    ];
  }

  private getInventoryHatRects(): {
    hat: HatItem;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const unlockedList = this.metaSystem.getUnlockedHatsList();
    const pageItems = unlockedList.slice(this.inventoryPage * 9, (this.inventoryPage + 1) * 9);
    const { py, leftCx } = this.getMenuLayout();
    const cardW = 244;
    const cardH = 84;
    const gapX = 14;
    const gapY = 12;
    const totalW = cardW * 3 + gapX * 2;
    const startX = leftCx - totalW / 2;
    const startY = py + 158;

    return pageItems.map((hat, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      return {
        hat,
        x: startX + col * (cardW + gapX),
        y: startY + row * (cardH + gapY),
        width: cardW,
        height: cardH,
      };
    });
  }

  private getInventoryPaginationRects(): {
    dir: 'PREV' | 'NEXT';
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const totalUnlocked = this.metaSystem.getUnlockedHatsList().length;
    if (totalUnlocked <= 9) return [];

    const { py, leftCx } = this.getMenuLayout();
    const y = py + 452;
    const btnW = 135;
    const btnH = 28;

    return [
      {
        dir: 'PREV',
        label: i18n.t('<< ANTERIOR', '<< PREV'),
        x: leftCx - 225,
        y,
        width: btnW,
        height: btnH,
      },
      {
        dir: 'NEXT',
        label: i18n.t('SIGUIENTE >>', 'NEXT >>'),
        x: leftCx + 90,
        y,
        width: btnW,
        height: btnH,
      },
    ];
  }

  private getStartButtonRect(): { x: number; y: number; width: number; height: number } {
    const { px, py } = this.getMenuLayout();
    return {
      x: px + 34,
      y: py + 546,
      width: 410,
      height: 50,
    };
  }

  private getFullscreenButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 924,
      y: 26,
      width: 196,
      height: 44,
    };
  }

  private getGlobalRankingsButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1134,
      y: 26,
      width: 152,
      height: 44,
    };
  }

  private getDailyMissionsButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1300,
      y: 26,
      width: 192,
      height: 44,
    };
  }

  private getAchievementsButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1506,
      y: 26,
      width: 194,
      height: 44,
    };
  }

  private getSettingsButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1714,
      y: 26,
      width: 170,
      height: 44,
    };
  }

  private getInGameMuteButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: LOGICAL_WIDTH - 156,
      y: 24,
      width: 38,
      height: 24,
    };
  }

  private getInGamePauseButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: LOGICAL_WIDTH - 112,
      y: 24,
      width: 86,
      height: 24,
    };
  }

  private getRerollButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: LOGICAL_WIDTH / 2 - 185,
      y: LOGICAL_HEIGHT / 2 + 202,
      width: 370,
      height: 44,
    };
  }

  /** Traza un rectángulo con esquinas biseladas estilo HUD cibernético. */
  private traceChamferRect(x: number, y: number, w: number, h: number, cut: number = 10): void {
    const c = Math.max(0, Math.min(cut, w * 0.4, h * 0.4));
    this.ctx.beginPath();
    this.ctx.moveTo(x + c, y);
    this.ctx.lineTo(x + w - c, y);
    this.ctx.lineTo(x + w, y + c);
    this.ctx.lineTo(x + w, y + h - c);
    this.ctx.lineTo(x + w - c, y + h);
    this.ctx.lineTo(x + c, y + h);
    this.ctx.lineTo(x, y + h - c);
    this.ctx.lineTo(x, y + c);
    this.ctx.closePath();
  }

  /** Dibuja un panel o botón biselado reutilizable en el HUD y menús. */
  private drawCyberPanel(
    x: number,
    y: number,
    w: number,
    h: number,
    cut: number,
    fill: string,
    stroke: string,
    lineWidth: number = 1.8,
    glowColor?: string,
    glowBlur: number = 0
  ): void {
    this.ctx.save();
    this.ctx.fillStyle = fill;
    this.ctx.strokeStyle = stroke;
    this.ctx.lineWidth = lineWidth;
    if (glowColor && glowBlur > 0 && !this.lightGraphicsEnabled) {
      this.ctx.shadowColor = glowColor;
      this.ctx.shadowBlur = glowBlur;
    }
    this.traceChamferRect(x, y, w, h, cut);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  /** Fondo animado de modo atractivo detrás del Kernel Hub con estética de placa base / radar táctico. */
  private drawMenuAttractBackdrop(): void {
    const w = LOGICAL_WIDTH;
    const h = LOGICAL_HEIGHT;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const t = performance.now() * 0.001;

    this.ctx.save();

    // Anillos holográficos orbitales centrados detrás de la bahía de hardware
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([20, 14]);
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(t * 0.1);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 440, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.14)';
    this.ctx.rotate(-t * 0.2);
    this.ctx.setLineDash([12, 24]);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 535, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
    this.ctx.setLineDash([]);

    // Flujos verticales de buses de datos en los márgenes laterales
    const lanes = [84, 176, 268, w - 268, w - 176, w - 84];
    for (let i = 0; i < lanes.length; i++) {
      const lx = lanes[i];
      const streamY = ((t * (70 + i * 18) + i * 210) % (h + 240)) - 120;
      const grad = this.ctx.createLinearGradient(lx, streamY - 70, lx, streamY + 70);
      const col = i % 2 === 0 ? '56, 189, 248' : '16, 185, 129';
      grad.addColorStop(0, `rgba(${col}, 0)`);
      grad.addColorStop(0.5, `rgba(${col}, 0.25)`);
      grad.addColorStop(1, `rgba(${col}, 0)`);
      this.ctx.strokeStyle = grad;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(lx, streamY - 70);
      this.ctx.lineTo(lx, streamY + 70);
      this.ctx.stroke();
    }

    // Interceptores y bots patrullando en los laterales
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const baseX = side < 0 ? 185 : w - 185;
      const phase = t * 0.72 + i * 1.45;
      const px = baseX + Math.sin(phase * 1.15) * 95;
      const py = cy + Math.cos(phase * 0.85 + i) * (h * 0.32);
      const angle = Math.atan2(
        -Math.sin(phase * 0.85 + i) * 0.85,
        Math.cos(phase * 1.15) * 1.15
      );
      const isHostile = i % 2 === 1;

      this.ctx.save();
      this.ctx.globalAlpha = 0.36;
      this.ctx.translate(px, py);
      this.ctx.rotate(angle);
      this.ctx.strokeStyle = isHostile ? '#f43f5e' : '#38bdf8';
      this.ctx.fillStyle = isHostile ? 'rgba(244, 63, 94, 0.18)' : 'rgba(56, 189, 248, 0.18)';
      this.ctx.lineWidth = 1.6;
      this.ctx.beginPath();
      this.ctx.moveTo(12, 0);
      this.ctx.lineTo(-9, -8);
      this.ctx.lineTo(-5, 0);
      this.ctx.lineTo(-9, 8);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  private drawClippedButton(
    rect: { x: number; y: number; width: number; height: number },
    bgFill: string,
    strokeColor: string,
    lineWidth: number,
    textColor: string,
    baseFontSize: number,
    text: string,
    shadowColor?: string,
    shadowBlur?: number
  ): void {
    this.ctx.save();
    this.drawCyberPanel(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      8,
      bgFill,
      strokeColor,
      lineWidth,
      shadowColor,
      shadowBlur ?? 0
    );

    // Recorte estricto dentro del botón biselado
    this.traceChamferRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, 6);
    this.ctx.clip();

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = textColor;

    const maxW = rect.width - 14;
    let fontSize = baseFontSize;
    this.ctx.font = `bold ${fontSize}px ${FONT_DISPLAY}`;
    const m = this.ctx.measureText(text).width;
    if (m > maxW) {
      fontSize = Math.max(9, Math.floor(baseFontSize * (maxW / m)));
      this.ctx.font = `bold ${fontSize}px ${FONT_DISPLAY}`;
    }

    this.ctx.fillText(text, rect.x + rect.width / 2, rect.y + Math.round(rect.height / 2) + 5);
    this.ctx.restore();
  }

  private isExternalLoginAllowed(): boolean {
    if (typeof window === 'undefined') return true;
    const hostname = window.location.hostname || '';
    const referrer = document.referrer || '';
    const isCrazyGames =
      hostname.includes('crazygames') ||
      referrer.includes('crazygames') ||
      (window as any).CrazyGames !== undefined;
    return !isCrazyGames;
  }

  private getAuthActionButtonRect(): { x: number; y: number; width: number; height: number } {
    if (this.currentUser) {
      return {
        x: 308,
        y: 26,
        width: 160,
        height: 44,
      };
    } else {
      return {
        x: 36,
        y: 26,
        width: 310,
        height: 44,
      };
    }
  }

  private getCoopOnlineButtonRect(): { x: number; y: number; width: number; height: number } {
    const { px, py } = this.getMenuLayout();
    return {
      x: px + 460,
      y: py + 546,
      width: 324,
      height: 50,
    };
  }

  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  private getSettingsControlRects(): {
    id:
      | 'MASTER_DOWN'
      | 'MASTER_UP'
      | 'MUSIC_DOWN'
      | 'MUSIC_UP'
      | 'SFX_DOWN'
      | 'SFX_UP'
      | 'TOGGLE_MUTE'
      | 'TOGGLE_SHAKE'
      | 'LANG_ES'
      | 'LANG_EN'
      | 'TOGGLE_LIGHT_GFX'
      | 'OPEN_HELP'
      | 'BACK';
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;
    const panelH = 590;
    const py = cy - panelH / 2;
    const rowStartY = py + 104;
    const rowGap = 50;
    const langY = py + 316;
    const extraY = py + 378;
    const backRect = this.getOverlayBackButtonRect(py, panelH);

    return [
      { id: 'MASTER_DOWN', x: cx + 70, y: rowStartY, width: 44, height: 32 },
      { id: 'MASTER_UP', x: cx + 200, y: rowStartY, width: 44, height: 32 },
      { id: 'MUSIC_DOWN', x: cx + 70, y: rowStartY + rowGap, width: 44, height: 32 },
      { id: 'MUSIC_UP', x: cx + 200, y: rowStartY + rowGap, width: 44, height: 32 },
      { id: 'SFX_DOWN', x: cx + 70, y: rowStartY + rowGap * 2, width: 44, height: 32 },
      { id: 'SFX_UP', x: cx + 200, y: rowStartY + rowGap * 2, width: 44, height: 32 },
      { id: 'TOGGLE_MUTE', x: cx - 240, y: rowStartY + rowGap * 3 + 10, width: 230, height: 38 },
      { id: 'TOGGLE_SHAKE', x: cx + 10, y: rowStartY + rowGap * 3 + 10, width: 230, height: 38 },
      { id: 'LANG_ES', x: cx - 20, y: langY, width: 120, height: 38 },
      { id: 'LANG_EN', x: cx + 120, y: langY, width: 120, height: 38 },
      { id: 'TOGGLE_LIGHT_GFX', x: cx - 240, y: extraY, width: 230, height: 42 },
      { id: 'OPEN_HELP', x: cx + 10, y: extraY, width: 230, height: 42 },
      { id: 'BACK', ...backRect },
    ];
  }

  private openLeaderboardOverlay(): void {
    this.activeLeaderboardCategory = 'SURVIVAL_TIME';
    this.showLeaderboardOverlay = true;
    this.sound.playCoinPickup();
    void this.refreshLeaderboards();
  }

  private async refreshLeaderboards(): Promise<void> {
    this.leaderboardLoading = true;
    try {
      const [toroTop, timeTop] = await Promise.all([
        this.metaSystem.fetchTopToroDamageLeaderboard(),
        this.metaSystem.fetchTopSurvivalTimeLeaderboard(),
      ]);
      this.toroDamageLeaderboard = toroTop;
      this.survivalTimeLeaderboard = timeTop;
    } finally {
      this.leaderboardLoading = false;
    }
  }

  private getLeaderboardTabRects(): {
    category: LeaderboardCategory;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;
    const py = cy - 290;
    const tabW = 310;
    const tabH = 36;
    const gap = 16;
    const startX = cx - tabW - gap / 2;
    const y = py + 62;

    return [
      {
        category: 'TORO_DAMAGE',
        label: '🐂 TOP DAMAGE TO TORO',
        x: startX,
        y,
        width: tabW,
        height: tabH,
      },
      {
        category: 'SURVIVAL_TIME',
        label: '⏱️ BEST SURVIVAL TIME',
        x: startX + tabW + gap,
        y,
        width: tabW,
        height: tabH,
      },
    ];
  }

  private getLeaderboardBackButtonRect(): { x: number; y: number; width: number; height: number } {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;
    const py = cy - 290;
    const width = 260;
    const height = 38;
    return {
      x: cx - width / 2,
      y: py + 518,
      width,
      height,
    };
  }

  private handleAuthButtonClick(): void {
    if (this.currentUser) {
      signOut(auth)
        .then(() => {
          this.sound.playShoot(false);
          this.menuFeedbackMessage = i18n.t(
            'Sesión de Google cerrada correctamente.',
            'Signed out of Google successfully.'
          );
          this.addTerminalLog('AUTH: Google Session Terminated.');
        })
        .catch((err) => {
          console.error('Error al cerrar sesión:', err);
          this.menuFeedbackMessage = i18n.t(
            'Error al cerrar sesión.',
            'Error signing out.'
          );
        });
    } else {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      this.menuFeedbackMessage = i18n.t(
        'Abriendo ventana de inicio de sesión con Google...',
        'Opening Google sign-in window...'
      );
      signInWithPopup(auth, googleProvider)
        .then((result) => {
          this.sound.playCoinPickup();
          logAnalyticsEvent('login', { method: 'google' });
          const name = result.user.displayName || result.user.email || 'Survivor';
          this.menuFeedbackMessage = i18n.t(
            `¡Bienvenido, ${name}! Autenticación completada.`,
            `Welcome, ${name}! Authentication complete.`
          );
        })
        .catch((err: { code?: string; message?: string }) => {
          console.error('Error en Google Login:', err);
          const code = err?.code || '';
          const isIframe = window.self !== window.top;
          if (code === 'auth/popup-blocked') {
            if (isIframe) {
              this.menuFeedbackMessage = i18n.t(
                'Popup bloqueado por el navegador. Permite ventanas emergentes en la barra de tu navegador.',
                'Popup blocked by browser. Allow popups in your address bar.'
              );
            } else {
              this.menuFeedbackMessage = i18n.t(
                'Popup bloqueado. Redirigiendo a Google Login...',
                'Popup blocked. Redirecting to Google Login...'
              );
              void signInWithRedirect(auth, googleProvider);
            }
          } else if (code === 'auth/unauthorized-domain') {
            this.menuFeedbackMessage = i18n.t(
              `Añade "${window.location.hostname}" en Firebase > Auth > Settings > Dominios autorizados.`,
              `Add "${window.location.hostname}" in Firebase > Auth > Settings > Authorized domains.`
            );
          } else if (
            code === 'auth/operation-not-allowed' ||
            code === 'auth/configuration-not-found'
          ) {
            this.menuFeedbackMessage = i18n.t(
              'Activa el proveedor Google en Firebase > Authentication > Sign-in method.',
              'Enable Google provider in Firebase > Authentication > Sign-in method.'
            );
          } else if (code === 'auth/popup-closed-by-user') {
            this.menuFeedbackMessage = i18n.t(
              'Ventana de inicio de sesión cerrada por el usuario.',
              'Sign-in window closed by user.'
            );
          } else {
            this.menuFeedbackMessage = i18n.t(
              `Error de inicio de sesión (${code || 'verifica Firebase Auth'}).`,
              `Sign-in error (${code || 'check Firebase Auth'}).`
            );
          }
        });
    }
  }

  private drawHardwareStatRow(
    x: number,
    y: number,
    w: number,
    label: string,
    valText: string,
    ratio: number,
    color: string
  ): void {
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = `bold 10.5px ${FONT_MONO}`;
    this.ctx.fillText(label, x, y);

    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.fillText(valText, x + w, y);

    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    this.ctx.fillRect(x, y + 6, w, 6);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y + 6, w * Math.max(0.08, Math.min(1, ratio)), 6);
  }

  /**
   * Bahía derecha de telemetría en vivo: muestra el Agente táctico y su sombrero vectorial en tiempo real.
   */
  private drawLiveHangarBay(bayX: number, bayY: number, bayW: number, bayH: number): void {
    const now = performance.now();
    const previewCharId = this.hoveredMenuChar ?? this.metaSystem.selectedCharacter;
    const profile = this.metaSystem.characters[previewCharId];
    const unlockedChar = this.metaSystem.isUnlocked(previewCharId);
    const equippedHat = this.metaSystem.getEquippedHat();
    const hoveredHat =
      this.activeMenuTab === 'INVENTORY' && this.hoveredHatId
        ? this.metaSystem.getUnlockedHatsList().find((h) => h.id === this.hoveredHatId) ?? null
        : null;
    const shownHat = hoveredHat ?? equippedHat;
    const isHatPreview = Boolean(hoveredHat && hoveredHat.id !== equippedHat?.id);

    this.ctx.save();
    this.drawCyberPanel(
      bayX,
      bayY,
      bayW,
      bayH,
      14,
      'rgba(8, 14, 26, 0.96)',
      'rgba(56, 189, 248, 0.45)',
      1.6
    );
    this.traceChamferRect(bayX + 2, bayY + 2, bayW - 4, bayH - 4, 12);
    this.ctx.clip();

    const cxBay = bayX + bayW / 2;
    const spotGrad = this.ctx.createRadialGradient(cxBay, bayY + 110, 12, cxBay, bayY + 120, 165);
    spotGrad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
    spotGrad.addColorStop(1, 'rgba(8, 14, 26, 0)');
    this.ctx.fillStyle = spotGrad;
    this.ctx.fillRect(bayX, bayY, bayW, 240);

    // Cabecera de bahía
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = `bold 11px ${FONT_MONO}`;
    this.ctx.fillText(
      this.hoveredMenuChar
        ? i18n.t('// VISTA PREVIA DE UNIDAD //', '// UNIT HOLOVIEW //')
        : i18n.t('// BAHÍA DE UNIDAD ACTIVA //', '// ACTIVE HARDWARE BAY //'),
      cxBay,
      bayY + 24
    );

    // Plataforma PCB giratoria debajo del personaje
    const botY = bayY + 122 + Math.sin(now * 0.004) * 3;
    this.ctx.save();
    this.ctx.translate(cxBay, bayY + 162);
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    this.ctx.lineWidth = 1.4;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 74, 22, 0, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([8, 8]);
    this.ctx.strokeStyle = profile.borderColor;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 54, 15, 0, (now * 0.001) % (Math.PI * 2), Math.PI * 2 + (now * 0.001) % (Math.PI * 2));
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.restore();

    // Bot táctico a tamaño grande con su sombrero vectorial puesto
    Player.drawCyberChassis(
      this.ctx,
      cxBay,
      botY,
      72,
      profile.color,
      profile.borderColor,
      now,
      Math.sin(now * 0.0015) * 0.45,
      true,
      shownHat?.id ?? null,
      profile.id
    );

    if (profile.id === 'MORCILLITA') {
      const petX = cxBay + 46 + Math.cos(now * 0.003) * 6;
      const petY = botY - 26 + Math.sin(now * 0.004) * 5;
      this.ctx.save();
      this.ctx.translate(petX, petY);
      this.ctx.rotate(Math.PI / 4 + Math.sin(now * 0.002) * 0.12);
      this.ctx.fillStyle = '#92400e';
      this.ctx.strokeStyle = '#fbbf24';
      this.ctx.lineWidth = 1.8;
      this.ctx.fillRect(-10, -10, 20, 20);
      this.ctx.strokeRect(-10, -10, 20, 20);
      this.ctx.restore();
    }

    // Nombre del Agente y estado
    const pName = i18n.currentLang === 'EN' && profile.nameEn ? profile.nameEn : profile.name;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = `bold 15px ${FONT_DISPLAY}`;
    this.ctx.fillText(pName, cxBay, bayY + 210);

    this.ctx.fillStyle = unlockedChar ? '#10b981' : '#f59e0b';
    this.ctx.font = `bold 10.5px ${FONT_MONO}`;
    this.ctx.fillText(
      unlockedChar
        ? i18n.t('[ HARDWARE DISPONIBLE ]', '[ HARDWARE ONLINE ]')
        : i18n.t(`[ BLOQUEADO: ${profile.cost} CR ]`, `[ LOCKED: ${profile.cost} CR ]`),
      cxBay,
      bayY + 226
    );

    const pPassiveName = i18n.currentLang === 'EN' ? profile.passiveNameEn : profile.passiveName;
    const pUltName = i18n.currentLang === 'EN' ? profile.ultNameEn : profile.ultName;
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.font = `bold 9.8px ${FONT_MONO}`;
    this.ctx.fillText(`★ ${pPassiveName}`, cxBay, bayY + 241);
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.fillText(`⚡ [E/ESP]: ${pUltName} (${profile.ultDuration}s)`, cxBay, bayY + 255);

    // Barras de telemetría de unidad (incluyendo bonos del sombrero y del Laboratorio Kernel)
    const lab = this.metaSystem.getLabBonuses();
    const hpTotal = Math.round((100 * profile.hpMultiplier + (shownHat?.stats.maxHpBonus ?? 0)) * lab.hpMult);
    const spdPct = Math.round(profile.speedMultiplier * (1 + (shownHat?.stats.speedMult ?? 0)) * lab.speedMult * 100);
    const magTotal = Math.round((115 * profile.pickupRadiusMultiplier + (shownHat?.stats.magnetBonus ?? 0)) * lab.magnetMult);

    const statX = bayX + 22;
    const statW = bayW - 44;
    this.drawHardwareStatRow(statX, bayY + 266, statW, 'KERNEL HP', `${hpTotal} HP`, hpTotal / 240, '#10b981');
    this.drawHardwareStatRow(statX, bayY + 298, statW, 'CLOCK SPD', `${spdPct}%`, spdPct / 150, '#38bdf8');
    this.drawHardwareStatRow(statX, bayY + 330, statW, 'MAGNET BUS', `${magTotal}px`, magTotal / 200, '#a855f7');

    // Módulo de Sombrero / Accesorio Vectorial Activo
    const modX = bayX + 16;
    const modY = bayY + 362;
    const modW = bayW - 32;
    const modH = 114;
    const rConf = shownHat ? RARITY_CONFIG[shownHat.rarity] : null;

    this.drawCyberPanel(
      modX,
      modY,
      modW,
      modH,
      10,
      'rgba(15, 23, 42, 0.94)',
      rConf ? rConf.color : 'rgba(100, 116, 139, 0.45)',
      1.5
    );

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = isHatPreview ? '#fbbf24' : '#38bdf8';
    this.ctx.font = `bold 10.5px ${FONT_MONO}`;
    this.ctx.fillText(
      isHatPreview
        ? i18n.t('MODULO // PREVIEW', 'MODULE // PREVIEW')
        : i18n.t('MODULO // EQUIPADO', 'MODULE // EQUIPPED'),
      modX + 12,
      modY + 20
    );

    if (shownHat && rConf) {
      HatRenderer.drawHatIcon(this.ctx, shownHat.id, modX + 34, modY + 62, 34, now);

      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = `bold 12.5px ${FONT_DISPLAY}`;
      const hatTitle =
        shownHat.name.length > 22 ? shownHat.name.slice(0, 21) + '…' : shownHat.name;
      this.ctx.fillText(hatTitle, modX + 66, modY + 52);

      this.ctx.fillStyle = rConf.color;
      this.ctx.font = `bold 10px ${FONT_MONO}`;
      this.ctx.fillText(rConf.label.split(' ')[0], modX + 66, modY + 70);

      this.ctx.fillStyle = '#a3e635';
      this.ctx.font = `bold 11.5px ${FONT_MONO}`;
      this.ctx.fillText(shownHat.statsLabel, modX + 66, modY + 92);
    } else {
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#64748b';
      this.ctx.font = `12px ${FONT_DISPLAY}`;
      this.ctx.fillText(
        i18n.t('Sin accesorio equipado', 'No headgear module equipped'),
        cxBay,
        modY + 62
      );
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = `11px ${FONT_MONO}`;
      this.ctx.fillText(i18n.t('Abre cofres en [G] Gacha', 'Unlock hats in [G] Gacha'), cxBay, modY + 84);
    }

    this.ctx.restore();
  }

  private drawStartMenuWithShop(): void {
    const { cx, panelW, panelH, px, py, leftCx, bayX, bayY, bayW, bayH } = this.getMenuLayout();
    const now = performance.now();

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 9, 18, 0.78)';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.drawMenuAttractBackdrop();

    // ==========================================
    // 1. ESQUINA SUPERIOR IZQUIERDA: HUD JUGADOR / AUTH
    // ==========================================
    if (this.currentUser) {
      const displayName = this.currentUser.displayName || this.currentUser.email || 'Survivor';
      const truncatedName = displayName.length > 16 ? displayName.slice(0, 15) + '…' : displayName;
      const statusBoxX = 36;
      const statusBoxY = 26;
      const statusBoxW = 260;
      const statusBoxH = 44;

      this.ctx.save();
      this.drawCyberPanel(
        statusBoxX,
        statusBoxY,
        statusBoxW,
        statusBoxH,
        8,
        'rgba(11, 19, 34, 0.95)',
        '#10b981',
        1.5,
        '#10b981',
        8
      );

      this.traceChamferRect(statusBoxX + 2, statusBoxY + 2, statusBoxW - 4, statusBoxH - 4, 6);
      this.ctx.clip();

      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.font = `bold 13px ${FONT_DISPLAY}`;
      this.ctx.fillText(`${i18n.t('AGENTE', 'AGENT')}: ${truncatedName}`, statusBoxX + 14, statusBoxY + 20);

      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = `bold 10.5px ${FONT_MONO}`;
      this.ctx.fillText(`SYNC // ${i18n.t('NUBE CONECTADA', 'CLOUD ONLINE')}`, statusBoxX + 14, statusBoxY + 35);
      this.ctx.restore();

      const authBtn = this.getAuthActionButtonRect();
      this.drawClippedButton(
        authBtn,
        this.hoveredAuthBtn ? 'rgba(127, 29, 29, 0.95)' : 'rgba(69, 10, 10, 0.9)',
        this.hoveredAuthBtn ? '#f87171' : '#ef4444',
        this.hoveredAuthBtn ? 2 : 1.5,
        '#fecaca',
        12,
        `[L] ${i18n.t('CERRAR SESIÓN', 'LOG OUT')}`
      );
    } else if (this.isExternalLoginAllowed()) {
      const authBtn = this.getAuthActionButtonRect();
      this.drawClippedButton(
        authBtn,
        this.hoveredAuthBtn ? 'rgba(14, 55, 85, 0.96)' : 'rgba(11, 22, 40, 0.94)',
        this.hoveredAuthBtn ? '#10b981' : '#38bdf8',
        this.hoveredAuthBtn ? 2.2 : 1.5,
        this.hoveredAuthBtn ? '#10b981' : '#e0f2fe',
        12,
        `[L] ${i18n.t('CONECTAR CON GOOGLE', 'SIGN IN WITH GOOGLE')}`,
        this.hoveredAuthBtn ? '#10b981' : '#38bdf8',
        this.hoveredAuthBtn ? 12 : 4
      );
    }

    // ==========================================
    // 2. ESQUINA SUPERIOR DERECHA: CONTROLES DEL WORKSTATION
    // ==========================================
    const fsBtn = this.getFullscreenButtonRect();
    this.drawClippedButton(
      fsBtn,
      this.hoveredFullscreenBtn ? 'rgba(14, 52, 74, 0.96)' : 'rgba(11, 22, 40, 0.94)',
      this.hoveredFullscreenBtn ? '#ffffff' : '#38bdf8',
      this.hoveredFullscreenBtn ? 2.2 : 1.5,
      this.hoveredFullscreenBtn ? '#ffffff' : '#bae6fd',
      12,
      `[F] ${i18n.t('PANTALLA COMPLETA', 'FULLSCREEN')}`,
      '#38bdf8',
      this.hoveredFullscreenBtn ? 12 : 4
    );

    const rankingsBtn = this.getGlobalRankingsButtonRect();
    this.drawClippedButton(
      rankingsBtn,
      this.hoveredRankingsBtn ? 'rgba(72, 44, 12, 0.96)' : 'rgba(28, 22, 16, 0.94)',
      this.hoveredRankingsBtn ? '#ffffff' : '#fbbf24',
      this.hoveredRankingsBtn ? 2.2 : 1.5,
      this.hoveredRankingsBtn ? '#ffffff' : '#fde68a',
      11.5,
      `[R] ${i18n.t('RANKINGS', 'RANKINGS')}`,
      '#fbbf24',
      this.hoveredRankingsBtn ? 12 : 4
    );

    const dailyBtn = this.getDailyMissionsButtonRect();
    const dailyDone = this.dailyMissions.getCompletedCount();
    this.drawClippedButton(
      dailyBtn,
      this.hoveredDailyMissionsBtn ? 'rgba(74, 42, 10, 0.96)' : 'rgba(26, 20, 14, 0.94)',
      this.hoveredDailyMissionsBtn ? '#ffffff' : '#f59e0b',
      this.hoveredDailyMissionsBtn ? 2.2 : 1.5,
      this.hoveredDailyMissionsBtn ? '#ffffff' : '#fde68a',
      11.5,
      `[M] ${i18n.t('DIARIAS', 'DAILY')} (${dailyDone}/3)`,
      '#f59e0b',
      this.hoveredDailyMissionsBtn ? 12 : 4
    );

    const achBtn = this.getAchievementsButtonRect();
    const achUnlocked = this.achievementSystem.getUnlockedCount();
    const totalAch = this.achievementSystem.achievements.length;
    this.drawClippedButton(
      achBtn,
      this.hoveredAchievementsBtn ? 'rgba(14, 58, 42, 0.96)' : 'rgba(12, 26, 28, 0.94)',
      this.hoveredAchievementsBtn ? '#ffffff' : '#10b981',
      this.hoveredAchievementsBtn ? 2.2 : 1.5,
      this.hoveredAchievementsBtn ? '#ffffff' : '#a7f3d0',
      11.5,
      `[A] ${i18n.t('LOGROS', 'ACHIEV.')} (${achUnlocked}/${totalAch})`,
      '#10b981',
      this.hoveredAchievementsBtn ? 12 : 4
    );

    const setBtn = this.getSettingsButtonRect();
    this.drawClippedButton(
      setBtn,
      this.hoveredSettingsBtn ? 'rgba(24, 42, 68, 0.96)' : 'rgba(11, 22, 40, 0.94)',
      this.hoveredSettingsBtn ? '#ffffff' : '#64748b',
      this.hoveredSettingsBtn ? 2.2 : 1.5,
      this.hoveredSettingsBtn ? '#ffffff' : '#cbd5e1',
      11.5,
      `[O] ${i18n.t('AJUSTES', 'SETTINGS')}`,
      '#38bdf8',
      this.hoveredSettingsBtn ? 10 : 3
    );

    // ==========================================
    // 3. PANEL CENTRAL (CYBER HARDWARE WORKSTATION)
    // ==========================================
    this.drawCyberPanel(
      px,
      py,
      panelW,
      panelH,
      16,
      'rgba(11, 19, 34, 0.96)',
      '#38bdf8',
      2.0,
      '#0284c7',
      24
    );

    // Barra decorativa superior de silicio/cobre-cyan
    const headerGrad = this.ctx.createLinearGradient(px + 60, py + 4, px + panelW - 60, py + 4);
    headerGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    headerGrad.addColorStop(0.35, 'rgba(56, 189, 248, 0.9)');
    headerGrad.addColorStop(0.65, 'rgba(16, 185, 129, 0.9)');
    headerGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    this.ctx.fillStyle = headerGrad;
    this.ctx.fillRect(px + 60, py + 2, panelW - 120, 3);

    // Cabecera izquierda limpia + píldoras de telemetría derecha
    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = `bold 27px ${FONT_DISPLAY}`;
    this.ctx.fillText('DAW-SURVIVOR', px + 34, py + 44);

    const titleW = this.ctx.measureText('DAW-SURVIVOR').width;
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = `bold 13px ${FONT_MONO}`;
    this.ctx.fillText(`// HARDWARE HANGAR ${GAME_VERSION}`, px + 46 + titleW, py + 43);

    const equippedHat = this.metaSystem.getEquippedHat();
    const noneText = i18n.t('Ninguno', 'None');
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = `bold 12.5px ${FONT_MONO}`;
    this.ctx.fillText(
      `${i18n.t('RÉCORD', 'BEST')}: ${this.metaSystem.highScore} (${this.formatTimeMMSS(this.metaSystem.bestTimeSeconds)})   •   CRYPTO: ${this.metaSystem.coins} CR   •   ${i18n.t('SOMBRERO', 'HAT')}: ${equippedHat ? equippedHat.name : noneText}`,
      px + 34,
      py + 72
    );

    // Separador sutil entre consola izquierda y bahía derecha
    this.ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    this.ctx.fillRect(px + 26, py + 88, panelW - 52, 1);

    // Bahía derecha fija con el Bot + Sombrero vectorial en vivo
    this.drawLiveHangarBay(bayX, bayY, bayW, bayH);

    // Barra de pestañas de consola izquierda ([Q] | [G] | [I])
    for (const tabRect of this.getMenuTabRects()) {
      const isActive = this.activeMenuTab === tabRect.tab;
      this.drawCyberPanel(
        tabRect.x,
        tabRect.y,
        tabRect.width,
        tabRect.height,
        8,
        isActive ? 'rgba(14, 52, 82, 0.96)' : 'rgba(15, 25, 44, 0.9)',
        isActive ? '#38bdf8' : 'rgba(71, 85, 105, 0.65)',
        isActive ? 2.0 : 1.4,
        isActive ? '#38bdf8' : undefined,
        isActive ? 8 : 0
      );

      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = isActive ? '#f8fafc' : '#94a3b8';
      this.ctx.font = `bold 12.5px ${FONT_DISPLAY}`;
      this.ctx.fillText(tabRect.label, tabRect.x + tabRect.width / 2, tabRect.y + 24);
    }

    if (this.activeMenuTab === 'SHOP') {
      const charRects = this.getMenuCharacterRects();
      for (let i = 0; i < charRects.length; i++) {
        const rect = charRects[i];
        const profile = this.metaSystem.characters[rect.id];
        const unlocked = this.metaSystem.isUnlocked(rect.id);
        const selected = this.metaSystem.selectedCharacter === rect.id;
        const hovered = this.hoveredMenuChar === rect.id;

        this.ctx.save();
        this.drawCyberPanel(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          10,
          selected
            ? 'rgba(10, 46, 56, 0.96)'
            : hovered
            ? 'rgba(20, 36, 62, 0.96)'
            : 'rgba(15, 24, 42, 0.93)',
          selected ? '#10b981' : hovered ? '#38bdf8' : unlocked ? 'rgba(148, 163, 184, 0.45)' : '#f59e0b',
          selected || hovered ? 2.2 : 1.4,
          selected ? '#10b981' : hovered ? '#38bdf8' : undefined,
          selected || hovered ? 8 : 0
        );

        this.traceChamferRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, 8);
        this.ctx.clip();

        const previewX = rect.x + 26;
        const previewY = rect.y + 30;
        Player.drawCyberChassis(
          this.ctx,
          previewX,
          previewY,
          24,
          profile.color,
          profile.borderColor,
          now,
          0,
          selected || hovered,
          selected && equippedHat ? equippedHat.id : null,
          profile.id
        );

        if (rect.id === 'MORCILLITA') {
          this.ctx.save();
          this.ctx.translate(previewX + 13, previewY - 10);
          this.ctx.rotate(Math.PI / 4);
          this.ctx.fillStyle = '#92400e';
          this.ctx.strokeStyle = '#fbbf24';
          this.ctx.lineWidth = 1.4;
          this.ctx.fillRect(-4, -4, 8, 8);
          this.ctx.strokeRect(-4, -4, 8, 8);
          this.ctx.restore();
        }

        this.ctx.shadowBlur = 0;
        const pName = i18n.currentLang === 'EN' && profile.nameEn ? profile.nameEn : profile.name;
        const pSub = i18n.currentLang === 'EN' && profile.subtitleEn ? profile.subtitleEn : profile.subtitle;
        const pPassive = i18n.currentLang === 'EN' ? profile.passiveDescEn : profile.passiveDesc;

        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#ffffff';
        let nameFont = 12;
        const maxTitleW = rect.width - 54;
        const titleStr = `[${i + 1}] ${pName}`;
        this.ctx.font = `bold ${nameFont}px ${FONT_DISPLAY}`;
        const tW = this.ctx.measureText(titleStr).width;
        if (tW > maxTitleW) {
          nameFont = Math.max(9.5, Math.floor(12 * (maxTitleW / tW)));
          this.ctx.font = `bold ${nameFont}px ${FONT_DISPLAY}`;
        }
        this.ctx.fillText(titleStr, rect.x + 48, rect.y + 25, rect.width - 58);

        this.ctx.fillStyle = '#38bdf8';
        this.ctx.font = `bold 9.5px ${FONT_MONO}`;
        this.ctx.fillText(pSub, rect.x + 48, rect.y + 41, rect.width - 58);

        this.ctx.fillStyle = '#cbd5e1';
        this.ctx.font = `10.8px ${FONT_DISPLAY}`;
        this.wrapText(pPassive, rect.x + 10, rect.y + 62, rect.width - 20, 14, 4);

        this.ctx.font = `bold 10.5px ${FONT_MONO}`;
        if (selected) {
          this.ctx.fillStyle = '#10b981';
          this.ctx.fillText(i18n.t('[✓] EQUIPADO', '[✓] EQUIPPED'), rect.x + 10, rect.y + rect.height - 11);
        } else if (unlocked) {
          this.ctx.fillStyle = '#38bdf8';
          this.ctx.fillText(
            i18n.t(`▸ [${i + 1}] EQUIPAR`, `▸ [${i + 1}] EQUIP`),
            rect.x + 10,
            rect.y + rect.height - 11
          );
        } else {
          const canAfford = this.metaSystem.coins >= profile.cost;
          this.ctx.fillStyle = canAfford ? '#fbbf24' : '#f43f5e';
          this.ctx.fillText(
            i18n.t(`DESBLOQUEAR (${profile.cost} CR)`, `UNLOCK (${profile.cost} CR)`),
            rect.x + 10,
            rect.y + rect.height - 11
          );
        }

        this.ctx.restore();
      }
    } else if (this.activeMenuTab === 'LAB') {
      const labRects = this.getMenuLabRects();
      for (let i = 0; i < labRects.length; i++) {
        const rect = labRects[i];
        const cfg = LAB_UPGRADES_CONFIG[rect.id];
        const lvl = this.metaSystem.getLabLevel(rect.id);
        const isMaxed = lvl >= cfg.maxLevel;
        const nextCost = isMaxed ? 0 : cfg.costs[lvl] ?? 999;
        const canAfford = !isMaxed && this.metaSystem.coins >= nextCost;
        const hovered = this.hoveredLabId === rect.id;

        this.ctx.save();
        this.drawCyberPanel(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          10,
          isMaxed
            ? 'rgba(6, 46, 38, 0.96)'
            : hovered
            ? 'rgba(20, 36, 62, 0.96)'
            : 'rgba(15, 24, 42, 0.93)',
          isMaxed ? '#10b981' : hovered ? '#ffffff' : canAfford ? cfg.color : 'rgba(148, 163, 184, 0.45)',
          isMaxed || hovered ? 2.2 : 1.5
        );

        this.traceChamferRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, 8);
        this.ctx.clip();

        // Barra superior de color del módulo
        this.ctx.fillStyle = cfg.color;
        this.ctx.fillRect(rect.x + 12, rect.y, rect.width - 24, 3);

        const lName = i18n.currentLang === 'EN' ? cfg.nameEn : cfg.name;
        const lSub = i18n.currentLang === 'EN' ? cfg.subtitleEn : cfg.subtitle;
        const lDesc = i18n.currentLang === 'EN' ? cfg.descEn : cfg.desc;
        const lStat = i18n.currentLang === 'EN' ? cfg.statPerLevelEn : cfg.statPerLevel;

        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold 12px ${FONT_DISPLAY}`;
        this.ctx.fillText(`[${i + 1}] ${lName}`, rect.x + 12, rect.y + 23, rect.width - 24);

        this.ctx.fillStyle = cfg.color;
        this.ctx.font = `bold 9.5px ${FONT_MONO}`;
        this.ctx.fillText(lSub, rect.x + 12, rect.y + 38, rect.width - 24);

        // Rombos de nivel permanente
        for (let p = 0; p < cfg.maxLevel; p++) {
          const pxPip = rect.x + 16 + p * 14;
          const pyPip = rect.y + 52;
          const r = 3.6;
          this.ctx.beginPath();
          this.ctx.moveTo(pxPip, pyPip - r);
          this.ctx.lineTo(pxPip + r, pyPip);
          this.ctx.lineTo(pxPip, pyPip + r);
          this.ctx.lineTo(pxPip - r, pyPip);
          this.ctx.closePath();
          if (p < lvl) {
            this.ctx.fillStyle = cfg.color;
            this.ctx.fill();
          } else {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
            this.ctx.lineWidth = 1.2;
            this.ctx.stroke();
          }
        }

        this.ctx.textAlign = 'right';
        this.ctx.fillStyle = '#e2e8f0';
        this.ctx.font = `bold 10px ${FONT_MONO}`;
        this.ctx.fillText(`NV ${lvl}/${cfg.maxLevel}`, rect.x + rect.width - 12, rect.y + 55);

        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#cbd5e1';
        this.ctx.font = `10.8px ${FONT_DISPLAY}`;
        this.wrapText(lDesc, rect.x + 12, rect.y + 72, rect.width - 24, 13.5, 2);

        this.ctx.fillStyle = '#a3e635';
        this.ctx.font = `bold 10px ${FONT_MONO}`;
        this.ctx.fillText(`▲ ${lStat}`, rect.x + 12, rect.y + 114, rect.width - 24);

        this.ctx.font = `bold 10.5px ${FONT_MONO}`;
        if (isMaxed) {
          this.ctx.fillStyle = '#10b981';
          this.ctx.fillText(
            i18n.t('[★] NIVEL MÁXIMO', '[★] MAX LEVEL'),
            rect.x + 12,
            rect.y + rect.height - 11
          );
        } else {
          this.ctx.fillStyle = canAfford ? '#fbbf24' : '#f43f5e';
          this.ctx.fillText(
            i18n.t(
              `▸ [${i + 1}] MEJORAR (${nextCost} CR)`,
              `▸ [${i + 1}] UPGRADE (${nextCost} CR)`
            ),
            rect.x + 12,
            rect.y + rect.height - 11
          );
        }
        this.ctx.restore();
      }
    } else if (this.activeMenuTab === 'GACHA') {
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = `bold 12px ${FONT_MONO}`;
      this.ctx.fillText(
        i18n.t(
          'DROP: Común 40% | Rara 30% | Épica 20% | Legendaria 9% | Mítica 1%  (Duplicado: +10 CR)',
          'ODDS: Common 40% | Rare 30% | Epic 20% | Legendary 9% | Mythic 1%  (Duplicate: +10 CR)'
        ),
        leftCx,
        py + 166
      );

      for (const pullBtn of this.getGachaPullButtonRects()) {
        const canAfford = this.metaSystem.coins >= pullBtn.cost;
        const isTen = pullBtn.count === 10;
        const strokeCol = canAfford ? (isTen ? '#fbbf24' : '#c084fc') : '#f43f5e';
        this.drawCyberPanel(
          pullBtn.x,
          pullBtn.y,
          pullBtn.width,
          pullBtn.height,
          10,
          canAfford
            ? isTen
              ? 'rgba(69, 36, 8, 0.95)'
              : 'rgba(46, 20, 82, 0.95)'
            : 'rgba(34, 14, 24, 0.92)',
          strokeCol,
          2.0,
          strokeCol,
          8
        );

        this.ctx.fillStyle = canAfford ? '#f8fafc' : '#fca5a5';
        this.ctx.font = `bold 14.5px ${FONT_DISPLAY}`;
        this.ctx.fillText(pullBtn.label, pullBtn.x + pullBtn.width / 2, pullBtn.y + 28);
      }

      if (this.lastGachaResults.length === 1) {
        const entry = this.lastGachaResults[0];
        const rConf = RARITY_CONFIG[entry.hat.rarity];
        const revealBoxW = 580;
        const revealBoxH = 210;
        const rx = leftCx - revealBoxW / 2;
        const ry = py + 260;
        const pulseScale = 1 + Math.sin(this.gachaRevealTimer * 14) * 0.02;

        this.ctx.save();
        this.ctx.translate(leftCx, ry + revealBoxH / 2);
        this.ctx.scale(pulseScale, pulseScale);
        this.ctx.translate(-leftCx, -(ry + revealBoxH / 2));

        this.drawCyberPanel(
          rx,
          ry,
          revealBoxW,
          revealBoxH,
          14,
          rConf.bgColor,
          rConf.color,
          2.5,
          rConf.color,
          this.gachaRevealTimer > 0 ? 22 : 10
        );

        this.ctx.fillStyle = rConf.color;
        this.ctx.font = `bold 13px ${FONT_MONO}`;
        this.ctx.fillText(`${i18n.t('RAREZA', 'RARITY')} // ${rConf.label}`, leftCx, ry + 30);

        HatRenderer.drawHatIcon(this.ctx, entry.hat.id, leftCx, ry + 78, 46, now);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold 19px ${FONT_DISPLAY}`;
        this.ctx.fillText(entry.hat.name, leftCx, ry + 130);

        this.ctx.fillStyle = entry.isNew ? '#10b981' : '#fbbf24';
        this.ctx.font = `bold 13.5px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          entry.isNew
            ? i18n.t('¡NUEVO ACCESORIO DESBLOQUEADO!', 'NEW GEAR MODULE UNLOCKED!')
            : i18n.t('Repetido: +10 CR reembolsados', 'Duplicate: +10 CR refunded'),
          leftCx,
          ry + 158
        );

        this.ctx.fillStyle = '#a3e635';
        this.ctx.font = `bold 13px ${FONT_MONO}`;
        this.ctx.fillText(`[ ${entry.hat.statsLabel} ]`, leftCx, ry + 186);
        this.ctx.restore();
      } else if (this.lastGachaResults.length > 1) {
        const cols = 5;
        const cardW = 142;
        const cardH = 114;
        const gapX = 10;
        const gapY = 10;
        const totalW = cols * cardW + (cols - 1) * gapX;
        const startX = leftCx - totalW / 2;
        const startY = py + 252;

        for (let i = 0; i < this.lastGachaResults.length; i++) {
          const entry = this.lastGachaResults[i];
          const rConf = RARITY_CONFIG[entry.hat.rarity];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = startX + col * (cardW + gapX);
          const y = startY + row * (cardH + gapY);

          this.ctx.save();
          this.drawCyberPanel(x, y, cardW, cardH, 9, rConf.bgColor, rConf.color, 1.6);
          this.traceChamferRect(x + 2, y + 2, cardW - 4, cardH - 4, 7);
          this.ctx.clip();

          HatRenderer.drawHatIcon(this.ctx, entry.hat.id, x + cardW / 2, y + 28, 28, now);

          this.ctx.textAlign = 'center';
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = `bold 10.5px ${FONT_DISPLAY}`;
          const shortName =
            entry.hat.name.length > 18 ? entry.hat.name.slice(0, 17) + '…' : entry.hat.name;
          this.ctx.fillText(shortName, x + cardW / 2, y + 56);

          this.ctx.fillStyle = rConf.color;
          this.ctx.font = `bold 9.5px ${FONT_MONO}`;
          this.ctx.fillText(rConf.label.split(' ')[0], x + cardW / 2, y + 72);

          this.ctx.fillStyle = entry.isNew ? '#10b981' : '#fbbf24';
          this.ctx.font = `bold 9.5px ${FONT_DISPLAY}`;
          this.ctx.fillText(
            entry.isNew ? i18n.t('¡NUEVO!', 'NEW!') : '+10 CR',
            x + cardW / 2,
            y + 90
          );

          this.ctx.fillStyle = '#cbd5e1';
          this.ctx.font = `9px ${FONT_MONO}`;
          const shortStats =
            entry.hat.statsLabel.length > 20
              ? entry.hat.statsLabel.slice(0, 19) + '…'
              : entry.hat.statsLabel;
          this.ctx.fillText(shortStats, x + cardW / 2, y + 104);
          this.ctx.restore();
        }
      } else {
        const revealBoxW = 620;
        const revealBoxH = 200;
        const rx = leftCx - revealBoxW / 2;
        const ry = py + 260;

        this.drawCyberPanel(
          rx,
          ry,
          revealBoxW,
          revealBoxH,
          14,
          'rgba(15, 25, 44, 0.94)',
          'rgba(56, 189, 248, 0.45)',
          1.6
        );

        this.ctx.fillStyle = '#38bdf8';
        this.ctx.font = `bold 15px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          i18n.t('BÓVEDA DE EQUIPAMIENTO // COFRES CUÁNTICOS', 'EQUIPMENT VAULT // QUANTUM CHESTS'),
          leftCx,
          ry + 42
        );

        this.ctx.fillStyle = '#e2e8f0';
        this.ctx.font = `13.5px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          i18n.t(
            'Pulsa "Compilar Cofre (20 CR)" o "Lote x10 (200 CR)" para fabricar piezas.',
            'Choose "Open Chest (20 CR)" or "Batch x10 (200 CR)" to fabricate gear.'
          ),
          leftCx,
          ry + 84
        );

        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = `12.5px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          i18n.t(
            'Cada sombrero se acopla sobre el chasis y otorga bonificaciones permanentes.',
            'Every headgear piece mounts directly onto your bot with permanent buffs.'
          ),
          leftCx,
          ry + 114
        );

        this.ctx.fillStyle = '#fbbf24';
        this.ctx.font = `bold 12.5px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          i18n.t(
            'Los módulos repetidos devuelven +10 CR automáticamente.',
            'Duplicate modules automatically refund +10 CR.'
          ),
          leftCx,
          ry + 152
        );
      }
    } else if (this.activeMenuTab === 'INVENTORY') {
      const unlockedList = this.metaSystem.getUnlockedHatsList();
      if (unlockedList.length === 0) {
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = `15px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          i18n.t(
            'Tu inventario está vacío. Abre cofres en [G] Bóveda Gacha.',
            'Your inventory is empty. Open chests in [G] Gacha Vault.'
          ),
          leftCx,
          py + 310
        );
      } else {
        const hatSlots = this.getInventoryHatRects();
        for (const slot of hatSlots) {
          const rConf = RARITY_CONFIG[slot.hat.rarity];
          const isEquipped = this.metaSystem.equippedHatId === slot.hat.id;
          const isHovered = this.hoveredHatId === slot.hat.id;

          this.ctx.save();
          this.drawCyberPanel(
            slot.x,
            slot.y,
            slot.width,
            slot.height,
            10,
            isEquipped ? 'rgba(6, 52, 42, 0.96)' : 'rgba(15, 24, 42, 0.95)',
            isEquipped ? '#10b981' : isHovered ? '#ffffff' : rConf.color,
            isEquipped || isHovered ? 2.2 : 1.5
          );

          this.traceChamferRect(slot.x + 2, slot.y + 2, slot.width - 4, slot.height - 4, 8);
          this.ctx.clip();

          // Caja pequeña para el icono vectorial del sombrero
          this.ctx.fillStyle = 'rgba(8, 14, 26, 0.85)';
          this.ctx.fillRect(slot.x + 8, slot.y + 10, 44, 44);
          this.ctx.strokeStyle = rConf.color;
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(slot.x + 8, slot.y + 10, 44, 44);

          HatRenderer.drawHatIcon(this.ctx, slot.hat.id, slot.x + 30, slot.y + 32, 26, now);

          this.ctx.textAlign = 'left';
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = `bold 12px ${FONT_DISPLAY}`;
          const shortName =
            slot.hat.name.length > 20 ? slot.hat.name.slice(0, 19) + '…' : slot.hat.name;
          this.ctx.fillText(shortName, slot.x + 60, slot.y + 24);

          this.ctx.fillStyle = isEquipped ? '#10b981' : rConf.color;
          this.ctx.font = `bold 10px ${FONT_MONO}`;
          this.ctx.fillText(
            isEquipped ? i18n.t('[✓] EQUIPADO', '[✓] EQUIPPED') : rConf.label.split(' ')[0],
            slot.x + 60,
            slot.y + 41
          );

          this.ctx.fillStyle = '#a3e635';
          let statFont = 11;
          const maxStatW = slot.width - 20;
          this.ctx.font = `bold ${statFont}px ${FONT_MONO}`;
          const statMetrics = this.ctx.measureText(slot.hat.statsLabel).width;
          if (statMetrics > maxStatW) {
            statFont = Math.max(9, Math.floor(11 * (maxStatW / statMetrics)));
            this.ctx.font = `bold ${statFont}px ${FONT_MONO}`;
          }
          this.ctx.fillText(slot.hat.statsLabel, slot.x + 10, slot.y + 70);
          this.ctx.restore();
        }

        const totalPages = Math.max(1, Math.ceil(unlockedList.length / 9));
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#cbd5e1';
        this.ctx.font = `bold 12px ${FONT_MONO}`;
        this.ctx.fillText(
          `${i18n.t('PÁG', 'PAGE')} ${this.inventoryPage + 1}/${totalPages}`,
          leftCx,
          py + 471
        );

        for (const pageBtn of this.getInventoryPaginationRects()) {
          this.drawCyberPanel(
            pageBtn.x,
            pageBtn.y,
            pageBtn.width,
            pageBtn.height,
            7,
            'rgba(15, 25, 44, 0.95)',
            '#38bdf8',
            1.5
          );

          this.ctx.fillStyle = '#38bdf8';
          this.ctx.font = `bold 12px ${FONT_DISPLAY}`;
          this.ctx.fillText(pageBtn.label, pageBtn.x + pageBtn.width / 2, pageBtn.y + 18);
        }
      }
    }

    // Selector de Modo de Juego ([B]: CLÁSICO vs PESADILLA 15 CR)
    for (const mBtn of this.getGameModeButtonRects()) {
      const isNight = mBtn.mode === 'NIGHTMARE';
      const isSelected = this.selectedGameMode === mBtn.mode;
      const isHov = this.hoveredModeBtn === mBtn.mode;
      const canPay = !isNight || this.metaSystem.coins >= NIGHTMARE_ENTRY_COST;
      const strokeCol = isNight
        ? isSelected
          ? canPay
            ? '#f43f5e'
            : '#fb7185'
          : 'rgba(244, 63, 94, 0.4)'
        : isSelected
        ? '#38bdf8'
        : 'rgba(56, 189, 248, 0.4)';

      this.drawClippedButton(
        mBtn,
        isSelected
          ? isNight
            ? 'rgba(88, 18, 32, 0.96)'
            : 'rgba(14, 52, 82, 0.96)'
          : isHov
          ? 'rgba(22, 34, 56, 0.95)'
          : 'rgba(13, 20, 36, 0.92)',
        isHov ? '#ffffff' : strokeCol,
        isSelected ? 2.1 : 1.3,
        isSelected ? '#ffffff' : isNight ? '#fda4af' : '#94a3b8',
        11.5,
        isNight
          ? i18n.t(
              `💀 MODO PESADILLA (${NIGHTMARE_ENTRY_COST} CR) • MAPA INFINITO + x2 CR`,
              `💀 NIGHTMARE MODE (${NIGHTMARE_ENTRY_COST} CR) • INFINITE MAP + 2x CR`
            )
          : i18n.t('🛡️ MODO CLÁSICO (GRATIS) • ARENA ESTÁNDAR', '🛡️ CLASSIC MODE (FREE) • STANDARD ARENA'),
        isSelected ? strokeCol : undefined,
        isSelected ? 8 : 0
      );
    }

    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#38bdf8';
    let feedbackFont = 12;
    const maxFeedbackW = 740;
    this.ctx.font = `bold ${feedbackFont}px ${FONT_DISPLAY}`;
    const fbMetrics = this.ctx.measureText(this.menuFeedbackMessage).width;
    if (fbMetrics > maxFeedbackW) {
      feedbackFont = Math.max(9.5, Math.floor(12 * (maxFeedbackW / fbMetrics)));
      this.ctx.font = `bold ${feedbackFont}px ${FONT_DISPLAY}`;
    }
    this.ctx.fillText(this.menuFeedbackMessage, leftCx, py + 532);
    this.ctx.restore();

    const startBtn = this.getStartButtonRect();
    const isNightmareSelected = this.selectedGameMode === 'NIGHTMARE';
    const startBg = isNightmareSelected
      ? this.hoveredStartBtn
        ? 'rgba(127, 29, 29, 0.98)'
        : 'rgba(88, 16, 28, 0.95)'
      : this.hoveredStartBtn
      ? 'rgba(6, 78, 59, 0.98)'
      : 'rgba(6, 48, 42, 0.95)';
    const startStroke = isNightmareSelected ? '#f43f5e' : '#10b981';
    this.ctx.save();
    this.drawCyberPanel(
      startBtn.x,
      startBtn.y,
      startBtn.width,
      startBtn.height,
      12,
      startBg,
      this.hoveredStartBtn ? '#ffffff' : startStroke,
      this.hoveredStartBtn ? 2.4 : 2.0,
      startStroke,
      this.hoveredStartBtn ? 16 : 8 + Math.sin(now * 0.006) * 4
    );

    this.traceChamferRect(startBtn.x + 2, startBtn.y + 2, startBtn.width - 4, startBtn.height - 4, 10);
    this.ctx.clip();

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = this.hoveredStartBtn ? '#ffffff' : isNightmareSelected ? '#fecdd3' : '#a7f3d0';
    let startFont = 14.5;
    const maxStartW = startBtn.width - 24;
    const startText = isNightmareSelected
      ? `▸ ${i18n.t(`DESPLEGAR PESADILLA (-${NIGHTMARE_ENTRY_COST} CR)`, `DEPLOY NIGHTMARE (-${NIGHTMARE_ENTRY_COST} CR)`)}`
      : `▸ ${i18n.t('JUGAR EN SOLITARIO [ENTER]', 'PLAY SOLO [ENTER]')}`;
    this.ctx.font = `bold ${startFont}px ${FONT_DISPLAY}`;
    const stMetrics = this.ctx.measureText(startText).width;
    if (stMetrics > maxStartW) {
      startFont = Math.max(10.5, Math.floor(14.5 * (maxStartW / stMetrics)));
      this.ctx.font = `bold ${startFont}px ${FONT_DISPLAY}`;
    }
    this.ctx.fillText(startText, startBtn.x + startBtn.width / 2, startBtn.y + 31);
    this.ctx.restore();

    // Botón destacado de CO-OP ONLINE 4P al lado de JUGAR SOLO
    const coopBtn = this.getCoopOnlineButtonRect();
    const inRoom = this.mpClient.isInRoom;
    const coopStroke = inRoom ? '#10b981' : '#00f0ff';
    const coopLabel = inRoom
      ? `🌐 ${i18n.t('SALA', 'ROOM')} #${this.mpClient.room!.code} (${this.mpClient.room!.players.length}/4) [K]`
      : `🌐 ${i18n.t('CO-OP ONLINE 4P [K]', 'ONLINE CO-OP 4P [K]')}`;
    this.ctx.save();
    this.drawCyberPanel(
      coopBtn.x,
      coopBtn.y,
      coopBtn.width,
      coopBtn.height,
      12,
      inRoom
        ? 'rgba(6, 78, 59, 0.96)'
        : this.hoveredCoopBtn
        ? 'rgba(12, 72, 98, 0.98)'
        : 'rgba(10, 34, 62, 0.96)',
      this.hoveredCoopBtn ? '#ffffff' : coopStroke,
      this.hoveredCoopBtn ? 2.4 : 2.0,
      coopStroke,
      this.hoveredCoopBtn ? 16 : 7 + Math.cos(now * 0.005) * 3
    );
    this.traceChamferRect(coopBtn.x + 2, coopBtn.y + 2, coopBtn.width - 4, coopBtn.height - 4, 10);
    this.ctx.clip();
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = this.hoveredCoopBtn ? '#ffffff' : inRoom ? '#a7f3d0' : '#a5f3fc';
    let coopFont = 14;
    const maxCoopW = coopBtn.width - 20;
    this.ctx.font = `bold ${coopFont}px ${FONT_DISPLAY}`;
    const cMetrics = this.ctx.measureText(coopLabel).width;
    if (cMetrics > maxCoopW) {
      coopFont = Math.max(10.5, Math.floor(14 * (maxCoopW / cMetrics)));
      this.ctx.font = `bold ${coopFont}px ${FONT_DISPLAY}`;
    }
    this.ctx.fillText(coopLabel, coopBtn.x + coopBtn.width / 2, coopBtn.y + 31);
    this.ctx.restore();

    if (this.showCoopModal) {
      CoopLobbyUI.draw(
        this.ctx,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
        this.mpClient,
        this.metaSystem,
        this.hoveredCoopAction,
        this.coopFeedbackMsg
      );
    } else if (this.showLeaderboardOverlay) {
      this.drawLeaderboardOverlay();
    } else if (this.showDailyMissionsOverlay) {
      this.drawDailyMissionsOverlay();
    } else if (this.showAchievementsOverlay) {
      this.drawAchievementsOverlay();
    } else if (this.showHelpOverlay) {
      this.drawHelpOverlay();
    } else if (this.showSettingsOverlay) {
      this.drawSettingsOverlay();
    }

    this.ctx.restore();
  }

  private drawLeaderboardOverlay(): void {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 9, 18, 0.9)';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const panelW = Math.min(720, LOGICAL_WIDTH - 32);
    const panelH = 576;
    const px = cx - panelW / 2;
    const py = cy - 290;

    this.drawCyberPanel(
      px,
      py,
      panelW,
      panelH,
      14,
      'rgba(11, 19, 34, 0.98)',
      '#fbbf24',
      2.2,
      '#fbbf24',
      18
    );

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#fde047';
    this.ctx.font = `bold 23px ${FONT_DISPLAY}`;
    this.ctx.fillText('GLOBAL RANKINGS // TOP 10 SURVIVORS', cx, py + 38);

    // Tabs: Top Damage to Toro | Best Survival Time
    for (const tabBtn of this.getLeaderboardTabRects()) {
      const isSelected = this.activeLeaderboardCategory === tabBtn.category;
      const isHovered = this.hoveredLeaderboardTab === tabBtn.category;

      this.drawCyberPanel(
        tabBtn.x,
        tabBtn.y,
        tabBtn.width,
        tabBtn.height,
        8,
        isSelected
          ? tabBtn.category === 'TORO_DAMAGE'
            ? 'rgba(88, 18, 28, 0.95)'
            : 'rgba(14, 52, 82, 0.95)'
          : isHovered
          ? 'rgba(20, 36, 58, 0.94)'
          : 'rgba(15, 24, 42, 0.92)',
        isSelected
          ? tabBtn.category === 'TORO_DAMAGE'
            ? '#f43f5e'
            : '#38bdf8'
          : isHovered
          ? '#fde047'
          : 'rgba(100, 116, 139, 0.5)',
        isSelected || isHovered ? 2.0 : 1.4
      );

      this.ctx.fillStyle = isSelected ? '#ffffff' : '#cbd5e1';
      this.ctx.font = `bold 13px ${FONT_DISPLAY}`;
      this.ctx.fillText(tabBtn.label, tabBtn.x + tabBtn.width / 2, tabBtn.y + 23);
    }

    const tableX = cx - 318;
    const tableW = 636;
    const headerY = py + 112;

    this.ctx.fillStyle = 'rgba(15, 28, 48, 0.96)';
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    this.ctx.lineWidth = 1.4;
    this.ctx.fillRect(tableX, headerY, tableW, 30);
    this.ctx.strokeRect(tableX, headerY, tableW, 30);

    this.ctx.font = `bold 12px ${FONT_MONO}`;
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('RANK', tableX + 18, headerY + 20);
    this.ctx.fillText('DISPLAY NAME', tableX + 115, headerY + 20);
    this.ctx.textAlign = 'right';
    this.ctx.fillText(
      this.activeLeaderboardCategory === 'TORO_DAMAGE'
        ? 'MAX DAMAGE TO TORO'
        : 'BEST SURVIVAL TIME',
      tableX + tableW - 18,
      headerY + 20
    );

    const entries =
      this.activeLeaderboardCategory === 'TORO_DAMAGE'
        ? this.toroDamageLeaderboard
        : this.survivalTimeLeaderboard;

    if (this.leaderboardLoading) {
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#fde047';
      this.ctx.font = `bold 15px ${FONT_MONO}`;
      this.ctx.fillText('Sincronizando Clasificación Global desde Firestore...', cx, py + 290);
    } else if (entries.length === 0) {
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = `15px ${FONT_DISPLAY}`;
      this.ctx.fillText('Aún no hay registros en esta categoría.', cx, py + 290);
    } else {
      const rowH = 34;
      const startRowY = headerY + 36;

      for (let i = 0; i < Math.min(10, entries.length); i++) {
        const entry = entries[i];
        const rowY = startRowY + i * rowH;
        const isCurrentUser = Boolean(this.currentUser && this.currentUser.uid === entry.uid);

        this.ctx.save();
        this.ctx.fillStyle = isCurrentUser
          ? 'rgba(6, 62, 48, 0.92)'
          : i % 2 === 0
          ? 'rgba(13, 22, 38, 0.9)'
          : 'rgba(17, 29, 49, 0.9)';
        this.ctx.strokeStyle = isCurrentUser ? '#10b981' : 'rgba(56, 189, 248, 0.22)';
        this.ctx.lineWidth = isCurrentUser ? 1.8 : 1;
        this.ctx.fillRect(tableX, rowY, tableW, rowH - 3);
        this.ctx.strokeRect(tableX, rowY, tableW, rowH - 3);

        this.ctx.beginPath();
        this.ctx.rect(tableX + 2, rowY, tableW - 4, rowH - 3);
        this.ctx.clip();

        const rankColor =
          i === 0 ? '#fbbf24' : i === 1 ? '#e2e8f0' : i === 2 ? '#f97316' : '#94a3b8';
        const rankBadge = `#${i + 1}`;

        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = rankColor;
        this.ctx.font = `bold 13px ${FONT_MONO}`;
        this.ctx.fillText(rankBadge, tableX + 18, rowY + 21);

        this.ctx.fillStyle = isCurrentUser ? '#10b981' : '#f8fafc';
        this.ctx.font = isCurrentUser ? `bold 14px ${FONT_DISPLAY}` : `14px ${FONT_DISPLAY}`;
        const rawName = entry.displayName || 'Survivor';
        const shownName = rawName.length > 24 ? rawName.slice(0, 23) + '…' : rawName;
        this.ctx.fillText(
          isCurrentUser ? `${shownName} (TÚ)` : shownName,
          tableX + 115,
          rowY + 21
        );

        this.ctx.textAlign = 'right';
        if (this.activeLeaderboardCategory === 'TORO_DAMAGE') {
          this.ctx.fillStyle = '#fb7185';
          this.ctx.font = `bold 13.5px ${FONT_MONO}`;
          this.ctx.fillText(
            `${entry.maxDamageToToro.toLocaleString('en-US')} DMG`,
            tableX + tableW - 18,
            rowY + 21
          );
        } else {
          this.ctx.fillStyle = '#38bdf8';
          this.ctx.font = `bold 13.5px ${FONT_MONO}`;
          this.ctx.fillText(
            `${this.formatTimeMMSS(entry.bestTimeSeconds)} (${entry.bestTimeSeconds}s)`,
            tableX + tableW - 18,
            rowY + 21
          );
        }
        this.ctx.restore();
      }
    }

    const backBtn = this.getLeaderboardBackButtonRect();
    this.drawClippedButton(
      backBtn,
      this.hoveredLeaderboardBackBtn ? 'rgba(6, 78, 59, 0.96)' : 'rgba(15, 25, 44, 0.95)',
      this.hoveredLeaderboardBackBtn ? '#ffffff' : '#10b981',
      this.hoveredLeaderboardBackBtn ? 2.4 : 1.8,
      this.hoveredLeaderboardBackBtn ? '#ffffff' : '#a7f3d0',
      13.5,
      `[ESC / CLICK] ${i18n.t('VOLVER AL HANGAR', 'RETURN TO HANGAR')}`
    );

    this.ctx.restore();
  }

  private getOverlayBackButtonRect(
    panelY: number,
    panelH: number
  ): { x: number; y: number; width: number; height: number } {
    const cx = LOGICAL_WIDTH / 2;
    const width = 280;
    const height = 38;
    return {
      x: cx - width / 2,
      y: panelY + panelH - 52,
      width,
      height,
    };
  }

  private handleSettingsClick(mx: number, my: number): boolean {
    for (const ctrl of this.getSettingsControlRects()) {
      if (
        mx >= ctrl.x &&
        mx <= ctrl.x + ctrl.width &&
        my >= ctrl.y &&
        my <= ctrl.y + ctrl.height
      ) {
        if (ctrl.id === 'MASTER_DOWN') {
          this.sound.masterVolume = Math.max(0, Number((this.sound.masterVolume - 0.1).toFixed(1)));
          this.sound.saveSettings();
          this.sound.playShoot(false);
        } else if (ctrl.id === 'MASTER_UP') {
          this.sound.masterVolume = Math.min(1.0, Number((this.sound.masterVolume + 0.1).toFixed(1)));
          this.sound.saveSettings();
          this.sound.playShoot(false);
        } else if (ctrl.id === 'MUSIC_DOWN') {
          this.sound.musicVolume = Math.max(0, Number((this.sound.musicVolume - 0.1).toFixed(1)));
          this.sound.saveSettings();
          this.sound.playShoot(false);
        } else if (ctrl.id === 'MUSIC_UP') {
          this.sound.musicVolume = Math.min(1.0, Number((this.sound.musicVolume + 0.1).toFixed(1)));
          this.sound.saveSettings();
          this.sound.playShoot(false);
        } else if (ctrl.id === 'SFX_DOWN') {
          this.sound.sfxVolume = Math.max(0, Number((this.sound.sfxVolume - 0.1).toFixed(1)));
          this.sound.saveSettings();
          this.sound.playShoot(false);
        } else if (ctrl.id === 'SFX_UP') {
          this.sound.sfxVolume = Math.min(1.0, Number((this.sound.sfxVolume + 0.1).toFixed(1)));
          this.sound.saveSettings();
          this.sound.playShoot(false);
        } else if (ctrl.id === 'TOGGLE_MUTE') {
          this.sound.muted = !this.sound.muted;
          this.sound.saveSettings();
          this.sound.playShoot(false);
        } else if (ctrl.id === 'TOGGLE_SHAKE') {
          this.sound.screenShakeEnabled = !this.sound.screenShakeEnabled;
          this.sound.saveSettings();
          this.sound.playShoot(false);
        } else if (ctrl.id === 'LANG_ES') {
          i18n.setLanguage('ES');
          this.sound.playShoot(false);
        } else if (ctrl.id === 'LANG_EN') {
          i18n.setLanguage('EN');
          this.sound.playShoot(false);
        } else if (ctrl.id === 'TOGGLE_LIGHT_GFX') {
          this.toggleLightGraphics();
          this.sound.playShoot(false);
        } else if (ctrl.id === 'OPEN_HELP') {
          this.showHelpOverlay = true;
          this.sound.playShoot(false);
        } else if (ctrl.id === 'BACK') {
          this.showSettingsOverlay = false;
          this.sound.playShoot(false);
        }
        return true;
      }
    }
    return false;
  }

  private getAchievementsTabRects(py: number): {
    page: number;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const cx = LOGICAL_WIDTH / 2;
    const tabW = 420;
    const tabH = 34;
    const gap = 20;
    const startX = cx - tabW - gap / 2;
    const y = py + 72;
    const p1Unlocked = this.achievementSystem.getPageUnlockedCount(0, 12);
    const p2Unlocked = this.achievementSystem.getPageUnlockedCount(1, 12);

    return [
      {
        page: 0,
        label: `[1] ${i18n.t('FASE I // PROTOCOLOS (1-12)', 'PHASE I // PROTOCOLS (1-12)')} [${p1Unlocked}/12]`,
        x: startX,
        y,
        width: tabW,
        height: tabH,
      },
      {
        page: 1,
        label: `[2] ${i18n.t('FASE II // DESAFÍOS ÉPICOS (13-24)', 'PHASE II // EPIC CHALLENGES (13-24)')} [${p2Unlocked}/12]`,
        x: startX + tabW + gap,
        y,
        width: tabW,
        height: tabH,
      },
    ];
  }

  private drawAchievementsOverlay(): void {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 9, 18, 0.9)';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const panelW = 920;
    const panelH = 650;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2;

    this.drawCyberPanel(
      px,
      py,
      panelW,
      panelH,
      14,
      'rgba(11, 19, 34, 0.98)',
      '#10b981',
      2.2,
      '#10b981',
      18
    );

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = `bold 23px ${FONT_DISPLAY}`;
    this.ctx.fillText(
      `${i18n.t('PROTOCOLO DE HITOS // LOGROS', 'MILESTONE PROTOCOL // ACHIEVEMENTS')} (${this.achievementSystem.getUnlockedCount()}/${this.achievementSystem.achievements.length})`,
      cx,
      py + 34
    );

    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = `12px ${FONT_MONO}`;
    this.ctx.fillText(
      i18n.t(
        'Recompensas en Cripto acreditadas automáticamente al completar cada hito.',
        'Crypto rewards automatically credited upon milestone completion.'
      ),
      cx,
      py + 54
    );

    for (const tab of this.getAchievementsTabRects(py)) {
      const isActive = this.achievementsPage === tab.page;
      const isHovered = this.hoveredAchievementsTab === tab.page;

      this.drawClippedButton(
        tab,
        isActive
          ? 'rgba(14, 58, 48, 0.96)'
          : isHovered
          ? 'rgba(20, 36, 58, 0.94)'
          : 'rgba(15, 24, 42, 0.9)',
        isActive ? '#10b981' : isHovered ? '#38bdf8' : 'rgba(71, 85, 105, 0.6)',
        isActive ? 2.2 : 1.2,
        isActive ? '#a7f3d0' : isHovered ? '#ffffff' : '#94a3b8',
        12,
        tab.label,
        isActive ? '#10b981' : undefined,
        isActive ? 8 : undefined
      );
    }

    const cardW = 420;
    const cardH = 70;
    const startY = py + 114;
    const col1X = cx - cardW - 10;
    const col2X = cx + 10;

    const pageList = this.achievementSystem.getPageAchievements(this.achievementsPage, 12);
    for (let i = 0; i < pageList.length; i++) {
      const ach = pageList[i];
      const col = i % 2 === 0 ? col1X : col2X;
      const row = Math.floor(i / 2);
      const cardY = startY + row * (cardH + 10);

      this.ctx.save();
      this.drawCyberPanel(
        col,
        cardY,
        cardW,
        cardH,
        8,
        ach.unlocked ? 'rgba(6, 52, 42, 0.92)' : 'rgba(15, 24, 42, 0.92)',
        ach.unlocked ? '#10b981' : 'rgba(71, 85, 105, 0.45)',
        ach.unlocked ? 1.8 : 1
      );

      this.traceChamferRect(col + 2, cardY + 2, cardW - 4, cardH - 4, 6);
      this.ctx.clip();

      // Insignia geométrica de estado en lugar de emoji del sistema
      const badgeCx = col + 24;
      const badgeCy = cardY + cardH / 2;
      this.ctx.fillStyle = ach.unlocked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.12)';
      this.ctx.strokeStyle = ach.unlocked ? '#10b981' : '#38bdf8';
      this.ctx.lineWidth = 1.4;
      this.ctx.beginPath();
      this.ctx.moveTo(badgeCx, badgeCy - 12);
      this.ctx.lineTo(badgeCx + 12, badgeCy);
      this.ctx.lineTo(badgeCx, badgeCy + 12);
      this.ctx.lineTo(badgeCx - 12, badgeCy);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = ach.unlocked ? '#6ee7b7' : '#7dd3fc';
      this.ctx.font = `bold 11px ${FONT_MONO}`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(ach.unlocked ? '✓' : '◈', badgeCx, badgeCy + 0.5);

      this.ctx.textBaseline = 'alphabetic';
      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = ach.unlocked ? '#6ee7b7' : '#fbbf24';
      this.ctx.font = `bold 11.5px ${FONT_MONO}`;
      const rewardText = `+${ach.rewardCoins} CR`;
      this.ctx.fillText(rewardText, col + cardW - 12, cardY + 20);
      const rewardW = this.ctx.measureText(rewardText).width;

      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = ach.unlocked ? '#ecfdf5' : '#f1f5f9';
      const title = i18n.currentLang === 'EN' ? ach.titleEn : ach.title;
      const maxTitleW = cardW - 48 - rewardW - 14;
      let titleFontSize = 13;
      this.ctx.font = `bold ${titleFontSize}px ${FONT_DISPLAY}`;
      const titleMetrics = this.ctx.measureText(title).width;
      if (titleMetrics > maxTitleW) {
        titleFontSize = Math.max(10, Math.floor(13 * (maxTitleW / titleMetrics)));
        this.ctx.font = `bold ${titleFontSize}px ${FONT_DISPLAY}`;
      }
      this.ctx.fillText(title, col + 46, cardY + 20);

      this.ctx.fillStyle = '#94a3b8';
      const desc = i18n.currentLang === 'EN' ? ach.descriptionEn : ach.description;
      const maxDescW = cardW - 58;
      let descFontSize = 11.5;
      this.ctx.font = `${descFontSize}px ${FONT_DISPLAY}`;
      let descMetrics = this.ctx.measureText(desc).width;
      if (descMetrics > maxDescW) {
        descFontSize = Math.max(9.5, Math.floor(11.5 * (maxDescW / descMetrics)));
        this.ctx.font = `${descFontSize}px ${FONT_DISPLAY}`;
        descMetrics = this.ctx.measureText(desc).width;
      }
      if (descMetrics > maxDescW) {
        let trimmed = desc;
        while (trimmed.length > 3 && this.ctx.measureText(trimmed + '…').width > maxDescW) {
          trimmed = trimmed.slice(0, -1);
        }
        this.ctx.fillText(trimmed + '…', col + 46, cardY + 38);
      } else {
        this.ctx.fillText(desc, col + 46, cardY + 38);
      }

      const progressRatio = Math.min(1, ach.current / ach.target);
      const barX = col + 46;
      const barY = cardY + 48;
      const barW = cardW - 146;
      const barH = 7;

      this.ctx.fillStyle = 'rgba(8, 14, 26, 0.9)';
      this.ctx.fillRect(barX, barY, barW, barH);
      this.ctx.fillStyle = ach.unlocked ? '#10b981' : '#38bdf8';
      this.ctx.fillRect(barX, barY, barW * progressRatio, barH);

      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = ach.unlocked ? '#6ee7b7' : '#38bdf8';
      this.ctx.font = `bold 10px ${FONT_MONO}`;
      const progressText = ach.unlocked
        ? i18n.t('COMPLETO', 'COMPLETED')
        : `${Math.floor(ach.current)}/${ach.target}`;
      this.ctx.fillText(progressText, col + cardW - 12, cardY + 55);

      this.ctx.restore();
    }

    const backBtn = this.getOverlayBackButtonRect(py, panelH);
    this.drawClippedButton(
      backBtn,
      this.hoveredOverlayBackBtn ? 'rgba(6, 78, 59, 0.96)' : 'rgba(15, 25, 44, 0.95)',
      this.hoveredOverlayBackBtn ? '#ffffff' : '#10b981',
      this.hoveredOverlayBackBtn ? 2.4 : 1.8,
      this.hoveredOverlayBackBtn ? '#ffffff' : '#a7f3d0',
      13.5,
      `[ESC / CLICK] ${i18n.t('VOLVER AL HANGAR', 'RETURN TO HANGAR')}`
    );

    this.ctx.restore();
  }

  private drawSettingsOverlay(): void {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 9, 18, 0.9)';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const panelW = 660;
    const panelH = 590;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2;

    this.drawCyberPanel(
      px,
      py,
      panelW,
      panelH,
      14,
      'rgba(11, 19, 34, 0.98)',
      '#38bdf8',
      2.2,
      '#38bdf8',
      18
    );

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = `bold 23px ${FONT_DISPLAY}`;
    this.ctx.fillText(
      i18n.t('CONFIGURACIÓN DEL SISTEMA // AJUSTES', 'SYSTEM CONFIGURATION // SETTINGS'),
      cx,
      py + 40
    );

    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = `12px ${FONT_MONO}`;
    this.ctx.fillText(
      i18n.t(
        'Guardado automático local en el navegador.',
        'Automatically persisted in local storage.'
      ),
      cx,
      py + 66
    );

    const rows = [
      { label: i18n.t('VOLUMEN MAESTRO', 'MASTER VOLUME'), value: Math.round(this.sound.masterVolume * 100) },
      { label: i18n.t('MÚSICA PROCEDURAL (BGM)', 'PROCEDURAL MUSIC (BGM)'), value: Math.round(this.sound.musicVolume * 100) },
      { label: i18n.t('EFECTOS DE SONIDO (SFX)', 'SOUND EFFECTS (SFX)'), value: Math.round(this.sound.sfxVolume * 100) },
    ];

    const rowStartY = py + 104;
    const rowGap = 50;

    for (let r = 0; r < rows.length; r++) {
      const y = rowStartY + r * rowGap;
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.font = `bold 13.5px ${FONT_DISPLAY}`;
      this.ctx.fillText(rows[r].label, cx - 240, y + 21);

      this.drawCyberPanel(cx + 70, y, 44, 32, 6, 'rgba(15, 25, 44, 0.95)', '#38bdf8', 1.5);
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = `bold 18px ${FONT_MONO}`;
      this.ctx.fillText('-', cx + 92, y + 22);

      this.ctx.fillStyle = '#10b981';
      this.ctx.font = `bold 15px ${FONT_MONO}`;
      this.ctx.fillText(`${rows[r].value}%`, cx + 158, y + 21);

      this.drawCyberPanel(cx + 200, y, 44, 32, 6, 'rgba(15, 25, 44, 0.95)', '#38bdf8', 1.5);
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = `bold 18px ${FONT_MONO}`;
      this.ctx.fillText('+', cx + 222, y + 22);
    }

    const muteY = rowStartY + rowGap * 3 + 10;
    const muteActive = this.sound.muted;
    this.drawCyberPanel(
      cx - 240,
      muteY,
      230,
      38,
      8,
      muteActive ? 'rgba(88, 18, 28, 0.94)' : 'rgba(6, 52, 42, 0.94)',
      muteActive ? '#ef4444' : '#10b981',
      1.8
    );

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = muteActive ? '#fca5a5' : '#a7f3d0';
    this.ctx.font = `bold 12.5px ${FONT_DISPLAY}`;
    const muteLabel = muteActive
      ? i18n.t('MUTE: SILENCIADO', 'MUTE: MUTED')
      : i18n.t('MUTE: SONIDO ON', 'MUTE: AUDIO ON');
    this.ctx.fillText(muteLabel, cx - 125, muteY + 24);

    const shakeActive = this.sound.screenShakeEnabled;
    this.drawCyberPanel(
      cx + 10,
      muteY,
      230,
      38,
      8,
      shakeActive ? 'rgba(6, 52, 42, 0.94)' : 'rgba(20, 30, 48, 0.94)',
      shakeActive ? '#10b981' : '#64748b',
      1.8
    );

    this.ctx.fillStyle = shakeActive ? '#a7f3d0' : '#94a3b8';
    const shakeLabel = shakeActive
      ? i18n.t('AGITADO PANTALLA: ON', 'SCREEN SHAKE: ON')
      : i18n.t('AGITADO PANTALLA: OFF', 'SCREEN SHAKE: OFF');
    this.ctx.fillText(shakeLabel, cx + 125, muteY + 24);

    const langY = py + 316;
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.font = `bold 13.5px ${FONT_DISPLAY}`;
    this.ctx.fillText(i18n.t('IDIOMA / LANGUAGE:', 'LANGUAGE / IDIOMA:'), cx - 240, langY + 24);

    const isEs = i18n.currentLang === 'ES';
    this.drawCyberPanel(
      cx - 20,
      langY,
      120,
      38,
      8,
      isEs ? 'rgba(6, 62, 48, 0.95)' : 'rgba(15, 24, 42, 0.9)',
      isEs ? '#10b981' : '#334155',
      isEs ? 2.0 : 1.2,
      isEs ? '#10b981' : undefined,
      isEs ? 8 : 0
    );

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = isEs ? '#ffffff' : '#94a3b8';
    this.ctx.font = `bold 12.5px ${FONT_DISPLAY}`;
    this.ctx.fillText(isEs ? '✓ ESPAÑOL' : 'ESPAÑOL', cx + 40, langY + 24);

    const isEn = i18n.currentLang === 'EN';
    this.drawCyberPanel(
      cx + 120,
      langY,
      120,
      38,
      8,
      isEn ? 'rgba(14, 74, 110, 0.95)' : 'rgba(15, 24, 42, 0.9)',
      isEn ? '#38bdf8' : '#334155',
      isEn ? 2.0 : 1.2,
      isEn ? '#38bdf8' : undefined,
      isEn ? 8 : 0
    );

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = isEn ? '#ffffff' : '#94a3b8';
    this.ctx.font = `bold 12.5px ${FONT_DISPLAY}`;
    this.ctx.fillText(isEn ? '✓ ENGLISH' : 'ENGLISH', cx + 180, langY + 24);

    // Fila de Rendimiento (Gráficos Ligeros) y Guía (Cómo Jugar) dentro de Ajustes
    const extraY = py + 378;
    const lightOn = this.lightGraphicsEnabled;
    this.drawCyberPanel(
      cx - 240,
      extraY,
      230,
      42,
      8,
      lightOn ? 'rgba(6, 62, 42, 0.95)' : 'rgba(15, 24, 42, 0.94)',
      lightOn ? '#10b981' : '#38bdf8',
      1.8
    );
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = lightOn ? '#6ee7b7' : '#bae6fd';
    this.ctx.font = `bold 12.5px ${FONT_DISPLAY}`;
    this.ctx.fillText(
      `⚡ [V] ${lightOn ? i18n.t('GRÁF. LIGEROS: ON', 'LITE GFX: ON') : i18n.t('GRÁF. LIGEROS: OFF', 'LITE GFX: OFF')}`,
      cx - 125,
      extraY + 26
    );

    this.drawCyberPanel(
      cx + 10,
      extraY,
      230,
      42,
      8,
      'rgba(34, 20, 62, 0.95)',
      '#c084fc',
      1.8
    );
    this.ctx.fillStyle = '#e9d5ff';
    this.ctx.fillText(
      `📖 [H] ${i18n.t('CÓMO JUGAR', 'HOW TO PLAY')}`,
      cx + 125,
      extraY + 26
    );

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = `11px ${FONT_MONO}`;
    this.ctx.fillText(
      i18n.t(
        'Gráficos ligeros reduce brillos/sombras para mejorar FPS en móviles o portátiles.',
        'Light graphics trims glow/shadows to boost FPS on mobile or older devices.'
      ),
      cx,
      py + 454
    );

    const backBtn = this.getOverlayBackButtonRect(py, panelH);
    this.drawClippedButton(
      backBtn,
      this.hoveredOverlayBackBtn ? 'rgba(6, 78, 59, 0.96)' : 'rgba(15, 25, 44, 0.95)',
      this.hoveredOverlayBackBtn ? '#ffffff' : '#10b981',
      this.hoveredOverlayBackBtn ? 2.4 : 1.8,
      this.hoveredOverlayBackBtn ? '#ffffff' : '#a7f3d0',
      13.5,
      `[ESC / CLICK] ${i18n.t('GUARDAR Y VOLVER', 'SAVE & RETURN')}`
    );

    this.ctx.restore();
  }

  private drawHelpOverlay(): void {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 9, 18, 0.9)';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const panelW = 900;
    const panelH = 590;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2;

    this.drawCyberPanel(
      px,
      py,
      panelW,
      panelH,
      14,
      'rgba(11, 19, 34, 0.98)',
      '#c084fc',
      2.2,
      '#c084fc',
      18
    );

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = `bold 23px ${FONT_DISPLAY}`;
    this.ctx.fillText(
      i18n.t('MANUAL DE OPERACIONES DEL KERNEL // CÓMO JUGAR', 'KERNEL OPERATIONS MANUAL // HOW TO PLAY'),
      cx,
      py + 38
    );

    const cards = [
      {
        title: i18n.t('01 // MOVIMIENTO Y CONTROLES', '01 // MOVEMENT & CONTROLS'),
        lines:
          i18n.currentLang === 'EN'
            ? [
                '• [WASD / Arrows] or Touch Joystick: Move.',
                '• [ESC / P]: Pause  |  [M]: Mute (run) / Missions (menu).',
                '• [V]: Light Graphics  |  [F]: Fullscreen  |  [R]: Reroll.',
                '• [H]: Range Circle  |  [B]: Nightmare  |  [K]: Co-op 4P.',
              ]
            : [
                '• [WASD / Flechas] o Joystick Táctil: Mover.',
                '• [ESC / P]: Pausa  |  [M]: Silenciar / Misiones (menú).',
                '• [V]: Gráficos Ligeros  |  [F]: Pantalla  |  [R]: Reroll.',
                '• [H]: Alcance  |  [B]: Pesadilla  |  [K]: Co-op 4P.',
              ],
        color: '#10b981',
        border: 'rgba(16, 185, 129, 0.45)',
      },
      {
        title: i18n.t('02 // ARSENAL, PASIVAS Y EVOLUCIONES', '02 // ARSENAL, PASSIVES & EVOS'),
        lines:
          i18n.currentLang === 'EN'
            ? [
                '• 5 active weapon slots + 3 Rerolls [R] per run.',
                '• Combine Lv4+ weapons & passives to EVOLVE!',
                '• Each agent has a unique passive skill in combat.',
                '• Nightmare Mode (15 CR): infinite map, minimap,',
                '  terrain events & 2x CryptoCoin rewards!',
              ]
            : [
                '• 5 ranuras de armas + 3 Rerolls [R] por partida.',
                '• ¡Combina armas Nv4+ con pasivas para EVOLUCIONAR!',
                '• Cada agente tiene una habilidad pasiva única.',
                '• Modo Pesadilla (15 CR): mapa infinito, minimapa,',
                '  eventos de terreno y CryptoMonedas x2!',
              ],
        color: '#38bdf8',
        border: 'rgba(56, 189, 248, 0.45)',
      },
      {
        title: i18n.t('03 // JEFES DE OLEADA Y BOTÍN', '03 // WAVE BOSSES & LOOT'),
        lines:
          i18n.currentLang === 'EN'
            ? [
                '• Periodic colossal bosses spawn in the malware horde.',
                '• Defeat them to collect massive XP, +5 Crypto',
                '• and a GUARANTEED Power-Up (Nuke, Freeze, Overclock)!',
                '• Upgrade your arsenal to maximum power.',
                '• Survive the evolving waves for 11-12 minutes!',
              ]
            : [
                '• Jefes periódicos con vida escalada aparecen en oleadas.',
                '• ¡Derrótalos para obtener gran botín de XP, +5 Cripto',
                '• y un Power-Up GARANTIZADO (Bomba, Hielo, Overclock)!',
                '• Mejora tu arsenal al máximo nivel.',
                '• ¡Sobrevive a las amenazas durante 11-12 minutos!',
              ],
        color: '#fbbf24',
        border: 'rgba(251, 191, 36, 0.45)',
      },
      {
        title: i18n.t('04 // JEFE FINAL: "EL TORO"', '04 // FINAL BOSS: "EL TORO"'),
        lines:
          i18n.currentLang === 'EN'
            ? [
                '• Deploys at ~11:40 (11-12 minutes of survival).',
                '• "El Toro" is INVINCIBLE and accelerates every 15s.',
                '• Each dash or contact strips 50% max HP.',
                '• All weapons online: unleash your full arsenal!',
                '• Inflict maximum damage to top the Leaderboard!',
              ]
            : [
                '• Desciende a los ~11:40 (11-12 minutos de supervivencia).',
                '• "El Toro" es INVENCIBLE y acelera cada 15s.',
                '• Cada embestida o contacto quita el 50% de HP.',
                '• ¡Todas las armas activas: desata todo tu arsenal!',
                '• ¡Haz todo el daño posible para liderar el Ranking!',
              ],
        color: '#f43f5e',
        border: 'rgba(244, 63, 94, 0.45)',
      },
    ];

    const cardW = 410;
    const cardH = 205;
    const startY = py + 68;
    const col1X = cx - cardW - 10;
    const col2X = cx + 10;

    for (let c = 0; c < cards.length; c++) {
      const card = cards[c];
      const colX = c % 2 === 0 ? col1X : col2X;
      const rowY = startY + Math.floor(c / 2) * (cardH + 14);

      this.ctx.save();
      this.drawCyberPanel(colX, rowY, cardW, cardH, 10, 'rgba(15, 24, 42, 0.94)', card.border, 1.5);
      this.traceChamferRect(colX + 2, rowY + 2, cardW - 4, cardH - 4, 8);
      this.ctx.clip();

      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = card.color;
      this.ctx.font = `bold 13px ${FONT_MONO}`;
      this.ctx.fillText(card.title, colX + 16, rowY + 28);

      this.ctx.fillStyle = '#cbd5e1';
      const maxLineW = cardW - 32;
      for (let l = 0; l < card.lines.length; l++) {
        const lineText = card.lines[l];
        let lineFont = 12.5;
        this.ctx.font = `${lineFont}px ${FONT_DISPLAY}`;
        const lm = this.ctx.measureText(lineText).width;
        if (lm > maxLineW) {
          lineFont = Math.max(9.5, Math.floor(12.5 * (maxLineW / lm)));
          this.ctx.font = `${lineFont}px ${FONT_DISPLAY}`;
        }
        this.ctx.fillText(lineText, colX + 16, rowY + 58 + l * 27);
      }
      this.ctx.restore();
    }

    const backBtn = this.getOverlayBackButtonRect(py, panelH);
    this.drawClippedButton(
      backBtn,
      this.hoveredOverlayBackBtn ? 'rgba(6, 78, 59, 0.96)' : 'rgba(15, 25, 44, 0.95)',
      this.hoveredOverlayBackBtn ? '#ffffff' : '#10b981',
      this.hoveredOverlayBackBtn ? 2.4 : 1.8,
      this.hoveredOverlayBackBtn ? '#ffffff' : '#a7f3d0',
      13.5,
      `[ESC / CLICK] ${i18n.t('VOLVER AL HANGAR', 'RETURN TO HANGAR')}`
    );

    this.ctx.restore();
  }

  private drawScannerRange(): void {
    this.ctx.save();
    this.ctx.strokeStyle = this.player.isSummoner
      ? 'rgba(236, 72, 153, 0.14)'
      : 'rgba(0, 240, 255, 0.08)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([6, 6]);
    this.ctx.beginPath();
    this.ctx.arc(
      this.player.x,
      this.player.y,
      this.player.isSummoner ? 200 : this.combatSystem.attackRange,
      0,
      Math.PI * 2
    );
    this.ctx.stroke();

    if (this.player.pickupRadius > 150) {
      this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      this.ctx.setLineDash([3, 8]);
      this.ctx.beginPath();
      this.ctx.arc(this.player.x, this.player.y, this.player.pickupRadius, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private drawDebugHitboxes(): void {
    this.ctx.save();
    this.ctx.lineWidth = 1;

    const drawEntityBox = (entity: Entity, strokeColor: string) => {
      const b = entity.getBounds();
      this.ctx.strokeStyle = strokeColor;
      this.ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    };

    if (this.player.active) {
      drawEntityBox(this.player, '#ffff00');
      this.ctx.strokeStyle = 'rgba(0, 255, 204, 0.35)';
      this.ctx.beginPath();
      this.ctx.arc(this.player.x, this.player.y, this.player.pickupRadius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    for (const enemy of this.enemies) {
      drawEntityBox(enemy, '#ff9900');
    }
    for (const proj of this.projectiles) {
      drawEntityBox(proj, '#00ffff');
    }
    for (const ping of this.pingProjectiles) {
      drawEntityBox(ping, '#0088ff');
    }
    for (const fragment of this.codeFragments) {
      drawEntityBox(fragment, '#00ffcc');
    }
    for (const coin of this.cryptoCoins) {
      drawEntityBox(coin, '#fbbf24');
    }

    this.ctx.restore();
  }

  private ensureBgCache(): HTMLCanvasElement {
    const w = LOGICAL_WIDTH;
    const h = LOGICAL_HEIGHT;
    if (
      this.bgCacheCanvas &&
      this.bgCacheCanvas.width === w &&
      this.bgCacheCanvas.height === h
    ) {
      return this.bgCacheCanvas;
    }

    const cache = document.createElement('canvas');
    cache.width = w;
    cache.height = h;
    const bgCtx = cache.getContext('2d', { alpha: false }) || cache.getContext('2d');
    if (bgCtx) {
      const gridSize = 64;
      const majorSize = gridSize * 4;

      // Suelo de silicio / placa base industrial azul pizarra oscuro
      const bgGrad = bgCtx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        80,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.72
      );
      bgGrad.addColorStop(0, '#0d1729');
      bgGrad.addColorStop(1, '#060a13');
      bgCtx.fillStyle = bgGrad;
      bgCtx.fillRect(0, 0, w, h);

      // Rejilla secundaria de placa base
      bgCtx.strokeStyle = 'rgba(56, 189, 248, 0.045)';
      bgCtx.lineWidth = 1;
      bgCtx.beginPath();
      for (let x = 0; x <= w; x += gridSize) {
        bgCtx.moveTo(x, 0);
        bgCtx.lineTo(x, h);
      }
      for (let y = 0; y <= h; y += gridSize) {
        bgCtx.moveTo(0, y);
        bgCtx.lineTo(w, y);
      }
      bgCtx.stroke();

      // Líneas maestras de bus PCB
      bgCtx.strokeStyle = 'rgba(56, 189, 248, 0.11)';
      bgCtx.beginPath();
      for (let x = majorSize; x < w; x += majorSize) {
        bgCtx.moveTo(x, 0);
        bgCtx.lineTo(x, h);
      }
      for (let y = majorSize; y < h; y += majorSize) {
        bgCtx.moveTo(0, y);
        bgCtx.lineTo(w, y);
      }
      bgCtx.stroke();

      // Trazas de circuito impreso (PCB 45° traces + pads de soldadura) deterministas
      bgCtx.strokeStyle = 'rgba(16, 185, 129, 0.10)';
      bgCtx.lineWidth = 1.6;
      bgCtx.beginPath();
      for (let gx = majorSize; gx < w; gx += majorSize) {
        for (let gy = majorSize; gy < h; gy += majorSize) {
          const dir = (gx / majorSize + gy / majorSize) % 2 === 0 ? 1 : -1;
          bgCtx.moveTo(gx - 42, gy);
          bgCtx.lineTo(gx - 18, gy);
          bgCtx.lineTo(gx, gy + 18 * dir);
          bgCtx.lineTo(gx + 34, gy + 18 * dir);
        }
      }
      bgCtx.stroke();

      // Vías / nodos de soldadura y cruces de sector
      bgCtx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
      bgCtx.lineWidth = 1.2;
      bgCtx.beginPath();
      for (let x = majorSize; x < w; x += majorSize) {
        for (let y = majorSize; y < h; y += majorSize) {
          bgCtx.moveTo(x - 5, y);
          bgCtx.lineTo(x + 5, y);
          bgCtx.moveTo(x, y - 5);
          bgCtx.lineTo(x, y + 5);
        }
      }
      bgCtx.stroke();

      bgCtx.fillStyle = 'rgba(251, 191, 36, 0.22)';
      for (let gx = majorSize; gx < w; gx += majorSize) {
        for (let gy = majorSize; gy < h; gy += majorSize) {
          bgCtx.beginPath();
          bgCtx.arc(gx - 42, gy, 2.2, 0, Math.PI * 2);
          bgCtx.fill();
        }
      }
    }

    this.bgCacheCanvas = cache;
    return cache;
  }

  private ensureScanLineCache(): HTMLCanvasElement {
    if (this.scanLineCache) return this.scanLineCache;
    const strip = document.createElement('canvas');
    strip.width = 4;
    strip.height = 80;
    const sCtx = strip.getContext('2d');
    if (sCtx) {
      const scanGrad = sCtx.createLinearGradient(0, 0, 0, 80);
      scanGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      scanGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.055)');
      scanGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
      sCtx.fillStyle = scanGrad;
      sCtx.fillRect(0, 0, 4, 80);
    }
    this.scanLineCache = strip;
    return strip;
  }

  private drawCyberGrid(): void {
    const w = LOGICAL_WIDTH;
    const h = LOGICAL_HEIGHT;
    const tSec = performance.now() * 0.001;

    this.ctx.save();
    this.ctx.drawImage(this.ensureBgCache(), 0, 0);

    if (!this.lightGraphicsEnabled) {
      // Pulso horizontal suave de escaneo de bus (sin recrear gradientes cada frame)
      const scanY = ((tSec * 82) % (h + 160)) - 80;
      this.ctx.drawImage(this.ensureScanLineCache(), 0, scanY - 40, w, 80);

      // Paquetes ambientales discretos circulando por el silicio
      for (let i = 0; i < this.ambientNodes.length; i++) {
        const node = this.ambientNodes[i];
        const nx = (((node.x + node.vx * tSec) % w) + w) % w;
        const ny = (((node.y + node.vy * tSec) % h) + h) % h;
        const pulse = 0.65 + 0.35 * Math.sin(tSec * 2.1 + i);
        this.ctx.fillStyle = i % 3 === 0 ? '#38bdf8' : '#10b981';
        this.ctx.globalAlpha = node.alpha * 0.75 * pulse;
        this.ctx.fillRect(nx - node.size * 0.5, ny - node.size * 0.5, node.size, node.size);
      }
    }

    this.ctx.restore();
  }

  private drawXpBar(): void {
    const barHeight = 9;
    const w = LOGICAL_WIDTH;
    const ratio = Math.max(
      0,
      Math.min(1, this.upgradeSystem.currentXp / Math.max(1, this.upgradeSystem.xpToNextLevel))
    );
    const fillW = w * ratio;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(8, 14, 26, 0.96)';
    this.ctx.fillRect(0, 0, w, barHeight);

    if (fillW > 0) {
      const xpGrad = this.ctx.createLinearGradient(0, 0, Math.max(40, fillW), 0);
      xpGrad.addColorStop(0, '#0284c7');
      xpGrad.addColorStop(0.65, '#38bdf8');
      xpGrad.addColorStop(1, '#10b981');
      this.ctx.fillStyle = xpGrad;
      this.ctx.fillRect(0, 0, fillW, barHeight);

      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(Math.max(0, fillW - 3), 0, Math.min(3, fillW), barHeight);
    }

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    this.ctx.fillRect(w * 0.25, 0, 1, barHeight);
    this.ctx.fillRect(w * 0.5, 0, 1, barHeight);
    this.ctx.fillRect(w * 0.75, 0, 1, barHeight);
    this.ctx.restore();
  }

  private formatTimeMMSS(totalSeconds: number): string {
    const secs = Math.max(0, Math.floor(totalSeconds));
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  private drawHUD(): void {
    const w = LOGICAL_WIDTH;
    const hpRatio = Math.max(0, Math.min(1, this.player.hp / Math.max(1, this.player.maxHp)));

    this.ctx.save();

    // ==========================================
    // 1. POD SUPERIOR IZQUIERDO: AGENTE, NIVEL, HP BAR, ARSENAL Y ULTIMATE
    // ==========================================
    const lx = 16;
    const ly = 18;
    const lw = 356;
    const lh = 100;
    this.drawCyberPanel(lx, ly, lw, lh, 10, 'rgba(11, 19, 34, 0.9)', 'rgba(56, 189, 248, 0.55)', 1.5);

    this.ctx.save();
    this.traceChamferRect(lx + 2, ly + 2, lw - 4, lh - 4, 8);
    this.ctx.clip();

    this.ctx.fillStyle = this.player.color;
    this.ctx.beginPath();
    this.ctx.arc(lx + 18, ly + 17, 4.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = `bold 13.5px ${FONT_DISPLAY}`;
    this.ctx.fillText(this.player.profileName, lx + 29, ly + 22);

    const nameW = this.ctx.measureText(this.player.profileName).width;
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = `bold 11.5px ${FONT_MONO}`;
    this.ctx.fillText(`LVL ${this.upgradeSystem.level}.0`, lx + 38 + nameW, ly + 22);

    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = '#10b981';
    this.ctx.font = `bold 11.5px ${FONT_MONO}`;
    this.ctx.fillText(`XP x${this.player.xpMultiplier.toFixed(2)}`, lx + lw - 14, ly + 22);

    // Barra gráfica de HP
    const hpBarX = lx + 14;
    const hpBarY = ly + 31;
    const hpBarW = lw - 28;
    const hpBarH = 17;

    this.ctx.fillStyle = 'rgba(7, 11, 20, 0.95)';
    this.ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);

    if (hpRatio > 0) {
      const hpGrad = this.ctx.createLinearGradient(hpBarX, 0, hpBarX + hpBarW * hpRatio, 0);
      if (hpRatio > 0.5) {
        hpGrad.addColorStop(0, '#059669');
        hpGrad.addColorStop(1, '#10b981');
      } else if (hpRatio > 0.25) {
        hpGrad.addColorStop(0, '#d97706');
        hpGrad.addColorStop(1, '#fbbf24');
      } else {
        hpGrad.addColorStop(0, '#b91c1c');
        hpGrad.addColorStop(1, '#f43f5e');
      }
      this.ctx.fillStyle = hpGrad;
      this.ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      this.ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, 4);
    }

    this.ctx.strokeStyle = hpRatio <= 0.25 ? '#fb7185' : 'rgba(148, 163, 184, 0.35)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `bold 11px ${FONT_MONO}`;
    this.ctx.fillText(
      `HP ${Math.max(0, Math.ceil(this.player.hp))} / ${this.player.maxHp}`,
      hpBarX + hpBarW / 2,
      hpBarY + 12.5
    );

    // Armas activas con auto-fit
    let weaponsList = this.combatSystem.getActiveWeaponsList(this.player);
    if (this.isCoopMode && !this.isCoopHost && this.coopSnapshot) {
      const meSnap = this.coopSnapshot.players.find((p) => p.id === this.mpClient.myId);
      if (meSnap && meSnap.activeWeapons.length > 0) {
        weaponsList = meSnap.activeWeapons;
      }
    }
    const weaponsStatus = weaponsList.join(' • ');
    const weaponsLabel = `${i18n.t('ARMAS', 'WEAPONS')}: ${weaponsStatus}`;
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#7dd3fc';
    let wFont = 11.5;
    const maxWeaponW = lw - 28;
    this.ctx.font = `bold ${wFont}px ${FONT_DISPLAY}`;
    const wMetrics = this.ctx.measureText(weaponsLabel).width;
    if (wMetrics > maxWeaponW) {
      wFont = Math.max(9.5, Math.floor(11.5 * (maxWeaponW / wMetrics)));
      this.ctx.font = `bold ${wFont}px ${FONT_DISPLAY}`;
    }
    this.ctx.fillText(weaponsLabel, lx + 14, ly + 65);

    // Barra interactiva de Habilidad Activa / Ultimate (cargada por bajas, dura X segundos)
    const ultRect = this.getInGameUltBarRect();
    const isUltActive = this.player.ultActiveTimer > 0;
    const isUltReady = this.player.canActivateUltimate();
    const ultRatio = isUltActive
      ? Math.max(0, Math.min(1, this.player.ultActiveTimer / Math.max(0.1, this.player.ultDuration)))
      : Math.max(0, Math.min(1, this.player.ultCharge / Math.max(1, this.player.ultMaxCharge)));
    const uName = i18n.currentLang === 'EN' ? this.player.ultNameEn : this.player.ultName;
    const ultPulse = 0.72 + 0.28 * Math.sin(performance.now() * 0.012);

    this.ctx.fillStyle = 'rgba(7, 11, 20, 0.95)';
    this.ctx.fillRect(ultRect.x, ultRect.y, ultRect.width, ultRect.height);

    if (ultRatio > 0) {
      this.ctx.fillStyle = isUltActive
        ? '#f97316'
        : isUltReady
        ? `rgba(16, 185, 129, ${0.7 + 0.3 * ultPulse})`
        : '#0284c7';
      this.ctx.fillRect(ultRect.x, ultRect.y, ultRect.width * ultRatio, ultRect.height);
    }

    this.ctx.strokeStyle =
      this.hoveredInGameBtn === 'ULT'
        ? '#ffffff'
        : isUltActive
        ? '#fbbf24'
        : isUltReady
        ? '#34d399'
        : 'rgba(56, 189, 248, 0.45)';
    this.ctx.lineWidth = isUltReady || isUltActive ? 1.6 : 1;
    this.ctx.strokeRect(ultRect.x, ultRect.y, ultRect.width, ultRect.height);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = isUltReady ? '#fef08a' : '#f8fafc';
    this.ctx.font = `bold 10px ${FONT_MONO}`;
    const ultText = isUltActive
      ? `🔥 ${uName}: ${this.player.ultActiveTimer.toFixed(1)}s`
      : isUltReady
      ? `⚡ [ESPACIO / E] ¡${uName} LISTA!`
      : `⚡ [E] ${uName} (${this.player.ultCharge}/${this.player.ultMaxCharge})`;
    this.ctx.fillText(
      ultText,
      ultRect.x + ultRect.width / 2,
      ultRect.y + 13.5,
      ultRect.width - 12
    );
    this.ctx.restore();

    // ==========================================
    // 2. POD SUPERIOR DERECHO: CRONÓMETRO, BAJAS, CRIPTO, AUDIO Y PAUSA
    // ==========================================
    const rw = 368;
    const rx = w - rw - 16;
    const ry = 18;
    const rh = 76;
    const timeUntilToro = Math.max(0, FINAL_BOSS_ARRIVAL_TIME - this.elapsedTime);
    const toroStroke = this.spawner.finalBossMode
      ? 'rgba(244, 63, 94, 0.85)'
      : 'rgba(56, 189, 248, 0.55)';
    this.drawCyberPanel(rx, ry, rw, rh, 10, 'rgba(11, 19, 34, 0.9)', toroStroke, 1.5);

    this.ctx.save();
    this.traceChamferRect(rx + 2, ry + 2, rw - 4, rh - 4, 8);
    this.ctx.clip();

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = `bold 18px ${FONT_MONO}`;
    this.ctx.fillText(this.formatTimeMMSS(this.elapsedTime), rx + 14, ry + 26);

    // Vector badge de Bajas
    this.ctx.fillStyle = '#f43f5e';
    this.ctx.beginPath();
    this.ctx.moveTo(rx + 88, ry + 16);
    this.ctx.lineTo(rx + 93, ry + 21);
    this.ctx.lineTo(rx + 88, ry + 26);
    this.ctx.lineTo(rx + 83, ry + 21);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.fillStyle = '#fda4af';
    this.ctx.font = `bold 12px ${FONT_MONO}`;
    this.ctx.fillText(`${this.killCount}`, rx + 98, ry + 25);

    // Vector token de Cripto
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.beginPath();
    this.ctx.arc(rx + 158, ry + 21, 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#fde68a';
    this.ctx.fillText(`${this.runCoinsCollected} CR`, rx + 167, ry + 25);

    const muteBtn = this.getInGameMuteButtonRect();
    const muteHover = this.hoveredInGameBtn === 'MUTE';
    this.drawClippedButton(
      muteBtn,
      this.sound.muted
        ? 'rgba(76, 12, 28, 0.92)'
        : muteHover
        ? 'rgba(30, 58, 86, 0.96)'
        : 'rgba(30, 41, 59, 0.92)',
      muteHover ? '#ffffff' : this.sound.muted ? '#fb7185' : 'rgba(148, 163, 184, 0.55)',
      muteHover ? 1.5 : 1.1,
      this.sound.muted ? '#fda4af' : '#cbd5e1',
      11,
      this.sound.muted ? '🔇' : '🔊'
    );

    const pauseBtn = this.getInGamePauseButtonRect();
    const pauseHover = this.hoveredInGameBtn === 'PAUSE';
    this.drawClippedButton(
      pauseBtn,
      pauseHover ? 'rgba(30, 58, 86, 0.96)' : 'rgba(30, 41, 59, 0.92)',
      pauseHover ? '#ffffff' : 'rgba(148, 163, 184, 0.55)',
      pauseHover ? 1.5 : 1.1,
      pauseHover ? '#ffffff' : '#cbd5e1',
      9.5,
      `[ESC] ${i18n.t('PAUSA', 'PAUSE')}`
    );

    this.ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    this.ctx.fillRect(rx + 14, ry + 37, rw - 28, 1);

    const bossProgressLabel = this.spawner.finalBossMode
      ? i18n.t('FASE CRITICA // JEFE FINAL [EL TORO]', 'CRITICAL PHASE // FINAL BOSS [EL TORO]')
      : i18n.t(
          `PROTOCOLO TORO: ${this.formatTimeMMSS(timeUntilToro)}  •  JEFES: ${this.runBossesKilled}`,
          `TORO INCOMING: ${this.formatTimeMMSS(timeUntilToro)}  •  BOSSES: ${this.runBossesKilled}`
        );

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = this.spawner.finalBossMode ? '#fb7185' : '#38bdf8';
    let objFont = 11.5;
    const maxObjW = rw - 26;
    this.ctx.font = `bold ${objFont}px ${FONT_DISPLAY}`;
    const objMetrics = this.ctx.measureText(bossProgressLabel).width;
    if (objMetrics > maxObjW) {
      objFont = Math.max(9.5, Math.floor(11.5 * (maxObjW / objMetrics)));
      this.ctx.font = `bold ${objFont}px ${FONT_DISPLAY}`;
    }
    this.ctx.fillText(bossProgressLabel, rx + rw / 2, ry + 59);
    this.ctx.restore();

    // ==========================================
    // 3. BARRA SUPERIOR CENTRAL: ARSENAL + HEXÁGONO DE EVOLUCIÓN
    // ==========================================
    let hudBadges = this.combatSystem.getEquippedWeaponBadges(this.player);
    if (this.isCoopMode && !this.isCoopHost && this.coopSnapshot) {
      const me = this.coopSnapshot.players.find((p) => p.id === this.mpClient.myId);
      if (me && me.activeWeapons.length > 0) {
        const inferColor = (wName: string): string => {
          const upper = wName.toUpperCase();
          if (upper.includes('PING') || upper.includes('DDOS') || upper.includes('TESLA') || upper.includes('ARCO')) return '#38bdf8';
          if (upper.includes('CUARENT') || upper.includes('PURGA') || upper.includes('CRIO') || upper.includes('CERO')) return '#10b981';
          if (upper.includes('DRON') || upper.includes('OMEGA')) return '#f43f5e';
          if (upper.includes('CORTAF') || upper.includes('SOLAR') || upper.includes('DISCO') || upper.includes('PHANTOM')) return '#fb923c';
          if (upper.includes('SQL') || upper.includes('ZERO-DAY')) return '#d946ef';
          if (upper.includes('MASCOTA') || upper.includes('BRUT') || upper.includes('BOTNET') || upper.includes('PINBALL')) return '#ec4899';
          return '#facc15';
        };
        hudBadges = me.activeWeapons.map((wName) => {
          const isEvolved = wName.startsWith('★');
          const verMatch = /v(\d+)$/i.exec(wName);
          const lvl = isEvolved ? 5 : verMatch ? Number(verMatch[1]) : 1;
          const clean = wName.replace(/\s+v\d+$/i, '').replace(/^Mascota:\s*/i, '');
          return {
            shortName: clean.length > 12 ? clean.slice(0, 11) + '.' : clean,
            color: inferColor(wName),
            level: lvl,
            maxLevel: 5,
            evolved: isEvolved,
            hasEvo: true,
          };
        });
      }
    }

    if (hudBadges.length > 0) {
      const shown = hudBadges.slice(0, 6);
      const pillW = 148;
      const pillH = 34;
      const pillGap = 8;
      const totalStripW = shown.length * pillW + (shown.length - 1) * pillGap;
      const startStripX = w / 2 - totalStripW / 2;
      const stripY = 18;

      for (let idx = 0; idx < shown.length; idx++) {
        const b = shown[idx];
        const bx = startStripX + idx * (pillW + pillGap);
        this.drawCyberPanel(
          bx,
          stripY,
          pillW,
          pillH,
          7,
          b.evolved ? 'rgba(42, 12, 24, 0.92)' : 'rgba(11, 19, 34, 0.88)',
          b.color,
          b.evolved ? 1.8 : 1.3
        );

        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = b.evolved ? '#ffffff' : b.color;
        this.ctx.font = `bold 10.5px ${FONT_MONO}`;
        this.ctx.fillText(b.shortName, bx + 9, stripY + 14);

        // Rombos miniatura de nivel bajo el nombre
        for (let p = 0; p < b.maxLevel; p++) {
          const px = bx + 11 + p * 11;
          const py = stripY + 24;
          const r = 2.8;
          this.ctx.beginPath();
          this.ctx.moveTo(px, py - r);
          this.ctx.lineTo(px + r, py);
          this.ctx.lineTo(px, py + r);
          this.ctx.lineTo(px - r, py);
          this.ctx.closePath();
          if (p < b.level) {
            this.ctx.fillStyle = b.color;
            this.ctx.fill();
          } else {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
          }
        }

        // Hexágono rojo a la derecha: vacío mientras sube nivel, relleno al evolucionar
        if (b.hasEvo) {
          this.drawEvolutionHexagon(bx + pillW - 16, stripY + pillH / 2, 7.2, b.evolved, b.evolved);
        }
      }
    }

    this.ctx.restore();
  }

  private drawBossHUD(): void {
    this.ctx.save();
    this.ctx.textAlign = 'center';

    // Cliente Invitado Co-op: renderiza barra/alerta de Jefe y El Toro desde el snapshot del Host
    if (this.isCoopMode && !this.isCoopHost) {
      const remoteBoss = this.coopSnapshot?.boss;
      if (!remoteBoss) {
        this.ctx.restore();
        return;
      }
      if (remoteBoss.isToro) {
        const panelW = Math.min(640, LOGICAL_WIDTH * 0.72);
        const panelH = 68;
        const px = (LOGICAL_WIDTH - panelW) / 2;
        const py = LOGICAL_HEIGHT - 84;
        this.drawCyberPanel(
          px,
          py,
          panelW,
          panelH,
          12,
          'rgba(22, 10, 18, 0.94)',
          remoteBoss.color || '#f43f5e',
          2.2
        );
        this.ctx.fillStyle = '#fda4af';
        this.ctx.font = `bold 13px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          i18n.t(
            `JEFE FINAL: EL TORO [INVENCIBLE // CONTACTO: 50% HP MÁX] | ${remoteBoss.toroStatus || ''}`,
            `FINAL BOSS: EL TORO [INVINCIBLE // CONTACT: 50% MAX HP] | ${remoteBoss.toroStatus || ''}`
          ),
          LOGICAL_WIDTH / 2,
          py + 24
        );
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.font = `bold 19px ${FONT_MONO}`;
        this.ctx.fillText(
          `${i18n.t('DAÑO TOTAL ACUMULADO', 'TOTAL DAMAGE DEALT')}: ${(remoteBoss.toroDmg || 0).toLocaleString('en-US')}`,
          LOGICAL_WIDTH / 2,
          py + 52
        );
        this.ctx.restore();
        return;
      }

      if (remoteBoss.hp > 0) {
        const barWidth = Math.min(540, LOGICAL_WIDTH * 0.56);
        const barHeight = 14;
        const x = (LOGICAL_WIDTH - barWidth) / 2;
        const y = LOGICAL_HEIGHT - 46;
        const ratio = Math.max(0, remoteBoss.hp / Math.max(1, remoteBoss.maxHp));
        this.ctx.fillStyle = '#f8fafc';
        this.ctx.font = `bold 13px ${FONT_MONO}`;
        this.ctx.fillText(
          `${remoteBoss.name} // INTEGRITY: ${remoteBoss.hp.toLocaleString('en-US')} / ${remoteBoss.maxHp.toLocaleString('en-US')}`,
          LOGICAL_WIDTH / 2,
          y - 8
        );
        this.drawCyberPanel(x, y, barWidth, barHeight, 4, 'rgba(11, 19, 34, 0.94)', 'rgba(226, 232, 240, 0.75)', 1.4);
        if (ratio > 0) {
          this.ctx.save();
          this.traceChamferRect(x + 1, y + 1, barWidth - 2, barHeight - 2, 3);
          this.ctx.clip();
          this.ctx.fillStyle = remoteBoss.color || '#f43f5e';
          this.ctx.fillRect(x, y, barWidth * ratio, barHeight);
          this.ctx.restore();
        }
      }

      this.ctx.restore();
      return;
    }

    // UI Dedicada exclusivamente al Jefe Final ("El Toro") cuando está activo
    if (this.finalBoss && this.finalBoss.active) {
      const panelW = Math.min(640, LOGICAL_WIDTH * 0.72);
      const panelH = 68;
      const px = (LOGICAL_WIDTH - panelW) / 2;
      const py = LOGICAL_HEIGHT - 84;

      this.drawCyberPanel(
        px,
        py,
        panelW,
        panelH,
        12,
        'rgba(22, 10, 18, 0.94)',
        this.finalBoss.state === 'TELEGRAPH' ? '#fbbf24' : '#f43f5e',
        2.2,
        '#dc2626',
        16
      );

      this.ctx.fillStyle = '#fda4af';
      this.ctx.font = `bold 13px ${FONT_DISPLAY}`;
      this.ctx.fillText(
        i18n.t(
          `JEFE FINAL: EL TORO [INVENCIBLE // CONTACTO: 50% HP MÁX] | ${this.finalBoss.getDashStatusText()}`,
          `FINAL BOSS: EL TORO [INVINCIBLE // CONTACT: 50% MAX HP] | ${this.finalBoss.getDashStatusText()}`
        ),
        LOGICAL_WIDTH / 2,
        py + 24
      );

      this.ctx.fillStyle = '#fbbf24';
      this.ctx.font = `bold 19px ${FONT_MONO}`;
      this.ctx.fillText(
        `${i18n.t('DAÑO TOTAL ACUMULADO', 'TOTAL DAMAGE DEALT')}: ${Math.round(this.finalBoss.totalDamageTaken).toLocaleString('en-US')}`,
        LOGICAL_WIDTH / 2,
        py + 52
      );

      this.ctx.restore();
      return;
    }

    const activeBoss = this.enemies.find(
      (e): e is WaveBoss => e instanceof WaveBoss && e.active
    );

    if (activeBoss) {
      const barWidth = Math.min(540, LOGICAL_WIDTH * 0.56);
      const barHeight = 14;
      const x = (LOGICAL_WIDTH - barWidth) / 2;
      const y = LOGICAL_HEIGHT - 46;
      const ratio = Math.max(0, activeBoss.hp / Math.max(1, activeBoss.maxHp));
      const bossColor = activeBoss.bossColor || '#f43f5e';

      this.ctx.fillStyle = '#f8fafc';
      this.ctx.font = `bold 13px ${FONT_MONO}`;
      this.ctx.fillText(
        `${activeBoss.bossName} // INTEGRITY: ${Math.max(0, Math.ceil(activeBoss.hp)).toLocaleString('en-US')} / ${activeBoss.maxHp.toLocaleString('en-US')}`,
        LOGICAL_WIDTH / 2,
        y - 8
      );

      this.drawCyberPanel(x, y, barWidth, barHeight, 4, 'rgba(11, 19, 34, 0.94)', 'rgba(226, 232, 240, 0.75)', 1.4);

      if (ratio > 0) {
        this.ctx.save();
        this.traceChamferRect(x + 1, y + 1, barWidth - 2, barHeight - 2, 3);
        this.ctx.clip();
        this.ctx.fillStyle = bossColor;
        this.ctx.fillRect(x, y, barWidth * ratio, barHeight);
        this.ctx.restore();
      }
    }

    this.ctx.restore();
  }

  private getUpgradeCardRects(): CardRect[] {
    const choices = this.upgradeSystem.currentChoices;
    const cardWidth = 360;
    const cardHeight = 308;
    const gap = 30;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * gap;
    const startX = (LOGICAL_WIDTH - totalWidth) / 2;
    const y = LOGICAL_HEIGHT / 2 - cardHeight / 2 + 28;

    return choices.map((_, index) => ({
      index,
      x: startX + index * (cardWidth + gap),
      y,
      width: cardWidth,
      height: cardHeight,
    }));
  }

  private parseUpgradeStatRows(
    raw: string
  ): { trend: 'UP' | 'DOWN' | 'INFO'; delta: string; label: string }[] {
    if (!raw) return [];
    return raw
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        let trend: 'UP' | 'DOWN' | 'INFO' = 'INFO';
        let clean = part;
        if (clean.startsWith('▲')) {
          trend = 'UP';
          clean = clean.slice(1).trim();
        } else if (clean.startsWith('▼')) {
          trend = 'DOWN';
          clean = clean.slice(1).trim();
        }

        const match = clean.match(/^([+-]?\d+(?:\.\d+)?%?(?:px)?(?:\s*HP)?)\s+(.+)$/i);
        if (match) {
          const delta = match[1].trim();
          const label = match[2].trim();
          if (trend === 'INFO') {
            trend = delta.startsWith('-') ? 'DOWN' : 'UP';
          }
          return { trend, delta, label };
        }

        return { trend: 'INFO', delta: '', label: clean };
      });
  }

  private drawEvolutionHexagon(
    x: number,
    y: number,
    r: number,
    filled: boolean,
    pulse: boolean = false
  ): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 3;
      const hx = Math.cos(a) * r;
      const hy = Math.sin(a) * r;
      if (k === 0) this.ctx.moveTo(hx, hy);
      else this.ctx.lineTo(hx, hy);
    }
    this.ctx.closePath();

    if (filled) {
      this.ctx.fillStyle = '#ff1e42';
      if (!this.lightGraphicsEnabled) {
        this.ctx.shadowColor = '#ff1e42';
        this.ctx.shadowBlur = pulse ? 12 : 8;
      }
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = '#fecdd3';
      this.ctx.lineWidth = 1.6;
      this.ctx.stroke();

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, Math.max(1.5, r * 0.28), 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      this.ctx.fill();
      this.ctx.strokeStyle = pulse ? '#fb7185' : '#ff1e42';
      this.ctx.lineWidth = 1.9;
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawUpgradeModal(): void {
    const choices = this.upgradeSystem.currentChoices;
    const cards = this.getUpgradeCardRects();
    const now = performance.now();

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 9, 18, 0.88)';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.shadowColor = '#38bdf8';
    this.ctx.shadowBlur = 14;
    this.ctx.font = `bold 27px ${FONT_DISPLAY}`;
    this.ctx.fillText(
      `// ${i18n.t('MÓDULOS DE MEJORA', 'SYSTEM UPGRADE MODULES')} :: ${i18n.t('NIVEL', 'LEVEL')} ${this.upgradeSystem.level}.0 //`,
      LOGICAL_WIDTH / 2,
      LOGICAL_HEIGHT / 2 - 186
    );

    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = `15px ${FONT_DISPLAY}`;
    this.ctx.fillText(
      i18n.t(
        'Elige 1 de las 3 Tarjetas de Mejora con las teclas [1] [2] [3] o haciendo clic:',
        'Choose 1 of 3 Upgrade Cards using keys [1] [2] [3] or clicking:'
      ),
      LOGICAL_WIDTH / 2,
      LOGICAL_HEIGHT / 2 - 154
    );

    for (let i = 0; i < choices.length; i++) {
      const opt = choices[i];
      const rect = cards[i];
      const isHovered = this.hoveredCardIndex === i;

      this.ctx.save();
      this.drawCyberPanel(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        14,
        isHovered ? 'rgba(18, 30, 52, 0.98)' : 'rgba(11, 19, 34, 0.96)',
        isHovered ? '#ffffff' : opt.color,
        isHovered ? 2.5 : 1.8,
        opt.color,
        isHovered ? 18 : 8
      );

      // Recorte estricto dentro de la tarjeta de mejora biselada
      this.traceChamferRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, 12);
      this.ctx.clip();

      // Brillo ambiental superior sutil en el color de la tarjeta
      const topGlow = this.ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + 115);
      topGlow.addColorStop(0, isHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 255, 136, 0.06)');
      topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = topGlow;
      this.ctx.fillRect(rect.x, rect.y, rect.width, 115);

      // Franja luminosa superior
      this.ctx.fillStyle = opt.color;
      this.ctx.fillRect(rect.x + 14, rect.y, rect.width - 28, 3);

      const cardCategory = i18n.currentLang === 'EN' && opt.categoryEn ? opt.categoryEn : opt.category;
      const cardName = i18n.currentLang === 'EN' && opt.nameEn ? opt.nameEn : opt.name;
      const cardDesc = i18n.currentLang === 'EN' && opt.descriptionEn ? opt.descriptionEn : opt.description;
      const cardStat = i18n.currentLang === 'EN' && opt.statBadgeEn ? opt.statBadgeEn : opt.statBadge;

      // Cabecera: Etiqueta de categoría a la izquierda + rombos de nivel (+ hexágono rojo de evolución) a la derecha
      this.ctx.shadowBlur = 0;
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = opt.color;
      const hasEvoSlot = Boolean(opt.isWeapon || opt.isEvolution);
      const pipCount = opt.isEvolution ? 5 : Math.max(1, opt.maxLevel);
      const ownedPips = opt.isEvolution ? 5 : opt.level;
      const pipGap = 13;
      const hexX = rect.x + rect.width - 23;
      const rightAnchor = hasEvoSlot ? hexX - 20 : rect.x + rect.width - 20;
      const firstPipX = rightAnchor - (pipCount - 1) * pipGap;
      const catMaxW = Math.max(115, firstPipX - (rect.x + 26));
      let catFont = 11.5;
      const catText = `[${i + 1}] // ${cardCategory}`;
      this.ctx.font = `bold ${catFont}px ${FONT_MONO}`;
      const catMetrics = this.ctx.measureText(catText).width;
      if (catMetrics > catMaxW) {
        catFont = Math.max(9.5, Math.floor(11.5 * (catMaxW / catMetrics)));
        this.ctx.font = `bold ${catFont}px ${FONT_MONO}`;
      }
      this.ctx.fillText(catText, rect.x + 18, rect.y + 27);

      // Rombos de progreso de nivel (el siguiente rango parpadea suavemente)
      for (let p = 0; p < pipCount; p++) {
        const px = firstPipX + p * pipGap;
        const py = rect.y + 23;
        const isOwned = p < ownedPips;
        const isNext = !opt.isEvolution && p === opt.level;
        const r = isNext ? 4.8 : 3.8;

        this.ctx.save();
        this.ctx.translate(px, py);
        this.ctx.beginPath();
        this.ctx.moveTo(0, -r);
        this.ctx.lineTo(r, 0);
        this.ctx.lineTo(0, r);
        this.ctx.lineTo(-r, 0);
        this.ctx.closePath();

        if (isOwned) {
          this.ctx.fillStyle = opt.color;
          this.ctx.fill();
        } else if (isNext) {
          const pulse = 0.65 + 0.35 * Math.sin(now * 0.008 + i);
          this.ctx.fillStyle = `rgba(0, 255, 136, ${pulse})`;
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1;
          this.ctx.fill();
          this.ctx.stroke();
        } else {
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
          this.ctx.lineWidth = 1.1;
          this.ctx.stroke();
        }
        this.ctx.restore();
      }

      // Hexágono rojo más grande al lado de los niveles: vacío al mejorar, lleno cuando es Evolución
      if (hasEvoSlot) {
        this.drawEvolutionHexagon(hexX, rect.y + 23, 8.2, Boolean(opt.isEvolution), Boolean(opt.isEvolution));
      }

      // Nombre de la tarjeta
      const nameMaxW = rect.width - 36;
      let nameFont = 18.5;
      this.ctx.font = `bold ${nameFont}px ${FONT_DISPLAY}`;
      const nMetrics = this.ctx.measureText(cardName).width;
      if (nMetrics > nameMaxW) {
        nameFont = Math.max(12.5, Math.floor(18.5 * (nameMaxW / nMetrics)));
        this.ctx.font = `bold ${nameFont}px ${FONT_DISPLAY}`;
      }
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(cardName, rect.x + 18, rect.y + 56);

      // Subtítulo limpio de transición de nivel (sin recuadros)
      this.ctx.font = `bold 12px ${FONT_MONO}`;
      if (opt.level === 0) {
        this.ctx.fillStyle = '#00ff88';
        this.ctx.fillText(
          i18n.t('✦ NUEVO DESBLOQUEO  ▸  LVL 1', '✦ NEW UNLOCK  ▸  LVL 1'),
          rect.x + 18,
          rect.y + 80
        );
      } else {
        const curLbl = `LVL ${opt.level}`;
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.fillText(curLbl, rect.x + 18, rect.y + 80);
        const curW = this.ctx.measureText(curLbl).width;

        this.ctx.fillStyle = opt.color;
        const arrowLbl = '  ▸  ';
        this.ctx.fillText(arrowLbl, rect.x + 18 + curW, rect.y + 80);
        const arrowW = this.ctx.measureText(arrowLbl).width;

        this.ctx.fillStyle = '#00ff88';
        const nextLbl = `LVL ${opt.level + 1}`;
        this.ctx.fillText(nextLbl, rect.x + 18 + curW + arrowW, rect.y + 80);
        const nextW = this.ctx.measureText(nextLbl).width;

        this.ctx.fillStyle = '#64748b';
        this.ctx.fillText(
          `  (${i18n.t('Máx', 'Max')} ${opt.maxLevel})`,
          rect.x + 18 + curW + arrowW + nextW,
          rect.y + 80
        );
      }

      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.font = `13px ${FONT_DISPLAY}`;
      this.wrapText(cardDesc, rect.x + 18, rect.y + 106, rect.width - 36, 18, 2);

      // Zona visual de estadísticas que cambian (desglosadas en filas limpias, SIN cajas)
      const statRows = this.parseUpgradeStatRows(cardStat);
      if (statRows.length > 0) {
        const statsHeaderY = rect.y + 150;
        const headerLabel = i18n.t('MEJORAS DE ESTADO', 'STAT UPGRADES');
        this.ctx.save();
        this.ctx.font = `bold 10px ${FONT_MONO}`;
        const hdrW = this.ctx.measureText(headerLabel).width;
        const gapHalf = hdrW / 2 + 10;

        // Líneas divisorias con hueco central para la micro-etiqueta
        const leftGrad = this.ctx.createLinearGradient(rect.x + 18, statsHeaderY, rect.x + rect.width / 2 - gapHalf, statsHeaderY);
        leftGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        leftGrad.addColorStop(1, opt.color);
        this.ctx.strokeStyle = leftGrad;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(rect.x + 18, statsHeaderY);
        this.ctx.lineTo(rect.x + rect.width / 2 - gapHalf, statsHeaderY);
        this.ctx.stroke();

        const rightGrad = this.ctx.createLinearGradient(rect.x + rect.width / 2 + gapHalf, statsHeaderY, rect.x + rect.width - 18, statsHeaderY);
        rightGrad.addColorStop(0, opt.color);
        rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.strokeStyle = rightGrad;
        this.ctx.beginPath();
        this.ctx.moveTo(rect.x + rect.width / 2 + gapHalf, statsHeaderY);
        this.ctx.lineTo(rect.x + rect.width - 18, statsHeaderY);
        this.ctx.stroke();

        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = opt.color;
        this.ctx.fillText(headerLabel, rect.x + rect.width / 2, statsHeaderY + 3);

        // Resplandor abierto sin borde para destacar los cambios numéricos
        const openGlow = this.ctx.createLinearGradient(rect.x + 16, 0, rect.x + rect.width - 16, 0);
        openGlow.addColorStop(0, isHovered ? 'rgba(0, 255, 136, 0.09)' : 'rgba(0, 255, 136, 0.04)');
        openGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = openGlow;
        this.ctx.fillRect(rect.x + 16, statsHeaderY + 14, rect.width - 32, 86);

        // Calcular ancho máximo de cifras para alinear limpiamente todas las columnas
        this.ctx.font = `bold 15px ${FONT_MONO}`;
        let maxDeltaW = 0;
        for (const r of statRows) {
          if (r.delta) {
            maxDeltaW = Math.max(maxDeltaW, this.ctx.measureText(r.delta).width);
          }
        }

        const rowAnchorX = rect.x + 30;
        const deltaX = rowAnchorX + 18;
        const alignedLabelX = maxDeltaW > 0 ? deltaX + maxDeltaW + 12 : deltaX;
        const midStatY = rect.y + 211;
        const rowStep = statRows.length >= 3 ? 25 : 29;
        const firstRowY = midStatY - ((statRows.length - 1) * rowStep) / 2;

        for (let rIdx = 0; rIdx < statRows.length; rIdx++) {
          const row = statRows[rIdx];
          const ry = firstRowY + rIdx * rowStep;
          const accent =
            row.trend === 'UP'
              ? '#00ff88'
              : row.trend === 'DOWN'
              ? '#38bdf8'
              : '#fbbf24';

          // Símbolo geométrico vectorial limpio (▲ / ▼ / ◆)
          this.ctx.fillStyle = accent;
          this.ctx.shadowColor = accent;
          this.ctx.shadowBlur = isHovered ? 10 : 5;
          this.ctx.beginPath();
          if (row.trend === 'UP') {
            this.ctx.moveTo(rowAnchorX, ry - 4.5);
            this.ctx.lineTo(rowAnchorX + 5, ry + 4.5);
            this.ctx.lineTo(rowAnchorX - 5, ry + 4.5);
          } else if (row.trend === 'DOWN') {
            this.ctx.moveTo(rowAnchorX, ry + 4.5);
            this.ctx.lineTo(rowAnchorX + 5, ry - 4.5);
            this.ctx.lineTo(rowAnchorX - 5, ry - 4.5);
          } else {
            this.ctx.moveTo(rowAnchorX, ry - 5);
            this.ctx.lineTo(rowAnchorX + 5, ry);
            this.ctx.lineTo(rowAnchorX, ry + 5);
            this.ctx.lineTo(rowAnchorX - 5, ry);
          }
          this.ctx.closePath();
          this.ctx.fill();

          this.ctx.textAlign = 'left';
          if (row.delta) {
            this.ctx.font = `bold 15px ${FONT_MONO}`;
            this.ctx.fillStyle = accent;
            this.ctx.fillText(row.delta, deltaX, ry + 4.5);
          }

          // Nombre del atributo con auto-fit seguro
          this.ctx.shadowBlur = 0;
          const lblStartX = row.delta ? alignedLabelX : deltaX;
          const lblMaxW = rect.x + rect.width - 20 - lblStartX;
          let lblFont = 13.5;
          this.ctx.font = `bold ${lblFont}px ${FONT_DISPLAY}`;
          const lblW = this.ctx.measureText(row.label).width;
          if (lblW > lblMaxW) {
            lblFont = Math.max(10.5, Math.floor(13.5 * (lblMaxW / lblW)));
            this.ctx.font = `bold ${lblFont}px ${FONT_DISPLAY}`;
          }
          this.ctx.fillStyle = '#f8fafc';
          this.ctx.fillText(row.label, lblStartX, ry + 4.5);
        }

        this.ctx.restore();
      }

      // Pie de tarjeta limpio
      const footY = rect.y + rect.height - 42;
      const footGrad = this.ctx.createLinearGradient(rect.x + 28, footY, rect.x + rect.width - 28, footY);
      footGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      footGrad.addColorStop(0.5, isHovered ? '#ffffff' : opt.color);
      footGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.strokeStyle = footGrad;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(rect.x + 28, footY);
      this.ctx.lineTo(rect.x + rect.width - 28, footY);
      this.ctx.stroke();

      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = isHovered ? '#ffffff' : opt.color;
      this.ctx.font = `bold 13.5px ${FONT_DISPLAY}`;
      this.ctx.fillText(
        opt.isEvolution
          ? `★ ${i18n.t('EVOLUCIONAR ARMA', 'EVOLVE WEAPON')} [${i + 1}]`
          : `▸ ${i18n.t('SELECCIONAR TARJETA', 'SELECT CARD')} [${i + 1}]`,
        rect.x + rect.width / 2,
        rect.y + rect.height - 18
      );

      this.ctx.restore();
    }

    // Botón de Reroll (3 por partida) debajo de las tarjetas
    const rerollBtn = this.getRerollButtonRect();
    const canReroll =
      this.upgradeSystem.rerollsRemaining > 0 && !choices[0]?.isCompanionBranchCard;
    this.drawClippedButton(
      rerollBtn,
      !canReroll
        ? 'rgba(15, 23, 42, 0.7)'
        : this.hoveredRerollBtn
        ? 'rgba(72, 46, 12, 0.96)'
        : 'rgba(26, 20, 12, 0.95)',
      !canReroll ? '#475569' : this.hoveredRerollBtn ? '#ffffff' : '#fbbf24',
      this.hoveredRerollBtn && canReroll ? 2.4 : 1.6,
      !canReroll ? '#64748b' : this.hoveredRerollBtn ? '#ffffff' : '#fde68a',
      13.5,
      `🎲 [R] ${i18n.t('RELANZAR OPCIONES', 'REROLL CARDS')} (${this.upgradeSystem.rerollsRemaining}/3)`
    );

    this.ctx.restore();
  }

  private drawDailyMissionsOverlay(): void {
    this.dailyMissions.ensureTodayMissions();
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;
    const panelW = 780;
    const panelH = 500;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 9, 18, 0.9)';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    this.drawCyberPanel(
      px,
      py,
      panelW,
      panelH,
      14,
      'rgba(11, 19, 34, 0.98)',
      '#f59e0b',
      2.2,
      '#f59e0b',
      14
    );

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#fde047';
    this.ctx.font = `bold 23px ${FONT_DISPLAY}`;
    this.ctx.fillText(
      `★ ${i18n.t('MISIONES DIARIAS DEL PROTOCOLO', 'DAILY PROTOCOL MISSIONS')} (${this.dailyMissions.getCompletedCount()}/3)`,
      cx,
      py + 42
    );

    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = `12px ${FONT_MONO}`;
    this.ctx.fillText(
      i18n.t(
        `Se reinician automáticamente en: ${this.dailyMissions.getTimeUntilResetText()}  •  Recompensas automáticas`,
        `Auto-resets in: ${this.dailyMissions.getTimeUntilResetText()}  •  Auto-credited CryptoCoins`
      ),
      cx,
      py + 68
    );

    const cardW = panelW - 72;
    const cardH = 96;
    const cardX = cx - cardW / 2;
    const startY = py + 96;

    for (let i = 0; i < this.dailyMissions.missions.length; i++) {
      const m = this.dailyMissions.missions[i];
      const y = startY + i * (cardH + 14);
      this.drawCyberPanel(
        cardX,
        y,
        cardW,
        cardH,
        10,
        m.completed ? 'rgba(6, 52, 42, 0.94)' : 'rgba(15, 24, 42, 0.94)',
        m.completed ? '#10b981' : '#f59e0b',
        m.completed ? 2.0 : 1.5
      );

      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = m.completed ? '#6ee7b7' : '#ffffff';
      this.ctx.font = `bold 15px ${FONT_DISPLAY}`;
      this.ctx.fillText(
        `${m.completed ? '✓' : '▸'} ${i18n.currentLang === 'EN' ? m.titleEn : m.title}`,
        cardX + 20,
        y + 30
      );

      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.font = `12.5px ${FONT_DISPLAY}`;
      this.ctx.fillText(
        i18n.currentLang === 'EN' ? m.descriptionEn : m.description,
        cardX + 20,
        y + 53
      );

      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = m.completed ? '#10b981' : '#fbbf24';
      this.ctx.font = `bold 14px ${FONT_MONO}`;
      this.ctx.fillText(`+${m.rewardCoins} CR`, cardX + cardW - 20, y + 30);

      const barX = cardX + 20;
      const barY = y + 68;
      const barW = cardW - 150;
      const barH = 10;
      const ratio = Math.min(1, m.current / Math.max(1, m.target));
      this.ctx.fillStyle = 'rgba(7, 11, 20, 0.95)';
      this.ctx.fillRect(barX, barY, barW, barH);
      this.ctx.fillStyle = m.completed ? '#10b981' : '#f59e0b';
      this.ctx.fillRect(barX, barY, barW * ratio, barH);

      this.ctx.fillStyle = m.completed ? '#6ee7b7' : '#fde68a';
      this.ctx.font = `bold 11.5px ${FONT_MONO}`;
      this.ctx.fillText(
        m.completed ? i18n.t('COMPLETA', 'COMPLETED') : `${Math.floor(m.current)}/${m.target}`,
        cardX + cardW - 20,
        y + 77
      );
    }

    const backBtn = this.getOverlayBackButtonRect(py, panelH);
    this.drawClippedButton(
      backBtn,
      this.hoveredOverlayBackBtn ? 'rgba(6, 78, 59, 0.96)' : 'rgba(15, 25, 44, 0.95)',
      this.hoveredOverlayBackBtn ? '#ffffff' : '#10b981',
      this.hoveredOverlayBackBtn ? 2.4 : 1.8,
      this.hoveredOverlayBackBtn ? '#ffffff' : '#a7f3d0',
      13.5,
      `[ESC / CLICK] ${i18n.t('VOLVER AL HANGAR', 'RETURN TO HANGAR')}`
    );
    this.ctx.restore();
  }

  private drawNightmareMinimap(): void {
    const size = 166;
    const x = LOGICAL_WIDTH - size - 16;
    const y = 104;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const radarRange = 2000;
    const scale = (size * 0.45) / radarRange;
    const isNightmare = this.isNightmareRun;
    const accentBorder = isNightmare ? 'rgba(244, 63, 94, 0.72)' : 'rgba(56, 189, 248, 0.76)';
    const gridStroke = isNightmare ? 'rgba(244, 63, 94, 0.16)' : 'rgba(56, 189, 248, 0.18)';

    this.ctx.save();
    this.drawCyberPanel(
      x,
      y,
      size,
      size,
      10,
      'rgba(8, 13, 24, 0.88)',
      accentBorder,
      1.6
    );
    this.traceChamferRect(x + 2, y + 2, size - 4, size - 4, 8);
    this.ctx.clip();

    // Retícula radar
    this.ctx.strokeStyle = gridStroke;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, y);
    this.ctx.lineTo(cx, y + size);
    this.ctx.moveTo(x, cy);
    this.ctx.lineTo(x + size, cy);
    this.ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
    this.ctx.stroke();

    // Oasis dinámicos activos (rombos esmeralda)
    const oases = this.worldEnv.getAllActiveOases();
    const maxR = size * 0.44;
    for (const oasis of oases) {
      const dx = (oasis.x - this.player.x) * scale;
      const dy = (oasis.y - this.player.y) * scale;
      const d = Math.hypot(dx, dy);
      const ox = d > maxR ? cx + (dx / d) * maxR : cx + dx;
      const oy = d > maxR ? cy + (dy / d) * maxR : cy + dy;
      this.ctx.fillStyle = '#10b981';
      this.ctx.beginPath();
      this.ctx.moveTo(ox, oy - 4.2);
      this.ctx.lineTo(ox + 4.2, oy);
      this.ctx.lineTo(ox, oy + 4.2);
      this.ctx.lineTo(ox - 4.2, oy);
      this.ctx.closePath();
      this.ctx.fill();
    }

    // Eventos de Terreno en el minimapa (local/host o guest desde snapshot)
    const isGuestCoop = this.isCoopMode && !this.isCoopHost;
    if (isGuestCoop) {
      const zoneColors: Record<number, string> = {
        1: '#38bdf8',
        2: '#a855f7',
        3: '#fbbf24',
        4: '#ff1e42',
      };
      for (const z of this.coopSnapshot?.zones || []) {
        if (z[0] < 1) continue;
        const dx = (z[1] - this.player.x) * scale;
        const dy = (z[2] - this.player.y) * scale;
        const d = Math.hypot(dx, dy);
        const px = d > maxR ? cx + (dx / d) * maxR : cx + dx;
        const py = d > maxR ? cy + (dy / d) * maxR : cy + dy;
        this.ctx.fillStyle = zoneColors[z[0]] || '#38bdf8';
        this.ctx.beginPath();
        this.ctx.arc(px, py, z[0] === 4 ? 4.2 : 3.4, 0, Math.PI * 2);
        this.ctx.fill();
      }
    } else {
      for (const node of this.terrainEvents.nodes) {
        if (!node.active) continue;
        const dx = (node.x - this.player.x) * scale;
        const dy = (node.y - this.player.y) * scale;
        const d = Math.hypot(dx, dy);
        const px = d > maxR ? cx + (dx / d) * maxR : cx + dx;
        const py = d > maxR ? cy + (dy / d) * maxR : cy + dy;

        this.ctx.fillStyle = this.terrainEvents.getColorForType(node.type);
        this.ctx.beginPath();
        this.ctx.arc(px, py, node.type === 'DATA_STORM' ? 4.2 : 3.6, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Enemigos, Cajas, Mineros y Jefes
    let regularCount = 0;
    if (isGuestCoop) {
      for (const e of this.coopSnapshot?.enemies || []) {
        const typeCode = e[0];
        const dx = (e[1] - this.player.x) * scale;
        const dy = (e[2] - this.player.y) * scale;
        const d = Math.hypot(dx, dy);
        const isBoss = typeCode === 7 || typeCode === 8 || typeCode === 9;
        const isMiner = typeCode === 5;
        const isBox = typeCode === 6;
        if (d > maxR && !isBoss && !isMiner) continue;
        const mx = d > maxR ? cx + (dx / d) * maxR : cx + dx;
        const my = d > maxR ? cy + (dy / d) * maxR : cy + dy;
        if (isBoss) {
          this.ctx.fillStyle = '#ff1e42';
          this.ctx.fillRect(mx - 4, my - 4, 8, 8);
        } else if (isMiner) {
          this.ctx.fillStyle = '#fbbf24';
          this.ctx.fillRect(mx - 3, my - 3, 6, 6);
        } else if (isBox) {
          this.ctx.fillStyle = '#38bdf8';
          this.ctx.fillRect(mx - 2, my - 2, 4, 4);
        } else if (regularCount < 85) {
          regularCount++;
          this.ctx.fillStyle = 'rgba(248, 113, 113, 0.72)';
          this.ctx.fillRect(mx - 1.2, my - 1.2, 2.4, 2.4);
        }
      }
    } else {
      for (const enemy of this.enemies) {
        if (!enemy.active) continue;
        const dx = (enemy.x - this.player.x) * scale;
        const dy = (enemy.y - this.player.y) * scale;
        const d = Math.hypot(dx, dy);

        const isBoss = enemy.malwareType === 'RANSOMWARE' || enemy.malwareType === 'FINAL_BOSS';
        const isMiner = enemy.malwareType === 'CRYPTO_MINER';
        const isBox = enemy.malwareType === 'HARDWARE_BOX';

        if (d > maxR && !isBoss && !isMiner) continue;
        const mx = d > maxR ? cx + (dx / d) * maxR : cx + dx;
        const my = d > maxR ? cy + (dy / d) * maxR : cy + dy;

        if (isBoss) {
          this.ctx.fillStyle = '#ff1e42';
          this.ctx.fillRect(mx - 4, my - 4, 8, 8);
        } else if (isMiner) {
          this.ctx.fillStyle = '#fbbf24';
          this.ctx.fillRect(mx - 3, my - 3, 6, 6);
        } else if (isBox) {
          this.ctx.fillStyle = '#38bdf8';
          this.ctx.fillRect(mx - 2, my - 2, 4, 4);
        } else if (regularCount < 85) {
          regularCount++;
          this.ctx.fillStyle = 'rgba(248, 113, 113, 0.72)';
          this.ctx.fillRect(mx - 1.2, my - 1.2, 2.4, 2.4);
        }
      }
    }

    // Aliados Co-op en el minimapa (fijados al borde si están lejos)
    if (this.isCoopMode) {
      const peersPos = this.isCoopHost
        ? Array.from(this.coopPeers.values()).map((p) => ({
            x: p.player.x,
            y: p.player.y,
            color: p.downed ? '#f43f5e' : p.slotColor,
            downed: p.downed,
          }))
        : (this.coopSnapshot?.players || [])
            .filter((p) => p.id !== this.mpClient.myId)
            .map((p) => ({
              x: p.x,
              y: p.y,
              color: p.downed ? '#f43f5e' : p.color,
              downed: p.downed,
            }));
      for (const ally of peersPos) {
        const dx = (ally.x - this.player.x) * scale;
        const dy = (ally.y - this.player.y) * scale;
        const d = Math.hypot(dx, dy);
        const ax = d > maxR ? cx + (dx / d) * maxR : cx + dx;
        const ay = d > maxR ? cy + (dy / d) * maxR : cy + dy;
        this.ctx.fillStyle = ally.color;
        this.ctx.beginPath();
        this.ctx.arc(ax, ay, ally.downed ? 4.4 : 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
    }

    // Jugador local siempre en el centro
    this.ctx.fillStyle = '#10b981';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.2;
    this.ctx.stroke();

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = isNightmare ? '#fda4af' : '#7dd3fc';
    this.ctx.font = `bold 9.5px ${FONT_MONO}`;
    this.ctx.fillText(isNightmare ? 'RADAR // PESADILLA' : 'RADAR // CO-OP', x + 8, y + 14);
    this.ctx.restore();
  }

  private drawTouchJoystick(): void {
    if (this.gameState !== 'PLAYING' || this.isPaused || this.upgradeSystem.isChoosingUpgrade()) {
      return;
    }
    const joy = this.input.getJoystickState();
    if (!joy.active) {
      if (this.input.hasUsedTouch && this.elapsedTime < 8) {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        this.ctx.fillStyle = 'rgba(11, 19, 34, 0.45)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(150, LOGICAL_HEIGHT - 165, 58, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(186, 230, 253, 0.75)';
        this.ctx.font = `bold 11px ${FONT_MONO}`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(i18n.t('DESLIZA PARA MOVER', 'DRAG TO MOVE'), 150, LOGICAL_HEIGHT - 161);
        this.ctx.restore();
      }
      return;
    }

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(11, 19, 34, 0.48)';
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
    this.ctx.lineWidth = 2.4;
    this.ctx.beginPath();
    this.ctx.arc(joy.originX, joy.originY, joy.maxRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(joy.thumbX, joy.thumbY, 26, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  private wrapText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number = 4
  ): void {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    let linesDrawn = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = this.ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        if (linesDrawn + 1 >= maxLines) {
          let trunc = line.trimEnd();
          while (trunc.length > 0 && this.ctx.measureText(trunc + '…').width > maxWidth) {
            trunc = trunc.slice(0, -1);
          }
          this.ctx.fillText(trunc + '…', x, currentY);
          return;
        }
        this.ctx.fillText(line.trimEnd(), x, currentY);
        linesDrawn++;
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (linesDrawn < maxLines) {
      let finalLine = line.trimEnd();
      while (finalLine.length > 0 && this.ctx.measureText(finalLine).width > maxWidth) {
        finalLine = finalLine.slice(0, -1);
      }
      this.ctx.fillText(finalLine, x, currentY);
    }
  }

  private drawSystemFailureOverlay(): void {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(7, 10, 18, 0.9)';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const boxW = 880;
    const boxH = 580;
    this.drawCyberPanel(
      cx - boxW / 2,
      cy - boxH / 2,
      boxW,
      boxH,
      16,
      'rgba(14, 16, 28, 0.98)',
      '#f43f5e',
      2.4,
      '#f43f5e',
      20
    );

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#fb7185';
    this.ctx.font = `bold 29px ${FONT_DISPLAY}`;
    this.ctx.fillText('KERNEL PANIC // SYSTEM COMPROMISED', cx, cy - 235);

    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = `bold 13.5px ${FONT_MONO}`;
    this.ctx.fillText(
      `${i18n.t('Agente', 'Agent')}: ${this.player.profileName} (v${this.upgradeSystem.level}.0)  •  ${i18n.t('Tiempo', 'Time')}: ${this.formatTimeMMSS(this.elapsedTime)}  •  ${i18n.t('Bajas', 'Kills')}: ${this.killCount}  •  ${i18n.t('Cripto', 'Crypto')}: +${this.runCoinsCollected} CR`,
      cx,
      cy - 200
    );

    if (this.runDamageToToro > 0) {
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.font = `bold 14px ${FONT_MONO}`;
      this.ctx.fillText(
        `${i18n.t('DAÑO AL JEFE FINAL (EL TORO)', 'DAMAGE TO FINAL BOSS (EL TORO)')}: ${this.runDamageToToro.toLocaleString('en-US')} DMG`,
        cx,
        cy - 176
      );
    }

    const subW = 405;
    const hasCoopMvp = this.isCoopMode && this.coopGameOverSquad.length > 0;
    if (hasCoopMvp) {
      // Tabla MVP del Escuadrón Co-op (Daño total, Mejor arma, Reanimaciones y Medallas)
      const mvpX = cx - subW - 12;
      const mvpY = cy - 166;
      const mvpW = subW * 2 + 24;
      const mvpH = 98;
      this.ctx.save();
      this.drawCyberPanel(mvpX, mvpY, mvpW, mvpH, 10, 'rgba(11, 20, 36, 0.96)', '#fbbf24', 1.6);
      this.traceChamferRect(mvpX + 2, mvpY + 2, mvpW - 4, mvpH - 4, 8);
      this.ctx.clip();

      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = '#fde047';
      this.ctx.font = `bold 12px ${FONT_MONO}`;
      this.ctx.fillText(
        i18n.t(
          '★ CLASIFICACIÓN DEL ESCUADRÓN CO-OP (MVP DAÑO Y RESCATES)',
          '★ CO-OP SQUAD LEADERBOARD (DAMAGE MVP & REVIVES)'
        ),
        mvpX + 16,
        mvpY + 20
      );

      const bestRevives = Math.max(0, ...this.coopGameOverSquad.map((s) => s.revives));
      const colW = (mvpW - 24) / Math.max(1, Math.min(4, this.coopGameOverSquad.length));
      for (let idx = 0; idx < Math.min(4, this.coopGameOverSquad.length); idx++) {
        const sq = this.coopGameOverSquad[idx];
        const sx = mvpX + 12 + idx * colW;
        const sy = mvpY + 30;
        const isTopDmg = idx === 0 && sq.totalDamage > 0;
        const isTopMedic = bestRevives > 0 && sq.revives === bestRevives;

        this.ctx.fillStyle = 'rgba(15, 25, 44, 0.92)';
        this.ctx.fillRect(sx + 4, sy, colW - 8, 58);
        this.ctx.fillStyle = sq.color;
        this.ctx.fillRect(sx + 4, sy, 4, 58);

        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#f8fafc';
        this.ctx.font = `bold 11.5px ${FONT_DISPLAY}`;
        const badge = isTopDmg ? '★ MVP ' : isTopMedic ? '✚ MED ' : '';
        this.ctx.fillText(`${badge}J${sq.slot + 1} ${sq.name}`, sx + 13, sy + 16, colW - 22);

        this.ctx.fillStyle = '#38bdf8';
        this.ctx.font = `bold 11px ${FONT_MONO}`;
        this.ctx.fillText(
          `${sq.totalDamage.toLocaleString('en-US')} DMG  •  ✚${sq.revives}`,
          sx + 13,
          sy + 34,
          colW - 22
        );

        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = `10px ${FONT_DISPLAY}`;
        this.ctx.fillText(sq.topWeapon, sx + 13, sy + 50, colW - 22);
      }
      this.ctx.restore();
    }

    const panelY = hasCoopMvp ? cy - 58 : cy - 150;
    const subW2 = 405;
    const subH = hasCoopMvp ? 276 : 320;
    const rowStepWep = hasCoopMvp ? 35 : 42;
    const rowStepEn = hasCoopMvp ? 33 : 40;
    const leftX = cx - subW2 - 12;
    const rightX = cx + 12;

    this.ctx.save();
    this.drawCyberPanel(leftX, panelY, subW, subH, 10, 'rgba(11, 18, 32, 0.95)', '#f43f5e', 1.5);
    this.traceChamferRect(leftX + 2, panelY + 2, subW - 4, subH - 4, 8);
    this.ctx.clip();

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#fb7185';
    this.ctx.font = `bold 13.5px ${FONT_DISPLAY}`;
    this.ctx.fillText(i18n.t('RENDIMIENTO DE ARSENAL (DAÑO)', 'ARSENAL PERFORMANCE (DAMAGE)'), leftX + 16, panelY + 28);

    const weaponDamages = Object.entries(this.combatSystem.weaponDamageStats)
      .filter(([_, dmg]) => dmg > 0)
      .map(([name, damage]) => ({ name, damage }))
      .sort((a, b) => b.damage - a.damage);
    const totalDmg = weaponDamages.reduce((sum, w) => sum + w.damage, 0) || 1;

    const rowColors = ['#10b981', '#38bdf8', '#fbbf24', '#f97316', '#c084fc', '#ec4899', '#a3e635'];

    if (weaponDamages.length === 0) {
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = `12.5px ${FONT_DISPLAY}`;
      this.ctx.fillText(i18n.t('Sin registros de daño con armas.', 'No weapon damage recorded.'), leftX + 16, panelY + 60);
    } else {
      for (let w = 0; w < Math.min(6, weaponDamages.length); w++) {
        const item = weaponDamages[w];
        const rowY = panelY + 50 + w * rowStepWep;
        const pct = Math.round((item.damage / totalDmg) * 100);
        const col = rowColors[w % rowColors.length];

        this.ctx.fillStyle = '#f8fafc';
        this.ctx.font = `bold 12px ${FONT_DISPLAY}`;
        this.ctx.fillText(item.name, leftX + 16, rowY + 12);

        this.ctx.textAlign = 'right';
        this.ctx.fillStyle = col;
        this.ctx.font = `bold 12px ${FONT_MONO}`;
        this.ctx.fillText(`${item.damage.toLocaleString('en-US')} (${pct}%)`, leftX + subW - 16, rowY + 12);

        this.ctx.textAlign = 'left';
        const barW = subW - 32;
        this.ctx.fillStyle = 'rgba(20, 30, 48, 0.95)';
        this.ctx.fillRect(leftX + 16, rowY + 17, barW, 7);
        this.ctx.fillStyle = col;
        this.ctx.fillRect(leftX + 16, rowY + 17, (item.damage / totalDmg) * barW, 7);
      }
    }
    this.ctx.restore();

    this.ctx.save();
    this.drawCyberPanel(rightX, panelY, subW, subH, 10, 'rgba(11, 18, 32, 0.95)', '#38bdf8', 1.5);
    this.traceChamferRect(rightX + 2, panelY + 2, subW - 4, subH - 4, 8);
    this.ctx.clip();

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#7dd3fc';
    this.ctx.font = `bold 13.5px ${FONT_DISPLAY}`;
    this.ctx.fillText(i18n.t('REGISTRO DE AMENAZAS PURGADAS', 'PURGED THREATS LOG'), rightX + 16, panelY + 28);

    const enemyRows = [
      { name: i18n.t('Adware Básico (Rojos)', 'Basic Adware (Red)'), count: this.combatSystem.killsByTypeStats['Adware'], color: '#ef4444' },
      { name: i18n.t('Troyanos Rápidos (Amarillos)', 'Fast Trojans (Yellow)'), count: this.combatSystem.killsByTypeStats['Trojan'], color: '#eab308' },
      { name: i18n.t('Gusanos Divisibles (Morados)', 'Splitting Worms (Purple)'), count: this.combatSystem.killsByTypeStats['Worm'], color: '#a855f7' },
      { name: i18n.t('Evasores (Ghost Scripts)', 'Evasors (Ghost Scripts)'), count: this.combatSystem.killsByTypeStats['Evasor'], color: '#06b6d4' },
      { name: i18n.t('Cajas de Hardware Destruidas', 'Hardware Crates Destroyed'), count: this.combatSystem.killsByTypeStats['Hardware Box'], color: '#f97316' },
      { name: i18n.t('Jefes de Oleada Purgados', 'Wave Bosses Purged'), count: this.runBossesKilled, color: '#10b981' },
    ];

    for (let e = 0; e < enemyRows.length; e++) {
      const er = enemyRows[e];
      const rY = panelY + 54 + e * rowStepEn;

      this.ctx.fillStyle = er.color;
      this.ctx.fillRect(rightX + 16, rY + 3, 8, 8);

      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.font = `12.5px ${FONT_DISPLAY}`;
      this.ctx.fillText(er.name, rightX + 32, rY + 12);

      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.font = `bold 13px ${FONT_MONO}`;
      this.ctx.fillText(`${er.count}`, rightX + subW - 16, rY + 12);
      this.ctx.textAlign = 'left';
    }
    this.ctx.restore();

    for (const gBtn of this.getGameOverButtonRects()) {
      const hovered = this.hoveredGameOverBtn === gBtn.action;
      const isRetry = gBtn.action === 'RETRY';
      const col = isRetry ? '#10b981' : '#38bdf8';
      this.drawClippedButton(
        gBtn,
        hovered
          ? isRetry
            ? 'rgba(6, 62, 42, 0.96)'
            : 'rgba(14, 52, 82, 0.96)'
          : 'rgba(15, 25, 44, 0.94)',
        hovered ? '#ffffff' : col,
        hovered ? 2.2 : 1.5,
        hovered ? '#ffffff' : col,
        13,
        gBtn.label
      );
    }
    this.ctx.restore();
  }
}
