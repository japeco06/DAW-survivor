import { Adware } from '../entities/Adware';
import { Trojan } from '../entities/Trojan';
import { TrojanShooter } from '../entities/TrojanShooter';
import { Worm } from '../entities/Worm';
import { ArmoredWorm } from '../entities/ArmoredWorm';
import { HardwareBox } from '../entities/HardwareBox';
import { CryptoMiner } from '../entities/CryptoMiner';
import { RansomwareBoss } from '../entities/RansomwareBoss';

export class Spawner {
  private timer: number = 0;
  private spawnMargin: number = 50;
  private readonly bossSpawnInterval: number = 22;
  private nextBossTime: number = 22;
  private bossCount: number = 0;

  private readonly maxActiveArmoredWorms: number = 3;
  private readonly maxActiveTrojanShooters: number = 5;
  private readonly maxActiveTrojans: number = 5;
  private readonly maxActiveWorms: number = 5;
  private readonly maxActiveRedAdware: number = 14;
  private readonly maxActiveHardwareBoxes: number = 4;

  private boxCheckTimer: number = 0;
  private minerCheckTimer: number = 0;
  private swarmCheckTimer: number = 0;

  public swarmActiveTimer: number = 0;
  public swarmTriggeredJustNow: boolean = false;
  public minerSpawnedJustNow: boolean = false;

  public currentThreatLevel: number = 1;
  public activeBossAlertTimer: number = 0;
  public lastBossSpawnedName: string = '';

  public syncAfterMegaBoss(elapsedTime: number): void {
    this.timer = 0;
    this.nextBossTime = elapsedTime + this.bossSpawnInterval;
  }

  public triggerSwarmEvent(
    enemies: Adware[],
    canvasWidth: number,
    canvasHeight: number
  ): void {
    this.swarmActiveTimer = 11.0;
    this.swarmTriggeredJustNow = true;

    // Generar inmediatamente 50 enemigos de la variante 'Amarilla' con muy poca vida y daño
    for (let i = 0; i < 50; i++) {
      const pos = this.getRandomOutsidePosition(canvasWidth, canvasHeight);
      const jitterX = (Math.random() - 0.5) * 90;
      const jitterY = (Math.random() - 0.5) * 90;
      const swarmTrojan = new Trojan(pos.x + jitterX, pos.y + jitterY, 1);
      swarmTrojan.maxHp = 8;
      swarmTrojan.hp = 8;
      swarmTrojan.damage = 4;
      swarmTrojan.xpValue = 6;
      swarmTrojan.speed = 165 + Math.random() * 35;
      enemies.push(swarmTrojan);
    }
  }

  /**
   * Escalado de vida no lineal:
   * - En los primeros niveles (1 a 6) el incremento es muy suave para no frenar el early game.
   * - En niveles altos (late game, nivel > 6 y tiempo avanzado) se activa una curva exponencial/potencial agresiva.
   */
  public getGlobalHpMultiplier(elapsedTime: number, playerLevel: number): number {
    const earlyLevelBonus = Math.max(0, playerLevel - 1) * 0.035;
    const lateLevelLevels = Math.max(0, playerLevel - 6);
    const lateLevelBonus = Math.pow(lateLevelLevels, 1.85) * 0.12;

    const earlyTimeBonus = Math.min(elapsedTime, 120) * 0.003;
    const lateTimeMinutes = Math.max(0, (elapsedTime - 120) / 60);
    const lateTimeBonus = Math.pow(lateTimeMinutes, 1.7) * 0.45;

    return Number((1 + earlyLevelBonus + lateLevelBonus + earlyTimeBonus + lateTimeBonus).toFixed(2));
  }

  public update(
    dt: number,
    elapsedTime: number,
    playerLevel: number,
    enemies: Adware[],
    canvasWidth: number,
    canvasHeight: number
  ): void {
    this.swarmTriggeredJustNow = false;
    this.minerSpawnedJustNow = false;

    if (this.activeBossAlertTimer > 0) {
      this.activeBossAlertTimer = Math.max(0, this.activeBossAlertTimer - dt);
    }

    this.currentThreatLevel = 1 + Math.floor(elapsedTime / 20);
    const hpMultiplier = this.getGlobalHpMultiplier(elapsedTime, playerLevel);

    // 1. Obstáculos: Cajas de Hardware (probabilidad media-baja, superior a los eventos)
    this.boxCheckTimer += dt;
    if (this.boxCheckTimer >= 9.0) {
      this.boxCheckTimer = 0;
      const activeBoxes = enemies.filter(
        (e) => e.active && e instanceof HardwareBox
      ).length;
      if (activeBoxes < this.maxActiveHardwareBoxes && Math.random() < 0.48) {
        const bx = 110 + Math.random() * Math.max(120, canvasWidth - 220);
        const by = 110 + Math.random() * Math.max(120, canvasHeight - 220);
        enemies.push(new HardwareBox(bx, by, hpMultiplier));
      }
    }

    // 2. El Minero de Criptos (Loot Goblin - probabilidad muy baja)
    this.minerCheckTimer += dt;
    if (elapsedTime >= 18 && this.minerCheckTimer >= 14.0) {
      this.minerCheckTimer = 0;
      const activeMiners = enemies.filter(
        (e) => e.active && e instanceof CryptoMiner
      ).length;
      if (activeMiners === 0 && Math.random() < 0.14) {
        const mx = 140 + Math.random() * Math.max(120, canvasWidth - 280);
        const my = 140 + Math.random() * Math.max(120, canvasHeight - 280);
        enemies.push(new CryptoMiner(mx, my, hpMultiplier));
        this.minerSpawnedJustNow = true;
      }
    }

    // 3. Evento 'El Enjambre' (Plaga): durante 15s detiene el spawn normal de enemigos
    if (this.swarmActiveTimer > 0) {
      this.swarmActiveTimer = Math.max(0, this.swarmActiveTimer - dt);
      if (elapsedTime >= this.nextBossTime) {
        this.nextBossTime = elapsedTime + 4;
      }
      return;
    }

    this.swarmCheckTimer += dt;
    if (elapsedTime >= 25 && this.swarmCheckTimer >= 16.0) {
      this.swarmCheckTimer = 0;
      if (Math.random() < 0.12) {
        this.triggerSwarmEvent(enemies, canvasWidth, canvasHeight);
        return;
      }
    }

    const currentSpawnInterval = Math.max(0.28, 0.92 * Math.pow(0.92, elapsedTime / 14));

    this.timer += dt;
    while (this.timer >= currentSpawnInterval) {
      this.timer -= currentSpawnInterval;
      const spawned = this.spawnScaledMalware(
        elapsedTime,
        hpMultiplier,
        enemies,
        canvasWidth,
        canvasHeight
      );
      if (spawned) {
        enemies.push(spawned);
      }
    }

    if (elapsedTime >= this.nextBossTime) {
      this.bossCount++;
      this.nextBossTime = elapsedTime + this.bossSpawnInterval;
      const pos = this.getRandomOutsidePosition(canvasWidth, canvasHeight);
      const boss = new RansomwareBoss(pos.x, pos.y, this.bossCount);
      enemies.push(boss);

      this.lastBossSpawnedName = boss.bossName;
      this.activeBossAlertTimer = 4.0;
    }
  }

  private spawnScaledMalware(
    elapsedTime: number,
    hpMultiplier: number,
    enemies: Adware[],
    width: number,
    height: number
  ): Adware | null {
    const pos = this.getRandomOutsidePosition(width, height);
    const roll = Math.random();

    const activeArmoredCount = enemies.filter(
      (e) => e.active && e instanceof ArmoredWorm
    ).length;
    const activeShooterCount = enemies.filter(
      (e) => e.active && e instanceof TrojanShooter
    ).length;
    const activeTrojanCount = enemies.filter(
      (e) => e.active && e instanceof Trojan
    ).length;
    const activeWormCount = enemies.filter(
      (e) => e.active && e instanceof Worm
    ).length;
    const activeRedAdwareCount = enemies.filter(
      (e) => e.active && e.malwareType === 'ADWARE'
    ).length;

    // Máximo 3 Gusanos Blindados vivos simultáneamente en pantalla
    if (
      elapsedTime >= 18 &&
      roll < 0.06 &&
      activeArmoredCount < this.maxActiveArmoredWorms
    ) {
      return new ArmoredWorm(pos.x, pos.y, hpMultiplier);
    }

    // Máximo 5 Troyanos Tiradores vivos simultáneamente en pantalla
    if (
      elapsedTime >= 14 &&
      roll >= 0.06 &&
      roll < 0.13 &&
      activeShooterCount < this.maxActiveTrojanShooters
    ) {
      return new TrojanShooter(pos.x, pos.y, hpMultiplier);
    }

    // Máximo 5 enemigos morados (Worm) vivos simultáneamente en pantalla
    if (
      elapsedTime >= 30 &&
      roll >= 0.13 &&
      roll < 0.28 &&
      activeWormCount < this.maxActiveWorms
    ) {
      return new Worm(pos.x, pos.y, hpMultiplier, false);
    }

    // Máximo 5 enemigos amarillos (Trojan) vivos simultáneamente en pantalla
    const trojanChance = elapsedTime >= 12 ? Math.min(0.32, 0.15 + elapsedTime * 0.0025) : 0;
    if (roll >= 0.28 && roll < 0.28 + trojanChance && activeTrojanCount < this.maxActiveTrojans) {
      return new Trojan(pos.x, pos.y, hpMultiplier);
    }

    // Límite máximo en pantalla de enemigos 'rojos' (Adware base) para evitar saturación
    if (activeRedAdwareCount >= this.maxActiveRedAdware) {
      return null;
    }

    const adware = new Adware(pos.x, pos.y);
    adware.maxHp = Math.round(25 * hpMultiplier);
    adware.hp = adware.maxHp;
    return adware;
  }

  private getRandomOutsidePosition(width: number, height: number): { x: number; y: number } {
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0:
        return { x: Math.random() * width, y: -this.spawnMargin };
      case 1:
        return { x: width + this.spawnMargin, y: Math.random() * height };
      case 2:
        return { x: Math.random() * width, y: height + this.spawnMargin };
      default:
        return { x: -this.spawnMargin, y: Math.random() * height };
    }
  }
}
