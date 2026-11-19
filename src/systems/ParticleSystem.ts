interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  char?: string; // Opcional: dígito binario '0' / '1' o símbolo hexadecimal
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

/**
 * Sistema de Efectos Visuales, Partículas y Game Feel (Fase 5).
 * Gestiona explosiones de píxeles/código binario al destruir malware, ondas expansivas,
 * textos flotantes de daño/eventos y temblor de cámara (Screen Shake).
 */
export class ParticleSystem {
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private floatingTexts: FloatingText[] = [];

  private shakeIntensity: number = 0;
  private shakeTimer: number = 0;

  private readonly maxParticles: number = 140;
  private readonly maxFloatingTexts: number = 32;
  private readonly maxShockwaves: number = 6;
  public lightMode: boolean = false;

  public triggerShake(intensity: number, duration: number = 0.2): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  public getShakeOffset(): { x: number; y: number } {
    if (this.shakeTimer <= 0 || this.shakeIntensity <= 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: (Math.random() - 0.5) * 2 * this.shakeIntensity,
      y: (Math.random() - 0.5) * 2 * this.shakeIntensity,
    };
  }

  /**
   * Genera una explosión de fragmentos neón y dígitos binarios ('0' y '1') al purgar un virus.
   */
  public spawnExplosion(
    x: number,
    y: number,
    color: string,
    count: number = 18,
    withShockwave: boolean = false
  ): void {
    const cap = this.lightMode ? 48 : this.maxParticles;
    const effectiveCount = this.lightMode ? Math.max(3, Math.ceil(count * 0.35)) : count;
    const availableSlots = cap - this.particles.length;
    if (availableSlots <= 0) return;
    const actualCount = Math.min(effectiveCount, availableSlots);

    for (let i = 0; i < actualCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 240;
      const life = 0.35 + Math.random() * 0.45;
      const isBinaryChar = Math.random() < 0.35;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: isBinaryChar ? 12 : 3 + Math.random() * 4,
        color,
        alpha: 1,
        life,
        maxLife: life,
        char: isBinaryChar ? (Math.random() < 0.5 ? '0' : '1') : undefined,
      });
    }

    if (withShockwave && this.shockwaves.length < this.maxShockwaves) {
      this.shockwaves.push({
        x,
        y,
        radius: 8,
        maxRadius: 110,
        color,
        alpha: 0.9,
      });
    }
  }

  public spawnHitSparks(x: number, y: number, color: string): void {
    if (this.lightMode) return;
    if (this.particles.length >= this.maxParticles) return;
    const count = Math.min(4, this.maxParticles - this.particles.length);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 110;
      const life = 0.18 + Math.random() * 0.15;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3,
        color,
        alpha: 1,
        life,
        maxLife: life,
      });
    }
  }

  public spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string = '#ffffff',
    scale: number = 1
  ): void {
    if (this.floatingTexts.length >= this.maxFloatingTexts) {
      this.floatingTexts.shift();
    }
    this.floatingTexts.push({
      x: x + (Math.random() - 0.5) * 14,
      y: y - 10,
      vy: -48,
      text,
      color,
      life: 0.65,
      maxLife: 0.65,
      scale,
    });
  }

  public update(dt: number): void {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      if (this.shakeTimer === 0) {
        this.shakeIntensity = 0;
      }
    }

    const drag = Math.pow(0.94, dt * 60);
    let pWrite = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
      p.life -= dt;
      if (p.life > 0) {
        p.alpha = Math.max(0, p.life / p.maxLife);
        this.particles[pWrite++] = p;
      }
    }
    this.particles.length = pWrite;

    let swWrite = 0;
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, 8 * dt);
      sw.alpha -= dt * 2.2;
      if (sw.alpha > 0.02) {
        this.shockwaves[swWrite++] = sw;
      }
    }
    this.shockwaves.length = swWrite;

    let ftWrite = 0;
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life > 0) {
        this.floatingTexts[ftWrite++] = ft;
      }
    }
    this.floatingTexts.length = ftWrite;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (
      this.shockwaves.length === 0 &&
      this.particles.length === 0 &&
      this.floatingTexts.length === 0
    ) {
      return;
    }

    ctx.save();
    ctx.shadowBlur = 0;

    // 1. Dibujar ondas expansivas
    if (this.shockwaves.length > 0) {
      ctx.lineWidth = 2.5;
      for (let i = 0; i < this.shockwaves.length; i++) {
        const sw = this.shockwaves[i];
        ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.strokeStyle = sw.color;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 2. Dibujar partículas y dígitos binarios sin save/restore por partícula
    if (this.particles.length > 0) {
      ctx.font = 'bold 12px "Courier New", monospace';
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        if (p.char) {
          ctx.fillText(p.char, p.x, p.y);
        } else {
          ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
        }
      }
    }

    // 3. Dibujar textos flotantes de daño / eventos
    if (this.floatingTexts.length > 0) {
      ctx.textAlign = 'center';
      let lastFontSize = -1;
      for (let i = 0; i < this.floatingTexts.length; i++) {
        const ft = this.floatingTexts[i];
        ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
        ctx.fillStyle = ft.color;
        const fSize = Math.round(13 * ft.scale);
        if (fSize !== lastFontSize) {
          ctx.font = `bold ${fSize}px "Courier New", monospace`;
          lastFontSize = fSize;
        }
        ctx.fillText(ft.text, ft.x, ft.y);
      }
    }

    ctx.restore();
  }

  public clear(): void {
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.shakeIntensity = 0;
    this.shakeTimer = 0;
  }
}
