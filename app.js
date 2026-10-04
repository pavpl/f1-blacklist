(function () {
  "use strict";

  const N_DRIVERS = 23;

  /** Макс. очков за уик-энд на пилота: без очков за лучший круг */
  const MAX_NORMAL = 25;
  const MAX_SPRINT = 8 + 25;

  const DRIVERS = [
    { id: "nor", name: "Lando Norris", num: 1, team: "McLaren" },
    { id: "pia", name: "Oscar Piastri", num: 81, team: "McLaren" },
    { id: "rus", name: "George Russell", num: 63, team: "Mercedes" },
    { id: "ant", name: "Andrea Kimi Antonelli", num: 12, team: "Mercedes" },
    { id: "ver", name: "Max Verstappen", num: 3, team: "Red Bull" },
    { id: "had", name: "Isack Hadjar", num: 6, team: "Red Bull" },
    { id: "lec", name: "Charles Leclerc", num: 16, team: "Ferrari" },
    { id: "ham", name: "Lewis Hamilton", num: 44, team: "Ferrari" },
    { id: "alb", name: "Alexander Albon", num: 23, team: "Williams" },
    { id: "sai", name: "Carlos Sainz", num: 55, team: "Williams" },
    { id: "lin", name: "Arvid Lindblad", num: 41, team: "Racing Bulls" },
    { id: "law", name: "Liam Lawson", num: 30, team: "Racing Bulls" },
    { id: "alo", name: "Fernando Alonso", num: 14, team: "Aston Martin" },
    { id: "str", name: "Lance Stroll", num: 18, team: "Aston Martin" },
    { id: "oco", name: "Esteban Ocon", num: 31, team: "Haas" },
    { id: "bea", name: "Oliver Bearman", num: 87, team: "Haas" },
    { id: "hul", name: "Nico Hülkenberg", num: 27, team: "Audi" },
    { id: "bor", name: "Gabriel Bortoleto", num: 5, team: "Audi" },
    { id: "gas", name: "Pierre Gasly", num: 10, team: "Alpine" },
    { id: "col", name: "Franco Colapinto", num: 43, team: "Alpine" },
    { id: "per", name: "Sergio Pérez", num: 11, team: "Cadillac" },
    { id: "bot", name: "Valtteri Bottas", num: 77, team: "Cadillac" },
    { id: "tsu", name: "Yuki Tsunoda", num: 22, team: "Racing Bulls" }
  ];

  const EVENTS = [
    { short: "Австралия", sprint: false },
    { short: "Китай", sprint: true },
    { short: "Япония", sprint: false },
    { short: "Майами", sprint: true },
    { short: "Канада", sprint: true },
    { short: "Монако", sprint: false },
    { short: "Барселона", sprint: false },
    { short: "Австрия", sprint: false },
    { short: "Сильверстоун", sprint: true },
    { short: "Бельгия", sprint: false },
    { short: "Венгрия", sprint: false },
    { short: "Зандворт", sprint: true },
    { short: "Монца", sprint: false },
    { short: "Мадрид", sprint: false },
    { short: "Баку", sprint: false },
    { short: "Малайзия", sprint: false },
    { short: "Сингапур", sprint: true },
    { short: "Остин", sprint: false },
    { short: "Мексика", sprint: false },
    { short: "Интерлагос", sprint: false },
    { short: "Лас-Вегас", sprint: false },
    { short: "Катар", sprint: false },
    { short: "Абу-Даби", sprint: false },
  ];

  const TOTAL_RACES = EVENTS.length;

  function wRem(remaining) {
    let s = 0;
    for (const ev of remaining) {
      s += ev.sprint ? MAX_SPRINT : MAX_NORMAL;
    }
    return s;
  }

  /**
   * Индекс 0–100%: доля «максимально возможного итога» относительно лидера,
   * если на каждом оставшемся ГП пилот набирает максимум очков (спринт/обычный этап по календарю).
   */
  function maxPotentialIndexPercent(p, maxPts, W, remainingLen) {
    if (remainingLen === 0) {
      if (maxPts <= 0) return 100;
      return Math.min(100, (100 * p) / maxPts);
    }
    const denom = maxPts + W;
    if (denom <= 0) return 0;
    return Math.min(100, (100 * (p + W)) / denom);
  }

  function leaderboardOrder(points) {
    const idx = DRIVERS.map((_, i) => i);
    idx.sort((a, b) => {
      const d = points[b] - points[a];
      if (d !== 0) return d;
      return a - b;
    });
    return idx;
  }

  function reorderCards(points) {
    const order = leaderboardOrder(points);
    for (let k = 0; k < order.length; k++) {
      const idx = order[k];
      const card = elDrivers.querySelector(`[data-idx="${idx}"]`);
      if (card) elDrivers.appendChild(card);
    }
  }

  const STORAGE_HIDE_WELCOME = "f1-blacklist-hide-welcome";

  let completedRaces = 0;

  const elSummary = document.getElementById("summary");
  const elDrivers = document.getElementById("drivers");
  const elWelcomeOverlay = document.getElementById("welcome-overlay");
  const elWelcomeOk = document.getElementById("welcome-ok");
  const elWelcomeDismiss = document.getElementById("welcome-dismiss-forever");

  function readPoints() {
    const pts = new Array(N_DRIVERS);
    for (let i = 0; i < N_DRIVERS; i++) {
      const valEl = document.getElementById(`pts-${i}`);
      const v = valEl ? parseInt(valEl.textContent, 10) : 0;
      pts[i] = Number.isFinite(v) ? Math.max(0, v) : 0;
    }
    return pts;
  }

  function renderDriverCards() {
    elDrivers.innerHTML = "";
    DRIVERS.forEach((d, i) => {
      const li = document.createElement("li");
      li.className = "card";
      li.dataset.idx = String(i);
      li.innerHTML = `
        <span class="card__rank" data-rank></span>
        <div class="card__info">
          <h2 class="card__name">${d.name}</h2>
          <p class="card__meta">#${d.num} · ${d.team}</p>
        </div>
        <div class="card__points-wrap">
          <span class="points-label">Очки / Макс:</span>
          <div style="display: flex; align-items: baseline; gap: 0.35rem;">
            <span id="pts-${i}" class="points-value" style="font-size: 1.5rem; font-weight: bold;">0</span>
            <span id="max-${i}" class="points-max" style="color: var(--muted); font-size: 1.1rem; font-weight: 600;">/ 0</span>
          </div>
        </div>
        <div class="card__status" data-status></div>
      `;
      elDrivers.appendChild(li);
    });
  }

  function updateRanks(points) {
    const order = leaderboardOrder(points);
    const rankByIdx = new Array(N_DRIVERS);
    let r = 1;
    for (let k = 0; k < order.length; k++) {
      const idx = order[k];
      if (k > 0 && points[idx] !== points[order[k - 1]]) r = k + 1;
      rankByIdx[idx] = r;
    }
    document.querySelectorAll(".card").forEach((card) => {
      const i = +card.dataset.idx;
      const span = card.querySelector("[data-rank]");
      if (span) span.textContent = String(rankByIdx[i]);
    });
  }

  function updateSummary(completed, remaining) {
    const spr = remaining.filter((e) => e.sprint).length;
    const W = wRem(remaining);
    const names = remaining.map((e) => e.short + (e.sprint ? " (S)" : "")).join(", ");
    if (remaining.length === 0) {
      elSummary.innerHTML = "<strong>Сезон завершён</strong> — оставшихся этапов нет.";
      return;
    }
    elSummary.innerHTML = `
      Осталось этапов: <strong>${remaining.length}</strong> (спринтов среди них: <strong>${spr}</strong>).
      Макс. очков на пилота до конца (модель): <strong>${W}</strong>.
      <br /><span style="color:#8a8780;font-size:0.88em;">${names}</span>
    `;
  }

  function runCalculations() {
    const completed = completedRaces || 0;
    const remaining = EVENTS.slice(completed);
    const points = readPoints();
    const maxPts = Math.max.apply(null, points);
    const sortedDesc = points.slice().sort((a, b) => b - a);
    const uniqueDesc = [];
    for (let u = 0; u < sortedDesc.length; u++) {
      if (u === 0 || sortedDesc[u] !== sortedDesc[u - 1]) uniqueDesc.push(sortedDesc[u]);
    }
    const secondBest = uniqueDesc.length > 1 ? uniqueDesc[1] : 0;
    const leaderCount = points.filter((p) => p === maxPts).length;
    const soleLeaderIdx = leaderCount === 1 ? points.indexOf(maxPts) : -1;
    const W = wRem(remaining);

    updateSummary(completed, remaining);
    reorderCards(points);
    updateRanks(points);

    document.querySelectorAll(".card").forEach((card) => {
      const i = +card.dataset.idx;
      const st = card.querySelector("[data-status]");
      const p = points[i];
      
      const maxEl = document.getElementById(`max-${i}`);
      if (maxEl) maxEl.textContent = `/ ${p + W}`;

      const mathAlive = p + W >= maxPts;
      const idxPct = maxPotentialIndexPercent(p, maxPts, W, remaining.length);
      const pctStr = idxPct.toFixed(1);

      let html = "";
      if (!mathAlive) {
        html = `<span class="math-no">Математика: в борьбе за титул — нет</span> · <span class="mc">Индекс (макс. на остаток): 0%</span>`;
      } else {
        html = `<span class="math-yes">Математика: шанс ещё есть</span>`;
        if (remaining.length === 0) {
          if (p === maxPts) {
            html += ` · <span class="clinch">Итог сезона: в группе лидеров</span>`;
          } else {
            html += ` · <span class="mc">Сезон окончен</span>`;
          }
          html += ` · <span class="mc">Индекс: ~${pctStr}%</span>`;
        } else {
          if (soleLeaderIdx === i && p > secondBest + W) {
            html += ` · <span class="clinch">Титул математически закреплён</span>`;
          }
          html += ` · <span class="mc">Индекс (макс. на каждом ГП): ~${pctStr}%</span>`;
        }
      }
      st.innerHTML = html;
    });
  }

  function closeWelcome(saveNeverShow) {
    if (saveNeverShow) {
      try {
        localStorage.setItem(STORAGE_HIDE_WELCOME, "1");
      } catch (_) { }
    }
    elWelcomeOverlay.hidden = true;
    document.body.classList.remove("is-modal-open");
  }

  function openWelcomeIfNeeded() {
    let hide = false;
    try {
      hide = localStorage.getItem(STORAGE_HIDE_WELCOME) === "1";
    } catch (_) { }
    if (!hide && elWelcomeOverlay) {
      elWelcomeOverlay.hidden = false;
      document.body.classList.add("is-modal-open");
    }
  }

  async function fetchCurrentStandings() {
    try {
      elSummary.innerHTML = "<em>Загрузка данных с Jolpi API...</em>";
      const res = await fetch("https://api.jolpi.ca/ergast/f1/current/driverStandings.json");
      if (!res.ok) throw new Error("API Network Error");
      const data = await res.json();

      const table = data.MRData.StandingsTable;
      const lists = table.StandingsLists || [];
      if (lists.length === 0) return false;
      const list = lists[0];
      const currentRound = parseInt(list.round, 10);
      const standings = list.DriverStandings || [];

      // Map points
      standings.forEach(st => {
        let expectedCode = (st.Driver.code || "").toLowerCase();
        let idx = -1;

        DRIVERS.forEach((d, i) => {
          if (d.id === expectedCode) {
            idx = i;
          }
        });

        if (idx !== -1) {
          const valEl = document.getElementById(`pts-${idx}`);
          if (valEl) valEl.textContent = st.points;
        }
      });

      // Update completed round
      if (!isNaN(currentRound) && currentRound >= 0 && currentRound <= TOTAL_RACES) {
        completedRaces = currentRound;
      }

      return true;
    } catch (err) {
      console.warn("Failed to fetch current standings auto:", err);
      return false;
    }
  }

  renderDriverCards();

  (async function initialize() {
    // Attempt fetching from API
    await fetchCurrentStandings();

    // Final calculations
    runCalculations();
    openWelcomeIfNeeded();
  })();

  if (elWelcomeOk) elWelcomeOk.addEventListener("click", () => closeWelcome(false));
  if (elWelcomeDismiss)
    elWelcomeDismiss.addEventListener("click", () => closeWelcome(true));

})();
