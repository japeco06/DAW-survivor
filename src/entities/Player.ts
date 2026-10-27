import { Entity } from './Entity';
import { Input } from '../core/Input';
import { CharacterProfile, MetaSystem } from '../systems/MetaSystem';
import { HatItem } from '../systems/HatSystem';
import { CompanionPet } from './CompanionPet';

export class Player extends Entity {
  public maxHp: number = 100;
  public hp: number = 100;
  public pickupRadius: number = 115;
  public xpMultiplier: number = 1.0;
  public vampirismChance: number = 0;
  public damageMultiplier: number = 1.0;
  public fireRateMultiplier: number = 1.0;
  public critChance: number = 0;
  public equippedHat: HatItem | null = null;
  public borderColor: string = '#ffffff';
  public profileName: string = 'AGENTE ESTÁNDAR';
  public isSummoner: boolean = false;
  public companion: CompanionPet | null = null;

  private invulnerabilityTimer: number = 0;
  private readonly invulnerabilityDuration: number = 0.45;

  constructor(x: number, y: number, profile?: CharacterProfile, hatOverride?: HatItem | null) {
    const baseSpeed = 260;
    const baseHp = 100;
    const basePickupRadius = 115;

    const hat =
      hatOverride !== undefined ? hatOverride : MetaSystem.readEquippedHatFromStorage();
    const hatSpeedMult = 1 + (hat?.stats.speedMult ?? 0);

    const speed = profile
      ? Math.round(baseSpeed * profile.speedMultiplier * hatSpeedMult)
      : Math.round(baseSpeed * hatSpeedMult);
    const color = profile ? profile.color : '#00ff66';

    super(x, y, 28, speed, color);

    if (profile) {
      this.maxHp = Math.round(baseHp * profile.hpMultiplier);
      this.hp = this.maxHp;
      this.pickupRadius = Math.round(basePickupRadius * profile.pickupRadiusMultiplier);
      this.borderColor = profile.borderColor;
      this.profileName = profile.name;
      if (profile.id === 'MORCILLITA') {
        this.isSummoner = true;
        this.companion = new CompanionPet(x, y);
      }
    }

    if (hat) {
      this.equippedHat = hat;
      this.maxHp += hat.stats.maxHpBonus ?? 0;
      this.hp = this.maxHp;
      this.pickupRadius += hat.stats.magnetBonus ?? 0;
      this.damageMultiplier = Number((1 + (hat.stats.damageMult ?? 0)).toFixed(2));
      this.fireRateMultiplier = Number((1 + (hat.stats.fireRateMult ?? 0)).toFixed(2));
      this.critChance = hat.stats.critChance ?? 0;
    }
  }

  public update(dt: number, input: Input, canvasWidth: number, canvasHeight: number): void {
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    }

    const dir = input.getDirection();

    this.x += dir.x * this.speed * dt;
    this.y += dir.y * this.speed * dt;

    const halfSize = this.size / 2;
    this.x = Math.max(halfSize, Math.min(canvasWidth - halfSize, this.x));
    this.y = Math.max(halfSize, Math.min(canvasHeight - halfSize, this.y));
  }

  public takeDamage(amount: number): boolean {
    if (this.invulnerabilityTimer > 0 || !this.active) {
      return false;
    }

    this.hp = Math.max(0, this.hp - amount);
    this.invulnerabilityTimer = this.invulnerabilityDuration;

    if (this.hp <= 0) {
      this.active = false;
    }
    return true;
  }

  public heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  public isInvulnerable(): boolean {
    return this.invulnerabilityTimer > 0;
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    if (this.invulnerabilityTimer > 0) {
      const flash = Math.floor(this.invulnerabilityTimer * 25) % 2 === 0;
      ctx.fillStyle = flash ? '#ffffff' : '#00ffff';
      ctx.shadowColor = '#00ffff';
    } else {
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.borderColor;
    }

    ctx.shadowBlur = 15;
    ctx.fillRect(
      this.x - this.size / 2,
      this.y - this.size / 2,
      this.size,
      this.size
    );

    // Núcleo interior brillante
    ctx.strokeStyle = this.borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.x - this.size / 2 + 4,
      this.y - this.size / 2 + 4,
      this.size - 8,
      this.size - 8
    );

    if (this.equippedHat) {
      ctx.shadowBlur = 0;
      ctx.font = '18px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.equippedHat.icon, this.x, this.y - this.size / 2 - 11);
    }

    this.drawHealthBar(ctx);

    ctx.restore();
  }

  private drawHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 38;
    const barHeight = 5;
    const x = this.x - barWidth / 2;
    const y = this.y + this.size / 2 + 8;
    const hpRatio = Math.max(0, this.hp / this.maxHp);

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.strokeStyle = 'rgba(0, 255, 102, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);

    ctx.fillStyle = hpRatio > 0.35 ? '#00ff66' : '#ff1e42';
    ctx.fillRect(x, y, barWidth * hpRatio, barHeight);
  }
}
