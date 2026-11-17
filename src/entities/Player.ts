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
  private regenAccumulator: number = 0;

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
      this.characterId = profile.id;
      this.maxHp = Math.round(baseHp * profile.hpMultiplier);
      this.hp = this.maxHp;
      this.pickupRadius = Math.round(basePickupRadius * profile.pickupRadiusMultiplier);
      this.borderColor = profile.borderColor;
      this.profileName = profile.name;
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

    if (this.passiveRegenPerSec > 0 && this.active && this.hp < this.maxHp) {
      this.regenAccumulator += this.passiveRegenPerSec * dt;
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

    const dir = input.getDirection();
    const adrenalineSpeedMult = this.adrenalineTimer > 0 ? 1.25 : 1.0;
    const effectiveSpeed = Math.min(540, this.speed * adrenalineSpeedMult);
    this.isMoving = dir.x !== 0 || dir.y !== 0;

    if (this.isMoving) {
      this.facingAngle = Math.atan2(dir.y, dir.x);
      if (!lightGraphics) {
        this.trailTimer += dt;
        if (this.trailTimer >= 0.032) {
          this.trailTimer = 0;
          this.motionTrail.push({ x: this.x, y: this.y, alpha: 0.42 });
          if (this.motionTrail.length > 6) {
            this.motionTrail.shift();
          }
        }
      } else if (this.motionTrail.length > 0) {
        this.motionTrail = [];
      }

      if (this.characterId === 'ROOT') {
        this.rootTrailSpawnTimer += dt;
        if (this.rootTrailSpawnTimer >= 0.22) {
          this.rootTrailSpawnTimer = 0;
          this.rootTrailNodes.push({
            x: this.x,
            y: this.y,
            life: 2.2,
            maxLife: 2.2,
            radius: 26,
          });
          if (this.rootTrailNodes.length > 14) {
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

    this.x += dir.x * effectiveSpeed * dt;
    this.y += dir.y * effectiveSpeed * dt;

    if (!unbounded) {
      const halfSize = this.size / 2;
      this.x = Math.max(halfSize, Math.min(canvasWidth - halfSize, this.x));
      this.y = Math.max(halfSize, Math.min(canvasHeight - halfSize, this.y));
    }
  }

  public getEffectiveFireRateMultiplier(): number {
    return this.adrenalineTimer > 0 ? this.fireRateMultiplier * 1.45 : this.fireRateMultiplier;
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

    if (this.characterId === 'PROXY' && this.shieldReady) {
      this.shieldReady = false;
      this.shieldRechargeTimer = this.shieldMaxCooldown;
      this.invulnerabilityTimer = 0.6;
      this.lastHitOutcome = 'SHIELD_BLOCKED';
      return false;
    }

    if (this.dodgeChance > 0 && Math.random() < this.dodgeChance) {
      this.invulnerabilityTimer = 0.35;
      this.lastHitOutcome = 'DODGED';
      return false;
    }

    this.hp = Math.max(0, this.hp - amount);
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
      this.equippedHat?.id ?? null
    );

    this.drawHealthBar(ctx);

    ctx.restore();
  }

  /**
   * Dibuja la silueta táctica informática del Agente Antivirus (compartida con el Hangar del menú).
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
    hatId: string | null = null
  ): void {
    const half = size / 2;
    const cut = half * 0.38;
    const lookX = Math.cos(facingAngle) * (half * 0.16);
    const lookY = Math.sin(facingAngle) * (half * 0.12);

    ctx.save();
    ctx.translate(x, y);

    // Propulsor de plasma en dirección contraria al movimiento
    if (isMoving) {
      const thrust = half * (0.95 + Math.sin(timeMs * 0.032) * 0.22);
      const backAngle = facingAngle + Math.PI;
      ctx.save();
      ctx.rotate(backAngle);
      ctx.fillStyle = borderColor;
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      ctx.moveTo(half * 0.42, -half * 0.26);
      ctx.lineTo(half * 0.42 + thrust, 0);
      ctx.lineTo(half * 0.42, half * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Disipadores / hombreras metálicas tácticas (Hardware Heatsink)
    const finSpread = half + Math.max(3, size * 0.14);
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.2, size * 0.045);

    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * finSpread, -half * 0.28);
      ctx.lineTo(side * (half - 1), -half * 0.56);
      ctx.lineTo(side * (half - 1), half * 0.56);
      ctx.lineTo(side * finSpread, half * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pines de circuito en los laterales
      ctx.fillStyle = borderColor;
      ctx.fillRect(side * (finSpread - 2.5) - (side < 0 ? 1 : 0), -half * 0.12, 2, half * 0.24);
      ctx.fillStyle = '#1e293b';
    }

    // Carcasa principal octogonal con sombreado 2.5D limpio
    ctx.fillStyle = color;
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 12;

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

    // Bisel inferior sutil para sensación de volumen sólido
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.24)';
    ctx.beginPath();
    ctx.moveTo(-half, half * 0.1);
    ctx.lineTo(half, half * 0.1);
    ctx.lineTo(half, half - cut);
    ctx.lineTo(half - cut, half);
    ctx.lineTo(-half + cut, half);
    ctx.lineTo(-half, half - cut);
    ctx.closePath();
    ctx.fill();

    // Brillo superior especular
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(-half + cut + 1, -half + 2, size - cut * 2 - 2, Math.max(2, size * 0.08));

    // Contorno táctico limpio
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = Math.max(1.5, size * 0.06);
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
    ctx.stroke();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.max(1.1, size * 0.04);
    ctx.stroke();

    // Pantalla / Visor táctico recesado (esquinas suaves, sin boca inferior)
    const visorW = size * 0.66;
    const visorH = size * 0.44;
    const visorX = -visorW / 2;
    const visorY = -half * 0.44;
    const visorR = Math.max(3, size * 0.14);

    ctx.fillStyle = '#060d18';
    ctx.beginPath();
    ctx.moveTo(visorX + visorR, visorY);
    ctx.lineTo(visorX + visorW - visorR, visorY);
    ctx.quadraticCurveTo(visorX + visorW, visorY, visorX + visorW, visorY + visorR);
    ctx.lineTo(visorX + visorW, visorY + visorH - visorR);
    ctx.quadraticCurveTo(visorX + visorW, visorY + visorH, visorX + visorW - visorR, visorY + visorH);
    ctx.lineTo(visorX + visorR, visorY + visorH);
    ctx.quadraticCurveTo(visorX, visorY + visorH, visorX, visorY + visorH - visorR);
    ctx.lineTo(visorX, visorY + visorR);
    ctx.quadraticCurveTo(visorX, visorY, visorX + visorR, visorY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.stroke();

    // Ojos simples redondeados (óvalo vertical limpio, sin boca)
    const blinkCycle = timeMs % 4200;
    const isBlinking = blinkCycle > 4060 && blinkCycle < 4160;
    const eyeRx = Math.max(1.8, size * 0.082);
    const eyeRy = isBlinking ? Math.max(0.8, size * 0.025) : Math.max(2.6, size * 0.125);
    const eyeOffsetX = half * 0.27;
    const eyeCenterY = visorY + visorH * 0.5 + lookY * 0.85;

    ctx.fillStyle = '#f0f9ff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = Math.max(3, size * 0.14);
    for (const side of [-1, 1]) {
      const ex = side * eyeOffsetX + lookX * 0.9;
      ctx.beginPath();
      ctx.ellipse(ex, eyeCenterY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Micro-destello superior en cada ojo cuando no parpadea
    if (!isBlinking && size >= 24) {
      ctx.fillStyle = '#ffffff';
      for (const side of [-1, 1]) {
        const ex = side * eyeOffsetX + lookX * 0.9 - eyeRx * 0.22;
        ctx.beginPath();
        ctx.arc(ex, eyeCenterY - eyeRy * 0.35, Math.max(0.8, size * 0.025), 0, Math.PI * 2);
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
