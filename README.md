# Rafy: Operación Presencia

Un juego interactivo de **realidad mixta en el navegador** protagonizado por **Rafy**, un robot de
rescate. Un terremoto ha derribado la ciudadela y hay personas atrapadas bajo los escombros: sus
celulares siguen emitiendo, así que tu misión es **detectarlos, excavar y sacarlas antes de que la
batería se agote**, mientras el suelo vuelve a moverse con las réplicas.

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

La cámara y el micrófono requieren `localhost` o HTTPS. En el entorno de vista previa de Arena la
URL HTTPS del puerto también es válida. Si el permiso se rechaza, el juego continúa en modo
simulación sin perder ninguna mecánica principal.

`server.mjs` solo existe para servir los archivos en local (`Content-Type` correcto para los
módulos ES y `Permissions-Policy` de cámara/micrófono). Para desarrollo también sirve cualquier
servidor estático, porque todas las rutas son relativas:

```bash
python3 -m http.server 4173    # o: npx serve .
```

Abrir `index.html` con `file://` **no funciona**: los módulos ES requieren HTTP.

Para repetir exactamente el mismo escenario sísmico:

```text
http://localhost:4173/?seed=481516
```

## Cómo se juega

1. Elige un **nivel de dificultad** y pulsa **Jugar en simulación** o **Jugar con cámara**.
2. Mueve a Rafy con clic, `WASD`, flechas o el pad direccional.
3. **Lee el detector de celulares**: la barra sube al acercarte al teléfono de una víctima. La
   intensidad depende de la distancia, del peso de los escombros y de la batería que le queda.
4. Cuando la señal suba de **DÉBIL** a **INTERMITENTE**, **CLARA** o **FUERTE** (el botón de excavar
   se ilumina), pulsa **Excavar** o `E`. Cada víctima necesita entre 2 y 4 pulsos según el nivel; el
   anillo dorado muestra el progreso.
5. **Cuidado con los señuelos**: otros celulares también emiten. Si excabas y no hay nadie, Rafy te
   lo dirá y marcará la señal falsa durante unos segundos.
6. **Sobrevive a las réplicas**: cada cierto tiempo el suelo vuelve a moverse, se acumulan
   escombros, los sectores se vuelven a tapar y se pierde parte de la excavación en curso.
7. También puedes pedir hasta N **pistas** (según nivel) o escribir/dictar comandos:
   - `Rafy, escanea la zona`
   - `Excava aquí`
   - `¿Dónde está la víctima más cercana?`
   - `Muévete a la izquierda`
   - `Dame una pista`
   - `¿Qué dificultad tengo?`
   - `Activa la cámara`
   - `Genera un nuevo mundo`

Atajos: `Espacio` escanear · `E` excavar · `H` pista · `C` cámara · `R` nuevo escenario.

## Niveles y progresión

Empiezas en **Fácil** y desbloqueas el siguiente nivel al completar una misión. El progreso se
guarda en `localStorage` (`rafy.rescate.progress.v1`) con los niveles desbloqueados y tu mejor
tiempo. Si el navegador bloquea el almacenamiento, la partida funciona igual, solo que sin
recordar el progreso.

| Nivel | Víctimas | Señuelos | Pulsos por rescate | Réplica cada | Alcance del detector |
| --- | --- | --- | --- | --- | --- |
| Fácil | 3 | 0 | 2 | 70–100 s | amplio |
| Normal | 5 | 1 | 3 | 52–74 s | medio |
| Difícil | 6 | 3 | 3 | 34–50 s | corto |
| Extremo | 7 | 5 | 4 | 22–34 s | muy corto |

Además, al subir de nivel baja la regeneración de energía del escáner, la batería de los celulares
se agota más rápido, hay más escombros y las réplicas son más frecuentes. Los parámetros viven en
`DIFFICULTIES` dentro de `js/core.js`.

## Mecánicas del desastre

- **Sismo inicial**: cada semilla genera un epicentro, una magnitud (M4.4–M7.4) y daño por sector;
  los escombros se concentran alrededor del epicentro y de las víctimas.
- **Celulares bajo los escombros**: cada víctima tiene batería propia, que se agota con el tiempo.
  Cuando llega a cero el teléfono deja de emitir y solo queda la **última lectura** marcada con
  líneas punteadas; acercarse a ella permite el rescate final por proximidad.
- **Detector**: `phoneSignal()` combina distancia, batería y profundidad de los escombros; el HUD
  añade ruido según la dificultad para que la lectura tiemble como un detector real.
- **Réplicas**: `applyAftershock()` añade escombros, re-tapa sectores, gasta batería y deshace parte
  de la excavación. El HUD avisa con una cuenta atrás y una banda de alerta.
- **Señuelos**: teléfonos ajenos (`phoneDecoys`) que el detector también capta y que obligan a
  confirmar antes de cavar.

## Realidad mixta y respuesta generativa

- La cámara se usa como fondo de video y el canvas dibuja sectores, escombros, celulares, ondas y al
  robot encima. La imagen original se transformó en `assets/rafy.png` con fondo transparente para
  integrarla como sprite.
- La detección de presencia es **local**: diferencia de fotogramas para movimiento y `FaceDetector`
  del navegador cuando está disponible. No se suben imágenes ni se graban datos.
- El micrófono usa `SpeechRecognition` si existe; si no, mide la energía sonora como interacción. La
  respuesta de Rafy se sintetiza con `speechSynthesis`.
- Cada gesto, comando, clic o movimiento humano genera ondas, desplaza partículas, modifica la
  energía de un sector y carga el escáner. Rafy construye una respuesta nueva combinando:
  - posición y celular más cercano, batería restante y progreso de excavación;
  - sector, clima, anomalía y réplicas acumuladas;
  - energía del escáner y progreso del rescate;
  - fuente de la interacción (voz, texto, cámara, ratón o réplica).
- El mundo nace de una semilla e incluye seis sectores, clima reactivo, anomalías, obstáculos y
  paleta propia. Cada 36–54 segundos muta clima, anomalía, partículas y geometría; las víctimas ya
  rescatadas conservan su progreso.
- `?seed=N` permite compartir una partida con el mismo sismo y el mismo mapa inicial.

## Estructura

```text
index.html          Interfaz del juego (HUD, detector, modales y selector de dificultad)
styles.css          Sistema visual responsive
404.html            Página de error (resuelve la base del repositorio en tiempo de ejecución)
.nojekyll           Evita que Jekyll procese el sitio en GitHub Pages
js/core.js          Sismo, escombros, celulares, niveles y motor contextual de diálogo
js/game.js          Bucle, render Canvas, detector, excavación, réplicas e interacción
js/vision.js        Cámara, movimiento y FaceDetector opcional
js/voice.js         Reconocimiento, energía sonora y síntesis de voz
js/audio.js         Efectos generados con WebAudio
assets/             Robot original y sprite transparente
tests/              Pruebas del núcleo puro
server.mjs          Servidor estático sin dependencias (solo para local)
.github/workflows/pages.yml   Publicación automática en GitHub Pages
```

## Pruebas

```bash
npm test
```

Cubren la generación determinista del escenario por semilla y dificultad, la respuesta del detector
a distancia y batería, la selección de la señal más fuerte, los pulsos de excavación, el efecto de
las réplicas, la progresión de niveles y las respuestas de diálogo.

## Despliegue en GitHub Pages

1. **Settings → Pages → Build and deployment → Source: `GitHub Actions`**
   (ya está configurado en este repositorio).
2. Cada push a `main` lanza *Deploy to GitHub Pages*: ejecuta `npm test`, empaqueta el sitio y lo
   publica. También se puede lanzar a mano desde **Actions → Deploy to GitHub Pages → Run workflow**.
3. La URL resultante es <https://mariajosem0.github.io/Localizaci-n-de-personas-/>.

Todas las rutas del proyecto son relativas (`styles.css`, `js/game.js`, `assets/…`), así que el
mismo código funciona en la raíz de un dominio, bajo `usuario.github.io/repositorio/` o en un
dominio propio. Si prefieres no usar Actions, `Settings → Pages → Deploy from a branch → main /
(root)` también sirve, porque no hay nada que compilar.

### Si el sitio devuelve 404 o el despliegue falla

El job **Publicar** empieza comprobando la configuración real de Pages y deja el resultado en el
resumen de la ejecución y en el issue **Diagnóstico de Pages**. Interpretación:

| `GET /repos/{repo}/pages` | Qué significa | Solución |
| --- | --- | --- |
| `404` | El repositorio **no tiene ningún sitio de Pages activo**: `deploy-pages` no puede publicar aunque el build esté correcto | `Settings → Pages → Build and deployment → Source: GitHub Actions → Save`. Después vuelve a lanzar *Deploy to GitHub Pages* (o haz cualquier push a `main`) |
| `200` con `"build_type": "workflow"` | La configuración es correcta: el fallo está en el despliegue, no en el origen | Revisa el paso **Desplegar en GitHub Pages** |
| `403` | El token del workflow no puede leer la configuración | Comprueba que `permissions:` incluya `pages: write` |

Si prefieres no depender de Actions, `Settings → Pages → Deploy from a branch → main / (root)`
publica el mismo juego: todo son archivos estáticos con rutas relativas y `.nojekyll` ya está en la
raíz.

### Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| El workflow falla con *Get Pages site failed* | Pages no está activo o su origen no es **GitHub Actions** | `Settings → Pages → Source: GitHub Actions` |
| La URL publicada responde *There isn't a GitHub Pages site here* | El sitio de Pages está deshabilitado en el repositorio | Reactivarlo como se explica arriba |
| El workflow falla con *not allowed to deploy to github-pages* | La rama no está permitida en el entorno `github-pages` | `Settings → Environments → github-pages → Deployment branches` debe incluir `main` |
| La página queda vacía o en blanco | Se abrió el archivo con `file://` | Servir por HTTP (ver arriba) |
| El detector no sube nunca | Estás lejos de todos los celulares o sus baterías se agotaron | Usa una pista; el nivel Fácil tiene más alcance |
| La excavación no avanza | La señal sigue en **MUY DÉBIL** o **DÉBIL** | Acércate más y vuelve a pulsar `E` |
| La cámara no arranca en el sitio publicado | Permiso denegado o navegador sin `getUserMedia` | Aceptar el permiso; el juego sigue en modo simulación |
| El dictado de voz no aparece | `SpeechRecognition` no existe en ese navegador (p. ej. Firefox) | Usar el campo de texto |
| El progreso de niveles no se guarda | Navegación privada o almacenamiento bloqueado | Jugar sin persistencia o permitir el almacenamiento del sitio |

## Privacidad

Las imágenes de la cámara, la detección de movimiento y la medición de energía sonora ocurren
localmente en el navegador. La aplicación no contiene analítica, ni almacena o sube imágenes y audio.
El único dato persistente es el progreso del juego (niveles y mejores tiempos) en `localStorage`.

El reconocimiento de voz usa `SpeechRecognition` del navegador; según el navegador, su implementación
puede procesar audio mediante un servicio del proveedor. Si prefieres evitarlo, usa el campo de texto
y desactiva el sonido. La cámara puede rechazarse sin afectar la simulación.
