import { Entity } from './Entity';
import { Player } from './Player';

/**
 * Fragmento de Código (Drop de Experiencia - Fase 3).
 * Aparece cuando un Malware es purgado. Tiene atracción magnética cuando el Agente Antivirus
 * se acerca dentro de su radio de recolección (pickupRadius).
 */
export class CodeFragment extends Entity {
  public xpValue: number;
  private pulseTimer: number = Math.random() * Math.PI * 2;
  private magnetized: boolean = false;

  constructor(x: number, y: number, xpValue: number = 20) {
    super(x, y, 10, 420, '#00f0ff');
    this.xpValue = xpValue;
  }

  public update(dt: number, player: Player): void {
    this.pulseTimer += dt * 6;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Si entra dentro del radio magnético del jugador, se engancha y vuela hacia él
    if (dist <= player.pickupRadius || this.magnetized) {
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
    const r = (this.size * 0.65) * scale;

    ctx.translate(this.x, this.y);
    ctx.shadowBlur = 0;

    // Cristal de datos hexagonal facetado
    ctx.fillStyle = '#00ffcc';
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.15);
    ctx.lineTo(r * 0.72, -r * 0.35);
    ctx.lineTo(r * 0.72, r * 0.35);
    ctx.lineTo(0, r * 1.15);
    ctx.lineTo(-r * 0.72, r * 0.35);
    ctx.lineTo(-r * 0.72, -r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Faceta de luz superior + núcleo blanco
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.0);
    ctx.lineTo(r * 0.52, -r * 0.25);
    ctx.lineTo(0, 0);
    ctx.lineTo(-r * 0.52, -r * 0.25);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
