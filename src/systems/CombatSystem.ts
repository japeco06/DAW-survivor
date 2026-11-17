import { Entity } from '../entities/Entity';
import { Player } from '../entities/Player';
import { Adware, MalwareType } from '../entities/Adware';
import { Evasor } from '../entities/Evasor';
import { TrojanShooter, EnemyProjectile } from '../entities/TrojanShooter';
import { Projectile } from '../entities/Projectile';
import { PingProjectile } from '../entities/PingProjectile';
import { QuarantineZone } from '../entities/QuarantineZone';

export interface DestroyedEnemyInfo {
  x: number;
  y: number;
  xpValue: number;
  color: string;
  malwareType: MalwareType;
  enemyRef: Adware;
}

export interface DamagedEnemyInfo {
  x: number;
  y: number;
  damage: number;
  color: string;
  isCrit?: boolean;
}

export interface CombatEvents {
  enemiesKilled: number;
  destroyedEnemies: DestroyedEnemyInfo[];
  damagedEnemies: DamagedEnemyInfo[];
  playerHit: boolean;
  shotsFired: number;
  homingShotsFired: number;
  vampirismHeals: number;
  droneExploded?: boolean;
  shieldBlocked?: boolean;
  dodgedHit?: boolean;
  surgeTriggered?: boolean;
}

export interface ReactiveDroneSlot {
  durability: number; // 3 = verde, 2 = amarillo, 1 = rojo, 0 = destruido (en cooldown)
  respawnTimer: number; // 10 segundos para reaparecer tras explotar
}

export class DroneExplosionWave {
  public x: number;
  public y: number;
  public radius: number = 12;
  public maxRadius: number = 115;
  public active: boolean = true;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  public update(dt: number): void {
    this.radius += 380 * dt;
    if (this.radius >= this.maxRadius) {
      this.active = false;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.max(0.1, 1 - this.radius / this.maxRadius);
    ctx.save();
    ctx.fillStyle = `rgba(255, 30, 66, ${alpha * 0.22})`;
    ctx.strokeStyle = `rgba(255, 30, 66, ${alpha * 0.35})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }
}

export class FirewallPulseRing {
  public x: number;
  public y: number;
  public radius: number = 18;
  public maxRadius: number;
  public damage: number;
  public isEvolved: boolean;
  public active: boolean = true;
  private expansionSpeed: number = 340;
  private hitEnemies: Set<Adware> = new Set();

  constructor(
    x: number,
    y: number,
    maxRadius: number,
    damage: number,
    isEvolved: boolean = false
  ) {
    this.x = x;
    this.y = y;
    this.maxRadius = maxRadius;
    this.damage = damage;
    this.isEvolved = isEvolved;
    if (isEvolved) {
      this.expansionSpeed = 460;
    }
  }

  public update(
    dt: number,
    player: Player,
    enemies: Adware[]
  ): { enemy: Adware; damage: number }[] {
    this.x = player.x;
    this.y = player.y;
    this.radius += this.expansionSpeed * dt;

    const hits: { enemy: Adware; damage: number }[] = [];
    for (const enemy of enemies) {
      if (!enemy.active || this.hitEnemies.has(enemy)) continue;
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist <= this.radius + enemy.size * 0.5) {
        this.hitEnemies.add(enemy);
        hits.push({ enemy, damage: this.damage });
      }
    }

    if (this.radius >= this.maxRadius) {
      this.active = false;
    }

    return hits;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const progress = Math.min(1, this.radius / this.maxRadius);
    const alpha = Math.max(0.1, 1 - progress * 0.75);

    ctx.save();
    ctx.fillStyle = this.isEvolved
      ? `rgba(250, 204, 21, ${alpha * 0.2})`
      : `rgba(255, 115, 0, ${alpha * 0.16})`;
    ctx.strokeStyle = this.isEvolved
      ? `rgba(250, 204, 21, ${alpha * 0.5})`
      : `rgba(255, 102, 0, ${alpha * 0.35})`;
    ctx.lineWidth = this.isEvolved ? 12 : 9;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = this.isEvolved
      ? `rgba(249, 115, 22, ${alpha})`
      : `rgba(255, 136, 0, ${alpha})`;
    ctx.lineWidth = 4.5;
    ctx.stroke();

    ctx.strokeStyle = `rgba(254, 240, 138, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(4, this.radius - 5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export class SqlInjectionBeam {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public angle: number;
  public thickness: number;
  public length: number = 68;
  public damage: number;
  public isEvolved: boolean;
  public active: boolean = true;
  private lifeTime: number = 2.4;
  private hitEnemies: Set<Adware> = new Set();

  constructor(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    thickness: number,
    isEvolved: boolean = false
  ) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.thickness = thickness;
    this.isEvolved = isEvolved;
    this.length = isEvolved ? 114 : 84;
  }

  public update(
    dt: number,
    enemies: Adware[],
    canvasWidth: number,
    canvasHeight: number,
    viewOriginX: number = 0,
    viewOriginY: number = 0
  ): { enemy: Adware; damage: number; blocked: boolean }[] {
    this.lifeTime -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const margin = 120;
    if (
      this.lifeTime <= 0 ||
      this.x < viewOriginX - margin ||
      this.x > viewOriginX + canvasWidth + margin ||
      this.y < viewOriginY - margin ||
      this.y > viewOriginY + canvasHeight + margin
    ) {
      this.active = false;
      return [];
    }

    const hits: { enemy: Adware; damage: number; blocked: boolean }[] = [];
    const hitRadius = this.thickness * 0.55;

    for (const enemy of enemies) {
      if (!enemy.active || this.hitEnemies.has(enemy)) continue;
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist <= hitRadius + enemy.size * 0.5) {
        this.hitEnemies.add(enemy);
        const sourceX = this.x - this.vx * 0.04;
        const sourceY = this.y - this.vy * 0.04;
        if (enemy.isHitBlockedByShield(sourceX, sourceY)) {
          hits.push({ enemy, damage: 0, blocked: true });
        } else {
          hits.push({ enemy, damage: this.damage, blocked: false });
        }
      }
    }

    return hits;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const halfL = this.length * 0.5;
    const halfT = this.thickness * 0.65;

    // Aura exterior ionizada del rayo railgun
    ctx.fillStyle = this.isEvolved
      ? 'rgba(251, 191, 36, 0.32)'
      : 'rgba(217, 70, 239, 0.28)';
    ctx.beginPath();
    ctx.ellipse(-4, 0, halfL + 16, halfT + 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Estelas laterales paralelas de aceleración electromagnética
    ctx.strokeStyle = this.isEvolved ? '#fde047' : '#e879f9';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.15, -(halfT + 4.5));
    ctx.lineTo(-halfL * 0.85, -(halfT + 2.5));
    ctx.moveTo(halfL * 0.15, halfT + 4.5);
    ctx.lineTo(-halfL * 0.85, halfT + 2.5);
    ctx.stroke();

    // Haz principal grueso en lanza balística de plasma
    ctx.fillStyle = this.isEvolved ? '#f43f5e' : '#a855f7';
    ctx.strokeStyle = this.isEvolved ? '#fef08a' : '#f5d0fe';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(halfL + 10, 0);
    ctx.lineTo(halfL * 0.35, -halfT * 1.12);
    ctx.lineTo(-halfL * 0.95, -halfT * 0.72);
    ctx.lineTo(-halfL * 0.65, 0);
    ctx.lineTo(-halfL * 0.95, halfT * 0.72);
    ctx.lineTo(halfL * 0.35, halfT * 1.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Núcleo energético incandescente y arco eléctrico axial
    ctx.fillStyle = this.isEvolved ? '#fef08a' : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(halfL + 4, 0);
    ctx.lineTo(halfL * 0.1, -halfT * 0.48);
    ctx.lineTo(-halfL * 0.65, 0);
    ctx.lineTo(halfL * 0.1, halfT * 0.48);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

interface TeslaArcVisual {
  points: { x: number; y: number }[];
  life: number;
  maxLife: number;
  color: string;
}

interface CryoRingVisual {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export class CryoShardProjectile extends Entity {
  public vx: number;
  public vy: number;
  public damage: number;
  public aoeRadius: number;
  public isEvolved: boolean;
  private lifeTime: number = 2.0;
  private trail: { x: number; y: number }[] = [];

  constructor(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    aoeRadius: number,
    isEvolved: boolean
  ) {
    super(x, y, isEvolved ? 15 : 12, speed, isEvolved ? '#67e8f9' : '#38bdf8');
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.aoeRadius = aoeRadius;
    this.isEvolved = isEvolved;
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

    const margin = 90;
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
    const s = this.size * 0.92;

    ctx.save();

    // Estela helada cristalina
    if (this.trail.length > 0) {
      ctx.lineCap = 'round';
      for (let i = 0; i < this.trail.length; i++) {
        const p0 = this.trail[i];
        const p1 = i === this.trail.length - 1 ? { x: this.x, y: this.y } : this.trail[i + 1];
        const ratio = (i + 1) / (this.trail.length + 1);
        ctx.strokeStyle = this.isEvolved
          ? `rgba(165, 243, 252, ${0.46 * ratio})`
          : `rgba(56, 189, 248, ${0.38 * ratio})`;
        ctx.lineWidth = s * 0.85 * ratio;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    // Aura criogénica envolvente
    ctx.fillStyle = this.isEvolved ? 'rgba(103, 232, 249, 0.28)' : 'rgba(56, 189, 248, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.55, s * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();

    // Espolones laterales de cristal de nitrógeno
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.3);
    ctx.lineTo(-s * 0.55, -s * 1.05);
    ctx.lineTo(-s * 0.72, -s * 0.2);
    ctx.moveTo(0, s * 0.3);
    ctx.lineTo(-s * 0.55, s * 1.05);
    ctx.lineTo(-s * 0.72, s * 0.2);
    ctx.fill();

    // Cristal prismático principal en dos tonos (facetado 3D)
    ctx.fillStyle = this.isEvolved ? '#a5f3fc' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(s * 1.55, 0);
    ctx.lineTo(-s * 0.1, -s * 0.72);
    ctx.lineTo(-s * 1.1, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.moveTo(s * 1.55, 0);
    ctx.lineTo(-s * 0.1, s * 0.72);
    ctx.lineTo(-s * 1.1, 0);
    ctx.closePath();
    ctx.fill();

    // Arista cristalina y núcleo glacial brillante
    ctx.strokeStyle = this.isEvolved ? '#fef08a' : '#e0f2fe';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s * 1.55, 0);
    ctx.lineTo(-s * 0.1, -s * 0.72);
    ctx.lineTo(-s * 1.1, 0);
    ctx.lineTo(-s * 0.1, s * 0.72);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(s * 0.95, 0);
    ctx.lineTo(0, -s * 0.28);
    ctx.lineTo(-s * 0.55, 0);
    ctx.lineTo(0, s * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

export class SawDiscProjectile extends Entity {
  public damage: number;
  public isEvolved: boolean;
  private dirX: number;
  private dirY: number;
  private elapsed: number = 0;
  private readonly maxDuration: number;
  private spinAngle: number = 0;
  private hitTimers: WeakMap<Adware, number> = new WeakMap();

  constructor(
    x: number,
    y: number,
    angle: number,
    damage: number,
    isEvolved: boolean
  ) {
    super(x, y, isEvolved ? 34 : 24, isEvolved ? 520 : 410, isEvolved ? '#fbbf24' : '#fb923c');
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
    this.damage = damage;
    this.isEvolved = isEvolved;
    this.maxDuration = isEvolved ? 2.1 : 1.65;
  }

  public update(_dt: number): void {}

  public updateDisc(dt: number, player: Player, enemies: Adware[]): Adware[] {
    this.elapsed += dt;
    this.spinAngle += dt * (this.isEvolved ? 20 : 14);
    if (this.elapsed >= this.maxDuration) {
      this.active = false;
      return [];
    }

    const halfLife = this.maxDuration * 0.5;
    if (this.elapsed < halfLife) {
      const progress = this.elapsed / halfLife;
      const curSpeed = this.speed * (1 - progress * 0.55);
      this.x += this.dirX * curSpeed * dt;
      this.y += this.dirY * curSpeed * dt;
    } else {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const returnSpd = this.speed * 1.15;
      this.x += (dx / dist) * returnSpd * dt;
      this.y += (dy / dist) * returnSpd * dt;
      if (dist <= 20 && this.elapsed > halfLife + 0.15) {
        this.active = false;
      }
    }

    const hits: Adware[] = [];
    const hitR = this.size * 0.55;
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const cd = (this.hitTimers.get(enemy) ?? 0) - dt;
      if (cd > 0) {
        this.hitTimers.set(enemy, cd);
        continue;
      }
      if (Math.hypot(enemy.x - this.x, enemy.y - this.y) <= hitR + enemy.size * 0.45) {
        this.hitTimers.set(enemy, 0.24);
        hits.push(enemy);
      }
    }
    return hits;
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);

    const r = this.size * 0.58;

    // Aura de giro plasma (desenfoque de velocidad)
    ctx.strokeStyle = this.isEvolved ? 'rgba(251, 191, 36, 0.45)' : 'rgba(251, 146, 60, 0.38)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, this.spinAngle, this.spinAngle + Math.PI * 0.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, this.spinAngle + Math.PI, this.spinAngle + Math.PI * 1.75);
    ctx.stroke();

    ctx.rotate(this.spinAngle);

    // 10 dientes curvos afilados tipo sierra cibernética de titanio
    ctx.fillStyle = this.isEvolved ? '#fef08a' : '#e2e8f0';
    ctx.strokeStyle = this.isEvolved ? '#f59e0b' : '#f97316';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const teeth = 10;
    for (let i = 0; i < teeth; i++) {
      const a0 = (i * Math.PI * 2) / teeth;
      const aTip = a0 + 0.24;
      const aRoot = ((i + 1) * Math.PI * 2) / teeth;
      const x0 = Math.cos(a0) * (r * 0.68);
      const y0 = Math.sin(a0) * (r * 0.68);
      const xTip = Math.cos(aTip) * (r * 1.06);
      const yTip = Math.sin(aTip) * (r * 1.06);
      const xRoot = Math.cos(aRoot) * (r * 0.68);
      const yRoot = Math.sin(aRoot) * (r * 0.68);
      if (i === 0) ctx.moveTo(x0, y0);
      else ctx.lineTo(x0, y0);
      ctx.lineTo(xTip, yTip);
      ctx.lineTo(xRoot, yRoot);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Disco blindado interior con 3 radios giratorios
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = this.isEvolved ? '#fbbf24' : '#fb923c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const sa = (k * Math.PI * 2) / 3;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(sa) * (r * 0.52), Math.sin(sa) * (r * 0.52));
    }
    ctx.stroke();

    // Núcleo reactor incandescente
    ctx.fillStyle = this.isEvolved ? '#fbbf24' : '#fb923c';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.11, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

/**
 * Sistema de Combate Multi-Arma (v0.2.0).
 * Gestiona:
 * 1. Arma Base: 'Ráfaga de Firewall' (Disparo recto).
 * 2. Arma 2: 'Ping Tracker' (Proyectil azul perseguidor / homing).
 * 3. Arma 3: 'Zona de Cuarentena' (Área estática en el suelo con daño continuo DoT).
 * 4. Nodos del Firewall Orbital.
 */
export class CombatSystem {
  // 1. Arma Base: Ráfaga de Firewall (Disparo recto -> Cañón Hex-Core)
  private fireTimer: number = 0;
  public fireCooldown: number = 0.42;
  public attackRange: number = 480;
  public projectileSpeed: number = 560;
  public projectileDamage: number = 25;
  public multiShotCount: number = 1;
  public evolvedBasic: boolean = false;

  // 2. Arma: Ping Tracker (-> Enjambre Satélite DDoS)
  public pingTrackerLevel: number = 0;
  private pingTimer: number = 0;
  public pingCooldown: number = 0.95;
  public pingDamage: number = 24;
  public pingSpeed: number = 430;
  public evolvedPing: boolean = false;

  // 3. Arma: Zona de Cuarentena (-> Reactor de Purga Nuclear)
  public quarantineLevel: number = 0;
  private quarantineTimer: number = 0;
  public quarantineCooldown: number = 3.6;
  public quarantineRadius: number = 82;
  public quarantineDamage: number = 14;
  public quarantineDuration: number = 4.6;
  public evolvedQuarantine: boolean = false;

  // 4. Arma Orbital: Drones Antivirus (-> Centinelas Omega)
  public dronesLevel: number = 0;
  public firewallCount: number = 0;
  public firewallRadius: number = 78;
  public firewallDamage: number = 18;
  public firewallOrbitSpeed: number = 3.4;
  private firewallAngle: number = 0;
  private firewallHitCooldowns: WeakMap<Adware, number> = new WeakMap();
  public droneSlots: ReactiveDroneSlot[] = [];
  public droneExplosions: DroneExplosionWave[] = [];
  public evolvedDrones: boolean = false;

  // 5. Arma: Cortafuegos (-> Tormenta Solar Firewall)
  public firewallPulseLevel: number = 0;
  private firewallPulseTimer: number = 0;
  public firewallPulseCooldown: number = 3.2;
  public firewallPulseDamage: number = 32;
  public firewallPulseMaxRadius: number = 175;
  public firewallPulses: FirewallPulseRing[] = [];
  public evolvedFirewallPulse: boolean = false;

  // 6. Arma: Rayo SQL Injection (-> Láser Zero-Day)
  public sqlBeamLevel: number = 0;
  private sqlBeamTimer: number = 0;
  public sqlBeamCooldown: number = 2.5;
  public sqlBeamDamage: number = 38;
  public sqlBeamThickness: number = 18;
  public sqlBeamSpeed: number = 720;
  public sqlBeams: SqlInjectionBeam[] = [];
  public evolvedSqlBeam: boolean = false;

  // 7. Nueva Arma: Bobina Tesla EMP (-> Tormenta de Arco Voltaico)
  public teslaLevel: number = 0;
  private teslaTimer: number = 0;
  public teslaCooldown: number = 1.85;
  public teslaDamage: number = 28;
  public evolvedTesla: boolean = false;
  public teslaArcs: TeslaArcVisual[] = [];

  // 8. Nueva Arma: Fragmento Criogénico (-> Cero Absoluto)
  public cryoLevel: number = 0;
  private cryoTimer: number = 0;
  public cryoCooldown: number = 1.65;
  public cryoDamage: number = 26;
  public cryoAoeRadius: number = 78;
  public evolvedCryo: boolean = false;
  public cryoShards: CryoShardProjectile[] = [];
  private cryoRings: CryoRingVisual[] = [];

  // 9. Nueva Arma: Disco Kernel Rotativo (-> Sierras Phantom)
  public sawLevel: number = 0;
  private sawTimer: number = 0;
  public sawCooldown: number = 2.1;
  public sawDamage: number = 30;
  public evolvedSaw: boolean = false;
  public sawDiscs: SawDiscProjectile[] = [];

  // 10. Proyectiles enemigos y cooldowns internos
  public enemyProjectiles: EnemyProjectile[] = [];
  private vampirismCooldown: number = 0;
  private rootTrailHitCooldowns: WeakMap<Adware, number> = new WeakMap();

  // 11. Estadísticas de Daño por Arma y Bajas
  public weaponDamageStats: Record<string, number> = {
    'Ráfaga Firewall': 0,
    'Ping Tracker': 0,
    'Zona Cuarentena': 0,
    'Cortafuegos': 0,
    'Rayo SQL': 0,
    'Drones Antivirus': 0,
    'Bobina Tesla': 0,
    'Crio-Shard': 0,
    'Disco Kernel': 0,
    'Mascota Morcillita': 0,
  };

  public killsByTypeStats: Record<string, number> = {
    'Adware': 0,
    'Trojan': 0,
    'Worm': 0,
    'Evasor': 0,
    'Hardware Box': 0,
    'Mega-Jefes': 0,
    'Otros': 0,
  };

  public resetStats(): void {
    this.weaponDamageStats = {
      'Ráfaga Firewall': 0,
      'Ping Tracker': 0,
      'Zona Cuarentena': 0,
      'Cortafuegos': 0,
      'Rayo SQL': 0,
      'Drones Antivirus': 0,
      'Bobina Tesla': 0,
      'Crio-Shard': 0,
      'Disco Kernel': 0,
      'Mascota Morcillita': 0,
    };
    this.killsByTypeStats = {
      'Adware': 0,
      'Trojan': 0,
      'Worm': 0,
      'Evasor': 0,
      'Hardware Box': 0,
      'Mega-Jefes': 0,
      'Otros': 0,
    };
  }

  public recordCompanionDamage(amount: number): void {
    this.weaponDamageStats['Mascota Morcillita'] += amount;
  }

  public update(
    dt: number,
    player: Player,
    enemies: Adware[],
    projectiles: Projectile[],
    pingProjectiles: PingProjectile[],
    quarantineZones: QuarantineZone[],
    canvasWidth: number = 1920,
    canvasHeight: number = 1080,
    viewOriginX: number = 0,
    viewOriginY: number = 0
  ): CombatEvents {
    this.fireTimer += dt;
    this.pingTimer += dt;
    this.quarantineTimer += dt;
    this.firewallPulseTimer += dt;
    this.sqlBeamTimer += dt;
    this.teslaTimer += dt;
    this.cryoTimer += dt;
    this.sawTimer += dt;
    this.firewallAngle += dt * (this.evolvedDrones ? this.firewallOrbitSpeed * 1.55 : this.firewallOrbitSpeed);

    const destroyedEnemies: DestroyedEnemyInfo[] = [];
    const damagedEnemies: DamagedEnemyInfo[] = [];
    let enemiesKilled = 0;
    let playerHit = false;
    let shotsFired = 0;
    let homingShotsFired = 0;
    let vampirismHeals = 0;
    let droneExploded = false;
    let shieldBlocked = false;
    let dodgedHit = false;
    let surgeTriggered = false;

    this.vampirismCooldown = Math.max(0, this.vampirismCooldown - dt);
    const tryTriggerVampirism = () => {
      if (this.vampirismCooldown <= 0 && player.vampirismChance > 0 && Math.random() < player.vampirismChance) {
        this.vampirismCooldown = 0.12;
        const healAmount = Math.max(2, player.vampirismHealAmount);
        const prevHp = player.hp;
        player.heal(healAmount);
        const restored = player.hp - prevHp;
        if (restored > 0) {
          vampirismHeals += restored;
        }
      }
    };

    const registerEnemyKillIfDead = (enemy: Adware) => {
      if (!enemy.active) {
        enemiesKilled++;
        destroyedEnemies.push({
          x: enemy.x,
          y: enemy.y,
          xpValue: enemy.xpValue,
          color: enemy.color,
          malwareType: enemy.malwareType,
          enemyRef: enemy,
        });

        if (enemy.malwareType === 'ADWARE') this.killsByTypeStats['Adware']++;
        else if (enemy.malwareType === 'TROJAN' || enemy.malwareType === 'TROJAN_SHOOTER')
          this.killsByTypeStats['Trojan']++;
        else if (enemy.malwareType === 'WORM' || enemy.malwareType === 'ARMORED_WORM')
          this.killsByTypeStats['Worm']++;
        else if (enemy.malwareType === 'EVASOR') this.killsByTypeStats['Evasor']++;
        else if (enemy.malwareType === 'HARDWARE_BOX') this.killsByTypeStats['Hardware Box']++;
        else if (enemy.malwareType === 'RANSOMWARE' || enemy.malwareType === 'FINAL_BOSS')
          this.killsByTypeStats['Mega-Jefes']++;
        else this.killsByTypeStats['Otros']++;
      }
    };

    const computeBaseScaledDamage = (baseDamage: number): number => {
      return Math.round(baseDamage * player.damageMultiplier);
    };

    const rollCritHit = (scaledDamage: number): { dmg: number; isCrit: boolean } => {
      const isCrit = Math.random() < player.critChance;
      return {
        dmg: isCrit ? scaledDamage * 2 : scaledDamage,
        isCrit,
      };
    };

    const effectiveRof = Math.max(0.5, player.getEffectiveFireRateMultiplier());
    const effectiveFireCooldown = (this.evolvedBasic ? this.fireCooldown * 0.78 : this.fireCooldown) / effectiveRof;
    const effectivePingCooldown = (this.evolvedPing ? this.pingCooldown * 0.72 : this.pingCooldown) / effectiveRof;

    // --- ARMA 1: Ráfaga de Firewall (-> Cañón Hex-Core) ---
    if (!player.isSummoner && player.active && this.fireTimer >= effectiveFireCooldown) {
      const shotCount = this.evolvedBasic ? Math.max(5, this.multiShotCount + 1) : this.multiShotCount;
      const targets = this.findNearestEnemies(player, enemies, shotCount);
      if (targets.length > 0) {
        this.fireTimer = 0;
        shotsFired++;

        for (let i = 0; i < shotCount; i++) {
          const target = targets[i % targets.length];
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const baseAngle = Math.atan2(dy, dx);

          const spreadIndex = Math.floor(i / targets.length);
          const spreadOffset =
            targets.length < shotCount
              ? (i - (shotCount - 1) / 2) * 0.12
              : spreadIndex * 0.1;

          const finalAngle = baseAngle + spreadOffset;
          const baseDmg = computeBaseScaledDamage(
            this.evolvedBasic ? Math.round(this.projectileDamage * 1.4) : this.projectileDamage
          );

          projectiles.push(
            new Projectile(
              player.x,
              player.y,
              Math.cos(finalAngle),
              Math.sin(finalAngle),
              this.evolvedBasic ? this.projectileSpeed * 1.35 : this.projectileSpeed,
              baseDmg,
              this.evolvedBasic ? 3 : 0,
              this.evolvedBasic
            )
          );
        }
      }
    }

    // --- ARMA 2: Ping Tracker (-> Enjambre DDoS) ---
    if (player.active && this.pingTrackerLevel > 0 && this.pingTimer >= effectivePingCooldown) {
      const activeEnemies = enemies.filter((e) => e.active);
      if (activeEnemies.length > 0) {
        this.pingTimer = 0;
        homingShotsFired++;

        const projectilesToSpawn = this.evolvedPing
          ? 5
          : 1 + Math.floor((this.pingTrackerLevel - 1) / 2);
        for (let i = 0; i < projectilesToSpawn; i++) {
          const target = activeEnemies[i % activeEnemies.length];
          const angle =
            Math.atan2(target.y - player.y, target.x - player.x) +
            (i - (projectilesToSpawn - 1) / 2) * 0.35;
          const baseDmg = computeBaseScaledDamage(
            this.evolvedPing ? Math.round(this.pingDamage * 1.35) : this.pingDamage
          );

          pingProjectiles.push(
            new PingProjectile(
              player.x,
              player.y,
              Math.cos(angle),
              Math.sin(angle),
              this.evolvedPing ? this.pingSpeed * 1.4 : this.pingSpeed,
              baseDmg,
              this.evolvedPing
            )
          );
        }
      }
    }

    // --- ARMA 3: Zona de Cuarentena (-> Reactor de Purga) ---
    if (player.active && this.quarantineLevel > 0 && this.quarantineTimer >= this.quarantineCooldown) {
      this.quarantineTimer = 0;

      const nearest = this.findNearestEnemies(player, enemies, 1)[0];
      const spawnX = nearest ? (player.x + nearest.x) * 0.5 : player.x;
      const spawnY = nearest ? (player.y + nearest.y) * 0.5 : player.y;

      quarantineZones.push(
        new QuarantineZone(
          spawnX,
          spawnY,
          this.evolvedQuarantine ? Math.round(this.quarantineRadius * 1.45) : this.quarantineRadius,
          computeBaseScaledDamage(
            this.evolvedQuarantine ? Math.round(this.quarantineDamage * 1.8) : this.quarantineDamage
          ),
          this.evolvedQuarantine ? this.quarantineDuration + 1.5 : this.quarantineDuration,
          this.evolvedQuarantine
        )
      );
    }

    // --- ARMA 4: Cortafuegos (-> Tormenta Solar) ---
    const effectivePulseCooldown =
      (this.evolvedFirewallPulse ? this.firewallPulseCooldown * 0.65 : this.firewallPulseCooldown) /
      effectiveRof;
    if (
      player.active &&
      this.firewallPulseLevel > 0 &&
      this.firewallPulseTimer >= effectivePulseCooldown
    ) {
      this.firewallPulseTimer = 0;
      const baseDmg = computeBaseScaledDamage(
        this.evolvedFirewallPulse ? Math.round(this.firewallPulseDamage * 1.6) : this.firewallPulseDamage
      );
      this.firewallPulses.push(
        new FirewallPulseRing(
          player.x,
          player.y,
          this.evolvedFirewallPulse ? this.firewallPulseMaxRadius + 95 : this.firewallPulseMaxRadius,
          baseDmg,
          this.evolvedFirewallPulse
        )
      );
    }

    // --- ARMA 5: Rayo SQL Injection (-> Zero-Day Annihilator) ---
    const effectiveSqlCooldown =
      (this.evolvedSqlBeam ? this.sqlBeamCooldown * 0.72 : this.sqlBeamCooldown) / effectiveRof;
    if (player.active && this.sqlBeamLevel > 0 && this.sqlBeamTimer >= effectiveSqlCooldown) {
      const nearest = this.findNearestEnemies(player, enemies, 1)[0];
      const angle = nearest
        ? Math.atan2(nearest.y - player.y, nearest.x - player.x)
        : this.firewallAngle;
      this.sqlBeamTimer = 0;
      shotsFired++;
      const baseDmg = computeBaseScaledDamage(
        this.evolvedSqlBeam ? Math.round(this.sqlBeamDamage * 1.45) : this.sqlBeamDamage
      );
      const beamAngles = this.evolvedSqlBeam ? [angle - 0.17, angle, angle + 0.17] : [angle];
      const beamThick = this.evolvedSqlBeam ? Math.round(this.sqlBeamThickness * 1.4) : this.sqlBeamThickness;
      for (const bAng of beamAngles) {
        this.sqlBeams.push(
          new SqlInjectionBeam(
            player.x,
            player.y,
            bAng,
            this.sqlBeamSpeed,
            baseDmg,
            beamThick,
            this.evolvedSqlBeam
          )
        );
      }
    }

    // --- ARMA 6: Bobina Tesla EMP (-> Tormenta de Arco Voltaico) ---
    const effectiveTeslaCd =
      (this.evolvedTesla ? this.teslaCooldown * 0.65 : this.teslaCooldown) / effectiveRof;
    if (player.active && this.teslaLevel > 0 && this.teslaTimer >= effectiveTeslaCd) {
      const chainCount = this.evolvedTesla ? 9 : 2 + Math.floor(this.teslaLevel / 2);
      const firstTarget = this.findNearestEnemies(player, enemies, 1)[0];
      if (firstTarget) {
        this.teslaTimer = 0;
        const arcPoints: { x: number; y: number }[] = [{ x: player.x, y: player.y }];
        const visited = new Set<Adware>();
        let currentSource: { x: number; y: number } = player;
        let currentTarget: Adware | null = firstTarget;

        for (let step = 0; step < chainCount && currentTarget; step++) {
          visited.add(currentTarget);
          arcPoints.push({ x: currentTarget.x, y: currentTarget.y });

          const rawDmg = computeBaseScaledDamage(
            this.evolvedTesla ? Math.round(this.teslaDamage * 1.65) : this.teslaDamage
          );
          const critRoll = rollCritHit(rawDmg);
          currentTarget.takeDamage(critRoll.dmg, 0, 0);
          if (this.evolvedTesla && currentTarget.active) {
            currentTarget.networkFreezeTimer = Math.max(currentTarget.networkFreezeTimer, 0.55);
          }
          this.weaponDamageStats['Bobina Tesla'] += critRoll.dmg;
          tryTriggerVampirism();
          damagedEnemies.push({
            x: currentTarget.x,
            y: currentTarget.y,
            damage: critRoll.dmg,
            color: this.evolvedTesla ? '#fbbf24' : '#38bdf8',
            isCrit: critRoll.isCrit,
          });
          registerEnemyKillIfDead(currentTarget);

          currentSource = currentTarget;
          let nextTarget: Adware | null = null;
          let bestJumpDist = 230;
          for (const candidate of enemies) {
            if (!candidate.active || visited.has(candidate)) continue;
            const d = Math.hypot(candidate.x - currentSource.x, candidate.y - currentSource.y);
            if (d <= bestJumpDist) {
              bestJumpDist = d;
              nextTarget = candidate;
            }
          }
          currentTarget = nextTarget;
        }

        if (arcPoints.length > 1) {
          this.teslaArcs.push({
            points: arcPoints,
            life: 0.18,
            maxLife: 0.18,
            color: this.evolvedTesla ? '#fde047' : '#38bdf8',
          });
        }
      }
    }

    // --- ARMA 7: Fragmento Criogénico (-> Cero Absoluto) ---
    const effectiveCryoCd =
      (this.evolvedCryo ? this.cryoCooldown * 0.72 : this.cryoCooldown) / effectiveRof;
    if (player.active && this.cryoLevel > 0 && this.cryoTimer >= effectiveCryoCd) {
      const shardCount = this.evolvedCryo ? 4 : 1 + Math.floor(this.cryoLevel / 3);
      const targets = this.findNearestEnemies(player, enemies, shardCount);
      if (targets.length > 0) {
        this.cryoTimer = 0;
        const baseDmg = computeBaseScaledDamage(
          this.evolvedCryo ? Math.round(this.cryoDamage * 1.75) : this.cryoDamage
        );
        const aoeR = this.evolvedCryo ? this.cryoAoeRadius + 44 : this.cryoAoeRadius;
        for (let i = 0; i < shardCount; i++) {
          const tgt = targets[i % targets.length];
          const ang =
            Math.atan2(tgt.y - player.y, tgt.x - player.x) +
            (i - (shardCount - 1) / 2) * 0.22;
          this.cryoShards.push(
            new CryoShardProjectile(
              player.x,
              player.y,
              ang,
              this.evolvedCryo ? 620 : 490,
              baseDmg,
              aoeR,
              this.evolvedCryo
            )
          );
        }
      }
    }

    // --- ARMA 8: Disco Kernel Rotativo (-> Sierras Phantom) ---
    const effectiveSawCd =
      (this.evolvedSaw ? this.sawCooldown * 0.7 : this.sawCooldown) / effectiveRof;
    if (player.active && this.sawLevel > 0 && this.sawTimer >= effectiveSawCd) {
      this.sawTimer = 0;
      const discCount = this.evolvedSaw ? 5 : 1 + Math.floor(this.sawLevel / 2);
      const baseDmg = computeBaseScaledDamage(
        this.evolvedSaw ? Math.round(this.sawDamage * 1.65) : this.sawDamage
      );
      const nearest = this.findNearestEnemies(player, enemies, 1)[0];
      const baseAngle = nearest
        ? Math.atan2(nearest.y - player.y, nearest.x - player.x)
        : this.firewallAngle;
      for (let i = 0; i < discCount; i++) {
        const ang = baseAngle + (i * Math.PI * 2) / discCount;
        this.sawDiscs.push(
          new SawDiscProjectile(player.x, player.y, ang, baseDmg, this.evolvedSaw)
        );
      }
    }

    // Actualizar visuales Tesla & Cryo
    for (const arc of this.teslaArcs) {
      arc.life -= dt;
    }
    this.teslaArcs = this.teslaArcs.filter((a) => a.life > 0);

    for (const ring of this.cryoRings) {
      ring.radius += (ring.maxRadius - ring.radius) * 10 * dt;
      ring.alpha -= dt * 3.2;
    }
    this.cryoRings = this.cryoRings.filter((r) => r.alpha > 0.03);

    // --- ESQUIVA LATERAL DEL ENEMIGO 'EVASOR' (Ghost Script) ---
    const incomingProjectiles: { x: number; y: number; vx: number; vy: number }[] = [];
    for (const p of projectiles) {
      if (p.active) incomingProjectiles.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy });
    }
    for (const p of pingProjectiles) {
      if (p.active) incomingProjectiles.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy });
    }
    if (incomingProjectiles.length > 0) {
      for (const enemy of enemies) {
        if (enemy.active && enemy instanceof Evasor) {
          enemy.tryDodgeIncomingProjectiles(
            incomingProjectiles,
            canvasWidth,
            canvasHeight,
            viewOriginX,
            viewOriginY
          );
        }
      }
    }

    // --- COLISIONES: Ráfaga de Firewall vs Enemigos ---
    for (const proj of projectiles) {
      if (!proj.active) continue;

      for (const enemy of enemies) {
        if (!enemy.active || proj.hasHit(enemy)) continue;

        if (CombatSystem.checkAABBCollision(proj, enemy)) {
          proj.markHit(enemy);
          const sourceX = proj.x - proj.vx * 0.045;
          const sourceY = proj.y - proj.vy * 0.045;

          if (enemy.isHitBlockedByShield(sourceX, sourceY)) {
            damagedEnemies.push({
              x: enemy.x,
              y: enemy.y,
              damage: 0,
              color: '#38bdf8',
            });
            if (!proj.active) break;
            continue;
          }

          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const dist = Math.hypot(dx, dy) || 1;
          const critRoll = rollCritHit(proj.damage);
          enemy.takeDamage(critRoll.dmg, (dx / dist) * 6, (dy / dist) * 6);
          this.weaponDamageStats['Ráfaga Firewall'] += critRoll.dmg;
          tryTriggerVampirism();

          damagedEnemies.push({
            x: enemy.x,
            y: enemy.y,
            damage: critRoll.dmg,
            color: proj.isEvolved ? '#fde047' : enemy.color,
            isCrit: critRoll.isCrit,
          });

          registerEnemyKillIfDead(enemy);
          if (!proj.active) break;
        }
      }
    }

    // --- COLISIONES: Ping Tracker vs Enemigos ---
    for (const ping of pingProjectiles) {
      if (!ping.active) continue;

      for (const enemy of enemies) {
        if (!enemy.active) continue;

        if (CombatSystem.checkAABBCollision(ping, enemy)) {
          ping.active = false;
          const sourceX = ping.x - ping.vx * 0.045;
          const sourceY = ping.y - ping.vy * 0.045;

          if (enemy.isHitBlockedByShield(sourceX, sourceY)) {
            damagedEnemies.push({
              x: enemy.x,
              y: enemy.y,
              damage: 0,
              color: '#38bdf8',
            });
            break;
          }

          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const dist = Math.hypot(dx, dy) || 1;
          const critRoll = rollCritHit(ping.damage);
          enemy.takeDamage(critRoll.dmg, (dx / dist) * 8, (dy / dist) * 8);
          this.weaponDamageStats['Ping Tracker'] += critRoll.dmg;
          tryTriggerVampirism();

          damagedEnemies.push({
            x: enemy.x,
            y: enemy.y,
            damage: critRoll.dmg,
            color: ping.isEvolved ? '#60a5fa' : '#0088ff',
            isCrit: critRoll.isCrit,
          });
          registerEnemyKillIfDead(enemy);

          // Evolución Enjambre DDoS: micro-explosión AoE al impactar
          if (ping.isEvolved) {
            const splashDmg = Math.round(ping.damage * 0.65);
            for (const nearby of enemies) {
              if (!nearby.active || nearby === enemy) continue;
              if (Math.hypot(nearby.x - ping.x, nearby.y - ping.y) <= 68) {
                nearby.takeDamage(splashDmg, 0, 0);
                this.weaponDamageStats['Ping Tracker'] += splashDmg;
                registerEnemyKillIfDead(nearby);
              }
            }
          }
          break;
        }
      }
    }

    // --- ACTUALIZACIÓN Y DAÑO: Fragmento Criogénico ---
    for (const shard of this.cryoShards) {
      if (!shard.active) continue;
      shard.update(dt, canvasWidth, canvasHeight, viewOriginX, viewOriginY);
      if (!shard.active) continue;

      for (const enemy of enemies) {
        if (!enemy.active) continue;
        if (CombatSystem.checkAABBCollision(shard, enemy)) {
          shard.active = false;
          this.cryoRings.push({
            x: shard.x,
            y: shard.y,
            radius: 12,
            maxRadius: shard.aoeRadius,
            alpha: 0.85,
            color: shard.isEvolved ? '#67e8f9' : '#38bdf8',
          });

          for (const target of enemies) {
            if (!target.active) continue;
            if (Math.hypot(target.x - shard.x, target.y - shard.y) <= shard.aoeRadius + target.size * 0.45) {
              const critRoll = rollCritHit(shard.damage);
              target.takeDamage(critRoll.dmg, 0, 0);
              if (target.active) {
                target.cryoSlowTimer = Math.max(target.cryoSlowTimer, shard.isEvolved ? 2.5 : 1.8);
                target.cryoSlowFactor = Math.min(target.cryoSlowFactor, shard.isEvolved ? 0.35 : 0.58);
              }
              this.weaponDamageStats['Crio-Shard'] += critRoll.dmg;
              tryTriggerVampirism();
              damagedEnemies.push({
                x: target.x,
                y: target.y,
                damage: critRoll.dmg,
                color: '#38bdf8',
                isCrit: critRoll.isCrit,
              });
              registerEnemyKillIfDead(target);
            }
          }
          break;
        }
      }
    }
    this.cryoShards = this.cryoShards.filter((s) => s.active);

    // --- ACTUALIZACIÓN Y DAÑO: Disco Kernel Rotativo ---
    for (const disc of this.sawDiscs) {
      if (!disc.active) continue;
      const hits = disc.updateDisc(dt, player, enemies);
      for (const hitEnemy of hits) {
        const critRoll = rollCritHit(disc.damage);
        hitEnemy.takeDamage(critRoll.dmg, 0, 0);
        this.weaponDamageStats['Disco Kernel'] += critRoll.dmg;
        tryTriggerVampirism();
        damagedEnemies.push({
          x: hitEnemy.x,
          y: hitEnemy.y,
          damage: critRoll.dmg,
          color: disc.isEvolved ? '#fbbf24' : '#f97316',
          isCrit: critRoll.isCrit,
        });
        registerEnemyKillIfDead(hitEnemy);
      }
    }
    this.sawDiscs = this.sawDiscs.filter((d) => d.active);

    // --- ACTUALIZACIÓN Y DAÑO CONTINUO: Zonas de Cuarentena ---
    for (const zone of quarantineZones) {
      if (!zone.active) continue;
      const zoneHits = zone.update(dt, enemies);

      for (const hit of zoneHits) {
        if (!hit.enemy.active) continue;
        const critRoll = rollCritHit(hit.damage);
        hit.enemy.takeDamage(critRoll.dmg, 0, 0);
        this.weaponDamageStats['Zona Cuarentena'] += critRoll.dmg;

        damagedEnemies.push({
          x: hit.enemy.x,
          y: hit.enemy.y,
          damage: critRoll.dmg,
          color: zone.isEvolved ? '#fbbf24' : '#10b981',
          isCrit: critRoll.isCrit,
        });

        registerEnemyKillIfDead(hit.enemy);
      }
    }

    // --- PASIVA ROOT: Nodos eléctricos que queman y frenan ---
    if (player.rootTrailNodes.length > 0) {
      const trailDmg = Math.max(6, Math.round(9 * player.damageMultiplier));
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const cd = (this.rootTrailHitCooldowns.get(enemy) ?? 0) - dt;
        if (cd > 0) {
          this.rootTrailHitCooldowns.set(enemy, cd);
          continue;
        }
        for (const node of player.rootTrailNodes) {
          if (Math.hypot(enemy.x - node.x, enemy.y - node.y) <= node.radius + enemy.size * 0.4) {
            this.rootTrailHitCooldowns.set(enemy, 0.35);
            enemy.takeDamage(trailDmg, 0, 0);
            if (enemy.active) {
              enemy.cryoSlowTimer = Math.max(enemy.cryoSlowTimer, 0.45);
              enemy.cryoSlowFactor = Math.min(enemy.cryoSlowFactor, 0.7);
            }
            damagedEnemies.push({
              x: enemy.x,
              y: enemy.y,
              damage: trailDmg,
              color: '#60a5fa',
            });
            registerEnemyKillIfDead(enemy);
            break;
          }
        }
      }
    }

    // --- ACTUALIZACIÓN Y DAÑO: Cortafuegos (Anillos Expansivos) ---
    for (const pulse of this.firewallPulses) {
      if (!pulse.active) continue;
      const pulseHits = pulse.update(dt, player, enemies);
      for (const hit of pulseHits) {
        if (!hit.enemy.active) continue;
        const dx = hit.enemy.x - player.x;
        const dy = hit.enemy.y - player.y;
        const dist = Math.hypot(dx, dy) || 1;
        const critRoll = rollCritHit(hit.damage);
        hit.enemy.takeDamage(critRoll.dmg, (dx / dist) * 18, (dy / dist) * 18);
        this.weaponDamageStats['Cortafuegos'] += critRoll.dmg;
        tryTriggerVampirism();

        damagedEnemies.push({
          x: hit.enemy.x,
          y: hit.enemy.y,
          damage: critRoll.dmg,
          color: pulse.isEvolved ? '#fde047' : '#ff8800',
          isCrit: critRoll.isCrit,
        });

        registerEnemyKillIfDead(hit.enemy);
      }
    }
    this.firewallPulses = this.firewallPulses.filter((p) => p.active);

    // --- ACTUALIZACIÓN Y DAÑO PENETRANTE: Rayo SQL Injection ---
    for (const beam of this.sqlBeams) {
      if (!beam.active) continue;
      const beamHits = beam.update(dt, enemies, canvasWidth, canvasHeight, viewOriginX, viewOriginY);
      for (const hit of beamHits) {
        if (!hit.enemy.active) continue;
        if (hit.blocked) {
          damagedEnemies.push({
            x: hit.enemy.x,
            y: hit.enemy.y,
            damage: 0,
            color: '#38bdf8',
          });
          continue;
        }
        const dx = hit.enemy.x - player.x;
        const dy = hit.enemy.y - player.y;
        const dist = Math.hypot(dx, dy) || 1;
        const critRoll = rollCritHit(hit.damage);
        hit.enemy.takeDamage(critRoll.dmg, (dx / dist) * 10, (dy / dist) * 10);
        this.weaponDamageStats['Rayo SQL'] += critRoll.dmg;
        tryTriggerVampirism();

        damagedEnemies.push({
          x: hit.enemy.x,
          y: hit.enemy.y,
          damage: critRoll.dmg,
          color: beam.isEvolved ? '#fbbf24' : '#d946ef',
          isCrit: critRoll.isCrit,
        });

        registerEnemyKillIfDead(hit.enemy);
      }
    }
    this.sqlBeams = this.sqlBeams.filter((b) => b.active);

    // --- COLISIONES: Drones Antivirus (Escudo Reactivo -> Centinelas Omega) vs Enemigos ---
    const targetDroneCount = this.evolvedDrones ? Math.max(6, this.firewallCount) : this.firewallCount;
    while (this.droneSlots.length < targetDroneCount) {
      this.droneSlots.push({ durability: 3, respawnTimer: 0 });
    }

    for (const slot of this.droneSlots) {
      if (this.evolvedDrones) {
        slot.durability = 3;
        slot.respawnTimer = 0;
      } else if (slot.durability <= 0) {
        slot.respawnTimer -= dt;
        if (slot.respawnTimer <= 0) {
          slot.durability = 3;
          slot.respawnTimer = 0;
        }
      }
    }

    for (const exp of this.droneExplosions) {
      exp.update(dt);
    }
    this.droneExplosions = this.droneExplosions.filter((e) => e.active);

    if (player.active && targetDroneCount > 0) {
      const savedCount = this.firewallCount;
      this.firewallCount = targetDroneCount;
      const nodes = this.getFirewallNodePositions(player);
      this.firewallCount = savedCount;
      const interceptRadius = this.evolvedDrones ? 19 : 15;

      const triggerDroneHitAndCheckExplosion = (slot: ReactiveDroneSlot, nodeX: number, nodeY: number) => {
        if (this.evolvedDrones) return; // Centinelas Omega son indestructibles
        slot.durability -= 1;
        if (slot.durability <= 0) {
          slot.durability = 0;
          slot.respawnTimer = 10.0;
          droneExploded = true;
          this.droneExplosions.push(new DroneExplosionWave(nodeX, nodeY));
          const aoeRadius = 115;
          const baseAoeDamage = Math.round(this.firewallDamage * 2.5 * player.damageMultiplier);

          for (const target of enemies) {
            if (!target.active) continue;
            const d = Math.hypot(target.x - nodeX, target.y - nodeY);
            if (d <= aoeRadius + target.size * 0.5) {
              const kx = ((target.x - nodeX) / (d || 1)) * 28;
              const ky = ((target.y - nodeY) / (d || 1)) * 28;
              const critRoll = rollCritHit(baseAoeDamage);
              target.takeDamage(critRoll.dmg, kx, ky);
              this.weaponDamageStats['Drones Antivirus'] += critRoll.dmg;
              damagedEnemies.push({
                x: target.x,
                y: target.y,
                damage: critRoll.dmg,
                color: '#ff1e42',
                isCrit: critRoll.isCrit,
              });
              registerEnemyKillIfDead(target);
            }
          }
        }
      };

      for (const enemy of enemies) {
        if (!enemy.active) continue;

        const currentCd = this.firewallHitCooldowns.get(enemy) ?? 0;
        if (currentCd > 0) {
          this.firewallHitCooldowns.set(enemy, currentCd - dt);
          continue;
        }

        for (let i = 0; i < nodes.length; i++) {
          const slot = this.droneSlots[i];
          if (!slot || slot.durability <= 0) continue;

          const node = nodes[i];
          const distToDrone = Math.hypot(enemy.x - node.x, enemy.y - node.y);

          if (distToDrone <= interceptRadius + enemy.size * 0.5) {
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const dist = Math.hypot(dx, dy) || 1;
            const pushDist = this.evolvedDrones ? 44 : 36;
            const rawDroneDmg = this.evolvedDrones ? this.firewallDamage * 1.65 : this.firewallDamage;
            const critRoll = rollCritHit(computeBaseScaledDamage(rawDroneDmg));
            enemy.takeDamage(
              critRoll.dmg,
              (dx / dist) * pushDist,
              (dy / dist) * pushDist
            );
            this.weaponDamageStats['Drones Antivirus'] += critRoll.dmg;
            this.firewallHitCooldowns.set(enemy, this.evolvedDrones ? 0.16 : 0.28);

            damagedEnemies.push({
              x: enemy.x,
              y: enemy.y,
              damage: critRoll.dmg,
              color: this.evolvedDrones
                ? '#fbbf24'
                : slot.durability === 3
                ? '#00ff66'
                : slot.durability === 2
                ? '#facc15'
                : '#ff1e42',
              isCrit: critRoll.isCrit,
            });

            registerEnemyKillIfDead(enemy);
            triggerDroneHitAndCheckExplosion(slot, node.x, node.y);
            break;
          }
        }
      }
    }

    // --- PROYECTILES ENEMIGOS (Troyano Tirador y Jefes de Oleada) ---
    for (const enemy of enemies) {
      const pProj = (enemy as any).pendingProjectiles as EnemyProjectile[] | undefined;
      if (enemy.active && pProj && pProj.length > 0) {
        this.enemyProjectiles.push(...pProj);
        (enemy as any).pendingProjectiles = [];
      }
    }

    const triggerHitOutcomeFeedback = () => {
      if (player.lastHitOutcome === 'SHIELD_BLOCKED') {
        shieldBlocked = true;
        for (const foe of enemies) {
          if (!foe.active) continue;
          const dist = Math.hypot(foe.x - player.x, foe.y - player.y);
          if (dist <= 185) {
            const dx = (foe.x - player.x) / (dist || 1);
            const dy = (foe.y - player.y) / (dist || 1);
            foe.takeDamage(Math.round(35 * player.damageMultiplier), dx * 44, dy * 44);
            registerEnemyKillIfDead(foe);
          }
        }
      } else if (player.lastHitOutcome === 'DODGED') {
        dodgedHit = true;
      } else if (player.surgePulsePending) {
        player.surgePulsePending = false;
        surgeTriggered = true;
        const surgeDmg = Math.round(45 * player.damageMultiplier);
        for (const foe of enemies) {
          if (!foe.active) continue;
          const dist = Math.hypot(foe.x - player.x, foe.y - player.y);
          if (dist <= 175) {
            const dx = (foe.x - player.x) / (dist || 1);
            const dy = (foe.y - player.y) / (dist || 1);
            foe.takeDamage(surgeDmg, dx * 38, dy * 38);
            registerEnemyKillIfDead(foe);
          }
        }
      }
    };

    for (const eProj of this.enemyProjectiles) {
      if (!eProj.active) continue;
      eProj.update(dt, canvasWidth, canvasHeight, viewOriginX, viewOriginY);

      if (eProj.active && player.active && CombatSystem.checkAABBCollision(player, eProj)) {
        eProj.active = false;
        if (player.takeDamage(eProj.damage)) {
          playerHit = true;
        }
        triggerHitOutcomeFeedback();
      }
    }
    this.enemyProjectiles = this.enemyProjectiles.filter((p) => p.active);

    // --- COLISIONES: Enemigos vs Jugador ---
    if (player.active) {
      for (const enemy of enemies) {
        if (!enemy.active) continue;

        if (CombatSystem.checkAABBCollision(player, enemy)) {
          if (enemy.damage > 0) {
            const tookDamage = player.takeDamage(enemy.damage);
            if (tookDamage) {
              playerHit = true;
            }
            triggerHitOutcomeFeedback();
          } else if (enemy.malwareType === 'HARDWARE_BOX') {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const dist = Math.hypot(dx, dy) || 1;
            player.x += (dx / dist) * 6;
            player.y += (dy / dist) * 6;
            continue;
          } else {
            continue;
          }

          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const dist = Math.hypot(dx, dy) || 1;
          const pushFactor = 14 * Math.max(0.2, 1 - enemy.knockbackResistance);
          enemy.x += (dx / dist) * pushFactor;
          enemy.y += (dy / dist) * pushFactor;
        }
      }
    }

    return {
      enemiesKilled,
      destroyedEnemies,
      damagedEnemies,
      playerHit,
      shotsFired,
      homingShotsFired,
      vampirismHeals,
      droneExploded,
      shieldBlocked,
      dodgedHit,
      surgeTriggered,
    };
  }

  public getActiveWeaponsList(player?: Player): string[] {
    const list: string[] = [];
    if (player?.isSummoner && player.companion) {
      list.push(player.companion.getBranchDisplayName(1));
    } else {
      list.push(this.evolvedBasic ? '★ Hex-Core' : 'Ráfaga Firewall');
    }
    if (this.pingTrackerLevel > 0) {
      list.push(this.evolvedPing ? '★ Enjambre DDoS' : `Ping Tracker v${this.pingTrackerLevel}`);
    }
    if (this.quarantineLevel > 0) {
      list.push(this.evolvedQuarantine ? '★ Purga Nuclear' : `Zona Cuarentena v${this.quarantineLevel}`);
    }
    if (this.dronesLevel > 0) {
      list.push(this.evolvedDrones ? '★ Centinelas Omega' : `Drones v${this.dronesLevel}`);
    }
    if (this.firewallPulseLevel > 0) {
      list.push(this.evolvedFirewallPulse ? '★ Tormenta Solar' : `Cortafuegos v${this.firewallPulseLevel}`);
    }
    if (this.sqlBeamLevel > 0) {
      list.push(this.evolvedSqlBeam ? '★ Láser Zero-Day' : `Rayo SQL v${this.sqlBeamLevel}`);
    }
    if (this.teslaLevel > 0) {
      list.push(this.evolvedTesla ? '★ Arco Voltaico' : `Tesla EMP v${this.teslaLevel}`);
    }
    if (this.cryoLevel > 0) {
      list.push(this.evolvedCryo ? '★ Cero Absoluto' : `Crio-Shard v${this.cryoLevel}`);
    }
    if (this.sawLevel > 0) {
      list.push(this.evolvedSaw ? '★ Sierras Phantom' : `Disco Kernel v${this.sawLevel}`);
    }
    return list;
  }

  public getFirewallNodePositions(player: Player): { x: number; y: number }[] {
    const count = this.evolvedDrones ? Math.max(6, this.firewallCount) : this.firewallCount;
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = this.firewallAngle + (i * Math.PI * 2) / count;
      positions.push({
        x: player.x + Math.cos(angle) * this.firewallRadius,
        y: player.y + Math.sin(angle) * this.firewallRadius,
      });
    }
    return positions;
  }

  public drawFirewall(ctx: CanvasRenderingContext2D, player: Player): void {
    for (const pulse of this.firewallPulses) {
      if (pulse.active) {
        pulse.draw(ctx);
      }
    }

    for (const ring of this.cryoRings) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ring.alpha);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const arc of this.teslaArcs) {
      const alpha = Math.max(0, arc.life / arc.maxLife);
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < arc.points.length; i++) {
        const pt = arc.points[i];
        if (i === 0) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          const prev = arc.points[i - 1];
          const midX = (prev.x + pt.x) * 0.5 + (Math.random() - 0.5) * 18;
          const midY = (prev.y + pt.y) * 0.5 + (Math.random() - 0.5) * 18;
          ctx.lineTo(midX, midY);
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.globalAlpha = alpha * 0.34;
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 8.0;
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 3.2;
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      for (let i = 1; i < arc.points.length; i++) {
        const pt = arc.points[i];
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5 * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const shard of this.cryoShards) {
      if (shard.active) {
        shard.draw(ctx);
      }
    }

    for (const disc of this.sawDiscs) {
      if (disc.active) {
        disc.draw(ctx);
      }
    }

    for (const beam of this.sqlBeams) {
      if (beam.active) {
        beam.draw(ctx);
      }
    }

    for (const eProj of this.enemyProjectiles) {
      if (eProj.active) {
        eProj.draw(ctx);
      }
    }

    for (const exp of this.droneExplosions) {
      if (exp.active) {
        exp.draw(ctx);
      }
    }

    const activeCount = this.evolvedDrones ? Math.max(6, this.firewallCount) : this.firewallCount;
    if (activeCount <= 0 || !player.active) return;

    const nodes = this.getFirewallNodePositions(player);

    ctx.save();
    ctx.strokeStyle = this.evolvedDrones ? 'rgba(251, 191, 36, 0.24)' : 'rgba(0, 255, 102, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, this.firewallRadius, 0, Math.PI * 2);
    ctx.stroke();

    const spin = performance.now() * 0.005;
    for (let i = 0; i < nodes.length; i++) {
      const slot = this.droneSlots[i];
      if (!slot || slot.durability <= 0) continue;

      const node = nodes[i];
      const droneColor = this.evolvedDrones
        ? '#fbbf24'
        : slot.durability === 3
        ? '#00ff66'
        : slot.durability === 2
        ? '#facc15'
        : '#ff1e42';

      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.rotate(spin + i * 1.1);

      ctx.fillStyle = this.evolvedDrones ? '#1e1005' : '#06131a';
      ctx.strokeStyle = droneColor;
      ctx.lineWidth = this.evolvedDrones ? 2.8 : 2.4;

      const hexR = this.evolvedDrones ? 12 : 10;
      ctx.beginPath();
      for (let v = 0; v < 6; v++) {
        const a = (v * Math.PI) / 3;
        const px = Math.cos(a) * hexR;
        const py = Math.sin(a) * hexR;
        if (v === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = droneColor;
      ctx.beginPath();
      ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private findNearestEnemies(player: Player, enemies: Adware[], count: number): Adware[] {
    const candidates: { enemy: Adware; dist: number }[] = [];

    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist <= this.attackRange) {
        candidates.push({ enemy, dist });
      }
    }

    candidates.sort((a, b) => a.dist - b.dist);
    return candidates.slice(0, count).map((c) => c.enemy);
  }

  public static checkAABBCollision(a: Entity, b: Entity): boolean {
    const boxA = a.getBounds();
    const boxB = b.getBounds();

    return (
      boxA.left < boxB.right &&
      boxA.right > boxB.left &&
      boxA.top < boxB.bottom &&
      boxA.bottom > boxB.top
    );
  }
}
