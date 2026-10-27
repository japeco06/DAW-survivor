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
    const scale = 1 + Math.sin(this.pulseTimer) * 0.15;
    const half = (this.size * scale) / 2;

    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4); // Rombo estilo cristal/dato binario

    ctx.fillStyle = '#00ffcc';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.fillRect(-half, -half, half * 2, half * 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-half * 0.4, -half * 0.4, half * 0.8, half * 0.8);

    ctx.restore();
  }
}
