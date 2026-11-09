import { Spawner } from '../src/systems/Spawner.ts';
import { CombatSystem } from '../src/systems/CombatSystem.ts';
import { UpgradeSystem } from '../src/systems/UpgradeSystem.ts';
import { Player } from '../src/entities/Player.ts';
import { CodeFragment } from '../src/entities/CodeFragment.ts';
import { CryptoCoin } from '../src/entities/CryptoCoin.ts';
import { ElToroBoss } from '../src/entities/ElToroBoss.ts';
import { WaveBoss } from '../src/entities/WaveBoss.ts';
import { Adware } from '../src/entities/Adware.ts';
import { Projectile } from '../src/entities/Projectile.ts';
import { PingProjectile } from '../src/entities/PingProjectile.ts';
import { QuarantineZone } from '../src/entities/QuarantineZone.ts';
import { PowerUpItem } from '../src/entities/PowerUpItem.ts';
import { CharacterProfile } from '../src/systems/MetaSystem.ts';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const FINAL_BOSS_TIME = 700; // 11 min 40 sec

interface SimResult {
  buildName: string;
  characterId: string;
  survivedToToro: boolean;
  timeSurvived: number;
  finalLevel: number;
  totalKills: number;
  waveBossesKilled: number;
  damageToToro: number;
  secondsSurvivedVsToro: number;
  minHpPercent: number;
}

const PROFILES: Record<string, CharacterProfile> = {
  STANDARD: {
    id: 'STANDARD',
    name: 'AGENTE ESTÁNDAR',
    subtitle: '',
    description: '',
    color: '#00ff66',
    borderColor: '#ffffff',
    hpMultiplier: 1.0,
    speedMultiplier: 1.0,
    pickupRadiusMultiplier: 1.0,
  },
  ROOT: {
    id: 'ROOT',
    name: 'AGENTE ROOT',
    subtitle: '',
    description: '',
    color: '#1e40af',
    borderColor: '#60a5fa',
    hpMultiplier: 1.0,
    speedMultiplier: 1.2,
    pickupRadiusMultiplier: 1.0,
  },
  PROXY: {
    id: 'PROXY',
    name: 'AGENTE PROXY',
    subtitle: '',
    description: '',
    color: '#9333ea',
    borderColor: '#f3e8ff',
    hpMultiplier: 2.0,
    speedMultiplier: 0.85,
    pickupRadiusMultiplier: 1.0,
  },
  MORCILLITA: {
    id: 'MORCILLITA',
    name: 'AGENTE MORCILLITA',
    subtitle: '',
    description: '',
    color: '#ec4899',
    borderColor: '#fbcfe8',
    hpMultiplier: 1.0,
    speedMultiplier: 1.0,
    pickupRadiusMultiplier: 1.0,
  },
};

function resolveEnemyCrowd(enemies: Adware[]): void {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (!a.active) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (!b.active) continue;
      const minDistance = (a.size + b.size) * 0.46;
      const dx = b.x - a.x;
      if (Math.abs(dx) >= minDistance) continue;
      const dy = b.y - a.y;
      if (Math.abs(dy) >= minDistance) continue;

      const distSq = dx * dx + dy * dy;
      const minDistanceSq = minDistance * minDistance;

      if (distSq > 0 && distSq < minDistanceSq) {
        const dist = Math.sqrt(distSq);
        const overlap = (minDistance - dist) * 0.5;
        const nx = dx / dist;
        const ny = dy / dist;
        if (a instanceof ElToroBoss) {
          b.x += nx * overlap * 2;
          b.y += ny * overlap * 2;
        } else if (b instanceof ElToroBoss) {
          a.x -= nx * overlap * 2;
          a.y -= ny * overlap * 2;
        } else {
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }
  }
}

function getSmartKitingDirection(player: Player, enemies: Adware[]): { x: number; y: number } {
  let repX = 0;
  let repY = 0;

  for (const e of enemies) {
    if (!e.active) continue;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    // Extra caution against El Toro
    const threshold = e instanceof ElToroBoss ? 450 : 310;
    if (dist < threshold && dist > 0) {
      const weight = Math.pow((threshold - dist) / threshold, 2);
      const mult = e instanceof ElToroBoss ? 4.5 : 2.5;
      repX += (dx / dist) * weight * mult;
      repY += (dy / dist) * weight * mult;
    }
  }

  const toCenterX = CANVAS_WIDTH / 2 - player.x;
  const toCenterY = CANVAS_HEIGHT / 2 - player.y;
  const distCenter = Math.hypot(toCenterX, toCenterY);
  if (distCenter > 220) {
    repX += (toCenterX / distCenter) * 0.45;
    repY += (toCenterY / distCenter) * 0.45;
  }

  repX += (-toCenterY / (distCenter || 1)) * 0.65;
  repY += (toCenterX / (distCenter || 1)) * 0.65;

  const margin = 140;
  if (player.x < margin) repX += Math.pow((margin - player.x) / margin, 2) * 3.0;
  if (player.x > CANVAS_WIDTH - margin) repX -= Math.pow((player.x - (CANVAS_WIDTH - margin)) / margin, 2) * 3.0;
  if (player.y < margin) repY += Math.pow((margin - player.y) / margin, 2) * 3.0;
  if (player.y > CANVAS_HEIGHT - margin) repY -= Math.pow((player.y - (CANVAS_HEIGHT - margin)) / margin, 2) * 3.0;

  const len = Math.hypot(repX, repY);
  return len > 0 ? { x: repX / len, y: repY / len } : { x: 0, y: 0 };
}

function runSingleSimulation(
  buildName: string,
  charId: string,
  preferredBranch?: 'BRUTE' | 'BOTNET' | 'PINBALL',
  preferredCards: string[] = []
): SimResult {
  const profile = PROFILES[charId] || PROFILES.STANDARD;
  const player = new Player(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, profile, null);
  const spawner = new Spawner();
  const combatSystem = new CombatSystem();
  const upgradeSystem = new UpgradeSystem();

  let enemies: Adware[] = [];
  let projectiles: Projectile[] = [];
  let pingProjectiles: PingProjectile[] = [];
  let quarantineZones: QuarantineZone[] = [];
  let codeFragments: CodeFragment[] = [];
  let powerUps: PowerUpItem[] = [];

  let elapsedTime = 0;
  let killCount = 0;
  let waveBossesKilled = 0;
  let toroSpawned = false;
  let elToro: ElToroBoss | null = null;
  let toroSpawnTime = 0;
  let minHpRatio = 1.0;

  const dt = 0.04;
  const maxSimTime = 850; // up to 14m 10s

  while (elapsedTime < maxSimTime && player.active) {
    elapsedTime += dt;

    minHpRatio = Math.min(minHpRatio, player.hp / player.maxHp);

    spawner.update(
      dt,
      elapsedTime,
      upgradeSystem.level,
      enemies,
      CANVAS_WIDTH,
      CANVAS_HEIGHT
    );

    if (!toroSpawned && elapsedTime >= FINAL_BOSS_TIME) {
      toroSpawned = true;
      toroSpawnTime = elapsedTime;
      spawner.enableFinalBossMode();
      enemies = enemies.filter((e) => e.malwareType === 'RANSOMWARE');
      elToro = new ElToroBoss(CANVAS_WIDTH / 2, -80);
      enemies.push(elToro);
    }

    const dir = getSmartKitingDirection(player, enemies);
    player.update(
      dt,
      { getDirection: () => dir } as any,
      CANVAS_WIDTH,
      CANVAS_HEIGHT
    );

    // Morcillita Companion update
    if (player.companion) {
      const compResult = player.companion.update(
        dt,
        player,
        upgradeSystem.level,
        enemies,
        CANVAS_WIDTH,
        CANVAS_HEIGHT
      );
      if (compResult.killedEnemies.length > 0) {
        for (const ke of compResult.killedEnemies) {
          killCount++;
          if (codeFragments.length >= 160) {
            const oldest = codeFragments[0];
            if (oldest) oldest.xpValue += ke.xpValue;
          } else {
            codeFragments.push(new CodeFragment(ke.x, ke.y, ke.xpValue));
          }
          if (ke.malwareType === 'RANSOMWARE') {
            waveBossesKilled++;
          }
        }
      }
    }

    for (const p of projectiles) p.update(dt, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (const ping of pingProjectiles) ping.update(dt, enemies, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (const e of enemies) {
      e.update(dt, player);
      if (e instanceof WaveBoss && e.pendingMinions.length > 0) {
        enemies.push(...e.pendingMinions);
        e.pendingMinions = [];
      }
    }

    resolveEnemyCrowd(enemies);

    const combatEvents = combatSystem.update(
      dt,
      player,
      enemies,
      projectiles,
      pingProjectiles,
      quarantineZones,
      CANVAS_WIDTH,
      CANVAS_HEIGHT
    );

    for (const drop of combatEvents.destroyedEnemies) {
      killCount++;
      const isBoss = drop.malwareType === 'RANSOMWARE';
      if (isBoss) {
        waveBossesKilled++;
        powerUps.push(new PowerUpItem(drop.x, drop.y, 'FRENZY'));
      }
      if (codeFragments.length >= 160) {
        const oldest = codeFragments[0];
        if (oldest) oldest.xpValue += drop.xpValue;
      } else {
        codeFragments.push(new CodeFragment(drop.x, drop.y, drop.xpValue));
      }
    }

    for (const frag of codeFragments) {
      frag.update(dt, player);
      let collected = Math.hypot(frag.x - player.x, frag.y - player.y) < player.size + 15;
      if (!collected && player.companion) {
        for (const unit of player.companion.getUnits()) {
          if (Math.hypot(unit.x - frag.x, unit.y - frag.y) <= unit.size + 16) {
            collected = true;
            break;
          }
        }
      }
      if (collected) {
        frag.active = false;
        const leveledUp = upgradeSystem.addXp(frag.xpValue, player);
        if (leveledUp) {
          while (upgradeSystem.pendingLevelUps > 0) {
            const choices = upgradeSystem.rollChoices(player);
            if (!choices || choices.length === 0) {
              upgradeSystem.pendingLevelUps = 0;
              break;
            }

            if (player.isSummoner && player.companion && player.companion.branch === 'NONE' && upgradeSystem.level >= 2) {
              const targetBranchId =
                preferredBranch === 'BOTNET'
                  ? 'companion_branch_botnet'
                  : preferredBranch === 'PINBALL'
                  ? 'companion_branch_pinball'
                  : 'companion_branch_brute';
              const branchIndex = choices.findIndex((c) => c.id === targetBranchId);
              upgradeSystem.selectUpgrade(
                branchIndex >= 0 ? branchIndex : 0,
                player,
                combatSystem
              );
              continue;
            }

            let chosenIndex = -1;
            for (const prefId of preferredCards) {
              const idx = choices.findIndex((c) => c.id === prefId);
              if (idx !== -1) {
                chosenIndex = idx;
                break;
              }
            }
            if (chosenIndex === -1) chosenIndex = 0;
            upgradeSystem.selectUpgrade(chosenIndex, player, combatSystem);
          }
        }
      }
    }

    for (const pup of powerUps) {
      if (pup.active && Math.hypot(pup.x - player.x, pup.y - player.y) < player.size + 15) {
        pup.active = false;
        player.heal(25);
      }
    }

    projectiles = projectiles.filter((p) => p.active);
    pingProjectiles = pingProjectiles.filter((p) => p.active);
    quarantineZones = quarantineZones.filter((z) => z.active);
    enemies = enemies.filter((e) => e.active);
    codeFragments = codeFragments.filter((f) => f.active);
    powerUps = powerUps.filter((p) => p.active);
  }

  const reachedToro = toroSpawned;
  const toroDmg = elToro ? elToro.totalDamageTaken : 0;
  const timeVsToro = toroSpawned ? Math.max(0, elapsedTime - toroSpawnTime) : 0;

  return {
    buildName,
    characterId: charId,
    survivedToToro: reachedToro,
    timeSurvived: Math.round(elapsedTime),
    finalLevel: upgradeSystem.level,
    totalKills: killCount,
    waveBossesKilled,
    damageToToro: Math.round(toroDmg),
    secondsSurvivedVsToro: Math.round(timeVsToro),
    minHpPercent: Math.round(minHpRatio * 100),
  };
}

// ============================================================================
// SUITE DE SIMULACIÓN Y BALANCEO MULTI-PERSONAJE
// ============================================================================
console.log('================================================================');
console.log('⚔️  TEST DE EQUILIBRIO Y ACCESIBILIDAD A EL TORO (v1.1.13)');
console.log('================================================================\n');

const BUILDS_TO_TEST = [
  {
    name: '1. Agente Estándar: Ráfaga Crítica (Firewall + Multi + Overclock)',
    char: 'STANDARD',
    branch: undefined,
    cards: ['multithreading', 'overclocking', 'deepscan', 'system_restore', 'bandwidth_leech', 'antivirus_drones'],
  },
  {
    name: '2. Agente Estándar: Artillería & Láser (Ping Tracker + Rayo SQL)',
    char: 'STANDARD',
    branch: undefined,
    cards: ['ping_tracker', 'sql_injection_beam', 'antivirus_drones', 'firewall_pulse', 'system_restore'],
  },
  {
    name: '3. Agente Proxy: Supertanque Blindado (200 HP, Drones + Cuarentena + Pulso)',
    char: 'PROXY',
    branch: undefined,
    cards: ['antivirus_drones', 'quarantine_zone', 'firewall_pulse', 'system_restore', 'bandwidth_leech'],
  },
  {
    name: '4. Agente Root: Velocista y Ráfaga (+20% Vel, SQL + Ping + Fibra)',
    char: 'ROOT',
    branch: undefined,
    cards: ['fiber_bus', 'sql_injection_beam', 'ping_tracker', 'overclocking', 'system_restore'],
  },
  {
    name: '5. Agente Morcillita: Fuerza Bruta (Mascota Gigante de Choque)',
    char: 'MORCILLITA',
    branch: 'BRUTE' as const,
    cards: ['companion_overdrive', 'antivirus_drones', 'firewall_pulse', 'system_restore', 'quarantine_zone'],
  },
  {
    name: '6. Agente Morcillita: La Botnet (Enjambre 3 Mascotas Autónomas)',
    char: 'MORCILLITA',
    branch: 'BOTNET' as const,
    cards: ['companion_overdrive', 'ping_tracker', 'sql_injection_beam', 'system_restore', 'antivirus_drones'],
  },
  {
    name: '7. Agente Morcillita: Protocolo Pinball (Mascota Rebotadora Perforante)',
    char: 'MORCILLITA',
    branch: 'PINBALL' as const,
    cards: ['companion_overdrive', 'fiber_bus', 'antivirus_drones', 'quarantine_zone', 'system_restore'],
  },
];

const RUNS_PER_BUILD = 5;
const allResults: SimResult[] = [];

for (const b of BUILDS_TO_TEST) {
  process.stdout.write(`Evaluando: [${b.name}] (5 partidas)... `);
  const buildRuns: SimResult[] = [];
  for (let i = 0; i < RUNS_PER_BUILD; i++) {
    const res = runSingleSimulation(b.name, b.char, b.branch, b.cards);
    buildRuns.push(res);
    allResults.push(res);
  }

  const reachedCount = buildRuns.filter((r) => r.survivedToToro).length;
  const avgTime = Math.round(buildRuns.reduce((acc, r) => acc + r.timeSurvived, 0) / RUNS_PER_BUILD);
  const avgLvl = Math.round(buildRuns.reduce((acc, r) => acc + r.finalLevel, 0) / RUNS_PER_BUILD);
  const avgKills = Math.round(buildRuns.reduce((acc, r) => acc + r.totalKills, 0) / RUNS_PER_BUILD);
  const avgWaveBosses = (buildRuns.reduce((acc, r) => acc + r.waveBossesKilled, 0) / RUNS_PER_BUILD).toFixed(1);
  const avgToroDmg = Math.round(buildRuns.reduce((acc, r) => acc + r.damageToToro, 0) / RUNS_PER_BUILD);
  const avgToroSecs = Math.round(buildRuns.reduce((acc, r) => acc + r.secondsSurvivedVsToro, 0) / RUNS_PER_BUILD);
  const minHp = Math.min(...buildRuns.map((r) => r.minHpPercent));

  console.log('✓');
  console.log(`  • Tasa de llegada a El Toro: ${reachedCount}/${RUNS_PER_BUILD} (${(reachedCount / RUNS_PER_BUILD) * 100}%)`);
  console.log(`  • Tiempo medio: ${Math.floor(avgTime / 60)}m ${avgTime % 60}s | Nivel medio: Nv.${avgLvl} | Bajas: ${avgKills}`);
  console.log(`  • Jefes de Oleada eliminados: ${avgWaveBosses} de 9 posibles`);
  console.log(`  • Daño promedio a El Toro: ${avgToroDmg.toLocaleString()} HP`);
  console.log(`  • Supervivencia contra El Toro: ${avgToroSecs}s | Vida mínima registrada durante la partida: ${minHp}%\n`);
}

console.log('================================================================');
console.log('📊 CONCLUSIÓN GENERAL DEL TEST');
console.log('================================================================');
const totalRuns = allResults.length;
const totalReached = allResults.filter((r) => r.survivedToToro).length;
const successfulRuns = allResults.filter((r) => r.survivedToToro);
const avgGlobalDmg = Math.round(
  successfulRuns.reduce((acc, r) => acc + r.damageToToro, 0) / (successfulRuns.length || 1)
);
const avgGlobalSecs = Math.round(
  successfulRuns.reduce((acc, r) => acc + r.secondsSurvivedVsToro, 0) / (successfulRuns.length || 1)
);

console.log(`Total de simulaciones: ${totalRuns}`);
console.log(`Tasa global de llegada a El Toro (11m 40s): ${totalReached}/${totalRuns} (${((totalReached / totalRuns) * 100).toFixed(1)}%)`);
console.log(`Daño medio global infligido a El Toro: ${avgGlobalDmg.toLocaleString()} HP`);
console.log(`Tiempo medio de combate contra El Toro: ${avgGlobalSecs} segundos`);
