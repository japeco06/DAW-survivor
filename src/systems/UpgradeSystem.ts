import { Player } from '../entities/Player';
import { CombatSystem } from './CombatSystem';
import type { SerializedUpgradeCard } from '../network/MultiplayerTypes';

export interface UpgradeOption {
  id: string;
  name: string;
  nameEn?: string;
  category: string;
  categoryEn?: string;
  description: string;
  descriptionEn?: string;
  statBadge: string;
  statBadgeEn?: string;
  color: string;
  level: number;
  maxLevel: number;
  isMaxed?: boolean;
  isWeapon?: boolean;
  isEvolution?: boolean;
  isMemoryOverclock?: boolean;
  isCompanionBranchCard?: boolean;
  isBasicShotOnly?: boolean;
  isCompanionStatCard?: boolean;
  canUnlock?: (getLevel: (id: string) => number, player?: Player) => boolean;
  apply: (player: Player, combat: CombatSystem) => void;
}

/**
 * Sistema de Experiencia, Evoluciones de Arma, Rerolls y Tarjetas de Nivel.
 */
export const MAX_WEAPON_SLOTS = 5;

export class UpgradeSystem {
  public level: number = 1;
  public currentXp: number = 0;
  public xpToNextLevel: number = 150;
  public pendingLevelUps: number = 0;
  public rerollsRemaining: number = 3;

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
        nameEn: 'MEMORY OVERCLOCK',
        category: 'PASIVA // MULTIPLICADOR XP',
        categoryEn: 'PASSIVE // XP MULTIPLIER',
        description: 'Multiplica la XP de los orbes. Evoluciona: Rayo SQL Injection.',
        descriptionEn: 'Multiplies XP gathered from fragments. Evolves: SQL Injection Beam.',
        statBadge: '▲ +20% Multiplicador XP',
        statBadgeEn: '▲ +20% XP Multiplier',
        color: '#d946ef',
        level: 0,
        maxLevel: 5,
        isMemoryOverclock: true,
        apply: (player) => {
          player.xpMultiplier = Number((player.xpMultiplier + 0.2).toFixed(2));
        },
      },
      {
        id: 'electromagnet',
        name: 'ELECTROIMÁN',
        nameEn: 'ELECTROMAGNET',
        category: 'PASIVA // CAMPO MAGNÉTICO',
        categoryEn: 'PASSIVE // MAGNETIC FIELD',
        description: 'Amplía el radio magnético. Evoluciona: Ping Tracker y Bobina Tesla.',
        descriptionEn: 'Expands magnet pickup radius. Evolves: Ping Tracker & Tesla Coil.',
        statBadge: '▲ +90px Radio de Imán',
        statBadgeEn: '▲ +90px Magnet Radius',
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
        nameEn: 'BANDWIDTH LEECH',
        category: 'PASIVA // VAMPIRISMO',
        categoryEn: 'PASSIVE // VAMPIRISM',
        description: 'Probabilidad de drenar vida al impactar. Evoluciona: Drones Antivirus.',
        descriptionEn: 'Chance to siphon HP on hit. Evolves: Antivirus Drones.',
        statBadge: '▲ +2 HP Robo Vida (5% azar)',
        statBadgeEn: '▲ +2 HP Lifesteal (5% chance)',
        color: '#f43f5e',
        level: 0,
        maxLevel: 5,
        isMaxed: false,
        apply: function (player) {
          player.vampirismChance = 0.05;
          player.vampirismHealAmount = this.level * 2;
        },
      },
      {
        id: 'ping_tracker',
        name: 'PING_TRACKER.exe',
        nameEn: 'PING_TRACKER.exe',
        category: 'ARMA // HOMING',
        categoryEn: 'WEAPON // HOMING',
        description: 'Misiles teledirigidos. Evoluciona con: Electroimán.',
        descriptionEn: 'Smart homing missiles. Evolves with: Electromagnet.',
        statBadge: '▲ +8 Daño  |  ▼ -14% Cooldown',
        statBadgeEn: '▲ +8 Damage  |  ▼ -14% Cooldown',
        color: '#38bdf8',
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
        nameEn: 'QUARANTINE_ZONE.sys',
        category: 'ARMA // ÁREA DoT',
        categoryEn: 'WEAPON // DoT AREA',
        description: 'Perímetros de daño continuo. Evoluciona con: System Restore.',
        descriptionEn: 'Static DoT hazard zones. Evolves with: System Restore.',
        statBadge: '▲ +5 Daño/s  |  ▲ +14px Radio',
        statBadgeEn: '▲ +5 Dmg/s  |  ▲ +14px Radius',
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
        nameEn: 'ANTIVIRUS DRONES',
        category: 'ARMA // ESCUDO REACTIVO',
        categoryEn: 'WEAPON // REACTIVE SHIELD',
        description: 'Drones orbitales explosivos. Evoluciona con: Robo Ancho Banda.',
        descriptionEn: 'Explosive orbital drones. Evolves with: Bandwidth Leech.',
        statBadge: '▲ +1 Drone  |  ▲ +8 Daño  |  +16% Vel',
        statBadgeEn: '▲ +1 Drone  |  ▲ +8 Damage  |  +16% Spd',
        color: '#f43f5e',
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
        nameEn: 'FIREWALL PULSE',
        category: 'ARMA // ONDA EXPANSIVA',
        categoryEn: 'WEAPON // SHOCKWAVE',
        description: 'Pulsos radiales que repelen malware. Evoluciona con: Fiber Optic Bus.',
        descriptionEn: 'Repelling radial shockwaves. Evolves with: Fiber Optic Bus.',
        statBadge: '▲ +14 Daño  |  ▲ +28px Radio  |  ▼ -14% CD',
        statBadgeEn: '▲ +14 Damage  |  ▲ +28px Radius  |  ▼ -14% CD',
        color: '#fb923c',
        level: 0,
        maxLevel: 5,
        isWeapon: true,
        apply: (_player, combat) => {
          combat.firewallPulseLevel += 1;
          combat.firewallPulseDamage += 14;
          combat.firewallPulseMaxRadius += 28;
          combat.firewallPulseCooldown = Math.max(1.45, combat.firewallPulseCooldown * 0.86);
        },
      },
      {
        id: 'sql_injection_beam',
        name: 'RAYO SQL INJECTION',
        nameEn: 'SQL INJECTION BEAM',
        category: 'ARMA // LÁSER PENETRANTE',
        categoryEn: 'WEAPON // PIERCING LASER',
        description: 'Láser perforante en línea. Evoluciona con: Overclock de Memoria.',
        descriptionEn: 'Piercing line laser beam. Evolves with: Memory Overclock.',
        statBadge: '▲ +16 Daño  |  ▲ +5px Ancho  |  ▼ -15% CD',
        statBadgeEn: '▲ +16 Damage  |  ▲ +5px Width  |  ▼ -15% CD',
        color: '#d946ef',
        level: 0,
        maxLevel: 5,
        isWeapon: true,
        apply: (_player, combat) => {
          combat.sqlBeamLevel += 1;
          combat.sqlBeamDamage += 16;
          combat.sqlBeamThickness += 5;
          combat.sqlBeamCooldown = Math.max(0.9, combat.sqlBeamCooldown * 0.85);
        },
      },
      {
        id: 'overclocking',
        name: 'OVERCLOCKING.exe',
        nameEn: 'OVERCLOCKING.exe',
        category: 'PASIVA // CADENCIA',
        categoryEn: 'PASSIVE // FIRE RATE',
        description: 'Mejora tu Ráfaga Firewall. Evoluciona arma base a Hex-Core.',
        descriptionEn: 'Overclocks primary burst. Evolves basic shot into Hex-Core.',
        statBadge: '▼ -14% Cooldown  |  ▲ +45 Vel Balas',
        statBadgeEn: '▼ -14% Cooldown  |  ▲ +45 Bullet Speed',
        color: '#facc15',
        level: 0,
        maxLevel: 6,
        isBasicShotOnly: true,
        apply: (_player, combat) => {
          combat.fireCooldown = Math.max(0.18, combat.fireCooldown * 0.86);
          combat.projectileSpeed += 45;
        },
      },
      {
        id: 'multithreading',
        name: 'MULTITHREADING.dll',
        nameEn: 'MULTITHREADING.dll',
        category: 'PASIVA // MULTIDISPARO BASE',
        categoryEn: 'PASSIVE // MULTI-SHOT',
        description: 'Añade balas frontales y ayuda a evolucionar a Cañón Hex-Core.',
        descriptionEn: 'Adds front projectiles & helps evolve into Hex-Core Cannon.',
        statBadge: '▲ +1 Proyectil Frontal (Máx 4)',
        statBadgeEn: '▲ +1 Front Projectile (Max 4)',
        color: '#facc15',
        level: 0,
        maxLevel: 3,
        isBasicShotOnly: true,
        apply: (_player, combat) => {
          combat.multiShotCount += 1;
        },
      },
      {
        id: 'deepscan',
        name: 'HEURISTIC_SCAN.bat',
        nameEn: 'HEURISTIC_SCAN.bat',
        category: 'PASIVA // POTENCIA',
        categoryEn: 'PASSIVE // POWER & SCAN',
        description: 'Más daño/rango base y ayuda a evolucionar a Cañón Hex-Core.',
        descriptionEn: 'More primary damage/range & helps evolve into Hex-Core Cannon.',
        statBadge: '▲ +6 Daño  |  ▲ +60px Rango',
        statBadgeEn: '▲ +6 Damage  |  ▲ +60px Range',
        color: '#facc15',
        level: 0,
        maxLevel: 5,
        isBasicShotOnly: true,
        apply: (_player, combat) => {
          combat.projectileDamage += 6;
          combat.attackRange += 60;
        },
      },
      {
        id: 'companion_overdrive',
        name: 'SINAPSIS DE MASCOTA',
        nameEn: 'COMPANION SYNAPSE',
        category: 'MASCOTA // +DAÑO COMPAÑERO',
        categoryEn: 'PET // +COMPANION DAMAGE',
        description: 'Aumenta directamente el daño de tu Mascota Acompañante.',
        descriptionEn: 'Directly boosts the combat damage of your companion pet.',
        statBadge: '▲ +10 Daño Mascota',
        statBadgeEn: '▲ +10 Pet Damage',
        color: '#ec4899',
        level: 0,
        maxLevel: 5,
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
        nameEn: 'FIBER_OPTIC_BUS.drv',
        category: 'PASIVA // VELOCIDAD E IMÁN',
        categoryEn: 'PASSIVE // SPEED & MAGNET',
        description: 'Velocidad e imán. Evoluciona: Cortafuegos y Disco Kernel.',
        descriptionEn: 'Speed & magnet boost. Evolves: Firewall Pulse & Kernel Sawblade.',
        statBadge: '▲ +10% Velocidad  |  ▲ +45px Imán',
        statBadgeEn: '▲ +10% Speed  |  ▲ +45px Magnet',
        color: '#fb923c',
        level: 0,
        maxLevel: 5,
        apply: (player) => {
          player.speed = Math.round(player.speed * 1.1);
          player.pickupRadius += 45;
        },
      },
      {
        id: 'system_restore',
        name: 'SYSTEM_RESTORE.iso',
        nameEn: 'SYSTEM_RESTORE.iso',
        category: 'PASIVA // SALUD KERNEL',
        categoryEn: 'PASSIVE // KERNEL HEALTH',
        description: 'Vida máx. y cura. Evoluciona: Cuarentena y Crio-Shard.',
        descriptionEn: 'Max HP & heal. Evolves: Quarantine Zone & Cryo Shard.',
        statBadge: '▲ +25 HP Máx  |  ▲ +40 HP Curación',
        statBadgeEn: '▲ +25 Max HP  |  ▲ +40 HP Heal',
        color: '#10b981',
        level: 0,
        maxLevel: 6,
        apply: (player) => {
          player.maxHp += 25;
          player.heal(40);
        },
      },
      // --- 3 NUEVAS ARMAS ---
      {
        id: 'emp_tesla',
        name: 'BOBINA TESLA EMP',
        nameEn: 'TESLA EMP COIL',
        category: 'ARMA // RAYO EN CADENA',
        categoryEn: 'WEAPON // CHAIN LIGHTNING',
        description: 'Rayos en cadena. Evoluciona con: Electroimán.',
        descriptionEn: 'Chain lightning arcs. Evolves with: Electromagnet.',
        statBadge: '▲ +11 Daño  |  ▲ +Saltos  |  ▼ -14% CD',
        statBadgeEn: '▲ +11 Damage  |  ▲ +Chains  |  ▼ -14% CD',
        color: '#38bdf8',
        level: 0,
        maxLevel: 5,
        isWeapon: true,
        apply: (_player, combat) => {
          combat.teslaLevel += 1;
          combat.teslaDamage += 11;
          combat.teslaCooldown = Math.max(0.8, combat.teslaCooldown * 0.86);
        },
      },
      {
        id: 'cryo_shard',
        name: 'FRAGMENTO CRIOGÉNICO',
        nameEn: 'CRYO SHARD CANNON',
        category: 'ARMA // EXPLOSIÓN LENTA',
        categoryEn: 'WEAPON // CRYO BLAST',
        description: 'Explosión que ralentiza (-42%). Evoluciona con: System Restore.',
        descriptionEn: 'Slowing frost blasts (-42%). Evolves with: System Restore.',
        statBadge: '▲ +10 Daño  |  ▲ +10px Radio  |  Ralentiza',
        statBadgeEn: '▲ +10 Dmg  |  ▲ +10px AoE  |  Slows Foes',
        color: '#10b981',
        level: 0,
        maxLevel: 5,
        isWeapon: true,
        apply: (_player, combat) => {
          combat.cryoLevel += 1;
          combat.cryoDamage += 10;
          combat.cryoAoeRadius += 10;
          combat.cryoCooldown = Math.max(0.75, combat.cryoCooldown * 0.87);
        },
      },
      {
        id: 'orbital_saw',
        name: 'DISCO KERNEL ROTATIVO',
        nameEn: 'KERNEL SAWBLADE',
        category: 'ARMA // BOOMERANG',
        categoryEn: 'WEAPON // BOOMERANG',
        description: 'Sierras boomerang. Evoluciona con: Fiber Optic Bus.',
        descriptionEn: 'Boomerang sawblades. Evolves with: Fiber Optic Bus.',
        statBadge: '▲ +12 Daño  |  ▲ +Discos  |  ▼ -13% CD',
        statBadgeEn: '▲ +12 Dmg  |  ▲ +Discs  |  ▼ -13% CD',
        color: '#fb923c',
        level: 0,
        maxLevel: 5,
        isWeapon: true,
        apply: (_player, combat) => {
          combat.sawLevel += 1;
          combat.sawDamage += 12;
          combat.sawCooldown = Math.max(0.9, combat.sawCooldown * 0.87);
        },
      },
      // --- 9 EVOLUCIONES DE ARMAS ---
      {
        id: 'evo_hex_core',
        name: 'CAÑÓN QUÁNTICO HEX-CORE',
        nameEn: 'HEX-CORE QUANTUM CANNON',
        category: '★ EVOLUCIÓN // ARMA BASE',
        categoryEn: '★ EVOLUTION // PRIMARY',
        description: 'Ráfaga Firewall evoluciona: 4-5 disparos perforantes oro-cian de alta velocidad.',
        descriptionEn: 'Evolves Firewall Burst into 4-5 high-speed piercing golden-cyan bolts.',
        statBadge: '◆ +25% Daño  |  ▲ Perfora 2x  |  4-5 Balas',
        statBadgeEn: '◆ +25% Dmg  |  ▲ 2x Pierce  |  4-5 Bolts',
        color: '#facc15',
        level: 0,
        maxLevel: 1,
        isEvolution: true,
        canUnlock: (getLvl, p) =>
          !p?.isSummoner && getLvl('overclocking') >= 4 && (getLvl('multithreading') >= 1 || getLvl('deepscan') >= 1),
        apply: (_player, combat) => {
          combat.evolvedBasic = true;
        },
      },
      {
        id: 'evo_ddos_swarm',
        name: 'ENJAMBRE SATÉLITE DDoS',
        nameEn: 'DDoS SATELLITE SWARM',
        category: '★ EVOLUCIÓN // PING + IMÁN',
        categoryEn: '★ EVOLUTION // PING + MAGNET',
        description: 'Ping Tracker evoluciona en enjambres de 5 misiles rápidos con detonación en área.',
        descriptionEn: 'Evolves Ping Tracker into 5 rapid missiles with splash explosions.',
        statBadge: '◆ 5 Misiles  |  ▲ +35% Daño  |  Explosión AoE',
        statBadgeEn: '◆ 5 Missiles  |  ▲ +35% Dmg  |  Splash AoE',
        color: '#38bdf8',
        level: 0,
        maxLevel: 1,
        isEvolution: true,
        canUnlock: (getLvl) => getLvl('ping_tracker') >= 5 && getLvl('electromagnet') >= 1,
        apply: (_player, combat) => {
          combat.evolvedPing = true;
        },
      },
      {
        id: 'evo_purge_reactor',
        name: 'REACTOR PURGA NUCLEAR',
        nameEn: 'NUCLEAR PURGE REACTOR',
        category: '★ EVOLUCIÓN // CUARENTENA + RESTORE',
        categoryEn: '★ EVOLUTION // QUARANTINE + RESTORE',
        description: 'Cuarentena evoluciona en reactores gigantes (+45% radio) que queman y frenan -45%.',
        descriptionEn: 'Evolves Quarantine into huge reactors (+45% AoE) burning & slowing -45%.',
        statBadge: '◆ +80% Daño  |  ▲ +45% Radio  |  Frena -45%',
        statBadgeEn: '◆ +80% Dmg  |  ▲ +45% AoE  |  -45% Slow',
        color: '#10b981',
        level: 0,
        maxLevel: 1,
        isEvolution: true,
        canUnlock: (getLvl) => getLvl('quarantine_zone') >= 5 && getLvl('system_restore') >= 1,
        apply: (_player, combat) => {
          combat.evolvedQuarantine = true;
        },
      },
      {
        id: 'evo_omega_drones',
        name: 'CENTINELAS OMEGA',
        nameEn: 'OMEGA SENTINELS',
        category: '★ EVOLUCIÓN // DRONES + VAMPIRISMO',
        categoryEn: '★ EVOLUTION // DRONES + LEECH',
        description: '6 Centinelas indestructibles de alta rotación (nunca entran en cooldown).',
        descriptionEn: '6 indestructible orbiters with rapid spin (never go on cooldown).',
        statBadge: '◆ 6 Drones Inmortales  |  ▲ +65% Daño',
        statBadgeEn: '◆ 6 Immortal Drones  |  ▲ +65% Damage',
        color: '#f43f5e',
        level: 0,
        maxLevel: 1,
        isEvolution: true,
        canUnlock: (getLvl) => getLvl('antivirus_drones') >= 5 && getLvl('bandwidth_leech') >= 1,
        apply: (_player, combat) => {
          combat.evolvedDrones = true;
        },
      },
      {
        id: 'evo_solar_firewall',
        name: 'TORMENTA SOLAR FIREWALL',
        nameEn: 'SOLAR FIREWALL STORM',
        category: '★ EVOLUCIÓN // CORTAFUEGOS + FIBRA',
        categoryEn: '★ EVOLUTION // PULSE + FIBER',
        description: 'Emite enormes tormentas solares rápidas de gran alcance (+95px) y +75% daño.',
        descriptionEn: 'Unleashes rapid massive solar waves (+95px radius) & +75% damage.',
        statBadge: '◆ +75% Daño  |  ▲ +95px Radio  |  ▼ -35% CD',
        statBadgeEn: '◆ +75% Dmg  |  ▲ +95px AoE  |  ▼ -35% CD',
        color: '#fb923c',
        level: 0,
        maxLevel: 1,
        isEvolution: true,
        canUnlock: (getLvl) => getLvl('firewall_pulse') >= 5 && getLvl('fiber_bus') >= 1,
        apply: (_player, combat) => {
          combat.evolvedFirewallPulse = true;
        },
      },
      {
        id: 'evo_zero_day',
        name: 'LÁSER ZERO-DAY',
        nameEn: 'ZERO-DAY ANNIHILATOR',
        category: '★ EVOLUCIÓN // SQL + OVERCLOCK MEM',
        categoryEn: '★ EVOLUTION // SQL + MEMORY OC',
        description: 'Dispara 3 haces láser masivos en abanico concentrado que desintegran oleadas.',
        descriptionEn: 'Fires 3 massive focused fan beams obliterating entire enemy lines.',
        statBadge: '◆ 3 Haces Anchos  |  ▲ +55% Daño  |  ▼ -28% CD',
        statBadgeEn: '◆ 3 Wide Beams  |  ▲ +55% Dmg  |  ▼ -28% CD',
        color: '#d946ef',
        level: 0,
        maxLevel: 1,
        isEvolution: true,
        canUnlock: (getLvl) => getLvl('sql_injection_beam') >= 5 && getLvl('memory_overclock') >= 1,
        apply: (_player, combat) => {
          combat.evolvedSqlBeam = true;
        },
      },
      {
        id: 'evo_arc_storm',
        name: 'TORMENTA ARCO VOLTAICO',
        nameEn: 'VOLTAIC ARC STORM',
        category: '★ EVOLUCIÓN // TESLA + ELECTROIMÁN',
        categoryEn: '★ EVOLUTION // TESLA + MAGNET',
        description: 'Rayos que saltan hasta 9 enemigos a la vez y los aturden con EMP.',
        descriptionEn: 'Arcs jumping up to 9 targets simultaneously with EMP stun.',
        statBadge: '◆ 9 Saltos  |  ▲ +65% Daño  |  Aturde EMP',
        statBadgeEn: '◆ 9 Chains  |  ▲ +65% Dmg  |  EMP Stun',
        color: '#38bdf8',
        level: 0,
        maxLevel: 1,
        isEvolution: true,
        canUnlock: (getLvl) => getLvl('emp_tesla') >= 5 && getLvl('electromagnet') >= 1,
        apply: (_player, combat) => {
          combat.evolvedTesla = true;
        },
      },
      {
        id: 'evo_absolute_zero',
        name: 'CERO ABSOLUTO CRIO-BOMBA',
        nameEn: 'ABSOLUTE ZERO CRYO-BOMB',
        category: '★ EVOLUCIÓN // CRIO + SYSTEM RESTORE',
        categoryEn: '★ EVOLUTION // CRYO + RESTORE',
        description: 'Lanza abanico de 4 cristales con enorme explosión helada que congela al -65%.',
        descriptionEn: 'Fires a 4-crystal fan with huge frost blasts slowing foes by 65%.',
        statBadge: '◆ 4 Cristales  |  ▲ +75% Daño  |  Congela -65%',
        statBadgeEn: '◆ 4 Shards  |  ▲ +75% Dmg  |  -65% Freeze',
        color: '#10b981',
        level: 0,
        maxLevel: 1,
        isEvolution: true,
        canUnlock: (getLvl) => getLvl('cryo_shard') >= 5 && getLvl('system_restore') >= 1,
        apply: (_player, combat) => {
          combat.evolvedCryo = true;
        },
      },
      {
        id: 'evo_phantom_saws',
        name: 'SIERRAS PHANTOM',
        nameEn: 'PHANTOM SAWBLADES',
        category: '★ EVOLUCIÓN // DISCO + FIBRA ÓPTICA',
        categoryEn: '★ EVOLUTION // SAW + FIBER BUS',
        description: 'Lanza 5 discos gigantes ultrarrápidos que trituran toda la pantalla.',
        descriptionEn: 'Launches 5 giant ultra-fast blades shredding across screen.',
        statBadge: '◆ 5 Discos Gigantes  |  ▲ +65% Daño  |  ▼ -30% CD',
        statBadgeEn: '◆ 5 Giant Blades  |  ▲ +65% Dmg  |  ▼ -30% CD',
        color: '#fb923c',
        level: 0,
        maxLevel: 1,
        isEvolution: true,
        canUnlock: (getLvl) => getLvl('orbital_saw') >= 5 && getLvl('fiber_bus') >= 1,
        apply: (_player, combat) => {
          combat.evolvedSaw = true;
        },
      },
    ];

    this.companionBranchCards = [
      {
        id: 'companion_branch_brute',
        name: 'FUERZA BRUTA',
        nameEn: 'BRUTE FORCE',
        category: 'EVOLUCIÓN NV.2 // RAMA 1',
        categoryEn: 'EVOLUTION LV.2 // BRANCH 1',
        description: 'Mascota gigante de choque pesado que empuja y aplasta malware.',
        descriptionEn: 'Giant heavy-impact pet knocking back and crushing malware.',
        statBadge: '▲ +50% Tamaño  |  Efecto Empuje',
        statBadgeEn: '▲ +50% Size  |  Knockback Effect',
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
        nameEn: 'THE BOTNET (SWARM)',
        category: 'EVOLUCIÓN NV.2 // RAMA 2',
        categoryEn: 'EVOLUTION LV.2 // BRANCH 2',
        description: 'Divide la mascota en un enjambre de 3 acompañantes autónomos.',
        descriptionEn: 'Splits companion into a swarm of 3 autonomous pets.',
        statBadge: '▲ 3 Mascotas  |  Objetivos Múltiples',
        statBadgeEn: '▲ 3 Pets  |  Multi-Target Attack',
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
        nameEn: 'PINBALL PROTOCOL',
        category: 'EVOLUCIÓN NV.2 // RAMA 3',
        categoryEn: 'EVOLUTION LV.2 // BRANCH 3',
        description: 'Mascota perforante veloz con rebote predictivo anticipando enemigos en movimiento.',
        descriptionEn: 'High-speed piercing companion with predictive trajectory-leading bounces.',
        statBadge: '▲ Rebote Predictivo  |  Perforación Enemiga',
        statBadgeEn: '▲ Predictive Bounce  |  Enemy Piercing',
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
  public rollChoices(player?: Player, excludedIds?: Set<string>): UpgradeOption[] {
    if (
      player?.isSummoner &&
      player.companion &&
      player.companion.branch === 'NONE' &&
      this.level >= 2
    ) {
      this.currentChoices = [...this.companionBranchCards];
      return this.currentChoices;
    }

    const levelById = new Map<string, number>();
    for (const u of this.upgrades) {
      levelById.set(u.id, u.level);
    }
    const getLevel = (id: string) => levelById.get(id) ?? 0;

    const equippedWeaponsCount = this.getEquippedWeaponsCount();
    const weaponSlotsFull = equippedWeaponsCount >= MAX_WEAPON_SLOTS;

    let available = this.upgrades.filter((u) => {
      if (u.isMaxed || u.level >= u.maxLevel) return false;
      if (player?.isSummoner && u.isBasicShotOnly) return false;
      if (!player?.isSummoner && u.isCompanionStatCard) return false;
      if (u.isEvolution) {
        return Boolean(u.canUnlock && u.canUnlock(getLevel, player));
      }
      // Si el jugador ya alcanzó el máximo de slots de armas, bloquear armas nuevas (level === 0)
      if (weaponSlotsFull && u.isWeapon && u.level === 0) return false;
      return true;
    });

    if (available.length === 0) {
      this.currentChoices = [
        {
          id: 'limit_break_damage',
          name: 'KERNEL LIMIT BREAK',
          nameEn: 'KERNEL LIMIT BREAK',
          category: '∞ OVERCLOCK INFINITO // DAÑO',
          categoryEn: '∞ ENDLESS OVERCLOCK // DAMAGE',
          description: 'Sobrepasa el límite de potencia del núcleo una vez maxeado tu arsenal.',
          descriptionEn: 'Pushes core firepower beyond max hardware limits.',
          statBadge: '▲ +10% Daño Global  |  ▲ +2% Crítico',
          statBadgeEn: '▲ +10% Global Dmg  |  ▲ +2% Crit',
          color: '#fbbf24',
          level: 0,
          maxLevel: 999,
          apply: (p) => {
            p.damageMultiplier = Number((p.damageMultiplier + 0.1).toFixed(2));
            p.critChance = Number((p.critChance + 0.02).toFixed(3));
          },
        },
        {
          id: 'limit_break_rof',
          name: 'TURBO HILO INFINITO',
          nameEn: 'ENDLESS THREAD TURBO',
          category: '∞ OVERCLOCK INFINITO // CADENCIA',
          categoryEn: '∞ ENDLESS OVERCLOCK // FIRE RATE',
          description: 'Acelera de forma ilimitada la frecuencia de reloj de todas tus armas.',
          descriptionEn: 'Continuously accelerates weapon clock cycles and movement.',
          statBadge: '▲ +6% Cadencia  |  ▲ +3% Velocidad',
          statBadgeEn: '▲ +6% Fire Rate  |  ▲ +3% Move Speed',
          color: '#38bdf8',
          level: 0,
          maxLevel: 999,
          apply: (p) => {
            p.fireRateMultiplier = Number((p.fireRateMultiplier + 0.06).toFixed(2));
            p.speed = Math.round(p.speed * 1.03);
          },
        },
        {
          id: 'limit_break_vital',
          name: 'RESERVA CRÍTICA DE KERNEL',
          nameEn: 'KERNEL VITAL RESERVE',
          category: '∞ OVERCLOCK INFINITO // INTEGRIDAD',
          categoryEn: '∞ ENDLESS OVERCLOCK // INTEGRITY',
          description: 'Refuerza el blindaje máximo y repara la integridad ante oleadas extremas.',
          descriptionEn: 'Reinforces max integrity and restores health during extreme waves.',
          statBadge: '▲ +20 HP Máx  |  ▲ +35 HP Curación',
          statBadgeEn: '▲ +20 Max HP  |  ▲ +35 HP Heal',
          color: '#10b981',
          level: 0,
          maxLevel: 999,
          apply: (p) => {
            p.maxHp += 20;
            p.heal(35);
          },
        },
      ];
      return this.currentChoices;
    }

    if (excludedIds && excludedIds.size > 0) {
      const freshPool = available.filter((u) => !excludedIds.has(u.id));
      if (freshPool.length >= 3 || freshPool.length === available.length) {
        available = freshPool;
      } else if (freshPool.length > 0) {
        const remainder = available.filter((u) => excludedIds.has(u.id));
        available = [...freshPool, ...remainder.slice(0, 3 - freshPool.length)];
      }
    }

    // Priorizar evoluciones listas para aparecer junto a mejoras aleatorias
    const readyEvos = available.filter((u) => u.isEvolution).sort(() => Math.random() - 0.5);
    const nonEvos = available.filter((u) => !u.isEvolution).sort(() => Math.random() - 0.5);
    const selected = [...readyEvos, ...nonEvos].slice(0, 3);

    // En el primer Level Up (Nivel 2), asegurar 'Overclock de Memoria' si sigue en nivel 0
    const memOverclock = available.find((u) => u.isMemoryOverclock && u.level === 0);
    if (this.level === 2 && memOverclock && !selected.some((u) => u.id === memOverclock.id)) {
      selected[0] = memOverclock;
    }

    // Facilitar aparición temprana de armas si aún quedan huecos
    if (!weaponSlotsFull && readyEvos.length === 0) {
      const newWeapons = nonEvos.filter((u) => u.isWeapon && u.level === 0);
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

  public rerollChoices(player?: Player): boolean {
    if (this.rerollsRemaining <= 0 || this.currentChoices.length === 0) return false;
    if (this.currentChoices[0]?.isCompanionBranchCard) return false;

    this.rerollsRemaining -= 1;
    const prevIds = new Set(this.currentChoices.map((c) => c.id));
    this.rollChoices(player, prevIds);
    return true;
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

  public serializeCurrentChoices(): SerializedUpgradeCard[] {
    return this.currentChoices.map((u) => ({
      id: u.id,
      name: u.name,
      nameEn: u.nameEn || u.name,
      category: u.category,
      categoryEn: u.categoryEn || u.category,
      description: u.description,
      descriptionEn: u.descriptionEn || u.description,
      statBadge: u.statBadge,
      statBadgeEn: u.statBadgeEn || u.statBadge,
      color: u.color,
      level: u.level,
      maxLevel: u.maxLevel,
      isWeapon: u.isWeapon,
      isEvolution: u.isEvolution,
      isCompanionBranchCard: u.isCompanionBranchCard,
    }));
  }

  public setExternalChoices(cards: SerializedUpgradeCard[], rerollsLeft: number): void {
    this.rerollsRemaining = rerollsLeft;
    this.currentChoices = cards.map((c) => ({
      ...c,
      apply: () => {},
    }));
  }

  public clearExternalChoices(): void {
    this.currentChoices = [];
    this.pendingLevelUps = 0;
  }
}
