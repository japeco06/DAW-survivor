import { i18n } from '../utils/i18n';

export interface WorldObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SlowLiquidPool {
  id: string;
  x: number;
  y: number;
  radius: number;
  phase: number;
  flowAngle: number;
  ampX: number;
  ampY: number;
  freq: number;
}

export interface OasisZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  duration: number;
  progress: number;
  cooldownTimer: number;
  spawnAnim?: number;
}

export interface OasisRewardEvent {
  id: string;
  x: number;
  y: number;
  heal: number;
  coins: number;
  xp: number;
}

interface SectorData {
  obstacles: WorldObstacle[];
  liquids: SlowLiquidPool[];
}

const SECTOR_SIZE = 780;
const SPAWN_CX = 960;
const SPAWN_CY = 540;
const SAFE_SPAWN_RADIUS = 240;
const CLASSIC_W = 1920;
const CLASSIC_H = 1080;

/**
 * Entorno interactivo del mapa:
 * - Modo Normal (finito): arena limpia SIN muros ni fluido lento; solo Oasis dinámicos
 *   que desaparecen al recogerse y reaparecen al tiempo en diferentes lados de la pantalla.
 * - Modo Infinito (Pesadilla / Co-op): obstáculos sólidos, corrientes móviles de fluido lento
 *   y Oasis dinámicos alrededor de los jugadores.
 */
export class WorldEnvironment {
  public seed: number = 1337;
  public isInfinite: boolean = false;

  private sectorCache: Map<string, SectorData> = new Map();
  private activeOases: OasisZone[] = [];
  private nextOasisSpawnTimer: number = 12;
  private oasisSeq: number = 0;
  private lastQuadrant: number = -1;

  public reset(seed: number = 1337, isInfinite: boolean = false): void {
    this.seed = seed >>> 0 || 1337;
    this.isInfinite = isInfinite;
    this.sectorCache.clear();
    this.activeOases = [];
    this.oasisSeq = 0;
    this.lastQuadrant = -1;

    // Generar un primer Oasis inicial desplazado hacia un lateral
    this.spawnDynamicOasis([{ x: SPAWN_CX, y: SPAWN_CY }], 0);
    this.nextOasisSpawnTimer = this.isInfinite ? 15 : 12;
  }

  private hash2D(sx: number, sy: number, salt: number): number {
    let h = (sx * 374761393 + sy * 668265263 + this.seed * 1442695041 + salt * 2654435761) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  private getOrCreateSector(sx: number, sy: number): SectorData {
    const key = `${sx}_${sy}`;
    const cached = this.sectorCache.get(key);
    if (cached) return cached;

    if (this.sectorCache.size > 140) {
      const firstKey = this.sectorCache.keys().next().value;
      if (firstKey !== undefined) this.sectorCache.delete(firstKey);
    }

    const baseX = sx * SECTOR_SIZE;
    const baseY = sy * SECTOR_SIZE;
    const obstacles: WorldObstacle[] = [];
    const liquids: SlowLiquidPool[] = [];

    const obsCount = this.hash2D(sx, sy, 1) > 0.25 ? 2 : 1;
    for (let i = 0; i < obsCount; i++) {
      const w = 78 + Math.floor(this.hash2D(sx, sy, 10 + i * 3) * 44);
      const h = 76 + Math.floor(this.hash2D(sx, sy, 11 + i * 3) * 44);
      const ox = baseX + 110 + this.hash2D(sx, sy, 20 + i * 5) * (SECTOR_SIZE - 220 - w);
      const oy = baseY + 110 + this.hash2D(sx, sy, 21 + i * 5) * (SECTOR_SIZE - 220 - h);

      const cx = ox + w / 2;
      const cy = oy + h / 2;
      if (Math.hypot(cx - SPAWN_CX, cy - SPAWN_CY) < SAFE_SPAWN_RADIUS + 40) {
        continue;
      }
      const overlapsPrevObs = obstacles.some((prev) => {
        const px = prev.x + prev.width / 2;
        const py = prev.y + prev.height / 2;
        return (
          Math.abs(cx - px) < (w + prev.width) / 2 + 56 &&
          Math.abs(cy - py) < (h + prev.height) / 2 + 56
        );
      });
      if (overlapsPrevObs) {
        continue;
      }
      obstacles.push({
        id: `obs_${sx}_${sy}_${i}`,
        x: Math.round(ox),
        y: Math.round(oy),
        width: w,
        height: h,
      });
    }

    // Corriente de fluido lento móvil (~82% por sector)
    if (this.hash2D(sx, sy, 31) > 0.18) {
      const r = 36 + Math.floor(this.hash2D(sx, sy, 32) * 14);
      const lx = baseX + 180 + this.hash2D(sx, sy, 33) * (SECTOR_SIZE - 360);
      const ly = baseY + 180 + this.hash2D(sx, sy, 34) * (SECTOR_SIZE - 360);
      if (Math.hypot(lx - SPAWN_CX, ly - SPAWN_CY) > SAFE_SPAWN_RADIUS + 60) {
        liquids.push({
          id: `liq_${sx}_${sy}`,
          x: Math.round(lx),
          y: Math.round(ly),
          radius: r,
          phase: this.hash2D(sx, sy, 35) * Math.PI * 2,
          flowAngle: this.hash2D(sx, sy, 36) * Math.PI * 2,
          ampX: 165 + Math.floor(this.hash2D(sx, sy, 37) * 75),
          ampY: 85 + Math.floor(this.hash2D(sx, sy, 38) * 60),
          freq: 0.42 + this.hash2D(sx, sy, 39) * 0.24,
        });
      }
    }

    const sector: SectorData = { obstacles, liquids };
    this.sectorCache.set(key, sector);
    return sector;
  }

  /**
   * Calcula los 5 nodos conectados de una corriente fluida en movimiento en tiempo t.
   */
  public getFluidStreamNodes(
    pool: SlowLiquidPool,
    timeSec: number
  ): { x: number; y: number; radius: number }[] {
    const ca = Math.cos(pool.flowAngle);
    const sa = Math.sin(pool.flowAngle);
    const nodes: { x: number; y: number; radius: number }[] = [];
    const taper = [1.0, 0.94, 0.85, 0.74, 0.6];

    for (let i = 0; i < 5; i++) {
      const tau = timeSec - i * 0.32;
      const a = tau * pool.freq + pool.phase;
      const lx = Math.sin(a) * pool.ampX;
      const ly = Math.sin(a * 2 + 0.7) * pool.ampY;
      nodes.push({
        x: pool.x + lx * ca - ly * sa,
        y: pool.y + lx * sa + ly * ca,
        radius: pool.radius * taper[i],
      });
    }
    return nodes;
  }

  public queryArea(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): {
    obstacles: WorldObstacle[];
    liquids: SlowLiquidPool[];
    oases: OasisZone[];
  } {
    if (!this.isInfinite) {
      return {
        obstacles: [],
        liquids: [],
        oases: this.activeOases.filter(
          (o) =>
            o.x + o.radius >= minX &&
            o.x - o.radius <= maxX &&
            o.y + o.radius >= minY &&
            o.y - o.radius <= maxY
        ),
      };
    }

    const pad = 280;
    const sMinX = Math.floor((minX - pad) / SECTOR_SIZE);
    const sMaxX = Math.floor((maxX + pad) / SECTOR_SIZE);
    const sMinY = Math.floor((minY - pad) / SECTOR_SIZE);
    const sMaxY = Math.floor((maxY + pad) / SECTOR_SIZE);

    const obstacles: WorldObstacle[] = [];
    const liquids: SlowLiquidPool[] = [];

    for (let sx = sMinX; sx <= sMaxX; sx++) {
      for (let sy = sMinY; sy <= sMaxY; sy++) {
        const sec = this.getOrCreateSector(sx, sy);
        obstacles.push(...sec.obstacles);
        liquids.push(...sec.liquids);
      }
    }

    const oases = this.activeOases.filter(
      (o) =>
        o.x + o.radius >= minX &&
        o.x - o.radius <= maxX &&
        o.y + o.radius >= minY &&
        o.y - o.radius <= maxY
    );

    return { obstacles, liquids, oases };
  }

  public getAllActiveOases(): OasisZone[] {
    return this.activeOases;
  }

  public resolveCircleCollision(x: number, y: number, radius: number): { x: number; y: number } {
    if (!this.isInfinite) {
      return { x, y };
    }

    const area = this.queryArea(
      x - radius - 140,
      y - radius - 140,
      x + radius + 140,
      y + radius + 140
    );
    let rx = x;
    let ry = y;

    for (const obs of area.obstacles) {
      const closestX = Math.max(obs.x, Math.min(rx, obs.x + obs.width));
      const closestY = Math.max(obs.y, Math.min(ry, obs.y + obs.height));
      const dx = rx - closestX;
      const dy = ry - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq < radius * radius) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          rx += (dx / dist) * overlap;
          ry += (dy / dist) * overlap;
        } else {
          const leftPen = rx - obs.x;
          const rightPen = obs.x + obs.width - rx;
          const topPen = ry - obs.y;
          const botPen = obs.y + obs.height - ry;
          const minPen = Math.min(leftPen, rightPen, topPen, botPen);
          if (minPen === leftPen) rx = obs.x - radius;
          else if (minPen === rightPen) rx = obs.x + obs.width + radius;
          else if (minPen === topPen) ry = obs.y - radius;
          else ry = obs.y + obs.height + radius;
        }
      }
    }

    return { x: rx, y: ry };
  }

  public isInSlowLiquid(x: number, y: number, timeSec: number = 0): boolean {
    if (!this.isInfinite) return false;

    const area = this.queryArea(x - 160, y - 160, x + 160, y + 160);
    for (const pool of area.liquids) {
      const nodes = this.getFluidStreamNodes(pool, timeSec);
      for (const n of nodes) {
        if (Math.hypot(x - n.x, y - n.y) <= n.radius * 0.98) {
          return true;
        }
      }
    }
    return false;
  }

  private spawnDynamicOasis(
    alivePlayers: { x: number; y: number }[],
    timeSec: number
  ): OasisZone | null {
    if (alivePlayers.length === 0) return null;

    // Elegir un cuadrante distinto al anterior para aparecer en diferentes lados de la pantalla
    const candidateQuads = [0, 1, 2, 3].filter((q) => q !== this.lastQuadrant);
    const chosenQuad = candidateQuads[Math.floor(Math.random() * candidateQuads.length)];
    this.lastQuadrant = chosenQuad;

    const r = 72;
    let bestX = SPAWN_CX + 340;
    let bestY = SPAWN_CY;

    if (!this.isInfinite) {
      // Modo Normal: laterales distintos de la arena 1920x1080
      for (let attempt = 0; attempt < 16; attempt++) {
        let cx = SPAWN_CX;
        let cy = SPAWN_CY;
        if (chosenQuad === 0) {
          cx = 170 + Math.random() * 290;
          cy = 180 + Math.random() * (CLASSIC_H - 360);
        } else if (chosenQuad === 1) {
          cx = CLASSIC_W - 460 + Math.random() * 290;
          cy = 180 + Math.random() * (CLASSIC_H - 360);
        } else if (chosenQuad === 2) {
          cx = 360 + Math.random() * (CLASSIC_W - 720);
          cy = 145 + Math.random() * 145;
        } else {
          cx = 360 + Math.random() * (CLASSIC_W - 720);
          cy = CLASSIC_H - 290 + Math.random() * 145;
        }

        const tooCloseToPlayer = alivePlayers.some((p) => Math.hypot(p.x - cx, p.y - cy) < 230);
        const tooCloseToOasis = this.activeOases.some((o) => Math.hypot(o.x - cx, o.y - cy) < 320);
        if (!tooCloseToPlayer && !tooCloseToOasis) {
          bestX = Math.round(cx);
          bestY = Math.round(cy);
          break;
        }
        bestX = Math.round(cx);
        bestY = Math.round(cy);
      }
    } else {
      // Modo Infinito: borde/lateral distinto alrededor de un jugador vivo sin pisar obstáculos ni fluido
      const anchor = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      for (let attempt = 0; attempt < 18; attempt++) {
        const quadOffset = chosenQuad * (Math.PI * 0.5);
        const angle = quadOffset + (Math.random() - 0.5) * 1.15;
        const dist = 420 + Math.random() * 340;
        const cx = anchor.x + Math.cos(angle) * dist;
        const cy = anchor.y + Math.sin(angle) * dist;

        const area = this.queryArea(cx - 160, cy - 160, cx + 160, cy + 160);
        const hitsObs = area.obstacles.some(
          (o) =>
            cx + r + 18 > o.x &&
            cx - r - 18 < o.x + o.width &&
            cy + r + 18 > o.y &&
            cy - r - 18 < o.y + o.height
        );
        const hitsFluid = area.liquids.some((liq) =>
          this.getFluidStreamNodes(liq, timeSec).some((n) => Math.hypot(cx - n.x, cy - n.y) < r + n.radius + 20)
        );
        const hitsOasis = this.activeOases.some((o) => Math.hypot(o.x - cx, o.y - cy) < 420);
        if (!hitsObs && !hitsFluid && !hitsOasis) {
          bestX = Math.round(cx);
          bestY = Math.round(cy);
          break;
        }
        if (attempt === 17) {
          bestX = Math.round(cx);
          bestY = Math.round(cy);
        }
      }
    }

    const oasis: OasisZone = {
      id: `dyn_oasis_${++this.oasisSeq}`,
      x: bestX,
      y: bestY,
      radius: r,
      duration: 1.5,
      progress: 0,
      cooldownTimer: 0,
      spawnAnim: 1.0,
    };
    this.activeOases.push(oasis);
    return oasis;
  }

  public updateOases(
    dt: number,
    alivePlayers: { x: number; y: number }[],
    authoritative: boolean,
    timeSec: number = 0
  ): { rewards: OasisRewardEvent[]; spawned: OasisZone[] } {
    for (const o of this.activeOases) {
      if (o.spawnAnim && o.spawnAnim > 0) {
        o.spawnAnim = Math.max(0, o.spawnAnim - dt * 1.4);
      }
    }

    if (!authoritative || alivePlayers.length === 0) {
      return { rewards: [], spawned: [] };
    }

    const rewards: OasisRewardEvent[] = [];
    const spawned: OasisZone[] = [];

    // 1. Limpiar Oasis que hayan quedado demasiado lejos de todos los jugadores en modo infinito
    if (this.isInfinite) {
      for (let i = this.activeOases.length - 1; i >= 0; i--) {
        const o = this.activeOases[i];
        let minDist = Infinity;
        for (const p of alivePlayers) {
          const d = Math.hypot(o.x - p.x, o.y - p.y);
          if (d < minDist) minDist = d;
        }
        if (minDist > 2200) {
          this.activeOases.splice(i, 1);
          this.nextOasisSpawnTimer = Math.min(this.nextOasisSpawnTimer, 2.5);
        }
      }
    }

    // 2. Recolección y desaparición inmediata al completarse
    for (let i = this.activeOases.length - 1; i >= 0; i--) {
      const oasis = this.activeOases[i];
      const someoneInside = alivePlayers.some(
        (p) => Math.hypot(p.x - oasis.x, p.y - oasis.y) <= oasis.radius
      );

      if (someoneInside) {
        oasis.progress += dt;
        if (oasis.progress >= oasis.duration) {
          rewards.push({
            id: oasis.id,
            x: oasis.x,
            y: oasis.y,
            heal: 35,
            coins: 4,
            xp: 150,
          });
          this.activeOases.splice(i, 1);
          this.nextOasisSpawnTimer = this.isInfinite ? 11 + Math.random() * 5 : 10 + Math.random() * 4;
        }
      } else if (oasis.progress > 0) {
        oasis.progress = Math.max(0, oasis.progress - dt * 0.45);
      }
    }

    // 3. Temporizador de aparición de nuevos Oasis en otro lado
    const maxConcurrent = this.isInfinite ? 2 : 1;
    if (this.activeOases.length < maxConcurrent) {
      this.nextOasisSpawnTimer -= dt;
      if (this.nextOasisSpawnTimer <= 0) {
        const created = this.spawnDynamicOasis(alivePlayers, timeSec);
        if (created) {
          spawned.push(created);
        }
        this.nextOasisSpawnTimer = this.isInfinite ? 13 + Math.random() * 5 : 11 + Math.random() * 4;
      }
    }

    return { rewards, spawned };
  }

  public exportOasisStates(): [string, number, number, number][] {
    return this.activeOases.slice(0, 8).map((o) => [
      o.id,
      Math.round(o.x),
      Math.round(o.y),
      Number((o.progress / o.duration).toFixed(2)),
    ]);
  }

  public applyRemoteOasisStates(states: [string, number, number, number][]): void {
    const prevIds = new Set(this.activeOases.map((o) => o.id));
    const prevAnim = new Map(this.activeOases.map((o) => [o.id, o.spawnAnim ?? 0]));
    this.activeOases = states.map(([id, x, y, pct]) => ({
      id,
      x,
      y,
      radius: 72,
      duration: 1.5,
      progress: Math.max(0, Math.min(1.5, pct * 1.5)),
      cooldownTimer: 0,
      spawnAnim: prevIds.has(id) ? prevAnim.get(id) ?? 0 : 1.0,
    }));
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
    nowMs: number,
    timeSec: number = 0
  ): void {
    const area = this.queryArea(camX - 180, camY - 180, camX + viewW + 180, camY + viewH + 180);

    // 1. Corrientes móviles de fluido viscoso (solo Modo Infinito: Pesadilla / Co-op)
    if (this.isInfinite) {
      for (const pool of area.liquids) {
        const nodes = this.getFluidStreamNodes(pool, timeSec);
        const head = nodes[0];

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Halo exterior difuso del fluido en movimiento
        ctx.strokeStyle = 'rgba(107, 33, 168, 0.34)';
        ctx.lineWidth = pool.radius * 2.15;
        ctx.beginPath();
        ctx.moveTo(nodes[0].x, nodes[0].y);
        for (let i = 1; i < nodes.length - 1; i++) {
          const mx = (nodes[i].x + nodes[i + 1].x) * 0.5;
          const my = (nodes[i].y + nodes[i + 1].y) * 0.5;
          ctx.quadraticCurveTo(nodes[i].x, nodes[i].y, mx, my);
        }
        ctx.lineTo(nodes[nodes.length - 1].x, nodes[nodes.length - 1].y);
        ctx.stroke();

        // Cuerpo principal viscoso (capas conectadas con decremento de grosor tipo chorro vivo)
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const wobble = 1 + Math.sin(nowMs * 0.006 + pool.phase + i * 1.1) * 0.08;
          ctx.fillStyle = i === 0 ? 'rgba(147, 51, 234, 0.42)' : 'rgba(126, 34, 206, 0.36)';
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius * wobble, 0, Math.PI * 2);
          ctx.fill();
        }

        // Veta energética central que fluye desde la cola hacia la cabeza
        ctx.strokeStyle = 'rgba(216, 180, 254, 0.72)';
        ctx.lineWidth = 3.2;
        ctx.setLineDash([12, 10]);
        ctx.lineDashOffset = -(nowMs * 0.065) % 22;
        ctx.beginPath();
        ctx.moveTo(nodes[nodes.length - 1].x, nodes[nodes.length - 1].y);
        for (let i = nodes.length - 2; i >= 0; i--) {
          ctx.lineTo(nodes[i].x, nodes[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Partículas luminosas flotando en la corriente
        ctx.fillStyle = 'rgba(243, 232, 255, 0.72)';
        for (let b = 0; b < 4; b++) {
          const tBubble = ((nowMs * 0.00055 + pool.phase + b * 0.25) % 1);
          const idxF = tBubble * (nodes.length - 1);
          const idx0 = Math.floor(idxF);
          const idx1 = Math.min(nodes.length - 1, idx0 + 1);
          const frac = idxF - idx0;
          const bx = nodes[idx0].x + (nodes[idx1].x - nodes[idx0].x) * frac + Math.sin(nowMs * 0.004 + b) * 7;
          const by = nodes[idx0].y + (nodes[idx1].y - nodes[idx0].y) * frac + Math.cos(nowMs * 0.004 + b) * 7;
          ctx.beginPath();
          ctx.arc(bx, by, 2.4 + (b % 2) * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Borde fluido de la cabeza para señalar dirección de desplazamiento
        ctx.strokeStyle = 'rgba(233, 213, 255, 0.65)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(head.x, head.y, head.radius * 0.96, 0, Math.PI * 2);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 10px "JetBrains Mono", Consolas, monospace';
        ctx.fillStyle = 'rgba(233, 213, 255, 0.88)';
        ctx.fillText(
          i18n.t('FLUIDO VISCOSO (-VEL)', 'SLOW FLUID (-SPD)'),
          head.x,
          head.y + head.radius + 15
        );
        ctx.restore();
      }
    }

    // 2. Oasis dinámicos (desaparecen tras recogerse y reaparecen en otra posición)
    for (const oasis of area.oases) {
      const pulse = 0.82 + Math.sin(nowMs * 0.005) * 0.18;

      ctx.save();
      if (oasis.spawnAnim && oasis.spawnAnim > 0) {
        const ringR = oasis.radius + (1 - oasis.spawnAnim) * 58;
        ctx.strokeStyle = `rgba(52, 211, 153, ${oasis.spawnAnim * 0.8})`;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(oasis.x, oasis.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = `rgba(16, 185, 129, ${0.19 * pulse})`;
      ctx.beginPath();
      ctx.arc(oasis.x, oasis.y, oasis.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(oasis.x, oasis.y, oasis.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Anillo interior cristalino de manantial
      ctx.strokeStyle = 'rgba(110, 231, 183, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(oasis.x, oasis.y, oasis.radius * (0.48 + ((nowMs * 0.0006) % 0.45)), 0, Math.PI * 2);
      ctx.stroke();

      // Núcleo diamante verde-dorado del Oasis
      ctx.translate(oasis.x, oasis.y);
      ctx.rotate(nowMs * 0.0018);
      ctx.fillStyle = '#34d399';
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(14, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.rotate(-nowMs * 0.0018);
      ctx.translate(-oasis.x, -oasis.y);

      if (oasis.progress > 0) {
        const pct = Math.min(1, oasis.progress / oasis.duration);
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(oasis.x, oasis.y, oasis.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(
        i18n.t('✦ OASIS (+HP +CRIPTO +XP)', '✦ OASIS (+HP +CRYPTO +XP)'),
        oasis.x,
        oasis.y - oasis.radius - 10
      );
      ctx.restore();
    }

    // 3. Obstáculos sólidos (solo Modo Infinito: Pesadilla / Co-op)
    if (this.isInfinite) {
      for (const obs of area.obstacles) {
        const cut = 10;
        const x = obs.x;
        const y = obs.y;
        const w = obs.width;
        const h = obs.height;

        ctx.save();
        ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
        ctx.fillRect(x + 6, y + 8, w, h);

        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + cut, y);
        ctx.lineTo(x + w - cut, y);
        ctx.lineTo(x + w, y + cut);
        ctx.lineTo(x + w, y + h - cut);
        ctx.lineTo(x + w - cut, y + h);
        ctx.lineTo(x + cut, y + h);
        ctx.lineTo(x, y + h - cut);
        ctx.lineTo(x, y + cut);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x + 12, y + 12, w - 24, h - 24);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);

        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x + 18, y + 18, w - 36, 4);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.fillRect(x + 18, y + 28, w - 42, 3);
        ctx.fillRect(x + 18, y + 35, w - 48, 3);
        ctx.restore();
      }
    }
  }
}
