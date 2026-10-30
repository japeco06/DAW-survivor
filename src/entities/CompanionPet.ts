import { Player } from './Player';
import { Adware } from './Adware';

export type CompanionBranch = 'NONE' | 'BRUTE' | 'BOTNET' | 'PINBALL';

interface CompanionUnit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  speed: number;
  patrolAngle: number;
  trailTimer: number;
  burstCooldown: number;
  hitCooldowns: WeakMap<Adware, number>;
}

class MalwareShrapnelFragment {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public angle: number;
  public size: number = 9;
  public damage: number;
  public active: boolean = true;
  private lifeTime: number = 0.42;
  private hitSet: Set<Adware> = new Set();

  constructor(x: number, y: number, angle: number, speed: number, damage: number) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
  }

  public update(dt: number, enemies: Adware[]): { enemy: Adware; dmg: number }[] {
    this.lifeTime -= dt;
    if (this.lifeTime <= 0) {
      this.active = false;
      return [];
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const hits: { enemy: Adware; dmg: number }[] = [];
    for (const e of enemies) {
      if (!e.active || this.hitSet.has(e)) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d <= (this.size + e.size) * 0.55) {
        this.hitSet.add(e);
        hits.push({ enemy: e, dmg: this.damage });
      }
    }

    return hits;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#f97316';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(this.size * 0.8, 0);
    ctx.lineTo(-this.size * 0.6, -this.size * 0.45);
    ctx.lineTo(-this.size * 0.6, this.size * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

class PinballCorruptionTrail {
  public x: number;
  public y: number;
  public size: number = 18;
  public damage: number;
  public duration: number = 1.25;
  public elapsed: number = 0;
  public active: boolean = true;

  constructor(x: number, y: number, damage: number) {
    this.x = x;
    this.y = y;
    this.damage = damage;
  }

  public update(dt: number): void {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.active = false;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.max(0.08, 1 - this.elapsed / this.duration);
    const half = (this.size * (0.65 + 0.35 * alpha)) / 2;
    ctx.save();
    ctx.fillStyle = `rgba(236, 72, 153, ${alpha * 0.42})`;
    ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.85})`;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 8 * alpha;
    ctx.fillRect(this.x - half, this.y - half, half * 2, half * 2);
    ctx.strokeRect(this.x - half, this.y - half, half * 2, half * 2);
    ctx.restore();
  }
}

class PinballKineticProjectile {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public size: number = 8;
  public damage: number;
  public active: boolean = true;
  private lifeTime: number = 1.2;
  private hitSet: Set<Adware> = new Set();

  constructor(x: number, y: number, dirX: number, dirY: number, speed: number, damage: number) {
    this.x = x;
    this.y = y;
    this.vx = dirX * speed;
    this.vy = dirY * speed;
    this.damage = damage;
  }

  public update(
    dt: number,
    enemies: Adware[],
    canvasWidth: number,
    canvasHeight: number
  ): { enemy: Adware; dmg: number }[] {
    this.lifeTime -= dt;
    if (
      this.lifeTime <= 0 ||
      this.x < -40 ||
      this.x > canvasWidth + 40 ||
      this.y < -40 ||
      this.y > canvasHeight + 40
    ) {
      this.active = false;
      return [];
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const hits: { enemy: Adware; dmg: number }[] = [];
    for (const e of enemies) {
      if (!e.active || this.hitSet.has(e)) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d <= (this.size + e.size) * 0.55) {
        this.hitSet.add(e);
        this.active = false;
        hits.push({ enemy: e, dmg: this.damage });
        break;
      }
    }

    return hits;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = '#00f0ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -this.size * 0.7);
    ctx.lineTo(this.size * 0.7, 0);
    ctx.lineTo(0, this.size * 0.7);
    ctx.lineTo(-this.size * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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
  damagedEnemies: { x: number; y: number; damage: number; color: string; isCrit?: boolean }[];
  killedEnemies: Adware[];
  screenShakeIntensity: number;
  milestoneMessage: string | null;
}

export class CompanionPet {
  public branch: CompanionBranch = 'NONE';
  public bonusDamageStat: number = 0;
  private units: CompanionUnit[] = [];
  private shrapnelFragments: MalwareShrapnelFragment[] = [];
  private pinballTrails: PinballCorruptionTrail[] = [];
  private pinballProjectiles: PinballKineticProjectile[] = [];
  private trailHitCooldowns: WeakMap<Adware, number> = new WeakMap();
  private craters: BruteCraterZone[] = [];
  private shockwaves: BruteShockwave[] = [];
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
    if (this.branch === 'PINBALL') return 'Mascota: Protocolo Pinball';
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
    const pinballAngles = [Math.PI * 0.22, Math.PI * 0.78, Math.PI * 1.38];
    for (let i = 0; i < count; i++) {
      const angle =
        this.branch === 'PINBALL'
          ? pinballAngles[i % pinballAngles.length]
          : (i * Math.PI * 2) / count;
      this.units.push({
        x: centerX + Math.cos(angle) * 75,
        y: centerY + Math.sin(angle) * 75,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        speed,
        patrolAngle: angle,
        trailTimer: 0,
        burstCooldown: 0,
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
        milestoneMsg = 'EVOLUCIÓN LVL 10 [LA BOTNET]: ¡PROPAGACIÓN DE MALWARE (METRALLA DIGITAL)!';
      } else if (playerLevel >= 5 && this.lastMilestoneLevel < 5) {
        this.lastMilestoneLevel = 5;
        milestoneMsg = 'EVOLUCIÓN LVL 5 [LA BOTNET]: ¡MENTE COLMENA (5 UNIDADES DEFENSORAS)!';
      }
    } else if (this.branch === 'PINBALL') {
      const targetCount = playerLevel >= 20 ? 3 : 1;
      const basePinballSpeed = 620;
      const speed = playerLevel >= 5 ? Math.round(basePinballSpeed * 1.5) : basePinballSpeed;
      if (this.units.length !== targetCount) {
        this.spawnUnits(targetCount, player.x, player.y, 24, speed);
      } else {
        for (const u of this.units) {
          u.size = 24;
          u.speed = speed;
          const currentLen = Math.hypot(u.vx, u.vy);
          if (currentLen < 10) {
            const angle = Math.PI * 0.25;
            u.vx = Math.cos(angle) * speed;
            u.vy = Math.sin(angle) * speed;
          } else {
            u.vx = (u.vx / currentLen) * speed;
            u.vy = (u.vy / currentLen) * speed;
          }
        }
      }

      if (playerLevel >= 20 && this.lastMilestoneLevel < 20) {
        this.lastMilestoneLevel = 20;
        milestoneMsg = 'EVOLUCIÓN LVL 20 [PINBALL]: ¡MULTIBOLA (3 MASCOTAS REBOTADORAS)!';
      } else if (playerLevel >= 10 && this.lastMilestoneLevel < 10) {
        this.lastMilestoneLevel = 10;
        milestoneMsg = 'EVOLUCIÓN LVL 10 [PINBALL]: ¡EXPLOSIÓN CINÉTICA (4 DISPAROS CARDINALES)!';
      } else if (playerLevel >= 5 && this.lastMilestoneLevel < 5) {
        this.lastMilestoneLevel = 5;
        milestoneMsg = 'EVOLUCIÓN LVL 5 [PINBALL]: ¡+50% VELOCIDAD Y ESTELA CORRUPTA!';
      }
    }

    return milestoneMsg;
  }

  public update(
    dt: number,
    player: Player,
    playerLevel: number,
    enemies: Adware[],
    canvasWidth: number = window.innerWidth,
    canvasHeight: number = window.innerHeight
  ): CompanionUpdateOutput {
    const damagedEnemies: { x: number; y: number; damage: number; color: string; isCrit?: boolean }[] = [];
    const killedEnemies: Adware[] = [];
    let screenShakeIntensity = 0;

    if (this.craterCooldown > 0) {
      this.craterCooldown = Math.max(0, this.craterCooldown - dt);
    }

    const milestoneMessage =
      this.branch !== 'NONE' ? this.reconfigureUnitsForTier(playerLevel, player) : null;

    const baseContactDamage = Math.round(
      (this.branch === 'BRUTE'
        ? 38
        : this.branch === 'BOTNET'
        ? 18
        : this.branch === 'PINBALL'
        ? 30
        : 22) *
        player.damageMultiplier +
        this.bonusDamageStat
    );

    const searchRadius =
      this.branch === 'BOTNET' && playerLevel >= 20
        ? 950
        : this.branch === 'BRUTE'
        ? 260
        : 200;

    const spawnMalwareShrapnelBurst = (originX: number, originY: number, shrapnelDmg: number) => {
      const fragmentCount = 8;
      for (let k = 0; k < fragmentCount; k++) {
        const angle = (k * Math.PI * 2) / fragmentCount;
        this.shrapnelFragments.push(
          new MalwareShrapnelFragment(originX, originY, angle, 370, shrapnelDmg)
        );
      }
    };

    const spawnKineticBurst = (originX: number, originY: number, burstDmg: number) => {
      const cardinalDirs = [
        { dx: 0, dy: -1 }, // Arriba
        { dx: 0, dy: 1 },  // Abajo
        { dx: -1, dy: 0 }, // Izquierda
        { dx: 1, dy: 0 },  // Derecha
      ];
      for (const dir of cardinalDirs) {
        this.pinballProjectiles.push(
          new PinballKineticProjectile(originX, originY, dir.dx, dir.dy, 560, burstDmg)
        );
      }
    };

    const applyDamageToEnemy = (
      enemy: Adware,
      dmg: number,
      kbX: number,
      kbY: number,
      color: string,
      fromBruteImpact: boolean = false,
      fromBotnetSquare: boolean = false
    ) => {
      if (!enemy.active) return;
      const isCrit = Math.random() < player.critChance;
      const finalDmg = isCrit ? dmg * 2 : dmg;
      enemy.takeDamage(finalDmg, kbX, kbY);
      damagedEnemies.push({ x: enemy.x, y: enemy.y, damage: finalDmg, color, isCrit });

      if (!enemy.active) {
        killedEnemies.push(enemy);
        if (fromBruteImpact && this.branch === 'BRUTE' && playerLevel >= 20) {
          this.shockwaves.push(new BruteShockwave(enemy.x, enemy.y, Math.round(finalDmg * 1.45)));
          screenShakeIntensity = Math.max(screenShakeIntensity, 9);
        }
        // Propagación de Malware (Botnet Lvl 10): al matar a un enemigo con un cuadrado, explota en metralla digital en área
        if (fromBotnetSquare && this.branch === 'BOTNET' && playerLevel >= 10) {
          spawnMalwareShrapnelBurst(
            enemy.x,
            enemy.y,
            Math.max(12, Math.round(baseContactDamage * 0.9))
          );
        }
      }
    };

    const findNearestEnemy = (fromX: number, fromY: number, exclude?: Adware): Adware | null => {
      let nearest: Adware | null = null;
      let minDst = Infinity;
      for (const e of enemies) {
        if (!e.active) continue;
        if (exclude && e === exclude) continue;
        const d = Math.hypot(e.x - fromX, e.y - fromY);
        if (d < minDst) {
          minDst = d;
          nearest = e;
        }
      }
      if (!nearest && exclude && exclude.active) {
        return exclude;
      }
      return nearest;
    };

    // Regla de apuntado para La Botnet:
    // - Enemigos estándar: máximo 1 mascota por objetivo.
    // - Mini-jefes (RANSOMWARE): hasta 3 mascotas pueden apuntar al mismo mini-jefe simultáneamente.
    const claimedBotnetTargetCounts = new Map<Adware, number>();

    // Actualizar cada cuadrado acompañante
    for (let i = 0; i < this.units.length; i++) {
      const unit = this.units[i];
      unit.patrolAngle += dt * 2.3;
      if (unit.burstCooldown > 0) {
        unit.burstCooldown = Math.max(0, unit.burstCooldown - dt);
      }

      if (this.branch === 'PINBALL') {
        // Rama 3 (Protocolo Pinball): independiente del jugador, línea recta a velocidad extrema y rebote en bordes
        unit.x += unit.vx * dt;
        unit.y += unit.vy * dt;

        const half = unit.size / 2;
        let bouncedX = 0; // -1 izq, 1 der
        let bouncedY = 0; // -1 arriba, 1 abajo

        if (unit.x <= half) {
          unit.x = half;
          unit.vx = Math.abs(unit.vx);
          bouncedX = -1;
        } else if (unit.x >= canvasWidth - half) {
          unit.x = canvasWidth - half;
          unit.vx = -Math.abs(unit.vx);
          bouncedX = 1;
        }

        if (unit.y <= half) {
          unit.y = half;
          unit.vy = Math.abs(unit.vy);
          bouncedY = -1;
        } else if (unit.y >= canvasHeight - half) {
          unit.y = canvasHeight - half;
          unit.vy = -Math.abs(unit.vy);
          bouncedY = 1;
        }

        const bouncedEdge = bouncedX !== 0 || bouncedY !== 0;
        if (bouncedEdge) {
          // 100% auto-aim: apuntar directamente al enemigo más cercano en pantalla en cada rebote
          const nearest = findNearestEnemy(unit.x, unit.y);
          const baseAngle = nearest
            ? Math.atan2(nearest.y - unit.y, nearest.x - unit.x)
            : Math.atan2(unit.vy, unit.vx);
          let nextVx = Math.cos(baseAngle) * unit.speed;
          let nextVy = Math.sin(baseAngle) * unit.speed;
          const minAxisSpeed = unit.speed * 0.25;

          if (bouncedX === -1 && nextVx < minAxisSpeed) nextVx = Math.max(minAxisSpeed, Math.abs(nextVx));
          if (bouncedX === 1 && nextVx > -minAxisSpeed) nextVx = -Math.max(minAxisSpeed, Math.abs(nextVx));
          if (bouncedY === -1 && nextVy < minAxisSpeed) nextVy = Math.max(minAxisSpeed, Math.abs(nextVy));
          if (bouncedY === 1 && nextVy > -minAxisSpeed) nextVy = -Math.max(minAxisSpeed, Math.abs(nextVy));

          const norm = Math.hypot(nextVx, nextVy) || 1;
          unit.vx = (nextVx / norm) * unit.speed;
          unit.vy = (nextVy / norm) * unit.speed;
        }

        // Lvl 10 (Explosión Cinética): al rebotar en un borde dispara 4 proyectiles (arriba, abajo, izquierda, derecha)
        if (bouncedEdge && playerLevel >= 10) {
          spawnKineticBurst(
            unit.x,
            unit.y,
            Math.max(14, Math.round(baseContactDamage * 0.65))
          );
        }

        // Lvl 5: deja una estela temporal de corrupción de datos que daña a los enemigos que la pisen
        if (playerLevel >= 5) {
          unit.trailTimer += dt;
          if (unit.trailTimer >= 0.032) {
            unit.trailTimer = 0;
            this.pinballTrails.push(
              new PinballCorruptionTrail(
                unit.x,
                unit.y,
                Math.max(10, Math.round(baseContactDamage * 0.45))
              )
            );
          }
        }
      } else {
        // Buscar enemigo dentro del radio alrededor del jugador (con límites de objetivo si es La Botnet)
        let target: Adware | null = null;
        let bestScore = Infinity;

        for (const e of enemies) {
          if (!e.active) continue;
          if (this.branch === 'BOTNET') {
            const maxPetsForTarget = e.malwareType === 'RANSOMWARE' ? 3 : 1;
            const currentClaims = claimedBotnetTargetCounts.get(e) ?? 0;
            if (currentClaims >= maxPetsForTarget) continue;
          }

          const distToPlayer = Math.hypot(e.x - player.x, e.y - player.y);
          if (distToPlayer > searchRadius) continue;

          const distToUnit = Math.hypot(e.x - unit.x, e.y - unit.y);
          const score =
            this.branch === 'BOTNET' && playerLevel >= 5
              ? distToPlayer * 0.7 + distToUnit * 0.3
              : distToUnit;

          if (score < bestScore) {
            bestScore = score;
            target = e;
          }
        }

        if (target) {
          if (this.branch === 'BOTNET') {
            claimedBotnetTargetCounts.set(
              target,
              (claimedBotnetTargetCounts.get(target) ?? 0) + 1
            );
          }
          const dx = target.x - unit.x;
          const dy = target.y - unit.y;
          const dist = Math.hypot(dx, dy) || 1;
          unit.x += (dx / dist) * unit.speed * dt;
          unit.y += (dy / dist) * unit.speed * dt;
        } else {
          // Si sobran cuadrados sin objetivo disponible, orbitan alrededor del jugador
          const patrolR =
            this.branch === 'BOTNET' ? 95 + (i % 3) * 18 : 115 + (i % 3) * 24;
          const orbitAngle = unit.patrolAngle + (i * Math.PI * 2) / this.units.length;
          const desiredX = player.x + Math.cos(orbitAngle) * patrolR;
          const desiredY = player.y + Math.sin(orbitAngle) * patrolR;
          const dx = desiredX - unit.x;
          const dy = desiredY - unit.y;
          const dist = Math.hypot(dx, dy) || 1;
          const moveStep = Math.min(dist, unit.speed * 0.9 * dt);
          unit.x += (dx / dist) * moveStep;
          unit.y += (dy / dist) * moveStep;
        }
      }

      // Colisión de contacto / perforación de cada cuadrado contra enemigos (ignora Mega-Jefes)
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const cd = unit.hitCooldowns.get(enemy) ?? 0;
        if (cd > 0) {
          unit.hitCooldowns.set(enemy, cd - dt);
          continue;
        }

        const dist = Math.hypot(enemy.x - unit.x, enemy.y - unit.y);
        if (dist <= (unit.size + enemy.size) * 0.52) {
          unit.hitCooldowns.set(
            enemy,
            this.branch === 'BOTNET' ? 0.18 : this.branch === 'PINBALL' ? 0.2 : 0.24
          );

          const pushForce =
            this.branch === 'BRUTE'
              ? playerLevel >= 5
                ? 36
                : 24
              : this.branch === 'PINBALL'
              ? 6
              : 8;
          const nx = (enemy.x - unit.x) / (dist || 1);
          const ny = (enemy.y - unit.y) / (dist || 1);

          applyDamageToEnemy(
            enemy,
            baseContactDamage,
            nx * pushForce,
            ny * pushForce,
            this.branch === 'PINBALL' ? '#ec4899' : '#f59e0b',
            this.branch === 'BRUTE',
            this.branch === 'BOTNET'
          );

          // Pinball: al rebotar contra un enemigo, 100% auto-aim directo hacia el enemigo más cercano en pantalla
          if (this.branch === 'PINBALL') {
            const nearestTarget = findNearestEnemy(unit.x, unit.y, enemy);
            if (nearestTarget) {
              const targetAngle = Math.atan2(nearestTarget.y - unit.y, nearestTarget.x - unit.x);
              unit.vx = Math.cos(targetAngle) * unit.speed;
              unit.vy = Math.sin(targetAngle) * unit.speed;
            }
          }

          // Pinball Lvl 10 (Explosión Cinética): al impactar a un enemigo dispara 4 proyectiles cardinales
          if (this.branch === 'PINBALL' && playerLevel >= 10 && unit.burstCooldown <= 0) {
            unit.burstCooldown = 0.08;
            spawnKineticBurst(
              unit.x,
              unit.y,
              Math.max(14, Math.round(baseContactDamage * 0.65))
            );
          }

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
              new BruteCraterZone(
                enemy.x,
                enemy.y,
                Math.max(10, Math.round(baseContactDamage * 0.4))
              )
            );
          }
        }
      }
    }

    // Actualizar Estela de Corrupción de Datos (Pinball Lvl 5)
    for (const trail of this.pinballTrails) {
      trail.update(dt);
    }
    this.pinballTrails = this.pinballTrails.filter((t) => t.active);

    if (this.branch === 'PINBALL' && this.pinballTrails.length > 0) {
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const cd = this.trailHitCooldowns.get(enemy) ?? 0;
        if (cd > 0) {
          this.trailHitCooldowns.set(enemy, cd - dt);
          continue;
        }
        for (const trail of this.pinballTrails) {
          const d = Math.hypot(enemy.x - trail.x, enemy.y - trail.y);
          if (d <= (trail.size + enemy.size) * 0.5) {
            this.trailHitCooldowns.set(enemy, 0.22);
            applyDamageToEnemy(enemy, trail.damage, 0, 0, '#00f0ff', false, false);
            break;
          }
        }
      }
    }

    // Actualizar Proyectiles de Explosión Cinética (Pinball Lvl 10)
    for (const proj of this.pinballProjectiles) {
      if (!proj.active) continue;
      const hits = proj.update(dt, enemies, canvasWidth, canvasHeight);
      for (const h of hits) {
        applyDamageToEnemy(h.enemy, h.dmg, 0, 0, '#00f0ff', false, false);
      }
    }
    this.pinballProjectiles = this.pinballProjectiles.filter((p) => p.active);

    // Actualizar Fragmentos de Metralla Digital (Propagación de Malware - Botnet Lvl 10)
    for (const frag of this.shrapnelFragments) {
      if (!frag.active) continue;
      const hits = frag.update(dt, enemies);
      for (const h of hits) {
        applyDamageToEnemy(h.enemy, h.dmg, 0, 0, '#fde047', false, false);
      }
    }
    this.shrapnelFragments = this.shrapnelFragments.filter((f) => f.active);

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

    return {
      damagedEnemies,
      killedEnemies,
      screenShakeIntensity,
      milestoneMessage,
    };
  }

  public draw(ctx: CanvasRenderingContext2D, player: Player, _playerLevel: number): void {
    for (const crater of this.craters) {
      crater.draw(ctx);
    }
    for (const wave of this.shockwaves) {
      wave.draw(ctx);
    }
    for (const trail of this.pinballTrails) {
      trail.draw(ctx);
    }
    for (const proj of this.pinballProjectiles) {
      proj.draw(ctx);
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

    // Dibujar Fragmentos de Metralla Digital (Propagación de Malware)
    for (const frag of this.shrapnelFragments) {
      frag.draw(ctx);
    }

    // Dibujar los cuadrados acompañantes
    for (const unit of this.units) {
      ctx.save();
      ctx.fillStyle = this.branch === 'PINBALL' ? '#be185d' : '#92400e';
      ctx.strokeStyle =
        this.branch === 'BRUTE'
          ? '#fbbf24'
          : this.branch === 'PINBALL'
          ? '#00f0ff'
          : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.shadowColor = this.branch === 'PINBALL' ? '#ec4899' : '#d97706';
      ctx.shadowBlur = 12;

      const half = unit.size / 2;
      ctx.fillRect(unit.x - half, unit.y - half, unit.size, unit.size);
      ctx.strokeRect(unit.x - half, unit.y - half, unit.size, unit.size);

      ctx.fillStyle = this.branch === 'PINBALL' ? '#00f0ff' : '#fde68a';
      ctx.fillRect(unit.x - half * 0.35, unit.y - half * 0.35, unit.size * 0.35, unit.size * 0.35);
      ctx.restore();
    }
  }
}
