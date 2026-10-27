import { Adware } from './Adware';

/**
 * Enemigo Avanzado: Gusano de Red (Worm.vbs).
 * Unidad pesada y blindada (púrpura neón) con alta integridad y resistencia al retroceso.
 * Al ser destruido en Fase 4, se divide en 2 sub-procesos rápidos si no es ya una réplica.
 */
export class Worm extends Adware {
  public isSplitChild: boolean;

  constructor(x: number, y: number, hpMultiplier: number = 1, isSplitChild: boolean = false) {
    const size = isSplitChild ? 16 : 30;
    const speed = isSplitChild ? 155 : 82;
    const baseHp = isSplitChild ? 20 : 85;
    const xp = isSplitChild ? 15 : 45;

    super(
      x,
      y,
      size,
      speed,
      '#a855f7',
      Math.round(baseHp * hpMultiplier),
      isSplitChild ? 10 : 18,
      xp
    );
    this.malwareType = 'WORM';
    this.isSplitChild = isSplitChild;
    this.knockbackResistance = isSplitChild ? 0.1 : 0.65;
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    const drawColor = isFlashing ? '#ffffff' : this.color;
    const half = this.size / 2;

    ctx.translate(this.x, this.y);
    ctx.fillStyle = drawColor;
    ctx.shadowColor = drawColor;
    ctx.shadowBlur = isFlashing ? 18 : 14;

    // Dibujar octágono blindado
    const cut = half * 0.42;
    ctx.beginPath();
    ctx.moveTo(-half + cut, -half);
    ctx.lineTo(half - cut, -half);
    ctx.lineTo(half, -half + cut);
    ctx.lineTo(half, half - cut);
    ctx.lineTo(half - cut, half);
    ctx.lineTo(-half + cut, half);
    ctx.lineTo(-half, half - cut);
    ctx.lineTo(-half, -half + cut);
    ctx.closePath();
    ctx.fill();

    if (!isFlashing) {
      ctx.strokeStyle = '#f3e8ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-half * 0.45, -half * 0.45, half * 0.9, half * 0.9);
    }

    ctx.restore();
  }
}
