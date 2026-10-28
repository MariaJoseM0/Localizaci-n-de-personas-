import assert from "node:assert/strict";
import test from "node:test";
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  EXCAVATION_THRESHOLD,
  applyAftershock,
  applyExtractionPulse,
  applyMutation,
  composeDialogue,
  createWorld,
  difficultyById,
  directionTo,
  isDifficultyUnlocked,
  nearestMissingPerson,
  nextDifficultyId,
  phoneSignal,
  sectorAt,
  signalLabel,
  strongestSignal,
} from "../js/core.js";

const normal = difficultyById("normal");

test("el mundo es reproducible a partir de la misma semilla", () => {
  const first = createWorld(481516);
  const second = createWorld(481516);
  assert.equal(first.name, second.name);
  assert.equal(first.weather.id, second.weather.id);
  assert.equal(first.anomaly.id, second.anomaly.id);
  assert.deepEqual(first.people.map((person) => [person.x, person.y]), second.people.map((person) => [person.x, person.y]));
});

test("cada persona nace en un sector distinto y dentro del mapa", () => {
  const world = createWorld(90210);
  assert.equal(world.people.length, 5);
  assert.equal(new Set(world.people.map((person) => person.sector)).size, 5);
  for (const person of world.people) {
    assert.ok(person.x >= 0 && person.x <= 1);
    assert.ok(person.y >= 0 && person.y <= 1);
    assert.equal(sectorAt(world, person.x, person.y).name, person.sector);
  }
});

test("la mutación cambia el entorno sin perder el progreso de rescate", () => {
  const world = createWorld(123456);
  world.people[0].found = true;
  const originalPositions = world.people.map((person) => [person.x, person.y]);
  const originalWeather = world.weather.id;
  applyMutation(world, 777);
  assert.notEqual(world.weather.id, originalWeather);
  assert.equal(world.mutation, 1);
  assert.equal(world.people[0].found, true);
  assert.deepEqual(world.people.map((person) => [person.x, person.y]), originalPositions);
});

test("la dirección y la persona más cercana son coherentes", () => {
  const world = createWorld(555);
  const origin = { x: 0.5, y: 0.5 };
  const target = { x: 0.72, y: 0.3 };
  assert.equal(directionTo(origin, target), "al noreste");
  world.people.forEach((person) => { person.found = true; });
  world.people[2].found = false;
  world.people[2].x = 0.56;
  world.people[2].y = 0.52;
  assert.equal(nearestMissingPerson(world, origin).person.id, world.people[2].id);
});

test("la respuesta contextual incorpora clima, anomalía y presencia humana", () => {
  const world = createWorld(314159);
  const nearest = nearestMissingPerson(world, { x: 0.5, y: 0.8 });
  const reply = composeDialogue("human", {
    seed: world.seed,
    interactions: 4,
    robot: { x: 0.5, y: 0.8 },
    nearest,
    sector: sectorAt(world, 0.5, 0.8),
    weather: world.weather,
    anomaly: world.anomaly,
    humanPresent: true,
    battery: 80,
    found: 0,
    total: 5,
  });
  assert.ok(reply.text.length > 40);
  assert.ok(reply.text.includes("señal") || reply.text.includes("Señal"));
  assert.ok(reply.text.includes("Tu") || reply.text.includes("tu") || reply.text.includes("presencia"));
  assert.equal(reply.mood, "CONECTADO");
});

test("cada dificultad genera su propio escenario de rescate", () => {
  for (const preset of DIFFICULTIES) {
    const world = createWorld(2024, preset.id);
    assert.equal(world.difficulty, preset.id);
    assert.equal(world.people.length, preset.people);
    assert.equal(world.phoneDecoys.length, preset.decoyPhones);
    assert.ok(world.rubble.length > 10, "el sismo debe dejar escombros");
    assert.ok(world.quake.magnitude >= preset.minMagnitude);
    assert.ok(world.quake.epicenter.x >= 0 && world.quake.epicenter.x <= 1);
    assert.ok(world.quake.epicenter.y >= 0 && world.quake.epicenter.y <= 1);
    for (const person of world.people) {
      assert.ok(person.phone.battery > 0 && person.phone.battery <= 1);
      assert.ok(person.rubble.depth > 0 && person.rubble.depth <= 1);
      assert.equal(person.extraction, 0);
    }
  }
});

test("más dificultad implica menos alcance y más pulsos de excavación", () => {
  const range = DIFFICULTIES.map((preset) => preset.signalRange);
  const pulses = DIFFICULTIES.map((preset) => preset.extractionPulses);
  assert.deepEqual([...range].sort((a, b) => b - a), range, "el alcance debe decrecer");
  assert.deepEqual([...pulses].sort((a, b) => a - b), pulses, "los pulsos deben crecer");
});

test("el mundo sigue siendo reproducible con la misma semilla y dificultad", () => {
  const a = createWorld(777, "dificil");
  const b = createWorld(777, "dificil");
  assert.equal(a.quake.magnitude, b.quake.magnitude);
  assert.deepEqual(a.quake.epicenter, b.quake.epicenter);
  assert.deepEqual(a.rubble.map((piece) => [piece.x, piece.y]), b.rubble.map((piece) => [piece.x, piece.y]));
  assert.deepEqual(a.people.map((person) => person.phone.battery), b.people.map((person) => person.phone.battery));
  // Y distinto entre dificultades.
  const hard = createWorld(777, "extremo");
  assert.notDeepEqual(a.people.map((person) => [person.x, person.y]), hard.people.map((person) => [person.x, person.y]));
});

test("el detector de celulares responde a la distancia y a la batería", () => {
  const world = createWorld(4242, "normal");
  const person = world.people[0];
  const onTop = phoneSignal(person, { x: person.x, y: person.y }, normal);
  const near = phoneSignal(person, { x: person.x + normal.signalRange * 0.4, y: person.y }, normal);
  const far = phoneSignal(person, { x: person.x + normal.signalRange * 2, y: person.y }, normal);
  assert.ok(onTop > near && near > far);
  assert.equal(far, 0);
  assert.ok(onTop <= 1);

  person.phone.battery = 0.02;
  assert.equal(phoneSignal(person, { x: person.x, y: person.y }, normal), 0, "sin batería no hay señal");
  person.phone.battery = 0.9;
  person.phone.lost = true;
  assert.equal(phoneSignal(person, { x: person.x, y: person.y }, normal), 0, "un celular perdido no emite");
});

test("ninguna víctima con el teléfono vivo queda fuera del umbral de excavación", () => {
  for (const preset of DIFFICULTIES) {
    for (const seed of [1, 7, 42, 999, 2024, 481516]) {
      const world = createWorld(seed, preset.id);
      for (const person of world.people) {
        // Peor caso: escombros al máximo y batería casi agotada.
        person.rubble.depth = 1;
        person.phone.battery = 0.05;
        const signal = phoneSignal(person, { x: person.x, y: person.y }, preset);
        assert.ok(
          signal >= EXCAVATION_THRESHOLD,
          `${preset.id}/${seed}/${person.name}: señal ${signal.toFixed(3)} < umbral ${EXCAVATION_THRESHOLD}`,
        );
      }
    }
  }
});

test("el detector elige la señal más fuerte y descarta a las víctimas rescatadas", () => {
  const world = createWorld(999, "normal");
  const target = world.people[1];
  const reading = strongestSignal(world, { x: target.x, y: target.y }, normal);
  assert.ok(reading.strength > 0);
  assert.equal(reading.person.id, target.id);
  target.found = true;
  target.extracted = true;
  const after = strongestSignal(world, { x: target.x, y: target.y }, normal);
  assert.notEqual(after.person?.id, target.id);
});

test("excavar exige varios pulsos y luego marca el rescate", () => {
  const world = createWorld(321, "normal");
  const person = world.people[0];
  for (let pulse = 1; pulse < normal.extractionPulses; pulse += 1) {
    const result = applyExtractionPulse(person, normal);
    assert.equal(result.rescued, false);
    assert.equal(result.progress, pulse);
    assert.equal(person.found, false);
  }
  const final = applyExtractionPulse(person, normal);
  assert.equal(final.rescued, true);
  assert.equal(final.progress, normal.extractionPulses);
  assert.equal(person.found, true);
  assert.equal(person.extracted, true);
});

test("una réplica añade escombros, gasta batería y respeta los rescates", () => {
  const world = createWorld(654, "dificil");
  const rescued = world.people[0];
  applyExtractionPulse(rescued, difficultyById("dificil"));
  applyExtractionPulse(rescued, difficultyById("dificil"));
  applyExtractionPulse(rescued, difficultyById("dificil"));
  assert.equal(rescued.found, true);

  const rubbleBefore = world.rubble.length;
  const batteryBefore = world.people[1].phone.battery;
  applyAftershock(world, 42, difficultyById("dificil"));

  assert.ok(world.rubble.length > rubbleBefore, "debe añadir escombros");
  assert.equal(world.aftershocks, 1);
  assert.ok(world.people[1].phone.battery < batteryBefore, "la réplica gasta batería");
  assert.equal(rescued.found, true, "un rescate confirmado no se pierde");
  assert.ok(world.sectors.every((sector) => sector.damage >= 0 && sector.damage <= 1));
});

test("la progresión desbloquea los niveles en orden", () => {
  assert.equal(nextDifficultyId("facil"), "normal");
  assert.equal(nextDifficultyId("normal"), "dificil");
  assert.equal(nextDifficultyId("extremo"), null);
  assert.equal(isDifficultyUnlocked("facil", 1), true);
  assert.equal(isDifficultyUnlocked("normal", 1), false);
  assert.equal(isDifficultyUnlocked("normal", 2), true);
  assert.equal(isDifficultyUnlocked("extremo", 4), true);
  assert.equal(isDifficultyUnlocked("extremo", 3), false);
});

test("la etiqueta del detector cubre todo el rango de señal", () => {
  assert.equal(signalLabel(0).label, "SIN SEÑAL");
  assert.equal(signalLabel(0.2).label, "DÉBIL");
  assert.equal(signalLabel(0.6).label, "CLARA");
  assert.equal(signalLabel(1).label, "FUERTE");
  assert.equal(signalLabel(5).label, "FUERTE");
});

test("la respuesta de rescate informa batería, excavación y sismo", () => {
  const world = createWorld(314159, "normal");
  const person = world.people[0];
  const reply = composeDialogue("extract", {
    seed: world.seed,
    interactions: 2,
    robot: { x: 0.5, y: 0.8 },
    person,
    extraction: 2,
    required: 3,
    phoneBattery: 0.42,
    signal: 0.6,
    weather: world.weather,
    anomaly: world.anomaly,
    found: 1,
    total: 5,
  });
  assert.ok(reply.text.includes("42 %"), "debe indicar la batería del celular");
  assert.ok(reply.text.includes("2/3"), "debe indicar el progreso de excavación");
  assert.equal(reply.mood, "OPERATIVO");

  const win = composeDialogue("win", {
    seed: world.seed,
    magnitude: world.quake.magnitude,
    aftershocks: 3,
    difficultyName: "Normal",
    interactions: 10,
    mutations: 0,
  });
  assert.ok(win.text.includes("magnitud"));
  assert.ok(win.text.includes("3 réplicas"));
});
