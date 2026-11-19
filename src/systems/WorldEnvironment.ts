import { i18n } from '../utils/i18n';

export type ObstacleKind =
  | 'SERVER_MONOLITH'
  | 'DATA_PILLAR'
  | 'FIREWALL_WALL'
  | 'HEX_BUNKER'
  | 'L_BASTION';

export interface WorldObstacle {
  id: string;
  kind: ObstacleKind;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Radio para pilares circulares / búnker octogonal */
  radius?: number;
  /** Grosor del ala y orientación (0..3) para bastiones en L */
  armThickness?: number;
  orientation?: number;
  /** Semilla visual determinista para LEDs y detalles */
  variantSeed: number;
}

export interface SlowLiquidPool {
  id: string;
  x: number;
  y: number;
  radius: number;
  phase: number;
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

const SECTOR_SIZE = 900;
const SECTOR_BORDER_PAD = 56; // Pasillo mínimo garantizado (>= 112 px) entre complejos de sectores contiguos
const SPAWN_CX = 960;
const SPAWN_CY = 540;
const SAFE_SPAWN_RADIUS = 275;
const CLASSIC_W = 1920;
const CLASSIC_H = 1080;

const OBSTACLE_KINDS: readonly ObstacleKind[] = [
  'FIREWALL_WALL',
  'HEX_BUNKER',
  'L_BASTION',
  'DATA_PILLAR',
  'SERVER_MONOLITH',
];

/**
 * Entorno interactivo del mapa:
 * - Modo Normal (finito): arena despejada SIN muros ni lagos lentos; solo Oasis dinámicos
 *   que desaparecen al recogerse y reaparecen al tiempo en diferentes lados de la pantalla.
 * - Modo Infinito (Pesadilla / Co-op): menos grupos de obstáculos pero formados por piezas
 *   grandes pegadas entre sí de forma aleatoria (y sólidas contra disparos), más lagos
 *   viscosos grandes repartidos por el mapa y Oasis dinámicos.
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

    this.spawnDynamicOasis([{ x: SPAWN_CX, y: SPAWN_CY }], 0);
    this.nextOasisSpawnTimer = this.isInfinite ? 15 : 12;
  }

  private hash2D(sx: number, sy: number, salt: number): number {
    let h = (sx * 374761393 + sy * 668265263 + this.seed * 1442695041 + salt * 2654435761) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  private getLakeContourRadius(pool: SlowLiquidPool, theta: number, scaleR: number = 1): number {
    const lobe =
      1 +
      0.095 * Math.sin(3 * theta + pool.phase) +
      0.055 * Math.cos(5 * theta - pool.phase * 1.3);
    return pool.radius * scaleR * lobe;
  }

  private getLBastionRects(obs: WorldObstacle): [
    { x: number; y: number; w: number; h: number },
    { x: number; y: number; w: number; h: number }
  ] {
    const t = obs.armThickness ?? 70;
    const ori = obs.orientation ?? 0;
    const horizTop = ori === 0 || ori === 1;
    const vertLeft = ori === 0 || ori === 3;
    const hRect = {
      x: obs.x,
      y: horizTop ? obs.y : obs.y + obs.height - t,
      w: obs.width,
      h: t,
    };
    const vRect = {
      x: vertLeft ? obs.x : obs.x + obs.width - t,
      y: obs.y,
      w: t,
      h: obs.height,
    };
    return [hRect, vRect];
  }

  /**
   * Genera de forma pura (sin depender de caché de obstáculos) los lagos grandes
   * de un sector. Más frecuentes (~72% de sectores con 1–2 lagos grandes).
   */
  private computeSectorLakes(sx: number, sy: number): SlowLiquidPool[] {
    const liquids: SlowLiquidPool[] = [];
    const baseX = sx * SECTOR_SIZE;
    const baseY = sy * SECTOR_SIZE;

    const lakeRoll = this.hash2D(sx, sy, 31);
    const desiredLakes = lakeRoll > 0.84 ? 2 : lakeRoll > 0.28 ? 1 : 0;

    for (let i = 0; i < desiredLakes; i++) {
      const r = 142 + Math.floor(this.hash2D(sx, sy, 32 + i * 7) * 46); // 142–188 px radio
      const lakeMargin = r + 35;
      const span = Math.max(40, SECTOR_SIZE - lakeMargin * 2);
      const lx = baseX + lakeMargin + this.hash2D(sx, sy, 33 + i * 7) * span;
      const ly = baseY + lakeMargin + this.hash2D(sx, sy, 34 + i * 7) * span;

      if (Math.hypot(lx - SPAWN_CX, ly - SPAWN_CY) < SAFE_SPAWN_RADIUS + r + 40) {
        continue;
      }
      const overlapsPrevLake = liquids.some(
        (prev) => Math.hypot(lx - prev.x, ly - prev.y) < r + prev.radius + 95
      );
      if (overlapsPrevLake) continue;

      liquids.push({
        id: `liq_${sx}_${sy}_${i}`,
        x: Math.round(lx),
        y: Math.round(ly),
        radius: r,
        phase: this.hash2D(sx, sy, 35 + i * 7) * Math.PI * 2,
      });
    }

    return liquids;
  }

  private buildPieceDimensions(
    sx: number,
    sy: number,
    index: number,
    kind: ObstacleKind
  ): {
    width: number;
    height: number;
    radius?: number;
    armThickness?: number;
    orientation?: number;
    variantSeed: number;
  } {
    const variantSeed = this.hash2D(sx, sy, 90 + index * 11);

    if (kind === 'FIREWALL_WALL') {
      const vertical = this.hash2D(sx, sy, 12 + index * 7) > 0.5;
      const length = 225 + Math.floor(this.hash2D(sx, sy, 13 + index * 7) * 95);
      const thick = 62 + Math.floor(this.hash2D(sx, sy, 14 + index * 7) * 16);
      return {
        width: vertical ? thick : length,
        height: vertical ? length : thick,
        variantSeed,
      };
    }

    if (kind === 'DATA_PILLAR') {
      const r = 68 + Math.floor(this.hash2D(sx, sy, 15 + index * 7) * 24);
      return {
        width: r * 2,
        height: r * 2,
        radius: r,
        variantSeed,
      };
    }

    if (kind === 'HEX_BUNKER') {
      const size = 160 + Math.floor(this.hash2D(sx, sy, 16 + index * 7) * 44);
      return {
        width: size,
        height: size,
        radius: size * 0.5,
        variantSeed,
      };
    }

    if (kind === 'L_BASTION') {
      const width = 195 + Math.floor(this.hash2D(sx, sy, 17 + index * 7) * 45);
      const height = 185 + Math.floor(this.hash2D(sx, sy, 18 + index * 7) * 45);
      const armThickness = 64 + Math.floor(this.hash2D(sx, sy, 19 + index * 7) * 14);
      const orientation = Math.floor(this.hash2D(sx, sy, 20 + index * 7) * 4) % 4;
      return { width, height, armThickness, orientation, variantSeed };
    }

    const tall = this.hash2D(sx, sy, 21 + index * 7) > 0.45;
    const shortSide = 136 + Math.floor(this.hash2D(sx, sy, 22 + index * 7) * 34);
    const longSide = 178 + Math.floor(this.hash2D(sx, sy, 23 + index * 7) * 48);
    return {
      width: tall ? shortSide : longSide,
      height: tall ? longSide : shortSide,
      variantSeed,
    };
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
    const liquids = this.computeSectorLakes(sx, sy);
    const obstacles: WorldObstacle[] = [];

    // Lagos cercanos (propio sector y los 8 colindantes) para no solapar paredes encima del lago
    const nearbyLakes: SlowLiquidPool[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) nearbyLakes.push(...liquids);
        else nearbyLakes.push(...this.computeSectorLakes(sx + dx, sy + dy));
      }
    }

    const isPieceClear = (x: number, y: number, w: number, h: number): boolean => {
      if (
        x < baseX + SECTOR_BORDER_PAD ||
        x + w > baseX + SECTOR_SIZE - SECTOR_BORDER_PAD ||
        y < baseY + SECTOR_BORDER_PAD ||
        y + h > baseY + SECTOR_SIZE - SECTOR_BORDER_PAD
      ) {
        return false;
      }

      const cx = x + w / 2;
      const cy = y + h / 2;
      const safeDist = SAFE_SPAWN_RADIUS + Math.max(w, h) * 0.45;
      if (Math.hypot(cx - SPAWN_CX, cy - SPAWN_CY) < safeDist) {
        return false;
      }

      const hitsLake = nearbyLakes.some((pool) => {
        const closestX = Math.max(x, Math.min(pool.x, x + w));
        const closestY = Math.max(y, Math.min(pool.y, y + h));
        return Math.hypot(pool.x - closestX, pool.y - closestY) < pool.radius + 54;
      });
      return !hitsLake;
    };

    // Pocas agrupaciones de obstáculos (~48% de sectores), dispuestas aleatoriamente y pegadas entre sí
    const clusterRoll = this.hash2D(sx, sy, 7);
    if (clusterRoll > 0.52) {
      const clusterPieceTarget = clusterRoll > 0.78 ? 3 : 2;
      const kindStart = Math.floor(this.hash2D(sx, sy, 5) * OBSTACLE_KINDS.length);
      const firstKind = OBSTACLE_KINDS[kindStart % OBSTACLE_KINDS.length];
      const firstDim = this.buildPieceDimensions(sx, sy, 0, firstKind);

      // Buscar posición aleatoria orgánica del ancla dentro del sector
      let rootPiece: WorldObstacle | null = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const spanX = Math.max(24, SECTOR_SIZE - SECTOR_BORDER_PAD * 2 - firstDim.width);
        const spanY = Math.max(24, SECTOR_SIZE - SECTOR_BORDER_PAD * 2 - firstDim.height);
        const ox = Math.round(
          baseX + SECTOR_BORDER_PAD + this.hash2D(sx, sy, 40 + attempt * 5) * spanX
        );
        const oy = Math.round(
          baseY + SECTOR_BORDER_PAD + this.hash2D(sx, sy, 41 + attempt * 5) * spanY
        );
        if (isPieceClear(ox, oy, firstDim.width, firstDim.height)) {
          rootPiece = {
            id: `obs_${sx}_${sy}_0`,
            kind: firstKind,
            x: ox,
            y: oy,
            ...firstDim,
          };
          break;
        }
      }

      if (rootPiece) {
        obstacles.push(rootPiece);

        // Pegar entre 1 y 2 piezas adicionales tocándose (solape estructural de 10-14 px sin grietas)
        for (let p = 1; p < clusterPieceTarget; p++) {
          const nextKind = OBSTACLE_KINDS[(kindStart + p * 2) % OBSTACLE_KINDS.length];
          const nextDim = this.buildPieceDimensions(sx, sy, p, nextKind);
          const anchor = obstacles[Math.floor(this.hash2D(sx, sy, 60 + p) * obstacles.length)];
          const attachBox =
            anchor.kind === 'L_BASTION'
              ? this.getLBastionRects(anchor)[p % 2]
              : { x: anchor.x, y: anchor.y, w: anchor.width, h: anchor.height };
          const dirBase = Math.floor(this.hash2D(sx, sy, 70 + p) * 4) % 4;
          const jointOverlap = 14; // Solape firme para que parezcan pegadas y no pasen balas por grietas

          let placed = false;
          for (let dTry = 0; dTry < 4 && !placed; dTry++) {
            const dir = (dirBase + dTry) % 4;
            const slideAlign = this.hash2D(sx, sy, 80 + p * 7 + dTry) * 0.5 - 0.1;
            let nx = attachBox.x;
            let ny = attachBox.y;

            if (dir === 0) {
              nx = attachBox.x + attachBox.w - jointOverlap;
              ny = attachBox.y + Math.round((attachBox.h - nextDim.height) * 0.5 + slideAlign * 40);
            } else if (dir === 1) {
              nx = attachBox.x + Math.round((attachBox.w - nextDim.width) * 0.5 + slideAlign * 40);
              ny = attachBox.y + attachBox.h - jointOverlap;
            } else if (dir === 2) {
              nx = attachBox.x - nextDim.width + jointOverlap;
              ny = attachBox.y + Math.round((attachBox.h - nextDim.height) * 0.5 + slideAlign * 40);
            } else {
              nx = attachBox.x + Math.round((attachBox.w - nextDim.width) * 0.5 + slideAlign * 40);
              ny = attachBox.y - nextDim.height + jointOverlap;
            }

            if (isPieceClear(nx, ny, nextDim.width, nextDim.height)) {
              obstacles.push({
                id: `obs_${sx}_${sy}_${p}`,
                kind: nextKind,
                x: Math.round(nx),
                y: Math.round(ny),
                ...nextDim,
              });
              placed = true;
            }
          }
        }
      }
    }

    const sector: SectorData = { obstacles, liquids };
    this.sectorCache.set(key, sector);
    return sector;
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

    const pad = 420;
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

  private pointHitsRect(
    x: number,
    y: number,
    radius: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number
  ): boolean {
    const closestX = Math.max(rx, Math.min(x, rx + rw));
    const closestY = Math.max(ry, Math.min(y, ry + rh));
    const dx = x - closestX;
    const dy = y - closestY;
    return dx * dx + dy * dy <= radius * radius;
  }

  private pointHitsObstacle(x: number, y: number, radius: number, obs: WorldObstacle): boolean {
    if (obs.kind === 'DATA_PILLAR' && obs.radius) {
      const cx = obs.x + obs.radius;
      const cy = obs.y + obs.radius;
      const totalR = obs.radius + radius;
      const dx = x - cx;
      const dy = y - cy;
      return dx * dx + dy * dy <= totalR * totalR;
    }

    if (obs.kind === 'HEX_BUNKER') {
      if (
        x + radius < obs.x ||
        x - radius > obs.x + obs.width ||
        y + radius < obs.y ||
        y - radius > obs.y + obs.height
      ) {
        return false;
      }
      const cx = obs.x + obs.width / 2;
      const cy = obs.y + obs.height / 2;
      const half = obs.width / 2;
      const cut = obs.width * 0.28;
      const diagLimit = (2 * half - cut) / Math.SQRT2 + radius;
      const adx = Math.abs(x - cx);
      const ady = Math.abs(y - cy);
      return (adx + ady) / Math.SQRT2 <= diagLimit;
    }

    if (obs.kind === 'L_BASTION') {
      const [hRect, vRect] = this.getLBastionRects(obs);
      return (
        this.pointHitsRect(x, y, radius, hRect.x, hRect.y, hRect.w, hRect.h) ||
        this.pointHitsRect(x, y, radius, vRect.x, vRect.y, vRect.w, vRect.h)
      );
    }

    return this.pointHitsRect(x, y, radius, obs.x, obs.y, obs.width, obs.height);
  }

  public isPointInsideObstacle(x: number, y: number, radius: number = 0): boolean {
    if (!this.isInfinite) return false;
    const area = this.queryArea(
      x - radius - 360,
      y - radius - 360,
      x + radius + 360,
      y + radius + 360
    );
    return area.obstacles.some((obs) => this.pointHitsObstacle(x, y, radius, obs));
  }

  public findSegmentObstacleImpact(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    radius: number = 0
  ): { x: number; y: number } | null {
    if (!this.isInfinite) return null;

    const minX = Math.min(x0, x1) - radius;
    const minY = Math.min(y0, y1) - radius;
    const maxX = Math.max(x0, x1) + radius;
    const maxY = Math.max(y0, y1) + radius;
    const area = this.queryArea(minX, minY, maxX, maxY);
    if (area.obstacles.length === 0) return null;

    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(2, Math.ceil(dist / 6));

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;
      for (const obs of area.obstacles) {
        if (this.pointHitsObstacle(px, py, radius, obs)) {
          return { x: px, y: py };
        }
      }
    }
    return null;
  }

  public segmentHitsObstacle(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    radius: number = 0
  ): boolean {
    return this.findSegmentObstacleImpact(x0, y0, x1, y1, radius) !== null;
  }

  /**
   * Permite que los enemigos rodeen suavemente los muros y complejos pegados
   * sin quedarse atascados chocando de frente contra una pared plana.
   */
  public moveEntityAvoidingObstacles(
    prevX: number,
    prevY: number,
    nextX: number,
    nextY: number,
    targetX: number,
    targetY: number,
    radius: number,
    preferSide: number = 1
  ): { x: number; y: number } {
    if (!this.isInfinite) {
      return { x: nextX, y: nextY };
    }

    const stepDx = nextX - prevX;
    const stepDy = nextY - prevY;
    const stepDist = Math.hypot(stepDx, stepDy);
    if (stepDist < 0.01) {
      return this.resolveCircleCollision(nextX, nextY, radius);
    }

    const toTargetDx = targetX - prevX;
    const toTargetDy = targetY - prevY;
    const toTargetLen = Math.hypot(toTargetDx, toTargetDy);
    const dirX = toTargetLen > 1 ? toTargetDx / toTargetLen : stepDx / stepDist;
    const dirY = toTargetLen > 1 ? toTargetDy / toTargetLen : stepDy / stepDist;
    const baseAngle = Math.atan2(dirY, dirX);

    const lookAhead = Math.min(toTargetLen > 1 ? toTargetLen : 120, Math.max(stepDist + 8, radius * 2.2 + 44));
    const aheadX = prevX + dirX * lookAhead;
    const aheadY = prevY + dirY * lookAhead;

    if (!this.segmentHitsObstacle(prevX, prevY, aheadX, aheadY, radius + 2)) {
      return this.resolveCircleCollision(nextX, nextY, radius);
    }

    // Decidir si el flanco izquierdo o derecho está más libre; preferSide desempata en simetría
    const sideCheckDist = radius * 2.1 + 52;
    const posBlocked = this.segmentHitsObstacle(
      prevX,
      prevY,
      prevX + Math.cos(baseAngle + 0.85) * sideCheckDist,
      prevY + Math.sin(baseAngle + 0.85) * sideCheckDist,
      radius + 1
    );
    const negBlocked = this.segmentHitsObstacle(
      prevX,
      prevY,
      prevX + Math.cos(baseAngle - 0.85) * sideCheckDist,
      prevY + Math.sin(baseAngle - 0.85) * sideCheckDist,
      radius + 1
    );

    const firstSign = !posBlocked && negBlocked ? 1 : !negBlocked && posBlocked ? -1 : preferSide >= 0 ? 1 : -1;
    const secondSign = -firstSign;
    const offsets = [
      firstSign * 0.62,
      secondSign * 0.62,
      firstSign * 1.05,
      secondSign * 1.05,
      firstSign * 1.48,
      secondSign * 1.48,
      firstSign * 2.05,
      secondSign * 2.05,
    ];

    const rayLen = Math.max(stepDist + 10, radius * 1.85 + 32);
    for (const off of offsets) {
      const ang = baseAngle + off;
      const rx = prevX + Math.cos(ang) * rayLen;
      const ry = prevY + Math.sin(ang) * rayLen;
      if (!this.segmentHitsObstacle(prevX, prevY, rx, ry, radius + 1)) {
        const candX = prevX + Math.cos(ang) * stepDist;
        const candY = prevY + Math.sin(ang) * stepDist;
        return this.resolveCircleCollision(candX, candY, radius);
      }
    }

    return this.resolveCircleCollision(nextX, nextY, radius);
  }

  private pushOutRect(
    rx: number,
    ry: number,
    radius: number,
    ox: number,
    oy: number,
    ow: number,
    oh: number
  ): { x: number; y: number } {
    const closestX = Math.max(ox, Math.min(rx, ox + ow));
    const closestY = Math.max(oy, Math.min(ry, oy + oh));
    const dx = rx - closestX;
    const dy = ry - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq < radius * radius) {
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = radius - dist;
        return { x: rx + (dx / dist) * overlap, y: ry + (dy / dist) * overlap };
      }
      const leftPen = rx - ox;
      const rightPen = ox + ow - rx;
      const topPen = ry - oy;
      const botPen = oy + oh - ry;
      const minPen = Math.min(leftPen, rightPen, topPen, botPen);
      if (minPen === leftPen) return { x: ox - radius, y: ry };
      if (minPen === rightPen) return { x: ox + ow + radius, y: ry };
      if (minPen === topPen) return { x: rx, y: oy - radius };
      return { x: rx, y: oy + oh + radius };
    }
    return { x: rx, y: ry };
  }

  private pushOutCircle(
    rx: number,
    ry: number,
    radius: number,
    cx: number,
    cy: number,
    cr: number
  ): { x: number; y: number } {
    const dx = rx - cx;
    const dy = ry - cy;
    const minDist = cr + radius;
    const distSq = dx * dx + dy * dy;
    if (distSq < minDist * minDist) {
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        return {
          x: cx + (dx / dist) * minDist,
          y: cy + (dy / dist) * minDist,
        };
      }
      return { x: cx + minDist, y: cy };
    }
    return { x: rx, y: ry };
  }

  private pushOutOctagon(
    rx: number,
    ry: number,
    radius: number,
    obs: WorldObstacle
  ): { x: number; y: number } {
    const cx = obs.x + obs.width / 2;
    const cy = obs.y + obs.height / 2;
    const half = obs.width / 2;
    const cut = obs.width * 0.28;
    if (
      rx + radius <= obs.x ||
      rx - radius >= obs.x + obs.width ||
      ry + radius <= obs.y ||
      ry - radius >= obs.y + obs.height
    ) {
      return { x: rx, y: ry };
    }
    const diagLimit = (2 * half - cut) / Math.SQRT2 + radius;
    const adx = Math.abs(rx - cx);
    const ady = Math.abs(ry - cy);
    const diagDist = (adx + ady) / Math.SQRT2;
    const orthoPen = half + radius - Math.max(adx, ady);
    const diagPen = diagLimit - diagDist;

    if (orthoPen <= 0 || diagPen <= 0) {
      return { x: rx, y: ry };
    }
    if (diagPen < orthoPen) {
      const sx = rx >= cx ? 1 : -1;
      const sy = ry >= cy ? 1 : -1;
      const push = diagPen / Math.SQRT2;
      return { x: rx + sx * push, y: ry + sy * push };
    }
    if (adx > ady) {
      return { x: rx + (rx >= cx ? orthoPen : -orthoPen), y: ry };
    }
    return { x: rx, y: ry + (ry >= cy ? orthoPen : -orthoPen) };
  }

  public resolveCircleCollision(x: number, y: number, radius: number): { x: number; y: number } {
    if (!this.isInfinite) {
      return { x, y };
    }

    const area = this.queryArea(
      x - radius - 360,
      y - radius - 360,
      x + radius + 360,
      y + radius + 360
    );
    let rx = x;
    let ry = y;

    // 2 iteraciones aseguran resolución limpia cuando varias piezas están pegadas entre sí
    for (let pass = 0; pass < 2; pass++) {
      for (const obs of area.obstacles) {
        if (obs.kind === 'DATA_PILLAR' && obs.radius) {
          const res = this.pushOutCircle(
            rx,
            ry,
            radius,
            obs.x + obs.radius,
            obs.y + obs.radius,
            obs.radius
          );
          rx = res.x;
          ry = res.y;
        } else if (obs.kind === 'HEX_BUNKER') {
          const res = this.pushOutOctagon(rx, ry, radius, obs);
          rx = res.x;
          ry = res.y;
        } else if (obs.kind === 'L_BASTION') {
          const [hRect, vRect] = this.getLBastionRects(obs);
          const r1 = this.pushOutRect(rx, ry, radius, hRect.x, hRect.y, hRect.w, hRect.h);
          const r2 = this.pushOutRect(r1.x, r1.y, radius, vRect.x, vRect.y, vRect.w, vRect.h);
          rx = r2.x;
          ry = r2.y;
        } else {
          const res = this.pushOutRect(rx, ry, radius, obs.x, obs.y, obs.width, obs.height);
          rx = res.x;
          ry = res.y;
        }
      }
    }

    return { x: rx, y: ry };
  }

  public isInSlowLiquid(x: number, y: number, _timeSec: number = 0): boolean {
    if (!this.isInfinite) return false;

    const area = this.queryArea(x - 240, y - 240, x + 240, y + 240);
    for (const pool of area.liquids) {
      const dx = x - pool.x;
      const dy = y - pool.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= pool.radius * 1.15) {
        const theta = Math.atan2(dy, dx);
        if (dist <= this.getLakeContourRadius(pool, theta, 0.96)) {
          return true;
        }
      }
    }
    return false;
  }

  private spawnDynamicOasis(
    alivePlayers: { x: number; y: number }[],
    _timeSec: number
  ): OasisZone | null {
    if (alivePlayers.length === 0) return null;

    const candidateQuads = [0, 1, 2, 3].filter((q) => q !== this.lastQuadrant);
    const chosenQuad = candidateQuads[Math.floor(Math.random() * candidateQuads.length)];
    this.lastQuadrant = chosenQuad;

    const r = 72;
    let bestX = SPAWN_CX + 340;
    let bestY = SPAWN_CY;

    if (!this.isInfinite) {
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
      const anchor = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      for (let attempt = 0; attempt < 22; attempt++) {
        const quadOffset = chosenQuad * (Math.PI * 0.5);
        const angle = quadOffset + (Math.random() - 0.5) * 1.15;
        const dist = 420 + Math.random() * 340;
        const cx = anchor.x + Math.cos(angle) * dist;
        const cy = anchor.y + Math.sin(angle) * dist;

        const area = this.queryArea(cx - 280, cy - 280, cx + 280, cy + 280);
        const hitsObs = area.obstacles.some((obs) => this.pointHitsObstacle(cx, cy, r + 18, obs));
        const hitsLake = area.liquids.some(
          (pool) => Math.hypot(cx - pool.x, cy - pool.y) < r + pool.radius + 32
        );
        const hitsOasis = this.activeOases.some((o) => Math.hypot(o.x - cx, o.y - cy) < 420);
        if (!hitsObs && !hitsLake && !hitsOasis) {
          bestX = Math.round(cx);
          bestY = Math.round(cy);
          break;
        }
        if (attempt === 21) {
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

  private drawLake(ctx: CanvasRenderingContext2D, pool: SlowLiquidPool, nowMs: number): void {
    const pts = 32;
    ctx.save();

    const traceLake = (scaleR: number) => {
      ctx.beginPath();
      for (let i = 0; i <= pts; i++) {
        const theta = (i / pts) * Math.PI * 2;
        const r = this.getLakeContourRadius(pool, theta, scaleR);
        const px = pool.x + Math.cos(theta) * r;
        const py = pool.y + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    traceLake(1.06);
    ctx.fillStyle = 'rgba(88, 28, 135, 0.16)';
    ctx.fill();

    traceLake(1.0);
    ctx.fillStyle = 'rgba(107, 33, 168, 0.36)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(216, 180, 254, 0.72)';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    traceLake(0.76);
    ctx.fillStyle = 'rgba(126, 34, 206, 0.25)';
    ctx.fill();

    traceLake(0.5);
    ctx.fillStyle = 'rgba(147, 51, 234, 0.28)';
    ctx.fill();

    for (let ringIdx = 0; ringIdx < 2; ringIdx++) {
      const rippleProgress = (nowMs * 0.00042 + pool.phase + ringIdx * 0.5) % 1;
      ctx.strokeStyle = `rgba(233, 213, 255, ${0.42 * (1 - rippleProgress)})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.radius * (0.14 + rippleProgress * 0.68), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(243, 232, 255, 0.62)';
    for (let b = 0; b < 7; b++) {
      const ba = pool.phase + b * 0.897;
      const br = pool.radius * (0.2 + (b % 3) * 0.22);
      const bubR = 2.5 + Math.abs(Math.sin(nowMs * 0.0028 + b + pool.phase)) * 2.8;
      ctx.beginPath();
      ctx.arc(pool.x + Math.cos(ba) * br, pool.y + Math.sin(ba) * br, bubR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = 'rgba(233, 213, 255, 0.9)';
    ctx.fillText(
      i18n.t('LAGO VISCOSO (-VEL)', 'VISCOUS LAKE (-SPD)'),
      pool.x,
      pool.y + pool.radius + 22
    );
    ctx.restore();
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, obs: WorldObstacle, nowMs: number): void {
    const x = obs.x;
    const y = obs.y;
    const w = obs.width;
    const h = obs.height;
    ctx.save();

    if (obs.kind === 'DATA_PILLAR' && obs.radius) {
      const cx = x + obs.radius;
      const cy = y + obs.radius;
      const r = obs.radius;

      ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
      ctx.beginPath();
      ctx.arc(cx + 8, cy + 10, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(165, 180, 252, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#a5b4fc';
      for (let b = 0; b < 8; b++) {
        const a = (b / 8) * Math.PI * 2 + obs.variantSeed;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r * 0.87, cy + Math.sin(a) * r * 0.87, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(nowMs * 0.0011 * (obs.variantSeed > 0.5 ? 1 : -1));
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 3.2;
      for (let s = 0; s < 3; s++) {
        const a = (s / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r * 0.18), Math.sin(a) * (r * 0.18));
        ctx.lineTo(Math.cos(a) * (r * 0.58), Math.sin(a) * (r * 0.58));
        ctx.stroke();
      }
      ctx.restore();

      const pulse = 0.72 + Math.sin(nowMs * 0.004 + obs.variantSeed * 6) * 0.28;
      ctx.fillStyle = `rgba(129, 140, 248, ${pulse})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e0e7ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
      return;
    }

    if (obs.kind === 'HEX_BUNKER') {
      const cut = w * 0.28;
      const traceOct = (dx: number, dy: number, inset: number) => {
        const x0 = x + dx + inset;
        const y0 = y + dy + inset;
        const ow = w - inset * 2;
        const oh = h - inset * 2;
        const c = Math.max(8, cut - inset * 0.7);
        ctx.beginPath();
        ctx.moveTo(x0 + c, y0);
        ctx.lineTo(x0 + ow - c, y0);
        ctx.lineTo(x0 + ow, y0 + c);
        ctx.lineTo(x0 + ow, y0 + oh - c);
        ctx.lineTo(x0 + ow - c, y0 + oh);
        ctx.lineTo(x0 + c, y0 + oh);
        ctx.lineTo(x0, y0 + oh - c);
        ctx.lineTo(x0, y0 + c);
        ctx.closePath();
      };

      traceOct(8, 10, 0);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.62)';
      ctx.fill();

      traceOct(0, 0, 0);
      ctx.fillStyle = '#0f292e';
      ctx.fill();
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2.6;
      ctx.stroke();

      traceOct(0, 0, 18);
      ctx.fillStyle = '#091a1f';
      ctx.fill();
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.48)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.45)';
      ctx.lineWidth = 2;
      const arm = w * 0.34;
      ctx.beginPath();
      ctx.moveTo(cx - arm, cy - arm);
      ctx.lineTo(cx + arm, cy + arm);
      ctx.moveTo(cx + arm, cy - arm);
      ctx.lineTo(cx - arm, cy + arm);
      ctx.stroke();

      const coreR = w * 0.14;
      ctx.fillStyle = '#14b8a6';
      ctx.strokeStyle = '#ccfbf1';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 - Math.PI / 6;
        const px = cx + Math.cos(a) * coreR;
        const py = cy + Math.sin(a) * coreR;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
      return;
    }

    if (obs.kind === 'FIREWALL_WALL') {
      const horiz = w >= h;
      const cut = 12;
      const traceBar = (dx: number, dy: number) => {
        ctx.beginPath();
        ctx.moveTo(x + dx + cut, y + dy);
        ctx.lineTo(x + dx + w - cut, y + dy);
        ctx.lineTo(x + dx + w, y + dy + cut);
        ctx.lineTo(x + dx + w, y + dy + h - cut);
        ctx.lineTo(x + dx + w - cut, y + dy + h);
        ctx.lineTo(x + dx + cut, y + dy + h);
        ctx.lineTo(x + dx, y + dy + h - cut);
        ctx.lineTo(x + dx, y + dy + cut);
        ctx.closePath();
      };

      traceBar(7, 9);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
      ctx.fill();

      traceBar(0, 0);
      ctx.fillStyle = '#241811';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.fillStyle = 'rgba(251, 191, 36, 0.72)';
      if (horiz) {
        ctx.fillRect(x + 22, y + h / 2 - 4, w - 44, 8);
      } else {
        ctx.fillRect(x + w / 2 - 4, y + 22, 8, h - 44);
      }

      ctx.fillStyle = 'rgba(245, 158, 11, 0.38)';
      const len = horiz ? w : h;
      const steps = Math.max(3, Math.floor((len - 40) / 30));
      for (let s = 0; s < steps; s++) {
        if (horiz) {
          ctx.fillRect(x + 20 + s * 30, y + 9, 14, 5);
          ctx.fillRect(x + 20 + s * 30, y + h - 14, 14, 5);
        } else {
          ctx.fillRect(x + 9, y + 20 + s * 30, 5, 14);
          ctx.fillRect(x + w - 14, y + 20 + s * 30, 5, 14);
        }
      }

      ctx.restore();
      return;
    }

    if (obs.kind === 'L_BASTION') {
      const [hRect, vRect] = this.getLBastionRects(obs);
      const t = obs.armThickness ?? 70;
      const ori = obs.orientation ?? 0;

      const traceL = (dx: number, dy: number) => {
        const pts: [number, number][] =
          ori === 0
            ? [[x, y], [x + w, y], [x + w, y + t], [x + t, y + t], [x + t, y + h], [x, y + h]]
            : ori === 1
              ? [[x, y], [x + w, y], [x + w, y + h], [x + w - t, y + h], [x + w - t, y + t], [x, y + t]]
              : ori === 2
                ? [[x + w - t, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y + h - t], [x + w - t, y + h - t]]
                : [[x, y], [x + t, y], [x + t, y + h - t], [x + w, y + h - t], [x + w, y + h], [x, y + h]];
        ctx.beginPath();
        for (let idx = 0; idx < pts.length; idx++) {
          const px = pts[idx][0] + dx;
          const py = pts[idx][1] + dy;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      };

      traceL(7, 9);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.62)';
      ctx.fill();

      traceL(0, 0);
      ctx.fillStyle = '#2b1222';
      ctx.fill();
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 2.6;
      ctx.stroke();

      const jx = ori === 0 || ori === 3 ? x : x + w - t;
      const jy = ori === 0 || ori === 1 ? y : y + h - t;
      ctx.fillStyle = 'rgba(251, 113, 133, 0.78)';
      ctx.fillRect(hRect.x + 16, hRect.y + hRect.h / 2 - 3, hRect.w - 32, 6);
      ctx.fillRect(vRect.x + vRect.w / 2 - 3, vRect.y + 16, 6, vRect.h - 32);

      const nodeX = jx + t / 2;
      const nodeY = jy + t / 2;
      ctx.fillStyle = '#fda4af';
      ctx.beginPath();
      ctx.arc(nodeX, nodeY, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    const cut = 16;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
    ctx.fillRect(x + 8, y + 10, w, h);

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.4;
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
    ctx.fillRect(x + 14, y + 14, w - 28, h - 28);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x + 14, y + 14, w - 28, h - 28);

    const rackRows = Math.max(3, Math.floor((h - 46) / 24));
    for (let rIdx = 0; rIdx < rackRows; rIdx++) {
      const ry = y + 24 + rIdx * 24;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.fillRect(x + 22, ry, w - 44, 15);
      ctx.fillStyle = rIdx === 0 ? '#38bdf8' : 'rgba(148, 163, 184, 0.52)';
      ctx.fillRect(x + 26, ry + 5, Math.max(24, w - 76), 4);
      const blinkOn = Math.sin(nowMs * 0.006 + rIdx * 1.7 + obs.variantSeed * 10) > 0;
      ctx.fillStyle = blinkOn ? '#34d399' : '#0284c7';
      ctx.beginPath();
      ctx.arc(x + w - 30, ry + 7.5, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
    nowMs: number,
    _timeSec: number = 0
  ): void {
    const area = this.queryArea(camX - 240, camY - 240, camX + viewW + 240, camY + viewH + 240);

    // 1. Lagos estáticos grandes con fluido lento (solo Modo Infinito)
    if (this.isInfinite) {
      for (const pool of area.liquids) {
        this.drawLake(ctx, pool, nowMs);
      }
    }

    // 2. Oasis dinámicos
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

      ctx.strokeStyle = 'rgba(110, 231, 183, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(oasis.x, oasis.y, oasis.radius * (0.48 + ((nowMs * 0.0006) % 0.45)), 0, Math.PI * 2);
      ctx.stroke();

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

    // 3. Complejos de obstáculos pegados entre sí (solo Modo Infinito: Pesadilla / Co-op)
    if (this.isInfinite) {
      for (const obs of area.obstacles) {
        this.drawObstacle(ctx, obs, nowMs);
      }
    }
  }
}
