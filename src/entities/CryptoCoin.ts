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
    const scale = 1 + Math.sin(this.pulseTimer) * 0.1;
    const r = (this.size * 0.56) * scale;
    const spinScaleX = 0.45 + 0.55 * Math.abs(Math.cos(this.pulseTimer * 0.55));

    ctx.translate(this.x, this.y);
    ctx.scale(spinScaleX, 1);

    // Medallón octogonal giratorio dorado
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d97706';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Núcleo dorado brillante
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // Emblema rombo central oscuro + destello superior
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.45);
    ctx.lineTo(r * 0.36, 0);
    ctx.lineTo(0, r * 0.45);
    ctx.lineTo(-r * 0.36, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(-1.5, -r * 0.2, 3, r * 0.4);

    ctx.restore();
  }
}
