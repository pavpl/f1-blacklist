(function () {
  "use strict";

  const N_DRIVERS = 22;

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
  const STORAGE_STATE = "f1-blacklist-state";
  const STATE_VERSION = 1;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_STATE);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== STATE_VERSION || !Array.isArray(data.points)) return null;
      if (data.points.length !== N_DRIVERS) return null;
      const c = parseInt(data.completed, 10);
      if (!Number.isFinite(c) || c < 0 || c > TOTAL_RACES) return null;
      const pts = new Array(N_DRIVERS);
      for (let i = 0; i < N_DRIVERS; i++) {
        const x = Number(data.points[i]);
        if (!Number.isFinite(x) || x < 0) return null;
        pts[i] = Math.min(Math.floor(x), 1e6);
      }
      return { completed: c, points: pts };
    } catch (_) {
      return null;
    }
  }

  function applyState(st) {
    if (!st) return;
    elCompleted.value = String(st.completed);
    for (let i = 0; i < N_DRIVERS; i++) {
      const inp = document.getElementById(`pts-${i}`);
      if (inp) inp.value = String(st.points[i]);
    }
  }

  function saveState() {
    try {
      const points = readPoints();
      const completed = parseInt(elCompleted.value, 10) || 0;
      localStorage.setItem(
        STORAGE_STATE,
        JSON.stringify({
          v: STATE_VERSION,
          completed,
          points,
        })
      );
    } catch (_) {}
  }

  const elCompleted = document.getElementById("completed");
  const elSummary = document.getElementById("summary");
  const elDrivers = document.getElementById("drivers");
  const elWelcomeOverlay = document.getElementById("welcome-overlay");
  const elWelcomeOk = document.getElementById("welcome-ok");
  const elWelcomeDismiss = document.getElementById("welcome-dismiss-forever");

  function buildCompletedSelect() {
    elCompleted.innerHTML = "";
    for (let k = 0; k <= TOTAL_RACES; k++) {
      const opt = document.createElement("option");
      opt.value = String(k);
      opt.textContent = k === 0 ? "0 (старт сезона)" : String(k);
      elCompleted.appendChild(opt);
    }
    elCompleted.value = "3";
  }

  function readPoints() {
    const pts = new Array(N_DRIVERS);
    for (let i = 0; i < N_DRIVERS; i++) {
      const inp = document.getElementById(`pts-${i}`);
      const v = inp ? parseInt(inp.value, 10) : 0;
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
          <label for="pts-${i}">Очки</label>
          <input type="number" id="pts-${i}" class="points-input" min="0" step="1" value="0" />
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
    const completed = parseInt(elCompleted.value, 10) || 0;
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

    saveState();
  }

  let debounceTimer = null;
  function scheduleRun() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runCalculations, 320);
  }

  function closeWelcome(saveNeverShow) {
    if (saveNeverShow) {
      try {
        localStorage.setItem(STORAGE_HIDE_WELCOME, "1");
      } catch (_) {}
    }
    elWelcomeOverlay.hidden = true;
    document.body.classList.remove("is-modal-open");
  }

  function openWelcomeIfNeeded() {
    let hide = false;
    try {
      hide = localStorage.getItem(STORAGE_HIDE_WELCOME) === "1";
    } catch (_) {}
    if (!hide && elWelcomeOverlay) {
      elWelcomeOverlay.hidden = false;
      document.body.classList.add("is-modal-open");
    }
  }

  buildCompletedSelect();
  renderDriverCards();
  applyState(loadState());

  elCompleted.addEventListener("change", runCalculations);
  elDrivers.addEventListener("input", (e) => {
    if (e.target.classList.contains("points-input")) scheduleRun();
  });

  if (elWelcomeOk) elWelcomeOk.addEventListener("click", () => closeWelcome(false));
  if (elWelcomeDismiss)
    elWelcomeDismiss.addEventListener("click", () => closeWelcome(true));

  runCalculations();
  openWelcomeIfNeeded();
})();
