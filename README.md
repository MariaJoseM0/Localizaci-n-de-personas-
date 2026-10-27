# Anto: Operación Presencia

Un juego interactivo de **realidad mixta en el navegador** protagonizado por Anto, el robot de la imagen adjunta. El objetivo es localizar a cinco exploradores ocultos en un mundo generado procedimentalmente que se superpone al espacio real de la cámara.

No hay dependencias externas: HTML, CSS, Canvas 2D, WebAudio, Web Speech API y `getUserMedia`.

## Sitio publicado

🔗 **<https://mariajosem0.github.io/Localizaci-n-de-personas-/>**

Se publica automáticamente en GitHub Pages con el workflow
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) en cada push a `main`.
El juego es estático, así que **no hay paso de compilación**: el workflow ejecuta las
pruebas, empaqueta la raíz del repositorio y la publica con `actions/deploy-pages`.

## Ejecutar en local

```bash
npm start
```

Abre `http://localhost:4173`. Para cambiar el puerto:

```bash
PORT=8080 npm start
```

La cámara y el micrófono requieren `localhost` o HTTPS. En el entorno de vista previa de Arena la URL HTTPS del puerto también es válida. Si el permiso se rechaza, el juego continúa en modo simulación sin perder ninguna mecánica principal.

`server.mjs` solo existe para servir los archivos en local (`Content-Type` correcto para los
módulos ES y `Permissions-Policy` de cámara/micrófono). Para desarrollo también sirve
cualquier servidor estático, porque todas las rutas son relativas:

```bash
python3 -m http.server 4173    # o: npx serve .
```

Abrir `index.html` con `file://` **no funciona**: los módulos ES requieren HTTP.

Para repetir exactamente el mismo entorno:

```text
http://localhost:4173/?seed=481516
```

## Cómo se juega

1. Elige **Jugar en simulación** o **Jugar con cámara**.
2. Mueve a Anto con clic, `WASD`, flechas o el pad direccional.
3. Pulsa **Escanear** o `Espacio`. Las señales reveladas permanecen visibles unos segundos.
4. Acércate a una persona revelada para localizarla oficialmente.
5. Pide hasta tres **pistas** o escribe/dicta comandos como:
   - `Anto, escanea la zona`
   - `¿Dónde está la persona más cercana?`
   - `Muévete a la izquierda`
   - `Dame una pista`
   - `Activa la cámara`
   - `Genera un nuevo mundo`
6. Encuentra a las cinco personas antes de que el entorno termine de mutar varias veces.

Otros atajos: `H` = pista, `C` = cámara, `R` = nuevo mundo.

## Realidad mixta y respuesta generativa

- La cámara se usa como fondo de video y el canvas dibuja sectores, obstáculos, personas, ondas y al robot encima. La imagen original se transformó en `assets/juansi.png` con fondo transparente para integrarla como sprite.
- La detección de presencia es **local**: diferencia de fotogramas para movimiento y `FaceDetector` del navegador cuando está disponible. No se suben imágenes ni se graban datos.
- El micrófono usa `SpeechRecognition` si existe; si no, mide la energía sonora como interacción. La respuesta de Anto se sintetiza con `speechSynthesis`.
- Cada gesto, comando, clic o movimiento humano genera ondas, desplaza partículas, modifica la energía de un sector y carga el escáner. Anto construye una respuesta nueva combinando:
  - posición y persona más cercana;
  - sector, clima y anomalía activos;
  - energía del escáner y progreso;
  - fuente de la interacción (voz, texto, cámara, ratón o mutación).
- El mundo nace de una semilla e incluye seis sectores, clima reactivo, anomalías, obstáculos, señuelos y paleta propia. Cada 36–54 segundos muta clima, anomalía, partículas y geometría; las personas localizadas conservan su progreso.
- `?seed=N` permite compartir una partida con el mismo mapa inicial.

## Estructura

```text
index.html          Interfaz del juego
styles.css          Sistema visual responsive
404.html            Página de error (resuelve la base del repositorio en tiempo de ejecución)
.nojekyll           Evita que Jekyll procese el sitio en GitHub Pages
js/core.js          Generación del mundo y motor contextual de diálogo
js/game.js          Bucle, render Canvas, mecánicas e interacción
js/vision.js        Cámara, movimiento y FaceDetector opcional
js/voice.js         Reconocimiento, energía sonora y síntesis de voz
js/audio.js         Efectos generados con WebAudio
assets/             Robot original y sprite transparente
tests/              Pruebas del núcleo puro
server.mjs          Servidor estático sin dependencias (solo para local)
.github/workflows/pages.yml   Publicación automática en GitHub Pages
```

## Despliegue en GitHub Pages

1. **Settings → Pages → Build and deployment → Source: `GitHub Actions`**
   (ya está configurado en este repositorio).
2. Cada push a `main` lanza *Deploy to GitHub Pages*: ejecuta `npm test`, empaqueta el sitio
   y lo publica. También se puede lanzar a mano desde **Actions → Deploy to GitHub Pages →
   Run workflow**.
3. La URL resultante es <https://mariajosem0.github.io/Localizaci-n-de-personas-/>.

Todas las rutas del proyecto son relativas (`styles.css`, `js/game.js`, `assets/…`), así que
el mismo código funciona en la raíz de un dominio, bajo `usuario.github.io/repositorio/` o en
un dominio propio. Si prefieres no usar Actions, `Settings → Pages → Deploy from a branch →
main / (root)` también sirve, porque no hay nada que compilar.

### Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| El workflow falla con *Get Pages site failed* | Pages no está activo o su origen no es **GitHub Actions** | `Settings → Pages → Source: GitHub Actions` |
| El workflow falla con *not allowed to deploy to github-pages* | La rama no está permitida en el entorno `github-pages` | `Settings → Environments → github-pages → Deployment branches` debe incluir `main` |
| La página queda vacía o en blanco | Se abrió el archivo con `file://` | Servir por HTTP (ver arriba) |
| La cámara no arranca en el sitio publicado | Permiso denegado o navegador sin `getUserMedia` | Aceptar el permiso; el juego sigue en modo simulación |
| El dictado de voz no aparece | `SpeechRecognition` no existe en ese navegador (p. ej. Firefox) | Usar el campo de texto |

## Pruebas

```bash
npm test
```

## Privacidad

Las imágenes de la cámara, la detección de movimiento y la medición de energía sonoras ocurren localmente en el navegador. La aplicación no contiene analítica, ni almacena o sube imágenes y audio.

El reconocimiento de voz usa `SpeechRecognition` del navegador; según el navegador, su implementación puede procesar audio mediante un servicio del proveedor. Si prefieres evitarlo, usa el campo de texto y desactiva el sonido. La cámara puede rechazarse sin afectar la simulación.
