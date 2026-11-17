import { Player } from '../entities/Player';
import { Adware, MalwareType } from '../entities/Adware';
import { i18n } from '../utils/i18n';
import type {
  CoopWorldSnapshot,
  SnapshotEnemyTuple,
  SnapshotPickupTuple,
  SnapshotPlayer,
  SnapshotProjTuple,
  SnapshotZoneTuple,
} from './MultiplayerTypes';

export const ENEMY_CODE_MAP: Record<MalwareType, number> = {
  ADWARE: 0,
  WORM: 1,
  TROJAN: 1,
  ARMORED_WORM: 2,
  TROJAN_SHOOTER: 3,
  EVASOR: 4,
  CRYPTO_MINER: 5,
  HARDWARE_BOX: 6,
  RANSOMWARE: 7,
  FINAL_BOSS: 9,
};

export function encodeEnemyType(enemy: Adware): number {
  if (enemy.malwareType === 'RANSOMWARE') {
    return enemy.constructor.name === 'RansomwareBoss' ? 8 : 7;
  }
  return ENEMY_CODE_MAP[enemy.malwareType] ?? 0;
}

/**
 * Renderizador ligero para clientes Invitados (Guests) y capas Co-op compartidas.
 * Reutiliza la estética cyber-mecha de Player.drawCyberChassis y los disparos "pro".
 */
export class CoopRenderer {
  public static drawWorld(
    ctx: CanvasRenderingContext2D,
    snap: CoopWorldSnapshot,
    myId: string,
    overrideLocalPos?: { x: number; y: number }
  ): void {
    const now = performance.now();

    // 1. Zonas de Cuarentena y Eventos de Terreno
    for (const z of snap.zones) {
      this.drawZone(ctx, z, now);
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

    // 4. Enemigos y Jefes
    for (const e of snap.enemies) {
      this.drawEnemy(ctx, e, now);
    }

    // 5. Proyectiles "Pro" aliados y enemigos
    for (const proj of snap.projectiles) {
      this.drawProjectile(ctx, proj, now);
    }

    // 6. Todos los jugadores del escuadrón (hasta 4)
    for (const pl of snap.players) {
      const pos = pl.id === myId && overrideLocalPos ? overrideLocalPos : { x: pl.x, y: pl.y };
      this.drawTeammate(ctx, pl, pos.x, pos.y, pl.id === myId, now);
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

  private static drawEnemy(ctx: CanvasRenderingContext2D, e: SnapshotEnemyTuple, now: number): void {
    const [typeCode, x, y, size, hp, maxHp, angle, flags] = e;
    const isElite = (flags & 1) !== 0;
    const isFrozen = (flags & 2) !== 0;
    const isFlashing = (flags & 4) !== 0;
    const half = size / 2;

    ctx.save();
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

    if (typeCode === 9) {
      // EL TORO BOSS
      const bodyColor = isFlashing ? '#ffffff' : '#991b1b';
      ctx.fillStyle = bodyColor;
      ctx.strokeStyle = '#f87171';
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

      // Cuernos cibernéticos dorados
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

    if (typeCode === 5) {
      // CRYPTO MINER
      ctx.fillStyle = isFlashing ? '#ffffff' : '#f59e0b';
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

    if (typeCode === 6) {
      // HARDWARE BOX
      ctx.fillStyle = isFlashing ? '#ffffff' : '#475569';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.fillRect(-half, -half, size, size);
      ctx.strokeRect(-half, -half, size, size);
      ctx.restore();
      return;
    }

    ctx.rotate(angle);
    const t = now * 0.01;
    const baseColor = isFlashing
      ? '#ffffff'
      : isFrozen
      ? '#38bdf8'
      : typeCode === 1
      ? '#8b5cf6'
      : typeCode === 2
      ? '#14b8a6'
      : typeCode === 3
      ? '#f97316'
      : typeCode === 4
      ? '#22d3ee'
      : typeCode >= 7
      ? '#dc2626'
      : '#ff1e42';

    // Patas o alerones cyber
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = typeCode >= 7 ? 2.6 : 1.8;
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

    // Barra de vida sobre élites y jefes
    if ((isElite || typeCode >= 7) && maxHp > 0 && hp < maxHp) {
      const bw = Math.max(34, size * 1.05);
      const ratio = Math.max(0, Math.min(1, hp / maxHp));
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      ctx.fillRect(x - bw / 2, y - half - 14, bw, 5);
      ctx.fillStyle = typeCode >= 7 ? '#f43f5e' : '#38bdf8';
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
