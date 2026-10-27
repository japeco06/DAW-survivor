export type HatRarity = 'COMUN' | 'RARA' | 'EPICA' | 'LEGENDARIA' | 'MITICA';

export interface HatStats {
  damageMult?: number;   // Ej. 0.10 = +10% daño
  speedMult?: number;    // Ej. 0.08 = +8% velocidad
  fireRateMult?: number; // Ej. 0.10 = +10% cadencia de disparo
  maxHpBonus?: number;   // Ej. +25 HP planos
  magnetBonus?: number;  // Ej. +40px de radio magnético
  critChance?: number;   // Ej. 0.12 = 12% probabilidad de golpe crítico (x2 daño)
}

export interface HatItem {
  id: string;
  name: string;
  rarity: HatRarity;
  icon: string;
  stats: HatStats;
  statsLabel: string;
}

export const RARITY_CONFIG: Record<
  HatRarity,
  { label: string; chance: number; color: string; bgColor: string }
> = {
  COMUN: {
    label: 'COMÚN (40%)',
    chance: 40,
    color: '#94a3b8',
    bgColor: 'rgba(30, 41, 59, 0.92)',
  },
  RARA: {
    label: 'RARA (30%)',
    chance: 30,
    color: '#38bdf8',
    bgColor: 'rgba(12, 45, 72, 0.92)',
  },
  EPICA: {
    label: 'ÉPICA (20%)',
    chance: 20,
    color: '#c084fc',
    bgColor: 'rgba(46, 16, 101, 0.92)',
  },
  LEGENDARIA: {
    label: 'LEGENDARIA (9%)',
    chance: 9,
    color: '#fbbf24',
    bgColor: 'rgba(69, 26, 3, 0.94)',
  },
  MITICA: {
    label: 'MÍTICA (1%)',
    chance: 1,
    color: '#f43f5e',
    bgColor: 'rgba(76, 5, 25, 0.96)',
  },
};

export const HATS_DATABASE: HatItem[] = [
  // ==========================================================================
  // 10 COMUNES (40% DROP)
  // ==========================================================================
  {
    id: 'com_1',
    name: 'Visera de Becario',
    rarity: 'COMUN',
    icon: '🧢',
    stats: { speedMult: 0.04 },
    statsLabel: '+4% Velocidad',
  },
  {
    id: 'com_2',
    name: 'Casco de Obra Amarillo',
    rarity: 'COMUN',
    icon: '👷',
    stats: { maxHpBonus: 10 },
    statsLabel: '+10 Vida Máx',
  },
  {
    id: 'com_3',
    name: 'Gorro de Lana Gris',
    rarity: 'COMUN',
    icon: '🧶',
    stats: { magnetBonus: 18 },
    statsLabel: '+18px Imán',
  },
  {
    id: 'com_4',
    name: 'Diadema de Cable UTP',
    rarity: 'COMUN',
    icon: '🔌',
    stats: { fireRateMult: 0.04 },
    statsLabel: '+4% Cadencia',
  },
  {
    id: 'com_5',
    name: 'Gafas de Plástico Sin Cristal',
    rarity: 'COMUN',
    icon: '👓',
    stats: { critChance: 0.03 },
    statsLabel: '+3% Crítico',
  },
  {
    id: 'com_6',
    name: 'Sombrero de Papel de Aluminio',
    rarity: 'COMUN',
    icon: '📡',
    stats: { magnetBonus: 22 },
    statsLabel: '+22px Imán',
  },
  {
    id: 'com_7',
    name: 'Boina de Soporte Técnico',
    rarity: 'COMUN',
    icon: '🎓',
    stats: { damageMult: 0.04 },
    statsLabel: '+4% Daño',
  },
  {
    id: 'com_8',
    name: 'Cinta Sudorosa de Ping',
    rarity: 'COMUN',
    icon: '🎗️',
    stats: { speedMult: 0.05 },
    statsLabel: '+5% Velocidad',
  },
  {
    id: 'com_9',
    name: 'Orejeras de Call Center',
    rarity: 'COMUN',
    icon: '🎧',
    stats: { fireRateMult: 0.05 },
    statsLabel: '+5% Cadencia',
  },
  {
    id: 'com_10',
    name: 'Antifaz de Modo Oscuro',
    rarity: 'COMUN',
    icon: '🕶️',
    stats: { damageMult: 0.05 },
    statsLabel: '+5% Daño',
  },

  // ==========================================================================
  // 10 RARAS (30% DROP)
  // ==========================================================================
  {
    id: 'rar_1',
    name: 'Gafas Protectoras de Laboratorio',
    rarity: 'RARA',
    icon: '🥽',
    stats: { critChance: 0.06, damageMult: 0.04 },
    statsLabel: '+6% Crítico, +4% Daño',
  },
  {
    id: 'rar_2',
    name: 'Casco de Ciclista Urbano',
    rarity: 'RARA',
    icon: '🚴',
    stats: { speedMult: 0.08, maxHpBonus: 12 },
    statsLabel: '+8% Vel, +12 HP',
  },
  {
    id: 'rar_3',
    name: 'Sombrero de Paja Compilador',
    rarity: 'RARA',
    icon: '👒',
    stats: { fireRateMult: 0.08, magnetBonus: 25 },
    statsLabel: '+8% Cadencia, +25px Imán',
  },
  {
    id: 'rar_4',
    name: 'Visor LED Azul',
    rarity: 'RARA',
    icon: '💠',
    stats: { damageMult: 0.08, critChance: 0.04 },
    statsLabel: '+8% Daño, +4% Crítico',
  },
  {
    id: 'rar_5',
    name: 'Gorro de Marinero de Red',
    rarity: 'RARA',
    icon: '⚓',
    stats: { maxHpBonus: 20, damageMult: 0.05 },
    statsLabel: '+20 HP, +5% Daño',
  },
  {
    id: 'rar_6',
    name: 'Fez de Encriptación',
    rarity: 'RARA',
    icon: '🎩',
    stats: { magnetBonus: 40, speedMult: 0.05 },
    statsLabel: '+40px Imán, +5% Vel',
  },
  {
    id: 'rar_7',
    name: 'Máscara Quirúrgica Antivirus',
    rarity: 'RARA',
    icon: '😷',
    stats: { maxHpBonus: 24 },
    statsLabel: '+24 Vida Máx',
  },
  {
    id: 'rar_8',
    name: 'Auriculares Gaming RGB',
    rarity: 'RARA',
    icon: '🎮',
    stats: { fireRateMult: 0.1 },
    statsLabel: '+10% Cadencia',
  },
  {
    id: 'rar_9',
    name: 'Bandana de Hacker Callejero',
    rarity: 'RARA',
    icon: '🏴',
    stats: { speedMult: 0.09, critChance: 0.04 },
    statsLabel: '+9% Vel, +4% Crítico',
  },
  {
    id: 'rar_10',
    name: 'Monóculo de Depuración',
    rarity: 'RARA',
    icon: '🧐',
    stats: { critChance: 0.08 },
    statsLabel: '+8% Crítico',
  },

  // ==========================================================================
  // 10 ÉPICAS (20% DROP)
  // ==========================================================================
  {
    id: 'epi_1',
    name: 'Casco Ciberpunk de Neón',
    rarity: 'EPICA',
    icon: '🤖',
    stats: { damageMult: 0.12, fireRateMult: 0.08 },
    statsLabel: '+12% Daño, +8% Cadencia',
  },
  {
    id: 'epi_2',
    name: 'Máscara Oni Carmesí',
    rarity: 'EPICA',
    icon: '👹',
    stats: { damageMult: 0.15, critChance: 0.06 },
    statsLabel: '+15% Daño, +6% Crítico',
  },
  {
    id: 'epi_3',
    name: 'Chistera Steampunk de Cobre',
    rarity: 'EPICA',
    icon: '⚙️',
    stats: { magnetBonus: 65, fireRateMult: 0.1 },
    statsLabel: '+65px Imán, +10% Cadencia',
  },
  {
    id: 'epi_4',
    name: 'Corona de Fibra Óptica',
    rarity: 'EPICA',
    icon: '👑',
    stats: { speedMult: 0.12, magnetBonus: 50 },
    statsLabel: '+12% Vel, +50px Imán',
  },
  {
    id: 'epi_5',
    name: 'Yelmo de Paladín del Firewall',
    rarity: 'EPICA',
    icon: '🛡️',
    stats: { maxHpBonus: 40, damageMult: 0.08 },
    statsLabel: '+40 HP, +8% Daño',
  },
  {
    id: 'epi_6',
    name: 'Visor Táctico Francotirador',
    rarity: 'EPICA',
    icon: '🎯',
    stats: { critChance: 0.12, damageMult: 0.1 },
    statsLabel: '+12% Crítico, +10% Daño',
  },
  {
    id: 'epi_7',
    name: 'Máscara de Peste Binaria',
    rarity: 'EPICA',
    icon: '🦅',
    stats: { maxHpBonus: 30, fireRateMult: 0.12 },
    statsLabel: '+30 HP, +12% Cadencia',
  },
  {
    id: 'epi_8',
    name: 'Turbante del Oráculo SQL',
    rarity: 'EPICA',
    icon: '🔮',
    stats: { magnetBonus: 80, critChance: 0.08 },
    statsLabel: '+80px Imán, +8% Crítico',
  },
  {
    id: 'epi_9',
    name: 'Casco Espacial de Vacío',
    rarity: 'EPICA',
    icon: '👨‍🚀',
    stats: { maxHpBonus: 35, speedMult: 0.1 },
    statsLabel: '+35 HP, +10% Vel',
  },
  {
    id: 'epi_10',
    name: 'Capucha de Asesino Silencioso',
    rarity: 'EPICA',
    icon: '🥷',
    stats: { speedMult: 0.14, critChance: 0.1 },
    statsLabel: '+14% Vel, +10% Crítico',
  },

  // ==========================================================================
  // 10 LEGENDARIAS (9% DROP)
  // ==========================================================================
  {
    id: 'leg_1',
    name: 'Corona del Rey Lich Digital',
    rarity: 'LEGENDARIA',
    icon: '💀',
    stats: { damageMult: 0.22, maxHpBonus: 45, critChance: 0.1 },
    statsLabel: '+22% Daño, +45 HP, +10% Crít',
  },
  {
    id: 'leg_2',
    name: 'Aureola de Superusuario Root',
    rarity: 'LEGENDARIA',
    icon: '😇',
    stats: { fireRateMult: 0.2, speedMult: 0.15, magnetBonus: 90 },
    statsLabel: '+20% Cadencia, +15% Vel, +90 Imán',
  },
  {
    id: 'leg_3',
    name: 'Yelmo Valquiria de Cobalto',
    rarity: 'LEGENDARIA',
    icon: '⚡',
    stats: { damageMult: 0.2, speedMult: 0.18, critChance: 0.12 },
    statsLabel: '+20% Daño, +18% Vel, +12% Crít',
  },
  {
    id: 'leg_4',
    name: 'Máscara Kitsune de Nueve Hilos',
    rarity: 'LEGENDARIA',
    icon: '🦊',
    stats: { fireRateMult: 0.22, critChance: 0.15 },
    statsLabel: '+22% Cadencia, +15% Crítico',
  },
  {
    id: 'leg_5',
    name: 'Casco de Centurión Cuántico',
    rarity: 'LEGENDARIA',
    icon: '⚔️',
    stats: { maxHpBonus: 70, damageMult: 0.18 },
    statsLabel: '+70 HP, +18% Daño',
  },
  {
    id: 'leg_6',
    name: 'Sombrero del Arquitecto Matrix',
    rarity: 'LEGENDARIA',
    icon: '🎩',
    stats: { fireRateMult: 0.18, magnetBonus: 110, damageMult: 0.15 },
    statsLabel: '+18% Cad, +110 Imán, +15% Daño',
  },
  {
    id: 'leg_7',
    name: 'Diadema de Singularidad',
    rarity: 'LEGENDARIA',
    icon: '🌌',
    stats: { magnetBonus: 140, speedMult: 0.16, critChance: 0.12 },
    statsLabel: '+140 Imán, +16% Vel, +12% Crít',
  },
  {
    id: 'leg_8',
    name: 'Cráneo de Dragón de Silicio',
    rarity: 'LEGENDARIA',
    icon: '🐉',
    stats: { damageMult: 0.25, maxHpBonus: 50 },
    statsLabel: '+25% Daño, +50 HP',
  },
  {
    id: 'leg_9',
    name: 'Visor del Viajero Temporal',
    rarity: 'LEGENDARIA',
    icon: '⏳',
    stats: { speedMult: 0.22, fireRateMult: 0.2 },
    statsLabel: '+22% Vel, +20% Cadencia',
  },
  {
    id: 'leg_10',
    name: 'Tiara del Dios Máquina',
    rarity: 'LEGENDARIA',
    icon: '🔱',
    stats: { damageMult: 0.2, fireRateMult: 0.18, maxHpBonus: 40 },
    statsLabel: '+20% Daño, +18% Cad, +40 HP',
  },

  // ==========================================================================
  // 10 MÍTICAS (1% DROP - CULTURA POP ICÓNICA)
  // ==========================================================================
  {
    id: 'mit_1',
    name: 'Gorro de Teemo',
    rarity: 'MITICA',
    icon: '🍄',
    stats: { speedMult: 0.28, fireRateMult: 0.25, critChance: 0.2 },
    statsLabel: '+28% Vel, +25% Cadencia, +20% Crít',
  },
  {
    id: 'mit_2',
    name: 'Gafas de Bubbles',
    rarity: 'MITICA',
    icon: '🤓',
    stats: { magnetBonus: 200, critChance: 0.25, damageMult: 0.25 },
    statsLabel: '+200px Imán, +25% Crít, +25% Daño',
  },
  {
    id: 'mit_3',
    name: 'Gorra de Ash',
    rarity: 'MITICA',
    icon: '🔴',
    stats: { fireRateMult: 0.3, speedMult: 0.22, magnetBonus: 150 },
    statsLabel: '+30% Cadencia, +22% Vel, +150 Imán',
  },
  {
    id: 'mit_4',
    name: 'Máscara de Darth Vader',
    rarity: 'MITICA',
    icon: '🖤',
    stats: { damageMult: 0.35, maxHpBonus: 90, magnetBonus: 120 },
    statsLabel: '+35% Daño, +90 HP, +120px Imán',
  },
  {
    id: 'mit_5',
    name: 'Casco de Iron Man',
    rarity: 'MITICA',
    icon: '🦾',
    stats: { damageMult: 0.3, fireRateMult: 0.28, maxHpBonus: 75 },
    statsLabel: '+30% Daño, +28% Cadencia, +75 HP',
  },
  {
    id: 'mit_6',
    name: 'Sombrero Seleccionador',
    rarity: 'MITICA',
    icon: '🧙',
    stats: { damageMult: 0.28, fireRateMult: 0.25, magnetBonus: 160, critChance: 0.18 },
    statsLabel: '+28% Daño, +25% Cad, +160 Imán, +18% Crít',
  },
  {
    id: 'mit_7',
    name: 'Máscara de Vendetta',
    rarity: 'MITICA',
    icon: '🎭',
    stats: { critChance: 0.3, damageMult: 0.32, speedMult: 0.2 },
    statsLabel: '+30% Crítico, +32% Daño, +20% Vel',
  },
  {
    id: 'mit_8',
    name: 'Sombrero de Indiana Jones',
    rarity: 'MITICA',
    icon: '🤠',
    stats: { speedMult: 0.26, fireRateMult: 0.26, critChance: 0.22, maxHpBonus: 50 },
    statsLabel: '+26% Vel, +26% Cad, +22% Crít, +50 HP',
  },
  {
    id: 'mit_9',
    name: 'Máscara de Jason',
    rarity: 'MITICA',
    icon: '🏒',
    stats: { maxHpBonus: 120, damageMult: 0.35, critChance: 0.15 },
    statsLabel: '+120 HP, +35% Daño, +15% Crítico',
  },
  {
    id: 'mit_10',
    name: 'Gafas de Heisenberg',
    rarity: 'MITICA',
    icon: '🧪',
    stats: { damageMult: 0.38, critChance: 0.28, fireRateMult: 0.2 },
    statsLabel: '+38% Daño, +28% Crítico, +20% Cadencia',
  },
];

export function getHatById(id: string | null | undefined): HatItem | null {
  if (!id) return null;
  return HATS_DATABASE.find((h) => h.id === id) ?? null;
}

export function rollGachaHat(): HatItem {
  const roll = Math.random() * 100;
  let selectedRarity: HatRarity = 'COMUN';

  if (roll < 1) {
    selectedRarity = 'MITICA';
  } else if (roll < 10) {
    selectedRarity = 'LEGENDARIA';
  } else if (roll < 30) {
    selectedRarity = 'EPICA';
  } else if (roll < 60) {
    selectedRarity = 'RARA';
  } else {
    selectedRarity = 'COMUN';
  }

  const pool = HATS_DATABASE.filter((h) => h.rarity === selectedRarity);
  return pool[Math.floor(Math.random() * pool.length)];
}
