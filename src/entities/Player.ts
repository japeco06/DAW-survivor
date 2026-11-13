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
  public vampirismHealAmount: number = 0;
  public damageMultiplier: number = 1.0;
  public fireRateMultiplier: number = 1.0;
  public critChance: number = 0.05; // 5% probabilidad crítica base (2x daño)
  public equippedHat: HatItem | null = null;
  public borderColor: string = '#ffffff';
  public profileName: string = 'AGENTE ESTÁNDAR';
  public isSummoner: boolean = false;
  public companion: CompanionPet | null = null;

  private invulnerabilityTimer: number = 0;
  private readonly invulnerabilityDuration: number = 0.45;
  private facingAngle: number = 0;
  private isMoving: boolean = false;
  private trailTimer: number = 0;
  private motionTrail: { x: number; y: number; alpha: number }[] = [];

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
      this.critChance = Number((0.05 + (hat.stats.critChance ?? 0)).toFixed(3));
    }
  }

  public update(dt: number, input: Input, canvasWidth: number, canvasHeight: number): void {
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    }

    const dir = input.getDirection();
    const effectiveSpeed = Math.min(520, this.speed);
    this.isMoving = dir.x !== 0 || dir.y !== 0;

    if (this.isMoving) {
      this.facingAngle = Math.atan2(dir.y, dir.x);
      this.trailTimer += dt;
      if (this.trailTimer >= 0.032) {
        this.trailTimer = 0;
        this.motionTrail.push({ x: this.x, y: this.y, alpha: 0.42 });
        if (this.motionTrail.length > 6) {
          this.motionTrail.shift();
        }
      }
    }

    for (let i = this.motionTrail.length - 1; i >= 0; i--) {
      this.motionTrail[i].alpha -= dt * 2.3;
      if (this.motionTrail[i].alpha <= 0) {
        this.motionTrail.splice(i, 1);
      }
    }

    this.x += dir.x * effectiveSpeed * dt;
    this.y += dir.y * effectiveSpeed * dt;

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
    const isFlashing = this.invulnerabilityTimer > 0 && Math.floor(this.invulnerabilityTimer * 25) % 2 === 0;
    const bodyColor = isFlashing ? '#ffffff' : this.invulnerabilityTimer > 0 ? '#00ffff' : this.color;
    const accentColor = isFlashing ? '#ffffff' : this.invulnerabilityTimer > 0 ? '#00ffff' : this.borderColor;
    const now = performance.now();

    // Estela luminosa de movimiento
    for (let i = 0; i < this.motionTrail.length; i++) {
      const ghost = this.motionTrail[i];
      const scale = 0.55 + (i / Math.max(1, this.motionTrail.length)) * 0.35;
      const r = (this.size / 2) * scale;
      ctx.globalAlpha = ghost.alpha * 0.65;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(ghost.x, ghost.y - r);
      ctx.lineTo(ghost.x + r, ghost.y);
      ctx.lineTo(ghost.x, ghost.y + r);
      ctx.lineTo(ghost.x - r, ghost.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Aro sutil de radar/escudo alrededor del agente
    ctx.strokeStyle = accentColor;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.72 + Math.sin(now * 0.006) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    Player.drawCyberChassis(
      ctx,
      this.x,
      this.y,
      this.size,
      bodyColor,
      accentColor,
      now,
      this.facingAngle,
      this.isMoving
    );

    if (this.equippedHat) {
      ctx.shadowBlur = 0;
      ctx.font = '18px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const hatBob = Math.sin(now * 0.006) * 1.2;
      ctx.fillText(this.equippedHat.icon, this.x, this.y - this.size / 2 - 12 + hatBob);
    }

    this.drawHealthBar(ctx);

    ctx.restore();
  }

  /**
   * Dibuja la silueta cibernética estilizada del Agente Antivirus (compartida con el menú).
   */
  public static drawCyberChassis(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    borderColor: string,
    timeMs: number,
    facingAngle: number = 0,
    isMoving: boolean = false
  ): void {
    const half = size / 2;
    const cut = half * 0.36;
    const lookX = Math.cos(facingAngle) * (half * 0.18);
    const lookY = Math.sin(facingAngle) * (half * 0.14);

    ctx.save();
    ctx.translate(x, y);

    // Propulsor energético en dirección contraria al movimiento
    if (isMoving) {
      const thrust = half * (0.9 + Math.sin(timeMs * 0.03) * 0.22);
      const backAngle = facingAngle + Math.PI;
      ctx.save();
      ctx.rotate(backAngle);
      ctx.fillStyle = borderColor;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(half * 0.4, -half * 0.28);
      ctx.lineTo(half * 0.4 + thrust, 0);
      ctx.lineTo(half * 0.4, half * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = color;
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 14;

    // Aletas laterales tecnológicas
    const finSpread = half + 3;
    ctx.beginPath();
    ctx.moveTo(-finSpread, -half * 0.32);
    ctx.lineTo(-half + 2, -half * 0.52);
    ctx.lineTo(-half + 2, half * 0.52);
    ctx.lineTo(-finSpread, half * 0.32);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(finSpread, -half * 0.32);
    ctx.lineTo(half - 2, -half * 0.52);
    ctx.lineTo(half - 2, half * 0.52);
    ctx.lineTo(finSpread, half * 0.32);
    ctx.closePath();
    ctx.fill();

    // Chasis principal octogonal blindado
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

    ctx.shadowBlur = 0;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Visor oscuro interior
    ctx.fillStyle = '#041218';
    ctx.fillRect(-half * 0.58, -half * 0.42, size * 0.58, size * 0.38);

    // Ojos digitales luminosos orientados al movimiento
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-half * 0.34 + lookX, -half * 0.28 + lookY, Math.max(2.5, size * 0.12), Math.max(3, size * 0.15));
    ctx.fillRect(half * 0.14 + lookX, -half * 0.28 + lookY, Math.max(2.5, size * 0.12), Math.max(3, size * 0.15));

    // Núcleo energético inferior pulsante
    const coreAlpha = 0.65 + Math.sin(timeMs * 0.008) * 0.35;
    ctx.fillStyle = borderColor;
    ctx.globalAlpha = coreAlpha;
    ctx.fillRect(-half * 0.25, half * 0.18, size * 0.25, Math.max(2, size * 0.12));

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
