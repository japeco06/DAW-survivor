import { MetaSystem } from './MetaSystem';
import { SoundSystem } from '../core/SoundSystem';
import { HatRenderer } from '../utils/HatRenderer';
import { i18n } from '../utils/i18n';

export type CasinoGameId = 'SLOTS' | 'CRASH' | 'MINES' | 'WHEEL';

export type SlotSymbolId =
  | 'CHERRY'
  | 'LEMON'
  | 'BELL'
  | 'GEM'
  | 'SEVEN'
  | 'WILD'
  | 'SCATTER'
  | 'CROWN';

interface SlotSymbolDef {
  id: SlotSymbolId;
  name: string;
  nameEn: string;
  badge: string;
  color: string;
  secondaryColor: string;
  bg: string;
  weight: number;
  pay3: number;
  pay4: number;
  pay5: number;
}

interface WinningLineResult {
  lineIndex: number;
  symbol: SlotSymbolId;
  count: number;
  wildMultiplier: number;
  payout: number;
  cells: [number, number][]; // [col, row]
  color: string;
}

interface CasinoHistoryEntry {
  game: CasinoGameId;
  label: string;
  netDelta: number;
  multText: string;
  isBigWin: boolean;
}

interface RoulettePocket {
  num: number;
  colorGroup: 'RED' | 'BLACK' | 'GREEN';
  color: string;
  colorDark: string;
}

type RouletteBetType =
  | 'STRAIGHT'
  | 'RED'
  | 'BLACK'
  | 'EVEN'
  | 'ODD'
  | 'LOW_6'
  | 'MID_6'
  | 'HIGH_6';

interface CasinoCoinParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  spin: number;
  spinSpeed: number;
  isCoin: boolean;
}

const FONT_DISPLAY = '"Segoe UI", "Inter", system-ui, -apple-system, sans-serif';
const FONT_MONO = '"JetBrains Mono", Consolas, monospace';
const CASINO_JACKPOT_STORAGE_KEY = 'daw_survivor_casino_jackpot_v1';

const SLOT_SYMBOLS: SlotSymbolDef[] = [
  {
    id: 'CHERRY',
    name: 'Bit-Cherry',
    nameEn: 'Bit-Cherry',
    badge: 'CHERRY',
    color: '#fb7185',
    secondaryColor: '#e11d48',
    bg: 'rgba(68, 8, 28, 0.92)',
    weight: 26,
    pay3: 1.2,
    pay4: 3.5,
    pay5: 10,
  },
  {
    id: 'LEMON',
    name: 'Neon-Citrus',
    nameEn: 'Neon-Citrus',
    badge: 'CITRUS',
    color: '#facc15',
    secondaryColor: '#ca8a04',
    bg: 'rgba(58, 32, 6, 0.92)',
    weight: 23,
    pay3: 1.6,
    pay4: 4.5,
    pay5: 14,
  },
  {
    id: 'BELL',
    name: 'Cyber-Bell',
    nameEn: 'Cyber-Bell',
    badge: 'BELL',
    color: '#fb923c',
    secondaryColor: '#ea580c',
    bg: 'rgba(64, 22, 7, 0.92)',
    weight: 18,
    pay3: 2.5,
    pay4: 7.5,
    pay5: 22,
  },
  {
    id: 'GEM',
    name: 'Ether-Gem',
    nameEn: 'Ether-Gem',
    badge: 'ETHER',
    color: '#38bdf8',
    secondaryColor: '#0284c7',
    bg: 'rgba(10, 42, 74, 0.94)',
    weight: 13,
    pay3: 4.0,
    pay4: 12,
    pay5: 40,
  },
  {
    id: 'SEVEN',
    name: 'Lucky-777',
    nameEn: 'Lucky-777',
    badge: '777',
    color: '#f43f5e',
    secondaryColor: '#fbbf24',
    bg: 'rgba(82, 10, 32, 0.95)',
    weight: 8,
    pay3: 8.0,
    pay4: 25,
    pay5: 90,
  },
  {
    id: 'WILD',
    name: 'Kernel Wild',
    nameEn: 'Kernel Wild',
    badge: 'WILD',
    color: '#10b981',
    secondaryColor: '#34d399',
    bg: 'rgba(6, 58, 42, 0.96)',
    weight: 5,
    pay3: 10,
    pay4: 30,
    pay5: 110,
  },
  {
    id: 'SCATTER',
    name: 'Vault FreeSpins',
    nameEn: 'Vault FreeSpins',
    badge: 'SCATTER',
    color: '#c084fc',
    secondaryColor: '#9333ea',
    bg: 'rgba(46, 16, 101, 0.96)',
    weight: 4,
    pay3: 3,
    pay4: 12,
    pay5: 45,
  },
  {
    id: 'CROWN',
    name: 'Corona Jackpot',
    nameEn: 'Jackpot Crown',
    badge: 'JACKPOT',
    color: '#fbbf24',
    secondaryColor: '#f59e0b',
    bg: 'rgba(78, 38, 4, 0.97)',
    weight: 3,
    pay3: 15,
    pay4: 50,
    pay5: 250,
  },
];

// 9 Líneas de pago clásicas de Video Slot 5x3 (índices de fila 0..2 por cada columna 0..4)
const PAYLINES_5X3: { rows: [number, number, number, number, number]; color: string }[] = [
  { rows: [1, 1, 1, 1, 1], color: '#10b981' }, // 1. Central horizontal
  { rows: [0, 0, 0, 0, 0], color: '#38bdf8' }, // 2. Superior horizontal
  { rows: [2, 2, 2, 2, 2], color: '#f43f5e' }, // 3. Inferior horizontal
  { rows: [0, 1, 2, 1, 0], color: '#fbbf24' }, // 4. V diagonal
  { rows: [2, 1, 0, 1, 2], color: '#c084fc' }, // 5. V invertida
  { rows: [0, 0, 1, 2, 2], color: '#fb923c' }, // 6. Escalón descendente
  { rows: [2, 2, 1, 0, 0], color: '#2dd4bf' }, // 7. Escalón ascendente
  { rows: [1, 0, 1, 2, 1], color: '#e879f9' }, // 8. Zigzag superior
  { rows: [1, 2, 1, 0, 1], color: '#a3e635' }, // 9. Zigzag inferior
];

// Orden europeo cibernético de 19 casillas (0 verde + 1..18 alternando Rojo/Negro)
const ROULETTE_RED_NUMS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18]);
const ROULETTE_WHEEL_ORDER: number[] = [
  0, 1, 10, 3, 15, 12, 4, 18, 6, 7, 13, 16, 2, 9, 11, 14, 8, 5, 17,
];
const ROULETTE_POCKETS: RoulettePocket[] = ROULETTE_WHEEL_ORDER.map((num) => {
  if (num === 0) {
    return { num: 0, colorGroup: 'GREEN', color: '#10b981', colorDark: '#064e3b' };
  }
  if (ROULETTE_RED_NUMS.has(num)) {
    return { num, colorGroup: 'RED', color: '#e11d48', colorDark: '#881337' };
  }
  return { num, colorGroup: 'BLACK', color: '#1e293b', colorDark: '#090d16' };
});

export class CasinoSystem {
  public activeGame: CasinoGameId = 'SLOTS';
  public currentBet: number = 20;
  public progressiveJackpot: number = 500;
  public statusBanner: string = '';
  public statusColor: string = '#fbbf24';

  // Estadísticas de sesión y sistema de partículas del Casino
  public sessionPlays: number = 0;
  public sessionNetProfit: number = 0;
  public sessionBiggestWin: number = 0;
  public history: CasinoHistoryEntry[] = [];
  private faucetCooldown: number = 0;
  private particles: CasinoCoinParticle[] = [];
  private lastLayoutCx: number = 640;
  private lastLayoutCy: number = 460;

  // ==========================================
  // 1. ESTADO DE CYBER-SLOTS DELUXE (5x3)
  // ==========================================
  public slotGrid: SlotSymbolId[][] = [
    ['SEVEN', 'GEM', 'CHERRY'],
    ['WILD', 'CROWN', 'LEMON'],
    ['BELL', 'CROWN', 'GEM'],
    ['SCATTER', 'CROWN', 'BELL'],
    ['SEVEN', 'WILD', 'CHERRY'],
  ];
  public slotWildMultipliers: number[][] = [
    [1, 1, 1],
    [2, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
    [1, 3, 1],
  ];
  public reelSpinTimers: number[] = [0, 0, 0, 0, 0];
  public reelScrollOffsets: number[] = [0, 0, 0, 0, 0];
  public isSlotSpinning: boolean = false;
  public slotTurboMode: boolean = false;
  public slotAutoSpin: boolean = false;
  private slotAutoSpinDelay: number = 0;
  public freeSpinsRemaining: number = 0;
  public freeSpinsMultiplier: number = 1;
  public lastSlotWinAmount: number = 0;
  public winningLines: WinningLineResult[] = [];
  public gambleAvailable: boolean = false;
  public gambleStreak: number = 0;
  private slotWinPulseTimer: number = 0;

  // ==========================================
  // 2. ESTADO DE CRIPTO-CRASH ($DAW)
  // ==========================================
  public crashState: 'IDLE' | 'FLYING' | 'CRASHED' = 'IDLE';
  public crashMultiplier: number = 1.0;
  private crashTargetPoint: number = 1.0;
  private crashElapsed: number = 0;
  public crashCashedOut: boolean = false;
  public crashCashoutMult: number = 0;
  public crashWinAmount: number = 0;
  public crashAutoCashout: number = 0;
  public crashHistory: number[] = [1.42, 3.85, 1.12, 8.64, 2.15, 1.04, 5.3, 1.78, 14.2, 2.05];
  private crashActiveBet: number = 20;

  // ==========================================
  // 3. ESTADO DE FIREWALL MINES (5x5)
  // ==========================================
  public minesCount: number = 3;
  public minesState: 'IDLE' | 'PLAYING' | 'BUSTED' | 'CASHED' = 'IDLE';
  public minesBoard: boolean[] = Array(25).fill(false);
  public minesRevealed: boolean[] = Array(25).fill(false);
  public minesSafeOpened: number = 0;
  public minesCurrentMult: number = 1.0;
  private minesActiveBet: number = 20;

  // ==========================================
  // 4. ESTADO DE RULETA EUROPEA NEÓN (0-18 + BOLA FÍSICA)
  // ==========================================
  public wheelAngle: number = 0;
  public wheelVelocity: number = 0;
  public isWheelSpinning: boolean = false;
  public rouletteBetType: RouletteBetType = 'RED';
  public rouletteStraightNum: number = 7;
  private wheelActiveBet: number = 20;
  private wheelSpinElapsed: number = 0;
  private wheelSpinDuration: number = 3.4;
  private wheelTargetPocketIdx: number = 0;
  private wheelBallAngle: number = -Math.PI / 2;
  private wheelBallRadiusRatio: number = 0.66;
  private wheelBallStartAngle: number = -Math.PI / 2;
  private wheelLastTickStep: number = -1;
  public wheelWinningPocketIdx: number = -1;
  public wheelHistory: number[] = [7, 14, 0, 3, 10, 18, 2, 12];

  constructor() {
    this.loadJackpot();
    this.statusBanner = i18n.t(
      '🎰 BIENVENIDO AL CRIPTO-CASINO VIP // ELIGE JUEGO Y MULTIPLICA TUS CR',
      '🎰 WELCOME TO VIP CRYPTO-CASINO // PICK A GAME & MULTIPLY YOUR CR'
    );
  }

  private loadJackpot(): void {
    try {
      const raw = localStorage.getItem(CASINO_JACKPOT_STORAGE_KEY);
      if (raw) {
        const val = parseInt(raw, 10);
        if (Number.isFinite(val) && val >= 500) {
          this.progressiveJackpot = val;
        }
      }
    } catch {
      // Ignorar
    }
  }

  private saveJackpot(): void {
    try {
      localStorage.setItem(CASINO_JACKPOT_STORAGE_KEY, String(Math.floor(this.progressiveJackpot)));
    } catch {
      // Ignorar
    }
  }

  private contributeToJackpot(bet: number): void {
    this.progressiveJackpot = Math.min(
      999999,
      Math.floor(this.progressiveJackpot + Math.max(1, bet * 0.18))
    );
    this.saveJackpot();
  }

  private spawnCoinShower(cx: number, cy: number, count: number, color: string = '#fbbf24'): void {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.1;
      const spd = 130 + Math.random() * 260;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 140,
        y: cy + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 45,
        size: 5 + Math.random() * 4.5,
        color: i % 3 === 0 ? '#fde047' : i % 3 === 1 ? color : '#10b981',
        life: 0.9 + Math.random() * 0.7,
        maxLife: 1.6,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: 6 + Math.random() * 10,
        isCoin: i % 2 === 0,
      });
    }
    if (this.particles.length > 90) {
      this.particles.splice(0, this.particles.length - 90);
    }
  }

  private recordHistory(
    game: CasinoGameId,
    label: string,
    netDelta: number,
    multText: string,
    isBigWin: boolean
  ): void {
    this.sessionPlays++;
    this.sessionNetProfit += netDelta;
    if (netDelta > this.sessionBiggestWin) {
      this.sessionBiggestWin = netDelta;
    }
    this.history.unshift({ game, label, netDelta, multText, isBigWin });
    if (this.history.length > 7) {
      this.history.pop();
    }
  }

  private tryUnlockVipCrown(meta: MetaSystem, sound: SoundSystem, reason: string): void {
    if (meta.unlockSpecificHat('mit_casino')) {
      sound.playCasinoWin(true);
      this.spawnCoinShower(this.lastLayoutCx, this.lastLayoutCy, 55, '#fbbf24');
      this.statusBanner = i18n.t(
        `👑 ¡${reason}! DESBLOQUEASTE EL SOMBRERO MÍTICO: CORONA DE CRIPTO-MAGNATE VIP`,
        `👑 ${reason}! UNLOCKED MYTHIC HAT: VIP CRYPTO-MAGNATE CROWN`
      );
      this.statusColor = '#fbbf24';
    }
  }

  public update(dt: number, meta: MetaSystem, sound: SoundSystem): void {
    if (this.faucetCooldown > 0) {
      this.faucetCooldown = Math.max(0, this.faucetCooldown - dt);
    }
    if (this.slotWinPulseTimer > 0) {
      this.slotWinPulseTimer = Math.max(0, this.slotWinPulseTimer - dt);
    }

    // Actualizar lluvia de monedas 3D y chispas de premio
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt; // Gravedad
      p.spin += p.spinSpeed * dt;
    }

    // 1. Actualizar rodillos de Cyber-Slots
    if (this.isSlotSpinning) {
      let anyStillSpinning = false;
      for (let col = 0; col < 5; col++) {
        if (this.reelSpinTimers[col] > 0) {
          const prev = this.reelSpinTimers[col];
          this.reelSpinTimers[col] = Math.max(0, prev - dt);
          this.reelScrollOffsets[col] = (this.reelScrollOffsets[col] + dt * 18) % 1;
          if (this.reelSpinTimers[col] === 0 && prev > 0) {
            this.reelScrollOffsets[col] = 0;
            sound.playCasinoTick(0.85 + col * 0.14);
          } else {
            anyStillSpinning = true;
          }
        }
      }
      if (!anyStillSpinning) {
        this.isSlotSpinning = false;
        this.evaluateSlotSpin(meta, sound);
      }
    } else if (this.slotAutoSpin && this.activeGame === 'SLOTS') {
      this.slotAutoSpinDelay -= dt;
      if (this.slotAutoSpinDelay <= 0) {
        if (this.freeSpinsRemaining > 0 || meta.coins >= this.currentBet) {
          this.spinSlots(meta, sound);
        } else {
          this.slotAutoSpin = false;
        }
      }
    }

    // 2. Actualizar curva en vivo de Cripto-Crash ($DAW)
    if (this.crashState === 'FLYING') {
      this.crashElapsed += dt;
      const nextMult = Number(Math.pow(Math.E, 0.22 * Math.pow(this.crashElapsed, 1.24)).toFixed(2));
      this.crashMultiplier = Math.max(1.0, nextMult);

      if (
        !this.crashCashedOut &&
        this.crashAutoCashout >= 1.2 &&
        this.crashMultiplier >= this.crashAutoCashout &&
        this.crashTargetPoint >= this.crashAutoCashout
      ) {
        this.crashMultiplier = this.crashAutoCashout;
        this.cashOutCrash(meta, sound);
      }

      if (this.crashMultiplier >= this.crashTargetPoint) {
        this.crashMultiplier = this.crashTargetPoint;
        this.crashState = 'CRASHED';
        this.crashHistory.unshift(this.crashTargetPoint);
        if (this.crashHistory.length > 10) this.crashHistory.pop();

        if (!this.crashCashedOut) {
          sound.playExplosion(false);
          this.statusBanner = i18n.t(
            `💥 RUG PULL A ${this.crashTargetPoint.toFixed(2)}x — PERDISTE ${this.crashActiveBet} CR`,
            `💥 RUG PULL AT ${this.crashTargetPoint.toFixed(2)}x — LOST ${this.crashActiveBet} CR`
          );
          this.statusColor = '#f43f5e';
          this.recordHistory(
            'CRASH',
            'Crash RugPull',
            -this.crashActiveBet,
            `${this.crashTargetPoint.toFixed(2)}x`,
            false
          );
        }
      }
    }

    // 4. Actualizar física de la Ruleta Europea Neón (rotor + bola en contra-giro)
    if (this.isWheelSpinning) {
      this.wheelSpinElapsed += dt;
      const t = Math.min(1, this.wheelSpinElapsed / this.wheelSpinDuration);
      const easeOutRotor = 1 - Math.pow(1 - t, 2.2);
      const rotorSpeed = this.wheelVelocity * (1 - easeOutRotor * 0.82);
      this.wheelAngle = (this.wheelAngle + rotorSpeed * dt) % (Math.PI * 2);

      const sliceAngle = (Math.PI * 2) / ROULETTE_POCKETS.length;
      const targetPocketWorldAngle =
        this.wheelAngle + (this.wheelTargetPocketIdx + 0.5) * sliceAngle;

      if (t < 0.88) {
        // Bola girando en sentido contrario y cayendo en espiral hacia la casilla objetivo
        const ballProgress = t / 0.88;
        const easeBall = 1 - Math.pow(1 - ballProgress, 3.0);
        // 5 vueltas completas en contra-giro hasta encajar en targetPocketWorldAngle
        const endAngle = targetPocketWorldAngle - Math.PI * 2 * 5;
        const startAngle = this.wheelBallStartAngle;
        // Interpolar hacia la posición futura exacta de la casilla
        this.wheelBallAngle = startAngle + (endAngle - startAngle) * easeBall;

        if (ballProgress < 0.62) {
          this.wheelBallRadiusRatio = 0.93;
        } else {
          const dropT = (ballProgress - 0.62) / 0.38;
          const bounce = Math.sin(dropT * Math.PI * 3.5) * (1 - dropT) * 0.045;
          this.wheelBallRadiusRatio = 0.93 - (0.93 - 0.67) * (dropT * dropT) + bounce;
        }

        const tickStep = Math.floor(Math.abs(this.wheelBallAngle) / (Math.PI / 6));
        if (tickStep !== this.wheelLastTickStep) {
          this.wheelLastTickStep = tickStep;
          sound.playCasinoTick(0.95 + (1 - ballProgress) * 0.45);
        }
      } else {
        // Bola ya asentada girando junto con la casilla ganadora
        this.wheelBallAngle = targetPocketWorldAngle;
        this.wheelBallRadiusRatio = 0.67;
      }

      if (t >= 1) {
        this.wheelVelocity = 0;
        this.isWheelSpinning = false;
        this.wheelBallAngle = targetPocketWorldAngle;
        this.wheelBallRadiusRatio = 0.67;
        this.wheelWinningPocketIdx = this.wheelTargetPocketIdx;
        this.resolveWheelSpin(this.wheelTargetPocketIdx, meta, sound);
      }
    } else if (this.wheelWinningPocketIdx >= 0) {
      // Giro ambiental lento en reposo
      this.wheelAngle = (this.wheelAngle + dt * 0.14) % (Math.PI * 2);
      const sliceAngle = (Math.PI * 2) / ROULETTE_POCKETS.length;
      this.wheelBallAngle = this.wheelAngle + (this.wheelWinningPocketIdx + 0.5) * sliceAngle;
    } else {
      this.wheelAngle = (this.wheelAngle + dt * 0.14) % (Math.PI * 2);
    }
  }

  // ==========================================
  // LÓGICA DE CYBER-SLOTS DELUXE (5x3)
  // ==========================================
  private rollWeightedSymbol(): SlotSymbolId {
    const totalWeight = SLOT_SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
    let r = Math.random() * totalWeight;
    for (const sym of SLOT_SYMBOLS) {
      r -= sym.weight;
      if (r <= 0) return sym.id;
    }
    return 'CHERRY';
  }

  public spinSlots(meta: MetaSystem, sound: SoundSystem): void {
    if (this.isSlotSpinning) {
      for (let c = 0; c < 5; c++) {
        this.reelSpinTimers[c] = 0;
        this.reelScrollOffsets[c] = 0;
      }
      this.isSlotSpinning = false;
      this.evaluateSlotSpin(meta, sound);
      return;
    }

    const isFreeSpin = this.freeSpinsRemaining > 0;
    const bet = Math.max(5, this.currentBet);
    if (!isFreeSpin) {
      if (meta.coins < bet) {
        sound.playExplosion(false);
        this.statusBanner = i18n.t(
          `⚠️ CRIPTO INSUFICIENTE (NECESITAS ${bet} CR). USA EL BOTÓN DE MINERÍA SI ESTÁS A 0.`,
          `⚠️ NOT ENOUGH CRYPTO (NEED ${bet} CR). USE FREE MINING FAUCET IF AT 0.`
        );
        this.statusColor = '#f43f5e';
        this.slotAutoSpin = false;
        return;
      }
      meta.coins -= bet;
      this.contributeToJackpot(bet);
      this.freeSpinsMultiplier = 1;
    } else {
      this.freeSpinsRemaining--;
      this.freeSpinsMultiplier = Math.min(10, this.freeSpinsMultiplier + 1);
    }

    this.gambleAvailable = false;
    this.gambleStreak = 0;
    this.winningLines = [];
    this.lastSlotWinAmount = 0;

    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 3; row++) {
        const sym = this.rollWeightedSymbol();
        this.slotGrid[col][row] = sym;
        this.slotWildMultipliers[col][row] = sym === 'WILD' ? (Math.random() < 0.35 ? 3 : 2) : 1;
      }
      const baseTime = this.slotTurboMode ? 0.18 : 0.44;
      const stepTime = this.slotTurboMode ? 0.07 : 0.17;
      this.reelSpinTimers[col] = baseTime + col * stepTime;
    }

    this.isSlotSpinning = true;
    sound.playCasinoTick(1.1);
    meta.save();
  }

  private evaluateSlotSpin(meta: MetaSystem, sound: SoundSystem): void {
    const bet = Math.max(5, this.currentBet);
    const results: WinningLineResult[] = [];
    let totalWin = 0;

    for (let lIdx = 0; lIdx < PAYLINES_5X3.length; lIdx++) {
      const lineDef = PAYLINES_5X3[lIdx];
      let targetSym: SlotSymbolId | null = null;
      let matchCount = 0;
      let wildMult = 1;
      const cells: [number, number][] = [];

      for (let col = 0; col < 5; col++) {
        const row = lineDef.rows[col];
        const cellSym = this.slotGrid[col][row];
        if (cellSym === 'SCATTER') break;

        if (cellSym === 'WILD') {
          matchCount++;
          wildMult *= this.slotWildMultipliers[col][row];
          cells.push([col, row]);
        } else if (targetSym === null) {
          targetSym = cellSym;
          matchCount++;
          cells.push([col, row]);
        } else if (cellSym === targetSym) {
          matchCount++;
          cells.push([col, row]);
        } else {
          break;
        }
      }

      if (matchCount >= 3) {
        const effectiveSym = targetSym ?? 'WILD';
        const symDef = SLOT_SYMBOLS.find((s) => s.id === effectiveSym) || SLOT_SYMBOLS[0];
        const baseMult =
          matchCount === 5 ? symDef.pay5 : matchCount === 4 ? symDef.pay4 : symDef.pay3;
        const linePayout = Math.max(
          1,
          Math.round((bet * baseMult * wildMult * this.freeSpinsMultiplier) / 3)
        );
        totalWin += linePayout;
        results.push({
          lineIndex: lIdx,
          symbol: effectiveSym,
          count: matchCount,
          wildMultiplier: wildMult,
          payout: linePayout,
          cells,
          color: lineDef.color,
        });
      }
    }

    let scatterCount = 0;
    let crownCount = 0;
    const scatterCells: [number, number][] = [];
    const crownCells: [number, number][] = [];

    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 3; row++) {
        if (this.slotGrid[col][row] === 'SCATTER') {
          scatterCount++;
          scatterCells.push([col, row]);
        } else if (this.slotGrid[col][row] === 'CROWN') {
          crownCount++;
          crownCells.push([col, row]);
        }
      }
    }

    let triggeredFreeSpins = 0;
    if (scatterCount >= 3) {
      triggeredFreeSpins = scatterCount === 3 ? 5 : scatterCount === 4 ? 8 : 12;
      this.freeSpinsRemaining += triggeredFreeSpins;
      const scatterWin = bet * (scatterCount === 3 ? 3 : scatterCount === 4 ? 10 : 30);
      totalWin += scatterWin;
      results.push({
        lineIndex: -1,
        symbol: 'SCATTER',
        count: scatterCount,
        wildMultiplier: 1,
        payout: scatterWin,
        cells: scatterCells,
        color: '#c084fc',
      });
    }

    let wonMegaJackpot = false;
    const has5CrownLine = results.some((r) => r.symbol === 'CROWN' && r.count === 5);
    if (crownCount >= 4 || has5CrownLine) {
      wonMegaJackpot = true;
      totalWin += this.progressiveJackpot;
      results.push({
        lineIndex: -2,
        symbol: 'CROWN',
        count: crownCount,
        wildMultiplier: 1,
        payout: this.progressiveJackpot,
        cells: crownCells,
        color: '#fbbf24',
      });
      this.progressiveJackpot = 500;
      this.saveJackpot();
    }

    this.winningLines = results;
    this.lastSlotWinAmount = totalWin;

    if (totalWin > 0) {
      meta.coins += totalWin;
      meta.save();
      void meta.syncToCloud();
      this.slotWinPulseTimer = 2.8;
      this.gambleAvailable = !this.slotAutoSpin && !wonMegaJackpot;
      const isBig = totalWin >= bet * 4 || wonMegaJackpot || triggeredFreeSpins > 0;
      sound.playCasinoWin(isBig);
      this.spawnCoinShower(this.lastLayoutCx, this.lastLayoutCy, isBig ? 42 : 20);

      if (wonMegaJackpot) {
        this.tryUnlockVipCrown(meta, sound, 'MEGA JACKPOT EN CYBER-SLOTS');
      } else if (triggeredFreeSpins > 0) {
        this.statusBanner = i18n.t(
          `⚡ ¡${scatterCount} SCATTERS! +${triggeredFreeSpins} TIRADAS GRATIS ACTIVADAS (MULT x${Math.max(2, this.freeSpinsMultiplier)}) +${totalWin} CR`,
          `⚡ ${scatterCount} SCATTERS! +${triggeredFreeSpins} FREE SPINS TRIGGERED (MULT x${Math.max(2, this.freeSpinsMultiplier)}) +${totalWin} CR`
        );
        this.statusColor = '#c084fc';
      } else {
        const multVal = (totalWin / bet).toFixed(1);
        this.statusBanner = i18n.t(
          `🎰 ¡PREMIO EN ${results.length} LÍNEA(S)! GANASTE +${totalWin} CR (${multVal}x) • ¡PUEDES DOBLAR (x2)!`,
          `🎰 WIN ON ${results.length} LINE(S)! WON +${totalWin} CR (${multVal}x) • DOUBLE UP (x2) AVAILABLE!`
        );
        this.statusColor = isBig ? '#fbbf24' : '#10b981';
      }

      this.recordHistory(
        'SLOTS',
        wonMegaJackpot ? '👑 MEGA JACKPOT' : 'Cyber-Slots 5x3',
        totalWin - bet,
        `${(totalWin / bet).toFixed(1)}x`,
        isBig
      );
    } else {
      this.statusBanner =
        this.freeSpinsRemaining > 0
          ? i18n.t(
              `🔥 TIRADA GRATIS RESTANTE: ${this.freeSpinsRemaining} (MULTIPLICADOR GLOBAL x${this.freeSpinsMultiplier})`,
              `🔥 FREE SPINS LEFT: ${this.freeSpinsRemaining} (GLOBAL MULTIPLIER x${this.freeSpinsMultiplier})`
            )
          : i18n.t(
              'Sin combinación en las 9 líneas. ¡Busca 🃏 Wilds (x2/x3), ⚡ Scatters o 👑 Coronas!',
              'No payline match. Look for 🃏 Wilds (x2/x3), ⚡ Scatters or 👑 Crowns!'
            );
      this.statusColor = this.freeSpinsRemaining > 0 ? '#c084fc' : '#94a3b8';
      this.recordHistory('SLOTS', 'Cyber-Slots 5x3', -bet, '0.0x', false);
    }

    if (this.slotAutoSpin) {
      this.slotAutoSpinDelay = this.slotTurboMode ? 0.35 : 0.75;
    }
  }

  public gambleLastSlotWin(pick: 'RED' | 'CYAN', meta: MetaSystem, sound: SoundSystem): void {
    if (!this.gambleAvailable || this.lastSlotWinAmount <= 0) return;
    if (meta.coins < this.lastSlotWinAmount) {
      this.gambleAvailable = false;
      return;
    }

    const outcome: 'RED' | 'CYAN' = Math.random() < 0.5 ? 'RED' : 'CYAN';
    if (pick === outcome) {
      const added = this.lastSlotWinAmount;
      meta.coins += added;
      this.lastSlotWinAmount *= 2;
      this.gambleStreak++;
      this.sessionNetProfit += added;
      if (this.lastSlotWinAmount > this.sessionBiggestWin) {
        this.sessionBiggestWin = this.lastSlotWinAmount;
      }
      if (this.gambleStreak >= 3) {
        this.gambleAvailable = false;
      }
      sound.playCasinoWin(true);
      this.spawnCoinShower(this.lastLayoutCx, this.lastLayoutCy, 32, pick === 'RED' ? '#f43f5e' : '#38bdf8');
      this.statusBanner = i18n.t(
        `🃏 ¡DOBLE O NADA ACERTADO (${outcome})! PREMIO DUPLICADO A +${this.lastSlotWinAmount} CR`,
        `🃏 DOUBLE UP HIT (${outcome})! WIN DOUBLED TO +${this.lastSlotWinAmount} CR`
      );
      this.statusColor = '#fbbf24';
    } else {
      meta.coins = Math.max(0, meta.coins - this.lastSlotWinAmount);
      this.sessionNetProfit -= this.lastSlotWinAmount;
      this.lastSlotWinAmount = 0;
      this.gambleAvailable = false;
      this.winningLines = [];
      sound.playExplosion(false);
      this.statusBanner = i18n.t(
        `💥 SALIÓ ${outcome} EN DOBLE O NADA — PREMIO QUEMADO POR EL FIREWALL`,
        `💥 ${outcome} CAME UP ON DOUBLE OR NOTHING — WIN BURNED BY FIREWALL`
      );
      this.statusColor = '#f43f5e';
    }
    meta.save();
    void meta.syncToCloud();
  }

  // ==========================================
  // LÓGICA DE CRIPTO-CRASH ($DAW)
  // ==========================================
  private rollCrashPoint(): number {
    const r = Math.random();
    if (r < 0.04) return Number((1.0 + Math.random() * 0.05).toFixed(2));
    const raw = 0.97 / (1 - Math.random() * 0.985);
    return Number(Math.max(1.02, Math.min(100, raw)).toFixed(2));
  }

  public startOrCashoutCrash(meta: MetaSystem, sound: SoundSystem): void {
    if (this.crashState === 'FLYING' && !this.crashCashedOut) {
      this.cashOutCrash(meta, sound);
      return;
    }
    if (this.crashState === 'FLYING') return;

    const bet = Math.max(5, this.currentBet);
    if (meta.coins < bet) {
      sound.playExplosion(false);
      this.statusBanner = i18n.t(
        `⚠️ CRIPTO INSUFICIENTE PARA LANZAR $DAW (NECESITAS ${bet} CR).`,
        `⚠️ INSUFFICIENT CRYPTO TO LAUNCH $DAW (NEED ${bet} CR).`
      );
      this.statusColor = '#f43f5e';
      return;
    }

    meta.coins -= bet;
    this.crashActiveBet = bet;
    this.contributeToJackpot(bet);
    meta.save();

    this.crashState = 'FLYING';
    this.crashMultiplier = 1.0;
    this.crashElapsed = 0;
    this.crashCashedOut = false;
    this.crashCashoutMult = 0;
    this.crashWinAmount = 0;
    this.crashTargetPoint = this.rollCrashPoint();
    sound.playCasinoTick(1.2);
    this.statusBanner = i18n.t(
      '🚀 $DAW EN SUBIDA — ¡PULSA [RETIRAR AHORA] O [ESPACIO] ANTES DEL RUG PULL!',
      '🚀 $DAW CLIMBING — PRESS [CASH OUT NOW] OR [SPACE] BEFORE THE RUG PULL!'
    );
    this.statusColor = '#38bdf8';
  }

  public cashOutCrash(meta: MetaSystem, sound: SoundSystem): void {
    if (this.crashState !== 'FLYING' || this.crashCashedOut) return;
    this.crashCashedOut = true;
    this.crashCashoutMult = this.crashMultiplier;
    this.crashWinAmount = Math.max(1, Math.round(this.crashActiveBet * this.crashCashoutMult));

    meta.coins += this.crashWinAmount;
    meta.save();
    void meta.syncToCloud();

    const isBig = this.crashCashoutMult >= 3.0;
    sound.playCasinoWin(isBig);
    this.spawnCoinShower(this.lastLayoutCx, this.lastLayoutCy, isBig ? 36 : 18, '#10b981');
    this.statusBanner = i18n.t(
      `💰 ¡RETIRADA A TIEMPO EN ${this.crashCashoutMult.toFixed(2)}x! COBRASTE +${this.crashWinAmount} CR`,
      `💰 CASHED OUT AT ${this.crashCashoutMult.toFixed(2)}x! COLLECTED +${this.crashWinAmount} CR`
    );
    this.statusColor = '#10b981';

    this.recordHistory(
      'CRASH',
      'Cripto-Crash $DAW',
      this.crashWinAmount - this.crashActiveBet,
      `${this.crashCashoutMult.toFixed(2)}x`,
      isBig
    );
  }

  // ==========================================
  // LÓGICA DE FIREWALL MINES (5x5)
  // ==========================================
  public computeMinesMultiplier(safeCount: number, mines: number): number {
    if (safeCount <= 0) return 1.0;
    let prob = 1.0;
    for (let i = 0; i < safeCount; i++) {
      prob *= (25 - mines - i) / (25 - i);
    }
    const mult = 0.97 / Math.max(0.0001, prob);
    return Number(Math.max(1.05, mult).toFixed(2));
  }

  public startOrCashoutMines(meta: MetaSystem, sound: SoundSystem): void {
    if (this.minesState === 'PLAYING') {
      if (this.minesSafeOpened > 0) {
        this.cashOutMines(meta, sound);
      }
      return;
    }

    const bet = Math.max(5, this.currentBet);
    if (meta.coins < bet) {
      sound.playExplosion(false);
      this.statusBanner = i18n.t(
        `⚠️ CRIPTO INSUFICIENTE PARA INICIAR BUSCAMINAS (NECESITAS ${bet} CR).`,
        `⚠️ INSUFFICIENT CRYPTO TO START MINES (NEED ${bet} CR).`
      );
      this.statusColor = '#f43f5e';
      return;
    }

    meta.coins -= bet;
    this.minesActiveBet = bet;
    this.contributeToJackpot(bet);
    meta.save();

    this.minesBoard = Array(25).fill(false);
    this.minesRevealed = Array(25).fill(false);
    let placed = 0;
    while (placed < this.minesCount) {
      const idx = Math.floor(Math.random() * 25);
      if (!this.minesBoard[idx]) {
        this.minesBoard[idx] = true;
        placed++;
      }
    }

    this.minesSafeOpened = 0;
    this.minesCurrentMult = 1.0;
    this.minesState = 'PLAYING';
    sound.playCasinoTick(1.1);
    this.statusBanner = i18n.t(
      `💣 RED CON ${this.minesCount} VIRUS OCULTOS — DESTAPA NODOS SEGUROS (💎) Y COBRA CUANDO QUIERAS`,
      `💣 GRID WITH ${this.minesCount} HIDDEN VIRUSES — UNCOVER SAFE NODES (💎) & CASH OUT ANYTIME`
    );
    this.statusColor = '#38bdf8';
  }

  public clickMinesTile(index: number, meta: MetaSystem, sound: SoundSystem): void {
    if (this.minesState !== 'PLAYING') return;
    if (index < 0 || index >= 25 || this.minesRevealed[index]) return;

    this.minesRevealed[index] = true;
    if (this.minesBoard[index]) {
      this.minesState = 'BUSTED';
      for (let i = 0; i < 25; i++) this.minesRevealed[i] = true;
      sound.playExplosion(false);
      this.statusBanner = i18n.t(
        `☠️ ¡TROYANO DETECTADO EN EL NODO #${index + 1}! PERDISTE ${this.minesActiveBet} CR`,
        `☠️ TROJAN DETECTED AT NODE #${index + 1}! LOST ${this.minesActiveBet} CR`
      );
      this.statusColor = '#f43f5e';
      this.recordHistory('MINES', `Mines (${this.minesCount}💣)`, -this.minesActiveBet, '0.00x', false);
      return;
    }

    this.minesSafeOpened++;
    this.minesCurrentMult = this.computeMinesMultiplier(this.minesSafeOpened, this.minesCount);
    sound.playCasinoTick(1.0 + this.minesSafeOpened * 0.08);
    this.spawnCoinShower(this.lastLayoutCx - 160, this.lastLayoutCy, 6, '#38bdf8');

    const maxSafe = 25 - this.minesCount;
    if (this.minesSafeOpened >= maxSafe) {
      this.cashOutMines(meta, sound);
    } else {
      const payoutNow = Math.round(this.minesActiveBet * this.minesCurrentMult);
      const nextMult = this.computeMinesMultiplier(this.minesSafeOpened + 1, this.minesCount);
      this.statusBanner = i18n.t(
        `💎 NODO LIMPIO (${this.minesCurrentMult.toFixed(2)}x = ${payoutNow} CR) • SIGUIENTE NODO: ${nextMult.toFixed(2)}x`,
        `💎 SAFE NODE (${this.minesCurrentMult.toFixed(2)}x = ${payoutNow} CR) • NEXT NODE: ${nextMult.toFixed(2)}x`
      );
      this.statusColor = '#10b981';
    }
  }

  public pickRandomMinesTile(meta: MetaSystem, sound: SoundSystem): void {
    if (this.minesState !== 'PLAYING') {
      this.startOrCashoutMines(meta, sound);
      return;
    }
    const closed: number[] = [];
    for (let i = 0; i < 25; i++) {
      if (!this.minesRevealed[i]) closed.push(i);
    }
    if (closed.length > 0) {
      const pick = closed[Math.floor(Math.random() * closed.length)];
      this.clickMinesTile(pick, meta, sound);
    }
  }

  public cashOutMines(meta: MetaSystem, sound: SoundSystem): void {
    if (this.minesState !== 'PLAYING' || this.minesSafeOpened <= 0) return;
    this.minesState = 'CASHED';
    for (let i = 0; i < 25; i++) this.minesRevealed[i] = true;

    const payout = Math.max(1, Math.round(this.minesActiveBet * this.minesCurrentMult));
    meta.coins += payout;
    meta.save();
    void meta.syncToCloud();

    const isBig = this.minesCurrentMult >= 3.0;
    sound.playCasinoWin(isBig);
    this.spawnCoinShower(this.lastLayoutCx, this.lastLayoutCy, isBig ? 36 : 18, '#fbbf24');
    this.statusBanner = i18n.t(
      `💰 ¡PLANTADO CON ÉXITO EN ${this.minesCurrentMult.toFixed(2)}x! COBRASTE +${payout} CR`,
      `💰 CASHED OUT AT ${this.minesCurrentMult.toFixed(2)}x! COLLECTED +${payout} CR`
    );
    this.statusColor = '#fbbf24';

    this.recordHistory(
      'MINES',
      `Mines (${this.minesCount}💣)`,
      payout - this.minesActiveBet,
      `${this.minesCurrentMult.toFixed(2)}x`,
      isBig
    );
  }

  // ==========================================
  // LÓGICA DE RULETA EUROPEA NEÓN (0-18 + BOLA)
  // ==========================================
  private isNumberCoveredByBet(num: number): boolean {
    if (this.rouletteBetType === 'STRAIGHT') return num === this.rouletteStraightNum;
    if (num === 0) return false;
    if (this.rouletteBetType === 'RED') return ROULETTE_RED_NUMS.has(num);
    if (this.rouletteBetType === 'BLACK') return !ROULETTE_RED_NUMS.has(num);
    if (this.rouletteBetType === 'EVEN') return num % 2 === 0;
    if (this.rouletteBetType === 'ODD') return num % 2 === 1;
    if (this.rouletteBetType === 'LOW_6') return num >= 1 && num <= 6;
    if (this.rouletteBetType === 'MID_6') return num >= 7 && num <= 12;
    if (this.rouletteBetType === 'HIGH_6') return num >= 13 && num <= 18;
    return false;
  }

  private getRouletteBetLabel(): string {
    if (this.rouletteBetType === 'STRAIGHT') {
      const mult = this.rouletteStraightNum === 0 ? 20 : 18;
      return i18n.t(`PLENO #${this.rouletteStraightNum} (x${mult})`, `STRAIGHT #${this.rouletteStraightNum} (x${mult})`);
    }
    if (this.rouletteBetType === 'RED') return i18n.t('ROJO (x2)', 'RED (x2)');
    if (this.rouletteBetType === 'BLACK') return i18n.t('NEGRO (x2)', 'BLACK (x2)');
    if (this.rouletteBetType === 'EVEN') return i18n.t('PAR (x2)', 'EVEN (x2)');
    if (this.rouletteBetType === 'ODD') return i18n.t('IMPAR (x2)', 'ODD (x2)');
    if (this.rouletteBetType === 'LOW_6') return '1–6 (x3)';
    if (this.rouletteBetType === 'MID_6') return '7–12 (x3)';
    return '13–18 (x3)';
  }

  public spinWheel(meta: MetaSystem, sound: SoundSystem): void {
    if (this.isWheelSpinning) return;
    const bet = Math.max(5, this.currentBet);
    if (meta.coins < bet) {
      sound.playExplosion(false);
      this.statusBanner = i18n.t(
        `⚠️ CRIPTO INSUFICIENTE PARA LANZAR LA BOLA (NECESITAS ${bet} CR).`,
        `⚠️ INSUFFICIENT CRYPTO TO SPIN ROULETTE (NEED ${bet} CR).`
      );
      this.statusColor = '#f43f5e';
      return;
    }

    meta.coins -= bet;
    this.wheelActiveBet = bet;
    this.contributeToJackpot(bet);
    meta.save();

    this.wheelTargetPocketIdx = Math.floor(Math.random() * ROULETTE_POCKETS.length);
    this.wheelSpinElapsed = 0;
    this.wheelSpinDuration = 3.1 + Math.random() * 0.65;
    this.wheelVelocity = 2.6 + Math.random() * 0.75;
    this.wheelBallStartAngle = this.wheelBallAngle;
    this.wheelLastTickStep = -1;
    this.wheelWinningPocketIdx = -1;
    this.isWheelSpinning = true;

    sound.playCasinoTick(1.25);
    this.statusBanner = i18n.t(
      `🎡 BOLA EN JUEGO — APUESTA: ${this.getRouletteBetLabel()} (${bet} CR)...`,
      `🎡 BALL IN PLAY — BET: ${this.getRouletteBetLabel()} (${bet} CR)...`
    );
    this.statusColor = '#38bdf8';
  }

  private resolveWheelSpin(pocketIdx: number, meta: MetaSystem, sound: SoundSystem): void {
    const pocket = ROULETTE_POCKETS[pocketIdx] || ROULETTE_POCKETS[0];
    this.wheelHistory.unshift(pocket.num);
    if (this.wheelHistory.length > 8) this.wheelHistory.pop();

    const won = this.isNumberCoveredByBet(pocket.num);
    let mult = 0;
    if (won) {
      if (this.rouletteBetType === 'STRAIGHT') {
        mult = pocket.num === 0 ? 20 : 18;
      } else if (
        this.rouletteBetType === 'LOW_6' ||
        this.rouletteBetType === 'MID_6' ||
        this.rouletteBetType === 'HIGH_6'
      ) {
        mult = 3;
      } else {
        mult = 2;
      }
    }

    const payout = Math.round(this.wheelActiveBet * mult);
    const colorName =
      pocket.colorGroup === 'GREEN'
        ? i18n.t('VERDE', 'GREEN')
        : pocket.colorGroup === 'RED'
        ? i18n.t('ROJO', 'RED')
        : i18n.t('NEGRO', 'BLACK');

    if (payout > 0) {
      meta.coins += payout;
      meta.save();
      void meta.syncToCloud();
      const isBig = mult >= 3;
      sound.playCasinoWin(isBig);
      this.spawnCoinShower(this.lastLayoutCx, this.lastLayoutCy, isBig ? 42 : 20, pocket.color);
      this.statusBanner = i18n.t(
        `🎡 ¡BOLA EN EL ${pocket.num} (${colorName})! ACERTASTE ${this.getRouletteBetLabel()} → +${payout} CR`,
        `🎡 BALL LANDED ON ${pocket.num} (${colorName})! HIT ${this.getRouletteBetLabel()} → +${payout} CR`
      );
      this.statusColor = isBig ? '#fbbf24' : '#10b981';
      this.recordHistory(
        'WHEEL',
        `Ruleta #${pocket.num}`,
        payout - this.wheelActiveBet,
        `${mult}x`,
        isBig
      );
    } else {
      sound.playExplosion(false);
      this.statusBanner = i18n.t(
        `🎡 Salió el ${pocket.num} (${colorName}) — Sin premio en esta tirada.`,
        `🎡 Landed on ${pocket.num} (${colorName}) — No payout on this spin.`
      );
      this.statusColor = '#94a3b8';
      this.recordHistory('WHEEL', `Ruleta #${pocket.num}`, -this.wheelActiveBet, '0x', false);
    }
  }

  // ==========================================
  // INTERACCIÓN DE BOTONES Y CLICS DEL CASINO
  // ==========================================
  public handleClick(
    mx: number,
    my: number,
    layout: { px: number; py: number; leftCx: number; bayX: number; bayY: number; bayW: number; bayH: number },
    meta: MetaSystem,
    sound: SoundSystem
  ): boolean {
    const { py, leftCx, bayX, bayY, bayW } = layout;

    const gameTabs = this.getGameSubTabRects(leftCx, py);
    for (const tab of gameTabs) {
      if (this.inRect(mx, my, tab)) {
        this.activeGame = tab.id;
        this.slotAutoSpin = false;
        sound.playCasinoTick(1.15);
        return true;
      }
    }

    for (const chip of this.getBetChipRects(leftCx, py)) {
      if (this.inRect(mx, my, chip)) {
        if (chip.action === 'HALF') {
          this.currentBet = Math.max(5, Math.floor(this.currentBet / 2));
        } else if (chip.action === 'DOUBLE') {
          this.currentBet = Math.max(5, Math.min(Math.max(20, meta.coins), this.currentBet * 2));
        } else if (chip.action === 'MAX') {
          this.currentBet = Math.max(5, Math.min(2500, meta.coins));
        } else if (chip.amount) {
          this.currentBet = chip.amount;
        }
        sound.playCasinoTick(1.05);
        return true;
      }
    }

    const crownBtn = { x: bayX + 18, y: bayY + 184, width: bayW - 36, height: 30 };
    if (this.inRect(mx, my, crownBtn)) {
      if (meta.unlockedHats.has('mit_casino')) {
        const res = meta.equipHat('mit_casino');
        this.statusBanner = res.message;
        this.statusColor = '#fbbf24';
        sound.playCoinPickup();
      } else if (meta.coins < 15 && this.faucetCooldown <= 0) {
        meta.coins += 15;
        this.faucetCooldown = 8;
        meta.save();
        sound.playCoinPickup();
        this.statusBanner = i18n.t(
          '⚡ BECA DE MINERÍA ACTIVADA: +15 CR ACREDITADOS PARA SEGUIR JUGANDO',
          '⚡ MINING FAUCET ACTIVATED: +15 CR CREDITED TO KEEP PLAYING'
        );
        this.statusColor = '#10b981';
      }
      return true;
    }

    const faucetBtn = { x: bayX + 18, y: bayY + 452, width: bayW - 36, height: 32 };
    if (meta.coins < 20 && this.inRect(mx, my, faucetBtn) && this.faucetCooldown <= 0) {
      meta.coins += 20;
      this.faucetCooldown = 8;
      meta.save();
      sound.playCoinPickup();
      this.statusBanner = i18n.t(
        '⚡ SUBRUTINA DE RESCATE: +20 CR MINADOS GRATIS',
        '⚡ RESCUE SUBROUTINE: +20 FREE CR MINED'
      );
      this.statusColor = '#10b981';
      return true;
    }

    if (this.activeGame === 'SLOTS') {
      const spinBtn = { x: leftCx - 135, y: py + 432, width: 270, height: 42 };
      if (this.inRect(mx, my, spinBtn)) {
        this.spinSlots(meta, sound);
        return true;
      }
      const turboBtn = { x: leftCx - 358, y: py + 432, width: 104, height: 42 };
      if (this.inRect(mx, my, turboBtn)) {
        this.slotTurboMode = !this.slotTurboMode;
        sound.playCasinoTick(1.2);
        return true;
      }
      const autoBtn = { x: leftCx - 246, y: py + 432, width: 104, height: 42 };
      if (this.inRect(mx, my, autoBtn)) {
        this.slotAutoSpin = !this.slotAutoSpin;
        if (this.slotAutoSpin && !this.isSlotSpinning) {
          this.spinSlots(meta, sound);
        }
        sound.playCasinoTick(1.2);
        return true;
      }
      if (this.gambleAvailable && this.lastSlotWinAmount > 0) {
        const redBtn = { x: leftCx + 144, y: py + 432, width: 104, height: 42 };
        const cyanBtn = { x: leftCx + 254, y: py + 432, width: 104, height: 42 };
        if (this.inRect(mx, my, redBtn)) {
          this.gambleLastSlotWin('RED', meta, sound);
          return true;
        }
        if (this.inRect(mx, my, cyanBtn)) {
          this.gambleLastSlotWin('CYAN', meta, sound);
          return true;
        }
      }
    } else if (this.activeGame === 'CRASH') {
      const actionBtn = { x: leftCx - 160, y: py + 432, width: 320, height: 42 };
      if (this.inRect(mx, my, actionBtn)) {
        this.startOrCashoutCrash(meta, sound);
        return true;
      }
      const autoOpts = [0, 1.5, 2.0, 3.0, 5.0, 10.0];
      for (let i = 0; i < autoOpts.length; i++) {
        const r = { x: leftCx - 355 + i * 56, y: py + 392, width: 52, height: 28 };
        if (this.inRect(mx, my, r)) {
          this.crashAutoCashout = autoOpts[i];
          sound.playCasinoTick(1.1);
          return true;
        }
      }
    } else if (this.activeGame === 'MINES') {
      const gridStartX = leftCx - 295;
      const gridStartY = py + 230;
      const cellS = 44;
      const gap = 6;
      for (let idx = 0; idx < 25; idx++) {
        const c = idx % 5;
        const r = Math.floor(idx / 5);
        const rect = {
          x: gridStartX + c * (cellS + gap),
          y: gridStartY + r * (cellS + gap),
          width: cellS,
          height: cellS,
        };
        if (this.inRect(mx, my, rect)) {
          if (this.minesState !== 'PLAYING') {
            this.startOrCashoutMines(meta, sound);
          }
          this.clickMinesTile(idx, meta, sound);
          return true;
        }
      }

      const mineOptions = [1, 3, 5, 8, 13];
      for (let i = 0; i < mineOptions.length; i++) {
        const btn = { x: leftCx + 15 + i * 66, y: py + 258, width: 60, height: 32 };
        if (this.inRect(mx, my, btn) && this.minesState !== 'PLAYING') {
          this.minesCount = mineOptions[i];
          sound.playCasinoTick(1.1);
          return true;
        }
      }

      const mainMinesBtn = { x: leftCx + 15, y: py + 380, width: 324, height: 42 };
      if (this.inRect(mx, my, mainMinesBtn)) {
        this.startOrCashoutMines(meta, sound);
        return true;
      }

      const randBtn = { x: leftCx + 15, y: py + 430, width: 324, height: 36 };
      if (this.inRect(mx, my, randBtn)) {
        this.pickRandomMinesTile(meta, sound);
        return true;
      }
    } else if (this.activeGame === 'WHEEL') {
      const feltX = leftCx - 92;
      const feltW = 446;

      const spinWheelBtn = { x: feltX, y: py + 422, width: feltW, height: 48 };
      if (this.inRect(mx, my, spinWheelBtn)) {
        this.spinWheel(meta, sound);
        return true;
      }

      if (!this.isWheelSpinning) {
        // Casilla 0 verde (Pleno x20)
        const zeroRect = { x: feltX, y: py + 244, width: 42, height: 96 };
        if (this.inRect(mx, my, zeroRect)) {
          this.rouletteBetType = 'STRAIGHT';
          this.rouletteStraightNum = 0;
          sound.playCasinoTick(1.2);
          return true;
        }

        // Parrilla 6x3 de números 1..18 (Pleno x18)
        const gridStartX = feltX + 47;
        const gridStartY = py + 244;
        const cellW = 63;
        const cellH = 30;
        const gapX = 4;
        const gapY = 3;
        for (let col = 0; col < 6; col++) {
          for (let row = 0; row < 3; row++) {
            const num = col * 3 + (3 - row);
            const r = {
              x: gridStartX + col * (cellW + gapX),
              y: gridStartY + row * (cellH + gapY),
              width: cellW,
              height: cellH,
            };
            if (this.inRect(mx, my, r)) {
              this.rouletteBetType = 'STRAIGHT';
              this.rouletteStraightNum = num;
              sound.playCasinoTick(1.15);
              return true;
            }
          }
        }

        // Fila 1 de apuestas externas: Terceras (x3)
        const thirds: RouletteBetType[] = ['LOW_6', 'MID_6', 'HIGH_6'];
        for (let i = 0; i < thirds.length; i++) {
          const r = { x: feltX + i * 151, y: py + 346, width: 144, height: 30 };
          if (this.inRect(mx, my, r)) {
            this.rouletteBetType = thirds[i];
            sound.playCasinoTick(1.1);
            return true;
          }
        }

        // Fila 2 de apuestas externas: Dobles (x2)
        const evens: RouletteBetType[] = ['RED', 'BLACK', 'EVEN', 'ODD'];
        for (let i = 0; i < evens.length; i++) {
          const r = { x: feltX + i * 113, y: py + 382, width: 107, height: 32 };
          if (this.inRect(mx, my, r)) {
            this.rouletteBetType = evens[i];
            sound.playCasinoTick(1.1);
            return true;
          }
        }
      }
    }

    return false;
  }

  public triggerPrimaryAction(meta: MetaSystem, sound: SoundSystem): void {
    if (this.activeGame === 'SLOTS') {
      this.spinSlots(meta, sound);
    } else if (this.activeGame === 'CRASH') {
      this.startOrCashoutCrash(meta, sound);
    } else if (this.activeGame === 'MINES') {
      this.startOrCashoutMines(meta, sound);
    } else if (this.activeGame === 'WHEEL') {
      this.spinWheel(meta, sound);
    }
  }

  private getGameSubTabRects(leftCx: number, py: number): {
    id: CasinoGameId;
    label: string;
    accent: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const w = 178;
    const h = 32;
    const gap = 10;
    const totalW = w * 4 + gap * 3;
    const startX = leftCx - totalW / 2;
    const y = py + 150;
    return [
      { id: 'SLOTS', label: `[1] 🎰 CYBER-SLOTS 5×3`, accent: '#fbbf24', x: startX, y, width: w, height: h },
      { id: 'CRASH', label: `[2] 📈 CRIPTO-CRASH`, accent: '#10b981', x: startX + (w + gap), y, width: w, height: h },
      { id: 'MINES', label: `[3] 💣 FIREWALL MINES`, accent: '#38bdf8', x: startX + (w + gap) * 2, y, width: w, height: h },
      { id: 'WHEEL', label: `[4] 🎡 RULETA NEÓN 0-18`, accent: '#e879f9', x: startX + (w + gap) * 3, y, width: w, height: h },
    ];
  }

  private getBetChipRects(leftCx: number, py: number): {
    label: string;
    amount?: number;
    action?: 'HALF' | 'DOUBLE' | 'MAX';
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const y = py + 188;
    const h = 28;
    const items: { label: string; amount?: number; action?: 'HALF' | 'DOUBLE' | 'MAX'; color: string }[] = [
      { label: '10 CR', amount: 10, color: '#38bdf8' },
      { label: '25 CR', amount: 25, color: '#10b981' },
      { label: '50 CR', amount: 50, color: '#c084fc' },
      { label: '100 CR', amount: 100, color: '#fbbf24' },
      { label: '250 CR', amount: 250, color: '#f43f5e' },
      { label: '1/2', action: 'HALF', color: '#94a3b8' },
      { label: 'x2', action: 'DOUBLE', color: '#fb923c' },
      { label: 'MAX', action: 'MAX', color: '#fde047' },
    ];
    const w = 62;
    const gap = 6;
    const startX = leftCx - 180;
    return items.map((it, idx) => ({
      ...it,
      x: startX + idx * (w + gap),
      y,
      width: w,
      height: h,
    }));
  }

  private inRect(mx: number, my: number, r: { x: number; y: number; width: number; height: number }): boolean {
    return mx >= r.x && mx <= r.x + r.width && my >= r.y && my <= r.y + r.height;
  }

  // ==========================================
  // RENDERIZADO ULTRA-DETALLADO DEL CRIPTO-CASINO VIP
  // ==========================================
  public drawCasinoConsole(
    ctx: CanvasRenderingContext2D,
    layout: { px: number; py: number; leftCx: number; bayX: number; bayY: number; bayW: number; bayH: number },
    meta: MetaSystem
  ): void {
    const { py, leftCx, bayX, bayY, bayW, bayH } = layout;
    const now = performance.now();
    this.lastLayoutCx = leftCx;
    this.lastLayoutCy = py + 325;

    ctx.save();

    // Resplandor ambiental de salón VIP detrás de la consola
    const ambGrad = ctx.createRadialGradient(leftCx, py + 320, 30, leftCx, py + 320, 420);
    ambGrad.addColorStop(0, 'rgba(251, 191, 36, 0.08)');
    ambGrad.addColorStop(0.55, 'rgba(168, 85, 247, 0.05)');
    ambGrad.addColorStop(1, 'rgba(6, 10, 20, 0)');
    ctx.fillStyle = ambGrad;
    ctx.fillRect(leftCx - 380, py + 145, 760, 370);

    // 1. Sub-pestañas de selección de máquina de Casino con degradado metálico y neón
    for (const tab of this.getGameSubTabRects(leftCx, py)) {
      const active = this.activeGame === tab.id;
      const g = ctx.createLinearGradient(tab.x, tab.y, tab.x, tab.y + tab.height);
      if (active) {
        g.addColorStop(0, 'rgba(58, 22, 94, 0.98)');
        g.addColorStop(1, 'rgba(22, 12, 46, 0.98)');
      } else {
        g.addColorStop(0, 'rgba(18, 28, 48, 0.94)');
        g.addColorStop(1, 'rgba(10, 16, 30, 0.94)');
      }
      this.drawBox(
        ctx,
        tab.x,
        tab.y,
        tab.width,
        tab.height,
        g,
        active ? tab.accent : 'rgba(100, 116, 139, 0.45)',
        active ? 2.2 : 1.2
      );
      if (active) {
        ctx.fillStyle = tab.accent;
        ctx.fillRect(tab.x + 12, tab.y + tab.height - 2.5, tab.width - 24, 2.5);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = active ? '#ffffff' : '#94a3b8';
      ctx.font = `bold 11.5px ${FONT_DISPLAY}`;
      ctx.fillText(tab.label, tab.x + tab.width / 2, tab.y + 20);
    }

    // 2. Barra de Apuesta Universal con Fichas de Póker Cibernéticas
    const betDisplayBox = { x: leftCx - 358, y: py + 188, width: 170, height: 28 };
    const betGrad = ctx.createLinearGradient(betDisplayBox.x, betDisplayBox.y, betDisplayBox.x + betDisplayBox.width, betDisplayBox.y);
    betGrad.addColorStop(0, 'rgba(69, 26, 3, 0.95)');
    betGrad.addColorStop(1, 'rgba(24, 15, 28, 0.95)');
    this.drawBox(ctx, betDisplayBox.x, betDisplayBox.y, betDisplayBox.width, betDisplayBox.height, betGrad, '#fbbf24', 1.6);

    // Moneda dorada giratoria en el display de apuesta
    this.drawSpinningGoldCoin(ctx, betDisplayBox.x + 18, betDisplayBox.y + 14, 8, now);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = `bold 11.5px ${FONT_MONO}`;
    ctx.fillText(
      `${i18n.t('APUESTA', 'BET')}: ${this.currentBet} CR`,
      betDisplayBox.x + 32,
      betDisplayBox.y + 18,
      betDisplayBox.width - 38
    );

    for (const chip of this.getBetChipRects(leftCx, py)) {
      const isSelected = chip.amount !== undefined && this.currentBet === chip.amount;
      const cg = ctx.createLinearGradient(chip.x, chip.y, chip.x, chip.y + chip.height);
      if (isSelected) {
        cg.addColorStop(0, 'rgba(146, 64, 14, 0.98)');
        cg.addColorStop(1, 'rgba(69, 26, 3, 0.98)');
      } else {
        cg.addColorStop(0, 'rgba(20, 32, 56, 0.95)');
        cg.addColorStop(1, 'rgba(11, 18, 34, 0.95)');
      }
      this.drawBox(
        ctx,
        chip.x,
        chip.y,
        chip.width,
        chip.height,
        cg,
        isSelected ? '#fde047' : chip.color,
        isSelected ? 2.2 : 1.3
      );

      // Muescas de ficha de casino en las esquinas superiores/inferiores
      ctx.fillStyle = isSelected ? '#fde047' : chip.color;
      ctx.fillRect(chip.x + 10, chip.y + 1, 8, 2);
      ctx.fillRect(chip.x + chip.width - 18, chip.y + 1, 8, 2);
      ctx.fillRect(chip.x + 10, chip.y + chip.height - 3, 8, 2);
      ctx.fillRect(chip.x + chip.width - 18, chip.y + chip.height - 3, 8, 2);

      ctx.textAlign = 'center';
      ctx.fillStyle = isSelected ? '#ffffff' : '#e2e8f0';
      ctx.font = `bold 10.5px ${FONT_MONO}`;
      ctx.fillText(chip.label, chip.x + chip.width / 2, chip.y + 18);
    }

    // 3. Renderizar el juego seleccionado en el cuerpo principal (py+222 .. py+476)
    if (this.activeGame === 'SLOTS') {
      this.drawCyberSlotsGame(ctx, leftCx, py, now);
    } else if (this.activeGame === 'CRASH') {
      this.drawCryptoCrashGame(ctx, leftCx, py, now);
    } else if (this.activeGame === 'MINES') {
      this.drawFirewallMinesGame(ctx, leftCx, py, now);
    } else if (this.activeGame === 'WHEEL') {
      this.drawQuantumWheelGame(ctx, leftCx, py, now);
    }

    // 4. Cinta de estado del Casino con biselado de cristal y brillo
    const statusGrad = ctx.createLinearGradient(leftCx - 358, py + 482, leftCx + 358, py + 482);
    statusGrad.addColorStop(0, 'rgba(8, 14, 26, 0.96)');
    statusGrad.addColorStop(0.5, 'rgba(18, 28, 48, 0.98)');
    statusGrad.addColorStop(1, 'rgba(8, 14, 26, 0.96)');
    this.drawBox(
      ctx,
      leftCx - 358,
      py + 482,
      716,
      30,
      statusGrad,
      this.statusColor,
      1.6
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = this.statusColor;
    ctx.font = `bold 11.5px ${FONT_DISPLAY}`;
    ctx.fillText(this.statusBanner, leftCx, py + 501, 696);

    // 5. Bahía Derecha VIP del Casino (Mega Jackpot, Corona Mítica, Tabla de Pagos e Historial)
    this.drawCasinoVipRightBay(ctx, bayX, bayY, bayW, bayH, meta, now);

    // 6. Partículas de Monedas 3D y Chispas de Premio encima de la consola
    this.drawCasinoParticles(ctx);

    ctx.restore();
  }

  private drawSpinningGoldCoin(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    now: number
  ): void {
    const scaleX = Math.max(0.25, Math.abs(Math.cos(now * 0.004)));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scaleX, 1);
    const cg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    cg.addColorStop(0, '#fef08a');
    cg.addColorStop(0.65, '#fbbf24');
    cg.addColorStop(1, '#b45309');
    ctx.fillStyle = cg;
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    ctx.font = `bold ${Math.round(r * 1.25)}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₿', 0, 0.5);
    ctx.restore();
  }

  private drawCasinoParticles(ctx: CanvasRenderingContext2D): void {
    if (this.particles.length === 0) return;
    ctx.save();
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / 0.5));
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.isCoin) {
        ctx.scale(Math.max(0.2, Math.abs(Math.cos(p.spin))), 1);
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // ==========================================
  // 1. RENDERIZADO DE CYBER-SLOTS DELUXE (5x3)
  // ==========================================
  private drawCyberSlotsGame(
    ctx: CanvasRenderingContext2D,
    leftCx: number,
    py: number,
    now: number
  ): void {
    const machineX = leftCx - 358;
    const machineY = py + 222;
    const machineW = 716;
    const machineH = 202;

    const hasFreeSpins = this.freeSpinsRemaining > 0;
    const isWinning = !this.isSlotSpinning && this.winningLines.length > 0;

    // 1. Chasis exterior de la máquina tragaperras con acabado metálico 3D
    const cabGrad = ctx.createLinearGradient(machineX, machineY, machineX, machineY + machineH);
    if (hasFreeSpins) {
      cabGrad.addColorStop(0, 'rgba(59, 7, 100, 0.98)');
      cabGrad.addColorStop(0.5, 'rgba(28, 6, 56, 0.98)');
      cabGrad.addColorStop(1, 'rgba(46, 10, 82, 0.98)');
    } else {
      cabGrad.addColorStop(0, 'rgba(24, 34, 58, 0.98)');
      cabGrad.addColorStop(0.5, 'rgba(8, 13, 26, 0.98)');
      cabGrad.addColorStop(1, 'rgba(18, 28, 48, 0.98)');
    }
    this.drawBox(
      ctx,
      machineX,
      machineY,
      machineW,
      machineH,
      cabGrad,
      hasFreeSpins ? '#e879f9' : isWinning ? '#fde047' : '#fbbf24',
      2.6
    );

    // 2. Bombillas LED de marquesina de Casino alrededor del bastidor (Chaser Bulbs)
    const ledStep = Math.floor(now / 110);
    for (let b = 0; b < 22; b++) {
      const bx = machineX + 20 + b * ((machineW - 40) / 21);
      const litTop = (b + ledStep) % 3 === 0;
      const litBot = (b - ledStep + 30) % 3 === 0;
      ctx.fillStyle = litTop ? (hasFreeSpins ? '#e879f9' : '#fde047') : 'rgba(120, 53, 15, 0.45)';
      ctx.beginPath();
      ctx.arc(bx, machineY + 4.5, litTop ? 2.4 : 1.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = litBot ? (hasFreeSpins ? '#38bdf8' : '#fbbf24') : 'rgba(120, 53, 15, 0.45)';
      ctx.beginPath();
      ctx.arc(bx, machineY + machineH - 4.5, litBot ? 2.4 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Indicadores laterales de las 9 líneas de pago (Izquierda y Derecha del tambor)
    for (let l = 0; l < PAYLINES_5X3.length; l++) {
      const lineCol = PAYLINES_5X3[l].color;
      const isLineWon = this.winningLines.some((w) => w.lineIndex === l);
      const ly = machineY + 20 + l * 19.5;
      for (const sideX of [machineX + 6, machineX + machineW - 18]) {
        ctx.fillStyle = isLineWon ? lineCol : 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = lineCol;
        ctx.lineWidth = isLineWon ? 1.8 : 1;
        ctx.fillRect(sideX, ly, 12, 14);
        ctx.strokeRect(sideX, ly, 12, 14);
        ctx.fillStyle = isLineWon ? '#090d16' : lineCol;
        ctx.font = `bold 8.5px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(`${l + 1}`, sideX + 6, ly + 10.5);
      }
    }

    const cellW = 124;
    const cellH = 56;
    const gapX = 9;
    const gapY = 6;
    const gridW = cellW * 5 + gapX * 4;
    const startX = leftCx - gridW / 2;
    const startY = machineY + 11;

    const winningCells = new Set<string>();
    for (const line of this.winningLines) {
      for (const [c, r] of line.cells) {
        winningCells.add(`${c},${r}`);
      }
    }

    // 4. Tambores cilíndricos 3D para cada una de las 5 columnas de rodillos
    for (let col = 0; col < 5; col++) {
      const spinning = this.reelSpinTimers[col] > 0;
      const colX = startX + col * (cellW + gapX);
      const colH = cellH * 3 + gapY * 2;

      // Fondo cóncavo del tambor
      ctx.save();
      this.drawBox(
        ctx,
        colX - 2,
        startY - 2,
        cellW + 4,
        colH + 4,
        'rgba(4, 7, 15, 0.96)',
        spinning ? '#38bdf8' : 'rgba(71, 85, 105, 0.5)',
        spinning ? 1.8 : 1.1
      );
      ctx.beginPath();
      ctx.rect(colX - 1, startY - 1, cellW + 2, colH + 2);
      ctx.clip();

      const scrollShift = spinning ? ((now * 1.15 + col * 45) % cellH) : 0;

      for (let row = -1; row < 3; row++) {
        if (!spinning && row === -1) continue;
        const rIdx = (row + 3) % 3;
        const cx = colX;
        const cy = startY + row * (cellH + gapY) + scrollShift;
        const symId = spinning
          ? SLOT_SYMBOLS[(col * 3 + rIdx + Math.floor(now * 0.022)) % SLOT_SYMBOLS.length].id
          : this.slotGrid[col][rIdx];
        const sym = SLOT_SYMBOLS.find((s) => s.id === symId) || SLOT_SYMBOLS[0];
        const isWinCell = !spinning && winningCells.has(`${col},${rIdx}`);
        const pulse = isWinCell ? 1 + Math.sin(now * 0.015) * 0.035 : 1;

        ctx.save();
        if (isWinCell) {
          ctx.translate(cx + cellW / 2, cy + cellH / 2);
          ctx.scale(pulse, pulse);
          ctx.translate(-(cx + cellW / 2), -(cy + cellH / 2));
        }

        // Tarjeta del símbolo con brillo superior de cristal (sin crear CanvasGradient por celda cada frame)
        this.drawBox(
          ctx,
          cx,
          cy,
          cellW,
          cellH,
          sym.bg,
          isWinCell ? '#ffffff' : sym.color,
          isWinCell ? 2.6 : 1.3
        );
        ctx.fillStyle = 'rgba(4, 8, 18, 0.38)';
        ctx.fillRect(cx + 3, cy + cellH * 0.52, cellW - 6, cellH * 0.44);

        // Brillo superior especular en la celda
        ctx.fillStyle = isWinCell ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.07)';
        ctx.fillRect(cx + 4, cy + 2, cellW - 8, 10);

        // Arte vectorial de alta definición del símbolo
        this.drawSlotSymbolArtwork(ctx, sym, cx + 28, cy + cellH / 2, now, isWinCell);

        ctx.textAlign = 'left';
        ctx.fillStyle = isWinCell ? '#fef08a' : '#ffffff';
        ctx.font = `bold 12px ${FONT_DISPLAY}`;
        const wildMultBadge =
          !spinning && symId === 'WILD' ? ` x${this.slotWildMultipliers[col][rIdx]}` : '';
        ctx.fillText(`${sym.badge}${wildMultBadge}`, cx + 52, cy + 22, cellW - 56);

        ctx.fillStyle = sym.color;
        ctx.font = `bold 9px ${FONT_MONO}`;
        ctx.fillText(`5x:${sym.pay5}x 4x:${sym.pay4}x`, cx + 52, cy + 36, cellW - 56);

        ctx.fillStyle = '#94a3b8';
        ctx.font = `8.5px ${FONT_DISPLAY}`;
        ctx.fillText(
          i18n.currentLang === 'EN' ? sym.nameEn : sym.name,
          cx + 52,
          cy + 49,
          cellW - 56
        );

        ctx.restore();
      }

      // Sombra cilíndrica 3D superior e inferior sobre el tambor (sin crear CanvasGradient por columna)
      ctx.fillStyle = 'rgba(2, 6, 14, 0.46)';
      ctx.fillRect(colX, startY, cellW, 14);
      ctx.fillRect(colX, startY + colH - 14, cellW, 14);

      if (spinning) {
        // Estelas láser verticales de alta velocidad durante el giro
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(colX + 18, startY);
        ctx.lineTo(colX + 18, startY + colH);
        ctx.moveTo(colX + cellW - 18, startY);
        ctx.lineTo(colX + cellW - 18, startY + colH);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 5. Rayos láser dobles en las líneas de pago ganadoras + nodos luminosos
    if (!this.isSlotSpinning && this.winningLines.length > 0) {
      ctx.save();
      for (const winLine of this.winningLines) {
        if (winLine.cells.length < 2) continue;
        // Halo exterior de color
        ctx.strokeStyle = winLine.color;
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        for (let i = 0; i < winLine.cells.length; i++) {
          const [c, r] = winLine.cells[i];
          const px = startX + c * (cellW + gapX) + cellW / 2;
          const pyCell = startY + r * (cellH + gapY) + cellH / 2;
          if (i === 0) ctx.moveTo(px, pyCell);
          else ctx.lineTo(px, pyCell);
        }
        ctx.stroke();

        // Núcleo incandescente blanco
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        for (const [c, r] of winLine.cells) {
          const px = startX + c * (cellW + gapX) + cellW / 2;
          const pyCell = startY + r * (cellH + gapY) + cellH / 2;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = winLine.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, pyCell, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Cartel flotante de Premio si el pulso de victoria está activo
      if (this.lastSlotWinAmount > 0 && this.slotWinPulseTimer > 0) {
        const bannerW = 240;
        const bannerH = 32;
        const bx = leftCx - bannerW / 2;
        const by = machineY + machineH - 36;
        this.drawBox(ctx, bx, by, bannerW, bannerH, 'rgba(69, 26, 3, 0.96)', '#fde047', 2.2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde047';
        ctx.font = `bold 14px ${FONT_MONO}`;
        ctx.fillText(`★ WIN +${this.lastSlotWinAmount} CR ★`, leftCx, by + 21);
      }
      ctx.restore();
    }

    // 6. Botonera inferior de Cyber-Slots con biselado de consola arcade
    const turboBtn = { x: leftCx - 358, y: py + 432, width: 104, height: 42 };
    this.drawBox(
      ctx,
      turboBtn.x,
      turboBtn.y,
      turboBtn.width,
      turboBtn.height,
      this.slotTurboMode ? 'rgba(146, 64, 14, 0.96)' : 'rgba(15, 25, 44, 0.94)',
      this.slotTurboMode ? '#fde047' : '#64748b',
      1.8
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = this.slotTurboMode ? '#fef08a' : '#94a3b8';
    ctx.font = `bold 11.5px ${FONT_DISPLAY}`;
    ctx.fillText(this.slotTurboMode ? '⚡ TURBO: ON' : '⚡ TURBO: OFF', turboBtn.x + 52, turboBtn.y + 26);

    const autoBtn = { x: leftCx - 246, y: py + 432, width: 104, height: 42 };
    this.drawBox(
      ctx,
      autoBtn.x,
      autoBtn.y,
      autoBtn.width,
      autoBtn.height,
      this.slotAutoSpin ? 'rgba(6, 78, 59, 0.96)' : 'rgba(15, 25, 44, 0.94)',
      this.slotAutoSpin ? '#10b981' : '#64748b',
      1.8
    );
    ctx.fillStyle = this.slotAutoSpin ? '#a7f3d0' : '#94a3b8';
    ctx.fillText(this.slotAutoSpin ? '🔄 AUTO: ON' : '🔄 AUTO: OFF', autoBtn.x + 52, autoBtn.y + 26);

    const spinBtn = { x: leftCx - 135, y: py + 432, width: 270, height: 42 };
    const isFS = this.freeSpinsRemaining > 0;
    const spinGrad = ctx.createLinearGradient(spinBtn.x, spinBtn.y, spinBtn.x, spinBtn.y + spinBtn.height);
    if (isFS) {
      spinGrad.addColorStop(0, 'rgba(147, 51, 234, 0.98)');
      spinGrad.addColorStop(1, 'rgba(76, 29, 149, 0.98)');
    } else {
      spinGrad.addColorStop(0, 'rgba(16, 185, 129, 0.96)');
      spinGrad.addColorStop(1, 'rgba(6, 78, 59, 0.98)');
    }
    this.drawBox(
      ctx,
      spinBtn.x,
      spinBtn.y,
      spinBtn.width,
      spinBtn.height,
      spinGrad,
      isFS ? '#f0abfc' : '#6ee7b7',
      2.4
    );
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 13.5px ${FONT_DISPLAY}`;
    const spinLabel = this.isSlotSpinning
      ? i18n.t('⏹ PARAR RODILLOS [ESPACIO]', '⏹ STOP REELS [SPACE]')
      : isFS
      ? i18n.t(
          `🔥 TIRADA GRATIS (${this.freeSpinsRemaining}) • x${this.freeSpinsMultiplier}`,
          `🔥 FREE SPIN (${this.freeSpinsRemaining}) • x${this.freeSpinsMultiplier}`
        )
      : i18n.t(
          `🎰 GIRAR 9 LÍNEAS (${this.currentBet} CR) [ESP]`,
          `🎰 SPIN 9 LINES (${this.currentBet} CR) [SPC]`
        );
    ctx.fillText(spinLabel, spinBtn.x + spinBtn.width / 2, spinBtn.y + 26);

    if (this.gambleAvailable && this.lastSlotWinAmount > 0) {
      const redBtn = { x: leftCx + 144, y: py + 432, width: 104, height: 42 };
      const cyanBtn = { x: leftCx + 254, y: py + 432, width: 104, height: 42 };
      this.drawBox(ctx, redBtn.x, redBtn.y, redBtn.width, redBtn.height, 'rgba(153, 27, 27, 0.96)', '#fb7185', 2.0);
      ctx.fillStyle = '#ffe4e6';
      ctx.font = `bold 10.5px ${FONT_DISPLAY}`;
      ctx.fillText('🔴 DOBLAR x2', redBtn.x + 52, redBtn.y + 18);
      ctx.fillText(`${this.lastSlotWinAmount * 2} CR`, redBtn.x + 52, redBtn.y + 33);

      this.drawBox(ctx, cyanBtn.x, cyanBtn.y, cyanBtn.width, cyanBtn.height, 'rgba(12, 74, 110, 0.96)', '#38bdf8', 2.0);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillText('🔵 DOBLAR x2', cyanBtn.x + 52, cyanBtn.y + 18);
      ctx.fillText(`${this.lastSlotWinAmount * 2} CR`, cyanBtn.x + 52, cyanBtn.y + 33);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.font = `bold 10.5px ${FONT_MONO}`;
      ctx.fillText(
        i18n.t('9 LÍNEAS ACTIVAS • RTP 96.8%', '9 ACTIVE PAYLINES • RTP 96.8%'),
        leftCx + 250,
        py + 449
      );
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(
        i18n.t('4+ 👑 = MEGA JACKPOT + SOMBRERO', '4+ 👑 = MEGA JACKPOT + VIP HAT'),
        leftCx + 250,
        py + 466
      );
    }
  }

  /**
   * Arte vectorial procedural detallado para los 8 símbolos de Cyber-Slots Deluxe.
   */
  private drawSlotSymbolArtwork(
    ctx: CanvasRenderingContext2D,
    sym: SlotSymbolDef,
    cx: number,
    cy: number,
    now: number,
    isWinning: boolean = false
  ): void {
    ctx.save();
    ctx.translate(cx, cy);

    // Aura luminosa de fondo detrás del icono (sin crear CanvasGradient por símbolo cada frame)
    ctx.fillStyle = isWinning ? 'rgba(255, 255, 255, 0.24)' : `${sym.color}26`;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();

    if (sym.id === 'CROWN') {
      // Rayos solares giratorios detrás de la Corona Jackpot
      ctx.save();
      ctx.rotate(now * 0.0015);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
        ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
        ctx.stroke();
      }
      ctx.restore();
      HatRenderer.drawHatIcon(ctx, 'mit_casino', 0, -2, 26, now);
    } else if (sym.id === 'SEVEN') {
      // Triple 777 Vegas con sombra dorada y frente carmesí brillante
      ctx.font = `italic bold 21px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('77', -2, -1);
      ctx.fillStyle = '#f43f5e';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.2;
      ctx.fillText('7', 3, 2);
      ctx.strokeText('7', 3, 2);
    } else if (sym.id === 'GEM') {
      // Diamante multifacético Ethereum/Cian con destellos
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, -11);
      ctx.lineTo(8, -11);
      ctx.lineTo(14, -3);
      ctx.lineTo(0, 14);
      ctx.lineTo(-14, -3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Facetas interiores del diamante
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(-8, -11);
      ctx.lineTo(8, -11);
      ctx.lineTo(5, -3);
      ctx.lineTo(-5, -3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-14, -3);
      ctx.lineTo(14, -3);
      ctx.moveTo(-5, -3);
      ctx.lineTo(0, 14);
      ctx.lineTo(5, -3);
      ctx.stroke();
    } else if (sym.id === 'BELL') {
      // Campana dorada 3D de Casino
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#fef9c3';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, -3, 9, Math.PI, 0, false);
      ctx.lineTo(12, 8);
      ctx.lineTo(-12, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(-2.5, -4.5, 4.2, Math.PI, 0, false);
      ctx.fill();
      // Badajo inferior
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, 10.5, 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (sym.id === 'CHERRY') {
      // Dos cerezas rubí cibernéticas con tallos y hoja esmeralda
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-6, 5);
      ctx.quadraticCurveTo(-2, -6, 4, -12);
      ctx.moveTo(6, 6);
      ctx.quadraticCurveTo(5, -4, 4, -12);
      ctx.stroke();
      // Hoja
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.ellipse(8, -11, 4.5, 2.2, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Frutas rubí con brillo
      for (const [cxF, cyF] of [
        [-6, 6],
        [6, 7],
      ]) {
        ctx.fillStyle = '#e11d48';
        ctx.strokeStyle = '#fda4af';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cxF, cyF, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cxF - 2, cyF - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (sym.id === 'LEMON') {
      // Limón neón brillante con gajos
      ctx.save();
      ctx.rotate(-0.35);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12.5, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.arc(-4, -2.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (sym.id === 'WILD') {
      // Chip Cuántico WILD giratorio
      ctx.save();
      ctx.rotate(Math.sin(now * 0.004) * 0.14);
      ctx.fillStyle = '#064e3b';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const px = Math.cos(a) * 14;
        const py = Math.sin(a) * 14;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#6ee7b7';
      ctx.font = `bold 11px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('W', 0, 1);
      ctx.restore();
    } else if (sym.id === 'SCATTER') {
      // Bóveda Cuántica con anillo de energía y rayo Free Spins
      ctx.fillStyle = '#3b0764';
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(2, -9);
      ctx.lineTo(-5, 1);
      ctx.lineTo(0, 1);
      ctx.lineTo(-2, 9);
      ctx.lineTo(6, -1);
      ctx.lineTo(1, -1);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // ==========================================
  // 2. RENDERIZADO DE CRIPTO-CRASH ($DAW)
  // ==========================================
  private drawCryptoCrashGame(
    ctx: CanvasRenderingContext2D,
    leftCx: number,
    py: number,
    now: number
  ): void {
    const chartX = leftCx - 358;
    const chartY = py + 222;
    const chartW = 716;
    const chartH = 164;

    const bgGrad = ctx.createLinearGradient(chartX, chartY, chartX, chartY + chartH);
    bgGrad.addColorStop(0, 'rgba(6, 12, 26, 0.98)');
    bgGrad.addColorStop(1, 'rgba(11, 20, 38, 0.98)');
    this.drawBox(
      ctx,
      chartX,
      chartY,
      chartW,
      chartH,
      bgGrad,
      this.crashState === 'CRASHED' ? '#f43f5e' : this.crashCashedOut ? '#fbbf24' : '#10b981',
      2.2
    );

    // Cinta superior con el historial de los últimos 10 multiplicadores
    const pillW = 62;
    for (let i = 0; i < Math.min(10, this.crashHistory.length); i++) {
      const val = this.crashHistory[i];
      const px = chartX + 12 + i * (pillW + 7);
      const pyPill = chartY + 8;
      const col =
        val >= 10 ? '#fbbf24' : val >= 3 ? '#10b981' : val >= 1.5 ? '#38bdf8' : '#64748b';
      this.drawBox(ctx, px, pyPill, pillW, 20, 'rgba(15, 23, 42, 0.94)', col, 1.3);
      ctx.textAlign = 'center';
      ctx.fillStyle = col;
      ctx.font = `bold 10px ${FONT_MONO}`;
      ctx.fillText(`${val.toFixed(2)}x`, px + pillW / 2, pyPill + 14);
    }

    const plotX = chartX + 46;
    const plotY = chartY + 34;
    const plotW = chartW - 68;
    const plotH = chartH - 46;

    // Líneas guía horizontales de cotización (1x, 2x, 5x, 10x)
    const levels = ['10.0x', '5.0x', '2.0x', '1.0x'];
    ctx.font = `9px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    for (let i = 0; i < levels.length; i++) {
      const ly = plotY + (i * plotH) / (levels.length - 1);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotX, ly);
      ctx.lineTo(plotX + plotW, ly);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.fillText(levels[i], plotX - 6, ly + 3);
    }

    const progress = Math.min(1, Math.log(Math.max(1, this.crashMultiplier)) / Math.log(15));
    const endX = plotX + Math.max(24, plotW * Math.min(0.93, 0.14 + progress * 0.79));
    const endY = plotY + plotH - Math.max(8, plotH * Math.min(0.88, progress * 0.86));
    const ctrlX = plotX + (endX - plotX) * 0.58;
    const ctrlY = plotY + plotH;

    const lineCol =
      this.crashState === 'CRASHED'
        ? '#f43f5e'
        : this.crashCashedOut
        ? '#fbbf24'
        : '#10b981';

    // Área sombreada bajo la curva estilo TradingView
    const areaGrad = ctx.createLinearGradient(0, endY, 0, plotY + plotH);
    areaGrad.addColorStop(
      0,
      this.crashState === 'CRASHED'
        ? 'rgba(244, 63, 94, 0.35)'
        : this.crashCashedOut
        ? 'rgba(251, 191, 36, 0.35)'
        : 'rgba(16, 185, 129, 0.35)'
    );
    areaGrad.addColorStop(1, 'rgba(6, 12, 26, 0.0)');
    ctx.fillStyle = areaGrad;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
    ctx.lineTo(endX, plotY + plotH);
    ctx.closePath();
    ctx.fill();

    // Curva principal brillante
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
    ctx.stroke();

    // Cohete vectorial $DAW inclinado según la pendiente de la curva
    const angle = Math.atan2(endY - ctrlY, endX - ctrlX);
    ctx.save();
    ctx.translate(endX, endY);
    if (this.crashState === 'CRASHED') {
      // Onda expansiva de explosión Rug Pull
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, 14 + Math.sin(now * 0.02) * 3, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.rotate(angle);
      // Llama propulsora trasera
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.lineTo(-20 - Math.sin(now * 0.04) * 5, 0);
      ctx.lineTo(-10, 4);
      ctx.closePath();
      ctx.fill();
      // Fuselaje del cohete $DAW
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-10, -3);
      ctx.lineTo(-10, 3);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Multiplicador gigante en el centro de la gráfica
    ctx.textAlign = 'center';
    ctx.fillStyle =
      this.crashState === 'CRASHED'
        ? '#f43f5e'
        : this.crashCashedOut
        ? '#fbbf24'
        : '#f8fafc';
    ctx.font = `bold 38px ${FONT_MONO}`;
    ctx.fillText(`${this.crashMultiplier.toFixed(2)}x`, leftCx, chartY + 104);

    ctx.font = `bold 12px ${FONT_DISPLAY}`;
    if (this.crashState === 'CRASHED') {
      ctx.fillStyle = '#fda4af';
      ctx.fillText('💥 RUG PULL // MERCADO COLAPSADO', leftCx, chartY + 132);
    } else if (this.crashCashedOut) {
      ctx.fillStyle = '#fde047';
      ctx.fillText(
        `✓ RETIRADO EN ${this.crashCashoutMult.toFixed(2)}x (+${this.crashWinAmount} CR)`,
        leftCx,
        chartY + 132
      );
    } else if (this.crashState === 'FLYING') {
      const liveWin = Math.round(this.crashActiveBet * this.crashMultiplier);
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(`GANANCIA EN VIVO: ${liveWin} CR`, leftCx, chartY + 132);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(
        i18n.t('PREPARADO PARA DESPEGUE DE $DAW', 'READY FOR $DAW LAUNCH'),
        leftCx,
        chartY + 132
      );
    }

    // Selector de Auto-Cashout
    const autoOpts = [0, 1.5, 2.0, 3.0, 5.0, 10.0];
    for (let i = 0; i < autoOpts.length; i++) {
      const val = autoOpts[i];
      const r = { x: leftCx - 355 + i * 56, y: py + 392, width: 52, height: 28 };
      const active = this.crashAutoCashout === val;
      this.drawBox(
        ctx,
        r.x,
        r.y,
        r.width,
        r.height,
        active ? 'rgba(14, 52, 82, 0.96)' : 'rgba(15, 23, 42, 0.92)',
        active ? '#38bdf8' : '#475569',
        1.4
      );
      ctx.fillStyle = active ? '#ffffff' : '#94a3b8';
      ctx.font = `bold 10px ${FONT_MONO}`;
      ctx.fillText(val === 0 ? 'MANUAL' : `${val}x`, r.x + r.width / 2, r.y + 18);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = `bold 10.5px ${FONT_MONO}`;
    ctx.fillText(
      i18n.t('◄ AUTO-RETIRO AUTOMÁTICO', '◄ AUTOMATIC CASHOUT TARGET'),
      leftCx - 12,
      py + 410
    );

    const actionBtn = { x: leftCx - 160, y: py + 432, width: 320, height: 42 };
    const canCashOut = this.crashState === 'FLYING' && !this.crashCashedOut;
    this.drawBox(
      ctx,
      actionBtn.x,
      actionBtn.y,
      actionBtn.width,
      actionBtn.height,
      canCashOut ? 'rgba(180, 83, 9, 0.98)' : 'rgba(6, 78, 59, 0.98)',
      canCashOut ? '#fde047' : '#10b981',
      2.2
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 13.5px ${FONT_DISPLAY}`;
    const btnLabel = canCashOut
      ? i18n.t(
          `💰 RETIRAR ${Math.round(this.crashActiveBet * this.crashMultiplier)} CR AHORA [ESP]`,
          `💰 CASH OUT ${Math.round(this.crashActiveBet * this.crashMultiplier)} CR NOW [SPC]`
        )
      : this.crashState === 'FLYING'
      ? i18n.t('ESPERANDO FIN DE VUELO...', 'WAITING FOR FLIGHT END...')
      : i18n.t(
          `🚀 LANZAR ORDEN $DAW (${this.currentBet} CR) [ESP]`,
          `🚀 LAUNCH $DAW ORDER (${this.currentBet} CR) [SPC]`
        );
    ctx.fillText(btnLabel, actionBtn.x + actionBtn.width / 2, actionBtn.y + 26);
  }

  // ==========================================
  // 3. RENDERIZADO DE FIREWALL MINES (5x5)
  // ==========================================
  private drawFirewallMinesGame(
    ctx: CanvasRenderingContext2D,
    leftCx: number,
    py: number,
    now: number
  ): void {
    const gridStartX = leftCx - 295;
    const gridStartY = py + 230;
    const cellS = 44;
    const gap = 6;

    // Marco metálico alrededor del tablero 5x5
    this.drawBox(
      ctx,
      gridStartX - 8,
      gridStartY - 8,
      cellS * 5 + gap * 4 + 16,
      cellS * 5 + gap * 4 + 16,
      'rgba(8, 13, 24, 0.96)',
      'rgba(56, 189, 248, 0.45)',
      1.6
    );

    for (let idx = 0; idx < 25; idx++) {
      const c = idx % 5;
      const r = Math.floor(idx / 5);
      const x = gridStartX + c * (cellS + gap);
      const y = gridStartY + r * (cellS + gap);
      const revealed = this.minesRevealed[idx];
      const isMine = this.minesBoard[idx];

      let tileBg = 'rgba(16, 28, 52, 0.96)';
      let stroke = 'rgba(56, 189, 248, 0.55)';
      if (revealed) {
        if (isMine) {
          tileBg = 'rgba(115, 18, 24, 0.98)';
          stroke = '#f43f5e';
        } else {
          tileBg = 'rgba(6, 78, 59, 0.98)';
          stroke = '#10b981';
        }
      }

      this.drawBox(ctx, x, y, cellS, cellS, tileBg, stroke, revealed ? 2.0 : 1.3);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(x + 3, y + 2, cellS - 6, 8);
      const cxTile = x + cellS / 2;
      const cyTile = y + cellS / 2;

      if (revealed) {
        if (isMine) {
          // Bomba naval / Virus Troyano vectorial con púas
          ctx.save();
          ctx.translate(cxTile, cyTile);
          ctx.strokeStyle = '#fda4af';
          ctx.fillStyle = '#e11d48';
          ctx.lineWidth = 1.8;
          for (let s = 0; s < 8; s++) {
            const a = (s * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(-2.5, -2.5, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Diamante Cripto Seguro vectorial
          ctx.save();
          ctx.translate(cxTile, cyTile);
          ctx.fillStyle = '#10b981';
          ctx.strokeStyle = '#a7f3d0';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-7, -10);
          ctx.lineTo(7, -10);
          ctx.lineTo(12, -2);
          ctx.lineTo(0, 11);
          ctx.lineTo(-12, -2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-3, -4, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else {
        // Puerta de bóveda encriptada sin abrir
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cxTile, cyTile, 10 + Math.sin(now * 0.003 + idx) * 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = `bold 10px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(`${idx + 1}`, cxTile, cyTile + 3.5);
      }
    }

    const infoX = leftCx + 15;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `bold 12px ${FONT_DISPLAY}`;
    ctx.fillText(
      i18n.t('CANTIDAD DE VIRUS TROYANOS (RIESGO):', 'TROJAN VIRUS COUNT (RISK):'),
      infoX,
      py + 246
    );

    const mineOptions = [1, 3, 5, 8, 13];
    for (let i = 0; i < mineOptions.length; i++) {
      const count = mineOptions[i];
      const btn = { x: infoX + i * 66, y: py + 258, width: 60, height: 32 };
      const selected = this.minesCount === count;
      this.drawBox(
        ctx,
        btn.x,
        btn.y,
        btn.width,
        btn.height,
        selected ? 'rgba(153, 27, 27, 0.96)' : 'rgba(15, 23, 42, 0.92)',
        selected ? '#f43f5e' : '#64748b',
        selected ? 2 : 1.2
      );
      ctx.textAlign = 'center';
      ctx.fillStyle = selected ? '#ffffff' : '#cbd5e1';
      ctx.font = `bold 11px ${FONT_MONO}`;
      ctx.fillText(`${count} 💣`, btn.x + 30, btn.y + 20);
    }

    const teleBox = { x: infoX, y: py + 300, width: 324, height: 70 };
    this.drawBox(ctx, teleBox.x, teleBox.y, teleBox.width, teleBox.height, 'rgba(11, 19, 34, 0.96)', '#38bdf8', 1.4);

    const nextMult = this.computeMinesMultiplier(this.minesSafeOpened + 1, this.minesCount);
    const activeBet = this.minesState === 'PLAYING' ? this.minesActiveBet : this.currentBet;
    const cashVal = Math.round(activeBet * this.minesCurrentMult);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#10b981';
    ctx.font = `bold 14px ${FONT_MONO}`;
    ctx.fillText(
      `${i18n.t('ACTUAL', 'CURRENT')}: ${this.minesCurrentMult.toFixed(2)}x (${cashVal} CR)`,
      teleBox.x + 14,
      teleBox.y + 28
    );

    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold 12px ${FONT_MONO}`;
    ctx.fillText(
      `${i18n.t('PRÓXIMO NODO', 'NEXT TILE')}: ${nextMult.toFixed(2)}x   •   💎 ${this.minesSafeOpened}/${25 - this.minesCount}`,
      teleBox.x + 14,
      teleBox.y + 52
    );

    const mainBtn = { x: infoX, y: py + 380, width: 324, height: 42 };
    const canCash = this.minesState === 'PLAYING' && this.minesSafeOpened > 0;
    this.drawBox(
      ctx,
      mainBtn.x,
      mainBtn.y,
      mainBtn.width,
      mainBtn.height,
      canCash ? 'rgba(180, 83, 9, 0.98)' : 'rgba(6, 78, 59, 0.98)',
      canCash ? '#fde047' : '#10b981',
      2.2
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 13px ${FONT_DISPLAY}`;
    const mainLabel = canCash
      ? i18n.t(`💰 PLANTARSE Y COBRAR ${cashVal} CR`, `💰 CASH OUT ${cashVal} CR NOW`)
      : this.minesState === 'PLAYING'
      ? i18n.t('ELIGE UN NODO DEL TABLERO 5×5', 'PICK A NODE ON THE 5×5 GRID')
      : i18n.t(`💣 INICIAR PARTIDA (${this.currentBet} CR)`, `💣 START MINES (${this.currentBet} CR)`);
    ctx.fillText(mainLabel, mainBtn.x + mainBtn.width / 2, mainBtn.y + 26);

    const randBtn = { x: infoX, y: py + 430, width: 324, height: 36 };
    this.drawBox(ctx, randBtn.x, randBtn.y, randBtn.width, randBtn.height, 'rgba(14, 52, 82, 0.95)', '#38bdf8', 1.5);
    ctx.fillStyle = '#e0f2fe';
    ctx.font = `bold 12px ${FONT_DISPLAY}`;
    ctx.fillText(
      i18n.t('🎲 ABRIR NODO ALEATORIO', '🎲 PICK RANDOM SAFE NODE'),
      randBtn.x + randBtn.width / 2,
      randBtn.y + 22
    );
  }

  // ==========================================
  // 4. RENDERIZADO DE RULETA EUROPEA NEÓN (0-18 + BOLA + TAPETE)
  // ==========================================
  private drawQuantumWheelGame(
    ctx: CanvasRenderingContext2D,
    leftCx: number,
    py: number,
    now: number
  ): void {
    const wheelCx = leftCx - 226;
    const wheelCy = py + 336;
    const outerR = 108;
    const pocketOuterR = 86;
    const pocketInnerR = 46;

    // 1. Chasis circular de la Ruleta Europea (Pista exterior + deflectores diamante)
    ctx.save();
    ctx.translate(wheelCx, wheelCy);

    // Aro exterior de obsidiana/caoba cibernética con borde dorado
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pista de rodadura de la bola
    ctx.fillStyle = '#131c31';
    ctx.beginPath();
    ctx.arc(0, 0, outerR - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, outerR - 12, 0, Math.PI * 2);
    ctx.stroke();

    // 8 Deflectores metálicos en forma de diamante en la pista exterior
    for (let d = 0; d < 8; d++) {
      const da = (d * Math.PI * 2) / 8;
      ctx.save();
      ctx.rotate(da);
      ctx.fillStyle = d % 2 === 0 ? '#fde047' : '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(outerR - 12, -3.5);
      ctx.lineTo(outerR - 7, 0);
      ctx.lineTo(outerR - 12, 3.5);
      ctx.lineTo(outerR - 15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 2. Rotor giratorio con 19 casillas numeradas (0 verde + 1..18 rojo/negro)
    const sliceAngle = (Math.PI * 2) / ROULETTE_POCKETS.length;
    ctx.save();
    ctx.rotate(this.wheelAngle);

    for (let i = 0; i < ROULETTE_POCKETS.length; i++) {
      const pocket = ROULETTE_POCKETS[i];
      const a0 = i * sliceAngle;
      const a1 = a0 + sliceAngle;
      const isWinner = !this.isWheelSpinning && i === this.wheelWinningPocketIdx;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, pocketOuterR, a0, a1);
      ctx.closePath();
      ctx.fillStyle = isWinner ? '#f59e0b' : pocket.color;
      ctx.fill();

      // Anillo interior más oscuro para profundidad 2.5D
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, pocketInnerR + 12, a0, a1);
      ctx.closePath();
      ctx.fillStyle = isWinner ? '#b45309' : pocket.colorDark;
      ctx.fill();

      // Separadores dorados (frets)
      ctx.strokeStyle = isWinner ? '#fef08a' : 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = isWinner ? 2.0 : 1.0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a0) * pocketInnerR, Math.sin(a0) * pocketInnerR);
      ctx.lineTo(Math.cos(a0) * pocketOuterR, Math.sin(a0) * pocketOuterR);
      ctx.stroke();

      // Número de casilla orientado radialmente
      ctx.save();
      ctx.rotate(a0 + sliceAngle / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isWinner ? '#090d16' : '#f8fafc';
      ctx.font = `bold 9.5px ${FONT_MONO}`;
      ctx.fillText(String(pocket.num), pocketOuterR - 11, 0);
      ctx.restore();
    }

    // Aro dorado interior entre bolsillos y torreta central
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, pocketOuterR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#0b1222';
    ctx.beginPath();
    ctx.arc(0, 0, pocketInnerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Aspas metálicas de la torreta central (giran con el rotor)
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.6;
    for (let s = 0; s < 4; s++) {
      const sa = (s * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * 16, Math.sin(sa) * 16);
      ctx.lineTo(Math.cos(sa) * (pocketInnerR - 6), Math.sin(sa) * (pocketInnerR - 6));
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * (pocketInnerR - 6), Math.sin(sa) * (pocketInnerR - 6), 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Bola física plateada/neón orbitando en contra-giro
    const ballR = outerR * this.wheelBallRadiusRatio;
    const bx = Math.cos(this.wheelBallAngle) * ballR;
    const by = Math.sin(this.wheelBallAngle) * ballR;
    // Estela luminosa cuando la bola va rápida
    if (this.isWheelSpinning) {
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.35)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, ballR, this.wheelBallAngle, this.wheelBallAngle + 0.32);
      ctx.stroke();
    }
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(bx, by, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx - 1.5, by - 1.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 4. Visor central fijo con el último número ganador (sin rotar)
    const lastNum = this.wheelHistory[0] ?? 0;
    const lastCol =
      lastNum === 0 ? '#10b981' : ROULETTE_RED_NUMS.has(lastNum) ? '#e11d48' : '#334155';
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = this.isWheelSpinning ? '#38bdf8' : lastCol;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.isWheelSpinning ? '#38bdf8' : '#ffffff';
    ctx.font = `bold 14px ${FONT_MONO}`;
    ctx.fillText(this.isWheelSpinning ? '?' : String(lastNum), 0, 1);
    ctx.restore();

    // 5. Cinta de historial de los últimos 8 números bajo la ruleta
    const histCount = Math.min(8, this.wheelHistory.length);
    const pillW = 26;
    const pillGap = 4;
    const histStartX = wheelCx - (histCount * pillW + (histCount - 1) * pillGap) / 2;
    for (let i = 0; i < histCount; i++) {
      const n = this.wheelHistory[i];
      const px = histStartX + i * (pillW + pillGap);
      const col = n === 0 ? '#10b981' : ROULETTE_RED_NUMS.has(n) ? '#e11d48' : '#334155';
      this.drawBox(
        ctx,
        px,
        py + 450,
        pillW,
        20,
        i === 0 ? col : 'rgba(15, 23, 42, 0.94)',
        col,
        i === 0 ? 1.8 : 1.1
      );
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 10px ${FONT_MONO}`;
      ctx.fillText(String(n), px + pillW / 2, py + 464);
    }

    // 6. Tapete de Apuestas Interactivo (Derecha)
    const feltX = leftCx - 92;
    const feltW = 446;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `bold 11px ${FONT_DISPLAY}`;
    ctx.fillText(
      i18n.t('TAPETE NEÓN • PLENO (x18 / 0=x20) O EXTERNAS:', 'NEON FELT • STRAIGHT (x18 / 0=x20) OR OUTSIDE:'),
      feltX,
      py + 236
    );
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde047';
    ctx.font = `bold 10.5px ${FONT_MONO}`;
    ctx.fillText(this.getRouletteBetLabel(), feltX + feltW, py + 236);

    // Casilla 0 verde (3 filas de alto)
    const zeroSelected = this.isNumberCoveredByBet(0);
    const zeroWon = !this.isWheelSpinning && this.wheelWinningPocketIdx >= 0 && ROULETTE_POCKETS[this.wheelWinningPocketIdx].num === 0;
    this.drawBox(
      ctx,
      feltX,
      py + 244,
      42,
      96,
      zeroSelected ? 'rgba(16, 185, 129, 0.95)' : 'rgba(6, 78, 59, 0.92)',
      zeroWon ? '#ffffff' : zeroSelected ? '#fde047' : '#10b981',
      zeroSelected || zeroWon ? 2.4 : 1.3
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 16px ${FONT_MONO}`;
    ctx.fillText('0', feltX + 21, py + 292);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = `bold 8.5px ${FONT_MONO}`;
    ctx.fillText('x20', feltX + 21, py + 310);

    // Parrilla 6x3 de números 1..18
    const gridStartX = feltX + 47;
    const gridStartY = py + 244;
    const cellW = 63;
    const cellH = 30;
    const gapX = 4;
    const gapY = 3;
    const winNum =
      !this.isWheelSpinning && this.wheelWinningPocketIdx >= 0
        ? ROULETTE_POCKETS[this.wheelWinningPocketIdx].num
        : -1;

    for (let col = 0; col < 6; col++) {
      for (let row = 0; row < 3; row++) {
        const num = col * 3 + (3 - row);
        const rx = gridStartX + col * (cellW + gapX);
        const ry = gridStartY + row * (cellH + gapY);
        const isRed = ROULETTE_RED_NUMS.has(num);
        const covered = this.isNumberCoveredByBet(num);
        const isWinCell = num === winNum;

        const bg = isRed
          ? covered
            ? 'rgba(225, 29, 72, 0.96)'
            : 'rgba(136, 19, 55, 0.85)'
          : covered
          ? 'rgba(51, 65, 85, 0.98)'
          : 'rgba(15, 23, 42, 0.92)';

        this.drawBox(
          ctx,
          rx,
          ry,
          cellW,
          cellH,
          bg,
          isWinCell ? '#ffffff' : covered ? '#fde047' : isRed ? '#fb7185' : '#475569',
          isWinCell ? 2.6 : covered ? 2.0 : 1.1
        );

        ctx.textAlign = 'center';
        ctx.fillStyle = isWinCell ? '#fde047' : '#ffffff';
        ctx.font = `bold 12.5px ${FONT_MONO}`;
        ctx.fillText(String(num), rx + cellW / 2, ry + 19.5);

        // Ficha dorada en el número si es apuesta Pleno
        if (this.rouletteBetType === 'STRAIGHT' && this.rouletteStraightNum === num) {
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(rx + cellW - 10, ry + 10, 4.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Fila 1 de apuestas externas: Terceras (x3)
    const thirdDefs: { id: RouletteBetType; label: string }[] = [
      { id: 'LOW_6', label: '1 – 6  (x3)' },
      { id: 'MID_6', label: '7 – 12  (x3)' },
      { id: 'HIGH_6', label: '13 – 18  (x3)' },
    ];
    for (let i = 0; i < thirdDefs.length; i++) {
      const td = thirdDefs[i];
      const active = this.rouletteBetType === td.id;
      const rx = feltX + i * 151;
      this.drawBox(
        ctx,
        rx,
        py + 346,
        144,
        30,
        active ? 'rgba(88, 28, 135, 0.96)' : 'rgba(15, 23, 42, 0.92)',
        active ? '#e879f9' : '#475569',
        active ? 2.2 : 1.2
      );
      ctx.textAlign = 'center';
      ctx.fillStyle = active ? '#ffffff' : '#cbd5e1';
      ctx.font = `bold 11px ${FONT_MONO}`;
      ctx.fillText(td.label, rx + 72, py + 365);
    }

    // Fila 2 de apuestas externas: Dobles (x2)
    const evenDefs: { id: RouletteBetType; label: string; stroke: string; activeBg: string }[] = [
      { id: 'RED', label: i18n.t('🔴 ROJO (x2)', '🔴 RED (x2)'), stroke: '#f43f5e', activeBg: 'rgba(136, 19, 55, 0.96)' },
      { id: 'BLACK', label: i18n.t('⚫ NEGRO (x2)', '⚫ BLACK (x2)'), stroke: '#94a3b8', activeBg: 'rgba(30, 41, 59, 0.98)' },
      { id: 'EVEN', label: i18n.t('PAR (x2)', 'EVEN (x2)'), stroke: '#38bdf8', activeBg: 'rgba(12, 74, 110, 0.96)' },
      { id: 'ODD', label: i18n.t('IMPAR (x2)', 'ODD (x2)'), stroke: '#fbbf24', activeBg: 'rgba(120, 53, 15, 0.96)' },
    ];
    for (let i = 0; i < evenDefs.length; i++) {
      const ed = evenDefs[i];
      const active = this.rouletteBetType === ed.id;
      const rx = feltX + i * 113;
      this.drawBox(
        ctx,
        rx,
        py + 382,
        107,
        32,
        active ? ed.activeBg : 'rgba(15, 23, 42, 0.92)',
        active ? ed.stroke : '#475569',
        active ? 2.2 : 1.2
      );
      ctx.textAlign = 'center';
      ctx.fillStyle = active ? '#ffffff' : '#cbd5e1';
      ctx.font = `bold 10.5px ${FONT_DISPLAY}`;
      ctx.fillText(ed.label, rx + 53.5, py + 402);
    }

    // Botón principal de lanzar bola
    const spinBtn = { x: feltX, y: py + 422, width: feltW, height: 48 };
    const pulseBorder = this.isWheelSpinning ? '#38bdf8' : Math.sin(now * 0.006) > 0 ? '#6ee7b7' : '#10b981';
    this.drawBox(
      ctx,
      spinBtn.x,
      spinBtn.y,
      spinBtn.width,
      spinBtn.height,
      this.isWheelSpinning ? 'rgba(15, 23, 42, 0.96)' : 'rgba(6, 78, 59, 0.98)',
      pulseBorder,
      2.2
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 13px ${FONT_DISPLAY}`;
    ctx.fillText(
      this.isWheelSpinning
        ? i18n.t('🎡 BOLA GIRANDO EN PISTA...', '🎡 BALL SPINNING ON TRACK...')
        : i18n.t(
            `🎡 LANZAR BOLA • ${this.getRouletteBetLabel()} (${this.currentBet} CR) [ESP]`,
            `🎡 SPIN BALL • ${this.getRouletteBetLabel()} (${this.currentBet} CR) [SPC]`
          ),
      spinBtn.x + spinBtn.width / 2,
      spinBtn.y + 29,
      spinBtn.width - 20
    );
  }

  // ==========================================
  // 5. BAHÍA DERECHA VIP DEL CASINO
  // ==========================================
  private drawCasinoVipRightBay(
    ctx: CanvasRenderingContext2D,
    bayX: number,
    bayY: number,
    bayW: number,
    bayH: number,
    meta: MetaSystem,
    now: number
  ): void {
    const cx = bayX + bayW / 2;

    const bayGrad = ctx.createLinearGradient(bayX, bayY, bayX, bayY + bayH);
    bayGrad.addColorStop(0, 'rgba(18, 14, 34, 0.98)');
    bayGrad.addColorStop(0.5, 'rgba(9, 13, 26, 0.98)');
    bayGrad.addColorStop(1, 'rgba(15, 22, 38, 0.98)');
    this.drawBox(ctx, bayX, bayY, bayW, bayH, bayGrad, '#fbbf24', 2.0);

    // 1. Marquesina Dorada de Bote Progresivo MEGA JACKPOT
    const jpGrad = ctx.createLinearGradient(bayX + 14, bayY + 14, bayX + 14, bayY + 78);
    jpGrad.addColorStop(0, 'rgba(120, 53, 15, 0.96)');
    jpGrad.addColorStop(1, 'rgba(46, 16, 4, 0.98)');
    this.drawBox(ctx, bayX + 14, bayY + 14, bayW - 28, 66, jpGrad, '#fde047', 2.2);

    this.drawSpinningGoldCoin(ctx, bayX + 34, bayY + 47, 10, now);
    this.drawSpinningGoldCoin(ctx, bayX + bayW - 34, bayY + 47, 10, now + 400);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.font = `bold 10.5px ${FONT_MONO}`;
    ctx.fillText('👑 MEGA JACKPOT PROGRESIVO 👑', cx, bayY + 33);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 23px ${FONT_MONO}`;
    ctx.fillText(`${this.progressiveJackpot.toLocaleString('en-US')} CR`, cx, bayY + 64);

    // 2. Vitrina Holográfica de la Corona de Cripto-Magnate VIP
    const hasCrown = meta.unlockedHats.has('mit_casino');
    const isEquipped = meta.equippedHatId === 'mit_casino';
    this.drawBox(
      ctx,
      bayX + 14,
      bayY + 88,
      bayW - 28,
      132,
      hasCrown ? 'rgba(6, 52, 42, 0.94)' : 'rgba(28, 16, 52, 0.94)',
      hasCrown ? '#10b981' : '#c084fc',
      1.6
    );

    // Pedestal circular luminoso bajo la Corona
    ctx.save();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(bayX + 48, bayY + 140, 22, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    HatRenderer.drawHatIcon(
      ctx,
      'mit_casino',
      bayX + 48,
      bayY + 122 + Math.sin(now * 0.004) * 2.5,
      36,
      now
    );

    ctx.textAlign = 'left';
    ctx.fillStyle = '#fde047';
    ctx.font = `bold 11.5px ${FONT_DISPLAY}`;
    ctx.fillText('CORONA CRIPTO-MAGNATE', bayX + 82, bayY + 112);

    ctx.fillStyle = '#f43f5e';
    ctx.font = `bold 9.5px ${FONT_MONO}`;
    ctx.fillText('RELIQUIA MÍTICA VIP CASINO', bayX + 82, bayY + 127);

    ctx.fillStyle = '#a3e635';
    ctx.font = `bold 9.5px ${FONT_MONO}`;
    ctx.fillText('+36% Daño • +30% Crít • +22% Vel', bayX + 82, bayY + 143);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `10px ${FONT_DISPLAY}`;
    ctx.fillText(
      hasCrown
        ? i18n.t('¡Trofeo VIP en tu colección!', 'VIP Trophy in your collection!')
        : i18n.t('Exclusiva de Cyber-Slots (4+ 👑 o línea de 5)', 'Exclusive to Cyber-Slots (4+ 👑 or 5-in-a-row)'),
      cx,
      bayY + 172
    );

    const crownBtn = { x: bayX + 18, y: bayY + 184, width: bayW - 36, height: 30 };
    this.drawBox(
      ctx,
      crownBtn.x,
      crownBtn.y,
      crownBtn.width,
      crownBtn.height,
      hasCrown
        ? isEquipped
          ? 'rgba(16, 185, 129, 0.25)'
          : 'rgba(14, 52, 82, 0.95)'
        : meta.coins < 15
        ? 'rgba(6, 78, 59, 0.96)'
        : 'rgba(15, 23, 42, 0.9)',
      hasCrown ? '#10b981' : meta.coins < 15 ? '#10b981' : '#64748b',
      1.4
    );
    ctx.fillStyle = hasCrown ? '#a7f3d0' : meta.coins < 15 ? '#6ee7b7' : '#94a3b8';
    ctx.font = `bold 10.5px ${FONT_MONO}`;
    ctx.fillText(
      hasCrown
        ? isEquipped
          ? '[✓] CORONA VIP EQUIPADA'
          : '▸ CLIC PARA EQUIPAR CORONA VIP'
        : meta.coins < 15
        ? '⚡ [CLIC] MINAR +15 CR GRATIS'
        : '🔒 BLOQUEADA (PREMIO VIP)',
      cx,
      crownBtn.y + 19
    );

    // 3. Estadísticas de Sesión
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.font = `bold 11px ${FONT_MONO}`;
    ctx.fillText('// TELEMETRÍA DE SESIÓN VIP', bayX + 18, bayY + 242);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `bold 11px ${FONT_MONO}`;
    ctx.fillText(`JUGADAS: ${this.sessionPlays}`, bayX + 18, bayY + 262);
    ctx.fillText(`RÉCORD PREMIO: +${this.sessionBiggestWin} CR`, bayX + 18, bayY + 280);

    const netCol = this.sessionNetProfit >= 0 ? '#10b981' : '#f43f5e';
    const netSign = this.sessionNetProfit >= 0 ? '+' : '';
    ctx.fillStyle = netCol;
    ctx.fillText(`BALANCE SESIÓN: ${netSign}${this.sessionNetProfit} CR`, bayX + 18, bayY + 298);

    // 4. Historial de últimas jugadas
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold 11px ${FONT_MONO}`;
    ctx.fillText('// REGISTRO DE ÚLTIMAS TIRADAS', bayX + 18, bayY + 324);

    if (this.history.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = `11px ${FONT_DISPLAY}`;
      ctx.fillText(
        i18n.t('Haz tu primera jugada en el Casino...', 'Place your first bet in the Casino...'),
        bayX + 18,
        bayY + 348
      );
    } else {
      for (let i = 0; i < Math.min(5, this.history.length); i++) {
        const h = this.history[i];
        const ry = bayY + 334 + i * 22;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(bayX + 16, ry, bayW - 32, 19);
        ctx.fillStyle = h.netDelta >= 0 ? '#10b981' : '#f43f5e';
        ctx.fillRect(bayX + 16, ry, 3, 19);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#e2e8f0';
        ctx.font = `10.5px ${FONT_DISPLAY}`;
        ctx.fillText(`${h.label} (${h.multText})`, bayX + 24, ry + 13.5);

        ctx.textAlign = 'right';
        ctx.fillStyle = h.netDelta >= 0 ? '#10b981' : '#f43f5e';
        ctx.font = `bold 10.5px ${FONT_MONO}`;
        ctx.fillText(`${h.netDelta >= 0 ? '+' : ''}${h.netDelta} CR`, bayX + bayW - 22, ry + 13.5);
      }
    }

    if (meta.coins < 20) {
      const faucetBtn = { x: bayX + 18, y: bayY + 452, width: bayW - 36, height: 32 };
      this.drawBox(
        ctx,
        faucetBtn.x,
        faucetBtn.y,
        faucetBtn.width,
        faucetBtn.height,
        'rgba(6, 78, 59, 0.96)',
        '#10b981',
        1.8
      );
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 11px ${FONT_DISPLAY}`;
      ctx.fillText(
        this.faucetCooldown > 0
          ? `⏳ MINANDO CRIPTO (${Math.ceil(this.faucetCooldown)}s)...`
          : '⚡ [CLIC AQUÍ] MINAR +20 CR GRATIS',
        cx,
        faucetBtn.y + 20
      );
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = `10px ${FONT_MONO}`;
      ctx.fillText('[1-4] CAMBIAR JUEGO • [ESPACIO] JUGAR', cx, bayY + 474);
    }
  }

  private drawBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string | CanvasGradient,
    stroke: string,
    lineWidth: number = 1.5
  ): void {
    const cut = 6;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w - cut, y);
    ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + cut, y + h);
    ctx.lineTo(x, y + h - cut);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
