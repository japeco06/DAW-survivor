---
name: daw-game-content
description: >-
  Guía de arquitectura y checklist para añadir nuevo contenido jugable a DAW-SURVIVOR:
  enemigos, mega-jefes, armas, mejoras, arenas, eventos de terreno, logros o cosméticos.
  Usar cuando el usuario pida crear o ampliar mecánicas y contenido del juego.
---

# Arquitectura para Añadir Contenido — DAW-SURVIVOR

Antes de crear nuevas entidades o mecánicas, revisa los módulos correspondientes para mantener la arquitectura OOP y el rendimiento a 60 FPS.

## Mapa rápido de módulos

- **Núcleo**: `src/core/Game.ts` (loop principal, estados, HUD, renderizado), `src/core/Input.ts`, `src/core/SoundSystem.ts` (efectos sintetizados Web Audio API).
- **Entidades base**: `src/entities/Entity.ts`, `src/entities/Player.ts`, `src/entities/BaseBoss.ts`.
- **Enemigos y Jefes**: `src/entities/Adware.ts`, `Trojan.ts`, `TrojanShooter.ts`, `Worm.ts`, `ArmoredWorm.ts`, `Evasor.ts`, `CryptoMiner.ts`, `RansomwareBoss.ts`, `RansomwareMaster.ts`, `SpecialBosses.ts`, `ElToroBoss.ts`, `WaveBoss.ts`.
- **Sistemas**:
  - `src/systems/CombatSystem.ts` — armas, disparos, colisiones y daño.
  - `src/systems/Spawner.ts` — oleadas, escalado global y rotación de jefes.
  - `src/systems/UpgradeSystem.ts` — cartas de subida de nivel y escalado XP.
  - `src/systems/MetaSystem.ts` — tienda, personajes desbloqueables y persistencia.
  - `src/systems/WorldEnvironment.ts` & `TerrainEventSystem.ts` — arenas temáticas y eventos de mapa.
  - `src/systems/VisualFXSystem.ts` & `ParticleSystem.ts` — bloom aditivo, partículas y feedback visual.
  - `src/systems/AchievementSystem.ts`, `DailyMissionSystem.ts`, `HatSystem.ts`, `CasinoSystem.ts`.
- **Utilidades y Red**: `src/utils/i18n.ts`, `src/utils/HatRenderer.ts`, `src/network/*`, `server/index.js`.

## Checklists por tipo de contenido

### Nuevo Mega-Jefe
1. Heredar de `BaseBoss` (`src/entities/BaseBoss.ts`) implementando sus estados/ataques especiales en `src/entities/SpecialBosses.ts` o un archivo dedicado.
2. Registrarlo en el pool de rotación de `Spawner.ts` y verificar su renderizado/barra de vida en `Game.ts`.
3. Añadir efectos de sonido procedurales en `SoundSystem.ts` si introduce ataques nuevos.
4. Registrar nombre y textos de alerta en `src/utils/i18n.ts`.

### Nuevo Enemigo
1. Crear clase en `src/entities/` extendiendo `Entity`.
2. Integrar spawn y escalado de vida en `Spawner.ts`.
3. Verificar colisiones, drops (`CodeFragment`, `CryptoCoin`, `PowerUpItem`) y feedback de impacto en `CombatSystem.ts` / `Game.ts`.

### Nueva Arma o Mejora
1. Definir la tarjeta/estadísticas en `UpgradeSystem.ts`.
2. Implementar la lógica de disparo/efecto en `CombatSystem.ts` (y proyectil/entidad propia si aplica).
3. Añadir traducciones (título y descripción) en `src/utils/i18n.ts`.

### Validación técnica
- Mantener el renderizado 100% procedural (compatible con `scripts/inline-dist.mjs`).
- Evitar `shadowBlur` en bucles masivos; usar capas aditivas o `VisualFXSystem.ts`.
- Verificar compilación limpia con `npm run build` y seguir la skill `daw-release-deploy` al terminar.
