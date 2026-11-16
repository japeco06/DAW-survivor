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

    const half = this.size / 2;

    // Sombra de contacto
    ctx.fillStyle = 'rgba(2, 6, 14, 0.38)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + half * 0.6, half * 0.72, half * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.fillStyle = drawColor;
    ctx.shadowColor = drawColor;
    ctx.shadowBlur = isFlashing ? 14 : 6;

    // Estela de propulsión de paquete veloz
    if (!isFlashing) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.4)';
      ctx.beginPath();
      ctx.moveTo(-half * 0.4, -3);
      ctx.lineTo(-half - 7, 0);
      ctx.lineTo(-half * 0.4, 3);
      ctx.closePath();
      ctx.fill();
    }

    // Dardo interceptor cibernético con aletas tácticas
    ctx.fillStyle = drawColor;
    ctx.strokeStyle = isFlashing ? '#ffffff' : '#1e1b08';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(half + 6, 0);
    ctx.lineTo(-half * 0.15, -half);
    ctx.lineTo(-half, -half * 0.85);
    ctx.lineTo(-half * 0.42, 0);
    ctx.lineTo(-half, half * 0.85);
    ctx.lineTo(-half * 0.15, half);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isFlashing) {
      // Núcleo oscuro de ejecución + óptica frontal
      ctx.fillStyle = '#1f1600';
      ctx.beginPath();
      ctx.moveTo(half * 0.65, 0);
      ctx.lineTo(-half * 0.3, -half * 0.42);
      ctx.lineTo(-half * 0.15, 0);
      ctx.lineTo(-half * 0.3, half * 0.42);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.fillRect(half * 0.08, -1.6, 4, 3.2);
    }

    ctx.restore();
  }
}
