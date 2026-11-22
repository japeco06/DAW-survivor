/**
 * Eventos dinámicos de terreno exclusivos del Modo Pesadilla (Mapa Infinito).
 * Generan balizas explorables alrededor del jugador con mecánicas de riesgo-recompensa,
 * bufos temporales, trampas EMP y tormentas telegrafiadas.
 */
import { Player } from '../entities/Player';
import { Adware } from '../entities/Adware';
import { i18n } from '../utils/i18n';
import type { WorldEnvironment } from './WorldEnvironment';

export type TerrainEventType =
  | 'COOLING_SERVER'
  | 'EMP_PYLON'
  | 'CORRUPTED_VAULT'
  | 'DATA_STORM';

export type HackDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface TerrainNode {
  id: number;
  type: TerrainEventType;
  x: number;
  y: number;
  radius: number;
  progress: number;
  duration: number;
  maxLifetime: number;
  active: boolean;
  detonated: boolean;
  pulsePhase: number;
  hackSequence: HackDirection[];
  hackStep: number;
  hackBonusTriggered: boolean;
}

export interface TerrainUpdateResult {
  coolingActivated: boolean;
  empDetonation: { x: number; y: number; radius: number; damage: number } | null;
  vaultReward: { x: number; y: number; coins: number; xp: number; isCritHack?: boolean } | null;
  hackCritCompleted: { x: number; y: number; type: TerrainEventType } | null;
  stormBlast: {
    x: number;
    y: number;
    radius: number;
    damageToEnemies: number;
    hitPlayer: boolean;
    hitPlayers: Player[];
  } | null;
}

export class TerrainEventSystem {
  public nodes: TerrainNode[] = [];
  private nextId: number = 1;
  private spawnTimer: number = 4.0;
  private stormTimer: number = 9.0;

  public reset(playerX: number, playerY: number, worldEnv?: WorldEnvironment): void {
    this.nodes = [];
    this.nextId = 1;
    this.spawnTimer = 3.0;
    this.stormTimer = 9.5;
    this.spawnRandomEventAround(playerX, playerY, 'COOLING_SERVER', 480, 760, worldEnv);
    this.spawnRandomEventAround(playerX, playerY, 'CORRUPTED_VAULT', 640, 980, worldEnv);
    this.spawnRandomEventAround(playerX, playerY, 'EMP_PYLON', 520, 860, worldEnv);
  }

  private generateHackSequence(): HackDirection[] {
    const dirs: HackDirection[] = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
    return [
      dirs[Math.floor(Math.random() * 4)],
      dirs[Math.floor(Math.random() * 4)],
      dirs[Math.floor(Math.random() * 4)],
      dirs[Math.floor(Math.random() * 4)],
    ];
  }

  public spawnArenaEvent(
    canvasWidth: number,
    canvasHeight: number,
    forcedType?: TerrainEventType
  ): void {
    const margin = 170;
    const x = margin + Math.random() * Math.max(200, canvasWidth - margin * 2);
    const y = margin + Math.random() * Math.max(200, canvasHeight - margin * 2);
    let type: TerrainEventType = forcedType ?? 'CORRUPTED_VAULT';
    if (!forcedType) {
      const r = Math.random();
      type = r < 0.55 ? 'CORRUPTED_VAULT' : r < 0.8 ? 'COOLING_SERVER' : 'EMP_PYLON';
    }
    const config =
      type === 'COOLING_SERVER'
        ? { radius: 92, duration: 1.5, life: 45 }
        : type === 'EMP_PYLON'
        ? { radius: 84, duration: 0.75, life: 45 }
        : { radius: 104, duration: 2.5, life: 55 };

    this.nodes.push({
      id: this.nextId++,
      type,
      x,
      y,
      radius: config.radius,
      progress: 0,
      duration: config.duration,
      maxLifetime: config.life,
      active: true,
      detonated: false,
      pulsePhase: Math.random() * Math.PI * 2,
      hackSequence: this.generateHackSequence(),
      hackStep: 0,
      hackBonusTriggered: false,
    });
  }

  public handleHackDirectionInput(
    player: Player,
    dir: HackDirection
  ): { matched: boolean; completed: boolean; node: TerrainNode | null } {
    let target: TerrainNode | null = null;
    let bestDist = Infinity;
    for (const node of this.nodes) {
      if (!node.active || node.type === 'DATA_STORM' || node.hackBonusTriggered) continue;
      const d = Math.hypot(player.x - node.x, player.y - node.y);
      if (d <= node.radius + 95 && d < bestDist) {
        bestDist = d;
        target = node;
      }
    }
    if (!target) return { matched: false, completed: false, node: null };

    const expected = target.hackSequence[target.hackStep];
    if (dir === expected) {
      target.hackStep++;
      if (target.hackStep >= target.hackSequence.length) {
        target.hackBonusTriggered = true;
        target.progress = target.duration;
        return { matched: true, completed: true, node: target };
      }
      return { matched: true, completed: false, node: target };
    } else {
      target.hackStep = dir === target.hackSequence[0] ? 1 : 0;
      return { matched: false, completed: false, node: target };
    }
  }

  private spawnRandomEventAround(
    px: number,
    py: number,
    forcedType?: TerrainEventType,
    minDist: number = 580,
    maxDist: number = 1280,
    worldEnv?: WorldEnvironment
  ): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    let x = px + Math.cos(angle) * dist;
    let y = py + Math.sin(angle) * dist;

    let type: TerrainEventType = forcedType ?? 'COOLING_SERVER';
    if (!forcedType) {
      const r = Math.random();
      if (r < 0.36) type = 'COOLING_SERVER';
      else if (r < 0.7) type = 'EMP_PYLON';
      else type = 'CORRUPTED_VAULT';
    }

    const config =
      type === 'COOLING_SERVER'
        ? { radius: 92, duration: 1.4, life: 45 }
        : type === 'EMP_PYLON'
        ? { radius: 80, duration: 0.45, life: 45 }
        : type === 'CORRUPTED_VAULT'
        ? { radius: 102, duration: 2.6, life: 55 }
        : { radius: 128, duration: 1.85, life: 4 };

    if (worldEnv?.isInfinite && type !== 'DATA_STORM') {
      const clearPos = worldEnv.findClearSpawnPosition(x, y, config.radius * 0.55);
      x = clearPos.x;
      y = clearPos.y;
    }

    this.nodes.push({
      id: this.nextId++,
      type,
      x,
      y,
      radius: config.radius,
      progress: 0,
      duration: config.duration,
      maxLifetime: config.life,
      active: true,
      detonated: false,
      pulsePhase: Math.random() * Math.PI * 2,
      hackSequence: this.generateHackSequence(),
      hackStep: 0,
      hackBonusTriggered: false,
    });
  }

  public update(
    dt: number,
    player: Player,
    elapsedTime: number,
    extraPlayers?: Player[],
    worldEnv?: WorldEnvironment
  ): TerrainUpdateResult {
    const result: TerrainUpdateResult = {
      coolingActivated: false,
      empDetonation: null,
      vaultReward: null,
      hackCritCompleted: null,
      stormBlast: null,
    };

    const allAlive: Player[] = [];
    if (player.active) allAlive.push(player);
    if (extraPlayers) {
      for (const ep of extraPlayers) {
        if (ep.active) allAlive.push(ep);
      }
    }
    const anchor = allAlive.length > 0 ? allAlive[Math.floor(Math.random() * allAlive.length)] : player;

    let activeObjectiveCount = 0;
    for (const n of this.nodes) {
      if (n.active && n.type !== 'DATA_STORM') activeObjectiveCount++;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 8.5;
      if (activeObjectiveCount < 5) {
        this.spawnRandomEventAround(anchor.x, anchor.y, undefined, 580, 1280, worldEnv);
      }
    }

    this.stormTimer -= dt;
    if (this.stormTimer <= 0 && elapsedTime >= 20) {
      this.stormTimer = Math.max(6.5, 12.5 - elapsedTime / 140);
      const offsetDist = 60 + Math.random() * 190;
      const offsetAng = Math.random() * Math.PI * 2;
      this.spawnRandomEventAround(
        anchor.x + Math.cos(offsetAng) * offsetDist,
        anchor.y + Math.sin(offsetAng) * offsetDist,
        'DATA_STORM',
        0,
        24,
        worldEnv
      );
    }

    for (const node of this.nodes) {
      if (!node.active) continue;
      node.pulsePhase += dt * 3.5;

      let minDist = Infinity;
      for (const pl of allAlive) {
        const d = Math.hypot(pl.x - node.x, pl.y - node.y);
        if (d < minDist) minDist = d;
      }
      if (allAlive.length === 0) {
        minDist = Math.hypot(player.x - node.x, player.y - node.y);
      }

      if (minDist > 2500 && node.type !== 'DATA_STORM') {
        node.active = false;
        continue;
      }

      if (node.type === 'DATA_STORM') {
        node.progress += dt;
        if (node.progress >= node.duration && !node.detonated) {
          node.detonated = true;
          node.active = false;
          const hitPlayers: Player[] = [];
          for (const pl of allAlive) {
            if (Math.hypot(pl.x - node.x, pl.y - node.y) <= node.radius) {
              hitPlayers.push(pl);
            }
          }
          result.stormBlast = {
            x: node.x,
            y: node.y,
            radius: node.radius,
            damageToEnemies: Math.round(140 * (1 + elapsedTime / 240)),
            hitPlayer: hitPlayers.includes(player),
            hitPlayers,
          };
        }
        continue;
      }

      node.maxLifetime -= dt;
      if (node.maxLifetime <= 0) {
        node.active = false;
        continue;
      }

      if (minDist <= node.radius || node.hackBonusTriggered) {
        node.progress += dt;
        if (node.progress >= node.duration) {
          node.active = false;
          const critMult = node.hackBonusTriggered ? 3 : 1;
          if (node.hackBonusTriggered) {
            result.hackCritCompleted = { x: node.x, y: node.y, type: node.type };
          }
          if (node.type === 'COOLING_SERVER') {
            result.coolingActivated = true;
          } else if (node.type === 'EMP_PYLON') {
            result.empDetonation = {
              x: node.x,
              y: node.y,
              radius: node.hackBonusTriggered ? 560 : 440,
              damage: Math.round(170 * critMult * (1 + elapsedTime / 220)),
            };
          } else if (node.type === 'CORRUPTED_VAULT') {
            result.vaultReward = {
              x: node.x,
              y: node.y,
              coins: 10 * critMult,
              xp: 180 * (node.hackBonusTriggered ? 2 : 1),
              isCritHack: node.hackBonusTriggered,
            };
          }
        }
      } else if (node.progress > 0) {
        node.progress = Math.max(0, node.progress - dt * 0.45);
      }
    }

    this.nodes = this.nodes.filter((n) => n.active);
    return result;
  }

  public getColorForType(type: TerrainEventType): string {
    switch (type) {
      case 'COOLING_SERVER':
        return '#38bdf8';
      case 'EMP_PYLON':
        return '#a855f7';
      case 'CORRUPTED_VAULT':
        return '#fbbf24';
      case 'DATA_STORM':
        return '#ff1e42';
    }
  }

  public getLabelForType(type: TerrainEventType): string {
    switch (type) {
      case 'COOLING_SERVER':
        return i18n.t('SERVIDOR CRIO (+OVERCLOCK)', 'CRYO SERVER (+OVERCLOCK)');
      case 'EMP_PYLON':
        return i18n.t('BALIZA EMP (PULSO)', 'EMP PYLON (BLAST)');
      case 'CORRUPTED_VAULT':
        return i18n.t('BÓVEDA CRIPTO (+10 CR)', 'CRYPTO VAULT (+10 CR)');
      case 'DATA_STORM':
        return i18n.t('¡TORMENTA DE DATOS!', 'DATA STORM!');
    }
  }

  public applyAreaBlast(
    enemies: Adware[],
    x: number,
    y: number,
    radius: number,
    damage: number,
    freezeSeconds: number = 0
  ): Adware[] {
    const killed: Adware[] = [];
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const dist = Math.hypot(enemy.x - x, enemy.y - y);
      if (dist <= radius + enemy.size * 0.5) {
        const dx = enemy.x - x;
        const dy = enemy.y - y;
        const d = dist || 1;
        enemy.takeDamage(damage, (dx / d) * 28, (dy / d) * 28);
        if (freezeSeconds > 0 && enemy.active) {
          enemy.networkFreezeTimer = Math.max(enemy.networkFreezeTimer, freezeSeconds);
        }
        if (!enemy.active) {
          killed.push(enemy);
        }
      }
    }
    return killed;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    for (const node of this.nodes) {
      if (!node.active) continue;
      const color = this.getColorForType(node.type);
      const ratio = Math.min(1, node.progress / Math.max(0.01, node.duration));
      const pulse = 0.85 + Math.sin(node.pulsePhase) * 0.15;

      ctx.save();
      ctx.translate(node.x, node.y);

      if (node.type === 'DATA_STORM') {
        // Círculo telegrafiado de tormenta peligrosa que se llena del centro hacia afuera
        ctx.fillStyle = 'rgba(255, 30, 66, 0.12)';
        ctx.beginPath();
        ctx.arc(0, 0, node.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 30, 66, ${0.18 + ratio * 0.28})`;
        ctx.beginPath();
        ctx.arc(0, 0, node.radius * ratio, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ff1e42';
        ctx.lineWidth = 2.6;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, node.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Suelo translúcido del evento explorable
        ctx.fillStyle =
          node.type === 'CORRUPTED_VAULT'
            ? `rgba(251, 191, 36, ${0.11 * pulse})`
            : node.type === 'EMP_PYLON'
            ? `rgba(168, 85, 247, ${0.12 * pulse})`
            : `rgba(56, 189, 248, ${0.12 * pulse})`;
        ctx.beginPath();
        ctx.arc(0, 0, node.radius, 0, Math.PI * 2);
        ctx.fill();

        // Anillo exterior discontinuo
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([10, 7]);
        ctx.beginPath();
        ctx.arc(0, 0, node.radius, node.pulsePhase * 0.2, Math.PI * 2 + node.pulsePhase * 0.2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Anillo de progreso de captura
        if (ratio > 0) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.arc(0, 0, node.radius - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
          ctx.stroke();
        }

        // Tótem geométrico central
        ctx.fillStyle = '#0b1322';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(14, 0);
        ctx.lineTo(0, 16);
        ctx.lineTo(-14, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.font = 'bold 12px "JetBrains Mono", Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const glyph =
          node.type === 'CORRUPTED_VAULT'
            ? '₿'
            : node.type === 'EMP_PYLON'
            ? '⚡'
            : '❄';
        ctx.fillText(glyph, 0, 1);
      }

      // Etiqueta flotante clara
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = color;
      ctx.font = 'bold 11.5px "JetBrains Mono", Consolas, monospace';
      ctx.fillText(this.getLabelForType(node.type), 0, -node.radius - 10);

      // Micro-Minijuego de Hackeo en Vivo (Secuencia de 4 Flechas tipo Helldivers)
      if (node.type !== 'DATA_STORM' && !node.hackBonusTriggered && node.hackSequence.length > 0) {
        const barW = 148;
        const barH = 34;
        const bx = -barW / 2;
        const by = -node.radius - 52;

        ctx.fillStyle = 'rgba(7, 13, 25, 0.94)';
        ctx.strokeStyle = node.hackStep > 0 ? '#10b981' : color;
        ctx.lineWidth = 1.6;
        ctx.fillRect(bx, by, barW, barH);
        ctx.strokeRect(bx, by, barW, barH);

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 8.5px "JetBrains Mono", Consolas, monospace';
        ctx.fillText('⚡ HACKEO CRÍTICO (x3) [FLECHAS]', 0, by - 4);

        const arrowGlyph: Record<HackDirection, string> = {
          UP: '▲',
          DOWN: '▼',
          LEFT: '◄',
          RIGHT: '►',
        };
        for (let i = 0; i < node.hackSequence.length; i++) {
          const dir = node.hackSequence[i];
          const ax = bx + 20 + i * 36;
          const ay = by + 17;
          const done = i < node.hackStep;
          const current = i === node.hackStep;

          ctx.fillStyle = done
            ? 'rgba(16, 185, 129, 0.92)'
            : current
            ? 'rgba(251, 191, 36, 0.25)'
            : 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = done ? '#10b981' : current ? '#fbbf24' : '#475569';
          ctx.lineWidth = current ? 1.8 : 1.1;
          ctx.fillRect(ax - 13, ay - 11, 26, 22);
          ctx.strokeRect(ax - 13, ay - 11, 26, 22);

          ctx.fillStyle = done ? '#ffffff' : current ? '#fef08a' : '#94a3b8';
          ctx.font = 'bold 13px "JetBrains Mono", Consolas, monospace';
          ctx.textBaseline = 'middle';
          ctx.fillText(arrowGlyph[dir], ax, ay + 1);
        }
        ctx.textBaseline = 'alphabetic';
      }

      ctx.restore();
    }
  }
}
