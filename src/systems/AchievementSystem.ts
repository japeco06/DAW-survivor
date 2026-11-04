/**
 * Sistema de Logros e Hitos del Kernel (v1.0.0).
 * Registra objetivos desbloqueables durante la partida o el progreso global,
 * otorga recompensas en Criptomonedas y muestra notificaciones toast animadas.
 */

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rewardCoins: number;
  target: number;
  current: number;
  unlocked: boolean;
  unlockedAt?: number;
}

export interface AchievementToast {
  id: string;
  title: string;
  rewardCoins: number;
  icon: string;
  timer: number;
  maxDuration: number;
}

const ACHIEVEMENTS_STORAGE_KEY = 'cyber_survivor_achievements_v1';

export class AchievementSystem {
  public achievements: Achievement[] = [];
  public activeToasts: AchievementToast[] = [];
  public onUnlockCallback: ((achievement: Achievement) => void) | null = null;

  constructor() {
    this.initAchievements();
    this.loadState();
  }

  private initAchievements(): void {
    this.achievements = [
      {
        id: 'first_patch',
        title: 'PRIMER PARCHE',
        description: 'Elimina a 50 malwares en combate.',
        icon: '🛡️',
        rewardCoins: 20,
        target: 50,
        current: 0,
        unlocked: false,
      },
      {
        id: 'mass_purge',
        title: 'PURGA MASIVA',
        description: 'Elimina a 500 malwares en total.',
        icon: '💥',
        rewardCoins: 50,
        target: 500,
        current: 0,
        unlocked: false,
      },
      {
        id: 'hardware_collector',
        title: 'DESEMPAQUETADOR',
        description: 'Destruye 10 Cajas de Hardware en el mapa.',
        icon: '📦',
        rewardCoins: 25,
        target: 10,
        current: 0,
        unlocked: false,
      },
      {
        id: 'crypto_miner_slayer',
        title: 'CRIPTO-CAZADOR',
        description: 'Caza y destruye a un Minero de Criptos antes de que escape.',
        icon: '💰',
        rewardCoins: 35,
        target: 1,
        current: 0,
        unlocked: false,
      },
      {
        id: 'first_boss_killed',
        title: 'ANTI-RANSOMWARE',
        description: 'Derrota a tu primer Mega-Jefe recogiendo las 5 llaves.',
        icon: '🔑',
        rewardCoins: 40,
        target: 1,
        current: 0,
        unlocked: false,
      },
      {
        id: 'all_four_bosses',
        title: 'CUATRO JINETES',
        description: 'Derrota a los 4 Mega-Jefes únicos en una misma partida.',
        icon: '👑',
        rewardCoins: 100,
        target: 4,
        current: 0,
        unlocked: false,
      },
      {
        id: 'toro_arrival',
        title: 'ALERTA ROJA: EL TORO',
        description: 'Despierta al Jefe Final Invencible "El Toro".',
        icon: '🐂',
        rewardCoins: 50,
        target: 1,
        current: 0,
        unlocked: false,
      },
      {
        id: 'toro_damage_10k',
        title: 'TOREADOR DIGITAL',
        description: 'Inflige más de 10.000 de daño al Toro en una partida.',
        icon: '⚔️',
        rewardCoins: 75,
        target: 10000,
        current: 0,
        unlocked: false,
      },
      {
        id: 'toro_damage_50k',
        title: 'MATADOR DEL KERNEL',
        description: 'Inflige más de 50.000 de daño al Toro en una partida.',
        icon: '🏆',
        rewardCoins: 150,
        target: 50000,
        current: 0,
        unlocked: false,
      },
      {
        id: 'survivor_3min',
        title: 'TIEMPO DE ACTIVIDAD',
        description: 'Sobrevive al menos 3 minutos (03:00) en una partida.',
        icon: '⏱️',
        rewardCoins: 30,
        target: 180,
        current: 0,
        unlocked: false,
      },
      {
        id: 'survivor_6min',
        title: 'SERVIDOR RESILIENTE',
        description: 'Sobrevive al menos 6 minutos (06:00) en una partida.',
        icon: '⚡',
        rewardCoins: 80,
        target: 360,
        current: 0,
        unlocked: false,
      },
      {
        id: 'level_20',
        title: 'KERNEL OVERCLOCK',
        description: 'Alcanza el Nivel 20 en una sola partida.',
        icon: '🚀',
        rewardCoins: 50,
        target: 20,
        current: 0,
        unlocked: false,
      },
    ];
  }

  public loadState(): void {
    try {
      const saved = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<
          string,
          { unlocked: boolean; current: number; unlockedAt?: number }
        >;
        for (const ach of this.achievements) {
          if (parsed[ach.id]) {
            ach.unlocked = parsed[ach.id].unlocked;
            ach.current = Math.max(ach.current, parsed[ach.id].current || 0);
            ach.unlockedAt = parsed[ach.id].unlockedAt;
          }
        }
      }
    } catch {
      // Ignorar errores
    }
  }

  public saveState(): void {
    try {
      const data: Record<string, { unlocked: boolean; current: number; unlockedAt?: number }> = {};
      for (const ach of this.achievements) {
        data[ach.id] = {
          unlocked: ach.unlocked,
          current: ach.current,
          unlockedAt: ach.unlockedAt,
        };
      }
      localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignorar errores
    }
  }

  public getUnlockedIds(): string[] {
    return this.achievements.filter((a) => a.unlocked).map((a) => a.id);
  }

  public applyCloudUnlockedIds(ids: string[]): void {
    let changed = false;
    const idSet = new Set(ids);
    for (const ach of this.achievements) {
      if (idSet.has(ach.id) && !ach.unlocked) {
        ach.unlocked = true;
        ach.current = ach.target;
        ach.unlockedAt = Date.now();
        changed = true;
      }
    }
    if (changed) {
      this.saveState();
    }
  }

  public reportProgress(id: string, value: number, isAbsolute: boolean = false): void {
    const ach = this.achievements.find((a) => a.id === id);
    if (!ach || ach.unlocked) return;

    if (isAbsolute) {
      ach.current = Math.max(ach.current, value);
    } else {
      ach.current += value;
    }

    if (ach.current >= ach.target) {
      ach.current = ach.target;
      ach.unlocked = true;
      ach.unlockedAt = Date.now();
      this.saveState();

      // Encolar toast
      this.activeToasts.push({
        id: ach.id,
        title: ach.title,
        rewardCoins: ach.rewardCoins,
        icon: ach.icon,
        timer: 4.2,
        maxDuration: 4.2,
      });

      if (this.onUnlockCallback) {
        this.onUnlockCallback(ach);
      }
    } else {
      this.saveState();
    }
  }

  public updateToasts(dt: number): void {
    for (const toast of this.activeToasts) {
      toast.timer -= dt;
    }
    this.activeToasts = this.activeToasts.filter((t) => t.timer > 0);
  }

  public drawToasts(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
    if (this.activeToasts.length === 0) return;

    ctx.save();
    let currentY = 24;

    for (const toast of this.activeToasts) {
      const toastW = 440;
      const toastH = 64;
      const toastX = (canvasWidth - toastW) / 2;

      // Animación suave de entrada y salida
      const progress = toast.timer / toast.maxDuration;
      let alpha = 1.0;
      if (toast.timer < 0.5) {
        alpha = toast.timer / 0.5;
      } else if (toast.timer > toast.maxDuration - 0.4) {
        alpha = (toast.maxDuration - toast.timer) / 0.4;
      }

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      // Fondo cibernético
      ctx.fillStyle = 'rgba(4, 18, 12, 0.95)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 14;

      ctx.fillRect(toastX, currentY, toastW, toastH);
      ctx.strokeRect(toastX, currentY, toastW, toastH);

      // Icono
      ctx.shadowBlur = 0;
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(toast.icon, toastX + 16, currentY + toastH / 2);

      // Texto de Hito
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillText('¡HITO DEL KERNEL DESBLOQUEADO!', toastX + 60, currentY + 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillText(toast.title, toastX + 60, currentY + 44);

      // Recompensa en monedas a la derecha
      ctx.textAlign = 'right';
      ctx.fillStyle = '#00ff66';
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillText(`+${toast.rewardCoins} 🪙`, toastX + toastW - 16, currentY + toastH / 2);

      currentY += toastH + 12;
    }

    ctx.restore();
  }

  public getUnlockedCount(): number {
    return this.achievements.filter((a) => a.unlocked).length;
  }
}
