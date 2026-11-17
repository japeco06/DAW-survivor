import { Entity } from './Entity';

/**
 * Paquete de datos ofensivo disparado automáticamente por el Agente Antivirus.
 * Se desplaza en línea recta hacia el objetivo calculado y se destruye al impactar o expirar.
 */
export class Projectile extends Entity {
  public vx: number;
  public vy: number;
  public damage: number;
  public pierceLeft: number;
  public isEvolved: boolean;
  private hitIds: Set<object> = new Set();
  private lifeTime: number = 2.2; // Segundos máximos de vida útil
  private trail: { x: number; y: number }[] = [];

  constructor(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number = 540,
    damage: number = 25,
    pierceCount: number = 0,
    isEvolved: boolean = false
  ) {
    super(x, y, isEvolved ? 13 : 10, speed, isEvolved ? '#fde047' : '#00f0ff');
    this.vx = dirX * speed;
    this.vy = dirY * speed;
    this.damage = damage;
    this.pierceLeft = pierceCount;
    this.isEvolved = isEvolved;
  }

  public hasHit(enemy: object): boolean {
    return this.hitIds.has(enemy);
  }

  public markHit(enemy: object): void {
    this.hitIds.add(enemy);
    if (this.pierceLeft > 0) {
      this.pierceLeft--;
    } else {
      this.active = false;
    }
  }

  public update(
    dt: number,
    canvasWidth: number,
    canvasHeight: number,
    viewOriginX: number = 0,
    viewOriginY: number = 0
  ): void {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) {
      this.trail.shift();
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifeTime -= dt;

    // Desactivar si expira su tiempo o sale ampliamente del área visible
    const margin = 80;
    if (
      this.lifeTime <= 0 ||
      this.x < viewOriginX - margin ||
      this.x > viewOriginX + canvasWidth + margin ||
      this.y < viewOriginY - margin ||
      this.y > viewOriginY + canvasHeight + margin
    ) {
      this.active = false;
    }
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    const angle = Math.atan2(this.vy, this.vx);
    const len = this.isEvolved ? 24 : 18;
    const rad = this.isEvolved ? 8.5 : 6.2;

    ctx.save();

    // Estela de plasma segmentada en espacio de mundo
    if (this.trail.length > 0) {
      ctx.lineCap = 'round';
      for (let i = 0; i < this.trail.length; i++) {
        const p0 = this.trail[i];
        const p1 = i === this.trail.length - 1 ? { x: this.x, y: this.y } : this.trail[i + 1];
        const ratio = (i + 1) / (this.trail.length + 1);
        ctx.strokeStyle = this.isEvolved
          ? `rgba(250, 204, 21, ${0.42 * ratio})`
          : `rgba(0, 240, 255, ${0.38 * ratio})`;
        ctx.lineWidth = rad * 1.45 * ratio;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    // Aura energética envolvente
    ctx.fillStyle = this.isEvolved
      ? 'rgba(250, 204, 21, 0.28)'
      : 'rgba(0, 240, 255, 0.24)';
    ctx.beginPath();
    ctx.ellipse(-2, 0, len * 0.92, rad * 1.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aletas estabilizadoras traseras de lanza cibernética
    ctx.fillStyle = this.isEvolved ? '#f59e0b' : '#0284c7';
    ctx.beginPath();
    ctx.moveTo(-len * 0.12, 0);
    ctx.lineTo(-len * 0.85, -rad * 1.15);
    ctx.lineTo(-len * 0.56, 0);
    ctx.lineTo(-len * 0.85, rad * 1.15);
    ctx.closePath();
    ctx.fill();

    // Cuerpo principal afilado en punta de lanza
    ctx.fillStyle = this.isEvolved ? '#fde047' : '#22d3ee';
    ctx.strokeStyle = this.isEvolved ? '#fef9c3' : '#cffafe';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(len * 0.95, 0);
    ctx.lineTo(-len * 0.2, -rad * 0.88);
    ctx.lineTo(-len * 0.78, -rad * 0.35);
    ctx.lineTo(-len * 0.52, 0);
    ctx.lineTo(-len * 0.78, rad * 0.35);
    ctx.lineTo(-len * 0.2, rad * 0.88);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Banda mecánica oscura en la ojiva
    ctx.fillStyle = '#091426';
    ctx.fillRect(-len * 0.16, -rad * 0.52, 3.2, rad * 1.04);

    // Núcleo incandescente blanco central
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(len * 0.72, 0);
    ctx.lineTo(-len * 0.12, -rad * 0.42);
    ctx.lineTo(-len * 0.48, 0);
    ctx.lineTo(-len * 0.12, rad * 0.42);
    ctx.closePath();
    ctx.fill();

    // Anillo dorado extra en evolución Hex-Core
    if (this.isEvolved) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(len * 0.15, -rad * 1.12);
      ctx.lineTo(len * 0.02, 0);
      ctx.lineTo(len * 0.15, rad * 1.12);
      ctx.stroke();
    }

    ctx.restore();
  }
}
