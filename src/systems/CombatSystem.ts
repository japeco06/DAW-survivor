import { Entity } from '../entities/Entity';
import { Player } from '../entities/Player';
import { Adware, MalwareType } from '../entities/Adware';
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
}

export interface CombatEvents {
  enemiesKilled: number;
  destroyedEnemies: DestroyedEnemyInfo[];
  damagedEnemies: DamagedEnemyInfo[];
  playerHit: boolean;
  shotsFired: number;
  homingShotsFired: number;
  vampirismHeals: number;
}

export class FirewallPulseRing {
  public x: number;
  public y: number;
  public radius: number = 18;
  public maxRadius: number;
  public damage: number;
  public active: boolean = true;
  private expansionSpeed: number = 340;
  private hitEnemies: Set<Adware> = new Set();

  constructor(x: number, y: number, maxRadius: number, damage: number) {
    this.x = x;
    this.y = y;
    this.maxRadius = maxRadius;
    this.damage = damage;
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
    ctx.fillStyle = `rgba(255, 115, 0, ${alpha * 0.16})`;
    ctx.strokeStyle = `rgba(255, 136, 0, ${alpha})`;
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
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
  public active: boolean = true;
  private lifeTime: number = 2.4;
  private hitEnemies: Set<Adware> = new Set();

  constructor(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    thickness: number
  ) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.thickness = thickness;
  }

  public update(
    dt: number,
    enemies: Adware[],
    canvasWidth: number,
    canvasHeight: number
  ): { enemy: Adware; damage: number; blocked: boolean }[] {
    this.lifeTime -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const margin = 100;
    if (
      this.lifeTime <= 0 ||
      this.x < -margin ||
      this.x > canvasWidth + margin ||
      this.y < -margin ||
      this.y > canvasHeight + margin
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

    ctx.fillStyle = '#a855f7';
    ctx.shadowColor = '#d946ef';
    ctx.shadowBlur = 18;
    ctx.fillRect(-this.length / 2, -this.thickness / 2, this.length, this.thickness);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      -this.length * 0.42,
      -this.thickness * 0.25,
      this.length * 0.84,
      this.thickness * 0.5
    );
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
  // 1. Arma Base: Ráfaga de Firewall (Disparo recto)
  private fireTimer: number = 0;
  public fireCooldown: number = 0.42;
  public attackRange: number = 480;
  public projectileSpeed: number = 560;
  public projectileDamage: number = 25;
  public multiShotCount: number = 1;

  // 2. Nueva Arma: Ping Tracker (Proyectil azul perseguidor)
  public pingTrackerLevel: number = 0;
  private pingTimer: number = 0;
  public pingCooldown: number = 0.95;
  public pingDamage: number = 24;
  public pingSpeed: number = 430;

  // 3. Nueva Arma: Zona de Cuarentena (Área estática en el suelo con DoT)
  public quarantineLevel: number = 0;
  private quarantineTimer: number = 0;
  public quarantineCooldown: number = 3.6;
  public quarantineRadius: number = 82;
  public quarantineDamage: number = 14;
  public quarantineDuration: number = 4.6;

  // 4. Arma Orbital: Drones Antivirus
  public dronesLevel: number = 0;
  public firewallCount: number = 0;
  public firewallRadius: number = 82;
  public firewallDamage: number = 18;
  public firewallOrbitSpeed: number = 3.4;
  private firewallAngle: number = 0;
  private firewallHitCooldowns: WeakMap<Adware, number> = new WeakMap();

  // 5. Nueva Arma: Cortafuegos (Ataque en Área Expansivo)
  public firewallPulseLevel: number = 0;
  private firewallPulseTimer: number = 0;
  public firewallPulseCooldown: number = 3.2;
  public firewallPulseDamage: number = 32;
  public firewallPulseMaxRadius: number = 175;
  public firewallPulses: FirewallPulseRing[] = [];

  // 6. Nueva Arma: Rayo SQL Injection (Láser Penetrante)
  public sqlBeamLevel: number = 0;
  private sqlBeamTimer: number = 0;
  public sqlBeamCooldown: number = 2.5;
  public sqlBeamDamage: number = 38;
  public sqlBeamThickness: number = 18;
  public sqlBeamSpeed: number = 720;
  public sqlBeams: SqlInjectionBeam[] = [];

  // 7. Proyectiles enemigos (disparados por el Troyano Tirador)
  public enemyProjectiles: EnemyProjectile[] = [];

  public update(
    dt: number,
    player: Player,
    enemies: Adware[],
    projectiles: Projectile[],
    pingProjectiles: PingProjectile[],
    quarantineZones: QuarantineZone[],
    canvasWidth: number = 1920,
    canvasHeight: number = 1080
  ): CombatEvents {
    this.fireTimer += dt;
    this.pingTimer += dt;
    this.quarantineTimer += dt;
    this.firewallPulseTimer += dt;
    this.sqlBeamTimer += dt;
    this.firewallAngle += dt * this.firewallOrbitSpeed;

    const destroyedEnemies: DestroyedEnemyInfo[] = [];
    const damagedEnemies: DamagedEnemyInfo[] = [];
    let enemiesKilled = 0;
    let playerHit = false;
    let shotsFired = 0;
    let homingShotsFired = 0;
    let vampirismHeals = 0;

    const tryTriggerVampirism = () => {
      if (player.vampirismChance > 0 && Math.random() < player.vampirismChance) {
        const prevHp = player.hp;
        player.heal(1);
        if (player.hp > prevHp) {
          vampirismHeals++;
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
      }
    };

    const computePlayerHitDamage = (baseDamage: number): { dmg: number; isCrit: boolean } => {
      const scaled = Math.round(baseDamage * player.damageMultiplier);
      if (player.critChance > 0 && Math.random() < player.critChance) {
        return { dmg: scaled * 2, isCrit: true };
      }
      return { dmg: scaled, isCrit: false };
    };

    const effectiveFireCooldown = this.fireCooldown / Math.max(0.5, player.fireRateMultiplier);
    const effectivePingCooldown = this.pingCooldown / Math.max(0.5, player.fireRateMultiplier);

    // --- ARMA 1: Ráfaga de Firewall (Disparo recto — deshabilitado en Agente Morcillita) ---
    if (!player.isSummoner && player.active && this.fireTimer >= effectiveFireCooldown) {
      const targets = this.findNearestEnemies(player, enemies, this.multiShotCount);
      if (targets.length > 0) {
        this.fireTimer = 0;
        shotsFired++;

        for (let i = 0; i < this.multiShotCount; i++) {
          const target = targets[i % targets.length];
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const baseAngle = Math.atan2(dy, dx);

          const spreadIndex = Math.floor(i / targets.length);
          const spreadOffset =
            targets.length < this.multiShotCount
              ? (i - (this.multiShotCount - 1) / 2) * 0.14
              : spreadIndex * 0.12;

          const finalAngle = baseAngle + spreadOffset;
          const hitCalc = computePlayerHitDamage(this.projectileDamage);

          projectiles.push(
            new Projectile(
              player.x,
              player.y,
              Math.cos(finalAngle),
              Math.sin(finalAngle),
              this.projectileSpeed,
              hitCalc.dmg
            )
          );
        }
      }
    }

    // --- ARMA 2: Ping Tracker (Proyectiles azules perseguidores) ---
    if (player.active && this.pingTrackerLevel > 0 && this.pingTimer >= effectivePingCooldown) {
      const activeEnemies = enemies.filter((e) => e.active);
      if (activeEnemies.length > 0) {
        this.pingTimer = 0;
        homingShotsFired++;

        const projectilesToSpawn = 1 + Math.floor((this.pingTrackerLevel - 1) / 2);
        for (let i = 0; i < projectilesToSpawn; i++) {
          const target = activeEnemies[i % activeEnemies.length];
          const angle =
            Math.atan2(target.y - player.y, target.x - player.x) +
            (i - (projectilesToSpawn - 1) / 2) * 0.35;
          const hitCalc = computePlayerHitDamage(this.pingDamage);

          pingProjectiles.push(
            new PingProjectile(
              player.x,
              player.y,
              Math.cos(angle),
              Math.sin(angle),
              this.pingSpeed,
              hitCalc.dmg
            )
          );
        }
      }
    }

    // --- ARMA 3: Zona de Cuarentena (Área estática en el suelo con DoT) ---
    if (player.active && this.quarantineLevel > 0 && this.quarantineTimer >= this.quarantineCooldown) {
      this.quarantineTimer = 0;

      // Desplegar la zona en la posición de un enemigo cercano o en la posición actual del jugador
      const nearest = this.findNearestEnemies(player, enemies, 1)[0];
      const spawnX = nearest ? (player.x + nearest.x) * 0.5 : player.x;
      const spawnY = nearest ? (player.y + nearest.y) * 0.5 : player.y;

      quarantineZones.push(
        new QuarantineZone(
          spawnX,
          spawnY,
          this.quarantineRadius,
          this.quarantineDamage,
          this.quarantineDuration
        )
      );
    }

    // --- ARMA 4: Cortafuegos (Anillo de energía expansivo alrededor del Agente) ---
    const effectivePulseCooldown =
      this.firewallPulseCooldown / Math.max(0.5, player.fireRateMultiplier);
    if (
      player.active &&
      this.firewallPulseLevel > 0 &&
      this.firewallPulseTimer >= effectivePulseCooldown
    ) {
      this.firewallPulseTimer = 0;
      const pulseHit = computePlayerHitDamage(this.firewallPulseDamage);
      this.firewallPulses.push(
        new FirewallPulseRing(player.x, player.y, this.firewallPulseMaxRadius, pulseHit.dmg)
      );
    }

    // --- ARMA 5: Rayo SQL Injection (Láser grueso penetrante en línea recta) ---
    const effectiveSqlCooldown =
      this.sqlBeamCooldown / Math.max(0.5, player.fireRateMultiplier);
    if (player.active && this.sqlBeamLevel > 0 && this.sqlBeamTimer >= effectiveSqlCooldown) {
      const nearest = this.findNearestEnemies(player, enemies, 1)[0];
      const angle = nearest
        ? Math.atan2(nearest.y - player.y, nearest.x - player.x)
        : this.firewallAngle;
      this.sqlBeamTimer = 0;
      shotsFired++;
      const beamHit = computePlayerHitDamage(this.sqlBeamDamage);
      this.sqlBeams.push(
        new SqlInjectionBeam(
          player.x,
          player.y,
          angle,
          this.sqlBeamSpeed,
          beamHit.dmg,
          this.sqlBeamThickness
        )
      );
    }

    // --- COLISIONES: Ráfaga de Firewall vs Enemigos ---
    for (const proj of projectiles) {
      if (!proj.active) continue;

      for (const enemy of enemies) {
        if (!enemy.active) continue;

        if (CombatSystem.checkAABBCollision(proj, enemy)) {
          proj.active = false;
          const sourceX = proj.x - proj.vx * 0.045;
          const sourceY = proj.y - proj.vy * 0.045;

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
          enemy.takeDamage(proj.damage, (dx / dist) * 6, (dy / dist) * 6);
          tryTriggerVampirism();

          damagedEnemies.push({
            x: enemy.x,
            y: enemy.y,
            damage: proj.damage,
            color: enemy.color,
          });

          registerEnemyKillIfDead(enemy);
          break;
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
          enemy.takeDamage(ping.damage, (dx / dist) * 8, (dy / dist) * 8);
          tryTriggerVampirism();

          damagedEnemies.push({
            x: enemy.x,
            y: enemy.y,
            damage: ping.damage,
            color: '#0088ff',
          });

          registerEnemyKillIfDead(enemy);
          break;
        }
      }
    }

    // --- ACTUALIZACIÓN Y DAÑO CONTINUO: Zonas de Cuarentena ---
    for (const zone of quarantineZones) {
      if (!zone.active) continue;
      const zoneHits = zone.update(dt, enemies);

      for (const hit of zoneHits) {
        if (!hit.enemy.active) continue;
        hit.enemy.takeDamage(hit.damage, 0, 0);

        damagedEnemies.push({
          x: hit.enemy.x,
          y: hit.enemy.y,
          damage: hit.damage,
          color: '#10b981',
        });

        registerEnemyKillIfDead(hit.enemy);
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
        hit.enemy.takeDamage(hit.damage, (dx / dist) * 18, (dy / dist) * 18);
        tryTriggerVampirism();

        damagedEnemies.push({
          x: hit.enemy.x,
          y: hit.enemy.y,
          damage: hit.damage,
          color: '#ff8800',
        });

        registerEnemyKillIfDead(hit.enemy);
      }
    }
    this.firewallPulses = this.firewallPulses.filter((p) => p.active);

    // --- ACTUALIZACIÓN Y DAÑO PENETRANTE: Rayo SQL Injection ---
    for (const beam of this.sqlBeams) {
      if (!beam.active) continue;
      const beamHits = beam.update(dt, enemies, canvasWidth, canvasHeight);
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
        hit.enemy.takeDamage(hit.damage, (dx / dist) * 10, (dy / dist) * 10);
        tryTriggerVampirism();

        damagedEnemies.push({
          x: hit.enemy.x,
          y: hit.enemy.y,
          damage: hit.damage,
          color: '#d946ef',
        });

        registerEnemyKillIfDead(hit.enemy);
      }
    }
    this.sqlBeams = this.sqlBeams.filter((b) => b.active);

    // --- COLISIONES: Drones Antivirus (Arma Orbital) vs Enemigos ---
    if (player.active && this.firewallCount > 0) {
      const nodes = this.getFirewallNodePositions(player);
      const nodeHalfSize = 9;

      for (const enemy of enemies) {
        if (!enemy.active) continue;

        const currentCd = this.firewallHitCooldowns.get(enemy) ?? 0;
        if (currentCd > 0) {
          this.firewallHitCooldowns.set(enemy, currentCd - dt);
          continue;
        }

        const enemyBounds = enemy.getBounds();
        for (const node of nodes) {
          const hit =
            node.x - nodeHalfSize < enemyBounds.right &&
            node.x + nodeHalfSize > enemyBounds.left &&
            node.y - nodeHalfSize < enemyBounds.bottom &&
            node.y + nodeHalfSize > enemyBounds.top;

          if (hit) {
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const dist = Math.hypot(dx, dy) || 1;
            enemy.takeDamage(this.firewallDamage, (dx / dist) * 14, (dy / dist) * 14);
            this.firewallHitCooldowns.set(enemy, 0.25);

            damagedEnemies.push({
              x: enemy.x,
              y: enemy.y,
              damage: this.firewallDamage,
              color: '#ff8800',
            });

            registerEnemyKillIfDead(enemy);
            break;
          }
        }
      }
    }

    // --- PROYECTILES ENEMIGOS (Troyano Tirador) ---
    for (const enemy of enemies) {
      if (enemy.active && enemy instanceof TrojanShooter && enemy.pendingProjectiles.length > 0) {
        this.enemyProjectiles.push(...enemy.pendingProjectiles);
        enemy.pendingProjectiles = [];
      }
    }

    for (const eProj of this.enemyProjectiles) {
      if (!eProj.active) continue;
      eProj.update(dt, canvasWidth, canvasHeight);

      if (eProj.active && player.active && CombatSystem.checkAABBCollision(player, eProj)) {
        eProj.active = false;
        if (player.takeDamage(eProj.damage)) {
          playerHit = true;
        }
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
          } else if (enemy.malwareType === 'HARDWARE_BOX') {
            // Obstáculo estático: empuja ligeramente al jugador hacia afuera sin dañarlo
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
    };
  }

  public getActiveWeaponsList(player?: Player): string[] {
    const list: string[] = [];
    if (player?.isSummoner && player.companion) {
      list.push(player.companion.getBranchDisplayName(1));
    } else {
      list.push('Ráfaga Firewall');
    }
    if (this.pingTrackerLevel > 0) {
      list.push(`Ping Tracker v${this.pingTrackerLevel}`);
    }
    if (this.quarantineLevel > 0) {
      list.push(`Zona Cuarentena v${this.quarantineLevel}`);
    }
    if (this.dronesLevel > 0) {
      list.push(`Drones Antivirus v${this.dronesLevel}`);
    }
    if (this.firewallPulseLevel > 0) {
      list.push(`Cortafuegos v${this.firewallPulseLevel}`);
    }
    if (this.sqlBeamLevel > 0) {
      list.push(`Rayo SQL v${this.sqlBeamLevel}`);
    }
    return list;
  }

  public getFirewallNodePositions(player: Player): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < this.firewallCount; i++) {
      const angle = this.firewallAngle + (i * Math.PI * 2) / this.firewallCount;
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

    if (this.firewallCount <= 0 || !player.active) return;

    const nodes = this.getFirewallNodePositions(player);

    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, this.firewallRadius, 0, Math.PI * 2);
    ctx.stroke();

    for (const node of nodes) {
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(node.x - 6, node.y - 6, 12, 12);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(node.x - 2, node.y - 2, 4, 4);
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
