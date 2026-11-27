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
  isStreak?: boolean; // Chispa direccional orientada al vector de velocidad
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
  vx: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

/**
 * Sistema de Efectos Visuales, Partículas y Game Feel (Fase 5 + Upgrade Visual).
 * Gestiona explosiones de chispas vectoriales y código binario al destruir malware,
 * ondas expansivas, textos flotantes con curva "pop" y temblor de cámara (Screen Shake).
 */
export class ParticleSystem {
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private floatingTexts: FloatingText[] = [];

  private shakeIntensity: number = 0;
  private shakeTimer: number = 0;

  private readonly maxParticles: number = 150;
  private readonly maxFloatingTexts: number = 32;
  private readonly maxShockwaves: number = 7;
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
   * Genera una explosión de chispas neón vectoriales y dígitos binarios ('0' y '1') al purgar un virus.
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
      const speed = 70 + Math.random() * 270;
      const life = 0.32 + Math.random() * 0.44;
      const isBinaryChar = Math.random() < 0.28;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: isBinaryChar ? 12 : 2.2 + Math.random() * 2.4,
        color,
        alpha: 1,
        life,
        maxLife: life,
        char: isBinaryChar ? (Math.random() < 0.5 ? '0' : '1') : undefined,
        isStreak: !isBinaryChar && !this.lightMode,
      });
    }

    if (withShockwave && this.shockwaves.length < this.maxShockwaves) {
      this.shockwaves.push({
        x,
        y,
        radius: 8,
        maxRadius: 115,
        color,
        alpha: 0.92,
      });
    }
  }

  public spawnHitSparks(x: number, y: number, color: string): void {
    if (this.lightMode) return;
    if (this.particles.length >= this.maxParticles) return;
    const count = Math.min(5, this.maxParticles - this.particles.length);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 190;
      const life = 0.16 + Math.random() * 0.16;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.2,
        color,
        alpha: 1,
        life,
        maxLife: life,
        isStreak: true,
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
      x: x + (Math.random() - 0.5) * 16,
      y: y - 10,
      vx: (Math.random() - 0.5) * 28,
      vy: -78 - Math.random() * 18,
      text,
      color,
      life: 0.68,
      maxLife: 0.68,
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

    const drag = Math.pow(0.93, dt * 60);
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
      sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, 8.5 * dt);
      sw.alpha -= dt * 2.25;
      if (sw.alpha > 0.02) {
        this.shockwaves[swWrite++] = sw;
      }
    }
    this.shockwaves.length = swWrite;

    let ftWrite = 0;
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ft.x += ft.vx * dt;
      ft.y += ft.vy * dt;
      // Desaceleración suave (efecto pop + flotación)
      ft.vy += 95 * dt;
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

    // 1. Dibujar ondas expansivas con doble anillo sutil
    if (this.shockwaves.length > 0) {
      for (let i = 0; i < this.shockwaves.length; i++) {
        const sw = this.shockwaves[i];
        const alpha = Math.max(0, sw.alpha);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();

        if (!this.lightMode) {
          ctx.globalAlpha = alpha * 0.45;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.radius * 0.86, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // 2. Dibujar partículas (chispas vectoriales + dígitos binarios) sin save/restore por partícula
    if (this.particles.length > 0) {
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.lineCap = 'round';
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        ctx.globalAlpha = p.alpha;
        if (p.char) {
          ctx.fillStyle = p.color;
          ctx.fillText(p.char, p.x, p.y);
        } else if (p.isStreak) {
          const tailX = p.x - p.vx * 0.036;
          const tailY = p.y - p.vy * 0.036;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();

          // Punta incandescente blanca
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
        }
      }
    }

    // 3. Dibujar textos flotantes con curva "pop" y contorno oscuro de alto contraste
    if (this.floatingTexts.length > 0) {
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      let lastFontSize = -1;
      for (let i = 0; i < this.floatingTexts.length; i++) {
        const ft = this.floatingTexts[i];
        const age = ft.maxLife - ft.life;
        const popMult = age < 0.12 ? 1.32 - (age / 0.12) * 0.32 : 1.0;
        const alpha = Math.max(0, Math.min(1, (ft.life / ft.maxLife) * 1.35));
        const fontSize = Math.round(14 * ft.scale * popMult);
        if (fontSize !== lastFontSize) {
          ctx.font = `bold ${fontSize}px "Courier New", monospace`;
          lastFontSize = fontSize;
        }
        ctx.globalAlpha = alpha;
        if (!this.lightMode) {
          ctx.strokeStyle = 'rgba(2, 6, 16, 0.88)';
          ctx.lineWidth = 3.2;
          ctx.strokeText(ft.text, ft.x, ft.y);
        }
        ctx.fillStyle = ft.color;
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
