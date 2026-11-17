import { Input } from './Input';
import { SoundSystem } from './SoundSystem';
import { Entity } from '../entities/Entity';
import { Player } from '../entities/Player';
import { Adware } from '../entities/Adware';
import { Worm } from '../entities/Worm';
import { CryptoMiner } from '../entities/CryptoMiner';
import { WaveBoss, RansomwareBoss } from '../entities/WaveBoss';
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
import {
  MetaSystem,
  CharacterId,
  GameMode,
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
type MenuTab = 'SHOP' | 'GACHA' | 'INVENTORY';
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

export const LOGICAL_WIDTH = 1920;
export const LOGICAL_HEIGHT = 1080;

const GAME_VERSION = 'v1.3.0';
const FONT_DISPLAY = '"Segoe UI", "Inter", system-ui, -apple-system, sans-serif';
const FONT_MONO = '"JetBrains Mono", Consolas, monospace';
const LIGHT_GFX_STORAGE_KEY = 'cyber_survivor_light_gfx_v1';
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
  private hoveredHelpBtn: boolean = false;
  private hoveredOverlayBackBtn: boolean = false;
  private hoveredStartBtn: boolean = false;
  private hoveredLightGfxBtn: boolean = false;
  private hoveredDailyMissionsBtn: boolean = false;
  private showDailyMissionsOverlay: boolean = false;
  private hoveredRerollBtn: boolean = false;
  private hoveredModeBtn: GameMode | null = null;
  private selectedGameMode: GameMode = 'CLASSIC';
  private isNightmareRun: boolean = false;
  private lightGraphicsEnabled: boolean = false;
  private dailyMissions: DailyMissionSystem;
  private terrainEvents: TerrainEventSystem;
  private lastTouchTapTime: number = 0;
  private lastOverclockTier: number = 0;
  private lastStandardHealTier: number = 0;
  private runBossesKilled: number = 0;
  private runTotalDamageDealt: number = 0;
  public readonly firestoreDb = db;
  private menuFeedbackMessage: string = i18n.t(
    'Explora Agentes, Gacha (Tirada x1 / x10) e Inventario de Sombreros.',
    'Explore Agents, Gacha (Roll x1 / x10) & Hat Inventory.'
  );
  private damageVignetteAlpha: number = 0;
  private terminalLogs: string[] = [
    `> CYBER_SURVIVOR_KERNEL ${GAME_VERSION} online...`,
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
      this.lightGraphicsEnabled = localStorage.getItem(LIGHT_GFX_STORAGE_KEY) === '1';
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

  private getCameraOrigin(): { x: number; y: number } {
    if (!this.isNightmareRun || this.gameState === 'MENU') {
      return { x: 0, y: 0 };
    }
    return {
      x: this.player.x - LOGICAL_WIDTH / 2,
      y: this.player.y - LOGICAL_HEIGHT / 2,
    };
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

    window.addEventListener('keydown', (e) => {
      unlockAudio();
      const key = e.key.toLowerCase();

      if (key === 'v') {
        this.toggleLightGraphics();
        this.sound.playShoot(false);
        return;
      }

      if (key === 'm' && this.gameState !== 'MENU') {
        this.sound.muted = !this.sound.muted;
        this.addTerminalLog(`Audio Synthesizer: ${this.sound.muted ? 'MUTED' : 'ONLINE'}`);
      }

      if (key === 'f') {
        this.toggleFullscreen();
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

        if (this.showSettingsOverlay) {
          if (key === 'escape' || key === 'b' || key === 'o') {
            this.showSettingsOverlay = false;
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
        } else if (key === 'g') {
          this.activeMenuTab = 'GACHA';
        } else if (key === 'i') {
          this.activeMenuTab = 'INVENTORY';
          this.inventoryPage = 0;
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
          if (res.success) this.sound.playCoinPickup();
        } else if (key === 'enter' || key === ' ') {
          this.startNewRun();
        }
        return;
      }

      if (this.gameState === 'GAMEOVER') {
        if (key === 'r' || key === 'enter' || key === ' ') {
          this.startNewRun();
        } else if (key === 'escape' || key === 't') {
          this.exitToMainMenu();
        }
        return;
      }

      if (this.gameState === 'PLAYING' && !this.upgradeSystem.isChoosingUpgrade() && key === 'p') {
        this.togglePause();
        return;
      }

      if (this.isPaused) {
        if (this.showSettingsOverlay) {
          if (key === 'escape' || key === 'b' || key === 'o') {
            this.showSettingsOverlay = false;
            this.sound.playShoot(false);
          }
          return;
        }
        if (key === '1' || key === 'enter') {
          this.togglePause();
        } else if (key === 'o') {
          this.showSettingsOverlay = true;
          this.sound.playShoot(false);
        } else if (key === '2' || key === 'escape') {
          this.exitToMainMenu();
        }
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
          const panelH = 520;
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
        this.hoveredRankingsBtn = this.isPointInRect(mx, my, this.getGlobalRankingsButtonRect());
        this.hoveredDailyMissionsBtn = this.isPointInRect(
          mx,
          my,
          this.getDailyMissionsButtonRect()
        );
        this.hoveredAchievementsBtn = this.isPointInRect(mx, my, this.getAchievementsButtonRect());
        this.hoveredLightGfxBtn = this.isPointInRect(mx, my, this.getMenuLightGfxButtonRect());
        this.hoveredSettingsBtn = this.isPointInRect(mx, my, this.getSettingsButtonRect());
        this.hoveredFullscreenBtn = this.isPointInRect(mx, my, this.getFullscreenButtonRect());
        this.hoveredHelpBtn = this.isPointInRect(mx, my, this.getHelpButtonRect());
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
        this.hoveredPauseAction = null;
        for (const btn of this.getPauseButtonRects()) {
          if (this.isPointInRect(mx, my, btn)) {
            this.hoveredPauseAction = btn.action;
            break;
          }
        }
        return;
      }

      if (this.gameState !== 'PLAYING' || !this.upgradeSystem.isChoosingUpgrade()) {
        this.hoveredCardIndex = -1;
        this.hoveredRerollBtn = false;
        return;
      }

      this.hoveredCardIndex = -1;
      for (const card of this.getUpgradeCardRects()) {
        if (this.isPointInRect(mx, my, card)) {
          this.hoveredCardIndex = card.index;
          break;
        }
      }
      this.hoveredRerollBtn = this.isPointInRect(mx, my, this.getRerollButtonRect());
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
            if (this.isPointInRect(pt.x, pt.y, this.getInGameLightGfxButtonRect())) {
              this.toggleLightGraphics();
              this.sound.playShoot(false);
              this.lastTouchTapTime = performance.now();
              continue;
            }
            if (this.isPointInRect(pt.x, pt.y, this.getInGamePauseButtonRect())) {
              this.togglePause();
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
    if (chosen && this.upgradeSystem.selectUpgrade(index, this.player, this.combatSystem)) {
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
    }
  }

  private handleUpgradeReroll(): void {
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

      if (this.showSettingsOverlay) {
        this.handleSettingsClick(mx, my);
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

      if (this.isPointInRect(mx, my, this.getDailyMissionsButtonRect())) {
        this.showDailyMissionsOverlay = true;
        this.sound.playCoinPickup();
        return;
      }

      if (this.isPointInRect(mx, my, this.getMenuLightGfxButtonRect())) {
        this.toggleLightGraphics();
        this.sound.playShoot(false);
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

      if (this.isPointInRect(mx, my, this.getHelpButtonRect())) {
        this.showHelpOverlay = true;
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
      }
      return;
    }

    if (this.isPaused) {
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
      this.exitToMainMenu();
      return;
    }

    if (this.gameState === 'PLAYING' && !this.upgradeSystem.isChoosingUpgrade()) {
      if (this.isPointInRect(mx, my, this.getInGameLightGfxButtonRect())) {
        this.toggleLightGraphics();
        this.sound.playShoot(false);
        return;
      }
      if (this.isPointInRect(mx, my, this.getInGamePauseButtonRect())) {
        this.togglePause();
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

  private exitToMainMenu(): void {
    if (this.finalBoss) {
      this.runDamageToToro = Math.floor(this.finalBoss.totalDamageTaken);
    }
    this.metaSystem.updateHighScore(this.killCount, this.elapsedTime, this.runDamageToToro);
    this.achievementSystem.flushPendingSave(true);
    this.metaSystem.flushPendingSave();
    this.dailyMissions.flushPendingSave(true);
    this.highScoreKills = Math.max(this.highScoreKills, this.metaSystem.highScore);
    void this.metaSystem.syncToCloud(this.elapsedTime, this.runDamageToToro);
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
    this.combatSystem = new CombatSystem();
    if (profile.id === 'KERNEL_X') {
      this.combatSystem.multiShotCount += 1;
    }
    this.upgradeSystem = new UpgradeSystem();
    this.spawner = new Spawner();
    this.spawner.isNightmareMode = this.isNightmareRun;
    const cam = this.getCameraOrigin();
    this.spawner.spawnOpeningWave(this.enemies, LOGICAL_WIDTH, LOGICAL_HEIGHT, cam.x, cam.y);
    if (this.isNightmareRun) {
      this.terrainEvents.reset(this.player.x, this.player.y);
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
    const spawnX = this.isNightmareRun ? this.player.x : LOGICAL_WIDTH / 2;
    const spawnY = this.isNightmareRun
      ? this.player.y - 420
      : this.player.y > LOGICAL_HEIGHT * 0.45
      ? 120
      : LOGICAL_HEIGHT - 120;
    this.finalBoss = new ElToroBoss(spawnX, spawnY);
    this.finalBoss.unbounded = this.isNightmareRun;
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
    if (this.isPaused) {
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

    if (this.gameState !== 'PLAYING' || this.upgradeSystem.isChoosingUpgrade()) {
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

    this.player.update(
      dt,
      this.input,
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT,
      this.isNightmareRun,
      this.lightGraphicsEnabled
    );

    // Actualizar origen tras mover jugador para spawns y proyectiles centrados en Pesadilla
    const activeCam = this.getCameraOrigin();

    // Eventos de terreno en Modo Pesadilla
    if (this.isNightmareRun) {
      const tRes = this.terrainEvents.update(dt, this.player, this.elapsedTime);
      if (tRes.coolingActivated) {
        this.thermalOverclockTimer = Math.max(this.thermalOverclockTimer, 10.0);
        this.player.heal(20);
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
        if (sb.hitPlayer && this.player.takeDamage(22)) {
          this.particleSystem.triggerShake(9, 0.25);
          this.damageVignetteAlpha = 0.6;
          this.addTerminalLog('ALERT: Hit by Data Storm (-22 HP)!');
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

    this.spawner.update(
      dt,
      this.elapsedTime,
      this.upgradeSystem.level,
      this.enemies,
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT,
      activeCam.x,
      activeCam.y
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
      proj.update(dt, LOGICAL_WIDTH, LOGICAL_HEIGHT, activeCam.x, activeCam.y);
    }
    for (const ping of this.pingProjectiles) {
      ping.update(dt, this.enemies, LOGICAL_WIDTH, LOGICAL_HEIGHT, activeCam.x, activeCam.y);
    }
    for (const enemy of this.enemies) {
      if (isFrozen && !(enemy instanceof ElToroBoss)) {
        enemy.networkFreezeTimer = 0.2;
      } else {
        enemy.update(dt, this.player);
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
      activeCam.y
    );

    if (this.player.companion && this.player.active) {
      const compEvents = this.player.companion.update(
        dt,
        this.player,
        this.upgradeSystem.level,
        this.enemies,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
        cam.x,
        cam.y
      );
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
    }
    const killMilestone = Math.floor(this.killCount / 25);
    if (killMilestone > this.lastOverclockTier && this.player.active) {
      this.lastOverclockTier = killMilestone;
      if (this.player.characterId === 'OVERCLOCK') {
        this.player.triggerOverclockAdrenaline();
        this.particleSystem.spawnFloatingText(
          this.player.x,
          this.player.y - 34,
          '⚡ ¡SOBRECARGA ADRENALINA!',
          '#f97316',
          1.15
        );
      } else if (this.player.characterId === 'STANDARD') {
        this.player.heal(1);
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

    // Mecánica de Vampirismo / Robo de Ancho de Banda: 5% de probabilidad de activar curación al cumplir la condición de bajas
    const prevVampirismTier = Math.floor(prevKillCount / 20);
    const currentVampirismTier = Math.floor(this.killCount / 20);
    if (currentVampirismTier > prevVampirismTier && this.player.active) {
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
        this.player.heal(25);
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
        const dropChance = 0.06 + this.player.bonusCoinDropChance;
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
      this.addTerminalLog(`ALERT: Kernel integrity damaged! HP: ${this.player.hp}/${this.player.maxHp}`);

      if (!this.player.active) {
        this.gameState = 'GAMEOVER';
        this.sound.setTrack('NONE');
        if (this.finalBoss) {
          this.runDamageToToro = Math.floor(this.finalBoss.totalDamageTaken);
        }
        logAnalyticsEvent('level_end', {
          success: false,
          reason: 'killed_by_enemies',
          elapsed_seconds: Math.round(this.elapsedTime),
          kills: this.killCount,
          damage_to_toro: this.runDamageToToro,
          character: this.metaSystem.getSelectedProfile().name,
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
        return;
      }
    }

    for (const fragment of this.codeFragments) {
      if (!fragment.active) continue;
      fragment.update(dt, this.player);

      let collected = CombatSystem.checkAABBCollision(this.player, fragment);
      if (!collected && this.player.companion) {
        for (const unit of this.player.companion.getUnits()) {
          if (Math.hypot(unit.x - fragment.x, unit.y - fragment.y) <= unit.size + 16) {
            collected = true;
            break;
          }
        }
      }

      if (collected) {
        fragment.active = false;
        const gainedXp = Math.round(fragment.xpValue * this.player.xpMultiplier);

        this.particleSystem.spawnFloatingText(
          this.player.x,
          this.player.y - 18,
          `+${gainedXp} XP${this.player.xpMultiplier > 1 ? ` (x${this.player.xpMultiplier.toFixed(2)})` : ''}`,
          this.player.xpMultiplier > 1 ? '#a3e635' : '#00f0ff',
          0.9
        );

        const leveledUp = this.upgradeSystem.addXp(gainedXp, this.player);
        if (leveledUp) {
          this.addTerminalLog(`SYSTEM UPGRADE READY: Agent reached v${this.upgradeSystem.level}.0`);
        }
      }
    }

    for (const coin of this.cryptoCoins) {
      if (!coin.active) continue;
      coin.update(dt, this.player);

      let collected = CombatSystem.checkAABBCollision(this.player, coin);
      if (!collected && this.player.companion) {
        for (const unit of this.player.companion.getUnits()) {
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
          this.player.x,
          this.player.y - 28,
          `+${awarded} CRYPTO${this.isNightmareRun ? ' (x2)' : ''}`,
          '#fbbf24',
          1.0
        );
      }
    }

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      if (!p.active) continue;
      p.update(dt, this.player);

      if (CombatSystem.checkAABBCollision(this.player, p)) {
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
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i];
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
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
          } else if (b instanceof ElToroBoss) {
            a.x -= nx * overlap * 2;
            a.y -= ny * overlap * 2;
          } else {
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;
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
    // Tinte carmesí sutil en bordes para atmósfera Pesadilla
    this.ctx.fillStyle = 'rgba(127, 29, 29, 0.08)';
    this.ctx.fillRect(-24, -24, LOGICAL_WIDTH + 48, LOGICAL_HEIGHT + 48);
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

    if (this.isNightmareRun && this.gameState !== 'MENU') {
      this.drawInfiniteCyberGrid(cam.x, cam.y);
    } else {
      this.drawCyberGrid();
    }

    if (this.gameState !== 'MENU') {
      this.ctx.save();
      this.ctx.translate(-cam.x, -cam.y);

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

      for (const enemy of this.enemies) {
        enemy.draw(this.ctx);
      }

      this.drawEliteHpBars();

      if (this.player.active) {
        this.player.draw(this.ctx);
      }

      this.particleSystem.draw(this.ctx);

      if (this.showHitboxes) {
        this.drawDebugHitboxes();
      }

      this.ctx.restore();
    }

    this.ctx.restore();

    if (this.gameState === 'PLAYING') {
      this.drawOffScreenIndicators(cam.x, cam.y);
      if (this.systemFreezeTimer > 0) {
        this.drawFreezeOverlay();
      }
      if (this.thermalOverclockTimer > 0) {
        this.drawThermalOverclockIndicator();
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
      this.drawInGameQuickButtons();
      if (this.isNightmareRun) {
        this.drawNightmareMinimap();
      }
      this.drawTerminalLogBox();
      this.drawBossHUD();
      this.drawTouchJoystick();

      if (this.upgradeSystem.isChoosingUpgrade() && this.player.active) {
        this.drawUpgradeModal();
      }

      if (this.isPaused && this.gameState === 'PLAYING') {
        this.drawPauseMenuOverlay();
      }

      if (this.gameState === 'GAMEOVER') {
        this.drawSystemFailureOverlay();
      }
    }

    this.achievementSystem.drawToasts(this.ctx, LOGICAL_WIDTH);
    this.dailyMissions.drawToasts(this.ctx, LOGICAL_WIDTH);
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
        label: `> ${i18n.t('[1 / P] REANUDAR PARTIDA', '[1 / P] RESUME GAME')}`,
        x: cx - btnW / 2,
        y: cy - 35,
        width: btnW,
        height: btnH,
      },
      {
        action: 'SETTINGS',
        label: `> ${i18n.t('[O] AJUSTES Y VOLUMEN', '[O] SETTINGS & AUDIO')}`,
        x: cx - btnW / 2,
        y: cy + 20,
        width: btnW,
        height: btnH,
      },
      {
        action: 'EXIT_TO_MENU',
        label: `> ${i18n.t('[2 / ESC] SALIR AL MENÚ PRINCIPAL', '[2 / ESC] QUIT TO MAIN MENU')}`,
        x: cx - btnW / 2,
        y: cy + 75,
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

    const boxW = 500;
    const boxH = 320;
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
    this.ctx.fillText(i18n.t('SISTEMA EN PAUSA', 'SYSTEM PAUSED'), cx, cy - 94);

    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = `13px ${FONT_MONO}`;
    this.ctx.fillText(
      i18n.t('// Simulación y temporizadores en espera', '// Simulation & timers suspended'),
      cx,
      cy - 64
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

    if (this.showSettingsOverlay) {
      this.drawSettingsOverlay();
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
    // Filtro rojo suave sobre todo el Canvas durante los 15s de 'El Enjambre'
    const pulseAlpha = 0.12 + Math.sin(performance.now() * 0.008) * 0.04;
    this.ctx.fillStyle = `rgba(255, 15, 45, ${pulseAlpha})`;
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Alarma visual superior
    const blink = Math.floor(performance.now() / 280) % 2 === 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = blink ? '#ff1e42' : '#fde047';
    this.ctx.font = `bold 18px ${FONT_DISPLAY}`;
    this.ctx.fillText(
      i18n.t(
        `⚠️ ALERTA DE PLAGA: EL ENJAMBRE (${this.spawner.swarmActiveTimer.toFixed(1)}s) // ¡50 ENEMIGOS DETECTADOS! ⚠️`,
        `⚠️ PLAGUE ALERT: THE SWARM (${this.spawner.swarmActiveTimer.toFixed(1)}s) // 50 HOSTILES DETECTED! ⚠️`
      ),
      LOGICAL_WIDTH / 2,
      102
    );
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

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const isMiner = enemy instanceof CryptoMiner || enemy.malwareType === 'CRYPTO_MINER';
      const isElite =
        enemy.malwareType === 'RANSOMWARE' ||
        enemy.malwareType === 'FINAL_BOSS' ||
        enemy instanceof ArmoredWorm ||
        enemy instanceof Evasor;

      if (!isMiner && !isElite) continue;

      const screenX = enemy.x - camX;
      const screenY = enemy.y - camY;
      const isOffScreen = screenX < 0 || screenX > w || screenY < 0 || screenY > h;
      if (!isOffScreen) continue;

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
    grad.addColorStop(1, 'rgba(0, 200, 255, 0.28)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    this.ctx.font = 'bold 15px "JetBrains Mono", Consolas, monospace';
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      `❄ SISTEMA CONGELADO: ${this.systemFreezeTimer.toFixed(1)}s`,
      LOGICAL_WIDTH / 2,
      72
    );
    this.ctx.restore();
  }

  private drawThermalOverclockIndicator(): void {
    this.ctx.save();
    this.ctx.font = `bold 15px ${FONT_MONO}`;
    this.ctx.fillStyle = '#f97316';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      i18n.t(
        `⚡ OVERCLOCK TÉRMICO (x2 CADENCIA + 100% CRIT): ${this.thermalOverclockTimer.toFixed(1)}s`,
        `⚡ THERMAL OVERCLOCK (2x FIRE RATE + 100% CRIT): ${this.thermalOverclockTimer.toFixed(1)}s`
      ),
      LOGICAL_WIDTH / 2,
      110
    );
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
    const tabW = 242;
    const tabH = 38;
    const gap = 16;
    const totalW = tabW * 3 + gap * 2;
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
        tab: 'GACHA',
        label: `[G] ${i18n.t('BÓVEDA GACHA', 'GACHA VAULT')}`,
        x: startX + tabW + gap,
        y,
        width: tabW,
        height: tabH,
      },
      {
        tab: 'INVENTORY',
        label: `[I] ${i18n.t('INVENTARIO', 'INVENTORY')} (${this.metaSystem.unlockedHats.size}/${HATS_DATABASE.length})`,
        x: startX + (tabW + gap) * 2,
        y,
        width: tabW,
        height: tabH,
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
    const { py, leftCx } = this.getMenuLayout();
    const width = 580;
    const height = 48;
    return {
      x: leftCx - width / 2,
      y: py + 548,
      width,
      height,
    };
  }

  private getFullscreenButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 752,
      y: 26,
      width: 174,
      height: 44,
    };
  }

  private getHelpButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 936,
      y: 26,
      width: 126,
      height: 44,
    };
  }

  private getGlobalRankingsButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1072,
      y: 26,
      width: 130,
      height: 44,
    };
  }

  private getDailyMissionsButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1212,
      y: 26,
      width: 186,
      height: 44,
    };
  }

  private getAchievementsButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1408,
      y: 26,
      width: 186,
      height: 44,
    };
  }

  private getMenuLightGfxButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1604,
      y: 26,
      width: 146,
      height: 44,
    };
  }

  private getSettingsButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1760,
      y: 26,
      width: 128,
      height: 44,
    };
  }

  private getInGameLightGfxButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 386,
      y: 20,
      width: 176,
      height: 36,
    };
  }

  private getInGamePauseButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: LOGICAL_WIDTH - 110,
      y: 24,
      width: 84,
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
      | 'BACK';
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;
    const panelH = 520;
    const py = cy - panelH / 2;
    const rowStartY = py + 104;
    const rowGap = 50;
    const langY = py + 316;

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
      { id: 'BACK', x: cx - 160, y: py + panelH - 56, width: 320, height: 40 },
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
      shownHat?.id ?? null
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
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.font = `bold 10px ${FONT_MONO}`;
    this.ctx.fillText(`★ ${pPassiveName}`, cxBay, bayY + 244);

    // Barras de telemetría de unidad (incluyendo bonos del sombrero si aplican)
    const hpTotal = Math.round(100 * profile.hpMultiplier + (shownHat?.stats.maxHpBonus ?? 0));
    const spdPct = Math.round(profile.speedMultiplier * (1 + (shownHat?.stats.speedMult ?? 0)) * 100);
    const magTotal = Math.round(115 * profile.pickupRadiusMultiplier + (shownHat?.stats.magnetBonus ?? 0));

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

    const helpBtn = this.getHelpButtonRect();
    this.drawClippedButton(
      helpBtn,
      this.hoveredHelpBtn ? 'rgba(55, 22, 75, 0.96)' : 'rgba(20, 16, 38, 0.94)',
      this.hoveredHelpBtn ? '#ffffff' : '#c084fc',
      this.hoveredHelpBtn ? 2.2 : 1.5,
      this.hoveredHelpBtn ? '#ffffff' : '#e9d5ff',
      12,
      `[H] ${i18n.t('CÓMO JUGAR', 'HOW TO PLAY')}`,
      '#c084fc',
      this.hoveredHelpBtn ? 12 : 4
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

    const lightBtn = this.getMenuLightGfxButtonRect();
    this.drawClippedButton(
      lightBtn,
      this.lightGraphicsEnabled
        ? 'rgba(6, 62, 42, 0.96)'
        : this.hoveredLightGfxBtn
        ? 'rgba(14, 52, 82, 0.96)'
        : 'rgba(11, 22, 40, 0.94)',
      this.hoveredLightGfxBtn ? '#ffffff' : this.lightGraphicsEnabled ? '#10b981' : '#38bdf8',
      this.hoveredLightGfxBtn ? 2.2 : 1.5,
      this.lightGraphicsEnabled ? '#6ee7b7' : '#bae6fd',
      11,
      `[V] ${this.lightGraphicsEnabled ? i18n.t('LIGEROS: ON', 'LITE GFX: ON') : i18n.t('LIGEROS: OFF', 'LITE GFX: OFF')}`,
      this.lightGraphicsEnabled ? '#10b981' : '#38bdf8',
      this.hoveredLightGfxBtn ? 10 : 3
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
    this.ctx.fillText('CYBER SURVIVOR', px + 34, py + 44);

    const titleW = this.ctx.measureText('CYBER SURVIVOR').width;
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
          selected && equippedHat ? equippedHat.id : null
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
    let startFont = 15;
    const maxStartW = startBtn.width - 28;
    const startText = isNightmareSelected
      ? `▸ ${i18n.t(`DESPLEGAR EN PESADILLA (-${NIGHTMARE_ENTRY_COST} CR)`, `DEPLOY NIGHTMARE (-${NIGHTMARE_ENTRY_COST} CR)`)}`
      : `▸ ${i18n.t('PULSA [ENTER] O CLIC AQUÍ PARA DESPLEGAR', 'PRESS [ENTER] OR CLICK TO DEPLOY')}`;
    this.ctx.font = `bold ${startFont}px ${FONT_DISPLAY}`;
    const stMetrics = this.ctx.measureText(startText).width;
    if (stMetrics > maxStartW) {
      startFont = Math.max(11, Math.floor(15 * (maxStartW / stMetrics)));
      this.ctx.font = `bold ${startFont}px ${FONT_DISPLAY}`;
    }
    this.ctx.fillText(startText, leftCx, startBtn.y + 30);
    this.ctx.restore();

    if (this.showLeaderboardOverlay) {
      this.drawLeaderboardOverlay();
    } else if (this.showDailyMissionsOverlay) {
      this.drawDailyMissionsOverlay();
    } else if (this.showAchievementsOverlay) {
      this.drawAchievementsOverlay();
    } else if (this.showSettingsOverlay) {
      this.drawSettingsOverlay();
    } else if (this.showHelpOverlay) {
      this.drawHelpOverlay();
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
    const panelH = 520;
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
                '• [P]: Pause  |  [V]: Light Graphics  |  [R]: Reroll.',
                '• [M]: Daily Missions  |  [B]: Nightmare Infinite Mode.',
                '• [H]: Range Circle  |  Auto-fire targets threat.',
              ]
            : [
                '• [WASD / Flechas] o Joystick Táctil: Mover.',
                '• [P]: Pausa  |  [V]: Gráficos Ligeros  |  [R]: Reroll.',
                '• [M]: Misiones Diarias  |  [B]: Modo Pesadilla.',
                '• [H]: Círculo alcance  |  Disparo automático.',
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
    // 1. POD SUPERIOR IZQUIERDO: AGENTE, NIVEL, HP BAR Y ARSENAL
    // ==========================================
    const lx = 16;
    const ly = 18;
    const lw = 356;
    const lh = 76;
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
    const weaponsStatus = this.combatSystem.getActiveWeaponsList(this.player).join(' • ');
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
    this.ctx.restore();

    // ==========================================
    // 2. POD SUPERIOR DERECHO: CRONÓMETRO, BAJAS, CRIPTO Y OBJETIVO
    // ==========================================
    const rw = 326;
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
    this.ctx.moveTo(rx + 94, ry + 16);
    this.ctx.lineTo(rx + 99, ry + 21);
    this.ctx.lineTo(rx + 94, ry + 26);
    this.ctx.lineTo(rx + 89, ry + 21);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.fillStyle = '#fda4af';
    this.ctx.font = `bold 12px ${FONT_MONO}`;
    this.ctx.fillText(`${this.killCount}`, rx + 104, ry + 25);

    // Vector token de Cripto
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.beginPath();
    this.ctx.arc(rx + 170, ry + 21, 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#fde68a';
    this.ctx.fillText(`${this.runCoinsCollected} CR`, rx + 179, ry + 25);

    const pauseBtn = this.getInGamePauseButtonRect();
    this.drawClippedButton(
      pauseBtn,
      'rgba(30, 41, 59, 0.92)',
      'rgba(148, 163, 184, 0.55)',
      1.1,
      '#cbd5e1',
      10,
      `[P] ${i18n.t('PAUSA', 'PAUSE')}`
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

    this.ctx.restore();
  }

  private drawBossHUD(): void {
    this.ctx.save();
    this.ctx.textAlign = 'center';

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

    if (this.spawner.activeBossAlertTimer > 0) {
      const pulse = Math.floor(this.spawner.activeBossAlertTimer * 8) % 2 === 0;
      if (pulse) {
        const alertColor = this.spawner.lastBossSpawnedColor || '#f43f5e';
        this.ctx.fillStyle = alertColor;
        this.ctx.font = `bold 20px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          `ALERTA // ${this.spawner.lastBossSpawnedName} DETECTED`,
          LOGICAL_WIDTH / 2,
          104
        );
      }
    }

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

      // Cabecera: Etiqueta de categoría a la izquierda + rombos de nivel a la derecha
      this.ctx.shadowBlur = 0;
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = opt.color;
      const pipCount = Math.max(1, opt.maxLevel);
      const pipGap = 13;
      const firstPipX = rect.x + rect.width - 20 - (pipCount - 1) * pipGap;
      const catMaxW = Math.max(120, firstPipX - (rect.x + 28));
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
        const isOwned = p < opt.level;
        const isNext = p === opt.level;
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

  private drawInGameQuickButtons(): void {
    const lightBtn = this.getInGameLightGfxButtonRect();
    this.drawClippedButton(
      lightBtn,
      this.lightGraphicsEnabled ? 'rgba(6, 62, 42, 0.92)' : 'rgba(11, 19, 34, 0.88)',
      this.lightGraphicsEnabled ? '#10b981' : 'rgba(56, 189, 248, 0.6)',
      1.5,
      this.lightGraphicsEnabled ? '#6ee7b7' : '#bae6fd',
      11,
      `⚡ [V] ${this.lightGraphicsEnabled ? i18n.t('LIGEROS: ON', 'LITE: ON') : i18n.t('LIGEROS: OFF', 'LITE: OFF')}`
    );
  }

  private drawNightmareMinimap(): void {
    const size = 166;
    const x = LOGICAL_WIDTH - size - 16;
    const y = 104;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const radarRange = 2000;
    const scale = (size * 0.45) / radarRange;

    this.ctx.save();
    this.drawCyberPanel(
      x,
      y,
      size,
      size,
      10,
      'rgba(8, 13, 24, 0.88)',
      'rgba(244, 63, 94, 0.72)',
      1.6
    );
    this.traceChamferRect(x + 2, y + 2, size - 4, size - 4, 8);
    this.ctx.clip();

    // Retícula radar
    this.ctx.strokeStyle = 'rgba(244, 63, 94, 0.16)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, y);
    this.ctx.lineTo(cx, y + size);
    this.ctx.moveTo(x, cy);
    this.ctx.lineTo(x + size, cy);
    this.ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
    this.ctx.stroke();

    // Eventos de Terreno en el minimapa (si quedan fuera del radio, se fijan en el borde)
    for (const node of this.terrainEvents.nodes) {
      if (!node.active) continue;
      const dx = (node.x - this.player.x) * scale;
      const dy = (node.y - this.player.y) * scale;
      const maxR = size * 0.43;
      const d = Math.hypot(dx, dy);
      const px = d > maxR ? cx + (dx / d) * maxR : cx + dx;
      const py = d > maxR ? cy + (dy / d) * maxR : cy + dy;

      this.ctx.fillStyle = this.terrainEvents.getColorForType(node.type);
      this.ctx.beginPath();
      this.ctx.arc(px, py, node.type === 'DATA_STORM' ? 4.2 : 3.6, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Enemigos, Cajas, Mineros y Jefes
    let regularCount = 0;
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const dx = (enemy.x - this.player.x) * scale;
      const dy = (enemy.y - this.player.y) * scale;
      const maxR = size * 0.44;
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

    // Jugador en el centro
    this.ctx.fillStyle = '#10b981';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.2;
    this.ctx.stroke();

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#fda4af';
    this.ctx.font = `bold 9.5px ${FONT_MONO}`;
    this.ctx.fillText('RADAR // PESADILLA', x + 8, y + 14);
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

    const panelY = cy - 150;
    const subW = 405;
    const subH = 320;
    const leftX = cx - subW - 12;
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
        const rowY = panelY + 54 + w * 42;
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
        this.ctx.fillRect(leftX + 16, rowY + 18, barW, 8);
        this.ctx.fillStyle = col;
        this.ctx.fillRect(leftX + 16, rowY + 18, (item.damage / totalDmg) * barW, 8);
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
      const rY = panelY + 58 + e * 40;

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

    const blink = Math.floor(performance.now() / 450) % 2 === 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = blink ? '#38bdf8' : '#f8fafc';
    this.ctx.font = `bold 15px ${FONT_MONO}`;
    this.ctx.fillText(
      `[R / ENTER]: ${i18n.t('Reintentar Partida', 'Retry Run')}  •  [T / ESC / CLIC]: ${i18n.t('Ir al Hangar Principal', 'Main Hangar')}`,
      cx,
      cy + 242
    );
    this.ctx.restore();
  }
}
