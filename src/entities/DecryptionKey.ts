import { Entity } from './Entity';
import { Player } from './Player';

/**
 * Llave de Desencriptación (Fase 3 de v0.3.0 - Evento Ransomware Master).
 * Aparece aleatoriamente por el mapa mientras el Mega-Jefe está activo.
 * Cuando el jugador la toca, cambia a estado 'LAUNCHED' y sale disparada automáticamente
 * hacia el Ransomware Master para infligirle un gran daño de desencriptación.
 */
export class DecryptionKey extends Entity {
  public state: 'IDLE' | 'LAUNCHED' = 'IDLE';
  public damage: number = 250;
  private pulseTimer: number = 0;
  private launchSpeed: number = 920;

  constructor(x: number, y: number, damage: number = 250) {
    super(x, y, 20, 0, '#00ffcc');
    this.damage = damage;
  }

  public update(
    dt: number,
    player: Player,
    bossX: number,
    bossY: number
  ): boolean {
    this.pulseTimer += dt * 7;

    if (this.state === 'IDLE') {
      // Comprobar si el jugador entra en contacto con la llave para recogerla y dispararla
      const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
      if (distToPlayer <= (player.size + this.size) * 0.65) {
        this.state = 'LAUNCHED';
      }
      return false;
    }

    // Estado LAUNCHED: vuela a alta velocidad directamente hacia el núcleo del Mega-Jefe
    const dx = bossX - this.x;
    const dy = bossY - this.y;
    const distToBoss = Math.hypot(dx, dy);

    if (distToBoss <= 36) {
      this.active = false;
      return true; // Impactó en el Mega-Jefe
    }

    this.x += (dx / distToBoss) * this.launchSpeed * dt;
    this.y += (dy / distToBoss) * this.launchSpeed * dt;
    return false;
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const scale = 1 + Math.sin(this.pulseTimer) * 0.18;

    ctx.translate(this.x, this.y);
    if (this.state === 'IDLE') {
      // Anillo guía pulsante para que destaque claramente en la arena
      ctx.strokeStyle = 'rgba(0, 255, 204, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 22 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.rotate(this.pulseTimer * 0.6);

    const drawColor = this.state === 'LAUNCHED' ? '#ffffff' : '#00ffcc';
    ctx.fillStyle = drawColor;
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 18;

    // Forma de llave / cristal hexagonal brillante
    const r = (this.size / 2) * scale;
    ctx.beginPath();
    ctx.moveTo(0, -r - 3);
    ctx.lineTo(r + 3, 0);
    ctx.lineTo(0, r + 3);
    ctx.lineTo(-r - 3, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#042f2e';
    ctx.fillRect(-3, -3, 6, 6);

    if (this.state === 'IDLE') {
      ctx.rotate(-this.pulseTimer * 0.6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[DECRYPT_KEY]', 0, -26);
    }

    ctx.restore();
  }
}
