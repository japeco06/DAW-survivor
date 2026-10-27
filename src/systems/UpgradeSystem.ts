import { Player } from '../entities/Player';
import { CombatSystem } from './CombatSystem';

export interface UpgradeOption {
  id: string;
  name: string;
  category: string;
  description: string;
  color: string;
  level: number;
  maxLevel: number;
  isWeapon?: boolean;
  isMemoryOverclock?: boolean;
  apply: (player: Player, combat: CombatSystem) => void;
}

/**
 * Sistema de Experiencia y Tarjetas de Nivel (v0.3.0 - Fase 1).
 * Al llenarse la barra de XP, pausa el juego y ofrece 3 Tarjetas de Mejora (armas y pasivas),
 * incluyendo la nueva tarjeta pasiva 'Overclock de Memoria' que multiplica permanentemente la XP.
 */
export class UpgradeSystem {
  public level: number = 1;
  public currentXp: number = 0;
  public xpToNextLevel: number = 150;
  public pendingLevelUps: number = 0;

  private upgrades: UpgradeOption[] = [];
  public currentChoices: UpgradeOption[] = [];

  constructor() {
    this.initUpgrades();
  }

  private initUpgrades(): void {
    this.upgrades = [
      {
        id: 'memory_overclock',
        name: 'OVERCLOCK DE MEMORIA',
        category: 'PASIVA // MULTIPLICADOR XP',
        description:
          'Aplica un multiplicador permanente (+35% XP) a la experiencia que otorgan todos los futuros orbes de código.',
        color: '#a3e635',
        level: 0,
        maxLevel: 5,
        isMemoryOverclock: true,
        apply: (player) => {
          player.xpMultiplier = Number((player.xpMultiplier + 0.35).toFixed(2));
        },
      },
      {
        id: 'electromagnet',
        name: 'ELECTROIMÁN',
        category: 'PASIVA // CAMPO MAGNÉTICO',
        description:
          'Amplía intensamente el campo electromagnético (+90px de radio) para atraer orbes de XP y Criptomonedas desde mucho más lejos.',
        color: '#38bdf8',
        level: 0,
        maxLevel: 5,
        apply: (player) => {
          player.pickupRadius += 90;
        },
      },
      {
        id: 'ping_tracker',
        name: 'PING_TRACKER.exe',
        category: 'ARMA // HOMING',
        description:
          'Lanza proyectiles azules inteligentes que persiguen automáticamente al enemigo más cercano.',
        color: '#3b82f6',
        level: 0,
        maxLevel: 5,
        isWeapon: true,
        apply: (_player, combat) => {
          combat.pingTrackerLevel += 1;
          combat.pingDamage += 8;
          combat.pingCooldown = Math.max(0.35, combat.pingCooldown * 0.86);
        },
      },
      {
        id: 'quarantine_zone',
        name: 'ZONA_CUARENTENA.sys',
        category: 'ARMA // ÁREA DoT',
        description:
          'Despliega un perímetro estático en el suelo que inflige daño continuo a los enemigos que lo pisen.',
        color: '#10b981',
        level: 0,
        maxLevel: 5,
        isWeapon: true,
        apply: (_player, combat) => {
          combat.quarantineLevel += 1;
          combat.quarantineRadius += 14;
          combat.quarantineDamage += 5;
          combat.quarantineCooldown = Math.max(1.8, combat.quarantineCooldown * 0.88);
        },
      },
      {
        id: 'overclocking',
        name: 'OVERCLOCKING.exe',
        category: 'PASIVA // CADENCIA',
        description:
          'Mejora tu Ráfaga de Firewall aumentando la cadencia de disparo (+22%) y velocidad de proyectil.',
        color: '#00f0ff',
        level: 0,
        maxLevel: 6,
        apply: (_player, combat) => {
          combat.fireCooldown = Math.max(0.1, combat.fireCooldown * 0.82);
          combat.projectileSpeed += 45;
        },
      },
      {
        id: 'multithreading',
        name: 'MULTITHREADING.dll',
        category: 'ARMA // MULTIDISPARO',
        description:
          'Añade +1 proyectil simultáneo a tu Ráfaga de Firewall para cubrir múltiples ángulos.',
        color: '#d946ef',
        level: 0,
        maxLevel: 5,
        apply: (_player, combat) => {
          combat.multiShotCount += 1;
        },
      },
      {
        id: 'firewall',
        name: 'FIREWALL_ORBIT.sys',
        category: 'ARMA // PERÍMETRO ORBITAL',
        description:
          'Despliega un nodo ígneo orbital que gira alrededor del Agente y quema el Malware al contacto.',
        color: '#ff8800',
        level: 0,
        maxLevel: 6,
        apply: (_player, combat) => {
          combat.firewallCount += 1;
          combat.firewallDamage += 6;
        },
      },
      {
        id: 'deepscan',
        name: 'HEURISTIC_SCAN.bat',
        category: 'PASIVA // POTENCIA',
        description:
          'Incrementa el daño de la Ráfaga de Firewall (+15) y amplía el radio del escáner (+60px).',
        color: '#facc15',
        level: 0,
        maxLevel: 5,
        apply: (_player, combat) => {
          combat.projectileDamage += 15;
          combat.attackRange += 60;
        },
      },
      {
        id: 'fiber_bus',
        name: 'FIBER_OPTIC_BUS.drv',
        category: 'PASIVA // VELOCIDAD E IMÁN',
        description:
          'Aumenta la velocidad de movimiento (+15%) y el radio magnético de recolección (+45px).',
        color: '#38bdf8',
        level: 0,
        maxLevel: 5,
        apply: (player) => {
          player.speed = Math.round(player.speed * 1.15);
          player.pickupRadius += 45;
        },
      },
      {
        id: 'system_restore',
        name: 'SYSTEM_RESTORE.iso',
        category: 'PASIVA // SALUD KERNEL',
        description:
          'Amplía la integridad máxima (+25 HP) y repara inmediatamente +40 HP del Agente.',
        color: '#00ff66',
        level: 0,
        maxLevel: 6,
        apply: (player) => {
          player.maxHp += 25;
          player.heal(40);
        },
      },
    ];
  }

  public addXp(amount: number): boolean {
    this.currentXp += amount;

    while (this.currentXp >= this.xpToNextLevel) {
      this.currentXp -= this.xpToNextLevel;
      this.level++;
      this.xpToNextLevel = Math.round(this.xpToNextLevel * 1.15 + 12);
      this.pendingLevelUps++;
    }

    if (this.pendingLevelUps > 0 && this.currentChoices.length === 0) {
      this.rollChoices();
      return true;
    }

    return false;
  }

  /**
   * Genera 3 tarjetas de mejora. En la primera subida de nivel garantiza que aparezca
   * 'Overclock de Memoria' junto con una de las armas nuevas para facilitar su prueba inmediata.
   */
  public rollChoices(): UpgradeOption[] {
    const available = this.upgrades.filter((u) => u.level < u.maxLevel);
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);

    // En el primer Level Up (Nivel 2), asegurar que 'Overclock de Memoria' esté presente si aún es nivel 0
    const memOverclock = available.find((u) => u.isMemoryOverclock && u.level === 0);
    if (this.level === 2 && memOverclock && !selected.some((u) => u.id === memOverclock.id)) {
      selected[0] = memOverclock;
    }

    // Asegurar también que al menos una de las armas nuevas salga temprano
    const newWeapons = available.filter((u) => u.isWeapon && u.level === 0);
    if (
      newWeapons.length > 0 &&
      !selected.some((u) => u.isWeapon) &&
      selected.length > 1
    ) {
      selected[1] = newWeapons[Math.floor(Math.random() * newWeapons.length)];
    }

    this.currentChoices = selected;
    return this.currentChoices;
  }

  public selectUpgrade(index: number, player: Player, combat: CombatSystem): boolean {
    const choice = this.currentChoices[index];
    if (!choice) return false;

    choice.level++;
    choice.apply(player, combat);
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    this.currentChoices = [];

    if (this.pendingLevelUps > 0) {
      this.rollChoices();
    }

    return true;
  }

  public isChoosingUpgrade(): boolean {
    return this.currentChoices.length > 0;
  }
}
