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

export type CharacterId = 'STANDARD' | 'ROOT' | 'PROXY' | 'MORCILLITA';

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  maxDamageToToro: number;
  bestTimeSeconds: number;
}

export interface CharacterProfile {
  id: CharacterId;
  name: string;
  subtitle: string;
  description: string;
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

  public readonly characterOrder: CharacterId[] = ['STANDARD', 'ROOT', 'PROXY', 'MORCILLITA'];

  public readonly characters: Record<CharacterId, CharacterProfile> = {
    STANDARD: {
      id: 'STANDARD',
      name: 'AGENTE ESTÁNDAR',
      subtitle: 'KERNEL_DEFENDER // BASE',
      description: 'Unidad antivirus equilibrada. Salud base (100 HP), velocidad 100% y chasis verde neón.',
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
      subtitle: 'SUPERUSER // +20% VELOCIDAD',
      description: 'Privilegios elevados de superusuario. Cuadrado azul oscuro que se mueve un 20% más rápido.',
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
      subtitle: 'HEAVY_SHIELD // 2X SALUD, -15% VEL',
      description: 'Cuadrado morado blindado: tiene el doble de salud máxima (200 HP), pero su velocidad es un 15% menor.',
      color: '#9333ea',
      borderColor: '#f3e8ff',
      speedMultiplier: 0.85,
      hpMultiplier: 2.0,
      pickupRadiusMultiplier: 1.0,
      cost: 15,
    },
    MORCILLITA: {
      id: 'MORCILLITA',
      name: 'AGENTE MORCILLITA (SUMMONER)',
      subtitle: 'CHASSIS ROSA // MASCOTA EVOLUTIVA LVL 20',
      description: 'Sin disparo básico propio. Su ataque depende 100% de una mascota acompañante marrón con 3 ramas evolutivas.',
      color: '#ec4899',
      borderColor: '#fbcfe8',
      speedMultiplier: 1.05,
      hpMultiplier: 1.0,
      pickupRadiusMultiplier: 1.0,
      cost: 0,
    },
  };

  constructor() {
    this.load();
  }

  public addCoins(amount: number): void {
    this.coins += amount;
    this.save();
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
      this.save();
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
        this.applyParsedState(cloudData);
        if (currentUser && currentUser.displayName && currentUser.displayName.trim().length > 0) {
          this.displayName = currentUser.displayName.trim();
        }
        this.save();
        // Ensure displayName and leaderboard fields exist in Firestore document
        if (
          cloudData.displayName !== this.displayName ||
          typeof cloudData.maxDamageToToro !== 'number' ||
          typeof cloudData.bestTimeSeconds !== 'number'
        ) {
          await setDoc(
            userDocRef,
            {
              displayName: this.displayName,
              maxDamageToToro: this.maxDamageToToro,
              bestTimeSeconds: this.bestTimeSeconds,
            },
            { merge: true }
          );
        }
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

  private applyParsedState(parsed: Partial<SavedMetaState>): void {
    if (typeof parsed.coins === 'number' && parsed.coins >= 0) {
      this.coins = Math.floor(parsed.coins);
    }
    if (Array.isArray(parsed.unlockedCharacters)) {
      const validUnlocked = parsed.unlockedCharacters.filter(
        (id): id is CharacterId => Boolean(this.characters[id as CharacterId])
      );
      this.unlockedCharacters = new Set(['STANDARD', 'MORCILLITA', ...validUnlocked]);
    }
    if (
      parsed.selectedCharacter &&
      this.characters[parsed.selectedCharacter] &&
      this.unlockedCharacters.has(parsed.selectedCharacter)
    ) {
      this.selectedCharacter = parsed.selectedCharacter;
    } else {
      this.selectedCharacter = 'STANDARD';
    }
    if (Array.isArray(parsed.unlockedHats)) {
      const validHats = parsed.unlockedHats.filter((id) => Boolean(getHatById(id)));
      this.unlockedHats = new Set(validHats);
    }
    if (parsed.equippedHatId && this.unlockedHats.has(parsed.equippedHatId)) {
      this.equippedHatId = parsed.equippedHatId;
    } else {
      this.equippedHatId = null;
    }
    if (typeof parsed.displayName === 'string' && parsed.displayName.trim().length > 0) {
      this.displayName = parsed.displayName.trim();
    }
    if (typeof parsed.highScore === 'number' && parsed.highScore >= 0) {
      this.highScore = Math.max(this.highScore, Math.floor(parsed.highScore));
    }
    if (typeof parsed.bestTimeSeconds === 'number' && parsed.bestTimeSeconds >= 0) {
      this.bestTimeSeconds = Math.max(this.bestTimeSeconds, Math.floor(parsed.bestTimeSeconds));
    }
    if (typeof parsed.maxDamageToToro === 'number' && parsed.maxDamageToToro >= 0) {
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

  private save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.getStatePayload()));
    } catch {
      // Ignorar errores de almacenamiento restringido
    }
  }
}
