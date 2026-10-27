import { Adware } from './Adware';
import { Player } from './Player';

export class HardwareBox extends Adware {
  private pulseTimer: number = 0;

  constructor(x: number, y: number, hpMultiplier: number = 1) {
    super(
      x,
      y,
      30,
      0,
      '#38bdf8',
      Math.round(45 * Math.min(2.2, hpMultiplier)),
      0,
      25
    );
    this.malwareType = 'HARDWARE_BOX';
    this.knockbackResistance = 1;
  }

  public override update(dt: number, _player: Player): void {
    this.pulseTimer += dt * 3;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    const half = this.size / 2;

    ctx.translate(this.x, this.y);

    ctx.fillStyle = isFlashing ? '#ffffff' : '#0f172a';
    ctx.strokeStyle = isFlashing ? '#ffffff' : '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#0ea5e9';
    ctx.shadowBlur = isFlashing ? 18 : 10;

    ctx.fillRect(-half, -half, this.size, this.size);
    ctx.strokeRect(-half, -half, this.size, this.size);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-half + 4, -half + 4);
    ctx.lineTo(half - 4, half - 4);
    ctx.moveTo(half - 4, -half + 4);
    ctx.lineTo(-half + 4, half - 4);
    ctx.stroke();

    const coreAlpha = 0.65 + Math.sin(this.pulseTimer) * 0.25;
    ctx.fillStyle = `rgba(250, 204, 21, ${coreAlpha})`;
    ctx.fillRect(-5, -5, 10, 10);

    const hpRatio = Math.max(0, this.hp / this.maxHp);
    if (hpRatio < 1) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(-half, half + 4, this.size, 4);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-half, half + 4, this.size * hpRatio, 4);
    }

    ctx.restore();
  }
}
