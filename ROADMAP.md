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
├── v0.6.0 — Nuevos Enemigos ('Troyano Tirador' y 'Gusano Blindado'), Tarjeta 'Electroimán' y Escalado Global
│   ├── [Fase 1] Eliminación del 'Agente Kernel' de la tienda y creación de la Tarjeta Pasiva 'Electroimán' (+90px de radio magnético por nivel)
│   ├── [Fase 2] Nuevos Enemigos de Baja Frecuencia:
│   │   ├── 'Troyano Tirador' (`TrojanShooter.ts`): Mantiene distancia media-larga y dispara proyectiles dirigidos al jugador
│   │   └── 'Gusano Blindado' (`ArmoredWorm.ts`): Enemigo lento con escudo frontal direccional que bloquea el 100% del daño (0 daño), exigiendo flanquearlo por los laterales o la espalda
│   └── [Fase 3] Escalado de Vida Global (`Spawner.ts`): Multiplicador dinámico de HP máximo para todos los enemigos según el tiempo de supervivencia y el nivel del jugador
│
├── v0.6.1 — Parche de Balanceo Crítico: Escalado de Vida No Lineal, Límites de Spawn y Nerf de Giro
│   ├── [1. Escalado de Vida No Lineal (`Spawner.ts`)] Crecimiento suave en los primeros niveles (early game) y escalado potencial agresivo solo en late game (nivel > 6)
│   ├── [2. Ajustes al 'Gusano Blindado'] Límite estricto de máximo 3 vivos simultáneamente y reducción drástica de su velocidad de rotación (`1.32` -> `0.42 rad/s`)
│   └── [3. Ajustes al 'Troyano Tirador'] Límite estricto de máximo 5 vivos simultáneamente en pantalla para evitar saturación de proyectiles
│
├── v0.6.2 — Reloj en Formato MM:SS y Tarjeta Pasiva 'Robo de Ancho de Banda' (Vampirismo)
│   ├── [1. Formato de Tiempo (Reloj MM:SS)] Contador de supervivencia en el HUD y pantalla final convertido a formato estándar `MM:SS`
│   └── [2. Nueva Tarjeta 'Robo de Ancho de Banda'] Pasiva de vampirismo: cada proyectil del jugador que impacte y dañe a un enemigo tiene un 3% de probabilidad de curar +1 HP (hasta el máximo de vida)
│
├── v0.7.0 — Sistema Gacha ('Tirar del Cable'), Inventario y 50 Sombreros/Máscaras
│   ├── [Fase 1] Base de Datos de 50 Sombreros/Máscaras en 5 rarezas: Común (40%), Rara (30%), Épica (20%), Legendaria (9%) y Mítica (1%, 10 iconos de la cultura pop)
│   ├── [Fase 2] Pestaña Gacha en el Menú Principal: Botón 'Tirar del Cable' con Criptomonedas, revelación animada y persistencia en `localStorage`
│   └── [Fase 3] Inventario Paginado y Equipamiento: Selección de 1 sombrero activo y aplicación automática de multiplicadores de estadísticas al iniciar partida
│
├── v0.7.1 — Economía Gacha: Tirada x1 / x10 y Reembolso por Repetidos
│   ├── [1. Opciones de Compra] Dos botones en el Gacha: 'Tirada x1' (20 Criptomonedas) y 'Tirada x10' (200 Criptomonedas, mostrando cuadrícula con los 10 resultados)
│   └── [2. Reembolso por Repetidos] Si el sombrero obtenido ya está en el inventario, devuelve automáticamente +10 Criptomonedas al saldo y muestra 'Repetido: +10 Monedas'
│
├── v0.7.2 — Límite de Enemigos Amarillos y Escalado a 5 Niveles de Vampirismo
│   ├── [1. Límite de Enemigos Amarillos (`Spawner.ts`)] Máximo estricto de 5 enemigos amarillos (`Trojan`) vivos al mismo tiempo en el mapa
│   └── [2. Escalado de 'Robo de Ancho de Banda' (`UpgradeSystem.ts`)] 5 niveles progresivos (3% -> 4.5% -> 6% -> 7.5% -> 10%) con bloqueo automático ('Maxed') al alcanzar el nivel 5
│
├── v0.7.3 — Nuevas Armas ('Drones Antivirus', 'Cortafuegos', 'Rayo SQL Injection'), Límite de 4 Slots y Balanceo
│   ├── [Fase 1] Balanceo de Enemigos: Límite estricto de máximo 5 enemigos morados (`Worm`) vivos y aumento de frecuencia constante de enemigos rojos (`Adware`)
│   ├── [Fase 2] Límite de 4 Armas (4 Slots): Si el jugador ya tiene 4 armas distintas equipadas, las cartas de armas nuevas se bloquean y solo se ofrecen mejoras de armas activas o pasivas
│   └── [Fase 3] 3 Nuevas Armas en el Pool: 'Drones Antivirus' (orbital), 'Cortafuegos' (onda expansiva en área) y 'Rayo SQL Injection' (láser penetrante)
│
├── v0.8.0 — Eventos Dinámicos y Obstáculos: Cajas de Hardware, Minero de Criptos y 'El Enjambre'
│   ├── [Fase 1] Obstáculos ('Cajas de Hardware' - `HardwareBox.ts`): Cajas estáticas destructibles que sueltan recompensas aleatorias (monedas, orbes de XP o +25 HP de curación)
│   ├── [Fase 2] 'El Minero de Criptos' (`CryptoMiner.ts` - Loot Goblin): Enemigo raro que no ataca, huye constantemente y se des-spawnea tras 11s; si muere a tiempo suelta entre 30 y 40 Criptomonedas de golpe
│   └── [Fase 3] Evento 'El Enjambre' (Plaga): Filtro rojo suave y alarma visual; detiene el spawn normal durante 15s y genera 50 enemigos amarillos con muy poca vida y daño
│
├── v0.9.0 — Agente Morcillita (Summoner), Sistema de Compañero y Ramas Evolutivas Lvl 20
│   ├── [Fase 1] Menú KERNEL HUB: Cuarto personaje '[4] AGENTE MORCILLITA (SUMMONER)' de chasis rosa sin disparo básico propio
│   ├── [Fase 2] Mecánica Base (Nivel 1 - `CompanionPet.ts`): Mascota cuadrado marrón que patrulla en un radio de 200px y daña por contacto continuo
│   ├── [Fase 3] Bifurcación Obligatoria (Nivel 2): 3 cartas únicas de evolución ('Fuerza Bruta', 'La Botnet', 'Cable Trampa') bloqueando las otras dos al elegir
│   └── [Fase 4] Escalado Extremo (Niveles 5, 10 y 20):
│       ├── Rama 1 ('Fuerza Bruta'): Lvl 5 Gigante + Temblor | Lvl 10 'Masa Crítica' (cráter de daño) | Lvl 20 'Onda de Choque' (explosión AoE al matar)
│       ├── Rama 2 ('La Botnet'): Lvl 5 'Mente Colmena' (5 cuadrados defensivos) | Lvl 10 'Ataque DDoS' (clones efímeros) | Lvl 20 'Botnet Global' (15 pirañas por toda la pantalla)
│       └── Rama 3 ('Cable Trampa'): Lvl 5 Triángulo láser | Lvl 10 'Fibra Óptica' (Congelación de Red -80% vel) | Lvl 20 'Red de Malla' (4 cuadrados + jugador = estrella láser gigante)
│
├── v0.9.1 — Balance de Enemigos Rojos, Flechas PING_TRACKER y 'Propagación de Malware' en La Botnet
│   ├── [Fase 1] Balance y Correcciones Visuales:
│   │   ├── Reducción del spawn rate y límite máximo en pantalla (`maxActiveRedAdware = 14`) de los enemigos 'rojos' (`Adware`)
│   │   └── Rediseño visual de `PING_TRACKER.exe` (`PingProjectile.ts`): dibujado como flechas/triángulos orientados en la dirección exacta de su movimiento
│   └── [Fase 2] Modificación de la Rama 2 ('La Botnet') de Morcillita (`CompanionPet.ts`):
│       ├── Regla estricta de apuntado único: ningún cuadrado va a por el mismo enemigo que otro; los cuadrados sobrantes orbitan al jugador
│       └── Nivel 10 ('Propagación de Malware'): al matar a un enemigo con un cuadrado, explota lanzando fragmentos de metralla digital en área que dañan a enemigos cercanos
│
├── v0.9.2 — Rama 3 'Protocolo Pinball', Ajustes de Apuntado en Botnet, Reducción de Alerta de Enjambre y Vampirismo Pasivo
│   ├── [Botnet (Rama 2)] Enemigos estándar: máx. 1 mascota por objetivo | Mini-jefes: hasta 3 mascotas simultáneamente
│   ├── [Rama 3 ('Protocolo Pinball')]
│   │   ├── Nivel 2: La mascota se separa del jugador, viaja en línea recta a velocidad extrema, rebota en los bordes y atraviesa enemigos (ignora Mega-Jefes)
│   │   ├── Nivel 5: +50% velocidad y estela temporal de corrupción de datos que daña al contacto
│   │   ├── Nivel 10 ('Explosión Cinética'): Rebotar en un borde o impactar a un enemigo dispara 4 proyectiles pequeños (arriba, abajo, izquierda, derecha)
│   │   └── Nivel 20 ('Multibola'): Se divide en 3 mascotas rebotadoras independientes de alta velocidad
│   └── [Gameplay & Balance]
│       ├── Duración de la alerta/evento de horda ('El Enjambre') fijada exactamente en 6 segundos
│       ├── Cajas de Hardware (Obstáculos): otorgan curación el 100% de las veces al ser destruidas
│       └── Mecánica 'Vampirismo': el jugador recupera exactamente 20 HP por cada 20 enemigos eliminados
│
└── v0.9.3 — Botín Triple en Cajas de Hardware (HP + XP + Monedas) y Escalado de Curación en 'Robo de Ancho de Banda' (ACTUAL)
    ├── [Cajas de Hardware (`Game.ts`)] Garantizan 100% curación (+25 HP) y sueltan simultáneamente paquetes de XP y Criptomonedas
    ├── [Pasiva 'Robo de Ancho de Banda' (`UpgradeSystem.ts`, `CombatSystem.ts`, `Player.ts`)]
    │   └── Escalado de HP restaurado por activación según el nivel: Nv.1 = 2 HP, Nv.2 = 4 HP, Nv.3 = 6 HP, Nv.4 = 8 HP, Nv.5 = 10 HP (eliminada la curación plana de 1 HP)
    └── [Control de Versiones] Versión actualizada a `v0.9.3` en el Menú Principal, insignia inferior derecha y `ROADMAP.md`
```

---

## Historial Detallado de Versiones

### [v0.9.3] - 2026-10-30
- **Mejorado (`Game.ts` - Cajas de Hardware / Drops)**:
  - Al destruir una Caja de Hardware, ahora otorga **curación garantizada al 100%** (`+25 HP`) y **simultáneamente** suelta los fragmentos de **XP** (`3` orbes) y **Criptomonedas** (`3` monedas).
- **Escalado (`Player.ts`, `UpgradeSystem.ts`, `CombatSystem.ts`, `Game.ts` - Pasiva `'Robo de Ancho de Banda'`)**:
  - Eliminada la curación plana de `1 HP` por activación. Ahora la cantidad de vida restaurada escala con el nivel de la mejora: **Nivel 1 = `2 HP`, Nivel 2 = `4 HP`, Nivel 3 = `6 HP`, Nivel 4 = `8 HP`, Nivel 5 = `10 HP`**.
- **Versionado (`Game.ts`, `package.json`, `ROADMAP.md`)**:
  - Actualizada la versión del juego a **`v0.9.3`** tanto en el encabezado del Menú Principal (`KERNEL HUB (v0.9.3)`) como en la esquina inferior derecha y en este documento.

### [v0.9.2] - 2026-10-30
- **Ajustado (`CompanionPet.ts` - Apuntado de La Botnet / Rama 2)**:
  - Enemigos estándar mantienen el límite estricto de máximo `1` mascota por objetivo, mientras que los mini-jefes (`RANSOMWARE`) permiten hasta **`3` mascotas** atacando al mismo mini-jefe simultáneamente.
- **Rediseñado (`CompanionPet.ts`, `UpgradeSystem.ts` - Rama 3 `'Protocolo Pinball'`)**:
  - **Nivel 2**: La mascota se independiza del jugador, moviéndose en línea recta a velocidad extrema (`620 px/s`), rebotando en los bordes de la pantalla y atravesando enemigos (ignorando Mega-Jefes).
  - **Nivel 5**: Velocidad aumentada un **`+50%`** (`930 px/s`) y generación de una estela temporal de corrupción de datos (`PinballCorruptionTrail`) que daña a los enemigos que la tocan.
  - **Nivel 10 (`Explosión Cinética`)**: Al rebotar contra un borde o impactar contra un enemigo, dispara `4` proyectiles pequeños en las direcciones cardinales (`arriba`, `abajo`, `izquierda`, `derecha`).
  - **Nivel 20 (`Multibola`)**: Se divide en `3` mascotas independientes de alta velocidad que rebotan por toda la pantalla.
- **Balanceado (`Spawner.ts`, `Game.ts` - Evento de Horda, Cajas de Hardware y Vampirismo)**:
  - Fijada la duración de la alerta del evento de horda (`El Enjambre`) en exactamente **6 segundos**.
  - **Cajas de Hardware**: Ahora otorgan curación (`+25 HP`) el **100% de las veces** al destruirse (eliminando los drops de monedas de las cajas).
  - **Mecánica de Vampirismo**: El jugador recupera exactamente **`20 HP`** cada **20 enemigos eliminados**.

### [v0.9.1] - 2026-10-28
- **Balanceado y Mejorado (`Spawner.ts`, `PingProjectile.ts` - Fase 1)**:
  - Reducida la frecuencia de aparición (`spawn rate`) y añadido un límite máximo en pantalla (`maxActiveRedAdware = 14`) para los enemigos rojos (`Adware`), evitando que saturen el mapa.
  - Modificado el método `draw` de `PING_TRACKER.exe` (`PingProjectile.ts`) para que sus proyectiles ya no sean cuadrados, sino flechas/triángulos afilados que apuntan exactamente en la dirección de su vector de velocidad (`Math.atan2(vy, vx)`).
- **Mejorado (`CompanionPet.ts`, `UpgradeSystem.ts` - Fase 2: Rama 2 `'La Botnet'` de Morcillita)**:
  - **Apuntado de Objetivo Único**: Cada cuadrado de *La Botnet* selecciona un enemigo único no reclamado por otro cuadrado; si hay más cuadrados que enemigos disponibles en rango, los cuadrados restantes orbitan alrededor del jugador.
  - **Nivel 10 (`Propagación de Malware`)**: Cuando uno de los cuadrados de *La Botnet* mata a un enemigo, dicho enemigo explota lanzando fragmentos radiales de metralla digital (`MalwareShrapnelFragment`) que dañan a los enemigos cercanos en el área.

### [v0.9.0] - 2026-10-27
- **Añadido (`MetaSystem.ts`, `Player.ts`, `Game.ts` - Fase 1: Agente Morcillita / Summoner)**:
  - Nuevo cuarto recuadro en el KERNEL HUB: **`[4] AGENTE MORCILLITA (SUMMONER)`** con chasis rosa (`#ec4899`). Carece de disparo básico propio y delega el 100% de su ataque base en su mascota acompañante evolutiva.
- **Añadido (`CompanionPet.ts`, `UpgradeSystem.ts`, `Adware.ts` - Fases 2, 3 y 4: Sistema de Compañero y Evoluciones Lvl 20)**:
  - **Nivel 1**: Genera un `CompanionPet` (cuadrado marrón pequeño) que patrulla libremente en un radio de `200px` alrededor del jugador, busca al enemigo más cercano en ese radio e inflige daño continuo por contacto.
  - **Nivel 2 (La Bifurcación)**: Ofrece obligatoriamente las 3 cartas únicas de evolución y bloquea las otras dos para el resto de la partida tras elegir una:
    - **Rama 1 (`Fuerza Bruta`)**: Nivel 2 (`+50%` tamaño y empuje), Nivel 5 (Tamaño gigante y temblor de pantalla al golpear), Nivel 10 (`Masa Crítica`: deja un cráter temporal en el suelo que daña enemigos), Nivel 20 (`Onda de Choque`: cada baja emite una onda expansiva circular en área).
    - **Rama 2 (`La Botnet` / Enjambre)**: Nivel 2 (3 cuadrados pequeños y rápidos), Nivel 5 (`Mente Colmena`: 5 cuadrados rápidos priorizando defensa cercana), Nivel 10 (`Ataque DDoS`: probabilidad al golpear de generar un clon efímero que ataca una vez y desaparece), Nivel 20 (`Botnet Global`: 15 cuadrados barriendo toda la pantalla como pirañas).
    - **Rama 3 (`Cable Trampa`)**: Nivel 2 (grueso láser entre el Agente rosa y el cuadrado marrón que daña al contacto), Nivel 5 (segundo cuadrado marrón formando un triángulo láser con el jugador), Nivel 10 (`Fibra Óptica`: el láser aplica *Congelación de Red*, ralentizando un `80%` a los enemigos), Nivel 20 (`Red de Malla`: 4 cuadrados marrones + el jugador = 5 vértices formando una estrella/pentagrama láser gigante).

### [v0.8.0] - 2026-10-27
- **Añadido (`HardwareBox.ts`, `Spawner.ts`, `Game.ts` - Fase 1: Cajas de Hardware)**:
  - Obstáculos estáticos destructibles que aparecen esporádicamente por el mapa y, al ser destruidos, otorgan una recompensa aleatoria (`+3 Criptomonedas`, `+3 Orbes de XP` o `+25 HP` de curación inmediata).
- **Añadido (`CryptoMiner.ts`, `Spawner.ts`, `Game.ts` - Fase 2: El Minero de Criptos / Loot Goblin)**:
  - Enemigo especial de aparición muy rara que no ataca al Agente y huye continuamente en dirección opuesta. Si sobrevive 11 segundos escapa y desaparece; si el jugador logra eliminarlo a tiempo, suelta un gran botín de **30 a 40 Criptomonedas** de golpe.
- **Añadido (`Spawner.ts`, `Game.ts` - Fase 3: Evento `'El Enjambre'`)**:
  - Evento aleatorio de baja probabilidad que aplica un filtro rojo suave al Canvas, activa una alarma visual y sonora, pausa el spawn normal durante **15 segundos** y genera de golpe **50 enemigos amarillos (`Trojan`)** con muy poca vida (`8 HP`) y daño reducido (`4 DMG`).

### [v0.7.3] - 2026-10-27
- **Balanceado (`Spawner.ts`, `Game.ts` - Fase 1)**:
  - Añadido un límite estricto (`maxActiveWorms = 5`) para que nunca haya más de 5 enemigos morados (`Worm`) vivos simultáneamente en el mapa.
  - Aumentado el ritmo y densidad constante de aparición de los enemigos rojos base (`Adware`).
- **Añadido (`UpgradeSystem.ts` - Fase 2: Límite de 4 Armas)**:
  - El Agente puede portar un máximo de **4 armas distintas** (incluyendo el disparo básico inicial). Al llenar los 4 slots, el sistema deja de ofrecer armas nuevas y solo muestra subidas de nivel de las armas ya equipadas o mejoras pasivas.
- **Añadido (`CombatSystem.ts`, `UpgradeSystem.ts` - Fase 3: 3 Nuevas Armas)**:
  - **`Drones Antivirus` (Arma Orbital)**: Drones que orbitan en círculos alrededor del Agente dañando al contacto (subir de nivel aumenta el número de drones, el daño y la velocidad de órbita).
  - **`Cortafuegos` (Ataque en Área — `FirewallPulseRing`)**: Emite periódicamente un anillo de energía expansivo alrededor del Agente que daña a todos los enemigos dentro del radio (subir de nivel aumenta el daño, el radio y reduce el cooldown).
  - **`Rayo SQL Injection` (Ataque Penetrante — `SqlInjectionBeam`)**: Dispara un haz láser grueso en línea recta que atraviesa a todos los enemigos en su trayectoria sin destruirse (subir de nivel aumenta el daño, el grosor del láser y reduce el cooldown).

### [v0.7.2] - 2026-10-27
- **Balanceado (`Spawner.ts` - Límite de Enemigos Amarillos)**:
  - Añadido un límite estricto (`maxActiveTrojans = 5`) para que nunca haya más de 5 enemigos amarillos (`Trojan`) vivos simultáneamente en el mapa.
- **Mejorado (`UpgradeSystem.ts` - Escalado de `'Robo de Ancho de Banda'`)**:
  - Ampliada la tarjeta pasiva de vampirismo a **5 niveles máximos** con probabilidad progresiva de curar `+1 HP` por impacto: **Nivel 1 (`3%`), Nivel 2 (`4.5%`), Nivel 3 (`6%`), Nivel 4 (`7.5%`), Nivel 5 (`10%`)**.
  - Al llegar al nivel 5, la mejora queda marcada como `isMaxed = true` (Al máximo) y deja de ofrecerse en futuras subidas de nivel.

### [v0.7.1] - 2026-10-27
- **Mejorado (`MetaSystem.ts`, `Game.ts` - Tirada x1 / x10 y Reembolso por Repetidos)**:
  - Añadidos dos botones en el Gacha del Menú Principal: **`Tirada x1`** (`20` Criptomonedas) y **`Tirada x10`** (`200` Criptomonedas, ejecutando 10 tiradas seguidas y mostrando los 10 resultados en pantalla).
  - Sistema automático de reembolso por duplicados: al obtener un sombrero cuyo `id` ya está registrado en el inventario del `localStorage`, no se duplica y suma automáticamente **`+10` Criptomonedas** al saldo del jugador, indicando claramente `'Repetido: +10 Monedas'`.

### [v0.7.0] - 2026-10-27
- **Añadido (`HatSystem.ts` - Fase 1)**:
  - Base de datos completa con **50 sombreros y máscaras** distribuidos en 5 rarezas (`Común 40%`, `Rara 30%`, `Épica 20%`, `Legendaria 9%`, `Mítica 1%`), incluyendo los 10 objetos Míticos de la cultura pop (*Gorro de Teemo, Gafas de Bubbles, Gorra de Ash, Máscara de Darth Vader, Casco de Iron Man, Sombrero Seleccionador, Máscara de Vendetta, Sombrero de Indiana Jones, Máscara de Jason y Gafas de Heisenberg*).
- **Añadido (`MetaSystem.ts`, `Game.ts` - Fase 2 y Fase 3)**:
  - Interfaz de pestañas en el Menú Principal (`[Q] AGENTES`, `[G] GACHA // COFRES`, `[I] INVENTARIO`).
  - Botón **`Tirar del Cable`** para abrir cofres Gacha con Criptomonedas, animación de revelación y guardado automático en `localStorage`.
  - Inventario interactivo para equipar sombreros desbloqueados y aplicación directa de sus modificadores matemáticos (`daño`, `velocidad`, `cadencia`, `vidaMax`, `imán`, `crítico`) en el constructor de `Player.ts`.

### [v0.6.2] - 2026-10-27
- **Mejorado (`Game.ts` - Reloj del HUD en formato `MM:SS`)**:
  - Convertido el temporizador de tiempo de supervivencia del HUD a formato estándar de minutos y segundos (`MM:SS`).
- **Añadido (`UpgradeSystem.ts`, `CombatSystem.ts`, `Player.ts` - Tarjeta Pasiva `'Robo de Ancho de Banda'`)**:
  - Nueva mejora pasiva de vampirismo: al activarla, cada proyectil del jugador que impacte e inflija daño real a un enemigo tiene un `3%` de probabilidad de curar automáticamente `+1 HP` sin sobrepasar la vida máxima (`maxHp`).

### [v0.6.1] - 2026-10-27
- **Rebalanceado (`Spawner.ts` - Escalado de Vida No Lineal)**:
  - Rediseñada la fórmula `getGlobalHpMultiplier(elapsedTime, playerLevel)` para que durante los primeros niveles (`1` a `6`) la vida de los enemigos aumente muy poco a poco (`+3.5%` por nivel), reservando el crecimiento exponencial/potencial agresivo exclusivamente para el *late game*.
- **Balanceado (`ArmoredWorm.ts`, `Spawner.ts` - 'Gusano Blindado')**:
  - Añadido un límite estricto en el spawner de **máximo 3 `Gusanos Blindados`** vivos al mismo tiempo.
  - Reducida drásticamente su velocidad de rotación (`turnRate` de `1.32 rad/s` a **`0.42 rad/s`**) para que gire lentamente y permita al jugador rodearlo y dispararle por la espalda con fluidez.
- **Balanceado (`Spawner.ts` - 'Troyano Tirador')**:
  - Añadido un límite estricto en el spawner de **máximo 5 `Troyanos Tiradores`** vivos al mismo tiempo en el mapa.

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
