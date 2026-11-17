import { Entity } from './Entity';

/**
 * Paquete de datos ofensivo disparado automáticamente por el Agente Antivirus.
 * Se desplaza en línea recta hacia el objetivo calculado y se destruye al impactar o expirar.
 */
export class Projectile extends Entity {
  public vx: number;
  public vy: number;
  public damage: number;
  public pierceLeft: number;
  public isEvolved: boolean;
  private hitIds: Set<object> = new Set();
  private lifeTime: number = 2.2; // Segundos máximos de vida útil

  constructor(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number = 540,
    damage: number = 25,
    pierceCount: number = 0,
    isEvolved: boolean = false
  ) {
    super(x, y, isEvolved ? 11 : 8, speed, isEvolved ? '#fde047' : '#00f0ff');
    this.vx = dirX * speed;
    this.vy = dirY * speed;
    this.damage = damage;
    this.pierceLeft = pierceCount;
    this.isEvolved = isEvolved;
  }

  public hasHit(enemy: object): boolean {
    return this.hitIds.has(enemy);
  }

  public markHit(enemy: object): void {
    this.hitIds.add(enemy);
    if (this.pierceLeft > 0) {
      this.pierceLeft--;
    } else {
      this.active = false;
    }
  }

  public update(
    dt: number,
    canvasWidth: number,
    canvasHeight: number,
    viewOriginX: number = 0,
    viewOriginY: number = 0
  ): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifeTime -= dt;

    // Desactivar si expira su tiempo o sale ampliamente del área visible
    const margin = 80;
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

  public override draw(ctx: CanvasRenderingContext2D): void {
    const angle = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    if (this.isEvolved) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size * 1.35, this.size * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Estela de energía cian afilada (o dorada si está evolucionado)
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.size * 1.15, 0);
    ctx.lineTo(-this.size * 0.55, -this.size * 0.42);
    ctx.lineTo(-this.size * 1.35, 0);
    ctx.lineTo(-this.size * 0.55, this.size * 0.42);
    ctx.closePath();
    ctx.fill();

    // Núcleo de plasma blanco incandescente
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(this.size * 0.85, 0);
    ctx.lineTo(-this.size * 0.35, -this.size * 0.2);
    ctx.lineTo(-this.size * 0.65, 0);
    ctx.lineTo(-this.size * 0.35, this.size * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
