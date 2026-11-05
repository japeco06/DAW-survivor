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
├── v0.9.3 — Botín Triple en Cajas de Hardware (HP + XP + Monedas) y Escalado de Curación en 'Robo de Ancho de Banda'
│   ├── [Cajas de Hardware (`Game.ts`)] Garantizan 100% curación (+25 HP) y sueltan simultáneamente paquetes de XP y Criptomonedas
│   ├── [Pasiva 'Robo de Ancho de Banda' (`UpgradeSystem.ts`, `CombatSystem.ts`, `Player.ts`)]
│   │   └── Escalado de HP restaurado por activación según el nivel: Nv.1 = 2 HP, Nv.2 = 4 HP, Nv.3 = 6 HP, Nv.4 = 8 HP, Nv.5 = 10 HP (eliminada la curación plana de 1 HP)
│   └── [Control de Versiones] Versión actualizada a `v0.9.3` en el Menú Principal, insignia inferior derecha y `ROADMAP.md`
│
├── v0.10.0 — High Score Local, Drones de Escudo Reactivo y Nuevo Enemigo 'Evasor' (Ghost Script)
│   ├── [High Score Local (`MetaSystem.ts`, `Game.ts`)] Guardado en `localStorage` y visualización de `"High Score: [Value]"` en el Menú Principal
│   ├── [Rediseño de Drones (Escudo Reactivo - `CombatSystem.ts`)]
│   │   ├── Orbitan e interceptan enemigos (0 daño al jugador al impactar contra un dron)
│   │   ├── Durabilidad de 3 impactos por dron con cambio de color (Verde -> Amarillo -> Rojo)
│   │   ├── Al 3er impacto: el dron explota infligiendo daño AoE a los enemigos cercanos y desaparece
│   │   └── Cooldown de reaparición: 10 segundos por cada dron destruido
│   └── [Nuevo Enemigo ('Evasor' / Ghost Script - `Evasor.ts`, `Spawner.ts`)]
│       ├── Reglas de aparición: no aparece durante los primeros 60s de partida y límite estricto de máx. 3 en pantalla
│       └── Mecánica de Esquiva: dash lateral instantáneo cuando un proyectil entra en su radio de proximidad (cooldown de 4s completamente vulnerable)
│
├── v0.10.1 — Sistema de Golpes Críticos, Nerf RNG a 'Robo de Ancho de Banda' y Corrección Física de Pinball
│   ├── [Sistema de Golpes Críticos (`Player.ts`, `CombatSystem.ts`, `CompanionPet.ts`, `Game.ts`)]
│   │   ├── Probabilidad base del 5% en todos los ataques para infligir el doble de daño (2x / 200%)
│   │   └── Visualización de números de daño crítico en color amarillo (`#facc15`) y mayor tamaño (`1.35x`)
│   ├── [Nerf a 'Robo de Ancho de Banda' (`UpgradeSystem.ts`, `Game.ts`)]
│   │   └── Cambiado a activación por RNG: 10% de probabilidad de activar el efecto de curación al cumplirse la condición
│   └── [Corrección Física de Morcillita Rama 3 - Pinball (`CompanionPet.ts`)]
│       └── Eliminados los rebotes en bucle infinito: al rebotar en bordes o enemigos se aplica una desviación angular aleatoria de +/- 15° a 45°
│
├── v0.10.2 — Rebote Inteligente 50% Auto-Aim en Protocolo Pinball
│   └── [Física de Pinball (`CompanionPet.ts`)]
│       ├── 50% de probabilidad en cada rebote (borde o enemigo) de apuntar directamente al enemigo más cercano en pantalla
│       └── 50% de probabilidad restante manteniendo el rebote con deflexión angular caótica (+/- 15° a 45°)
│
├── v0.10.3 — Nerf a Robo de Ancho de Banda (5% RNG) y Pinball 100% Auto-Aim
│   ├── [Nerf a 'Robo de Ancho de Banda' (`UpgradeSystem.ts`, `Game.ts`)]
│   │   └── Probabilidad de activación por RNG reducida del 10% al 5% para prevenir curación desmedida en late game
│   └── [Física de Pinball 100% Auto-Aim (`CompanionPet.ts`)]
│       └── 100% de auto-apuntado hacia el enemigo más cercano en todos los rebotes (bordes y enemigos), eliminando por completo la deflexión caótica
│
├── v0.11.0 — Escalado Lineal de Vida, Micro-Oleadas de Flanco y Parche Integral de Balance
│   ├── [Rework de Vida y Spawner (`Spawner.ts`)]
│   │   ├── Sustituido el escalado exponencial por escalado lineal (+8% multiplicador de HP por nivel tras el nivel 6)
│   │   ├── Vida del enemigo básico rojo (Adware) limitada estrictamente a un máximo de 2.5x base HP
│   │   └── Micro-oleadas de flanco: aparición cada 15-20s de un grupo de 4-6 enemigos rojos por el mismo borde
│   └── [Parche Integral de Armas y Mejoras (`UpgradeSystem.ts`, `CompanionPet.ts`)]
│       ├── Overclock de Memoria: reducido a +20% XP por nivel (máx. +100%)
│       ├── Overclocking.exe: reducción de cooldown a -14% por nivel y tope mínimo fijado en 0.18s
│       ├── Multithreading.dll: reducido nivel máximo de 5 a 3 (máx. 4 proyectiles simultáneos)
│       ├── Heuristic_Scan (Deepscan): escalado reducido a +10 DMG por nivel (máx. 75 DMG)
│       ├── Sinapsis de Mascota: reducido a +5 DMG por nivel y tope de 5 niveles (máx. +25 DMG)
│       ├── Fiber Optic Bus: incremento de velocidad reducido a +10% por nivel (máx. +50%)
│       ├── Cortafuegos: escalado reducido a +8 DMG por nivel y cooldown mínimo fijado en 1.8s
│       ├── Rayo SQL: escalado reducido a +12 DMG por nivel (máx. 86 DMG)
│       ├── Morcillita Rama 1: Onda de Choque de nivel 20 reducida del 145% al 100% del daño letal
│       └── Morcillita Rama 3 (Pinball): daño base de contacto reducido a 22 DMG y proyectiles cinéticos al 45% (máx. 10 DMG)
│
├── v0.12.0 — Indicadores UI de Élite/Jefes, Barras de HP de Élites, Power-ups Raros y Screen Shake Táctico
│   ├── [Indicadores Fuera de Pantalla (`Game.ts`)]
│   │   ├── Flechas rojas parpadeantes en los bordes de la pantalla señalando enemigos Élite o Jefes fuera del viewport
│   │   └── Flecha dorada parpadeante apuntando hacia el 'Crypto Miner' cuando se encuentra fuera de pantalla
│   ├── [Barras de Vida de Élites (`Game.ts`)]
│   │   └── Barras de HP minimalistas renderizadas directamente sobre los sprites de Jefes Ransomware, Gusanos Blindados y Evasores
│   ├── [Power-ups Raros Temporales (`PowerUpItem.ts`, `Game.ts`)]
│   │   ├── Logic Bomb (Nuke): aniquila instantáneamente a todos los enemigos básicos en pantalla y suelta sus fragmentos de XP
│   │   ├── System Freeze (Congelación): congela el movimiento de todos los enemigos durante 4 segundos
│   │   └── Thermal Overclock (Frenesí): duplica la cadencia de disparo (2x) y otorga 100% de probabilidad de crítico durante 6 segundos
│   └── [Screen Shake Táctico / Game Feel (`CombatSystem.ts`, `Game.ts`)]
│       ├── Agitado de pantalla sutil activado ÚNICAMENTE cuando el jugador recibe daño o cuando explota un Dron Reactivo
│       └── Prohibición estricta: NO se activa Screen Shake con golpes críticos ni otros eventos no letales
│
├── v0.13.0 — Rework de Mega-Jefes (5 Llaves, Pool Único), Clones de 'El Copiota' y Jefe Final Invencible 'El Toro'
│   ├── [Mecánicas Universales de Mega-Jefes (`BaseBoss.ts`, `Game.ts`, `CompanionPet.ts`)]
│   │   ├── Armas y ataques del jugador completamente desactivados durante cualquier combate de Mega-Jefe estándar
│   │   ├── Reducido el número de llaves necesarias para derrotar a un Mega-Jefe a exactamente 5 (1250 HP / 250 DMG por llave)
│   │   ├── Eliminado el atajo de teclado 'B' para invocación manual de jefes
│   │   └── Seguimiento de variantes derrotadas: cada aparición selecciona aleatoriamente solo entre los Mega-Jefes aún no derrotados (4 únicos)
│   ├── [Actualización de 'El Copiota' (`SpecialBosses.ts`)]
│   │   └── Nuevo ataque "Ctrl+C / Ctrl+V": cada 8 segundos genera 3 clones digitales glitch que persiguen al jugador, infligen daño de contacto y desaparecen tras 5 segundos
│   └── [Jefe Final Invencible: 'El Toro' (`ElToroBoss.ts`, `Spawner.ts`, `Game.ts`)]
│       ├── Al derrotar al 4.º Mega-Jefe único se detienen todos los temporizadores de élites/especiales/jefes y aparece inmediatamente "El Toro" en el mapa normal
│       ├── Mientras "El Toro" está activo solo pueden aparecer enemigos rojos básicos (Adware), limitados estrictamente a un máximo de 15 simultáneos en pantalla
│       ├── Armas del jugador habilitadas; "El Toro" es invencible (su HP nunca llega a 0), inflige exactamente el 50% del HP máximo por contacto, escala velocidad cada 15s y embiste cada 10s tras 1.5s de telegrafiado
│       └── UI exclusiva de Jefe Final que muestra en tiempo real el daño numérico total acumulado infligido al Toro
│
├── v0.14.0 — Autenticación con Google vía Firebase y Conexión a Firestore
│   ├── [Configuración e Instancias Globales de Firebase (`firebase.ts`)]
│   │   └── Inicialización y exportación global de `app`, `auth` (`getAuth`), `db` (`getFirestore`) y `googleProvider` (`GoogleAuthProvider`)
│   ├── [Autenticación con Google en el Menú Principal (`Game.ts`)]
│   │   ├── Botón de inicio de sesión con Google en el Menú Principal mediante `signInWithPopup`
│   │   ├── Persistencia de sesión automática al recargar la página mediante `onAuthStateChanged`
│   │   └── Actualización dinámica de la UI del Menú Principal mostrando el `displayName` del usuario autenticado y botón para cerrar sesión (`signOut`)
│   └── [Preparación de Firestore (`firebase.ts`, `Game.ts`)]
│       └── Instancia `db` verificada y preparada para operaciones de lectura/escritura de guardado en la nube y clasificación global
│
├── v0.15.0 — Guardado en la Nube (Cloud Saving) con Firestore
│   ├── [Estructura de Datos en Firestore (`MetaSystem.ts`, `firebase.ts`)]
│   │   ├── Colección raíz `users` utilizando el `uid` del usuario autenticado como ID del documento
│   │   └── Almacenamiento completo del progreso persistente: High Score (`highScore`, `bestTimeSeconds`), Monedas (`coins`) y Mejoras/Desbloqueos de Tienda (`unlockedCharacters`, `selectedCharacter`, `unlockedHats`, `equippedHatId`)
│   ├── [Lógica de Carga / Sync Down (`MetaSystem.ts`, `Game.ts`)]
│   │   ├── Al iniciar sesión en `onAuthStateChanged`, obtención automática del documento desde `users/{uid}` y sincronización con el estado activo del juego
│   │   └── Si el documento no existe (primer inicio de sesión), creación automática en Firestore con los valores locales o por defecto actuales
│   └── [Lógica de Guardado / Sync Up & Fallback de Invitado (`MetaSystem.ts`, `Game.ts`)]
│       ├── Guardado automático en Firestore inmediatamente al morir el jugador (estado `GAMEOVER`) e inmediatamente tras comprar/equipar cualquier mejora o elemento en la Tienda/Gacha
│       └── Modo Invitado (Fallback): si no hay usuario autenticado, se omite Firestore por completo y se mantiene el uso normal de `localStorage`
│
├── v0.16.0 — Clasificación Mundial Dual (Dual Global Leaderboards: Daño al Toro y Tiempo de Supervivencia)
    ├── [Seguimiento de Datos y Sincronización (`MetaSystem.ts`, `Game.ts`)]
    │   ├── Seguimiento de `maxDamageToToro` (daño total infligido al Jefe Final "El Toro" en una misma partida)
    │   ├── Actualización de `syncToCloud` para guardar `maxDamageToToro` y `bestTimeSeconds` sobrescribiendo únicamente cuando la nueva marca supera estrictamente al récord guardado
    │   └── Escritura explícita del `displayName` de Google del usuario autenticado (con fallback `"Survivor"`) en el documento de Firestore
    ├── [Consultas a Firestore (`MetaSystem.ts`)]
    │   ├── `fetchTopToroDamageLeaderboard`: Top 10 jugadores ordenados por `maxDamageToToro` (descendente)
    │   └── `fetchTopSurvivalTimeLeaderboard`: Top 10 jugadores ordenados por `bestTimeSeconds` (descendente)
    └── [Interfaz de Clasificación Global (`Game.ts`)]
        ├── Botón `"Global Rankings"` añadido al Menú Principal
        ├── Overlay interactivo con pestañas `"Top Damage to Toro"` y `"Best Survival Time"` mostrando Rango (#1-#10), Nombre y Métrica
        └── Botón `"Back"` para regresar al Menú Principal
│
├── v0.16.1 — Normalización de Viewport (1080p), Tab por Defecto en Rankings y Balanceo de Enemigos
│   ├── [Normalización de Viewport y Spawns (`Game.ts`, `style.css`)]
│   │   ├── Resolución lógica fija de 1920x1080 en el canvas y escalado CSS con `object-fit: contain`
│   │   ├── Mapeo preciso de coordenadas de ratón considerando letterbox/pillarbox para cualquier relación de aspecto
│   │   └── Spawns de enemigos y límites de pantalla estandarizados a las dimensiones lógicas fijas
│   ├── [Actualización de UI de Clasificación (`Game.ts`)]
│   │   └── Pestaña "Best Survival Time" configurada como pestaña activa predeterminada al abrir los Rankings Globales
│   ├── [IA y Balanceo de Enemigos (`CryptoMiner.ts`, `ElToroBoss.ts`, `Spawner.ts`)]
│   │   ├── Minero de Criptos (Loot Goblin): deslizamiento por bordes y deflexión angular para evitar atascos en esquinas
│   │   ├── Jefe Final "El Toro": velocidad base de persecución a pie aumentada (122 -> 175 px/s) sin alterar embestida ni telegrafiado
│   │   └── Enemigos Rojos (Adware): escalado progresivo de vida (+7%/min hasta 3.8x) y velocidad (+4.5 px/s/min hasta +48) a lo largo de la partida
│   └── [Optimizaciones Autónomas (`CompanionPet.ts`, `ElToroBoss.ts`)]
│       └── Eliminadas dependencias residuales de `window.innerWidth/innerHeight` en las entidades del juego
│
├── v1.0.0 — Versión Oficial 1.0 (BGM Procedimental, Desglose Estadístico, Logros, Ajustes y Deploy Hosting)
    ├── [Música y Audio Web Audio API (`SoundSystem.ts`)]
    │   ├── BGM procedimental sintetizado en tiempo real con 4 pistas dinámicas: MENÚ, EN PARTIDA, JEFE y JEFE FINAL
    │   └── Controles independientes de volumen: Master, BGM y SFX con persistencia local
    ├── [Pantalla Post-Partida Expandida (`Game.ts`, `CombatSystem.ts`)]
    │   ├── Desglose exhaustivo de daño total y porcentaje relativo por cada una de las 7 armas
    │   ├── Barras gráficas proporcionales codificadas por colores cibernéticos
    │   └── Conteo detallado de bajas por familia de malware (Adware, Troyanos, Gusanos, Evasores, Jefes)
    ├── [Sistema de Hitos y Logros (`AchievementSystem.ts`)]
    │   ├── 12 logros con seguimiento de progreso, recompensas en Criptomonedas y notificaciones toast animadas
    │   └── Overlay accesible con la tecla [A] o botón en el Menú Principal
    ├── [Menús de Opciones y Tutorial (`Game.ts`)]
    │   ├── Panel de Ajustes [O] con deslizadores de volumen, conmutador de Screen Shake y pantalla completa
    │   └── Manual Ciber-Antivirus [H] con guía de controles, arsenal y reglas clave de jefes
    └── [Despliegue y Hosting de Producción (`firebase.json`, `.firebaserc`, `package.json`)]
        ├── Configuración oficial de Firebase Hosting para el proyecto `survivor-daw`
        └── Script `npm run deploy` automatizado para compilación y despliegue
│
├── v1.0.1 — Rediseño HUD Menú, Pantalla Completa Destacada y Tarjetas de Mejora Sin Desborde
│   ├── [Rediseño Espacial del Menú Principal (`Game.ts`)]
│   │   ├── Esquina superior izquierda: Perfil de Agente y autenticación Google (eliminado emoji verde)
│   │   ├── Esquina superior derecha: Botón destacado de Pantalla Completa [F], Rankings [R], Logros [A] y Ajustes [O]
│   │   └── Caja central (Kernel Hub): Liberada de botones comprimidos, ganando amplitud y espacio vertical óptimo
│   └── [Tarjetas de Mejora de Nivel (`UpgradeSystem.ts`, `Game.ts`)]
│       ├── Textos reducidos y concisos de descripción en las 17 tarjetas para lectura instantánea
│       ├── Nueva subcaja visual de estadísticas (`statBadge`) mostrando incrementos (▲) y reducciones de enfriamiento (▼)
│       └── Dimensiones ampliadas a 350x270px garantizando que ningún texto desborde ni tape los bordes de la tarjeta
│
└── v1.1.0 — Segunda Página de Logros Difíciles, Selector de Idioma (ES/EN) y Badge Actualizado (ACTUAL)
    ├── [Segunda Página de Logros Épicos (`AchievementSystem.ts`, `Game.ts`)]
    │   ├── Expansión del sistema a 24 logros en total repartidos en 2 fases con selector de pestañas [1] y [2]
    │   ├── Fase I (1 a 12): Protocolos del Kernel estándar
    │   └── Fase II (13 a 24): Desafíos Épicos de alta dificultad (hasta 15 min, 1200 kills, 250k daño a El Toro, cosméticos míticos) con recompensas masivas (150 a 500 Criptomonedas)
    ├── [Sistema de Internacionalización Reactivo (`i18n.ts`, `Game.ts`)]
    │   ├── Apartado en Ajustes [O] para conmutar idioma entre Español [ES] e Inglés [EN]
    │   ├── Persistencia automática en `localStorage` (`cyber_survivor_lang`)
    │   └── Traducción reactiva en tiempo real de menús, botones, HUD, logros, ajustes, pausa y pantalla final
    └── [Versionado y Visibilidad]
        └── Identificador `v1.1.0` renderizado con badge de brillo en la esquina inferior derecha y sincronizado en git
```

---

## Historial Detallado de Versiones

### [v1.1.0] - 2026-11-05
- **Segunda Página de Logros y Desafíos Épicos (`src/systems/AchievementSystem.ts`, `src/core/Game.ts`)**:
  - Ampliado el catálogo de logros de 12 a **24 logros únicos**:
    - **Fase I // Protocolos (1 a 12)**: Hitos base de supervivencia, desbloqueo y primeros combates.
    - **Fase II // Desafíos Épicos (13 a 24)**: Objetivos avanzados para jugadores experimentados con altas recompensas en Criptomonedas (150 a 500 🪙):
      - `Purga Extrema` (1.200 malwares en una partida - +200 🪙).
      - `Inmortal del Kernel` (10 minutos de supervivencia - +250 🪙).
      - `Dios del Ciberespacio` (15 minutos de supervivencia - +500 🪙).
      - `Overclock Supremo` (Nivel 30 en una partida - +200 🪙).
      - `Domador Cibernético` (100.000 de daño infligido a El Toro - +300 🪙).
      - `Pesadilla del Toro` (250.000 de daño infligido a El Toro - +500 🪙).
      - `Cazador de Titanes` (10 jefes o mega-jefes derrotados en una partida - +250 🪙).
      - `Avaricia de Silicio` (30 Cajas de Hardware destruidas - +150 🪙).
      - `Magnate Cripto` (5 Mineros de Criptos eliminados - +200 🪙).
      - `Coleccionista Cyber` (20 sombreros/máscaras en el inventario - +250 🪙).
      - `Toque de Midas` (Obtener cosmético Mítico o Legendario en Gacha - +400 🪙).
      - `Apocalipsis Binario` (500.000 de daño total infligido en una partida - +350 🪙).
  - Modal de Logros rediseñado con sistema de paginación interactiva: pestañas superiores `[1] FASE I` y `[2] FASE II`, navegables tanto con clic de ratón como con teclado (`1`, `2`, flechas izquierda y derecha).
  - Contador dinámico en el botón del HUD superior: `🏆 [A] LOGROS (X/24)`.
- **Selector de Idioma (Español / Inglés) en Ajustes (`src/utils/i18n.ts`, `src/core/Game.ts`)**:
  - Módulo `i18n` reactivo con persistencia local en `localStorage`.
  - Nueva sección visual en el menú de Ajustes (`[O]`): botones interactivos `[ ESPAÑOL ]` y `[ ENGLISH ]` con indicador de selección activa y brillo de borde.
  - Soporte bilingüe integral en: barra superior de herramientas, perfil de agente y autenticación, tabs de personajes/gacha/inventario, botón de despliegue, menú de pausa, pantalla de fallo de sistema (Game Over), manual de cómo jugar y descripciones de logros.
- **Sincronización de Versión (`v1.1.0`)**:
  - Actualizado el badge de versión en la esquina inferior derecha a `v1.1.0`.
  - Actualizado `package.json` a `"version": "1.1.0"`.

### [v1.0.1] - 2026-11-05
- **Rediseño Espacial del Menú Principal (`src/core/Game.ts`)**:
  - Reubicados los elementos de autenticación y ajustes fuera del panel central:
    - **Esquina Superior Izquierda**: Perfil de usuario (`AGENTE: [Nombre]`) sin emojis residuales y botón de inicio/cierre de sesión Google.
    - **Esquina Superior Derecha**: Botón de acceso directo a **Pantalla Completa (`⛶ [F] PANTALLA COMPLETA`)** con brillo cian neón (accionable con clic o tecla `F`), junto a **Rankings Globales (`[R]`)**, **Logros (`[A]`)** y **Ajustes (`[O]`)**.
    - Eliminado el botón visual de `[H] CÓMO JUGAR` para despejar el menú y lograr una estética más limpia y profesional.
  - El panel central (`KERNEL HUB`) queda liberado de 6 botones que estaban apiñados en dos filas intermedias, permitiendo que las tarjetas de personajes, el gacha y el inventario respiren con márgenes equilibrados.
- **Tarjetas de Nivel y Estadísticas (`src/systems/UpgradeSystem.ts`, `src/core/Game.ts`)**:
  - Rediseñadas las 17 tarjetas de mejora con descripciones reducidas y directas.
  - Añadido el atributo `statBadge` a cada tarjeta, renderizando una subcaja destacada que indica con precisión las estadísticas mejoradas (`▲`) o disminuidas (`▼`, ej: cooldowns).
  - Dimensiones de tarjeta aumentadas a 350x270px para garantizar holgura total y cero desbordamientos fuera de la caja.

### [v1.0.0] - 2026-11-04
- **Música Procedimental y Sistema de Audio (`src/core/SoundSystem.ts`, `src/core/Game.ts`)**:
  - Implementado motor de BGM sintetizado en tiempo real con Web Audio API (bombos con pitch glide, cajas de ruido blanco filtrado, charles estocásticos y líneas de bajo/arpegios synthwave).
  - 4 pistas dinámicas sincronizadas con el flujo del juego: `MENU` (tema cibernético lento), `INGAME` (cyber-synth de 128 BPM), `BOSS` (ritmo tenso acelerado de 142 BPM con bajos pesados) y `FINAL_BOSS` (frenesí oscuro de 154 BPM con arpegios menores disonantes).
  - Control de volumen granular e independiente (`Master`, `BGM`, `SFX`) y persistencia automática en `localStorage`.
- **Desglose Estadístico Post-Partida (`src/systems/CombatSystem.ts`, `src/core/Game.ts`)**:
  - Reemplazada la pantalla simple de Game Over por un informe de telemetría de 2 columnas.
  - Columna 1: Desglose de daño total infligido y porcentaje relativo por arma (`Ráfaga Firewall`, `Ping Tracker`, `Zona Cuarentena`, `Cortafuegos`, `Rayo SQL`, `Drones Antivirus`, `Mascota Morcillita`) con barras de progreso de color.
  - Columna 2: Censo de malware eliminado clasificado por tipología (Adware, Troyano, Gusano, Evasor, Caja de Hardware, Mega-Jefes).
- **Sistema de Logros y Hitos (`src/systems/AchievementSystem.ts`)**:
  - 12 logros desbloqueables con metas cuantitativas (ej. Primer Parche, Purgador Masivo, Coleccionista de Hardware, Caza-Minero, Derrota de Mega-Jefes, Encuentro con El Toro, Daño al Toro 10k y 50k, Supervivencia 3m y 6m, Nivel 20).
  - Recompensas económicas en Criptomonedas integradas directamente con `MetaSystem` y persistidas local y remotamente.
  - Sistema de notificaciones *toast* cibernéticas en pantalla con animaciones de entrada/salida y destellos de partículas.
  - Overlay interactivo `[A] LOGROS` accesible desde el Menú Principal.
- **Paneles de Ajustes y Guía Rápida (`src/core/Game.ts`)**:
  - Overlay `[O] AJUSTES`: Controles interactivos con barra deslizadora para Volumen Maestro, Música y Efectos de Sonido, conmutador para Screen Shake y botón de alternancia a Pantalla Completa.
  - Overlay `[H] CÓMO JUGAR`: Guía táctica detallada que documenta controles (WASD/Flechas, Pausa P), mecánicas de armas, la regla de las 5 llaves para Mega-Jefes y la naturaleza invencible de "El Toro".
  - Barra de herramientas secundaria en el Menú Principal con botones interactivos `[A] LOGROS`, `[O] AJUSTES` y `[H] CÓMO JUGAR`.
- **Despliegue y Producción (`firebase.json`, `.firebaserc`, `package.json`)**:
  - Vinculación oficial del hosting de Firebase a `survivor-daw` con enrutamiento SPA (`index.html`) y caché optimizado para la carpeta `dist`.
  - Añadido el comando `npm run deploy` en `package.json` para compilar y desplegar con una sola orden.

### [v0.16.1] - 2026-11-04
- **Normalización de Viewport y Spawns (`src/core/Game.ts`, `src/style.css`)**:
  - Fijada la resolución lógica interna del canvas en 1920x1080 (`LOGICAL_WIDTH` y `LOGICAL_HEIGHT`) para garantizar equidad competitiva.
  - Implementado escalado CSS (`100vw`, `100vh`, `object-fit: contain`) centrado con fondo negro para adaptarse a cualquier resolución física.
  - Añadido cálculo matemático de compensación de letterbox/pillarbox en `getCanvasMousePos()` para que los clics y el cursor coincidan píxel a píxel independientemente de la relación de aspecto del monitor.
  - Estandarizadas las fronteras de spawn y patrulla de enemigos a los límites lógicos de 1920x1080.
- **Pestaña por Defecto en Clasificación Global (`src/core/Game.ts`)**:
  - Modificado el estado inicial y el método `openLeaderboardOverlay()` para que la pestaña `"Best Survival Time"` sea estrictamente la activa por defecto cada vez que se abre el panel de Rankings Globales.
- **IA y Balanceo de Enemigos (`src/entities/CryptoMiner.ts`, `src/entities/ElToroBoss.ts`, `src/systems/Spawner.ts`)**:
  - **Loot Goblin (`CryptoMiner.ts`)**: Actualizada la física de huida incorporando deflexión en esquinas y deslizamiento suave sobre bordes para impedir que quede bloqueado en los ángulos del mapa.
  - **Jefe Final 'El Toro' (`src/entities/ElToroBoss.ts`)**: Incrementada la velocidad base de persecución a pie de 122 px/s a 175 px/s para aumentar la presión constante, manteniendo intactos el telegrafiado de 1.5s, la velocidad de embestida de 780 px/s y sus mecánicas de ataque.
  - **Enemigos Rojos (`src/systems/Spawner.ts`)**: Implementado escalado progresivo de Adware rojo en función del tiempo transcurrido (multiplicador de vida hasta 3.8x y bonificación de velocidad de hasta +48 px/s) para que mantengan relevancia en mid y late game.
- **Optimizaciones Autónomas (`src/entities/CompanionPet.ts`, `src/entities/ElToroBoss.ts`)**:
  - Reemplazadas todas las referencias a `window.innerWidth/innerHeight` en entidades por las fronteras lógicas fijas de 1920x1080.
  - Versión actualizada a `v0.16.1` en `package.json`, `src/core/Game.ts` y `ROADMAP.md`.

### [v0.16.0] - 2026-11-03
- **Seguimiento de Datos y Sincronización (`src/systems/MetaSystem.ts`, `src/core/Game.ts`)**:
  - Añadido registro de `maxDamageToToro` (daño total infligido al Jefe Final "El Toro" en una sola partida).
  - Actualizado `syncToCloud` para almacenar `maxDamageToToro` y `bestTimeSeconds` en el documento `users/{uid}` de Firestore, sobrescribiendo únicamente si el valor de la nueva partida es estrictamente mayor que el valor guardado.
  - Guardado explícito del `displayName` de Google del jugador autenticado (con fallback `"Survivor"`) en su documento de Firestore.
- **Consultas de Clasificación en Firestore (`src/systems/MetaSystem.ts`)**:
  - Creadas dos funciones de consulta independientes sobre la colección `users`:
    - `fetchTopToroDamageLeaderboard()`: Top 10 jugadores ordenados por `maxDamageToToro` (`desc`).
    - `fetchTopSurvivalTimeLeaderboard()`: Top 10 jugadores ordenados por `bestTimeSeconds` (`desc`).
- **Interfaz de Clasificación Global (`src/core/Game.ts`)**:
  - Añadido botón `"Global Rankings"` en el Menú Principal.
  - Implementado overlay de Clasificación Global (`drawLeaderboardOverlay`) con dos pestañas (`"Top Damage to Toro"` y `"Best Survival Time"`), mostrando Puesto (`#1`–`#10`), Nombre (`displayName`) y la métrica correspondiente, junto con un botón `"Back"` para volver al Menú Principal.

### [v0.15.0] - 2026-11-03
- **Estructura de Datos en Firestore (`src/systems/MetaSystem.ts`, `src/firebase.ts`)**:
  - Uso directo de las instancias globales `db` y `auth` exportadas desde `src/firebase.ts`.
  - Colección raíz `users` indexada por el `uid` del usuario autenticado (`users/{uid}`), almacenando `highScore`, `bestTimeSeconds`, `coins`, `unlockedCharacters`, `selectedCharacter`, `unlockedHats` y `equippedHatId`.
- **Sincronización de Bajada / Load Logic (`src/systems/MetaSystem.ts`, `src/core/Game.ts`)**:
  - Dentro del listener `onAuthStateChanged`, al autenticarse un usuario se descarga su documento de `users/{uid}` (`loadFromCloud`) y se aplica directamente al estado activo de la partida y del menú.
  - Si el documento aún no existe (primer login del usuario), se crea automáticamente en Firestore inicializándolo con el progreso local actual o los valores por defecto.
- **Sincronización de Subida / Save Logic & Modo Invitado (`src/systems/MetaSystem.ts`, `src/core/Game.ts`)**:
  - Actualización automática del documento de Firestore en dos disparadores específicos: inmediatamente al morir el jugador (`GAMEOVER`) e inmediatamente tras adquirir o cambiar cualquier mejora/agente/sombrero en la Tienda.
  - Fallback para invitados: cuando no hay sesión iniciada (`!auth.currentUser`), se omite Firestore por completo y el juego opera con normalidad mediante `localStorage`.

### [v0.14.0] - 2026-11-03
- **Configuración de Firebase y Dependencias (`package.json`, `src/firebase.ts`)**:
  - Instalada la dependencia oficial `firebase`.
  - Creado el módulo `src/firebase.ts` con la configuración del proyecto `survivor-daw` e inicializadas y exportadas globalmente las instancias `app`, `auth` (`getAuth`), `db` (`getFirestore`) y `googleProvider` (`GoogleAuthProvider`).
- **Autenticación con Google en el Menú Principal (`src/core/Game.ts`)**:
  - Implementado botón de inicio de sesión con Google en el Menú Principal utilizando `signInWithPopup`.
  - Suscripción a `onAuthStateChanged` para mantener la sesión activa automáticamente tras recargar la página.
  - Actualización dinámica de la interfaz del Menú Principal para mostrar el nombre (`displayName`) del agente autenticado y un botón interactivo de cierre de sesión (`signOut`).
- **Preparación de Firestore (`src/firebase.ts`, `src/core/Game.ts`)**:
  - Verificada la instancia exportada `db` lista para operaciones de lectura y escritura en las próximas fases del roadmap (Cloud Save y Leaderboards).

### [v0.13.0] - 2026-11-03
- **Mecánicas Universales de Mega-Jefes (`BaseBoss.ts`, `Game.ts`, `CompanionPet.ts`)**:
  - Armas y efectos del jugador completamente deshabilitados durante cualquier Mega-Jefe estándar.
  - Reducida la cantidad requerida de llaves recolectadas para derrotar a un Mega-Jefe a exactamente **5 llaves** (`1250 HP` / `250 DMG`).
  - Eliminada la tecla `B` de invocación manual de jefes.
  - Registro de variantes de Mega-Jefes derrotadas para garantizar apariciones únicas seleccionadas solo entre las variantes pendientes.
- **Actualización de Mega-Jefe 'El Copiota' (`SpecialBosses.ts`)**:
  - Añadido el ataque **"Ctrl+C / Ctrl+V"**: cada 8 segundos genera 3 clones digitales (`DigitalGlitchClone`) que persiguen al jugador, infligen daño de contacto estándar y se desvanecen automáticamente tras 5 segundos.
- **Jefe Final Invencible "El Toro" (`ElToroBoss.ts`, `Spawner.ts`, `Game.ts`)**:
  - En el instante exacto en que cae el 4.º Mega-Jefe único, se detienen todos los temporizadores de aparición de élites, especiales y jefes normales, e irrumpe inmediatamente **"El Toro"** en el mapa normal.
  - Durante esta fase únicamente siguen apareciendo enemigos básicos rojos (`Adware`), con un tope estricto de **15 en pantalla simultáneamente**.
  - Las armas del jugador están **habilitadas**; **El Toro** tiene tamaño colosal y rasgos visuales taurinos, es **invencible** (su HP no baja a 0 y no muere), inflige exactamente el **50% de la vida máxima del jugador** por contacto, aumenta su velocidad de movimiento cada **15 segundos** y cada **10 segundos** se detiene **1.5 segundos** para telegrafiar y ejecutar una embestida masiva a alta velocidad hacia la posición del jugador.
  - Añadida interfaz dedicada (`drawBossHUD`) visible únicamente mientras el Jefe Final está activo, mostrando continuamente el **daño numérico total acumulado** infligido al Toro.

### [v0.12.0] - 2026-11-02
- **Indicadores Fuera de Pantalla (`Game.ts`)**:
  - Implementación de flechas de advertencia parpadeantes en los bordes de la pantalla para señalar enemigos peligrosos fuera del campo de visión.
  - Flechas rojas para enemigos Élite (`RansomwareBoss`, `ArmoredWorm`, `Evasor`) y Mega-Jefes (`MegaBoss`).
  - Flecha dorada especial orientada hacia el `CryptoMiner`.
- **Barras de Vida Minimalistas para Élites (`Game.ts`)**:
  - Renderizado de barra de vida sobre los sprites de todos los enemigos Élite (`RansomwareBoss`, `ArmoredWorm`, `Evasor`), con código de colores según el porcentaje de vida restante (verde/amarillo/rojo).
- **Power-ups Raros Temporales (`PowerUpItem.ts`, `Game.ts`)**:
  - Introducción de la entidad coleccionable `PowerUpItem` con baja probabilidad de drop (1% en enemigos básicos, 25% en Cajas de Hardware):
    - **Logic Bomb (Bomba Lógica)**: Elimina de inmediato a todos los enemigos estándar en pantalla conservando íntegro su drop de fragmentos de XP.
    - **System Freeze (Congelación de Sistema)**: Detiene por completo el movimiento y comportamiento enemigo durante 4 segundos con overlay glacial.
    - **Thermal Overclock (Frenesí Térmico)**: Otorga 6 segundos de doble velocidad de ataque (+100% fire rate) y 100% de probabilidad de impacto crítico garantizado.
- **Screen Shake Táctico & Game Feel (`CombatSystem.ts`, `Game.ts`)**:
  - El efecto de vibración / temblor de cámara se limita de forma estricta y exclusiva a dos situaciones: cuando el jugador recibe daño directo o cuando se detona la onda expansiva de un Dron Reactivo destruido (`combatEvents.droneExploded`).
  - Eliminado cualquier screen shake en golpes críticos, recolección de monedas o impactos secundarios.

### [v0.11.0] - 2026-11-02
- **Rework de Vida y Spawner (`Spawner.ts`)**:
  - Reemplazado el escalado exponencial por **escalado lineal (+8% por nivel tras nivel 6)**, evitando picos astronómicos de HP en late game.
  - La vida del enemigo básico rojo (**Adware**) queda limitada estrictamente a un **máximo de 2.5x base HP** (~62 HP máx), permitiendo que las armas sigan limpiando masas rápidamente.
  - Añadidas **micro-oleadas de flanco** cada 15-20 segundos generando grupos coordinados de **4 a 6 enemigos rojos** por un mismo borde exterior del mapa.
- **Balance Integral de Mejoras y Armas (`UpgradeSystem.ts`, `CompanionPet.ts`)**:
  - **Overclock de Memoria**: Reducido a `+20% XP` por nivel (máx. +100% XP).
  - **Overclocking.exe**: Cooldown reducido a `-14%` por nivel y tope mínimo de enfriamiento establecido en `0.18s`.
  - **Multithreading.dll**: Nivel máximo recortado de 5 a **3** (máximo 4 proyectiles simultáneos).
  - **Heuristic_Scan (Deepscan)**: Daño por nivel reducido a `+10 DMG` (máx. 75 DMG), manteniendo +60px de rango.
  - **Sinapsis de Mascota**: Daño reducido a `+5 DMG` por nivel y niveles máximos limitados a **5** (máx. +25 DMG acumulado).
  - **Fiber Optic Bus**: Velocidad reducida a `+10%` por nivel (máx. +50%).
  - **Cortafuegos**: Daño reducido a `+8 DMG` por nivel y cooldown mínimo elevado a `1.8s`.
  - **Rayo SQL**: Daño reducido a `+12 DMG` por nivel.
  - **Morcillita Rama 1 (Fuerza Bruta)**: Onda de choque de nivel 20 ajustada del 145% al `100%` del daño letal.
  - **Morcillita Rama 3 (Pinball)**: Daño base de contacto reducido de 30 a **22 DMG** y daño de proyectiles cinéticos ajustado del 65% al **45%** del daño base.

### [v0.10.3] - 2026-10-30
- **Balanceado (`UpgradeSystem.ts`, `Game.ts` - Nerf a 'Robo de Ancho de Banda')**:
  - Probabilidad de activación reducida del **10% al 5%** en cada impacto/baja para equilibrar la regeneración de vida en fases avanzadas.
- **Mejorado (`CompanionPet.ts` - Pinball 100% Auto-Aim en Rama 3)**:
  - En cada rebote (contra un borde del mapa o contra un enemigo), la nueva trayectoria apunta **100% directamente hacia el enemigo más cercano** en pantalla, eliminando totalmente la deflexión angular caótica aleatoria.

### [v0.10.2] - 2026-10-30
- **Mejorado (`CompanionPet.ts` - Rebote de Morcillita Rama 3 'Protocolo Pinball')**:
  - Implementada un **50% de probabilidad** en cada rebote (tanto contra bordes del mapa como contra enemigos) de reorientar su trayectoria directamente hacia el **enemigo más cercano** en pantalla.
  - El **50% restante** conserva la física de deflexión angular caótica aleatoria (`+/- 15° a 45°`).

### [v0.10.1] - 2026-10-30
- **Añadido (`Player.ts`, `CombatSystem.ts`, `CompanionPet.ts`, `Game.ts` - Sistema de Golpes Críticos)**:
  - Todos los ataques cuentan con un **5% de probabilidad base** de infligir **2x (200%) de daño**.
  - Los impactos críticos se muestran en pantalla en color amarillo brillante (`#facc15`) y con un tamaño mayor (`1.35` frente a `0.95` del texto de daño normal).
- **Balanceado (`UpgradeSystem.ts`, `Game.ts` - Nerf a `'Robo de Ancho de Banda'`)**:
  - Cambiado de activación garantizada a probabilística (**RNG del 10%**) para activar la curación cuando se cumple la condición.
- **Corregido (`CompanionPet.ts` - Física de Rebote en Rama 3 `'Protocolo Pinball'`)**:
  - Corregidos los rebotes en bucle infinito: al rebotar contra un borde de la pantalla o contra un enemigo, la trayectoria ya no solo invierte su eje sino que aplica una desviación angular aleatoria de **`+/- 15° a 45°`**, recorriendo dinámicamente toda la pantalla.

### [v0.10.0] - 2026-10-30
- **Añadido (`MetaSystem.ts`, `Game.ts` - High Score Local)**:
  - Guardado persistente en `localStorage` de la máxima puntuación/tiempo y visualización de `"High Score: [Value]"` en el Menú Principal.
- **Rediseñado (`CombatSystem.ts`, `UpgradeSystem.ts` - Drones como Escudo Reactivo)**:
  - Los drones orbitan al jugador e interceptan enemigos evitando que dañen al jugador (`0` daño recibido).
  - Cada dron tiene **3 puntos de durabilidad**, cambiando de color según su estado (`Verde` → `Amarillo` → `Rojo`).
  - Al **3er impacto**, el dron explota infligiendo daño en área (**AoE**) a los enemigos cercanos y entra en un tiempo de recarga de **10 segundos** antes de reaparecer.
- **Añadido (`Evasor.ts`, `Spawner.ts`, `CombatSystem.ts`, `Adware.ts` - Nuevo Enemigo `'Evasor'` / Ghost Script)**:
  - No aparece durante los primeros **60 segundos** de partida y tiene un límite estricto de **máximo 3** en pantalla.
  - Persigue al jugador y, cuando un proyectil entra en su radio de proximidad, ejecuta un **dash lateral instantáneo** para esquivarlo, entrando en un **cooldown de 4 segundos** durante el cual es totalmente vulnerable.

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
