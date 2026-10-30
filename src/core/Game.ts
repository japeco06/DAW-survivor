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
import { Spawner } from '../systems/Spawner';
import { CombatSystem } from '../systems/CombatSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import {
  MetaSystem,
  CharacterId,
  GACHA_PULL_SINGLE_COST,
  GACHA_PULL_TEN_COST,
  GachaPullEntry,
} from '../systems/MetaSystem';
import { HatItem, HATS_DATABASE, RARITY_CONFIG } from '../systems/HatSystem';

type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER';
type MenuTab = 'SHOP' | 'GACHA' | 'INVENTORY';

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
  action: 'RESUME' | 'EXIT_TO_MENU';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const GAME_VERSION = 'v0.9.4';
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
  private spawner: Spawner;
  private combatSystem: CombatSystem;
  private upgradeSystem: UpgradeSystem;
  private particleSystem: ParticleSystem;

  private isPaused: boolean = false;
  private hoveredPauseAction: 'RESUME' | 'EXIT_TO_MENU' | null = null;

  private normalBossesKilledCount: number = 0;
  private megaBoss: BaseBoss | null = null;
  private encryptedBlocks: EncryptedBlock[] = [];
  private decryptionKeys: DecryptionKey[] = [];
  private debugBossCycleIndex: number = 0;

  private gameState: GameState = 'MENU';
  private lastTime: number = 0;
  private elapsedTime: number = 0;
  private killCount: number = 0;
  private runCoinsCollected: number = 0;
  private highScoreKills: number = 0;
  private showHitboxes: boolean = false;
  private hoveredCardIndex: number = -1;
  private hoveredMenuChar: CharacterId | null = null;
  private activeMenuTab: MenuTab = 'SHOP';
  private lastGachaResults: GachaPullEntry[] = [];
  private gachaRevealTimer: number = 0;
  private inventoryPage: number = 0;
  private hoveredHatId: string | null = null;
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

    this.setupEventListeners();
  }

  private addTerminalLog(message: string): void {
    const timeTag = this.elapsedTime.toFixed(1).padStart(5, '0');
    this.terminalLogs.push(`[${timeTag}s] ${message}`);
    if (this.terminalLogs.length > 5) {
      this.terminalLogs.shift();
    }
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();

      if (key === 'm') {
        this.sound.muted = !this.sound.muted;
        this.addTerminalLog(`Audio Synthesizer: ${this.sound.muted ? 'MUTED' : 'ONLINE'}`);
      }

      if (this.gameState === 'MENU') {
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
        if (key === '1' || key === 'enter') {
          this.togglePause();
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
      } else if (key === 'b') {
        // Permite invocar o rotar entre los 3 nuevos jefes al instante para testear sus patrones
        const forcedIdx = this.megaBoss ? this.debugBossCycleIndex++ : undefined;
        if (!this.megaBoss) this.debugBossCycleIndex++;
        this.triggerMegaBossEvent(forcedIdx);
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.gameState === 'MENU') {
        this.hoveredMenuChar = null;
        this.hoveredHatId = null;

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
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.gameState === 'MENU') {
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
        for (const btn of this.getPauseButtonRects()) {
          if (
            mx >= btn.x &&
            mx <= btn.x + btn.width &&
            my >= btn.y &&
            my <= btn.y + btn.height
          ) {
            if (btn.action === 'RESUME') {
              this.togglePause();
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
    this.decryptionKeys = [];
    this.encryptedBlocks = [];
    this.megaBoss = null;
    this.normalBossesKilledCount = 0;
    this.spawner = new Spawner();
    this.combatSystem = new CombatSystem();
    this.upgradeSystem = new UpgradeSystem();
    this.particleSystem.clear();
    this.elapsedTime = 0;
    this.killCount = 0;
    this.runCoinsCollected = 0;
    this.damageVignetteAlpha = 0;
    this.player = new Player(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.metaSystem.getSelectedProfile()
    );
    this.gameState = 'MENU';
    this.lastTime = performance.now();
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
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
    this.codeFragments = [];
    this.cryptoCoins = [];
    this.decryptionKeys = [];
    this.encryptedBlocks = [];
    this.megaBoss = null;
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
    this.hoveredCardIndex = -1;
    this.damageVignetteAlpha = 0;
    this.gameState = 'PLAYING';
    this.lastTime = performance.now();
    this.sound.playShoot(false);
    this.terminalLogs = [
      `[000.0s] > DEPLOYED: ${profile.name} (HP: ${this.player.maxHp} | Magnet: ${this.player.pickupRadius}px)`,
      `[000.0s] > Controls: [P] Pause | [B] Spawn/Cycle Special Mega-Boss.`,
    ];
  }

  /**
   * Instancia aleatoriamente 1 de los 3 nuevos Mega-Jefes ('El Bañista', 'El Copiota' o 'El Dormilón')
   * junto con el laberinto de Bloques Encriptados.
   */
  private triggerMegaBossEvent(forcedIndex?: number): void {
    this.enemies = [];
    this.projectiles = [];
    this.pingProjectiles = [];
    this.quarantineZones = [];
    this.combatSystem.enemyProjectiles = [];
    this.combatSystem.firewallPulses = [];
    this.combatSystem.sqlBeams = [];
    this.codeFragments = [];
    this.cryptoCoins = [];
    this.decryptionKeys = [];

    this.megaBoss = createRandomMegaBoss(this.canvas.width, forcedIndex);
    this.encryptedBlocks = BaseBoss.createArenaBlocks(
      this.canvas.width,
      this.canvas.height
    );

    for (const block of this.encryptedBlocks) {
      block.resolvePlayerCollision(this.player);
    }

    this.spawnDecryptionKeyInArena();

    this.sound.playExplosion(true);
    this.particleSystem.triggerShake(14, 0.65);
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
          this.particleSystem.triggerShake(9, 0.25);
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
      this.particleSystem.triggerShake(9, 0.45);
    }
    if (this.spawner.swarmTriggeredJustNow) {
      this.sound.playExplosion(true);
      this.particleSystem.triggerShake(12, 0.65);
      this.addTerminalLog('!! ALERTA DE PLAGA: EL ENJAMBRE (50 ENEMIGOS - 6s) !!');
    }
    if (this.spawner.minerSpawnedJustNow) {
      this.sound.playCoinPickup();
      this.addTerminalLog('!! MINERO DE CRIPTOS DETECTADO: ¡CÁZALO ANTES DE QUE ESCAPE! !!');
    }

    for (const proj of this.projectiles) {
      proj.update(dt, this.canvas.width, this.canvas.height);
    }
    for (const ping of this.pingProjectiles) {
      ping.update(dt, this.enemies, this.canvas.width, this.canvas.height);
    }
    for (const enemy of this.enemies) {
      enemy.update(dt, this.player);
      if (enemy instanceof CryptoMiner && enemy.escaped) {
        this.particleSystem.spawnFloatingText(enemy.x, enemy.y, '¡MINERO ESCAPÓ!', '#94a3b8', 1.0);
        this.addTerminalLog('> Crypto Miner escaped from the sector.');
      }
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

      if (compEvents.screenShakeIntensity > 0) {
        this.particleSystem.triggerShake(compEvents.screenShakeIntensity, 0.22);
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

    const prevKillCount = this.killCount;
    this.killCount += combatEvents.enemiesKilled;
    this.metaSystem.updateHighScore(this.killCount, this.elapsedTime);
    this.highScoreKills = Math.max(this.highScoreKills, this.metaSystem.highScore);

    // Mecánica de Vampirismo: cura exactamente 20 HP por cada 20 enemigos eliminados
    const prevVampirismTier = Math.floor(prevKillCount / 20);
    const currentVampirismTier = Math.floor(this.killCount / 20);
    if (currentVampirismTier > prevVampirismTier && this.player.active) {
      const tiersCrossed = currentVampirismTier - prevVampirismTier;
      const passiveVampirismHeal = tiersCrossed * 20;
      this.player.heal(passiveVampirismHeal);
      this.particleSystem.spawnFloatingText(
        this.player.x,
        this.player.y - 30,
        `+${passiveVampirismHeal} HP [VAMPIRISMO]`,
        '#f43f5e',
        1.0
      );
      this.addTerminalLog(
        `VAMPIRISM PASSIVE: +${passiveVampirismHeal} HP restored (${this.killCount} kills).`
      );
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
      this.particleSystem.spawnHitSparks(hit.x, hit.y, hit.color);
      if (hit.damage === 0) {
        this.particleSystem.spawnFloatingText(hit.x, hit.y, '0 [SHIELD]', '#38bdf8', 0.85);
      } else {
        this.particleSystem.spawnFloatingText(hit.x, hit.y, `-${hit.damage}`, '#ffffff', 0.95);
      }
    }

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

      this.particleSystem.spawnExplosion(
        drop.x,
        drop.y,
        drop.color,
        isBoss || drop.malwareType === 'CRYPTO_MINER' ? 55 : 18,
        isBoss || drop.malwareType === 'CRYPTO_MINER'
      );

      if (drop.malwareType === 'HARDWARE_BOX') {
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
        this.particleSystem.triggerShake(10, 0.45);
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

      if (isBoss) {
        this.normalBossesKilledCount++;
        this.particleSystem.triggerShake(12, 0.5);
        this.addTerminalLog(
          `BOSS PURGED (${this.normalBossesKilledCount}/${NORMAL_BOSSES_REQUIRED_FOR_MEGA_BOSS} for Mega-Boss Event)!`
        );

        if (this.normalBossesKilledCount >= NORMAL_BOSSES_REQUIRED_FOR_MEGA_BOSS) {
          this.normalBossesKilledCount = 0;
          triggerMegaBossNow = true;
        }
      }

      this.codeFragments.push(new CodeFragment(drop.x, drop.y, drop.xpValue));

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

      if (drop.enemyRef instanceof Worm && !drop.enemyRef.isSplitChild) {
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

    this.resolveEnemyCrowd();
    this.projectiles = this.projectiles.filter((p) => p.active);
    this.pingProjectiles = this.pingProjectiles.filter((p) => p.active);
    this.quarantineZones = this.quarantineZones.filter((z) => z.active);
    this.enemies = this.enemies.filter((e) => e.active);
    this.codeFragments = this.codeFragments.filter((f) => f.active);
    this.cryptoCoins = this.cryptoCoins.filter((c) => c.active);

    if (triggerMegaBossNow) {
      this.triggerMegaBossEvent();
    }
  }

  private handleMegaBossDefeated(bossX: number, bossY: number, title: string): void {
    this.sound.playExplosion(true);
    this.particleSystem.triggerShake(18, 0.8);
    this.particleSystem.spawnExplosion(bossX, bossY, '#ff0055', 95, true);
    this.particleSystem.spawnExplosion(bossX, bossY, '#00ffcc', 60, true);
    this.particleSystem.spawnFloatingText(
      bossX,
      bossY,
      `${title} DEFEATED! +MASSIVE LOOT`,
      '#00ff66',
      1.3
    );

    this.killCount++;
    this.highScoreKills = Math.max(this.highScoreKills, this.killCount);
    this.decryptionKeys = [];
    this.encryptedBlocks = [];
    this.megaBoss = null;
    this.normalBossesKilledCount = 0;
    this.spawner.syncAfterMegaBoss(this.elapsedTime);

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
    this.addTerminalLog(`>> ${title} PURGED! Labyrinth cleared & weapons restored <<`);
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
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }
  }

  private render(): void {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const shake = this.particleSystem.getShakeOffset();
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

    this.drawCRTScanlines();
    this.drawVersionBadge();
  }

  private getPauseButtonRects(): PauseButtonRect[] {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const btnW = 360;
    const btnH = 50;

    return [
      {
        action: 'RESUME',
        label: '> [1 / P] REANUDAR PARTIDA',
        x: cx - btnW / 2,
        y: cy - 10,
        width: btnW,
        height: btnH,
      },
      {
        action: 'EXIT_TO_MENU',
        label: '> [2 / ESC] SALIR AL MENÚ PRINCIPAL',
        x: cx - btnW / 2,
        y: cy + 58,
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

    const boxW = 480;
    const boxH = 260;
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
    this.ctx.fillText('// SISTEMA EN PAUSA //', cx, cy - 75);

    this.ctx.fillStyle = '#00f0ff';
    this.ctx.font = '13px "Courier New", monospace';
    this.ctx.fillText('Simulación y temporizadores detenidos.', cx, cy - 44);

    for (const btn of this.getPauseButtonRects()) {
      const hovered = this.hoveredPauseAction === btn.action;
      const isExit = btn.action === 'EXIT_TO_MENU';
      const baseColor = isExit ? '#ff1e42' : '#00ff66';

      this.ctx.fillStyle = hovered
        ? isExit
          ? 'rgba(60, 10, 20, 0.95)'
          : 'rgba(0, 55, 32, 0.95)'
        : 'rgba(8, 22, 16, 0.92)';
      this.ctx.strokeStyle = hovered ? '#ffffff' : baseColor;
      this.ctx.lineWidth = hovered ? 2.5 : 1.5;
      this.ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      this.ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

      this.ctx.fillStyle = hovered ? '#ffffff' : baseColor;
      this.ctx.font = 'bold 15px "Courier New", monospace';
      this.ctx.fillText(btn.label, cx, btn.y + 30);
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
    const py = cy - 305;
    const tabW = 225;
    const tabH = 34;
    const gap = 14;
    const totalW = tabW * 3 + gap * 2;
    const startX = cx - totalW / 2;
    const y = py + 98;

    return [
      {
        tab: 'SHOP',
        label: '[Q] AGENTES',
        x: startX,
        y,
        width: tabW,
        height: tabH,
      },
      {
        tab: 'GACHA',
        label: '[G] GACHA // COFRES',
        x: startX + tabW + gap,
        y,
        width: tabW,
        height: tabH,
      },
      {
        tab: 'INVENTORY',
        label: `[I] INVENTARIO (${this.metaSystem.unlockedHats.size}/${HATS_DATABASE.length})`,
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
    const cardW = 340;
    const cardH = 138;
    const gapX = 22;
    const gapY = 14;
    const startX = cx - cardW - gapX / 2;
    const startY = cy - 95;

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
    const btnW = 310;
    const btnH = 42;
    const gap = 20;
    const startX = cx - btnW - gap / 2;
    const y = cy - 92;

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
    const cardW = 222;
    const cardH = 78;
    const gapX = 14;
    const gapY = 12;
    const totalW = cardW * 3 + gapX * 2;
    const startX = cx - totalW / 2;
    const startY = cy - 102;

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
    const y = cy + 165;
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
    const width = 480;
    const height = 44;
    return {
      x: cx - width / 2,
      y: cy + 240,
      width,
      height,
    };
  }

  private drawStartMenuWithShop(): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 6, 3, 0.85)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const panelW = Math.min(760, this.canvas.width - 28);
    const panelH = 610;
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
    this.ctx.fillText(`CYBER SURVIVOR // KERNEL HUB (${GAME_VERSION})`, cx, py + 38);

    const equippedHat = this.metaSystem.getEquippedHat();
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.font = 'bold 14px "Courier New", monospace';
    this.ctx.fillText(
      `[ High Score: ${this.metaSystem.highScore} (${this.formatTimeMMSS(this.metaSystem.bestTimeSeconds)}) ]  |  [ CRYPTO: ${this.metaSystem.coins} 🪙 ]  |  [ EQUIPADO: ${
        equippedHat ? `${equippedHat.icon} ${equippedHat.name}` : 'Ninguno'
      } ]`,
      cx,
      py + 68
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
      this.ctx.fillText(tabRect.label, tabRect.x + tabRect.width / 2, tabRect.y + 22);
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
        this.wrapText(profile.description, rect.x + 14, rect.y + 68, rect.width - 28, 15);

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

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#a3e635';
    this.ctx.font = '13px "Courier New", monospace';
    this.ctx.fillText(this.menuFeedbackMessage, cx, cy + 220);

    const startBtn = this.getStartButtonRect();
    const blink = Math.floor(performance.now() / 450) % 2 === 0;
    this.ctx.fillStyle = 'rgba(0, 40, 22, 0.95)';
    this.ctx.strokeStyle = '#00ff66';
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(startBtn.x, startBtn.y, startBtn.width, startBtn.height);
    this.ctx.strokeRect(startBtn.x, startBtn.y, startBtn.width, startBtn.height);

    this.ctx.fillStyle = blink ? '#00ff66' : '#ffffff';
    this.ctx.font = 'bold 17px "Courier New", monospace';
    this.ctx.fillText(
      '> PULSA [ENTER] O CLIC AQUÍ PARA DESPLEGAR <',
      cx,
      startBtn.y + 28
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
    this.ctx.fillText(
      `[${this.player.profileName} v${this.upgradeSystem.level}.0] | HP: ${this.player.hp}/${this.player.maxHp} | XP_MULT: x${this.player.xpMultiplier.toFixed(2)} | BOSSES: ${this.normalBossesKilledCount}/${NORMAL_BOSSES_REQUIRED_FOR_MEGA_BOSS} | TIME: ${this.formatTimeMMSS(this.elapsedTime)}`,
      16,
      30
    );

    const weaponsStatus = this.megaBoss
      ? `OFFLINE [${this.megaBoss.getCurrentStateLabel()}]`
      : this.combatSystem.getActiveWeaponsList(this.player).join(' + ');

    this.ctx.fillStyle = this.megaBoss ? '#ff0055' : 'rgba(0, 240, 255, 0.85)';
    this.ctx.font = '13px "Courier New", monospace';
    this.ctx.fillText(
      `[ARMAS]: ${weaponsStatus} | [P]: Pausa | [B]: Invocar/Rotar Jefe (Pool 1 de 4)`,
      16,
      52
    );
    this.ctx.restore();
  }

  private drawBossHUD(): void {
    this.ctx.save();
    this.ctx.textAlign = 'center';

    if (this.megaBoss && this.megaBoss.active) {
      const barWidth = Math.min(620, this.canvas.width * 0.65);
      const barHeight = 16;
      const x = (this.canvas.width - barWidth) / 2;
      const y = this.canvas.height - 52;
      const ratio = Math.max(0, this.megaBoss.hp / this.megaBoss.maxHp);

      this.ctx.fillStyle = '#00ffcc';
      this.ctx.font = 'bold 13px "Courier New", monospace';
      this.ctx.fillText(
        `ATAQUE ESPECIAL: [${this.megaBoss.specialAttackName}] // Recoge [DECRYPT_KEY] para dañar al Jefe`,
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
    const cardWidth = 285;
    const cardHeight = 235;
    const gap = 24;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * gap;
    const startX = (this.canvas.width - totalWidth) / 2;
    const y = this.canvas.height / 2 - cardHeight / 2 + 20;

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
    this.ctx.fillStyle = 'rgba(0, 8, 4, 0.84)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff66';
    this.ctx.shadowColor = '#00ff66';
    this.ctx.shadowBlur = 16;
    this.ctx.font = 'bold 28px "Courier New", monospace';
    this.ctx.fillText(
      `// TARJETAS DE MEJORA :: NIVEL ${this.upgradeSystem.level}.0 //`,
      this.canvas.width / 2,
      this.canvas.height / 2 - 145
    );

    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.font = '15px "Courier New", monospace';
    this.ctx.fillText(
      'Elige 1 de las 3 Tarjetas de Mejora con las teclas [1] [2] [3] o haciendo clic:',
      this.canvas.width / 2,
      this.canvas.height / 2 - 112
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

      this.ctx.shadowBlur = 0;
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = opt.color;
      this.ctx.font = 'bold 13px "Courier New", monospace';
      this.ctx.fillText(`[KEY ${i + 1}] // ${opt.category}`, rect.x + 16, rect.y + 28);

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 18px "Courier New", monospace';
      this.ctx.fillText(opt.name, rect.x + 16, rect.y + 60);

      this.ctx.fillStyle = '#00ff66';
      this.ctx.font = '13px "Courier New", monospace';
      this.ctx.fillText(
        opt.level === 0
          ? 'Estado: NUEVA TARJETA -> v1.0'
          : `Nivel: v${opt.level}.0 -> v${opt.level + 1}.0 (Máx ${opt.maxLevel})`,
        rect.x + 16,
        rect.y + 84
      );

      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.font = '13px "Courier New", monospace';
      this.wrapText(opt.description, rect.x + 16, rect.y + 118, rect.width - 32, 19);

      this.ctx.fillStyle = opt.color;
      this.ctx.font = 'bold 13px "Courier New", monospace';
      this.ctx.fillText(`> SELECCIONAR TARJETA [${i + 1}]`, rect.x + 16, rect.y + rect.height - 20);

      this.ctx.restore();
    }

    this.ctx.restore();
  }

  private wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = this.ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        this.ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    this.ctx.fillText(line, x, currentY);
  }

  private drawSystemFailureOverlay(): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(8, 0, 2, 0.86)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const boxW = 640;
    const boxH = 310;
    this.ctx.fillStyle = 'rgba(18, 2, 6, 0.95)';
    this.ctx.strokeStyle = '#ff1e42';
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = '#ff1e42';
    this.ctx.shadowBlur = 20;
    this.ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    this.ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#ff1e42';
    this.ctx.font = 'bold 34px "Courier New", monospace';
    this.ctx.fillText('KERNEL PANIC // SYSTEM COMPROMISED', cx, cy - 85);

    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#00ff66';
    this.ctx.font = '16px "Courier New", monospace';
    this.ctx.fillText(
      `Agente: ${this.player.profileName} (v${this.upgradeSystem.level}.0)  |  Amenaza: LVL ${this.spawner.currentThreatLevel}`,
      cx,
      cy - 30
    );
    this.ctx.fillText(
      `Malware Purgado: ${this.killCount} (Récord: ${this.highScoreKills})  |  Tiempo: ${this.formatTimeMMSS(this.elapsedTime)}`,
      cx,
      cy + 2
    );

    this.ctx.fillStyle = '#fbbf24';
    this.ctx.font = 'bold 16px "Courier New", monospace';
    this.ctx.fillText(
      `Criptomonedas recogidas: +${this.runCoinsCollected} (Total en Tienda: ${this.metaSystem.coins})`,
      cx,
      cy + 36
    );

    const blink = Math.floor(performance.now() / 450) % 2 === 0;
    this.ctx.fillStyle = blink ? '#00f0ff' : '#ffffff';
    this.ctx.font = 'bold 16px "Courier New", monospace';
    this.ctx.fillText(
      '[R / ENTER]: Reintentar  |  [T / ESC / CLIC]: Ir a Tienda Principal',
      cx,
      cy + 95
    );
    this.ctx.restore();
  }
}
