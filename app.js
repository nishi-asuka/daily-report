const STORAGE_KEY = "personal-schedule-events-v3";
const LEGACY_STORAGE_KEYS = ["personal-schedule-events-v2", "personal-schedule-events-v1"];

const categoryLabels = {
  travel: "出張",
  visitor: "来客",
  meal: "食事会",
  lecturer: "外部講師",
  off: "休み",
  use: "私用",
  other: "その他"
};

const state = {
  events: loadEvents(),
  visibleDate: startOfMonth(new Date()),
  selectedDate: toDateKey(new Date()),
  activeView: "list",
  period: "upcoming",
  categoryFilter: "all",
  search: ""
};

const els = {
  todayText: document.querySelector("#todayText"),
  monthTitle: document.querySelector("#monthTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  selectedDateTitle: document.querySelector("#selectedDateTitle"),
  selectedEvents: document.querySelector("#selectedEvents"),
  allEventsList: document.querySelector("#allEventsList"),
  eventForm: document.querySelector("#eventForm"),
  eventId: document.querySelector("#eventId"),
  titleInput: document.querySelector("#titleInput"),
  dateInput: document.querySelector("#dateInput"),
  allDayInput: document.querySelector("#allDayInput"),
  startInput: document.querySelector("#startInput"),
  endInput: document.querySelector("#endInput"),
  categoryInput: document.querySelector("#categoryInput"),
  notesInput: document.querySelector("#notesInput"),
  quickMemo: document.querySelector("#quickMemo"),
  conflictWarning: document.querySelector("#conflictWarning"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  searchInput: document.querySelector("#searchInput"),
  filterCategoryInput: document.querySelector("#filterCategoryInput"),
  todayCount: document.querySelector("#todayCount"),
  tomorrowCount: document.querySelector("#tomorrowCount"),
  weekCount: document.querySelector("#weekCount"),
  upcomingCount: document.querySelector("#upcomingCount"),
  eventTemplate: document.querySelector("#eventTemplate")
};

bindEvents();
registerServiceWorker();
resetForm();
render();

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view));
  });

  document.querySelector("#quickAddButton").addEventListener("click", () => openNewEventForm());
  document.querySelector("#listAddButton").addEventListener("click", () => openNewEventForm());

  document.querySelector("#prevMonthButton").addEventListener("click", () => {
    state.visibleDate = addMonths(state.visibleDate, -1);
    renderCalendar();
  });

  document.querySelector("#nextMonthButton").addEventListener("click", () => {
    state.visibleDate = addMonths(state.visibleDate, 1);
    renderCalendar();
  });

  document.querySelector("#todayButton").addEventListener("click", () => {
    const today = new Date();
    state.visibleDate = startOfMonth(today);
    state.selectedDate = toDateKey(today);
    resetForm({ date: state.selectedDate });
    render();
  });

  document.querySelector("#addSelectedButton").addEventListener("click", () => openNewEventForm(state.selectedDate));

  document.querySelector("#parseMemoButton").addEventListener("click", () => {
    const parsed = parseJapaneseMemo(els.quickMemo.value);
    resetForm({
      title: parsed.title,
      date: parsed.date || state.selectedDate,
      start: parsed.start,
      end: parsed.end,
      allDay: !parsed.start,
      category: parsed.category,
      notes: els.quickMemo.value.trim()
    });
    setActiveView("form");
    els.titleInput.focus();
  });

  els.eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCurrentForm();
  });

  els.cancelEditButton.addEventListener("click", () => resetForm({ date: state.selectedDate }));

  [els.dateInput, els.startInput, els.endInput, els.allDayInput].forEach((input) => {
    input.addEventListener("input", updateConflictWarning);
  });

  els.allDayInput.addEventListener("change", () => {
    const disabled = els.allDayInput.checked;
    els.startInput.disabled = disabled;
    els.endInput.disabled = disabled;
    if (disabled) {
      els.startInput.value = "";
      els.endInput.value = "";
    }
    updateConflictWarning();
  });

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    renderList();
  });

  els.filterCategoryInput.addEventListener("change", () => {
    state.categoryFilter = els.filterCategoryInput.value;
    renderList();
  });

  document.querySelectorAll("[data-period]").forEach((button) => {
    button.addEventListener("click", () => {
      state.period = button.dataset.period;
      document.querySelectorAll("[data-period]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderList();
    });
  });

  document.querySelector("#exportJsonButton").addEventListener("click", () => {
    downloadFile("schedule-events.json", JSON.stringify(state.events, null, 2), "application/json");
  });

  document.querySelector("#exportCsvButton").addEventListener("click", () => {
    downloadFile("schedule-events.csv", toCsv(state.events), "text/csv;charset=utf-8");
  });

  document.querySelector("#importInput").addEventListener("change", importJson);
  document.querySelector("#seedButton").addEventListener("click", addSampleEvents);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}

function setActiveView(view) {
  state.activeView = view;
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `${view}View`);
  });
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openNewEventForm(date = state.selectedDate) {
  resetForm({ date });
  setActiveView("form");
  els.titleInput.focus();
}

function render() {
  els.todayText.textContent = new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "full"
  }).format(new Date());
  renderStats();
  renderList();
  renderCalendar();
  renderSelectedDay();
  updateConflictWarning();
}

function renderStats() {
  const today = toDateKey(new Date());
  const tomorrow = toDateKey(addDays(new Date(), 1));
  const weekEnd = toDateKey(addDays(new Date(), 7));
  els.todayCount.textContent = state.events.filter((item) => item.date === today).length;
  els.tomorrowCount.textContent = state.events.filter((item) => item.date === tomorrow).length;
  els.weekCount.textContent = state.events.filter((item) => item.date >= today && item.date <= weekEnd).length;
  els.upcomingCount.textContent = state.events.filter((item) => item.date >= today).length;
}

function renderList() {
  const events = filteredEvents();
  els.allEventsList.innerHTML = "";

  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "条件に合う予定はありません";
    els.allEventsList.appendChild(empty);
    return;
  }

  const grouped = groupByDate(events);
  Object.entries(grouped).forEach(([date, items]) => {
    const section = document.createElement("section");
    section.className = "date-group";
    section.innerHTML = `
      <div class="date-heading">
        <span class="date-label">${formatDateHeading(date)}</span>
        <small>${items.length}件</small>
      </div>
      <div class="event-list"></div>
    `;
    const list = section.querySelector(".event-list");
    items.forEach((item) => list.appendChild(createEventNode(item)));
    els.allEventsList.appendChild(section);
  });
}

function renderCalendar() {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long"
  });
  els.monthTitle.textContent = formatter.format(state.visibleDate);
  els.calendarGrid.innerHTML = "";

  const first = startOfMonth(state.visibleDate);
  const start = addDays(first, -(first.getDay() === 0 ? 6 : first.getDay() - 1));
  const todayKey = toDateKey(new Date());

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(start, index);
    const dateKey = toDateKey(date);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell";
    if (date.getMonth() !== state.visibleDate.getMonth()) cell.classList.add("is-muted");
    if (dateKey === todayKey) cell.classList.add("is-today");
    if (dateKey === state.selectedDate) cell.classList.add("is-selected");
    cell.addEventListener("click", () => {
      state.selectedDate = dateKey;
      renderCalendar();
      renderSelectedDay();
    });

    const dayEvents = eventsForDate(dateKey);
    if (dayEvents.some((item) => item.category === "off")) cell.classList.add("has-off");
    cell.innerHTML = `
      <span class="day-number">
        <span>${date.getDate()}</span>
        <span>${dayEvents.length || ""}</span>
      </span>
      <span class="day-events"></span>
    `;

    const eventWrap = cell.querySelector(".day-events");
    dayEvents.slice(0, 3).forEach((item) => {
      const chip = document.createElement("span");
      chip.className = `chip ${item.category}`;
      chip.textContent = item.title;
      eventWrap.appendChild(chip);
    });
    els.calendarGrid.appendChild(cell);
  }
}

function renderSelectedDay() {
  els.selectedDateTitle.textContent = formatDateHeading(state.selectedDate);
  renderEventList(els.selectedEvents, eventsForDate(state.selectedDate));
}

function renderEventList(container, events) {
  container.innerHTML = "";
  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "予定なし";
    container.appendChild(empty);
    return;
  }
  events.sort(sortEvents).forEach((item) => container.appendChild(createEventNode(item)));
}

function createEventNode(item) {
  const node = els.eventTemplate.content.firstElementChild.cloneNode(true);
  node.classList.add(`category-${item.category}`);
  node.querySelector(".event-time").textContent = formatTimeRange(item);
  node.querySelector(".event-category").textContent = categoryLabels[item.category] || categoryLabels.other;
  node.querySelector(".event-title").textContent = item.title;
  node.querySelector(".event-meta").textContent = item.notes || "メモなし";

  node.querySelector(".edit-button").addEventListener("click", () => editEvent(item.id));
  node.querySelector(".delete-button").addEventListener("click", () => deleteEvent(item.id));
  return node;
}

function filteredEvents() {
  const today = toDateKey(new Date());
  const tomorrow = toDateKey(addDays(new Date(), 1));
  const weekEnd = toDateKey(addDays(new Date(), 7));

  return state.events
    .filter((item) => {
      if (state.categoryFilter !== "all" && item.category !== state.categoryFilter) return false;
      if (!matchesSearch(item)) return false;
      if (state.period === "today") return item.date === today;
      if (state.period === "tomorrow") return item.date === tomorrow;
      if (state.period === "week") return item.date >= today && item.date <= weekEnd;
      return item.date >= today;
    })
    .sort(sortEvents);
}

function saveCurrentForm() {
  const event = {
    id: els.eventId.value || crypto.randomUUID(),
    title: els.titleInput.value.trim(),
    date: els.dateInput.value,
    allDay: els.allDayInput.checked,
    start: els.allDayInput.checked ? "" : els.startInput.value,
    end: els.allDayInput.checked ? "" : els.endInput.value,
    category: els.categoryInput.value,
    notes: els.notesInput.value.trim(),
    updatedAt: new Date().toISOString()
  };

  if (!event.title || !event.date) return;
  if (!event.allDay && event.start && event.end && event.end < event.start) {
    els.conflictWarning.textContent = "終了時刻が開始時刻より前です。";
    els.conflictWarning.classList.remove("hidden");
    return;
  }

  const existingIndex = state.events.findIndex((item) => item.id === event.id);
  if (existingIndex >= 0) {
    state.events[existingIndex] = event;
  } else {
    state.events.push(event);
  }

  state.selectedDate = event.date;
  state.visibleDate = startOfMonth(new Date(`${event.date}T00:00:00`));
  persist();
  resetForm({ date: event.date });
  setActiveView("list");
  render();
}

function editEvent(id) {
  const item = state.events.find((event) => event.id === id);
  if (!item) return;
  els.eventId.value = item.id;
  els.titleInput.value = item.title;
  els.dateInput.value = item.date;
  els.allDayInput.checked = item.allDay;
  els.startInput.value = item.start;
  els.endInput.value = item.end;
  els.categoryInput.value = item.category;
  els.notesInput.value = item.notes;
  els.cancelEditButton.classList.remove("hidden");
  els.startInput.disabled = item.allDay;
  els.endInput.disabled = item.allDay;
  updateConflictWarning();
  setActiveView("form");
}

function deleteEvent(id) {
  state.events = state.events.filter((item) => item.id !== id);
  persist();
  render();
}

function resetForm(overrides = {}) {
  els.eventForm.reset();
  els.eventId.value = "";
  els.titleInput.value = overrides.title || "";
  els.dateInput.value = overrides.date || state.selectedDate;
  els.allDayInput.checked = overrides.allDay ?? false;
  els.startInput.value = overrides.start || "";
  els.endInput.value = overrides.end || "";
  els.categoryInput.value = overrides.category || "other";
  els.notesInput.value = overrides.notes || "";
  els.startInput.disabled = els.allDayInput.checked;
  els.endInput.disabled = els.allDayInput.checked;
  els.cancelEditButton.classList.add("hidden");
  els.conflictWarning.classList.add("hidden");
}

function updateConflictWarning() {
  const draft = {
    id: els.eventId.value,
    date: els.dateInput.value,
    allDay: els.allDayInput.checked,
    start: els.startInput.value,
    end: els.endInput.value
  };
  const conflicts = findConflicts(draft);
  if (!conflicts.length) {
    els.conflictWarning.classList.add("hidden");
    return;
  }
  els.conflictWarning.textContent = `重複候補: ${conflicts.map((item) => item.title).join("、")}`;
  els.conflictWarning.classList.remove("hidden");
}

function findConflicts(draft) {
  if (!draft.date || draft.allDay || !draft.start) return [];
  return state.events.filter((item) => {
    if (item.id === draft.id || item.date !== draft.date || item.allDay || !item.start) return false;
    const draftEnd = draft.end || draft.start;
    const itemEnd = item.end || item.start;
    return draft.start <= itemEnd && draftEnd >= item.start;
  });
}

function eventsForDate(dateKey) {
  return state.events.filter((item) => item.date === dateKey).sort(sortEvents);
}

function sortEvents(a, b) {
  return `${a.date} ${a.start || "00:00"}`.localeCompare(`${b.date} ${b.start || "00:00"}`);
}

function matchesSearch(item) {
  if (!state.search) return true;
  const haystack = [item.title, categoryLabels[item.category], item.notes].join(" ").toLowerCase();
  return haystack.includes(state.search);
}

function groupByDate(events) {
  return events.reduce((groups, item) => {
    groups[item.date] = groups[item.date] || [];
    groups[item.date].push(item);
    return groups;
  }, {});
}

function parseJapaneseMemo(text) {
  const source = text.trim();
  const now = new Date();
  let date = state.selectedDate;
  let cleaned = source;
  const category = inferCategoryFromText(source);

  if (/明日/.test(cleaned)) {
    date = toDateKey(addDays(now, 1));
    cleaned = cleaned.replace(/明日/g, "");
  } else if (/今日|本日/.test(cleaned)) {
    date = toDateKey(now);
    cleaned = cleaned.replace(/今日|本日/g, "");
  } else {
    const dateMatch = cleaned.match(/(\d{1,2})[\/月](\d{1,2})日?/);
    if (dateMatch) {
      const year = now.getFullYear();
      date = toDateKey(new Date(year, Number(dateMatch[1]) - 1, Number(dateMatch[2])));
      cleaned = cleaned.replace(dateMatch[0], "");
    }
  }

  const timeMatch = cleaned.match(/(\d{1,2})(?::|時)(\d{2})?/);
  const start = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${(timeMatch[2] || "00").padStart(2, "0")}` : "";
  const end = start ? addMinutesToTime(start, 60) : "";
  if (timeMatch) cleaned = cleaned.replace(timeMatch[0], "");

  return {
    date,
    start,
    end,
    category,
    title: cleaned.replace(/\s+/g, " ").trim() || source || "新しい予定"
  };
}

function inferCategoryFromText(text) {
  if (/出張|遠方|移動/.test(text)) return "travel";
  if (/来客|来社|訪問者|お客様/.test(text)) return "visitor";
  if (/食事|会食|ランチ|夕食|懇親/.test(text)) return "meal";
  if (/講師|研修|セミナー|勉強会/.test(text)) return "lecturer";
  if (/休み|休暇|有休|休日/.test(text)) return "off";
  if (/私用|プライベート|個人|美容|ヘアカット/.test(text)) return "use";
  return "other";
}

function toCsv(events) {
  const headers = ["date", "start", "end", "allDay", "category", "title", "notes"];
  const rows = [...events].sort(sortEvents).map((item) => headers.map((key) => csvEscape(item[key])).join(","));
  return [headers.join(","), ...rows].join("\r\n");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!Array.isArray(imported)) throw new Error("Invalid JSON");
      state.events = imported.map(normalizeEvent).filter(Boolean);
      persist();
      render();
      setActiveView("list");
    } catch {
      alert("JSONを読み込めませんでした。");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function normalizeEvent(item) {
  if (!item || !item.title || !item.date) return null;
  const legacyMemo = [item.notes, item.location, item.project, item.branch].filter(Boolean).join("\n");
  return {
    id: item.id || crypto.randomUUID(),
    title: String(item.title),
    date: String(item.date),
    allDay: Boolean(item.allDay),
    start: item.start || "",
    end: item.end || "",
    category: mapCategory(item.category, item.title, legacyMemo),
    notes: legacyMemo,
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function mapCategory(category, title = "", notes = "") {
  if (categoryLabels[category]) return category;
  if (category === "travel") return "travel";
  if (category === "customer" || category === "meeting") return "visitor";
  if (category === "personal") return "off";
  if (category === "branch") return "other";
  const inferred = inferCategoryFromText(`${title} ${notes}`);
  return inferred === "other" ? "other" : inferred;
}

function addSampleEvents() {
  const today = toDateKey(new Date());
  const tomorrow = toDateKey(addDays(new Date(), 1));
  const dayAfterTomorrow = toDateKey(addDays(new Date(), 2));
  const threeDaysLater = toDateKey(addDays(new Date(), 3));
  const fourDaysLater = toDateKey(addDays(new Date(), 4));
  const fiveDaysLater = toDateKey(addDays(new Date(), 5));
  state.events = [
    ...state.events,
    {
      id: crypto.randomUUID(),
      title: "来客対応",
      date: today,
      allDay: false,
      start: "10:00",
      end: "11:00",
      category: "visitor",
      notes: "応接室を確認",
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: "京都出張",
      date: today,
      allDay: false,
      start: "13:00",
      end: "17:00",
      category: "travel",
      notes: "移動時間を確保",
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: "食事会",
      date: tomorrow,
      allDay: false,
      start: "12:00",
      end: "13:30",
      category: "meal",
      notes: "予約確認",
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: "外部講師",
      date: tomorrow,
      allDay: false,
      start: "15:00",
      end: "16:00",
      category: "lecturer",
      notes: "資料と投影環境を確認",
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: "休み",
      date: dayAfterTomorrow,
      allDay: true,
      start: "",
      end: "",
      category: "off",
      notes: "終日休み",
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: "私用の予定",
      date: threeDaysLater,
      allDay: false,
      start: "14:00",
      end: "15:00",
      category: "use",
      notes: "移動時間を確認",
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: "その他確認",
      date: fourDaysLater,
      allDay: false,
      start: "16:00",
      end: "16:30",
      category: "other",
      notes: "未分類の予定",
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: "来客準備",
      date: fiveDaysLater,
      allDay: false,
      start: "09:30",
      end: "10:00",
      category: "visitor",
      notes: "資料を印刷",
      updatedAt: new Date().toISOString()
    }
  ];
  persist();
  render();
  setActiveView("list");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadEvents() {
  try {
    const stored = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS].map((key) => localStorage.getItem(key)).find(Boolean) || "[]";
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeEvent).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events));
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateHeading(dateKey) {
  const target = new Date(`${dateKey}T00:00:00`);
  const today = toDateKey(new Date());
  const tomorrow = toDateKey(addDays(new Date(), 1));
  const prefix = dateKey === today ? "今日" : dateKey === tomorrow ? "明日" : "";
  const label = new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(target);
  return prefix ? `${prefix} ${label}` : label;
}

function formatTimeRange(item) {
  if (item.allDay) return "終日";
  if (item.start && item.end) return `${item.start}-${item.end}`;
  if (item.start) return item.start;
  return "時間未定";
}

function addMinutesToTime(time, minutes) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hour, minute + minutes);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
