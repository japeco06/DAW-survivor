import { Entity } from './Entity';
import { Adware } from './Adware';

/**
 * Proyectil de la nueva arma 'Ping Tracker' (v0.2.0).
 * Proyectil azul (#0088ff) que persigue automáticamente al enemigo activo más cercano (Homing).
 */
export class PingProjectile extends Entity {
  public vx: number;
  public vy: number;
  public damage: number;
  private lifeTime: number = 3.2;
  private turnSpeed: number = 7.5; // Capacidad de giro para perseguir objetivos
  private trail: { x: number; y: number }[] = [];

  public isEvolved: boolean;

  constructor(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number = 420,
    damage: number = 22,
    isEvolved: boolean = false
  ) {
    super(x, y, isEvolved ? 12 : 10, speed, isEvolved ? '#60a5fa' : '#0088ff');
    this.vx = dirX * speed;
    this.vy = dirY * speed;
    this.damage = damage;
    this.isEvolved = isEvolved;
    if (isEvolved) {
      this.turnSpeed = 10.5;
    }
  }

  public update(
    dt: number,
    enemies: Adware[],
    canvasWidth: number,
    canvasHeight: number,
    viewOriginX: number = 0,
    viewOriginY: number = 0
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

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) {
      this.trail.shift();
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const margin = 120;
    if (
      this.lifeTime <= 0 ||
      this.x < viewOriginX - margin ||
      this.x > viewOriginX + canvasWidth + margin ||
      this.y < viewOriginY - margin ||
      this.y > viewOriginY + canvasHeight + margin
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
    const angle = Math.atan2(this.vy, this.vx);
    const tipX = this.size * (this.isEvolved ? 1.45 : 1.25);
    const tailX = -this.size * (this.isEvolved ? 1.05 : 0.92);
    const notchX = -this.size * 0.45;
    const wingY = this.size * (this.isEvolved ? 0.95 : 0.82);

    ctx.save();

    // Estela aerodinámica curva del misil teledirigido
    if (this.trail.length > 0) {
      ctx.lineCap = 'round';
      for (let i = 0; i < this.trail.length; i++) {
        const p0 = this.trail[i];
        const p1 = i === this.trail.length - 1 ? { x: this.x, y: this.y } : this.trail[i + 1];
        const ratio = (i + 1) / (this.trail.length + 1);
        ctx.strokeStyle = this.isEvolved
          ? `rgba(250, 204, 21, ${0.42 * ratio})`
          : `rgba(56, 189, 248, ${0.38 * ratio})`;
        ctx.lineWidth = this.size * 0.9 * ratio;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    // Aura envolvente del misil seeker
    ctx.fillStyle = this.isEvolved
      ? 'rgba(250, 204, 21, 0.25)'
      : 'rgba(14, 165, 233, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 0, tipX * 1.15, wingY * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Llama de propulsión trasera pulsante
    const flameLen = this.size * (0.85 + Math.sin(performance.now() * 0.04 + this.x) * 0.25);
    ctx.fillStyle = this.isEvolved ? '#fde047' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(notchX, -wingY * 0.34);
    ctx.lineTo(notchX - flameLen, 0);
    ctx.lineTo(notchX, wingY * 0.34);
    ctx.closePath();
    ctx.fill();

    // Alas delta metálicas de misil táctico
    ctx.fillStyle = this.isEvolved ? '#ca8a04' : '#0369a1';
    ctx.strokeStyle = this.isEvolved ? '#fef08a' : '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(tipX, 0);
    ctx.lineTo(tailX, -wingY);
    ctx.lineTo(notchX, 0);
    ctx.lineTo(tailX, wingY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ojiva central blindada y núcleo de radar
    ctx.fillStyle = this.isEvolved ? '#fef08a' : '#7dd3fc';
    ctx.beginPath();
    ctx.moveTo(tipX * 0.86, 0);
    ctx.lineTo(-this.size * 0.15, -wingY * 0.42);
    ctx.lineTo(-this.size * 0.38, 0);
    ctx.lineTo(-this.size * 0.15, wingY * 0.42);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(tipX * 0.32, 0, this.size * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
