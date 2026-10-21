// Network layer with timeout, one retry, and a localStorage fallback cache.

const API_ROOT = "https://api.jolpi.ca/ergast/f1/current";
const STANDINGS_URL = `${API_ROOT}/driverStandings.json`;
const CONSTRUCTORS_URL = `${API_ROOT}/constructorStandings.json`;
const SCHEDULE_URL = `${API_ROOT}.json`;

const CACHE_PREFIX = "f1-blacklist:v2:";
const REQUEST_TIMEOUT = 10000;
const RETRIES = 1;
const TTL = {
  standings: 15 * 60 * 1000,
  constructors: 15 * 60 * 1000,
  schedule: 60 * 60 * 1000,
};

function storage() {
  try {
    return window.localStorage;
  } catch (_) {
    return null;
  }
}

function readCache(key) {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== "number" || !parsed.data) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function writeCache(key, data, savedAt = Date.now()) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(CACHE_PREFIX + key, JSON.stringify({ savedAt, data }));
  } catch (_) {
    // Quota or private mode: the app still works without a cache.
  }
}

function humanError(error) {
  if (error?.name === "AbortError") return "Сервер не ответил вовремя.";
  if (String(error?.message || "").startsWith("HTTP")) {
    return `API вернул ошибку (${error.message}).`;
  }
  return "Не удалось связаться с API.";
}

async function fetchJson(url) {
  let lastError = null;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("Network error");
}

async function getResource(key, url, force) {
  const cached = readCache(key);
  const ttl = TTL[key] ?? TTL.standings;
  const fresh = cached && Date.now() - cached.savedAt < ttl;

  // Offline is a stronger signal than a still-fresh TTL: show the cached data
  // together with a warning instead of pretending it came from the network.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      data: cached?.data ?? null,
      savedAt: cached?.savedAt ?? null,
      stale: true,
      error: "Нет подключения к интернету.",
    };
  }

  if (!force && fresh) {
    return { data: cached.data, savedAt: cached.savedAt, stale: false, error: null };
  }

  try {
    const data = await fetchJson(url);
    const savedAt = Date.now();
    writeCache(key, data, savedAt);
    return { data, savedAt, stale: false, error: null };
  } catch (error) {
    return {
      data: cached?.data ?? null,
      savedAt: cached?.savedAt ?? null,
      stale: true,
      error: humanError(error),
    };
  }
}

export async function fetchAll({ force = false } = {}) {
  const [standings, constructors, schedule] = await Promise.all([
    getResource("standings", STANDINGS_URL, force),
    getResource("constructors", CONSTRUCTORS_URL, force),
    getResource("schedule", SCHEDULE_URL, force),
  ]);

  const responses = [standings, constructors, schedule];
  const errors = [...new Set(responses.map((item) => item.error).filter(Boolean))];
  // Only the driver standings and the calendar are required for the main
  // calculation. A missing constructors table must not mark fresh drivers as
  // stale, otherwise the summary would claim that everything came from cache.
  const stale = standings.stale || schedule.stale;
  const constructorsStale = constructors.stale;
  const savedAt =
    [standings.savedAt, constructors.savedAt, schedule.savedAt]
      .filter(Boolean)
      .sort((a, b) => b - a)[0] ?? null;

  return {
    standings: standings.data,
    constructors: constructors.data,
    schedule: schedule.data,
    errors,
    stale,
    constructorsStale,
    savedAt,
  };
}
