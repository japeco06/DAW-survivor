import { Adware } from '../entities/Adware';
import { Trojan } from '../entities/Trojan';
import { TrojanShooter } from '../entities/TrojanShooter';
import { Worm } from '../entities/Worm';
import { ArmoredWorm } from '../entities/ArmoredWorm';
import { Evasor } from '../entities/Evasor';
import { HardwareBox } from '../entities/HardwareBox';
import { CryptoMiner } from '../entities/CryptoMiner';
import { RansomwareBoss } from '../entities/RansomwareBoss';

export class Spawner {
  private timer: number = 0;
  private spawnMargin: number = 50;
  private readonly bossSpawnInterval: number = 75;
  private nextBossTime: number = 75;
  private bossCount: number = 0;

  private readonly maxActiveArmoredWorms: number = 3;
  private readonly maxActiveEvasors: number = 3;
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

  private flankWaveTimer: number = 0;
  private nextFlankWaveInterval: number = 17;
  public finalBossMode: boolean = false;

  public enableFinalBossMode(): void {
    this.finalBossMode = true;
    this.timer = 0;
    this.boxCheckTimer = 0;
    this.minerCheckTimer = 0;
    this.swarmCheckTimer = 0;
    this.swarmActiveTimer = 0;
    this.flankWaveTimer = 0;
    this.activeBossAlertTimer = 0;
    this.nextBossTime = Number.POSITIVE_INFINITY;
  }

  public triggerSwarmEvent(
    enemies: Adware[],
    canvasWidth: number,
    canvasHeight: number
  ): void {
    this.swarmActiveTimer = 6.0;
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
   * Escalado de vida lineal y equilibrado (v0.11.0):
   * - En los primeros niveles (1 a 6) el incremento es suave (+3.5% por nivel).
   * - A partir del nivel 6, escala linealmente a un +8% de multiplicador global por nivel.
   * - Escalado por tiempo moderado y predecible.
   */
  public getGlobalHpMultiplier(elapsedTime: number, playerLevel: number): number {
    const earlyLevelBonus = Math.max(0, playerLevel - 1) * 0.035;
    const lateLevelBonus = Math.max(0, playerLevel - 6) * 0.08;
    const timeBonus = Math.min(0.6, (elapsedTime / 60) * 0.08);

    return Number((1 + earlyLevelBonus + lateLevelBonus + timeBonus).toFixed(2));
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

    // Fase de Jefe Final ("El Toro"): TODOS los temporizadores de élites, especiales y jefes quedan detenidos.
    // ÚNICAMENTE pueden aparecer enemigos básicos rojos (Adware) con un límite estricto de 15 en pantalla simultáneamente.
    if (this.finalBossMode) {
      const currentSpawnInterval = Math.max(0.28, 0.92 * Math.pow(0.92, elapsedTime / 14));
      this.timer += dt;
      while (this.timer >= currentSpawnInterval) {
        this.timer -= currentSpawnInterval;
        const activeRedAdwareCount = enemies.filter(
          (e) => e.active && e.malwareType === 'ADWARE'
        ).length;
        if (activeRedAdwareCount < 15) {
          const pos = this.getRandomOutsidePosition(canvasWidth, canvasHeight);
          const adware = this.createScaledRedAdware(pos.x, pos.y, elapsedTime, hpMultiplier);
          enemies.push(adware);
        }
      }
      return;
    }

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

    // 4. Micro-oleadas de flanco: cada 15-20s genera un grupo de 4-6 enemigos rojos por el mismo borde
    this.flankWaveTimer += dt;
    if (this.flankWaveTimer >= this.nextFlankWaveInterval) {
      this.flankWaveTimer = 0;
      this.nextFlankWaveInterval = 15 + Math.random() * 5;
      this.spawnFlankMicroWave(elapsedTime, hpMultiplier, enemies, canvasWidth, canvasHeight);
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
    const activeEvasorCount = enemies.filter(
      (e) => e.active && e instanceof Evasor
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

    // Nuevo enemigo 'Evasor' (Ghost Script): no aparece durante los primeros 60s y límite máx. de 3 en pantalla
    if (
      elapsedTime >= 60 &&
      roll < 0.08 &&
      activeEvasorCount < this.maxActiveEvasors
    ) {
      return new Evasor(pos.x, pos.y, hpMultiplier);
    }

    // Máximo 3 Gusanos Blindados vivos simultáneamente en pantalla
    if (
      elapsedTime >= 18 &&
      roll >= 0.08 &&
      roll < 0.14 &&
      activeArmoredCount < this.maxActiveArmoredWorms
    ) {
      return new ArmoredWorm(pos.x, pos.y, hpMultiplier);
    }

    // Máximo 5 Troyanos Tiradores vivos simultáneamente en pantalla
    if (
      elapsedTime >= 14 &&
      roll >= 0.14 &&
      roll < 0.21 &&
      activeShooterCount < this.maxActiveTrojanShooters
    ) {
      return new TrojanShooter(pos.x, pos.y, hpMultiplier);
    }

    // Máximo 5 enemigos morados (Worm) vivos simultáneamente en pantalla
    if (
      elapsedTime >= 30 &&
      roll >= 0.21 &&
      roll < 0.34 &&
      activeWormCount < this.maxActiveWorms
    ) {
      return new Worm(pos.x, pos.y, hpMultiplier, false);
    }

    // Máximo 5 enemigos amarillos (Trojan) vivos simultáneamente en pantalla
    const trojanChance = elapsedTime >= 12 ? Math.min(0.32, 0.15 + elapsedTime * 0.0025) : 0;
    if (roll >= 0.34 && roll < 0.34 + trojanChance && activeTrojanCount < this.maxActiveTrojans) {
      return new Trojan(pos.x, pos.y, hpMultiplier);
    }

    // Límite máximo en pantalla de enemigos 'rojos' (Adware base) para evitar saturación
    if (activeRedAdwareCount >= this.maxActiveRedAdware) {
      return null;
    }

    return this.createScaledRedAdware(pos.x, pos.y, elapsedTime, hpMultiplier);
  }

  private createScaledRedAdware(
    x: number,
    y: number,
    elapsedTime: number,
    hpMultiplier: number
  ): Adware {
    const adware = new Adware(x, y);
    const timeMinutes = elapsedTime / 60;
    // Escalado progresivo leve en mid-to-late game: incremento suave de vida y velocidad
    const progressiveHpMult = Math.min(
      3.8,
      Math.min(2.5, hpMultiplier) * (1 + timeMinutes * 0.07)
    );
    adware.maxHp = Math.round(25 * progressiveHpMult);
    adware.hp = adware.maxHp;

    const speedBonus = Math.min(48, timeMinutes * 4.5);
    adware.speed = Math.round(115 + speedBonus);
    return adware;
  }

  private spawnFlankMicroWave(
    elapsedTime: number,
    hpMultiplier: number,
    enemies: Adware[],
    width: number,
    height: number
  ): void {
    const edge = Math.floor(Math.random() * 4); // 0=Arriba, 1=Derecha, 2=Abajo, 3=Izquierda
    const count = 4 + Math.floor(Math.random() * 3); // 4 a 6 enemigos
    const centerNorm = 0.2 + Math.random() * 0.6; // Entre 20% y 80% del borde

    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 36;
      let x = 0;
      let y = 0;
      switch (edge) {
        case 0:
          x = Math.max(35, Math.min(width - 35, width * centerNorm + spread));
          y = -this.spawnMargin - Math.random() * 25;
          break;
        case 1:
          x = width + this.spawnMargin + Math.random() * 25;
          y = Math.max(35, Math.min(height - 35, height * centerNorm + spread));
          break;
        case 2:
          x = Math.max(35, Math.min(width - 35, width * centerNorm + spread));
          y = height + this.spawnMargin + Math.random() * 25;
          break;
        default:
          x = -this.spawnMargin - Math.random() * 25;
          y = Math.max(35, Math.min(height - 35, height * centerNorm + spread));
          break;
      }
      const adware = this.createScaledRedAdware(x, y, elapsedTime, hpMultiplier);
      enemies.push(adware);
    }
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
