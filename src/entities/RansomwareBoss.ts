import { Adware } from './Adware';
import { Player } from './Player';

/**
 * Jefe de Oleada: Ransomware (WANNA_CRYPT.boss).
 * Entidad colosal con escudo rotatorio, barra de vida propia, inmunidad casi total al retroceso
 * y un pulso de aceleración periódica ("Encryption Surge").
 */
export class RansomwareBoss extends Adware {
  public bossName: string;
  private shieldAngle: number = 0;
  private surgeTimer: number = 0;
  private baseSpeed: number = 78;

  constructor(x: number, y: number, bossLevel: number = 1) {
    const scaledHp = 450 + (bossLevel - 1) * 380;
    super(x, y, 54, 78, '#ff0055', scaledHp, 28, 240 * bossLevel);
    this.malwareType = 'RANSOMWARE';
    this.knockbackResistance = 0.92;
    this.bossName = `RANSOMWARE_v${bossLevel}.0 [ENCRYPTOR]`;
  }

  public override update(dt: number, player: Player): void {
    this.shieldAngle += dt * 2.2;
    this.surgeTimer += dt;

    // Cada 4.5 segundos realiza una embestida corta de cifrado ("Surge")
    const cycle = this.surgeTimer % 4.5;
    if (cycle > 3.6) {
      this.speed = this.baseSpeed * 2.15;
    } else {
      this.speed = this.baseSpeed;
    }

    super.update(dt, player);
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    const drawColor = isFlashing ? '#ffffff' : this.color;
    const half = this.size / 2;

    // 1. Anillo de cifrado exterior giratorio
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.shieldAngle);
    ctx.strokeStyle = isFlashing ? '#ffffff' : '#ff0055';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, half + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 2. Cuerpo blindado principal
    ctx.fillStyle = drawColor;
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = isFlashing ? 28 : 20;
    ctx.fillRect(this.x - half, this.y - half, this.size, this.size);

    // 3. Símbolo interior de candado/núcleo de cifrado
    if (!isFlashing) {
      ctx.fillStyle = '#1f000d';
      ctx.fillRect(this.x - half + 8, this.y - half + 8, this.size - 16, this.size - 16);

      ctx.strokeStyle = '#ff99bb';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x - 10, this.y - 6, 20, 16);
      ctx.beginPath();
      ctx.arc(this.x, this.y - 6, 6, Math.PI, 0);
      ctx.stroke();
    }

    // 4. Barra de vida local sobre el Jefe
    const barW = 68;
    const barH = 6;
    const bx = this.x - barW / 2;
    const by = this.y - half - 22;
    const ratio = Math.max(0, this.hp / this.maxHp);

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(bx, by, barW * ratio, barH);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, barH);

    ctx.restore();
  }
}
