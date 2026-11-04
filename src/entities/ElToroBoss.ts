import { Adware } from './Adware';
import { Player } from './Player';

export type ElToroState = 'CHASE' | 'TELEGRAPH' | 'DASH';

/**
 * Jefe Final Invencible: "EL TORO" (v0.13.0).
 * Aparece en el mapa normal inmediatamente después de derrotar al 4.º Mega-Jefe único.
 * - Armas del jugador HABILITADAS.
 * - Invencible: su HP nunca baja a 0 y no puede morir; registra todo el daño acumulado.
 * - Daño de contacto: exactamente el 50% de la vida máxima del jugador.
 * - Escalado: incrementa ligeramente su velocidad de movimiento cada 15 segundos.
 * - Embestida (Dash Attack): cada 10s se detiene durante 1.5s para telegrafiar el ataque
 *   y lanza una embestida masiva a altísima velocidad hacia la posición del jugador.
 */
export class ElToroBoss extends Adware {
  public readonly bossName: string = 'JEFE FINAL: EL TORO';
  public totalDamageTaken: number = 0;
  public speedTier: number = 0;
  public state: ElToroState = 'CHASE';

  private baseChaseSpeed: number = 175;
  private speedScaleTimer: number = 0;
  private readonly speedScaleInterval: number = 15.0;

  private dashCycleTimer: number = 0;
  private readonly dashInterval: number = 10.0;
  private readonly telegraphDuration: number = 1.5;
  private readonly dashDuration: number = 0.65;
  private stateTimer: number = 0;

  private dashAngle: number = 0;
  private dashSpeed: number = 780;
  private animTimer: number = 0;

  constructor(x: number, y: number) {
    super(x, y, 116, 175, '#dc2626', 1000000, 50, 0);
    this.malwareType = 'FINAL_BOSS';
    this.knockbackResistance = 1.0;
  }

  public override update(dt: number, player: Player): void {
    this.animTimer += dt;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }
    if (this.networkFreezeTimer > 0) {
      this.networkFreezeTimer = Math.max(0, this.networkFreezeTimer - dt);
    }

    // Daño de contacto: exactamente el 50% de la vida MÁXIMA del jugador
    this.damage = player.maxHp * 0.5;

    // Escalado: incrementa ligeramente su velocidad de movimiento cada 15 segundos
    this.speedScaleTimer += dt;
    while (this.speedScaleTimer >= this.speedScaleInterval) {
      this.speedScaleTimer -= this.speedScaleInterval;
      this.speedTier++;
      this.baseChaseSpeed = Math.round(this.baseChaseSpeed * 1.07 + 6);
    }

    if (this.state === 'CHASE') {
      this.speed = this.baseChaseSpeed;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0) {
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
        this.dashAngle = Math.atan2(dy, dx);
      }

      this.dashCycleTimer += dt;
      if (this.dashCycleTimer >= this.dashInterval) {
        this.dashCycleTimer = 0;
        this.state = 'TELEGRAPH';
        this.stateTimer = this.telegraphDuration;
        this.speed = 0;
        this.dashAngle = Math.atan2(player.y - this.y, player.x - this.x);
      }
    } else if (this.state === 'TELEGRAPH') {
      // Se detiene por completo durante 1.5 segundos apuntando hacia la posición del jugador
      this.speed = 0;
      this.dashAngle = Math.atan2(player.y - this.y, player.x - this.x);

      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'DASH';
        this.stateTimer = this.dashDuration;
        this.dashSpeed = 780;
      }
    } else if (this.state === 'DASH') {
      // Embestida masiva de alta velocidad en la dirección fijada
      this.x += Math.cos(this.dashAngle) * this.dashSpeed * dt;
      this.y += Math.sin(this.dashAngle) * this.dashSpeed * dt;

      const margin = this.size * 0.45;
      const maxW = 1920;
      const maxH = 1080;
      this.x = Math.max(margin, Math.min(maxW - margin, this.x));
      this.y = Math.max(margin, Math.min(maxH - margin, this.y));

      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'CHASE';
        this.dashCycleTimer = 0;
      }
    }
  }

  public override takeDamage(
    amount: number,
    _knockbackX: number = 0,
    _knockbackY: number = 0
  ): void {
    if (amount > 0) {
      this.totalDamageTaken += amount;
      this.hitFlashTimer = 0.08;
    }
    // Invencible: su vida nunca baja a 0 y jamás muere
    this.hp = this.maxHp;
    this.active = true;
  }

  public getDashStatusText(): string {
    if (this.state === 'TELEGRAPH') {
      return `⚠️ ¡CARGANDO EMBESTIDA! (${Math.max(0, this.stateTimer).toFixed(1)}s) ⚠️`;
    }
    if (this.state === 'DASH') {
      return '💥 ¡¡EMBESTIDA TAURINA EN CURSO!! 💥';
    }
    const remaining = Math.max(0, this.dashInterval - this.dashCycleTimer);
    return `Próxima Embestida: ${remaining.toFixed(1)}s`;
  }

  public override draw(ctx: CanvasRenderingContext2D): void {
    const isFlashing = this.hitFlashTimer > 0;
    const x = this.x;
    const y = this.y;

    ctx.save();

    // 1. Indicador visual de telegrafiado (línea y corredor de embestida durante 1.5s)
    if (this.state === 'TELEGRAPH') {
      const progress = 1 - Math.max(0, this.stateTimer / this.telegraphDuration);
      const pulse = 0.45 + 0.45 * Math.sin(this.animTimer * 24);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.dashAngle);

      // Corredor de peligro proyectado
      ctx.fillStyle = `rgba(255, 20, 50, ${0.14 + progress * 0.22})`;
      ctx.fillRect(0, -this.size * 0.45, 680, this.size * 0.9);

      ctx.strokeStyle = `rgba(250, 204, 21, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 8]);
      ctx.strokeRect(0, -this.size * 0.45, 680, this.size * 0.9);
      ctx.setLineDash([]);

      // Flecha central de dirección de embestida
      ctx.strokeStyle = '#ff0044';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(640, 0);
      ctx.stroke();

      ctx.restore();
    }

    // 2. Estela de fuego cibernético durante la embestida
    if (this.state === 'DASH') {
      ctx.save();
      for (let i = 1; i <= 3; i++) {
        const trailX = x - Math.cos(this.dashAngle) * (i * 26);
        const trailY = y - Math.sin(this.dashAngle) * (i * 26);
        ctx.fillStyle = `rgba(239, 68, 68, ${0.38 - i * 0.1})`;
        ctx.beginPath();
        ctx.arc(trailX, trailY, this.size * (0.48 - i * 0.06), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Aura exterior colosal del Toro
    ctx.shadowColor = this.state === 'TELEGRAPH' ? '#facc15' : '#ff0044';
    ctx.shadowBlur = isFlashing ? 38 : this.state === 'CHASE' ? 22 : 34;

    // Lomo / Hombros masivos de toro blindado
    ctx.fillStyle = isFlashing ? '#ffffff' : '#450a0a';
    ctx.strokeStyle = isFlashing ? '#fde047' : '#dc2626';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 56, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Placas dorsales mecánicas
    if (!isFlashing) {
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 42, 32, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Cuernos gigantes curvados (rasgo distintivo de Toro)
    ctx.fillStyle = isFlashing ? '#ffffff' : '#fef08a';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;

    // Cuerno izquierdo
    ctx.beginPath();
    ctx.moveTo(x - 32, y - 18);
    ctx.quadraticCurveTo(x - 78, y - 34, x - 64, y - 68);
    ctx.quadraticCurveTo(x - 48, y - 40, x - 20, y - 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cuerno derecho
    ctx.beginPath();
    ctx.moveTo(x + 32, y - 18);
    ctx.quadraticCurveTo(x + 78, y - 34, x + 64, y - 68);
    ctx.quadraticCurveTo(x + 48, y - 40, x + 20, y - 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Puntas incandescentes de los cuernos
    ctx.fillStyle = '#ff0044';
    ctx.beginPath();
    ctx.arc(x - 64, y - 68, 5, 0, Math.PI * 2);
    ctx.arc(x + 64, y - 68, 5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Cabeza y testuz del Toro
    ctx.fillStyle = isFlashing ? '#ffffff' : '#991b1b';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 34, y - 32);
    ctx.lineTo(x + 34, y - 32);
    ctx.lineTo(x + 24, y + 24);
    ctx.lineTo(x - 24, y + 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Morro / Hocico ancho
    ctx.fillStyle = isFlashing ? '#fde047' : '#1c1917';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.fillRect(x - 20, y + 8, 40, 20);
    ctx.strokeRect(x - 20, y + 8, 40, 20);

    // Fosas nasales humeantes
    ctx.fillStyle = '#ff0044';
    ctx.beginPath();
    ctx.arc(x - 9, y + 17, 4, 0, Math.PI * 2);
    ctx.arc(x + 9, y + 17, 4, 0, Math.PI * 2);
    ctx.fill();

    // 6. Argolla nasal dorada gigante (clásico de Toro)
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(x, y + 30, 13, 0.15 * Math.PI, 0.85 * Math.PI, false);
    ctx.stroke();

    // 7. Ojos furiosos inclinados
    ctx.shadowColor = '#ff0044';
    ctx.shadowBlur = 16;
    ctx.fillStyle = this.state === 'TELEGRAPH' ? '#facc15' : '#ff0044';

    // Ojo izquierdo
    ctx.beginPath();
    ctx.moveTo(x - 26, y - 14);
    ctx.lineTo(x - 8, y - 6);
    ctx.lineTo(x - 24, y - 4);
    ctx.closePath();
    ctx.fill();

    // Ojo derecho
    ctx.beginPath();
    ctx.moveTo(x + 26, y - 14);
    ctx.lineTo(x + 8, y - 6);
    ctx.lineTo(x + 24, y - 4);
    ctx.closePath();
    ctx.fill();

    // Etiqueta flotante sobre el Jefe Final
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[EL TORO // INVENCIBLE]', x, y - 78);

    ctx.restore();
  }
}
