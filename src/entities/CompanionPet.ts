import { Player } from './Player';
import { Adware } from './Adware';

export type CompanionBranch = 'NONE' | 'BRUTE' | 'BOTNET' | 'TRIPWIRE';

interface CompanionUnit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  speed: number;
  patrolAngle: number;
  hitCooldowns: WeakMap<Adware, number>;
}

class EphemeralBotClone {
  public x: number;
  public y: number;
  public size: number = 11;
  public speed: number = 490;
  public damage: number;
  public active: boolean = true;
  private lifeTime: number = 1.6;

  constructor(x: number, y: number, damage: number) {
    this.x = x;
    this.y = y;
    this.damage = damage;
  }

  public update(dt: number, enemies: Adware[]): { hitEnemy: Adware | null; dmg: number } {
    this.lifeTime -= dt;
    if (this.lifeTime <= 0) {
      this.active = false;
      return { hitEnemy: null, dmg: 0 };
    }

    let nearest: Adware | null = null;
    let minDist = Infinity;
    for (const e of enemies) {
      if (!e.active) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }

    if (nearest) {
      const dx = nearest.x - this.x;
      const dy = nearest.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;

      if (dist <= (this.size + nearest.size) * 0.55) {
        this.active = false;
        return { hitEnemy: nearest, dmg: this.damage };
      }
    }

    return { hitEnemy: null, dmg: 0 };
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#f59e0b';
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 12;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.strokeRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

class BruteCraterZone {
  public x: number;
  public y: number;
  public radius: number = 46;
  public damage: number;
  public duration: number = 3.2;
  public elapsed: number = 0;
  public active: boolean = true;
  private tickTimer: number = 0;

  constructor(x: number, y: number, damage: number) {
    this.x = x;
    this.y = y;
    this.damage = damage;
  }

  public update(dt: number, enemies: Adware[]): { enemy: Adware; damage: number }[] {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.active = false;
      return [];
    }

    this.tickTimer += dt;
    if (this.tickTimer < 0.35) return [];
    this.tickTimer = 0;

    const hits: { enemy: Adware; damage: number }[] = [];
    for (const e of enemies) {
      if (!e.active) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= this.radius + e.size * 0.4) {
        hits.push({ enemy: e, damage: this.damage });
      }
    }
    return hits;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.max(0.15, 1 - this.elapsed / this.duration);
    ctx.save();
    ctx.fillStyle = `rgba(180, 83, 9, ${alpha * 0.32})`;
    ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.85})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

class BruteShockwave {
  public x: number;
  public y: number;
  public radius: number = 16;
  public maxRadius: number = 195;
  public damage: number;
  public active: boolean = true;
  private hitSet: Set<Adware> = new Set();

  constructor(x: number, y: number, damage: number) {
    this.x = x;
    this.y = y;
    this.damage = damage;
  }

  public update(dt: number, enemies: Adware[]): { enemy: Adware; damage: number }[] {
    this.radius += 420 * dt;
    const hits: { enemy: Adware; damage: number }[] = [];

    for (const e of enemies) {
      if (!e.active || this.hitSet.has(e)) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= this.radius + e.size * 0.5) {
        this.hitSet.add(e);
        hits.push({ enemy: e, damage: this.damage });
      }
    }

    if (this.radius >= this.maxRadius) {
      this.active = false;
    }
    return hits;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.max(0.1, 1 - this.radius / this.maxRadius);
    ctx.save();
    ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
    ctx.fillStyle = `rgba(217, 119, 6, ${alpha * 0.18})`;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export interface CompanionUpdateOutput {
  damagedEnemies: { x: number; y: number; damage: number; color: string }[];
  killedEnemies: Adware[];
  screenShakeIntensity: number;
  milestoneMessage: string | null;
}

export class CompanionPet {
  public branch: CompanionBranch = 'NONE';
  public bonusDamageStat: number = 0;
  private units: CompanionUnit[] = [];
  private clones: EphemeralBotClone[] = [];
  private craters: BruteCraterZone[] = [];
  private shockwaves: BruteShockwave[] = [];
  private tripwireTickCooldowns: WeakMap<Adware, number> = new WeakMap();
  private lastMilestoneLevel: number = 1;
  private craterCooldown: number = 0;

  constructor(playerX: number, playerY: number) {
    this.spawnUnits(1, playerX, playerY, 20, 235);
  }

  public selectBranch(branch: CompanionBranch, player: Player, playerLevel: number): void {
    this.branch = branch;
    this.lastMilestoneLevel = 2;
    this.reconfigureUnitsForTier(Math.max(2, playerLevel), player);
  }

  public upgradeBonusDamage(amount: number): void {
    this.bonusDamageStat += amount;
  }

  public getBranchDisplayName(_playerLevel: number = 1): string {
    if (this.branch === 'BRUTE') return 'Mascota: Fuerza Bruta';
    if (this.branch === 'BOTNET') return 'Mascota: La Botnet';
    if (this.branch === 'TRIPWIRE') return 'Mascota: Cable Trampa';
    return 'Mascota: Compañero Base';
  }

  private spawnUnits(
    count: number,
    centerX: number,
    centerY: number,
    size: number,
    speed: number
  ): void {
    this.units = [];
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count;
      this.units.push({
        x: centerX + Math.cos(angle) * 75,
        y: centerY + Math.sin(angle) * 75,
        vx: 0,
        vy: 0,
        size,
        speed,
        patrolAngle: angle,
        hitCooldowns: new WeakMap(),
      });
    }
  }

  private reconfigureUnitsForTier(playerLevel: number, player: Player): string | null {
    let milestoneMsg: string | null = null;

    if (this.branch === 'BRUTE') {
      const size = playerLevel >= 5 ? 48 : 30;
      const speed = playerLevel >= 20 ? 275 : playerLevel >= 5 ? 245 : 225;
      if (this.units.length !== 1) {
        this.spawnUnits(1, player.x, player.y, size, speed);
      } else {
        this.units[0].size = size;
        this.units[0].speed = speed;
      }

      if (playerLevel >= 20 && this.lastMilestoneLevel < 20) {
        this.lastMilestoneLevel = 20;
        milestoneMsg = 'EVOLUCIÓN LVL 20 [FUERZA BRUTA]: ¡ONDA DE CHOQUE DESBLOQUEADA!';
      } else if (playerLevel >= 10 && this.lastMilestoneLevel < 10) {
        this.lastMilestoneLevel = 10;
        milestoneMsg = 'EVOLUCIÓN LVL 10 [FUERZA BRUTA]: ¡MASA CRÍTICA (CRÁTERES) ACTIVA!';
      } else if (playerLevel >= 5 && this.lastMilestoneLevel < 5) {
        this.lastMilestoneLevel = 5;
        milestoneMsg = 'EVOLUCIÓN LVL 5 [FUERZA BRUTA]: ¡TAMAÑO GIGANTE Y TEMBLOR SÍSMICO!';
      }
    } else if (this.branch === 'BOTNET') {
      const targetCount = playerLevel >= 20 ? 15 : playerLevel >= 5 ? 5 : 3;
      const speed = playerLevel >= 20 ? 420 : playerLevel >= 5 ? 365 : 335;
      if (this.units.length !== targetCount) {
        this.spawnUnits(targetCount, player.x, player.y, 14, speed);
      } else {
        for (const u of this.units) u.speed = speed;
      }

      if (playerLevel >= 20 && this.lastMilestoneLevel < 20) {
        this.lastMilestoneLevel = 20;
        milestoneMsg = 'EVOLUCIÓN LVL 20 [LA BOTNET]: ¡BOTNET GLOBAL (15 UNIDADES PIRAÑA)!';
      } else if (playerLevel >= 10 && this.lastMilestoneLevel < 10) {
        this.lastMilestoneLevel = 10;
        milestoneMsg = 'EVOLUCIÓN LVL 10 [LA BOTNET]: ¡ATAQUE DDoS (CLONES EFÍMEROS)!';
      } else if (playerLevel >= 5 && this.lastMilestoneLevel < 5) {
        this.lastMilestoneLevel = 5;
        milestoneMsg = 'EVOLUCIÓN LVL 5 [LA BOTNET]: ¡MENTE COLMENA (5 UNIDADES DEFENSORAS)!';
      }
    } else if (this.branch === 'TRIPWIRE') {
      const targetCount = playerLevel >= 20 ? 4 : playerLevel >= 5 ? 2 : 1;
      const speed = playerLevel >= 20 ? 255 : 220;
      if (this.units.length !== targetCount) {
        this.spawnUnits(targetCount, player.x, player.y, 22, speed);
      }

      if (playerLevel >= 20 && this.lastMilestoneLevel < 20) {
        this.lastMilestoneLevel = 20;
        milestoneMsg = 'EVOLUCIÓN LVL 20 [CABLE TRAMPA]: ¡RED DE MALLA (PENTAGRAMA LÁSER)!';
      } else if (playerLevel >= 10 && this.lastMilestoneLevel < 10) {
        this.lastMilestoneLevel = 10;
        milestoneMsg = 'EVOLUCIÓN LVL 10 [CABLE TRAMPA]: ¡FIBRA ÓPTICA (-80% VELOCIDAD ENEMIGA)!';
      } else if (playerLevel >= 5 && this.lastMilestoneLevel < 5) {
        this.lastMilestoneLevel = 5;
        milestoneMsg = 'EVOLUCIÓN LVL 5 [CABLE TRAMPA]: ¡TRIÁNGULO LÁSER ACTIVO!';
      }
    }

    return milestoneMsg;
  }

  public update(
    dt: number,
    player: Player,
    playerLevel: number,
    enemies: Adware[]
  ): CompanionUpdateOutput {
    const damagedEnemies: { x: number; y: number; damage: number; color: string }[] = [];
    const killedEnemies: Adware[] = [];
    let screenShakeIntensity = 0;

    if (this.craterCooldown > 0) {
      this.craterCooldown = Math.max(0, this.craterCooldown - dt);
    }

    const milestoneMessage =
      this.branch !== 'NONE' ? this.reconfigureUnitsForTier(playerLevel, player) : null;

    const baseContactDamage = Math.round(
      (this.branch === 'BRUTE' ? 38 : this.branch === 'BOTNET' ? 18 : 22) *
        player.damageMultiplier +
        this.bonusDamageStat
    );

    const searchRadius =
      this.branch === 'BOTNET' && playerLevel >= 20
        ? 950
        : this.branch === 'BRUTE'
        ? 260
        : 200;

    const applyDamageToEnemy = (
      enemy: Adware,
      dmg: number,
      kbX: number,
      kbY: number,
      color: string,
      fromBruteImpact: boolean = false
    ) => {
      if (!enemy.active) return;
      enemy.takeDamage(dmg, kbX, kbY);
      damagedEnemies.push({ x: enemy.x, y: enemy.y, damage: dmg, color });

      if (!enemy.active) {
        killedEnemies.push(enemy);
        if (fromBruteImpact && this.branch === 'BRUTE' && playerLevel >= 20) {
          this.shockwaves.push(new BruteShockwave(enemy.x, enemy.y, Math.round(dmg * 1.45)));
          screenShakeIntensity = Math.max(screenShakeIntensity, 9);
        }
      }
    };

    // Actualizar cada cuadrado marrón acompañante
    for (let i = 0; i < this.units.length; i++) {
      const unit = this.units[i];
      unit.patrolAngle += dt * (this.branch === 'TRIPWIRE' ? 1.85 : 2.3);

      // Si es Cable Trampa en Lvl 5 o Lvl 20, orbitan estratégicamente en un radio amplio para tender la red de láseres
      if (this.branch === 'TRIPWIRE' && playerLevel >= 5) {
        const orbitRadius = playerLevel >= 20 ? 270 : 195;
        const desiredAngle = unit.patrolAngle + (i * Math.PI * 2) / this.units.length;
        const targetX = player.x + Math.cos(desiredAngle) * orbitRadius;
        const targetY = player.y + Math.sin(desiredAngle) * orbitRadius;
        unit.x += (targetX - unit.x) * Math.min(1, dt * 6);
        unit.y += (targetY - unit.y) * Math.min(1, dt * 6);
      } else {
        // Buscar enemigo dentro del radio alrededor del jugador (o prioridad Mente Colmena Lvl 5)
        let target: Adware | null = null;
        let bestScore = Infinity;

        for (const e of enemies) {
          if (!e.active) continue;
          const distToPlayer = Math.hypot(e.x - player.x, e.y - player.y);
          if (distToPlayer > searchRadius) continue;

          const distToUnit = Math.hypot(e.x - unit.x, e.y - unit.y);
          const score =
            this.branch === 'BOTNET' && playerLevel >= 5
              ? distToPlayer * 0.7 + distToUnit * 0.3 + i * 12
              : distToUnit;

          if (score < bestScore) {
            bestScore = score;
            target = e;
          }
        }

        if (target) {
          const dx = target.x - unit.x;
          const dy = target.y - unit.y;
          const dist = Math.hypot(dx, dy) || 1;
          unit.x += (dx / dist) * unit.speed * dt;
          unit.y += (dy / dist) * unit.speed * dt;
        } else {
          // Patrulla libre alrededor del jugador en un radio de ~115-160px
          const patrolR = this.branch === 'TRIPWIRE' ? 175 : 115 + (i % 3) * 24;
          const desiredX =
            player.x + Math.cos(unit.patrolAngle + (i * Math.PI * 2) / this.units.length) * patrolR;
          const desiredY =
            player.y + Math.sin(unit.patrolAngle + (i * Math.PI * 2) / this.units.length) * patrolR;
          const dx = desiredX - unit.x;
          const dy = desiredY - unit.y;
          const dist = Math.hypot(dx, dy) || 1;
          const moveStep = Math.min(dist, unit.speed * 0.85 * dt);
          unit.x += (dx / dist) * moveStep;
          unit.y += (dy / dist) * moveStep;
        }
      }

      // Colisión de contacto continuo de cada cuadrado marrón contra enemigos
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const cd = unit.hitCooldowns.get(enemy) ?? 0;
        if (cd > 0) {
          unit.hitCooldowns.set(enemy, cd - dt);
          continue;
        }

        const dist = Math.hypot(enemy.x - unit.x, enemy.y - unit.y);
        if (dist <= (unit.size + enemy.size) * 0.52) {
          unit.hitCooldowns.set(enemy, this.branch === 'BOTNET' ? 0.18 : 0.24);

          const pushForce = this.branch === 'BRUTE' ? (playerLevel >= 5 ? 36 : 24) : 8;
          const nx = (enemy.x - unit.x) / (dist || 1);
          const ny = (enemy.y - unit.y) / (dist || 1);

          applyDamageToEnemy(
            enemy,
            baseContactDamage,
            nx * pushForce,
            ny * pushForce,
            '#f59e0b',
            this.branch === 'BRUTE'
          );

          // Fuerza Bruta Lvl 5: temblor de pantalla al golpear
          if (this.branch === 'BRUTE' && playerLevel >= 5) {
            screenShakeIntensity = Math.max(screenShakeIntensity, 5);
          }

          // Fuerza Bruta Lvl 10 (Masa Crítica): deja cráter temporal en el suelo
          if (
            this.branch === 'BRUTE' &&
            playerLevel >= 10 &&
            this.craterCooldown <= 0 &&
            this.craters.length < 6
          ) {
            this.craterCooldown = 0.45;
            this.craters.push(
              new BruteCraterZone(enemy.x, enemy.y, Math.max(10, Math.round(baseContactDamage * 0.4)))
            );
          }

          // La Botnet Lvl 10 (Ataque DDoS): probabilidad de generar un clon efímero
          if (
            this.branch === 'BOTNET' &&
            playerLevel >= 10 &&
            this.clones.length < 12 &&
            Math.random() < 0.35
          ) {
            this.clones.push(
              new EphemeralBotClone(unit.x, unit.y, Math.round(baseContactDamage * 0.85))
            );
          }
        }
      }
    }

    // Actualizar Clones Efímeros (Botnet Lvl 10)
    for (const clone of this.clones) {
      if (!clone.active) continue;
      const res = clone.update(dt, enemies);
      if (res.hitEnemy) {
        applyDamageToEnemy(res.hitEnemy, res.dmg, 0, 0, '#fde047', false);
      }
    }
    this.clones = this.clones.filter((c) => c.active);

    // Actualizar Cráteres (Fuerza Bruta Lvl 10)
    for (const crater of this.craters) {
      if (!crater.active) continue;
      const hits = crater.update(dt, enemies);
      for (const h of hits) {
        applyDamageToEnemy(h.enemy, h.damage, 0, 0, '#f97316', true);
      }
    }
    this.craters = this.craters.filter((c) => c.active);

    // Actualizar Ondas de Choque (Fuerza Bruta Lvl 20)
    for (const wave of this.shockwaves) {
      if (!wave.active) continue;
      const hits = wave.update(dt, enemies);
      for (const h of hits) {
        applyDamageToEnemy(h.enemy, h.damage, 0, 0, '#fbbf24', false);
      }
    }
    this.shockwaves = this.shockwaves.filter((w) => w.active);

    // Actualizar Haces Láser de Cable Trampa (Rama 3)
    if (this.branch === 'TRIPWIRE') {
      const segments = this.getTripwireSegments(player);
      const beamDamage = Math.round((26 + playerLevel * 2.5) * player.damageMultiplier + this.bonusDamageStat);
      const appliesFreeze = playerLevel >= 10;

      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const cd = this.tripwireTickCooldowns.get(enemy) ?? 0;
        if (cd > 0) {
          this.tripwireTickCooldowns.set(enemy, cd - dt);
          continue;
        }

        for (const seg of segments) {
          const d = this.pointToSegmentDist(enemy.x, enemy.y, seg.x1, seg.y1, seg.x2, seg.y2);
          if (d <= 10 + enemy.size * 0.45) {
            this.tripwireTickCooldowns.set(enemy, 0.2);
            if (appliesFreeze) {
              enemy.networkFreezeTimer = 1.8;
            }
            applyDamageToEnemy(
              enemy,
              beamDamage,
              0,
              0,
              appliesFreeze ? '#38bdf8' : '#ec4899',
              false
            );
            break;
          }
        }
      }
    }

    return {
      damagedEnemies,
      killedEnemies,
      screenShakeIntensity,
      milestoneMessage,
    };
  }

  private getTripwireSegments(
    player: Player
  ): { x1: number; y1: number; x2: number; y2: number }[] {
    const vertices = [{ x: player.x, y: player.y }, ...this.units.map((u) => ({ x: u.x, y: u.y }))];
    const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];

    if (vertices.length === 2) {
      segments.push({
        x1: vertices[0].x,
        y1: vertices[0].y,
        x2: vertices[1].x,
        y2: vertices[1].y,
      });
    } else if (vertices.length === 3) {
      // Triángulo láser (Lvl 5)
      for (let i = 0; i < 3; i++) {
        const next = (i + 1) % 3;
        segments.push({
          x1: vertices[i].x,
          y1: vertices[i].y,
          x2: vertices[next].x,
          y2: vertices[next].y,
        });
      }
    } else if (vertices.length >= 5) {
      // Estrella / Pentagrama y Malla completa (Lvl 20)
      for (let i = 0; i < vertices.length; i++) {
        for (let j = i + 1; j < vertices.length; j++) {
          segments.push({
            x1: vertices[i].x,
            y1: vertices[i].y,
            x2: vertices[j].x,
            y2: vertices[j].y,
          });
        }
      }
    }

    return segments;
  }

  private pointToSegmentDist(
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

  public draw(ctx: CanvasRenderingContext2D, player: Player, playerLevel: number): void {
    for (const crater of this.craters) {
      crater.draw(ctx);
    }
    for (const wave of this.shockwaves) {
      wave.draw(ctx);
    }

    // Radio de patrulla sutil en Nivel 1
    if (this.branch === 'NONE') {
      ctx.save();
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.14)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, 200, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Dibujar Haces Láser si la rama es Cable Trampa
    if (this.branch === 'TRIPWIRE') {
      const segments = this.getTripwireSegments(player);
      const isFiberOptic = playerLevel >= 10;

      ctx.save();
      ctx.strokeStyle = isFiberOptic ? '#00f0ff' : '#f43f5e';
      ctx.shadowColor = isFiberOptic ? '#38bdf8' : '#ec4899';
      ctx.shadowBlur = 18;
      ctx.lineWidth = playerLevel >= 20 ? 7 : 9;

      for (const seg of segments) {
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      }

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      for (const seg of segments) {
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Dibujar Clones Efímeros
    for (const clone of this.clones) {
      clone.draw(ctx);
    }

    // Dibujar los cuadrados marrones acompañantes
    for (const unit of this.units) {
      ctx.save();
      ctx.fillStyle = '#92400e';
      ctx.strokeStyle = this.branch === 'BRUTE' ? '#fbbf24' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#d97706';
      ctx.shadowBlur = 12;

      const half = unit.size / 2;
      ctx.fillRect(unit.x - half, unit.y - half, unit.size, unit.size);
      ctx.strokeRect(unit.x - half, unit.y - half, unit.size, unit.size);

      ctx.fillStyle = '#fde68a';
      ctx.fillRect(unit.x - half * 0.35, unit.y - half * 0.35, unit.size * 0.35, unit.size * 0.35);
      ctx.restore();
    }
  }
}
