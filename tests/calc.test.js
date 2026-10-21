import test from "node:test";
import assert from "node:assert/strict";

import {
  computeConstructorStats,
  computeDriverStats,
  countdownParts,
  formatCountdown,
  getNextRace,
  maxPotentialIndexPercent,
  pluralRu,
  remainingPoints,
} from "../calc.js";

const normal = { round: 1, sprint: false, date: "2026-03-08" };
const sprint = { round: 2, sprint: true, date: "2026-03-15" };
const normal2 = { round: 3, sprint: false, date: "2026-03-29" };

const driver = (code, points, position, wins = 0) => ({
  code,
  name: code,
  number: String(position),
  teamId: "test",
  teamName: "Test",
  points,
  position,
  wins,
});

const team = (id, points, position, wins = 0) => ({
  id,
  name: id,
  short: id,
  color: "#fff",
  points,
  position,
  wins,
});

test("remainingPoints counts normal weekends and sprints separately", () => {
  assert.equal(remainingPoints([normal, sprint], "driver"), 58);
  assert.equal(remainingPoints([normal, sprint], "team"), 101);
  assert.equal(remainingPoints([], "driver"), 0);
});

test("maxPotentialIndexPercent uses the same remaining maximum on both sides", () => {
  assert.equal(maxPotentialIndexPercent(100, 100, 50), 100);
  assert.equal(maxPotentialIndexPercent(50, 100, 50), (100 / 150) * 100);
  assert.equal(maxPotentialIndexPercent(50, 100, 0), 50);
  assert.equal(maxPotentialIndexPercent(0, 0, 50), 0);
});

test("driver stats: leader, gaps, index and elimination", () => {
  const result = computeDriverStats(
    [driver("A", 100, 1, 2), driver("B", 50, 2, 1), driver("C", 10, 3)],
    [normal, sprint, normal2],
    1
  );

  assert.equal(result.remaining.length, 2);
  assert.equal(result.remainingMax, 58);
  assert.equal(result.stats[0].status, "alive");
  assert.equal(result.stats[1].status, "alive");
  assert.equal(result.stats[2].status, "eliminated");
  assert.equal(result.stats[0].index, 100);
  assert.ok(Math.abs(result.stats[1].index - (108 / 158) * 100) < 1e-9);
  assert.equal(result.stats[2].max, 68);
  assert.equal(result.stats[1].gapToLeader, 50);
  assert.equal(result.stats[0].magicNumber, 9);
});

test("driver elimination boundary is inclusive", () => {
  const atBoundary = computeDriverStats(
    [driver("A", 100, 1), driver("B", 42, 2)],
    [normal, sprint, normal2],
    1
  );
  assert.equal(atBoundary.stats[1].max, 100);
  assert.equal(atBoundary.stats[1].status, "alive");

  const belowBoundary = computeDriverStats(
    [driver("A", 100, 1), driver("B", 41, 2)],
    [normal, sprint, normal2],
    1
  );
  assert.equal(belowBoundary.stats[1].status, "eliminated");
});

test("driver clinch boundary: strictly more than second best plus remaining", () => {
  const notYet = computeDriverStats(
    [driver("A", 108, 1), driver("B", 50, 2)],
    [normal, sprint, normal2],
    1
  );
  assert.equal(notYet.stats[0].status, "alive");
  assert.equal(notYet.stats[0].magicNumber, 1);

  const clinched = computeDriverStats(
    [driver("A", 109, 1), driver("B", 50, 2)],
    [normal, sprint, normal2],
    1
  );
  assert.equal(clinched.stats[0].status, "clinched");
  assert.equal(clinched.stats[0].magicNumber, 0);
});

test("a points tie at the top does not produce a false clinch", () => {
  const result = computeDriverStats(
    [driver("A", 100, 1), driver("B", 100, 2), driver("C", 50, 3)],
    [normal, sprint, normal2],
    1
  );
  assert.equal(result.leaderCount, 2);
  assert.equal(result.soleLeader, null);
  assert.notEqual(result.stats[0].status, "clinched");
  assert.notEqual(result.stats[1].status, "clinched");
});

test("season over marks the leader as champion and freezes the index", () => {
  const result = computeDriverStats(
    [driver("A", 100, 1), driver("B", 90, 2)],
    [normal],
    1
  );
  assert.equal(result.seasonOver, true);
  assert.equal(result.stats[0].status, "champion");
  assert.equal(result.stats[1].status, "seasonOver");
  assert.equal(result.stats[0].index, 100);
  assert.equal(result.stats[1].index, 90);
});

test("pre-season produces zero index instead of a misleading 100%", () => {
  const result = computeDriverStats(
    [driver("A", 0, 1), driver("B", 0, 2)],
    [normal],
    0
  );
  assert.equal(result.preSeason, true);
  assert.equal(result.stats[0].status, "preSeason");
  assert.equal(result.stats[0].index, 0);
});

test("constructor maximum is 58 points on a sprint weekend and 43 otherwise", () => {
  const result = computeConstructorStats(
    [
      team("A", 200, 1, 3),
      team("B", 90, 2, 1),
      team("C", 10, 3),
    ],
    [normal, sprint, normal2],
    1
  );
  assert.equal(result.remainingMax, 101);
  assert.equal(result.stats[0].status, "clinched");
  assert.equal(result.stats[1].max, 191);
  assert.equal(result.stats[1].status, "eliminated");
  assert.equal(result.stats[2].max, 111);
  assert.equal(result.stats[2].status, "eliminated");
});

test("constructor elimination and clinch boundaries use team points", () => {
  const atBoundary = computeConstructorStats(
    [team("A", 200, 1), team("B", 99, 2)],
    [normal, sprint, normal2],
    1
  );
  assert.equal(atBoundary.stats[1].max, 200);
  assert.equal(atBoundary.stats[1].status, "alive");
  assert.equal(atBoundary.stats[0].status, "alive");
  assert.equal(atBoundary.stats[0].magicNumber, 1);

  const clinched = computeConstructorStats(
    [team("A", 201, 1), team("B", 99, 2)],
    [normal, sprint, normal2],
    1
  );
  assert.equal(clinched.stats[0].status, "clinched");
});

test("getNextRace returns the next race by calendar date", () => {
  const schedule = [
    { round: 17, date: "2026-10-11", short: "Сингапур" },
    { round: 18, date: "2026-10-25", short: "Остин" },
    { round: 19, date: "2026-11-01", short: "Мексика" },
  ];
  assert.equal(getNextRace(schedule, new Date("2026-10-21T12:00:00Z")).short, "Остин");
  assert.equal(getNextRace(schedule, new Date("2026-10-25T23:00:00Z")).short, "Остин");
  assert.equal(getNextRace(schedule, new Date("2026-12-07T12:00:00Z")), null);
});

test("countdown formats days and Russian plurals", () => {
  const target = new Date("2026-10-25T20:00:00Z");
  const parts = countdownParts(target, new Date("2026-10-24T20:00:00Z"));
  assert.equal(parts.days, 1);
  assert.equal(parts.hours, 0);
  assert.equal(formatCountdown(target, new Date("2026-10-24T20:00:00Z")), "1 день");
  assert.equal(formatCountdown(target, new Date("2026-10-25T21:00:00Z")), "старт");
  assert.equal(pluralRu(2, "день", "дня", "дней"), "дня");
  assert.equal(pluralRu(5, "день", "дня", "дней"), "дней");
  assert.equal(pluralRu(11, "день", "дня", "дней"), "дней");
});
