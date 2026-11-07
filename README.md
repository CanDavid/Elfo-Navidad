# NICO Y LA MAGIA PERDIDA

Juego de plataformas navideño para navegador, creado con Phaser, TypeScript y Vite. El primer nivel, **EL SALÓN DE NAVIDAD**, incluye controles táctiles multidedo, teclado, vuelo, magia, enemigos, punto de control, un camino secreto y una meta en la copa del árbol.

## JUGAR

La versión publicada estará en: <https://candavid.github.io/Elfo-Navidad/>

```bash
npm ci
npm run dev
```

Para comprobar la versión de producción:

```bash
npm run build
npm run preview
```

## CONTROLES

- **MÓVIL/TABLETA:** botones ◀/▶, **SALTAR** y **MAGIA**. Se pueden mantener varios a la vez.
- **TECLADO:** flechas o A/D para correr, espacio para saltar y volar, X para lanzar magia y Escape para pausar.
- Mantén SALTAR para ganar altura. Pulsa SALTAR otra vez en el aire y mantenlo para volar hasta dos segundos.

## AÑADIR NIVELES

Los datos de geometría, chispas, enemigos, tutoriales y meta están en `src/level.ts`. El movimiento, combate, interfaz y renderizado están en `src/main.ts`. Para incorporar otro escenario, crea un nuevo objeto de datos con la misma estructura y una escena que lo consuma.

La compilación genera un sitio estático en `dist/`. El flujo `.github/workflows/deploy-pages.yml` publica esa carpeta en GitHub Pages al actualizar `main` o al ejecutarlo manualmente.
