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
}

export interface OasisZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  duration: number;
  progress: number;
  cooldownTimer: number;
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
  oases: { id: string; x: number; y: number; radius: number; duration: number }[];
}

const SECTOR_SIZE = 780;
const SPAWN_CX = 960;
const SPAWN_CY = 540;
const SAFE_SPAWN_RADIUS = 240;

/**
 * Entorno interactivo del mapa (modo finito e infinito):
 * - Obstáculos sólidos (servidores blindados) con deslizamiento suave.
 * - Charcos de líquido corrupto que ralentizan (-42% velocidad).
 * - Oasis cibernéticos curativos con recompensas (HP + Cripto + XP + Turbo).
 */
export class WorldEnvironment {
  public seed: number = 1337;
  public isInfinite: boolean = false;

  private classicObstacles: WorldObstacle[] = [];
  private classicLiquids: SlowLiquidPool[] = [];
  private classicOases: { id: string; x: number; y: number; radius: number; duration: number }[] = [];

  private sectorCache: Map<string, SectorData> = new Map();
  private oasisRuntime: Map<string, { progress: number; cooldownTimer: number }> = new Map();

  public reset(seed: number = 1337, isInfinite: boolean = false): void {
    this.seed = seed >>> 0 || 1337;
    this.isInfinite = isInfinite;
    this.sectorCache.clear();
    this.oasisRuntime.clear();

    if (!isInfinite) {
      // Disposición equilibrada para Arena Clásica (1920x1080)
      this.classicObstacles = [
        { id: 'c_obs_1', x: 370, y: 240, width: 88, height: 88 },
        { id: 'c_obs_2', x: 1462, y: 240, width: 88, height: 88 },
        { id: 'c_obs_3', x: 370, y: 752, width: 88, height: 88 },
        { id: 'c_obs_4', x: 1462, y: 752, width: 88, height: 88 },
      ];
      this.classicLiquids = [
        { id: 'c_liq_1', x: 640, y: 540, radius: 74, phase: 0.4 },
        { id: 'c_liq_2', x: 1280, y: 540, radius: 74, phase: 2.1 },
      ];
      this.classicOases = [
        { id: 'c_oasis_1', x: 960, y: 215, radius: 74, duration: 1.5 },
        { id: 'c_oasis_2', x: 960, y: 865, radius: 74, duration: 1.5 },
      ];
    } else {
      this.classicObstacles = [];
      this.classicLiquids = [];
      this.classicOases = [];
    }
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
    const oases: { id: string; x: number; y: number; radius: number; duration: number }[] = [];

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
        return Math.abs(cx - px) < (w + prev.width) / 2 + 56 && Math.abs(cy - py) < (h + prev.height) / 2 + 56;
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

    // Líquido lento (charco de refrigerante/datos corruptos)
    if (this.hash2D(sx, sy, 31) > 0.18) {
      const r = 68 + Math.floor(this.hash2D(sx, sy, 32) * 34);
      const lx = baseX + 130 + this.hash2D(sx, sy, 33) * (SECTOR_SIZE - 260);
      const ly = baseY + 130 + this.hash2D(sx, sy, 34) * (SECTOR_SIZE - 260);
      const overlapsObs = obstacles.some(
        (o) => Math.hypot(lx - (o.x + o.width / 2), ly - (o.y + o.height / 2)) < r + 84
      );
      if (!overlapsObs && Math.hypot(lx - SPAWN_CX, ly - SPAWN_CY) > SAFE_SPAWN_RADIUS) {
        liquids.push({
          id: `liq_${sx}_${sy}`,
          x: Math.round(lx),
          y: Math.round(ly),
          radius: r,
          phase: this.hash2D(sx, sy, 35) * Math.PI * 2,
        });
      }
    }

    // Oasis con recompensas (garantizado cerca de origen en sector (1, 0) y ~62% en resto)
    const isOriginSector = sx === 1 && sy === 0;
    if (isOriginSector || this.hash2D(sx, sy, 41) > 0.36) {
      const r = 74;
      const ox = isOriginSector
        ? SPAWN_CX + 320
        : baseX + 150 + this.hash2D(sx, sy, 42) * (SECTOR_SIZE - 300);
      const oy = isOriginSector
        ? SPAWN_CY - 190
        : baseY + 150 + this.hash2D(sx, sy, 43) * (SECTOR_SIZE - 300);
      const badObs = obstacles.some(
        (o) => Math.hypot(ox - (o.x + o.width / 2), oy - (o.y + o.height / 2)) < r + 86
      );
      const badLiq = liquids.some(
        (l) => Math.hypot(ox - l.x, oy - l.y) < r + l.radius + 52
      );
      if (!badObs && !badLiq) {
        oases.push({
          id: `oasis_${sx}_${sy}`,
          x: Math.round(ox),
          y: Math.round(oy),
          radius: r,
          duration: 1.5,
        });
      }
    }

    const sector: SectorData = { obstacles, liquids, oases };
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
        obstacles: this.classicObstacles,
        liquids: this.classicLiquids,
        oases: this.classicOases.map((o) => {
          const st = this.oasisRuntime.get(o.id);
          return {
            ...o,
            progress: st?.progress ?? 0,
            cooldownTimer: st?.cooldownTimer ?? 0,
          };
        }),
      };
    }

    const sMinX = Math.floor(minX / SECTOR_SIZE);
    const sMaxX = Math.floor(maxX / SECTOR_SIZE);
    const sMinY = Math.floor(minY / SECTOR_SIZE);
    const sMaxY = Math.floor(maxY / SECTOR_SIZE);

    const obstacles: WorldObstacle[] = [];
    const liquids: SlowLiquidPool[] = [];
    const oases: OasisZone[] = [];

    for (let sx = sMinX; sx <= sMaxX; sx++) {
      for (let sy = sMinY; sy <= sMaxY; sy++) {
        const sec = this.getOrCreateSector(sx, sy);
        obstacles.push(...sec.obstacles);
        liquids.push(...sec.liquids);
        for (const o of sec.oases) {
          const st = this.oasisRuntime.get(o.id);
          oases.push({
            ...o,
            progress: st?.progress ?? 0,
            cooldownTimer: st?.cooldownTimer ?? 0,
          });
        }
      }
    }

    return { obstacles, liquids, oases };
  }

  public resolveCircleCollision(x: number, y: number, radius: number): { x: number; y: number } {
    const area = this.queryArea(x - radius - 140, y - radius - 140, x + radius + 140, y + radius + 140);
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
          // Centro exactamente dentro del bloque: empujar hacia la cara más cercana
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

  public isInSlowLiquid(x: number, y: number): boolean {
    const area = this.queryArea(x - 130, y - 130, x + 130, y + 130);
    for (const pool of area.liquids) {
      if (Math.hypot(x - pool.x, y - pool.y) <= pool.radius * 0.94) {
        return true;
      }
    }
    return false;
  }

  public updateOases(
    dt: number,
    alivePlayers: { x: number; y: number }[],
    authoritative: boolean
  ): OasisRewardEvent[] {
    // Enfriar oasis que están en cooldown
    for (const [id, st] of this.oasisRuntime.entries()) {
      if (st.cooldownTimer > 0) {
        st.cooldownTimer = Math.max(0, st.cooldownTimer - dt);
        if (st.cooldownTimer === 0 && st.progress === 0) {
          this.oasisRuntime.delete(id);
        }
      }
    }

    if (!authoritative || alivePlayers.length === 0) return [];

    const rewards: OasisRewardEvent[] = [];
    const seen = new Set<string>();

    for (const pl of alivePlayers) {
      const area = this.queryArea(pl.x - 140, pl.y - 140, pl.x + 140, pl.y + 140);
      for (const oasis of area.oases) {
        if (seen.has(oasis.id)) continue;
        seen.add(oasis.id);

        const st = this.oasisRuntime.get(oasis.id) || { progress: 0, cooldownTimer: 0 };
        if (st.cooldownTimer > 0) continue;

        const someoneInside = alivePlayers.some(
          (p) => Math.hypot(p.x - oasis.x, p.y - oasis.y) <= oasis.radius
        );

        if (someoneInside) {
          st.progress += dt;
          if (st.progress >= oasis.duration) {
            st.progress = 0;
            st.cooldownTimer = 38;
            rewards.push({
              id: oasis.id,
              x: oasis.x,
              y: oasis.y,
              heal: 35,
              coins: 4,
              xp: 150,
            });
          }
          this.oasisRuntime.set(oasis.id, st);
        } else if (st.progress > 0) {
          st.progress = Math.max(0, st.progress - dt * 0.45);
          if (st.progress === 0) {
            this.oasisRuntime.delete(oasis.id);
          } else {
            this.oasisRuntime.set(oasis.id, st);
          }
        }
      }
    }

    return rewards;
  }

  public exportOasisStates(): [string, number, number][] {
    const out: [string, number, number][] = [];
    for (const [id, st] of this.oasisRuntime.entries()) {
      if (st.progress > 0 || st.cooldownTimer > 0) {
        out.push([id, Number(st.progress.toFixed(2)), Number(st.cooldownTimer.toFixed(1))]);
      }
    }
    return out.slice(0, 24);
  }

  public applyRemoteOasisStates(states: [string, number, number][]): void {
    this.oasisRuntime.clear();
    for (const [id, progress, cooldownTimer] of states) {
      this.oasisRuntime.set(id, { progress, cooldownTimer });
    }
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
    nowMs: number
  ): void {
    const area = this.queryArea(camX - 180, camY - 180, camX + viewW + 180, camY + viewH + 180);

    // 1. Charcos de líquido lento (datos viscosos violeta/púrpura)
    for (const pool of area.liquids) {
      const pulse = Math.sin(nowMs * 0.004 + pool.phase) * 0.06;
      const r = pool.radius * (1 + pulse);

      ctx.save();
      ctx.fillStyle = 'rgba(126, 34, 206, 0.28)';
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
      ctx.beginPath();
      ctx.arc(pool.x + Math.cos(nowMs * 0.002 + pool.phase) * 5, pool.y + Math.sin(nowMs * 0.002) * 4, r * 0.68, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(216, 180, 254, 0.62)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, r, (nowMs * 0.001) % (Math.PI * 2), Math.PI * 2 + (nowMs * 0.001) % (Math.PI * 2));
      ctx.stroke();
      ctx.setLineDash([]);

      // Burbujas viscosas
      ctx.fillStyle = 'rgba(233, 213, 255, 0.55)';
      for (let b = 0; b < 3; b++) {
        const ba = pool.phase + b * 2.1 + nowMs * 0.0008;
        const br = r * (0.28 + b * 0.16);
        ctx.beginPath();
        ctx.arc(pool.x + Math.cos(ba) * br, pool.y + Math.sin(ba * 1.2) * br, 2.5 + Math.abs(Math.sin(nowMs * 0.005 + b)) * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.textAlign = 'center';
      ctx.font = 'bold 10px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = 'rgba(233, 213, 255, 0.85)';
      ctx.fillText(i18n.t('LÍQUIDO VISCOSO (-VEL)', 'SLOW SLUDGE (-SPD)'), pool.x, pool.y + r + 14);
      ctx.restore();
    }

    // 2. Oasis curativos con recompensas
    for (const oasis of area.oases) {
      const ready = oasis.cooldownTimer <= 0;
      const pulse = 0.82 + Math.sin(nowMs * 0.005) * 0.18;

      ctx.save();
      ctx.fillStyle = ready ? `rgba(16, 185, 129, ${0.18 * pulse})` : 'rgba(51, 65, 85, 0.18)';
      ctx.beginPath();
      ctx.arc(oasis.x, oasis.y, oasis.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = ready ? '#10b981' : '#64748b';
      ctx.lineWidth = ready ? 2.4 : 1.4;
      ctx.beginPath();
      ctx.arc(oasis.x, oasis.y, oasis.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (ready) {
        // Anillo interior cristalino de manantial
        ctx.strokeStyle = 'rgba(110, 231, 183, 0.55)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(oasis.x, oasis.y, oasis.radius * (0.5 + ((nowMs * 0.0006) % 0.45)), 0, Math.PI * 2);
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
      }

      if (oasis.progress > 0 && ready) {
        const pct = Math.min(1, oasis.progress / oasis.duration);
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(oasis.x, oasis.y, oasis.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = ready ? '#6ee7b7' : '#94a3b8';
      ctx.fillText(
        ready
          ? i18n.t('✦ OASIS (+HP +CRIPTO +XP)', '✦ OASIS (+HP +CRYPTO +XP)')
          : i18n.t(`OASIS (${Math.ceil(oasis.cooldownTimer)}s)`, `OASIS (${Math.ceil(oasis.cooldownTimer)}s)`),
        oasis.x,
        oasis.y - oasis.radius - 10
      );
      ctx.restore();
    }

    // 3. Obstáculos sólidos (Bloques / Servidores de acero)
    for (const obs of area.obstacles) {
      const cut = 10;
      const x = obs.x;
      const y = obs.y;
      const w = obs.width;
      const h = obs.height;

      ctx.save();
      // Sombra proyectada
      ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
      ctx.fillRect(x + 6, y + 8, w, h);

      // Bloque metálico biselado
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

      // Panel superior + rejilla hardware
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 12, y + 12, w - 24, h - 24);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);

      // Barras LED decorativas
      const ledOn = Math.floor(nowMs / 450 + obs.x) % 2 === 0;
      ctx.fillStyle = ledOn ? '#38bdf8' : '#0284c7';
      ctx.fillRect(x + 18, y + 19, w - 36, 4);
      ctx.fillStyle = '#475569';
      ctx.fillRect(x + 18, y + 29, w - 36, 3);
      ctx.fillRect(x + 18, y + 36, w - 36, 3);
      ctx.restore();
    }
  }
}
