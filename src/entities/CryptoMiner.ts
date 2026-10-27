import { Adware } from './Adware';
import { Player } from './Player';

export class CryptoMiner extends Adware {
  public escapeTimer: number = 11.0;
  public escaped: boolean = false;
  private wobbleTimer: number = 0;
  private wanderAngle: number = (Math.random() - 0.5) * 0.8;

  constructor(x: number, y: number, hpMultiplier: number = 1) {
    super(
      x,
      y,
      26,
      195,
      '#fbbf24',
      Math.round(90 * Math.min(2.5, hpMultiplier)),
      0,
      65
    );
    this.malwareType = 'CRYPTO_MINER';
    this.knockbackResistance = 0.4;
  }

  public override update(dt: number, player: Player): void {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }

    this.wobbleTimer += dt * 7;
    this.escapeTimer -= dt;
    if (this.escapeTimer <= 0) {
      this.escaped = true;
      this.active = false;
      return;
    }

    // Huye constantemente en dirección opuesta al jugador
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const fleeAngle = Math.atan2(dy, dx) + Math.sin(this.wobbleTimer) * 0.35 + this.wanderAngle;

    this.x += Math.cos(fleeAngle) * this.speed * dt;
    this.y += Math.sin(fleeAngle) * this.speed * dt;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const margin = 44;

    if (this.x < margin) {
      this.x = margin;
      this.wanderAngle = 0.9;
    } else if (this.x > w - margin) {
      this.x = w - margin;
      this.wanderAngle = -0.9;
    }

    if (this.y < margin + 30) {
      this.y = margin + 30;
      this.wanderAngle = -0.9;
    } else if (this.y > h - margin) {
      this.y = h - margin;
      this.wanderAngle = 0.9;
    }
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    const half = this.size / 2;

    ctx.translate(this.x, this.y);

    ctx.fillStyle = isFlashing ? '#ffffff' : '#f59e0b';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = isFlashing ? 22 : 16;

    // Rombo / Cristal Dorado del Minero de Criptos
    ctx.beginPath();
    ctx.moveTo(0, -half - 4);
    ctx.lineTo(half + 4, 0);
    ctx.lineTo(0, half + 4);
    ctx.lineTo(-half - 4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₿', 0, 1);

    // Indicador de tiempo antes de que escape
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText(`MINER [${this.escapeTimer.toFixed(1)}s]`, 0, -half - 12);

    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(-18, half + 8, 36, 4);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-18, half + 8, 36 * hpRatio, 4);

    ctx.restore();
  }
}
