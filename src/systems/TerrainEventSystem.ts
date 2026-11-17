/**
 * Eventos dinámicos de terreno exclusivos del Modo Pesadilla (Mapa Infinito).
 * Generan balizas explorables alrededor del jugador con mecánicas de riesgo-recompensa,
 * bufos temporales, trampas EMP y tormentas telegrafiadas.
 */
import { Player } from '../entities/Player';
import { Adware } from '../entities/Adware';
import { i18n } from '../utils/i18n';

export type TerrainEventType =
  | 'COOLING_SERVER'
  | 'EMP_PYLON'
  | 'CORRUPTED_VAULT'
  | 'DATA_STORM';

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
}

export interface TerrainUpdateResult {
  coolingActivated: boolean;
  empDetonation: { x: number; y: number; radius: number; damage: number } | null;
  vaultReward: { x: number; y: number; coins: number; xp: number } | null;
  stormBlast: { x: number; y: number; radius: number; damageToEnemies: number; hitPlayer: boolean } | null;
}

export class TerrainEventSystem {
  public nodes: TerrainNode[] = [];
  private nextId: number = 1;
  private spawnTimer: number = 4.0;
  private stormTimer: number = 9.0;

  public reset(playerX: number, playerY: number): void {
    this.nodes = [];
    this.nextId = 1;
    this.spawnTimer = 3.0;
    this.stormTimer = 9.5;
    // Desplegar 3 balizas iniciales alrededor del punto de inicio para dar orientación inmediata en el minimapa
    this.spawnRandomEventAround(playerX, playerY, 'COOLING_SERVER', 480, 760);
    this.spawnRandomEventAround(playerX, playerY, 'CORRUPTED_VAULT', 640, 980);
    this.spawnRandomEventAround(playerX, playerY, 'EMP_PYLON', 520, 860);
  }

  private spawnRandomEventAround(
    px: number,
    py: number,
    forcedType?: TerrainEventType,
    minDist: number = 580,
    maxDist: number = 1280
  ): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = px + Math.cos(angle) * dist;
    const y = py + Math.sin(angle) * dist;

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
    });
  }

  public update(
    dt: number,
    player: Player,
    elapsedTime: number
  ): TerrainUpdateResult {
    const result: TerrainUpdateResult = {
      coolingActivated: false,
      empDetonation: null,
      vaultReward: null,
      stormBlast: null,
    };

    const activeObjectiveCount = this.nodes.filter(
      (n) => n.active && n.type !== 'DATA_STORM'
    ).length;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 8.5;
      if (activeObjectiveCount < 5) {
        this.spawnRandomEventAround(player.x, player.y);
      }
    }

    this.stormTimer -= dt;
    if (this.stormTimer <= 0 && elapsedTime >= 20) {
      this.stormTimer = Math.max(6.5, 12.5 - elapsedTime / 140);
      // Generar tormenta telegrafiada cerca del jugador
      const offsetDist = 60 + Math.random() * 190;
      const offsetAng = Math.random() * Math.PI * 2;
      this.spawnRandomEventAround(
        player.x + Math.cos(offsetAng) * offsetDist,
        player.y + Math.sin(offsetAng) * offsetDist,
        'DATA_STORM',
        0,
        24
      );
    }

    for (const node of this.nodes) {
      if (!node.active) continue;
      node.pulsePhase += dt * 3.5;

      const distToPlayer = Math.hypot(player.x - node.x, player.y - node.y);
      if (distToPlayer > 2500 && node.type !== 'DATA_STORM') {
        node.active = false;
        continue;
      }

      if (node.type === 'DATA_STORM') {
        node.progress += dt;
        if (node.progress >= node.duration && !node.detonated) {
          node.detonated = true;
          node.active = false;
          result.stormBlast = {
            x: node.x,
            y: node.y,
            radius: node.radius,
            damageToEnemies: Math.round(140 * (1 + elapsedTime / 240)),
            hitPlayer: distToPlayer <= node.radius,
          };
        }
        continue;
      }

      node.maxLifetime -= dt;
      if (node.maxLifetime <= 0) {
        node.active = false;
        continue;
      }

      if (distToPlayer <= node.radius) {
        node.progress += dt;
        if (node.progress >= node.duration) {
          node.active = false;
          if (node.type === 'COOLING_SERVER') {
            result.coolingActivated = true;
          } else if (node.type === 'EMP_PYLON') {
            result.empDetonation = {
              x: node.x,
              y: node.y,
              radius: 440,
              damage: Math.round(170 * (1 + elapsedTime / 220)),
            };
          } else if (node.type === 'CORRUPTED_VAULT') {
            result.vaultReward = {
              x: node.x,
              y: node.y,
              coins: 10,
              xp: 180,
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

      ctx.restore();
    }
  }
}
