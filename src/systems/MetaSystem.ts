import { HatItem, HATS_DATABASE, getHatById, rollGachaHat, RARITY_CONFIG } from './HatSystem';
import { auth, db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';

export type CharacterId =
  | 'STANDARD'
  | 'ROOT'
  | 'PROXY'
  | 'MORCILLITA'
  | 'CRYPTO'
  | 'SPECTRE'
  | 'OVERCLOCK'
  | 'KERNEL_X';

export type GameMode = 'CLASSIC' | 'NIGHTMARE';
export const NIGHTMARE_ENTRY_COST = 15;

export type LabUpgradeId =
  | 'HULL_ARMOR'
  | 'CPU_OVERCLOCK'
  | 'DATA_MAGNET'
  | 'TURBO_SERVOS'
  | 'CRYPTO_MINING'
  | 'TACTICAL_DICE';

export interface LabUpgradeConfig {
  id: LabUpgradeId;
  name: string;
  nameEn: string;
  subtitle: string;
  subtitleEn: string;
  desc: string;
  descEn: string;
  statPerLevel: string;
  statPerLevelEn: string;
  color: string;
  maxLevel: number;
  costs: number[];
}

export interface LabComputedBonuses {
  hpMult: number;
  damageBonus: number;
  magnetMult: number;
  xpBonus: number;
  speedMult: number;
  fireRateBonus: number;
  coinDropBonus: number;
  ultChargeMult: number;
  extraRerolls: number;
  reviveSpeedMult: number;
}

export const LAB_UPGRADES_ORDER: LabUpgradeId[] = [
  'HULL_ARMOR',
  'CPU_OVERCLOCK',
  'DATA_MAGNET',
  'TURBO_SERVOS',
  'CRYPTO_MINING',
  'TACTICAL_DICE',
];

export const LAB_UPGRADES_CONFIG: Record<LabUpgradeId, LabUpgradeConfig> = {
  HULL_ARMOR: {
    id: 'HULL_ARMOR',
    name: 'BLINDAJE DE CHASIS',
    nameEn: 'CHASSIS ARMOR',
    subtitle: 'DEFENSA // +8% HP MÁX',
    subtitleEn: 'DEFENSE // +8% MAX HP',
    desc: 'Refuerza las placas del núcleo con aleación cuántica permanente.',
    descEn: 'Reinforces core plating with permanent quantum alloy.',
    statPerLevel: '+8% HP Máx / nivel',
    statPerLevelEn: '+8% Max HP / level',
    color: '#10b981',
    maxLevel: 5,
    costs: [12, 24, 40, 60, 85],
  },
  CPU_OVERCLOCK: {
    id: 'CPU_OVERCLOCK',
    name: 'FRECUENCIA DE NÚCLEO',
    nameEn: 'CORE FREQUENCY',
    subtitle: 'ATAQUE // +6% DAÑO',
    subtitleEn: 'OFFENSE // +6% DAMAGE',
    desc: 'Eleva el voltaje base de todas las armas y mascotas.',
    descEn: 'Boosts base voltage across all weapons and companions.',
    statPerLevel: '+6% Daño Global / nivel',
    statPerLevelEn: '+6% Global Dmg / level',
    color: '#f43f5e',
    maxLevel: 5,
    costs: [15, 28, 45, 68, 95],
  },
  DATA_MAGNET: {
    id: 'DATA_MAGNET',
    name: 'BOBINA MAGNÉTICA',
    nameEn: 'MAGNETIC COIL',
    subtitle: 'UTILIDAD // +15% IMÁN +6% XP',
    subtitleEn: 'UTILITY // +15% MAGNET +6% XP',
    desc: 'Amplía permanentemente el campo de atracción y ganancia de XP.',
    descEn: 'Permanently expands pickup radius and XP gain.',
    statPerLevel: '+15% Imán y +6% XP / nv',
    statPerLevelEn: '+15% Magnet & +6% XP / lv',
    color: '#38bdf8',
    maxLevel: 5,
    costs: [12, 22, 38, 58, 82],
  },
  TURBO_SERVOS: {
    id: 'TURBO_SERVOS',
    name: 'SERVOMOTORES TURBO',
    nameEn: 'TURBO SERVOS',
    subtitle: 'AGILIDAD // +4% VEL +5% CAD',
    subtitleEn: 'AGILITY // +4% SPD +5% ROF',
    desc: 'Acelera el desplazamiento del chasis y la cadencia de disparo.',
    descEn: 'Accelerates chassis movement and weapon fire rate.',
    statPerLevel: '+4% Vel y +5% Cadencia / nv',
    statPerLevelEn: '+4% Spd & +5% ROF / lv',
    color: '#fb923c',
    maxLevel: 5,
    costs: [15, 28, 45, 68, 95],
  },
  CRYPTO_MINING: {
    id: 'CRYPTO_MINING',
    name: 'SUBRUTINA DE MINERÍA',
    nameEn: 'MINING SUBROUTINE',
    subtitle: 'BOTÍN // +2.5% CRIPTO +ULT',
    subtitleEn: 'LOOT // +2.5% CRYPTO +ULT',
    desc: 'Extrae más CryptoCoins y reduce las bajas necesarias para la Ultimate.',
    descEn: 'Extracts more CryptoCoins and speeds up Ultimate charge.',
    statPerLevel: '+2.5% Drop CR y -2 Bajas Ult / nv',
    statPerLevelEn: '+2.5% CR Drop & -2 Ult Kills / lv',
    color: '#fbbf24',
    maxLevel: 5,
    costs: [18, 32, 52, 76, 105],
  },
  TACTICAL_DICE: {
    id: 'TACTICAL_DICE',
    name: 'DADOS CUÁNTICOS',
    nameEn: 'QUANTUM DICE',
    subtitle: 'TÁCTICA // +1 REROLL +RESCATE',
    subtitleEn: 'TACTICS // +1 REROLL +REVIVE',
    desc: 'Otorga Rerolls extra por partida y acelera reanimaciones en Co-op.',
    descEn: 'Grants extra Rerolls per run and faster Co-op revives.',
    statPerLevel: '+1 Reroll y +15% Rescate / nv',
    statPerLevelEn: '+1 Reroll & +15% Revive / lv',
    color: '#c084fc',
    maxLevel: 3,
    costs: [25, 55, 95],
  },
};

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  maxDamageToToro: number;
  bestTimeSeconds: number;
}

export interface CharacterProfile {
  id: CharacterId;
  name: string;
  nameEn?: string;
  subtitle: string;
  subtitleEn?: string;
  description: string;
  descriptionEn?: string;
  passiveName: string;
  passiveNameEn: string;
  passiveDesc: string;
  passiveDescEn: string;
  ultName: string;
  ultNameEn: string;
  ultDesc: string;
  ultDescEn: string;
  ultDuration: number;
  ultKillsRequired: number;
  color: string;
  borderColor: string;
  speedMultiplier: number;
  hpMultiplier: number;
  pickupRadiusMultiplier: number;
  cost: number;
}

interface SavedMetaState {
  displayName?: string;
  coins: number;
  unlockedCharacters: CharacterId[];
  selectedCharacter: CharacterId;
  unlockedHats?: string[];
  equippedHatId?: string | null;
  highScore?: number;
  bestTimeSeconds?: number;
  maxDamageToToro?: number;
  labLevels?: Partial<Record<LabUpgradeId, number>>;
}

export const STORAGE_KEY = 'daw_survivor_meta_v020';
export const GACHA_PULL_SINGLE_COST = 20;
export const GACHA_PULL_TEN_COST = 200;
export const GACHA_DUPLICATE_REFUND = 10;

export interface GachaPullEntry {
  hat: HatItem;
  isNew: boolean;
  refundedCoins: number;
}

export class MetaSystem {
  public displayName: string = 'Survivor';
  public coins: number = 0;
  public unlockedCharacters: Set<CharacterId> = new Set(['STANDARD', 'MORCILLITA']);
  public selectedCharacter: CharacterId = 'STANDARD';
  public unlockedHats: Set<string> = new Set();
  public equippedHatId: string | null = null;
  public highScore: number = 0;
  public bestTimeSeconds: number = 0;
  public maxDamageToToro: number = 0;
  public labLevels: Record<LabUpgradeId, number> = {
    HULL_ARMOR: 0,
    CPU_OVERCLOCK: 0,
    DATA_MAGNET: 0,
    TURBO_SERVOS: 0,
    CRYPTO_MINING: 0,
    TACTICAL_DICE: 0,
  };
  private dirty: boolean = false;
  private lastSaveTime: number = 0;

  public readonly characterOrder: CharacterId[] = [
    'STANDARD',
    'ROOT',
    'PROXY',
    'MORCILLITA',
    'CRYPTO',
    'SPECTRE',
    'OVERCLOCK',
    'KERNEL_X',
  ];

  public readonly characters: Record<CharacterId, CharacterProfile> = {
    STANDARD: {
      id: 'STANDARD',
      name: 'AGENTE ESTÁNDAR',
      nameEn: 'STANDARD AGENT',
      subtitle: 'KERNEL // DESCARGA',
      subtitleEn: 'KERNEL // SURGE',
      description: 'Unidad antivirus equilibrada. Al sufrir daño suelta un pulso eléctrico que repele malware.',
      descriptionEn: 'Balanced unit. Emits an electric shockwave when hit and heals +1 HP every 25 kills.',
      passiveName: 'DESCARGA KERNEL',
      passiveNameEn: 'KERNEL SURGE',
      passiveDesc: 'Al recibir daño emite onda (45 dmg) + cura +1 HP cada 25 bajas.',
      passiveDescEn: 'Releases radial pulse (45 dmg) on hit + heals +1 HP every 25 kills.',
      ultName: 'SOBRECARGA EMP',
      ultNameEn: 'EMP OVERLOAD',
      ultDesc: '6s: Pulsos EMP que destruyen balas, congelan enemigos, +35% cadencia y +4 HP/s.',
      ultDescEn: '6s: EMP blasts destroy bullets, freeze foes, +35% fire rate & +4 HP/s.',
      ultDuration: 6.0,
      ultKillsRequired: 35,
      color: '#00ff66',
      borderColor: '#ffffff',
      speedMultiplier: 1.0,
      hpMultiplier: 1.0,
      pickupRadiusMultiplier: 1.0,
      cost: 0,
    },
    ROOT: {
      id: 'ROOT',
      name: 'AGENTE ROOT',
      nameEn: 'ROOT AGENT',
      subtitle: 'ESTELA // +20% VEL',
      subtitleEn: 'TRAIL // +20% SPD',
      description: 'Bot veloz (+20%) que deja nodos cortafuegos tras de sí dañando y frenando enemigos.',
      descriptionEn: 'Fast bot (+20% spd) leaving burning cyber nodes behind that slow and hurt malware.',
      passiveName: 'ESTELA OVERCLOCK',
      passiveNameEn: 'OVERCLOCK TRAIL',
      passiveDesc: 'Deja nodos de fuego eléctrico al moverse (-30% velocidad enemiga).',
      passiveDescEn: 'Drops electric trail nodes while moving (-30% enemy speed).',
      ultName: 'PROTOCOLO FANTASMA',
      ultNameEn: 'PHANTOM PROTOCOL',
      ultDesc: '5.5s: Invulnerabilidad fasada, +65% velocidad y estela de alto voltaje (x2.5 daño).',
      ultDescEn: '5.5s: Phase invulnerability, +65% speed & high-voltage trail (2.5x dmg).',
      ultDuration: 5.5,
      ultKillsRequired: 35,
      color: '#1e40af',
      borderColor: '#60a5fa',
      speedMultiplier: 1.2,
      hpMultiplier: 1.0,
      pickupRadiusMultiplier: 1.0,
      cost: 10,
    },
    PROXY: {
      id: 'PROXY',
      name: 'AGENTE PROXY',
      nameEn: 'PROXY AGENT',
      subtitle: 'ESCUDO // 200 HP',
      subtitleEn: 'AEGIS // 200 HP',
      description: 'Chasis pesado (200 HP, -15% vel) con Escudo Aegis recargable cada 16s que bloquea 1 golpe.',
      descriptionEn: 'Heavy chassis (200 HP, -15% spd) with recharging Aegis Shield every 16s.',
      passiveName: 'ESCUDO AEGIS',
      passiveNameEn: 'AEGIS BARRIER',
      passiveDesc: 'Cada 16 s bloquea por completo 1 impacto y repele enemigos.',
      passiveDescEn: 'Every 16s completely blocks 1 enemy hit and knocks foes back.',
      ultName: 'CÚPULA AEGIS',
      ultNameEn: 'AEGIS DOME',
      ultDesc: '7s: Cúpula (210px) que destruye balas, reduce 70% daño, cura +8 HP/s al equipo y electrocuta.',
      ultDescEn: '7s: 210px Dome destroys bullets, -70% dmg taken, heals squad +8 HP/s & zaps.',
      ultDuration: 7.0,
      ultKillsRequired: 35,
      color: '#9333ea',
      borderColor: '#f3e8ff',
      speedMultiplier: 0.85,
      hpMultiplier: 2.0,
      pickupRadiusMultiplier: 1.0,
      cost: 15,
    },
    MORCILLITA: {
      id: 'MORCILLITA',
      name: 'MORCILLITA (SUMMONER)',
      nameEn: 'MORCILLITA (SUMMONER)',
      subtitle: 'MASCOTA EVOLUTIVA',
      subtitleEn: 'EVOLVING PET LVL 20',
      description: 'Sin disparo básico propio. Su mascota evoluciona en Nivel 2 en Fuerza Bruta, Botnet o Pinball.',
      descriptionEn: 'No innate gun. Companion pet evolves at Level 2 into Brute, Botnet, or Pinball.',
      passiveName: 'ENLACE SIMBIÓTICO',
      passiveNameEn: 'SYMBIOTIC LINK',
      passiveDesc: 'Mascota autónoma con 3 ramas evolutivas y mejoras en Nv.5 / 10 / 20.',
      passiveDescEn: 'Autonomous companion with 3 evolution branches & Lvl 5 / 10 / 20 boosts.',
      ultName: 'HIPER-EVOLUCIÓN K9',
      ultNameEn: 'K9 HYPER-DRIVE',
      ultDesc: '7.5s: Morcillita gana +80% daño, +65% velocidad y emite ondas sísmicas continuas.',
      ultDescEn: '7.5s: Morcillita gains +80% dmg, +65% speed & emits continuous shockwaves.',
      ultDuration: 7.5,
      ultKillsRequired: 35,
      color: '#ec4899',
      borderColor: '#fbcfe8',
      speedMultiplier: 1.05,
      hpMultiplier: 1.0,
      pickupRadiusMultiplier: 1.0,
      cost: 0,
    },
    CRYPTO: {
      id: 'CRYPTO',
      name: 'CAZADOR CRIPTO',
      nameEn: 'CRYPTO HUNTER',
      subtitle: 'IMÁN +35% // BOTÍN+',
      subtitleEn: 'MAGNET +35% // LOOT+',
      description: 'Especialista en botín con +35% de imán, +5% crítico y +30% chance de soltar CryptoCoins.',
      descriptionEn: 'Loot hunter with +35% magnet radius, +5% crit, and bonus CryptoCoin drops.',
      passiveName: 'IMÁN DE HASH',
      passiveNameEn: 'HASH MAGNET',
      passiveDesc: '+35% imán, +5% crítico y mayor probabilidad de soltar CryptoCoins.',
      passiveDescEn: '+35% magnet, +5% crit chance & bonus CryptoCoin drop rate.',
      ultName: 'FIEBRE DEL ORO',
      ultNameEn: 'GOLD RUSH',
      ultDesc: '7s: Imán global (+600px), +50% cadencia, rayos dorados y +1 CryptoCoin cada 10 bajas.',
      ultDescEn: '7s: Screen-wide magnet, +50% ROF, gold lightning & +1 CryptoCoin per 10 kills.',
      ultDuration: 7.0,
      ultKillsRequired: 35,
      color: '#f59e0b',
      borderColor: '#fef08a',
      speedMultiplier: 1.05,
      hpMultiplier: 1.0,
      pickupRadiusMultiplier: 1.35,
      cost: 20,
    },
    SPECTRE: {
      id: 'SPECTRE',
      name: 'AGENTE SPECTRE',
      nameEn: 'SPECTRE AGENT',
      subtitle: '22% ESQUIVA // +15% CRIT',
      subtitleEn: '22% DODGE // +15% CRIT',
      description: 'Unidad sigilosa capaz de esquivar el 22% de ataques enemigos y asestar críticos letales.',
      descriptionEn: 'Stealth assassin with 22% hit evasion, +15% crit chance, and +10% fire rate.',
      passiveName: 'FASE ESPECTRAL',
      passiveNameEn: 'SPECTRAL PHASE',
      passiveDesc: '22% probabilidad de esquivar cualquier daño + 15% crítico base.',
      passiveDescEn: '22% chance to phase through any damage + 15% base crit chance.',
      ultName: 'EJECUCIÓN SOMBRÍA',
      ultNameEn: 'SHADOW EXECUTION',
      ultDesc: '6s: 100% Prob. Crítica, +55% esquiva/velocidad y ráfaga automática de dagas sombrías.',
      ultDescEn: '6s: 100% Crit Chance, +55% dodge/speed & automatic shadow dagger barrage.',
      ultDuration: 6.0,
      ultKillsRequired: 35,
      color: '#06b6d4',
      borderColor: '#cffafe',
      speedMultiplier: 1.12,
      hpMultiplier: 0.9,
      pickupRadiusMultiplier: 1.0,
      cost: 25,
    },
    OVERCLOCK: {
      id: 'OVERCLOCK',
      name: 'AGENTE OVERCLOCK',
      nameEn: 'OVERCLOCK AGENT',
      subtitle: 'ADRENALINA // +15% CAD',
      subtitleEn: 'ADRENALINE // +15% ROF',
      description: '+15% cadencia innata y cada 25 bajas activa Sobrecarga (+45% cadencia y +25% vel durante 3.5s).',
      descriptionEn: '+15% innate fire rate and triggers 3.5s Overdrive (+45% ROF, +25% spd) every 25 kills.',
      passiveName: 'PULSO ADRENALINA',
      passiveNameEn: 'ADRENALINE SURGE',
      passiveDesc: 'Cada 25 bajas entra en Sobrecarga durante 3.5 s (+45% cadencia / +25% vel).',
      passiveDescEn: 'Triggers 3.5s Overdrive every 25 kills (+45% fire rate / +25% speed).',
      ultName: 'FUSIÓN NUCLEAR',
      ultNameEn: 'NUCLEAR MELTDOWN',
      ultDesc: '6s: Cadencia x2.2, +35% velocidad y aura térmica abrasadora (180px) continua.',
      ultDescEn: '6s: 2.2x Fire Rate, +35% speed & scorching 180px thermal plasma aura.',
      ultDuration: 6.0,
      ultKillsRequired: 35,
      color: '#f97316',
      borderColor: '#fed7aa',
      speedMultiplier: 1.08,
      hpMultiplier: 1.0,
      pickupRadiusMultiplier: 1.0,
      cost: 30,
    },
    KERNEL_X: {
      id: 'KERNEL_X',
      name: 'TITÁN KERNEL-X',
      nameEn: 'KERNEL-X TITAN',
      subtitle: '+20% DAÑO // +2 HP/s',
      subtitleEn: '+20% DMG // +2 HP/s',
      description: 'Coloso ofensivo con +20% daño global, +1 proyectil extra base y regeneración pasiva de +2 HP/s.',
      descriptionEn: 'Heavy vanguard with +20% damage, +1 extra base projectile, and +2 HP/s regen.',
      passiveName: 'NÚCLEO REGENERATIVO',
      passiveNameEn: 'REGEN CORE',
      passiveDesc: 'Regenera +2 HP/s continuamente y empieza con +20% daño +1 bala.',
      passiveDescEn: 'Passively regenerates +2 HP/s and starts with +20% dmg +1 extra shot.',
      ultName: 'TORMENTA ORBITAL',
      ultNameEn: 'ORBITAL STORM',
      ultDesc: '6.5s: +3 proyectiles extra, +50% cadencia y bombardeo láser orbital automático.',
      ultDescEn: '6.5s: +3 extra projectiles, +50% fire rate & automatic orbital laser strikes.',
      ultDuration: 6.5,
      ultKillsRequired: 35,
      color: '#ef4444',
      borderColor: '#fecaca',
      speedMultiplier: 0.9,
      hpMultiplier: 1.35,
      pickupRadiusMultiplier: 1.0,
      cost: 40,
    },
  };

  constructor() {
    this.load();
  }

  public addCoins(amount: number): void {
    if (amount === 0) return;
    this.coins += amount;
    this.saveThrottled();
  }

  public updateHighScore(
    kills: number,
    elapsedSeconds: number,
    damageToToro: number = 0
  ): void {
    let changed = false;
    if (kills > this.highScore) {
      this.highScore = kills;
      changed = true;
    }
    const flooredTime = Math.floor(elapsedSeconds);
    if (flooredTime > this.bestTimeSeconds) {
      this.bestTimeSeconds = flooredTime;
      changed = true;
    }
    const flooredToroDamage = Math.floor(damageToToro);
    if (flooredToroDamage > this.maxDamageToToro) {
      this.maxDamageToToro = flooredToroDamage;
      changed = true;
    }
    if (changed) {
      this.saveThrottled();
    }
  }

  public isUnlocked(id: CharacterId): boolean {
    return this.unlockedCharacters.has(id);
  }

  public getSelectedProfile(): CharacterProfile {
    return this.characters[this.selectedCharacter];
  }

  public getLabLevel(id: LabUpgradeId): number {
    return this.labLevels[id] ?? 0;
  }

  public buyLabUpgrade(id: LabUpgradeId): { success: boolean; message: string } {
    const cfg = LAB_UPGRADES_CONFIG[id];
    const curLvl = this.getLabLevel(id);
    if (curLvl >= cfg.maxLevel) {
      return {
        success: false,
        message: `> ${cfg.name} ya está al NIVEL MÁXIMO (Nv.${cfg.maxLevel}/${cfg.maxLevel}).`,
      };
    }
    const cost = cfg.costs[curLvl] ?? 999;
    if (this.coins < cost) {
      return {
        success: false,
        message: `> ERROR: Necesitas ${cost} CR para mejorar ${cfg.name} a Nv.${curLvl + 1} (Tienes ${this.coins} CR).`,
      };
    }
    this.coins -= cost;
    this.labLevels[id] = curLvl + 1;
    this.save();
    void this.syncToCloud();
    return {
      success: true,
      message: `> ¡MEJORA PERMANENTE INSTALADA: ${cfg.name} Nv.${curLvl + 1}/${cfg.maxLevel}! (-${cost} CR)`,
    };
  }

  public static computeLabBonuses(levels?: Partial<Record<LabUpgradeId, number>>): LabComputedBonuses {
    const hull = Math.max(0, Math.min(5, Math.floor(levels?.HULL_ARMOR ?? 0)));
    const cpu = Math.max(0, Math.min(5, Math.floor(levels?.CPU_OVERCLOCK ?? 0)));
    const mag = Math.max(0, Math.min(5, Math.floor(levels?.DATA_MAGNET ?? 0)));
    const srv = Math.max(0, Math.min(5, Math.floor(levels?.TURBO_SERVOS ?? 0)));
    const min = Math.max(0, Math.min(5, Math.floor(levels?.CRYPTO_MINING ?? 0)));
    const dice = Math.max(0, Math.min(3, Math.floor(levels?.TACTICAL_DICE ?? 0)));

    return {
      hpMult: 1 + hull * 0.08,
      damageBonus: cpu * 0.06,
      magnetMult: 1 + mag * 0.15,
      xpBonus: mag * 0.06,
      speedMult: 1 + srv * 0.04,
      fireRateBonus: srv * 0.05,
      coinDropBonus: min * 0.025,
      ultChargeMult: Math.max(0.65, 1 - min * 0.06),
      extraRerolls: dice,
      reviveSpeedMult: 1 + dice * 0.15,
    };
  }

  public getLabBonuses(): LabComputedBonuses {
    return MetaSystem.computeLabBonuses(this.labLevels);
  }

  public static readLabBonusesFromStorage(): LabComputedBonuses {
    try {
      const raw =
        window.localStorage.getItem(STORAGE_KEY) ||
        window.localStorage.getItem('cyber_survivor_meta_v020');
      if (!raw) return MetaSystem.computeLabBonuses();
      const parsed = JSON.parse(raw) as Partial<SavedMetaState>;
      return MetaSystem.computeLabBonuses(parsed.labLevels);
    } catch {
      return MetaSystem.computeLabBonuses();
    }
  }

  public selectOrBuyCharacter(id: CharacterId): { success: boolean; message: string } {
    const profile = this.characters[id];

    if (this.unlockedCharacters.has(id)) {
      this.selectedCharacter = id;
      this.save();
      void this.syncToCloud();
      return {
        success: true,
        message: `> Operador activo cambiado a: ${profile.name}`,
      };
    }

    if (this.coins >= profile.cost) {
      this.coins -= profile.cost;
      this.unlockedCharacters.add(id);
      this.selectedCharacter = id;
      this.save();
      void this.syncToCloud();
      return {
        success: true,
        message: `> ¡${profile.name} DESBLOQUEADO Y EQUIPADO! (-${profile.cost} Crypto)`,
      };
    }

    return {
      success: false,
      message: `> ERROR: Fondos insuficientes para ${profile.name}. Necesitas ${profile.cost} Criptomonedas (Tienes ${this.coins}).`,
    };
  }

  public pullGachaBatch(count: 1 | 10): {
    success: boolean;
    results: GachaPullEntry[];
    totalRefunded: number;
    message: string;
  } {
    const cost = count === 10 ? GACHA_PULL_TEN_COST : GACHA_PULL_SINGLE_COST;
    if (this.coins < cost) {
      return {
        success: false,
        results: [],
        totalRefunded: 0,
        message: `> ERROR: Necesitas ${cost} Criptomonedas para la Tirada x${count} (Tienes ${this.coins}).`,
      };
    }

    this.coins -= cost;
    const results: GachaPullEntry[] = [];
    let totalRefunded = 0;
    let newCount = 0;

    for (let i = 0; i < count; i++) {
      const hat = rollGachaHat();
      const alreadyOwned = this.unlockedHats.has(hat.id);

      if (alreadyOwned) {
        this.coins += GACHA_DUPLICATE_REFUND;
        totalRefunded += GACHA_DUPLICATE_REFUND;
        results.push({
          hat,
          isNew: false,
          refundedCoins: GACHA_DUPLICATE_REFUND,
        });
      } else {
        this.unlockedHats.add(hat.id);
        newCount++;
        if (!this.equippedHatId) {
          this.equippedHatId = hat.id;
        }
        results.push({
          hat,
          isNew: true,
          refundedCoins: 0,
        });
      }
    }

    this.save();
    void this.syncToCloud();

    if (count === 1) {
      const entry = results[0];
      const rarityLabel = RARITY_CONFIG[entry.hat.rarity].label.split(' ')[0];
      const statusText = entry.isNew
        ? '¡NUEVO!'
        : `Repetido: +${GACHA_DUPLICATE_REFUND} Monedas`;
      return {
        success: true,
        results,
        totalRefunded,
        message: `> [${rarityLabel}] ${entry.hat.icon} ${entry.hat.name} — ${statusText}`,
      };
    }

    return {
      success: true,
      results,
      totalRefunded,
      message: `> TIRADA x10 COMPLETADA: ${newCount} Nuevos | ${10 - newCount} Repetidos (+${totalRefunded} Monedas reembolsadas)`,
    };
  }

  public equipHat(hatId: string): { success: boolean; message: string } {
    if (!this.unlockedHats.has(hatId)) {
      return {
        success: false,
        message: '> ERROR: Aún no has desbloqueado este sombrero en el Gacha.',
      };
    }

    const hat = getHatById(hatId);
    if (!hat) {
      return { success: false, message: '> ERROR: Objeto no encontrado.' };
    }

    if (this.equippedHatId === hatId) {
      this.equippedHatId = null;
      this.save();
      void this.syncToCloud();
      return {
        success: true,
        message: `> Sombrero desequipado: ${hat.name}.`,
      };
    }

    this.equippedHatId = hatId;
    this.save();
    void this.syncToCloud();
    return {
      success: true,
      message: `> EQUIPADO: ${hat.icon} ${hat.name} [${hat.statsLabel}]`,
    };
  }

  public unlockSpecificHat(hatId: string): boolean {
    if (this.unlockedHats.has(hatId)) return false;
    const hat = getHatById(hatId);
    if (!hat) return false;
    this.unlockedHats.add(hatId);
    if (!this.equippedHatId) {
      this.equippedHatId = hatId;
    }
    this.save();
    void this.syncToCloud();
    return true;
  }

  public async loadFromCloud(uid: string): Promise<void> {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        this.displayName =
          currentUser.displayName && currentUser.displayName.trim().length > 0
            ? currentUser.displayName.trim()
            : 'Survivor';
      }

      const userDocRef = doc(db, 'users', uid);
      const snapshot = await getDoc(userDocRef);

      if (snapshot.exists()) {
        const cloudData = snapshot.data() as Partial<SavedMetaState>;
        // Fusionar datos locales y de la nube para no perder monedas o desbloqueos conseguidos offline
        this.applyParsedState(cloudData, true);
        if (currentUser && currentUser.displayName && currentUser.displayName.trim().length > 0) {
          this.displayName = currentUser.displayName.trim();
        }
        this.save();
        // Guardar la versión combinada en la nube
        await setDoc(userDocRef, this.getStatePayload(), { merge: true });
      } else {
        await setDoc(userDocRef, this.getStatePayload());
      }
    } catch (err) {
      console.error('Error sincronizando datos desde Firestore:', err);
    }
  }

  public async syncToCloud(
    runTimeSeconds: number = 0,
    runDamageToToro: number = 0
  ): Promise<void> {
    const flooredTime = Math.floor(runTimeSeconds);
    const flooredToroDmg = Math.floor(runDamageToToro);
    if (flooredTime > this.bestTimeSeconds) {
      this.bestTimeSeconds = flooredTime;
    }
    if (flooredToroDmg > this.maxDamageToToro) {
      this.maxDamageToToro = flooredToroDmg;
    }

    const currentUser = auth.currentUser;
    if (currentUser) {
      this.displayName =
        currentUser.displayName && currentUser.displayName.trim().length > 0
          ? currentUser.displayName.trim()
          : 'Survivor';
    }

    this.save();
    if (!currentUser) {
      return;
    }

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const snapshot = await getDoc(userDocRef);
      const existing = snapshot.exists()
        ? (snapshot.data() as Partial<SavedMetaState>)
        : null;

      const savedMaxToro =
        existing && typeof existing.maxDamageToToro === 'number'
          ? existing.maxDamageToToro
          : 0;
      const savedBestTime =
        existing && typeof existing.bestTimeSeconds === 'number'
          ? existing.bestTimeSeconds
          : 0;
      const savedHighScore =
        existing && typeof existing.highScore === 'number'
          ? existing.highScore
          : 0;

      if (savedMaxToro > this.maxDamageToToro) {
        this.maxDamageToToro = savedMaxToro;
      }
      if (savedBestTime > this.bestTimeSeconds) {
        this.bestTimeSeconds = savedBestTime;
      }
      if (savedHighScore > this.highScore) {
        this.highScore = savedHighScore;
      }

      const payload: Record<string, unknown> = {
        displayName: this.displayName,
        coins: this.coins,
        unlockedCharacters: Array.from(this.unlockedCharacters),
        selectedCharacter: this.selectedCharacter,
        unlockedHats: Array.from(this.unlockedHats),
        equippedHatId: this.equippedHatId,
        highScore: this.highScore,
        labLevels: { ...this.labLevels },
      };

      // Only overwrite maxDamageToToro / bestTimeSeconds if strictly greater than saved value (or if not yet present)
      if (!existing || typeof existing.maxDamageToToro !== 'number' || flooredToroDmg > savedMaxToro || this.maxDamageToToro > savedMaxToro) {
        payload.maxDamageToToro = Math.max(savedMaxToro, this.maxDamageToToro, flooredToroDmg);
      }
      if (!existing || typeof existing.bestTimeSeconds !== 'number' || flooredTime > savedBestTime || this.bestTimeSeconds > savedBestTime) {
        payload.bestTimeSeconds = Math.max(savedBestTime, this.bestTimeSeconds, flooredTime);
      }

      this.save();
      await setDoc(userDocRef, payload, { merge: true });
    } catch (err) {
      console.error('Error guardando datos en Firestore:', err);
    }
  }

  public async fetchTopToroDamageLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('maxDamageToToro', 'desc'), limit(10));
      const snap = await getDocs(q);
      const entries: LeaderboardEntry[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Partial<SavedMetaState>;
        entries.push({
          uid: docSnap.id,
          displayName:
            data.displayName && data.displayName.trim().length > 0
              ? data.displayName.trim()
              : 'Survivor',
          maxDamageToToro:
            typeof data.maxDamageToToro === 'number'
              ? Math.floor(data.maxDamageToToro)
              : 0,
          bestTimeSeconds:
            typeof data.bestTimeSeconds === 'number'
              ? Math.floor(data.bestTimeSeconds)
              : 0,
        });
      });
      return entries;
    } catch (err) {
      console.error('Error al cargar clasificación de Daño al Toro:', err);
      return [];
    }
  }

  public async fetchTopSurvivalTimeLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('bestTimeSeconds', 'desc'), limit(10));
      const snap = await getDocs(q);
      const entries: LeaderboardEntry[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Partial<SavedMetaState>;
        entries.push({
          uid: docSnap.id,
          displayName:
            data.displayName && data.displayName.trim().length > 0
              ? data.displayName.trim()
              : 'Survivor',
          maxDamageToToro:
            typeof data.maxDamageToToro === 'number'
              ? Math.floor(data.maxDamageToToro)
              : 0,
          bestTimeSeconds:
            typeof data.bestTimeSeconds === 'number'
              ? Math.floor(data.bestTimeSeconds)
              : 0,
        });
      });
      return entries;
    } catch (err) {
      console.error('Error al cargar clasificación de Tiempo de Supervivencia:', err);
      return [];
    }
  }

  public getEquippedHat(): HatItem | null {
    return getHatById(this.equippedHatId);
  }

  public getUnlockedHatsList(): HatItem[] {
    const rarityOrder: Record<string, number> = {
      MITICA: 0,
      LEGENDARIA: 1,
      EPICA: 2,
      RARA: 3,
      COMUN: 4,
    };
    return HATS_DATABASE.filter((h) => this.unlockedHats.has(h.id)).sort(
      (a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]
    );
  }

  public static readEquippedHatFromStorage(): HatItem | null {
    try {
      const raw =
        window.localStorage.getItem(STORAGE_KEY) ||
        window.localStorage.getItem('cyber_survivor_meta_v020');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SavedMetaState>;
      return getHatById(parsed.equippedHatId);
    } catch {
      return null;
    }
  }

  private applyParsedState(parsed: Partial<SavedMetaState>, mergeWithCurrent: boolean = false): void {
    if (typeof parsed.coins === 'number' && Number.isFinite(parsed.coins) && parsed.coins >= 0) {
      const sanitizedCoins = Math.min(999999, Math.floor(parsed.coins));
      this.coins = mergeWithCurrent
        ? Math.max(this.coins, sanitizedCoins)
        : sanitizedCoins;
    }
    if (Array.isArray(parsed.unlockedCharacters)) {
      const validUnlocked = parsed.unlockedCharacters.filter(
        (id): id is CharacterId => Boolean(this.characters[id as CharacterId])
      );
      if (mergeWithCurrent) {
        for (const c of validUnlocked) {
          this.unlockedCharacters.add(c);
        }
      } else {
        this.unlockedCharacters = new Set(['STANDARD', 'MORCILLITA', ...validUnlocked]);
      }
    }
    if (
      parsed.selectedCharacter &&
      this.characters[parsed.selectedCharacter] &&
      this.unlockedCharacters.has(parsed.selectedCharacter)
    ) {
      this.selectedCharacter = parsed.selectedCharacter;
    } else if (!mergeWithCurrent) {
      this.selectedCharacter = 'STANDARD';
    }
    if (Array.isArray(parsed.unlockedHats)) {
      const validHats = parsed.unlockedHats.filter((id) => Boolean(getHatById(id)));
      if (mergeWithCurrent) {
        for (const h of validHats) {
          this.unlockedHats.add(h);
        }
      } else {
        this.unlockedHats = new Set(validHats);
      }
    }
    if (parsed.equippedHatId && this.unlockedHats.has(parsed.equippedHatId)) {
      this.equippedHatId = parsed.equippedHatId;
    } else if (!mergeWithCurrent) {
      this.equippedHatId = null;
    }
    if (typeof parsed.displayName === 'string' && parsed.displayName.trim().length > 0) {
      const cleanName = parsed.displayName.replace(/[<>&"']/g, '').trim().slice(0, 20);
      if (cleanName.length > 0) {
        this.displayName = cleanName;
      }
    }
    if (typeof parsed.highScore === 'number' && Number.isFinite(parsed.highScore) && parsed.highScore >= 0) {
      this.highScore = Math.max(this.highScore, Math.floor(parsed.highScore));
    }
    if (typeof parsed.bestTimeSeconds === 'number' && Number.isFinite(parsed.bestTimeSeconds) && parsed.bestTimeSeconds >= 0) {
      this.bestTimeSeconds = Math.max(this.bestTimeSeconds, Math.min(86400, Math.floor(parsed.bestTimeSeconds)));
    }
    if (typeof parsed.maxDamageToToro === 'number' && Number.isFinite(parsed.maxDamageToToro) && parsed.maxDamageToToro >= 0) {
      this.maxDamageToToro = Math.max(this.maxDamageToToro, Math.floor(parsed.maxDamageToToro));
    }
    if (parsed.labLevels && typeof parsed.labLevels === 'object') {
      for (const id of LAB_UPGRADES_ORDER) {
        const cfg = LAB_UPGRADES_CONFIG[id];
        const rawVal = parsed.labLevels[id];
        if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
          const cleanLvl = Math.max(0, Math.min(cfg.maxLevel, Math.floor(rawVal)));
          this.labLevels[id] = mergeWithCurrent
            ? Math.max(this.labLevels[id] ?? 0, cleanLvl)
            : cleanLvl;
        }
      }
    }
  }

  private getStatePayload(): SavedMetaState {
    return {
      displayName: this.displayName,
      coins: this.coins,
      unlockedCharacters: Array.from(this.unlockedCharacters),
      selectedCharacter: this.selectedCharacter,
      unlockedHats: Array.from(this.unlockedHats),
      equippedHatId: this.equippedHatId,
      highScore: this.highScore,
      bestTimeSeconds: this.bestTimeSeconds,
      maxDamageToToro: this.maxDamageToToro,
      labLevels: { ...this.labLevels },
    };
  }

  private load(): void {
    try {
      const raw =
        window.localStorage.getItem(STORAGE_KEY) ||
        window.localStorage.getItem('cyber_survivor_meta_v020');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SavedMetaState>;
      this.applyParsedState(parsed);
    } catch {
      // Ignorar errores de almacenamiento restringido
    }
  }

  public save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.getStatePayload()));
      this.dirty = false;
      this.lastSaveTime = performance.now();
    } catch {
      // Ignorar errores de almacenamiento restringido
    }
  }

  public saveThrottled(intervalMs: number = 4000): void {
    this.dirty = true;
    const now = performance.now();
    if (now - this.lastSaveTime >= intervalMs) {
      this.save();
    }
  }

  public payNightmareEntry(): { success: boolean; message: string } {
    if (this.coins < NIGHTMARE_ENTRY_COST) {
      return {
        success: false,
        message: `> ERROR: Necesitas ${NIGHTMARE_ENTRY_COST} CryptoCoins para activar Modo Pesadilla (Tienes ${this.coins}).`,
      };
    }
    this.coins -= NIGHTMARE_ENTRY_COST;
    this.save();
    void this.syncToCloud();
    return {
      success: true,
      message: `> PROTOCOLO PESADILLA ACTIVADO (-${NIGHTMARE_ENTRY_COST} CR). ¡Suerte, Agente!`,
    };
  }

  public flushPendingSave(): void {
    if (this.dirty) {
      this.save();
    }
  }
}
