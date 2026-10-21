import { computeConstructorStats, computeDriverStats, countdownParts, formatCountdown, getNextRace, pluralRu, raceStart } from "./calc.js";
import { fetchAll } from "./api.js";
import { DRIVER_META, FALLBACK_SCHEDULE, FLAGS, RACE_NAMES_RU, TEAMS } from "./data.js";
import {
  countdownText,
  escapeHtml,
  formatDate,
  formatDateTime,
  renderBanner,
  renderCards,
  renderEmpty,
  renderFilters,
  renderSection,
  renderSkeleton,
  renderSummary,
  renderTable,
} from "./render.js";

const STORAGE = {
  welcome: "f1-blacklist:hide-welcome",
  view: "f1-blacklist:view",
  filter: "f1-blacklist:filter",
  sort: "f1-blacklist:sort",
  layout: "f1-blacklist:layout",
};

const $ = (id) => document.getElementById(id);
const els = {
  seasonTag: $("season-tag"),
  seasonProgress: $("season-progress"),
  seasonProgressTrack: $("season-progress-track"),
  seasonProgressBar: $("season-progress-bar"),
  nextRace: $("next-race"),
  banner: $("status-banner"),
  summary: $("summary"),
  tabs: $("tabs"),
  filters: $("filters"),
  search: $("search"),
  sort: $("sort"),
  layout: $("layout-toggle"),
  refresh: $("refresh"),
  content: $("content"),
  footerUpdated: $("footer-updated"),
  dialog: $("info-dialog"),
  dialogClose: $("info-close"),
  dialogOk: $("info-ok"),
  dialogHide: $("info-hide"),
  infoOpen: $("info-open"),
};

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // Private mode: preferences simply won't persist.
  }
}

function removeStored(key) {
  try {
    localStorage.removeItem(key);
  } catch (_) {
    // Private mode: nothing to remove.
  }
}

const storedView = readStored(STORAGE.view);
const storedFilter = readStored(STORAGE.filter);
const storedSort = readStored(STORAGE.sort);
const storedLayout = readStored(STORAGE.layout);

// Deep links such as ?view=constructors&layout=table are handy for debugging
// and for sharing a specific view. They take priority over saved preferences
// for the current page load.
function queryParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch (_) {
    return null;
  }
}

const paramView = queryParam("view");
const paramFilter = queryParam("filter");
const paramSort = queryParam("sort");
const paramLayout = queryParam("layout");

const state = {
  view:
    paramView === "constructors" || paramView === "drivers"
      ? paramView
      : storedView === "constructors"
        ? "constructors"
        : "drivers",
  filter: ["all", "alive", "eliminated"].includes(paramFilter)
    ? paramFilter
    : ["all", "alive", "eliminated"].includes(storedFilter)
      ? storedFilter
      : "all",
  sort: ["position", "points", "index", "team"].includes(paramSort)
    ? paramSort
    : ["position", "points", "index", "team"].includes(storedSort)
      ? storedSort
      : "position",
  layout:
    paramLayout === "table" || paramLayout === "cards"
      ? paramLayout
      : storedLayout === "table"
        ? "table"
        : "cards",
  query: "",
  model: null,
  status: "loading",
  error: null,
  notices: [],
  lastUpdated: null,
  loading: false,
};

const isAliveStatus = (status) => ["alive", "clinched", "champion"].includes(status);
const isOutStatus = (status) => ["eliminated", "seasonOver"].includes(status);

function normalizeSchedule(scheduleData) {
  const races = scheduleData?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races) || races.length === 0) {
    return { schedule: FALLBACK_SCHEDULE.map((race) => ({ ...race })), source: "fallback" };
  }
  const schedule = races
    .map((race) => ({
      round: Number(race.round) || 0,
      circuitId: race.Circuit?.circuitId || "",
      short:
        RACE_NAMES_RU[race.Circuit?.circuitId] ||
        String(race.raceName || "").replace(/\s+Grand Prix$/i, "") ||
        `Этап ${race.round}`,
      name: race.raceName || "",
      sprint: Boolean(race.Sprint),
      date: race.date || "",
      time: race.time || "",
    }))
    .sort((a, b) => a.round - b.round);
  return { schedule, source: "api" };
}

function normalizeStandings(data) {
  const list = data?.MRData?.StandingsTable?.StandingsLists?.[0];
  if (!list) return null;

  const drivers = (list.DriverStandings || []).map((standing) => {
    const apiDriver = standing.Driver || {};
    const code = String(apiDriver.code || "").toUpperCase();
    const meta =
      DRIVER_META[code] ||
      Object.values(DRIVER_META).find(
        (item) => item.number === String(apiDriver.permanentNumber || "")
      ) ||
      {};
    const apiTeam = standing.Constructors?.[0] || {};
    const teamId = apiTeam.constructorId || meta.teamId || "unknown";
    const team = TEAMS[teamId] || TEAMS.unknown;
    const name =
      [apiDriver.givenName, apiDriver.familyName].filter(Boolean).join(" ") ||
      meta.name ||
      code ||
      "Пилот";
    const teamName =
      team === TEAMS.unknown && apiTeam.name ? apiTeam.name : team.name;

    return {
      code: code || meta.code || String(apiDriver.driverId || name).toUpperCase(),
      name,
      number: apiDriver.permanentNumber || meta.number || "",
      teamId,
      teamName,
      teamColor: team.color,
      teamShort: team.short,
      nationality: apiDriver.nationality || "",
      flag: FLAGS[apiDriver.nationality] || meta.flag || "",
      points: Number(standing.points) || 0,
      position: Number(standing.position) || 0,
      wins: Number(standing.wins) || 0,
      constructors: (standing.Constructors || []).map((item) => item.name).filter(Boolean),
    };
  });

  return {
    season: list.season || "",
    round: Number(list.round) || 0,
    drivers,
  };
}

function normalizeConstructors(data) {
  const list = data?.MRData?.StandingsTable?.StandingsLists?.[0];
  if (!list) return null;

  const teams = (list.ConstructorStandings || []).map((standing) => {
    const apiTeam = standing.Constructor || {};
    const id = apiTeam.constructorId || "unknown";
    const meta = TEAMS[id] || TEAMS.unknown;
    return {
      id,
      name: meta === TEAMS.unknown && apiTeam.name ? apiTeam.name : meta.name,
      short: meta.short,
      color: meta.color,
      nationality: apiTeam.nationality || "",
      points: Number(standing.points) || 0,
      position: Number(standing.position) || 0,
      wins: Number(standing.wins) || 0,
    };
  });

  return { season: list.season || "", round: Number(list.round) || 0, teams };
}

function groupDriversByTeam(drivers) {
  const map = new Map();
  for (const driver of drivers) {
    const list = map.get(driver.teamId) || [];
    list.push(driver);
    map.set(driver.teamId, list);
  }
  return map;
}

function buildModel({ standings, constructors, schedule }) {
  const normalizedSchedule = normalizeSchedule(schedule);
  const normalizedStandings = normalizeStandings(standings);
  if (!normalizedStandings || normalizedStandings.drivers.length === 0) {
    throw new Error("Не удалось получить таблицу пилотов. Проверь подключение и попробуй ещё раз.");
  }

  const apiRound = Number(normalizedStandings.round) || 0;
  const completedRound = Math.min(Math.max(0, apiRound), normalizedSchedule.schedule.length);
  const driverModel = computeDriverStats(
    normalizedStandings.drivers,
    normalizedSchedule.schedule,
    completedRound
  );
  const normalizedConstructors = normalizeConstructors(constructors);
  const constructorModel =
    normalizedConstructors && normalizedConstructors.teams.length
      ? computeConstructorStats(
          normalizedConstructors.teams,
          normalizedSchedule.schedule,
          completedRound
        )
      : null;

  return {
    season: normalizedStandings.season || normalizedConstructors?.season || "2026",
    schedule: normalizedSchedule.schedule,
    scheduleSource: normalizedSchedule.source,
    apiRound,
    completedRound,
    roundMismatch: apiRound > normalizedSchedule.schedule.length,
    totalRounds: normalizedSchedule.schedule.length,
    drivers: driverModel,
    constructors: constructorModel,
    driversByTeam: groupDriversByTeam(normalizedStandings.drivers),
    nextRace: getNextRace(normalizedSchedule.schedule, new Date()),
    preSeason: driverModel.preSeason,
    seasonOver: driverModel.seasonOver,
    lastUpdated: null,
    stale: false,
  };
}

async function load({ force = false, silent = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  const hadModel = Boolean(state.model);

  if (!silent || !hadModel) {
    state.status = "loading";
    state.error = null;
    state.notices = [];
    render();
  }

  try {
    const result = await fetchAll({ force });
    const model = buildModel(result);
    model.lastUpdated = result.savedAt;
    model.stale = result.stale;
    model.constructorsStale = Boolean(result.constructorsStale);

    state.model = model;
    state.lastUpdated = result.savedAt;
    state.error = null;
    state.notices = [];

    if (result.errors.length) state.notices.push(...result.errors);
    if (result.stale) state.notices.push("Показаны сохранённые данные.");
    if (model.scheduleSource === "fallback") {
      state.notices.push("Календарь загружен из встроенного списка.");
    }
    if (model.roundMismatch) {
      state.notices.push(
        `API сообщает этап ${model.apiRound}, в календаре ${model.totalRounds}; расчёт ограничен календарём.`
      );
    }
    if (result.constructorsStale && !result.stale) {
      state.notices.push(
        model.constructors
          ? "Таблица конструкторов загружена из кэша."
          : "Таблица конструкторов недоступна."
      );
    } else if (!model.constructors) {
      state.notices.push("Таблица конструкторов недоступна.");
    }

    state.notices = [...new Set(state.notices)];
    state.status = result.stale ? "stale" : "ok";
  } catch (error) {
    if (hadModel) {
      state.status = "stale";
      state.notices = [
        error?.message || "Не удалось обновить данные.",
        "Показаны предыдущие данные.",
      ];
      state.error = null;
    } else {
      state.status = "error";
      state.error = error?.message || "Не удалось загрузить данные.";
      state.notices = [];
    }
  } finally {
    state.loading = false;
    render();
    tickCountdown();
  }
}

function renderHeader() {
  const model = state.model;
  const total = model?.totalRounds || 23;
  const completed = model?.completedRound ?? 0;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  els.seasonTag.textContent = `СЕЗОН ${model?.season || "2026"} · ${total} ГРАН-ПРИ`;
  els.seasonProgress.textContent = model
    ? `Пройдено ${completed} из ${total}`
    : "Загрузка сезона…";
  els.seasonProgressBar.style.width = `${progress}%`;
  els.seasonProgressTrack.setAttribute("aria-valuenow", String(progress));

  if (!model) {
    els.nextRace.textContent = "Следующий этап загружается…";
    return;
  }

  if (model.nextRace) {
    els.nextRace.innerHTML = `${escapeHtml(model.nextRace.short)} · ${escapeHtml(
      formatDate(model.nextRace.date)
    )} · <span data-countdown>${countdownText(model.nextRace)}</span>`;
    return;
  }

  els.nextRace.textContent = model.seasonOver
    ? "Сезон завершён"
    : "Следующий этап недоступен";
}

function tickCountdown() {
  const next = state.model?.nextRace;
  document.querySelectorAll("[data-countdown]").forEach((element) => {
    if (!next) {
      element.textContent = state.model?.seasonOver ? "Сезон завершён" : "—";
      return;
    }
    const target = raceStart(next);
    const parts = countdownParts(target);
    element.textContent =
      parts && parts.totalMinutes > 0 ? `через ${formatCountdown(target)}` : "сегодня";
  });
}

function renderBannerUI() {
  const banner = renderBanner({
    status: state.status,
    error: state.error,
    notices: state.notices,
    lastUpdated: state.lastUpdated,
  });
  els.banner.hidden = banner.hidden;
  els.banner.className = banner.className;
  els.banner.innerHTML = banner.html;
  els.banner.setAttribute("role", state.status === "error" ? "alert" : "status");
}

function renderSummaryUI() {
  if (!state.model) {
    if (state.status === "error") {
      els.summary.innerHTML = `
        <div class="stat" style="grid-column:1 / -1">
          <span class="stat__label">Статус</span>
          <span class="stat__value">Нет данных</span>
          <span class="stat__hint">${escapeHtml(state.error || "API недоступен.")}</span>
        </div>`;
    } else {
      els.summary.innerHTML = renderSummary(null, state.view);
    }
    return;
  }
  els.summary.innerHTML = renderSummary(state.model, state.view);
}

function renderToolbarUI() {
  const data = state.model
    ? state.view === "drivers"
      ? state.model.drivers
      : state.model.constructors
    : null;

  els.filters.innerHTML = renderFilters(data, state.filter);

  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.view === state.view;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });

  els.sort.value = state.sort;
  document.querySelectorAll("[data-layout]").forEach((button) => {
    const active = button.dataset.layout === state.layout;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  els.search.placeholder =
    state.view === "drivers"
      ? "Поиск пилота, команды или номера"
      : "Поиск команды или пилота";
  if (els.search.value !== state.query) els.search.value = state.query;

  els.refresh.disabled = state.loading;
  els.refresh.classList.toggle("is-loading", state.loading);
  els.content.setAttribute("aria-busy", String(state.loading));
  els.content.setAttribute(
    "aria-labelledby",
    state.view === "drivers" ? "tab-drivers" : "tab-constructors"
  );
}

function filterAndSort(stats) {
  const query = state.query.trim().toLowerCase();
  const filtered = stats.filter((item) => {
    if (state.filter === "alive" && !isAliveStatus(item.status)) return false;
    if (state.filter === "eliminated" && !isOutStatus(item.status)) return false;
    if (!query) return true;

    if (state.view === "drivers") {
      return `${item.name} ${item.teamName} ${item.code} ${item.number} ${item.nationality}`
        .toLowerCase()
        .includes(query);
    }

    const teamDrivers = state.model.driversByTeam.get(item.id) || [];
    return `${item.name} ${item.short} ${teamDrivers.map((driver) => driver.name).join(" ")}`
      .toLowerCase()
      .includes(query);
  });

  return filtered.sort((a, b) => {
    if (state.sort === "points") {
      return b.points - a.points || a.position - b.position;
    }
    if (state.sort === "index") {
      return b.index - a.index || a.position - b.position;
    }
    if (state.sort === "team") {
      const aName = state.view === "drivers" ? a.teamName : a.name;
      const bName = state.view === "drivers" ? b.teamName : b.name;
      return aName.localeCompare(bName, "ru") || a.position - b.position;
    }
    return a.position - b.position || b.points - a.points;
  });
}

function renderContentUI() {
  const model = state.model;

  if (!model) {
    els.content.innerHTML =
      state.status === "error" ? renderEmpty("error", { error: state.error }) : renderSkeleton();
    return;
  }

  if (model.preSeason) {
    els.content.innerHTML = renderEmpty("preSeason");
    return;
  }

  if (state.view === "constructors" && !model.constructors) {
    els.content.innerHTML = renderEmpty("constructors");
    return;
  }

  const data = state.view === "drivers" ? model.drivers : model.constructors;
  const items = filterAndSort(data.stats);
  if (items.length === 0) {
    els.content.innerHTML = renderEmpty("noResults");
    return;
  }

  const context = {
    view: state.view,
    data,
    driversByTeam: model.driversByTeam,
  };

  if (state.layout === "table") {
    els.content.innerHTML = renderTable(items, context);
    return;
  }

  const alive = items.filter((item) => isAliveStatus(item.status));
  const eliminated = items.filter((item) => isOutStatus(item.status));
  const unit =
    state.view === "drivers"
      ? ["пилот", "пилота", "пилотов"]
      : ["команда", "команды", "команд"];
  const aliveLabel = `${alive.length} ${pluralRu(alive.length, ...unit)}`;
  const eliminatedLabel = `${eliminated.length} ${pluralRu(eliminated.length, ...unit)}`;

  if (state.filter === "alive") {
    els.content.innerHTML = alive.length
      ? renderSection(
          state.view === "drivers" ? "В борьбе за титул" : "В борьбе",
          aliveLabel,
          renderCards(alive, context)
        )
      : renderEmpty("noResults");
    return;
  }

  if (state.filter === "eliminated") {
    els.content.innerHTML = eliminated.length
      ? renderSection("Выбыли", eliminatedLabel, renderCards(eliminated, context))
      : renderEmpty("noResults");
    return;
  }

  if (model.seasonOver) {
    els.content.innerHTML = renderSection(
      "Итоговое положение",
      `${items.length} ${pluralRu(items.length, "участник", "участника", "участников")}`,
      renderCards(items, context)
    );
    return;
  }

  let html = "";
  if (alive.length) {
    html += renderSection(
      state.view === "drivers" ? "В борьбе за титул" : "В борьбе",
      aliveLabel,
      renderCards(alive, context)
    );
  }
  if (eliminated.length) {
    html += renderSection("Выбыли", eliminatedLabel, renderCards(eliminated, context), {
      details: true,
      // In the "all" filter the full list must be visible, not hidden behind a
      // collapsed group. The group stays collapsible for users who want it compact.
      open: true,
    });
  }
  els.content.innerHTML = html || renderEmpty("noResults");
}

function renderFooterUI() {
  const updated = state.lastUpdated
    ? `Обновлено: ${formatDateTime(state.lastUpdated)} · `
    : "";
  const source = state.status === "stale" ? " · кэш" : "";
  els.footerUpdated.textContent = `${updated}Данные: Jolpi API (Ergast-совместимый)${source}.`;
}

function render() {
  renderHeader();
  renderBannerUI();
  renderSummaryUI();
  renderToolbarUI();
  renderContentUI();
  renderFooterUI();
  tickCountdown();
}

function resetFilters() {
  state.filter = "all";
  state.query = "";
  writeStored(STORAGE.filter, state.filter);
  render();
}

function showDialog() {
  if (!els.dialog || els.dialog.open) return;
  if (typeof els.dialog.showModal === "function") {
    try {
      els.dialog.showModal();
    } catch (_) {
      els.dialog.setAttribute("open", "");
    }
  } else {
    els.dialog.setAttribute("open", "");
  }
  document.body.classList.add("is-dialog-open");
}

function closeDialog() {
  if (!els.dialog) return;
  if (typeof els.dialog.close === "function" && els.dialog.open) {
    els.dialog.close();
  } else {
    els.dialog.removeAttribute("open");
    document.body.classList.remove("is-dialog-open");
  }
}

function maybeOpenWelcome() {
  if (readStored(STORAGE.welcome) === "1") return;
  try {
    if (new URLSearchParams(window.location.search).get("nowelcome") === "1") return;
  } catch (_) {
    // Ignore malformed URLs.
  }
  showDialog();
}

function bindEvents() {
  els.tabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    state.view = button.dataset.view === "constructors" ? "constructors" : "drivers";
    writeStored(STORAGE.view, state.view);
    render();
  });

  els.tabs?.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const tabs = [...els.tabs.querySelectorAll("[data-view]")];
    const current = tabs.indexOf(document.activeElement);
    if (current === -1) return;
    event.preventDefault();
    const next =
      event.key === "ArrowRight"
        ? (current + 1) % tabs.length
        : (current - 1 + tabs.length) % tabs.length;
    tabs[next].focus();
    tabs[next].click();
  });

  els.filters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    writeStored(STORAGE.filter, state.filter);
    render();
  });

  els.layout?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-layout]");
    if (!button) return;
    state.layout = button.dataset.layout === "table" ? "table" : "cards";
    writeStored(STORAGE.layout, state.layout);
    render();
  });

  let searchTimer = 0;
  els.search?.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.query = els.search.value;
      render();
    }, 120);
  });

  els.sort?.addEventListener("change", () => {
    state.sort = els.sort.value;
    writeStored(STORAGE.sort, state.sort);
    render();
  });

  els.refresh?.addEventListener("click", () => load({ force: true }));

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    if (action.dataset.action === "retry") load({ force: true });
    if (action.dataset.action === "reset") resetFilters();
  });

  els.infoOpen?.addEventListener("click", showDialog);
  els.dialogClose?.addEventListener("click", closeDialog);
  els.dialogOk?.addEventListener("click", closeDialog);
  els.dialog?.addEventListener("click", (event) => {
    if (event.target === els.dialog) closeDialog();
  });
  els.dialog?.addEventListener("close", () => {
    document.body.classList.remove("is-dialog-open");
    if (els.dialogHide?.checked) writeStored(STORAGE.welcome, "1");
    else removeStored(STORAGE.welcome);
  });

  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      state.lastUpdated &&
      Date.now() - state.lastUpdated > 10 * 60 * 1000
    ) {
      load({ force: true, silent: true });
    }
  });

  window.addEventListener("online", () => {
    if (state.status === "error" || state.status === "stale") {
      load({ force: true, silent: true });
    }
  });
}

function autoRefresh() {
  if (document.visibilityState !== "visible" || state.loading) return;
  load({ force: true, silent: true });
}

function registerServiceWorker() {
  if (queryParam("nosw") === "1") return;
  const secure =
    window.location.protocol === "https:" ||
    ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!("serviceWorker" in navigator) || !secure) return;

  // If an older worker controlled this page, reload once when the fresh one
  // takes over. Network-first caching in sw.js prevents a stale shell even
  // when this listener is not reached (for example on the very first visit).
  if (navigator.serviceWorker.controller) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => registration.update())
      .catch(() => {});
  });
}

bindEvents();

if (els.dialogHide) {
  els.dialogHide.checked = readStored(STORAGE.welcome) === "1";
}

maybeOpenWelcome();
load({ force: false });
window.setInterval(tickCountdown, 30 * 1000);
window.setInterval(autoRefresh, 10 * 60 * 1000);
registerServiceWorker();
