import { Input } from './Input';
import { SoundSystem } from './SoundSystem';
import { Entity } from '../entities/Entity';
import { Player } from '../entities/Player';
import { Adware } from '../entities/Adware';
import { Worm } from '../entities/Worm';
import { CryptoMiner } from '../entities/CryptoMiner';
import { RansomwareBoss } from '../entities/RansomwareBoss';
import { BaseBoss } from '../entities/BaseBoss';
import { createRandomMegaBoss } from '../entities/SpecialBosses';
import { EncryptedBlock } from '../entities/EncryptedBlock';
import { DecryptionKey } from '../entities/DecryptionKey';
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
import { auth, db, googleProvider } from '../firebase';
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

const GAME_VERSION = 'v1.1.0';
const NORMAL_BOSSES_REQUIRED_FOR_MEGA_BOSS = 5;

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

  private normalBossesKilledCount: number = 0;
  private megaBoss: BaseBoss | null = null;
  private defeatedMegaBossVariants: Set<number> = new Set();
  private activeMegaBossVariant: number = -1;
  private finalBoss: ElToroBoss | null = null;
  private encryptedBlocks: EncryptedBlock[] = [];
  private decryptionKeys: DecryptionKey[] = [];

  private gameState: GameState = 'MENU';
  private lastTime: number = 0;
  private elapsedTime: number = 0;
  private killCount: number = 0;
  private runCoinsCollected: number = 0;
  private runDamageToToro: number = 0;
  private highScoreKills: number = 0;
  private showHitboxes: boolean = false;
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
  private runBossesKilled: number = 0;
  private runTotalDamageDealt: number = 0;
  public readonly firestoreDb = db;
  private menuFeedbackMessage: string =
    'Explora Agentes, Gacha (Tirada x1 / x10) e Inventario de Sombreros.';
  private damageVignetteAlpha: number = 0;
  private terminalLogs: string[] = [
    '> KERNEL_ANTIVIRUS_DAEMON v0.5.0 initialized...',
    '> El Borracho (🍺 + Dumbbells) & Water Gun READY.',
  ];

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
      if (this.megaBoss) {
        this.megaBoss.reposition(this.canvas.width);
        this.encryptedBlocks = BaseBoss.createArenaBlocks(
          this.canvas.width,
          this.canvas.height
        );
      }
    });

    this.input = new Input();
    this.sound = new SoundSystem();
    this.metaSystem = new MetaSystem();
    this.highScoreKills = this.metaSystem.highScore;
    this.player = new Player(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.metaSystem.getSelectedProfile()
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

    onAuthStateChanged(auth, async (user) => {
      this.currentUser = user;
      if (user) {
        const displayName = user.displayName || user.email || 'Agente';
        this.menuFeedbackMessage = `Sincronizando datos en la nube de ${displayName}...`;
        await this.metaSystem.loadFromCloud(user.uid);
        this.highScoreKills = this.metaSystem.highScore;
        if (this.gameState === 'MENU') {
          this.player = new Player(
            this.canvas.width / 2,
            this.canvas.height / 2,
            this.metaSystem.getSelectedProfile()
          );
        }
        this.menuFeedbackMessage = `Sesión iniciada como ${displayName}. Progreso sincronizado con la nube.`;
        this.addTerminalLog(`AUTH: Cloud Save synced (${displayName})`);
        this.achievementSystem.reportProgress('gacha_collector_20', this.metaSystem.unlockedHats.size, true);
        if (this.metaSystem.getUnlockedHatsList().some((h) => h.rarity === 'MITICA' || h.rarity === 'LEGENDARIA')) {
          this.achievementSystem.reportProgress('gacha_mythic', 1, true);
        }
      }
    });

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
    window.addEventListener('keydown', (e) => {
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
            this.addTerminalLog(`INSTALLED: ${chosen.name} (v${chosen.level}.0)`);
            this.particleSystem.spawnExplosion(this.player.x, this.player.y, chosen.color, 24, true);
            this.hoveredCardIndex = -1;
          }
        }
        return;
      }

      if (key === 'h') {
        this.showHitboxes = !this.showHitboxes;
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

        const authBtn = this.getAuthActionButtonRect();
        this.hoveredAuthBtn =
          mx >= authBtn.x &&
          mx <= authBtn.x + authBtn.width &&
          my >= authBtn.y &&
          my <= authBtn.y + authBtn.height;

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
    this.metaSystem.updateHighScore(this.killCount, this.elapsedTime);
    this.highScoreKills = Math.max(this.highScoreKills, this.metaSystem.highScore);
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
    this.decryptionKeys = [];
    this.encryptedBlocks = [];
    this.megaBoss = null;
    this.defeatedMegaBossVariants.clear();
    this.activeMegaBossVariant = -1;
    this.finalBoss = null;
    this.normalBossesKilledCount = 0;
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
      this.metaSystem.getSelectedProfile()
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
    this.player = new Player(this.canvas.width / 2, this.canvas.height / 2, profile);
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
    this.decryptionKeys = [];
    this.encryptedBlocks = [];
    this.megaBoss = null;
    this.defeatedMegaBossVariants.clear();
    this.activeMegaBossVariant = -1;
    this.finalBoss = null;
    this.normalBossesKilledCount = 0;
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
   * Instancia aleatoriamente un Mega-Jefe único (solo entre las variantes aún no derrotadas)
   * junto con el laberinto de Bloques Encriptados, desactivando por completo las armas del jugador.
   */
  private triggerMegaBossEvent(): void {
    const unkilledVariants = [0, 1, 2, 3].filter(
      (idx) => !this.defeatedMegaBossVariants.has(idx)
    );
    if (unkilledVariants.length === 0) return;

    const chosenVariant =
      unkilledVariants[Math.floor(Math.random() * unkilledVariants.length)];
    this.activeMegaBossVariant = chosenVariant;

    this.enemies = [];
    this.projectiles = [];
    this.pingProjectiles = [];
    this.quarantineZones = [];
    this.combatSystem.enemyProjectiles = [];
    this.combatSystem.firewallPulses = [];
    this.combatSystem.sqlBeams = [];
    this.combatSystem.droneExplosions = [];
    if (this.player.companion) {
      this.player.companion.clearActiveEffects();
    }
    this.codeFragments = [];
    this.cryptoCoins = [];
    this.powerUps = [];
    this.systemFreezeTimer = 0;
    this.thermalOverclockTimer = 0;
    this.decryptionKeys = [];

    this.megaBoss = createRandomMegaBoss(this.canvas.width, chosenVariant);
    this.encryptedBlocks = BaseBoss.createArenaBlocks(
      this.canvas.width,
      this.canvas.height
    );

    for (const block of this.encryptedBlocks) {
      block.resolvePlayerCollision(this.player);
    }

    this.spawnDecryptionKeyInArena();

    this.sound.playExplosion(true);
    this.particleSystem.spawnExplosion(
      this.megaBoss.x,
      this.megaBoss.y,
      this.megaBoss.color,
      65,
      true
    );

    this.addTerminalLog(`!! BOSS EVENT: ${this.megaBoss.bossTitle} !!`);
    this.addTerminalLog(`!! SPECIAL ATTACK: ${this.megaBoss.specialAttackName} !!`);
  }

  private spawnDecryptionKeyInArena(): void {
    if (!this.megaBoss || this.decryptionKeys.length >= 3) return;

    let spawnX = this.canvas.width / 2;
    let spawnY = this.canvas.height - 120;

    if (this.encryptedBlocks.length > 0 && Math.random() < 0.7) {
      const targetBlock =
        this.encryptedBlocks[Math.floor(Math.random() * this.encryptedBlocks.length)];
      const dirX = targetBlock.x - this.player.x;
      const dirY = targetBlock.y - this.player.y;
      const len = Math.hypot(dirX, dirY) || 1;

      const offsetDist = Math.max(targetBlock.width, targetBlock.height) * 0.65 + 32;
      spawnX = targetBlock.x + (dirX / len) * offsetDist;
      spawnY = targetBlock.y + (dirY / len) * offsetDist;
    } else {
      const marginX = 110;
      const minY = 250;
      const maxY = Math.max(minY + 80, this.canvas.height - 130);
      spawnX = marginX + Math.random() * Math.max(100, this.canvas.width - marginX * 2);
      spawnY = minY + Math.random() * (maxY - minY);
    }

    spawnX = Math.max(70, Math.min(this.canvas.width - 70, spawnX));
    spawnY = Math.max(230, Math.min(this.canvas.height - 90, spawnY));

    for (const block of this.encryptedBlocks) {
      if (block.containsPoint(spawnX, spawnY, 22)) {
        const b = block.getBounds();
        spawnY = b.bottom + 28 < this.canvas.height - 70 ? b.bottom + 28 : b.top - 28;
      }
    }

    this.decryptionKeys.push(new DecryptionKey(spawnX, spawnY, 250));
    this.particleSystem.spawnExplosion(spawnX, spawnY, '#00ffcc', 14, true);
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
    } else if (this.megaBoss && this.megaBoss.active) {
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
    for (const block of this.encryptedBlocks) {
      block.update(dt);
      block.resolvePlayerCollision(this.player);
    }

    // =========================================================================
    // RAMA A: EVENTO DE MEGA-JEFE ACTIVO (El Bañista / El Copiota / El Dormilón)
    // =========================================================================
    if (this.megaBoss && this.megaBoss.active) {
      const bossResult = this.megaBoss.update(
        dt,
        this.player,
        this.encryptedBlocks,
        this.canvas.width,
        this.canvas.height
      );

      if (bossResult.triggeredAttackSound) {
        this.sound.playShoot(true);
      }

      if (bossResult.shouldSpawnKey) {
        this.spawnDecryptionKeyInArena();
      }

      for (const pos of bossResult.blockedPositions) {
        this.sound.playExplosion(false);
        this.particleSystem.spawnExplosion(pos.x, pos.y, '#c084fc', 14, false);
        this.particleSystem.spawnFloatingText(pos.x, pos.y, 'BLOCKED!', '#c084fc', 0.85);
      }

      if (bossResult.playerHit) {
        this.particleSystem.triggerShake(10, 0.32);
        this.damageVignetteAlpha = 0.75;
        this.particleSystem.spawnExplosion(this.player.x, this.player.y, '#ff0044', 20, false);
        this.addTerminalLog(`BOSS ATTACK HIT! Kernel integrity: ${this.player.hp}/${this.player.maxHp}`);

        if (!this.player.active) {
          this.gameState = 'GAMEOVER';
          this.sound.setTrack('NONE');
          this.metaSystem.updateHighScore(this.killCount, this.elapsedTime, this.runDamageToToro);
          this.highScoreKills = Math.max(this.highScoreKills, this.metaSystem.highScore);
          void this.metaSystem.syncToCloud(this.elapsedTime, this.runDamageToToro);
          this.sound.playExplosion(true);
          this.particleSystem.spawnExplosion(this.player.x, this.player.y, '#00ff66', 45, true);
          this.addTerminalLog(`FATAL_ERROR: Agent defeated by ${this.megaBoss.bossTitle}.`);
          return;
        }
      }

      for (const keyEntity of this.decryptionKeys) {
        if (!keyEntity.active || !this.megaBoss) continue;
        const prevState = keyEntity.state;
        const hitBoss = keyEntity.update(dt, this.player, this.megaBoss.x, this.megaBoss.y);

        if (prevState === 'IDLE' && keyEntity.state === 'LAUNCHED') {
          this.sound.playCoinPickup();
          this.particleSystem.spawnFloatingText(
            this.player.x,
            this.player.y - 24,
            'DECRYPT KEY LAUNCHED!',
            '#00ffcc',
            1.0
          );
        }

        if (hitBoss && this.megaBoss) {
          this.megaBoss.takeKeyDamage(keyEntity.damage);
          this.sound.playExplosion(false);
          this.particleSystem.spawnExplosion(
            this.megaBoss.x,
            this.megaBoss.y,
            '#00ffcc',
            32,
            true
          );
          this.particleSystem.spawnFloatingText(
            this.megaBoss.x,
            this.megaBoss.y,
            `-${keyEntity.damage} DECRYPTED!`,
            '#00ffcc',
            1.25
          );

          if (!this.megaBoss.active) {
            this.handleMegaBossDefeated(this.megaBoss.x, this.megaBoss.y, this.megaBoss.bossTitle);
            break;
          }
        }
      }

      this.decryptionKeys = this.decryptionKeys.filter((k) => k.active);
      return;
    }

    // =========================================================================
    // RAMA B: BUCLE DE SUPERVIVENCIA NORMAL
    // =========================================================================
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

    let triggerMegaBossNow = false;

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
          this.cryptoCoins.push(
            new CryptoCoin(
              drop.x + (Math.random() - 0.5) * 28,
              drop.y + (Math.random() - 0.5) * 28,
              1
            )
          );
        }
        for (let f = 0; f < 3; f++) {
          this.codeFragments.push(
            new CodeFragment(
              drop.x + (Math.random() - 0.5) * 30,
              drop.y + (Math.random() - 0.5) * 30,
              35
            )
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
          this.cryptoCoins.push(
            new CryptoCoin(
              drop.x + (Math.random() - 0.5) * 110,
              drop.y + (Math.random() - 0.5) * 110,
              1
            )
          );
        }
        this.codeFragments.push(new CodeFragment(drop.x, drop.y, drop.xpValue));
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
        this.normalBossesKilledCount++;
        this.runBossesKilled++;
        this.achievementSystem.reportProgress('boss_slayer_ten', this.runBossesKilled, true);
        this.addTerminalLog(
          `BOSS PURGED (${this.normalBossesKilledCount}/${NORMAL_BOSSES_REQUIRED_FOR_MEGA_BOSS} for Mega-Boss Event)!`
        );

        if (
          this.normalBossesKilledCount >= NORMAL_BOSSES_REQUIRED_FOR_MEGA_BOSS &&
          this.defeatedMegaBossVariants.size < 4
        ) {
          this.normalBossesKilledCount = 0;
          triggerMegaBossNow = true;
        }
      }

      this.codeFragments.push(new CodeFragment(drop.x, drop.y, drop.xpValue));

      // 1% de probabilidad de soltar un power-up raro temporal
      if (Math.random() < 0.01) {
        const pTypes: PowerUpType[] = ['NUKE', 'FREEZE', 'FRENZY'];
        const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
        this.powerUps.push(new PowerUpItem(drop.x, drop.y, pType));
      }

      if (isBoss) {
        for (let c = 0; c < 2; c++) {
          this.cryptoCoins.push(
            new CryptoCoin(
              drop.x + (Math.random() - 0.5) * 32,
              drop.y + (Math.random() - 0.5) * 32,
              1
            )
          );
        }
      } else if (Math.random() < 0.06) {
        this.cryptoCoins.push(new CryptoCoin(drop.x + 8, drop.y - 8, 1));
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
        if (activeWormCount < 5) {
          this.enemies.push(new Worm(drop.x - 14, drop.y - 14, hpMult, true));
        }
        if (activeWormCount + 1 < 5) {
          this.enemies.push(new Worm(drop.x + 14, drop.y + 14, hpMult, true));
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

      if (CombatSystem.checkAABBCollision(this.player, fragment)) {
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

      if (CombatSystem.checkAABBCollision(this.player, coin)) {
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

    if (triggerMegaBossNow) {
      this.triggerMegaBossEvent();
    }
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
        this.codeFragments.push(new CodeFragment(e.x, e.y, e.xpValue));
        this.particleSystem.spawnExplosion(e.x, e.y, '#ff1e42', 12, false);
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

  private handleMegaBossDefeated(bossX: number, bossY: number, title: string): void {
    this.sound.playExplosion(true);
    this.particleSystem.spawnExplosion(bossX, bossY, '#ff0055', 95, true);
    this.particleSystem.spawnExplosion(bossX, bossY, '#00ffcc', 60, true);
    this.particleSystem.spawnFloatingText(
      bossX,
      bossY,
      `${title} DEFEATED! +MASSIVE LOOT`,
      '#00ff66',
      1.3
    );

    if (this.activeMegaBossVariant !== -1) {
      this.defeatedMegaBossVariants.add(this.activeMegaBossVariant);
      this.activeMegaBossVariant = -1;
    }

    this.runBossesKilled++;
    this.achievementSystem.reportProgress('first_boss_killed', 1);
    this.achievementSystem.reportProgress(
      'all_four_bosses',
      this.defeatedMegaBossVariants.size,
      true
    );
    this.achievementSystem.reportProgress('boss_slayer_ten', this.runBossesKilled, true);

    this.killCount++;
    this.highScoreKills = Math.max(this.highScoreKills, this.killCount);
    this.decryptionKeys = [];
    this.encryptedBlocks = [];
    this.megaBoss = null;
    this.normalBossesKilledCount = 0;

    for (let i = 0; i < 6; i++) {
      this.cryptoCoins.push(
        new CryptoCoin(
          bossX + (Math.random() - 0.5) * 140,
          bossY + (Math.random() - 0.5) * 140,
          1
        )
      );
    }
    for (let i = 0; i < 14; i++) {
      this.codeFragments.push(
        new CodeFragment(
          bossX + (Math.random() - 0.5) * 160,
          bossY + (Math.random() - 0.5) * 160,
          45
        )
      );
    }

    this.player.heal(50);

    // En el instante exacto en que se derrota al 4.º Mega-Jefe único:
    // Detener todos los temporizadores de élites/especiales/jefes e invocar inmediatamente al Jefe Final ("El Toro")
    if (this.defeatedMegaBossVariants.size >= 4) {
      this.achievementSystem.reportProgress('toro_arrival', 1);
      this.spawner.enableFinalBossMode();
      this.enemies = [];
      const spawnY =
        this.player.y > this.canvas.height * 0.45 ? 120 : this.canvas.height - 120;
      this.finalBoss = new ElToroBoss(this.canvas.width / 2, spawnY);
      this.enemies.push(this.finalBoss);

      this.particleSystem.spawnExplosion(this.finalBoss.x, this.finalBoss.y, '#dc2626', 85, true);
      this.particleSystem.spawnFloatingText(
        this.canvas.width / 2,
        this.canvas.height / 2 - 40,
        '¡¡JEFE FINAL: EL TORO HA APARECIDO!!',
        '#ff0044',
        1.5
      );
      this.addTerminalLog('!! 4/4 MEGA-BOSSES PURGED: ALL ELITE TIMERS STOPPED !!');
      this.addTerminalLog('!! FINAL BOSS AWAKENED: EL TORO (INVINCIBLE) — WEAPONS ONLINE !!');
    } else {
      this.spawner.syncAfterMegaBoss(this.elapsedTime);
      this.addTerminalLog(
        `>> ${title} PURGED (${this.defeatedMegaBossVariants.size}/4)! Labyrinth cleared & weapons restored <<`
      );
    }
  }

  private resolveEnemyCrowd(): void {
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i];
        const b = this.enemies[j];
        const minDistance = (a.size + b.size) * 0.46;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0 && dist < minDistance) {
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
    this.ctx.fillStyle = '#000000';
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

      if (this.player.active && !this.megaBoss) {
        this.drawScannerRange();
      }

      for (const block of this.encryptedBlocks) {
        block.draw(this.ctx);
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

      for (const keyEntity of this.decryptionKeys) {
        keyEntity.draw(this.ctx);
      }

      for (const proj of this.projectiles) {
        proj.draw(this.ctx);
      }

      for (const ping of this.pingProjectiles) {
        ping.draw(this.ctx);
      }

      if (!this.megaBoss) {
        this.combatSystem.drawFirewall(this.ctx, this.player);
        if (this.player.companion && this.player.active) {
          this.player.companion.draw(this.ctx, this.player, this.upgradeSystem.level);
        }
      }

      for (const enemy of this.enemies) {
        enemy.draw(this.ctx);
      }

      this.drawEliteHpBars();

      if (this.megaBoss && this.megaBoss.active) {
        this.megaBoss.draw(this.ctx);
      }

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
    this.ctx.fillStyle = '#00ff66';
    this.ctx.shadowColor = '#00ff66';
    this.ctx.shadowBlur = 8;
    this.ctx.font = 'bold 14px "Courier New", monospace';
    this.ctx.fillText(GAME_VERSION, this.canvas.width - 16, this.canvas.height - 14);
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
    this.ctx.font = 'bold 20px "Courier New", monospace';
    this.ctx.fillText(
      `⚠️ ALERTA DE PLAGA: EL ENJAMBRE (${this.spawner.swarmActiveTimer.toFixed(1)}s) // ¡50 ENEMIGOS DETECTADOS! ⚠️`,
      this.canvas.width / 2,
      82
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

    if (this.megaBoss && this.megaBoss.active) {
      const isOffScreen =
        this.megaBoss.x < 0 || this.megaBoss.x > w || this.megaBoss.y < 0 || this.megaBoss.y > h;
      if (isOffScreen) {
        const cx = w / 2;
        const cy = h / 2;
        const dx = this.megaBoss.x - cx;
        const dy = this.megaBoss.y - cy;
        const angle = Math.atan2(dy, dx);
        const edgeX = Math.max(edgePadding, Math.min(w - edgePadding, cx + dx));
        const edgeY = Math.max(edgePadding, Math.min(h - edgePadding, cy + dy));

        this.ctx.save();
        this.ctx.translate(edgeX, edgeY);
        this.ctx.rotate(angle);
        this.ctx.fillStyle = `rgba(255, 30, 66, ${flashAlpha})`;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.shadowColor = '#ff1e42';
        this.ctx.shadowBlur = 16;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(18, 0);
        this.ctx.lineTo(-12, -10);
        this.ctx.lineTo(-5, 0);
        this.ctx.lineTo(-12, 10);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
      }
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
    this.ctx.font = 'bold 15px "JetBrains Mono", Consolas, monospace';
    this.ctx.fillStyle = '#f97316';
    this.ctx.shadowColor = '#fbbf24';
    this.ctx.shadowBlur = 12;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      `⚡ OVERCLOCK TÉRMICO (x2 CADENCIA + 100% CRIT): ${this.thermalOverclockTimer.toFixed(1)}s`,
      this.canvas.width / 2,
      94
    );
    this.ctx.restore();
  }

  private drawCRTScanlines(): void {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 255, 102, 0.018)';
    for (let y = 0; y < this.canvas.height; y += 4) {
      this.ctx.fillRect(0, y, this.canvas.width, 1);
    }

    this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.22)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(4, 4, this.canvas.width - 8, this.canvas.height - 8);
    this.ctx.restore();
  }

  private drawTerminalLogBox(): void {
    const boxX = 16;
    const boxY = this.canvas.height - 115;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 12, 6, 0.72)';
    this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.fillRect(boxX, boxY, 540, 98);
    this.ctx.strokeRect(boxX, boxY, 540, 98);

    this.ctx.font = '12px "Courier New", monospace';
    for (let i = 0; i < this.terminalLogs.length; i++) {
      const isLatest = i === this.terminalLogs.length - 1;
      this.ctx.fillStyle = isLatest ? '#00ff66' : 'rgba(0, 255, 102, 0.55)';
      this.ctx.fillText(this.terminalLogs[i], boxX + 10, boxY + 20 + i * 17);
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
    const btnH = 44;
    const gap = 20;
    const startX = cx - btnW - gap / 2;
    const y = py + 180;

    return [
      {
        count: 1,
        cost: GACHA_PULL_SINGLE_COST,
        label: `🔌 TIRADA x1 (${GACHA_PULL_SINGLE_COST} 🪙)`,
        x: startX,
        y,
        width: btnW,
        height: btnH,
      },
      {
        count: 10,
        cost: GACHA_PULL_TEN_COST,
        label: `⚡ TIRADA x10 (${GACHA_PULL_TEN_COST} 🪙)`,
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
    const y = py + 456;
    const btnW = 140;
    const btnH = 28;

    return [
      {
        dir: 'PREV',
        label: '<< ANTERIOR',
        x: cx - 170,
        y,
        width: btnW,
        height: btnH,
      },
      {
        dir: 'NEXT',
        label: 'SIGUIENTE >>',
        x: cx + 30,
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
    this.ctx.fillStyle = bgFill;
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = lineWidth;
    if (shadowColor && shadowBlur) {
      this.ctx.shadowColor = shadowColor;
      this.ctx.shadowBlur = shadowBlur;
    }
    this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.ctx.shadowBlur = 0;

    // Recorte estricto dentro de la caja del botón
    this.ctx.beginPath();
    this.ctx.rect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
    this.ctx.clip();

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = textColor;

    const maxW = rect.width - 12;
    let fontSize = baseFontSize;
    this.ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    const m = this.ctx.measureText(text).width;
    if (m > maxW) {
      fontSize = Math.max(9, Math.floor(baseFontSize * (maxW / m)));
      this.ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    }

    this.ctx.fillText(text, rect.x + rect.width / 2, rect.y + Math.round(rect.height / 2) + 5);
    this.ctx.restore();
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
          this.menuFeedbackMessage = 'Sesión de Google cerrada correctamente.';
          this.addTerminalLog('AUTH: Google Session Terminated.');
        })
        .catch((err) => {
          console.error('Error al cerrar sesión:', err);
          this.menuFeedbackMessage = 'Error al cerrar sesión.';
        });
    } else {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      this.menuFeedbackMessage = 'Abriendo ventana de inicio de sesión con Google...';
      signInWithPopup(auth, googleProvider)
        .then((result) => {
          this.sound.playCoinPickup();
          const name = result.user.displayName || result.user.email || 'Survivor';
          this.menuFeedbackMessage = `¡Bienvenido, ${name}! Autenticación completada.`;
        })
        .catch((err: { code?: string; message?: string }) => {
          console.error('Error en Google Login:', err);
          const code = err?.code || '';
          if (code === 'auth/popup-blocked') {
            this.menuFeedbackMessage = 'Popup bloqueado. Redirigiendo a Google Login...';
            void signInWithRedirect(auth, googleProvider);
          } else if (code === 'auth/unauthorized-domain') {
            this.menuFeedbackMessage = `Añade "${window.location.hostname}" en Firebase > Auth > Settings > Dominios autorizados.`;
          } else if (
            code === 'auth/operation-not-allowed' ||
            code === 'auth/configuration-not-found'
          ) {
            this.menuFeedbackMessage =
              'Activa el proveedor Google en Firebase > Authentication > Sign-in method.';
          } else if (code === 'auth/popup-closed-by-user') {
            this.menuFeedbackMessage = 'Ventana de inicio de sesión cerrada por el usuario.';
          } else {
            this.menuFeedbackMessage = `Error de inicio de sesión (${code || 'verifica Firebase Auth'}).`;
          }
        });
    }
  }

  private drawStartMenuWithShop(): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 6, 3, 0.85)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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
      this.ctx.fillStyle = 'rgba(2, 22, 14, 0.94)';
      this.ctx.strokeStyle = '#00ff66';
      this.ctx.lineWidth = 1.5;
      this.ctx.shadowColor = '#00ff66';
      this.ctx.shadowBlur = 10;
      this.ctx.fillRect(statusBoxX, statusBoxY, statusBoxW, statusBoxH);
      this.ctx.strokeRect(statusBoxX, statusBoxY, statusBoxW, statusBoxH);
      this.ctx.shadowBlur = 0;

      // Recorte estricto para evitar cualquier desbordamiento de texto
      this.ctx.beginPath();
      this.ctx.rect(statusBoxX + 2, statusBoxY + 2, statusBoxW - 4, statusBoxH - 4);
      this.ctx.clip();

      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = '#00ff66';
      this.ctx.font = 'bold 13px "Courier New", monospace';
      this.ctx.fillText(`${i18n.t('AGENTE', 'AGENT')}: ${truncatedName}`, statusBoxX + 14, statusBoxY + 20);

      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = 'bold 11px "Courier New", monospace';
      this.ctx.fillText(`☁ ${i18n.t('NUBE SINCRONIZADA', 'CLOUD SYNCED')}`, statusBoxX + 14, statusBoxY + 34);
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
    } else {
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

    this.ctx.fillStyle = 'rgba(2, 14, 9, 0.96)';
    this.ctx.strokeStyle = '#00ff66';
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = '#00ff66';
    this.ctx.shadowBlur = 20;
    this.ctx.fillRect(px, py, panelW, panelH);
    this.ctx.strokeRect(px, py, panelW, panelH);

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff66';
    this.ctx.font = 'bold 30px "Courier New", monospace';
    this.ctx.fillText(`CYBER SURVIVOR // KERNEL HUB (${GAME_VERSION})`, cx, py + 40);

    const equippedHat = this.metaSystem.getEquippedHat();
    const noneText = i18n.t('Ninguno', 'None');
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.font = 'bold 14px "Courier New", monospace';
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
      this.ctx.fillStyle = isActive ? 'rgba(0, 60, 38, 0.96)' : 'rgba(6, 18, 22, 0.9)';
      this.ctx.strokeStyle = isActive ? '#00ff66' : '#38bdf8';
      this.ctx.lineWidth = isActive ? 2.5 : 1.5;
      this.ctx.fillRect(tabRect.x, tabRect.y, tabRect.width, tabRect.height);
      this.ctx.strokeRect(tabRect.x, tabRect.y, tabRect.width, tabRect.height);

      this.ctx.fillStyle = isActive ? '#00ff66' : '#bae6fd';
      this.ctx.font = 'bold 13px "Courier New", monospace';
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
        this.ctx.fillStyle = selected
          ? 'rgba(0, 45, 30, 0.95)'
          : hovered
          ? 'rgba(12, 30, 45, 0.95)'
          : 'rgba(6, 14, 18, 0.92)';
        this.ctx.strokeStyle = selected
          ? '#00ff66'
          : unlocked
          ? profile.borderColor
          : '#fbbf24';
        this.ctx.lineWidth = selected || hovered ? 2.5 : 1.5;
        this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        // Recorte estricto dentro de la tarjeta de personaje
        this.ctx.beginPath();
        this.ctx.rect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
        this.ctx.clip();

        const previewX = rect.x + 32;
        const previewY = rect.y + 34;
        this.ctx.fillStyle = profile.color;
        this.ctx.shadowColor = profile.borderColor;
        this.ctx.shadowBlur = 12;
        this.ctx.fillRect(previewX - 13, previewY - 13, 26, 26);
        this.ctx.strokeStyle = profile.borderColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(previewX - 9, previewY - 9, 18, 18);

        if (rect.id === 'MORCILLITA') {
          // Miniatura del cuadrado acompañante marrón junto al chasis rosa
          this.ctx.fillStyle = '#92400e';
          this.ctx.strokeStyle = '#fbbf24';
          this.ctx.lineWidth = 1.5;
          this.ctx.fillRect(previewX + 10, previewY - 18, 11, 11);
          this.ctx.strokeRect(previewX + 10, previewY - 18, 11, 11);
        }

        this.ctx.shadowBlur = 0;
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font =
          profile.name.length > 20
            ? 'bold 13px "Courier New", monospace'
            : 'bold 15px "Courier New", monospace';
        this.ctx.fillText(`[${i + 1}] ${profile.name}`, rect.x + 56, rect.y + 28);

        this.ctx.fillStyle = '#38bdf8';
        this.ctx.font = 'bold 11px "Courier New", monospace';
        this.ctx.fillText(profile.subtitle, rect.x + 56, rect.y + 45);

        this.ctx.fillStyle = '#cbd5e1';
        this.ctx.font = '12px "Courier New", monospace';
        this.wrapText(profile.description, rect.x + 14, rect.y + 68, rect.width - 28, 15, 3);

        this.ctx.font = 'bold 12px "Courier New", monospace';
        if (selected) {
          this.ctx.fillStyle = '#00ff66';
          this.ctx.fillText('✔ EQUIPADO Y LISTO', rect.x + 14, rect.y + rect.height - 12);
        } else if (unlocked) {
          this.ctx.fillStyle = '#00f0ff';
          this.ctx.fillText(`> PULSA [${i + 1}] O CLIC PARA EQUIPAR`, rect.x + 14, rect.y + rect.height - 12);
        } else {
          const canAfford = this.metaSystem.coins >= profile.cost;
          this.ctx.fillStyle = canAfford ? '#fbbf24' : '#ff1e42';
          this.ctx.fillText(
            `🔒 DESBLOQUEAR (${profile.cost} CRYPTO)`,
            rect.x + 14,
            rect.y + rect.height - 12
          );
        }

        this.ctx.restore();
      }
    } else if (this.activeMenuTab === 'GACHA') {
      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.font = 'bold 12px "Courier New", monospace';
      this.ctx.fillText(
        'PROBABILIDADES: Común 40% | Rara 30% | Épica 20% | Legendaria 9% | Mítica 1%  (Repetido = +10 🪙)',
        cx,
        cy - 106
      );

      for (const pullBtn of this.getGachaPullButtonRects()) {
        const canAfford = this.metaSystem.coins >= pullBtn.cost;
        const isTen = pullBtn.count === 10;
        this.ctx.fillStyle = canAfford
          ? isTen
            ? 'rgba(69, 26, 3, 0.95)'
            : 'rgba(46, 16, 101, 0.95)'
          : 'rgba(30, 10, 18, 0.9)';
        this.ctx.strokeStyle = canAfford ? (isTen ? '#fbbf24' : '#c084fc') : '#ff1e42';
        this.ctx.lineWidth = 2.5;
        this.ctx.shadowColor = canAfford ? (isTen ? '#fbbf24' : '#c084fc') : '#ff1e42';
        this.ctx.shadowBlur = 12;
        this.ctx.fillRect(pullBtn.x, pullBtn.y, pullBtn.width, pullBtn.height);
        this.ctx.strokeRect(pullBtn.x, pullBtn.y, pullBtn.width, pullBtn.height);

        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = canAfford ? '#fde047' : '#fca5a5';
        this.ctx.font = 'bold 15px "Courier New", monospace';
        this.ctx.fillText(
          pullBtn.label,
          pullBtn.x + pullBtn.width / 2,
          pullBtn.y + 26
        );
      }

      if (this.lastGachaResults.length === 1) {
        const entry = this.lastGachaResults[0];
        const rConf = RARITY_CONFIG[entry.hat.rarity];
        const revealBoxW = 540;
        const revealBoxH = 175;
        const rx = cx - revealBoxW / 2;
        const ry = cy - 34;
        const pulseScale = 1 + Math.sin(this.gachaRevealTimer * 14) * 0.025;

        this.ctx.save();
        this.ctx.translate(cx, ry + revealBoxH / 2);
        this.ctx.scale(pulseScale, pulseScale);
        this.ctx.translate(-cx, -(ry + revealBoxH / 2));

        this.ctx.fillStyle = rConf.bgColor;
        this.ctx.strokeStyle = rConf.color;
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = rConf.color;
        this.ctx.shadowBlur = this.gachaRevealTimer > 0 ? 26 : 12;
        this.ctx.fillRect(rx, ry, revealBoxW, revealBoxH);
        this.ctx.strokeRect(rx, ry, revealBoxW, revealBoxH);

        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = rConf.color;
        this.ctx.font = 'bold 14px "Courier New", monospace';
        this.ctx.fillText(`★ RAREZA ${rConf.label} ★`, cx, ry + 26);

        this.ctx.font = '36px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        this.ctx.fillText(entry.hat.icon, cx, ry + 66);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 19px "Courier New", monospace';
        this.ctx.fillText(entry.hat.name, cx, ry + 104);

        this.ctx.fillStyle = entry.isNew ? '#00ff66' : '#fbbf24';
        this.ctx.font = 'bold 14px "Courier New", monospace';
        this.ctx.fillText(
          entry.isNew ? '¡NUEVO DESBLOQUEO!' : 'Repetido: +10 Monedas 🪙',
          cx,
          ry + 130
        );

        this.ctx.fillStyle = '#a3e635';
        this.ctx.font = 'bold 13px "Courier New", monospace';
        this.ctx.fillText(`MODIFICADORES: [ ${entry.hat.statsLabel} ]`, cx, ry + 156);
        this.ctx.restore();
      } else if (this.lastGachaResults.length > 1) {
        const cols = 5;
        const cardW = 132;
        const cardH = 104;
        const gapX = 10;
        const gapY = 10;
        const totalW = cols * cardW + (cols - 1) * gapX;
        const startX = cx - totalW / 2;
        const startY = cy - 38;

        for (let i = 0; i < this.lastGachaResults.length; i++) {
          const entry = this.lastGachaResults[i];
          const rConf = RARITY_CONFIG[entry.hat.rarity];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = startX + col * (cardW + gapX);
          const y = startY + row * (cardH + gapY);

          this.ctx.save();
          this.ctx.fillStyle = rConf.bgColor;
          this.ctx.strokeStyle = rConf.color;
          this.ctx.lineWidth = 2;
          this.ctx.fillRect(x, y, cardW, cardH);
          this.ctx.strokeRect(x, y, cardW, cardH);

          // Recorte estricto por carta gacha
          this.ctx.beginPath();
          this.ctx.rect(x + 2, y + 2, cardW - 4, cardH - 4);
          this.ctx.clip();

          this.ctx.textAlign = 'center';
          this.ctx.font = '22px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
          this.ctx.fillText(entry.hat.icon, x + cardW / 2, y + 24);

          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = 'bold 10px "Courier New", monospace';
          const shortName =
            entry.hat.name.length > 16 ? entry.hat.name.slice(0, 15) + '…' : entry.hat.name;
          this.ctx.fillText(shortName, x + cardW / 2, y + 48);

          this.ctx.fillStyle = rConf.color;
          this.ctx.font = 'bold 9px "Courier New", monospace';
          this.ctx.fillText(rConf.label.split(' ')[0], x + cardW / 2, y + 64);

          this.ctx.fillStyle = entry.isNew ? '#00ff66' : '#fbbf24';
          this.ctx.font = 'bold 9px "Courier New", monospace';
          this.ctx.fillText(
            entry.isNew ? '¡NUEVO!' : 'Repetido: +10 Monedas',
            x + cardW / 2,
            y + 82
          );

          this.ctx.fillStyle = '#cbd5e1';
          this.ctx.font = '9px "Courier New", monospace';
          const shortStats =
            entry.hat.statsLabel.length > 18
              ? entry.hat.statsLabel.slice(0, 17) + '…'
              : entry.hat.statsLabel;
          this.ctx.fillText(shortStats, x + cardW / 2, y + 96);
          this.ctx.restore();
        }
      } else {
        const revealBoxW = 540;
        const revealBoxH = 165;
        const rx = cx - revealBoxW / 2;
        const ry = cy - 28;

        this.ctx.fillStyle = 'rgba(8, 20, 26, 0.9)';
        this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        this.ctx.lineWidth = 1.5;
        this.ctx.fillRect(rx, ry, revealBoxW, revealBoxH);
        this.ctx.strokeRect(rx, ry, revealBoxW, revealBoxH);

        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '14px "Courier New", monospace';
        this.ctx.fillText(
          'Elige "Tirada x1" (20 🪙) o "Tirada x10" (200 🪙) para abrir cofres.',
          cx,
          ry + 68
        );
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.font = 'bold 13px "Courier New", monospace';
        this.ctx.fillText(
          'Si te sale un sombrero repetido, recibirás automáticamente +10 Monedas.',
          cx,
          ry + 100
        );
      }
    } else if (this.activeMenuTab === 'INVENTORY') {
      const unlockedList = this.metaSystem.getUnlockedHatsList();
      if (unlockedList.length === 0) {
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '15px "Courier New", monospace';
        this.ctx.fillText(
          'Tu inventario está vacío. Ve a la pestaña [G] GACHA para Tirar del Cable.',
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
          this.ctx.fillStyle = isEquipped ? 'rgba(0, 50, 32, 0.95)' : rConf.bgColor;
          this.ctx.strokeStyle = isEquipped ? '#00ff66' : isHovered ? '#ffffff' : rConf.color;
          this.ctx.lineWidth = isEquipped || isHovered ? 2.5 : 1.5;
          this.ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
          this.ctx.strokeRect(slot.x, slot.y, slot.width, slot.height);

          // Recorte estricto por ranura de inventario
          this.ctx.beginPath();
          this.ctx.rect(slot.x + 2, slot.y + 2, slot.width - 4, slot.height - 4);
          this.ctx.clip();

          this.ctx.textAlign = 'left';
          this.ctx.font = '22px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
          this.ctx.fillText(slot.hat.icon, slot.x + 10, slot.y + 28);

          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = 'bold 12px "Courier New", monospace';
          const shortName =
            slot.hat.name.length > 20 ? slot.hat.name.slice(0, 19) + '…' : slot.hat.name;
          this.ctx.fillText(shortName, slot.x + 40, slot.y + 22);

          this.ctx.fillStyle = rConf.color;
          this.ctx.font = 'bold 10px "Courier New", monospace';
          this.ctx.fillText(
            isEquipped ? '✔ EQUIPADO' : rConf.label.split(' ')[0],
            slot.x + 40,
            slot.y + 38
          );

          this.ctx.fillStyle = '#a3e635';
          this.ctx.font = '11px "Courier New", monospace';
          this.ctx.fillText(slot.hat.statsLabel, slot.x + 10, slot.y + 62);
          this.ctx.restore();
        }

        const totalPages = Math.max(1, Math.ceil(unlockedList.length / 9));
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#cbd5e1';
        this.ctx.font = 'bold 12px "Courier New", monospace';
        this.ctx.fillText(
          `PÁGINA ${this.inventoryPage + 1}/${totalPages} (Haz clic en un sombrero para Equipar/Desequipar)`,
          cx,
          cy + 154
        );

        for (const pageBtn of this.getInventoryPaginationRects()) {
          this.ctx.fillStyle = 'rgba(12, 30, 45, 0.95)';
          this.ctx.strokeStyle = '#38bdf8';
          this.ctx.lineWidth = 1.5;
          this.ctx.fillRect(pageBtn.x, pageBtn.y, pageBtn.width, pageBtn.height);
          this.ctx.strokeRect(pageBtn.x, pageBtn.y, pageBtn.width, pageBtn.height);

          this.ctx.fillStyle = '#38bdf8';
          this.ctx.font = 'bold 12px "Courier New", monospace';
          this.ctx.fillText(pageBtn.label, pageBtn.x + pageBtn.width / 2, pageBtn.y + 18);
        }
      }
    }

    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#a3e635';
    let feedbackFont = 13;
    const maxFeedbackW = panelW - 40;
    this.ctx.font = `bold ${feedbackFont}px "Courier New", monospace`;
    let fbMetrics = this.ctx.measureText(this.menuFeedbackMessage).width;
    if (fbMetrics > maxFeedbackW) {
      feedbackFont = Math.max(10, Math.floor(13 * (maxFeedbackW / fbMetrics)));
      this.ctx.font = `bold ${feedbackFont}px "Courier New", monospace`;
    }
    this.ctx.fillText(this.menuFeedbackMessage, cx, py + 470);
    this.ctx.restore();

    const startBtn = this.getStartButtonRect();
    const blink = Math.floor(performance.now() / 450) % 2 === 0;
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 40, 22, 0.95)';
    this.ctx.strokeStyle = '#00ff66';
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = '#00ff66';
    this.ctx.shadowBlur = blink ? 14 : 6;
    this.ctx.fillRect(startBtn.x, startBtn.y, startBtn.width, startBtn.height);
    this.ctx.strokeRect(startBtn.x, startBtn.y, startBtn.width, startBtn.height);
    this.ctx.shadowBlur = 0;

    // Recorte estricto dentro del botón de despliegue
    this.ctx.beginPath();
    this.ctx.rect(startBtn.x + 2, startBtn.y + 2, startBtn.width - 4, startBtn.height - 4);
    this.ctx.clip();

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = blink ? '#00ff66' : '#ffffff';
    let startFont = 16;
    const maxStartW = startBtn.width - 24;
    const startText = `> ${i18n.t('PULSA [ENTER] O CLIC AQUÍ PARA DESPLEGAR', 'PRESS [ENTER] OR CLICK HERE TO DEPLOY')} <`;
    this.ctx.font = `bold ${startFont}px "Courier New", monospace`;
    let stMetrics = this.ctx.measureText(startText).width;
    if (stMetrics > maxStartW) {
      startFont = Math.max(11, Math.floor(16 * (maxStartW / stMetrics)));
      this.ctx.font = `bold ${startFont}px "Courier New", monospace`;
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
                '• [Mouse]: Click to interact with cards & tabs.',
                '• Auto-fire: Your weapons target automatically',
                '  the highest priority malware in range.',
              ]
            : [
                '• [WASD / Flechas]: Desplazamiento del Agente.',
                '• [P]: Pausa táctica del sistema.',
                '• [Ratón]: Clic para interactuar con menús y cartas.',
                '• Disparo automático: Tus armas atacan solas',
                '  al malware más prioritario en tu radio de acción.',
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
        title: i18n.t('🔑 3. PROTOCOLO MEGA-JEFES', '🔑 3. MEGA-BOSS PROTOCOL'),
        lines:
          i18n.currentLang === 'EN'
            ? [
                '• After each elite cycle, 1 of 4 Mega-Bosses spawns.',
                '• YOUR WEAPONS ARE DISABLED BY ENCRYPTION!',
                '• You cannot damage them by shooting.',
                '• Dodge attacks and COLLECT 5 DECRYPTION KEYS',
                '  in the arena to eliminate them.',
              ]
            : [
                '• Tras cada ciclo de élites aparece 1 de los 4 Mega-Jefes.',
                '• ¡TUS ARMAS SE DESHABILITAN POR EL ENCRIPTADO!',
                '• No puedes dañarlos disparando.',
                '• Esquiva sus ataques y RECOGE 5 LLAVES',
                '  de desencriptación en la arena para eliminarlos.',
              ],
        color: '#fbbf24',
        border: 'rgba(251, 191, 36, 0.35)',
      },
      {
        title: i18n.t('🐂 4. JEFE FINAL: "EL TORO" (INVENCIBLE)', '🐂 4. FINAL BOSS: "EL TORO" (INVINCIBLE)'),
        lines:
          i18n.currentLang === 'EN'
            ? [
                '• Awakens after defeating all 4 unique Mega-Bosses.',
                '• YOUR WEAPONS RE-ENGAGE FOR THIS COMBAT!',
                '• "El Toro" is INVINCIBLE and accelerates every 15s.',
                '• Each collision strips 50% max HP.',
                '• Inflict maximum damage to top the Leaderboard!',
              ]
            : [
                '• Despierta al derrotar a los 4 Mega-Jefes únicos.',
                '• ¡TUS ARMAS SE REACTIVAN PARA ESTE COMBATE!',
                '• "El Toro" es INVENCIBLE y acelera cada 15s.',
                '• Cada embestida o contacto quita el 50% de HP.',
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
    for (const block of this.encryptedBlocks) {
      const b = block.getBounds();
      this.ctx.strokeStyle = '#ff0055';
      this.ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
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
    for (const keyEntity of this.decryptionKeys) {
      drawEntityBox(keyEntity, '#00ffcc');
    }
    if (this.megaBoss) {
      for (const worm of this.megaBoss.trackerWorms) {
        drawEntityBox(worm, '#c084fc');
      }
    }

    this.ctx.restore();
  }

  private drawCyberGrid(): void {
    const gridSize = 48;
    this.ctx.save();
    this.ctx.strokeStyle = this.megaBoss
      ? 'rgba(255, 0, 85, 0.08)'
      : 'rgba(0, 255, 102, 0.06)';
    this.ctx.lineWidth = 1;

    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private drawXpBar(): void {
    const barHeight = 8;
    const ratio = Math.min(1, this.upgradeSystem.currentXp / this.upgradeSystem.xpToNextLevel);

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 20, 30, 0.9)';
    this.ctx.fillRect(0, 0, this.canvas.width, barHeight);

    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 10;
    this.ctx.fillRect(0, 0, this.canvas.width * ratio, barHeight);
    this.ctx.restore();
  }

  private formatTimeMMSS(totalSeconds: number): string {
    const secs = Math.max(0, Math.floor(totalSeconds));
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  private drawHUD(): void {
    this.ctx.save();
    this.ctx.fillStyle = '#00ff66';
    this.ctx.font = 'bold 14px "Courier New", monospace';
    const bossProgressLabel = this.spawner.finalBossMode
      ? 'FASE: JEFE FINAL [EL TORO]'
      : `BOSSES: ${this.normalBossesKilledCount}/${NORMAL_BOSSES_REQUIRED_FOR_MEGA_BOSS} (MEGA: ${this.defeatedMegaBossVariants.size}/4)`;

    this.ctx.fillText(
      `[${this.player.profileName} v${this.upgradeSystem.level}.0] | HP: ${this.player.hp}/${this.player.maxHp} | XP_MULT: x${this.player.xpMultiplier.toFixed(2)} | ${bossProgressLabel} | TIME: ${this.formatTimeMMSS(this.elapsedTime)}`,
      16,
      30
    );

    const weaponsStatus = this.megaBoss
      ? `OFFLINE [${this.megaBoss.getCurrentStateLabel()}]`
      : this.combatSystem.getActiveWeaponsList(this.player).join(' + ');

    this.ctx.fillStyle = this.megaBoss ? '#ff0055' : 'rgba(0, 240, 255, 0.85)';
    this.ctx.font = '13px "Courier New", monospace';
    this.ctx.fillText(
      `[ARMAS]: ${weaponsStatus} | [P]: Pausa`,
      16,
      52
    );
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

      this.ctx.fillStyle = 'rgba(28, 4, 8, 0.92)';
      this.ctx.strokeStyle = this.finalBoss.state === 'TELEGRAPH' ? '#facc15' : '#ef4444';
      this.ctx.lineWidth = 2.5;
      this.ctx.shadowColor = '#dc2626';
      this.ctx.shadowBlur = 18;
      this.ctx.fillRect(px, py, panelW, panelH);
      this.ctx.strokeRect(px, py, panelW, panelH);

      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = '#fca5a5';
      this.ctx.font = 'bold 13px "Courier New", monospace';
      this.ctx.fillText(
        `🐂 JEFE FINAL: EL TORO [INVENCIBLE // CONTACTO: 50% HP MÁX] | ${this.finalBoss.getDashStatusText()}`,
        this.canvas.width / 2,
        py + 22
      );

      this.ctx.fillStyle = '#facc15';
      this.ctx.shadowColor = '#f59e0b';
      this.ctx.shadowBlur = 12;
      this.ctx.font = 'bold 20px "Courier New", monospace';
      this.ctx.fillText(
        `DAÑO TOTAL ACUMULADO: ${Math.round(this.finalBoss.totalDamageTaken)}`,
        this.canvas.width / 2,
        py + 50
      );

      this.ctx.restore();
      return;
    }

    if (this.megaBoss && this.megaBoss.active) {
      const barWidth = Math.min(620, this.canvas.width * 0.65);
      const barHeight = 16;
      const x = (this.canvas.width - barWidth) / 2;
      const y = this.canvas.height - 52;
      const ratio = Math.max(0, this.megaBoss.hp / this.megaBoss.maxHp);
      const keysRemaining = Math.max(0, Math.ceil(this.megaBoss.hp / 250));

      this.ctx.fillStyle = '#00ffcc';
      this.ctx.font = 'bold 13px "Courier New", monospace';
      this.ctx.fillText(
        `ATAQUE ESPECIAL: [${this.megaBoss.specialAttackName}] // LLAVES PARA DERROTARLO: ${keysRemaining}/5`,
        this.canvas.width / 2,
        y - 28
      );

      this.ctx.fillStyle = '#ff0055';
      this.ctx.font = 'bold 15px "Courier New", monospace';
      this.ctx.fillText(
        `${this.megaBoss.bossTitle} // INTEGRITY: ${this.megaBoss.hp}/${this.megaBoss.maxHp}`,
        this.canvas.width / 2,
        y - 8
      );

      this.ctx.fillStyle = 'rgba(20, 0, 10, 0.9)';
      this.ctx.fillRect(x, y, barWidth, barHeight);

      this.ctx.fillStyle = this.megaBoss.color;
      this.ctx.shadowColor = this.megaBoss.color;
      this.ctx.shadowBlur = 14;
      this.ctx.fillRect(x, y, barWidth * ratio, barHeight);

      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = '#00ffcc';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, barWidth, barHeight);

      this.ctx.restore();
      return;
    }

    const activeBoss = this.enemies.find(
      (e): e is RansomwareBoss => e instanceof RansomwareBoss && e.active
    );

    if (this.spawner.activeBossAlertTimer > 0) {
      const pulse = Math.floor(this.spawner.activeBossAlertTimer * 8) % 2 === 0;
      if (pulse) {
        this.ctx.fillStyle = '#ff0055';
        this.ctx.shadowColor = '#ff0055';
        this.ctx.shadowBlur = 18;
        this.ctx.font = 'bold 20px "Courier New", monospace';
        this.ctx.fillText(
          `!! WARNING: ${this.spawner.lastBossSpawnedName} DETECTED !!`,
          this.canvas.width / 2,
          92
        );
      }
    }

    if (activeBoss) {
      const barWidth = Math.min(520, this.canvas.width * 0.55);
      const barHeight = 14;
      const x = (this.canvas.width - barWidth) / 2;
      const y = this.canvas.height - 46;
      const ratio = Math.max(0, activeBoss.hp / activeBoss.maxHp);

      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = '#ff0055';
      this.ctx.font = 'bold 14px "Courier New", monospace';
      this.ctx.fillText(
        `${activeBoss.bossName} // INTEGRITY: ${activeBoss.hp}/${activeBoss.maxHp}`,
        this.canvas.width / 2,
        y - 8
      );

      this.ctx.fillStyle = 'rgba(20, 0, 10, 0.88)';
      this.ctx.fillRect(x, y, barWidth, barHeight);

      this.ctx.fillStyle = '#ff0055';
      this.ctx.shadowColor = '#ff0055';
      this.ctx.shadowBlur = 12;
      this.ctx.fillRect(x, y, barWidth * ratio, barHeight);

      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = '#ff99bb';
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(x, y, barWidth, barHeight);
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
    this.ctx.fillStyle = 'rgba(0, 8, 4, 0.86)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff66';
    this.ctx.shadowColor = '#00ff66';
    this.ctx.shadowBlur = 16;
    this.ctx.font = 'bold 28px "Courier New", monospace';
    this.ctx.fillText(
      `// ${i18n.t('TARJETAS DE MEJORA', 'UPGRADE CARDS')} :: ${i18n.t('NIVEL', 'LEVEL')} ${this.upgradeSystem.level}.0 //`,
      this.canvas.width / 2,
      this.canvas.height / 2 - 150
    );

    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.font = '15px "Courier New", monospace';
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
      this.ctx.fillStyle = isHovered ? 'rgba(0, 40, 28, 0.95)' : 'rgba(5, 15, 12, 0.92)';
      this.ctx.strokeStyle = isHovered ? '#ffffff' : opt.color;
      this.ctx.lineWidth = isHovered ? 2.5 : 1.5;
      this.ctx.shadowColor = opt.color;
      this.ctx.shadowBlur = isHovered ? 18 : 8;

      this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

      // Recorte estricto dentro de la tarjeta de mejora
      this.ctx.beginPath();
      this.ctx.rect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
      this.ctx.clip();

      this.ctx.shadowBlur = 0;
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = opt.color;
      this.ctx.font = 'bold 12px "Courier New", monospace';
      this.ctx.fillText(`[KEY ${i + 1}] // ${opt.category}`, rect.x + 18, rect.y + 26);

      // Auto-fit para el nombre de la carta
      const nameMaxW = rect.width - 36;
      let nameFont = 17;
      this.ctx.font = `bold ${nameFont}px "Courier New", monospace`;
      const nMetrics = this.ctx.measureText(opt.name).width;
      if (nMetrics > nameMaxW) {
        nameFont = Math.max(12, Math.floor(17 * (nameMaxW / nMetrics)));
        this.ctx.font = `bold ${nameFont}px "Courier New", monospace`;
      }
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(opt.name, rect.x + 18, rect.y + 54);

      this.ctx.fillStyle = '#00ff66';
      this.ctx.font = '12px "Courier New", monospace';
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
      this.ctx.font = '13px "Courier New", monospace';
      this.wrapText(opt.description, rect.x + 18, rect.y + 104, rect.width - 36, 18, 2);

      // Subcaja con las estadísticas que mejoran o disminuyen de cada opción
      const badgeY = rect.y + 148;
      const badgeH = 44;
      const badgeW = rect.width - 36;
      this.ctx.fillStyle = 'rgba(0, 26, 18, 0.95)';
      this.ctx.strokeStyle = opt.color;
      this.ctx.lineWidth = 1.5;
      this.ctx.fillRect(rect.x + 18, badgeY, badgeW, badgeH);
      this.ctx.strokeRect(rect.x + 18, badgeY, badgeW, badgeH);

      // Auto-fit en el badge de estadísticas
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#ffffff';
      const badgeMaxW = badgeW - 16;
      let badgeFont = 12;
      this.ctx.font = `bold ${badgeFont}px "Courier New", monospace`;
      const bMetrics = this.ctx.measureText(opt.statBadge || '').width;
      if (bMetrics > badgeMaxW) {
        badgeFont = Math.max(9, Math.floor(12 * (badgeMaxW / bMetrics)));
        this.ctx.font = `bold ${badgeFont}px "Courier New", monospace`;
      }
      this.ctx.fillText(opt.statBadge || '', rect.x + 18 + badgeW / 2, badgeY + 27);

      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = isHovered ? '#ffffff' : opt.color;
      this.ctx.font = 'bold 13px "Courier New", monospace';
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
    this.ctx.fillStyle = 'rgba(18, 2, 6, 0.96)';
    this.ctx.strokeStyle = '#ff1e42';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = '#ff1e42';
    this.ctx.shadowBlur = 24;
    this.ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    this.ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#ff1e42';
    this.ctx.font = 'bold 30px "Courier New", monospace';
    this.ctx.fillText('KERNEL PANIC // SYSTEM COMPROMISED', cx, cy - 235);

    // Resumen General
    this.ctx.fillStyle = '#00ff66';
    this.ctx.font = '14px "Courier New", monospace';
    this.ctx.fillText(
      `${i18n.t('Agente', 'Agent')}: ${this.player.profileName} (v${this.upgradeSystem.level}.0)  |  ${i18n.t('Tiempo', 'Time')}: ${this.formatTimeMMSS(this.elapsedTime)}  |  ${i18n.t('Bajas', 'Kills')}: ${this.killCount}  |  ${i18n.t('Cripto', 'Crypto')}: +${this.runCoinsCollected} 🪙`,
      cx,
      cy - 200
    );

    if (this.runDamageToToro > 0) {
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.font = 'bold 14px "Courier New", monospace';
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
    this.ctx.fillStyle = 'rgba(10, 2, 6, 0.9)';
    this.ctx.strokeStyle = '#f43f5e';
    this.ctx.lineWidth = 1.5;
    this.ctx.fillRect(leftX, panelY, subW, subH);
    this.ctx.strokeRect(leftX, panelY, subW, subH);

    // Recorte estricto para el panel izquierdo
    this.ctx.beginPath();
    this.ctx.rect(leftX + 2, panelY + 2, subW - 4, subH - 4);
    this.ctx.clip();

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#fb7185';
    this.ctx.font = 'bold 14px "Courier New", monospace';
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
    this.ctx.fillStyle = 'rgba(10, 2, 6, 0.9)';
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 1.5;
    this.ctx.fillRect(rightX, panelY, subW, subH);
    this.ctx.strokeRect(rightX, panelY, subW, subH);

    // Recorte estricto para el panel derecho
    this.ctx.beginPath();
    this.ctx.rect(rightX + 2, panelY + 2, subW - 4, subH - 4);
    this.ctx.clip();

    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#7dd3fc';
    this.ctx.font = 'bold 14px "Courier New", monospace';
    this.ctx.fillText(`👾 ${i18n.t('REGISTRO DE AMENAZAS PURGADAS', 'PURGED THREATS LOG')}`, rightX + 16, panelY + 28);

    const enemyRows = [
      { name: i18n.t('Adware Básico (Rojos)', 'Basic Adware (Red)'), count: this.combatSystem.killsByTypeStats['Adware'], color: '#ef4444' },
      { name: i18n.t('Troyanos Rápidos (Amarillos)', 'Fast Trojans (Yellow)'), count: this.combatSystem.killsByTypeStats['Trojan'], color: '#eab308' },
      { name: i18n.t('Gusanos Divisibles (Morados)', 'Splitting Worms (Purple)'), count: this.combatSystem.killsByTypeStats['Worm'], color: '#a855f7' },
      { name: i18n.t('Evasores (Ghost Scripts)', 'Evasors (Ghost Scripts)'), count: this.combatSystem.killsByTypeStats['Evasor'], color: '#06b6d4' },
      { name: i18n.t('Cajas de Hardware Destruidas', 'Hardware Crates Destroyed'), count: this.combatSystem.killsByTypeStats['Hardware Box'], color: '#f97316' },
      { name: i18n.t('Mega-Jefes Purgados', 'Mega-Bosses Purged'), count: this.defeatedMegaBossVariants.size, color: '#22c55e' },
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
