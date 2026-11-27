# Reglas del Proyecto — DAW-SURVIVOR

Estas instrucciones son obligatorias en **todas las conversaciones** de este proyecto siempre que se realicen cambios en el juego o en el código fuente.

## 1. Checklist obligatorio de cierre y despliegue

Al terminar de implementar cualquier cambio, corrección o nueva funcionalidad (salvo que el usuario indique explícitamente que no despliegue todavía):

1. **Actualizar el número de versión** (incrementando `patch`, `minor` o `major` según corresponda en SemVer):
   - `package.json` → campo `"version"` (ej. `"1.9.1"`).
   - `src/core/Game.ts` → constante `GAME_VERSION` (ej. `const GAME_VERSION = 'v1.9.1';`).
2. **Actualizar el Roadmap (`ROADMAP.md`)**:
   - Añadir la nueva versión al árbol visual superior, moviendo la etiqueta `(ACTUAL)` a la nueva versión.
   - Añadir la entrada detallada correspondiente en el changelog (`### [vX.Y.Z] - YYYY-MM-DD`) encima de la versión anterior.
3. **Compilar y subir a Firebase Hosting y a itch.io**:
   - Ejecutar `npm run deploy:all` desde la raíz del proyecto (`npm run build && firebase deploy --only hosting && .\butler.exe push dist japeco06/cyber-survivor:html5`).
   - Verificar que tanto la compilación (`tsc && vite build && node scripts/inline-dist.mjs`) como ambos despliegues (Firebase e itch.io) terminan sin errores.
4. **Subir los cambios a GitHub**:
   - Ejecutar `git add -A && git commit -m "vX.Y.Z: <resumen breve>" && git push` para mantener sincronizado el repositorio remoto (`origin`) con cada nueva versión desplegada.

## 2. Reglas técnicas del motor (DAW-SURVIVOR)

- **Rendimiento Canvas 2D (60 FPS)**:
  - Evitar `ctx.shadowBlur` costoso dentro de bucles con muchas entidades; usar efectos aditivos / `VisualFXSystem.ts` y respetar los límites de `ParticleSystem.ts`.
  - Evitar asignaciones innecesarias de objetos, arrays o gradientes complejos por frame dentro de `update()` y `render()`.
- **Build Single-File (`scripts/inline-dist.mjs`)**:
  - El comando `npm run build` empaqueta JS y CSS dentro de un único `dist/index.html` para itch.io y Firebase Hosting. Priorizar gráficos procedurales en Canvas 2D y audio sintetizado en `src/core/SoundSystem.ts` (Web Audio API) en lugar de archivos externos sueltos.
- **Internacionalización (`src/utils/i18n.ts`)**:
  - Todo texto nuevo visible para el jugador (HUD, menús, mejoras, logros, misiones, tienda) debe registrarse en `src/utils/i18n.ts` manteniendo paridad entre idiomas.
- **Multijugador / Co-op**:
  - Si se alteran entidades, estados de partida o jefes relevantes en cooperativo, revisar la sincronización en `src/network/MultiplayerTypes.ts`, `src/network/MultiplayerClient.ts` y `server/index.js`.
- **Tipado estricto**:
  - No introducir errores de TypeScript; `npm run build` ejecuta `tsc` antes de Vite y debe pasar limpio.
