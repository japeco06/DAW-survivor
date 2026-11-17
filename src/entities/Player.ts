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

    const len = Math.hypot(dirX, dirY);
    const nx = len > 1 ? dirX / len : dirX;
    const ny = len > 1 ? dirY / len : dirY;
    const adrenalineSpeedMult = this.adrenalineTimer > 0 ? 1.25 : 1.0;
    const effectiveSpeed = Math.min(540, this.speed * adrenalineSpeedMult);
    this.isMoving = nx !== 0 || ny !== 0;

    if (this.isMoving) {
      this.facingAngle = Math.atan2(ny, nx);
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

    this.x += nx * effectiveSpeed * dt;
    this.y += ny * effectiveSpeed * dt;

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
      this.equippedHat?.id ?? null,
      this.characterId
    );

    this.drawHealthBar(ctx);

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
