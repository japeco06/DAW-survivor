import { Player } from '../entities/Player';
import { MetaSystem } from '../systems/MetaSystem';
import { i18n } from '../utils/i18n';
import type { MultiplayerClient } from './MultiplayerClient';
import type { RoomStateDTO } from './MultiplayerTypes';

export type CoopButtonAction =
  | 'CLOSE'
  | 'SET_URL'
  | 'CREATE_PUBLIC'
  | 'CREATE_PRIVATE'
  | 'JOIN_CODE'
  | 'REFRESH_ROOMS'
  | 'TOGGLE_READY'
  | 'START_MATCH'
  | 'COPY_CODE'
  | 'TOGGLE_MODE'
  | 'LEAVE_ROOM'
  | `JOIN_PUBLIC:${string}`;

export interface CoopButtonRect {
  action: CoopButtonAction;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  disabled?: boolean;
}

const FONT_DISPLAY = '"Segoe UI", "Inter", system-ui, -apple-system, sans-serif';
const FONT_MONO = '"JetBrains Mono", Consolas, monospace';

/**
 * Renderizador e hit-tester del Modal Multijugador Co-op Online (4 jugadores).
 */
export class CoopLobbyUI {
  public static readonly PANEL_W = 1040;
  public static readonly PANEL_H = 620;

  public static getLayout(logicalW: number, logicalH: number) {
    const cx = logicalW / 2;
    const cy = logicalH / 2;
    const px = cx - this.PANEL_W / 2;
    const py = cy - this.PANEL_H / 2;
    return { cx, cy, px, py, pw: this.PANEL_W, ph: this.PANEL_H };
  }

  public static getButtons(
    logicalW: number,
    logicalH: number,
    mp: MultiplayerClient
  ): CoopButtonRect[] {
    const { cx, px, py, pw, ph } = this.getLayout(logicalW, logicalH);
    const buttons: CoopButtonRect[] = [];

    // Botón superior derecha para cambiar/pegar URL del servidor Render
    buttons.push({
      action: 'SET_URL',
      label: `⚙ ${i18n.t('URL RENDER', 'RENDER URL')}`,
      x: px + pw - 214,
      y: py + 18,
      width: 150,
      height: 34,
      color: '#38bdf8',
    });

    // Botón X cerrar modal (mantiene sala si ya estás dentro)
    buttons.push({
      action: 'CLOSE',
      label: '✕',
      x: px + pw - 52,
      y: py + 18,
      width: 34,
      height: 34,
      color: '#f43f5e',
    });

    if (!mp.isInRoom) {
      const colLeftX = px + 36;
      const colLeftW = 380;
      buttons.push({
        action: 'CREATE_PUBLIC',
        label: `▸ ${i18n.t('CREAR SALA PÚBLICA (4P)', 'CREATE PUBLIC ROOM (4P)')}`,
        x: colLeftX,
        y: py + 150,
        width: colLeftW,
        height: 52,
        color: '#10b981',
      });
      buttons.push({
        action: 'CREATE_PRIVATE',
        label: `🔒 ${i18n.t('CREAR SALA PRIVADA (CÓDIGO)', 'CREATE PRIVATE ROOM')}`,
        x: colLeftX,
        y: py + 216,
        width: colLeftW,
        height: 48,
        color: '#38bdf8',
      });
      buttons.push({
        action: 'JOIN_CODE',
        label: `🔑 ${i18n.t('UNIRSE POR CÓDIGO', 'JOIN BY CODE')}`,
        x: colLeftX,
        y: py + 278,
        width: colLeftW,
        height: 48,
        color: '#fbbf24',
      });

      buttons.push({
        action: 'REFRESH_ROOMS',
        label: `↻ ${i18n.t('REFRESCAR', 'REFRESH')}`,
        x: px + pw - 170,
        y: py + 148,
        width: 134,
        height: 32,
        color: '#38bdf8',
      });

      const listX = px + 448;
      const listW = pw - 484;
      const maxRows = Math.min(5, mp.publicRooms.length);
      for (let i = 0; i < maxRows; i++) {
        const r = mp.publicRooms[i];
        const rowY = py + 194 + i * 62;
        buttons.push({
          action: `JOIN_PUBLIC:${r.code}`,
          label: i18n.t('UNIRSE', 'JOIN'),
          x: listX + listW - 116,
          y: rowY + 10,
          width: 102,
          height: 34,
          color: '#10b981',
        });
      }

      buttons.push({
        action: 'CLOSE',
        label: `[ESC] ${i18n.t('VOLVER AL HANGAR', 'BACK TO HANGAR')}`,
        x: cx - 150,
        y: py + ph - 58,
        width: 300,
        height: 40,
        color: '#64748b',
      });
      return buttons;
    }

    const room = mp.room!;
    buttons.push({
      action: 'COPY_CODE',
      label: `📋 ${i18n.t('COPIAR CÓDIGO', 'COPY CODE')}: ${room.code}`,
      x: px + 36,
      y: py + 126,
      width: 240,
      height: 36,
      color: '#fbbf24',
    });

    if (mp.isHost) {
      buttons.push({
        action: 'TOGGLE_MODE',
        label:
          room.mode === 'NIGHTMARE'
            ? `💀 ${i18n.t('MODO: PESADILLA', 'MODE: NIGHTMARE')}`
            : `🛡 ${i18n.t('MODO: CLÁSICO', 'MODE: CLASSIC')}`,
        x: px + 292,
        y: py + 126,
        width: 230,
        height: 36,
        color: room.mode === 'NIGHTMARE' ? '#f43f5e' : '#38bdf8',
      });
    }

    if (mp.isHost) {
      buttons.push({
        action: 'START_MATCH',
        label: `▸ ${i18n.t('INICIAR PARTIDA CO-OP', 'START CO-OP MATCH')} (${room.players.length}/4)`,
        x: cx - 220,
        y: py + ph - 66,
        width: 310,
        height: 44,
        color: '#10b981',
      });
    } else {
      const me = room.players.find((p) => p.id === mp.myId);
      const isReady = Boolean(me?.ready);
      buttons.push({
        action: 'TOGGLE_READY',
        label: isReady
          ? `✓ ${i18n.t('LISTO (CANCELAR)', 'READY (CANCEL)')}`
          : `○ ${i18n.t('MARCAR LISTO', 'MARK READY')}`,
        x: cx - 220,
        y: py + ph - 66,
        width: 310,
        height: 44,
        color: isReady ? '#10b981' : '#fbbf24',
      });
    }

    buttons.push({
      action: 'LEAVE_ROOM',
      label: `✕ ${i18n.t('SALIR DE SALA', 'LEAVE ROOM')}`,
      x: cx + 106,
      y: py + ph - 66,
      width: 196,
      height: 44,
      color: '#f43f5e',
    });

    return buttons;
  }

  public static draw(
    ctx: CanvasRenderingContext2D,
    logicalW: number,
    logicalH: number,
    mp: MultiplayerClient,
    metaSystem: MetaSystem,
    hoveredAction: CoopButtonAction | null,
    feedbackMsg: string
  ): void {
    const { cx, px, py, pw, ph } = this.getLayout(logicalW, logicalH);
    const now = performance.now();

    ctx.save();
    ctx.fillStyle = 'rgba(5, 9, 18, 0.9)';
    ctx.fillRect(0, 0, logicalW, logicalH);

    // Panel principal
    ctx.fillStyle = 'rgba(11, 19, 34, 0.98)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    this.tracePanel(ctx, px, py, pw, ph, 14);
    ctx.fill();
    ctx.stroke();

    // Título
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold 24px ${FONT_DISPLAY}`;
    ctx.fillText(
      i18n.t('MULTIJUGADOR CO-OP ONLINE // ESCUADRÓN 4P', 'ONLINE CO-OP MULTIPLAYER // 4P SQUAD'),
      px + 34,
      py + 44
    );

    // Estado de conexión + URL Render
    const statusColor =
      mp.status === 'CONNECTED'
        ? '#10b981'
        : mp.status === 'CONNECTING'
        ? '#fbbf24'
        : '#f43f5e';
    const statusLabel =
      mp.status === 'CONNECTED'
        ? `● ${i18n.t('SERVIDOR CONECTADO', 'SERVER ONLINE')} (${mp.latencyMs || '—'} ms)`
        : mp.status === 'CONNECTING'
        ? `◐ ${i18n.t('DESPERTANDO SERVIDOR RENDER...', 'WAKING RENDER SERVER...')}`
        : mp.serverUrl
        ? `○ ${i18n.t('LISTO PARA CONECTAR', 'READY TO CONNECT')}`
        : `○ ${i18n.t('SIN URL DE RENDER CONFIGURADA', 'NO RENDER URL SET')}`;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.2;
    this.tracePanel(ctx, px + 34, py + 62, pw - 68, 44, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = statusColor;
    ctx.font = `bold 12.5px ${FONT_MONO}`;
    ctx.fillText(statusLabel, px + 50, py + 89);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = `11.5px ${FONT_MONO}`;
    const urlText = mp.serverUrl || i18n.t('Pulsa [URL RENDER] arriba para pegar tu enlace', 'Click [RENDER URL] to paste server link');
    ctx.fillText(urlText, px + pw - 50, py + 89, 490);

    if (!mp.isInRoom) {
      this.drawJoinCreateView(ctx, px, py, pw, mp, now);
    } else {
      this.drawRoomLobbyView(ctx, px, py, pw, mp.room!, metaSystem, mp.myId, now);
    }

    if (feedbackMsg) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a';
      ctx.font = `bold 12.5px ${FONT_MONO}`;
      ctx.fillText(feedbackMsg, cx, py + ph - 82, pw - 90);
    }

    // Dibujar botones
    const buttons = this.getButtons(logicalW, logicalH, mp);
    for (const btn of buttons) {
      const hovered = hoveredAction === btn.action;
      ctx.save();
      ctx.fillStyle = hovered ? 'rgba(24, 42, 68, 0.98)' : 'rgba(14, 24, 42, 0.95)';
      ctx.strokeStyle = hovered ? '#ffffff' : btn.color;
      ctx.lineWidth = hovered ? 2.2 : 1.5;
      this.tracePanel(ctx, btn.x, btn.y, btn.width, btn.height, 8);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = hovered ? '#ffffff' : btn.color;
      ctx.font = `bold 12.5px ${FONT_DISPLAY}`;
      ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2 + 4.5, btn.width - 14);
      ctx.restore();
    }

    ctx.restore();
  }

  private static drawJoinCreateView(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    pw: number,
    mp: MultiplayerClient,
    _now: number
  ): void {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7dd3fc';
    ctx.font = `bold 13px ${FONT_MONO}`;
    ctx.fillText(i18n.t('// CREAR O UNIRSE', '// CREATE OR JOIN'), px + 38, py + 134);

    // Caja explicativa izquierda abajo
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
    ctx.lineWidth = 1.1;
    this.tracePanel(ctx, px + 36, py + 344, 380, 156, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `12px ${FONT_DISPLAY}`;
    const tips =
      i18n.currentLang === 'EN'
        ? [
            '• Up to 4 players share XP, Bosses & CryptoCoins.',
            '• Your equipped Agent, Passives & Hat carry over!',
            '• Downed allies drop a Rescue Pod (stand near 3s).',
            '• Free Render servers may take ~20s on first wake.',
          ]
        : [
            '• Hasta 4 jugadores comparten XP, Jefes y Cripto.',
            '• ¡Conservas tu Agente, Pasivas y Sombrero actual!',
            '• Si caes, tus aliados pueden reanimarte en 3 s.',
            '• Render gratuito puede tardar ~20 s al despertar.',
          ];
    for (let i = 0; i < tips.length; i++) {
      ctx.fillText(tips[i], px + 52, py + 374 + i * 28, 350);
    }

    // Panel derecho: Salas públicas
    const listX = px + 448;
    const listW = pw - 484;
    ctx.fillStyle = '#7dd3fc';
    ctx.font = `bold 13px ${FONT_MONO}`;
    ctx.fillText(
      i18n.t(`// SALAS PÚBLICAS (${mp.publicRooms.length})`, `// PUBLIC ROOMS (${mp.publicRooms.length})`),
      listX,
      py + 134
    );

    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
    ctx.lineWidth = 1.2;
    this.tracePanel(ctx, listX, py + 186, listW, 314, 10);
    ctx.fill();
    ctx.stroke();

    if (mp.publicRooms.length === 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = `13px ${FONT_MONO}`;
      ctx.fillText(
        i18n.t('No hay salas públicas ahora. ¡Crea una!', 'No public rooms yet. Create one!'),
        listX + listW / 2,
        py + 346
      );
      return;
    }

    const maxRows = Math.min(5, mp.publicRooms.length);
    for (let i = 0; i < maxRows; i++) {
      const r = mp.publicRooms[i];
      const ry = py + 194 + i * 62;
      ctx.fillStyle = 'rgba(11, 19, 34, 0.94)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      this.tracePanel(ctx, listX + 10, ry, listW - 20, 54, 8);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#fbbf24';
      ctx.font = `bold 13.5px ${FONT_MONO}`;
      ctx.fillText(`#${r.code}`, listX + 24, ry + 24);

      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold 13px ${FONT_DISPLAY}`;
      ctx.fillText(`Host: ${r.hostName}`, listX + 94, ry + 24, 210);

      ctx.fillStyle = r.mode === 'NIGHTMARE' ? '#fb7185' : '#38bdf8';
      ctx.font = `bold 11.5px ${FONT_MONO}`;
      ctx.fillText(`${r.count}/${r.maxPlayers}  •  ${r.mode}`, listX + 24, ry + 42);
    }
  }

  private static drawRoomLobbyView(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    pw: number,
    room: RoomStateDTO,
    metaSystem: MetaSystem,
    myId: string,
    now: number
  ): void {
    // Cartas de los 4 slots del escuadrón
    const cardW = 224;
    const cardH = 316;
    const gap = 20;
    const startX = px + (pw - (cardW * 4 + gap * 3)) / 2;
    const cardY = py + 186;

    for (let slot = 0; slot < 4; slot++) {
      const cx = startX + slot * (cardW + gap);
      const member = room.players.find((p) => p.slot === slot);
      const isMe = member?.id === myId;

      ctx.save();
      ctx.fillStyle = member ? 'rgba(15, 24, 42, 0.95)' : 'rgba(11, 17, 30, 0.65)';
      ctx.strokeStyle = member
        ? isMe
          ? '#fbbf24'
          : member.slotColor
        : 'rgba(100, 116, 139, 0.3)';
      ctx.lineWidth = isMe ? 2.2 : 1.5;
      this.tracePanel(ctx, cx, cardY, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = `bold 11.5px ${FONT_MONO}`;
      ctx.fillStyle = member ? member.slotColor : '#475569';
      const slotTag = member?.isHost ? `J${slot + 1} [HOST]` : `J${slot + 1}`;
      ctx.fillText(slotTag, cx + cardW / 2, cardY + 26);

      if (!member) {
        ctx.fillStyle = '#475569';
        ctx.font = `bold 13px ${FONT_MONO}`;
        ctx.fillText(i18n.t('[ RANURA LIBRE ]', '[ OPEN SLOT ]'), cx + cardW / 2, cardY + cardH / 2);
        ctx.restore();
        continue;
      }

      const profile = metaSystem.characters[member.characterId] || metaSystem.characters.STANDARD;

      // Preview cyber-bot completo con su sombrero equipado
      Player.drawCyberChassis(
        ctx,
        cx + cardW / 2,
        cardY + 108,
        58,
        member.slotColor,
        member.slotBorder,
        now,
        0,
        true,
        member.hatId,
        profile.id
      );

      ctx.fillStyle = isMe ? '#fef08a' : '#f8fafc';
      ctx.font = `bold 14.5px ${FONT_DISPLAY}`;
      ctx.fillText(member.name + (isMe ? ' (TÚ)' : ''), cx + cardW / 2, cardY + 186, cardW - 20);

      ctx.fillStyle = '#7dd3fc';
      ctx.font = `bold 11.5px ${FONT_DISPLAY}`;
      ctx.fillText(i18n.currentLang === 'EN' ? (profile.nameEn || profile.name) : profile.name, cx + cardW / 2, cardY + 210, cardW - 20);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `10.5px ${FONT_MONO}`;
      ctx.fillText(
        i18n.currentLang === 'EN' ? (profile.passiveNameEn || profile.passiveName) : profile.passiveName,
        cx + cardW / 2,
        cardY + 232,
        cardW - 20
      );

      // Píldora LISTO / ESPERANDO
      const readyColor = member.ready ? '#10b981' : '#f59e0b';
      ctx.fillStyle = member.ready ? 'rgba(6, 78, 59, 0.85)' : 'rgba(69, 26, 3, 0.85)';
      ctx.strokeStyle = readyColor;
      ctx.lineWidth = 1.2;
      this.tracePanel(ctx, cx + 32, cardY + cardH - 50, cardW - 64, 30, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = readyColor;
      ctx.font = `bold 11.5px ${FONT_MONO}`;
      ctx.fillText(
        member.ready ? i18n.t('✓ LISTO', '✓ READY') : i18n.t('⏳ ESPERANDO', '⏳ WAITING'),
        cx + cardW / 2,
        cardY + cardH - 30
      );

      ctx.restore();
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = `11.5px ${FONT_MONO}`;
    ctx.fillText(
      i18n.t(
        'Cierra [✕] para cambiar Agente/Sombrero sin salir de la sala',
        'Close [✕] anytime to swap Agent/Hat without leaving room'
      ),
      px + pw - 36,
      py + 148,
      pw - 568
    );
  }

  private static tracePanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.lineTo(x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.lineTo(x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.lineTo(x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.closePath();
  }
}
