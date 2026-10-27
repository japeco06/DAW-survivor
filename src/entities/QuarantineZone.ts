import { Entity } from './Entity';
import { Adware } from './Adware';

export interface QuarantineHitInfo {
  enemy: Adware;
  damage: number;
}

/**
 * Entidad de la nueva arma 'Zona de Cuarentena' (v0.2.0).
 * Área estática desplegada en el suelo que inflige daño continuo (DoT) a los enemigos que la pisen.
 */
export class QuarantineZone extends Entity {
  public radius: number;
  public damagePerTick: number;
  public tickInterval: number = 0.32;
  private duration: number;
  private maxDuration: number;
  private pulseTime: number = 0;
  private enemyTickTimers: WeakMap<Adware, number> = new WeakMap();

  constructor(
    x: number,
    y: number,
    radius: number = 85,
    damagePerTick: number = 14,
    duration: number = 4.5
  ) {
    super(x, y, radius * 2, 0, '#10b981');
    this.radius = radius;
    this.damagePerTick = damagePerTick;
    this.duration = duration;
    this.maxDuration = duration;
  }

  public update(dt: number, enemies: Adware[]): QuarantineHitInfo[] {
    this.pulseTime += dt * 4;
    this.duration -= dt;

    if (this.duration <= 0) {
      this.active = false;
      return [];
    }

    const hits: QuarantineHitInfo[] = [];

    for (const enemy of enemies) {
      if (!enemy.active) continue;

      const currentTimer = (this.enemyTickTimers.get(enemy) ?? 0) - dt;
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);

      // Comprobar si el enemigo está pisando el área de cuarentena
      if (dist <= this.radius + enemy.size * 0.45) {
        if (currentTimer <= 0) {
          this.enemyTickTimers.set(enemy, this.tickInterval);
          hits.push({ enemy, damage: this.damagePerTick });
        } else {
          this.enemyTickTimers.set(enemy, currentTimer);
        }
      } else if (currentTimer > 0) {
        this.enemyTickTimers.set(enemy, currentTimer);
      }
    }

    return hits;
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const fadeAlpha = Math.min(1, this.duration / 0.8);
    const pulse = 0.85 + Math.sin(this.pulseTime) * 0.15;

    // 1. Superficie translúcida en el suelo
    ctx.fillStyle = `rgba(16, 185, 129, ${0.14 * fadeAlpha * pulse})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Anillo perimetral de contención biológica/digital
    ctx.strokeStyle = `rgba(52, 211, 153, ${0.75 * fadeAlpha})`;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, this.pulseTime * 0.25, Math.PI * 2 + this.pulseTime * 0.25);
    ctx.stroke();

    // 3. Cuadrícula interna de cuarentena
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(16, 185, 129, ${0.3 * fadeAlpha})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      this.x - this.radius * 0.5,
      this.y - this.radius * 0.5,
      this.radius,
      this.radius
    );

    ctx.restore();
  }
}
