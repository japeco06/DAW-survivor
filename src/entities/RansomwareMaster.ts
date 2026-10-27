import { BaseBoss, SweepingLaser } from './BaseBoss';
import { Player } from './Player';
import { EncryptedBlock } from './EncryptedBlock';

/**
 * Mega-Jefe Original 1/4: Ransomware Master (v0.4.2).
 * En cada oleada de láseres elige aleatoriamente lanzar una ráfaga de láseres
 * estrictamente paralelos (todos horizontales o todos verticales, nunca mezclados),
 * manteniendo 1.0s de telegrafiado, 75px/s de velocidad y pasillos seguros de 250px.
 */
export class RansomwareMaster extends BaseBoss {
  public bossTitle = 'RANSOMWARE MASTER // KERNEL OVERLORD';
  public specialAttackName = 'BARRIDO PARALELO';

  constructor(canvasWidth: number) {
    super(canvasWidth, 96, '#ff0044');
  }

  public override triggerUniqueSpecialAttack(
    player: Player,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    // Limpiar cualquier láser residual para garantizar que nunca se crucen dos direcciones
    this.lasers = [];

    const sweepSpeed = 75;
    const corridorGap = 250;
    const activeTime = 2.2;
    const isVerticalWave = Math.random() < 0.5;

    if (isVerticalWave) {
      // Ráfaga de 3 láseres verticales estrictamente paralelos separados por pasillos de 250px
      const dir = player.x < canvasWidth / 2 ? 1 : -1;
      const center = Math.max(280, Math.min(canvasWidth - 280, player.x));

      this.lasers.push(
        new SweepingLaser(center - corridorGap, 0, center - corridorGap, canvasHeight, sweepSpeed * dir, 0, activeTime),
        new SweepingLaser(center, 0, center, canvasHeight, sweepSpeed * dir, 0, activeTime),
        new SweepingLaser(center + corridorGap, 0, center + corridorGap, canvasHeight, sweepSpeed * dir, 0, activeTime)
      );
    } else {
      // Ráfaga de 3 láseres horizontales estrictamente paralelos separados por pasillos de 250px
      const dir = player.y < canvasHeight / 2 + 60 ? 1 : -1;
      const center = Math.max(320, Math.min(canvasHeight - 240, player.y));

      this.lasers.push(
        new SweepingLaser(0, center - corridorGap, canvasWidth, center - corridorGap, 0, sweepSpeed * dir, activeTime),
        new SweepingLaser(0, center, canvasWidth, center, 0, sweepSpeed * dir, activeTime),
        new SweepingLaser(0, center + corridorGap, canvasWidth, center + corridorGap, 0, sweepSpeed * dir, activeTime)
      );
    }
  }

  protected override updateUniqueMechanics(
    _dt: number,
    _player: Player,
    _blocks: EncryptedBlock[]
  ): boolean {
    return false;
  }

  protected override drawUniqueVisuals(): void {}

  protected override clearUniqueHazards(): void {}

  protected override drawBossCharacter(ctx: CanvasRenderingContext2D, isFlashing: boolean): void {
    const half = this.size / 2;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.animTimer * 2.2);
    ctx.strokeStyle = isFlashing ? '#00ffcc' : '#ff0055';
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 10]);
    ctx.strokeRect(-half - 14, -half - 14, this.size + 28, this.size + 28);
    ctx.restore();

    ctx.fillStyle = isFlashing ? '#ffffff' : '#990022';
    ctx.strokeStyle = isFlashing ? '#00ffcc' : '#ff0055';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = isFlashing ? 35 : 24;
    ctx.fillRect(this.x - half, this.y - half, this.size, this.size);
    ctx.strokeRect(this.x - half, this.y - half, this.size, this.size);

    if (!isFlashing) {
      ctx.fillStyle = '#1a0008';
      ctx.fillRect(this.x - half + 14, this.y - half + 14, this.size - 28, this.size - 28);

      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 17 + Math.sin(this.animTimer * 5) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
