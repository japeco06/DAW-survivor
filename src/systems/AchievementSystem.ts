/**
 * Sistema de Logros e Hitos del Kernel (v1.1.2).
 * Registra objetivos desbloqueables durante la partida o el progreso global,
 * soporta 2 páginas de hitos (Fase I y Fase II Épica con altas recompensas),
 * textos bilingües (ES / EN) y notificaciones toast animadas.
 */

import { i18n } from '../utils/i18n';

export interface Achievement {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
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
  titleEn: string;
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
      // ==========================================
      // PÁGINA 1: FASE I // PROTOCOLOS (1 - 12)
      // ==========================================
      {
        id: 'first_patch',
        title: 'PRIMER PARCHE',
        titleEn: 'FIRST PATCH',
        description: 'Elimina a 50 malwares.',
        descriptionEn: 'Eliminate 50 malware units.',
        icon: '🛡️',
        rewardCoins: 20,
        target: 50,
        current: 0,
        unlocked: false,
      },
      {
        id: 'mass_purge',
        title: 'PURGA MASIVA',
        titleEn: 'MASS PURGE',
        description: 'Elimina a 500 malwares.',
        descriptionEn: 'Eliminate 500 malware units.',
        icon: '💥',
        rewardCoins: 50,
        target: 500,
        current: 0,
        unlocked: false,
      },
      {
        id: 'hardware_collector',
        title: 'DESEMPAQUETADOR',
        titleEn: 'UNPACKER',
        description: 'Destruye 10 Cajas de Hardware.',
        descriptionEn: 'Destroy 10 Hardware Crates.',
        icon: '📦',
        rewardCoins: 25,
        target: 10,
        current: 0,
        unlocked: false,
      },
      {
        id: 'crypto_miner_slayer',
        title: 'CRIPTO-CAZADOR',
        titleEn: 'CRYPTO HUNTER',
        description: 'Destruye a un Minero de Criptos.',
        descriptionEn: 'Destroy a Crypto Miner unit.',
        icon: '💰',
        rewardCoins: 35,
        target: 1,
        current: 0,
        unlocked: false,
      },
      {
        id: 'first_boss_killed',
        title: 'ANTI-RANSOMWARE',
        titleEn: 'ANTI-RANSOMWARE',
        description: 'Derrota a tu primer Mega-Jefe.',
        descriptionEn: 'Defeat your first Mega-Boss.',
        icon: '🔑',
        rewardCoins: 40,
        target: 1,
        current: 0,
        unlocked: false,
      },
      {
        id: 'all_four_bosses',
        title: 'CUATRO JINETES',
        titleEn: 'FOUR HORSEMEN',
        description: 'Derrota a los 4 Mega-Jefes.',
        descriptionEn: 'Defeat all 4 Mega-Bosses.',
        icon: '👑',
        rewardCoins: 100,
        target: 4,
        current: 0,
        unlocked: false,
      },
      {
        id: 'toro_arrival',
        title: 'ALERTA ROJA: EL TORO',
        titleEn: 'RED ALERT: EL TORO',
        description: 'Despierta al Jefe Final "El Toro".',
        descriptionEn: 'Awaken Final Boss "El Toro".',
        icon: '🐂',
        rewardCoins: 50,
        target: 1,
        current: 0,
        unlocked: false,
      },
      {
        id: 'toro_damage_10k',
        title: 'TOREADOR DIGITAL',
        titleEn: 'DIGITAL MATADOR',
        description: 'Inflige 10.000 de daño al Toro.',
        descriptionEn: 'Deal 10,000 damage to El Toro.',
        icon: '⚔️',
        rewardCoins: 75,
        target: 10000,
        current: 0,
        unlocked: false,
      },
      {
        id: 'toro_damage_50k',
        title: 'MATADOR DEL KERNEL',
        titleEn: 'KERNEL MATADOR',
        description: 'Inflige 50.000 de daño al Toro.',
        descriptionEn: 'Deal 50,000 damage to El Toro.',
        icon: '🏆',
        rewardCoins: 150,
        target: 50000,
        current: 0,
        unlocked: false,
      },
      {
        id: 'survivor_3min',
        title: 'TIEMPO DE ACTIVIDAD',
        titleEn: 'UPTIME',
        description: 'Sobrevive 3 minutos (03:00).',
        descriptionEn: 'Survive 3 minutes (03:00).',
        icon: '⏱️',
        rewardCoins: 30,
        target: 180,
        current: 0,
        unlocked: false,
      },
      {
        id: 'survivor_6min',
        title: 'SERVIDOR RESILIENTE',
        titleEn: 'RESILIENT SERVER',
        description: 'Sobrevive 6 minutos (06:00).',
        descriptionEn: 'Survive 6 minutes (06:00).',
        icon: '⚡',
        rewardCoins: 80,
        target: 360,
        current: 0,
        unlocked: false,
      },
      {
        id: 'level_20',
        title: 'KERNEL OVERCLOCK',
        titleEn: 'KERNEL OVERCLOCK',
        description: 'Alcanza el Nivel 20 en partida.',
        descriptionEn: 'Reach Level 20 in a run.',
        icon: '🚀',
        rewardCoins: 50,
        target: 20,
        current: 0,
        unlocked: false,
      },

      // ==============================================================
      // PÁGINA 2: FASE II // DESAFÍOS ÉPICOS (13 - 24) [ALTA RECOMPENSA]
      // ==============================================================
      {
        id: 'mass_purge_elite',
        title: 'PURGA EXTREMA',
        titleEn: 'EXTREME PURGE',
        description: 'Elimina a 1.200 malwares en partida.',
        descriptionEn: 'Eliminate 1,200 malware in a run.',
        icon: '⚡',
        rewardCoins: 200,
        target: 1200,
        current: 0,
        unlocked: false,
      },
      {
        id: 'survivor_10min',
        title: 'INMORTAL DEL KERNEL',
        titleEn: 'KERNEL IMMORTAL',
        description: 'Sobrevive 10 minutos (10:00).',
        descriptionEn: 'Survive 10 minutes (10:00).',
        icon: '⏳',
        rewardCoins: 250,
        target: 600,
        current: 0,
        unlocked: false,
      },
      {
        id: 'survivor_15min',
        title: 'DIOS DEL CIBERESPACIO',
        titleEn: 'CYBERSPACE GOD',
        description: 'Sobrevive 15 minutos (15:00).',
        descriptionEn: 'Survive 15 minutes (15:00).',
        icon: '🌌',
        rewardCoins: 500,
        target: 900,
        current: 0,
        unlocked: false,
      },
      {
        id: 'level_30',
        title: 'OVERCLOCK SUPREMO',
        titleEn: 'SUPREME OVERCLOCK',
        description: 'Alcanza el Nivel 30 en partida.',
        descriptionEn: 'Reach Level 30 in a run.',
        icon: '🚀',
        rewardCoins: 200,
        target: 30,
        current: 0,
        unlocked: false,
      },
      {
        id: 'toro_damage_100k',
        title: 'DOMADOR CIBERNÉTICO',
        titleEn: 'CYBER TAMER',
        description: 'Inflige 100.000 de daño al Toro.',
        descriptionEn: 'Deal 100,000 damage to El Toro.',
        icon: '⚔️',
        rewardCoins: 300,
        target: 100000,
        current: 0,
        unlocked: false,
      },
      {
        id: 'toro_damage_250k',
        title: 'PESADILLA DEL TORO',
        titleEn: "TORO'S NIGHTMARE",
        description: 'Inflige 250.000 de daño al Toro.',
        descriptionEn: 'Deal 250,000 damage to El Toro.',
        icon: '🔥',
        rewardCoins: 500,
        target: 250000,
        current: 0,
        unlocked: false,
      },
      {
        id: 'boss_slayer_ten',
        title: 'CAZADOR DE TITANES',
        titleEn: 'TITAN HUNTER',
        description: 'Derrota a 10 jefes en una partida.',
        descriptionEn: 'Defeat 10 bosses in a run.',
        icon: '👑',
        rewardCoins: 250,
        target: 10,
        current: 0,
        unlocked: false,
      },
      {
        id: 'hardware_hoarder',
        title: 'AVARICIA DE SILICIO',
        titleEn: 'SILICON GREED',
        description: 'Destruye 30 Cajas de Hardware.',
        descriptionEn: 'Destroy 30 Hardware Crates.',
        icon: '📦',
        rewardCoins: 150,
        target: 30,
        current: 0,
        unlocked: false,
      },
      {
        id: 'crypto_tycoon',
        title: 'MAGNATE CRIPTO',
        titleEn: 'CRYPTO TYCOON',
        description: 'Destruye a 5 Mineros de Criptos.',
        descriptionEn: 'Destroy 5 Crypto Miners.',
        icon: '💎',
        rewardCoins: 200,
        target: 5,
        current: 0,
        unlocked: false,
      },
      {
        id: 'gacha_collector_20',
        title: 'COLECCIONISTA CYBER',
        titleEn: 'CYBER COLLECTOR',
        description: 'Consigue 20 sombreros/máscaras.',
        descriptionEn: 'Collect 20 hats or masks.',
        icon: '🎭',
        rewardCoins: 250,
        target: 20,
        current: 0,
        unlocked: false,
      },
      {
        id: 'gacha_mythic',
        title: 'TOQUE DE MIDAS',
        titleEn: 'MIDAS TOUCH',
        description: 'Obtén cosmético Mítico en Gacha.',
        descriptionEn: 'Get a Mythic cosmetic in Gacha.',
        icon: '🌟',
        rewardCoins: 400,
        target: 1,
        current: 0,
        unlocked: false,
      },
      {
        id: 'damage_dealer_halfmillion',
        title: 'APOCALIPSIS BINARIO',
        titleEn: 'BINARY APOCALYPSE',
        description: 'Inflige 500.000 de daño en partida.',
        descriptionEn: 'Deal 500,000 damage in a run.',
        icon: '💥',
        rewardCoins: 350,
        target: 500000,
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
        titleEn: ach.titleEn,
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

      // Texto de Hito bilingüe
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillText(
        i18n.t('¡HITO DEL KERNEL DESBLOQUEADO!', 'KERNEL MILESTONE UNLOCKED!'),
        toastX + 60,
        currentY + 22
      );

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillText(
        i18n.currentLang === 'EN' ? toast.titleEn : toast.title,
        toastX + 60,
        currentY + 44
      );

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

  public getPageAchievements(page: number, pageSize: number = 12): Achievement[] {
    const start = page * pageSize;
    return this.achievements.slice(start, start + pageSize);
  }

  public getPageUnlockedCount(page: number, pageSize: number = 12): number {
    return this.getPageAchievements(page, pageSize).filter((a) => a.unlocked).length;
  }
}
