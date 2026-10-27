import { Adware } from './Adware';
import { Player } from './Player';

export class ArmoredWorm extends Adware {
  public facingAngle: number = 0;
  private initializedFacing: boolean = false;
  private readonly turnRate: number = 1.32;
  private readonly shieldHalfArc: number = Math.PI * 0.38;
  private shieldBlockFlashTimer: number = 0;

  constructor(x: number, y: number, hpMultiplier: number = 1) {
    super(
      x,
      y,
      34,
      48,
      '#14b8a6',
      Math.round(95 * hpMultiplier),
      20,
      55
    );
    this.malwareType = 'ARMORED_WORM';
    this.knockbackResistance = 0.8;
  }

  public override update(dt: number, player: Player): void {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }
    if (this.shieldBlockFlashTimer > 0) {
      this.shieldBlockFlashTimer = Math.max(0, this.shieldBlockFlashTimer - dt);
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const desiredAngle = Math.atan2(dy, dx);

    if (!this.initializedFacing) {
      this.facingAngle = desiredAngle;
      this.initializedFacing = true;
    } else {
      const diff = this.normalizeSignedAngle(desiredAngle - this.facingAngle);
      const maxTurn = this.turnRate * dt;
      this.facingAngle += Math.max(-maxTurn, Math.min(maxTurn, diff));
      this.facingAngle = this.normalizeSignedAngle(this.facingAngle);
    }

    this.x += Math.cos(this.facingAngle) * this.speed * dt;
    this.y += Math.sin(this.facingAngle) * this.speed * dt;
  }

  public override isHitBlockedByShield(sourceX: number, sourceY: number): boolean {
    const incomingAngle = Math.atan2(sourceY - this.y, sourceX - this.x);
    const angleDiff = Math.abs(this.normalizeSignedAngle(incomingAngle - this.facingAngle));
    if (angleDiff <= this.shieldHalfArc) {
      this.shieldBlockFlashTimer = 0.14;
      return true;
    }
    return false;
  }

  private normalizeSignedAngle(angle: number): number {
    let a = (angle + Math.PI) % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a - Math.PI;
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    const drawColor = isFlashing ? '#ffffff' : this.color;
    const half = this.size / 2;

    ctx.translate(this.x, this.y);
    ctx.rotate(this.facingAngle);

    ctx.fillStyle = drawColor;
    ctx.shadowColor = drawColor;
    ctx.shadowBlur = isFlashing ? 18 : 12;

    const cut = half * 0.38;
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

    // Punto débil trasero/lateral visible
    ctx.fillStyle = isFlashing ? '#ffffff' : '#f43f5e';
    ctx.beginPath();
    ctx.arc(-half * 0.45, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // Escudo direccional frontal
    const shieldFlashing = this.shieldBlockFlashTimer > 0;
    const shieldRadius = half + 8;
    ctx.strokeStyle = shieldFlashing ? '#ffffff' : '#38bdf8';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = shieldFlashing ? 24 : 16;
    ctx.lineWidth = shieldFlashing ? 7 : 5;
    ctx.beginPath();
    ctx.arc(0, 0, shieldRadius, -this.shieldHalfArc, this.shieldHalfArc);
    ctx.stroke();

    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, shieldRadius + 3, -this.shieldHalfArc * 0.85, this.shieldHalfArc * 0.85);
    ctx.stroke();

    ctx.restore();
  }
}
