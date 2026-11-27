import { i18n } from '../utils/i18n';

export type ArenaThemeId =
  | 'PCB_CORE'
  | 'CRYO_LAB'
  | 'KERNEL_VOLCANO'
  | 'NEON_TOKYO'
  | 'QUANTUM_VOID';

export type GlowColorKey =
  | 'cyan'
  | 'magenta'
  | 'gold'
  | 'red'
  | 'emerald'
  | 'purple'
  | 'white';

export interface ArenaThemeConfig {
  id: ArenaThemeId;
  nameEs: string;
  nameEn: string;
  icon: string;
  accent: string;
  bgInner: string;
  bgOuter: string;
  tileBg: string;
  gridMinor: string;
  gridMajor: string;
  traceColor: string;
  nodeColor: string;
  crossColor: string;
  scanMid: string;
  ambientPrimary: string;
  ambientSecondary: string;
  parallaxColor: string;
  patternStyle: 'PCB' | 'HEX_ICE' | 'VOLCANIC' | 'SYNTH_GRID' | 'QUANTUM';
}

export const ARENA_ORDER: ArenaThemeId[] = [
  'PCB_CORE',
  'CRYO_LAB',
  'KERNEL_VOLCANO',
  'NEON_TOKYO',
  'QUANTUM_VOID',
];

export const ARENA_THEMES: Record<ArenaThemeId, ArenaThemeConfig> = {
  PCB_CORE: {
    id: 'PCB_CORE',
    nameEs: 'PLACA BASE',
    nameEn: 'MOTHERBOARD',
    icon: '⚡',
    accent: '#38bdf8',
    bgInner: '#0b1424',
    bgOuter: '#050911',
    tileBg: '#060a13',
    gridMinor: 'rgba(56, 189, 248, 0.042)',
    gridMajor: 'rgba(56, 189, 248, 0.105)',
    traceColor: 'rgba(16, 185, 129, 0.11)',
    nodeColor: 'rgba(251, 191, 36, 0.22)',
    crossColor: 'rgba(56, 189, 248, 0.24)',
    scanMid: 'rgba(56, 189, 248, 0.055)',
    ambientPrimary: '#38bdf8',
    ambientSecondary: '#10b981',
    parallaxColor: 'rgba(56, 189, 248, 0.045)',
    patternStyle: 'PCB',
  },
  CRYO_LAB: {
    id: 'CRYO_LAB',
    nameEs: 'CRYO LAB',
    nameEn: 'CRYO LAB',
    icon: '❄️',
    accent: '#67e8f9',
    bgInner: '#071a28',
    bgOuter: '#030b14',
    tileBg: '#040e18',
    gridMinor: 'rgba(103, 232, 249, 0.048)',
    gridMajor: 'rgba(125, 211, 252, 0.12)',
    traceColor: 'rgba(186, 230, 253, 0.11)',
    nodeColor: 'rgba(224, 242, 254, 0.26)',
    crossColor: 'rgba(103, 232, 249, 0.28)',
    scanMid: 'rgba(103, 232, 249, 0.065)',
    ambientPrimary: '#bae6fd',
    ambientSecondary: '#22d3ee',
    parallaxColor: 'rgba(125, 211, 252, 0.05)',
    patternStyle: 'HEX_ICE',
  },
  KERNEL_VOLCANO: {
    id: 'KERNEL_VOLCANO',
    nameEs: 'VOLCÁN KERNEL',
    nameEn: 'KERNEL VOLCANO',
    icon: '🌋',
    accent: '#f97316',
    bgInner: '#1c0b0e',
    bgOuter: '#0a0406',
    tileBg: '#0f0608',
    gridMinor: 'rgba(251, 146, 60, 0.045)',
    gridMajor: 'rgba(244, 63, 94, 0.12)',
    traceColor: 'rgba(249, 115, 22, 0.14)',
    nodeColor: 'rgba(253, 224, 71, 0.26)',
    crossColor: 'rgba(251, 113, 133, 0.25)',
    scanMid: 'rgba(249, 115, 22, 0.06)',
    ambientPrimary: '#fb923c',
    ambientSecondary: '#f43f5e',
    parallaxColor: 'rgba(249, 115, 22, 0.05)',
    patternStyle: 'VOLCANIC',
  },
  NEON_TOKYO: {
    id: 'NEON_TOKYO',
    nameEs: 'NEÓN TOKYO',
    nameEn: 'NEON TOKYO',
    icon: '🌃',
    accent: '#e879f9',
    bgInner: '#130924',
    bgOuter: '#06030f',
    tileBg: '#090416',
    gridMinor: 'rgba(232, 121, 249, 0.048)',
    gridMajor: 'rgba(217, 70, 239, 0.12)',
    traceColor: 'rgba(34, 211, 238, 0.12)',
    nodeColor: 'rgba(244, 114, 182, 0.28)',
    crossColor: 'rgba(56, 189, 248, 0.25)',
    scanMid: 'rgba(232, 121, 249, 0.06)',
    ambientPrimary: '#e879f9',
    ambientSecondary: '#22d3ee',
    parallaxColor: 'rgba(217, 70, 239, 0.05)',
    patternStyle: 'SYNTH_GRID',
  },
  QUANTUM_VOID: {
    id: 'QUANTUM_VOID',
    nameEs: 'VACÍO CUÁNTICO',
    nameEn: 'QUANTUM VOID',
    icon: '🌌',
    accent: '#a78bfa',
    bgInner: '#0d0c22',
    bgOuter: '#04040c',
    tileBg: '#060612',
    gridMinor: 'rgba(167, 139, 250, 0.045)',
    gridMajor: 'rgba(139, 92, 246, 0.115)',
    traceColor: 'rgba(52, 211, 153, 0.12)',
    nodeColor: 'rgba(250, 204, 21, 0.24)',
    crossColor: 'rgba(196, 181, 253, 0.26)',
    scanMid: 'rgba(167, 139, 250, 0.06)',
    ambientPrimary: '#a78bfa',
    ambientSecondary: '#34d399',
    parallaxColor: 'rgba(139, 92, 246, 0.05)',
    patternStyle: 'QUANTUM',
  },
};

const ARENA_STORAGE_KEY = 'daw_survivor_arena_theme_v1';

interface FloorDecal {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  kind: 'SCORCH' | 'EMP' | 'CRYO';
}

interface DashAfterimage {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

/**
 * Sistema de Efectos Visuales Avanzados, Arenas Temáticas y Post-Procesado Ligero.
 * Diseñado con sprites offscreen pre-cacheados, pools acotados sin GC y degradación automática
 * en modo ligero para garantizar 60 FPS estables en cualquier navegador o dispositivo.
 */
export class VisualFXSystem {
  public selectedArena: ArenaThemeId = 'PCB_CORE';
  public lightMode: boolean = false;

  // Caches offscreen pre-generados (evitan shadowBlur y createRadialGradient por frame)
  private glowSprites: Partial<Record<GlowColorKey, HTMLCanvasElement>> = {};
  private vignetteCache: HTMLCanvasElement | null = null;
  private vignetteW: number = 0;
  private vignetteH: number = 0;

  private bgCache: HTMLCanvasElement | null = null;
  private bgCacheKey: string = '';
  private infiniteTileCache: HTMLCanvasElement | null = null;
  private infiniteTileKey: string = '';
  private parallaxTileCache: HTMLCanvasElement | null = null;
  private parallaxTileKey: string = '';
  private scanLineCache: HTMLCanvasElement | null = null;
  private scanLineKey: string = '';

  // Pools acotados con compactación in-place (0 GC)
  private decals: FloorDecal[] = [];
  private readonly maxDecals: number = 34;

  private afterimages: DashAfterimage[] = [];
  private readonly maxAfterimages: number = 16;

  // Game Feel: Hitstop selectivo, Glitch de daño y Transición de pantalla
  private hitstopTimer: number = 0;
  private hitstopCooldown: number = 0;
  private glitchTimer: number = 0;
  private glitchIntensity: number = 0;
  private transitionAlpha: number = 0;

  constructor() {
    this.selectedArena = this.loadSavedArena();
  }

  private loadSavedArena(): ArenaThemeId {
    try {
      const raw = window.localStorage?.getItem(ARENA_STORAGE_KEY);
      if (raw && raw in ARENA_THEMES) {
        return raw as ArenaThemeId;
      }
    } catch {
      // Modo incógnito o almacenamiento bloqueado: fallback seguro
    }
    return 'PCB_CORE';
  }

  public setArena(arenaId: ArenaThemeId): void {
    if (!(arenaId in ARENA_THEMES)) return;
    this.selectedArena = arenaId;
    try {
      window.localStorage?.setItem(ARENA_STORAGE_KEY, arenaId);
    } catch {
      // Ignorar errores de cuota/privacidad
    }
  }

  public cycleArena(): ArenaThemeId {
    const idx = ARENA_ORDER.indexOf(this.selectedArena);
    const next = ARENA_ORDER[(idx + 1) % ARENA_ORDER.length];
    this.setArena(next);
    return next;
  }

  public getArenaLabel(id: ArenaThemeId = this.selectedArena): string {
    const cfg = ARENA_THEMES[id] ?? ARENA_THEMES.PCB_CORE;
    return `${cfg.icon} ${i18n.t(cfg.nameEs, cfg.nameEn)}`;
  }

  public getActiveTheme(minigame: string, isNightmare: boolean): ArenaThemeConfig {
    if (minigame === 'BULL_ARENA') return ARENA_THEMES.KERNEL_VOLCANO;
    if (minigame === 'BOSS_RUSH') return ARENA_THEMES.NEON_TOKYO;
    if (minigame === 'CORE_DEFENSE') return ARENA_THEMES.CRYO_LAB;
    if (minigame === 'VAULT_BLITZ') return ARENA_THEMES.QUANTUM_VOID;
    if (isNightmare && this.selectedArena === 'PCB_CORE') {
      // En Pesadilla mantiene la arena elegida con tinte carmesí posterior
      return ARENA_THEMES.PCB_CORE;
    }
    return ARENA_THEMES[this.selectedArena] ?? ARENA_THEMES.PCB_CORE;
  }

  public resetRunFX(): void {
    this.decals.length = 0;
    this.afterimages.length = 0;
    this.hitstopTimer = 0;
    this.glitchTimer = 0;
    this.glitchIntensity = 0;
  }

  public triggerTransition(alpha: number = 0.72): void {
    this.transitionAlpha = Math.max(this.transitionAlpha, Math.min(1, alpha));
  }

  public triggerHitstop(durationSec: number, isCoopOnline: boolean = false): void {
    if (isCoopOnline || this.lightMode) return;
    if (this.hitstopCooldown > 0) return;
    this.hitstopTimer = Math.max(this.hitstopTimer, Math.min(0.055, durationSec));
    this.hitstopCooldown = 0.24;
  }

  public consumeHitstop(dt: number): boolean {
    if (this.hitstopCooldown > 0) {
      this.hitstopCooldown = Math.max(0, this.hitstopCooldown - dt);
    }
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return true;
    }
    return false;
  }

  public triggerGlitch(intensity: number = 1.0, durationSec: number = 0.13): void {
    if (this.lightMode) return;
    this.glitchIntensity = Math.max(this.glitchIntensity, Math.min(1.5, intensity));
    this.glitchTimer = Math.max(this.glitchTimer, Math.min(0.24, durationSec));
  }

  public spawnDecal(
    x: number,
    y: number,
    radius: number,
    color: string,
    kind: 'SCORCH' | 'EMP' | 'CRYO' = 'SCORCH',
    duration: number = 5.0
  ): void {
    if (this.lightMode) return;
    if (this.decals.length >= this.maxDecals) {
      // Sobrescribir la más antigua sin shift() masivo
      this.decals[0] = { x, y, radius, color, life: duration, maxLife: duration, kind };
      return;
    }
    this.decals.push({ x, y, radius, color, life: duration, maxLife: duration, kind });
  }

  public spawnAfterimage(x: number, y: number, radius: number, color: string, life: number = 0.22): void {
    if (this.lightMode) return;
    if (this.afterimages.length >= this.maxAfterimages) {
      this.afterimages[0] = { x, y, radius, color, life, maxLife: life };
      return;
    }
    this.afterimages.push({ x, y, radius, color, life, maxLife: life });
  }

  public update(dt: number): void {
    if (this.glitchTimer > 0) {
      this.glitchTimer = Math.max(0, this.glitchTimer - dt);
      if (this.glitchTimer === 0) this.glitchIntensity = 0;
    }
    if (this.transitionAlpha > 0) {
      this.transitionAlpha = Math.max(0, this.transitionAlpha - dt * 3.8);
    }

    // Compactación in-place de decals
    let dWrite = 0;
    for (let i = 0; i < this.decals.length; i++) {
      const d = this.decals[i];
      d.life -= dt;
      if (d.life > 0) {
        this.decals[dWrite++] = d;
      }
    }
    this.decals.length = dWrite;

    // Compactación in-place de afterimages
    let aWrite = 0;
    for (let i = 0; i < this.afterimages.length; i++) {
      const a = this.afterimages[i];
      a.life -= dt;
      if (a.life > 0) {
        this.afterimages[aWrite++] = a;
      }
    }
    this.afterimages.length = aWrite;
  }

  public drawDecals(
    ctx: CanvasRenderingContext2D,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): void {
    if (this.lightMode || this.decals.length === 0) return;
    ctx.save();
    for (let i = 0; i < this.decals.length; i++) {
      const d = this.decals[i];
      if (d.x + d.radius < minX || d.x - d.radius > maxX || d.y + d.radius < minY || d.y - d.radius > maxY) {
        continue;
      }
      const ratio = Math.max(0, Math.min(1, d.life / d.maxLife));
      const fade = ratio < 0.3 ? ratio / 0.3 : 1;

      if (d.kind === 'EMP') {
        ctx.globalAlpha = 0.24 * fade;
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.14 * fade;
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Marca de quemadura / impacto oscuro + anillo residual
        ctx.globalAlpha = 0.34 * fade;
        ctx.fillStyle = '#02040a';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius * 0.78, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.18 * fade;
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius * 0.92, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  public drawAfterimages(ctx: CanvasRenderingContext2D): void {
    if (this.lightMode || this.afterimages.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.afterimages.length; i++) {
      const a = this.afterimages[i];
      const ratio = Math.max(0, a.life / a.maxLife);
      const r = a.radius * (0.72 + 0.28 * ratio);
      ctx.globalAlpha = 0.34 * ratio;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.52 * ratio;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r * 0.65, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private getGlowSprite(colorKey: GlowColorKey): HTMLCanvasElement | null {
    const existing = this.glowSprites[colorKey];
    if (existing) return existing;

    const palette: Record<GlowColorKey, [string, string]> = {
      cyan: ['rgba(125, 211, 252, 0.85)', 'rgba(14, 165, 233, 0)'],
      magenta: ['rgba(244, 114, 182, 0.85)', 'rgba(217, 70, 239, 0)'],
      gold: ['rgba(254, 240, 138, 0.85)', 'rgba(245, 158, 11, 0)'],
      red: ['rgba(253, 164, 175, 0.85)', 'rgba(244, 63, 94, 0)'],
      emerald: ['rgba(110, 231, 183, 0.85)', 'rgba(16, 185, 129, 0)'],
      purple: ['rgba(216, 180, 254, 0.85)', 'rgba(147, 51, 234, 0)'],
      white: ['rgba(255, 255, 255, 0.85)', 'rgba(226, 232, 240, 0)'],
    };

    try {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const gCtx = c.getContext('2d');
      if (!gCtx) return null;
      const [inner, outer] = palette[colorKey];
      const grad = gCtx.createRadialGradient(32, 32, 2, 32, 32, 32);
      grad.addColorStop(0, inner);
      grad.addColorStop(0.45, inner.replace('0.85', '0.28'));
      grad.addColorStop(1, outer);
      gCtx.fillStyle = grad;
      gCtx.fillRect(0, 0, 64, 64);
      this.glowSprites[colorKey] = c;
      return c;
    } catch {
      return null;
    }
  }

  /**
   * Dibuja un destello aditivo ultra-rápido sin shadowBlur.
   * Debe llamarse dentro de un bloque con globalCompositeOperation = 'lighter'.
   */
  public drawGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    colorKey: GlowColorKey,
    alpha: number = 0.55
  ): void {
    if (this.lightMode || radius <= 1 || alpha <= 0.01) return;
    const sprite = this.getGlowSprite(colorKey);
    if (!sprite) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  }

  public drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.lightMode) return;
    if (!this.vignetteCache || this.vignetteW !== w || this.vignetteH !== h) {
      try {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 288;
        const vCtx = c.getContext('2d');
        if (vCtx) {
          const grad = vCtx.createRadialGradient(256, 144, 118, 256, 144, 300);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(0.72, 'rgba(2, 6, 16, 0.14)');
          grad.addColorStop(1, 'rgba(2, 5, 14, 0.52)');
          vCtx.fillStyle = grad;
          vCtx.fillRect(0, 0, 512, 288);
        }
        this.vignetteCache = c;
        this.vignetteW = w;
        this.vignetteH = h;
      } catch {
        return;
      }
    }
    if (this.vignetteCache) {
      ctx.drawImage(this.vignetteCache, 0, 0, w, h);
    }
  }

  /**
   * Aplica un glitch horizontal muy breve (3 bandas) al recibir daño fuerte o aparecer un jefe.
   * Las coordenadas de origen están estrictamente acotadas al tamaño físico del canvas para evitar excepciones.
   */
  public drawGlitchPass(ctx: CanvasRenderingContext2D, sourceCanvas: HTMLCanvasElement, logicalW: number, logicalH: number): void {
    if (this.lightMode || this.glitchTimer <= 0) return;
    const physW = sourceCanvas.width;
    const physH = sourceCanvas.height;
    if (physW < 64 || physH < 64) return;

    const strength = Math.min(1.4, this.glitchIntensity * (this.glitchTimer / 0.13));
    const maxShift = Math.max(4, Math.round(14 * strength));

    ctx.save();
    for (let i = 0; i < 3; i++) {
      const bandRatioY = 0.14 + Math.random() * 0.72;
      const bandRatioH = 0.025 + Math.random() * 0.055;
      const sy = Math.max(0, Math.min(physH - 4, Math.floor(bandRatioY * physH)));
      const sh = Math.max(2, Math.min(physH - sy, Math.floor(bandRatioH * physH)));
      const dy = (sy / physH) * logicalH;
      const dh = (sh / physH) * logicalH;
      const offsetX = (Math.random() - 0.5) * 2 * maxShift;

      ctx.globalAlpha = 0.75;
      ctx.drawImage(sourceCanvas, 0, sy, physW, sh, offsetX, dy, logicalW, dh);

      // Línea sutil de aberración cromática
      ctx.globalAlpha = 0.14 * strength;
      ctx.fillStyle = i % 2 === 0 ? '#38bdf8' : '#f43f5e';
      ctx.fillRect(0, dy, logicalW, Math.max(2, dh * 0.25));
    }
    ctx.restore();
  }

  public drawTransitionOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.transitionAlpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = this.transitionAlpha;
    ctx.fillStyle = '#040812';
    ctx.fillRect(0, 0, w, h);
    // Línea de escaneo cyber en el frente de la transición
    const scanY = (1 - this.transitionAlpha) * h;
    ctx.globalAlpha = Math.min(0.85, this.transitionAlpha * 1.4);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, scanY - 2, w, 4);
    ctx.restore();
  }

  // ==========================================================
  // CACHES DE ARENAS TEMÁTICAS (CLÁSICO + INFINITO + PARALLAX)
  // ==========================================================

  public ensureClassicBgCache(
    theme: ArenaThemeConfig,
    physW: number,
    physH: number,
    logicalW: number,
    logicalH: number
  ): HTMLCanvasElement {
    const key = `${theme.id}_${physW}x${physH}`;
    if (this.bgCache && this.bgCacheKey === key) {
      return this.bgCache;
    }

    const cache = document.createElement('canvas');
    cache.width = Math.max(1, physW);
    cache.height = Math.max(1, physH);
    const bgCtx = cache.getContext('2d', { alpha: false }) || cache.getContext('2d');
    if (bgCtx) {
      const scale = cache.width / logicalW;
      bgCtx.setTransform(scale, 0, 0, scale, 0, 0);
      const gridSize = 64;
      const majorSize = gridSize * 4;

      const bgGrad = bgCtx.createRadialGradient(
        logicalW * 0.5,
        logicalH * 0.5,
        80,
        logicalW * 0.5,
        logicalH * 0.5,
        Math.max(logicalW, logicalH) * 0.72
      );
      bgGrad.addColorStop(0, theme.bgInner);
      bgGrad.addColorStop(1, theme.bgOuter);
      bgCtx.fillStyle = bgGrad;
      bgCtx.fillRect(0, 0, logicalW, logicalH);

      // Rejilla secundaria
      bgCtx.strokeStyle = theme.gridMinor;
      bgCtx.lineWidth = 1;
      bgCtx.beginPath();
      for (let x = 0; x <= logicalW; x += gridSize) {
        bgCtx.moveTo(x, 0);
        bgCtx.lineTo(x, logicalH);
      }
      for (let y = 0; y <= logicalH; y += gridSize) {
        bgCtx.moveTo(0, y);
        bgCtx.lineTo(logicalW, y);
      }
      bgCtx.stroke();

      // Líneas maestras
      bgCtx.strokeStyle = theme.gridMajor;
      bgCtx.beginPath();
      for (let x = majorSize; x < logicalW; x += majorSize) {
        bgCtx.moveTo(x, 0);
        bgCtx.lineTo(x, logicalH);
      }
      for (let y = majorSize; y < logicalH; y += majorSize) {
        bgCtx.moveTo(0, y);
        bgCtx.lineTo(logicalW, y);
      }
      bgCtx.stroke();

      // Geometría característica de cada arena
      this.drawArenaPatternDetails(bgCtx, theme, logicalW, logicalH, majorSize);
    }

    this.bgCache = cache;
    this.bgCacheKey = key;
    return cache;
  }

  private drawArenaPatternDetails(
    ctx: CanvasRenderingContext2D,
    theme: ArenaThemeConfig,
    w: number,
    h: number,
    majorSize: number
  ): void {
    ctx.strokeStyle = theme.traceColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();

    if (theme.patternStyle === 'HEX_ICE') {
      // Cristales octogonales criogénicos en intersecciones
      for (let gx = majorSize; gx < w; gx += majorSize) {
        for (let gy = majorSize; gy < h; gy += majorSize) {
          const r = 24;
          for (let k = 0; k < 6; k++) {
            const a0 = (k / 6) * Math.PI * 2;
            const a1 = ((k + 1) / 6) * Math.PI * 2;
            ctx.moveTo(gx + Math.cos(a0) * r, gy + Math.sin(a0) * r);
            ctx.lineTo(gx + Math.cos(a1) * r, gy + Math.sin(a1) * r);
          }
        }
      }
    } else if (theme.patternStyle === 'VOLCANIC') {
      // Grietas angulares de magma / canales térmicos
      for (let gx = majorSize; gx < w; gx += majorSize) {
        for (let gy = majorSize; gy < h; gy += majorSize) {
          const dir = ((gx + gy) / majorSize) % 2 === 0 ? 1 : -1;
          ctx.moveTo(gx - 52, gy - 14 * dir);
          ctx.lineTo(gx - 18, gy + 8 * dir);
          ctx.lineTo(gx + 14, gy - 10 * dir);
          ctx.lineTo(gx + 48, gy + 16 * dir);
        }
      }
    } else if (theme.patternStyle === 'SYNTH_GRID') {
      // Diagonales neon synthwave + marcadores de distrito
      for (let gx = majorSize; gx < w; gx += majorSize) {
        for (let gy = majorSize; gy < h; gy += majorSize) {
          ctx.moveTo(gx - 28, gy - 28);
          ctx.lineTo(gx + 28, gy + 28);
          ctx.moveTo(gx + 28, gy - 28);
          ctx.lineTo(gx - 28, gy + 28);
        }
      }
    } else if (theme.patternStyle === 'QUANTUM') {
      // Anillos de interferencia cuántica
      for (let gx = majorSize; gx < w; gx += majorSize) {
        for (let gy = majorSize; gy < h; gy += majorSize) {
          ctx.moveTo(gx + 22, gy);
          ctx.arc(gx, gy, 22, 0, Math.PI * 2);
        }
      }
    } else {
      // PCB 45° clásico
      for (let gx = majorSize; gx < w; gx += majorSize) {
        for (let gy = majorSize; gy < h; gy += majorSize) {
          const dir = (gx / majorSize + gy / majorSize) % 2 === 0 ? 1 : -1;
          ctx.moveTo(gx - 42, gy);
          ctx.lineTo(gx - 18, gy);
          ctx.lineTo(gx, gy + 18 * dir);
          ctx.lineTo(gx + 34, gy + 18 * dir);
        }
      }
    }
    ctx.stroke();

    // Cruces de sector
    ctx.strokeStyle = theme.crossColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = majorSize; x < w; x += majorSize) {
      for (let y = majorSize; y < h; y += majorSize) {
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
      }
    }
    ctx.stroke();

    // Nodos / pads brillantes
    ctx.fillStyle = theme.nodeColor;
    for (let gx = majorSize; gx < w; gx += majorSize) {
      for (let gy = majorSize; gy < h; gy += majorSize) {
        ctx.beginPath();
        ctx.arc(gx - 42, gy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  public ensureInfiniteTileCache(theme: ArenaThemeConfig, isNightmare: boolean): HTMLCanvasElement {
    const key = `${theme.id}_${isNightmare ? 'NM' : 'STD'}`;
    if (this.infiniteTileCache && this.infiniteTileKey === key) {
      return this.infiniteTileCache;
    }
    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 256;
    const tCtx = tile.getContext('2d', { alpha: false }) || tile.getContext('2d');
    if (tCtx) {
      tCtx.fillStyle = theme.tileBg;
      tCtx.fillRect(0, 0, 256, 256);

      tCtx.strokeStyle = theme.gridMinor;
      tCtx.lineWidth = 1;
      tCtx.beginPath();
      for (let i = 0; i < 256; i += 64) {
        tCtx.moveTo(i, 0);
        tCtx.lineTo(i, 256);
        tCtx.moveTo(0, i);
        tCtx.lineTo(256, i);
      }
      tCtx.stroke();

      tCtx.strokeStyle = isNightmare ? 'rgba(244, 63, 94, 0.14)' : theme.gridMajor;
      tCtx.beginPath();
      tCtx.moveTo(0, 0);
      tCtx.lineTo(256, 0);
      tCtx.moveTo(0, 0);
      tCtx.lineTo(0, 256);
      tCtx.stroke();

      // Detalle temático del tile
      tCtx.strokeStyle = theme.traceColor;
      tCtx.lineWidth = 1.6;
      tCtx.beginPath();
      if (theme.patternStyle === 'HEX_ICE') {
        for (let k = 0; k < 6; k++) {
          const a0 = (k / 6) * Math.PI * 2;
          const a1 = ((k + 1) / 6) * Math.PI * 2;
          tCtx.moveTo(128 + Math.cos(a0) * 26, 128 + Math.sin(a0) * 26);
          tCtx.lineTo(128 + Math.cos(a1) * 26, 128 + Math.sin(a1) * 26);
        }
      } else if (theme.patternStyle === 'VOLCANIC') {
        tCtx.moveTo(64, 118);
        tCtx.lineTo(106, 134);
        tCtx.lineTo(148, 120);
        tCtx.lineTo(192, 144);
      } else if (theme.patternStyle === 'SYNTH_GRID') {
        tCtx.moveTo(96, 96);
        tCtx.lineTo(160, 160);
        tCtx.moveTo(160, 96);
        tCtx.lineTo(96, 160);
      } else if (theme.patternStyle === 'QUANTUM') {
        tCtx.arc(128, 128, 24, 0, Math.PI * 2);
      } else {
        tCtx.moveTo(86, 128);
        tCtx.lineTo(110, 128);
        tCtx.lineTo(128, 146);
        tCtx.lineTo(162, 146);
      }
      tCtx.stroke();

      tCtx.fillStyle = theme.nodeColor;
      tCtx.beginPath();
      tCtx.arc(86, 128, 2.3, 0, Math.PI * 2);
      tCtx.fill();
    }
    this.infiniteTileCache = tile;
    this.infiniteTileKey = key;
    return tile;
  }

  public ensureParallaxTileCache(theme: ArenaThemeConfig): HTMLCanvasElement {
    const key = theme.id;
    if (this.parallaxTileCache && this.parallaxTileKey === key) {
      return this.parallaxTileCache;
    }
    const tile = document.createElement('canvas');
    tile.width = 512;
    tile.height = 512;
    const pCtx = tile.getContext('2d');
    if (pCtx) {
      pCtx.strokeStyle = theme.parallaxColor;
      pCtx.lineWidth = 2;
      pCtx.beginPath();
      pCtx.moveTo(0, 256);
      pCtx.lineTo(512, 256);
      pCtx.moveTo(256, 0);
      pCtx.lineTo(256, 512);
      pCtx.stroke();

      // Nodos profundos de placa base inferior
      pCtx.strokeStyle = theme.parallaxColor;
      pCtx.lineWidth = 1.4;
      pCtx.beginPath();
      pCtx.arc(256, 256, 56, 0, Math.PI * 2);
      pCtx.stroke();

      pCtx.fillStyle = theme.parallaxColor;
      pCtx.fillRect(120, 120, 10, 10);
      pCtx.fillRect(382, 382, 10, 10);
    }
    this.parallaxTileCache = tile;
    this.parallaxTileKey = key;
    return tile;
  }

  public ensureScanLineCache(theme: ArenaThemeConfig): HTMLCanvasElement {
    if (this.scanLineCache && this.scanLineKey === theme.id) {
      return this.scanLineCache;
    }
    const strip = document.createElement('canvas');
    strip.width = 4;
    strip.height = 80;
    const sCtx = strip.getContext('2d');
    if (sCtx) {
      const scanGrad = sCtx.createLinearGradient(0, 0, 0, 80);
      scanGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      scanGrad.addColorStop(0.5, theme.scanMid);
      scanGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = scanGrad;
      sCtx.fillRect(0, 0, 4, 80);
    }
    this.scanLineCache = strip;
    this.scanLineKey = theme.id;
    return strip;
  }
}
