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
  isMaxed?: boolean;
  isWeapon?: boolean;
  isMemoryOverclock?: boolean;
  isCompanionBranchCard?: boolean;
  isBasicShotOnly?: boolean;
  isCompanionStatCard?: boolean;
  apply: (player: Player, combat: CombatSystem) => void;
}

/**
 * Sistema de Experiencia y Tarjetas de Nivel (v0.3.0 - Fase 1).
 * Al llenarse la barra de XP, pausa el juego y ofrece 3 Tarjetas de Mejora (armas y pasivas),
 * incluyendo la nueva tarjeta pasiva 'Overclock de Memoria' que multiplica permanentemente la XP.
 */
export const MAX_WEAPON_SLOTS = 4;

export class UpgradeSystem {
  public level: number = 1;
  public currentXp: number = 0;
  public xpToNextLevel: number = 150;
  public pendingLevelUps: number = 0;

  private upgrades: UpgradeOption[] = [];
  private companionBranchCards: UpgradeOption[] = [];
  public currentChoices: UpgradeOption[] = [];

  constructor() {
    this.initUpgrades();
  }

  public getEquippedWeaponsCount(): number {
    // 1 (disparo básico inicial 'Ráfaga de Firewall') + armas adicionales desbloqueadas
    return 1 + this.upgrades.filter((u) => u.isWeapon && u.level > 0).length;
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
        id: 'bandwidth_leech',
        name: 'ROBO DE ANCHO DE BANDA',
        category: 'PASIVA // VAMPIRISMO',
        description:
          'Drena +1 HP al impactar con proyectiles. Escalado (5 niveles): 3% / 4.5% / 6% / 7.5% / 10%.',
        color: '#f43f5e',
        level: 0,
        maxLevel: 5,
        isMaxed: false,
        apply: function (player) {
          const vampirismRates = [0.03, 0.045, 0.06, 0.075, 0.1];
          const idx = Math.max(0, Math.min(vampirismRates.length - 1, this.level - 1));
          player.vampirismChance = vampirismRates[idx];
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
        id: 'antivirus_drones',
        name: 'DRONES ANTIVIRUS',
        category: 'ARMA // ORBITAL',
        description:
          'Despliega drones que orbitan en círculos alrededor del Agente dañando al contacto (+1 dron, +daño y +velocidad de órbita por nivel).',
        color: '#00f0ff',
        level: 0,
        maxLevel: 5,
        isWeapon: true,
        apply: (_player, combat) => {
          combat.dronesLevel += 1;
          combat.firewallCount += 1;
          combat.firewallDamage += 8;
          combat.firewallOrbitSpeed = Number((combat.firewallOrbitSpeed * 1.16).toFixed(2));
        },
      },
      {
        id: 'firewall_pulse',
        name: 'CORTAFUEGOS',
        category: 'ARMA // ONDA EXPANSIVA',
        description:
          'Emite periódicamente un anillo de energía expansivo alrededor del Agente que daña a todos los enemigos en el radio (+daño, +radio y -cooldown).',
        color: '#ff8800',
        level: 0,
        maxLevel: 5,
        isWeapon: true,
        apply: (_player, combat) => {
          combat.firewallPulseLevel += 1;
          combat.firewallPulseDamage += 14;
          combat.firewallPulseMaxRadius += 28;
          combat.firewallPulseCooldown = Math.max(1.4, combat.firewallPulseCooldown * 0.86);
        },
      },
      {
        id: 'sql_injection_beam',
        name: 'RAYO SQL INJECTION',
        category: 'ARMA // LÁSER PENETRANTE',
        description:
          'Dispara un haz láser grueso en línea recta que atraviesa a todos los enemigos en su trayectoria sin destruirse (+daño, +grosor y -cooldown).',
        color: '#d946ef',
        level: 0,
        maxLevel: 5,
        isWeapon: true,
        apply: (_player, combat) => {
          combat.sqlBeamLevel += 1;
          combat.sqlBeamDamage += 18;
          combat.sqlBeamThickness += 5;
          combat.sqlBeamCooldown = Math.max(1.0, combat.sqlBeamCooldown * 0.85);
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
        isBasicShotOnly: true,
        apply: (_player, combat) => {
          combat.fireCooldown = Math.max(0.1, combat.fireCooldown * 0.82);
          combat.projectileSpeed += 45;
        },
      },
      {
        id: 'multithreading',
        name: 'MULTITHREADING.dll',
        category: 'PASIVA // MULTIDISPARO BASE',
        description:
          'Añade +1 proyectil simultáneo a tu Ráfaga de Firewall inicial para cubrir múltiples ángulos.',
        color: '#c084fc',
        level: 0,
        maxLevel: 5,
        isBasicShotOnly: true,
        apply: (_player, combat) => {
          combat.multiShotCount += 1;
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
        isBasicShotOnly: true,
        apply: (_player, combat) => {
          combat.projectileDamage += 15;
          combat.attackRange += 60;
        },
      },
      {
        id: 'companion_overdrive',
        name: 'SINAPSIS DE MASCOTA',
        category: 'MASCOTA // +DAÑO COMPAÑERO',
        description:
          'Aumenta directamente el daño de tu Mascota Acompañante (+10 DMG de contacto/láser) en su rama evolutiva.',
        color: '#ec4899',
        level: 0,
        maxLevel: 8,
        isCompanionStatCard: true,
        apply: (player) => {
          if (player.companion) {
            player.companion.upgradeBonusDamage(10);
          }
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

    this.companionBranchCards = [
      {
        id: 'companion_branch_brute',
        name: 'FUERZA BRUTA',
        category: 'EVOLUCIÓN NV.2 // RAMA 1',
        description:
          'El cuadrado marrón crece un +50% y empuja a los enemigos. [Nv.5: Gigante + Temblor | Nv.10: Masa Crítica | Nv.20: Onda de Choque]',
        color: '#f97316',
        level: 0,
        maxLevel: 1,
        isCompanionBranchCard: true,
        apply: (player) => {
          if (player.companion) {
            player.companion.selectBranch('BRUTE', player, this.level);
          }
          for (const card of this.companionBranchCards) {
            card.isMaxed = true;
          }
        },
      },
      {
        id: 'companion_branch_botnet',
        name: 'LA BOTNET (ENJAMBRE)',
        category: 'EVOLUCIÓN NV.2 // RAMA 2',
        description:
          'El cuadrado se divide en 3 cuadrados rápidos con objetivos únicos. [Nv.5: Mente Colmena (5) | Nv.10: Propagación de Malware | Nv.20: Botnet Global (15)]',
        color: '#eab308',
        level: 0,
        maxLevel: 1,
        isCompanionBranchCard: true,
        apply: (player) => {
          if (player.companion) {
            player.companion.selectBranch('BOTNET', player, this.level);
          }
          for (const card of this.companionBranchCards) {
            card.isMaxed = true;
          }
        },
      },
      {
        id: 'companion_branch_pinball',
        name: 'PROTOCOLO PINBALL',
        category: 'EVOLUCIÓN NV.2 // RAMA 3',
        description:
          'La mascota se independiza y rebota a velocidad extrema atravesando enemigos. [Nv.5: +50% Vel + Estela Corrupta | Nv.10: Explosión Cinética | Nv.20: Multibola (3)]',
        color: '#ec4899',
        level: 0,
        maxLevel: 1,
        isCompanionBranchCard: true,
        apply: (player) => {
          if (player.companion) {
            player.companion.selectBranch('PINBALL', player, this.level);
          }
          for (const card of this.companionBranchCards) {
            card.isMaxed = true;
          }
        },
      },
    ];
  }

  public addXp(amount: number, player?: Player): boolean {
    this.currentXp += amount;

    while (this.currentXp >= this.xpToNextLevel) {
      this.currentXp -= this.xpToNextLevel;
      this.level++;
      this.xpToNextLevel = Math.round(this.xpToNextLevel * 1.15 + 12);
      this.pendingLevelUps++;
    }

    if (this.pendingLevelUps > 0 && this.currentChoices.length === 0) {
      this.rollChoices(player);
      return true;
    }

    return false;
  }

  /**
   * Genera 3 tarjetas de mejora.
   * Si se juega con el Agente Morcillita y aún no ha elegido rama en Nivel 2,
   * ofrece obligatoriamente las 3 cartas únicas de bifurcación evolutiva.
   */
  public rollChoices(player?: Player): UpgradeOption[] {
    if (
      player?.isSummoner &&
      player.companion &&
      player.companion.branch === 'NONE' &&
      this.level >= 2
    ) {
      this.currentChoices = [...this.companionBranchCards];
      return this.currentChoices;
    }

    const equippedWeaponsCount = this.getEquippedWeaponsCount();
    const weaponSlotsFull = equippedWeaponsCount >= MAX_WEAPON_SLOTS;

    const available = this.upgrades.filter((u) => {
      if (u.isMaxed || u.level >= u.maxLevel) return false;
      if (player?.isSummoner && u.isBasicShotOnly) return false;
      if (!player?.isSummoner && u.isCompanionStatCard) return false;
      // Si el jugador ya tiene 4 armas equipadas, bloquear la aparición de armas nuevas (level === 0)
      if (weaponSlotsFull && u.isWeapon && u.level === 0) return false;
      return true;
    });

    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);

    // En el primer Level Up (Nivel 2), asegurar que 'Overclock de Memoria' esté presente si aún es nivel 0
    const memOverclock = available.find((u) => u.isMemoryOverclock && u.level === 0);
    if (this.level === 2 && memOverclock && !selected.some((u) => u.id === memOverclock.id)) {
      selected[0] = memOverclock;
    }

    // Si aún quedan huecos de armas (< 4), facilitar que al menos una de las armas salga temprano
    if (!weaponSlotsFull) {
      const newWeapons = available.filter((u) => u.isWeapon && u.level === 0);
      if (
        newWeapons.length > 0 &&
        !selected.some((u) => u.isWeapon) &&
        selected.length > 1
      ) {
        selected[1] = newWeapons[Math.floor(Math.random() * newWeapons.length)];
      }
    }

    this.currentChoices = selected;
    return this.currentChoices;
  }

  public selectUpgrade(index: number, player: Player, combat: CombatSystem): boolean {
    const choice = this.currentChoices[index];
    if (!choice) return false;

    choice.level++;
    if (choice.level >= choice.maxLevel) {
      choice.isMaxed = true;
    }
    choice.apply(player, combat);
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    this.currentChoices = [];

    if (this.pendingLevelUps > 0) {
      this.rollChoices(player);
    }

    return true;
  }

  public isChoosingUpgrade(): boolean {
    return this.currentChoices.length > 0;
  }
}
