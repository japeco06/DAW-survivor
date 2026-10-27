import { Entity } from './Entity';
import { Adware } from './Adware';

/**
 * Proyectil de la nueva arma 'Ping Tracker' (v0.2.0).
 * Proyectil azul (#0088ff) que persigue automáticamente al enemigo activo más cercano (Homing).
 */
export class PingProjectile extends Entity {
  private vx: number;
  private vy: number;
  public damage: number;
  private lifeTime: number = 3.2;
  private turnSpeed: number = 7.5; // Capacidad de giro para perseguir objetivos

  constructor(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number = 420,
    damage: number = 22
  ) {
    super(x, y, 10, speed, '#0088ff');
    this.vx = dirX * speed;
    this.vy = dirY * speed;
    this.damage = damage;
  }

  public update(
    dt: number,
    enemies: Adware[],
    canvasWidth: number,
    canvasHeight: number
  ): void {
    this.lifeTime -= dt;

    // Buscar el enemigo activo más cercano para ajustar el vector de persecución
    const target = this.findNearestTarget(enemies);
    if (target) {
      const desiredDx = target.x - this.x;
      const desiredDy = target.y - this.y;
      const dist = Math.hypot(desiredDx, desiredDy) || 1;

      const targetVx = (desiredDx / dist) * this.speed;
      const targetVy = (desiredDy / dist) * this.speed;

      // Interpolación suave de dirección hacia el objetivo
      const steerFactor = Math.min(1, this.turnSpeed * dt);
      this.vx += (targetVx - this.vx) * steerFactor;
      this.vy += (targetVy - this.vy) * steerFactor;

      const currentSpeed = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / currentSpeed) * this.speed;
      this.vy = (this.vy / currentSpeed) * this.speed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const margin = 80;
    if (
      this.lifeTime <= 0 ||
      this.x < -margin ||
      this.x > canvasWidth + margin ||
      this.y < -margin ||
      this.y > canvasHeight + margin
    ) {
      this.active = false;
    }
  }

  private findNearestTarget(enemies: Adware[]): Adware | null {
    let nearest: Adware | null = null;
    let minDist = Infinity;

    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (d < minDist) {
        minDist = d;
        nearest = enemy;
      }
    }
    return nearest;
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const angle = Math.atan2(this.vy, this.vx);
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    // Estela / pulso azul eléctrico del Ping Tracker
    ctx.fillStyle = '#0088ff';
    ctx.shadowColor = '#0088ff';
    ctx.shadowBlur = 16;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);

    // Núcleo interior azul claro / blanco
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(-this.size / 4, -this.size / 4, this.size / 2, this.size / 2);

    ctx.restore();
  }
}
