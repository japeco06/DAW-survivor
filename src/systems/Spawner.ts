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

  private readonly maxActiveHardwareBoxes: number = 4;

  public getMaxActiveArmoredWorms(elapsedTime: number): number {
    return Math.min(5, Math.floor(2 + (elapsedTime / 60) * 0.35));
  }
  public getMaxActiveEvasors(elapsedTime: number): number {
    return Math.min(5, Math.floor(2 + (elapsedTime / 60) * 0.35));
  }
  public getMaxActiveTrojanShooters(elapsedTime: number): number {
    return Math.min(8, Math.floor(4 + (elapsedTime / 60) * 0.45));
  }
  public getMaxActiveTrojans(elapsedTime: number): number {
    return Math.min(12, Math.floor(5 + (elapsedTime / 60) * 0.7));
  }
  public getMaxActiveWorms(elapsedTime: number): number {
    return Math.min(10, Math.floor(5 + (elapsedTime / 60) * 0.55));
  }
  public getMaxActiveRedAdware(elapsedTime: number): number {
    return Math.min(32, Math.floor(14 + (elapsedTime / 60) * 1.8));
  }

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
    canvasHeight: number,
    elapsedTime: number = 0
  ): void {
    this.swarmActiveTimer = 6.0;
    this.swarmTriggeredJustNow = true;

    const timeMinutes = elapsedTime / 60;
    const swarmCount = Math.min(75, Math.floor(50 + timeMinutes * 2.5));
    const baseHp = Math.round(8 * (1 + timeMinutes * 0.08));
    const baseDmg = Math.round(4 * this.getGlobalDamageMultiplier(elapsedTime));

    for (let i = 0; i < swarmCount; i++) {
      const pos = this.getRandomOutsidePosition(canvasWidth, canvasHeight);
      const jitterX = (Math.random() - 0.5) * 90;
      const jitterY = (Math.random() - 0.5) * 90;
      const swarmTrojan = new Trojan(pos.x + jitterX, pos.y + jitterY, 1);
      swarmTrojan.maxHp = baseHp;
      swarmTrojan.hp = baseHp;
      swarmTrojan.damage = baseDmg;
      swarmTrojan.xpValue = 6;
      swarmTrojan.speed = 165 + Math.random() * 35 + Math.min(25, timeMinutes * 2.5);
      enemies.push(swarmTrojan);
    }
  }

  /**
   * Escalado dinámico progresivo a medida que avanza la partida:
   * - Vida: escala por nivel del jugador y tiempo continuo sin estancarse a los 7 minutos.
   * - Daño: escala moderadamente (+4.5% por minuto) para mantener la tensión.
   * - Velocidad: escala suavemente (+1.8% por minuto) para exigir mejor posicionamiento.
   */
  public getGlobalHpMultiplier(elapsedTime: number, playerLevel: number): number {
    const earlyLevelBonus = Math.max(0, playerLevel - 1) * 0.035;
    const lateLevelBonus = Math.max(0, playerLevel - 6) * 0.075;
    const timeBonus = (elapsedTime / 60) * 0.11;

    return Number((1 + earlyLevelBonus + lateLevelBonus + timeBonus).toFixed(2));
  }

  public getGlobalDamageMultiplier(elapsedTime: number): number {
    const timeMinutes = elapsedTime / 60;
    return Math.min(1.55, 1 + timeMinutes * 0.045);
  }

  public getGlobalSpeedMultiplier(elapsedTime: number): number {
    const timeMinutes = elapsedTime / 60;
    return Math.min(1.22, 1 + timeMinutes * 0.018);
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
        this.triggerSwarmEvent(enemies, canvasWidth, canvasHeight, elapsedTime);
        return;
      }
    }

    // 4. Micro-oleadas de flanco: intervalo y cantidad escalan con el tiempo
    this.flankWaveTimer += dt;
    if (this.flankWaveTimer >= this.nextFlankWaveInterval) {
      this.flankWaveTimer = 0;
      const timeMinutes = elapsedTime / 60;
      this.nextFlankWaveInterval = Math.max(9, (15 + Math.random() * 5) - timeMinutes * 0.65);
      this.spawnFlankMicroWave(elapsedTime, hpMultiplier, enemies, canvasWidth, canvasHeight);
    }

    const currentSpawnInterval = Math.max(0.18, 0.90 * Math.pow(0.91, elapsedTime / 14));

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

    const dmgMult = this.getGlobalDamageMultiplier(elapsedTime);
    const spdMult = this.getGlobalSpeedMultiplier(elapsedTime);

    // Nuevo enemigo 'Evasor' (Ghost Script): no aparece durante los primeros 60s y escala con el tiempo
    if (
      elapsedTime >= 60 &&
      roll < 0.09 &&
      activeEvasorCount < this.getMaxActiveEvasors(elapsedTime)
    ) {
      const evasor = new Evasor(pos.x, pos.y, hpMultiplier);
      evasor.damage = Math.round(evasor.damage * dmgMult);
      evasor.speed = Math.round(evasor.speed * spdMult);
      return evasor;
    }

    // Gusanos Blindados vivos simultáneamente en pantalla (escala de 2 a 5)
    if (
      elapsedTime >= 18 &&
      roll >= 0.09 &&
      roll < 0.16 &&
      activeArmoredCount < this.getMaxActiveArmoredWorms(elapsedTime)
    ) {
      const armored = new ArmoredWorm(pos.x, pos.y, hpMultiplier);
      armored.damage = Math.round(armored.damage * dmgMult);
      armored.speed = Math.round(armored.speed * spdMult);
      return armored;
    }

    // Troyanos Tiradores vivos simultáneamente en pantalla (escala de 4 a 8)
    if (
      elapsedTime >= 14 &&
      roll >= 0.16 &&
      roll < 0.24 &&
      activeShooterCount < this.getMaxActiveTrojanShooters(elapsedTime)
    ) {
      const shooter = new TrojanShooter(pos.x, pos.y, hpMultiplier);
      shooter.damage = Math.round(shooter.damage * dmgMult);
      shooter.speed = Math.round(shooter.speed * spdMult);
      return shooter;
    }

    // Enemigos morados (Worm) vivos simultáneamente en pantalla (escala de 5 a 10)
    if (
      elapsedTime >= 30 &&
      roll >= 0.24 &&
      roll < 0.38 &&
      activeWormCount < this.getMaxActiveWorms(elapsedTime)
    ) {
      const worm = new Worm(pos.x, pos.y, hpMultiplier, false);
      worm.damage = Math.round(worm.damage * dmgMult);
      worm.speed = Math.round(worm.speed * spdMult);
      return worm;
    }

    // Enemigos amarillos (Trojan) vivos simultáneamente en pantalla (escala de 5 a 12)
    const trojanChance = elapsedTime >= 12 ? Math.min(0.36, 0.16 + elapsedTime * 0.0028) : 0;
    if (roll >= 0.38 && roll < 0.38 + trojanChance && activeTrojanCount < this.getMaxActiveTrojans(elapsedTime)) {
      const trojan = new Trojan(pos.x, pos.y, hpMultiplier);
      trojan.damage = Math.round(trojan.damage * dmgMult);
      trojan.speed = Math.round(trojan.speed * spdMult);
      return trojan;
    }

    // Límite dinámico en pantalla de enemigos 'rojos' (Adware base) (escala de 14 a 32)
    if (activeRedAdwareCount >= this.getMaxActiveRedAdware(elapsedTime)) {
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
    // Escalado progresivo en mid-to-late game: incremento de vida, velocidad y daño
    const progressiveHpMult = Math.min(
      4.2,
      Math.min(2.8, hpMultiplier) * (1 + timeMinutes * 0.08)
    );
    adware.maxHp = Math.round(25 * progressiveHpMult);
    adware.hp = adware.maxHp;

    const speedBonus = Math.min(55, timeMinutes * 5.0);
    adware.speed = Math.round(115 + speedBonus);

    const dmgMultiplier = this.getGlobalDamageMultiplier(elapsedTime);
    adware.damage = Math.round(adware.damage * dmgMultiplier);

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
    const timeMinutes = elapsedTime / 60;
    const count = Math.min(10, 4 + Math.floor(Math.random() * 3) + Math.floor(timeMinutes * 0.55));
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
