import { Entity } from './Entity';
import { Input } from '../core/Input';
import { CharacterId, CharacterProfile, MetaSystem } from '../systems/MetaSystem';
import { HatItem } from '../systems/HatSystem';
import { HatRenderer } from '../utils/HatRenderer';
import { CompanionPet } from './CompanionPet';

export interface RootTrailNode {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
}

export class Player extends Entity {
  public characterId: CharacterId = 'STANDARD';
  public maxHp: number = 100;
  public hp: number = 100;
  public pickupRadius: number = 115;
  public xpMultiplier: number = 1.0;
  public vampirismChance: number = 0;
  public vampirismHealAmount: number = 0;
  public damageMultiplier: number = 1.0;
  public fireRateMultiplier: number = 1.0;
  public critChance: number = 0.05; // 5% probabilidad crítica base (2x daño)
  public dodgeChance: number = 0;
  public bonusCoinDropChance: number = 0;
  public passiveRegenPerSec: number = 0;
  public reviveSpeedMultiplier: number = 1.0;
  private regenAccumulator: number = 0;

  // Sistema de Habilidad Activa / Ultimate (cargada por bajas, dura X segundos)
  public ultCharge: number = 0;
  public ultMaxCharge: number = 35;
  public ultActiveTimer: number = 0;
  public ultDuration: number = 6.0;
  public ultPulseTimer: number = 0;
  public ultKillAccumulator: number = 0;
  public ultName: string = 'SOBRECARGA EMP';
  public ultNameEn: string = 'EMP OVERLOAD';

  // Sistema de Dash Táctico ([Shift])
  public dashCooldown: number = 0;
  public dashMaxCooldown: number = 2.6;
  public dashActiveTimer: number = 0;
  public readonly dashDuration: number = 0.17;
  private dashDirX: number = 1;
  private dashDirY: number = 0;

  // Pasivas específicas por personaje
  public shieldReady: boolean = false;
  public shieldRechargeTimer: number = 0;
  public readonly shieldMaxCooldown: number = 16;
  public adrenalineTimer: number = 0;
  public rootTrailNodes: RootTrailNode[] = [];
  private rootTrailSpawnTimer: number = 0;
  public surgePulsePending: boolean = false;
  public lastHitOutcome: 'HIT' | 'SHIELD_BLOCKED' | 'DODGED' | 'IGNORED' = 'IGNORED';

  public equippedHat: HatItem | null = null;
  public borderColor: string = '#ffffff';
  public profileName: string = 'AGENTE ESTÁNDAR';
  public isSummoner: boolean = false;
  public companion: CompanionPet | null = null;

  public speedBonusMultiplier: number = 1.0; // Turbo temporal de Oasis / eventos
  public externalSpeedMultiplier: number = 1.0; // Ralentización por líquido viscoso
  public speedBoostTimer: number = 0;
  public invulnerabilityTimer: number = 0;
  private readonly invulnerabilityDuration: number = 0.45;
  public facingAngle: number = 0;
  public isMoving: boolean = false;
  private trailTimer: number = 0;
  private motionTrail: { x: number; y: number; alpha: number }[] = [];

  constructor(x: number, y: number, profile?: CharacterProfile, hatOverride?: HatItem | null) {
    const baseSpeed = 260;
    const baseHp = 100;
    const basePickupRadius = 115;

    const hat =
      hatOverride !== undefined ? hatOverride : MetaSystem.readEquippedHatFromStorage();
    const hatSpeedMult = 1 + (hat?.stats.speedMult ?? 0);
    const lab = MetaSystem.readLabBonusesFromStorage();

    const speed = profile
      ? Math.round(baseSpeed * profile.speedMultiplier * hatSpeedMult * lab.speedMult)
      : Math.round(baseSpeed * hatSpeedMult * lab.speedMult);
    const color = profile ? profile.color : '#00ff66';

    super(x, y, 28, speed, color);

    if (profile) {
      this.characterId = profile.id;
      this.maxHp = Math.round(baseHp * profile.hpMultiplier);
      this.hp = this.maxHp;
      this.pickupRadius = Math.round(basePickupRadius * profile.pickupRadiusMultiplier);
      this.borderColor = profile.borderColor;
      this.profileName = profile.name;
      this.ultName = profile.ultName;
      this.ultNameEn = profile.ultNameEn;
      this.ultDuration = profile.ultDuration;
      this.ultMaxCharge = Math.max(18, Math.round(profile.ultKillsRequired * lab.ultChargeMult));
      if (profile.id === 'MORCILLITA') {
        this.isSummoner = true;
        this.companion = new CompanionPet(x, y);
      } else if (profile.id === 'PROXY') {
        this.shieldReady = true;
      } else if (profile.id === 'CRYPTO') {
        this.critChance += 0.05;
        this.bonusCoinDropChance = 0.18;
      } else if (profile.id === 'SPECTRE') {
        this.dodgeChance = 0.22;
        this.critChance += 0.15;
        this.fireRateMultiplier = 1.1;
      } else if (profile.id === 'OVERCLOCK') {
        this.fireRateMultiplier = 1.15;
      } else if (profile.id === 'KERNEL_X') {
        this.damageMultiplier = 1.2;
        this.passiveRegenPerSec = 2.0;
      }
    }

    // Aplicar mejoras permanentes del Laboratorio Kernel
    this.maxHp = Math.round(this.maxHp * lab.hpMult);
    this.hp = this.maxHp;
    this.pickupRadius = Math.round(this.pickupRadius * lab.magnetMult);
    this.xpMultiplier = Number((this.xpMultiplier + lab.xpBonus).toFixed(2));
    this.damageMultiplier = Number((this.damageMultiplier + lab.damageBonus).toFixed(2));
    this.fireRateMultiplier = Number((this.fireRateMultiplier + lab.fireRateBonus).toFixed(2));
    this.bonusCoinDropChance = Number((this.bonusCoinDropChance + lab.coinDropBonus).toFixed(3));
    this.reviveSpeedMultiplier = lab.reviveSpeedMult;

    if (hat) {
      this.equippedHat = hat;
      this.maxHp += hat.stats.maxHpBonus ?? 0;
      this.hp = this.maxHp;
      this.pickupRadius += hat.stats.magnetBonus ?? 0;
      this.damageMultiplier = Number((this.damageMultiplier + (hat.stats.damageMult ?? 0)).toFixed(2));
      this.fireRateMultiplier = Number((this.fireRateMultiplier + (hat.stats.fireRateMult ?? 0)).toFixed(2));
      this.critChance = Number((this.critChance + (hat.stats.critChance ?? 0)).toFixed(3));
    }
  }

  public update(
    dt: number,
    input: Input,
    canvasWidth: number,
    canvasHeight: number,
    unbounded: boolean = false,
    lightGraphics: boolean = false
  ): void {
    const dir = input.getDirection();
    this.updateWithVector(dt, dir.x, dir.y, canvasWidth, canvasHeight, unbounded, lightGraphics);
  }

  public updateWithVector(
    dt: number,
    dirX: number,
    dirY: number,
    canvasWidth: number,
    canvasHeight: number,
    unbounded: boolean = false,
    lightGraphics: boolean = false
  ): void {
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    }

    if (this.characterId === 'PROXY' && !this.shieldReady) {
      this.shieldRechargeTimer -= dt;
      if (this.shieldRechargeTimer <= 0) {
        this.shieldReady = true;
        this.shieldRechargeTimer = 0;
      }
    }

    if (this.adrenalineTimer > 0) {
      this.adrenalineTimer = Math.max(0, this.adrenalineTimer - dt);
    }

    if (this.ultActiveTimer > 0) {
      this.ultActiveTimer = Math.max(0, this.ultActiveTimer - dt);
      this.ultPulseTimer -= dt;
    }

    if (this.dashCooldown > 0) {
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    }
    const isDashing = this.dashActiveTimer > 0;
    if (isDashing) {
      this.dashActiveTimer = Math.max(0, this.dashActiveTimer - dt);
    }

    const activeUltRegen =
      this.ultActiveTimer > 0
        ? this.characterId === 'PROXY'
          ? 8
          : this.characterId === 'STANDARD'
          ? 4
          : 0
        : 0;
    const totalRegen = this.passiveRegenPerSec + activeUltRegen;

    if (totalRegen > 0 && this.active && this.hp < this.maxHp) {
      this.regenAccumulator += totalRegen * dt;
      if (this.regenAccumulator >= 1) {
        const healInt = Math.floor(this.regenAccumulator);
        this.regenAccumulator -= healInt;
        this.heal(healInt);
      }
    }

    for (let i = this.rootTrailNodes.length - 1; i >= 0; i--) {
      this.rootTrailNodes[i].life -= dt;
      if (this.rootTrailNodes[i].life <= 0) {
        this.rootTrailNodes.splice(i, 1);
      }
    }

    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer = Math.max(0, this.speedBoostTimer - dt);
      if (this.speedBoostTimer === 0) {
        this.speedBonusMultiplier = 1.0;
      }
    }

    const len = Math.hypot(dirX, dirY);
    const nx = isDashing ? this.dashDirX : len > 1 ? dirX / len : dirX;
    const ny = isDashing ? this.dashDirY : len > 1 ? dirY / len : dirY;
    const adrenalineSpeedMult = this.adrenalineTimer > 0 ? 1.25 : 1.0;
    const ultSpeedMult =
      this.ultActiveTimer > 0
        ? this.characterId === 'ROOT'
          ? 1.65
          : this.characterId === 'SPECTRE'
          ? 1.45
          : this.characterId === 'OVERCLOCK'
          ? 1.35
          : this.characterId === 'MORCILLITA'
          ? 1.2
          : 1.12
        : 1.0;
    const baseEffectiveSpeed = Math.min(
      680,
      this.speed * adrenalineSpeedMult * ultSpeedMult * this.speedBonusMultiplier * this.externalSpeedMultiplier
    );
    const effectiveSpeed = isDashing ? Math.min(1020, Math.max(760, baseEffectiveSpeed * 3.15)) : baseEffectiveSpeed;
    this.isMoving = isDashing || nx !== 0 || ny !== 0;

    if (this.isMoving) {
      this.facingAngle = Math.atan2(ny, nx);
      if (!lightGraphics) {
        this.trailTimer += dt;
        const trailStep = isDashing ? 0.014 : 0.032;
        if (this.trailTimer >= trailStep) {
          this.trailTimer = 0;
          this.motionTrail.push({ x: this.x, y: this.y, alpha: isDashing ? 0.68 : 0.42 });
          if (this.motionTrail.length > (isDashing ? 9 : 6)) {
            this.motionTrail.shift();
          }
        }
      } else if (this.motionTrail.length > 0) {
        this.motionTrail = [];
      }

      if (this.characterId === 'ROOT') {
        this.rootTrailSpawnTimer += dt;
        const spawnInterval = this.ultActiveTimer > 0 ? 0.11 : 0.22;
        if (this.rootTrailSpawnTimer >= spawnInterval) {
          this.rootTrailSpawnTimer = 0;
          const isSuper = this.ultActiveTimer > 0;
          this.rootTrailNodes.push({
            x: this.x,
            y: this.y,
            life: isSuper ? 2.8 : 2.2,
            maxLife: isSuper ? 2.8 : 2.2,
            radius: isSuper ? 44 : 26,
          });
          if (this.rootTrailNodes.length > (isSuper ? 26 : 14)) {
            this.rootTrailNodes.shift();
          }
        }
      }
    }

    for (let i = this.motionTrail.length - 1; i >= 0; i--) {
      this.motionTrail[i].alpha -= dt * 2.3;
      if (this.motionTrail[i].alpha <= 0) {
        this.motionTrail.splice(i, 1);
      }
    }

    this.x += nx * effectiveSpeed * dt;
    this.y += ny * effectiveSpeed * dt;

    if (!unbounded) {
      const halfSize = this.size / 2;
      this.x = Math.max(halfSize, Math.min(canvasWidth - halfSize, this.x));
      this.y = Math.max(halfSize, Math.min(canvasHeight - halfSize, this.y));
    }
  }

  public getEffectiveFireRateMultiplier(): number {
    let mult = this.adrenalineTimer > 0 ? this.fireRateMultiplier * 1.45 : this.fireRateMultiplier;
    if (this.ultActiveTimer > 0) {
      if (this.characterId === 'OVERCLOCK') mult *= 2.2;
      else if (this.characterId === 'CRYPTO' || this.characterId === 'KERNEL_X') mult *= 1.5;
      else if (this.characterId === 'STANDARD' || this.characterId === 'SPECTRE') mult *= 1.35;
    }
    return mult;
  }

  public getEffectivePickupRadius(): number {
    return this.ultActiveTimer > 0 && this.characterId === 'CRYPTO'
      ? this.pickupRadius + 600
      : this.pickupRadius;
  }

  public addUltCharge(kills: number): boolean {
    if (!this.active || this.ultActiveTimer > 0 || kills <= 0) return false;
    const wasReady = this.ultCharge >= this.ultMaxCharge;
    this.ultCharge = Math.min(this.ultMaxCharge, this.ultCharge + kills);
    return !wasReady && this.ultCharge >= this.ultMaxCharge;
  }

  public canActivateUltimate(): boolean {
    return this.active && this.ultActiveTimer <= 0 && this.ultCharge >= this.ultMaxCharge;
  }

  public canDash(): boolean {
    return this.active && this.dashCooldown <= 0 && this.dashActiveTimer <= 0;
  }

  public tryTriggerDash(dirX?: number, dirY?: number): boolean {
    if (!this.canDash()) return false;
    let dx = dirX ?? 0;
    let dy = dirY ?? 0;
    const len = Math.hypot(dx, dy);
    if (len > 0.01) {
      dx /= len;
      dy /= len;
    } else {
      dx = Math.cos(this.facingAngle);
      dy = Math.sin(this.facingAngle);
    }
    this.dashDirX = dx;
    this.dashDirY = dy;
    this.facingAngle = Math.atan2(dy, dx);
    this.dashActiveTimer = this.dashDuration;
    this.dashCooldown = this.dashMaxCooldown;
    this.invulnerabilityTimer = Math.max(this.invulnerabilityTimer, 0.25);
    return true;
  }

  public activateUltimate(): boolean {
    if (!this.canActivateUltimate()) return false;
    this.ultCharge = 0;
    this.ultActiveTimer = this.ultDuration;
    this.ultPulseTimer = 0;
    this.ultKillAccumulator = 0;
    if (this.characterId === 'ROOT') {
      this.invulnerabilityTimer = Math.max(this.invulnerabilityTimer, 0.8);
    } else if (this.characterId === 'PROXY') {
      this.shieldReady = true;
      this.shieldRechargeTimer = 0;
    }
    return true;
  }

  public triggerOverclockAdrenaline(): void {
    if (this.characterId === 'OVERCLOCK') {
      this.adrenalineTimer = 3.5;
    }
  }

  public takeDamage(amount: number): boolean {
    if (this.invulnerabilityTimer > 0 || !this.active) {
      this.lastHitOutcome = 'IGNORED';
      return false;
    }

    if (this.ultActiveTimer > 0 && this.characterId === 'ROOT') {
      this.lastHitOutcome = 'DODGED';
      return false;
    }

    if (this.characterId === 'PROXY' && this.shieldReady) {
      this.shieldReady = false;
      this.shieldRechargeTimer = this.shieldMaxCooldown;
      this.invulnerabilityTimer = 0.6;
      this.lastHitOutcome = 'SHIELD_BLOCKED';
      return false;
    }

    const effectiveDodge =
      this.ultActiveTimer > 0 && this.characterId === 'SPECTRE'
        ? Math.min(0.8, this.dodgeChance + 0.35)
        : this.dodgeChance;
    if (effectiveDodge > 0 && Math.random() < effectiveDodge) {
      this.invulnerabilityTimer = 0.35;
      this.lastHitOutcome = 'DODGED';
      return false;
    }

    const finalAmount =
      this.ultActiveTimer > 0 && this.characterId === 'PROXY'
        ? Math.max(1, Math.round(amount * 0.3))
        : amount;

    this.hp = Math.max(0, this.hp - finalAmount);
    this.invulnerabilityTimer = this.invulnerabilityDuration;
    this.lastHitOutcome = 'HIT';

    if (this.characterId === 'STANDARD') {
      this.surgePulsePending = true;
    }

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

    // Sombra táctica de contacto en el suelo PCB
    ctx.fillStyle = 'rgba(2, 6, 14, 0.52)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.size * 0.52, this.size * 0.52, this.size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Estela de fuego eléctrico de Agente ROOT
    if (this.rootTrailNodes.length > 0) {
      for (const node of this.rootTrailNodes) {
        const alpha = Math.max(0, node.life / node.maxLife);
        ctx.fillStyle = `rgba(59, 130, 246, ${0.26 * alpha})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(96, 165, 250, ${0.7 * alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Estela luminosa de movimiento
    for (let i = 0; i < this.motionTrail.length; i++) {
      const ghost = this.motionTrail[i];
      const scale = 0.5 + (i / Math.max(1, this.motionTrail.length)) * 0.35;
      const r = (this.size / 2) * scale;
      ctx.globalAlpha = ghost.alpha * 0.55;
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

    // Aura de Habilidad Ultimate activa (compartida con CoopRenderer)
    if (this.ultActiveTimer > 0) {
      Player.drawUltimateAura(ctx, this.x, this.y, this.characterId, this.ultActiveTimer, now);
    }

    // Aro sutil de telemetría alrededor del bot (y escudo Aegis para PROXY / Adrenalina para OVERCLOCK)
    if (this.characterId === 'PROXY' && this.shieldReady) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.92, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.adrenalineTimer > 0) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.88 + Math.sin(now * 0.02) * 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = accentColor;
      ctx.globalAlpha = 0.24;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.74 + Math.sin(now * 0.006) * 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (this.externalSpeedMultiplier < 0.9) {
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.82, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (this.speedBoostTimer > 0) {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.84, 0, Math.PI * 2);
      ctx.stroke();
    }

    Player.drawCyberChassis(
      ctx,
      this.x,
      this.y,
      this.size,
      bodyColor,
      accentColor,
      now,
      this.facingAngle,
      this.isMoving,
      this.equippedHat?.id ?? null,
      this.characterId
    );

    this.drawHealthBar(ctx);

    ctx.restore();
  }

  public static drawUltimateAura(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    characterId: CharacterId,
    ultTimer: number,
    nowMs: number
  ): void {
    if (ultTimer <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    const pulse = 0.78 + 0.22 * Math.sin(nowMs * 0.012);

    if (characterId === 'PROXY') {
      // Cúpula Aegis de 210px con malla hexagonal
      const r = 210;
      ctx.fillStyle = `rgba(168, 85, 247, ${0.13 * pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 2.6;
      ctx.setLineDash([14, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, r, (nowMs * 0.0012) % (Math.PI * 2), Math.PI * 2 + (nowMs * 0.0012) % (Math.PI * 2));
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (characterId === 'OVERCLOCK') {
      // Aura de fusión nuclear térmica (180px)
      const r = 180;
      ctx.fillStyle = `rgba(249, 115, 22, ${0.16 * pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.8;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, r, -(nowMs * 0.0025) % (Math.PI * 2), Math.PI * 2 - (nowMs * 0.0025) % (Math.PI * 2));
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const col =
        characterId === 'STANDARD'
          ? '#00ff66'
          : characterId === 'ROOT'
          ? '#38bdf8'
          : characterId === 'MORCILLITA'
          ? '#ec4899'
          : characterId === 'CRYPTO'
          ? '#fbbf24'
          : characterId === 'SPECTRE'
          ? '#22d3ee'
          : '#ef4444';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 34 + Math.sin(nowMs * 0.018) * 3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(nowMs * 0.004);
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /**
   * Dibuja los módulos de hardware exclusivos de cada clase detrás/flanqueando el chasis.
   */
  private static drawClassHardwareModules(
    ctx: CanvasRenderingContext2D,
    characterId: CharacterId,
    half: number,
    size: number,
    color: string,
    borderColor: string,
    timeMs: number
  ): void {
    const pulse = 0.72 + Math.sin(timeMs * 0.008) * 0.28;
    const lw = Math.max(1.1, size * 0.04);

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);

      if (characterId === 'STANDARD') {
        // Estabilizadores laterales tipo servidor con líneas de bus cian/verde
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(half * 0.78, -half * 0.56);
        ctx.lineTo(half * 1.32, -half * 0.34);
        ctx.lineTo(half * 1.24, half * 0.38);
        ctx.lineTo(half * 0.78, half * 0.54);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = borderColor;
        ctx.globalAlpha = 0.85 * pulse;
        ctx.fillRect(half * 0.94, -half * 0.2, half * 0.22, half * 0.4);
      } else if (characterId === 'ROOT') {
        // Alerones aerodinámicos overclock inclinados hacia arriba
        ctx.fillStyle = '#0c1938';
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(half * 0.72, -half * 0.25);
        ctx.lineTo(half * 1.48, -half * 0.78);
        ctx.lineTo(half * 1.32, half * 0.18);
        ctx.lineTo(half * 0.75, half * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(half * 0.95, -half * 0.3);
        ctx.lineTo(half * 1.28, -half * 0.54);
        ctx.stroke();
      } else if (characterId === 'PROXY') {
        // Hombreras pesadas Aegis de blindaje hexagonal + ribete escudo
        ctx.fillStyle = '#1e1035';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = lw * 1.15;
        ctx.beginPath();
        ctx.moveTo(half * 0.65, -half * 0.86);
        ctx.lineTo(half * 1.38, -half * 0.48);
        ctx.lineTo(half * 1.44, half * 0.36);
        ctx.lineTo(half * 0.92, half * 0.72);
        ctx.lineTo(half * 0.65, half * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.globalAlpha = 0.75 * pulse;
        ctx.fillRect(half * 1.04, -half * 0.22, half * 0.2, half * 0.48);
      } else if (characterId === 'MORCILLITA') {
        // Antenas/aletas de enlace simbiótico en los hombros
        ctx.fillStyle = '#2d0b22';
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(half * 0.74, -half * 0.45);
        ctx.lineTo(half * 1.28, -half * 0.65);
        ctx.lineTo(half * 1.18, half * 0.32);
        ctx.lineTo(half * 0.74, half * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(half * 1.22, -half * 0.58, Math.max(1.4, size * 0.065), 0, Math.PI * 2);
        ctx.fill();
      } else if (characterId === 'CRYPTO') {
        // Cápsulas radar ASIC doradas de recolección
        ctx.fillStyle = '#291704';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(half * 0.75, -half * 0.62);
        ctx.lineTo(half * 1.38, -half * 0.32);
        ctx.lineTo(half * 1.38, half * 0.32);
        ctx.lineTo(half * 0.75, half * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(half * 1.1, 0, Math.max(1.5, size * 0.065), 0, Math.PI * 2);
        ctx.fill();
      } else if (characterId === 'SPECTRE') {
        // Alas furtivas delta afiladas tipo Ghost Script
        ctx.fillStyle = '#041f2b';
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(half * 0.68, -half * 0.45);
        ctx.lineTo(half * 1.54, -half * 0.12);
        ctx.lineTo(half * 1.25, half * 0.62);
        ctx.lineTo(half * 0.72, half * 0.38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (characterId === 'OVERCLOCK') {
        // Turbinas laterales disipadoras con núcleos incandescentes
        ctx.fillStyle = '#241005';
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(half * 0.76, -half * 0.56);
        ctx.lineTo(half * 1.36, -half * 0.48);
        ctx.lineTo(half * 1.44, 0);
        ctx.lineTo(half * 1.36, half * 0.48);
        ctx.lineTo(half * 0.76, half * 0.56);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fde047';
        ctx.globalAlpha = pulse;
        ctx.fillRect(half * 0.96, -half * 0.28, half * 0.26, half * 0.16);
        ctx.fillRect(half * 0.96, half * 0.12, half * 0.26, half * 0.16);
      } else if (characterId === 'KERNEL_X') {
        // Cañones railgun pesados en hombros estilo Titán
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(half * 0.7, -half * 0.82);
        ctx.lineTo(half * 1.36, -half * 0.82);
        ctx.lineTo(half * 1.42, half * 0.48);
        ctx.lineTo(half * 0.75, half * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.fillRect(half * 0.9, -half * 0.72, half * 0.32, half * 0.48);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(half * 0.96, -half * 0.66, half * 0.2, half * 0.14);
      }

      ctx.restore();
    }
  }

  /**
   * Dibuja la silueta táctica cibernética detallada del Agente Antivirus
   * (compartida entre el combate y las vistas del Hangar en el menú).
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
    isMoving: boolean = false,
    hatId: string | null = null,
    characterId: CharacterId = 'STANDARD'
  ): void {
    const half = size / 2;
    const cut = half * 0.36;
    const lookX = Math.cos(facingAngle) * (half * 0.16);
    const lookY = Math.sin(facingAngle) * (half * 0.11);
    const pulse = 0.78 + Math.sin(timeMs * 0.008) * 0.22;

    ctx.save();
    ctx.translate(x, y);

    // 1. Halo energético sutil tras el chasis (reemplaza shadowBlur para máx. nitidez y FPS)
    ctx.fillStyle = borderColor;
    ctx.globalAlpha = 0.11;
    ctx.beginPath();
    ctx.arc(0, 0, half * 1.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 2. Propulsor dual de plasma al desplazarse
    if (isMoving) {
      const thrust = half * (1.05 + Math.sin(timeMs * 0.036) * 0.25);
      const backAngle = facingAngle + Math.PI;
      ctx.save();
      ctx.rotate(backAngle);
      ctx.fillStyle = borderColor;
      ctx.globalAlpha = 0.68;
      ctx.beginPath();
      ctx.moveTo(half * 0.44, -half * 0.32);
      ctx.lineTo(half * 0.44 + thrust, 0);
      ctx.lineTo(half * 0.44, half * 0.32);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(half * 0.46, -half * 0.15);
      ctx.lineTo(half * 0.46 + thrust * 0.62, 0);
      ctx.lineTo(half * 0.46, half * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 3. Estabilizadores / hombreras hardware exclusivos por personaje
    Player.drawClassHardwareModules(ctx, characterId, half, size, color, borderColor, timeMs);

    // 4. Faldón inferior metálico con toberas traseras
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = Math.max(1.1, size * 0.045);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * half * 0.22, half * 0.72);
      ctx.lineTo(side * half * 0.62, half * 0.72);
      ctx.lineTo(side * half * 0.54, half * 1.06);
      ctx.lineTo(side * half * 0.26, half * 1.06);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Punta luminosa de estabilizador
      ctx.fillStyle = borderColor;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(side * half * 0.32 - (side < 0 ? half * 0.18 : 0), half * 0.94, half * 0.18, Math.max(1.2, size * 0.045));
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0f172a';
    }

    // 5. Blindaje principal en casco poligonal cyber-mecha
    const traceArmorHex = () => {
      ctx.beginPath();
      ctx.moveTo(-half + cut * 1.1, -half * 0.98);
      ctx.lineTo(half - cut * 1.1, -half * 0.98);
      ctx.lineTo(half * 1.02, -half * 0.45);
      ctx.lineTo(half * 0.96, half * 0.48);
      ctx.lineTo(half - cut * 0.8, half * 0.92);
      ctx.lineTo(-half + cut * 0.8, half * 0.92);
      ctx.lineTo(-half * 0.96, half * 0.48);
      ctx.lineTo(-half * 1.02, -half * 0.45);
      ctx.closePath();
    };

    ctx.fillStyle = color;
    traceArmorHex();
    ctx.fill();

    // Sombreado tectónico en dos planos (inferior + laterales)
    ctx.fillStyle = 'rgba(2, 6, 23, 0.34)';
    ctx.beginPath();
    ctx.moveTo(-half * 0.96, half * 0.2);
    ctx.lineTo(-half * 0.4, half * 0.42);
    ctx.lineTo(half * 0.4, half * 0.42);
    ctx.lineTo(half * 0.96, half * 0.2);
    ctx.lineTo(half * 0.96, half * 0.48);
    ctx.lineTo(half - cut * 0.8, half * 0.92);
    ctx.lineTo(-half + cut * 0.8, half * 0.92);
    ctx.lineTo(-half * 0.96, half * 0.48);
    ctx.closePath();
    ctx.fill();

    // Placa metálica dorsal del pecho + líneas de circuito PCB
    ctx.fillStyle = 'rgba(15, 23, 42, 0.56)';
    ctx.beginPath();
    ctx.moveTo(-half * 0.62, half * 0.24);
    ctx.lineTo(half * 0.62, half * 0.24);
    ctx.lineTo(half * 0.46, half * 0.84);
    ctx.lineTo(-half * 0.46, half * 0.84);
    ctx.closePath();
    ctx.fill();

    // Brillo especular en arista superior de la cabeza
    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.beginPath();
    ctx.moveTo(-half + cut * 1.15, -half * 0.94);
    ctx.lineTo(half - cut * 1.15, -half * 0.94);
    ctx.lineTo(half * 0.72, -half * 0.72);
    ctx.lineTo(-half * 0.72, -half * 0.72);
    ctx.closePath();
    ctx.fill();

    // Contorno doble oscuro + neón
    ctx.strokeStyle = '#060a14';
    ctx.lineWidth = Math.max(1.6, size * 0.065);
    traceArmorHex();
    ctx.stroke();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.max(1.0, size * 0.038);
    traceArmorHex();
    ctx.stroke();

    // 6. Núcleo energético pectoral (Micro-CPU / Reactor)
    const coreY = half * 0.54;
    const coreR = Math.max(2.2, size * 0.11);
    ctx.fillStyle = '#040a16';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.max(0.9, size * 0.03);
    ctx.beginPath();
    ctx.moveTo(0, coreY - coreR);
    ctx.lineTo(coreR * 1.15, coreY);
    ctx.lineTo(0, coreY + coreR);
    ctx.lineTo(-coreR * 1.15, coreY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = borderColor;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(0, coreY, coreR * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, coreY, coreR * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 7. Visor táctico biselado con ojos cibernéticos simples (sin boca)
    const visorW = size * 0.72;
    const visorH = size * 0.37;
    const visorX = -visorW / 2;
    const visorY = -half * 0.56;
    const visorCut = Math.max(2.2, size * 0.09);

    ctx.fillStyle = '#040914';
    ctx.beginPath();
    ctx.moveTo(visorX + visorCut, visorY);
    ctx.lineTo(visorX + visorW - visorCut, visorY);
    ctx.lineTo(visorX + visorW, visorY + visorCut);
    ctx.lineTo(visorX + visorW, visorY + visorH - visorCut);
    ctx.lineTo(visorX + visorW - visorCut, visorY + visorH);
    ctx.lineTo(visorX + visorCut, visorY + visorH);
    ctx.lineTo(visorX, visorY + visorH - visorCut);
    ctx.lineTo(visorX, visorY + visorCut);
    ctx.closePath();
    ctx.fill();

    // Marco interior iluminado del visor
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = Math.max(0.9, size * 0.032);
    ctx.stroke();

    // Brillo diagonal cristalino en el visor
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(visorX + visorCut, visorY + 1);
    ctx.lineTo(visorX + visorW * 0.45, visorY + 1);
    ctx.lineTo(visorX + visorW * 0.25, visorY + visorH - 1);
    ctx.lineTo(visorX + visorCut, visorY + visorH - 1);
    ctx.closePath();
    ctx.fill();

    // Ojos simples redondeados con parpadeo y seguimiento sutil (sin boca)
    const blinkCycle = timeMs % 4200;
    const isBlinking = blinkCycle > 4060 && blinkCycle < 4160;
    const eyeRx = Math.max(1.7, size * 0.078);
    const eyeRy = isBlinking ? Math.max(0.8, size * 0.025) : Math.max(2.4, size * 0.115);
    const eyeOffsetX = half * 0.27;
    const eyeCenterY = visorY + visorH * 0.52 + lookY * 0.85;

    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    for (const side of [-1, 1]) {
      const ex = side * eyeOffsetX + lookX * 0.9;
      ctx.beginPath();
      ctx.ellipse(ex, eyeCenterY, eyeRx * 1.35, eyeRy * 1.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#f0f9ff';
    for (const side of [-1, 1]) {
      const ex = side * eyeOffsetX + lookX * 0.9;
      ctx.beginPath();
      ctx.ellipse(ex, eyeCenterY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!isBlinking && size >= 22) {
      ctx.fillStyle = '#ffffff';
      for (const side of [-1, 1]) {
        const ex = side * eyeOffsetX + lookX * 0.9 - eyeRx * 0.22;
        ctx.beginPath();
        ctx.arc(ex, eyeCenterY - eyeRy * 0.32, Math.max(0.75, size * 0.024), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Sombrero / Accesorio vectorial integrado directamente en el cuerpo o visor
    if (hatId) {
      HatRenderer.drawHatOnCharacter(ctx, hatId, x, y, size, facingAngle, timeMs);
    }
  }

  private drawHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 40;
    const barHeight = 5;
    const x = this.x - barWidth / 2;
    const y = this.y + this.size / 2 + 10;
    const hpRatio = Math.max(0, this.hp / this.maxHp);

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(9, 14, 26, 0.9)';
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(x, y, barWidth * hpRatio, barHeight);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);
  }
}
