import { Adware } from './Adware';
import { Player } from './Player';

/**
 * Enemigo Avanzado: Troyano (Trojan.exe).
 * Unidad de infiltración rápida (amarillo/ámbar neón) con forma triangular agresiva
 * que apunta directamente hacia el Agente Antivirus y se desplaza a gran velocidad.
 */
export class Trojan extends Adware {
  private angle: number = 0;

  constructor(x: number, y: number, hpMultiplier: number = 1) {
    super(
      x,
      y,
      18,
      205, // Mucho más rápido que el Adware estándar
      '#facc15',
      Math.round(18 * hpMultiplier),
      15,
      30
    );
    this.malwareType = 'TROJAN';
  }

  public override update(dt: number, player: Player): void {
    this.angle = Math.atan2(player.y - this.y, player.x - this.x);
    super.update(dt, player);
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
    ctx.moveTo(half + 4, 0);          // Punta delantera
    ctx.lineTo(-half, -half);         // Ala superior
    ctx.lineTo(-half * 0.4, 0);       // Muesca trasera
    ctx.lineTo(-half, half);          // Ala inferior
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
