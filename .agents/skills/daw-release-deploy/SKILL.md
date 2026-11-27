---
name: daw-release-deploy
description: >-
  Runbook completo para versionar, documentar en ROADMAP.md, compilar y desplegar
  DAW-SURVIVOR a Firebase Hosting y a itch.io. Usar al finalizar cualquier cambio,
  corrección o nueva funcionalidad del juego.
---

# Release y Despliegue — DAW-SURVIVOR

Sigue estos pasos en orden exacto para publicar una nueva versión sin dejar ficheros desincronizados.

## 1. Elegir el incremento SemVer

- **Patch (`x.y.Z`)**: correcciones de bugs, ajustes de balanceo o optimizaciones pequeñas.
- **Minor (`x.Y.0`)**: nuevas mecánicas, armas, enemigos, jefes, arenas, cosméticos o mejoras visuales relevantes.
- **Major (`X.0.0`)**: cambios estructurales grandes o hitos mayores acordados con el usuario.

## 2. Sincronizar el número de versión

Actualiza ambos archivos con exactamente la misma versión:

1. `package.json`: campo `"version"` sin prefijo `v` (ej. `"1.9.1"`).
2. `src/core/Game.ts`: constante `GAME_VERSION` con prefijo `v` (ej. `const GAME_VERSION = 'v1.9.1';`).

## 3. Actualizar `ROADMAP.md`

1. **Árbol visual superior**:
   - Quita `(ACTUAL)` de la versión anterior y cambia su rama `└──` por `├──`.
   - Añade al final del árbol la nueva versión con `└── vX.Y.Z — <Resumen breve> (ACTUAL)` y sus sub-items principales.
2. **Changelog detallado**:
   - Encima de la entrada más reciente (`### [v...]`), añade una nueva sección `### [vX.Y.Z] - YYYY-MM-DD` (fecha actual) listando los cambios agrupados por sistema/archivo afectado.

## 4. Compilar y desplegar (Firebase + itch.io)

Ejecuta desde la raíz del proyecto (`d:\Juego_DAW`):

```powershell
npm run deploy:all
```

Este script ejecuta en cadena:
1. `npm run build` (`tsc && vite build && node scripts/inline-dist.mjs`, generando el single-file `dist/index.html`).
2. `firebase deploy --only hosting`.
3. `.\butler.exe push dist japeco06/cyber-survivor:html5`.

## 5. Subir cambios a GitHub

Una vez verificada la compilación y el despliegue, guarda y sube los cambios al repositorio remoto:

```powershell
git add -A && git commit -m "vX.Y.Z: <resumen breve de los cambios>" && git push
```

## 6. Verificación final

Confirma en la salida de los comandos:
- `✓ Single-file build generated in dist/index.html` sin errores de `tsc` ni de Vite.
- `Deploy complete!` en Firebase Hosting.
- Subida completada sin error en `butler.exe` para el canal `japeco06/cyber-survivor:html5`.
- `git push` completado sin errores en GitHub (`origin`).

Si falla solo uno de los dos destinos (por ejemplo, sesión caducada en Firebase o red en itch.io), informa claramente cuál falló y usa `npm run deploy` o `npm run deploy:itch` para reintentar únicamente el destino pendiente tras resolverlo.
