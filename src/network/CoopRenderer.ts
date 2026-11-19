import { Player } from '../entities/Player';
import { Adware, MalwareType } from '../entities/Adware';
import { i18n } from '../utils/i18n';
import type { WorldEnvironment } from '../systems/WorldEnvironment';
import type {
  CoopWorldSnapshot,
  SnapshotDroneTuple,
  SnapshotEnemyTuple,
  SnapshotPetTuple,
  SnapshotPickupTuple,
  SnapshotPlayer,
  SnapshotProjTuple,
  SnapshotRingTuple,
  SnapshotZoneTuple,
} from './MultiplayerTypes';

interface InterpTrack {
  prevX: number;
  prevY: number;
  targetX: number;
  targetY: number;
  drawX: number;
  drawY: number;
  prevAngle: number;
  targetAngle: number;
  recvMs: number;
  spanMs: number;
}

export interface LocalPlayerOverride {
  x: number;
  y: number;
  facingAngle?: number;
  isMoving?: boolean;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = (b - a + Math.PI) % (Math.PI * 2);
  if (diff < 0) diff += Math.PI * 2;
  diff -= Math.PI;
  return a + diff * t;
}

export const ENEMY_CODE_MAP: Record<MalwareType, number> = {
  ADWARE: 0,
  WORM: 1,
  ARMORED_WORM: 2,
  TROJAN_SHOOTER: 3,
  EVASOR: 4,
  CRYPTO_MINER: 5,
  HARDWARE_BOX: 6,
  TROJAN: 7,
  RANSOMWARE: 8,
  FINAL_BOSS: 9,
};

export function encodeEnemyType(enemy: Adware): number {
  const bossTitle = (enemy as { bossTitle?: string }).bossTitle;
  if (bossTitle) {
    if (bossTitle === 'RANSOMWARE') return 8;
    if (bossTitle === 'ROOTKIT_TITAN') return 10;
    if (bossTitle === 'TROJAN_OVERLORD') return 11;
    if (bossTitle === 'WORM_PRIME') return 12;
    if (bossTitle === 'SPYWARE_SPECTER') return 13;
  }
  return ENEMY_CODE_MAP[enemy.malwareType] ?? 0;
}

/**
 * Renderizador ligero para clientes Invitados (Guests) y capas Co-op compartidas.
 * Reutiliza la estética cyber-mecha de Player.drawCyberChassis y los disparos "pro".
 */
export class CoopRenderer {
  private static playerTracks: Map<string, InterpTrack> = new Map();
  private static enemyTracks: Map<number, InterpTrack> = new Map();
  private static snapRecvMs: number = 0;
  private static avgSpanMs: number = 44;

  public static resetState(): void {
    this.playerTracks.clear();
    this.enemyTracks.clear();
    this.snapRecvMs = 0;
    this.avgSpanMs = 44;
  }

  public static ingestSnapshot(snap: CoopWorldSnapshot): void {
    const now = performance.now();
    if (this.snapRecvMs > 0) {
      const delta = now - this.snapRecvMs;
      if (delta >= 12 && delta <= 250) {
        this.avgSpanMs = Math.max(32, Math.min(95, this.avgSpanMs * 0.7 + delta * 0.3));
      }
    }
    this.snapRecvMs = now;
    const span = this.avgSpanMs;

    const seenPlayers = new Set<string>();
    for (const pl of snap.players) {
      seenPlayers.add(pl.id);
      const prev = this.playerTracks.get(pl.id);
      if (prev && Math.hypot(pl.x - prev.targetX, pl.y - prev.targetY) < 280) {
        prev.prevX = prev.drawX;
        prev.prevY = prev.drawY;
        prev.targetX = pl.x;
        prev.targetY = pl.y;
        prev.prevAngle = prev.targetAngle;
        prev.targetAngle = pl.facingAngle;
        prev.recvMs = now;
        prev.spanMs = span;
      } else {
        this.playerTracks.set(pl.id, {
          prevX: pl.x,
          prevY: pl.y,
          targetX: pl.x,
          targetY: pl.y,
          drawX: pl.x,
          drawY: pl.y,
          prevAngle: pl.facingAngle,
          targetAngle: pl.facingAngle,
          recvMs: now,
          spanMs: span,
        });
      }
    }
    for (const key of this.playerTracks.keys()) {
      if (!seenPlayers.has(key)) this.playerTracks.delete(key);
    }

    const seenEnemies = new Set<number>();
    for (const e of snap.enemies) {
      const netId = e[8];
      if (netId === undefined) continue;
      seenEnemies.add(netId);
      const ex = e[1];
      const ey = e[2];
      const eAng = e[6];
      const prev = this.enemyTracks.get(netId);
      if (prev && Math.hypot(ex - prev.targetX, ey - prev.targetY) < 260) {
        prev.prevX = prev.drawX;
        prev.prevY = prev.drawY;
        prev.targetX = ex;
        prev.targetY = ey;
        prev.prevAngle = prev.targetAngle;
        prev.targetAngle = eAng;
        prev.recvMs = now;
        prev.spanMs = span;
      } else {
        this.enemyTracks.set(netId, {
          prevX: ex,
          prevY: ey,
          targetX: ex,
          targetY: ey,
          drawX: ex,
          drawY: ey,
          prevAngle: eAng,
          targetAngle: eAng,
          recvMs: now,
          spanMs: span,
        });
      }
    }
    for (const key of this.enemyTracks.keys()) {
      if (!seenEnemies.has(key)) this.enemyTracks.delete(key);
    }
  }

  public static drawWorld(
    ctx: CanvasRenderingContext2D,
    snap: CoopWorldSnapshot,
    myId: string,
    overrideLocalPos?: LocalPlayerOverride,
    worldEnv?: WorldEnvironment
  ): void {
    const now = performance.now();
    const projElapsedSec =
      this.snapRecvMs > 0 ? Math.min(0.085, Math.max(0, (now - this.snapRecvMs) / 1000)) : 0;

    // 1. Zonas de Cuarentena y Eventos de Terreno
    for (const z of snap.zones) {
      this.drawZone(ctx, z, now);
    }

    // 1b. Charcos corrosivos (Worm Prime) y estelas Root en el suelo
    if (snap.rings && snap.rings.length > 0) {
      for (const ring of snap.rings) {
        if (ring[3] === 2 || ring[3] === 3) {
          this.drawRing(ctx, ring, now);
        }
      }
    }

    // 2. Recogibles (XP, CryptoCoins, PowerUps)
    for (const p of snap.pickups) {
      this.drawPickup(ctx, p, now);
    }

    // 3. Pulsos cortafuegos y arcos Tesla
    for (const pulse of snap.pulses) {
      const [px, py, radius, evolved] = pulse;
      ctx.save();
      ctx.strokeStyle = evolved ? 'rgba(250, 204, 21, 0.72)' : 'rgba(255, 136, 0, 0.7)';
      ctx.lineWidth = evolved ? 8 : 6;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(4, radius - 5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const arcPts of snap.arcs) {
      if (arcPts.length < 2) continue;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < arcPts.length; i++) {
        const [ax, ay] = arcPts[i];
        if (i === 0) ctx.moveTo(ax, ay);
        else {
          const [px, py] = arcPts[i - 1];
          ctx.lineTo((px + ax) * 0.5 + (Math.random() - 0.5) * 14, (py + ay) * 0.5 + (Math.random() - 0.5) * 14);
          ctx.lineTo(ax, ay);
        }
      }
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.8;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Enemigos y Jefes (con interpolación fluida por netId)
    for (const e of snap.enemies) {
      const netId = e[8];
      const tr = netId !== undefined ? this.enemyTracks.get(netId) : undefined;
      if (tr) {
        const rawT = Math.max(0, (now - tr.recvMs) / Math.max(16, tr.spanMs));
        const t = Math.min(1, rawT);
        tr.drawX = tr.prevX + (tr.targetX - tr.prevX) * t;
        tr.drawY = tr.prevY + (tr.targetY - tr.prevY) * t;
        const smoothAngle = lerpAngle(tr.prevAngle, tr.targetAngle, t);
        const interpTuple: SnapshotEnemyTuple = [
          e[0],
          tr.drawX,
          tr.drawY,
          e[3],
          e[4],
          e[5],
          smoothAngle,
          e[7],
          netId,
        ];
        this.drawEnemy(ctx, interpTuple, now);
      } else {
        this.drawEnemy(ctx, e, now);
      }
    }

    // 4b. Anillos expansivos (Crio, Explosión de Drones, Ondas de Mascota)
    if (snap.rings && snap.rings.length > 0) {
      for (const ring of snap.rings) {
        if (ring[3] !== 2 && ring[3] !== 3) {
          this.drawRing(ctx, ring, now);
        }
      }
    }

    // 5. Proyectiles "Pro" aliados y enemigos (extrapolación suave + recorte contra muros)
    for (const proj of snap.projectiles) {
      const [kind, px, py, vx, vy, evolved, size] = proj;
      const ex = px + vx * projElapsedSec;
      const ey = py + vy * projElapsedSec;
      if (
        worldEnv?.isInfinite &&
        (vx !== 0 || vy !== 0) &&
        worldEnv.findSegmentObstacleImpact(px, py, ex, ey, Math.max(3, (size || 10) * 0.35)) !== null
      ) {
        continue;
      }
      this.drawProjectile(ctx, [kind, ex, ey, vx, vy, evolved, size], now);
    }

    // 5b. Mascotas invocadas (Morcillita y ramas) y Drones orbitales del escuadrón
    if (snap.pets && snap.pets.length > 0) {
      for (const pet of snap.pets) {
        this.drawPet(ctx, pet, now);
      }
    }
    if (snap.drones && snap.drones.length > 0) {
      for (const drone of snap.drones) {
        this.drawDrone(ctx, drone, now);
      }
    }

    // 6. Todos los jugadores del escuadrón (local sin lag, aliados interpolados)
    for (const pl of snap.players) {
      if (pl.id === myId && overrideLocalPos) {
        const localPl: SnapshotPlayer = {
          ...pl,
          facingAngle: overrideLocalPos.facingAngle ?? pl.facingAngle,
          isMoving: overrideLocalPos.isMoving ?? pl.isMoving,
        };
        this.drawTeammate(ctx, localPl, overrideLocalPos.x, overrideLocalPos.y, true, now);
      } else {
        const tr = this.playerTracks.get(pl.id);
        if (tr) {
          const t = Math.min(1, Math.max(0, (now - tr.recvMs) / Math.max(16, tr.spanMs)));
          tr.drawX = tr.prevX + (tr.targetX - tr.prevX) * t;
          tr.drawY = tr.prevY + (tr.targetY - tr.prevY) * t;
          const interpPl: SnapshotPlayer = {
            ...pl,
            facingAngle: lerpAngle(tr.prevAngle, tr.targetAngle, t),
          };
          this.drawTeammate(ctx, interpPl, tr.drawX, tr.drawY, pl.id === myId, now);
        } else {
          this.drawTeammate(ctx, pl, pl.x, pl.y, pl.id === myId, now);
        }
      }
    }
  }

  public static drawTeammate(
    ctx: CanvasRenderingContext2D,
    pl: SnapshotPlayer,
    x: number,
    y: number,
    isSelf: boolean,
    now: number
  ): void {
    const size = 30;
    ctx.save();

    if (pl.downed) {
      // Cápsula de emergencia con anillo de reanimación (75px)
      const pulse = 0.55 + 0.45 * Math.sin(now * 0.01);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.14)';
      ctx.beginPath();
      ctx.arc(x, y, 75, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(244, 63, 94, ${0.45 + pulse * 0.4})`;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.arc(x, y, 75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (pl.reviveProgress > 0) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(x, y, 75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, pl.reviveProgress));
        ctx.stroke();
      }

      ctx.globalAlpha = 0.45;
      Player.drawCyberChassis(
        ctx,
        x,
        y,
        size,
        '#475569',
        '#f43f5e',
        now,
        pl.facingAngle,
        false,
        pl.hatId,
        pl.characterId
      );
      ctx.globalAlpha = 1;

      ctx.textAlign = 'center';
      ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = '#fda4af';
      ctx.fillText(
        `[ ${i18n.t('CAÍDO — RESCATAR', 'DOWNED — REVIVE')} ${Math.round(pl.reviveProgress * 100)}% ]`,
        x,
        y - 34
      );
      ctx.restore();
      return;
    }

    // Sombra de contacto
    ctx.fillStyle = 'rgba(2, 6, 14, 0.52)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.52, size * 0.52, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    if (pl.shieldReady) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.92, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pl.adrenaline) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.88 + Math.sin(now * 0.02) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    Player.drawCyberChassis(
      ctx,
      x,
      y,
      size,
      pl.color,
      pl.borderColor,
      now,
      pl.facingAngle,
      pl.isMoving,
      pl.hatId,
      pl.characterId
    );

    // Etiqueta superior del jugador ([P1] Nombre) y barra de vida inferior
    ctx.textAlign = 'center';
    ctx.font = 'bold 10.5px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = isSelf ? '#fef08a' : pl.borderColor;
    ctx.fillText(`[J${pl.slot + 1}] ${pl.name}`, x, y - size * 0.82 - (pl.hatId ? 10 : 2));

    const barW = 40;
    const barH = 5;
    const bx = x - barW / 2;
    const by = y + size / 2 + 10;
    const ratio = Math.max(0, Math.min(1, pl.hp / Math.max(1, pl.maxHp)));
    ctx.fillStyle = 'rgba(9, 14, 26, 0.9)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = ratio > 0.5 ? '#10b981' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(bx, by, barW * ratio, barH);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, barH);

    ctx.restore();
  }

  private static drawZone(ctx: CanvasRenderingContext2D, z: SnapshotZoneTuple, now: number): void {
    const [kind, x, y, radius, progress, duration, flag] = z;
    ctx.save();
    if (kind === 0) {
      const pulse = 0.85 + Math.sin(now * 0.008) * 0.15;
      ctx.fillStyle = flag ? `rgba(251, 191, 36, ${0.15 * pulse})` : `rgba(16, 185, 129, ${0.14 * pulse})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = flag ? 'rgba(251, 191, 36, 0.88)' : 'rgba(52, 211, 153, 0.82)';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(x, y, radius, (now * 0.002) % (Math.PI * 2), Math.PI * 2 + (now * 0.002) % (Math.PI * 2));
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const color =
        kind === 1 ? '#38bdf8' : kind === 2 ? '#a855f7' : kind === 3 ? '#fbbf24' : '#ff1e42';
      const label =
        kind === 1
          ? i18n.t('SERVIDOR CRIO (+OVERCLOCK)', 'CRYO SERVER (+OVERCLOCK)')
          : kind === 2
          ? i18n.t('BALIZA EMP (PULSO)', 'EMP PYLON (BLAST)')
          : kind === 3
          ? i18n.t('BÓVEDA CRIPTO (+10 CR)', 'CRYPTO VAULT (+10 CR)')
          : i18n.t('¡TORMENTA DE DATOS!', 'DATA STORM!');
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (progress > 0 && duration > 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress / duration));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = color;
      ctx.fillText(label, x, y - radius - 10);
    }
    ctx.restore();
  }

  private static drawPickup(ctx: CanvasRenderingContext2D, p: SnapshotPickupTuple, now: number): void {
    const [kind, x, y] = p;
    ctx.save();
    ctx.translate(x, y);
    if (kind === 0) {
      const r = 6.5 * (1 + Math.sin(now * 0.008 + x) * 0.12);
      ctx.fillStyle = '#00ffcc';
      ctx.strokeStyle = '#a5f3fc';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.15);
      ctx.lineTo(r * 0.72, -r * 0.35);
      ctx.lineTo(r * 0.72, r * 0.35);
      ctx.lineTo(0, r * 1.15);
      ctx.lineTo(-r * 0.72, r * 0.35);
      ctx.lineTo(-r * 0.72, -r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (kind === 1) {
      const r = 8;
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      const color = kind === 2 ? '#ff1e42' : kind === 3 ? '#00f0ff' : kind === 4 ? '#f97316' : '#10b981';
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.fillRect(-9, -9, 18, 18);
      ctx.strokeRect(-9, -9, 18, 18);
    }
    ctx.restore();
  }

  private static drawRing(ctx: CanvasRenderingContext2D, ring: SnapshotRingTuple, now: number): void {
    const [x, y, radius, kind] = ring;
    ctx.save();
    if (kind === 2) {
      // Charco tóxico de Worm Prime
      const pulse = 0.85 + Math.sin(now * 0.008 + x * 0.05) * 0.15;
      ctx.fillStyle = `rgba(16, 185, 129, ${0.22 * pulse})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.78)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (kind === 3) {
      // Estela eléctrica pasiva de Root
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.72)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (kind === 1) {
      // Explosión AoE de Dron Antivirus
      ctx.strokeStyle = 'rgba(255, 30, 66, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 4) {
      // Onda de choque de Morcillita Brute
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.78)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Anillo Criogénico
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private static drawDrone(ctx: CanvasRenderingContext2D, drone: SnapshotDroneTuple, now: number): void {
    const [x, y, durability, evolved] = drone;
    const droneColor = evolved
      ? '#fbbf24'
      : durability >= 3
      ? '#00ff66'
      : durability === 2
      ? '#facc15'
      : '#ff1e42';
    const hexR = evolved ? 12 : 10;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(now * 0.005);
    ctx.fillStyle = evolved ? '#1e1005' : '#06131a';
    ctx.strokeStyle = droneColor;
    ctx.lineWidth = evolved ? 2.8 : 2.2;
    ctx.beginPath();
    for (let v = 0; v < 6; v++) {
      const a = (v * Math.PI) / 3;
      const px = Math.cos(a) * hexR;
      const py = Math.sin(a) * hexR;
      if (v === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = droneColor;
    ctx.beginPath();
    ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private static drawPet(ctx: CanvasRenderingContext2D, pet: SnapshotPetTuple, now: number): void {
    const [x, y, branchCode, size] = pet;
    const r = Math.max(9, size * 0.5);
    const pulse = 1 + Math.sin(now * 0.01) * 0.06;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);

    if (branchCode === 1) {
      // BRUTE: acorazado carmesí octogonal
      ctx.fillStyle = '#4c0519';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fda4af';
      ctx.fillRect(-r * 0.42, -3, r * 0.3, 4);
      ctx.fillRect(r * 0.12, -3, r * 0.3, 4);
    } else if (branchCode === 2) {
      // VIRAL: enjambre esmeralda tóxico
      ctx.rotate(now * 0.004);
      ctx.fillStyle = '#064e3b';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const rad = i % 2 === 0 ? r * 1.08 : r * 0.74;
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#a7f3d0';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else if (branchCode === 3) {
      // PINBALL: disco cinético dorado-cian
      ctx.rotate(now * 0.015);
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, 0, Math.PI * 1.4);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // BASE: Morcillita ciber-mascota rosa neón
      ctx.fillStyle = '#3b0764';
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Orejas triangulares
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.moveTo(-r * 0.72, -r * 0.5);
      ctx.lineTo(-r * 0.92, -r * 1.2);
      ctx.lineTo(-r * 0.2, -r * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.72, -r * 0.5);
      ctx.lineTo(r * 0.92, -r * 1.2);
      ctx.lineTo(r * 0.2, -r * 0.85);
      ctx.closePath();
      ctx.fill();
      // Ojos brillantes
      ctx.fillStyle = '#fdf2f8';
      ctx.beginPath();
      ctx.arc(-r * 0.32, -1, 2.5, 0, Math.PI * 2);
      ctx.arc(r * 0.32, -1, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private static drawEnemy(ctx: CanvasRenderingContext2D, e: SnapshotEnemyTuple, now: number): void {
    const [typeCode, x, y, size, hp, maxHp, angle, flags] = e;
    const isElite = (flags & 1) !== 0;
    const isFrozen = (flags & 2) !== 0;
    const isFlashing = (flags & 4) !== 0;
    const isSpecialFlag = (flags & 8) !== 0;
    const isAltFlag = (flags & 16) !== 0;
    const half = size / 2;
    const isBoss = typeCode >= 8;

    ctx.save();
    if (typeCode === 10 && isAltFlag && !isFlashing) {
      // Rootkit Titan en camuflaje sigiloso
      ctx.globalAlpha = 0.24;
    }

    ctx.fillStyle = 'rgba(2, 6, 14, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + half * 0.72, half * 0.9, half * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(x, y);

    if (isElite) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, half * 1.25, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- 9: EL TORO BOSS ---
    if (typeCode === 9) {
      if (isSpecialFlag) {
        // Corredor de telegrafiado solo durante TELEGRAPH (flags bit 3)
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = 'rgba(255, 20, 50, 0.2)';
        ctx.fillRect(0, -half * 0.85, 620, half * 1.7);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.lineWidth = 2.6;
        ctx.setLineDash([14, 8]);
        ctx.strokeRect(0, -half * 0.85, 620, half * 1.7);
        ctx.setLineDash([]);
        ctx.restore();
      } else if (isAltFlag) {
        // Estela ígnea solo durante DASH (flags bit 4)
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = 'rgba(249, 115, 22, 0.28)';
        ctx.beginPath();
        ctx.ellipse(-half * 0.55, 0, half * 1.55, half * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      const bodyColor = isFlashing ? '#ffffff' : isAltFlag ? '#dc2626' : '#991b1b';
      ctx.fillStyle = bodyColor;
      ctx.strokeStyle = isAltFlag ? '#fbbf24' : '#f87171';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(half * 0.95, -half * 0.25);
      ctx.lineTo(half * 0.65, half);
      ctx.lineTo(-half * 0.65, half);
      ctx.lineTo(-half * 0.95, -half * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-half * 0.55, -half * 0.45);
      ctx.lineTo(-half * 1.25, -half * 0.95);
      ctx.moveTo(half * 0.55, -half * 0.45);
      ctx.lineTo(half * 1.25, -half * 0.95);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-half * 0.32, -half * 0.15, 7, 5);
      ctx.fillRect(half * 0.32 - 7, -half * 0.15, 7, 5);
      ctx.restore();
      return;
    }

    // --- 5: CRYPTO MINER ---
    if (typeCode === 5) {
      ctx.fillStyle = isFlashing ? '#ffffff' : isFrozen ? '#38bdf8' : '#f59e0b';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      const cut = 5;
      ctx.beginPath();
      ctx.moveTo(-half + cut, -half);
      ctx.lineTo(half - cut, -half);
      ctx.lineTo(half, -half + cut);
      ctx.lineTo(half, half - cut);
      ctx.lineTo(half - cut, half);
      ctx.lineTo(-half + cut, half);
      ctx.lineTo(-half, half - cut);
      ctx.lineTo(-half, -half + cut);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('₿', 0, 1);
      ctx.restore();
      return;
    }

    // --- 6: HARDWARE BOX ---
    if (typeCode === 6) {
      ctx.fillStyle = isFlashing ? '#ffffff' : '#334155';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.2;
      ctx.fillRect(-half, -half, size, size);
      ctx.strokeRect(-half, -half, size, size);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-half + 4, -half + 4);
      ctx.lineTo(half - 4, half - 4);
      ctx.moveTo(half - 4, -half + 4);
      ctx.lineTo(-half + 4, half - 4);
      ctx.stroke();
      ctx.fillStyle = '#10b981';
      ctx.fillRect(-2.2, -6, 4.4, 12);
      ctx.fillRect(-6, -2.2, 12, 4.4);
      ctx.restore();
      return;
    }

    const t = now * 0.01;

    // --- 1: WORM (Microchip morado con pines dorados) ---
    if (typeCode === 1) {
      const chipCol = isFlashing ? '#ffffff' : isFrozen ? '#38bdf8' : '#7c3aed';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.6;
      for (let i = -1; i <= 1; i++) {
        const p = i * half * 0.48;
        ctx.beginPath();
        ctx.moveTo(p, -half - 3.5);
        ctx.lineTo(p, half + 3.5);
        ctx.moveTo(-half - 3.5, p);
        ctx.lineTo(half + 3.5, p);
        ctx.stroke();
      }
      ctx.fillStyle = chipCol;
      ctx.strokeStyle = '#c4b5fd';
      ctx.lineWidth = 1.8;
      ctx.fillRect(-half * 0.82, -half * 0.82, size * 0.82, size * 0.82);
      ctx.strokeRect(-half * 0.82, -half * 0.82, size * 0.82, size * 0.82);
      if (!isFlashing) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-half * 0.45, -half * 0.45, size * 0.45, size * 0.45);
        ctx.fillStyle = isFrozen ? '#bae6fd' : '#34d399';
        ctx.fillRect(-half * 0.22, -half * 0.22, size * 0.22, size * 0.22);
      }
      ctx.restore();
    } else if (typeCode === 7) {
      // --- 7: TROJAN (Dardo amarillo afilado de alta velocidad) ---
      ctx.rotate(angle);
      const col = isFlashing ? '#ffffff' : isFrozen ? '#38bdf8' : '#eab308';
      ctx.fillStyle = col;
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#fef08a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(half * 1.35, 0);
      ctx.lineTo(-half * 0.55, -half * 0.92);
      ctx.lineTo(-half * 0.25, 0);
      ctx.lineTo(-half * 0.55, half * 0.92);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!isFlashing) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(half * 0.6, 0);
        ctx.lineTo(-half * 0.15, -half * 0.35);
        ctx.lineTo(-half * 0.15, half * 0.35);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (typeCode === 2) {
      // --- 2: ARMORED WORM (Chasis blindado + escudo frontal cian + núcleo rojo trasero) ---
      ctx.rotate(angle);
      const bodyCol = isFlashing ? '#ffffff' : isFrozen ? '#38bdf8' : '#0f766e';
      ctx.fillStyle = bodyCol;
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(half * 0.9, -half * 0.55);
      ctx.lineTo(half * 0.9, half * 0.55);
      ctx.lineTo(-half * 0.85, half * 0.85);
      ctx.lineTo(-half * 0.85, -half * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Núcleo vulnerable rojo en la retaguardia
      if (!isFlashing) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-half * 0.52, 0, half * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      // Escudo frontal de energía cian (140°)
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.arc(0, 0, half * 1.15, -Math.PI * 0.38, Math.PI * 0.38);
      ctx.stroke();
      ctx.restore();
    } else if (typeCode === 3) {
      // --- 3: TROJAN SHOOTER (Torreta naranja de cañones gemelos rotativa) ---
      ctx.rotate(angle);
      const col = isFlashing ? '#ffffff' : isFrozen ? '#38bdf8' : '#f97316';
      // Cañones gemelos frontales
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(half * 0.25, -half * 0.48, half * 0.95, 4);
      ctx.fillRect(half * 0.25, half * 0.48 - 4, half * 0.95, 4);
      // Cuerpo hexagonal naranja
      ctx.fillStyle = col;
      ctx.strokeStyle = '#fed7aa';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(half * 0.72, -half * 0.52);
      ctx.lineTo(half * 0.72, half * 0.52);
      ctx.lineTo(-half * 0.2, half * 0.92);
      ctx.lineTo(-half * 0.9, half * 0.45);
      ctx.lineTo(-half * 0.9, -half * 0.45);
      ctx.lineTo(-half * 0.2, -half * 0.92);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!isFlashing) {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, 0, half * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (typeCode === 4) {
      // --- 4: EVASOR (Caza fantasma cian con alas en flecha) ---
      ctx.rotate(angle);
      const col = isFlashing ? '#ffffff' : isFrozen ? '#7dd3fc' : '#06b6d4';
      ctx.fillStyle = col;
      ctx.strokeStyle = '#cffafe';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(half * 1.2, 0);
      ctx.lineTo(half * 0.1, -half * 1.05);
      ctx.lineTo(-half * 0.9, -half * 0.45);
      ctx.lineTo(-half * 0.4, 0);
      ctx.lineTo(-half * 0.9, half * 0.45);
      ctx.lineTo(half * 0.1, half * 1.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!isFlashing) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(half * 0.18, 0, half * 0.36, half * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (typeCode === 8) {
      // --- 8: RANSOMWARE BOSS (Fortaleza encriptadora carmesí con candado) ---
      const col = isFlashing ? '#ffffff' : isFrozen ? '#38bdf8' : '#b91c1c';
      ctx.fillStyle = col;
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 6;
        const px = Math.cos(a) * half;
        const py = Math.sin(a) * half;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!isFlashing) {
        // Candado central dorado
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -half * 0.16, half * 0.24, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-half * 0.3, -half * 0.14, half * 0.6, half * 0.48);
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(0, half * 0.08, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (typeCode === 10) {
      // --- 10: ROOTKIT TITAN BOSS (Diamante táctico violeta sigiloso) ---
      ctx.rotate(now * 0.0018);
      const col = isFlashing ? '#ffffff' : isFrozen ? '#38bdf8' : '#6d28d9';
      ctx.fillStyle = col;
      ctx.strokeStyle = '#d8b4fe';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -half * 1.15);
      ctx.lineTo(half * 0.95, 0);
      ctx.lineTo(0, half * 1.15);
      ctx.lineTo(-half * 0.95, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!isFlashing) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, half * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(0, 0, half * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (typeCode === 11) {
      // --- 11: TROJAN OVERLORD BOSS (Acorazado naranja artillado) ---
      ctx.rotate(angle);
      const col = isFlashing ? '#ffffff' : isFrozen ? '#38bdf8' : '#ea580c';
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(half * 0.3, -half * 0.68, half * 0.95, 7);
      ctx.fillRect(half * 0.3, half * 0.68 - 7, half * 0.95, 7);
      ctx.fillStyle = col;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(half * 1.05, 0);
      ctx.lineTo(half * 0.25, -half * 0.95);
      ctx.lineTo(-half * 0.95, -half * 0.68);
      ctx.lineTo(-half * 0.72, 0);
      ctx.lineTo(-half * 0.95, half * 0.68);
      ctx.lineTo(half * 0.25, half * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!isFlashing) {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(half * 0.1, 0, half * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (typeCode === 12) {
      // --- 12: WORM PRIME BOSS (Coloso esmeralda segmentado) ---
      ctx.rotate(angle);
      const col = isFlashing ? '#ffffff' : isFrozen ? '#38bdf8' : '#059669';
      // Anillos traseros segmentados
      ctx.fillStyle = isFlashing ? '#ffffff' : '#047857';
      ctx.strokeStyle = '#6ee7b7';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(-half * 0.65, 0, half * 0.56, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (!isFlashing) {
        ctx.fillStyle = '#a7f3d0';
        ctx.fillRect(half * 0.22, -half * 0.32, 7, 5);
        ctx.fillRect(half * 0.22, half * 0.32 - 5, 7, 5);
      }
      ctx.restore();
    } else if (typeCode === 13) {
      // --- 13: SPYWARE SPECTER BOSS (Ojo holográfico cian-glitch) ---
      const col = isFlashing ? '#ffffff' : '#0891b2';
      ctx.fillStyle = col;
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, -half * 0.72);
      ctx.quadraticCurveTo(half * 1.15, 0, 0, half * 0.72);
      ctx.quadraticCurveTo(-half * 1.15, 0, 0, -half * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!isFlashing) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, half * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * 4, Math.sin(angle) * 4, half * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      // --- 0: ADWARE (Araña mecánica roja clásica con 6 patas) ---
      ctx.rotate(angle);
      const baseColor = isFlashing ? '#ffffff' : isFrozen ? '#38bdf8' : '#ff1e42';
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        const lx = i * half * 0.45;
        const w = Math.sin(t + i * 2) * 2.2;
        ctx.moveTo(lx, -half * 0.55);
        ctx.lineTo(lx - 3 + w, -half - 4);
        ctx.moveTo(lx, half * 0.55);
        ctx.lineTo(lx - 3 - w, half + 4);
      }
      ctx.stroke();

      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.moveTo(half + 4, 0);
      ctx.lineTo(half * 0.25, -half * 0.85);
      ctx.lineTo(-half * 0.85, -half * 0.65);
      ctx.lineTo(-half * 0.45, 0);
      ctx.lineTo(-half * 0.85, half * 0.65);
      ctx.lineTo(half * 0.25, half * 0.85);
      ctx.closePath();
      ctx.fill();

      if (!isFlashing) {
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.moveTo(half * 0.65, 0);
        ctx.lineTo(-half * 0.1, -half * 0.44);
        ctx.lineTo(-half * 0.4, 0);
        ctx.lineTo(-half * 0.1, half * 0.44);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = isFrozen ? '#bae6fd' : '#fef08a';
        ctx.fillRect(half * 0.16, -half * 0.26, 3.2, 2.6);
        ctx.fillRect(half * 0.16, half * 0.26 - 2.6, 3.2, 2.6);
      }
      ctx.restore();
    }

    // Barra de vida sobre élites y jefes
    if ((isElite || isBoss) && maxHp > 0 && hp < maxHp) {
      const bw = Math.max(34, size * 1.05);
      const ratio = Math.max(0, Math.min(1, hp / maxHp));
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      ctx.fillRect(x - bw / 2, y - half - 14, bw, 5);
      ctx.fillStyle = isBoss ? '#f43f5e' : '#38bdf8';
      ctx.fillRect(x - bw / 2, y - half - 14, bw * ratio, 5);
    }
  }

  private static drawProjectile(ctx: CanvasRenderingContext2D, p: SnapshotProjTuple, now: number): void {
    const [kind, x, y, vx, vy, evolved, size] = p;
    const angle = Math.atan2(vy, vx);
    ctx.save();
    ctx.translate(x, y);

    if (kind === 4) {
      // SawDisc
      ctx.rotate(now * 0.018);
      const r = (size || 24) * 0.58;
      ctx.fillStyle = evolved ? '#fef08a' : '#e2e8f0';
      ctx.strokeStyle = evolved ? '#f59e0b' : '#f97316';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      const teeth = 10;
      for (let i = 0; i < teeth; i++) {
        const a0 = (i * Math.PI * 2) / teeth;
        const aTip = a0 + 0.24;
        const aRoot = ((i + 1) * Math.PI * 2) / teeth;
        if (i === 0) ctx.moveTo(Math.cos(a0) * r * 0.68, Math.sin(a0) * r * 0.68);
        else ctx.lineTo(Math.cos(a0) * r * 0.68, Math.sin(a0) * r * 0.68);
        ctx.lineTo(Math.cos(aTip) * r * 1.06, Math.sin(aTip) * r * 1.06);
        ctx.lineTo(Math.cos(aRoot) * r * 0.68, Math.sin(aRoot) * r * 0.68);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = evolved ? '#fbbf24' : '#fb923c';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.rotate(angle);

    if (kind === 6) {
      // PetShrapnel (fragmento viral de Morcillita)
      ctx.fillStyle = '#34d399';
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-3, -4.5);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-3, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (kind === 5) {
      // EnemyProjectile
      ctx.fillStyle = '#fb7185';
      ctx.strokeStyle = '#ffe4e6';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-7, -5);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-7, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (kind === 3) {
      // SqlInjectionBeam
      const halfL = evolved ? 56 : 42;
      const halfT = evolved ? 9 : 7;
      ctx.fillStyle = evolved ? 'rgba(251, 191, 36, 0.32)' : 'rgba(217, 70, 239, 0.28)';
      ctx.beginPath();
      ctx.ellipse(-4, 0, halfL + 14, halfT + 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = evolved ? '#f43f5e' : '#a855f7';
      ctx.strokeStyle = evolved ? '#fef08a' : '#f5d0fe';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(halfL + 10, 0);
      ctx.lineTo(halfL * 0.35, -halfT);
      ctx.lineTo(-halfL, -halfT * 0.7);
      ctx.lineTo(-halfL * 0.65, 0);
      ctx.lineTo(-halfL, halfT * 0.7);
      ctx.lineTo(halfL * 0.35, halfT);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Projectile / Ping / Cryo (estilo lanza "pro")
    const len = evolved ? 24 : 18;
    const rad = evolved ? 8.2 : 6.2;
    const color =
      kind === 2
        ? '#38bdf8'
        : kind === 1
        ? evolved
          ? '#fde047'
          : '#0284c7'
        : evolved
        ? '#fde047'
        : '#22d3ee';

    ctx.fillStyle = evolved ? 'rgba(250, 204, 21, 0.26)' : 'rgba(0, 240, 255, 0.24)';
    ctx.beginPath();
    ctx.ellipse(-3, 0, len * 0.95, rad * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(len * 0.95, 0);
    ctx.lineTo(-len * 0.2, -rad * 0.9);
    ctx.lineTo(-len * 0.85, -rad * 0.45);
    ctx.lineTo(-len * 0.55, 0);
    ctx.lineTo(-len * 0.85, rad * 0.45);
    ctx.lineTo(-len * 0.2, rad * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(len * 0.68, 0);
    ctx.lineTo(-len * 0.12, -rad * 0.4);
    ctx.lineTo(-len * 0.48, 0);
    ctx.lineTo(-len * 0.12, rad * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
