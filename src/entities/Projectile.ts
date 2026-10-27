import { Entity } from './Entity';

/**
 * Paquete de datos ofensivo disparado automáticamente por el Agente Antivirus.
 * Se desplaza en línea recta hacia el objetivo calculado y se destruye al impactar o expirar.
 */
export class Projectile extends Entity {
  private vx: number;
  private vy: number;
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
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;

    // Dibujar pulso energético cian con núcleo blanco
    ctx.fillRect(
      this.x - this.size / 2,
      this.y - this.size / 2,
      this.size,
      this.size
    );

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.x - this.size / 2 - 1,
      this.y - this.size / 2 - 1,
      this.size + 2,
      this.size + 2
    );
    ctx.restore();
  }
}
