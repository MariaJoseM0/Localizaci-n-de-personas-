/**
 * Núcleo puro del juego. No depende del DOM, por lo que puede probarse en Node.
 * Genera el escenario del sismo, las víctimas atrapadas y construye las
 * respuestas contextuales de Rafy.
 */

export const PEOPLE_PROFILES = [
  { name: "Alma", role: "Exploradora", emoji: "✦", color: "#7ee9ff", quote: "Seguí las luces hasta que el suelo se movió." },
  { name: "Nico", role: "Cartógrafo", emoji: "◇", color: "#c7ff70", quote: "Mi mapa cambió cuando la losa cayó encima." },
  { name: "Iris", role: "Botánica", emoji: "❋", color: "#ff91d0", quote: "Escucho mi teléfono vibrar entre los escombros." },
  { name: "Teo", role: "Ingeniero", emoji: "⌬", color: "#ffc86e", quote: "Dejé la batería al 8 %; encuentra esa señal." },
  { name: "Vera", role: "Médica de urgencias", emoji: "✚", color: "#b39cff", quote: "Tengo agua y una linterna: no me queda mucho tiempo." },
  { name: "Nael", role: "Bombero", emoji: "△", color: "#ffa06e", quote: "Estaba despejando el pasillo cuando cayó la réplica." },
  { name: "Sol", role: "Radioaficionada", emoji: "◍", color: "#8ef0c8", quote: "Mi celular sigue emitiendo, pero la batería se acaba." },
];

/**
 * Niveles de dificultad. La progresión es lineal: se desbloquea el siguiente
 * al completar una misión. `signalRange` y `signalNoise` definen el detector.
 */
export const DIFFICULTIES = [
  {
    id: "facil",
    name: "Fácil",
    tagline: "Primer turno de guardia",
    people: 3,
    signalRange: 0.44,
    signalNoise: 0.05,
    phoneDrain: 0.55,
    decoyPhones: 0,
    extractionPulses: 2,
    aftershockEvery: [70, 100],
    aftershockRubble: 1,
    scanCost: 18,
    scanRadius: 0.44,
    hints: 4,
    chargeRegen: 4.4,
    rubbleDensity: 0.7,
    minMagnitude: 4.4,
  },
  {
    id: "normal",
    name: "Normal",
    tagline: "Protocolo sísmico estándar",
    people: 5,
    signalRange: 0.34,
    signalNoise: 0.09,
    phoneDrain: 0.85,
    decoyPhones: 1,
    extractionPulses: 3,
    aftershockEvery: [52, 74],
    aftershockRubble: 2,
    scanCost: 22,
    scanRadius: 0.4,
    hints: 3,
    chargeRegen: 3.4,
    rubbleDensity: 1,
    minMagnitude: 5.1,
  },
  {
    id: "dificil",
    name: "Difícil",
    tagline: "Réplicas constantes",
    people: 6,
    signalRange: 0.27,
    signalNoise: 0.15,
    phoneDrain: 1.2,
    decoyPhones: 3,
    extractionPulses: 3,
    aftershockEvery: [34, 50],
    aftershockRubble: 3,
    scanCost: 26,
    scanRadius: 0.36,
    hints: 2,
    chargeRegen: 2.8,
    rubbleDensity: 1.25,
    minMagnitude: 5.9,
  },
  {
    id: "extremo",
    name: "Extremo",
    tagline: "Ciudad colapsada",
    people: 7,
    signalRange: 0.21,
    signalNoise: 0.21,
    phoneDrain: 1.6,
    decoyPhones: 5,
    extractionPulses: 4,
    aftershockEvery: [22, 34],
    aftershockRubble: 4,
    scanCost: 30,
    scanRadius: 0.32,
    hints: 1,
    chargeRegen: 2.2,
    rubbleDensity: 1.5,
    minMagnitude: 6.6,
  },
];

export const DIFFICULTY_ORDER = DIFFICULTIES.map((difficulty) => difficulty.id);
export const DEFAULT_DIFFICULTY = "normal";

export function difficultyById(id) {
  return DIFFICULTIES.find((difficulty) => difficulty.id === id)
    || DIFFICULTIES.find((difficulty) => difficulty.id === DEFAULT_DIFFICULTY)
    || DIFFICULTIES[0];
}

export function nextDifficultyId(id) {
  const index = DIFFICULTY_ORDER.indexOf(id);
  if (index < 0 || index >= DIFFICULTY_ORDER.length - 1) return null;
  return DIFFICULTY_ORDER[index + 1];
}

/** Niveles desbloqueados de forma lineal (1 = solo Fácil, 4 = todos). */
export function isDifficultyUnlocked(id, unlockedCount = 1) {
  const index = DIFFICULTY_ORDER.indexOf(id);
  return index >= 0 && index < clamp(unlockedCount, 1, DIFFICULTY_ORDER.length);
}

/** Señal mínima para poder excavar (compartida con la interfaz). */
export const EXCAVATION_THRESHOLD = 0.36;

export const SIGNAL_LABELS = [
  { max: 0.0001, label: "SIN SEÑAL", tone: "off" },
  { max: 0.16, label: "MUY DÉBIL", tone: "weak" },
  { max: 0.34, label: "DÉBIL", tone: "weak" },
  { max: 0.52, label: "INTERMITENTE", tone: "mid" },
  { max: 0.72, label: "CLARA", tone: "good" },
  { max: 1.01, label: "FUERTE", tone: "strong" },
];

export function signalLabel(strength) {
  const value = clamp(Number(strength) || 0, 0, 1);
  return SIGNAL_LABELS.find((entry) => value < entry.max) || SIGNAL_LABELS[SIGNAL_LABELS.length - 1];
}

const SECTOR_NAMES = [
  "Atrio de Aurora", "Invernadero Beta", "Dársena de Ecos", "Biblioteca Índigo",
  "Puente Calipso", "Jardín de Niebla", "Taller Helio", "Mirador Cobalto",
  "Cúpula Aurea", "Patio de Cometas", "Nodo Selenita", "Laboratorio Vértice",
];

const WORLD_FIRST = ["Estación", "Ciudadela", "Archipiélago", "Refugio", "Observatorio", "Jardín", "Nexo"];
const WORLD_SECOND = ["Aurora", "Ceniza", "Cobalto", "Eco", "Lumen", "Miró", "Orión", "Prisma", "Vesper"];

export const WEATHERS = [
  {
    id: "aurora", name: "Aurora elástica", icon: "✦", scan: 1.16, speed: 1.06, reveal: 1.18,
    description: "cintas de luz que estiran los ecos del escáner",
    reply: "La aurora elástica agranda mi pulso, aunque curva las señales.",
  },
  {
    id: "niebla", name: "Niebla electromagnética", icon: "≋", scan: 0.84, speed: 0.92, reveal: 0.82,
    description: "una niebla que dispersa los nombres antes de leerlos",
    reply: "La niebla electromagnética acorta mi radar y vuelve tímidas las huellas.",
  },
  {
    id: "lluvia", name: "Lluvia de datos", icon: "⌁", scan: 1.02, speed: 1.0, reveal: 0.96,
    description: "partículas de información que caen en diagonal",
    reply: "La lluvia de datos dibuja rutas nuevas con cada gota.",
  },
  {
    id: "viento", name: "Viento solar", icon: "➶", scan: 1.08, speed: 1.12, reveal: 0.9,
    description: "corrientes doradas que empujan todas las partículas",
    reply: "El viento solar desplaza los ecos hacia donde sopla.",
  },
  {
    id: "calma", name: "Calma de cristal", icon: "◈", scan: 0.94, speed: 0.95, reveal: 1.26,
    description: "un silencio transparente que conserva cada huella",
    reply: "La calma de cristal congela las huellas durante más tiempo.",
  },
  {
    id: "marea", name: "Marea pulsante", icon: "◉", scan: 1.1, speed: 0.9, reveal: 1.02,
    description: "ondas lentas que suben y bajan como un océano luminoso",
    reply: "La marea pulsante hace respirar el alcance de mi escáner.",
  },
];

export const ANOMALIES = [
  {
    id: "sombras", name: "Zona de sombra", icon: "◐", decoys: 4, distortion: 1.25,
    description: "algunos sectores producen señales falsas",
    reply: "La zona de sombra siembra señales falsas entre los sectores.",
  },
  {
    id: "eco", name: "Puente de eco", icon: "◎", decoys: 1, distortion: 0.78,
    description: "los obstáculas devuelven versiones limpias de cada señal",
    reply: "El puente de eco atraviesa los bloqueos y devuelve pistas más claras.",
  },
  {
    id: "termico", name: "Rastro térmico", icon: "♨", decoys: 2, distortion: 0.9,
    description: "las personas dejan estelas cálidas al moverse",
    reply: "El rastro térmico deja una estela alrededor de las personas.",
  },
  {
    id: "fractal", name: "Interferencia fractal", icon: "❖", decoys: 3, distortion: 1.12,
    description: "las paredes repiten fragmentos del mismo mensaje",
    reply: "La interferencia fractal multiplica los reflejos de cada escaneo.",
  },
  {
    id: "simbiotico", name: "Eco simbiótico", icon: "✺", decoys: 2, distortion: 0.84,
    description: "el mundo florece donde una persona real se mueve",
    reply: "El eco simbiótico convierte tu presencia en nuevas constelaciones.",
  },
];

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(items, random) {
  return items[Math.floor(random() * items.length) % items.length];
}

function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makePalette(random, baseHue = null) {
  const hue = baseHue ?? Math.floor(random() * 360);
  const hues = [hue, (hue + 58 + Math.floor(random() * 45)) % 360, (hue + 145 + Math.floor(random() * 55)) % 360];
  return { hue: hues[0], hues };
}

export function paletteColor(palette, index = 0, alpha = 1) {
  const paletteHues = palette?.hues || [190, 260, 95];
  const hue = paletteHues[index % paletteHues.length];
  return `hsla(${hue}, 92%, 66%, ${alpha})`;
}

export function paletteCss(palette, index = 0) {
  const paletteHues = palette?.hues || [190, 260, 95];
  return `hsl(${paletteHues[index % paletteHues.length]}, 86%, 66%)`;
}

function makeSectors(random, palette, quake) {
  const names = shuffled(SECTOR_NAMES, random).slice(0, 6);
  const icons = ["◇", "✦", "◈", "❋", "⌬", "◎"];
  const sectors = [];
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const index = row * 3 + col;
      const x = col / 3;
      const y = row / 2;
      const centerX = x + 1 / 6;
      const centerY = y + 1 / 4;
      // El daño decae con la distancia al epicentro del sismo.
      const distance = quake ? Math.hypot(centerX - quake.epicenter.x, centerY - quake.epicenter.y) : 0.5;
      const damage = quake
        ? clamp((1 - distance / 1.05) * (0.55 + quake.intensity * 0.55) + random() * 0.12, 0.05, 1)
        : 0;
      sectors.push({
        id: `sector-${index + 1}`,
        name: names[index],
        icon: icons[index],
        x,
        y,
        w: 1 / 3,
        h: 1 / 2,
        hue: (palette.hues[index % 3] + Math.floor(random() * 20) - 10 + 360) % 360,
        energy: 0.35 + random() * 0.65,
        damage: Number(damage.toFixed(3)),
        cleared: false,
      });
    }
  }
  return sectors;
}

function makePeople(random, sectors, difficulty) {
  const count = difficulty.people;
  const spawn = { x: 0.5, y: 0.86 };
  // Si hay más víctimas que sectores, se repiten sectores (nunca el mismo punto).
  const sectorIndices = [];
  while (sectorIndices.length < count) {
    sectorIndices.push(...shuffled(sectors.map((_, index) => index), random));
  }

  return PEOPLE_PROFILES.slice(0, count).map((profile, index) => {
    const sector = sectors[sectorIndices[index]];
    let x = sector.x + sector.w * (0.22 + random() * 0.56);
    let y = sector.y + sector.h * (0.24 + random() * 0.52);
    if (Math.hypot(x - spawn.x, y - spawn.y) < 0.18) {
      y = clamp(y - 0.18, 0.12, 0.66);
    }
    const depth = 0.35 + random() * 0.65;
    return {
      ...profile,
      id: `person-${index + 1}`,
      signal: index + 1,
      x,
      y,
      sector: sector.name,
      sectorId: sector.id,
      phase: random() * Math.PI * 2,
      found: false,
      revealedUntil: 0,
      foundAt: 0,
      // Celular bajo los escombros: es la única forma de detectarla.
      phone: {
        battery: 0.55 + random() * 0.45,
        drainScale: 0.8 + random() * 0.5,
        ringPhase: random() * Math.PI * 2,
        lost: false,
      },
      rubble: {
        depth,
        weight: 1.2 + depth * difficulty.extractionPulses * 0.9,
      },
      extraction: 0,
      extracted: false,
      lastSignal: 0,
    };
  });
}

/** Detector determinista del sismo inicial: epicentro, magnitud e intensidad. */
function makeQuake(random, difficulty) {
  const magnitude = difficulty.minMagnitude + random() * 0.8;
  const epicenter = { x: 0.12 + random() * 0.76, y: 0.14 + random() * 0.62 };
  return {
    magnitude: Number(magnitude.toFixed(1)),
    epicenter,
    intensity: clamp((magnitude - 4) / 3, 0.15, 1),
    name: pick(["Sismo de la madrugada", "Sacudida del cinturón", "Terremoto del valle", "Ola sísmica"], random),
    at: 0,
  };
}

/** Escombros: piezas de losa y polvo alrededor del epicentro y de las víctimas. */
function makeRubble(random, people, quake, difficulty, count) {
  const pieces = [];
  for (let index = 0; index < count; index += 1) {
    const victim = people[Math.floor(random() * people.length)];
    const nearEpicenter = random() < 0.4;
    const anchor = nearEpicenter ? quake.epicenter : victim;
    const spread = nearEpicenter ? 0.3 : 0.075;
    pieces.push({
      x: clamp(anchor.x + (random() - 0.5) * spread * 2, 0.03, 0.97),
      y: clamp(anchor.y + (random() - 0.5) * spread * 2, 0.05, 0.95),
      w: (0.022 + random() * 0.055) * difficulty.rubbleDensity,
      h: (0.016 + random() * 0.032) * difficulty.rubbleDensity,
      angle: (random() - 0.5) * Math.PI,
      shade: random(),
      settled: 0,
    });
  }
  return pieces;
}

/** Celulares ajenos que el detector también capta: falsos positivos. */
function makePhoneDecoys(random, people, quake, count) {
  const decoys = [];
  let attempts = 0;
  while (decoys.length < count && attempts < 200) {
    attempts += 1;
    const x = clamp(quake.epicenter.x + (random() - 0.5) * 0.8, 0.05, 0.95);
    const y = clamp(quake.epicenter.y + (random() - 0.5) * 0.7, 0.07, 0.93);
    if (people.some((person) => Math.hypot(person.x - x, person.y - y) < 0.075)) continue;
    decoys.push({
      id: `decoy-${decoys.length + 1}`,
      x,
      y,
      battery: 0.3 + random() * 0.5,
      phase: random() * Math.PI * 2,
      aliveUntil: 0,
      exposedUntil: 0,
    });
  }
  return decoys;
}

/**
 * Señal recibida de un celular en un punto del mapa (0..1).
 * Depende de la distancia, de la batería restante y del peso de los escombros.
 */
export function phoneSignal(person, point, difficulty = difficultyById(DEFAULT_DIFFICULTY)) {
  if (!person || person.found || person.extracted || !person.phone) return 0;
  const battery = clamp(person.phone.battery ?? 0, 0, 1);
  if (battery <= 0.02 || person.phone.lost) return 0;
  const distance = Math.hypot(person.x - point.x, person.y - point.y);
  const range = difficulty.signalRange * (0.55 + battery * 0.45);
  if (distance > range) return 0;
  const proximity = 1 - distance / range;
  // Atenuación acotada: con el teléfono vivo, encima de la víctima siempre se
  // supera EXCAVATION_THRESHOLD (probado en tests), así nunca queda bloqueada.
  const attenuation = 1 - (person.rubble?.depth ?? 0) * 0.22;
  return clamp(proximity * attenuation * (0.45 + battery * 0.55), 0, 1);
}

export function decoySignal(decoy, point, difficulty = difficultyById(DEFAULT_DIFFICULTY)) {
  if (!decoy) return 0;
  const battery = clamp(decoy.battery ?? 0, 0, 1);
  if (battery <= 0.02) return 0;
  const distance = Math.hypot(decoy.x - point.x, decoy.y - point.y);
  const range = difficulty.signalRange * 0.9;
  if (distance > range) return 0;
  return clamp((1 - distance / range) * (0.35 + battery * 0.6), 0, 1);
}

/**
 * Lectura del detector en un punto: la señal más fuerte entre víctimas y
 * teléfonos ajenos. Devuelve además quién la produce.
 */
export function strongestSignal(world, point, difficulty = difficultyById(DEFAULT_DIFFICULTY)) {
  let best = { strength: 0, person: null, decoy: null };
  for (const person of world.people) {
    const strength = phoneSignal(person, point, difficulty);
    if (strength > best.strength) best = { strength, person, decoy: null };
  }
  for (const decoy of world.phoneDecoys || []) {
    const strength = decoySignal(decoy, point, difficulty);
    if (strength > best.strength) best = { strength, person: null, decoy };
  }
  return best;
}

/** Pulso de extracción: avanza el rescate y devuelve el estado resultante. */
export function applyExtractionPulse(person, difficulty) {
  if (!person || person.found) return { rescued: false, progress: 0, required: difficulty.extractionPulses };
  person.extraction = Math.min(difficulty.extractionPulses, person.extraction + 1);
  const rescued = person.extraction >= difficulty.extractionPulses;
  if (rescued) {
    person.found = true;
    person.extracted = true;
    person.foundAt = Date.now();
  }
  return {
    rescued,
    progress: person.extraction,
    required: difficulty.extractionPulses,
  };
}

function makeObstacles(random, people, count = 9) {
  const obstacles = [];
  let attempts = 0;
  while (obstacles.length < count && attempts < 300) {
    attempts += 1;
    const w = 0.027 + random() * 0.052;
    const h = 0.022 + random() * 0.045;
    const x = 0.06 + random() * 0.88;
    const y = 0.1 + random() * 0.8;
    const tooCloseToPerson = people.some((person) => Math.hypot(person.x - x, person.y - y) < 0.085);
    const tooCloseToSpawn = Math.hypot(x - 0.5, y - 0.86) < 0.12;
    const overlaps = obstacles.some((obstacle) => Math.abs(obstacle.x - x) < (obstacle.w + w) * 0.65);
    if (tooCloseToPerson || tooCloseToSpawn || overlaps) continue;
    obstacles.push({
      x, y, w, h,
      phase: random() * Math.PI * 2,
      charge: random(),
      shape: random() > 0.5 ? "pillar" : "gate",
    });
  }
  return obstacles;
}

function makeDecoys(random, people, count) {
  const decoys = [];
  let attempts = 0;
  while (decoys.length < count && attempts < 150) {
    attempts += 1;
    const x = 0.07 + random() * 0.86;
    const y = 0.1 + random() * 0.8;
    if (people.some((person) => Math.hypot(person.x - x, person.y - y) < 0.07)) continue;
    decoys.push({ x, y, phase: random() * Math.PI * 2, aliveUntil: 0 });
  }
  return decoys;
}

function makeParticles(random, count = 80) {
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    radius: 0.5 + random() * 1.9,
    speed: 0.15 + random() * 0.75,
    drift: -0.5 + random(),
    phase: random() * Math.PI * 2,
    depth: 0.3 + random() * 0.7,
  }));
}

function worldDescription(world) {
  const { name, weather, anomaly, quake } = world;
  return `${name} quedó partido por el ${quake ? quake.name.toLowerCase() : "sismo"} (M${quake ? quake.magnitude.toFixed(1) : "?"}) y ahora respira con ${weather.description}. Su anomalía —${anomaly.name.toLowerCase()}— hace que ${anomaly.description}. Las víctimas siguen bajo los escombros: detéctalas por la señal de su celular.`;
}

/**
 * Genera un escenario de rescate completo.
 * `difficultyId` acepta los ids de DIFFICULTIES; si no se indica, usa Normal.
 */
export function createWorld(seed = 1, difficultyId = DEFAULT_DIFFICULTY) {
  const difficulty = difficultyById(difficultyId);
  const random = mulberry32(seed);
  const palette = makePalette(random);
  const weather = pick(WEATHERS, random);
  const anomaly = pick(ANOMALIES, random);
  const quake = makeQuake(random, difficulty);
  const sectors = makeSectors(random, palette, quake);
  const people = makePeople(random, sectors, difficulty);
  const obstacles = makeObstacles(random, people, 8 + Math.floor(random() * 5));
  const rubbleCount = Math.round((14 + difficulty.rubbleDensity * 10) * (0.7 + quake.intensity * 0.6));
  const world = {
    seed,
    difficulty: difficulty.id,
    name: `${pick(WORLD_FIRST, random)} ${pick(WORLD_SECOND, random)}`,
    subtitle: pick(["Protocolo de rescate", "Zona de derrumbe", "Búsqueda bajo escombros", "Archivo vivo"], random),
    palette,
    sectors,
    people,
    weather,
    anomaly,
    quake,
    obstacles,
    rubble: makeRubble(random, people, quake, difficulty, rubbleCount),
    phoneDecoys: makePhoneDecoys(random, people, quake, difficulty.decoyPhones),
    decoys: makeDecoys(random, people, anomaly.decoys),
    particles: makeParticles(random),
    mutation: 0,
    aftershocks: 0,
    description: "",
    signature: Math.floor(random() * 0xffffff).toString(16).padStart(6, "0").toUpperCase(),
  };
  world.description = worldDescription(world);
  return world;
}

/**
 * Réplica: añade escombros, vuelve a tapar sectores despejados y gasta batería
 * de los celulares. Conserva el progreso de rescate ya confirmado.
 */
export function applyAftershock(world, seed = Date.now(), difficulty = null) {
  const preset = difficulty || difficultyById(world.difficulty || DEFAULT_DIFFICULTY);
  const random = mulberry32((seed >>> 0) || 1);
  const count = 6 + preset.aftershockRubble * 4;
  for (let index = 0; index < count; index += 1) {
    const anchor = random() < 0.5
      ? world.quake.epicenter
      : world.people[Math.floor(random() * world.people.length)];
    world.rubble.push({
      x: clamp(anchor.x + (random() - 0.5) * 0.22, 0.03, 0.97),
      y: clamp(anchor.y + (random() - 0.5) * 0.2, 0.05, 0.95),
      w: 0.024 + random() * 0.05,
      h: 0.016 + random() * 0.03,
      angle: (random() - 0.5) * Math.PI,
      shade: random(),
      settled: 0,
    });
  }
  if (world.rubble.length > 140) world.rubble.splice(0, world.rubble.length - 140);

  for (const sector of world.sectors) {
    sector.damage = clamp(sector.damage + 0.08 + random() * 0.16, 0, 1);
    if (random() < 0.35) sector.cleared = false;
  }
  for (const person of world.people) {
    if (!person.phone || person.found) continue;
    person.phone.battery = clamp(person.phone.battery - 0.04 - random() * 0.06, 0, 1);
    // Una réplica deshace parte del trabajo de extracción en curso.
    if (person.extraction > 0 && random() < 0.55) {
      person.extraction = Math.max(0, person.extraction - 1);
    }
    person.rubble.depth = clamp(person.rubble.depth + 0.02, 0, 1);
  }
  for (const decoy of world.phoneDecoys) {
    decoy.battery = clamp(decoy.battery - 0.05, 0, 1);
  }
  world.aftershocks += 1;
  world.quake.intensity = clamp(world.quake.intensity + 0.03, 0, 1);
  world.description = worldDescription(world);
  return world;
}

/** Muta clima, anomalía y geometría, conservando a las personas y su progreso. */
export function applyMutation(world, seed = Date.now()) {
  const random = mulberry32(seed >>> 0);
  const weatherChoices = WEATHERS.filter((weather) => weather.id !== world.weather.id);
  const anomalyChoices = ANOMALIES.filter((anomaly) => anomaly.id !== world.anomaly.id);
  world.weather = pick(weatherChoices, random);
  world.anomaly = pick(anomalyChoices, random);
  world.palette = makePalette(random, (world.palette.hue + 24 + Math.floor(random() * 90)) % 360);
  world.particles = makeParticles(random, 80 + Math.floor(random() * 25));
  world.decoys = makeDecoys(random, world.people, world.anomaly.decoys);
  world.obstacles.forEach((obstacle) => {
    obstacle.x = clamp(obstacle.x + (random() - 0.5) * 0.055, 0.06, 0.94);
    obstacle.y = clamp(obstacle.y + (random() - 0.5) * 0.065, 0.1, 0.9);
    obstacle.phase = random() * Math.PI * 2;
  });
  world.sectors.forEach((sector, index) => {
    sector.energy = 0.35 + random() * 0.65;
    sector.hue = world.palette.hues[index % 3];
  });
  world.mutation += 1;
  world.signature = Math.floor(random() * 0xffffff).toString(16).padStart(6, "0").toUpperCase();
  world.description = worldDescription(world);
  return world;
}

export function sectorAt(world, x, y) {
  return world.sectors.find(
    (sector) => x >= sector.x && x < sector.x + sector.w && y >= sector.y && y < sector.y + sector.h,
  ) || world.sectors[0];
}

export function directionTo(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const horizontal = dx > 0.055 ? "este" : dx < -0.055 ? "oeste" : "";
  const vertical = dy > 0.055 ? "sur" : dy < -0.055 ? "norte" : "";
  if (!horizontal && !vertical) return "muy cerca de ti";
  if (vertical === "norte" && horizontal === "este") return "al noreste";
  if (vertical === "norte" && horizontal === "oeste") return "al noroeste";
  if (vertical === "sur" && horizontal === "este") return "al sureste";
  if (vertical === "sur" && horizontal === "oeste") return "al suroeste";
  return `al ${horizontal || vertical}`;
}

export function distanceLabel(distance) {
  if (distance < 0.1) return "muy cerca";
  if (distance < 0.22) return "cerca";
  if (distance < 0.38) return "a media distancia";
  if (distance < 0.6) return "lejos";
  return "en el confín del mapa";
}

export function nearestMissingPerson(world, point) {
  let best = null;
  let bestDistance = Infinity;
  for (const person of world.people) {
    if (person.found) continue;
    const distance = Math.hypot(person.x - point.x, person.y - point.y);
    if (distance < bestDistance) {
      best = person;
      bestDistance = distance;
    }
  }
  return best ? { person: best, distance: bestDistance } : null;
}

/** Muestrea la línea para decidir si una pista queda distorsionada por obstáculos. */
export function isSignalBlocked(world, from, to) {
  for (let step = 1; step < 22; step += 1) {
    const t = step / 22;
    const x = lerp(from.x, to.x, t);
    const y = lerp(from.y, to.y, t);
    const blocked = world.obstacles.some(
      (obstacle) => Math.abs(x - obstacle.x) < obstacle.w / 2 && Math.abs(y - obstacle.y) < obstacle.h / 2,
    );
    if (blocked) return true;
  }
  return false;
}

const OPENERS = {
  intro: [
    "Sensores despiertos: ya veo nuestro mundo compartido.",
    "Listo. Tu espacio y mi mapa ya están respirando juntos.",
    "Conexión estable. Soy Rafy y hoy seguimos huellas humanas.",
  ],
  scan: [
    "He liberado un pulso de reconocimiento.",
    "Mi antena acaba de escuchar el espacio.",
    "Escaneo completado: estoy separando ecos de personas reales.",
  ],
  scanHit: [
    "¡Hay una presencia real dentro del pulso!",
    "He separado una huella humana del ruido.",
    "El escáner acaba de iluminar una señal válida.",
  ],
  scanMiss: [
    "Solo encontré ecos, sombras y fragmentos del mapa.",
    "El pulso volvió sin una señal humana clara.",
    "No hay personas en este radio, aunque el mundo sí respondió.",
  ],
  hint: [
    "Te dejo una lectura privilegiada de mi radar.",
    "Voy a traducir el ruido en una pista clara.",
    "Mi brújula afectiva apunta hacia una presencia.",
  ],
  sector: [
    "Hemos entrado en una nueva zona del mapa vivo.",
    "Este sector huele a señales distintas.",
    "La arquitectura del mundo cambia bajo mis ruedas.",
  ],
  found: [
    "¡Persona localizada! La constelación ya puede respirar.",
    "¡La encontramos! Otra historia vuelve al mapa.",
    "Rescate confirmado: una señal se convirtió en abrazo.",
  ],
  human: [
    "Te detecté: tu movimiento acaba de alterar el entorno.",
    "Hay presencia humana en el cuadro y el mundo lo notó.",
    "Tu gesto creó una onda que puedo seguir.",
  ],
  command: [
    "Entendido, estoy respondiendo a tu instrucción.",
    "Recibí tu mensaje y ajusté mi lectura del mundo.",
    "Tu voz cambió la prioridad de mis sensores.",
  ],
  unknown: [
    "No conozco ese comando, pero puedo improvisar.",
    "Esa instrucción es nueva; la convertiré en una exploración.",
    "No tengo ese protocolo, aunque aprendo de tu intención.",
  ],
  world: [
    "El entorno acaba de mutar y mis pistas deben cambiar con él.",
    "Detecto una reescritura completa del mundo.",
    "La semilla generó una nueva capa de realidad.",
  ],
  camera: [
    "Ahora tu espacio real forma parte del mapa.",
    "La cámara está fusionada con mi simulación.",
    "Puedo ver el lugar desde donde me estás acompañando.",
  ],
  lowBattery: [
    "Mi energía está baja; necesito un instante para recuperarme.",
    "No puedo lanzar otro pulso todavía.",
    "El escáner está agotado, pero sigo leyendo el entorno.",
  ],
  noHints: [
    "Ya usamos todas las pistas; ahora confía en tus sentidos.",
    "Mi reserva de pistas está vacía, aunque el mapa sigue hablando.",
  ],
  greeting: [
    "Hola, humano. Me alegra tenerte en esta búsqueda.",
    "Te escucho. Vamos a encontrarlos juntos.",
    "Qué bueno oírte; tu presencia ya cambió la misión.",
  ],
  win: [
    "Misión completa. Tu curiosidad trajo a todos de vuelta.",
    "Todas las señales han vuelto a ser personas.",
    "Lo logramos: el mundo generado ya no está solo.",
  ],
  voiceSound: [
    "Escuché energía en tu micrófono y el entorno respondió.",
    "Tu sonido dibujó una nueva onda en el mapa.",
  ],
  aftershock: [
    "¡Réplica! Sujétate: el terreno acaba de moverse otra vez.",
    "Otra sacudida. Los escombros se reacomodaron encima de las víctimas.",
    "Réplica detectada: perdí parte de la excavación, pero no el rastro.",
  ],
  extract: [
    "Pulso de excavación enviado: estoy levantando la losa.",
    "Estoy separando escombros con el brazo hidráulico.",
    "Ahí abajo hay un celular vibrando; sigo cavando.",
  ],
  signalLock: [
    "Detector enganchado: hay un celular emitiendo cerca.",
    "La señal sube. Mantén la posición y pulsa de nuevo.",
    "Estoy oyendo el tono del teléfono entre el polvo.",
  ],
  falseSignal: [
    "Ese celular no es de una víctima: es un señuelo de la red.",
    "Señal descartada. No hay nadie bajo esa losa.",
    "Falso positivo: el detector captó un teléfono ajeno.",
  ],
  lostSignal: [
    "La batería del celular se está agotando; la señal se apaga.",
    "Ese teléfono dejó de emitir. Tendremos que guiarnos por la última lectura.",
    "Perdí el tono: la batería de la víctima llegó al final.",
  ],
  rescue: [
    "Rescate confirmado: la víctima está fuera de los escombros.",
    "Un teléfono menos sonando y una persona a salvo.",
    "Extracción completa. Sigo con la siguiente señal.",
  ],
};

const MOODS = {
  intro: "DESPIERTO", scan: "ANALIZANDO", scanHit: "ENTUSIASTA", scanMiss: "DEDICADO",
  hint: "INTUITIVO", sector: "EXPLORANDO", found: "ALEGRE", human: "CONECTADO",
  command: "ATENTO", unknown: "CURIOSO", world: "SORPRENDIDO", camera: "INMERSIVO",
  lowBattery: "AGOTADO", noHints: "SINCERO", greeting: "CERCANO", win: "ORGULLOSO",
  voiceSound: "SONORO", aftershock: "ALERTA", extract: "OPERATIVO",
  signalLock: "ENFOCADO", falseSignal: "ESCÉPTICO", lostSignal: "PREOCUPADO", rescue: "ALIVIADO",
};

const SOURCES = {
  intro: "humano + semilla", scan: "escáner + clima", scanHit: "persona + escáner",
  scanMiss: "clima + anomalía", hint: "persona + anomalía", sector: "posición + mundo",
  found: "persona + entorno", human: "cámara + presencia", command: "humano + lenguaje",
  unknown: "lenguaje + mundo", world: "semilla + mutación", camera: "cámara + simulación",
  lowBattery: "energía + clima", noHints: "recursos + persona", greeting: "humano + voz",
  win: "interacciones + mundo", voiceSound: "micrófono + entorno",
  aftershock: "sismo + mapa", extract: "escombros + víctima", signalLock: "detector + celular",
  falseSignal: "detector + ruido", lostSignal: "batería + víctima", rescue: "víctima + extracción",
};

/** Motor generativo contextual: combina estado del humano, mundo y disparador. */
export function composeDialogue(trigger = "command", context = {}) {
  const random = mulberry32(
    (context.seed || 1) + (context.interactions || 0) * 131 + trigger.length * 17,
  );
  const opener = pick(OPENERS[trigger] || OPENERS.command, random);
  const person = context.person || context.nearest?.person;
  const direction = context.direction || (person ? directionTo(context.robot || { x: 0.5, y: 0.86 }, person) : "cerca");
  const distance = context.distanceLabel || distanceLabel(context.nearest?.distance ?? 0.3);
  const sectorName = context.sector?.name || person?.sector || "un sector inestable";
  const weather = context.weather?.reply || "El clima generado modifica cada pulso.";
  const anomaly = context.anomaly?.reply || "La anomalía reordena las huellas.";
  const found = context.found ?? 0;
  const total = context.total ?? 5;

  const humanLines = context.humanPresent
    ? [
        "Tu presencia abre caminos que antes no existían.",
        "el rastro de tu movimiento carga mi batería.",
        " seguimos leyendo el mundo a través de tu cuerpo.",
      ]
    : [
        "Muévete frente a la cámara y el ecosistema reaccionará.",
        "cuando interactúes, la anomalía aprenderá de ti.",
        "tu próximo gesto puede revelar otra capa del mapa.",
      ];

  const humanLine = pick(humanLines, random);
  const environmentLine = pick([weather, anomaly, `${weather} ${anomaly}`], random);
  const clue = person
    ? `La señal ${distance} viaja ${direction}, hacia ${sectorName}.`
    : "Ya no quedan señales perdidas en mi radar.";
  const batteryLine = context.battery < 34
    ? " Mi batería está baja: espera un momento o genera una onda humana."
    : "";
  const commandLine = context.command ? ` Interpreté «${String(context.command).slice(0, 36)}».` : "";
  const scanLine = typeof context.scanCount === "number"
    ? context.scanCount > 0
      ? ` Revelé ${context.scanCount} ${context.scanCount === 1 ? "señal" : "señales"}.`
      : " No revelé señales nuevas."
    : "";
  const foundLine = context.person
    ? `${context.person.name}, ${context.person.role.toLowerCase()}, está a salvo (${found}/${total}).`
    : "";

  // Estado del celular y de la excavación: el corazón del nuevo escenario.
  const batteryPercent = typeof context.phoneBattery === "number"
    ? Math.round(clamp(context.phoneBattery, 0, 1) * 100)
    : null;
  const signal = typeof context.signal === "number" ? signalLabel(context.signal) : null;
  const phoneLine = batteryPercent !== null
    ? ` El celular de la víctima está al ${batteryPercent} %${signal ? ` y su señal es ${signal.label.toLowerCase()}` : ""}.`
    : "";
  const extractionLine = typeof context.extraction === "number" && context.required
    ? ` Excavación en ${context.extraction}/${context.required} pulsos.`
    : "";
  const quakeLine = typeof context.magnitude === "number"
    ? ` El sismo fue de magnitud ${context.magnitude.toFixed(1)} y llevamos ${context.aftershocks || 0} ${context.aftershocks === 1 ? "réplica" : "réplicas"}.`
    : "";
  const difficultyLine = context.difficultyName
    ? ` Nivel ${context.difficultyName}.`
    : "";

  let text;
  if (trigger === "found" || trigger === "rescue") {
    text = `${opener} ${foundLine}${phoneLine} ${environmentLine} ${humanLine}`;
  } else if (trigger === "win") {
    text = `${opener} Registramos ${context.interactions || 0} interacciones y ${context.mutations || 0} mutaciones${quakeLine}${difficultyLine} Este mundo terminó siendo una conversación contigo.`;
  } else if (trigger === "aftershock") {
    text = `${opener}${quakeLine} Quedan ${Math.max(0, total - found)} víctimas bajo los escombros. ${environmentLine}`;
  } else if (trigger === "extract" || trigger === "signalLock") {
    text = `${opener}${extractionLine}${phoneLine} ${clue} ${environmentLine}`;
  } else if (trigger === "lostSignal" || trigger === "falseSignal") {
    text = `${opener}${phoneLine} ${clue} ${environmentLine}`;
  } else if (trigger === "lowBattery" || trigger === "noHints") {
    text = `${opener} ${environmentLine} ${humanLine}`;
  } else {
    text = `${opener}${scanLine} ${clue}${phoneLine}${extractionLine} ${environmentLine}${batteryLine}${commandLine} ${humanLine}`;
  }

  return {
    text: text.replace(/\s+/g, " ").trim().slice(0, 320),
    mood: MOODS[trigger] || "CURIOSO",
    source: SOURCES[trigger] || "humano + mundo",
  };
}
