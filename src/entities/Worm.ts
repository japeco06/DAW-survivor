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
    const t = performance.now() * 0.01 + this.animSeed;

    // Sombra de contacto
    ctx.fillStyle = 'rgba(2, 6, 14, 0.45)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + half * 0.7, half * 0.92, half * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(this.x, this.y);
    ctx.rotate(this.facingAngle);

    // Pines DIP de microchip / patas de gusano de red animadas
    ctx.strokeStyle = isFlashing ? '#ffffff' : '#d8b4fe';
    ctx.lineWidth = this.isSplitChild ? 1.5 : 2.1;
    const pinCount = this.isSplitChild ? 2 : 3;
    ctx.beginPath();
    for (let i = 0; i < pinCount; i++) {
      const px = ((i - (pinCount - 1) / 2) / Math.max(1, pinCount - 1)) * half * 1.1;
      const sway = Math.sin(t + i * 1.9) * (this.isSplitChild ? 1.5 : 2.5);
      ctx.moveTo(px, -half * 0.65);
      ctx.lineTo(px - 2 + sway, -half - (this.isSplitChild ? 3 : 5));
      ctx.moveTo(px, half * 0.65);
      ctx.lineTo(px - 2 - sway, half + (this.isSplitChild ? 3 : 5));
    }
    ctx.stroke();

    // Carcasa blindada de silicio violeta
    ctx.fillStyle = drawColor;
    ctx.strokeStyle = isFlashing ? '#ffffff' : '#1e0b36';
    ctx.lineWidth = 1.6;
    ctx.shadowColor = drawColor;
    ctx.shadowBlur = isFlashing ? 14 : 6;

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
    ctx.stroke();

    if (!isFlashing) {
      ctx.shadowBlur = 0;
      // Núcleo de chip oscuro + líneas de datos + sensores frontales
      ctx.fillStyle = '#1b0734';
      ctx.fillRect(-half * 0.52, -half * 0.48, this.size * 0.5, this.size * 0.48);

      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-half * 0.52, -half * 0.48, this.size * 0.5, this.size * 0.48);

      // Sensores LED orientados hacia adelante
      ctx.fillStyle = '#f0abfc';
      ctx.fillRect(half * 0.16, -half * 0.28, 3.2, 2.6);
      ctx.fillRect(half * 0.16, half * 0.28 - 2.6, 3.2, 2.6);
    }

    ctx.restore();
  }
}
