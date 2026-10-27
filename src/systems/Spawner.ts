import { Adware } from '../entities/Adware';
import { Trojan } from '../entities/Trojan';
import { TrojanShooter } from '../entities/TrojanShooter';
import { Worm } from '../entities/Worm';
import { ArmoredWorm } from '../entities/ArmoredWorm';
import { RansomwareBoss } from '../entities/RansomwareBoss';

export class Spawner {
  private timer: number = 0;
  private spawnMargin: number = 50;
  private readonly bossSpawnInterval: number = 22;
  private nextBossTime: number = 22;
  private bossCount: number = 0;

  public currentThreatLevel: number = 1;
  public activeBossAlertTimer: number = 0;
  public lastBossSpawnedName: string = '';

  public syncAfterMegaBoss(elapsedTime: number): void {
    this.timer = 0;
    this.nextBossTime = elapsedTime + this.bossSpawnInterval;
  }

  public getGlobalHpMultiplier(elapsedTime: number, playerLevel: number): number {
    const timeScaling = 1 + elapsedTime * 0.022 + Math.pow(elapsedTime / 60, 1.3) * 0.32;
    const levelScaling = 1 + Math.max(0, playerLevel - 1) * 0.14;
    return Number((timeScaling * levelScaling).toFixed(2));
  }

  public update(
    dt: number,
    elapsedTime: number,
    playerLevel: number,
    enemies: Adware[],
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (this.activeBossAlertTimer > 0) {
      this.activeBossAlertTimer = Math.max(0, this.activeBossAlertTimer - dt);
    }

    this.currentThreatLevel = 1 + Math.floor(elapsedTime / 20);
    const hpMultiplier = this.getGlobalHpMultiplier(elapsedTime, playerLevel);
    const currentSpawnInterval = Math.max(0.18, 0.85 * Math.pow(0.9, elapsedTime / 12));

    this.timer += dt;
    while (this.timer >= currentSpawnInterval) {
      this.timer -= currentSpawnInterval;
      enemies.push(
        this.spawnScaledMalware(elapsedTime, hpMultiplier, canvasWidth, canvasHeight)
      );
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
    width: number,
    height: number
  ): Adware {
    const pos = this.getRandomOutsidePosition(width, height);
    const roll = Math.random();

    // Baja frecuencia de aparición para los 2 nuevos enemigos especiales
    if (elapsedTime >= 18 && roll < 0.07) {
      return new ArmoredWorm(pos.x, pos.y, hpMultiplier);
    }

    if (elapsedTime >= 14 && roll >= 0.07 && roll < 0.15) {
      return new TrojanShooter(pos.x, pos.y, hpMultiplier);
    }

    if (elapsedTime >= 30 && roll >= 0.15 && roll < 0.34) {
      return new Worm(pos.x, pos.y, hpMultiplier, false);
    }

    const trojanChance = elapsedTime >= 12 ? Math.min(0.4, 0.18 + elapsedTime * 0.003) : 0;
    if (roll < 0.34 + trojanChance) {
      return new Trojan(pos.x, pos.y, hpMultiplier);
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
