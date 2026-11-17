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
}

export const STORAGE_KEY = 'cyber_survivor_meta_v020';
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
      const raw = window.localStorage.getItem(STORAGE_KEY);
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
    };
  }

  private load(): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
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
