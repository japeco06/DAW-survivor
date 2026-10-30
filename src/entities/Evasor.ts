import { Adware } from './Adware';
import { Player } from './Player';

interface GhostAfterimage {
  x: number;
  y: number;
  alpha: number;
}

/**
 * Enemigo Especial: 'Evasor' (Ghost Script).
 * - No aparece durante los primeros 60 segundos de la partida (máx. 3 en pantalla).
 * - Comportamiento normal: persigue al jugador.
 * - Mecánica de Esquiva: cuando un proyectil entra en su radio de proximidad, hace un dash lateral instantáneo.
 * - Cooldown de Esquiva: 4 segundos (completamente vulnerable durante esa ventana).
 */
export class Evasor extends Adware {
  public dodgeCooldown: number = 0;
  public readonly proximityRadius: number = 105;
  private dashTimer: number = 0;
  private dashVx: number = 0;
  private dashVy: number = 0;
  private afterimages: GhostAfterimage[] = [];

  constructor(x: number, y: number, hpMultiplier: number = 1) {
    super(
      x,
      y,
      22,
      138,
      '#22d3ee',
      Math.round(38 * hpMultiplier),
      14,
      36
    );
    this.malwareType = 'EVASOR';
  }

  public tryDodgeIncomingProjectiles(
    projectiles: { x: number; y: number; vx: number; vy: number }[],
    canvasWidth: number,
    canvasHeight: number
  ): boolean {
    if (!this.active || this.dodgeCooldown > 0) {
      return false;
    }

    for (const proj of projectiles) {
      const dx = this.x - proj.x;
      const dy = this.y - proj.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= this.proximityRadius) {
        const pLen = Math.hypot(proj.vx, proj.vy) || 1;
        const pDirX = proj.vx / pLen;
        const pDirY = proj.vy / pLen;

        // Dos vectores perpendiculares (izquierda / derecha respecto a la trayectoria del proyectil)
        const perp1X = -pDirY;
        const perp1Y = pDirX;
        const perp2X = pDirY;
        const perp2Y = -pDirX;

        // Elegir el lado perpendicular que aleje más al Evasor de la línea del proyectil
        const dot1 = dx * perp1X + dy * perp1Y;
        let sideX = dot1 >= 0 ? perp1X : perp2X;
        let sideY = dot1 >= 0 ? perp1Y : perp2Y;

        // Evitar salirse de los bordes de la pantalla al esquivar
        const margin = 36;
        const testX = this.x + sideX * 72;
        const testY = this.y + sideY * 72;
        if (
          testX < margin ||
          testX > canvasWidth - margin ||
          testY < margin ||
          testY > canvasHeight - margin
        ) {
          sideX = -sideX;
          sideY = -sideY;
        }

        // Guardar estelas fantasma (afterimages)
        this.afterimages = [
          { x: this.x, y: this.y, alpha: 0.75 },
          { x: this.x + sideX * 26, y: this.y + sideY * 26, alpha: 0.55 },
          { x: this.x + sideX * 50, y: this.y + sideY * 50, alpha: 0.35 },
        ];

        // Desplazamiento lateral instantáneo + impulso corto
        this.x = Math.max(margin, Math.min(canvasWidth - margin, this.x + sideX * 68));
        this.y = Math.max(margin, Math.min(canvasHeight - margin, this.y + sideY * 68));
        this.dashVx = sideX * 420;
        this.dashVy = sideY * 420;
        this.dashTimer = 0.12;
        this.dodgeCooldown = 4.0;
        return true;
      }
    }

    return false;
  }

  public override update(dt: number, player: Player): void {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }
    if (this.dodgeCooldown > 0) {
      this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    }

    for (const img of this.afterimages) {
      img.alpha -= dt * 2.4;
    }
    this.afterimages = this.afterimages.filter((img) => img.alpha > 0);

    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      this.x += this.dashVx * dt;
      this.y += this.dashVy * dt;
      return;
    }

    super.update(dt, player);
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Dibujar estelas fantasma del dash lateral
    for (const img of this.afterimages) {
      ctx.fillStyle = `rgba(34, 211, 238, ${img.alpha * 0.55})`;
      ctx.strokeStyle = `rgba(255, 255, 255, ${img.alpha * 0.7})`;
      ctx.lineWidth = 1;
      ctx.fillRect(img.x - this.size / 2, img.y - this.size / 2, this.size, this.size);
      ctx.strokeRect(img.x - this.size / 2, img.y - this.size / 2, this.size, this.size);
    }

    const canDodge = this.dodgeCooldown <= 0;

    // Anillo sensor de proximidad cuando la esquiva está lista
    if (canDodge) {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.proximityRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const isFlashing = this.hitFlashTimer > 0;
    const bodyColor = isFlashing ? '#ffffff' : canDodge ? '#22d3ee' : '#64748b';

    ctx.fillStyle = bodyColor;
    ctx.shadowColor = canDodge ? '#00f0ff' : '#475569';
    ctx.shadowBlur = isFlashing ? 18 : canDodge ? 14 : 6;

    const half = this.size / 2;
    ctx.fillRect(this.x - half, this.y - half, this.size, this.size);

    ctx.strokeStyle = canDodge ? '#e0f2fe' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - half, this.y - half, this.size, this.size);

    // Núcleo interior de Ghost Script
    ctx.fillStyle = '#083344';
    ctx.fillRect(this.x - half * 0.45, this.y - half * 0.45, this.size * 0.45, this.size * 0.45);

    ctx.restore();
  }
}
