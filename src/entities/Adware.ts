import { Entity } from './Entity';
import { Player } from './Player';

export type MalwareType =
  | 'ADWARE'
  | 'TROJAN'
  | 'TROJAN_SHOOTER'
  | 'WORM'
  | 'ARMORED_WORM'
  | 'RANSOMWARE';

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

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 0) {
      this.x += (dx / distance) * this.speed * dt;
      this.y += (dy / distance) * this.speed * dt;
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

    ctx.fillStyle = drawColor;
    ctx.shadowColor = drawColor;
    ctx.shadowBlur = isFlashing ? 18 : 12;
    ctx.fillRect(
      this.x - this.size / 2,
      this.y - this.size / 2,
      this.size,
      this.size
    );

    if (!isFlashing) {
      ctx.fillStyle = '#33000a';
      ctx.fillRect(
        this.x - this.size / 4,
        this.y - this.size / 4,
        this.size / 2,
        this.size / 2
      );
    }

    ctx.restore();
  }
}
