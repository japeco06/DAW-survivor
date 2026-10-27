export type CharacterId = 'STANDARD' | 'ROOT' | 'PROXY';

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
}

const STORAGE_KEY = 'cyber_survivor_meta_v020';

export class MetaSystem {
  public coins: number = 0;
  public unlockedCharacters: Set<CharacterId> = new Set(['STANDARD']);
  public selectedCharacter: CharacterId = 'STANDARD';

  public readonly characterOrder: CharacterId[] = ['STANDARD', 'ROOT', 'PROXY'];

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
  };

  constructor() {
    this.load();
  }

  public addCoins(amount: number): void {
    this.coins += amount;
    this.save();
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
        this.unlockedCharacters = new Set(['STANDARD', ...validUnlocked]);
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
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignorar errores de almacenamiento restringido
    }
  }
}
