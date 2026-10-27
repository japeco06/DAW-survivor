import { Entity } from './Entity';
import { Player } from './Player';

/**
 * Criptomoneda (Drop de Metaprogresión - v0.2.0).
 * Cuadrado dorado brillante (#fbbf24) que los enemigos tienen probabilidad de soltar al morir.
 * Funciona como moneda global para desbloquear personajes en el Menú Principal.
 */
export class CryptoCoin extends Entity {
  public value: number;
  private pulseTimer: number = Math.random() * Math.PI * 2;
  private magnetized: boolean = false;

  constructor(x: number, y: number, value: number = 1) {
    super(x, y, 13, 440, '#fbbf24');
    this.value = value;
  }

  public update(dt: number, player: Player): void {
    this.pulseTimer += dt * 7;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Se magnetiza al entrar en el radio de recolección del jugador
    if (dist <= player.pickupRadius * 1.15 || this.magnetized) {
      this.magnetized = true;
      if (dist > 0) {
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
      }
    }
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const scale = 1 + Math.sin(this.pulseTimer) * 0.14;
    const size = this.size * scale;
    const half = size / 2;

    // Cuadrado dorado con destello ámbar
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 14;
    ctx.fillRect(this.x - half, this.y - half, size, size);

    // Borde interior brillante
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.x - half + 2, this.y - half + 2, size - 4, size - 4);

    ctx.restore();
  }
}
