/**
 * Sistema de Misiones Diarias rotatorias (3 objetivos diarios por fecha local).
 * Persiste progreso diario en localStorage con guardado diferido sin bloquear FPS
 * y otorga CryptoCoins automáticamente al completarse.
 */
import { i18n } from '../utils/i18n';

export type DailyMissionMetric =
  | 'KILLS'
  | 'BOSSES'
  | 'SURVIVAL_SEC'
  | 'COINS'
  | 'EVOLUTION'
  | 'NIGHTMARE_KILLS'
  | 'LEVEL';

export interface DailyMission {
  id: string;
  metric: DailyMissionMetric;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  target: number;
  current: number;
  rewardCoins: number;
  completed: boolean;
  isCumulative: boolean;
}

export interface DailyMissionToast {
  title: string;
  titleEn: string;
  rewardCoins: number;
  timer: number;
  maxDuration: number;
}

interface MissionTemplate {
  id: string;
  metric: DailyMissionMetric;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  target: number;
  rewardCoins: number;
  isCumulative: boolean;
}

const DAILY_STORAGE_KEY = 'daw_survivor_daily_missions_v1';

const MISSION_POOL: MissionTemplate[] = [
  {
    id: 'daily_kills_180',
    metric: 'KILLS',
    title: 'PURGA DIARIA',
    titleEn: 'DAILY PURGE',
    description: 'Elimina 180 unidades de malware en cualquier modo.',
    descriptionEn: 'Eliminate 180 malware units in any mode.',
    target: 180,
    rewardCoins: 25,
    isCumulative: true,
  },
  {
    id: 'daily_survive_240',
    metric: 'SURVIVAL_SEC',
    title: 'KERNEL RESISTENTE',
    titleEn: 'RESILIENT KERNEL',
    description: 'Sobrevive 04:00 min (240 s) en una partida.',
    descriptionEn: 'Survive 04:00 min (240 s) in a single run.',
    target: 240,
    rewardCoins: 30,
    isCumulative: false,
  },
  {
    id: 'daily_boss_2',
    metric: 'BOSSES',
    title: 'CAZA-JEFES DEL DÍA',
    titleEn: 'BOSS HUNTER',
    description: 'Derrota a 2 Jefes de Oleada hoy.',
    descriptionEn: 'Defeat 2 Wave Bosses today.',
    target: 2,
    rewardCoins: 35,
    isCumulative: true,
  },
  {
    id: 'daily_coins_25',
    metric: 'COINS',
    title: 'MINERÍA ACTIVA',
    titleEn: 'ACTIVE MINING',
    description: 'Recoge 25 CryptoCoins durante tus partidas de hoy.',
    descriptionEn: 'Collect 25 CryptoCoins across runs today.',
    target: 25,
    rewardCoins: 25,
    isCumulative: true,
  },
  {
    id: 'daily_evo_1',
    metric: 'EVOLUTION',
    title: 'ARMA DEFINITIVA',
    titleEn: 'ULTIMATE WEAPON',
    description: 'Completa 1 Evolución de Arma en partida.',
    descriptionEn: 'Trigger 1 Weapon Evolution in a run.',
    target: 1,
    rewardCoins: 45,
    isCumulative: true,
  },
  {
    id: 'daily_nightmare_90',
    metric: 'NIGHTMARE_KILLS',
    title: 'INCURSIÓN PESADILLA',
    titleEn: 'NIGHTMARE RAID',
    description: 'Elimina 90 enemigos en Modo Pesadilla hoy.',
    descriptionEn: 'Eliminate 90 hostiles in Nightmare Mode today.',
    target: 90,
    rewardCoins: 50,
    isCumulative: true,
  },
  {
    id: 'daily_level_12',
    metric: 'LEVEL',
    title: 'OVERCLOCK NIVEL 12',
    titleEn: 'LEVEL 12 OVERCLOCK',
    description: 'Alcanza el Nivel 12 en una partida.',
    descriptionEn: 'Reach Level 12 in a single run.',
    target: 12,
    rewardCoins: 30,
    isCumulative: false,
  },
];

export class DailyMissionSystem {
  public dateKey: string = '';
  public missions: DailyMission[] = [];
  public activeToasts: DailyMissionToast[] = [];
  public onCompleteCallback: ((mission: DailyMission) => void) | null = null;
  private dirty: boolean = false;
  private lastSaveTime: number = 0;

  constructor() {
    this.ensureTodayMissions();
  }

  public static getTodayKey(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private hashDateSeed(dateStr: string): number {
    let h = 2166136261;
    for (let i = 0; i < dateStr.length; i++) {
      h ^= dateStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private pickDailyTemplates(dateStr: string): MissionTemplate[] {
    let seed = this.hashDateSeed(dateStr);
    const pool = [...MISSION_POOL];
    for (let i = pool.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, 3);
  }

  public ensureTodayMissions(): void {
    const today = DailyMissionSystem.getTodayKey();
    if (this.dateKey === today && this.missions.length === 3) {
      return;
    }

    this.dateKey = today;
    const templates = this.pickDailyTemplates(today);
    this.missions = templates.map((tpl) => ({
      ...tpl,
      current: 0,
      completed: false,
    }));

    try {
      const raw =
        localStorage.getItem(DAILY_STORAGE_KEY) ||
        localStorage.getItem('cyber_survivor_daily_missions_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as {
          dateKey?: string;
          states?: Record<string, { current: number; completed: boolean }>;
        };
        if (parsed.dateKey === today && parsed.states) {
          for (const mission of this.missions) {
            const st = parsed.states[mission.id];
            if (st) {
              mission.current = Math.min(mission.target, Math.max(0, st.current || 0));
              mission.completed = Boolean(st.completed);
            }
          }
          this.dirty = false;
          this.lastSaveTime = performance.now();
          return;
        }
      }
    } catch {
      // Ignorar errores de almacenamiento
    }

    this.saveState();
  }

  public saveState(): void {
    try {
      const states: Record<string, { current: number; completed: boolean }> = {};
      for (const m of this.missions) {
        states[m.id] = { current: m.current, completed: m.completed };
      }
      localStorage.setItem(
        DAILY_STORAGE_KEY,
        JSON.stringify({ dateKey: this.dateKey, states })
      );
      this.dirty = false;
      this.lastSaveTime = performance.now();
    } catch {
      // Ignorar errores
    }
  }

  public flushPendingSave(force: boolean = false): void {
    if (!this.dirty) return;
    if (force || performance.now() - this.lastSaveTime >= 4000) {
      this.saveState();
    }
  }

  public reportProgress(metric: DailyMissionMetric, value: number): void {
    if (value <= 0) return;
    this.ensureTodayMissions();

    for (const mission of this.missions) {
      if (mission.completed || mission.metric !== metric) continue;

      const prev = mission.current;
      if (mission.isCumulative) {
        mission.current = Math.min(mission.target, mission.current + value);
      } else {
        if (value <= prev) continue;
        mission.current = Math.min(mission.target, value);
      }

      if (mission.current >= mission.target) {
        mission.current = mission.target;
        mission.completed = true;
        this.saveState();
        this.activeToasts.push({
          title: mission.title,
          titleEn: mission.titleEn,
          rewardCoins: mission.rewardCoins,
          timer: 4.5,
          maxDuration: 4.5,
        });
        if (this.onCompleteCallback) {
          this.onCompleteCallback(mission);
        }
      } else if (mission.current > prev) {
        this.dirty = true;
      }
    }
  }

  public getCompletedCount(): number {
    this.ensureTodayMissions();
    return this.missions.filter((m) => m.completed).length;
  }

  public getTimeUntilResetText(): string {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diffSec = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
    const hh = String(Math.floor(diffSec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
    const ss = String(diffSec % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  public updateToasts(dt: number): void {
    for (const toast of this.activeToasts) {
      toast.timer -= dt;
    }
    this.activeToasts = this.activeToasts.filter((t) => t.timer > 0);
  }

  public drawToasts(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number = 1080,
    bottomOffsetY: number = 0
  ): void {
    if (this.activeToasts.length === 0) return;
    const toast = this.activeToasts[0];
    const w = 408;
    const h = 62;
    const x = canvasWidth - w - 18;
    const y = canvasHeight - 40 - bottomOffsetY - h;

    const alpha = Math.min(1, toast.timer * 2.5, (toast.maxDuration - toast.timer) * 4 + 0.2);

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x, y + 6, 4, h - 12);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
    ctx.fillText(
      i18n.t(
        `★ MISIÓN DIARIA COMPLETADA (+${toast.rewardCoins} CR)`,
        `★ DAILY MISSION COMPLETED (+${toast.rewardCoins} CR)`
      ),
      x + 16,
      y + 23
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(
      i18n.currentLang === 'EN' ? toast.titleEn : toast.title,
      x + 16,
      y + 46,
      w - 30
    );
    ctx.restore();
  }
}
