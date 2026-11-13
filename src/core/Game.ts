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
import {
  MetaSystem,
  CharacterId,
  GACHA_PULL_SINGLE_COST,
  GACHA_PULL_TEN_COST,
  GachaPullEntry,
  LeaderboardEntry,
} from '../systems/MetaSystem';
import { HatItem, HATS_DATABASE, RARITY_CONFIG } from '../systems/HatSystem';
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

const GAME_VERSION = 'v1.1.17';
const FONT_DISPLAY = '"Segoe UI", "Trebuchet MS", system-ui, sans-serif';
const FONT_MONO = '"JetBrains Mono", Consolas, "Courier New", monospace';
export const FINAL_BOSS_ARRIVAL_TIME = 700; // 11 minutos y 40 segundos (~11-12 min)

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
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
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo inicializar el contexto 2D del Canvas.');
    }
    this.ctx = context;

    this.resize();
    window.addEventListener('resize', () => {
      this.resize();
    });

    this.input = new Input();
    this.sound = new SoundSystem();
    this.metaSystem = new MetaSystem();
    this.highScoreKills = this.metaSystem.highScore;
    this.player = new Player(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.metaSystem.getSelectedProfile(),
      this.metaSystem.getEquippedHat()
    );
    this.spawner = new Spawner();
    this.combatSystem = new CombatSystem();
    this.upgradeSystem = new UpgradeSystem();
    this.particleSystem = new ParticleSystem();
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
                this.canvas.width / 2,
                this.canvas.height / 2,
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

  private getCanvasMousePos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const canvasAspect = this.canvas.width / this.canvas.height;
    const rectAspect = rect.width / rect.height;

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

    const clientX = e.clientX - rect.left - offsetX;
    const clientY = e.clientY - rect.top - offsetY;

    return {
      x: Math.max(0, Math.min(this.canvas.width, clientX * (this.canvas.width / renderW))),
      y: Math.max(0, Math.min(this.canvas.height, clientY * (this.canvas.height / renderH))),
    };
  }

  private setupEventListeners(): void {
    const unlockAudio = () => {
      this.sound.ensureContext();
      if (this.gameState === 'MENU' && this.sound.getCurrentTrack() === 'NONE') {
        this.sound.setTrack('MENU');
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });

    window.addEventListener('keydown', (e) => {
      unlockAudio();
      const key = e.key.toLowerCase();

      if (key === 'm') {
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
        } else if (key === 'a') {
          this.showAchievementsOverlay = true;
          this.sound.playCoinPickup();
        } else if (key === 'o') {
          this.showSettingsOverlay = true;
          this.sound.playShoot(false);
        } else if (key === 'h') {
          this.showHelpOverlay = true;
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
          const idx = parseInt(key, 10) - 1;
          const chosen = this.upgradeSystem.currentChoices[idx];
          if (chosen && this.upgradeSystem.selectUpgrade(idx, this.player, this.combatSystem)) {
            this.sound.playCoinPickup();
            logAnalyticsEvent('select_content', {
              content_type: 'upgrade',
              item_id: chosen.id,
              item_name: chosen.name,
              level: chosen.level,
            });
            this.addTerminalLog(`INSTALLED: ${chosen.name} (v${chosen.level}.0)`);
            this.particleSystem.spawnExplosion(this.player.x, this.player.y, chosen.color, 24, true);
            this.hoveredCardIndex = -1;
          }
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

        if (this.showLeaderboardOverlay) {
          this.hoveredLeaderboardTab = null;
          for (const tabBtn of this.getLeaderboardTabRects()) {
            if (
              mx >= tabBtn.x &&
              mx <= tabBtn.x + tabBtn.width &&
              my >= tabBtn.y &&
              my <= tabBtn.y + tabBtn.height
            ) {
              this.hoveredLeaderboardTab = tabBtn.category;
              break;
            }
          }

          const backBtn = this.getLeaderboardBackButtonRect();
          this.hoveredLeaderboardBackBtn =
            mx >= backBtn.x &&
            mx <= backBtn.x + backBtn.width &&
            my >= backBtn.y &&
            my <= backBtn.y + backBtn.height;
          return;
        }

        if (this.showAchievementsOverlay) {
          const panelH = 650;
          const py = this.canvas.height / 2 - panelH / 2;
          const backBtn = this.getOverlayBackButtonRect(py, panelH);
          this.hoveredOverlayBackBtn =
            mx >= backBtn.x &&
            mx <= backBtn.x + backBtn.width &&
            my >= backBtn.y &&
            my <= backBtn.y + backBtn.height;
          this.hoveredAchievementsTab = null;
          for (const tab of this.getAchievementsTabRects(py)) {
            if (
              mx >= tab.x &&
              mx <= tab.x + tab.width &&
              my >= tab.y &&
              my <= tab.y + tab.height
            ) {
              this.hoveredAchievementsTab = tab.page;
              break;
            }
          }
          return;
        }

        if (this.showHelpOverlay) {
          const panelH = 590;
          const py = this.canvas.height / 2 - panelH / 2;
          const backBtn = this.getOverlayBackButtonRect(py, panelH);
          this.hoveredOverlayBackBtn =
            mx >= backBtn.x &&
            mx <= backBtn.x + backBtn.width &&
            my >= backBtn.y &&
            my <= backBtn.y + backBtn.height;
          return;
        }

        if (this.showSettingsOverlay) {
          const panelH = 520;
          const py = this.canvas.height / 2 - panelH / 2;
          const backBtn = this.getOverlayBackButtonRect(py, panelH);
          this.hoveredOverlayBackBtn =
            mx >= backBtn.x &&
            mx <= backBtn.x + backBtn.width &&
            my >= backBtn.y &&
            my <= backBtn.y + backBtn.height;
          return;
        }

        if (this.currentUser || this.isExternalLoginAllowed()) {
          const authBtn = this.getAuthActionButtonRect();
          this.hoveredAuthBtn =
            mx >= authBtn.x &&
            mx <= authBtn.x + authBtn.width &&
            my >= authBtn.y &&
            my <= authBtn.y + authBtn.height;
        } else {
          this.hoveredAuthBtn = false;
        }

        const rankingsBtn = this.getGlobalRankingsButtonRect();
        this.hoveredRankingsBtn =
          mx >= rankingsBtn.x &&
          mx <= rankingsBtn.x + rankingsBtn.width &&
          my >= rankingsBtn.y &&
          my <= rankingsBtn.y + rankingsBtn.height;

        const achBtn = this.getAchievementsButtonRect();
        this.hoveredAchievementsBtn =
          mx >= achBtn.x &&
          mx <= achBtn.x + achBtn.width &&
          my >= achBtn.y &&
          my <= achBtn.y + achBtn.height;

        const setBtn = this.getSettingsButtonRect();
        this.hoveredSettingsBtn =
          mx >= setBtn.x &&
          mx <= setBtn.x + setBtn.width &&
          my >= setBtn.y &&
          my <= setBtn.y + setBtn.height;

        const fsBtn = this.getFullscreenButtonRect();
        this.hoveredFullscreenBtn =
          mx >= fsBtn.x &&
          mx <= fsBtn.x + fsBtn.width &&
          my >= fsBtn.y &&
          my <= fsBtn.y + fsBtn.height;

        const helpBtn = this.getHelpButtonRect();
        this.hoveredHelpBtn =
          mx >= helpBtn.x &&
          mx <= helpBtn.x + helpBtn.width &&
          my >= helpBtn.y &&
          my <= helpBtn.y + helpBtn.height;

        const startBtn = this.getStartButtonRect();
        this.hoveredStartBtn =
          mx >= startBtn.x &&
          mx <= startBtn.x + startBtn.width &&
          my >= startBtn.y &&
          my <= startBtn.y + startBtn.height;

        if (this.activeMenuTab === 'SHOP') {
          for (const charRect of this.getMenuCharacterRects()) {
            if (
              mx >= charRect.x &&
              mx <= charRect.x + charRect.width &&
              my >= charRect.y &&
              my <= charRect.y + charRect.height
            ) {
              this.hoveredMenuChar = charRect.id;
              break;
            }
          }
        } else if (this.activeMenuTab === 'INVENTORY') {
          for (const slot of this.getInventoryHatRects()) {
            if (
              mx >= slot.x &&
              mx <= slot.x + slot.width &&
              my >= slot.y &&
              my <= slot.y + slot.height
            ) {
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
          if (
            mx >= btn.x &&
            mx <= btn.x + btn.width &&
            my >= btn.y &&
            my <= btn.y + btn.height
          ) {
            this.hoveredPauseAction = btn.action;
            break;
          }
        }
        return;
      }

      if (this.gameState !== 'PLAYING' || !this.upgradeSystem.isChoosingUpgrade()) {
        this.hoveredCardIndex = -1;
        return;
      }

      this.hoveredCardIndex = -1;
      for (const card of this.getUpgradeCardRects()) {
        if (
          mx >= card.x &&
          mx <= card.x + card.width &&
          my >= card.y &&
          my <= card.y + card.height
        ) {
          this.hoveredCardIndex = card.index;
          break;
        }
      }
    });

    this.canvas.addEventListener('click', (e) => {
      this.sound.ensureContext();
      if (this.gameState === 'MENU' && this.sound.getCurrentTrack() === 'NONE') {
        this.sound.setTrack('MENU');
      }

      const pos = this.getCanvasMousePos(e);
      const mx = pos.x;
      const my = pos.y;

      if (this.gameState === 'MENU') {
        if (this.showLeaderboardOverlay) {
          for (const tabBtn of this.getLeaderboardTabRects()) {
            if (
              mx >= tabBtn.x &&
              mx <= tabBtn.x + tabBtn.width &&
              my >= tabBtn.y &&
              my <= tabBtn.y + tabBtn.height
            ) {
              this.activeLeaderboardCategory = tabBtn.category;
              this.sound.playShoot(false);
              void this.refreshLeaderboards();
              return;
            }
          }

          const backBtn = this.getLeaderboardBackButtonRect();
          if (
            mx >= backBtn.x &&
            mx <= backBtn.x + backBtn.width &&
            my >= backBtn.y &&
            my <= backBtn.y + backBtn.height
          ) {
            this.showLeaderboardOverlay = false;
            this.sound.playShoot(false);
            return;
          }
          return;
        }

        if (this.showAchievementsOverlay) {
          const panelH = 650;
          const py = this.canvas.height / 2 - panelH / 2;
          const backBtn = this.getOverlayBackButtonRect(py, panelH);
          if (
            mx >= backBtn.x &&
            mx <= backBtn.x + backBtn.width &&
            my >= backBtn.y &&
            my <= backBtn.y + backBtn.height
          ) {
            this.showAchievementsOverlay = false;
            this.sound.playShoot(false);
            return;
          }
          for (const tab of this.getAchievementsTabRects(py)) {
            if (
              mx >= tab.x &&
              mx <= tab.x + tab.width &&
              my >= tab.y &&
              my <= tab.y + tab.height
            ) {
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
          const backBtn = this.getOverlayBackButtonRect(this.canvas.height / 2 - 295, 590);
          if (
            mx >= backBtn.x &&
            mx <= backBtn.x + backBtn.width &&
            my >= backBtn.y &&
            my <= backBtn.y + backBtn.height
          ) {
            this.showHelpOverlay = false;
            this.sound.playShoot(false);
          }
          return;
        }

        const achBtn = this.getAchievementsButtonRect();
        if (
          mx >= achBtn.x &&
          mx <= achBtn.x + achBtn.width &&
          my >= achBtn.y &&
          my <= achBtn.y + achBtn.height
        ) {
          this.showAchievementsOverlay = true;
          this.sound.playCoinPickup();
          return;
        }

        const setBtn = this.getSettingsButtonRect();
        if (
          mx >= setBtn.x &&
          mx <= setBtn.x + setBtn.width &&
          my >= setBtn.y &&
          my <= setBtn.y + setBtn.height
        ) {
          this.showSettingsOverlay = true;
          this.sound.playShoot(false);
          return;
        }

        const fsBtn = this.getFullscreenButtonRect();
        if (
          mx >= fsBtn.x &&
          mx <= fsBtn.x + fsBtn.width &&
          my >= fsBtn.y &&
          my <= fsBtn.y + fsBtn.height
        ) {
          this.toggleFullscreen();
          this.sound.playShoot(false);
          return;
        }

        const helpBtn = this.getHelpButtonRect();
        if (
          mx >= helpBtn.x &&
          mx <= helpBtn.x + helpBtn.width &&
          my >= helpBtn.y &&
          my <= helpBtn.y + helpBtn.height
        ) {
          this.showHelpOverlay = true;
          this.sound.playShoot(false);
          return;
        }

        if (this.currentUser || this.isExternalLoginAllowed()) {
          const authBtn = this.getAuthActionButtonRect();
          if (
            mx >= authBtn.x &&
            mx <= authBtn.x + authBtn.width &&
            my >= authBtn.y &&
            my <= authBtn.y + authBtn.height
          ) {
            this.handleAuthButtonClick();
            return;
          }
        }

        const rankingsBtn = this.getGlobalRankingsButtonRect();
        if (
          mx >= rankingsBtn.x &&
          mx <= rankingsBtn.x + rankingsBtn.width &&
          my >= rankingsBtn.y &&
          my <= rankingsBtn.y + rankingsBtn.height
        ) {
          this.openLeaderboardOverlay();
          return;
        }

        // Pestañas superiores del Menú Principal (AGENTES | GACHA | INVENTARIO)
        for (const tabRect of this.getMenuTabRects()) {
          if (
            mx >= tabRect.x &&
            mx <= tabRect.x + tabRect.width &&
            my >= tabRect.y &&
            my <= tabRect.y + tabRect.height
          ) {
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
            if (
              mx >= charRect.x &&
              mx <= charRect.x + charRect.width &&
              my >= charRect.y &&
              my <= charRect.y + charRect.height
            ) {
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
            if (
              mx >= pullBtn.x &&
              mx <= pullBtn.x + pullBtn.width &&
              my >= pullBtn.y &&
              my <= pullBtn.y + pullBtn.height
            ) {
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
                  this.canvas.width / 2,
                  this.canvas.height / 2 + 55,
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
            if (
              mx >= slot.x &&
              mx <= slot.x + slot.width &&
              my >= slot.y &&
              my <= slot.y + slot.height
            ) {
              const res = this.metaSystem.equipHat(slot.hat.id);
              this.menuFeedbackMessage = res.message;
              if (res.success) {
                this.sound.playCoinPickup();
              }
              return;
            }
          }

          for (const pageBtn of this.getInventoryPaginationRects()) {
            if (
              mx >= pageBtn.x &&
              mx <= pageBtn.x + pageBtn.width &&
              my >= pageBtn.y &&
              my <= pageBtn.y + pageBtn.height
            ) {
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

        const startBtn = this.getStartButtonRect();
        if (
          mx >= startBtn.x &&
          mx <= startBtn.x + startBtn.width &&
          my >= startBtn.y &&
          my <= startBtn.y + startBtn.height
        ) {
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
          if (
            mx >= btn.x &&
            mx <= btn.x + btn.width &&
            my >= btn.y &&
            my <= btn.y + btn.height
          ) {
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

      if (!this.upgradeSystem.isChoosingUpgrade()) return;

      for (const card of this.getUpgradeCardRects()) {
        if (
          mx >= card.x &&
          mx <= card.x + card.width &&
          my >= card.y &&
          my <= card.y + card.height
        ) {
          const chosen = this.upgradeSystem.currentChoices[card.index];
          if (
            chosen &&
            this.upgradeSystem.selectUpgrade(card.index, this.player, this.combatSystem)
          ) {
            this.sound.playCoinPickup();
            logAnalyticsEvent('select_content', {
              content_type: 'upgrade',
              item_id: chosen.id,
              item_name: chosen.name,
              level: chosen.level,
            });
            this.addTerminalLog(`INSTALLED: ${chosen.name} (v${chosen.level}.0)`);
            this.particleSystem.spawnExplosion(this.player.x, this.player.y, chosen.color, 24, true);
            this.hoveredCardIndex = -1;
          }
          break;
        }
      }
    });
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.hoveredPauseAction = null;
    if (!this.isPaused) {
      this.lastTime = performance.now();
    }
  }

  private exitToMainMenu(): void {
    if (this.finalBoss) {
      this.runDamageToToro = Math.floor(this.finalBoss.totalDamageTaken);
    }
    this.metaSystem.updateHighScore(this.killCount, this.elapsedTime, this.runDamageToToro);
    this.highScoreKills = Math.max(this.highScoreKills, this.metaSystem.highScore);
    void this.metaSystem.syncToCloud(this.elapsedTime, this.runDamageToToro);
    this.isPaused = false;
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
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.metaSystem.getSelectedProfile(),
      this.metaSystem.getEquippedHat()
    );
    this.gameState = 'MENU';
    this.sound.setTrack('MENU');
    this.lastTime = performance.now();
  }

  private resize(): void {
    this.canvas.width = LOGICAL_WIDTH;
    this.canvas.height = LOGICAL_HEIGHT;
  }

  private startNewRun(): void {
    const profile = this.metaSystem.getSelectedProfile();
    logAnalyticsEvent('level_start', {
      character: profile.name,
      equipped_hat: this.metaSystem.getEquippedHat() || 'none',
    });
    this.player = new Player(
      this.canvas.width / 2,
      this.canvas.height / 2,
      profile,
      this.metaSystem.getEquippedHat()
    );
    this.enemies = [];
    this.projectiles = [];
    this.pingProjectiles = [];
    this.quarantineZones = [];
    this.combatSystem.enemyProjectiles = [];
    this.combatSystem.firewallPulses = [];
    this.combatSystem.sqlBeams = [];
    this.combatSystem.droneExplosions = [];
    this.codeFragments = [];
    this.cryptoCoins = [];
    this.powerUps = [];
    this.systemFreezeTimer = 0;
    this.thermalOverclockTimer = 0;
    this.finalBoss = null;
    this.isPaused = false;
    this.hoveredPauseAction = null;
    this.spawner = new Spawner();
    this.combatSystem = new CombatSystem();
    this.upgradeSystem = new UpgradeSystem();
    this.particleSystem.clear();
    this.elapsedTime = 0;
    this.killCount = 0;
    this.runCoinsCollected = 0;
    this.runDamageToToro = 0;
    this.runBossesKilled = 0;
    this.runTotalDamageDealt = 0;
    this.hoveredCardIndex = -1;
    this.damageVignetteAlpha = 0;
    this.gameState = 'PLAYING';
    this.sound.setTrack('INGAME');
    this.lastTime = performance.now();
    this.sound.playShoot(false);
    this.terminalLogs = [
      `[000.0s] > DEPLOYED: ${profile.name} (HP: ${this.player.maxHp} | Magnet: ${this.player.pickupRadius}px)`,
      `[000.0s] > Controls: [WASD/Arrows] Move | [P] Pause | [H] Hitboxes.`,
    ];
  }

  /**
   * Invoca al Jefe Final ("El Toro") al alcanzarse el tiempo de supervivencia de ~11-12 minutos.
   */
  private triggerFinalBossArrival(): void {
    this.achievementSystem.reportProgress('toro_arrival', 1);
    this.spawner.enableFinalBossMode();
    this.enemies = [];
    const spawnY =
      this.player.y > this.canvas.height * 0.45 ? 120 : this.canvas.height - 120;
    this.finalBoss = new ElToroBoss(this.canvas.width / 2, spawnY);
    this.enemies.push(this.finalBoss);
    logAnalyticsEvent('boss_spawn', { boss_name: 'EL_TORO' });

    this.sound.playExplosion(true);
    this.particleSystem.triggerShake(18, 0.7);
    this.particleSystem.spawnExplosion(this.finalBoss.x, this.finalBoss.y, '#dc2626', 100, true);
    this.particleSystem.spawnFloatingText(
      this.canvas.width / 2,
      this.canvas.height / 2 - 40,
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

    this.player.update(dt, this.input, this.canvas.width, this.canvas.height);

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
      this.canvas.width,
      this.canvas.height
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
      proj.update(dt, this.canvas.width, this.canvas.height);
    }
    for (const ping of this.pingProjectiles) {
      ping.update(dt, this.enemies, this.canvas.width, this.canvas.height);
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
      this.canvas.width,
      this.canvas.height
    );

    if (this.player.companion && this.player.active) {
      const compEvents = this.player.companion.update(
        dt,
        this.player,
        this.upgradeSystem.level,
        this.enemies,
        this.canvas.width,
        this.canvas.height
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
        if (Math.random() < 0.06) {
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
        this.runCoinsCollected += coin.value;
        this.metaSystem.addCoins(coin.value);
        this.sound.playCoinPickup();
        this.particleSystem.spawnFloatingText(
          this.player.x,
          this.player.y - 28,
          `+${coin.value} CRYPTO`,
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

  private render(): void {
    this.ctx.fillStyle = '#010305';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const shake = this.sound.screenShakeEnabled
      ? this.particleSystem.getShakeOffset()
      : { x: 0, y: 0 };
    this.ctx.save();
    this.ctx.translate(shake.x, shake.y);

    this.drawCyberGrid();

    if (this.gameState !== 'MENU') {
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
    }

    this.ctx.restore();

    if (this.gameState === 'PLAYING') {
      this.drawOffScreenIndicators();
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
      this.drawTerminalLogBox();
      this.drawBossHUD();

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

    this.achievementSystem.drawToasts(this.ctx, this.canvas.width);
    this.drawCRTScanlines();
    this.drawVersionBadge();
  }

  private getPauseButtonRects(): PauseButtonRect[] {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
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
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 6, 4, 0.82)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const boxW = 500;
    const boxH = 320;
    this.ctx.fillStyle = 'rgba(4, 18, 12, 0.96)';
    this.ctx.strokeStyle = '#00ff66';
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = '#00ff66';
    this.ctx.shadowBlur = 18;
    this.ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    this.ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff66';
    this.ctx.font = 'bold 28px "Courier New", monospace';
    this.ctx.fillText(`// ${i18n.t('SISTEMA EN PAUSA', 'SYSTEM PAUSED')} //`, cx, cy - 95);

    this.ctx.fillStyle = '#00f0ff';
    this.ctx.font = '13px "Courier New", monospace';
    this.ctx.fillText(
      i18n.t('Simulación y temporizadores detenidos.', 'Simulation and run timers paused.'),
      cx,
      cy - 64
    );

    for (const btn of this.getPauseButtonRects()) {
      const hovered = this.hoveredPauseAction === btn.action;
      const isExit = btn.action === 'EXIT_TO_MENU';
      const isSettings = btn.action === 'SETTINGS';
      const baseColor = isExit ? '#ff1e42' : isSettings ? '#38bdf8' : '#00ff66';

      this.ctx.fillStyle = hovered
        ? isExit
          ? 'rgba(60, 10, 20, 0.95)'
          : isSettings
          ? 'rgba(10, 35, 60, 0.95)'
          : 'rgba(0, 55, 32, 0.95)'
        : 'rgba(8, 22, 16, 0.92)';
      this.ctx.strokeStyle = hovered ? '#ffffff' : baseColor;
      this.ctx.lineWidth = hovered ? 2.5 : 1.5;
      this.ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      this.ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

      this.ctx.fillStyle = hovered ? '#ffffff' : baseColor;
      this.ctx.font = 'bold 15px "Courier New", monospace';
      this.ctx.fillText(btn.label, cx, btn.y + 28);
    }

    if (this.showSettingsOverlay) {
      this.drawSettingsOverlay();
    }

    this.ctx.restore();
  }

  private drawVersionBadge(): void {
    this.ctx.save();
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = 'rgba(0, 255, 102, 0.78)';
    this.ctx.shadowColor = '#00ff66';
    this.ctx.shadowBlur = 6;
    this.ctx.font = `bold 12px ${FONT_MONO}`;
    this.ctx.fillText(GAME_VERSION, this.canvas.width - 18, this.canvas.height - 14);
    this.ctx.restore();
  }

  private drawSwarmPlagueOverlay(): void {
    this.ctx.save();
    // Filtro rojo suave sobre todo el Canvas durante los 15s de 'El Enjambre'
    const pulseAlpha = 0.12 + Math.sin(performance.now() * 0.008) * 0.04;
    this.ctx.fillStyle = `rgba(255, 15, 45, ${pulseAlpha})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Alarma visual superior
    const blink = Math.floor(performance.now() / 280) % 2 === 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = blink ? '#ff1e42' : '#fde047';
    this.ctx.shadowColor = '#ff0044';
    this.ctx.shadowBlur = 16;
    this.ctx.font = `bold 18px ${FONT_DISPLAY}`;
    this.ctx.fillText(
      i18n.t(
        `⚠️ ALERTA DE PLAGA: EL ENJAMBRE (${this.spawner.swarmActiveTimer.toFixed(1)}s) // ¡50 ENEMIGOS DETECTADOS! ⚠️`,
        `⚠️ PLAGUE ALERT: THE SWARM (${this.spawner.swarmActiveTimer.toFixed(1)}s) // 50 HOSTILES DETECTED! ⚠️`
      ),
      this.canvas.width / 2,
      102
    );
    this.ctx.restore();
  }

  private drawDamageVignette(): void {
    this.ctx.save();
    const grad = this.ctx.createRadialGradient(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width * 0.25,
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width * 0.65
    );
    grad.addColorStop(0, 'rgba(255, 0, 50, 0)');
    grad.addColorStop(1, `rgba(255, 15, 60, ${this.damageVignetteAlpha * 0.45})`);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
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
        this.ctx.shadowColor = this.ctx.fillStyle;
        this.ctx.shadowBlur = 6;
        this.ctx.fillRect(barX, barY, barW * hpRatio, barH);
        this.ctx.restore();
      }
    }
  }

  private drawOffScreenIndicators(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
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

      const isOffScreen = enemy.x < 0 || enemy.x > w || enemy.y < 0 || enemy.y > h;
      if (!isOffScreen) continue;

      const cx = w / 2;
      const cy = h / 2;
      const dx = enemy.x - cx;
      const dy = enemy.y - cy;
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
      this.ctx.shadowColor = isMiner ? '#f59e0b' : '#ff1e42';
      this.ctx.shadowBlur = 12;
      this.ctx.lineWidth = 1.5;

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
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width * 0.3,
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width * 0.7
    );
    grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
    grad.addColorStop(1, 'rgba(0, 200, 255, 0.28)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.font = 'bold 15px "JetBrains Mono", Consolas, monospace';
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 10;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      `❄ SISTEMA CONGELADO: ${this.systemFreezeTimer.toFixed(1)}s`,
      this.canvas.width / 2,
      72
    );
    this.ctx.restore();
  }

  private drawThermalOverclockIndicator(): void {
    this.ctx.save();
    this.ctx.font = `bold 15px ${FONT_MONO}`;
    this.ctx.fillStyle = '#f97316';
    this.ctx.shadowColor = '#fbbf24';
    this.ctx.shadowBlur = 12;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      i18n.t(
        `⚡ OVERCLOCK TÉRMICO (x2 CADENCIA + 100% CRIT): ${this.thermalOverclockTimer.toFixed(1)}s`,
        `⚡ THERMAL OVERCLOCK (2x FIRE RATE + 100% CRIT): ${this.thermalOverclockTimer.toFixed(1)}s`
      ),
      this.canvas.width / 2,
      110
    );
    this.ctx.restore();
  }

  private drawCRTScanlines(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const arm = 26;
    const pad = 8;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 255, 102, 0.014)';
    for (let y = 0; y < h; y += 4) {
      this.ctx.fillRect(0, y, w, 1);
    }

    // Esquinas tácticas estilo visor cibernético (sin marco cuadrado completo)
    this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.34)';
    this.ctx.lineWidth = 2;
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
    const boxY = this.canvas.height - boxH - 14;
    const boxW = 430;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(2, 12, 8, 0.45)';
    this.ctx.fillRect(boxX, boxY, boxW, boxH);

    // Barra vertical neón a la izquierda
    this.ctx.fillStyle = 'rgba(0, 255, 102, 0.72)';
    this.ctx.fillRect(boxX, boxY, 3, boxH);

    this.ctx.font = `11.5px ${FONT_MONO}`;
    const maxLineW = boxW - 20;
    for (let i = 0; i < recent.length; i++) {
      const isLatest = i === recent.length - 1;
      this.ctx.fillStyle = isLatest ? 'rgba(0, 255, 136, 0.9)' : 'rgba(148, 163, 184, 0.65)';
      let line = recent[i];
      if (this.ctx.measureText(line).width > maxLineW) {
        while (line.length > 8 && this.ctx.measureText(line + '…').width > maxLineW) {
          line = line.slice(0, -1);
        }
        line += '…';
      }
      this.ctx.fillText(line, boxX + 11, boxY + 17 + i * 17);
    }
    this.ctx.restore();
  }

  private getMenuTabRects(): {
    tab: MenuTab;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const py = cy - 290;
    const tabW = 230;
    const tabH = 36;
    const gap = 16;
    const totalW = tabW * 3 + gap * 2;
    const startX = cx - totalW / 2;
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
        label: `[G] ${i18n.t('GACHA // COFRES', 'GACHA // CHESTS')}`,
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
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const py = cy - 290;
    const cardW = 380;
    const cardH = 138;
    const gapX = 22;
    const gapY = 14;
    const startX = cx - cardW - gapX / 2;
    const startY = py + 154;

    return this.metaSystem.characterOrder.map((id, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const isLastSingleRowCard =
        idx === this.metaSystem.characterOrder.length - 1 &&
        this.metaSystem.characterOrder.length % 2 === 1;
      return {
        id,
        x: isLastSingleRowCard ? cx - cardW / 2 : startX + col * (cardW + gapX),
        y: startY + row * (cardH + gapY),
        width: cardW,
        height: cardH,
      };
    });
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
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const py = cy - 290;
    const btnW = 310;
    const btnH = 46;
    const gap = 20;
    const startX = cx - btnW - gap / 2;
    const y = py + 184;

    return [
      {
        count: 1,
        cost: GACHA_PULL_SINGLE_COST,
        label: `🔌 ${i18n.t('TIRADA x1', 'ROLL x1')} (${GACHA_PULL_SINGLE_COST} 🪙)`,
        x: startX,
        y,
        width: btnW,
        height: btnH,
      },
      {
        count: 10,
        cost: GACHA_PULL_TEN_COST,
        label: `⚡ ${i18n.t('TIRADA x10', 'ROLL x10')} (${GACHA_PULL_TEN_COST} 🪙)`,
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
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const py = cy - 290;
    const cardW = 240;
    const cardH = 78;
    const gapX = 16;
    const gapY = 12;
    const totalW = cardW * 3 + gapX * 2;
    const startX = cx - totalW / 2;
    const startY = py + 154;

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

    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const py = cy - 290;
    const y = py + 424;
    const btnW = 130;
    const btnH = 26;

    return [
      {
        dir: 'PREV',
        label: i18n.t('<< ANTERIOR', '<< PREV'),
        x: cx - 220,
        y,
        width: btnW,
        height: btnH,
      },
      {
        dir: 'NEXT',
        label: i18n.t('SIGUIENTE >>', 'NEXT >>'),
        x: cx + 90,
        y,
        width: btnW,
        height: btnH,
      },
    ];
  }

  private getStartButtonRect(): { x: number; y: number; width: number; height: number } {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const py = cy - 290;
    const width = 500;
    const height = 48;
    return {
      x: cx - width / 2,
      y: py + 504,
      width,
      height,
    };
  }

  private getFullscreenButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1000,
      y: 26,
      width: 195,
      height: 44,
    };
  }

  private getHelpButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1207,
      y: 26,
      width: 145,
      height: 44,
    };
  }

  private getGlobalRankingsButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1364,
      y: 26,
      width: 145,
      height: 44,
    };
  }

  private getAchievementsButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1521,
      y: 26,
      width: 215,
      height: 44,
    };
  }

  private getSettingsButtonRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: 1748,
      y: 26,
      width: 140,
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
    if (glowColor && glowBlur > 0) {
      this.ctx.shadowColor = glowColor;
      this.ctx.shadowBlur = glowBlur;
    }
    this.traceChamferRect(x, y, w, h, cut);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  /** Fondo animado de modo atractivo detrás del Kernel Hub para dar vida al menú inicial. */
  private drawMenuAttractBackdrop(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const t = performance.now() * 0.001;

    this.ctx.save();

    // Anillos holográficos orbitales centrados detrás del panel
    this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.14)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([18, 14]);
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(t * 0.12);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 420, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    this.ctx.rotate(-t * 0.24);
    this.ctx.setLineDash([10, 22]);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 505, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
    this.ctx.setLineDash([]);

    // Flujos verticales de datos en los márgenes laterales
    const lanes = [96, 188, 284, w - 284, w - 188, w - 96];
    for (let i = 0; i < lanes.length; i++) {
      const lx = lanes[i];
      const streamY = (((t * (75 + i * 19) + i * 210) % (h + 240)) - 120);
      const grad = this.ctx.createLinearGradient(lx, streamY - 70, lx, streamY + 70);
      const col = i % 2 === 0 ? '0, 255, 136' : '56, 189, 248';
      grad.addColorStop(0, `rgba(${col}, 0)`);
      grad.addColorStop(0.5, `rgba(${col}, 0.28)`);
      grad.addColorStop(1, `rgba(${col}, 0)`);
      this.ctx.strokeStyle = grad;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(lx, streamY - 70);
      this.ctx.lineTo(lx, streamY + 70);
      this.ctx.stroke();
    }

    // Dron/caza holográfico y señuelos patrullando en los laterales
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const baseX = side < 0 ? 220 : w - 220;
      const phase = t * 0.75 + i * 1.45;
      const px = baseX + Math.sin(phase * 1.2) * 115;
      const py = cy + Math.cos(phase * 0.85 + i) * (h * 0.32);
      const angle = Math.atan2(
        -Math.sin(phase * 0.85 + i) * 0.85,
        Math.cos(phase * 1.2) * 1.2
      );
      const isHostile = i % 2 === 1;

      this.ctx.save();
      this.ctx.globalAlpha = 0.42;
      this.ctx.translate(px, py);
      this.ctx.rotate(angle);
      this.ctx.strokeStyle = isHostile ? '#ff1e42' : '#00ff66';
      this.ctx.fillStyle = isHostile ? 'rgba(255, 30, 66, 0.22)' : 'rgba(0, 255, 102, 0.22)';
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
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
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
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
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
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
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

  private drawStartMenuWithShop(): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 6, 4, 0.72)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
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
        'rgba(2, 22, 14, 0.94)',
        '#00ff66',
        1.5,
        '#00ff66',
        10
      );

      // Recorte estricto para evitar cualquier desbordamiento de texto
      this.traceChamferRect(statusBoxX + 2, statusBoxY + 2, statusBoxW - 4, statusBoxH - 4, 6);
      this.ctx.clip();

      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = '#00ff66';
      this.ctx.font = `bold 13px ${FONT_DISPLAY}`;
      this.ctx.fillText(`${i18n.t('AGENTE', 'AGENT')}: ${truncatedName}`, statusBoxX + 14, statusBoxY + 20);

      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = `bold 11px ${FONT_MONO}`;
      this.ctx.fillText(`☁ ${i18n.t('NUBE SINCRONIZADA', 'CLOUD SYNCED')}`, statusBoxX + 14, statusBoxY + 35);
      this.ctx.restore();

      // Botón Cerrar Sesión con auto-fit y recorte
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
        this.hoveredAuthBtn ? 'rgba(14, 55, 85, 0.96)' : 'rgba(8, 28, 46, 0.92)',
        this.hoveredAuthBtn ? '#00ff66' : '#38bdf8',
        this.hoveredAuthBtn ? 2.2 : 1.5,
        this.hoveredAuthBtn ? '#00ff66' : '#e0f2fe',
        12,
        `🔐 [L] ${i18n.t('INICIAR SESIÓN CON GOOGLE', 'SIGN IN WITH GOOGLE')}`,
        this.hoveredAuthBtn ? '#00ff66' : '#38bdf8',
        this.hoveredAuthBtn ? 14 : 6
      );
    }

    // ==========================================
    // 2. ESQUINA SUPERIOR DERECHA: PANTALLA COMPLETA, RANKINGS, LOGROS, AJUSTES
    // ==========================================
    // Botón Pantalla Completa (Destacado y fuera de opciones para máxima visibilidad)
    const fsBtn = this.getFullscreenButtonRect();
    this.drawClippedButton(
      fsBtn,
      this.hoveredFullscreenBtn ? 'rgba(0, 55, 45, 0.96)' : 'rgba(4, 28, 28, 0.92)',
      this.hoveredFullscreenBtn ? '#ffffff' : '#00f0ff',
      this.hoveredFullscreenBtn ? 2.5 : 1.8,
      this.hoveredFullscreenBtn ? '#ffffff' : '#00f0ff',
      12,
      `⛶ [F] ${i18n.t('PANTALLA COMPLETA', 'FULLSCREEN')}`,
      '#00f0ff',
      this.hoveredFullscreenBtn ? 16 : 8
    );

    // Botón Cómo Jugar (Tutorial / Guía)
    const helpBtn = this.getHelpButtonRect();
    this.drawClippedButton(
      helpBtn,
      this.hoveredHelpBtn ? 'rgba(55, 18, 70, 0.96)' : 'rgba(32, 10, 42, 0.92)',
      this.hoveredHelpBtn ? '#ffffff' : '#d946ef',
      this.hoveredHelpBtn ? 2.2 : 1.5,
      this.hoveredHelpBtn ? '#ffffff' : '#f0abfc',
      12,
      `📖 [H] ${i18n.t('CÓMO JUGAR', 'HOW TO PLAY')}`,
      '#d946ef',
      this.hoveredHelpBtn ? 14 : 6
    );

    // Botón Clasificación Global (Rankings)
    const rankingsBtn = this.getGlobalRankingsButtonRect();
    this.drawClippedButton(
      rankingsBtn,
      this.hoveredRankingsBtn ? 'rgba(85, 50, 5, 0.96)' : 'rgba(42, 24, 4, 0.92)',
      this.hoveredRankingsBtn ? '#ffffff' : '#fbbf24',
      this.hoveredRankingsBtn ? 2.2 : 1.5,
      this.hoveredRankingsBtn ? '#ffffff' : '#fde047',
      12,
      `🏆 [R] ${i18n.t('RANKINGS', 'RANKINGS')}`,
      '#fbbf24',
      this.hoveredRankingsBtn ? 14 : 6
    );

    // Botón Logros
    const achBtn = this.getAchievementsButtonRect();
    const achUnlocked = this.achievementSystem.getUnlockedCount();
    const totalAch = this.achievementSystem.achievements.length;
    this.drawClippedButton(
      achBtn,
      this.hoveredAchievementsBtn ? 'rgba(30, 50, 15, 0.96)' : 'rgba(15, 26, 8, 0.92)',
      this.hoveredAchievementsBtn ? '#ffffff' : '#84cc16',
      this.hoveredAchievementsBtn ? 2 : 1.5,
      this.hoveredAchievementsBtn ? '#ffffff' : '#bef264',
      11.5,
      `🏆 [A] ${i18n.t('LOGROS', 'ACHIEVEMENTS')} (${achUnlocked}/${totalAch})`,
      '#84cc16',
      this.hoveredAchievementsBtn ? 12 : 6
    );

    // Botón Ajustes
    const setBtn = this.getSettingsButtonRect();
    this.drawClippedButton(
      setBtn,
      this.hoveredSettingsBtn ? 'rgba(12, 40, 65, 0.96)' : 'rgba(6, 22, 36, 0.92)',
      this.hoveredSettingsBtn ? '#ffffff' : '#0284c7',
      this.hoveredSettingsBtn ? 2 : 1.5,
      this.hoveredSettingsBtn ? '#ffffff' : '#7dd3fc',
      12,
      `⚙️ [O] ${i18n.t('AJUSTES', 'SETTINGS')}`,
      '#0284c7',
      this.hoveredSettingsBtn ? 12 : 6
    );

    // ==========================================
    // 3. PANEL CENTRAL (KERNEL HUB)
    // ==========================================
    const panelW = 860;
    const panelH = 580;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2;

    this.drawCyberPanel(
      px,
      py,
      panelW,
      panelH,
      18,
      'rgba(3, 15, 11, 0.95)',
      '#00ff66',
      2.2,
      '#00ff66',
      22
    );

    // Línea luminosa superior decorativa dentro del Kernel Hub
    const headerGrad = this.ctx.createLinearGradient(px + 60, py + 4, px + panelW - 60, py + 4);
    headerGrad.addColorStop(0, 'rgba(0, 255, 102, 0)');
    headerGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.85)');
    headerGrad.addColorStop(1, 'rgba(0, 255, 102, 0)');
    this.ctx.fillStyle = headerGrad;
    this.ctx.fillRect(px + 60, py + 2, panelW - 120, 2.5);

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff66';
    this.ctx.font = `bold 29px ${FONT_DISPLAY}`;
    this.ctx.fillText(`CYBER SURVIVOR // KERNEL HUB (${GAME_VERSION})`, cx, py + 41);

    const equippedHat = this.metaSystem.getEquippedHat();
    const noneText = i18n.t('Ninguno', 'None');
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.font = `bold 13.5px ${FONT_MONO}`;
    this.ctx.fillText(
      `[ ${i18n.t('Récord', 'High Score')}: ${this.metaSystem.highScore} (${this.formatTimeMMSS(this.metaSystem.bestTimeSeconds)}) ]  |  [ CRYPTO: ${this.metaSystem.coins} 🪙 ]  |  [ ${i18n.t('EQUIPADO', 'EQUIPPED')}: ${
        equippedHat ? `${equippedHat.icon} ${equippedHat.name}` : noneText
      } ]`,
      cx,
      py + 72
    );

    // Dibujar barra de pestañas (AGENTES | GACHA | INVENTARIO)
    for (const tabRect of this.getMenuTabRects()) {
      const isActive = this.activeMenuTab === tabRect.tab;
      this.drawCyberPanel(
        tabRect.x,
        tabRect.y,
        tabRect.width,
        tabRect.height,
        9,
        isActive ? 'rgba(0, 60, 38, 0.96)' : 'rgba(6, 18, 24, 0.92)',
        isActive ? '#00ff66' : '#38bdf8',
        isActive ? 2.4 : 1.5,
        isActive ? '#00ff66' : undefined,
        isActive ? 10 : 0
      );

      this.ctx.fillStyle = isActive ? '#00ff66' : '#bae6fd';
      this.ctx.font = `bold 13px ${FONT_DISPLAY}`;
      this.ctx.fillText(tabRect.label, tabRect.x + tabRect.width / 2, tabRect.y + 23);
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
          12,
          selected
            ? 'rgba(0, 48, 32, 0.96)'
            : hovered
            ? 'rgba(12, 32, 48, 0.96)'
            : 'rgba(6, 15, 20, 0.93)',
          selected ? '#00ff66' : unlocked ? profile.borderColor : '#fbbf24',
          selected || hovered ? 2.4 : 1.5,
          selected ? '#00ff66' : hovered ? profile.borderColor : undefined,
          selected || hovered ? 10 : 0
        );

        // Recorte estricto dentro de la tarjeta de personaje
        this.traceChamferRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, 10);
        this.ctx.clip();

        const previewX = rect.x + 32;
        const previewY = rect.y + 34;
        Player.drawCyberChassis(
          this.ctx,
          previewX,
          previewY,
          26,
          profile.color,
          profile.borderColor,
          performance.now(),
          0,
          selected || hovered
        );

        if (rect.id === 'MORCILLITA') {
          // Dron mascota en rombo biselado junto al chasis rosa
          this.ctx.save();
          this.ctx.translate(previewX + 14, previewY - 12);
          this.ctx.rotate(Math.PI / 4);
          this.ctx.fillStyle = '#92400e';
          this.ctx.strokeStyle = '#fbbf24';
          this.ctx.lineWidth = 1.5;
          this.ctx.fillRect(-5, -5, 10, 10);
          this.ctx.strokeRect(-5, -5, 10, 10);
          this.ctx.restore();
        }

        this.ctx.shadowBlur = 0;
        const pName = i18n.currentLang === 'EN' && profile.nameEn ? profile.nameEn : profile.name;
        const pSub = i18n.currentLang === 'EN' && profile.subtitleEn ? profile.subtitleEn : profile.subtitle;
        const pDesc = i18n.currentLang === 'EN' && profile.descriptionEn ? profile.descriptionEn : profile.description;

        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font =
          pName.length > 20
            ? `bold 13.5px ${FONT_DISPLAY}`
            : `bold 15px ${FONT_DISPLAY}`;
        this.ctx.fillText(`[${i + 1}] ${pName}`, rect.x + 58, rect.y + 28);

        this.ctx.fillStyle = '#38bdf8';
        this.ctx.font = `bold 11.5px ${FONT_MONO}`;
        this.ctx.fillText(pSub, rect.x + 58, rect.y + 45);

        this.ctx.fillStyle = '#cbd5e1';
        this.ctx.font = `12px ${FONT_DISPLAY}`;
        this.wrapText(pDesc, rect.x + 14, rect.y + 68, rect.width - 28, 16, 3);

        this.ctx.font = `bold 12px ${FONT_MONO}`;
        if (selected) {
          this.ctx.fillStyle = '#00ff66';
          this.ctx.fillText(i18n.t('✔ EQUIPADO Y LISTO', '✔ EQUIPPED & READY'), rect.x + 14, rect.y + rect.height - 12);
        } else if (unlocked) {
          this.ctx.fillStyle = '#00f0ff';
          this.ctx.fillText(
            i18n.t(`> PULSA [${i + 1}] O CLIC PARA EQUIPAR`, `> PRESS [${i + 1}] OR CLICK TO EQUIP`),
            rect.x + 14,
            rect.y + rect.height - 12
          );
        } else {
          const canAfford = this.metaSystem.coins >= profile.cost;
          this.ctx.fillStyle = canAfford ? '#fbbf24' : '#ff1e42';
          this.ctx.fillText(
            i18n.t(`🔒 DESBLOQUEAR (${profile.cost} CRIPTO)`, `🔒 UNLOCK (${profile.cost} CRYPTO)`),
            rect.x + 14,
            rect.y + rect.height - 12
          );
        }

        this.ctx.restore();
      }
    } else if (this.activeMenuTab === 'GACHA') {
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = `bold 12px ${FONT_DISPLAY}`;
      this.ctx.fillText(
        i18n.t(
          'PROBABILIDADES: Común 40% | Rara 30% | Épica 20% | Legendaria 9% | Mítica 1%  (Repetido: +10 🪙)',
          'ODDS: Common 40% | Rare 30% | Epic 20% | Legendary 9% | Mythic 1%  (Duplicate: +10 🪙)'
        ),
        cx,
        py + 162
      );

      for (const pullBtn of this.getGachaPullButtonRects()) {
        const canAfford = this.metaSystem.coins >= pullBtn.cost;
        const isTen = pullBtn.count === 10;
        const strokeCol = canAfford ? (isTen ? '#fbbf24' : '#c084fc') : '#ff1e42';
        this.drawCyberPanel(
          pullBtn.x,
          pullBtn.y,
          pullBtn.width,
          pullBtn.height,
          10,
          canAfford
            ? isTen
              ? 'rgba(69, 26, 3, 0.95)'
              : 'rgba(46, 16, 101, 0.95)'
            : 'rgba(30, 10, 18, 0.9)',
          strokeCol,
          2.2,
          strokeCol,
          10
        );

        this.ctx.fillStyle = canAfford ? '#fde047' : '#fca5a5';
        this.ctx.font = `bold 15px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          pullBtn.label,
          pullBtn.x + pullBtn.width / 2,
          pullBtn.y + 28
        );
      }

      if (this.lastGachaResults.length === 1) {
        const entry = this.lastGachaResults[0];
        const rConf = RARITY_CONFIG[entry.hat.rarity];
        const revealBoxW = 540;
        const revealBoxH = 175;
        const rx = cx - revealBoxW / 2;
        const ry = py + 252;
        const pulseScale = 1 + Math.sin(this.gachaRevealTimer * 14) * 0.025;

        this.ctx.save();
        this.ctx.translate(cx, ry + revealBoxH / 2);
        this.ctx.scale(pulseScale, pulseScale);
        this.ctx.translate(-cx, -(ry + revealBoxH / 2));

        this.drawCyberPanel(
          rx,
          ry,
          revealBoxW,
          revealBoxH,
          14,
          rConf.bgColor,
          rConf.color,
          2.8,
          rConf.color,
          this.gachaRevealTimer > 0 ? 24 : 12
        );

        this.ctx.fillStyle = rConf.color;
        this.ctx.font = `bold 13.5px ${FONT_MONO}`;
        this.ctx.fillText(`★ ${i18n.t('RAREZA', 'RARITY')} ${rConf.label} ★`, cx, ry + 26);

        this.ctx.font = '36px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        this.ctx.fillText(entry.hat.icon, cx, ry + 66);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold 19px ${FONT_DISPLAY}`;
        this.ctx.fillText(entry.hat.name, cx, ry + 104);

        this.ctx.fillStyle = entry.isNew ? '#00ff66' : '#fbbf24';
        this.ctx.font = `bold 14px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          entry.isNew
            ? i18n.t('¡NUEVO DESBLOQUEO!', 'NEW UNLOCK!')
            : i18n.t('Repetido: +10 Monedas 🪙', 'Duplicate: +10 Coins 🪙'),
          cx,
          ry + 130
        );

        this.ctx.fillStyle = '#a3e635';
        this.ctx.font = `bold 13px ${FONT_MONO}`;
        this.ctx.fillText(
          `${i18n.t('MODIFICADORES', 'MODIFIERS')}: [ ${entry.hat.statsLabel} ]`,
          cx,
          ry + 156
        );
        this.ctx.restore();
      } else if (this.lastGachaResults.length > 1) {
        const cols = 5;
        const cardW = 132;
        const cardH = 104;
        const gapX = 10;
        const gapY = 10;
        const totalW = cols * cardW + (cols - 1) * gapX;
        const startX = cx - totalW / 2;
        const startY = py + 248;

        for (let i = 0; i < this.lastGachaResults.length; i++) {
          const entry = this.lastGachaResults[i];
          const rConf = RARITY_CONFIG[entry.hat.rarity];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = startX + col * (cardW + gapX);
          const y = startY + row * (cardH + gapY);

          this.ctx.save();
          this.drawCyberPanel(x, y, cardW, cardH, 9, rConf.bgColor, rConf.color, 1.8);

          // Recorte estricto por carta gacha
          this.traceChamferRect(x + 2, y + 2, cardW - 4, cardH - 4, 7);
          this.ctx.clip();

          this.ctx.textAlign = 'center';
          this.ctx.font = '22px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
          this.ctx.fillText(entry.hat.icon, x + cardW / 2, y + 24);

          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = `bold 10.5px ${FONT_DISPLAY}`;
          const shortName =
            entry.hat.name.length > 16 ? entry.hat.name.slice(0, 15) + '…' : entry.hat.name;
          this.ctx.fillText(shortName, x + cardW / 2, y + 48);

          this.ctx.fillStyle = rConf.color;
          this.ctx.font = `bold 9.5px ${FONT_MONO}`;
          this.ctx.fillText(rConf.label.split(' ')[0], x + cardW / 2, y + 64);

          this.ctx.fillStyle = entry.isNew ? '#00ff66' : '#fbbf24';
          this.ctx.font = `bold 9.5px ${FONT_DISPLAY}`;
          this.ctx.fillText(
            entry.isNew ? i18n.t('¡NUEVO!', 'NEW!') : i18n.t('Repetido: +10 🪙', 'Dup: +10 🪙'),
            x + cardW / 2,
            y + 82
          );

          this.ctx.fillStyle = '#cbd5e1';
          this.ctx.font = `9px ${FONT_MONO}`;
          const shortStats =
            entry.hat.statsLabel.length > 18
              ? entry.hat.statsLabel.slice(0, 17) + '…'
              : entry.hat.statsLabel;
          this.ctx.fillText(shortStats, x + cardW / 2, y + 96);
          this.ctx.restore();
        }
      } else {
        const revealBoxW = 560;
        const revealBoxH = 175;
        const rx = cx - revealBoxW / 2;
        const ry = py + 252;

        this.drawCyberPanel(
          rx,
          ry,
          revealBoxW,
          revealBoxH,
          14,
          'rgba(4, 20, 26, 0.94)',
          'rgba(56, 189, 248, 0.55)',
          1.6
        );

        // Cabecera decorativa
        this.ctx.fillStyle = '#38bdf8';
        this.ctx.font = `bold 15px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          i18n.t('📦 BÓVEDA DE EQUIPAMIENTO // COFRES CUÁNTICOS', '📦 QUANTUM CHEST VAULT // EQUIPMENT'),
          cx,
          ry + 38
        );

        this.ctx.fillStyle = '#e2e8f0';
        this.ctx.font = `13.5px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          i18n.t(
            'Elige "Tirada x1" (20 🪙) o "Tirada x10" (200 🪙) para abrir cofres.',
            'Choose "Roll x1" (20 🪙) or "Roll x10" (200 🪙) to open chests.'
          ),
          cx,
          ry + 74
        );

        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = `12.5px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          i18n.t(
            'Desbloquea sombreros con bufos de combate para tu Agente Antivirus.',
            'Unlock hats with combat buffs for your Antivirus Agent.'
          ),
          cx,
          ry + 102
        );

        this.ctx.fillStyle = '#fbbf24';
        this.ctx.font = `bold 12.5px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          i18n.t(
            '⚡ ¡Si obtienes un sombrero repetido, recibirás automáticamente +10 Monedas! ⚡',
            '⚡ If you pull a duplicate hat, you will automatically receive +10 Coins! ⚡'
          ),
          cx,
          ry + 138
        );
      }
    } else if (this.activeMenuTab === 'INVENTORY') {
      const unlockedList = this.metaSystem.getUnlockedHatsList();
      if (unlockedList.length === 0) {
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = `15px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          i18n.t(
            'Tu inventario está vacío. Ve a la pestaña [G] GACHA para Tirar del Cable.',
            'Your inventory is empty. Go to the [G] GACHA tab to Pull the Cable.'
          ),
          cx,
          cy + 20
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
            isEquipped ? 'rgba(0, 50, 32, 0.95)' : rConf.bgColor,
            isEquipped ? '#00ff66' : isHovered ? '#ffffff' : rConf.color,
            isEquipped || isHovered ? 2.4 : 1.5
          );

          // Recorte estricto por ranura de inventario
          this.traceChamferRect(slot.x + 2, slot.y + 2, slot.width - 4, slot.height - 4, 8);
          this.ctx.clip();

          this.ctx.textAlign = 'left';
          this.ctx.font = '22px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
          this.ctx.fillText(slot.hat.icon, slot.x + 10, slot.y + 28);

          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = `bold 12.5px ${FONT_DISPLAY}`;
          const shortName =
            slot.hat.name.length > 20 ? slot.hat.name.slice(0, 19) + '…' : slot.hat.name;
          this.ctx.fillText(shortName, slot.x + 40, slot.y + 22);

          this.ctx.fillStyle = rConf.color;
          this.ctx.font = `bold 10.5px ${FONT_MONO}`;
          this.ctx.fillText(
            isEquipped ? i18n.t('✔ EQUIPADO', '✔ EQUIPPED') : rConf.label.split(' ')[0],
            slot.x + 40,
            slot.y + 38
          );

          this.ctx.fillStyle = '#a3e635';
          let statFont = 11;
          const maxStatW = slot.width - 20;
          this.ctx.font = `${statFont}px ${FONT_MONO}`;
          const statMetrics = this.ctx.measureText(slot.hat.statsLabel).width;
          if (statMetrics > maxStatW) {
            statFont = Math.max(9, Math.floor(11 * (maxStatW / statMetrics)));
            this.ctx.font = `${statFont}px ${FONT_MONO}`;
          }
          this.ctx.fillText(slot.hat.statsLabel, slot.x + 10, slot.y + 62);
          this.ctx.restore();
        }

        const totalPages = Math.max(1, Math.ceil(unlockedList.length / 9));
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#cbd5e1';
        this.ctx.font = `bold 12px ${FONT_MONO}`;
        this.ctx.fillText(
          `${i18n.t('PÁG', 'PAGE')} ${this.inventoryPage + 1}/${totalPages}`,
          cx,
          py + 441
        );

        for (const pageBtn of this.getInventoryPaginationRects()) {
          this.drawCyberPanel(
            pageBtn.x,
            pageBtn.y,
            pageBtn.width,
            pageBtn.height,
            7,
            'rgba(12, 30, 45, 0.95)',
            '#38bdf8',
            1.5
          );

          this.ctx.fillStyle = '#38bdf8';
          this.ctx.font = `bold 12px ${FONT_DISPLAY}`;
          this.ctx.fillText(pageBtn.label, pageBtn.x + pageBtn.width / 2, pageBtn.y + 17);
        }
      }
    }

    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#a3e635';
    let feedbackFont = 13;
    const maxFeedbackW = panelW - 40;
    this.ctx.font = `bold ${feedbackFont}px ${FONT_DISPLAY}`;
    let fbMetrics = this.ctx.measureText(this.menuFeedbackMessage).width;
    if (fbMetrics > maxFeedbackW) {
      feedbackFont = Math.max(10, Math.floor(13 * (maxFeedbackW / fbMetrics)));
      this.ctx.font = `bold ${feedbackFont}px ${FONT_DISPLAY}`;
    }
    this.ctx.fillText(this.menuFeedbackMessage, cx, py + 478);
    this.ctx.restore();

    const startBtn = this.getStartButtonRect();
    this.ctx.save();
    this.drawCyberPanel(
      startBtn.x,
      startBtn.y,
      startBtn.width,
      startBtn.height,
      12,
      this.hoveredStartBtn ? 'rgba(0, 68, 38, 0.98)' : 'rgba(0, 38, 22, 0.95)',
      this.hoveredStartBtn ? '#ffffff' : '#00ff66',
      this.hoveredStartBtn ? 2.5 : 2.2,
      '#00ff66',
      this.hoveredStartBtn ? 18 : 10 + Math.sin(performance.now() * 0.006) * 6
    );

    // Recorte estricto dentro del botón de despliegue
    this.traceChamferRect(startBtn.x + 2, startBtn.y + 2, startBtn.width - 4, startBtn.height - 4, 10);
    this.ctx.clip();

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = this.hoveredStartBtn ? '#ffffff' : '#00ff66';
    let startFont = 16;
    const maxStartW = startBtn.width - 24;
    const startText = `> ${i18n.t('PULSA [ENTER] O CLIC AQUÍ PARA DESPLEGAR', 'PRESS [ENTER] OR CLICK HERE TO DEPLOY')} <`;
    this.ctx.font = `bold ${startFont}px ${FONT_DISPLAY}`;
    let stMetrics = this.ctx.measureText(startText).width;
    if (stMetrics > maxStartW) {
      startFont = Math.max(11, Math.floor(16 * (maxStartW / stMetrics)));
      this.ctx.font = `bold ${startFont}px ${FONT_DISPLAY}`;
    }
    this.ctx.fillText(startText, cx, startBtn.y + 29);
    this.ctx.restore();

    if (this.showLeaderboardOverlay) {
      this.drawLeaderboardOverlay();
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
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 4, 8, 0.92)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const panelW = Math.min(720, this.canvas.width - 32);
    const panelH = 576;
    const px = cx - panelW / 2;
    const py = cy - 290;

    this.ctx.fillStyle = 'rgba(4, 16, 22, 0.98)';
    this.ctx.strokeStyle = '#fbbf24';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = '#fbbf24';
    this.ctx.shadowBlur = 22;
    this.ctx.fillRect(px, py, panelW, panelH);
    this.ctx.strokeRect(px, py, panelW, panelH);

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#fde047';
    this.ctx.font = 'bold 24px "Courier New", monospace';
    this.ctx.fillText('🏆 GLOBAL RANKINGS // TOP 10 SURVIVORS 🏆', cx, py + 38);

    // Tabs: Top Damage to Toro | Best Survival Time
    for (const tabBtn of this.getLeaderboardTabRects()) {
      const isSelected = this.activeLeaderboardCategory === tabBtn.category;
      const isHovered = this.hoveredLeaderboardTab === tabBtn.category;

      this.ctx.fillStyle = isSelected
        ? tabBtn.category === 'TORO_DAMAGE'
          ? 'rgba(127, 29, 29, 0.95)'
          : 'rgba(12, 74, 110, 0.95)'
        : isHovered
        ? 'rgba(20, 40, 56, 0.92)'
        : 'rgba(8, 22, 32, 0.9)';
      this.ctx.strokeStyle = isSelected
        ? tabBtn.category === 'TORO_DAMAGE'
          ? '#ef4444'
          : '#38bdf8'
        : isHovered
        ? '#fde047'
        : '#475569';
      this.ctx.lineWidth = isSelected || isHovered ? 2.2 : 1.5;
      this.ctx.fillRect(tabBtn.x, tabBtn.y, tabBtn.width, tabBtn.height);
      this.ctx.strokeRect(tabBtn.x, tabBtn.y, tabBtn.width, tabBtn.height);

      this.ctx.fillStyle = isSelected ? '#ffffff' : '#cbd5e1';
      this.ctx.font = 'bold 14px "Courier New", monospace';
      this.ctx.fillText(tabBtn.label, tabBtn.x + tabBtn.width / 2, tabBtn.y + 23);
    }

    const tableX = cx - 318;
    const tableW = 636;
    const headerY = py + 112;

    this.ctx.fillStyle = 'rgba(15, 35, 50, 0.95)';
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 1.5;
    this.ctx.fillRect(tableX, headerY, tableW, 30);
    this.ctx.strokeRect(tableX, headerY, tableW, 30);

    this.ctx.font = 'bold 13px "Courier New", monospace';
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
      this.ctx.font = 'bold 16px "Courier New", monospace';
      this.ctx.fillText('⏳ Sincronizando Clasificación Global desde Firestore...', cx, py + 290);
    } else if (entries.length === 0) {
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '15px "Courier New", monospace';
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
          ? 'rgba(0, 65, 40, 0.92)'
          : i % 2 === 0
          ? 'rgba(8, 22, 32, 0.85)'
          : 'rgba(12, 30, 44, 0.85)';
        this.ctx.strokeStyle = isCurrentUser ? '#00ff66' : 'rgba(56, 189, 248, 0.25)';
        this.ctx.lineWidth = isCurrentUser ? 1.8 : 1;
        this.ctx.fillRect(tableX, rowY, tableW, rowH - 3);
        this.ctx.strokeRect(tableX, rowY, tableW, rowH - 3);

        // Recorte estricto por fila para no invadir bordes de tabla
        this.ctx.beginPath();
        this.ctx.rect(tableX + 2, rowY, tableW - 4, rowH - 3);
        this.ctx.clip();

        const rankColor =
          i === 0 ? '#fbbf24' : i === 1 ? '#e2e8f0' : i === 2 ? '#f97316' : '#94a3b8';
        const rankBadge = i === 0 ? '🥇 #1' : i === 1 ? '🥈 #2' : i === 2 ? '🥉 #3' : `#${i + 1}`;

        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = rankColor;
        this.ctx.font = 'bold 13px "Courier New", monospace';
        this.ctx.fillText(rankBadge, tableX + 18, rowY + 21);

        this.ctx.fillStyle = isCurrentUser ? '#00ff66' : '#ffffff';
        this.ctx.font = isCurrentUser
          ? 'bold 14px "Courier New", monospace'
          : '14px "Courier New", monospace';
        const rawName = entry.displayName || 'Survivor';
        const shownName = rawName.length > 24 ? rawName.slice(0, 23) + '…' : rawName;
        this.ctx.fillText(
          isCurrentUser ? `${shownName} (TÚ)` : shownName,
          tableX + 115,
          rowY + 21
        );

        this.ctx.textAlign = 'right';
        if (this.activeLeaderboardCategory === 'TORO_DAMAGE') {
          this.ctx.fillStyle = '#f87171';
          this.ctx.font = 'bold 14px "Courier New", monospace';
          this.ctx.fillText(
            `${entry.maxDamageToToro.toLocaleString('en-US')} DMG`,
            tableX + tableW - 18,
            rowY + 21
          );
        } else {
          this.ctx.fillStyle = '#38bdf8';
          this.ctx.font = 'bold 14px "Courier New", monospace';
          this.ctx.fillText(
            `${this.formatTimeMMSS(entry.bestTimeSeconds)} (${entry.bestTimeSeconds}s)`,
            tableX + tableW - 18,
            rowY + 21
          );
        }
        this.ctx.restore();
      }
    }

    // Botón Volver con auto-fit y recorte
    const backBtn = this.getLeaderboardBackButtonRect();
    this.drawClippedButton(
      backBtn,
      this.hoveredLeaderboardBackBtn ? 'rgba(0, 68, 40, 0.96)' : 'rgba(10, 32, 24, 0.94)',
      this.hoveredLeaderboardBackBtn ? '#ffffff' : '#00ff66',
      this.hoveredLeaderboardBackBtn ? 2.5 : 1.8,
      this.hoveredLeaderboardBackBtn ? '#ffffff' : '#00ff66',
      14,
      `[ESC / CLICK] ${i18n.t('VOLVER AL KERNEL HUB', 'RETURN TO KERNEL HUB')}`
    );

    this.ctx.restore();
  }

  private getOverlayBackButtonRect(
    panelY: number,
    panelH: number
  ): { x: number; y: number; width: number; height: number } {
    const cx = this.canvas.width / 2;
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
    const cx = this.canvas.width / 2;
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
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 4, 8, 0.92)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const panelW = 920;
    const panelH = 650;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2;

    this.ctx.fillStyle = 'rgba(4, 16, 22, 0.98)';
    this.ctx.strokeStyle = '#84cc16';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = '#84cc16';
    this.ctx.shadowBlur = 22;
    this.ctx.fillRect(px, py, panelW, panelH);
    this.ctx.strokeRect(px, py, panelW, panelH);

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#bef264';
    this.ctx.font = 'bold 24px "Courier New", monospace';
    this.ctx.fillText(
      `🏆 ${i18n.t('PROTOCOLO DE HITOS // LOGROS', 'MILESTONE PROTOCOL // ACHIEVEMENTS')} (${this.achievementSystem.getUnlockedCount()}/${this.achievementSystem.achievements.length})`,
      cx,
      py + 34
    );

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '12px "Courier New", monospace';
    this.ctx.fillText(
      i18n.t(
        'Recompensas en Criptomonedas acreditadas automáticamente al desbloquear cada hito.',
        'Cryptocurrency rewards automatically credited upon milestone completion.'
      ),
      cx,
      py + 54
    );

    // Pestañas Página 1 & Página 2 con auto-fit y recorte
    for (const tab of this.getAchievementsTabRects(py)) {
      const isActive = this.achievementsPage === tab.page;
      const isHovered = this.hoveredAchievementsTab === tab.page;

      this.drawClippedButton(
        tab,
        isActive
          ? 'rgba(30, 65, 20, 0.95)'
          : isHovered
          ? 'rgba(20, 45, 30, 0.85)'
          : 'rgba(10, 24, 20, 0.75)',
        isActive ? '#bef264' : isHovered ? '#84cc16' : 'rgba(71, 85, 105, 0.6)',
        isActive ? 2.2 : 1.2,
        isActive ? '#bef264' : isHovered ? '#ffffff' : '#94a3b8',
        12,
        tab.label,
        isActive ? '#bef264' : undefined,
        isActive ? 10 : undefined
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
      this.ctx.fillStyle = ach.unlocked ? 'rgba(5, 46, 22, 0.92)' : 'rgba(8, 18, 28, 0.88)';
      this.ctx.strokeStyle = ach.unlocked ? '#22c55e' : 'rgba(71, 85, 105, 0.4)';
      this.ctx.lineWidth = ach.unlocked ? 1.8 : 1;
      this.ctx.fillRect(col, cardY, cardW, cardH);
      this.ctx.strokeRect(col, cardY, cardW, cardH);

      // Recorte estricto dentro de la tarjeta para garantizar CERO desbordamientos
      this.ctx.beginPath();
      this.ctx.rect(col + 2, cardY + 2, cardW - 4, cardH - 4);
      this.ctx.clip();

      // Icono
      this.ctx.font = '24px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(ach.icon, col + 12, cardY + cardH / 2);

      // Recompensa a la derecha
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = ach.unlocked ? '#86efac' : '#fbbf24';
      this.ctx.font = 'bold 12px "Courier New", monospace';
      const rewardText = `+${ach.rewardCoins} 🪙`;
      this.ctx.fillText(rewardText, col + cardW - 12, cardY + 20);
      const rewardW = this.ctx.measureText(rewardText).width;

      // Título con auto-fit
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = ach.unlocked ? '#4ade80' : '#e2e8f0';
      const title = i18n.currentLang === 'EN' ? ach.titleEn : ach.title;
      const maxTitleW = cardW - 48 - rewardW - 14;
      let titleFontSize = 13;
      this.ctx.font = `bold ${titleFontSize}px "Courier New", monospace`;
      let titleMetrics = this.ctx.measureText(title).width;
      if (titleMetrics > maxTitleW) {
        titleFontSize = Math.max(10, Math.floor(13 * (maxTitleW / titleMetrics)));
        this.ctx.font = `bold ${titleFontSize}px "Courier New", monospace`;
      }
      this.ctx.fillText(title, col + 46, cardY + 20);

      // Descripción con auto-fit y truncado si fuera necesario
      this.ctx.fillStyle = '#94a3b8';
      const desc = i18n.currentLang === 'EN' ? ach.descriptionEn : ach.description;
      const maxDescW = cardW - 58;
      let descFontSize = 11;
      this.ctx.font = `${descFontSize}px "Courier New", monospace`;
      let descMetrics = this.ctx.measureText(desc).width;
      if (descMetrics > maxDescW) {
        descFontSize = Math.max(9, Math.floor(11 * (maxDescW / descMetrics)));
        this.ctx.font = `${descFontSize}px "Courier New", monospace`;
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

      // Barra de Progreso
      const progressRatio = Math.min(1, ach.current / ach.target);
      const barX = col + 46;
      const barY = cardY + 48;
      const barW = cardW - 146;
      const barH = 8;

      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      this.ctx.fillRect(barX, barY, barW, barH);
      this.ctx.fillStyle = ach.unlocked ? '#22c55e' : '#38bdf8';
      this.ctx.fillRect(barX, barY, barW * progressRatio, barH);

      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = ach.unlocked ? '#4ade80' : '#38bdf8';
      this.ctx.font = 'bold 10px "Courier New", monospace';
      const progressText = ach.unlocked
        ? i18n.t('COMPLETO', 'COMPLETED')
        : `${Math.floor(ach.current)}/${ach.target}`;
      this.ctx.fillText(progressText, col + cardW - 12, cardY + 56);

      this.ctx.restore();
    }

    // Botón Volver con auto-fit y recorte
    const backBtn = this.getOverlayBackButtonRect(py, panelH);
    this.drawClippedButton(
      backBtn,
      this.hoveredOverlayBackBtn ? 'rgba(0, 68, 40, 0.96)' : 'rgba(10, 32, 24, 0.94)',
      this.hoveredOverlayBackBtn ? '#ffffff' : '#00ff66',
      this.hoveredOverlayBackBtn ? 2.5 : 1.8,
      this.hoveredOverlayBackBtn ? '#ffffff' : '#00ff66',
      14,
      `[ESC / CLICK] ${i18n.t('VOLVER AL KERNEL HUB', 'RETURN TO KERNEL HUB')}`
    );

    this.ctx.restore();
  }

  private drawSettingsOverlay(): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 4, 8, 0.92)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const panelW = 660;
    const panelH = 520;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2;

    this.ctx.fillStyle = 'rgba(4, 16, 26, 0.98)';
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = '#38bdf8';
    this.ctx.shadowBlur = 22;
    this.ctx.fillRect(px, py, panelW, panelH);
    this.ctx.strokeRect(px, py, panelW, panelH);

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#7dd3fc';
    this.ctx.font = 'bold 24px "Courier New", monospace';
    this.ctx.fillText(
      i18n.t('⚙️ CONFIGURACIÓN DEL SISTEMA // AJUSTES', '⚙️ SYSTEM CONFIGURATION // SETTINGS'),
      cx,
      py + 40
    );

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '12px "Courier New", monospace';
    this.ctx.fillText(
      i18n.t(
        'Los cambios se guardan automáticamente en tu navegador.',
        'Changes are automatically saved in your browser.'
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
      this.ctx.font = 'bold 14px "Courier New", monospace';
      this.ctx.fillText(rows[r].label, cx - 240, y + 21);

      // Botón [-]
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 1.5;
      this.ctx.fillRect(cx + 70, y, 44, 32);
      this.ctx.strokeRect(cx + 70, y, 44, 32);

      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = 'bold 18px monospace';
      this.ctx.fillText('-', cx + 92, y + 22);

      // Valor central
      this.ctx.fillStyle = '#00ff66';
      this.ctx.font = 'bold 15px "Courier New", monospace';
      this.ctx.fillText(`${rows[r].value}%`, cx + 158, y + 21);

      // Botón [+]
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.fillRect(cx + 200, y, 44, 32);
      this.ctx.strokeRect(cx + 200, y, 44, 32);

      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = 'bold 18px monospace';
      this.ctx.fillText('+', cx + 222, y + 22);
    }

    // Toggle Mute
    const muteY = rowStartY + rowGap * 3 + 10;
    const muteActive = this.sound.muted;
    this.ctx.fillStyle = muteActive ? 'rgba(127, 29, 29, 0.92)' : 'rgba(10, 45, 30, 0.92)';
    this.ctx.strokeStyle = muteActive ? '#ef4444' : '#00ff66';
    this.ctx.lineWidth = 1.8;
    this.ctx.fillRect(cx - 240, muteY, 230, 38);
    this.ctx.strokeRect(cx - 240, muteY, 230, 38);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = muteActive ? '#fca5a5' : '#86efac';
    this.ctx.font = 'bold 13px "Courier New", monospace';
    const muteLabel = muteActive
      ? i18n.t('MUTE: SILENCIADO', 'MUTE: MUTED')
      : i18n.t('MUTE: SONIDO ON', 'MUTE: AUDIO ON');
    this.ctx.fillText(muteLabel, cx - 125, muteY + 24);

    // Toggle Screen Shake
    const shakeActive = this.sound.screenShakeEnabled;
    this.ctx.fillStyle = shakeActive ? 'rgba(10, 45, 30, 0.92)' : 'rgba(30, 41, 59, 0.92)';
    this.ctx.strokeStyle = shakeActive ? '#00ff66' : '#64748b';
    this.ctx.lineWidth = 1.8;
    this.ctx.fillRect(cx + 10, muteY, 230, 38);
    this.ctx.strokeRect(cx + 10, muteY, 230, 38);

    this.ctx.fillStyle = shakeActive ? '#86efac' : '#94a3b8';
    const shakeLabel = shakeActive
      ? i18n.t('AGITADO PANTALLA: ON', 'SCREEN SHAKE: ON')
      : i18n.t('AGITADO PANTALLA: OFF', 'SCREEN SHAKE: OFF');
    this.ctx.fillText(shakeLabel, cx + 125, muteY + 24);

    // ==========================================
    // SECTOR IDIOMA / LANGUAGE (ES / EN)
    // ==========================================
    const langY = py + 316;
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.font = 'bold 14px "Courier New", monospace';
    this.ctx.fillText(i18n.t('IDIOMA / LANGUAGE:', 'LANGUAGE / IDIOMA:'), cx - 240, langY + 24);

    // Botón Español
    const isEs = i18n.currentLang === 'ES';
    this.ctx.fillStyle = isEs ? 'rgba(6, 78, 59, 0.95)' : 'rgba(15, 23, 42, 0.85)';
    this.ctx.strokeStyle = isEs ? '#00ff66' : '#334155';
    this.ctx.lineWidth = isEs ? 2.2 : 1.2;
    if (isEs) {
      this.ctx.shadowColor = '#00ff66';
      this.ctx.shadowBlur = 10;
    }
    this.ctx.fillRect(cx - 20, langY, 120, 38);
    this.ctx.strokeRect(cx - 20, langY, 120, 38);
    this.ctx.shadowBlur = 0;

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = isEs ? '#ffffff' : '#94a3b8';
    this.ctx.font = 'bold 13px "Courier New", monospace';
    this.ctx.fillText(isEs ? '✓ ESPAÑOL' : 'ESPAÑOL', cx + 40, langY + 24);

    // Botón Inglés
    const isEn = i18n.currentLang === 'EN';
    this.ctx.fillStyle = isEn ? 'rgba(14, 116, 144, 0.95)' : 'rgba(15, 23, 42, 0.85)';
    this.ctx.strokeStyle = isEn ? '#38bdf8' : '#334155';
    this.ctx.lineWidth = isEn ? 2.2 : 1.2;
    if (isEn) {
      this.ctx.shadowColor = '#38bdf8';
      this.ctx.shadowBlur = 10;
    }
    this.ctx.fillRect(cx + 120, langY, 120, 38);
    this.ctx.strokeRect(cx + 120, langY, 120, 38);
    this.ctx.shadowBlur = 0;

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = isEn ? '#ffffff' : '#94a3b8';
    this.ctx.font = 'bold 13px "Courier New", monospace';
    this.ctx.fillText(isEn ? '✓ ENGLISH' : 'ENGLISH', cx + 180, langY + 24);

    // Botón Guardar y Volver con auto-fit y recorte
    const backBtn = this.getOverlayBackButtonRect(py, panelH);
    this.drawClippedButton(
      backBtn,
      this.hoveredOverlayBackBtn ? 'rgba(0, 68, 40, 0.96)' : 'rgba(10, 32, 24, 0.94)',
      this.hoveredOverlayBackBtn ? '#ffffff' : '#00ff66',
      this.hoveredOverlayBackBtn ? 2.5 : 1.8,
      this.hoveredOverlayBackBtn ? '#ffffff' : '#00ff66',
      14,
      `[ESC / CLICK] ${i18n.t('GUARDAR Y VOLVER', 'SAVE & RETURN')}`
    );

    this.ctx.restore();
  }

  private drawHelpOverlay(): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 4, 8, 0.92)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const panelW = 900;
    const panelH = 590;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2;

    this.ctx.fillStyle = 'rgba(12, 6, 22, 0.98)';
    this.ctx.strokeStyle = '#d946ef';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = '#d946ef';
    this.ctx.shadowBlur = 22;
    this.ctx.fillRect(px, py, panelW, panelH);
    this.ctx.strokeRect(px, py, panelW, panelH);

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#f0abfc';
    this.ctx.font = 'bold 24px "Courier New", monospace';
    this.ctx.fillText(
      `📖 ${i18n.t('MANUAL DE OPERACIONES DEL KERNEL // CÓMO JUGAR', 'KERNEL OPERATIONS MANUAL // HOW TO PLAY')}`,
      cx,
      py + 38
    );

    const cards = [
      {
        title: i18n.t('🎮 1. MOVIMIENTO Y CONTROLES', '🎮 1. MOVEMENT & CONTROLS'),
        lines:
          i18n.currentLang === 'EN'
            ? [
                '• [WASD / Arrows]: Agent movement.',
                '• [P]: Tactical system pause.',
                '• [H in combat]: Toggle attack range circle.',
                '• Auto-fire: Weapons target highest threat.',
              ]
            : [
                '• [WASD / Flechas]: Desplazamiento del Agente.',
                '• [P]: Pausa táctica del sistema.',
                '• [H en combate]: Alternar círculo de alcance.',
                '• Disparo automático: Ataca al malware prioritario.',
              ],
        color: '#00ff66',
        border: 'rgba(0, 255, 102, 0.35)',
      },
      {
        title: i18n.t('⚡ 2. ARSENAL Y PROGRESIÓN', '⚡ 2. ARSENAL & PROGRESSION'),
        lines:
          i18n.currentLang === 'EN'
            ? [
                '• Collect XP orbs to install level-up patches.',
                '• Strict limit of 4 active weapon slots.',
                '• Combine weapons and passives for synergies.',
                '• Unlock and equip hats in the Gacha [G]',
                '  to gain permanent passive bonuses.',
              ]
            : [
                '• Recoge orbes de XP para instalar parches de nivel.',
                '• Límite estricto de 4 ranuras de armas activas.',
                '• Combina armas y pasivas para crear sinergias.',
                '• Desbloquea y equipa sombreros en el Gacha [G]',
                '  para obtener bonificaciones pasivas permanentes.',
              ],
        color: '#38bdf8',
        border: 'rgba(56, 189, 248, 0.35)',
      },
      {
        title: i18n.t('⚔️ 3. JEFES DE OLEADA Y BOTÍN', '⚔️ 3. WAVE BOSSES & LOOT'),
        lines:
          i18n.currentLang === 'EN'
            ? [
                '• Periodic colossal bosses spawn in the malware horde.',
                '• Defeat them to collect massive XP, +5 CryptoCoins',
                '• and a GUARANTEED Power-Up (Nuke, Freeze, Overclock)!',
                '• Upgrade your arsenal to maximum power.',
                '• Survive the evolving waves for 11-12 minutes!',
              ]
            : [
                '• Jefes colosales periódicos aparecen en la horda.',
                '• ¡Derrótalos para obtener gran botín de XP, +5 Cripto',
                '• y un Power-Up GARANTIZADO (Bomba, Hielo, Overclock)!',
                '• Mejora tu arsenal al máximo nivel.',
                '• ¡Sobrevive a las amenazas durante 11-12 minutos!',
              ],
        color: '#fbbf24',
        border: 'rgba(251, 191, 36, 0.35)',
      },
      {
        title: i18n.t('🐂 4. JEFE FINAL: "EL TORO" (INVENCIBLE)', '🐂 4. FINAL BOSS: "EL TORO" (INVINCIBLE)'),
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
        color: '#f87171',
        border: 'rgba(248, 113, 113, 0.35)',
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
      this.ctx.fillStyle = 'rgba(6, 12, 20, 0.9)';
      this.ctx.strokeStyle = card.border;
      this.ctx.lineWidth = 1.5;
      this.ctx.fillRect(colX, rowY, cardW, cardH);
      this.ctx.strokeRect(colX, rowY, cardW, cardH);

      // Recorte estricto dentro de la tarjeta
      this.ctx.beginPath();
      this.ctx.rect(colX + 2, rowY + 2, cardW - 4, cardH - 4);
      this.ctx.clip();

      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = card.color;
      this.ctx.font = 'bold 13px "Courier New", monospace';
      this.ctx.fillText(card.title, colX + 16, rowY + 28);

      this.ctx.fillStyle = '#cbd5e1';
      const maxLineW = cardW - 32;
      for (let l = 0; l < card.lines.length; l++) {
        const lineText = card.lines[l];
        let lineFont = 12;
        this.ctx.font = `${lineFont}px "Courier New", monospace`;
        const lm = this.ctx.measureText(lineText).width;
        if (lm > maxLineW) {
          lineFont = Math.max(9.5, Math.floor(12 * (maxLineW / lm)));
          this.ctx.font = `${lineFont}px "Courier New", monospace`;
        }
        this.ctx.fillText(lineText, colX + 16, rowY + 58 + l * 26);
      }
      this.ctx.restore();
    }

    // Botón Volver con auto-fit y recorte
    const backBtn = this.getOverlayBackButtonRect(py, panelH);
    this.drawClippedButton(
      backBtn,
      this.hoveredOverlayBackBtn ? 'rgba(0, 68, 40, 0.96)' : 'rgba(10, 32, 24, 0.94)',
      this.hoveredOverlayBackBtn ? '#ffffff' : '#00ff66',
      this.hoveredOverlayBackBtn ? 2.5 : 1.8,
      this.hoveredOverlayBackBtn ? '#ffffff' : '#00ff66',
      14,
      `[ESC / CLICK] ${i18n.t('VOLVER AL KERNEL HUB', 'RETURN TO KERNEL HUB')}`
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

  private drawCyberGrid(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const gridSize = 48;
    const majorSize = gridSize * 4;
    const tSec = performance.now() * 0.001;

    this.ctx.save();

    // Fondo radial profundo (con margen extra por si hay screen shake)
    const bgGrad = this.ctx.createRadialGradient(
      w * 0.5,
      h * 0.5,
      60,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.72
    );
    bgGrad.addColorStop(0, '#041a14');
    bgGrad.addColorStop(1, '#010305');
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(-24, -24, w + 48, h + 48);

    // Rejilla secundaria verde
    this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.045)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let x = 0; x <= w; x += gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
    }
    this.ctx.stroke();

    // Rejilla principal cian
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.11)';
    this.ctx.beginPath();
    for (let x = majorSize; x < w; x += majorSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
    }
    for (let y = majorSize; y < h; y += majorSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
    }
    this.ctx.stroke();

    // Nodos (+) en intersecciones principales
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    this.ctx.beginPath();
    for (let x = majorSize; x < w; x += majorSize) {
      for (let y = majorSize; y < h; y += majorSize) {
        this.ctx.moveTo(x - 4, y);
        this.ctx.lineTo(x + 4, y);
        this.ctx.moveTo(x, y - 4);
        this.ctx.lineTo(x, y + 4);
      }
    }
    this.ctx.stroke();

    // Barrido de escaneo cibernético sutil
    const scanY = ((tSec * 90) % (h + 160)) - 80;
    const scanGrad = this.ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
    scanGrad.addColorStop(0, 'rgba(0, 255, 102, 0)');
    scanGrad.addColorStop(0.5, 'rgba(0, 255, 150, 0.055)');
    scanGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    this.ctx.fillStyle = scanGrad;
    this.ctx.fillRect(-24, scanY - 40, w + 48, 80);

    // Partículas ambientales flotantes del kernel
    for (let i = 0; i < this.ambientNodes.length; i++) {
      const node = this.ambientNodes[i];
      const nx = (((node.x + node.vx * tSec) % w) + w) % w;
      const ny = (((node.y + node.vy * tSec) % h) + h) % h;
      const pulse = 0.7 + 0.3 * Math.sin(tSec * 2.2 + i);
      this.ctx.fillStyle = i % 3 === 0 ? '#38bdf8' : '#00ff66';
      this.ctx.globalAlpha = node.alpha * pulse;
      this.ctx.fillRect(nx - node.size * 0.5, ny - node.size * 0.5, node.size, node.size);
    }

    this.ctx.restore();
  }

  private drawXpBar(): void {
    const barHeight = 9;
    const w = this.canvas.width;
    const ratio = Math.max(
      0,
      Math.min(1, this.upgradeSystem.currentXp / Math.max(1, this.upgradeSystem.xpToNextLevel))
    );
    const fillW = w * ratio;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(4, 16, 26, 0.94)';
    this.ctx.fillRect(0, 0, w, barHeight);

    if (fillW > 0) {
      const xpGrad = this.ctx.createLinearGradient(0, 0, Math.max(40, fillW), 0);
      xpGrad.addColorStop(0, '#0284c7');
      xpGrad.addColorStop(0.6, '#00f0ff');
      xpGrad.addColorStop(1, '#00ff88');
      this.ctx.fillStyle = xpGrad;
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 10;
      this.ctx.fillRect(0, 0, fillW, barHeight);

      // Destello brillante en el borde de avance
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(Math.max(0, fillW - 3), 0, Math.min(3, fillW), barHeight);
    }

    // Marcas sutiles de cuartos (25%, 50%, 75%)
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
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
    const w = this.canvas.width;
    const hpRatio = Math.max(0, Math.min(1, this.player.hp / Math.max(1, this.player.maxHp)));

    this.ctx.save();

    // ==========================================
    // 1. POD SUPERIOR IZQUIERDO: AGENTE, NIVEL, HP BAR Y ARSENAL
    // ==========================================
    const lx = 16;
    const ly = 18;
    const lw = 348;
    const lh = 74;
    this.drawCyberPanel(lx, ly, lw, lh, 10, 'rgba(3, 14, 18, 0.84)', 'rgba(0, 255, 136, 0.55)', 1.6);

    this.ctx.save();
    this.traceChamferRect(lx + 2, ly + 2, lw - 4, lh - 4, 8);
    this.ctx.clip();

    // Indicador del agente + Nivel + Multiplicador XP
    this.ctx.fillStyle = this.player.color;
    this.ctx.beginPath();
    this.ctx.arc(lx + 18, ly + 17, 4.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `bold 13.5px ${FONT_DISPLAY}`;
    this.ctx.fillText(this.player.profileName, lx + 29, ly + 22);

    const nameW = this.ctx.measureText(this.player.profileName).width;
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.font = `bold 11.5px ${FONT_MONO}`;
    this.ctx.fillText(`LVL ${this.upgradeSystem.level}.0`, lx + 38 + nameW, ly + 22);

    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = '#a3e635';
    this.ctx.font = `bold 11.5px ${FONT_MONO}`;
    this.ctx.fillText(`XP x${this.player.xpMultiplier.toFixed(2)}`, lx + lw - 14, ly + 22);

    // Barra gráfica de HP
    const hpBarX = lx + 14;
    const hpBarY = ly + 31;
    const hpBarW = lw - 28;
    const hpBarH = 16;

    this.ctx.fillStyle = 'rgba(12, 8, 16, 0.94)';
    this.ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);

    if (hpRatio > 0) {
      const hpGrad = this.ctx.createLinearGradient(hpBarX, 0, hpBarX + hpBarW * hpRatio, 0);
      if (hpRatio > 0.5) {
        hpGrad.addColorStop(0, '#059669');
        hpGrad.addColorStop(1, '#00ff88');
      } else if (hpRatio > 0.25) {
        hpGrad.addColorStop(0, '#d97706');
        hpGrad.addColorStop(1, '#fbbf24');
      } else {
        hpGrad.addColorStop(0, '#b91c1c');
        hpGrad.addColorStop(1, '#ff1e42');
      }
      this.ctx.fillStyle = hpGrad;
      this.ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);

      // Brillo superior sutil
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      this.ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, 4);
    }

    this.ctx.strokeStyle = hpRatio <= 0.25 ? '#ff4d6d' : 'rgba(255, 255, 255, 0.25)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    this.ctx.shadowBlur = 3;
    this.ctx.font = `bold 11px ${FONT_MONO}`;
    this.ctx.fillText(
      `HP ${Math.max(0, Math.ceil(this.player.hp))} / ${this.player.maxHp}`,
      hpBarX + hpBarW / 2,
      hpBarY + 12
    );
    this.ctx.shadowBlur = 0;

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
    this.ctx.fillText(weaponsLabel, lx + 14, ly + 64);
    this.ctx.restore();

    // ==========================================
    // 2. POD SUPERIOR DERECHO: CRONÓMETRO, BAJAS, CRIPTO Y PROTOCOLO TORO
    // ==========================================
    const rw = 312;
    const rx = w - rw - 16;
    const ry = 18;
    const rh = 74;
    const timeUntilToro = Math.max(0, FINAL_BOSS_ARRIVAL_TIME - this.elapsedTime);
    const toroStroke = this.spawner.finalBossMode
      ? 'rgba(255, 30, 66, 0.85)'
      : 'rgba(56, 189, 248, 0.55)';
    this.drawCyberPanel(rx, ry, rw, rh, 10, 'rgba(3, 14, 18, 0.84)', toroStroke, 1.6);

    this.ctx.save();
    this.traceChamferRect(rx + 2, ry + 2, rw - 4, rh - 4, 8);
    this.ctx.clip();

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `bold 18px ${FONT_MONO}`;
    this.ctx.fillText(this.formatTimeMMSS(this.elapsedTime), rx + 14, ry + 26);

    this.ctx.fillStyle = '#fda4af';
    this.ctx.font = `bold 12px ${FONT_MONO}`;
    this.ctx.fillText(`☠ ${this.killCount}`, rx + 92, ry + 25);

    this.ctx.fillStyle = '#fbbf24';
    this.ctx.fillText(`🪙 ${this.runCoinsCollected}`, rx + 162, ry + 25);

    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = `bold 11px ${FONT_MONO}`;
    this.ctx.fillText(`[P] ${i18n.t('PAUSA', 'PAUSE')}`, rx + rw - 14, ry + 24);

    // Separador fino
    this.ctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
    this.ctx.fillRect(rx + 14, ry + 36, rw - 28, 1);

    const bossProgressLabel = this.spawner.finalBossMode
      ? i18n.t('⚔ FASE: JEFE FINAL [EL TORO]', '⚔ PHASE: FINAL BOSS [EL TORO]')
      : i18n.t(
          `OBJETIVO: TORO EN ${this.formatTimeMMSS(timeUntilToro)} • JEFES: ${this.runBossesKilled}`,
          `TARGET: TORO IN ${this.formatTimeMMSS(timeUntilToro)} • BOSSES: ${this.runBossesKilled}`
        );

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = this.spawner.finalBossMode ? '#ff4d6d' : '#38bdf8';
    let objFont = 11.5;
    const maxObjW = rw - 26;
    this.ctx.font = `bold ${objFont}px ${FONT_DISPLAY}`;
    const objMetrics = this.ctx.measureText(bossProgressLabel).width;
    if (objMetrics > maxObjW) {
      objFont = Math.max(9.5, Math.floor(11.5 * (maxObjW / objMetrics)));
      this.ctx.font = `bold ${objFont}px ${FONT_DISPLAY}`;
    }
    this.ctx.fillText(bossProgressLabel, rx + rw / 2, ry + 58);
    this.ctx.restore();

    this.ctx.restore();
  }

  private drawBossHUD(): void {
    this.ctx.save();
    this.ctx.textAlign = 'center';

    // UI Dedicada exclusivamente al Jefe Final ("El Toro") cuando está activo
    if (this.finalBoss && this.finalBoss.active) {
      const panelW = Math.min(640, this.canvas.width * 0.72);
      const panelH = 68;
      const px = (this.canvas.width - panelW) / 2;
      const py = this.canvas.height - 84;

      this.drawCyberPanel(
        px,
        py,
        panelW,
        panelH,
        12,
        'rgba(28, 4, 8, 0.92)',
        this.finalBoss.state === 'TELEGRAPH' ? '#facc15' : '#ef4444',
        2.4,
        '#dc2626',
        18
      );

      this.ctx.fillStyle = '#fca5a5';
      this.ctx.font = `bold 13px ${FONT_DISPLAY}`;
      this.ctx.fillText(
        i18n.t(
          `🐂 JEFE FINAL: EL TORO [INVENCIBLE // CONTACTO: 50% HP MÁX] | ${this.finalBoss.getDashStatusText()}`,
          `🐂 FINAL BOSS: EL TORO [INVINCIBLE // CONTACT: 50% MAX HP] | ${this.finalBoss.getDashStatusText()}`
        ),
        this.canvas.width / 2,
        py + 24
      );

      this.ctx.fillStyle = '#facc15';
      this.ctx.shadowColor = '#f59e0b';
      this.ctx.shadowBlur = 12;
      this.ctx.font = `bold 20px ${FONT_MONO}`;
      this.ctx.fillText(
        `${i18n.t('DAÑO TOTAL ACUMULADO', 'TOTAL DAMAGE DEALT')}: ${Math.round(this.finalBoss.totalDamageTaken)}`,
        this.canvas.width / 2,
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
        const alertColor = this.spawner.lastBossSpawnedColor || '#ff0055';
        this.ctx.fillStyle = alertColor;
        this.ctx.shadowColor = alertColor;
        this.ctx.shadowBlur = 18;
        this.ctx.font = `bold 20px ${FONT_DISPLAY}`;
        this.ctx.fillText(
          `!! WARNING: ${this.spawner.lastBossSpawnedName} DETECTED !!`,
          this.canvas.width / 2,
          104
        );
      }
    }

    if (activeBoss) {
      const barWidth = Math.min(520, this.canvas.width * 0.55);
      const barHeight = 14;
      const x = (this.canvas.width - barWidth) / 2;
      const y = this.canvas.height - 46;
      const ratio = Math.max(0, activeBoss.hp / activeBoss.maxHp);
      const bossColor = activeBoss.bossColor || '#ff0055';

      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = bossColor;
      this.ctx.font = `bold 13.5px ${FONT_MONO}`;
      this.ctx.fillText(
        `${activeBoss.bossName} // INTEGRITY: ${activeBoss.hp}/${activeBoss.maxHp}`,
        this.canvas.width / 2,
        y - 8
      );

      this.drawCyberPanel(x, y, barWidth, barHeight, 4, 'rgba(20, 0, 10, 0.9)', '#ffffff', 1.5);

      if (ratio > 0) {
        this.ctx.save();
        this.traceChamferRect(x + 1, y + 1, barWidth - 2, barHeight - 2, 3);
        this.ctx.clip();
        this.ctx.fillStyle = bossColor;
        this.ctx.shadowColor = bossColor;
        this.ctx.shadowBlur = 12;
        this.ctx.fillRect(x, y, barWidth * ratio, barHeight);
        this.ctx.restore();
      }
    }

    this.ctx.restore();
  }

  private getUpgradeCardRects(): CardRect[] {
    const choices = this.upgradeSystem.currentChoices;
    const cardWidth = 350;
    const cardHeight = 270;
    const gap = 32;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * gap;
    const startX = (this.canvas.width - totalWidth) / 2;
    const y = this.canvas.height / 2 - cardHeight / 2 + 25;

    return choices.map((_, index) => ({
      index,
      x: startX + index * (cardWidth + gap),
      y,
      width: cardWidth,
      height: cardHeight,
    }));
  }

  private drawUpgradeModal(): void {
    const choices = this.upgradeSystem.currentChoices;
    const cards = this.getUpgradeCardRects();

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 8, 5, 0.88)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff66';
    this.ctx.shadowColor = '#00ff66';
    this.ctx.shadowBlur = 16;
    this.ctx.font = `bold 28px ${FONT_DISPLAY}`;
    this.ctx.fillText(
      `// ${i18n.t('TARJETAS DE MEJORA', 'UPGRADE CARDS')} :: ${i18n.t('NIVEL', 'LEVEL')} ${this.upgradeSystem.level}.0 //`,
      this.canvas.width / 2,
      this.canvas.height / 2 - 150
    );

    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.font = `15px ${FONT_DISPLAY}`;
    this.ctx.fillText(
      i18n.t(
        'Elige 1 de las 3 Tarjetas de Mejora con las teclas [1] [2] [3] o haciendo clic:',
        'Choose 1 of 3 Upgrade Cards using keys [1] [2] [3] or clicking:'
      ),
      this.canvas.width / 2,
      this.canvas.height / 2 - 118
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
        isHovered ? 'rgba(0, 42, 30, 0.96)' : 'rgba(5, 16, 14, 0.94)',
        isHovered ? '#ffffff' : opt.color,
        isHovered ? 2.5 : 1.8,
        opt.color,
        isHovered ? 18 : 9
      );

      // Recorte estricto dentro de la tarjeta de mejora biselada
      this.traceChamferRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, 12);
      this.ctx.clip();

      const cardCategory = i18n.currentLang === 'EN' && opt.categoryEn ? opt.categoryEn : opt.category;
      const cardName = i18n.currentLang === 'EN' && opt.nameEn ? opt.nameEn : opt.name;
      const cardDesc = i18n.currentLang === 'EN' && opt.descriptionEn ? opt.descriptionEn : opt.description;
      const cardStat = i18n.currentLang === 'EN' && opt.statBadgeEn ? opt.statBadgeEn : opt.statBadge;

      this.ctx.shadowBlur = 0;
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = opt.color;
      this.ctx.font = `bold 12px ${FONT_MONO}`;
      this.ctx.fillText(`[KEY ${i + 1}] // ${cardCategory}`, rect.x + 18, rect.y + 26);

      // Auto-fit para el nombre de la carta
      const nameMaxW = rect.width - 36;
      let nameFont = 18;
      this.ctx.font = `bold ${nameFont}px ${FONT_DISPLAY}`;
      const nMetrics = this.ctx.measureText(cardName).width;
      if (nMetrics > nameMaxW) {
        nameFont = Math.max(12.5, Math.floor(18 * (nameMaxW / nMetrics)));
        this.ctx.font = `bold ${nameFont}px ${FONT_DISPLAY}`;
      }
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(cardName, rect.x + 18, rect.y + 54);

      this.ctx.fillStyle = '#00ff66';
      this.ctx.font = `bold 12px ${FONT_MONO}`;
      this.ctx.fillText(
        opt.level === 0
          ? i18n.t('Estado: NUEVA TARJETA -> v1.0', 'Status: NEW CARD -> v1.0')
          : i18n.t(
              `Nivel: v${opt.level}.0 -> v${opt.level + 1}.0 (Máx ${opt.maxLevel})`,
              `Level: v${opt.level}.0 -> v${opt.level + 1}.0 (Max ${opt.maxLevel})`
            ),
        rect.x + 18,
        rect.y + 78
      );

      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.font = `13px ${FONT_DISPLAY}`;
      this.wrapText(cardDesc, rect.x + 18, rect.y + 104, rect.width - 36, 18, 2);

      // Estadísticas de mejora presentadas limpiamente sin caja tosca
      if (cardStat) {
        this.ctx.save();
        this.ctx.textAlign = 'center';

        const dividerY = rect.y + 148;
        // Línea divisoria superior sutil con degradado neón
        const grad = this.ctx.createLinearGradient(rect.x + 24, dividerY, rect.x + rect.width - 24, dividerY);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.25, opt.color);
        grad.addColorStop(0.75, opt.color);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.strokeStyle = grad;
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.moveTo(rect.x + 24, dividerY);
        this.ctx.lineTo(rect.x + rect.width - 24, dividerY);
        this.ctx.stroke();

        // Tipografía de estadísticas luminosa y limpia, sin caja
        this.ctx.shadowColor = opt.color;
        this.ctx.shadowBlur = 8;
        this.ctx.fillStyle = '#ffffff';
        let badgeFont = 12.5;
        const badgeMaxW = rect.width - 36;
        this.ctx.font = `bold ${badgeFont}px ${FONT_MONO}`;
        const bMetrics = this.ctx.measureText(cardStat).width;
        if (bMetrics > badgeMaxW) {
          badgeFont = Math.max(9.5, Math.floor(12.5 * (badgeMaxW / bMetrics)));
          this.ctx.font = `bold ${badgeFont}px ${FONT_MONO}`;
        }
        this.ctx.fillText(cardStat, rect.x + rect.width / 2, dividerY + 23);

        // Línea divisoria inferior sutil
        this.ctx.shadowBlur = 0;
        this.ctx.beginPath();
        this.ctx.moveTo(rect.x + 40, dividerY + 38);
        this.ctx.lineTo(rect.x + rect.width - 40, dividerY + 38);
        this.ctx.stroke();

        this.ctx.restore();
      }

      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = isHovered ? '#ffffff' : opt.color;
      this.ctx.font = `bold 13px ${FONT_DISPLAY}`;
      this.ctx.fillText(
        `> ${i18n.t('SELECCIONAR TARJETA', 'SELECT CARD')} [${i + 1}] <`,
        rect.x + rect.width / 2,
        rect.y + rect.height - 18
      );

      this.ctx.restore();
    }

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
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(8, 0, 2, 0.88)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const boxW = 880;
    const boxH = 580;
    this.drawCyberPanel(
      cx - boxW / 2,
      cy - boxH / 2,
      boxW,
      boxH,
      16,
      'rgba(18, 2, 6, 0.96)',
      '#ff1e42',
      2.5,
      '#ff1e42',
      24
    );

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#ff1e42';
    this.ctx.font = `bold 30px ${FONT_DISPLAY}`;
    this.ctx.fillText('KERNEL PANIC // SYSTEM COMPROMISED', cx, cy - 235);

    // Resumen General
    this.ctx.fillStyle = '#00ff66';
    this.ctx.font = `bold 14px ${FONT_MONO}`;
    this.ctx.fillText(
      `${i18n.t('Agente', 'Agent')}: ${this.player.profileName} (v${this.upgradeSystem.level}.0)  |  ${i18n.t('Tiempo', 'Time')}: ${this.formatTimeMMSS(this.elapsedTime)}  |  ${i18n.t('Bajas', 'Kills')}: ${this.killCount}  |  ${i18n.t('Cripto', 'Crypto')}: +${this.runCoinsCollected} 🪙`,
      cx,
      cy - 200
    );

    if (this.runDamageToToro > 0) {
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.font = `bold 14px ${FONT_MONO}`;
      this.ctx.fillText(
        `🐂 ${i18n.t('DAÑO AL JEFE FINAL (EL TORO)', 'DAMAGE TO FINAL BOSS (EL TORO)')}: ${this.runDamageToToro.toLocaleString('en-US')} DMG`,
        cx,
        cy - 176
      );
    }

    // Dos Paneles: Izquierda (Daño por Arma) | Derecha (Bajas por Tipo)
    const panelY = cy - 150;
    const subW = 405;
    const subH = 320;
    const leftX = cx - subW - 12;
    const rightX = cx + 12;

    // Panel Izquierdo: Rendimiento de Arsenal
    this.ctx.save();
    this.drawCyberPanel(leftX, panelY, subW, subH, 10, 'rgba(10, 2, 6, 0.9)', '#f43f5e', 1.5);

    // Recorte estricto para el panel izquierdo
    this.traceChamferRect(leftX + 2, panelY + 2, subW - 4, subH - 4, 8);
    this.ctx.clip();

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#fb7185';
    this.ctx.font = `bold 14px ${FONT_DISPLAY}`;
    this.ctx.fillText(`⚔️ ${i18n.t('RENDIMIENTO DE ARSENAL (DAÑO)', 'ARSENAL PERFORMANCE (DAMAGE)')}`, leftX + 16, panelY + 28);

    const weaponDamages = Object.entries(this.combatSystem.weaponDamageStats)
      .filter(([_, dmg]) => dmg > 0)
      .map(([name, damage]) => ({ name, damage }))
      .sort((a, b) => b.damage - a.damage);
    const totalDmg = weaponDamages.reduce((sum, w) => sum + w.damage, 0) || 1;

    const rowColors = ['#00ff66', '#38bdf8', '#fbbf24', '#ff8800', '#d946ef', '#ec4899', '#a3e635'];

    if (weaponDamages.length === 0) {
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '12px "Courier New", monospace';
      this.ctx.fillText(i18n.t('Sin registros de daño con armas.', 'No weapon damage recorded.'), leftX + 16, panelY + 60);
    } else {
      for (let w = 0; w < Math.min(6, weaponDamages.length); w++) {
        const item = weaponDamages[w];
        const rowY = panelY + 54 + w * 42;
        const pct = Math.round((item.damage / totalDmg) * 100);
        const col = rowColors[w % rowColors.length];

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px "Courier New", monospace';
        this.ctx.fillText(item.name, leftX + 16, rowY + 12);

        this.ctx.textAlign = 'right';
        this.ctx.fillStyle = col;
        this.ctx.fillText(`${item.damage.toLocaleString('en-US')} (${pct}%)`, leftX + subW - 16, rowY + 12);

        this.ctx.textAlign = 'left';
        // Barra
        const barW = subW - 32;
        this.ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
        this.ctx.fillRect(leftX + 16, rowY + 18, barW, 8);
        this.ctx.fillStyle = col;
        this.ctx.fillRect(leftX + 16, rowY + 18, (item.damage / totalDmg) * barW, 8);
      }
    }
    this.ctx.restore();

    // Panel Derecho: Amenazas Purgadas
    this.ctx.save();
    this.drawCyberPanel(rightX, panelY, subW, subH, 10, 'rgba(10, 2, 6, 0.9)', '#38bdf8', 1.5);

    // Recorte estricto para el panel derecho
    this.traceChamferRect(rightX + 2, panelY + 2, subW - 4, subH - 4, 8);
    this.ctx.clip();

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#7dd3fc';
    this.ctx.font = `bold 14px ${FONT_DISPLAY}`;
    this.ctx.fillText(`👾 ${i18n.t('REGISTRO DE AMENAZAS PURGADAS', 'PURGED THREATS LOG')}`, rightX + 16, panelY + 28);

    const enemyRows = [
      { name: i18n.t('Adware Básico (Rojos)', 'Basic Adware (Red)'), count: this.combatSystem.killsByTypeStats['Adware'], color: '#ef4444' },
      { name: i18n.t('Troyanos Rápidos (Amarillos)', 'Fast Trojans (Yellow)'), count: this.combatSystem.killsByTypeStats['Trojan'], color: '#eab308' },
      { name: i18n.t('Gusanos Divisibles (Morados)', 'Splitting Worms (Purple)'), count: this.combatSystem.killsByTypeStats['Worm'], color: '#a855f7' },
      { name: i18n.t('Evasores (Ghost Scripts)', 'Evasors (Ghost Scripts)'), count: this.combatSystem.killsByTypeStats['Evasor'], color: '#06b6d4' },
      { name: i18n.t('Cajas de Hardware Destruidas', 'Hardware Crates Destroyed'), count: this.combatSystem.killsByTypeStats['Hardware Box'], color: '#f97316' },
      { name: i18n.t('Jefes de Oleada Purgados', 'Wave Bosses Purged'), count: this.runBossesKilled, color: '#22c55e' },
    ];

    for (let e = 0; e < enemyRows.length; e++) {
      const er = enemyRows[e];
      const rY = panelY + 58 + e * 40;

      this.ctx.fillStyle = er.color;
      this.ctx.fillRect(rightX + 16, rY + 3, 8, 8);

      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.font = '12px "Courier New", monospace';
      this.ctx.fillText(er.name, rightX + 32, rY + 12);

      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 13px "Courier New", monospace';
      this.ctx.fillText(`${er.count}`, rightX + subW - 16, rY + 12);
      this.ctx.textAlign = 'left';
    }
    this.ctx.restore();

    // Pie de Acción
    const blink = Math.floor(performance.now() / 450) % 2 === 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = blink ? '#00f0ff' : '#ffffff';
    this.ctx.font = 'bold 16px "Courier New", monospace';
    this.ctx.fillText(
      `[R / ENTER]: ${i18n.t('Reintentar Partida', 'Retry Run')}  |  [T / ESC / CLIC]: ${i18n.t('Ir a Tienda Principal', 'Main Menu')}`,
      cx,
      cy + 242
    );
    this.ctx.restore();
  }
}
