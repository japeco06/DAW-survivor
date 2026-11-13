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
    const cut = 6;

    ctx.translate(this.x, this.y);

    // Cápsula de suministro octogonal biselada
    ctx.fillStyle = isFlashing ? '#ffffff' : '#0b1526';
    ctx.strokeStyle = isFlashing ? '#ffffff' : '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#0ea5e9';
    ctx.shadowBlur = isFlashing ? 18 : 10;

    ctx.beginPath();
    ctx.moveTo(-half + cut, -half);
    ctx.lineTo(half - cut, -half);
    ctx.lineTo(half, -half + cut);
    ctx.lineTo(half, half - cut);
    ctx.lineTo(half - cut, half);
    ctx.lineTo(-half + cut, half);
    ctx.lineTo(-half, half - cut);
    ctx.lineTo(-half, -half + cut);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bandas metálicas de refuerzo y pestillos cian
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-half + 3, 0);
    ctx.lineTo(-7, 0);
    ctx.moveTo(7, 0);
    ctx.lineTo(half - 3, 0);
    ctx.moveTo(0, -half + 3);
    ctx.lineTo(0, -7);
    ctx.moveTo(0, 7);
    ctx.lineTo(0, half - 3);
    ctx.stroke();

    // Núcleo holográfico giratorio dorado
    const coreAlpha = 0.72 + Math.sin(this.pulseTimer) * 0.25;
    ctx.save();
    ctx.rotate(this.pulseTimer * 0.45);
    ctx.fillStyle = isFlashing ? '#ffffff' : `rgba(250, 204, 21, ${coreAlpha})`;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const hpRatio = Math.max(0, this.hp / this.maxHp);
    if (hpRatio < 1) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(-half, half + 5, this.size, 4);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-half, half + 5, this.size * hpRatio, 4);
    }

    ctx.restore();
  }
}
