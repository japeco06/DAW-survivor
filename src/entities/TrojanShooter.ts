import { Adware } from './Adware';
import { Entity } from './Entity';
import { Player } from './Player';

export class EnemyProjectile extends Entity {
  public vx: number;
  public vy: number;
  public damage: number;
  private lifeTime: number = 4.2;

  constructor(
    x: number,
    y: number,
    angle: number,
    speed: number = 285,
    damage: number = 14,
    color: string = '#f97316',
    size: number = 10
  ) {
    super(x, y, size, speed, color);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
  }

  public update(
    dt: number,
    canvasWidth: number,
    canvasHeight: number,
    viewOriginX: number = 0,
    viewOriginY: number = 0
  ): void {
    this.lifeTime -= dt;
    if (this.lifeTime <= 0) {
      this.active = false;
      return;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (
      this.x < viewOriginX - 60 ||
      this.x > viewOriginX + canvasWidth + 60 ||
      this.y < viewOriginY - 60 ||
      this.y > viewOriginY + canvasHeight + 60
    ) {
      this.active = false;
    }
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    const angle = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    ctx.fillStyle = this.color;
    ctx.shadowBlur = 0;
    const half = this.size / 2;
    ctx.beginPath();
    ctx.moveTo(half + 3, 0);
    ctx.lineTo(-half, -half);
    ctx.lineTo(-half, half);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-half * 0.4, -half * 0.3, half * 0.8, half * 0.6);
    ctx.restore();
  }
}

export class TrojanShooter extends Adware {
  private angle: number = 0;
  private shootTimer: number = 0.7;
  private readonly shootCooldown: number = 1.65;
  private readonly preferredMinRange: number = 230;
  private readonly preferredMaxRange: number = 330;
  private readonly maxFireRange: number = 490;
  public pendingProjectiles: EnemyProjectile[] = [];

  constructor(x: number, y: number, hpMultiplier: number = 1) {
    super(
      x,
      y,
      24,
      122,
      '#f97316',
      Math.round(60 * hpMultiplier),
      20,
      30
    );
    this.malwareType = 'TROJAN_SHOOTER';
  }

  public override update(dt: number, player: Player): void {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }

    const speedMult = this.tickSpeedMultiplier(dt);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy) || 1;
    this.angle = Math.atan2(dy, dx);
    this.facingAngle = this.angle;

    if (distance > this.preferredMaxRange) {
      this.x += (dx / distance) * this.speed * speedMult * dt;
      this.y += (dy / distance) * this.speed * speedMult * dt;
    } else if (distance < this.preferredMinRange) {
      this.x -= (dx / distance) * (this.speed * 0.5 * speedMult) * dt;
      this.y -= (dy / distance) * (this.speed * 0.5 * speedMult) * dt;
    }

    if (distance <= this.maxFireRange) {
      this.shootTimer += dt;
      if (this.shootTimer >= this.shootCooldown) {
        this.shootTimer = 0;
        const muzzleX = this.x + Math.cos(this.angle) * (this.size * 0.65);
        const muzzleY = this.y + Math.sin(this.angle) * (this.size * 0.65);
        this.pendingProjectiles.push(
          new EnemyProjectile(muzzleX, muzzleY, this.angle, 340, this.damage)
        );
      }
    }
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    const drawColor = isFlashing ? '#ffffff' : this.color;

    const half = this.size / 2;
    const t = performance.now() * 0.012;

    // Sombra de contacto
    ctx.fillStyle = 'rgba(2, 6, 14, 0.42)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + half * 0.65, half * 0.85, half * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Patas estabilizadoras de artillería (2 pares)
    ctx.strokeStyle = isFlashing ? '#ffffff' : '#ea580c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const s of [-1, 1]) {
      const sway = Math.sin(t + s) * 1.4;
      ctx.moveTo(-half * 0.4, s * half * 0.45);
      ctx.lineTo(-half * 0.75 + sway, s * (half + 4));
      ctx.moveTo(half * 0.2, s * half * 0.5);
      ctx.lineTo(half * 0.1 - sway, s * (half + 4));
    }
    ctx.stroke();

    // Doble cañón railgun frontal
    ctx.fillStyle = isFlashing ? '#ffffff' : '#cbd5e1';
    ctx.fillRect(half * 0.35, -5.5, half * 0.72, 3);
    ctx.fillRect(half * 0.35, 2.5, half * 0.72, 3);

    // Chasis principal biselado naranja-grafito
    ctx.fillStyle = drawColor;
    ctx.strokeStyle = isFlashing ? '#ffffff' : '#271204';
    ctx.lineWidth = 1.6;

    ctx.beginPath();
    ctx.moveTo(half + 2, -half * 0.38);
    ctx.lineTo(half + 2, half * 0.38);
    ctx.lineTo(-half * 0.25, half * 0.88);
    ctx.lineTo(-half * 0.9, half * 0.58);
    ctx.lineTo(-half * 0.9, -half * 0.58);
    ctx.lineTo(-half * 0.25, -half * 0.88);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isFlashing) {
      // Núcleo capacitor dorsal + lente mira
      ctx.fillStyle = '#1f0d02';
      ctx.fillRect(-half * 0.58, -half * 0.42, half * 0.95, half * 0.84);

      ctx.fillStyle = '#fef08a';
      ctx.fillRect(half * 0.1, -2.5, 4.5, 5);
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(-half * 0.4, -2, half * 0.35, 4);
    }

    ctx.restore();
  }
}
