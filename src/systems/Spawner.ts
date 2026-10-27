import { Adware } from '../entities/Adware';
import { Trojan } from '../entities/Trojan';
import { Worm } from '../entities/Worm';
import { RansomwareBoss } from '../entities/RansomwareBoss';

export class Spawner {
  private timer: number = 0;
  private spawnMargin: number = 50;
  private nextBossTime: number = 45;
  private bossCount: number = 0;

  public currentThreatLevel: number = 1;
  public activeBossAlertTimer: number = 0;
  public lastBossSpawnedName: string = '';

  /**
   * Reprograma limpiamente el temporizador de jefes normales tras finalizar un evento de Mega-Jefe,
   * garantizando un ciclo infinito (5 jefes normales -> 1 Mega-Jefe -> 5 jefes normales...).
   */
  public syncAfterMegaBoss(elapsedTime: number): void {
    this.timer = 0;
    this.nextBossTime = elapsedTime + 45;
  }

  public update(
    dt: number,
    elapsedTime: number,
    enemies: Adware[],
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (this.activeBossAlertTimer > 0) {
      this.activeBossAlertTimer = Math.max(0, this.activeBossAlertTimer - dt);
    }

    this.currentThreatLevel = 1 + Math.floor(elapsedTime / 20);
    const hpMultiplier = 1 + elapsedTime * 0.018;
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
      this.nextBossTime = elapsedTime + 45;
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

    if (elapsedTime >= 30 && roll < 0.22) {
      return new Worm(pos.x, pos.y, hpMultiplier, false);
    }

    const trojanChance = elapsedTime >= 12 ? Math.min(0.45, 0.2 + elapsedTime * 0.003) : 0;
    if (roll < trojanChance + (elapsedTime >= 30 ? 0.22 : 0)) {
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
