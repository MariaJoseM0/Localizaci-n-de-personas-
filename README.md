# Anto: Operación Presencia

Un juego interactivo de **realidad mixta en el navegador** protagonizado por Anto, el robot de la imagen adjunta. El objetivo es localizar a cinco exploradores ocultos en un mundo generado procedimentalmente que se superpone al espacio real de la cámara.

No hay dependencias externas: HTML, CSS, Canvas 2D, WebAudio, Web Speech API y `getUserMedia`.

## Ejecutar

```bash
npm start
```

Abre `http://localhost:4173`. Para cambiar el puerto:

```bash
PORT=8080 npm start
```

La cámara y el micrófono requieren `localhost` o HTTPS. En el entorno de vista previa de Arena la URL HTTPS del puerto también es válida. Si el permiso se rechaza, el juego continúa en modo simulación sin perder ninguna mecánica principal.

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
js/core.js          Generación del mundo y motor contextual de diálogo
js/game.js          Bucle, render Canvas, mecánicas e interacción
js/vision.js        Cámara, movimiento y FaceDetector opcional
js/voice.js         Reconocimiento, energía sonora y síntesis de voz
js/audio.js         Efectos generados con WebAudio
assets/             Robot original y sprite transparente
tests/              Pruebas del núcleo puro
server.mjs          Servidor estático sin dependencias
```

## Pruebas

```bash
npm test
```

## Privacidad

Las imágenes de la cámara, la detección de movimiento y la medición de energía sonoras ocurren localmente en el navegador. La aplicación no contiene analítica, ni almacena o sube imágenes y audio.

El reconocimiento de voz usa `SpeechRecognition` del navegador; según el navegador, su implementación puede procesar audio mediante un servicio del proveedor. Si prefieres evitarlo, usa el campo de texto y desactiva el sonido. La cámara puede rechazarse sin afectar la simulación.
