// Pure calculation helpers. No DOM and no network access: safe to unit test.

export const MAX_DRIVER_NORMAL = 25;
export const MAX_DRIVER_SPRINT = 33; // race 25 + sprint 8
export const MAX_TEAM_NORMAL = 43; // 1st + 2nd in the race
export const MAX_TEAM_SPRINT = 58; // race 43 + sprint 15

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function pointsForEvent(event, kind = "driver") {
  if (kind === "team") return event.sprint ? MAX_TEAM_SPRINT : MAX_TEAM_NORMAL;
  return event.sprint ? MAX_DRIVER_SPRINT : MAX_DRIVER_NORMAL;
}

export function remainingPoints(events, kind = "driver") {
  return events.reduce((sum, event) => sum + pointsForEvent(event, kind), 0);
}

/**
 * Share of the leader's ceiling that a competitor can still reach.
 * The same remaining maximum is added to both sides, so this is a
 * "potential" metric, not a probability.
 */
export function maxPotentialIndexPercent(points, leaderPoints, remainingMax) {
  if (leaderPoints <= 0) return 0;
  if (remainingMax <= 0) return Math.min(100, (points / leaderPoints) * 100);
  return Math.min(100, ((points + remainingMax) / (leaderPoints + remainingMax)) * 100);
}

export function splitRemaining(schedule, completedRound) {
  const total = schedule.length;
  const completed = clamp(Number(completedRound) || 0, 0, total);
  return { completed, total, remaining: schedule.slice(completed) };
}

function uniqueDescending(values) {
  const sorted = [...values].sort((a, b) => b - a);
  return sorted.filter((value, index) => index === 0 || value !== sorted[index - 1]);
}

function competitionRanks(items, getPoints, getKey) {
  const sorted = [...items].sort((a, b) => getPoints(b) - getPoints(a));
  let rank = 1;
  const ranks = new Map();
  sorted.forEach((item, index) => {
    if (index > 0 && getPoints(item) !== getPoints(sorted[index - 1])) rank = index + 1;
    ranks.set(getKey(item), rank);
  });
  return ranks;
}

export function computeDriverStats(drivers, schedule, completedRound) {
  const { completed, total, remaining } = splitRemaining(schedule, completedRound);
  const remainingMax = remainingPoints(remaining, "driver");
  const pointsOf = (driver) => Number(driver.points) || 0;
  const leaderPoints = Math.max(0, ...drivers.map(pointsOf));
  const secondBest = uniqueDescending(drivers.map(pointsOf))[1] ?? 0;
  const leaderCount = drivers.filter((driver) => pointsOf(driver) === leaderPoints).length;
  const soleLeader =
    leaderCount === 1 ? drivers.find((driver) => pointsOf(driver) === leaderPoints) : null;
  const preSeason = completed === 0 && drivers.every((driver) => pointsOf(driver) === 0);
  const seasonOver = remaining.length === 0;

  const ordered = [...drivers].sort((a, b) => {
    const pa = Number(a.position) || 0;
    const pb = Number(b.position) || 0;
    if (pa && pb && pa !== pb) return pa - pb;
    const byPoints = pointsOf(b) - pointsOf(a);
    if (byPoints) return byPoints;
    const byWins = (Number(b.wins) || 0) - (Number(a.wins) || 0);
    if (byWins) return byWins;
    return String(a.name).localeCompare(String(b.name), "ru");
  });

  const fallbackRanks = competitionRanks(
    ordered,
    pointsOf,
    (driver) => driver.code || driver.name
  );

  const stats = ordered.map((driver, index) => {
    const points = pointsOf(driver);
    const wins = Number(driver.wins) || 0;
    const position =
      Number(driver.position) ||
      fallbackRanks.get(driver.code || driver.name) ||
      index + 1;
    const max = points + remainingMax;
    const indexPercent = maxPotentialIndexPercent(points, leaderPoints, remainingMax);
    const gapToLeader = leaderPoints - points;
    const gapToNext = index > 0 ? pointsOf(ordered[index - 1]) - points : 0;

    let status = "alive";
    if (preSeason) status = "preSeason";
    else if (seasonOver) status = position === 1 ? "champion" : "seasonOver";
    else if (max < leaderPoints) status = "eliminated";
    else if (soleLeader && soleLeader.code === driver.code && points > secondBest + remainingMax)
      status = "clinched";

    const magicNumber =
      soleLeader && soleLeader.code === driver.code && !seasonOver
        ? Math.max(0, secondBest + remainingMax - points + 1)
        : 0;

    return {
      ...driver,
      points,
      wins,
      position,
      rank: position,
      max,
      index: indexPercent,
      gapToLeader,
      gapToNext,
      status,
      magicNumber,
      isLeader: position === 1,
    };
  });

  return {
    kind: "drivers",
    completed,
    total,
    remaining,
    remainingMax,
    leaderPoints,
    secondBest,
    leaderCount,
    soleLeader: soleLeader
      ? stats.find((driver) => driver.code === soleLeader.code) || null
      : null,
    preSeason,
    seasonOver,
    stats,
  };
}

export function computeConstructorStats(teams, schedule, completedRound) {
  const { completed, total, remaining } = splitRemaining(schedule, completedRound);
  const remainingMax = remainingPoints(remaining, "team");
  const pointsOf = (team) => Number(team.points) || 0;
  const leaderPoints = Math.max(0, ...teams.map(pointsOf));
  const secondBest = uniqueDescending(teams.map(pointsOf))[1] ?? 0;
  const leaderCount = teams.filter((team) => pointsOf(team) === leaderPoints).length;
  const soleLeader =
    leaderCount === 1 ? teams.find((team) => pointsOf(team) === leaderPoints) : null;
  const preSeason = completed === 0 && teams.every((team) => pointsOf(team) === 0);
  const seasonOver = remaining.length === 0;

  const ordered = [...teams].sort((a, b) => {
    const pa = Number(a.position) || 0;
    const pb = Number(b.position) || 0;
    if (pa && pb && pa !== pb) return pa - pb;
    const byPoints = pointsOf(b) - pointsOf(a);
    if (byPoints) return byPoints;
    const byWins = (Number(b.wins) || 0) - (Number(a.wins) || 0);
    if (byWins) return byWins;
    return String(a.name).localeCompare(String(b.name), "ru");
  });

  const fallbackRanks = competitionRanks(
    ordered,
    pointsOf,
    (team) => team.id || team.name
  );

  const stats = ordered.map((team, index) => {
    const points = pointsOf(team);
    const wins = Number(team.wins) || 0;
    const position =
      Number(team.position) ||
      fallbackRanks.get(team.id || team.name) ||
      index + 1;
    const max = points + remainingMax;
    const indexPercent = maxPotentialIndexPercent(points, leaderPoints, remainingMax);
    const gapToLeader = leaderPoints - points;
    const gapToNext = index > 0 ? pointsOf(ordered[index - 1]) - points : 0;

    let status = "alive";
    if (preSeason) status = "preSeason";
    else if (seasonOver) status = position === 1 ? "champion" : "seasonOver";
    else if (max < leaderPoints) status = "eliminated";
    else if (soleLeader && soleLeader.id === team.id && points > secondBest + remainingMax)
      status = "clinched";

    const magicNumber =
      soleLeader && soleLeader.id === team.id && !seasonOver
        ? Math.max(0, secondBest + remainingMax - points + 1)
        : 0;

    return {
      ...team,
      points,
      wins,
      position,
      rank: position,
      max,
      index: indexPercent,
      gapToLeader,
      gapToNext,
      status,
      magicNumber,
      isLeader: position === 1,
    };
  });

  return {
    kind: "constructors",
    completed,
    total,
    remaining,
    remainingMax,
    leaderPoints,
    secondBest,
    leaderCount,
    soleLeader: soleLeader
      ? stats.find((team) => team.id === soleLeader.id) || null
      : null,
    preSeason,
    seasonOver,
    stats,
  };
}

export function raceStart(race) {
  if (!race?.date) return null;
  const time = race.time || "00:00:00Z";
  const normalized = /Z$|[+-]\d\d:?\d\d$/.test(time) ? time : `${time}Z`;
  const date = new Date(`${race.date}T${normalized}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getNextRace(schedule, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return (
    [...schedule]
      .sort((a, b) => a.round - b.round)
      .find((race) => race.date && race.date >= today) || null
  );
}

export function countdownParts(target, now = new Date()) {
  if (!target) return null;
  const diff = Math.max(0, target.getTime() - now.getTime());
  const minutes = Math.floor(diff / 60000);
  return {
    days: Math.floor(minutes / 1440),
    hours: Math.floor((minutes % 1440) / 60),
    minutes: minutes % 60,
    totalMinutes: minutes,
    isPast: target.getTime() < now.getTime(),
  };
}

export function pluralRu(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export function formatCountdown(target, now = new Date()) {
  const parts = countdownParts(target, now);
  if (!parts || parts.totalMinutes <= 0) return "старт";
  const chunks = [];
  if (parts.days) chunks.push(`${parts.days} ${pluralRu(parts.days, "день", "дня", "дней")}`);
  if (parts.hours) chunks.push(`${parts.hours} ч`);
  if (!parts.days && parts.minutes) chunks.push(`${parts.minutes} мин`);
  return chunks.slice(0, 2).join(" ") || "меньше минуты";
}
