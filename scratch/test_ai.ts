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
const FINAL_BOSS_TIME = 700;

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

// Vector field kiting AI
function getSmartKitingDirection(player: Player, enemies: Adware[]): { x: number; y: number } {
  let repX = 0;
  let repY = 0;

  // 1. Repulsion from enemies
  for (const e of enemies) {
    if (!e.active) continue;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 320 && dist > 0) {
      const weight = Math.pow((320 - dist) / 320, 2);
      repX += (dx / dist) * weight * 2.5;
      repY += (dy / dist) * weight * 2.5;
    }
  }

  // 2. Soft pull towards open space / center
  const toCenterX = CANVAS_WIDTH / 2 - player.x;
  const toCenterY = CANVAS_HEIGHT / 2 - player.y;
  const distCenter = Math.hypot(toCenterX, toCenterY);
  if (distCenter > 250) {
    repX += (toCenterX / distCenter) * 0.45;
    repY += (toCenterY / distCenter) * 0.45;
  }

  // 3. Tangential orbit (circling kite)
  repX += (-toCenterY / (distCenter || 1)) * 0.65;
  repY += (toCenterX / (distCenter || 1)) * 0.65;

  // 4. Hard repulsion from arena walls
  const margin = 140;
  if (player.x < margin) repX += Math.pow((margin - player.x) / margin, 2) * 3.0;
  if (player.x > CANVAS_WIDTH - margin) repX -= Math.pow((player.x - (CANVAS_WIDTH - margin)) / margin, 2) * 3.0;
  if (player.y < margin) repY += Math.pow((margin - player.y) / margin, 2) * 3.0;
  if (player.y > CANVAS_HEIGHT - margin) repY -= Math.pow((player.y - (CANVAS_HEIGHT - margin)) / margin, 2) * 3.0;

  const len = Math.hypot(repX, repY);
  return len > 0 ? { x: repX / len, y: repY / len } : { x: 0, y: 0 };
}

const profile: CharacterProfile = {
  id: 'STANDARD',
  name: 'AGENTE ESTÁNDAR',
  subtitle: '',
  description: '',
  color: '#00ff66',
  borderColor: '#ffffff',
  hpMultiplier: 1.0,
  speedMultiplier: 1.0,
  pickupRadiusMultiplier: 1.0,
};

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
let elToro: ElToroBoss | null = null;
const dt = 0.04;

const cards = ['multithreading', 'overclocking', 'deepscan', 'system_restore', 'bandwidth_leech', 'antivirus_drones'];

console.log('Test run starting with smart kiting & resolveEnemyCrowd...');
while (elapsedTime < 760 && player.active) {
  elapsedTime += dt;

  spawner.update(dt, elapsedTime, upgradeSystem.level, enemies, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (!elToro && elapsedTime >= FINAL_BOSS_TIME) {
    console.log(`>>> ¡EL TORO HA LLEGADO a los ${Math.round(elapsedTime)}s (11m 40s)! Jugador Nivel ${upgradeSystem.level}, HP: ${player.hp}/${player.maxHp}`);
    spawner.enableFinalBossMode();
    enemies = enemies.filter((e) => e.malwareType === 'RANSOMWARE');
    elToro = new ElToroBoss(CANVAS_WIDTH / 2, -80);
    enemies.push(elToro);
  }

  const dir = getSmartKitingDirection(player, enemies);
  player.update(dt, { getDirection: () => dir } as any, CANVAS_WIDTH, CANVAS_HEIGHT);

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
    if (codeFragments.length >= 160) {
      const oldest = codeFragments[0];
      if (oldest) oldest.xpValue += drop.xpValue;
    } else {
      codeFragments.push(new CodeFragment(drop.x, drop.y, drop.xpValue));
    }
  }

  for (const frag of codeFragments) {
    frag.update(dt, player);
    if (Math.hypot(frag.x - player.x, frag.y - player.y) < player.size + 15) {
      frag.active = false;
      const leveledUp = upgradeSystem.addXp(frag.xpValue, player);
      if (leveledUp) {
        while (upgradeSystem.pendingLevelUps > 0) {
          const choices = upgradeSystem.rollChoices(player);
          if (!choices || choices.length === 0) break;
          let idx = choices.findIndex((c) => cards.includes(c.id));
          if (idx === -1) idx = 0;
          upgradeSystem.selectUpgrade(idx, player, combatSystem);
        }
      }
    }
  }

  projectiles = projectiles.filter((p) => p.active);
  pingProjectiles = pingProjectiles.filter((p) => p.active);
  quarantineZones = quarantineZones.filter((z) => z.active);
  enemies = enemies.filter((e) => e.active);
  codeFragments = codeFragments.filter((f) => f.active);

  if (Math.floor(elapsedTime) % 60 === 0 && Math.abs(elapsedTime - Math.floor(elapsedTime)) < dt) {
    console.log(`[Minuto ${Math.floor(elapsedTime / 60)}] HP: ${Math.round(player.hp)}/${player.maxHp} | Nivel: ${upgradeSystem.level} | Enemigos: ${enemies.length} | Bajas: ${killCount}`);
  }
}

console.log(`\nFin de partida: Tiempo: ${Math.floor(elapsedTime / 60)}m ${Math.round(elapsedTime % 60)}s | Llegó a El Toro: ${Boolean(elToro)}`);
if (elToro) {
  console.log(`Daño total infligido a El Toro: ${elToro.totalDamageTaken.toLocaleString()} HP`);
}
