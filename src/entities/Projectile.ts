import { Entity } from './Entity';

/**
 * Paquete de datos ofensivo disparado automáticamente por el Agente Antivirus.
 * Se desplaza en línea recta hacia el objetivo calculado y se destruye al impactar o expirar.
 */
export class Projectile extends Entity {
  public vx: number;
  public vy: number;
  public damage: number;
  private lifeTime: number = 2.2; // Segundos máximos de vida útil

  constructor(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number = 540,
    damage: number = 25
  ) {
    super(x, y, 8, speed, '#00f0ff');
    this.vx = dirX * speed;
    this.vy = dirY * speed;
    this.damage = damage;
  }

  public update(dt: number, canvasWidth: number, canvasHeight: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifeTime -= dt;

    // Desactivar si expira su tiempo o sale ampliamente de la pantalla
    const margin = 60;
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

  public override draw(ctx: CanvasRenderingContext2D): void {
    const angle = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    // Estela de energía cian afilada
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
