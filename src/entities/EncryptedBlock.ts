import { Bounds } from './Entity';
import { Player } from './Player';

export class EncryptedBlock {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  private pulseTimer: number = Math.random() * Math.PI * 2;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  public getBounds(): Bounds {
    return {
      left: this.x - this.width / 2,
      right: this.x + this.width / 2,
      top: this.y - this.height / 2,
      bottom: this.y + this.height / 2,
    };
  }

  public containsPoint(px: number, py: number, padding: number = 0): boolean {
    const b = this.getBounds();
    return (
      px >= b.left - padding &&
      px <= b.right + padding &&
      py >= b.top - padding &&
      py <= b.bottom + padding
    );
  }

  public intersectsBounds(other: Bounds): boolean {
    const b = this.getBounds();
    return (
      b.left < other.right &&
      b.right > other.left &&
      b.top < other.bottom &&
      b.bottom > other.top
    );
  }

  public resolvePlayerCollision(player: Player): void {
    const block = this.getBounds();
    const pBounds = player.getBounds();

    if (!this.intersectsBounds(pBounds)) return;

    const overlapLeft = pBounds.right - block.left;
    const overlapRight = block.right - pBounds.left;
    const overlapTop = pBounds.bottom - block.top;
    const overlapBottom = block.bottom - pBounds.top;

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (minOverlap === overlapLeft) {
      player.x -= overlapLeft;
    } else if (minOverlap === overlapRight) {
      player.x += overlapRight;
    } else if (minOverlap === overlapTop) {
      player.y -= overlapTop;
    } else {
      player.y += overlapBottom;
    }
  }

  public update(dt: number): void {
    this.pulseTimer += dt * 3;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const b = this.getBounds();
    const glow = 8 + Math.sin(this.pulseTimer) * 4;

    ctx.save();
    ctx.fillStyle = '#0f051d';
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = glow;

    ctx.fillRect(b.left, b.top, this.width, this.height);
    ctx.strokeRect(b.left, b.top, this.width, this.height);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 0, 85, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.left + 5, b.top + 5, this.width - 10, this.height - 10);

    ctx.fillStyle = 'rgba(255, 0, 85, 0.55)';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[ENCRYPTED_BLOCK]', this.x, this.y + 4);
    ctx.restore();
  }
}
