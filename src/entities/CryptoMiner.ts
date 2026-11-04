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

    // Huye constantemente en dirección opuesta al jugador con desvío y ondulación
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const fleeAngle = Math.atan2(dy, dx) + Math.sin(this.wobbleTimer) * 0.35 + this.wanderAngle;

    let vx = Math.cos(fleeAngle) * this.speed;
    let vy = Math.sin(fleeAngle) * this.speed;

    const minX = 44;
    const maxX = 1920 - 44;
    const minY = 64;
    const maxY = 1080 - 44;

    const atLeft = this.x <= minX;
    const atRight = this.x >= maxX;
    const atTop = this.y <= minY;
    const atBottom = this.y >= maxY;

    // Deslizamiento por bordes y deflexión angular en esquinas para no quedarse atascado
    if (atLeft && vx < 0) {
      vx = 0;
      if (Math.abs(vy) < 25 || (atTop && vy < 0) || (atBottom && vy > 0)) {
        vy = (player.y < (minY + maxY) / 2 ? 1 : -1) * this.speed;
      }
      this.wanderAngle = player.y > this.y ? -0.85 : 0.85;
    } else if (atRight && vx > 0) {
      vx = 0;
      if (Math.abs(vy) < 25 || (atTop && vy < 0) || (atBottom && vy > 0)) {
        vy = (player.y < (minY + maxY) / 2 ? 1 : -1) * this.speed;
      }
      this.wanderAngle = player.y > this.y ? 0.85 : -0.85;
    }

    if (atTop && vy < 0) {
      vy = 0;
      if (Math.abs(vx) < 25 || (atLeft && vx < 0) || (atRight && vx > 0)) {
        vx = (player.x < (minX + maxX) / 2 ? 1 : -1) * this.speed;
      }
      this.wanderAngle = player.x > this.x ? 0.85 : -0.85;
    } else if (atBottom && vy > 0) {
      vy = 0;
      if (Math.abs(vx) < 25 || (atLeft && vx < 0) || (atRight && vx > 0)) {
        vx = (player.x < (minX + maxX) / 2 ? 1 : -1) * this.speed;
      }
      this.wanderAngle = player.x > this.x ? -0.85 : 0.85;
    }

    const currentSpd = Math.hypot(vx, vy);
    if (currentSpd > 0) {
      vx = (vx / currentSpd) * this.speed;
      vy = (vy / currentSpd) * this.speed;
    }

    this.x += vx * dt;
    this.y += vy * dt;

    this.x = Math.max(minX, Math.min(maxX, this.x));
    this.y = Math.max(minY, Math.min(maxY, this.y));
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
