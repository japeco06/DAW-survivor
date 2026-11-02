import { Entity } from './Entity';
import { Player } from './Player';

export type PowerUpType = 'NUKE' | 'FREEZE' | 'FRENZY';

export class PowerUpItem extends Entity {
  public type: PowerUpType;
  private pulseTimer: number = Math.random() * Math.PI * 2;
  private magnetized: boolean = false;

  constructor(x: number, y: number, type: PowerUpType) {
    const color =
      type === 'NUKE' ? '#ff1e42' : type === 'FREEZE' ? '#38bdf8' : '#f97316';
    super(x, y, 20, 430, color);
    this.type = type;
  }

  public update(dt: number, player: Player): void {
    this.pulseTimer += dt * 6;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

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
    const scale = 1 + Math.sin(this.pulseTimer) * 0.16;
    const half = (this.size * scale) / 2;

    ctx.translate(this.x, this.y);

    if (this.type === 'NUKE') {
      // Bomba Lógica (Logic Bomb): Rombo rojo carmesí brillante con núcleo dorado
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ff1e42';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 18;
      ctx.fillRect(-half, -half, half * 2, half * 2);

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'FREEZE') {
      // Congelación del Sistema (System Freeze): Diamante de cristal de hielo cian/blanco
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 18;
      ctx.fillRect(-half, -half, half * 2, half * 2);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-half * 0.5, -half * 0.5, half, half);
    } else {
      // Overclock Térmico (Thermal Overclock / Frenzy): Icono de núcleo de plasma naranja con destello ámbar
      ctx.fillStyle = '#f97316';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, half, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
