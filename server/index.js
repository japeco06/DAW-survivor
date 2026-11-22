import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

const PORT = Number(process.env.PORT) || 3001;
const MAX_PLAYERS = 4;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SLOT_COLORS = [
  { color: '#00ff66', borderColor: '#bbf7d0' },
  { color: '#38bdf8', borderColor: '#bae6fd' },
  { color: '#f59e0b', borderColor: '#fde68a' },
  { color: '#ec4899', borderColor: '#fbcfe8' },
];

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  perMessageDeflate: false,
  httpCompression: false,
  pingInterval: 10000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6,
});

/** @type {Map<string, any>} */
const rooms = new Map();
/** @type {Map<string, string>} */
const socketToRoom = new Map();

function sanitizeText(raw, fallback, maxLen = 18) {
  if (typeof raw !== 'string') return fallback;
  const clean = raw.replace(/[<>&"']/g, '').trim().slice(0, maxLen);
  return clean.length > 0 ? clean : fallback;
}

function generateRoomCode() {
  for (let attempt = 0; attempt < 40; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return String(Date.now()).slice(-6);
}

function nextAvailableSlot(room) {
  const used = new Set(room.players.map((p) => p.slot));
  for (let s = 0; s < MAX_PLAYERS; s++) {
    if (!used.has(s)) return s;
  }
  return -1;
}

function serializeRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    mode: room.mode,
    isPublic: room.isPublic,
    maxPlayers: MAX_PLAYERS,
    worldSeed: room.worldSeed,
    players: room.players.map((p) => ({
      id: p.id,
      slot: p.slot,
      name: p.name,
      characterId: p.characterId,
      hatId: p.hatId,
      ready: p.ready,
      isHost: p.id === room.hostId,
      slotColor: SLOT_COLORS[p.slot]?.color || '#00ff66',
      slotBorder: SLOT_COLORS[p.slot]?.borderColor || '#ffffff',
    })),
  };
}

function getPublicRoomSummaries() {
  const list = [];
  for (const room of rooms.values()) {
    if (room.isPublic && room.status === 'LOBBY' && room.players.length < MAX_PLAYERS) {
      const host = room.players.find((p) => p.id === room.hostId) || room.players[0];
      list.push({
        code: room.code,
        hostName: host ? host.name : 'Host',
        count: room.players.length,
        maxPlayers: MAX_PLAYERS,
        mode: room.mode,
      });
    }
  }
  return list.slice(0, 12);
}

function removePlayerFromRoom(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return;
  socketToRoom.delete(socketId);

  const room = rooms.get(code);
  if (!room) return;

  const idx = room.players.findIndex((p) => p.id === socketId);
  if (idx === -1) return;
  const [removed] = room.players.splice(idx, 1);

  if (room.players.length === 0) {
    rooms.delete(code);
    return;
  }

  let hostChanged = false;
  if (room.hostId === socketId) {
    room.players.sort((a, b) => a.slot - b.slot);
    room.hostId = room.players[0].id;
    room.players[0].ready = true;
    hostChanged = true;
    if (room.status === 'IN_GAME') {
      room.status = 'LOBBY';
    }
  }

  room.updatedAt = Date.now();
  io.to(code).emit('room:update', serializeRoom(room));
  io.to(code).emit('room:player_left', {
    playerId: socketId,
    name: removed.name,
    newHostId: hostChanged ? room.hostId : null,
  });
}

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'daw-survivor-coop',
    version: '1.7.0',
    activeRooms: rooms.size,
    connectedPlayers: io.engine.clientsCount,
  });
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'daw-survivor-coop',
    version: '1.7.0',
    activeRooms: rooms.size,
    connectedPlayers: io.engine.clientsCount,
    uptimeSec: Math.round(process.uptime()),
  });
});

app.get('/rooms', (_req, res) => {
  res.json({ ok: true, rooms: getPublicRoomSummaries() });
});

io.on('connection', (socket) => {
  socket.on('ping:measure', (_ts, cb) => {
    if (typeof cb === 'function') cb(Date.now());
  });

  socket.on('room:list', (cb) => {
    if (typeof cb === 'function') {
      cb({ ok: true, rooms: getPublicRoomSummaries() });
    }
  });

  socket.on('room:create', (payload, cb) => {
    removePlayerFromRoom(socket.id);

    const code = generateRoomCode();
    const playerName = sanitizeText(payload?.name, 'Agente-1');
    const characterId = sanitizeText(payload?.characterId, 'STANDARD', 20);
    const hatId = typeof payload?.hatId === 'string' ? payload.hatId.slice(0, 24) : null;
    const mode = payload?.mode === 'NIGHTMARE' ? 'NIGHTMARE' : 'CLASSIC';
    const isPublic = payload?.isPublic !== false;

    const room = {
      code,
      hostId: socket.id,
      status: 'LOBBY',
      mode,
      isPublic,
      worldSeed: Math.floor(Math.random() * 0xffffffff) >>> 0,
      updatedAt: Date.now(),
      players: [
        {
          id: socket.id,
          slot: 0,
          name: playerName,
          characterId,
          hatId,
          ready: true,
        },
      ],
    };

    rooms.set(code, room);
    socketToRoom.set(socket.id, code);
    socket.join(code);

    const dto = serializeRoom(room);
    if (typeof cb === 'function') cb({ ok: true, room: dto });
    socket.emit('room:update', dto);
  });

  socket.on('room:join', (payload, cb) => {
    const rawCode = sanitizeText(payload?.code, '', 8).toUpperCase();
    const room = rooms.get(rawCode);
    if (!room) {
      if (typeof cb === 'function') cb({ ok: false, error: 'ROOM_NOT_FOUND' });
      return;
    }
    if (socketToRoom.get(socket.id) === rawCode) {
      if (typeof cb === 'function') cb({ ok: true, room: serializeRoom(room) });
      return;
    }
    if (room.status !== 'LOBBY') {
      if (typeof cb === 'function') cb({ ok: false, error: 'MATCH_ALREADY_STARTED' });
      return;
    }
    if (room.players.length >= MAX_PLAYERS) {
      if (typeof cb === 'function') cb({ ok: false, error: 'ROOM_FULL' });
      return;
    }

    removePlayerFromRoom(socket.id);

    const slot = nextAvailableSlot(room);
    if (slot === -1) {
      if (typeof cb === 'function') cb({ ok: false, error: 'ROOM_FULL' });
      return;
    }

    const playerName = sanitizeText(payload?.name, `Agente-${slot + 1}`);
    const characterId = sanitizeText(payload?.characterId, 'STANDARD', 20);
    const hatId = typeof payload?.hatId === 'string' ? payload.hatId.slice(0, 24) : null;

    room.players.push({
      id: socket.id,
      slot,
      name: playerName,
      characterId,
      hatId,
      ready: false,
    });
    room.updatedAt = Date.now();

    socketToRoom.set(socket.id, rawCode);
    socket.join(rawCode);

    const dto = serializeRoom(room);
    if (typeof cb === 'function') cb({ ok: true, room: dto });
    io.to(rawCode).emit('room:update', dto);
  });

  socket.on('room:leave', (cb) => {
    const code = socketToRoom.get(socket.id);
    if (code) {
      socket.leave(code);
      removePlayerFromRoom(socket.id);
    }
    if (typeof cb === 'function') cb({ ok: true });
  });

  socket.on('room:update_loadout', (payload) => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room || room.status !== 'LOBBY') return;

    const member = room.players.find((p) => p.id === socket.id);
    if (!member) return;

    if (typeof payload?.name === 'string') {
      member.name = sanitizeText(payload.name, member.name);
    }
    if (typeof payload?.characterId === 'string') {
      member.characterId = sanitizeText(payload.characterId, member.characterId, 20);
    }
    if (payload && 'hatId' in payload) {
      member.hatId = typeof payload.hatId === 'string' ? payload.hatId.slice(0, 24) : null;
    }

    room.updatedAt = Date.now();
    io.to(code).emit('room:update', serializeRoom(room));
  });

  socket.on('room:toggle_ready', (payload) => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room || room.status !== 'LOBBY') return;

    const member = room.players.find((p) => p.id === socket.id);
    if (!member) return;

    member.ready = typeof payload?.ready === 'boolean' ? payload.ready : !member.ready;
    room.updatedAt = Date.now();
    io.to(code).emit('room:update', serializeRoom(room));
  });

  socket.on('room:set_mode', (payload) => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room || room.hostId !== socket.id || room.status !== 'LOBBY') return;

    room.mode = payload?.mode === 'NIGHTMARE' ? 'NIGHTMARE' : 'CLASSIC';
    room.updatedAt = Date.now();
    io.to(code).emit('room:update', serializeRoom(room));
  });

  socket.on('room:start', (cb) => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room) {
      if (typeof cb === 'function') cb({ ok: false, error: 'ROOM_NOT_FOUND' });
      return;
    }
    if (room.hostId !== socket.id) {
      if (typeof cb === 'function') cb({ ok: false, error: 'NOT_HOST' });
      return;
    }
    if (room.status !== 'LOBBY') {
      if (typeof cb === 'function') cb({ ok: false, error: 'ALREADY_IN_GAME' });
      return;
    }

    room.status = 'IN_GAME';
    room.worldSeed = Math.floor(Math.random() * 0xffffffff) >>> 0;
    room.updatedAt = Date.now();

    const dto = serializeRoom(room);
    io.to(code).emit('room:started', dto);
    if (typeof cb === 'function') cb({ ok: true, room: dto });
  });

  // Guest -> Host: Movimiento y dirección en tiempo real
  socket.on('game:input', (payload) => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room || room.status !== 'IN_GAME' || room.hostId === socket.id) return;

    const rawX = Number(payload?.moveX);
    const rawY = Number(payload?.moveY);
    const rawAngle = Number(payload?.facingAngle);
    const rawSeq = Number(payload?.seq);
    const moveX = Number.isFinite(rawX) ? Math.max(-1, Math.min(1, rawX)) : 0;
    const moveY = Number.isFinite(rawY) ? Math.max(-1, Math.min(1, rawY)) : 0;
    const facingAngle = Number.isFinite(rawAngle) ? rawAngle : 0;
    const seq = Number.isFinite(rawSeq) && rawSeq >= 0 ? Math.floor(rawSeq) : 0;

    io.to(room.hostId).emit('game:peer_input', {
      playerId: socket.id,
      moveX,
      moveY,
      facingAngle,
      isMoving: Boolean(payload?.isMoving),
      seq,
      ult: Boolean(payload?.ult),
      dash: Boolean(payload?.dash),
    });
  });

  // Host -> Guests: Estado del mundo (20 Hz)
  socket.on('game:snapshot', (snapshot) => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room || room.hostId !== socket.id || room.status !== 'IN_GAME') return;

    room.updatedAt = Date.now();
    socket.to(code).volatile.emit('game:snapshot', snapshot);
  });

  // Host -> Sala: Evento de subida de nivel sincronizado + opciones personalizadas
  socket.on('game:level_up', (payload) => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room || room.hostId !== socket.id) return;
    socket.to(code).emit('game:level_up', payload);
  });

  // Guest -> Host: Elección de carta o petición de Reroll
  socket.on('game:pick_upgrade', (payload) => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room) return;
    io.to(room.hostId).emit('game:peer_pick_upgrade', {
      playerId: socket.id,
      index: Number(payload?.index) || 0,
    });
  });

  socket.on('game:reroll_request', () => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room) return;
    io.to(room.hostId).emit('game:peer_reroll_request', {
      playerId: socket.id,
    });
  });

  socket.on('game:reroll_result', (payload) => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room || room.hostId !== socket.id || !payload?.targetId) return;
    if (!room.players.some((p) => p.id === payload.targetId)) return;
    io.to(payload.targetId).emit('game:reroll_result', payload);
  });

  socket.on('game:upgrade_status', (payload) => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room || room.hostId !== socket.id) return;
    socket.to(code).emit('game:upgrade_status', payload);
  });

  socket.on('game:resume_from_upgrade', () => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room || room.hostId !== socket.id) return;
    socket.to(code).emit('game:resume_from_upgrade');
  });

  socket.on('game:event', (payload) => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room || room.hostId !== socket.id) return;
    socket.to(code).emit('game:event', payload);
  });

  socket.on('game:return_lobby', () => {
    const code = socketToRoom.get(socket.id);
    const room = code ? rooms.get(code) : null;
    if (!room || room.hostId !== socket.id) return;

    room.status = 'LOBBY';
    for (const p of room.players) {
      p.ready = p.id === room.hostId;
    }
    room.updatedAt = Date.now();
    io.to(code).emit('room:returned_lobby', serializeRoom(room));
  });

  socket.on('disconnect', () => {
    removePlayerFromRoom(socket.id);
  });
});

// Limpieza periódica de salas abandonadas (> 2 horas inactivas)
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (room.updatedAt < cutoff || room.players.length === 0) {
      for (const p of room.players) {
        if (socketToRoom.get(p.id) === code) {
          socketToRoom.delete(p.id);
        }
      }
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000);

httpServer.listen(PORT, () => {
  console.log(`[DAW-survivor Co-op] Socket.io server listening on port ${PORT}`);
});
