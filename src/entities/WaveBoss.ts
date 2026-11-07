import { Adware } from './Adware';
import { Player } from './Player';
import { EnemyProjectile, TrojanShooter } from './TrojanShooter';
import { Trojan } from './Trojan';

/**
 * Clase base para todos los Jefes de Oleada del juego.
 * Hereda de Adware con malwareType = 'RANSOMWARE' para plena compatibilidad
 * con música, logros, sistema de combate y el HUD inferior.
 */
export abstract class WaveBoss extends Adware {
  public abstract bossName: string;
  public abstract bossTitle: string;
  public abstract bossColor: string;
  public pendingProjectiles: EnemyProjectile[] = [];
  public pendingMinions: Adware[] = [];

  constructor(
    x: number,
    y: number,
    size: number,
    speed: number,
    color: string,
    hp: number,
    damage: number,
    xpValue: number
  ) {
    super(x, y, size, speed, color, hp, damage, xpValue);
    this.malwareType = 'RANSOMWARE';
    this.knockbackResistance = 0.94;
  }

  protected drawLocalHealthBar(ctx: CanvasRenderingContext2D, barWidth: number = 72, offsetY: number = 24): void {
    const barH = 6;
    const bx = this.x - barWidth / 2;
    const by = this.y - this.size / 2 - offsetY;
    const ratio = Math.max(0, this.hp / this.maxHp);

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(bx, by, barWidth, barH);
    ctx.fillStyle = this.bossColor;
    ctx.fillRect(bx, by, barWidth * ratio, barH);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barWidth, barH);
    ctx.restore();
  }
}

// ============================================================================
// 1. RANSOMWARE (El Encriptador - Tanque Pesado y Embestida)
// ============================================================================
export class RansomwareBoss extends WaveBoss {
  public bossName: string;
  public bossTitle: string = 'RANSOMWARE';
  public bossColor: string = '#ff0055';
  private shieldAngle: number = 0;
  private surgeTimer: number = 0;
  private baseSpeed: number;

  constructor(x: number, y: number, bossLevel: number = 1) {
    const scaledHp = 450 + (bossLevel - 1) * 440;
    const scaledSpeed = Math.min(108, 78 + (bossLevel - 1) * 3.5);
    const scaledDmg = Math.round(28 + (bossLevel - 1) * 3);
    super(x, y, 54, scaledSpeed, '#ff0055', scaledHp, scaledDmg, 240 * bossLevel);
    this.baseSpeed = scaledSpeed;
    this.knockbackResistance = Math.min(0.98, 0.92 + (bossLevel - 1) * 0.01);
    this.bossName = `RANSOMWARE_v${bossLevel}.0 [ENCRYPTOR]`;
  }

  public override update(dt: number, player: Player): void {
    this.shieldAngle += dt * 2.2;
    this.surgeTimer += dt;

    // Embestida periódica de cifrado cada 4.5 segundos
    const cycle = this.surgeTimer % 4.5;
    if (cycle > 3.6) {
      this.speed = this.baseSpeed * 2.15;
    } else {
      this.speed = this.baseSpeed;
    }

    super.update(dt, player);
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    const drawColor = isFlashing ? '#ffffff' : this.bossColor;
    const half = this.size / 2;

    // Anillo giratorio de cifrado
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.shieldAngle);
    ctx.strokeStyle = isFlashing ? '#ffffff' : '#ff0055';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, half + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Cuerpo blindado
    ctx.fillStyle = drawColor;
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = isFlashing ? 26 : 14;
    ctx.fillRect(this.x - half, this.y - half, this.size, this.size);

    // Símbolo de candado de cifrado
    if (!isFlashing) {
      ctx.fillStyle = '#1f000d';
      ctx.fillRect(this.x - half + 8, this.y - half + 8, this.size - 16, this.size - 16);

      ctx.strokeStyle = '#ff99bb';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x - 10, this.y - 6, 20, 16);
      ctx.beginPath();
      ctx.arc(this.x, this.y - 6, 6, Math.PI, 0);
      ctx.stroke();
    }

    this.drawLocalHealthBar(ctx);
    ctx.restore();
  }
}

// ============================================================================
// 2. ROOTKIT TITAN (Demonio Oculto - Sigilo y Nova de Proyectiles)
// ============================================================================
export class RootkitTitanBoss extends WaveBoss {
  public bossName: string;
  public bossTitle: string = 'ROOTKIT_TITAN';
  public bossColor: string = '#a855f7';
  private stealthTimer: number = 0;
  private isStealthed: boolean = false;
  private baseSpeed: number;
  private runeAngle: number = 0;

  constructor(x: number, y: number, bossLevel: number = 1) {
    const scaledHp = 420 + (bossLevel - 1) * 420;
    const scaledSpeed = Math.min(115, 82 + (bossLevel - 1) * 4.0);
    const scaledDmg = Math.round(26 + (bossLevel - 1) * 3);
    super(x, y, 50, scaledSpeed, '#a855f7', scaledHp, scaledDmg, 250 * bossLevel);
    this.baseSpeed = scaledSpeed;
    this.bossName = `ROOTKIT_TITAN_v${bossLevel}.0 [SHADOW DAEMON]`;
  }

  public override update(dt: number, player: Player): void {
    this.runeAngle += dt * 1.8;
    this.stealthTimer += dt;

    // Ciclo de sigilo cada 5.5 segundos: 2.0 segundos en sigilo
    const cycle = this.stealthTimer % 5.5;
    const wasStealthed = this.isStealthed;
    this.isStealthed = cycle < 2.0;

    if (this.isStealthed) {
      this.speed = this.baseSpeed * 1.45;
    } else {
      this.speed = this.baseSpeed;
    }

    // Al salir del sigilo -> SHADOW NOVA (8 proyectiles en 360°)
    if (wasStealthed && !this.isStealthed && this.active) {
      const numProjectiles = 8;
      for (let i = 0; i < numProjectiles; i++) {
        const ang = (i * (Math.PI * 2)) / numProjectiles + this.runeAngle;
        this.pendingProjectiles.push(
          new EnemyProjectile(this.x, this.y, ang, 240, 14, '#c084fc', 11)
        );
      }
    }

    super.update(dt, player);
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    const drawColor = isFlashing ? '#ffffff' : this.bossColor;
    const half = this.size / 2;

    if (this.isStealthed) {
      ctx.globalAlpha = 0.22;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.runeAngle);

    // Runas orbitales violetas
    ctx.strokeStyle = isFlashing ? '#ffffff' : '#c084fc';
    ctx.lineWidth = 2;
    ctx.strokeRect(-half - 8, -half - 8, (half + 8) * 2, (half + 8) * 2);

    // Cuerpo en forma de rombo de sombras
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = drawColor;
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = isFlashing ? 24 : 12;
    ctx.fillRect(-half * 0.85, -half * 0.85, half * 1.7, half * 1.7);

    // Núcleo de sombra
    ctx.fillStyle = '#1e082b';
    ctx.fillRect(-half * 0.45, -half * 0.45, half * 0.9, half * 0.9);
    ctx.restore();

    this.drawLocalHealthBar(ctx);
    ctx.restore();
  }
}

// ============================================================================
// 3. TROJAN OVERLORD (Nave Nodriza - Artillería y Despliegue de Escoltas)
// ============================================================================
export class TrojanOverlordBoss extends WaveBoss {
  public bossName: string;
  public bossTitle: string = 'TROJAN_OVERLORD';
  public bossColor: string = '#f97316';
  private shootTimer: number = 0;
  private deployTimer: number = 0;
  private facingAngle: number = 0;
  private activeEscorts: Adware[] = [];

  constructor(x: number, y: number, bossLevel: number = 1) {
    const scaledHp = 500 + (bossLevel - 1) * 480;
    const scaledSpeed = Math.min(95, 68 + (bossLevel - 1) * 3.0);
    const scaledDmg = Math.round(30 + (bossLevel - 1) * 3);
    super(x, y, 62, scaledSpeed, '#f97316', scaledHp, scaledDmg, 260 * bossLevel);
    this.bossName = `TROJAN_OVERLORD_v${bossLevel}.0 [CARRIER]`;
  }

  public override takeDamage(amount: number, knockbackX: number = 0, knockbackY: number = 0): void {
    super.takeDamage(amount, knockbackX, knockbackY);
  }

  public override update(dt: number, player: Player): void {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    this.facingAngle = Math.atan2(dy, dx);

    // 1. Artillería pesada doble cada 2.6 segundos
    this.shootTimer += dt;
    if (this.shootTimer >= 2.6) {
      this.shootTimer = 0;
      const leftMuzzleX = this.x + Math.cos(this.facingAngle - 0.35) * (this.size * 0.6);
      const leftMuzzleY = this.y + Math.sin(this.facingAngle - 0.35) * (this.size * 0.6);
      const rightMuzzleX = this.x + Math.cos(this.facingAngle + 0.35) * (this.size * 0.6);
      const rightMuzzleY = this.y + Math.sin(this.facingAngle + 0.35) * (this.size * 0.6);

      this.pendingProjectiles.push(
        new EnemyProjectile(leftMuzzleX, leftMuzzleY, this.facingAngle - 0.08, 290, 16, '#f97316', 12),
        new EnemyProjectile(rightMuzzleX, rightMuzzleY, this.facingAngle + 0.08, 290, 16, '#f97316', 12)
      );
    }

    // 2. Despliegue de escoltas troyanos cada 7.0 segundos (máx 3 simultáneos)
    this.deployTimer += dt;
    this.activeEscorts = this.activeEscorts.filter((e) => e.active);
    if (this.deployTimer >= 7.0) {
      this.deployTimer = 0;
      if (this.activeEscorts.length < 3) {
        const escort1 = new Trojan(this.x - 24, this.y + 24);
        const escort2 = new TrojanShooter(this.x + 24, this.y - 24);
        this.activeEscorts.push(escort1, escort2);
        this.pendingMinions.push(escort1, escort2);
      }
    }

    super.update(dt, player);
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    const drawColor = isFlashing ? '#ffffff' : this.bossColor;
    const half = this.size / 2;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.facingAngle);

    // Cuerpo de crucero de batalla triangular
    ctx.fillStyle = drawColor;
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = isFlashing ? 28 : 12;

    ctx.beginPath();
    ctx.moveTo(half + 10, 0); // Punta delantera
    ctx.lineTo(-half, -half);  // Ala superior
    ctx.lineTo(-half * 0.5, -half * 0.3); // Entrada a la bahía
    ctx.lineTo(-half * 0.5, half * 0.3);
    ctx.lineTo(-half, half);   // Ala inferior
    ctx.closePath();
    ctx.fill();

    // Compuerta de la bahía de carga con energía naranja
    ctx.fillStyle = '#ffedd5';
    ctx.fillRect(-half * 0.45, -half * 0.25, half * 0.5, half * 0.5);

    // Propulsores de iones gemelos
    ctx.fillStyle = '#fdba74';
    ctx.fillRect(-half - 6, -half * 0.7, 6, 8);
    ctx.fillRect(-half - 6, half * 0.7 - 8, 6, 8);
    ctx.restore();

    this.drawLocalHealthBar(ctx, 80);
    ctx.restore();
  }
}

// ============================================================================
// 4. WORM PRIME (Gusano Primigenio - Rastro Tóxico de Fuga de Memoria)
// ============================================================================
interface ToxicPuddle {
  x: number;
  y: number;
  radius: number;
  lifetime: number;
}

export class WormPrimeBoss extends WaveBoss {
  public bossName: string;
  public bossTitle: string = 'WORM_PRIME';
  public bossColor: string = '#10b981';
  private sinPhase: number = 0;
  private puddleTimer: number = 0;
  private puddles: ToxicPuddle[] = [];
  private segments: Array<{ x: number; y: number }> = [];
  private baseSpeed: number;
  private enrageTimer: number = 0;

  constructor(x: number, y: number, bossLevel: number = 1) {
    const scaledHp = 480 + (bossLevel - 1) * 450;
    const scaledSpeed = Math.min(110, 76 + (bossLevel - 1) * 4.0);
    const scaledDmg = Math.round(26 + (bossLevel - 1) * 3);
    super(x, y, 54, scaledSpeed, '#10b981', scaledHp, scaledDmg, 250 * bossLevel);
    this.baseSpeed = scaledSpeed;
    this.bossName = `WORM_PRIME_v${bossLevel}.0 [REPLICATOR]`;

    for (let i = 0; i < 5; i++) {
      this.segments.push({ x, y });
    }
  }

  public override update(dt: number, player: Player): void {
    this.sinPhase += dt * 4.5;
    const isEnraged = this.hp < this.maxHp * 0.5;

    // Velocidad aumentada si está enfurecido
    this.speed = isEnraged ? this.baseSpeed * 1.3 : this.baseSpeed;

    // Actualizar historial de segmentos articulados
    this.segments.unshift({ x: this.x, y: this.y });
    if (this.segments.length > 30) {
      this.segments.pop();
    }

    // Deja charcos tóxicos en el suelo ("Memory Leak") cada 0.8s
    this.puddleTimer += dt;
    if (this.puddleTimer >= 0.8) {
      this.puddleTimer = 0;
      this.puddles.push({
        x: this.x,
        y: this.y,
        radius: 26,
        lifetime: 3.2
      });
    }

    // Actualizar charcos y verificar daño al jugador
    for (const p of this.puddles) {
      p.lifetime -= dt;
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      if (Math.hypot(dx, dy) < p.radius + player.size * 0.4) {
        player.takeDamage(4);
      }
    }
    this.puddles = this.puddles.filter((p) => p.lifetime > 0);

    // En modo enfurecido, dispara 3 espinas ácidas cada 3.2s
    if (isEnraged) {
      this.enrageTimer += dt;
      if (this.enrageTimer >= 3.2) {
        this.enrageTimer = 0;
        const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
        this.pendingProjectiles.push(
          new EnemyProjectile(this.x, this.y, baseAngle - 0.25, 270, 14, '#34d399', 11),
          new EnemyProjectile(this.x, this.y, baseAngle, 270, 14, '#34d399', 11),
          new EnemyProjectile(this.x, this.y, baseAngle + 0.25, 270, 14, '#34d399', 11)
        );
      }
    }

    super.update(dt, player);
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 1. Dibujar charcos tóxicos en el suelo
    for (const p of this.puddles) {
      const alpha = Math.min(1, p.lifetime / 1.5);
      ctx.fillStyle = `rgba(16, 185, 129, ${alpha * 0.45})`;
      ctx.strokeStyle = `rgba(52, 211, 153, ${alpha * 0.8})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 2. Dibujar segmentos del cuerpo articulado
    const isFlashing = this.hitFlashTimer > 0;
    const isEnraged = this.hp < this.maxHp * 0.5;
    const bodyColor = isFlashing ? '#ffffff' : isEnraged ? '#34d399' : this.bossColor;

    for (let i = 1; i <= 5; i++) {
      const segIndex = i * 5;
      const segPos = this.segments[segIndex] || { x: this.x, y: this.y };
      const segSize = Math.max(16, this.size - i * 6);
      ctx.fillStyle = isFlashing ? '#ffffff' : '#064e3b';
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(segPos.x, segPos.y, segSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 3. Cabeza blindada del Gusano
    ctx.fillStyle = bodyColor;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = isFlashing ? 28 : 14;
    const half = this.size / 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, half, 0, Math.PI * 2);
    ctx.fill();

    // Mandíbulas mecánicas
    ctx.fillStyle = '#d1fae5';
    ctx.beginPath();
    ctx.arc(this.x + 8, this.y - 6, 5, 0, Math.PI * 2);
    ctx.arc(this.x + 8, this.y + 6, 5, 0, Math.PI * 2);
    ctx.fill();

    this.drawLocalHealthBar(ctx, 76);
    ctx.restore();
  }
}

// ============================================================================
// 5. SPYWARE SPECTER (Espectro Zero-Day - Desfase Cuántico y Glitches)
// ============================================================================
export class SpywareSpecterBoss extends WaveBoss {
  public bossName: string;
  public bossTitle: string = 'SPYWARE_SPECTER';
  public bossColor: string = '#06b6d4';
  private blinkTimer: number = 0;
  private hitCounter: number = 0;
  private glitchPhase: number = 0;

  constructor(x: number, y: number, bossLevel: number = 1) {
    const scaledHp = 380 + (bossLevel - 1) * 390;
    const scaledSpeed = Math.min(125, 92 + (bossLevel - 1) * 4.0);
    const scaledDmg = Math.round(22 + (bossLevel - 1) * 3);
    super(x, y, 48, scaledSpeed, '#06b6d4', scaledHp, scaledDmg, 250 * bossLevel);
    this.bossName = `SPYWARE_SPECTER_v${bossLevel}.0 [ZERO-DAY]`;
  }

  public override takeDamage(amount: number, knockbackX: number = 0, knockbackY: number = 0): void {
    super.takeDamage(amount, knockbackX, knockbackY);
    this.hitCounter++;
    // Si recibe ráfaga intensa de disparos, teletransporte de emergencia
    if (this.hitCounter >= 6) {
      this.hitCounter = 0;
      this.performQuantumBlink();
    }
  }

  private performQuantumBlink(): void {
    // Parpadea a una distancia de 180-220px en un ángulo aleatorio
    const angle = Math.random() * Math.PI * 2;
    const distance = 180 + Math.random() * 50;
    this.x += Math.cos(angle) * distance;
    this.y += Math.sin(angle) * distance;

    // Dispara 4 fragmentos glitch cian
    for (let i = 0; i < 4; i++) {
      const ang = (i * (Math.PI * 2)) / 4 + 0.3;
      this.pendingProjectiles.push(
        new EnemyProjectile(this.x, this.y, ang, 260, 13, '#22d3ee', 10)
      );
    }
  }

  public override update(dt: number, player: Player): void {
    this.glitchPhase += dt * 9;
    this.blinkTimer += dt;

    // Teletransporte periódico cada 5.2s
    if (this.blinkTimer >= 5.2) {
      this.blinkTimer = 0;
      this.performQuantumBlink();
    }

    super.update(dt, player);
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    const half = this.size / 2;
    const glitchOffset = (Math.floor(this.glitchPhase) % 3 === 0) ? (Math.random() - 0.5) * 8 : 0;

    // Efecto de aberración cromática RGB (capa cian + capa magenta desviada)
    if (!isFlashing) {
      ctx.save();
      ctx.fillStyle = 'rgba(236, 72, 153, 0.45)';
      ctx.fillRect(this.x - half + glitchOffset - 3, this.y - half, this.size, this.size);
      ctx.restore();
    }

    // Núcleo principal cian
    ctx.fillStyle = isFlashing ? '#ffffff' : this.bossColor;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = isFlashing ? 28 : 12;
    ctx.fillRect(this.x - half + glitchOffset, this.y - half, this.size, this.size);

    // Ojo de intercepción central
    ctx.fillStyle = '#083344';
    ctx.fillRect(this.x - half * 0.4 + glitchOffset, this.y - half * 0.4, half * 0.8, half * 0.8);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(this.x - 3 + glitchOffset, this.y - 3, 6, 6);

    this.drawLocalHealthBar(ctx);
    ctx.restore();
  }
}

// ============================================================================
// FACTORY: Crear Jefe de Oleada en función del índice de oleada
// ============================================================================
export function createWaveBoss(x: number, y: number, bossIndex: number): WaveBoss {
  const bossTypeIndex = (bossIndex - 1) % 5;
  const bossLevel = 1 + Math.floor((bossIndex - 1) / 5);

  switch (bossTypeIndex) {
    case 0:
      return new RansomwareBoss(x, y, bossLevel);
    case 1:
      return new RootkitTitanBoss(x, y, bossLevel);
    case 2:
      return new TrojanOverlordBoss(x, y, bossLevel);
    case 3:
      return new WormPrimeBoss(x, y, bossLevel);
    case 4:
      return new SpywareSpecterBoss(x, y, bossLevel);
    default:
      return new RansomwareBoss(x, y, bossLevel);
  }
}
