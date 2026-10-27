import { Adware } from './Adware';
import { Entity } from './Entity';
import { Player } from './Player';

export class EnemyProjectile extends Entity {
  private vx: number;
  private vy: number;
  public damage: number;
  private lifeTime: number = 4.2;

  constructor(
    x: number,
    y: number,
    angle: number,
    speed: number = 285,
    damage: number = 14
  ) {
    super(x, y, 10, speed, '#fb923c');
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
  }

  public update(dt: number, canvasWidth: number, canvasHeight: number): void {
    this.lifeTime -= dt;
    if (this.lifeTime <= 0) {
      this.active = false;
      return;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (
      this.x < -30 ||
      this.x > canvasWidth + 30 ||
      this.y < -30 ||
      this.y > canvasHeight + 30
    ) {
      this.active = false;
    }
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    const angle = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    ctx.fillStyle = '#f97316';
    ctx.shadowColor = '#fb923c';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff7ed';
    ctx.fillRect(-2, -1.5, 5, 3);
    ctx.restore();
  }
}

export class TrojanShooter extends Adware {
  private angle: number = 0;
  private shootTimer: number = 0.8;
  private readonly shootCooldown: number = 2.1;
  private readonly preferredMinRange: number = 230;
  private readonly preferredMaxRange: number = 330;
  private readonly maxFireRange: number = 470;
  public pendingProjectiles: EnemyProjectile[] = [];

  constructor(x: number, y: number, hpMultiplier: number = 1) {
    super(
      x,
      y,
      24,
      105,
      '#f97316',
      Math.round(36 * hpMultiplier),
      14,
      42
    );
    this.malwareType = 'TROJAN_SHOOTER';
  }

  public override update(dt: number, player: Player): void {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy) || 1;
    this.angle = Math.atan2(dy, dx);

    if (distance > this.preferredMaxRange) {
      this.x += (dx / distance) * this.speed * dt;
      this.y += (dy / distance) * this.speed * dt;
    } else if (distance < this.preferredMinRange) {
      this.x -= (dx / distance) * (this.speed * 0.5) * dt;
      this.y -= (dy / distance) * (this.speed * 0.5) * dt;
    }

    if (distance <= this.maxFireRange) {
      this.shootTimer += dt;
      if (this.shootTimer >= this.shootCooldown) {
        this.shootTimer = 0;
        const muzzleX = this.x + Math.cos(this.angle) * (this.size * 0.65);
        const muzzleY = this.y + Math.sin(this.angle) * (this.size * 0.65);
        this.pendingProjectiles.push(
          new EnemyProjectile(muzzleX, muzzleY, this.angle, 290, this.damage)
        );
      }
    }
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    const drawColor = isFlashing ? '#ffffff' : this.color;

    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.fillStyle = drawColor;
    ctx.shadowColor = drawColor;
    ctx.shadowBlur = isFlashing ? 18 : 14;

    const half = this.size / 2;
    ctx.beginPath();
    ctx.moveTo(half + 6, 0);
    ctx.lineTo(-half, -half);
    ctx.lineTo(-half * 0.35, 0);
    ctx.lineTo(-half, half);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isFlashing ? '#ffffff' : '#fed7aa';
    ctx.fillRect(2, -3, half + 4, 6);

    ctx.strokeStyle = '#ffedd5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-half * 0.5, -half * 0.45, half * 0.8, half * 0.9);

    ctx.restore();
  }
}
