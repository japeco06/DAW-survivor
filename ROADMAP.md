# CYBER SURVIVOR // ROADMAP & CHANGELOG

Esquema visual de la evolución del proyecto. Este archivo se actualiza automáticamente en cada iteración de desarrollo.

```text
CYBER SURVIVOR ( Kernel Defense Protocol )
├── v0.1.0 — Lanzamiento Base (Fases 1 a 5 completadas)
│   ├── [Fase 1] Setup Base y Core Loop (Vite + TS + Canvas, WASD, Spawner de Adware)
│   ├── [Fase 2] Sistema de Combate (Auto-disparo, Hitboxes AABB, HP e invulnerabilidad)
│   ├── [Fase 3] Progresión In-Game (Drops de XP magnéticos, Level Up y Parches de Mejora)
│   ├── [Fase 4] Escalado y Variedad (Troyanos rápidos, Gusanos divisibles y Jefes Ransomware)
│   └── [Fase 5] Polish & Game Feel (Partículas binarias, Screen Shake, Consola CRT y Menús)
│
├── v0.2.0 — Audio Sintetizado, Arsenal Avanzado y Metaprogresión
│   ├── [1. Changelog & Versionado] ROADMAP.md y etiqueta en esquina inferior derecha
│   ├── [2. Sintetizador Web Audio API] Disparo retro 8-bit y explosión de estática digital
│   ├── [3. Nuevas Armas In-Game] 'Ráfaga de Firewall', 'Ping Tracker' (Homing) y 'Zona de Cuarentena' (DoT)
│   └── [4. Tienda y Personajes] Criptomonedas doradas y desbloqueo del 'Agente Root' (+20% velocidad)
│
├── v0.3.0 — Progresión Profunda, Escuadrón de Agentes, Pausa y Evento Mega-Jefe
│   ├── [Fase 1] Sistema de Experiencia y Tarjeta 'Overclock de Memoria' (+35% multiplicador XP)
│   ├── [Fase 2] Nuevos Personajes en Tienda: 'Agente Proxy' (200 HP) y 'Agente Kernel' (Magnetismo masivo)
│   ├── [Sistema de Pausa] Pausa táctica con tecla 'P' ('Reanudar' y 'Salir al Menú Principal')
│   └── [Fase 3] Primera versión del Mega-Jefe 'Ransomware Master'
│
├── v0.3.5 — Rediseño Táctico del Mega-Jefe: Máquina de Estados, Laberinto y Cobertura
│   ├── [Arquitectura OOP] Máquina de Estados Finita (FSM) para ataques del Mega-Jefe
│   ├── [1. Obstáculos Físicos] 'Bloques Encriptados' con colisión sólida AABB
│   ├── [2. Ataques Móviles] Láseres de barrido y 'Ola de DDoS' con aperturas
│   └── [3. Gusanos Rastreadores y Llaves] Cobertura tras muros y generación táctica de llaves
│
├── v0.4.0 — Variedad de Mega-Jefes con Herencia OOP (`BaseBoss`)
│   ├── [Refactorización OOP] Clase abstracta `BaseBoss` con vida, muros y estados comunes
│   └── [3 Nuevos Jefes] 'El Bañista', 'El Copiota' y 'El Dormilón'
│
├── v0.4.1 — Pool Completo de 4 Mega-Jefes, Bucle Infinito y Ajustes de Precisión
│   ├── [1. Rotación de 4 Mega-Jefes] Pool activo de 4 jefes y ciclo infinito tras 5 jefes normales
│   └── [2. Métricas de Láseres] Telegrafiado 1.0s, pasillos de 250px y velocidad de 75px/s
│
├── v0.4.2 — Láseres Estrictamente Paralelos y Distribución Orgánica de Minas
│   ├── [1. Láseres Paralelos] Ráfagas 100% horizontales o 100% verticales en `Ransomware Master`
│   └── [2. Campo de Minas] Velocidad inicial y drag individualizados para las 'Chuletas de Examen'
│
├── v0.5.0 — Rediseño 'El Borracho' y Expansión de Kits de Ataque Especiales
│   ├── [1. Rediseño del Jefe 3: De 'El Dormilón' a 'El Borracho']
│   │   ├── Apariencia mantenida: Sudadera rosa con capucha y gafas
│   │   ├── Ataque Especial 1 ('Lluvia de Cervezas'): Jarras de cerveza (🍺) con física de rebote caótico en los bordes
│   │   └── NUEVO Ataque Especial 2 ('Lanzamiento de Pesas'): Mancuernas grandes y pesadas que se mueven lento pero ATRAVIESAN los 'Bloques Encriptados', forzando a salir de cobertura
│   └── [2. Expansión del Jefe 1 ('El Bañista')]
│       ├── Ataque Especial 1 ('Ola del Tridente'): Muro de agua curvo con hueco seguro aleatorio
│       └── NUEVO Ataque Especial 2 ('Pistola de Agua'): Ráfaga rápida y continua de proyectiles azules concentrados hacia la posición actual del jugador, exigiendo movimiento perpendicular
│
├── v0.5.1 — Parche de Balanceo: Chuletas, Gusanos Rastreadores y Pesas Rebotadoras
│   ├── [1. Balanceo de 'Chuletas' ('El Copiota')] Menor tiempo de vida (6.5s) y reducción leve del radio de activación/explosión
│   ├── [2. Gusanos Rastreadores (`BaseBoss`)] Oleada ampliada de 3 a 6 proyectiles morados rastreadores por ráfaga
│   └── [3. Lanzamiento de Pesas ('El Borracho')] +1 pesa por ráfaga (4 en total) y rebote contra los bordes del Canvas manteniendo perforación de muros
│
├── v0.5.2 — Balanceo de Economía (Drop Raro de Criptomonedas) y Curva de XP Suavizada
│   ├── [1. Balanceo de Economía] Probabilidad de drop de Criptomonedas reducida drásticamente (25% -> 6% en enemigos base) para fomentar el farmeo entre partidas
│   └── [2. Escalado de Experiencia Suavizado] Multiplicador por nivel reducido (1.35x + 20 -> 1.15x + 12) para evitar estancamiento en niveles medios y altos
│
├── v0.5.3 — Ajuste de Ritmo Inicial (Pacing): XP Base Mayor y Mini-Jefes Frecuentes
│   ├── [1. Balanceo de Experiencia Temprana] XP base inicial aumentada (80 -> 150 XP) manteniendo intacto el escalado suave (1.15x + 12) para niveles altos
│   └── [2. Frecuencia de Mini-Jefes] Temporizador de aparición de jefes normales reducido (45s -> 22s), acelerando la llegada de los Mega-Jefes
│
└── v0.6.0 — Nuevos Enemigos ('Troyano Tirador' y 'Gusano Blindado'), Tarjeta 'Electroimán' y Escalado Global (ACTUAL)
    ├── [Fase 1] Eliminación del 'Agente Kernel' de la tienda y creación de la Tarjeta Pasiva 'Electroimán' (+90px de radio magnético por nivel)
    ├── [Fase 2] Nuevos Enemigos de Baja Frecuencia:
    │   ├── 'Troyano Tirador' (`TrojanShooter.ts`): Mantiene distancia media-larga y dispara proyectiles dirigidos al jugador
    │   └── 'Gusano Blindado' (`ArmoredWorm.ts`): Enemigo lento con escudo frontal direccional que bloquea el 100% del daño (0 daño), exigiendo flanquearlo por los laterales o la espalda
    └── [Fase 3] Escalado de Vida Global (`Spawner.ts`): Multiplicador dinámico de HP máximo para todos los enemigos según el tiempo de supervivencia y el nivel del jugador
```

---

## Historial Detallado de Versiones

### [v0.6.0] - 2026-10-27
- **Limpiado y Añadido (`MetaSystem.ts`, `UpgradeSystem.ts` - Fase 1)**:
  - Eliminado el personaje `Agente Kernel` de la tienda del Menú Principal y del sistema de selección.
  - Creada la tarjeta de mejora pasiva **`Electroimán`** (`+90px` de radio magnético por nivel) para conservar y expandir la mecánica de atracción de orbes de XP y monedas.
- **Nuevos Enemigos (`TrojanShooter.ts`, `ArmoredWorm.ts`, `CombatSystem.ts` - Fase 2)**:
  - **`Troyano Tirador` (`TrojanShooter`)**: Unidad a distancia que se detiene a rango medio-largo (`230px - 330px`) y dispara proyectiles dirigidos (`EnemyProjectile`) hacia el jugador.
  - **`Gusano Blindado` (`ArmoredWorm`)**: Enemigo lento con giro progresivo y un escudo energético frontal visible. Cualquier proyectil que impacte en su arco frontal inflige `0` de daño (`0 [SHIELD]`), obligando al jugador a rodearlo y dispararle por los laterales o la espalda.
- **Escalado de Vida Global (`Spawner.ts` - Fase 3)**:
  - Implementado `getGlobalHpMultiplier(elapsedTime, playerLevel)`, aumentando progresivamente la salud máxima (`maxHp`) de todos los enemigos normales conforme avanzan el tiempo de supervivencia y el nivel del jugador.

### [v0.5.3] - 2026-10-27
- **Balanceado (`UpgradeSystem.ts` - Experiencia Temprana / Early Game)**:
  - Aumentada la cantidad base de experiencia inicial (`xpToNextLevel`) de `80` a `150` XP para frenar las subidas de nivel ultrarrápidas al inicio de la partida, manteniendo intacta la fórmula de escalado suave (`* 1.15 + 12`) para niveles avanzados.
- **Acelerado (`Spawner.ts` - Frecuencia de Mini-Jefes)**:
  - Reducido el intervalo de aparición de los mini-jefes (`RansomwareBoss`) de `45s` a `22s` (tanto desde el inicio de la partida como tras derrotar a un Mega-Jefe), acelerando el ciclo hacia los eventos de Mega-Jefe.

### [v0.5.2] - 2026-10-27
- **Balanceado (`Game.ts` - Economía de Criptomonedas)**:
  - Reducida significativamente la probabilidad de drop de `CryptoCoin` al eliminar enemigos básicos (`25%` → `6%`), jefes normales (`5` → `2` monedas) y mega-jefes (`15` → `6` monedas) para que sean un recurso raro y valioso entre partidas.
- **Balanceado (`UpgradeSystem.ts` - Curva de Nivel Suavizada)**:
  - Reducido el multiplicador de escalado de experiencia entre niveles de `xpToNextLevel * 1.35 + 20` a `xpToNextLevel * 1.15 + 12`, suavizando la curva para mantener un ritmo de subida de nivel dinámico sin estancamientos.

### [v0.5.1] - 2026-10-27
- **Balanceado (`CheatSheetMine` - Jefe `El Copiota` en `SpecialBosses.ts`)**:
  - Reducido el tiempo de vida (`lifeTime`) de las chuletas de `8.5s` a `6.5s`.
  - Reducido levemente el radio de activación (`58px` → `50px`) y el radio de explosión (`78px` → `68px`).
- **Aumentado (`TrackerWormsState` en `BaseBoss.ts`)**:
  - Incrementada la ráfaga de gusanos morados rastreadores de `3` a `6` proyectiles por oleada.
- **Mejorado (`HeavyDumbbellProjectile` / `DrunkardBoss` en `SpecialBosses.ts`)**:
  - Aumentada en `+1` la cantidad de mancuernas lanzadas por ataque (`3` → `4` pesas).
  - Añadida física de rebote contra los límites del Canvas igual que las jarras de cerveza, conservando intacta su propiedad de atravesar los `EncryptedBlock` centrales.

### [v0.5.0] - 2026-10-26
- **Ampliado (`BaseBoss.ts`)**: Soporte en la máquina de estados para un segundo ataque especial (`SPECIAL_ATTACK_2` / `triggerSecondarySpecialAttack`) integrado en la rotación de estados de cada jefe.
- **Rediseñado (`DrunkardBoss` - "El Borracho" en `SpecialBosses.ts`)**:
  - Sustituye temáticamente a `El Dormilón` conservando intacta su apariencia (sudadera rosa y gafas).
  - **Ataque Especial 1 (`Lluvia de Cervezas` - `BouncingBeerMug`)**: Lanza jarras de cerveza (`🍺`) que rebotan violentamente contra los bordes de la pantalla con ángulos impredecibles.
  - **Nuevo Ataque Especial 2 (`Lanzamiento de Pesas` - `HeavyDumbbellProjectile`)**: Lanza mancuernas gigantes y pesadas a menor velocidad que ignoran/atraviesan los `EncryptedBlock` (muros), obligando al jugador a abandonar su cobertura.
- **Mejorado (`BatherBoss` - "El Bañista" en `SpecialBosses.ts`)**:
  - **Nuevo Ataque Especial 2 (`Pistola de Agua` - `WaterStreamProjectile`)**: Intercalado con la `Ola del Tridente`, dispara un chorro continuo de alta cadencia (18 proyectiles azules de agua durante `1.4s`) apuntando dinámicamente a la posición actual del jugador para forzarle a correr en perpendicular.

### [v0.4.2] - 2026-10-26
- Láseres estrictamente paralelos en `RansomwareMaster` y distribución escalonada de minas en `CheaterBoss`.

### [v0.4.1] - 2026-10-26
- Pool de 4 Mega-Jefes, ciclo infinito y métricas exactas de láseres (`1s`, `250px`, `75px/s`).

### [v0.4.0] - 2026-10-26
- Clase base `BaseBoss` y subclases de jefes especiales.
