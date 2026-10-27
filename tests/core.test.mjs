import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMutation,
  composeDialogue,
  createWorld,
  directionTo,
  nearestMissingPerson,
  sectorAt,
} from "../js/core.js";

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
