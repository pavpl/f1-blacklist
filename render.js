import { countdownParts, formatCountdown, pluralRu, raceStart } from "./calc.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(`${dateString}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
  } catch (_) {
    return dateString;
  }
}

export function formatDateTime(timestamp) {
  if (!timestamp) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch (_) {
    return "—";
  }
}

export function countdownText(race) {
  const target = raceStart(race);
  const parts = countdownParts(target);
  if (!parts) return "—";
  if (parts.totalMinutes <= 0) return "сегодня";
  return `через ${formatCountdown(target)}`;
}

export function statusBadge(status) {
  const variants = {
    alive: ["alive", "В игре"],
    clinched: ["clinch", "Титул закреплён"],
    eliminated: ["out", "Выбыл"],
    champion: ["champion", "Чемпион"],
    seasonOver: ["out", "Сезон завершён"],
    preSeason: ["out", "—"],
  };
  const [variant, label] = variants[status] || variants.out;
  return `<span class="badge badge--${variant}">${label}</span>`;
}

export function renderSummary(model, view) {
  if (!model) {
    return [1, 2, 3, 4]
      .map(
        () =>
          `<div class="stat"><span class="stat__label">Загрузка</span><span class="stat__value">…</span><span class="stat__hint">Получаем данные API</span></div>`
      )
      .join("");
  }

  const data = view === "constructors" ? model.constructors : model.drivers;
  if (!data) {
    return `<div class="stat"><span class="stat__label">Команды</span><span class="stat__value">Недоступно</span><span class="stat__hint">Не удалось получить таблицу конструкторов</span></div>`;
  }

  const leader = data.stats.find((item) => item.isLeader) || data.stats[0];
  const second = data.stats.find((item) => item.position === 2) || data.stats[1];
  const aliveCount = data.stats.filter((item) =>
    ["alive", "clinched", "champion"].includes(item.status)
  ).length;
  const eliminatedCount = data.stats.filter((item) =>
    ["eliminated", "seasonOver"].includes(item.status)
  ).length;
  const sprints = data.remaining.filter((event) => event.sprint).length;
  const next = model.nextRace;

  const leaderGap =
    second && leader.points > second.points
      ? ` · +${leader.points - second.points} к ${escapeHtml(second.name)}`
      : "";

  const remainingLabel = `${data.remaining.length} ${pluralRu(
    data.remaining.length,
    "этап",
    "этапа",
    "этапов"
  )}`;
  const sprintLabel = `${sprints} ${pluralRu(sprints, "спринт", "спринта", "спринтов")}`;

  const nextValue = next
    ? escapeHtml(next.short)
    : model.seasonOver
      ? "Сезон завершён"
      : "—";
  const nextHint = next
    ? `${escapeHtml(formatDate(next.date))} · <span data-countdown>${countdownText(next)}</span>`
    : model.seasonOver
      ? "Все этапы пройдены"
      : "Календарь недоступен";

  const leaderValue = model.preSeason ? "Сезон не начался" : escapeHtml(leader?.name || "—");
  const leaderHint = model.preSeason
    ? "Очки появятся после первого этапа"
    : `${leader?.points ?? 0} очков${leaderGap}`;

  const aliveValue = model.preSeason ? "—" : `${aliveCount} из ${data.stats.length}`;
  const aliveHint = model.preSeason
    ? "Сезон ещё не начался"
    : model.seasonOver
      ? "Титул разыгран"
      : `${eliminatedCount} ${pluralRu(eliminatedCount, "выбыл", "выбыли", "выбыли")}`;

  const leaderColor = leader?.teamColor || leader?.color || "#e10600";

  return `
    <div class="stat stat--leader" style="--team-color:${escapeHtml(leaderColor)}">
      <span class="stat__label">${view === "constructors" ? "Лидер команд" : "Лидер"}</span>
      <span class="stat__value">${leaderValue}</span>
      <span class="stat__hint">${leaderHint}</span>
    </div>
    <div class="stat">
      <span class="stat__label">До финиша</span>
      <span class="stat__value">${remainingLabel}</span>
      <span class="stat__hint">${sprintLabel} · макс. <strong>${data.remainingMax}</strong> очков</span>
    </div>
    <div class="stat">
      <span class="stat__label">${view === "constructors" ? "В борьбе" : "В борьбе за титул"}</span>
      <span class="stat__value">${aliveValue}</span>
      <span class="stat__hint">${aliveHint}</span>
    </div>
    <div class="stat">
      <span class="stat__label">Следующий этап</span>
      <span class="stat__value">${nextValue}</span>
      <span class="stat__hint">${nextHint}</span>
    </div>
    <div class="summary__meta">
      <span>Обновлено: ${formatDateTime(model.lastUpdated)}</span>
      <span>${model.stale || (view === "constructors" && model.constructorsStale) ? "Данные из кэша" : "Данные: Jolpi API"} · ${data.completed}/${data.total} этапов</span>
    </div>`;
}

export function renderFilters(data, filter) {
  if (!data) return "";
  const alive = data.stats.filter((item) =>
    ["alive", "clinched", "champion"].includes(item.status)
  ).length;
  const eliminated = data.stats.filter((item) =>
    ["eliminated", "seasonOver"].includes(item.status)
  ).length;
  const options = [
    ["all", "Все", data.stats.length],
    ["alive", "В борьбе", alive],
    ["eliminated", "Выбыли", eliminated],
  ];
  return options
    .map(
      ([value, label, count]) => `
      <button type="button" class="chip${filter === value ? " is-active" : ""}" data-filter="${value}"
        aria-pressed="${filter === value}">${label} <span class="chip__count">${count}</span></button>`
    )
    .join("");
}

export function renderCards(items, context) {
  const { view, data } = context;
  const isTeam = view === "constructors";
  return items
    .map((item) => {
      const key = isTeam ? item.id : item.code;
      const color = isTeam ? item.color : item.teamColor;
      const flag = isTeam ? "" : item.flag || "";
      const number = isTeam ? item.short || "—" : item.number || "—";
      const teamDrivers = isTeam ? context.driversByTeam?.get(item.id) || [] : [];
      const meta = isTeam
        ? teamDrivers.map((driver) => driver.name.split(" ").slice(-1)[0]).join(" · ") || "—"
        : `${item.teamName} · #${item.number}`;
      const eliminated = item.status === "eliminated" || item.status === "seasonOver";
      const rank = item.position;
      const rankClass = rank === 1 ? " rank--1" : rank === 2 ? " rank--2" : rank === 3 ? " rank--3" : "";
      const magic =
        item.isLeader && item.magicNumber > 0
          ? `<span class="badge badge--magic">Клинч: +${item.magicNumber}</span>`
          : "";
      const extraTeams =
        !isTeam && item.constructors && item.constructors.length > 1
          ? ` В сезоне также: ${item.constructors.map((name) => escapeHtml(name)).join(", ")}.`
          : "";
      const formula = isTeam
        ? `Максимум команды: ${item.points} + ${data.remainingMax} = ${item.max}. За обычный уикенд команда может взять 43 очка, за спринт — 58.`
        : `Максимум: ${item.points} + ${data.remainingMax} = ${item.max}. Индекс: (${item.points} + ${data.remainingMax}) / (${data.leaderPoints} + ${data.remainingMax}) × 100.`;
      const eliminationNote =
        item.status === "eliminated"
          ? ` Даже максимум (${item.max}) меньше текущих очков лидера (${data.leaderPoints}).`
          : "";
      const teamNote = isTeam ? ` Пилоты: ${escapeHtml(meta)}.` : extraTeams;

      return `
        <article class="card${item.isLeader ? " card--leader" : ""}${eliminated ? " card--out" : ""}"
          style="--team-color:${escapeHtml(color)}" aria-labelledby="card-${escapeHtml(key)}">
          <div class="card__top">
            <span class="card__rank${rankClass}">${rank}</span>
            <span class="card__num${isTeam ? " card__num--team" : ""}">${escapeHtml(number)}</span>
            <div class="card__info">
              <h3 class="card__name" id="card-${escapeHtml(key)}">${flag ? `${flag} ` : ""}${escapeHtml(item.name)}</h3>
              <p class="card__meta"><span class="team-dot"></span><span>${escapeHtml(meta)}</span></p>
            </div>
            <div class="card__points">
              <span class="points-label">Очки</span>
              <span class="points-value">${item.points}</span>
              <span class="points-max">макс. ${item.max}</span>
            </div>
          </div>
          <div class="card__badges">
            ${statusBadge(item.status)}
            ${magic}
            ${eliminated ? '<span class="stamp" aria-hidden="true">BUSTED</span>' : ""}
          </div>
          <div class="index">
            <div class="index__head">
              <span>Индекс потенциала</span>
              <span class="index__value">${item.index.toFixed(1)}%</span>
            </div>
            <div class="index__bar" role="progressbar" aria-label="Индекс потенциала" aria-valuemin="0"
              aria-valuemax="100" aria-valuenow="${item.index.toFixed(1)}">
              <span class="index__fill" style="width:${Math.max(0, Math.min(100, item.index)).toFixed(1)}%"></span>
            </div>
          </div>
          <div class="card__stats">
            <div><span>Отставание</span><strong>${item.isLeader ? "—" : `−${item.gapToLeader}`}</strong></div>
            <div><span>Победы</span><strong>${item.wins}</strong></div>
            <div><span>Максимум</span><strong>${item.max}</strong></div>
          </div>
          <details class="card__details">
            <summary>Детали расчёта</summary>
            <p>${formula}${teamNote}${eliminationNote}</p>
          </details>
        </article>`;
    })
    .join("");
}

export function renderSection(title, countLabel, cardsHtml, { details = false, open = false } = {}) {
  if (details) {
    return `
      <details class="eliminated"${open ? " open" : ""}>
        <summary>
          <span class="section__title">${escapeHtml(title)}</span>
          <span class="section__count">${escapeHtml(countLabel)}</span>
        </summary>
        <div class="grid">${cardsHtml}</div>
      </details>`;
  }
  return `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">${escapeHtml(title)}</h2>
        <span class="section__count">${escapeHtml(countLabel)}</span>
      </div>
      <div class="grid">${cardsHtml}</div>
    </section>`;
}

export function renderTable(items, context) {
  const { view } = context;
  const isTeam = view === "constructors";
  const countLabel = `${items.length} ${pluralRu(items.length, "участник", "участника", "участников")}`;
  const rows = items
    .map((item) => {
      const key = isTeam ? item.id : item.code;
      const color = isTeam ? item.color : item.teamColor;
      const eliminated = item.status === "eliminated" || item.status === "seasonOver";
      const rankClass = item.position === 1 ? " rank--1" : item.position === 2 ? " rank--2" : item.position === 3 ? " rank--3" : "";
      const teamDrivers = isTeam ? context.driversByTeam?.get(item.id) || [] : [];
      const driversCell = teamDrivers
        .map((driver) => escapeHtml(driver.name.split(" ").slice(-1)[0]))
        .join(" · ");

      return `
        <tr class="${eliminated ? "row--out" : ""}">
          <td class="pos${rankClass}">${item.position}</td>
          <th scope="row">
            ${
              isTeam
                ? `<div class="team-cell"><span class="team-dot" style="--team-color:${escapeHtml(color)}"></span><strong>${escapeHtml(item.name)}</strong></div>`
                : `<div class="driver-cell"><span class="flag" aria-hidden="true">${item.flag || ""}</span>
                   <span><strong>${escapeHtml(item.name)}</strong><small>#${escapeHtml(item.number)}</small></span></div>`
            }
          </th>
          ${
            isTeam
              ? `<td><div class="team-cell">${driversCell || "—"}</div></td>`
              : `<td><div class="team-cell"><span class="team-dot" style="--team-color:${escapeHtml(color)}"></span>${escapeHtml(item.teamName)}</div></td>`
          }
          <td class="num">${item.points}</td>
          <td class="num">${item.max}</td>
          <td class="num">${item.isLeader ? "—" : `−${item.gapToLeader}`}</td>
          <td>
            <div class="mini-index">
              <span class="mini-index__bar"><span class="mini-index__fill" style="width:${Math.max(0, Math.min(100, item.index)).toFixed(1)}%"></span></span>
              <span>${item.index.toFixed(1)}%</span>
            </div>
          </td>
          <td class="num">${item.wins}</td>
          <td>${statusBadge(item.status)}</td>
        </tr>`;
    })
    .join("");

  return `
    <div class="table-wrap" tabindex="0" role="region" aria-label="${isTeam ? "Таблица команд" : "Таблица пилотов"}">
      <table class="standings">
        <caption>${isTeam ? "Кубок конструкторов" : "Положение пилотов"} · ${countLabel}</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">${isTeam ? "Команда" : "Пилот"}</th>
            <th scope="col">${isTeam ? "Пилоты" : "Команда"}</th>
            <th scope="col">Очки</th>
            <th scope="col">Макс.</th>
            <th scope="col">Отставание</th>
            <th scope="col">Индекс</th>
            <th scope="col">Победы</th>
            <th scope="col">Статус</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export function renderEmpty(kind, context = {}) {
  const error = escapeHtml(context.error || "Не удалось получить данные.");
  if (kind === "error") {
    return `
      <div class="empty">
        <h2>Не удалось загрузить данные</h2>
        <p>${error} Проверь подключение к интернету и попробуй ещё раз.</p>
        <button type="button" class="btn" data-action="retry">Повторить</button>
      </div>`;
  }
  if (kind === "constructors") {
    return `
      <div class="empty">
        <h2>Таблица конструкторов недоступна</h2>
        <p>Таблица пилотов загрузилась, но API не отдал кубок конструкторов.</p>
        <button type="button" class="btn" data-action="retry">Повторить</button>
      </div>`;
  }
  if (kind === "preSeason") {
    return `
      <div class="empty">
        <h2>Сезон ещё не начался</h2>
        <p>Очки и позиции появятся после первого этапа. Календарь и максимальные очки уже рассчитаны.</p>
      </div>`;
  }
  if (kind === "noResults") {
    return `
      <div class="empty">
        <h2>Ничего не найдено</h2>
        <p>Попробуй изменить запрос или сбросить фильтры.</p>
        <button type="button" class="btn btn--ghost" data-action="reset">Сбросить фильтры</button>
      </div>`;
  }
  return "";
}

export function renderSkeleton() {
  return `
    <div class="skeleton-grid" aria-hidden="true">
      ${Array.from({ length: 6 }, () => '<div class="skeleton-card"></div>').join("")}
    </div>
    <p class="sr-only" role="status">Загрузка данных…</p>`;
}

export function renderBanner({ status, error, notices, lastUpdated }) {
  if (status === "error") {
    return {
      hidden: false,
      className: "banner banner--error",
      html: `<div class="banner__text"><strong>Ошибка.</strong> ${escapeHtml(error || "Не удалось загрузить данные.")}</div>
        <div class="banner__actions"><button type="button" class="banner__retry" data-action="retry">Повторить</button></div>`,
    };
  }
  if (notices && notices.length) {
    const saved = lastUpdated
      ? ` Последнее обновление: ${formatDateTime(lastUpdated)}.`
      : "";
    return {
      hidden: false,
      className: "banner",
      html: `<div class="banner__text">${notices.map((notice) => escapeHtml(notice)).join(" ")}${saved}</div>
        <div class="banner__actions"><button type="button" class="banner__retry" data-action="retry">Обновить</button></div>`,
    };
  }
  return { hidden: true, className: "banner", html: "" };
}
