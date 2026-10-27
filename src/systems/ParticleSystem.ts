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
    for (let i = 0; i < count; i++) {
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

    if (withShockwave) {
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
    for (let i = 0; i < 6; i++) {
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

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }

    for (const sw of this.shockwaves) {
      sw.radius += (sw.maxRadius - sw.radius) * 8 * dt;
      sw.alpha -= dt * 2.2;
    }

    for (const ft of this.floatingTexts) {
      ft.y += ft.vy * dt;
      ft.life -= dt;
    }

    this.particles = this.particles.filter((p) => p.life > 0);
    this.shockwaves = this.shockwaves.filter((sw) => sw.alpha > 0.02);
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.life > 0);
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 1. Dibujar ondas expansivas
    for (const sw of this.shockwaves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.strokeStyle = sw.color;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Dibujar partículas y dígitos binarios
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;

      if (p.char) {
        ctx.font = `bold ${p.size}px "Courier New", monospace`;
        ctx.fillText(p.char, p.x, p.y);
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }

    // 3. Dibujar textos flotantes de daño / eventos
    for (const ft of this.floatingTexts) {
      ctx.save();
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.round(13 * ft.scale)}px "Courier New", monospace`;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
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
