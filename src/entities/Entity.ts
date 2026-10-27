export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Clase base para todas las entidades del juego (Jugador, Malware, Proyectiles, Drops).
 * Incluye soporte para Hitboxes AABB (Axis-Aligned Bounding Box) y ciclo de vida.
 */
export abstract class Entity {
  public x: number;
  public y: number;
  public size: number;
  public speed: number;
  public color: string;
  public active: boolean = true;

  constructor(x: number, y: number, size: number, speed: number, color: string) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.speed = speed;
    this.color = color;
  }

  public abstract update(dt: number, ...args: any[]): void;

  /**
   * Devuelve la caja de colisión (Hitbox) centrada en (x, y).
   */
  public getBounds(): Bounds {
    const half = this.size / 2;
    return {
      left: this.x - half,
      right: this.x + half,
      top: this.y - half,
      bottom: this.y + half,
    };
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(
      this.x - this.size / 2,
      this.y - this.size / 2,
      this.size,
      this.size
    );
    ctx.restore();
  }
}
