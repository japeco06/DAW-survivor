import { HatItem, HATS_DATABASE, getHatById, rollGachaHat, RARITY_CONFIG } from './HatSystem';

export type CharacterId = 'STANDARD' | 'ROOT' | 'PROXY' | 'MORCILLITA';

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
  coins: number;
  unlockedCharacters: CharacterId[];
  selectedCharacter: CharacterId;
  unlockedHats?: string[];
  equippedHatId?: string | null;
  highScore?: number;
  bestTimeSeconds?: number;
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
  public coins: number = 0;
  public unlockedCharacters: Set<CharacterId> = new Set(['STANDARD', 'MORCILLITA']);
  public selectedCharacter: CharacterId = 'STANDARD';
  public unlockedHats: Set<string> = new Set();
  public equippedHatId: string | null = null;
  public highScore: number = 0;
  public bestTimeSeconds: number = 0;

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

  public updateHighScore(kills: number, elapsedSeconds: number): void {
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
      return {
        success: true,
        message: `> Sombrero desequipado: ${hat.name}.`,
      };
    }

    this.equippedHatId = hatId;
    this.save();
    return {
      success: true,
      message: `> EQUIPADO: ${hat.icon} ${hat.name} [${hat.statsLabel}]`,
    };
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

  private load(): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SavedMetaState>;
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
      if (typeof parsed.highScore === 'number' && parsed.highScore >= 0) {
        this.highScore = Math.floor(parsed.highScore);
      }
      if (typeof parsed.bestTimeSeconds === 'number' && parsed.bestTimeSeconds >= 0) {
        this.bestTimeSeconds = Math.floor(parsed.bestTimeSeconds);
      }
    } catch {
      // Ignorar errores de almacenamiento restringido
    }
  }

  private save(): void {
    try {
      const state: SavedMetaState = {
        coins: this.coins,
        unlockedCharacters: Array.from(this.unlockedCharacters),
        selectedCharacter: this.selectedCharacter,
        unlockedHats: Array.from(this.unlockedHats),
        equippedHatId: this.equippedHatId,
        highScore: this.highScore,
        bestTimeSeconds: this.bestTimeSeconds,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignorar errores de almacenamiento restringido
    }
  }
}
