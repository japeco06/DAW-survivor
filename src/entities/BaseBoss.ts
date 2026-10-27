import { Entity } from './Entity';
import { Player } from './Player';
import { EncryptedBlock } from './EncryptedBlock';

export type BossStateName =
  | 'COOLDOWN'
  | 'SWEEPING_LASERS'
  | 'DDOS_WAVE'
  | 'TRACKER_WORMS'
  | 'SPECIAL_ATTACK'
  | 'SPECIAL_ATTACK_2';

export class SweepingLaser {
  public x1: number;
  public y1: number;
  public x2: number;
  public y2: number;
  public vx: number;
  public vy: number;
  public width: number;
  public state: 'TELEGRAPH' | 'ACTIVE' = 'TELEGRAPH';
  public timer: number = 0;
  public readonly telegraphDuration: number = 1.0;
  public readonly activeDuration: number;
  public active: boolean = true;

  constructor(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    vx: number,
    vy: number,
    activeDuration: number = 2.4,
    width: number = 18
  ) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.vx = vx;
    this.vy = vy;
    this.activeDuration = activeDuration;
    this.width = width;
  }

  public update(dt: number, player: Player): boolean {
    this.timer += dt;

    if (this.state === 'TELEGRAPH') {
      if (this.timer >= this.telegraphDuration) {
        this.state = 'ACTIVE';
        this.timer = 0;
      }
      return false;
    }

    this.x1 += this.vx * dt;
    this.y1 += this.vy * dt;
    this.x2 += this.vx * dt;
    this.y2 += this.vy * dt;

    if (this.timer >= this.activeDuration) {
      this.active = false;
      return false;
    }

    const dist = this.pointToSegmentDistance(player.x, player.y, this.x1, this.y1, this.x2, this.y2);
    if (dist <= this.width * 0.5 + player.size * 0.42) {
      return player.takeDamage(18);
    }

    return false;
  }

  private pointToSegmentDistance(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (this.state === 'TELEGRAPH') {
      const progress = this.timer / this.telegraphDuration;
      const blink = Math.sin(this.timer * (16 + progress * 26)) > -0.25;
      ctx.strokeStyle = blink ? 'rgba(255, 30, 70, 0.9)' : 'rgba(255, 30, 70, 0.22)';
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.moveTo(this.x1, this.y1);
      ctx.lineTo(this.x2, this.y2);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(255, 0, 55, ${0.08 + progress * 0.14})`;
      ctx.lineWidth = this.width;
      ctx.beginPath();
      ctx.moveTo(this.x1, this.y1);
      ctx.lineTo(this.x2, this.y2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#ff0044';
      ctx.shadowColor = '#ff0044';
      ctx.shadowBlur = 22;
      ctx.lineWidth = this.width;
      ctx.beginPath();
      ctx.moveTo(this.x1, this.y1);
      ctx.lineTo(this.x2, this.y2);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = this.width * 0.4;
      ctx.beginPath();
      ctx.moveTo(this.x1, this.y1);
      ctx.lineTo(this.x2, this.y2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export class DDoSWaveRing {
  public x: number;
  public y: number;
  public radius: number = 36;
  public maxRadius: number;
  public expansionSpeed: number = 220;
  public thickness: number = 16;
  public gaps: { center: number; halfWidth: number }[];
  public active: boolean = true;

  constructor(x: number, y: number, maxRadius: number, gapAngles: number[], gapWidth: number = 0.72) {
    this.x = x;
    this.y = y;
    this.maxRadius = maxRadius;
    this.gaps = gapAngles.map((angle) => ({
      center: this.normalizeAngle(angle),
      halfWidth: gapWidth / 2,
    }));
  }

  public update(dt: number, player: Player): boolean {
    this.radius += this.expansionSpeed * dt;
    if (this.radius >= this.maxRadius) {
      this.active = false;
      return false;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const radialDiff = Math.abs(dist - this.radius);

    if (radialDiff <= this.thickness * 0.5 + player.size * 0.4) {
      const playerAngle = this.normalizeAngle(Math.atan2(dy, dx));
      const inGap = this.gaps.some(
        (g) => this.angleDistance(playerAngle, g.center) <= g.halfWidth
      );
      if (!inGap) {
        return player.takeDamage(18);
      }
    }

    return false;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = '#ff6600';
    ctx.shadowColor = '#ff3300';
    ctx.shadowBlur = 16;
    ctx.lineWidth = this.thickness;

    const sortedGaps = [...this.gaps].sort((a, b) => a.center - b.center);
    for (let i = 0; i < sortedGaps.length; i++) {
      const current = sortedGaps[i];
      const next = sortedGaps[(i + 1) % sortedGaps.length];
      const startAngle = current.center + current.halfWidth;
      let endAngle = next.center - next.halfWidth;
      if (endAngle <= startAngle) {
        endAngle += Math.PI * 2;
      }

      if (endAngle > startAngle) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, startAngle, endAngle);
        ctx.stroke();

        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, startAngle, endAngle);
        ctx.stroke();
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = this.thickness;
      }
    }

    ctx.restore();
  }

  private normalizeAngle(a: number): number {
    const twoPi = Math.PI * 2;
    return ((a % twoPi) + twoPi) % twoPi;
  }

  private angleDistance(a: number, b: number): number {
    const diff = Math.abs(a - b);
    return Math.min(diff, Math.PI * 2 - diff);
  }
}

export class TrackerWorm extends Entity {
  private vx: number;
  private vy: number;
  private turnRate: number = 3.1;
  private lifeTime: number = 5.2;

  constructor(x: number, y: number, initialAngle: number) {
    super(x, y, 16, 205, '#c084fc');
    this.vx = Math.cos(initialAngle) * this.speed;
    this.vy = Math.sin(initialAngle) * this.speed;
  }

  public update(dt: number, player: Player, blocks: EncryptedBlock[]): {
    hitPlayer: boolean;
    hitBlock: boolean;
  } {
    this.lifeTime -= dt;
    if (this.lifeTime <= 0) {
      this.active = false;
      return { hitPlayer: false, hitBlock: false };
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const desiredVx = (dx / dist) * this.speed;
    const desiredVy = (dy / dist) * this.speed;

    const steer = Math.min(1, this.turnRate * dt);
    this.vx += (desiredVx - this.vx) * steer;
    this.vy += (desiredVy - this.vy) * steer;

    const currentMag = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / currentMag) * this.speed;
    this.vy = (this.vy / currentMag) * this.speed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const bounds = this.getBounds();
    for (const block of blocks) {
      if (block.intersectsBounds(bounds)) {
        this.active = false;
        return { hitPlayer: false, hitBlock: true };
      }
    }

    if (dist <= (this.size + player.size) * 0.48) {
      this.active = false;
      return { hitPlayer: player.takeDamage(16), hitBlock: false };
    }

    return { hitPlayer: false, hitBlock: false };
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    const angle = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    ctx.fillStyle = '#a855f7';
    ctx.shadowColor = '#d8b4fe';
    ctx.shadowBlur = 14;

    const r = this.size / 2;
    ctx.beginPath();
    ctx.moveTo(r + 4, 0);
    ctx.lineTo(-r, -r);
    ctx.lineTo(-r * 0.5, 0);
    ctx.lineTo(-r, r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -2, 5, 4);
    ctx.restore();
  }
}

export interface BossAttackState {
  readonly name: BossStateName;
  enter(boss: BaseBoss, player: Player, width: number, height: number): void;
  update(boss: BaseBoss, dt: number, player: Player, width: number, height: number): boolean;
}

class CooldownState implements BossAttackState {
  public readonly name: BossStateName = 'COOLDOWN';
  private timer: number = 0;
  private duration: number;

  constructor(duration: number = 0.9) {
    this.duration = duration;
  }

  public enter(): void {
    this.timer = 0;
  }

  public update(_boss: BaseBoss, dt: number): boolean {
    this.timer += dt;
    return this.timer >= this.duration;
  }
}

class SweepingLasersState implements BossAttackState {
  public readonly name: BossStateName = 'SWEEPING_LASERS';
  private timer: number = 0;
  private duration: number = 3.2;

  public enter(boss: BaseBoss, player: Player, width: number, height: number): void {
    this.timer = 0;
    boss.lasers = [];
    const sweepSpeed = 75;
    const corridorGap = 250;
    const activeTime = 2.2;

    if (Math.random() < 0.5) {
      const dir = player.x < width / 2 ? 1 : -1;
      const center = Math.max(200, Math.min(width - 200, player.x));
      const leftX = center - corridorGap / 2;
      const rightX = center + corridorGap / 2;

      boss.lasers.push(new SweepingLaser(leftX, 0, leftX, height, sweepSpeed * dir, 0, activeTime));
      boss.lasers.push(new SweepingLaser(rightX, 0, rightX, height, sweepSpeed * dir, 0, activeTime));
    } else {
      const dir = player.y < height / 2 + 60 ? 1 : -1;
      const center = Math.max(320, Math.min(height - 180, player.y));
      const topY = center - corridorGap / 2;
      const bottomY = center + corridorGap / 2;

      boss.lasers.push(new SweepingLaser(0, topY, width, topY, 0, sweepSpeed * dir, activeTime));
      boss.lasers.push(new SweepingLaser(0, bottomY, width, bottomY, 0, sweepSpeed * dir, activeTime));
    }
  }

  public update(_boss: BaseBoss, dt: number): boolean {
    this.timer += dt;
    return this.timer >= this.duration;
  }
}

class DDoSWaveState implements BossAttackState {
  public readonly name: BossStateName = 'DDOS_WAVE';
  private timer: number = 0;
  private ringsSpawned: number = 0;
  private readonly totalRings: number = 3;
  private readonly ringInterval: number = 0.72;

  public enter(boss: BaseBoss, player: Player, width: number, height: number): void {
    this.timer = 0;
    this.ringsSpawned = 0;
    this.spawnRing(boss, player, width, height);
  }

  public update(
    boss: BaseBoss,
    dt: number,
    player: Player,
    width: number,
    height: number
  ): boolean {
    this.timer += dt;
    if (this.ringsSpawned < this.totalRings && this.timer >= this.ringsSpawned * this.ringInterval) {
      this.spawnRing(boss, player, width, height);
    }
    return this.timer >= this.totalRings * this.ringInterval + 0.6;
  }

  private spawnRing(boss: BaseBoss, player: Player, width: number, height: number): void {
    this.ringsSpawned++;
    const maxRadius = Math.hypot(width, height);
    const angleToPlayer = Math.atan2(player.y - boss.y, player.x - boss.x);
    const offset = (Math.random() - 0.5) * 0.8;
    const gapAngles = [
      angleToPlayer + offset,
      angleToPlayer + offset + Math.PI * 0.65,
      angleToPlayer + offset - Math.PI * 0.65,
    ];
    boss.ddosRings.push(new DDoSWaveRing(boss.x, boss.y, maxRadius, gapAngles, 0.72));
  }
}

class TrackerWormsState implements BossAttackState {
  public readonly name: BossStateName = 'TRACKER_WORMS';
  private timer: number = 0;
  private duration: number = 1.6;

  public enter(boss: BaseBoss, player: Player): void {
    this.timer = 0;
    const count = 6;
    const baseAngle = Math.atan2(player.y - boss.y, player.x - boss.x);

    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.34;
      boss.trackerWorms.push(new TrackerWorm(boss.x, boss.y + 34, baseAngle + spread));
    }
  }

  public update(_boss: BaseBoss, dt: number): boolean {
    this.timer += dt;
    return this.timer >= this.duration;
  }
}

class SpecialAttackState implements BossAttackState {
  public readonly name: BossStateName = 'SPECIAL_ATTACK';
  private timer: number = 0;
  private duration: number;

  constructor(duration: number = 2.2) {
    this.duration = duration;
  }

  public enter(boss: BaseBoss, player: Player, width: number, height: number): void {
    this.timer = 0;
    boss.triggerUniqueSpecialAttack(player, width, height);
  }

  public update(_boss: BaseBoss, dt: number): boolean {
    this.timer += dt;
    return this.timer >= this.duration;
  }
}

class SecondarySpecialAttackState implements BossAttackState {
  public readonly name: BossStateName = 'SPECIAL_ATTACK_2';
  private timer: number = 0;
  private duration: number;

  constructor(duration: number = 2.2) {
    this.duration = duration;
  }

  public enter(boss: BaseBoss, player: Player, width: number, height: number): void {
    this.timer = 0;
    boss.triggerSecondarySpecialAttack(player, width, height);
  }

  public update(_boss: BaseBoss, dt: number): boolean {
    this.timer += dt;
    return this.timer >= this.duration;
  }
}

export interface MegaBossUpdateResult {
  playerHit: boolean;
  triggeredAttackSound: boolean;
  shouldSpawnKey: boolean;
  blockedPositions: { x: number; y: number }[];
}

export abstract class BaseBoss extends Entity {
  public maxHp: number = 1500;
  public hp: number = 1500;
  public abstract bossTitle: string;
  public abstract specialAttackName: string;
  public secondarySpecialAttackName?: string;

  public lasers: SweepingLaser[] = [];
  public ddosRings: DDoSWaveRing[] = [];
  public trackerWorms: TrackerWorm[] = [];

  protected currentState: BossAttackState;
  private attackBag: BossAttackState[] = [];
  private keySpawnTimer: number = 1.6;
  private readonly keySpawnInterval: number = 3.6;
  protected hitFlashTimer: number = 0;
  protected animTimer: number = 0;

  constructor(canvasWidth: number, size: number = 96, color: string = '#ff0044') {
    super(canvasWidth / 2, 122, size, 0, color);
    this.currentState = new CooldownState(0.75);
    this.attackBag = [new SpecialAttackState(2.2)];
  }

  public abstract triggerUniqueSpecialAttack(
    player: Player,
    canvasWidth: number,
    canvasHeight: number
  ): void;

  public triggerSecondarySpecialAttack(
    player: Player,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    this.triggerUniqueSpecialAttack(player, canvasWidth, canvasHeight);
  }

  protected abstract updateUniqueMechanics(
    dt: number,
    player: Player,
    blocks: EncryptedBlock[],
    canvasWidth: number,
    canvasHeight: number
  ): boolean;

  protected abstract drawUniqueVisuals(ctx: CanvasRenderingContext2D): void;
  protected abstract drawBossCharacter(ctx: CanvasRenderingContext2D, isFlashing: boolean): void;
  protected abstract clearUniqueHazards(): void;

  public getCurrentStateLabel(): string {
    if (this.currentState.name === 'SPECIAL_ATTACK') {
      return `ESPECIAL 1: ${this.specialAttackName}`;
    }
    if (this.currentState.name === 'SPECIAL_ATTACK_2') {
      return `ESPECIAL 2: ${this.secondarySpecialAttackName ?? this.specialAttackName}`;
    }
    return this.currentState.name;
  }

  public reposition(canvasWidth: number): void {
    this.x = canvasWidth / 2;
    this.y = 122;
  }

  public static createArenaBlocks(width: number, height: number): EncryptedBlock[] {
    const cx = width / 2;
    const cy = height / 2 + 55;
    const dx = Math.min(260, width * 0.27);
    const dy = Math.min(145, height * 0.2);

    return [
      new EncryptedBlock(cx - dx, cy - dy, 130, 32),
      new EncryptedBlock(cx + dx, cy - dy, 130, 32),
      new EncryptedBlock(cx - dx, cy + dy, 130, 32),
      new EncryptedBlock(cx + dx, cy + dy, 130, 32),
      new EncryptedBlock(cx, cy + 15, 42, 130),
    ];
  }

  public takeKeyDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlashTimer = 0.2;
    if (this.hp <= 0) {
      this.active = false;
      this.lasers = [];
      this.ddosRings = [];
      this.trackerWorms = [];
      this.clearUniqueHazards();
    }
  }

  public update(
    dt: number,
    player: Player,
    blocks: EncryptedBlock[],
    canvasWidth: number,
    canvasHeight: number
  ): MegaBossUpdateResult {
    this.animTimer += dt;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }

    let triggeredAttackSound = false;
    let shouldSpawnKey = false;
    let playerHit = false;
    const blockedPositions: { x: number; y: number }[] = [];

    const finishedState = this.currentState.update(this, dt, player, canvasWidth, canvasHeight);
    if (finishedState) {
      if (this.currentState.name === 'COOLDOWN') {
        this.currentState = this.nextAttackState();
        this.currentState.enter(this, player, canvasWidth, canvasHeight);
        triggeredAttackSound = true;
      } else {
        const cooldownTime = 0.7 + 0.3 * (this.hp / this.maxHp);
        this.currentState = new CooldownState(cooldownTime);
        this.currentState.enter(this, player, canvasWidth, canvasHeight);
      }
    }

    this.keySpawnTimer -= dt;
    if (this.keySpawnTimer <= 0) {
      this.keySpawnTimer = this.keySpawnInterval;
      shouldSpawnKey = true;
    }

    for (const laser of this.lasers) {
      if (laser.update(dt, player)) {
        playerHit = true;
      }
    }

    for (const ring of this.ddosRings) {
      if (ring.update(dt, player)) {
        playerHit = true;
      }
    }

    for (const worm of this.trackerWorms) {
      const res = worm.update(dt, player, blocks);
      if (res.hitPlayer) {
        playerHit = true;
      }
      if (res.hitBlock) {
        blockedPositions.push({ x: worm.x, y: worm.y });
      }
    }

    if (this.updateUniqueMechanics(dt, player, blocks, canvasWidth, canvasHeight)) {
      playerHit = true;
    }

    this.lasers = this.lasers.filter((l) => l.active);
    this.ddosRings = this.ddosRings.filter((r) => r.active);
    this.trackerWorms = this.trackerWorms.filter((w) => w.active);

    return { playerHit, triggeredAttackSound, shouldSpawnKey, blockedPositions };
  }

  private nextAttackState(): BossAttackState {
    if (this.attackBag.length === 0) {
      const states: BossAttackState[] = [
        new SpecialAttackState(2.2),
        new SweepingLasersState(),
        new DDoSWaveState(),
        new TrackerWormsState(),
      ];
      if (this.secondarySpecialAttackName) {
        states.push(new SecondarySpecialAttackState(2.3));
      } else {
        states.push(new SpecialAttackState(2.2));
      }
      this.attackBag = states.sort(() => Math.random() - 0.5);
    }
    return this.attackBag.pop()!;
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    for (const ring of this.ddosRings) {
      ring.draw(ctx);
    }

    for (const laser of this.lasers) {
      laser.draw(ctx);
    }

    for (const worm of this.trackerWorms) {
      worm.draw(ctx);
    }

    this.drawUniqueVisuals(ctx);

    ctx.save();
    const isFlashing = this.hitFlashTimer > 0;
    this.drawBossCharacter(ctx, isFlashing);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`[${this.getCurrentStateLabel()}]`, this.x, this.y + this.size / 2 + 28);
    ctx.restore();
  }
}
