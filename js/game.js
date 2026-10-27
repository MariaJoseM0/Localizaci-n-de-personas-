import {
  applyMutation,
  clamp,
  composeDialogue,
  createWorld,
  directionTo,
  distanceLabel,
  isSignalBlocked,
  lerp,
  nearestMissingPerson,
  paletteColor,
  paletteCss,
  sectorAt,
} from "./core.js";
import { SoundEngine } from "./audio.js";
import { VisionSystem } from "./vision.js";
import { VoiceSystem } from "./voice.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;

const ui = {
  root: document.documentElement,
  stage: $("stage"),
  cameraVideo: $("camera-video"),
  canvas: $("game-canvas"),
  radarCanvas: $("radar-canvas"),
  realityMode: $("reality-mode"),
  sectorLabel: $("sector-label"),
  batteryFill: $("battery-fill"),
  batteryText: $("battery-text"),
  environmentFlash: $("environment-flash"),
  speechBubble: $("speech-bubble"),
  speechText: $("speech-text"),
  moodBadge: $("mood-badge"),
  contextBadge: document.querySelector(".context-badge"),
  missionState: $("mission-state"),
  foundCount: $("found-count"),
  progressFill: $("progress-fill"),
  missionTime: $("mission-time"),
  peopleList: $("people-list"),
  footerWorldName: $("footer-world-name"),
  worldName: $("world-name"),
  seedLabel: $("seed-label"),
  worldDescription: $("world-description"),
  weatherName: $("weather-name"),
  anomalyName: $("anomaly-name"),
  paletteSwatches: $("palette-swatches"),
  humanStatus: $("human-status"),
  humanTitle: $("human-title"),
  humanDetail: $("human-detail"),
  reactionValue: $("reaction-value"),
  reactionFill: $("reaction-fill"),
  commandForm: $("command-form"),
  commandInput: $("command-input"),
  voiceButton: $("voice-button"),
  voiceButtonLabel: $("voice-button-label"),
  micStatus: $("mic-status"),
  eventLog: $("event-log"),
  cameraButton: $("camera-button"),
  cameraButtonLabel: $("camera-button-label"),
  soundButton: $("sound-button"),
  helpButton: $("help-button"),
  scanButton: $("scan-button"),
  hintButton: $("hint-button"),
  hintCount: $("hint-count"),
  regenButton: $("regen-button"),
  introModal: $("intro-modal"),
  introSkip: $("intro-skip"),
  startSimulation: $("start-simulation"),
  startCamera: $("start-camera"),
  helpModal: $("help-modal"),
  helpClose: $("help-close"),
  helpUnderstood: $("help-understood"),
  winModal: $("win-modal"),
  winSummary: $("win-summary"),
  winTime: $("win-time"),
  winInteractions: $("win-interactions"),
  winWorld: $("win-world"),
  playAgain: $("play-again"),
};

const ctx = ui.canvas.getContext("2d");
const radarCtx = ui.radarCanvas.getContext("2d");
const sound = new SoundEngine();

const robotImage = new Image();
robotImage.src = "assets/juansi.png";
let robotImageReady = false;
robotImage.onload = () => { robotImageReady = true; };

const urlSeed = Number(new URLSearchParams(window.location.search).get("seed"));
const initialSeed = Number.isFinite(urlSeed) && urlSeed > 0
  ? urlSeed >>> 0
  : Math.floor(Math.random() * 900000) + 100000;

let world = createWorld(initialSeed);
let view = { w: 1, h: 1, dpr: 1 };
let radarView = { w: 1, h: 1, dpr: 1 };

const state = {
  phase: "intro",
  seed: initialSeed,
  world,
  robot: { x: 0.5, y: 0.86, tx: 0.5, ty: 0.86, facing: 1 },
  charge: 100,
  hints: 3,
  found: 0,
  interactions: 0,
  humanEvents: 0,
  voiceEvents: 0,
  mutations: 0,
  startTime: 0,
  elapsed: 0,
  lastFrame: performance.now(),
  lastUiUpdate: 0,
  nextMutation: Infinity,
  camera: false,
  cameraPending: false,
  sound: true,
  voiceListening: false,
  keys: new Set(),
  pointerId: null,
  dragging: false,
  targetVisible: false,
  pulses: [],
  ripples: [],
  reactions: [],
  texts: [],
  confetti: [],
  hintLine: null,
  currentSector: sectorAt(world, 0.5, 0.86),
  lastSectorResponse: 0,
  reactionLevel: 0,
  worldFlash: 0,
  lastScanSpeech: 0,
  dialogue: {
    full: "Los sectores están tomando forma. Esperando a un humano...",
    shown: 999,
    accumulator: 0,
  },
  human: {
    present: false,
    motion: 0,
    region: null,
    faces: [],
    lastFaceAt: 0,
    lastSeen: 0,
    lastSpoken: 0,
    lastHumanLog: 0,
    label: "Sensor en espera",
  },
};

const vision = new VisionSystem(ui.cameraVideo, onVisionEvent);
const voice = new VoiceSystem({ onResult: onVoiceResult, onStatus: onVoiceStatus });

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function normalizeCommand(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function fitCanvas(canvas, context) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: width, h: height, dpr };
}

function resizeAll() {
  view = fitCanvas(ui.canvas, ctx);
  radarView = fitCanvas(ui.radarCanvas, radarCtx);
}

function setWorldPalette() {
  const colors = [0, 1, 2].map((index) => paletteCss(world.palette, index));
  ui.root.style.setProperty("--world-primary", colors[0]);
  ui.root.style.setProperty("--world-secondary", colors[1]);
  ui.root.style.setProperty("--world-tertiary", colors[2]);
  ui.paletteSwatches.replaceChildren(...colors.map((color) => {
    const swatch = document.createElement("i");
    swatch.style.background = color;
    swatch.style.color = color;
    return swatch;
  }));
}

function refreshWorldUI() {
  setWorldPalette();
  ui.worldName.textContent = world.name;
  ui.footerWorldName.textContent = `${world.name} · ${world.subtitle}`;
  ui.seedLabel.textContent = String(state.seed).padStart(6, "0").slice(-6);
  ui.worldDescription.textContent = world.description;
  ui.weatherName.textContent = `${world.weather.icon} ${world.weather.name}`;
  ui.anomalyName.textContent = `${world.anomaly.icon} ${world.anomaly.name}`;
}

function refreshPeopleUI() {
  const cards = world.people.map((person) => {
    const card = document.createElement("div");
    card.className = `person-card${person.found ? " found" : ""}`;
    card.style.setProperty("--person-color", person.color);

    const avatar = document.createElement("div");
    avatar.className = "person-avatar";
    avatar.textContent = person.found ? person.emoji : "?";

    const copy = document.createElement("div");
    copy.className = "person-copy";
    const name = document.createElement("strong");
    name.textContent = person.found ? person.name : `Señal 0${person.signal}`;
    const role = document.createElement("span");
    role.textContent = person.found ? person.quote : "Identidad enmascarada";
    copy.append(name, role);

    const status = document.createElement("span");
    status.className = "person-status";
    status.textContent = person.found ? "✓ a salvo" : "buscando";
    card.append(avatar, copy, status);
    return card;
  });
  ui.peopleList.replaceChildren(...cards);
}

function logEvent(title, detail = "") {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  const time = document.createElement("time");
  time.textContent = formatTime(state.elapsed);
  const body = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const description = document.createElement("span");
  description.textContent = detail;
  body.append(heading, description);
  entry.append(time, body);
  ui.eventLog.prepend(entry);
  while (ui.eventLog.childElementCount > 8) ui.eventLog.lastElementChild.remove();
}

function setDialogue(text, mood = "CURIOSO", source = "humano + mundo") {
  state.dialogue = { full: text, shown: 0, accumulator: 0 };
  ui.speechText.textContent = "";
  ui.moodBadge.textContent = mood;
  ui.contextBadge.textContent = source;
}

function respond(trigger, extra = {}, options = {}) {
  if (options.countInteraction !== false) state.interactions += 1;
  const nearest = extra.nearest || nearestMissingPerson(world, state.robot);
  const sector = extra.sector || sectorAt(world, state.robot.x, state.robot.y);
  const reply = composeDialogue(trigger, {
    seed: state.seed + state.mutations * 7919,
    interactions: state.interactions,
    robot: state.robot,
    nearest,
    person: extra.person || nearest?.person,
    direction: extra.direction || (nearest ? directionTo(state.robot, nearest.person) : "cerca"),
    distanceLabel: extra.distanceLabel || distanceLabel(nearest?.distance ?? 0.3),
    sector,
    weather: world.weather,
    anomaly: world.anomaly,
    humanPresent: state.human.present,
    battery: state.charge,
    found: state.found,
    total: world.people.length,
    mutations: state.mutations,
    ...extra,
  });
  setDialogue(reply.text, reply.mood, reply.source);
  if (options.speak) voice.speak(reply.text, state.sound);
  if (options.sound) sound.play(options.sound);
  if (options.log) logEvent(options.log[0], options.log[1] || "");
  return reply;
}

function updateDialogue(dt) {
  const dialogue = state.dialogue;
  if (dialogue.shown >= dialogue.full.length) return;
  dialogue.accumulator += dt * 82;
  const next = Math.min(dialogue.full.length, Math.floor(dialogue.accumulator));
  if (next !== dialogue.shown) {
    dialogue.shown = next;
    ui.speechText.textContent = dialogue.full.slice(0, next);
  }
}

function updateHUD(force = false) {
  const now = performance.now();
  if (!force && now - state.lastUiUpdate < 110) return;
  state.lastUiUpdate = now;

  ui.foundCount.textContent = `${state.found}/${world.people.length}`;
  ui.progressFill.style.width = `${(state.found / world.people.length) * 100}%`;
  ui.missionTime.textContent = formatTime(state.elapsed);
  ui.batteryText.textContent = `${Math.round(state.charge)}%`;
  ui.batteryFill.style.width = `${state.charge}%`;
  ui.hintCount.textContent = state.hints;
  ui.hintButton.disabled = state.phase !== "playing" || state.hints <= 0;
  ui.scanButton.disabled = state.phase !== "playing" || state.charge < 20;
  ui.sectorLabel.textContent = `SECTOR · ${state.currentSector.name.toUpperCase()}`;
  ui.realityMode.textContent = state.camera ? "REALIDAD MIXTA · CÁMARA EN VIVO" : "SIMULACIÓN GENERATIVA";
  ui.cameraButton.setAttribute("aria-pressed", String(state.camera));
  ui.cameraButtonLabel.textContent = state.camera ? "Desactivar cámara" : "Activar cámara";
  ui.soundButton.setAttribute("aria-pressed", String(state.sound));
  ui.soundButton.querySelector("span").textContent = state.sound ? "♪" : "×";
  ui.missionState.querySelector("span:last-child").textContent =
    state.phase === "won" ? "Misión completada" : state.phase === "intro" ? "Esperando operador" : "Misión en curso";

  const reaction = Math.round(state.reactionLevel * 100);
  ui.reactionValue.textContent = `${reaction}%`;
  ui.reactionFill.style.width = `${reaction}%`;
  ui.humanStatus.classList.toggle("active", state.human.present);

  if (state.human.present) {
    ui.humanTitle.textContent = state.human.label;
    ui.humanDetail.textContent = "El entorno generó una onda y Juansi está leyendo tu presencia.";
  } else if (state.camera) {
    ui.humanTitle.textContent = "Cámara activa";
    ui.humanDetail.textContent = "Muévete frente a la lente para crear ondas en el mapa.";
  } else {
    ui.humanTitle.textContent = "Sensor en espera";
    ui.humanDetail.textContent = "Activa la cámara, habla o mueve el cursor para influir en el mundo.";
  }
}

function addRipple(x, y, color = paletteColor(world.palette, 0, 0.7), life = 0.8, strength = 1) {
  state.ripples.push({ x, y, color, age: 0, life, strength });
}

function addReaction(x, y, source = "humano", strength = 1) {
  state.reactions.push({
    x,
    y,
    source,
    strength,
    phase: Math.random() * TAU,
    age: 0,
    life: 3.8,
  });
  state.reactionLevel = clamp(state.reactionLevel + 0.13 * strength, 0, 1);

  const sector = sectorAt(world, x, y);
  sector.energy = clamp(sector.energy + 0.16 * strength, 0, 1.6);
  for (const particle of world.particles) {
    const dx = particle.x - x;
    const dy = particle.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.001 && distance < 0.3) {
      const push = (1 - distance / 0.3) * 0.028 * strength;
      particle.x = clamp(particle.x + (dx / distance) * push, 0, 1);
      particle.y = clamp(particle.y + (dy / distance) * push, 0, 1);
    }
  }
}

function addFloatingText(x, y, text, color = paletteColor(world.palette, 0, 1)) {
  state.texts.push({ x, y, text, color, age: 0, life: 1.6 });
}

function addConfetti(x, y, color) {
  for (let i = 0; i < 22; i += 1) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
    const speed = 55 + Math.random() * 120;
    state.confetti.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: Math.random() * TAU,
      spin: (Math.random() - 0.5) * 8,
      size: 2 + Math.random() * 4,
      color: i % 3 === 0 ? paletteColor(world.palette, 2, 1) : color,
      age: 0,
      life: 1.6 + Math.random() * 0.7,
    });
  }
}

function distancePixels(a, b) {
  return Math.hypot((a.x - b.x) * view.w, (a.y - b.y) * view.h);
}

function setRobotTarget(x, y) {
  state.robot.tx = clamp(x, 0.045, 0.955);
  state.robot.ty = clamp(y, 0.07, 0.93);
  state.targetVisible = true;
}

function pointerToWorld(event) {
  const rect = ui.canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}

function registerHumanInteraction(kind, point, strength = 1) {
  const now = performance.now();
  if (now - state.human.lastHumanLog < 2200) return;
  state.human.lastHumanLog = now;
  state.humanEvents += 1;
  state.human.present = true;
  state.human.lastSeen = now;
  state.human.motion = Math.max(state.human.motion, strength);
  state.human.region = point;
  state.human.label = kind === "rostro"
    ? "Persona real detectada"
    : kind === "sonido"
      ? "Energía sonora detectada"
      : "Movimiento humano detectado";
  state.charge = clamp(state.charge + 9 * strength, 0, 100);
  addReaction(point.x, point.y, kind, clamp(strength, 0.6, 1.5));
  addFloatingText(point.x, point.y, kind === "rostro" ? "PRESENCIA REAL" : "ONDA HUMANA", paletteColor(world.palette, 2, 1));

  const shouldSpeak = now - state.human.lastSpoken > 7000;
  if (shouldSpeak) {
    state.human.lastSpoken = now;
    const trigger = kind === "sonido" ? "voiceSound" : "human";
    respond(trigger, { command: kind }, {
      speak: true,
      sound: "human",
      log: ["PRESENCIA", `${state.human.label} · entorno reaccionó`],
    });
  } else {
    logEvent("PRESENCIA", `${state.human.label} · +energía`);
    sound.play("click");
  }
}

function mapVideoPoint(x, y, videoWidth, videoHeight, mirror = true) {
  if (!videoWidth || !videoHeight) return { x: mirror ? 1 - x : x, y };
  const scale = Math.max(view.w / videoWidth, view.h / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;
  const rawX = (view.w - drawWidth) / 2 + x * drawWidth;
  const rawY = (view.h - drawHeight) / 2 + y * drawHeight;
  return {
    x: clamp((mirror ? view.w - rawX : rawX) / view.w, 0, 1),
    y: clamp(rawY / view.h, 0, 1),
  };
}

function mapVideoRectToStage(box, videoWidth, videoHeight) {
  if (!videoWidth || !videoHeight) return null;
  const scale = Math.max(view.w / videoWidth, view.h / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;
  const offsetX = (view.w - drawWidth) / 2;
  const offsetY = (view.h - drawHeight) / 2;
  const x1 = offsetX + box.x * scale;
  const x2 = x1 + box.width * scale;
  const y1 = offsetY + box.y * scale;
  return {
    x: view.w - x2,
    y: y1,
    w: x2 - x1,
    h: box.height * scale,
  };
}

function onVisionEvent(event) {
  const now = event.at || performance.now();
  if (event.type === "camera-off") {
    state.human.faces = [];
    state.human.present = false;
    state.human.region = null;
    return;
  }
  if (event.type === "motion") {
    state.human.motion = event.motion;
    if (event.motion > 0.23) {
      const point = mapVideoPoint(event.x, event.y, event.videoWidth, event.videoHeight);
      state.human.region = point;
      state.human.lastSeen = now;
      state.human.present = true;
      registerHumanInteraction("movimiento", point, 0.7 + event.motion * 0.6);
    } else if (event.motion < 0.08 && now - state.human.lastSeen > 4500) {
      state.human.present = false;
    }
    return;
  }
  if (event.type === "faces") {
    state.human.faces = event.faces || [];
    state.human.lastFaceAt = now;
    if (!state.human.faces.length) return;
    const first = state.human.faces[0];
    const point = mapVideoPoint(
      (first.x + first.width / 2) / event.videoWidth,
      (first.y + first.height / 2) / event.videoHeight,
      event.videoWidth,
      event.videoHeight,
    );
    registerHumanInteraction("rostro", point, 1.15);
  }
}

function onVoiceResult(result) {
  if (result.type === "transcript") {
    state.voiceEvents += 1;
    processCommand(result.text, "voice");
  } else if (result.type === "sound") {
    state.voiceEvents += 1;
    registerHumanInteraction("sonido", { x: 0.5, y: 0.38 }, 0.8 + result.level);
  }
}

function setVoiceListening(listening) {
  state.voiceListening = listening;
  ui.voiceButton.setAttribute("aria-pressed", String(listening));
  ui.voiceButtonLabel.textContent = listening ? "Detener escucha" : "Hablar por micrófono";
}

function onVoiceStatus(message) {
  ui.micStatus.textContent = message;
  if (/reposo|No pude|no autorizado|necesita conexión|No oí/i.test(message)) {
    setVoiceListening(false);
  }
}

async function setCamera(enabled) {
  if (state.cameraPending || state.camera === enabled) return;
  state.cameraPending = true;
  if (enabled) {
    try {
      const result = await vision.start();
      state.camera = true;
      ui.stage.classList.add("camera-on");
      addReaction(0.5, 0.5, "fusión", 1.3);
      respond("camera", {}, {
        speak: true,
        sound: "human",
        log: ["REALIDAD MIXTA", result.faceDetection
          ? "Cámara + FaceDetector activos localmente"
          : "Cámara activa · detección por movimiento"],
      });
    } catch (error) {
      state.camera = false;
      ui.stage.classList.remove("camera-on");
      const message = `No pude activar la cámara: ${error.message}. Seguimos en simulación y todas las mecánicas siguen disponibles.`;
      setDialogue(message, "ATENTO", "permiso + simulación");
      logEvent("CÁMARA", "Permiso no disponible · simulación activa");
      sound.play("error");
    }
  } else {
    vision.stop();
    state.camera = false;
    ui.stage.classList.remove("camera-on");
    state.human.faces = [];
    logEvent("CÁMARA", "Volviendo a la simulación generativa");
    respond("camera", { command: "simulación" }, { speak: false, sound: "click" });
  }
  updateHUD(true);
  state.cameraPending = false;
}

function toggleCamera() {
  setCamera(!state.camera);
}

function scan(source = "button") {
  if (state.phase !== "playing") return;
  const now = performance.now();
  if (state.charge < 20) {
    respond("lowBattery", {}, { speak: true, sound: "error", log: ["ENERGÍA", "Escáner agotado"] });
    return;
  }
  state.charge -= 22;
  const weatherFactor = world.weather.scan;
  const anomalyFactor = world.anomaly.distortion;
  const maxRadius = Math.min(view.w, view.h) * 0.44 * weatherFactor / Math.sqrt(anomalyFactor);
  state.pulses.push({
    x: state.robot.x,
    y: state.robot.y,
    max: maxRadius,
    age: 0,
    duration: 1.25,
  });

  let revealed = 0;
  for (const person of world.people) {
    if (person.found) continue;
    const blocked = isSignalBlocked(world, state.robot, person);
    const effectiveRadius = maxRadius * (blocked ? 0.72 : 1);
    if (distancePixels(state.robot, person) <= effectiveRadius) {
      const revealTime = 4600 * world.weather.reveal * (blocked ? 0.7 : 1);
      person.revealedUntil = Math.max(person.revealedUntil, now + revealTime);
      revealed += 1;
      addRipple(person.x, person.y, person.color, 1.2, 1.2);
      addFloatingText(person.x, person.y - 0.03, `SEÑAL 0${person.signal}`, person.color);
    }
  }
  for (const decoy of world.decoys) {
    if (distancePixels(state.robot, decoy) <= maxRadius) {
      decoy.aliveUntil = now + 1800;
      addRipple(decoy.x, decoy.y, paletteColor(world.palette, 1, 0.45), 0.7, 0.6);
    }
  }

  if (state.human.present) state.charge = clamp(state.charge + 8, 0, 100);
  const nearest = nearestMissingPerson(world, state.robot);
  const trigger = revealed > 0 ? "scanHit" : "scanMiss";
  const speak = source === "voice" || (revealed > 0 && now - state.lastScanSpeech > 9000);
  if (speak) state.lastScanSpeech = now;
  respond(trigger, { nearest, scanCount: revealed }, {
    speak,
    sound: "scan",
    log: ["ESCANEO", revealed > 0
      ? `${revealed} ${revealed === 1 ? "señal revelada" : "señales reveladas"} · ${world.weather.name}`
      : `Sin señales nuevas · ${world.anomaly.name}`],
  });
}

function hint() {
  if (state.phase !== "playing") return;
  if (state.hints <= 0) {
    respond("noHints", {}, { speak: true, sound: "error" });
    return;
  }
  const nearest = nearestMissingPerson(world, state.robot);
  if (!nearest) return;
  state.hints -= 1;
  const now = performance.now();
  nearest.person.revealedUntil = Math.max(nearest.person.revealedUntil, now + 6200 * world.weather.reveal);
  state.hintLine = {
    from: { x: state.robot.x, y: state.robot.y },
    to: { x: nearest.person.x, y: nearest.person.y },
    until: now + 5200,
    color: nearest.person.color,
  };
  addReaction(nearest.person.x, nearest.person.y, "pista", 0.8);
  respond("hint", {
    nearest,
    person: nearest.person,
    direction: directionTo(state.robot, nearest.person),
    distanceLabel: distanceLabel(nearest.distance),
  }, {
    speak: true,
    sound: "found",
    log: ["PISTA", `${nearest.person.name} · ${nearest.person.sector}`],
  });
  updateHUD(true);
}

function foundPerson(person) {
  if (person.found || state.phase !== "playing") return;
  person.found = true;
  person.foundAt = performance.now();
  state.found += 1;
  state.charge = clamp(state.charge + 20, 0, 100);
  addConfetti(person.x, person.y, person.color);
  addReaction(person.x, person.y, "rescate", 1.4);
  addFloatingText(person.x, person.y - 0.05, `¡${person.name.toUpperCase()}!`, person.color);
  refreshPeopleUI();
  respond("found", { person }, {
    speak: true,
    sound: "found",
    log: ["LOCALIZADA", `${person.name} · ${person.role}`],
  });
  if (state.found === world.people.length) {
    state.phase = "finishing";
    window.setTimeout(winMission, 850);
  }
}

function winMission() {
  if (state.phase === "won") return;
  state.phase = "won";
  ui.winTime.textContent = formatTime(state.elapsed);
  ui.winInteractions.textContent = state.interactions;
  ui.winWorld.textContent = state.mutations;
  const humanPhrase = state.humanEvents > 0
    ? `Registré ${state.humanEvents} señales de presencia y ${state.voiceEvents} entradas de voz.`
    : "Tus movimientos guiaron cada lectura del radar.";
  ui.winSummary.textContent = `Juansi y tú localizaron a las cinco personas en ${world.name}. ${humanPhrase} El mundo cambió ${state.mutations} ${state.mutations === 1 ? "vez" : "veces"} mientras jugaban.`;
  ui.winModal.classList.add("visible");
  respond("win", {}, { speak: true, sound: "win", log: ["MISIÓN", "Todas las personas están a salvo"] });
  updateHUD(true);
}

function beginMission(withCamera) {
  if (state.phase !== "intro") return;
  ui.introModal.classList.remove("visible");
  state.phase = "playing";
  state.startTime = performance.now();
  state.nextMutation = state.startTime + 36000 + Math.random() * 18000;
  sound.warm();
  respond("intro", {}, {
    speak: true,
    sound: "click",
    log: ["MISIÓN", `${world.name} · semilla ${state.seed}`],
  });
  if (withCamera) setCamera(true);
  updateHUD(true);
}

function generateMission(seed = Math.floor(Math.random() * 900000) + 100000) {
  state.seed = seed >>> 0;
  world = createWorld(state.seed);
  state.world = world;
  state.robot = { x: 0.5, y: 0.86, tx: 0.5, ty: 0.86, facing: 1 };
  state.charge = 100;
  state.hints = 3;
  state.found = 0;
  state.interactions = 0;
  state.humanEvents = 0;
  state.voiceEvents = 0;
  state.mutations = 0;
  state.elapsed = 0;
  state.startTime = performance.now();
  state.nextMutation = state.startTime + 36000 + Math.random() * 18000;
  state.phase = "playing";
  state.pulses = [];
  state.ripples = [];
  state.reactions = [];
  state.texts = [];
  state.confetti = [];
  state.hintLine = null;
  state.currentSector = sectorAt(world, state.robot.x, state.robot.y);
  state.reactionLevel = 0;
  state.worldFlash = 1;
  state.human.present = false;
  state.human.faces = [];
  state.human.region = null;
  ui.winModal.classList.remove("visible");
  ui.introModal.classList.remove("visible");
  ui.commandInput.value = "";
  refreshWorldUI();
  refreshPeopleUI();

  const url = new URL(window.location.href);
  url.searchParams.set("seed", String(state.seed));
  window.history.replaceState(null, "", url);

  sound.warm();
  addReaction(0.5, 0.5, "semilla", 1.5);
  respond("world", {}, {
    speak: true,
    sound: "world",
    log: ["NUEVO MUNDO", `${world.name} · semilla ${state.seed}`],
  });
  updateHUD(true);
}

function processCommand(raw, source = "text") {
  const text = String(raw || "").trim();
  if (!text) return;
  const command = normalizeCommand(text);
  logEvent("COMANDO", `${source === "voice" ? "Voz" : "Texto"}: ${text.slice(0, 48)}`);

  // Las acciones tienen prioridad: así "Hola Juansi, escanea" ejecuta el escaneo.
  if (/escan|escanea|radar|busca|buscar|sonar|pulso/.test(command)) {
    scan(source);
    return;
  }
  if (/pista|ayuda|donde|hacia|persona mas cercana|localiza/.test(command)) {
    hint();
    return;
  }
  if (/izquierda|izquierdo/.test(command)) { moveByDirection("left", 0.18); respondCommand(text); return; }
  if (/derecha|derecho/.test(command)) { moveByDirection("right", 0.18); respondCommand(text); return; }
  if (/arriba|norte|adelante|avanza/.test(command)) { moveByDirection("up", 0.18); respondCommand(text); return; }
  if (/abajo|sur|atras|retrocede/.test(command)) { moveByDirection("down", 0.18); respondCommand(text); return; }
  if (/camara|realidad mixta|activar camara/.test(command)) { toggleCamera(); respondCommand(text); return; }
  if (/nuevo|otro|regener|mundo|semilla|reinici/.test(command)) { generateMission(); return; }
  if (/quien|persona|explorador|estado|sector/.test(command)) {
    const nearest = nearestMissingPerson(world, state.robot);
    respond("hint", {
      nearest,
      person: nearest?.person,
      direction: nearest ? directionTo(state.robot, nearest.person) : "cerca",
      distanceLabel: distanceLabel(nearest?.distance ?? 0.3),
      command: text,
    }, { speak: true, sound: "click" });
    return;
  }
  if (/hola|buenas|buenos dias|buenas tardes|hey/.test(command)) {
    respond("greeting", { command: text }, { speak: true, sound: "human" });
    return;
  }
  respond("unknown", { command: text }, { speak: true, sound: "click" });
}

function respondCommand(text) {
  respond("command", { command: text }, { speak: true, sound: "click" });
}

function moveByDirection(direction, distance = 0.18) {
  const deltas = {
    left: [-distance, 0],
    right: [distance, 0],
    up: [0, -distance],
    down: [0, distance],
  };
  const [dx, dy] = deltas[direction] || [0, 0];
  setRobotTarget(state.robot.tx + dx, state.robot.ty + dy);
  addRipple(state.robot.tx, state.robot.ty, paletteColor(world.palette, 0, 0.6), 0.7, 0.7);
}

function updateMovement(dt) {
  const keys = state.keys;
  let dx = 0;
  let dy = 0;
  if (keys.has("left")) dx -= 1;
  if (keys.has("right")) dx += 1;
  if (keys.has("up")) dy -= 1;
  if (keys.has("down")) dy += 1;
  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    const speed = 0.52 * (world.weather.speed || 1);
    setRobotTarget(
      state.robot.tx + (dx / length) * speed * dt,
      state.robot.ty + (dy / length) * speed * dt,
    );
  }

  const robot = state.robot;
  const deltaX = (robot.tx - robot.x) * view.w;
  const deltaY = (robot.ty - robot.y) * view.h;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance > 2) {
    const speed = 178 * (world.weather.speed || 1);
    const step = Math.min(distance, speed * dt);
    robot.x += (deltaX / distance) * step / view.w;
    robot.y += (deltaY / distance) * step / view.h;
    if (Math.abs(deltaX) > 4) robot.facing = deltaX < 0 ? -1 : 1;
    state.targetVisible = true;
  } else {
    state.targetVisible = state.dragging;
  }
}

function checkSector(now) {
  const sector = sectorAt(world, state.robot.x, state.robot.y);
  if (sector.id === state.currentSector.id) return;
  state.currentSector = sector;
  addRipple(state.robot.x, state.robot.y, `hsla(${sector.hue}, 90%, 65%, 0.45)`, 0.9, 0.8);
  if (state.phase === "playing" && now - state.lastSectorResponse > 2100) {
    state.lastSectorResponse = now;
    respond("sector", { sector }, { speak: false, sound: "click" });
    logEvent("SECTOR", sector.name);
  }
}

function checkFound(now) {
  if (state.phase !== "playing") return;
  for (const person of world.people) {
    if (person.found) continue;
    const distance = distancePixels(state.robot, person);
    if (distance < 46) {
      foundPerson(person);
      return;
    }
    if (now < person.revealedUntil && distance < 76) {
      foundPerson(person);
      return;
    }
    if (distance < 120) {
      person.revealedUntil = Math.max(person.revealedUntil, now + 1000);
    }
  }
}

function checkMutation(now) {
  if (state.phase !== "playing" || now < state.nextMutation) return;
  applyMutation(world, (state.seed + Math.floor(now) + state.mutations * 997) >>> 0);
  state.mutations += 1;
  state.nextMutation = now + 42000 + Math.random() * 22000;
  state.worldFlash = 1;
  state.reactionLevel = clamp(state.reactionLevel + 0.35, 0, 1);
  addReaction(state.robot.x, state.robot.y, "mutación", 1.6);
  refreshWorldUI();
  respond("world", {}, {
    speak: true,
    sound: "world",
    log: ["MUTACIÓN", `${world.weather.name} + ${world.anomaly.name}`],
  });
}

function updateEffects(dt) {
  state.pulses.forEach((pulse) => { pulse.age += dt; });
  state.pulses = state.pulses.filter((pulse) => pulse.age < pulse.duration);

  state.ripples.forEach((ripple) => { ripple.age += dt; });
  state.ripples = state.ripples.filter((ripple) => ripple.age < ripple.life);

  state.reactions.forEach((reaction) => { reaction.age += dt; });
  state.reactions = state.reactions.filter((reaction) => reaction.age < reaction.life);

  state.texts.forEach((text) => { text.age += dt; });
  state.texts = state.texts.filter((text) => text.age < text.life);

  state.confetti.forEach((piece) => {
    piece.age += dt;
    piece.x += piece.vx * dt / Math.max(view.w, 1);
    piece.y += piece.vy * dt / Math.max(view.h, 1);
    piece.vy += 150 * dt;
    piece.rotation += piece.spin * dt;
  });
  state.confetti = state.confetti.filter((piece) => piece.age < piece.life);

  if (state.hintLine && performance.now() > state.hintLine.until) state.hintLine = null;
  if (state.human.present && performance.now() - state.human.lastSeen > 5000) state.human.present = false;

  state.charge = clamp(state.charge + dt * (state.camera ? 3.6 : 3), 0, 100);
  state.reactionLevel = clamp(state.reactionLevel - dt * 0.038, 0, 1);
  state.worldFlash = Math.max(0, state.worldFlash - dt * 1.35);
  ui.environmentFlash.style.opacity = (state.worldFlash * 0.26).toFixed(3);
}

function update(dt, now) {
  if (state.phase === "playing" || state.phase === "finishing") {
    state.elapsed = (now - state.startTime) / 1000;
  }
  updateMovement(dt);
  checkSector(now);
  checkFound(now);
  checkMutation(now);
  updateEffects(dt);
  updateDialogue(dt);
  updateHUD();
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawSimulationBackground(now) {
  const { w, h } = view;
  const time = now / 1000;
  const background = ctx.createLinearGradient(0, 0, w, h);
  background.addColorStop(0, "#07162b");
  background.addColorStop(0.5, "#0a1025");
  background.addColorStop(1, "#100a21");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);

  for (let index = 0; index < 3; index += 1) {
    const x = w * (0.2 + index * 0.3 + Math.sin(time * 0.14 + index * 2.1) * 0.07);
    const y = h * (0.22 + (index % 2) * 0.5 + Math.cos(time * 0.11 + index) * 0.08);
    const radius = Math.max(w, h) * (0.32 + state.reactionLevel * 0.08);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, paletteColor(world.palette, index, 0.16 + state.reactionLevel * 0.06));
    glow.addColorStop(0.5, paletteColor(world.palette, index, 0.045));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.save();
  ctx.strokeStyle = "rgba(150, 210, 255, 0.055)";
  ctx.lineWidth = 1;
  const grid = 46;
  const offset = (time * 8) % grid;
  for (let x = -grid + offset; x < w + grid; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = -grid + offset; y < h + grid; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  const horizon = ctx.createLinearGradient(0, h * 0.55, 0, h);
  horizon.addColorStop(0, "rgba(0,0,0,0)");
  horizon.addColorStop(1, paletteColor(world.palette, 1, 0.08));
  ctx.fillStyle = horizon;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
}

function drawCameraBackdrop(now) {
  const { w, h } = view;
  ctx.save();
  ctx.fillStyle = `rgba(3, 10, 20, ${0.06 + state.reactionLevel * 0.035})`;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = paletteColor(world.palette, 0, 0.07);
  ctx.lineWidth = 1;
  for (let x = 40; x < w; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 40; y < h; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  const waveY = h * (0.5 + Math.sin(now / 1400) * 0.18);
  const wave = ctx.createLinearGradient(0, waveY - 40, 0, waveY + 40);
  wave.addColorStop(0, "rgba(0,0,0,0)");
  wave.addColorStop(0.5, paletteColor(world.palette, 2, 0.035));
  wave.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = wave;
  ctx.fillRect(0, waveY - 40, w, 80);
  ctx.restore();
}

function drawSectors(now) {
  const { w, h } = view;
  ctx.save();
  for (const sector of world.sectors) {
    const x = sector.x * w + 7;
    const y = sector.y * h + 7;
    const sw = sector.w * w - 14;
    const sh = sector.h * h - 14;
    const isCurrent = sector.id === state.currentSector.id;
    const alpha = (state.camera ? 0.025 : 0.045) + sector.energy * 0.012 + (isCurrent ? 0.028 : 0);
    ctx.fillStyle = `hsla(${sector.hue}, 82%, 58%, ${alpha})`;
    roundedRect(ctx, x, y, sw, sh, 13);
    ctx.fill();
    ctx.setLineDash(isCurrent ? [5, 6] : [2, 9]);
    ctx.lineWidth = isCurrent ? 1.4 : 1;
    ctx.strokeStyle = `hsla(${sector.hue}, 92%, 70%, ${state.camera ? 0.2 : 0.27})`;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "800 9px Inter, system-ui, sans-serif";
    ctx.fillStyle = `hsla(${sector.hue}, 90%, 78%, ${state.camera ? 0.72 : 0.85})`;
    ctx.fillText(`${sector.icon} ${sector.name.toUpperCase()}`, x + 12, y + 20, sw - 20);

    const pulse = 0.5 + Math.sin(now / 900 + sector.energy * 7) * 0.5;
    ctx.fillStyle = `hsla(${sector.hue}, 92%, 70%, ${0.24 + pulse * 0.25})`;
    ctx.beginPath();
    ctx.arc(x + sw - 14, y + 16, 2.4 + pulse * 1.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles(now) {
  const { w, h } = view;
  const time = now / 1000;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  world.particles.forEach((particle, index) => {
    let x = particle.x;
    let y = particle.y;
    if (world.weather.id === "lluvia") {
      x = (particle.x + time * 0.025 * particle.speed + Math.sin(time + particle.phase) * 0.006 + 1) % 1;
      y = (particle.y + time * 0.075 * particle.speed + 1) % 1;
    } else if (world.weather.id === "viento") {
      x = (particle.x + time * 0.035 * particle.speed + particle.drift * 0.025 + 1) % 1;
      y = (particle.y + Math.sin(time * 0.7 + particle.phase) * 0.012 + 1) % 1;
    } else {
      x = (particle.x + Math.sin(time * 0.35 + particle.phase) * 0.008 + 1) % 1;
      y = (particle.y - time * 0.006 * particle.speed + Math.cos(time * 0.28 + particle.phase) * 0.008 + 1) % 1;
    }
    const alpha = (state.camera ? 0.22 : 0.38) * particle.depth * (0.7 + state.reactionLevel * 0.5);
    ctx.fillStyle = paletteColor(world.palette, index % 3, alpha);
    ctx.beginPath();
    ctx.arc(x * w, y * h, particle.radius * particle.depth, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

function drawObstacles(now) {
  const { w, h } = view;
  const time = now / 1000;
  ctx.save();
  world.obstacles.forEach((obstacle, index) => {
    const x = obstacle.x * w;
    const y = obstacle.y * h;
    const width = obstacle.w * w;
    const height = obstacle.h * h;
    const pulse = 0.5 + Math.sin(time * 1.4 + obstacle.phase) * 0.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowBlur = 16;
    ctx.shadowColor = paletteColor(world.palette, 1, 0.24);
    const gradient = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    gradient.addColorStop(0, paletteColor(world.palette, 1, state.camera ? 0.12 : 0.22));
    gradient.addColorStop(1, paletteColor(world.palette, 0, state.camera ? 0.05 : 0.1));
    ctx.fillStyle = gradient;
    roundedRect(ctx, -width / 2, -height / 2, width, height, obstacle.shape === "pillar" ? 10 : 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = paletteColor(world.palette, 1, 0.35 + pulse * 0.18);
    ctx.stroke();
    ctx.strokeStyle = paletteColor(world.palette, 0, 0.26);
    ctx.beginPath();
    if (obstacle.shape === "gate") {
      ctx.moveTo(-width * 0.34, 0);
      ctx.lineTo(width * 0.34, 0);
    } else {
      ctx.moveTo(0, -height * 0.34);
      ctx.lineTo(0, height * 0.34);
    }
    ctx.stroke();
    if (index % 3 === 0) {
      ctx.fillStyle = paletteColor(world.palette, 2, 0.55);
      ctx.beginPath();
      ctx.arc(0, 0, 1.8 + pulse, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  });
  ctx.restore();
}

function drawHumanoid(x, y, color, scale = 1, alpha = 1) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 18;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2 * scale;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(0, -12 * scale, 6.5 * scale, 0, TAU);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -4 * scale);
  ctx.lineTo(0, 9 * scale);
  ctx.moveTo(-7 * scale, 0);
  ctx.lineTo(7 * scale, 0);
  ctx.moveTo(0, 9 * scale);
  ctx.lineTo(-5 * scale, 18 * scale);
  ctx.moveTo(0, 9 * scale);
  ctx.lineTo(5 * scale, 18 * scale);
  ctx.stroke();
  ctx.restore();
}

function drawTag(x, y, text, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "800 9px Inter, system-ui, sans-serif";
  const width = ctx.measureText(text).width + 16;
  const height = 21;
  ctx.fillStyle = "rgba(4, 12, 24, 0.84)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  roundedRect(ctx, x - width / 2, y - height / 2, width, height, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function drawPeople(now) {
  const { w, h } = view;
  const time = now / 1000;
  ctx.save();
  for (const person of world.people) {
    const x = person.x * w;
    const y = person.y * h + Math.sin(time * 2 + person.phase) * 2.5;
    if (person.found) {
      ctx.strokeStyle = person.color;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.arc(x, y, 22 + Math.sin(time * 2 + person.phase) * 2, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawHumanoid(x, y, person.color, 0.9, 0.95);
      drawTag(x, y - 36, `✓ ${person.name.toUpperCase()}`, person.color, 0.92);
      continue;
    }

    const revealed = now < person.revealedUntil;
    if (revealed) {
      const remaining = (person.revealedUntil - now) / 1000;
      const alpha = clamp(remaining / 0.9, 0.35, 1);
      const ringRadius = 31 + Math.sin(time * 4 + person.phase) * 4;
      ctx.strokeStyle = person.color;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath();
      ctx.arc(x, y, ringRadius, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawHumanoid(x, y, person.color, 1.15, alpha);
      drawTag(x, y - 41, `SEÑAL 0${person.signal} · ACÉRCATE`, person.color, alpha);
    } else {
      const distance = distancePixels(state.robot, person);
      const proximity = clamp(1 - distance / 210, 0, 1) * world.weather.scan;
      const alpha = proximity * (state.camera ? 0.24 : 0.34);
      if (alpha > 0.015) {
        ctx.strokeStyle = person.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1;
        for (let ring = 0; ring < 2; ring += 1) {
          ctx.beginPath();
          ctx.arc(x, y, 9 + ring * 7 + Math.sin(time * 3 + person.phase + ring) * 2, 0, TAU);
          ctx.stroke();
        }
        ctx.fillStyle = person.color;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
  ctx.restore();
}

function drawDecoys(now) {
  ctx.save();
  for (const decoy of world.decoys) {
    if (now >= decoy.aliveUntil) continue;
    const x = decoy.x * view.w;
    const y = decoy.y * view.h;
    const alpha = clamp((decoy.aliveUntil - now) / 1800, 0, 1);
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = paletteColor(world.palette, 1, 1);
    ctx.lineWidth = 1.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4 + Math.sin(now / 300 + decoy.phase) * 0.2);
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();
    ctx.font = "800 9px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = paletteColor(world.palette, 1, 0.9);
    ctx.fillText("ECO", x, y - 13);
  }
  ctx.restore();
}

function drawPulses(now) {
  ctx.save();
  for (const pulse of state.pulses) {
    const progress = clamp(pulse.age / pulse.duration, 0, 1);
    const eased = 1 - (1 - progress) ** 3;
    const radius = eased * pulse.max;
    const alpha = (1 - progress) * 0.82;
    const x = pulse.x * view.w;
    const y = pulse.y * view.h;
    const gradient = ctx.createRadialGradient(x, y, Math.max(0, radius - 26), x, y, radius);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, paletteColor(world.palette, 0, alpha * 0.12));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = paletteColor(world.palette, 0, alpha);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = paletteColor(world.palette, 2, alpha * 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.72, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHintLine(now) {
  if (!state.hintLine || now > state.hintLine.until) return;
  const { from, to, color } = state.hintLine;
  const alpha = clamp((state.hintLine.until - now) / 1000, 0, 1) * 0.75;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setLineDash([7, 8]);
  ctx.lineDashOffset = -now / 55;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(from.x * view.w, from.y * view.h);
  ctx.lineTo(to.x * view.w, to.y * view.h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawReactions() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const reaction of state.reactions) {
    const progress = clamp(reaction.age / reaction.life, 0, 1);
    const alpha = (1 - progress) * 0.72;
    const x = reaction.x * view.w;
    const y = reaction.y * view.h;
    const radius = (18 + progress * 95) * reaction.strength;
    const colorIndex = reaction.source === "mutación" ? 1 : 2;
    ctx.strokeStyle = paletteColor(world.palette, colorIndex, alpha);
    ctx.lineWidth = 1.2;
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath();
      ctx.arc(x, y, radius * (0.35 + ring * 0.32), 0, TAU);
      ctx.stroke();
    }
    for (let petal = 0; petal < 10; petal += 1) {
      const angle = reaction.phase + petal * TAU / 10 + progress * 0.8;
      const inner = radius * 0.22;
      const outer = radius * (0.7 + Math.sin(petal * 2.3) * 0.12);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
      ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
      ctx.stroke();
      ctx.fillStyle = paletteColor(world.palette, colorIndex, alpha * 0.8);
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer, 1.8, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawRipples() {
  ctx.save();
  for (const ripple of state.ripples) {
    const progress = clamp(ripple.age / ripple.life, 0, 1);
    const alpha = (1 - progress) * 0.9;
    const radius = 5 + progress * 42 * ripple.strength;
    ctx.strokeStyle = ripple.color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ripple.x * view.w, ripple.y * view.h, radius, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTarget() {
  if (!state.targetVisible) return;
  const x = state.robot.tx * view.w;
  const y = state.robot.ty * view.h;
  ctx.save();
  ctx.strokeStyle = paletteColor(world.palette, 0, 0.5);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.lineDashOffset = -performance.now() / 80;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x - 19, y); ctx.lineTo(x - 8, y);
  ctx.moveTo(x + 8, y); ctx.lineTo(x + 19, y);
  ctx.moveTo(x, y - 19); ctx.lineTo(x, y - 8);
  ctx.moveTo(x, y + 8); ctx.lineTo(x, y + 19);
  ctx.stroke();
  ctx.restore();
}

function drawFallbackRobot(width, height) {
  ctx.save();
  ctx.fillStyle = "#a9d9ff";
  ctx.strokeStyle = "#67b9ec";
  ctx.lineWidth = 3;
  roundedRect(ctx, -width / 2, -height / 2 + height * 0.12, width, height * 0.72, width * 0.42);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#0d2036";
  ctx.beginPath();
  ctx.ellipse(-width * 0.17, -height * 0.05, width * 0.09, height * 0.11, 0, 0, TAU);
  ctx.ellipse(width * 0.17, -height * 0.05, width * 0.09, height * 0.11, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawRobot(now) {
  const { w, h } = view;
  const time = now / 1000;
  const x = state.robot.x * w;
  const bob = Math.sin(time * 2.8) * 4;
  const y = state.robot.y * h + bob;
  const spriteHeight = clamp(h * 0.19, 82, 146);
  const spriteWidth = spriteHeight * (683 / 966);

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  ctx.beginPath();
  ctx.ellipse(x, y + spriteHeight * 0.43, spriteWidth * 0.35, 8, 0, 0, TAU);
  ctx.fill();

  const aura = ctx.createRadialGradient(x, y, 4, x, y, spriteWidth * 0.8);
  aura.addColorStop(0, paletteColor(world.palette, 0, 0.17 + state.reactionLevel * 0.08));
  aura.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(x, y, spriteWidth * 0.8, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = paletteColor(world.palette, 0, 0.45);
  ctx.lineWidth = 1.1;
  ctx.setLineDash([4, 7]);
  ctx.lineDashOffset = -time * 18;
  ctx.beginPath();
  ctx.ellipse(x, y + spriteHeight * 0.34, spriteWidth * 0.48, 12, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(state.robot.facing, 1);
  if (robotImageReady) {
    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.drawImage(robotImage, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
  } else {
    drawFallbackRobot(spriteWidth, spriteHeight);
  }
  ctx.restore();

  ctx.strokeStyle = paletteColor(world.palette, 2, 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - spriteHeight * 0.51);
  ctx.lineTo(x, y - spriteHeight * 0.59);
  ctx.stroke();
  ctx.fillStyle = paletteColor(world.palette, 2, 0.75);
  ctx.beginPath();
  ctx.arc(x, y - spriteHeight * 0.6, 2.5 + Math.sin(time * 5) * 0.8, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawFloatingTexts() {
  ctx.save();
  ctx.textAlign = "center";
  for (const item of state.texts) {
    const progress = clamp(item.age / item.life, 0, 1);
    ctx.globalAlpha = (1 - progress) * 0.95;
    ctx.font = "800 10px Inter, system-ui, sans-serif";
    ctx.fillStyle = item.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = item.color;
    ctx.fillText(item.text, item.x * view.w, item.y * view.h - progress * 28);
  }
  ctx.restore();
}

function drawConfetti() {
  ctx.save();
  for (const piece of state.confetti) {
    const alpha = 1 - clamp(piece.age / piece.life, 0, 1);
    ctx.save();
    ctx.translate(piece.x * view.w, piece.y * view.h);
    ctx.rotate(piece.rotation);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = piece.color;
    ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 1.6);
    ctx.restore();
  }
  ctx.restore();
}

function drawBracketBox(x, y, width, height, color, label) {
  const corner = Math.min(15, width * 0.25, height * 0.25);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const corners = [
    [x, y, 1, 1], [x + width, y, -1, 1],
    [x, y + height, 1, -1], [x + width, y + height, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * corner, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * corner);
    ctx.stroke();
  }
  if (label) {
    ctx.font = "800 9px Inter, system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(label, x, y - 7);
  }
  ctx.restore();
}

function drawVisionOverlay(now) {
  if (!state.camera) return;
  const { w, h } = view;
  ctx.save();
  drawBracketBox(18, 58, w - 36, h - 76, paletteColor(world.palette, 0, 0.22), null);

  if (state.human.faces.length && now - state.human.lastFaceAt < 1700) {
    for (const face of state.human.faces) {
      const rect = mapVideoRectToStage(face, ui.cameraVideo.videoWidth, ui.cameraVideo.videoHeight);
      if (!rect) continue;
      drawBracketBox(rect.x, rect.y, rect.w, rect.h, paletteColor(world.palette, 2, 0.9), "PERSONA REAL · LOCAL");
    }
  }

  if (state.human.present && state.human.region) {
    const x = state.human.region.x * w;
    const y = state.human.region.y * h;
    const pulse = 18 + Math.sin(now / 180) * 4;
    ctx.strokeStyle = paletteColor(world.palette, 2, 0.75);
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(x, y, pulse, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "800 8px Inter, system-ui, sans-serif";
    ctx.fillStyle = paletteColor(world.palette, 2, 0.9);
    ctx.fillText("PRESENCIA", x + 24, y - 13);
  }
  ctx.restore();
}

function drawVignette() {
  const { w, h } = view;
  const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, state.camera ? "rgba(2,7,16,0.5)" : "rgba(2,5,13,0.62)");
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawRadar(now) {
  const { w, h } = radarView;
  if (w <= 1 || h <= 1) return;
  const time = now / 1000;
  radarCtx.clearRect(0, 0, w, h);
  radarCtx.fillStyle = "#050e1b";
  radarCtx.fillRect(0, 0, w, h);

  radarCtx.save();
  radarCtx.strokeStyle = paletteColor(world.palette, 0, 0.12);
  radarCtx.lineWidth = 1;
  for (let col = 1; col < 3; col += 1) {
    radarCtx.beginPath(); radarCtx.moveTo(w * col / 3, 0); radarCtx.lineTo(w * col / 3, h); radarCtx.stroke();
  }
  for (let row = 1; row < 2; row += 1) {
    radarCtx.beginPath(); radarCtx.moveTo(0, h * row / 2); radarCtx.lineTo(w, h * row / 2); radarCtx.stroke();
  }
  world.sectors.forEach((sector) => {
    radarCtx.fillStyle = `hsla(${sector.hue}, 88%, 60%, ${0.025 + sector.energy * 0.015})`;
    radarCtx.fillRect(sector.x * w + 1, sector.y * h + 1, sector.w * w - 2, sector.h * h - 2);
  });

  const angle = (time * 0.9) % TAU;
  radarCtx.strokeStyle = paletteColor(world.palette, 0, 0.38);
  radarCtx.beginPath();
  radarCtx.moveTo(w / 2, h / 2);
  radarCtx.lineTo(w / 2 + Math.cos(angle) * w, h / 2 + Math.sin(angle) * w);
  radarCtx.stroke();

  world.people.forEach((person) => {
    if (person.found) {
      radarCtx.fillStyle = person.color;
      radarCtx.shadowBlur = 9;
      radarCtx.shadowColor = person.color;
      radarCtx.beginPath();
      radarCtx.arc(person.x * w, person.y * h, 3.2, 0, TAU);
      radarCtx.fill();
      radarCtx.shadowBlur = 0;
    } else if (performance.now() < person.revealedUntil) {
      radarCtx.strokeStyle = person.color;
      radarCtx.lineWidth = 1;
      radarCtx.beginPath();
      radarCtx.arc(person.x * w, person.y * h, 4 + Math.sin(time * 5) * 1.5, 0, TAU);
      radarCtx.stroke();
    }
  });

  const rx = state.robot.x * w;
  const ry = state.robot.y * h;
  radarCtx.fillStyle = "#d9f4ff";
  radarCtx.shadowBlur = 8;
  radarCtx.shadowColor = paletteColor(world.palette, 0, 1);
  radarCtx.beginPath();
  radarCtx.moveTo(rx, ry - 6);
  radarCtx.lineTo(rx - 4.5, ry + 5);
  radarCtx.lineTo(rx + 4.5, ry + 5);
  radarCtx.closePath();
  radarCtx.fill();
  radarCtx.restore();
}

function render(now) {
  ctx.clearRect(0, 0, view.w, view.h);
  if (state.camera) drawCameraBackdrop(now);
  else drawSimulationBackground(now);
  drawSectors(now);
  drawParticles(now);
  drawHintLine(now);
  drawObstacles(now);
  drawDecoys(now);
  drawPeople(now);
  drawPulses(now);
  drawReactions();
  drawRipples();
  drawTarget();
  drawRobot(now);
  drawFloatingTexts();
  drawConfetti();
  drawVisionOverlay(now);
  drawVignette();
  drawRadar(now);
}

function loop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - state.lastFrame) / 1000));
  state.lastFrame = now;
  update(dt, now);
  render(now);
  requestAnimationFrame(loop);
}

function bindEvents() {
  ui.startSimulation.addEventListener("click", () => beginMission(false));
  ui.startCamera.addEventListener("click", () => beginMission(true));
  ui.introSkip.addEventListener("click", () => beginMission(false));
  ui.helpButton.addEventListener("click", () => ui.helpModal.classList.add("visible"));
  ui.helpClose.addEventListener("click", () => ui.helpModal.classList.remove("visible"));
  ui.helpUnderstood.addEventListener("click", () => ui.helpModal.classList.remove("visible"));
  ui.helpModal.addEventListener("click", (event) => {
    if (event.target === ui.helpModal) ui.helpModal.classList.remove("visible");
  });
  ui.playAgain.addEventListener("click", () => generateMission());

  ui.scanButton.addEventListener("click", () => scan("button"));
  ui.hintButton.addEventListener("click", () => hint());
  ui.regenButton.addEventListener("click", () => generateMission());
  ui.cameraButton.addEventListener("click", toggleCamera);
  ui.soundButton.addEventListener("click", () => {
    state.sound = !state.sound;
    sound.setEnabled(state.sound);
    if (!state.sound) voice.cancelSpeech();
    else sound.play("click");
    updateHUD(true);
  });

  ui.commandForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = ui.commandInput.value;
    ui.commandInput.value = "";
    processCommand(value, "text");
  });
  document.querySelectorAll(".command-chips button").forEach((button) => {
    button.addEventListener("click", () => processCommand(button.dataset.command, "chip"));
  });
  ui.voiceButton.addEventListener("click", () => {
    sound.warm();
    if (state.voiceListening) {
      voice.stop();
      setVoiceListening(false);
    } else {
      voice.start();
      setVoiceListening(true);
    }
  });

  ui.canvas.addEventListener("pointerdown", (event) => {
    if (state.phase === "won") return;
    const point = pointerToWorld(event);
    const robotX = state.robot.x * view.w;
    const robotY = state.robot.y * view.h;
    const nearRobot = Math.hypot(point.x * view.w - robotX, point.y * view.h - robotY) < 75;
    state.dragging = nearRobot;
    state.pointerId = event.pointerId;
    ui.canvas.setPointerCapture(event.pointerId);
    setRobotTarget(point.x, point.y);
    addRipple(point.x, point.y, paletteColor(world.palette, 0, 0.75), 0.75, 0.75);
    state.reactionLevel = clamp(state.reactionLevel + 0.055, 0, 1);
    sound.play("click");
    event.preventDefault();
  });
  ui.canvas.addEventListener("pointermove", (event) => {
    const point = pointerToWorld(event);
    if (state.dragging && state.pointerId === event.pointerId) setRobotTarget(point.x, point.y);
  });
  const endPointer = (event) => {
    if (state.pointerId === event.pointerId) {
      state.dragging = false;
      state.pointerId = null;
    }
  };
  ui.canvas.addEventListener("pointerup", endPointer);
  ui.canvas.addEventListener("pointercancel", endPointer);

  const directionKeys = {
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
    ArrowUp: "up", w: "up", W: "up",
    ArrowDown: "down", s: "down", S: "down",
  };
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const direction = directionKeys[event.key];
    if (direction) {
      event.preventDefault();
      state.keys.add(direction);
      return;
    }
    if (event.repeat) return;
    if (event.code === "Space") { event.preventDefault(); scan("keyboard"); }
    else if (event.key.toLowerCase() === "h") hint();
    else if (event.key.toLowerCase() === "c") toggleCamera();
    else if (event.key.toLowerCase() === "r") generateMission();
    else if (event.key === "Escape") ui.helpModal.classList.remove("visible");
  });
  window.addEventListener("keyup", (event) => {
    const direction = directionKeys[event.key];
    if (direction) state.keys.delete(direction);
  });
  window.addEventListener("blur", () => state.keys.clear());

  const dpadDirections = { up: "up", left: "left", down: "down", right: "right" };
  document.querySelectorAll(".dpad button").forEach((button) => {
    const direction = dpadDirections[button.dataset.direction];
    const press = (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      state.keys.add(direction);
      button.classList.add("active");
    };
    const release = () => {
      state.keys.delete(direction);
      button.classList.remove("active");
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  window.addEventListener("resize", resizeAll);
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(resizeAll);
    observer.observe(ui.stage);
    observer.observe(ui.radarCanvas);
  }
}

refreshWorldUI();
refreshPeopleUI();
resizeAll();
bindEvents();
updateHUD(true);
setDialogue(state.dialogue.full, "DESPIERTO", "semilla + humano");
ui.speechText.textContent = state.dialogue.full;
state.dialogue.shown = state.dialogue.full.length;
logEvent("SISTEMA", `${world.name} generado · semilla ${state.seed}`);
logEvent("MUNDO", `${world.weather.name} · ${world.anomaly.name}`);
requestAnimationFrame(loop);
