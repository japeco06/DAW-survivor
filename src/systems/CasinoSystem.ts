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

interface WheelSector {
  label: string;
  mult: number;
  color: string;
  colorGroup: 'RED' | 'CYAN' | 'GREEN' | 'DARK';
}

const FONT_DISPLAY = '"Segoe UI", "Inter", system-ui, -apple-system, sans-serif';
const FONT_MONO = '"JetBrains Mono", Consolas, monospace';
const CASINO_JACKPOT_STORAGE_KEY = 'daw_survivor_casino_jackpot_v1';

const SLOT_SYMBOLS: SlotSymbolDef[] = [
  {
    id: 'CHERRY',
    name: 'Bit-Cherry',
    nameEn: 'Bit-Cherry',
    badge: '🍒',
    color: '#fb7185',
    bg: 'rgba(76, 5, 25, 0.92)',
    weight: 26,
    pay3: 1.2,
    pay4: 3.5,
    pay5: 10,
  },
  {
    id: 'LEMON',
    name: 'Neon-Citrus',
    nameEn: 'Neon-Citrus',
    badge: '🍋',
    color: '#facc15',
    bg: 'rgba(66, 32, 6, 0.92)',
    weight: 23,
    pay3: 1.6,
    pay4: 4.5,
    pay5: 14,
  },
  {
    id: 'BELL',
    name: 'Cyber-Bell',
    nameEn: 'Cyber-Bell',
    badge: '🔔',
    color: '#fb923c',
    bg: 'rgba(67, 20, 7, 0.92)',
    weight: 18,
    pay3: 2.5,
    pay4: 7.5,
    pay5: 22,
  },
  {
    id: 'GEM',
    name: 'Ether-Gem',
    nameEn: 'Ether-Gem',
    badge: '💎',
    color: '#38bdf8',
    bg: 'rgba(12, 45, 72, 0.94)',
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
    bg: 'rgba(88, 12, 32, 0.95)',
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
    badge: '⚡FS',
    color: '#c084fc',
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
    badge: '👑VIP',
    color: '#fbbf24',
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

const WHEEL_SECTORS: WheelSector[] = [
  { label: '👑 25x', mult: 25, color: '#10b981', colorGroup: 'GREEN' },
  { label: '0x', mult: 0, color: '#1e293b', colorGroup: 'DARK' },
  { label: '2.0x', mult: 2.0, color: '#f43f5e', colorGroup: 'RED' },
  { label: '0.5x', mult: 0.5, color: '#334155', colorGroup: 'DARK' },
  { label: '1.5x', mult: 1.5, color: '#38bdf8', colorGroup: 'CYAN' },
  { label: '0x', mult: 0, color: '#1e293b', colorGroup: 'DARK' },
  { label: '3.0x', mult: 3.0, color: '#f43f5e', colorGroup: 'RED' },
  { label: '1.2x', mult: 1.2, color: '#38bdf8', colorGroup: 'CYAN' },
  { label: '5.0x', mult: 5.0, color: '#f43f5e', colorGroup: 'RED' },
  { label: '0x', mult: 0, color: '#1e293b', colorGroup: 'DARK' },
  { label: '1.5x', mult: 1.5, color: '#38bdf8', colorGroup: 'CYAN' },
  { label: '0.5x', mult: 0.5, color: '#334155', colorGroup: 'DARK' },
  { label: '2.0x', mult: 2.0, color: '#f43f5e', colorGroup: 'RED' },
  { label: '0x', mult: 0, color: '#1e293b', colorGroup: 'DARK' },
  { label: '10x', mult: 10.0, color: '#38bdf8', colorGroup: 'CYAN' },
  { label: '1.2x', mult: 1.2, color: '#f43f5e', colorGroup: 'RED' },
];

export class CasinoSystem {
  public activeGame: CasinoGameId = 'SLOTS';
  public currentBet: number = 20;
  public progressiveJackpot: number = 500;
  public statusBanner: string = '';
  public statusColor: string = '#fbbf24';

  // Estadísticas de sesión
  public sessionPlays: number = 0;
  public sessionNetProfit: number = 0;
  public sessionBiggestWin: number = 0;
  public history: CasinoHistoryEntry[] = [];
  private faucetCooldown: number = 0;

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
  public crashAutoCashout: number = 0; // 0 = OFF, else 1.5, 2.0, 3.0, 5.0, 10.0
  public crashHistory: number[] = [1.42, 3.85, 1.12, 8.64, 2.15, 1.04, 5.3, 1.78, 14.2, 2.05];
  private crashActiveBet: number = 20;

  // ==========================================
  // 3. ESTADO DE FIREWALL MINES (5x5)
  // ==========================================
  public minesCount: number = 3; // 1, 3, 5, 8, 13
  public minesState: 'IDLE' | 'PLAYING' | 'BUSTED' | 'CASHED' = 'IDLE';
  public minesBoard: boolean[] = Array(25).fill(false); // true = mine
  public minesRevealed: boolean[] = Array(25).fill(false);
  public minesSafeOpened: number = 0;
  public minesCurrentMult: number = 1.0;
  private minesActiveBet: number = 20;

  // ==========================================
  // 4. ESTADO DE RULETA CUÁNTICA (WHEEL)
  // ==========================================
  public wheelAngle: number = 0;
  public wheelVelocity: number = 0;
  public isWheelSpinning: boolean = false;
  public wheelBetMode: 'MULTIPLIER' | 'RED' | 'CYAN' | 'GREEN' = 'MULTIPLIER';
  private wheelLastSectorIdx: number = -1;
  private wheelActiveBet: number = 20;
  public wheelLastResultText: string = '';

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
      // Ignorar errores de storage
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
    this.progressiveJackpot = Math.min(999999, Math.floor(this.progressiveJackpot + Math.max(1, bet * 0.18)));
    this.saveJackpot();
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

    // 1. Actualizar rodillos de Cyber-Slots
    if (this.isSlotSpinning) {
      let anyStillSpinning = false;
      for (let col = 0; col < 5; col++) {
        if (this.reelSpinTimers[col] > 0) {
          const prev = this.reelSpinTimers[col];
          this.reelSpinTimers[col] = Math.max(0, prev - dt);
          this.reelScrollOffsets[col] = (this.reelScrollOffsets[col] + dt * 24) % 1;
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
      // Crecimiento exponencial suave: 1.00x -> 2.00x en ~3.2s, luego acelera
      const nextMult = Number(Math.pow(Math.E, 0.22 * Math.pow(this.crashElapsed, 1.24)).toFixed(2));
      this.crashMultiplier = Math.max(1.0, nextMult);

      // Comprobar Auto-Cashout
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

    // 4. Actualizar física de la Ruleta Cuántica
    if (this.isWheelSpinning) {
      this.wheelAngle = (this.wheelAngle + this.wheelVelocity * dt) % (Math.PI * 2);
      this.wheelVelocity *= Math.pow(0.24, dt); // Fricción suave

      const sectorAngle = (Math.PI * 2) / WHEEL_SECTORS.length;
      const pointerAngle = (Math.PI * 1.5 - this.wheelAngle + Math.PI * 4) % (Math.PI * 2);
      const currentSectorIdx = Math.floor(pointerAngle / sectorAngle) % WHEEL_SECTORS.length;
      if (currentSectorIdx !== this.wheelLastSectorIdx) {
        this.wheelLastSectorIdx = currentSectorIdx;
        sound.playCasinoTick(0.95 + Math.min(0.5, this.wheelVelocity * 0.04));
      }

      if (this.wheelVelocity < 0.14) {
        this.wheelVelocity = 0;
        this.isWheelSpinning = false;
        this.resolveWheelSpin(currentSectorIdx, meta, sound);
      }
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
      // Parada instantánea (Slam Stop) si ya está girando
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

    // Generar la nueva matriz 5x3 y multiplicadores Wild (x2 o x3)
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

    // 1. Evaluar las 9 líneas de pago de izquierda a derecha
    for (let lIdx = 0; lIdx < PAYLINES_5X3.length; lIdx++) {
      const lineDef = PAYLINES_5X3[lIdx];
      let targetSym: SlotSymbolId | null = null;
      let matchCount = 0;
      let wildMult = 1;
      const cells: [number, number][] = [];

      for (let col = 0; col < 5; col++) {
        const row = lineDef.rows[col];
        const cellSym = this.slotGrid[col][row];
        if (cellSym === 'SCATTER') break; // Scatter paga en cualquier posición, no bloquea pero corta línea normal

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
        // Dividimos entre 3 para equilibrar las 9 líneas activas simultáneas con RTP ~96.5%
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

    // 2. Evaluar Scatters (⚡ Bóveda Free Spins) y Coronas VIP (👑 Mega Jackpot) en toda la matriz 5x3
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
      this.slotWinPulseTimer = 2.6;
      this.gambleAvailable = !this.slotAutoSpin && !wonMegaJackpot;
      const isBig = totalWin >= bet * 4 || wonMegaJackpot || triggeredFreeSpins > 0;
      sound.playCasinoWin(isBig);

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

  /**
   * Función "Doble o Nada (Gamble x2)" al acertar color Rojo o Cian tras ganar en Slots.
   */
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
    // Distribución justa estilo Crash (~3% instant rug a 1.00x-1.05x, cola larga hasta 100x)
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
    this.statusBanner = i18n.t(
      `💰 ¡RETIRADA A TIEMPO EN ${this.crashCashoutMult.toFixed(2)}x! COBRASTE +${this.crashWinAmount} CR`,
      `💰 CASHED OUT AT ${this.crashCashoutMult.toFixed(2)}x! COLLECTED +${this.crashWinAmount} CR`
    );
    this.statusColor = '#10b981';

    if (this.crashCashoutMult >= 10.0) {
      this.tryUnlockVipCrown(meta, sound, 'RETIRADA 10x+ EN CRIPTO-CRASH');
    }

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
    const mult = (0.97 / Math.max(0.0001, prob));
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
      // Tocó un Virus Troyano
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

    // Nodo seguro
    this.minesSafeOpened++;
    this.minesCurrentMult = this.computeMinesMultiplier(this.minesSafeOpened, this.minesCount);
    sound.playCasinoTick(1.0 + this.minesSafeOpened * 0.08);

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
    this.statusBanner = i18n.t(
      `💰 ¡PLANTADO CON ÉXITO EN ${this.minesCurrentMult.toFixed(2)}x! COBRASTE +${payout} CR`,
      `💰 CASHED OUT AT ${this.minesCurrentMult.toFixed(2)}x! COLLECTED +${payout} CR`
    );
    this.statusColor = '#fbbf24';

    if (this.minesCurrentMult >= 8.0 || (this.minesCount >= 5 && this.minesSafeOpened >= 6)) {
      this.tryUnlockVipCrown(meta, sound, 'HACKEO MAESTRO EN FIREWALL MINES');
    }

    this.recordHistory(
      'MINES',
      `Mines (${this.minesCount}💣)`,
      payout - this.minesActiveBet,
      `${this.minesCurrentMult.toFixed(2)}x`,
      isBig
    );
  }

  // ==========================================
  // LÓGICA DE RULETA CUÁNTICA (CYBER WHEEL)
  // ==========================================
  public spinWheel(meta: MetaSystem, sound: SoundSystem): void {
    if (this.isWheelSpinning) return;
    const bet = Math.max(5, this.currentBet);
    if (meta.coins < bet) {
      sound.playExplosion(false);
      this.statusBanner = i18n.t(
        `⚠️ CRIPTO INSUFICIENTE PARA GIRAR LA RULETA (NECESITAS ${bet} CR).`,
        `⚠️ INSUFFICIENT CRYPTO TO SPIN WHEEL (NEED ${bet} CR).`
      );
      this.statusColor = '#f43f5e';
      return;
    }

    meta.coins -= bet;
    this.wheelActiveBet = bet;
    this.contributeToJackpot(bet);
    meta.save();

    this.isWheelSpinning = true;
    this.wheelVelocity = 11.5 + Math.random() * 6.5;
    sound.playCasinoTick(1.2);
    this.statusBanner = i18n.t(
      '🎡 GIRANDO RULETA CUÁNTICA DE KERNEL...',
      '🎡 SPINNING KERNEL QUANTUM WHEEL...'
    );
    this.statusColor = '#38bdf8';
  }

  private resolveWheelSpin(sectorIdx: number, meta: MetaSystem, sound: SoundSystem): void {
    const sector = WHEEL_SECTORS[sectorIdx] || WHEEL_SECTORS[0];
    let payout = 0;
    let multLabel = `${sector.mult}x`;

    if (this.wheelBetMode === 'MULTIPLIER') {
      payout = Math.round(this.wheelActiveBet * sector.mult);
      if (sector.mult >= 25) {
        payout += Math.round(this.progressiveJackpot * 0.5);
      }
    } else if (this.wheelBetMode === 'RED' && sector.colorGroup === 'RED') {
      payout = this.wheelActiveBet * 2;
      multLabel = 'ROJO 2x';
    } else if (this.wheelBetMode === 'CYAN' && sector.colorGroup === 'CYAN') {
      payout = this.wheelActiveBet * 2;
      multLabel = 'CIAN 2x';
    } else if (this.wheelBetMode === 'GREEN' && sector.colorGroup === 'GREEN') {
      payout = this.wheelActiveBet * 14;
      multLabel = 'VERDE 14x';
    }

    this.wheelLastResultText = `${sector.label} (${sector.colorGroup})`;

    if (payout > 0) {
      meta.coins += payout;
      meta.save();
      void meta.syncToCloud();
      const isBig = payout >= this.wheelActiveBet * 3;
      sound.playCasinoWin(isBig);
      this.statusBanner = i18n.t(
        `🎡 ¡LA RULETA CAYÓ EN [${sector.label}]! GANASTE +${payout} CR`,
        `🎡 WHEEL LANDED ON [${sector.label}]! WON +${payout} CR`
      );
      this.statusColor = isBig ? '#fbbf24' : '#10b981';

      if (sector.colorGroup === 'GREEN') {
        this.tryUnlockVipCrown(meta, sound, 'SECTOR 25x EN RULETA CUÁNTICA');
      }
      this.recordHistory('WHEEL', 'Ruleta Cuántica', payout - this.wheelActiveBet, multLabel, isBig);
    } else {
      sound.playExplosion(false);
      this.statusBanner = i18n.t(
        `🎡 Cayó en [${sector.label}] — Sin premio en esta tirada.`,
        `🎡 Landed on [${sector.label}] — No payout on this spin.`
      );
      this.statusColor = '#94a3b8';
      this.recordHistory('WHEEL', 'Ruleta Cuántica', -this.wheelActiveBet, '0x', false);
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

    // 1. Sub-pestañas de los 4 juegos de Casino
    const gameTabs = this.getGameSubTabRects(leftCx, py);
    for (const tab of gameTabs) {
      if (this.inRect(mx, my, tab)) {
        this.activeGame = tab.id;
        this.slotAutoSpin = false;
        sound.playCasinoTick(1.15);
        return true;
      }
    }

    // 2. Barra universal de fichas de apuesta (10, 25, 50, 100, 1/2, x2, MAX)
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

    // 3. Botón de Faucet de Minería de Emergencia (+15 CR si tienes < 15 CR) o Equipar Corona VIP en la bahía derecha
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

    // 4. Controles específicos del juego activo
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
      // Botones de Auto-Cashout
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
      // Cuadrícula 5x5
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

      // Selector de número de virus (1, 3, 5, 8, 13)
      const mineOptions = [1, 3, 5, 8, 13];
      for (let i = 0; i < mineOptions.length; i++) {
        const btn = { x: leftCx + 15 + i * 66, y: py + 258, width: 60, height: 32 };
        if (this.inRect(mx, my, btn) && this.minesState !== 'PLAYING') {
          this.minesCount = mineOptions[i];
          sound.playCasinoTick(1.1);
          return true;
        }
      }

      // Botón principal Iniciar / Cobrar
      const mainMinesBtn = { x: leftCx + 15, y: py + 380, width: 324, height: 42 };
      if (this.inRect(mx, my, mainMinesBtn)) {
        this.startOrCashoutMines(meta, sound);
        return true;
      }

      // Botón Abrir Nodo Aleatorio
      const randBtn = { x: leftCx + 15, y: py + 430, width: 324, height: 36 };
      if (this.inRect(mx, my, randBtn)) {
        this.pickRandomMinesTile(meta, sound);
        return true;
      }
    } else if (this.activeGame === 'WHEEL') {
      const spinWheelBtn = { x: leftCx + 18, y: py + 422, width: 320, height: 46 };
      if (this.inRect(mx, my, spinWheelBtn)) {
        this.spinWheel(meta, sound);
        return true;
      }
      const modes: { id: 'MULTIPLIER' | 'RED' | 'CYAN' | 'GREEN'; x: number; y: number; width: number; height: number }[] = [
        { id: 'MULTIPLIER', x: leftCx + 18, y: py + 266, width: 154, height: 36 },
        { id: 'RED', x: leftCx + 184, y: py + 266, width: 154, height: 36 },
        { id: 'CYAN', x: leftCx + 18, y: py + 310, width: 154, height: 36 },
        { id: 'GREEN', x: leftCx + 184, y: py + 310, width: 154, height: 36 },
      ];
      for (const m of modes) {
        if (this.inRect(mx, my, m) && !this.isWheelSpinning) {
          this.wheelBetMode = m.id;
          sound.playCasinoTick(1.1);
          return true;
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
      { id: 'SLOTS', label: `[1] 🎰 CYBER-SLOTS 5×3`, x: startX, y, width: w, height: h },
      { id: 'CRASH', label: `[2] 📈 CRIPTO-CRASH`, x: startX + (w + gap), y, width: w, height: h },
      { id: 'MINES', label: `[3] 💣 FIREWALL MINES`, x: startX + (w + gap) * 2, y, width: w, height: h },
      { id: 'WHEEL', label: `[4] 🎡 RULETA CUÁNTICA`, x: startX + (w + gap) * 3, y, width: w, height: h },
    ];
  }

  private getBetChipRects(leftCx: number, py: number): {
    label: string;
    amount?: number;
    action?: 'HALF' | 'DOUBLE' | 'MAX';
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const y = py + 188;
    const h = 28;
    const items: { label: string; amount?: number; action?: 'HALF' | 'DOUBLE' | 'MAX' }[] = [
      { label: '10 CR', amount: 10 },
      { label: '25 CR', amount: 25 },
      { label: '50 CR', amount: 50 },
      { label: '100 CR', amount: 100 },
      { label: '250 CR', amount: 250 },
      { label: '1/2', action: 'HALF' },
      { label: 'x2', action: 'DOUBLE' },
      { label: 'MAX', action: 'MAX' },
    ];
    const w = 68;
    const gap = 6;
    const startX = leftCx - 165;
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
  // RENDERIZADO COMPLETO DEL CRIPTO-CASINO VIP
  // ==========================================
  public drawCasinoConsole(
    ctx: CanvasRenderingContext2D,
    layout: { px: number; py: number; leftCx: number; bayX: number; bayY: number; bayW: number; bayH: number },
    meta: MetaSystem
  ): void {
    const { py, leftCx, bayX, bayY, bayW, bayH } = layout;
    const now = performance.now();

    ctx.save();

    // 1. Sub-pestañas de selección de máquina de Casino
    for (const tab of this.getGameSubTabRects(leftCx, py)) {
      const active = this.activeGame === tab.id;
      this.drawBox(
        ctx,
        tab.x,
        tab.y,
        tab.width,
        tab.height,
        active ? 'rgba(88, 28, 135, 0.96)' : 'rgba(15, 23, 42, 0.92)',
        active ? '#fbbf24' : 'rgba(148, 163, 184, 0.45)',
        active ? 2.0 : 1.2
      );
      ctx.textAlign = 'center';
      ctx.fillStyle = active ? '#fef08a' : '#cbd5e1';
      ctx.font = `bold 11.5px ${FONT_DISPLAY}`;
      ctx.fillText(tab.label, tab.x + tab.width / 2, tab.y + 20);
    }

    // 2. Barra de Apuesta Universal + Saldo actual
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold 12px ${FONT_MONO}`;
    ctx.fillText(
      `${i18n.t('APUESTA', 'BET')}: ${this.currentBet} CR`,
      leftCx - 358,
      py + 206
    );

    for (const chip of this.getBetChipRects(leftCx, py)) {
      const isSelected = chip.amount !== undefined && this.currentBet === chip.amount;
      this.drawBox(
        ctx,
        chip.x,
        chip.y,
        chip.width,
        chip.height,
        isSelected ? 'rgba(120, 53, 15, 0.96)' : 'rgba(15, 25, 44, 0.92)',
        isSelected ? '#fbbf24' : '#38bdf8',
        isSelected ? 2 : 1.2
      );
      ctx.textAlign = 'center';
      ctx.fillStyle = isSelected ? '#fef08a' : '#e0f2fe';
      ctx.font = `bold 10.5px ${FONT_MONO}`;
      ctx.fillText(chip.label, chip.x + chip.width / 2, chip.y + 18);
    }

    // 3. Renderizar el juego seleccionado en el cuerpo principal (py+224 .. py+476)
    if (this.activeGame === 'SLOTS') {
      this.drawCyberSlotsGame(ctx, leftCx, py, now);
    } else if (this.activeGame === 'CRASH') {
      this.drawCryptoCrashGame(ctx, leftCx, py, now);
    } else if (this.activeGame === 'MINES') {
      this.drawFirewallMinesGame(ctx, leftCx, py, now);
    } else if (this.activeGame === 'WHEEL') {
      this.drawQuantumWheelGame(ctx, leftCx, py, now);
    }

    // 4. Cinta de estado del Casino
    this.drawBox(
      ctx,
      leftCx - 358,
      py + 482,
      716,
      30,
      'rgba(8, 14, 26, 0.96)',
      this.statusColor,
      1.5
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = this.statusColor;
    ctx.font = `bold 11.5px ${FONT_DISPLAY}`;
    ctx.fillText(this.statusBanner, leftCx, py + 501, 696);

    // 5. Bahía Derecha VIP del Casino (Mega Jackpot, Corona Mítica, Tabla de Pagos e Historial)
    this.drawCasinoVipRightBay(ctx, bayX, bayY, bayW, bayH, meta, now);

    ctx.restore();
  }

  private drawCyberSlotsGame(
    ctx: CanvasRenderingContext2D,
    leftCx: number,
    py: number,
    now: number
  ): void {
    const machineX = leftCx - 358;
    const machineY = py + 224;
    const machineW = 716;
    const machineH = 200;

    // Marco de la máquina 5x3 con borde dorado/neón
    const hasFreeSpins = this.freeSpinsRemaining > 0;
    this.drawBox(
      ctx,
      machineX,
      machineY,
      machineW,
      machineH,
      hasFreeSpins ? 'rgba(36, 10, 68, 0.96)' : 'rgba(9, 15, 28, 0.96)',
      hasFreeSpins ? '#c084fc' : '#fbbf24',
      2.2
    );

    const cellW = 128;
    const cellH = 56;
    const gapX = 10;
    const gapY = 6;
    const gridW = cellW * 5 + gapX * 4;
    const startX = leftCx - gridW / 2;
    const startY = machineY + 10;

    // Conjunto de celdas ganadoras para iluminar
    const winningCells = new Set<string>();
    for (const line of this.winningLines) {
      for (const [c, r] of line.cells) {
        winningCells.add(`${c},${r}`);
      }
    }

    for (let col = 0; col < 5; col++) {
      const spinning = this.reelSpinTimers[col] > 0;
      for (let row = 0; row < 3; row++) {
        const cx = startX + col * (cellW + gapX);
        const cy = startY + row * (cellH + gapY);
        const symId = spinning
          ? SLOT_SYMBOLS[(col * 3 + row + Math.floor(now * 0.025)) % SLOT_SYMBOLS.length].id
          : this.slotGrid[col][row];
        const sym = SLOT_SYMBOLS.find((s) => s.id === symId) || SLOT_SYMBOLS[0];
        const isWinCell = !spinning && winningCells.has(`${col},${row}`);
        const pulse = isWinCell ? 1 + Math.sin(now * 0.015) * 0.04 : 1;

        ctx.save();
        if (isWinCell) {
          ctx.translate(cx + cellW / 2, cy + cellH / 2);
          ctx.scale(pulse, pulse);
          ctx.translate(-(cx + cellW / 2), -(cy + cellH / 2));
        }

        this.drawBox(
          ctx,
          cx,
          cy,
          cellW,
          cellH,
          sym.bg,
          isWinCell ? '#ffffff' : sym.color,
          isWinCell ? 2.6 : 1.4
        );

        // Icono vectorial + nombre del símbolo
        this.drawSlotSymbolArtwork(ctx, sym, cx + 28, cy + cellH / 2, now);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 13px ${FONT_DISPLAY}`;
        ctx.fillText(sym.badge, cx + 52, cy + 24);

        ctx.fillStyle = sym.color;
        ctx.font = `bold 9.5px ${FONT_MONO}`;
        const wildM = !spinning && symId === 'WILD' ? ` (x${this.slotWildMultipliers[col][row]})` : '';
        ctx.fillText(
          `${i18n.currentLang === 'EN' ? sym.nameEn : sym.name}${wildM}`,
          cx + 52,
          cy + 42,
          cellW - 58
        );

        ctx.restore();
      }
    }

    // Rayos láser de líneas de pago ganadoras conectando los centros de las celdas
    if (!this.isSlotSpinning && this.winningLines.length > 0) {
      ctx.save();
      for (const winLine of this.winningLines) {
        if (winLine.cells.length < 2) continue;
        ctx.strokeStyle = winLine.color;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        for (let i = 0; i < winLine.cells.length; i++) {
          const [c, r] = winLine.cells[i];
          const px = startX + c * (cellW + gapX) + cellW / 2;
          const pyCell = startY + r * (cellH + gapY) + cellH / 2;
          if (i === 0) ctx.moveTo(px, pyCell);
          else ctx.lineTo(px, pyCell);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Botones inferiores de Cyber-Slots: [TURBO] [AUTO] [GIRAR / TIRADA GRATIS] + [DOBLE O NADA RED/CYAN]
    const turboBtn = { x: leftCx - 358, y: py + 432, width: 104, height: 42 };
    this.drawBox(
      ctx,
      turboBtn.x,
      turboBtn.y,
      turboBtn.width,
      turboBtn.height,
      this.slotTurboMode ? 'rgba(120, 53, 15, 0.96)' : 'rgba(15, 25, 44, 0.94)',
      this.slotTurboMode ? '#fbbf24' : '#64748b',
      1.6
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
      1.6
    );
    ctx.fillStyle = this.slotAutoSpin ? '#a7f3d0' : '#94a3b8';
    ctx.fillText(this.slotAutoSpin ? '🔄 AUTO: ON' : '🔄 AUTO: OFF', autoBtn.x + 52, autoBtn.y + 26);

    const spinBtn = { x: leftCx - 135, y: py + 432, width: 270, height: 42 };
    const isFS = this.freeSpinsRemaining > 0;
    this.drawBox(
      ctx,
      spinBtn.x,
      spinBtn.y,
      spinBtn.width,
      spinBtn.height,
      isFS ? 'rgba(88, 28, 135, 0.98)' : 'rgba(6, 78, 59, 0.98)',
      isFS ? '#e879f9' : '#10b981',
      2.2
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
      this.drawBox(ctx, redBtn.x, redBtn.y, redBtn.width, redBtn.height, 'rgba(127, 29, 29, 0.96)', '#f43f5e', 1.8);
      ctx.fillStyle = '#fecdd3';
      ctx.font = `bold 10.5px ${FONT_DISPLAY}`;
      ctx.fillText('🔴 DOBLAR x2', redBtn.x + 52, redBtn.y + 18);
      ctx.fillText(`${this.lastSlotWinAmount * 2} CR`, redBtn.x + 52, redBtn.y + 33);

      this.drawBox(ctx, cyanBtn.x, cyanBtn.y, cyanBtn.width, cyanBtn.height, 'rgba(12, 74, 110, 0.96)', '#38bdf8', 1.8);
      ctx.fillStyle = '#bae6fd';
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

  private drawSlotSymbolArtwork(
    ctx: CanvasRenderingContext2D,
    sym: SlotSymbolDef,
    cx: number,
    cy: number,
    now: number
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = sym.color;
    ctx.fillStyle = sym.color;
    ctx.lineWidth = 1.8;

    if (sym.id === 'CROWN') {
      HatRenderer.drawHatIcon(ctx, 'mit_casino', 0, -2, 24, now);
    } else if (sym.id === 'GEM') {
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(13, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-13, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.fill();
    } else if (sym.id === 'WILD') {
      ctx.rotate(Math.sin(now * 0.005) * 0.12);
      ctx.strokeRect(-12, -12, 24, 24);
      ctx.font = `bold 10px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText('W', 0, 4);
    } else if (sym.id === 'SCATTER') {
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `bold 12px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText('⚡', 0, 4);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.globalAlpha = 0.22;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCryptoCrashGame(
    ctx: CanvasRenderingContext2D,
    leftCx: number,
    py: number,
    now: number
  ): void {
    const chartX = leftCx - 358;
    const chartY = py + 224;
    const chartW = 716;
    const chartH = 162;

    this.drawBox(
      ctx,
      chartX,
      chartY,
      chartW,
      chartH,
      'rgba(7, 13, 25, 0.96)',
      this.crashState === 'CRASHED' ? '#f43f5e' : '#10b981',
      2.0
    );

    // Cinta superior con el historial de los últimos 10 multiplicadores de Crash
    const pillW = 62;
    for (let i = 0; i < Math.min(10, this.crashHistory.length); i++) {
      const val = this.crashHistory[i];
      const px = chartX + 12 + i * (pillW + 7);
      const pyPill = chartY + 8;
      const col =
        val >= 10 ? '#fbbf24' : val >= 3 ? '#10b981' : val >= 1.5 ? '#38bdf8' : '#64748b';
      this.drawBox(ctx, px, pyPill, pillW, 20, 'rgba(15, 23, 42, 0.92)', col, 1.2);
      ctx.textAlign = 'center';
      ctx.fillStyle = col;
      ctx.font = `bold 10px ${FONT_MONO}`;
      ctx.fillText(`${val.toFixed(2)}x`, px + pillW / 2, pyPill + 14);
    }

    // Rejilla bursátil y curva exponencial
    const plotX = chartX + 24;
    const plotY = chartY + 36;
    const plotW = chartW - 48;
    const plotH = chartH - 48;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.stroke();

    const progress = Math.min(1, Math.log(Math.max(1, this.crashMultiplier)) / Math.log(15));
    const endX = plotX + Math.max(24, plotW * Math.min(0.92, 0.15 + progress * 0.77));
    const endY = plotY + plotH - Math.max(8, plotH * Math.min(0.88, progress * 0.85));

    ctx.strokeStyle =
      this.crashState === 'CRASHED'
        ? '#f43f5e'
        : this.crashCashedOut
        ? '#fbbf24'
        : '#10b981';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    ctx.quadraticCurveTo(plotX + (endX - plotX) * 0.55, plotY + plotH, endX, endY);
    ctx.stroke();

    // Cohete/Nodo $DAW en la punta de la curva
    ctx.fillStyle = this.crashState === 'CRASHED' ? '#f43f5e' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(endX, endY, 6 + Math.sin(now * 0.02) * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Multiplicador gigante en el centro de la gráfica
    ctx.textAlign = 'center';
    ctx.fillStyle =
      this.crashState === 'CRASHED'
        ? '#f43f5e'
        : this.crashCashedOut
        ? '#fbbf24'
        : '#f8fafc';
    ctx.font = `bold 36px ${FONT_MONO}`;
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
      i18n.t('◄ AUTO-RETIRO (10x+ DESBLOQUEA CORONA VIP)', '◄ AUTO-CASHOUT (10x+ UNLOCKS VIP CROWN)'),
      leftCx - 12,
      py + 410
    );

    // Botón principal Lanzar / Retirar
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

  private drawFirewallMinesGame(
    ctx: CanvasRenderingContext2D,
    leftCx: number,
    py: number,
    _now: number
  ): void {
    // Tablero 5x5 a la izquierda
    const gridStartX = leftCx - 295;
    const gridStartY = py + 230;
    const cellS = 44;
    const gap = 6;

    for (let idx = 0; idx < 25; idx++) {
      const c = idx % 5;
      const r = Math.floor(idx / 5);
      const x = gridStartX + c * (cellS + gap);
      const y = gridStartY + r * (cellS + gap);
      const revealed = this.minesRevealed[idx];
      const isMine = this.minesBoard[idx];

      let bg = 'rgba(15, 25, 44, 0.95)';
      let stroke = 'rgba(56, 189, 248, 0.55)';
      if (revealed) {
        bg = isMine ? 'rgba(127, 29, 29, 0.96)' : 'rgba(6, 78, 59, 0.96)';
        stroke = isMine ? '#f43f5e' : '#10b981';
      }

      this.drawBox(ctx, x, y, cellS, cellS, bg, stroke, revealed ? 2.0 : 1.3);
      ctx.textAlign = 'center';
      if (revealed) {
        ctx.fillStyle = isMine ? '#fda4af' : '#6ee7b7';
        ctx.font = `bold 17px ${FONT_DISPLAY}`;
        ctx.fillText(isMine ? '☠️' : '💎', x + cellS / 2, y + 29);
      } else {
        ctx.fillStyle = '#475569';
        ctx.font = `bold 11px ${FONT_MONO}`;
        ctx.fillText(`${idx + 1}`, x + cellS / 2, y + 26);
      }
    }

    // Panel derecho de control de Firewall Mines
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
        selected ? 'rgba(127, 29, 29, 0.95)' : 'rgba(15, 23, 42, 0.92)',
        selected ? '#f43f5e' : '#64748b',
        selected ? 2 : 1.2
      );
      ctx.textAlign = 'center';
      ctx.fillStyle = selected ? '#ffffff' : '#cbd5e1';
      ctx.font = `bold 11px ${FONT_MONO}`;
      ctx.fillText(`${count} 💣`, btn.x + 30, btn.y + 20);
    }

    // Telemetría de multiplicador actual y siguiente
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

    // Botón principal Iniciar / Cobrar
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

    // Botón de nodo aleatorio
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

  private drawQuantumWheelGame(
    ctx: CanvasRenderingContext2D,
    leftCx: number,
    py: number,
    _now: number
  ): void {
    const wheelCx = leftCx - 175;
    const wheelCy = py + 350;
    const radius = 116;

    // Rueda de 16 sectores
    const sliceAngle = (Math.PI * 2) / WHEEL_SECTORS.length;
    ctx.save();
    ctx.translate(wheelCx, wheelCy);
    ctx.rotate(this.wheelAngle);

    for (let i = 0; i < WHEEL_SECTORS.length; i++) {
      const sec = WHEEL_SECTORS[i];
      const a0 = i * sliceAngle;
      const a1 = a0 + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, a0, a1);
      ctx.closePath();
      ctx.fillStyle = sec.color;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.save();
      ctx.rotate(a0 + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 10px ${FONT_MONO}`;
      ctx.fillText(sec.label, radius - 10, 4);
      ctx.restore();
    }

    // Núcleo central de la rueda
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#090d16';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Puntero superior fijo
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(wheelCx, wheelCy - radius + 8);
    ctx.lineTo(wheelCx - 11, wheelCy - radius - 14);
    ctx.lineTo(wheelCx + 11, wheelCy - radius - 14);
    ctx.closePath();
    ctx.fill();

    // Panel derecho de selección de modo de Ruleta
    const infoX = leftCx + 18;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `bold 12px ${FONT_DISPLAY}`;
    ctx.fillText(
      i18n.t('SELECCIONA TIPO DE APUESTA EN LA RULETA:', 'SELECT WHEEL BET MODE:'),
      infoX,
      py + 252
    );

    const modes: {
      id: 'MULTIPLIER' | 'RED' | 'CYAN' | 'GREEN';
      label: string;
      stroke: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [
      { id: 'MULTIPLIER', label: '🎡 MULTIPLICADOR', stroke: '#fbbf24', x: infoX, y: py + 266, width: 154, height: 36 },
      { id: 'RED', label: '🔴 ROJO (PAGA x2)', stroke: '#f43f5e', x: infoX + 166, y: py + 266, width: 154, height: 36 },
      { id: 'CYAN', label: '🔵 CIAN (PAGA x2)', stroke: '#38bdf8', x: infoX, y: py + 310, width: 154, height: 36 },
      { id: 'GREEN', label: '🟢 VERDE (x14 + VIP)', stroke: '#10b981', x: infoX + 166, y: py + 310, width: 154, height: 36 },
    ];

    for (const m of modes) {
      const active = this.wheelBetMode === m.id;
      this.drawBox(
        ctx,
        m.x,
        m.y,
        m.width,
        m.height,
        active ? 'rgba(30, 41, 59, 0.98)' : 'rgba(15, 23, 42, 0.9)',
        active ? m.stroke : '#475569',
        active ? 2.2 : 1.2
      );
      ctx.textAlign = 'center';
      ctx.fillStyle = active ? '#ffffff' : '#cbd5e1';
      ctx.font = `bold 11px ${FONT_DISPLAY}`;
      ctx.fillText(m.label, m.x + m.width / 2, m.y + 22);
    }

    // Resultado anterior
    this.drawBox(ctx, infoX, py + 358, 320, 52, 'rgba(11, 19, 34, 0.95)', '#38bdf8', 1.4);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7dd3fc';
    ctx.font = `bold 11px ${FONT_MONO}`;
    ctx.fillText(
      this.wheelLastResultText
        ? `${i18n.t('ÚLTIMO SECTOR', 'LAST SECTOR')}: ${this.wheelLastResultText}`
        : i18n.t('EL SECTOR 👑 25x OTORGA LA CORONA VIP', 'SECTOR 👑 25x GRANTS THE VIP CROWN'),
      infoX + 160,
      py + 388
    );

    const spinBtn = { x: infoX, y: py + 422, width: 320, height: 46 };
    this.drawBox(
      ctx,
      spinBtn.x,
      spinBtn.y,
      spinBtn.width,
      spinBtn.height,
      this.isWheelSpinning ? 'rgba(30, 41, 59, 0.95)' : 'rgba(6, 78, 59, 0.98)',
      this.isWheelSpinning ? '#64748b' : '#10b981',
      2.2
    );
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 13.5px ${FONT_DISPLAY}`;
    ctx.fillText(
      this.isWheelSpinning
        ? i18n.t('🎡 GIRANDO RULETA...', '🎡 WHEEL SPINNING...')
        : i18n.t(`🎡 GIRAR RULETA (${this.currentBet} CR) [ESP]`, `🎡 SPIN WHEEL (${this.currentBet} CR) [SPC]`),
      spinBtn.x + 160,
      spinBtn.y + 28
    );
  }

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

    this.drawBox(
      ctx,
      bayX,
      bayY,
      bayW,
      bayH,
      'rgba(10, 14, 28, 0.97)',
      '#fbbf24',
      1.8
    );

    // 1. Bote Progresivo MEGA JACKPOT
    this.drawBox(
      ctx,
      bayX + 14,
      bayY + 14,
      bayW - 28,
      64,
      'rgba(69, 26, 3, 0.95)',
      '#fbbf24',
      2.0
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.font = `bold 11px ${FONT_MONO}`;
    ctx.fillText('👑 MEGA JACKPOT PROGRESIVO 👑', cx, bayY + 34);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 24px ${FONT_MONO}`;
    ctx.fillText(`${this.progressiveJackpot.toLocaleString('en-US')} CR`, cx, bayY + 64);

    // 2. Vitrina del Sombrero Exclusivo Mítico: Corona de Cripto-Magnate VIP
    const hasCrown = meta.unlockedHats.has('mit_casino');
    const isEquipped = meta.equippedHatId === 'mit_casino';
    this.drawBox(
      ctx,
      bayX + 14,
      bayY + 88,
      bayW - 28,
      132,
      hasCrown ? 'rgba(6, 52, 42, 0.94)' : 'rgba(28, 18, 48, 0.94)',
      hasCrown ? '#10b981' : '#c084fc',
      1.5
    );

    HatRenderer.drawHatIcon(ctx, 'mit_casino', bayX + 48, bayY + 122, 36, now);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold 11.5px ${FONT_DISPLAY}`;
    ctx.fillText('CORONA CRIPTO-MAGNATE', bayX + 82, bayY + 112);

    ctx.fillStyle = '#f43f5e';
    ctx.font = `bold 9.5px ${FONT_MONO}`;
    ctx.fillText('RAREZA MÍTICA EXCLUSIVA CASINO', bayX + 82, bayY + 127);

    ctx.fillStyle = '#a3e635';
    ctx.font = `bold 9.5px ${FONT_MONO}`;
    ctx.fillText('+36% Daño • +30% Crít • +22% Vel', bayX + 82, bayY + 143);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `10px ${FONT_DISPLAY}`;
    ctx.fillText(
      hasCrown
        ? i18n.t('¡Trofeo VIP en tu colección!', 'VIP Trophy in your collection!')
        : i18n.t('Gánala con 4+ 👑, Crash 10x+ o Ruleta 25x', 'Win with 4+ 👑, Crash 10x+ or Wheel 25x'),
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
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(bayX + 16, ry, bayW - 32, 19);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#e2e8f0';
        ctx.font = `10.5px ${FONT_DISPLAY}`;
        ctx.fillText(`${h.label} (${h.multText})`, bayX + 22, ry + 13.5);

        ctx.textAlign = 'right';
        ctx.fillStyle = h.netDelta >= 0 ? '#10b981' : '#f43f5e';
        ctx.font = `bold 10.5px ${FONT_MONO}`;
        ctx.fillText(`${h.netDelta >= 0 ? '+' : ''}${h.netDelta} CR`, bayX + bayW - 22, ry + 13.5);
      }
    }

    // 5. Botón inferior de Faucet si te quedas con pocas monedas
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
    fill: string,
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
