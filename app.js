const STORAGE_KEY = "personal-schedule-events-v1";
const categoryLabels = {
  work: "業務",
  meeting: "商談/会議",
  personal: "個人",
  task: "TODO",
  travel: "移動"
};
const statusLabels = {
  scheduled: "予定済み",
  todo: "未着手",
  done: "完了",
  postponed: "延期",
  "needs-check": "要確認"
};

const state = {
  events: loadEvents(),
  visibleDate: startOfMonth(new Date()),
  selectedDate: toDateKey(new Date()),
  filter: "all",
  search: ""
};

const els = {
  todayText: document.querySelector("#todayText"),
  monthTitle: document.querySelector("#monthTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  selectedDateTitle: document.querySelector("#selectedDateTitle"),
  selectedEvents: document.querySelector("#selectedEvents"),
  upcomingEvents: document.querySelector("#upcomingEvents"),
  eventForm: document.querySelector("#eventForm"),
  eventId: document.querySelector("#eventId"),
  titleInput: document.querySelector("#titleInput"),
  dateInput: document.querySelector("#dateInput"),
  assigneeInput: document.querySelector("#assigneeInput"),
  allDayInput: document.querySelector("#allDayInput"),
  startInput: document.querySelector("#startInput"),
  endInput: document.querySelector("#endInput"),
  categoryInput: document.querySelector("#categoryInput"),
  statusInput: document.querySelector("#statusInput"),
  priorityInput: document.querySelector("#priorityInput"),
  locationInput: document.querySelector("#locationInput"),
  notesInput: document.querySelector("#notesInput"),
  quickMemo: document.querySelector("#quickMemo"),
  conflictWarning: document.querySelector("#conflictWarning"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  filterInput: document.querySelector("#filterInput"),
  todayCount: document.querySelector("#todayCount"),
  weekCount: document.querySelector("#weekCount"),
  highCount: document.querySelector("#highCount"),
  checkCount: document.querySelector("#checkCount"),
  searchInput: document.querySelector("#searchInput"),
  installPanel: document.querySelector("#installPanel"),
  installMessage: document.querySelector("#installMessage"),
  installButton: document.querySelector("#installButton"),
  eventTemplate: document.querySelector("#eventTemplate")
};

bindEvents();
setupInstallExperience();
registerServiceWorker();
resetForm();
render();

function bindEvents() {
  document.querySelector("#prevMonthButton").addEventListener("click", () => {
    state.visibleDate = addMonths(state.visibleDate, -1);
    render();
  });

  document.querySelector("#nextMonthButton").addEventListener("click", () => {
    state.visibleDate = addMonths(state.visibleDate, 1);
    render();
  });

  document.querySelector("#todayButton").addEventListener("click", () => {
    const today = new Date();
    state.visibleDate = startOfMonth(today);
    state.selectedDate = toDateKey(today);
    resetForm({ date: state.selectedDate });
    render();
  });

  document.querySelector("#addSelectedButton").addEventListener("click", () => {
    resetForm({ date: state.selectedDate });
    els.titleInput.focus();
  });

  document.querySelector("#parseMemoButton").addEventListener("click", () => {
    const parsed = parseJapaneseMemo(els.quickMemo.value);
    resetForm({
      title: parsed.title,
      date: parsed.date || state.selectedDate,
      start: parsed.start,
      end: parsed.end,
      allDay: !parsed.start,
      notes: els.quickMemo.value.trim()
    });
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

  els.filterInput.addEventListener("change", () => {
    state.filter = els.filterInput.value;
    renderAgenda();
  });

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    renderAgenda();
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

function setupInstallExperience() {
  let deferredInstallPrompt = null;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  const isFile = window.location.protocol === "file:";

  if (isStandalone) {
    els.installMessage.textContent = "ホーム画面からアプリとして起動中です。予定はこの端末内に保存されます。";
    return;
  }

  if (isFile) {
    els.installMessage.textContent = "携帯へ入れるには、このフォルダをHTTPSで配信してからホーム画面に追加します。";
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installButton.classList.remove("hidden");
    els.installMessage.textContent = "この端末のホーム画面に追加できます。";
  });

  els.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installButton.classList.add("hidden");
  });

  window.addEventListener("appinstalled", () => {
    els.installMessage.textContent = "ホーム画面に追加しました。";
    els.installButton.classList.add("hidden");
  });

  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    els.installMessage.textContent = "Safariの共有ボタンから「ホーム画面に追加」を選ぶとアプリ化できます。";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      els.installMessage.textContent = "オフライン設定を有効化できませんでした。通常利用は可能です。";
    });
  });
}

function render() {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long"
  });
  els.todayText.textContent = new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "full"
  }).format(new Date());
  els.monthTitle.textContent = formatter.format(state.visibleDate);
  renderStats();
  renderCalendar();
  renderAgenda();
  updateConflictWarning();
}

function renderStats() {
  const today = toDateKey(new Date());
  const weekEnd = toDateKey(addDays(new Date(), 7));
  els.todayCount.textContent = state.events.filter((item) => item.date === today).length;
  els.weekCount.textContent = state.events.filter((item) => item.date >= today && item.date <= weekEnd).length;
  els.highCount.textContent = state.events.filter((item) => item.priority === "high").length;
  els.checkCount.textContent = state.events.filter((item) => item.status === "needs-check").length;
}

function renderCalendar() {
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
      resetForm({ date: dateKey });
      render();
    });

    const dayEvents = eventsForDate(dateKey).slice(0, 4);
    cell.innerHTML = `
      <span class="day-number">
        <span>${date.getDate()}</span>
        <span>${eventsForDate(dateKey).length || ""}</span>
      </span>
      <span class="day-events"></span>
    `;

    const eventWrap = cell.querySelector(".day-events");
    dayEvents.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = `chip ${item.category}`;
      chip.textContent = `${formatTimeRange(item)} ${item.title}`.trim();
      eventWrap.appendChild(chip);
    });
    els.calendarGrid.appendChild(cell);
  }
}

function renderAgenda() {
  els.selectedDateTitle.textContent = formatDateHeading(state.selectedDate);
  renderEventList(els.selectedEvents, eventsForDate(state.selectedDate));

  const today = toDateKey(new Date());
  const upcoming = state.events
    .filter((item) => item.date >= today)
    .filter((item) => state.filter === "all" || item.category === state.filter)
    .filter(matchesSearch)
    .sort(sortEvents)
    .slice(0, 12);
  renderEventList(els.upcomingEvents, upcoming);
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

  events.sort(sortEvents).forEach((item) => {
    const node = els.eventTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".event-time").textContent = `${item.date} ${formatTimeRange(item)}`.trim();
    node.querySelector(".event-title").textContent = item.title;
    node.querySelector(".event-meta").textContent = [
      item.assignee,
      categoryLabels[item.category],
      statusLabels[item.status],
      item.location,
      item.priority === "high" ? "重要" : ""
    ]
      .filter(Boolean)
      .join(" / ");
    node.querySelector(".edit-button").addEventListener("click", () => editEvent(item.id));
    node.querySelector(".delete-button").addEventListener("click", () => deleteEvent(item.id));
    container.appendChild(node);
  });
}

function saveCurrentForm() {
  const event = {
    id: els.eventId.value || crypto.randomUUID(),
    title: els.titleInput.value.trim(),
    date: els.dateInput.value,
    assignee: els.assigneeInput.value.trim(),
    allDay: els.allDayInput.checked,
    start: els.allDayInput.checked ? "" : els.startInput.value,
    end: els.allDayInput.checked ? "" : els.endInput.value,
    category: els.categoryInput.value,
    status: els.statusInput.value,
    priority: els.priorityInput.value,
    location: els.locationInput.value.trim(),
    notes: els.notesInput.value.trim(),
    updatedAt: new Date().toISOString()
  };

  if (!event.title || !event.date || !event.assignee) return;
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
  render();
}

function editEvent(id) {
  const item = state.events.find((event) => event.id === id);
  if (!item) return;
  els.eventId.value = item.id;
  els.titleInput.value = item.title;
  els.dateInput.value = item.date;
  els.assigneeInput.value = item.assignee;
  els.allDayInput.checked = item.allDay;
  els.startInput.value = item.start;
  els.endInput.value = item.end;
  els.categoryInput.value = item.category;
  els.statusInput.value = item.status;
  els.priorityInput.value = item.priority;
  els.locationInput.value = item.location;
  els.notesInput.value = item.notes;
  els.cancelEditButton.classList.remove("hidden");
  els.startInput.disabled = item.allDay;
  els.endInput.disabled = item.allDay;
  updateConflictWarning();
}

function deleteEvent(id) {
  state.events = state.events.filter((item) => item.id !== id);
  persist();
  resetForm({ date: state.selectedDate });
  render();
}

function resetForm(overrides = {}) {
  els.eventForm.reset();
  els.eventId.value = "";
  els.titleInput.value = overrides.title || "";
  els.dateInput.value = overrides.date || state.selectedDate;
  els.assigneeInput.value = overrides.assignee || "自分";
  els.allDayInput.checked = overrides.allDay ?? false;
  els.startInput.value = overrides.start || "";
  els.endInput.value = overrides.end || "";
  els.categoryInput.value = overrides.category || "work";
  els.statusInput.value = overrides.status || "scheduled";
  els.priorityInput.value = overrides.priority || "normal";
  els.locationInput.value = overrides.location || "";
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
    assignee: els.assigneeInput.value.trim(),
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
    if (item.assignee !== draft.assignee) return false;
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
  const haystack = [item.title, item.assignee, item.location, item.notes].join(" ").toLowerCase();
  return haystack.includes(state.search);
}

function parseJapaneseMemo(text) {
  const source = text.trim();
  const now = new Date();
  let date = state.selectedDate;
  let cleaned = source;

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
    title: cleaned.replace(/\s+/g, " ").trim() || source || "新しい予定"
  };
}

function toCsv(events) {
  const headers = ["date", "start", "end", "allDay", "assignee", "category", "status", "priority", "title", "location", "notes"];
  const rows = events.sort(sortEvents).map((item) => headers.map((key) => csvEscape(item[key])).join(","));
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
  return {
    id: item.id || crypto.randomUUID(),
    title: String(item.title),
    date: String(item.date),
    assignee: item.assignee || "自分",
    allDay: Boolean(item.allDay),
    start: item.start || "",
    end: item.end || "",
    category: categoryLabels[item.category] ? item.category : "work",
    status: statusLabels[item.status] ? item.status : "scheduled",
    priority: ["low", "normal", "high"].includes(item.priority) ? item.priority : "normal",
    location: item.location || "",
    notes: item.notes || "",
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function addSampleEvents() {
  const today = toDateKey(new Date());
  const tomorrow = toDateKey(addDays(new Date(), 1));
  state.events = [
    ...state.events,
    {
      id: crypto.randomUUID(),
      title: "朝の優先順位整理",
      date: today,
      assignee: "自分",
      allDay: false,
      start: "09:00",
      end: "09:30",
      category: "task",
      status: "needs-check",
      priority: "high",
      location: "",
      notes: "今日の予定、返信、待ちを確認",
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: "顧客向け提案メモ作成",
      date: tomorrow,
      assignee: "自分",
      allDay: false,
      start: "14:00",
      end: "15:00",
      category: "work",
      status: "scheduled",
      priority: "normal",
      location: "オンライン",
      notes: "",
      updatedAt: new Date().toISOString()
    }
  ];
  persist();
  render();
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
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.map(normalizeEvent).filter(Boolean) : [];
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
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(new Date(`${dateKey}T00:00:00`));
}

function formatTimeRange(item) {
  if (item.allDay) return "終日";
  if (item.start && item.end) return `${item.start}-${item.end}`;
  return item.start || "";
}

function addMinutesToTime(time, minutes) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hour, minute + minutes);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
