import { BaseBoss } from './BaseBoss';
import { RansomwareMaster } from './RansomwareMaster';
import { Player } from './Player';
import { EncryptedBlock } from './EncryptedBlock';

// ============================================================================
// JEFE 1: EL BAÑISTA
// - Ataque Especial 1: 'Ola del Tridente' (Barrido horizontal con hueco seguro)
// - Ataque Especial 2: 'Pistola de Agua' (Chorro rápido continuo hacia el jugador)
// ============================================================================

class TridentWaveHazard {
  public x: number;
  public vx: number;
  public width: number = 38;
  public gapY: number;
  public gapHeight: number = 145;
  public active: boolean = true;
  private wavePhase: number = 0;

  constructor(fromLeft: boolean, canvasWidth: number, canvasHeight: number) {
    const speed = 265;
    this.x = fromLeft ? -40 : canvasWidth + 40;
    this.vx = fromLeft ? speed : -speed;
    const minGapY = 230;
    const maxGapY = Math.max(minGapY + 60, canvasHeight - 130);
    this.gapY = minGapY + Math.random() * (maxGapY - minGapY);
  }

  public update(dt: number, player: Player, canvasWidth: number): boolean {
    this.wavePhase += dt * 8;
    this.x += this.vx * dt;

    if (this.x < -100 || this.x > canvasWidth + 100) {
      this.active = false;
      return false;
    }

    const halfW = this.width / 2;
    const pBounds = player.getBounds();
    const overlapsX = pBounds.right > this.x - halfW && pBounds.left < this.x + halfW;

    if (overlapsX) {
      const gapTop = this.gapY - this.gapHeight / 2;
      const gapBottom = this.gapY + this.gapHeight / 2;
      const insideSafeGap = pBounds.top >= gapTop - 8 && pBounds.bottom <= gapBottom + 8;

      if (!insideSafeGap) {
        return player.takeDamage(20);
      }
    }

    return false;
  }

  public draw(ctx: CanvasRenderingContext2D, canvasHeight: number): void {
    const gapTop = this.gapY - this.gapHeight / 2;
    const gapBottom = this.gapY + this.gapHeight / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(14, 165, 233, 0.85)';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;

    this.drawCurvedWaterSegment(ctx, 0, gapTop);
    this.drawCurvedWaterSegment(ctx, gapBottom, canvasHeight);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.55)';
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(this.x - this.width / 2, gapTop, this.width, this.gapHeight);
    ctx.restore();
  }

  private drawCurvedWaterSegment(
    ctx: CanvasRenderingContext2D,
    yStart: number,
    yEnd: number
  ): void {
    if (yEnd <= yStart) return;
    const halfW = this.width / 2;
    const dir = this.vx > 0 ? 1 : -1;

    ctx.beginPath();
    ctx.moveTo(this.x - halfW, yStart);
    const steps = Math.max(4, Math.floor((yEnd - yStart) / 35));
    const stepH = (yEnd - yStart) / steps;

    for (let i = 0; i <= steps; i++) {
      const cy = yStart + i * stepH;
      const curveOffset = Math.sin(this.wavePhase + i * 1.1) * 10 * dir;
      ctx.lineTo(this.x + halfW + curveOffset, cy);
    }

    ctx.lineTo(this.x - halfW, yEnd);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

class WaterStreamProjectile {
  public x: number;
  public y: number;
  private vx: number;
  private vy: number;
  public radius: number = 7;
  public active: boolean = true;

  constructor(x: number, y: number, angle: number, speed: number = 510) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  public update(dt: number, player: Player, canvasWidth: number, canvasHeight: number): boolean {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (
      this.x < -40 ||
      this.x > canvasWidth + 40 ||
      this.y < -40 ||
      this.y > canvasHeight + 40
    ) {
      this.active = false;
      return false;
    }

    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist <= this.radius + player.size * 0.42) {
      this.active = false;
      return player.takeDamage(10);
    }

    return false;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const angle = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    ctx.fillStyle = '#00d8ff';
    ctx.shadowColor = '#0ea5e9';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 1.5, this.radius * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(2, 0, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class BatherBoss extends BaseBoss {
  public bossTitle = 'EL BAÑISTA // TRIDENT OVERLORD';
  public specialAttackName = 'OLA DEL TRIDENTE';
  public override secondarySpecialAttackName = 'PISTOLA DE AGUA';

  private waves: TridentWaveHazard[] = [];
  private waterDrops: WaterStreamProjectile[] = [];
  private waterBurstRemaining: number = 0;
  private waterBurstShotTimer: number = 0;

  constructor(canvasWidth: number) {
    super(canvasWidth, 96, '#0ea5e9');
  }

  public override triggerUniqueSpecialAttack(
    _player: Player,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const fromLeft = Math.random() < 0.5;
    this.waves.push(new TridentWaveHazard(fromLeft, canvasWidth, canvasHeight));
  }

  public override triggerSecondarySpecialAttack(): void {
    // Activa una ráfaga rápida y continua de 18 chorros de agua durante 1.44 segundos
    this.waterBurstRemaining = 18;
    this.waterBurstShotTimer = 0;
  }

  protected override updateUniqueMechanics(
    dt: number,
    player: Player,
    _blocks: EncryptedBlock[],
    canvasWidth: number,
    canvasHeight: number
  ): boolean {
    let hit = false;

    // Si la Pistola de Agua está disparando su ráfaga continua, apunta a la posición actual del jugador
    if (this.waterBurstRemaining > 0) {
      this.waterBurstShotTimer -= dt;
      while (this.waterBurstRemaining > 0 && this.waterBurstShotTimer <= 0) {
        this.waterBurstShotTimer += 0.075;
        this.waterBurstRemaining--;

        const aimAngle =
          Math.atan2(player.y - (this.y + 10), player.x - (this.x - 34)) +
          (Math.random() - 0.5) * 0.07;
        this.waterDrops.push(new WaterStreamProjectile(this.x - 34, this.y + 10, aimAngle, 520));
      }
    }

    for (const wave of this.waves) {
      if (wave.update(dt, player, canvasWidth)) {
        hit = true;
      }
    }

    for (const drop of this.waterDrops) {
      if (drop.update(dt, player, canvasWidth, canvasHeight)) {
        hit = true;
      }
    }

    this.waves = this.waves.filter((w) => w.active);
    this.waterDrops = this.waterDrops.filter((d) => d.active);
    return hit;
  }

  protected override drawUniqueVisuals(ctx: CanvasRenderingContext2D): void {
    for (const wave of this.waves) {
      wave.draw(ctx, ctx.canvas.height);
    }
    for (const drop of this.waterDrops) {
      drop.draw(ctx);
    }
  }

  protected override clearUniqueHazards(): void {
    this.waves = [];
    this.waterDrops = [];
    this.waterBurstRemaining = 0;
  }

  protected override drawBossCharacter(ctx: CanvasRenderingContext2D, isFlashing: boolean): void {
    const x = this.x;
    const y = this.y;

    ctx.save();
    ctx.shadowColor = '#0ea5e9';
    ctx.shadowBlur = isFlashing ? 32 : 18;

    ctx.strokeStyle = isFlashing ? '#ffffff' : '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 56, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = isFlashing ? '#ffffff' : '#f59e0b';
    ctx.fillRect(x - 18, y + 18, 12, 24);
    ctx.fillRect(x + 6, y + 18, 12, 24);

    ctx.fillRect(x - 24, y - 16, 48, 30);

    ctx.fillStyle = isFlashing ? '#00ffcc' : '#ef4444';
    ctx.beginPath();
    ctx.moveTo(x - 24, y + 8);
    ctx.lineTo(x + 24, y + 8);
    ctx.lineTo(x + 18, y + 20);
    ctx.lineTo(x + 5, y + 18);
    ctx.lineTo(x, y + 26);
    ctx.lineTo(x - 5, y + 18);
    ctx.lineTo(x - 18, y + 20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isFlashing ? '#ffffff' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(x, y - 30, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 11, y - 34, 9, 5);
    ctx.fillRect(x + 2, y - 34, 9, 5);

    // Pistola de agua azul/cian en la mano izquierda cuando está lista o disparando
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(x - 42, y + 4, 16, 8);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x - 46, y + 5, 5, 5);

    const tridentX = x + 36;
    const bob = Math.sin(this.animTimer * 4) * 5;
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(tridentX, y + 38 + bob);
    ctx.lineTo(tridentX, y - 36 + bob);
    ctx.moveTo(tridentX - 12, y - 24 + bob);
    ctx.lineTo(tridentX + 12, y - 24 + bob);
    ctx.moveTo(tridentX - 12, y - 24 + bob);
    ctx.lineTo(tridentX - 12, y - 40 + bob);
    ctx.moveTo(tridentX, y - 24 + bob);
    ctx.lineTo(tridentX, y - 44 + bob);
    ctx.moveTo(tridentX + 12, y - 24 + bob);
    ctx.lineTo(tridentX + 12, y - 40 + bob);
    ctx.stroke();

    ctx.restore();
  }
}

// ============================================================================
// JEFE 2: EL COPIOTA (Diseño ancho 'gordito' + Gafas -> 'Chuletas de Examen')
// ============================================================================

class CheatSheetMine {
  public x: number;
  public y: number;
  private vx: number;
  private vy: number;
  private dragRate: number;
  public width: number = 22;
  public height: number = 28;
  public triggerRadius: number = 58;
  public explosionRadius: number = 78;
  private lifeTime: number = 8.5;
  private state: 'FLYING' | 'ARMED' | 'DETONATING' = 'FLYING';
  private detonationTimer: number = 0;
  public active: boolean = true;

  constructor(
    x: number,
    y: number,
    angle: number,
    initialSpeed: number,
    dragRate: number
  ) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * initialSpeed;
    this.vy = Math.sin(angle) * initialSpeed;
    this.dragRate = dragRate;
  }

  public update(dt: number, player: Player, canvasWidth: number, canvasHeight: number): boolean {
    this.lifeTime -= dt;
    if (this.lifeTime <= 0) {
      this.active = false;
      return false;
    }

    if (this.state === 'FLYING') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      const damping = Math.exp(-this.dragRate * dt);
      this.vx *= damping;
      this.vy *= damping;

      const margin = 48;
      if (this.x < margin || this.x > canvasWidth - margin) {
        this.x = Math.max(margin, Math.min(canvasWidth - margin, this.x));
        this.vx *= -0.25;
      }
      if (this.y < margin || this.y > canvasHeight - margin) {
        this.y = Math.max(margin, Math.min(canvasHeight - margin, this.y));
        this.vy *= -0.25;
      }

      if (Math.hypot(this.vx, this.vy) < 28) {
        this.vx = 0;
        this.vy = 0;
        this.state = 'ARMED';
      }
      return false;
    }

    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);

    if (this.state === 'ARMED') {
      if (distToPlayer <= this.triggerRadius) {
        this.state = 'DETONATING';
        this.detonationTimer = 0.28;
      }
      return false;
    }

    this.detonationTimer -= dt;
    if (this.detonationTimer <= 0) {
      this.active = false;
      if (distToPlayer <= this.explosionRadius) {
        return player.takeDamage(20);
      }
    }

    return false;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.state !== 'FLYING') {
      const isDetonating = this.state === 'DETONATING';
      ctx.strokeStyle = isDetonating
        ? 'rgba(255, 30, 66, 0.9)'
        : 'rgba(250, 204, 21, 0.28)';
      ctx.lineWidth = isDetonating ? 2.5 : 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, isDetonating ? this.explosionRadius : this.triggerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = this.state === 'DETONATING' ? '#fecaca' : '#f8fafc';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = this.state === 'DETONATING' ? '#ff1e42' : '#ffffff';
    ctx.shadowBlur = 10;
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    for (let ly = -8; ly <= 8; ly += 5) {
      ctx.beginPath();
      ctx.moveTo(-7, ly);
      ctx.lineTo(7, ly);
      ctx.stroke();
    }

    ctx.restore();
  }
}

export class CheaterBoss extends BaseBoss {
  public bossTitle = 'EL COPIOTA // EXAM PLAGIARIST';
  public specialAttackName = 'CHULETAS DE EXAMEN';
  private mines: CheatSheetMine[] = [];

  constructor(canvasWidth: number) {
    super(canvasWidth, 112, '#eab308');
  }

  public override triggerUniqueSpecialAttack(
    _player: Player,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const totalSheets = 9;
    const maxArenaReach = Math.hypot(canvasWidth * 0.46, canvasHeight - this.y - 80);

    const rangeTiers: ('SHORT' | 'MID' | 'LONG')[] = [
      'SHORT',
      'SHORT',
      'MID',
      'MID',
      'MID',
      'MID',
      'MID',
      'LONG',
      'LONG',
    ].sort(() => Math.random() - 0.5) as ('SHORT' | 'MID' | 'LONG')[];

    const minAngle = Math.PI * 0.08;
    const maxAngle = Math.PI * 0.92;

    for (let i = 0; i < totalSheets; i++) {
      const baseAngle = minAngle + (i / (totalSheets - 1)) * (maxAngle - minAngle);
      const angle = baseAngle + (Math.random() - 0.5) * 0.14;
      const tier = rangeTiers[i];

      let dragRate = 2.0 + (Math.random() - 0.5) * 0.6;
      let desiredDistance = 300;

      if (tier === 'SHORT') {
        dragRate = 2.4 + Math.random() * 0.5;
        desiredDistance = 140 + Math.random() * 90;
      } else if (tier === 'MID') {
        dragRate = 1.85 + Math.random() * 0.45;
        desiredDistance = Math.min(maxArenaReach * 0.68, 250 + Math.random() * 190);
      } else {
        dragRate = 1.45 + Math.random() * 0.35;
        desiredDistance = Math.min(maxArenaReach * 0.88, 460 + Math.random() * 180);
      }

      const initialSpeed = desiredDistance * dragRate + 28;
      this.mines.push(new CheatSheetMine(this.x, this.y + 25, angle, initialSpeed, dragRate));
    }
  }

  protected override updateUniqueMechanics(
    dt: number,
    player: Player,
    _blocks: EncryptedBlock[],
    canvasWidth: number,
    canvasHeight: number
  ): boolean {
    let hit = false;
    for (const mine of this.mines) {
      if (mine.update(dt, player, canvasWidth, canvasHeight)) {
        hit = true;
      }
    }
    this.mines = this.mines.filter((m) => m.active);
    return hit;
  }

  protected override drawUniqueVisuals(ctx: CanvasRenderingContext2D): void {
    for (const mine of this.mines) {
      mine.draw(ctx);
    }
  }

  protected override clearUniqueHazards(): void {
    this.mines = [];
  }

  protected override drawBossCharacter(ctx: CanvasRenderingContext2D, isFlashing: boolean): void {
    const x = this.x;
    const y = this.y;

    ctx.save();
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = isFlashing ? 32 : 18;

    ctx.fillStyle = isFlashing ? '#ffffff' : '#3b82f6';
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 56, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isFlashing ? '#ffffff' : '#fcd34d';
    ctx.beginPath();
    ctx.arc(x, y - 24, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#0f172a';
    ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.lineWidth = 3.5;

    ctx.fillRect(x - 20, y - 31, 16, 12);
    ctx.strokeRect(x - 20, y - 31, 16, 12);

    ctx.fillRect(x + 4, y - 31, 16, 12);
    ctx.strokeRect(x + 4, y - 31, 16, 12);

    ctx.beginPath();
    ctx.moveTo(x - 4, y - 25);
    ctx.lineTo(x + 4, y - 25);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 10, y - 27, 4, 4);
    ctx.fillRect(x + 14, y - 27, 4, 4);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 52, y + 2, 16, 22);

    ctx.restore();
  }
}

// ============================================================================
// JEFE 3: EL BORRACHO (Antes 'El Dormilón' - Sudadera rosa + Gafas)
// - Ataque Especial 1: 'Lluvia de Cervezas' (Jarras 🍺 con rebote caótico)
// - Ataque Especial 2: 'Lanzamiento de Pesas' (Mancuernas pesadas que atraviesan muros)
// ============================================================================

class BouncingBeerMug {
  public x: number;
  public y: number;
  private vx: number;
  private vy: number;
  public size: number = 28;
  private lifeTime: number = 7.0;
  private rotation: number = 0;
  public active: boolean = true;

  constructor(x: number, y: number, angle: number, speed: number = 350) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  public update(dt: number, player: Player, canvasWidth: number, canvasHeight: number): boolean {
    this.lifeTime -= dt;
    if (this.lifeTime <= 0) {
      this.active = false;
      return false;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += dt * 5;

    const margin = 20;
    if (this.x <= margin || this.x >= canvasWidth - margin) {
      this.vx = -this.vx;
      this.x = Math.max(margin, Math.min(canvasWidth - margin, this.x));
      this.applyChaoticBounceJitter();
    }
    if (this.y <= margin || this.y >= canvasHeight - margin) {
      this.vy = -this.vy;
      this.y = Math.max(margin, Math.min(canvasHeight - margin, this.y));
      this.applyChaoticBounceJitter();
    }

    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist <= (this.size + player.size) * 0.45) {
      this.active = false;
      return player.takeDamage(18);
    }

    return false;
  }

  private applyChaoticBounceJitter(): void {
    const speed = Math.hypot(this.vx, this.vy) * 1.04;
    const currentAngle = Math.atan2(this.vy, this.vx);
    const jitter = (Math.random() - 0.5) * 0.34;
    this.vx = Math.cos(currentAngle + jitter) * Math.min(540, speed);
    this.vy = Math.sin(currentAngle + jitter) * Math.min(540, speed);
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.sin(this.rotation) * 0.35);

    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 14;
    ctx.font = '28px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍺', 0, 0);
    ctx.restore();
  }
}

class HeavyDumbbellProjectile {
  public x: number;
  public y: number;
  private vx: number;
  private vy: number;
  public radius: number = 24;
  private rotation: number = 0;
  public active: boolean = true;

  constructor(x: number, y: number, angle: number, speed: number = 145) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  public update(dt: number, player: Player, canvasWidth: number, canvasHeight: number): boolean {
    // Se mueve más lento pero NO colisiona con los Bloques Encriptados (los atraviesa por completo)
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += dt * 4.2;

    const margin = 80;
    if (
      this.x < -margin ||
      this.x > canvasWidth + margin ||
      this.y < -margin ||
      this.y > canvasHeight + margin
    ) {
      this.active = false;
      return false;
    }

    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist <= this.radius + player.size * 0.45) {
      this.active = false;
      return player.takeDamage(26);
    }

    return false;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 16;

    // Barra central de acero de la mancuerna
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.fillRect(-20, -4, 40, 8);
    ctx.strokeRect(-20, -4, 40, 8);

    // Discos pesados laterales (pesas dobles a cada lado)
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2;

    // Lado izquierdo
    ctx.fillRect(-26, -16, 9, 32);
    ctx.strokeRect(-26, -16, 9, 32);
    ctx.fillRect(-17, -12, 6, 24);
    ctx.strokeRect(-17, -12, 6, 24);

    // Lado derecho
    ctx.fillRect(17, -16, 9, 32);
    ctx.strokeRect(17, -16, 9, 32);
    ctx.fillRect(11, -12, 6, 24);
    ctx.strokeRect(11, -12, 6, 24);

    ctx.restore();
  }
}

export class DrunkardBoss extends BaseBoss {
  public bossTitle = 'EL BORRACHO // BRAWLER DAEMON';
  public specialAttackName = 'LLUVIA DE CERVEZAS';
  public override secondarySpecialAttackName = 'LANZAMIENTO DE PESAS';

  private beerMugs: BouncingBeerMug[] = [];
  private dumbbells: HeavyDumbbellProjectile[] = [];

  constructor(canvasWidth: number) {
    super(canvasWidth, 96, '#ec4899');
  }

  public override triggerUniqueSpecialAttack(): void {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const angle =
        Math.PI * 0.18 + (i * Math.PI * 0.64) / (count - 1) + (Math.random() - 0.5) * 0.2;
      this.beerMugs.push(new BouncingBeerMug(this.x, this.y + 20, angle, 340));
    }
  }

  public override triggerSecondarySpecialAttack(player: Player): void {
    // Lanza 3 mancuernas grandes y pesadas hacia la zona del jugador que atraviesan cualquier muro
    const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
    const spreads = [-0.32, 0, 0.32];
    for (const offset of spreads) {
      this.dumbbells.push(new HeavyDumbbellProjectile(this.x, this.y + 24, baseAngle + offset, 150));
    }
  }

  protected override updateUniqueMechanics(
    dt: number,
    player: Player,
    _blocks: EncryptedBlock[],
    canvasWidth: number,
    canvasHeight: number
  ): boolean {
    let hit = false;

    for (const mug of this.beerMugs) {
      if (mug.update(dt, player, canvasWidth, canvasHeight)) {
        hit = true;
      }
    }

    for (const db of this.dumbbells) {
      if (db.update(dt, player, canvasWidth, canvasHeight)) {
        hit = true;
      }
    }

    this.beerMugs = this.beerMugs.filter((m) => m.active);
    this.dumbbells = this.dumbbells.filter((d) => d.active);
    return hit;
  }

  protected override drawUniqueVisuals(ctx: CanvasRenderingContext2D): void {
    for (const mug of this.beerMugs) {
      mug.draw(ctx);
    }
    for (const db of this.dumbbells) {
      db.draw(ctx);
    }
  }

  protected override clearUniqueHazards(): void {
    this.beerMugs = [];
    this.dumbbells = [];
  }

  protected override drawBossCharacter(ctx: CanvasRenderingContext2D, isFlashing: boolean): void {
    const x = this.x;
    const y = this.y;

    ctx.save();
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = isFlashing ? 32 : 18;

    // Mantiene exactamente la misma apariencia: Sudadera rosa con capucha y gafas
    ctx.fillStyle = isFlashing ? '#ffffff' : '#ec4899';
    ctx.strokeStyle = '#fbcfe8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x - 36, y - 14, 72, 52, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#db2777';
    ctx.fillRect(x - 22, y + 18, 44, 16);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 6);
    ctx.lineTo(x - 8, y + 14);
    ctx.moveTo(x + 8, y - 6);
    ctx.lineTo(x + 8, y + 14);
    ctx.stroke();

    ctx.fillStyle = isFlashing ? '#ffffff' : '#f472b6';
    ctx.beginPath();
    ctx.arc(x, y - 24, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(x, y - 24, 17, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x - 14, y - 29, 11, 8);
    ctx.strokeRect(x + 3, y - 29, 11, 8);
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 25);
    ctx.lineTo(x + 3, y - 25);
    ctx.moveTo(x - 11, y - 25);
    ctx.lineTo(x - 6, y - 25);
    ctx.moveTo(x + 6, y - 25);
    ctx.lineTo(x + 11, y - 25);
    ctx.stroke();

    ctx.font = '20px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.fillText('🍺', x + 38, y - 30 + Math.sin(this.animTimer * 3) * 4);

    ctx.restore();
  }
}

export function createRandomMegaBoss(canvasWidth: number, forcedIndex?: number): BaseBoss {
  const index =
    typeof forcedIndex === 'number' ? forcedIndex % 4 : Math.floor(Math.random() * 4);
  switch (index) {
    case 0:
      return new RansomwareMaster(canvasWidth);
    case 1:
      return new BatherBoss(canvasWidth);
    case 2:
      return new CheaterBoss(canvasWidth);
    default:
      return new DrunkardBoss(canvasWidth);
  }
}
