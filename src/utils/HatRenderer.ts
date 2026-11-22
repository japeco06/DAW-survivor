export type HatAnchorMode = 'TOP' | 'FACE' | 'HELM';

const FACE_HAT_IDS = new Set<string>([
  'com_5',
  'com_10',
  'rar_1',
  'rar_4',
  'rar_7',
  'rar_10',
  'epi_2',
  'epi_6',
  'epi_7',
  'leg_4',
  'leg_9',
  'mit_2',
  'mit_7',
  'mit_9',
]);

const HELM_HAT_IDS = new Set<string>([
  'com_2',
  'com_9',
  'rar_2',
  'rar_8',
  'epi_1',
  'epi_5',
  'epi_9',
  'epi_10',
  'leg_3',
  'leg_5',
  'leg_8',
  'mit_4',
  'mit_5',
  'mit_10',
]);

/**
 * Renderizador vectorial procedural para los 50 sombreros/accesorios del juego.
 * Elimina los emojis genéricos y acopla cada pieza directamente sobre el chasis o visor.
 */
export class HatRenderer {
  public static getAnchorMode(hatId: string): HatAnchorMode {
    if (FACE_HAT_IDS.has(hatId)) return 'FACE';
    if (HELM_HAT_IDS.has(hatId)) return 'HELM';
    return 'TOP';
  }

  /**
   * Dibuja el sombrero acoplado directamente sobre el agente antivirus en partida o en el Hangar.
   */
  public static drawHatOnCharacter(
    ctx: CanvasRenderingContext2D,
    hatId: string,
    x: number,
    y: number,
    charSize: number,
    facingAngle: number = 0,
    timeMs: number = 0
  ): void {
    const mode = this.getAnchorMode(hatId);
    const half = charSize / 2;
    const lookX = Math.cos(facingAngle) * (half * 0.16);
    const lookY = Math.sin(facingAngle) * (half * 0.11);

    ctx.save();
    if (mode === 'FACE') {
      // Centrado exactamente sobre la altura de los ojos/visor del chasis
      ctx.translate(x + lookX, y - half * 0.22 + lookY);
    } else if (mode === 'HELM') {
      // Envuelve el chasis superior y zona de visor
      ctx.translate(x + lookX * 0.45, y - half * 0.16);
    } else {
      // Asentado justo en la coronilla superior del chasis (sin flotar lejos)
      const hover = hatId === 'leg_2' || hatId === 'leg_7' ? Math.sin(timeMs * 0.006) * 1.4 : 0;
      ctx.translate(x + lookX * 0.3, y - half * 0.94 + hover);
    }

    const scale = charSize / 28;
    ctx.scale(scale, scale);
    this.drawShape(ctx, hatId, timeMs, false);
    ctx.restore();
  }

  /**
   * Dibuja la miniatura vectorial centrada para tarjetas de Gacha, Inventario y HUD.
   */
  public static drawHatIcon(
    ctx: CanvasRenderingContext2D,
    hatId: string,
    cx: number,
    cy: number,
    iconSize: number = 28,
    timeMs: number = 0
  ): void {
    const mode = this.getAnchorMode(hatId);
    ctx.save();
    // Ajuste vertical para centrar perfectamente cada tipo de pieza en su recuadro
    const yOffset = mode === 'TOP' ? iconSize * 0.22 : mode === 'HELM' ? iconSize * 0.06 : 0;
    ctx.translate(cx, cy + yOffset);
    const scale = iconSize / 26;
    ctx.scale(scale, scale);
    this.drawShape(ctx, hatId, timeMs, true);
    ctx.restore();
  }

  private static traceRoundedBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const cr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + cr, y);
    ctx.lineTo(x + w - cr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + cr);
    ctx.lineTo(x + w, y + h - cr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - cr, y + h);
    ctx.lineTo(x + cr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - cr);
    ctx.lineTo(x, y + cr);
    ctx.quadraticCurveTo(x, y, x + cr, y);
    ctx.closePath();
  }

  private static drawCap(
    ctx: CanvasRenderingContext2D,
    crownColor: string,
    brimColor: string,
    panelColor?: string,
    crestColor?: string
  ): void {
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#090d16';

    // Visera inclinada hacia adelante/derecha
    ctx.fillStyle = brimColor;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.quadraticCurveTo(9, -2, 16, 2.5);
    ctx.quadraticCurveTo(8, 5, -2, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Copa de la gorra
    ctx.fillStyle = crownColor;
    ctx.beginPath();
    ctx.arc(0, 0, 10.5, Math.PI, 0);
    ctx.lineTo(10.5, 1.5);
    ctx.lineTo(-10.5, 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (panelColor) {
      ctx.fillStyle = panelColor;
      ctx.beginPath();
      ctx.arc(1.5, 0, 7, -Math.PI * 0.72, -Math.PI * 0.12);
      ctx.lineTo(8, 1);
      ctx.lineTo(-4, 1);
      ctx.closePath();
      ctx.fill();
    }

    if (crestColor) {
      ctx.fillStyle = crestColor;
      ctx.fillRect(0.5, -5.5, 4, 2.5);
    }

    // Botón superior
    ctx.fillStyle = brimColor;
    ctx.beginPath();
    ctx.arc(0, -10.5, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  private static drawFedora(
    ctx: CanvasRenderingContext2D,
    bodyColor: string,
    bandColor: string,
    glowEdge?: string
  ): void {
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = glowEdge || '#090d16';

    // Ala del sombrero
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 1, 15, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Copa trapecio con hendidura superior
    ctx.beginPath();
    ctx.moveTo(-9, 1);
    ctx.lineTo(-7.2, -9.5);
    ctx.lineTo(-2.5, -8.3);
    ctx.lineTo(2.5, -8.3);
    ctx.lineTo(7.2, -9.5);
    ctx.lineTo(9, 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cinta
    ctx.fillStyle = bandColor;
    ctx.fillRect(-8.3, -2.8, 16.6, 2.8);
  }

  private static drawGlasses(
    ctx: CanvasRenderingContext2D,
    frameColor: string,
    lensFill: string | null,
    round: boolean = false,
    glint: boolean = true
  ): void {
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = frameColor;

    const lensW = round ? 7 : 7.5;
    const lensH = round ? 7 : 5.4;
    const lx = -9.2;
    const rx = 1.7;
    const y = -lensH / 2;

    if (round) {
      ctx.beginPath();
      ctx.arc(lx + lensW / 2, 0, lensW / 2, 0, Math.PI * 2);
      if (lensFill) {
        ctx.fillStyle = lensFill;
        ctx.fill();
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rx + lensW / 2, 0, lensW / 2, 0, Math.PI * 2);
      if (lensFill) {
        ctx.fillStyle = lensFill;
        ctx.fill();
      }
      ctx.stroke();
    } else {
      this.traceRoundedBox(ctx, lx, y, lensW, lensH, 1.5);
      if (lensFill) {
        ctx.fillStyle = lensFill;
        ctx.fill();
      }
      ctx.stroke();

      this.traceRoundedBox(ctx, rx, y, lensW, lensH, 1.5);
      if (lensFill) {
        ctx.fillStyle = lensFill;
        ctx.fill();
      }
      ctx.stroke();
    }

    // Puente nasal
    ctx.beginPath();
    ctx.moveTo(lx + lensW, -0.5);
    ctx.lineTo(rx, -0.5);
    ctx.stroke();

    if (glint && lensFill) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(lx + 1.5, y + 1.2);
      ctx.lineTo(lx + 3.6, y + 3.2);
      ctx.moveTo(rx + 1.5, y + 1.2);
      ctx.lineTo(rx + 3.6, y + 3.2);
      ctx.stroke();
    }
  }

  private static drawHeadphones(
    ctx: CanvasRenderingContext2D,
    bandColor: string,
    cupColor: string,
    rgbGlow: string | null,
    withMic: boolean
  ): void {
    // Arco superior
    ctx.strokeStyle = bandColor;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, -1, 14.2, Math.PI * 1.04, -Math.PI * 0.04);
    ctx.stroke();

    // Almohadillas laterales
    for (const side of [-1, 1]) {
      ctx.fillStyle = cupColor;
      ctx.strokeStyle = rgbGlow || '#0f172a';
      ctx.lineWidth = 1.5;
      this.traceRoundedBox(ctx, side * 12.2 - 2.6, -5.5, 5.2, 10, 2.2);
      ctx.fill();
      ctx.stroke();

      if (rgbGlow) {
        ctx.fillStyle = rgbGlow;
        ctx.fillRect(side * 12.2 - 0.8, -3, 1.6, 5);
      }
    }

    if (withMic) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-12.5, 3);
      ctx.quadraticCurveTo(-11, 8, -3, 7);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-2.5, 7, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private static drawShape(
    ctx: CanvasRenderingContext2D,
    hatId: string,
    timeMs: number,
    isIcon: boolean
  ): void {
    const t = timeMs * 0.004;

    switch (hatId) {
      // ================= COMUNES (10) =================
      case 'com_1': // Visera de Becario
        this.drawCap(ctx, '#0284c7', '#38bdf8', '#e0f2fe', '#0ea5e9');
        break;

      case 'com_2': // Casco de Obra Amarillo
        ctx.save();
        ctx.translate(0, isIcon ? -2 : -9);
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 2, 12.5, Math.PI, 0);
        ctx.lineTo(14.5, 4);
        ctx.lineTo(-14.5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Nervio central superior
        ctx.fillStyle = '#fef08a';
        this.traceRoundedBox(ctx, -2.4, -11.2, 4.8, 12, 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;

      case 'com_3': // Gorro de Lana Gris
        ctx.fillStyle = '#64748b';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, 10.5, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Doblez acanalado
        ctx.fillStyle = '#94a3b8';
        this.traceRoundedBox(ctx, -11.5, -2.5, 23, 5, 2);
        ctx.fill();
        ctx.stroke();
        // Pompón
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, -11.8, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'com_4': // Diadema de Cable UTP
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-12, 1);
        ctx.quadraticCurveTo(0, -3, 12, 1);
        ctx.stroke();
        // Conector cristal RJ45 en la cima
        ctx.fillStyle = '#bae6fd';
        ctx.strokeStyle = '#0369a1';
        ctx.lineWidth = 1.2;
        this.traceRoundedBox(ctx, -4, -9, 8, 8, 1.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        for (let i = -2; i <= 2; i += 2) {
          ctx.fillRect(i - 0.5, -8, 1, 3.5);
        }
        break;

      case 'com_5': // Gafas de Plástico Sin Cristal
        this.drawGlasses(ctx, '#0f172a', null, false, false);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.2;
        this.drawGlasses(ctx, '#334155', null, false, false);
        break;

      case 'com_6': // Sombrero de Papel de Aluminio
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-12, 2);
        ctx.lineTo(-2, -12);
        ctx.lineTo(0, -18); // antena punta
        ctx.lineTo(2, -12);
        ctx.lineTo(12, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(-6, -2);
        ctx.lineTo(4, -5);
        ctx.moveTo(-3, -7);
        ctx.lineTo(3, -9);
        ctx.stroke();
        break;

      case 'com_7': // Boina de Soporte Técnico
        ctx.fillStyle = '#1e3a8a';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(-1, -4, 13.5, 6.2, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(4, -3.5, 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'com_8': // Cinta Sudorosa de Ping
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 1.2;
        this.traceRoundedBox(ctx, -13, -3.5, 26, 5.2, 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-12, -1.5, 24, 1.5);
        // Cintas colgantes detrás
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-12.5, -1);
        ctx.lineTo(-17, 4 + Math.sin(t * 2) * 1.5);
        ctx.moveTo(-12.5, 0);
        ctx.lineTo(-15.5, 6.5 + Math.cos(t * 2) * 1.2);
        ctx.stroke();
        break;

      case 'com_9': // Orejeras de Call Center
        this.drawHeadphones(ctx, '#475569', '#1e293b', null, true);
        break;

      case 'com_10': // Antifaz de Modo Oscuro
        ctx.fillStyle = '#090d16';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-11, -3.5);
        ctx.quadraticCurveTo(0, -1.5, 11, -3.5);
        ctx.lineTo(10, 3.2);
        ctx.quadraticCurveTo(3, 4.5, 0, 1.2);
        ctx.quadraticCurveTo(-3, 4.5, -10, 3.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      // ================= RARAS (10) =================
      case 'rar_1': // Gafas Protectoras de Laboratorio
        this.drawGlasses(ctx, '#0ea5e9', 'rgba(56, 189, 248, 0.55)', false, true);
        break;

      case 'rar_2': // Casco de Ciclista Urbano
        ctx.save();
        ctx.translate(0, isIcon ? -2 : -9);
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-13, 3);
        ctx.quadraticCurveTo(-11, -9, 3, -9);
        ctx.lineTo(15, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(-5, -5.5, 6, 2.2);
        ctx.fillRect(3, -5.5, 5, 2.2);
        ctx.restore();
        break;

      case 'rar_3': // Sombrero de Paja Compilador
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = '#854d0e';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(0, 1, 17, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 8.8, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-8.5, -2.5, 17, 2.5);
        break;

      case 'rar_4': // Visor LED Azul
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        this.traceRoundedBox(ctx, -11.5, -3.5, 23, 7, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-9, -1, 18, 2);
        ctx.shadowBlur = 0;
        break;

      case 'rar_5': // Gorro de Marinero de Red
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-10.5, 1);
        ctx.lineTo(-12.5, -6);
        ctx.quadraticCurveTo(0, -10.5, 12.5, -6);
        ctx.lineTo(10.5, 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(-10.5, -1.8, 21, 2.8);
        break;

      case 'rar_6': // Fez de Encriptación
        ctx.fillStyle = '#be123c';
        ctx.strokeStyle = '#4c0519';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-8, 1);
        ctx.lineTo(-6, -10);
        ctx.lineTo(6, -10);
        ctx.lineTo(8, 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Borla dorada
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(7, -8.5);
        ctx.lineTo(9, -2);
        ctx.stroke();
        break;

      case 'rar_7': // Máscara Quirúrgica Antivirus
        ctx.save();
        ctx.translate(0, 4.5);
        ctx.fillStyle = '#7dd3fc';
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.3;
        this.traceRoundedBox(ctx, -9.5, -3.2, 19, 7.2, 2.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1, -1.6, 2, 4.2);
        ctx.fillRect(-2.1, -0.5, 4.2, 2);
        ctx.restore();
        break;

      case 'rar_8': {
        // Auriculares Gaming RGB
        const hue = Math.floor((timeMs * 0.14) % 360);
        this.drawHeadphones(ctx, '#1e293b', '#0f172a', `hsl(${hue}, 95%, 60%)`, false);
        break;
      }

      case 'rar_9': // Bandana de Hacker Callejero
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, 10.5, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Nudo lateral
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(-10.5, -1);
        ctx.lineTo(-16, -4);
        ctx.lineTo(-15, 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-4, -5.5, 8, 1.8);
        break;

      case 'rar_10': // Monóculo de Depuración
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.7;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.beginPath();
        ctx.arc(5, 0, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Cadenita
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(9.2, 1.5);
        ctx.quadraticCurveTo(11.5, 6, 8.5, 9.5);
        ctx.stroke();
        break;

      // ================= ÉPICAS (10) =================
      case 'epi_1': // Casco Ciberpunk de Neón
        ctx.save();
        ctx.translate(0, -4);
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#d946ef';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-13.5, 5);
        ctx.lineTo(-12, -8);
        ctx.lineTo(-5, -12.5);
        ctx.lineTo(5, -12.5);
        ctx.lineTo(12, -8);
        ctx.lineTo(13.5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Visor angular neón
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-9.5, -2.5, 19, 3.6);
        // Antena
        ctx.strokeStyle = '#f0abfc';
        ctx.beginPath();
        ctx.moveTo(11, -7);
        ctx.lineTo(13, -15);
        ctx.stroke();
        ctx.restore();
        break;

      case 'epi_2': // Máscara Oni Carmesí
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#450a0a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-10, -4);
        ctx.lineTo(10, -4);
        ctx.lineTo(8, 6);
        ctx.lineTo(0, 8.5);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Cuernos dorados + colmillos
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-12, -11);
        ctx.lineTo(-4, -4);
        ctx.moveTo(8, -4);
        ctx.lineTo(12, -11);
        ctx.lineTo(4, -4);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-6, -1.5, 4, 2);
        ctx.fillRect(2, -1.5, 4, 2);
        break;

      case 'epi_3': // Chistera Steampunk de Cobre
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(0, 1, 14.5, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(-8.5, -13, 17, 13.5);
        ctx.strokeRect(-8.5, -13, 17, 13.5);
        // Engranaje + mini gafas de bronce
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(-3.2, -4, 3.2, 0, Math.PI * 2);
        ctx.arc(3.5, -4, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(-3.2, -4, 1.7, 0, Math.PI * 2);
        ctx.arc(3.5, -4, 1.7, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'epi_4': // Corona de Fibra Óptica
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-11, 1);
        ctx.lineTo(-12, -10);
        ctx.lineTo(-5.5, -4);
        ctx.lineTo(0, -13);
        ctx.lineTo(5.5, -4);
        ctx.lineTo(12, -10);
        ctx.lineTo(11, 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#00ff88';
        for (const [px, py] of [[-12, -10], [0, -13], [12, -10]]) {
          ctx.beginPath();
          ctx.arc(px, py, 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        break;

      case 'epi_5': // Yelmo de Paladín del Firewall
        ctx.save();
        ctx.translate(0, -4);
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-12, 6);
        ctx.lineTo(-12, -8);
        ctx.quadraticCurveTo(0, -14, 12, -8);
        ctx.lineTo(12, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Rendija T dorada brillante
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-8, -3, 16, 3);
        ctx.fillRect(-2, -3, 4, 8);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-7, -2, 14, 1.4);
        ctx.restore();
        break;

      case 'epi_6': // Visor Táctico Francotirador
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(4, 0);
        ctx.stroke();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.5;
        this.traceRoundedBox(ctx, 1, -4.5, 9.5, 8, 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(5.8, -0.5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'epi_7': // Máscara de Peste Binaria
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-9, -4);
        ctx.lineTo(14, 2);
        ctx.lineTo(-7, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(-3, -1, 2.4, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'epi_8': // Turbante del Oráculo SQL
        ctx.fillStyle = '#6d28d9';
        ctx.strokeStyle = '#c4b5fd';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(0, -4, 12.5, 8.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#a78bfa';
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.quadraticCurveTo(0, -8, 10, -2);
        ctx.stroke();
        // Gema SQL brillante
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(3, -5);
        ctx.lineTo(0, -1);
        ctx.lineTo(-3, -5);
        ctx.closePath();
        ctx.fill();
        break;

      case 'epi_9': // Casco Espacial de Vacío
        ctx.save();
        ctx.translate(0, -3);
        ctx.fillStyle = '#f1f5f9';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -1, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        this.traceRoundedBox(ctx, -9.5, -5.5, 19, 9.5, 4.5);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.globalAlpha = 0.72;
        this.traceRoundedBox(ctx, -8.2, -4.4, 16.4, 7.2, 3.5);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
        break;

      case 'epi_10': // Capucha de Asesino Silencioso
        ctx.save();
        ctx.translate(0, -3);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.quadraticCurveTo(15, -8, 13.5, 7);
        ctx.lineTo(-13.5, 7);
        ctx.quadraticCurveTo(-15, -8, 0, -15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Ojos rojos rasgados dentro de la sombra
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(-6.5, -1, 4.2, 2);
        ctx.fillRect(2.3, -1, 4.2, 2);
        ctx.restore();
        break;

      // ================= LEGENDARIAS (10) =================
      case 'leg_1': // Corona del Rey Lich Digital
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-11, 1);
        ctx.lineTo(-13, -12);
        ctx.lineTo(-6.5, -6);
        ctx.lineTo(-3, -16);
        ctx.lineTo(0, -9);
        ctx.lineTo(3, -16);
        ctx.lineTo(6.5, -6);
        ctx.lineTo(13, -12);
        ctx.lineTo(11, 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(0, -3.5, 2.3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'leg_2': // Aureola de Superusuario Root
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(0, isIcon ? -2 : -5.5, 13, 4.2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, isIcon ? -2 : -5.5, 9, 2.5, Math.sin(t) * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'leg_3': // Yelmo Valquiria de Cobalto
        ctx.save();
        ctx.translate(0, isIcon ? -1 : -5);
        // Alas laterales blancas/plata
        ctx.fillStyle = '#e0f2fe';
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.3;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * 10, 0);
          ctx.lineTo(s * 18, -11);
          ctx.lineTo(s * 14, -2);
          ctx.lineTo(s * 11, 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath();
        ctx.arc(0, 1, 11, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;

      case 'leg_4': // Máscara Kitsune de Nueve Hilos
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-10, -4);
        ctx.lineTo(-10, -11); // oreja izq
        ctx.lineTo(-3, -5);
        ctx.lineTo(3, -5);
        ctx.lineTo(10, -11); // oreja der
        ctx.lineTo(10, -4);
        ctx.lineTo(0, 7.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Marcas rojas Kitsune
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-7, -1);
        ctx.lineTo(-3, 0);
        ctx.moveTo(7, -1);
        ctx.lineTo(3, 0);
        ctx.stroke();
        break;

      case 'leg_5': // Casco de Centurión Cuántico
        ctx.save();
        ctx.translate(0, isIcon ? 0 : -4);
        // Cresta carmesí superior
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, -8, 9.5, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 1, 11.5, Math.PI, 0);
        ctx.lineTo(11.5, 5);
        ctx.lineTo(-11.5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;

      case 'leg_6': // Sombrero del Arquitecto Matrix
        this.drawFedora(ctx, '#062014', '#00ff88', '#00ff88');
        break;

      case 'leg_7': {
        // Diadema de Singularidad
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-11, 0);
        ctx.quadraticCurveTo(0, -4, 11, 0);
        ctx.stroke();
        const orbX = Math.cos(t * 2) * 4;
        ctx.fillStyle = '#090d16';
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(orbX, -8.5, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'leg_8': // Cráneo de Dragón de Silicio
        ctx.save();
        ctx.translate(0, isIcon ? 0 : -7);
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-12, 2);
        ctx.lineTo(-6, -8);
        ctx.lineTo(-14, -14); // cuerno
        ctx.lineTo(-2, -9);
        ctx.lineTo(2, -9);
        ctx.lineTo(14, -14); // cuerno
        ctx.lineTo(6, -8);
        ctx.lineTo(12, 2);
        ctx.lineTo(0, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#10b981';
        ctx.fillRect(-6, -3, 3.5, 2.2);
        ctx.fillRect(2.5, -3, 3.5, 2.2);
        ctx.restore();
        break;

      case 'leg_9': // Visor del Viajero Temporal
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.6;
        this.traceRoundedBox(ctx, -11.5, -4, 23, 8, 3);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(4, 0, 2.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(4 + Math.cos(t * 3) * 2.2, Math.sin(t * 3) * 2.2);
        ctx.stroke();
        break;

      case 'leg_10': // Tiara del Dios Máquina
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-12, 1);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-4, -5);
        ctx.lineTo(0, -15);
        ctx.lineTo(4, -5);
        ctx.lineTo(10, -10);
        ctx.lineTo(12, 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(0, -4.5, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;

      // ================= MÍTICAS (10) =================
      case 'mit_1': // Gorro de Teemo
        ctx.fillStyle = '#84a93c';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, 11.5, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Pluma azul lateral
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.ellipse(-9, -9, 2.2, 5.5, -0.5, 0, Math.PI * 2);
        ctx.fill();
        // Gafas redondas amarillas en la frente
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#854d0e';
        ctx.beginPath();
        ctx.arc(-4.2, -3.5, 3.2, 0, Math.PI * 2);
        ctx.arc(4.2, -3.5, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'mit_2': // Gafas de Bubbles (pasta gruesa negra + lentes redondas grandes)
        this.drawGlasses(ctx, '#090d16', 'rgba(224, 242, 254, 0.75)', true, true);
        break;

      case 'mit_3': // Gorra de Ash
        this.drawCap(ctx, '#ef4444', '#b91c1c', '#f8fafc', '#10b981');
        break;

      case 'mit_4': // Máscara de Darth Vader
        ctx.save();
        ctx.translate(0, -3);
        ctx.fillStyle = '#090d16';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(11, -8);
        ctx.lineTo(15, 6.5);
        ctx.lineTo(6, 8.5);
        ctx.lineTo(-6, 8.5);
        ctx.lineTo(-15, 6.5);
        ctx.lineTo(-11, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Ojos + rejilla triangular
        ctx.fillStyle = '#334155';
        ctx.fillRect(-6.5, -2.5, 4.5, 2.5);
        ctx.fillRect(2, -2.5, 4.5, 2.5);
        ctx.strokeStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(0, 1);
        ctx.lineTo(-4.5, 6.5);
        ctx.lineTo(4.5, 6.5);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        break;

      case 'mit_5': // Casco de Iron Man
        ctx.save();
        ctx.translate(0, -3);
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, -2, 12.2, Math.PI, 0);
        ctx.lineTo(11.5, 7);
        ctx.lineTo(0, 9.5);
        ctx.lineTo(-11.5, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Placa facial dorada
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-7.5, -6.5);
        ctx.lineTo(-2.5, -6.5);
        ctx.lineTo(-1.5, -4);
        ctx.lineTo(1.5, -4);
        ctx.lineTo(2.5, -6.5);
        ctx.lineTo(7.5, -6.5);
        ctx.lineTo(7, 5);
        ctx.lineTo(0, 7.5);
        ctx.lineTo(-7, 5);
        ctx.closePath();
        ctx.fill();
        // Ojos brillantes cian
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-6.2, -1.2, 4.2, 2);
        ctx.fillRect(2, -1.2, 4.2, 2);
        ctx.restore();
        break;

      case 'mit_6': // Sombrero Seleccionador
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(0, 1, 15.5, 3.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-9.5, 1);
        ctx.lineTo(-5, -9);
        ctx.lineTo(3, -17);
        ctx.lineTo(9.5, 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Pliegues
        ctx.strokeStyle = '#451a03';
        ctx.beginPath();
        ctx.moveTo(-4, -5);
        ctx.lineTo(0, -3.5);
        ctx.lineTo(4, -5);
        ctx.stroke();
        break;

      case 'mit_7': // Máscara de Vendetta
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-9, -4);
        ctx.lineTo(9, -4);
        ctx.lineTo(7.5, 5);
        ctx.lineTo(0, 8.2);
        ctx.lineTo(-7.5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Bigote curvo característico
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-6, 1.5);
        ctx.quadraticCurveTo(0, 4.5, 6, 1.5);
        ctx.moveTo(0, 4);
        ctx.lineTo(0, 7.5);
        ctx.stroke();
        break;

      case 'mit_8': // Sombrero de Indiana Jones
        this.drawFedora(ctx, '#92400e', '#451a03');
        break;

      case 'mit_9': // Máscara de Jason
        ctx.fillStyle = '#fefce8';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(0, 0.5, 9.2, 7.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Ojos + triángulos rojos
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-3.6, -1, 1.6, 0, Math.PI * 2);
        ctx.arc(3.6, -1, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(0, -6.2);
        ctx.lineTo(-2, -3.2);
        ctx.lineTo(2, -3.2);
        ctx.closePath();
        ctx.fill();
        break;

      case 'mit_10': // Gafas de Heisenberg (Pork Pie negro + gafas rectangulares)
        ctx.save();
        ctx.translate(0, -10.5);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 1, 13.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(-7.8, -6.5, 15.6, 7.5);
        ctx.strokeRect(-7.8, -6.5, 15.6, 7.5);
        ctx.restore();
        // Gafas rectangulares con reflejo químico
        ctx.save();
        ctx.translate(0, -1.5);
        this.drawGlasses(ctx, '#1e293b', 'rgba(16, 185, 129, 0.42)', false, true);
        ctx.restore();
        break;

      case 'mit_casino': // Corona Real de Cripto-Magnate VIP
        ctx.save();
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-11, 2);
        ctx.lineTo(-12.5, -8.5);
        ctx.lineTo(-5.5, -3);
        ctx.lineTo(0, -11.5);
        ctx.lineTo(5.5, -3);
        ctx.lineTo(12.5, -8.5);
        ctx.lineTo(11, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Banda base esmeralda/púrpura VIP
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(-10.5, -0.5, 21, 2.8);
        // Gemas de plasma en las puntas
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(0, -5, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(-6.8, -2.5, 1.6, 0, Math.PI * 2);
        ctx.arc(6.8, -2.5, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, -12.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;

      default:
        this.drawCap(ctx, '#38bdf8', '#0284c7');
        break;
    }
  }
}
