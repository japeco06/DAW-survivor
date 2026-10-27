import { Input } from './Input';
import { SoundSystem } from './SoundSystem';
import { Entity } from '../entities/Entity';
import { Player } from '../entities/Player';
import { Adware } from '../entities/Adware';
import { Worm } from '../entities/Worm';
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
import { MetaSystem, CharacterId } from '../systems/MetaSystem';

type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER';

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

const GAME_VERSION = 'v0.6.2';
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
  private menuFeedbackMessage: string =
    'Selecciona un Agente con [1][2][3][4] o haz clic en su tarjeta para desbloquearlo/equiparlo.';
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
        };
        if (keyMap[key]) {
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
    this.isPaused = false;
    this.hoveredPauseAction = null;
    this.hoveredCardIndex = -1;
    this.enemies = [];
    this.projectiles = [];
    this.pingProjectiles = [];
    this.quarantineZones = [];
    this.combatSystem.enemyProjectiles = [];
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

    for (const proj of this.projectiles) {
      proj.update(dt, this.canvas.width, this.canvas.height);
    }
    for (const ping of this.pingProjectiles) {
      ping.update(dt, this.enemies, this.canvas.width, this.canvas.height);
    }
    for (const enemy of this.enemies) {
      enemy.update(dt, this.player);
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
    this.killCount += combatEvents.enemiesKilled;
    this.highScoreKills = Math.max(this.highScoreKills, this.killCount);

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
      const isBoss = drop.malwareType === 'RANSOMWARE';
      this.sound.playExplosion(isBoss);

      this.particleSystem.spawnExplosion(
        drop.x,
        drop.y,
        drop.color,
        isBoss ? 55 : 18,
        isBoss
      );

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
        const hpMult = this.spawner.getGlobalHpMultiplier(
          this.elapsedTime,
          this.upgradeSystem.level
        );
        this.enemies.push(new Worm(drop.x - 14, drop.y - 14, hpMult, true));
        this.enemies.push(new Worm(drop.x + 14, drop.y + 14, hpMult, true));
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

        const leveledUp = this.upgradeSystem.addXp(gainedXp);
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

  private getMenuCharacterRects(): MenuCharacterRect[] {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const cardW = 340;
    const cardH = 148;
    const gapX = 22;
    const gapY = 16;
    const startX = cx - cardW - gapX / 2;
    const startY = cy - 115;

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

  private getStartButtonRect(): { x: number; y: number; width: number; height: number } {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const width = 480;
    const height = 46;
    return {
      x: cx - width / 2,
      y: cy + 232,
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
    const panelH = 590;
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
    this.ctx.font = 'bold 34px "Courier New", monospace';
    this.ctx.fillText('CYBER SURVIVOR // KERNEL SHOP', cx, py + 44);

    this.ctx.fillStyle = '#fbbf24';
    this.ctx.shadowColor = '#f59e0b';
    this.ctx.shadowBlur = 10;
    this.ctx.font = 'bold 18px "Courier New", monospace';
    this.ctx.fillText(
      `[ CRIPTOMONEDAS DISPONIBLES: ${this.metaSystem.coins} 🪙 ]`,
      cx,
      py + 78
    );

    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.font = '14px "Courier New", monospace';
    this.ctx.fillText(
      'SELECCIONA O DESBLOQUEA UN AGENTE CON CRIPTOMONEDAS (Teclas [1][2][3] o Clic):',
      cx,
      py + 106
    );

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

      this.ctx.shadowBlur = 0;
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 15px "Courier New", monospace';
      this.ctx.fillText(`[${i + 1}] ${profile.name}`, rect.x + 56, rect.y + 28);

      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = 'bold 11px "Courier New", monospace';
      this.ctx.fillText(profile.subtitle, rect.x + 56, rect.y + 46);

      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.font = '12px "Courier New", monospace';
      this.wrapText(profile.description, rect.x + 14, rect.y + 72, rect.width - 28, 16);

      this.ctx.font = 'bold 12px "Courier New", monospace';
      if (selected) {
        this.ctx.fillStyle = '#00ff66';
        this.ctx.fillText('✔ EQUIPADO Y LISTO', rect.x + 14, rect.y + rect.height - 14);
      } else if (unlocked) {
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.fillText(`> PULSA [${i + 1}] O CLIC PARA EQUIPAR`, rect.x + 14, rect.y + rect.height - 14);
      } else {
        const canAfford = this.metaSystem.coins >= profile.cost;
        this.ctx.fillStyle = canAfford ? '#fbbf24' : '#ff1e42';
        this.ctx.fillText(
          `🔒 DESBLOQUEAR (${profile.cost} CRYPTO)`,
          rect.x + 14,
          rect.y + rect.height - 14
        );
      }

      this.ctx.restore();
    }

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#a3e635';
    this.ctx.font = '13px "Courier New", monospace';
    this.ctx.fillText(this.menuFeedbackMessage, cx, cy + 214);

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
      startBtn.y + 29
    );

    this.ctx.restore();
  }

  private drawScannerRange(): void {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([6, 6]);
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, this.combatSystem.attackRange, 0, Math.PI * 2);
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
      : this.combatSystem.getActiveWeaponsList().join(' + ');

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
