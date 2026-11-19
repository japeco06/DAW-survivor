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
  private static nextNetId: number = 1;
  public readonly netId: number = Adware.nextNetId++;
  public malwareType: MalwareType = 'ADWARE';
  public maxHp: number = 25;
  public hp: number = 25;
  public damage: number = 12;
  public xpValue: number = 20;
  public knockbackResistance: number = 0; // 0 = retroceso normal, 1 = inmune
  public networkFreezeTimer: number = 0; // Congelación de Red (Fibra Óptica Lvl 10 / EMP: -80% velocidad)
  public cryoSlowTimer: number = 0; // Ralentización criogénica (-45% a -65% velocidad)
  public cryoSlowFactor: number = 0.58;
  public hitFlashTimer: number = 0;
  public facingAngle: number = 0;
  protected readonly animSeed: number = Math.random() * 100;

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

  protected tickSpeedMultiplier(dt: number): number {
    let slowFactor = this.networkFreezeTimer > 0 ? 0.2 : 1.0;
    if (this.networkFreezeTimer > 0) {
      this.networkFreezeTimer = Math.max(0, this.networkFreezeTimer - dt);
    }
    if (this.cryoSlowTimer > 0) {
      this.cryoSlowTimer = Math.max(0, this.cryoSlowTimer - dt);
      slowFactor = Math.min(slowFactor, this.cryoSlowFactor);
    }
    return slowFactor;
  }

  public update(dt: number, player: Player): void {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }
    const slowFactor = this.tickSpeedMultiplier(dt);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 0) {
      this.facingAngle = Math.atan2(dy, dx);
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
    const isFrozen = this.networkFreezeTimer > 0;
    const drawColor = isFlashing ? '#ffffff' : isFrozen ? '#38bdf8' : this.color;
    const half = this.size / 2;
    const t = performance.now() * 0.014 + this.animSeed;

    ctx.fillStyle = 'rgba(2, 6, 14, 0.42)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + half * 0.65, half * 0.8, half * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(this.x, this.y);
    ctx.rotate(this.facingAngle);

    // Patas / pinzas cibernéticas animadas (3 pares)
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      const legX = i * (half * 0.45);
      const wiggle = Math.sin(t + i * 2.1) * 2.4;
      ctx.moveTo(legX, -half * 0.55);
      ctx.lineTo(legX - 3 + wiggle, -half - 4);
      ctx.moveTo(legX, half * 0.55);
      ctx.lineTo(legX - 3 - wiggle, half + 4);
    }
    ctx.stroke();

    // Caparazón agresivo en punta (arácnido/virus digital)
    ctx.fillStyle = drawColor;
    ctx.beginPath();
    ctx.moveTo(half + 4, 0);              // Punta frontal
    ctx.lineTo(half * 0.25, -half * 0.85);
    ctx.lineTo(-half * 0.85, -half * 0.65);
    ctx.lineTo(-half * 0.45, 0);          // Muesca trasera
    ctx.lineTo(-half * 0.85, half * 0.65);
    ctx.lineTo(half * 0.25, half * 0.85);
    ctx.closePath();
    ctx.fill();

    if (!isFlashing) {
      // Visor oscuro interno
      ctx.fillStyle = isFrozen ? '#082f49' : '#260009';
      ctx.beginPath();
      ctx.moveTo(half * 0.72, 0);
      ctx.lineTo(-half * 0.1, -half * 0.46);
      ctx.lineTo(-half * 0.42, 0);
      ctx.lineTo(-half * 0.1, half * 0.46);
      ctx.closePath();
      ctx.fill();

      // Dos ojos digitales brillantes orientados al objetivo
      ctx.fillStyle = isFrozen ? '#bae6fd' : '#fef08a';
      ctx.fillRect(half * 0.18, -half * 0.28, 3.2, 2.6);
      ctx.fillRect(half * 0.18, half * 0.28 - 2.6, 3.2, 2.6);
    }

    ctx.restore();
  }
}
