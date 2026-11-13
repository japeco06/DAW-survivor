import { Entity } from './Entity';
import { Player } from './Player';

export type MalwareType =
  | 'ADWARE'
  | 'TROJAN'
  | 'TROJAN_SHOOTER'
  | 'WORM'
  | 'ARMORED_WORM'
  | 'EVASOR'
  | 'HARDWARE_BOX'
  | 'CRYPTO_MINER'
  | 'RANSOMWARE'
  | 'FINAL_BOSS';

/**
 * Clase base para todo el Malware (Fase 4).
 * Define estadísticas de combate (HP, daño, recompensa de XP, resistencia al retroceso)
 * y comportamiento de persecución hacia el Agente Antivirus.
 */
export class Adware extends Entity {
  public malwareType: MalwareType = 'ADWARE';
  public maxHp: number = 25;
  public hp: number = 25;
  public damage: number = 12;
  public xpValue: number = 20;
  public knockbackResistance: number = 0; // 0 = retroceso normal, 1 = inmune
  public networkFreezeTimer: number = 0; // Congelación de Red (Fibra Óptica Lvl 10: -80% velocidad)
  protected hitFlashTimer: number = 0;

  constructor(
    x: number,
    y: number,
    size: number = 22,
    speed: number = 115,
    color: string = '#ff1e42',
    hp: number = 25,
    damage: number = 12,
    xpValue: number = 20
  ) {
    super(x, y, size, speed, color);
    this.maxHp = hp;
    this.hp = hp;
    this.damage = damage;
    this.xpValue = xpValue;
  }

  public update(dt: number, player: Player): void {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }
    const slowFactor = this.networkFreezeTimer > 0 ? 0.2 : 1.0;
    if (this.networkFreezeTimer > 0) {
      this.networkFreezeTimer = Math.max(0, this.networkFreezeTimer - dt);
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 0) {
      this.x += (dx / distance) * this.speed * slowFactor * dt;
      this.y += (dy / distance) * this.speed * slowFactor * dt;
    }
  }

  /**
   * Determina si un impacto proveniente de (sourceX, sourceY) es bloqueado por un escudo direccional.
   */
  public isHitBlockedByShield(_sourceX: number, _sourceY: number): boolean {
    return false;
  }

  /**
   * Reduce la vida del malware y activa un breve destello blanco.
   */
  public takeDamage(amount: number, knockbackX: number = 0, knockbackY: number = 0): void {
    this.hp -= amount;
    this.hitFlashTimer = 0.08;

    const kbFactor = Math.max(0, 1 - this.knockbackResistance);
    this.x += knockbackX * kbFactor;
    this.y += knockbackY * kbFactor;

    if (this.hp <= 0) {
      this.active = false;
    }
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    const drawColor = isFlashing ? '#ffffff' : this.color;
    const half = this.size / 2;

    ctx.translate(this.x, this.y);
    ctx.fillStyle = drawColor;
    ctx.shadowColor = drawColor;
    ctx.shadowBlur = isFlashing ? 14 : 5;

    // Cuerpo angulado estilo malware / bug cibernético
    const cut = half * 0.35;
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
      // Núcleo interno oscuro
      ctx.fillStyle = '#1e0007';
      ctx.fillRect(-half * 0.5, -half * 0.5, half, half);

      // Ojo/Luz de sensor cibernético pulsante
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008 + this.x);
      ctx.fillStyle = `rgba(255, 60, 90, ${0.7 + 0.3 * pulse})`;
      ctx.shadowColor = '#ff2a55';
      ctx.shadowBlur = 4;
      ctx.fillRect(-half * 0.25, -half * 0.25, half * 0.5, half * 0.5);
    }

    ctx.restore();
  }
}
